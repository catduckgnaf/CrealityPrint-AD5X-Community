import {describe,it,expect} from "vitest";
import {groupPath,containsCutters,isBooleanGroup,groupDisplay,parentGroupPath,resemblesHollowBox,findDividerEditTarget} from "./groupWorkflow";
import type {Project,GroupNode,ShapeNode} from "../types/scene";
import {makeShape} from "./primitives";

import explorer from "../components/ObjectExplorer.tsx?raw";
import viewport from "../components/Viewport.tsx?raw";
import group from "../components/GroupMesh.tsx?raw";
import banner from "../components/GroupFocusControls.tsx?raw";
import context from "../components/SmartContextMenu.tsx?raw";
import store from "../state/store.ts?raw";
import shortcuts from "../hooks/useShortcuts.ts?raw";

function fixture():{p:Project,root:GroupNode,lid:GroupNode,cutter:ShapeNode,solid:ShapeNode}{
 const solid=makeShape("box"),cutter=makeShape("box");
 cutter.role="hole";
 const lid:GroupNode={id:"lid",type:"group",label:"Lid",childIds:[solid.id,cutter.id],
  position:[1,2,3],rotation:[0,0,0],scale:[1,1,1]};
 const root:GroupNode={id:"label-wrapper",type:"group",label:"Labelled lid",
  childIds:[lid.id],position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]};
 const p:Project={id:"test",name:"Test",version:1,rootOrder:[root.id],
  nodes:{[root.id]:root,[lid.id]:lid,[solid.id]:solid,[cutter.id]:cutter}};
 return {p,root,lid,cutter,solid};
}
describe("v19.5 scene hierarchy and grouped holes",()=>{
 it("finds nested lid and text shapes and can back out one edit level",()=>{
  const {p,root,lid,cutter}=fixture();
  expect(groupPath(p,cutter.id)).toEqual([root.id,lid.id,cutter.id]);
  expect(groupPath(p,lid.id)).toEqual([root.id,lid.id]);
  expect(parentGroupPath(p,lid.id)).toEqual([root.id]);
  expect(groupPath(p,"not-here")).toEqual([]);
 });
 it("recognizes hidden Boolean cutters deep in a nested group before ungrouping",()=>{
  const {p,root,lid,cutter}=fixture();
  expect(containsCutters(p,root.id)).toBe(true);
  expect(isBooleanGroup(p,root.id)).toBe(true);
  expect(isBooleanGroup(p,lid.id)).toBe(true);
  expect(isBooleanGroup(p,cutter.id)).toBe(false);
  p.nodes[cutter.id]={...cutter,role:"solid"};
  expect(isBooleanGroup(p,root.id)).toBe(false);
 });
 it("keeps existing names, uses human-readable fallback and handles broken references",()=>{
  const {p,root,lid}=fixture();
  expect(groupDisplay(p,lid.id)).toBe("Lid");
  p.nodes[root.id]={...root,label:""};
  expect(groupDisplay(p,root.id)).toBe("Group (1 parts)");
  p.nodes[root.id]={...root,childIds:["missing"]};
  expect(groupPath(p,lid.id)).toEqual([]);
 });
 it("gives an explicit edit-inside action and safe confirmation on dangerous ungroup",()=>{
  expect(banner).toContain("Edit Inside");
  expect(banner).toContain("finishGroupEdit");
  expect(context).toContain("Edit Inside (keep cuts)");
  expect(store).toContain("isBooleanGroup(project,id)");
  expect(store).toContain('window.confirm("This group contains cutting shapes');
  expect(store).toContain("ungroupSelected");
 });
 it("renders nested groups in their full parent transform and enables selection inside",()=>{
  expect(viewport).toContain("focusedNode=(id:string,level:number)");
  expect(viewport).toContain("focusPath[0]===id");
  expect(group).toContain("isFocusedChild");
  expect(explorer).toContain("selectFromObjectTree");
  expect(explorer).toContain("Cavity (cutout)");
  expect(explorer).toContain("Solid box");
  expect(banner).toContain("Done keeps the hollow shape");
  expect(explorer).toContain("ad5x-open-explorer");
  expect(shortcuts).toContain("finishGroupEdit()");
 });
});

