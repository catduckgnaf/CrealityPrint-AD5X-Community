import {describe,it,expect} from "vitest";
import * as THREE from "three";
import {STLExporter} from "three/addons/exporters/STLExporter.js";
import {makeShape,buildGeometry} from "./primitives";
import {
  stretchedFace,clampStretch,roundedCornerPreview,initialCornerRadius,safeCornerMaximum
} from "./directEditCore";
import {parsePicks} from "./rounding";
import {validateProject} from "./projectFile";
import app from "../App.tsx?raw";
import toolbar from "../components/Toolbar.tsx?raw";
import controls from "../components/DirectEditControls.tsx?raw";
import mesh from "../components/ShapeMesh.tsx?raw";
import viewport from "../components/Viewport.tsx?raw";
import state from "./directEditState.ts?raw";

const initial=()=>{
 const s=makeShape("box");
 s.params={w:80,d:40,h:20};s.position=[12,15,10];
 return s;
};
describe("v19.2 direct pull math",()=>{
 for(const axis of [0,1,2] as const){
  for(const sign of [-1,1] as const){
   it("moves only the "+["X","Y","Z"][axis]+(sign>0?"+":"-")+" face",()=>{
    const node=initial(),dim=["w","d","h"][axis] as "w"|"d"|"h";
    const before=Number(node.params[dim]),originalPos=node.position[axis];
    const next=stretchedFace(node,{axis,sign},13);
    expect(next.params[dim]).toBe(before+13);
    expect(next.position[axis]).toBeCloseTo(originalPos+sign*6.5,6);
    const fixed=originalPos-sign*before/2;
    const nextFixed=next.position[axis]-sign*(before+13)/2;
    expect(nextFixed).toBeCloseTo(fixed,6);
    expect(node.params[dim]).toBe(before);
    expect(node.position[axis]).toBe(originalPos);
   });
  }
 }
 it("limits face changes to positive dimensions, while allowing contractions",()=>{
  const node=initial(),face={axis:0 as const,sign:-1 as const};
  expect(clampStretch(node,face,-150)).toBe(-79);
  expect(clampStretch(node,face,300)).toBe(220);
  expect(()=>stretchedFace(node,face,-90)).toThrow();
  expect(stretchedFace(node,face,-20).params.w).toBe(60);
 });
 it("uses actual CAD geometry and exports a stretched closed solid",()=>{
  const node=stretchedFace(initial(),{axis:0,sign:1},20);
  const g=buildGeometry(node)!;
  g.computeBoundingBox();
  expect(g.boundingBox!.max.x-g.boundingBox!.min.x).toBeCloseTo(100,2);
  const mesh3=new THREE.Mesh(g,new THREE.MeshBasicMaterial());
  mesh3.position.set(...node.position);
  mesh3.updateMatrixWorld(true);
  const scene=new THREE.Scene();scene.add(mesh3);
  const data=new STLExporter().parse(scene,{binary:true}) as DataView;
  expect(data.getUint32(80,true)).toBeGreaterThanOrEqual(12);
  g.dispose();
 });
});
describe("v19.2 live corner rounding preserves old box edges",()=>{
 it("changes only four upright edges and leaves horizontal fillets untouched",()=>{
  const node=initial();
  node.params.edges="0@1.5,8@1,9@1";
  const next=roundedCornerPreview(node,3);
  const p=parsePicks("box",next.params);
  expect(["8","9","10","11"].map(i=>p.get(i))).toEqual([3,3,3,3]);
  expect(p.get("0")).toBe(1.5);
  expect(node.params.edges).toBe("0@1.5,8@1,9@1");
 });
 it("provides undo-compatible initial radius and validates safety",()=>{
  const node=initial();
  expect(initialCornerRadius(node)).toBe(0);
  const next=roundedCornerPreview(node,2);
  expect(initialCornerRadius(next)).toBe(2);
  expect(safeCornerMaximum(node)).toBeGreaterThanOrEqual(2);
  expect(()=>roundedCornerPreview(node,safeCornerMaximum(node)+1)).toThrow();
 });
 it("committed rounded shape persists across project JSON validation",()=>{
  const node=roundedCornerPreview(initial(),2);
  const saved=validateProject({
    id:"round",version:1,name:"Test",rootOrder:[node.id],nodes:{[node.id]:node}
  });
  const shape=saved.nodes[node.id];
  expect(shape&&"params" in shape&&parsePicks("box",shape.params).get("11")).toBe(2);
 });
});
describe("v19.2 progressive UI",()=>{
 it("provides both tools from the existing toolbar",()=>{
  expect(toolbar).toContain('label="Grab & Pull faces"');
  expect(toolbar).toContain('label="Drag-to-Round corners"');
  expect(app).toContain("<DirectEditPanel />");
  expect(viewport).toContain("<DirectEditHandles />");
 });
 it("previews without modifying project until one explicit Apply",()=>{
  expect(mesh).toContain("previewEditedBox(node,directSession)");
  expect(state).toContain("useScene.getState().updateShape");
  expect(controls).toContain("setPointerCapture");
  expect(controls).toContain("Escape");
  expect(controls).toContain("Apply");
  expect(viewport).toContain("showStandardHandles");
  expect(state).toContain("Math.min(s.max,quantized)");
  expect(controls).toContain('window.addEventListener("ad5x-live-bend",closeForBend)');
 });
});
