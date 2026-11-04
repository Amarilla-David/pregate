// Python 3.15 removals and 3.16/3.17 pending removals. The project's oldest declared
// Python decides the severity: an API removed on every version it still supports is a
// denial, and an API scheduled for a later release is a warning. An undeclared floor
// does not deny a 3.15 removal.
import { literalString } from "./language-facts.ts";
import { resolvePython } from "./module-resolve.ts";
import type { Node, Parsed } from "./ts.ts";
import type { Read } from "./types.ts";

interface Ver { major: number; minor: number }
interface Matcher {
  removedIn: number;
  module: (name: string) => boolean;
  name: (qualified: string) => boolean;
  call: (qualified: string, node: Node) => boolean;
  attribute: (node: Node) => boolean;
  invert: boolean;
}
interface Hit { node: Node }
interface Env { names: Map<string, string> }
interface Ctx { matcher: Matcher; read: Read; rel: string }

const NAMEDTUPLE_KEYWORDS = new Set(["fields", "module", "defaults", "namespace"]);
const SRE = ["sre_parse", "sre_compile", "sre_constants"];
const POLICIES = [
  "asyncio.AbstractEventLoopPolicy", "asyncio.DefaultEventLoopPolicy",
  "asyncio.WindowsSelectorEventLoopPolicy", "asyncio.WindowsProactorEventLoopPolicy",
  "asyncio.get_event_loop_policy", "asyncio.set_event_loop_policy",
];

const no = (): boolean => false;
const named = (values: string[]) => {
  const set = new Set(values);
  return (qualified: string) => set.has(qualified);
};
const modules = (values: string[]) => {
  const set = new Set(values);
  return (name: string) => set.has(name) || [...set].some((item) => name.startsWith(item + "."));
};

function callOf(check: (qualified: string, node: Node) => boolean): Matcher["call"] {
  return check;
}

const MATCHERS: Record<string, Matcher> = {
  "namedtuple-keywords": { removedIn: 15, module: no, name: no, call: callOf(namedTupleCall), attribute: no, invert: false },
  "typeddict-empty": { removedIn: 15, module: no, name: no, call: callOf(typedDictCall), attribute: no, invert: false },
  "sre-modules": { removedIn: 15, module: modules(SRE), name: no, call: no, attribute: no, invert: false },
  "cgi-handler": { removedIn: 15, module: no, name: named(["http.server.CGIHTTPRequestHandler"]), call: no, attribute: no, invert: false },
  "no-type-check-decorator": { removedIn: 15, module: no, name: named(["typing.no_type_check_decorator"]), call: no, attribute: no, invert: false },
  "resources-package": { removedIn: 15, module: no, name: no, call: callOf(resourcesCall), attribute: no, invert: false },
  "co-lnotab": { removedIn: 15, module: no, name: no, call: no, attribute: (node) => node.childForFieldName("attribute")?.text === "co_lnotab", invert: false },
  "asyncio-iscoroutinefunction": { removedIn: 16, module: no, name: named(["asyncio.iscoroutinefunction"]), call: no, attribute: no, invert: false },
  "asyncio-policy": { removedIn: 16, module: no, name: named(POLICIES), call: no, attribute: no, invert: false },
  "bool-invert": { removedIn: 16, module: no, name: no, call: no, attribute: no, invert: true },
  bytestring: { removedIn: 17, module: no, name: named(["typing.ByteString", "collections.abc.ByteString"]), call: no, attribute: no, invert: false },
  "profile-module": { removedIn: 17, module: modules(["profile"]), name: no, call: no, attribute: no, invert: false },
};

export function pythonLegacyHits(parsed: Parsed, read: Read, api: string): { node: Node; severity: "deny" | "warn" }[] {
  const matcher = MATCHERS[api];
  if (!matcher) return [];
  const severity = disposition(declaredFloor(read, parsed.rel), matcher.removedIn);
  if (severity === "skip") return [];
  const hits: Hit[] = [];
  walk(parsed.root, { names: new Map() }, hits, { matcher, read, rel: parsed.rel });
  return hits
    .sort((a, b) => a.node.startIndex - b.node.startIndex)
    .map((hit) => ({ node: hit.node, severity }));
}

// 3.15 removals stay silent below that floor. Later removals warn until the floor reaches them.
function disposition(floor: Ver | null, removedMinor: number): "deny" | "warn" | "skip" {
  if (floor && (floor.major > 3 || (floor.major === 3 && floor.minor >= removedMinor))) return "deny";
  return removedMinor > 15 ? "warn" : "skip";
}

