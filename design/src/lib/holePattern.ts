import * as THREE from "three";

export type HoleLayout = "two" | "four";
export interface HolePlan {
  points: [number, number, number][];
  height: number;
  error?: string;
}

/**
 * Hole locations measured to the CENTRES from a rectangular base's edges.
 * Input bounds are the actual world-space bounding box (mm), and the cutter
 * extends 1 mm beyond both top and bottom faces.
 */
export function planHolePattern(
  box: THREE.Box3,
  layout: HoleLayout,
  offset: number,
  diameter: number,
): HolePlan {
  const error = (message: string): HolePlan => ({points: [], height: 0, error: message});
  if (box.isEmpty()) return error("Select a box with visible dimensions.");
  if (![offset, diameter].every(Number.isFinite)) return error("Enter valid numbers.");
  if (diameter <= 0 || diameter > 100 || offset <= 0 || offset > 500)
    return error("Use a positive hole diameter and edge distance.");
  const w = box.max.x - box.min.x;
  const d = box.max.y - box.min.y;
  const h = box.max.z - box.min.z;
  if (h <= 0.1) return error("The box must have thickness.");
  if (offset < diameter / 2) return error("The hole is too wide for that edge distance.");
  const alongX = w >= d;
  if (layout === "four" && (2 * offset >= w || 2 * offset >= d))
    return error("Not enough room for four corner holes.");
  if (layout === "two" && 2 * offset >= (alongX ? w : d))
    return error("Not enough length for two holes.");
  if (layout === "two" && diameter > (alongX ? d : w))
    return error("The holes are wider than the box.");

  const left = box.min.x + offset;
  const right = box.max.x - offset;
  const front = box.min.y + offset;
  const back = box.max.y - offset;
  const yMid = (box.min.y + box.max.y) / 2;
  const zMid = (box.min.z + box.max.z) / 2;
  const xMid = (box.min.x + box.max.x) / 2;
  const coords: [number,number][] = layout === "two"
    ? (alongX ? [[left,yMid],[right,yMid]] : [[xMid,front],[xMid,back]])
    : [[left,front],[left,back],[right,front],[right,back]];
  return {points: coords.map(([x,y]) => [x,y,zMid]), height: h + 2};
}
