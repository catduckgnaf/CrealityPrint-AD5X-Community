import {create} from "zustand";
import {useScene} from "../state/store";
import {isGroup,type ShapeNode} from "../types/scene";
import {checkedBendAngle,maxBendAngle} from "./liveBendGeometry";

export type BendSession={id:string;angle:number;initial:number;max:number};
type BendStore={
 session:BendSession|null;
 start:(id:string)=>void;
 preview:(angle:number)=>void;
 apply:()=>void;
 cancel:()=>void;
};
/** Read-only capability check, shared by the toolbar and the edit operation.
 * A selected group isn't a broken part: it simply doesn't support this tool yet. */
export function bendUnavailableReason(id:string|null,project:Pick<import("../types/scene").Project,"nodes"|"rootOrder">):string|null {
 if(!id)return "Select one straight solid box to enable Live Bend.";
 const n=project.nodes[id];
 if(!n||!project.rootOrder.includes(id)||n.hidden||n.locked)
  return "Select one visible, unlocked solid box to use Live Bend.";
 if(isGroup(n))return "Live Bend supports individual solid boxes; hollow boxes and lids cannot bend yet.";
 if(n.kind!=="box"||n.role!=="solid")
  return "Live Bend currently supports straight solid boxes only.";
 if(n.rotation.some(x=>Math.abs(x)>1e-6)||n.scale.some(x=>Math.abs(x-1)>1e-6))
  return "Live Bend needs an unrotated, unscaled box.";
 if((typeof n.params.edges==="string" && n.params.edges.trim().length>0)
    || Number(n.params.radius||0)>0.001)
  return "Live Bend cannot yet bend rounded boxes.";
 const w=Number(n.params.w),h=Number(n.params.h);
 if(!Number.isFinite(w)||!Number.isFinite(h)||w<12||h<0.8||w>300||h>120)
  return "Live Bend requires a box 12–300 mm long and 0.8–120 mm thick.";
 if(maxBendAngle(w,h)<5)return "This box is too thick relative to its length to bend safely.";
 return null;
}
function editableBox(id:string):ShapeNode {
 const project=useScene.getState().project;
 const reason=bendUnavailableReason(id,project);
 if(reason)throw new Error(reason);
 return project.nodes[id] as ShapeNode;
}
export const useLiveBend=create<BendStore>()((set,get)=>({
 session:null,
 start:(id)=>{
  const node=editableBox(id);
  const max=maxBendAngle(Number(node.params.w),Number(node.params.h));
  if(max<5)throw new Error("This box is too thick relative to its length to bend safely.");
  const initial=typeof node.params.bendAngle==="number"?node.params.bendAngle:0;
  set({session:{id,initial,angle:Math.max(-max,Math.min(max,initial)),max}});
 },
 preview:(value)=>{
  const current=get().session;
  if(!current)return;
  if(!Number.isFinite(value))return;
  set({session:{...current,angle:Math.round(Math.max(-current.max,Math.min(current.max,value))*10)/10}});
 },
 apply:()=>{
  const session=get().session;
  if(!session)return;
  const node=editableBox(session.id);
  checkedBendAngle(session.angle,Number(node.params.w),Number(node.params.h));
  if(Math.abs(session.angle-session.initial)>0.0001){
   const params={...node.params};
   if(Math.abs(session.angle)<0.001)delete params.bendAngle;
   else params.bendAngle=session.angle;
   useScene.getState().updateShape(node.id,{params});
  }
  set({session:null});
 },
 cancel:()=>set({session:null}),
}));
