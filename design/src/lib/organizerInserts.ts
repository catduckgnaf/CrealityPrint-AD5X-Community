import {useScene} from "../state/store";
import {isGroup,type Project,type ShapeNode,type GroupNode} from "../types/scene";
import {newId} from "./id";
import {basicBox,identifyShell,type ShellInfo} from "./boxFitTools";
import {uprightCornerRadii,independentUprightFillets,type UprightCorners} from "./matchedLidCorners";

export interface OrganizerOptions{
 cols:number;rows:number;gap:number;wall:number;floor:number;topGap:number;bedGap:number;
 mode:"full"|"span"|"mixed";col:number;row:number;spanCols:number;spanRows:number;
}
export interface PlannedBin{
 group:GroupNode;outside:ShapeNode;inside:ShapeNode;
 col:number;row:number;spanCols:number;spanRows:number;
}
export interface OrganizerPlan{bins:PlannedBin[];cellWidth:number;cellDepth:number;clearance:number;layout:[number,number]}
const check=(cond:boolean,message:string)=>{if(!cond)throw new Error(message);};
const size=(v:number,label:string,lo:number,hi:number)=>{
 check(Number.isFinite(v)&&v>=lo&&v<=hi,`${label} must be ${lo} to ${hi} mm.`);return v;
};
interface Rect{x1:number;y1:number;x2:number;y2:number}
const overlaps=(a:Rect,b:Rect,pad=0)=>a.x1<b.x2+pad&&a.x2>b.x1-pad&&a.y1<b.y2+pad&&a.y2>b.y1-pad;
/** Conservative footprint check: unknown, rotated or transformed geometry blocks automatic packing. */
function footprint(id:string,project:Project,offset:[number,number]=[0,0],depth=0):Rect{
 check(depth<16,"Nested object too deep to position inserts safely.");
 const n=project.nodes[id];check(!!n,`Missing saved part ${id}.`);
 check(n.rotation.every(v=>Math.abs(v)<1e-6)&&n.scale.every(v=>Math.abs(v-1)<1e-6),
  "Auto-placement needs unrotated, unscaled objects. Place inserts manually instead.");
 const x=offset[0]+n.position[0],y=offset[1]+n.position[1];
 if(isGroup(n)){
  check(n.childIds.length>0,"Cannot pack around an empty group.");
  const bounds=n.childIds.map(child=>footprint(child,project,[x,y],depth+1));
  return {x1:Math.min(...bounds.map(a=>a.x1)),y1:Math.min(...bounds.map(a=>a.y1)),
   x2:Math.max(...bounds.map(a=>a.x2)),y2:Math.max(...bounds.map(a=>a.y2))};
 }
 check(n.kind==="box"||n.kind==="rounded-box"||n.kind==="cylinder",
  "Auto-placement needs simple box/cylinder objects on the plate.");
 const w=n.kind==="cylinder"?Number(n.params.r)*2:Number(n.params.w);
 const d=n.kind==="cylinder"?Number(n.params.r)*2:Number(n.params.d);
 check(Number.isFinite(w)&&Number.isFinite(d)&&w>0&&d>0,"Part has invalid footprint dimensions.");
 return {x1:x-w/2,y1:y-d/2,x2:x+w/2,y2:y+d/2};
}
type Slot={min:number;max:number};
type DividerFace={min:number;max:number};
const near=(a:number,b:number,eps=1)=>Math.abs(a-b)<=eps;

/**
 * Actual *solid* divider faces determine compartment width. A nominal equal
 * grid is safe only when the cavity contains no physical dividers on that axis.
 * We scan first-child wrapper chains (as used by BoxFit) without relying on
 * user-editable labels. Unrecognised objects INSIDE the cavity are a safe
 * refusal, never a falsely "fitting" bin.
 */
