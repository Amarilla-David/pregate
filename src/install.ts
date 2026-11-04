import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { relativePath as relative } from "./paths.ts";
import { ASSETS } from "./assets.ts";
import type { CiProviderId } from "./ci/provider.ts";
import { writeAtomic } from "./disk.ts";
import { git } from "./git.ts";
import { isObject, parse } from "./harness/wire.ts";

// `pregate install` (MULTI-HARNESS MH-28): only what belongs to the repo, on request: the pre-commit
// and the CI template. The hooks and the launcher are global (`pregate setup`), so what an install of
// 0.1.0 left in the repo is removed: its hooks in .claude/settings.json, which would evaluate every
// call twice, and the committed launcher. Run twice, it leaves the same files. Messages are for the
// human (A18).

const HOOKS_DIR = ".pregate/git-hooks";
const OLD_LAUNCHER = ".pregate/bin/pregate";
// The inline guard of every 0.1.0 handler, which ran the committed launcher.
const OLD_GUARD = `/${OLD_LAUNCHER}"; [ -f "$f" ]`;

export function install(root: string, opts: { gitHook: boolean; ci: CiProviderId[] }): { code: 0 | 1; text: string } {
  const top = git(root, ["rev-parse", "--show-toplevel"])?.trim();
  if (top === undefined) return { code: 1, text: "PREGATE requires Git; this directory is not in a Git repository." };
  const settings = join(root, ".claude/settings.json");
  const before = existsSync(settings) ? readFileSync(settings, "utf8") : null;
  const after = before === null ? null : withoutOld(before);
  if (before !== null && after === null) return { code: 1, text: `${settings} is not a valid JSON object; fix it and rerun pregate install.` };
  const lines: string[] = [];
  if (after !== before) {
    writeAtomic(settings, after!);
    lines.push("Removed PREGATE 0.1.0 hooks from .claude/settings.json; hooks are now global (pregate setup). Commit the change.");
  }
  if (existsSync(join(root, OLD_LAUNCHER))) {
    rmSync(join(root, OLD_LAUNCHER));
    lines.push(`Removed ${OLD_LAUNCHER}; the launcher is global (pregate setup). Commit the removal.`);
  }
  if (opts.gitHook) lines.push(gitHook(root, top));
  if (opts.ci.includes("github-actions")) lines.push(ci(root, top));
  if (opts.ci.includes("vercel")) lines.push(vercel(root));
  if (lines.length === 0) lines.push("Nothing to do; hooks are global (pregate setup). Options: --git-hook, --ci github, and --ci vercel.");
  return { code: 0, text: lines.join("\n") };
}

// The settings without the 0.1.0 handlers; a group left empty goes too. null: not a JSON object.
function withoutOld(text: string): string | null {
  const settings = parse(text);
  if (settings === null || (settings.hooks !== undefined && !isObject(settings.hooks))) return null;
  const hooks = settings.hooks ?? {};
  let changed = false;
  for (const [event, groups] of Object.entries(hooks)) {
    if (!Array.isArray(groups)) continue;
    const kept = groups.flatMap((g: unknown) => {
      if (!isObject(g) || !Array.isArray(g.hooks)) return [g];
      const handlers = g.hooks.filter((h: unknown) => !(isObject(h) && typeof h.command === "string" && h.command.includes(OLD_GUARD)));
      if (handlers.length === g.hooks.length) return [g];
      changed = true;
      return handlers.length === 0 ? [] : [{ ...g, hooks: handlers }];
    });
    if (kept.length === 0 && groups.length > 0) delete hooks[event];
    else hooks[event] = kept;
  }
  if (!changed) return text;
  if (Object.keys(hooks).length === 0) delete settings.hooks;
  return `${JSON.stringify(settings, null, 2)}\n`;
}

