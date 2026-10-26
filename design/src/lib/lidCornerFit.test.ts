import {describe,it,expect,vi,beforeAll,beforeEach} from "vitest";
vi.mock("../../vendor/manifold/manifold.js",async()=>{
 const imported=await import("manifold-3d");
 return {default:()=>imported.default()};
});
vi.mock("../state/store",()=>({useScene:{getState:vi.fn(),setState:vi.fn()}}));
vi.mock("./sceneApi",()=>({sceneApi:{getNodeBounds:vi.fn()}}));
import * as THREE from "three";
import {manifoldLoaded,manifoldReady} from "./manifold";
import {buildGeometry} from "./primitives";
import {shellParts} from "./advancedModels";
import {identifyShell,lidParts,type LidOptions} from "./boxFitTools";
import {identifyLid,lidFitReport} from "./boxFitExtra";
import {trayTarget,trayRoundingNodes} from "./trayRoundingCore";
import {uniformUprightRadius,cornerFitRequiresReview,uprightCornerRadii} from "./matchedLidCorners";
import {maxFilletRadius,maxUprightBoxRadius} from "./boxEdges";
import {newId} from "./id";
import {useScene} from "../state/store";
import type {Project,GroupNode,ShapeNode} from "../types/scene";

let project:Project;
const options:LidOptions={clearance:0.3,thickness:2.4,lipDepth:4,lipWall:1.5,overhang:0.5,bedGap:12};
const putGroup=(nodes:ShapeNode[]):string=>{
 const id=newId(),group:GroupNode={id,type:"group",label:"Object",childIds:nodes.map(x=>x.id),
  position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]};
 project.nodes={...project.nodes,...Object.fromEntries(nodes.map(x=>[x.id,x])),[id]:group};
 project.rootOrder.push(id);
 return id;
};
const roundedShell=()=>{
 const sid=putGroup(shellParts(80,60,30,2,3));
 const target=trayTarget(sid,project);
 project.nodes={...project.nodes,...trayRoundingNodes(target,{outside:8,scoop:4})};
 return {sid,info:identifyShell(sid,project)};
};
beforeAll(async()=>{expect(await manifoldReady).toBe(true);expect(manifoldLoaded()).toBe(true);});
beforeEach(()=>{
 project={id:"test",version:1,name:"Test",rootOrder:[],nodes:{}};
 vi.mocked(useScene.getState).mockImplementation(()=>({project,selection:[],bed:[220,220]}) as never);
});
describe("v19.5.14 individually rounded matching lids",()=>{
 it("propagates each distinct upright corner to panel, lip and opening",()=>{
  const sid=putGroup(shellParts(80,60,30,2,3));
  const sh=identifyShell(sid,project);
  sh.outer.params={...sh.outer.params,radius:0,edges:"8@3,9@5,10@9,11@12"};
  sh.cavity.params={...sh.cavity.params,radius:0,edges:"8@1,9@3,10@7,11@10"};
  const [panel,lip,hole]=lidParts(identifyShell(sid,project),options);
  expect(uprightCornerRadii(panel)).toEqual({"8":3.5,"9":5.5,"10":9.5,"11":12.5});
  expect(uprightCornerRadii(lip)).toEqual({"8":0.7,"9":2.7,"10":6.7,"11":9.7});
  const r=uprightCornerRadii(hole);
  expect(r["8"]).toBe(0);
  expect(r["9"]).toBeCloseTo(1.2);
  expect(r["10"]).toBeCloseTo(5.2);
  expect(r["11"]).toBeCloseTo(8.2);
  expect(Number(sh.cavity.params.w)-Number(lip.params.w)).toBeCloseTo(0.6);
  expect(Number(lip.params.w)-Number(hole.params.w)).toBeCloseTo(3);
  const lidId=putGroup([panel,lip,hole]);
  expect(lidFitReport(sid,lidId).warning).toBe(false);
 });
 it("rejects a mismatched individual corner in a regenerated lid",()=>{
  const sid=putGroup(shellParts(80,60,30,2,3));
  const sh=identifyShell(sid,project);
  sh.cavity.params={...sh.cavity.params,radius:0,edges:"8@6,9@3,10@2,11@8"};
  const parts=lidParts(identifyShell(sid,project),options);
  parts[1].params.edges="8@0.1,9@2.7,10@1.7,11@7.7";
  const lidId=putGroup(parts);
  expect(lidFitReport(sid,lidId).warning).toBe(true);
 });
});
describe("v19.4.1 corner-fit audit",()=>{
 it("keeps a brand-new square tray's legacy matching lid unchanged",()=>{
  const id=putGroup(shellParts(80,60,30,2,3));
  const lid=lidParts(identifyShell(id,project),options);
  expect(lid.every(n=>Number(n.params.radius||0)===0&&!n.params.edges)).toBe(true);
 });
 it("correctly rounds all three thin lid solids, preserving lip clearance and wall",()=>{
  const {info}=roundedShell();
  const [panel,ring,opening]=lidParts(info,options);
  expect(panel.kind).toBe("box");
  expect(uniformUprightRadius(panel)).toBeCloseTo(8.5,2);
  expect(uniformUprightRadius(ring)).toBeCloseTo(5.7,2);
  expect(uniformUprightRadius(opening)).toBeCloseTo(4.2,2);
  expect(Number(panel.params.h)).toBeCloseTo(2.4,3);
  expect(Number(info.cavity.params.w)-Number(ring.params.w)).toBeCloseTo(0.6,3);
  expect(Number(ring.params.w)-Number(opening.params.w)).toBeCloseTo(3,3);
  expect(info.floor).toBeCloseTo(3,3);
 });
 it("does not truncate plan-view corner radius to thin lid height",()=>{
  const {info}=roundedShell(),[panel,ring]=lidParts(info,options);
  expect(maxFilletRadius(81,61,2.4)).toBeLessThan(1.3);
  expect(maxUprightBoxRadius(81,61)).toBeGreaterThan(8);
  for(const part of [panel,ring]){
   const geo=buildGeometry(part);
   expect(geo).not.toBeNull();
   if(!geo)continue;
   geo.computeBoundingBox();
   const halfW=Number(part.params.w)/2,halfD=Number(part.params.d)/2;
   const corner=(new THREE.Raycaster(
    new THREE.Vector3(halfW-0.15,halfD-0.15,30),
    new THREE.Vector3(0,0,-1))).intersectObject(
       new THREE.Mesh(geo,new THREE.MeshBasicMaterial({side:THREE.DoubleSide})));
   // With a 2.4mm panel and radius 8.5 the sharp square corner must be absent.
   expect(corner.length).toBe(0);
   geo.dispose();
  }
 });
 it("rejects a previously generated square lip for a newly rounded tray",()=>{
  const sid=putGroup(shellParts(80,60,30,2,3));
  const originalLid=lidParts(identifyShell(sid,project),options);
  const lidId=putGroup(originalLid);
  const target=trayTarget(sid,project);
  project.nodes={...project.nodes,...trayRoundingNodes(target,{outside:8,scoop:5})};
  const fit=lidFitReport(sid,lidId);
  expect(fit.clearanceX).toBeCloseTo(0.3);
  expect(fit.warning).toBe(true);
  expect(fit.message).toContain("corners");
 });
 it("recognizes rounded matching lids and keeps all existing group children editable",()=>{
  const {sid,info}=roundedShell();
  const nodes=lidParts(info,options),lidId=putGroup(nodes);
  const fit=lidFitReport(sid,lidId);
  expect(fit.warning).toBe(false);
  expect(identifyLid(lidId).ringWidth).toBeCloseTo(75.4);
  expect(cornerFitRequiresReview(6,5.7,0.3)).toBe(false);
  expect(cornerFitRequiresReview(6,0,0.3)).toBe(true);
  expect((project.nodes[nodes[1].id] as ShapeNode).params.edges).toBe(nodes[1].params.edges);
 });
 it("keeps thinner trays' upright rounding separate from their height",()=>{
  const raw=shellParts(45,34,7,1.5,1);
  const id=putGroup(raw),target=trayTarget(id,project);
  expect(target.maxOutside).toBeGreaterThan(8);
  const changed=trayRoundingNodes(target,{outside:8,scoop:0.5});
  expect(uniformUprightRadius(changed[target.shell.outer.id])).toBe(8);
  expect(uniformUprightRadius(changed[target.shell.cavity.id])).toBe(6.5);
 });
});
