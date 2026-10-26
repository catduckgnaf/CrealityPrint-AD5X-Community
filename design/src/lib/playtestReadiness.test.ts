import {describe,it,expect} from "vitest";
import panel from "../components/WorkshopTools.tsx?raw";
import toolbar from "../components/Toolbar.tsx?raw";
import jig from "./workshopTools.ts?raw";
describe("isolated v19.5.20.1 playtest readiness",()=>{
 it("does not falsely tell user the edited project has already been saved to disk",()=>{
  expect(panel).toContain("Use File > Save project as JSON to keep an editable copy");
  expect(panel).not.toContain("editable project saved locally");
  expect(toolbar).toContain('label: "Save project as JSON"');
  expect(toolbar).toContain("saveProjectFile(useScene.getState().project)");
 });
 it("exposes both precise drilling methods and rejects unsafe target geometry",()=>{
  expect(panel).toContain("Add positioned hole grid to selected model");
  expect(panel).toContain("Add exact coordinate holes to selected model");
  expect(jig).toContain("plainDrillTarget(project,id)");
  expect(jig).toContain("parseJigHolePositions");
 });
 it("retains the real STEP export action and existing bridge URL",()=>{
  expect(toolbar).toContain("onExportStep");
  expect(toolbar).toContain('stepBridgePort(location.port)+"/export-step"');
 });
});