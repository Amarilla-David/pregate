// Result cardinality from literal Drizzle query chains and current schema sources. Unknown
// bindings, partial/functional indexes and input flows stay unproved; this is not SQL cost proof.
import { loadTsPaths, resolve } from "./resolve.ts";
import { grammarOf, type Node, type Parsed, parse } from "./ts.ts";
import type { Host } from "./types.ts";

const FUNCTIONS = new Set(["arrow_function", "function_expression", "function_declaration", "method_definition"]);
const SCOPES = new Set(["program", "statement_block", ...FUNCTIONS]);
const CORES = new Set(["drizzle-orm/pg-core", "drizzle-orm/sqlite-core", "drizzle-orm/mysql-core"]);
type Binding = { p: Parsed; value: Node } | { source: string; name: string };
type Table = { key: string; unique: string[][] };
const members = (n: Node | null): Node[] => n?.namedChildren.filter(c => c.type !== "comment") ?? [];
const field = (n: Node | null, key: string): Node | null => n?.childForFieldName(key) ?? null;
const args = (n: Node): Node[] => members(field(n, "arguments"));
const property = (n: Node | null): string | null => n?.type === "member_expression" ? field(n, "property")?.text ?? null : null;
const method = (n: Node): string | null => n.type === "call_expression" ? property(field(n, "function")) : null;
const object = (n: Node): Node | null => field(field(n, "function"), "object");
function unwrap(n: Node): Node {
  while (["parenthesized_expression", "as_expression", "satisfies_expression", "non_null_expression"].includes(n.type)) n = members(n)[0] ?? n;
  return n;
}
function scope(n: Node): Node {
  while (n.parent && !SCOPES.has(n.type)) n = n.parent;
  return n;
}
function receiverChain(n: Node): Node[] {
  const out: Node[] = [];
  for (let at: Node | null = n; at?.type === "call_expression"; at = object(at)) out.push(at);
  return out;
}
function queryChain(n: Node): Node[] {
  let top = n;
  while (top.parent?.type === "member_expression" && field(top.parent, "object")?.id === top.id
    && top.parent.parent?.type === "call_expression" && field(top.parent.parent, "function")?.id === top.parent.id) top = top.parent.parent;
  return receiverChain(top).reverse();
}

export function unboundedDrizzleSelects(p: Parsed, host: Host): Node[] {
  return unboundedSelects(p, new Facts(p, host));
}

function unboundedSelects(p: Parsed, facts: Facts): Node[] {
  try {
    return p.root.descendantsOfType("call_expression").filter(n => {
      if (method(n) !== "from" || !receiverChain(n).slice(1).some(c => method(c) === "select")) return false;
      const chain = queryChain(n), last = chain[chain.length - 1]!;
      if (chain.some(c => method(c) === "limit") || method(last) === "get") return false;
      const tableNode = args(n)[0], table = tableNode && facts.table(p, tableNode);
      if (!table) return true;
      const predicates = chain.filter(c => method(c) === "where").flatMap(c => args(c).slice(0, 1));
      if (!predicates.some(c => facts.bounded(p, c, table, n))) return true;
      // Each proven many-to-one left/inner join preserves the base bound. Other joins can
      // introduce rows or multiply them, even when the base predicate selects one row.
      return chain.some(c => {
        const name = method(c);
        if (name === "union" || name === "unionAll") return true;
        if (!name?.includes("Join")) return false;
        if (name !== "leftJoin" && name !== "innerJoin") return true;
        const [target, on] = args(c), joined = target && facts.table(p, target);
        return !joined || !on || !facts.bounded(p, on, joined, n, true);
      });
    });
  } finally { facts.dispose(); }
}

