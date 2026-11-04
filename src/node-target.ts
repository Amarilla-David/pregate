// The lowest Node.js major a project still claims to support. A missing pin, an
// unreadable pin, or any pin we cannot interpret stays unknown: callers must not
// treat that as Node.js 26. An older pin next to a newer one keeps the older one.
import type { Read } from "./types.ts";

const NAMED = /^(lts|system|node|stable|latest|current|iojs)([/-].*)?$/i;
const VERSION = /^v?(\d+)(?:\.(\d+|x|\*|X))?(?:\.(\d+|x|\*|X))?(?:-[\w.-]+)?(?:\+[\w.-]+)?$/i;

export function declaredNodeMajor(rel: string, read: Read): number | null {
  const found: Array<number | null | undefined> = [];
  for (const dir of parents(rel)) {
    const manifest = read(join(dir, "package.json"));
    if (manifest !== null) found.push(...packagePins(manifest));
    for (const name of [".nvmrc", ".node-version"]) {
      const text = read(join(dir, name));
      if (text !== null) found.push(pinFile(text));
    }
    const tools = read(join(dir, ".tool-versions"));
    if (tools !== null) found.push(toolVersions(tools));
  }
  const pins = found.filter((major): major is number => typeof major === "number");
  if (pins.length !== found.filter((major) => major !== undefined).length || pins.length === 0) return null;
  return Math.min(...pins);
}

// npm `engines.node`. null means the range is open or not one we can read.
export function minimumMajor(range: string): number | null {
  const text = range.trim();
  if (!text || NAMED.test(text)) return null;
  let floor: number | null = null;
  for (const alternative of text.split("||")) {
    const major = alternativeFloor(alternative.trim());
    if (major === null) return null;
    floor = floor === null ? major : Math.min(floor, major);
  }
  return floor;
}

function parents(rel: string): string[] {
  const parts = rel.split("/");
  const dirs: string[] = [];
  for (let i = parts.length - 1; i >= 0; i--) dirs.push(parts.slice(0, i).join("/"));
  return dirs;
}

function join(dir: string, name: string): string {
  return dir === "" ? name : `${dir}/${name}`;
}

function packagePins(text: string): Array<number | null | undefined> {
  let doc: unknown;
  try { doc = JSON.parse(text.replace(/^\uFEFF/, "")); }
  catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    return [null];
  }
  if (!doc || typeof doc !== "object") return [null];
  const root = doc as Record<string, unknown>;
  const found: Array<number | null | undefined> = [];
  const engines = root.engines;
  if (engines && typeof engines === "object" && Object.hasOwn(engines, "node")) {
    const node = (engines as Record<string, unknown>).node;
    found.push(typeof node === "string" ? minimumMajor(node) : null);
  }
  const volta = root.volta;
  if (volta && typeof volta === "object" && Object.hasOwn(volta, "node")) {
    const node = (volta as Record<string, unknown>).node;
    found.push(typeof node === "string" ? pinMajor(node) : null);
  }
  return found;
}

function pinFile(text: string): number | null | undefined {
  const line = text.split(/\r?\n/).map((item) => item.trim()).find((item) => item !== "" && !item.startsWith("#"));
  return line === undefined ? undefined : pinMajor(line);
}

function toolVersions(text: string): number | null | undefined {
  const majors: Array<number | null> = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) continue;
    const match = /^(nodejs|node)\s+(.+)$/.exec(line);
    if (!match) continue;
    for (const token of match[2]!.split(/\s+/)) majors.push(pinMajor(token));
  }
  if (majors.length === 0) return undefined;
  if (majors.some((major) => major === null)) return null;
  return Math.min(...(majors as number[]));
}

function pinMajor(token: string): number | null {
  const text = token.trim();
  if (!text || NAMED.test(text)) return null;
  const version = VERSION.exec(text);
  return version ? Number(version[1]) : null;
}

function alternativeFloor(alternative: string): number | null {
  if (!alternative) return null;
  const hyphen = /^v?(\d+)\.\d+\.\d+\s+-\s+v?(\d+)\.\d+\.\d+$/.exec(alternative);
  if (hyphen) return Number(hyphen[1]);
  let floor = 0;
  let maxMajor = Infinity;
  for (const token of alternative.split(/\s+/)) {
    const parsed = comparator(token);
    if (parsed === null) return null;
    if (parsed.kind === "lower") floor = Math.max(floor, parsed.major);
    else maxMajor = Math.min(maxMajor, parsed.maxMajor);
  }
  return floor > maxMajor ? null : floor;
}

function comparator(token: string): { kind: "lower"; major: number } | { kind: "upper"; maxMajor: number } | null {
  const match = /^(>=|<=|>|<|=|\^|~)?v?(\d+|x|\*|X)(?:\.(\d+|x|\*|X))?(?:\.(\d+|x|\*|X))?(?:-[\w.-]+)?(?:\+[\w.-]+)?$/i.exec(token);
  if (!match) return null;
  if (/^(x|\*|X)$/.test(match[2]!)) return null;
  const major = Number(match[2]);
  const operator = match[1] ?? "=";
  if (operator === "<" || operator === "<=") {
    const minor = match[3];
    const patch = match[4];
    const minorNum = minor === undefined || /^(x|\*|X)$/i.test(minor) ? 0 : Number(minor);
    const patchNum = patch === undefined || /^(x|\*|X)$/i.test(patch) ? 0 : Number(patch);
    const excludesMajor = operator === "<" && (minor === undefined || (minorNum === 0 && (patch === undefined || patchNum === 0)));
    return { kind: "upper", maxMajor: excludesMajor ? major - 1 : major };
  }
  return { kind: "lower", major };
}
