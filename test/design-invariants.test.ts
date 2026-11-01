import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { BUILTIN } from "../src/assets.ts";
import { compile, listChecks } from "../src/compile.ts";
import { readTree } from "../src/disk.ts";
import { testCheck } from "../src/fixtures.ts";
import { clock, VERSIONS } from "../src/gate.ts";
import type { Preset } from "../src/types.ts";

const doc = readFileSync("docs/features/design-invariants-pack.md", "utf8");
const [pre, post] = doc.split("## Requested invariant rules");
const rows = [...pre!.matchAll(/^\| (\d+) \| [^|]+ \| ([^|]+) \|/gm)].map((match) => ({
  n: Number(match[1]), owners: [...match[2]!.matchAll(/DESIGN-\d{3}|CORE-INV-\d{3}/g)].map((id) => id[0]),
}));
const requested = [...post!.matchAll(/^(\d+)\. (.+)$/gm)].map((match) => match[2]!);
const designId = (n: number) => `DESIGN-${String(n).padStart(3, "0")}`;

test("the ledger assigns every supplied statement and the pack gates match it", () => {
  expect(rows.map((row) => row.n)).toEqual(Array.from({ length: 104 }, (_, n) => n + 1));
  expect(rows.every((row) => row.owners.length > 0)).toBe(true);
  const seen: string[] = [];
  let coreOnly = 0;
  for (const row of rows) {
    for (const owner of row.owners) {
      if (owner.startsWith("CORE-INV-")) {
        const n = Number(owner.slice("CORE-INV-".length));
        expect(n).toBeGreaterThanOrEqual(1);
        expect(n).toBeLessThanOrEqual(64);
      } else if (!seen.includes(owner)) seen.push(owner);
    }
    if (row.owners.every((owner) => owner.startsWith("CORE-INV-"))) coreOnly += 1;
  }
  expect(coreOnly).toBe(55);
  expect(seen).toEqual(Array.from({ length: 48 }, (_, n) => designId(n + 1)));
  expect(requested).toHaveLength(48);
  expect(rows.find((row) => row.n === 18)!.owners).toEqual(rows.find((row) => row.n === 94)!.owners);
  const files = readTree("packs/design-invariants", true);
  const listed = listChecks(files);
  if ("errors" in listed) throw new Error(listed.errors.join("\n"));
  expect(listed.ids).toHaveLength(48);
  for (const id of listed.ids) expect(testCheck(files, id, clock).ok, id).toBe(true);
  const fromChecks = listed.ids.map((id) => {
    const path = `checks/${id.slice("design-invariants/".length)}/check.json`;
    return JSON.parse(files[path]!).impl.requirement as string;
  });
  expect(fromChecks.sort()).toEqual([...seen].sort());
});

test("one design-invariants methodology does not pull the others", () => {
  const preset = JSON.parse(readFileSync("packs/presets/observe-only.json", "utf8")) as Preset;
  preset.sources.push({ ns: "design-invariants", kind: "path", path: "packs/design-invariants" });
  preset.methodologies.push("design-invariants/security");
  const filesOf = (source: Preset["sources"][number]) => source.kind === "builtin" ? BUILTIN : source.kind === "path" ? readTree(source.path, true) : null;
  const result = compile(JSON.stringify(preset), filesOf, VERSIONS);
  if ("errors" in result) throw new Error(result.errors.join("\n"));
  const rules = result.lock.rules.filter((rule) => rule.id.startsWith("design-invariants/"));
  expect(rules.map((rule) => rule.id)).toEqual(["design-invariants/DESIGN-034", "design-invariants/DESIGN-035", "design-invariants/DESIGN-036", "design-invariants/DESIGN-037"]);
  expect(rules.every((rule) => rule.impl.kind === "primitive" && rule.impl.primitive === "fitness" && !rule.phases.includes("pre"))).toBe(true);
});
