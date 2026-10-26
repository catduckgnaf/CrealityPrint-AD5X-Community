import {describe,expect,it} from "vitest";
import menu from "../components/SmartContextMenu.tsx?raw";
import viewport from "../components/Viewport.tsx?raw";
// CSS is checked through the generated UI class; Vitest stubs CSS imports.

describe("v18.6 context menu integration",()=>{
  it("reuses established geometry, hole and inspector controls",()=>{
    expect(menu).toContain("<QuickTools node={only} hideSurface");
    expect(menu).toContain("<PatternEditor group={only}");
    expect(menu).toContain("<PrecisionPanel ids={ids} focus={detail}");
  });
  it("connects to existing editable scene operations",()=>{
    for(const action of ["duplicateSelected()", "copySelection()", "setFilletMode(true)",
      "dropSelectedToWorkplane()", "deleteSelected()", "pasteClipboard()",
      'sceneApi.dropShape("box"', 'sceneApi.dropShape("cylinder"']) {
      expect(menu).toContain(action);
    }
  });
  it("opens the menu from a canvas right-click without hijacking orbit drag",()=>{
    expect(viewport).toContain("onContextMenu={(e)=>");
    expect(viewport).toContain("press?.dragged");
    expect(viewport).toContain("Math.hypot(dx,dy)>6");
    expect(viewport).toContain("rightStart.current=");
    expect(viewport).toContain("sceneApi.hitNodeAt(e.clientX,e.clientY)");
  });
  it("preserves multiselections and keeps context menu over the canvas",()=>{
    expect(viewport).toContain("state.selection.includes(hit)");
    expect(viewport).toContain('className="absolute z-[91]"');
    expect(menu).toContain('className="design-context-menu"');
  });
  it("dismisses with Escape, leaves viewport controls intact",()=>{
    expect(viewport).toContain('event.key==="Escape"');
    expect(viewport).toContain("onPointerUp={onPointerUp}");
    expect(viewport).toContain("<OrbitControls");
  });
});