describe("v19.5.5 hollow box context visibility without geometry changes",()=>{
 it("shows tools for the real 100 x 120 x 22 Shell layout and for a Boolean wrapper",()=>{
  const outer=makeShape("box"),cavity=makeShape("box");
  outer.params={w:100,d:120,h:22,radius:0};outer.position=[0,0,11];
  cavity.params={w:96,d:116,h:22,radius:0};cavity.position=[0,0,13];cavity.role="hole";
  const root:GroupNode={id:"shell",type:"group",label:"Hollow box",
   childIds:[outer.id,cavity.id],position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]};
  const project:Project={id:"test",name:"test",version:1,rootOrder:[root.id],
    nodes:{[root.id]:root,[outer.id]:outer,[cavity.id]:cavity}};
  expect(resemblesHollowBox(project,root.id)).toBe(true);
  expect(Number(outer.params.w)).toBe(100);
  expect(Number(outer.params.d)).toBe(120);
  const wrapped:GroupNode={id:"wrapper",type:"group",label:"Combined tray",
    childIds:[root.id],position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]};
  project.nodes[wrapped.id]=wrapped;
  project.rootOrder=[wrapped.id];
  expect(resemblesHollowBox(project,wrapped.id)).toBe(true);
  expect(Number(outer.params.h)).toBe(22);
  wrapped.rotation=[0,0,0.2];
  expect(resemblesHollowBox(project,wrapped.id)).toBe(true);
  expect(resemblesHollowBox(project,wrapped.id)).toBe(true);
 });
 it("does not mistake a labelled lid or a generic group for a hollow tray",()=>{
  const base=makeShape("box"),hole=makeShape("box");
  base.params={w:101,d:121,h:2.4}; base.position=[0,0,1.2];
  hole.params={w:90,d:110,h:6}; hole.position=[0,0,5.4];hole.role="hole";
  const lid:GroupNode={id:"lid",type:"group",childIds:[base.id,hole.id],
   position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]};
  const p:Project={id:"test",name:"test",version:1,rootOrder:[lid.id],
    nodes:{[lid.id]:lid,[base.id]:base,[hole.id]:hole}};
  expect(resemblesHollowBox(p,lid.id)).toBe(false);
  lid.childIds=[base.id];
  expect(resemblesHollowBox(p,lid.id)).toBe(false);
 });
});
describe("v19.5.6 select and move existing dividers without ungrouping",()=>{
 it("finds real nested divider child but not a Boolean cavity or matching lid",()=>{
  const outer=makeShape("box"),cavity=makeShape("box"),divider=makeShape("box");
  outer.params={w:100,d:120,h:22};outer.position=[0,0,11];
  cavity.params={w:96,d:116,h:22};cavity.position=[0,0,13];cavity.role="hole";
  divider.params={w:1.6,d:116,h:18};divider.position=[0,0,11];
  const inner:GroupNode={id:"shell",type:"group",childIds:[outer.id,cavity.id],
   position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]};
  const wrap:GroupNode={id:"dividers",type:"group",label:"Box with dividers",
   childIds:[inner.id,divider.id],position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]};
  const labels:GroupNode={id:"labels",type:"group",label:"Labelled tray",
   childIds:[wrap.id],position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]};
  const p:Project={id:"test",name:"test",version:1,rootOrder:[labels.id],nodes:{
   [inner.id]:inner,[wrap.id]:wrap,[labels.id]:labels,
   [outer.id]:outer,[cavity.id]:cavity,[divider.id]:divider}};
  expect(findDividerEditTarget(p,labels.id)).toEqual({parentId:wrap.id,dividerId:divider.id});
  expect(findDividerEditTarget(p,inner.id)).toBeNull();
  divider.locked=true;
  expect(findDividerEditTarget(p,labels.id)).toBeNull();
  divider.locked=false;wrap.label="Matching lid";
  expect(findDividerEditTarget(p,labels.id)).toBeNull();
 });
});
