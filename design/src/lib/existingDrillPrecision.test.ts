import {describe,it,expect,vi} from "vitest";
// @ts-ignore Node builtin is test-only and not bundled into browser.
import {writeFileSync} from "node:fs";
vi.mock("../state/store",()=>({useScene:{getState:()=>({}),setState:()=>{}}}));
import {basicBox} from "./boxFitTools";
import {type Project, type ShapeNode,type GroupNode} from "../types/scene";
import {parseProjectFile} from "./projectFile";
import {jigDrillExisting,jigDrillExistingPositions,parseJigHolePositions,planDrillExisting} from "./workshopTools";
import panel from "../components/WorkshopTools.tsx?raw";

function plain(){
 const b=basicBox(100,70,8,13,-7,4);
 b.label="Reference solid for precision drilling";
 const project:Project={id:"precision",name:"Precision jig fixture",version:1,
  rootOrder:[b.id],nodes:{[b.id]:b}};
 return {b,project};
}
const centres=(p:ShapeNode[])=>p.map(n=>[n.position[0],n.position[1]]);
describe("v19.5.20 drilling holes in existing solid boxes",()=>{
 it("preserves previously centred grid locations when offsets omitted",()=>{
  const {b,project}=plain();
  const p=jigDrillExisting(project,b.id,4,2,2,30,20);
  expect(centres(p)).toEqual([[-2,-17],[-2,3],[28,-17],[28,3]]);
  expect(p.every(n=>n.role==="hole"&&n.params.r===2&&n.params.h===10)).toBe(true);
 });
 it("positions an offset 3x2 hole grid exactly in local X/Y box coordinates",()=>{
  const {b,project}=plain();
  const p=jigDrillExisting(project,b.id,4,3,2,25,20,5,-3);
  expect(centres(p)).toEqual([[-7,-20],[-7,0],[18,-20],[18,0],[43,-20],[43,0]]);
  expect(p.every(n=>n.position[2]===4)).toBe(true);
 });
 it("accepts exact 4mm clearance and rejects 0.001mm intrusion on every edge",()=>{
  const {b,project}=plain();
  const f=(x:number,y:number)=>jigDrillExistingPositions(project,b.id,4,[[x,y]]);
  expect(f(44,29)).toHaveLength(1);
  expect(f(-44,-29)).toHaveLength(1);
  for(const point of [[44.001,0],[-44.001,0],[0,29.001],[0,-29.001]])
   expect(()=>f(point[0],point[1])).toThrow(/4 mm/);
 });
 it("custom coordinates support signed decimal values and semicolon/newline separators",()=>{
  const points=parseJigHolePositions("-25,-12.5; 0,0\n25.25,10");
  expect(points).toEqual([[-25,-12.5],[0,0],[25.25,10]]);
  const {b,project}=plain();
  const p=jigDrillExistingPositions(project,b.id,4,points);
  expect(centres(p)).toEqual([[-12,-19.5],[13,-7],[38.25,3]]);
  expect(p.map(x=>x.label)).toEqual(["Jig drill hole 1","Jig drill hole 2","Jig drill hole 3"]);
 });
 it("refuses malformed coordinate text instead of silently ignoring holes",()=>{
  for(const bad of ["","1","1,2,3","1,hello","NaN,0","Infinity,1","1;2","1,2;;x,3"]){
   expect(()=>parseJigHolePositions(bad)).toThrow();
  }
  expect(()=>parseJigHolePositions(Array(34).fill("0,0").join(";"))).toThrow(/32/);
 });
 it("checks every pair for bores too close and duplicate positions",()=>{
  const {b,project}=plain();
  expect(()=>jigDrillExistingPositions(project,b.id,4,[[0,0],[0,0]])).toThrow(/2 mm/);
  expect(()=>jigDrillExistingPositions(project,b.id,4,[[0,0],[5.999,0]])).toThrow(/2 mm/);
  expect(jigDrillExistingPositions(project,b.id,4,[[0,0],[6,0]])).toHaveLength(2);
  expect(()=>jigDrillExistingPositions(project,b.id,25,[[44,0]])).toThrow(/4 mm/);
 });
 it("rejects nonsensical grids, NaN and invalid offsets",()=>{
  const {b,project}=plain();
  expect(()=>jigDrillExisting(project,b.id,4,9,1,20,20)).toThrow();
  expect(()=>jigDrillExisting(project,b.id,4,4,2,5,20)).toThrow(/pitch/);
  expect(()=>jigDrillExisting(project,b.id,4,2,2,30,20,NaN,0)).toThrow(/finite/);
  expect(()=>jigDrillExisting(project,b.id,4,2,2,30,20,30,0)).toThrow(/4 mm/);
  expect(()=>jigDrillExistingPositions(project,b.id,4,[[Infinity,0]])).toThrow(/finite/);
 });
 it("protects rounded, rotated, scaled, locked, hidden and grouped geometry",()=>{
  const {b,project}=plain();
  b.rotation=[0,0,0.2];
  expect(()=>jigDrillExistingPositions(project,b.id,4,[[0,0]])).toThrow(/unrotated/);
  b.rotation=[0,0,0];b.scale=[1.2,1,1];
  expect(()=>jigDrillExistingPositions(project,b.id,4,[[0,0]])).toThrow(/unrotated/);
  b.scale=[1,1,1];b.params.edges="8@3";
  expect(()=>jigDrillExistingPositions(project,b.id,4,[[0,0]])).toThrow(/rounded/);
  b.params.edges="";b.params.radius=3;
  expect(()=>jigDrillExistingPositions(project,b.id,4,[[0,0]])).toThrow(/rounded/);
  b.params.radius=0;b.locked=true;
  expect(()=>jigDrillExistingPositions(project,b.id,4,[[0,0]])).toThrow(/unrotated/);
  b.locked=false;b.hidden=true;
  expect(()=>jigDrillExistingPositions(project,b.id,4,[[0,0]])).toThrow(/unrotated/);
  b.hidden=false;project.rootOrder=[];
  expect(()=>jigDrillExistingPositions(project,b.id,4,[[0,0]])).toThrow(/unrotated/);
 });
 it("creates unchanged box and editable separate cutters in immutable Boolean group",()=>{
  const {b,project}=plain(),snapshot=JSON.stringify(project);
  const cutters=jigDrillExistingPositions(project,b.id,4,[[-20,-10],[20,-10],[0,15]]);
  const planned=planDrillExisting(project,b.id,cutters);
  expect(JSON.stringify(project)).toBe(snapshot);
  expect(planned.project.nodes[b.id]).toBe(b);
  expect(planned.project.rootOrder).toEqual([planned.selectionId]);
  const g=planned.project.nodes[planned.selectionId] as GroupNode;
  expect(g.childIds).toEqual([b.id,...cutters.map(n=>n.id)]);
  const json=JSON.stringify(planned.project);
  const reloaded=parseProjectFile(json);
  expect(reloaded.rootOrder).toEqual([planned.selectionId]);
  const group=reloaded.nodes[planned.selectionId] as GroupNode;
  expect(group.childIds).toHaveLength(4);
  expect(group.childIds.map(id=>reloaded.nodes[id]).slice(1)
   .every(node=>"role" in node&&node.role==="hole")).toBe(true);
 });
 it("actual editor tab retains grid and adds custom coordinate holes",()=>{
  expect(panel).toContain("Add positioned hole grid to selected model");
  expect(panel).toContain("Add exact coordinate holes to selected model");
  expect(panel).toContain('field("jigPositions"');
  expect(panel).toContain('parseJigHolePositions(values.jigPositions)');
 });
 it("exports separate editable test fixtures only to explicit disposable path",()=>{
  const {b,project}=plain();
  const cases=[
   ["DRILL_EXISTING_OFFSET_FIXTURE.json",jigDrillExisting(project,b.id,4,3,2,25,20,5,-3)],
   ["DRILL_EXISTING_CUSTOM_FIXTURE.json",jigDrillExistingPositions(project,b.id,4,[[-20,-10],[20,-10],[0,15]])],
  ] as const;
  for(const [file,parts] of cases){
   const planned=planDrillExisting(project,b.id,parts);
   const encoded=JSON.stringify(planned.project,null,2);
   expect(parseProjectFile(encoded).rootOrder).toHaveLength(1);
   // @ts-ignore Test runner environment only; never included in frontend.
   if(process.env.AD5X_PRECISION_FIXTURE_DIR)
    // @ts-ignore Test runner environment only.
    writeFileSync(process.env.AD5X_PRECISION_FIXTURE_DIR+"/"+file,encoded,"utf8");
  }
 });
});