/**
 * Standard-size DE-9 (often called DB9) PANEL aperture.
 *
 * This is intentionally NOT the 9-pin PCB drill pattern or a connector-sized
 * 3D body. Both connector genders use a shell-size-E panel opening; pin/socket
 * internals differ. All actual holding dimensions and mounting methods must
 * still be verified against the user's physical part.
 *
 * Source: Spectrum Control D-Sub Board & Panel Cutouts, page 1:
 *   9 shell: 24.99 mm mounting pitch, 3.18 mm recommended screw openings,
 *   19.74 mm cutout width, 11.18 mm cutout height, 10 degree keying,
 *   R3.81 corner outline. This measured contour is APPROXIMATED as a rounded
 *   trapezoid using 12 straight segments per corner for matched viewport/STEP.
 * https://www.spectrumcontrol.com/asset/d-sub-board-panel-cutouts.pdf
 * The original user's two DB9 drawings separately corroborate 25 mm pitch;
 * neither provided a fully dimensioned panel aperture.
 *
 * Do NOT assume tolerance/printing fit, mounting screws, or connector depth.
 */
import {makeShape} from "./primitives";
import {bundleConnectorCutters} from "./connectorCutGroup";
import {identifyShell} from "./boxFitTools";
import {bananaBoxFaceSize,planShellFeature,type BananaBoxFace,type Point,type PanelSizeInfo} from "./workshopTools";
import {useScene} from "../state/store";
import type {Project,ShapeNode} from "../types/scene";

export const DB9_PANEL={
 pitch:25.00, nominalMountDiameter:3.18,
 openingWidth:19.74,openingHeight:11.18,sideSlopeDegrees:10,cornerRadius:3.81
} as const;

export type DB9Gender="male"|"female";
export interface DB9BoxOptions{
 gender:DB9Gender;
 face:BananaBoxFace;
 offsetX:number;offsetY:number;
 clearance:number;
 mountingDiameter:number;
 addMountingHoles:boolean;
 flipKey:boolean;
}
const round=(n:number)=>Math.round(n*1e5)/1e5;
type Pt=readonly [number,number];
const length=([x,y]:Pt)=>Math.hypot(x,y);
const unit=([x,y]:Pt):Pt=>{const d=length([x,y]);return [x/d,y/d];};
const diff=(a:Pt,b:Pt):Pt=>[a[0]-b[0],a[1]-b[1]];
const add=(a:Pt,b:Pt,k=1):Pt=>[a[0]+b[0]*k,a[1]+b[1]*k];

/** Convex trapezoid rounded by circular-arc samples.
 * Geometry stays entirely in editable 2D sketch coordinates, and the STEP
 * bridge extrudes the identical saved profile (not a mesh).
 */
export function db9PanelProfile(clearance:number,flipKey=false):Point[]{
 if(!Number.isFinite(clearance)||clearance<0||clearance>1)
  throw new Error("Connector opening clearance must be 0 to 1 mm per side.");
 const fullW=DB9_PANEL.openingWidth+2*clearance;
 const fullH=DB9_PANEL.openingHeight+2*clearance;
 const taper=Math.tan(DB9_PANEL.sideSlopeDegrees*Math.PI/180)*fullH;
 const top=fullW/2,bot=top-taper;
 if(bot<6)throw new Error("DB9 opening is too narrow for the selected clearance.");
 const v:Pt[]=[[-bot,-fullH/2],[bot,-fullH/2],[top,fullH/2],[-top,fullH/2]];
 const r=DB9_PANEL.cornerRadius;
 const points:Point[]=[];
 for(let i=0;i<4;i++){
  const previous=v[(i+3)%4],p=v[i],next=v[(i+1)%4];
  const a=unit(diff(previous,p)),b=unit(diff(next,p));
  const dot=Math.max(-1,Math.min(1,a[0]*b[0]+a[1]*b[1]));
  const inner=Math.acos(dot);
  const tangent=r/Math.tan(inner/2);
  if(tangent>Math.min(length(diff(previous,p)),length(diff(next,p)))/2)
   throw new Error("DB9 corner rounding collides with adjacent edges.");
  const center=add(p,unit(add(a,b)),r/Math.sin(inner/2));
  const begin=add(p,a,tangent),end=add(p,b,tangent);
  let start=Math.atan2(begin[1]-center[1],begin[0]-center[0]);
  let finish=Math.atan2(end[1]-center[1],end[0]-center[0]);
  while(finish<=start)finish+=Math.PI*2;
  if(finish-start>Math.PI)throw new Error("DB9 profile corner orientation is not convex.");
  for(let j=0;j<=12;j++){
   const t=start+(finish-start)*j/12;
   points.push([round(center[0]+r*Math.cos(t)),round(center[1]+r*Math.sin(t))]);
  }
 }
 if(flipKey)return points.map(([x,y])=>[-x,-y] as Point);
 return points;
}

