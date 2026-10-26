import {useRef,useState,type PointerEvent} from "react";
import {
 bananaBoxHoleIssues,bananaBoxFaceSize,spacedBananaHoles,
 type BananaBoxFace,type BananaBoxCutOptions,type Point
} from "../lib/workshopTools";
import type {PanelSizeInfo} from "../lib/workshopTools";
import {BANANA_PLUG_PRESETS,bananaPlugPreset,type BananaPlugPresetId} from "../lib/bananaPlugPresets";

type Props={shell:PanelSizeInfo;targetName?:"box"|"model";initialPresetId?:BananaPlugPresetId;
 onCreate:(options:BananaBoxCutOptions)=>void};
const VIEW_W=420,VIEW_H=224;
const round=(n:number)=>Math.round(n*10)/10;
const FACES:[BananaBoxFace,string][]=[
 ["front","Front wall"],["back","Back wall"],
 ["left","Left wall"],["right","Right wall"],["floor","Inside floor"]
];
/** Change the existing box geometry in-place by adding editable hole cutters;
 * no new plate or separate printed part is generated.
 */
export function BananaPlugEditor({shell,onCreate,initialPresetId="standard4-contact",targetName="box"}:Props){
 const [face,setFace]=useState<BananaBoxFace>("front");
 const [presetId,setPresetId]=useState<BananaPlugPresetId>(initialPresetId);
 const [diameter,setDiameter]=useState<number>(
  bananaPlugPreset(initialPresetId).holeDiameterMm??NaN);
 const [customDiameter,setCustomDiameter]=useState<number>(NaN);
 const preset=bananaPlugPreset(presetId);
 const requiresMeasuredDiameter=preset.holeDiameterMm===null;
 const changePreset=(id:BananaPlugPresetId)=>{
  const choice=bananaPlugPreset(id);
  setPresetId(id);
  setDiameter(choice.holeDiameterMm===null?customDiameter:choice.holeDiameterMm);
 };
 const changeCustomDiameter=(value:number)=>{setCustomDiameter(value);setDiameter(value);};
 const [spacing,setSpacing]=useState(30);
 const [points,setPoints]=useState<Point[]>(()=>spacedBananaHoles(2,30));
 const [positionsOpen,setPositionsOpen]=useState(true);
 const [selected,setSelected]=useState<number|null>(null);
 const dragIndex=useRef<number|null>(null);
 const [width,height]=bananaBoxFaceSize(shell,face);
 const options:BananaBoxCutOptions={face,diameter,points};
 const warnings=bananaBoxHoleIssues(shell,options);
 const valid=warnings.length===0;
 const scale=Math.min(364/width,175/height);
 const centerX=VIEW_W/2,centerY=VIEW_H/2;
 const toScreen=([x,y]:Point)=>[centerX+x*scale,centerY-y*scale] as const;
 const updateHole=(i:number,axis:0|1,n:number)=>setPoints(old=>old.map((p,j)=>
  j!==i?p:(axis===0?[n,p[1]]:[p[0],n]) as Point));
 const countChange=(n:number)=>{
  if(!Number.isInteger(n)||n<2||n>16)return;
  setPoints(spacedBananaHoles(n,Number.isFinite(spacing)&&spacing>0?spacing:30));
  setSelected(null);
 };
 const spacingChange=(n:number)=>{
  setSpacing(n);
  if(Number.isFinite(n)&&n>0)setPoints(spacedBananaHoles(points.length,n));
 };
 const pointerPoint=(e:PointerEvent<SVGSVGElement>):Point=>{
  const r=e.currentTarget.getBoundingClientRect();
  const x=(e.clientX-r.left)/r.width*VIEW_W,y=(e.clientY-r.top)/r.height*VIEW_H;
  return [round((x-centerX)/scale),round((centerY-y)/scale)];
 };
 const numeric=(label:string,n:number,cb:(v:number)=>void,min:number,max:number)=>
  <label>{label}<input type="number" aria-label={label} min={min} max={max} step="0.1"
   value={Number.isFinite(n)?n:""} onChange={e=>cb(e.target.value.trim()?Number(e.target.value):NaN)}/></label>;
 return <div className="ad5x-banana-tool">
  <div className="ad5x-simple-heading"><h4>Add banana-plug holes to this {targetName}</h4>
   <p>Cut the holes directly into your existing {targetName}. No separate plate is created.</p></div>
  <label className="ad5x-banana-face">Where should the holes go?
   <select aria-label="Banana hole location" value={face} onChange={e=>setFace(e.target.value as BananaBoxFace)}>
    {FACES.map(([value,label])=><option key={value} value={value}>{targetName==="model"?({front:"Front",back:"Back",left:"Left",right:"Right",floor:"Bottom"} as const)[value]:label}</option>)}
   </select>
  </label>
  <p className="ad5x-banana-help">Selected {face==="floor"?"floor":"wall"}: {round(width)} × {round(height)} mm. Hole coordinates are relative to the centre of that surface.</p>
  <div className="ad5x-banana-primary">
   <label>Number of banana plugs
    <select aria-label="Number of banana plugs" value={points.length} onChange={e=>countChange(Number(e.target.value))}>
     {Array.from({length:15},(_,i)=>i+2).map(n=><option key={n} value={n}>{n}</option>)}
    </select>
   </label>
   {numeric("Plug spacing (centre to centre, mm)",spacing,spacingChange,1,220)}
  </div>
  <div className="ad5x-banana-preset">
   <label>Banana plug size / type
    <select aria-label="Banana plug size / type" value={presetId}
     onChange={e=>changePreset(e.target.value as BananaPlugPresetId)}>
     {BANANA_PLUG_PRESETS.map(choice=><option key={choice.id} value={choice.id}>
      {choice.label}
     </option>)}
    </select>
   </label>
   {requiresMeasuredDiameter?
    <label>Custom hole diameter (mm)
     <input type="number" min="1" max="35" step="0.1"
      aria-label="Custom banana hole diameter (mm)" placeholder="Measure your plug"
      value={Number.isFinite(customDiameter)?customDiameter:""}
      onChange={e=>changeCustomDiameter(e.target.value.trim()?Number(e.target.value):NaN)}/>
    </label>:
    <div className="ad5x-banana-preset-size" role="status">
     <strong>Hole Ø {preset.holeDiameterMm} mm</strong>
     <small>{preset.measuredPart==="metal contact"?"Nominal metal pin size":"Manufacturer part-body dimension"}</small>
    </div>}
  </div>
  <p className="ad5x-banana-help" role="note">{preset.note}
   {preset.sourceName!=="User-entered"&&<> Source: {preset.sourceName}.</>}
   {" "}Need a different fit? Choose Custom measured diameter.</p>
  <div className="ad5x-banana-preview">
   <div className="ad5x-banana-preview-head"><strong>Position the holes on the {targetName}</strong>
    <span>Drag a numbered hole, or edit its coordinates.</span></div>
   <svg aria-label="Banana holes on selected box surface" role="img"
    viewBox={"0 0 "+VIEW_W+" "+VIEW_H} preserveAspectRatio="xMidYMid meet"
    onPointerMove={e=>{if(dragIndex.current===null)return;
     const point=pointerPoint(e);setPoints(old=>old.map((p,i)=>i===dragIndex.current?point:p));}}
    onPointerUp={e=>{dragIndex.current=null;
     if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}}
    onPointerCancel={()=>{dragIndex.current=null;}}>
    <rect x="1" y="1" width={VIEW_W-2} height={VIEW_H-2} rx="7" fill="#1b292e" stroke="#718486"/>
    <rect x={centerX-width*scale/2} y={centerY-height*scale/2}
     width={width*scale} height={height*scale} rx="3" fill="#52645a" stroke="#c3decc" strokeWidth="2"/>
    <line x1={centerX} y1="7" x2={centerX} y2={VIEW_H-7} stroke="#dae5df" strokeDasharray="4 5" opacity=".4"/>
    <line x1="7" y1={centerY} x2={VIEW_W-7} y2={centerY} stroke="#dae5df" strokeDasharray="4 5" opacity=".4"/>
    {points.map((point,i)=>{
     if(!point.every(Number.isFinite)||!Number.isFinite(diameter))return null;
     const [sx,sy]=toScreen(point),radius=Math.max(diameter*scale/2,4);
     return <g key={i}>
      <circle cx={sx} cy={sy} r={radius} fill="#e7b16a"
       stroke={selected===i?"white":"#27353b"} strokeWidth="2"/>
      <circle cx={sx} cy={sy} r={Math.max(radius,13)}
       fill="transparent" style={{cursor:"grab",touchAction:"none"}}
       onPointerDown={e=>{e.preventDefault();dragIndex.current=i;setSelected(i);
        e.currentTarget.ownerSVGElement?.setPointerCapture(e.pointerId);}}/>
      <text x={sx} y={sy+4} textAnchor="middle" fontSize="12" fontWeight="bold" fill="#212a2d"
       style={{pointerEvents:"none"}}>{i+1}</text>
     </g>;
    })}
   </svg>
  </div>
  <details className="ad5x-banana-individual" open={positionsOpen}
   onToggle={e=>setPositionsOpen(e.currentTarget.open)}>
   <summary>Adjust individual holes (X/Y)</summary>
   <div className="ad5x-banana-hole-rows">
    {points.map(([x,y],i)=><div key={i} className="ad5x-banana-hole-row">
     <strong>Plug {i+1}</strong>
     <label>{face==="floor"?"X":"Across"} (mm)
      <input aria-label={"Plug "+(i+1)+" X"} type="number" step="0.5"
       value={Number.isFinite(x)?x:""} onFocus={()=>setSelected(i)}
       onChange={e=>updateHole(i,0,e.target.value.trim()?Number(e.target.value):NaN)}/></label>
     <label>{face==="floor"?"Y":"Up/down"} (mm)
      <input aria-label={"Plug "+(i+1)+" Y"} type="number" step="0.5"
       value={Number.isFinite(y)?y:""} onFocus={()=>setSelected(i)}
       onChange={e=>updateHole(i,1,e.target.value.trim()?Number(e.target.value):NaN)}/></label>
    </div>)}
   </div>
  </details>
  {valid?<p className="ad5x-banana-ok" role="status">Enough material around the holes. Ready to cut into your {targetName}.</p>:
   <div className="ad5x-banana-errors" role="alert">
    <strong>Adjust the holes before adding them:</strong>
    {warnings.map((warning,i)=><p key={i}>{warning}</p>)}
   </div>}
  <button type="button" className="design-advanced-apply" disabled={!valid}
   onClick={()=>{if(valid)onCreate(options);}}>Add banana-plug holes to {targetName}</button>
  <p className="ad5x-banana-help">The original {targetName} is preserved in the editable project. The new holes cut its chosen direction; Undo restores the previous shape.</p>
 </div>;
}