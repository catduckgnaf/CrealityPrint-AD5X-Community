/**
 * Apply the EXISTING banana, DB9 and round connector tools to the selected
 * solid, whether a plain primitive, mesh, or an already edited/grouped model.
 * Preserve the existing hollow-shell cutters unchanged where identifyShell works.
 * The fallback is world-axis through-cuts through the selected model's bounding box.
 */
import * as THREE from "three";
import {groupPath} from "./groupWorkflow";
import {identifyShell} from "./boxFitTools";
import {hasSolidContent,type Project,type GroupNode,type ShapeNode} from "../types/scene";
import {makeShape,buildGeometry} from "./primitives";
import {evaluateGroup} from "./csg";
import {composeMatrix,bakeTransform} from "./transform";
import {isGroup} from "../types/scene";
import {newId} from "./id";
import {bundleConnectorCutters} from "./connectorCutGroup";
import {sceneApi} from "./sceneApi";
import {useScene} from "../state/store";
import {bananaBoxHoleIssues,type BananaBoxCutOptions,type BananaBoxFace,type PanelSizeInfo} from "./workshopTools";
import {db9BoxIssues,db9PanelProfile,DB9_PANEL,type DB9BoxOptions} from "./db9BoxMount";
import {roundMountIssues,roundConnector,type RoundMountOptions} from "./roundPanelMount";

export type ModelPanelTarget={id:string;sh:PanelSizeInfo;shell:boolean;bounds:THREE.Box3|null};

export function editableModelRoot(project:Project,selection:readonly string[]):string{
 if(selection.length!==1)throw new Error("Select the model you want to edit.");
 const path=groupPath(project,selection[0]);
 if(!path.length)throw new Error("Select a model in the Design workspace.");
 for(const id of path){
  const n=project.nodes[id];
  if(!n||n.locked||n.hidden)throw new Error("Unlock and show the selected model to modify it.");
 }
 const id=path[0];
 if(!hasSolidContent(id,project.nodes))
  throw new Error("Select a solid shape, not a standalone cutter.");
 return id;
}

export function panelBoundsInfo(bounds:THREE.Box3):PanelSizeInfo{
 if(!bounds||bounds.isEmpty())throw new Error("Cannot measure the selected model.");
 const size=bounds.getSize(new THREE.Vector3());
 if(![size.x,size.y,size.z,...bounds.min.toArray(),...bounds.max.toArray()].every(Number.isFinite)
    ||Math.min(size.x,size.y,size.z)<0.8)
  throw new Error("The selected model has no usable three-dimensional bounds.");
 // Only the dimensions needed by the existing positioning editors.
 // For an arbitrary solid, "floor" means its bottom face; all side faces
 // use the complete model height rather than a hollow-shell rim height.
 return {width:size.x,depth:size.y,height:size.z,floor:0,
  cavity:{params:{w:size.x,d:size.y}}};
}

export function modelPanelTarget(project:Project,selection:readonly string[],
 measure:(id:string)=>THREE.Box3|null=sceneApi.getNodeBounds):ModelPanelTarget{
 const id=editableModelRoot(project,selection);
 try {
  const sh=identifyShell(id,project);
  return {id,sh,shell:true,bounds:null};
 }catch{/* Ordinary solid or group rather than the known-good hollow shell. */}
 const bounds=measure(id);
 if(!bounds)throw new Error("Cannot measure this model yet. Select it once in the viewport.");
 return {id,sh:panelBoundsInfo(bounds),shell:false,bounds};
}

