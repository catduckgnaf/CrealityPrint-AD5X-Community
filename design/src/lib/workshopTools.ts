import {isGroup,type Project,type ShapeNode,type GroupNode} from "../types/scene";
import {basicBox,identifyShell,limits,type ShellInfo} from "./boxFitTools";
import {makeShape} from "./primitives";
import {newId} from "./id";
import {useScene} from "../state/store";
import {groupPath} from "./groupWorkflow";
import {isGeneratedDividerLayer,partialDividerAxis} from "./generatedFeatures";

export type Axis="x"|"y";
export type Point=[number,number];
export type Wall={id:string;axis:Axis;cross:number;lo:number;hi:number;thickness:number;partial:boolean};
export type Compartment={xMin:number;xMax:number;yMin:number;yMax:number;width:number;depth:number};
export type DrillGrid={width:number;depth:number;height:number;diameter:number;columns:number;rows:number;pitchX:number;pitchY:number;fence:boolean;offsetX?:number;offsetY?:number};
export type CableSide="front"|"back"|"left"|"right";
const near=(a:number,b:number,e=0.00001)=>Math.abs(a-b)<=e;
const maxZ=18;
function rootShell(project:Project,rootId:string){return identifyShell(rootId,project);}
function boundedPoint(sh:ShellInfo,p:Point){
 if(p.length!==2||p.some(x=>!Number.isFinite(x)))throw new Error("Choose a valid position inside the tray.");
 const w=Number(sh.cavity.params.w),d=Number(sh.cavity.params.d);
 const xMin=sh.cx-w/2,xMax=sh.cx+w/2,yMin=sh.cy-d/2,yMax=sh.cy+d/2;
 if(p[0]<=xMin||p[0]>=xMax||p[1]<=yMin||p[1]>=yMax)
  throw new Error("Click the inside floor of the tray.");
 return {xMin,xMax,yMin,yMax};
}
function identity(n:GroupNode){return !n.locked&&!n.hidden&&
 n.rotation.every(v=>near(v,0))&&n.scale.every(v=>near(v,1))&&n.position.every(v=>near(v,0));}

/** Only recognise explicit auto divider children on the shell's first-child chain.
 * Never reinterpret a label/cavity cutter as a wall or descend into unrelated user groups.
 */
export function collectTrayWalls(project:Project,rootId:string):Wall[]{
 rootShell(project,rootId);
 const out:Wall[]=[];
 let id=rootId;
 const visited=new Set<string>();
 for(let nesting=0;nesting<maxZ;nesting++){
  if(visited.has(id))throw new Error("Cyclic group hierarchy.");visited.add(id);
  const n=project.nodes[id];
  if(!n||!isGroup(n)||!identity(n))throw new Error("Transformed or locked tray cannot be edited automatically.");
  if(isGeneratedDividerLayer(n,project)){
   for(const wallId of n.childIds.slice(1)){
    const v=project.nodes[wallId];
    if(!v||isGroup(v)||v.role!=="solid"||v.kind!=="box"||v.locked||v.hidden||
       v.rotation.some(x=>!near(x,0))||v.scale.some(x=>!near(x,1)))
     throw new Error("This divider layer contains an incompatible part; edit it manually.");
    const w=Number(v.params.w),d=Number(v.params.d);
    if(!Number.isFinite(w)||!Number.isFinite(d)||!v.position.every(Number.isFinite))
     throw new Error("Invalid divider shape.");
    const ax:Axis|null=w<=6&&w<d?"x":d<=6&&d<w?"y":null;
    if(!ax)throw new Error("A custom solid is mixed into the divider group.");
    const [x,y]=v.position;
    const partial=partialDividerAxis(v)!==null;
    out.push(ax==="x"?{id:wallId,axis:ax,cross:x,lo:y-d/2,hi:y+d/2,thickness:w,partial}:
                    {id:wallId,axis:ax,cross:y,lo:x-w/2,hi:x+w/2,thickness:d,partial});
   }
  }
  const next=project.nodes[n.childIds[0]];
  if(!next||!isGroup(next))break;
  id=next.id;
 }
 return out;
}

/** Find the four nearest FACES around the chosen point. Handles T junctions
 * and full walls, not just an evenly spaced rectangular grid.
 */
export function compartmentAt(project:Project,rootId:string,point:Point):Compartment{
 const b=boundedPoint(rootShell(project,rootId),point);
 const walls=collectTrayWalls(project,rootId);
 let {xMin,xMax,yMin,yMax}=b;
 const [x,y]=point;
 for(const wall of walls){
  const cover=wall.axis==="x"?y:x;
  if(cover<wall.lo-0.02||cover>wall.hi+0.02)continue;
  const v=wall.axis==="x"?x:y,low=wall.cross-wall.thickness/2,high=wall.cross+wall.thickness/2;
  if(v>=low-0.001&&v<=high+0.001)throw new Error("Click an open compartment, not an existing divider.");
  if(wall.axis==="x"){
   if(high<x)xMin=Math.max(xMin,high);
   if(low>x)xMax=Math.min(xMax,low);
  }else {
   if(high<y)yMin=Math.max(yMin,high);
   if(low>y)yMax=Math.min(yMax,low);
  }
 }
 if(xMax<=xMin||yMax<=yMin)throw new Error("No accessible compartment was found.");
 return {xMin,xMax,yMin,yMax,width:xMax-xMin,depth:yMax-yMin};
}

/** Compartment divider hits the nearest perpendicular walls and the floor.
 * Adjacent parallel dividers/cavity faces must leave a useful compartment.
 */
export function planPartialDivider(project:Project,rootId:string,axis:Axis,point:Point,
 thickness=1.6,topGap=2):ShapeNode{
 if(axis!=="x"&&axis!=="y")throw new Error("Choose X or Y divider direction.");
 limits(thickness,"Wall thickness",0.8,6);limits(topGap,"Rim gap",0.5,12);
 const sh=rootShell(project,rootId);
 const c=compartmentAt(project,rootId,point);
 const height=sh.height-sh.floor-topGap+0.5;
 if(height<=1.5)throw new Error("This tray is too shallow.");
 const short=axis==="x"?point[0]:point[1];
 const min=axis==="x"?c.xMin:c.yMin,max=axis==="x"?c.xMax:c.yMax;
 if(short-thickness/2-min<2||max-short-thickness/2<2)
  throw new Error("Leave at least 2 mm on each side of the divider.");
 const longStart=axis==="x"?c.yMin:c.xMin,longEnd=axis==="x"?c.yMax:c.xMax;
 if(longEnd-longStart<4)throw new Error("This compartment is too narrow for a partial divider.");
 const z=sh.bottom+sh.floor-.5+height/2;
 const span=longEnd-longStart+.65;
 const n=axis==="x"?basicBox(thickness,span,height,point[0],(longStart+longEnd)/2,z):
                    basicBox(span,thickness,height,(longStart+longEnd)/2,point[1],z);
 n.label=axis==="x"?"Partial lengthwise divider":"Partial widthwise divider";
 n.feature=axis==="x"?"partial-divider-x":"partial-divider-y";
 return n;
}

