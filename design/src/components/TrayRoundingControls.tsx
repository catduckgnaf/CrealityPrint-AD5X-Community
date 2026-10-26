import {useEffect,useState} from "react";
import {Html} from "@react-three/drei";
import {useScene} from "../state/store";
import {useLiveBend} from "../lib/liveBendState";
import {useDirectEdit} from "../lib/directEditState";
import {useLabelMove} from "../lib/labelMoveState";
import {useTrayRounding} from "../lib/trayRoundingState";
import {trayTarget} from "../lib/trayRoundingCore";
import {CornerUpRight,X,Check,RotateCcw} from "lucide-react";

function RadiusHandle({which,pos}:{
 which:"outside"|"scoop";pos:[number,number,number];
}){
 const session=useTrayRounding(s=>s.session);
 const preview=useTrayRounding(s=>s.preview);
 const [drag,setDrag]=useState<{y:number;v:number}|null>(null);
 if(!session)return null;
 const radius=session.settings[which];
 return <Html position={pos} center zIndexRange={[175,145]} style={{pointerEvents:"auto"}}>
  <button className={"design-tray-grip"+(drag?" is-dragging":"")} type="button"
   aria-label={which==="outside"?"Drag to round tray corners":"Drag to scoop tray floor"}
   title={which==="outside"?"Round inside and outside corners together":"Round where the floor meets the side walls"}
   onPointerDown={e=>{
     if(e.button!==0)return;
     e.preventDefault();e.stopPropagation();
     setDrag({y:e.clientY,v:radius});
     e.currentTarget.setPointerCapture(e.pointerId);
   }}
   onPointerMove={e=>{
     if(!drag)return;
     e.preventDefault();e.stopPropagation();
     preview(which,drag.v+(drag.y-e.clientY)*(e.shiftKey?0.025:0.10));
   }}
   onPointerUp={e=>{
     e.preventDefault();e.stopPropagation();
     if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
     setDrag(null);
   }}
   onPointerCancel={()=>setDrag(null)}
   onClick={e=>e.stopPropagation()}>
   <CornerUpRight size={17}/>
   <span>{which==="outside"?"CORNERS":"FLOOR SCOOP"}</span>
  </button>
 </Html>;
}
export function TrayRoundingHandles(){
 const session=useTrayRounding(s=>s.session);
 const project=useScene(s=>s.project);
 if(!session)return null;
 let shell;
 try{shell=trayTarget(session.id,project).shell;}catch{return null;}
 return <>
  <RadiusHandle which="outside" pos={[
    shell.cx+shell.width/2+5,shell.cy+shell.depth/2+4,shell.top+2]}/>
  <RadiusHandle which="scoop" pos={[
    shell.cx,shell.cy-shell.depth/2+shell.wallY+7,
    shell.bottom+shell.floor+4]}/>
 </>;
}
export function TrayRoundingPanel(){
 const session=useTrayRounding(s=>s.session);
 const begin=useTrayRounding(s=>s.begin);
 const preview=useTrayRounding(s=>s.preview);
 const apply=useTrayRounding(s=>s.apply);
 const cancel=useTrayRounding(s=>s.cancel);
 const [error,setError]=useState("");
 const selection=useScene(s=>s.selection);
 useEffect(()=>{
  const launch=()=>{
   setError("");
   const selected=useScene.getState().selection;
   if(selected.length!==1){setError("Select one hollow tray first.");return;}
   try{
    useLiveBend.getState().cancel();
    useDirectEdit.getState().cancel();
    useLabelMove.getState().cancel();
    begin(selected[0]);
   }catch(e){setError(e instanceof Error?e.message:"Tray Rounding not available for this selection.");}
  };
  window.addEventListener("ad5x-tray-round",launch);
  return ()=>window.removeEventListener("ad5x-tray-round",launch);
 },[begin]);
 useEffect(()=>{
  if(!session)return;
  const keydown=(e:KeyboardEvent)=>{
   if(e.key!=="Escape")return;
   e.preventDefault();e.stopImmediatePropagation();
   cancel();
  };
  window.addEventListener("keydown",keydown,true);
  return ()=>window.removeEventListener("keydown",keydown,true);
 },[session,cancel]);
 useEffect(()=>{
  if(!session)return;
  if(selection.length!==1||selection[0]!==session.id)cancel();
 },[selection,session,cancel]);
 useEffect(()=>{
  const closeForOther=()=>cancel();
  window.addEventListener("ad5x-live-bend",closeForOther);
  window.addEventListener("ad5x-direct-edit",closeForOther);
  return ()=>{
   window.removeEventListener("ad5x-live-bend",closeForOther);
   window.removeEventListener("ad5x-direct-edit",closeForOther);
  };
 },[cancel]);
 useEffect(()=>{
  if(!error)return;
  const timer=window.setTimeout(()=>setError(""),4000);
  return ()=>window.clearTimeout(timer);
 },[error]);
 if(!session&&!error)return null;
 if(!session)return <div className="design-tray-error" role="status">{error}
   <button onClick={()=>setError("")} aria-label="Dismiss tray message"><X size={15}/></button></div>;
 const inside=Math.max(0,session.settings.outside-session.wall);
 const field=(which:"outside"|"scoop",label:string,max:number)=>
  <label key={which}>{label}
   <div className="design-tray-input">
    <input type="range" min="0" max={max} step="0.25" value={session.settings[which]}
      aria-label={label} onChange={e=>preview(which,Number(e.target.value))}/>
    <output>{session.settings[which].toFixed(2)} mm</output>
   </div>
  </label>;
 return <section className="design-tray-panel" role="dialog" aria-label="Tray Rounding">
  <header><CornerUpRight size={18}/><strong>Round tray corners and floor</strong>
   <button onClick={cancel} aria-label="Close tray rounding"><X size={17}/></button></header>
  <p>Drag either green handle. Both inside and outside corners change together; your wall and bottom thickness stay the same.</p>
  {field("outside","Outside corner radius",session.maxOutside)}
  <div className="design-tray-derived">Inside corner radius: <b>{inside.toFixed(2)} mm</b>
   <small>Automatically offset by your {session.wall.toFixed(2)} mm wall.</small></div>
  {field("scoop","Easy-pickup floor curve",session.maxScoop)}
  <p className="design-tray-help">Smoothes where the tray floor meets its outer walls. Existing divider junctions may still need separate rounding. Check any matching lid afterward.</p>
  <div className="design-tray-actions">
   <button onClick={()=>{preview("outside",0);preview("scoop",0);}}><RotateCcw size={14}/> Reset</button>
   <button onClick={cancel}>Cancel</button>
   <button className="primary" onClick={()=>{
    try{apply();setError("");}catch(e){setError(e instanceof Error?e.message:"Could not apply tray rounding.");}
   }}><Check size={15}/> Apply</button>
  </div>
  {error&&<p className="design-tray-inline-error" role="alert">{error}</p>}
  <small>Live preview only until Apply. Escape cancels. Ctrl+Z undoes the finished change.</small>
 </section>;
}
