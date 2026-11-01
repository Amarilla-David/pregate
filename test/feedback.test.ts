import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { calibration, feedbackItems, type FeedbackLabel } from "../src/feedback.ts";
import { reportText, summarize, type Recorded } from "../src/report.ts";

const records = JSON.parse(readFileSync("test/fixtures/report-events.json", "utf8")) as Recorded[];

test("feedback identifies individual observations, keeps repeated attempts and excludes other projects/windows", () => {
  const denied = records[1]!;
  const repeated = { ...denied, event: { ...denied.event, callId: "another-attempt", at: 15 } };
  const two = { ...denied, event: { ...denied.event, violations: [denied.event.violations[0]!, { ...denied.event.violations[0]!, line: 9 }] } };
  const items = feedbackItems([...records, repeated, two], "/repo", 10);
  expect(items).toHaveLength(4);
  expect(new Set(items.map((item) => item.id)).size).toBe(4);
  expect(feedbackItems(records, "/other", 0)).toHaveLength(0);
  expect(feedbackItems(records, "/repo", 20)).toEqual([]);
  expect(feedbackItems([denied, denied], "/repo")).toHaveLength(1);
});

test("reviewed precision excludes uncertain/unlabeled cases, exposes denominators and rejects stale labels", () => {
  const items = feedbackItems(records, "/repo");
  const labels: FeedbackLabel[] = items.map((item, i) => ({ item, verdict: i ? "false-positive" : "correct", note: "", confirmedAt: 100 }));
  const result = calibration(items, labels);
  expect(result).toMatchObject({ findings: 2, correct: 1, falsePositive: 1, uncertain: 0, unlabeled: 0, reviewedPrecision: 0.5, staleLabels: 0 });
  const unknown: FeedbackLabel = { ...labels[0]!, verdict: "uncertain" };
  expect(calibration(items, [unknown])).toMatchObject({ uncertain: 1, unlabeled: 1, reviewedPrecision: null });
  const changed: FeedbackLabel = { ...labels[0]!, item: { ...labels[0]!.item, eventHash: "changed" } };
  expect(calibration(items, [changed])).toMatchObject({ staleLabels: 1, unlabeled: 2, reviewedPrecision: null });
  const other: FeedbackLabel = { ...labels[0]!, item: { ...labels[0]!.item, root: "/other" } };
  expect(calibration(items, [other]).reviewedPrecision).toBeNull();
  const forged: FeedbackLabel = { ...labels[0]!, item: { ...labels[0]!.item, rule: "another/rule", measured: 0 } };
  expect(calibration(items, [forged])).toMatchObject({ staleLabels: 1, reviewedPrecision: null });
  const text = reportText(summarize(records, "/repo", 10, labels), "start");
  expect(text).toContain("Reviewed precision: 50.0%");
  expect(text).toContain("not an unbiased corpus");
  expect(text).toContain("does not measure recall");
});

test("warning observations have their own IDs and contribute to human calibration", () => {
  const denied = records[1]!;
  const event = { ...denied.event, warnings: [{ ...denied.event.violations[0]!, severity: "warn" as const }] };
  const items = feedbackItems([{ session: "warning", event }], "/repo");
  expect(items).toHaveLength(2);
  expect(items.map((item) => item.channel).sort()).toEqual(["violation", "warning"]);
  expect(items[0]!.id).not.toBe(items[1]!.id);
  expect(calibration([], []).reviewedPrecision).toBeNull();
});