type Frame={cx:number;cy:number;cz:number;size:THREE.Vector3};
const validBounds=(b:THREE.Box3):Frame=>{
 panelBoundsInfo(b);
 const c=b.getCenter(new THREE.Vector3()),size=b.getSize(new THREE.Vector3());
 return {cx:c.x,cy:c.y,cz:c.z,size};
};
function faceFrame(b:THREE.Box3,face:BananaBoxFace,u:number,v:number){
 const f=validBounds(b);
 if(!Number.isFinite(u)||!Number.isFinite(v))throw new Error("Use finite hole positions.");
 if(face==="floor")return {position:[f.cx+u,f.cy+v,f.cz] as [number,number,number],
  rotation:[0,0,0] as [number,number,number],length:f.size.z+2};
 if(face==="front"||face==="back")return {position:[f.cx+u,f.cy,f.cz+v] as [number,number,number],
  rotation:[Math.PI/2,0,0] as [number,number,number],length:f.size.y+2};
 if(face==="left"||face==="right")return {position:[f.cx,f.cy+u,f.cz+v] as [number,number,number],
  rotation:[0,Math.PI/2,0] as [number,number,number],length:f.size.x+2};
 throw new Error("Choose a valid face.");
}
function circle(d:number,pos:[number,number,number],rot:[number,number,number],len:number,label:string):ShapeNode{
 const n=makeShape("cylinder");
 n.role="hole";n.params={r:d/2,h:len,segments:64,bevel:0};
 n.position=pos;n.rotation=rot;n.label=label;
 return n;
}
export function modelBananaHoleParts(bounds:THREE.Box3,o:BananaBoxCutOptions):ShapeNode[]{
 const problems=bananaBoxHoleIssues(panelBoundsInfo(bounds),o);
 if(problems.length)throw new Error(problems.join(" "));
 return o.points.map(([u,v],i)=>{
  const {position,rotation,length}=faceFrame(bounds,o.face,u,v);
  return circle(o.diameter,position,rotation,length,"Banana plug "+(i+1)+" - "+o.face+" opening");
 });
}
export function modelRoundMountParts(bounds:THREE.Box3,o:RoundMountOptions):ShapeNode[]{
 const problems=roundMountIssues(panelBoundsInfo(bounds),o);
 if(problems.length)throw new Error(problems.join(" "));
 const model=roundConnector(o.id);
 const {position,rotation,length}=faceFrame(bounds,o.face,o.offsetX,o.offsetY);
 return [circle(model.cutoutDiameter+2*o.radialClearance,position,rotation,length,model.label+" circular mounting opening")];
}
export function modelDB9Parts(bounds:THREE.Box3,o:DB9BoxOptions):ShapeNode[]{
 const problems=db9BoxIssues(panelBoundsInfo(bounds),o);
 if(problems.length)throw new Error(problems.join(" "));
 const f=faceFrame(bounds,o.face,o.offsetX,o.offsetY);
 // Existing profile geometry, mounting pitch, and flip remain exactly the same.
 // The left/right sketch needs its original Z rotation as in the known-good tool.
 const profile=makeShape("sketch");
 profile.label="DB9 "+o.gender+" D-shaped panel opening";
 profile.role="hole";
 profile.params={profile:JSON.stringify(db9PanelProfile(o.clearance,o.flipKey)),h:f.length};
 profile.position=f.position;profile.rotation=o.face==="left"||o.face==="right"?
  [0,Math.PI/2,Math.PI/2]:f.rotation;
 const parts=[profile];
 if(o.addMountingHoles){
  for(const sign of [-1,1]){
   const [x,y,z]=f.position;
   const pos:[number,number,number]=o.face==="floor"||o.face==="front"||o.face==="back"?
    [x+sign*DB9_PANEL.pitch/2,y,z]:[x,y+sign*DB9_PANEL.pitch/2,z];
   const bore=circle(o.mountingDiameter,pos,f.rotation,f.length,"DB9 "+o.gender+" screw hole "+(sign<0?1:2));
   parts.push(bore);
  }
 }
 return parts;
}

export function planModelPanelCut(project:Project,rootId:string,cutters:ShapeNode[],label:string){
 if(editableModelRoot(project,[rootId])!==rootId)throw new Error("Select an editable top-level model.");
 if(!cutters.length||cutters.some(x=>x.role!=="hole"||!x.position.every(Number.isFinite)))
  throw new Error("No valid cutting shapes.");
 if(new Set(cutters.map(x=>x.id)).size!==cutters.length||
    cutters.some(c=>!!project.nodes[c.id]))throw new Error("The new cutter IDs conflict with saved geometry.");
 const gid=newId();
 const group:GroupNode={id:gid,type:"group",label,childIds:[rootId,...cutters.map(c=>c.id)],
  position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]};
 return {project:{...project,
  nodes:{...project.nodes,...Object.fromEntries(cutters.map(c=>[c.id,c])),[gid]:group},
  rootOrder:project.rootOrder.map(x=>x===rootId?gid:x)},selectionId:gid};
}
export function applyModelPanelCut(rootId:string,bounds:THREE.Box3,
 kind:"banana"|"db9"|"round",options:BananaBoxCutOptions|DB9BoxOptions|RoundMountOptions):string{
 let selected=rootId;
 useScene.setState(state=>{
  const cutters=kind==="banana"?modelBananaHoleParts(bounds,options as BananaBoxCutOptions):
   kind==="db9"?modelDB9Parts(bounds,options as DB9BoxOptions):
   modelRoundMountParts(bounds,options as RoundMountOptions);
  const plan=planModelPanelCut(state.project,rootId,cutters,"Model with connector cutouts");
  const updated=kind==="db9"?
   bundleConnectorCutters(plan.project,plan.selectionId,cutters,
    "DB9 "+(options as DB9BoxOptions).gender+" cutout").project:
   plan.project;
  selected=plan.selectionId;
  return {project:updated,selection:[selected]};
 });
 return selected;
}

