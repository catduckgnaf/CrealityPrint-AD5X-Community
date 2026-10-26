import {describe,it,expect,vi} from "vitest";
import * as THREE from "three";
import {makeShape} from "./primitives";
import {evaluateGroup} from "./csg";
import {shellParts} from "./advancedModels";
import {modelPanelTarget,editableModelRoot,panelBoundsInfo,modelBananaHoleParts,modelRoundMountParts,modelDB9Parts,planModelPanelCut,modelDrillParts,modelDrillGrid,modelCableOpeningParts,modelMountingPostParts} from "./modelPanelTools";
import type {Project,GroupNode} from "../types/scene";
import contextMenuSource from "../components/SmartContextMenu.tsx?raw";
import workshopSource from "../components/WorkshopTools.tsx?raw";
vi.mock("../state/store",()=>({useScene:{getState:vi.fn(),setState:vi.fn()}}));
vi.mock("./sceneApi",()=>({sceneApi:{getNodeBounds:vi.fn()}}));

const bounds=new THREE.Box3(new THREE.Vector3(-40,-30,0),new THREE.Vector3(40,30,24));
function ordinary(kind:"box"|"cylinder"|"sphere"|"wedge"|"mesh"="box"){
 const node=makeShape(kind);node.role="solid";node.position=[0,0,12];
 if(kind==="box")node.params={w:80,d:60,h:24,radius:0};
 if(kind==="cylinder")node.params={r:20,h:24,segments:64,bevel:0};
 if(kind==="sphere")node.params={r:20,segments:32};
 if(kind==="wedge")node.params={w:50,d:50,h:24};
 const project:Project={id:"test",name:"test",version:1,rootOrder:[node.id],nodes:{[node.id]:node}};
 return {node,project};
}
const banana={face:"front" as const,diameter:4,points:[[-15,0],[15,0]] as [number,number][]};

