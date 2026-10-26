import {useEffect,useMemo,useRef,useState} from "react";
import * as THREE from "three";
import {Html} from "@react-three/drei";
import {useThree} from "@react-three/fiber";
import {useScene} from "../state/store";
import {labelMoveTarget} from "../lib/labelMoveCore";
import {useLabelMove} from "../lib/labelMoveState";
import {Move,Check,X,RotateCcw,ArrowUp,ArrowDown,ArrowLeft,ArrowRight} from "lucide-react";

export function LabelMoveHandle(){
 const selection=useScene(s=>s.selection);
 const project=useScene(s=>s.project);
 const moveSession=useLabelMove(s=>s.session);
 const begin=useLabelMove(s=>s.begin);
 const move=useLabelMove(s=>s.move);
 const gl=useThree(s=>s.gl);
 const camera=useThree(s=>s.camera);
 const drag=useRef<{point:THREE.Vector3;dx:number;dy:number}|null>(null);
 const candidate=useMemo(()=>{
  if(selection.length!==1)return null;
  try{return labelMoveTarget(selection[0],project);}catch{return null;}
 },[selection,project]);
 if(!candidate || (moveSession&&moveSession.target.groupId!==candidate.groupId))return null;
 const active=moveSession?.target.groupId===candidate.groupId?moveSession:null;
 const t=active?.target??candidate;
 const offsetX=active?.dx??0,offsetY=active?.dy??0;
 const handlePoint=new THREE.Vector3(
  t.localCenter[0]+offsetX,t.localCenter[1]+offsetY,t.localCenter[2]+t.outwardSign*0.7
 ).applyMatrix4(t.worldMatrix);
 const currentPos:[number,number,number]=[handlePoint.x,handlePoint.y,handlePoint.z];
 const intersect=(clientX:number,clientY:number):THREE.Vector3|null=>{
  const rect=gl.domElement.getBoundingClientRect();
  const ndc=new THREE.Vector2(((clientX-rect.left)/rect.width)*2-1,-((clientY-rect.top)/rect.height)*2+1);
  const caster=new THREE.Raycaster();
  caster.setFromCamera(ndc,camera);
  const normal=new THREE.Vector3(...t.surfaceNormalWorld);
  const plane=new THREE.Plane().setFromNormalAndCoplanarPoint(normal,new THREE.Vector3(...t.center));
  const hit=caster.ray.intersectPlane(plane,new THREE.Vector3());
  return hit?.applyMatrix4(t.inverseMatrix)??null;
 };
 return <Html position={currentPos} center zIndexRange={[190,155]} style={{pointerEvents:"auto"}}>
  <button type="button" className={"design-label-grip"+(active?" active":"")}
   title="Drag to reposition the lettering without moving the lid."
   aria-label={"Move label "+t.text}
   onPointerDown={e=>{
    if(e.button!==0)return;
    e.preventDefault();e.stopPropagation();
    const point=intersect(e.clientX,e.clientY);
    if(!point)return;
    if(!active)begin(t.groupId);
    drag.current={point,dx:offsetX,dy:offsetY};
    e.currentTarget.setPointerCapture(e.pointerId);
   }}
   onPointerMove={e=>{
    if(!drag.current)return;
    e.preventDefault();e.stopPropagation();
    const current=intersect(e.clientX,e.clientY);
    if(!current)return;
    const f=e.shiftKey?0.2:1;
    move(drag.current.dx+(current.x-drag.current.point.x)*f,
         drag.current.dy+(current.y-drag.current.point.y)*f);
   }}
   onPointerUp={e=>{
    e.preventDefault();e.stopPropagation();
    if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
    drag.current=null;
   }}
   onPointerCancel={()=>{drag.current=null;}}
   onClick={e=>e.stopPropagation()}>
    <Move size={15}/><span>{active?"DRAG LETTERING":"MOVE "+t.text.slice(0,14)}</span>
   </button>
 </Html>;
}
export function LabelMovePanel(){
 const session=useLabelMove(s=>s.session);
 const move=useLabelMove(s=>s.move);
 const reset=useLabelMove(s=>s.reset);
 const apply=useLabelMove(s=>s.apply);
 const cancel=useLabelMove(s=>s.cancel);
 const [error,setError]=useState("");
 const selection=useScene(s=>s.selection);
 useEffect(()=>{
  if(!session)return;
  if(selection.length!==1||selection[0]!==session.target.groupId){cancel();return;}
 },[selection,session?.target.groupId,cancel]);
 useEffect(()=>{
  if(!session)return;
  const esc=(e:KeyboardEvent)=>{
   if(e.key!=="Escape")return;
   e.preventDefault();e.stopImmediatePropagation();cancel();
  };
  window.addEventListener("keydown",esc,true);
  return ()=>window.removeEventListener("keydown",esc,true);
 },[session,cancel]);
 if(!session)return null;
 return <section className="design-label-move-panel" role="dialog" aria-label="Move lettering on part">
  <header><Move size={16}/><strong>Move “{session.target.text}”</strong>
    <button aria-label="Cancel label move" type="button" onClick={cancel}><X size={16}/></button>
  </header>
  <p>Drag the green label handle directly on the lid. The box/lid stays where it is.</p>
  <div className="design-label-move-coords">
    <span>X: {session.dx>=0?"+":""}{session.dx.toFixed(1)} mm</span>
    <span>Y: {session.dy>=0?"+":""}{session.dy.toFixed(1)} mm</span>
  </div>
  <div className="design-label-nudge">
   <button type="button" aria-label="Move label left 1 mm" onClick={()=>move(session.dx-1,session.dy)}><ArrowLeft size={16}/></button>
   <button type="button" aria-label="Move label right 1 mm" onClick={()=>move(session.dx+1,session.dy)}><ArrowRight size={16}/></button>
   <button type="button" aria-label="Move label up 1 mm" onClick={()=>move(session.dx,session.dy+1)}><ArrowUp size={16}/></button>
   <button type="button" aria-label="Move label down 1 mm" onClick={()=>move(session.dx,session.dy-1)}><ArrowDown size={16}/></button>
  </div>
  {error&&<p role="alert" className="design-label-move-error">{error}</p>}
  <div className="design-label-move-actions">
   <button type="button" onClick={reset}><RotateCcw size={14}/> Reset</button>
   <button type="button" onClick={cancel}>Cancel</button>
   <button type="button" className="primary" onClick={()=>{
    try{apply();setError("");}catch(err){setError(err instanceof Error?err.message:"Couldn't move the label.");}
   }}><Check size={14}/> Apply</button>
  </div>
  <small>One undoable edit. Recessed text stays recessed, and lid dimensions do not change.</small>
 </section>;
}
