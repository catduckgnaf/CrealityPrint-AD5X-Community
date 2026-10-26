import {describe,it,expect,vi} from "vitest";
vi.mock("../state/store",()=>({useScene:{getState:()=>({}),setState:()=>{}}}));
vi.mock("../lib/sceneApi",()=>({sceneApi:{}}));
import menu from "../components/SmartContextMenu.tsx?raw";
import workshop from "../components/WorkshopTools.tsx?raw";
import banana from "../components/BananaPlugEditor.tsx?raw";
import {bananaBoxHoleIssues} from "./workshopTools";
import {shellParts} from "./advancedModels";
import {identifyShell} from "./boxFitTools";
import type {GroupNode,Project} from "../types/scene";
describe("v19.5.33 connector-type menu without misleading DB9 cutouts",()=>{
 it("replaces the multi-level cascades with one connector Hover Shelf",()=>{
  expect(menu).toContain('id:"connectors",label:"Connectors & holes"');
  expect(menu).not.toContain('data-connector-trigger="true"');
  expect(menu).toContain('label="DB9 male"');
  expect(menu).toContain('label="DB9 female"');
  expect(menu).toContain('label="Banana socket Type B (12.2 mm cutout)"');
  expect(menu).not.toContain('label="Add banana-plug holes..."');
  expect(menu).not.toContain('label="Banana-plug holes..."');
  expect(menu).toContain('openWorkshopRoute({tab:"Jigs",connectorChooser:true,connectorType,bananaPreset,rootId:bananaBoxRootId})');
 });
 it("exposes the existing connector actions on any selected editable solid",()=>{
  expect(menu).toContain("editableModelRoot(project,ids)");
  expect(menu).toContain("if(bananaBoxRootId || canHoles || legacyDB9)");
  expect(menu).toContain("if(bananaBoxRootId || canHoles || legacyDB9)");
  expect(menu).toContain("setSelection([bananaBoxRootId])");
  expect(menu).toContain("close();");
 });
 it("opens an actual connector type dropdown within existing Workshop Tools",()=>{
  expect(workshop).toContain('aria-label="Connector type"');
  expect(workshop).toContain('<option value="banana">Banana plugs');
  expect(workshop).toContain('<option value="db9-male">DB9 male');
  expect(workshop).toContain('<option value="db9-female">DB9 female');
  expect(menu).toContain('connectorChooser:true');
  expect(workshop).toContain('setConnectorChooser(detail?.connectorChooser===true)');
  expect(workshop).toContain('Back to all jigs & fixtures');
 });
 it("keeps banana plug cut geometry editable in existing box without separate holder plate",()=>{
  expect(workshop).toContain("applyBananaBoxHoles(target.id,options)");
  expect(workshop).not.toContain('createElectronicsJig("Banana-plug assembly holder"');
  expect(banana).toContain('Add banana-plug holes to {targetName}');
  const parts=shellParts(80,60,22,2,2),root:GroupNode={
   id:"box",type:"group",label:"Box",childIds:parts.map(n=>n.id),
   position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]};
  const project:Project={id:"p",name:"Test",version:1,rootOrder:["box"],
   nodes:{...Object.fromEntries(parts.map(n=>[n.id,n])),box:root}};
  const shell=identifyShell("box",project);
  expect(bananaBoxHoleIssues(shell,{face:"front",diameter:4,points:[[-15,0],[15,0]]})).toEqual([]);
 });
 it("opens the real DB9 connector cutter instead of a disabled placeholder",()=>{
  expect(workshop).toContain('<DB9BoxMountEditor');
  expect(workshop).toContain('applyDB9BoxMount(target.id,options)');
  expect(workshop).not.toContain('automatic cutting is disabled');
 });
});