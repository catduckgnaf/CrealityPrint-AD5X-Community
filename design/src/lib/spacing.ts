import * as THREE from "three";

export type SpacingAxis = 0 | 1;
export type SpacingMode = "center-xy" | "gap" | "center-distance" | "edge-center" | "even-margins" | "even-centers";
export type SpacingSide = "plus" | "minus";
export interface BoundsItem { id: string; box: THREE.Box3 }
export interface SpacingMove { id: string; delta: [number, number, number] }
export interface SpacingPlan { moves: SpacingMove[]; error?: string }
export type DistanceMode = "center-distance" | "gap" | "edge-center";

/**
 * Signed clearance measured in mm along the chosen axis and direction.
 * Uses world-space bounds, not positions/origins. A negative measurement
 * means the moving shape is on the opposite side or overlaps the reference.
 */
export function distanceBetween(
  reference: THREE.Box3,
  other: THREE.Box3,
  axis: SpacingAxis,
  side: SpacingSide,
  mode: DistanceMode,
): number {
  const midpoint = (box: THREE.Box3) => (
    box.min.getComponent(axis) + box.max.getComponent(axis)
  ) / 2;
  const targetEdge = side === "plus"
    ? reference.max.getComponent(axis)
    : reference.min.getComponent(axis);
  const first = mode === "center-distance" ? midpoint(reference) : targetEdge;
  const second = mode === "gap"
    ? (side === "plus" ? other.min.getComponent(axis) : other.max.getComponent(axis))
    : midpoint(other);
  return side === "plus" ? second - first : first - second;
}

/**
 * Work with world-space bounding-box edges, not the origin/pivot. No mesh dimensions
 * change; callers convert world displacements to local parent coordinates.
 */
export function planSpacing(
  items: readonly BoundsItem[],
  referenceId: string,
  mode: SpacingMode,
  axis: SpacingAxis,
  marginMm: number,
  side: SpacingSide = "plus",
): SpacingPlan {
  const ref = items.find(x => x.id === referenceId);
  const movers = items.filter(x => x.id !== referenceId);
  if (!ref || movers.length === 0) return {moves: [], error: "Select a fixed reference and another object."};
  if (items.some(x => x.box.isEmpty())) return {moves: [], error: "Could not read all object bounds."};
  if (!Number.isFinite(marginMm) || marginMm < 0 || marginMm > 1000) {
    return {moves: [], error: "Enter a distance between 0 and 1000 mm."};
  }
  const move = (id: string, index: 0 | 1 | 2, by: number): SpacingMove => {
    const delta: [number, number, number] = [0, 0, 0];
    delta[index] = by;
    return {id, delta};
  };
  if (mode === "center-xy") {
    const center = ref.box.getCenter(new THREE.Vector3());
    const moves: SpacingMove[] = movers.map(({id, box}) => {
      const c = box.getCenter(new THREE.Vector3());
      return {id, delta: [center.x - c.x, center.y - c.y, 0]};
    });
    return {moves};
  }
  if (mode === "gap" || mode === "center-distance" || mode === "edge-center") {
    if (movers.length !== 1) return {moves: [], error: "Distance requires exactly two objects."};
    const other = movers[0];
    const currentDistance = distanceBetween(ref.box, other.box, axis, side, mode);
    const shift = (side === "plus" ? 1 : -1) * (marginMm - currentDistance);
    return {moves: [move(other.id, axis, shift)]};
  }
  if (movers.length < 2) return {moves: [], error: "Equal margins need a base and at least two objects."};
  const sorted = [...movers].sort((a, b) =>
    a.box.getCenter(new THREE.Vector3()).getComponent(axis)
    - b.box.getCenter(new THREE.Vector3()).getComponent(axis)
    || a.id.localeCompare(b.id));
  const min = ref.box.min.getComponent(axis);
  const max = ref.box.max.getComponent(axis);
  const widths = sorted.map(x => x.box.max.getComponent(axis) - x.box.min.getComponent(axis));
  if (mode === "even-centers") {
    // The first/last centres are at the specified inset, intermediate centres
    // are equally spaced. The dimensions are not changed.
    if (max - min < 2 * marginMm) {
      return {moves: [], error: "The reference is too small for these centre margins."};
    }
    const pitch = (max - min - 2 * marginMm) / (sorted.length - 1);
    return {moves: sorted.map(({id, box}, i) => {
      const actual = (box.min.getComponent(axis) + box.max.getComponent(axis)) / 2;
      return move(id, axis, min + marginMm + i * pitch - actual);
    })};
  }
  const available = max - min - 2 * marginMm;
  const sumWidth = widths.reduce((a, b) => a + b, 0);
  if (available < sumWidth - 1e-6) {
    return {moves: [], error: "These objects cannot fit with that margin."};
  }
  const gap = Math.max(0, (available - sumWidth) / (sorted.length - 1));
  let cursor = min + marginMm;
  const moves: SpacingMove[] = [];
  sorted.forEach(({id, box}, i) => {
    moves.push(move(id, axis, cursor - box.min.getComponent(axis)));
    cursor += widths[i] + gap;
  });
  return {moves};
}
