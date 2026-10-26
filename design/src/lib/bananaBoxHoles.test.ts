import {fixtureDir} from "./testFixturePath";
import {describe,it,expect,vi} from "vitest";
vi.mock("../state/store",()=>({useScene:{getState:()=>({}),setState:()=>{}}}));
import {shellParts} from "./advancedModels";
import {
 bananaBoxTarget,bananaBoxFaceSize,bananaBoxHoleIssues,bananaBoxHoleParts,
 planBananaBoxHoles,spacedBananaHoles,type BananaBoxFace,type BananaBoxCutOptions
} from "./workshopTools";
// @ts-expect-error Fixture writer runs under Node/Vitest, not in the browser bundle.
import {writeFileSync} from "node:fs";
import {identifyShell} from "./boxFitTools";
import {type Project,type GroupNode} from "../types/scene";
const path=fixtureDir();
function startingProject():Project{
 const parts=shellParts(80,60,22,2,2);
 const root:GroupNode={id:"shell",type:"group",label:"Hollow box",childIds:parts.map(x=>x.id),
  position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]};
 return {id:"banana-box",name:"Banana plugs into the box",version:1,
  nodes:{...Object.fromEntries(parts.map(x=>[x.id,x])),[root.id]:root},rootOrder:["shell"]};
}
function o(face:BananaBoxFace="front"):BananaBoxCutOptions{
 return {face,diameter:8,points:spacedBananaHoles(2,30)};
}
describe("v19.5.31 banana holes CUT into existing box rather than creating a plate",()=>{
 it("identifies selected shell or the only unambiguous hollow-box root",()=>{
  const project=startingProject(),sh=identifyShell("shell",project);
  expect(sh.width).toBe(80);expect(sh.depth).toBe(60);expect(sh.floor).toBe(2);
  expect(bananaBoxTarget(project,[]).id).toBe("shell");
  expect(bananaBoxTarget(project,[sh.outer.id]).id).toBe("shell");
  expect(bananaBoxFaceSize(sh,"front")).toEqual([80,20]);
  expect(bananaBoxFaceSize(sh,"back")).toEqual([80,20]);
  expect(bananaBoxFaceSize(sh,"left")).toEqual([60,20]);
  expect(bananaBoxFaceSize(sh,"floor")).toEqual([76,56]);
  expect(()=>bananaBoxTarget({...project,rootOrder:[]},[])).toThrow(/Create or select/);
 });
 it("rejects ambiguous multiple boxes unless the correct shell is selected",()=>{
  const a=startingProject(),b=startingProject(),renamed:{[k:string]:any}={};
  for(const [k,v] of Object.entries(b.nodes))renamed["b-"+k]={...v,id:"b-"+k,
   ...("childIds" in v?{childIds:v.childIds.map((c:string)=>"b-"+c)}:{})};
  const two:Project={...a,nodes:{...a.nodes,...renamed},rootOrder:["shell","b-shell"]};
  expect(()=>bananaBoxTarget(two,[])).toThrow(/which hollow box/);
  expect(bananaBoxTarget(two,["b-shell"]).id).toBe("b-shell");
 });
 it("respects 2mm material between bores and 4mm material around wall edge/rim",()=>{
  const project=startingProject(),sh=identifyShell("shell",project);
  expect(bananaBoxHoleIssues(sh,o("front"))).toEqual([]);
  expect(bananaBoxHoleIssues(sh,{...o(),points:[[0,0],[9,0]]}).join(" ")).toMatch(/too close/);
  expect(bananaBoxHoleIssues(sh,{...o(),points:[[0,0],[39,0]]}).join(" ")).toMatch(/wall edge/);
  expect(bananaBoxHoleIssues(sh,{...o("floor"),points:[[0,0],[35,0]]}).join(" ")).toMatch(/floor edge/);
  expect(bananaBoxHoleIssues(sh,{...o(),points:[[0,0],[20,8]]}).join(" ")).toMatch(/wall edge/);
  expect(bananaBoxHoleIssues(sh,{...o(),points:[[NaN,0],[20,0]]}).join(" ")).toMatch(/valid X and Y/);
  expect(()=>bananaBoxHoleParts(project,"shell",{...o(),points:[[0,0],[9,0]]})).toThrow(/too close/);
  expect(()=>bananaBoxHoleParts(project,"shell",{...o(),points:[[0,0],[39,0]]})).toThrow(/wall edge/);
 });
 it("cuts walls in the correct physical direction and never adds a new plate",()=>{
  const project=startingProject();
  const first=bananaBoxHoleParts(project,"shell",o("front"));
  expect(first).toHaveLength(2);
  expect(first.every(n=>n.kind==="cylinder"&&n.role==="hole")).toBe(true);
  expect(first.map(n=>n.position)).toEqual([[-15,-29,12],[15,-29,12]]);
  expect(first.map(n=>n.rotation)).toEqual([[Math.PI/2,0,0],[Math.PI/2,0,0]]);
  expect(first.map(n=>n.params.h)).toEqual([4,4]);
  expect(bananaBoxHoleParts(project,"shell",o("back")).map(n=>n.position[1])).toEqual([29,29]);
  expect(bananaBoxHoleParts(project,"shell",o("left")).map(n=>n.rotation)).toEqual([[0,Math.PI/2,0],[0,Math.PI/2,0]]);
  expect(bananaBoxHoleParts(project,"shell",o("left")).map(n=>n.position[0])).toEqual([-39,-39]);
  expect(bananaBoxHoleParts(project,"shell",o("right")).map(n=>n.position[0])).toEqual([39,39]);
  expect(bananaBoxHoleParts(project,"shell",o("floor")).map(n=>n.position)).toEqual([[-15,0,1],[15,0,1]]);
 });
 it("keeps the same one root (modified box), old shell/cavity nodes and standalone design parts",()=>{
  const project=startingProject(),originalIds=Object.keys(project.nodes);
  const plan=planBananaBoxHoles(project,"shell",o());
  expect(plan.project.rootOrder).toHaveLength(1);
  expect(plan.project.rootOrder[0]).not.toBe("shell");
  expect(plan.selectionId).toBe(plan.project.rootOrder[0]);
  expect(Object.keys(plan.project.nodes)).toEqual(expect.arrayContaining(originalIds));
  expect(plan.cutters).toHaveLength(2);
  const parent=plan.project.nodes[plan.selectionId] as GroupNode;
  expect(parent.childIds[0]).toBe("shell");
  expect(parent.childIds.length).toBe(3);
  expect(parent.label).toBe("Box with banana-plug holes");
  const info=identifyShell(plan.selectionId,plan.project);
  expect(info.width).toBe(80);
  expect(info.height).toBe(22);
 });
 it("supports custom individual X/Y hole coordinates, including vertical movement",()=>{
  const p=startingProject();
  const options:{face:BananaBoxFace;diameter:number;points:[number,number][]}={
   face:"right",diameter:5,points:[[-13,-2],[10,3]]};
  expect(bananaBoxHoleIssues(identifyShell("shell",p),options)).toEqual([]);
  const cutters=bananaBoxHoleParts(p,"shell",options);
  expect(cutters.map(x=>x.position)).toEqual([[39,-13,10],[39,10,15]]);
 });
 it("targets the box even when an old separate connector panel is also on the plate",()=>{
  const project=startingProject();
  // Existing user scene has a hollow box and a separate connector mounting panel.
  const plateId="old-connector-panel";
  const plate:GroupNode={id:plateId,type:"group",label:"Connector mounting panel",
   childIds:[],position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]};
  const mixed:Project={...project,
   nodes:{...project.nodes,[plateId]:plate},
   rootOrder:["shell",plateId]};
  const chosen=bananaBoxTarget(mixed,[plateId]);
  expect(chosen.id).toBe("shell");
  const applied=planBananaBoxHoles(mixed,chosen.id,o("front"));
  expect(applied.project.rootOrder).toHaveLength(2);
  expect(applied.project.rootOrder[1]).toBe(plateId);
  expect((applied.project.nodes[applied.project.rootOrder[0]] as GroupNode).label).toBe("Box with banana-plug holes");
  expect(applied.cutters).toHaveLength(2);
 }); it("creates isolated native-editable STEP fixture with only the box and two holes",()=>{
  const project=startingProject(),plan=planBananaBoxHoles(project,"shell",o("front"));
  writeFileSync(path+"/BANANA_BOX_FRONT_HOLES.json",JSON.stringify(plan.project,null,2),"utf8");
  const plan2=planBananaBoxHoles(project,"shell",o("floor"));
  writeFileSync(path+"/BANANA_BOX_FLOOR_HOLES.json",JSON.stringify(plan2.project,null,2),"utf8");
  expect(plan.project.rootOrder).toHaveLength(1);
  expect(plan2.project.rootOrder).toHaveLength(1);
 });
});