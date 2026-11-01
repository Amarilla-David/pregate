import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { equal, type SchemaName, unsupported, validate } from "../src/schema.ts";

const NAMES: SchemaName[] = ["preset", "check", "methodology", "fixture", "source", "request"];

test("schema pointers escape namespace separators and override errors show the accepted enforcement form", () => {
  expect(validate({ type: "object", additionalProperties: { type: "integer" } }, { "team/~rule": "bad" }))
    .toEqual(["/team~1~0rule: must be of type integer"]);
  const preset = JSON.parse(readFileSync("test/presets/valid.json", "utf8"));
  preset.overrides = { "vibe-proof/VP-BUILD-001": "enforce" };
  const errors = validate("preset", preset);
  expect(errors.join("\n")).toContain("/overrides/vibe-proof~1VP-BUILD-001");
  expect(errors.join("\n")).toContain('Allowed: "deny", "ask", "warn", "off"');
  expect(errors.join("\n")).toContain('{"enforcement":"enforce"}');
  preset.overrides["vibe-proof/VP-BUILD-001"] = { enforcement: "enforce" };
  expect(validate("preset", preset)).toEqual([]);
});

test("a trap's schema requires failure with declared lines", () => {
  const fixture = JSON.parse(readFileSync("packs/clean-code/checks/complexity/fn-max-params/fixtures/trap/rest-tuple/fixture.json", "utf8"));
  expect(validate("fixture", fixture)).toEqual([]);
  expect(validate("fixture", { ...fixture, expect: { verdict: "pass" } })).toContain('/expect/verdict: must be "fail"');
  expect(validate("fixture", { ...fixture, expect: { verdict: "fail", violations: [] } })).not.toEqual([]);
});

test.each(NAMES)("schema/%s.v1.json uses only supported keywords", (name) => {
  expect(unsupported(JSON.parse(readFileSync(`schema/${name}.v1.json`, "utf8")))).toEqual([]);
});

// Every JSON file in the repo's data that names one of our schemas in `$schema` validates against it.
describe("repo JSON validates against the schema it declares", () => {
  const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(`${dir}/${e.name}`) : e.name.endsWith(".json") ? [`${dir}/${e.name}`] : []);
  const declared = ["catalog", "packs", "test", ".pregate"].filter((dir) => existsSync(dir)).flatMap(walk).flatMap((path) => {
    const doc = JSON.parse(readFileSync(path, "utf8")) as { $schema?: unknown };
    const name = /schema\/([a-z]+)\.v1\.json$/.exec(String(doc.$schema))?.[1];
    return name ? [[path, name as SchemaName, doc] as const] : [];
  });
  test("finds the dogfooding preset and the test presets", () => {
    expect(declared.map(([path]) => path)).toContain(".pregate/preset.json");
    expect(declared.map(([path]) => path)).toContain("test/presets/valid.json");
  });
  test.each(declared)("%s (%s)", (_, name, doc) => {
    expect(validate(name, doc)).toEqual([]);
  });
});

describe("unsupported", () => {
  test.each([
    [{ type: "integer", default: 3 }, ["/default: unsupported keyword"]],
    [{ type: "object", properties: { a: { maxLength: 2 } } }, ["/properties/a/maxLength: unsupported keyword"]],
    [{ type: "array", items: { format: "uri" } }, ["/items/format: unsupported keyword"]],
    [{ oneOf: [{ type: "string" }, { $ref: "#" }] }, ["/oneOf/1/$ref: unsupported keyword"]],
    [{ additionalProperties: { type: "date" } }, ['/additionalProperties/type: invalid value "date"']],
    [{ type: ["string", "null"] }, ['/type: invalid value ["string","null"]']],
    [{ items: true }, ["/items: invalid value true"]],
    [{ additionalProperties: true }, ["/additionalProperties: invalid value true"]],
    [{ enum: "deny" }, ['/enum: invalid value "deny"']],
    [{ type: "object", required: "a" }, ['/required: invalid value "a"']],
    [{ required: [1] }, ["/required: invalid value [1]"]],
    [{ properties: [] }, ["/properties: invalid value []"]],
    [{ minimum: "3" }, ['/minimum: invalid value "3"']],
    [{ minItems: -1 }, ['/minItems: invalid value -1']],
    [{ dependentSchemas: { trap: false } }, ["/dependentSchemas/trap: a schema must be an object"]],
    [{ oneOf: {} }, ["/oneOf: invalid value {}"]],
    [{ pattern: "(" }, ['/pattern: invalid value "("']],
    [{ properties: { a: 1 } }, ["/properties/a: a schema must be an object"]],
    [{ additionalProperties: false, properties: {}, required: [], enum: [1], const: 1, pattern: "a", minimum: 0 }, []],
  ])("%j", (schema, errors) => {
    expect(unsupported(schema)).toEqual(errors);
  });
});

