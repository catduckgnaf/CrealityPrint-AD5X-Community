import {describe,it,expect,vi} from "vitest";
vi.mock("./sceneApi",()=>({sceneApi:{getNodeBounds:vi.fn()}}));
vi.mock("../state/store",()=>({useScene:{getState:vi.fn(),setState:vi.fn()}}));
import {shellParts} from "./advancedModels";
import {resolveWorkshopShell} from "./workshopSelection";
import type {Project,GroupNode} from "../types/scene";

function setup(){
 const parts=shellParts(80,60,30,2,3);
 const root:GroupNode={id:"tray",type:"group",label:"Hollow box",
   childIds:parts.map(p=>p.id),position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]};
 const project:Project={id:"test",name:"test",version:1,rootOrder:["tray"],
  nodes:{...Object.fromEntries(parts.map(p=>[p.id,p])),tray:root}};
 return {project,root,parts};
}
describe("Workshop tools available from existing model selection",()=>{
 it("accepts the hollow-box root or selected components within it",()=>{
  const {project,parts}=setup();
  expect(resolveWorkshopShell(project,"tray")).toBe("tray");
  expect(resolveWorkshopShell(project,parts[0].id)).toBe("tray");
  expect(resolveWorkshopShell(project,parts[1].id)).toBe("tray");
 });
 it("does not treat arbitrary parts or locked/rotated shells as compatible",()=>{
  const {project,root,parts}=setup();
  expect(resolveWorkshopShell(project,"missing")).toBeNull();
  root.locked=true;
  expect(resolveWorkshopShell(project,parts[0].id)).toBeNull();
  root.locked=false;root.rotation=[0,0,0.25];
  expect(resolveWorkshopShell(project,parts[0].id)).toBeNull();
 });
});
