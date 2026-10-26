import {useEffect,useRef,useState} from "react";
import {useScene} from "../state/store";
import {isGroup} from "../types/scene";
import {clampParam} from "../lib/paramLimits";
import type {DimensionEditRequest} from "./ModelDimensions";

/** Stable DOM input, outside of the frequently-rendered Three.js canvas. */
export function DimensionEditor(){
  const [request,setRequest]=useState<DimensionEditRequest|null>(null);
  const [error,setError]=useState("");
  const field=useRef<HTMLInputElement>(null);
  useEffect(()=>{
    const open=(event:Event)=>{
      const detail=(event as CustomEvent<DimensionEditRequest>).detail;
      if(detail && ["w","d","h"].includes(detail.axis)){
        setError("");
        setRequest(detail);
      }
    };
    window.addEventListener("ad5x-edit-dimension",open);
    return ()=>window.removeEventListener("ad5x-edit-dimension",open);
  },[]);
  useEffect(()=>{
    if(request)requestAnimationFrame(()=>{field.current?.focus();field.current?.select();});
  },[request]);
  const submit=()=>{
    if(!request||!field.current)return;
    const value=Number(field.current.value.trim());
    const scene=useScene.getState();
    const node=scene.project.nodes[request.id];
    if(!node||isGroup(node)||node.kind!=="box"||node.locked){
      setError("This shape is not editable.");return;
    }
    if(!Number.isFinite(value)||value<=0){
      setError("Enter a positive dimension in millimetres.");return;
    }
    scene.updateShape(node.id,{params:{...node.params,[request.axis]:clampParam(request.axis,value)}});
    setRequest(null);
  };
  if(!request)return null;
  return <div className="design-dimension-popover" role="dialog" aria-label="Edit model dimension"
    onPointerDown={e=>e.stopPropagation()}
    style={{left:Math.max(12,Math.min(window.innerWidth-245,request.clientX+12)),
      top:Math.max(125,Math.min(window.innerHeight-150,request.clientY-18))}}>
    <strong>Edit {request.axis.toUpperCase()} dimension</strong>
    <label>Millimetres
      <input ref={field} key={request.id+request.axis} type="text" inputMode="decimal"
        defaultValue={String(request.value)} aria-label="Enter dimension millimetres"
        onKeyDown={e=>{
          e.stopPropagation();
          if(e.key==="Enter"){e.preventDefault();submit();}
          if(e.key==="Escape"){e.preventDefault();setRequest(null);}
        }}/>
    </label>
    {error&&<p role="alert">{error}</p>}
    <div>
      <button type="button" onClick={submit}>Apply</button>
      <button type="button" onClick={()=>setRequest(null)}>Cancel</button>
    </div>
  </div>;
}
