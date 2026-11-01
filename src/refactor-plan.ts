import type { AuditError, AuditFinding } from "./audit.ts";
import type { ProjectFitness } from "./fitness.ts";

interface Inventory {
  root: string; lockHash: string; contentHash: string; changedDuringAudit: boolean;
  findings: AuditFinding[]; errors: AuditError[]; unsupported: string[]; uncovered: string[];
  fitness: ProjectFitness[];
}

// This classifier labels known rule metadata, not semantic intent or product correctness.
function family(check: string) {
  const metadata = check.split("/").slice(1).join("/") || "unknown";
  if (/security|secret|auth|trust/.test(metadata)) return "security-and-trust";
  if (/import|depend|boundar|layer|effect/.test(metadata)) return "boundaries-and-effects";
  if (/complex|control|naming|clarity|readability/.test(metadata)) return "clarity-and-complexity";
  if (/test|proof|verif/.test(metadata)) return "verification";
  return "selected-rule-policy";
}

export function refactorPlan(inventory: Inventory) {
  const grouped = new Map<string, AuditFinding[]>();
  for (const finding of inventory.findings) {
    const key = JSON.stringify([finding.path, finding.rule]);
    grouped.set(key, [...(grouped.get(key) ?? []), finding]);
  }
  const repairs = [...grouped.values()].map((findings) => {
    const first = findings[0]!;
    const classification = family(first.check);
    const role = fileRole(first.path), testSource = TEST_PATH.test(first.path);
    return { path: first.path, rule: first.rule, check: first.check, severity: first.severity, enforcement: first.enforcement,
      classification, classificationBasis: "selected check area and identifier; advisory classification",
      fileRole: `${role} convention; behavior ownership and coverage not established`,
      locations: findings.map((finding) => ({ line: finding.line, symbol: finding.symbol })), observedMatches: findings.length,
      proposedChange: role === "generator" ? `First review this generator's owned inputs and outputs. Change the generator or template, then regenerate and compare the output; do not patch a generated artifact to hide the finding. If the rule applies here: ${first.fix}`
        : /\/errors\/no-empty-catch(?:@[^/]+)?$/.test(first.check) ? `First review the surrounding failure policy. A catch can deliberately continue to a fallback outside its body. Prove the fallback and rejection behavior before changing it; preserve the decision about expected failures. If the selected policy applies here: ${first.fix}`
          : role === "source" ? first.fix : `First review this ${role}'s purpose. A deliberate negative case, sequential measurement or public type contract can be valid. If the rule applies here: ${first.fix}`,
      preserve: "Name the observable inputs, outputs and failure behavior before editing. Preserve that contract; do not lower counts by deleting behavior or assertions.",
      suggestedVerification: testSource ? "Preserve the assertions and execute the affected test suite; splitting a callback alone does not improve coverage."
        : classification === "boundaries-and-effects" || classification === "security-and-trust" ? "Characterize this boundary with integration/contract assertions, including denied and failure cases. Add E2E coverage when an owned critical user journey crosses it."
          : "Characterize the affected decision with focused unit assertions when isolated. Use integration or E2E tests when the behavior crosses a boundary or an owned critical journey.",
      verificationCommands: [["pregate", "check", "--all"], ["pregate", "audit", "--json"]],
      missingEvidence: "The project test command, behavior owner, criticality and runtime dependencies must come from the project; this plan did not run tests or measure change history.",
    };
  }).sort((a, b) => outsideProduction(a) - outsideProduction(b) || priority(a) - priority(b) || b.observedMatches - a.observedMatches
    || a.path.localeCompare(b.path) || a.rule.localeCompare(b.rule));
  return { schemaVersion: 1, mode: "advisory-refactoring-plan", root: inventory.root,
    snapshot: { lockHash: inventory.lockHash, contentHash: inventory.contentHash, changedDuringAudit: inventory.changedDuringAudit },
    order: "Production source first; tests, fixtures, generators and declarations after. Within each: analysis/coverage gaps and failed adopted assertions, then live deny/ask findings, shadow policy and warnings. Counts break ties, not business priorities.",
    analysis: inventory.errors.map((error) => ({ path: error.path, line: error.line, cause: error.cause, next: "Reproduce the evaluation error and check the source with its authoritative compiler; a tool parser error is not proof that repository syntax is wrong." })),
    unsupported: inventory.unsupported, uncovered: inventory.uncovered,
    failedAssertions: inventory.fitness.filter((result) => result.status === "fail").map((result) => ({ rule: result.rule, requirement: result.requirement, statement: result.statement, rationale: result.rationale,
      next: result.fixHint, verificationCommands: [["pregate", "fitness", "run", result.verifier]] })),
    unverifiedRequirements: inventory.fitness.filter((result) => result.status === "unverified").map((result) => ({ rule: result.rule, requirement: result.requirement, statement: result.statement, reason: result.reason, next: result.fixHint })),
    repairs,
    baseline: { mode: "no-new", next: "For existing debt, review the current audit and a no-new ratchet contract. In Git, record a reviewed commit and run check --ratchet --base <commit>; without Git, hooks retain their documented session baseline. Re-audit after each verified repair. Freezing growth does not erase debt or verify missing requirements." },
    limits: ["Advisory deterministic classification; no model, source upload or automatic refactoring.", "A rule match is the declared check result; it is not an independently confirmed design defect.", "Test-file presence is not test coverage. No synthetic maintainability score or predicted change-cost reduction.", "Unknown ownership, change history and business priority remain unknown; review priorities before editing."],
  };
}