function compartmentSlots(project:Project,rootId:string,sh:ShellInfo,
 cols:number,rows:number,binHeight:number):{x:Slot[];y:Slot[];hasX:boolean;hasY:boolean}{
 const xMin=sh.cx-Number(sh.cavity.params.w)/2,xMax=sh.cx+Number(sh.cavity.params.w)/2;
 const yMin=sh.cy-Number(sh.cavity.params.d)/2,yMax=sh.cy+Number(sh.cavity.params.d)/2;
 const xDiv:DividerFace[]=[],yDiv:DividerFace[]=[];
 const seen=new Set<string>();
 let id=rootId;
 let xOffset=0,yOffset=0,zOffset=0;
 for(let depth=0;depth<14;depth++){
  check(!seen.has(id),"Invalid cyclic hollow-box wrapper.");
  seen.add(id);
  const node=project.nodes[id];
  if(!node||!isGroup(node))throw new Error("Cannot inspect existing interior fixtures.");
  check(node.rotation.every(v=>Math.abs(v)<1e-6)&&node.scale.every(v=>Math.abs(v-1)<1e-6),
   "Cannot size inserts inside a rotated or scaled box.");
  xOffset+=node.position[0];yOffset+=node.position[1];zOffset+=node.position[2];
  const first=project.nodes[node.childIds[0]];
  if(first&&!isGroup(first)&&node.childIds.length===2)break; // original solid + cavity
  for(const extraId of node.childIds.slice(1)){
   const extra=project.nodes[extraId];
   if(!extra||isGroup(extra)||extra.role==="hole")continue;
   check(extra.kind==="box"&&extra.rotation.every(v=>Math.abs(v)<1e-6)&&
    extra.scale.every(v=>Math.abs(v-1)<1e-6),
     "Existing nonrectangular interior fixtures need manual bin fitting.");
   const w=Number(extra.params.w),d=Number(extra.params.d),h=Number(extra.params.h);
   check([w,d,h].every(Number.isFinite)&&w>0&&d>0&&h>0,
    "Existing internal fixture has invalid dimensions.");
   const x=xOffset+extra.position[0],y=yOffset+extra.position[1],z=zOffset+extra.position[2];
   const xx:[number,number]=[x-w/2,x+w/2],yy:[number,number]=[y-d/2,y+d/2];
   if(xx[1]<=xMin||xx[0]>=xMax||yy[1]<=yMin||yy[0]>=yMax||
      z+h/2<=sh.bottom+sh.floor||z-h/2>=sh.bottom+sh.floor+binHeight)continue;
   const alongY=w<=6 && d>=yMax-yMin-2&&near(y,sh.cy,1.1);
   const alongX=d<=6 && w>=xMax-xMin-2&&near(x,sh.cx,1.1);
   check(alongY!==alongX,
     "The box has interior fixtures or partial dividers that prevent automatic bin fitting.");
   if(alongY)xDiv.push({min:xx[0],max:xx[1]});
   else yDiv.push({min:yy[0],max:yy[1]});
  }
  check(!!first&&isGroup(first),"The hollow box wrapper does not match its original shell.");
  id=first.id;
  if(depth===13)throw new Error("Too many nested box wrappers to fit bins safely.");
 }
 const slots=(min:number,max:number,walls:DividerFace[],count:number,axis:string):Slot[]=>{
  if(!walls.length){
   const step=(max-min)/count;
   return Array.from({length:count},(_,i)=>({min:min+i*step,max:min+(i+1)*step}));
  }
  check(walls.length===count-1,
    "The requested "+axis+" bin grid must match the existing physical dividers.");
  walls.sort((a,b)=>a.min-b.min);
  const spans:Slot[]=[];
  let last=min;
  for(const wall of walls){
   check(wall.min>last+2&&wall.max<max-2,
    "Physical dividers are overlapping or too close to a box wall.");
   spans.push({min:last,max:wall.min});
   last=wall.max;
  }
  spans.push({min:last,max});
  return spans;
 };
 return {x:slots(xMin,xMax,xDiv,cols,"column"),y:slots(yMin,yMax,yDiv,rows,"row"),
  hasX:xDiv.length>0,hasY:yDiv.length>0};
}

