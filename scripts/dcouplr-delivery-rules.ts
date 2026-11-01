// Generate optional, individually bindable project-evidence gates from reviewed upstream conditions.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import contract from "../packs/dcouplr/DELIVERY-CONTRACT.json" with { type: "json" };
import logging from "../packs/dcouplr/LOGGING-CONTRACT.json" with { type: "json" };
import queue from "../packs/dcouplr/QUEUE-RUNTIME-CONTRACT.json" with { type: "json" };
import saga from "../packs/dcouplr/SAGA-RUNTIME-CONTRACT.json" with { type: "json" };
import factory from "../packs/dcouplr/FACTORY-RUNTIME-CONTRACT.json" with { type: "json" };
import utility from "../packs/dcouplr/UTILITY-RUNTIME-CONTRACT.json" with { type: "json" };
import observability from "../packs/dcouplr/OBSERVABILITY-CONTRACT.json" with { type: "json" };
import pin from "../packs/dcouplr/upstream-pin.json" with { type: "json" };

const root = resolve(import.meta.dir, ".."), checking = process.argv.includes("--check"), dirty: string[] = [];
function emit(path: string, value: object): void {
  const target = join(root, path), text = JSON.stringify(value, null, 2) + "\n";
  if (existsSync(target) && readFileSync(target, "utf8").replaceAll("\r\n", "\n") === text) return;
  if (checking) { dirty.push(path); return; }
  mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, text);
}

function receiptFixtures(base: string, id: string, area: string): void {
  for (const name of ["pass/current-inputs", "pass/new-contract", "fail/no-evidence", "fail/failed-verification", "trap/stale-inputs"]) {
    const contractHash = name === "pass/new-contract" ? "reviewed-contract-v2" : "reviewed-contract-v1";
    const receipt = name === "fail/no-evidence" ? null : { schemaVersion: 1, contractHash,
      inputHash: name === "trap/stale-inputs" ? "old-project-inputs" : "current-project-inputs", verifier: id,
      command: ["fixture-verifier"], exitCode: name === "fail/failed-verification" ? 1 : 0, completed: true, recordedAt: "2026-10-05T00:00:00Z" };
    emit(`${base}/fixtures/${name}/fixture.json`, { language: "typescript", params: { verifier: id },
      context: { fitness: { contractHash, inputHash: "current-project-inputs", command: ["fixture-verifier"], receipt } },
      target: ".pregate/preset.json", before: null, expect: name.startsWith("pass/") ? { verdict: "pass" } : { verdict: "fail", violations: [{ line: 1 }] },
      ...(name.startsWith("trap/") ? { trap: { family: "stale-fitness-evidence", origin: "forge", discovered: "2026-10-05", note: `An old successful assertion must not admit changed application ${area} paths.` } } : {}) });
    emit(`${base}/fixtures/${name}/files/.pregate/preset.json.fixture`, { requirement: id });
  }
}

function requirement(rule: typeof contract.requirements[number] | typeof logging.requirements[number] | typeof queue.requirements[number] | typeof saga.requirements[number] | typeof factory.requirements[number] | typeof utility.requirements[number] | typeof observability.requirements[number], sequence: number, area: string) {
  const name = `requirement-${String(sequence).padStart(3, "0")}`, check = `dcouplr/${area}/${name}`, base = `packs/dcouplr/checks/${area}/${name}`;
  emit(`${base}/check.json`, { $schema: "../../../../../schema/check.v1.json", id: check, version: "1.0.0", area, cardinality: "singleton",
    dimension: `dcouplr.${area}.r${String(sequence).padStart(3, "0")}`, minSeverity: "deny", params: { verifier: { type: "string", pattern: "\\S" } },
    impl: { kind: "primitive", primitive: "fitness", requirement: rule.id }, phase: ["stop", "commit", "ci"],
    feedback: { message: `${rule.id} requires current passing project ${area} verification: {symbol}.` } });
  receiptFixtures(base, rule.id, area);
  return { id: rule.id, check, defaults: { verifier: rule.id }, severity: "deny",
    source: { work: `dcouplr ${pin.version} integrity-pinned published declarations and runtime`, locator: rule.source, paraphrase: rule.statement },
    why: `${rule.statement} ${rule.when}`,
    fixHint: `${rule.verify} Bind ${rule.id} to a human-reviewed project assertion with explicit applicability, owner, actual application inputs and freshness. Include a failing control. Run pregate fitness run ${rule.id}.`,
    avoid: "Project evidence gate, not a syntax detector or complete library certification. Source canaries verify the upstream contrast, not consumer compliance. Receipt fixtures verify evidence admission only. No executable command is supplied by this pack. Missing bindings remain UNVERIFIED; an adopted enforcing binding blocks stale or failed evidence, while shadow stays diagnostic. Conditional non-use requires an explicit reviewed reason and evidence, not an unexplained success.",
    examples: { pass: "pass/current-inputs", fail: "fail/no-evidence" } };
}

for (const [area, rules, count] of [["delivery", contract, 10], ["logging", logging, 6], ["queue-runtime", queue, 8], ["saga-runtime", saga, 8], ["factory-runtime", factory, 8], ["utility-runtime", utility, 8], ["observability", observability, 8]] as const) {
  if (rules.upstreamVersion !== pin.version || rules.requirements.length !== count) throw new Error(`Unreviewed ${area} contract version or count`);
  const invariants = rules.requirements.map((rule, index) => {
    if (rule.id !== `DCP-${area.toUpperCase()}-${String(index + 1).padStart(3, "0")}` || !rule.canaries.length || !rule.apiReferences.length)
      throw new Error(`Incomplete ${area} requirement: ${rule.id}`);
    return requirement(rule, index + 1, area);
  });
  emit(`packs/dcouplr/methodologies/${area}.json`, { $schema: "../../../schema/methodology.v1.json", id: `dcouplr/${area}`, version: "1.0.0", status: "preview", conflicts: [], invariants });
}
if (dirty.length) { console.error(`dcouplr project gates are stale:\n${dirty.join("\n")}\nRun bun scripts/dcouplr-delivery-rules.ts.`); process.exitCode = 1; }
else console.log(`${checking ? "Verified" : "Generated"} 56 dcouplr delivery/logging/queue/saga/factory/utility/observability requirements and 280 receipt fixtures. Consumer semantics need reviewed project assertions.`);
