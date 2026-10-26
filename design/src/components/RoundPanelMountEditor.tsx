import {useState} from "react";
import type {PanelSizeInfo} from "../lib/workshopTools";
import {bananaBoxFaceSize,type BananaBoxFace} from "../lib/workshopTools";
import {roundConnector,roundMountIssues,type RoundConnectorId,type RoundMountOptions} from "../lib/roundPanelMount";

type Props={shell:PanelSizeInfo;targetName?:"box"|"model";modelId:RoundConnectorId;onCreate:(opts:RoundMountOptions)=>void};
const faceLabels:[BananaBoxFace,string][]=[
 ["front","Front wall"],["back","Back wall"],["left","Left wall"],
 ["right","Right wall"],["floor","Inside floor"]
];
const numeric=(n:number)=>Number.isFinite(n)?n:"";

/** Native Design tab: exact product-specific round panel mount, no separate part. */
export function RoundPanelMountEditor({shell,modelId,onCreate,targetName="box"}:Props){
 const model=roundConnector(modelId);
 const [face,setFace]=useState<BananaBoxFace>(modelId==="xt60-panel-03"?"floor":"front");
 const [offsetX,setOffsetX]=useState(0),[offsetY,setOffsetY]=useState(0);
 const [radialClearance,setRadialClearance]=useState(0.2);
 const opts:RoundMountOptions={id:modelId,face,offsetX,offsetY,radialClearance};
 const problems=roundMountIssues(shell,opts);
 const valid=problems.length===0;
 const [w,h]=bananaBoxFaceSize(shell,face);
 const scale=Math.min(365/w,161/h);
 const size=model.cutoutDiameter+2*radialClearance;
 const field=(label:string,value:number,set:(n:number)=>void,min:number,max:number,step="0.5")=>
  <label>{label}<input type="number" aria-label={label}
    min={min} max={max} step={step} value={numeric(value)}
    onChange={e=>set(e.target.value.trim()?Number(e.target.value):NaN)}/></label>;
 return <div className="ad5x-round-connector">
  <div className="ad5x-simple-heading">
   <h4>{model.label}</h4>
   <p>Add this connector's mounting cutout straight into the existing {targetName}. No new part.</p>
  </div>
  <p className="ad5x-banana-ok"><strong>Specified panel cutout: Ø{model.cutoutDiameter} mm</strong> — {model.description}</p>
  <label className="ad5x-db9-side">Place on
   <select aria-label="Circular connector box surface" value={face} onChange={e=>setFace(e.target.value as BananaBoxFace)}>
    {faceLabels.map(([id,label])=><option key={id} value={id}>{targetName==="model"?({front:"Front",back:"Back",left:"Left",right:"Right",floor:"Bottom"} as const)[id]:label}</option>)}
   </select>
  </label>
  <div className="ad5x-db9-position">
   {field("Left / right position (mm)",offsetX,setOffsetX,-200,200)}
   {field(face==="floor"?"Front / back position (mm)":"Up / down position (mm)",offsetY,setOffsetY,-200,200)}
  </div>
  <div className="ad5x-db9-preview">
   <div className="ad5x-db9-preview-header"><strong>Cutout position</strong>
    <span>{w.toFixed(1)} × {h.toFixed(1)} mm surface</span></div>
   <svg role="img" aria-label={model.label+" round cutout preview"} viewBox="0 0 420 220">
    <rect x=".5" y=".5" width="419" height="219" rx="7" fill="#1b292e" stroke="#60797d"/>
    <rect x={210-w*scale/2} y={110-h*scale/2} width={w*scale} height={h*scale}
     fill="#58635b" stroke="#c4dec8" strokeWidth="2"/>
    <line x1="210" y1="8" x2="210" y2="212" stroke="#c0d8ca" strokeDasharray="4 5" opacity=".5"/>
    <line x1="8" y1="110" x2="412" y2="110" stroke="#c0d8ca" strokeDasharray="4 5" opacity=".5"/>
    <circle cx={210+offsetX*scale} cy={110-offsetY*scale}
     r={Number.isFinite(size)&&size>0?size*scale/2:0}
     fill="#253136" stroke={valid?"#e1a34f":"#ff7c75"} strokeWidth="2"/>
   </svg>
  </div>
  <div className="ad5x-db9-options">
   {field("Additional clearance per side (mm)",radialClearance,setRadialClearance,0,1,"0.05")}
  </div>
  <p className="ad5x-banana-help">
   Based on the individual <a href={model.source} target="_blank" rel="noopener noreferrer">Micro Robotics product specification</a>.
   This is not the general contact size or a guaranteed printed fit.
  </p>
  {valid?<p role="status" className="ad5x-banana-ok">There is room for the opening in the chosen surface.</p>:
   <div role="alert" className="ad5x-banana-errors">
    <strong>Adjust before adding:</strong>{problems.map((v,i)=><p key={i}>{v}</p>)}
   </div>}
  <button type="button" disabled={!valid} className="design-advanced-apply"
   onClick={()=>{if(valid)onCreate(opts);}}>
   Add {model.id==="banana-type-b-socket"?"banana socket":"XT60 panel mount"} opening to {targetName}
  </button>
  <p className="ad5x-banana-help">The original {targetName} and its editable project are preserved. Use Undo to revert the cut.</p>
 </div>;
}

