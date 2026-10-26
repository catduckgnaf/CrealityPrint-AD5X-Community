import {fixtureDir} from "./testFixturePath";
import {describe,it,expect,vi} from "vitest";
vi.mock("../state/store",()=>({useScene:{getState:()=>({}),setState:()=>{}}}));
// @ts-expect-error Vitest executes under Node; browser TypeScript deliberately omits Node declarations.
import {writeFileSync} from "node:fs";
import {
 bananaPlugHolderIssues,bananaPlugHolderParts,spacedBananaHoles,
 type BananaPlugHolderOptions
} from "./workshopTools";
import {type Project,type GroupNode} from "../types/scene";
const root=fixtureDir();
const opts:BananaPlugHolderOptions={
 width:100,depth:60,height:8,diameter:8,points:spacedBananaHoles(2,30)
};
describe("v19.5.30 measured banana-plug holder",()=>{
 it("generates a centered two-plug layout with adjustable nominal centre spacing",()=>{
  expect(spacedBananaHoles(2,30)).toEqual([[-15,0],[15,0]]);
  expect(spacedBananaHoles(3,24)).toEqual([[-24,0],[0,0],[24,0]]);
  expect(spacedBananaHoles(16,10)).toHaveLength(16);
  expect(()=>spacedBananaHoles(1,30)).toThrow(/2 to 16/);
  expect(()=>spacedBananaHoles(17,30)).toThrow(/2 to 16/);
 });
 it("creates a real editable plate with separately labelled banana plug opening cutters",()=>{
  const parts=bananaPlugHolderParts(opts);
  expect(parts).toHaveLength(3);
  expect(parts[0].role).toBe("solid");
  expect(parts[0].label).toBe("Banana-plug holding plate");
  expect(parts[0].position).toEqual([0,0,4]);
  expect(parts.slice(1).map(p=>p.role)).toEqual(["hole","hole"]);
  expect(parts.slice(1).map(p=>p.position)).toEqual([[-15,0,4],[15,0,4]]);
  expect(parts.slice(1).map(p=>p.params.r)).toEqual([4,4]);
  expect(parts.slice(1).map(p=>p.label)).toEqual(["Banana plug 1 holder opening","Banana plug 2 holder opening"]);
 });
 it("supports manually moved holes with different X and Y values",()=>{
  const o={...opts,points:[[-21,-10],[14,9],[30,-12]] as [number,number][]};
  expect(bananaPlugHolderIssues(o)).toEqual([]);
  const parts=bananaPlugHolderParts(o);
  expect(parts.slice(1).map(p=>p.position.slice(0,2))).toEqual(o.points);
 });
 it("warns in plain language when two plugs are too close together",()=>{
  const warnings=bananaPlugHolderIssues({...opts,points:[[0,0],[9,0]]});
  expect(warnings.join(" ")).toMatch(/Holes 1 and 2 are too close/);
  expect(warnings.join(" ")).toMatch(/at least 2 mm/);
  expect(()=>bananaPlugHolderParts({...opts,points:[[0,0],[9,0]]})).toThrow(/too close/);
 });
 it("warns when plug opening cuts through the plate edge",()=>{
  const warnings=bananaPlugHolderIssues({...opts,points:[[-47,0],[0,0]]});
  expect(warnings.join(" ")).toContain("Hole 1 is too close to the plate edge");
  expect(()=>bananaPlugHolderParts({...opts,points:[[-47,0],[0,0]]})).toThrow(/edge/);
 });
 it("does not assume a banana-plug standard or silently change user dimensions",()=>{
  expect(bananaPlugHolderIssues({...opts,diameter:42}).join(" ")).toMatch(/Measure your banana plug body/);
  expect(bananaPlugHolderIssues({...opts,points:[[NaN,0],[8,0]]}).join(" ")).toMatch(/valid X and Y/);
  expect(bananaPlugHolderIssues({...opts,width:230}).join(" ")).toMatch(/20 to 220/);
  expect(bananaPlugHolderIssues({...opts,points:[[0,0]]}).join(" ")).toMatch(/2 and 16/);
  expect(bananaPlugHolderIssues({...opts,diameter:10,points:[[0,0],[12,0]]})).toEqual([]);
 });
 it("exports a representative editable project fixture for real STEP/FreeCAD acceptance",()=>{
  const parts=bananaPlugHolderParts(opts);
  const id="banana_holder_root";
  const group:GroupNode={id,type:"group",label:"Banana-plug assembly holder",
   childIds:parts.map(p=>p.id),position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]};
  const project:Project={id:"banana-plug-fixture",version:1,name:"Measured banana-plug fixture",
   rootOrder:[id],nodes:{...Object.fromEntries(parts.map(p=>[p.id,p])),[id]:group}};
  writeFileSync(root+"/BANANA_PLUG_2_HOLE_FIXTURE.json",JSON.stringify(project,null,2),"utf8");
  expect(parts).toHaveLength(3);
 });
});