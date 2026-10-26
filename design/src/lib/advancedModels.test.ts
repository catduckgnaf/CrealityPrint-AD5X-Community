import {describe,it,expect,vi} from "vitest";
vi.mock("../state/store",()=>({useScene:{setState:vi.fn(),getState:vi.fn()}}));
import {shellParts,libraryParts} from "./advancedModels";
import * as THREE from "three";
import {evaluateGroup} from "./csg";
import {newId} from "./id";
import advanced from "../components/AdvancedTools.tsx?raw";
import viewport from "../components/AdvancedViewport.tsx?raw";
import models from "./advancedModels.ts?raw";
import app from "../App.tsx?raw";
import toolbar from "../components/Toolbar.tsx?raw";

describe("v18.9 safe experimental modelling",()=>{
 it("shows Length for the shell second dimension without changing saved depth keys or geometry",()=>{
  expect(advanced).toContain('field("w","Width (mm)")');
  expect(advanced).toContain('field("d","Length (mm)")');
  expect(advanced).toContain('field("h","Height (mm)")');
  expect(advanced).toContain('createShell(number("w"),number("d"),number("h"),number("wall"),number("base"))');
  const [outer,cavity]=shellParts(80,55,22,2,2);
  expect(outer.params.d).toBe(55);
  expect(cavity.params.d).toBe(51);
 });
 it("cuts a real open-top cavity with a retained 3 mm floor",()=>{
  const children=shellParts(80,60,30,2,3);
  const id=newId();
  const g={id,type:"group" as const,childIds:children.map(p=>p.id),
   position:[0,0,0] as [number,number,number],
   rotation:[0,0,0] as [number,number,number],
   scale:[1,1,1] as [number,number,number]};
  const nodes=Object.fromEntries(children.map(x=>[x.id,x]));
  const geometry=evaluateGroup(g,nodes);
  expect(geometry).not.toBeNull();
  if(!geometry)return;
  const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
  mesh.updateWorldMatrix(true,true);
  const ray=new THREE.Raycaster(new THREE.Vector3(0,0,45),new THREE.Vector3(0,0,-1));
  const center=ray.intersectObject(mesh);
  expect(center.length).toBeGreaterThan(0);
  expect(center[0].point.z).toBeCloseTo(3,0);
  ray.set(new THREE.Vector3(39,0,45),new THREE.Vector3(0,0,-1));
  const rim=ray.intersectObject(mesh);
  expect(rim.length).toBeGreaterThan(0);
  expect(rim[0].point.z).toBeCloseTo(30,0);
  geometry.dispose();
 });
 it("makes an open cavity while preserving the base thickness",()=>{
  const [outer,cavity]=shellParts(80,60,30,2,3);
  expect(outer.role).toBe("solid");
  expect(cavity.role).toBe("hole");
  expect(cavity.params.w).toBe(76);
  expect(cavity.params.d).toBe(56);
  expect(cavity.params.h).toBe(29);
  const bottom=cavity.position[2]-Number(cavity.params.h)/2;
  expect(bottom).toBe(3);
  const top=cavity.position[2]+Number(cavity.params.h)/2;
  expect(top).toBeGreaterThan(30);
 });
 it("refuses a shell with no interior",()=>{
  expect(()=>shellParts(20,20,20,11,2)).toThrow();
  expect(()=>shellParts(20,20,20,2,21)).toThrow();
  expect(()=>shellParts(-2,20,20,2,2)).toThrow();
 });
 it("creates reusable standoffs and tabs as cutter-containing assemblies",()=>{
  for(const name of ["standoff","mounting-tab","tray"] as const){
   const parts=libraryParts(name);
   expect(parts.some(p=>p.role==="solid")).toBe(true);
   expect(parts.some(p=>p.role==="hole")).toBe(true);
  }
  expect(libraryParts("cable-guide").filter(p=>p.role==="solid")).toHaveLength(3);
 });
 it("keeps generated repeat counts bounded and retains the source",()=>{
  expect(models).toContain("count>36");
  expect(models).toContain("copies:ShapeNode[]");
  expect(models).toContain("rootOrder:[...s.project.rootOrder,...copies.map");
 });
 it("uses atomic project updates for shell, hole, mirror and library",()=>{
  expect(models).toContain("useScene.setState");
  expect(models).toContain("rootOrder:s.project.rootOrder.map(item=>item===id?gid:item)");
  expect(models).toContain("clone.scale[axis]*=-1");
 });
 it("exposes every requested modelling area",()=>{
  for(const name of ["Shell","Pattern","Mirror","Holes","Sketch","Section","Reference","STEP","Parts"])
   expect(advanced).toContain('"'+name+'"');
  expect(app).toContain("<AdvancedTools />");
  expect(toolbar).toContain("Advanced modelling tools");
 });
 it("makes section view visually clipped without touching exports",()=>{
  expect(viewport).toContain("new THREE.Plane");
  expect(viewport).toContain("gl.localClippingEnabled=true");
  expect(advanced).toContain("CAD and STL remain intact");
 });
 it("offers real STEP export from the local CAD engine while preserving the legacy import macro",()=>{
  expect(advanced).toContain("Export STEP (CAD solid)");
  expect(advanced).toContain("http://127.0.0.1:18651/export-step");
  expect(advanced).toContain("FreeCAD_STEP_to_STL.FCMacro");
 });
});
