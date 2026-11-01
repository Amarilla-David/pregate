// What every adapter needs to read a payload and write a reply (MULTI-HARNESS MH-01).
import { slash } from "../paths.ts";

export type Payload = Record<string, unknown>;

export function parse(raw: string): Payload | null {
  try {
    const v: unknown = JSON.parse(raw);
    return isObject(v) ? v : null;
  } catch {
    return null;   // not JSON: the payload is unrecognized, a known cause
  }
}

export function isObject(v: unknown): v is Payload {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// A closed key set: an unknown key in an edit may change what the tool writes ("update PREGATE").
export function keys(o: Payload, required: string[], optional: string[]): boolean {
  return required.every((k) => Object.hasOwn(o, k)) && Object.keys(o).every((k) => required.includes(k) || optional.includes(k));
}

// Absolute and normalized (ARCHITECTURE §7.2 #23): a `..` in the part that does not exist yet could
// change the layer or leave the root after canonicalization.
export function absolute(path: unknown): path is string {
  if (typeof path !== "string" || path.includes("\0") || /^\\\\\.\\/.test(path) || /^\\(?!\\)/.test(path)) return false;
  // Validate segments before normalization: it must never erase traversal from a hook payload.
  const plain = path.replace(/^\\\\\?\\UNC\\/i, "//").replace(/^\\\\\?\\/, "").replaceAll("\\", "/");
  const prefix = /^(?:[a-z]:\/|\/\/[^/]+\/[^/]+\/?|\/)/i.exec(plain)?.[0];
  if (prefix === undefined || (plain.startsWith("//") && !/^\/\/[^/]+\/[^/]+/.test(plain))) return false;
  return slash(plain) !== "" && (plain === prefix || plain.slice(prefix.length).split("/").every((s) => s !== "" && s !== "." && s !== ".." && !s.includes(":")));
}

// A rejected payload still needs its directories: traversal must locate the consenting root
// and deny there, rather than disappearing as a rootless call.
export function absoluteLocation(path: unknown): path is string {
  return typeof path === "string" && (/^(?:\/|[a-z]:[\\/]|\\\\)/i.test(path));
}

export function json(o: object): string {
  return `${JSON.stringify(o)}\n`;
}
