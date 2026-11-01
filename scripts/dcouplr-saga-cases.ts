// Observe the pinned deprecated saga implementation; never infer consumer compliance.
import type { Example } from "./dcouplr-source-probe.ts";
import contract from "../packs/dcouplr/SAGA-RUNTIME-CONTRACT.json" with { type: "json" };

const boot = (before = "", recover = "async () => {}", admission = "pending.push(event); return true;") => `
import { setupDcouplr, getDcouplr, DStructuredSaga,
buildStructuredSagaSuccessEventType, buildStructuredSagaCompensationEventType,
buildStructuredSagaBranchCancelEventType, buildStructuredSagaBranchFailureEventType } from 'dcouplr';
${before}
const logs = [], pending = [], configs = [];
const logger = { child() { return this; }, isLevelEnabled: () => true,
trace() {}, debug() {}, info() {}, warn: (...args) => logs.push(args), error: (...args) => logs.push(args), fatal() {} };
const queue = { enqueue: async event => { ${admission} }, dequeue: async () => pending.shift(), peek: async () => pending[0],
stream: async function* () { yield* pending; }, recover: ${recover}, get isEmpty() { return pending.length === 0; }, get size() { return pending.length; }, flush: async () => { pending.length = 0; } };
setupDcouplr({ charEncoding: 'UTF-8', ephemeral: true, systemDependencies: {
Logger: { __semanticIdentifier: 'SAGA_LOGGER', create: () => logger },
IQueue: { __semanticIdentifier: 'SAGA_QUEUE', create: config => { configs.push(config); return queue; } } } });
const app = getDcouplr();
app.dependencyAdmission.declareIntent('SAGA_KERNEL').addMandatoryInputFields({}).addValidationPolicy().addVerificationPolicy()
.addFactoryMethod((_input, kernel) => kernel).register();
const kernel = app.resolve('SAGA_KERNEL', {}), saga = new DStructuredSaga('orders', 'id', kernel);
const emit = (type, payload = {}, ctx = { saga: { sagaId: 'id', branchId: 'external', stepId: 'source' } }) => kernel.event.raiseLocalBlocking({ eventType: type, payload, ctx });
const settle = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
`;
const observed = (name: string, text: string, result: unknown): Example => ({ name, text, result, findings: [], coverage: "runtime-only" });
const step = (id = "one", options = "") => `saga.registerNode({ stepId: '${id}', on: '${id.toUpperCase()}', handler: async () => { calls.push('${id}'); }${options} });\n`;
const start = "saga.start(); await settle();\n";

function identityCases(): Example[] {
  const cases: Example[] = [];
  cases.push(observed("saga registration after start is stored but has no input subscription", boot() + `
const calls = []; ${step()} ${start} ${step("late")}
await emit('LATE'); await emit('ONE'); saga.stop(); export const result = calls;`, ["one"]));
  cases.push(observed("saga previous step references are not validated at start", boot() + `
const calls = []; ${step("one", ", previousStepId: 'missing'")} ${start}
await emit('ONE'); saga.stop(); export const result = calls;`, ["one"]));
  cases.push({ name: "saga join cannot refer to another join as an expected step", text: boot() + `
const calls = []; ${step()}
saga.registerNode({kind: 'join', stepId: 'join1', mode: 'every', expectedStepIds: ['one']});
saga.registerNode({kind: 'join', stepId: 'join2', mode: 'every', expectedStepIds: ['join1']}); saga.start();`,
    findings: [], error: /unknown expected step 'join1'/, coverage: "runtime-only" });
  cases.push(observed("saga input admits matching ID without validating source branch or step identity", boot() + `
const calls = []; ${step()} ${start}
await emit('ONE', {}, { saga: { sagaId: 'id' }, sourceType: 'untrusted' });
saga.stop(); export const result = calls;`, ["one"]));
  cases.push(observed("saga ignores input without its exact saga ID", boot() + `
const calls = []; ${step()} ${start}
await emit('ONE', {}, { saga: { sagaId: 'other' } }); await emit('ONE', {}, {}); await emit('ONE');
saga.stop(); export const result = calls;`, ["one"]));
  cases.push(observed("saga queue copy shares payload and nested context references", boot() + `
let release; const held = new Promise(resolve => { release = resolve; }); const values = [];
saga.registerNode({ stepId: 'one', on: 'ONE', handler: async event => { await held; values.push([event.payload.value, event.ctx.extra.value]); } });
${start} const payload = { value: 1 }, extra = { value: 1 };
const running = emit('ONE', payload, { saga: { sagaId: 'id' }, extra }); await settle(); payload.value = 2; extra.value = 3;
release(); await running; saga.stop(); export const result = values;`, [[2, 3]]));
  return cases;
}

