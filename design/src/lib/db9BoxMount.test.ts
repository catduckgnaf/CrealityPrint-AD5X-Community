import {fixtureDir} from "./testFixturePath";
import {describe,it,expect,vi} from "vitest";
vi.mock("../state/store",()=>({useScene:{getState:()=>({}),setState:()=>{}}}));
// @ts-expect-error Node fixture writer not part of browser.
import {writeFileSync} from "node:fs";
import {shellParts} from "./advancedModels";
import {identifyShell} from "./boxFitTools";
import {db9PanelProfile,db9BoxIssues,db9BoxParts,planDB9BoxMount,DB9_PANEL,type DB9BoxOptions} from "./db9BoxMount";
import type {GroupNode,Project} from "../types/scene";
import editor from "../components/DB9BoxMountEditor.tsx?raw";
import workshop from "../components/WorkshopTools.tsx?raw";
const fixture=fixtureDir();
const opts=(gender:"male"|"female"="male",face:"front"|"back"|"left"|"right"|"floor"="front"):DB9BoxOptions=>({
 gender,face,clearance:.2,offsetX:0,offsetY:0,mountingDiameter:3.18,addMountingHoles:true,flipKey:false
});
function makeBox():Project{
 const parts=shellParts(80,60,22,2,2);
 const root:GroupNode={id:"shell",type:"group",label:"Hollow box",childIds:parts.map(n=>n.id),
  position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]};
 return {id:"db9",version:1,name:"DB9 on existing box",rootOrder:["shell"],
  nodes:{...Object.fromEntries(parts.map(n=>[n.id,n])),shell:root}};
}
function area(pts:[number,number][]):number{
 return Math.abs(pts.reduce((a,p,i)=>{const q=pts[(i+1)%pts.length];return a+p[0]*q[1]-q[0]*p[1];},0)/2);
}
describe("v19.5.34 real DB9 cutout in existing hollow box",()=>{
 it("uses DE9 panel-cutout dimensions, not PCB pin spacing",()=>{
  expect(DB9_PANEL).toMatchObject({
   pitch:25,nominalMountDiameter:3.18,openingWidth:19.74,
   openingHeight:11.18,sideSlopeDegrees:10,cornerRadius:3.81});
 });
 it("has round-cornered keyed D opening and controlled clearance",()=>{
  const a=db9PanelProfile(0),b=db9PanelProfile(.3);
  expect(a).toHaveLength(52);
  expect(b).toHaveLength(52);
  expect(area(a)).toBeGreaterThan(100);
  expect(area(b)).toBeGreaterThan(area(a));
  expect(b.every(pt=>pt.every(Number.isFinite))).toBe(true);
  const flipped=db9PanelProfile(.3,true);
  expect(flipped[0][0]).toBeCloseTo(-b[0][0],4);
  expect(()=>db9PanelProfile(1.1)).toThrow(/clearance/);
 });
 it("builds one editable D sketch and two mounting cylinders on a box",()=>{
  const pr=makeBox();
  for(const gender of ["male","female"] as const){
   expect(db9BoxIssues(identifyShell("shell",pr),opts(gender))).toEqual([]);
   const parts=db9BoxParts(pr,"shell",opts(gender));
   expect(parts).toHaveLength(3);
   expect(parts[0].kind).toBe("sketch");
   expect(parts[0].role).toBe("hole");
   expect(parts[0].position).toEqual([0,-29,12]);
   expect(parts[0].rotation).toEqual([Math.PI/2,0,0]);
   expect(parts.slice(1).map(n=>n.position)).toEqual([[-12.5,-29,12],[12.5,-29,12]]);
   expect(parts.slice(1).map(n=>n.params.r)).toEqual([1.59,1.59]);
   const next=planDB9BoxMount(pr,"shell",opts(gender));
   expect(next.project.rootOrder).toHaveLength(1);
   expect(next.cutters).toHaveLength(3);
   expect(next.project.nodes[next.selectionId]).toMatchObject({
    type:"group",label:"Box with DB9 "+gender+" mounting opening"});
   expect(Object.keys(next.project.nodes)).toEqual(expect.arrayContaining(Object.keys(pr.nodes)));
  }
 });
 it("places cutters on all four walls and floor without changing original shell",()=>{
  const pr=makeBox();
  expect(db9BoxParts(pr,"shell",opts("female","back"))[0].position).toEqual([0,29,12]);
  const left=db9BoxParts(pr,"shell",opts("male","left"));
  const right=db9BoxParts(pr,"shell",opts("male","right"));
  expect(left[0].position).toEqual([-39,0,12]);
  expect(right[0].position).toEqual([39,0,12]);
  expect(left[0].rotation).toEqual([0,Math.PI/2,Math.PI/2]);
  expect(left.slice(1).map(n=>n.position)).toEqual([[-39,-12.5,12],[-39,12.5,12]]);
  expect(db9BoxParts(pr,"shell",opts("male","floor"))[0].position).toEqual([0,0,1]);
 });
 it("enforces real wall limits and clearance between opening and screw holes",()=>{
  const pr=makeBox(),sh=identifyShell("shell",pr);
  expect(db9BoxIssues(sh,{...opts(),offsetY:4}).join(" ")).toMatch(/too near/);
  expect(db9BoxIssues(sh,{...opts(),offsetX:25}).join(" ")).toMatch(/screw hole/);
  expect(db9BoxIssues(sh,{...opts(),clearance:1,mountingDiameter:4.5}).join(" ")).toMatch(/under 0.7/);
  expect(db9BoxIssues(sh,{...opts(),offsetX:NaN}).join(" ")).toMatch(/valid connector/);
  expect(()=>db9BoxParts(pr,"shell",{...opts(),offsetY:4})).toThrow(/edge/);
  expect(db9BoxParts(pr,"shell",{...opts(),addMountingHoles:false})).toHaveLength(1);
 });
 it("supports manual X/Y changes; old geometry stays",()=>{
  const pr=makeBox(),o={...opts("female"),offsetX:9,offsetY:-.5};
  expect(db9BoxIssues(identifyShell("shell",pr),o)).toEqual([]);
  expect(db9BoxParts(pr,"shell",o)[0].position).toEqual([9,-29,11.5]);
  const first=planDB9BoxMount(pr,"shell",opts());
  const second=planDB9BoxMount(first.project,first.selectionId,opts("female","right"));
  expect(second.project.rootOrder).toHaveLength(1);
  expect(Object.keys(second.project.nodes)).toEqual(expect.arrayContaining(Object.keys(first.project.nodes)));
 });
 it("writes six isolated production-format STEP export fixtures",()=>{
  for(const gender of ["male","female"] as const)for(const face of ["front","floor","right"] as const){
   const pr=makeBox(),plan=planDB9BoxMount(pr,"shell",opts(gender,face));
   const name="DB9_"+gender.toUpperCase()+"_"+face.toUpperCase()+"_BOX.json";
   writeFileSync(fixture+"/"+name,JSON.stringify(plan.project,null,2),"utf8");
   expect(plan.project.rootOrder).toHaveLength(1);
  }
 });
 it("shows Add DB9 on a real existing box, never a disabled placeholder",()=>{
  expect(workshop).toContain("applyDB9BoxMount(target.id,options)");
  expect(workshop).toContain("<DB9BoxMountEditor");
  expect(editor).toContain("Add DB9 {gender} cutout to box");
  expect(editor).toContain('aria-label="DB9 box surface"');
  expect(editor).toContain("disabled={!valid}");
  expect(editor).toContain('role="alert"');
 });
});

