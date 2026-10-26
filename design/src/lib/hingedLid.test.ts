import {describe,it,expect,vi} from "vitest";
vi.mock("../state/store",()=>({useScene:{getState:vi.fn(),setState:vi.fn()}}));
import {shellParts} from "./advancedModels";
import {lidParts,identifyShell,type LidOptions} from "./boxFitTools";
import {isGroup,type ShapeNode,type GroupNode,type Project} from "../types/scene";
import {evaluateGroup} from "./csg";
import {
 DEFAULT_HINGE_OPTIONS,matchingLids,matchingShells,inspectLid,
 planHingedLid,hingeCandidatePairs,type HingeSide,type HingeOptions,
} from "./hingedLid";

const empty:Project={id:"fixture",name:"unit",version:1,nodes:{},rootOrder:[]};
const lidOptions:LidOptions={clearance:.3,thickness:2.4,lipDepth:4,lipWall:1.5,overhang:.5,bedGap:12};
const group=(id:string,children:ShapeNode[]):GroupNode=>({
 id,type:"group",label:id==="box"?"Hollow box":"Matching lid",
 childIds:children.map(n=>n.id),position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],
});
function fixture():{project:Project,box:string,lid:string}{
 const boxParts=shellParts(80,60,22,2,2);
 const shell=group("box",boxParts);
 let project:Project={...empty,nodes:{
  ...Object.fromEntries(boxParts.map(n=>[n.id,n])),[shell.id]:shell},rootOrder:[shell.id]};
 const info=identifyShell("box",project);
 const lidNodes=lidParts(info,lidOptions,[220,220]);
 const lidRoot=group("lid",lidNodes);
 project={...project,nodes:{...project.nodes,
  ...Object.fromEntries(lidNodes.map(n=>[n.id,n])),[lidRoot.id]:lidRoot},rootOrder:["box","lid"]};
 return {project,box:"box",lid:"lid"};
}
const hole=(p:ShapeNode)=>p.role==="hole"&&p.label?.includes("pin bore");
const solidBarrel=(p:ShapeNode)=>p.role==="solid"&&p.label?.includes("knuckle");
const pos=(n:ShapeNode,i:number)=>n.position[i];
function assembledSide(ref:Project,side:HingeSide){
 const plan=planHingedLid(ref,"box","lid",{...DEFAULT_HINGE_OPTIONS,side,offset:2});
 const boxKnuckles=plan.boxAdded.filter(solidBarrel);
 const lidKnuckles=plan.lidAdded.filter(solidBarrel);
 const axis=side==="front"||side==="back"?0:1;
 const radial=axis===0?1:0;
 const shell=identifyShell("box",ref),lid=inspectLid(ref,"lid")!;
 const sign=side==="back"||side==="right"?1:-1;
 const boxSide=(axis===0?shell.cy:shell.cx)+sign*(axis===0?shell.depth:shell.width)/2;
 const lidPrintSide=(axis===0?lid.y:lid.x)-sign*(axis===0?lid.depth:lid.width)/2;
 const boxOffset=pos(boxKnuckles[0],radial)-boxSide;
 const lidOffset=pos(lidKnuckles[0],radial)-lidPrintSide;
 // Closed lid's overhanging panel sits between the two outside barrel references.
 // The axis is the same in world space after the lid's 180 degree fold.
 const overhang=(axis===0?lid.depth-shell.depth:lid.width-shell.width)/2;
 expect(boxOffset).toBeCloseTo(-lidOffset+sign*overhang,6);
 expect(boxKnuckles).toHaveLength(2);
 expect(lidKnuckles).toHaveLength(1);
 expect(plan.boxAdded.filter(hole)).toHaveLength(2);
 expect(plan.lidAdded.filter(hole)).toHaveLength(1);
 const barrelX=boxKnuckles.map(p=>p.position[axis]).sort((a,b)=>a-b);
 const centred=pos(lidKnuckles[0],axis);
 const boxCentre=(axis===0?shell.cx:shell.cy)+2, lidCentre=(axis===0?lid.x:lid.y)+2;
 expect((barrelX[0]+barrelX[1])/2).toBeCloseTo(boxCentre,6);
 expect(centred).toBeCloseTo(lidCentre,6);
 const boxPinZ=boxKnuckles[0].position[2];
 const lidPinZ=lidKnuckles[0].position[2];
 // Print-up lid top becomes underside after flipping closed about the hinge axis.
 const closedLidUnderside=boxPinZ+(lidPinZ-(lid.panelBottom+lid.panelThickness));
 expect(closedLidUnderside).toBeCloseTo(shell.top,6);
 return plan;
}
describe("v19.5.53 real box + matching lid removable-pin hinge",()=>{
 it("matches existing print-oriented lids; does not silently pair random unrelated parts",()=>{
  const f=fixture();
  const ids=matchingLids(f.project,"box").map(c=>c.id);
  expect(ids).toEqual(["lid"]);
  expect(matchingShells(f.project,"lid")).toEqual(["box"]);
  expect(hingeCandidatePairs(f.project,"box")).toEqual({shellIds:["box"],lidIds:["lid"]});
  expect(hingeCandidatePairs(f.project,"lid")).toEqual({shellIds:["box"],lidIds:["lid"]});
  const foreign:Project={...f.project,nodes:{...f.project.nodes}};
  const root=foreign.nodes.lid as GroupNode;
  foreign.nodes.lid={...root,rotation:[.4,0,0]};
  expect(matchingLids(foreign,"box")).toHaveLength(0);
  expect(()=>planHingedLid(foreign,"box","lid",DEFAULT_HINGE_OPTIONS)).toThrow("does not match");
 });
 it.each(["back","front","left","right"] as HingeSide[])(
  "supports %s wall, keeps box and lid separate and aligns 3 knuckles in closed assembly",side=>{
  const f=fixture(),initial=JSON.stringify(f.project);
  const plan=assembledSide(f.project,side);
  expect(JSON.stringify(f.project)).toBe(initial); // immutable
  expect(plan.project.rootOrder).toHaveLength(2);
  const newBox=plan.project.nodes[plan.boxId],newLid=plan.project.nodes[plan.lidId];
  expect(isGroup(newBox)).toBe(true);expect(isGroup(newLid)).toBe(true);
  if(!isGroup(newBox)||!isGroup(newLid))throw Error("Groups lost");
  expect(newBox.childIds[0]).toBe("box");
  expect(newLid.childIds[0]).toBe("lid");
  expect(plan.boxAdded).toHaveLength(6);
  expect(plan.lidAdded).toHaveLength(3);
  expect(plan.pinHoleDiameter).toBeCloseTo(2.75);
  expect(plan.knuckleLength).toBeCloseTo((36-2*.4)/3);
  // Wrappers remain understood by the existing hollow-box and lid tools.
  expect(identifyShell(plan.boxId,plan.project).width).toBe(80);
  expect(inspectLid(plan.project,plan.lidId)?.width).toBe(81);
  });
 it("both hinge leaf groups contain positive solid webs, 3 barrels and 3 HOLE cutters aligned with their own barrels",()=>{
  const f=fixture(),p=planHingedLid(f.project,f.box,f.lid,DEFAULT_HINGE_OPTIONS);
  expect(p.boxAdded.filter(s=>s.role==="solid")).toHaveLength(4);
  expect(p.lidAdded.filter(s=>s.role==="solid")).toHaveLength(2);
  const all=[...p.boxAdded,...p.lidAdded];
  expect(new Set(all.map(x=>x.id)).size).toBe(9);
  for(let i=0;i<all.length;i++){
   if(!hole(all[i]))continue;
   const barrel=all[i-1];
   expect(solidBarrel(barrel)).toBe(true);
   expect(all[i].position).toEqual(barrel.position);
   expect(all[i].rotation).toEqual(barrel.rotation);
   expect(Number(all[i].params.h)).toBeGreaterThan(Number(barrel.params.h));
   expect(Number(all[i].params.r)).toBeLessThan(Number(barrel.params.r));
  }
 });
 it("never modifies the source box, lid, or their exact CSG children; makes two independent new root parts",()=>{
  const f=fixture(),snapshot=JSON.stringify(f.project);
  const plan=planHingedLid(f.project,f.box,f.lid,DEFAULT_HINGE_OPTIONS);
  expect(JSON.stringify(f.project)).toEqual(snapshot);
  for(const [id,node] of Object.entries(f.project.nodes)){
   expect(plan.project.nodes[id]).toEqual(node);
  }
  expect(plan.project.nodes["box"]).toBe(f.project.nodes["box"]);
  expect(plan.project.nodes["lid"]).toBe(f.project.nodes["lid"]);
  expect(plan.project.nodes[plan.boxId]).not.toBe(plan.project.nodes[plan.lidId]);
 });
 it("validates pin diameter, knuckle spacing, position and barrel wall instead of guessing print fit",()=>{
  const f=fixture();
  const bad:(Partial<HingeOptions>)[]=[
   {barrelDiameter:4,pinDiameter:5},{pinDiameter:6,boreClearance:1},
   {span:100},{span:20,offset:34},{knuckleGap:9},{boreClearance:0},
  ];
  for(const option of bad){
    expect(()=>planHingedLid(f.project,"box","lid",{...DEFAULT_HINGE_OPTIONS,...option})).toThrow();
  }
 });
 it("honours the existing active build-plate footprint; never quietly creates off-bed knuckles",()=>{
  const f=fixture();
  for(const side of ["back","front","left","right"] as HingeSide[]){
   expect(()=>planHingedLid(f.project,"box","lid",{...DEFAULT_HINGE_OPTIONS,side},[300,300])).not.toThrow();
  }
  // A safe new hinge can extend past the standard 220 mm edge if a lid was
  // already placed close to it; fail explicitly rather than slicing off knuckles.
  expect(()=>planHingedLid(f.project,"box","lid",{...DEFAULT_HINGE_OPTIONS,side:"front"},[220,220]))
    .toThrow("beyond the build plate");
  expect(()=>planHingedLid(f.project,"box","lid",DEFAULT_HINGE_OPTIONS,[80,80]))
    .toThrow("beyond the build plate");
 });
 it("prevents duplicate hinges and preserves undoable original project",()=>{
  const f=fixture(),plan=planHingedLid(f.project,"box","lid",DEFAULT_HINGE_OPTIONS);
  expect(()=>planHingedLid(plan.project,plan.boxId,plan.lidId,DEFAULT_HINGE_OPTIONS)).toThrow();
 });
 it("produces valid Boolean-edited shell and lid meshes rather than decorative overlapping shells",()=>{
  const f=fixture(),plan=planHingedLid(f.project,"box","lid",DEFAULT_HINGE_OPTIONS);
  for(const id of [plan.boxId,plan.lidId]){
   const groupNode=plan.project.nodes[id];
   expect(isGroup(groupNode)).toBe(true);
   if(!isGroup(groupNode))throw Error("Missing printable hinge group");
   const geom=evaluateGroup(groupNode,plan.project.nodes);
   expect(geom).not.toBeNull();
   const posAttr=geom!.getAttribute("position");
   expect(posAttr.count).toBeGreaterThan(30);
   geom!.computeBoundingBox();
   expect(geom!.boundingBox!.max.z).toBeGreaterThan(0);
   expect(geom!.boundingBox!.max.x).toBeGreaterThan(geom!.boundingBox!.min.x);
   geom!.dispose();
  }
 });
});