import {useEffect,useState} from "react";
import {Html} from "@react-three/drei";
import {useFrame} from "@react-three/fiber";
import {useScene} from "../state/store";
import {isGroup} from "../types/scene";
import {sceneApi} from "../lib/sceneApi";

export type DimensionAxis="w"|"d"|"h";
export interface DimensionEditRequest{
  axis:DimensionAxis;id:string;value:number;clientX:number;clientY:number;
}
function DimensionTag({axis,value,pos,locked,id}:{
 axis:DimensionAxis;value:number;pos:[number,number,number];locked:boolean;id:string;
}){
  return <Html position={pos} center zIndexRange={[65,55]} style={{pointerEvents:"auto"}}>
    <button type="button" className={"design-dimension-tag axis-"+axis}
      title={locked?"Unlock to edit":"Click to edit size in millimetres"}
      onPointerDown={e=>e.stopPropagation()}
      onClick={e=>{
        e.stopPropagation();
        if(locked)return;
        window.dispatchEvent(new CustomEvent<DimensionEditRequest>("ad5x-edit-dimension",{
          detail:{axis,value,id,clientX:e.clientX,clientY:e.clientY},
        }));
      }}>
      {axis.toUpperCase()} {value.toFixed(1)} mm
    </button>
  </Html>;
}

/** Labels display parametric box dimensions, not an estimated world AABB size.
 * Editing happens in a stable DOM popover outside the canvas. */
export function ModelDimensions(){
  const selection=useScene(s=>s.selection);
  const node=useScene(s=>selection.length===1?s.project.nodes[selection[0]]:null);
  const [bounds,setBounds]=useState<{min:[number,number,number];max:[number,number,number]}|null>(null);
  const supported=!!node&&!isGroup(node)&&node.kind==="box"&&Math.abs(Number(node.params.bendAngle||0))<0.001&&
    node.rotation.every(r=>Math.abs(r)<1e-5)&&node.scale.every(s=>Math.abs(s-1)<1e-5)&&!node.hidden;
  const id=node?.id??"";
  useEffect(()=>setBounds(null),[id]);
  useFrame(()=>{
    if(!supported)return;
    const box=sceneApi.getNodeBounds(id);
    if(!box||box.isEmpty())return;
    const min=box.min.toArray() as [number,number,number];
    const max=box.max.toArray() as [number,number,number];
    setBounds(prev=>{
      if(prev&&prev.min.every((v,i)=>Math.abs(v-min[i])<0.02)&&
        prev.max.every((v,i)=>Math.abs(v-max[i])<0.02))return prev;
      return {min,max};
    });
  });
  if(!supported||!bounds||!node||isGroup(node))return null;
  const [x0,y0,z0]=bounds.min,[x1,y1,z1]=bounds.max;
  const w=Number(node.params.w)||20,d=Number(node.params.d)||20,h=Number(node.params.h)||20;
  const mid=(a:number,b:number)=>(a+b)*0.5;
  const off=Math.max(4,Math.min(w,d,h)*0.25);
  return <>
    <DimensionTag axis="w" value={w} pos={[mid(x0,x1),y0-off,z1+2]} locked={!!node.locked} id={id}/>
    <DimensionTag axis="d" value={d} pos={[x0-off,mid(y0,y1),z1+2]} locked={!!node.locked} id={id}/>
    <DimensionTag axis="h" value={h} pos={[x1+off,y1+off,mid(z0,z1)]} locked={!!node.locked} id={id}/>
  </>;
}
