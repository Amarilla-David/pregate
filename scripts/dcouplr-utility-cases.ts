// Observe actual public conversions and distinguish priority declarations from implementations.
import type { Example } from "./dcouplr-source-probe.ts";
import contract from "../packs/dcouplr/UTILITY-RUNTIME-CONTRACT.json" with { type: "json" };

const imports = "import * as publicAPI from 'dcouplr'; const {tools,QueuePriorities}=publicAPI;\n";
const observed = (name: string, body: string, result: unknown, extension?: "ts"): Example =>
  ({name,text:imports+body,result,extension,findings:[],coverage:"runtime-only"});

function compatibilityCases(): Example[] {
  return [
    observed("compatibility is coercion-compatible while false text converts to true", `
export const result=[tools.TypeCompatibilityCheck('12','number'),tools.TypeCompatibilityCheck('false','boolean'),tools.DCast('false','boolean'),tools.DCast('no','boolean')];`, [true,true,true,true]),
    observed("array compatibility checks the first element instead of the full collection", `
export const result=[tools.TypeCompatibilityCheck([1,'wrong'],'number[]'),tools.TypeCompatibilityCheck(['wrong',1],'number[]')];`, [true,false]),
    observed("object compatibility matches keys without admitting field values", `
export const result=[tools.TypeCompatibilityCheck({amount:'wrong'},'{amount}'),tools.TypeCompatibilityCheck({amount:2,extra:true},'{amount}')];`, [true,false]),
    observed("bigint conversion to number can lose integer precision", `
const value=tools.DCast(9007199254740993n,'number'); export const result={value,equal:BigInt(value)===9007199254740993n};`, {value:9007199254740992,equal:false}),
    observed("conversion target order chooses the first successful representation", `
export const result=[tools.DCast('12',['string','number']),tools.DCast('12',['number','string'])];`, ["12",12]),
    observed("declared generic does not control the runtime cast target", `
const value=tools.DCast<string>('12','number'); export const result={value,type:typeof value};`, {value:12,type:"number"}, "ts"),
    observed("compatibility recursion requires an owned input depth budget", `
const value={};value.next=value;let failure;try{tools.TypeCompatibilityCheck(value,'object');}catch(error){failure=error.name;}
export const result={failure,bounded:tools.TypeCompatibilityCheck(value,'object',0)};`, {failure:"RangeError",bounded:true}),
    observed("bigint target does not use general numeric coercion", `
export const result=['12',12,12n].map(value=>String(tools.DCast(value,'bigint','fallback')));`, ["fallback","fallback","12"]),
  ];
}

