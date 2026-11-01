import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { validateContract } from "./contract.ts";
import { canonical, readTree, writeAtomic } from "./disk.ts";
import { matchedLines, testCheck } from "./fixtures.ts";
import { clock, LOCK, PRESET, sourceDirs, sourcesOf, VERSIONS } from "./gate.ts";
import { grammarOf } from "./languages.ts";
import { draftCase, draftCheckDir, draftExamples, draftRule, type DraftKind, fixtureTarget, regexLiteral, specifierRule } from "./pack-template.ts";
import { pendingReview } from "./pending-review.ts";
import { matches, relativePath, slash } from "./paths.ts";
import { proposeContract } from "./proposal.ts";
import { sha256 } from "./state.ts";
import { type Node, type Parsed, parse as parseTree } from "./ts.ts";
import type { Check, Files, MatchRule, PatternConfig, RuleLanguage } from "./types.ts";

// `pregate rules draft`: a correction (the code the agent wrote, the code it should have written)
// becomes a check with those files as fixtures. A new folder is written directly and adopted with
// `pack add --path`; a pack the contract already uses changes only through one staged human review.

type Result = { code: number; text: string };
type Options = Map<string, string[]>;

export const DRAFT_USAGE = "usage: pregate rules draft <pack-dir> <area>/<name> [--pattern <rule.json|auto> --message <text> --why <text> --fix <text>] [--files <glob>] [--fail <file>]... [--pass <file>]... [--trap <file> --trap-note <text>]...";
const SINGLE = ["--pattern", "--message", "--why", "--fix", "--files"];
const REPEATED = ["--fail", "--pass", "--trap", "--trap-note"];
const SLUG = /^[a-z][a-z0-9-]*$/;

export function rulesDraft(args: string[], root: string | null): Result {
  const parsed = parse(args);
  if (parsed === null) return { code: 1, text: DRAFT_USAGE };
  const { dir, area, name, opts } = parsed;
  const where = placement(dir, root);
  if (where !== "new" && where !== "active") return { code: 1, text: where };
  const files = existsSync(dir) ? readTree(dir, true) : {};
  const ns = files["source.json"] === undefined ? basename(dir) : (JSON.parse(files["source.json"]) as { ns: string }).ns;
  if (!SLUG.test(ns) || ns === "core") return { code: 1, text: `Pack namespace ${ns} must be lowercase letters, digits and hyphens, and differ from core; rename the folder.` };
  const checkDir = draftCheckDir(area, name);
  const started = opts.has("--pattern") || (files[`${checkDir}/check.json`] === undefined && opts.has("--message")) ? start(files, ns, area, name, opts) : files;
  if (typeof started === "string") return { code: 1, text: started };
  const id = `${ns}/${area}/${name}`;
  if (started[`${checkDir}/check.json`] === undefined) return { code: 1, text: `No check ${id} in ${dir}. Start it with --pattern, --message, --why, --fix and --fail.` };
  const check = JSON.parse(started[`${checkDir}/check.json`]!) as Check;
  const added = addCases(started, checkDir, check, opts);
  if (typeof added === "string") return { code: 1, text: added };
  Object.assign(added, draftExamples(added, id, checkDir));
  const tested = testCheck(added, id, clock);
  const complete = tested.lines.every((line) => line.startsWith("ok"));
  const chosen = files[`${checkDir}/check.json`] === undefined && ["auto", undefined].includes(opts.get("--pattern")?.[0]) ? [`Pattern: ${patternLine(check)}`] : [];
  if (where === "active") return complete ? stage(root!, { dir, before: files, after: added }, id, chosen)
    : { code: 1, text: [...tested.lines, `${dir} is an active rule source, so it changes in one reviewed update: pass every case in this run (--fail, --pass and --trap repeat). Nothing changed.`].join("\n") };
  for (const [path, text] of Object.entries(added)) {
    if (files[path] === text) continue;
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeAtomic(join(dir, path), text);
  }
  return { code: 0, text: [
    `Draft ${id} written to ${dir}.`, ...chosen, ...tested.lines,
    complete ? `Draft complete. Activate it for human review with: pregate pack add --path ${dir} --preview`
      : "Draft incomplete: add the cases named above (a trap is real code that must still fail). Nothing is active.",
  ].join("\n") };
}

