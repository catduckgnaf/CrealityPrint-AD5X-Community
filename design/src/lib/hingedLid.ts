/** AD5X v19.5.53 — removable-pin box/lid hinge, fully EDITABLE primitives.
 *
 * Geometry is split between TWO independent print parts: the original hollow
 * shell + its own outer knuckles, and the matching lid + its centre knuckle.
 * A real pin/rod is inserted after printing. No fake moving/animated joint,
 * no adjustment to the existing slicer, and NO silently inferred lid dimensions.
 *
 * All positions are WORLD coordinates. Because roots are only translated (no
 * rotations/scales), identity wrapper groups preserve the existing CSG and
 * both original print-part coordinate systems exactly.
 */
import {useScene} from "../state/store";
import {makeShape} from "./primitives";
import {identifyShell,type ShellInfo} from "./boxFitTools";
import {newId} from "./id";
import {isGeneratedHingeWrapper} from "./generatedFeatures";
import {isGroup,type GroupNode,type Project,type ShapeNode,type Vec3} from "../types/scene";

export type HingeSide="front"|"back"|"left"|"right";
export interface HingeOptions {
 side:HingeSide;
 span:number;             // combined 3-knuckle length in mm
 barrelDiameter:number;
 pinDiameter:number;
 boreClearance:number;    // added to pin DIAMETER; not a calibrated fit guarantee
 knuckleGap:number;       // axial gap between different printed knuckles
 offset:number;           // along selected wall, from centre, mm
}
export const DEFAULT_HINGE_OPTIONS:HingeOptions={
 side:"back",span:36,barrelDiameter:7,pinDiameter:2.4,
 boreClearance:0.35,knuckleGap:0.4,offset:0,
};
export interface HingedLidCandidate {
 id:string;label:string;
 x:number;y:number;
 width:number;depth:number;
 panelBottom:number;panelThickness:number;
 ringWidth:number;ringDepth:number;
}
export interface HingePlan {
 project:Project;boxId:string;lidId:string;
 boxAdded:ShapeNode[];lidAdded:ShapeNode[];
 pinHoleDiameter:number;knuckleLength:number;
}

const within=(a:number,b:number,tolerance=1e-4)=>Math.abs(a-b)<=tolerance;
const identityOrientation=(n:GroupNode)=>n.rotation.every(x=>within(x,0))&&
 n.scale.every(x=>within(x,1));

/** Read ORIGINAL matching-lid group even if its top-level part already has
 * independent edits. Strictly recognise original 3 children, not an arbitrary
 * group that happens to be named "lid". Never rotate or reposition lid roots.
 */
