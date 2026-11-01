// Contrast callable system-bus admission with the actual completion contract.
import type { Example } from "./dcouplr-source-probe.ts";

export function systemBusCases(): Example[] {
  return (["event", "message"] as const).flatMap(kind => [true, false].map(returnsWork => {
    const key = kind === "event" ? "EventBus" : "MessageBus";
    const routing = kind === "event" ? "eventType" : "to";
    const subscribe = kind === "event" ? "kernel.event.subscribe(listener,'PROBE');" : "kernel.message.registerHandler(listener,'PROBE');";
    const call = kind === "event" ? "kernel.event.raiseLocalBlocking({eventType:'PROBE',payload:{}})" : "kernel.message.sendLocalBlocking('PROBE',{},'PROBE')";
    return {
      name: `custom ${kind} bus ${returnsWork ? "promise preserves" : "void breaks"} blocking completion`,
      path: "src/system-bus.test.ts", findings: [], coverage: "runtime-only" as const,
      result: {setupAccepted: true, gateCompleteBeforeRelease: !returnsWork, deliveries: 1},
      text: `import {setupDcouplr,getDcouplr} from 'dcouplr';
let release; const held=new Promise(resolve=>release=resolve); let deliveries=0;
const listeners=new Map(), pending=[];
const bus={
subscribe(channel,delegate){listeners.set(channel,[...(listeners.get(channel)??[]),delegate]);},
unsubscribe(delegate){for(const [key,values] of listeners) listeners.set(key,values.filter(value=>value!==delegate));},
emit(value,onError){for(const delegate of listeners.get(value.${routing})??[])Promise.resolve(delegate(value)).catch(error=>onError?.(error,value));},
emitBlocking(value){const work=Promise.all((listeners.get(value.${routing})??[]).map(delegate=>delegate(value)));pending.push(work);${returnsWork ? "return work;" : "return undefined;"}}
};
setupDcouplr({charEncoding:'UTF-8',mode:'test',ephemeral:true,systemDependencies:{${key}:{__semanticIdentifier:'CUSTOM_BUS',create:()=>bus}}});
const app=getDcouplr();
app.dependencyAdmission.declareIntent('OWNED').addMandatoryInputFields({}).addValidationPolicy().addVerificationPolicy().addFactoryMethod((_input,kernel)=>kernel).register();
const kernel=app.resolve('OWNED'); const listener=async()=>{deliveries++;await held;}; ${subscribe}
let gateComplete=false;const completed=${call}.then(()=>{gateComplete=true;});
await new Promise(resolve=>setTimeout(resolve,1));
const early=gateComplete;release();await completed;await Promise.all(pending);
export const result={setupAccepted:true,gateCompleteBeforeRelease:early,deliveries};`,
    };
  }));
}

export function subscriptionRegistryCases(): Example[] {
  return (["event", "message"] as const).map(kind => {
    const registry = kind === "event" ? "EventSubscriptionRegistry" : "MessageSubscriptionRegistry";
    const owner = kind === "event" ? "listenerId" : "handlerId";
    const channel = kind === "event" ? "eventType" : "peer";
    const mark = kind === "event" ? "markRaised" : "markHandled";
    const at = kind === "event" ? "lastRaisedAt" : "lastHandledAt";
    return {
      name: `${kind} subscription registry owns snapshots aggregation and removal`,
      path: "src/system-bus.test.ts", findings: [], coverage: "runtime-only" as const,
      result: {cloned:true,rows:2,first:10,last:200,markedMissing:false,removed:true,remaining:1,rebuiltFirst:20,rebuiltLast:100,removedMissing:false},
      text: `import {setupDcouplr,getDcouplr,system} from 'dcouplr';
setupDcouplr({charEncoding:'UTF-8',ephemeral:true});const app=getDcouplr();
app.dependencyAdmission.declareIntent('OWNED').addMandatoryInputFields({}).addValidationPolicy().addVerificationPolicy().addFactoryMethod((_input,kernel)=>kernel.dependencies.resolveSingleton(system.DependencyKeys.${registry})).register();
const registry=app.resolve('OWNED');
registry.add({subscriptionId:'a',${owner}:'OWNER',${channel}:'PROBE',createdAt:20});
registry.add({subscriptionId:'b',${owner}:'OWNER',${channel}:'PROBE',createdAt:10});
registry.${mark}('a',100);registry.${mark}('b',200);
const snapshot=registry.list();snapshot[0].${owner}='MUTATED';
const semantic=registry.listSemantic()[0],first=semantic.createdAt,last=semantic.${at};semantic.${owner}='MUTATED';
const cloned=registry.list()[0].${owner}==='OWNER'&&registry.listSemantic()[0].${owner}==='OWNER';
const rows=registry.list().length,markedMissing=registry.${mark}('absent',300),removed=registry.remove('b');
const rebuilt=registry.listSemantic()[0];export const result={cloned,rows,first,last,markedMissing,removed,remaining:registry.list().length,rebuiltFirst:rebuilt.createdAt,rebuiltLast:rebuilt.${at},removedMissing:registry.remove('absent')};`,
    };
  });
}
