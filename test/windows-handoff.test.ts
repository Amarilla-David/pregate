import { expect, test } from "bun:test";
import { join } from "node:path";

const script = join(import.meta.dir, "../scripts/verify-windows.ts");
function run(...args: string[]) {
  return Bun.spawnSync([process.execPath, script, ...args], { stdout: "pipe", stderr: "pipe", timeout: 10000 });
}
test("manual Windows handoff exposes its prerequisites without starting a verification", () => {
  const result = run("--help");
  expect(result.exitCode).toBe(0);
  expect(result.stdout.toString()).toContain("--artifacts <candidate-directory>");
  expect(result.stdout.toString()).toContain("Requires native Windows x64");
  expect(result.stdout.toString()).not.toContain("PASS");
});
test("manual Windows handoff rejects an ambiguous command before testing", () => {
  const result = run("--artifacts", "missing", "--upload", "yes");
  expect(result.exitCode).toBe(1);
  expect(result.stderr.toString()).toContain("--report <new-directory>");
});
if (process.platform !== "win32" || process.arch !== "x64") test("a non-Windows host cannot produce a Windows verification pass", () => {
  const result = run("--artifacts", "missing");
  expect(result.exitCode).toBe(1);
  expect(result.stderr.toString()).toContain("Native Windows x64 is required");
  expect(result.stdout.toString()).not.toContain("PASS");
});
