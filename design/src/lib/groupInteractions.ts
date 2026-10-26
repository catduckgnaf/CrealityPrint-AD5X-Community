import {useScene} from "../state/store";
import {groupPath} from "./groupWorkflow";
import {isGroup} from "../types/scene";

/** Going out one level keeps the grouped part selected; the user never
 * loses the whole object after editing a child. */
export function finishGroupEdit(){
 const s=useScene.getState();
 if(!s.editingGroupId)return;
 const path=groupPath(s.project,s.editingGroupId);
 const old=s.editingGroupId;
 if(path.length>1){
  s.setEditingGroup(path[path.length-2]);
  useScene.getState().select(old,false);
 }else{
  s.setEditingGroup(null);
  useScene.getState().select(old,false);
 }
}
/** Tree navigation never selects an invisible child of a combined Boolean
 * mesh. It first activates the immediate parent as a real rendered edit level. */
export function selectFromObjectTree(id:string,additive=false){
 const s=useScene.getState();
 const path=groupPath(s.project,id);
 if(!path.length)return;
 if(path.length===1){
  if(s.editingGroupId)s.setEditingGroup(null);
  useScene.getState().select(id,additive);
  return;
 }
 const parent=path[path.length-2];
 if(!isGroup(s.project.nodes[parent]))return;
 if(s.editingGroupId!==parent)s.setEditingGroup(parent);
 useScene.getState().select(id,additive && s.editingGroupId===parent);
}
export function openGroupForEditing(id:string){
 const s=useScene.getState();
 const n=s.project.nodes[id];
 if(!n||!isGroup(n)||n.locked||n.hidden)return;
 if(!groupPath(s.project,id).length)return;
 s.setEditingGroup(id);
}
