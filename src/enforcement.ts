import type { Enforcement, Lock, LockRule, Loop } from "./types.ts";

// One policy for compilation and decisions made without an admitted lock (SPEC §8.3).
// Contract overrides copy it; a consumer cannot change another call's shared defaults.
export const LOOP_DEFAULTS: Readonly<Loop> = Object.freeze({
  maxDenialsPerFileRule: 3, maxDenialsPerTurn: 15, noProgressLimit: 2,
  maxStopBlocks: 2, allowAsk: true, maxDetailedViolations: 5,
});

export function enforcementOf(lock: Lock, rule: LockRule): Enforcement {
  if (rule.enforcement === "advisor") return "advisor";
  if (rule.integrity) return lock.enforcement === "advisor" && rule.enforcement === undefined ? "advisor" : "enforce";
  return rule.enforcement ?? lock.enforcement;
}

export function ruleEnforcements(lock: Lock | null): Record<string, Enforcement> {
  if (lock === null) return {};
  return Object.fromEntries(lock.rules.map((rule) => [rule.id, enforcementOf(lock, rule)]));
}
