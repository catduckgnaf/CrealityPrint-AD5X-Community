import {isGroup,type Project,type ShapeNode,type GroupNode} from "../types/scene";
import {newId} from "./id";
import { basicBox, identifyShell } from "./boxFitTools";
import {useScene} from "../state/store";
import {isGeneratedDividerLayer} from "./generatedFeatures";

/** Axis is the coordinate the divider moves across; the wall spans the other axis. */
export type DividerPlacementAxis = "x" | "y";
export type DividerPlacementPoint = [number,number];
export const DIVIDER_DEFAULT_THICKNESS_MM=1.6;
export const DIVIDER_DEFAULT_TOP_GAP_MM=2;

/** The exact floor height used for the native viewport picking plane. */
export function dividerPlacementFloor(project:Project,rootId:string):number {
 const shell=identifyShell(rootId,project);
 return shell.bottom+shell.floor;
}

/** Pure placement calculation: leaves project and nested solid/cutter groups untouched. */
export function planManualDivider(project:Project,rootId:string,axis:DividerPlacementAxis,
 point:DividerPlacementPoint,wall=DIVIDER_DEFAULT_THICKNESS_MM,
 topGap=DIVIDER_DEFAULT_TOP_GAP_MM):ShapeNode {
 if(axis!=="x"&&axis!=="y")throw new Error("Choose a valid divider direction.");
 if(point.length!==2||point.some(v=>!Number.isFinite(v)))throw new Error("Click a valid point inside the tray.");
 const shell=identifyShell(rootId,project);
 const iw=Number(shell.cavity.params.w),id=Number(shell.cavity.params.d);
 if(!Number.isFinite(wall)||wall<0.8||wall>6)throw new Error("Divider thickness must be 0.8–6 mm.");
 if(!Number.isFinite(topGap)||topGap<0.5||topGap>12)throw new Error("Top gap must be 0.5–12 mm.");
 const height=shell.height-shell.floor-topGap+0.5;
 if(height<=1.5||!Number.isFinite(height))throw new Error("The tray is too shallow for a divider.");
 const [x,y]=point;
 const minX=shell.cx-iw/2,maxX=shell.cx+iw/2;
 const minY=shell.cy-id/2,maxY=shell.cy+id/2;
 if(x<minX||x>maxX||y<minY||y>maxY)
  throw new Error("Click on the inside floor of the tray, not outside its walls.");
 // Keep a minimum usable compartment of 2 mm between wall and divider.
 const coord=axis==="x"?x:y;
 const min=axis==="x"?minX:minY,max=axis==="x"?maxX:maxY;
 const inset=wall/2+2;
 if(coord<min+inset||coord>max-inset)
  throw new Error("Click a little farther from the side wall to leave room for a compartment.");
 const z=shell.bottom+shell.floor-0.5+height/2; // Same floor/wall overlap as generated dividers.
 const shape=axis==="x"
  ?basicBox(wall,id+0.65,height,x,shell.cy,z)
  :basicBox(iw+0.65,wall,height,shell.cx,y,z);
 shape.label=axis==="x"?"Lengthwise divider":"Widthwise divider";
 return shape;
}

/**
 * Reuse an existing group when there are already dividers. Adding five
 * manually positioned walls must NOT create five new nested wrappers.
 * All changes are immutable and become one normal store Undo step.
 */
export function planManualDividerInsertion(project:Project,rootId:string,axis:DividerPlacementAxis,
 point:DividerPlacementPoint):{project:Project,selectionId:string,dividerId:string}{
 const shape=planManualDivider(project,rootId,axis,point);
 let currentId=rootId;
 const seen=new Set<string>();
 for(let depth=0;depth<12;depth++){
  if(seen.has(currentId))throw new Error("Invalid nested group.");
  seen.add(currentId);
  const current=project.nodes[currentId];
  if(!current||!isGroup(current))break;
  if(isGeneratedDividerLayer(current,project)){
   const group:GroupNode={...current,label:"Box with dividers",feature:"divider-layer",
    childIds:[...current.childIds,shape.id]};
   return {project:{...project,nodes:{...project.nodes,[shape.id]:shape,[current.id]:group}},
    selectionId:rootId,dividerId:shape.id};
  }
  const next=project.nodes[current.childIds[0]];
  if(!next||!isGroup(next))break;
  currentId=next.id;
 }
 // First divider: one safe Boolean wrapper around the selected top-level shell.
 const id=newId();
 const wrapper:GroupNode={id,type:"group",label:"Box with dividers",feature:"divider-layer",childIds:[rootId,shape.id],
  position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]};
 return {project:{...project,nodes:{...project.nodes,[shape.id]:shape,[id]:wrapper},
  rootOrder:project.rootOrder.map(r=>r===rootId?id:r)},
  selectionId:id,dividerId:shape.id};
}

/** Optional precision snapping to 1 mm and the cavity centreline.
 * Snapping affects only the short axis; walls remain full-length and centred.
 */
export function snapDividerPoint(project:Project,rootId:string,axis:DividerPlacementAxis,
 point:DividerPlacementPoint,enabled=true):DividerPlacementPoint {
 if(!enabled)return point;
 const shell=identifyShell(rootId,project);
 const index=axis==="x"?0:1;
 const centre=index===0?shell.cx:shell.cy;
 const relative=point[index]-centre;
 const snapped=Math.abs(relative)<2 ? centre : centre+Math.round(relative);
 const next=[...point] as DividerPlacementPoint;
 next[index]=snapped;
 return next;
}

/** One safe, reversible store transaction; preserve all existing cutter groups. */
export function addManualDivider(rootId:string,axis:DividerPlacementAxis,point:DividerPlacementPoint):string{
 let selected=rootId;
 useScene.setState(state=>{
  const plan=planManualDividerInsertion(state.project,rootId,axis,point);
  selected=plan.selectionId;
  return {project:plan.project,selection:[plan.selectionId]};
 });
 return selected;
}