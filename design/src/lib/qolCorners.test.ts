import {describe,expect,it} from "vitest";
import {withRoundedBoxCorners,UPRIGHT_BOX_EDGES} from "./boxCorners";
import {parsePicks} from "./rounding";
import menu from "../components/SmartContextMenu.tsx?raw";
import palette from "../components/CommandPalette.tsx?raw";
import app from "../App.tsx?raw";
import toolbar from "../components/Toolbar.tsx?raw";

describe("v18.7 easy corner rounding",()=>{
 it("uses exact persisted vertical edge IDs 8–11",()=>{
  expect([...UPRIGHT_BOX_EDGES]).toEqual(["8","9","10","11"]);
  const picks=parsePicks("box",{edges:withRoundedBoxCorners({w:50,d:30,h:15},3)});
  expect([...picks.keys()]).toEqual(["8","9","10","11"]);
  expect([...picks.values()]).toEqual([3,3,3,3]);
 });
 it("does not erase horizontal edge radius",()=>{
  const edges=withRoundedBoxCorners({w:40,d:30,h:20,edges:"0@2,8@1,9@1"},3);
  const picks=parsePicks("box",{edges});
  expect(picks.get("0")).toBe(2);
  expect(picks.get("8")).toBe(3);
  expect(picks.size).toBe(5);
 });
 it("removes only vertical edges, preserving other rounding",()=>{
  const edges=withRoundedBoxCorners({w:40,d:30,h:20,edges:"0@2,8@1,9@1,10@1,11@1"},0);
  expect(edges).toBe("0@2");
 });
 it("migrates legacy all-edge rounding without losing horizontal rounds",()=>{
  const edges=withRoundedBoxCorners({w:30,d:30,h:20,radius:2},3);
  const picks=parsePicks("box",{edges});
  expect(picks.size).toBe(12);
  expect(picks.get("0")).toBe(2);
  expect(picks.get("11")).toBe(3);
 });
 it("rejects oversized, invalid and negative radii",()=>{
  // Upright-edge fillets are limited by plan-view width/depth, not box height.
  expect(()=>withRoundedBoxCorners({w:20,d:20,h:10},10)).toThrow("safe maximum");
  expect(()=>withRoundedBoxCorners({w:20,d:20,h:10},6)).not.toThrow();
  expect(()=>withRoundedBoxCorners({w:20,d:20,h:10},-1)).toThrow();
  expect(()=>withRoundedBoxCorners({w:20,d:20,h:10},Number.NaN)).toThrow();
  expect(()=>withRoundedBoxCorners({w:20,d:20,h:10},3)).not.toThrow();
 });
 it("uses existing scene store in one action and a visible right-click panel",()=>{
  expect(menu).toContain('label="Round four corners…"');
  expect(menu).toContain("roundBoxCorners(only.id");
  expect(menu).toContain("Safe maximum");
 });
});
describe("v18.7 command search",()=>{
 it("provides keyboard/toolbar entry without replacing existing shortcuts",()=>{
  expect(palette).toContain('e.key.toLowerCase()==="k"');
  expect(toolbar).toContain("Search commands (Ctrl+K)");
  expect(app).toContain("<CommandPalette />");
 });
 it("only exposes existing CAD command handlers",()=>{
  for(const op of ["copySelection()","duplicateSelected()","groupSelected()",
   "dropSelectedToWorkplane()","setMeasureMode","sceneApi.zoomToFit","saveProjectFile"]) {
   expect(palette).toContain(op);
  }
 });
 it("supports command filtering, selection gating and key navigation",()=>{
  expect(palette).toContain("ready:writable");
  expect(palette).toContain('e.key==="ArrowDown"');
  expect(palette).toContain('e.key==="Enter"');
  expect(palette).toContain('e.key==="Escape"');
 });
});
