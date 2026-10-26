import {isGroup,type Project,type GroupNode,type Vec3} from "../types/scene";
import {groupPath,containsCutters} from "./groupWorkflow";
import {identifyShell} from "./boxFitTools";
import {inspectDividerSet,selectedDividerContext} from "./dividerManagement";
import {isGeneratedDividerLayer,partialDividerAxis} from "./generatedFeatures";

export type DividerDistanceInfo={
 id:string; groupId:string; axis:"x"|"y"; fromMin:number; fromMax:number;
 cavityMin:number;cavityMax:number; centre:number; width:number;
};
const near=(x:number,y:number)=>Math.abs(x-y)<0.00001;
const identity=(n:GroupNode)=>!n.locked&&!n.hidden&&
 n.rotation.every(n=>near(n,0))&&n.scale.every(n=>near(n,1))&&
 n.position.every(n=>near(n,0));

/** Measured from the cavity's inner wall faces to this divider's faces. */
export function dividerDistanceInfo(project:Project,id:string):DividerDistanceInfo|null{
 const context=selectedDividerContext(project,id);
 if(!context)return null;
 const n=project.nodes[id];
 if(!n||isGroup(n)||n.kind!=="box"||n.role!=="solid")return null;
 const spec=inspectDividerSet(project,context.groupId);
 const axis=spec.xIds.includes(id)?"x":spec.yIds.includes(id)?"y":null;
 if(!axis)return null;
 const min=axis==="x"?spec.xMin:spec.yMin,max=axis==="x"?spec.xMax:spec.yMax;
 const centre=n.position[axis==="x"?0:1],width=Number(n.params[axis==="x"?"w":"d"]);
 return {id,groupId:context.groupId,axis,fromMin:centre-width/2-min,
  fromMax:max-centre-width/2,cavityMin:min,cavityMax:max,centre,width};
}

/** Shared Inspector/Gizmo/keyboard guard. Only affects recognised divider solids.
 * Non-divider CAD objects remain free to move normally. The divider keeps its
 * original Z, rotation and scale; it only moves across the cavity's short axis.
 */
export function constrainDividerPosition(project:Project,id:string,wanted:Vec3):Vec3|null{
 const info=dividerDistanceInfo(project,id);
 if(!info)return null;
 const node=project.nodes[id];
 if(isGroup(node))return null;
 const axisIndex=info.axis==="x"?0:1, longIndex=axisIndex===0?1:0;
 const path=groupPath(project,id);
 if(!path.length)throw new Error("Divider is no longer attached to the project.");
 const shell=identifyShell(path[0],project);
 const lengthwiseCentre=info.axis==="x"?shell.cy:shell.cx;
 const margin=info.width/2+2;
 const coordinate=Number.isFinite(wanted[axisIndex])?wanted[axisIndex]:node.position[axisIndex];
 const safe=Math.max(info.cavityMin+margin,Math.min(info.cavityMax-margin,coordinate));
 if(info.cavityMax-info.cavityMin < 2*margin)throw new Error("Not enough inside space to move this divider.");
 const next=[...node.position] as Vec3;
 next[axisIndex]=safe;
 next[longIndex]=lengthwiseCentre;
 // Never raise a wall off the floor, rotate it or stretch it by moving a gizmo.
 return next;
}

type Layer={id:string;node:GroupNode;dividerIds:string[]};
const isDividerLayer=(project:Project,n:GroupNode)=>isGeneratedDividerLayer(n,project);

/** Read-only inspection of nested auto-generated divider wrappers. Does NOT
 * include a user's labelled group, lid, text cutter or original hollow shell.
 */
export function dividerLayers(project:Project,selectedId:string):Layer[]{
 if(!groupPath(project,selectedId).length)return [];
 const chain:Layer[]=[];
 const seen=new Set<string>();
 let id=selectedId;
 for(let depth=0;depth<18;depth++){
  if(seen.has(id))throw new Error("Cyclic group hierarchy.");
  seen.add(id);
  const node=project.nodes[id];
  if(!node||!isGroup(node))break;
  if(!identity(node)){
   if(isDividerLayer(project,node)||chain.length)throw new Error("Transformed or locked divider group cannot be consolidated.");
   break;
  }
  if(isDividerLayer(project,node)){
   const direct=node.childIds.slice(1);
   if(direct.some(x=>{
    const part=project.nodes[x];
    return !part||isGroup(part)||part.role!=="solid"||part.kind!=="box"||part.locked||part.hidden;
   }))throw new Error("This group contains custom or protected shapes; it cannot be consolidated.");
   chain.push({id,node,dividerIds:direct});
  }
  const next=project.nodes[node.childIds[0]];
  if(!next||!isGroup(next))break;
  if(!isDividerLayer(project,node)&&chain.length>0)break;
  id=next.id;
 }
 return chain;
}

