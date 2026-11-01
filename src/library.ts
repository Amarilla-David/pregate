import { compareVersions, ENGINE_VERSION } from "./product.ts";
import type { Files, LibrarySource } from "./types.ts";

let full: Map<string, Files> | undefined;
let data: Map<string, Files> | undefined;

function packs(fixtures: boolean): Map<string, Files> {
  const cached = fixtures ? full : data;
  if (cached) return cached;
  const assets = require("./library-assets.ts") as typeof import("./library-assets.ts");
  const files = fixtures ? assets.libraryFixtures() : assets.libraryPolicy();
  const grouped = new Map<string, Files>();
  for (const [path, text] of Object.entries(files)) {
    const slash = path.indexOf("/");
    const ns = path.slice(0, slash), rel = path.slice(slash + 1);
    const pack = grouped.get(ns) ?? {};
    pack[rel] = text;
    grouped.set(ns, pack);
  }
  if (fixtures) full = grouped;
  else data = grouped;
  return grouped;
}

export function librarySource(ns: string, fixtures = false): Files | null {
  const files = packs(fixtures).get(ns);
  if (!files || files["source.json"] === undefined) return null;
  return files;
}

export function librarySources(): LibrarySource[] {
  return [...packs(false)].flatMap(([ns, files]) => files["source.json"] === undefined ? [] : [
    { ns, kind: "library" as const, version: (JSON.parse(files["source.json"]) as { version: string }).version },
  ]).sort((a, b) => a.ns.localeCompare(b.ns));
}

// A project pin newer than the bundled pack this engine carries is never proposed as a downgrade:
// the line to print instead, or null when the bundled version is not older.
export function newerPin(ns: string, pinned: string, bundled: string): string | null {
  return ENGINE_VERSION.test(pinned) && compareVersions(pinned, bundled) > 0 ? `${ns} ${pinned} is newer than this engine's ${bundled}; update the engine (pregate update) or approve with the engine that prepared it` : null;
}
