import { beforeAll, expect, test } from "bun:test";
import { BUILTIN } from "../src/assets.ts";
import { compile } from "../src/compile.ts";
import { analyze, placement } from "../src/evaluate.ts";
import { clock, grammars, VERSIONS } from "../src/gate.ts";
import { markerLocations } from "../src/markers.ts";
import { introduced } from "../src/ratchet.ts";
import { errorIn, parse } from "../src/ts.ts";
import type { Analysis, Lock } from "../src/types.ts";

let lock: Lock;
beforeAll(async () => {
  await grammars();
  const out = compile(JSON.stringify({ name: "core-marker-controls", version: "1.0.0", engine: VERSIONS.engine,
    sources: [{ ns: "core", kind: "builtin", version: VERSIONS.core }], methodologies: [],
    scope: { include: ["**"], exclude: ["vendor/**"] }, generatedMarkers: ["@generated", "DO NOT EDIT"] }), () => BUILTIN, VERSIONS);
  if ("errors" in out) throw new Error(out.errors.join("\n"));
  lock = out.lock;
});

function state(path: string, text: string): Analysis {
  const out = analyze(lock, "pre", path, text, { read: () => null, now: clock });
  if ("cause" in out) throw new Error(out.cause);
  return out;
}

test.each([
  ["example.ts", 'const example = "eslint-disable @ts-ignore @generated DO NOT EDIT";'],
  ["example.tsx", "export function Example() { return <pre>eslint-disable @generated</pre>; }"],
  ["example.py", 'example = "eslint-disable @generated"'],
  ["example.go", 'package example\nvar example = "eslint-disable @generated"'],
  ["example.rs", 'fn example() { let _ = "eslint-disable @generated"; }'],
  ["settings.json", '{"example":"eslint-disable @generated DO NOT EDIT"}'],
  ["README.md", 'Describe eslint-disable and @generated.\n`<!-- @generated -->`\n```ts\n// @generated\n// eslint-disable\n```\n    <!-- @generated -->'],
  ["README", "Documentation about eslint-disable and @generated."],
])("core guards ignore non-comment examples in %s", (path, text) => {
  expect(Object.values(state(path, text).counts)).toEqual([0, 0]);
  expect(placement(lock, "pre", path, false, text)).toEqual([]);
});

test.each([
  ["example.ts", "// eslint-disable-next-line\nconst valid = 1;", 1],
  ["example.tsx", "export function Example() { return <pre>{/* @ts-ignore */}</pre>; }", 1],
  ["example.py", "# eslint-disable\nvalue = 1", 1],
  ["example.go", "package example\n/* eslint-disable */\nvar value = 1", 2],
  ["example.rs", "/* eslint-disable */\nfn example() {}", 1],
])("actual comment suppression remains deny in %s", (path, text, line) => {
  const findings = introduced(lock, path, null, state(path, text));
  expect(findings).toMatchObject([{ rule: "core/EVA-SUP-001", severity: "deny", line, measured: 1, limit: 0 }]);
});

test.each([
  ["example.ts", "/* @generated */\nexport const value = 1;", 1],
  ["example.py", "# @generated\nvalue = 1", 1],
  ["example.go", "package example\n// @generated\nvar value = 1", 2],
  ["example.rs", "// @generated\nfn example() {}", 1],
  ["README.md", "# Reference\n<!-- @generated -->\nPublished text.", 2],
])("a genuine generated comment counts and freezes %s", (path, text, line) => {
  expect(introduced(lock, path, null, state(path, text))).toMatchObject([{ rule: "core/EVA-GEN-001", severity: "deny", line, measured: 1 }]);
  expect(placement(lock, "pre", path, false, text)).toMatchObject([{ rule: "core/EVA-GEN-002", severity: "deny" }]);
});

test("retained inline comment sites ignore changed surrounding code and locate the added directive", () => {
  const path = "example.ts", before = "const value = 1; // eslint-disable-next-line retained";
  const after = "const value = 2; // eslint-disable-next-line retained\n// eslint-disable-next-line added";
  expect(introduced(lock, path, state(path, before), state(path, after))).toMatchObject([{ rule: "core/EVA-SUP-001", line: 2, measured: 2, limit: 1 }]);
});

test("unsupported executable source remains conservative, and invalid supported syntax does not hide markers", () => {
  const text = 'const broken = "@generated"; function {';
  inspectedTree(parse("example.ts", text), parsed => {
    expect(errorIn(parsed, null)).not.toBeNull();
    expect(markerLocations("example.ts", text, ["@generated"], parsed)).toHaveLength(1);
  });
  expect(introduced(lock, "example.swift", null, state("example.swift", 'let example = "eslint-disable @generated";'))).toHaveLength(2);
  expect(placement(lock, "pre", "example.swift", false, '// @generated\nfunc example() {}')).toMatchObject([{ rule: "core/EVA-GEN-002" }]);
});

function inspectedTree(parsed: ReturnType<typeof parse>, inspect: (parsed: ReturnType<typeof parse>) => void) {
  try { inspect(parsed); } finally { parsed.root.tree.delete(); }
}

test("excluded existing files and new excluded files remain guarded without marker exceptions", () => {
  expect(placement(lock, "pre", "vendor/existing.ts", false, 'const sample = "@generated";')).toMatchObject([{ rule: "core/EVA-GEN-002" }]);
  expect(placement(lock, "pre", "vendor/new.ts", true, null)).toMatchObject([{ rule: "core/EVA-SCOPE-001" }]);
});

test("Markdown code examples are skipped but a later real generated comment remains visible", () => {
  const text = '~~~ts\n<!-- @generated -->\n~~~\n``<!-- @generated -->``\n    <!-- @generated -->\n<!-- @generated -->';
  expect(markerLocations("README.md", text, ["@generated"], null, ["@generated"])).toEqual([{ line: 6, key: "@generated\0<!-- @generated -->" }]);
  expect(markerLocations("README.md", "<!-- eslint-disable -->", ["eslint-disable"], null, ["@generated"])).toEqual([]);
});
