import {describe,expect,it} from "vitest";
import handles from "../components/ResizeHandles.tsx?raw";
import viewport from "../components/Viewport.tsx?raw";

describe("v18.6.1 right-click does not activate transform handles",()=>{
  it("restricts resize drag to left mouse button",()=>{
    expect(handles).toContain("if (e.button !== 0) return;");
    expect(handles).toContain("startDrag(def, e)");
  });
  it("permits context menus even when a resize handle is hovered",()=>{
    expect(viewport).toContain("if(press?.dragged || useScene.getState().modalOpen) return;");
    expect(viewport).not.toContain("press?.dragged || useScene.getState().modalOpen || gizmoState.busy()");
  });
});
