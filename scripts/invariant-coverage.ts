import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { evidenceCheck, sourceInvariants } from "./source-invariants.ts";

const root = resolve(import.meta.dir, "..");
const output = join(root, "packs/invariant-coverage.json");

interface Reference {
  alias: string;
  exists: boolean;
}

interface Entry {
  id: string;
  text: string;
  source: { path: string; line: number; grouped: boolean };
  references: Reference[];
  status: "existing-slice" | "candidate" | "workflow";
  evidence?: { alias: string; check: string; kind: "project-fitness"; exists: boolean };
}

function lines(path: string): string[] {
  return readFileSync(join(root, path), "utf8").split(/\r?\n/);
}

const aliases = new Set<string>();
for (const base of ["catalog", "packs"]) {
  const sources = base === "catalog" ? ["catalog"] : readdirSync(join(root, "packs"));
  for (const source of sources) {
    const dir = join(root, base === "catalog" ? base : `${base}/${source}`, "methodologies");
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir).filter((name) => name.endsWith(".json"))) {
      const manifest = JSON.parse(readFileSync(join(dir, file), "utf8"));
      for (const invariant of manifest.invariants) aliases.add(`${manifest.id.split("/")[0]}/${invariant.id}`);
    }
  }
}

function references(text: string): Reference[] {
  const found = [...text.matchAll(/`([a-z][a-z0-9-]*\/[A-Z][A-Z0-9-]+)`/g)];
  return found.map((match) => ({ alias: match[1]!, exists: aliases.has(match[1]!) }));
}

const entries: Entry[] = [];
const maintenancePath = "packs/maintainability/INVARIANTS.md";
for (const [index, line] of lines(maintenancePath).entries()) {
  const match = /^- \*\*((?:FH|SE)-(\d{2,3})):\*\* (.+)$/.exec(line);
  if (!match) continue;
  const refs = references(line);
  entries.push({
    id: match[1]!,
    text: match[3]!,
    source: { path: maintenancePath, line: index + 1, grouped: false },
    references: refs,
    status: refs.some((ref) => ref.exists) ? "existing-slice" : "candidate",
  });
}

const pstackPath = "packs/pstack/INVARIANTS.md";
for (const [index, line] of lines(pstackPath).entries()) {
  const match = /^(\d{1,3})(?:[–-](\d{1,3}))?\.\s+(.+)$/.exec(line);
  if (!match) continue;
  const first = Number(match[1]);
  const last = Number(match[2] ?? match[1]);
  if (first < 1 || last > 113 || first > last) throw new Error(`Unexpected PS range on line ${index + 1}`);
  const refs = references(line);
  for (let number = first; number <= last; number++) {
    entries.push({
      id: `PS-${String(number).padStart(2, "0")}`,
      text: match[3]!,
      source: { path: pstackPath, line: index + 1, grouped: first !== last },
      references: refs,
      status: number > 23 ? "workflow" : refs.some((ref) => ref.exists) ? "existing-slice" : "candidate",
    });
  }
}

for (const [prefix, count] of [["FH", 100], ["SE", 100], ["PS", 113]] as const) {
  const actual = entries.filter((entry) => entry.id.startsWith(`${prefix}-`));
  if (actual.length !== count || new Set(actual.map((entry) => entry.id)).size !== count)
    throw new Error(`Expected ${count} distinct ${prefix} entries; found ${actual.length}`);
}

const unresolvedClaims = entries.flatMap((entry) => entry.references).filter((ref) => !ref.exists);
if (unresolvedClaims.length) throw new Error(`Unknown rule aliases: ${unresolvedClaims.map((ref) => ref.alias).join(", ")}`);

const requirements = sourceInvariants();
for (const entry of entries) {
  const owner = requirements.find(r => r.entries.includes(entry.id));
  if (!owner) throw new Error(`Missing evidence owner for ${entry.id}.`);
  const alias = `${owner.ns}/${owner.id}`, check = evidenceCheck(owner);
  const definition = JSON.parse(readFileSync(join(root, `packs/${owner.ns}/checks/${check.split("/").slice(1).join("/")}/check.json`), "utf8"));
  const exists = aliases.has(alias) && definition.id === check && definition.impl.kind === "primitive"
    && definition.impl.primitive === "fitness" && definition.impl.requirement === owner.id;
  if (!exists) throw new Error(`Missing or incorrect project-evidence rule ${alias}.`);
  entry.evidence = { alias, check, kind: "project-fitness", exists };
}

const document = {
  version: 2,
  note: "status/references describe existing syntactic slices or workflow provenance, not semantic proof. evidence identifies an optional enforcing project-fitness owner for each complete source clause. The 313 ledger entries map to 286 authored clauses: grouped PS entries share one obligation and require proof of the whole group. Missing project evidence remains unverified.",
  entries,
};
const serialized = JSON.stringify(document, null, 2) + "\n";
if (process.argv.includes("--check")) {
  if (!existsSync(output) || readFileSync(output, "utf8").replaceAll("\r\n", "\n") !== serialized) {
    console.error("Invariant coverage is stale. Run bun scripts/invariant-coverage.ts.");
    process.exitCode = 1;
  }
} else {
  await Bun.write(output, serialized);
}

const summary = entries.reduce(
  (acc, entry) => ({ ...acc, [entry.status]: acc[entry.status] + 1 }),
  { "existing-slice": 0, candidate: 0, workflow: 0 },
);
console.log({ total: entries.length, ...summary, grouped: entries.filter((entry) => entry.source.grouped).length,
  unresolvedClaims: unresolvedClaims.length });
