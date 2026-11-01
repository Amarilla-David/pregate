// Static, project-local import resolution. It does not execute Python search hooks or Go tooling.
import type { Resolved } from "./resolve.ts";
import type { Read } from "./types.ts";

function directory(rel: string): string {
  const slash = rel.lastIndexOf("/");
  return slash < 0 ? "" : rel.slice(0, slash);
}

function join(dir: string, path: string): string | null {
  const parts = dir.split("/").filter(Boolean);
  for (const part of path.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (!parts.length) return null;
      parts.pop();
    } else parts.push(part);
  }
  return parts.join("/");
}

function pythonFile(path: string, read: Read): string | null {
  return [path + ".py", path + "/__init__.py"].find((file) => read(file) !== null) ?? null;
}

function pythonAt(root: string, spec: string, read: Read): Resolved {
  const parts = spec.split(".");
  const top = join(root, parts[0]!)!;
  const path = join(root, parts.join("/"))!;
  const file = pythonFile(path, read);
  if (file === null) return pythonFile(top, read) === null ? "external" : "unresolved";
  // Namespace packages need a search-path model, not a guessed folder.
  for (let i = 1; i < parts.length; i++) {
    const parent = join(root, parts.slice(0, i).join("/"))!;
    if (read(parent + "/__init__.py") === null) return "unresolved";
  }
  return { rel: file };
}

export function resolvePython(from: string, spec: string, read: Read, base?: string): Resolved {
  if (!/^\.?[.\p{L}\p{N}_]+$/u.test(spec) || spec.endsWith(".") && !/^\.+$/.test(spec)) return "unresolved";
  const relative = /^\.+/.exec(spec)?.[0].length ?? 0;
  let root = "";
  if (relative) {
    root = directory(from);
    if (read(root + "/__init__.py") === null) return "unresolved";
    for (let i = 1; i < relative; i++) {
      const parent = directory(root);
      if (parent === root || !root.includes("/") || read(parent + "/__init__.py") === null) return "unresolved";
      root = parent;
    }
  }
  const search = (name: string): Resolved => {
    if (relative) {
      const suffix = name.slice(relative);
      const hit = suffix ? pythonAt(root, suffix, read) : { rel: root + "/__init__.py" };
      return hit === "external" ? "unresolved" : hit;
    }
    const matches = ["", "src"].map((dir) => pythonAt(dir, name, read)).filter((hit) => hit !== "external");
    return matches.length === 0 ? "external" : matches.length === 1 ? matches[0]! : "unresolved";
  };
  const target = search(spec);
  if (!base || typeof target === "object") return target;
  // from module import name may refer to an attribute rather than a child module.
  const parent = search(base);
  return typeof parent === "object" ? parent : target === "unresolved" ? target : parent;
}

interface Replacement { module: string; version: string | null; target: string }

function moduleToken(text: string): string | null {
  if (/^"[^"\\]+"$/.test(text)) return text.slice(1, -1);
  return /^[^\s"'\\]+$/.test(text) ? text : null;
}

function goModule(text: string): { name: string; replacements: Replacement[] } | null {
  const lines = text.split(/\r?\n/).map((line) => line.replace(/\s*\/\/.*$/, "").trim()).filter(Boolean);
  const declarations = lines.filter((line) => /^module(?:\s|$)/.test(line));
  const name = declarations.length === 1 ? moduleToken(declarations[0]!.slice(6).trim()) : null;
  if (!name || name.startsWith(".") || name.startsWith("/") || name.endsWith("/") || name.split("/").some((part) => part === "." || part === "..")) return null;
  const replacements: Replacement[] = [];
  let block = false;
  for (const line of lines) {
    if (line === "replace (") { if (block) return null; block = true; continue; }
    if (block && line === ")") { block = false; continue; }
    const replacement = block ? line : /^replace\s/.test(line) ? line.slice(7).trim() : null;
    if (replacement === null) continue;
    const parts = replacement.split(/\s+=>\s+/);
    if (parts.length !== 2) return null;
    const left = parts[0]!.split(/\s+/), right = parts[1]!.split(/\s+/);
    const module = moduleToken(left[0]!), target = moduleToken(right[0]!);
    if (!module || !target || left.length > 2 || right.length > 2) return null;
    replacements.push({ module, version: left[1] ?? null, target });
  }
  return block ? null : { name, replacements };
}

export function resolveGo(from: string, spec: string, read: Read): Resolved {
  if (!spec || /[\s\\?#]/.test(spec) || spec.startsWith("/") || spec.split("/").some((part) => part === "." || part === ".." || part === "")) return "unresolved";
  let dir = directory(from);
  for (let parent = dir; ; parent = directory(parent)) {
    if (read((parent ? parent + "/" : "") + "go.work") !== null) return "unresolved";
    if (!parent) break;
  }
  for (;;) {
    const text = read((dir ? dir + "/" : "") + "go.mod");
    if (text !== null) {
      const config = goModule(text);
      if (!config) return "unresolved";
      const replacement = config.replacements.filter((r) => spec === r.module || spec.startsWith(r.module + "/"))
        .sort((a, b) => b.module.length - a.module.length);
      if (replacement.length) {
        const selected = replacement[0]!;
        // Version-specific selection requires the Go module graph.
        if (replacement.filter((r) => r.module === selected.module).length !== 1 || selected.version !== null) return "unresolved";
        if (!selected.target.startsWith("./") && !selected.target.startsWith("../")) return selected.target.startsWith("/") ? "unresolved" : "external";
        const folder = join(dir, selected.target + spec.slice(selected.module.length));
        return folder === null ? "unresolved" : { rel: folder + "/" };
      }
      if (spec === config.name || spec.startsWith(config.name + "/")) {
        const folder = join(dir, spec.slice(config.name.length));
        return folder === null ? "unresolved" : { rel: folder ? folder + "/" : "." };
      }
      return "external";
    }
    if (!dir) return "external";
    dir = directory(dir);
  }
}
