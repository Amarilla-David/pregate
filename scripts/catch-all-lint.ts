// A catch-all handles every error and does not rethrow. That is allowed only when the same
// catch says why the fallback is fail-closed (`fail-closed:`). CI rejects a new one in src/.
import { Lang, parse, type SgNode } from "@ast-grep/napi";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = join(import.meta.dir, "..");
const BASELINE = join(import.meta.dir, "catch-all-baseline.txt");
const MARKER = /fail-closed\s*:/i;
const NESTED = new Set([
  "function_declaration", "function_expression", "arrow_function", "generator_function",
  "generator_function_declaration", "method_definition", "class_declaration", "class",
]);

export interface CatchHit { file: string; text: string }

export function unannotatedCatchAlls(file: string, source: string): CatchHit[] {
  const root = parse(Lang.TypeScript, source).root();
  return root.findAll({ rule: { kind: "catch_clause" } }).flatMap((clause) => {
    if (rethrows(clause) || MARKER.test(region(source, clause))) return [];
    return [{ file, text: clause.text().replace(/\s+/g, " ").trim() }];
  });
}

export function catchAllIdentities(root = ROOT): string[] {
  return sourceFiles(join(root, "src")).flatMap((file) => {
    const rel = relative(root, file).split(sep).join("/");
    return unannotatedCatchAlls(rel, readFileSync(file, "utf8")).map((hit) => `${hit.file}\t${hit.text}`);
  }).sort();
}

function rethrows(clause: SgNode): boolean {
  const start = clause.range().start.index;
  return clause.findAll({ rule: { kind: "throw_statement" } }).some((thrown) =>
    !thrown.ancestors().some((parent) => parent.range().start.index > start && NESTED.has(String(parent.kind()))));
}

function region(source: string, clause: SgNode): string {
  const start = clause.range().start.index;
  const end = clause.range().end.index;
  let from = source.lastIndexOf("\n", start - 1) + 1;
  const prevBreak = source.lastIndexOf("\n", from - 2);
  const previous = source.slice(prevBreak + 1, from);
  if (/fail-closed\s*:/.test(previous)) from = prevBreak + 1;
  const lineEnd = source.indexOf("\n", end);
  return source.slice(from, lineEnd < 0 ? source.length : lineEnd);
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts") ? [path] : [];
  });
}

function baselineLines(): string[] {
  return readFileSync(BASELINE, "utf8").split("\n").filter((line) => line !== "");
}

if (import.meta.main) {
  const found = catchAllIdentities();
  if (process.argv.includes("--write")) {
    writeFileSync(BASELINE, found.length === 0 ? "" : `${found.join("\n")}\n`);
  } else {
    const expected = baselineLines();
    const extra = found.filter((line) => expected.filter((item) => item === line).length < found.filter((item) => item === line).length);
    const gone = expected.filter((line) => found.filter((item) => item === line).length < expected.filter((item) => item === line).length);
    if (found.join("\n") !== expected.join("\n")) {
      console.error("Unannotated catch-alls in src/ do not match scripts/catch-all-baseline.txt.");
      for (const line of [...new Set(extra)]) console.error(`+ ${line}`);
      for (const line of [...new Set(gone)]) console.error(`- ${line}`);
      console.error("Narrow the catch to the expected error and rethrow the rest, or add a fail-closed: comment. Then run bun scripts/catch-all-lint.ts --write.");
      process.exit(1);
    }
  }
}
