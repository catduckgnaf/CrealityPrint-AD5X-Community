import {useScene} from "../state/store";
import {makeShape} from "./primitives";
import {sceneApi} from "./sceneApi";
import {isGroup,type ShapeNode,type GroupNode} from "../types/scene";
import {identifyShell,basicBox,limits,wrapAddition,type ShellInfo} from "./boxFitTools";
import {cornerFitRequiresReview,uniformUprightRadius,uprightCornerRadii,CORNER_EDGE_IDS} from "./matchedLidCorners";

export interface ClipOptions {count:2|4;tabWidth:number;beamHeight:number;thickness:number;gap:number;catchDepth:number;}
/** Proof-of-concept retention tab, not a validated spring/hinge.
 * Only its root anchor fuses to the shell; upper beam is spaced off the wall. */
export function clipParts(shell:ShellInfo,o:ClipOptions):ShapeNode[]{
 limits(o.tabWidth,"Tab width",4,20);limits(o.beamHeight,"Beam height",5,22);
 limits(o.thickness,"Beam thickness",1,4);
 limits(o.gap,"Beam gap",0.5,2.5);
 limits(o.catchDepth,"Retention lip",0.35,2.5);
 if(o.beamHeight>shell.height-shell.floor-1)
  throw new Error("Beam is taller than the available wall height.");
 if(o.tabWidth>shell.depth-2)throw new Error("Tabs cannot fit on this side.");
 const parts:ShapeNode[]=[];
 const beamBottom=shell.bottom+shell.floor+1;
 const side= shell.width/2;
 const locations=o.count===2?[0]:[-shell.depth/4,shell.depth/4];
 for(const sign of [-1,1]){
  for(const y of locations){
   const yy=shell.cy+y;
   const beamX=shell.cx+sign*(side+o.gap+o.thickness/2);
   const anchorWidth=o.gap+o.thickness+0.8;
   const anchorX=shell.cx+sign*(side-0.4+anchorWidth/2);
   parts.push(basicBox(anchorWidth,o.tabWidth,1.6,anchorX,yy,beamBottom+0.8));
   parts.push(basicBox(o.thickness,o.tabWidth,o.beamHeight,beamX,yy,beamBottom+o.beamHeight/2));
   const nubX=beamX+sign*(o.thickness/2+o.catchDepth/2-0.15);
   parts.push(basicBox(o.catchDepth+0.3,o.tabWidth*0.75,1.5,nubX,yy,beamBottom+o.beamHeight-1.1));
  }
 }
 return parts;
}
export function addSnapStyleTabs(shellId:string,opts:ClipOptions):string{
 const s=identifyShell(shellId,useScene.getState().project);
 return wrapAddition(shellId,"Box with experimental retention tabs",clipParts(s,opts));
}

