import {describe,it,expect,vi} from "vitest";
import * as THREE from "three";
import {shellParts} from "./advancedModels";
import {nodeRole,isGroup,type Project,type GroupNode} from "../types/scene";
import {planComponentBoxMount,componentBoxMountParts,type ComponentBoxMountOptions} from "./componentBoxMount";
import {evaluateGroup} from "./csg";
vi.mock("../state/store",()=>({useScene:{getState:vi.fn(),setState:vi.fn()}}));
const fixture=():Project=>{
 const parts=shellParts(100,80,60,2,2);
 const root:GroupNode={id:"shell",type:"group",label:"Hollow box",
  childIds:parts.map(p=>p.id),position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]};
 return {id:"fixture",name:"keep",version:1,nodes:{[root.id]:root,
  ...Object.fromEntries(parts.map(n=>[n.id,n]))},rootOrder:[root.id]};
};
const options=(id:string,face:ComponentBoxMountOptions["face"]="front"):ComponentBoxMountOptions=>({
 componentId:id,face,offsetX:0,offsetY:0
});
describe("exact SKU cutouts on selected existing enclosure",()=>{
 it("cuts existing shell on each supported wall without replacing user geometry or existing IDs",()=>{
  for(const id of ["mr-c14-switch","itw-59-111"]){
   for(const face of ["front","back","left","right","floor"] as const){
    const old=fixture(),oldJSON=JSON.stringify(old),plan=planComponentBoxMount(old,"shell",options(id,face));
    expect(JSON.stringify(old)).toBe(oldJSON);
    expect(plan.project.rootOrder).toEqual([plan.selectionId]);
    expect((plan.project.nodes[plan.selectionId] as GroupNode).childIds[0]).toBe("shell");
    const group=plan.project.nodes[plan.cutoutGroupId];
    expect(isGroup(group)).toBe(true);
    expect(nodeRole(group as GroupNode,plan.project.nodes)).toBe("hole");
    if(!isGroup(group))throw Error("expected hole group");
    expect(group.component?.componentId).toBe(id);
    expect(group.component?.status).toBe("nominal_2d_template_unfit_tested");
    expect(group.childIds).toHaveLength(1); // Never fabricate mounting screws.
    const cutter=plan.project.nodes[plan.cutters[0]];
    expect(cutter&&!isGroup(cutter)).toBe(true);
    const geom=evaluateGroup(plan.project.nodes[plan.selectionId] as GroupNode,plan.project.nodes);
    expect(geom).not.toBeNull();
    geom?.dispose();
   }
  }
 });
 it("actually subtracts the requested wall centre (not only a visible cutter)",()=>{
  const rayByFace={
   front:{start:[0,-43,31],direction:[0,1,0]},
   back:{start:[0,43,31],direction:[0,-1,0]},
   left:{start:[-53,0,31],direction:[1,0,0]},
   right:{start:[53,0,31],direction:[-1,0,0]},
   floor:{start:[0,0,-3],direction:[0,0,1]},
  } as const;
  const nearest=(geom:THREE.BufferGeometry,start:readonly number[],direction:readonly number[])=>{
   const mesh=new THREE.Mesh(geom,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
   const hits=new THREE.Raycaster(
    new THREE.Vector3(...start as [number,number,number]),
    new THREE.Vector3(...direction as [number,number,number])).intersectObject(mesh);
   return hits[0]?.distance??Infinity;
  };
  for(const componentId of ["mr-c14-switch","itw-59-111"]){
  for(const face of ["front","back","left","right","floor"] as const){
   const before=fixture(),after=planComponentBoxMount(before,"shell",options(componentId,face));
   const raw=evaluateGroup(before.nodes.shell as GroupNode,before.nodes);
   const cut=evaluateGroup(after.project.nodes[after.selectionId] as GroupNode,after.project.nodes);
   expect(raw).not.toBeNull();expect(cut).not.toBeNull();
   const r=rayByFace[face];
   const baseHit=nearest(raw!,r.start,r.direction);
   const cutHit=nearest(cut!,r.start,r.direction);
   expect(baseHit).toBeLessThan(5);
   expect(cutHit).toBeGreaterThan(5);
   raw?.dispose();cut?.dispose();
  }
  }
 });
 it("keeps wall-local cutter depth and original 24mm movable cutout untouched",()=>{
  const p=fixture(),c=componentBoxMountParts(p,"shell",options("mr-c14-switch"));
  expect(c).toHaveLength(1);
  expect(c[0].params.h).toBe(4);
  expect(c[0].role).toBe("hole");
 });
 it("rejects every unknown aperture, impossible wall position and unsupported target, without edits",()=>{
  const p=fixture(),frozen=JSON.stringify(p);
  for(const id of ["mr-c14-no-switch","mr-ledh-03-conc","mr-led-03-pla","mr-fuse20","mr-car-fem-12v","communica-dpm-bmt"]){
   expect(()=>planComponentBoxMount(p,"shell",options(id))).toThrow("Measurements needed");
  }
  expect(()=>planComponentBoxMount(p,"shell",{...options("mr-c14-switch"),offsetX:70})).toThrow("edge");
  expect(()=>planComponentBoxMount(p,"shell",{...options("mr-c14-switch"),offsetX:Number.NaN})).toThrow("finite");
  expect(()=>planComponentBoxMount(p,"bogus",options("mr-c14-switch"))).toThrow();
  expect(JSON.stringify(p)).toBe(frozen);
 });
});
