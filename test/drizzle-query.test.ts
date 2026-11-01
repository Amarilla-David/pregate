import { beforeAll, expect, test } from "bun:test";
import { fixtureLock } from "../src/compile.ts";
import { analyze } from "../src/evaluate.ts";
import { clock, grammars } from "../src/gate.ts";
import { librarySource } from "../src/library.ts";
import type { Check, Files } from "../src/types.ts";

beforeAll(grammars);
const schema = `import { pgTable, text, uniqueIndex, primaryKey, unique } from "drizzle-orm/pg-core";
export const users = pgTable("users", { id: text("id").primaryKey(), slug: text("slug").unique(), name: text("name") });
export const notes = pgTable("notes", { id: text("id").primaryKey(), userId: text("user_id"), body: text("body") });
export const profiles = pgTable("profiles", { userId: text("user_id").unique() });
export const memberships = pgTable("memberships", { tenant: text("tenant"), user: text("user") }, t => [primaryKey({columns: [t.tenant, t.user]})]);
export const indexed = pgTable("indexed", { key: text("key") }, t => ({ key: uniqueIndex("key").on(t.key) }));
export const constrained = pgTable("constrained", { key: text("key") }, t => [unique("key").on(t.key)]);
export const partial = pgTable("partial", { key: text("key") }, t => [uniqueIndex("key").on(t.key).where(sql\`active = true\`)]);
export const nonunique = pgTable("nonunique", { id: text("id"), slug: text("slug") });`;
const imports = `import { eq, and, or, inArray } from "drizzle-orm";
import { users, notes, profiles, memberships, indexed, constrained, partial, nonunique } from "./schema";
`;

function findings(source: string, files: Files = { "src/schema.ts": schema }) {
  const check = JSON.parse(librarySource("drizzle")!["checks/queries/no-unbounded-select/check.json"]!) as Check;
  const out = analyze(fixtureLock(check, {}, undefined), "pre", "src/query.ts", source, { now: clock, read: rel => files[rel] ?? null });
  if ("cause" in out) throw new Error(out.cause);
  return out.violations;
}

test.each([
  "eq(users.id, id)", "eq(id, users.id)", "eq(users.slug, slug)",
  "and(eq(users.id, id), eq(users.name, name))", "or(eq(users.id, id), eq(users.slug, slug))",
])("schema-proven single-column predicates pass: %s", predicate => {
  expect(findings(imports + `const rows = db.select().from(users).where(${predicate});`)).toHaveLength(0);
});

test.each([
  ["memberships", "and(eq(memberships.tenant, tenant), eq(memberships.user, user))"],
  ["indexed", "eq(indexed.key, key)"], ["constrained", "eq(constrained.key, key)"],
])("composite primary keys and unconditional unique indexes/constraints pass: %s", (table, predicate) => {
  expect(findings(imports + `const rows = db.select().from(${table}).where(${predicate});`)).toHaveLength(0);
});

test.each([
  ["users", "eq(users.name, name)"], ["nonunique", "eq(nonunique.id, id)"], ["nonunique", "eq(nonunique.slug, slug)"],
  ["memberships", "eq(memberships.tenant, tenant)"], ["partial", "eq(partial.key, key)"],
  ["users", "or(eq(users.id, id), eq(users.name, name))"], ["users", "eq(users.id, users.id)"],
  ["users", "eq(users.id, sql`id`)"], ["users", "inArray(users.id, ids)"],
])("unproved predicates remain findings: %s %s", (table, predicate) => {
  expect(findings(imports + `const rows = db.select().from(${table}).where(${predicate});`)).toHaveLength(1);
});

test.each([
  'const rows = db.select().from(users).where(inArray(users.id, ["a", "b"]));',
  'const ids = ["a", "b"]; const rows = db.select().from(users).where(inArray(users.id, ids));',
  'const ids = ["a", "b"]; const rows = db.select({id: users.id}).from(users).where(and(eq(users.name, name), inArray(users.id, ids)));',
  'function load(ids: string[]) { if (ids.length > 50) throw new Error("too many"); return db.select().from(users).where(inArray(users.id, ids)); }',
  'function load(ids: string[]) { if (ids.length >= 50) { return []; } return db.select().from(users).where(inArray(users.id, ids)); }',
  'function load(ids: string[]) { return db.select().from(users).where(inArray(users.id, ids.slice(0, 50))); }',
])("finite input budgets on a unique key pass: %s", source => {
  expect(findings(imports + source)).toHaveLength(0);
});

