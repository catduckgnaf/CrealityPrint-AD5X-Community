import {describe,it,expect,vi} from "vitest";
vi.mock("../state/store",()=>({useScene:{getState:()=>({}),setState:()=>{}}}));
import {shellParts} from "./advancedModels";
import {type GroupNode,type Project} from "../types/scene";
import {basicBox} from "./boxFitTools";
import {collectTrayWalls,compartmentAt,planPartialDivider,planAddPartial,
 drillJigParts,cableOpening,enclosurePosts,jigDrillExisting,planShellFeature,shellReport} from "./workshopTools";
import {consolidateDividerLayers,deleteAllDividerLayers} from "./dividerInteraction";
import menu from "../components/SmartContextMenu.tsx?raw";
import viewport from "../components/Viewport.tsx?raw";
import app from "../App.tsx?raw";
import panel from "../components/WorkshopTools.tsx?raw";

const group=(id:string,label:string,ids:string[]):GroupNode=>({
 id,type:"group",label,childIds:ids,position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]
});
function shell(){
 const [outer,cavity]=shellParts(150,160,22,2,2);
 const n=group("shell","Hollow box",[outer.id,cavity.id]);
 const p:Project={id:"test",name:"test",version:1,rootOrder:["shell"],
  nodes:{[outer.id]:outer,[cavity.id]:cavity,[n.id]:n}};
 return {p,outer,cavity,n};
}
function divided(){
 const f=shell();
 const h=basicBox(146.65,1.6,18.5,0,0,10.75);
 h.label="Widthwise divider";
 const wrapper=group("dividers","Box with dividers",[f.n.id,h.id]);
 f.p.rootOrder=[wrapper.id];f.p.nodes[h.id]=h;f.p.nodes[wrapper.id]=wrapper;
 return {...f,h,wrapper};
}
describe("v19.5.11 workshop trays / boxes / jigs geometry",()=>{
 it("finds exact open compartment faces across existing full-width divider",()=>{
  const f=divided(),snap=JSON.stringify(f.p);
  const c=compartmentAt(f.p,f.wrapper.id,[24,40]);
  expect(c).toEqual({xMin:-73,xMax:73,yMin:0.8,yMax:78,width:146,depth:77.2});
  expect(collectTrayWalls(f.p,f.wrapper.id).map(x=>x.id)).toEqual([f.h.id]);
  expect(()=>compartmentAt(f.p,f.wrapper.id,[3,0])).toThrow(/existing divider/);
  expect(JSON.stringify(f.p)).toBe(snap);
 });
 it("places short wall against nearest crossing divider, creating real T junction",()=>{
  const f=divided();
  const n=planPartialDivider(f.p,f.wrapper.id,"x",[25,40]);
  expect(n.label).toBe("Partial lengthwise divider");
  expect(n.params.w).toBe(1.6);
  expect(n.params.d).toBeCloseTo(77.85,5);
  expect(n.position).toEqual([25,39.4,10.75]);
  expect(n.params.h).toBe(18.5);
  const edited=planAddPartial(f.p,f.wrapper.id,"x",[25,40]);
  expect(edited.selectionId).toBe(f.wrapper.id);
  expect(edited.project.rootOrder).toEqual(f.p.rootOrder);
  expect((edited.project.nodes[f.wrapper.id] as GroupNode).childIds).toEqual([f.n.id,f.h.id,edited.shapeId]);
  expect((edited.project.nodes[f.n.id] as GroupNode).childIds).toEqual([f.outer.id,f.cavity.id]);
  expect(edited.project.nodes[f.cavity.id]).toBe(f.cavity);
 });
 it("uses first short wall to limit the neighbouring T divider in the other direction",()=>{
  const f=divided();
  const a=planAddPartial(f.p,f.wrapper.id,"x",[25,40]);
  const b=planPartialDivider(a.project,f.wrapper.id,"y",[44,32]);
  expect(b.label).toBe("Partial widthwise divider");
  expect(b.params.d).toBe(1.6);
  expect(Number(b.params.w)).toBeCloseTo(47.85,2);
  expect(b.position[0]).toBeCloseTo(49.4,2);
  expect(b.position[1]).toBe(32);
  const c=compartmentAt(a.project,f.wrapper.id,[44,32]);
  expect(c.xMin).toBeCloseTo(25.8);
  expect(c.xMax).toBe(73);
 });
 it("refuses invalid clicks, narrow gaps and custom cut nodes without mutation",()=>{
  const f=divided(),before=JSON.stringify(f.p);
  expect(()=>planPartialDivider(f.p,f.wrapper.id,"x",[100,40])).toThrow();
  expect(()=>planPartialDivider(f.p,f.wrapper.id,"x",[72,40])).toThrow(/2 mm/);
  expect(()=>planPartialDivider(f.p,f.wrapper.id,"y",[1,0])).toThrow();
  expect(()=>planPartialDivider(f.p,f.wrapper.id,"x",[NaN,20])).toThrow();
  expect(JSON.stringify(f.p)).toBe(before);
 });
 it("deletes generated partial divider with nested wrapper cleanup, preserving shell and label cutters",()=>{
  const f=divided();
  const plan=planAddPartial(f.p,f.wrapper.id,"x",[25,40]);
  const extra=group("upper","Box with dividers",[f.wrapper.id]);
  const project:Project={...plan.project,rootOrder:[extra.id],nodes:{...plan.project.nodes,[extra.id]:extra}};
  expect(consolidateDividerLayers(project,extra.id).removedWrappers).toBe(1);
  const cleared=deleteAllDividerLayers(project,extra.id);
  expect(cleared.removed).toBe(2);
  expect(cleared.project.nodes[f.cavity.id]).toBe(f.cavity);
  expect(cleared.project.nodes[f.outer.id]).toBe(f.outer);
  expect(cleared.project.nodes[plan.shapeId]).toBeUndefined();
  expect(cleared.project.nodes[f.h.id]).toBeUndefined();
 });
 it("creates 4 additive posts and 4 blind bores without touching source shell",()=>{
  const f=shell(),before=JSON.stringify(f.p);
  const parts=enclosurePosts(f.p,f.n.id,8,3.2,10);
  expect(parts).toHaveLength(8);
  expect(parts.filter(x=>x.role==="solid")).toHaveLength(4);
  expect(parts.filter(x=>x.role==="hole")).toHaveLength(4);
  for(const n of parts)expect(n.position[2]).toBeGreaterThan(1.5);
  const edited=planShellFeature(f.p,f.n.id,parts,"Enclosure features");
  expect(edited.project.rootOrder).toHaveLength(1);
  expect(edited.added).toBe(8);
  expect(edited.project.nodes[f.cavity.id]).toBe(f.cavity);
  expect((edited.project.nodes[edited.selectionId] as GroupNode).childIds[0]).toBe(f.n.id);
  expect(JSON.stringify(f.p)).toBe(before);
 });
 it("rejects mounting post collision with an existing divider",()=>{
  const f=divided();
  const extra=basicBox(1.6,156.65,18.5,-68.5,0,10.75);
  f.p.nodes[extra.id]=extra;(f.p.nodes[f.wrapper.id] as GroupNode).childIds.push(extra.id);
  expect(()=>enclosurePosts(f.p,f.wrapper.id,8,3.2,10)).toThrow(/intersects/);
 });
 it("cuts a wall opening completely through only the requested enclosure side",()=>{
  const f=shell();
  const front=cableOpening(f.p,f.n.id,"front",12,6,10,4)[0];
  expect(front.role).toBe("hole");
  expect(front.params.w).toBe(12);expect(front.params.d).toBe(4);
  expect(front.position).toEqual([10,-80,9]);
  const right=cableOpening(f.p,f.n.id,"right",10,7,-8,3)[0];
  expect(right.position).toEqual([75,-8,8.5]);
  expect(right.params.w).toBe(4);
  expect(()=>cableOpening(f.p,f.n.id,"left",12,50,0,2)).toThrow();
  expect(()=>cableOpening(f.p,f.n.id,"back",40,6,65,4)).toThrow();
 });
 it("creates an editable jig with patterned bore cutters and fused locating fence",()=>{
  const o={width:100,depth:70,height:8,diameter:4,columns:3,rows:2,pitchX:30,pitchY:25,fence:true};
  const parts=drillJigParts(o);
  expect(parts).toHaveLength(8);
  expect(parts.filter(x=>x.role==="hole")).toHaveLength(6);
  expect(parts.filter(x=>x.role==="solid")).toHaveLength(2);
  expect(parts[0].label).toBe("Jig base plate");
  expect(parts[1].label).toBe("Back locating fence");
  expect(parts.at(-1)?.position[2]).toBe(4);
  expect(()=>drillJigParts({...o,columns:9})).toThrow();
  expect(()=>drillJigParts({...o,pitchX:50})).toThrow();
 });
 it("supports hole grid in existing solid box but refuses hollow group",()=>{
  const f=shell();
  f.p.rootOrder=[f.outer.id];
  const cutters=jigDrillExisting(f.p,f.outer.id,4,2,2,30,30);
  expect(cutters).toHaveLength(4);
  expect(cutters.every(x=>x.role==="hole")).toBe(true);
  expect(()=>jigDrillExisting(f.p,f.n.id,4,2,2,30,30)).toThrow();
  expect(()=>jigDrillExisting(f.p,f.outer.id,5,3,2,300,30)).toThrow();
 });
 it("reports exact nominal compartment dimensions without mutating nodes",()=>{
  const f=divided(),before=JSON.stringify(f.p);
  const m=shellReport(f.p,f.wrapper.id,[20,40]);
  expect(m.outside).toEqual([150,160,22]);
  expect(m.inside).toEqual([146,156]);
  expect(m.compartment.depth).toBeCloseTo(77.2);
  expect(JSON.stringify(f.p)).toBe(before);
 });
 it("integrates right-click menu, native partial placement, and three workbench tabs",()=>{
  expect(menu).toContain("Place partial lengthwise divider (click)");
  expect(menu).toContain("Enclosure posts & cable openings...");
  expect(menu).toContain("New drilling jig...");
  expect(menu).toContain("Jig drill pattern...");
  expect(viewport).toContain("planPartialDivider(project,manualDivider.rootId");
  expect(viewport).toContain("partial?addPartialDivider");
  expect(app).toContain("<WorkshopTools />");
  expect(panel).toContain("Create new drilling jig");
  expect(panel).toContain("Cut cable opening");
 });
});
