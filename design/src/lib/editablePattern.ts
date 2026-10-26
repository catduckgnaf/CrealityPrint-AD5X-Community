import * as THREE from "three";
import type { GroupNode, Project, ShapeNode } from "../types/scene";
import {buildGeometry} from "./primitives";
import {composeMatrix} from "./transform";
import {planHolePattern, type HoleLayout} from "./holePattern";

export type HolePatternSettings = {
  baseId: string;
  holeIds: string[];
  layout: HoleLayout;
  diameter: number;
  offset: number;
};
const TOL = 0.025;
const close = (a: number, b: number) => Number.isFinite(a) && Math.abs(a-b) < TOL;

export function baseLocalBounds(shape: ShapeNode): THREE.Box3 | null {
  if (shape.kind !== "box" || shape.rotation.some(x=>Math.abs(x)>1e-5)) return null;
  const geo = buildGeometry(shape);
  if (!geo) return null;
  try {
    geo.computeBoundingBox();
    if (!geo.boundingBox) return null;
    return geo.boundingBox.clone().applyMatrix4(composeMatrix(shape.position,shape.rotation,shape.scale));
  } finally {geo.dispose();}
}

/**
 * Infer safely from an older plain Group created by the one-click Hole
 * Pattern tool. Does not claim arbitrary grouped holes are editable patterns.
 */
export function editablePattern(
  group: GroupNode,
  nodes: Project["nodes"],
): HolePatternSettings | null {
  const count=group.childIds.length;
  if (count!==3 && count!==5) return null;
  const base=nodes[group.childIds[0]];
  if (!base || "type" in base || base.kind !== "box") return null;
  const bounds=baseLocalBounds(base);
  if (!bounds || bounds.isEmpty()) return null;
  const holeIds=group.childIds.slice(1);
  const holes=holeIds.map(id => nodes[id]);
  if (holes.some(n=>!n || "type" in n || n.kind!=="cylinder" || n.role!=="hole")) return null;
  const first=holes[0] as ShapeNode;
  const diameter=Number(first.params.r)*2;
  if (!Number.isFinite(diameter)) return null;
  const layout:HoleLayout=count===3?"two":"four";
  const longX=bounds.max.x-bounds.min.x>=bounds.max.y-bounds.min.y;
  const offset=layout==="four" || longX
    ? first.position[0]-bounds.min.x : first.position[1]-bounds.min.y;
  const data=group.holePattern;
  if (data && (data.baseId!==base.id ||
    data.holeIds.length!==holeIds.length ||
    data.holeIds.some((id,i)=>id!==holeIds[i]))) return null;
  const pattern=data ?? {baseId:base.id,holeIds,layout,offset,diameter};
  if (pattern.layout!==layout) return null;
  const expected=planHolePattern(bounds,pattern.layout,pattern.offset,pattern.diameter);
  if (expected.error || expected.points.length!==holes.length) return null;
  for (let i=0;i<holes.length;i++) {
    const hole=holes[i] as ShapeNode;
    if (hole.rotation.some(x=>Math.abs(x)>1e-5) ||
      hole.scale.some(x=>!close(x,1)) ||
      !close(Number(hole.params.r)*2, pattern.diameter) ||
      !close(Number(hole.params.h), expected.height) ||
      !expected.points[i].every((coord,axis)=>close(hole.position[axis],coord))) return null;
  }
  return {...pattern,holeIds:[...pattern.holeIds]};
}

export function updatePatternGeometry(
  group:GroupNode,
  nodes:Project["nodes"],
  settings:HolePatternSettings,
): {nodes:Project["nodes"];group:GroupNode;error?:string} {
  const original=editablePattern(group,nodes);
  if (!original) return {nodes,group,error:"Holes were changed manually, or this is not an editable pattern. Nothing was overwritten."};
  const base=nodes[settings.baseId] as ShapeNode;
  if (!base || base.locked || group.locked) return {nodes,group,error:"Unlock the base and pattern to edit them."};
  if (settings.baseId!==original.baseId) return {nodes,group,error:"The base cannot be changed."};
  const bounds=baseLocalBounds(base);
  if (!bounds) return {nodes,group,error:"Only an unrotated rectangular base can be edited."};
  const plan=planHolePattern(bounds,settings.layout,settings.offset,settings.diameter);
  if (plan.error) return {nodes,group,error:plan.error};
  if (settings.layout!==original.layout) return {nodes,group,error:"Switching between 2 and 4 holes needs a new pattern. The existing one is unchanged."};
  const revised={...nodes};
  settings.holeIds.forEach((id,i)=>{
    const old=nodes[id] as ShapeNode;
    revised[id]={...old,params:{...old.params,r:settings.diameter/2,h:plan.height},
      position:[...plan.points[i]]};
  });
  const updated={...group,holePattern:{...settings,holeIds:[...settings.holeIds]}};
  revised[group.id]=updated;
  return {nodes:revised,group:updated};
}
