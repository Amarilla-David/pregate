import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseLabelFile, precisionText, renderPrecision, siteKey, type PrecisionReport, type SampleLabel } from "../scripts/precision.ts";

const root = join(import.meta.dir, "..");

test("the guide reports sample precision only for maintainer-labeled packs", () => {
  const report = JSON.parse(readFileSync(join(root, "bench/precision-report.json"), "utf8")) as PrecisionReport;
  const guide = readFileSync(join(root, "docs/guides/rule-precision.md"), "utf8");
  const start = guide.indexOf("<!-- BEGIN measured precision -->");
  const end = guide.indexOf("<!-- END measured precision -->");
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  const body = guide.slice(start + "<!-- BEGIN measured precision -->".length, end).trim();
  expect(body).toBe(renderPrecision(report).trim());
  const labels = labeledItems();
  expect(labels.map(siteKey).sort()).toEqual(report.sample.map(siteKey).sort());
  for (const pack of report.packs) {
    const row = `| ${pack.pack} | ${pack.findings} | ${pack.labeled} | ${pack.truePositives} | ${pack.falsePositives} | ${precisionText(pack)} |`;
    expect(guide).toContain(row);
    if (pack.precision === null) expect(pack.labeled).toBe(0);
    else expect(pack.precision).toBe(pack.truePositives / pack.labeled);
  }
  expect(report.packs.some((pack) => pack.precision === null)).toBe(true);
  expect(report.packs.some((pack) => pack.precision !== null)).toBe(true);
});

function labeledItems(): SampleLabel[] {
  const dir = join(root, "bench/labels");
  return readdirSync(dir).filter((name) => name.endsWith(".json")).sort()
    .flatMap((name) => parseLabelFile(readFileSync(join(dir, name), "utf8"), name));
}
