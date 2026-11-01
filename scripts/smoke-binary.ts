import { join, resolve } from "node:path";
import { hostTarget } from "./build.ts";
import { ENGINE_FILE } from "../src/platform.ts";
import { VERSIONS } from "../src/versions.ts";

// Smoke scripts can test the exact installed candidate instead of a separately rebuilt binary.
export function smokeBinary(): string {
  const args = process.argv.slice(2);
  if (args.length > 1) throw new Error("usage: smoke-<feature>.ts [candidate binary]");
  return args[0] === undefined ? join(import.meta.dir, "..", "dist", "pregate-" + VERSIONS.engine + "-" + hostTarget(), ENGINE_FILE) : resolve(args[0]);
}
