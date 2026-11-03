import { expect, test } from "bun:test";
import { decideGate, formatGate, median, parseBaseline, parseBenchArgs, regressed } from "../scripts/latency-gate.ts";

test("median of repeated p95 samples is the middle value", () => {
  expect(median([9, 1, 5])).toBe(5);
  expect(median([1, 2, 3, 4])).toBe(2.5);
  expect(() => median([])).toThrow("empty");
});

test("p95 regresses only when it is more than 25% over the baseline", () => {
  expect(regressed(100, 100)).toBe(false);
  expect(regressed(125, 100)).toBe(false);
  expect(regressed(125.01, 100)).toBe(true);
  expect(regressed(80, 100)).toBe(false);
});

test("the gate fails closed for a missing OS, a different arch, or a missing route", () => {
  const baseline = parseBaseline({
    schemaVersion: 1,
    os: { linux: { arch: "x64", runner: "ubuntu-latest", p95Ms: { "200 lines, first touch": 200, "2,000 lines, first touch": 800 } } },
  });
  const measured = { "200 lines, first touch": 210, "2,000 lines, first touch": 790 };
  expect(decideGate("linux", "x64", measured, baseline).ok).toBe(true);
  expect(decideGate("linux", "x64", { ...measured, "2,000 lines, first touch": 1001 }, baseline).ok).toBe(false);
  expect(decideGate("darwin", "arm64", measured, baseline).ok).toBe(false);
  expect(decideGate("linux", "arm64", measured, baseline).reason).toContain("arm64");
  expect(decideGate("linux", "x64", { "200 lines, first touch": 210 }, baseline).rows.some((row) => !row.ok)).toBe(true);
  expect(formatGate(decideGate("linux", "x64", measured, baseline))).toContain("ok");
});

test("bench flags accept the regression gate and reject a short run", () => {
  expect(parseBenchArgs(["--runs", "25", "--repeat", "3", "--inform", "--gate", "bench/latency-baseline.json", "--only", "200 lines, first touch"])).toEqual({
    runs: 25, repeat: 3, inform: true, gate: "bench/latency-baseline.json", only: ["200 lines, first touch"],
  });
  expect(() => parseBenchArgs(["--runs", "10"])).toThrow("usage:");
  expect(() => parseBaseline({ schemaVersion: 1, os: { linux: { arch: "x64", runner: "ubuntu-latest", p95Ms: { slow: 0 } } } })).toThrow("positive");
});
