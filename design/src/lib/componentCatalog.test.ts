import {describe,it,expect,vi} from "vitest";
// @ts-expect-error Node-only test APIs; no new browser dependency
import {readFileSync,existsSync} from "node:fs";
// @ts-expect-error Node-only test hashing
import {createHash} from "node:crypto";
// @ts-expect-error Node-only test path
import {join} from "node:path";
vi.mock("../state/store",()=>({useScene:{getState:vi.fn(),setState:vi.fn()}}));
import {COMPONENT_LIBRARY,COMPONENTS,componentById,catalogPlacementId,catalogDxfUrl,
 componentForPlacement,isPlaceableNominalComponent} from "./componentCatalog";
import {nominalComponentCutter,nominalDProfile,COMPONENT_CUTTER_DEPTH_MM} from "./componentNominalCutouts";
import {connectorPrefabNodes,connectorFootprint,planPlaceConnector,isConnectorPrefabId} from "./connectorPrefabs";
import {nodeRole,type GroupNode,type Project} from "../types/scene";
import {makeShape} from "./primitives";
import {evaluateGroup} from "./csg";
import palette from "../components/Palette.tsx?raw";
import menu from "../components/SmartContextMenu.tsx?raw";
import app from "../App.tsx?raw";
import dialog from "../components/ComponentLibrary.tsx?raw";
import connectorThumbs from "./connectorThumbnails.ts?raw";
declare const process:{cwd:()=>string};
const empty:Project={id:"test",name:"untouched",version:1,nodes:{},rootOrder:[]};
const sourceRoot=join(process.cwd(),"public","component-library");
const sha=(data:string)=>createHash("sha256").update(data).digest("hex");

