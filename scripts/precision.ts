// Sample precision for a pack audit. A pack with no matching maintainer label stays unmeasured.
// Precision is true positives / labeled findings, and it does not describe unlabeled findings.

export type SampleVerdict = "true-positive" | "false-positive";

export interface FindingSite {
  corpus: string;
  pack: string;
  rule: string;
  path: string;
  line: number;
  symbol: string;
}

export interface SampleLabel extends FindingSite {
  verdict: SampleVerdict;
  note: string;
}

export interface PackPrecision {
  pack: string;
  findings: number;
  labeled: number;
  truePositives: number;
  falsePositives: number;
  precision: number | null;
}

export interface CorpusRow {
  id: string;
  language: string;
  kind: "git" | "path";
  url: string | null;
  commit: string;
  sourceFiles: number;
  parsed: number;
}

export interface PrecisionReport {
  schemaVersion: 1;
  engine: string;
  core: string;
  labeler: "maintainer" | null;
  corpus: CorpusRow[];
  packs: PackPrecision[];
  sample: SampleLabel[];
  limits: string[];
}

export const LIMITS = [
  "Sample precision is true positives divided by the maintainer-labeled findings of that pack. Unlabeled findings are not in the denominator and have no precision.",
  "A pack with no matching maintainer label is unmeasured. This report does not give it a precision.",
  "A label says whether the finding matches the rule's stated condition. It is not a judgment that a project should adopt the rule.",
  "The corpus is the pinned commits in the manifest. It is not a random sample of public code.",
  "The audit records static matches in the checked-out tree. It is not the no-new ratchet used on an edit, and it does not run fitness, diff, or placement checks.",
  "Vue and Svelte single-file components use the TypeScript grammar. This corpus has no .vue or .svelte file, so a zero there is not evidence about those rules.",
  "Tracked files under node_modules, vendor, dist, build, coverage, .next, or target are not scanned. Symlinks are not followed.",
];

const FILE_KEYS = ["labeler", "pack", "items"];
const ITEM_KEYS = ["corpus", "pack", "rule", "path", "line", "symbol", "verdict", "note"];

export function siteKey(site: FindingSite): string {
  return [site.corpus, site.pack, site.rule, site.path, String(site.line), site.symbol].join("\0");
}

export function precisionRatio(truePositives: number, falsePositives: number): number | null {
  const labeled = truePositives + falsePositives;
  if (labeled === 0) return null;
  return truePositives / labeled;
}

export function precisionText(row: PackPrecision): string {
  if (row.precision === null || row.labeled === 0) return "unmeasured";
  return `${row.truePositives}/${row.labeled}`;
}

export function applyLabels(packNames: string[], findings: FindingSite[], labels: SampleLabel[]): {
  packs: PackPrecision[];
  matched: SampleLabel[];
  unmatched: SampleLabel[];
} {
  const known = new Set(findings.map(siteKey));
  const byPack = groupFindings(packNames, findings);
  const split = splitLabels(labels, known);
  const packs = [...byPack.entries()].map(([pack, rows]) => packRow(pack, rows, split.byKey));
  packs.sort(byVolume);
  return { packs, matched: split.matched, unmatched: split.unmatched };
}

export function parseLabelFile(text: string, file: string): SampleLabel[] {
  const doc = record(parseJson(text, file), file);
  exactKeys(doc, FILE_KEYS, file);
  if (stringField(doc, "labeler", file) !== "maintainer") throw new Error(`${file}: labeler must be maintainer`);
  const pack = stringField(doc, "pack", file);
  return arrayField(doc, "items", file).map((item, index) => parseItem(item, pack, `${file}#${index}`));
}

export function assertUniqueLabels(labels: SampleLabel[]): void {
  const seen = new Set<string>();
  for (const label of labels) {
    const key = siteKey(label);
    if (seen.has(key)) throw new Error(`duplicate label for ${label.pack} ${label.rule} ${label.path}:${label.line}`);
    seen.add(key);
  }
}

