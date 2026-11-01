// Run the pack and the pinned published runtime on the same controlled examples.
// Usage: bun scripts/dcouplr-source-probe.ts /path/to/extracted/package | --fetch
// --fetch retrieves the exact integrity-pinned artifact. No dependency installation,
// project consent or global configuration changes. All scratch material is removed.
import { deepStrictEqual, match, strictEqual } from "node:assert";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { BUILTIN } from "../src/assets.ts";
import { compile } from "../src/compile.ts";
import { readTree } from "../src/disk.ts";
import { analyze } from "../src/evaluate.ts";
import { clock, grammars, VERSIONS } from "../src/gate.ts";
import type { Preset } from "../src/types.ts";
import PIN from "../packs/dcouplr/upstream-pin.json" with { type: "json" };
import { coverageLedger } from "./dcouplr-coverage.ts";
import { deliveryCases, deliveryEvidence } from "./dcouplr-delivery-cases.ts";
import { loggingCases, loggingEvidence } from "./dcouplr-logging-cases.ts";
import { queueCases, queueEvidence } from "./dcouplr-queue-cases.ts";
import { sagaCases, sagaEvidence } from "./dcouplr-saga-cases.ts";
import { factoryCases, factoryEvidence } from "./dcouplr-factory-cases.ts";
import { systemBusCases, subscriptionRegistryCases } from "./dcouplr-bus-cases.ts";
import { utilityCases, utilityEvidence } from "./dcouplr-utility-cases.ts";
import { observabilityCases, observabilityEvidence } from "./dcouplr-observability-cases.ts";
export interface Example {
  name: string; text: string; path?: string; extension?: "ts";
  findings: string[];
  result?: unknown; error?: RegExp; warnings?: RegExp[];
  coverage: "checked" | "valid" | "advisory" | "runtime-only";
}
const boot = (mode = "run") => `import { setupDcouplr, getDcouplr } from 'dcouplr';
setupDcouplr({ charEncoding: 'UTF-8', mode: '${mode}', ephemeral: true });
const app = getDcouplr();\n`;
const factory = (creator: string) => `app.dependencyAdmission.declareIntent('ORDER')
.addMandatoryInputFields({}).addValidationPolicy().addVerificationPolicy()
.addFactoryMethod(${creator})`;
const resolveOrder = `export const result = app.resolve('ORDER', { id: 'submitted' });\n`;
const cases: Example[] = [
  { name: "zero-argument factory", text: boot() + factory("() => ({ ready: true })") + ".register();\n" + resolveOrder,
    findings: [], result: { ready: true }, coverage: "valid" },
  { name: "one-argument factory", text: boot() + factory("input => ({ id: input.id })") + ".register();\n" + resolveOrder,
    findings: [], result: { id: "submitted" }, coverage: "valid" },
  { name: "two-argument factory", text: boot() + factory("(input, kernel) => ({ id: input.id, hasLogger: typeof kernel.logger.info === 'function' })") + ".register();\n" + resolveOrder,
    findings: [], result: { id: "submitted", hasLogger: true }, coverage: "valid" },
  { name: "third required argument is not injected", text: boot() + factory("(input, kernel, required) => ({ missing: required === undefined })") + ".register();\n" + resolveOrder,
    findings: ["dcouplr/DCP-INJECT-001:deny"], result: { missing: true }, coverage: "checked" },
  { name: "later factory default is harmless", text: boot() + factory("(input, kernel, ownDefault = 'local') => ({ value: ownDefault })") + ".register();\n" + resolveOrder,
    findings: ["dcouplr/DCP-ARITY-001:warn"], result: { value: "local" }, coverage: "advisory" },
  { name: "first default suppresses injection", text: boot() + factory("(input = { id: 'fallback' }, kernel) => ({ id: input.id, kernelMissing: kernel === undefined })") + ".register();\n" + resolveOrder,
    findings: ["dcouplr/DCP-ARITY-001:warn"], result: { id: "fallback", kernelMissing: true }, coverage: "advisory" },
];

for (const [name, call, expected, findings, coverage] of [
  ["literal member preserves factory injection", "['addFactoryMethod']((input, kernel) => ({ id: input.id, injected: kernel !== undefined }))", { id: "submitted", injected: true }, [], "valid"],
  ["wrapped creator preserves factory injection", ".addFactoryMethod((((input, kernel) => ({ id: input.id, injected: kernel !== undefined })) as Creator))", { id: "submitted", injected: true }, [], "valid"],
  ["literal member exposes first-default arity", "['addFactoryMethod']((input = { id: 'fallback' }, kernel) => ({ id: input.id, injected: kernel !== undefined }))", { id: "fallback", injected: false }, ["dcouplr/DCP-ARITY-001:warn"], "advisory"],
  ["wrapped creator exposes uninjected third parameter", ".addFactoryMethod((((input, kernel, required) => typeof required) as Creator))", "undefined", ["dcouplr/DCP-INJECT-001:deny"], "checked"],
  ["ignored extra callback is not a factory", ".addFactoryMethod(() => ({ ready: true }), () => Date.now(), (input = {}, kernel) => input, (input, kernel, required) => required)", { ready: true }, [], "valid"],
  ["wrapped creator retains ambient reference policy", "['addFactoryMethod'](((() => typeof Date.now) satisfies Creator))", "function", ["dcouplr/DCP-FACTORY-EFFECTS-001:deny"], "checked"],
] as const) cases.push({ name, text: boot() + factory("() => ({})").replace(".addFactoryMethod(() => ({}))", call) + ".register();\n" + resolveOrder,
  extension: "ts", findings: [...findings], result: expected, coverage });
cases.push({ name: "named const factory retains ambient reference policy", text: boot() + "const creator = () => typeof Date.now;\n" + factory("creator") + ".register();\n" + resolveOrder,
  findings: ["dcouplr/DCP-FACTORY-EFFECTS-001:deny"], result: "function", coverage: "checked" });
for (const [name, creator, result, findings, coverage] of [
  ["named const factory preserves injection", "(input, kernel) => ({ id: input.id, injected: kernel !== undefined })", { id: "submitted", injected: true }, [], "valid"],
  ["named wrapped function preserves injection", "((function named(input, kernel) { return { id: input.id, injected: kernel !== undefined }; }) as Creator)", { id: "submitted", injected: true }, [], "valid"],
  ["named third required parameter is not injected", "(input, kernel, required) => typeof required", "undefined", ["dcouplr/DCP-INJECT-001:deny"], "checked"],
  ["named first default suppresses injection", "(input = { id: 'fallback' }, kernel) => ({ id: input.id, injected: kernel !== undefined })", { id: "fallback", injected: false }, ["dcouplr/DCP-ARITY-001:warn"], "advisory"],
] as const) cases.push({ name, text: boot() + `const creator = ${creator};\n` + factory("creator") + ".register();\n" + resolveOrder,
  extension: "ts", findings: [...findings], result, coverage });
cases.push({ name: "mutable named factory remains a coverage gap", text: boot() + "let creator = () => typeof Date.now;\n" + factory("creator") + ".register();\n" + resolveOrder,
  findings: [], result: "function", coverage: "runtime-only" });

for (const [name, creator, result, findings, coverage] of [
  ["valid injection", "(input, kernel) => ({ id: input.id, injected: kernel !== undefined })", { id: "submitted", injected: true }, [], "valid"],
  ["ambient reference", "() => typeof Date.now", "function", ["dcouplr/DCP-FACTORY-EFFECTS-001:deny"], "checked"],
  ["third required parameter", "(input, kernel, required) => typeof required", "undefined", ["dcouplr/DCP-INJECT-001:deny"], "checked"],
  ["first default", "(input = { id: 'fallback' }, kernel) => ({ id: input.id, injected: kernel !== undefined })", { id: "fallback", injected: false }, ["dcouplr/DCP-ARITY-001:warn"], "advisory"],
] as const) cases.push({ name: `one immutable factory alias ${name}`, text: boot() + `const creator = ${creator}; const alias = creator;\n`
  + factory("alias") + ".register();\n" + resolveOrder, extension: "ts", findings: [...findings], result, coverage });
cases.push({ name: "hoisted declared factory alias retains ambient reference policy", text: boot() + "const alias = creator;\n"
  + factory("alias") + ".register();\nfunction creator() { return typeof Date.now; }\n" + resolveOrder,
  findings: ["dcouplr/DCP-FACTORY-EFFECTS-001:deny"], result: "function", coverage: "checked" });
cases.push({ name: "multiple immutable factory aliases remain an explicit source-coverage gap", text: boot()
  + "const creator = () => typeof Date.now; const first = creator; const second = first;\n" + factory("second") + ".register();\n" + resolveOrder,
  findings: [], result: "function", coverage: "runtime-only" });

for (const [name, params, expression, result, findings, coverage] of [
  ["injection", "input, kernel", "({ id: input.id, injected: kernel !== undefined })", { id: "submitted", injected: true }, [], "valid"],
  ["ambient reference", "", "typeof Date.now", "function", ["dcouplr/DCP-FACTORY-EFFECTS-001:deny"], "checked"],
  ["third required parameter", "input, kernel, required", "typeof required", "undefined", ["dcouplr/DCP-INJECT-001:deny"], "checked"],
  ["first default", "input = { id: 'fallback' }, kernel", "({ id: input.id, injected: kernel !== undefined })", { id: "fallback", injected: false }, ["dcouplr/DCP-ARITY-001:warn"], "advisory"],
] as const) {
  const declaration = `function creator(${params}) { return ${expression}; }\n`;
  const registration = factory("creator") + ".register();\n";
  for (const [form, source] of [
    ["declared", declaration + registration],
    ["hoisted declared", registration + declaration],
    ["exported declared", "export " + declaration + registration],
    ["default exported declared", "export default " + declaration + registration],
    ["exported const", `export const creator = (${params}) => ${expression};\n` + registration],
  ]) cases.push({ name: `${form} factory ${name}`, text: boot() + source + resolveOrder,
    extension: "ts", findings: [...findings], result, coverage });
}
for (const [name, source] of [
  ["last function declaration owns the creator", "function creator() { return typeof Date.now; } function creator() { return { ready: true }; }"],
  ["assignment replaces the declared creator", "function creator() { return typeof Date.now; } creator = () => ({ ready: true });"],
  ["array assignment replaces the declared creator", "function creator() { return typeof Date.now; } [creator] = [() => ({ ready: true })];"],
  ["object assignment replaces the declared creator", "function creator() { return typeof Date.now; } ({creator} = {creator: () => ({ ready: true })});"],
] as const) cases.push({ name, text: boot() + source + "\n" + factory("creator") + ".register();\n" + resolveOrder,
  findings: [], result: { ready: true }, coverage: "runtime-only" });

for (const [name, creator, input, result, findings] of [
  ["erased factory fetch type alias", "input => { type Capture = typeof fetch; return input.id; }", "{ id: 'submitted' }", "submitted", []],
  ["erased factory random return type", "input => { const value: ReturnType<typeof Math.random> = input.value; return value; }", "{ value: 7 }", 7, []],
  ["runtime fetch query beside erased type", "() => { type Capture = typeof fetch; return typeof fetch; }", "{}", "function", ["dcouplr/DCP-FACTORY-EFFECTS-001:deny"]],
  ["runtime random query beside erased type", "() => { type Capture = typeof Math.random; return typeof Math.random; }", "{}", "function", ["dcouplr/DCP-FACTORY-EFFECTS-001:deny"]],
] as const) cases.push({ name, text: boot() + factory(creator) + `.register();\nexport const result = app.resolve('ORDER', ${input});`,
  extension: "ts", findings: [...findings], result, coverage: findings.length ? "checked" : "valid" });