function namedTupleCall(qualified: string, call: Node): boolean {
  if (qualified !== "typing.NamedTuple") return false;
  return argumentsOf(call).some((arg) => arg.type === "keyword_argument" && !NAMEDTUPLE_KEYWORDS.has(arg.childForFieldName("name")?.text ?? ""));
}

function typedDictCall(qualified: string, call: Node): boolean {
  if (qualified !== "typing.TypedDict") return false;
  const args = argumentsOf(call);
  const fields = args.find((arg) => arg.type === "keyword_argument" && arg.childForFieldName("name")?.text === "fields");
  const positional = args.filter((arg) => !["keyword_argument", "dictionary_splat", "list_splat"].includes(arg.type));
  if (args.some((arg) => arg.type === "dictionary_splat" || arg.type === "list_splat")) {
    return fields?.childForFieldName("value")?.type === "none" || positional[1]?.type === "none";
  }
  if (fields) return fields.childForFieldName("value")?.type === "none";
  return positional.length === 1 || positional[1]?.type === "none";
}

function resourcesCall(qualified: string, call: Node): boolean {
  return qualified === "importlib.resources.files"
    && argumentsOf(call).some((arg) => arg.type === "keyword_argument" && arg.childForFieldName("name")?.text === "package");
}

function argumentsOf(call: Node): Node[] {
  return call.childForFieldName("arguments")?.namedChildren ?? [];
}

function walk(node: Node, env: Env, hits: Hit[], ctx: Ctx): void {
  if (node.type === "import_statement" || node.type === "import_from_statement") { bindImport(node, env, hits, ctx); return; }
  if (node.type === "function_definition") { bindFunction(node, env, hits, ctx); return; }
  if (node.type === "class_definition") { bindClass(node, env, hits, ctx); return; }
  if (node.type === "lambda") { bindLambda(node, env, hits, ctx); return; }
  if (node.type === "assignment" || node.type === "augmented_assignment") { bindAssignment(node, env, hits, ctx); return; }
  if (node.type === "for_statement") { bindFor(node, env, hits, ctx); return; }
  if (node.type === "with_statement") { bindWith(node, env, hits, ctx); return; }
  if (node.type === "except_clause") { bindExcept(node, env, hits, ctx); return; }
  if (node.type === "call") noteCall(node, env, hits, ctx);
  if (node.type === "unary_operator" && ctx.matcher.invert && boolInvert(node)) add(hits, node);
  if (node.type === "identifier" || node.type === "attribute") noteName(node, env, hits, ctx);
  for (const child of node.namedChildren) walk(child, env, hits, ctx);
}

function bindImport(node: Node, env: Env, hits: Hit[], ctx: Ctx): void {
  if (node.type === "import_from_statement") { bindFrom(node, env, hits, ctx); return; }
  let matched = false;
  for (const name of node.childrenForFieldName("name")) {
    const module = importedName(name);
    if (!module) continue;
    const alias = aliasOf(name);
    // `import collections.abc` binds `collections`, not `collections.abc`.
    env.names.set(alias ?? module.split(".")[0]!, alias ? module : module.split(".")[0]!);
    if (ctx.matcher.module(module) && !projectModule(ctx, module)) matched = true;
  }
  if (matched) add(hits, node);
}

function bindFrom(node: Node, env: Env, hits: Hit[], ctx: Ctx): void {
  const from = dotted(node.childForFieldName("module_name"));
  if (!from) return;
  let matched = false;
  for (const name of node.childrenForFieldName("name")) {
    if (name.type === "wildcard_import") continue;
    const imported = importedName(name);
    const bound = aliasOf(name) ?? imported;
    if (!imported || !bound) continue;
    const qualified = from + "." + imported;
    if ((ctx.matcher.module(from) || ctx.matcher.name(qualified)) && !projectModule(ctx, from)) matched = true;
    env.names.set(bound, qualified);
  }
  if (matched) add(hits, node);
}

function bindFunction(node: Node, env: Env, hits: Hit[], ctx: Ctx): void {
  const params = node.childForFieldName("parameters");
  if (params) walkParamExprs(params, env, hits, ctx);
  const ret = node.childForFieldName("return_type");
  if (ret) walk(ret, env, hits, ctx);
  const inner = child(env);
  if (params) shadowParams(params, inner);
  const name = node.childForFieldName("name");
  if (name?.type === "identifier") inner.names.delete(name.text);
  const body = node.childForFieldName("body");
  if (body) walk(body, inner, hits, ctx);
  if (name?.type === "identifier") env.names.delete(name.text);
}

