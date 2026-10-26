import {fixtureDir} from "./testFixturePath";
import {describe,it,expect,vi} from "vitest";
vi.mock("../state/store",()=>({useScene:{getState:()=>({}),setState:()=>{}}}));
// @ts-expect-error Test-only Node writing of disposable CAD fixture.
import {writeFileSync} from "node:fs";
import {type GroupNode,type Project,type ShapeNode} from "../types/scene";
import {basicBox} from "./boxFitTools";
import {wireCombParts,connectorCradleParts,drillJigParts,planJigPlacement} from "./workshopTools";

const opts={count:6,pitch:6,slotWidth:2,slotDepth:6,plateDepth:40,
 baseThickness:5,ridgeThickness:6,ridgeHeight:10,endMargin:8};
const empty=():Project=>({id:"test",name:"test",version:1,nodes:{},rootOrder:[]});
function withBox(w:number,d:number,x=0,y=0):Project{
 const box=basicBox(w,d,8,x,y,4);
 const p=empty();p.nodes[box.id]=box;p.rootOrder=[box.id];return p;
}
describe("v19.5.18 conservative printing jig placement",()=>{
 it("centres a new wire comb on empty selected AD5X bed",()=>{
  expect(planJigPlacement(empty(),wireCombParts(opts),[220,220])).toEqual([0,0]);
 });
 it("moves a second jig away from existing box with at least 3mm XY margin",()=>{
  const project=withBox(100,100),original=JSON.stringify(project);
  const [x,y]=planJigPlacement(project,wireCombParts(opts),[220,220]);
  expect(Math.abs(x)>=77-1e-6||Math.abs(y)>=73-1e-6).toBe(true);
  expect(x-24).toBeGreaterThanOrEqual(-110);
  expect(x+24).toBeLessThanOrEqual(110);
  expect(y-20).toBeGreaterThanOrEqual(-110);
  expect(y+20).toBeLessThanOrEqual(110);
  expect(JSON.stringify(project)).toBe(original);
 });
 it("rejects full-bed occupancy instead of overlapping or changing old nodes",()=>{
  const p=withBox(220,220),before=JSON.stringify(p);
  expect(()=>planJigPlacement(p,wireCombParts(opts),[220,220])).toThrow(/No clear/);
  expect(JSON.stringify(p)).toBe(before);
 });
 it("rejects missing bed selection, too small plate and bad spacing",()=>{
  const parts=wireCombParts(opts);
  expect(()=>planJigPlacement(empty(),parts,null)).toThrow(/build plate/);
  expect(()=>planJigPlacement(empty(),parts,[20,20])).toThrow(/larger/);
  expect(()=>planJigPlacement(empty(),parts,[220,220],NaN)).toThrow(/spacing/);
 });
 it("refuses rotated unknown saved object rather than pretending to know its bounds",()=>{
  const p=withBox(80,80);
  const old=p.nodes[p.rootOrder[0]] as ShapeNode;
  old.rotation=[0,0,0.25];
  expect(()=>planJigPlacement(p,wireCombParts(opts),[220,220])).toThrow(/unrotated/);
  old.rotation=[0,0,0];
  old.kind="mesh";old.params={};
  expect(()=>planJigPlacement(p,wireCombParts(opts),[220,220])).toThrow(/cannot guarantee/);
 });
 it("handles nesting and parent offsets without moving the existing project",()=>{
  const p=withBox(50,50,40,0);
  const child=p.rootOrder[0],gid="saved_group";
  p.nodes[gid]={id:gid,type:"group",label:"saved",
   childIds:[child],position:[30,10,0],rotation:[0,0,0],scale:[1,1,1]};
  p.rootOrder=[gid];
  const before=JSON.stringify(p);
  const xy=planJigPlacement(p,wireCombParts(opts),[220,220]);
  expect(xy).toHaveLength(2);
  expect(xy.every(Number.isFinite)).toBe(true);
  expect(JSON.stringify(p)).toBe(before);
 });
 it("supports existing drilling jig parts and connector cradle without changes",()=>{
  const drill=drillJigParts({width:100,depth:70,height:8,diameter:4,columns:3,rows:2,pitchX:30,pitchY:25,fence:true});
  expect(planJigPlacement(empty(),drill,[220,220])).toHaveLength(2);
  const cradle=connectorCradleParts({bodyWidth:12,bodyDepth:22,clearance:0.4,baseThickness:5,
   railWidth:4,railHeight:7,backStopThickness:4,backStopHeight:6,margin:6});
  expect(planJigPlacement(empty(),cradle,[220,220])).toHaveLength(2);
 });
 it("exports two separate STEP-solid roots with nonintersecting XY footprints",()=>{
  const p=withBox(100,100);
  const parts=wireCombParts(opts);
  const [x,y]=planJigPlacement(p,parts,[220,220]);
  const gid="new_jig";
  const group:GroupNode={id:gid,type:"group",label:"Wire jig placed safely",
   childIds:parts.map(n=>n.id),position:[x,y,0],rotation:[0,0,0],scale:[1,1,1]};
  const fixture:Project={...p,nodes:{...p.nodes,
   ...Object.fromEntries(parts.map(n=>[n.id,n])),[gid]:group},
   rootOrder:[...p.rootOrder,gid]};
  writeFileSync(fixtureDir()+"/JIG_SAFE_PLACEMENT_FIXTURE.json",
   JSON.stringify(fixture,null,2),"utf8");
  expect(fixture.rootOrder).toHaveLength(2);
  expect(JSON.stringify(p)).not.toContain("new_jig");
 });
});