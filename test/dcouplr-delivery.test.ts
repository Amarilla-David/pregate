import { beforeAll, expect, test } from "bun:test";
import { BUILTIN } from "../src/assets.ts";
import { compile, listChecks } from "../src/compile.ts";
import { readTree } from "../src/disk.ts";
import { testCheck } from "../src/fixtures.ts";
import { clock, grammars, VERSIONS } from "../src/gate.ts";
import { deliveryCases, deliveryEvidence } from "../scripts/dcouplr-delivery-cases.ts";
import contract from "../packs/dcouplr/DELIVERY-CONTRACT.json" with { type: "json" };
import inventory from "../packs/dcouplr/API-COVERAGE.json" with { type: "json" };

beforeAll(grammars);

test("delivery requirements are optional project gates, without pre-edit semantics or executable pack code", () => {
  const files = readTree("packs/dcouplr", true);
  const compiled = compile(JSON.stringify({ name: "delivery", version: "1.0.0", engine: VERSIONS.engine,
    sources: [{ ns: "core", kind: "builtin", version: VERSIONS.core }, { ns: "dcouplr", kind: "path", path: "packs/dcouplr" }],
    methodologies: ["dcouplr/delivery"] }), source => source.kind === "builtin" ? BUILTIN : files, VERSIONS);
  if ("errors" in compiled) throw new Error(compiled.errors.join("\n"));
  const selected = compiled.lock.rules.filter(rule => rule.id.startsWith("dcouplr/"));
  expect(selected).toHaveLength(10);
  for (const rule of selected) {
    expect(rule.impl).toEqual({ kind: "primitive", primitive: "fitness", requirement: String(rule.params.verifier) });
    expect(rule.phases).toEqual(["stop", "commit", "ci"]);
    expect(rule.aliases).toContain(`dcouplr/${String(rule.params.verifier)}`);
  }
  const checks = listChecks(files);
  if ("errors" in checks) throw new Error(checks.errors.join("\n"));
  for (const check of checks.ids.filter(id => id.startsWith("dcouplr/delivery/"))) {
    const result = testCheck(files, check, clock);
    expect(result.ok).toBe(true);
    expect(result.lines.filter(line => line.startsWith("ok"))).toHaveLength(5);
  }
});

test("project requirements remain distinct from syntax associations and unchecked APIs", () => {
  const event = inventory.contracts.find(c => c.name === "IEventRaiser")!;
  expect(event.members.find(m => m.name === "raiseLocalBlocking")!.relatedSlices).toEqual([]);
  expect(event.members.find(m => m.name === "raiseLocalBlocking")!.evidenceRequirements).toEqual(["dcouplr/DCP-DELIVERY-001"]);
  expect(inventory.contracts.find(c => c.name === "IExceptionGate")!.members.find(m => m.name === "report")!.evidenceRequirements)
    .toEqual(["dcouplr/DCP-DELIVERY-009"]);
  expect(inventory.summary.contractsWithoutRelatedSyntaxSlice).toBe(119);
  expect(inventory.contracts.find(c => c.name === "ILogger")!.evidenceRequirements).toEqual([]);
});

test("source evidence rejects missing or duplicated required runtime observations", () => {
  const names = [...new Set(contract.requirements.flatMap(rule => rule.canaries))];
  const observations = names.map(name => ({ name }));
  expect(deliveryEvidence(observations)).toHaveLength(10);
  expect(() => deliveryEvidence(observations.slice(1))).toThrow("expected exactly one completed source canary");
  expect(() => deliveryEvidence([...observations, observations[0]!])).toThrow("expected exactly one completed source canary");
  const cases = deliveryCases();
  expect(cases).toHaveLength(32);
  expect(new Set(cases.map(c => c.name)).size).toBe(32);
  expect(cases.every(c => c.coverage === "runtime-only")).toBe(true);
});