function bindClass(node: Node, env: Env, hits: Hit[], ctx: Ctx): void {
  const body = node.childForFieldName("body");
  const name = node.childForFieldName("name");
  for (const child of node.namedChildren) if (child !== body && child !== name) walk(child, env, hits, ctx);
  if (body) walk(body, child(env), hits, ctx);
  if (name?.type === "identifier") env.names.delete(name.text);
}

function bindLambda(node: Node, env: Env, hits: Hit[], ctx: Ctx): void {
  const params = node.childForFieldName("parameters");
  if (params) walkParamExprs(params, env, hits, ctx);
  const inner = child(env);
  if (params) shadowParams(params, inner);
  const body = node.childForFieldName("body");
  if (body) walk(body, inner, hits, ctx);
}

function bindAssignment(node: Node, env: Env, hits: Hit[], ctx: Ctx): void {
  const type = node.childForFieldName("type");
  const right = node.childForFieldName("right");
  if (type) walk(type, env, hits, ctx);
  if (right) walk(right, env, hits, ctx);
  const left = node.childForFieldName("left");
  const copied = left?.type === "identifier" && right ? resolveExpr(right, env) : null;
  bindTarget(left, env, copied);
}

function bindFor(node: Node, env: Env, hits: Hit[], ctx: Ctx): void {
  const right = node.childForFieldName("right");
  if (right) walk(right, env, hits, ctx);
  bindTarget(node.childForFieldName("left"), env, null);
  const body = node.childForFieldName("body");
  if (body) walk(body, env, hits, ctx);
  const alt = node.childForFieldName("alternative");
  if (alt) walk(alt, env, hits, ctx);
}

function bindWith(node: Node, env: Env, hits: Hit[], ctx: Ctx): void {
  const clause = node.namedChildren.find((child) => child.type === "with_clause");
  for (const item of clause?.namedChildren ?? []) {
    const value = item.childForFieldName("value") ?? item.namedChildren[0] ?? null;
    if (value?.type === "as_pattern") shadowAlias(value, env, hits, ctx);
    else if (value) walk(value, env, hits, ctx);
  }
  const body = node.childForFieldName("body");
  if (body) walk(body, env, hits, ctx);
}

function bindExcept(node: Node, env: Env, hits: Hit[], ctx: Ctx): void {
  const value = node.childForFieldName("value");
  if (value?.type === "as_pattern") shadowAlias(value, env, hits, ctx);
  else if (value) walk(value, env, hits, ctx);
  const body = node.childForFieldName("body");
  if (body) walk(body, env, hits, ctx);
}

function shadowAlias(pattern: Node, env: Env, hits: Hit[], ctx: Ctx): void {
  const alias = pattern.childForFieldName("alias");
  for (const child of pattern.namedChildren) if (!alias || child.id !== alias.id) walk(child, env, hits, ctx);
  const id = alias?.type === "identifier" ? alias : alias?.namedChildren.find((child) => child.type === "identifier");
  if (id?.type === "identifier") env.names.delete(id.text);
}

function walkParamExprs(params: Node, env: Env, hits: Hit[], ctx: Ctx): void {
  for (const param of params.namedChildren) {
    const type = param.childForFieldName("type");
    const value = param.childForFieldName("value");
    if (type) walk(type, env, hits, ctx);
    if (value) walk(value, env, hits, ctx);
  }
}

function shadowParams(params: Node, env: Env): void {
  for (const param of params.namedChildren) {
    if (param.type === "identifier") env.names.delete(param.text);
    else {
      const id = param.childForFieldName("name") ?? param.namedChildren.find((child) => child.type === "identifier");
      if (id?.type === "identifier") env.names.delete(id.text);
    }
  }
}

function bindTarget(node: Node | null, env: Env, copied: string | null): void {
  if (!node) return;
  if (node.type === "identifier") {
    if (copied) env.names.set(node.text, copied);
    else env.names.delete(node.text);
    return;
  }
  if (["pattern_list", "tuple", "list", "tuple_pattern", "list_pattern"].includes(node.type)) {
    for (const child of node.namedChildren) bindTarget(child, env, null);
  }
}

