import { useScene } from "../state/store";
import {makeShape} from "./primitives";
import {newId} from "./id";
import {isGroup,type GroupNode,type ShapeNode,type Project} from "../types/scene";
import {uprightCornerRadii,independentUprightFillets,offsetCornerRadii} from "./matchedLidCorners";

export const limits=(v:number,name:string,min:number,max:number)=>{
 if(!Number.isFinite(v)||v<min||v>max)throw new Error(name+" must be "+min+"â€“"+max+" mm.");
 return v;
};
export const basicBox=(w:number,d:number,h:number,x:number,y:number,z:number,role:"solid"|"hole"="solid"):ShapeNode=>{
 const n=makeShape("box");
 n.params={w,d,h,radius:0};n.position=[x,y,z];n.role=role;return n;
};
export interface ShellInfo{root:GroupNode;outer:ShapeNode;cavity:ShapeNode;width:number;depth:number;height:number;wallX:number;wallY:number;floor:number;cx:number;cy:number;bottom:number;top:number;}
const same=(a:number,b:number)=>Math.abs(a-b)<0.02;
const cleanGroup=(root:GroupNode)=>root.rotation.every(a=>Math.abs(a)<1e-5)&&root.scale.every(a=>same(a,1));
export function identifyShell(id:string,project:Project):ShellInfo{
 const topRoot=project.nodes[id];
 if(!topRoot||!isGroup(topRoot)||!project.rootOrder.includes(id)||topRoot.hidden||topRoot.locked||!cleanGroup(topRoot))
  throw new Error("Select a visible, unlocked, unrotated hollow box group.");
 let root=topRoot;
 const parentOffset:[number,number,number]=[0,0,0];
 // Previous Divider / Clip actions wrap the original shell without altering its cutters.
 // Follow only the first, nested shell child, never reinterpret arbitrary groups.
 for(let nesting=0;nesting<6;nesting++){
  const candidate=root.childIds.map(x=>project.nodes[x]);
  if(candidate.length===2 && candidate.every(x=>x&&!isGroup(x)))break;
  const nested=candidate[0];
  if(!nested||!isGroup(nested)||!cleanGroup(nested)||nested.hidden||nested.locked)
   throw new Error("Choose a shell or a shell with added dividers/tabs.");
  for(let axis=0;axis<3;axis++)parentOffset[axis]+=root.position[axis];
  root=nested;
 }
 const children=root.childIds.map(x=>project.nodes[x]);
 if(children.length!==2||children.some(x=>!x||isGroup(x)))
  throw new Error("A simple rectangular hollow shell was not found.");
 const shapes=children as ShapeNode[];
 const outer=shapes.find(n=>n.kind==="box"&&n.role==="solid");
 const cavity=shapes.find(n=>n.kind==="box"&&n.role==="hole");
 if(!outer||!cavity||outer.scale.some(x=>!same(x,1))||cavity.scale.some(x=>!same(x,1))||
 outer.rotation.some(x=>Math.abs(x)>1e-5)||cavity.rotation.some(x=>Math.abs(x)>1e-5))
  throw new Error("Selected group is not an axis-aligned hollow box.");
 const width=Number(outer.params.w),depth=Number(outer.params.d),height=Number(outer.params.h);
 const iw=Number(cavity.params.w),idp=Number(cavity.params.d),ih=Number(cavity.params.h);
 const wallX=(width-iw)/2,wallY=(depth-idp)/2;
 const bottom=parentOffset[2]+root.position[2]+outer.position[2]-height/2;
 const top=bottom+height;
 const floor=parentOffset[2]+root.position[2]+cavity.position[2]-ih/2-bottom;
 const cx=parentOffset[0]+root.position[0]+outer.position[0],cy=parentOffset[1]+root.position[1]+outer.position[1];
 if(![width,depth,height,iw,idp,ih,wallX,wallY,floor,cx,cy,bottom].every(Number.isFinite)||
 width<=0||depth<=0||height<=0||wallX<0.5||wallY<0.5||floor<0.5||floor>=height||
 !same(outer.position[0],cavity.position[0])||!same(outer.position[1],cavity.position[1])||
 root.childIds[0]!==outer.id||root.childIds[1]!==cavity.id||
 cavity.position[2]+ih/2 < outer.position[2]+height/2+0.5)
   throw new Error("Selected group has a different cavity layout; no automatic edits were made.");
 return {root,outer,cavity,width,depth,height,wallX,wallY,floor,cx,cy,bottom,top};
}
export interface LidOptions{clearance:number;thickness:number;lipDepth:number;lipWall:number;overhang:number;bedGap:number;}
export function lidParts(shell:ShellInfo,o:LidOptions,bed:[number,number]=[220,220]):ShapeNode[]{
 limits(o.clearance,"Clearance per side",0.1,2);
 limits(o.thickness,"Lid thickness",1,12);
 limits(o.lipDepth,"Insertion lip depth",1,20);
 limits(o.lipWall,"Insertion lip wall",0.8,6);
 limits(o.overhang,"Overhang",0,6);limits(o.bedGap,"Bed gap",3,35);
 const lipW=Number(shell.cavity.params.w)-2*o.clearance;
 const lipD=Number(shell.cavity.params.d)-2*o.clearance;
 if(lipW<=2*o.lipWall+2||lipD<=2*o.lipWall+2)
  throw new Error("Clearance or lip wall leaves no space for a lip.");
 if(o.lipDepth>shell.height-shell.floor-0.8)
  throw new Error("Insertion lip is deeper than the box interior.");
 const lidW=shell.width+2*o.overhang,lidD=shell.depth+2*o.overhang;
 const candidates:[number,number][]=[
  [shell.cx,shell.cy+shell.depth/2+lidD/2+o.bedGap],
  [shell.cx,shell.cy-shell.depth/2-lidD/2-o.bedGap],
  [shell.cx+shell.width/2+lidW/2+o.bedGap,shell.cy],
  [shell.cx-shell.width/2-lidW/2-o.bedGap,shell.cy],
 ];
 const fits=(x:number,y:number,w:number,d:number)=>
  x-w/2>=-bed[0]/2+0.01&&x+w/2<=bed[0]/2-0.01&&
  y-d/2>=-bed[1]/2+0.01&&y+d/2<=bed[1]/2-0.01;
 if(!fits(shell.cx,shell.cy,shell.width,shell.depth))
  throw new Error("The original box already extends outside the current build plate.");
 const placement=candidates.find(([x,y])=>fits(x,y,lidW,lidD));
 if(!placement)throw new Error("No space for a separate lid beside this box on the current plate. Move the box or design the lid separately.");
 const [cx,cy]=placement;
 const lid=basicBox(lidW,lidD,o.thickness,cx,cy,o.thickness/2);
 const ring=basicBox(lipW,lipD,o.lipDepth+0.3,cx,cy,o.thickness+o.lipDepth/2-0.15);
 const opening=basicBox(lipW-2*o.lipWall,lipD-2*o.lipWall,o.lipDepth+0.8,cx,cy,o.thickness+o.lipDepth/2+0.4,"hole");
 const outerCorners=uprightCornerRadii(shell.outer);
 const cavityCorners=uprightCornerRadii(shell.cavity);
 if(Object.values(outerCorners).every(r=>r<0.05)&&Object.values(cavityCorners).every(r=>r<0.05))
  return [lid,ring,opening];
 // Keep each individual corner paired with the matching shell corner. An
 // inward XY offset reduces its radius; an outward offset increases it.
 const lidCorners=offsetCornerRadii(outerCorners,o.overhang);
 const ringCorners=offsetCornerRadii(cavityCorners,-o.clearance);
 const openingCorners=offsetCornerRadii(ringCorners,-o.lipWall);
 return [independentUprightFillets(lid,lidCorners),independentUprightFillets(ring,ringCorners),
         independentUprightFillets(opening,openingCorners)];
}
const group=(name:string,nodes:ShapeNode[]):GroupNode=>({
 id:newId(),type:"group",label:name,childIds:nodes.map(n=>n.id),
 position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],
});
const addParts=(name:string,parts:ShapeNode[]):string=>{
 const parent=group(name,parts);
 useScene.setState(s=>({project:{...s.project,nodes:{
  ...s.project.nodes,...Object.fromEntries(parts.map(p=>[p.id,p])),[parent.id]:parent,
 },rootOrder:[...s.project.rootOrder,parent.id]},selection:[parent.id]}));
 return parent.id;
};
export function createMatchingLid(shellId:string,options:LidOptions):string{
 const info=identifyShell(shellId,useScene.getState().project);
 const bed=useScene.getState().bed;
 if(!bed)throw new Error("Choose an AD5X build plate before creating a matching lid.");
 return addParts("Matching lid",lidParts(info,options,bed));
}
export const wrapAddition=(sourceId:string,label:string,parts:ShapeNode[]):string=>{
 const s=useScene.getState().project;
 if(!s.rootOrder.includes(sourceId)||!s.nodes[sourceId])throw new Error("The selected shell is no longer top-level.");
 const parent:GroupNode={id:newId(),type:"group",label,
  ...(label==="Box with dividers"?{feature:"divider-layer" as const}:{}),
  childIds:[sourceId,...parts.map(p=>p.id)],
  position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]};
 useScene.setState(state=>({project:{...state.project,
  nodes:{...state.project.nodes,...Object.fromEntries(parts.map(n=>[n.id,n])),[parent.id]:parent},
  rootOrder:state.project.rootOrder.map(id=>id===sourceId?parent.id:id)},selection:[parent.id]}));
 return parent.id;
};
export function dividerParts(shell:ShellInfo,cols:number,rows:number,wall:number,topGap:number):ShapeNode[]{
 if(!Number.isInteger(cols)||cols<1||cols>8||!Number.isInteger(rows)||rows<1||rows>8||cols*rows>32)
  throw new Error("Compartments must be 1â€“8 each, maximum 32.");
 limits(wall,"Divider thickness",0.8,6);limits(topGap,"Top gap",0.5,12);
 const iw=Number(shell.cavity.params.w),idp=Number(shell.cavity.params.d);
 const height=shell.height-shell.floor-topGap+0.5;
 if(height<=1.5 || (cols===1&&rows===1))throw new Error("No room for these dividers.");
 if(iw/cols<wall+2||idp/rows<wall+2)throw new Error("Compartments are too narrow.");
 const z=shell.bottom+shell.floor-0.5+height/2;
 const parts:ShapeNode[]=[];
 for(let i=1;i<cols;i++)parts.push(basicBox(wall,idp+0.65,height,
  shell.cx-iw/2+i*iw/cols,shell.cy,z));
 for(let j=1;j<rows;j++)parts.push(basicBox(iw+0.65,wall,height,
  shell.cx,shell.cy-idp/2+j*idp/rows,z));
 return parts;
}
export function addDividers(shellId:string,cols:number,rows:number,wall:number,topGap:number):string{
 const sh=identifyShell(shellId,useScene.getState().project);
 return wrapAddition(shellId,"Box with dividers",dividerParts(sh,cols,rows,wall,topGap));
}