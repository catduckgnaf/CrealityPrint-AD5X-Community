import {describe,it,expect} from "vitest";
import * as THREE from "three";
import {STLExporter} from "three/addons/exporters/STLExporter.js";
import {bendNeutralPoint,bentBoxGeometry,maxBendAngle,checkedBendAngle} from "./liveBendGeometry";
import {buildGeometry,makeShape} from "./primitives";
import {validateProject} from "./projectFile";
import app from "../App.tsx?raw";
import bar from "../components/Toolbar.tsx?raw";
import mesh from "../components/ShapeMesh.tsx?raw";
import controls from "../components/LiveBendControls.tsx?raw";
import viewport from "../components/Viewport.tsx?raw";
import exporter from "./exportStl.ts?raw";

function signedVolume(g:THREE.BufferGeometry):number{
 const a=g.getAttribute("position");
 const ind=g.getIndex();
 let vol=0;
 for(let i=0;i<(ind?.count??a.count);i+=3){
  const index=(n:number)=>ind?ind.getX(n):n;
  const x=index(i),y=index(i+1),z=index(i+2);
  const ax=a.getX(x),ay=a.getY(x),az=a.getZ(x);
  const bx=a.getX(y),by=a.getY(y),bz=a.getZ(y);
  const cx=a.getX(z),cy=a.getY(z),cz=a.getZ(z);
  vol+=(ax*(by*cz-bz*cy)+ay*(bz*cx-bx*cz)+az*(bx*cy-by*cx))/6;
 }
 return vol;
}
describe("v19.1 real geometry live bend",()=>{
 it("zero angle is an unchanged box",()=>{
  const g=bentBoxGeometry(100,12,6,0);
  expect(g.boundingBox).toBeNull();
  expect(Math.abs(signedVolume(g))).toBeCloseTo(7200,0);
  g.dispose();
 });
 it("bends X along a circular neutral axis without shortening its centreline",()=>{
  const a=60,w=100;
  const [x,z]=bendNeutralPoint(w/2,0,w,a);
  expect(x).toBeCloseTo((w/(Math.PI/3))*Math.sin(Math.PI/6),4);
  expect(z).toBeGreaterThan(10);
  expect(bendNeutralPoint(0,3,w,a)).toEqual([0,3]);
  const g=bentBoxGeometry(100,12,6,a);
  g.computeBoundingBox();
  expect(g.boundingBox!.max.z).toBeGreaterThan(10);
  expect(g.boundingBox!.max.x).toBeLessThan(50);
  expect(Math.abs(signedVolume(g))).toBeGreaterThan(6900);
  expect(Math.abs(signedVolume(g))).toBeLessThan(7450);
  g.dispose();
 });
 it("supports the opposite bend direction while preserving cross-section",()=>{
  const positive=bendNeutralPoint(48,0,100,70);
  const negative=bendNeutralPoint(48,0,100,-70);
  expect(positive[0]).toBeCloseTo(negative[0],6);
  expect(positive[1]).toBeCloseTo(-negative[1],6);
  for(const a of [-80,80]){
   const g=bentBoxGeometry(100,12,6,a);
   expect(Math.abs(signedVolume(g))).toBeGreaterThan(6900);
   g.dispose();
  }
 });
 it("rejects angles that could turn the inner surface inside-out",()=>{
  const max=maxBendAngle(20,20);
  expect(max).toBeLessThan(120);
  expect(()=>checkedBendAngle(max+5,20,20)).toThrow("safe limit");
  expect(()=>bentBoxGeometry(20,20,20,160)).toThrow();
  expect(maxBendAngle(100,6)).toBe(150);
 });
 it("saves and reloads the bend parameter through the existing scene format",()=>{
  const node=makeShape("box");
  node.params={w:100,d:12,h:6,bendAngle:60};
  const doc={version:1,id:"bend-project",name:"Bend test",nodes:{[node.id]:node},rootOrder:[node.id]};
  const cleaned=validateProject(doc);
  const saved=cleaned.nodes[node.id];
  expect(saved && "params" in saved && saved.params.bendAngle).toBe(60);
  const g=buildGeometry(saved as typeof node)!;
  g.computeBoundingBox();
  expect(g.boundingBox!.max.x).toBeLessThan(50);
  g.dispose();
 });
 it("exports the same curved triangles in binary STL, not a visual shader",()=>{
  const node=makeShape("box");
  node.params={w:100,d:12,h:6,bendAngle:60};
  const g=buildGeometry(node)!;
  const scene=new THREE.Scene();
  scene.add(new THREE.Mesh(g,new THREE.MeshBasicMaterial()));
  scene.updateMatrixWorld(true);
  const encoded=new STLExporter().parse(scene,{binary:true}) as DataView;
  expect(encoded.getUint32(80,true)).toBeGreaterThan(200);
  const total=encoded.getUint32(80,true);
  let maxZ=-Infinity;
  for(let i=0;i<total;i++){
   const start=84+i*50+12;
   for(let j=0;j<3;j++)maxZ=Math.max(maxZ,encoded.getFloat32(start+j*12+8,true));
  }
  expect(maxZ).toBeGreaterThan(10);
  g.dispose();
 });
 it("shows true drag-to-bend preview, apply and escape without touching Send to Prepare",()=>{
  expect(bar).toContain('label="Live Bend (drag a straight part)"');
  expect(app).toContain("<LiveBendPanel />");
  expect(mesh).toContain("bendPreview");
  expect(controls).toContain("setPointerCapture");
  expect(controls).toContain("Apply bend");
  expect(viewport).toContain("const showStandardHandles=!bending&&!directEditing");
  expect(viewport).toContain("{showStandardHandles && <ResizeHandles />}");
  expect(viewport).toContain("{showStandardHandles && <Gizmo />}");
  expect(exporter).toContain("buildGeometry(node)");
  expect(app).not.toContain("sendToPrepare()");
 });
});
