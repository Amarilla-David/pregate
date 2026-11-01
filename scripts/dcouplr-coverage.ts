// Development inventory of the pinned public declarations, not a runtime validator.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, posix, resolve } from "node:path";
import { grammars } from "../src/gate.ts";
import { parse, type Node } from "../src/ts.ts";
import PIN from "../packs/dcouplr/upstream-pin.json" with { type: "json" };
import delivery from "../packs/dcouplr/DELIVERY-CONTRACT.json" with { type: "json" };
import logging from "../packs/dcouplr/LOGGING-CONTRACT.json" with { type: "json" };
import queue from "../packs/dcouplr/QUEUE-RUNTIME-CONTRACT.json" with { type: "json" };
import saga from "../packs/dcouplr/SAGA-RUNTIME-CONTRACT.json" with { type: "json" };
import factory from "../packs/dcouplr/FACTORY-RUNTIME-CONTRACT.json" with { type: "json" };
import utility from "../packs/dcouplr/UTILITY-RUNTIME-CONTRACT.json" with { type: "json" };
import observability from "../packs/dcouplr/OBSERVABILITY-CONTRACT.json" with { type: "json" };

const root = resolve(import.meta.dir, "..");
const entries = ["dist/index.d.mts", "dist/inspector/index.d.mts"];
type Location = { path: string; line: number; endLine: number };
type Declaration = { name: string; nodes: Node[]; path: string };
type Export = { name: string; local: string };
interface Slice { types: string[]; members?: string[]; rules: string[]; limit: string }
const slices: Slice[] = [
  { types: ["setupDcouplr", "ISetupDcouplrConfig", "ISystemDependencyFactories", "IDFactory"],
    rules: ["DCP-SETUP-001"], limit: "Direct setup names and plain literal options/factories only; not actual output behavior or bootstrap order." },
  { types: ["runtime"], members: ["setupDcouplr"], rules: ["DCP-SETUP-001"],
    limit: "Direct setup call only; getDcouplr output and initialization order are not checked." },
  { types: ["getDcouplrForTesting", "resetDcouplrForTesting"], rules: ["DCP-TEST-001"],
    limit: "Direct test-helper imports in reviewed production paths; not all aliases or actual runtime mode." },
  { types: ["CreationValidationPolicy", "ValidationResult"], rules: ["DCP-FACTORY-SYNC-001", "DCP-FACTORY-VALIDATION-001"],
    limit: "Recognized callback ownership and known literal results; not complete return flow or input validity." },
  { types: ["AfterCreationVerificationPolicy"], rules: ["DCP-FACTORY-SYNC-001"],
    limit: "Recognized inline/direct/one-const-alias async and generator callbacks; not indirect asynchronous work." },
  { types: ["DFactoryFunction"], rules: ["DCP-INJECT-001", "DCP-ARITY-001", "DCP-FACTORY-EFFECTS-001"],
    limit: "Recognized creators and direct references; not full import, alias, effect or return ownership." },
  { types: ["DependencyAdmissionStep1", "DependencyAdmissionStep2", "DependencyAdmissionStep3", "DependencyAdmissionStep4", "DependencyAdmissionStep5", "DependencyAdmissionStep5ForTesting", "DependencyAdmissionRegistration", "IDependencyAdmission", "IDependencyAdmissionForTesting"],
    rules: ["DCP-FACTORY-SEQUENCE-001", "DCP-FACTORY-CALLABLE-001", "DCP-FACTORY-SINGLETON-001", "DCP-KERNEL-001", "DCP-FORCE-001"],
    limit: "Selected direct stage/callback/singleton/kernel/force predicates; not named-handle flow, metadata contents, unique ownership or complete registration semantics." },
  { types: ["IEventSubscriber"], members: ["subscribe"], rules: ["DCP-EVENT-SUB-001"],
    limit: "Direct gate argument shapes and explicit nonempty-channel policy; not receiver identity, callback types or subscription ownership." },
  { types: ["IEventSubscriber"], members: ["unsubscribe", "unsubscribeBySubscriptionId"], rules: ["DCP-EVENT-TEARDOWN-001"],
    limit: "Direct teardown argument shapes; not cross-call listener/display-ID/subscription-ID identity." },
  { types: ["IMessageGate"], members: ["registerHandler"], rules: ["DCP-MESSAGE-SUB-001"],
    limit: "Direct gate argument shapes; not callback types, receiver identity or unique peer ownership." },
  { types: ["IMessageGate"], members: ["unregisterHandler", "unregisterHandlerBySubscriptionId"], rules: ["DCP-MESSAGE-TEARDOWN-001"],
    limit: "Direct teardown argument shapes; not cross-call peer/display-ID/subscription-ID identity." },
  { types: ["ISettings"], members: ["setSetting"], rules: ["DCP-SETTINGS-001"],
    limit: "Direct known immutable-setting writes; not all aliases or dynamic configuration." },
  { types: ["IDQueueConfig", "IDQueueConfigInternal", "IQueuePersistenceConfig"], rules: ["DCP-QUEUE-SHAPE-001", "DCP-QUEUE-NUM-001"],
    limit: "Direct built-in queue literal fields and selected numeric spellings; not all expressions, custom implementations, backpressure or persistence behavior." },
  { types: ["DStructuredSaga"], members: ["constructor"], rules: ["DCP-SAGA-CTOR-001"],
    limit: "Direct constructor identities and kernel only; not lifecycle or persistence ownership." },
  { types: ["DStructuredSaga", "IStructuredSaga"], members: ["registerNode"], rules: ["DCP-SAGA-NODE-001"],
    limit: "Direct literal node registration and selected duplicate join references; not full graph or lifecycle ownership." },
  { types: ["IStructuredSagaStep", "IStructuredSagaJoinStep"], rules: ["DCP-SAGA-NODE-001"],
    limit: "Direct known constructors/node literals and selected duplicate join references; not full graph, compensation, persistence or lifecycle ownership." },
  { types: ["startDcouplrInspector", "DcouplrInspectorOptions", "DcouplrDebugConsoleOptions"], rules: ["DCP-SETUP-001"],
    limit: "Direct literal option shapes and selected numeric constants; not access control, production ownership, retention behavior or close/cleanup." },
];

