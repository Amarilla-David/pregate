// Actual published-runtime contrasts. These are not consumer compliance receipts.
import type { Example } from "./dcouplr-source-probe.ts";
import contract from "../packs/dcouplr/DELIVERY-CONTRACT.json" with { type: "json" };

const kernelBoot = (config = "{ charEncoding: 'UTF-8' }") => `import { setupDcouplr, getDcouplr } from 'dcouplr';
setupDcouplr(${config});
const app = getDcouplr();
app.dependencyAdmission.declareIntent('KERNEL').addMandatoryInputFields({}).addValidationPolicy().addVerificationPolicy()
.addFactoryMethod((_input, kernel) => kernel).register();
const kernel = app.resolve('KERNEL');\n`;
const event = "{ eventType: 'ORDER', payload: {} }";
const register = (gate: "event" | "message", callback: string) => gate === "event"
  ? `kernel.event.subscribe(${callback}, 'ORDER');`
  : `kernel.message.registerHandler(${callback}, 'orders');`;
const blocking = (gate: "event" | "message") => gate === "event"
  ? `kernel.event.raiseLocalBlocking(${event})` : "kernel.message.sendLocalBlocking('ORDER', {}, 'orders')";
const nonblocking = (gate: "event" | "message", onError: string) => gate === "event"
  ? `kernel.event.raiseLocal(${event}, ${onError})` : `kernel.message.sendLocal('ORDER', {}, 'orders', ${onError})`;
const observed = (name: string, text: string, result: unknown): Example => ({
  name, text, result, findings: [], coverage: "runtime-only",
});

function localDeliveryCases(): Example[] {
  return (["event", "message"] as const).flatMap(gate => [
    observed(`${gate} blocking completion waits for the actual listener`, kernelBoot() + `
let entered, release, done = false;
const started = new Promise(resolve => { entered = resolve; });
const pendingListener = new Promise(resolve => { release = resolve; });
${register(gate, "async () => { entered(); await pendingListener; done = true; }")}
const pending = ${blocking(gate)};
await started;
const before = done;
release(); await pending;
export const result = { before, after: done };`, { before: false, after: true }),
    observed(`${gate} blocking failure waits for all listeners and aggregates errors`, kernelBoot() + `
let delivered = 0, errors;
${register(gate, "async () => { delivered++; throw new Error('first'); }")}
${gate === "event" ? register(gate, "async () => { await Promise.resolve(); delivered++; throw new Error('second'); }")
      : "kernel.message.registerHandler(async () => { await Promise.resolve(); delivered++; throw new Error('second'); }, 'other');"}
try { await ${gate === "event" ? blocking(gate) : "kernel.message.sendLocalBlocking('ORDER')"}; }
catch (error) { errors = error.errors.map(e => e.errors ? e.errors.map(inner => inner.message) : e.message).sort(); }
export const result = { delivered, errors };`, { delivered: 2, errors: gate === "event" ? ["first", "second"] : [["first"], ["second"]] }),
    observed(`${gate} nonblocking errors use the callback and return no promise`, kernelBoot() + `
let report, caught = false;
const reported = new Promise(resolve => { report = resolve; });
${register(gate, "async () => { throw new Error('failed'); }")}
let returned;
try { returned = ${nonblocking(gate, "error => report(error.message)")}; } catch { caught = true; }
const error = await reported;
export const result = { returned: returned === undefined, caught, error };`, { returned: true, caught: false, error: "failed" }),
    observed(`${gate} awaiting a nonblocking call does not wait for listener completion`, kernelBoot() + `
let entered, release, done = false;
const started = new Promise(resolve => { entered = resolve; });
const delayed = new Promise(resolve => { release = resolve; });
const finished = new Promise(resolve => { ${register(gate, "async () => { entered(); await delayed; done = true; resolve(); }")} });
await ${nonblocking(gate, "undefined")}; await started;
const before = done; release(); await finished;
export const result = { before, after: done };`, { before: false, after: true }),
  ]);
}

