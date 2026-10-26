// @vitest-environment jsdom
import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import {act,createElement} from "react";
import {createRoot,type Root} from "react-dom/client";
import type {Project,GroupNode,ShapeNode} from "../types/scene";
import {shellParts} from "../lib/advancedModels";
import {identifyShell,lidParts,type LidOptions} from "../lib/boxFitTools";
const state=vi.hoisted(()=>({
 current:null as null|{project:Project,selection:string[]},updates:[] as unknown[]
}));
vi.mock("../state/store",()=>{
 const useScene=Object.assign((select:(s:unknown)=>unknown)=>select(state.current),{
  getState:()=>state.current,
  setState:vi.fn((next:{project:Project,selection:string[]})=>{
   state.updates.push(next);
   if(state.current)state.current={...state.current,...next};
  })
 });
 return {useScene};
});
import {HingeEditor} from "./HingeEditor";
import menu from "./SmartContextMenu.tsx?raw";
import app from "../App.tsx?raw";

(globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
let element:HTMLDivElement;let root:Root;
const group=(id:string,parts:ShapeNode[]):GroupNode=>({
 id,type:"group",label:id==="box"?"Hollow box":"Matching lid",
 childIds:parts.map(x=>x.id),position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]
});
const opts:LidOptions={clearance:.3,thickness:2.4,lipDepth:4,lipWall:1.5,overhang:.5,bedGap:12};
function makeProject(withLid:boolean):Project{
 const parts=shellParts(80,60,22,2,2);const b=group("box",parts);
 const project:Project={id:"p",name:"unit",version:1,nodes:{
  ...Object.fromEntries(parts.map(n=>[n.id,n])),[b.id]:b},rootOrder:[b.id]};
 if(!withLid)return project;
 const lidShapes=lidParts(identifyShell(b.id,project),opts,[220,220]);
 const l=group("lid",lidShapes);
 project.nodes={...project.nodes,...Object.fromEntries(lidShapes.map(n=>[n.id,n])),[l.id]:l};
 project.rootOrder.push(l.id);
 return project;
}
beforeEach(()=>{
 element=document.createElement("div");element.className="prepare-match-theme";
 document.body.appendChild(element);root=createRoot(element);
 state.updates=[];
 state.current={project:makeProject(true),selection:["box"]};
});
afterEach(async()=>{await act(async()=>root.unmount());element.remove();state.current=null;});
const launch=async(id="box")=>{
 await act(async()=>root.render(createElement(HingeEditor)));
 await act(async()=>window.dispatchEvent(new CustomEvent("ad5x-open-hinge",{detail:{rootId:id}})));
 const dialog=element.querySelector<HTMLFormElement>('[role="dialog"][aria-label="Add hinge to box and matching lid"]');
 expect(dialog).not.toBeNull();
 return dialog!;
};
const findButton=(label:string)=>
 Array.from(element.querySelectorAll<HTMLButtonElement>("button")).find(x=>x.textContent?.includes(label));
describe("v19.5.53 actual integrated hinge editor",()=>{
 it("right-click menu has ONE working hardware submenu entry on shell or lid, not a new tab",()=>{
  expect(menu).toContain('label="Add removable-pin hinge to box & lid..."');
  expect(menu).toContain('detail:{rootId:only!.id}');
  expect(menu).toContain('(canShell||canLid)');
  expect(app).toContain("<HingeEditor />");
  expect(menu).toContain('label="Heat-set insert pilot bores (in posts)..."');
 });
 it("box automatically recognises its existing matching lid and shows editable pin/gap controls",async()=>{
  const dialog=await launch("box");
  expect(dialog.textContent).toContain("Box & lid hinge");
  expect(dialog.textContent).toContain("Removable-pin");
  expect(dialog.textContent).toContain("Matching lid");
  expect(dialog.textContent).toContain("Back wall");
  expect(dialog.textContent).toContain("physical pin");
  expect(dialog.textContent).toContain("NOT physically fit-tested");
  expect(dialog.querySelector('select[aria-label="Hinge matching lid"]')).not.toBeNull();
  expect(findButton("Add hinge to both parts")?.disabled).toBe(false);
 });
 it("one confirmation atomically attaches alternating hinge knuckles to both independent parts",async()=>{
  await launch("box");
  await act(async()=>findButton("Add hinge to both parts")!.click());
  expect(state.updates).toHaveLength(1);
  const update=state.updates[0] as {project:Project,selection:string[]};
  expect(update.project.rootOrder).toHaveLength(2);
  const newParts=update.project.rootOrder.map(id=>update.project.nodes[id]);
  expect(newParts.map(x=>x.label)).toEqual(["Box with removable-pin hinge","Lid with removable-pin hinge"]);
  expect(update.selection).toEqual([update.project.rootOrder[0]]);
  expect(element.querySelector('[role="dialog"]')).toBeNull();
 });
 it("selecting LID finds the matching BOX without guessing dimensions",async()=>{
  const dialog=await launch("lid");
  expect(dialog.querySelector<HTMLSelectElement>('select[aria-label="Hinge box"]')!.value).toBe("box");
  expect(dialog.querySelector<HTMLSelectElement>('select[aria-label="Hinge matching lid"]')!.value).toBe("lid");
 });
 it("without matching lid the apply button is DISABLED, and no geometry changes",async()=>{
  state.current={project:makeProject(false),selection:["box"]};
  const dialog=await launch("box");
  expect(dialog.textContent).toContain("No matching lid exists");
  expect(findButton("Add hinge to both parts")?.disabled).toBe(true);
  expect(state.updates).toHaveLength(0);
 });
 it("bad pin/barrel dimensions surface a human-readable error and leave both models untouched",async()=>{
  await launch("box");
  const input=element.querySelector<HTMLInputElement>('input[aria-label="Measured removable pin diameter (mm)"]')!;
  await act(async()=>{
   const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")!.set!;
   setter.call(input,"99");
   input.dispatchEvent(new Event("input",{bubbles:true}));
  });
  await act(async()=>findButton("Add hinge to both parts")!.click());
  expect(element.querySelector('[role="alert"]')?.textContent).toContain("diameter");
  expect(state.updates).toHaveLength(0);
 });
});