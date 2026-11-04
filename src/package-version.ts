// Whether a package.json range is entirely at or after a gate such as >=16.0.0.
// A specifier that can still install an older release, or that this parser does not
// understand, does not match: a Next 15 app must not pick up a Next 16 denial.
import type { Read, VersionGate } from "./types.ts";

export interface Semver { major: number; minor: number; patch: number }

const FIELDS = ["dependencies", "peerDependencies", "devDependencies"] as const;
const PART = "(?:0|[1-9][0-9]*|x|X|\\*)";
const VERSION = new RegExp(`^v?(${PART})(?:\\.(${PART}))?(?:\\.(${PART}))?(?:-[0-9A-Za-z.-]+)?(?:\\+[0-9A-Za-z.-]+)?$`);
const MINIMUM = /^>=(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;

interface Bound { major: number; minor: number; patch: number; exclusive: boolean }
interface Interval { lower: Bound | null; upper: Bound | null }

// The nearest manifest that names `dependency` wins. A manifest that does not name it
// does not hide a parent. An unreadable manifest is skipped; a non-string declaration
// is present but unknown, so the walk stops.
export function declaredPackageSpec(read: Read, rel: string, dependency: string): string | null {
  const segments = rel.split("/").slice(0, -1);
  for (;;) {
    const path = segments.length === 0 ? "package.json" : `${segments.join("/")}/package.json`;
    const text = read(path);
    if (text !== null) {
      const declared = specInManifest(text, dependency);
      if (declared !== undefined) return declared;
    }
    if (segments.length === 0) return null;
    segments.pop();
  }
}

export function versionGateMatches(read: Read, rel: string, gate: VersionGate): boolean {
  const spec = declaredPackageSpec(read, rel, gate.package);
  const minimum = minimumOf(gate.range);
  return spec !== null && minimum !== null && entirelyAtLeast(spec, minimum);
}

export function minimumOf(range: string): Semver | null {
  const match = MINIMUM.exec(range.trim());
  return match ? { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) } : null;
}

// True only when every version the specifier allows is at least `minimum`.
// 16.0.0-canary.1 counts as Next 16: the gate is the release line, not the final tag.
export function entirelyAtLeast(spec: string, minimum: Semver): boolean {
  const normalized = normalizeSpec(spec);
  if (normalized === null) return false;
  const alternatives = normalized.split("||").map((part) => part.trim());
  if (alternatives.some((part) => part === "")) return false;
  return alternatives.every((part) => {
    const interval = alternativeInterval(part);
    return interval !== null && lowerClears(interval, minimum);
  });
}

function specInManifest(text: string, dependency: string): string | null | undefined {
  const parsed = json(text);
  if (parsed === undefined || typeof parsed !== "object" || parsed === null) return undefined;
  const manifest = parsed as Record<string, unknown>;
  for (const field of FIELDS) {
    const table = manifest[field];
    if (typeof table !== "object" || table === null || !Object.hasOwn(table, dependency)) continue;
    const value = (table as Record<string, unknown>)[dependency];
    return typeof value === "string" ? value.trim() : null;
  }
  return undefined;
}

function json(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch (error) {
    if (error instanceof SyntaxError) return undefined;
    throw error;
  }
}

function normalizeSpec(spec: string): string | null {
  let text = spec.trim();
  if (text.startsWith("workspace:")) text = text.slice("workspace:".length).trim();
  const aliased = /^npm:[^@]+@(.+)$/.exec(text);
  if (aliased) text = aliased[1]!.trim();
  if (text === "" || text.includes(":") || text.includes("/") || /^(latest|next|canary|\*|x)$/i.test(text)) return null;
  return text;
}

function alternativeInterval(text: string): Interval | null {
  const hyphen = /^(\S+)\s+-\s+(\S+)$/.exec(text);
  if (hyphen) {
    const lower = partialBound(hyphen[1]!, "lower");
    const upper = partialBound(hyphen[2]!, "upper");
    return lower && upper ? { lower, upper } : null;
  }
  let interval: Interval = { lower: null, upper: null };
  for (const token of text.split(/\s+/)) {
    const piece = tokenInterval(token);
    if (piece === null) return null;
    const next = intersect(interval, piece);
    if (next === null) return null;
    interval = next;
  }
  return interval;
}

function tokenInterval(token: string): Interval | null {
  if (token.startsWith("^")) return caret(token.slice(1));
  if (token.startsWith("~")) return tilde(token.slice(1));
  const operator = /^(>=|<=|>|<|=)\s*(\S+)$/.exec(token);
  if (operator) return comparator(operator[1]!, operator[2]!);
  return bare(token);
}

