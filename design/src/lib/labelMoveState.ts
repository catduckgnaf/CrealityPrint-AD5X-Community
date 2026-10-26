import {create} from "zustand";
import {useScene} from "../state/store";
import {labelMoveTarget,boundedLabelDelta,previewLabelNodes,type LabelMoveTarget} from "./labelMoveCore";

interface MoveSession{target:LabelMoveTarget;dx:number;dy:number;}
type Store={
 session:MoveSession|null;
 begin:(groupId:string)=>void;
 move:(x:number,y:number)=>void;
 reset:()=>void;
 apply:()=>void;
 cancel:()=>void;
};
export const useLabelMove=create<Store>()((set,get)=>({
 session:null,
 begin:(groupId)=>{
  const target=labelMoveTarget(groupId,useScene.getState().project);
  set({session:{target,dx:0,dy:0}});
 },
 move:(x,y)=>{
  const current=get().session;if(!current)return;
  const [dx,dy]=boundedLabelDelta(current.target,x,y);
  if(current.dx===dx&&current.dy===dy)return;
  set({session:{...current,dx,dy}});
 },
 reset:()=>{
  const s=get().session;if(s)set({session:{...s,dx:0,dy:0}});
 },
 apply:()=>{
  const s=get().session;if(!s)return;
  // Validate AGAIN on commit so stale sessions cannot modify a replaced project.
  const current=labelMoveTarget(s.target.groupId,useScene.getState().project);
  if(current.labelIds.join("|")!==s.target.labelIds.join("|"))
   throw new Error("The label changed during editing; cancel and select it again.");
  const [dx,dy]=boundedLabelDelta(s.target,s.dx,s.dy);
  if(Math.abs(dx)>0.001||Math.abs(dy)>0.001){
   useScene.setState(state=>({
    project:{...state.project,nodes:previewLabelNodes(s.target,state.project.nodes,dx,dy)}
   }));
  }
  set({session:null});
 },
 cancel:()=>set({session:null})
}));
