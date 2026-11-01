import { beforeAll, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fixtureLock } from "../src/compile.ts";
import { analyze } from "../src/evaluate.ts";
import { clock, grammars } from "../src/gate.ts";
import type { Check } from "../src/types.ts";

beforeAll(grammars);

function findings(name: string, source: string, path = "src/query.ts") {
  const check = JSON.parse(readFileSync(`packs/vibe-proof/checks/security/${name}/check.json`, "utf8")) as Check;
  const out = analyze(fixtureLock(check, {}, undefined), "pre", path, source, { now: clock, read: () => null });
  if ("cause" in out) throw new Error(out.cause);
  return out.violations;
}

test.each([
  ["public issue27 example", "export async function run(tx: { query(text: string, values: unknown[]): Promise<unknown> }, execute: (tx: unknown, scope: string) => Promise<unknown>, id: string, key: string) { await tx.query('select 1 where id = $1', [id]); return execute(tx, `api:${id}:${key}`); }"],
  ["transaction callback and second scope argument", "db.transaction(async tx => input.execute(tx, `operation:${id}:${key}`));"],
  ["nested ordinary callback", "db.execute(() => `operation:${id}`);"],
  ["bound values", "db.query('select id from items where id = $1', [id]);"],
  ["static template and separate values", "db.query(`select id from items where id = $1`, [id]);"],
  ["interpolation in another argument", "db.query('select $1', [`label:${id}`]);"],
  ["comment interpolation marker", "db.query('select 1' /* ${id} */);"],
  ["escaped interpolation marker", "db.query(`select '\\${id}'`);"],
  ["method-like data", "record.log('.query(', `scope:${id}`);"],
])("issue27 ordinary arguments pass: %s", (_name, source) => {
  expect(findings("sql-interpolation", source)).toHaveLength(0);
});

test.each([
  ["query", "db.query(`select id from items where id = ${id}`);"],
  ["execute", "db.execute(`delete from items where id = ${id}`);"],
  ["raw", "db.raw(`select ${id}`);"],
  ["unsafe", "db.unsafe(`select ${id}`);"],
  ["parenthesized SQL", "db.query((`select ${id}`));"],
  ["typed SQL", "db.query((`select ${id}` as string));"],
  ["non-null SQL", "db.query(`select ${id}`!);"],
  ["satisfies SQL", "db.query(`select ${id}` satisfies string);"],
  ["spaced member with leading comment", "db . query(/* actual SQL */ `select ${id}`, [id]);"],
  ["nested actual SQL call", "db.transaction(tx => tx.query(`select ${id}`));"],
  ["two nested actual SQL calls", "db.transaction(async tx => { await tx.query(`select ${id}`); return tx.execute(`select ${key}`); });"],
])("issue27 direct unsafe SQL remains a finding: %s", (name, source) => {
  expect(findings("sql-interpolation", source)).toHaveLength(name === "two nested actual SQL calls" ? 2 : 1);
});

test("issue29 public classify.test.ts reproduction passes", () => {
  const source = "import { expect, it } from 'vitest'; it('classifies', () => { expect('postgresql://postgres:secret@db.example.supabase.co:5432/postgres').toContain('5432'); });";
  expect(findings("hardcoded-secret", source, "classify.test.ts")).toHaveLength(0);
});

test.each(["secret", "password", "changeme"])("issue29 exact static %s URL password passes only in tests", password => {
  for (const quote of ["'", '"', "`"]) {
    const source = `const fixture = ${quote}postgresql://user:${password}@db.invalid:5432/example${quote};`;
    for (const path of ["src/classify.test.ts", "src/classify.spec.ts", "src/classify.test.tsx"]) {
      expect(findings("hardcoded-secret", source, path)).toHaveLength(0);
    }
    expect(findings("hardcoded-secret", source, "src/config.ts")).toHaveLength(1);
  }
});

test.each([
  ["real-looking test password", "const fixture = 'postgresql://user:r3aL_9c7Password@db.invalid/example';"],
  ["placeholder prefix", "const fixture = 'postgresql://user:secret123@db.invalid/example';"],
  ["placeholder case variation", "const fixture = 'postgresql://user:Secret@db.invalid/example';"],
  ["encoded placeholder", "const fixture = 'postgresql://user:%73ecret@db.invalid/example';"],
  ["interpolated host", "const fixture = `postgresql://user:secret@${host}/example`;"],
  ["credential URL in comment", "// postgresql://user:secret@db.invalid/example"],
  ["mixed real and placeholder URLs", "const fixture = 'postgresql://user:secret@db.invalid/example postgresql://user:r3aL_9c7Password@db.invalid/example';"],
  ["real URL nested in placeholder URL", "const fixture = 'postgresql://user:secret@db.invalid/example?fallback=postgresql://user:r3aL_9c7Password@other.invalid/example';"],
  ["private key beside placeholder URL", "const fixture = 'postgresql://user:secret@db.invalid/example BEGIN PRIVATE KEY';"],
])("issue29 credentials retain findings in tests: %s", (_name, source) => {
  expect(findings("hardcoded-secret", source, "src/classify.test.ts").length).toBeGreaterThan(0);
});

test.each([
  ["stripe", "sk_live_" + "a".repeat(24)],
  ["github", "ghp_" + "a".repeat(24)],
  ["github fine-grained", "github_pat_" + "a".repeat(24)],
  ["aws", "AKIA" + "A".repeat(16)],
  ["slack", "xoxb-" + "a".repeat(16)],
  ["private key", "BEGIN PRIVATE KEY"],
])("issue29 %s stays active in literals, templates and comments", (_name, token) => {
  for (const source of [`const value = '${token}';`, `const value = \`${token}\`;`, `// ${token}`,
    `const value = 'postgresql://user:secret@db.invalid/example ${token}';`]) {
    expect(findings("hardcoded-secret", source, "src/classify.test.ts").length).toBeGreaterThan(0);
  }
});
