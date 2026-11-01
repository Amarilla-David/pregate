import { beforeAll, expect, setDefaultTimeout, test } from "bun:test";
import { readFileSync } from "node:fs";
import { BUILTIN } from "../src/assets.ts";
import { compile, listChecks } from "../src/compile.ts";
import { readTree } from "../src/disk.ts";
import { testCheck } from "../src/fixtures.ts";
import { clock, grammars, VERSIONS } from "../src/gate.ts";
import type { Manifest, Preset } from "../src/types.ts";

// Cases spawn git or the engine; on Windows each spawn costs 0.3-1 s.
setDefaultTimeout(60_000);

beforeAll(grammars);
const methods = ["maintainability/future-humans", "maintainability/engineering",
  "pstack/principles", "pstack/operations", "pstack/playbooks", "pstack/workspace"];
const sources = ["maintainability", "pstack"];
const original = (text: string) => text.replace(/\s+\*\([^\n]*\)\*$/, "").replaceAll("**", "").trim();

test("all original source clauses have one enforcing optional evidence owner without inflating grouped entries", () => {
  const manifests = methods.map(method => JSON.parse(readFileSync(`packs/${method.split("/")[0]}/methodologies/${method.split("/")[1]}.json`, "utf8")) as Manifest);
  expect(manifests.map(m => m.invariants.length)).toEqual([100, 100, 23, 24, 23, 16]);
  const rules = new Map(manifests.flatMap(m => m.invariants.map(r => [`${m.id.split("/")[0]}/${r.id}`, r] as const)));
  const clauses = [...readFileSync("packs/maintainability/INVARIANTS.md", "utf8").matchAll(/^- \*\*((?:FH|SE)-\d+):\*\* (.+)$/gm)];
  expect(clauses).toHaveLength(200);
  for (const clause of clauses) {
    const r = rules.get(`maintainability/${clause[1]}`)!;
    expect(r, clause[1]).toBeDefined();
    expect(r.source.paraphrase).toBe(original(clause[2]!));
    expect(r.severity).toBe("deny");
  }
  const playbooks = [...readFileSync("packs/pstack/INVARIANTS.md", "utf8").matchAll(/^(\d+)(?:[–-](\d+))?\. (.+)$/gm)];
  expect(playbooks).toHaveLength(86);
  for (const clause of playbooks) {
    const id = `PS-${clause[1]!.padStart(2, "0")}${clause[2] ? `-${clause[2]}` : ""}`;
    const r = rules.get(`pstack/${id}`)!;
    expect(r, id).toBeDefined();
    expect(r.source.paraphrase).toBe(original(clause[3]!));
    expect(r.severity).toBe("deny");
  }
  const ledger = JSON.parse(readFileSync("packs/invariant-coverage.json", "utf8"));
  expect(ledger.entries).toHaveLength(313);
  expect(new Set(ledger.entries.map((e: { evidence: { alias: string } }) => e.evidence.alias)).size).toBe(286);
  for (const entry of ledger.entries) {
    const rule = rules.get(entry.evidence.alias)!;
    expect(rule.check).toBe(entry.evidence.check);
    expect(entry.evidence.kind).toBe("project-fitness");
    expect(entry.evidence.exists).toBe(true);
  }
  expect(ledger.entries.find((e: { id: string }) => e.id === "PS-71").evidence.alias).toBe("pstack/PS-71-74");
  expect(ledger.entries.find((e: { id: string }) => e.id === "PS-74").evidence.alias).toBe("pstack/PS-71-74");
  expect(ledger.entries.find((e: { id: string }) => e.id === "PS-75").evidence.alias).toBe("pstack/PS-75-76");
});

test("optional evidence rules compile independently of languages and do not alter core or existing syntax selections", () => {
  const preset: Preset = { name: "source-invariants", version: "1.0.0", engine: VERSIONS.engine,
    sources: [{ ns: "core", kind: "builtin", version: VERSIONS.core }, ...sources.map(ns => ({ ns, kind: "path" as const, path: `packs/${ns}` }))],
    methodologies: [] };
  const build = () => compile(JSON.stringify(preset), s => s.kind === "builtin" ? BUILTIN : readTree(`packs/${s.ns}`, true), VERSIONS);
  const inactive = build();
  if ("errors" in inactive) throw new Error(inactive.errors.join("\n"));
  expect(inactive.lock.rules).toHaveLength(68);
  preset.methodologies = methods;
  const active = build();
  if ("errors" in active) throw new Error(active.errors.join("\n"));
  expect(active.lock.rules.filter(r => r.integrity)).toHaveLength(68);
  expect(active.lock.rules.filter(r => !r.integrity)).toHaveLength(286);
  for (const r of active.lock.rules.filter(r => !r.integrity)) {
    expect(r.impl.kind).toBe("primitive");
    expect(r.impl.kind === "primitive" && r.impl.primitive).toBe("fitness");
    expect(r.phases).toEqual(["stop", "commit", "ci"]);
    expect(r.severity).toBe("deny");
    expect(r.enforcement).toBe("enforce");
  }
  preset.methodologies = ["maintainability/maintainability", "pstack/reader-load"];
  const syntax = build();
  if ("errors" in syntax) throw new Error(syntax.errors.join("\n"));
  expect(syntax.lock.rules.filter(r => !r.integrity).some(r => r.impl.kind === "primitive" && r.impl.primitive === "fitness")).toBe(false);
});

test("all source-invariant receipt fixtures reject absent, failed and stale evidence", () => {
  let requirements = 0;
  for (const ns of sources) {
    const files = readTree(`packs/${ns}`, true), listed = listChecks(files);
    if ("errors" in listed) throw new Error(listed.errors.join("\n"));
    for (const id of listed.ids) {
      const check = JSON.parse(files[`checks/${id.split("/").slice(1).join("/")}/check.json`]!);
      if (check.impl.primitive !== "fitness") continue;
      const result = testCheck(files, id, clock);
      expect(result.lines.filter(line => !line.startsWith("ok")), id).toEqual([]);
      expect(result.lines).toHaveLength(5);
      expect(result.ok).toBe(true);
      requirements++;
    }
  }
  expect(requirements).toBe(286);
});