function fallbackCases(): Example[] {
  return [
    observed("nullish cast input is returned even for a number target", `
export const result={null:tools.DCast(null,'number'),undefined:tools.DCast(undefined,'number')===undefined};`, {null:null,undefined:true}),
    observed("fallback is returned without conversion or ownership isolation", `
const fallback={value:'original'},result=tools.DCast('wrong','number',fallback); fallback.value='changed';
export const resultValue={same:result===fallback,value:result.value,primitive:tools.DCast('wrong','number','uncast')};
export {resultValue as result};`, {same:true,value:"changed",primitive:"uncast"}),
    {name:"invalid target configuration rejects before applying fallback",text:imports+"tools.DCast(null, [undefined], 'fallback');",findings:[],error:/undefined in toType/,coverage:"runtime-only"},
    {name:"undefined fallback does not suppress an unsupported conversion",text:imports+"tools.DCast('wrong', 'number', undefined);",findings:[],error:/couldn't cast/,coverage:"runtime-only"},
    observed("cast array input converts only its first item", `
export const result=tools.DCast(['12','ignored','lost'],'number');`, 12),
    observed("empty array cast input becomes undefined", "export const result=tools.DCast([],'number')===undefined;", true),
  ];
}

function dateCases(): Example[] {
  return [
    observed("explicit date metadata gives distinct UTC interpretations of ambiguous input", `
export const result=[tools.DCast(['01/02/2024','string:dmy'],'string:ymd'),tools.DCast(['01/02/2024','string:mdy'],'string:ymd')];`, ["2024-02-01","2024-01-02"]),
    observed("explicit date parsing rejects an invalid calendar date", `
export const result=tools.DCast(['31/02/2024','string:dmy'],'date','rejected');`, "rejected"),
    observed("explicit ymd metadata preserves a valid leap day and rejects an invalid one", `
export const result=[tools.DCast(['2024-02-29','string:ymd'],'string:ymd'),tools.DCast(['2023-02-29','string:ymd'],'date','rejected')];`, ["2024-02-29","rejected"]),
    observed("unknown date metadata silently uses mdy interpretation", `
export const result=tools.DCast(['01/02/2024','unexpected-format'],'string:ymd');`, "2024-01-02"),
    observed("date conversion retains the mutable input Date by identity", `
const input=new Date('2024-02-01T00:00:00Z'),converted=tools.DCast(input,'date'); input.setUTCFullYear(2000);
export const result={same:input===converted,year:converted.getUTCFullYear()};`, {same:true,year:2000}),
    observed("invalid Date can escape a date target or throw before string fallback", `
const input=new Date(NaN),converted=tools.DCast(input,'date','fallback');let failure;
try{tools.DCast(input,'string','fallback');}catch(error){failure=error.name;}
export const result={same:converted===input,invalid:Number.isNaN(converted.getTime()),failure};`, {same:true,invalid:true,failure:"RangeError"}),
  ];
}

function fieldCases(): Example[] {
  return [
    observed("field helpers distinguish nullish defaults from valid falsy values differently", `
export const result=[0,false,'',null,undefined].map(value=>({defaulted:tools.withDefaultValue({value},'value','fallback'),straightMissing:tools.straightValue({value},'value')===undefined}));`,
      [{defaulted:0,straightMissing:true},{defaulted:false,straightMissing:true},{defaulted:"",straightMissing:true},{defaulted:"fallback",straightMissing:true},{defaulted:"fallback",straightMissing:true}]),
    observed("field helpers admit inherited fields and retain object references", `
const value={id:'original'},input=Object.create({value}),fallback={id:'fallback'};
const defaulted=tools.withDefaultValue(input,'value',fallback),straight=tools.straightValue(input,'value');value.id='changed';
export const result={defaultSame:defaulted===value,straightSame:straight===value,value:straight.id,fallbackSame:tools.withDefaultValue({},'value',fallback)===fallback};`,
      {defaultSame:true,straightSame:true,value:"changed",fallbackSame:true}),
    observed("field default helper does not check expected types and applies only its callback", `
export const result={untyped:tools.withDefaultValue({value:'wrong'},'value',0),transformed:tools.withDefaultValue({value:2},'value',0,value=>value*3),absent:tools.withDefaultValue({},'value',0,()=>99)};`,
      {untyped:"wrong",transformed:6,absent:0}),
    {name:"field callback failures propagate instead of returning the default",text:imports+"tools.withDefaultValue({value:2},'value',0,()=>{throw new Error('callback failed');});",error:/callback failed/,findings:[],coverage:"runtime-only"},
    observed("straight field access rejects missing dictionaries or fields", `
let rejected=0;for(const input of [null,undefined,{},7]){try{tools.straightValue(input,'value');}catch{rejected++;}}export const result=rejected;`, 4),
  ];
}

const queueBoot = `const {setupDcouplr,getDcouplr}=publicAPI;
const logger={child(){return this;},isLevelEnabled:()=>true,trace(){},debug(){},info(){},warn(){},error(){},fatal(){}};
setupDcouplr({charEncoding:'UTF-8',systemDependencies:{Logger:{__semanticIdentifier:'UTILITY_LOGGER',create:()=>logger}}});
const queue=getDcouplr().resolve('I_QUEUE',{queueId:'priority-contract',segmentCapacity:4,maxSegments:1,persistence:{enabled:false,mode:'leading',aotMs:1000,maxPendingOps:4}});
`;

function priorityCases(): Example[] {
  return [
    observed("priority ranks are numeric and runtime values are mutable", `
const before=QueuePriorities.HIGH;let changed;try{QueuePriorities.HIGH=99;changed=QueuePriorities.HIGH;}finally{QueuePriorities.HIGH=before;}
export const result={rank:before,type:typeof before,changed,restored:QueuePriorities.HIGH};`, {rank:1,type:"number",changed:99,restored:1}),
    observed("published runtime has no priority-queue constructor or interface value", `
export const result={interfaceValue:'IPriorityQueue' in publicAPI,constructor:'DPriorityQueue' in publicAPI,toolConstructor:'DPriorityQueue' in tools,queueFactory:'PriorityQueue' in publicAPI.system.DependencyKeys};`,
      {interfaceValue:false,constructor:false,toolConstructor:false,queueFactory:false}),
    observed("built-in queue preserves FIFO regardless of payload priority", queueBoot+`
await queue.enqueue({priority:'LOW',id:'first'});await queue.enqueue({priority:'HIGH',id:'second'});
export const result=[(await queue.dequeue()).id,(await queue.dequeue()).id];`, ["first","second"]),
    observed("built-in queue stores the priority argument when called as a priority adapter", queueBoot+`
const accepted=await queue.enqueue('HIGH',{id:'lost'});export const result={accepted,stored:await queue.dequeue()};`, {accepted:true,stored:"HIGH"}),
  ];
}

export function utilityCases(): Example[] {
  return [...compatibilityCases(), ...fallbackCases(), ...dateCases(), ...fieldCases(), ...priorityCases()];
}

export function utilityEvidence(observations: {name:string}[]) {
  return contract.requirements.map(rule=>({requirement:rule.id,source:rule.source,canaries:rule.canaries.map(name=>{
    if(observations.filter(observation=>observation.name===name).length!==1)
      throw new Error(`${rule.id}: expected exactly one completed utility source canary: ${name}`);
    return name;
  })}));
}