/** Preserve existing outer shell/label/cutters; append inside existing generated
 * divider layer, creating at most one wrapper for a previously undivided box.
 */
export function planAddPartial(project:Project,rootId:string,axis:Axis,point:Point){
 const shape=planPartialDivider(project,rootId,axis,point);
 let id=rootId;
 for(let i=0;i<maxZ;i++){
  const n=project.nodes[id];
  if(!n||!isGroup(n))break;
  if(isGeneratedDividerLayer(n,project)){
   const updated:GroupNode={...n,label:"Box with dividers",feature:"divider-layer",childIds:[...n.childIds,shape.id]};
   return {project:{...project,nodes:{...project.nodes,[shape.id]:shape,[id]:updated}},
    selectionId:rootId,shapeId:shape.id};
  }
  id=n.childIds[0];
 }
 const wid=newId();
 const layer:GroupNode={id:wid,type:"group",label:"Box with dividers",feature:"divider-layer",
  childIds:[rootId,shape.id],position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]};
 return {project:{...project,nodes:{...project.nodes,[shape.id]:shape,[wid]:layer},
  rootOrder:project.rootOrder.map(r=>r===rootId?wid:r)},selectionId:wid,shapeId:shape.id};
}
export function addPartialDivider(rootId:string,axis:Axis,point:Point):string{
 let nextRoot=rootId;
 useScene.setState(s=>{
  const plan=planAddPartial(s.project,rootId,axis,point);
  nextRoot=plan.selectionId;return {project:plan.project,selection:[nextRoot]};
 });
 return nextRoot;
}
const cylinder=(dia:number,height:number,x:number,y:number,z:number,role:"solid"|"hole"):ShapeNode=>{
 const s=makeShape("cylinder");
 s.params={r:dia/2,h:height,segments:64,bevel:0};
 s.position=[x,y,z];s.role=role;return s;
};
/** One wrapper for additive/CUT features. No modifications to the old node IDs,
 * existing cutters or labelled groups. Never edit a locked/rotated shell.
 */
export function planShellFeature(project:Project,rootId:string,parts:ShapeNode[],groupName:string){
 rootShell(project,rootId);
 if(!parts.length)throw new Error("No parts were generated.");
 const existing=project.nodes[rootId];
 const nodes={...project.nodes,...Object.fromEntries(parts.map(n=>[n.id,n]))};
 if(isGroup(existing)&&existing.label===groupName){
  nodes[rootId]={...existing,childIds:[...existing.childIds,...parts.map(n=>n.id)]};
  return {project:{...project,nodes},selectionId:rootId,added:parts.length};
 }
 const gid=newId();
 nodes[gid]={id:gid,type:"group",label:groupName,position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],childIds:[rootId,...parts.map(n=>n.id)]};
 return {project:{...project,nodes,rootOrder:project.rootOrder.map(id=>id===rootId?gid:id)},
  selectionId:gid,added:parts.length};
}
export function addShellFeature(rootId:string,parts:(project:Project)=>ShapeNode[],label:string):string{
 let selected=rootId;
 useScene.setState(s=>{
  const planned=planShellFeature(s.project,rootId,parts(s.project),label);
  selected=planned.selectionId;
  return {project:planned.project,selection:[selected]};
 });
 return selected;
}
/** Four blind-bored posts rooted into the original floor. The bore stops 1 mm
 * above the inner floor. These are nominal dimensions, not a promise of fit.
 */
export function enclosurePosts(project:Project,rootId:string,diameter=8,bore=3.2,height=10):ShapeNode[]{
 const sh=rootShell(project,rootId);
 limits(diameter,"Post diameter",4,16);limits(bore,"Bore",1,diameter-1.5);limits(height,"Post height",3,60);
 if(height>sh.height-sh.floor+15)throw new Error("Posts are too tall for this enclosure.");
 const w=Number(sh.cavity.params.w),d=Number(sh.cavity.params.d),r=diameter/2;
 if(w<diameter*2+2||d<diameter*2+2)throw new Error("The cavity is too small for four posts.");
 const inset=r+0.5;
 const xs=[sh.cx-w/2+inset,sh.cx+w/2-inset];
 const ys=[sh.cy-d/2+inset,sh.cy+d/2-inset];
 const floor=sh.bottom+sh.floor;
 const existing=collectTrayWalls(project,rootId);
 const parts:ShapeNode[]=[];
 for(const x of xs)for(const y of ys){
  if(existing.some(v=>v.axis==="x"?Math.abs(x-v.cross)<r+v.thickness/2&&y>=v.lo-r&&y<=v.hi+r:
   Math.abs(y-v.cross)<r+v.thickness/2&&x>=v.lo-r&&x<=v.hi+r))
   throw new Error("A divider intersects the proposed post location.");
  const solid=cylinder(diameter,height+0.5,x,y,floor-0.5+(height+0.5)/2,"solid");
  solid.label="Corner mounting post";
  const cutHeight=height-0.6;const hole=cylinder(bore,cutHeight,x,y,floor+1+cutHeight/2,"hole");
  hole.label="Blind mounting bore";
  parts.push(solid,hole);
 }
 return parts;
}
/** Through-wall cable rectangle, leaving positive clearance to rim and floor. */
export function cableOpening(project:Project,rootId:string,side:CableSide,width=12,height=6,offset=0,clearBottom=4):ShapeNode[]{
 const sh=rootShell(project,rootId);
 if(!["front","back","left","right"].includes(side))throw new Error("Choose an enclosure side.");
 limits(width,"Opening width",2,100);limits(height,"Opening height",2,40);
 limits(clearBottom,"Bottom clearance",1,100);
 const long=side==="front"||side==="back"?Number(sh.cavity.params.w):Number(sh.cavity.params.d);
 const wall=side==="front"||side==="back"?sh.wallY:sh.wallX;
 if(!Number.isFinite(offset)||Math.abs(offset)+width/2>long/2-2)
  throw new Error("The opening needs 2 mm clearance from the corners.");
 if(clearBottom+height>sh.height-sh.floor-1)
  throw new Error("The cable opening crosses the rim or base.");
 const z=sh.bottom+sh.floor+clearBottom+height/2;
 const xSide=side==="right"?1:side==="left"?-1:0;
 const ySide=side==="back"?1:side==="front"?-1:0;
 const x=sh.cx+(xSide?xSide*sh.width/2:offset);
 const y=sh.cy+(ySide?ySide*sh.depth/2:offset);
 const n=xSide?basicBox(wall+2,width,height,x,y,z,"hole"):
               basicBox(width,wall+2,height,x,y,z,"hole");
 n.label=side+" cable pass-through";
 return [n];
}
const strictlyPositive=(v:number,name:string,min:number,max:number)=>limits(v,name,min,max);
/** Nominal drilling jig: one plate, grid of through holes and optional back
 * locating fence fused to the plate with overlap; all cutters stay editable.
 */
