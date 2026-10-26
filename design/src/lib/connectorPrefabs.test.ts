import {describe,it,expect,vi} from "vitest";
import * as THREE from "three";
import {
 CONNECTOR_PRESETS,connectorPrefabNodes,connectorFootprint,
 connectorPreviewGeometry,planPlaceConnector,isConnectorPrefabId,
 type ConnectorPrefabId
} from "./connectorPrefabs";
import {makeShape} from "./primitives";
import {evaluateGroup} from "./csg";
import {nodeRole,type GroupNode,type Project,type ShapeNode} from "../types/scene";
import paletteSource from "../components/Palette.tsx?raw";
import viewportSource from "../components/Viewport.tsx?raw";
import sceneRigSource from "../components/SceneRig.tsx?raw";
import storeSource from "../state/store.ts?raw";
import previewSource from "../components/PlacementPreview.tsx?raw";
vi.mock("../state/store",()=>({useScene:{getState:vi.fn(),setState:vi.fn()}}));
vi.mock("./sceneApi",()=>({sceneApi:{getNodeBounds:vi.fn()}}));

const empty:Project={id:"test",name:"test",version:1,nodes:{},rootOrder:[]};
function rayHits(geo:THREE.BufferGeometry,x:number,z:number){
 const mesh=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
 return new THREE.Raycaster(new THREE.Vector3(x,-90,z),
  new THREE.Vector3(0,1,0)).intersectObject(mesh).length;
}