export function db9BoxIssues(sh:PanelSizeInfo,o:DB9BoxOptions):string[]{
 const out:string[]=[];
 if(o.gender!=="male"&&o.gender!=="female")out.push("Choose DB9 male or female.");
 if(!["front","back","left","right","floor"].includes(o.face))
  return [...out,"Choose which box surface to drill."];
 const [w,h]=bananaBoxFaceSize(sh,o.face);
 if(!Number.isFinite(o.clearance)||o.clearance<0||o.clearance>1)
  out.push("Opening clearance must be between 0 and 1 mm per side.");
 if(!Number.isFinite(o.mountingDiameter)||o.mountingDiameter<2.3||o.mountingDiameter>4.5)
  out.push("Mounting-hole diameter must be from 2.3 to 4.5 mm.");
 if(!Number.isFinite(o.offsetX)||!Number.isFinite(o.offsetY))
  out.push("Enter valid connector X and Y coordinates.");
 if(out.length)return out;
 const cutW=DB9_PANEL.openingWidth+2*o.clearance;
 const cutH=DB9_PANEL.openingHeight+2*o.clearance;
 const x=Math.abs(o.offsetX),y=Math.abs(o.offsetY);
 if(x+cutW/2>w/2-3+1e-8||y+cutH/2>h/2-3+1e-8)
  out.push("The D-shaped opening is too near the box edge or rim. Leave at least 3 mm.");
 if(o.addMountingHoles){
  if(x+DB9_PANEL.pitch/2+o.mountingDiameter/2>w/2-3+1e-8||
     y+o.mountingDiameter/2>h/2-3+1e-8)
   out.push("A DB9 screw hole is too close to the box edge. Move the connector or use a bigger wall.");
  const web=DB9_PANEL.pitch/2-cutW/2-o.mountingDiameter/2;
  if(web<0.7-1e-8)
   out.push("Connector opening and screw holes leave under 0.7 mm material. Reduce fit clearance or mounting-hole diameter.");
 }
 return out;
}

export function db9BoxParts(project:Project,rootId:string,o:DB9BoxOptions):ShapeNode[]{
 const sh=identifyShell(rootId,project);
 const problems=db9BoxIssues(sh,o);
 if(problems.length)throw new Error(problems.join(" "));
 const thick=o.face==="floor"?sh.floor:
  o.face==="front"||o.face==="back"?sh.wallY:sh.wallX;
 const cutDepth=thick+2;
 let cx:number,cy:number,cz:number;
 let rotation:[number,number,number];
 if(o.face==="floor"){
  cx=sh.cx+o.offsetX;cy=sh.cy+o.offsetY;
  cz=sh.bottom+sh.floor/2;
  rotation=[0,0,0];
 }else if(o.face==="front"||o.face==="back"){
  cx=sh.cx+o.offsetX;
  cy=sh.cy+(o.face==="front"?-1:1)*(sh.depth/2-sh.wallY/2);
  cz=sh.bottom+sh.floor+(sh.height-sh.floor)/2+o.offsetY;
  rotation=[Math.PI/2,0,0];
 }else{
  cx=sh.cx+(o.face==="left"?-1:1)*(sh.width/2-sh.wallX/2);
  cy=sh.cy+o.offsetX;
  cz=sh.bottom+sh.floor+(sh.height-sh.floor)/2+o.offsetY;
  rotation=[0,Math.PI/2,Math.PI/2];
 }
 const cut=makeShape("sketch");
 cut.label="DB9 "+o.gender+" D-shaped panel opening";
 cut.params={profile:JSON.stringify(db9PanelProfile(o.clearance,o.flipKey)),h:cutDepth};
 cut.position=[cx,cy,cz];cut.rotation=rotation;cut.role="hole";
 const nodes:ShapeNode[]=[cut];
 if(o.addMountingHoles){
  for(const sign of [-1,1]){
   const bore=makeShape("cylinder");
   bore.params={r:o.mountingDiameter/2,h:cutDepth,segments:64,bevel:0};
   bore.role="hole";
   bore.label="DB9 "+o.gender+" screw hole "+(sign<0?1:2);
   bore.position=o.face==="front"||o.face==="back"?
     [cx+sign*DB9_PANEL.pitch/2,cy,cz]:
     o.face==="floor"?
      [cx+sign*DB9_PANEL.pitch/2,cy,cz]:
      [cx,cy+sign*DB9_PANEL.pitch/2,cz];
   bore.rotation=rotation;
   nodes.push(bore);
  }
 }
 return nodes;
}

export function planDB9BoxMount(project:Project,rootId:string,o:DB9BoxOptions){
 const cutters=db9BoxParts(project,rootId,o);
 const plan=planShellFeature(project,rootId,cutters,"Box with DB9 "+o.gender+" mounting opening");
 const bundled=bundleConnectorCutters(plan.project,plan.selectionId,cutters,"DB9 "+o.gender+" cutout");
 return {...plan,project:bundled.project,cutoutGroupId:bundled.groupId,
  cutters:cutters.map(n=>n.id)};
}
export function applyDB9BoxMount(rootId:string,o:DB9BoxOptions):string{
 let next=rootId;
 useScene.setState(s=>{
  const plan=planDB9BoxMount(s.project,rootId,o);
  next=plan.selectionId;
  return {project:plan.project,selection:[next]};
 });
 return next;
}

