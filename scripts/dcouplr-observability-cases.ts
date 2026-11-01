// Controlled observations of the integrity-pinned graph and inspector runtime.
import type { Example } from "./dcouplr-source-probe.ts";
import contract from "../packs/dcouplr/OBSERVABILITY-CONTRACT.json" with { type: "json" };

const boot = `import {setupDcouplr,getDcouplr,system,tools} from 'dcouplr';
const logger={child(){return this;},isLevelEnabled:()=>true,trace(){},debug(){},info(){},warn(){},error(){},fatal(){}};
setupDcouplr({charEncoding:'UTF-8',systemDependencies:{Logger:{__semanticIdentifier:'GRAPH_LOGGER',create:()=>logger}}});
const app=getDcouplr();
`;
const observation = (name: string, body: string, result: unknown): Example =>
  ({name,text:boot+body,result,findings:[],coverage:"runtime-only"});

function graphCases(): Example[] {
  return [
    observation("graph declarations do not prove an interaction occurred", `
app.declareInteraction('ORDERS',{emitsEventTypes:['NEVER_EMITTED']});
const graph=await app.monitor.requestGraph();
export const result={declared:graph.staticDeclarations.ORDERS.emitsEventTypes,observed:graph.observedEventEmissions.some(e=>e.eventType==='NEVER_EMITTED')};`, {declared:["NEVER_EMITTED"],observed:false}),
    observation("declaration snapshots isolate top level but retain nested metadata", `
const nested={owner:'original'};app.declareInteraction('ORDERS',{extendedInfo:{nodes:{ORDERS:{metadata:{nested}}}}});
const first=app.getInteractionDeclarations();first.ORDERS.emitsEventTypes.push('LOCAL');nested.owner='changed';
const second=app.getInteractionDeclarations();
export const result={events:second.ORDERS.emitsEventTypes,owner:second.ORDERS.extendedInfo.nodes.ORDERS.metadata.nested.owner};`, {events:[],owner:"changed"}),
    observation("an empty graph query group matches every graph node", `
app.declareInteraction('ORDERS',{usesDependencyTypes:['STORAGE']});
const full=await app.monitor.requestGraph();const queried=await app.monitor.requestGraph({query:{include:[{}]}});
export const result={nonempty:full.nodes.length>0,equal:JSON.stringify(full.nodes.map(n=>n.id).sort())===JSON.stringify(queried.nodes.map(n=>n.id).sort())};`, {nonempty:true,equal:true}),
    observation("a graph request with an unknown seed returns no nodes", `
app.declareInteraction('ORDERS',{usesDependencyTypes:['STORAGE']});
const graph=await app.monitor.requestGraph({nodeIds:['NOT_PRESENT']});export const result=graph.nodes.length;`, 0),
    observation("graph correlation accepts a matching response without validating the graph", `
app.resolveSingleton(system.DependencyKeys.InteractionObservabilityEngine).unwire();
const pending=app.monitor.requestGraph();
await app.resolveSingleton(system.DependencyKeys.EventBus).emitBlocking({eventType:system.EventTypes.InteractionGraphDataGenerated,payload:{requestId:'monitor_request_1',graph:{untrusted:true}}});
export const result=await pending;`, {untrusted:true}),
    observation("an unwired graph engine reaches its owned request timeout", `
app.resolveSingleton(system.DependencyKeys.InteractionObservabilityEngine).unwire();
const original=globalThis.setTimeout;let duration;globalThis.setTimeout=(callback,ms,...args)=>{duration=ms;return original(callback,0,...args);};
let failed;try{await app.monitor.requestGraph();}catch(error){failed=/timed out/.test(error.message);}finally{globalThis.setTimeout=original;}
export const result={duration,failed};`, {duration:5000,failed:true}),
    observation("Mermaid text is not an HTML sanitizer", `
const label='<b>customer</b>';const output=tools.interactionGraphToMermaid({nodes:[{id:'one',technicalId:'end',kind:'dependency',label}],edges:[]});
export const result={markup:output.includes(label),reserved:output.includes('end_1[')};`, {markup:true,reserved:true}),
  ];
}

