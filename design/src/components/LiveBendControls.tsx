import {useEffect,useState} from "react";
import {Html} from "@react-three/drei";
import {useScene} from "../state/store";
import {isGroup} from "../types/scene";
import {bendNeutralPoint} from "../lib/liveBendGeometry";
import {useLiveBend} from "../lib/liveBendState";
import {BetweenHorizontalEnd,Undo2,Check,X} from "lucide-react";

export function LiveBendHandle(){
 const session=useLiveBend(s=>s.session);
 const preview=useLiveBend(s=>s.preview);
 const node=useScene(s=>session?s.project.nodes[session.id]:undefined);
 const [dragStart,setDragStart]=useState<{y:number;angle:number}|null>(null);
 if(!session||!node||isGroup(node)||node.kind!=="box")return null;
 const w=Number(node.params.w),h=Number(node.params.h);
 const [ex,ez]=bendNeutralPoint(w/2,h/2,w,session.angle);
 const position:[number,number,number]=[node.position[0]+ex,node.position[1],node.position[2]+ez+2];
 return <Html position={position} center zIndexRange={[200,170]} style={{pointerEvents:"auto"}}>
  <button type="button" className={"design-bend-grip"+(dragStart?" is-dragging":"")}
    title="Drag up or down to bend the selected part. Shift for fine adjustment."
    aria-label="Drag handle to bend the part"
    onPointerDown={e=>{
      if(e.button!==0)return;
      e.preventDefault();e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      setDragStart({y:e.clientY,angle:session.angle});
    }}
    onPointerMove={e=>{
      if(!dragStart)return;
      e.preventDefault();e.stopPropagation();
      const sensitivity=e.shiftKey?0.12:0.55;
      preview(dragStart.angle+(dragStart.y-e.clientY)*sensitivity);
    }}
    onPointerUp={e=>{
      e.preventDefault();e.stopPropagation();
      if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
      setDragStart(null);
    }}
    onPointerCancel={()=>setDragStart(null)}
    onClick={e=>e.stopPropagation()}>
    <BetweenHorizontalEnd size={21}/>
    <span>DRAG TO BEND</span>
  </button>
 </Html>;
}

export function LiveBendPanel(){
 const session=useLiveBend(s=>s.session);
 const preview=useLiveBend(s=>s.preview);
 const apply=useLiveBend(s=>s.apply);
 const cancel=useLiveBend(s=>s.cancel);
 const start=useLiveBend(s=>s.start);
 const [warning,setWarning]=useState("");
 const selection=useScene(s=>s.selection);
 // A failed tool action is informational, not a permanent overlay on the part.
 useEffect(()=>{setWarning("");},[selection]);
 useEffect(()=>{
  if(!warning)return;
  const timer=window.setTimeout(()=>setWarning(""),3500);
  return ()=>window.clearTimeout(timer);
 },[warning]);
 const [draft,setDraft]=useState("");
 useEffect(()=>{
   const open=()=>{
    const selection=useScene.getState().selection;
    setWarning("");
    if(selection.length!==1){setWarning("Select one straight box, then choose Bend.");return;}
    try{start(selection[0]);}catch(e){setWarning(e instanceof Error?e.message:"Cannot bend this selection.");}
   };
   window.addEventListener("ad5x-live-bend",open);
   return ()=>window.removeEventListener("ad5x-live-bend",open);
 },[start]);
 useEffect(()=>{if(session)setDraft(session.angle.toFixed(1));},[session?.angle]);
 useEffect(()=>{
  if(!session)return;
  const escape=(e:KeyboardEvent)=>{
   if(e.key==="Escape"){
    e.preventDefault();e.stopImmediatePropagation();
    cancel();
   }
  };
  window.addEventListener("keydown",escape,true);
  return ()=>window.removeEventListener("keydown",escape,true);
 },[session,cancel]);
 if(!session&&!warning)return null;
 if(!session)return <div className="design-bend-message" role="status">
    <span>{warning}</span><button type="button" aria-label="Dismiss bend message" onClick={()=>setWarning("")}><X size={17}/></button>
   </div>;
 const current=useScene.getState().project.nodes[session.id];
 const w=current&&!isGroup(current)?Number(current.params.w):0;
 const radius=session.angle===0?null:w/(session.angle*Math.PI/180);
 const adjust=()=>{
  const amount=Number(draft);
  if(Number.isFinite(amount))preview(amount);
  else setDraft(session.angle.toFixed(1));
 };
 return <section className="design-bend-panel" role="dialog" aria-label="Live Bend settings">
   <header><BetweenHorizontalEnd size={18}/><strong>Live Bend</strong>
    <button type="button" aria-label="Cancel bend" onClick={cancel}><X size={17}/></button>
   </header>
   <p>Grab the green handle on the part and drag. Or slide to see the bend update instantly.</p>
   <div className="design-bend-current">{session.angle.toFixed(1)}° <span>{radius===null?"Straight":Math.abs(radius).toFixed(1)+" mm neutral radius"}</span></div>
   <input type="range" aria-label="Live bend angle" min={-session.max} max={session.max} step="0.5"
     value={session.angle} onChange={e=>preview(Number(e.target.value))}/>
   <div className="design-bend-range"><span>−{session.max.toFixed(0)}°</span><span>Straight</span><span>+{session.max.toFixed(0)}°</span></div>
   <label>Exact bend angle (degrees)
    <input type="text" inputMode="decimal" aria-label="Exact bend angle in degrees"
     value={draft} onChange={e=>setDraft(e.target.value)}
     onBlur={adjust}
     onKeyDown={e=>{
      e.stopPropagation();
      if(e.key==="Enter"){adjust();e.currentTarget.blur();}
      if(e.key==="Escape"){cancel();}
     }}/>
   </label>
   <div className="design-bend-buttons">
    <button type="button" onClick={()=>preview(0)}><Undo2 size={14}/> Straight</button>
    <button type="button" onClick={cancel}>Cancel</button>
    <button type="button" className="design-bend-apply" onClick={()=>{
      try{apply();}catch(e){setWarning(e instanceof Error?e.message:"Could not save bend");}
    }}><Check size={15}/> Apply bend</button>
   </div>
   <small>First release: unrotated solid boxes only. The saved shape exports as actual curved mesh geometry.</small>
 </section>;
}
