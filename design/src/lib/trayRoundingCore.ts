import {identifyShell,type ShellInfo} from "./boxFitTools";
import {maxFilletRadius,maxUprightBoxRadius} from "./boxEdges";
import {formatPicks,parsePicks,parseSinks} from "./rounding";
import {type Project,type ShapeNode} from "../types/scene";

/** The exact four vertical box edge IDs. Never renumber project edge IDs. */
const UPRIGHT=["8","9","10","11"] as const;
/** Four LOWER HORIZONTAL edges of cavity cutter: edges along X or Y at -Z. */
const CAVITY_FLOOR=["0","1","4","5"] as const;
export type TraySettings={outside:number;scoop:number};
export interface TrayTarget{shell:ShellInfo;maxOutside:number;maxScoop:number;initial:TraySettings;}
const near=(a:number,b:number)=>Math.abs(a-b)<0.03;

const initialRadius=(node:ShapeNode,ids:readonly string[]):number=>{
 const picks=parsePicks("box",node.params);
 const values=ids.map(id=>picks.get(id)??0);
 if(!values.every(v=>near(v,values[0])))throw new Error("This box has individual corner fillets. Use Round Edges to edit them individually.");
 return values[0];
};
export function trayTarget(id:string,project:Project):TrayTarget{
 const shell=identifyShell(id,project);
 if(!near(shell.wallX,shell.wallY))throw new Error("Tray Rounding currently requires equal wall thickness on X and Y.");
 for(const part of [shell.outer,shell.cavity]){
  if(Number(part.params.radius||0)>0.001&&!part.params.edges)
   throw new Error("This shell has legacy all-edge rounding; use a standard hollow box for Tray Rounding.");
 }
 const t=(shell.wallX+shell.wallY)/2;
 const innerWidth=Number(shell.cavity.params.w),innerDepth=Number(shell.cavity.params.d),innerHeight=Number(shell.cavity.params.h);
 const maxOutside=Math.max(0,Math.min(maxUprightBoxRadius(shell.width,shell.depth),
   maxUprightBoxRadius(innerWidth,innerDepth)+t));
 const maxScoop=Math.max(0,Math.min(maxFilletRadius(innerWidth,innerDepth,innerHeight),
   shell.height-shell.floor-1.5));
 const outside=initialRadius(shell.outer,UPRIGHT);
 const inside=initialRadius(shell.cavity,UPRIGHT);
 const scoop=initialRadius(shell.cavity,CAVITY_FLOOR);
 // Exterior R minus one normal offset thickness gives the intended inside radius.
 // When exterior R <= thickness the interior corner is still sharp (radius zero).
 if(!near(inside,Math.max(0,outside-t)))
  throw new Error("Inside and outside radii are independently edited. Reconcile them with Round Edges first.");
 if(outside>maxOutside+0.02||scoop>maxScoop+0.02)
  throw new Error("One of this shell's fillets exceeds the safe dimension limits.");
 return {shell,maxOutside,maxScoop,initial:{outside,scoop}};
}
const adjusted=(node:ShapeNode,ids:readonly string[],radius:number):ShapeNode=>{
 const picks=parsePicks("box",node.params);
 const sinks=parseSinks(node.params);
 for(const id of ids){
  if(radius<0.045)picks.delete(id);
  else picks.set(id,radius);
  sinks.delete(id);
 }
 return {...node,params:{...node.params,radius:0,edges:formatPicks(picks,sinks)}};
};
/** Rounded convex exterior, offset convex cavity cutter, plus bottom cutter rounds.
 * Still only TWO editable primitive nodes. Never changes dimensions or placement. */
export function trayRoundingNodes(target:TrayTarget,settings:TraySettings):Record<string,ShapeNode>{
 const {shell,maxOutside,maxScoop}=target;
 if(!Number.isFinite(settings.outside)||settings.outside<0||settings.outside>maxOutside+1e-6||
  !Number.isFinite(settings.scoop)||settings.scoop<0||settings.scoop>maxScoop+1e-6)
  throw new Error("Tray radii exceed this shell's safe limits.");
 const t=(shell.wallX+shell.wallY)/2;
 const outer=adjusted(shell.outer,UPRIGHT,settings.outside);
 const cavity=adjusted(adjusted(shell.cavity,UPRIGHT,Math.max(0,settings.outside-t)),CAVITY_FLOOR,settings.scoop);
 return {[outer.id]:outer,[cavity.id]:cavity};
}
/** Bounds reduction from physically filleting never grows beyond original outside rectangle. */
export function traySettingsClamped(t:TrayTarget,settings:TraySettings):TraySettings{
 return {
  outside:Math.round(Math.max(0,Math.min(t.maxOutside,settings.outside))*4)/4,
  scoop:Math.round(Math.max(0,Math.min(t.maxScoop,settings.scoop))*4)/4,
 };
}
export const canRoundTray=(id:string|null,project:Project):boolean=>{
 if(!id)return false;
 try{trayTarget(id,project);return true;}catch{return false;}
};