const setupState = (config: string) => `import { setupDcouplr, getDcouplr } from 'dcouplr';
setupDcouplr(${config});
const app = getDcouplr();
app.dependencyAdmission.declareIntent('CONFIG').addMandatoryInputFields({}).addValidationPolicy().addVerificationPolicy()
.addFactoryMethod((input, kernel) => ({ mode: kernel.settings.getMode(), encoding: kernel.settings.getSetting('charEncoding'), ephemeral: kernel.settings.getSetting('ephemeral') })).register();
const settings = app.resolve('CONFIG', {});
export const result = { mode: settings.mode, encoding: settings.encoding, ephemeral: settings.ephemeral };`;
for (const [name, config, result] of [
  ["minimal setup preserves undefined delivery flag", "{ charEncoding: 'UTF-8' }", { mode: "run", encoding: "UTF-8", ephemeral: undefined }],
  ["explicit short-lived setup", "{ charEncoding: 'UTF-8', mode: 'run', ephemeral: true }", { mode: "run", encoding: "UTF-8", ephemeral: true }],
  ["explicit long-lived test setup", "{ charEncoding: 'UTF-8', mode: 'test', ephemeral: false }", { mode: "test", encoding: "UTF-8", ephemeral: false }],
  ["optional undefined preserves mode fallback", "{ charEncoding: 'UTF-8', mode: undefined, ephemeral: void 0 }", { mode: "run", encoding: "UTF-8", ephemeral: undefined }],
  ["supported forbidden elements", "{ charEncoding: 'UTF-8', mode: 'test', forbiddenElements: ['console', 'Math.random', 'Date.now'] }", { mode: "test", encoding: "UTF-8", ephemeral: undefined }],
  ["later valid duplicate owns setup", "{ charEncoding: 1, charEncoding: 'UTF-8', mode: 'invalid', mode: 'run' }", { mode: "run", encoding: "UTF-8", ephemeral: undefined }],
  ["escaped valid mode remains unresolved statically", "{ charEncoding: 'UTF-8', mode: 'r\\x75n' }", { mode: "run", encoding: "UTF-8", ephemeral: undefined }],
] as const) cases.push({ name, text: setupState(config), findings: [], result, coverage: "valid" });

for (const [name, config, error] of [
  ["missing setup DTO", "undefined", /systemDependencies/],
  ["null setup DTO", "null", /systemDependencies/],
  ["wrong encoding type", "{ charEncoding: 1 }", /charEncoding must be a string/],
  ["null encoding", "{ charEncoding: null }", /charEncoding must be a string/],
  ["unknown mode", "{ charEncoding: 'UTF-8', mode: 'production' }", /mode must be 'run' or 'test'/],
  ["boolean mode", "{ charEncoding: 'UTF-8', mode: true }", /mode must be 'run' or 'test'/],
  ["null mode", "{ charEncoding: 'UTF-8', mode: null }", /mode must be 'run' or 'test'/],
  ["string delivery flag", "{ charEncoding: 'UTF-8', ephemeral: 'false' }", /ephemeral must be a boolean/],
  ["numeric delivery flag", "{ charEncoding: 'UTF-8', ephemeral: 0 }", /ephemeral must be a boolean/],
  ["null delivery flag", "{ charEncoding: 'UTF-8', ephemeral: null }", /ephemeral must be a boolean/],
  ["wrong forbidden collection", "{ charEncoding: 'UTF-8', forbiddenElements: 'console' }", /forbiddenElements must be a string\[\]/],
  ["wrong forbidden item", "{ charEncoding: 'UTF-8', forbiddenElements: ['console', 1] }", /forbiddenElements must be a string\[\]/],
  ["unknown forbidden item", "{ charEncoding: 'UTF-8', forbiddenElements: ['unsupported'] }", /unsupported elements: unsupported/],
  ["later invalid duplicate wins", "{ charEncoding: 'UTF-8', mode: 'run', 'mode': 'invalid' }", /mode must be 'run' or 'test'/],
  ["template forbidden item", "{ charEncoding: 'UTF-8', forbiddenElements: [`NOPE`] }", /unsupported elements: NOPE/],
] as const) cases.push({ name, text: setupState(config), findings: ["dcouplr/DCP-SETUP-001:deny"], error, coverage: "checked" });
for (const [name, config] of [
  ["absent encoding breaches the public contract despite runtime tolerance", "{}"],
  ["undefined encoding breaches the public contract despite runtime tolerance", "{ charEncoding: undefined }"],
  ["unknown setup key is silently ignored", "{ modde: 'test' }"],
] as const) cases.push({ name, text: setupState(config), findings: ["dcouplr/DCP-SETUP-001:deny"],
  result: { mode: "run", encoding: undefined, ephemeral: undefined }, coverage: "checked" });
cases.push({ name: "spread configuration remains a visible static gap", text: setupState("{ ...{ charEncoding: 'UTF-8', mode: 'invalid' } }"),
  findings: [], error: /mode must be 'run' or 'test'/, coverage: "runtime-only" });
cases.push({ name: "escaped invalid mode remains a visible static gap", text: setupState("{ charEncoding: 'UTF-8', mode: 'pr\\x6fd' }"),
  findings: [], error: /mode must be 'run' or 'test'/, coverage: "runtime-only" });
for (const name of ["charEncoding", "mode", "ephemeral", "forbiddenElements", "instanceId"]) {
  for (const accessor of ["kernel.settings.setSetting", "kernel['settings']['setSetting']"]) {
    cases.push({ name: `system setting ${name} rejects mutation via ${accessor}`, text: boot()
      + factory(`(input, kernel) => { ${accessor}('${name}', 'replacement'); return true; }`) + ".register();\n" + resolveOrder,
      findings: ["dcouplr/DCP-SETTINGS-001:deny"], error: /System settings can be bootstrapped.*not overwritten/, coverage: "checked" });
  }
}
cases.push({ name: "application runtime settings remain writable", text: boot()
  + factory("(input, kernel) => { kernel.settings.setSetting('feature', true); return kernel.settings.getSetting('feature'); }") + ".register();\n" + resolveOrder,
  findings: [], result: true, coverage: "valid" });
cases.push({ name: "second setup is ignored rather than reconfiguring the singleton", text: setupState("{ charEncoding: 'UTF-8', mode: 'run', ephemeral: true }")
  .replace("const app = getDcouplr();", "setupDcouplr({ charEncoding: 'ASCII', mode: 'test', ephemeral: false });\nconst app = getDcouplr();"),
  findings: [], result: { mode: "run", encoding: "UTF-8", ephemeral: true }, coverage: "runtime-only" });

const systemFactories = [
  ["Logger", "LOGGER", "resolve", "{ child() { return this; }, isLevelEnabled: () => false, trace() {}, debug() {}, info() {}, warn() {}, error() {}, fatal() {} }"],
  ["EventBus", "EVENT_BUS", "resolveSingleton", "{ subscribe() {}, unsubscribe() {}, emit() {}, emitBlocking: async () => {} }"],
  ["MessageBus", "MESSAGE_BUS", "resolveSingleton", "{ subscribe() {}, unsubscribe() {}, emit() {}, emitBlocking: async () => {} }"],
  ["DCast", "DCAST", "resolveSingleton", "input => input"],
  ["IQueue", "I_QUEUE", "resolve", "{ size: 0, isEmpty: true, enqueue: async () => true, dequeue: async () => undefined, peek: async () => undefined, flush() {}, stream: function* () {}, recover: async () => 0 }"],
  ["IQueuePersistence", "I_QUEUE_PERSISTENCE", "resolveSingleton", "{ claimRecovery: async () => ({ acquired: false }), remove: async () => {}, append: async () => {}, delete: async () => {}, appendBatch: async () => {}, deleteUpTo: async () => {} }"],
  ["MessageBrokerAdapter", "I_MESSAGE_BROKER_ADAPTER", "resolveSingleton", "{ send: async () => {} }"],
  ["EventBrokerAdapter", "I_EVENT_BROKER_ADAPTER", "resolveSingleton", "{ raise: async () => {} }"],
] as const;
const systemSetup = (overrides: string) => `import { setupDcouplr, getDcouplr } from 'dcouplr';
setupDcouplr({charEncoding: 'UTF-8', systemDependencies: ${overrides}});
const app = getDcouplr();\n`;
for (const [key, identifier, resolver, output] of systemFactories) {
  const lookup = `app.${resolver}('${identifier}'${key === "IQueue" ? ", {queueId: 'probe', segmentCapacity: 2, maxSegments: 2, persistence: {enabled: false, mode: 'leading', aotMs: 1, maxPendingOps: 2}}" : ""})`;
  cases.push({ name: `public ${key} override preserves a custom factory identifier`,
    text: systemSetup(`{${key}: {__semanticIdentifier: 'CUSTOM', create: () => (${output})}}`)
      + `export const result = typeof ${lookup};`, findings: [], result: key === "DCast" ? "function" : "object", coverage: "valid" });
  cases.push({ name: `${key} override without create rejects actual resolution`,
    text: systemSetup(`{${key}: {__semanticIdentifier: 'CUSTOM'}}`) + `${lookup};`,
    findings: ["dcouplr/DCP-SETUP-001:deny"], error: /factory\.create is not a function/, coverage: "checked" });
  cases.push({ name: `${key} false override is ignored by runtime but violates the public type`,
    text: setupState(`{charEncoding: 'UTF-8', systemDependencies: {${key}: false}}`),
    findings: ["dcouplr/DCP-SETUP-001:deny"], result: { mode: "run", encoding: "UTF-8", ephemeral: undefined }, coverage: "checked" });
  cases.push({ name: `${key} optional undefined override remains valid`,
    text: setupState(`{charEncoding: 'UTF-8', systemDependencies: {${key}: undefined}}`),
    findings: [], result: { mode: "run", encoding: "UTF-8", ephemeral: undefined }, coverage: "valid" });
}
for (const [name, overrides, error] of [
  ["numeric system factory", "{EventBrokerAdapter: 1}", /factory\.create is not a function/],
  ["noncallable system factory create", "{EventBrokerAdapter: {__semanticIdentifier: 'CUSTOM', create: false}}", /factory\.create is not a function/],
  ["async system factory create", "{EventBrokerAdapter: {__semanticIdentifier: 'CUSTOM', create: async () => ({raise: async () => {}})}}", /IEventBrokerAdapter contract breach/],
  ["generator system factory create", "{EventBrokerAdapter: {__semanticIdentifier: 'CUSTOM', create: function* () { yield {raise: async () => {}}; }}}", /IEventBrokerAdapter contract breach/],
  ["wrapped async system factory create", "{EventBrokerAdapter: ({__semanticIdentifier: 'CUSTOM', create: (async () => ({raise: async () => {}}))})}", /IEventBrokerAdapter contract breach/],
] as const) cases.push({ name, text: systemSetup(overrides), findings: ["dcouplr/DCP-SETUP-001:deny"], error, coverage: "checked" });
for (const [name, overrides] of [
  ["misspelled system factory is silently ignored", "{Loger: {__semanticIdentifier: 'CUSTOM', create: () => ({})}}"],
  ["unsupported kernel override is silently ignored", "{Kernel: {__semanticIdentifier: 'DKERNEL', create: () => ({})}}"],
  ["missing system factory identifier is tolerated only by runtime", "{EventBrokerAdapter: {create: () => ({raise: async () => {}})}}"],
] as const) cases.push({ name, text: setupState(`{charEncoding: 'UTF-8', systemDependencies: ${overrides}}`),
  findings: ["dcouplr/DCP-SETUP-001:deny"], result: { mode: "run", encoding: "UTF-8", ephemeral: undefined }, coverage: "checked" });
cases.push({ name: "static class factory satisfies the public structural contract", text: systemSetup("{EventBrokerAdapter: class { static __semanticIdentifier = 'CUSTOM'; static create() { return {raise: async () => {}}; } }}")
  + "export const result = typeof app.resolveSingleton('I_EVENT_BROKER_ADAPTER').raise;", findings: [], result: "function", coverage: "valid" });
cases.push({ name: "later system factory key wins across quote forms", text: systemSetup("{EventBrokerAdapter: false, 'EventBrokerAdapter': {__semanticIdentifier: 'CUSTOM', create: () => ({raise: async () => {}})}}")
  + "export const result = typeof app.resolveSingleton('I_EVENT_BROKER_ADAPTER').raise;", findings: [], result: "function", coverage: "valid" });
cases.push({ name: "spread system factory remains a visible verification gap", text: systemSetup("{EventBrokerAdapter: {...{__semanticIdentifier: 'CUSTOM', create: false}}}"),
  findings: [], error: /factory\.create is not a function/, coverage: "runtime-only" });

