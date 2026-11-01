// Actual published queue/storage behavior, not a consumer compliance receipt.
import type { Example } from "./dcouplr-source-probe.ts";
import contract from "../packs/dcouplr/QUEUE-RUNTIME-CONTRACT.json" with { type: "json" };

const boot = (system = "") => `import { setupDcouplr, getDcouplr } from 'dcouplr';
const warnings = [];
const logger = { child() { return this; }, isLevelEnabled: () => true,
trace() {}, debug() {}, info() {}, warn: message => warnings.push(message), error() {}, fatal() {} };
setupDcouplr({ charEncoding: 'UTF-8', systemDependencies: {
Logger: { __semanticIdentifier: 'QUEUE_PROBE_LOGGER', create: () => logger }${system} } });
const app = getDcouplr();\n`;
const repository = `const operations = [];
const repository = { claimRecovery: async code => ({ acquired: false }), remove: async code => { operations.push(['remove', code]); },
append: async (code, entry) => { operations.push(['append', code, entry]); },
delete: async (code, sequence) => { operations.push(['delete', code, sequence]); },
appendBatch: async (code, entries) => { operations.push(['batch', code, [...entries]]); },
deleteUpTo: async (code, sequence) => { operations.push(['deleteUpTo', code, sequence]); } };\n`;
const queue = (enabled = true, mode = "leading", extras = "repository", id = "orders") => `const queue = app.resolve('I_QUEUE', {
queueId: ${JSON.stringify(id)}, segmentCapacity: 2, maxSegments: 1,
persistence: { enabled: ${enabled}, mode: '${mode}', aotMs: 1000, maxPendingOps: 2 }${extras ? ", " + extras : ""} });\n`;
const observed = (name: string, text: string, result: unknown): Example => ({ name, text, result, findings: [], coverage: "runtime-only" });

// Only the controlled queue's scheduled callbacks run; restore process globals
// and cancel queued work before import completion, including failure paths.
function timed(body: string): string {
  return `const jobs = new Map(), originalSetTimeout = globalThis.setTimeout, originalClearTimeout = globalThis.clearTimeout;
globalThis.setTimeout = (fn, delay, ...args) => { const handle = {}; jobs.set(handle, () => fn(...args)); return handle; };
globalThis.clearTimeout = handle => { jobs.delete(handle); };
const fire = () => { const [handle, fn] = jobs.entries().next().value; jobs.delete(handle); fn(); };
let actual;
try { ${body} }
finally { queue.flush(); globalThis.setTimeout = originalSetTimeout; globalThis.clearTimeout = originalClearTimeout; }
export const result = actual;`;
}

function admissionCases(): Example[] {
  return [
    observed("queue admission returns false at capacity and permits admission after removal", boot() + queue(false, "leading", "") + `
const first = await queue.enqueue('one'), second = await queue.enqueue('two'), rejected = await queue.enqueue('three');
const removed = await queue.dequeue(), retried = await queue.enqueue('three');
export const result = { first, second, rejected, removed, retried, remaining: [...queue.stream()] };`,
      { first: true, second: true, rejected: false, removed: "one", retried: true, remaining: ["two", "three"] }),
    observed("queue pending persistence can reject with spare memory capacity", repository + boot() + queue(true, "lagging") + timed(`
repository.claimRecovery = async () => ({ acquired: true, snapshot: { size: 1, items: [{ sequence: 5, value: 'old' }] } });
await queue.recover(); await queue.dequeue(); await queue.enqueue('new');
const accepted = await queue.enqueue('blocked'); actual = { accepted, size: queue.size, capacity: 2 };`),
      { accepted: false, size: 1, capacity: 2 }),
    observed("queue read views do not consume entries and share item references", boot() + queue(false, "leading", "") + `
const item = { value: 'before' }; await queue.enqueue(item); const peeked = await queue.peek();
peeked.value = 'after'; export const result = { size: queue.size, values: [...queue.stream()], same: peeked === item };`,
      { size: 1, values: [{ value: "after" }], same: true }),
  ];
}

