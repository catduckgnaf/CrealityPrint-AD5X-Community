import {useScene} from "../state/store";
import {isGroup} from "../types/scene";
import {groupDisplay,groupPath,isBooleanGroup} from "../lib/groupWorkflow";
import {finishGroupEdit,openGroupForEditing} from "../lib/groupInteractions";
import {Boxes,Check,Layers3,Pencil,FolderTree} from "lucide-react";

/** One compact contextual control: no CAD jargon or exposed Boolean cutters
 * until the user deliberately chooses Edit Inside. */
export function GroupFocusControls(){
 const project=useScene(s=>s.project);
 const selection=useScene(s=>s.selection);
 const editingGroupId=useScene(s=>s.editingGroupId);
 const groupId=editingGroupId ??
   (selection.length===1&&isGroup(project.nodes[selection[0]])?selection[0]:null);
 if(!groupId)return null;
 const group=project.nodes[groupId];
 if(!group||!isGroup(group))return null;
 const editing=!!editingGroupId;
 const path=groupPath(project,groupId);
 const openObjects=()=>window.dispatchEvent(new Event("ad5x-open-explorer"));
 return <div className="design-group-focus" role="status" aria-label="Group controls">
  <div className="design-group-focus-info">
   <Boxes size={16}/>
   <strong>{groupDisplay(project,groupId)}</strong>
   <span>{group.childIds.length} parts</span>
   {editing&&path.length>1&&<span>Level {path.length}</span>}
  </div>
  {editing?<>
    <span className="design-group-hint">{isBooleanGroup(project,groupId)?"Pink = cutout · Done keeps the hollow shape":"Select a part · click empty space to finish"}</span>
    <button type="button" onClick={openObjects} title="Choose a part from the Objects list">
      <FolderTree size={15}/> Parts
    </button>
    <button type="button" className="primary" onClick={finishGroupEdit} title="Finish editing without ungrouping">
      <Check size={15}/> Done
    </button>
  </>:<>
    <span className="design-group-hint">
      {isBooleanGroup(project,groupId)?"Hollow / cut shapes stay connected":"Move as one object or edit its parts"}
    </span>
    <button type="button" onClick={openObjects} title="Show this group's parts">
      <Layers3 size={15}/> Parts
    </button>
    <button type="button" className="primary" onClick={()=>openGroupForEditing(groupId)}
      disabled={group.hidden||group.locked} title="Edit the shapes inside without ungrouping">
      <Pencil size={15}/> Edit Inside
    </button>
  </>}
 </div>;
}
