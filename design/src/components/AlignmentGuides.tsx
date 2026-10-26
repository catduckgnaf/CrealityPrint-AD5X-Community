import {useEffect,useMemo,useRef} from "react";
import {useFrame} from "@react-three/fiber";
import * as THREE from "three";
import {useScene} from "../state/store";
import {sceneApi} from "../lib/sceneApi";

/** Only offers visual guidance. Deliberately never calls a transform setter. */
export function nearAligned(a:THREE.Box3,b:THREE.Box3,tolerance=0.35):{
 axis:0|1;coordinate:number;distance:number
}[] {
  const output:{axis:0|1;coordinate:number;distance:number}[]=[];
  for(const axis of [0,1] as const) {
    const av=[a.min.getComponent(axis),(a.min.getComponent(axis)+a.max.getComponent(axis))/2,a.max.getComponent(axis)];
    const bv=[b.min.getComponent(axis),(b.min.getComponent(axis)+b.max.getComponent(axis))/2,b.max.getComponent(axis)];
    let best=Infinity,point=0;
    for(const x of av)for(const y of bv){
      const d=Math.abs(x-y);
      if(d<best){best=d;point=(x+y)/2;}
    }
    if(best<=tolerance)output.push({axis,coordinate:point,distance:best});
  }
  return output;
}

export function AlignmentGuides(){
  const selection=useScene(s=>s.selection);
  const roots=useScene(s=>s.project.rootOrder);
  const nodes=useScene(s=>s.project.nodes);
  const line=useRef<THREE.LineSegments>(null);
  const geometry=useMemo(()=>{
    const g=new THREE.BufferGeometry();
    g.setAttribute("position",new THREE.BufferAttribute(new Float32Array(12),3));
    g.setDrawRange(0,0);return g;
  },[]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  const material=useMemo(()=>new THREE.LineBasicMaterial({
    color:"#60e18c",depthTest:false,depthWrite:false,transparent:true,opacity:0.9,
  }),[]);
  useEffect(()=>()=>material.dispose(),[material]);
  const lineObj=useMemo(()=>new THREE.LineSegments(geometry,material),[geometry,material]);
  useFrame(()=>{
    if(!line.current)return;
    line.current.visible=false;
    if(selection.length!==1||roots.length>80)return;
    const selected=selection[0],node=nodes[selected];
    if(!node||node.hidden)return;
    const a=sceneApi.getNodeBounds(selected);
    if(!a||a.isEmpty())return;
    const guides:{axis:0|1;coordinate:number;distance:number;target:THREE.Box3}[]=[];
    for(const id of roots) {
      if(id===selected||nodes[id]?.hidden)continue;
      const b=sceneApi.getNodeBounds(id);
      if(!b||b.isEmpty())continue;
      for(const guide of nearAligned(a,b))guides.push({...guide,target:b});
    }
    const packed:number[]=[];
    for(const axis of [0,1] as const){
      const g=guides.filter(x=>x.axis===axis).sort((x,y)=>x.distance-y.distance)[0];
      if(!g)continue;
      const b=g.target,z=Math.max(a.max.z,b.max.z)+1;
      if(axis===0) packed.push(g.coordinate,Math.min(a.min.y,b.min.y)-6,z,
        g.coordinate,Math.max(a.max.y,b.max.y)+6,z);
      else packed.push(Math.min(a.min.x,b.min.x)-6,g.coordinate,z,
        Math.max(a.max.x,b.max.x)+6,g.coordinate,z);
    }
    if(!packed.length)return;
    const attr=geometry.getAttribute("position") as THREE.BufferAttribute;
    (attr.array as Float32Array).set(packed);
    attr.needsUpdate=true;
    geometry.setDrawRange(0,packed.length/3);
    geometry.computeBoundingSphere();
    line.current.visible=true;
  });
  return <primitive object={lineObj} ref={line} raycast={()=>null} renderOrder={1100}/>;
}
