import { beforeAll, expect, test } from "bun:test";
import { setUpGrammars } from "../src/assets.ts";
import { cacheComponentsEnabled } from "../src/next-config.ts";
import type { Read } from "../src/types.ts";

beforeAll(setUpGrammars);

const read = (files: Record<string, string>): Read => (rel) => files[rel] ?? null;

const typed = `import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
};
export default nextConfig;
`;

test("literal cacheComponents true on the loaded config enables the flag", () => {
  expect(cacheComponentsEnabled(read({ "next.config.ts": typed }))).toBe(true);
  expect(cacheComponentsEnabled(read({ "next.config.js": "module.exports = { cacheComponents: true };\n" }))).toBe(true);
  expect(cacheComponentsEnabled(read({ "next.config.mjs": "export default { \"cacheComponents\": true };\n" }))).toBe(true);
  expect(cacheComponentsEnabled(read({ "next.config.ts": "export default { cacheComponents: true as const };\n" }))).toBe(true);
  expect(cacheComponentsEnabled(read({ "next.config.ts": "const nextConfig = { cacheComponents: true } satisfies Record<string, unknown>;\nexport default nextConfig;\n" }))).toBe(true);
  expect(cacheComponentsEnabled(read({ "next.config.js": "const nextConfig = { cacheComponents: true };\nmodule.exports = nextConfig;\n" }))).toBe(true);
});

test("the first existing config file decides, and lookalikes stay off", () => {
  expect(cacheComponentsEnabled(read({}))).toBe(false);
  expect(cacheComponentsEnabled(read({
    "next.config.js": "module.exports = { cacheComponents: false };\n",
    "next.config.ts": "export default { cacheComponents: true };\n",
  }))).toBe(false);
  expect(cacheComponentsEnabled(read({ "next.config.ts": "export default { experimental: { cacheComponents: true } };\n" }))).toBe(false);
  expect(cacheComponentsEnabled(read({ "next.config.ts": "// cacheComponents: true\nexport default { cacheComponents: false };\n" }))).toBe(false);
  expect(cacheComponentsEnabled(read({ "next.config.ts": "const on = true;\nexport default { cacheComponents: on };\n" }))).toBe(false);
  expect(cacheComponentsEnabled(read({ "next.config.ts": "export default { cacheComponents: \"true\" };\n" }))).toBe(false);
  expect(cacheComponentsEnabled(read({ "next.config.mts": "export default { cacheComponents: true };\n" }))).toBe(false);
  expect(cacheComponentsEnabled(read({
    "next.config.ts": "const example = { cacheComponents: true };\nexport default { cacheComponents: false };\n",
  }))).toBe(false);
});
