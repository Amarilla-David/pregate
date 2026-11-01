import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const input = "docs/inputs/core-invariants-48.md";
const checking = process.argv.includes("--check"), dirty: string[] = [];
const rules = [...readFileSync(join(root, input), "utf8").matchAll(/^(\d+)\. (.+)$/gm)];
const followupInput = "docs/features/core-maintainability-update.md";
const followup = [...readFileSync(join(root, followupInput), "utf8").split("## Requested invariant rules")[1]!.matchAll(/^(\d+)\. (.+)$/gm)];
// One enforcing obligation owns each request; overlaps keep their original identity.
const targets = [7, 2, 3, 24, 15, 24, 24, 31, 31, 31, 31, 3, 3, 49, 50, 51, 52, 28, 28, 53, 48, 48, 48, 36, 54, 44, 29, 55, 56, 29, 57, 58, 59, 36, 47, 43, 43, 60, 61, 62, 3, 63, 64, 37, 7, 18, 24, 40];
const qualified: Record<number, string> = {
  4: "Business decisions must have an explicit domain owner; no folder name or architectural style is required.",
  6: "A user-interface adapter must delegate business decisions to their domain owner.",
  7: "A database adapter must apply domain decisions, not own them.",
  8: "An externally consumed public contract must have an explicit version; controlled consumers can migrate together under the original compatibility rule.",
  9: "An incompatible change to an externally consumed public contract must increment its version.",
  10: "An externally consumed public contract must have a written deprecation policy with scope, notice and support windows.",
  11: "The previous externally consumed public version must remain supported throughout its stated deprecation window.",
  14: "Each resolved dependency version must be pinned through the ecosystem's explicit manifest or dependency lock.",
  15: "The build must use the ecosystem's committed dependency lock or equivalent deterministic dependency record; a locked rebuild must preserve resolution.",
  16: "Dependencies must be updated on an owned, stated schedule, with dated update records.",
  17: "The build must reject a known high-risk dependency defect after the project's stated fix window. Use dated authoritative vulnerability evidence.",
  20: "The product must use a supported runtime. Verify declared versions against dated authoritative support evidence.",
  25: "Time, money and locale must use supported standard facilities appropriate to precision, time zones and locale. Do not add a dependency when supported ecosystem facilities satisfy the requirement.",
  32: "An identified risky feature must have a controlled safe-release flag with tested enable and disable behavior. Do not introduce speculative flags without a relevant risk.",
  35: "A measured bottleneck must be scalable without rewriting domain decisions or unrelated modules. Preserve contracts and budgets; do not add speculative distribution.",
};
const names = [
  "reason-for-change", "cohesion-and-coupling", "information-hiding", "observable-contract", "stable-dependencies", "evidenced-abstraction",
  "single-change-reason", "explicit-dependencies", "collaborator-knowledge", "composition", "narrow-interfaces", "source-of-truth",
  "domain-validation", "valid-state", "shared-immutability", "explicit-time-and-identity", "command-query-effects", "domain-language",
  "invariant-failure", "failure-classification", "idempotency", "remote-call-budget", "failure-isolation", "effects-at-boundaries",
  "concurrency-conflicts", "demonstrated-need", "sufficient-simplicity", "replaceable-modules", "vertical-slices", "observed-change-axis",
  "explicit-compatibility", "clear-code", "predictable-names", "abstraction-level", "least-power", "named-policies", "dead-code",
  "minimum-privilege", "boundary-validation", "secret-isolation", "decision-authorization", "closed-failure", "boundary-observability",
  "isolated-verification", "startup-validation", "latency-isolation", "resource-budgets", "repeatable-migrations",
  "pinned-dependencies", "locked-build", "dependency-update-schedule", "vulnerability-fix-window", "supported-runtime", "standard-value-facilities",
  "defect-regression", "static-analysis-merge-gate", "release-rollback", "controlled-risk-flags", "automated-deployment", "operational-runbooks",
  "alert-ownership", "architecture-decision-record", "reproducible-onboarding", "debt-ownership",
];
if (rules.length !== 48 || names.length !== 64 || rules.some((r, i) => Number(r[1]) !== i + 1)
  || followup.length !== 48 || targets.length !== 48 || followup.some((r, i) => Number(r[1]) !== i + 1)) throw new Error("Expected both consecutive sets of 48 requirements and their 64 stable obligations.");