function repositoryCases(): Example[] {
  return [
    observed("enabled queue persistence without a repository silently loses durability", boot() + queue(true, "leading", "") + `
export const result = { accepted: await queue.enqueue('one'), size: queue.size, warned: warnings.some(message => message.includes('repository was not provided')) };`,
      { accepted: true, size: 1, warned: true }),
    observed("configured singleton queue persistence is not selected by the default transient has lookup", repository +
      boot(", IQueuePersistence: { __semanticIdentifier: 'SYSTEM_STORE', create: () => repository }") + queue(true, "leading", "") + `
await queue.enqueue('one'); export const result = { operations: operations.length, transient: app.has('I_QUEUE_PERSISTENCE'),
singleton: app.hasSingleton('I_QUEUE_PERSISTENCE'), warned: warnings.some(message => message.includes('repository was not provided')) };`,
      { operations: 0, transient: false, singleton: true, warned: true }),
    observed("explicitly resolved singleton repository provides actual queue persistence", repository +
      boot(", IQueuePersistence: { __semanticIdentifier: 'SYSTEM_STORE', create: () => repository }") + queue(true, "leading", "repository: app.resolveSingleton('I_QUEUE_PERSISTENCE')") + `
await queue.enqueue('one'); export const result = operations.map(operation => operation[0]);`, ["append"]),
    observed("queue direct repository overrides the system persistence adapter", repository + `const systemRepository = { ...repository,
append: async () => { throw new Error('wrong repository'); } };\n` +
      boot(", IQueuePersistence: { __semanticIdentifier: 'SYSTEM_STORE', create: () => systemRepository }") + queue() + `
await queue.enqueue('one'); export const result = operations.map(operation => operation[0]);`, ["append"]),
  ];
}

function leadingWriteCases(): Example[] {
  return [
    observed("leading queue admission waits for append before exposing memory", repository + `let entered, release;
const started = new Promise(resolve => { entered = resolve; }), delayed = new Promise(resolve => { release = resolve; });
repository.append = async () => { entered(); await delayed; };\n` + boot() + queue() + `
const pending = queue.enqueue('one'); await started; const before = { size: queue.size, empty: (await queue.peek()) === undefined };
release(); const accepted = await pending; export const result = { before, accepted, after: queue.size };`,
      { before: { size: 0, empty: true }, accepted: true, after: 1 }),
    observed("leading append failure preserves memory and later operations still run", repository + `let calls = 0;
repository.append = async (code, entry) => { if (++calls === 1) throw new Error('store down'); operations.push(entry.sequence); };\n` + boot() + queue() + `
let failed = false; try { await queue.enqueue('lost'); } catch { failed = true; } const before = queue.size;
const accepted = await queue.enqueue('kept'); export const result = { failed, before, accepted, values: [...queue.stream()], sequences: operations };`,
      { failed: true, before: 0, accepted: true, values: ["kept"], sequences: [1] }),
  ];
}

function leadingDeleteCases(): Example[] {
  return [
    observed("leading queue removal waits for delete and retains its pending head", repository + `let entered, release;
const started = new Promise(resolve => { entered = resolve; }), delayed = new Promise(resolve => { release = resolve; });
repository.delete = async () => { entered(); await delayed; };\n` + boot() + queue() + `
await queue.enqueue('one'); const pending = queue.dequeue(); await started;
const before = { size: queue.size, value: await queue.peek() }; release();
export const result = { before, removed: await pending, after: queue.size };`, { before: { size: 1, value: "one" }, removed: "one", after: 0 }),
    observed("leading delete failure preserves the item for an explicit retry", repository + `let calls = 0;
repository.delete = async () => { if (++calls === 1) throw new Error('store down'); };\n` + boot() + queue() + `
await queue.enqueue('one'); let failed = false; try { await queue.dequeue(); } catch { failed = true; }
const before = { size: queue.size, value: await queue.peek() }; export const result = { failed, before, retried: await queue.dequeue(), after: queue.size };`,
      { failed: true, before: { size: 1, value: "one" }, retried: "one", after: 0 }),
  ];
}

