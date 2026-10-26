import {isGroup,type Project} from "../types/scene";
import {identifyShell} from "./boxFitTools";

/** Resolve an editable hollow-box root from a selected child or divider.
 * Does not reinterpret arbitrary groups or bypass existing shell validation.
 */
export function resolveWorkshopShell(project:Project,selectedId:string|null):string|null{
 if(!selectedId || !project.nodes[selectedId])return null;
 for(const rootId of project.rootOrder){
  const visited=new Set<string>();
  const stack=[rootId];
  let contains=false;
  while(stack.length){
   const id=stack.pop()!;
   if(visited.has(id))continue;
   visited.add(id);
   if(id===selectedId){contains=true;break;}
   const node=project.nodes[id];
   if(node&&isGroup(node))stack.push(...node.childIds);
  }
  if(!contains)continue;
  try{identifyShell(rootId,project);return rootId;}catch{return null;}
 }
 return null;
}