export interface LidInfo {root:GroupNode;panel:ShapeNode;ring:ShapeNode;ringWidth:number;ringDepth:number;worldX:number;worldY:number;bottom:number;}
export function identifyLid(id:string):LidInfo {
 const project=useScene.getState().project, top=project.nodes[id];
 if(!top||!isGroup(top)||!project.rootOrder.includes(id)||top.hidden||top.locked)
  throw new Error("Select a visible, unlocked matching lid.");
 let node=top;
 const offset:[number,number,number]=[0,0,0];
 for(let level=0;level<6;level++){
  if(node.rotation.some(x=>Math.abs(x)>0.00001)||node.scale.some(x=>Math.abs(x-1)>0.00001))
   throw new Error("Matching lid must remain unrotated and unscaled.");
  const children=node.childIds.map(i=>project.nodes[i]);
  if(children.length===3&&children.every(c=>c&&!isGroup(c)))break;
  const child=children[0];
  if(!child||!isGroup(child)||child.hidden||child.locked)
   throw new Error("Lid geometry has changed; cannot calculate its fit.");
  for(let i=0;i<3;i++)offset[i]+=node.position[i];
  node=child;
 }
 const children=node.childIds.map(i=>project.nodes[i]);
 if(children.length!==3)throw new Error("Matching lid group not found.");
 const [panel,ring,hole]=children;
 if(!panel||!ring||!hole||isGroup(panel)||isGroup(ring)||isGroup(hole)||
 panel.kind!=="box"||ring.kind!=="box"||hole.kind!=="box"||
 panel.role!=="solid"||ring.role!=="solid"||hole.role!=="hole"||
 Number(ring.params.w)>=Number(panel.params.w)||Number(ring.params.d)>=Number(panel.params.d))
  throw new Error("Selected group is not a matching lid.");
 return {root:top,panel,ring,ringWidth:Number(ring.params.w),ringDepth:Number(ring.params.d),
  worldX:offset[0]+node.position[0]+panel.position[0],
  worldY:offset[1]+node.position[1]+panel.position[1],
  bottom:offset[2]+node.position[2]+panel.position[2]-Number(panel.params.h)/2};
}
export interface FitResult {message:string;clearanceX?:number;clearanceY?:number;warning:boolean;}
export function lidFitReport(shellId:string,lidId:string):FitResult {
 const shell=identifyShell(shellId,useScene.getState().project);
 const lid=identifyLid(lidId);
 const gapX=(Number(shell.cavity.params.w)-lid.ringWidth)/2;
 const gapY=(Number(shell.cavity.params.d)-lid.ringDepth)/2;
 const good=gapX>=0.1&&gapY>=0.1;
 const cavityR=uprightCornerRadii(shell.cavity);
 const lipR=uprightCornerRadii(lid.ring);
 const cornersInterfere=CORNER_EDGE_IDS.some(id=>
   cornerFitRequiresReview(cavityR[id],lipR[id],Math.min(gapX,gapY)));
 const goodFit=good&&!cornersInterfere;
 return {message:goodFit?
  "Designed insertion-lip clearance is "+gapX.toFixed(2)+" mm per X side, "+gapY.toFixed(2)+
  " mm per Y side. Rounded corners checked; physical fit still needs a test.":
  cornersInterfere?
   "The lid lip has square or insufficiently rounded corners for this tray. Its flat-side clearance is not enough at the corners. Create a matching lid from the rounded tray.":
   "The lid lip may interfere with the box opening. Adjust clearance and regenerate the lid.",
  clearanceX:gapX,clearanceY:gapY,warning:!goodFit};
}
export function distanceReport(ids:string[]):FitResult{
 if(ids.length!==2)throw new Error("Select two objects to measure.");
 const [a,b]=ids.map(id=>sceneApi.getNodeBounds(id));
 if(!a||!b||a.isEmpty()||b.isEmpty())throw new Error("Both objects need rendered bounds.");
 const x=Math.max(0,a.min.x-b.max.x,b.min.x-a.max.x);
 const y=Math.max(0,a.min.y-b.max.y,b.min.y-a.max.y);
 const z=Math.max(0,a.min.z-b.max.z,b.min.z-a.max.z);
 const overlap=x===0&&y===0&&z===0;
 return {message:overlap?
  "World bounding boxes overlap or touch. This does not prove a mechanical interference or fit.":
  "Minimum axis-aligned bounding-box separations: X "+x.toFixed(2)+", Y "+y.toFixed(2)+
  ", Z "+z.toFixed(2)+" mm. Not a surface-to-surface clearance guarantee.",
  warning:overlap};
}

