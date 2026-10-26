import {create} from "zustand";
import {useScene} from "../state/store";
import {useLiveBend} from "./liveBendState";
import {isGroup,type ShapeNode} from "../types/scene";
import {
  stretchedFace,roundedCornerPreview,clampStretch,initialCornerRadius,safeCornerMaximum,
  type Face,
} from "./directEditCore";

export type DirectEditSession=
  |{kind:"face";id:string;face:Face|null;delta:number}
  |{kind:"round";id:string;radius:number;initial:number;max:number};
interface DirectEditState {
  session:DirectEditSession|null;
  start:(kind:"face"|"round",id:string)=>void;
  chooseFace:(face:Face)=>void;
  previewDelta:(value:number)=>void;
  previewRadius:(value:number)=>void;
  commit:()=>void;
  cancel:()=>void;
}

function getEditableBox(id:string):ShapeNode {
 const project=useScene.getState().project;
 const node=project.nodes[id];
 if(!project.rootOrder.includes(id)||!node||isGroup(node)||node.kind!=="box"
   ||node.role!=="solid"||node.hidden||node.locked
   ||node.rotation.some(x=>Math.abs(x)>0.000001)
   ||node.scale.some(x=>Math.abs(x-1)>0.000001))
  throw new Error("Select one visible, unlocked, unrotated solid box.");
 if(Number(node.params.bendAngle||0)!==0)
  throw new Error("Face and corner editing cannot yet combine with Live Bend.");
 for(const key of ["w","d","h"]) {
  const size=Number(node.params[key]);
  if(!Number.isFinite(size)||size<1||size>300)
   throw new Error("The selected box needs dimensions between 1 and 300 mm.");
 }
 return node;
}
export function previewEditedBox(node:ShapeNode,session:DirectEditSession|null):ShapeNode {
 if(!session||session.id!==node.id)return node;
 if(session.kind==="face" && session.face)
  return stretchedFace(node,session.face,session.delta);
 if(session.kind==="round")
  return roundedCornerPreview(node,session.radius);
 return node;
}
export const useDirectEdit=create<DirectEditState>()((set,get)=>({
 session:null,
 start:(kind,id)=>{
  const box=getEditableBox(id);
  if(kind==="face" && (typeof box.params.edges==="string" && box.params.edges.length>0 || Number(box.params.radius||0)>0))
   throw new Error("Live face adjustment currently supports sharp boxes. Use regular resizing for rounded boxes.");
  useLiveBend.getState().cancel();
  if(kind==="face"){set({session:{kind,id,face:null,delta:0}});return;}
  const max=safeCornerMaximum(box);
  const initial=initialCornerRadius(box);
  if(!Number.isFinite(max)||max<0.05)throw new Error("This box is too small to round.");
  set({session:{kind,id,radius:initial,initial,max}});
 },
 chooseFace:(face)=>{
  const s=get().session;
  if(!s||s.kind!=="face")return;
  getEditableBox(s.id);
  set({session:{...s,face,delta:0}});
 },
 previewDelta:(value)=>{
  const s=get().session;
  if(!s||s.kind!=="face"||!s.face)return;
  const node=getEditableBox(s.id);
  const delta=clampStretch(node,s.face,value);
  if(Math.abs(s.delta-delta)<0.001)return;
  set({session:{...s,delta}});
 },
 previewRadius:(value)=>{
  const s=get().session;
  if(!s||s.kind!=="round"||!Number.isFinite(value))return;
  const quantized=Math.round(Math.max(0,Math.min(s.max,value))*4)/4;
  const radius=Math.min(s.max,quantized);
  if(Math.abs(s.radius-radius)<0.001)return;
  set({session:{...s,radius}});
 },
 commit:()=>{
  const s=get().session;if(!s)return;
  const node=getEditableBox(s.id);
  if(s.kind==="face"&&s.face&&Math.abs(s.delta)>0.001) {
   const next=stretchedFace(node,s.face,s.delta);
   useScene.getState().updateShape(node.id,{params:next.params,position:next.position});
  }else if(s.kind==="round"&&Math.abs(s.initial-s.radius)>0.001){
   const next=roundedCornerPreview(node,s.radius);
   useScene.getState().updateShape(node.id,{params:next.params});
  }
  set({session:null});
 },
 cancel:()=>set({session:null}),
}));
