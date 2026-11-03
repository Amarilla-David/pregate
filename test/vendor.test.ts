import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";

const sha256 = (path: string): string => createHash("sha256").update(readFileSync(path)).digest("hex");
const notices = readFileSync("THIRD_PARTY_NOTICES", "utf8");

for (const dir of readdirSync("vendor")) {
  const origin = readFileSync(`vendor/${dir}/ORIGIN`, "utf8");
  const field = (key: string): string => new RegExp(`^${key}: (.+)$`, "m").exec(origin)?.[1] ?? "";
  const listed = [...origin.matchAll(/^([0-9a-f]{64}) {2}(\S+)$/gm)].map(([, hash, file]) => ({ hash, file }));

  test(`vendor/${dir}: every file matches its sha256 in ORIGIN and nothing else is there`, () => {
    expect(listed.map(({ file }) => file).sort()).toEqual(readdirSync(`vendor/${dir}`).filter((f) => f !== "ORIGIN").sort());
    for (const { hash, file } of listed) expect(`${file} ${sha256(`vendor/${dir}/${file}`)}`).toBe(`${file} ${hash}`);
  });

  test(`THIRD_PARTY_NOTICES carries ${dir} with its version and full license text`, () => {
    expect(notices).toContain(field("package").replace("@", " "));
    expect(notices).toContain(readFileSync(`vendor/${dir}/LICENSE`, "utf8").trim());
  });
}

test("THIRD_PARTY_NOTICES carries the pinned Bun runtime and the JavaScriptCore LGPL terms", () => {
  const version = readFileSync(".bun-version", "utf8").trim();
  expect(notices).toContain(`Bun runtime ${version}`);
  expect(notices).toContain(`https://github.com/oven-sh/bun/tree/bun-v${version}`);
  expect(notices).toContain("GNU LIBRARY GENERAL PUBLIC LICENSE");
  expect(notices).toContain("Version 2, June 1991");
  expect(notices).toContain("END OF TERMS AND CONDITIONS");
  expect(notices).toContain("d6375c72affe0f70222cdcb45012b10f0bf3a9d5");
  expect(notices).toContain("https://github.com/oven-sh/WebKit/tree/d6375c72affe0f70222cdcb45012b10f0bf3a9d5");
  expect(notices).toContain("Written offer");
  expect(notices).toContain("three years");
  expect(notices).toContain("bun sync-webkit-source");
  expect(notices).toContain("section 6(b)");
  expect(notices).not.toContain("pending owner review");
});
