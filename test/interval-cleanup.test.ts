import { beforeAll, expect, test } from "bun:test";
import { fixtureLock } from "../src/compile.ts";
import { analyze } from "../src/evaluate.ts";
import { clock, grammars } from "../src/gate.ts";
import { librarySource } from "../src/library.ts";
import type { Check } from "../src/types.ts";

beforeAll(grammars);
function findings(source: string): number {
  const check = JSON.parse(librarySource("vibe-proof")!["checks/reliability/setinterval-without-clear/check.json"]!) as Check;
  const out = analyze(fixtureLock(check, {}, undefined), "pre", "src/timer.tsx", source, { read: () => null, now: clock });
  if ("cause" in out) throw new Error(out.cause);
  return out.violations.length;
}

test.each([
  "function start() { const timer = setInterval(tick, 100); return () => clearInterval(timer); }",
  "function start() { const timer = (setInterval(tick, 100)); return () => clearInterval((timer)); }",
  "import * as timers from 'node:timers'; function start() { const timer = timers.setInterval(tick, 100); return () => timers.clearInterval(timer); }",
  "let timer; function start() { timer = setInterval(tick, 100); } function stop() { clearInterval(timer); }",
  "const refs = { timer: { current: null } }; function start() { refs.timer.current = window.setInterval(tick, 100); } function stop() { window.clearInterval(refs.timer.current); }",
  "type Refs = { timer: { current: number | null } }; function start(refs: Refs) { refs.timer.current = setInterval(tick, 100); } function stop(refs: Refs) { clearInterval(refs.timer.current); }",
  "interface Refs { timer: { current: number | null } } function start(refs: Refs) { refs.timer.current = setInterval(tick, 100); } function stop(refs: Refs) { clearInterval(refs.timer.current); }",
  "type Refs = { timer: RefObject<number | null> }; type Recording = { refs: Refs }; type Start = { recording: Recording }; function start(input: Start) { const recording = input.recording; recording.refs.timer.current = window.setInterval(tick, 100); } function stop(refs: Refs) { window.clearInterval(refs.timer.current); }",
  "type Refs = { timer: number | null }; const refs: Refs = { timer: null }; function start() { refs.timer = setInterval(tick, 100); } function stop() { clearInterval(refs.timer); }",
  "type Refs = { timer: number | null }; const refs: Refs = { timer: null }; const same = refs; function start() { refs.timer = setInterval(tick, 100); } function stop() { clearInterval(same.timer); }",
  "type Refs = { timer: number | null }; function start(refs: Refs) { refs.timer = setInterval(tick, 100); clearInterval(refs.timer); }",
  "type Refs = { timer: number | null }; function start(refs: Refs) { const same = refs; refs.timer = setInterval(tick, 100); clearInterval(same.timer); }",
])("matching local or named-container cleanup handles pass: %s", source => {
  expect(findings(source)).toBe(0);
});

test.each([
  "function start() { setInterval(tick, 100); } function stop(timer: number) { clearInterval(timer); }",
  "import * as timers from 'node:timers'; function start() { timers.setInterval(tick, 100); }",
  "function start() { const timer = setInterval(tick, 100); clearInterval(other); }",
  "const refs = { timer: null }; function start() { refs.timer = setInterval(tick, 100); }",
  "const refs = { timer: null }, other = { timer: null }; function start() { refs.timer = setInterval(tick, 100); } function stop() { clearInterval(other.timer); }",
  "const refs = { timer: null, other: null }; function start() { refs.timer = setInterval(tick, 100); } function stop() { clearInterval(refs.other); }",
  "function start() { const timer = setInterval(tick, 100); } function stop() { const timer = 1; clearInterval(timer); }",
  "type A = { timer: RefObject<number> }; type B = { timer: RefObject<number> }; function start(refs: A) { refs.timer.current = setInterval(tick, 100); } function stop(refs: B) { clearInterval(refs.timer.current); }",
  "type Refs = { timer: RefObject<number>; other: RefObject<number> }; function start(refs: Refs) { refs.timer.current = setInterval(tick, 100); } function stop(refs: Refs) { clearInterval(refs.other.current); }",
  "const refs = { timer: null }; function start() { refs.timer = setInterval(tick, 100); } function stop() { clearInterval(String(refs.timer)); }",
  "function start() { const timer = setInterval(tick, 100); /* clearInterval(timer) */ }",
  "type Refs = { timer: number | null }; const refs: Refs = { timer: null }, other: Refs = { timer: null }; function start() { refs.timer = setInterval(tick, 100); } function stop() { clearInterval(other.timer); }",
  "type Refs = { timer: number | null }; const refs: Refs = { timer: null }, other: Refs = { timer: null }; const alias = other; function start() { refs.timer = setInterval(tick, 100); } function stop() { clearInterval(alias.timer); }",
  "type Refs = { timer: number | null }; const refs: Refs = createRefs(), other: Refs = createRefs(); function start() { refs.timer = setInterval(tick, 100); } function stop() { clearInterval(other.timer); }",
  "type Refs = { timer: number | null }; function start(refs: Refs, other: Refs) { refs.timer = setInterval(tick, 100); clearInterval(other.timer); }",
  "type Refs = { timer: number | null }; function start(refs: Refs, other: Refs) { const alias = other; refs.timer = setInterval(tick, 100); clearInterval(alias.timer); }",
  "type Refs = { timer: RefObject<number | null> }; type Recording = { refs: Refs }; function start(input: Recording, other: Refs) { input.refs.timer.current = setInterval(tick, 100); clearInterval(other.timer.current); }",
])("missing, unrelated or mismatched cleanup remains a finding: %s", source => {
  expect(findings(source)).toBe(1);
});

test("an unrelated clear in the enclosing block does not mask a second leak", () => {
  expect(findings("function start() { const first = setInterval(tick, 100); const second = setInterval(tick, 100); clearInterval(first); }")).toBe(1);
});
