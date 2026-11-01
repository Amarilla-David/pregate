import { beforeAll, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { BUILTIN } from "../src/assets.ts";
import { applyRequest, compile } from "../src/compile.ts";
import { analyze } from "../src/evaluate.ts";
import { clock, grammars, VERSIONS } from "../src/gate.ts";
import { librarySource } from "../src/library.ts";
import type { Lock, Preset } from "../src/types.ts";

let lock: Lock;
beforeAll(async () => {
  await grammars();
  const preset: Preset = { name: "managed-boundary", version: "1.0.0", engine: VERSIONS.engine,
    sources: [{ ns: "core", kind: "builtin", version: VERSIONS.core }], methodologies: [], overrides: {},
    scope: { include: ["**"], exclude: ["vendor/**"] } };
  const request = readFileSync("docs/examples/dcouplr-managed-boundary/request.json", "utf8");
  const applied = applyRequest(JSON.stringify(preset), request);
  if ("errors" in applied) throw new Error(applied.errors.join("\n"));
  const out = compile(applied.presetText, source => source.kind === "builtin" ? BUILTIN : librarySource(source.ns), VERSIONS);
  if ("errors" in out) throw new Error(out.errors.join("\n"));
  lock = out.lock;
});

function findings(path: string, text: string): string[] {
  const project: Record<string, string> = { "app/contracts/billing.ts": "export interface Billing {}", "app/adapters/billing.ts": "export class Billing {}" };
  const out = analyze(lock, "pre", path, text, { now: clock, read: rel => project[rel] ?? null });
  if ("cause" in out) throw new Error(out.cause);
  return out.violations.map(finding => finding.rule).filter(rule => rule.startsWith("dcouplr/"));
}

test("custom managed boundary admits injected services, port imports and composition roots", () => {
  expect(findings("app/features/order.ts", 'import type { Billing } from "../contracts/billing"; export function createOrder(kernel) { return kernel.dependencies.resolve("billing"); }')).toEqual([]);
  expect(findings("app/bootstrap/order.ts", "stage.addFactoryMethod((input, kernel) => new Order(input, kernel));")).toEqual([]);
  expect(findings("app/values/money.ts", "export function money(amount) { return new Money(amount); }")).toEqual([]);
});

test.each([
  ["const order = new Order();", "dcouplr/DCP-NEW-001"],
  ["const now = Date.now();", "dcouplr/DCP-AMBIENT-001"],
  ["fetch('/orders');", "dcouplr/DCP-AMBIENT-001"],
  ['import { getDcouplr } from "dcouplr"; getDcouplr();', "dcouplr/DCP-LOCATOR-001"],
  ['import { Billing } from "../adapters/billing";', "dcouplr/DCP-EDGE-001"],
])("custom managed boundary checks %s", (source, rule) => {
  expect(findings("app/features/order.ts", source)).toContain(rule);
});
