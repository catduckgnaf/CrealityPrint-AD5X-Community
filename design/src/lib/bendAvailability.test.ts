import {describe,it,expect,vi} from "vitest";
vi.mock("../state/store",()=>({useScene:{getState:vi.fn(),setState:vi.fn()}}));
import {makeShape} from "./primitives";
import {bendUnavailableReason} from "./liveBendState";
import type {GroupNode,Project} from "../types/scene";
import ribbon from "../components/Toolbar.tsx?raw";
import panel from "../components/LiveBendControls.tsx?raw";

const project=():Project=>({id:"test",name:"test",version:1,rootOrder:[],nodes:{}});
describe("v19.3.4 quiet, context-aware Live Bend",()=>{
 it("treats a hollow shell group as unsupported without implying the part is damaged",()=>{
  const p=project();
  const g:GroupNode={id:"shell",type:"group",label:"Hollow box",childIds:[],
   position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]};
  p.nodes[g.id]=g;p.rootOrder=[g.id];
  expect(bendUnavailableReason(g.id,p)).toContain("hollow boxes and lids");
 });
 it("accepts an ordinary unlocked, sharp solid box and rejects locked, rotated and rounded boxes",()=>{
  const p=project(),box=makeShape("box");
  box.params={w:100,d:12,h:6};
  p.nodes[box.id]=box;p.rootOrder=[box.id];
  expect(bendUnavailableReason(box.id,p)).toBeNull();
  p.nodes[box.id]={...box,locked:true};
  expect(bendUnavailableReason(box.id,p)).not.toBeNull();
  p.nodes[box.id]={...box,rotation:[0,0,0.1]};
  expect(bendUnavailableReason(box.id,p)).not.toBeNull();
  p.nodes[box.id]={...box,params:{...box.params,edges:"8@2"}};
  expect(bendUnavailableReason(box.id,p)).not.toBeNull();
 });
 it("requires exactly one supported selection, rather than displaying a permanent popup",()=>{
  const p=project();
  expect(bendUnavailableReason(null,p)).toContain("Select one");
  expect(ribbon).toContain("disabled={bendReason!==null}");
  expect(ribbon).toContain("bendUnavailableReason");
  expect(panel).toContain('window.setTimeout(()=>setWarning(""),3500)');
  expect(panel).toContain("useEffect(()=>{setWarning(\"\");},[selection])");
  expect(panel).toContain("Dismiss bend message");
 });
});
