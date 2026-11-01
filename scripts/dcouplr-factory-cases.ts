// Observe actual creation and ownership in the integrity-pinned published runtime.
import type { Example } from "./dcouplr-source-probe.ts";
import contract from "../packs/dcouplr/FACTORY-RUNTIME-CONTRACT.json" with { type: "json" };

const boot = (mode = "run") => `import {setupDcouplr,getDcouplr,resetDcouplrForTesting} from 'dcouplr';
setupDcouplr({charEncoding:'UTF-8',mode:'${mode}',ephemeral:true}); const app=getDcouplr();\n`;
const stage = (creator: string, shape = "{}", verification = "") => `app.dependencyAdmission.declareIntent('OWNED')
.addMandatoryInputFields(${shape}).addValidationPolicy().addVerificationPolicy(${verification}).addFactoryMethod(${creator})`;
const observed = (name: string, text: string, result: unknown): Example => ({name,text,result,path:"src/factory.test.ts",findings:[],coverage:"runtime-only"});

function bootstrapCases(): Example[] {
  return [
    {name:"runtime access before setup rejects",text:"import {getDcouplr} from 'dcouplr'; getDcouplr();",error:/not setup yet/,findings:[],coverage:"runtime-only"},
    observed("second setup keeps the first runtime and configuration", boot() + `
${stage("(_input,kernel) => ({mode:kernel.settings.getMode(),encoding:kernel.settings.getSetting('charEncoding')})")}.register();
setupDcouplr({charEncoding:'ASCII',mode:'test',ephemeral:false});
export const result={same:app===getDcouplr(),settings:app.resolve('OWNED')};`, {same:true,settings:{mode:"run",encoding:"UTF-8"}}),
    observed("system bus creation receives a restricted bootstrap placeholder", `
import {setupDcouplr} from 'dcouplr'; let captured;
setupDcouplr({charEncoding:'UTF-8',mode:'test',ephemeral:true,systemDependencies:{EventBus:{__semanticIdentifier:'CUSTOM_BUS',create:(_input,kernel)=>{
let denied=false;try{kernel.dependencies.has('OWNED');}catch(error){denied=/bootstrap placeholder access denied/.test(error.message);}
captured={denied,mode:kernel.settings.getMode(),encodingMissing:kernel.settings.getSetting('charEncoding')===undefined};
return {subscribe(){},unsubscribe(){},emit(){},emitBlocking:async()=>[]};}}}});
export const result=captured;`, {denied:true,mode:"run",encodingMissing:true}),
  ];
}

function ownershipCases(): Example[] {
  return [
    observed("transient and singleton stores admit the same identifier independently", boot() + `
${stage("() => 'transient'")}.register(); ${stage("() => 'singleton'")}.registerSingleton();
export const result={regular:app.resolve('OWNED'),singleton:app.resolveSingleton('OWNED'),kinds:app.listUserDependencies().filter(item=>item.semanticIdentifier==='OWNED').map(item=>item.kind)};`,
      {regular:"transient",singleton:"singleton",kinds:["transient","singleton"]}),
    observed("singleton presence requires the singleton lookup", boot() + `
${stage("() => ({})")}.registerSingleton(); let wrongResolver=false;try{app.resolve('OWNED');}catch{wrongResolver=true;}
export const result={regular:app.has('OWNED'),singleton:app.hasSingleton('OWNED'),wrongResolver};`, {regular:false,singleton:true,wrongResolver:true}),
    observed("duplicate registration rejects within each lifetime store", boot() + `
let regular=false,singleton=false; ${stage("() => ({})")}.register(); ${stage("() => ({})")}.registerSingleton();
try{${stage("() => ({})")}.register();}catch{regular=true;}
try{${stage("() => ({})")}.registerSingleton();}catch{singleton=true;}
export const result={regular,singleton};`, {regular:true,singleton:true}),
    observed("transients recreate while singletons retain identity", boot() + `
let created=0; ${stage("() => ({id:++created})")}.register();
const first=app.resolve('OWNED'),second=app.resolve('OWNED'); ${stage("() => ({id:++created})")}.registerSingleton();
const shared=app.resolveSingleton('OWNED');shared.value='changed';
export const result={distinct:first!==second,cached:shared===app.resolveSingleton('OWNED'),value:app.resolveSingleton('OWNED').value,created};`,
      {distinct:true,cached:true,value:"changed",created:3}),
  ];
}

function inputCases(): Example[] {
  return [
    observed("mandatory validation rejects before the creator runs", boot() + `
let created=0; ${stage("input => {created++;return input;}", "{id:'string'}")}.register();
let rejected=false;try{app.resolve('OWNED',{});}catch{rejected=true;}
export const result={rejected,created};`, {rejected:true,created:0}),
    observed("mandatory fields accept inherited properties", boot() + `
${stage("input => input.id", "{id:'string'}")}.register();
const input=Object.create({id:'inherited'});export const result={own:Object.hasOwn(input,'id'),value:app.resolve('OWNED',input)};`, {own:false,value:"inherited"}),
    observed("mandatory shape changes affect a previously admitted factory", boot() + `
const shape={id:'string'}; ${stage("input => input.id", "shape")}.register();
const before=app.resolve('OWNED',{id:'accepted'});shape.extra='string';let rejected=false;
try{app.resolve('OWNED',{id:'accepted'});}catch{rejected=true;}export const result={before,rejected};`, {before:"accepted",rejected:true}),
    observed("singleton input copies top-level fields but retains nested references", boot() + `
const input={id:'original',nested:{value:'original'}}; ${stage("input => input")}.registerSingleton(input);
input.id='changed';input.nested.value='changed';const value=app.resolveSingleton('OWNED');
export const result={id:value.id,nested:value.nested.value,same:value===input,sameNested:value.nested===input.nested};`,
      {id:"original",nested:"changed",same:false,sameNested:true}),
  ];
}