export function drillJigParts(o:DrillGrid):ShapeNode[]{
 const {width,depth,height,diameter,columns,rows,pitchX,pitchY,fence}=o;
 strictlyPositive(width,"Plate width",20,220);strictlyPositive(depth,"Plate depth",20,220);
 strictlyPositive(height,"Plate thickness",3,40);strictlyPositive(diameter,"Drill hole",1,25);
 if(!Number.isInteger(columns)||columns<1||columns>8||!Number.isInteger(rows)||rows<1||rows>8||columns*rows>32)
  throw new Error("Use 1–8 holes per direction, up to 32 holes.");
 if(!Number.isFinite(pitchX)||pitchX<0||!Number.isFinite(pitchY)||pitchY<0||
    (columns>1&&pitchX<diameter+2)||(rows>1&&pitchY<diameter+2))
  throw new Error("Hole pitch must leave at least 2 mm between holes.");
 const rangeX=(columns-1)*pitchX,rangeY=(rows-1)*pitchY;
 const offsetX=o.offsetX??0,offsetY=o.offsetY??0;
 if(!Number.isFinite(offsetX)||!Number.isFinite(offsetY))
  throw new Error("Enter finite X/Y grid offsets in millimetres.");
 // Validate actual bore boundaries. Preserve the historical -3 mm fence bias
 // and 7 mm from the rear bore perimeter to the fence front face.
 const gridY=offsetY+(fence?-3:0),radius=diameter/2;
 const minX=offsetX-rangeX/2-radius,maxX=offsetX+rangeX/2+radius;
 const minY=gridY-rangeY/2-radius,maxY=gridY+rangeY/2+radius;
 const epsilon=1e-9;
 if(minX<4-width/2-epsilon||maxX>width/2-4+epsilon||
    minY<4-depth/2-epsilon||maxY>depth/2-(fence?10:4)+epsilon)
  throw new Error("Hole boundaries need 4 mm plate edge clearance and the original fence clearance.");
 const base=basicBox(width,depth,height,0,0,height/2);
 base.label="Jig base plate";
 const parts=[base];
 if(fence){
  const f=basicBox(width,3,12,0,depth/2-1.5,height+5.75);
  f.label="Back locating fence";parts.push(f);
 }
 for(let ix=0;ix<columns;ix++)for(let iy=0;iy<rows;iy++){
  const x=offsetX+(ix-(columns-1)/2)*pitchX;
  const y=gridY+(iy-(rows-1)/2)*pitchY;
  const cut=cylinder(diameter,height+2,x,y,height/2,"hole");cut.label="Drill guide hole";
  parts.push(cut);
 }
 return parts;
}
export function createDrillJig(o:DrillGrid):string{
 const parts=drillJigParts(o),gid=newId();
 useScene.setState(s=>{
  const [x,y]=planJigPlacement(s.project,parts,s.bed);
  const group:GroupNode={id:gid,type:"group",label:"Drilling jig",
   childIds:parts.map(n=>n.id),position:[x,y,0],rotation:[0,0,0],scale:[1,1,1]};
  return {project:{...s.project,nodes:{...s.project.nodes,
   ...Object.fromEntries(parts.map(n=>[n.id,n])),[gid]:group},
   rootOrder:[...s.project.rootOrder,gid]},selection:[gid]};
 });
 return gid;
}
/** Safe nominal hole layout for an existing *plain* solid box.
 * Coordinates are local XY millimetres relative to its geometric centre.
 * Each cutter stays editable; unsupported rounding/transform never silently changes.
 */
export function parseJigHolePositions(text:string):Point[]{
 if(typeof text!=="string"||text.length>3000)throw new Error("Enter up to 32 X,Y coordinate pairs.");
 const entries=text.trim().split(/[;\n\r]+/).map(v=>v.trim()).filter(Boolean);
 if(!entries.length||entries.length>32)throw new Error("Enter 1 to 32 hole centres as X,Y pairs separated by semicolons.");
 const decimal=/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
 return entries.map((line,i)=>{
  const pair=line.split(",").map(v=>v.trim());
  if(pair.length!==2||pair.some(v=>!decimal.test(v)))
   throw new Error("Invalid X,Y pair at position "+(i+1)+". Example: -12.5,8");
  const x=Number(pair[0]),y=Number(pair[1]);
  if(!Number.isFinite(x)||!Number.isFinite(y))
   throw new Error("Hole coordinates must be finite.");
  return [x,y] as Point;
 });
}
function plainDrillTarget(project:Project,id:string){
 const shape=project.nodes[id];
 if(!shape||isGroup(shape)||!project.rootOrder.includes(id)||shape.locked||shape.hidden||
    shape.kind!=="box"||shape.role!=="solid"||
    shape.rotation.some(v=>!near(v,0))||shape.scale.some(v=>!near(v,1))||
    !shape.position.every(Number.isFinite))
  throw new Error("Select one unrotated, unlocked, plain solid box (not a hollow group).");
 const w=Number(shape.params.w),d=Number(shape.params.d),h=Number(shape.params.h);
 if(![w,d,h].every(Number.isFinite)||w<=0||d<=0||h<=1)
  throw new Error("This box has invalid dimensions.");
 const radius=shape.params.radius;
 const edgeRounding=shape.params.edges;
 if((radius!==undefined&&(!Number.isFinite(Number(radius))||Number(radius)>0.00001))||
    (typeof edgeRounding==="string"&&edgeRounding.trim().length>0))
  throw new Error("The selected box has rounded edges; drill a plain box so the 4 mm clearance is reliable.");
 return {shape,w,d,h};
}
export function jigDrillExistingPositions(project:Project,id:string,dia:number,points:readonly Point[]):ShapeNode[]{
 const {shape,w,d,h}=plainDrillTarget(project,id);
 limits(dia,"Bore",1,25);
 if(!Array.isArray(points)||points.length<1||points.length>32)
  throw new Error("Enter 1 to 32 custom hole positions.");
 const radius=dia/2;
 const validated:Point[]=[];
 for(const pt of points){
  if(!Array.isArray(pt)||pt.length!==2||pt.some(v=>!Number.isFinite(v)))
   throw new Error("Hole centres must be finite X,Y pairs.");
  const [x,y]=pt;
  if(Math.abs(x)+radius>w/2-4+1e-9||Math.abs(y)+radius>d/2-4+1e-9)
   throw new Error("Each bore needs at least 4 mm clearance to all four box edges.");
  for(const other of validated){
   if(Math.hypot(x-other[0],y-other[1])<dia+2-1e-9)
    throw new Error("Hole centres must leave at least 2 mm of solid material between bores.");
  }
  validated.push([x,y]);
 }
 return validated.map(([x,y],i)=>{
  const cut=cylinder(dia,h+2,shape.position[0]+x,shape.position[1]+y,shape.position[2],"hole");
  cut.label="Jig drill hole "+(i+1);
  return cut;
 });
}
/** Preserve old centred-grid behaviour when offsets are omitted.
 * The inputs here are LOCAL offsets from the box centre, not global coordinates.
 */
