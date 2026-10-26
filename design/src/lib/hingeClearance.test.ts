import {describe,it,expect,vi,beforeAll} from "vitest";
vi.mock("../../vendor/manifold/manifold.js",async()=>({
 default:()=>import("manifold-3d").then(m=>m.default())
}));
vi.mock("../state/store",()=>({useScene:{getState:vi.fn(),setState:vi.fn()}}));
import * as THREE from "three";
import {manifoldReady,toManifold} from "./manifold";
import {evaluateGroup} from "./csg";
import {shellParts} from "./advancedModels";
import {lidParts,identifyShell,type LidOptions} from "./boxFitTools";
import {planHingedLid,DEFAULT_HINGE_OPTIONS,type HingeSide,inspectLid} from "./hingedLid";
import {isGroup,type GroupNode,type Project,type ShapeNode} from "../types/scene";

const opts:LidOptions={clearance:.3,thickness:2.4,lipDepth:4,lipWall:1.5,overhang:.5,bedGap:12};
const group=(id:string,children:ShapeNode[]):GroupNode=>({
 id,type:"group",label:id==="box"?"Hollow box":"Matching lid",
 position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],childIds:children.map(n=>n.id),
});
const fixture=(overhang=.5,lipClearance=.3)=>{
 const box=shellParts(80,60,22,2,2),g=group("box",box);
 let project:Project={id:"p",name:"geometry",version:1,rootOrder:["box"],
  nodes:{...Object.fromEntries(box.map(x=>[x.id,x])),box:g}};
 const lid=lidParts(identifyShell("box",project),{...opts,overhang,clearance:lipClearance},[300,300]),l=group("lid",lid);
 project={...project,nodes:{...project.nodes,
   ...Object.fromEntries(lid.map(n=>[n.id,n])),lid:l},rootOrder:["box","lid"]};
 return project;
};
function closedAssemblyCollision(project:Project,side:HingeSide){
 const plan=planHingedLid(project,"box","lid",{...DEFAULT_HINGE_OPTIONS,side});
 const shell=identifyShell("box",project),lid=inspectLid(project,"lid")!;
 const barrel=plan.boxAdded.find(n=>n.label?.startsWith("Box hinge outer knuckle"));
 const lidBarrel=plan.lidAdded.find(n=>n.label==="Lid hinge centre knuckle");
 if(!barrel||!lidBarrel)throw Error("Missing hinge axes");
 const axis=side==="back"||side==="front"?"x":"y";
 // A rigid 180 degree flip about the common hinge pin and an axial translation.
 // Importantly, flips BOTH radial coordinate and Z — as physical assembly does.
 const matrix=axis==="x"?new THREE.Matrix4().set(
  1,0,0,shell.cx-lid.x,
  0,-1,0,barrel.position[1]+lidBarrel.position[1],
  0,0,-1,barrel.position[2]+lidBarrel.position[2],
  0,0,0,1
 ):new THREE.Matrix4().set(
  -1,0,0,barrel.position[0]+lidBarrel.position[0],
  0,1,0,shell.cy-lid.y,
  0,0,-1,barrel.position[2]+lidBarrel.position[2],
  0,0,0,1
 );
 const bg=plan.project.nodes[plan.boxId],lg=plan.project.nodes[plan.lidId];
 if(!isGroup(bg)||!isGroup(lg))throw Error("Missing print part groups");
 const boxGeo=evaluateGroup(bg,plan.project.nodes),lidGeo=evaluateGroup(lg,plan.project.nodes);
 if(!boxGeo||!lidGeo)throw Error("Generated null CSG geometry");
 const closedLidGeo=lidGeo.clone().applyMatrix4(matrix);
 const box=toManifold(boxGeo),closedLid=toManifold(closedLidGeo);
 if(!box||!closedLid)throw Error("Nonmanifold print-part CSG surface");
 const separatedBox=box.decompose(),separatedLid=closedLid.decompose();
 const connected=[separatedBox.length,separatedLid.length];
 separatedBox.forEach(x=>x.delete());separatedLid.forEach(x=>x.delete());
 const intersect=box.intersect(closedLid);
 const volume=intersect.volume();
 intersect.delete();box.delete();closedLid.delete();
 boxGeo.dispose();lidGeo.dispose();closedLidGeo.dispose();
 return {volume,connected};
}
beforeAll(async()=>{expect(await manifoldReady).toBe(true);});
describe("REAL closed-box CAD collision, not just hinge-axis coordinate checks",()=>{
 it.each(["back","front","left","right"] as HingeSide[])(
  "%s side: complete box AND closed/rotated lid must have no volumetric interference",
  side=>{
    const {volume,connected}=closedAssemblyCollision(fixture(),side);
    console.log("HINGE_CLOSED_INTERFERENCE_"+side+"="+volume.toFixed(6)+" mm^3; parts="+connected.join(","));
    expect(volume).toBeLessThan(.02);
    expect(connected).toEqual([1,1]);  // both printable parts stay connected solids  // effectively zero geometric volume
  }
 );
 it.each([0,2,6])("supports %s mm lid-panel overhang with zero interference on all four walls",overhang=>{
   for(const side of ["back","front","left","right"] as HingeSide[]){
     const {volume,connected}=closedAssemblyCollision(fixture(overhang),side);
     expect(volume).toBeLessThan(.02);
     expect(connected).toEqual([1,1]);
   }
 });
 it("honours the minimum 0.1 mm lip clearance without introducing hinge/body collisions",()=>{
   for(const side of ["back","front","left","right"] as HingeSide[]){
     const {volume,connected}=closedAssemblyCollision(fixture(.5,.1),side);
     expect(volume).toBeLessThan(.02);
     expect(connected).toEqual([1,1]);
   }
 });
});