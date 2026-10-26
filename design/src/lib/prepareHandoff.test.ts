// @vitest-environment jsdom
import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import type {Project} from "../types/scene";
const mocks=vi.hoisted(()=>({
 serialize:vi.fn()
}));
vi.mock("./exportStl",()=>({serializeSceneModel:mocks.serialize}));
import {nativePrepareAvailable,sendSceneToPrepare} from "./prepareHandoff";
const project:Project={id:"unit",name:"Hinge box",version:1,nodes:{},rootOrder:[]};
const ticket="0".repeat(32)+".stl";
const bytes=134;
let native:{postMessage:ReturnType<typeof vi.fn>};
const validHealth=new Response(
 JSON.stringify({ok:true,bridge:"AD5X Design local STL handoff"}),{
 status:200,headers:{"Content-Type":"application/json"}
});
function stubPost(reply:Response){
 vi.stubGlobal("fetch",vi.fn((url:string)=>{
  if(url==="/ad5x-handoff/status")return Promise.resolve(validHealth.clone());
  if(url==="/ad5x-handoff/stl")return Promise.resolve(reply.clone());
  return Promise.reject(new Error("Unexpected request "+url));
 }));
}
beforeEach(()=>{
  native={postMessage:vi.fn()};
  Object.defineProperty(window,"wx",{value:native,writable:true,configurable:true});
  mocks.serialize.mockReset();
  mocks.serialize.mockReturnValue({
    blob:new Blob([new Uint8Array(bytes)],{type:"application/octet-stream"}),
    exported:2,skippedHoles:1
  });
  stubPost(new Response(
    JSON.stringify({ok:true,ticket,bytes}),{
      status:201,headers:{"Content-Type":"application/json"}
    }
  ));
});
afterEach(()=>{vi.unstubAllGlobals();delete (window as Window&{wx?:unknown}).wx;});
async function waitNativeMessage(){
  await vi.waitFor(()=>expect(native.postMessage).toHaveBeenCalledTimes(1));
  expect(native.postMessage).toHaveBeenCalledWith("AD5X_PREPARE:"+ticket);
}
const ack=(id:string,ok:boolean,error?:string)=>window.dispatchEvent(
  new CustomEvent("ad5x-prepare-result",{detail:{ticket:id,ok,error}})
);
describe("native Design -> Prepare upload with ACK (not an STL download)",()=>{
 it("sends actual STL as binary to same-origin localhost, then waits for native Plater ACK",async()=>{
  const request=sendSceneToPrepare(project);
  await waitNativeMessage();
  const fetch=vi.mocked(globalThis.fetch);
  expect(fetch).toHaveBeenCalledWith("/ad5x-handoff/stl",
    expect.objectContaining({
      method:"POST",
      headers:{"Content-Type":"application/octet-stream","X-AD5X-Prepare":"1"}
    })
  );
  expect(mocks.serialize).toHaveBeenCalledWith(project,{format:"stl",onlyIds:undefined});
  ack("f".repeat(32)+".stl",true); // an unrelated old receipt MUST NOT release this request
  let resolved=false;
  void request.then(()=>{resolved=true;});
  await Promise.resolve();expect(resolved).toBe(false);
  ack(ticket,true);
  expect(await request).toEqual({ticket,count:2,skippedHoles:1,bytes});
 });
 it("blocks simultaneous native and toolbar sends: exactly ONE STL upload/import in flight",async()=>{
  const first=sendSceneToPrepare(project);
  const second=sendSceneToPrepare(project);
  await expect(second).rejects.toThrow("already in progress");
  await waitNativeMessage();
  expect(vi.mocked(globalThis.fetch).mock.calls.filter(c=>c[0]==="/ad5x-handoff/stl")).toHaveLength(1);
  ack(ticket,true);
  await first;
  // A NEW deliberate transfer is allowed after native confirmed the previous.
  const after=sendSceneToPrepare(project);
  await vi.waitFor(()=>expect(native.postMessage).toHaveBeenCalledTimes(2));
  ack(ticket,true);
  await after;
  expect(vi.mocked(globalThis.fetch).mock.calls.filter(c=>c[0]==="/ad5x-handoff/stl")).toHaveLength(2);
 });
 it("releases busy state after explicit native rejection instead of deadlocking future work",async()=>{
  const failed=sendSceneToPrepare(project);
  await waitNativeMessage();
  ack(ticket,false,"Plater rejected this shape.");
  await expect(failed).rejects.toThrow("Plater rejected");
  const retry=sendSceneToPrepare(project);
  await vi.waitFor(()=>expect(native.postMessage).toHaveBeenCalledTimes(2));
  ack(ticket,true);
  await retry;
 });
 it("passes selected IDs through the EXACT existing exporter when explicitly requested",async()=>{
  const promise=sendSceneToPrepare(project,["a","b"]);
  await waitNativeMessage();
  expect(mocks.serialize).toHaveBeenCalledWith(project,{format:"stl",onlyIds:["a","b"]});
  ack(ticket,true);await promise;
 });
 it("blocks use in standalone browser (no native bridge), and never uploads",async()=>{
  delete (window as Window&{wx?:unknown}).wx;
  expect(nativePrepareAvailable()).toBe(false);
  await expect(sendSceneToPrepare(project)).rejects.toThrow("updated Creality Print");
  expect(globalThis.fetch).not.toHaveBeenCalled();
 });
 it("never uploads when only ungrouped HOLE shapes or empty scene are printable",async()=>{
  mocks.serialize.mockReturnValue({blob:null,exported:0,skippedHoles:2});
  await expect(sendSceneToPrepare(project)).rejects.toThrow("No printable solid");
  expect(globalThis.fetch).not.toHaveBeenCalled();
 });
 it("does not claim success on failed STAGING and never sends native request",async()=>{
  stubPost(new Response(JSON.stringify({error:"Incomplete STL"}),{status:422}));
  await expect(sendSceneToPrepare(project)).rejects.toThrow("Incomplete STL");
  expect(native.postMessage).not.toHaveBeenCalled();
 });
 it("does not claim success without native PLATER acceptance",async()=>{
  const request=sendSceneToPrepare(project);
  await waitNativeMessage();
  ack(ticket,false,"Native Plater rejected the file.");
  await expect(request).rejects.toThrow("Native Plater rejected");
 });
 it("rejects malformed response ticket so no arbitrary file path enters native C++",async()=>{
  stubPost(new Response(
    JSON.stringify({ok:true,ticket:"../../etc/password.stl",bytes}),{status:201}));
  await expect(sendSceneToPrepare(project)).rejects.toThrow("invalid STL receipt");
  expect(native.postMessage).not.toHaveBeenCalled();
 });
 it("checks bridge readiness BEFORE posting model, with safe GET retries only",async()=>{
  let healthCalls=0,posts=0;
  vi.stubGlobal("fetch",vi.fn((url:string)=>{
   if(url==="/ad5x-handoff/status"){
    healthCalls++;
    return Promise.resolve(healthCalls===1?
      new Response("unavailable",{status:503}):
      validHealth.clone());
   }
   if(url==="/ad5x-handoff/stl"){
    posts++;
    return Promise.resolve(new Response(JSON.stringify({ok:true,ticket,bytes}),{status:201}));
   }
   throw new Error("Unexpected URL");
  }));
  const promise=sendSceneToPrepare(project);
  await waitNativeMessage();
  expect(healthCalls).toBe(2);
  expect(posts).toBe(1);
  ack(ticket,true);await promise;
 });
 it("refuses to upload when bridge fails readiness; no ambiguous duplicate request",async()=>{
  vi.stubGlobal("fetch",vi.fn().mockResolvedValue(new Response("not ready",{status:503})));
  await expect(sendSceneToPrepare(project)).rejects.toThrow("No STL was uploaded");
  expect(vi.mocked(globalThis.fetch).mock.calls.every(call=>call[0]==="/ad5x-handoff/status")).toBe(true);
  expect(native.postMessage).not.toHaveBeenCalled();
 });
 it("preserves existing STL download and Length label while exposing the new button",async()=>{
  const toolbar=(await import("../components/Toolbar.tsx?raw")).default;
  expect(toolbar).toContain('Send to Prepare build plate');
  expect(toolbar).toContain('ad5x-send-to-prepare');
  expect(toolbar).toContain('const { exported, skippedHoles } = exportSceneStl');
  const workshop=(await import("../components/WorkshopTools.tsx?raw")).default;
  expect(workshop).toContain('{field("trayW","Width")}{field("trayD","Length")}{field("trayH","Height")}');
 });
});