import { beforeAll, expect, test } from "bun:test";
import { fixtureLock } from "../src/compile.ts";
import { analyze } from "../src/evaluate.ts";
import { clock, grammars } from "../src/gate.ts";
import { librarySource } from "../src/library.ts";
import type { Check } from "../src/types.ts";

beforeAll(grammars);
function findings(ns: string, path: string, source: string, rel = "src/example.ts"): number {
  const check = JSON.parse(librarySource(ns)![`checks/${path}/check.json`]!) as Check;
  const out = analyze(fixtureLock(check, {}, undefined), "pre", rel, source, { now: clock, read: () => null });
  if ("cause" in out) throw new Error(out.cause);
  return out.violations.length;
}

test("issue 19: synchronous effect with an inner async loader and cleanup is valid", () => {
  expect(findings("react", "hooks/no-async-effect", "useEffect(() => { let cancelled = false; async function load() { await x(); } void load(); return () => { cancelled = true; }; }, [deps]);")).toBe(0);
  expect(findings("react", "hooks/no-async-effect", "useEffect(async () => { await x(); }, [deps]);")).toBe(1);
});

test.each([
  "parts.push({ text: a.slice(i, i + n) });", "shadow.push([p.x + dx, p.y + dy]);", "hits.push(full.replace(root + '/', ''));",
])("issue 19: an array push is not Next router navigation: %s", source => {
  expect(findings("nextjs", "routing/no-router-push-concat", source)).toBe(0);
});

test.each([
  "const row = db.select().from(t).where(eq(t.key, k)).get();",
  "return db.select().from(t).get();",
  "await db.select().from(t).where(eq(t.key, k)).get();",
  "db.select().from(t).where(eq(t.key, k)).get({ key: value });",
])("issue 19: a terminal get on this select chain has a single-row result: %s", source => {
  expect(findings("drizzle", "queries/no-unbounded-select", source)).toBe(0);
});

test.each([
  "const rows = db.select().from(t).where(eq(t.id, id));",
  "const rows = db.select().from(t).where(inArray(t.id, ids));",
  "const rows = combine(db.select().from(t), db.select().from(other).get());",
  "const rows = db.select().from(t).where(eq(t.key, other.get()));",
  "const rows = db.select().from(t).get().all();",
])("issue 19: unknown predicate and unrelated get bounds require evidence: %s", source => {
  expect(findings("drizzle", "queries/no-unbounded-select", source)).toBe(1);
});

test("issue 19: defaulted TypeScript parameters remain an explicit optional public policy", () => {
  const source = "export function f(limit = 25, now = new Date()) { return limit; }";
  expect(findings("typescript", "types/export-parameter-typed", source)).toBe(2);
  expect(findings("typescript", "types/export-parameter-typed", source, "src/example.mjs")).toBe(0);
  expect(findings("typescript", "types/export-parameter-typed", "export function f(limit: number = 25, now: Date = new Date()) { return limit; }")).toBe(0);
});