function caret(text: string): Interval | null {
  const version = numbers(text);
  if (version === null) return null;
  const [major, minor, patch] = version;
  const upper = major > 0 ? { major: major + 1, minor: 0, patch: 0 }
    : minor > 0 ? { major: 0, minor: minor + 1, patch: 0 }
    : { major: 0, minor: 0, patch: patch + 1 };
  return { lower: { major, minor, patch, exclusive: false }, upper: { ...upper, exclusive: true } };
}

function tilde(text: string): Interval | null {
  const version = numbers(text);
  if (version === null) return null;
  const [major, minor, patch] = version;
  const parts = stripBuild(text).split(".");
  const upper = parts.length < 2 ? { major: major + 1, minor: 0, patch: 0 } : { major, minor: minor + 1, patch: 0 };
  return { lower: { major, minor, patch, exclusive: false }, upper: { ...upper, exclusive: true } };
}

function comparator(op: string, text: string): Interval | null {
  const version = numbers(text);
  if (version === null || /[xX*]/.test(stripBuild(text))) return null;
  const [major, minor, patch] = version;
  const bound = { major, minor, patch, exclusive: op === ">" || op === "<" };
  if (op === ">" || op === ">=") return { lower: bound, upper: null };
  if (op === "<" || op === "<=") return { lower: null, upper: bound };
  return { lower: { major, minor, patch, exclusive: false }, upper: { major, minor, patch, exclusive: false } };
}

function bare(text: string): Interval | null {
  if (/[xX*]/.test(text)) return xRange(text);
  const version = numbers(text);
  if (version === null) return null;
  const [major, minor, patch] = version;
  const parts = stripBuild(text).split(".");
  if (parts.length >= 3) return { lower: { major, minor, patch, exclusive: false }, upper: { major, minor, patch, exclusive: false } };
  if (parts.length === 2) return { lower: { major, minor, patch: 0, exclusive: false }, upper: { major, minor: minor + 1, patch: 0, exclusive: true } };
  return { lower: { major, minor: 0, patch: 0, exclusive: false }, upper: { major: major + 1, minor: 0, patch: 0, exclusive: true } };
}

function xRange(text: string): Interval | null {
  const parts = stripBuild(text).split(".");
  if (parts.length === 0 || parts.length > 3) return null;
  const parsed = parts.map((part) => /^[xX*]$/.test(part) ? null : /^(0|[1-9]\d*)$/.test(part) ? Number(part) : undefined);
  if (parsed.some((part) => part === undefined)) return null;
  const major = parsed[0];
  const minor = parsed[1];
  const patch = parsed[2];
  if (major == null) return null;
  if (minor == null) return { lower: { major, minor: 0, patch: 0, exclusive: false }, upper: { major: major + 1, minor: 0, patch: 0, exclusive: true } };
  if (patch == null) return { lower: { major, minor, patch: 0, exclusive: false }, upper: { major, minor: minor + 1, patch: 0, exclusive: true } };
  return { lower: { major, minor, patch, exclusive: false }, upper: { major, minor, patch, exclusive: false } };
}

function partialBound(text: string, side: "lower" | "upper"): Bound | null {
  const interval = bare(text);
  if (interval === null) return null;
  return side === "lower" ? interval.lower : interval.upper;
}

function numbers(text: string): [number, number, number] | null {
  const match = VERSION.exec(text.trim());
  if (!match || [match[1], match[2], match[3]].some((value) => value !== undefined && /[xX*]/.test(value))) return null;
  return [Number(match[1]), Number(match[2] ?? 0), Number(match[3] ?? 0)];
}

function stripBuild(text: string): string {
  return text.trim().replace(/^v/, "").replace(/\+.*$/, "");
}

function intersect(left: Interval, right: Interval): Interval | null {
  const lower = tighterLower(left.lower, right.lower);
  const upper = tighterUpper(left.upper, right.upper);
  if (lower && upper && compare(lower, upper) > 0) return null;
  if (lower && upper && compare(lower, upper) === 0 && (lower.exclusive || upper.exclusive)) return null;
  return { lower, upper };
}

function tighterLower(left: Bound | null, right: Bound | null): Bound | null {
  if (left === null) return right;
  if (right === null) return left;
  const order = compare(left, right);
  if (order > 0) return left;
  if (order < 0) return right;
  return left.exclusive ? left : right;
}

function tighterUpper(left: Bound | null, right: Bound | null): Bound | null {
  if (left === null) return right;
  if (right === null) return left;
  const order = compare(left, right);
  if (order < 0) return left;
  if (order > 0) return right;
  return left.exclusive ? left : right;
}

// An exclusive lower bound equal to the minimum still sits on that release line
// (`>16.0.0` cannot install 15). An unbounded or older lower bound does not.
function lowerClears(interval: Interval, minimum: Semver): boolean {
  if (interval.lower === null) return false;
  return compare(interval.lower, { ...minimum, exclusive: false }) >= 0;
}

function compare(left: Bound, right: Bound): number {
  return left.major - right.major || left.minor - right.minor || left.patch - right.patch;
}
