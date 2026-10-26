import {parsePicks,formatPicks} from "./rounding";
import {maxUprightBoxRadius} from "./boxEdges";
import type {ShapeNode} from "../types/scene";

export const CORNER_EDGE_IDS=["8","9","10","11"] as const;

/** Keep rectangle's X/Y profile rounded without rounding the thin top/bottom rim.
 * Child edge IDs are existing saved-file IDs and remain editable. */
export function uniformUprightRadius(node:ShapeNode):number {
 const picks=parsePicks("box",node.params);
 const values=CORNER_EDGE_IDS.map(id=>picks.get(id)??0);
 if(!values.every(v=>Math.abs(v-values[0])<0.02))
  throw new Error("Individual corner radii need a matching custom lid. Use uniform Tray Rounding first.");
 return values[0];
}
export type UprightCorners=Record<"8"|"9"|"10"|"11",number>;
/** Read the four Z-upright corner radii, retaining individual values. */
export function uprightCornerRadii(node:ShapeNode):UprightCorners {
 const picks=parsePicks("box",node.params);
 return {"8":picks.get("8")??0,"9":picks.get("9")??0,"10":picks.get("10")??0,"11":picks.get("11")??0};
}
/** Build a rectangular part with independent upright fillets. No top/bottom rounding. */
export function independentUprightFillets(node:ShapeNode,corners:UprightCorners):ShapeNode {
 const w=Number(node.params.w),d=Number(node.params.d);
 const max=maxUprightBoxRadius(w,d);
 const raw=CORNER_EDGE_IDS.map(id=>corners[id]);
 if(raw.some(r=>!Number.isFinite(r)||r<0||r>max+0.00001))
  throw new Error("Corner radius exceeds the compatible lid or lip size.");
 const [bl,br,tl,tr]=raw;
 if(bl+br>w-0.01||tl+tr>w-0.01||bl+tl>d-0.01||br+tr>d-0.01)
  throw new Error("Matching lid corner fillets overlap; adjust the box or lid.");
 const picks=new Map<string,number>();
 for(const id of CORNER_EDGE_IDS)if(corners[id]>=0.05)picks.set(id,corners[id]);
 return {...node,params:{...node.params,radius:0,edges:formatPicks(picks)}};
}
export function offsetCornerRadii(corners:UprightCorners,amount:number):UprightCorners {
 return {"8":Math.max(0,corners["8"]+amount),"9":Math.max(0,corners["9"]+amount),
  "10":Math.max(0,corners["10"]+amount),"11":Math.max(0,corners["11"]+amount)};
}
export function verticalFillets(node:ShapeNode,radius:number):ShapeNode {
 const w=Number(node.params.w),d=Number(node.params.d);
 const max=maxUprightBoxRadius(w,d);
 if(!Number.isFinite(radius)||radius<0||radius>max+0.00001)
  throw new Error("Calculated corner radius exceeds the panel or lip size.");
 const rounded=new Map<string,number>();
 for(const id of CORNER_EDGE_IDS)if(radius>=0.05)rounded.set(id,radius);
 return {...node,params:{...node.params,radius:0,edges:formatPicks(rounded)}};
}
/** Inward plan-view offsets: reducing width and depth by clearance shrinks
 * the corner radius by that clearance as well. */
export function insetCornerRadius(radius:number,inset:number):number {
 return Math.max(0,radius-inset);
}
export function cornerFitRequiresReview(cavityRadius:number,ringRadius:number,gap:number):boolean {
 return cavityRadius>0.01 && ringRadius + Math.max(0,gap)<cavityRadius-0.02;
}