function noteCall(node: Node, env: Env, hits: Hit[], ctx: Ctx): void {
  const fn = node.childForFieldName("function");
  const qualified = fn ? resolveExpr(fn, env) : null;
  if (qualified && ctx.matcher.call(qualified, node)) add(hits, node);
  const imported = dynamicImport(node, env);
  if (imported && ctx.matcher.module(imported) && !projectModule(ctx, imported)) add(hits, node);
}

function noteName(node: Node, env: Env, hits: Hit[], ctx: Ctx): void {
  if (node.type === "identifier") {
    if (skippedIdentifier(node)) return;
    const qualified = env.names.get(node.text);
    if (qualified && ctx.matcher.name(qualified)) add(hits, node);
    return;
  }
  if (ctx.matcher.attribute(node)) add(hits, node);
  const qualified = resolveExpr(node, env);
  if (qualified && ctx.matcher.name(qualified)) add(hits, node);
}

function dynamicImport(node: Node, env: Env): string | null {
  const fn = node.childForFieldName("function");
  const qualified = fn ? resolveExpr(fn, env) : null;
  const builtin = fn?.type === "identifier" && fn.text === "__import__";
  if (qualified !== "importlib.import_module" && !builtin) return null;
  return literalString(node.childForFieldName("arguments")?.namedChildren[0] ?? null);
}

function boolInvert(node: Node): boolean {
  return node.childForFieldName("operator")?.text === "~" && isBool(node.childForFieldName("argument"));
}

function isBool(node: Node | null): boolean {
  if (!node) return false;
  if (node.type === "true" || node.type === "false") return true;
  return node.type === "parenthesized_expression" && isBool(node.namedChildren[0] ?? null);
}

function resolveExpr(node: Node, env: Env): string | null {
  if (node.type === "identifier") return env.names.get(node.text) ?? null;
  if (node.type === "parenthesized_expression") return node.namedChildren[0] ? resolveExpr(node.namedChildren[0], env) : null;
  if (node.type !== "attribute") return null;
  const object = node.childForFieldName("object");
  const attribute = node.childForFieldName("attribute");
  const base = object ? resolveExpr(object, env) : null;
  return base && attribute ? base + "." + attribute.text : null;
}

function skippedIdentifier(node: Node): boolean {
  const parent = node.parent;
  if (!parent) return false;
  if (parent.type === "attribute" && parent.childForFieldName("attribute")?.id === node.id) return true;
  if (parent.type === "keyword_argument" && parent.childForFieldName("name")?.id === node.id) return true;
  return false;
}

function importedName(node: Node): string | null {
  const namedNode = node.type === "aliased_import" ? node.childForFieldName("name") : node;
  return dotted(namedNode);
}

function aliasOf(node: Node): string | null {
  return node.type === "aliased_import" ? node.childForFieldName("alias")?.text ?? null : null;
}

function dotted(node: Node | null): string | null {
  return node?.type === "dotted_name" ? node.text : null;
}

function projectModule(ctx: Ctx, spec: string): boolean {
  return spec.startsWith(".") || resolvePython(ctx.rel, spec, ctx.read) !== "external";
}

function child(env: Env): Env {
  return { names: new Map(env.names) };
}

function add(hits: Hit[], node: Node): void {
  if (!hits.some((hit) => hit.node.id === node.id)) hits.push({ node });
}

// The oldest Python the project still claims. Packaging metadata wins over a
// developer pin, and the nearest directory to the file wins over the repo root.
function declaredFloor(read: Read, rel: string): Ver | null {
  for (const dir of parents(rel)) {
    for (const file of ["pyproject.toml", "setup.cfg", "setup.py", "Pipfile"] as const) {
      const text = read(pathOf(dir, file));
      if (text === null) continue;
      const found = packagingFloor(file, text);
      if (found.present) return found.floor;
    }
  }
  for (const dir of parents(rel)) {
    for (const file of [".python-version", "runtime.txt"] as const) {
      const text = read(pathOf(dir, file));
      if (text === null) continue;
      const found = file === ".python-version" ? pinnedFloor(text) : pinnedFloor(text.replace(/^python-/i, ""));
      if (found.present) return found.floor;
    }
  }
  return null;
}

function packagingFloor(file: string, text: string): { present: boolean; floor: Ver | null } {
  if (file === "pyproject.toml") return pyprojectFloor(text);
  if (file === "setup.cfg") return keyedFloor(text, "options", "python_requires");
  if (file === "setup.py") return setupFloor(text);
  return pipFloor(text);
}

