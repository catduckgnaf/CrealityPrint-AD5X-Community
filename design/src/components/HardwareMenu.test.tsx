// @vitest-environment jsdom
import {afterEach,beforeEach,describe,it,expect,vi} from "vitest";
import {act,createElement} from "react";
import {createRoot,type Root} from "react-dom/client";
import type {Project} from "../types/scene";
import {makeShape} from "../lib/primitives";
import {shellParts} from "../lib/advancedModels";
import type {GroupNode} from "../types/scene";
import menuSource from "./SmartContextMenu.tsx?raw";
import workshopSource from "./WorkshopTools.tsx?raw";
import advancedSource from "./AdvancedTools.tsx?raw";
import hoverShelfSource from "./HoverShelf.tsx?raw";
const mocks=vi.hoisted(()=>({
  current:null as null|{project:Project,selection:string[],setSelection:(v:string[])=>void,setPlacing:(v:string)=>void},
  setSelection:vi.fn(),setPlacing:vi.fn()
}));
vi.mock("../state/store",()=>{
 const useScene=Object.assign((select:(s:unknown)=>unknown)=>select(mocks.current),{
  getState:()=>mocks.current,setState:vi.fn()
 });
 return {useScene};
});
vi.mock("../lib/sceneApi",()=>({sceneApi:{getNodeBounds:vi.fn(),dropShape:vi.fn()}}));
import {SmartContextMenu} from "./SmartContextMenu";

(globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
const empty:Project={id:"test",version:1,name:"test",nodes:{},rootOrder:[]};
let container:HTMLDivElement;
let root:Root;
let dispatched:{type:string;detail:unknown}[];
const listener=(e:Event)=>dispatched.push({type:e.type,detail:(e as CustomEvent).detail});
const close=vi.fn();
beforeEach(()=>{
  container=document.createElement("div");container.className="design-viewport";
  document.body.appendChild(container);root=createRoot(container);
  dispatched=[];close.mockReset();mocks.setSelection.mockReset();mocks.setPlacing.mockReset();
  window.addEventListener("ad5x-open-workshop",listener);
  window.addEventListener("ad5x-open-hardware",listener);
  mocks.current={project:empty,selection:[],setSelection:mocks.setSelection,setPlacing:mocks.setPlacing};
});
afterEach(async()=>{
 window.removeEventListener("ad5x-open-workshop",listener);
 window.removeEventListener("ad5x-open-hardware",listener);
 await act(async()=>root.unmount());container.remove();mocks.current=null;
});
async function mountShape(){
 const part=makeShape("box");
 part.label="Box";part.role="solid";
 mocks.current={...mocks.current!,project:{...empty,nodes:{[part.id]:part},rootOrder:[part.id]},selection:[part.id]};
 await act(async()=>root.render(createElement(SmartContextMenu,{
  menu:{kind:"shape",ids:[part.id],x:180,y:200,clientX:180,clientY:200},
  close
 })));
}
async function mountHollow(){
 const parts=shellParts(80,60,22,2,2);
 const group:GroupNode={id:"shell-hardware",type:"group",label:"Hollow box",
  childIds:parts.map(n=>n.id),position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]};
 mocks.current={...mocks.current!,
  project:{...empty,nodes:{...Object.fromEntries(parts.map(p=>[p.id,p])),[group.id]:group},
    rootOrder:[group.id]},selection:[group.id]};
 await act(async()=>root.render(createElement(SmartContextMenu,{
  menu:{kind:"shape",ids:[group.id],x:180,y:200,clientX:180,clientY:200},close
 })));
}
async function mountEmpty(){
 await act(async()=>root.render(createElement(SmartContextMenu,{
  menu:{kind:"empty",ids:[],x:180,y:200,clientX:180,clientY:200},
  close
 })));
}
async function openHardware(){
 const category=container.querySelector<HTMLButtonElement>('[data-shelf-group="hardware"]');
 expect(category).not.toBeNull();
 await act(async()=>category!.focus());
 const panel=container.querySelector('[data-shelf-panel="hardware"]');
 expect(panel).not.toBeNull();return panel!;
}
async function click(panel:Element,text:string){
 const action=Array.from(panel.querySelectorAll<HTMLButtonElement>('button')).find(b=>b.textContent?.includes(text));
 expect(action).toBeDefined();
 expect(action!.disabled).toBe(false);
 await act(async()=>action!.click());
}
describe("v19.5.51 hardware menu real existing tool routing",()=>{
 it("normal solid box exposes all hardware groups; clicking screws starts the real Workshop drill editor",async()=>{
  await mountShape();
  const panel=await openHardware();
  for(const label of ["Screw clearance / drill holes","Standoffs / mounting posts",
   "Heat-set insert pilot bores","Standalone screw standoff","Mounting tab with screw hole",
   "Screw head counterbore","Threaded shaft shape"])expect(panel.textContent).toContain(label);
  await click(panel,"Screw clearance / drill holes");
  expect(dispatched).toEqual([{type:"ad5x-open-workshop",detail:{
    tab:"Jigs",jigKind:"drill",hardwareIntent:"screws"
  }}]);
  expect(close).toHaveBeenCalledTimes(1);
 });
 it("standoffs route to the four-post tool and heat inserts reveal the pilot-bore editor, not a fake premade insert",async()=>{
  await mountShape();let panel=await openHardware();
  await click(panel,"Heat-set insert pilot bores");
  expect(dispatched).toEqual([{type:"ad5x-open-workshop",detail:{
    tab:"Enclosure",enclosureTask:"posts",hardwareIntent:"heat-insert"
  }}]);
  expect(workshopSource).toContain('setPostBoreExpanded(intent==="heat-insert")');
  expect(workshopSource).toContain('open={postBoreExpanded}');
  expect(workshopSource).toContain('Enter the insert manufacturer');
 });
 it("the user’s real hollow tray has active screws, mounting posts and heat-set pilot bore links",async()=>{
  await mountHollow();
  const panel=await openHardware();
  const get=(name:string)=>Array.from(panel.querySelectorAll<HTMLButtonElement>("button"))
    .find(x=>x.textContent?.includes(name));
  for(const name of ["Screw clearance / drill holes","Standoffs / mounting posts",
     "Heat-set insert pilot bores"]){
    expect(get(name)).toBeDefined();
    expect(get(name)!.disabled).toBe(false);
  }
  await click(panel,"Standoffs / mounting posts");
  expect(dispatched).toEqual([{type:"ad5x-open-workshop",detail:{
    tab:"Enclosure",enclosureTask:"posts",hardwareIntent:"standoff"
  }}]);
  expect(mocks.setSelection).toHaveBeenCalledWith(["shell-hardware"]);
 });
 it("standalone starter parts open the proven Advanced library with a selected part",async()=>{
  await mountEmpty();
  const panel=await openHardware();
  await click(panel,"Standalone screw standoff");
  expect(dispatched).toEqual([{type:"ad5x-open-hardware",detail:{tool:"Parts",part:"standoff"}}]);
  expect(advancedSource).toContain('window.addEventListener("ad5x-open-hardware",openHardware)');
  expect(advancedSource).toContain('setTool("Parts");setPart(detail.part)');
 });
 it("empty plate offers standalone parts but not operations that require a selected model",async()=>{
  await mountEmpty();const panel=await openHardware();
  expect(panel.textContent).toContain("Standalone screw standoff");
  expect(panel.textContent).toContain("Mounting tab with screw hole");
  expect(panel.textContent).not.toContain("Heat-set insert pilot bores");
  expect(panel.textContent).not.toContain("Standoffs / mounting posts");
  expect(panel.textContent).not.toContain("Screw clearance / drill holes");
  await click(panel,"Threaded shaft shape");
  expect(mocks.setPlacing).toHaveBeenCalledWith("thread");
 });
 it("main Hover Shelf remains one level and retains previous tool groups and the verified Length field",()=>{
  expect(menuSource).toContain('id:"dividers",label:"Dividers"');
  expect(menuSource).toContain('id:"organizers",label:"Organizers, lids & bins"');
  expect(menuSource).toContain('id:"connectors",label:"Connectors & holes"');
  expect(menuSource).toContain('id:"geometry",label:"Edit geometry"');
  expect(menuSource).toContain('id:"hardware",label:"Hardware & mounting"');
  expect(hoverShelfSource).toContain('className="design-hover-shelf-panel"');
  expect(workshopSource).toContain('{field("trayW","Width")}{field("trayD","Length")}{field("trayH","Height")}');
  expect(workshopSource).toContain('applyModelMountingPosts(target.id,target.bounds!');
  expect(workshopSource).toContain('applyModelDrill(id,modelBounds(id)');
 });
});