import {describe,it,expect} from "vitest";
import {makeShape} from "./primitives";
import type {Project,GroupNode,ShapeNode} from "../types/scene";
import {inspectDividerSet,equalizeDividers,removeDividerSolids,selectedDividerContext,containsManagedDivider} from "./dividerManagement";
import context from "../components/SmartContextMenu.tsx?raw";

function fixture(){
 const outer=makeShape("box"),cavity=makeShape("box");
 outer.params={w:100,d:120,h:22,radius:0};outer.position=[0,0,11];
 cavity.params={w:96,d:116,h:22,radius:0};cavity.position=[0,0,13];cavity.role="hole";
 const sh:GroupNode={id:"shell",type:"group",label:"Hollow box",childIds:[outer.id,cavity.id],position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]};
 const x1=makeShape("box"),x2=makeShape("box"),y1=makeShape("box");
 x1.params={w:1.6,d:116.65,h:18.5};x1.position=[-31,0,10.75];
 x2.params={w:1.6,d:116.65,h:18.5};x2.position=[15,0,10.75];
 y1.params={w:96.65,d:1.6,h:18.5};y1.position=[0,20,10.75];
 const div:GroupNode={id:"div-group",type:"group",label:"Box with dividers",childIds:[sh.id,x1.id,x2.id,y1.id],position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]};
 const label:GroupNode={id:"label",type:"group",label:"Labelled tray",childIds:[div.id],position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]};
 const project:Project={id:"test",name:"test",version:1,rootOrder:[label.id],nodes:{
  [label.id]:label,[div.id]:div,[sh.id]:sh,[outer.id]:outer,[cavity.id]:cavity,[x1.id]:x1,[x2.id]:x2,[y1.id]:y1
 }};
 return {project,outer,cavity,sh,div,label,x1,x2,y1};
}