export function jigDrillExisting(project:Project,id:string,dia:number,cols:number,rows:number,
 pitchX:number,pitchY:number,offsetX=0,offsetY=0):ShapeNode[]{
 plainDrillTarget(project,id);limits(dia,"Bore",1,25);
 if(!Number.isInteger(cols)||cols<1||cols>8||!Number.isInteger(rows)||rows<1||rows>8||cols*rows>32)
  throw new Error("Use 1 to 8 holes per direction, up to 32.");
 if(![pitchX,pitchY,offsetX,offsetY].every(Number.isFinite)||pitchX<0||pitchY<0||
    (cols>1&&pitchX<dia+2)||(rows>1&&pitchY<dia+2))
  throw new Error("Hole grid pitch must leave at least 2 mm between bores; offsets must be finite.");
 const points:Point[]=[];
 for(let ix=0;ix<cols;ix++)for(let iy=0;iy<rows;iy++)
  points.push([offsetX+(ix-(cols-1)/2)*pitchX,offsetY+(iy-(rows-1)/2)*pitchY]);
 return jigDrillExistingPositions(project,id,dia,points);
}
/** Pure group-plan; unchanged box and new cutters survive project JSON round-trip. */
export function planDrillExisting(project:Project,id:string,parts:ShapeNode[]){
 if(!parts.length||parts.some(n=>n.role!=="hole"||n.kind!=="cylinder"||!n.position.every(Number.isFinite)))
  throw new Error("No valid drilling cutters provided.");
 plainDrillTarget(project,id);
 const ids=parts.map(n=>n.id);
 if(new Set(ids).size!==ids.length||ids.some(key=>project.nodes[key]))
  throw new Error("Drill part IDs clash with the saved project.");
 const gid=newId(),group:GroupNode={id:gid,type:"group",label:"Jig drill holes",
  childIds:[id,...ids],position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]};
 return {project:{...project,
  nodes:{...project.nodes,...Object.fromEntries(parts.map(n=>[n.id,n])),[gid]:group},
  rootOrder:project.rootOrder.map(item=>item===id?gid:item)},
  selectionId:gid,cutters:ids};
}
/** Both existing drilling entry points share one scene/history commit path. */
function applyDrillToExisting(id:string,parts:(project:Project)=>ShapeNode[]):string{
 let selected=id;
 useScene.setState(s=>{
  const plan=planDrillExisting(s.project,id,parts(s.project));
  selected=plan.selectionId;
  return {project:plan.project,selection:[selected]};
 });
 return selected;
}
export function applyDrillExisting(id:string,dia:number,cols:number,rows:number,
 pitchX:number,pitchY:number,offsetX=0,offsetY=0):string{
 return applyDrillToExisting(id,project=>jigDrillExisting(
  project,id,dia,cols,rows,pitchX,pitchY,offsetX,offsetY));
}
export function applyDrillExistingPositions(id:string,dia:number,points:readonly Point[]):string{
 return applyDrillToExisting(id,project=>jigDrillExistingPositions(project,id,dia,points));
}
/** Generic shell dimension report; pure and read-only. */
export function shellReport(project:Project,rootId:string,point:Point){
 const shell=rootShell(project,rootId);
 const c=compartmentAt(project,rootId,point);
 return {outside:[shell.width,shell.depth,shell.height],inside:[Number(shell.cavity.params.w),Number(shell.cavity.params.d)],
  floor:shell.floor,wallX:shell.wallX,wallY:shell.wallY,compartment:c};
}
export function findRoot(project:Project,id:string):string{
 const path=groupPath(project,id);
 if(!path.length)throw new Error("Part is not attached to the project.");
 return path[0];
}

// The requested PCB/connector REAR clearance is the distance from the
// board/body's far edge to the stop's inner face. The old shared -0.25 mm
// fudge caused real interference at the 0.1 mm minimum. One formula keeps
// both fixtures in sync and lets the rails fuse to the stop independently.
const rearStopCentre=(depth:number,clearance:number,thickness:number)=>
 depth/2+clearance+thickness/2;

// Electronics fixtures use existing exact editable box and cylinder solids;
// all dimensions are user-entered nominal CAD dimensions, not connector specs.
export type PcbHolderOptions={
 boardWidth:number;boardDepth:number;clearance:number;baseThickness:number;
 railWidth:number;railHeight:number;backStopThickness:number;backStopHeight:number;
 margin:number;
};
export function pcbHolderParts(o:PcbHolderOptions):ShapeNode[]{
 const {boardWidth,boardDepth,clearance,baseThickness,railWidth,railHeight,
  backStopThickness,backStopHeight,margin}=o;
 limits(boardWidth,"PCB width",10,190);limits(boardDepth,"PCB depth",10,190);
 limits(clearance,"PCB side clearance",0.1,5);
 limits(baseThickness,"Base thickness",2,20);
 limits(railWidth,"Guide rail width",2,20);limits(railHeight,"Guide rail height",1,25);
 limits(backStopThickness,"Back stop thickness",2,20);
 limits(backStopHeight,"Back stop height",1,25);
 limits(margin,"Outside margin",3,20);
 const width=boardWidth+2*(clearance+railWidth+margin);
 const depth=boardDepth+2*(clearance+margin)+backStopThickness;
 if(width>220||depth>220)
  throw new Error("PCB fixture footprint exceeds the 220 x 220 mm AD5X build plate.");
 const plate=basicBox(width,depth,baseThickness,0,backStopThickness/2,baseThickness/2);
 plate.label="PCB fixture base";
 const rails:ShapeNode[]=[];
 for(const sign of [-1,1]){
  const rail=basicBox(railWidth,boardDepth+2*clearance+0.4,railHeight+0.35,
    sign*(boardWidth/2+clearance+railWidth/2),0,
    baseThickness-0.35+(railHeight+0.35)/2);
  rail.label=sign<0?"PCB left locating rail":"PCB right locating rail";
  rails.push(rail);
 }
 const back=basicBox(boardWidth+2*(clearance+railWidth),backStopThickness,backStopHeight+0.35,
   0,rearStopCentre(boardDepth,clearance,backStopThickness),
   baseThickness-0.35+(backStopHeight+0.35)/2);
 back.label="PCB rear locating stop";
 return [plate,...rails,back];
}
/** User-measured hole centres relative to PCB centre. Cutters pass fully through the base.
 * The PCB remains removable; these bores do not clamp or locate a PCB by themselves.
 */
export function pcbMountingHoleParts(o:PcbHolderOptions,points:readonly Point[],diameter:number):ShapeNode[]{
 pcbHolderParts(o); // Reuse existing dimension and build-plate checks.
 limits(diameter,"PCB mounting bore diameter",0.8,12);
 if(!Array.isArray(points)||points.length<1||points.length>32)
  throw new Error("Enter 1 to 32 measured PCB mounting-hole centres.");
 const result:ShapeNode[]=[];
 for(let i=0;i<points.length;i++){
  const point=points[i];
  if(!Array.isArray(point)||point.length!==2||!point.every(Number.isFinite))
   throw new Error("Enter finite X,Y coordinates for each PCB mounting hole.");
  const [x,y]=point;
  if(Math.abs(x)+diameter/2>o.boardWidth/2||Math.abs(y)+diameter/2>o.boardDepth/2)
   throw new Error("PCB mounting hole extends outside the board outline.");
  if(points.slice(0,i).some(([a,b])=>Math.hypot(x-a,y-b)<diameter+2))
   throw new Error("PCB mounting holes require at least 2 mm edge-to-edge spacing.");
  const cut=cylinder(diameter,o.baseThickness+2,x,y,o.baseThickness/2,"hole");
  cut.label=`PCB mounting bore ${i+1}`;
  result.push(cut);
 }
 return result;
}