const admissionMethods = ["declareIntent", "addMandatoryInputFields", "addValidationPolicy", "addVerificationPolicy", "addFactoryMethod",
  "createOnly", "register", "registerSingleton", "registerForce", "registerSingletonForce",
  "raisesEvents", "sendsMessages", "usesDependencies", "reactsTo", "withExtendedInfo"];
const registrationMetadata = admissionMethods.slice(10);
const methodArguments = (name: string) => name === "declareIntent" ? "'NEXT'" : name === "addFactoryMethod" ? "() => ({ ready: true })"
  : name === "addMandatoryInputFields" || name === "registerSingleton" || name === "registerSingletonForce" ? "{}"
  : name === "withExtendedInfo" ? "{ label: 'Order' }" : registrationMetadata.includes(name) ? "[]" : "";
const stages = ["app.dependencyAdmission.declareIntent('ORDER')"];
for (const method of admissionMethods.slice(1, 5)) stages.push(`${stages.at(-1)}.${method}(${methodArguments(method)})`);
const readyFactory = stages.at(-1)!;
for (const method of admissionMethods.slice(5, 10)) stages.push(`${readyFactory}.${method}(${methodArguments(method)})`);
for (const method of registrationMetadata) stages.push(`${readyFactory}.register().${method}(${methodArguments(method)})`);
for (const [index, stage] of stages.entries()) {
  const allowed = index < 4 ? [admissionMethods[index + 1]!] : index === 4 ? admissionMethods.slice(5, 10)
    : index === 5 ? [] : registrationMetadata;
  const path = "src/bootstrap/sequence.test.ts";
  cases.push({ name: `actual admission stage capabilities after ${admissionMethods[index]}`, path,
    text: boot("test") + `const stage = ${stage};\nexport const result = Object.keys(stage).filter(name => ${JSON.stringify(admissionMethods)}.includes(name)).sort();`,
    findings: [], result: [...allowed].sort(), coverage: "valid" });
  for (const next of admissionMethods) {
    const valid = allowed.includes(next);
    cases.push({ name: `actual admission transition ${admissionMethods[index]} -> ${next}`, path,
      text: boot("test") + `${stage}.${next}(${methodArguments(next)});\nexport const result = true;`,
      findings: valid ? [] : ["dcouplr/DCP-FACTORY-SEQUENCE-001:deny"],
      ...(valid ? { result: true } : { error: /is not a function/ }), coverage: valid ? "valid" : "checked" });
  }
}

for (const creator of ["", "null", "'creator'"]) {
  cases.push({ name: `noncallable admission creator: ${creator || "missing"}`,
    text: boot() + factory(creator) + ".createOnly();",
    findings: ["dcouplr/DCP-FACTORY-CALLABLE-001:deny"], error: /dFactory must be a function/, coverage: "checked" });
}
for (const policy of ["false", "null", "{}"])
  cases.push({ name: `noncallable validation policy: ${policy}`,
    text: boot() + factory("() => ({ ready: true })").replace("addValidationPolicy()", `addValidationPolicy(${policy})`) + ".createOnly();",
    findings: ["dcouplr/DCP-FACTORY-CALLABLE-001:deny"], error: /validationPolicy must be a function/, coverage: "checked" });
cases.push({ name: "default validation and omitted verification remain valid",
  text: boot() + factory("() => ({ ready: true })") + ".register();\n" + resolveOrder,
  findings: [], result: { ready: true }, coverage: "valid" });
cases.push({ name: "explicit undefined validation and void verification retain defaults",
  text: boot() + factory("() => ({ ready: true })").replace("addValidationPolicy()", "addValidationPolicy(undefined)")
    .replace("addVerificationPolicy()", "addVerificationPolicy(void 0)") + ".register();\n" + resolveOrder,
  findings: [], result: { ready: true }, coverage: "valid" });
cases.push({ name: "callable validation may correctly reject creation input",
  text: boot() + factory("() => ({ ready: true })").replace("addValidationPolicy()", "addValidationPolicy(() => false)")
    + ".register();\n" + resolveOrder,
  findings: [], error: /validation function provided returned false/, coverage: "valid" });
cases.push({ name: "null verification is runtime-tolerated but outside the public typed contract",
  text: boot() + factory("() => ({ ready: true })").replace("addVerificationPolicy()", "addVerificationPolicy(null)")
    + ".register();\n" + resolveOrder,
  findings: ["dcouplr/DCP-FACTORY-CALLABLE-001:deny"], result: { ready: true }, coverage: "checked" });
cases.push({ name: "noncallable verification remains admitted until resolution",
  text: boot() + factory("() => ({ ready: true })").replace("addVerificationPolicy()", "addVerificationPolicy(false)")
    + ".register();\nlet failure; try { app.resolve('ORDER'); } catch (error) { failure = error.message; }\n"
    + "export const result = { admitted: app.listUserDependencies().some(info => info.semanticIdentifier === 'ORDER'), failed: typeof failure === 'string' };",
  findings: ["dcouplr/DCP-FACTORY-CALLABLE-001:deny"], result: { admitted: true, failed: true }, coverage: "checked" });
cases.push({ name: "callable verification may correctly reject a created value",
  text: boot() + factory("() => ({ ready: true })").replace("addVerificationPolicy()", "addVerificationPolicy(() => { throw new Error('not verified'); })")
    + ".register();\n" + resolveOrder,
  findings: [], error: /not verified/, coverage: "valid" });

for (const [name, policy] of [
  ["async", "async () => true"], ["generator", "function* () { yield true; }"],
  ["async generator", "async function* () { yield true; }"],
]) cases.push({ name: `${name} validation cannot satisfy synchronous creation`,
  text: boot() + factory("() => ({ ready: true })").replace("addValidationPolicy()", `addValidationPolicy(${policy})`)
    + ".register();\n" + resolveOrder,
  findings: ["dcouplr/DCP-FACTORY-SYNC-001:deny"], error: /validation function provided returned false/, coverage: "checked" });
cases.push({ name: "async verification finishes after the created value escapes",
  text: boot() + "let verified = false;\n" + factory("() => ({ ready: true })")
    .replace("addVerificationPolicy()", "addVerificationPolicy(async () => { await Promise.resolve(); verified = true; })")
    + ".register();\nconst created = app.resolve('ORDER'); const verifiedBeforeReturn = verified;\nawait Promise.resolve();\n"
    + "export const result = { ready: created.ready, verifiedBeforeReturn, verifiedAfterYield: verified };",
  findings: ["dcouplr/DCP-FACTORY-SYNC-001:deny"], result: { ready: true, verifiedBeforeReturn: false, verifiedAfterYield: true }, coverage: "checked" });
for (const policy of ["function* () { verified = true; }", "async function* () { verified = true; }"])
  cases.push({ name: `${policy.startsWith("async") ? "async " : ""}generator verification never executes its body`,
    text: boot() + "let verified = false;\n" + factory("() => ({ ready: true })")
      .replace("addVerificationPolicy()", `addVerificationPolicy(${policy})`)
      + ".register();\nconst created = app.resolve('ORDER'); export const result = { ready: created.ready, verified };",
    findings: ["dcouplr/DCP-FACTORY-SYNC-001:deny"], result: { ready: true, verified: false }, coverage: "checked" });
cases.push({ name: "synchronous verification finishes before resolution returns",
  text: boot() + "let verified = false;\n" + factory("() => ({ ready: true })")
    .replace("addVerificationPolicy()", "addVerificationPolicy(() => { verified = true; })")
    + ".register();\nconst created = app.resolve('ORDER'); export const result = { ready: created.ready, verified };",
  findings: [], result: { ready: true, verified: true }, coverage: "valid" });

for (const [form, declaration] of [
  ["const arrow", "const check = async () => true;"],
  ["const function", "const check = async function () { return true; };"],
  ["declared", "async function check() { return true; }"],
  ["exported declared", "export async function check() { return true; }"],
  ["const generator", "const check = function* () { yield true; };"],
  ["declared generator", "function* check() { yield true; }"],
  ["declared async generator", "async function* check() { yield true; }"],
  ["exported const", "export const check = async () => true;"],
] as const) cases.push({ name: `${form} validation cannot satisfy synchronous creation`,
  text: boot() + declaration + "\n" + factory("() => ({ ready: true })")
    .replace("addValidationPolicy()", "addValidationPolicy(check)") + ".register();\n" + resolveOrder,
  findings: ["dcouplr/DCP-FACTORY-SYNC-001:deny"], error: /validation function provided returned false/, coverage: "checked" });
for (const [form, declaration, yields] of [
  ["const arrow", "const check = async () => { await Promise.resolve(); verified = true; };", true],
  ["const function", "const check = async function () { await Promise.resolve(); verified = true; };", true],
  ["declared", "async function check() { await Promise.resolve(); verified = true; }", true],
  ["exported declared", "export async function check() { await Promise.resolve(); verified = true; }", true],
  ["const generator", "const check = function* () { verified = true; };", false],
  ["declared generator", "function* check() { verified = true; }", false],
  ["declared async generator", "async function* check() { verified = true; }", false],
  ["exported const", "export const check = async () => { await Promise.resolve(); verified = true; };", true],
] as const) cases.push({ name: `${form} verification does not finish before the created value escapes`,
  text: boot() + "let verified = false;\n" + declaration + "\n" + factory("() => ({ ready: true })")
    .replace("addVerificationPolicy()", "addVerificationPolicy(check)") + ".register();\n"
    + "const created = app.resolve('ORDER'); const verifiedBeforeReturn = verified; await Promise.resolve();\n"
    + "export const result = { ready: created.ready, verifiedBeforeReturn, verifiedAfterYield: verified };",
  findings: ["dcouplr/DCP-FACTORY-SYNC-001:deny"],
  result: { ready: true, verifiedBeforeReturn: false, verifiedAfterYield: yields }, coverage: "checked" });
for (const [form, declaration] of [
  ["const arrow", "const check = () => ({ valid: 'false' });"],
  ["declared", "function check() { return { valid: 1 }; }"],
  ["exported const", "export const check = () => ({ valid: 1 });"],
] as const) cases.push({ name: `${form} malformed validation can silently admit a created value`,
  text: boot() + declaration + "\n" + factory("() => ({ ready: true })")
    .replace("addValidationPolicy()", "addValidationPolicy(check)") + ".register();\n" + resolveOrder,
  findings: ["dcouplr/DCP-FACTORY-VALIDATION-001:deny"], result: { ready: true }, coverage: "checked" });
cases.push({ name: "hoisted named validation finishes before creation",
  text: boot() + factory("() => ({ ready: true })").replace("addValidationPolicy()", "addValidationPolicy(check)")
    + ".register();\nfunction check() { return true; }\n" + resolveOrder,
  findings: [], result: { ready: true }, coverage: "valid" });
cases.push({ name: "named verification finishes before resolution returns",
  text: boot() + "let verified = false; function check() { verified = true; }\n" + factory("() => ({ ready: true })")
    .replace("addVerificationPolicy()", "addVerificationPolicy(check)")
    + ".register();\nconst created = app.resolve('ORDER'); export const result = { ready: created.ready, verified };",
  findings: [], result: { ready: true, verified: true }, coverage: "valid" });
cases.push({ name: "replaced named validator keeps its actual synchronous behavior",
  text: boot() + "async function check() { return true; } check = () => true;\n" + factory("() => ({ ready: true })")
    .replace("addValidationPolicy()", "addValidationPolicy(check)") + ".register();\n" + resolveOrder,
  findings: [], result: { ready: true }, coverage: "valid" });
cases.push({ name: "aliased async verification returns before its callback finishes",
  text: boot() + "let verified = false; const check = async () => { await Promise.resolve(); verified = true; }; const alias = check;\n"
    + factory("() => ({ ready: true })").replace("addVerificationPolicy()", "addVerificationPolicy(alias)")
    + ".register();\nconst created = app.resolve('ORDER'); export const result = { ready: created.ready, verified };",
  findings: ["dcouplr/DCP-FACTORY-SYNC-001:deny"], result: { ready: true, verified: false }, coverage: "checked" });
