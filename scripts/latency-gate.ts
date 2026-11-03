// Compare a median p95 with a committed per-OS baseline. A miss of more than 25% fails.
// The absolute 150 ms budget stays the reference machine's; this gate is the CI regression check.

export const REGRESSION = 1.25;
export const BENCH_USAGE = "usage: bench.ts [--runs N≥25] [--repeat K≥1] [--inform] [--gate <file>] [--only <route>]...";

export interface BenchOptions {
  runs: number;
  repeat: number;
  inform: boolean;
  gate: string | null;
  only: string[];
}

export interface OsBaseline {
  arch: string;
  runner: string;
  p95Ms: Record<string, number>;
}

export interface GateBaseline {
  schemaVersion: 1;
  os: Record<string, OsBaseline>;
}

export interface GateRow {
  route: string;
  baselineMs: number;
  measuredMs: number;
  limitMs: number;
  ok: boolean;
}

export interface GateDecision {
  ok: boolean;
  reason: string;
  rows: GateRow[];
}

export function median(values: number[]): number {
  if (values.length === 0) throw new Error("median of an empty sample");
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const right = sorted[mid]!;
  if (sorted.length % 2 === 1) return right;
  return ((sorted[mid - 1] ?? right) + right) / 2;
}

export function regressed(measuredMs: number, baselineMs: number): boolean {
  return !(measuredMs <= baselineMs * REGRESSION);
}

export function parseBenchArgs(args: string[]): BenchOptions {
  const out: BenchOptions = { runs: 30, repeat: 1, inform: false, gate: null, only: [] };
  const rest = [...args];
  while (rest.length) takeFlag(out, rest);
  if (!Number.isInteger(out.runs) || out.runs < 25 || !Number.isInteger(out.repeat) || out.repeat < 1) throw new Error(BENCH_USAGE);
  return out;
}

export function parseBaseline(value: unknown): GateBaseline {
  const doc = record(value, "baseline");
  if (doc.schemaVersion !== 1) throw new Error("baseline schemaVersion must be 1");
  const os = record(doc.os, "baseline.os");
  const parsed: Record<string, OsBaseline> = {};
  for (const [platform, raw] of Object.entries(os)) parsed[platform] = parseOs(raw, platform);
  return { schemaVersion: 1, os: parsed };
}

export function decideGate(platform: string, arch: string, measured: Record<string, number>, baseline: GateBaseline): GateDecision {
  const os = baseline.os[platform];
  if (!os) return { ok: false, reason: `no baseline for ${platform} (${arch})`, rows: [] };
  if (os.arch !== arch) return { ok: false, reason: `baseline arch ${os.arch} does not match runner arch ${arch}`, rows: [] };
  const rows = Object.entries(os.p95Ms).map(([route, baselineMs]) => gateRow(route, baselineMs, measured[route]));
  const ok = rows.every((row) => row.ok);
  const reason = ok ? `median p95 is within ${REGRESSION}× the ${platform} baseline` : `median p95 regressed more than 25% on ${platform}`;
  return { ok, reason, rows };
}

export function formatGate(decision: GateDecision): string {
  if (decision.rows.length === 0) return `Latency gate failed: ${decision.reason}.`;
  const lines = decision.rows.map((row) => `${row.route}: median p95 ${show(row.measuredMs)} ms, baseline ${show(row.baselineMs)} ms, limit ${show(row.limitMs)} ms, ${row.ok ? "ok" : "regressed"}`);
  return [`Latency gate: ${decision.reason}.`, ...lines].join("\n");
}

function takeFlag(out: BenchOptions, rest: string[]): void {
  const flag = rest.shift() ?? "";
  if (flag === "--inform") out.inform = true;
  else if (flag === "--runs") out.runs = integerAtLeast(required(rest, flag), 25, flag);
  else if (flag === "--repeat") out.repeat = integerAtLeast(required(rest, flag), 1, flag);
  else if (flag === "--gate") out.gate = required(rest, flag);
  else if (flag === "--only") out.only.push(required(rest, flag));
  else throw new Error(BENCH_USAGE);
}

function required(rest: string[], flag: string): string {
  const value = rest.shift();
  if (value === undefined || value.startsWith("--")) throw new Error(BENCH_USAGE);
  return value;
}

function integerAtLeast(value: string, min: number, flag: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min) throw new Error(BENCH_USAGE);
  return parsed;
}

function gateRow(route: string, baselineMs: number, measuredMs: number | undefined): GateRow {
  const limitMs = baselineMs * REGRESSION;
  if (measuredMs === undefined || !Number.isFinite(measuredMs) || !Number.isFinite(baselineMs) || baselineMs <= 0) {
    return { route, baselineMs, measuredMs: measuredMs ?? Number.NaN, limitMs, ok: false };
  }
  return { route, baselineMs, measuredMs, limitMs, ok: !regressed(measuredMs, baselineMs) };
}

function parseOs(value: unknown, platform: string): OsBaseline {
  const os = record(value, platform);
  const arch = text(os.arch, `${platform}.arch`);
  const runner = text(os.runner, `${platform}.runner`);
  const p95Ms = record(os.p95Ms, `${platform}.p95Ms`);
  const routes: Record<string, number> = {};
  for (const [route, raw] of Object.entries(p95Ms)) {
    if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) throw new Error(`${platform}.p95Ms.${route} must be a positive number`);
    routes[route] = raw;
  }
  if (Object.keys(routes).length === 0) throw new Error(`${platform}.p95Ms must name at least one route`);
  return { arch, runner, p95Ms: routes };
}

function record(value: unknown, at: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`${at}: expected an object`);
  return value as Record<string, unknown>;
}

function text(value: unknown, at: string): string {
  if (typeof value !== "string" || value === "") throw new Error(`${at} must be a non-empty string`);
  return value;
}

function show(value: number): string {
  return Number.isFinite(value) ? value.toFixed(1) : "n/a";
}