function brokerCases(): Example[] {
  return (["event", "message"] as const).flatMap(gate => {
    const key = gate === "event" ? "EventBrokerAdapter" : "MessageBrokerAdapter", method = gate === "event" ? "raise" : "send";
    const call = gate === "event" ? `kernel.event.raiseBroker(${event})` : "kernel.message.sendBroker('ORDER', {}, 'orders')";
    const config = `{ charEncoding: 'UTF-8', systemDependencies: { ${key}: { __semanticIdentifier: 'CUSTOM', create: () => adapter } } }`;
    return [
      observed(`${gate} broker promise waits for handoff but not remote processing`, `let entered, release, handedOff = false, remoteDone = false;
const started = new Promise(resolve => { entered = resolve; });
const delayed = new Promise(resolve => { release = resolve; });
const adapter = { ${method}: async () => { entered(); await delayed; handedOff = true; } };
` + kernelBoot(config) + `const pending = ${call}; await started;
const before = handedOff; release(); await pending;
export const result = { before, handedOff, remoteDone };`, { before: false, handedOff: true, remoteDone: false }),
      observed(`${gate} broker rejection reaches onError instead of rejecting the caller`, `const adapter = { ${method}: async () => { throw new Error('broker down'); } };
` + kernelBoot(config) + `let rejected = false, reported;
try { await ${gate === "event" ? `kernel.event.raiseBroker(${event}, error => { reported = error.message; })`
        : "kernel.message.sendBroker('ORDER', {}, 'orders', error => { reported = error.message; })"}; } catch { rejected = true; }
export const result = { rejected, reported };`, { rejected: false, reported: "broker down" }),
      observed(`${gate} broker failure without an error callback still resolves`, `const adapter = { ${method}: async () => { throw new Error('broker down'); } };
` + kernelBoot(config) + `let rejected = false; try { await ${call}; } catch { rejected = true; }
export const result = rejected;`, false),
      observed(`${gate} non-promise broker output fails through the error callback`, `const adapter = { ${method}: () => undefined };
` + kernelBoot(config) + `let rejected = false, reported = false;
try { await ${gate === "event" ? `kernel.event.raiseBroker(${event}, error => { reported = /catch/.test(error.message); })`
        : "kernel.message.sendBroker('ORDER', {}, 'orders', error => { reported = /catch/.test(error.message); })"}; } catch { rejected = true; }
export const result = { rejected, reported };`, { rejected: false, reported: true }),
    ];
  });
}

function fallbackCases(): Example[] {
  return [
    ["omitted", "", true], ["undefined", "ephemeral: undefined,", true],
    ["true", "ephemeral: true,", true], ["false", "ephemeral: false,", false],
  ].map(([name, field, waits]) => observed(`broker fallback ${name} selects ${waits ? "blocking" : "nonblocking"} local bus`, `
const counts = { event: { blocking: 0, nonblocking: 0 }, message: { blocking: 0, nonblocking: 0 } };
const bus = kind => ({ subscribe() {}, unsubscribe() {},
  emit(item) { if ((item.eventType ?? item.messageIntent) === 'ORDER') counts[kind].nonblocking++; },
  emitBlocking: async item => { if ((item.eventType ?? item.messageIntent) === 'ORDER') counts[kind].blocking++; } });
` + kernelBoot(`{ charEncoding: 'UTF-8', ${field} systemDependencies: {
EventBus: { __semanticIdentifier: 'CUSTOM_EVENT', create: () => bus('event') },
MessageBus: { __semanticIdentifier: 'CUSTOM_MESSAGE', create: () => bus('message') } } }`) + `
await kernel.event.raiseBroker(${event}); await kernel.message.sendBroker('ORDER', {}, 'orders');
export const result = counts;`, {
    event: { blocking: waits ? 1 : 0, nonblocking: waits ? 0 : 1 },
    message: { blocking: waits ? 1 : 0, nonblocking: waits ? 0 : 1 },
  }));
}

