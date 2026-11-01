import type { FitnessCandidates, ProjectFitness } from "./fitness.ts";
import type { Lock } from "./types.ts";

function group(check: string): string {
  if (/auth|secret|privilege|trust|security|closed/.test(check)) return "Security and trust";
  if (/test|proof|verif|fitness/.test(check)) return "Tests and verification";
  if (/state|truth|immutable|identity|time|conflict|command-query|language/.test(check)) return "State and domain decisions";
  if (/boundar|depend|interface|cohesion|hiding|composition|responsibility|effect|remote|failure|idempot/.test(check)) return "Boundaries and effects";
  if (/config|budget|latency|cost|migration|observe|runtime|deploy|rollback|alert|runbook|backup/.test(check)) return "Operations and data changes";
  return "Change and clarity";
}

function assertionPrompt(name: string) {
  const controls: Record<string, string> = {
    "Security and trust": "At each declared trust boundary, bypass the relevant permission, validation or redaction guard and assert that the same verifier fails.",
    "Tests and verification": "Recreate the stated defect or break the tested contract and show that the same selected assertion fails before the repair.",
    "State and domain decisions": "Construct a forbidden domain value or state transition, including concurrent conflicts when applicable, and require rejection by the same assertion.",
    "Boundaries and effects": "Introduce a forbidden dependency or hidden effect at the declared module boundary and require the same assertion to fail.",
    "Operations and data changes": "Supply invalid configuration, exceed the declared resource budget or break the recovery/migration path; require the relevant assertion to fail.",
    "Change and clarity": "Remove the observed change evidence or contradict the recorded design decision and require the review/assertion to detect that condition.",
  };
  return { negativeControls: [controls[name]!], assumptions: {
    domain: ["State the applicable domain, owned boundaries, observed changes and conditional exceptions."],
    data: ["State the input shapes, size limits, sensitive fields and fixture/environment authenticity assumptions."],
    performance: ["State the execution/resource budget and whether this assertion measures a latency or capacity requirement."],
  }, limits: "Describe the exact covered conditions and everything this assertion does not establish. A passing general suite is not evidence for an unrelated requirement." };
}

const STOP_WORDS = new Set([
  "core", "invariants", "must", "with", "from", "that", "this", "only", "when", "each", "every",
  "have", "into", "never", "without", "before", "after", "under", "through", "where", "which", "fixture",
]);

function inferTestSlice(check: string, result: ProjectFitness, candidates: string[]): { command: string[]; inputs: string[] } {
  const words = new Set(`${check} ${result.rule} ${result.requirement} ${result.statement}`.toLowerCase()
    .split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !STOP_WORDS.has(w)));
  const scored = candidates
    .filter((p) => /\.(?:[cm]?[jt]sx?|py|go|rs|sh)$/i.test(p))
    .map((file) => {
      const tokens = file.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
      const hits = tokens.filter((t) => words.has(t)).length;
      return { file, hits };
    })
    .filter((x) => x.hits > 0)
    .sort((a, b) => b.hits - a.hits || a.file.localeCompare(b.file))
    .slice(0, 3)
    .map((x) => x.file);
  if (!scored.length) return { command: [], inputs: [] };
  const first = scored[0]!;
  const command = /\.(cjs|mjs)$/i.test(first) ? ["node", first]
    : /\.py$/i.test(first) ? ["pytest", ...scored]
    : /_test\.go$/i.test(first) ? ["go", "test", ...scored]
    : /\.rs$/i.test(first) ? ["cargo", "test"]
    : ["bun", "test", ...scored];
  return { command, inputs: scored };
}