export type LabelMode="raised"|"recessed";
export interface LabelOptions{text:string;size:number;depth:number;spacing:number;mode:LabelMode;font:"sans"|"sans bold"|"serif";}
export function labelParts(
 o:LabelOptions,center:[number,number],surface:number,face:"top"|"lid-underside",
 surfaceWidth:number,surfaceDepth:number
):ShapeNode[]{
 limits(o.size,"Text size",2,18);limits(o.depth,"Label depth",0.35,3);
 limits(o.spacing,"Line spacing",0,10);
 const lines=o.text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 if(lines.length===0||lines.length>6)throw new Error("Use 1Ã¢â‚¬â€œ6 non-empty label lines.");
 if(lines.some(x=>x.length>32))throw new Error("Keep each label line within 32 characters.");
 if((lines.length-1)*(o.size+o.spacing)>surfaceDepth-2)
  throw new Error("Labels are too tall for the selected face.");
 if(lines.some(x=>x.length*o.size*0.6>surfaceWidth-2))
  throw new Error("Label may be wider than this surface; reduce its size.");
 if(face==="lid-underside"&&o.mode==="raised")
  throw new Error("Raised lettering below this print-oriented lid would extend beneath Z=0. Choose recessed.");
 const role=o.mode==="raised"?"solid":"hole";
 const totalStep=o.size+o.spacing;
 return lines.map((text,i)=>{
  const n=makeShape("text");
  n.params={value:text,font:o.font,size:o.size,depth:o.depth};n.role=role;
  const y=center[1]+((lines.length-1)/2-i)*totalStep;
  const z=face==="lid-underside"?
    surface+o.depth/2-0.2:
    surface+(o.mode==="raised"?o.depth/2-0.25:-o.depth/2+0.2);
  n.position=[center[0],y,z];
  if(face==="lid-underside")n.scale=[-1,1,1]; // readable on the outward-facing underside
  return n;
 });
}
export function addLabels(selectedId:string,o:LabelOptions):string{
 const project=useScene.getState().project,node=project.nodes[selectedId];
 if(!node||!project.rootOrder.includes(selectedId)||node.hidden||node.locked)
  throw new Error("Select one visible, unlocked top-level box, hollow shell or matching lid.");
 // A hollow shell has no top face. Its label belongs on the outside FRONT
 // wall (-Y), and remains an editable child beside the intact Boolean shell.
 // The standard top/underside label paths below are unchanged.
 if(isGroup(node)){
   let shell:ShellInfo|undefined;
   try{shell=identifyShell(selectedId,project);}catch{/* This may be a matching lid. */}
   if(shell){
     if(o.mode==="recessed" && o.depth>shell.wallY-0.35)
       throw new Error("Engraving is too deep for this wall. Reduce text depth.");
     const corner=uniformUprightRadius(shell.outer);
     const usableW=shell.width-2*Math.max(shell.wallX,corner,2);
     if(usableW<=4)throw new Error("Not enough flat wall for a label.");
     const labels=labelParts(o,[shell.cx,0],0,"top",usableW,shell.height-1);
     const outerY=shell.cy-shell.depth/2;
     const anchoredY=outerY+(o.mode==="raised"?-o.depth/2+0.2:o.depth/2-0.2);
     const middleZ=shell.bottom+shell.height/2;
     for(const label of labels){
       const lineOffset=label.position[1];
       label.rotation=[Math.PI/2,0,0]; // readable upright from outside -Y
       label.position=[shell.cx,anchoredY,middleZ+lineOffset];
     }
     return wrapAddition(selectedId,"Labelled hollow box",labels);
   }
 }
 let center:[number,number],surface:number,w:number,d:number,face:"top"|"lid-underside"="top";
 if(!isGroup(node) && node.kind==="box"&&node.role==="solid"&&
 node.rotation.every(x=>Math.abs(x)<0.00001)&&node.scale.every(x=>Math.abs(x-1)<0.00001)){
  center=[node.position[0],node.position[1]];
  surface=node.position[2]+Number(node.params.h)/2;
  w=Number(node.params.w);d=Number(node.params.d);
 }else{
  const lid=identifyLid(selectedId);
  center=[lid.worldX,lid.worldY];
  surface=lid.bottom;
  w=Number(lid.panel.params.w);d=Number(lid.panel.params.d);
  face="lid-underside";
  if(o.depth>=Number(lid.panel.params.h)-0.3)throw new Error("Engraving would penetrate the lid.");
 }
 return wrapAddition(selectedId,"Labelled "+(face==="top"?"part":"lid"),labelParts(o,center,surface,face,w,d));
}
