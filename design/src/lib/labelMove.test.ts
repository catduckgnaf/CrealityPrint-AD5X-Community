import {describe,it,expect,vi} from "vitest";
vi.mock("./sceneApi",()=>({sceneApi:{getNodeBounds:vi.fn()}}));
vi.mock("../state/store",()=>({useScene:{getState:vi.fn(),setState:vi.fn()}}));
import {makeShape} from "./primitives";
import {labelParts} from "./boxFitExtra";
import {labelMoveTarget,boundedLabelDelta,previewLabelNodes} from "./labelMoveCore";
import {validateProject} from "./projectFile";
import type {Project,ShapeNode,GroupNode} from "../types/scene";
import view from "../components/LabelMoveControls.tsx?raw";
import app from "../App.tsx?raw";
import mesh from "../components/GroupMesh.tsx?raw";
import viewport from "../components/Viewport.tsx?raw";

function labelledBox(){
 const body=makeShape("box");
 body.params={w:80,d:55,h:20};
 body.position=[60,5,10];
 const texts=labelParts({
  text:"PARTS\nBOLTS",size:6,depth:0.8,spacing:2,mode:"recessed",font:"sans bold"
 },[60,5],20,"top",80,55);
 const group:GroupNode={id:"wrapper",type:"group",label:"Labelled part",childIds:[body.id,...texts.map(t=>t.id)],
  position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]};
 const project:Project={id:"test",name:"Test",version:1,
  nodes:{[body.id]:body,...Object.fromEntries(texts.map(t=>[t.id,t])),[group.id]:group},rootOrder:[group.id]};
 return {group,body,texts,project};
}
function labelledLid(){
 const panel=makeShape("box");
 panel.params={w:82,d:57,h:2.4};panel.position=[60,-12,1.2];
 const rim=makeShape("box");rim.params={w:75,d:50,h:4.3};rim.position=[60,-12,4.25];
 const opening=makeShape("box");opening.role="hole";
 opening.params={w:72,d:47,h:4.8};opening.position=[60,-12,4.8];
 const lid:GroupNode={id:"lid",type:"group",label:"Matching lid",
  childIds:[panel.id,rim.id,opening.id],position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]};
 const texts=labelParts({text:"PARTS",size:7,depth:0.8,spacing:2,mode:"recessed",font:"sans bold"},
  [60,-12],0,"lid-underside",82,57);
 const wrapper:GroupNode={id:"labelled-lid",type:"group",label:"Labelled lid",
  childIds:[lid.id,...texts.map(n=>n.id)],position:[-5,8,0],rotation:[0,0,0],scale:[1,1,1]};
 const nodes:Project["nodes"]={[panel.id]:panel,[rim.id]:rim,[opening.id]:opening,[lid.id]:lid,[wrapper.id]:wrapper,
  ...Object.fromEntries(texts.map(n=>[n.id,n]))};
 const project:Project={id:"test",version:1,name:"Lid",nodes,rootOrder:[wrapper.id]};
 return {project,wrapper,texts};
}
describe("v19.3 move recessed text without moving its lid",()=>{
 it("recognizes a labelled box and keeps all lines in one editable group",()=>{
  const {project,texts}=labelledBox();
  const t=labelMoveTarget("wrapper",project);
  expect(t.labelIds).toHaveLength(2);
  expect(t.center[0]).toBeCloseTo(60);
  expect(t.surfaceCenterLocal).toEqual([60,5]);
  expect(t.text).toBe("PARTS / BOLTS");
  expect(t.originalPositions[0][0]).toBe(texts[0].position[0]);
 });
 it("moves ONLY text cutters, not their base box, group or Z engraving depth",()=>{
  const {project,body,texts}=labelledBox();
  const target=labelMoveTarget("wrapper",project);
  const preview=previewLabelNodes(target,project.nodes,10,-6);
  expect(preview[body.id]).toBe(project.nodes[body.id]);
  expect(preview.wrapper).toBe(project.nodes.wrapper);
  for(const n of texts){
   expect((preview[n.id] as ShapeNode).role).toBe("hole");
   expect((preview[n.id] as ShapeNode).position[0]).toBe(n.position[0]+10);
   expect((preview[n.id] as ShapeNode).position[1]).toBe(n.position[1]-6);
   expect((preview[n.id] as ShapeNode).position[2]).toBe(n.position[2]);
   expect((project.nodes[n.id] as ShapeNode).position).toEqual(n.position);
  }
 });
 it("bounds moves so label stays inside lid and clamps without touching group geometry",()=>{
  const {project,wrapper,texts}=labelledLid();
  const t=labelMoveTarget(wrapper.id,project);
  expect(t.center[0]).toBeCloseTo(55);
  expect(t.surfaceCenterLocal[0]).toBeCloseTo(60); // local lid X; world centre is shifted by wrapper X=-5
  const [dx,dy]=boundedLabelDelta(t,999,999);
  expect(dx).toBeLessThan(45);
  expect(dy).toBeLessThan(35);
  const n=previewLabelNodes(t,project.nodes,dx,dy);
  expect((n[texts[0].id] as ShapeNode).position[0]).toBe(texts[0].position[0]+dx);
  expect(n.lid).toBe(project.nodes.lid);
  expect(n[wrapper.id]).toBe(project.nodes[wrapper.id]);
 });
 it("moves lettering in a scaled lid group without moving or rescaling the actual lid",()=>{
  const {project,texts}=labelledLid();
  const w=project.nodes["labelled-lid"] as GroupNode;
  project.nodes["labelled-lid"]={...w,scale:[1.2,0.8,1.044]};
  const t=labelMoveTarget("labelled-lid",project);
  expect(t.worldMatrix.elements[0]).toBeCloseTo(1.2);
  const nodes=previewLabelNodes(t,project.nodes,6,4);
  expect((nodes[texts[0].id] as ShapeNode).position[0]).toBeCloseTo(texts[0].position[0]+6);
  expect((nodes[texts[0].id] as ShapeNode).position[1]).toBeCloseTo(texts[0].position[1]+4);
  expect((nodes[texts[0].id] as ShapeNode).position[2]).toBe(texts[0].position[2]);
  expect(nodes["labelled-lid"]).toBe(project.nodes["labelled-lid"]);
 });
 it("supports a matching lid and lettering with pre-existing unequal scales",()=>{
  const {project,texts}=labelledLid();
  const wrapper=project.nodes["labelled-lid"] as GroupNode;
  const lid=project.nodes.lid as GroupNode;
  project.nodes["labelled-lid"]={...wrapper,position:[4.453,0.362,9.96],
     scale:[1.0000145,1.0000919,1.04355]};
  project.nodes.lid={...lid,position:[1.381,-20.295,0.8613],
     scale:[1.001606,1.301544,1.000688]};
  project.nodes[texts[0].id]={...texts[0],scale:[-0.92561,0.999677,0.999968]};
  const target=labelMoveTarget("labelled-lid",project);
  expect(target.text).toBe("PARTS");
  expect(target.surfaceCenterLocal[1]).toBeCloseTo(-20.295+1.301544*(-12),4);
  // The label and the underlying lid retain their existing XY and Z transforms.
  const next=previewLabelNodes(target,project.nodes,5,-3);
  expect((next[texts[0].id] as ShapeNode).position[0]).toBeCloseTo(texts[0].position[0]+5);
  expect((next[texts[0].id] as ShapeNode).scale).toEqual([-0.92561,0.999677,0.999968]);
  expect(next.lid).toBe(project.nodes.lid);
 });
 it("rejects non-labelled groups but allows rotated labelled ones",()=>{
  const {project,body}=labelledBox();
  expect(()=>labelMoveTarget(body.id,project)).toThrow();
  const group=project.nodes.wrapper as GroupNode;
  project.nodes.wrapper={...group,rotation:[0,0,Math.PI/2]};
  const target=labelMoveTarget("wrapper",project);
  expect(Math.abs(target.surfaceNormalWorld[2])).toBeCloseTo(1,5);
 });
 it("recognizes a flipped labelled lid with independently scaled and slightly rotated children",()=>{
  const {project,wrapper,texts}=labelledLid();
  const nested=project.nodes.lid as GroupNode;
  project.nodes[wrapper.id]={...wrapper,
    position:[4.4527,0.3623,9.96],
    rotation:[3.09742897,0.02101855,3.0745662],
    scale:[1.0000145,1.0000919,1.04355]};
  project.nodes.lid={...nested,position:[1.38135,-20.2945,0.8613],
    rotation:[0.0020444,0.0000367,-0.0023578],
    scale:[1.001606,1.301544,1.000688]};
  project.nodes[texts[0].id]={...texts[0],
    rotation:[-0.0000044,0.0000064,-0.0001995],
    scale:[-0.92561,0.999677,0.999968]};
  const t=labelMoveTarget(wrapper.id,project);
  expect(t.surfaceNormalWorld[2]).toBeLessThan(-0.99);
  expect(t.text).toBe("PARTS");
  const nodes=previewLabelNodes(t,project.nodes,8,6);
  expect((nodes[texts[0].id] as ShapeNode).position[0]).toBeCloseTo(texts[0].position[0]+8);
  expect(nodes.lid).toBe(project.nodes.lid);
 });
 it("reloaded project retains moved cutters and original parent group shape",()=>{
  const {project}=labelledLid();
  const t=labelMoveTarget("labelled-lid",project);
  const nodes=previewLabelNodes(t,project.nodes,4.5,3);
  const saved=validateProject({...project,nodes});
  expect((saved.nodes[t.labelIds[0]] as ShapeNode).position[0]).toBe(t.originalPositions[0][0]+4.5);
  expect((saved.nodes[t.labelIds[0]] as ShapeNode).role).toBe("hole");
  expect((saved.nodes.lid as GroupNode).childIds).toEqual((project.nodes.lid as GroupNode).childIds);
 });
 it("uses a real draggable handle, plane rays and Apply/Cancel without ungrouping",()=>{
  expect(view).toContain("setPointerCapture");
  expect(view).toContain("intersectPlane");
  expect(view).toContain("Apply");
  expect(view).toContain("cancel()");
  expect(mesh).toContain("previewLabelNodes");
  expect(app).toContain("<LabelMovePanel />");
  expect(viewport).toContain("<LabelMoveHandle />");
  expect(viewport).not.toContain("ungroupSelected()");
 });
});
