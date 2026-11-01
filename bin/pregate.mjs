#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const version = pkg.version;
const windows = process.platform === "win32";
const dataHome = process.env.XDG_DATA_HOME
  || (windows ? process.env.LOCALAPPDATA || join(homedir(), "AppData", "Local") : join(homedir(), ".local", "share"));
const engineBin = join(dataHome, "pregate", version, windows ? "pregate.exe" : "pregate");

function run(cmd, args) {
  const res = spawnSync(cmd, args, { stdio: "inherit" });
  if (res.error) {
    console.error(`pregate: ${res.error.message}`);
    process.exit(1);
  }
  process.exit(res.status ?? 1);
}

if (existsSync(engineBin)) {
  run(engineBin, process.argv.slice(2));
}

if (existsSync(join(root, "src", "main.ts"))) {
  const bunProbe = spawnSync(windows ? "bun.exe" : "bun", ["--version"], { stdio: "ignore" });
  if (bunProbe.status === 0) {
    run(windows ? "bun.exe" : "bun", [join(root, "src", "main.ts"), ...process.argv.slice(2)]);
  }
}

const installRes = windows
  ? spawnSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", join(root, "install.ps1"), "-Version", `v${version}`], { stdio: "inherit" })
  : spawnSync("sh", [join(root, "install.sh"), "--version", `v${version}`], { stdio: "inherit" });

if (installRes.status !== 0 || !existsSync(engineBin)) {
  process.exit(installRes.status || 1);
}

run(engineBin, process.argv.slice(2));
