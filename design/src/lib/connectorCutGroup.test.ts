import {describe,it,expect,vi} from "vitest";
import * as THREE from "three";
import {shellParts} from "./advancedModels";
import {makeShape} from "./primitives";
import {nodeRole,isGroup,type GroupNode,type Project,type ShapeNode} from "../types/scene";
import {evaluateGroup} from "./csg";
import {planDB9BoxMount,db9BoxParts,type DB9BoxOptions} from "./db9BoxMount";
import {modelDB9Parts,planModelPanelCut} from "./modelPanelTools";
import {planShellFeature} from "./workshopTools";
import {bundleConnectorCutters,findUngroupedDB9,groupUngroupedDB9} from "./connectorCutGroup";
import palette from "../components/Palette.tsx?raw";
import menu from "../components/SmartContextMenu.tsx?raw";
vi.mock("../state/store",()=>({useScene:{getState:vi.fn(),setState:vi.fn()}}));
vi.mock("./sceneApi",()=>({sceneApi:{getNodeBounds:vi.fn()}}));

const opt:DB9BoxOptions={gender:"female",face:"front",offsetX:0,offsetY:0,
 clearance:0.2,mountingDiameter:3.18,addMountingHoles:true,flipKey:false};
const baseBox=()=>{
 const n=makeShape("box");n.role="solid";n.params={w:80,d:60,h:24,radius:0};n.position=[0,0,12];
 return {n,project:{id:"fixture",name:"DB9 fixture",version:1 as const,rootOrder:[n.id],nodes:{[n.id]:n}}};
};
const legacyShell=():Project=>{
 const parts=shellParts(80,60,24,2,2);
 const root:GroupNode={id:"shell",type:"group",label:"Hollow box",childIds:parts.map(x=>x.id),
  position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]};
 return {id:"fixture",name:"shell",version:1,rootOrder:[root.id],
 nodes:{[root.id]:root,...Object.fromEntries(parts.map(n=>[n.id,n]))}};
};
const getHoleGroup=(p:Project,rootId:string)=>{
 const root=p.nodes[rootId] as GroupNode;
 const group=root.childIds.map(id=>p.nodes[id]).find(n=>n&&isGroup(n)&&n.label?.startsWith("DB9")) as GroupNode;
 expect(group).toBeDefined();
 return group;
};
const worldPositions=(p:Project,g:GroupNode):[number,number,number][]=>g.childIds.map(id=>{
 const part=p.nodes[id] as ShapeNode;
 return part.position.map((v,i)=>v+g.position[i]) as [number,number,number];
});
const cast=(geo:THREE.BufferGeometry,x:number,z:number)=>{
 const mesh=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
 return new THREE.Raycaster(new THREE.Vector3(x,-90,z),new THREE.Vector3(0,1,0)).intersectObject(mesh).length;
};