function pyprojectFloor(text: string): { present: boolean; floor: Ver | null } {
  const project = section(text, "project");
  if (project?.has("requires-python")) return { present: true, floor: parseSpec(project.get("requires-python")!) };
  const poetry = section(text, "tool.poetry.dependencies");
  if (poetry?.has("python")) return { present: true, floor: parseSpec(poetry.get("python")!) };
  return { present: false, floor: null };
}

function keyedFloor(text: string, header: string, key: string): { present: boolean; floor: Ver | null } {
  const values = section(text, header);
  return values?.has(key) ? { present: true, floor: parseSpec(values.get(key)!) } : { present: false, floor: null };
}

function setupFloor(text: string): { present: boolean; floor: Ver | null } {
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith("#")) continue;
    const found = /python_requires\s*=\s*(['"])(.*?)\1/.exec(line);
    if (found) return { present: true, floor: parseSpec(found[2]!) };
  }
  return { present: false, floor: null };
}

function pipFloor(text: string): { present: boolean; floor: Ver | null } {
  const values = section(text, "requires");
  if (!values) return { present: false, floor: null };
  if (values.has("python_full_version")) return { present: true, floor: parseSpec("==" + values.get("python_full_version")!) };
  if (!values.has("python_version")) return { present: false, floor: null };
  const version = values.get("python_version")!;
  const parts = version.split(".");
  return { present: true, floor: parseSpec(parts.length === 2 ? `==${version}.*` : `==${version}`) };
}

function pinnedFloor(text: string): { present: boolean; floor: Ver | null } {
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) continue;
    const found = /^(?:python-)?(\d+(?:\.\d+){0,2})\b/i.exec(line);
    if (!found) return { present: true, floor: null };
    const parts = found[1]!.split(".");
    return { present: true, floor: parseSpec(parts.length >= 2 ? `==${parts[0]}.${parts[1]}.*` : `==${parts[0]}.*`) };
  }
  return { present: false, floor: null };
}

function section(text: string, name: string): Map<string, string> | null {
  let current: string | null = null;
  let found = false;
  const values = new Map<string, string>();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    const header = /^\[([^\]]+)\](?:\s+#.*)?$/.exec(line);
    if (header) { current = header[1]!.trim(); if (current === name) found = true; continue; }
    if (current !== name || line === "" || line.startsWith("#")) continue;
    const assigned = /^([A-Za-z0-9_-]+)\s*=\s*(.*)$/.exec(line);
    if (assigned) values.set(assigned[1]!, unquote(assigned[2]!.trim()));
  }
  return found ? values : null;
}

function unquote(value: string): string {
  const quoted = /^(['"])(.*)\1\s*(?:#.*)?$/.exec(value);
  return quoted ? quoted[2]! : value.replace(/\s+#.*$/, "").trim();
}

// The highest lower bound. An upper bound alone, or a specifier we cannot read, has no floor.
function parseSpec(spec: string): Ver | null {
  let best: Ver | null = null;
  for (const raw of spec.split(",")) {
    const clause = raw.trim().replace(/^\(+|\)+$/g, "");
    if (clause === "") return null;
    const op = /^(>=|<=|==|~=|!=|>|<|\^|~)\s*(.*)$/.exec(clause);
    const operator = op?.[1] ?? "==";
    const rest = (op ? op[2]! : clause).trim();
    if (operator === "<" || operator === "<=" || operator === "!=") continue;
    const version = versionOf(rest);
    if (!version) return null;
    if (!best || version.major > best.major || (version.major === best.major && version.minor > best.minor)) best = version;
  }
  return best;
}

function versionOf(text: string): Ver | null {
  const wild = /^(\d+)(?:\.(\d+))?\.\*$/.exec(text);
  if (wild) return { major: Number(wild[1]), minor: wild[2] === undefined ? 0 : Number(wild[2]) };
  const found = /^(\d+)(?:\.(\d+))?(?:\.\d+)?(?:[a-zA-Z].*)?$/.exec(text);
  return found ? { major: Number(found[1]), minor: found[2] === undefined ? 0 : Number(found[2]) } : null;
}

function parents(rel: string): string[] {
  const dirs: string[] = [];
  let dir = rel.includes("/") ? rel.slice(0, rel.lastIndexOf("/")) : "";
  for (;;) {
    dirs.push(dir);
    if (dir === "") return dirs;
    const slash = dir.lastIndexOf("/");
    dir = slash < 0 ? "" : dir.slice(0, slash);
  }
}

function pathOf(dir: string, name: string): string {
  return dir === "" ? name : dir + "/" + name;
}
