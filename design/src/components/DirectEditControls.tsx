import {useEffect,useState} from "react";
import {Html} from "@react-three/drei";
import {useScene} from "../state/store";
import {isGroup} from "../types/scene";
import {useDirectEdit,previewEditedBox} from "../lib/directEditState";
import {dimensionKeys,type Face} from "../lib/directEditCore";
import {Move3d,CornerUpRight,Check,X,RotateCcw} from "lucide-react";

const faces:Face[]=[
 {axis:0,sign:1},{axis:0,sign:-1},
 {axis:1,sign:1},{axis:1,sign:-1},
 {axis:2,sign:1},{axis:2,sign:-1},
];
const faceName=(face:Face)=>["X","Y","Z"][face.axis]+(face.sign===1?"+":"−");

function FaceGrip({face,position}:{face:Face;position:[number,number,number]}){
 const current=useDirectEdit(s=>s.session);
 const choose=useDirectEdit(s=>s.chooseFace);
 const change=useDirectEdit(s=>s.previewDelta);
 const [anchor,setAnchor]=useState<{y:number;delta:number}|null>(null);
 const chosen=current?.kind==="face" && current.face?.axis===face.axis && current.face?.sign===face.sign;
 return <Html position={position} center zIndexRange={[175,140]} style={{pointerEvents:"auto"}}>
  <button type="button" aria-label={"Pull face "+faceName(face)} title="Drag up to extend this face; down to shrink. Shift for precision."
   className={"design-face-grip"+(chosen?" chosen":"")}
   onPointerDown={e=>{
    if(e.button!==0)return;
    e.preventDefault();e.stopPropagation();
    choose(face);
    setAnchor({y:e.clientY,delta:0});
    e.currentTarget.setPointerCapture(e.pointerId);
   }}
   onPointerMove={e=>{
    if(!anchor)return;
    e.preventDefault();e.stopPropagation();
    change(anchor.delta+(anchor.y-e.clientY)*(e.shiftKey?0.08:0.3));
   }}
   onPointerUp={e=>{
    e.preventDefault();e.stopPropagation();
    if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
    setAnchor(null);
   }}
   onPointerCancel={()=>setAnchor(null)}
   onClick={e=>e.stopPropagation()}>
    {faceName(face)}
  </button>
 </Html>;
}
function RoundGrip({position}:{position:[number,number,number]}){
 const current=useDirectEdit(s=>s.session);
 const change=useDirectEdit(s=>s.previewRadius);
 const [anchor,setAnchor]=useState<{y:number;radius:number}|null>(null);
 if(!current||current.kind!=="round")return null;
 return <Html position={position} center zIndexRange={[180,145]} style={{pointerEvents:"auto"}}>
  <button type="button" aria-label="Drag to round vertical corners"
   className="design-round-grip"
   onPointerDown={e=>{
    if(e.button!==0)return;
    e.preventDefault();e.stopPropagation();
    setAnchor({y:e.clientY,radius:current.radius});
    e.currentTarget.setPointerCapture(e.pointerId);
   }}
   onPointerMove={e=>{
    if(!anchor)return;
    e.preventDefault();e.stopPropagation();
    change(anchor.radius+(anchor.y-e.clientY)*(e.shiftKey?0.025:0.10));
   }}
   onPointerUp={e=>{
    e.preventDefault();e.stopPropagation();
    if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
    setAnchor(null);
   }}
   onPointerCancel={()=>setAnchor(null)}
   onClick={e=>e.stopPropagation()}>
    <CornerUpRight size={18}/><span>DRAG TO ROUND</span>
  </button>
 </Html>;
}
export function DirectEditHandles(){
 const session=useDirectEdit(s=>s.session);
 const node=useScene(s=>session?s.project.nodes[session.id]:undefined);
 if(!session||!node||isGroup(node))return null;
 const effective=previewEditedBox(node,session);
 const w=Number(effective.params.w),d=Number(effective.params.d),h=Number(effective.params.h);
 const center=effective.position;
 if(session.kind==="round")return <RoundGrip position={[
  center[0]+w/2+3,center[1]+d/2+3,center[2]+h/2+3]}/>;
 return <>
  {faces.map(face=>{
   const p=[...center] as [number,number,number];
   p[face.axis]+=(face.sign*([w,d,h][face.axis]/2+3));
   return <FaceGrip key={faceName(face)} face={face} position={p}/>;
  })}
 </>;
}
export function DirectEditPanel(){
 const session=useDirectEdit(s=>s.session);
 const begin=useDirectEdit(s=>s.start);
 const changeFace=useDirectEdit(s=>s.chooseFace);
 const delta=useDirectEdit(s=>s.previewDelta);
 const radius=useDirectEdit(s=>s.previewRadius);
 const apply=useDirectEdit(s=>s.commit);
 const cancel=useDirectEdit(s=>s.cancel);
 const [error,setError]=useState("");
 const [draft,setDraft]=useState("");
 useEffect(()=>{
  const beginTool=(e:Event)=>{
   const type=(e as CustomEvent<"face"|"round">).detail;
   if(type!=="face"&&type!=="round")return;
   const selection=useScene.getState().selection;
   setError("");
   if(selection.length!==1){setError("Select one box first.");return;}
   try{begin(type,selection[0]);}catch(err){
    setError(err instanceof Error?err.message:"This shape cannot be edited.");
   }
  };
  window.addEventListener("ad5x-direct-edit",beginTool);
  return ()=>window.removeEventListener("ad5x-direct-edit",beginTool);
 },[begin]);
 useEffect(()=>{
  const closeForBend=()=>cancel();
  window.addEventListener("ad5x-live-bend",closeForBend);
  return ()=>window.removeEventListener("ad5x-live-bend",closeForBend);
 },[cancel]);
 useEffect(()=>{
  if(!session)return;
  const esc=(event:KeyboardEvent)=>{
   if(event.key!=="Escape")return;
   event.preventDefault();event.stopImmediatePropagation();cancel();
  };
  window.addEventListener("keydown",esc,true);
  return ()=>window.removeEventListener("keydown",esc,true);
 },[session,cancel]);
 useEffect(()=>{
  if(!session)return;
  setDraft((session.kind==="round"?session.radius:session.delta).toFixed(1));
 },[session]);
 const commitNumber=()=>{
  if(!session)return;
  const v=Number(draft);
  if(!draft.trim()||!Number.isFinite(v)){setError("Enter a valid millimetre value.");return;}
  if(session.kind==="round")radius(v);else delta(v);
  setError("");
 };
 if(!session&&!error)return null;
 if(!session)return <div className="design-direct-message" role="status">{error}
  <button type="button" onClick={()=>setError("")} aria-label="Dismiss message"><X size={16}/></button></div>;
 const isFace=session.kind==="face";
 const selectedFace=isFace?session.face:null;
 const box=useScene.getState().project.nodes[session.id];
 const originalSize=isFace&&selectedFace&&box&&!isGroup(box)?Number(box.params[dimensionKeys[selectedFace.axis]]):null;
 const activeNumber=isFace?session.delta:session.radius;
 return <section className="design-direct-panel" role="dialog" aria-label={isFace?"Grab and Pull":"Live corner rounding"}>
  <header>
   {isFace?<Move3d size={18}/>:<CornerUpRight size={18}/>}
   <strong>{isFace?"Grab & Pull":"Drag-to-Round"}</strong>
   <button type="button" onClick={cancel} aria-label="Cancel editing"><X size={16}/></button>
  </header>
  <p>{isFace?"Drag one of the six face handles. The opposite face stays fixed.":"Drag the green corner handle to round the four upright edges."}</p>
  {isFace&&<div className="design-direct-face-list">
   {faces.map(face=><button key={faceName(face)} type="button"
    className={selectedFace?.axis===face.axis&&selectedFace?.sign===face.sign?"active":""}
    onClick={()=>changeFace(face)}>{faceName(face)}</button>)}
  </div>}
  <div className="design-direct-value">
   {isFace?(selectedFace?
      <>{(originalSize!+session.delta).toFixed(1)} mm <small>{session.delta>=0?"+":""}{session.delta.toFixed(1)} mm face change</small></>:
      <span>Choose a face to pull</span>)
    :<>{session.radius.toFixed(2)} mm <small>corner radius · maximum {session.max.toFixed(2)} mm</small></>}
  </div>
  {(!isFace||selectedFace)&&<>
   <input type="range" aria-label={isFace?"Face extension":"Corner radius"}
    min={isFace?(1-(originalSize||20)):"0"}
    max={isFace?(300-(originalSize||20)):session.max}
    step={isFace?"0.1":"0.25"}
    value={activeNumber}
    onChange={e=>isFace?delta(Number(e.target.value)):radius(Number(e.target.value))}/>
   <label>{isFace?"Change in millimetres":"Radius in millimetres"}
    <input type="text" inputMode="decimal" value={draft} onChange={e=>setDraft(e.target.value)}
      onBlur={commitNumber}
      onKeyDown={e=>{
       e.stopPropagation();
       if(e.key==="Enter"){commitNumber();e.currentTarget.blur();}
       if(e.key==="Escape")cancel();
      }}/>
   </label>
  </>}
  {error&&<p className="design-direct-error" role="alert">{error}</p>}
  <div className="design-direct-actions">
   <button type="button" onClick={()=>isFace?delta(0):radius(0)}><RotateCcw size={14}/> Reset</button>
   <button type="button" onClick={cancel}>Cancel</button>
   <button type="button" className="primary" onClick={()=>{
    try{apply();setError("");}catch(e){setError(e instanceof Error?e.message:"Could not apply change.");}
   }}><Check size={15}/> Apply</button>
  </div>
  <small>Live preview only until Apply. Escape discards changes; Ctrl+Z undoes committed edits.</small>
 </section>;
}
