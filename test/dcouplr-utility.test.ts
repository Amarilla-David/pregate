import { beforeAll, expect, test } from "bun:test";
import { BUILTIN } from "../src/assets.ts";
import { compile, listChecks } from "../src/compile.ts";
import { readTree } from "../src/disk.ts";
import { testCheck } from "../src/fixtures.ts";
import { clock, grammars, VERSIONS } from "../src/gate.ts";
import { utilityCases, utilityEvidence } from "../scripts/dcouplr-utility-cases.ts";
import contract from "../packs/dcouplr/UTILITY-RUNTIME-CONTRACT.json" with { type: "json" };
import inventory from "../packs/dcouplr/API-COVERAGE.json" with { type: "json" };

beforeAll(grammars);

test("utility requirements activate separately and admit only fresh reviewed evidence", () => {
  const files = readTree("packs/dcouplr", true);
  const compiled = compile(JSON.stringify({ name: "utility-runtime", version: "1.0.0", engine: VERSIONS.engine,
    sources: [{ ns: "core", kind: "builtin", version: VERSIONS.core }, { ns: "dcouplr", kind: "path", path: "packs/dcouplr" }],
    methodologies: ["dcouplr/utility-runtime"] }), source => source.kind === "builtin" ? BUILTIN : files, VERSIONS);
  if ("errors" in compiled) throw new Error(compiled.errors.join("\n"));
  const rules = compiled.lock.rules.filter(rule => rule.id.startsWith("dcouplr/"));
  expect(rules).toHaveLength(8);
  for (const rule of rules) {
    expect(rule.impl).toEqual({ kind: "primitive", primitive: "fitness", requirement: String(rule.params.verifier) });
    expect(rule.phases).toEqual(["stop", "commit", "ci"]);
  }
  const checks = listChecks(files);
  if ("errors" in checks) throw new Error(checks.errors.join("\n"));
  for (const id of checks.ids.filter(id => id.startsWith("dcouplr/utility-runtime/"))) {
    const result = testCheck(files, id, clock);
    expect(result.ok).toBe(true); expect(result.lines.filter(line => line.startsWith("ok"))).toHaveLength(5);
  }
});

test("utility conditions keep conversion and priority source evidence separate from syntax", () => {
  const priority = inventory.contracts.find(c => c.name === "IPriorityQueue")!;
  expect(priority.relatedSlices).toEqual([]);
  expect(priority.members.find(m => m.name === "enqueue")!.evidenceRequirements).toEqual(["dcouplr/DCP-UTILITY-RUNTIME-007", "dcouplr/DCP-UTILITY-RUNTIME-008"]);
  const cast = inventory.contracts.find(c => c.name === "DCast")!;
  expect(cast.relatedSlices).toEqual([]);
  expect(cast.evidenceRequirements).toContain("dcouplr/DCP-UTILITY-RUNTIME-003");
  expect(contract.requirements[6]!.statement).toContain("actual implementation");
  expect(inventory.summary.contractsWithoutRelatedSyntaxSlice).toBe(119);
});

test("utility source proof rejects missing or duplicate observations", () => {
  const names = [...new Set(contract.requirements.flatMap(rule => rule.canaries))];
  const observations = names.map(name => ({name}));
  expect(utilityEvidence(observations)).toHaveLength(8);
  expect(() => utilityEvidence(observations.slice(1))).toThrow("expected exactly one completed utility source canary");
  expect(() => utilityEvidence([...observations, observations[0]!])).toThrow("expected exactly one completed utility source canary");
  const cases = utilityCases();
  expect(cases).toHaveLength(29); expect(new Set(cases.map(c => c.name)).size).toBe(29);
  expect(new Set(cases.map(c => c.name))).toEqual(new Set(names));
  expect(cases.every(c => c.coverage === "runtime-only")).toBe(true);
});
