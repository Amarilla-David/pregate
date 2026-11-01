import { expect, test } from "bun:test";
import { compile, packCatalog } from "../src/compile.ts";
import { BUILTIN } from "../src/assets.ts";
import { addInvariant, selectMethodology, removeSelection } from "../src/pack-compose.ts";
import { packTemplate } from "../src/pack-template.ts";
import { VERSIONS } from "../src/versions.ts";
import type { Manifest, Preset } from "../src/types.ts";

const files = packTemplate("acme");
const catalog = packCatalog(files);
if ("errors" in catalog) throw new Error(catalog.errors.join("\n"));
const team = catalog.methodologies[0]!;
const other: Manifest = { ...team, id: "acme/other", invariants: [{ ...team.invariants[0]!, id: "OTHER-001" }] };
const preset: Preset = { name: "compose", version: "1.0.0", engine: VERSIONS.engine,
  sources: [{ ns: "core", kind: "builtin", version: VERSIONS.core }, { ns: "acme", kind: "path", path: "rules" }],
  methodologies: [team.id, other.id], overrides: {
    "acme/TEAM-PARAMS-001": { params: { max: 3 }, enforcement: "shadow", note: "Team policy" },
    "acme/complexity/fn-max-params": { params: { max: 3 } }, "OTHER-001": { severity: "warn", note: "Other policy" },
  }, resolve: { "fn.params": { use: "acme/TEAM-PARAMS-001", note: "Team wins" } },
  coexist: { arkgate: { ownedByArkgate: ["acme/TEAM-PARAMS-001", "OTHER-001"] } } };

test("removing a methodology cleans its references while preserving shared and unrelated policies", () => {
  const before = JSON.stringify(preset);
  const next = removeSelection(preset, [team, other], team.id);
  if ("errors" in next) throw new Error(next.errors.join("\n"));
  expect(JSON.stringify(preset)).toBe(before);
  expect(next.methodologies).toEqual([other.id]);
  expect(next.overrides).toEqual({ "acme/complexity/fn-max-params": { params: { max: 3 } }, "OTHER-001": { severity: "warn", note: "Other policy" } });
  expect(next.resolve).toEqual({});
  expect(next.coexist?.arkgate?.ownedByArkgate).toEqual(["OTHER-001"]);
  const composedFiles = { ...files, "methodologies/other.json": JSON.stringify(other) };
  expect(compile(JSON.stringify(next), (s) => s.ns === "core" ? BUILTIN : composedFiles, VERSIONS)).toHaveProperty("lock");
  const removed = removeSelection(next, [team, other], "acme", true);
  if ("errors" in removed) throw new Error(removed.errors.join("\n"));
  expect(removed.sources.map((s) => s.ns)).toEqual(["core"]);
  expect(removed.overrides).toEqual({});
  expect(removed.coexist?.arkgate?.ownedByArkgate).toEqual([]);
});

test("selecting one invariant restores it through a check-wide off policy and preserves its parameter overrides", () => {
  const input = { ...preset, overrides: { "acme/complexity/fn-max-params": "off" as const,
    "acme/TEAM-PARAMS-001": { severity: "off" as const, params: { max: 3 }, enforcement: "shadow" as const } } };
  const selected = selectMethodology(input, team, ["TEAM-PARAMS-001"]);
  if ("errors" in selected) throw new Error(selected.errors.join("\n"));
  expect(selected.overrides?.["acme/TEAM-PARAMS-001"]).toEqual({ severity: "deny", params: { max: 3 }, enforcement: "shadow" });
  expect(selected.overrides?.["acme/complexity/fn-max-params"]).toBe("off");
  expect(selectMethodology(input, team, [])).toHaveProperty("errors");
});

test("core methodologies disable through explicit rule overrides and can be restored selectively", () => {
  const manifest: Manifest = JSON.parse(BUILTIN["methodologies/software-invariants.json"]!);
  const original = { ...preset, methodologies: [] };
  const disabled = removeSelection(original, [manifest], manifest.id);
  if ("errors" in disabled) throw new Error(disabled.errors.join("\n"));
  expect(disabled.overrides?.["core/CORE-INV-001"]).toBe("off");
  expect(disabled.overrides?.["core/CORE-INV-048"]).toBe("off");
  const selected = selectMethodology(disabled, manifest, ["CORE-INV-001"]);
  if ("errors" in selected) throw new Error(selected.errors.join("\n"));
  expect(selected.overrides?.["core/CORE-INV-001"]).toBeUndefined();
  expect(selected.overrides?.["core/CORE-INV-048"]).toBe("off");
  expect(removeSelection(original, [manifest], "core", true)).toHaveProperty("errors");
});

test("adding one invariant selects only it from a new methodology and only switches it back on in a selected one", () => {
  const wide: Manifest = { ...team, invariants: [team.invariants[0]!, { ...team.invariants[0]!, id: "TEAM-WIDE-002" }] };
  const fresh = addInvariant({ ...preset, methodologies: [], overrides: {} }, wide, "TEAM-WIDE-002");
  if ("errors" in fresh) throw new Error(fresh.errors.join("\n"));
  expect(fresh.methodologies).toEqual([team.id]);
  expect(fresh.overrides).toEqual({ "acme/TEAM-PARAMS-001": "off" });
  const input = { ...preset, overrides: { "acme/TEAM-WIDE-002": "off" as const, "acme/TEAM-PARAMS-001": { severity: "off" as const, note: "Kept off" },
    "OTHER-001": { severity: "warn" as const, note: "Other policy" } } };
  const added = addInvariant(input, wide, "TEAM-WIDE-002");
  if ("errors" in added) throw new Error(added.errors.join("\n"));
  expect(added.overrides).toEqual({ "acme/TEAM-PARAMS-001": { severity: "off", note: "Kept off" }, "OTHER-001": { severity: "warn", note: "Other policy" } });
  const restored = addInvariant(input, wide, "TEAM-PARAMS-001");
  if ("errors" in restored) throw new Error(restored.errors.join("\n"));
  expect(restored.overrides?.["acme/TEAM-PARAMS-001"]).toEqual({ note: "Kept off" });
  expect(restored.overrides?.["acme/TEAM-WIDE-002"]).toBe("off");
  expect(addInvariant(input, wide, "MISSING-001")).toHaveProperty("errors");
});
