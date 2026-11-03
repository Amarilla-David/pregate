import { existsSync } from "node:fs";
import { delimiter, join, resolve } from "node:path";
import { relativePath as relative } from "./paths.ts";
import type { Cause, Files } from "./types.ts";

const GIT_TIMEOUT_MS = 5000;

// The three ways a Git read can fail closed. A later successful command does not clear this:
// `listed === null || fresh === null` must still name the command that failed.
export type GitFailure = Extract<Cause, "git-missing" | "git-not-repository" | "git-error">;
let lastFailure: GitFailure = "git-error";

export function gitFailure(): GitFailure {
  return lastFailure;
}

// null when this directory is a Git worktree. Otherwise the failure that should deny the edit.
export function repositoryFailure(root: string): GitFailure | null {
  const inside = git(root, ["rev-parse", "--is-inside-work-tree"]);
  return inside?.trim() === "true" ? null : gitFailure();
}

// Bun.which can keep the PATH from process start. The hook's PATH is the one that matters.
function gitOnPath(): boolean {
  const path = process.env.PATH ?? process.env.Path ?? "";
  const names = process.platform === "win32" ? ["git.exe", "git.cmd", "git.bat", "git.com", "git"] : ["git"];
  for (const dir of path.split(delimiter)) {
    if (dir === "") continue;
    for (const name of names) if (existsSync(join(dir, name))) return true;
  }
  return false;
}

function classify(stderr: Uint8Array, missing: boolean): GitFailure {
  if (missing) return gitOnPath() ? "git-error" : "git-missing";
  const text = new TextDecoder().decode(stderr);
  return /not a git repository/i.test(text) ? "git-not-repository" : "git-error";
}

// The environment is inherited on purpose: inside a pre-commit hook git sets GIT_INDEX_FILE to the
// index being committed. Git must never wait for a credential prompt or take optional locks that
// would race the user's own git commands.
function spawn(root: string, args: string[], stdin: Uint8Array | "ignore"): Uint8Array | null {
  try {
    const r = Bun.spawnSync(["git", ...args], {
      cwd: root, stdin, stdout: "pipe", stderr: "pipe",
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_OPTIONAL_LOCKS: "0" },
      timeout: GIT_TIMEOUT_MS, killSignal: "SIGKILL",
    });
    // A deadline is not evidence of a missing repository or object. Do not let callers fall
    // back to a different inventory, base revision or consent identity after a timed-out read.
    if (r.exitedDueToTimeout) throw new Error(`Git exceeded its ${GIT_TIMEOUT_MS} ms command deadline.`);
    if (r.exitCode === 0) return r.stdout;
    lastFailure = classify(r.stderr, false);
    return null;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") {
      lastFailure = classify(new Uint8Array(), true);   // no git binary, or no root
      return null;
    }
    throw e;
  }
}

// stdout of a successful run; null when git fails (not a repository, bad revision…).
// An exceeded deadline throws, so partial stdout never becomes usable evidence.
export function git(root: string, args: string[]): string | null {
  const out = spawn(root, args, "ignore");
  return out === null ? null : new TextDecoder().decode(out);
}

// The same with `input` on stdin, for commands that read their revisions there (`--stdin`).
export function gitInput(root: string, args: string[], input: string): string | null {
  const out = spawn(root, args, new TextEncoder().encode(input));
  return out === null ? null : new TextDecoder().decode(out);
}

// One spawn for every object (A24): each result is the blob's text, or null when the object is
// missing or is not a blob. null overall when git fails. Object names are revisions such as
// `<sha>:./<rel>` (relative to `root`) or a blob sha.
export function catFileBatch(root: string, objs: string[]): (string | null)[] | null {
  return catFileBytesBatch(root, objs)?.map((bytes) => bytes === null ? null : new TextDecoder().decode(bytes)) ?? null;
}

// The `paths` (relative to `root`) that the index still holds in conflict stages after a merge,
// rebase or cherry-pick; [] when git fails.
export function unmerged(root: string, paths: string[]): string[] {
  const listed = git(root, ["ls-files", "--unmerged", "-z", "--", ...paths]) ?? "";
  return paths.filter((path) => listed.split("\0").some((line) => line.endsWith(`\t${path}`)));
}

