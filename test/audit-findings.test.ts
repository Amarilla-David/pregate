import { beforeAll, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { auditFile, auditRules } from "../src/audit.ts";
import { fixtureLock } from "../src/compile.ts";
import { analyze } from "../src/evaluate.ts";
import { clock, grammars } from "../src/gate.ts";
import type { Check } from "../src/types.ts";

beforeAll(grammars);

const check = JSON.parse(readFileSync("packs/dcouplr/checks/factories/no-ambient-factory-effects/check.json", "utf8")) as Check;
const source = [
  "export function registerHttpFetcher(kernel: Kernel) {",
  "  kernel.addFactoryMethod((_input, dKernel) => {",
  "    const realFetch: typeof fetch = globalThis.fetch.bind(globalThis);",
  "    return { get: (url: string) => realFetch(url) };",
  "  });",
  "}",
].join("\n");

test("issue36: audit reports one finding per rule, line and symbol while the ratchet keeps every match", () => {
  const lock = fixtureLock(check, { allow: [] }, undefined);
  const raw = analyze(lock, "pre", "src/infra/http/fetcher.ts", source, { now: clock, read: () => null });
  if ("cause" in raw) throw new Error(raw.cause);
  expect(raw.violations.filter((v) => v.line === 3)).toHaveLength(2);
  const audited = auditFile(auditRules(lock).lock, "src/infra/http/fetcher.ts", source, { now: clock, read: () => null });
  expect(audited.errors).toEqual([]);
  expect(audited.findings).toMatchObject([{ line: 3, symbol: "registerHttpFetcher.realFetch" }]);
});
