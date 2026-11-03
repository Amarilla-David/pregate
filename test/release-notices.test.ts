import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { accompanyEngine } from "../src/machine.ts";

const PHRASES = [
  "GNU LIBRARY GENERAL PUBLIC LICENSE", "Version 2, June 1991", "END OF TERMS AND CONDITIONS",
  "d6375c72affe0f70222cdcb45012b10f0bf3a9d5", "Written offer", "three years", "section 6(b)", "bun sync-webkit-source",
];

test("a release archive contains the JavaScriptCore license, source pin, offer and relink note", () => {
  const dir = mkdtempSync(join(tmpdir(), "pregate-notices-"));
  try {
    const src = join(dir, "src");
    mkdirSync(src);
    writeFileSync(join(src, "pregate"), "#!/bin/sh\n");
    writeFileSync(join(src, "LICENSE"), readFileSync("LICENSE"));
    writeFileSync(join(src, "THIRD_PARTY_NOTICES"), readFileSync("THIRD_PARTY_NOTICES"));
    const archive = join(dir, "pregate.tar.gz");
    const packed = Bun.spawnSync(["tar", "-czf", archive, "-C", src, "pregate", "LICENSE", "THIRD_PARTY_NOTICES"], { env: { ...process.env, COPYFILE_DISABLE: "1" } });
    expect(packed.exitCode, packed.stderr.toString()).toBe(0);
    const notice = Bun.spawnSync(["tar", "-xOzf", archive, "THIRD_PARTY_NOTICES"], { stdout: "pipe", stderr: "pipe" });
    expect(notice.exitCode, notice.stderr.toString()).toBe(0);
    const text = notice.stdout.toString();
    for (const phrase of PHRASES) expect(text).toContain(phrase);
    const engine = join(dir, "engine");
    mkdirSync(engine);
    accompanyEngine(join(src, "pregate"), engine);
    const installed = readFileSync(join(engine, "THIRD_PARTY_NOTICES"), "utf8");
    for (const phrase of PHRASES) expect(installed).toContain(phrase);
    expect(readFileSync(join(engine, "LICENSE"), "utf8").length).toBeGreaterThan(0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
