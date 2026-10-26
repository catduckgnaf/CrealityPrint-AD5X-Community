// @vitest-environment jsdom
import {afterEach,beforeEach,describe,it,expect,vi} from "vitest";
import {act,createElement} from "react";
import {createRoot,type Root} from "react-dom/client";
import type {Project} from "../types/scene";
const scene=vi.hoisted(()=>({current:{
 project:{id:"test",name:"test",version:1,nodes:{},rootOrder:[]} as Project,
 selection:[] as string[]
}}));
vi.mock("../state/store",()=>{
 const useScene=Object.assign((select:(s:unknown)=>unknown)=>select(scene.current),{
  getState:()=>scene.current,setState:vi.fn()
 });
 return {useScene};
});
vi.mock("../lib/sceneApi",()=>({sceneApi:{getNodeBounds:vi.fn()}}));
import {WorkshopTools} from "./WorkshopTools";
import {AdvancedTools} from "./AdvancedTools";
(globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
let container:HTMLDivElement;let root:Root;
beforeEach(()=>{
 container=document.createElement("div");
 document.body.appendChild(container);
 root=createRoot(container);
});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();});
const open=(type:string,detail:unknown)=>act(async()=>{
 window.dispatchEvent(new CustomEvent(type,{detail}));
});
const mount=()=>act(async()=>root.render(createElement("div",{},[
 createElement(WorkshopTools,{key:"workshop"}),
 createElement(AdvancedTools,{key:"advanced"})
])));
describe("Hardware menu editor destinations are FUNCTIONAL existing dialogs",()=>{
 it("heat-set option opens existing four-post tool with pilot bore expanded",async()=>{
  await mount();
  await open("ad5x-open-workshop",{
   tab:"Enclosure",enclosureTask:"posts",hardwareIntent:"heat-insert"
  });
  const dialog=container.querySelector('[role="dialog"][aria-label="Workshop tools"]');
  expect(dialog).not.toBeNull();
  expect(dialog!.textContent).toContain("Four corner posts");
  expect(dialog!.textContent).toContain("Add four mounting posts");
  expect(dialog!.textContent).toContain("Heat-set inserts use a measured pilot bore");
  const detail=dialog!.querySelector<HTMLDetailsElement>("details.ad5x-simple-extra");
  expect(detail).not.toBeNull();
  expect(detail!.open).toBe(true);
  expect(dialog!.textContent).toContain("Pilot bore diameter");
 });
 it("standoff route opens posts editor, leaving insert bore section initially folded",async()=>{
  await mount();
  await open("ad5x-open-workshop",{
   tab:"Enclosure",enclosureTask:"posts",hardwareIntent:"standoff"
  });
  const dialog=container.querySelector('[aria-label="Workshop tools"]')!;
  expect(dialog.textContent).toContain("Add four mounting posts");
  expect(dialog.querySelector<HTMLDetailsElement>("details.ad5x-simple-extra")!.open).toBe(false);
 });
 it("screw route opens selected-model drill workflow, not unrelated connector editor",async()=>{
  await mount();
  await open("ad5x-open-workshop",{
   tab:"Jigs",jigKind:"drill",hardwareIntent:"screws"
  });
  const dialog=container.querySelector('[aria-label="Workshop tools"]')!;
  expect(dialog.textContent).toContain("Screw clearance: enter the measured hole diameter");
  expect(dialog.textContent).toContain("Drilling template");
  expect(dialog.textContent).toContain("Drill");
 });
 it("standalone hardware routes to Parts editor with requested item selected",async()=>{
  await mount();
  await open("ad5x-open-hardware",{tool:"Parts",part:"mounting-tab"});
  const dialog=container.querySelector('[role="dialog"][aria-label="Advanced Design tools"]');
  expect(dialog).not.toBeNull();
  const select=Array.from(dialog!.querySelectorAll("select"))
   .find(x=>Array.from(x.options).some(o=>o.value==="mounting-tab"));
  expect(select).toBeDefined();
  expect(select!.value).toBe("mounting-tab");
  expect(dialog!.textContent).toContain("Insert into Design");
 });
 it("counterbore route opens existing hole wizard with counterbore selected",async()=>{
  await mount();
  await open("ad5x-open-hardware",{tool:"Holes",holeStyle:"counterbore"});
  const dialog=container.querySelector('[role="dialog"][aria-label="Advanced Design tools"]')!;
  const select=Array.from(dialog.querySelectorAll("select"))
   .find(x=>Array.from(x.options).some(o=>o.value==="counterbore"));
  expect(select).toBeDefined();
  expect(select!.value).toBe("counterbore");
  expect(dialog.textContent).toContain("Head diameter");
 });
});
