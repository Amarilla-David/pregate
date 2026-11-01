import { writeSync } from "node:fs";

type Stage = "input" | "admission" | "parse" | "rules" | "dependency-review" | "stop-inventory";
const PREFIX = "PREGATE-CHECKPOINT ";
const MARKER = /^PREGATE-CHECKPOINT (input|admission|parse|rules|dependency-review|stop-inventory)\r?$/;
const IMPORT_RULES = /^PREGATE-IMPORT-REVIEW rules=((?:none|[a-z][a-z0-9-]*\/[A-Za-z][A-Za-z0-9-]*(?:\/[a-z][a-z0-9-]*)?(?:,[a-z][a-z0-9-]*\/[A-Za-z][A-Za-z0-9-]*(?:\/[a-z][a-z0-9-]*)?)*)(?:,more=[1-9][0-9]*)?)\r?$/;
const IMPORT_TIME = /^PREGATE-IMPORT-REVIEW completed=([0-9]+\.[0-9])ms\r?$/;
const RULE_ID = "[a-z][a-z0-9-]*/[A-Za-z][A-Za-z0-9-]*(?:/[a-z][a-z0-9-]*)?";
const RULE_START = new RegExp(`^PREGATE-RULE started=(${RULE_ID})\\r?$`);
const RULE_END = new RegExp(`^PREGATE-RULE completed=(${RULE_ID}) ([0-9]+\\.[0-9])ms\\r?$`);
const RESOLUTION_START = /^PREGATE-RESOLUTION started\r?$/;
const RESOLUTION_END = /^PREGATE-RESOLUTION completed=([0-9]+\.[0-9])ms\r?$/;
const STOP_ROOT = /^PREGATE-STOP-ROOT ([1-9][0-9]{0,5}\/[1-9][0-9]{0,5}) (\/[^\r\n]{0,1023}|[A-Za-z]:[\\/][^\r\n]{0,1020})\r?$/;
let last: Stage | null = null;
// The launcher opens fd 5 for progress so stderr carries only the decision; the supervisor and
// direct runs keep the stderr protocol.
const FD = process.env.PREGATE_PROGRESS_FD === "5" ? 5 : 2;

// Internal stderr protocol. The launcher consumes fixed labels, qualified rule IDs and the
// absolute project root a Stop is judging; no source, input, file paths or rule payloads.
export function checkpoint(stage: Stage): void {
  if (process.env.PREGATE_PROGRESS !== "1" || stage === last) return;
  last = stage;
  writeSync(FD, PREFIX + stage + "\n");
}

// Stop judges roots one by one. The ordinal names the fan-out, and each root restarts the
// stage sequence, so its first checkpoint is never dropped as a repeat of the previous root.
export function stopRootProgress(index: number, total: number, root: string): void {
  if (process.env.PREGATE_PROGRESS !== "1") return;
  last = null;
  const marker = `PREGATE-STOP-ROOT ${index}/${total} ${root}`;
  if (STOP_ROOT.test(marker)) writeSync(FD, marker + "\n");
}

// Resolution and baseline facts are shared by these rules. This duration belongs
// to the complete import review, not to an individual rule or an inferred cause.
export function importReviewProgress<T>(rules: string[], run: () => T): T {
  if (process.env.PREGATE_PROGRESS !== "1") return run();
  const all = [...new Set(rules)].sort(), selected = all.filter(id => id.length <= 256).slice(0, 8);
  const ids = (selected.join(",") || "none") + (selected.length < all.length ? `,more=${all.length - selected.length}` : "");
  if (!IMPORT_RULES.test(`PREGATE-IMPORT-REVIEW rules=${ids}`)) return run();
  writeSync(FD, `PREGATE-IMPORT-REVIEW rules=${ids}\n`);
  const start = performance.now();
  const result = run();
  writeSync(FD, `PREGATE-IMPORT-REVIEW completed=${(performance.now() - start).toFixed(1)}ms\n`);
  return result;
}

// A start without its completion identifies the operation still executing when
// the supervisor terminates the engine. Completed work is never blamed later.
export function ruleEvaluationProgress<T>(rule: string, run: () => T): T {
  if (process.env.PREGATE_PROGRESS !== "1" || rule.length > 256 || !RULE_START.test(`PREGATE-RULE started=${rule}`)) return run();
  writeSync(FD, `PREGATE-RULE started=${rule}\n`);
  const start = performance.now();
  const result = run();
  writeSync(FD, `PREGATE-RULE completed=${rule} ${(performance.now() - start).toFixed(1)}ms\n`);
  return result;
}

export function sharedResolutionProgress<T>(run: () => T): T {
  if (process.env.PREGATE_PROGRESS !== "1") return run();
  writeSync(FD, "PREGATE-RESOLUTION started\n");
  const start = performance.now();
  const result = run();
  writeSync(FD, `PREGATE-RESOLUTION completed=${(performance.now() - start).toFixed(1)}ms\n`);
  return result;
}

export function progressOutput(stderr: string): { stderr: string; detail: string } {
  let stage = "", root = "";
  let rules = "", duration = "";
  const operations: { kind: "rule" | "resolution"; rule?: string }[] = [];
  const lines = stderr.split("\n").filter(line => {
    const matched = MARKER.exec(line);
    if (matched) { stage = matched[1]!; operations.length = 0; return false; }
    const judged = STOP_ROOT.exec(line);
    if (judged) { root = `; root ${judged[1]} ${judged[2]}`; stage = rules = duration = ""; operations.length = 0; return false; }
    const ids = IMPORT_RULES.exec(line);
    if (ids) { rules = ids[1]!; duration = ""; return false; }
    const time = IMPORT_TIME.exec(line);
    if (time) { duration = time[1]!; return false; }
    const rule = RULE_START.exec(line);
    if (rule && rule[1]!.length <= 256) { operations.push({ kind: "rule", rule: rule[1]! }); return false; }
    const completed = RULE_END.exec(line);
    if (completed && completed[1]!.length <= 256) { if (operations.at(-1)?.rule === completed[1]) operations.pop(); return false; }
    if (RESOLUTION_START.test(line)) { operations.push({ kind: "resolution" }); return false; }
    if (RESOLUTION_END.test(line)) { if (operations.at(-1)?.kind === "resolution") operations.pop(); return false; }
    return true;
  });
  const active = operations.at(-1);
  const operation = active?.kind === "rule" ? `; executing rule: ${active.rule}` : active?.kind === "resolution" ? "; executing shared dependency resolution" : "";
  const shared = stage === "dependency-review" && rules ? `; shared import review: ${rules}${duration ? ` (${duration} ms)` : ""}` : "";
  return { stderr: lines.join("\n"), detail: root + (stage ? `; last engine checkpoint: ${stage}` : "") + operation + shared };
}