export function connectorPanelParts(o:DrillGrid):ShapeNode[]{
 const parts=drillJigParts({...o,fence:false});
 parts[0].label="Connector mounting panel";
 for(const part of parts.slice(1))part.label="Connector mounting hole";
 return parts;
}
/** Custom measured connector/banana-socket mounting bores. No connector standards assumed. */
export function connectorMeasuredPanelParts(width:number,depth:number,height:number,diameter:number,points:readonly Point[]):ShapeNode[]{
 limits(width,"Connector panel width",10,220);
 limits(depth,"Connector panel depth",10,220);
 limits(height,"Connector panel thickness",2,20);
 limits(diameter,"Connector bore diameter",0.8,40);
 if(!Array.isArray(points)||points.length<1||points.length>32)throw new Error("Enter 1 to 32 measured connector centres.");
 const plate=basicBox(width,depth,height,0,0,height/2);
 plate.label="Measured connector mounting panel";
 const parts:ShapeNode[]=[plate];
 for(let i=0;i<points.length;i++){
  const p=points[i];
  if(!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite))throw new Error("Invalid connector bore coordinates.");
  const [x,y]=p;
  if(Math.abs(x)+diameter/2>width/2-2||Math.abs(y)+diameter/2>depth/2-2)
   throw new Error("Connector bore needs at least 2 mm edge clearance.");
  if(points.slice(0,i).some(([a,b])=>Math.hypot(x-a,y-b)<diameter+2))
   throw new Error("Connector bores need 2 mm edge-to-edge spacing.");
  const bore=cylinder(diameter,height+2,x,y,height/2,"hole");
  bore.label=`Measured connector bore ${i+1}`;
  parts.push(bore);
 }
 return parts;
}

/** A nominal *banana PLUG* holding plate, not a banana SOCKET mounting panel.
 * The opening diameter is supplied by the user for the actual plug body.
 * Hole cutters remain separate editable parts in the normal Design project.
 */
export type BananaPlugHolderOptions={
 width:number;depth:number;height:number;diameter:number;points:readonly Point[];
};
export const BANANA_HOLDER_MIN_EDGE=4;
export const BANANA_HOLDER_MIN_WEB=2;
export function spacedBananaHoles(count:number,spacing:number):Point[]{
 if(!Number.isInteger(count)||count<2||count>16)throw new Error("Choose 2 to 16 banana plugs.");
 if(!Number.isFinite(spacing)||spacing<=0)throw new Error("Enter a positive spacing between plugs.");
 return Array.from({length:count},(_,i)=>[(i-(count-1)/2)*spacing,0] as Point);
}
/** Plain-language live validation that cannot silently clip bores. */
export function bananaPlugHolderIssues(o:BananaPlugHolderOptions):string[]{
 const issues:string[]=[];
 const {width,depth,height,diameter,points}=o;
 if(!Number.isFinite(width)||width<20||width>220)issues.push("Plate width must be 20 to 220 mm.");
 if(!Number.isFinite(depth)||depth<20||depth>220)issues.push("Plate depth must be 20 to 220 mm.");
 if(!Number.isFinite(height)||height<3||height>30)issues.push("Plate thickness must be 3 to 30 mm.");
 if(!Number.isFinite(diameter)||diameter<1||diameter>35)
  issues.push("Measure your banana plug body and enter a hole diameter between 1 and 35 mm.");
 if(!Array.isArray(points)||points.length<2||points.length>16){
  issues.push("Choose between 2 and 16 banana-plug holes.");return issues;
 }
 if(![width,depth,diameter].every(Number.isFinite)||width<=0||depth<=0||diameter<=0)return issues;
 for(let i=0;i<points.length;i++){
  const v=points[i];
  if(!Array.isArray(v)||v.length!==2||!v.every(Number.isFinite)){
   issues.push("Hole "+(i+1)+" needs valid X and Y coordinates.");continue;
  }
  const [x,y]=v;
  const mx=width/2-Math.abs(x)-diameter/2;
  const my=depth/2-Math.abs(y)-diameter/2;
  if(mx<BANANA_HOLDER_MIN_EDGE-1e-8||my<BANANA_HOLDER_MIN_EDGE-1e-8)
   issues.push("Hole "+(i+1)+" is too close to the plate edge. Leave at least 4 mm of material.");
  for(let j=0;j<i;j++){
   const other=points[j];
   if(!Array.isArray(other)||other.length!==2||!other.every(Number.isFinite))continue;
   const material=Math.hypot(x-other[0],y-other[1])-diameter;
   if(material<BANANA_HOLDER_MIN_WEB-1e-8)
    issues.push("Holes "+(j+1)+" and "+(i+1)+" are too close. Increase spacing to leave at least 2 mm between holes.");
  }
 }
 return issues;
}
export function bananaPlugHolderParts(o:BananaPlugHolderOptions):ShapeNode[]{
 const issues=bananaPlugHolderIssues(o);
 if(issues.length)throw new Error(issues.join(" "));
 const plate=basicBox(o.width,o.depth,o.height,0,0,o.height/2);
 plate.label="Banana-plug holding plate";
 const parts:ShapeNode[]=[plate];
 for(let i=0;i<o.points.length;i++){
  const [x,y]=o.points[i];
  const bore=cylinder(o.diameter,o.height+2,x,y,o.height/2,"hole");
  bore.label="Banana plug "+(i+1)+" holder opening";
  parts.push(bore);
 }
 return parts;
}


/** Place banana-plug openings directly in an existing hollow box.
 * No second plate is created. Positions are millimetres relative to the
 * centre of the selected FLOOR or WALL face.
 */
export type BananaBoxFace="front"|"back"|"left"|"right"|"floor";
export type PanelSizeInfo=Pick<ShellInfo,"width"|"depth"|"height"|"floor"> & {cavity:{params:Record<string,number|string>}};
export type BananaBoxCutOptions={face:BananaBoxFace;diameter:number;points:readonly Point[]};
export function bananaBoxFaceSize(sh:PanelSizeInfo,face:BananaBoxFace):[number,number]{
 if(face==="floor")return [Number(sh.cavity.params.w),Number(sh.cavity.params.d)];
 if(face==="front"||face==="back")return [sh.width,sh.height-sh.floor];
 if(face==="left"||face==="right")return [sh.depth,sh.height-sh.floor];
 throw new Error("Choose the box wall or floor for your plugs.");
}
/** Selection can be the shell or an item inside it. Only a unique unambiguous
 * hollow-box root may be selected automatically. Never pick a random box.
 */
