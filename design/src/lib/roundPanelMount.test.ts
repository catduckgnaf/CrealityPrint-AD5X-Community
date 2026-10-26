import {fixtureDir} from "./testFixturePath";
import {describe,it,expect,vi} from "vitest";
vi.mock("../state/store",()=>({useScene:{getState:()=>({}),setState:()=>{}}}));
// @ts-expect-error Node/Vitest-only file output, not bundled for browser.
import {writeFileSync} from "node:fs";
import {shellParts} from "./advancedModels";
import {identifyShell} from "./boxFitTools";
import {
 roundConnector,ROUND_PANEL_MODELS,roundMountIssues,roundMountParts,planRoundPanelMount,
 type RoundMountOptions,type RoundConnectorId
} from "./roundPanelMount";
import type {GroupNode,Project} from "../types/scene";
import editor from "../components/RoundPanelMountEditor.tsx?raw";
import workshop from "../components/WorkshopTools.tsx?raw";
const fixtures=fixtureDir();
function box():Project{
 const parts=shellParts(80,60,22,2,2);
 const root:GroupNode={id:"shell",type:"group",label:"Hollow box",
  childIds:parts.map(n=>n.id),position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]};
 return {id:"panel",version:1,name:"Round product-specific connectors",
  nodes:{...Object.fromEntries(parts.map(n=>[n.id,n])),shell:root},rootOrder:["shell"]};
}
function opt(id:RoundConnectorId,face:"front"|"floor"|"right"="floor"):RoundMountOptions{
 return {id,face,offsetX:0,offsetY:0,radialClearance:.2};
}
describe("v19.5.35 real product-specification panel cuts",()=>{
 it("distinguishes nominal 4mm electrical contact from Type B socket's 12.2mm mounting hole",()=>{
  const model=roundConnector("banana-type-b-socket");
  expect(model.cutoutDiameter).toBe(12.2);
  expect(model.description).toContain("NOT the 4 mm electrical contact");
  expect(model.source).toBe("https://www.robotics.org.za/connectors/banana-jacks/BAN-STB-GRN");
  expect(ROUND_PANEL_MODELS.every(x=>x.documentStatus==="VENDOR_PRODUCT_CUTOUT")).toBe(true);
 });
 it("uses 22mm round hole ONLY for the exact XT60-PAN-03 adapter",()=>{
  const model=roundConnector("xt60-panel-03");
  expect(model.cutoutDiameter).toBe(22);
  expect(model.source).toBe("https://www.robotics.org.za/connectors/panel-mount-connectors/XT60-PAN-03");
  expect(model.description).toContain("NOT loose XT60 plugs");
  expect(()=>roundConnector("unknown" as RoundConnectorId)).toThrow(/Unknown/);
 });
 it("keeps cut nominal diameter and added radial clearance distinct",()=>{
  const pr=box();
  for(const [id,diameter] of [
   ["banana-type-b-socket",12.2],["xt60-panel-03",22]
  ] as const){
   const cutter=roundMountParts(pr,"shell",opt(id));
   expect(cutter).toHaveLength(1);
   expect(cutter[0].role).toBe("hole");
   expect(cutter[0].kind).toBe("cylinder");
   expect(cutter[0].params.r).toBeCloseTo((diameter+.4)/2,7);
  }
 });
 it("adds only a hole to the existing hollow box, not a separate printed part",()=>{
  const pr=box();
  for(const id of ["banana-type-b-socket","xt60-panel-03"] as const){
   const plan=planRoundPanelMount(pr,"shell",opt(id));
   expect(plan.project.rootOrder).toHaveLength(1);
   expect(plan.cutters).toHaveLength(1);
   expect(Object.keys(plan.project.nodes)).toEqual(expect.arrayContaining(Object.keys(pr.nodes)));
   const n=plan.project.nodes[plan.project.rootOrder[0]];
   expect("type" in n && n.type==="group").toBe(true);
   expect(n.label).toContain("Box with");
  }
 });
 it("properly targets every wall and the inside floor",()=>{
  const pr=box();
  expect(roundMountParts(pr,"shell",opt("banana-type-b-socket","front"))[0].position).toEqual([0,-29,12]);
  expect(roundMountParts(pr,"shell",opt("banana-type-b-socket","right"))[0].position).toEqual([39,0,12]);
  expect(roundMountParts(pr,"shell",opt("xt60-panel-03","floor"))[0].position).toEqual([0,0,1]);
  expect(roundMountParts(pr,"shell",opt("banana-type-b-socket","front"))[0].rotation).toEqual([Math.PI/2,0,0]);
  expect(roundMountParts(pr,"shell",opt("xt60-panel-03","floor"))[0].rotation).toEqual([0,0,0]);
 });
 it("rejects XT60 on a short wall, wrong positions and invalid clearance",()=>{
  const pr=box(),sh=identifyShell("shell",pr);
  expect(roundMountIssues(sh,opt("banana-type-b-socket","front"))).toEqual([]);
  expect(roundMountIssues(sh,opt("xt60-panel-03","front")).join(" ")).toMatch(/does not fit/);
  expect(roundMountIssues(sh,opt("xt60-panel-03","floor"))).toEqual([]);
  expect(roundMountIssues(sh,{...opt("xt60-panel-03"),offsetX:30}).join(" ")).toMatch(/does not fit/);
  expect(roundMountIssues(sh,{...opt("xt60-panel-03"),radialClearance:-.1}).join(" ")).toMatch(/0 and 1/);
  expect(()=>roundMountParts(pr,"shell",opt("xt60-panel-03","front"))).toThrow(/does not fit/);
  expect(roundMountIssues(sh,{...opt("banana-type-b-socket"),offsetX:NaN}).join(" ")).toMatch(/valid/);
 });
 it("makes source-labelled editable fixtures for native STEP verification",()=>{
  for(const [id,face,name] of [
   ["banana-type-b-socket","front","SHOP_BANANA_TYPE_B_FRONT"],
   ["banana-type-b-socket","floor","SHOP_BANANA_TYPE_B_FLOOR"],
   ["xt60-panel-03","floor","SHOP_XT60_PANEL_03_FLOOR"],
  ] as const){
   const pr=box(),plan=planRoundPanelMount(pr,"shell",opt(id,face));
   writeFileSync(fixtures+"/"+name+".json",JSON.stringify(plan.project,null,2),"utf8");
   expect(plan.project.rootOrder).toHaveLength(1);
  }
 });
 it("exposes an actual native add button for each model, not unclickable options",()=>{
  expect(workshop).toContain('<RoundPanelMountEditor');
  expect(workshop).toContain('applyRoundPanelMount(target.id,options)');
  expect(workshop).toContain('value="banana-type-b-socket"');
  expect(workshop).toContain('value="xt60-panel-03"');
  expect(editor).toContain('disabled={!valid}');
  expect(editor).toContain('onCreate(opts)');
  expect(editor).toContain('role="alert"');
  expect(editor).toContain('aria-label="Circular connector box surface"');
 });
});