function handlerCases(): Example[] {
  const cases: Example[] = [];
  for (const [value, label] of [["undefined", "void"], ["false", "false"], ["'unknown'", "unknown text"]]) {
    cases.push(observed(`saga handler ${label} result is treated as success`, boot() + `
let successes = 0; kernel.event.subscribe(() => { successes++; }, buildStructuredSagaSuccessEventType('orders', 'one'));
saga.registerNode({ stepId: 'one', on: 'ONE', handler: async () => ${value} }); ${start}
await emit('ONE'); saga.stop(); export const result = successes;`, 1));
  }
  cases.push(observed("saga literal failure runs own compensation before branch failure and previous request", boot() + `
const order = [];
kernel.event.subscribe(() => { order.push('branch'); }, buildStructuredSagaBranchFailureEventType('orders', 'single-branch'));
kernel.event.subscribe(() => { order.push('previous'); }, buildStructuredSagaCompensationEventType('orders', 'missing'));
saga.registerNode({ stepId: 'one', on: 'ONE', previousStepId: 'missing', handler: async () => 'failure', compensate: async () => { order.push('own'); } });
${start} await emit('ONE'); saga.stop(); export const result = order;`, ["own", "branch", "previous"]));
  cases.push(observed("saga handler exception is reported then follows failure compensation", boot() + `
const order = []; kernel.event.subscribe(() => { order.push('branch'); }, buildStructuredSagaBranchFailureEventType('orders', 'single-branch'));
saga.registerNode({ stepId: 'one', on: 'ONE', handler: async () => { throw new Error('handler failed'); }, compensate: async () => { order.push('own'); } });
${start} await emit('ONE'); saga.stop(); export { order as result };`, ["own", "branch"]));
  for (const checkpoint of [false, true]) {
    cases.push(observed(`saga succeeded ${checkpoint ? "checkpoint" : "step"} ${checkpoint ? "blocks" : "runs"} compensation`, boot() + `
let compensated = 0;
saga.registerNode({stepId: 'one', on: 'ONE', isCheckpoint: ${checkpoint}, handler: async () => {}, compensate: async () => { compensated++; }});
${start} await emit('ONE'); await emit(buildStructuredSagaCompensationEventType('orders', 'one'));
saga.stop(); export const result = compensated;`, checkpoint ? 0 : 1));
  }
  cases.push(observed("saga failed checkpoint still runs its own compensation", boot() + `
let compensated = 0; saga.registerNode({stepId: 'one', on: 'ONE', isCheckpoint: true, handler: async () => 'failure', compensate: async () => { compensated++; }});
${start} await emit('ONE'); saga.stop(); export const result = compensated;`, 1));
  cases.push(observed("saga compensation rejection leaves the step running and its later input ignored", boot() + `
let calls = 0, compensated = 0, failures = 0;
kernel.event.subscribe(() => { failures++; }, buildStructuredSagaBranchFailureEventType('orders','single-branch'));
saga.registerNode({stepId:'one',on:'ONE',handler:async () => { calls++; return 'failure'; },compensate:async () => { compensated++; throw new Error('compensation failed'); }});
${start} let errors; try {await emit('ONE');} catch(error) {errors=error.errors;} await emit('ONE'); saga.stop();
export const result = { calls, compensated, failures, errors:errors.length, pending:pending.length };`,
    { calls: 1, compensated: 1, failures: 0, errors: 1, pending: 0 }));
  return cases;
}

