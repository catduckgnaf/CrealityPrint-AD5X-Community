import {fixtureDir} from "./testFixturePath";
import {describe,it,expect,vi} from "vitest";
vi.mock("../state/store",()=>({useScene:{getState:()=>({}),setState:()=>{}}}));
// @ts-expect-error Test-only Node file writer; the production tsconfig does not expose node types.
import {writeFileSync} from "node:fs";
import {type ShapeNode,type GroupNode,type Project} from "../types/scene";
import {wireCombParts,connectorCradleParts} from "./workshopTools";
import panel from "../components/WorkshopTools.tsx?raw";
import builders from "../extensions/workshop-plugins/electronics.plugin.ts?raw";

const comb={count:6,pitch:6,slotWidth:2,slotDepth:6,plateDepth:40,
 baseThickness:5,ridgeThickness:6,ridgeHeight:10,endMargin:8};
const cradle={bodyWidth:12,bodyDepth:22,clearance:0.4,baseThickness:5,
 railWidth:4,railHeight:7,backStopThickness:4,backStopHeight:6,margin:6};
const basePath=fixtureDir();
function exportFixture(parts:ShapeNode[],label:string,filename:string){
 const id="root";
 const group:GroupNode={id,type:"group",label,
  childIds:parts.map(p=>p.id),position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]};
 const project:Project={id:"fixture",name:label,version:1,
  rootOrder:[id],nodes:{...Object.fromEntries(parts.map(p=>[p.id,p])),[id]:group}};
 writeFileSync(basePath+"/"+filename,JSON.stringify(project,null,2),"utf8");
}

describe("v19.5.17 wire and connector positioning jigs",()=>{
 it("creates open wire guide with six editable slots and correct base dimensions",()=>{
  const parts=wireCombParts(comb);
  expect(parts).toHaveLength(8);
  expect(parts.filter(x=>x.role==="hole")).toHaveLength(6);
  expect(parts.filter(x=>x.role==="solid")).toHaveLength(2);
  expect(parts[0].params.w).toBe(48);
  expect(parts[0].params.d).toBe(40);
  expect(parts[0].params.h).toBe(5);
  expect(parts[1].label).toBe("Wire comb raised guide");
  const slots=parts.filter(x=>x.role==="hole");
  expect(slots.map(x=>x.position[0])).toEqual([-15,-9,-3,3,9,15]);
  expect(slots.every(x=>Number(x.params.w)===2)).toBe(true);
 });
 it("wire slots open through guide top and both Y faces while retaining bottom land",()=>{
  const [base,ridge,...slots]=wireCombParts(comb);
  const ridgeTop=ridge.position[2]+Number(ridge.params.h)/2;
  const ridgeBottom=ridge.position[2]-Number(ridge.params.h)/2;
  const baseTop=base.position[2]+Number(base.params.h)/2;
  expect(ridgeBottom).toBeLessThan(baseTop);
  for(const slot of slots){
   const top=slot.position[2]+Number(slot.params.h)/2;
   const bottom=slot.position[2]-Number(slot.params.h)/2;
   expect(top).toBeGreaterThan(ridgeTop);
   expect(bottom).toBeGreaterThan(baseTop);
   expect(Number(slot.params.d)).toBeGreaterThan(Number(ridge.params.d));
  }
 });
 it("supports a single slot and does not require pitch when there is one wire",()=>{
  const parts=wireCombParts({...comb,count:1,pitch:0});
  expect(parts).toHaveLength(3);
  expect(parts[0].params.w).toBe(18);
  expect(parts[2].position[0]).toBe(0);
 });
 it("rejects too many slots, insufficient web, too-deep cuts and oversized plates",()=>{
  expect(()=>wireCombParts({...comb,count:17})).toThrow();
  expect(()=>wireCombParts({...comb,pitch:3})).toThrow(/2 mm/);
  expect(()=>wireCombParts({...comb,slotDepth:9})).toThrow(/1.5 mm/);
  expect(()=>wireCombParts({...comb,count:16,pitch:15})).toThrow(/too wide/);
  expect(()=>wireCombParts({...comb,plateDepth:18,ridgeThickness:12})).toThrow(/4 mm/);
  expect(()=>wireCombParts({...comb,slotWidth:NaN})).toThrow();
 });
 it("creates 4 editable solid cradle parts with nominal body opening",()=>{
  const parts=connectorCradleParts(cradle);
  expect(parts).toHaveLength(4);
  expect(parts.every(p=>p.role==="solid")).toBe(true);
  const [base,left,right,back]=parts;
  expect(base.params.w).toBeCloseTo(32.8);
  expect(base.params.d).toBeCloseTo(38.8);
  expect(left.position[0]).toBeCloseTo(-8.4);
  expect(right.position[0]).toBeCloseTo(8.4);
  expect(right.position[0]-Number(right.params.w)/2).toBeCloseTo(6.4);
  expect(back.position[1]).toBeCloseTo(13.4);
 });
 it("cradle side rails and back stop overlap the base for one printable solid",()=>{
  const [base,...parts]=connectorCradleParts(cradle);
  const top=base.position[2]+Number(base.params.h)/2;
  for(const part of parts){
   expect(part.position[2]-Number(part.params.h)/2).toBeLessThan(top);
   expect(part.position[2]-Number(part.params.h)/2).toBeGreaterThan(0);
  }
 });
 it("rejects unreasonable body sizes, invalid clearances and over-bed parts",()=>{
  expect(()=>connectorCradleParts({...cradle,bodyWidth:3})).toThrow();
  expect(()=>connectorCradleParts({...cradle,bodyDepth:NaN})).toThrow();
  expect(()=>connectorCradleParts({...cradle,clearance:0})).toThrow();
  expect(()=>connectorCradleParts({...cradle,bodyWidth:190,margin:15})).toThrow(/build plate/);
 });
 it("keeps new controls inside existing Workshop Tools Jigs tab",()=>{
  expect(panel).toContain('<option value="wire">Open wire soldering comb</option>');
  expect(panel).toContain('<option value="cradle">Connector soldering cradle</option>');
  expect(panel).toContain("createElectronicsJig");
  expect(builders).toContain("wireCombParts(o)");
  expect(builders).toContain("connectorCradleParts(o)");
 });
 it("saves authentic editable fixtures for independent CAD and STEP verification",()=>{
  exportFixture(wireCombParts(comb),"Open wire positioning comb","WIRE_COMB_FIXTURE.json");
  exportFixture(connectorCradleParts(cradle),"Connector soldering cradle","CONNECTOR_CRADLE_FIXTURE.json");
  expect(true).toBe(true);
 });
});