for (const [form, declaration] of [
  ["const", "const check = async () => true;"],
  ["declared", "async function check() { return true; }"],
  ["generator", "function* check() { yield true; }"],
  ["exported", "export const check = async () => true;"],
] as const) cases.push({ name: `${form} aliased validation cannot satisfy synchronous creation`,
  text: boot() + declaration + " const alias = check;\n" + factory("() => ({ ready: true })")
    .replace("addValidationPolicy()", "addValidationPolicy(alias)") + ".register();\n" + resolveOrder,
  findings: ["dcouplr/DCP-FACTORY-SYNC-001:deny"], error: /validation function provided returned false/, coverage: "checked" });
for (const [form, declaration] of [
  ["const", "const check = () => ({ valid: 'false' });"],
  ["declared", "function check() { return { valid: 1 }; }"],
] as const) cases.push({ name: `${form} aliased malformed validation silently admits creation`,
  text: boot() + declaration + " const alias = check;\n" + factory("() => ({ ready: true })")
    .replace("addValidationPolicy()", "addValidationPolicy(alias)") + ".register();\n" + resolveOrder,
  findings: ["dcouplr/DCP-FACTORY-VALIDATION-001:deny"], result: { ready: true }, coverage: "checked" });
cases.push({ name: "aliased synchronous verification finishes before resolution returns",
  text: boot() + "let verified = false; function check() { verified = true; } const alias = check;\n"
    + factory("() => ({ ready: true })").replace("addVerificationPolicy()", "addVerificationPolicy(alias)")
    + ".register();\nconst created = app.resolve('ORDER'); export const result = { ready: created.ready, verified };",
  findings: [], result: { ready: true, verified: true }, coverage: "valid" });
cases.push({ name: "multiple immutable aliases remain an explicit source-coverage gap",
  text: boot() + "let verified = false; const check = async () => { await Promise.resolve(); verified = true; }; const alias = check; const second = alias;\n"
    + factory("() => ({ ready: true })").replace("addVerificationPolicy()", "addVerificationPolicy(second)")
    + ".register();\nconst created = app.resolve('ORDER'); export const result = { ready: created.ready, verified };",
  findings: [], result: { ready: true, verified: false }, coverage: "runtime-only" });
cases.push({ name: "trailing spread cannot replace the first async validator",
  text: boot() + factory("() => ({ ready: true })").replace("addValidationPolicy()", "addValidationPolicy(async () => true, ...[])")
    + ".register();\n" + resolveOrder,
  findings: ["dcouplr/DCP-FACTORY-SYNC-001:deny"], error: /validation function provided returned false/, coverage: "checked" });
cases.push({ name: "trailing spread cannot hide a malformed first validation result",
  text: boot() + factory("() => ({ ready: true })").replace("addValidationPolicy()", "addValidationPolicy(() => ({ valid: 'false' }), ...[])")
    + ".register();\n" + resolveOrder,
  findings: ["dcouplr/DCP-FACTORY-VALIDATION-001:deny"], result: { ready: true }, coverage: "checked" });
for (const value of ["0", "1", "'true'", "[]", "{}", "{ msg: 'missing valid' }", "{ valid: 0 }"])
  cases.push({ name: `malformed validation result rejects creation: ${value}`,
    text: boot() + factory("() => ({ ready: true })").replace("addValidationPolicy()", `addValidationPolicy(() => (${value}))`)
      + ".register();\n" + resolveOrder,
    findings: ["dcouplr/DCP-FACTORY-VALIDATION-001:deny"], error: /validation function provided returned false/, coverage: "checked" });
for (const policy of ["() => null", "() => void 0", "() => {}", "() => { return; }"])
  cases.push({ name: `nullish validation result fails at synchronous lookup: ${policy}`,
    text: boot() + factory("() => ({ ready: true })").replace("addValidationPolicy()", `addValidationPolicy(${policy})`)
      + ".register();\n" + resolveOrder,
    findings: ["dcouplr/DCP-FACTORY-VALIDATION-001:deny"], error: /null|undefined|validation/, coverage: "checked" });
for (const value of ["{ valid: 1 }", "{ valid: 'false' }", "{ valid: {} }", "{ valid: [], msg: 'not boolean' }",
  "{ valid: true, msg: 1 }", "{ valid: true, msg: null }", "{ valid: true, 'valid': 'false' }"])
  cases.push({ name: `malformed typed validation result is runtime-permissive: ${value}`,
    text: boot() + factory("() => ({ ready: true })").replace("addValidationPolicy()", `addValidationPolicy(() => (${value}))`)
      + ".register();\n" + resolveOrder,
    findings: ["dcouplr/DCP-FACTORY-VALIDATION-001:deny"], result: { ready: true }, coverage: "checked" });
for (const [name, policy] of [
  ["last boolean result field wins", "() => ({ valid: 1, 'valid': true })"],
  ["last message field wins", "() => ({ valid: true, msg: 1, 'msg': 'fixed' })"],
  ["optional undefined message", "() => ({ valid: true, msg: void 0 })"],
  ["nested helper return belongs to the helper", "() => { function helper() { return 1; } return true; }"],
  ["callable class with a static valid field is not a malformed known result", "() => class Result { static valid = true; }"],
] as const) cases.push({ name, text: boot() + factory("() => ({ ready: true })").replace("addValidationPolicy()", `addValidationPolicy(${policy})`)
  + ".register();\n" + resolveOrder, findings: [], result: { ready: true }, coverage: "valid" });

for (const input of ["null", "7", "'input'", "() => ({})"])
  cases.push({ name: `nonobject fluent singleton input: ${input}`,
    text: boot() + factory("() => ({ ready: true })") + `.registerSingleton(${input});`,
    findings: ["dcouplr/DCP-FACTORY-SINGLETON-001:deny"], error: /singletonParams must be an object/, coverage: "checked" });
for (const input of ["", "void 0", "{}", "[]", "/input/"])
  cases.push({ name: `valid fluent singleton input: ${input || "omitted"}`,
    text: boot() + factory("() => ({ ready: true })") + `.registerSingleton(${input});\nexport const result = app.resolveSingleton('ORDER');`,
    findings: [], result: { ready: true }, coverage: "valid" });
cases.push({ name: "named singleton stage remains outside direct fluent ownership coverage",
  text: boot() + "const stage = " + factory("() => ({ ready: true })") + ";\nstage.registerSingleton(null);",
  findings: [], error: /singletonParams must be an object/, coverage: "runtime-only" });

for (const mode of ["run", "test"]) {
  const singleton = `${boot(mode)}${factory("input => ({ id: input.id })")}.registerSingleton({ id: 'original' });
const original = app.resolveSingleton('ORDER');
${factory("input => ({ id: input.id })")}.registerSingletonForce({ id: 'replacement' });
const replacement = app.resolveSingleton('ORDER');
export const result = { original: original.id, replacement: replacement.id, distinct: original !== replacement };`;
  const transient = `${boot(mode)}${factory("() => ({ id: 'original' })")}.register();
${factory("() => ({ id: 'replacement' })")}.registerForce();
export const result = app.resolve('ORDER');`;
  for (const [name, text, result] of [
    ["transient", transient, { id: "replacement" }],
    ["singleton", singleton, { original: "original", replacement: "replacement", distinct: true }],
  ] as const) cases.push({ name: `${name} force registration in ${mode}`, text,
    path: mode === "test" ? "src/order.test.ts" : undefined,
    findings: mode === "test" ? [] : ["dcouplr/DCP-FORCE-001:deny"],
    ...(mode === "test" ? { result } : { error: /only allowed.*mode: 'test'/ }),
    coverage: mode === "test" ? "valid" : "checked" });
}

const kernelProbe = `app.dependencyAdmission.declareIntent('BOOTSTRAP_KERNEL_PROBE')
.addMandatoryInputFields({}).addValidationPolicy().addVerificationPolicy()
.addFactoryMethod((_input, kernel) => kernel).register();
const bootstrapKernel = app.resolve('BOOTSTRAP_KERNEL_PROBE');\n`;
const kernelFactory = (key = "'DKERNEL'") => `app.dependencyAdmission.declareIntent(${key})
.addMandatoryInputFields({}).addValidationPolicy().addVerificationPolicy()
.addFactoryMethod((_input, kernel) => ({ marker: 'replacement', kernel }))`;
for (const method of ["register", "registerSingleton", "registerForce", "registerSingletonForce"]) {
  const force = method.endsWith("Force");
  const singleton = method.includes("Singleton");
  const text = boot(force ? "test" : "run") + kernelProbe + kernelFactory() + `.${method}();\n`;
  cases.push({ name: `bootstrap kernel public ${method}`, text: method === "register" ? text
    : text + `const value = app.${singleton ? "resolveSingleton" : "resolve"}('DKERNEL');
export const result = { marker: value.marker, distinct: value !== bootstrapKernel,
  originalInjected: value.kernel === bootstrapKernel, originalRetained: app.resolve('BOOTSTRAP_KERNEL_PROBE') === bootstrapKernel };`,
    path: force ? "src/bootstrap/kernel.test.ts" : undefined,
    findings: ["dcouplr/DCP-KERNEL-001:deny"], warnings: [/bootstrap-owned runtime infrastructure/],
    ...(method === "register" ? { error: /Duplicated semanticIdentifier/ }
      : { result: { marker: "replacement", distinct: true, originalInjected: true, originalRetained: true } }),
    coverage: "checked" });
  if (force) cases.push({ name: `kernel ${method} outside test mode`, text: boot() + kernelFactory() + `.${method}();`,
    findings: ["dcouplr/DCP-FORCE-001:deny", "dcouplr/DCP-KERNEL-001:deny"],
    error: /only allowed.*mode: 'test'/, warnings: [], coverage: "checked" });
}
for (const key of ["system.DependencyKeys.Kernel", "system['DependencyKeys'][`Kernel`]"]) {
  cases.push({ name: `kernel ownership through public key ${key}`,
    text: "import { system } from 'dcouplr';\n" + boot() + kernelFactory(key) + ".registerSingleton();\nexport const result = app.resolveSingleton('DKERNEL').marker;",
    findings: ["dcouplr/DCP-KERNEL-001:deny"], warnings: [/bootstrap-owned runtime infrastructure/],
    result: "replacement", coverage: "checked" });
}
cases.push({ name: "a kernel-named createOnly factory is not public registration",
  text: boot() + `const created = ${kernelFactory()}.createOnly();\nexport const result = created.__semanticIdentifier;`,
  findings: [], warnings: [], result: "DKERNEL", coverage: "valid" });
cases.push({ name: "nested kernel factory declaration does not change outer ownership",
  text: boot() + factory(`() => { const created = ${kernelFactory()}.createOnly(); return { name: created.__semanticIdentifier }; }`)
    + ".register();\n" + resolveOrder,
  findings: [], warnings: [], result: { name: "DKERNEL" }, coverage: "valid" });

const queueConfig = { queueId: "orders", segmentCapacity: 1, maxSegments: 1,
  persistence: { enabled: false, mode: "lagging", aotMs: 10, maxPendingOps: 2 } };
cases.push({ name: "queue capacity rejects the second enqueue", text: boot() + `const queue = app.resolve('I_QUEUE', ${JSON.stringify(queueConfig)});
export const result = { first: await queue.enqueue('first'), second: await queue.enqueue('second'), size: queue.size, firstValue: await queue.dequeue() };`,
  findings: [], result: { first: true, second: false, size: 1, firstValue: "first" }, coverage: "valid" });
for (const [field, value] of [["segmentCapacity", 0], ["maxSegments", 1.5], ["aotMs", -1], ["maxPendingOps", 0]] as const) {
  const config = structuredClone(queueConfig);
  if (field === "segmentCapacity" || field === "maxSegments") config[field] = value;
  else config.persistence[field] = value;
  cases.push({ name: `invalid queue ${field}`,
    text: boot() + `export const result = app.resolve('I_QUEUE', ${JSON.stringify(config)});`,
    findings: ["dcouplr/DCP-QUEUE-NUM-001:deny"], error: new RegExp(`${field} as a positive integer`), coverage: "checked" });
}
cases.push({ name: "later literal overrides an invalid queue value", text: boot() + `const queue = app.resolve('I_QUEUE', ${JSON.stringify(queueConfig).replace('"segmentCapacity":1', '"segmentCapacity":0,"segmentCapacity":1')});
export const result = await queue.enqueue('order');`, findings: [], result: true, coverage: "valid" });
cases.push({ name: "invalid scientific queue value (not yet statically checked)",
  text: boot() + `export const result = app.resolve('I_QUEUE', ${JSON.stringify(queueConfig).replace('"segmentCapacity":1', '"segmentCapacity":1e-1')});`,
  findings: [], error: /segmentCapacity as a positive integer/, coverage: "runtime-only" });
