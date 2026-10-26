import {describe,it,expect,beforeEach,vi} from "vitest";
import * as THREE from "three";
import {makeShape} from "./primitives";
import {newId} from "./id";
import {evaluateGroup} from "./csg";
import {identifyShell,lidParts,dividerParts,type LidOptions,createMatchingLid,addDividers} from "./boxFitTools";
import {shellParts} from "./advancedModels";
import {clipParts,labelParts,addLabels,lidFitReport,addSnapStyleTabs,identifyLid} from "./boxFitExtra";
import {repeatShape,mirroredCopy,drillBox} from "./advancedModels";
import {useScene} from "../state/store";
import type {Project,GroupNode,ShapeNode} from "../types/scene";
import view from "../components/BoxFitTools.tsx?raw";
import advanced from "../components/AdvancedTools.tsx?raw";

vi.mock("../state/store",()=>({useScene:{getState:vi.fn(),setState:vi.fn()}}));
vi.mock("./sceneApi",()=>({sceneApi:{getNodeBounds:vi.fn()}}));
let state:{project:Project;selection:string[];bed:[number,number]};
const put=(nodes:ShapeNode[],name:string)=>{
 const id=newId();
 const group:GroupNode={id,type:"group",label:name,childIds:nodes.map(n=>n.id),
  position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]};
 state.project.nodes={...state.project.nodes,...Object.fromEntries(nodes.map(n=>[n.id,n])),[id]:group};
 state.project.rootOrder.push(id);
 return id;
};
const shell=()=>{
 const id=put(shellParts(80,60,30,2,3),"Hollow box");
 return {id,info:identifyShell(id,state.project)};
};
const defaults:LidOptions={clearance:0.3,thickness:2.4,lipDepth:4,lipWall:1.5,overhang:0.5,bedGap:12};
beforeEach(()=>{
 state={project:{id:"test",name:"test",version:1,nodes:{},rootOrder:[]},selection:[],bed:[220,220]};
 vi.mocked(useScene.getState).mockImplementation(()=>state as never);
 vi.mocked(useScene.setState).mockImplementation((fn:any)=>{
   state={...state,...(typeof fn==="function"?fn(state):fn)};
 } );
});
describe("v19 matching lid, dividers, clips",()=>{
 it("recognizes a 100 by 120 by 22 mm hollow box while rejecting a rotated wrapper",()=>{
  const nodes=shellParts(100,120,22,2,2);
  const id=put(nodes,"Hollow box");
  expect(identifyShell(id,state.project).width).toBe(100);
  expect(identifyShell(id,state.project).depth).toBe(120);
  expect(identifyShell(id,state.project).floor).toBe(2);
  const wrapper:GroupNode={id:"wrapped-shell",type:"group",childIds:[id],
    position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]};
  state.project.nodes[wrapper.id]=wrapper;
  state.project.rootOrder=[wrapper.id];
  expect(identifyShell(wrapper.id,state.project).height).toBe(22);
  wrapper.rotation=[0,0,0.2];
  expect(()=>identifyShell(wrapper.id,state.project)).toThrow();
 });
 it("generates a lip smaller than the cavity by exactly two clearance allowances",()=>{
  const {info}=shell();
  const parts=lidParts(info,defaults);
  expect(parts).toHaveLength(3);
  expect(parts[0].role).toBe("solid");
  expect(parts[1].role).toBe("solid");
  expect(parts[2].role).toBe("hole");
  expect(Number(info.cavity.params.w)-Number(parts[1].params.w)).toBeCloseTo(0.6);
  expect(Number(info.cavity.params.d)-Number(parts[1].params.d)).toBeCloseTo(0.6);
  expect(parts[0].position[2]-Number(parts[0].params.h)/2).toBeCloseTo(0);
  expect(Math.abs(parts[0].position[0])+Number(parts[0].params.w)/2).toBeLessThan(110);
  expect(Math.abs(parts[0].position[1])+Number(parts[0].params.d)/2).toBeLessThan(110);
 });
 it("rejects impossible lip thickness and overdeep insertions",()=>{
  const {info}=shell();
  expect(()=>lidParts(info,{...defaults,lipWall:40})).toThrow();
  expect(()=>lidParts(info,{...defaults,lipDepth:30})).toThrow();
 });
 it("gives a real open lid ring with the central top plate intact",()=>{
  const {info}=shell(),nodes=lidParts(info,defaults);
  const group:GroupNode={id:"lid",type:"group",childIds:nodes.map(n=>n.id),
   position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]};
  const geo=evaluateGroup(group,Object.fromEntries(nodes.map(n=>[n.id,n])));
  expect(geo).not.toBeNull();
  if(!geo)return;
  const mesh=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
  mesh.updateWorldMatrix(true,true);
  const ray=new THREE.Raycaster();
  ray.set(new THREE.Vector3(nodes[0].position[0],nodes[0].position[1],30),new THREE.Vector3(0,0,-1));
  const hits=ray.intersectObject(mesh);
  expect(hits.length).toBeGreaterThan(0);
  // Ring's central opening is exposed: ray finds the solid top plate at 2.4mm, not lip height.
  expect(hits[0].point.z).toBeCloseTo(defaults.thickness,0);
  geo.dispose();
 });
 it("preserves the same existing shell group when fitting dividers",()=>{
  const {id,info}=shell();
  const dividers=dividerParts(info,3,2,1.6,2);
  expect(dividers).toHaveLength(3);
  const wrapped=addDividers(id,3,2,1.6,2);
  expect(state.project.rootOrder).toEqual([wrapped]);
  const root=state.project.nodes[wrapped] as GroupNode;
  expect(root.childIds[0]).toBe(id);
  expect(root.childIds).toHaveLength(4);
  expect(identifyShell(wrapped,state.project).width).toBe(80);
 });
 it("prepares 2 or 4 rooted experimental clip tabs without editing printer settings",()=>{
  const {id,info}=shell();
  const opt={count:2 as const,tabWidth:8,beamHeight:10,thickness:1.5,gap:0.8,catchDepth:0.7};
  expect(clipParts(info,opt)).toHaveLength(6);
  expect(clipParts(info,{...opt,count:4})).toHaveLength(12);
  const wrapped=addSnapStyleTabs(id,opt);
  expect(state.project.rootOrder).toEqual([wrapped]);
  expect(identifyShell(wrapped,state.project).floor).toBeCloseTo(3);
 });
 it("creates a lid alongside a modified shell and reports designed clearance",()=>{
  const {id}=shell();
  const modified=addDividers(id,2,1,1.6,2);
  const lid=createMatchingLid(modified,defaults);
  const fit=lidFitReport(modified,lid);
  expect(fit.warning).toBe(false);
  expect(fit.clearanceX).toBeCloseTo(0.3);
  expect(fit.clearanceY).toBeCloseTo(0.3);
  expect(identifyLid(lid).ringWidth).toBeCloseTo(75.4);
 });
});
describe("v19 text and labels",()=>{
 it("creates editable raised and recessed text on box top without unsafe overrun",()=>{
  const opt={text:"SCREWS\nTOOLS",size:5,depth:0.8,spacing:2,mode:"recessed" as const,font:"sans" as const};
  const labels=labelParts(opt,[0,0],20,"top",80,60);
  expect(labels).toHaveLength(2);
  expect(labels.every(n=>n.kind==="text"&&n.role==="hole")).toBe(true);
  const raised=labelParts({...opt,mode:"raised"},[0,0],20,"top",80,60);
  expect(raised.every(n=>n.role==="solid")).toBe(true);
  expect(()=>labelParts({...opt,text:"THIS IS WAY TOO LONG TO FIT"},[0,0],20,"top",35,20)).toThrow();
 });
 it("engraves lid underside with reversed lettering but rejects raised text below build plane",()=>{
  const opt={text:"PARTS",size:6,depth:0.7,spacing:2,mode:"recessed" as const,font:"sans bold" as const};
  const labels=labelParts(opt,[0,0],0,"lid-underside",80,60);
  expect(labels[0].role).toBe("hole");
  expect(labels[0].scale[0]).toBe(-1);
  expect(()=>labelParts({...opt,mode:"raised"},[0,0],0,"lid-underside",80,60)).toThrow();
 });
 it("keeps the original lid geometry as the first child of a label assembly",()=>{
  const {id}=shell(), lid=createMatchingLid(id,defaults);
  const wrapped=addLabels(lid,{text:"BOLTS",size:6,depth:0.8,spacing:2,mode:"recessed",font:"sans"});
  const root=state.project.nodes[wrapped] as GroupNode;
  expect(root.childIds[0]).toBe(lid);
  expect(root.childIds).toHaveLength(2);
  expect(lidFitReport(id,wrapped).clearanceX).toBeCloseTo(0.3);
 });
});
describe("v19.5.3 labels on outside walls of editable hollow boxes",()=>{
 it("adds upright raised text to the front wall without altering the original cavity",()=>{
  const {id,info}=shell();
  const opt={text:"PARTS",size:6,depth:0.8,spacing:2,mode:"raised" as const,font:"sans bold" as const};
  const wrapper=addLabels(id,opt);
  const root=state.project.nodes[wrapper] as GroupNode;
  expect(state.project.rootOrder).toEqual([wrapper]);
  expect(root.childIds[0]).toBe(id);
  expect(root.childIds).toHaveLength(2);
  const label=state.project.nodes[root.childIds[1]] as ShapeNode;
  expect(label.kind).toBe("text");
  expect(label.role).toBe("solid");
  expect(label.rotation[0]).toBeCloseTo(Math.PI/2);
  expect(label.position[1]).toBeCloseTo(info.cy-info.depth/2-0.2);
  expect(label.position[2]).toBeCloseTo(info.bottom+info.height/2);
  expect(identifyShell(wrapper,state.project).width).toBe(80);
  expect(state.project.nodes[id]).toBe(info.root);
 });
 it("engraves into the wall but rejects cutters deeper than the wall",()=>{
  const {id,info}=shell();
  const opt={text:"TOOLS",size:6,depth:0.8,spacing:2,mode:"recessed" as const,font:"sans" as const};
  const wrapper=addLabels(id,opt);
  const root=state.project.nodes[wrapper] as GroupNode;
  const label=state.project.nodes[root.childIds[1]] as ShapeNode;
  expect(label.role).toBe("hole");
  expect(label.position[1]).toBeCloseTo(info.cy-info.depth/2+0.2);
  expect(()=>addLabels(wrapper,{...opt,depth:info.wallY})).toThrow(/too deep/);
  expect(state.project.rootOrder).toEqual([wrapper]); // failed action must not change scene
 });
 it("rejects oversized labels on narrow walls without mutating the scene",()=>{
  const {id}=shell();
  const before=state.project.rootOrder.slice();
  expect(()=>addLabels(id,{text:"A VERY LONG LABEL",size:18,depth:0.8,spacing:2,
    mode:"raised",font:"sans"})).toThrow();
  expect(state.project.rootOrder).toEqual(before);
 });
});
describe("v19 previous-workflow protections",()=>{
 it("duplicates and mirrors a simple box without deleting the source",()=>{
  const n=makeShape("box");n.position=[22,0,10];
  state.project.nodes[n.id]=n;state.project.rootOrder=[n.id];
  expect(repeatShape(n.id,"linear",3,20,0,20)).toBe(2);
  expect(state.project.rootOrder).toHaveLength(3);
  const mirror=mirroredCopy(n.id,0);
  expect((state.project.nodes[mirror] as ShapeNode).position[0]).toBe(-22);
  expect(state.project.rootOrder).toContain(n.id);
 });
 it("Hole Wizard groups real through-hole cutter with source box",()=>{
  const n=makeShape("box");state.project.nodes[n.id]=n;state.project.rootOrder=[n.id];
  const id=drillBox(n.id,4,0,0,8,"through",6,2);
  const group=state.project.nodes[id] as GroupNode;
  expect(group.childIds).toHaveLength(2);
  expect((state.project.nodes[group.childIds[1]] as ShapeNode).role).toBe("hole");
 });
 it("the tool is accessible from the existing Advanced panel without Send to Prepare",()=>{
  for(const s of ["Lids","Dividers","Clips","Fit","Labels"])expect(view).toContain('"'+s+'"');
  expect(advanced).toContain('<BoxFitTools key={boxFitPage} initialPage={boxFitPage} />');
  expect(advanced).not.toContain("sendToPrepare()");
 });
});
