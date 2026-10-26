import {describe,it,expect,vi} from "vitest";
vi.mock("../state/store",()=>({useScene:{getState:()=>({})}}));
import {shellParts} from "./advancedModels";
import {makeShape} from "./primitives";
import {type Project,type GroupNode} from "../types/scene";
import {consolidateDividerLayers,deleteAllDividerLayers,dividerLayers,dividerDistanceInfo,constrainDividerPosition} from "./dividerInteraction";
import {snapDividerPoint} from "./manualDivider";
import menu from "../components/SmartContextMenu.tsx?raw";
import viewport from "../components/Viewport.tsx?raw";
import store from "../state/store.ts?raw";
import inspector from "../components/Inspector.tsx?raw";

function fixture(){
 const [outer,cavity]=shellParts(150,160,22,2,2);
 const innerShell:GroupNode={id:"shell",type:"group",label:"Hollow box",
  childIds:[outer.id,cavity.id],position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]};
 const x1=makeShape("box"),x2=makeShape("box"),y1=makeShape("box");
 x1.params={w:1.6,d:156.65,h:18.5};x1.position=[-23,0,10.75];
 x2.params={w:1.6,d:156.65,h:18.5};x2.position=[24,0,10.75];
 y1.params={w:146.65,d:1.6,h:18.5};y1.position=[0,19,10.75];
 const nested:GroupNode={id:"old-dividers",type:"group",label:"Box with dividers",
  childIds:[innerShell.id,x1.id],position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]};
 const current:GroupNode={id:"latest-dividers",type:"group",label:"Box with dividers",
  childIds:[nested.id,x2.id,y1.id],position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]};
 const labelCut=makeShape("text");labelCut.role="hole";
 const labelled:GroupNode={id:"labelled",type:"group",label:"Labelled tray",
  childIds:[current.id,labelCut.id],position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]};
 const p:Project={id:"test",name:"test",version:1,rootOrder:[labelled.id],
  nodes:{[outer.id]:outer,[cavity.id]:cavity,[innerShell.id]:innerShell,[x1.id]:x1,
   [x2.id]:x2,[y1.id]:y1,[nested.id]:nested,[current.id]:current,[labelCut.id]:labelCut,[labelled.id]:labelled}};
 return {p,outer,cavity,x1,x2,y1,nested,current,innerShell,labelCut,labelled};
}

