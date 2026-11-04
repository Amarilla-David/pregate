import { expect, test } from "bun:test";
import { dependencySatisfies } from "../src/dependency-since.ts";
import type { Read } from "../src/types.ts";

const since = { dependencies: ["@prisma/client", "prisma"], version: "7.0.0" };
const manifest = (spec: string, field = "dependencies") => JSON.stringify({ [field]: { "@prisma/client": spec } });
const installed = (version: string) => JSON.stringify({ name: "@prisma/client", version });

function read(files: Record<string, string>): Read {
  return (rel) => files[rel] ?? null;
}

test("a Prisma 6 range stays quiet and a Prisma 7 range applies", () => {
  expect(dependencySatisfies(read({ "package.json": manifest("^6.19.0") }), "src/db.ts", since)).toBe(false);
  expect(dependencySatisfies(read({ "package.json": manifest("6.19.0") }), "src/db.ts", since)).toBe(false);
  expect(dependencySatisfies(read({ "package.json": manifest(">=6.0.0") }), "src/db.ts", since)).toBe(false);
  expect(dependencySatisfies(read({ "package.json": manifest("^7.0.0") }), "src/db.ts", since)).toBe(true);
  expect(dependencySatisfies(read({ "package.json": manifest("7.0.0", "devDependencies") }), "src/db.ts", since)).toBe(true);
  expect(dependencySatisfies(read({ "package.json": manifest("workspace:^7.0.0") }), "src/db.ts", since)).toBe(true);
  expect(dependencySatisfies(read({ "package.json": manifest("7.0.0-rc.1") }), "src/db.ts", since)).toBe(false);
  expect(dependencySatisfies(read({}), "src/db.ts", since)).toBe(false);
  expect(dependencySatisfies(read({ "package.json": manifest("workspace:*") }), "src/db.ts", since)).toBe(false);
});

test("the installed client wins when the manifest does not prove an older release", () => {
  const files = {
    "package.json": manifest("^7.0.0"),
    "node_modules/@prisma/client/package.json": installed("6.19.0"),
  };
  expect(dependencySatisfies(read(files), "src/db.ts", since)).toBe(false);
  files["node_modules/@prisma/client/package.json"] = installed("7.0.0");
  expect(dependencySatisfies(read(files), "src/db.ts", since)).toBe(true);
  expect(dependencySatisfies(read({
    "package.json": manifest("workspace:*"),
    "node_modules/@prisma/client/package.json": installed("7.2.1"),
  }), "src/db.ts", since)).toBe(true);
});

test("a nested Prisma 6 package is not denied by a root Prisma 7 install", () => {
  const files = {
    "package.json": manifest("^7.0.0"),
    "node_modules/@prisma/client/package.json": installed("7.0.0"),
    "packages/legacy/package.json": manifest("^6.19.0"),
  };
  expect(dependencySatisfies(read(files), "packages/legacy/src/db.ts", since)).toBe(false);
  expect(dependencySatisfies(read({
    "package.json": manifest("^6.19.0"),
    "packages/app/package.json": manifest("^7.0.0"),
  }), "packages/app/src/db.ts", since)).toBe(true);
});

test("the client package decides before the prisma CLI package", () => {
  expect(dependencySatisfies(read({
    "package.json": JSON.stringify({ dependencies: { "@prisma/client": "^6.19.0" }, devDependencies: { prisma: "^7.0.0" } }),
  }), "src/db.ts", since)).toBe(false);
  expect(dependencySatisfies(read({
    "package.json": JSON.stringify({ devDependencies: { prisma: "^7.0.0" } }),
  }), "src/db.ts", since)).toBe(true);
});