describe("Connectors placed freely just like Basic Shapes",()=>{
 it("keeps one compact Basic Shapes / Connectors DROPDOWN instead of another long section",()=>{
  expect(paletteSource).toContain('aria-label="Palette category"');
  expect(paletteSource).toContain('<option value="basic">Basic Shapes</option>');
  expect(paletteSource).toContain('<option value="connectors">Connectors</option>');
  expect(paletteSource).toContain('CONNECTOR_DRAG_TYPE');
  expect(paletteSource).toContain('setPlacingConnector(placingConnector===id?null:id)');
  expect(paletteSource).not.toContain('connectorChooser:true,connectorType:id');
 });
 it("connectors can be clicked onto the same surface/workplane as regular boxes, or dragged in",()=>{
  expect(viewportSource).toContain('if(s.placingConnector)');
  expect(viewportSource).toContain('s.placeConnectorAt(s.placingConnector');
  expect(viewportSource).toContain('sceneApi.dropConnector(connector,e.clientX,e.clientY)');
  expect(viewportSource).toContain('Click to place connector cutout');
  expect(sceneRigSource).toContain('s.placing ? footprintFor(s.placing) : connectorFootprint(s.placingConnector!)');
  expect(sceneRigSource).toContain('sceneApi.dropConnector = (kind, clientX, clientY) =>');
  expect(storeSource).toContain('placeConnectorAt: (kind,position,rotation)');
  expect(storeSource).toContain('placingConnector:null,placing:null');
  expect(previewSource).toContain('connectorPreviewGeometry(placingConnector)');
 });
 it("preserves correct existing product cutout dimensions, not arbitrary hardware body sizes",()=>{
  const db9=connectorPrefabNodes("db9-female");
  expect(db9.parts).toHaveLength(3);
  expect(db9.parts[0].kind).toBe("sketch");
  expect(db9.parts[0].role).toBe("hole");
  expect(db9.parts[1].position[0]).toBe(-12.5);
  expect(db9.parts[2].position[0]).toBe(12.5);
  expect(db9.parts[1].params.r).toBeCloseTo(3.18/2);
  expect(JSON.parse(String(db9.parts[0].params.profile))).toHaveLength(52);
  expect(Number(db9.parts[0].params.h)).toBe(24);
  for(const [id,diameter] of [
   ["banana-mini2",2],["banana-mini3",3],["banana-standard4",4],
   ["banana-type-b-socket",12.2],["xt60-panel-03",22]
  ] as const){
   const preset=connectorPrefabNodes(id);
   expect(preset.parts).toHaveLength(1);
   expect(preset.parts[0].role).toBe("hole");
   expect(Number(preset.parts[0].params.r)*2).toBeCloseTo(diameter);
  }
 });
 it.each(CONNECTOR_PRESETS.map(x=>x.id))("%s prefab is one standalone select/move/rotate-able HOLE group",id=>{
  const footprint=connectorFootprint(id);
  const plan=planPlaceConnector(empty,id,[9,14,footprint.bottom],[0,0,0]);
  expect(plan.project.rootOrder).toEqual([plan.selectionId]);
  const group=plan.project.nodes[plan.selectionId] as GroupNode;
  expect(group.type).toBe("group");
  expect(nodeRole(group,plan.project.nodes)).toBe("hole");
  expect(group.position).toEqual([9,14,footprint.bottom]);
  expect(group.childIds).toHaveLength(id.startsWith("db9")?3:1);
  const g=evaluateGroup(group,plan.project.nodes);
  expect(g).not.toBeNull();
  g!.computeBoundingBox();
  expect(g!.boundingBox!.min.z+group.position[2]).toBeCloseTo(0,3);
  expect(isConnectorPrefabId(id)).toBe(true);
  g!.dispose();
 });
 it("never attaches to/replaces the currently selected box until USER explicitly groups",()=>{
  const solid=makeShape("box");solid.role="solid";solid.params={w:80,d:14,h:30,radius:0};
  solid.position=[0,0,15];
  const initial:Project={...empty,nodes:{[solid.id]:solid},rootOrder:[solid.id]};
  const before=JSON.stringify(initial);
  const lift=connectorFootprint("db9-female").bottom;
  const placed=planPlaceConnector(initial,"db9-female",[0,0,lift],[0,0,0]);
  expect(JSON.stringify(initial)).toBe(before);
  expect(placed.project.rootOrder).toEqual([solid.id,placed.selectionId]);
  expect(placed.project.nodes[solid.id]).toEqual(solid);
  const cutter=placed.project.nodes[placed.selectionId] as GroupNode;
  // Until grouped, no cut is made to the original solid.
  expect(nodeRole(cutter,placed.project.nodes)).toBe("hole");
  const compound:GroupNode={id:"combined",type:"group",label:"Grouped",
    childIds:[solid.id,placed.selectionId],
    position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]};
  const nodes={...placed.project.nodes,combined:compound};
  const merged=evaluateGroup(compound,nodes);
  expect(merged).not.toBeNull();
  expect(rayHits(merged!,0,lift)).toBe(0);
  expect(rayHits(merged!,30,lift)).toBeGreaterThan(0);
  merged!.dispose();
 });
 it("moves DB9 D opening and screws together with a SINGLE transform, and supports rotation",()=>{
  const lift=connectorFootprint("db9-male").bottom;
  const plan=planPlaceConnector(empty,"db9-male",[0,0,lift],[0,0,0]);
  const group=plan.project.nodes[plan.selectionId] as GroupNode;
  const children=group.childIds.map(id=>plan.project.nodes[id] as ShapeNode);
  const old=children.map(c=>c.position);
  const moved:GroupNode={...group,position:[30,-10,lift+8],rotation:[0,0,Math.PI/2]};
  expect(children.map(c=>c.position)).toEqual(old);
  expect(moved.position).toEqual([30,-10,lift+8]);
  const m= new THREE.Matrix4().compose(new THREE.Vector3(...moved.position),
   new THREE.Quaternion().setFromEuler(new THREE.Euler(...moved.rotation)),new THREE.Vector3(1,1,1));
  const positions=children.map(c=>new THREE.Vector3(...c.position).applyMatrix4(m));
  expect(positions[1].y).toBeCloseTo(-22.5);
  expect(positions[2].y).toBeCloseTo(2.5);
 });
 it("rejects an unsupported preset and invalid coordinates",()=>{
  expect(isConnectorPrefabId("unlisted")).toBe(false);
  expect(()=>connectorPrefabNodes("unlisted" as ConnectorPrefabId)).toThrow("Unknown");
  expect(()=>planPlaceConnector(empty,"db9-male",[NaN,0,0],[0,0,0])).toThrow("Invalid");
  const preview=connectorPreviewGeometry("db9-female");
  expect(preview).not.toBeNull();
  preview!.dispose();
 });
});