/** Explicit and Undo-able cleanup of known auto-generated wrapper layers.
 * Preserve IDs of every solid, cutter, original hollow box and label.
 * Only obsolete auto-generated wrapper group IDs are removed.
 */
export function consolidateDividerLayers(project:Project,selectedId:string):
 {project:Project,removedWrappers:number,dividerCount:number}{
 const chain=dividerLayers(project,selectedId);
 if(chain.length<2)return {project,removedWrappers:0,dividerCount:chain.reduce((n,x)=>n+x.dividerIds.length,0)};
 // Strict box validation; never flatten a transformed shell, lid or custom cutter.
 const shell=identifyShell(selectedId,project);
 const w=Number(shell.cavity.params.w),d=Number(shell.cavity.params.d);
 const ids=chain.flatMap(layer=>layer.dividerIds);
 const unique=new Set(ids);
 if(ids.length!==unique.size)throw new Error("Duplicate divider reference found.");
 for(const id of ids){
  const node=project.nodes[id];
  if(!node||isGroup(node)||node.kind!=="box")throw new Error("Unexpected divider node.");
  const acrossY=Number(node.params.w)<=6&&Math.abs(Number(node.params.d)-d)<2;
  const acrossX=Number(node.params.d)<=6&&Math.abs(Number(node.params.w)-w)<2;
  const partial=partialDividerAxis(node);
  const safePartial=partial!==null&&Number(node.params.h)>1&&
    node.position[0]>=shell.cx-w/2&&node.position[0]<=shell.cx+w/2&&
    node.position[1]>=shell.cy-d/2&&node.position[1]<=shell.cy+d/2&&
    ((partial==="x"&&Number(node.params.w)<=6&&Number(node.params.d)<=d+0.8)||
     (partial==="y"&&Number(node.params.d)<=6&&Number(node.params.w)<=w+0.8));
  if(acrossX===acrossY&&!safePartial)throw new Error("An incompatible divider cannot be consolidated.");
 }
 const bottomId=chain[chain.length-1].node.childIds[0];
 if(!containsCutters(project,bottomId))throw new Error("Original hollow cutter is missing.");
 const nodes={...project.nodes};
 const outer=chain[0].node;
 nodes[outer.id]={...outer,label:ids.length?"Box with dividers":"Box (dividers removed)",
  childIds:[bottomId,...ids]};
 for(const inner of chain.slice(1))delete nodes[inner.id];
 return {project:{...project,nodes},removedWrappers:chain.length-1,dividerCount:ids.length};
}

/** Delete all compatible divider layers in one Undo step, without deleting or
 * flattening the original solid/cavity Boolean group or its outer labels.
 */
export function deleteAllDividerLayers(project:Project,selectedId:string){
 const merged=consolidateDividerLayers(project,selectedId);
 const layers=dividerLayers(merged.project,selectedId);
 if(!layers.length||!layers[0].dividerIds.length)
  throw new Error("No editable dividers found.");
 const layer=layers[0],parts=layer.dividerIds;
 const parent=merged.project.nodes[layer.id];
 if(!parent||!isGroup(parent))throw new Error("Original divider group missing.");
 const nodes={...merged.project.nodes};
 for(const id of parts)delete nodes[id];
 nodes[parent.id]={...parent,label:"Box (dividers removed)",childIds:parent.childIds.filter(id=>!parts.includes(id))};
 return {project:{...merged.project,nodes},removed:parts.length,selectionId:parent.id,
  removedWrappers:merged.removedWrappers};
}
/** Explicit deletion of a generated partial divider without touching cutters. */
export function deletePartialDivider(project:Project,id:string){
 const path=groupPath(project,id);
 if(path.length<2)throw new Error("Select a partial divider inside its group.");
 const n=project.nodes[id],parent=project.nodes[path[path.length-2]];
 if(!n||isGroup(n)||n.role!=="solid"||!partialDividerAxis(n)||
    !parent||!isGroup(parent)||!isGeneratedDividerLayer(parent,project)||!parent.childIds.slice(1).includes(id))
  throw new Error("Only generated partial dividers can be removed with this tool.");
 const nodes={...project.nodes};
 delete nodes[id];
 const other=parent.childIds.slice(1).filter(v=>v!==id);
 nodes[parent.id]={...parent,label:other.length?"Box with dividers":"Box (dividers removed)",
  childIds:[parent.childIds[0],...other]};
 return {project:{...project,nodes},selectionId:parent.id};
}