const TEST_PATH = /(^|\/)(__tests__|tests?|specs?)(\/|$)|\.(test|spec)\.[^/]+$/;

// File-name conventions only: a role label does not establish ownership, coverage or production use.
export function fileRole(path: string): "generator" | "benchmark" | "fixture or example" | "type declaration" | "test" | "source" {
  if (/(^|\/)(_generators|codegen|generators?)(\/|$)|(^|\/)(generate|codegen)[^/]*\.[^/]+$/.test(path)) return "generator";
  if (/(^|\/)(benchmarks?|bench)(\/|$)|\.bench\.[^/]+$/.test(path)) return "benchmark";
  if (/(^|\/)(fixtures?|examples?|samples?)(\/|$)/.test(path)) return "fixture or example";
  if (/\.d\.(ts|mts|cts)$/.test(path)) return "type declaration";
  return TEST_PATH.test(path) ? "test" : "source";
}

const outsideProduction = (repair: { path: string }): number => Number(fileRole(repair.path) !== "source");

function priority(finding:{ severity: AuditFinding["severity"]; enforcement: AuditFinding["enforcement"] }) {
  if (finding.severity === "warn") return 3;
  if (finding.enforcement === "shadow" || finding.enforcement === "advisor") return 2;
  return finding.severity === "deny" ? 0 : 1;
}

export function refactorPlanText(plan: ReturnType<typeof refactorPlan>) {
  const production = plan.repairs.filter(repair => !outsideProduction(repair)).length;
  return ["Refactoring plan (advisory):", plan.order,
    `Repairs: ${production} in production source; ${plan.repairs.length - production} in tests, fixtures or generated code (listed after).`,
    ...plan.repairs.map((repair, index) => `${index + 1}. ${repair.path} — ${repair.rule} [${repair.classification}, ${repair.severity}/${repair.enforcement}]; ${repair.observedMatches} observed matches.\n   ${repair.proposedChange}\n   Verify: ${repair.suggestedVerification}`),
    `${plan.failedAssertions.length} failed assertions; ${plan.unverifiedRequirements.length} unverified requirements. Inspect audit --plan --json for evidence gaps and scope.`,
    plan.baseline.next, ...plan.limits].join("\n");
}
