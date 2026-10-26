import {describe,it,expect,vi} from "vitest";
vi.mock("../state/store",()=>({useScene:{getState:()=>({}),setState:()=>{}}}));
// @ts-expect-error Node-only test fixture writer, not browser code.
import {writeFileSync} from "node:fs";
import {shellParts} from "./advancedModels";
import {planOrganizerInserts,type OrganizerOptions} from "./organizerInserts";
import type {GroupNode,Project,ShapeNode} from "../types/scene";
declare const process:{env:Record<string,string|undefined>};
describe("v19.5.25 cumulative organizer save/reopen",()=>{
 it("retains four independent editable hollow bins after JSON round-trip",()=>{
  const parts=shellParts(80,60,30,2,3);
  const id="organizer-shell";
  const group:GroupNode={id,type:"group",label:"Hollow box",childIds:parts.map(p=>p.id),position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]};
  const project:Project={id:"cumulative-organizer",name:"Organizer regression",version:1,rootOrder:[id],nodes:{...Object.fromEntries(parts.map(p=>[p.id,p])),[id]:group}};
  const options:OrganizerOptions={cols:2,rows:2,gap:.35,wall:1.6,floor:1.6,topGap:1,bedGap:6,mode:"full",col:1,row:1,spanCols:2,spanRows:1};
  const plan=planOrganizerInserts(project,id,[220,220],options);
  expect(plan.bins).toHaveLength(4);
  for(const bin of plan.bins){
   project.nodes[bin.group.id]=bin.group;
   project.nodes[bin.outside.id]=bin.outside;
   project.nodes[bin.inside.id]=bin.inside;
   project.rootOrder.push(bin.group.id);
  }
  const encoded=JSON.stringify(project);
  const restored=JSON.parse(encoded) as Project;
  expect(restored.rootOrder).toHaveLength(5);
  expect(restored.nodes[id]).toEqual(group);
  for(const bin of plan.bins){
   const saved=restored.nodes[bin.group.id] as GroupNode;
   expect(saved.childIds).toEqual([bin.outside.id,bin.inside.id]);
   expect((restored.nodes[bin.outside.id] as ShapeNode).role).toBe("solid");
   expect((restored.nodes[bin.inside.id] as ShapeNode).role).toBe("hole");
  }
  if(process.env.AD5X_CUMULATIVE_ORGANIZER_OUT)writeFileSync(process.env.AD5X_CUMULATIVE_ORGANIZER_OUT,encoded,"utf8");
 });
});
