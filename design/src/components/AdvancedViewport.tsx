import {useEffect,useMemo,useState} from "react";
import {useThree} from "@react-three/fiber";
import * as THREE from "three";
import {useAdvancedView} from "../lib/advancedView";

export function useSectionClipping(){
  const on=useAdvancedView(s=>s.sectionEnabled);
  const axis=useAdvancedView(s=>s.sectionAxis);
  const offset=useAdvancedView(s=>s.sectionOffset);
  return useMemo(()=>{
    if(!on)return [];
    const normal=new THREE.Vector3(axis==="x"?1:0,axis==="y"?1:0,axis==="z"?1:0);
    return [new THREE.Plane(normal,-offset)];
  },[on,axis,offset]);
}
export function SectionController(){
  const gl=useThree(s=>s.gl);
  useEffect(()=>{
    const before=gl.localClippingEnabled;
    gl.localClippingEnabled=true;
    return ()=>{gl.localClippingEnabled=before;};
  },[gl]);
  return null;
}
function ImageMesh({url,width,ratio,opacity}:{
 url:string;width:number;ratio:number;opacity:number;
}){
  const [texture,setTexture]=useState<THREE.Texture|null>(null);
  useEffect(()=>{
    let live=true;
    new THREE.TextureLoader().load(url,t=>{
      t.colorSpace=THREE.SRGBColorSpace;
      if(live)setTexture(t);else t.dispose();
    },undefined,()=>{if(live)setTexture(null);});
    return ()=>{live=false;};
  },[url]);
  useEffect(()=>()=>texture?.dispose(),[texture]);
  if(!texture)return null;
  return <mesh position={[0,0,-0.035]} raycast={()=>null} renderOrder={600}>
    <planeGeometry args={[width,width*ratio]}/>
    <meshBasicMaterial map={texture} transparent opacity={opacity}
      depthWrite={false} toneMapped={false} side={THREE.DoubleSide}/>
  </mesh>;
}
export function ReferencePlane(){
  const url=useAdvancedView(s=>s.imageUrl);
  const width=useAdvancedView(s=>s.imageWidth);
  const ratio=useAdvancedView(s=>s.imageRatio);
  const opacity=useAdvancedView(s=>s.imageOpacity);
  return url?<ImageMesh key={url} url={url} width={width} ratio={ratio} opacity={opacity}/>:null;
}
