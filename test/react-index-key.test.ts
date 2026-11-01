import { beforeAll, expect, test } from "bun:test";
import { fixtureLock } from "../src/compile.ts";
import { analyze } from "../src/evaluate.ts";
import { clock, grammars } from "../src/gate.ts";
import { librarySource } from "../src/library.ts";
import type { Check } from "../src/types.ts";

beforeAll(grammars);
function findings(source: string): number {
  const check = JSON.parse(librarySource("react")!["checks/components/no-array-index-key/check.json"]!) as Check;
  const out = analyze(fixtureLock(check, {}, undefined), "pre", "src/placeholders.tsx", source, { read: () => null, now: clock });
  if ("cause" in out) throw new Error(out.cause);
  return out.violations.length;
}

test.each([
  'const list = Array.from({ length: 7 }, (_, index) => <div key={index} className="pulse" />);',
  'const list = Array.from({ length: 0 }, (_, i) => <span key={i} />);',
  'const list = Array.from({ length: 5 }, (unused, position) => <div key={position}><span>{position}</span></div>);',
  'const list = Array.from({ length: 5 }, (_, idx) => { return <div key={idx} />; });',
  'const list = items.map(item => <li key={item.id}>{item.name}</li>);',
  'function render(item: any, id: string) { return <li key={id}>{item.name}</li>; }',
  'const render = Other => Array.from({ length: 7 }, (_, index) => <div key={index} />);',
  'try {} catch (Other) { const list = Array.from({ length: 7 }, (_, index) => <div key={index} />); }',
  'const render = function Other() { return Array.from({ length: 7 }, (_, index) => <div key={index} />); };',
  'const render = Array => Array; const list = Array.from({ length: 7 }, (_, index) => <div key={index} />);',
  'try {} catch (Array) {} const list = Array.from({ length: 7 }, (_, index) => <div key={index} />);',
  'const render = function Array() {}; const list = Array.from({ length: 7 }, (_, index) => <div key={index} />);',
])("fixed literal position-only placeholders and data identity pass: %s", source => {
  expect(findings(source)).toBe(0);
});

test.each([
  'const list = items.map((item, index) => <li key={index}>{item.name}</li>);',
  'const list = items.map((item, position) => <li key={position}>{item.name}</li>);',
  'const list = items.sort().map((item, index) => <li key={index}>{item.name}</li>);',
  'const list = Array.from({ length: count }, (_, index) => <div key={index} />);',
  'const list = Array.from({ length: -1 }, (_, index) => <div key={index} />);',
  'const list = Array.from({ length: 2.5 }, (_, index) => <div key={index} />);',
  'const list = Array.from({ length: 7 }, (_, index) => <div key={index}>{items[index]}</div>);',
  'const list = Array.from({ length: 7 }, (_, index) => <div key={index}><span>{items[index].name}</span></div>);',
  'const list = Array.from({ length: 7 }, (item, index) => <div key={index}>{item}</div>);',
  'const list = Array.from({ length: 7 }, (_, index) => <div key={String(index)} />);',
  'const list = items.map((item, index) => <li key={String(index) + suffix} />);',
  'const list = items.map((item, index) => <li key={(String(index))} />);',
  'const list = Array.from({ length: 7 }, (_, index) => <div key={(index)} />);',
  'const list = Array.from({ length: 7 }, (_, index) => <Card key={index} position={index} />);',
  'const list = Array.from({ length: 7 }, (_, index) => <div key={index} title={data.title} />);',
  'const list = Array.from({ length: 7, 0: data }, (_, index) => <div key={index} />);',
  'const list = Array.from({ length: 7 }).map((_, index) => <div key={index} />);',
  'function render(Array: any) { return Array.from({ length: 7 }, (_, index) => <div key={index} />); }',
  'const render = Array => Array.from({ length: 7 }, (_, index) => <div key={index} />);',
  'try {} catch (Array) { const list = Array.from({ length: 7 }, (_, index) => <div key={index} />); }',
  'const render = function Array() { return Array.from({ length: 7 }, (_, index) => <div key={index} />); };',
  'const Array = custom; const list = Array.from({ length: 7 }, (_, index) => <div key={index} />);',
  'import Array from "custom"; const list = Array.from({ length: 7 }, (_, index) => <div key={index} />);',
  'import { Builder as Array } from "custom"; const list = Array.from({ length: 7 }, (_, index) => <div key={index} />);',
  'function Array() {} const list = Array.from({ length: 7 }, (_, index) => <div key={index} />);',
])("unproved generator/data/index shapes retain findings: %s", source => {
  expect(findings(source)).toBe(1);
});
