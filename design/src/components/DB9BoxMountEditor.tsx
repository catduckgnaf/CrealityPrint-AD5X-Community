import {useState} from "react";
import type {PanelSizeInfo} from "../lib/workshopTools";
import {bananaBoxFaceSize,type BananaBoxFace} from "../lib/workshopTools";
import {
 DB9_PANEL,db9PanelProfile,db9BoxIssues,
 type DB9Gender,type DB9BoxOptions
} from "../lib/db9BoxMount";

type Props={shell:PanelSizeInfo;targetName?:"box"|"model";gender:DB9Gender;onCreate:(opts:DB9BoxOptions)=>void};
const faceOptions:[BananaBoxFace,string][]=[
 ["front","Front wall"],["back","Back wall"],["left","Left wall"],
 ["right","Right wall"],["floor","Inside floor"]
];
const nice=(n:number)=>Number.isFinite(n)?n:"";

/** Front-mounted DE-9 / DB9 panel opening in the existing box, not PCB pin bores. */
export function DB9BoxMountEditor({shell,gender,onCreate,targetName="box"}:Props){
 const [face,setFace]=useState<BananaBoxFace>("front");
 const [offsetX,setOffsetX]=useState(0),[offsetY,setOffsetY]=useState(0);
 const [clearance,setClearance]=useState(0.2);
 const [mountDiameter,setMountDiameter]=useState<number>(DB9_PANEL.nominalMountDiameter);
 const [addMountingHoles,setAddMountingHoles]=useState(true);
 const [flipKey,setFlipKey]=useState(false);
 const o:DB9BoxOptions={gender,face,offsetX,offsetY,clearance,
  mountingDiameter:mountDiameter,addMountingHoles,flipKey};
 const warnings=db9BoxIssues(shell,o);
 const valid=warnings.length===0;
 const [width,height]=bananaBoxFaceSize(shell,face);
 const scale=Math.min(375/width,158/height);
 const px=(x:number)=>210+(x+offsetX)*scale;
 const py=(y:number)=>110-(y+offsetY)*scale;
 const nominal=db9PanelProfile(Math.max(0,Math.min(1,Number.isFinite(clearance)?clearance:0.2)),flipKey);
 const drawPoints=nominal.map(([x,y])=>px(x)+","+py(y)).join(" ");
 const field=(label:string,value:number,set:(n:number)=>void,min:number,max:number,step="0.1")=>
  <label>{label}
   <input type="number" aria-label={label} value={nice(value)} min={min} max={max} step={step}
    onChange={e=>set(e.target.value.trim()?Number(e.target.value):NaN)}/>
  </label>;
 return <div className="ad5x-db9-tool">
  <div className="ad5x-simple-heading">
   <h4>Add DB9 {gender} connector to this {targetName}</h4>
   <p>The opening and screw holes cut into the selected {targetName}. No separate part.</p>
  </div>
  <label className="ad5x-db9-side">Where should the connector go?
   <select aria-label="DB9 box surface" value={face} onChange={e=>setFace(e.target.value as BananaBoxFace)}>
    {faceOptions.map(([value,label])=><option value={value} key={value}>{targetName==="model"?({front:"Front",back:"Back",left:"Left",right:"Right",floor:"Bottom"} as const)[value]:label}</option>)}
   </select>
  </label>
  <p className="ad5x-banana-help">This {face==="floor"?"floor":"wall"} is {width.toFixed(1)} × {height.toFixed(1)} mm.
   The preview uses that exact surface size.</p>
  <div className="ad5x-db9-position">
   {field("Left / right position (mm)",offsetX,setOffsetX,-100,100,"0.5")}
   {field(face==="floor"?"Front / back position (mm)":"Up / down position (mm)",
    offsetY,setOffsetY,-100,100,"0.5")}
  </div>
  <div className="ad5x-db9-preview">
   <div className="ad5x-db9-preview-header">
    <strong>Panel opening preview</strong>
    <span>D-shaped aperture and mounting bores</span>
   </div>
   <svg role="img" aria-label={"DB9 "+gender+" panel cutout in box surface"}
    viewBox="0 0 420 220" preserveAspectRatio="xMidYMid meet">
    <rect x="0.5" y="0.5" width="419" height="219" rx="7" fill="#1b292e" stroke="#60797d"/>
    <rect x={210-width*scale/2} y={110-height*scale/2}
     width={width*scale} height={height*scale} rx="2"
     fill="#58635b" fillOpacity=".85" stroke="#c4dec8" strokeWidth="2"/>
    <line x1="210" y1="8" x2="210" y2="212" stroke="#c0d8ca" strokeDasharray="4 5" opacity=".65"/>
    <line x1="8" y1="110" x2="412" y2="110" stroke="#c0d8ca" strokeDasharray="4 5" opacity=".65"/>
    <polygon points={drawPoints} fill="#29333c" stroke={valid?"#e1a34f":"#ff7c75"} strokeWidth="2"/>
    {addMountingHoles&&[-1,1].map(sign=>
     <circle key={sign} cx={px(sign*DB9_PANEL.pitch/2)} cy={py(0)}
      r={mountDiameter>0?Math.max(mountDiameter*scale/2,2):2}
      fill="#253136" stroke={valid?"#e1a34f":"#ff7c75"} strokeWidth="2"/>)}
   </svg>
  </div>
  <div className="ad5x-db9-options">
   {field("Opening clearance per side (mm)",clearance,setClearance,0,1,"0.05")}
   {field("Screw hole diameter (mm)",mountDiameter,setMountDiameter,2.3,4.5,"0.05")}
  </div>
  <div className="ad5x-db9-checks">
   <label><input type="checkbox" checked={addMountingHoles} onChange={e=>setAddMountingHoles(e.target.checked)}/>
    Include 2 mounting screw holes (25 mm apart)</label>
   <label><input type="checkbox" checked={flipKey} onChange={e=>setFlipKey(e.target.checked)}/>
    Turn D opening 180°</label>
  </div>
  <p className="ad5x-banana-help">Standard shell-size E/DE-9 front-mount panel profile:
   approximately 19.74 × 11.18 mm, 25 mm screw centres and 3.18 mm screw holes.
   Based on Spectrum Control's panel-cutout drawing. Applies to both male and female connector shells,
   not to their different PCB pin layouts. Check your exact connector and screw hardware.</p>
  {warnings.length===0?
   <p role="status" className="ad5x-banana-ok">The connector opening fits this surface with the required edge material.</p>:
   <div className="ad5x-banana-errors" role="alert">
    <strong>Adjust before adding:</strong>
    {warnings.map((w,i)=><p key={i}>{w}</p>)}
   </div>}
  <button type="button" className="design-advanced-apply" disabled={!valid}
   onClick={()=>{if(valid)onCreate(o);}}>Add DB9 {gender} cutout to box</button>
  <p className="ad5x-banana-help">
   Front-mount reference geometry; confirm actual shroud fit, panel-wall thickness and clearance before printing.
   The {targetName} remains editable, and Undo restores the original.
  </p>
 </div>;
}

