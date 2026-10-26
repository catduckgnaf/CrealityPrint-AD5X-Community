// @vitest-environment jsdom
import {describe,it,expect,vi} from "vitest";
vi.mock("../state/store",()=>({useScene:{getState:vi.fn(),setState:vi.fn()}}));
import {indexedScrewClampParts} from "./indexedScrewClamp";
import {indexedClampParts,planJigPlacement} from "./workshopTools";
import type {GroupNode,Project} from "../types/scene";
import {serializeSceneModel} from "./exportStl";
// @ts-expect-error Node types intentionally excluded from production tsconfig
import {writeFileSync} from "node:fs";
// @ts-expect-error Node types intentionally excluded from production tsconfig
import {resolve} from "node:path";
// @ts-expect-error Node types intentionally excluded from production tsconfig
import {cwd} from "node:process";

const options={workWidth:100,workDepth:50,minOpening:12,maxOpening:72,step:10,pegDiameter:5,clearance:.3};
function parts(){return indexedScrewClampParts(options);}
describe("Step 8: two-peg M4 adjustable clamp — CAD mechanical candidate",()=>{
 it("prints the jaw flat on the bed with upward pins, not a floating 6 mm jaw roof",()=>{
   const p=parts();
   const jaw=p.find(n=>n.label?.includes("screw clamp movable jaw"))!;
   const pins=p.filter(n=>n.label?.startsWith("Clamp locating peg "));
   expect(jaw.position[2]-Number(jaw.params.h)/2).toBeCloseTo(0,6);
   expect(pins).toHaveLength(2);
   for(const pin of pins){
     const bottom=pin.position[2]-Number(pin.params.h)/2;
     expect(bottom).toBeLessThan(jaw.position[2]+Number(jaw.params.h)/2);
     expect(pin.position[2]+Number(pin.params.h)/2).toBeGreaterThan(12);
   }
 });
 it("preserves the original single-peg generator for old project compatibility",()=>{
   const old=indexedClampParts(options);
   expect(old.filter(p=>p.role==="hole")).toHaveLength(7);
   expect(old.filter(p=>p.label==="Removable jaw locating peg")).toHaveLength(1);
 });
 it("has 2 spaced locating pegs and 2 indexed hole rows; every station is registered",()=>{
   const p=parts();
   const pins=p.filter(x=>x.label?.startsWith("Clamp locating peg "));
   expect(pins).toHaveLength(2);
   expect(pins.map(n=>n.position[1]).sort((a,b)=>a-b)).toEqual([-13,13]);
   const holes=p.filter(x=>x.label?.startsWith("Clamp station "));
   expect(holes).toHaveLength(14);
   for(let i=0;i<7;i++){
     const pair=holes.filter(x=>x.label?.startsWith("Clamp station "+(i+1)+" "));
     expect(pair).toHaveLength(2);
     expect(pair[0].position[0]).toBe(pair[1].position[0]);
     expect(pair.map(n=>n.position[1]).sort((a,b)=>a-b)).toEqual([-13,13]);
   }
   // Real angular registration is by two distinct constraints, not friction
   // on a single circular pin.
   expect(Math.abs(pins[1].position[1]-pins[0].position[1])).toBeGreaterThan(options.pegDiameter+options.clearance);
 });
 it("carries a through M4 screw clearance bore, open rear hex pocket and independent pressure pad",()=>{
   const p=parts();
   const jaw=p.find(x=>x.label?.includes("screw clamp movable jaw"))!;
   const bore=p.find(x=>x.label==="M4 clearance through movable jaw")!;
   const nut=p.find(x=>x.label?.startsWith("M4 hex nut pocket"))!;
   const pad=p.find(x=>x.label==="Separate sliding clamp pressure pad")!;
   const seat=p.find(x=>x.label==="Pressure-pad screw nose seat")!;
   expect(jaw.params.w).toBe(12);
   expect(jaw.feature).toBe("indexed-m4-clamp");
   expect(bore.role).toBe("hole");
   expect(Number(bore.params.r)*2).toBeCloseTo(4.5);
   expect(bore.rotation[1]).toBeCloseTo(Math.PI/2,6);
   expect(Number(nut.params.segments)).toBe(6);
   expect(nut.rotation[1]).toBeCloseTo(Math.PI/2,6);
   expect(nut.position[0]+Number(nut.params.h)/2).toBeGreaterThan(jaw.position[0]+6);
   expect(pad.position[2]-Number(pad.params.h)/2).toBe(0);
   expect(seat.position[2]).toBe(5);
   expect(pad.position[0]-Number(pad.params.w)/2).toBeGreaterThan(jaw.position[0]+Number(jaw.params.w)/2+3);
   const tongues=p.filter(x=>x.label?.startsWith("Sliding pad ") && x.label?.includes("guide tongue"));
   const grooves=p.filter(x=>x.label?.startsWith("Pressure-pad ") && x.label?.includes("guide groove"));
   expect(tongues).toHaveLength(2);
   expect(grooves).toHaveLength(2);
   expect(tongues.map(x=>x.position[1]).sort((a,b)=>a-b)).toEqual([-7,7]);
   expect(grooves.map(x=>x.position[1]).sort((a,b)=>a-b)).toEqual([-7,7]);
   expect(tongues.every(t=>Number(t.params.d)<Number(grooves[0].params.d))).toBe(true);
   expect(tongues.every(t=>t.position[2]-Number(t.params.h)/2>=0)).toBe(true);
 });
 it("bridges intermediate workpiece widths by a real screw travel, not by pin force",()=>{
   const fixedSurface=-options.workWidth/2+12;
   const p=parts();
   const baseHoles=p.filter(x=>x.label?.startsWith("Clamp station ")&&x.label?.includes("left bore"))
      .sort((a,b)=>a.position[0]-b.position[0]);
   const gaps=baseHoles.map(x=>x.position[0]-6-fixedSurface);
   expect(gaps).toEqual([12,22,32,42,52,62,72]);
   for(const width of [12,15,20,21,22,30,45,69,72]){
     const upper=gaps.find(g=>g>=width)!;
     expect(upper-width).toBeGreaterThanOrEqual(0);
     expect(upper-width).toBeLessThanOrEqual(10);
   }
 });
 it("keeps all three parts in printable XY layout, and allows rotated CUTTERS in placement",()=>{
   const p=parts();
   const jaw=p.find(x=>x.label?.includes("screw clamp movable jaw"))!;
   const pad=p.find(x=>x.label==="Separate sliding clamp pressure pad")!;
   expect(pad.position[0]-Number(pad.params.w)/2).toBeGreaterThan(jaw.position[0]+Number(jaw.params.w)/2+3);
   const empty:Project={id:"test",version:1,name:"Test clamp",rootOrder:[],nodes:{}};
   expect(planJigPlacement(empty,p,[220,220])).toHaveLength(2);
 });
 it("rejects unsafe fine-step, two-peg spacing, plate edge or small support margins",()=>{
   expect(()=>indexedScrewClampParts({...options,step:15,maxOpening:72})).toThrow();
   expect(()=>indexedScrewClampParts({...options,workDepth:25})).toThrow(/depth/);
   expect(()=>indexedScrewClampParts({...options,workWidth:170})).toThrow();
   expect(()=>indexedScrewClampParts({...options,maxOpening:95})).toThrow();
 });
 it("produces actual STL for base, jaw and pad from group with horizontal M4 cutters",async()=>{
   const generated=parts();
   const group:GroupNode={id:"screw-clamp",type:"group",label:"M4 screw clamp",
       childIds:generated.map(n=>n.id),position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]};
   const scene:Project={id:"test",name:"M4 clamp",version:1,rootOrder:[group.id],
     nodes:{...Object.fromEntries(generated.map(n=>[n.id,n])),[group.id]:group}};
   const result=serializeSceneModel(scene);
   expect(result.exported).toBe(1);
   expect(result.blob).not.toBeNull();
   const binary=await result.blob!.arrayBuffer();
   const v=new DataView(binary);
   expect(binary.byteLength).toBe(84+v.getUint32(80,true)*50);
   expect(v.getUint32(80,true)).toBeGreaterThan(100);
   // Save to the NEW stage only, never to the previous known-good fixtures.
   writeFileSync(resolve(cwd(),"../Acceptance_Fixtures/INDEXED_SCREW_CLAMP_FRESH.json"),JSON.stringify(scene,null,2),"utf8");
   writeFileSync(resolve(cwd(),"../Acceptance_Fixtures/INDEXED_SCREW_CLAMP_FRESH.stl"),new Uint8Array(binary));
 });
});