class Facts {
  private files = new Map<string, Parsed | null>();
  private ts: ReturnType<typeof loadTsPaths> | undefined;
  private tables = new Map<string, Table | null>();
  constructor(private current: Parsed, private host: Host) { this.files.set(current.rel, current); }
  dispose(): void { for (const p of this.files.values()) if (p && p !== this.current) p.root.tree.delete(); }
  private resolving<T>(run: () => T): T { return this.host.resolutionProgress ? this.host.resolutionProgress(run) : run(); }
  private file(from: Parsed, spec: string): Parsed | { source: string } | null {
    return this.resolving(() => {
      const to = resolve(from.rel, spec, this.ts ??= loadTsPaths(this.host.read), this.host.read);
      if (to === "external") return { source: spec };
      if (typeof to !== "object" || !["typescript", "tsx"].includes(grammarOf(to.rel)!)) return null;
      if (!this.files.has(to.rel)) {
        if (this.files.size >= 64) return null;
        const text = this.host.read(to.rel), p = text === null ? null : parse(to.rel, text);
        this.files.set(to.rel, p);
      }
      const p = this.files.get(to.rel) ?? null;
      return p?.root.hasError ? null : p;
    });
  }
  private imported(p: Parsed, spec: string, name: string, seen: string[]): Binding | null {
    const to = this.file(p, spec);
    return !to ? null : "source" in to ? { source: to.source, name } : this.exported(to, name, seen);
  }
  private exported(p: Parsed, name: string, seen: string[]): Binding | null {
    const key = `${p.rel}\0${name}`;
    if (seen.includes(key) || seen.length >= 8) return null;
    seen = [...seen, key];
    const found: Binding[] = [];
    for (const statement of members(p.root).filter(n => n.type === "export_statement")) {
      const source = field(statement, "source"), spec = source?.text.slice(1, -1);
      const entries = statement.descendantsOfType("export_specifier");
      for (const entry of entries) if ((field(entry, "alias") ?? field(entry, "name"))?.text === name) {
        const original = field(entry, "name")!.text;
        const binding = spec ? this.imported(p, spec, original, seen) : this.binding(p, entry, original, seen);
        if (binding) found.push(binding);
      }
      for (const declaration of statement.descendantsOfType("variable_declarator")) {
        if (field(declaration, "name")?.text === name && scope(declaration).type === "program") {
          const value = field(declaration, "value");
          if (value && declaration.parent?.children.some(c => c.type === "const")) found.push({ p, value });
        }
      }
      if (spec && entries.length === 0 && statement.children.some(c => c.type === "*")) {
        const binding = this.imported(p, spec, name, seen);
        if (binding) found.push(binding);
      }
    }
    return found.length === 1 ? found[0]! : null;
  }
  private binding(p: Parsed, at: Node, name: string, seen: string[] = []): Binding | null {
    for (let up: Node | null = at; up; up = up.parent) {
      if (FUNCTIONS.has(up.type)) {
        const parameters = field(up, "parameters") ?? field(up, "parameter");
        if (parameters?.descendantsOfType("identifier").some(n => n.text === name)) return null;
      }
      if (!SCOPES.has(up.type)) continue;
      const declarations = up.descendantsOfType("variable_declarator").filter(n => scope(n).id === up!.id && field(n, "name")?.text === name);
      if (declarations.length) {
        const declaration = declarations.length === 1 ? declarations[0]! : null, value = field(declaration, "value");
        return declaration && value && declaration.startIndex < at.startIndex && declaration.parent?.children.some(c => c.type === "const") ? { p, value } : null;
      }
      if (up.type !== "program") continue;
      for (const statement of members(up).filter(n => n.type === "import_statement")) {
        if (statement.children.some(c => c.type === "type")) continue;
        const spec = field(statement, "source")?.text.slice(1, -1);
        if (!spec) continue;
        for (const entry of statement.descendantsOfType("import_specifier")) {
          if (entry.children.some(c => c.type === "type")) continue;
          if ((field(entry, "alias") ?? field(entry, "name"))?.text === name) return this.imported(p, spec, field(entry, "name")!.text, seen);
        }
      }
    }
    return null;
  }
  private origin(p: Parsed, n: Node, seen: string[] = []): Binding | null {
    n = unwrap(n);
    if (n.type === "identifier") {
      const key = `${p.rel}\0${n.text}`;
      if (seen.includes(key) || seen.length >= 8) return null;
      const binding = this.binding(p, n, n.text, seen);
      return binding && "p" in binding && binding.value.type === "identifier" ? this.origin(binding.p, binding.value, [...seen, key]) : binding;
    }
    if (n.type !== "member_expression" || field(n, "object")?.type !== "identifier") return null;
    const namespace = field(n, "object")!, name = field(n, "property")?.text;
    // A local/parameter declaration shadows the namespace import too.
    if (this.shadowed(namespace, namespace.text)) return null;
    for (const statement of members(p.root).filter(n => n.type === "import_statement")) {
      const namespaceImport = statement.descendantsOfType("namespace_import")[0];
      if (members(namespaceImport ?? null)[0]?.text !== namespace.text) continue;
      const spec = field(statement, "source")?.text.slice(1, -1);
      if (spec && name) return this.imported(p, spec, name, seen);
    }
    return null;
  }
  private shadowed(at: Node, name: string): boolean {
    for (let up: Node | null = at; up; up = up.parent) {
      if (FUNCTIONS.has(up.type) && (field(up, "parameters") ?? field(up, "parameter"))?.descendantsOfType("identifier").some(n => n.text === name)) return true;
      if (SCOPES.has(up.type) && up.descendantsOfType("variable_declarator").some(n => scope(n).id === up!.id && field(n, "name")?.text === name)) return true;
    }
    return false;
  }
  private helper(p: Parsed, n: Node, names: string[], cores = false): boolean {
    const origin = this.origin(p, n);
    return !!origin && "source" in origin && (cores ? CORES.has(origin.source) : origin.source === "drizzle-orm") && names.includes(origin.name);
  }
  table(p: Parsed, n: Node): Table | null {
    const binding = this.origin(p, n);
    if (!binding || !("p" in binding)) return null;
    const value = unwrap(binding.value), key = `${binding.p.rel}\0${value.startIndex}`;
    if (!this.tables.has(key)) {
      this.tables.set(key, null);
      const actual = value.type === "call_expression" && this.helper(binding.p, field(value, "function")!, ["pgTable", "sqliteTable", "mysqlTable"], true);
      this.tables.set(key, actual ? { key, unique: this.constraints(binding.p, value) } : null);
    }
    return this.tables.get(key)!;
  }
  private constraints(p: Parsed, call: Node): string[][] {
    const [, columns, config] = args(call), unique: string[][] = [];
    if (columns?.type !== "object" || members(columns).some(n => n.type !== "pair")) return unique;
    for (const pair of members(columns)) {
      const name = field(pair, "key")?.text, value = field(pair, "value");
      if (!name || !value) continue;
      const chain = receiverChain(unwrap(value)), base = chain[chain.length - 1];
      const creator = base && this.origin(p, field(base, "function")!);
      if (creator && "source" in creator && CORES.has(creator.source) && chain.some(c => ["primaryKey", "unique"].includes(method(c)!))) unique.push([name]);
    }
    if (!config || !FUNCTIONS.has(config.type)) return unique;
    const parameter = field(config, "parameter") ?? members(field(config, "parameters"))[0];
    const owner = parameter?.type === "identifier" ? parameter.text : field(parameter ?? null, "pattern")?.text;
    let body = field(config, "body");
    if (body?.type === "statement_block") {
      const returns = members(body).filter(n => n.type === "return_statement");
      body = returns.length === 1 ? members(returns[0]!)[0] ?? null : null;
    }
    if (!body || !owner) return unique;
    body = unwrap(body);
    const entries = body.type === "object" ? members(body).map(n => field(n, "value")) : body.type === "array" ? members(body) : [];
    for (const entry of entries) {
      if (!entry) continue;
      const chain = receiverChain(unwrap(entry)), base = chain[chain.length - 1];
      if (!base || chain.some(c => method(c) === "where")) continue;
      const fn = field(base, "function")!, primary = this.helper(p, fn, ["primaryKey"], true);
      if (!primary && !this.helper(p, fn, ["unique", "uniqueIndex"], true)) continue;
      const on = chain.find(c => method(c) === "on");
      const options = args(base)[0], cols = primary && options?.type === "object"
        ? members(options).find(n => field(n, "key")?.text === "columns") : null;
      const list = on ? args(on) : cols ? members(field(cols, "value")) : [];
      const names = list.map(n => n.type === "member_expression" && field(n, "object")?.text === owner ? field(n, "property")?.text ?? null : null);
      if (names.length && names.every((name): name is string => name !== null)) unique.push(names);
    }
    return unique;
  }
  bounded(p: Parsed, predicate: Node, table: Table, query: Node, join = false): boolean {
    const choices = this.predicates(p, predicate, table, query, join);
    return choices.length > 0 && choices.every(columns => table.unique.some(key => key.every(column => columns.has(column))));
  }
  private predicates(p: Parsed, n: Node, table: Table, query: Node, join: boolean): Set<string>[] {
    n = unwrap(n);
    if (n.type !== "call_expression") return [new Set()];
    const fn = field(n, "function")!, values = args(n);
    if (this.helper(p, fn, ["and"])) {
      return values.reduce<Set<string>[]>((all, next) => {
        const right = this.predicates(p, next, table, query, join);
        return all.length * right.length > 256 ? [new Set()] : all.flatMap(a => right.map(b => new Set([...a, ...b])));
      }, [new Set()]);
    }
    if (this.helper(p, fn, ["or"])) return values.flatMap(next => this.predicates(p, next, table, query, join));
    const equality = this.helper(p, fn, ["eq"]), set = this.helper(p, fn, ["inArray"]);
    if (!equality && !set) return [new Set()];
    for (const [column, value] of equality ? [[values[0], values[1]], [values[1], values[0]]] : [[values[0], values[1]]]) {
      if (!column || !value || column.type !== "member_expression") continue;
      const owner = field(column, "object"), name = field(column, "property")?.text;
      if (!owner || !name || this.table(p, owner)?.key !== table.key) continue;
      if (equality ? this.scalar(p, value, table, join) : this.inputBound(p, value, query)) return [new Set([name])];
    }
    return [new Set()];
  }
  private scalar(p: Parsed, n: Node, table: Table, join: boolean, seen: string[] = []): boolean {
    n = unwrap(n);
    if (["string", "number", "true", "false", "null"].includes(n.type)) return true;
    if (n.type === "identifier") {
      const key = `${p.rel}\0${n.text}`;
      if (seen.includes(key) || seen.length >= 8) return false;
      const binding = this.binding(p, n, n.text);
      if (!binding && this.localDeclaration(n, n.text)) return false;
      return !binding || ("p" in binding && binding.value.id !== n.id && this.scalar(binding.p, binding.value, table, join, [...seen, key]));
    }
    if (n.type !== "member_expression") return false;
    const owner = field(n, "object"), referenced = owner && this.table(p, owner);
    return referenced ? join && referenced.key !== table.key : !!owner && this.scalar(p, owner, table, false, seen);
  }
  private inputBound(p: Parsed, n: Node, query: Node, seen: string[] = []): boolean {
    n = unwrap(n);
    if (n.type === "array") return !members(n).some(n => n.type === "spread_element");
    if (n.type === "call_expression" && method(n) === "slice") {
      const [start, end] = args(n), receiver = object(n);
      return !!receiver && this.array(p, receiver) && start?.text === "0" && end?.type === "number" && Number.isSafeInteger(Number(end.text)) && Number(end.text) >= 0;
    }
    if (n.type !== "identifier" || seen.includes(n.text)) return false;
    const binding = this.binding(p, n, n.text);
    if (binding && "p" in binding && binding.p === p && this.unchanged(p, binding.value.endIndex, n.startIndex, query)
      && this.inputBound(binding.p, binding.value, query, [...seen, n.text])) return true;
    if (!this.array(p, n)) return false;
    // A preceding rejecting guard in the same function dominates the query. Calls or writes
    // between guard and query could mutate the list, so that flow needs stronger project proof.
    for (let up: Node | null = query; up; up = up.parent) {
      if (FUNCTIONS.has(up.type)) break;
      if (up.type !== "statement_block" && up.type !== "program") continue;
      for (const statement of members(up)) {
        if (statement.type !== "if_statement" || statement.endIndex >= query.startIndex || field(statement, "alternative")) continue;
        let condition = field(statement, "condition");
        if (!condition) continue;
        condition = unwrap(condition);
        if (condition.type !== "binary_expression") continue;
        const left = field(condition, "left"), right = field(condition, "right"), op = field(condition, "operator")?.text;
        if (left?.type !== "member_expression" || field(left, "object")?.text !== n.text || property(left) !== "length"
          || ![">", ">="].includes(op!) || right?.type !== "number" || !Number.isSafeInteger(Number(right.text)) || Number(right.text) < 0) continue;
        const consequence = field(statement, "consequence"), rejects = consequence?.type === "statement_block" ? members(consequence) : consequence ? [consequence] : [];
        if (!rejects.length || !["throw_statement", "return_statement"].includes(rejects[rejects.length - 1]!.type)) continue;
        if (this.unchanged(p, statement.endIndex, n.startIndex, query)) return true;
      }
    }
    return false;
  }
  private unchanged(p: Parsed, after: number, before: number, query: Node): boolean {
    const construction = new Set(queryChain(query).filter(n => ["select", "from"].includes(method(n)!)).map(n => n.id));
    return !p.root.descendantsOfType(["call_expression", "assignment_expression", "augmented_assignment_expression", "update_expression"])
      .some(n => n.startIndex >= after && n.endIndex <= before && !(n.type === "call_expression"
        && (construction.has(n.id) || this.helper(p, field(n, "function")!, ["eq", "and", "or", "inArray"]))));
  }
  private array(p: Parsed, n: Node, seen: string[] = []): boolean {
    n = unwrap(n);
    if (n.type === "array") return true;
    if (n.type !== "identifier" || seen.includes(n.text)) return false;
    const binding = this.binding(p, n, n.text);
    if (binding && "p" in binding) return this.array(binding.p, binding.value, [...seen, n.text]);
    for (let up: Node | null = n; up; up = up.parent) if (FUNCTIONS.has(up.type)) {
      const parameter = members(field(up, "parameters")).find(param => field(param, "pattern")?.text === n.text);
      const type = field(parameter ?? null, "type");
      return !!type && /^:\s*(?:readonly\s+)?(?:[^;{}()]+\[\]|(?:ReadonlyArray|Array)<[^;{}()]+>)\s*$/.test(type.text);
    }
    return false;
  }
  private localDeclaration(at: Node, name: string): boolean {
    for (let up: Node | null = at; up; up = up.parent) if (SCOPES.has(up.type)
      && up.descendantsOfType("variable_declarator").some(n => scope(n).id === up!.id && field(n, "name")?.text === name)) return true;
    return false;
  }
}
