import {describe,it,expect} from "vitest";
import workshop from "../components/WorkshopTools.tsx?raw";
import workshopPlugin from "../extensions/workshop-plugins/electronics.plugin.ts?raw";
import {WORKSHOP_JOBS,WORKSHOP_SECTIONS} from "./workshopRouting";
// @ts-ignore Node-only read for Vitest raw source assertion.
import {readFileSync} from "node:fs";
// @ts-ignore Node-only path for Vitest.
import {resolve} from "node:path";
declare const process:{cwd():string};
const css=readFileSync(resolve(process.cwd(),"src/advanced-tools.css"),"utf8");
describe("v19.5.29 simplified integrated workshop navigation",()=>{
 it("provides seven familiar selectable electronics and drilling jobs",()=>{
  for(const label of ["Drilling template","PCB holder","Connector panel","Pogo-pin guide","Wire comb","Connector cradle","Adjustable clamp"])
   expect(WORKSHOP_JOBS.map(job=>job.label)).toContain(label);
  expect(WORKSHOP_SECTIONS.map(section=>section.id)).toEqual(["Tray","Enclosure","Jigs","Organizer"]);
  expect(workshop).toContain("WORKSHOP_JOBS.map");
  expect(workshop).toContain('aria-label="Choose a jig"');
  expect(workshop).toContain("aria-pressed={jigKind===kind}");
  expect(workshop).toContain('setJigKind(kind);setError("");setFeedback("");');
 });
 it("hides precision controls unless user opens Advanced, without deleting them",()=>{
  expect(workshop).toContain("<details key={jigKind} className=");
  expect(workshop).toContain("Advanced — thickness & exact hole positioning");
  expect(workshop).toContain("Advanced — rails, base & mounting holes");
  expect(workshop).toContain("Add exact coordinate holes to selected model");
  expect(workshop).toContain("Add positioned hole grid to selected model");
  expect(workshop).toContain("parseJigHolePositions(values.jigPositions)");
  expect(workshopPlugin).toContain("connectorMeasuredPanelParts");
  expect(workshopPlugin).toContain("pogoMeasuredGuideParts");
 });
 it("keeps create actions separate for each shape and a clear user workflow",()=>{
  for(const action of ["Create new drilling jig","Create PCB edge holder","Create connector mounting panel",
   "Create pogo-pin guide plate","Create open wire comb","Create connector soldering cradle","Create M4 screw clamp (test)"])
   expect(workshop).toContain(action);
  expect(workshop).toContain('tab==="Organizer"');
  expect(workshop).toContain("Create removable inserts");
  expect(workshop).toContain("Open existing matching lid tools");
 });
 it("keeps all four categories focused and resets stale errors when inputs change",()=>{
  expect(workshop).toContain("ad5x-workshop-simple");
  expect(workshop).toContain("More options — wall, floor & dividers");
  expect(workshop).toContain("Advanced — fit, walls & plate spacing");
  expect(workshop).toContain("Advanced — pilot bore diameter");
  expect(workshop).toContain('trayW:"80",trayD:"60"');
  expect(workshop).toContain('setError("");setFeedback("");');
  expect(workshop).toContain('role="alert"');
  expect(workshop).toContain(">Dismiss</button>");
 });
 it("uses scoped styling without breaking non-workshop Advanced tools",()=>{
  expect(css).toContain(".ad5x-workshop-simple");
  expect(css).toContain(".ad5x-simple-tool-grid");
  expect(css).toContain('[aria-pressed="true"]');
  expect(css).toContain("grid-template-columns:repeat(2,minmax(0,1fr))");
 });
});