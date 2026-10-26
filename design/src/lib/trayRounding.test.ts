import {describe,it,expect,vi,beforeAll} from "vitest";
// Node test environment uses the npm Manifold loader; browser builds keep their CSP-safe vendor loader.
vi.mock("../../vendor/manifold/manifold.js",async()=>{
 const imported=await import("manifold-3d");
 return {default:()=>imported.default()};
});
import {manifoldReady,manifoldLoaded} from "./manifold";
import * as THREE from "three";
import {STLExporter} from "three/addons/exporters/STLExporter.js";
import {shellParts} from "./advancedModels";
import {parsePicks} from "./rounding";
import {newId} from "./id";
import {evaluateGroup} from "./csg";
import {trayTarget,trayRoundingNodes,traySettingsClamped,canRoundTray} from "./trayRoundingCore";
import type {Project,GroupNode,ShapeNode} from "../types/scene";
import toolbar from "../components/Toolbar.tsx?raw";
import viewport from "../components/Viewport.tsx?raw";
import component from "../components/TrayRoundingControls.tsx?raw";
import group from "../components/GroupMesh.tsx?raw";
import app from "../App.tsx?raw";
vi.mock("../state/store",()=>({useScene:{getState:vi.fn(),setState:vi.fn()}}));

function fixture(){
 const children=shellParts(80,60,30,2,3);
 const parent:GroupNode={id:newId(),type:"group",label:"Hollow box",childIds:children.map(n=>n.id),
  position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]};
 const project:Project={id:"roundtray",version:1,name:"Test",rootOrder:[parent.id],
  nodes:{...Object.fromEntries(children.map(c=>[c.id,c])),[parent.id]:parent}};
 return {project,parent,children};
}
function meshFor(geo:THREE.BufferGeometry){
 const mesh=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
 mesh.updateWorldMatrix(true,true);
 return mesh;
}
function floorAt(mesh:THREE.Mesh,x:number,y:number):number{
 const ray=new THREE.Raycaster(new THREE.Vector3(x,y,45),new THREE.Vector3(0,0,-1));
 const hits=ray.intersectObject(mesh);
 if(!hits.length)throw Error("No floor hit at "+x+","+y);
 return hits[0].point.z;
}
beforeAll(async()=>{expect(await manifoldReady).toBe(true);expect(manifoldLoaded()).toBe(true);});
describe("v19.4 matched tray corners",()=>{
 it("sets corresponding outer and inner corner radius and keeps wall thickness",()=>{
  const {project,parent}=fixture();
  const info=trayTarget(parent.id,project);
  expect(info.initial).toEqual({outside:0,scoop:0});
  expect(info.shell.floor).toBeCloseTo(3);
  const patches=trayRoundingNodes(info,{outside:8,scoop:5});
  const out=patches[info.shell.outer.id],cut=patches[info.shell.cavity.id];
  expect(["8","9","10","11"].map(k=>parsePicks("box",out.params).get(k))).toEqual([8,8,8,8]);
  expect(["8","9","10","11"].map(k=>parsePicks("box",cut.params).get(k))).toEqual([6,6,6,6]);
  expect(["0","1","4","5"].map(k=>parsePicks("box",cut.params).get(k))).toEqual([5,5,5,5]);
  expect(Number(out.params.w)).toBe(80);
  expect(Number(cut.params.w)).toBe(76);
  expect(out.position).toEqual(info.shell.outer.position);
  expect(cut.position).toEqual(info.shell.cavity.position);
  expect(project.nodes[info.shell.outer.id]).toBe(info.shell.outer);
  expect(project.nodes[info.shell.cavity.id]).toBe(info.shell.cavity);
 });
 it("keeps inside sharp if the outside radius is less than wall thickness",()=>{
  const {project,parent}=fixture();
  const info=trayTarget(parent.id,project);
  const m=trayRoundingNodes(info,{outside:1.5,scoop:0});
  expect(parsePicks("box",m[info.shell.cavity.id].params).get("8")).toBeUndefined();
  expect(parsePicks("box",m[info.shell.outer.id].params).get("8")).toBe(1.5);
 });
 it("preserves unrelated custom edge picks, avoids original scene mutation",()=>{
  const {project,parent}=fixture();const original=trayTarget(parent.id,project);
  project.nodes[original.shell.outer.id]={...original.shell.outer,
    params:{...original.shell.outer.params,edges:"2@0.5"}};
  const info=trayTarget(parent.id,project);
  const patches=trayRoundingNodes(info,{outside:6,scoop:4});
  expect(parsePicks("box",patches[info.shell.outer.id].params).get("2")).toBe(0.5);
  expect(info.shell.outer.params.edges).toBe("2@0.5");
 });
 it("rejects mismatched wall thickness and invalid radius, and supports modified-shell wrappers",()=>{
  const {project,parent}=fixture();
  const cavity=project.nodes[parent.childIds[1]] as ShapeNode;
  project.nodes[cavity.id]={...cavity,params:{...cavity.params,w:75}};
  expect(()=>trayTarget(parent.id,project)).toThrow("equal wall");
  const f=fixture(),target=trayTarget(f.parent.id,f.project);
  expect(()=>trayRoundingNodes(target,{outside:999,scoop:3})).toThrow();
  expect(canRoundTray(f.parent.id,f.project)).toBe(true);
  expect(canRoundTray(null,f.project)).toBe(false);
  const wrapper:GroupNode={id:newId(),type:"group",label:"Box + ribs",childIds:[f.parent.id],
    position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]};
  f.project.nodes[wrapper.id]=wrapper;f.project.rootOrder=[wrapper.id];
  expect(trayTarget(wrapper.id,f.project).shell.outer.id).toBe(target.shell.outer.id);
 });
 it("retains saved radii in editable node parameters for future adjustment",()=>{
  const {project,parent}=fixture();
  const p=trayTarget(parent.id,project);
  const next=trayRoundingNodes(p,{outside:7,scoop:4});
  const newProject={...project,nodes:{...project.nodes,...next}};
  const reread=trayTarget(parent.id,newProject);
  expect(reread.initial.outside).toBe(7);
  expect(reread.initial.scoop).toBe(4);
  expect(traySettingsClamped(reread,{outside:999,scoop:999}).outside).toBeLessThan(999);
 });
});
describe("v19.4 actual Boolean and STL geometry",()=>{
 it("creates a smooth elevated floor edge while keeping a flat central floor",()=>{
  const {project,parent}=fixture(),p=trayTarget(parent.id,project);
  const source=evaluateGroup(parent,project.nodes);
  expect(source).not.toBeNull();
  if(!source)return;
  const original=meshFor(source);
  expect(floorAt(original,0,0)).toBeCloseTo(3,1);
  expect(floorAt(original,37.5,0)).toBeCloseTo(3,1);
  const changes=trayRoundingNodes(p,{outside:8,scoop:6});
  const geo=evaluateGroup(parent,{...project.nodes,...changes});
  expect(geo).not.toBeNull();
  if(!geo){source.dispose();return;}
  const rounded=meshFor(geo);
  expect(floorAt(rounded,0,0)).toBeCloseTo(3,1);
  expect(floorAt(rounded,37.5,0)).toBeGreaterThan(3.8);
  geo.computeBoundingBox();
  expect(geo.boundingBox!.min.z).toBeCloseTo(0,1);
  expect(geo.boundingBox!.max.z).toBeCloseTo(30,1);
  const exportScene=new THREE.Scene();exportScene.add(rounded);exportScene.updateMatrixWorld(true);
  const binary=new STLExporter().parse(exportScene,{binary:true}) as DataView;
  expect(binary.getUint32(80,true)).toBeGreaterThan(300);
  geo.dispose();source.dispose();
 });
});
describe("v19.4 user experience",()=>{
 it("uses existing corner button and supports direct mouse drag with Apply/Cancel",()=>{
  expect(toolbar).toContain('ad5x-tray-round');
  expect(toolbar).toContain('Drag-to-Round corners');
  expect(component).toContain("setPointerCapture");
  expect(component).toContain("FLOOR SCOOP");
  expect(component).toContain("CORNERS");
  expect(component).toContain("Apply");
  expect(component).toContain("Escape");
  expect(group).toContain("trayRoundingNodes");
  expect(viewport).toContain("<TrayRoundingHandles />");
  expect(app).toContain("<TrayRoundingPanel />");
  expect(app).not.toContain("sendToPrepare()");
 });
});
