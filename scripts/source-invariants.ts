// Preserve each authored clause; a range is one obligation with multiple ledger entries.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
export interface SourceInvariant {
  ns: "maintainability" | "pstack"; id: string; method: string;
  statement: string; path: string; line: number; entries: string[];
}
const statement = (text: string) => text.replace(/\s+\*\([^\n]*\)\*$/, "").replaceAll("**", "").trim();
export function sourceInvariants(): SourceInvariant[] {
  const result: SourceInvariant[] = [];
  const maintenance = "packs/maintainability/INVARIANTS.md";
  for (const [i, line] of readFileSync(join(root, maintenance), "utf8").split(/\r?\n/).entries()) {
    const m = /^- \*\*((FH|SE)-\d{2,3}):\*\* (.+)$/.exec(line);
    if (m) result.push({ ns: "maintainability", id: m[1]!, method: m[2] === "FH" ? "future-humans" : "engineering",
      statement: statement(m[3]!), path: maintenance, line: i + 1, entries: [m[1]!] });
  }
  const pstack = "packs/pstack/INVARIANTS.md";
  for (const [i, line] of readFileSync(join(root, pstack), "utf8").split(/\r?\n/).entries()) {
    const m = /^(\d{1,3})(?:[–-](\d{1,3}))?\.\s+(.+)$/.exec(line);
    if (!m) continue;
    const first = Number(m[1]), last = Number(m[2] ?? m[1]);
    if (first < 1 || last > 113 || first > last || (first <= 70 && last !== first)) throw new Error(`Invalid pstack range on line ${i + 1}.`);
    const entries = Array.from({ length: last - first + 1 }, (_, at) => `PS-${String(first + at).padStart(2, "0")}`);
    result.push({ ns: "pstack", id: `PS-${String(first).padStart(2, "0")}${last === first ? "" : `-${last}`}`,
      method: first <= 23 ? "principles" : first <= 47 ? "operations" : first <= 70 ? "playbooks" : "workspace",
      statement: statement(m[3]!), path: pstack, line: i + 1, entries });
  }
  const ids = result.flatMap(r => r.entries);
  if (result.length !== 286 || ids.length !== 313 || new Set(ids).size !== 313) throw new Error("Expected 286 authored clauses and 313 distinct source entries.");
  for (const [prefix, count] of [["FH", 100], ["SE", 100], ["PS", 113]] as const) {
    const expected = Array.from({ length: count }, (_, i) => `${prefix}-${String(i + 1).padStart(2, "0")}`);
    if (expected.some(id => !ids.includes(id))) throw new Error(`Missing ${prefix} source entry.`);
  }
  return result;
}

export const evidenceCheck = (r: SourceInvariant) => `${r.ns}/${r.method}/${r.id.toLowerCase()}`;

if (import.meta.main) {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && args[0] !== "--check")) throw new Error("Usage: bun scripts/source-invariants.ts [--check]");
  const checking = args[0] === "--check", dirty: string[] = [], rules = sourceInvariants();
  function emit(path: string, value: object) {
    const target = join(root, path), text = JSON.stringify(value, null, 2) + "\n";
    if (existsSync(target) && readFileSync(target, "utf8").replaceAll("\r\n", "\n") === text) return;
    if (checking) { dirty.push(path); return; }
    mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, text);
  }
  const methods = new Map<string, object[]>();
  for (const r of rules) {
    const check = evidenceCheck(r), base = `packs/${r.ns}/checks/${r.method}/${r.id.toLowerCase()}`;
    emit(`${base}/check.json`, { id: check, version: "1.0.0", area: r.method, cardinality: "singleton", dimension: `${r.ns}.${r.id.toLowerCase()}`,
      minSeverity: "deny", params: { verifier: { type: "string", pattern: "\\S" } },
      impl: { kind: "primitive", primitive: "fitness", requirement: r.id }, phase: ["stop", "commit", "ci"],
      feedback: { message: `${r.id} requires current passing project verification: {symbol}.` } });
    for (const fixture of ["pass/current-inputs", "pass/new-contract", "fail/no-evidence", "fail/failed-verification", "trap/stale-inputs"]) {
      const contractHash = fixture === "pass/new-contract" ? "reviewed-contract-v2" : "reviewed-contract-v1";
      const receipt = fixture === "fail/no-evidence" ? null : { schemaVersion: 1, contractHash,
        inputHash: fixture === "trap/stale-inputs" ? "old-project-inputs" : "current-project-inputs", verifier: r.id,
        command: ["fixture-verifier"], exitCode: fixture === "fail/failed-verification" ? 1 : 0, completed: true, recordedAt: "2026-10-05T00:00:00Z" };
      emit(`${base}/fixtures/${fixture}/fixture.json`, { language: "typescript", params: { verifier: r.id },
        context: { fitness: { contractHash, inputHash: "current-project-inputs", command: ["fixture-verifier"], receipt } }, target: ".pregate/preset.json", before: null,
        expect: fixture.startsWith("pass/") ? { verdict: "pass" } : { verdict: "fail", violations: [{ line: 1 }] },
        ...(fixture.startsWith("trap/") ? { trap: { family: "stale-source-invariant-evidence", origin: "forge", discovered: "2026-10-05",
          note: "A prior passing assertion cannot admit changed project inputs." } } : {}) });
      emit(`${base}/fixtures/${fixture}/files/.pregate/preset.json.fixture`, { requirement: r.id });
    }
    const key = `${r.ns}/${r.method}`, invariants = methods.get(key) ?? [];
    invariants.push({ id: r.id, check, defaults: { verifier: r.id }, severity: "deny",
      source: { work: r.ns === "maintainability" ? "User-requested future-human and software-engineering invariant catalog" : "User-requested pstack and installed-workflow invariant catalog",
        locator: `${r.path}:${r.line}; ${r.entries.join(", ")}`, paraphrase: r.statement }, why: r.statement,
      fixHint: `Bind ${r.id} to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run ${r.id}; repair failed evidence or propose a bounded adaptation that preserves the requirement.`,
      avoid: `This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. ${r.entries.length > 1 ? `The source groups ${r.entries.join(", ")} in one clause; one assertion must cover the complete group, not one selected sentence. ` : ""}Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.`,
      examples: { pass: "pass/current-inputs", fail: "fail/no-evidence" } });
    methods.set(key, invariants);
  }
  for (const [key, invariants] of methods) {
    const [ns, method] = key.split("/");
    emit(`packs/${ns}/methodologies/${method}.json`, { $schema: "../../../schema/methodology.v1.json", id: key,
      version: "1.0.0", status: "preview", conflicts: [], invariants });
  }
  // The pack version is released by hand; regeneration keeps it.
  const versionOf = (ns: string) => {
    const path = join(root, `packs/${ns}/source.json`);
    return existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as { version: string }).version : "1.0.0";
  };
  for (const ns of ["maintainability", "pstack"]) emit(`packs/${ns}/source.json`, {
    $schema: "../../schema/source.v1.json", ns, category: ns === "maintainability" ? "practice" : "process", version: versionOf(ns) });
  if (dirty.length) { console.error(`Source invariant packs are stale:\n${dirty.join("\n")}\nRun bun scripts/source-invariants.ts.`); process.exitCode = 1; }
  else console.log(`${checking ? "Verified" : "Generated"} 286 optional evidence obligations in six methodologies: 200 maintainability clauses and 86 pstack clauses preserve all 313 ledger entries; 1,430 receipt fixtures. Project semantics require reviewed assertions.`);
}
