// Explicit conventional Cargo module trees only. This reads source declarations,
// never executes Cargo/build scripts or expands Rust macros.
import { parse, type Node } from "./ts.ts";
import type { Read } from "./types.ts";
import type { Resolved } from "./resolve.ts";
import { rustUseNames } from "./rust-facts.ts";

interface Module { name: string; inline: Source | null; uncertain: boolean }
interface Source { modules: Module[]; items: string[]; invalid: boolean }
interface Location { file: string; directory: string; source: Source }
const directory = (rel: string): string => rel.includes("/") ? rel.slice(0, rel.lastIndexOf("/")) : "";
const at = (dir: string, name: string): string => dir ? `${dir}/${name}` : name;
const facts = new WeakMap<Read, Map<string, { text: string; source: Source }>>();
const nameOf = (name: string): string => name.replace(/^r#/, "");

function declarations(body: Node): Source {
  const modules: Module[] = [];
  const items: string[] = [];
  let attributes: string[] = [];
  for (const child of body.namedChildren) {
    if (["line_comment", "block_comment"].includes(child.type)) continue;
    if (child.type === "attribute_item") { attributes.push(child.text); continue; }
    if (child.type === "mod_item") {
      const nested = child.childForFieldName("body");
      modules.push({ name: nameOf(child.childForFieldName("name")!.text), inline: nested ? declarations(nested) : null,
        uncertain: attributes.some(attribute => !/^#\[\s*(?:allow|deny|warn|forbid|doc|deprecated)\b/.test(attribute)) });
    }
    if (["function_item", "struct_item", "enum_item", "trait_item", "type_item", "const_item", "static_item", "union_item"].includes(child.type)) {
      const name = child.childForFieldName("name");
      if (name) items.push(nameOf(name.text));
    }
    if (child.type === "use_declaration") items.push(...rustUseNames(child.childForFieldName("argument")).map(nameOf));
    if (child.type === "extern_crate_declaration") items.push(nameOf((child.childForFieldName("alias") ?? child.childForFieldName("name"))!.text));
    attributes = [];
  }
  return { modules, items, invalid: body.namedChildren.some(node => node.type === "inner_attribute_item" && /^#!\[\s*(?:cfg|cfg_attr)\b/.test(node.text))
    || body.descendantsOfType("macro_invocation").some(node => /(?:^|::)include$/.test(node.childForFieldName("macro")?.text ?? "")) };
}

function source(file: string, read: Read): Source | null {
  const text = read(file);
  if (text === null) return null;
  const cache = facts.get(read) ?? new Map<string, { text: string; source: Source }>();
  if (!facts.has(read)) facts.set(read, cache);
  const prior = cache.get(file);
  if (prior?.text === text) return prior.source;
  const result = parsedSource(parse(file, text));
  if (cache.size < 16 && text.length <= 65536) cache.set(file, { text, source: result });
  return result;
}

function parsedSource(parsed: ReturnType<typeof parse>): Source {
  try {
    const result = declarations(parsed.root);
    result.invalid ||= parsed.root.hasError;
    return result;
  } finally { parsed.root.tree.delete(); }
}

function child(location: Location, name: string, read: Read): Location | "unresolved" | null {
  const declared = location.source.modules.filter(module => module.name === name);
  if (!declared.length) return null;
  if (declared.length !== 1 || declared[0]!.uncertain) return "unresolved";
  const module = declared[0]!, dir = at(location.directory, name);
  if (module.inline) return module.inline.invalid ? "unresolved" : { file: location.file, directory: dir, source: module.inline };
  const candidates = [dir + ".rs", dir + "/mod.rs"].filter(file => read(file) !== null);
  if (candidates.length !== 1) return "unresolved";
  const next = source(candidates[0]!, read);
  return next && !next.invalid ? { file: candidates[0]!, directory: dir, source: next } : "unresolved";
}

function descend(root: Location, parts: string[], read: Read): Location | "unresolved" {
  let current = root;
  for (const name of parts) {
    const next = child(current, name, read);
    if (!next || next === "unresolved") return "unresolved";
    current = next;
  }
  return current;
}

function cargo(from: string, read: Read): { dir: string; config: Record<string, unknown> } | null {
  let selected: { dir: string; config: Record<string, unknown> } | null = null;
  for (let dir = directory(from); ; dir = directory(dir)) {
    if (read(at(dir, ".cargo/config")) !== null || read(at(dir, ".cargo/config.toml")) !== null) return null;
    const text = read(at(dir, "Cargo.toml"));
    if (text !== null) {
      const config = cargoToml(text);
      if (config === null || config.patch || config.replace) return null;
      if (!selected && config.package && typeof config.package === "object") selected = { dir, config };
    }
    if (!dir) return selected;
  }
}

function cargoToml(text: string): Record<string, unknown> | null {
  try { return Bun.TOML.parse(text) as Record<string, unknown>; }
  catch (error) { if (error instanceof SyntaxError) return null; throw error; }
}

function moduleParts(suffix: string): string[] {
  const parts = suffix.replace(/\.rs$/, "").split("/").filter(Boolean);
  if (parts.at(-1) === "mod" || (parts.length === 1 && ["lib", "main"].includes(parts[0]!))) parts.pop();
  return parts;
}

function roots(from: string, dir: string, config: Record<string, unknown>, read: Read): Location[] | "unresolved" {
  if (config.lib || config.bin || (config.package as Record<string, unknown>).autolib === false || (config.package as Record<string, unknown>).autobins === false) return "unresolved";
  const prefix = at(dir, "src") + "/", suffix = from.slice(prefix.length);
  if (!from.startsWith(prefix) || suffix.startsWith("bin/")) return "unresolved";
  const parts = moduleParts(suffix);
  const selected: Location[] = [];
  for (const file of [prefix + "lib.rs", prefix + "main.rs"]) {
    if ([prefix + "lib.rs", prefix + "main.rs"].includes(from) && file !== from) continue;
    const parsed = source(file, read);
    if (!parsed || parsed.invalid) continue;
    const root = { file, directory: prefix.slice(0, -1), source: parsed };
    const location = descend(root, parts, read);
    if (location !== "unresolved" && location.file === from) selected.push(root);
  }
  return selected.length ? selected : "unresolved";
}

function target(root: Location, parts: string[], read: Read): Resolved {
  let current = root;
  for (const name of parts) {
    const next = child(current, name, read);
    if (next === "unresolved") return next;
    // Remaining names are item/associated-item suffixes in this explicit module.
    if (!next) return current.source.items.includes(name) ? { rel: current.file } : "unresolved";
    current = next;
  }
  return { rel: current.file };
}

function external(parts: string[], config: Record<string, unknown>): Resolved {
  if (["std", "core", "alloc"].includes(parts[0]!)) return "external";
  const dependencies = ["dependencies", "dev-dependencies", "build-dependencies"].flatMap(key => Object.entries((config[key] ?? {}) as object));
  const dependency = dependencies.find(([name]) => name.replaceAll("-", "_") === parts[0]);
  return dependency && !(typeof dependency[1] === "object" && dependency[1] !== null && ("path" in dependency[1] || "workspace" in dependency[1])) ? "external" : "unresolved";
}

function sameTarget(answers: Resolved[]): Resolved {
  return answers.every(answer => typeof answer === "object" && typeof answers[0] === "object" && answer.rel === answers[0].rel) ? answers[0]! : "unresolved";
}

function relativeTarget(root: Location, own: string[], parts: string[], read: Read): Resolved | null {
  const context = descend(root, own, read);
  if (context === "unresolved") return context;
  if (context.source.modules.some(module => module.name === parts[0])) return target(context, parts, read);
  // A local binding can shadow an extern-prelude name. Resolving imported aliases,
  // enum variants and associated items requires more than module-source ownership.
  return context.source.items.includes(parts[0]!) ? "unresolved" : null;
}

export function resolveRust(from: string, spec: string, read: Read, base = ""): Resolved {
  const parts = spec.replace(/^::/, "").split("::").map(nameOf);
  if (parts.at(-1) === "*") parts.pop();
  if (!parts.length || parts.length > 32 || parts.some(part => !/^[\p{L}_][\p{L}\p{N}_]*$/u.test(part))) return "unresolved";
  const manifest = cargo(from, read);
  if (!manifest) return "unresolved";
  const edition = (manifest.config.package as Record<string, unknown>).edition ?? "2015";
  if (!["2018", "2021", "2024"].includes(edition as string)) return "unresolved";
  const selected = roots(from, manifest.dir, manifest.config, read);
  if (selected === "unresolved") return selected;
  const prefix = at(manifest.dir, "src") + "/";
  const own = moduleParts(from.slice(prefix.length));
  own.push(...base.split("::").filter(Boolean).map(nameOf));
  const local = ["crate", "self", "super"].includes(parts[0]!);
  if (!local) {
    if (spec.startsWith("::")) return external(parts, manifest.config);
    const answers = selected.map(root => relativeTarget(root, own, parts, read));
    return answers.every(answer => answer === null) ? external(parts, manifest.config) : sameTarget(answers.map(answer => answer ?? "unresolved"));
  }
  if (parts[0] === "crate") parts.shift();
  else if (parts[0] === "self") { parts.shift(); parts.unshift(...own); }
  else if (parts[0] === "super") {
    while (parts[0] === "super") { if (!own.length) return "unresolved"; own.pop(); parts.shift(); }
    parts.unshift(...own);
  }
  return sameTarget(selected.map(root => target(root, parts, read)));
}