export function bananaBoxTarget(project:Project,selection:readonly string[]):{id:string;sh:ShellInfo}{
 if(selection.length===1){
  const path=groupPath(project,selection[0]);
  if(path.length){
   try{return {id:path[0],sh:rootShell(project,path[0])};}catch{/* Look for one unambiguous box instead. */}
  }
 }
 const candidates:{id:string;sh:ShellInfo}[]=[];
 for(const id of project.rootOrder){
  try{candidates.push({id,sh:rootShell(project,id)});}catch{/* Not a supported hollow box. */}
 }
 if(candidates.length===1)return candidates[0];
 if(!candidates.length)throw new Error("Create or select a hollow box first. Banana holes go into that box, not a new plate.");
 throw new Error("Select which hollow box you want to drill. More than one box is in the design.");
}
export function bananaBoxHoleIssues(sh:PanelSizeInfo,o:BananaBoxCutOptions):string[]{
 const issues:string[]=[];
 const {face,diameter,points}=o;
 let w:number,h:number;
 try{[w,h]=bananaBoxFaceSize(sh,face);}catch(e){return [(e as Error).message];}
 if(!Number.isFinite(diameter)||diameter<1||diameter>35)
  issues.push("Measure the banana plug and enter a hole diameter from 1 to 35 mm.");
 if(!Array.isArray(points)||points.length<2||points.length>16){
  issues.push("Choose between 2 and 16 holes.");return issues;
 }
 if(!Number.isFinite(diameter)||diameter<=0)return issues;
 for(let i=0;i<points.length;i++){
  const p=points[i];
  if(!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)){
   issues.push("Hole "+(i+1)+" needs valid X and Y coordinates.");continue;
  }
  const [u,v]=p;
  if(Math.abs(u)+diameter/2>w/2-4+1e-8 || Math.abs(v)+diameter/2>h/2-4+1e-8)
   issues.push("Hole "+(i+1)+" is too close to the "+(face==="floor"?"inside floor edge":"wall edge or rim")+". Leave at least 4 mm of material.");
  for(let j=0;j<i;j++){
   const prev=points[j];
   if(!Array.isArray(prev)||prev.length!==2||!prev.every(Number.isFinite))continue;
   if(Math.hypot(u-prev[0],v-prev[1])<diameter+2-1e-8)
    issues.push("Holes "+(j+1)+" and "+(i+1)+" are too close. Leave at least 2 mm between them.");
  }
 }
 return issues;
}
export function bananaBoxHoleParts(project:Project,rootId:string,o:BananaBoxCutOptions):ShapeNode[]{
 const sh=rootShell(project,rootId);
 const warnings=bananaBoxHoleIssues(sh,o);
 if(warnings.length)throw new Error(warnings.join(" "));
 const cutters:ShapeNode[]=[];
 for(let i=0;i<o.points.length;i++){
  const [u,v]=o.points[i];
  let x:number,y:number,z:number,length:number;
  const face=o.face;
  if(face==="floor"){
   x=sh.cx+u;y=sh.cy+v;z=sh.bottom+sh.floor/2;length=sh.floor+2;
  }else if(face==="front"||face==="back"){
   x=sh.cx+u;
   y=sh.cy+(face==="front"?-1:1)*(sh.depth/2-sh.wallY/2);
   z=sh.bottom+sh.floor+(sh.height-sh.floor)/2+v;
   length=sh.wallY+2;
  }else{
   x=sh.cx+(face==="left"?-1:1)*(sh.width/2-sh.wallX/2);
   y=sh.cy+u;z=sh.bottom+sh.floor+(sh.height-sh.floor)/2+v;
   length=sh.wallX+2;
  }
  const bore=cylinder(o.diameter,length,x,y,z,"hole");
  bore.rotation=(face==="floor"?[0,0,0]:
   face==="front"||face==="back"?[Math.PI/2,0,0]:[0,Math.PI/2,0]);
  bore.label="Banana plug "+(i+1)+" - "+face+" opening";
  cutters.push(bore);
 }
 return cutters;
}
/** Pure plan makes the holes children of the EXISTING shell, never creates
 * a separate solid/plate; all original node IDs and other roots survive. */
export function planBananaBoxHoles(project:Project,rootId:string,o:BananaBoxCutOptions){
 const parts=bananaBoxHoleParts(project,rootId,o);
 const plan=planShellFeature(project,rootId,parts,"Box with banana-plug holes");
 return {...plan,cutters:parts.map(x=>x.id)};
}
export function applyBananaBoxHoles(rootId:string,o:BananaBoxCutOptions):string{
 let next=rootId;
 useScene.setState(s=>{
  const plan=planBananaBoxHoles(s.project,rootId,o);
  next=plan.selectionId;
  return {project:plan.project,selection:[next]};
 });
 return next;
}

export function pogoPinGuideParts(o:DrillGrid):ShapeNode[]{
 const parts=drillJigParts({...o,fence:false});
 parts[0].label="Pogo-pin test guide plate";
 for(const part of parts.slice(1))part.label="Pogo-pin guide bore";
 return parts;
}
/** User-measured pogo-pin centres; bores are nominal, not guaranteed retention fits. */
export function pogoMeasuredGuideParts(width:number,depth:number,height:number,diameter:number,points:readonly Point[]):ShapeNode[]{
 limits(width,"Pogo guide width",10,220);limits(depth,"Pogo guide depth",10,220);
 limits(height,"Pogo guide thickness",2,20);limits(diameter,"Pogo bore diameter",0.5,8);
 if(!Array.isArray(points)||points.length<1||points.length>64)
  throw new Error("Enter 1 to 64 measured pogo-pin centres.");
 const plate=basicBox(width,depth,height,0,0,height/2);
 plate.label="Measured pogo-pin guide plate";
 const parts:ShapeNode[]=[plate];
 for(let i=0;i<points.length;i++){
  const p=points[i];
  if(!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite))
   throw new Error("Invalid pogo-pin centre coordinates.");
  const [x,y]=p;
  if(Math.abs(x)+diameter/2>width/2-2||Math.abs(y)+diameter/2>depth/2-2)
   throw new Error("Pogo bore needs 2 mm material to the plate edge.");
  if(points.slice(0,i).some(([a,b])=>Math.hypot(x-a,y-b)<diameter+2))
   throw new Error("Pogo bores need 2 mm material between them.");
  const bore=cylinder(diameter,height+2,x,y,height/2,"hole");
  bore.label="Measured pogo-pin bore "+(i+1);
  parts.push(bore);
 }
 return parts;
}

export function createElectronicsJig(label:string,parts:ShapeNode[]):string{
 if(!parts.length||parts.some(p=>p.hidden||p.locked||!p.position.every(Number.isFinite)))
  throw new Error("Invalid electronics jig parts.");
 const id=newId();
 useScene.setState(s=>{
  const [x,y]=planJigPlacement(s.project,parts,s.bed);
  const group:GroupNode={id,type:"group",label,childIds:parts.map(p=>p.id),
   position:[x,y,0],rotation:[0,0,0],scale:[1,1,1]};
  return {project:{...s.project,
   nodes:{...s.project.nodes,...Object.fromEntries(parts.map(p=>[p.id,p])),[id]:group},
   rootOrder:[...s.project.rootOrder,id]},selection:[id]};
 });
 return id;
}


