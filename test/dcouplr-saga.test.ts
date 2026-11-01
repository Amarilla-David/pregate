import { beforeAll, expect, test } from "bun:test";
import { BUILTIN } from "../src/assets.ts";
import { compile, listChecks } from "../src/compile.ts";
import { readTree } from "../src/disk.ts";
import { testCheck } from "../src/fixtures.ts";
import { clock, grammars, VERSIONS } from "../src/gate.ts";
import { sagaCases, sagaEvidence } from "../scripts/dcouplr-saga-cases.ts";
import contract from "../packs/dcouplr/SAGA-RUNTIME-CONTRACT.json" with { type: "json" };
import inventory from "../packs/dcouplr/API-COVERAGE.json" with { type: "json" };

beforeAll(grammars);

test("saga runtime gates activate separately and retain missing or stale evidence", () => {
  const files = readTree("packs/dcouplr", true);
  const compiled = compile(JSON.stringify({ name: "saga-runtime", version: "1.0.0", engine: VERSIONS.engine,
    sources: [{ ns: "core", kind: "builtin", version: VERSIONS.core }, { ns: "dcouplr", kind: "path", path: "packs/dcouplr" }],
    methodologies: ["dcouplr/saga-runtime"] }), source => source.kind === "builtin" ? BUILTIN : files, VERSIONS);
  if ("errors" in compiled) throw new Error(compiled.errors.join("\n"));
  const selected = compiled.lock.rules.filter(rule => rule.id.startsWith("dcouplr/"));
  expect(selected).toHaveLength(8);
  for (const rule of selected) {
    expect(rule.impl).toEqual({ kind: "primitive", primitive: "fitness", requirement: String(rule.params.verifier) });
    expect(rule.phases).toEqual(["stop", "commit", "ci"]);
    expect(rule.aliases).toContain(`dcouplr/${String(rule.params.verifier)}`);
  }
  const checks = listChecks(files);
  if ("errors" in checks) throw new Error(checks.errors.join("\n"));
  for (const check of checks.ids.filter(id => id.startsWith("dcouplr/saga-runtime/"))) {
    const result = testCheck(files, check, clock);
    expect(result.ok).toBe(true); expect(result.lines.filter(line => line.startsWith("ok"))).toHaveLength(5);
  }
});

test("saga evidence describes runtime conditions rather than static lifecycle certification", () => {
  const saga = inventory.contracts.find(c => c.name === "DStructuredSaga")!;
  expect(saga.members.find(m => m.name === "start")!.relatedSlices).toEqual([]);
  expect(saga.members.find(m => m.name === "start")!.evidenceRequirements).toEqual(["dcouplr/DCP-SAGA-RUNTIME-001", "dcouplr/DCP-SAGA-RUNTIME-006"]);
  expect(saga.members.find(m => m.name === "stop")!.evidenceRequirements).toEqual(["dcouplr/DCP-SAGA-RUNTIME-008"]);
  const step = inventory.contracts.find(c => c.name === "IStructuredSagaStep")!;
  expect(step.members.find(m => m.name === "compensate")!.evidenceRequirements).toEqual(["dcouplr/DCP-SAGA-RUNTIME-004"]);
  expect(inventory.summary.contractsWithoutRelatedSyntaxSlice).toBe(119);
  expect(inventory.summary.contractsWithProjectEvidenceRequirement).toBe(100);
  expect(contract.requirements[0]!.statement).toContain("deprecated");
  expect(contract.requirements[0]!.when).toContain("must not force new adoption");
});

test("saga source proof needs exactly one completed observation for every referenced canary", () => {
  const names = [...new Set(contract.requirements.flatMap(rule => rule.canaries))];
  const observations = names.map(name => ({ name }));
  expect(sagaEvidence(observations)).toHaveLength(8);
  expect(() => sagaEvidence(observations.slice(1))).toThrow("expected exactly one completed saga source canary");
  expect(() => sagaEvidence([...observations, observations[0]!])).toThrow("expected exactly one completed saga source canary");
  const cases = sagaCases();
  expect(cases).toHaveLength(31); expect(new Set(cases.map(c => c.name)).size).toBe(31);
  expect(cases.every(c => c.coverage === "runtime-only")).toBe(true);
  expect(new Set(cases.map(c => c.name))).toEqual(new Set(names));
});