export function renderPrecision(report: PrecisionReport): string {
  const lines = [
    "## Measured sample precision",
    "",
    intro(report),
    "",
    `Engine ${report.engine}, core ${report.core}.`,
    "",
    "Maintainer-labeled sample: " + sampleSummary(report) + ". Packs that do not appear in that sample are unmeasured.",
    "",
    ...methodSection(),
    ...corpusSection(report),
    ...countSection(report),
    ...sampleSection(report),
    "## Limits",
    "",
    ...report.limits.map((limit) => `- ${limit}`),
    "",
    "## Reproduce",
    "",
    "```sh",
    "bun scripts/bench-audit-repos.ts --precision \\",
    "  --corpus bench/corpus.json \\",
    "  --labels bench/labels \\",
    "  --cache .cache/precision \\",
    "  --out bench/precision-report.json \\",
    "  --markdown bench/precision.md",
    "```",
    "",
  ];
  return `${lines.join("\n")}\n`;
}

function groupFindings(packNames: string[], findings: FindingSite[]): Map<string, FindingSite[]> {
  const byPack = new Map<string, FindingSite[]>();
  for (const name of packNames) byPack.set(name, []);
  for (const finding of findings) {
    const list = byPack.get(finding.pack) ?? [];
    list.push(finding);
    byPack.set(finding.pack, list);
  }
  return byPack;
}

function splitLabels(labels: SampleLabel[], known: Set<string>): {
  matched: SampleLabel[];
  unmatched: SampleLabel[];
  byKey: Map<string, SampleLabel>;
} {
  const matched: SampleLabel[] = [];
  const unmatched: SampleLabel[] = [];
  const byKey = new Map<string, SampleLabel>();
  for (const label of labels) {
    const key = siteKey(label);
    if (!known.has(key)) unmatched.push(label);
    else { matched.push(label); byKey.set(key, label); }
  }
  return { matched, unmatched, byKey };
}

function packRow(pack: string, rows: FindingSite[], labels: Map<string, SampleLabel>): PackPrecision {
  let truePositives = 0;
  let falsePositives = 0;
  for (const row of rows) {
    const label = labels.get(siteKey(row));
    if (!label) continue;
    if (label.verdict === "true-positive") truePositives += 1;
    else falsePositives += 1;
  }
  const labeled = truePositives + falsePositives;
  return { pack, findings: rows.length, labeled, truePositives, falsePositives, precision: precisionRatio(truePositives, falsePositives) };
}

function byVolume(a: PackPrecision, b: PackPrecision): number {
  if (b.findings !== a.findings) return b.findings - a.findings;
  if (a.pack < b.pack) return -1;
  if (a.pack > b.pack) return 1;
  return 0;
}

function parseItem(value: unknown, pack: string, at: string): SampleLabel {
  const item = record(value, at);
  exactKeys(item, ITEM_KEYS, at);
  const got = stringField(item, "pack", at);
  if (got !== pack) throw new Error(`${at}: pack ${got} does not match ${pack}`);
  const verdict = verdictOf(stringField(item, "verdict", at), at);
  const note = stringField(item, "note", at);
  if (note.trim() === "") throw new Error(`${at}: note must explain the verdict`);
  return {
    corpus: stringField(item, "corpus", at), pack, rule: stringField(item, "rule", at),
    path: stringField(item, "path", at), line: lineOf(item.line, at), symbol: stringField(item, "symbol", at), verdict, note,
  };
}

function verdictOf(value: string, at: string): SampleVerdict {
  if (value === "true-positive" || value === "false-positive") return value;
  throw new Error(`${at}: verdict must be true-positive or false-positive`);
}

function lineOf(value: unknown, at: string): number {
  if (typeof value === "number" && Number.isInteger(value) && value >= 1) return value;
  throw new Error(`${at}: line must be a positive integer`);
}

function intro(report: PrecisionReport): string {
  const files = report.corpus.reduce((sum, row) => sum + row.sourceFiles, 0);
  const findings = report.packs.reduce((sum, row) => sum + row.findings, 0);
  const labeled = report.packs.filter((row) => row.precision !== null);
  return `This run audited ${report.packs.length} packs on ${report.corpus.length} pinned ${report.corpus.length === 1 ? "tree" : "trees"} (${files} source files) and recorded **${findings} findings**. Sample precision is shown for ${labeled.length} maintainer-labeled ${labeled.length === 1 ? "pack" : "packs"}. Every other pack is unmeasured.`;
}

