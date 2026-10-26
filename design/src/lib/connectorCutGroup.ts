import {newId} from "./id";
import {isGroup,nodeRole,type GroupNode,type Project,type ShapeNode} from "../types/scene";

/** Keep all cutters of one connector as a single movable subassembly.
 * The enclosing Boolean target stays a single editable print part.
 * Centring the hole group's local frame makes dragging it intuitive;
 * group translation moves ALL cutters while their spacing is unchanged.
 */
export function bundleConnectorCutters(
 project:Project,
 targetGroupId:string,
 cutters:readonly ShapeNode[],
 label:string,
):{project:Project;groupId:string}{
 if(cutters.length===0||!cutters.every(n=>n.role==="hole"))
  throw new Error("Connector group requires hole cutters.");
 const target=project.nodes[targetGroupId];
 if(!target||!isGroup(target))
  throw new Error("Connector cutouts must belong to an editable model group.");
 const cutterIds=new Set(cutters.map(n=>n.id));
 if(cutterIds.size!==cutters.length||!cutters.every(n=>target.childIds.includes(n.id)))
  throw new Error("The connector cuts must all belong to the selected model.");
 if(!cutters.every(n=>n.position.every(Number.isFinite)))
  throw new Error("Connector position contains invalid coordinates.");
 const center:[number,number,number]=[0,0,0];
 for(const cutter of cutters){
  center[0]+=cutter.position[0]/cutters.length;
  center[1]+=cutter.position[1]/cutters.length;
  center[2]+=cutter.position[2]/cutters.length;
 }
 const gid=newId();
 const group:GroupNode={
  id:gid,type:"group",label,
  childIds:cutters.map(n=>n.id),
  position:center,rotation:[0,0,0],scale:[1,1,1],
 };
 if(project.nodes[gid])throw new Error("Group ID collision.");
 const nodes={...project.nodes,[gid]:group};
 for(const cutter of cutters){
  nodes[cutter.id]={...cutter,position:[
   cutter.position[0]-center[0],
   cutter.position[1]-center[1],
   cutter.position[2]-center[2],
  ]};
 }
 nodes[targetGroupId]={...target,childIds:[
  ...target.childIds.filter(id=>!cutterIds.has(id)),gid,
 ]};
 const updated={...project,nodes};
 if(nodeRole(group,updated.nodes)!=="hole")
  throw new Error("Connector group must remain subtractive.");
 return {project:updated,groupId:gid};
}

/** Locate a DB9 made by a previous build, when its opening and screw holes
 * were siblings and could only be moved one at a time.
 * Strict geometry/label matching prevents bundling unrelated holes.
 */
export function findUngroupedDB9(
 project:Project,selectionId:string,
):{parentId:string;cutters:[ShapeNode,ShapeNode,ShapeNode];gender:"male"|"female"}|null{
 const selected=project.nodes[selectionId];
 if(!selected)return null;
 const visit=(id:string,seen:Set<string>):
  {parentId:string;cutters:[ShapeNode,ShapeNode,ShapeNode];gender:"male"|"female"}|null=>{
  if(seen.has(id))return null;
  seen.add(id);
  const parent=project.nodes[id];
  if(!parent||!isGroup(parent))return null;
  // Do not regroup the already movable hole-only assemblies.
  if(nodeRole(parent,project.nodes)==="solid"){
   for(const childId of parent.childIds){
    const base=project.nodes[childId];
    if(!base||isGroup(base)||base.kind!=="sketch"||base.role!=="hole")continue;
    const match=/^DB9 (male|female) D-shaped panel opening$/.exec(base.label??"");
    if(!match)continue;
    const gender=match[1] as "male"|"female";
    const findScrew=(which:1|2)=>{
     const label="DB9 "+gender+" screw hole "+which;
     return parent.childIds.map(id=>project.nodes[id]).filter(
      (n):n is ShapeNode=>!!n&&!isGroup(n)&&n.role==="hole"&&n.kind==="cylinder"&&n.label===label
     );
    };
    const one=findScrew(1),two=findScrew(2);
    if(one.length!==1||two.length!==1)continue;
    const a=one[0],b=two[0];
    if(![base,a,b].every(n=>n.position.every(Number.isFinite)))continue;
    const center=base.position,half=12.5,eps=0.06;
    const side=(
      Math.abs(a.position[0]-(center[0]-half))<eps&&
      Math.abs(b.position[0]-(center[0]+half))<eps&&
      Math.abs(a.position[1]-center[1])<eps&&
      Math.abs(b.position[1]-center[1])<eps&&
      Math.abs(a.position[2]-center[2])<eps&&
      Math.abs(b.position[2]-center[2])<eps
    )||(
      Math.abs(a.position[1]-(center[1]-half))<eps&&
      Math.abs(b.position[1]-(center[1]+half))<eps&&
      Math.abs(a.position[0]-center[0])<eps&&
      Math.abs(b.position[0]-center[0])<eps&&
      Math.abs(a.position[2]-center[2])<eps&&
      Math.abs(b.position[2]-center[2])<eps
    );
    if(side)return {parentId:id,cutters:[base,a,b],gender};
   }
  }
  for(const childId of parent.childIds){
   const n=project.nodes[childId];
   if(n&&isGroup(n)){
    const found=visit(childId,seen);
    if(found)return found;
   }
  }
  return null;
 };
 return visit(selectionId,new Set());
}
export function groupUngroupedDB9(
 project:Project,selectionId:string,
):{project:Project;groupId:string;parentId:string}{
 const found=findUngroupedDB9(project,selectionId);
 if(!found)throw new Error("No ungrouped DB9 opening and screw-hole pair found.");
 const {project:next,groupId}=bundleConnectorCutters(project,found.parentId,found.cutters,
  "DB9 "+found.gender+" cutout");
 return {project:next,groupId,parentId:found.parentId};
}

