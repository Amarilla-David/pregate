import type { Edit, Hunk, Reconstruction } from "./types.ts";

type Applied = { after: string | null; status: Reconstruction };
const UNKNOWN: Applied = { after: null, status: "unknown" };
const FAILS: Applied = { after: null, status: "tool-will-fail" };
const exact = (text: string): Applied => ({ after: normalize(text), status: "exact" });

// §4.4: a BOM and CRLF line endings are dropped before matching, as Claude Code does when it reads
// the file. Line numbers do not change, so positions need no mapping back. Every face (Pre, Stop,
// check) normalizes the text it parses, so `window` offsets and parse offsets agree.
export function normalize(text: string): string {
  return (text.startsWith("﻿") ? text.slice(1) : text).replaceAll("\r\n", "\n");
}

// The text the tool will leave, normalized. `after: null` with "exact" is a file that will not exist.
export function apply(current: string | null, edit: Edit): Applied {
  switch (edit.form) {
    case "full": return exact(edit.content);
    case "append": return exact((current ?? "") + edit.text);
    case "delete": return { after: null, status: "exact" };
    case "oldnew": return oldnew(current, edit);
    case "hunks": {
      if (current === null) return FAILS;
      const after = patch(current, edit.hunks);
      return after === null ? UNKNOWN : exact(after);
    }
    case "unknown": return UNKNOWN;
  }
}

type OldNew = Extract<Edit, { form: "oldnew" }>;

// Claude Code's Edit (and Grok's search_replace): `old` must occur exactly, and only once unless
// `all`. split/join keeps `$` in `neu` literal (String.replace would expand `$&`) and counts
// occurrences the way Claude Code does.
function oldnew(current: string | null, e: OldNew): Applied {
  // MH-13: an empty old creates a missing file. Over an existing one the outcome is unverified (O11).
  if (e.old === "") return current === null && e.lines === null ? exact(e.neu) : UNKNOWN;
  if (e.lines !== null) {
    // agy's replace_file_content (MH-11). That agy searches only inside the range is not verified,
    // so the result must not depend on it; and agy may match fuzzily, so a miss is not a failure.
    if (current === null) return UNKNOWN;
    const text = normalize(current);
    const range = span(text, e.lines);
    const after = range === null ? null : replace(text, e, range);
    return after !== null && after === replace(text, e, null) ? exact(after) : UNKNOWN;
  }
  if (current === null) return FAILS;
  const after = replace(normalize(current), e, null);
  return after === null ? FAILS : exact(after);
}

function replace(text: string, e: OldNew, range: [number, number] | null): string | null {
  const [from, to] = range ?? [0, text.length];
  const parts = text.slice(from, to).split(e.old);
  if (parts.length < 2 || (parts.length > 2 && !e.all)) return null;
  return text.slice(0, from) + parts.join(e.neu) + text.slice(to);
}

// Offsets of lines first..last (1-based, inclusive, with the last one's newline). A range past the
// end is cut there, which is safe because the result must also match the whole-file one.
function span(text: string, [first, last]: [number, number]): [number, number] | null {
  if (!Number.isInteger(first) || !Number.isInteger(last) || first < 1 || last < first) return null;
  const lines = text.split("\n");
  if (lines.at(-1) === "") lines.pop();
  if (first > lines.length) return null;
  const width = (ls: string[]) => ls.reduce((n, l) => n + l.length + 1, 0);
  const from = width(lines.slice(0, first - 1));
  return [from, Math.min(text.length, from + width(lines.slice(first - 1, last)))];
}

// Codex's apply_patch Update (MH-08), limited to its exact pass. Codex tries an exact match first
// and only then fuzzier ones, so an exact match here is the one Codex takes; without one the
// result is unknown. Codex matches raw lines, so a CRLF line never matches exactly. It drops one
// trailing empty line before matching and always ends the file with "\n".
function patch(current: string, hunks: Hunk[]): string | null {
  const lines = current.split("\n");
  if (lines.at(-1) === "") lines.pop();
  let out: string[] = [];   // concat, not push(...): spreading a long file overflows the argument limit
  let at = 0;
  for (const h of hunks) {
    // Codex puts a pure insertion at the end of the file whatever its anchor: not a contract to rely on.
    if (h.old.length === 0) return null;
    let from = at;
    if (h.anchor !== null) {
      const a = seek(lines, [h.anchor], at);
      if (a < 0) return null;
      from = a + 1;
    }
    // Codex looks for an end-of-file hunk only at the end, even before where the search would start.
    const end = lines.length - h.old.length;
    const i = h.eof ? (end >= 0 && equal(lines, end, h.old) ? end : -1) : seek(lines, h.old, from);
    if (i < from) return null;
    out = out.concat(lines.slice(at, i), h.neu);
    at = i + h.old.length;
  }
  out = out.concat(lines.slice(at));
  if (out.at(-1) !== "") out.push("");
  return out.join("\n");
}

function seek(lines: string[], pattern: string[], from: number): number {
  for (let i = from; i + pattern.length <= lines.length; i++) if (equal(lines, i, pattern)) return i;
  return -1;
}

function equal(lines: string[], at: number, pattern: string[]): boolean {
  return pattern.every((l, k) => lines[at + k] === l);
}

// The changed range of `after` (UTF-16 offsets, end exclusive) by common prefix and suffix with
// `base`. null: nothing changed. A new file (no base) is changed as a whole. A pure deletion is an
// empty range at the deletion point. `after` must already be normalized: it is the parsed text.
export function window(base: string | null, after: string): [number, number] | null {
  if (base === null) return [0, after.length];
  const before = normalize(base);
  if (before === after) return null;
  const shortest = Math.min(before.length, after.length);
  let start = 0;
  while (start < shortest && before[start] === after[start]) start++;
  let end = 0;
  while (end < shortest - start && before[before.length - 1 - end] === after[after.length - 1 - end]) end++;
  return [start, after.length - end];
}