function sampleSummary(report: PrecisionReport): string {
  const tp = report.sample.filter((item) => item.verdict === "true-positive").length;
  const fp = report.sample.filter((item) => item.verdict === "false-positive").length;
  return `${tp} true-positive, ${fp} false-positive`;
}

function methodSection(): string[] {
  return [
    "## Method",
    "",
    "1. Shallow-fetch each git entry at its pinned commit into `.cache/precision` (or `--cache`). Reuse a clean cache whose HEAD is that commit. Check the scanned source sha256 against the manifest. With `--skip-offline`, a failed fetch leaves the written report untouched. A path entry must already be a checkout of its commit.",
    "2. For each pack, compile a shadow preset of the builtin core plus that pack's methodologies. If those methodologies do not compile together, compile each one on its own. Count static findings from the same file audit `pregate audit` uses. One finding is one site: corpus, pack, rule, path, line, and symbol.",
    "3. Read `bench/labels/<pack>.json`. Each file is a maintainer-labeled sample: `true-positive` or `false-positive`, plus a note. A label that does not match a finding is an error. Precision is `true-positive / (true-positive + false-positive)` for packs with at least one matching label.",
    "",
    "Engine and core versions are recorded on the report. Re-running the command on the same pins and the same engine reproduces the counts.",
    "",
  ];
}

function corpusSection(report: PrecisionReport): string[] {
  const rows = report.corpus.map((row) => `| ${row.id} | ${row.language} | ${row.kind} | \`${row.commit}\` | ${row.sourceFiles} | ${row.parsed} |`);
  const urls = report.corpus.filter((row) => row.url).map((row) => `- ${row.id}: ${row.url}`);
  return [
    "## Corpus",
    "",
    "| Id | Language | Kind | Commit | Source files | Parsed |",
    "| --- | --- | --- | --- | ---: | ---: |",
    ...rows,
    "",
    ...urls,
    "",
  ];
}

function countSection(report: PrecisionReport): string[] {
  const rows = report.packs.map((row) => `| ${row.pack} | ${row.findings} | ${row.labeled} | ${row.truePositives} | ${row.falsePositives} | ${precisionText(row)} |`);
  return [
    "## Per-pack counts",
    "",
    "A fraction is the maintainer-labeled sample only. Unmeasured means this report states no precision for that pack.",
    "",
    "| Pack | Findings | Labeled | True positives | False positives | Sample precision |",
    "| --- | ---: | ---: | ---: | ---: | --- |",
    ...rows,
    "",
  ];
}

function sampleSection(report: PrecisionReport): string[] {
  if (report.sample.length === 0) return ["## Maintainer-labeled sample", "", "No finding was labeled.", ""];
  const rows = report.sample.map((item) => `| ${item.verdict} | ${item.pack} | \`${item.rule}\` | ${item.corpus} \`${item.path}:${item.line}\` \`${item.symbol}\` | ${cell(item.note)} |`);
  return [
    "## Maintainer-labeled sample",
    "",
    "These notes were written by the maintainer after reading the pinned source at that line. They are not a model-graded score.",
    "",
    "| Verdict | Pack | Rule | Location | Note |",
    "| --- | --- | --- | --- | --- |",
    ...rows,
    "",
  ];
}

function cell(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}

function parseJson(text: string, file: string): unknown {
  try { return JSON.parse(text) as unknown; }
  catch { throw new Error(`${file}: invalid JSON`); }
}

function record(value: unknown, at: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`${at}: expected an object`);
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, keys: string[], at: string): void {
  for (const key of Object.keys(value)) {
    if (!keys.includes(key)) throw new Error(`${at}: unknown field ${key}`);
  }
  for (const key of keys) {
    if (!Object.hasOwn(value, key)) throw new Error(`${at}: missing ${key}`);
  }
}

function stringField(value: Record<string, unknown>, key: string, at: string): string {
  const got = value[key];
  if (typeof got !== "string" || got === "") throw new Error(`${at}: ${key} must be a non-empty string`);
  return got;
}

function arrayField(value: Record<string, unknown>, key: string, at: string): unknown[] {
  const got = value[key];
  if (!Array.isArray(got)) throw new Error(`${at}: ${key} must be an array`);
  return got;
}