export function inspectLid(project:Project,id:string):HingedLidCandidate|null{
 const top=project.nodes[id];
 if(!top||!isGroup(top)||!project.rootOrder.includes(id)||top.hidden||top.locked)return null;
 let node:GroupNode=top;const offset:Vec3=[0,0,0];
 const visited=new Set<string>();
 for(let depth=0;depth<10;depth++){
  if(visited.has(node.id)||!identityOrientation(node)||node.hidden||node.locked)return null;
  visited.add(node.id);
  for(let a=0;a<3;a++)offset[a]+=node.position[a];
  const children=node.childIds.map(c=>project.nodes[c]);
  if(children.length===3&&children.every(x=>x&&!isGroup(x))){
   const [panel,ring,hole]=children as ShapeNode[];
   if(panel.kind!=="box"||ring.kind!=="box"||hole.kind!=="box"||
      panel.role!=="solid"||ring.role!=="solid"||hole.role!=="hole"||
      panel.rotation.some(x=>!within(x,0))||panel.scale.some(x=>!within(x,1))||
      panel.hidden||panel.locked||ring.hidden||hole.hidden)return null;
   const w=Number(panel.params.w),d=Number(panel.params.d),h=Number(panel.params.h),
     rw=Number(ring.params.w),rd=Number(ring.params.d);
   if(![w,d,h,rw,rd,...panel.position].every(Number.isFinite)||
      w<=0||d<=0||h<1||rw<=0||rd<=0||rw>=w||rd>=d)return null;
   return {id,label:top.label||"Matching lid",
     x:offset[0]+panel.position[0],y:offset[1]+panel.position[1],
     width:w,depth:d,ringWidth:rw,ringDepth:rd,
     panelBottom:offset[2]+panel.position[2]-h/2,panelThickness:h};
  }
  const next=children[0];
  if(!next||!isGroup(next))return null;
  node=next;
 }
 return null;
}
export function matchingLids(project:Project,shellId:string):HingedLidCandidate[]{
 const shell=identifyShell(shellId,project);
 return project.rootOrder.filter(id=>id!==shellId).flatMap(id=>{
  const lid=inspectLid(project,id);
  if(!lid)return [];
  // Match BOTH external panel and internal lip envelope; nominal fit is NOT
  // print-fit proof. Never infer two unrelated solids are a box/lid pair.
  const maxOverhang=6.1;
  const panelMatches=lid.width>=shell.width-.02&&
    lid.width<=shell.width+2*maxOverhang &&
    lid.depth>=shell.depth-.02&&lid.depth<=shell.depth+2*maxOverhang;
  const iw=Number(shell.cavity.params.w),idp=Number(shell.cavity.params.d);
  const lipMatches=lid.ringWidth<iw-.1&&lid.ringDepth<idp-.1&&
    lid.ringWidth>=iw-4.1&&lid.ringDepth>=idp-4.1;
  return panelMatches&&lipMatches?[lid]:[];
 });
}
export function matchingShells(project:Project,lidId:string):string[]{
 if(!inspectLid(project,lidId))return [];
 return project.rootOrder.filter(id=>{
  if(id===lidId)return false;
  try{return matchingLids(project,id).some(c=>c.id===lidId);}
  catch{return false;}
 });
}
export function hingeCandidatePairs(project:Project,selectedId:string):{
 shellIds:string[];lidIds:string[];
}{
 if(inspectLid(project,selectedId)){
  const shells=matchingShells(project,selectedId);
  return {shellIds:shells,lidIds:[selectedId]};
 }
 try{return {shellIds:[selectedId],lidIds:matchingLids(project,selectedId).map(c=>c.id)};}
 catch{return {shellIds:[],lidIds:[]};}
}
const validate=(value:number,name:string,min:number,max:number)=>{
 if(!Number.isFinite(value)||value<min||value>max)
  throw new Error(name+" must be between "+min+" and "+max+" mm.");
 return value;
};
const cyl=(radius:number,length:number,xyz:Vec3,axis:"x"|"y",role:"solid"|"hole",name:string):ShapeNode=>{
 const p=makeShape("cylinder");
 p.params={r:radius,h:length,segments:80,bevel:0};p.role=role;p.label=name;
 p.position=[...xyz];p.rotation=axis==="x"?[0,Math.PI/2,0]:[-Math.PI/2,0,0];
 return p;
};
const anchor=(axis:"x"|"y",axial:number,inner:number,outer:number,
 zLow:number,zHigh:number,length:number,name:string):ShapeNode=>{
 const p=makeShape("box");
 const radialSpan=Math.abs(outer-inner)+.35;
 const radialCenter=(inner+outer)/2;
 p.params=axis==="x"?
  {w:length,d:radialSpan,h:zHigh-zLow,radius:0}:
  {w:radialSpan,d:length,h:zHigh-zLow,radius:0};
 p.position=axis==="x"?[axial,radialCenter,(zLow+zHigh)/2]:
                             [radialCenter,axial,(zLow+zHigh)/2];
 p.role="solid";p.label=name;return p;
};
const cylinderPos=(axis:"x"|"y",axial:number,radial:number,z:number):Vec3=>
 axis==="x"?[axial,radial,z]:[radial,axial,z];

