// @vitest-environment jsdom
import {afterEach,beforeEach,describe,it,expect,vi} from "vitest";
import {act,createElement} from "react";
import {createRoot,type Root} from "react-dom/client";
vi.mock("../state/store",()=>({useScene:{getState:()=>({}),setState:()=>{}}}));
import {BananaPlugEditor} from "../components/BananaPlugEditor";
import {shellParts} from "./advancedModels";
import {identifyShell} from "./boxFitTools";
import {bananaBoxHoleParts,planBananaBoxHoles} from "./workshopTools";
import {bananaPlugPreset,type BananaPlugPresetId} from "./bananaPlugPresets";
import type {Project,GroupNode} from "../types/scene";
import menuSource from "../components/SmartContextMenu.tsx?raw";
import shelfSource from "../components/HoverShelf.tsx?raw";
import workshopSource from "../components/WorkshopTools.tsx?raw";
import editorSource from "../components/BananaPlugEditor.tsx?raw";
const globalTest=globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean};
globalTest.IS_REACT_ACT_ENVIRONMENT=true;
function makeBox(){
 const parts=shellParts(80,60,22,2,2);
 const group:GroupNode={id:"shell",type:"group",label:"Hollow box",
  childIds:parts.map(n=>n.id),position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]};
 const project:Project={id:"submenu-layout",name:"submenu layout",version:1,
  nodes:{...Object.fromEntries(parts.map(n=>[n.id,n])),shell:group},rootOrder:["shell"]};
 return {project,shell:identifyShell("shell",project)};
}
let container:HTMLDivElement;
let root:Root;
beforeEach(()=>{container=document.createElement("div");document.body.appendChild(container);root=createRoot(container);});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();});
async function show(id:BananaPlugPresetId){
 const {shell}=makeBox(),onCreate=vi.fn();
 await act(async()=>root.render(createElement(BananaPlugEditor,{shell,initialPresetId:id,onCreate})));
 return onCreate;
}
function readInputs(){
 const size=container.querySelector<HTMLSelectElement>('select[aria-label="Banana plug size / type"]');
 const custom=container.querySelector<HTMLInputElement>('input[aria-label="Custom banana hole diameter (mm)"]');
 const create=Array.from(container.querySelectorAll("button")).find(b=>b.textContent?.includes("Add banana-plug holes to box"))!;
 return {size,custom,create};
}
describe("v19.5.37 hover-open connector menu and preserved hole tools",()=>{
 it("opens ONE immediate Hover Shelf for connector types, not a 4-level cascade",()=>{
  expect(menuSource).toContain('id:"connectors",label:"Connectors & holes"');
  expect(menuSource).toContain('label="Banana plug 2 mm"');
  expect(menuSource).toContain('label="Banana plug 3 mm"');
  expect(menuSource).toContain('label="Banana plug 4 mm"');
  expect(menuSource).toContain('label="Banana socket Type B (12.2 mm cutout)"');
  expect(menuSource).toContain('label="DB9 male"');
  expect(menuSource).toContain('label="DB9 female"');
  expect(menuSource).not.toContain('data-connector-trigger="true"');
  expect(menuSource).not.toContain('detail === "bananaSizes"');
  expect(shelfSource).toContain('onPointerEnter={()=>select(g.id)}');
 });
 it("maps 2/3/4 and Custom explicitly without creating a part immediately",()=>{
  expect(menuSource).toContain('openConnectorChoice("banana","mini2-contact")');
  expect(menuSource).toContain('openConnectorChoice("banana","mini3-contact")');
  expect(menuSource).toContain('openConnectorChoice("banana","standard4-contact")');
  expect(menuSource).toContain('openConnectorChoice("banana","custom")');
  expect(menuSource).toContain('openWorkshopRoute({tab:"Jigs",connectorChooser:true,connectorType,bananaPreset,rootId:bananaBoxRootId})');
  expect(menuSource).toContain('editableModelRoot(project,ids)');
  expect(workshopSource).toContain('initialPresetId={bananaPresetId}');
  expect(workshopSource).toContain('key={bananaPresetId}');
  expect(editorSource).toContain('bananaPlugPreset(initialPresetId).holeDiameterMm??NaN');
 });
 for(const [id,dia] of [
  ["mini2-contact",2],["mini3-contact",3],["standard4-contact",4]
 ] as const){
  it("actually renders "+dia+" mm preset and constructs real box holes",async()=>{
   const onCreate=await show(id);
   const {size,custom,create}=readInputs();
   expect(size?.value).toBe(id);
   expect(container.textContent).toContain("Hole");
   expect(container.textContent).toContain(String(dia)+" mm");
   expect(custom).toBeNull();
   expect(create.disabled).toBe(false);
   expect(onCreate).not.toHaveBeenCalled();
   const {project}=makeBox();
   const nodes=bananaBoxHoleParts(project,"shell",{face:"front",diameter:bananaPlugPreset(id).holeDiameterMm!,
    points:[[-15,0],[15,0]]});
   expect(nodes).toHaveLength(2);
   expect(nodes.map(n=>n.params.r)).toEqual([dia/2,dia/2]);
   const next=planBananaBoxHoles(project,"shell",{face:"front",diameter:dia,points:[[-15,0],[15,0]]});
   expect(next.project.rootOrder).toHaveLength(1);
  });
 }
 it("Custom opens EMPTY and disables Create until a measured hole size is entered",async()=>{
  const onCreate=await show("custom");
  const {size,custom,create}=readInputs();
  expect(size?.value).toBe("custom");
  expect(custom).not.toBeNull();
  expect(custom?.value).toBe("");
  expect(create.disabled).toBe(true);
  expect(onCreate).not.toHaveBeenCalled();
 });
 it("preserves other connector types and the working geometry tools",()=>{
  for(const id of ["db9-male","db9-female","banana-type-b-socket","xt60-panel-03"]){
   expect(menuSource).toContain('openConnectorChoice("'+id+'")');
  }
  expect(workshopSource).toContain("applyDB9BoxMount(target.id,options)");
  expect(workshopSource).toContain("applyRoundPanelMount(target.id,options)");
  expect(workshopSource).toContain("applyBananaBoxHoles(target.id,options)");
  expect(workshopSource).not.toContain('createElectronicsJig("Banana-plug assembly holder"');
 });
});