function laggingCases(): Example[] {
  return [
    observed("lagging admission completes before its scheduled persistence", repository + boot() + queue(true, "lagging") + timed(`
const accepted = await queue.enqueue('one'); const before = operations.length; fire();
await Promise.resolve(); await Promise.resolve(); actual = { accepted, before, after: operations.map(operation => operation[0]) };`),
      { accepted: true, before: 0, after: ["batch"] }),
    observed("lagging enqueue then dequeue coalesces away an unpersisted append", repository + boot() + queue(true, "lagging") + timed(`
await queue.enqueue('one'); await queue.dequeue(); fire(); await Promise.resolve(); await Promise.resolve();
actual = { size: queue.size, batches: operations.filter(operation => operation[0] === 'batch').map(operation => operation[2]),
deletes: operations.filter(operation => operation[0] === 'deleteUpTo').length };`), { size: 0, batches: [[]], deletes: 0 }),
    observed("lagging recovery removal batches append before inclusive deletion", repository + `repository.claimRecovery = async () => ({ acquired: true,
snapshot: { size: 1, items: [{ sequence: 5, value: 'old' }] } });\n` + boot() + queue(true, "lagging") + timed(`
await queue.recover(); await queue.dequeue(); await queue.enqueue('new'); fire();
await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
actual = operations.map(operation => operation[0] === 'batch' ? ['batch', operation[2]] : ['deleteUpTo', operation[2]]);`),
      [["batch", [{ sequence: 6, value: "new" }]], ["deleteUpTo", 5]]),
  ];
}

function laggingFailureCase(): Example {
  return observed("lagging persistence failure escapes the timer as an unhandled rejection", repository + `
repository.appendBatch = async () => { throw new Error('store down'); };\n` + boot() + queue(true, "lagging") + timed(`
let receive, deadline; const report = new Promise(resolve => { receive = resolve; });
const onFailure = error => receive(String(error.message)); process.on('unhandledRejection', onFailure);
try {
  const accepted = await queue.enqueue('one'); fire();
  const bounded = new Promise((_, reject) => { deadline = originalSetTimeout(() => reject(new Error('missing failure report')), 1000); });
  const message = await Promise.race([report, bounded]); actual = { accepted, reported: message.includes('queue lagging persistence operation failed'), size: queue.size };
} finally { originalClearTimeout(deadline); process.removeListener('unhandledRejection', onFailure); }`),
    { accepted: true, reported: true, size: 1 });
}

function flushCases(): Example[] {
  return [
    observed("queue flush drops unpersisted lagging work instead of committing it", repository + boot() + queue(true, "lagging") + timed(`
await queue.enqueue('one'); const returned = queue.flush(); actual = { returned: returned === undefined, jobs: jobs.size, size: queue.size, operations: operations.length };`),
      { returned: true, jobs: 0, size: 0, operations: 0 }),
    observed("queue flush does not remove a persisted leading entry", repository + boot() + queue() + `
await queue.enqueue('one'); queue.flush(); export const result = { size: queue.size, operations: operations.map(operation => operation[0]) };`,
      { size: 0, operations: ["append"] }),
    observed("queue flush can be followed by an already pending leading admission", repository + `let entered, release;
const started = new Promise(resolve => { entered = resolve; }), delayed = new Promise(resolve => { release = resolve; });
repository.append = async () => { entered(); await delayed; };\n` + boot() + queue() + `
const pending = queue.enqueue('one'); await started; queue.flush(); const before = queue.size; release();
export const result = { before, accepted: await pending, after: queue.size };`, { before: 0, accepted: true, after: 1 }),
  ];
}

function deniedRecoveryCases(): Example[] {
  return [
    ...[false, true].map(acquired => observed(`recovery ${acquired ? "without a snapshot" : "with a denied claim"} preserves current memory`,
      repository + `repository.claimRecovery = async () => ({ acquired: ${acquired} });\n` + boot() + queue() + `
await queue.enqueue('current'); export const result = { recovered: await queue.recover(), values: [...queue.stream()] };`,
      { recovered: 1, values: ["current"] })),
    observed("recovery claim failure rejects without clearing current memory", repository +
      `repository.claimRecovery = async () => { throw new Error('claim failed'); };\n` + boot() + queue() + `
await queue.enqueue('current'); let message; try { await queue.recover(); } catch (error) { message = error.message; }
export const result = { message, values: [...queue.stream()] };`, { message: "claim failed", values: ["current"] }),
  ];
}

