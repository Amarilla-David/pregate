import { beforeAll, expect, test } from "bun:test";
import { BUILTIN } from "../src/assets.ts";
import { compile, listChecks } from "../src/compile.ts";
import { readTree } from "../src/disk.ts";
import { testCheck } from "../src/fixtures.ts";
import { clock, grammars, VERSIONS } from "../src/gate.ts";
import { factoryCases, factoryEvidence } from "../scripts/dcouplr-factory-cases.ts";
import contract from "../packs/dcouplr/FACTORY-RUNTIME-CONTRACT.json" with { type: "json" };
import inventory from "../packs/dcouplr/API-COVERAGE.json" with { type: "json" };

beforeAll(grammars);

test("factory runtime requirements activate separately and require current project evidence", () => {
  const files = readTree("packs/dcouplr", true);
  const compiled = compile(JSON.stringify({ name: "factory-runtime", version: "1.0.0", engine: VERSIONS.engine,
    sources: [{ ns: "core", kind: "builtin", version: VERSIONS.core }, { ns: "dcouplr", kind: "path", path: "packs/dcouplr" }],
    methodologies: ["dcouplr/factory-runtime"] }), source => source.kind === "builtin" ? BUILTIN : files, VERSIONS);
  if ("errors" in compiled) throw new Error(compiled.errors.join("\n"));
  const rules = compiled.lock.rules.filter(rule => rule.id.startsWith("dcouplr/"));
  expect(rules).toHaveLength(8);
  for (const rule of rules) {
    expect(rule.impl).toEqual({ kind: "primitive", primitive: "fitness", requirement: String(rule.params.verifier) });
    expect(rule.phases).toEqual(["stop", "commit", "ci"]);
  }
  const checks = listChecks(files);
  if ("errors" in checks) throw new Error(checks.errors.join("\n"));
  for (const id of checks.ids.filter(id => id.startsWith("dcouplr/factory-runtime/"))) {
    const result = testCheck(files, id, clock);
    expect(result.ok).toBe(true); expect(result.lines.filter(line => line.startsWith("ok"))).toHaveLength(5);
  }
});

test("factory conditions keep promise creators distinct from unawaited verification", () => {
  const shutdown = inventory.contracts.find(c => c.name === "IDcouplr")!.members.find(m => m.name === "shutdown")!;
  expect(shutdown.relatedSlices).toEqual([]);
  expect(shutdown.evidenceRequirements).toEqual(["dcouplr/DCP-FACTORY-RUNTIME-008"]);
  expect(contract.requirements[3]!.statement).toContain("synchronous or asynchronous lifetime");
  expect(contract.requirements[4]!.statement).toContain("by throwing");
  expect(inventory.summary.contractsWithoutRelatedSyntaxSlice).toBe(119);
});

test("factory source mappings reject missing and duplicate observations", () => {
  const names = [...new Set(contract.requirements.flatMap(rule => rule.canaries))];
  const observations = names.map(name => ({name}));
  expect(factoryEvidence(observations)).toHaveLength(8);
  expect(() => factoryEvidence(observations.slice(1))).toThrow("expected exactly one completed factory source canary");
  expect(() => factoryEvidence([...observations, observations[0]!])).toThrow("expected exactly one completed factory source canary");
  const cases = factoryCases();
  expect(cases).toHaveLength(20); expect(new Set(cases.map(c => c.name)).size).toBe(20);
  expect(cases.every(c => names.includes(c.name) && c.coverage === "runtime-only")).toBe(true);
});