function location(node: Node, path: string): Location {
  return { path, line: node.startPosition.row + 1, endLine: node.endPosition.row + 1 };
}

export function apiInventory(texts: Record<string, string>, publicEntries = entries) {
  return parsedInventory(new Map(), texts, publicEntries);
}

function parsedInventory(files: Map<string, ReturnType<typeof parse>>, texts: Record<string, string>, publicEntries: typeof entries) {
  try {
    for (const [path, text] of Object.entries(texts)) {
      const parsed = parse(path.replace(/\.d\.mts$/, ".ts"), text);
      files.set(path, parsed);
      if (parsed.root.hasError) throw new Error(`${path}: invalid declaration syntax`);
    }
    return inventoryFiles(files, publicEntries);
  } finally { for (const parsed of files.values()) parsed.root.tree.delete(); }
}

type Symbols = { definitions: Map<string, Declaration>; exports: Map<string, Export[]>; imports: Map<string, { path: string; name: string }> };
type Member = { name: string; declaredIn: string; source: Location; relatedSlices: string[]; evidenceRequirements: string[] };
const key = (path: string, name: string) => `${path}:${name}`;
const uncommented = (node: Node) => node.namedChildren.filter(n => n.type !== "comment");
const related = (name: string, member?: string) => [...new Set(slices.filter(s => s.types.includes(name) && (!s.members || (member !== undefined && s.members.includes(member))))
  .flatMap(s => s.rules.map(rule => `dcouplr/${rule}`)))];
function evidenceRequirements(name: string, member?: string): string[] {
  return [...delivery.requirements, ...logging.requirements, ...queue.requirements, ...saga.requirements, ...factory.requirements, ...utility.requirements, ...observability.requirements].filter(rule => rule.apiReferences.some(ref => ref.type === name &&
    (!ref.members || (member !== undefined && ref.members.includes(member)))))
    .map(rule => `dcouplr/${rule.id}`);
}

function registerDeclaration(node: Node, path: string, symbols: Symbols): string[] {
  if (["ambient_declaration", "export_statement"].includes(node.type)) {
    const child = node.childForFieldName("declaration") ?? uncommented(node)[0];
    return child ? registerDeclaration(child, path, symbols) : [];
  } else if (["lexical_declaration", "variable_declaration"].includes(node.type)) {
    return node.namedChildren.filter(n => n.type === "variable_declarator").flatMap(n => registerDeclaration(n, path, symbols));
  } else {
    if (!["interface_declaration", "class_declaration", "type_alias_declaration", "function_signature", "variable_declarator", "enum_declaration"].includes(node.type))
      throw new Error(`${path}: unsupported declaration ${node.type}`);
    const name = node.childForFieldName("name");
    if (!name || !["identifier", "type_identifier"].includes(name.type)) throw new Error(`${path}: unsupported declaration ${node.type}`);
    const id = key(path, name.text), existing = symbols.definitions.get(id);
    if (existing) existing.nodes.push(node);
    else symbols.definitions.set(id, { name: name.text, nodes: [node], path });
    return [name.text];
  }
}

