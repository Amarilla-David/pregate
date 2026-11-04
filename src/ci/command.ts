import { canonical } from "../disk.ts";
import { git } from "../git.ts";
import { describeCi, detectProviders, type DetectedProvider } from "./detect.ts";
import { GitHubCiError, githubApiBase, githubToken, readGitHubSignals } from "./github.ts";
import { judge, type CiJudgement, type CiProviderId, type ProviderExpectation } from "./provider.ts";

type Result = { code: number; text: string };

const USAGE = "Usage: pregate ci detect [--json] | ci status [--sha <sha>] [--require github-actions|vercel] [--json] | ci wait [--sha <sha>] [--timeout <seconds>] [--interval <seconds>] [--require github-actions|vercel] [--json]";

interface CiOptions {
  json: boolean;
  sha: string | null;
  require: CiProviderId[];
  timeout: number;
  interval: number;
}

// `pregate ci` reads provider configuration and GitHub's commit statuses and check runs.
// It never changes the repository. A required provider that is missing, pending, or failing
// is not a pass.
export async function ciCommand(args: string[]): Promise<Result> {
  const [sub, ...rest] = args;
  if (sub === "detect") return detectCommand(rest);
  if (sub === "status" || sub === "wait") return watchCommand(sub, rest);
  return { code: 1, text: USAGE };
}

function detectCommand(args: string[]): Result {
  if (args.length > 1 || (args.length === 1 && args[0] !== "--json")) return { code: 1, text: USAGE };
  const described = describeCi(canonical(process.cwd()));
  if (args[0] === "--json") return { code: 0, text: JSON.stringify({ providers: described.providers }, null, 2) };
  return { code: 0, text: described.text };
}

async function watchCommand(mode: "status" | "wait", args: string[]): Promise<Result> {
  const options = parseWatch(mode, args);
  if (options === null) return { code: 1, text: USAGE };
  const dir = canonical(process.cwd());
  const sha = options.sha ?? git(dir, ["rev-parse", "HEAD"])?.trim() ?? "";
  if (!/^[0-9a-f]{7,64}$/i.test(sha)) return { code: 1, text: "CI needs a commit SHA (--sha or git HEAD). Refusing to guess one." };
  const repository = githubRepository(dir);
  if (repository === null) return { code: 1, text: "CI needs a GitHub repository (origin, or PREGATE_GITHUB_REPOSITORY=owner/repo)." };
  let api: string;
  try { api = githubApiBase(process.env.PREGATE_GITHUB_API); }
  catch (error) { return { code: 1, text: (error as Error).message }; }
  const detected = detectProviders(dir);
  const expectations = expectationsOf(detected, options.require);
  const source = { api, token: githubToken() };
  const timeoutMs = mode === "wait" ? options.timeout * 1000 : 0;
  const intervalMs = mode === "wait" ? options.interval * 1000 : 0;
  const deadline = Date.now() + timeoutMs;
  let report: CiJudgement;
  for (;;) {
    try {
      const signals = await readGitHubSignals(repository, sha, source, actionChecks(expectations));
      report = judge(expectations, signals);
    } catch (error) {
      const message = error instanceof GitHubCiError ? error.message : "CI status could not be read.";
      return { code: 1, text: message };
    }
    if (report.verdict === "pass" || report.verdict === "fail") break;
    if (mode === "status" || Date.now() >= deadline) break;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  const code = report!.verdict === "pass" ? 0 : 1;
  return { code, text: options.json ? JSON.stringify({ sha, repository, ...report! }, null, 2) : formatText(sha, report!) };
}

function expectationsOf(detected: DetectedProvider[], extra: CiProviderId[]): ProviderExpectation[] {
  const ids = new Set<CiProviderId>([...detected.map((item) => item.id), ...extra]);
  return [...ids].map((id) => {
    const found = detected.find((item) => item.id === id);
    return { id, required: true, checks: found?.checks ?? (id === "github-actions" ? ["pregate"] : []) };
  });
}

function actionChecks(expectations: readonly ProviderExpectation[]): string[] {
  return expectations.find((item) => item.id === "github-actions")?.checks ?? [];
}

function formatText(sha: string, report: CiJudgement): string {
  const lines = report.providers.filter((provider) => provider.required).map((provider) => {
    const detail = provider.signals.length === 0
      ? "no status"
      : provider.signals.map((signal) => `${signal.name} ${signal.raw}${signal.description ? ` (${signal.description})` : ""}`).join(", ");
    return `${provider.id}: ${provider.verdict} - ${detail}`;
  });
  const head = report.verdict === "pass"
    ? `CI passed for ${sha}.`
    : `CI ${report.verdict} for ${sha}. A required provider that is missing, still running, or failing does not pass.`;
  return [head, ...lines].join("\n");
}

function parseWatch(mode: "status" | "wait", args: string[]): CiOptions | null {
  const options: CiOptions = { json: false, sha: null, require: [], timeout: mode === "wait" ? 600 : 0, interval: mode === "wait" ? 5 : 0 };
  for (let i = 0; i < args.length; i++) {
    const flag = args[i]!;
    if (flag === "--json") { options.json = true; continue; }
    const value = args[++i];
    if (value === undefined || value.startsWith("-")) return null;
    if (flag === "--sha") {
      if (!/^[0-9a-f]{7,64}$/i.test(value)) return null;
      options.sha = value;
    } else if (flag === "--require") {
      const id = value === "github" ? "github-actions" : value;
      if (id !== "github-actions" && id !== "vercel") return null;
      if (!options.require.includes(id)) options.require.push(id);
    } else if (mode === "wait" && (flag === "--timeout" || flag === "--interval")) {
      if (!/^\d+$/.test(value)) return null;
      options[flag === "--timeout" ? "timeout" : "interval"] = Number(value);
    } else return null;
  }
  return options;
}

function githubRepository(dir: string): string | null {
  const override = process.env.PREGATE_GITHUB_REPOSITORY;
  if (override !== undefined && override !== "") {
    return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(override.trim()) ? override.trim() : null;
  }
  const remote = git(dir, ["remote", "get-url", "origin"])?.trim() ?? "";
  const match = /github\.com[:/]([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?$/.exec(remote);
  return match ? `${match[1]}/${match[2]}` : null;
}