cases.push({ name: "missing queue persistence",
  text: boot() + "export const result = app.resolve('I_QUEUE', { queueId: 'orders', segmentCapacity: 1, maxSegments: 1 });",
  findings: ["dcouplr/DCP-QUEUE-SHAPE-001:deny"], error: /persistence/, coverage: "checked" });
for (const field of ["queueId", "segmentCapacity", "maxSegments", "enabled", "mode", "aotMs", "maxPendingOps"]) {
  const config = structuredClone(queueConfig) as Record<string, unknown>;
  const target = ["queueId", "segmentCapacity", "maxSegments"].includes(field) ? config : config.persistence as Record<string, unknown>;
  delete target[field];
  cases.push({ name: `missing queue field ${field}`, text: boot() + `export const result = app.resolve('I_QUEUE', ${JSON.stringify(config)});`,
    findings: ["dcouplr/DCP-QUEUE-SHAPE-001:deny"], error: new RegExp(field), coverage: "checked" });
}
for (const [field, value] of [["queueId", 1], ["segmentCapacity", "1"], ["maxSegments", true], ["persistence", false],
  ["enabled", "invalid"], ["aotMs", "10"], ["maxPendingOps", null]] as const) {
  const config = structuredClone(queueConfig) as Record<string, unknown>;
  const target = ["queueId", "segmentCapacity", "maxSegments", "persistence"].includes(field) ? config : config.persistence as Record<string, unknown>;
  target[field] = value;
  cases.push({ name: `wrong queue field type ${field}`, text: boot() + `export const result = app.resolve('I_QUEUE', ${JSON.stringify(config)});`,
    findings: ["dcouplr/DCP-QUEUE-SHAPE-001:deny"], error: new RegExp(field), coverage: "checked" });
}
for (const dto of [null, [], "orders"]) cases.push({ name: `wrong queue DTO ${JSON.stringify(dto)}`,
  text: boot() + `export const result = app.resolve('I_QUEUE', ${JSON.stringify(dto)});`,
  findings: ["dcouplr/DCP-QUEUE-SHAPE-001:deny"], error: /inputDto|mandatory|queueId/i, coverage: "checked" });
cases.push({ name: "missing queue DTO", text: boot() + "export const result = app.resolve('I_QUEUE');",
  findings: ["dcouplr/DCP-QUEUE-SHAPE-001:deny"], error: /inputDto|mandatory|queueId/i, coverage: "checked" });
cases.push({ name: "empty queue ID", text: boot() + `export const result = app.resolve('I_QUEUE', ${JSON.stringify({ ...queueConfig, queueId: "  " })});`,
  findings: ["dcouplr/DCP-QUEUE-SHAPE-001:deny"], error: /queueId/, coverage: "checked" });
for (const [name, dto] of [
  ["final ID overrides an empty ID", JSON.stringify(queueConfig).replace('"queueId":"orders"', '"queueId":"","queueId":"orders"')],
  ["final enabled flag overrides an invalid type", JSON.stringify(queueConfig).replace('"enabled":false', '"enabled":"false","enabled":false')],
  ["computed ID is unresolved statically", JSON.stringify(queueConfig).replace('"queueId":"orders"', '"queueId":"",["queueId"]:"orders"')],
  ["escaped ID is unresolved statically", JSON.stringify(queueConfig).replace('"queueId":"orders"', '"queueId":"","queue\\u0049d":"orders"')],
  ["getter ID is unresolved statically", JSON.stringify(queueConfig).replace('"queueId":"orders"', '"queueId":"",get queueId(){ return "orders"; }')],
] as const) cases.push({ name, text: boot() + `const queue = app.resolve('I_QUEUE', ${dto});\nexport const result = await queue.enqueue('order');`,
  findings: [], result: true, coverage: "valid" });
for (const [name, value] of [
  ["runtime tolerates a boolean-like string enabled flag", { enabled: "false" }],
  ["runtime tolerates a boolean mode", { mode: false }],
  ["runtime tolerates an unknown mode string", { mode: "custom" }],
] as const) cases.push({ name,
  text: boot() + `const queue = app.resolve('I_QUEUE', ${JSON.stringify({ ...queueConfig, persistence: { ...queueConfig.persistence, ...value } })});\nexport const result = await queue.enqueue('order');`,
  findings: ["dcouplr/DCP-QUEUE-SHAPE-001:deny"], result: true, coverage: "checked" });
const queueRepository = `let appends = 0;
const repository = { claimRecovery: async () => ({ acquired: true }), remove: async () => {},
  append: async () => { appends++; }, delete: async () => {}, appendBatch: async () => {}, deleteUpTo: async () => {} };\n`;
cases.push({ name: "inherited persistence fields are unresolved statically",
  text: boot() + `const queue = app.resolve('I_QUEUE', ${JSON.stringify(queueConfig).replace(JSON.stringify(queueConfig.persistence), `{ __proto__: ${JSON.stringify(queueConfig.persistence)} }`)});\nexport const result = await queue.enqueue('order');`,
  findings: [], result: true, coverage: "valid" });
for (const [name, enabled, mode, appends, invalid] of [
  ["boolean false keeps persistence disabled", false, "leading", 0, false],
  ["string false unexpectedly enables persistence", "false", "leading", 1, true],
  ["boolean true and leading mode persist before enqueue returns", true, "leading", 1, false],
  ["unknown mode silently skips persistence", true, "custom", 0, true],
] as const) {
  const dto = JSON.stringify({ ...queueConfig, persistence: { ...queueConfig.persistence, enabled, mode } }).slice(0, -1) + ", repository }";
  cases.push({ name, text: boot() + queueRepository + `const queue = app.resolve('I_QUEUE', ${dto});\nconst enqueued = await queue.enqueue('order');\nexport const result = { enqueued, appends };`,
    findings: invalid ? ["dcouplr/DCP-QUEUE-SHAPE-001:deny"] : [], result: { enqueued: true, appends }, coverage: invalid ? "checked" : "valid" });
}

const subscriptionBoot = boot() + factory("(_input, kernel) => kernel")
  + ".register();\nconst kernel = app.resolve('ORDER');\n";
const eventListener = "let delivered = 0; const listener = async event => { delivered++; };\n";
const messageHandler = "let delivered = 0; const handler = async message => { delivered++; };\n";
const raiseOrder = "await kernel.event.raiseLocalBlocking({ eventType: 'ORDER', payload: {} });\n";
const sendOrder = "await kernel.message.sendLocalBlocking('ORDER', {}, 'orders');\n";

cases.push({ name: "event listener-first subscription and reference teardown",
  text: subscriptionBoot + eventListener + "kernel.event.subscribe(listener, 'ORDER');\n" + raiseOrder
    + "kernel.event.unsubscribe(listener);\n" + raiseOrder + "export const result = { delivered, active: kernel.event.listSubscriptions('ORDER').length };",
  findings: [], result: { delivered: 1, active: 0 }, coverage: "valid" });
cases.push({ name: "event subscription ID teardown is repeatable",
  text: subscriptionBoot + eventListener + "const id = kernel.event.subscribe(listener, 'ORDER');\n" + raiseOrder
    + "const first = kernel.event.unsubscribeBySubscriptionId(id); const second = kernel.event.unsubscribeBySubscriptionId(id);\n"
    + raiseOrder + "export const result = { delivered, first, second };",
  findings: [], result: { delivered: 1, first: true, second: false }, coverage: "valid" });
for (const [name, expression, failure] of [
  ["event gate rejects bus argument order", "kernel.event.subscribe('ORDER', listener)", /eventType must be a string/],
  ["event gate rejects missing eventType", "kernel.event.subscribe(listener)", /eventType must be a string/],
  ["event gate rejects numeric eventType", "kernel.event.subscribe(listener, 7)", /eventType must be a string/],
  ["event gate rejects numeric listener ID", "kernel.event.subscribe(listener, 'ORDER', 7)", /trim/],
] as const) cases.push({ name, text: subscriptionBoot + eventListener + expression + ";",
  findings: ["dcouplr/DCP-EVENT-SUB-001:deny"], error: failure, coverage: "checked" });
cases.push({ name: "event gate delays noncallable listener failure until delivery",
  text: subscriptionBoot + "kernel.event.subscribe('not-a-listener', 'ORDER');\n" + raiseOrder,
  findings: ["dcouplr/DCP-EVENT-SUB-001:deny"], error: /1 listener\(s\) failed/, coverage: "checked" });
cases.push({ name: "empty event channel survives reference teardown in the built-in bus",
  text: subscriptionBoot + eventListener + "kernel.event.subscribe(listener, '');\n"
    + "kernel.event.unsubscribe(listener); await kernel.event.raiseLocalBlocking({ eventType: '', payload: {} });\n"
    + "export const result = { delivered, listed: kernel.event.listSubscriptions('').length };",
  findings: ["dcouplr/DCP-EVENT-SUB-001:deny"], result: { delivered: 1, listed: 0 }, coverage: "checked" });
for (const [name, removal] of [
  ["event string teardown leaves its listener active", "kernel.event.unsubscribe('listener-label')"],
  ["event fresh closure teardown leaves its listener active", "kernel.event.unsubscribe(async event => {})"],
  ["event numeric subscription-ID teardown leaves its listener active", "kernel.event.unsubscribeBySubscriptionId(7)"],
] as const) cases.push({ name,
  text: subscriptionBoot + eventListener + "kernel.event.subscribe(listener, 'ORDER', 'listener-label');\n"
    + removal + ";\n" + raiseOrder + "export const result = { delivered, active: kernel.event.listSubscriptions('ORDER').length };",
  findings: ["dcouplr/DCP-EVENT-TEARDOWN-001:deny"], result: { delivered: 1, active: 1 }, coverage: "checked" });
cases.push({ name: "a listener display ID is not its subscription ID (ownership unresolved)",
  text: subscriptionBoot + eventListener + "kernel.event.subscribe(listener, 'ORDER', 'listener-label');\n"
    + "const removed = kernel.event.unsubscribeBySubscriptionId('listener-label');\n" + raiseOrder
    + "export const result = { removed, delivered };",
  findings: [], result: { removed: false, delivered: 1 }, coverage: "runtime-only" });
cases.push({ name: "low-level buses retain channel-first subscription",
  text: subscriptionBoot + `const events = app.resolveSingleton('EVENT_BUS'), messages = app.resolveSingleton('MESSAGE_BUS');
let eventCount = 0, messageCount = 0;
const listener = async event => { eventCount++; }, handler = async message => { messageCount++; };
events.subscribe('ORDER', listener); messages.subscribe('orders', handler);
await events.emitBlocking({ eventType: 'ORDER', payload: {} });
await messages.emitBlocking({ from: 'sender', to: 'orders', messageIntent: 'ORDER', payload: {} });
events.unsubscribe(listener); messages.unsubscribe(handler);
await events.emitBlocking({ eventType: 'ORDER', payload: {} });
await messages.emitBlocking({ from: 'sender', to: 'orders', messageIntent: 'ORDER', payload: {} });
export const result = { eventCount, messageCount };`,
  findings: [], result: { eventCount: 1, messageCount: 1 }, coverage: "valid" });
cases.push({ name: "message explicit peer and peer teardown",
  text: subscriptionBoot + messageHandler + "kernel.message.registerHandler(handler, 'orders');\n" + sendOrder
    + "kernel.message.unregisterHandler('orders');\n" + sendOrder + "export const result = delivered;",
  findings: [], result: 1, coverage: "valid" });
cases.push({ name: "message anonymous peer and subscription-ID teardown",
  text: subscriptionBoot + messageHandler + `const id = kernel.message.registerHandler(handler);
const peer = kernel.message.listSubscriptions().find(info => info.subscriptionId === id).peer;
await kernel.message.sendLocalBlocking('ORDER', {}, peer);
const removed = kernel.message.unregisterHandlerBySubscriptionId(id);
await kernel.message.sendLocalBlocking('ORDER', {}, peer);
export const result = { delivered, removed };`,
  findings: [], result: { delivered: 1, removed: true }, coverage: "valid" });
