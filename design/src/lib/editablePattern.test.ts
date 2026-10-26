// @vitest-environment jsdom
import {describe,it,expect,vi} from "vitest";
import * as THREE from "three";
import {makeShape} from "./primitives";
import {planHolePattern} from "./holePattern";
import {baseLocalBounds,editablePattern,updatePatternGeometry} from "./editablePattern";
import {validateProject} from "./projectFile";
import type {GroupNode,Project,ShapeNode} from "../types/scene";
import {evaluateGroup} from "./csg";
import {STLLoader} from "three/addons/loaders/STLLoader.js";

const exports=vi.hoisted(()=>({blob:null as Blob|null}));
vi.mock("./download",()=>({
  downloadBlob:(blob:Blob)=>{exports.blob=blob;},
  safeFilename:(name:string)=>name,
}));
import {exportSceneStl} from "./exportStl";

function fixture():{project:Project;group:GroupNode;base:ShapeNode} {
  const base=makeShape("box");
  base.params={w:100,d:60,h:8,radius:0};
  base.position=[10,20,4];
  const bounds=baseLocalBounds(base)!;
  const plan=planHolePattern(bounds,"four",12,4);
  if (plan.error) throw new Error(plan.error);
  const holes=plan.points.map(pos=>{
    const h=makeShape("cylinder");
    h.role="hole";
    h.params={r:2,h:plan.height,segments:64,bevel:0};
    h.position=[...pos];
    return h;
  });
  const group:GroupNode={
    id:"test-group",type:"group",childIds:[base.id,...holes.map(h=>h.id)],
    position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],
    holePattern:{baseId:base.id,holeIds:holes.map(h=>h.id),layout:"four",diameter:4,offset:12},
  };
  const nodes:Project["nodes"]={[base.id]:base,[group.id]:group};
  holes.forEach(h=>{nodes[h.id]=h;});
  return {project:{id:"test",name:"STL Test",version:1,nodes,rootOrder:[group.id]},group,base};
}
describe("editable hole pattern, saved model and STL",()=>{
  it("detects original grouped holes and exact editable dimensions",()=>{
    const {project,group}=fixture();
    expect(editablePattern(group,project.nodes)).toMatchObject({diameter:4,offset:12,layout:"four"});
  });
  it("can edit diameter and edge-to-centre in one update, leaving hole IDs and base unchanged",()=>{
    const {project,group,base}=fixture();
    const updated=updatePatternGeometry(group,project.nodes,{...group.holePattern!,diameter:6,offset:15});
    expect(updated.error).toBeUndefined();
    expect(updated.nodes[base.id]).toBe(base);
    expect(updated.group.childIds).toEqual(group.childIds);
    const first=updated.nodes[group.childIds[1]] as ShapeNode;
    expect(first.position).toEqual([-25,5,4]);
    expect(first.params.r).toBe(3);
  });
  it("does not overwrite a manually moved hole",()=>{
    const {project,group}=fixture();
    const id=group.childIds[1];
    const manuallyMoved={...project.nodes,[id]:{...project.nodes[id],position:[0,0,0] as [number,number,number]}};
    const change=updatePatternGeometry(group,manuallyMoved,{...group.holePattern!,offset:15,diameter:6});
    expect(change.error).toMatch(/manually/);
    expect(change.nodes).toBe(manuallyMoved);
  });
  it("rejects an impossible edit instead of corrupting holes",()=>{
    const {project,group}=fixture();
    const before=JSON.stringify(project.nodes);
    const change=updatePatternGeometry(group,project.nodes,{...group.holePattern!,offset:40,diameter:6});
    expect(change.error).toBeTruthy();
    expect(JSON.stringify(project.nodes)).toBe(before);
  });
  it("saves and reopens pattern settings in project file validation",()=>{
    const {project,group}=fixture();
    const recovered=validateProject(JSON.parse(JSON.stringify(project)));
    const node=recovered.nodes[group.id] as GroupNode;
    expect(node.holePattern).toEqual(group.holePattern);
    expect(editablePattern(node,recovered.nodes)?.offset).toBe(12);
  });
  it("recognises pre-upgrade v16 grouped holes without metadata",()=>{
    const {project,group}=fixture();
    const old={...group,holePattern:undefined};
    expect(editablePattern(old,{...project.nodes,[group.id]:old})?.offset).toBeCloseTo(12);
  });
  it("protects malformed saved group metadata",()=>{
    const {project,group}=fixture();
    const corrupted=JSON.parse(JSON.stringify(project));
    corrupted.nodes[group.id].holePattern.offset=-1;
    expect(()=>validateProject(corrupted)).toThrow();
  });
  it("CSG cuts four real through-holes (not visual circles)",()=>{
    const {project,group}=fixture();
    const geo=evaluateGroup(group,project.nodes);
    expect(geo).not.toBeNull();
    const mesh=new THREE.Mesh(geo!,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
    mesh.updateMatrixWorld(true);
    const hole=new THREE.Raycaster(new THREE.Vector3(-28,2,30),new THREE.Vector3(0,0,-1));
    expect(hole.intersectObject(mesh).length).toBe(0);
    geo!.computeBoundingBox();
    expect(geo!.getAttribute("position").count).toBeGreaterThan(100);
    geo?.dispose();
  });
  it("Design STL export can be parsed with STLLoader and retains holes and dimensions",async()=>{
    const {project}=fixture();
    exports.blob=null;
    const r=exportSceneStl(project,{format:"stl"});
    expect(r).toEqual({exported:1,skippedHoles:0});
    expect(exports.blob).not.toBeNull();
    const arr=await exports.blob!.arrayBuffer();
    const parsed=new STLLoader().parse(arr);
    parsed.computeBoundingBox();
    expect(parsed.boundingBox!.max.x - parsed.boundingBox!.min.x).toBeCloseTo(100,1);
    expect(parsed.boundingBox!.max.y - parsed.boundingBox!.min.y).toBeCloseTo(60,1);
    expect(parsed.boundingBox!.max.z - parsed.boundingBox!.min.z).toBeCloseTo(8,1);
    const mesh=new THREE.Mesh(parsed,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
    mesh.updateMatrixWorld(true);
    const through=new THREE.Raycaster(new THREE.Vector3(-28,2,30),new THREE.Vector3(0,0,-1));
    expect(through.intersectObject(mesh).length).toBe(0);
    parsed.dispose();
  });
});
