import {create} from "zustand";
import {useScene} from "../state/store";
import {trayTarget,trayRoundingNodes,traySettingsClamped,type TraySettings} from "./trayRoundingCore";

export interface TraySession{ id:string;initial:TraySettings;settings:TraySettings;maxOutside:number;maxScoop:number;wall:number;}
interface TrayRoundingStore{
 session:TraySession|null;
 begin:(id:string)=>void;
 preview:(kind:"outside"|"scoop",radius:number)=>void;
 apply:()=>void;
 cancel:()=>void;
}
export const useTrayRounding=create<TrayRoundingStore>()((set,get)=>({
 session:null,
 begin:(id)=>{
  const t=trayTarget(id,useScene.getState().project);
  set({session:{id,initial:t.initial,settings:t.initial,maxOutside:t.maxOutside,
    maxScoop:t.maxScoop,wall:(t.shell.wallX+t.shell.wallY)/2}});
 },
 preview:(kind,radius)=>{
  const s=get().session;
  if(!s||!Number.isFinite(radius))return;
  const t=trayTarget(s.id,useScene.getState().project);
  const settings=traySettingsClamped(t,{...s.settings,[kind]:radius});
  settings.outside=Math.min(t.maxOutside,settings.outside);
  settings.scoop=Math.min(t.maxScoop,settings.scoop);
  set({session:{...s,settings}});
 },
 apply:()=>{
  const s=get().session;
  if(!s)return;
  const p=useScene.getState().project;
  const t=trayTarget(s.id,p); // revalidate original scene before any commit
  if(Math.abs(s.settings.outside-s.initial.outside)<0.001&&
     Math.abs(s.settings.scoop-s.initial.scoop)<0.001){set({session:null});return;}
  const next=trayRoundingNodes(t,s.settings);
  useScene.setState(current=>{
   // Prevent stale target / a changed selection from silently altering another model.
   if(current.selection.length!==1||current.selection[0]!==s.id ||
      current.project.nodes[t.shell.outer.id]!==p.nodes[t.shell.outer.id] ||
      current.project.nodes[t.shell.cavity.id]!==p.nodes[t.shell.cavity.id])
      throw new Error("Tray changed while editing. Cancel and reopen Tray Rounding.");
   return {project:{...current.project,nodes:{...current.project.nodes,...next}}};
  });
  set({session:null});
 },
 cancel:()=>set({session:null}),
}));