for (const [name, expression, failure] of [
  ["message registration rejects missing handler", "kernel.message.registerHandler()", /empty handler/],
  ["message registration rejects numeric peer", "kernel.message.registerHandler(handler, 7)", /trim/],
  ["message registration rejects boolean handler ID", "kernel.message.registerHandler(handler, 'orders', false)", /trim/],
] as const) cases.push({ name, text: subscriptionBoot + messageHandler + expression + ";",
  findings: ["dcouplr/DCP-MESSAGE-SUB-001:deny"], error: failure, coverage: "checked" });
cases.push({ name: "message gate delays noncallable handler failure until delivery",
  text: subscriptionBoot + "kernel.message.registerHandler('not-a-handler', 'orders');\n" + sendOrder,
  findings: ["dcouplr/DCP-MESSAGE-SUB-001:deny"], error: /1 listener\(s\) failed/, coverage: "checked" });
for (const [name, removal] of [
  ["message function teardown leaves its peer active", "kernel.message.unregisterHandler(async message => {})"],
  ["message object subscription-ID teardown leaves its peer active", "kernel.message.unregisterHandlerBySubscriptionId({})"],
] as const) cases.push({ name,
  text: subscriptionBoot + messageHandler + "kernel.message.registerHandler(handler, 'orders');\n"
    + removal + ";\n" + sendOrder + "export const result = delivered;",
  findings: ["dcouplr/DCP-MESSAGE-TEARDOWN-001:deny"], result: 1, coverage: "checked" });

cases.push(...deliveryCases());
cases.push(...loggingCases());
cases.push(...queueCases());
cases.push(...sagaCases(), ...systemBusCases(), ...subscriptionRegistryCases());
cases.push(...factoryCases());
cases.push(...utilityCases());
cases.push(...observabilityCases());

const inspectorBoot = `import { startDcouplrInspector } from 'dcouplr/inspector';
let emit, removed = 0;
const monitor = { onActionOccurred(callback) { emit = callback; return () => { removed++; }; }, requestGraph: async () => ({ nodes: [] }) };
const app = { monitor, getDependencyInformationPackage: () => ({ source: 'controlled' }) };
`;
const inspectorRequest = (options: string, expression: string) => inspectorBoot + `
const server = await startDcouplrInspector(app, { port: 0, host: '127.0.0.1', announce: false, debugConsole: false, ${options} });
let result;
try { ${expression} } finally { await server.close(); }
if (removed !== 1) throw new Error('Inspector did not remove its monitor observer');
export { result };`;
for (const [name, options, expression, result, coverage] of [
  ["inspector retains two events and removes its monitor observer", "maxEvents: 2, captureOnStart: true", `
    for (let i = 0; i < 5; i++) await emit({occurredAt: i, group: 'control', action: 'capture', activity: {subject: 'canary', detail: i}});
    const response = await fetch(server.url + '/recording', {signal: AbortSignal.timeout(1000)});
    const recording = await response.json(); result = {status: response.status, details: recording.events.map(e => e.detail)};`, { status: 200, details: [3, 4] }, "valid"],
  ["inspector zero event budget retains no events", "maxEvents: 0, captureOnStart: true", `
    await emit({occurredAt: 1, group: 'control', action: 'capture', activity: {subject: 'canary'}}); result = server.events.length;`, 0, "valid"],
  ["string inspector capture flag does not start capture", "captureOnStart: 'false'", `
    result = (await (await fetch(server.url + '/health', {signal: AbortSignal.timeout(1000)})).json()).paused;`, true, "checked"],
  ["string inspector budget is coerced by the runtime", "maxEvents: '2', captureOnStart: true", `
    for (let i = 0; i < 5; i++) await emit({occurredAt: i, group: 'control', action: 'capture', activity: {subject: 'canary'}}); result = server.events.length;`, 2, "checked"],
  ["string debug-console flag enables the console", "debugConsole: 'false'", `
    result = (await (await fetch(server.url + '/', {signal: AbortSignal.timeout(1000)})).json()).debugConsole.enabled;`, true, "checked"],
  ["string nested debug-console flag enables the console", "debugConsole: {enabled: 'false'}", `
    result = (await (await fetch(server.url + '/', {signal: AbortSignal.timeout(1000)})).json()).debugConsole.enabled;`, true, "checked"],
  ["nonstring inspector identity appears in health", "instanceId: false", `
    result = (await (await fetch(server.url + '/health', {signal: AbortSignal.timeout(1000)})).json()).instanceId;`, false, "checked"],
  ["unknown inspector key silently leaves the console enabled", "debugConsole: true, debgConsole: false", `
    result = (await (await fetch(server.url + '/', {signal: AbortSignal.timeout(1000)})).json()).debugConsole.enabled;`, true, "checked"],
  ["infinite inspector budget disables bounded retention", "maxEvents: Infinity, captureOnStart: true", `
    for (let i = 0; i < 100; i++) await emit({occurredAt: i, group: 'control', action: 'capture', activity: {subject: 'canary'}}); result = server.events.length;`, 100, "checked"],
  ["NaN inspector budget disables bounded retention", "maxEvents: Number.NaN, captureOnStart: true", `
    for (let i = 0; i < 100; i++) await emit({occurredAt: i, group: 'control', action: 'capture', activity: {subject: 'canary'}}); result = server.events.length;`, 100, "checked"],
  ["negative infinite inspector budget discards all recorded events", "maxEvents: -Infinity, captureOnStart: true", `
    for (let i = 0; i < 5; i++) await emit({occurredAt: i, group: 'control', action: 'capture', activity: {subject: 'canary'}}); result = server.events.length;`, 0, "checked"],
  ["inspector origin policy is not authorization", "captureOnStart: false", `
    const headers = {Origin: 'https://untrusted.invalid', 'Content-Type': 'application/json'};
    const preflight = await fetch(server.url + '/command', {method: 'OPTIONS', headers, signal: AbortSignal.timeout(1000)});
    const command = await fetch(server.url + '/command', {method: 'POST', headers, body: '{"command":"resume"}', signal: AbortSignal.timeout(1000)});
    const state = await command.json();
    const recording = await fetch(server.url + '/recording', {headers, signal: AbortSignal.timeout(1000)});
    result = {preflight: preflight.status, command: command.status, paused: state.paused, recording: recording.status};`, { preflight: 403, command: 200, paused: false, recording: 200 }, "runtime-only"],
] as const) cases.push({ name, text: inspectorRequest(options, expression), findings: coverage === "checked" ? ["dcouplr/DCP-SETUP-001:deny"] : [], result, coverage });
cases.push({ name: "numeric debug-console path rejects startup", text: inspectorRequest("debugConsole: {path: 1}", "result = 'unexpected';"),
  findings: ["dcouplr/DCP-SETUP-001:deny"], error: /trim/, coverage: "checked" });
cases.push({ name: "bigint inspector budget rejects event retention arithmetic", text: inspectorRequest("maxEvents: 1n, captureOnStart: true", `
for (let i = 0; i < 2; i++) await emit({occurredAt: i, group: 'control', action: 'capture', activity: {subject: 'canary'}});`),
  findings: ["dcouplr/DCP-SETUP-001:deny"], error: /BigInt|bigint/, coverage: "checked" });
cases.push({ name: "static class debug-console options preserve disabled state", text: inspectorRequest("debugConsole: class {static enabled = false; static path = '/inspect';}", `
result = (await (await fetch(server.url + '/', {signal: AbortSignal.timeout(1000)})).json()).debugConsole.enabled;`),
  findings: [], result: false, coverage: "valid" });
cases.push({ name: "static class inspector options satisfy the public structural contract", text: inspectorBoot + `
const server = await startDcouplrInspector(app, class {
  static host = '127.0.0.1'; static port = 0; static announce = false; static debugConsole = false;
});
let result;
try { result = (await (await fetch(server.url + '/health', {signal: AbortSignal.timeout(1000)})).json()).ok; }
finally { await server.close(); }
if (removed !== 1) throw new Error('Inspector did not remove its monitor observer');
export {result};`, findings: [], result: true, coverage: "valid" });
cases.push({ name: "inspector refuses a production runtime before opening a server", text: inspectorBoot + `
const previous = process.env.NODE_ENV;
let result;
try { process.env.NODE_ENV = 'production'; await startDcouplrInspector(app); }
catch (error) { result = error.message; }
finally { if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous; }
export { result };`, findings: [], result: "dcouplr inspector cannot be started when NODE_ENV=production.", coverage: "runtime-only" });

function verifiedSource(dir: string): Map<string, Buffer> {
  const metadata = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  strictEqual(metadata.name, "dcouplr");
  strictEqual(metadata.version, PIN.version);
  return new Map(Object.entries(PIN.files).map(([path, hash]) => {
    const content = readFileSync(join(dir, path));
    strictEqual(createHash("sha256").update(content).digest("hex"), hash, `Unreviewed source: ${path}`);
    return [path, content];
  }));
}

const sagaBoot = `import { setupDcouplr, getDcouplr, DStructuredSaga } from 'dcouplr';
let recovered = 0;
const pending = [];
const queue = { enqueue: async value => { pending.push(value); return true; }, dequeue: async () => pending.shift(),
  peek: async () => pending[0], stream: async function* () {}, recover: async () => { recovered++; }, get isEmpty() { return pending.length === 0; } };
setupDcouplr({ charEncoding: 'UTF-8', mode: 'run', ephemeral: true,
  systemDependencies: { IQueue: { __semanticIdentifier: 'CUSTOM_QUEUE', create: () => queue } } });
const app = getDcouplr();
app.dependencyAdmission.declareIntent('SAGA_CONTEXT').addMandatoryInputFields({}).addValidationPolicy().addVerificationPolicy()
  .addFactoryMethod((_input, kernel) => kernel).register();
const kernel = app.resolve('SAGA_CONTEXT', {});
`;
for (const [name, args, error] of [
  ["missing saga type", "", /non-empty sagaType/],
  ["missing saga ID", "'orders'", /non-empty sagaId/],
  ["missing saga kernel", "'orders', 'id'", /dependencies/],
  ["blank saga type", "' ', 'id', kernel", /non-empty sagaType/],
  ["blank saga ID", "'orders', '', kernel", /non-empty sagaId/],
  ["numeric saga type", "1, 'id', kernel", /trim/],
  ["null saga kernel", "'orders', 'id', null", /dependencies/],
  ["trailing spread cannot replace an explicit blank saga type", "'', ...['id', kernel]", /non-empty sagaType/],
] as const) cases.push({ name, text: sagaBoot + `new DStructuredSaga(${args});`,
  findings: ["dcouplr/DCP-SAGA-CTOR-001:deny"], error, coverage: "checked" });
const sagaConstruct = "const saga = new DStructuredSaga('orders', 'id', kernel);\n";
for (const [name, node, error] of [
  ["missing saga node", "", /stepId/], ["null saga node", "null", /stepId/],
  ["missing saga step ID", "{}", /stepId/],
  ["blank saga step ID", "{ stepId: ' ' }", /stepId/],
  ["missing saga trigger", "{ stepId: 'one' }", /trigger eventType/],
  ["missing saga handler", "{ stepId: 'one', on: 'REQUEST' }", /handler/],
  ["blank saga trigger", "{ stepId: 'one', on: '', handler: async () => {} }", /trigger eventType/],
  ["missing saga join references", "{ kind: 'join', stepId: 'join', mode: 'every' }", /expectedStepIds/],
  ["empty saga join references", "{ kind: 'join', stepId: 'join', mode: 'every', expectedStepIds: [] }", /expectedStepIds/],
  ["invalid saga join mode", "{ kind: 'join', stepId: 'join', mode: 'some', expectedStepIds: ['one'] }", /mode/],
  ["trailing spread cannot replace an explicit incomplete saga node", "{ stepId: 'one', on: 'REQUEST' }, ...[]", /handler/],
] as const) cases.push({ name, text: sagaBoot + sagaConstruct + `saga.registerNode(${node});`,
  findings: ["dcouplr/DCP-SAGA-NODE-001:deny"], error, coverage: "checked" });