function radiusPicks(shell:ShellInfo,cols:number,rows:number,c:number,r:number,sw:number,sr:number,gap:number):UprightCorners{
 const original=uprightCornerRadii(shell.cavity);
 const mask=(id:"8"|"9"|"10"|"11")=>{
  const left=id==="8"||id==="10",bottom=id==="8"||id==="9";
  return (left?c===0:c+sw===cols)&&(bottom?r===0:r+sr===rows)?Math.max(0,original[id]-gap):0;
 };
 return {"8":mask("8"),"9":mask("9"),"10":mask("10"),"11":mask("11")};
}
function fittedCorners(shape:ShapeNode,corners:UprightCorners):ShapeNode {
 const mx=Math.min(Number(shape.params.w),Number(shape.params.d))/2-0.02;
 const safe:UprightCorners={"8":Math.min(corners["8"],mx),"9":Math.min(corners["9"],mx),
  "10":Math.min(corners["10"],mx),"11":Math.min(corners["11"],mx)};
 return Object.values(safe).some(v=>v>=0.05)?independentUprightFillets(shape,safe):shape;
}
/** Side gap is from an insert's outer wall to its allocated grid cell edges. */
export function planOrganizerInserts(project:Project,shellId:string,bed:[number,number],opt:OrganizerOptions):OrganizerPlan{
 const sh=identifyShell(shellId,project);
 const {cols,rows}=opt;
 check(Number.isInteger(cols)&&cols>=1&&cols<=6&&Number.isInteger(rows)&&rows>=1&&rows<=6&&cols*rows<=20,
  "Use 1–6 columns and rows, up to 20 total cells.");
 size(opt.gap,"Side clearance",0.15,2);
 size(opt.wall,"Bin wall",0.8,5);size(opt.floor,"Bin floor",0.8,6);
 size(opt.topGap,"Top clearance",0.5,8);size(opt.bedGap,"Bed spacing",3,25);
 check(opt.mode==="full"||opt.mode==="span"||opt.mode==="mixed","Choose full grid or spanning bin.");
 const iw=Number(sh.cavity.params.w),idp=Number(sh.cavity.params.d);
 const cellWidth=iw/cols,cellDepth=idp/rows;
 const height=sh.height-sh.floor-opt.topGap;
 check(height>=opt.floor+2,"Box is too shallow for removable bins with these floors.");
 const cells: {col:number;row:number;spanCols:number;spanRows:number}[]=[];
 if(opt.mode==="full"){
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++)cells.push({col:c,row:r,spanCols:1,spanRows:1});
 }else{
  check([opt.col,opt.row,opt.spanCols,opt.spanRows].every(Number.isInteger),"Grid cells and span must be whole numbers.");
  check(opt.col>=1&&opt.row>=1&&opt.spanCols>=1&&opt.spanRows>=1&&
   opt.col+opt.spanCols-1<=cols&&opt.row+opt.spanRows-1<=rows,"Spanning bin extends beyond the chosen grid.");
  cells.push({col:opt.col-1,row:opt.row-1,spanCols:opt.spanCols,spanRows:opt.spanRows});
  if(opt.mode==="mixed"){
   for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
    const occupied=c>=opt.col-1&&c<opt.col-1+opt.spanCols&&r>=opt.row-1&&r<opt.row-1+opt.spanRows;
    if(!occupied)cells.push({col:c,row:r,spanCols:1,spanRows:1});
   }
  }
 }
 const compartments=compartmentSlots(project,shellId,sh,cols,rows,height);
 const base=cells.map(item=>{
  check(!(compartments.hasX&&item.spanCols>1) &&
        !(compartments.hasY&&item.spanRows>1),
   "A spanning bin would cross an existing physical divider.");
  const x1=compartments.x[item.col].min,
    x2=compartments.x[item.col+item.spanCols-1].max;
  const y1=compartments.y[item.row].min,
    y2=compartments.y[item.row+item.spanRows-1].max;
  const w=x2-x1-2*opt.gap,d=y2-y1-2*opt.gap;
  check(w>2*opt.wall+2&&d>2*opt.wall+2,"Grid cells are too small for the bin walls and clearance.");
  return {...item,w,d,cx:(x1+x2)/2-sh.cx,cy:(y1+y2)/2-sh.cy};
 });
 // Entire grid layout has the cavity's footprint; place it beside the box,
 // not intersecting either the original box, any matching lid, or other objects.
 const obstacles=project.rootOrder.map(id=>footprint(id,project));
 const target=footprint(shellId,project);
 const candidateCenters:[number,number][]=[
  [(target.x1+target.x2)/2,target.y1-idp/2-opt.bedGap],
  [(target.x1+target.x2)/2,target.y2+idp/2+opt.bedGap],
  [target.x1-iw/2-opt.bedGap,(target.y1+target.y2)/2],
  [target.x2+iw/2+opt.bedGap,(target.y1+target.y2)/2],
 ];
 const valid=(cx:number,cy:number)=>{
  const bounds:Rect={x1:cx-iw/2,y1:cy-idp/2,x2:cx+iw/2,y2:cy+idp/2};
  return bounds.x1>=-bed[0]/2+0.01&&bounds.x2<=bed[0]/2-0.01&&
    bounds.y1>=-bed[1]/2+0.01&&bounds.y2<=bed[1]/2-0.01&&
    obstacles.every(other=>!overlaps(bounds,other,1));
 };
 const layout=candidateCenters.find(([x,y])=>valid(x,y));
 check(!!layout,"Not enough clear build-plate space beside the box/lid for these inserts. Move the objects or use fewer bins.");
 const [x,y]=layout!;
 const bins:PlannedBin[]=base.map(cell=>{
  const xx=x+cell.cx,yy=y+cell.cy;
  const corners=radiusPicks(sh,cols,rows,cell.col,cell.row,cell.spanCols,cell.spanRows,opt.gap);
  // A tiny cell beside a very large cavity fillet cannot use a smaller
  // independent quarter-circle: clipping its radius changes the centre and
  // pushes material INTO the rounded wall. Refuse instead of inventing fit.
  const maxCorner=Math.min(cell.w,cell.d)/2-0.02;
  check(Object.values(corners).every(r=>r<=maxCorner+.00001),
   "A tray corner radius is too large for this bin cell. Use fewer cells or a smaller corner radius.");
  const outside=fittedCorners(basicBox(cell.w,cell.d,height,xx,yy,height/2),corners);
  const inside=fittedCorners(basicBox(cell.w-2*opt.wall,cell.d-2*opt.wall,
   height-opt.floor+0.8,xx,yy,opt.floor+(height-opt.floor+0.8)/2,"hole"),
   {"8":Math.max(0,corners["8"]-opt.wall),"9":Math.max(0,corners["9"]-opt.wall),
    "10":Math.max(0,corners["10"]-opt.wall),"11":Math.max(0,corners["11"]-opt.wall)});
  const group:GroupNode={id:newId(),type:"group",label:`Removable bin ${cell.col+1},${cell.row+1} (${cell.spanCols}x${cell.spanRows} cells)`,
   childIds:[outside.id,inside.id],position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]};
  return {group,outside,inside,...cell};
 });
 return {bins,cellWidth,cellDepth,clearance:opt.gap,layout:layout!};
}
/** One undoable edit; original shell, lid, printer setup and saved settings untouched. */
export function createOrganizerInserts(shellId:string,options:OrganizerOptions):OrganizerPlan{
 const state=useScene.getState();
 check(!!state.bed,"Select the AD5X build plate first.");
 const plan=planOrganizerInserts(state.project,shellId,state.bed!,options);
 useScene.setState(s=>{
  const nodes={...s.project.nodes};
  for(const bin of plan.bins){nodes[bin.outside.id]=bin.outside;nodes[bin.inside.id]=bin.inside;nodes[bin.group.id]=bin.group;}
  return {project:{...s.project,nodes,rootOrder:[...s.project.rootOrder,...plan.bins.map(b=>b.group.id)]},
    selection:plan.bins.map(b=>b.group.id)};
 });
 return plan;
}