function registerImports(node: Node, path: string, symbols: Symbols): void {
  const module = node.childForFieldName("source")?.text;
  if (!module || !/^["'][^\\\r\n]*["']$/.test(module)) throw new Error(`${path}: unsupported declaration import`);
  const named = node.descendantsOfType("import_specifier");
  if (!named.length) throw new Error(`${path}: unsupported declaration import`);
  for (const spec of named) {
    const name = spec.childForFieldName("name")!, local = spec.childForFieldName("alias") ?? name;
    symbols.imports.set(key(path, local.text), {
      path: posix.normalize(posix.join(posix.dirname(path), module.slice(1, -1))).replace(/\.mjs$/, ".d.mts"), name: name.text });
  }
}

function registerExports(node: Node, path: string, symbols: Symbols): Export[] {
  const clause = node.namedChildren.find(n => n.type === "export_clause");
  if (node.childForFieldName("source")) throw new Error(`${path}: unsupported public re-export`);
  if (clause) return clause.namedChildren.filter(n => n.type === "export_specifier").map(spec => {
    const name = spec.childForFieldName("name")!, alias = spec.childForFieldName("alias") ?? name;
    return { name: alias.text, local: name.text };
  });
  const declared = node.childForFieldName("declaration");
  if (!declared) throw new Error(`${path}: unsupported public re-export`);
  return registerDeclaration(declared, path, symbols).map(name => ({ name, local: name }));
}

function symbolTables(files: Map<string, ReturnType<typeof parse>>): Symbols {
  const symbols: Symbols = { definitions: new Map(), exports: new Map(), imports: new Map() };
  for (const [path, file] of files) {
    const listed: Export[] = [];
    for (const node of uncommented(file.root)) {
      if (node.type === "import_statement") registerImports(node, path, symbols);
      else if (node.type === "export_statement") listed.push(...registerExports(node, path, symbols));
      else registerDeclaration(node, path, symbols);
    }
    if (new Set(listed.map(e => e.name)).size !== listed.length) throw new Error(`${path}: duplicate export`);
    symbols.exports.set(path, listed);
  }
  return symbols;
}

function declaration(symbols: Symbols, path: string, name: string, seen = new Set<string>()): Declaration | undefined {
  const id = key(path, name), own = symbols.definitions.get(id);
  if (own) return own;
  if (seen.has(id)) throw new Error(`Cyclic declaration alias: ${id}`);
  const imported = symbols.imports.get(id);
  if (!imported) return;
  const exposed = symbols.exports.get(imported.path)?.find(e => e.name === imported.name);
  if (!exposed) throw new Error(`Unresolved declaration import: ${id}`);
  seen.add(id);
  return declaration(symbols, imported.path, exposed.local, seen);
}

function objectMembers(node: Node, decl: Declaration, symbols: Symbols, seen: Set<string>): Member[] {
  const clauses = node.namedChildren.filter(n => n.type === "extends_type_clause").concat(node.namedChildren.filter(n => n.type === "class_heritage").flatMap(n => n.namedChildren));
  const result = clauses.flatMap(clause => clause.namedChildren.flatMap(type => {
    const inherited = declaration(symbols, decl.path, type.childForFieldName("name")?.text ?? type.text);
    if (!inherited) throw new Error(`Unresolved inherited contract: ${key(decl.path, decl.name)}`);
    return members(inherited, symbols, seen);
  }));
  const body = node.type === "object_type" ? node : node.childForFieldName("body");
  for (const item of body ? uncommented(body) : []) {
    const field = item.childForFieldName("name");
    if (field?.type === "private_property_identifier" || item.namedChildren.some(n => n.type === "accessibility_modifier" && ["private", "protected"].includes(n.text))) continue;
    const name = field?.text ?? "[signature]";
    result.push({ name, declaredIn: decl.name, source: location(item, decl.path), relatedSlices: related(decl.name, name), evidenceRequirements: evidenceRequirements(decl.name, name) });
  }
  return result;
}

function typeMembers(node: Node, decl: Declaration, symbols: Symbols, seen: Set<string>): Member[] {
  if (["interface_declaration", "class_declaration", "object_type"].includes(node.type)) return objectMembers(node, decl, symbols, seen);
  if (node.type === "enum_declaration") return (node.childForFieldName("body") ? uncommented(node.childForFieldName("body")!) : []).map(item => {
    const name = item.childForFieldName("name")?.text ?? item.text;
    return { name, declaredIn: decl.name, source: location(item, decl.path), relatedSlices: related(decl.name, name), evidenceRequirements: evidenceRequirements(decl.name, name) };
  });
  if (["type_alias_declaration", "variable_declarator"].includes(node.type)) {
    const type = node.childForFieldName("value") ?? node.childForFieldName("type");
    return type ? typeMembers(type, decl, symbols, seen) : [];
  }
  if (["union_type", "intersection_type", "parenthesized_type", "readonly_type", "type_annotation"].includes(node.type))
    return uncommented(node).flatMap(child => typeMembers(child, decl, symbols, seen));
  if (["type_identifier", "generic_type"].includes(node.type)) {
    const name = node.type === "type_identifier" ? node.text : node.childForFieldName("name")?.text;
    const argument = node.namedChildren.find(n => n.type === "type_arguments")?.namedChildren[0];
    if (name === "Readonly" && argument) return typeMembers(argument, decl, symbols, seen);
    const target = name ? declaration(symbols, decl.path, name) : undefined;
    if (target) return members(target, symbols, seen);
  }
  return [];
}

function members(decl: Declaration, symbols: Symbols, seen = new Set<string>()): Member[] {
  const id = key(decl.path, decl.name);
  if (seen.has(id)) throw new Error(`Cyclic inherited contract: ${id}`);
  return decl.nodes.flatMap(node => typeMembers(node, decl, symbols, new Set([...seen, id])));
}

function references(node: Node, decl: Declaration, symbols: Symbols, bound = new Set<string>()): Declaration[] {
  const parameters = node.childForFieldName("type_parameters");
  if (parameters) bound = new Set([...bound, ...parameters.namedChildren.map(n => n.childForFieldName("name")?.text).filter((n): n is string => n !== undefined)]);
  const ref = node.type === "type_identifier" ? node.text : node.type === "type_query" && node.namedChildren[0]?.type === "identifier" ? node.namedChildren[0].text : null;
  const target = ref && !bound.has(ref) ? declaration(symbols, decl.path, ref) : undefined;
  return [...(target ? [target] : []), ...node.namedChildren.flatMap(child => references(child, decl, symbols, bound))];
}

function reachableContracts(roots: Declaration[], symbols: Symbols): Map<string, Declaration> {
  const reachable = new Map<string, Declaration>(), pending = [...roots];
  for (let decl; (decl = pending.pop());) {
    const id = key(decl.path, decl.name);
    if (reachable.has(id)) continue;
    reachable.set(id, decl);
    pending.push(...decl.nodes.flatMap(node => references(node, decl, symbols)));
  }
  return reachable;
}

function inventoryFiles(files: Map<string, ReturnType<typeof parse>>, publicEntries: string[]) {
  const symbols = symbolTables(files);
  const publicExports = publicEntries.flatMap(path => {
    if (!files.has(path)) throw new Error(`Missing public entry: ${path}`);
    return (symbols.exports.get(path) ?? []).map(e => {
      const target = declaration(symbols, path, e.local);
      if (!target) throw new Error(`Unresolved public export: ${path}:${e.name}`);
      return { path, name: e.name, declaration: key(target.path, target.name) };
    });
  });
  const reachable = reachableContracts(publicExports.map(e => symbols.definitions.get(e.declaration)!), symbols);
  const contracts = [...reachable].sort(([a], [b]) => a.localeCompare(b)).map(([id, decl]) => ({ id, name: decl.name,
    declarations: decl.nodes.map(node => ({ kind: node.type, source: location(node, decl.path) })),
    directExports: publicExports.filter(e => e.declaration === id).map(e => `${e.path}:${e.name}`),
    relatedSlices: related(decl.name), evidenceRequirements: evidenceRequirements(decl.name), members: members(decl, symbols) }));
  return { publicExports, contracts,
    limit: "Exhaustive inventory of the pinned exported declarations and reachable named contracts, not exhaustive semantic conditions or proof of compliance. Related slices are partial references, not certification of a type, member, caller or project. Builtin/generic types and arbitrary map keys have no finite member inventory." };
}

export function pinnedSource(dir: string): Record<string, string> {
  return Object.fromEntries(Object.entries(PIN.files).map(([path, hash]) => {
    const bytes = readFileSync(join(dir, path));
    if (createHash("sha256").update(bytes).digest("hex") !== hash) throw new Error(`Unreviewed dcouplr input: ${path}`);
    return [path, bytes.toString("utf8")];
  }));
}

export function coverageLedger(dir: string) {
  const source = pinnedSource(dir), api = apiInventory(Object.fromEntries(Object.entries(source).filter(([path]) => path.endsWith(".d.mts"))));
  // Sorted: readdir order differs between APFS, ext4 and NTFS, and this ledger is committed.
  const rules = readdirSync(join(root, "packs/dcouplr/methodologies")).filter(p => p.endsWith(".json")).sort().flatMap(p => {
    const m = JSON.parse(readFileSync(join(root, "packs/dcouplr/methodologies", p), "utf8"));
    return m.invariants.map((r: { id: string; check: string; avoid: string }) => ({ alias: `dcouplr/${r.id}`, check: r.check, limit: r.avoid }));
  });
  const aliases = new Set(rules.map((r: { alias: string }) => r.alias));
  for (const c of api.contracts) for (const ref of [...c.relatedSlices, ...c.members.flatMap(m => m.relatedSlices)]) {
    if (!aliases.has(ref)) throw new Error(`Unknown related slice: ${ref}`);
  }
  for (const rule of [...delivery.requirements, ...logging.requirements, ...queue.requirements, ...saga.requirements, ...factory.requirements, ...utility.requirements, ...observability.requirements]) {
    if (!aliases.has(`dcouplr/${rule.id}`)) throw new Error(`Unknown project requirement: ${rule.id}`);
    for (const ref of rule.apiReferences) {
      const type = api.contracts.find(c => c.name === ref.type);
      if (!type || (ref.members && ref.members.some(name => !type.members.some(m => m.name === name))))
        throw new Error(`Unresolved project contract reference: ${rule.id}:${ref.type}`);
    }
  }
  return { schemaVersion: 1, source: PIN, ...api, syntaxSlices: slices.map(s => ({ ...s, rules: s.rules.map(id => `dcouplr/${id}`) })), architecturePolicies: rules.filter((r: { alias: string }) =>
    ["DCP-AMBIENT-001", "DCP-NEW-001", "DCP-LOCATOR-001", "DCP-EDGE-001", "DCP-EXPORTS-001"].some(id => r.alias.endsWith(`/${id}`))),
    deliveryRequirements: delivery,
    loggingRequirements: logging,
    queueRequirements: queue,
    sagaRequirements: saga,
    factoryRequirements: factory,
    utilityRequirements: utility,
    observabilityRequirements: observability,
    summary: { publicExports: api.publicExports.length, namedContracts: api.contracts.length,
      memberSignatures: api.contracts.reduce((n, c) => n + c.members.length, 0),
      contractsWithoutRelatedSyntaxSlice: api.contracts.filter(c => !c.relatedSlices.length && !c.members.some(m => m.relatedSlices.length)).length,
      contractsWithProjectEvidenceRequirement: api.contracts.filter(c => c.evidenceRequirements.length || c.members.some(m => m.evidenceRequirements.length)).length } };
}

if (import.meta.main) {
  const args = process.argv.slice(2), checking = args[0] === "--check", dir = args[checking ? 1 : 0];
  if (!dir || args.length !== (checking ? 2 : 1)) throw new Error("Usage: bun scripts/dcouplr-coverage.ts [--check] /path/to/integrity-pinned/package");
  await grammars();
  const output = join(root, "packs/dcouplr/API-COVERAGE.json"), value = coverageLedger(resolve(dir)), text = JSON.stringify(value, null, 2) + "\n";
  if (checking && (!existsSync(output) || readFileSync(output, "utf8").replaceAll("\r\n", "\n") !== text)) {
    console.error("dcouplr API coverage is stale; regenerate it against the pinned artifact."); process.exitCode = 1;
  } else {
    if (!checking) writeFileSync(output, text);
    console.log(`${checking ? "Verified" : "Generated"} dcouplr public API inventory: ${JSON.stringify(value.summary)}. No semantic certification.`);
  }
}