for (const [name, node] of [
  ["unknown saga kind is runtime-tolerated but violates the public union", "{ kind: 'other', stepId: 'one', on: 'REQUEST', handler: async () => {} }"],
  ["truthy noncallable saga handler is stored before delivery", "{ stepId: 'one', on: 'REQUEST', handler: 'not-callable' }"],
  ["generator saga handler is stored without running its body", "{ stepId: 'one', on: 'REQUEST', handler: function* () {} }"],
  ["string checkpoint is runtime-tolerated but violates the public boolean", "{ stepId: 'one', on: 'REQUEST', handler: async () => {}, isCheckpoint: 'false' }"],
] as const) cases.push({ name, text: sagaBoot + sagaConstruct + `saga.registerNode(${node});\nexport const result = 'registered';`,
  findings: ["dcouplr/DCP-SAGA-NODE-001:deny"], result: "registered", coverage: "checked" });
const sagaStep = "saga.registerNode({ stepId: 'one', on: 'REQUEST', handler: async () => {} });\n";
cases.push({ name: "leading saga arguments remain statically unresolved", text: sagaBoot +
  "const args = ['orders', 'id', kernel]; new DStructuredSaga(...args, '', null); export const result = 'constructed';",
  findings: [], result: "constructed", coverage: "valid" });
for (const handler of ["function* () { delivered++; }", "async function* () { delivered++; }"]) {
  cases.push({ name: `${handler.startsWith("async") ? "async " : ""}generator saga delivery does not execute its body`,
    text: sagaBoot + sagaConstruct + `let delivered = 0;
saga.registerNode({ stepId: 'one', on: 'REQUEST', handler: ${handler} });
saga.start(); await Promise.resolve(); await Promise.resolve();
await kernel.event.raiseLocalBlocking({ eventType: 'REQUEST', payload: {}, ctx: { saga: { sagaId: 'id', branchId: 'branch', stepId: 'source' } } });
saga.stop(); export const result = delivered;`, findings: ["dcouplr/DCP-SAGA-NODE-001:deny"], result: 0, coverage: "checked" });
}
for (const [name, tail, error] of [
  ["duplicate saga node requires cross-call verification", sagaStep + sagaStep, /Duplicate/],
  ["unknown saga reference requires graph verification", "saga.registerNode({ kind: 'join', stepId: 'join', mode: 'every', expectedStepIds: ['missing'] }); saga.start();", /unknown expected step/],
] as const) cases.push({ name, text: sagaBoot + sagaConstruct + tail, findings: [], error, coverage: "runtime-only" });
for (const [name, refs] of [
  ["duplicate literal saga references", "['one', 'one']"],
  ["nonadjacent duplicate saga references", "['one', 'other', 'one']"],
  ["double-quoted duplicate saga references", '["one", "one"]'],
  ["template literal duplicate saga references", "[`one`, `one`]"],
  ["wrapped duplicate saga references", "(['one', 'one'])"],
  ["explicit duplicate references beside a spread", "['one', ...[], 'one']"],
  ["mixed string quote saga references", "['one', \"one\"]"],
  ["single quote and template saga references", "['one', `one`]"],
  ["double quote and template saga references", '["one", `one`]'],
] as const) cases.push({ name, text: sagaBoot + sagaConstruct + sagaStep +
  `saga.registerNode({ kind: 'join', stepId: 'join', mode: 'any', expectedStepIds: ${refs} }); saga.start();`,
  findings: ["dcouplr/DCP-SAGA-NODE-001:deny"], error: /duplicate expectedStepIds/, coverage: "checked" });
for (const [name, refs] of [
  ["escaped saga references require value decoding", "['one', 'on\\x65']"],
  ["named saga references require value flow", "[ref, ref]"],
  ["interpolated saga references require value flow", "[`on${suffix}`, `on${suffix}`]"],
] as const) cases.push({ name, text: sagaBoot + sagaConstruct + sagaStep +
  `const ref = 'one', suffix = 'e'; saga.registerNode({ kind: 'join', stepId: 'join', mode: 'any', expectedStepIds: ${refs} }); saga.start();`,
  findings: [], error: /duplicate expectedStepIds/, coverage: "runtime-only" });
cases.push({ name: "custom queue saga retains valid IDs, correlation and idempotent start-stop", text: sagaBoot + sagaConstruct + `
let delivered = 0;
saga.registerNode({ stepId: 'one', on: 'REQUEST', branchId: '', handler: async () => { delivered++; } });
saga.start(); saga.start(); await Promise.resolve(); await Promise.resolve();
const event = sagaId => ({ eventType: 'REQUEST', payload: {}, ctx: { saga: { sagaId, branchId: 'branch', stepId: 'source' } } });
await kernel.event.raiseLocalBlocking(event('other'));
const ignored = delivered;
await kernel.event.raiseLocalBlocking(event('id'));
saga.stop(); saga.stop();
await kernel.event.raiseLocalBlocking(event('id'));
export const result = { delivered, ignored, recovered, subscriptions: kernel.event.listSubscriptions('REQUEST').length };`,
  findings: [], result: { delivered: 1, ignored: 0, recovered: 1, subscriptions: 0 }, coverage: "valid" });

async function observeRuntime(upstream: { resetDcouplrForTesting(): void }, filename: string, example: Example) {
  upstream.resetDcouplrForTesting();
  const warnings: string[] = [], warn = console.warn;
  console.warn = (...parts: unknown[]) => { warnings.push(parts.map(String).join(" ")); };
  const { result, failure } = await runtimeOutcome(upstream, filename, warn);
  if (example.error) {
    if (failure === null) throw new Error(`${example.name}: expected runtime rejection`);
    match(failure, example.error, `${example.name}: runtime failure`);
  } else {
    strictEqual(failure, null, `${example.name}: unexpected runtime failure`);
    deepStrictEqual(result, example.result, `${example.name}: runtime result`);
  }
  if (example.warnings) {
    strictEqual(warnings.length, example.warnings.length, `${example.name}: runtime warning count`);
    for (const [index, expected] of example.warnings.entries()) match(warnings[index]!, expected, `${example.name}: runtime warning`);
  }
  return failure === null ? { result, warnings } : { error: failure, warnings };
}

async function runtimeOutcome(upstream: { resetDcouplrForTesting(): void }, filename: string, warn: typeof console.warn): Promise<{ result: unknown; failure: string | null }> {
  try { return { result: (await import(pathToFileURL(filename).href)).result, failure: null }; }
  catch (error) { return { result: undefined, failure: error instanceof Error ? error.message : String(error) }; }
  finally { console.warn = warn; upstream.resetDcouplrForTesting(); }
}

const VALID_POLICY_TYPES = [
  "const booleanValidation: CreationValidationPolicy = () => true;",
  "const objectValidation: CreationValidationPolicy = () => ({ valid: false, msg: 'rejected' });",
  "const throwsValidation: CreationValidationPolicy = () => { throw new Error('rejected'); };",
  "const classValidation: CreationValidationPolicy = () => class Result { static valid = true; };",
  // void callback assignability accepts these despite the runtime not waiting/running them.
  "const asyncVerification: AfterCreationVerificationPolicy = async () => {};",
  "const generatorVerification: AfterCreationVerificationPolicy = function* () {};",
  "const minimalSetup: ISetupDcouplrConfig = { charEncoding: 'UTF-8' };",
  "const explicitSetup: ISetupDcouplrConfig = { charEncoding: 'UTF-8', mode: 'test', ephemeral: false };",
  "const undefinedSetup: ISetupDcouplrConfig = { charEncoding: 'UTF-8', mode: undefined, ephemeral: undefined };",
  "const forbiddenSetup: ISetupDcouplrConfig = { charEncoding: 'UTF-8', forbiddenElements: ['console', 'Math.random'] };",
  // The public types alone do not enforce the runtime forbidden-name enum or system-key ownership.
  "const unknownForbiddenSetup: ISetupDcouplrConfig = { charEncoding: 'UTF-8', forbiddenElements: ['unsupported'] };",
  "const writeSystemSetting = (settings: ISettings) => settings.setSetting('mode', 'test');",
  "const sagaStep: IStructuredSagaStep = { stepId: 'one', on: 'REQUEST', handler: async () => {} };",
  "const sagaPromise: IStructuredSagaStep = { stepId: 'one', on: 'REQUEST', handler: () => Promise.resolve('success' as const) };",
  // Types do not enforce nonempty IDs/collections or graph reference ownership.
  "const emptySagaId: IStructuredSagaStep = { stepId: '', on: 'REQUEST', handler: async () => {} };",
  "const emptySagaJoin: IStructuredSagaJoinStep = { kind: 'join', stepId: 'join', mode: 'any', expectedStepIds: [] };",
  "const undefinedSystemFactories: ISystemDependencyFactories = { Logger: undefined, EventBus: undefined, MessageBus: undefined, DCast: undefined, IQueue: undefined, IQueuePersistence: undefined, MessageBrokerAdapter: undefined, EventBrokerAdapter: undefined };",
  "const customFactoryIdentifier: ISystemDependencyFactories = { EventBrokerAdapter: { __semanticIdentifier: 'CUSTOM', create: () => ({ raise: async () => {} }) } };",
  "const classSystemFactory: ISystemDependencyFactories = { EventBrokerAdapter: class { static __semanticIdentifier = 'CUSTOM'; static create() { return { raise: async () => {} }; } } };",
  "const minimalInspector: DcouplrInspectorOptions = {};",
  "const explicitInspector: DcouplrInspectorOptions = {host: '127.0.0.1', port: 0, maxEvents: 0, captureOnStart: false, instanceId: 'local', announce: false, debugConsole: {enabled: true, path: '/inspect'}};",
  "const undefinedInspector: DcouplrInspectorOptions = {host: undefined, port: undefined, maxEvents: undefined, captureOnStart: undefined, instanceId: undefined, announce: undefined, debugConsole: undefined};",
  "const infiniteInspector: DcouplrInspectorOptions = {maxEvents: Infinity};",
  "const classInspector: DcouplrInspectorOptions = class {static host = '127.0.0.1'; static port = 0;};",
  "const classDebugConsole: DcouplrInspectorOptions = {debugConsole: class {static enabled = false; static path = '/inspect';}};",
  "const namedPriority: DPriority = 'HIGH';",
  "const enqueueNamed = (queue: IPriorityQueue<string>) => queue.enqueue('HIGH', 'work');",
  "const genericCast = (cast: DCastFunction): string | null | undefined => cast<string>('12', 'number');",
  "const numericRank: typeof QueuePriorities.HIGH = 1;",
];
const INVALID_POLICY_TYPES = [
  "const asyncValidation: CreationValidationPolicy = async () => true;",
  "const generatorValidation: CreationValidationPolicy = function* () { yield true; };",
  "const numberValidation: CreationValidationPolicy = () => 1;",
  "const fieldValidation: CreationValidationPolicy = () => ({ valid: 'false' });",
  "const messageValidation: CreationValidationPolicy = () => ({ valid: true, msg: 1 });",
  "const encodingSetup: ISetupDcouplrConfig = { charEncoding: 1 };",
  "const modeSetup: ISetupDcouplrConfig = { charEncoding: 'UTF-8', mode: 'production' };",
  "const deliverySetup: ISetupDcouplrConfig = { charEncoding: 'UTF-8', ephemeral: 'false' };",
  "const collectionSetup: ISetupDcouplrConfig = { charEncoding: 'UTF-8', forbiddenElements: 'console' };",
  "const itemSetup: ISetupDcouplrConfig = { charEncoding: 'UTF-8', forbiddenElements: [1] };",
  "const missingSetup: ISetupDcouplrConfig = {};",
  "const unknownSetup: ISetupDcouplrConfig = { charEncoding: 'UTF-8', modde: 'test' };",
  "const badSagaKind: StructuredSagaNode = { kind: 'other', stepId: 'one', on: 'REQUEST', handler: async () => {} };",
  "const syncSagaHandler: IStructuredSagaStep = { stepId: 'one', on: 'REQUEST', handler: () => 'success' };",
  "const generatorSagaHandler: IStructuredSagaStep = { stepId: 'one', on: 'REQUEST', handler: function* () {} };",
  "const checkpointSaga: IStructuredSagaStep = { stepId: 'one', on: 'REQUEST', handler: async () => {}, isCheckpoint: 'false' };",
  "const noncallableSagaHandler: IStructuredSagaStep = { stepId: 'one', on: 'REQUEST', handler: true };",
  "const badSagaMode: IStructuredSagaJoinStep = { kind: 'join', stepId: 'join', mode: 'some', expectedStepIds: ['one'] };",
  "const missingSagaJoin: IStructuredSagaJoinStep = { kind: 'join', stepId: 'join', mode: 'every' };",
  ...systemFactories.map(([key]) => `const invalid${key}Factory: ISystemDependencyFactories = { ${key}: false };`),
  "const invalidInspectorHost: DcouplrInspectorOptions = {host: 7};",
  "const invalidInspectorPort: DcouplrInspectorOptions = {port: '4777'};",
  "const invalidInspectorBudget: DcouplrInspectorOptions = {maxEvents: '2000'};",
  "const invalidInspectorCapture: DcouplrInspectorOptions = {captureOnStart: 'false'};",
  "const invalidInspectorIdentity: DcouplrInspectorOptions = {instanceId: false};",
  "const invalidInspectorAnnounce: DcouplrInspectorOptions = {announce: []};",
  "const invalidInspectorConsole: DcouplrInspectorOptions = {debugConsole: 'false'};",
  "const invalidInspectorConsoleFlag: DcouplrInspectorOptions = {debugConsole: {enabled: 'false'}};",
  "const invalidInspectorConsolePath: DcouplrInspectorOptions = {debugConsole: {path: 1}};",
  "const unknownInspector: DcouplrInspectorOptions = {debgConsole: false};",
  "const unknownDebugConsole: DcouplrInspectorOptions = {debugConsole: {enabled: false, pat: '/inspect'}};",
  "const bigintInspectorPort: DcouplrInspectorOptions = {port: 1n};",
  "const bigintInspectorBudget: DcouplrInspectorOptions = {maxEvents: -1n};",
  "const missingFactoryCreate: ISystemDependencyFactories = { EventBrokerAdapter: { __semanticIdentifier: 'CUSTOM' } };",
  "const missingFactoryIdentifier: ISystemDependencyFactories = { EventBrokerAdapter: { create: () => ({ raise: async () => {} }) } };",
  "const asyncSystemFactory: ISystemDependencyFactories = { EventBrokerAdapter: { __semanticIdentifier: 'CUSTOM', create: async () => ({ raise: async () => {} }) } };",
  "const generatorSystemFactory: ISystemDependencyFactories = { EventBrokerAdapter: { __semanticIdentifier: 'CUSTOM', create: function* () {} } };",
  "const syncEventBroker: ISystemDependencyFactories = { EventBrokerAdapter: { __semanticIdentifier: 'CUSTOM', create: () => ({ raise: () => {} }) } };",
  "const syncMessageBroker: ISystemDependencyFactories = { MessageBrokerAdapter: { __semanticIdentifier: 'CUSTOM', create: () => ({ send: () => {} }) } };",
  "const numericPriority: DPriority = 1;",
  "const enqueueNumericRank = (queue: IPriorityQueue<string>) => queue.enqueue(1, 'work');",
  "const assumedPriorityConstructor = new IPriorityQueue<string>();",
];

