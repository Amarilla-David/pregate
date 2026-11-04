import { beforeAll, expect, test } from "bun:test";
import { fixtureLock } from "../src/compile.ts";
import { analyze } from "../src/evaluate.ts";
import { clock, grammars } from "../src/gate.ts";
import { librarySource } from "../src/library.ts";
import { declaredNodeMajor, minimumMajor } from "../src/node-target.ts";
import type { Check, Read } from "../src/types.ts";

beforeAll(grammars);

const read = (tree: Record<string, string>): Read => (rel) => tree[rel] ?? null;

test("an engines range keeps the oldest major it still allows", () => {
  expect(minimumMajor(">=26")).toBe(26);
  expect(minimumMajor(">=26.0.0")).toBe(26);
  expect(minimumMajor("^26.0.0")).toBe(26);
  expect(minimumMajor("~26.1.2")).toBe(26);
  expect(minimumMajor("26.x")).toBe(26);
  expect(minimumMajor("26")).toBe(26);
  expect(minimumMajor("v26.1.0")).toBe(26);
  expect(minimumMajor(">=26 <27")).toBe(26);
  expect(minimumMajor(">=22")).toBe(22);
  expect(minimumMajor(">=18 <22")).toBe(18);
  expect(minimumMajor(">=20 || >=26")).toBe(20);
  expect(minimumMajor("^20.12.0 || ^22.0.0 || >=24")).toBe(20);
  expect(minimumMajor("20.0.0 - 22.9.0")).toBe(20);
  expect(minimumMajor(">25")).toBe(25);
  expect(minimumMajor("*")).toBeNull();
  expect(minimumMajor("lts/*")).toBeNull();
  expect(minimumMajor(">=26 <26")).toBeNull();
  expect(minimumMajor("")).toBeNull();
  expect(minimumMajor("not-a-version")).toBeNull();
});

test("declared pins use the oldest readable target and stay unknown otherwise", () => {
  const file = "packages/api/src/server.ts";
  expect(declaredNodeMajor(file, read({}))).toBeNull();
  expect(declaredNodeMajor(file, read({ "package.json": '{"engines":{"node":">=26"}}' }))).toBe(26);
  expect(declaredNodeMajor(file, read({
    "package.json": '{"engines":{"node":">=20"}}',
    ".nvmrc": "26\n",
  }))).toBe(20);
  expect(declaredNodeMajor(file, read({ ".nvmrc": "22.14.0\n" }))).toBe(22);
  expect(declaredNodeMajor(file, read({ "package.json": '{"volta":{"node":"26.1.0"}}' }))).toBe(26);
  expect(declaredNodeMajor(file, read({ ".node-version": "v20.11.0\n" }))).toBe(20);
  expect(declaredNodeMajor(file, read({ ".tool-versions": "python 3.12.0\nnodejs 26.0.0\n" }))).toBe(26);
  expect(declaredNodeMajor(file, read({ ".tool-versions": "nodejs 26.0.0 22.0.0\n" }))).toBe(22);
  expect(declaredNodeMajor(file, read({
    "package.json": '{"engines":{"node":">=26"}}',
    ".nvmrc": "lts/*\n",
  }))).toBeNull();
  expect(declaredNodeMajor(file, read({ "package.json": "{broken" }))).toBeNull();
  expect(declaredNodeMajor(file, read({ "package.json": '{"engines":{"node":"*"}}' }))).toBeNull();
  expect(declaredNodeMajor(file, read({
    "package.json": '{"engines":{"node":">=26"}}',
    ".nvmrc": "# local override\n\n",
  }))).toBe(26);
  expect(declaredNodeMajor(file, read({
    "package.json": '{"engines":{"node":">=26"}}',
    "packages/api/package.json": "{}",
  }))).toBe(26);
  expect(declaredNodeMajor(file, read({ "packages/api/package.json": '{"engines":{"node":">=26"}}' }))).toBe(26);
  expect(declaredNodeMajor(file, read({
    "package.json": '{"engines":{"node":">=26"}}',
    ".nvmrc": "22\n",
    "packages/api/package.json": '{"engines":{"node":">=26"}}',
  }))).toBe(22);
});

test("a rule without a Node.js floor does not read version pins", () => {
  const check = JSON.parse(librarySource("node")!["checks/security/no-create-cipher/check.json"]!) as Check;
  const source = 'import * as crypto from "node:crypto";\nexport function open(password: string) {\n  return crypto.createCipher("aes-192-cbc", password);\n}\n';
  const out = analyze(fixtureLock(check, {}, undefined), "pre", "src/a.ts", source, {
    now: clock,
    read: () => { throw new Error("version pins are not part of this rule"); },
  });
  if ("cause" in out) throw new Error(out.cause);
  expect(out.violations).toHaveLength(1);
});

test("Node.js 26 removals stay quiet for an older declared target", () => {
  const check = JSON.parse(librarySource("node")!["checks/api/no-write-header/check.json"]!) as Check;
  const source = "export function respond(res: { writeHeader(code: number): void }) {\n  res.writeHeader(200);\n}\n";
  const run = (tree: Record<string, string>) => {
    const out = analyze(fixtureLock(check, { minNode: 26 }, undefined), "pre", "src/http/respond.ts", source, { now: clock, read: read(tree) });
    if ("cause" in out) throw new Error(out.cause);
    return out.violations.map((item) => item.line);
  };
  expect(run({ "package.json": '{"engines":{"node":">=20"}}' })).toEqual([]);
  expect(run({ "package.json": '{"engines":{"node":">=26"}}' })).toEqual([2]);
  expect(run({})).toEqual([]);
});
