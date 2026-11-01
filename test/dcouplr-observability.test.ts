import { beforeAll, expect, test } from "bun:test";
import { BUILTIN } from "../src/assets.ts";
import { compile, listChecks } from "../src/compile.ts";
import { readTree } from "../src/disk.ts";
import { testCheck } from "../src/fixtures.ts";
import { clock, grammars, VERSIONS } from "../src/gate.ts";
import { observabilityCases, observabilityEvidence } from "../scripts/dcouplr-observability-cases.ts";
import contract from "../packs/dcouplr/OBSERVABILITY-CONTRACT.json" with { type: "json" };
import inventory from "../packs/dcouplr/API-COVERAGE.json" with { type: "json" };

beforeAll(grammars);

test("observability activates independently and denies missing, failed or stale evidence", () => {
  const files = readTree("packs/dcouplr", true);
  const compiled = compile(JSON.stringify({ name: "observability", version: "1.0.0", engine: VERSIONS.engine,
    sources: [{ ns: "core", kind: "builtin", version: VERSIONS.core }, { ns: "dcouplr", kind: "path", path: "packs/dcouplr" }],
    methodologies: ["dcouplr/observability"] }), source => source.kind === "builtin" ? BUILTIN : files, VERSIONS);
  if ("errors" in compiled) throw new Error(compiled.errors.join("\n"));
  const rules = compiled.lock.rules.filter(rule => rule.id.startsWith("dcouplr/"));
  expect(rules).toHaveLength(8);
  for (const rule of rules) {
    expect(rule.impl).toEqual({ kind: "primitive", primitive: "fitness", requirement: String(rule.params.verifier) });
    expect(rule.phases).toEqual(["stop", "commit", "ci"]);
  }
  const checks = listChecks(files);
  if ("errors" in checks) throw new Error(checks.errors.join("\n"));
  for (const id of checks.ids.filter(id => id.startsWith("dcouplr/observability/"))) {
    const result = testCheck(files, id, clock);
    expect(result.ok).toBe(true); expect(result.lines.filter(line => line.startsWith("ok"))).toHaveLength(5);
  }
});

test("graph and inspector associations do not claim syntax certification", () => {
  const monitor = inventory.contracts.find(c => c.name === "IDcouplrMonitor")!;
  expect(monitor.relatedSlices).toEqual([]);
  expect(monitor.members.find(m => m.name === "requestGraph")!.evidenceRequirements).toEqual([
    "dcouplr/DCP-OBSERVABILITY-002", "dcouplr/DCP-OBSERVABILITY-003"]);
  expect(contract.requirements[4]!.statement).toContain("independently of CORS");
  expect(contract.requirements[7]!.statement).toContain("must not be treated as sanitized HTML");
  expect(inventory.summary.contractsWithoutRelatedSyntaxSlice).toBe(119);
});

test("source mapping requires exactly one completed observation for each canary", () => {
  const names = [...new Set(contract.requirements.flatMap(rule => rule.canaries))];
  const observations = names.map(name => ({ name }));
  expect(observabilityEvidence(observations)).toHaveLength(8);
  expect(() => observabilityEvidence(observations.slice(1))).toThrow("expected exactly one completed observability source canary");
  expect(() => observabilityEvidence([...observations, observations[0]!])).toThrow("expected exactly one completed observability source canary");
  const cases = observabilityCases();
  expect(cases).toHaveLength(13); expect(new Set(cases.map(c => c.name)).size).toBe(13);
  expect(cases.every(c => c.coverage === "runtime-only" && c.findings.length === 0)).toBe(true);
  expect(cases.every(c => names.includes(c.name))).toBe(true);
});
