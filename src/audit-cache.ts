import { chmodSync, closeSync, existsSync, fstatSync, mkdirSync, openSync, readSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, posix } from "node:path";
import { absolutePath } from "./paths.ts";
import { sha256, stateDir } from "./state.ts";
import type { AuditError, AuditFinding } from "./audit.ts";
import type { Read } from "./types.ts";

const MAX_BYTES = 4 * 1024 * 1024;
const MAX_PROJECTS = 64;
type Result = { findings: AuditFinding[]; errors: AuditError[] };
interface Entry { path: string; hash: string; inputs: Record<string, string | null>; result: Result }
export interface AuditCache {
  root: string; file: string; identity: string; entries: Map<string, Entry>; available: Map<string, Entry>; bytes: number; dirty: boolean;
  stats: { reusedFiles: number; evaluatedFiles: number; invalidatedFiles: number; storedFiles: number; persisted: boolean; error: string | null;
    maxBytesPerProject: number; maxProjects: number };
}

// Disposable, local diagnostics only. Enforcement never reads this cache.
export function openAuditCache(root: string, identity: string, fresh: boolean): AuditCache {
  const cache: AuditCache = { root, identity, file: join(stateDir(), "audits", sha256(root) + ".json"), entries: new Map(), available: new Map(), bytes: 0, dirty: false,
    stats: { reusedFiles: 0, evaluatedFiles: 0, invalidatedFiles: 0, storedFiles: 0, persisted: false, error: null, maxBytesPerProject: MAX_BYTES, maxProjects: MAX_PROJECTS } };
  if (fresh) return cache;
  loadSavedEntries(cache);
  return cache;
}

function loadSavedEntries(cache: AuditCache): void {
  try {
    if (!existsSync(cache.file)) return;
    const saved = readSaved(cache.file);
    if (saved.version !== 1 || saved.root !== cache.root || saved.identity !== cache.identity || !Array.isArray(saved.entries)
      || saved.digest !== sha256(JSON.stringify(saved.entries)) || !saved.entries.every(validEntry)) return;
    for (const entry of saved.entries as Entry[]) {
      cache.entries.set(entry.path, entry); cache.available.set(entry.path, entry); cache.bytes += entryBytes(entry);
    }
    cache.stats.storedFiles = cache.entries.size;
  } catch { cache.stats.error = "Cache unavailable or invalid; analysis runs without reuse."; }
}

function readSaved(file: string) {
  return closingAfter(openSync(file, "r"), readBoundedJson);
}

function closingAfter<T>(fd: number, use: (fd: number) => T): T {
  try { return use(fd); } finally { closeSync(fd); }
}

function readBoundedJson(fd: number) {
  const size = fstatSync(fd).size;
  if (size > MAX_BYTES) throw new Error("Cache exceeds byte budget");
  const bytes = Buffer.alloc(size + 1);
  let count = 0;
  while (count < bytes.length) {
    const n = readSync(fd, bytes, count, bytes.length - count, null);
    if (!n) break;
    count += n;
  }
  if (count !== size) throw new Error("Cache changed during bounded read");
  return JSON.parse(bytes.subarray(0, count).toString("utf8"));
}

export function cachedAnalysis(cache: AuditCache, path: string, hash: string, read: Read): Result | null {
  // Keep the prior checkpoint readable even as new results evict write entries.
  const entry = cache.available.get(path);
  if (!entry) return null;
  if (entry.hash !== hash || Object.entries(entry.inputs).some(([p, expected]) => {
    const text = read(p); return (text === null ? null : sha256(text)) !== expected;
  })) {
    cache.stats.invalidatedFiles++; return null;
  }
  cache.stats.reusedFiles++;
  storeEntry(cache, entry);
  return entry.result;
}

export function rememberAnalysis(cache: AuditCache, path: string, hash: string, inputs: Record<string, string | null>, result: Result): void {
  cache.stats.evaluatedFiles++;
  const previous = cache.entries.get(path);
  if (previous) { cache.bytes -= entryBytes(previous); cache.entries.delete(path); cache.dirty = true; }
  cache.stats.storedFiles = cache.entries.size;
  if (!safePath(path) || !Object.keys(inputs).every(safePath) || result.errors.some((e) => !["syntax", "unresolvable-import"].includes(e.cause))) return;
  const entry = { path, hash, inputs, result }, bytes = entryBytes(entry);
  if (bytes > MAX_BYTES / 2) return;
  storeEntry(cache, entry);
}