const inspectorBoot = `import {startDcouplrInspector,normalizeDcouplrInspectionEvent} from 'dcouplr/inspector';
let emit,removed=0;const monitor={onActionOccurred(callback){emit=callback;return()=>{removed++;};},requestGraph:async()=>({nodes:[]})};
const app={monitor,getDependencyInformationPackage:()=>({source:'controlled'})};
`;
const inspection = (name: string, body: string, result: unknown): Example => ({name,result,findings:[],coverage:"runtime-only",text:inspectorBoot+`
const server=await startDcouplrInspector(app,{port:0,host:'127.0.0.1',announce:false,debugConsole:false,captureOnStart:true,maxEvents:2});
let result;try{${body}}finally{await server.close();}if(removed!==1)throw new Error('Observer cleanup failed');export {result};`});

function inspectorCases(): Example[] {
  return [
    inspection("inspection normalization retains secrets and shared references", `
const detail={token:'secret'};const payload={occurredAt:1,group:'control',action:'capture',activity:{subject:'canary',detail}};
const normalized=normalizeDcouplrInspectionEvent(payload,1);await emit(payload);detail.token='changed';
result={raw:normalized.raw===payload,detail:normalized.detail===detail,captured:server.events[0].detail.token};`, {raw:true,detail:true,captured:"changed"}),
    inspection("inspection event count does not bound the bytes of one event", `
await emit({occurredAt:1,group:'control',action:'capture',activity:{subject:'canary',detail:'x'.repeat(100000)}});
result={count:server.events.length,size:server.events[0].detail.length};`, {count:1,size:100000}),
    inspection("inspection exposes a mutable recording array", `
await emit({occurredAt:1,group:'control',action:'capture',activity:{subject:'canary'}});server.events.length=0;
result=(await(await fetch(server.url+'/health',{signal:AbortSignal.timeout(1000)})).json()).eventCount;`, 0),
    inspection("a cyclic inspection payload makes recording serialization fail", `
const detail={};detail.self=detail;await emit({occurredAt:1,group:'control',action:'capture',activity:{subject:'canary',detail}});
let failed=false;try{const response=await fetch(server.url+'/recording',{signal:AbortSignal.timeout(1000)});await response.json();failed=response.status!==200;}catch{failed=true;}result=failed;`, true),
    inspection("unknown inspector commands report success without changing capture", `
const response=await fetch(server.url+'/command',{method:'POST',body:JSON.stringify({command:'unknown'}),signal:AbortSignal.timeout(1000)});const body=await response.json();result={status:response.status,ok:body.ok,paused:body.paused};`, {status:200,ok:true,paused:false}),
    {name:"inspector bind failure leaves its already-created observer subscribed",findings:[],coverage:"runtime-only",result:{failed:true,removedBeforeClose:0,removedAfterClose:1},text:inspectorBoot+`
const first=await startDcouplrInspector(app,{port:0,host:'127.0.0.1',announce:false,debugConsole:false});
let result;try{let failed=false;try{await startDcouplrInspector(app,{port:Number(new URL(first.url).port),host:'127.0.0.1',announce:false,debugConsole:false});}catch(error){failed=error.code==='EADDRINUSE';}result={failed,removedBeforeClose:removed};}finally{await first.close();}result.removedAfterClose=removed;export {result};`},
  ];
}

export function observabilityCases(): Example[] { return [...graphCases(),...inspectorCases()]; }

export function observabilityEvidence(observations: {name:string}[]) {
  return contract.requirements.map(rule=>({requirement:rule.id,source:rule.source,canaries:rule.canaries.map(name=>{
    if(observations.filter(observation=>observation.name===name).length!==1)
      throw new Error(`${rule.id}: expected exactly one completed observability source canary: ${name}`);
    return name;
  })}));
}
