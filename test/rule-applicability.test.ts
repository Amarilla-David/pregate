import { beforeAll, expect, test } from "bun:test";
import { BUILTIN } from "../src/assets.ts";
import { compile, fixtureLock } from "../src/compile.ts";
import { analyze } from "../src/evaluate.ts";
import { clock, grammars, VERSIONS } from "../src/gate.ts";
import { librarySource, librarySources } from "../src/library.ts";
import { composePackPlan } from "../src/pack-command.ts";
import { recommendationOverrides, recommendPacks } from "../src/scan-command.ts";
import type { Check, Lock, Preset } from "../src/types.ts";

beforeAll(grammars);

function findings(lock: Lock, path: string, source: string) {
  const out = analyze(lock, "pre", path, source, { now: clock, read: () => null });
  if ("cause" in out) throw new Error(out.cause);
  return out.violations.map(finding => finding.rule);
}

test("within intersects pack files and explicit paths instead of replacing either restriction", () => {
  const check = JSON.parse(librarySource("typescript")!["checks/types/export-parameter-typed/check.json"]!) as Check;
  const lock = fixtureLock(check, { within: ["packages/api/**"] }, undefined);
  const source = "export function save(value) { return value; }";
  expect(findings(lock, "packages/api/save.ts", source)).toHaveLength(1);
  expect(findings(lock, "packages/web/save.ts", source)).toEqual([]);
  expect(findings(lock, "packages/api/save.js", source)).toEqual([]);
  expect(() => fixtureLock(check, { paths: ["**"] }, undefined)).toThrow("already restricts paths");
  const metric: Check = { ...check, impl: { kind: "primitive", primitive: "metric", metric: "fn.params" }, params: { max: { type: "integer" } } };
  const narrow = fixtureLock(metric, { max: 0, paths: ["**/*.ts"], within: ["packages/api/**"], exclude: ["**/fixtures/**"] }, undefined);
  expect(findings(narrow, "packages/api/save.ts", source)).toHaveLength(1);
  expect(findings(narrow, "packages/api/fixtures/save.ts", source)).toEqual([]);
  expect(findings(narrow, "packages/web/save.ts", source)).toEqual([]);
});

test("scanned Next and React scopes follow owning package manifests in one batch", () => {
  const files = { "package.json": "{}", "packages/next/package.json": '{"dependencies":{"next":"16","react":"19"}}',
    "packages/solid/package.json": '{"dependencies":{"solid-js":"1"}}', "packages/react/package.json": '{"peerDependencies":{"react":"19"}}',
    "packages/next/examples/foreign/package.json": '{"dependencies":{"solid-js":"1"}}' };
  const recommendations = recommendPacks(files, ["TypeScript"]);
  const original: Preset = { name: "fixture", version: "1.0.0", engine: VERSIONS.engine,
    sources: [{ ns: "core", kind: "builtin", version: VERSIONS.core }], methodologies: [], enforcement: "enforce", scope: { include: ["**"], exclude: ["vendor/**"] } };
  const selected = recommendations.filter(item => ["nextjs", "react"].includes(item.ns));
  const candidate = composePackPlan(process.cwd(), original, { sources: selected.map(item => ({ kind: "library", ns: item.ns })),
    methodologies: selected.flatMap(item => item.methodologies), overrides: recommendationOverrides(selected) });
  if ("errors" in candidate) throw new Error(candidate.errors.join("\n"));
  expect(candidate.scope).toEqual(original.scope);
  expect(original.sources).toHaveLength(1);
  const out = compile(JSON.stringify(candidate), source => source.kind === "builtin" ? BUILTIN : librarySource(source.ns), VERSIONS);
  if ("errors" in out) throw new Error(out.errors.join("\n"));
  const img = 'export function Image() { return <img src="/photo.png" />; }';
  expect(findings(out.lock, "packages/next/app/page.tsx", img)).toContain("nextjs/NEXT-IMG-001");
  expect(findings(out.lock, "packages/solid/src/app.tsx", img)).not.toContain("nextjs/NEXT-IMG-001");
  expect(findings(out.lock, "packages/react/src/main.tsx", img)).not.toContain("nextjs/NEXT-IMG-001");
  expect(findings(out.lock, "packages/next/examples/foreign/app.tsx", img)).not.toContain("nextjs/NEXT-IMG-001");
  const hook = "function Component() { if (show) useState(0); }";
  expect(findings(out.lock, "packages/react/src/App.tsx", hook)).toContain("react/REACT-HOOK-001");
  expect(findings(out.lock, "packages/solid/src/App.tsx", hook)).not.toContain("react/REACT-HOOK-001");
  expect(candidate.sources.filter(source => source.kind === "library").map(source => source.version)).toEqual(librarySources().filter(source => ["nextjs", "react"].includes(source.ns)).map(source => source.version));
});

test("recommendation ownership preserves authored severity and path policies", () => {
  const selected = recommendPacks({ "packages/web/package.json": '{"dependencies":{"react":"19"}}' }, []);
  const preset: Preset = { name: "fixture", version: "1.0.0", engine: VERSIONS.engine, sources: [], methodologies: [],
    overrides: { "react/REACT-HOOK-001": { severity: "warn", params: { paths: ["owned/**"] } }, "react/REACT-EFFECT-001": { severity: "ask", note: "Owned decision" } } };
  const proposed = recommendationOverrides(selected, preset);
  expect(proposed["react/REACT-HOOK-001"]).toBeUndefined();
  expect(proposed["react/REACT-EFFECT-001"]).toMatchObject({ severity: "ask", note: "Owned decision", params: { within: ["packages/web/**"] } });
  expect(preset.overrides!["react/REACT-EFFECT-001"]).toEqual({ severity: "ask", note: "Owned decision" });
});

test("a root manifest that owns the whole tree adds no no-op ownership overrides; a nested foreign package still narrows", () => {
  expect(recommendationOverrides(recommendPacks({ "package.json": '{"dependencies":{"express":"4"}}', "src/app.ts": "" }, []))).toEqual({});
  const nested = recommendationOverrides(recommendPacks({ "package.json": '{"dependencies":{"express":"4"}}', "packages/other/package.json": "{}" }, []));
  expect(Object.values(nested).length).toBeGreaterThan(0);
  expect(Object.values(nested).every(o => typeof o === "object" && (o.params?.exclude as string[]).includes("packages/other/**"))).toBe(true);
});

test("ambiguous nested framework owners require a scope review instead of silent omission", () => {
  const selected = recommendPacks({ "package.json": '{"dependencies":{"react":"19"}}', "packages/foreign/package.json": "{}",
    "packages/foreign/embedded/package.json": '{"dependencies":{"react":"19"}}' }, []);
  expect(selected[0]!.scopeProblems).toHaveLength(1);
  expect(() => recommendationOverrides(selected)).toThrow("No automatic scope applied");
});