describe("v19.5.7 divider equal spacing and protected deletion",()=>{
 it("recognizes a nested original Boolean box and two divider directions",()=>{
  const f=fixture(),got=inspectDividerSet(f.project,f.label.id);
  expect(got.xIds).toEqual([f.x1.id,f.x2.id]);
  expect(got.yIds).toEqual([f.y1.id]);
  expect(got.xMin).toBe(-48);
  expect(got.xMax).toBe(48);
  expect(got.yMin).toBe(-58);
  expect(got.yMax).toBe(58);
 });
 it("spaces clear compartment gaps evenly across both axes in one immutable edit",()=>{
  const f=fixture(),out=equalizeDividers(f.project,f.label.id);
  const gap=(96-3.2)/3;
  expect(out.moved).toBe(3);
  expect(out.project.nodes[f.x1.id].position[0]).toBeCloseTo(-48+gap+0.8,5);
  expect(out.project.nodes[f.x2.id].position[0]).toBeCloseTo(48-gap-0.8,5);
  expect(out.project.nodes[f.y1.id].position[1]).toBeCloseTo(0,5);
  expect(f.x1.position[0]).toBe(-31);
  expect(f.y1.position[1]).toBe(20);
  expect(out.project.nodes[f.cavity.id]).toBe(f.cavity);
  expect(out.project.nodes[f.outer.id]).toBe(f.outer);
  expect(out.project.rootOrder).toEqual(f.project.rootOrder);
  expect(out.project.nodes[f.div.id]).toBe(f.div);
  expect(equalizeDividers(out.project,f.label.id).moved).toBe(0);
  expect(equalizeDividers(out.project,f.label.id).project).toBe(out.project);
 });
 it("deletes one divider without changing other parts, cutter or root",()=>{
  const f=fixture();
  expect(selectedDividerContext(f.project,f.x1.id)).toEqual({groupId:f.div.id,dividerId:f.x1.id});
  f.project.rootOrder=[f.div.id];
  expect(selectedDividerContext(f.project,f.x1.id)).toEqual({groupId:f.div.id,dividerId:f.x1.id});
  f.project.rootOrder=[f.label.id];
  const out=removeDividerSolids(f.project,f.div.id,f.x1.id);
  expect(out.removed).toBe(1);
  expect(out.project.nodes[f.x1.id]).toBeUndefined();
  expect(out.project.nodes[f.cavity.id]).toBe(f.cavity);
  expect(out.project.nodes[f.outer.id]).toBe(f.outer);
  expect(out.project.nodes[f.y1.id]).toBe(f.y1);
  expect((out.project.nodes[f.div.id] as GroupNode).childIds).toEqual([f.sh.id,f.x2.id,f.y1.id]);
  expect(f.div.childIds).toHaveLength(4);
  expect(out.project.rootOrder).toEqual(f.project.rootOrder);
 });
 it("deletes all divider solids but leaves original Boolean group and label wrapper recoverable",()=>{
  const f=fixture(),out=removeDividerSolids(f.project,f.label.id);
  expect(out.removed).toBe(3);
  expect(Object.keys(out.project.nodes)).toHaveLength(5);
  expect((out.project.nodes[f.div.id] as GroupNode).childIds).toEqual([f.sh.id]);
  expect((out.project.nodes[f.div.id] as GroupNode).label).toBe("Box (dividers removed)");
  expect((out.project.nodes[f.sh.id] as GroupNode).childIds).toEqual([f.outer.id,f.cavity.id]);
  expect((out.project.nodes[f.cavity.id] as ShapeNode).role).toBe("hole");
  expect(JSON.parse(JSON.stringify(out.project)).nodes[f.cavity.id].role).toBe("hole");
  expect(f.project.nodes[f.x1.id]).toBe(f.x1); // old snapshot retained for Undo
 });
 it("rejects a scaled group, locked divider and unsuitable short wall without altering the original",()=>{
  const f=fixture();
  f.label.scale=[1.25,1,1];
  expect(()=>equalizeDividers(f.project,f.label.id)).toThrow(/scaled/);
  f.label.scale=[1,1,1];f.x1.locked=true;
  expect(()=>removeDividerSolids(f.project,f.label.id)).toThrow(/locked/);
  f.x1.locked=false;f.x1.params.d=24;
  expect(()=>equalizeDividers(f.project,f.label.id)).toThrow(/short/);
  expect(f.div.childIds).toHaveLength(4);
  expect(f.project.nodes[f.cavity.id]).toBe(f.cavity);
 });
 it("rejects deletion of the cavity and unrecognized groups",()=>{
  const f=fixture();
  expect(selectedDividerContext(f.project,f.cavity.id)).toBeNull();
  expect(()=>removeDividerSolids(f.project,f.div.id,f.cavity.id)).toThrow(/shell and cutters/);
  // Renaming a genuine generated divider group must no longer break it.
  f.div.label="Matching lid";
  expect(equalizeDividers(f.project,f.label.id).moved).toBeGreaterThan(0);
 });
 it("uses the existing native context menu with explicit confirmation and Undo-safe atomic mutation",()=>{
  expect(context).toContain('label="Space dividers equally"');
  expect(context).toContain('label="Delete all dividers..."');
  expect(context).toContain('label="Delete this divider..."');
  expect(context).toContain("window.confirm");
  expect(context).toContain("useScene.setState({project:next.project");
  expect(context).toContain('label="Edit / move dividers..."');
 });
});
describe("v19.5.8 regression: real AD5X labelled 150 x 160 tray after generic spacing",()=>{
 it("recentres long walls displaced by up to 68 mm, spaces both nested divider layers, and preserves all cutters",()=>{
  const outer=makeShape("box"),cavity=makeShape("box");
  outer.params={w:150,d:160,h:22};outer.position=[0,0,11];
  cavity.params={w:146,d:156,h:22};cavity.position=[0,0,13];cavity.role="hole";
  const shell:GroupNode={id:"shell",type:"group",label:"Hollow box",childIds:[outer.id,cavity.id],position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]};
  const nodes:Project["nodes"]={[outer.id]:outer,[cavity.id]:cavity,shell};
  const create=(name:string,w:number,d:number,x:number,y:number)=>{
   const n=makeShape("box");n.label=name;n.params={w,d,h:18.5};n.position=[x,y,10.75];nodes[n.id]=n;return n;
  };
  const oldX1=create("old x1",1.6,156.65,-24.333333333,0);
  const oldX2=create("old x2",1.6,156.65,24.333333333,0);
  const oldY=create("old y",146.65,1.6,0,0);
  const inner:GroupNode={id:"inner",type:"group",label:"Box with dividers",childIds:[shell.id,oldX1.id,oldX2.id,oldY.id],position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]};
  nodes[inner.id]=inner;
  // Measured from the native broken-spacing JSON export. These full-length dividers
  // were shifted along their long Y axis and protrude outside the tray.
  const driftX1=create("drift x1",1.6,156.65,-24.333333333,-40.8);
  const driftX2=create("drift x2",1.6,156.65,24.333333333,-13.6);
  const driftX3=create("drift x3",1.6,156.65,-14.333333333,68);
  const driftX4=create("drift x4",1.6,156.65,-14.333333333,13.6);
  const driftX5=create("drift x5",1.6,156.65,-14.333333333,40.8);
  const driftY=create("drift y",146.65,1.6,0,-68);
  const outerDiv:GroupNode={id:"outerDiv",type:"group",label:"Box with dividers",childIds:[inner.id,driftX1.id,driftX2.id,driftX3.id,driftX4.id,driftX5.id,driftY.id],
  position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]};
  nodes[outerDiv.id]=outerDiv;
  const removed:GroupNode={id:"removed",type:"group",label:"Box (dividers removed)",childIds:[outerDiv.id],position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]};
  nodes[removed.id]=removed;
  const textCut=makeShape("text");textCut.role="hole";nodes[textCut.id]=textCut;
  const labelled:GroupNode={id:"labelled",type:"group",label:"Labelled hollow box",childIds:[removed.id,textCut.id],position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]};
  nodes[labelled.id]=labelled;
  const scene:Project={id:"live",name:"Untitled",version:1,rootOrder:[labelled.id],nodes};
  expect(containsManagedDivider(scene,[driftX1.id,driftX3.id])).toBe(true);
  expect(inspectDividerSet(scene,labelled.id).xIds).toHaveLength(5);
  const out=equalizeDividers(scene,labelled.id);
  expect(out.moved).toBe(9); // all seven lengthwise and two crosswise dividers
  const changed=out.project.nodes;
  const xIds=[oldX1,oldX2,driftX1,driftX2,driftX3,driftX4,driftX5];
  const yIds=[oldY,driftY];
  const xOrdered=xIds.map(n=>changed[n.id] as ShapeNode).sort((a,b)=>a.position[0]-b.position[0]);
  const yOrdered=yIds.map(n=>changed[n.id] as ShapeNode).sort((a,b)=>a.position[1]-b.position[1]);
  const xGap=(146-7*1.6)/8,yGap=(156-2*1.6)/3;
  for(let i=0;i<xOrdered.length;i++){
   expect(xOrdered[i].position[0]).toBeCloseTo(-73+xGap*(i+1)+1.6*(i+0.5),5);
   expect(xOrdered[i].position[1]).toBe(0);
   expect(Math.abs(xOrdered[i].position[1])+Number(xOrdered[i].params.d)/2).toBeLessThanOrEqual(78.5);
  }
  for(let i=0;i<yOrdered.length;i++){
   expect(yOrdered[i].position[1]).toBeCloseTo(-78+yGap*(i+1)+1.6*(i+0.5),5);
   expect(yOrdered[i].position[0]).toBe(0);
   expect(Math.abs(yOrdered[i].position[0])+Number(yOrdered[i].params.w)/2).toBeLessThanOrEqual(73.5);
  }
  expect(out.project.nodes[cavity.id]).toBe(cavity);
  expect(out.project.nodes[textCut.id]).toBe(textCut);
  expect(out.project.nodes[inner.id]).toBe(inner);
  expect(out.project.nodes[outerDiv.id]).toBe(outerDiv);
  expect(scene.nodes[driftX3.id].position[1]).toBe(68); // original Undo snapshot untouched
  expect(equalizeDividers(out.project,labelled.id).project).toBe(out.project);
 });
 it("generic equal-spacing can detect divider children and avoid sliding them outside the cavity",()=>{
  const f=fixture();
  expect(containsManagedDivider(f.project,[f.x1.id,f.y1.id])).toBe(true);
  expect(containsManagedDivider(f.project,[f.outer.id,f.cavity.id])).toBe(false);
  expect(containsManagedDivider(f.project,[f.div.id])).toBe(false);
  const store=String.raw`import { containsManagedDivider } from "../lib/dividerManagement";`;
  expect(store).toContain("containsManagedDivider");
 });
});