import {fixtureDir} from "./testFixturePath";
import {describe,it,expect,vi} from "vitest";
vi.mock("../state/store",()=>({useScene:{getState:()=>({}),setState:()=>{}}}));
import {BANANA_PLUG_PRESETS,bananaPlugPreset} from "./bananaPlugPresets";
import {bananaBoxHoleIssues,planBananaBoxHoles} from "./workshopTools";
// @ts-expect-error Vitest fixture writer runs in Node; production compiler has no Node types.
import {writeFileSync} from "node:fs";
import {shellParts} from "./advancedModels";
import {identifyShell} from "./boxFitTools";
import {type GroupNode,type Project} from "../types/scene";
import editor from "../components/BananaPlugEditor.tsx?raw";
import menu from "../components/SmartContextMenu.tsx?raw";
import workshop from "../components/WorkshopTools.tsx?raw";
import viewport from "../components/Viewport.tsx?raw";

function scene(){
 const parts=shellParts(80,60,22,2,2);
 const root:GroupNode={id:"hollow",type:"group",label:"Hollow box",
  childIds:parts.map(n=>n.id),position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]};
 const project:Project={id:"size-check",version:1,name:"Size fixture",rootOrder:[root.id],
  nodes:{...Object.fromEntries(parts.map(n=>[n.id,n])),[root.id]:root}};
 return {project,sh:identifyShell(root.id,project)};
}

describe("v19.5.32 manufacturer-grounded banana plug sizing",()=>{
 it("lists actual nominal 2, 3, 4 and 4.5 mm metal contacts separately from bodies",()=>{
  for(const [id,diameter] of [
   ["mini2-contact",2],["mini3-contact",3],["standard4-contact",4],["us45-contact",4.5]
  ] as const){
   const p=bananaPlugPreset(id);
   expect(p.measuredPart).toBe("metal contact");
   expect(p.holeDiameterMm).toBe(diameter);
   expect(p.sourceUrl).toMatch(/^https:\/\//);
  }
 });
 it("does not infer housing size from 4mm pin; unknown body types need an explicit user measurement",()=>{
  for(const id of ["insulated4-body","shrouded4-body","stackable4-body","custom"] as const){
   expect(bananaPlugPreset(id).holeDiameterMm).toBeNull();
  }
 });
 it("documents model-specific measured body diameters rather than inventing universal housings",()=>{
  expect(bananaPlugPreset("npa-k6081-body").holeDiameterMm).toBe(9.5);
  expect(bananaPlugPreset("radiall-r941330-body").holeDiameterMm).toBe(10);
  expect(bananaPlugPreset("npa-k6081-body").measuredPart).toBe("insulated body");
  expect(BANANA_PLUG_PRESETS.map(p=>p.id).length).toBe(10);
  expect(BANANA_PLUG_PRESETS.every(p=>p.note.trim().length>5)).toBe(true);
 });
 it("uses chosen diameter to validate actual box holes without changing cutter geometry",()=>{
  const {sh}=scene();
  const pts:[number,number][]=[[-15,0],[15,0]];
  expect(bananaBoxHoleIssues(sh,{face:"front",diameter:bananaPlugPreset("standard4-contact").holeDiameterMm!,points:pts})).toEqual([]);
  expect(bananaBoxHoleIssues(sh,{face:"front",diameter:bananaPlugPreset("radiall-r941330-body").holeDiameterMm!,points:pts})).toEqual([]);
  expect(bananaBoxHoleIssues(sh,{face:"front",diameter:NaN,points:pts}).join(" ")).toMatch(/Measure the banana plug/);
  expect(bananaBoxHoleIssues(sh,{face:"front",diameter:10,points:[[0,0],[11,0]]}).join(" ")).toMatch(/too close/);
 });
 it("writes 4mm contact and 9.5mm model-specific body fixtures with ONE existing hollow box",()=>{
  const {project}=scene();
  for(const [id,filename] of [
   ["standard4-contact","BANANA_STANDARD4_ON_BOX.json"],
   ["npa-k6081-body","BANANA_NPA_9_5_ON_BOX.json"],
  ] as const){
   const dia=bananaPlugPreset(id).holeDiameterMm!;
   const plan=planBananaBoxHoles(project,"hollow",{face:"front",diameter:dia,points:[[-15,0],[15,0]]});
   expect(plan.project.rootOrder).toHaveLength(1);
   expect(plan.cutters).toHaveLength(2);
   writeFileSync(fixtureDir()+"/"+filename,
    JSON.stringify(plan.project,null,2),"utf8");
  }
 }); it("offers a clearly labeled plug-size dropdown with custom entry for unverified diameter",()=>{
  expect(editor).toContain('aria-label="Banana plug size / type"');
  expect(editor).toContain('aria-label="Custom banana hole diameter (mm)"');
  expect(editor).toContain('value={presetId}');
  expect(editor).toContain('setDiameter(choice.holeDiameterMm===null?customDiameter:choice.holeDiameterMm)');
  expect(editor).toContain('Need a different fit? Choose Custom measured diameter');
  expect(editor).toContain('disabled={!valid}');
  expect(editor).toContain('onCreate(options)');
 });
 it("keeps the existing contextual banana holes menu available on every editable solid",()=>{
  expect(menu).toContain("editableModelRoot(project,ids)");
  expect(menu).toContain('id:"connectors",label:"Connectors & holes"');
  expect(menu).toContain('if(bananaBoxRootId || canHoles || legacyDB9)');
  expect(menu).toContain('label="Banana plug 2 mm"');
  expect(menu).toContain('setSelection([bananaBoxRootId])');
  expect(menu).toContain('openWorkshopRoute({tab:"Jigs",connectorChooser:true,connectorType,bananaPreset,rootId:bananaBoxRootId})');
  expect(menu).toContain("close();");
  expect(viewport).toContain("onContextMenu={(e)=>");
  expect(workshop).toContain('applyBananaBoxHoles(target.id,options)');
  expect(workshop).not.toContain('createElectronicsJig("Banana-plug assembly holder"');
 });
});
