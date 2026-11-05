// Whether this project enabled Cache Components. Next.js loads the first existing file in
// CONFIG_FILES order (packages/next/src/shared/lib/constants.ts): next.config.js, then
// next.config.mjs, then next.config.ts. A later file is not read. .mts, .cjs, and .cts are not
// in that list. Only a literal `cacheComponents: true` on the exported config object counts.
// Nested `experimental.cacheComponents`, comments, and computed values do not.
import type { Node } from "web-tree-sitter";
import { parse } from "./ts.ts";
import type { Read } from "./types.ts";

const CONFIG_FILES = ["next.config.js", "next.config.mjs", "next.config.ts"];

export function cacheComponentsEnabled(read: Read): boolean {
  for (const rel of CONFIG_FILES) {
    const text = read(rel);
    if (text === null) continue;
    return literalCacheComponents(rel, text);
  }
  return false;
}

function literalCacheComponents(rel: string, text: string): boolean {
  const parsed = parse(rel, text);
  try {
    return exportedObjects(parsed.root).some(objectEnables);
  } finally {
    parsed.root.tree.delete();
  }
}

function exportedObjects(root: Node): Node[] {
  const bindings = moduleBindings(root);
  const found: Node[] = [];
  for (const stmt of root.namedChildren) {
    if (stmt.type === "export_statement" && stmt.text.startsWith("export default")) {
      const expr = stmt.namedChildren.at(-1);
      const object = expr === undefined ? null : resolveObject(expr, bindings);
      if (object) found.push(object);
    }
    if (stmt.type !== "expression_statement") continue;
    const assign = stmt.namedChildren[0];
    if (assign?.type !== "assignment_expression") continue;
    const left = assign.childForFieldName("left");
    const right = assign.childForFieldName("right");
    if (left?.text !== "module.exports" || right === null) continue;
    const object = resolveObject(right, bindings);
    if (object) found.push(object);
  }
  return found;
}

function moduleBindings(root: Node): Map<string, Node> {
  const bindings = new Map<string, Node>();
  for (const stmt of root.namedChildren) {
    if (stmt.type !== "lexical_declaration" && stmt.type !== "variable_declaration") continue;
    for (const decl of stmt.namedChildren) {
      if (decl.type !== "variable_declarator") continue;
      const name = decl.childForFieldName("name");
      const value = decl.childForFieldName("value");
      if (name?.type === "identifier" && value) bindings.set(name.text, value);
    }
  }
  return bindings;
}

function resolveObject(expr: Node, bindings: Map<string, Node>, depth = 0): Node | null {
  const node = unwrap(expr);
  if (node.type === "object") return node;
  if (node.type === "identifier" && depth < 2) {
    const bound = bindings.get(node.text);
    if (bound) return resolveObject(bound, bindings, depth + 1);
  }
  return null;
}

function objectEnables(object: Node): boolean {
  for (const child of object.namedChildren) {
    if (child.type !== "pair") continue;
    const key = child.childForFieldName("key");
    const value = child.childForFieldName("value");
    if (key === null || value === null || keyName(key) !== "cacheComponents") continue;
    if (unwrap(value).type === "true") return true;
  }
  return false;
}

function keyName(key: Node): string | null {
  if (key.type === "property_identifier") return key.text;
  if (key.type === "string") return key.namedChildren.find((child) => child.type === "string_fragment")?.text ?? null;
  return null;
}

function unwrap(node: Node): Node {
  let current = node;
  while (current.type === "satisfies_expression" || current.type === "as_expression" || current.type === "parenthesized_expression" || current.type === "non_null_expression") {
    const inner = current.namedChildren[0];
    if (inner === undefined) break;
    current = inner;
  }
  return current;
}