// Individual open-topped wire slots in a printable soldering guide ridge.
// Depths and pitch are nominal. The wires remain manually removable.
export type WireCombOptions={
 count:number;pitch:number;slotWidth:number;slotDepth:number;
 plateDepth:number;baseThickness:number;ridgeThickness:number;
 ridgeHeight:number;endMargin:number;
};
export function wireCombParts(o:WireCombOptions):ShapeNode[]{
 const {count,pitch,slotWidth,slotDepth,plateDepth,baseThickness,
  ridgeThickness,ridgeHeight,endMargin}=o;
 if(!Number.isInteger(count)||count<1||count>16)throw new Error("Wire count must be 1 to 16.");
 limits(slotWidth,"Wire slot width",0.8,12);
 limits(slotDepth,"Wire slot depth",1,20);
 limits(plateDepth,"Wire comb plate depth",18,180);
 limits(baseThickness,"Wire comb base",2,15);
 limits(ridgeThickness,"Wire comb ridge thickness",3,16);
 limits(ridgeHeight,"Wire comb ridge height",3,30);
 limits(endMargin,"Wire comb end margin",4,20);
 if(!Number.isFinite(pitch)||pitch<0||(count>1&&pitch<slotWidth+2))
  throw new Error("Wire slots need at least 2 mm of material between them.");
 if(slotDepth>ridgeHeight-1.5)
  throw new Error("Wire groove depth must leave at least 1.5 mm in the ridge.");
 if(plateDepth<ridgeThickness+8)
  throw new Error("Wire comb ridge must have 4 mm of base plate ahead and behind.");
 const width=(count-1)*pitch+slotWidth+2*endMargin;
 if(width>220)throw new Error("Wire comb is too wide for the 220 mm AD5X build plate.");
 const base=basicBox(width,plateDepth,baseThickness,0,0,baseThickness/2);
 base.label="Wire comb base plate";
 const ridge=basicBox(width-2, ridgeThickness,ridgeHeight+0.4,0,0,
  baseThickness-0.4+(ridgeHeight+0.4)/2);
 ridge.label="Wire comb raised guide";
 const parts=[base,ridge];
 const cutterHeight=slotDepth+1;
 for(let index=0;index<count;index++){
  const x=(index-(count-1)/2)*pitch;
  const cut=basicBox(slotWidth,ridgeThickness+2,cutterHeight,
   x,0,baseThickness+ridgeHeight-slotDepth+cutterHeight/2,"hole");
  cut.label="Open wire slot "+(index+1);
  parts.push(cut);
 }
 return parts;
}

// Open-front connector/body soldering cradle, not a mechanical clamp.
// No connector-family standards or dimensions are assumed.
export type ConnectorCradleOptions={
 bodyWidth:number;bodyDepth:number;clearance:number;
 baseThickness:number;railWidth:number;railHeight:number;
 backStopThickness:number;backStopHeight:number;margin:number;
};
export function connectorCradleParts(o:ConnectorCradleOptions):ShapeNode[]{
 const {bodyWidth,bodyDepth,clearance,baseThickness,railWidth,railHeight,
  backStopThickness,backStopHeight,margin}=o;
 limits(bodyWidth,"Connector body width",4,190);
 limits(bodyDepth,"Connector body depth",4,190);
 limits(clearance,"Connector clearance",0.1,5);
 limits(baseThickness,"Cradle base thickness",2,20);
 limits(railWidth,"Cradle rail width",2,20);
 limits(railHeight,"Cradle rail height",2,25);
 limits(backStopThickness,"Cradle rear stop thickness",2,20);
 limits(backStopHeight,"Cradle rear stop height",2,25);
 limits(margin,"Cradle outer margin",3,20);
 const plateWidth=bodyWidth+2*(clearance+railWidth+margin);
 const plateDepth=bodyDepth+2*(clearance+margin)+backStopThickness;
 if(plateWidth>220||plateDepth>220)
  throw new Error("Connector cradle footprint exceeds the AD5X build plate.");
 const plate=basicBox(plateWidth,plateDepth,baseThickness,
  0,backStopThickness/2,baseThickness/2);
 plate.label="Connector soldering cradle base";
 const parts=[plate];
 for(const sign of [-1,1]){
  const rail=basicBox(railWidth,bodyDepth+2*clearance+0.4,
   railHeight+0.35,sign*(bodyWidth/2+clearance+railWidth/2),0,
   baseThickness-0.35+(railHeight+0.35)/2);
  rail.label=sign<0?"Connector left guide":"Connector right guide";
  parts.push(rail);
 }
 const stop=basicBox(bodyWidth+2*(clearance+railWidth),
  backStopThickness,backStopHeight+0.35,0,
  rearStopCentre(bodyDepth,clearance,backStopThickness),
  baseThickness-0.35+(backStopHeight+0.35)/2);
 stop.label="Connector rear locating stop";
 parts.push(stop);
 return parts;
}

// Conservative XY packing for NEW drilling and electronics jigs.
// It never translates old objects or silently overlaps their footprints.
// Unknown/rotated solids reject auto-placement rather than guessing bounds.
export interface JigFootprint{minX:number;maxX:number;minY:number;maxY:number}
function mergeFootprints(items:JigFootprint[]):JigFootprint{
 if(!items.length)throw new Error("Cannot position an empty jig group.");
 return {minX:Math.min(...items.map(x=>x.minX)),maxX:Math.max(...items.map(x=>x.maxX)),
  minY:Math.min(...items.map(x=>x.minY)),maxY:Math.max(...items.map(x=>x.maxY))};
}
function nodeJigFootprint(project:Project,id:string,parent:[number,number]=[0,0],
 depth=0,path:Set<string>=new Set()):JigFootprint{
 if(depth>=18||path.has(id))throw new Error("A saved group is cyclic or too deeply nested to place a jig safely.");
 const node=project.nodes[id];
 if(!node)throw new Error("Cannot position beside a missing saved object.");
 if(node.rotation.some(v=>!Number.isFinite(v)||Math.abs(v)>1e-6)||
    node.scale.some(v=>!Number.isFinite(v)||Math.abs(v-1)>1e-6)||
    !node.position.every(Number.isFinite))
  throw new Error("Auto-placement needs unrotated, unscaled, finite saved objects.");
 const center:[number,number]=[parent[0]+node.position[0],parent[1]+node.position[1]];
 if(isGroup(node)){
  if(!node.childIds.length)throw new Error("Empty saved group prevents safe auto-placement.");
  const next=new Set(path);next.add(id);
  return mergeFootprints(node.childIds.map(child=>nodeJigFootprint(project,child,center,depth+1,next)));
 }
 if(node.kind!=="box"&&node.kind!=="rounded-box"&&node.kind!=="cylinder")
  throw new Error("Auto-placement cannot guarantee clearance around the saved "+node.kind+" shape.");
 const w=node.kind==="cylinder"?Number(node.params.r)*2:Number(node.params.w);
 const d=node.kind==="cylinder"?Number(node.params.r)*2:Number(node.params.d);
 if(!Number.isFinite(w)||!Number.isFinite(d)||w<=0||d<=0)
  throw new Error("Object has invalid XY dimensions for jig placement.");
 return {minX:center[0]-w/2,maxX:center[0]+w/2,minY:center[1]-d/2,maxY:center[1]+d/2};
}
const footprintsOverlap=(a:JigFootprint,b:JigFootprint,pad:number)=>
 a.minX<b.maxX+pad&&a.maxX>b.minX-pad&&a.minY<b.maxY+pad&&a.maxY>b.minY-pad;

