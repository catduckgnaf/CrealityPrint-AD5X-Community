import {describe,it,expect,vi} from "vitest";
import * as THREE from "three";
import {shellParts} from "./advancedModels";
import {evaluateGroup} from "./csg";
import {planUserSizedComponentCut,type UserSizedCutOptions} from "./userSizedComponentCut";
import {isGroup,type GroupNode,type Project} from "../types/scene";
vi.mock("../state/store",()=>({useScene:{getState:vi.fn(),setState:vi.fn()}}));
const ids=[
 "mr-c14-no-switch","mr-ledh-03-conc","mr-led-03-pla",
 "mr-fuse20","mr-car-fem-12v","communica-dpm-bmt"
];
const fixture=():Project=>{
 const parts=shellParts(100,80,60,2,2);
 const root:GroupNode={id:"shell",type:"group",label:"Hollow shell",childIds:parts.map(p=>p.id),
 position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]};
 return {id:"manual-test",name:"untouched",version:1,rootOrder:["shell"],
  nodes:{[root.id]:root,...Object.fromEntries(parts.map(p=>[p.id,p]))}};
};
const options=(componentId:string,shape:UserSizedCutOptions["shape"],face:UserSizedCutOptions["face"]="front"):UserSizedCutOptions=>({
 componentId,shape,face,offsetX:0,offsetY:0,width:8,...(shape==="rectangle"?{height:6}:{})
});
describe("manual dimensioned component holes — no false manufacturer verification",()=>{
 it("supports every one of the six missing-SKU records and both shapes on every wall",()=>{
  for(const id of ids)for(const shape of ["circle","rectangle"] as const)
   for(const face of ["front","back","left","right","floor"] as const){
    const input=fixture(),oldJSON=JSON.stringify(input);
    const plan=planUserSizedComponentCut(input,"shell",options(id,shape,face));
    expect(JSON.stringify(input)).toEqual(oldJSON);
    expect(plan.project.rootOrder).toEqual([plan.selectionId]);
    const parent=plan.project.nodes[plan.selectionId];
    expect(isGroup(parent)).toBe(true);
    const cutter=plan.project.nodes[plan.cutters[0]];
    expect(cutter&&!isGroup(cutter)).toBe(true);
    if(!cutter||isGroup(cutter))throw Error("Missing editable cutter");
    expect(cutter.label).toContain("USER-SIZED UNVERIFIED");
    expect(cutter.role).toBe("hole");
    expect(cutter.params.h).toBe(4);
    const group=plan.project.nodes[plan.cutoutGroupId];
    expect(isGroup(group)&&!group.component).toBe(true);
   }
 });
 it("really removes material from existing shell at every face for both manual shapes",()=>{
  const rays={
   front:{start:[0,-43,31],direction:[0,1,0]},
   back:{start:[0,43,31],direction:[0,-1,0]},
   left:{start:[-53,0,31],direction:[1,0,0]},
   right:{start:[53,0,31],direction:[-1,0,0]},
   floor:{start:[0,0,-3],direction:[0,0,1]},
  }as const;
  const nearest=(g:THREE.BufferGeometry,start:readonly number[],direction:readonly number[])=>{
   const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
   const hits=new THREE.Raycaster(new THREE.Vector3(...start as [number,number,number]),
    new THREE.Vector3(...direction as [number,number,number])).intersectObject(m);
   return hits[0]?.distance??Infinity;
  };
  for(const shape of ["circle","rectangle"] as const)
   for(const face of ["front","back","left","right","floor"] as const){
    const p=fixture(),r=rays[face];
    const after=planUserSizedComponentCut(p,"shell",options("mr-led-03-pla",shape,face));
    const g=evaluateGroup(after.project.nodes[after.selectionId] as GroupNode,after.project.nodes);
    expect(g).not.toBeNull();
    expect(nearest(g!,r.start,r.direction)).toBeGreaterThan(5);
    g?.dispose();
   }
 });
 it("rejects auto-documented SKUs, missing dimensions, invalid shapes and oversize edges",()=>{
  const p=fixture(),prior=JSON.stringify(p);
  const good=options("mr-ledh-03-conc","circle");
  for(const id of ["mr-c14-switch","itw-59-111"])
   expect(()=>planUserSizedComponentCut(p,"shell",{...good,componentId:id})).toThrow("documented");
  expect(()=>planUserSizedComponentCut(p,"shell",{...good,width:0})).toThrow("Enter real");
  expect(()=>planUserSizedComponentCut(p,"shell",{...good,width:NaN})).toThrow("Enter real");
  expect(()=>planUserSizedComponentCut(p,"shell",{...good,shape:"rectangle",height:undefined})).toThrow("Enter real");
  expect(()=>planUserSizedComponentCut(p,"shell",{...good,width:96})).toThrow("3 mm");
  expect(()=>planUserSizedComponentCut(p,"shell",{...good,offsetX:Infinity})).toThrow("finite");
  expect(()=>planUserSizedComponentCut(p,"bogus",good)).toThrow();
  expect(JSON.stringify(p)).toEqual(prior);
 });
});