function observePolicyTypes(scratch: string, bytes: Map<string, Buffer>) {
  const dir = join(scratch, "policy-types"); mkdirSync(dir);
  for (const filename of ["dist/index.d.mts", "dist/index-C3YI4Tf9.d.mts"]) writeFileSync(join(dir, filename.slice(5)), bytes.get(filename)!);
  mkdirSync(join(dir, "inspector"));
  writeFileSync(join(dir, "inspector/index.d.mts"), bytes.get("dist/inspector/index.d.mts")!);
  const header = 'import type { CreationValidationPolicy, AfterCreationVerificationPolicy, ISetupDcouplrConfig, ISystemDependencyFactories, ISettings, IStructuredSagaStep, IStructuredSagaJoinStep, StructuredSagaNode, DPriority, IPriorityQueue, DCastFunction, QueuePriorities } from "./index.mjs"; import type { DcouplrInspectorOptions } from "./inspector/index.mjs";\n';
  const observations = [];
  for (const [name, lines] of [["valid", VALID_POLICY_TYPES], ["invalid", INVALID_POLICY_TYPES]] as const) {
    writeFileSync(join(dir, `${name}.mts`), header + lines.join("\n") + "\n");
    const config = join(dir, `${name}.json`);
    writeFileSync(config, JSON.stringify({ compilerOptions: { noEmit: true, strict: true, skipLibCheck: true, types: [], target: "ES2022", module: "NodeNext" }, files: [`${name}.mts`] }));
    const checked = Bun.spawnSync([process.execPath, join(import.meta.dir, "../node_modules/typescript/bin/tsc"), "--project", config, "--pretty", "false"],
      { cwd: dir, stdin: "ignore", stdout: "pipe", stderr: "pipe", timeout: 30_000, killSignal: "SIGKILL", env: { ...process.env } });
    strictEqual(checked.exitedDueToTimeout, false, `${name}: policy type check deadline`);
    const diagnostics = checked.stdout.toString() + checked.stderr.toString();
    const errors = [...diagnostics.matchAll(/invalid\.mts\((\d+),\d+\): error TS(\d+):/g)].map(found => ({ line: Number(found[1]), code: Number(found[2]) }));
    if (name === "valid") { strictEqual(checked.exitCode, 0, diagnostics); strictEqual(diagnostics.trim(), "", diagnostics); }
    else {
      strictEqual(checked.exitCode, 1, diagnostics);
      deepStrictEqual(errors, INVALID_POLICY_TYPES.map((text, index) => ({ line: index + 2,
        code: /const missing(?:Setup|SagaJoin|FactoryCreate|FactoryIdentifier):/.test(text) || text.startsWith("const asyncSystemFactory:") ? 2741 : /^const unknown(?:Setup|Inspector|DebugConsole):/.test(text) ? 2561
          : text.startsWith("const enqueueNumericRank") ? 2345 : text.startsWith("const assumedPriorityConstructor") ? 2693 : 2322 })), diagnostics);
      strictEqual((diagnostics.match(/error TS/g) ?? []).length, errors.length, diagnostics);
    }
    observations.push({ name, examples: lines, errors });
  }
  return observations;
}

function sourceRequirements(observations: { name: string }[]) {
  return { deliveryRequirements: deliveryEvidence(observations), loggingRequirements: loggingEvidence(observations),
    queueRequirements: queueEvidence(observations), sagaRequirements: sagaEvidence(observations), factoryRequirements: factoryEvidence(observations), utilityRequirements: utilityEvidence(observations),
    observabilityRequirements: observabilityEvidence(observations) };
}

async function probe(dir: string): Promise<void> {
  const bytes = verifiedSource(dir);
  await grammars();
  const apiCoverage = coverageLedger(dir);
  strictEqual(readFileSync(join(import.meta.dir, "../packs/dcouplr/API-COVERAGE.json"), "utf8").replaceAll("\r\n", "\n"),
    JSON.stringify(apiCoverage, null, 2) + "\n", "Stale dcouplr public API inventory");
  const preset: Preset = { name: "dcouplr-source-probe", version: "1.0.0", engine: VERSIONS.engine,
    sources: [{ ns: "core", kind: "builtin", version: VERSIONS.core }, { ns: "dcouplr", kind: "path", path: "packs/dcouplr" }],
    methodologies: ["dcouplr/factories", "dcouplr/runtime", "dcouplr/queues", "dcouplr/events", "dcouplr/messages", "dcouplr/sagas"] };
  const files = readTree(join(import.meta.dir, "../packs/dcouplr"), true);
  const compiled = compile(JSON.stringify(preset), (s) => s.kind === "builtin" ? BUILTIN : files, VERSIONS);
  if ("errors" in compiled) throw new Error(compiled.errors.join("\n"));
  await probeScratch(mkdtempSync(join(tmpdir(), "pregate-dcouplr-source-")), bytes, compiled.lock, apiCoverage);
}

async function probeScratch(scratch: string, bytes: Map<string, Buffer>, lock: Parameters<typeof analyze>[0], apiCoverage: ReturnType<typeof coverageLedger>): Promise<void> {
  try {
    const typeContracts = observePolicyTypes(scratch, bytes);
    const runtimePath = join(scratch, "source.mjs");
    writeFileSync(runtimePath, bytes.get("dist/index.mjs")!);
    const runtimeURL = pathToFileURL(runtimePath).href;
    const inspectorDir = join(scratch, "inspector");
    mkdirSync(join(inspectorDir, "debug-console"), {recursive: true});
    writeFileSync(join(inspectorDir, "index.mjs"), bytes.get("dist/inspector/index.mjs")!);
    writeFileSync(join(inspectorDir, "debug-console/index.html"), bytes.get("dist/inspector/debug-console/index.html")!);
    const inspectorURL = pathToFileURL(join(inspectorDir, "index.mjs")).href;
    const filenames = cases.map((example, index) => join(scratch, `case-${index}.${example.extension ?? "mjs"}`));
    // Materialize the complete graph before Bun caches this directory during import.
    for (const [index, example] of cases.entries()) {
      writeFileSync(filenames[index]!, example.text.replace(/(['"])dcouplr\1/g, JSON.stringify(runtimeURL))
        .replace(/(['"])dcouplr\/inspector\1/g, JSON.stringify(inspectorURL)));
    }
    const upstream = await import(runtimeURL) as { resetDcouplrForTesting(): void };
    const observations = [];
    for (const [index, example] of cases.entries()) {
      const analysis = analyze(lock, "pre", example.path ?? "src/bootstrap/register.ts", example.text, { read: () => null, now: clock });
      if ("cause" in analysis) throw new Error(`${example.name}: ${analysis.cause}`);
      const findings = analysis.violations.map((v) => `${v.rule}:${v.severity}`).sort();
      deepStrictEqual(findings, [...example.findings].sort(), `${example.name}: pack result`);
      const filename = filenames[index]!;
      observations.push({ name: example.name, coverage: example.coverage, findings,
        runtime: await observeRuntime(upstream, filename, example) });
    }
    console.log(JSON.stringify({ source: { name: "dcouplr", ...PIN }, apiInventory: apiCoverage.summary,
      ...sourceRequirements(observations), typeContracts, cases: observations,
      limit: "Controlled runtime canaries, not a complete library audit or independently labeled consumer calibration. Runtime-only cases expose missing static coverage." }, null, 2));
  } finally { rmSync(scratch, { recursive: true, force: true }); }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length !== 1) throw new Error("usage: bun scripts/dcouplr-source-probe.ts /path/to/extracted/package | --fetch");
  if (args[0] !== "--fetch") return probe(resolve(args[0]!));
  await probeDownload(mkdtempSync(join(tmpdir(), "pregate-dcouplr-download-")));
}

async function probeDownload(scratch: string): Promise<void> {
  try {
    const response = await fetch(`https://registry.npmjs.org/dcouplr/-/dcouplr-${PIN.version}.tgz`, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok || !response.body) throw new Error(`Pinned package download failed: HTTP ${response.status}`);
    const archive = Buffer.concat(await archiveChunks(response.body.getReader()));
    strictEqual(createHash("sha512").update(archive).digest("base64"), PIN.integrity, "Unreviewed package archive");
    const filename = join(scratch, "source.tgz");
    writeFileSync(filename, archive);
    // A relative archive name: Git for Windows' GNU tar reads "C:\..." as a remote host "C".
    const extracted = Bun.spawnSync(["tar", "-xzf", basename(filename), "package/package.json",
      ...Object.keys(PIN.files).map((path) => `package/${path}`)], { cwd: scratch, timeout: 30_000, stdout: "pipe", stderr: "pipe" });
    if (extracted.exitCode !== 0) throw new Error(`Pinned extraction failed: ${extracted.stderr.toString()}`);
    await probe(join(scratch, "package"));
  } finally { rmSync(scratch, { recursive: true, force: true }); }
}

async function archiveChunks(reader: Pick<ReadableStreamDefaultReader<Uint8Array>, "read" | "cancel">): Promise<Uint8Array[]> {
  try {
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return chunks;
      size += value.byteLength;
      if (size > 16 * 1024 * 1024) throw new Error("Pinned package exceeds the 16 MiB download budget");
      chunks.push(value);
    }
  } finally { await reader.cancel(); }
}

await main();
