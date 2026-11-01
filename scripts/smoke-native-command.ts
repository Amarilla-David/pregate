import { spawnSync } from "node:child_process";

type NativeCommand = { binary: string; args: string[]; cwd: string; env: NodeJS.ProcessEnv; stdin?: string };

export function runNative(input: NativeCommand) {
  const child = spawnSync(input.binary, input.args, { cwd: input.cwd, env: input.env, input: input.stdin,
    stdio: [input.stdin === undefined ? "ignore" : "pipe", "pipe", "pipe"], timeout: 20000, maxBuffer: 16 * 1024 * 1024 });
  if (child.error || child.signal !== null) throw new Error(`Native command ${JSON.stringify(input.args)} did not complete: ${child.error?.message ?? child.signal}\n${child.stdout}\n${child.stderr}`);
  return { exitCode: child.status, stdout: child.stdout, stderr: child.stderr };
}
