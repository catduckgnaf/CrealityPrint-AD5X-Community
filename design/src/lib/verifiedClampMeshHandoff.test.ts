// @vitest-environment jsdom
import {beforeEach,afterEach,describe,it,expect,vi} from "vitest";
import type {Project,ShapeNode,GroupNode} from "../types/scene";
const mocks=vi.hoisted(()=>({serialize:vi.fn()}));
vi.mock("./exportStl",()=>({serializeSceneModel:mocks.serialize}));
import {sendSceneToPrepare,needsCadScrewClampMesh,cadScrewClampMesh} from "./prepareHandoff";
import {validateProject} from "./projectFile";

const pin:ShapeNode={
 id:"pin",kind:"box",params:{w:12,d:30,h:12,radius:0},role:"solid",
 color:"#b0b0b0",position:[0,0,6],rotation:[0,0,0],scale:[1,1,1],
 label:"Two-peg screw clamp movable jaw — M4 nut"
};
const group:GroupNode={
 id:"clamp",type:"group",label:"Two-peg indexed M4 screw clamp",childIds:["pin"],
 position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]
};
const project:Project={id:"test",name:"Clamp",version:1,rootOrder:["clamp"],nodes:{pin,clamp:group}};
const ticket="a".repeat(32)+".stl";
let native:{postMessage:ReturnType<typeof vi.fn>};
let calls:string[]=[];
function createStub(cadOk=true){
 vi.stubGlobal("fetch",vi.fn(async(url:string,options?:RequestInit)=>{
  calls.push(url);
  if(url==="/ad5x-handoff/cad-stl"){
   expect(options?.method).toBe("POST");
   expect(options?.headers).toEqual({"Content-Type":"application/json","X-AD5X-CAD":"1"});
   expect((JSON.parse(String(options?.body)) as Project).rootOrder).toEqual(["clamp"]);
   if(!cadOk)return new Response(JSON.stringify({error:"STEP invalid"}),{status:422});
   return new Response(new Uint8Array(134),{status:200,
     headers:{"X-AD5X-CAD-VERIFIED":"1","Content-Type":"application/octet-stream"}});
  }
  if(url==="/ad5x-handoff/status")return new Response(
    JSON.stringify({ok:true,bridge:"AD5X Design local STL handoff"}),{status:200});
  if(url==="/ad5x-handoff/stl"){
   expect(Number((options?.body as Blob)?.size)).toBe(134);
   return new Response(JSON.stringify({ok:true,ticket,bytes:134}),{status:201});
  }
  throw new Error("unexpected route "+url);
 }));
}
beforeEach(()=>{
 calls=[];native={postMessage:vi.fn()};
 Object.defineProperty(window,"wx",{value:native,writable:true,configurable:true});
 mocks.serialize.mockReset();createStub();
});
afterEach(()=>{vi.unstubAllGlobals();delete (window as Window&{wx?:unknown}).wx});
describe("CAD validated clamp: one shared fix for STL download and native transfer",()=>{
 it("retains safe CAD export when users rename the clamp, save and reopen the project",()=>{
  const renamed:Project={...project,nodes:{
   ...project.nodes,
   pin:{...pin,label:"My new adjustable jaw",feature:"indexed-m4-clamp"},
   clamp:{...group,label:"Workshop project"}
  }};
  const reopened=validateProject(JSON.parse(JSON.stringify(renamed)));
  expect(reopened.nodes.pin.feature).toBe("indexed-m4-clamp");
  expect(needsCadScrewClampMesh(reopened)).toBe(true);
  expect(needsCadScrewClampMesh({...reopened,rootOrder:[]})).toBe(false);
  expect(needsCadScrewClampMesh({...reopened,nodes:{...reopened.nodes,pin:{...pin,label:"Unrelated item"}}})).toBe(false);
 });
 it("only selects the special clamp for verified CAD meshing, and leaves unrelated projects alone",()=>{
  expect(needsCadScrewClampMesh(project)).toBe(true);
  expect(needsCadScrewClampMesh({...project,rootOrder:[]})).toBe(false);
  expect(needsCadScrewClampMesh({...project,rootOrder:["clamp"]},["other"])).toBe(false);
 });
 it("routes clamp through CAD backend, then the established single STL ticket and native ACK",async()=>{
  const pending=sendSceneToPrepare(project);
  await vi.waitFor(()=>expect(native.postMessage).toHaveBeenCalledWith("AD5X_PREPARE:"+ticket));
  expect(calls).toEqual(["/ad5x-handoff/cad-stl","/ad5x-handoff/status","/ad5x-handoff/stl"]);
  expect(mocks.serialize).not.toHaveBeenCalled();
  window.dispatchEvent(new CustomEvent("ad5x-prepare-result",{detail:{ticket,ok:true}}));
  expect(await pending).toEqual({ticket,count:1,skippedHoles:0,bytes:134});
 });
 it("fails closed on CAD errors, without staging an STL or importing corrupt triangles",async()=>{
  createStub(false);
  await expect(sendSceneToPrepare(project)).rejects.toThrow("STEP invalid");
  expect(calls).toEqual(["/ad5x-handoff/cad-stl"]);
  expect(native.postMessage).not.toHaveBeenCalled();
 });
 it("manual STL export can request the same validated CAD blob without native window bridge",async()=>{
  delete (window as Window&{wx?:unknown}).wx;
  const mesh=await cadScrewClampMesh(project);
  expect(mesh.blob.size).toBe(134);
  expect(mesh.exported).toBe(1);
  expect(calls).toEqual(["/ad5x-handoff/cad-stl"]);
 });
});
