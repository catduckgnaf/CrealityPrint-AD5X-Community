import {describe,it,expect,vi} from "vitest";
vi.mock("../state/store",()=>({useScene:{getState:()=>({})}}));
import {shellParts} from "./advancedModels";
import {planManualDivider,planManualDividerInsertion,dividerPlacementFloor} from "./manualDivider";
import {isGroup,type GroupNode,type Project,type ShapeNode} from "../types/scene";
import menu from "../components/SmartContextMenu.tsx?raw";
import viewport from "../components/Viewport.tsx?raw";
import sceneApiSource from "./sceneApi.ts?raw";

function fixture(w=150,d=160){
 const [outer,cavity]=shellParts(w,d,22,2,2);
 const group:GroupNode={id:"shell",type:"group",label:"Hollow box",
 childIds:[outer.id,cavity.id],position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]};
 const nested:GroupNode={id:"dividers",type:"group",label:"Box with dividers",
 childIds:[group.id],position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]};
 const label:GroupNode={id:"label",type:"group",label:"Labelled hollow box",
 childIds:[nested.id],position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]};
 const project:Project={id:"test",name:"test",version:1,rootOrder:[label.id],nodes:{
  [outer.id]:outer,[cavity.id]:cavity,[group.id]:group,[nested.id]:nested,[label.id]:label
 }};
 return {outer,cavity,group,nested,label,project};
}
describe("v19.5.9 manual divider placement in existing native Design",()=>{
 it("places one lengthwise wall where clicked, spanning the verified interior and intersecting the floor",()=>{
  const f=fixture(), before=JSON.stringify(f.project);
  const s=planManualDivider(f.project,f.label.id,"x",[19,24]);
  expect(s.role).toBe("solid");
  expect(s.kind).toBe("box");
  expect(s.params.w).toBe(1.6);
  expect(s.params.d).toBeCloseTo(156.65,8);
  expect(s.position).toEqual([19,0,10.75]);
  expect(s.params.h).toBe(18.5);
  expect(dividerPlacementFloor(f.project,f.label.id)).toBe(2);
  expect(JSON.stringify(f.project)).toBe(before);
  expect(f.group.childIds).toEqual([f.outer.id,f.cavity.id]);
  expect(f.cavity.role).toBe("hole");
 });
 it("places a widthwise divider from the clicked Y point and keeps its X centred",()=>{
  const f=fixture();
  const s=planManualDivider(f.project,f.label.id,"y",[18,-35]);
  expect(s.params.w).toBeCloseTo(146.65);
  expect(s.params.d).toBe(1.6);
  expect(s.position).toEqual([0,-35,10.75]);
  expect(f.cavity.role).toBe("hole");
 });
 it("rejects an outside click or an unusable narrow compartment with zero changes",()=>{
  const f=fixture(),snapshot=JSON.stringify(f.project);
  for(const p of [[74,0],[-90,0],[0,79],[0,-90]]){
   expect(()=>planManualDivider(f.project,f.label.id,"x",p as [number,number])).toThrow();
  }
  expect(()=>planManualDivider(f.project,f.label.id,"x",[72,0])).toThrow(/farther/);
  expect(()=>planManualDivider(f.project,f.label.id,"y",[0,-77])).toThrow(/farther/);
  expect(()=>planManualDivider(f.project,f.label.id,"x",[NaN,0])).toThrow();
  expect(JSON.stringify(f.project)).toBe(snapshot);
 });
 it("refuses locked, scaled and rotated hollow group geometry rather than changing cuts",()=>{
  const f=fixture();
  f.label.scale=[1.1,1,1];expect(()=>planManualDivider(f.project,f.label.id,"x",[0,0])).toThrow();
  f.label.scale=[1,1,1];f.label.rotation=[0,0,0.1];
  expect(()=>planManualDivider(f.project,f.label.id,"y",[0,0])).toThrow();
  f.label.rotation=[0,0,0];f.label.locked=true;
  expect(()=>planManualDivider(f.project,f.label.id,"x",[0,0])).toThrow();
  expect(f.cavity.role).toBe("hole");
 });
 it("adds successive individually placed dividers to the SAME existing Boolean divider group",()=>{
  const f=fixture(),original=JSON.stringify(f.project);
  const a=planManualDividerInsertion(f.project,f.label.id,"x",[19,5]);
  const b=planManualDividerInsertion(a.project,f.label.id,"y",[4,-12]);
  expect(a.selectionId).toBe(f.label.id);
  expect(b.selectionId).toBe(f.label.id);
  expect(b.project.rootOrder).toEqual(f.project.rootOrder);
  expect(Object.values(b.project.nodes).filter(n=>isGroup(n))).toHaveLength(3);
  const changed=b.project.nodes[f.nested.id] as GroupNode;
  expect(changed.childIds).toEqual([f.group.id,a.dividerId,b.dividerId]);
  expect((b.project.nodes[f.group.id] as GroupNode).childIds).toEqual([f.outer.id,f.cavity.id]);
  expect((b.project.nodes[f.cavity.id] as ShapeNode).role).toBe("hole");
  expect(JSON.stringify(f.project)).toBe(original);
 });
 it("wraps an initial plain shell once and adds later walls to that wrapper",()=>{
  const f=fixture();
  f.project.rootOrder=[f.group.id];
  const a=planManualDividerInsertion(f.project,f.group.id,"x",[0,0]);
  const b=planManualDividerInsertion(a.project,a.selectionId,"x",[15,0]);
  expect(b.project.rootOrder).toEqual([a.selectionId]);
  expect((b.project.nodes[a.selectionId] as GroupNode).childIds).toEqual([f.group.id,a.dividerId,b.dividerId]);
  expect((b.project.nodes[f.group.id] as GroupNode).childIds).toEqual([f.outer.id,f.cavity.id]);
  expect((b.project.nodes[f.cavity.id] as ShapeNode).role).toBe("hole");
 });
 it("uses existing Group > Add, viewport ray projection, visible cancel/Esc and one-click placement",()=>{
  expect(menu).toContain('label="Place lengthwise divider (click)"');
  expect(menu).toContain('label="Place widthwise divider (click)"');
  expect(menu).toContain('disabled={!canShell}');
  expect(menu).toContain('new CustomEvent("ad5x-manual-divider"');
  expect(viewport).toContain('function DividerFloorProjector()');
  expect(viewport).toContain('ray.setFromCamera(ndc,camera)');
  expect(viewport).toContain('sceneApi.dividerFloorPoint(clientX,clientY,z)');
  expect(viewport).toContain('addManualDivider(rootId,axis,point)');
  expect(viewport).toContain('setManualDivider(null);setManualDividerError("")');
  expect(sceneApiSource).toContain('dividerFloorPoint:');
 });
});