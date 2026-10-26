import {describe,it,expect,vi} from "vitest";
vi.mock("../state/store",()=>({useScene:{getState:vi.fn(),setState:vi.fn()}}));
import {makeShape} from "./primitives";
import {connectorPrefabNodes} from "./connectorPrefabs";
import {evaluateGroup} from "./csg";
import type {GroupNode,SceneNode} from "../types/scene";
import type {BufferGeometry} from "three";

/** True mesh volume from oriented output triangles, not just bounding boxes. */
function volume(mesh:BufferGeometry):number {
 const p=mesh.getAttribute("position"),ind=mesh.getIndex();
 const count=ind?ind.count:p.count;
 if(count%3)throw Error("Untriangulated Boolean result");
 let result=0;
 for(let i=0;i<count;i+=3) {
  const ia=ind?ind.getX(i):i,ib=ind?ind.getX(i+1):i+1,ic=ind?ind.getX(i+2):i+2;
  const ax=p.getX(ia),ay=p.getY(ia),az=p.getZ(ia);
  const bx=p.getX(ib),by=p.getY(ib),bz=p.getZ(ib);
  const cx=p.getX(ic),cy=p.getY(ic),cz=p.getZ(ic);
  result+=ax*(by*cz-bz*cy)+ay*(bz*cx-bx*cz)+az*(bx*cy-by*cx);
 }
 return Math.abs(result/6);
}

describe("nominal component Boolean acceptance: actual output mesh",()=>{
 for(const id of ["component-mr-c14-switch","component-itw-59-111"] as const){
  it(id+" actually removes volume from a panel, not just draws a cutter",()=>{
   const body=makeShape("box");body.role="solid";body.params={w:90,d:25,h:50,radius:0};
   body.position=[0,0,25];
   const cutter=connectorPrefabNodes(id);
   const parent:GroupNode={id:"acceptance-parent",type:"group",label:"Test panel",
    position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],childIds:[body.id,cutter.group.id]};
   const hole={...cutter.group,position:[0,-11,25] as [number,number,number]};
   const solidGroup={...parent,childIds:[body.id]};
   const nodes:Record<string,SceneNode>={
    [body.id]:body,[parent.id]:parent,[hole.id]:hole,
    ...Object.fromEntries(cutter.parts.map(p=>[p.id,p]))
   };
   const before=evaluateGroup(solidGroup,nodes);
   const after=evaluateGroup(parent,nodes);
   expect(before).not.toBeNull();expect(after).not.toBeNull();
   const beforeV=volume(before!),afterV=volume(after!);
   before!.dispose();after!.dispose();
   expect(beforeV).toBeGreaterThan(110000);
   expect(afterV).toBeGreaterThan(0);
   expect(afterV).toBeLessThan(beforeV-100);
  });
 }
});
