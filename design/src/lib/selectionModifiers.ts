/**
 * Shift is reserved for additive/toggle selection while editing.
 * Measurement clicks and the cruise-drag tool must not steal it.
 */
export function shouldMeasurePointer(measureMode: boolean, shiftKey: boolean): boolean {
  return measureMode && !shiftKey;
}

export function shouldCruiseDrag(
  cruiseMode: boolean,
  editingGroup: boolean,
  shiftKey: boolean,
): boolean {
  return cruiseMode && !editingGroup && !shiftKey;
}

export function shouldIgnoreMeshSelection(
  placing: boolean,
  measureMode: boolean,
  interactionCooldown: boolean,
  shiftKey: boolean,
): boolean {
  // Never turn a placement click into a selection, even with Shift held.
  if (placing) return true;
  // Shift-click always reaches the selection handler while measuring or
  // just after a gizmo gesture. Ordinary clicks keep their old behaviour.
  return (measureMode || interactionCooldown) && !shiftKey;
}