/** Pure plan. Return XY group translation; never mutate the existing project.
 * Inter-object clearance is 3 mm by default. Conservative bounds include cutters.
 */
export function planJigPlacement(project:Project,parts:ShapeNode[],
 bed:[number,number]|null,gap=3):[number,number]{
 if(!bed||bed.length!==2||bed.some(x=>!Number.isFinite(x)||x<=0))
  throw new Error("Select the correct AD5X build plate before placing a jig.");
 if(!Number.isFinite(gap)||gap<0||gap>30)
  throw new Error("Jig spacing must be between 0 and 30 mm.");
 if(!parts.length)throw new Error("No jig geometry was generated.");
 const keys=parts.map(p=>p.id);
 if(new Set(keys).size!==keys.length||keys.some(key=>project.nodes[key]))
  throw new Error("Duplicate jig part ID: placement cancelled.");
 const draft:Project={...project,nodes:{...project.nodes,...Object.fromEntries(parts.map(p=>[p.id,p]))}};
 // CUTTERS remove material and must not enlarge a jig footprint or block
 // legitimate rotated screw/nut bores. Only additive solids occupy plate area.
 const positive=parts.filter(p=>p.role==="solid");
 if(!positive.length)throw new Error("A jig needs at least one printable solid.");
 const footprint=mergeFootprints(positive.map(p=>nodeJigFootprint(draft,p.id)));
 const obstacles=project.rootOrder.map(id=>nodeJigFootprint(project,id));
 const width=footprint.maxX-footprint.minX,depth=footprint.maxY-footprint.minY;
 const xMin=-bed[0]/2+width/2+0.1,xMax=bed[0]/2-width/2-0.1;
 const yMin=-bed[1]/2+depth/2+0.1,yMax=bed[1]/2-depth/2-0.1;
 if(xMin>xMax||yMin>yMax)
  throw new Error("The jig is larger than the selected build plate.");
 const choices=(lo:number,hi:number)=>{
  const values=[0,lo,hi];
  for(let d=4;d<Math.max(Math.abs(lo),Math.abs(hi))+4;d+=4){values.push(-d,d);}
  return [...new Set(values.filter(v=>v>=lo&&v<=hi))].sort((a,b)=>Math.abs(a)-Math.abs(b)||a-b);
 };
 const midX=(footprint.minX+footprint.maxX)/2;
 const midY=(footprint.minY+footprint.maxY)/2;
 const candidates=choices(xMin,xMax).flatMap(x=>choices(yMin,yMax).map(y=>[x,y] as [number,number]))
  .sort((a,b)=>Math.hypot(a[0],a[1])-Math.hypot(b[0],b[1])||a[1]-b[1]||a[0]-b[0]);
 for(const [cx,cy] of candidates){
  const shift:[number,number]=[cx-midX,cy-midY];
  const area:JigFootprint={minX:footprint.minX+shift[0],maxX:footprint.maxX+shift[0],
   minY:footprint.minY+shift[1],maxY:footprint.maxY+shift[1]};
  if(obstacles.every(ob=>!footprintsOverlap(area,ob,gap)))return shift;
 }
 throw new Error("No clear build-plate space for this jig. Move existing objects or create a smaller jig.");
}

/** Experimental indexed clamp: printable base and a separate, parked movable jaw.
 * Uses nominal dimensions only. The peg/jaw must be printed and fitted separately.
 */
export type IndexedClampOptions={workWidth:number;workDepth:number;minOpening:number;maxOpening:number;step:number;pegDiameter:number;clearance:number};
export function indexedClampParts(o:IndexedClampOptions):ShapeNode[]{
 const {workWidth,workDepth,minOpening,maxOpening,step,pegDiameter,clearance}=o;
 limits(workWidth,"Clamp base width",50,180);limits(workDepth,"Clamp depth",25,100);
 limits(minOpening,"Minimum jaw opening",8,80);limits(maxOpening,"Maximum jaw opening",10,150);
 limits(step,"Clamp indexing step",4,20);limits(pegDiameter,"Clamp peg diameter",3,10);
 limits(clearance,"Clamp peg clearance",0.15,1);
 if(maxOpening<=minOpening||maxOpening+16>workWidth)throw new Error("Clamp opening range exceeds base width.");
 if(Math.abs((maxOpening-minOpening)/step-Math.round((maxOpening-minOpening)/step))>1e-6)throw new Error("Opening range must be an exact multiple of indexing step.");
 const count=Math.round((maxOpening-minOpening)/step)+1;
 if(count<2||count>20)throw new Error("Clamp requires 2 to 20 indexed jaw positions.");
 if(step<pegDiameter+clearance+2)throw new Error("Clamp index holes require 2 mm material between bores.");
 const thickness=6, jawWidth=8, jawHeight=12;
 // The final through-bore must leave actual printable material at the right edge.
 const lastBoreRight=(-workWidth/2+12+maxOpening+jawWidth/2)+(pegDiameter+clearance)/2;
 if(workWidth/2-lastBoreRight<4)
  throw new Error("Clamp final index bore requires at least 4 mm base material at the right edge.");
 const base=basicBox(workWidth,workDepth,thickness,0,0,thickness/2);
 base.label="Indexed clamp base";
 const stop=basicBox(8,workDepth-8,jawHeight+0.4,-workWidth/2+8,0,thickness-0.4+(jawHeight+0.4)/2);
 stop.label="Fixed clamp jaw";
 const parts:ShapeNode[]=[base,stop];
 const fixedFace=-workWidth/2+12;
 for(let i=0;i<count;i++){
  const x=fixedFace+minOpening+i*step+jawWidth/2;
  const cut=cylinder(pegDiameter+clearance,thickness+2,x,0,thickness/2,"hole");
  cut.label=`Clamp index bore ${i+1}`;parts.push(cut);
 }
 // Park the removable jaw beside the base, not inside an indexing bore.
 // This preserves independent printable solids in the STEP export.
 const parkedX=workWidth/2+12;
 const jaw=basicBox(jawWidth,workDepth-12,jawHeight,parkedX,0,thickness+jawHeight/2);
 jaw.label="Removable indexed jaw (print separately)";
 const peg=cylinder(pegDiameter,thickness+0.4,parkedX,0,thickness/2+0.2,"solid");
 peg.label="Removable jaw locating peg";
 parts.push(jaw,peg);
 if(parkedX+jawWidth/2>110||workDepth>220)throw new Error("Clamp and parked jaw exceed AD5X plate bounds.");
 return parts;
}