function parse(args: string[]): { dir: string; area: string; name: string; opts: Options } | null {
  const opts: Options = new Map();
  const operands: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (![...SINGLE, ...REPEATED].includes(arg)) {
      if (arg.startsWith("-")) return null;
      operands.push(arg);
      continue;
    }
    const value = args[++i];
    if (value === undefined || (SINGLE.includes(arg) && opts.has(arg))) return null;
    opts.set(arg, [...opts.get(arg) ?? [], value]);
  }
  const [area, name, extra] = (operands[1] ?? "").split("/");
  if (operands.length !== 2 || extra !== undefined || !SLUG.test(area ?? "") || !SLUG.test(name ?? "")) return null;
  if ((opts.get("--trap") ?? []).length !== (opts.get("--trap-note") ?? []).length) return null;
  if (!["--fail", "--pass", "--trap", "--pattern"].some((o) => opts.has(o))) return null;
  return { dir: canonical(resolve(operands[0]!)), area: area!, name: name!, opts };
}

// A whole active source is staged for review; any other enforced policy is never a draft target.
function placement(dir: string, root: string | null): "new" | "active" | string {
  const active = root === null ? [] : sourceDirs(readFileSync(join(root, PRESET), "utf8")).map((d) => canonical(resolve(root, d)));
  if (active.includes(dir)) return "active";
  if (!dir.split("/").includes(".pregate") && !active.some((a) => dir.startsWith(`${a}/`))) return "new";
  return `${dir} is protected policy, not a whole rule source. Draft into a new folder such as rules/<ns>, or name an active pack folder to stage a reviewed update.`;
}

// A rule pack folder (canonical `dir`) as it is now and as the draft leaves it, with the preset
// text that registers it when that changes too.
export type PackChange = { dir: string; before: Files; after: Files; preset?: string };

function stage(root: string, pack: PackChange, id: string, chosen: string[]): Result {
  const review = stagePack(root, pack);
  return review.code !== 0 ? review : { code: 0, text: [`Draft ${id} is complete and staged as one update to the active pack.`, ...chosen, review.text].join("\n") };
}

// One proposal: the pack files, the preset when it changes, and the lock they compile to. Approval
// keeps local consent as is.
export function stagePack(root: string, pack: PackChange): Result {
  const presetText = readFileSync(join(root, PRESET), "utf8");
  const preset = pack.preset ?? presetText;
  const compiled = validateContract({ presetText: preset, versions: VERSIONS, now: clock,
    filesOf: (s) => s.kind === "path" && canonical(resolve(root, s.path)) === pack.dir ? pack.after : sourcesOf(root, true)(s) });
  if ("errors" in compiled) return { code: 1, text: [...compiled.errors, "Nothing staged."].join("\n") };
  const lockText = existsSync(join(root, LOCK)) ? readFileSync(join(root, LOCK), "utf8") : "";
  const writes = Object.entries(pack.after).filter(([path, text]) => pack.before[path] !== text)
    .map(([path, text]) => ({ path: join(pack.dir, path), before: pack.before[path] ?? null, after: text }));
  if (preset !== presetText) writes.push({ path: join(root, PRESET), before: presetText, after: preset });
  const proposal = proposeContract({ root, baseline: sha256(presetText + lockText), lockText: compiled.text, activate: false, writes }, true);
  return pendingReview(root, sha256(JSON.stringify(proposal)));
}

function start(files: Files, ns: string, area: string, name: string, opts: Options): Files | string {
  const absent = ["--message", "--why", "--fix", "--fail"].filter((o) => !opts.has(o));
  if (absent.length) return `A new check needs ${absent.join(", ")}: the bad code it must reject and the reason a reviewer gives.`;
  const language = languageOf(target(opts.get("--fail")![0]!));
  if (language === null) return `${opts.get("--fail")![0]} is not a supported source file.`;
  const patArg = opts.get("--pattern")?.[0];
  const hint = [...name.split("-"), ...(opts.get("--message")![0]!.toLowerCase().match(/[a-z_$][\w$]{2,}/g) ?? [])].filter((t) => t !== "symbol");
  const patterns = !patArg || patArg === "auto"
    ? synthesizePattern({ must: [...opts.get("--fail") ?? [], ...opts.get("--trap") ?? []], passes: opts.get("--pass") ?? [], hint }, language, name)
    : patternsIn(patArg, name);
  if (typeof patterns === "string") return patterns;
  const glob = opts.get("--files")?.[0];
  const scoped = glob === undefined ? patterns : patterns.map((p) => p.files === undefined ? { ...p, files: [glob] } : p);
  const one = (o: string) => opts.get(o)![0]!;
  const drafted = draftRule(files, { ns, area, name, language, patterns: scoped, message: one("--message"), why: one("--why"), fix: one("--fix") });
  return typeof drafted === "string" ? drafted : { ...files, ...drafted };
}

