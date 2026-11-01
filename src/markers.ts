// Marker primitives use comment tokens where a source parser exists. Unsupported code retains
// conservative text matching; data strings and documentation examples do not grant exemptions.
import { grammarOf, parse, type Parsed } from "./ts.ts";
import { commentKinds } from "./languages.ts";

interface Site { line: number; key: string }
interface Token { text: string; line: number }

export function markerLocations(rel: string, text: string, markers: string[], parsed?: Parsed | null, documentMarkers: string[] = []): Site[] {
  if (!markers.some(marker => text.includes(marker))) return [];
  if (grammarOf(rel) !== null) {
    return commentSites(rel, text, markers, parsed ?? parse(rel, text), !parsed);
  }
  if (/\.(?:md|markdown)$/i.test(rel)) return sites(markdownComments(text), markers.filter(marker => documentMarkers.includes(marker)));
  if (/\.(?:json|jsonl|ndjson|txt|rst)$/i.test(rel) || /(?:^|\/)README$/i.test(rel)) return [];
  return sites([{ text, line: 1 }], markers);
}

function commentSites(rel: string, text: string, markers: string[], p: Parsed, owned: boolean): Site[] {
  try {
    // A recovered invalid tree must not hide a marker. The caller's syntax gate decides the form.
    const tokens = p.root.hasError ? [{ text, line: 1 }] : p.root.descendantsOfType(commentKinds(rel))
      .filter(node => node.isNamed).map(node => ({ text: node.text, line: node.startPosition.row + 1 }));
    return sites(tokens, markers);
  } finally { if (owned) p.root.tree.delete(); }
}

function sites(tokens: Token[], markers: string[]): Site[] {
  return tokens.flatMap(token => token.text.split("\n").flatMap((text, i) => markers.flatMap(marker =>
    Array.from({ length: text.split(marker).length - 1 }, () => ({ line: token.line + i, key: `${marker}\0${text}` })))));
}

// Recognize actual Markdown HTML comments, excluding fenced, indented and matched backtick code.
// This is a bounded document lexer, not a Markdown renderer or parser for embedded source.
function markdownComments(text: string): Token[] {
  const ranges: [number, number][] = [];
  let at = 0, fence: { char: string; length: number } | null = null;
  for (const line of text.split("\n")) {
    const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    const closes = marker && fence && marker[1]![0] === fence.char && marker[1]!.length >= fence.length && /^\s*$/.test(marker[2]!);
    if (fence || marker || /^(?: {4}|\t)/.test(line)) ranges.push([at, at + line.length + 1]);
    if (closes) fence = null;
    else if (!fence && marker) fence = { char: marker[1]![0]!, length: marker[1]!.length };
    at += line.length + 1;
  }
  const runs = [...text.matchAll(/`+/g)].filter(outside(ranges));
  const next = new Map<number, number>(), following: number[] = [];
  for (let i = runs.length - 1; i >= 0; i--) {
    following[i] = next.get(runs[i]![0].length) ?? -1;
    next.set(runs[i]![0].length, i);
  }
  for (let i = 0; i < runs.length; i++) if (following[i]! >= 0) {
    const end = following[i]!;
    ranges.push([runs[i]!.index, runs[end]!.index + runs[end]![0].length]); i = end;
  }
  return [...text.matchAll(/<!--[\s\S]*?-->/g)]
    .filter(outside(ranges))
    .map(comment => ({ text: comment[0], line: text.slice(0, comment.index).split("\n").length }));
}

function outside(ranges: [number, number][]): (item: { index: number }) => boolean {
  ranges.sort((a, b) => a[0] - b[0]);
  let at = 0;
  return item => {
    while (ranges[at] && ranges[at]![1] <= item.index) at++;
    return ranges[at] === undefined || item.index < ranges[at]![0];
  };
}
