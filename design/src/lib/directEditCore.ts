import type {ShapeNode} from "../types/scene";
import {withRoundedBoxCorners} from "./boxCorners";
import {parsePicks} from "./rounding";
import {maxUprightBoxRadius} from "./boxEdges";

export type FaceAxis=0|1|2;
export type FaceSign=-1|1;
export interface Face {axis:FaceAxis;sign:FaceSign}
export const dimensionKeys=["w","d","h"] as const;
const MIN_SIZE=1;
const MAX_SIZE=300;

/** Live resize changes ONE selected face; opposite face's position stays fixed.
 * No project mutation occurs until Apply. Geometry remains an ordinary box. */
export function stretchedFace(node:ShapeNode,face:Face,delta:number):ShapeNode {
 const key=dimensionKeys[face.axis];
 const size=Number(node.params[key]);
 if(!Number.isFinite(size)||size<MIN_SIZE||size>MAX_SIZE)throw new Error("Invalid original box dimension.");
 if(!Number.isFinite(delta)||size+delta<MIN_SIZE-1e-6||size+delta>MAX_SIZE+1e-6)
   throw new Error("Face adjustment exceeds the 1–300 mm size limits.");
 const position=[...node.position] as [number,number,number];
 position[face.axis]+=face.sign*delta/2;
 return {...node,params:{...node.params,[key]:size+delta},position};
}
export function clampStretch(node:ShapeNode,face:Face,delta:number):number {
 const size=Number(node.params[dimensionKeys[face.axis]]);
 if(!Number.isFinite(size))return 0;
 return Math.round(Math.max(MIN_SIZE-size,Math.min(MAX_SIZE-size,delta))*10)/10;
}

/** Uses the existing box-edge IDs; preserves horizontal fillets and sinks. */
export function roundedCornerPreview(node:ShapeNode,radius:number):ShapeNode {
 const newPicks=withRoundedBoxCorners(node.params,radius);
 const params:Record<string,number|string>={...node.params,edges:newPicks};
 // Legacy global-radius falls back to rounding every edge, so migrate the
 // legacy radius into explicit picks before clearing it.
 if(Number(params.radius||0)>0)params.radius=0;
 return {...node,params};
}
export function initialCornerRadius(node:ShapeNode):number {
 const picks=parsePicks("box",node.params);
 const upright=["8","9","10","11"].map(key=>picks.get(key)??0);
 return upright.every(v=>Math.abs(v-upright[0])<0.0001)?upright[0]:0;
}
export function safeCornerMaximum(node:ShapeNode):number {
 return maxUprightBoxRadius(Number(node.params.w),Number(node.params.d));
}
