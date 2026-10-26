import {fixtureDir} from "./testFixturePath";
import {indexedClampParts} from "./workshopTools";
import {describe,it,expect,vi} from "vitest";
vi.mock("../state/store",()=>({useScene:{getState:()=>({}),setState:()=>{}}}));
// @ts-expect-error Vitest runs in Node; production tsconfig deliberately omits Node type declarations.
import {writeFileSync} from "node:fs";
import {type ShapeNode,type GroupNode,type Project} from "../types/scene";
import {pcbHolderParts,pcbMountingHoleParts,connectorPanelParts,connectorMeasuredPanelParts,pogoPinGuideParts,pogoMeasuredGuideParts,drillJigParts} from "./workshopTools";
const pcb={
 boardWidth:60,boardDepth:40,clearance:0.4,baseThickness:5,
 railWidth:4,railHeight:3,backStopThickness:4,backStopHeight:5,margin:5,
};
const grid={
 width:100,depth:65,height:8,diameter:4,columns:3,rows:2,pitchX:30,pitchY:25,fence:false,
};
const root=fixtureDir();
function fixture(parts:ShapeNode[],label:string,file:string){
 const id="root";
 const group:GroupNode={id,type:"group",label,
  childIds:parts.map(p=>p.id),position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]};
 const project:Project={id:"fixture",name:label,version:1,rootOrder:[id],
  nodes:{...Object.fromEntries(parts.map(p=>[p.id,p])),[id]:group}};
 writeFileSync(root+"/"+file,JSON.stringify(project,null,2),"utf8");
}
describe("v19.5.16 electronics jig geometry",()=>{
 it("PCB measured mounting bores remain editable and positioned exactly",()=>{
  const points:[number,number][]=[[-20,-10],[20,-10],[-20,10],[20,10]];
  const holes=pcbMountingHoleParts(pcb,points,3);
  expect(holes).toHaveLength(4);
  expect(holes.map(p=>p.position)).toEqual(points.map(([x,y])=>[x,y,2.5]));
  expect(holes.every(p=>p.role==="hole"&&p.kind==="cylinder"&&p.params.r===1.5&&p.params.h===7)).toBe(true);
  expect(holes.every(p=>p.label?.startsWith("PCB mounting bore"))).toBe(true);
  fixture([...pcbHolderParts(pcb),...holes],"PCB holder with measured bores","PCB_MOUNTING_ALIGNED_FIXTURE.json");
 });
 it("rejects unmeasured, overlapping, out-of-board and non-finite PCB holes",()=>{
  expect(()=>pcbMountingHoleParts(pcb,[],3)).toThrow(/1 to 32/);
  expect(()=>pcbMountingHoleParts(pcb,[[30,0]],3)).toThrow(/outside/);
  expect(()=>pcbMountingHoleParts(pcb,[[0,0],[2,0]],3)).toThrow(/spacing/);
  expect(()=>pcbMountingHoleParts(pcb,[[NaN,0]],3)).toThrow(/finite/);
  expect(()=>pcbMountingHoleParts(pcb,[[0,0]],0)).toThrow();
  expect(()=>pcbMountingHoleParts({...pcb,boardWidth:210},[[0,0]],3)).toThrow();
 });

 it("builds PCB edge holder with four additive editable solids and exact board aperture",()=>{
  const parts=pcbHolderParts(pcb),[base,left,right,back]=parts;
  expect(parts).toHaveLength(4);
  expect(parts.every(p=>p.role==="solid")).toBe(true);
  expect(base.label).toBe("PCB fixture base");
  expect(base.params.w).toBeCloseTo(78.8);
  expect(base.params.d).toBeCloseTo(54.8);
  expect(base.position).toEqual([0,2,2.5]);
  expect(left.position[0]).toBeCloseTo(-32.4);
  expect(right.position[0]).toBeCloseTo(32.4);
  expect(right.position[0]-Number(right.params.w)/2).toBeCloseTo(pcb.boardWidth/2+pcb.clearance);
  expect(back.position[1]).toBeCloseTo(22.4);
  expect(back.params.w).toBeCloseTo(68.8);
  expect(JSON.stringify(pcb)).toContain("boardWidth");
 });
 it("keeps rails and rear stop physically overlapping the base for solid fusion",()=>{
  const [base,...features]=pcbHolderParts(pcb);
  const plateTop=base.position[2]+Number(base.params.h)/2;
  for(const feature of features){
   const bottom=feature.position[2]-Number(feature.params.h)/2;
   expect(bottom).toBeLessThan(plateTop);
   expect(bottom).toBeGreaterThanOrEqual(0);
  }
  const [left,right,back]=features;
  const endOfRails=left.position[1]+Number(left.params.d)/2;
  const startBack=back.position[1]-Number(back.params.d)/2;
  expect(endOfRails).toBeGreaterThan(startBack);
  expect(right.position[0]).toBeGreaterThan(0);
 });
 it("refuses nonsensical dimensions and over-bed plates instead of scaling",()=>{
  expect(()=>pcbHolderParts({...pcb,boardWidth:210})).toThrow();
  expect(()=>pcbHolderParts({...pcb,boardWidth:190,margin:12})).toThrow(/build plate/);
  expect(()=>pcbHolderParts({...pcb,clearance:0})).toThrow();
  expect(()=>pcbHolderParts({...pcb,railHeight:NaN})).toThrow();
  expect(()=>pcbHolderParts({...pcb,margin:1})).toThrow();
 });
 it("creates explicit editable connector mounting panel without assumed component standards",()=>{
  const p=connectorPanelParts(grid);
  expect(p).toHaveLength(7);
  expect(p[0].label).toBe("Connector mounting panel");
  expect(p.filter(x=>x.role==="hole")).toHaveLength(6);
  expect(p.filter(x=>x.role==="solid")).toHaveLength(1);
  expect(p.every(x=>x.label?.includes("Connector"))).toBe(true);
  expect(p.filter(x=>x.role==="hole").every(x=>x.params.r===2)).toBe(true);
 });
 it("creates nominal pogo pin drilling guide and preserves requested spacing",()=>{
  const p=pogoPinGuideParts({...grid,diameter:1.2,columns:4,rows:2,pitchX:12,pitchY:12});
  const holes=p.filter(x=>x.role==="hole");
  expect(holes).toHaveLength(8);
  expect(p[0].label).toBe("Pogo-pin test guide plate");
  expect(holes.every(x=>x.params.r===0.6)).toBe(true);
  expect(Math.max(...holes.map(p=>p.position[0]))-Math.min(...holes.map(p=>p.position[0]))).toBe(36);
 });
 it("rejects holes with insufficient separation or outside plate and oversize drilling jig",()=>{
  expect(()=>pogoPinGuideParts({...grid,diameter:4,pitchX:5})).toThrow(/at least 2 mm/);
  expect(()=>connectorPanelParts({...grid,pitchX:60})).toThrow();
  expect(()=>drillJigParts({...grid,width:230})).toThrow();
  expect(()=>connectorPanelParts({...grid,columns:9})).toThrow();
 });
 it("exports representative editable source fixtures for independent OpenCascade STEP validation",()=>{
  fixture(pcbHolderParts(pcb),"PCB edge locating holder","PCB_HOLDER_FIXTURE.json");
  fixture(connectorPanelParts(grid),"Connector mounting panel","CONNECTOR_PANEL_FIXTURE.json");
  fixture(pogoPinGuideParts({...grid,diameter:1.2,columns:4,rows:2,pitchX:12,pitchY:12}),
   "Pogo-pin guide","POGO_GUIDE_FIXTURE.json");
  expect(true).toBe(true);
 });
});
describe("measured connector panel",()=>{
 it("uses exact bore centres and through cutters",()=>{
  const p=connectorMeasuredPanelParts(100,65,8,6,[[-20,0],[20,0]]);
  expect(p).toHaveLength(3);
  fixture(p,"Measured connector panel","CONNECTOR_MEASURED_PANEL_FIXTURE.json");
  expect(p.slice(1).map(n=>n.position)).toEqual([[-20,0,4],[20,0,4]]);
  expect(p.slice(1).every(n=>n.role==="hole"&&n.params.r===3&&n.params.h===10)).toBe(true);
 });
 it("rejects off-plate, overlapping and invalid measured bores",()=>{
  expect(()=>connectorMeasuredPanelParts(100,65,8,6,[[49,0]])).toThrow(/edge clearance/);
  expect(()=>connectorMeasuredPanelParts(100,65,8,6,[[0,0],[5,0]])).toThrow(/spacing/);
  expect(()=>connectorMeasuredPanelParts(100,65,8,6,[[NaN,0]])).toThrow();
 });
});
describe("measured pogo-pin guide",()=>{
 it("creates exact through bores in an editable JSON fixture",()=>{
  const points:[[number,number],[number,number],[number,number],[number,number]]=[[-18,0],[-6,0],[6,0],[18,0]];
  const p=pogoMeasuredGuideParts(70,30,6,1.2,points);
  expect(p).toHaveLength(5);
  expect(p.slice(1).map(n=>n.position)).toEqual(points.map(([x,y])=>[x,y,3]));
  expect(p.slice(1).every(n=>n.role==="hole"&&n.kind==="cylinder"&&n.params.r===0.6&&n.params.h===8)).toBe(true);
  fixture(p,"Measured pogo-pin guide","POGO_MEASURED_GUIDE_FIXTURE.json");
 });
 it("rejects overlaps, edge breaks, nonfinite points and oversized patterns",()=>{
  expect(()=>pogoMeasuredGuideParts(70,30,6,1.2,[[0,0],[1,0]])).toThrow(/between/);
  expect(()=>pogoMeasuredGuideParts(70,30,6,1.2,[[34,0]])).toThrow(/edge/);
  expect(()=>pogoMeasuredGuideParts(70,30,6,1.2,[[NaN,0]])).toThrow(/coordinates/);
  expect(()=>pogoMeasuredGuideParts(70,30,6,1.2,[])).toThrow(/1 to 64/);
  expect(()=>pogoMeasuredGuideParts(70,30,6,1.2,Array.from({length:65},()=>[0,0] as [number,number]))).toThrow(/1 to 64/);
 });
});
describe("experimental indexed clamp",()=>{
 it("generates fixed jaw, indexed holes and removable jaw",()=>{
  const parts=indexedClampParts({workWidth:100,workDepth:50,minOpening:12,maxOpening:72,step:10,pegDiameter:5,clearance:.3});
  expect(parts.filter(p=>p.role==="hole")).toHaveLength(7);
  expect(parts.some(p=>p.label?.includes("Removable indexed jaw"))).toBe(true);
  const peg=parts.find(p=>p.label==="Removable jaw locating peg")!;
  expect(peg.position[2]-Number(peg.params.h)/2).toBeCloseTo(0,6);
  const last=parts.filter(p=>p.role==="hole").at(-1)!;
  expect(100/2-(last.position[0]+Number(last.params.r))).toBeGreaterThanOrEqual(4);
  fixture(parts,"Experimental indexed adjustable clamp","INDEXED_CLAMP_FIXTURE.json");
 });
 it("rejects unsafe spacing and out-of-range opening",()=>{
  const o={workWidth:100,workDepth:50,minOpening:12,maxOpening:72,step:10,pegDiameter:5,clearance:.3};
  expect(()=>indexedClampParts({...o,step:6})).toThrow(/material/);
  expect(()=>indexedClampParts({...o,maxOpening:95})).toThrow(/range/);
  expect(()=>indexedClampParts({...o,minOpening:10,maxOpening:80})).toThrow(/edge/);
 });
});