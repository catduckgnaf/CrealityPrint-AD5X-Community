// @vitest-environment jsdom
import {describe,expect,it,vi} from "vitest";
vi.mock("../state/store",()=>({useScene:{getState:vi.fn(),setState:vi.fn()}}));
import {makeShape} from "./primitives";
import {shellParts} from "./advancedModels";
import {identifyShell,lidParts,type LidOptions} from "./boxFitTools";
import {planHingedLid,DEFAULT_HINGE_OPTIONS} from "./hingedLid";
import {serializeSceneModel} from "./exportStl";
import type {Project,GroupNode,ShapeNode} from "../types/scene";

const empty:Project={id:"transfer",name:"sample",version:1,nodes:{},rootOrder:[]};
const group=(label:string,parts:ShapeNode[]):GroupNode=>({
 id:label,type:"group",label,childIds:parts.map(p=>p.id),
 position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],
});
async function parseStl(blob:Blob){
 const bytes=await blob.arrayBuffer();
 const view=new DataView(bytes);
 const tris=view.getUint32(80,true);
 expect(bytes.byteLength).toBe(84+tris*50);
 expect(tris).toBeGreaterThan(0);
 const vertices:[number,number,number][]=[];
 for(let i=0;i<tris;i++){
  const at=84+50*i;
  for(let v=0;v<3;v++){
   const pos=at+12+12*v;
   const point:[number,number,number]=[
    view.getFloat32(pos,true),view.getFloat32(pos+4,true),
    view.getFloat32(pos+8,true),
   ];
   expect(point.every(Number.isFinite)).toBe(true);
   vertices.push(point);
  }
 }
 return {tris,vertices};
}
describe("actual binary STL generation for Creality Prepare",()=>{
 it("exports a single box with baked world XYZ, mm dimensions and exact binary triangle count",async()=>{
  const shape=makeShape("box");
  shape.params={w:20,d:10,h:4,radius:0};
  shape.position=[15,-5,2];
  const project={...empty,nodes:{[shape.id]:shape},rootOrder:[shape.id]};
  const s=serializeSceneModel(project,{format:"stl"});
  expect(s.exported).toBe(1);
  expect(s.skippedHoles).toBe(0);
  expect(s.blob).not.toBeNull();
  const {tris,vertices}=await parseStl(s.blob!);
  expect(tris).toBe(12);
  const mins=[0,1,2].map(i=>Math.min(...vertices.map(p=>p[i])));
  const maxs=[0,1,2].map(i=>Math.max(...vertices.map(p=>p[i])));
  expect(mins).toEqual([5,-10,0]);
  expect(maxs).toEqual([25,0,4]);
  expect(project.nodes[shape.id].position).toEqual([15,-5,2]);
 });
 it("does not export ungrouped cutter shapes or alter original nodes",()=>{
  const solid=makeShape("box");solid.params={w:12,d:10,h:5,radius:0};solid.position=[0,0,2.5];
  const hole=makeShape("cylinder");hole.role="hole";hole.position=[0,0,2.5];
  const p:Project={...empty,nodes:{[solid.id]:solid,[hole.id]:hole},rootOrder:[solid.id,hole.id]};
  const before=JSON.stringify(p);
  const o=serializeSceneModel(p);
  expect(o.exported).toBe(1);
  expect(o.skippedHoles).toBe(1);
  expect(o.blob).not.toBeNull();
  expect(JSON.stringify(p)).toBe(before);
 });
 it("exports both independent hinge-fitted print parts with real hole cuts, not only the box",async()=>{
  const boxParts=shellParts(80,60,22,2,2);
  const b=group("box",boxParts);
  let project:Project={...empty,nodes:{...Object.fromEntries(boxParts.map(n=>[n.id,n])),[b.id]:b},rootOrder:[b.id]};
  const opts:LidOptions={clearance:.3,thickness:2.4,lipDepth:4,lipWall:1.5,overhang:.5,bedGap:12};
  const lidShapes=lidParts(identifyShell("box",project),opts,[220,220]);
  const l=group("lid",lidShapes);
  project={...project,nodes:{...project.nodes,...Object.fromEntries(lidShapes.map(n=>[n.id,n])),[l.id]:l},rootOrder:["box","lid"]};
  const plan=planHingedLid(project,"box","lid",DEFAULT_HINGE_OPTIONS,[220,220]);
  const exportData=serializeSceneModel(plan.project);
  expect(exportData.exported).toBe(2);
  expect(exportData.skippedHoles).toBe(0);
  expect(exportData.blob).not.toBeNull();
  const {tris,vertices}=await parseStl(exportData.blob!);
  expect(tris).toBeGreaterThan(140);
  const xs=vertices.map(p=>p[0]),ys=vertices.map(p=>p[1]);
  expect(Math.max(...xs)-Math.min(...xs)).toBeGreaterThan(78);
  expect(Math.max(...ys)-Math.min(...ys)).toBeGreaterThan(130);
  expect(plan.project.rootOrder).toHaveLength(2);
 });
});