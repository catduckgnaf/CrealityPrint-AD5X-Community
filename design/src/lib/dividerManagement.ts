import { isGroup, type Project, type GroupNode, type ShapeNode } from "../types/scene";
import { groupPath, containsCutters } from "./groupWorkflow";
import {isGeneratedDividerLayer} from "./generatedFeatures";

type Axis = "x" | "y";
export interface DividerSet {
  groupId: string;
  shellId: string;
  dividerIds: string[];
  xIds: string[];
  yIds: string[];
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

const near=(a:number,b:number,epsilon=0.02)=>Math.abs(a-b)<=epsilon;
const zero=(values:number[])=>values.every(v=>Number.isFinite(v)&&near(v,0,0.00001));
const unit=(values:number[])=>values.every(v=>Number.isFinite(v)&&near(v,1,0.00001));
const safeGroup=(node:GroupNode)=>!node.hidden&&!node.locked&&zero(node.rotation)&&unit(node.scale);
const safeBox=(node:ShapeNode)=>node.kind==="box"&&!node.hidden&&!node.locked&&zero(node.rotation)&&unit(node.scale);
const asGroup=(project:Project,id:string):GroupNode=>{
 const n=project.nodes[id];
 if(!n||!isGroup(n))throw new Error("Select a group containing dividers.");
 return n;
};

/**
 * Validate provenance and the complete Boolean group path before changing any geometry.
 * Positions of dividers and shell must be in the same local coordinate system.
 * Rotated/scaled ancestors and mixed or partial dividers are intentionally not altered.
 */
export function inspectDividerSet(project:Project,selectionId:string):DividerSet{
 const path=groupPath(project,selectionId);
 if(!path.length)throw new Error("This group is not attached to the current project.");
 for(const id of path){
  const node=project.nodes[id];
  if(isGroup(node)&&!safeGroup(node))throw new Error("Locked, hidden, rotated or scaled groups cannot be re-spaced automatically.");
 }
 let candidate=asGroup(project,selectionId);
 const visited=new Set<string>();
 for(let i=0;i<9 && !(isGeneratedDividerLayer(candidate,project)&&candidate.childIds.length>1);i++){
  if(visited.has(candidate.id))throw new Error("Invalid group nesting.");
  visited.add(candidate.id);
  const first=project.nodes[candidate.childIds[0]];
  if(!first||!isGroup(first))throw new Error("This group has no recognized divider layout.");
  candidate=first;
  if(!safeGroup(candidate))throw new Error("The divider group is transformed or locked.");
 }
 if(!isGeneratedDividerLayer(candidate,project)||candidate.childIds.length<2)
   throw new Error("No existing divider layout was found.");
 const shellId=candidate.childIds[0];
 if(!containsCutters(project,shellId))throw new Error("The hollow box cutter is missing.");
 let cur=asGroup(project,shellId);
 let dx=0,dy=0;
 const seen=new Set<string>();
 let outer:ShapeNode|null=null,cavity:ShapeNode|null=null;
 for(let i=0;i<10;i++){
  if(seen.has(cur.id)||!safeGroup(cur))throw new Error("A transformed or invalid shell cannot be re-spaced.");
  seen.add(cur.id);
  dx+=cur.position[0];dy+=cur.position[1];
  const children=cur.childIds.map(id=>project.nodes[id]);
  if(children.length===2&&children.every(n=>!!n&&!isGroup(n))){
    outer=children.find(n=>!isGroup(n!)&&n!.role==="solid"&&n!.kind==="box") as ShapeNode|undefined ?? null;
    cavity=children.find(n=>!isGroup(n!)&&n!.role==="hole"&&n!.kind==="box") as ShapeNode|undefined ?? null;
    break;
  }
  const child=children[0];
  if(!child||!isGroup(child))throw new Error("The original Boolean shell structure is different.");
  cur=child;
 }
 if(!outer||!cavity||!safeBox(outer)||!safeBox(cavity))
   throw new Error("A safe rectangular hollow box was not found.");
 const width=Number(cavity.params.w),depth=Number(cavity.params.d);
 if(!Number.isFinite(width)||!Number.isFinite(depth)||width<=2||depth<=2||
    Number(outer.params.w)<=width||Number(outer.params.d)<=depth ||
    !near(outer.position[0],cavity.position[0])||!near(outer.position[1],cavity.position[1]))
   throw new Error("The cavity boundaries could not be verified.");
 const cx=dx+cavity.position[0], cy=dy+cavity.position[1];
 const xMin=cx-width/2, xMax=cx+width/2;
 const yMin=cy-depth/2, yMax=cy+depth/2;
 const dividerIds=candidate.childIds.slice(1);
 const xIds:string[]=[],yIds:string[]=[];
 for(const id of dividerIds){
  const n=project.nodes[id];
  if(!n||isGroup(n)||n.role!=="solid"||!safeBox(n))
    throw new Error("Some divider parts are locked, hidden or incompatible; no edits made.");
  const w=Number(n.params.w),d=Number(n.params.d);
  if(!Number.isFinite(w)||!Number.isFinite(d)||w<=0||d<=0||
     !n.position.every(Number.isFinite))
    throw new Error("Invalid divider dimensions.");
  const acrossY=w<=6&&w<width/2&&Math.abs(d-depth)<=2;
  const acrossX=d<=6&&d<depth/2&&Math.abs(w-width)<=2;
  if(acrossY===acrossX)throw new Error("An angled, short or mixed divider cannot be spaced safely.");
  (acrossY?xIds:yIds).push(id);
 }
 return {groupId:candidate.id,shellId,dividerIds,xIds,yIds,xMin,xMax,yMin,yMax};
}

const arrange=(project:Project,ids:string[],axis:Axis,min:number,max:number,longAxisCentre:number,changes:Map<string,[number,number,number]>)=>{
 const sorted=[...ids].sort((a,b)=>project.nodes[a].position[axis==="x"?0:1]-project.nodes[b].position[axis==="x"?0:1]||a.localeCompare(b));
 const sizes=sorted.map(id=>{
  const n=project.nodes[id];
  if(isGroup(n))throw new Error("Unexpected divider group.");
  return Number(n.params[axis==="x"?"w":"d"]);
 });
 const gap=(max-min-sizes.reduce((a,b)=>a+b,0))/(sorted.length+1);
 if(sorted.length&&(!Number.isFinite(gap)||gap<0.4))throw new Error("Not enough space for equally sized compartments.");
 let cursor=min+gap;
 sorted.forEach((id,index)=>{
  const node=project.nodes[id];
  const centre=cursor+sizes[index]/2;
  const coord=axis==="x"?0:1;
  const longAxis=coord===0?1:0;
  if(Math.abs(node.position[coord]-centre)>0.000001 ||
     Math.abs(node.position[longAxis]-longAxisCentre)>0.000001){
   // Full-span dividers MUST stay centred along their long axis.
   // Legacy generic spacing could displace this axis and push walls outside the shell.
   const position=[...node.position] as [number,number,number];
   position[coord]=centre;
   position[longAxis]=longAxisCentre;
   changes.set(id,position);
  }
  cursor+=sizes[index]+gap;
 });
};

/** Single immutable project edit: one Undo step for both divider directions. */
export function equalizeDividers(project:Project,rootId:string):{project:Project,moved:number}{
 const parts=inspectDividerSet(project,rootId);
 // The user may have added dividers more than once. Each successive operation
 // wraps the previous Boolean box. Space ALL compatible divider layers together.
 const allX=[...parts.xIds],allY=[...parts.yIds];
 const seen=new Set(parts.dividerIds);
 let innerId=parts.shellId;
 for(let depth=0;depth<12;depth++){
  const inner=project.nodes[innerId];
  if(!inner||!isGroup(inner))break;
  if(!isGeneratedDividerLayer(inner,project))break;
  if(inner.position.some(v=>!near(v,0,0.00001)))
   throw new Error("Nested translated divider groups need manual alignment first.");
  if(inner.childIds.length>1){
   const nested=inspectDividerSet(project,innerId);
   if(!near(nested.xMin,parts.xMin)||!near(nested.xMax,parts.xMax)||
      !near(nested.yMin,parts.yMin)||!near(nested.yMax,parts.yMax))
    throw new Error("Nested divider groups do not share the same cavity.");
   for(const id of nested.xIds)if(!seen.has(id)){seen.add(id);allX.push(id);}
   for(const id of nested.yIds)if(!seen.has(id)){seen.add(id);allY.push(id);}
  }
  innerId=inner.childIds[0];
 }
 const changes=new Map<string,[number,number,number]>();
 arrange(project,allX,"x",parts.xMin,parts.xMax,(parts.yMin+parts.yMax)/2,changes);
 arrange(project,allY,"y",parts.yMin,parts.yMax,(parts.xMin+parts.xMax)/2,changes);
 if(!changes.size)return {project,moved:0};
 const nodes={...project.nodes};
 for(const [id,position] of changes){
  const node=nodes[id];
  if(isGroup(node))throw new Error("Divider layout changed during editing.");
  nodes[id]={...node,position};
 }
 return {project:{...project,nodes},moved:changes.size};
}

/** Delete only one validated divider, or all of them. Never remove the Boolean shell/cutter. */
export function removeDividerSolids(project:Project,rootId:string,oneId?:string):{project:Project,removed:number,selectionId:string}{
 const parts=inspectDividerSet(project,rootId);
 const ids=oneId?[oneId]:parts.dividerIds;
 if(!ids.length||ids.some(id=>!parts.dividerIds.includes(id)))
  throw new Error("Select an existing divider; the shell and cutters cannot be deleted here.");
 const parent=asGroup(project,parts.groupId);
 const nodes={...project.nodes};
 for(const id of ids)delete nodes[id];
 nodes[parent.id]={...parent,childIds:parent.childIds.filter(id=>!ids.includes(id)),
  ...(ids.length===parts.dividerIds.length?{label:"Box (dividers removed)"}:{})};
 return {project:{...project,nodes},removed:ids.length,selectionId:parent.id};
}

/** Detect a directly selected divider while editing its original group. */
export function selectedDividerContext(project:Project,shapeId:string):{groupId:string,dividerId:string}|null{
 const path=groupPath(project,shapeId);
 if(path.length<2)return null;
 const parentId=path[path.length-2];
 try{
  const parts=inspectDividerSet(project,parentId);
  return parts.groupId===parentId&&parts.dividerIds.includes(shapeId)?
   {groupId:parentId,dividerId:shapeId}:null;
 }catch{return null;}
}
/**
 * Generic precision spacing distributes objects in world coordinates, which is
 * dangerous for full-length dividers nested in a hollow Boolean group.
 * Keep that command available for other objects, but direct divider users to
 * the dedicated cavity-aware Group > Space dividers equally action.
 */
export function containsManagedDivider(project:Project,ids:readonly string[]):boolean{
 return ids.some(id=>{
  const path=groupPath(project,id);
  if(path.length<2)return false;
  const parent=project.nodes[path[path.length-2]];
  const shape=project.nodes[id];
  return !!parent&&isGroup(parent)&&isGeneratedDividerLayer(parent,project)&&
    parent.childIds.slice(1).includes(id)&&!!shape&&!isGroup(shape)&&shape.kind==="box"&&shape.role==="solid";
 });
}