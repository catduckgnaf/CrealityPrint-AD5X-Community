import {describe,it,expect,vi} from "vitest";
vi.mock("../state/store",()=>({useScene:{getState:vi.fn(),setState:vi.fn()}}));
import {workshopRegistry,enabledWorkshopJobs} from "./workshopCatalog";
import {createWorkshopRegistry} from "./workshopRegistry";
import type {WorkshopBuildContext,WorkshopBuilderPlugin} from "./workshopContract";
import type {ShapeNode} from "../types/scene";
const numbers:Record<string,number>={
 jigW:100,jigD:70,jigH:8,jigHole:4,jigCols:3,jigRows:2,jigPitchX:30,jigPitchY:25,
 pcbWidth:60,pcbDepth:40,pcbGap:.4,pcbBase:5,pcbRailWidth:4,pcbRailHeight:3,pcbStopWidth:4,pcbStopHeight:5,pcbMargin:5,pcbHoleDiameter:3,
 combCount:6,combPitch:6,combSlot:2,combSlotDepth:6,combDepth:40,combBase:5,combRidgeW:6,combRidgeH:10,combMargin:8,
 clampWidth:100,clampDepth:50,clampMin:12,clampMax:72,clampStep:10,clampPeg:5,clampClearance:.3,
 cradleWidth:12,cradleDepth:22,cradleGap:.4,cradleBase:5,cradleRailW:4,cradleRailH:7,cradleStopW:4,cradleStopH:6,cradleMargin:8
};
const context=(extra:Partial<WorkshopBuildContext>={}):WorkshopBuildContext=>({
 number:key=>{if(!(key in numbers))throw Error("Missing test dimension: "+key);return numbers[key];},
 values:{pcbHolePositions:"-10,0; 10,0",connectorPositions:"-20,0; 20,0",pogoPositions:"-18,0; -6,0; 6,0; 18,0"},
 pcbMounting:false,connectorMeasured:false,pogoMeasured:false,...extra
});
const template=(jobId:string,build:WorkshopBuilderPlugin["build"]):WorkshopBuilderPlugin=>({
 apiVersion:1,id:"test."+jobId,version:"1",jobId,build
});
describe("Workshop plugins extend the existing editable fixture creators",()=>{
 it("discovers six working local fixture generators, with all original eight menu jobs present",()=>{
  expect(workshopRegistry.enabledJobs).toEqual(["pcb","wire","clamp","cradle","connector","pogo"]);
  expect(enabledWorkshopJobs.map(x=>x.id)).toEqual(["banana","drill","pcb","connector","pogo","wire","cradle","clamp"]);
 });
 it("creates the same nominal jobs and a nonempty set of ordinary editable scene parts",()=>{
  const expected:Record<string,string>={
   pcb:"PCB edge locating holder",wire:"Open wire positioning comb",
   clamp:"Two-peg indexed M4 screw clamp",cradle:"Connector soldering cradle",
   connector:"Connector mounting panel",pogo:"Pogo-pin guide"
  };
  for(const [id,label] of Object.entries(expected)){
   const out=workshopRegistry.build(id,context());
   expect(out.label).toBe(label);
   expect(out.parts.length).toBeGreaterThan(1);
   expect(out.parts.every(n=>n.id&&n.role==="solid"||n.id&&n.role==="hole")).toBe(true);
   expect(new Set(out.parts.map(n=>n.id)).size).toBe(out.parts.length);
  }
 });
 it("retains measured connector/pogo positions and optional PCB mounting bores",()=>{
  const pcb=workshopRegistry.build("pcb",context({pcbMounting:true}));
  expect(pcb.label).toBe("PCB holder with mounting bores");
  expect(pcb.parts.filter(n=>n.role==="hole")).toHaveLength(2);
  const connector=workshopRegistry.build("connector",context({connectorMeasured:true}));
  expect(connector.label).toBe("Measured connector mounting panel");
  expect(connector.parts.filter(n=>n.role==="hole")).toHaveLength(2);
  const pogo=workshopRegistry.build("pogo",context({pogoMeasured:true}));
  expect(pogo.label).toBe("Measured pogo-pin guide");
  expect(pogo.parts.filter(n=>n.role==="hole")).toHaveLength(4);
 });
 it("fails safely on bad dimensions and does not mutate source values",()=>{
  const values=context();
  const existing=JSON.stringify(values.values);
  expect(()=>workshopRegistry.build("pcb",{...values,number:key=>key==="pcbWidth"?-1:values.number(key)})).toThrow();
  expect(()=>workshopRegistry.build("connector",{...values,connectorMeasured:true,values:{...values.values,connectorPositions:"bad"}})).toThrow();
  expect(JSON.stringify(values.values)).toEqual(existing);
 });
 it("disables new creation by job ID while preserving supported plug-in IDs",()=>{
  const sample=template("plugin",()=>({label:"Test",parts:[{id:"x",role:"solid"} as ShapeNode]}));
  const available=createWorkshopRegistry([sample]);
  expect(available.available("plugin")).toBe(true);
  expect(available.build("plugin",context()).label).toBe("Test");
  const disabled=createWorkshopRegistry([sample],["plugin"]);
  expect(disabled.available("plugin")).toBe(false);
  expect(disabled.get("plugin")).toBeUndefined();
  expect(()=>disabled.build("plugin",context())).toThrow("disabled or unavailable");
  expect(available.available("plugin")).toBe(true);
 });
 it("rejects duplicate IDs, duplicate job claims, invalid version and empty geometry",()=>{
  const sample=template("myjob",()=>({label:"Test",parts:[{id:"x",role:"solid"} as ShapeNode]}));
  expect(()=>createWorkshopRegistry([sample,sample])).toThrow("Duplicate");
  expect(()=>createWorkshopRegistry([sample,{...sample,id:"test.second"}])).toThrow("Duplicate");
  expect(()=>createWorkshopRegistry([{...sample,apiVersion:2} as unknown as WorkshopBuilderPlugin])).toThrow("Invalid");
  expect(()=>createWorkshopRegistry([sample],["bad ID"])).toThrow("Invalid disabled");
  expect(()=>createWorkshopRegistry([sample],["myjob","myjob"])).toThrow("Invalid disabled");
  const broken=template("broken",()=>({label:"empty",parts:[]}));
  expect(()=>createWorkshopRegistry([broken]).build("broken",context())).toThrow("no editable parts");
 });
});
