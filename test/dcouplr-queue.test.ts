import { beforeAll, expect, test } from "bun:test";
import { BUILTIN } from "../src/assets.ts";
import { compile, listChecks } from "../src/compile.ts";
import { readTree } from "../src/disk.ts";
import { testCheck } from "../src/fixtures.ts";
import { clock, grammars, VERSIONS } from "../src/gate.ts";
import { queueCases, queueEvidence } from "../scripts/dcouplr-queue-cases.ts";
import contract from "../packs/dcouplr/QUEUE-RUNTIME-CONTRACT.json" with { type: "json" };
import inventory from "../packs/dcouplr/API-COVERAGE.json" with { type: "json" };

beforeAll(grammars);

test("queue runtime gates activate separately and preserve honest missing or stale evidence", () => {
  const files = readTree("packs/dcouplr", true);
  const compiled = compile(JSON.stringify({ name: "queue-runtime", version: "1.0.0", engine: VERSIONS.engine,
    sources: [{ ns: "core", kind: "builtin", version: VERSIONS.core }, { ns: "dcouplr", kind: "path", path: "packs/dcouplr" }],
    methodologies: ["dcouplr/queue-runtime"] }), source => source.kind === "builtin" ? BUILTIN : files, VERSIONS);
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
  for (const check of checks.ids.filter(id => id.startsWith("dcouplr/queue-runtime/"))) {
    const result = testCheck(files, check, clock);
    expect(result.ok).toBe(true);
    expect(result.lines.filter(line => line.startsWith("ok"))).toHaveLength(5);
  }
});

test("queue evidence references preserve the boundary between syntax and actual adapter behavior", () => {
  const queue = inventory.contracts.find(c => c.name === "IQueue")!;
  expect(queue.evidenceRequirements).toEqual(["dcouplr/DCP-QUEUE-RUNTIME-008"]);
  expect(queue.members.find(m => m.name === "recover")!.evidenceRequirements).toEqual(["dcouplr/DCP-QUEUE-RUNTIME-006", "dcouplr/DCP-QUEUE-RUNTIME-008", "dcouplr/DCP-SAGA-RUNTIME-006"]);
  const repository = inventory.contracts.find(c => c.name === "IQueuePersistence")!;
  expect(repository.members.find(m => m.name === "appendBatch")!.relatedSlices).toEqual([]);
  expect(repository.members.find(m => m.name === "appendBatch")!.evidenceRequirements).toEqual(["dcouplr/DCP-QUEUE-RUNTIME-004", "dcouplr/DCP-QUEUE-RUNTIME-007", "dcouplr/DCP-SAGA-RUNTIME-007"]);
  expect(inventory.summary.contractsWithoutRelatedSyntaxSlice).toBe(119);
  expect(inventory.summary.contractsWithProjectEvidenceRequirement).toBe(100);
});

test("queue source proof requires exactly one completed observation for every named canary", () => {
  const names = [...new Set(contract.requirements.flatMap(rule => rule.canaries))];
  const observations = names.map(name => ({ name }));
  expect(queueEvidence(observations)).toHaveLength(8);
  expect(() => queueEvidence(observations.slice(1))).toThrow("expected exactly one completed queue source canary");
  expect(() => queueEvidence([...observations, observations[0]!])).toThrow("expected exactly one completed queue source canary");
  const cases = queueCases();
  expect(cases).toHaveLength(29);
  expect(new Set(cases.map(c => c.name)).size).toBe(29);
  expect(cases.every(c => c.coverage === "runtime-only")).toBe(true);
});