// Declared assertions and file-name hints are proposals, never semantic proof.
export function fitnessPlan(lock: Lock, results: ProjectFitness[], paths: string[], manifest: FitnessCandidates | null = null) {
  const groups = new Map<string, ProjectFitness[]>();
  for (const result of results.filter(result => result.status !== "pass")) {
    const name = group(lock.rules.find(rule => rule.id === result.rule)?.check ?? result.requirement);
    groups.set(name, [...(groups.get(name) ?? []), result]);
  }
  const candidates = paths.filter(path => /(^|\/)(tests?|specs?|__tests__|lint|qa|e2e|quality)(\/|$)|\.(test|spec)\.[^/]+$|(^|\/)(package\.json|Makefile|.*gate.*\.[^/]+)$/.test(path)).sort();
  const claimed = new Set(manifest?.assertions.flatMap(assertion => assertion.claims.filter(claim => claim.coverage === "complete").map(claim => claim.rule)) ?? []);
  const inferredAssertions = results.filter(result => result.status !== "pass" && !claimed.has(result.rule)).flatMap(result => {
    const check = lock.rules.find(rule => rule.id === result.rule)?.check ?? result.requirement;
    const slice = inferTestSlice(check, result, candidates);
    return slice.command.length ? [{ id: result.rule.toLowerCase().replaceAll("/", "-"), rule: result.rule, ...slice }] : [];
  });
  return { schemaVersion: 1, mode: "reviewed-evidence-plan", groups: [...groups].map(([name, requirements]) => ({ name,
    requirements: requirements.map(result => ({ rule: result.rule, statement: result.statement, status: result.status, reason: result.reason, verifier: result.verifier })),
    suggestedAssertion: { conditions: requirements.map(result => result.statement), ...assertionPrompt(name) },
    next: "Choose one bounded project assertion. Read it, name every condition it proves and add invalid controls. Select only the requirements it covers; use fitness bind with comma-separated IDs for one review.",
  })), candidateFiles: candidates.slice(0, 40), otherCandidateFiles: Math.max(0, candidates.length - 40),
    candidateManifest: manifest?.path ?? null, candidateAssertions: manifest?.assertions ?? [],
    inferredAssertions,
    gaps: results.filter(result => result.status !== "pass" && !claimed.has(result.rule)).map(result => ({ rule: result.rule, status: result.status, reason: result.reason })),
    prepare: "pregate fitness plan --template > pregate.fitness.json",
    review: manifest === null ? null : `pregate fitness bind --candidates '${manifest.path.replaceAll("'", "'\\''")}' --preview`,
    limits: "File names and project-authored claims are not evidence. Review every condition, assumption and negative control. This plan does not execute tests, bind a command, change policy or declare compliance.",
    binding: "pregate fitness bind <rule-id,rule-id> --command-json '<reviewed argv array>' --inputs '<verifier, helpers and configuration globs>' --rationale '<what it proves and its limits>' --preview" };
}

export function fitnessPlanText(plan: ReturnType<typeof fitnessPlan>): string {
  return ["Let's connect requirements to real checks.", ...plan.groups.map(group => `${group.name}: ${group.requirements.length} requirements\n  ${group.requirements.map(rule => rule.rule).join(", ")}\n  Suggested negative control: ${group.suggestedAssertion.negativeControls.join(" ")}\n  Assumptions to state: ${JSON.stringify(group.suggestedAssertion.assumptions)}\n  ${group.next}`),
    ...plan.candidateAssertions.map(assertion => `Project assertion ${assertion.id} (not executed):\n  Command: ${JSON.stringify(assertion.command)}\n  ${assertion.claims.map(claim => `${claim.rule} (${claim.coverage} declared coverage): ${claim.conditions.join("; ")}`).join("\n  ")}\n  Negative controls: ${assertion.negativeControls.join("; ")}\n  Assumptions: ${JSON.stringify(assertion.assumptions)}\n  Limits: ${assertion.limits}`),
    `${plan.gaps.length} nonpassing requirements have no candidate claiming complete coverage in this plan.`,
    ...(plan.candidateFiles.length ? ["Files to review (names only): " + plan.candidateFiles.join(", ")] : ["No verifier file was inferred. Choose a project assertion; do not bind an unrelated passing command."]),
    plan.prepare, ...(plan.review === null ? [] : [plan.review]), plan.binding, plan.limits].join("\n");
}

export function fitnessTemplate(lock: Lock, results: ProjectFitness[], paths: string[] = [], auto = false) {
  const candidates = auto ? paths.filter(path => /(^|\/)(tests?|specs?|__tests__|lint|qa|e2e|quality)(\/|$)|\.(test|spec)\.[^/]+$/.test(path)).sort() : [];
  return { schemaVersion: 1, assertions: results.filter(result => result.rationale === null).map(result => {
    const check = lock.rules.find(rule => rule.id === result.rule)?.check ?? result.requirement;
    const name = group(check);
    const slice = auto ? inferTestSlice(check, result, candidates) : { command: [], inputs: [] };
    return { id: result.rule.toLowerCase().replaceAll("/", "-"), command: slice.command, inputs: slice.inputs, timeoutMs: 30000,
      claims: [{ rule: result.rule, conditions: [result.statement], coverage: "partial" }], ...assertionPrompt(name) };
  }) };
}
