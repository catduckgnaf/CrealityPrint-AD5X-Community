import {describe,it,expect,beforeEach,vi} from "vitest";
import {newId} from "./id";
import {shellParts} from "./advancedModels";
import {useScene} from "../state/store";
import {identifyShell,lidParts} from "./boxFitTools";
import {createOrganizerInserts,planOrganizerInserts,type OrganizerOptions} from "./organizerInserts";
import type {GroupNode,Project,ShapeNode} from "../types/scene";
import view from "../components/WorkshopTools.tsx?raw";
import context from "../components/SmartContextMenu.tsx?raw";
vi.mock("../state/store",()=>({useScene:{getState:vi.fn(),setState:vi.fn()}}));
let state:{project:Project;selection:string[];bed:[number,number]};
const add=(name:string,parts:ShapeNode[])=>{
 const id=newId();const group:GroupNode={id,type:"group",label:name,
  childIds:parts.map(p=>p.id),position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]};
 state.project.nodes={...state.project.nodes,...Object.fromEntries(parts.map(p=>[p.id,p])),[id]:group};
 state.project.rootOrder.push(id);return id;
};
const start=()=>add("Hollow box",shellParts(80,60,30,2,3));
const opt:OrganizerOptions={cols:2,rows:2,gap:.35,wall:1.6,floor:1.6,topGap:1,
 bedGap:6,mode:"full",col:1,row:1,spanCols:2,spanRows:1};
beforeEach(()=>{
 state={project:{id:"test",name:"Organizer test",version:1,nodes:{},rootOrder:[]},selection:[],bed:[220,220]};
 vi.mocked(useScene.getState).mockImplementation(()=>state as never);
 vi.mocked(useScene.setState).mockImplementation((arg:any)=>{state={...state,...(typeof arg==="function"?arg(state):arg)};});
});
describe("v19.5.15 grid-compatible removable bins",()=>{
 it("calculates a 2x2 grid from inside cavity, prints four individually removable hollow groups",()=>{
  const id=start(),shell=identifyShell(id,state.project);
  const old=JSON.stringify(state.project.nodes[id]);
  const plan=planOrganizerInserts(state.project,id,state.bed,opt);
  expect(plan.cellWidth).toBe(38);expect(plan.cellDepth).toBe(28);
  expect(plan.bins).toHaveLength(4);
  for(const bin of plan.bins){
   expect(bin.outside.params.w).toBeCloseTo(37.3);
   expect(bin.outside.params.d).toBeCloseTo(27.3);
   expect(bin.outside.params.h).toBe(26);
   expect(bin.inside.params.w).toBeCloseTo(34.1);
   expect(bin.inside.params.d).toBeCloseTo(24.1);
   expect(bin.outside.position[2]-13).toBeCloseTo(0);
   expect(bin.inside.position[2]-Number(bin.inside.params.h)/2).toBeCloseTo(1.6);
   expect(bin.group.childIds).toEqual([bin.outside.id,bin.inside.id]);
   expect(bin.inside.role).toBe("hole");
   expect(bin.outside.role).toBe("solid");
  }
  expect(JSON.stringify(state.project.nodes[id])).toBe(old);
  expect(shell.width).toBe(80);
  expect(state.project.rootOrder).toEqual([id]);
  const created=createOrganizerInserts(id,opt);
  expect(created.bins).toHaveLength(4);
  expect(state.project.rootOrder).toHaveLength(5);
  expect(state.selection).toHaveLength(4);
  expect(state.project.nodes[id]).toBeDefined();
 });
 it("supports one 1x2 or 2x2 bin and rejects spans past last cell",()=>{
  const id=start();
  const one=planOrganizerInserts(state.project,id,state.bed,{...opt,mode:"span",spanCols:1,spanRows:2});
  expect(one.bins).toHaveLength(1);
  expect(one.bins[0].outside.params.w).toBeCloseTo(37.3);
  expect(one.bins[0].outside.params.d).toBeCloseTo(55.3);
  const all=planOrganizerInserts(state.project,id,state.bed,{...opt,mode:"span",spanCols:2,spanRows:2});
  expect(all.bins[0].outside.params.w).toBeCloseTo(75.3);
  expect(all.bins[0].outside.params.d).toBeCloseTo(55.3);
  expect(()=>planOrganizerInserts(state.project,id,state.bed,{...opt,mode:"span",col:2,spanCols:2})).toThrow(/beyond/);
 });
 it("creates a mixed layout: one 1x2 bin and two 1x1 bins in a 2x2 grid",()=>{
  const id=start();const plan=planOrganizerInserts(state.project,id,state.bed,
   {...opt,mode:"mixed",spanCols:1,spanRows:2});
  expect(plan.bins).toHaveLength(3);
  expect(plan.bins.filter(x=>x.spanRows===2&&x.spanCols===1)).toHaveLength(1);
  expect(plan.bins.filter(x=>x.spanRows===1&&x.spanCols===1)).toHaveLength(2);
  const coords=new Set(plan.bins.map(x=>`${x.col},${x.row}:${x.spanCols}x${x.spanRows}`));
  expect(coords.has("0,0:1x2")).toBe(true);
  expect(coords.has("1,0:1x1")).toBe(true);
  expect(coords.has("1,1:1x1")).toBe(true);
 }); it("preserves a corner-specific cavity without rounding internal bin junctions",()=>{
  const id=start();const sh=identifyShell(id,state.project);
  sh.outer.params.edges="8@3,9@5,10@9,11@12";
  sh.cavity.params.edges="8@1,9@3,10@7,11@10";
  const plan=planOrganizerInserts(state.project,id,state.bed,opt);
  const one=plan.bins.find(b=>b.col===0&&b.row===0)!;
  expect(one.outside.params.edges).toBe("8@0.65");
  const last=plan.bins.find(b=>b.col===1&&b.row===1)!;
  expect(String(last.outside.params.edges)).toContain("11@9.65");
  expect(String(one.inside.params.edges??"")).toBe("");
 });
 it("packs clear of an existing matching lid, and refuses if no plate room",()=>{
  const id=start();
  const lid=lidParts(identifyShell(id,state.project),{clearance:.3,thickness:2.4,lipDepth:4,
   lipWall:1.5,overhang:.5,bedGap:12});
  add("Matching lid",lid);
  const plan=planOrganizerInserts(state.project,id,state.bed,opt);
  expect(plan.layout[1]).toBeLessThan(0);
  expect(()=>planOrganizerInserts(state.project,id,[90,90],opt)).toThrow(/build-plate/);
 });
 it("refuses invalid grid sizes, thin wall, shallow bin and a rotated parent with no writes",()=>{
  const id=start(),prev=JSON.stringify(state.project);
  expect(()=>createOrganizerInserts(id,{...opt,cols:9})).toThrow();
  expect(()=>createOrganizerInserts(id,{...opt,gap:0})).toThrow();
  expect(()=>createOrganizerInserts(id,{...opt,wall:20})).toThrow();
  expect(()=>createOrganizerInserts(id,{...opt,topGap:28})).toThrow();
  expect(JSON.stringify(state.project)).toBe(prev);
  (state.project.nodes[id] as GroupNode).rotation=[0,0,.2];
  expect(()=>createOrganizerInserts(id,opt)).toThrow();
 });
 it("exposes the tool from the right-click menu and workshop interface",()=>{
  expect(view).toContain('tab==="Organizer"');
  expect(view).toContain("Create removable inserts");
  expect(view).toContain("Columns wide");
  expect(context).toContain("Removable organizer inserts...");
 });
});
