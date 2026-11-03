import { expect, test } from "bun:test";
import {
  applyLabels, assertUniqueLabels, parseLabelFile, precisionRatio, precisionText, renderPrecision,
  type FindingSite, type PackPrecision, type PrecisionReport, type SampleLabel,
} from "../scripts/precision.ts";

const site = (pack: string, rule: string, line: number): FindingSite => ({
  corpus: "express", pack, rule, path: "lib/app.js", line, symbol: "create",
});

function label(finding: FindingSite, verdict: SampleLabel["verdict"], note = "The finding matches the rule text."): SampleLabel {
  return { ...finding, verdict, note };
}

test("precision is true positives over labeled findings and is unmeasured at zero", () => {
  expect(precisionRatio(0, 0)).toBeNull();
  expect(precisionRatio(3, 1)).toBe(0.75);
  expect(precisionRatio(0, 4)).toBe(0);
  expect(precisionRatio(5, 0)).toBe(1);
  expect(precisionText({ pack: "redis", findings: 10, labeled: 0, truePositives: 0, falsePositives: 0, precision: null })).toBe("unmeasured");
  expect(precisionText({ pack: "clean-code", findings: 20, labeled: 4, truePositives: 3, falsePositives: 1, precision: 0.75 })).toBe("3/4");
});

test("unlabeled packs stay unmeasured and a sample does not absorb unlabeled findings", () => {
  const senior = [site("senior", "senior/SR-EQ-001", 1), site("senior", "senior/SR-EQ-001", 2), site("senior", "senior/SR-EQ-001", 3)];
  const redis = [site("redis", "redis/REDIS-KEY-001", 4)];
  const labels = [label(senior[0]!, "true-positive"), label(senior[1]!, "false-positive", "This == compares a value with null, which the rule allows.")];
  const applied = applyLabels(["senior", "redis", "go"], [...senior, ...redis], labels);
  expect(applied.unmatched).toEqual([]);
  expect(applied.packs.find((pack) => pack.pack === "senior")).toEqual({
    pack: "senior", findings: 3, labeled: 2, truePositives: 1, falsePositives: 1, precision: 0.5,
  });
  expect(applied.packs.find((pack) => pack.pack === "redis")?.precision).toBeNull();
  expect(applied.packs.find((pack) => pack.pack === "go")).toMatchObject({ findings: 0, labeled: 0, precision: null });
  const rendered = renderPrecision(report(applied.packs, labels));
  expect(rendered).toContain("| senior | 3 | 2 | 1 | 1 | 1/2 |");
  expect(rendered).toContain("| redis | 1 | 0 | 0 | 0 | unmeasured |");
  expect(rendered).not.toContain("redis | 1 | 0 | 0 | 0 | 0/");
});

test("a label that misses every finding is unmatched and duplicates are rejected", () => {
  const finding = site("node", "node/NODE-PREFIX-001", 8);
  const missed = label(site("node", "node/NODE-PREFIX-001", 9), "false-positive", "No call on this line imports a builtin.");
  const applied = applyLabels(["node"], [finding], [missed]);
  expect(applied.matched).toEqual([]);
  expect(applied.unmatched).toEqual([missed]);
  expect(applied.packs[0]?.precision).toBeNull();
  expect(() => assertUniqueLabels([label(finding, "true-positive"), label(finding, "false-positive", "Second note.")])).toThrow("duplicate label");
});

test("label files are maintainer samples with a note and a closed verdict", () => {
  const text = JSON.stringify({
    labeler: "maintainer", pack: "clean-code",
    items: [{ corpus: "express", pack: "clean-code", rule: "clean-code/CC-FN-001", path: "lib/app.js", line: 10, symbol: "app", verdict: "true-positive", note: "app occupies more lines than the rule's limit." }],
  });
  expect(parseLabelFile(text, "clean-code.json")).toHaveLength(1);
  expect(() => parseLabelFile(text.replace("maintainer", "model"), "clean-code.json")).toThrow("maintainer");
  expect(() => parseLabelFile(text.replace("true-positive", "correct"), "clean-code.json")).toThrow("verdict");
  expect(() => parseLabelFile(text.replace("app occupies more lines than the rule's limit.", "  "), "clean-code.json")).toThrow("note");
});

function report(packs: PackPrecision[], sample: SampleLabel[]): PrecisionReport {
  return {
    schemaVersion: 1, engine: "0.0.2", core: "0.0.1", labeler: "maintainer",
    corpus: [{ id: "express", language: "javascript", kind: "git", url: "https://github.com/expressjs/express.git", commit: "1".repeat(40), sourceFiles: 3, parsed: 3 }],
    packs, sample, limits: ["A pack with no matching maintainer label is unmeasured."],
  };
}
