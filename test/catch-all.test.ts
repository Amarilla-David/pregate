import { expect, test } from "bun:test";
import { catchAllIdentities, unannotatedCatchAlls } from "../scripts/catch-all-lint.ts";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const BASELINE = join(import.meta.dir, "../scripts/catch-all-baseline.txt");

test("src has no unannotated catch-all beyond the baseline", () => {
  const expected = readFileSync(BASELINE, "utf8").split("\n").filter((line) => line !== "");
  expect(catchAllIdentities()).toEqual(expected);
});

test("the lint rejects a new catch-all and accepts a narrowed or annotated one", () => {
  const open = "export function f(): number {\n  try { return JSON.parse(\"\"); }\n  catch { return 0; }\n}\n";
  expect(unannotatedCatchAlls("src/new.ts", open).map((hit) => hit.text)).toEqual(["catch { return 0; }"]);
  const noted = "export function f(): number {\n  try { return JSON.parse(\"\"); }\n  catch { return 0; /* fail-closed: a prompt that cannot be read cancels and applies nothing */ }\n}\n";
  expect(unannotatedCatchAlls("src/new.ts", noted)).toEqual([]);
  const narrow = "export function f(text: string): unknown {\n  try { return JSON.parse(text); }\n  catch (error) { if (error instanceof SyntaxError) return null; throw error; }\n}\n";
  expect(unannotatedCatchAlls("src/new.ts", narrow)).toEqual([]);
  const hidden = "export const script = `try { work(); } catch { return 1; }`;\n";
  expect(unannotatedCatchAlls("src/new.ts", hidden)).toEqual([]);
});
