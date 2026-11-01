import { join } from "node:path";
import { slash } from "./paths.ts";

export const WINDOWS = process.platform === "win32";
export const ENGINE_FILE = WINDOWS ? "pregate.exe" : "pregate";

export function homeDir(): string {
  const home = process.env.HOME || (WINDOWS ? process.env.USERPROFILE : undefined);
  if (!home) throw new Error("User home is not set");
  return home;
}

export function storageDir(kind: "data" | "state"): string {
  const base = process.env[kind === "data" ? "XDG_DATA_HOME" : "XDG_STATE_HOME"]
    || (WINDOWS ? join(process.env.LOCALAPPDATA || join(homeDir(), "AppData/Local"), kind === "data" ? "" : "State")
      : join(homeDir(), `.local/${kind === "data" ? "share" : "state"}`));
  return slash(join(base, "pregate"));
}