function emit(path: string, value: object) {
  const target = join(root, path);
  const text = JSON.stringify(value, null, 2) + "\n";
  if (existsSync(target) && readFileSync(target, "utf8").replaceAll("\r\n", "\n") === text) return;
  if (checking) { dirty.push(path); return; }
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, text);
}
const invariants = names.map((name, i) => {
  const id = `CORE-INV-${String(i + 1).padStart(3, "0")}`, check = `core/invariants/${names[i]}`;
  const base = `catalog/checks/invariants/${names[i]}`;
  const additions = followup.filter((_, at) => targets[at] === i + 1);
  const statement = [rules[i]?.[2], ...additions.map((r) => qualified[Number(r[1])] ?? r[2])].filter(Boolean).join(" ");
  const updated = additions.length > 0;
  emit(`${base}/check.json`, { id: check, version: updated ? "1.1.0" : "1.0.0", area: "invariants", cardinality: "singleton",
    dimension: `invariant.r${String(i + 1).padStart(3, "0")}`, minSeverity: "deny", params: { verifier: { type: "string", pattern: "\\S" } },
    impl: { kind: "primitive", primitive: "fitness", requirement: id }, phase: ["stop", "commit", "ci"],
    feedback: { message: `${id} requires current passing project verification: {symbol}.` } });
  for (const name of ["pass/current-inputs", "pass/new-contract", "fail/no-evidence", "fail/failed-verification", "trap/stale-inputs"]) {
    const contractHash = name === "pass/new-contract" ? "reviewed-contract-v2" : "reviewed-contract-v1";
    const receipt = name === "fail/no-evidence" ? null : { schemaVersion: 1, contractHash,
      inputHash: name === "trap/stale-inputs" ? "old-code-tree" : "current-code-tree", verifier: id, command: ["fixture-verifier"],
      exitCode: name === "fail/failed-verification" ? 1 : 0, completed: true, recordedAt: "2026-10-04T00:00:00Z" };
    const pass = name.startsWith("pass/");
    emit(`${base}/fixtures/${name}/fixture.json`, { language: "typescript", params: { verifier: id },
      context: { fitness: { contractHash, inputHash: "current-code-tree", command: ["fixture-verifier"], receipt } },
      target: ".pregate/preset.json", before: null,
      expect: pass ? { verdict: "pass" } : { verdict: "fail", violations: [{ line: 1 }] },
      ...(name.startsWith("trap/") ? { trap: { family: "stale-fitness-evidence", origin: "forge", discovered: "2026-10-04",
        note: "A prior green verification must not admit changed inputs." } } : {}) });
    emit(`${base}/fixtures/${name}/files/.pregate/preset.json.fixture`, { requirement: id });
  }
  return { id, check, defaults: { verifier: id }, severity: "deny",
    source: { work: "User-supplied software and maintainability invariants", locator: [rules[i] ? `${input}, rule ${i + 1}` : null,
      ...additions.map((r) => `${followupInput}, request ${r[1]}`)].filter(Boolean).join("; "),
      paraphrase: [rules[i]?.[2], ...additions.map((r) => r[2])].filter(Boolean).join(" ") },
    why: statement, fixHint: `Bind ${id} to a project fitness function that tests every applicable condition in this requirement and documents its coverage and invalid controls. Review the binding as a contract change, then run pregate fitness run ${id}. Repair a failed verification. For dated runtime, vulnerability or operational facts, review an explicit maxAgeMs and inspect current authoritative evidence. A human can explicitly disable the requirement if it does not apply.`,
    avoid: "A passing unrelated test, stale receipts, silence or a syntax-only approximation do not prove the full requirement. Verification is bounded by the human-reviewed command and rationale; inspect what it tests. Missing verification is unverified, not compliant. Packs never supply executable fitness commands.",
    examples: { pass: "pass/current-inputs", fail: "fail/no-evidence" } };
});
emit("catalog/methodologies/software-invariants.json", { $schema: "../../schema/methodology.v1.json", id: "core/software-invariants", version: "1.1.0",
  status: "preview", conflicts: [], invariants });
if (dirty.length) {
  console.error(`Core requirements are stale:\n${dirty.join("\n")}\nRun bun scripts/core-invariants.ts.`);
  process.exitCode = 1;
} else console.log(`${checking ? "Verified" : "Generated"} 64 project fitness obligations from both sets of 48 requests and 320 declarative receipt fixtures. These fixtures test the evidence gate, not project semantics.`);
