import {useScene} from "../state/store";
import {makeShape} from "./primitives";
import {newId} from "./id";
import {isGroup,type GroupNode,type ShapeNode} from "../types/scene";

function requireNum(v:number,name:string,min:number,max:number):number{
 if(!Number.isFinite(v)||v<min||v>max)throw new Error(name+" must be between "+min+" and "+max+" mm.");
 return v;
}
function box(w:number,d:number,h:number,x=0,y=0,z=h/2,role:"solid"|"hole"="solid"):ShapeNode{
 const s=makeShape("box");s.params={w,d,h,radius:0};s.position=[x,y,z];s.role=role;return s;
}
function cyl(d:number,h:number,x=0,y=0,z=h/2,role:"solid"|"hole"="solid"):ShapeNode{
 const s=makeShape("cylinder");s.params={r:d/2,h,segments:64,bevel:0};s.position=[x,y,z];s.role=role;return s;
}
export function shellParts(w:number,d:number,h:number,t:number,b:number):ShapeNode[]{
 requireNum(w,"Width",5,300);requireNum(d,"Depth",5,300);requireNum(h,"Height",3,300);
 requireNum(t,"Wall",0.6,30);requireNum(b,"Base",0.6,30);
 if(t*2>=Math.min(w,d)||b>=h)throw new Error("The specified wall or base leaves no cavity.");
 const cavityH=h-b+2;
 return [box(w,d,h),box(w-2*t,d-2*t,cavityH,0,0,b+cavityH/2,"hole")];
}
export type LibraryItem="standoff"|"mounting-tab"|"cable-guide"|"tray";
export function libraryParts(item:LibraryItem):ShapeNode[]{
 if(item==="tray")return shellParts(80,55,20,2,2);
 if(item==="standoff")return [cyl(8,12),cyl(3.2,14,0,0,6,"hole")];
 if(item==="mounting-tab")return [box(20,14,4),cyl(4.2,6,0,0,2,"hole")];
 return [box(20,12,2,0,0,1),box(2,12,14,-9,0,7),box(2,12,14,9,0,7)];
}
export function insertAssembly(parts:ShapeNode[],label:string):string{
 const id=newId();
 const group:GroupNode={id,type:"group",label,childIds:parts.map(p=>p.id),
  position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]};
 useScene.setState(s=>({project:{...s.project,nodes:{...s.project.nodes,
  ...Object.fromEntries(parts.map(p=>[p.id,p])),[id]:group},
  rootOrder:[...s.project.rootOrder,id]},selection:[id]}));
 return id;
}
export function createShell(w:number,d:number,h:number,t:number,b:number):string{
 return insertAssembly(shellParts(w,d,h,t,b),"Hollow box");
}
export function insertLibrary(item:LibraryItem):string{
 return insertAssembly(libraryParts(item),item.replace("-"," "));
}
function selectedRoot(id:string):ShapeNode{
 const s=useScene.getState().project;
 const n=s.nodes[id];
 if(!s.rootOrder.includes(id)||!n||isGroup(n)||n.hidden||n.locked)
  throw new Error("Select one unlocked top-level shape.");
 return n;
}
export type HoleStyle="through"|"blind"|"counterbore";
export function drillBox(id:string,diameter:number,x:number,y:number,depth:number,style:HoleStyle,
 headDiameter:number,headDepth:number):string{
 const src=selectedRoot(id);
 if(src.kind!=="box"||src.rotation.some(v=>Math.abs(v)>0.001)||src.scale.some(v=>Math.abs(v-1)>0.001))
  throw new Error("Hole Wizard currently supports unrotated, unscaled boxes.");
 const w=Number(src.params.w),d=Number(src.params.d),h=Number(src.params.h);
 requireNum(diameter,"Hole diameter",0.5,Math.min(w,d));
 requireNum(x,"X offset",-w/2,w/2);requireNum(y,"Y offset",-d/2,d/2);
 if(Math.abs(x)+diameter/2>w/2||Math.abs(y)+diameter/2>d/2)throw new Error("Hole crosses the box edge.");
 const top=src.position[2]+h/2,through=style!=="blind";
 if(!through)requireNum(depth,"Blind depth",0.5,h-0.4);
 const cutDepth=through?h+2:depth;
 const cutZ=through?src.position[2]:top-depth/2+0.05;
 const cut=cyl(diameter,cutDepth,src.position[0]+x,src.position[1]+y,cutZ,"hole");
 const parts=[cut];
 if(style==="counterbore"){
  requireNum(headDiameter,"Head diameter",diameter+0.1,Math.min(w,d));
  requireNum(headDepth,"Head depth",0.5,h-0.1);
  if(Math.abs(x)+headDiameter/2>w/2||Math.abs(y)+headDiameter/2>d/2)
   throw new Error("Counterbore crosses the box edge.");
  parts.push(cyl(headDiameter,headDepth+0.4,src.position[0]+x,src.position[1]+y,
   top-headDepth/2+0.2,"hole"));
 }
 const gid=newId();
 const group:GroupNode={id:gid,type:"group",label:"Box with hole",
  childIds:[id,...parts.map(p=>p.id)],position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]};
 useScene.setState(s=>({project:{...s.project,
  nodes:{...s.project.nodes,...Object.fromEntries(parts.map(p=>[p.id,p])),[gid]:group},
  rootOrder:s.project.rootOrder.map(item=>item===id?gid:item)},selection:[gid]}));
 return gid;
}
export type RepeatMode="linear"|"grid"|"circular";
export function repeatShape(id:string,mode:RepeatMode,count:number,dx:number,dy:number,radius:number):number{
 const n=selectedRoot(id);
 if(!Number.isInteger(count)||count<2||count>36)throw new Error("Repeat count must be 2-36.");
 requireNum(dx,"X spacing",-200,200);requireNum(dy,"Y spacing",-200,200);
 requireNum(radius,"Circle radius",0,150);
 const copies:ShapeNode[]=[];
 for(let i=1;i<count;i++){
  const copy:ShapeNode={...n,id:newId(),params:{...n.params},
   position:[...n.position],rotation:[...n.rotation],scale:[...n.scale]};
  if(mode==="linear"){copy.position[0]+=i*dx;copy.position[1]+=i*dy;}
  else if(mode==="grid"){
   const columns=Math.ceil(Math.sqrt(count));
   copy.position[0]+=(i%columns)*dx;copy.position[1]+=Math.floor(i/columns)*dy;
  }else {
   const angle=Math.PI*2*i/count;
   copy.position[0]+=radius*(Math.cos(angle)-1);
   copy.position[1]+=radius*Math.sin(angle);
  }
  copies.push(copy);
 }
 useScene.setState(s=>({project:{...s.project,
  nodes:{...s.project.nodes,...Object.fromEntries(copies.map(n=>[n.id,n]))},
  rootOrder:[...s.project.rootOrder,...copies.map(n=>n.id)]},
  selection:copies.map(n=>n.id)}));
 return copies.length;
}
export function mirroredCopy(id:string,axis:0|1):string{
 const n=selectedRoot(id);
 const clone:ShapeNode={...n,id:newId(),params:{...n.params},
  position:[...n.position],rotation:[...n.rotation],scale:[...n.scale],
  label:(n.label||n.kind)+" mirrored"};
 clone.position[axis]*=-1;clone.scale[axis]*=-1;
 useScene.setState(s=>({project:{...s.project,
  nodes:{...s.project.nodes,[clone.id]:clone},
  rootOrder:[...s.project.rootOrder,clone.id]},selection:[clone.id]}));
 return clone.id;
}
export type SketchPreset="rectangle"|"hexagon"|"l-shape";
export function sketchPreset(type:SketchPreset,w:number,d:number,h:number):void{
 requireNum(w,"Width",2,200);requireNum(d,"Depth",2,200);requireNum(h,"Height",0.5,100);
 let p:[number,number][];
 if(type==="rectangle")p=[[0,0],[w,0],[w,d],[0,d]];
 else if(type==="l-shape")p=[[0,0],[w,0],[w,d*0.3],[w*0.3,d*0.3],[w*0.3,d],[0,d]];
 else p=Array.from({length:6},(_,i)=>{
  const a=i*Math.PI/3;
  return [w/2+w/2*Math.cos(a),d/2+d/2*Math.sin(a)] as [number,number];
 });
 useScene.getState().addShapeWithParams("sketch",{profile:JSON.stringify(p),h});
}
