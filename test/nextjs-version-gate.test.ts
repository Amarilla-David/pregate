import { beforeAll, expect, test } from "bun:test";
import { BUILTIN } from "../src/assets.ts";
import { compile } from "../src/compile.ts";
import { blocking } from "../src/decide.ts";
import { analyze } from "../src/evaluate.ts";
import { clock, grammars, VERSIONS } from "../src/gate.ts";
import { librarySource } from "../src/library.ts";
import { violationMessage } from "../src/message.ts";
import { entirelyAtLeast } from "../src/package-version.ts";
import type { Lock, Preset, Read } from "../src/types.ts";

beforeAll(grammars);

const minimum = { major: 16, minor: 0, patch: 0 };

test("a next range matches the Next 16 gate only when it cannot install 15", () => {
  const yes = ["16.4.1", "v16.0.0", "16", "16.4", "16.x", "16.4.x", "^16.0.0", "^16.2.3", "~16.4.1",
    ">=16", ">=16.0.0", ">=16.0.0 <17.0.0", ">16.0.0", "16.0.0-canary.8", "^16.0.0-canary.1",
    "workspace:^16.1.0", "npm:next@16.4.0", "16.4.0 || ^16.1.0"];
  const no = ["15.5.4", "^15.2.0", "~15.5.0", ">=15", ">=15.0.0 <16", ">15.9.9", "*", "latest", "next",
    "canary", "workspace:*", "catalog:", "file:../next", "git+https://example.com/next.git",
    "16.4.0 || ^15.0.0", ">=16.0.0 || >=15", ""];
  for (const spec of yes) expect(entirelyAtLeast(spec, minimum), spec).toBe(true);
  for (const spec of no) expect(entirelyAtLeast(spec, minimum), spec).toBe(false);
});

function nextLock(overrides?: Preset["overrides"]): Lock {
  const files = librarySource("nextjs")!;
  const preset: Preset = {
    name: "next-gate", version: "1.0.0", engine: VERSIONS.engine,
    sources: [
      { ns: "core", kind: "builtin", version: VERSIONS.core },
      { ns: "nextjs", kind: "library", version: JSON.parse(files["source.json"]!).version },
    ],
    methodologies: ["nextjs/rendering", "nextjs/routing"],
    enforcement: "enforce",
    overrides,
  };
  const out = compile(JSON.stringify(preset), (source) => source.kind === "builtin" ? BUILTIN : librarySource(source.ns), VERSIONS);
  if ("errors" in out) throw new Error(out.errors.join("\n"));
  return out.lock;
}

const cookies = 'import { cookies } from "next/headers";\nexport default function Page() {\n  return cookies().get("theme");\n}\n';
const tag = 'import { revalidateTag } from "next/cache";\nexport function publish() {\n  revalidateTag("posts");\n}\n';
const page = 'export default function Page({ params }: { params: Promise<{ slug: string }> }) {\n  return <h1>{params.slug}</h1>;\n}\n';

function manifest(version: string): string {
  return JSON.stringify({ dependencies: { next: version } });
}

function readOf(files: Record<string, string>): Read {
  return (rel) => files[rel] ?? null;
}

function findings(lock: Lock, path: string, source: string, files: Record<string, string>) {
  const out = analyze(lock, "pre", path, source, { now: clock, read: readOf(files) });
  if ("cause" in out) throw new Error(JSON.stringify(out));
  return out.violations.map((finding) => ({ rule: finding.rule, severity: finding.severity, message: violationMessage(finding, lock) }));
}