/** The original "Jig drill pattern" editor can cut any selected solid,
 * not only the generated plain-box jig. All offsets remain relative to the model.
 */
export function modelDrillParts(bounds:THREE.Box3,diameter:number,points:readonly [number,number][]):ShapeNode[]{
 const sh=panelBoundsInfo(bounds);
 if(!Number.isFinite(diameter)||diameter<1||diameter>25)
  throw new Error("Hole diameter must be 1–25 mm.");
 if(!Array.isArray(points)||points.length<1||points.length>32)
  throw new Error("Enter 1 to 32 hole positions.");
 const checked:[number,number][]=[];
 for(const point of points){
  if(!Array.isArray(point)||point.length!==2||!point.every(Number.isFinite))
   throw new Error("Hole positions must be finite X/Y coordinates.");
  const [x,y]=point;
  if(Math.abs(x)+diameter/2>sh.width/2-4+1e-9||
     Math.abs(y)+diameter/2>sh.depth/2-4+1e-9)
   throw new Error("Keep at least 4 mm inside the model's X/Y bounding edges.");
  if(checked.some(([a,b])=>Math.hypot(a-x,b-y)<diameter+2-1e-9))
   throw new Error("Drilled holes must leave 2 mm between openings.");
  checked.push([x,y]);
 }
 const frame=validBounds(bounds);
 return checked.map(([x,y],i)=>circle(diameter,[frame.cx+x,frame.cy+y,frame.cz],
  [0,0,0],frame.size.z+2,"Jig drill hole "+(i+1)));
}
export function modelDrillGrid(dia:number,cols:number,rows:number,pitchX:number,pitchY:number,offsetX=0,offsetY=0):[number,number][]{
 if(!Number.isInteger(cols)||cols<1||cols>8||!Number.isInteger(rows)||rows<1||rows>8||cols*rows>32)
  throw new Error("Use 1–8 holes per direction, no more than 32 total.");
 if(![dia,pitchX,pitchY,offsetX,offsetY].every(Number.isFinite)||pitchX<0||pitchY<0||
    (cols>1&&pitchX<dia+2)||(rows>1&&pitchY<dia+2))
  throw new Error("Leave at least 2 mm between the drilled holes.");
 const points:[number,number][]=[];
 for(let x=0;x<cols;x++)for(let y=0;y<rows;y++)
  points.push([offsetX+(x-(cols-1)/2)*pitchX,offsetY+(y-(rows-1)/2)*pitchY]);
 return points;
}
export function applyModelDrill(rootId:string,bounds:THREE.Box3,dia:number,points:readonly [number,number][]):string{
 let selected=rootId;
 useScene.setState(state=>{
  const cutters=modelDrillParts(bounds,dia,points);
  const plan=planModelPanelCut(state.project,rootId,cutters,"Jig drill holes");
  selected=plan.selectionId;
  return {project:plan.project,selection:[selected]};
 });
 return selected;
}

/** The EXISTING cable-opening tool also works on an ordinary model's side.
 * Its existing X/Y offset controls and wall side selector are unchanged.
 */
export function modelCableOpeningParts(bounds:THREE.Box3,side:"front"|"back"|"left"|"right",
 width:number,height:number,offset:number,bottom:number):ShapeNode[]{
 const frame=validBounds(bounds),b=frame.size;
 if(!["front","back","left","right"].includes(side))throw new Error("Choose a side.");
 if(![width,height,offset,bottom].every(Number.isFinite)||
    width<2||width>100||height<2||height>40||bottom<1)
  throw new Error("Enter a valid cable opening and height above the base.");
 const span=side==="front"||side==="back"?b.x:b.y;
 if(Math.abs(offset)+width/2>span/2-2)
  throw new Error("Keep the opening at least 2 mm from the side edges.");
 if(bottom+height>b.z-1)
  throw new Error("Leave at least 1 mm above the opening and below its bottom clearance.");
 const n=makeShape("box");n.role="hole";
 const len=(side==="front"||side==="back"?b.y:b.x)+2;
 n.params=side==="front"||side==="back"?{w:width,d:len,h:height,radius:0}:
  {w:len,d:width,h:height,radius:0};
 const cx=frame.cx,cy=frame.cy,cz=bounds.min.z+bottom+height/2;
 n.position=side==="front"||side==="back"?[cx+offset,cy,cz]:[cx,cy+offset,cz];
 n.label="Cable opening on "+side+" side";
 return [n];
}
export function applyModelCableOpening(rootId:string,bounds:THREE.Box3,side:"front"|"back"|"left"|"right",
 width:number,height:number,offset:number,bottom:number):string{
 let selected=rootId;
 useScene.setState(state=>{
  const plan=planModelPanelCut(state.project,rootId,
   modelCableOpeningParts(bounds,side,width,height,offset,bottom),"Model with cable opening");
  selected=plan.selectionId;
  return {project:plan.project,selection:[selected]};
 });
 return selected;
}


