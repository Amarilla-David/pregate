import { beforeAll, expect, test } from "bun:test";
import { BUILTIN } from "../src/assets.ts";
import { compile, listChecks } from "../src/compile.ts";
import { readTree } from "../src/disk.ts";
import { testCheck } from "../src/fixtures.ts";
import { clock, grammars, VERSIONS } from "../src/gate.ts";
import { loggingCases, loggingEvidence } from "../scripts/dcouplr-logging-cases.ts";
import contract from "../packs/dcouplr/LOGGING-CONTRACT.json" with { type: "json" };
import inventory from "../packs/dcouplr/API-COVERAGE.json" with { type: "json" };

beforeAll(grammars);

test("logging requirements activate separately, with no pack commands or invented pre-edit coverage", () => {
  const files = readTree("packs/dcouplr", true);
  const compiled = compile(JSON.stringify({ name: "logging", version: "1.0.0", engine: VERSIONS.engine,
    sources: [{ ns: "core", kind: "builtin", version: VERSIONS.core }, { ns: "dcouplr", kind: "path", path: "packs/dcouplr" }],
    methodologies: ["dcouplr/logging"] }), source => source.kind === "builtin" ? BUILTIN : files, VERSIONS);
  if ("errors" in compiled) throw new Error(compiled.errors.join("\n"));
  const selected = compiled.lock.rules.filter(rule => rule.id.startsWith("dcouplr/"));
  expect(selected).toHaveLength(6);
  for (const rule of selected) {
    expect(rule.impl).toEqual({ kind: "primitive", primitive: "fitness", requirement: String(rule.params.verifier) });
    expect(rule.phases).toEqual(["stop", "commit", "ci"]);
    expect(rule.aliases).toContain(`dcouplr/${String(rule.params.verifier)}`);
  }
  const checks = listChecks(files);
  if ("errors" in checks) throw new Error(checks.errors.join("\n"));
  for (const check of checks.ids.filter(id => id.startsWith("dcouplr/logging/"))) {
    const result = testCheck(files, check, clock);
    expect(result.ok).toBe(true);
    expect(result.lines.filter(line => line.startsWith("ok"))).toHaveLength(5);
  }
});

test("logger evidence associations do not add syntax coverage or certify unrelated contracts", () => {
  const logger = inventory.contracts.find(c => c.name === "ILogger")!;
  const flush = logger.members.find(m => m.name === "flush")!;
  expect(flush.relatedSlices).toEqual([]);
  expect(flush.evidenceRequirements).toEqual(["dcouplr/DCP-LOGGING-005"]);
  expect(logger.members.find(m => m.name === "child")!.evidenceRequirements).toEqual(["dcouplr/DCP-LOGGING-001", "dcouplr/DCP-LOGGING-002"]);
  expect(inventory.summary.contractsWithoutRelatedSyntaxSlice).toBe(119);
  expect(inventory.summary.contractsWithProjectEvidenceRequirement).toBe(100);
});

test("logging evidence rejects a missing or duplicate source canary", () => {
  const names = [...new Set(contract.requirements.flatMap(rule => rule.canaries))];
  const observations = names.map(name => ({ name }));
  expect(loggingEvidence(observations)).toHaveLength(6);
  expect(() => loggingEvidence(observations.slice(1))).toThrow("expected exactly one completed logging source canary");
  expect(() => loggingEvidence([...observations, observations[0]!])).toThrow("expected exactly one completed logging source canary");
  const cases = loggingCases();
  expect(cases).toHaveLength(18);
  expect(new Set(cases.map(c => c.name)).size).toBe(18);
  expect(cases.every(c => c.coverage === "runtime-only")).toBe(true);
});