describe("validate", () => {
  test.each([
    ["type object", { type: "object" }, [], ["/: must be of type object"]],
    ["type array", { type: "array" }, {}, ["/: must be of type array"]],
    ["type integer", { type: "integer" }, 1.5, ["/: must be of type integer"]],
    ["type number", { type: "number" }, "1", ["/: must be of type number"]],
    ["type string", { type: "string" }, null, ["/: must be of type string"]],
    ["type boolean", { type: "boolean" }, 0, ["/: must be of type boolean"]],
    ["type null", { type: "null" }, null, []],
    ["a failed type stops the rest", { type: "string", pattern: "^a$", enum: ["a"] }, 1, ['/: must be one of "a"', "/: must be of type string"]],
    ["const", { const: { a: [1] } }, { a: [2] }, ['/: must be {"a":[1]}']],
    ["const ignores key order", { const: { a: 1, b: 2 } }, { b: 2, a: 1 }, []],
    ["enum with null", { enum: ["deny", null] }, "warn", ['/: must be one of "deny", null']],
    ["pattern is unanchored unless the schema anchors it", { pattern: "b" }, "abc", []],
    ["pattern", { type: "string", pattern: "^[a-z]+$" }, "aB", ["/: must match ^[a-z]+$"]],
    ["minimum", { type: "integer", minimum: 1 }, 0, ["/: must be >= 1"]],
    ["minItems", { type: "array", minItems: 1 }, [], ["/: must have at least 1 items"]],
    ["minItems boundary", { type: "array", minItems: 1 }, [1], []],
    ["dependency absent", { dependentSchemas: { trap: { required: ["expect"] } } }, {}, []],
    ["dependency present", { dependentSchemas: { trap: { required: ["expect"] } } }, { trap: {} }, ["/expect: is required"]],
    ["items", { type: "array", items: { type: "string" } }, ["a", 2], ["/1: must be of type string"]],
    ["required", { type: "object", required: ["a", "b"] }, { a: 1 }, ["/b: is required"]],
    ["properties", { type: "object", properties: { a: { type: "string" } } }, { a: 1, b: 1 }, ["/a: must be of type string"]],
    ["additionalProperties false", { properties: { a: {} }, additionalProperties: false }, { a: 1, b: 1 }, ["/b: is not allowed"]],
    ["additionalProperties schema", { additionalProperties: { type: "integer" } }, { x: "1" }, ["/x: must be of type integer"]],
    ["__proto__ is an ordinary key", { additionalProperties: false }, JSON.parse('{"__proto__": 1}'), ["/__proto__: is not allowed"]],
    ["oneOf: none", { oneOf: [{ type: "string" }, { type: "integer" }] }, true, ["/: matches no allowed form"]],
    ["oneOf: exactly one", { oneOf: [{ type: "string" }, { type: "integer" }] }, 3, []],
    ["oneOf: more than one", { oneOf: [{ type: "number" }, { type: "integer" }] }, 3, ["/: matches more than one allowed form"]],
    ["keywords that do not apply to the value's type are ignored", { pattern: "^a$", minimum: 3, items: { type: "string" } }, {}, []],
  ])("%s", (_, schema, value, errors) => {
    expect(validate(schema, value)).toEqual(errors);
  });

  test("named schemas: errors carry the pointer to the offending value", () => {
    expect(validate("source", { ns: "Core", version: "1.0" })).toEqual([
      "/ns: must match ^[a-z][a-z0-9-]*$",
      "/version: must match ^(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)$",
    ]);
    expect(validate("preset", { name: "x", version: "1.0.0", engine: "1.0.0", methodologies: [], sources: [{ ns: "core", kind: "builtin" }] }))
      .toEqual(["/sources/0: matches no allowed form"]);
    expect(validate("request", { why: "w", patch: [{ op: "remove", path: "/a", value: 1 }] }))
      .toEqual(["/patch/0: matches no allowed form"]);
  });
});

test.each([
  [1, 1, true], [[1, { a: 2 }], [1, { a: 2 }], true], [{ a: 1, b: [] }, { b: [], a: 1 }, true],
  [{ a: 1 }, { a: 1, b: 1 }, false], [[1], [1, 2], false], [null, {}, false], [{}, [], false], ["1", 1, false],
])("equal(%j, %j) is %p", (a, b, same) => {
  expect(equal(a, b)).toBe(same);
});
