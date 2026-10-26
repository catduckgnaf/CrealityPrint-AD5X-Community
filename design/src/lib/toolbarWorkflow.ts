import {isGroup,type Project} from "../types/scene";
import {editablePattern} from "./editablePattern";

/** Context-specific availability; never enable geometry changes without suitable selection. */
export function toolbarWorkflowAvailability(
  selectionCount: number,
  editableBox: boolean,
  editablePattern: boolean,
) {
  return {
    holes: selectionCount === 1 && (editableBox || editablePattern),
    centre: selectionCount === 1 || selectionCount === 2,
    distance: selectionCount === 2,
    spacing: selectionCount >= 3,
  };
}
/** One source of truth shared by ToolbarWorkflow and CommandPalette.
 * Keep the existing selection rules, history and CAD actions unchanged.
 */
export function toolbarWorkflowAvailabilityFromSelection(
 selection:readonly string[], nodes:Project["nodes"]
):ReturnType<typeof toolbarWorkflowAvailability>{
 const one=selection.length===1?nodes[selection[0]]:undefined;
 const editableBox=!!one&&!isGroup(one)&&one.kind==="box"&&!one.locked;
 const hasEditablePattern=!!one&&isGroup(one)&&!one.locked&&!!editablePattern(one,nodes);
 return toolbarWorkflowAvailability(selection.length,editableBox,hasEditablePattern);
}