test.each([
  'const rows = db.select().from(users).where(inArray(users.id, [...ids]));',
  'function load(ids: string[]) { if (ids.length > 50) console.log("too many"); return db.select().from(users).where(inArray(users.id, ids)); }',
  'function load(ids: string[]) { if (ids.length > 50) throw new Error(); ids.push(...more); return db.select().from(users).where(inArray(users.id, ids)); }',
  'function load(ids: string[]) { if (ids.length > 50) throw new Error(); ids[1000] = "x"; return db.select().from(users).where(inArray(users.id, ids)); }',
  'function load(ids: string[]) { if (allowed) { if (ids.length > 50) throw new Error(); } return db.select().from(users).where(inArray(users.id, ids)); }',
  'function load(ids: string[]) { return db.select().from(users).where(inArray(users.id, ids)); if (ids.length > 50) throw new Error(); }',
  'const rows = db.select().from(nonunique).where(inArray(nonunique.id, ["a"]));',
  'const ids = ["a"]; ids.push(...more); const rows = db.select().from(users).where(inArray(users.id, ids));',
  'const ids = ["a"]; other.from(ids); const rows = db.select().from(users).where(inArray(users.id, ids));',
  'const ids = ["a"]; other.select(ids); const rows = db.select().from(users).where(inArray(users.id, ids));',
  'const ids = ["a"]; const alias = ids; other.from(alias); const rows = db.select().from(users).where(inArray(users.id, ids));',
  'const ids = ["a"]; const rows = db.select({field: other.select(ids)}).from(users).where(inArray(users.id, ids));',
  'function load(ids: string[]) { if (ids.length > 50) throw new Error(); other.from(ids); return db.select().from(users).where(inArray(users.id, ids)); }',
  'const ids = { slice: () => more }; const rows = db.select().from(users).where(inArray(users.id, ids.slice(0, 50)));',
  'function load(ids: string[]) { if (ids.length > 50) throw new Error(); return db.select({field: mutate(ids)}).from(users).where(inArray(users.id, ids)); }',
])("unvalidated or mutable inputs do not prove bounds: %s", source => {
  expect(findings(imports + source)).toHaveLength(1);
});

test("joins preserve a bound only with a unique joined key", () => {
  expect(findings(imports + 'const rows = db.select().from(users).leftJoin(profiles, eq(profiles.userId, users.id)).where(eq(users.id, id));')).toHaveLength(0);
  expect(findings(imports + 'const rows = db.select().from(users).leftJoin(notes, eq(notes.userId, users.id)).where(eq(users.id, id));')).toHaveLength(1);
  expect(findings(imports + 'const rows = db.select().from(users).rightJoin(profiles, eq(profiles.userId, users.id)).where(eq(users.id, id));')).toHaveLength(1);
});

test("helper and schema provenance follow aliases, barrels and namespace imports", () => {
  const files = { "src/schema.ts": schema, "src/barrel.ts": 'export { users as accounts } from "./schema";' };
  expect(findings('import {eq as equals} from "drizzle-orm"; import {accounts} from "./barrel"; const rows = db.select().from(accounts).where(equals(accounts.id, id));', files)).toHaveLength(0);
  expect(findings('import * as orm from "drizzle-orm"; import * as schema from "./schema"; const rows = db.select().from(schema.users).where(orm.eq(schema.users.id, id));', files)).toHaveLength(0);
});

test("lookalike/shadowed helpers and table declarations do not establish constraints", () => {
  expect(findings(imports + 'function load(eq: Function) { return db.select().from(users).where(eq(users.id, id)); }')).toHaveLength(1);
  expect(findings(imports.replace('from "drizzle-orm"', 'from "lookalike"') + 'const rows = db.select().from(users).where(eq(users.id, id));')).toHaveLength(1);
  expect(findings(imports + 'const rows = db.select().from(users).where(eq(users.id, id));', { "src/schema.ts": schema.replace('from "drizzle-orm/pg-core"', 'from "lookalike"') })).toHaveLength(1);
  expect(findings('import * as orm from "drizzle-orm"; import {users} from "./schema"; function load(orm: any) { return db.select().from(users).where(orm.eq(users.id, id)); }')).toHaveLength(1);
  expect(findings('import {eq} from "drizzle-orm"; import * as schema from "./schema"; function load(schema: any) { return db.select().from(schema.users).where(eq(schema.users.id, id)); }')).toHaveLength(1);
});

test("a bounded branch does not exempt an unbounded union", () => {
  expect(findings(imports + 'const rows = db.select().from(users).where(eq(users.id, id)).union(db.select().from(notes));')).toHaveLength(2);
});

test("changing the schema source changes the bound without cached passing verdicts", () => {
  const source = imports + 'const rows = db.select().from(users).where(eq(users.id, id));';
  expect(findings(source)).toHaveLength(0);
  expect(findings(source, { "src/schema.ts": schema.replace('.primaryKey()', '') })).toHaveLength(1);
});

test("cyclic scalar aliases do not recurse indefinitely", () => {
  expect(findings(imports + 'const a = b; const b = a; const rows = db.select().from(users).where(eq(users.id, a));')).toHaveLength(1);
});
