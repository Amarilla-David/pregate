// Preserve the supplied requirements as optional, individually bindable evidence gates.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const checking = process.argv.includes("--check"), dirty: string[] = [];
const packs = [
  { ns: "enterprise-ready", prefix: "ENTERPRISE", count: 57, category: "invariants" },
  { ns: "consumer-saas", prefix: "CONSUMER", count: 39, category: "invariants" },
  { ns: "next-website", prefix: "NEXT-WEBSITE", count: 54, category: "library" },
  { ns: "vercel", prefix: "VERCEL", count: 15, category: "library" },
  { ns: "agent-practices", prefix: "PRACTICE", count: 22, category: "practice" },
  { ns: "design-invariants", prefix: "DESIGN", count: 48, category: "invariants" },
] as const;
const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
function emit(path: string, value: object) {
  const target = join(root, path), text = JSON.stringify(value, null, 2) + "\n";
  if (existsSync(target) && readFileSync(target, "utf8").replaceAll("\r\n", "\n") === text) return;
  if (checking) { dirty.push(path); return; }
  mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, text);
}
const qualifications: Record<number, string> = {
  7: "Ordinary Hooks run at the top level of function components or custom Hooks. Apply React's separate documented rules for the use API. https://react.dev/reference/rules/rules-of-hooks; https://react.dev/reference/react/use",
  22: "Evaluate request-time data under the installed Next.js version and enabled cache model. With Cache Components it can stream behind Suspense alongside a static shell; do not require the whole route to become dynamic. https://nextjs.org/docs/app/getting-started/caching",
  24: "Each reachable endpoint has a page or Route Handler. Structural directories and route groups are not endpoints. Do not place page.tsx and route.ts at the same segment. https://nextjs.org/docs/app/getting-started/route-handlers",
};
const vercelSources: Record<string, string> = {
  configuration: "https://vercel.com/docs/project-configuration",
  environment: "https://vercel.com/docs/environment-variables",
  protection: "https://vercel.com/docs/deployment-protection",
  cron: "https://vercel.com/docs/cron-jobs/manage-cron-jobs",
  functions: "https://vercel.com/docs/functions",
  recovery: "https://vercel.com/docs/instant-rollback",
};
const practiceSources: Record<string, string> = {
  "launch-safety": "User-supplied launch-risk post, qualified by the authoritative sources and selected privacy policies in the feature document",
  "security-review": "Google Mantis README and reproduce/patch skills at 2b3bbdcbb8d259d1777b89dcfa3c8e87615ccc80; https://github.com/google/mantis/tree/2b3bbdcbb8d259d1777b89dcfa3c8e87615ccc80",
  "domain-ownership": "User-supplied AGENTS.md design post, hard invariants 10–12 and refactor-first workflow",
  "behavior-testing": "User-supplied testing-strategy post, adapted to behavioral verification and applicable test scope",
};
for (const pack of packs) {
  const input = `docs/features/${pack.ns}-pack.md`;
  const document = readFileSync(join(root, input), "utf8").split("## Requested invariant rules")[1];
  if (!document) throw new Error("Missing original requirements: " + input);
  let area = "", sequence = 0;
  const categories = new Map<string, object[]>();
  for (const line of document.split(/\r?\n/)) {
    if (line.startsWith("### ")) { area = slug(line.slice(4)); continue; }
    const rule = /^(\d+)\. (.+)$/.exec(line);
    if (!rule) continue;
    if (!area || Number(rule[1]) !== ++sequence) throw new Error("Non-consecutive requirements: " + input);
    const original = rule[2]!;
    const id = `${pack.prefix}-${String(sequence).padStart(3, "0")}`;
    const name = `requirement-${String(sequence).padStart(3, "0")}`, check = `${pack.ns}/${area}/${name}`;
    const base = `packs/${pack.ns}/checks/${area}/${name}`;
    const qualified = pack.ns === "next-website" ? qualifications[sequence] : undefined;
    const why = qualified ?? original;
    emit(`${base}/check.json`, { id: check, version: "1.0.0", area, cardinality: "singleton", dimension: `${pack.ns}.r${String(sequence).padStart(3, "0")}`, minSeverity: "deny",
      params: { verifier: { type: "string", pattern: "\\S" } }, impl: { kind: "primitive", primitive: "fitness", requirement: id }, phase: ["stop", "commit", "ci"],
      feedback: { message: `${id} requires current passing project verification: {symbol}.` } });
    for (const fixture of ["pass/current-inputs", "pass/new-contract", "fail/no-evidence", "fail/failed-verification", "trap/stale-inputs"]) {
      const contractHash = fixture === "pass/new-contract" ? "reviewed-contract-v2" : "reviewed-contract-v1";
      const receipt = fixture === "fail/no-evidence" ? null : { schemaVersion: 1, contractHash,
        inputHash: fixture === "trap/stale-inputs" ? "old-code-tree" : "current-code-tree", verifier: id, command: ["fixture-verifier"],
        exitCode: fixture === "fail/failed-verification" ? 1 : 0, completed: true, recordedAt: "2026-10-05T00:00:00Z" };
      emit(`${base}/fixtures/${fixture}/fixture.json`, { language: "typescript", params: { verifier: id }, context: { fitness: { contractHash, inputHash: "current-code-tree", command: ["fixture-verifier"], receipt } },
        target: ".pregate/preset.json", before: null, expect: fixture.startsWith("pass/") ? { verdict: "pass" } : { verdict: "fail", violations: [{ line: 1 }] },
        ...(fixture.startsWith("trap/") ? { trap: { family: "stale-fitness-evidence", origin: "forge", discovered: "2026-10-05", note: "A prior passing assertion must not admit changed product inputs." } } : {}) });
      emit(`${base}/fixtures/${fixture}/files/.pregate/preset.json.fixture`, { requirement: id });
    }
    const invariants = categories.get(area) ?? [];
    const work = pack.ns === "agent-practices" ? practiceSources[area]! : pack.ns === "vercel" ? "Vercel official documentation and explicitly selected project policy" : pack.ns === "design-invariants" ? "User-supplied software design invariants" : "User-supplied product invariants";
    invariants.push({ id, check, defaults: { verifier: id }, severity: "deny", source: { work, locator: pack.ns === "agent-practices" ? `${input}, rule ${sequence}; interpretation/provenance and evidence ledger; reviewed 2026-10-07` : pack.ns === "vercel" ? `${vercelSources[area]}; checked 2026-10-05; ${input}, rule ${sequence}` : `${input}, rule ${sequence}`, paraphrase: original }, why,
      fixHint: `Bind ${id} to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run ${id}; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.`,
      avoid: "This is a project evidence gate, not a syntax detector or readiness certification. A receipt proves only the reviewed assertion ran on the current inputs. External legal, certification, deployment and performance evidence needs its own authenticity, scope and freshness checks inside that assertion. Missing evidence remains unverified. Pack fixtures test receipt admission, not the product requirement. Packs never supply executable commands.",
      examples: { pass: "pass/current-inputs", fail: "fail/no-evidence" } });
    categories.set(area, invariants);
  }
  if (sequence !== pack.count) throw new Error(`Expected ${pack.count} requirements in ${input}, found ${sequence}.`);
  emit(`packs/${pack.ns}/source.json`, { $schema: "../../schema/source.v1.json", ns: pack.ns, version: "1.0.0", category: pack.category });
  const selections = pack.ns === "vercel" || pack.ns === "agent-practices" || pack.ns === "design-invariants" ? categories : new Map([["readiness", [...categories.values()].flat()]]);
  for (const [method, invariants] of selections) emit(`packs/${pack.ns}/methodologies/${method}.json`, { $schema: "../../../schema/methodology.v1.json", id: `${pack.ns}/${method}`, version: "1.0.0", status: "preview", conflicts: [], invariants });
  console.log(`${checking ? "Verified" : "Generated"} ${pack.ns}: ${sequence} requirements, ${categories.size} categories and ${sequence * 5} receipt fixtures. Product semantics require reviewed project assertions.`);
}
if (dirty.length) { console.error(`Readiness packs are stale:\n${dirty.join("\n")}\nRun bun scripts/readiness-packs.ts.`); process.exitCode = 1; }
