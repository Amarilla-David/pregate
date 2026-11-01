import { beforeAll, expect, test } from "bun:test";
import { setUpGrammars } from "../src/assets.ts";
import { readTree } from "../src/disk.ts";
import { grammarOf, parse, symbolOf, symbols, type Parsed } from "../src/ts.ts";

beforeAll(setUpGrammars);

// Independent retained evaluator semantics: the old per-token field traversal.
function fieldSymbols(p: Parsed): string[] {
  const out = new Set(["<module>"]), cursor = p.root.walk();
  const visit = () => {
    const field = cursor.currentFieldName;
    if (field === "name" || field === "key") out.add(symbolOf(cursor.currentNode));
  };
  return walkFields(cursor, visit, out);
}

function walkFields(cursor: ReturnType<Parsed["root"]["walk"]>, visit: () => void, out: Set<string>): string[] {
  try {
    for (;;) {
      if (cursor.gotoFirstChild()) { visit(); continue; }
      while (!cursor.gotoNextSibling()) if (!cursor.gotoParent()) return [...out].sort();
      visit();
    }
  } finally { cursor.delete(); }
}

function compare(path: string, text: string): void {
  compareParsed(path, parse(path, text));
}

function compareParsed(path: string, p: Parsed): void {
  try { expect({ path, symbols: symbols(p) }).toEqual({ path, symbols: fieldSymbols(p) }); }
  finally { p.root.tree.delete(); }
}

test("declaration symbols preserve field-traversal semantics across every pack fixture", () => {
  let files = 0;
  for (const root of ["catalog", "packs"]) for (const [path, text] of Object.entries(readTree(root, true))) {
    const sourcePath = path.replace(/\.fixture$/, "");
    if (!path.includes("/fixtures/") || grammarOf(sourcePath) === null) continue;
    compare(sourcePath, text); files++;
  }
  expect(files).toBeGreaterThan(2000);
}, 30000);

test("nested, anonymous, computed, type and destructured declarations retain the same symbol set", () => {
  const cases = [
    'namespace A { export class B { field = () => { const inner = 1; }; ["key"]() { return { pair: function local() {} }; } } }',
    'const outer = function named() { const nested = class Inside { get value() { return 1; } }; };',
    'const {a: alias, b: {c}, d = () => 1} = input; const [x, y] = input;',
    'interface I<T> { method<U>(input: U): T; readonly field: { nested: number }; } type T = { key: string }; enum E { a, b }',
    'declare module "external" { export abstract class C { abstract method(): void; } }',
    'export default class { field = function named() {}; method() { const x = { [key]: () => 1, "literal": 2 }; } }',
    'const object = { shorthand, method() { const inner = 1; }, get value() { return 1; }, [key]: function name() {} };',
    'function* generate() { yield 1; } const fn = function* inner() {}; const arrow = <T,>(value: T) => value;',
    'function missing( { class Broken { method( { const value = ;',
    'const view = <Component prop={value}><Child /></Component>;',
  ];
  for (const text of cases) for (const path of ["a.ts", "a.tsx"]) compare(path, text);
  compare("a.py", "class A:\n def f(self):\n  local = lambda x: x\n  return local\n");
  compare("a.go", "package app\ntype A struct{}\nfunc (a A) F(value int) int { local := func() int { return value }; return local() }\n");
});

test("full current source symbols match the previous evaluator", () => {
  for (const [path, text] of Object.entries(readTree("src", true))) if (grammarOf(path)) compare(path, text);
});