describe("existing connector workflows unlocked for ordinary models",()=>{
 it.each(["box","cylinder","sphere","wedge","mesh"] as const)("shows connector target on selected %s without a hollow shell",kind=>{
  const {project,node}=ordinary(kind);
  expect(editableModelRoot(project,[node.id])).toBe(node.id);
  const target=modelPanelTarget(project,[node.id],()=>bounds);
  expect(target.id).toBe(node.id);
  expect(target.shell).toBe(false);
  expect(target.sh.width).toBe(80);
  expect(target.sh.height).toBe(24);
  expect(target.sh.floor).toBe(0);
 });
 it("keeps the existing hollow-shell route unchanged",()=>{
  const parts=shellParts(80,60,24,2,2);
  const group:GroupNode={id:"shell",type:"group",label:"Hollow box",childIds:parts.map(p=>p.id),
   position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]};
  const project:Project={id:"test",name:"test",version:1,rootOrder:["shell"],
   nodes:{shell:group,...Object.fromEntries(parts.map(n=>[n.id,n]))}};
  const t=modelPanelTarget(project,[parts[0].id],()=>{throw Error("should not request generic bounds")});
  expect(t.shell).toBe(true);
  expect(t.id).toBe("shell");
  expect(t.sh.floor).toBe(2);
 });
 it("opens the same connector target when selecting a member inside a previous boolean group",()=>{
  const {project,node}=ordinary();
  const group:GroupNode={id:"cut-model",type:"group",label:"Edited model",childIds:[node.id],
    position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]};
  project.nodes[group.id]=group;project.rootOrder=[group.id];
  expect(modelPanelTarget(project,[node.id],()=>bounds).id).toBe(group.id);
 });
 it("rejects inaccessible, locked, hole-only and ambiguous selections without changing anything",()=>{
  const {project,node}=ordinary();
  expect(()=>editableModelRoot(project,[])).toThrow("Select");
  expect(()=>editableModelRoot(project,[node.id,node.id])).toThrow("Select");
  node.locked=true;expect(()=>editableModelRoot(project,[node.id])).toThrow("Unlock");
  node.locked=false;node.role="hole";
  expect(()=>editableModelRoot(project,[node.id])).toThrow("solid");
 });
 it("cuts real banana holes through an ordinary solid with the original position editor coordinates",()=>{
  const {project,node}=ordinary();
  const cutters=modelBananaHoleParts(bounds,banana);
  expect(cutters).toHaveLength(2);
  expect(cutters.map(c=>c.position)).toEqual([[-15,0,12],[15,0,12]]);
  expect(cutters.every(c=>c.role==="hole")).toBe(true);
  expect(cutters.every(c=>Math.abs(Number(c.params.h)-62)<0.01)).toBe(true);
  const before=JSON.stringify(project);
  const changed=planModelPanelCut(project,node.id,cutters,"Test connector holes");
  expect(JSON.stringify(project)).toBe(before);
  expect(changed.project.rootOrder).toEqual([changed.selectionId]);
  expect(changed.project.nodes[node.id]).toEqual(node);
  const solid=evaluateGroup(changed.project.nodes[changed.selectionId] as GroupNode,changed.project.nodes);
  expect(solid).not.toBeNull();
  const mesh=new THREE.Mesh(solid!,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
  const rayThrough=new THREE.Raycaster(new THREE.Vector3(-15,-90,12),new THREE.Vector3(0,1,0));
  expect(rayThrough.intersectObject(mesh)).toHaveLength(0);
  const raySolid=new THREE.Raycaster(new THREE.Vector3(0,-90,12),new THREE.Vector3(0,1,0));
  expect(raySolid.intersectObject(mesh).length).toBeGreaterThan(0);
 });
 it("reuses product-specific XT60 22mm and type-B 12.2mm circular cuts",()=>{
  const xt=modelRoundMountParts(bounds,{id:"xt60-panel-03",face:"floor",offsetX:0,offsetY:0,radialClearance:0});
  const bananaSocket=modelRoundMountParts(bounds,{id:"banana-type-b-socket",face:"front",offsetX:0,offsetY:0,radialClearance:0});
  expect(xt[0].params.r).toBe(11);
  expect(bananaSocket[0].params.r).toBe(6.1);
  expect(Number(xt[0].params.h)).toBe(26);
  expect(Number(bananaSocket[0].params.h)).toBe(62);
 });
 it("keeps real DB9 D-shaped aperture and two 25mm-pitch screw bores on a plain shape",()=>{
  const cutters=modelDB9Parts(bounds,{gender:"female",face:"front",offsetX:0,offsetY:0,
   clearance:0.2,mountingDiameter:3.18,addMountingHoles:true,flipKey:false});
  expect(cutters).toHaveLength(3);
  expect(cutters[0].kind).toBe("sketch");
  expect(JSON.parse(String(cutters[0].params.profile)).length).toBeGreaterThan(40);
  expect(cutters[1].position[0]).toBe(-12.5);
  expect(cutters[2].position[0]).toBe(12.5);
  expect(cutters.every(c=>c.role==="hole")).toBe(true);
 });
 it("keeps edge and web warnings rather than punching invalid geometry",()=>{
  expect(()=>modelBananaHoleParts(bounds,{face:"front",diameter:30,points:[[-32,0],[32,0]]})).toThrow();
  expect(()=>modelRoundMountParts(bounds,{id:"xt60-panel-03",face:"front",offsetX:0,offsetY:0,radialClearance:0.3})).toThrow();
  expect(()=>modelDB9Parts(bounds,{gender:"female",face:"front",offsetX:100,offsetY:0,
    clearance:0,mountingDiameter:3.18,addMountingHoles:true,flipKey:false})).toThrow();
  expect(()=>panelBoundsInfo(new THREE.Box3())).toThrow();
 });
 it("retains existing jig-grid parameters but drills non-box shapes without requiring a special jig",()=>{
  const pts=modelDrillGrid(4,2,2,20,12,0,0);
  const holes=modelDrillParts(bounds,4,pts);
  expect(holes).toHaveLength(4);
  expect(holes.every(n=>n.kind==="cylinder"&&n.role==="hole")).toBe(true);
  expect(holes.map(n=>n.position)).toEqual([[-10,-6,12],[-10,6,12],[10,-6,12],[10,6,12]]);
  expect(()=>modelDrillParts(bounds,4,[[38,0]])).toThrow();
 });
 it("cuts the same cable opening directly into any existing solid, without a new plate",()=>{
  const parts=modelCableOpeningParts(bounds,"front",12,6,2,4);
  expect(parts).toHaveLength(1);
  expect(parts[0].role).toBe("hole");
  expect(parts[0].kind).toBe("box");
  expect(parts[0].position).toEqual([2,0,7]);
  expect(parts[0].params).toMatchObject({w:12,d:62,h:6});
  expect(()=>modelCableOpeningParts(bounds,"front",12,26,0,4)).toThrow();
 });
 it("adds four real connected mounting posts with blind bores on a plain model",()=>{
  const {project,node}=ordinary();
  const parts=modelMountingPostParts(project,node.id,bounds,8,3.2,10);
  expect(parts).toHaveLength(8);
  expect(parts.filter(n=>n.role==="solid")).toHaveLength(4);
  expect(parts.filter(n=>n.role==="hole")).toHaveLength(4);
  expect(parts.filter(n=>n.role==="solid").every(n=>n.position[2]>24)).toBe(true);
  const gid="posted";const group:GroupNode={
   id:gid,type:"group",childIds:[node.id,...parts.map(n=>n.id)],position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]
  };
  expect(evaluateGroup(group,{...project.nodes,...Object.fromEntries(parts.map(n=>[n.id,n]))})).not.toBeNull();
 });
 it("preserves the current menu/theme and doesn't add a second workflow",()=>{
  const ui=contextMenuSource;
  const workshop=workshopSource;
  expect(ui).toContain('id:"connectors",label:"Connectors & holes"');
  expect(ui).toContain('label="Banana plug 2 mm"');
  expect(ui).toContain('label="DB9 male"');
  expect(ui).toContain('label="XT60 panel mount (22 mm)"');
  expect(ui).toContain("editableModelRoot(project,ids)");
  expect(workshop).toContain('modelPanelTarget(project,selection)');
  expect(ui).not.toContain("Add / cut shape...");
 });
});