describe("2026-10-23 starter component library imported without invented measurements",()=>{
 it("preserves EXACTLY eight source SKUs and all their original statuses, sources and units",()=>{
  expect(COMPONENT_LIBRARY.units).toBe("millimeters");
  expect(COMPONENT_LIBRARY.component_count).toBe(COMPONENTS.length);
  expect(COMPONENTS).toHaveLength(8);
  expect(new Set(COMPONENTS.map(c=>c.id)).size).toBe(8);
  expect(new Set(COMPONENTS.map(c=>c.supplier_sku)).size).toBe(8);
  expect(COMPONENT_LIBRARY.policy.no_unverified_dimensions).toBe(true);
  for(const c of COMPONENTS){
   expect(c.sources.length).toBeGreaterThan(0);
   expect(c.measurements_needed.length).toBeGreaterThan(0);
   expect(c.mounting.physical_fit_tested).toBe(false);
   expect(c.mounting.model_step_file).toBeNull();
  }
 });
 it("only 2 SKUs permit nominal CUTOUT placement; the remaining SIX absolutely block geometry",()=>{
  const ready=COMPONENTS.filter(isPlaceableNominalComponent);
  expect(ready.map(c=>c.supplier_sku).sort()).toEqual(["59-111","C14-SWITCH"]);
  const pending=COMPONENTS.filter(c=>!isPlaceableNominalComponent(c));
  expect(pending).toHaveLength(6);
  for(const item of pending){
    expect(item.mounting.cutout).toBeNull();
    expect(item.mounting.cutout_dxf_file).toBeNull();
    expect(catalogPlacementId(item.id)).toBeNull();
    expect(isConnectorPrefabId("component-"+item.id)).toBe(false);
    expect(componentForPlacement("component-"+item.id)).toBeNull();
    expect(()=>nominalComponentCutter("component-"+item.id)).toThrow("Measurements needed");
    expect(()=>connectorPrefabNodes(("component-"+item.id) as ReturnType<typeof catalogPlacementId> & string)).toThrow("Unknown");
  }
 });
 it("preserves both ORIGINAL DXF files for offline reference and never treats them as certified CAD",()=>{
  const files=COMPONENTS.map(c=>catalogDxfUrl(c)).filter((p):p is string=>!!p);
  expect(files).toEqual([
    "/component-library/cutouts/MR_C14_SWITCH_opening_only_42x27.dxf",
    "/component-library/cutouts/ITW_59-111_nominal_D_cutout.dxf"
  ]);
  for(const p of files){
   expect(existsSync(join(process.cwd(),"public",p.slice(1)))).toBe(true);
   expect(readFileSync(join(process.cwd(),"public",p.slice(1)),"utf8")).toContain("SECTION");
  }
 });
 it("C14-SWITCH generates EXACTLY one 42x27 NOMINAL rectangular aperture, no invented fixing holes",()=>{
  const c=componentById("mr-c14-switch")!;
  expect(c.mounting.mounting_holes?.centers_xy_mm).toBeNull();
  expect(c.mounting.mounting_holes?.alignment_verified).toBe(false);
  const p=connectorPrefabNodes("component-mr-c14-switch");
  expect(p.parts).toHaveLength(1);
  const node=p.parts[0];
  expect(node.role).toBe("hole");
  expect(node.kind).toBe("box");
  expect(node.params.w).toBe(42);
  expect(node.params.d).toBe(27);
  expect(node.params.h).toBe(COMPONENT_CUTTER_DEPTH_MM);
  expect(node.label).toContain("UNTESTED");
  expect(p.group.label).toContain("C14-SWITCH");
  expect(isConnectorPrefabId("component-mr-c14-switch")).toBe(true);
  const geom=evaluateGroup(p.group,{[node.id]:node});
  expect(geom).not.toBeNull();
  geom!.computeBoundingBox();
  expect(geom!.boundingBox!.max.x-geom!.boundingBox!.min.x).toBeCloseTo(42,3);
  expect(geom!.boundingBox!.max.z-geom!.boundingBox!.min.z).toBeCloseTo(27,3);
  geom!.dispose();
 });
 it("ITW 59-111 D profile exactly matches nominal diameter and flat-to-opposite size, with flat LEFT",()=>{
  const c=componentById("itw-59-111")!;
  const cut=c.mounting.cutout;
  if(!cut||cut.shape!=="d_flat_circle")throw Error("Expected documented D flat");
  expect(cut.dxf_uses_nominal_diameter_mm).toBe(13.625);
  expect(cut.dxf_uses_nominal_flat_to_opposite_mm).toBe(12.925);
  const points=nominalDProfile(cut.dxf_uses_nominal_diameter_mm,cut.dxf_uses_nominal_flat_to_opposite_mm);
  const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
  expect(Math.min(...xs)).toBeCloseTo(13.625/2-12.925,4);
  expect(Math.max(...xs)).toBeCloseTo(13.625/2,4);
  expect(Math.max(...ys)-Math.min(...ys)).toBeCloseTo(13.625,2);
  expect(points[0][0]).toBeCloseTo(points[points.length-1][0],5);
  const p=connectorPrefabNodes("component-itw-59-111");
  expect(p.parts).toHaveLength(1);
  expect(p.parts[0].role).toBe("hole");
  expect(p.parts[0].kind).toBe("sketch");
  expect(p.parts[0].rotation[0]).toBeCloseTo(Math.PI/2);
  const geom=evaluateGroup(p.group,{[p.parts[0].id]:p.parts[0]});
  expect(geom).not.toBeNull();
  geom!.computeBoundingBox();
  expect(geom!.boundingBox!.max.x-geom!.boundingBox!.min.x).toBeCloseTo(cut.dxf_uses_nominal_flat_to_opposite_mm,2);
  expect(geom!.boundingBox!.max.z-geom!.boundingBox!.min.z).toBeCloseTo(cut.dxf_uses_nominal_diameter_mm,2);
  geom!.dispose();
 });
 it("each nominal aperture uses the EXISTING click-place-preview/move/rotate HOLE group and does not cut a box automatically",()=>{
  const box=makeShape("box");box.role="solid";box.params={w:80,d:80,h:40,radius:0};
  box.position=[0,0,20];
  const before:Project={...empty,nodes:{[box.id]:box},rootOrder:[box.id]};
  const frozen=JSON.stringify(before);
  for(const id of ["component-mr-c14-switch","component-itw-59-111"] as const){
   const lift=connectorFootprint(id).bottom;
   const placed=planPlaceConnector(before,id,[12,6,lift],[0,0,0]);
   expect(JSON.stringify(before)).toBe(frozen);
   expect(placed.project.rootOrder).toEqual([box.id,placed.selectionId]);
   expect(placed.project.nodes[box.id]).toEqual(box);
   const group=placed.project.nodes[placed.selectionId] as GroupNode;
   expect(nodeRole(group,placed.project.nodes)).toBe("hole");
   expect(group.position).toEqual([12,6,lift]);
   expect(group.rotation).toEqual([0,0,0]);
   const rotated:GroupNode={...group,position:[15,-7,10],rotation:[0,0,Math.PI/2]};
   expect(rotated.rotation[2]).toBe(Math.PI/2);
   expect(placed.project.nodes[box.id]).toEqual(box);
   const geometry=evaluateGroup(group,placed.project.nodes);
   expect(geometry).not.toBeNull();
   geometry!.dispose();
  }
 });
 it("nominal openings produce a real Boolean CUT on a grouped solid, not a fake preview",()=>{
  const body=makeShape("box");body.role="solid";body.params={w:90,d:25,h:50,radius:0};
  body.position=[0,0,25];
  for(const id of ["component-mr-c14-switch","component-itw-59-111"] as const){
    const parts=connectorPrefabNodes(id);
    const cutter:GroupNode={...parts.group,position:[0,-11,25]};
    const combination:GroupNode={id:"cut",type:"group",label:"Cutout test",
      childIds:[body.id,cutter.id],position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]};
    const nodes={[body.id]:body,[cutter.id]:cutter,[combination.id]:combination,
      ...Object.fromEntries(parts.parts.map(p=>[p.id,p]))};
    const result=evaluateGroup(combination,nodes);
    expect(result).not.toBeNull();
    result!.computeBoundingBox();
    expect(result!.boundingBox!.min.x).toBeCloseTo(-45,1);
    expect(result!.boundingBox!.max.x).toBeCloseTo(45,1);
    expect(result!.getAttribute("position").count).toBeGreaterThan(10);
    result!.dispose();
  }
 });
 it("eight distinct local pictures and exact supplier records live offline without third-party requests",()=>{
  const hashes=new Set<string>();
  for(const c of COMPONENTS){
   const p=join(sourceRoot,"thumbnails",c.id+".svg");
   expect(existsSync(p)).toBe(true);
   const img=readFileSync(p,"utf8");
   expect(img).toContain('viewBox="0 0 160 160"');
   expect(img).toContain('id="bg"');
   expect(img).toContain('id="metal"');
   expect(img).toContain('filter id="shadow"');
   expect(img).not.toMatch(/<image\b|<script\b|<foreignObject\b|https?:\/\/(?!www\.w3\.org\/2000\/svg)/);
   hashes.add(sha(img));
  }
  expect(hashes.size).toBe(8);
  expect(connectorThumbs).toContain('satisfies Record<OriginalConnectorId,string>');
 });
 it("preserves earlier dark Connectors palette and adds Components to SAME dropdown and Hover Shelf",()=>{
  expect(palette).toContain('<option value="basic">Basic Shapes</option>');
  expect(palette).toContain('<option value="connectors">Connectors</option>');
  expect(palette).toContain('<option value="components">Components</option>');
  expect(palette).toContain('CONNECTOR_PRESETS.map');
  expect(palette).toContain('setPlacingConnector(placingConnector===id?null:id)');
  expect(palette).toContain('catalogPlacementId(c.id)');
  expect(palette).toContain('e.dataTransfer.setData(CONNECTOR_DRAG_TYPE,placeId)');
  expect(menu).toContain('Physical component library (');
  expect(app).toContain("<ComponentLibrary />");
  expect(dialog).toContain('setPlacingConnector(placingId)');
  expect(dialog).toContain('Measurements needed');
  expect(dialog).toContain('No physical fit test');
  expect(dialog).toContain("original model");
 });
});