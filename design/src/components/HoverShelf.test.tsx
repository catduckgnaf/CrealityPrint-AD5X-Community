// @vitest-environment jsdom
import {afterEach,beforeEach,describe,it,expect,vi} from "vitest";
import {act,createElement} from "react";
import {createRoot,type Root} from "react-dom/client";
import {Boxes,Grid2X2,Move3d} from "lucide-react";
import {HoverShelf,hoverShelfSide,type HoverShelfGroup} from "./HoverShelf";
const globalTest=globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean};
globalTest.IS_REACT_ACT_ENVIRONMENT=true;
let container:HTMLDivElement;let root:Root;
const calls={first:vi.fn(),second:vi.fn()};
const groups:HoverShelfGroup[]=[
 {id:"dividers",label:"Dividers",icon:Grid2X2,
  contents:createElement("button",{onClick:calls.first},"Place lengthwise divider")},
 {id:"connectors",label:"Connectors & holes",icon:Boxes,
  contents:createElement("button",{onClick:calls.second},"DB9 female")},
 {id:"arrange",label:"Position & arrange",icon:Move3d,
  contents:createElement("button",{},"Place on build plate")}
];
beforeEach(()=>{
 container=document.createElement("div");container.className="design-viewport";
 document.body.appendChild(container);root=createRoot(container);
 calls.first.mockReset();calls.second.mockReset();
});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.restoreAllMocks();});
async function show(){
 await act(async()=>root.render(createElement(HoverShelf,{
   title:"Hollow box",hint:"Tool groups",kind:"shape",groups,
   quick:createElement("button",{},"Duplicate") })));
}
async function pointer(target:Element,name:string,relatedTarget:EventTarget|null=null){
 await act(async()=>{
  const event=new Event(name,{bubbles:true});
  Object.defineProperty(event,"relatedTarget",{value:relatedTarget});
  target.dispatchEvent(event);
 });
}

describe("v19.5.47 one-panel Hover Shelf interaction",()=>{
 it("shows one compact, contextual root with quick action and NO open shelf at first",async()=>{
  await show();
  expect(container.querySelectorAll(".design-hover-shelf-root")).toHaveLength(1);
  expect(container.querySelectorAll(".design-hover-shelf-panel")).toHaveLength(0);
  expect(container.textContent).toContain("Hollow box");
  expect(container.textContent).toContain("Duplicate");
  expect(container.querySelectorAll('[data-shelf-group]')).toHaveLength(3);
  expect(container.querySelector('[data-shelf-group="dividers"]')?.getAttribute("aria-expanded")).toBe("false");
 });
 it("opens a SINGLE shelf immediately on pointer hover, and swaps contents when changing category",async()=>{
  await show();
  await pointer(container.querySelector('[data-shelf-group="dividers"]')!,"pointerover");
  expect(container.querySelectorAll(".design-hover-shelf-panel")).toHaveLength(1);
  expect(container.querySelector('[data-shelf-panel="dividers"]')).not.toBeNull();
  expect(container.textContent).toContain("Place lengthwise divider");
  await pointer(container.querySelector('[data-shelf-group="connectors"]')!,"pointerover");
  expect(container.querySelectorAll(".design-hover-shelf-panel")).toHaveLength(1);
  expect(container.querySelector('[data-shelf-panel="connectors"]')).not.toBeNull();
  expect(container.textContent).toContain("DB9 female");
  expect(container.textContent).not.toContain("Place lengthwise divider");
 });
 it("uses existing executable React actions, not display-only mock menu controls",async()=>{
  await show();
  await pointer(container.querySelector('[data-shelf-group="dividers"]')!,"pointerover");
  const btn=Array.from(container.querySelectorAll('button')).find(el=>el.textContent==="Place lengthwise divider")!;
  await act(async()=>btn.click());
  expect(calls.first).toHaveBeenCalledOnce();
  expect(calls.second).not.toHaveBeenCalled();
 });
 it("keyboard focus and ArrowLeft / Escape let users traverse without mouse hover",async()=>{
  await show();
  const item=container.querySelector<HTMLButtonElement>('[data-shelf-group="connectors"]')!;
  await act(async()=>item.focus());
  expect(container.querySelector('[data-shelf-panel="connectors"]')).not.toBeNull();
  await act(async()=>item.dispatchEvent(new KeyboardEvent("keydown",{key:"ArrowLeft",bubbles:true})));
  expect(container.querySelectorAll(".design-hover-shelf-panel")).toHaveLength(0);
  await act(async()=>item.dispatchEvent(new KeyboardEvent("keydown",{key:"ArrowRight",bubbles:true})));
  expect(container.querySelector('[data-shelf-panel="connectors"]')).not.toBeNull();
  await act(async()=>item.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true})));
  expect(container.querySelectorAll(".design-hover-shelf-panel")).toHaveLength(0);
 });
 it("lets the user enter and CLICK short shelves from low categories, without collapsing on the crossing",async()=>{
  await show();
  const arrange=container.querySelector<HTMLButtonElement>('[data-shelf-group="arrange"]')!;
  await pointer(arrange,"pointerover");
  const shelf=container.querySelector<HTMLElement>('[data-shelf-panel="arrange"]')!;
  expect(shelf).not.toBeNull();
  // Regression: the short shelf used to end above the low category, so a
  // real mouse crossed the canvas and lost the menu before reaching the link.
  await pointer(shelf,"pointerover");
  expect(container.querySelector('[data-shelf-panel="arrange"]')).not.toBeNull();
  expect(container.querySelector('[data-shelf-group="arrange"]')?.getAttribute("aria-expanded")).toBe("true");
  const target=Array.from(shelf.querySelectorAll("button")).find(x=>x.textContent==="Place on build plate");
  expect(target).toBeDefined();
  await act(async()=>target!.click());
  expect(container.querySelector('[data-shelf-panel="arrange"]')).not.toBeNull();
 });
 it("chooses right or left based on REAL viewport space, not 3-wide cascade guesses",()=>{
  expect(hoverShelfSide(320,590,0,1300)).toBe("right");
  expect(hoverShelfSide(1010,1280,0,1300)).toBe("left");
  expect(hoverShelfSide(100,370,0,700)).toBe("right");
  expect(hoverShelfSide(410,680,0,700)).toBe("left");
 });
});