describe("v19.5.10 interactive divider workflow: explicit structural integrity",()=>{
 it("consolidates ONLY known generated divider wrappers while preserving every solid, cutter and labelled group",()=>{
  const f=fixture(),before=JSON.stringify(f.p);
  expect(dividerLayers(f.p,f.labelled.id).map(x=>x.id)).toEqual([f.current.id,f.nested.id]);
  const r=consolidateDividerLayers(f.p,f.labelled.id);
  expect(r.removedWrappers).toBe(1);
  expect(r.dividerCount).toBe(3);
  expect(r.project.nodes[f.nested.id]).toBeUndefined();
  const g=r.project.nodes[f.current.id] as GroupNode;
  expect(g.childIds).toEqual([f.innerShell.id,f.x2.id,f.y1.id,f.x1.id]);
  expect(r.project.nodes[f.innerShell.id]).toBe(f.innerShell);
  expect((r.project.nodes[f.innerShell.id] as GroupNode).childIds).toEqual([f.outer.id,f.cavity.id]);
  expect(r.project.nodes[f.labelCut.id]).toBe(f.labelCut);
  expect(r.project.nodes[f.labelled.id]).toBe(f.labelled);
  expect(r.project.rootOrder).toEqual(f.p.rootOrder);
  expect(JSON.stringify(f.p)).toBe(before);
  expect(consolidateDividerLayers(r.project,f.labelled.id).removedWrappers).toBe(0);
 });
 it("deletes ALL divider solids across nested layers in one project edit, without deleting a hole, label or shell",()=>{
  const f=fixture(),r=deleteAllDividerLayers(f.p,f.labelled.id);
  expect(r.removed).toBe(3);
  expect(r.removedWrappers).toBe(1);
  for(const divider of [f.x1,f.x2,f.y1])expect(r.project.nodes[divider.id]).toBeUndefined();
  expect(r.project.nodes[f.cavity.id]).toBe(f.cavity);
  expect(r.project.nodes[f.labelCut.id]).toBe(f.labelCut);
  expect(r.project.nodes[f.innerShell.id]).toBe(f.innerShell);
  const g=r.project.nodes[f.current.id] as GroupNode;
  expect(g.childIds).toEqual([f.innerShell.id]);
  expect(g.label).toBe("Box (dividers removed)");
  expect(JSON.stringify(f.p)).toContain(f.x1.id);
 });
 it("constrains individual Inspector or gizmo movement within the cavity and preserves the other two axes",()=>{
  const f=fixture();
  const info=dividerDistanceInfo(f.p,f.x1.id);
  expect(info?.axis).toBe("x");
  expect(info?.fromMin).toBeCloseTo(49.2,5);
  expect(info?.fromMax).toBeCloseTo(95.2,5);
  const clamped=constrainDividerPosition(f.p,f.x1.id,[150,35,200]);
  expect(clamped).toEqual([70.2,0,10.75]);
  const opposite=constrainDividerPosition(f.p,f.x1.id,[-900,35,-1]);
  expect(opposite).toEqual([-70.2,0,10.75]);
  const y=constrainDividerPosition(f.p,f.y1.id,[55,-900,300]);
  expect(y).toEqual([0,-75.2,10.75]);
  expect(f.x1.position).toEqual([-23,0,10.75]);
  expect(constrainDividerPosition(f.p,f.outer.id,[999,0,0])).toBeNull();
 });
 it("uses 1mm optional snap to centre and allows Shift/free positions; no project mutations",()=>{
  const f=fixture(),snapshot=JSON.stringify(f.p);
  expect(snapDividerPoint(f.p,f.labelled.id,"x",[20.49,7],true)).toEqual([20,7]);
  expect(snapDividerPoint(f.p,f.labelled.id,"x",[0.9,7],true)).toEqual([0,7]);
  expect(snapDividerPoint(f.p,f.labelled.id,"y",[20,-18.6],true)).toEqual([20,-19]);
  expect(snapDividerPoint(f.p,f.labelled.id,"x",[20.49,7],false)).toEqual([20.49,7]);
  expect(JSON.stringify(f.p)).toBe(snapshot);
 });
 it("refuses transforming or flattening unknown/custom Boolean groups",()=>{
  const f=fixture();
  f.current.rotation=[0,0,0.2];
  expect(()=>consolidateDividerLayers(f.p,f.labelled.id)).toThrow();
  f.current.rotation=[0,0,0];
  const unknown=makeShape("box");unknown.role="hole";f.p.nodes[unknown.id]=unknown;
  f.current.childIds.push(unknown.id);
  expect(()=>consolidateDividerLayers(f.p,f.labelled.id)).toThrow(/custom/);
 });
 it("wires continuous native viewport preview and cancel, shared transform constraints and explicit group cleanup",()=>{
  expect(viewport).toContain('key="manual-divider-ghost"');
  expect(viewport).toContain('onPointerMove={e=>{updateManualPreview');
  expect(viewport).toContain('setManualDivider({rootId:nextRoot,axis,partial})');
  expect(viewport).toContain('checked={manualSnap}');
  expect(viewport).toContain('Done · Esc');
  expect(store).toContain('constrainDividerPosition(s.project,e.id,e.position)');
  expect(store).toContain('constrainDividerPosition(s.project,id,wanted)');
  expect(inspector).toContain('dividerDistanceInfo(project,node.id)');
  expect(menu).toContain('Consolidate divider groups...');
  expect(menu).toContain('deleteAllDividerLayers(useScene.getState().project,only!.id)');
 });
});