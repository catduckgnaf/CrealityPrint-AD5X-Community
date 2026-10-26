import {describe,it,expect,vi} from "vitest";
vi.mock("../state/store",()=>({useScene:{getState:vi.fn(),setState:vi.fn()}}));
// @ts-expect-error Node is available only in Vitest, production omits node types.
import {writeFileSync} from "node:fs";
// @ts-expect-error Node is available only in Vitest, production omits node types.
import {resolve} from "node:path";
import {shellParts} from "./advancedModels";
import {lidParts,identifyShell,type LidOptions} from "./boxFitTools";
import {planHingedLid,DEFAULT_HINGE_OPTIONS} from "./hingedLid";
import type {GroupNode,Project,ShapeNode} from "../types/scene";

const group=(id:string,children:ShapeNode[]):GroupNode=>({
 id,type:"group",label:id,childIds:children.map(n=>n.id),
 position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],
});
describe("repaired box and lid export acceptance fixture",()=>{
 it("captures repaired 3-knuckle hinge as a real editable STEP-export project",()=>{
  const a=shellParts(80,60,22,2,2),box=group("box",a);
  let project:Project={id:"step-repaired-hinge",name:"Hinged-Box-STEP-20261024",version:1,
   rootOrder:["box"],nodes:{box,...Object.fromEntries(a.map(n=>[n.id,n]))}};
  const options:LidOptions={clearance:.3,thickness:2.4,lipDepth:4,lipWall:1.5,overhang:.5,bedGap:12};
  const parts=lidParts(identifyShell("box",project),options,[220,220]);
  project={...project,nodes:{...project.nodes,lid:group("lid",parts),
   ...Object.fromEntries(parts.map(n=>[n.id,n]))},rootOrder:["box","lid"]};
  const plan=planHingedLid(project,"box","lid",DEFAULT_HINGE_OPTIONS,[220,220]);
  expect(plan.project.rootOrder).toHaveLength(2);
  const outfile=resolve("../Acceptance_Fixtures/REPAIRED_HINGE_STEP_CURRENT.json");
  writeFileSync(outfile,JSON.stringify(plan.project,null,2),"utf8");
  expect(plan.boxAdded).toHaveLength(6);
  expect(plan.lidAdded).toHaveLength(3);
 });
});