// Published logging behavior. Constructor reflection is an internal runtime oracle,
// not a public construction API or a consumer compliance receipt.
import type { Example } from "./dcouplr-source-probe.ts";
import contract from "../packs/dcouplr/LOGGING-CONTRACT.json" with { type: "json" };

const boot = (custom = false) => `import { setupDcouplr, getDcouplr } from 'dcouplr';
setupDcouplr({ charEncoding: 'UTF-8'${custom ? ", systemDependencies: { Logger: { __semanticIdentifier: 'CUSTOM_LOGGER', create: () => adapter } }" : ""} });
const app = getDcouplr();
app.dependencyAdmission.declareIntent('KERNEL').addMandatoryInputFields({}).addValidationPolicy().addVerificationPolicy()
.addFactoryMethod((_input, kernel) => kernel).register();
const kernel = app.resolve('KERNEL');\n`;
const spy = `const records = [];
const makeLogger = (bindings = {}, enabled = true) => ({
  child: more => makeLogger({ ...bindings, ...more }, enabled), isLevelEnabled: () => enabled,
  ...Object.fromEntries(['trace', 'debug', 'info', 'warn', 'error', 'fatal'].map(level => [level,
    (...args) => { records.push({ level, args, bindings }); }]))
});
const adapter = makeLogger();\n`;
const internalWriter = boot() + `const records = [];
const Logger = app.resolve('LOGGER').constructor;
const logger = new Logger('info', { parent: 'base', same: 'base' }, record => records.push(record));\n`;
const observed = (name: string, text: string, result: unknown): Example => ({ name, text, result, findings: [], coverage: "runtime-only" });

function contextCases(): Example[] {
  return [
    observed("kernel logging delegates to the configured adapter", spy + boot(true) + `
kernel.logger.info('CASE', { request: 'one' });
export const result = records.map(record => ({ level: record.level, message: record.args[0], context: record.args[1] }));`,
      [{ level: "info", message: "CASE", context: { request: "one" } }]),
    observed("logger gate child keeps its configured adapter", spy + boot(true) + `
const child = kernel.logger.child({ request: 'child' }); child.info('CASE'); kernel.logger.info('PARENT');
export const result = { separate: child !== kernel.logger, contexts: records.map(record => record.bindings) };`,
      { separate: true, contexts: [{ request: "child" }, {}] }),
    observed("default logger child bindings preserve parent and sibling contexts", internalWriter + `
const first = logger.child({ same: 'first' }), second = logger.child({ same: 'second' });
first.info('FIRST'); second.info('SECOND'); logger.info('PARENT');
export const result = records.map(record => record.context);`,
      [{ parent: "base", same: "first" }, { parent: "base", same: "second" }, { parent: "base", same: "base" }]),
    observed("default logger call context overrides child and parent bindings", internalWriter + `
logger.child({ same: 'child', child: true }).info('CASE', { same: 'call', local: true });
export const result = records[0].context;`, { parent: "base", same: "call", child: true, local: true }),
    observed("default logger child bindings are shallow values", internalWriter + `
const nested = { value: 'before' }, child = logger.child({ nested }); nested.value = 'after'; child.info('CASE');
export const result = records[0].context.nested.value;`, "after"),
  ];
}

function levelCases(): Example[] {
  return [
    observed("default logger info threshold filters all six levels", internalWriter + `
const levels = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];
const enabled = levels.map(level => logger.isLevelEnabled(level)); levels.forEach(level => logger[level]('CASE'));
export const result = { enabled, written: records.map(record => record.level) };`,
      { enabled: [false, false, true, true, true, true], written: ["info", "warn", "error", "fatal"] }),
    observed("disabled logging still calls the configured adapter", spy + `adapter.isLevelEnabled = () => false;\n` + boot(true) + `
const activities = []; const unsubscribe = app.monitor.onActionOccurred(event => { if (event.payload.group === 'logging') activities.push(event.payload); });
kernel.logger.debug('CASE'); await Promise.resolve(); unsubscribe();
export const result = { adapterCalls: records.length, monitorEvents: activities.length };`, { adapterCalls: 1, monitorEvents: 0 }),
    observed("level guard prevents expensive context construction", spy + `adapter.isLevelEnabled = () => false;\n` + boot(true) + `
let built = 0; const build = () => { built++; return { expensive: true }; };
if (kernel.logger.isLevelEnabled('debug')) kernel.logger.debug('CASE', build());
export const result = { built, adapterCalls: records.length };`, { built: 0, adapterCalls: 0 }),
    observed("eager disabled logging still constructs its context", spy + `adapter.isLevelEnabled = () => false;\n` + boot(true) + `
let built = 0; const build = () => { built++; return { expensive: true }; }; kernel.logger.debug('CASE', build());
export const result = { built, adapterCalls: records.length };`, { built: 1, adapterCalls: 1 }),
  ];
}