function acquiredRecoveryCases(): Example[] {
  return [
    observed("acquired recovery replaces memory and advances the highest entry sequence", repository + `
repository.claimRecovery = async () => ({ acquired: true, snapshot: { size: 999, items: [{ sequence: 10, value: 'recovered' }] } });\n` + boot() + queue() + `
await queue.enqueue('old'); const recovered = await queue.recover(); const values = [...queue.stream()]; await queue.enqueue('new');
export const result = { recovered, values, sequence: operations.at(-1)[2].sequence };`, { recovered: 1, values: ["recovered"], sequence: 11 }),
    observed("oversized recovery rejects after loading a capacity-sized prefix", repository + `
repository.claimRecovery = async () => ({ acquired: true, snapshot: { size: 3, items: [0, 1, 2].map(sequence => ({ sequence, value: sequence })) } });\n` + boot() + queue() + `
let failed = false; try { await queue.recover(); } catch { failed = true; }
export const result = { failed, size: queue.size, values: [...queue.stream()] };`, { failed: true, size: 2, values: [0, 1] }),
    observed("recovery trusts duplicate sequence values and incoming item order", repository + `
repository.claimRecovery = async () => ({ acquired: true, snapshot: { size: 2, items: [{ sequence: 7, value: 'first' }, { sequence: 7, value: 'second' }] } });\n` + boot() + queue() + `
export const result = { recovered: await queue.recover(), values: [...queue.stream()] };`, { recovered: 2, values: ["first", "second"] }),
    observed("malformed recovery can leave subsequent leading admission unpersisted", repository + `
repository.claimRecovery = async () => ({ acquired: true, snapshot: { size: 1, items: [null] } });\n` + boot() + queue() + `
let failed = false; try { await queue.recover(); } catch { failed = true; }
const accepted = await queue.enqueue('new'); export const result = { failed, accepted, appends: operations.filter(operation => operation[0] === 'append').length };`,
      { failed: true, accepted: true, appends: 0 }),
  ];
}

function identityCases(): Example[] {
  return [
    observed("queue storage codes trim identity but distinguish case with a hash", repository + boot() + `
const create = queueId => app.resolve('I_QUEUE', { queueId, segmentCapacity: 1, maxSegments: 1,
persistence: { enabled: true, mode: 'leading', aotMs: 1, maxPendingOps: 1 }, repository });
await create(' ORDERS ').enqueue('one'); await create('ORDERS').enqueue('two'); await create('orders').enqueue('three');
const codes = operations.map(operation => operation[1]); export const result = { trimEqual: codes[0] === codes[1], caseEqual: codes[1] === codes[2] };`,
      { trimEqual: true, caseEqual: false }),
    observed("separate queue instances share storage identity without automatic writer ownership", repository + boot() + `
const create = () => app.resolve('I_QUEUE', { queueId: 'orders', segmentCapacity: 1, maxSegments: 1,
persistence: { enabled: true, mode: 'leading', aotMs: 1, maxPendingOps: 1 }, repository });
await Promise.all([create().enqueue('one'), create().enqueue('two')]);
export const result = { sameCode: operations[0][1] === operations[1][1], sequences: operations.map(operation => operation[2].sequence) };`,
      { sameCode: true, sequences: [0, 0] }),
  ];
}

function unorderedRecoveryCase(): Example {
  return observed("recovery preserves unsorted incoming sequence order", repository + `
repository.claimRecovery = async () => ({ acquired: true, snapshot: { size: 2, items: [{ sequence: 10, value: 'later' }, { sequence: 3, value: 'earlier' }] } });\n` + boot() + queue() + `
await queue.recover(); export const result = [...queue.stream()];`, ["later", "earlier"]);
}

function customQueueCases(): Example[] {
  const custom = `const custom = { isEmpty: true, enqueue: () => 'accepted', dequeue: async () => undefined,
peek: async () => undefined, stream: function* () {}, recover: async () => 0 };\n`;
  return [observed("custom queue callable admission does not verify public size flush or result contracts", custom +
    boot(", IQueue: { __semanticIdentifier: 'CUSTOM_QUEUE', create: () => custom }") + queue(false, "leading", "") + `
export const result = { noSize: queue.size === undefined, noFlush: queue.flush === undefined, result: queue.enqueue('one') };`,
    { noSize: true, noFlush: true, result: "accepted" })];
}

export function queueCases(): Example[] {
  return [...admissionCases(), ...repositoryCases(), ...leadingWriteCases(), ...leadingDeleteCases(), ...laggingCases(), laggingFailureCase(),
    ...flushCases(), ...deniedRecoveryCases(), ...acquiredRecoveryCases(), unorderedRecoveryCase(), ...identityCases(), ...customQueueCases()];
}

export function queueEvidence(observations: { name: string }[]) {
  return contract.requirements.map(rule => ({ id: rule.id, canaries: rule.canaries.map(name => {
    if (observations.filter(observation => observation.name === name).length !== 1)
      throw new Error(`${rule.id}: expected exactly one completed queue source canary: ${name}`);
    return name;
  }) }));
}