const escape = regexLiteral;

// Shapes that name the habit come first: the callee (any receiver, then exact) and the imported
// module. Each single-line node as written comes last, since it fits only the line it came from.
function candidateRules(root: Node): { general: MatchRule[]; literal: MatchRule[] } {
  const general: MatchRule[] = [], literal: MatchRule[] = [];
  const walk = (n: Node): void => {
    if (n.isNamed) {
      general.push(...callRules(n), ...importRules(n));
      if (!n.text.includes("\n") && n.text.length <= 80 && !["program", "module", "source_file", "identifier"].includes(n.type)) {
        literal.push({ kind: n.type, regex: `^${escape(n.text)}$` });
      }
    }
    for (const c of n.namedChildren) walk(c);
  };
  walk(root);
  return { general, literal };
}

function callRules(n: Node): MatchRule[] {
  const fn = n.childForFieldName("function") ?? n.childForFieldName("macro");
  if (!fn || fn.text.includes("\n") || !["call_expression", "call", "macro_invocation"].includes(n.type)) return [];
  const field = n.type === "macro_invocation" ? "macro" : "function";
  const prop = fn.childForFieldName("property") ?? fn.childForFieldName("field") ?? fn.childForFieldName("attribute");
  const last = prop?.text ?? (/^[\w$]+$/.test(fn.text) ? fn.text : null);
  return [...(last === null ? [] : [{ kind: n.type, has: { field, regex: `(^|\\.)${escape(last)}$` } }]), { kind: n.type, has: { field, regex: `^${escape(fn.text)}$` } }];
}

function importRules(n: Node): MatchRule[] {
  if (n.type === "import_statement" || n.type === "export_statement") {
    const spec = n.childForFieldName("source")?.namedChildren.find((c) => c.type === "string_fragment")?.text;
    return spec === undefined ? [] : [specifierRule(`^${escape(spec)}(/|$)`)];
  }
  const module = n.type === "import_from_statement" ? n.childForFieldName("module_name") : null;
  return module ? [{ kind: "import_from_statement", has: { field: "module_name", regex: `^${escape(module.text)}(\\.|$)` } }] : [];
}

// A source text at a project-relative path: a draft case before it becomes a fixture.
export type Sample = { rel: string; text: string };
export type Samples = { must: Sample[]; passes: Sample[]; hint: string[] };

function synthesizePattern(files: { must: string[]; passes: string[]; hint: string[] }, language: RuleLanguage, name: string): PatternConfig[] | string {
  for (const file of [...files.must, ...files.passes]) if (target(file).startsWith("../") || !existsSync(resolve(file))) return `${file} must be an existing file inside the current directory.`;
  const sample = (file: string): Sample => ({ rel: target(file), text: readFileSync(resolve(file), "utf8") });
  return synthesize({ must: files.must.map(sample), passes: files.passes.map(sample), hint: files.hint }, language, name);
}

// Candidates come from every case that must fail (fails and traps); those naming a word of the
// check's name or message are tried first. The first that reports every must-fail case and no
// pass wins.
export function synthesize(samples: Samples, language: RuleLanguage, name: string): PatternConfig[] | string {
  const general: MatchRule[] = [], literal: MatchRule[] = [];
  for (const { rel, text } of samples.must) {
    const parsed = parseTree(rel, text);
    const found = releaseTree(parsed, () => candidateRules(parsed.root));
    general.push(...found.general);
    literal.push(...found.literal);
  }
  const hinted = (rule: MatchRule) => samples.hint.some((t) => (rule.has?.regex ?? rule.regex ?? "").toLowerCase().includes(t));
  const ordered = [...general.filter(hinted), ...general.filter((r) => !hinted(r)), ...literal];
  for (const rule of new Map(ordered.map((r) => [JSON.stringify(r), r])).values()) {
    const check: Check = { id: `draft/synth/${name}`, version: "1.0.0", area: "synth", cardinality: "singleton", dimension: "synth",
      minSeverity: null, params: {}, impl: { kind: "pattern", patterns: { [language]: [{ id: name, rule }] } },
      phase: ["pre"], feedback: { message: "synth" }, ...(language !== "typescript" ? { languages: [language] } : {}) };
    const hits = (s: Sample) => sampleLines(check, language, s);
    if (samples.must.every((s) => { const r = hits(s); return Array.isArray(r) && r.length > 0; })
      && samples.passes.every((s) => { const r = hits(s); return Array.isArray(r) && r.length === 0; })) return [{ id: name, rule }];
  }
  return "Could not synthesize a pattern separating --fail and --pass; supply --pattern <rule.json>.";
}