function storeEntry(cache: AuditCache, entry: Entry): void {
  const prior = cache.entries.get(entry.path);
  if (prior === entry) return;
  if (prior) { cache.bytes -= entryBytes(prior); cache.entries.delete(entry.path); }
  const bytes = entryBytes(entry);
  while (cache.bytes + bytes > MAX_BYTES - 1024 && cache.entries.size) {
    const oldest = cache.entries.keys().next().value!;
    cache.bytes -= entryBytes(cache.entries.get(oldest)!); cache.entries.delete(oldest);
  }
  cache.entries.set(entry.path, entry); cache.bytes += bytes; cache.dirty = true;
  cache.stats.storedFiles = cache.entries.size;
}

// Atomic checkpoints make an interrupted run resumable. Every reused input is
// still read and hashed on the next invocation; a checkpoint is not compliance.
export function saveAuditCache(cache: AuditCache): void {
  if (!cache.dirty) return;
  const entries = [...cache.entries.values()];
  const text = JSON.stringify({ version: 1, root: cache.root, identity: cache.identity, entries, digest: sha256(JSON.stringify(entries)) });
  if (Buffer.byteLength(text) > MAX_BYTES) { cache.stats.error = "Cache byte budget reached; current analysis results remain valid."; return; }
  const folder = dirname(cache.file), temporary = `${cache.file}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  writeCheckpoint(cache, text, folder, temporary);
}

function writeCheckpoint(cache: AuditCache, text: string, folder: string, temporary: string): void {
  try {
    mkdirSync(folder, { recursive: true });
    trimProjects(folder, cache.file);
    writeFileSync(temporary, text, { mode: 0o600 }); renameSync(temporary, cache.file); chmodSync(cache.file, 0o600);
    cache.dirty = false; cache.stats.persisted = true;
  } catch { cache.stats.error = "Cache checkpoint unavailable; current analysis results remain valid."; }
  finally { removeTemporary(cache, temporary); }
}

function removeTemporary(cache: AuditCache, temporary: string): void {
  try { rmSync(temporary, { force: true }); } catch { cache.stats.error = "Cache temporary-file cleanup unavailable."; }
}

function trimProjects(folder: string, current: string): void {
  const files = readdirSync(folder).filter((p) => /^[0-9a-f]{64}\.json$/.test(p)).map((p) => join(folder, p))
    .filter((p) => p !== current).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  for (const file of files.slice(MAX_PROJECTS - 1)) rmSync(file);
}

function safePath(path: string): boolean {
  return !absolutePath(path) && !path.includes("\\") && !path.includes("\0") && posix.normalize(path) === path
    && path !== ".." && !path.startsWith("../");
}

function entryBytes(entry: Entry): number { return Buffer.byteLength(JSON.stringify(entry)) + 1; }

function validEntry(entry: unknown): entry is Entry {
  if (entry === null || typeof entry !== "object") return false;
  const e = entry as Entry;
  return typeof e.path === "string" && safePath(e.path) && typeof e.hash === "string" && /^[0-9a-f]{64}$/.test(e.hash)
    && e.inputs !== null && typeof e.inputs === "object" && !Array.isArray(e.inputs)
    && Object.entries(e.inputs).every(([p, hash]) => safePath(p) && (hash === null || typeof hash === "string" && /^[0-9a-f]{64}$/.test(hash)))
    && e.result !== null && typeof e.result === "object" && Array.isArray(e.result.findings) && Array.isArray(e.result.errors)
    && e.result.findings.every((f) => f !== null && f.path === e.path && typeof f.rule === "string" && typeof f.check === "string"
      && Number.isInteger(f.line) && typeof f.symbol === "string" && typeof f.message === "string" && typeof f.fix === "string"
      && ["deny", "ask", "warn"].includes(f.severity) && ["shadow", "enforce", "advisor"].includes(f.enforcement))
    && e.result.errors.every((f) => f !== null && f.path === e.path && typeof f.cause === "string" && (f.line === null || Number.isInteger(f.line)));
}