function routingCases(): Example[] {
  return [
    observed("message source attribution does not target a peer and missing destination broadcasts", kernelBoot() + `
const deliveries = [];
kernel.message.registerHandler(async message => { deliveries.push(['one', message.to, message.from]); }, 'one');
kernel.message.registerHandler(async message => { deliveries.push(['two', message.to, message.from]); }, 'two');
await kernel.message.sendLocalBlocking('ORDER', {}, undefined, { sourceType: 'one' });
export const result = deliveries;`, [["one", "*", "one"], ["two", "*", "one"]]),
    observed("message explicit destination trims whitespace and reaches only that peer", kernelBoot() + `
const deliveries = [];
kernel.message.registerHandler(async () => { deliveries.push('one'); }, 'one');
kernel.message.registerHandler(async () => { deliveries.push('two'); }, 'two');
await kernel.message.sendLocalBlocking('ORDER', {}, ' one ');
export const result = deliveries;`, ["one"]),
    observed("event and message runtime metadata replaces asserted time identity and scope", kernelBoot() + `
const submitted = { timestamp: -1, instanceId: 'claimed', scope: 'broker', correlationId: 'correlation', sourceType: 'producer' };
const received = [];
const inspect = item => { received.push({ timestamp: item.ctx.timestamp > 0,
  identity: item.ctx.instanceId === kernel.settings.getSetting('instanceId'), scope: item.ctx.scope,
  correlationId: item.ctx.correlationId, sourceType: item.ctx.sourceType }); };
kernel.event.subscribe(async item => inspect(item), 'ORDER');
kernel.message.registerHandler(async item => inspect(item), 'orders');
await kernel.event.raiseLocalBlocking({ eventType: 'ORDER', ctx: submitted });
await kernel.message.sendLocalBlocking('ORDER', {}, 'orders', submitted);
export const result = { received, originalTime: submitted.timestamp, originalIdentity: submitted.instanceId };`, {
      received: [0, 1].map(() => ({ timestamp: true, identity: true, scope: "local", correlationId: "correlation", sourceType: "producer" })),
      originalTime: -1, originalIdentity: "claimed",
    }),
  ];
}

function ownershipCases(): Example[] {
  return [
    { name: "event listener reference cannot own two channels", text: kernelBoot() + `
const listener = async () => {};
kernel.event.subscribe(listener, 'FIRST'); kernel.event.subscribe(listener, 'SECOND');`, findings: [],
      error: /listener already subscribed/, coverage: "runtime-only" },
    { name: "message peer ownership uses the trimmed address", text: kernelBoot() + `
kernel.message.registerHandler(async () => {}, 'orders');
kernel.message.registerHandler(async () => {}, ' orders ');`, findings: [],
      error: /handler peer already registered/, coverage: "runtime-only" },
    observed("distinct event closures may share a display label and still own separate subscriptions", kernelBoot() + `
let delivered = 0;
kernel.event.subscribe(async () => { delivered++; }, 'ORDER', 'same');
kernel.event.subscribe(async () => { delivered++; }, 'ORDER', 'same');
await kernel.event.raiseLocalBlocking(${event});
const ids = kernel.event.listSubscriptions('ORDER').map(item => item.subscriptionId);
export const result = { delivered, distinct: new Set(ids).size };`, { delivered: 2, distinct: 2 }),
    observed("blank message peers generate distinct anonymous addresses", kernelBoot() + `
kernel.message.registerHandler(async () => {}, ''); kernel.message.registerHandler(async () => {}, ' ');
const peers = kernel.message.listSubscriptions().filter(item => !item.handlerId.startsWith('__')).map(item => item.peer);
export const result = { nonempty: peers.every(peer => peer.length > 0), distinct: new Set(peers).size };`, { nonempty: true, distinct: 2 }),
  ];
}

function exceptionCases(): Example[] {
  return [
    observed("exception report returns undefined and execution continues", kernelBoot() + `
const returned = kernel.exception.report({ message: 'report', code: 'CODE' });
let continued = true;
export const result = { returned: returned === undefined, continued };`, { returned: true, continued: true }),
    observed("legacy quiet exception returns without throwing", kernelBoot() + `
let continued = false; kernel.exception.throw('quiet', 'quiet'); continued = true;
export const result = continued;`, true),
    ...["undefined", "'loud'", "new (class Caller {})()"].map(source => ({
      name: `exception throw ${source} actually terminates the call`, text: kernelBoot() + `kernel.exception.throw('failure', ${source});`,
      findings: [], error: /Exception:.*failure/, coverage: "runtime-only" as const,
    })),
  ];
}

export function deliveryCases(): Example[] {
  return [...localDeliveryCases(), ...brokerCases(), ...fallbackCases(), ...routingCases(), ...ownershipCases(), ...exceptionCases()];
}

export function deliveryEvidence(observations: { name: string }[]) {
  return contract.requirements.map(rule => ({ id: rule.id, canaries: rule.canaries.map(name => {
    const matches = observations.filter(observation => observation.name === name);
    if (matches.length !== 1) throw new Error(`${rule.id}: expected exactly one completed source canary: ${name}`);
    return name;
  }) }));
}