function joinCases(): Example[] {
  const cases: Example[] = [];
  cases.push(observed("saga every join resolves once after all distinct success signals", boot() + `
const calls = []; let joined = 0; ${step()} ${step("two")}
kernel.event.subscribe(() => { joined++; }, 'JOINED');
saga.registerNode({kind:'join',stepId:'join',mode:'every',expectedStepIds:['one','two'],onSuccess:'JOINED'});
${start} await emit('ONE'); const early = joined; await emit('TWO'); await emit(buildStructuredSagaSuccessEventType('orders','two'));
saga.stop(); export const result = { early, joined, calls };`, { early: 0, joined: 1, calls: ["one", "two"] }));
  cases.push(observed("saga join accepts success signals for steps whose handlers never ran", boot() + `
const calls = []; let joined = 0; ${step()} ${step("two")}
kernel.event.subscribe(() => { joined++; }, 'JOINED');
saga.registerNode({kind:'join',stepId:'join',mode:'every',expectedStepIds:['one','two'],onSuccess:'JOINED'});
${start} await emit(buildStructuredSagaSuccessEventType('orders','one')); await emit(buildStructuredSagaSuccessEventType('orders','two'));
saga.stop(); export const result = { joined, calls };`, { joined: 1, calls: [] }));
  cases.push(observed("saga any join cancels an idle sibling in a different branch", boot() + `
const calls = []; let joined = 0; ${step("one", ", branchId: 'left'")} ${step("two", ", branchId: 'right'")}
kernel.event.subscribe(() => { joined++; }, 'JOINED');
saga.registerNode({kind:'join',stepId:'join',mode:'any',expectedStepIds:['one','two'],onSuccess:'JOINED'});
${start} await emit('ONE'); await emit('TWO'); saga.stop(); export const result = { joined, calls };`, { joined: 1, calls: ["one"] }));
  cases.push(observed("saga any join does not cancel an idle sibling in the winner's branch", boot() + `
const calls = []; ${step("one", ", branchId: 'same'")} ${step("two", ", branchId: 'same'")}
saga.registerNode({kind:'join',stepId:'join',mode:'any',expectedStepIds:['one','two']});
${start} await emit('ONE'); await emit('TWO'); saga.stop(); export const result = calls;`, ["one", "two"]));
  return cases;
}

function joinFailureCases(): Example[] {
  const cases: Example[] = [];
  cases.push(observed("saga any join compensates a sibling that succeeded before the join is processed", boot() + `
const calls = []; let compensated = 0;
saga.registerNode({stepId:'one',on:'START',branchId:'left',handler:async () => {calls.push('one');}});
saga.registerNode({stepId:'two',on:'START',branchId:'right',handler:async () => {calls.push('two');},compensate:async () => {compensated++;}});
saga.registerNode({kind:'join',stepId:'join',mode:'any',expectedStepIds:['one','two']});
${start} await emit('START'); saga.stop(); export const result = {calls,compensated};`, {calls:["one","two"],compensated:1}));
  cases.push(observed("saga every join failure compensates prior success and cancels later idle work", boot() + `
const calls = []; let compensated = 0, failed = 0, joined = 0;
${step("one", ", branchId:'left', compensate:async () => {compensated++;}")}
saga.registerNode({stepId:'two',on:'TWO',branchId:'right',handler:async () => {calls.push('two'); return 'failure';}});
${step("three", ", branchId:'third'")}
kernel.event.subscribe(() => {failed++;},'FAILED'); kernel.event.subscribe(() => {joined++;},'JOINED');
saga.registerNode({kind:'join',stepId:'join',mode:'every',expectedStepIds:['one','two','three'],onSuccess:'JOINED',onFailure:'FAILED'});
${start} await emit('ONE'); await emit('TWO'); await emit('THREE'); saga.stop();
export const result = {calls,compensated,failed,joined};`, {calls:["one","two"],compensated:1,failed:1,joined:0}));
  for (const succeeds of [false, true]) cases.push(observed(`saga any join ${succeeds ? "permits another branch to win after one failure" : "fails once only after all branches fail"}`, boot() + `
let failed = 0, joined = 0;
saga.registerNode({stepId:'one',on:'ONE',branchId:'left',handler:async () => 'failure'});
saga.registerNode({stepId:'two',on:'TWO',branchId:'right',handler:async () => ${succeeds ? "'success'" : "'failure'"}});
kernel.event.subscribe(() => {failed++;},'FAILED'); kernel.event.subscribe(() => {joined++;},'JOINED');
saga.registerNode({kind:'join',stepId:'join',mode:'any',expectedStepIds:['one','two'],onSuccess:'JOINED',onFailure:'FAILED'});
${start} await emit('ONE'); const early = failed; await emit('TWO'); saga.stop(); export const result = {early,failed,joined};`,
    {early:0,failed:succeeds?0:1,joined:succeeds?1:0}));
  return cases;
}

