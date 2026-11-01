import { beforeAll, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BUILTIN } from "../src/assets.ts";
import { compile } from "../src/compile.ts";
import { analyze } from "../src/evaluate.ts";
import { grammars, VERSIONS } from "../src/gate.ts";
import { librarySource } from "../src/library.ts";
import { layerOf, slash } from "../src/paths.ts";
import { parse } from "../src/ts.ts";
import type { Cause, Lock, Preset, Read } from "../src/types.ts";

const root = join(import.meta.dir, "..");
const read: Read = (rel) => {
  try { return readFileSync(join(root, rel), "utf8"); }
  catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT" || (e as NodeJS.ErrnoException).code === "EISDIR") return null;
    throw e;
  }
};
let lock: Lock;
beforeAll(async () => {
  await grammars();
  const compiled = compile(read(".pregate/preset.json")!, (source: Preset["sources"][number]) =>
    source.kind === "builtin" ? BUILTIN : source.kind === "library" ? librarySource(source.ns) : null, VERSIONS);
  if ("errors" in compiled) throw new Error(compiled.errors.join("\n"));
  // Compile every mandatory requirement. Static verification neither supplies nor fabricates its receipt.
  expect(compiled.lock.rules.filter((r) => r.impl.kind === "primitive" && r.impl.primitive === "fitness")).toHaveLength(64);
  lock = { ...compiled.lock, rules: compiled.lock.rules.filter((r) => r.aliases.some((a) => a.startsWith("architecture/FCIS-"))) };
});

function inspect(rel: string, source: Read = read) {
  return inspectedTree(parse(rel, source(rel)!), rel, source);
}

function inspectedTree(p: ReturnType<typeof parse>, rel: string, source: Read) {
  try {
    expect(p.root.hasError).toBe(false);
    const result = analyze(lock, "ci", rel, p, { read: source, now: () => 0, hash: false });
    return "cause" in result ? { cause: result.cause, rules: [] } : { cause: null, rules: result.violations.map((v) => v.rule) };
  } finally { p.root.tree.delete(); }
}

test("repository core boundary: actual runtime modules keep dependency and effect boundaries", () => {
  expect(lock.rules.map((r) => r.id).sort()).toEqual(["architecture/FCIS-DEP-001", "architecture/FCIS-IO-001", "architecture/FCIS-IO-002"]);
  const paths = [...new Bun.Glob("src/**/*.ts").scanSync({ cwd: root, onlyFiles: true })].map(slash).filter((rel) => !rel.endsWith(".d.ts"));
  expect(paths.length).toBeGreaterThan(0);
  const core = paths.filter((rel) => layerOf(lock, rel) === "core");
  expect(core).toContain("src/decide.ts");
  expect(core).toContain("src/ts.ts");
  for (const rel of paths) expect(layerOf(lock, rel), rel).not.toBeNull();
  for (const rel of core) expect(inspect(rel), rel).toEqual({ cause: null, rules: [] });
});

const controls: [string, Record<string, string>, Cause | null, string[]][] = [
  ["direct shell import", { "src/decide.ts": `import { clock } from './gate.ts';\n${read("src/decide.ts")}` }, null, ["architecture/FCIS-DEP-001"]],
  ["type-only shell import", { "src/decide.ts": `import type { clock } from './gate.ts';\n${read("src/decide.ts")}` }, null, ["architecture/FCIS-DEP-001"]],
  ["path alias to shell", {
    "src/decide.ts": `import { clock } from '@boundary-shell';\n${read("src/decide.ts")}`,
    "tsconfig.json": JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { "@boundary-shell": ["src/gate.ts"] } } }),
  }, null, ["architecture/FCIS-DEP-001"]],
  ["core re-export to shell", { "src/enforcement.ts": `${read("src/enforcement.ts")}\nexport { clock } from './gate.ts';` }, null, ["architecture/FCIS-DEP-001"]],
  ["undeclared vendored runtime", { "src/decide.ts": `require('../vendor/web-tree-sitter/web-tree-sitter.js');\n${read("src/decide.ts")}` }, null, ["architecture/FCIS-DEP-001"]],
  ["hidden ambient clock", { "src/decide.ts": `Date.now();\n${read("src/decide.ts")}` }, null, ["architecture/FCIS-IO-002"]],
  ["transitive I/O re-export", { "src/enforcement.ts": `${read("src/enforcement.ts")}\nexport { readFileSync } from 'node:fs';` }, null, ["architecture/FCIS-IO-001"]],
  ["unresolved dependency", { "src/decide.ts": `import { policy } from '@/missing-provider';\n${read("src/decide.ts")}` }, "unresolvable-import", []],
];
test.each(controls)("repository core boundary: rejects %s", (_name, changed, cause, rules) => {
  const result = inspect("src/decide.ts", (rel) => changed[rel] ?? read(rel));
  expect(result.cause).toBe(cause);
  expect(result.rules).toEqual(expect.arrayContaining(rules));
  if (cause !== null) expect(result.rules).toEqual([]);
});