describe("DB9 connector cutout as one selectable movable hole group",()=>{
 it("bundles the DE9 opening and both screw holes into ONE hole group on a plain box",()=>{
  const {project,n}=baseBox(),before=JSON.stringify(project);
  const b=new THREE.Box3(new THREE.Vector3(-40,-30,0),new THREE.Vector3(40,30,24));
  const parts=modelDB9Parts(b,opt),planned=planModelPanelCut(project,n.id,parts,"DB9 fixture");
  const bundled=bundleConnectorCutters(planned.project,planned.selectionId,parts,"DB9 female cutout");
  expect(JSON.stringify(project)).toBe(before);
  const group=getHoleGroup(bundled.project,planned.selectionId);
  expect(group.childIds).toEqual(parts.map(x=>x.id));
  expect(nodeRole(group,bundled.project.nodes)).toBe("hole");
  expect((bundled.project.nodes[planned.selectionId] as GroupNode).childIds).toEqual([n.id,group.id]);
  expect(worldPositions(bundled.project,group)).toEqual(parts.map(x=>x.position));
  expect(worldPositions(bundled.project,group)[1][0]).toBe(-12.5);
  expect(worldPositions(bundled.project,group)[2][0]).toBe(12.5);
  const g=evaluateGroup(bundled.project.nodes[planned.selectionId] as GroupNode,bundled.project.nodes);
  expect(g).not.toBeNull();
  expect(cast(g!,0,12)).toBe(0);
 });
 it("moves all three holes together when the GROUP position changes",()=>{
  const {project,n}=baseBox();
  const b=new THREE.Box3(new THREE.Vector3(-40,-30,0),new THREE.Vector3(40,30,24));
  const cuts=modelDB9Parts(b,opt);
  const plan=planModelPanelCut(project,n.id,cuts,"Existing model");
  const bundled=bundleConnectorCutters(plan.project,plan.selectionId,cuts,"DB9 female cutout");
  const group=getHoleGroup(bundled.project,plan.selectionId);
  const before=worldPositions(bundled.project,group);
  const moved:GroupNode={...group,position:[group.position[0]+8,...group.position.slice(1)] as [number,number,number]};
  const changed:Project={...bundled.project,nodes:{...bundled.project.nodes,[group.id]:moved}};
  expect(worldPositions(changed,moved)).toEqual(before.map(([x,y,z])=>[x+8,y,z]));
  expect((changed.nodes[n.id] as ShapeNode).position).toEqual([0,0,12]);
  const geo=evaluateGroup(changed.nodes[plan.selectionId] as GroupNode,changed.nodes);
  expect(geo).not.toBeNull();
  expect(cast(geo!,8,12)).toBe(0);
  expect(cast(geo!,-30,12)).toBeGreaterThan(0);
 });
 it("keeps the same grouped feature on existing hollow shells",()=>{
  const before=legacyShell(),plan=planDB9BoxMount(before,"shell",opt);
  const group=getHoleGroup(plan.project,plan.selectionId);
  expect(group.childIds).toEqual(plan.cutters);
  expect(group.label).toBe("DB9 female cutout");
  expect(nodeRole(group,plan.project.nodes)).toBe("hole");
  expect((plan.project.nodes[plan.selectionId] as GroupNode).childIds).toEqual(["shell",group.id]);
  const shape=evaluateGroup(plan.project.nodes[plan.selectionId] as GroupNode,plan.project.nodes);
  expect(shape).not.toBeNull();
 });
 it("retains just the one opening if screw mounting holes were switched off",()=>{
  const project=legacyShell(),plan=planDB9BoxMount(project,"shell",{...opt,addMountingHoles:false});
  const group=getHoleGroup(plan.project,plan.selectionId);
  expect(group.childIds).toHaveLength(1);
  expect(nodeRole(group,plan.project.nodes)).toBe("hole");
 });
 it("lets an existing OLD ungrouped DB9 cutout be repaired in place without altering the shell",()=>{
  const shell=legacyShell(),parts=db9BoxParts(shell,"shell",opt);
  const old=planShellFeature(shell,"shell",parts,"Box with DB9 female mounting opening");
  const untouched=JSON.stringify(old.project);
  expect(findUngroupedDB9(old.project,old.selectionId)).not.toBeNull();
  const converted=groupUngroupedDB9(old.project,old.selectionId);
  expect(JSON.stringify(old.project)).toBe(untouched);
  const group=getHoleGroup(converted.project,old.selectionId);
  expect(group.childIds).toEqual(parts.map(n=>n.id));
  expect(worldPositions(converted.project,group)).toEqual(parts.map(n=>n.position));
  expect(findUngroupedDB9(converted.project,old.selectionId)).toBeNull();
  expect(()=>groupUngroupedDB9(converted.project,old.selectionId)).toThrow("No ungrouped");
  expect((converted.project.nodes.shell as GroupNode).childIds).toEqual((shell.nodes.shell as GroupNode).childIds);
  const geo=evaluateGroup(converted.project.nodes[old.selectionId] as GroupNode,converted.project.nodes);
  expect(geo).not.toBeNull();
 });
 it("will NOT bundle screw holes unrelated to the D opening",()=>{
  const shell=legacyShell(),parts=db9BoxParts(shell,"shell",opt);
  parts[1].position[0]-=3;
  const old=planShellFeature(shell,"shell",parts,"Box with DB9 female mounting opening");
  expect(findUngroupedDB9(old.project,old.selectionId)).toBeNull();
 });
 it("keeps original connector right-click editors alongside a compact placeable dropdown in the same theme",()=>{
  expect(palette).toContain('aria-label="Palette category"');
  expect(palette).toContain('<option value="connectors">Connectors</option>');
  expect(palette).toContain('CONNECTOR_PRESETS.map');
  expect(palette).toContain('className="grid grid-cols-2 gap-1.5"');
  expect(palette).toContain('setPlacingConnector(placingConnector===id?null:id)');
  expect(menu).toContain('id:"connectors",label:"Connectors & holes"');
  expect(menu).toContain('label="DB9 male" run={openConnectorChoice("db9-male")}');
  expect(menu).toContain('label="DB9 female" run={openConnectorChoice("db9-female")}');
  expect(menu).not.toContain("Add / cut shape..."); });
});