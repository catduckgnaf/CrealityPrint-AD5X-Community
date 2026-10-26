import {describe,it,expect,vi} from "vitest";
// @ts-ignore Node built-in is available to Vitest; browser app never imports this test.
import {writeFileSync} from "node:fs";
vi.mock("../state/store",()=>({useScene:{getState:()=>({}),setState:()=>{}}}));
import {drillJigParts,type DrillGrid} from "./workshopTools";
import type {GroupNode,Project} from "../types/scene";
const baseline:DrillGrid={width:100,depth:70,height:8,diameter:4,columns:3,rows:2,pitchX:30,pitchY:25,fence:true};
const bores=(o:DrillGrid)=>drillJigParts(o).filter(p=>p.role==="hole");
describe("v19.5.19 drilling-template offsets and exact clearance",()=>{
 it("preserves centred v19.5.18 positions and two fused solids",()=>{
  const parts=drillJigParts(baseline);
  expect(parts.filter(p=>p.role==="solid")).toHaveLength(2);
  expect(bores(baseline).map(p=>p.position.slice(0,2))).toEqual([
   [-30,-15.5],[-30,9.5],[0,-15.5],[0,9.5],[30,-15.5],[30,9.5]]);
 });
 it("positions editable through-cutters by exact signed X/Y offsets",()=>{
  const p=drillJigParts({...baseline,offsetX:6,offsetY:-4});
  expect(p.filter(n=>n.role==="hole").map(n=>n.position.slice(0,2))).toEqual([
   [-24,-19.5],[-24,5.5],[6,-19.5],[6,5.5],[36,-19.5],[36,5.5]]);
  expect(p.filter(n=>n.role==="hole").every(n=>n.params.h===10&&n.position[2]===4)).toBe(true);
 });
 it("accepts exact 4 mm plate-edge clearance and rejects 0.001 mm violation",()=>{
  const o={...baseline,fence:false,columns:1,rows:1};
  expect(bores({...o,offsetX:44,offsetY:29})).toHaveLength(1);
  expect(()=>bores({...o,offsetX:44.001})).toThrow(/clearance/);
  expect(()=>bores({...o,offsetY:-29.001})).toThrow(/clearance/);
 });
 it("preserves original fence clearance and rejects rear/front intrusion",()=>{
  const o={...baseline,columns:1,rows:1};
  expect(bores({...o,offsetY:26})).toHaveLength(1);
  expect(bores({...o,offsetY:-26})).toHaveLength(1);
  expect(()=>bores({...o,offsetY:26.001})).toThrow(/fence clearance/);
  expect(()=>bores({...o,offsetY:-26.001})).toThrow(/clearance/);
 });
 it("rejects non-finite offsets and overlapping or oversized grids",()=>{
  expect(()=>bores({...baseline,offsetX:NaN})).toThrow(/finite/);
  expect(()=>bores({...baseline,offsetY:Infinity})).toThrow(/finite/);
  expect(()=>bores({...baseline,pitchX:5})).toThrow(/pitch/);
  expect(()=>bores({...baseline,offsetX:25})).toThrow(/clearance/);
 });
 it("writes a full editable group fixture only to the explicitly designated test output",()=>{
  const parts=drillJigParts({...baseline,offsetX:6,offsetY:-4});
  const g:GroupNode={id:"root",type:"group",label:"Drilling jig - offset test",
   childIds:parts.map(n=>n.id),position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]};
  const project:Project={id:"fixture",name:"Drill offset STEP regression",version:1,
   rootOrder:[g.id],nodes:{[g.id]:g,...Object.fromEntries(parts.map(n=>[n.id,n]))}};
  const decoded=JSON.parse(JSON.stringify(project)) as Project;
  expect(decoded.rootOrder).toEqual(["root"]);
  expect((decoded.nodes.root as GroupNode).childIds).toHaveLength(8);
  expect(Object.values(decoded.nodes).filter(n=>!("type" in n)&&n.role==="hole")).toHaveLength(6);
  // @ts-ignore This test-only fixture output is opt-in via the Node test environment.
  if(process.env.AD5X_DRILL_FIXTURE_OUT)writeFileSync(process.env.AD5X_DRILL_FIXTURE_OUT,JSON.stringify(project,null,2),"utf8");
 });
});
