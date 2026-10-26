/** Optional USER-SIZED opening for exact catalogue SKUs whose physical
 * panel aperture is UNKNOWN. Never promotes sizes to supplier verified data.
 * Reuses established shell Boolean planning; dimensions supplied by operator.
 */
import {identifyShell} from "./boxFitTools";
import {bananaBoxFaceSize,planShellFeature,type BananaBoxFace} from "./workshopTools";
import {bundleConnectorCutters} from "./connectorCutGroup";
import {componentById,isPlaceableNominalComponent} from "./componentCatalog";
import {makeShape} from "./primitives";
import {useScene} from "../state/store";
import type {Project,ShapeNode} from "../types/scene";
export type UserCutShape="circle"|"rectangle";
export interface UserSizedCutOptions {
 componentId:string;face:BananaBoxFace;offsetX:number;offsetY:number;
 shape:UserCutShape;width:number;height?:number;
}
const isDimension=(n:number)=>Number.isFinite(n)&&n>=1&&n<=200;
export function userSizedComponentParts(project:Project,rootId:string,o:UserSizedCutOptions):ShapeNode[]{
 const c=componentById(o.componentId);
 if(!c)throw Error("Unknown physical component SKU.");
 if(isPlaceableNominalComponent(c)||c.mounting.cutout!==null)
  throw Error("This part already has documented geometry; use the original cutout.");
 if(!["front","back","left","right","floor"].includes(o.face))throw Error("Invalid wall.");
 if(!Number.isFinite(o.offsetX)||!Number.isFinite(o.offsetY))throw Error("Offsets must be finite numbers.");
 if(o.shape!=="circle"&&o.shape!=="rectangle")throw Error("Choose a supported cutout shape.");
 if(!isDimension(o.width)|| (o.shape==="rectangle"&&!isDimension(o.height??NaN)))
  throw Error("Enter real measured opening dimensions (1–200 mm). No defaults or guesses.");
 const sh=identifyShell(rootId,project);
 const width=o.width, height=o.shape==="circle"?o.width:o.height!;
 const [wallWidth,wallHeight]=bananaBoxFaceSize(sh,o.face);
 if(Math.abs(o.offsetX)+width/2>wallWidth/2-3+1e-8||
    Math.abs(o.offsetY)+height/2>wallHeight/2-3+1e-8)
  throw Error("Opening extends beyond wall: leave 3 mm at each edge.");
 const thick=o.face==="floor"?sh.floor:(o.face==="front"||o.face==="back"?sh.wallY:sh.wallX);
 if(!Number.isFinite(thick)||thick<0.5||thick>22)throw Error("Unsupported wall thickness.");
 const part=makeShape(o.shape==="circle"?"cylinder":"box");
 part.role="hole";
 part.label=c.supplier_sku+" — USER-SIZED UNVERIFIED "+o.shape+
    " "+width+(o.shape==="rectangle"?" × "+height:"")+" mm";
 part.params=o.shape==="circle"
  ?{r:width/2,h:thick+2,segments:96,bevel:0}
  :{w:width,d:height,h:thick+2,radius:0};
 if(o.face==="floor"){
  part.position=[sh.cx+o.offsetX,sh.cy+o.offsetY,sh.bottom+sh.floor/2];
  part.rotation=[0,0,0];
 }else if(o.face==="front"||o.face==="back"){
  part.position=[sh.cx+o.offsetX,
   sh.cy+(o.face==="front"?-1:1)*(sh.depth/2-sh.wallY/2),
   sh.bottom+sh.floor+(sh.height-sh.floor)/2+o.offsetY];
  part.rotation=[Math.PI/2,0,0];
 }else{
  part.position=[sh.cx+(o.face==="left"?-1:1)*(sh.width/2-sh.wallX/2),
   sh.cy+o.offsetX,sh.bottom+sh.floor+(sh.height-sh.floor)/2+o.offsetY];
  part.rotation=[0,Math.PI/2,Math.PI/2];
 }
 return [part];
}
export function planUserSizedComponentCut(project:Project,rootId:string,o:UserSizedCutOptions){
 const c=componentById(o.componentId);
 if(!c)throw Error("Unknown physical component.");
 const cutters=userSizedComponentParts(project,rootId,o);
 const plan=planShellFeature(project,rootId,cutters,"Box + user-sized "+c.supplier_sku+" opening");
 const joined=bundleConnectorCutters(plan.project,plan.selectionId,cutters,
  c.supplier_sku+" — USER-SIZED / UNVERIFIED / NOT SUPPLIER GEOMETRY");
 // Explicitly no componentSnapshot: no verified source cutout or claimed tolerances.
 return {project:joined.project,selectionId:plan.selectionId,cutoutGroupId:joined.groupId,cutters:cutters.map(c=>c.id)};
}
export function applyUserSizedComponentCut(rootId:string,o:UserSizedCutOptions):string{
 let chosen=rootId;
 useScene.setState(s=>{
  const result=planUserSizedComponentCut(s.project,rootId,o);
  chosen=result.selectionId;
  return {project:result.project,selection:[chosen]};
 });
 return chosen;
}
