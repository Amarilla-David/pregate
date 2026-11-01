// One command for the evidence every release record assembles by hand: typecheck, the complete
// suite, the host build with its pre-checks, native packaged smoke and strict latency. It writes
// one JSON record with the exact commit, tree state, Bun version and each step's outcome. Internal:
// it is not shipped. Usage: bun run scripts/verify-candidate.ts <evidence.json> [--skip <step,step>]
import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { hostTarget } from "./build.ts";

const ROOT = join(import.meta.dir, "..");
const STEPS: Record<string, string[]> = {
  typecheck: ["run", "typecheck"],
  suite: ["test"],
  build: ["run", "scripts/build.ts", hostTarget()],
  smoke: ["run", "scripts/smoke-native.ts", "dist", hostTarget()],
  latency: ["run", "scripts/bench.ts"],
};

interface Step { name: string; exit: number | null; seconds: number; summary: string[] }

function main(): number {
  const args = process.argv.slice(2);
  const skipAt = args.indexOf("--skip");
  const skip = skipAt < 0 ? [] : (args[skipAt + 1] ?? "").split(",");
  const out = args[0];
  if (out === undefined || out.startsWith("-") || args.length !== (skipAt < 0 ? 1 : 3) || skip.some((s) => !(s in STEPS))) {
    throw new Error(`usage: verify-candidate.ts <evidence.json> [--skip ${Object.keys(STEPS).join(",")}]`);
  }
  const steps: Step[] = [];
  for (const [name, command] of Object.entries(STEPS)) {
    if (skip.includes(name)) {
      steps.push({ name, exit: null, seconds: 0, summary: ["skipped by request"] });
      continue;
    }
    steps.push(step(name, command));
    console.log(`${name}: exit ${steps.at(-1)!.exit} in ${steps.at(-1)!.seconds} s`);
  }
  const record = {
    commit: git("rev-parse", "HEAD"), dirty: git("status", "--porcelain").split("\n").filter(Boolean).length,
    bun: Bun.version, target: hostTarget(), finished: new Date().toISOString(), steps,
    verdict: steps.every((s) => s.exit === 0) ? "pass" : steps.some((s) => s.exit !== null && s.exit !== 0) ? "fail" : "incomplete",
  };
  writeFileSync(resolve(out), JSON.stringify(record, null, 2) + "\n");
  console.log(`${record.verdict}: evidence written to ${resolve(out)}`);
  return record.verdict === "pass" ? 0 : 1;
}

// The last lines that state a result: test counts, latency verdict, smoke and build outcomes.
function step(name: string, command: string[]): Step {
  const started = performance.now();
  const r = Bun.spawnSync([process.execPath, ...command], { cwd: ROOT, stdout: "pipe", stderr: "pipe", env: process.env });
  const text = r.stdout.toString() + r.stderr.toString();
  const summary = text.split("\n").map((l) => l.trim())
    .filter((l) => /^\d+ (pass|fail|skip)$|^Ran \d+ tests|budget|p95|p50|passed|failed|error|exited/i.test(l)).slice(-12);
  return { name, exit: r.exitCode, seconds: Math.round((performance.now() - started) / 100) / 10, summary };
}

function git(...args: string[]): string {
  return Bun.spawnSync(["git", ...args], { cwd: ROOT, stdout: "pipe" }).stdout.toString().trim();
}

process.exit(main());
