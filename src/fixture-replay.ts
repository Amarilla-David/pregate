import { existsSync, lstatSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { readTree } from "./disk.ts";
import type { Files } from "./types.ts";

// Only explicit fixture data is included: notes and unrelated project files stay local.
export function readFixture(path: string): Files {
  const input = resolve(path);
  let files: Files;
  if (lstatSync(input).isDirectory()) {
    for (const name of ["CHECK.json", "fixture.json", "files", "before"]) if (existsSync(join(input, name)) && lstatSync(join(input, name)).isSymbolicLink()) throw new Error("Reproduction entries must not be symbolic links.");
    files = { "CHECK.json": readFileSync(join(input, "CHECK.json"), "utf8"), "fixture.json": readFileSync(join(input, "fixture.json"), "utf8") };
    for (const side of ["files", "before"]) if (existsSync(join(input, side))) {
      for (const [rel, text] of Object.entries(readTree(join(input, side), true))) files[side + "/" + rel] = text;
    }
  } else files = JSON.parse(readFileSync(input, "utf8"));
  if (!files || Array.isArray(files) || typeof files !== "object" || !files["CHECK.json"] || !files["fixture.json"]
    || Object.entries(files).some(([path, text]) => typeof text !== "string" || path.includes("\\") || path.includes(":")
      || path.split("/").some((part) => ["", ".", ".."].includes(part))
      || !["CHECK.json", "fixture.json"].includes(path) && !/^(files|before)\/.+\.fixture$/.test(path))) {
    throw new Error("Reproduction needs CHECK.json, fixture.json and relative files/ or before/ .fixture files, all containing text.");
  }
  return Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b)));
}
