// Index keys are admitted only for a literal, fixed-length positional placeholder list.
// Data expressions, custom renderers and transformations need stable item identity.
import type { Node, Parsed } from "./ts.ts";

const members = (n: Node | null): Node[] => n?.namedChildren.filter(c => c.type !== "comment") ?? [];
const field = (n: Node | null, name: string): Node | null => n?.childForFieldName(name) ?? null;
const FUNCTIONS = ["arrow_function", "function_expression", "function_declaration", "method_definition"];
const SCOPES = ["program", "statement_block", ...FUNCTIONS];
const INDEX = new Set(["index", "i", "idx"]);

function unwrap(n: Node): Node {
  while (n.type === "parenthesized_expression") n = members(n)[0]!;
  return n;
}
function parameters(fn: Node): Node[] {
  const single = field(fn, "parameter");
  if (single) return [single];
  return members(field(fn, "parameters")).map(p => field(p, "pattern") ?? p);
}
function scope(n: Node): Node {
  while (n.parent && !SCOPES.includes(n.type)) n = n.parent;
  return n;
}
function shadowedArray(at: Node): boolean {
  for (let up: Node | null = at; up; up = up.parent) {
    if ((FUNCTIONS.includes(up.type) || up.type === "catch_clause") && parameters(up).some(p => p.text === "Array" || p.descendantsOfType("identifier").some(n => n.text === "Array"))) return true;
    if (up.type === "function_expression" && field(up, "name")?.text === "Array") return true;
    if (!SCOPES.includes(up.type)) continue;
    if (up.descendantsOfType(["variable_declarator", "function_declaration", "class_declaration", "import_specifier", "namespace_import"])
      .some(n => scope(n.type === "function_declaration" ? n.parent! : n).id === up!.id
        && (field(n, "alias") ?? field(n, "name") ?? members(n)[0])?.text === "Array")) return true;
    if (up.type === "program" && up.descendantsOfType("import_clause").some(n => members(n).some(c => c.type === "identifier" && c.text === "Array"))) return true;
  }
  return false;
}
function callback(at: Node): Node | null {
  for (let up = at.parent; up; up = up.parent) if (FUNCTIONS.includes(up.type)) return up;
  return null;
}
function callbackIndex(fn: Node): Node | undefined {
  const args = fn.parent, call = args?.parent, callee = field(call ?? null, "function");
  if (args?.type !== "arguments" || call?.type !== "call_expression" || callee?.type !== "member_expression") return undefined;
  const property = field(callee, "property")?.text, callbackPosition = members(args).findIndex(n => n.id === fn.id);
  return property === "map" && callbackPosition === 0 || property === "from" && field(callee, "object")?.text === "Array" && callbackPosition === 1 ? parameters(fn)[1] : undefined;
}
function literalPlaceholder(fn: Node, index: string): boolean {
  let body = field(fn, "body");
  if (body?.type === "statement_block") {
    const statements = members(body);
    body = statements.length === 1 && statements[0]!.type === "return_statement" ? members(statements[0]!)[0] ?? null : null;
  }
  if (!body) return false;
  body = unwrap(body);
  if (!["jsx_element", "jsx_self_closing_element", "jsx_fragment"].includes(body.type)) return false;
  const tags = body.descendantsOfType(["jsx_opening_element", "jsx_self_closing_element"]);
  if (tags.some(tag => !/^[a-z][a-z0-9-]*$/.test(field(tag, "name")?.text ?? ""))) return false;
  return body.descendantsOfType("jsx_expression").every(expression => {
    const value = members(expression)[0];
    return !value || ["string", "number", "true", "false", "null"].includes(value.type)
      || (value.type === "identifier" && value.text === index);
  });
}
function placeholder(fn: Node, index: Node): boolean {
  const parametersOfCallback = parameters(fn), element = parametersOfCallback[0];
  if (parametersOfCallback.length !== 2 || element?.type !== "identifier" || index.type !== "identifier") return false;
  const body = field(fn, "body");
  if (body?.descendantsOfType("identifier").some(n => n.text === element.text)) return false;
  const args = fn.parent;
  const call = args?.parent;
  if (args?.type !== "arguments" || call?.type !== "call_expression" || members(args)[1]?.id !== fn.id) return false;
  const callee = field(call, "function");
  if (callee?.type !== "member_expression" || field(callee, "object")?.text !== "Array" || field(callee, "property")?.text !== "from" || shadowedArray(call)) return false;
  const source = members(args)[0], pairs = source?.type === "object" ? members(source) : [];
  const length = pairs.length === 1 && pairs[0]!.type === "pair" && field(pairs[0]!, "key")?.text === "length" ? field(pairs[0]!, "value") : null;
  if (length?.type !== "number" || !Number.isSafeInteger(Number(length.text)) || Number(length.text) < 0) return false;
  return literalPlaceholder(fn, index.text);
}

export function reactIndexKeys(p: Parsed): Node[] {
  return p.root.descendantsOfType("jsx_attribute").filter(attribute => {
    const [name, value] = members(attribute), expression = value?.type === "jsx_expression" ? members(value)[0] : null;
    if (name?.text !== "key" || !expression) return false;
    const fn = callback(attribute), index = fn && callbackIndex(fn);
    const isIndex = (n: Node) => n.type === "identifier" && (INDEX.has(n.text) || n.text === index?.text);
    const direct = isIndex(expression);
    const wrapped = expression.descendantsOfType(["call_expression", "parenthesized_expression"])
      .some(n => n.descendantsOfType("identifier").some(isIndex));
    if (!direct && !wrapped) return false;
    return !(direct && fn && index && expression.text === index.text && placeholder(fn, index));
  });
}