// Fitness verification fingerprints exact index bytes, including binary verifier inputs.
export function catFileBytesBatch(root: string, objs: string[]): (Uint8Array | null)[] | null {
  if (objs.some((o) => o.includes("\n"))) return null;   // would desynchronize the batch protocol
  const out = spawn(root, ["cat-file", "--batch"], new TextEncoder().encode(objs.map((o) => `${o}\n`).join("")));
  return out === null ? null : batchBytes(out, objs.length);
}

// The `count` answers of `cat-file --batch`: a header `<sha> <type> <size>` and the object's
// bytes, or a single line for an object that is missing or ambiguous.
function batchBytes(out: Uint8Array, count: number): (Uint8Array | null)[] {
  const decoder = new TextDecoder();
  const texts: (Uint8Array | null)[] = [];
  let i = 0;
  while (texts.length < count) {
    const eol = out.indexOf(10, i);
    const header = /^[0-9a-f]+ (\w+) (\d+)$/.exec(decoder.decode(out.subarray(i, eol)));
    i = eol + 1;
    if (header === null) {
      texts.push(null);   // "<obj> missing" or "<obj> ambiguous"
      continue;
    }
    const size = Number(header[2]);
    texts.push(header[1] === "blob" ? out.subarray(i, i + size) : null);
    i += size + 1;
  }
  return texts;
}

// The staged rule sources under `dir` (relative to `root`), keyed relative to `dir`, with the same
// selection as disk.readTree(dir, false): JSON only, no fixtures. Pre-commit compiles from these,
// so a git failure or a staged symlink throws and the commit fails.
export function indexFiles(root: string, dir: string): Files {
  const listing = git(root, ["ls-files", "--stage", "-z", "--", dir]);
  if (listing === null) throw new Error(`git ls-files failed in ${root}`);
  const base = relative(root, resolve(root, dir));   // ls-files names paths relative to root
  const entries = sourceEntries(listing, base === "" ? "" : `${base}/`);
  const texts = catFileBatch(root, entries.map((e) => e.sha));
  if (texts === null || texts.includes(null)) throw new Error(`git cat-file failed in ${root}`);
  return Object.fromEntries(entries.map((e, k) => [e.rel, texts[k]!]));
}

// The files of a path pack folder (`dir`, relative to root) that the lock compiles from (JSON outside
// fixtures/, as indexFiles reads them) and that HEAD does not hold: untracked, ignored, modified or
// only staged. Anything else there, such as an ignored .DS_Store, cannot make the lock stale.
export function uncommittedPackFiles(root: string, dir: string): string[] {
  const listed = git(root, ["status", "--porcelain", "-z", "--untracked-files=all", "--ignored", "--", dir]);
  if (listed === null) return [];
  const prefix = git(root, ["rev-parse", "--show-prefix"])?.trim() ?? "";
  const entries = listed.split("\0"), paths: string[] = [];
  for (let i = 0; i < entries.length; i++) {
    if (entries[i]!.length < 4) continue;
    paths.push(entries[i]!.slice(3));
    if (/^[RC]/.test(entries[i]!)) i++;   // a rename names its source in the next entry
  }
  const base = [".", ""].includes(dir) ? prefix : `${prefix}${dir.replace(/\/+$/, "")}/`;
  return paths.filter((path) => path.startsWith(base)).map((path) => path.slice(base.length))
    .filter((rel) => rel.endsWith(".json") && !rel.split("/").slice(0, -1).includes("fixtures"));
}

// The JSON blobs of an `ls-files --stage -z` listing below `prefix`, outside fixtures/, keyed
// relative to it. A symlink or a submodule among them throws.
function sourceEntries(listing: string, prefix: string): { rel: string; sha: string }[] {
  const entries: { rel: string; sha: string }[] = [];
  for (const line of listing.split("\0")) {
    const m = /^(\d+) ([0-9a-f]+) (\d)\t(.*)$/s.exec(line);
    if (m === null || m[3] !== "0") continue;   // the trailing "" and conflict stages
    const rel = m[4]!.slice(prefix.length);
    if (rel.split("/").slice(0, -1).includes("fixtures")) continue;
    if (m[1] !== "100644" && m[1] !== "100755") throw new Error(`${m[4]}: not a regular file in the index`);
    if (rel.endsWith(".json")) entries.push({ rel, sha: m[2]! });
  }
  return entries;
}