// The lines `check` reports in one sample, or why it cannot be evaluated.
export function sampleLines(check: Check, language: RuleLanguage, sample: Sample): number[] | string {
  return matchedLines(check, { language, params: {}, target: sample.rel, before: null, expect: { verdict: "pass" } }, { [`files/${sample.rel}.fixture`]: sample.text }, clock);
}

function releaseTree<T>(parsed: Parsed, use: () => T): T {
  try {
    return use();
  } finally {
    parsed.root.tree.delete();
  }
}

function patternDocument(file: string): { doc: unknown } | string {
  try {
    return { doc: JSON.parse(readFileSync(resolve(file), "utf8")) };
  } catch (e) {
    return `Cannot read pattern ${file}: ${(e as Error).message}`;
  }
}

// A file with one `{ "rule": … }` config or an array of `{ "id", "rule" }` configs.
function patternsIn(file: string, name: string): PatternConfig[] | string {
  const read = patternDocument(file);
  if (typeof read === "string") return read;
  const { doc } = read;
  const list = Array.isArray(doc) ? doc : [doc];
  if (!list.length || list.some((p) => typeof p !== "object" || p === null || typeof (p as PatternConfig).rule !== "object")) {
    return `${file} must hold { "rule": { … } } or an array of { "id", "rule" } pattern configs.`;
  }
  return list.map((p, i) => ({ ...(p as PatternConfig), id: (p as PatternConfig).id ?? (list.length === 1 ? name : `${name}-${i + 1}`) }));
}

function addCases(files: Files, dir: string, check: Check, opts: Options): Files | string {
  const language = Object.keys(check.impl.kind === "pattern" ? check.impl.patterns : {})[0] as RuleLanguage | undefined;
  if (language === undefined) return `${check.id} is not a pattern check; rules draft only extends pattern checks.`;
  const today = new Date().toISOString().slice(0, 10);
  const globs = check.impl.kind === "pattern" ? check.impl.patterns[language]?.[0]?.files : undefined;
  let out = files;
  for (const kind of ["fail", "pass", "trap"] as DraftKind[]) {
    for (const [i, file] of (opts.get(`--${kind}`) ?? []).entries()) {
      if (target(file).startsWith("../") || !existsSync(resolve(file))) return `${file} must be an existing file inside the current directory.`;
      const rel = placed(target(file), globs, language);
      if (rel === null) return `Cannot place a fixture for ${file} under --files ${globs!.join(", ")}; pass a file whose path matches it.`;
      const text = readFileSync(resolve(file), "utf8");
      const lines = matchedLines(check, { language, params: {}, target: rel, before: null, expect: { verdict: "pass" } }, { [`files/${rel}.fixture`]: text }, clock);
      if (typeof lines === "string") return `Cannot evaluate ${file}: ${lines}`;
      if (kind === "pass" && lines.length) return `The pattern reports line ${lines.join(", ")} in the corrected code ${file}; narrow it.`;
      if (kind !== "pass" && !lines.length) return `The pattern does not catch ${file}; widen it until it reports the bad code.`;
      out = { ...out, ...draftCase(out, dir, language, { kind, target: rel, text, lines, note: opts.get("--trap-note")?.[i] ?? "", today }) };
    }
  }
  return out;
}

// A rule scoped with `files` sees only fixtures under that scope: a case written elsewhere moves
// into it under the same name.
function placed(rel: string, globs: string[] | undefined, language: RuleLanguage): string | null {
  if (globs === undefined || globs.some((glob) => matches(glob, rel))) return rel;
  const moved = fixtureTarget(globs[0]!, rel);
  return globs.some((glob) => matches(glob, moved)) && languageOf(moved) === language ? moved : null;
}

function patternLine(check: Check): string {
  return check.impl.kind === "pattern" ? Object.values(check.impl.patterns).flat().map((p) => JSON.stringify(p!.rule)).join(" | ") : check.impl.kind;
}

function target(file: string): string {
  return slash(relativePath(process.cwd(), resolve(file)));
}

export function languageOf(rel: string): RuleLanguage | null {
  const grammar = grammarOf(rel);
  return grammar === null ? null : grammar === "tsx" ? "typescript" : grammar;
}