/** Reuse the EXISTING four-mounting-post operation on selected ordinary solids.
 * Probe the actual top surface at proposed post centres; never add floating
 * posts at box-corner coordinates outside a sphere or curved object.
 */
export function modelMountingPostParts(project:Project,rootId:string,bounds:THREE.Box3,
 diameter:number,bore:number,height:number):ShapeNode[]{
 if(![diameter,bore,height].every(Number.isFinite)||
    diameter<4||diameter>16||bore<1||bore>diameter-1.5||height<3||height>60)
  throw new Error("Post diameter, pilot bore or post height is out of range.");
 const frame=validBounds(bounds),r=diameter/2;
 if(frame.size.x<diameter*2+2||frame.size.y<diameter*2+2)
  throw new Error("This model is too narrow for four mounting posts.");
 const n=project.nodes[rootId];
 if(!n)throw new Error("Select an editable model.");
 const baseGeometry=isGroup(n)?evaluateGroup(n,project.nodes):buildGeometry(n);
 if(!baseGeometry)throw new Error("The selected model has no usable solid geometry.");
 const world=bakeTransform(baseGeometry,composeMatrix(n.position,n.rotation,n.scale));
 const mesh=new THREE.Mesh(world,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
 mesh.updateMatrixWorld(true);
 const inset=r+0.5;
 let points:{x:number;y:number;z:number}[]=[];
 for(const scale of [1,0.9,0.8,0.7,0.6,0.5,0.4]){
  const trial:{x:number;y:number;z:number}[]=[];
  const dx=(frame.size.x/2-inset)*scale,dy=(frame.size.y/2-inset)*scale;
  if(Math.min(dx,dy)<r+1)continue;
  for(const sx of [-1,1])for(const sy of [-1,1]){
   const x=frame.cx+sx*dx,y=frame.cy+sy*dy;
   const ray=new THREE.Raycaster(new THREE.Vector3(x,y,bounds.max.z+height+5),new THREE.Vector3(0,0,-1));
   ray.near=0;ray.far=frame.size.z+height+15;
   const hit=ray.intersectObject(mesh,false)[0];
   if(hit)trial.push({x,y,z:hit.point.z});
  }
  if(trial.length===4){points=trial;break;}
 }
 world.dispose();
 if(points.length!==4)
  throw new Error("Four posts cannot attach securely at these locations. Choose a larger or flatter surface.");
 const parts:ShapeNode[]=[];
 for(const p of points){
  const solid=makeShape("cylinder");
  solid.role="solid";solid.params={r,h:height+0.6,segments:64,bevel:0};
  solid.position=[p.x,p.y,p.z+(height+0.6)/2-0.6];
  solid.label="Corner mounting post";
  const cutter=circle(bore,[p.x,p.y,p.z+1+(height-0.5)/2],
   [0,0,0],height-0.5,"Blind mounting bore");
  parts.push(solid,cutter);
 }
 return parts;
}
export function applyModelMountingPosts(rootId:string,bounds:THREE.Box3,
 diameter:number,bore:number,height:number):string{
 let selected=rootId;
 useScene.setState(state=>{
  if(editableModelRoot(state.project,[rootId])!==rootId)throw new Error("Select an editable model.");
  const parts=modelMountingPostParts(state.project,rootId,bounds,diameter,bore,height);
  const id=newId();
  const group:GroupNode={id,type:"group",label:"Model with mounting posts",childIds:[rootId,...parts.map(p=>p.id)],
   position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]};
  const nextNodes={...state.project.nodes,...Object.fromEntries(parts.map(p=>[p.id,p])),[id]:group};
  selected=id;
  return {project:{...state.project,nodes:nextNodes,rootOrder:state.project.rootOrder.map(r=>r===rootId?id:r)},
   selection:[selected]};
 });
 return selected;
}

