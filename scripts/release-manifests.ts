import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import pkg from "../package.json" with { type: "json" };

const ROOT = join(import.meta.dir, "..");
const DIST = join(ROOT, "dist");
const REPO = "pedroknigge/pregate";

export function parseSums(text: string, version: string): Record<string, string> {
  const map: Record<string, string> = {};
  for (const line of text.trim().split(/\r?\n/)) {
    const m = /^([0-9a-f]{64})\s+pregate-([0-9A-Za-z.-]+)-(darwin-arm64|darwin-x64|linux-x64|linux-arm64|windows-x64)\.(tar\.gz|zip)$/.exec(line.trim());
    if (m && m[2] === version) map[m[3]!] = m[1]!;
  }
  return map;
}

export function homebrewFormula(version: string, sums: Record<string, string>): string {
  const base = `https://github.com/${REPO}/releases/download/v${version}`;
  return [
    "class Pregate < Formula",
    '  desc "Pre-tool deterministic gate and static verifier for AI coding agents"',
    `  homepage "https://github.com/${REPO}"`,
    `  version "${version}"`,
    '  license "MIT"',
    "",
    "  on_macos do",
    "    if Hardware::CPU.arm?",
    `      url "${base}/pregate-${version}-darwin-arm64.tar.gz"`,
    `      sha256 "${sums["darwin-arm64"] ?? ""}"`,
    "    else",
    `      url "${base}/pregate-${version}-darwin-x64.tar.gz"`,
    `      sha256 "${sums["darwin-x64"] ?? ""}"`,
    "    end",
    "  end",
    "",
    "  on_linux do",
    "    if Hardware::CPU.arm?",
    `      url "${base}/pregate-${version}-linux-arm64.tar.gz"`,
    `      sha256 "${sums["linux-arm64"] ?? ""}"`,
    "    else",
    `      url "${base}/pregate-${version}-linux-x64.tar.gz"`,
    `      sha256 "${sums["linux-x64"] ?? ""}"`,
    "    end",
    "  end",
    "",
    "  def install",
    '    bin.install "pregate"',
    "  end",
    "",
    "  test do",
    '    assert_match version.to_s, shell_output("#{bin}/pregate --version")',
    "  end",
    "end",
    "",
  ].join("\n");
}

export function scoopManifest(version: string, sums: Record<string, string>): string {
  const base = `https://github.com/${REPO}/releases/download/v${version}`;
  return JSON.stringify({
    version,
    description: "Pre-tool deterministic gate and static verifier for AI coding agents",
    homepage: `https://github.com/${REPO}`,
    license: "MIT",
    architecture: {
      "64bit": {
        url: `${base}/pregate-${version}-windows-x64.zip`,
        hash: sums["windows-x64"] ?? "",
      },
    },
    bin: "pregate.exe",
    checkver: "github",
    autoupdate: {
      architecture: {
        "64bit": {
          url: `https://github.com/${REPO}/releases/download/v$version/pregate-$version-windows-x64.zip`,
        },
      },
    },
  }, null, 2) + "\n";
}

if (import.meta.main) {
  const sums = parseSums(readFileSync(join(DIST, "SHA256SUMS"), "utf8"), pkg.version);
  writeFileSync(join(DIST, "pregate.rb"), homebrewFormula(pkg.version, sums));
  writeFileSync(join(DIST, "pregate.json"), scoopManifest(pkg.version, sums));
  console.log("dist/pregate.rb\ndist/pregate.json");
}