// §10.2.9: the committed pre-commit, activated through core.hooksPath unless the repo already has a
// hook manager, whose hooks core.hooksPath would silently switch off (§7.2 #19).
function gitHook(root: string, top: string): string {
  write(join(root, HOOKS_DIR, "pre-commit"), ASSETS["pre-commit.sh"]!, true);
  const path = relative(top, join(root, HOOKS_DIR));
  const current = git(root, ["config", "--get", "core.hooksPath"])?.trim() ?? "";
  if (current === path) return `Pre-commit enabled (core.hooksPath=${path}).`;
  const own = git(root, ["rev-parse", "--git-path", "hooks/pre-commit"])?.trim();
  const other = current !== "" ? `core.hooksPath=${current}`
    : [".husky", ".githooks", "lefthook.yml", ".lefthook.yml", "lefthook.yaml", ".lefthook.yaml"].find((f) => existsSync(join(top, f)))
      ?? (own !== undefined && existsSync(resolve(root, own)) ? ".git/hooks/pre-commit" : null);
  if (other !== null) return `This repo already manages hooks (${other}); core.hooksPath unchanged. Add to its pre-commit: sh ${join(path, "pre-commit")}`;
  if (git(root, ["config", "core.hooksPath", path]) === null) return `Could not set core.hooksPath; run: git config core.hooksPath ${path}`;
  return `Pre-commit enabled (core.hooksPath=${path}); commit ${HOOKS_DIR}/.`;
}

// The template installs the engine pinned on the base branch, so a pull request cannot swap the
// binary by editing its own lock (MH-28).
function ci(root: string, top: string): string {
  const workflow = join(top, ".github/workflows/pregate.yml");
  write(workflow, ASSETS["ci-github.yml"]!.replaceAll("@ROOT@", relative(top, root) || "."), false);
  return `CI template at ${relative(top, workflow)}; commit it.`;
}

const VERCEL_BUILD = "bash scripts/pregate-vercel-build.sh -- npm run build";

// The Vercel recipe is a build command, not a GitHub workflow. It can stand on a repository
// that has no Actions. An existing vercel.json keeps a buildCommand the user already chose.
function vercel(root: string): string {
  const script = join(root, "scripts/pregate-vercel-build.sh");
  write(script, ASSETS["ci-vercel-build.sh"]!, true);
  const config = join(root, "vercel.json");
  const lines = [`Vercel build recipe at ${relative(root, script)}. It installs the pinned linux-x64 release, runs the gate, then the framework build. Commit it.`];
  if (!existsSync(config)) {
    write(config, `${JSON.stringify({ $schema: "https://openapi.vercel.sh/vercel.json", buildCommand: VERCEL_BUILD }, null, 2)}\n`, false);
    lines.push(`vercel.json buildCommand is \`${VERCEL_BUILD}\`. Change the command after -- when the framework build is not npm run build.`);
    return lines.join("\n");
  }
  let parsed: unknown;
  try { parsed = JSON.parse(readFileSync(config, "utf8")); }
  catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    return [...lines, "vercel.json is not valid JSON, so it was left unchanged.", `Set its buildCommand to \`${VERCEL_BUILD}\`.`].join("\n");
  }
  if (!isObject(parsed)) return [...lines, "vercel.json is not a JSON object, so it was left unchanged.", `Set its buildCommand to \`${VERCEL_BUILD}\`.`].join("\n");
  const current = parsed.buildCommand;
  if (typeof current === "string" && current.includes("pregate-vercel-build.sh")) {
    lines.push("vercel.json already runs the Pregate build.");
    return lines.join("\n");
  }
  if (current !== undefined) {
    lines.push(`vercel.json already has a buildCommand, so it was left unchanged. Run the gate first: \`${VERCEL_BUILD}\`.`);
    return lines.join("\n");
  }
  const next: Record<string, unknown> = {
    ...parsed,
    $schema: typeof parsed.$schema === "string" ? parsed.$schema : "https://openapi.vercel.sh/vercel.json",
    buildCommand: VERCEL_BUILD,
  };
  write(config, `${JSON.stringify(next, null, 2)}\n`, false);
  lines.push("Added buildCommand to the existing vercel.json. It runs the gate, then npm run build.");
  return lines.join("\n");
}

function write(path: string, text: string, executable: boolean): void {
  mkdirSync(dirname(path), { recursive: true });
  writeAtomic(path, text);
  if (executable) chmodSync(path, 0o755);
}