function outputCases(): Example[] {
  return [
    observed("async creator resolution returns its promise without awaiting it", boot() + `
let completed=false; ${stage("async () => {await Promise.resolve();completed=true;return {ready:true};}")}.registerSingleton();
const returned=app.resolveSingleton('OWNED'),early=completed;const value=await returned;
export const result={thenable:typeof returned.then==='function',early,ready:value.ready,cached:returned===app.resolveSingleton('OWNED')};`,
      {thenable:true,early:false,ready:true,cached:true}),
    observed("generator creator resolution returns an unstarted iterator", boot() + `
let started=false; ${stage("function* () {started=true;yield 'ready';}")}.register();
const iterator=app.resolve('OWNED'),early=started;export const result={early,value:iterator.next().value,started};`, {early:false,value:"ready",started:true}),
    observed("false verification return does not reject creation", boot() + `
${stage("() => ({ready:true})", "{}", "() => false")}.register(); export const result=app.resolve('OWNED');`, {ready:true}),
    observed("failed singleton verification is retried instead of cached", boot() + `
let created=0; ${stage("() => ({id:++created})", "{}", "value => {if(value.id===1)throw new Error('verification rejected');}")}.registerSingleton();
let rejected=false;try{app.resolveSingleton('OWNED');}catch{rejected=true;}const admitted=app.resolveSingleton('OWNED');
export const result={rejected,id:admitted.id,cached:admitted===app.resolveSingleton('OWNED'),created};`, {rejected:true,id:2,cached:true,created:2}),
    observed("singleton null rejection does not remove its registration", boot() + `
let created=0; ${stage("() => {created++;return null;}")}.registerSingleton();let rejected=0;
for(let i=0;i<2;i++){try{app.resolveSingleton('OWNED');}catch{rejected++;}}
export const result={rejected,created,registered:app.hasSingleton('OWNED'),instantiated:app.listUserDependencies().find(item=>item.semanticIdentifier==='OWNED').instantiated};`,
      {rejected:2,created:2,registered:true,instantiated:false}),
    observed("singleton false is cached while transient null is returned", boot() + `
let created=0; ${stage("() => {created++;return false;}")}.registerSingleton(); ${stage("() => null")}.register();
export const result={singleton:app.resolveSingleton('OWNED'),cached:app.resolveSingleton('OWNED'),created,transient:app.resolve('OWNED')};`,
      {singleton:false,cached:false,created:1,transient:null}),
  ];
}

function lifetimeCases(): Example[] {
  return [
    observed("singleton force replacement leaves the old instance live and undisposed", boot("test") + `
let disposed=0; ${stage("() => ({value:'original',dispose:()=>{disposed++;}})")}.registerSingleton();const old=app.resolveSingleton('OWNED');
${stage("() => ({value:'replacement'})")}.registerSingletonForce();const current=app.resolveSingleton('OWNED');
old.value='still live';export const result={old:old.value,current:current.value,distinct:old!==current,disposed};`,
      {old:"still live",current:"replacement",distinct:true,disposed:0}),
    observed("runtime shutdown still permits resolution without disposal", boot() + `
let disposed=0; ${stage("() => ({dispose:()=>{disposed++;}})")}.registerSingleton();const old=app.resolveSingleton('OWNED');
app.shutdown();app.shutdown(); ${stage("() => 'new work'")}.register();
export const result={same:old===app.resolveSingleton('OWNED'),regular:app.resolve('OWNED'),disposed};`, {same:true,regular:"new work",disposed:0}),
    observed("test reset creates a new runtime while retained references stay live", boot("test") + `
${stage("() => ({value:'retained'})")}.registerSingleton();const old=app.resolveSingleton('OWNED');resetDcouplrForTesting();
let globalMissing=false;try{getDcouplr();}catch{globalMissing=true;}setupDcouplr({charEncoding:'UTF-8',mode:'test',ephemeral:true});
export const result={globalMissing,newRuntime:app!==getDcouplr(),retained:old===app.resolveSingleton('OWNED'),newHas:getDcouplr().hasSingleton('OWNED')};`,
      {globalMissing:true,newRuntime:true,retained:true,newHas:false}),
  ];
}

export function factoryCases(): Example[] {
  return [...bootstrapCases(), ...ownershipCases(), ...inputCases(), ...outputCases(), ...lifetimeCases()];
}

export function factoryEvidence(observations: {name:string}[]) {
  return contract.requirements.map(rule => ({requirement:rule.id,source:rule.source,canaries:rule.canaries.map(name => {
    if(observations.filter(observation => observation.name===name).length!==1)
      throw new Error(`${rule.id}: expected exactly one completed factory source canary: ${name}`);
    return name;
  })}));
}