function geometryParts(
 shell:ShellInfo,lid:HingedLidCandidate,o:HingeOptions
):{box:ShapeNode[];lid:ShapeNode[];length:number;holeDiameter:number}{
 if(!["front","back","left","right"].includes(o.side))throw new Error("Choose a hinge wall.");
 validate(o.barrelDiameter,"Barrel diameter",4.5,14);
 validate(o.pinDiameter,"Hinge pin diameter",1,7);
 validate(o.boreClearance,"Bore diameter allowance",0.1,1.5);
 validate(o.knuckleGap,"Knuckle end gap",0.2,1.5);
 const holeDiameter=o.pinDiameter+o.boreClearance;
 if(o.barrelDiameter-holeDiameter<2.4)
  throw new Error("Leave at least 1.2 mm of barrel wall around the pin bore.");
 const r=o.barrelDiameter/2,axis=o.side==="front"||o.side==="back"?"x":"y";
 const lengthAvailable=axis==="x"?Math.min(shell.width,lid.width):Math.min(shell.depth,lid.depth);
 validate(o.span,"Total hinge span",18,Math.min(120,lengthAvailable-2*r-3));
 validate(o.offset,"Hinge position from centre",-100,100);
 const length=(o.span-2*o.knuckleGap)/3;
 if(length<4)throw new Error("Hinge knuckles are too short.");
 if(Math.abs(o.offset)+o.span/2>lengthAvailable/2-r-1.5)
  throw new Error("Hinge is too near the box or lid corner.");
 // Box-side barrel on selected OUTSIDE wall; printed lid is FACE-DOWN, so its
 // matching knuckle is on the OPPOSITE edge in lid-print orientation. When
 // assembled, the lid flips around the pin axis to place the lip inside.
 const sign=o.side==="back"||o.side==="right"?1:-1;
 const boxSurface=(axis==="x"?shell.cy: shell.cx)+sign*
   (axis==="x"?shell.depth:shell.width)/2;
 const lidSurface=(axis==="x"?lid.y:lid.x)-sign*
   (axis==="x"?lid.depth:lid.width)/2;
 // Keep BOTH hinge axes outside the entire CLOSED lid panel, including its
 // overhang. The old 0.82*r placed the barrels INTO the overhanging panel.
 // This clearance is radial to the lid, NOT the separate hinge pin fit.
 const closedClearance=0.35;
 const panelOverhang=(axis==="x"?lid.depth-shell.depth:lid.width-shell.width)/2;
 const boxBarrel=boxSurface+sign*(panelOverhang+r+closedClearance);
 const lidBarrel=lidSurface-sign*(r+closedClearance);
 const axisBox=(axis==="x"?shell.cx:shell.cy)+o.offset;
 const axisLid=(axis==="x"?lid.x:lid.y)+o.offset;
 // After folding the face-down lid 180° about the hinge axis, its
 // underside (top face in print orientation) lands at shell.top.
 const lidZ=lid.panelBottom+r+.15;
 const boxZ=shell.top+(lid.panelBottom+lid.panelThickness)-lidZ;
 // The old leaves projected through the closed lid/box seam.
 // Box web must stop BELOW the rim; lid web must stop INSIDE the lid
 // panel, so after the 180-degree fold it never protrudes into the box.
 const boxMountLow=Math.min(shell.top-2.3,boxZ-r*.6),
   boxMountHigh=shell.top-closedClearance;
 const lidMountLow=lid.panelBottom+.05,
   lidMountHigh=lid.panelBottom+lid.panelThickness-closedClearance;
 const centres=[-(length+o.knuckleGap),0,length+o.knuckleGap];
 const box:ShapeNode[]=[],lidParts:ShapeNode[]=[];
 // End barrels attached to outer wall, middle barrel attached to lid panel.
 for(const ix of [0,2]){
  const a=axisBox+centres[ix];
  box.push(anchor(axis,a,boxSurface-sign*.65,boxBarrel,
    boxMountLow,boxMountHigh,length,"Box hinge mounting web "+(ix===0?"left":"right")));
  box.push(cyl(r,length,cylinderPos(axis,a,boxBarrel,boxZ),axis,"solid",
    "Box hinge outer knuckle "+(ix===0?"left":"right")));
  box.push(cyl(holeDiameter/2,length+.15,
    cylinderPos(axis,a,boxBarrel,boxZ),axis,"hole","Box hinge removable pin bore"));
 }
 const la=axisLid;
 lidParts.push(anchor(axis,la,lidSurface+sign*.65,lidBarrel,
   lidMountLow,lidMountHigh,length,"Lid hinge mounting web"));
 lidParts.push(cyl(r,length,cylinderPos(axis,la,lidBarrel,lidZ),axis,"solid",
   "Lid hinge centre knuckle"));
 lidParts.push(cyl(holeDiameter/2,length+.15,
   cylinderPos(axis,la,lidBarrel,lidZ),axis,"hole","Lid hinge removable pin bore"));
 return {box,lid:lidParts,length,holeDiameter};
}
const existingHinges=(project:Project,rootId:string)=>{
 let node=project.nodes[rootId];const seen=new Set<string>();
 for(let i=0;i<12&&node&&isGroup(node)&&!seen.has(node.id);i++){
  if(isGeneratedHingeWrapper(project,node))return true;
  seen.add(node.id);node=project.nodes[node.childIds[0]];
 }
 return false;
};
export function planHingedLid(project:Project,boxId:string,lidId:string,o:HingeOptions,bed?:[number,number]|null):HingePlan{
 if(boxId===lidId)throw new Error("Select one box and its separate matching lid.");
 const shell=identifyShell(boxId,project);
 const lid=matchingLids(project,boxId).find(c=>c.id===lidId);
 if(!lid)throw new Error("The lid does not match this hollow box, or is rotated/locked.");
 if(existingHinges(project,boxId)||existingHinges(project,lidId))
  throw new Error("A hinge is already attached. Edit or undo it before adding another.");
 const geo=geometryParts(shell,lid,o);
 if(bed){
  if(![bed[0],bed[1]].every(n=>Number.isFinite(n)&&n>0))
   throw new Error("Choose a valid print bed before adding a hinge.");
  const axis=o.side==="back"||o.side==="front"?"x":"y";
  for(const shape of [...geo.box,...geo.lid]){
   const cylinder=shape.kind==="cylinder";
   const hx=cylinder?(axis==="x"?Number(shape.params.h)/2:Number(shape.params.r)):
      Number(shape.params.w)/2;
   const hy=cylinder?(axis==="x"?Number(shape.params.r):Number(shape.params.h)/2):
      Number(shape.params.d)/2;
   if(shape.position[0]-hx < -bed[0]/2+.05||
      shape.position[0]+hx > bed[0]/2-.05||
      shape.position[1]-hy < -bed[1]/2+.05||
      shape.position[1]+hy > bed[1]/2-.05)
    throw new Error("The hinge would extend beyond the build plate. Move the box or lid inward.");
  }
 }
 const nodes={...project.nodes,...Object.fromEntries([...geo.box,...geo.lid].map(p=>[p.id,p]))};
 const boxRoot:GroupNode={id:newId(),type:"group",label:"Box with removable-pin hinge",feature:"hinge-box",
  position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],
  childIds:[boxId,...geo.box.map(p=>p.id)]};
 const lidRoot:GroupNode={id:newId(),type:"group",label:"Lid with removable-pin hinge",feature:"hinge-lid",
  position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],
  childIds:[lidId,...geo.lid.map(p=>p.id)]};
 nodes[boxRoot.id]=boxRoot;nodes[lidRoot.id]=lidRoot;
 const rootOrder=project.rootOrder.map(id=>
  id===boxId?boxRoot.id:id===lidId?lidRoot.id:id);
 return {project:{...project,nodes,rootOrder},boxId:boxRoot.id,lidId:lidRoot.id,
  boxAdded:geo.box,lidAdded:geo.lid,pinHoleDiameter:geo.holeDiameter,
  knuckleLength:geo.length};
}
export function addHingedLid(boxId:string,lidId:string,o:HingeOptions):HingePlan{
 const result=planHingedLid(useScene.getState().project,boxId,lidId,o,useScene.getState().bed);
 useScene.setState({project:result.project,selection:[result.boxId]});
 return result;
}