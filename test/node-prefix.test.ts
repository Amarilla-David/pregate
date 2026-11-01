import { beforeAll, expect, test } from "bun:test";
import { fixtureLock } from "../src/compile.ts";
import { analyze } from "../src/evaluate.ts";
import { clock, grammars } from "../src/gate.ts";
import { librarySource } from "../src/library.ts";
import type { Check } from "../src/types.ts";

beforeAll(grammars);

function findings(source: string) {
  const check = JSON.parse(librarySource("node")!["checks/modules/prefer-node-prefix/check.json"]!) as Check;
  const out = analyze(fixtureLock(check, {}, undefined), "pre", "src/schema.ts", source, { now: clock, read: () => null });
  if ("cause" in out) throw new Error(out.cause);
  return out.violations;
}

test.each([
  'export const openapi = { components: { securitySchemes: { bearerAuth: { type: "http", format: "url" } } } };',
  'export type Protocol = "http" | "url";',
  'export function describe() { return { type: "http", format: "url" }; }',
  'export const docs = import("third-party", { with: { type: "http" } });',
  'export const docs = require(getPackage("http"));',
  'export const docs = require("third-party", "http");',
  'export const docs = require(/* package */ "third-party", /* data */ "http");',
  'export const docs = import(/* package */ "third-party", { with: { type: "http" } });',
  'export const docs = require(/* package */ getPackage("http"));',
  'export const docs = object.require("http");',
  'export const docs = import(`http/${name}`);',
  'import http from "node:http"; export { URL } from "node:url";',
])("issue 25: exported data and unrelated literal arguments pass: %s", source => {
  expect(findings(source)).toHaveLength(0);
});

test.each([
  'import http from "http";',
  'import "fs/promises";',
  'import type { Stats } from "fs";',
  'export { URL } from "url";',
  'export * from "http";',
  'const fs = require("fs");',
  'const fs = require(/* module name */ "fs");',
  'const fs = module.require(/* module name */ "fs");',
  'const http = await import(/* module name */ "http");',
  'const fs = require(/* first */ /* second */ `fs/promises`);',
  'const fs = require(// module name\n"fs");',
  'const fs = module . require("fs");',
  'const http = await import("http");',
  'const http = await import(`http`);',
  'const fs = require(`fs/promises`);',
  'import fs = require("fs");',
])("issue 25: direct builtin module specifiers remain findings: %s", source => {
  expect(findings(source)).toHaveLength(1);
});
