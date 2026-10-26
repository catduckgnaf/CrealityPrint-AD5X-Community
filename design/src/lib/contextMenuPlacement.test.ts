import {describe,it,expect} from "vitest";
import {contextMenuX,ROOT_MENU_WIDTH,CONTEXT_MENU_MARGIN} from "./contextMenuPlacement";
import {hoverShelfSide} from "../components/HoverShelf";
import viewport from "../components/Viewport.tsx?raw";

describe("v19.5.47 ONE-level Hover Shelf positioning",()=>{
 it("keeps right-click close to the pointer without reserving 3 abandoned nested cascades",()=>{
   expect(contextMenuX(760,1660,true)).toBe(760);
   expect(contextMenuX(414,1164,true)).toBe(414);
   expect(contextMenuX(100,1660,true)).toBe(100);
 });
 it("never clips root menu at the right edge",()=>{
   for(const width of [1660,1164,900,700,370]){
     const x=contextMenuX(width-5,width,true);
     expect(x+ROOT_MENU_WIDTH+CONTEXT_MENU_MARGIN).toBeLessThanOrEqual(width);
     expect(x).toBeGreaterThanOrEqual(6);
   }
 });
 it("does not shift ordinary objects or the empty build plate",()=>{
   expect(contextMenuX(950,1164,false)).toBe(882);
   expect(contextMenuX(400,900,true)).toBe(400);
   expect(contextMenuX(400,900,false)).toBe(400);
 });
 it("opens shelf right where it fits, otherwise LEFT (using the actual viewport bounds)",()=>{
   expect(hoverShelfSide(300,570,0,1660)).toBe("right");
   expect(hoverShelfSide(1250,1520,0,1660)).toBe("left");
   expect(hoverShelfSide(400,670,0,900)).toBe("left");
   expect(hoverShelfSide(0,270,0,700)).toBe("right");
 });
 it("keeps actual CAD viewport event routing, mouse orbit and hit selections intact",()=>{
   expect(viewport).toContain("editableModelRoot(state.project,ids)");
   expect(viewport).toContain("contextMenuX(e.clientX-rect.left,rect.width,hasConnector)");
   expect(viewport).toContain('setContextMenu({kind:ids.length?"shape":"empty"');
 });
});
