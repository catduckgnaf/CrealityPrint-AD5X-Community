import {isGroup, type Project} from "../types/scene";
import {isGeneratedDividerLayer} from "./generatedFeatures";

/** A stable path from root to a node; never mutates the project. */
export function groupPath(project: Pick<Project,"nodes"|"rootOrder">, id:string):string[] {
 const visit=(cur:string,parents:string[],seen:Set<string>):string[]=>{
  if(seen.has(cur))return [];
  const n=project.nodes[cur];if(!n)return [];
  const path=[...parents,cur];
  if(cur===id)return path;
  if(!isGroup(n))return [];
  const next=new Set(seen);next.add(cur);
  for(const child of n.childIds){
   const hit=visit(child,path,next);
   if(hit.length)return hit;
  }
  return [];
 };
 for(const root of project.rootOrder){
  const hit=visit(root,[],new Set());
  if(hit.length)return hit;
 }
 return [];
}
export function containsCutters(project:Pick<Project,"nodes">,id:string):boolean{
 const visit=(id:string,seen:Set<string>):boolean=>{
  if(seen.has(id))return false;
  const n=project.nodes[id];if(!n)return false;
  if(!isGroup(n))return n.role==="hole";
  seen.add(id);
  return n.childIds.some(x=>visit(x,seen));
 };
 return visit(id,new Set());
}
export function isBooleanGroup(project:Pick<Project,"nodes">,id:string):boolean{
 const root=project.nodes[id];
 return !!root&&isGroup(root)&&containsCutters(project,id);
}
export function groupDisplay(project:Pick<Project,"nodes">,id:string):string{
 const n=project.nodes[id];if(!n)return "Object";
 if(n.label)return n.label;
 return isGroup(n)?"Group ("+n.childIds.length+" parts)":n.kind.replace(/-/g," ");
}
export function parentGroupPath(project:Pick<Project,"nodes"|"rootOrder">,id:string):string[]{
 const path=groupPath(project,id);
 return path.length?path.slice(0,-1):[];
}

/**
 * Only recognises a shell-like solid-box minus taller cavity-box relationship.
 * This is for showing contextual options, not permission to change geometry.
 * identifyShell remains the strict safety gate for every destructive operation.
 */
export function resemblesHollowBox(project:Pick<Project,"nodes">,id:string):boolean{
 const seen=new Set<string>();
 const visit=(key:string):boolean=>{
  if(seen.has(key))return false;
  seen.add(key);
  const node=project.nodes[key];
  if(!node||!isGroup(node))return false;
  const direct=node.childIds.map(child=>project.nodes[child]).filter(Boolean);
  const solids=direct.filter(child=>!isGroup(child!) && child!.kind==="box" && child!.role==="solid");
  const holes=direct.filter(child=>!isGroup(child!) && child!.kind==="box" && child!.role==="hole");
  for(const outer of solids){
   for(const cavity of holes){
    if(isGroup(outer!)||isGroup(cavity!))continue;
    const ow=Number(outer!.params.w),od=Number(outer!.params.d),oh=Number(outer!.params.h);
    const iw=Number(cavity!.params.w),id=Number(cavity!.params.d),ih=Number(cavity!.params.h);
    const floor=cavity!.position[2]-ih/2-(outer!.position[2]-oh/2);
    const top=cavity!.position[2]+ih/2-(outer!.position[2]+oh/2);
    if([ow,od,oh,iw,id,ih,floor,top].every(Number.isFinite)&&
       ow>iw+1&&od>id+1&&floor>0.1&&floor<oh-0.5&&top>=0.5&&
       Math.abs(outer!.position[0]-cavity!.position[0])<0.1&&
       Math.abs(outer!.position[1]-cavity!.position[1])<0.1)return true;
   }
  }
  return node.childIds.some(child=>visit(child));
 };
 return visit(id);
}
/** Selects an existing divider without breaking or ungrouping its shell. */
export function findDividerEditTarget(project:Pick<Project,"nodes">,id:string):{parentId:string;dividerId:string}|null{
 const seen=new Set<string>();
 let current=id;
 for(let depth=0;depth<10;depth++){
  if(seen.has(current))return null;
  seen.add(current);
  const node=project.nodes[current];
  if(!node||!isGroup(node)||node.hidden||node.locked)return null;
  if(isGeneratedDividerLayer(node,project)&&node.childIds.length>1){
   const shellId=node.childIds[0];
   if(!containsCutters(project,shellId))return null;
   const dividerId=node.childIds.slice(1).find(childId=>{
    const child=project.nodes[childId];
    return !!child&&!isGroup(child)&&child.kind==="box"&&child.role==="solid"&&!child.hidden&&!child.locked;
   });
   if(dividerId)return {parentId:node.id,dividerId};
  }
  const first=project.nodes[node.childIds[0]];
  if(!first||!isGroup(first))return null;
  current=first.id;
 }
 return null;
}