// @vitest-environment jsdom
import {beforeEach,afterEach,describe,it,expect,vi} from "vitest";
import {act,createElement} from "react";
import {createRoot,type Root} from "react-dom/client";
const mocks=vi.hoisted(()=>({setPlacingConnector:vi.fn(),mount:vi.fn(),userCut:vi.fn()}));
vi.mock("../state/store",()=>({
 useScene:Object.assign((fn:(s:unknown)=>unknown)=>fn({setPlacingConnector:mocks.setPlacingConnector}),
  {getState:()=>({selection:["shell"]})}),
}));
vi.mock("../lib/componentBoxMount",()=>({applyComponentBoxMount:mocks.mount}));
vi.mock("../lib/userSizedComponentCut",()=>({applyUserSizedComponentCut:mocks.userCut}));
import {ComponentLibrary} from "./ComponentLibrary";

(globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
let node:HTMLDivElement;let root:Root;
beforeEach(()=>{
 node=document.createElement("div");
 node.className="prepare-match-theme";document.body.appendChild(node);root=createRoot(node);
 mocks.setPlacingConnector.mockReset();mocks.mount.mockReset();mocks.userCut.mockReset();
});
afterEach(async()=>{await act(async()=>root.unmount());node.remove();});
async function mount(){await act(async()=>root.render(createElement(ComponentLibrary)));}
async function open(id?:string){
 await act(async()=>window.dispatchEvent(new CustomEvent("ad5x-open-component-library",
  {detail:id?{id}:{}})));
 const dlg=node.querySelector('[role="dialog"][aria-label="AD5X Component library"]');
 expect(dlg).not.toBeNull();return dlg!;
}
async function click(el:HTMLElement){await act(async()=>el.click());}
const btn=(label:string)=>Array.from(node.querySelectorAll<HTMLButtonElement>("button"))
 .find(el=>el.textContent?.trim()===label);
describe("imported physical component catalogue opens and performs real preview placement",()=>{
 it("shows all eight distinct physical products with SKU, status, supplier dimensions and thumbnail paths",async()=>{
  await mount();const dlg=await open("mr-c14-switch");
  const entries=dlg.querySelectorAll(".ad5x-components-entry");
  expect(entries).toHaveLength(8);
  expect(dlg.textContent).toContain("C14-SWITCH");
  expect(dlg.textContent).toContain("42 × 27 mm");
  expect(dlg.textContent).toContain("Two"); // supplier fixing holes information
  const images=Array.from(dlg.querySelectorAll<HTMLImageElement>(".ad5x-components-entry img"));
  expect(new Set(images.map(i=>i.src)).size).toBe(8);
  expect(dlg.textContent).toContain("Measurements needed");
  expect(dlg.textContent).toContain("Supplier source");
  expect(dlg.textContent).toContain("Nominal DXF reference");
  expect(dlg.textContent).toContain("Mains inlet");
  expect(btn("Place nominal cutout")?.disabled).toBe(false);
 });
 it("C14 nominal cutter enters EXACT existing movable click-placement state, not an auto-cut",async()=>{
  await mount();await open("mr-c14-switch");
  await click(btn("Place nominal cutout")!);
  expect(mocks.setPlacingConnector).toHaveBeenCalledExactlyOnceWith("component-mr-c14-switch");
  expect(node.querySelector('[role="dialog"]')).toBeNull();
 });
 it("ITW pushbutton D-flat places via same workflow, retains its range and seal caveat",async()=>{
  await mount();const dlg=await open("itw-59-111");
  expect(dlg.textContent).toContain("13.625");
  expect(dlg.textContent).toContain("12.925");
  expect(dlg.textContent).toContain("D-flat faces left");
  expect(dlg.textContent).toContain("Physical fit test");
  await click(btn("Place nominal cutout")!);
  expect(mocks.setPlacingConnector).toHaveBeenCalledExactlyOnceWith("component-itw-59-111");
 });
 it("existing hollow enclosure can receive exact documented cutter without replacing the old movable option",async()=>{
  await mount();const dlg=await open("mr-c14-switch");
  expect(dlg.textContent).toContain("Cut selected enclosure wall");
  await click(btn("Cut selected enclosure")!);
  expect(mocks.mount).toHaveBeenCalledExactlyOnceWith("shell",{
   componentId:"mr-c14-switch",face:"front",offsetX:0,offsetY:0});
  expect(mocks.setPlacingConnector).not.toHaveBeenCalled();
 });
 it("Phase 2 supplier drawing renders offline, but cannot be applied as a C14-NO-SWITCH cutter",async()=>{
  await mount();const dlg=await open("mr-c14-no-switch");
  expect(dlg.textContent).toContain("50");
  expect(dlg.textContent).toContain("29");
  expect(dlg.textContent).toContain("exact-SKU supplier");
  expect(dlg.textContent).toContain("not a verified panel aperture");
  expect(dlg.textContent).toContain("Supplier notes and limitations");
  expect(dlg.textContent).toContain("Part specifications (not mounting dimensions)");
  const diagram=dlg.querySelector<HTMLImageElement>('[aria-label="Supplier reference drawing"] img');
  expect(diagram).not.toBeNull();
  expect(diagram!.getAttribute("src")).toBe("/component-library/references/MR_C14_NO_SWITCH_supplier_layout.jpg");
  expect(btn("Measurements needed")?.disabled).toBe(true);
  expect(btn("Cut selected enclosure")).toBeUndefined();
  expect(mocks.mount).not.toHaveBeenCalled();
 });
 it("a SKU with UNKNOWN cutout never enables cutout generation (even after trying click)",async()=>{
  await mount();const dlg=await open("mr-ledh-03-conc");
  expect(dlg.textContent).toContain("LEDH-03-CONC");
  expect(dlg.textContent).toContain("Measurements needed");
  expect(dlg.textContent).toContain("panel opening unknown");
  const disabled=btn("Measurements needed");
  expect(disabled).toBeDefined();
  expect(disabled!.disabled).toBe(true);
  await click(disabled!);
  expect(mocks.setPlacingConnector).not.toHaveBeenCalled();
 });
 it("user-sized cutout requires explicit dimensions and routes exact missing SKU, not fake manufacturer data",async()=>{
  await mount();const dlg=await open("mr-ledh-03-conc");
  expect(dlg.textContent).toContain("Cut using your own dimensions");
  expect(dlg.textContent).toContain("NOT an automatic or manufacturer-verified fit");
  expect(btn("Measurements needed")?.disabled).toBe(true);
  expect(btn("Cut using my measurements")?.disabled).toBe(true);
  const d=dlg.querySelector<HTMLInputElement>('[aria-label="User cutout width"]')!;
  await act(async()=>{
   Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")!.set!.call(d,"6.2");
   d.dispatchEvent(new Event("input",{bubbles:true}));
  });
  expect(btn("Cut using my measurements")?.disabled).toBe(false);
  await click(btn("Cut using my measurements")!);
  expect(mocks.userCut).toHaveBeenCalledExactlyOnceWith("shell",{
   componentId:"mr-ledh-03-conc",shape:"circle",width:6.2,height:undefined,
   face:"front",offsetX:0,offsetY:0
  });
  expect(mocks.mount).not.toHaveBeenCalled();
 });
 it("search by exact SKU and reopen with another selected component without replacing the entire app",async()=>{
  await mount();await open();
  const input=node.querySelector<HTMLInputElement>('input[aria-label="Find component by SKU or name"]')!;
  await act(async()=>{
   const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")!.set!;
   setter.call(input,"FUSE20");
   input.dispatchEvent(new Event("input",{bubbles:true}));
  });
  expect(node.querySelectorAll(".ad5x-components-entry")).toHaveLength(1);
  expect(node.textContent).toContain("FUSE20");
  await click(btn("Close")!);
  expect(node.querySelector('[role="dialog"]')).toBeNull();
  const dlg=await open("communica-dpm-bmt");
  expect(dlg.textContent).toContain("DPM/BMT MINI DIG VOLTMT");
 });
});