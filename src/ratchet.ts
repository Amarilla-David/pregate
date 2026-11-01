// Which violations of the "after" a change introduced over its "before" (ARCHITECTURE §6.3).
import { isImportRule } from "./evaluate.ts";
import type { Analysis, Lock, Violation } from "./types.ts";

// rel names the file both analyses describe; diff violations sit on its line 1, as `<module>`.
export function introduced(lock: Lock, rel: string, before: Analysis | null, after: Analysis): Violation[] {
  const diffs = lock.rules.flatMap((r): Violation[] => {
    const now = after.counts[r.id];
    if (r.impl.kind !== "primitive" || r.impl.primitive !== "diff" || now === undefined) return [];
    const was = before?.counts[r.id] ?? 0;
    const worse = r.impl.op === "no-increase" ? now > was : now < was;
    if (!worse) return [];
    const sites = [...(before?.markerSites?.[r.id] ?? [])];
    const added = (after.markerSites?.[r.id] ?? []).filter(site => {
      const index = sites.findIndex(old => old.key === site.key);
      if (index < 0) return true;
      sites.splice(index, 1); return false;
    });
    const line = r.impl.op === "no-increase" ? added[0]?.line ?? 1 : 1;
    return [{ rule: r.id, path: rel, line, symbol: "<module>", measured: now, limit: was, atSessionStart: null, severity: r.severity }];
  });
  const baselines = before === null ? new Map<Violation, Violation>() : metricBaselines(lock, before, after);
  const metric = (v: Violation) => lock.rules.some((r) => r.id === v.rule && r.impl.kind === "primitive" && r.impl.primitive === "metric");
  const kept = before === null || lock.ratchet === "strict" ? after.violations : [
    ...noNew(before, after.violations.filter((v) => !metric(v))),
    ...after.violations.filter((v) => metric(v) && (baselines.get(v) === undefined || v.measured! > baselines.get(v)!.measured!)),
  ];
  return canonical([...kept.map((v) => ({ ...v, atSessionStart: baselines.get(v)?.measured ?? startValue(before, v) })), ...diffs]);
}

// Reserve matching paths first, then pair remaining bodies once each. A copied or renamed symbol
// cannot borrow the baseline of a symbol still present; duplicate anonymous callbacks compare by size.
function metricBaselines(lock: Lock, before: Analysis, after: Analysis): Map<Violation, Violation> {
  const ids = new Set(lock.rules.filter((r) => r.impl.kind === "primitive" && r.impl.primitive === "metric").map((r) => r.id));
  const old = before.violations.filter((v) => ids.has(v.rule)).sort((a, b) => b.measured! - a.measured!);
  const now = after.violations.filter((v) => ids.has(v.rule)).sort((a, b) => b.measured! - a.measured!);
  const pairs = new Map<Violation, Violation>();
  const existed = new Set(before.symbols), remains = new Set(after.symbols);
  const body = (a: Analysis, v: Violation) => a.metricBodies[`${v.symbol}\0${v.line}`];
  for (const samePath of [true, false]) for (const v of now) {
    if (pairs.has(v)) continue;
    const index = old.findIndex((b) => b.rule === v.rule && (samePath ? b.symbol === v.symbol
      : !existed.has(v.symbol) && !remains.has(b.symbol) && body(after, v) !== undefined && body(after, v) === body(before, b)));
    if (index >= 0) pairs.set(v, old.splice(index, 1)[0]!);
  }
  return pairs;
}

// The lock to analyze the "before" under: the rules introduced() reads from it (the diff counts and
// the rules the "after" violates) and the import rules, the only ones whose "before" can end in a
// form, which callers read. The other rules cannot change the result, so they need not run twice.
export function comparedLock(lock: Lock, after: Analysis): Lock {
  const violated = new Set(after.violations.map((v) => v.rule));
  return { ...lock, rules: lock.rules.filter((r) => violated.has(r.id) || isImportRule(r) || (r.impl.kind === "primitive" && r.impl.primitive === "diff")) };
}

// no-new: a violation on a symbol the "before" did not have is new, with no compensation; on the
// symbols it had, a rule whose count in the file grew reports the symbols whose own count grew.
function noNew(before: Analysis, after: Violation[]): Violation[] {
  const existed = new Set(before.symbols);
  const count = (vs: Violation[], rule: string, symbol?: string) =>
    vs.filter((v) => v.rule === rule && (symbol === undefined || v.symbol === symbol)).length;
  const old = after.filter((v) => existed.has(v.symbol));
  return after.filter((v) => !existed.has(v.symbol)
    || (count(old, v.rule) > count(before.violations, v.rule) && count(old, v.rule, v.symbol) > count(before.violations, v.rule, v.symbol)));
}

// The measure the same symbol had in the "before", so the message can show the trend.
function startValue(before: Analysis | null, v: Violation): number | null {
  return before?.violations.find((b) => b.rule === v.rule && b.symbol === v.symbol && b.measured !== null)?.measured ?? null;
}

// One violation per (rule, line, symbol), in a total order: the same input gives the same output.
export function canonical(vs: Violation[]): Violation[] {
  const key = (v: Violation) => `${v.rule}\0${String(v.line).padStart(9, "0")}\0${v.symbol}\0${v.measured}\0${v.limit}`;
  const unique = new Map(vs.map((v) => [`${v.rule}\0${v.line}\0${v.symbol}`, v]));
  return [...unique.values()].sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
}