test("Next 16 denies the removed sync and cache calls, and Next 15 does not", () => {
  const lock = nextLock();
  const at16 = findings(lock, "app/page.tsx", cookies, { "package.json": manifest("16.4.0") });
  const async16 = at16.find((finding) => finding.rule === "nextjs/NEXT-ASYNC-001");
  expect(async16?.severity).toBe("deny");
  expect(async16?.message).toContain("https://nextjs.org/docs/app/guides/upgrading/version-16");
  expect(blocking(lock, at16.map((finding) => ({ ...finding, path: "app/page.tsx", line: 1, symbol: "cookies", measured: null, limit: null, atSessionStart: null })), null).violations.map((finding) => finding.rule)).toContain("nextjs/NEXT-ASYNC-001");

  const at15 = findings(lock, "app/page.tsx", cookies, { "package.json": manifest("15.5.4") });
  expect(at15.find((finding) => finding.rule === "nextjs/NEXT-ASYNC-001")?.severity).toBe("warn");
  expect(findings(lock, "app/actions.ts", tag, { "package.json": manifest("^15.2.0") }).map((finding) => finding.rule)).not.toContain("nextjs/NEXT-REVALTAG-001");
  expect(findings(lock, "app/page.tsx", page, { "package.json": manifest(">=15") }).map((finding) => finding.rule)).not.toContain("nextjs/NEXT-PARAMS-001");

  const removed = findings(lock, "app/actions.ts", tag, { "package.json": manifest("16.0.0-canary.8") });
  expect(removed.find((finding) => finding.rule === "nextjs/NEXT-REVALTAG-001")).toMatchObject({ severity: "deny" });
  expect(removed.find((finding) => finding.rule === "nextjs/NEXT-REVALTAG-001")?.message).toContain("https://nextjs.org/docs/app/guides/upgrading/version-16");
  expect(findings(lock, "app/page.tsx", page, { "package.json": manifest("^16.0.0") }).map((finding) => finding.rule)).toContain("nextjs/NEXT-PARAMS-001");
});

test("the nearest package.json wins, and a severity override replaces the gate", () => {
  const lock = nextLock();
  const nested = {
    "package.json": manifest("15.5.0"),
    "app/package.json": manifest("16.1.0"),
  };
  expect(findings(lock, "app/page.tsx", page, nested).some((finding) => finding.rule === "nextjs/NEXT-PARAMS-001" && finding.severity === "deny")).toBe(true);
  const olderNested = {
    "package.json": manifest("16.4.0"),
    "src/package.json": manifest("^15.5.0"),
  };
  expect(findings(lock, "src/app/page.tsx", page, olderNested)).toEqual([]);
  expect(findings(lock, "app/page.tsx", page, { "package.json": manifest("15.5.0") })).toEqual([]);

  const pinned = nextLock({ "nextjs/NEXT-ASYNC-001": "warn", "nextjs/NEXT-REVALTAG-001": "off" });
  const forced = findings(pinned, "app/page.tsx", cookies, { "package.json": manifest("16.4.0") });
  expect(forced.find((finding) => finding.rule === "nextjs/NEXT-ASYNC-001")?.severity).toBe("warn");
  expect(findings(pinned, "app/actions.ts", tag, { "package.json": manifest("16.4.0") })).toEqual([]);
});

test("Edge middleware is quiet and a Node middleware file warns only on Next 16", () => {
  const lock = nextLock();
  const edge = 'export function middleware(request: Request) {\n  return request;\n}\n\nexport const config = { matcher: "/admin" };\n';
  const node = 'export const config = { runtime: "nodejs" };\n';
  const named = "export function middleware(request: Request) {\n  return request;\n}\n";
  expect(findings(lock, "middleware.ts", edge, { "package.json": manifest("16.4.0") })).toEqual([]);
  expect(findings(lock, "middleware.ts", node, { "package.json": manifest("15.5.0") })).toEqual([]);
  const warned = findings(lock, "middleware.ts", node, { "package.json": manifest("16.4.0") });
  expect(warned).toMatchObject([{ rule: "nextjs/NEXT-PROXY-002", severity: "warn" }]);
  expect(warned[0]?.message).toContain("https://nextjs.org/docs/app/guides/upgrading/version-16");
  const denied = findings(lock, "proxy.ts", named, { "package.json": manifest("16.4.0") });
  expect(denied.find((finding) => finding.rule === "nextjs/NEXT-PROXY-001")?.severity).toBe("deny");
  expect(denied[0]?.message).toContain("https://nextjs.org/docs/app/api-reference/file-conventions/proxy");
});
