import * as THREE from "three";
import {isGroup,type Project,type ShapeNode} from "../types/scene";

export interface LabelMoveTarget {
 groupId:string;
 labelIds:string[];
 originalPositions:[number,number,number][];
 text:string;
 center:[number,number,number]; // current world position
 localCenter:[number,number,number]; // inside wrapper group, before wrapper transform
 surfaceCenterLocal:[number,number];
 surfaceNormalWorld:[number,number,number];
 maxX:number;
 maxY:number;
 outwardSign:-1|1;
 worldMatrix:THREE.Matrix4;
 inverseMatrix:THREE.Matrix4;
}
const vector=(x:[number,number,number])=>new THREE.Vector3(...x);
const composed=(p:[number,number,number],r:[number,number,number],s:[number,number,number])=>
 new THREE.Matrix4().compose(vector(p),new THREE.Quaternion().setFromEuler(new THREE.Euler(...r,"XYZ")),vector(s));
const finitePositive=(s:[number,number,number])=>s.every(v=>Number.isFinite(v)&&v>0);
const cleanVec=(p:[number,number,number])=>p.every(Number.isFinite);
/** Find a labelled box or matching lid without changing its groups.
 * Supports flipped/rotated outer assemblies and existing nonuniform scales,
 * but deliberately rejects large rotations INSIDE the child lid geometry. */
export function labelMoveTarget(id:string,project:Project):LabelMoveTarget {
 const outer=project.nodes[id];
 if(!outer||!isGroup(outer)||!project.rootOrder.includes(id)||outer.locked||outer.hidden||
   !cleanVec(outer.position)||!cleanVec(outer.rotation)||!finitePositive(outer.scale))
   throw new Error("Select a visible, unlocked labelled box or lid.");
 const children=outer.childIds.map(cid=>project.nodes[cid]);
 if(children.length<2||children.some(x=>!x))throw new Error("No editable label was found.");
 const [base,...labels]=children;
 if(!base||labels.some(n=>isGroup(n)||n.kind!=="text"||n.locked||n.hidden))
  throw new Error("Select a labelled lid or labelled box.");
 const texts=labels as ShapeNode[];
 if(texts.some(n=>!cleanVec(n.position)||n.rotation.some(v=>!Number.isFinite(v)||Math.abs(v)>0.01)||
  n.scale.some(v=>!Number.isFinite(v)||Math.abs(v)<0.05)))
  throw new Error("Separately rotated or flattened text is not supported yet.");
 let center:THREE.Vector3,w:number,d:number,outwardSign:-1|1;
 if(isGroup(base)){
  if(base.childIds.length!==3||!cleanVec(base.position)||!finitePositive(base.scale)||
    base.rotation.some(v=>!Number.isFinite(v)||Math.abs(v)>0.01))
    throw new Error("The underlying lid has unusual internal geometry.");
  const [panel,ring,opening]=base.childIds.map(i=>project.nodes[i]);
  if(!panel||isGroup(panel)||panel.kind!=="box"||panel.role!=="solid"||
     !ring||isGroup(ring)||ring.role!=="solid"||!opening||isGroup(opening)||opening.role!=="hole")
    throw new Error("The underlying object is not a generated matching lid.");
  w=Number(panel.params.w)*base.scale[0];d=Number(panel.params.d)*base.scale[1];
  const mat=composed(base.position,base.rotation,base.scale);
  center=new THREE.Vector3(panel.position[0],panel.position[1],
    panel.position[2]-Number(panel.params.h)/2).applyMatrix4(mat);
  outwardSign=-1;
 }else{
  if(base.kind!=="box"||base.role!=="solid"||!cleanVec(base.position)||!finitePositive(base.scale)||
      base.rotation.some(v=>!Number.isFinite(v)||Math.abs(v)>0.01))
    throw new Error("Only plain labelled boxes are supported.");
  w=Number(base.params.w)*base.scale[0];d=Number(base.params.d)*base.scale[1];
  center=new THREE.Vector3(base.position[0],base.position[1],
    base.position[2]+Number(base.params.h)*base.scale[2]/2);
  outwardSign=1;
 }
 if(![w,d,center.x,center.y,center.z].every(Number.isFinite)||w<=0||d<=0)
  throw new Error("Invalid labelled face dimensions.");
 const local:[number,number,number]=[
  texts.reduce((acc,n)=>acc+n.position[0],0)/texts.length,
  texts.reduce((acc,n)=>acc+n.position[1],0)/texts.length,
  texts.reduce((acc,n)=>acc+n.position[2],0)/texts.length
 ];
 const halfW=Math.max(...texts.map(n=>String(n.params.value||"").length*Number(n.params.size||5)*0.31*Math.abs(n.scale[0])));
 const halfH=Math.max(...texts.map(n=>Number(n.params.size||5)*0.55*Math.abs(n.scale[1])));
 const extraY=Math.max(...texts.map(n=>Math.abs(n.position[1]-local[1])));
 const maxX=Math.max(0,w/2-halfW-1);
 const maxY=Math.max(0,d/2-halfH-extraY-1);
 if(maxX<0.05||maxY<0.05)throw new Error("Label is too large to reposition safely.");
 const worldMatrix=composed(outer.position,outer.rotation,outer.scale);
 const inverseMatrix=worldMatrix.clone().invert();
 const worldCenter=vector(local).applyMatrix4(worldMatrix);
 const normal=new THREE.Vector3(0,0,1).transformDirection(worldMatrix);
 return {
  groupId:id,labelIds:texts.map(n=>n.id),
  originalPositions:texts.map(n=>[...n.position]),
  text:texts.map(n=>String(n.params.value||"")).join(" / "),
  center:[worldCenter.x,worldCenter.y,worldCenter.z],
  localCenter:local,
  surfaceCenterLocal:[center.x,center.y],
  surfaceNormalWorld:[normal.x,normal.y,normal.z],
  maxX,maxY,outwardSign,
  worldMatrix,inverseMatrix,
 };
}
/** dx/dy are always parent-lid local millimetres, regardless of camera rotation. */
export function boundedLabelDelta(t:LabelMoveTarget,dx:number,dy:number):[number,number]{
 if(!Number.isFinite(dx)||!Number.isFinite(dy))return [0,0];
 const x=Math.max(t.surfaceCenterLocal[0]-t.maxX,Math.min(t.surfaceCenterLocal[0]+t.maxX,t.localCenter[0]+dx));
 const y=Math.max(t.surfaceCenterLocal[1]-t.maxY,Math.min(t.surfaceCenterLocal[1]+t.maxY,t.localCenter[1]+dy));
 return [Math.round((x-t.localCenter[0])*10)/10,Math.round((y-t.localCenter[1])*10)/10];
}
export function previewLabelNodes(t:LabelMoveTarget,source:Project["nodes"],dx:number,dy:number):Project["nodes"] {
 const nodes={...source};
 t.labelIds.forEach((id,i)=>{
  const old=nodes[id];if(!old||isGroup(old))return;
  nodes[id]={...old,position:[
   t.originalPositions[i][0]+dx,
   t.originalPositions[i][1]+dy,
   t.originalPositions[i][2],
  ]};
 });
 return nodes;
}