function overloadCases(): Example[] {
  return [
    observed("logger gate normalizes context and source overloads", spy + boot(true) + `
class Caller {} const caller = new Caller();
kernel.logger.info({ request: 'one' }, 'CASE', caller); kernel.logger.info('SOURCE', caller);
export const result = records.map(record => ({ message: record.args[0], context: record.args[1] ?? null, source: record.args[2]?.constructor.name }));`,
      [{ message: "CASE", context: { request: "one" }, source: "Caller" }, { message: "SOURCE", context: null, source: "Caller" }]),
    ...(["error", "fatal"] as const).map(level => observed(`${level === "error" ? "logger gate preserves Error-first adapter arguments" : "fatal logging returns normally and execution continues"}`,
      spy + boot(true) + `class Caller {} const caller = new Caller(), error = new Error('original');
const returned = kernel.logger.${level}(error, 'override', { request: 'one' }, caller);
const record = records[0];
export const result = { sameError: record.args[0] === error, message: record.args[1], context: record.args[2],
source: record.args[3].constructor.name, returned: returned === undefined, continued: true };`,
      { sameError: true, message: "override", context: { request: "one" }, source: "Caller", returned: true, continued: true })),
    observed("default logger error context permits an explicit err override", internalWriter + `
logger.error(new Error('original'), 'override', { err: { code: 'owned' } });
export const result = { message: records[0].message, err: records[0].context.err };`,
      { message: "override", err: { code: "owned" } }),
  ];
}

function flushCases(): Example[] {
  return [
    observed("logger gate waits for an adapter flush promise", spy + `let release, finished = false;
const delayed = new Promise(resolve => { release = resolve; }); adapter.flush = () => delayed;\n` + boot(true) + `
const pending = kernel.logger.flush().then(() => { finished = true; }); await Promise.resolve();
const before = finished; release(); await pending; export const result = { before, after: finished };`, { before: false, after: true }),
    observed("logger gate propagates a rejected flush", spy + `adapter.flush = async () => { throw new Error('sink down'); };\n` + boot(true) + `
let message; try { await kernel.logger.flush(); } catch (error) { message = error.message; } export const result = message;`, "sink down"),
    observed("logger gate permits a synchronous adapter without flush", spy + boot(true) + `
kernel.logger.info('CASE'); await kernel.logger.flush(); export const result = records.length;`, 1),
  ];
}

function monitorCases(): Example[] {
  const monitor = `const activities = []; const unsubscribe = app.monitor.onActionOccurred(event => {
if (event.payload.group === 'logging') activities.push(event.payload.activity.detail); });\n`;
  return [
    observed("logger monitor does not include adapter child bindings", spy + boot(true) + monitor + `
kernel.logger.child({ tenant: 'child' }).info('CASE', { request: 'call' }); await Promise.resolve(); unsubscribe();
export const result = { bindings: records[0].bindings, monitorContext: activities[0].context };`,
      { bindings: { tenant: "child" }, monitorContext: { request: "call" } }),
    observed("logger monitor Error-first context is not serialized error evidence", spy + boot(true) + monitor + `
const error = new Error('original'); kernel.logger.error(error, 'CASE', { request: 'call' });
await Promise.resolve(); unsubscribe();
export const result = { adapterHasError: records[0].args[0] === error, monitorContext: activities[0].context,
monitorMessage: activities[0].message };`, { adapterHasError: true, monitorContext: { request: "call" }, monitorMessage: "CASE" }),
  ];
}

export function loggingCases(): Example[] { return [...contextCases(), ...levelCases(), ...overloadCases(), ...flushCases(), ...monitorCases()]; }

export function loggingEvidence(observations: { name: string }[]) {
  return contract.requirements.map(rule => ({ id: rule.id, canaries: rule.canaries.map(name => {
    if (observations.filter(observation => observation.name === name).length !== 1)
      throw new Error(`${rule.id}: expected exactly one completed logging source canary: ${name}`);
    return name;
  }) }));
}
