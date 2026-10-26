import {describe,it,expect,vi,beforeAll} from "vitest";
vi.mock("../../vendor/manifold/manifold.js",async()=>({
 default:()=>import("manifold-3d").then(m=>m.default())
}));
vi.mock("../state/store",()=>({useScene:{getState:vi.fn(),setState:vi.fn()}}));
import * as THREE from "three";
import {manifoldReady,toManifold} from "./manifold";
import {buildGeometry} from "./primitives";
import {evaluateGroup} from "./csg";
import {shellParts} from "./advancedModels";
import {identifyShell,dividerParts} from "./boxFitTools";
import {planOrganizerInserts,type OrganizerOptions} from "./organizerInserts";
import {isGroup,type Project,type GroupNode} from "../types/scene";

const settings:OrganizerOptions={cols:2,rows:2,gap:.35,wall:1.6,
 floor:1.6,topGap:1,bedGap:6,mode:"full",col:1,row:1,spanCols:2,spanRows:1};
function fixture(kind:"plain"|"dividers"|"rounded"|"strongly-rounded"="plain",offsetX=0):Project{
 const box=shellParts(80,60,30,2,3);
 const shell:GroupNode={id:"box",type:"group",label:"Hollow box",
  childIds:box.map(x=>x.id),position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]};
 const project:Project={id:"test",name:"test",version:1,nodes:{
  ...Object.fromEntries(box.map(x=>[x.id,x])),box:shell},rootOrder:["box"]};
 if(kind==="rounded"||kind==="strongly-rounded"){
  const cavity=box[1];
  cavity.params={...cavity.params,edges:kind==="rounded"?"8@9,9@9,10@9,11@9":"8@22,9@22,10@22,11@22"};
 }
 if(kind==="dividers"){
  const list=dividerParts(identifyShell("box",project),2,2,2,1);
  const xDiv=list.find(n=>Number(n.params.w)<=6)!;
  xDiv.position[0]+=offsetX;
  const wrapper:GroupNode={id:"divided",type:"group",label:"Box with dividers",
   childIds:["box",...list.map(x=>x.id)],
   position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]};
  project.nodes={...project.nodes,...Object.fromEntries(list.map(x=>[x.id,x])),divided:wrapper};
  project.rootOrder=["divided"];
 }
 return project;
}
function assembledInterference(project:Project,shellId:string,settingsOverride:OrganizerOptions=settings){
 const sh=identifyShell(shellId,project);
 const plan=planOrganizerInserts(project,shellId,[220,220],settingsOverride);
 const root=project.nodes[shellId];
 if(!isGroup(root))throw new Error("Missing shell");
 const shellGeo=evaluateGroup(root,project.nodes);
 if(!shellGeo)throw new Error("No actual shell CAD geometry");
 const actualShell=toManifold(shellGeo);
 if(!actualShell)throw new Error("Shell not solid");
 let max=0;
 for(const bin of plan.bins){
  const outer=buildGeometry(bin.outside);
  if(!outer)throw new Error("Missing bin CAD");
  outer.applyMatrix4(new THREE.Matrix4().makeTranslation(
   bin.outside.position[0]+sh.cx-plan.layout[0],
   bin.outside.position[1]+sh.cy-plan.layout[1],
   bin.outside.position[2]+sh.bottom+sh.floor
  ));
  const solid=toManifold(outer);
  if(!solid)throw new Error("Bin not manifold");
  const intersection=actualShell.intersect(solid);
  max=Math.max(max,intersection.volume());
  intersection.delete();solid.delete();outer.dispose();
 }
 actualShell.delete();shellGeo.dispose();
 return {max,plan};
}
beforeAll(async()=>expect(await manifoldReady).toBe(true));
describe("actual assembled removable bins, dividers and strongly rounded corners",()=>{
 it("uses TRUE divider faces, including moved/unequal compartments, for each bin",()=>{
  for(const offset of [0,5,-7]){
   const project=fixture("dividers",offset),plan=planOrganizerInserts(project,"divided",[220,220],settings);
   const xDivider=Object.values(project.nodes).find(n=>!isGroup(n)&&n.role==="solid"&&
     Number(n.params.w)===2&&Number(n.params.d)>50);
   if(!xDivider||isGroup(xDivider))throw new Error("Missing divider");
   const x0=xDivider.position[0]-Number(xDivider.params.w)/2;
   const x1=xDivider.position[0]+Number(xDivider.params.w)/2;
   for(const bin of plan.bins){
    const centre=bin.outside.position[0]-plan.layout[0];
    const min=centre-Number(bin.outside.params.w)/2,max=centre+Number(bin.outside.params.w)/2;
    if(bin.col===0)expect(max).toBeLessThanOrEqual(x0-settings.gap+.01);
    else expect(min).toBeGreaterThanOrEqual(x1+settings.gap-.01);
   }
  }
 });
 it("never silently puts a spanning bin through a permanent divider",()=>{
   const project=fixture("dividers");
   expect(()=>planOrganizerInserts(project,"divided",[220,220],
    {...settings,mode:"span",spanCols:2,spanRows:1}))
    .toThrow(/divider|span|cross/i);
 });
 it("never clips too-large rounded corner radii into a shape that collides with the tray",()=>{
  const project=fixture("strongly-rounded");
  expect(()=>planOrganizerInserts(project,"box",[220,220],settings))
    .toThrow(/corner|radius|round/i);
 });
 it.each(["plain","dividers","rounded"] as const)(
  "%s layout: all assembled bin outer solids have zero CAD volume intersecting tray walls/dividers",
  kind=>{
    const project=fixture(kind);
    const {max,plan}=assembledInterference(project,kind==="dividers"?"divided":"box");
    console.log("BIN_ASSEMBLY_MAX_INTERFERENCE_"+kind+"="+max.toFixed(6)+" mm^3");
    expect(plan.bins).toHaveLength(4);
    expect(max).toBeLessThan(.03);
 });
});