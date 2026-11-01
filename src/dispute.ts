import type { CallEvent, Files, Fixture } from "./types.ts";
import { fixtureLock, patternsOf } from "./compile.ts";
import { equal } from "./schema.ts";

// Candidates assert the human's intended result; they never change the active contract.
export function disputeFixtures(event: CallEvent, id: string, after: string, before: string | null): Files {
  const files: Files = {};
  const json = (value: unknown) => JSON.stringify(value, null, 2) + "\n";
  for (const rule of event.dispute?.rules ?? []) {
    const check = rule.check.split("@")[0]!;
    const definition = event.dispute?.checks[rule.id];
    if (definition === undefined || `${definition.id}@${definition.version}` !== rule.check) throw new Error("Dispute needs the recorded check definition.");
    const target = event.violations.find((v) => v.rule === rule.id)?.path;
    if (target === undefined || target.startsWith("/") || target.split("/").some((p) => p === ".." || p === "." || p === "")) throw new Error("Dispute needs a repo-relative target.");
    if (!/^[a-z][a-z0-9-]*\/[a-z][a-z0-9-]*\/[a-z][a-z0-9-]*$/.test(check)) throw new Error("Dispute needs a valid check ID.");
    const dir = `${check.split("/")[0]}/checks/${check.split("/").slice(1).join("/")}/fixtures/pass/dispute-${id}`;
    const params = { ...rule.params };
    if (patternsOf(definition.impl).some((p) => p.files !== undefined)) delete params.paths;
    const replay = fixtureLock(definition, params, event.dispute!.context).rules[0]!;
    if (!equal(replay.impl, rule.impl) || !equal(replay.params, rule.params)) throw new Error("Recorded check differs from the denied rule.");
    const fixture: Fixture = { language: "typescript", params, context: event.dispute!.context,
      target, before: before === null ? null : "before/", expect: { verdict: "pass" } };
    files[`${dir}/fixture.json`] = json(fixture);
    files[`${dir}/CHECK.json`] = json(definition);
    files[`${dir}/files/${target}.fixture`] = after;
    if (before !== null) files[`${dir}/before/${target}.fixture`] = before;
    files[`${dir}/NOTE.md`] = `# Disputed denial\n\nEvent: ${id}\nRule: ${rule.id}\nCheck: ${rule.check}\nTarget: ${target}\n\nThe user disputes this denial. Review why this code should pass, then fix the check\nwith this regression case and preserve its existing pass/fail/trap cases.\nDo not weaken the preset or add an exception to make this case pass.\n`;
  }
  return files;
}
