import { expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { compile } from "../src/compile.ts";
import { readTree } from "../src/disk.ts";
import { ruleLanguages } from "../src/languages.ts";
import { contract } from "../src/message.ts";
import { removeSelection } from "../src/pack-compose.ts";
import { VERSIONS } from "../src/versions.ts";
import type { Check, Files, Lock, Manifest, Preset } from "../src/types.ts";

const root = join(import.meta.dir, "..");
const namespaces = readdirSync(join(root, "packs")).filter((ns) => existsSync(join(root, "packs", ns, "source.json"))).sort();
const files: Record<string, Files> = Object.fromEntries(namespaces.map((ns) => [ns, readTree(join(root, "packs", ns), false)]));
const core = readTree(join(root, "catalog"), false);
const manifests: Manifest[] = namespaces.flatMap((ns) => Object.entries(files[ns]!)
  .filter(([path]) => /^methodologies\/[^/]+\.json$/.test(path)).map(([, text]) => JSON.parse(text) as Manifest));
const checks = new Map<string, Check>(namespaces.flatMap((ns) => Object.entries(files[ns]!)
  .filter(([path]) => path.endsWith("/check.json")).map(([, text]) => { const c = JSON.parse(text) as Check; return [c.id, c] as const; })));
const aliases = manifests.flatMap((m) => m.invariants.map((alias) => ({ fqn: `${m.id.split("/")[0]}/${alias.id}`, methodology: m.id, alias, check: checks.get(alias.check)! })));
const byFqn = new Map(aliases.map((a) => [a.fqn, a]));
type Pair = [string, string];

function related(a: string, b: string): boolean {
  return (byFqn.get(a)!.alias.relations ?? []).some((r) => r.with === b && r.kind !== "idiom");
}
function compileWith(methodologies: string[], extra: Partial<Preset> = {}): { lock: Lock } | { errors: string[] } {
  const ns = [...new Set(methodologies.map((m) => m.split("/")[0]!))];
  const preset: Preset = { name: "relations", version: "1.0.0", engine: VERSIONS.engine,
    sources: [{ ns: "core", kind: "builtin", version: VERSIONS.core }, ...ns.map((n) => ({ ns: n, kind: "path" as const, path: `packs/${n}` }))],
    methodologies, ...extra };
  return compile(JSON.stringify(preset), (s) => (s.kind === "builtin" ? core : files[s.ns] ?? null), VERSIONS);
}

// Two different rules that measure or forbid the same thing on the same files report twice and
// can disagree on thresholds; nothing in compilation groups them, so the packs must say so.
function overlaps(): Pair[] {
  const out: Pair[] = [];
  for (const [i, a] of aliases.entries()) for (const b of aliases.slice(i + 1)) {
    if (a.methodology === b.methodology) continue;
    if (a.check.id === b.check.id && a.check.cardinality === "singleton") continue;
    if (!ruleLanguages(a.check).some((l) => ruleLanguages(b.check).includes(l))) continue;
    const [x, y] = [a.check.impl, b.check.impl];
    if (x.kind !== "primitive" || y.kind !== "primitive" || x.primitive !== y.primitive) continue;
    const same = x.primitive === "metric" ? x.metric === (y as typeof x).metric
      : x.primitive === "layer-edge" ? true
      : x.primitive === "banned-import" ? ((a.alias.defaults.packages ?? []) as string[]).some((p) => ((b.alias.defaults.packages ?? []) as string[]).includes(p))
      : false;
    if (same) out.push([a.fqn, b.fqn]);
  }
  return out;
}

test("every relation names an existing rule or pack and is declared from both sides", () => {
  const problems: string[] = [];
  for (const a of aliases) for (const r of a.alias.relations ?? []) {
    if (r.kind === "idiom") { if (!namespaces.includes(r.with)) problems.push(`${a.fqn}: unknown pack ${r.with}`); continue; }
    const other = byFqn.get(r.with);
    if (!other) problems.push(`${a.fqn}: unknown rule ${r.with}`);
    else if (!(other.alias.relations ?? []).some((back) => back.with === a.fqn && back.kind === r.kind)) problems.push(`${r.with} does not declare ${r.kind} ${a.fqn}`);
  }
  expect(problems).toEqual([]);
});

test("rules with overlapping metrics, layer edges or banned packages declare their relation", () => {
  const missing = overlaps().filter(([a, b]) => !related(a, b) || !related(b, a)).map((p) => p.join(" <-> "));
  expect(missing).toEqual([]);
});

test("methodologies that configure one singleton check differently declare a conflict hint", () => {
  const missing: string[] = [];
  for (const [i, a] of aliases.entries()) for (const b of aliases.slice(i + 1)) {
    if (a.check.id !== b.check.id || a.check.cardinality !== "singleton" || a.methodology === b.methodology) continue;
    if (JSON.stringify(a.alias.defaults) === JSON.stringify(b.alias.defaults) && a.alias.severity === b.alias.severity) continue;
    const hinted = (from: string, to: string) => manifests.find((m) => m.id === from)!.conflicts.some((c) => c.with === to && c.dimension === a.check.dimension);
    if (!hinted(a.methodology, b.methodology) || !hinted(b.methodology, a.methodology)) missing.push(`${a.fqn} <-> ${b.fqn}`);
  }
  expect(missing).toEqual([]);
});

test("an active contradiction blocks compilation until the preset records a reviewed decision", () => {
  const blocked = compileWith(["typescript/async-results", "trpc/client"]);
  expect("errors" in blocked && blocked.errors.join("\n")).toContain("trpc/TRPC-ERR-001 contradicts typescript/TS-THROW-001");
  const settled = compileWith(["typescript/async-results", "trpc/client"], {
    settled: [{ rules: ["trpc/TRPC-ERR-001", "typescript/TS-THROW-001"], note: "Routers are excluded from TS-THROW-001." }],
  });
  if ("errors" in settled) throw new Error(settled.errors.join("\n"));
  expect(settled.lock.relations?.find((r) => r.kind === "contradicts")).toMatchObject({
    rules: ["trpc/TRPC-ERR-001", "typescript/TS-THROW-001"], note: "Routers are excluded from TS-THROW-001.",
  });
  const off = compileWith(["typescript/async-results", "trpc/client"], { overrides: { "trpc/TRPC-ERR-001": "off" } });
  expect("lock" in off && off.lock.relations).toBeUndefined();
});

test("duplicates and framework idioms compile, stay in the lock and appear in preset show", () => {
  const compiled = compileWith(["clean-code/clean-code", "mattpocock/design", "python/quality", "typescript/discipline", "nextjs/routing"]);
  if ("errors" in compiled) throw new Error(compiled.errors.join("\n"));
  const kinds = compiled.lock.relations!.map((r) => `${r.rules.join(" ")} ${r.kind}`);
  expect(kinds).toContain("clean-code/CC-FN-002 mattpocock/MP-PARAMS-001 duplicates");
  expect(kinds.some((k) => k.includes("python/"))).toBe(false);
  expect(kinds).toContain("typescript/TS-AWAIT-001 nextjs idiom");
  const shown = contract(compiled.lock, "pregate");
  expect(shown).toContain("Rule interactions declared by the packs:");
  expect(shown).toContain("- typescript/TS-AWAIT-001 works against nextjs conventions:");
  const alone = compileWith(["clean-code/clean-code"]);
  expect("lock" in alone && alone.lock.relations).toBeUndefined();
});

test("settled names exactly two declared rules and is dropped with a removed pack", () => {
  const unknown = compileWith(["clean-code/clean-code"], { settled: [{ rules: ["clean-code/CC-FN-001", "python/PY-NOPE-001"], note: "x" }] });
  expect("errors" in unknown && unknown.errors.join("\n")).toContain("settled[0].rules: python/PY-NOPE-001 is not declared by any source");
  const preset: Preset = { name: "p", version: "1.0.0", engine: VERSIONS.engine,
    sources: [{ ns: "core", kind: "builtin", version: VERSIONS.core }, { ns: "typescript", kind: "path", path: "packs/typescript" }, { ns: "trpc", kind: "path", path: "packs/trpc" }],
    methodologies: ["typescript/async-results", "trpc/client"], settled: [{ rules: ["trpc/TRPC-ERR-001", "typescript/TS-THROW-001"], note: "n" }] };
  const removed = removeSelection(preset, manifests, "trpc", true);
  expect("errors" in removed ? removed.errors : removed.settled).toBeUndefined();
});

test("published presets compile with their declared interactions settled", () => {
  for (const dir of ["packs/presets", "catalog/presets"]) for (const name of readdirSync(join(root, dir)).filter((f) => f.endsWith(".json"))) {
    const text = readFileSync(join(root, dir, name), "utf8");
    const out = compile(text, (s) => (s.kind === "builtin" ? core : s.kind === "path" ? readTree(join(root, s.path), false) : files[s.ns] ?? null), VERSIONS);
    expect("errors" in out ? `${name}: ${out.errors.join("\n")}` : name).toBe(name);
  }
});
