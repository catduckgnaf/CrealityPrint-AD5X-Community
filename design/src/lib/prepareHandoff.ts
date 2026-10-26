/** One-click native WebView -> Creality Prepare transfer. Only a validated
 * random ticket crosses the native window.wx bridge; mesh bytes stay on
 * 127.0.0.1 in the isolated, bounded STL spool.
 * Never claims transfer success before the native Plater acknowledges import.
 */
import type {Project} from "../types/scene";
import {serializeSceneModel} from "./exportStl";

/** Use the proven CAD solids for the new M4 clamp. The legacy browser-CGS
 * fallback mesh leaves torn top faces around its paired bores and sideways
 * cutters. Preserve the established STL path for all other features. */
export function needsCadScrewClampMesh(project:Project,onlyIds?:string[]):boolean{
 const ids=onlyIds?.length?project.rootOrder.filter(id=>onlyIds.includes(id)):project.rootOrder;
 const seen=new Set<string>();
 const visit=(id:string):boolean=>{
  if(seen.has(id))return false;
  seen.add(id);
  const n=project.nodes[id];
  if(!n||n.hidden)return false;
  if(n.feature==="indexed-m4-clamp" || n.label==="Two-peg screw clamp movable jaw — M4 nut")return true;
  if("childIds" in n)return n.childIds.some(visit);
  return false;
 };
 return ids.some(visit);
}
export async function cadScrewClampMesh(project:Project,onlyIds?:string[]){
 const selection=onlyIds?.length?project.rootOrder.filter(id=>onlyIds.includes(id)):project.rootOrder;
 const doc={...project,rootOrder:selection};
 let response:Response;
 try{
  response=await fetch("/ad5x-handoff/cad-stl",{
   method:"POST",headers:{"Content-Type":"application/json","X-AD5X-CAD":"1"},
   body:JSON.stringify(doc)
  });
 }catch{
  throw new Error("The local verified clamp-mesh service is unavailable; no STL was sent. Do not use the corrupted fallback STL.");
 }
 if(!response.ok){
  let message="Verified clamp mesh could not be generated";
  try{const info=await response.json() as {error?:string};if(info.error)message=info.error}catch{}
  throw new Error(message);
 }
 if(response.headers.get("X-AD5X-CAD-VERIFIED")!=="1")
  throw new Error("Clamp mesh was not verified by the CAD backend; no STL was uploaded.");
 const blob=await response.blob();
 return {blob,exported:selection.length,skippedHoles:0};
}

export interface PrepareHandoffResult {
 ticket:string;
 count:number;
 skippedHoles:number;
 bytes:number;
}
interface UploadReply {ok?:boolean;ticket?:string;bytes?:number;error?:string}
interface NativeAck {ticket?:string;ok?:boolean;error?:string}
const TICKET=/^[a-f0-9]{32}\.stl$/;
// Retry only side-effect-free GET readiness; never retry an ambiguous POST.
// A lost upload response may already represent a staged/imported model.
async function assertPrepareReady():Promise<void>{
 for(let attempt=0;attempt<3;attempt++){
  try{
   const response=await fetch("/ad5x-handoff/status",{
    method:"GET",cache:"no-store",signal:AbortSignal.timeout(1600),
   });
   if(response.ok){
    const data=await response.json() as {ok?:boolean;bridge?:string};
    if(data.ok&&data.bridge==="AD5X Design local STL handoff")return;
   }
  }catch{/* bridge may be starting; retry GET only */}
  if(attempt<2)await new Promise<void>(resolve=>window.setTimeout(resolve,250));
 }
 throw new Error("The Design-to-Prepare service is unavailable. No STL was uploaded. Check the local bridge and try again.");
}

export function nativePrepareAvailable():boolean{
 const bridge=(window as typeof window&{wx?:{postMessage?:(message:string)=>void}}).wx;
 return typeof bridge?.postMessage==="function";
}
// One central guard for BOTH native-header and toolbar entry points.
 // Multiple rapid clicks must never stage/import duplicate files.
let handoffInFlight=false;
export async function sendSceneToPrepare(project:Project,onlyIds?:string[]):Promise<PrepareHandoffResult>{
 if(handoffInFlight)throw new Error("A Send to Prepare operation is already in progress. Check the current transfer before sending again.");
 handoffInFlight=true;
 try{return await performSceneToPrepare(project,onlyIds);}
 finally{handoffInFlight=false;}
}
async function performSceneToPrepare(project:Project,onlyIds?:string[]):Promise<PrepareHandoffResult>{
 if(!nativePrepareAvailable()){
  throw new Error("Open AD5X Design inside the updated Creality Print validation app to send directly to Prepare. You can still export STL from the Print menu.");
 }
 const {blob,exported,skippedHoles}=needsCadScrewClampMesh(project,onlyIds)
  ? await cadScrewClampMesh(project,onlyIds)
  : serializeSceneModel(project,{format:"stl",onlyIds});
 if(!blob||exported===0)throw new Error("No printable solid found. Group holes with their model before sending.");
 if(blob.size>80*1024*1024)throw new Error("This STL exceeds the 80 MiB local handoff limit.");
 await assertPrepareReady();
 let response:Response;
 try{
  response=await fetch("/ad5x-handoff/stl",{
   method:"POST",
   headers:{"Content-Type":"application/octet-stream","X-AD5X-Prepare":"1"},
   body:blob,
  });
 }catch{
  throw new Error("The local Design-to-Prepare service is not running. The STL was not sent.");
 }
 let data:UploadReply;
 try{data=await response.json() as UploadReply;}
 catch{throw new Error("The local Prepare bridge returned an invalid response.");}
 if(!response.ok||!data.ok){
  throw new Error(data.error||"The Design STL could not be staged for Creality Print.");
 }
 const ticket=data.ticket||"";
 if(!TICKET.test(ticket) || data.bytes!==blob.size)
  throw new Error("The transfer service returned an invalid STL receipt.");
 const bridge=(window as typeof window&{wx?:{postMessage?:(message:string)=>void}}).wx;
 if(typeof bridge?.postMessage!=="function")
  throw new Error("The native Creality Print connection disappeared before importing.");
 await new Promise<void>((resolve,reject)=>{
  let finished=false;
  const clear=()=>{
   window.clearTimeout(timeout);
   window.removeEventListener("ad5x-prepare-result",listener);
  };
  const listener=(event:Event)=>{
   const ack=(event as CustomEvent<NativeAck>).detail;
   if(ack?.ticket!==ticket||finished)return;
   finished=true;clear();
   if(ack.ok)resolve();
   else reject(new Error(ack.error||"Creality Print could not import the STL."));
  };
  const timeout=window.setTimeout(()=>{
   if(finished)return;
   finished=true;clear();
   reject(new Error("Creality Print did not acknowledge importing the model. Check Prepare before trying again to avoid duplicates."));
  },45000);
  window.addEventListener("ad5x-prepare-result",listener);
  try{bridge.postMessage!("AD5X_PREPARE:"+ticket);}
  catch(error){
   if(!finished){
    finished=true;clear();
    reject(error instanceof Error?error:new Error("The native Prepare channel failed."));
   }
  }
 });
 return {ticket,count:exported,skippedHoles,bytes:blob.size};
}