function lifecycleCases(): Example[] {
  const cases: Example[] = [];
  cases.push(observed("saga cancellation queued behind a running handler does not abort or compensate it", boot() + `
let release, finished = 0, compensated = 0; const held = new Promise(resolve => { release = resolve; });
saga.registerNode({stepId:'one',on:'ONE',branchId:'work',handler:async () => { await held; finished++; },compensate:async () => { compensated++; }});
${start} const running = emit('ONE'); await settle();
const cancel = emit(buildStructuredSagaBranchCancelEventType('orders','work')); await settle(); const before = finished;
release(); await running; await cancel; saga.stop(); export const result = { before, finished, compensated };`, { before: 0, finished: 1, compensated: 0 }));
  cases.push(observed("saga start returns before recovery and live input can run during recovery", boot("let release; const held = new Promise(resolve => { release = resolve; });", "async () => { await held; }") + `
const calls = []; ${step()} const returned = saga.start(); await emit('ONE'); const before = calls.length;
release(); await settle(); saga.stop(); export const result = { returned, before };`, { returned: undefined, before: 1 }));
  cases.push(observed("saga recovered input is processed without live saga ID admission", boot("let recovered = 0;", "async () => { pending.push({eventType:'ONE',payload:{},ctx:{saga:{sagaId:'other'}}}); recovered++; }") + `
const calls = []; ${step()} ${start} saga.stop(); export const result = { calls, recovered };`, { calls: ["one"], recovered: 1 }));
  cases.push(observed("saga stop returns before an in-flight handler and its success signal", boot() + `
let release, completed = 0, successes = 0; const held = new Promise(resolve => { release = resolve; });
kernel.event.subscribe(() => { successes++; }, buildStructuredSagaSuccessEventType('orders','one'));
saga.registerNode({stepId:'one',on:'ONE',handler:async () => { await held; completed++; }});
${start} const running = emit('ONE'); await settle(); const returned = saga.stop(); const before = completed;
release(); await running; export const result = { returned, before, completed, successes, subscriptions:kernel.event.listSubscriptions('ONE').length };`,
    { returned: undefined, before: 0, completed: 1, successes: 1, subscriptions: 0 }));
  cases.push(observed("saga duplicate input is ignored until stop and restart reset its state", boot() + `
const calls = []; ${step()} ${start} await emit('ONE'); await emit('ONE'); const before = calls.length;
saga.stop(); ${start} await emit('ONE'); saga.stop(); export const result = { before, after:calls.length };`, { before: 1, after: 2 }));
  cases.push(observed("saga recovery rejection escapes start as an unhandled rejection", boot("", "async () => {throw new Error('recovery failed');}") + `
let receive, timer; const failure = new Promise(resolve => {receive=resolve;});
const listener = error => receive(error.message); process.on('unhandledRejection',listener);
let message; try {saga.start(); message = await Promise.race([failure,new Promise((_,reject) => {timer=setTimeout(() => reject(new Error('missing recovery failure')),1000);})]);}
finally {clearTimeout(timer);process.removeListener('unhandledRejection',listener);saga.stop();} export const result = message;`, "recovery failed"));
  cases.push(observed("saga queue saturation returns a delivery error without running the handler", boot("", "async () => {}", "return false;") + `
const calls = []; ${step()} ${start} let errors; try {await emit('ONE');} catch(error) {errors=error.errors;} saga.stop(); export const result = {calls,errors:errors.length};`, {calls:[],errors:1}));
  return cases;
}

function persistenceCase(): Example {
  const repository = `const operations = [];
const repository = {claimRecovery:async () => {operations.push('recover');return {acquired:false};},remove:async () => {},
append:async () => {operations.push('append');},delete:async () => {operations.push('delete');},appendBatch:async () => {},deleteUpTo:async () => {}};`;
  const configured = boot(repository).replace("IQueue: { __semanticIdentifier: 'SAGA_QUEUE', create: config => { configs.push(config); return queue; } }",
    "IQueuePersistence: { __semanticIdentifier: 'SAGA_REPOSITORY', create: () => repository }");
  return observed("saga built-in queue accepts a persistence singleton without actually selecting its repository", configured + `
const calls = []; ${step()} ${start} await emit('ONE'); saga.stop(); export const result = {calls,operations,warnings:logs.map(args => args[0])};`,
    {calls:["one"],operations:[],warnings:["DQueue persistence disabled for orders.structured-saga.id: repository was not provided", "DQueue recovery skipped for orders.structured-saga.id: persistence is disabled"]});
}

export function sagaCases(): Example[] {
  return [...identityCases(), ...handlerCases(), ...joinCases(), ...joinFailureCases(), ...lifecycleCases(), persistenceCase()];
}

export function sagaEvidence(observations: { name: string }[]) {
  return contract.requirements.map(rule => ({ requirement: rule.id, source: rule.source, canaries: rule.canaries.map(name => {
    const matches = observations.filter(observation => observation.name === name);
    if (matches.length !== 1) throw new Error(`${rule.id}: expected exactly one completed saga source canary: ${name}`);
    return name;
  }) }));
}
