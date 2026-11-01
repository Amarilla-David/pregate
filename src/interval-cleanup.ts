// Matching handle reads supply syntactic cleanup evidence, not proof that cleanup executes.
// Sibling parameters may share a named container type; unrelated roots and types stay distinct.
import type { Node, Parsed } from "./ts.ts";

const members = (n: Node | null): Node[] => n?.namedChildren.filter(c => c.type !== "comment") ?? [];
const field = (n: Node | null, name: string): Node | null => n?.childForFieldName(name) ?? null;
const FUNCTIONS = ["arrow_function", "function_expression", "function_declaration", "method_definition"];
const SCOPES = ["program", "statement_block", ...FUNCTIONS];
type Handle = { binding: string; named?: string; owner?: number };

function scope(n: Node): Node {
  while (n.parent && !SCOPES.includes(n.type)) n = n.parent;
  return n;
}
function unwrap(n: Node): Node {
  while (["parenthesized_expression", "as_expression", "satisfies_expression", "non_null_expression"].includes(n.type)) n = members(n)[0]!;
  return n;
}
function path(n: Node): { root: Node; fields: string[] } | null {
  n = unwrap(n);
  const fields: string[] = [];
  while (n.type === "member_expression") {
    const property = field(n, "property"), object = field(n, "object");
    if (property?.type !== "property_identifier" || !object) return null;
    fields.unshift(property.text); n = unwrap(object);
  }
  return n.type === "identifier" ? { root: n, fields } : null;
}
function declaration(at: Node, name: string): Node | null {
  for (let up: Node | null = at; up; up = up.parent) {
    if (FUNCTIONS.includes(up.type)) {
      const single = field(up, "parameter"), params = single ? [single] : members(field(up, "parameters"));
      const param = params.find(n => (field(n, "pattern") ?? n).text === name);
      if (param) return param;
    }
    if (!SCOPES.includes(up.type)) continue;
    const declarations = up.descendantsOfType("variable_declarator").filter(n => scope(n).id === up!.id && field(n, "name")?.text === name);
    if (declarations.length) return declarations.length === 1 ? declarations[0]! : null;
  }
  return null;
}
function typeDeclaration(at: Node, name: string): Node | null {
  for (let up: Node | null = at; up; up = up.parent) if (SCOPES.includes(up.type)) {
    const types = up.descendantsOfType(["type_alias_declaration", "interface_declaration"])
      .filter(n => scope(n).id === up!.id && field(n, "name")?.text === name);
    if (types.length) return types.length === 1 ? types[0]! : null;
  }
  return null;
}
function namedContainer(declared: Node, fields: string[]): string | null {
  let annotation = field(declared, "type"), remaining = [...fields], named: { key: string; remaining: string[] } | null = null;
  let visited = new Set<number>();
  while (annotation) {
    if (annotation.type === "type_annotation") annotation = members(annotation)[0] ?? null;
    if (!annotation) break;
    if (annotation.type === "type_identifier") {
      const type = typeDeclaration(declared, annotation.text);
      if (!type || visited.has(type.id)) break;
      visited.add(type.id);
      named = { key: `type:${type.id}`, remaining: [...remaining] };
      annotation = field(type, type.type === "interface_declaration" ? "body" : "value");
      continue;
    }
    if (annotation.type !== "object_type" && annotation.type !== "interface_body") break;
    const next = remaining.shift();
    const property = next && members(annotation).find(n => n.type === "property_signature" && field(n, "name")?.text === next);
    annotation = property ? field(property, "type") : null;
  }
  return named && named.remaining.length ? `${named.key}.${named.remaining.join(".")}` : null;
}
function handle(at: Node): Handle | null {
  const expression = path(at);
  if (!expression) return null;
  let { root, fields } = expression, declared = declaration(root, root.text), aliases = new Set<number>();
  while (declared) {
    if (aliases.has(declared.id) || aliases.size >= 12) return null;
    aliases.add(declared.id);
    const value = field(declared, "value");
    const aliased = value && declared.parent?.children.some(c => c.type === "const") ? path(value) : null;
    if (!aliased) break;
    root = aliased.root; fields = [...aliased.fields, ...fields];
    declared = declaration(root, root.text);
  }
  if (!declared) return null;
  const binding = `binding:${declared.id}${fields.map(name => `.${name}`).join("")}`;
  if (!["required_parameter", "optional_parameter"].includes(declared.type)) return { binding };
  let owner = declared;
  while (owner.parent && !FUNCTIONS.includes(owner.type)) owner = owner.parent;
  if (!FUNCTIONS.includes(owner.type)) return { binding };
  const named = namedContainer(declared, fields);
  return named ? { binding, named, owner: owner.id } : { binding };
}
function callee(n: Node, name: string): boolean {
  const fn = field(n, "function");
  return fn?.type === "identifier" && fn.text === name || fn?.type === "member_expression" && field(fn, "property")?.text === name;
}

export function intervalsWithoutCleanup(p: Parsed): Node[] {
  const calls = p.root.descendantsOfType("call_expression");
  const clears = calls.filter(n => callee(n, "clearInterval")).flatMap(n => {
    const first = members(field(n, "arguments"))[0], key = first && handle(first);
    return key ? [key] : [];
  });
  return calls.filter(n => {
    if (!callee(n, "setInterval")) return false;
    let value = n;
    while (value.parent && ["parenthesized_expression", "as_expression", "satisfies_expression", "non_null_expression"].includes(value.parent.type)) value = value.parent;
    const parent = value.parent;
    const stored = parent?.type === "assignment_expression" && field(parent, "right")?.id === value.id ? field(parent, "left")
      : parent?.type === "variable_declarator" && field(parent, "value")?.id === value.id ? field(parent, "name") : null;
    const key = stored && handle(stored);
    return !key || !clears.some(clear => clear.binding === key.binding
      || clear.named !== undefined && clear.named === key.named && clear.owner !== key.owner);
  });
}
