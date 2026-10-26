import {useEffect,useMemo,useState,type FormEvent} from "react";
import {Link2,LockKeyhole,X} from "lucide-react";
import {useScene} from "../state/store";
import {
 addHingedLid,DEFAULT_HINGE_OPTIONS,hingeCandidatePairs,matchingLids,
 type HingeSide,type HingeOptions,
} from "../lib/hingedLid";
import "./hinge-editor.css";

/** A single compact editor; selecting a validated matching lid is mandatory.
 * The user explicitly confirms before either print part is changed.
 */
const fromOptions=(o:HingeOptions)=>({
 span:String(o.span),barrelDiameter:String(o.barrelDiameter),
 pinDiameter:String(o.pinDiameter),boreClearance:String(o.boreClearance),
 knuckleGap:String(o.knuckleGap),offset:String(o.offset),
});
type HingeField=Exclude<keyof HingeOptions,"side">;
const fields:{key:HingeField;label:string}[]=[
 {key:"span",label:"Total hinge length (mm)"},
 {key:"offset",label:"Along-wall offset (mm)"},
 {key:"barrelDiameter",label:"Barrel outside diameter (mm)"},
 {key:"pinDiameter",label:"Measured removable pin diameter (mm)"},
 {key:"boreClearance",label:"Extra bore diameter (mm)"},
 {key:"knuckleGap",label:"Gap between knuckles (mm)"},
];

export function HingeEditor(){
 const [open,setOpen]=useState(false);
 const [sourceId,setSourceId]=useState("");
 const [boxId,setBoxId]=useState("");
 const [lidId,setLidId]=useState("");
 const [side,setSide]=useState<HingeSide>(DEFAULT_HINGE_OPTIONS.side);
 const [values,setValues]=useState(fromOptions(DEFAULT_HINGE_OPTIONS));
 const [error,setError]=useState("");
 const project=useScene(s=>s.project);
 useEffect(()=>{
  const handler=(event:Event)=>{
   const eventRoot=(event as CustomEvent<{rootId?:string}>).detail?.rootId;
   const id=eventRoot||useScene.getState().selection[0]||"";
   const candidates=hingeCandidatePairs(useScene.getState().project,id);
   setSourceId(id);
   setBoxId(candidates.shellIds[0]||"");
   setLidId(candidates.lidIds[0]||"");
   setSide(DEFAULT_HINGE_OPTIONS.side);
   setValues(fromOptions(DEFAULT_HINGE_OPTIONS));
   setError("");setOpen(true);
  };
  window.addEventListener("ad5x-open-hinge",handler);
  return ()=>window.removeEventListener("ad5x-open-hinge",handler);
 },[]);
 useEffect(()=>{
  if(!open)return;
  const escape=(event:KeyboardEvent)=>{
   if(event.key==="Escape"){event.stopPropagation();setOpen(false);}
  };
  window.addEventListener("keydown",escape);
  return ()=>window.removeEventListener("keydown",escape);
 },[open]);
 const pairInfo=useMemo(()=>
  sourceId?hingeCandidatePairs(project,sourceId):{shellIds:[],lidIds:[]},
 [sourceId,project]);
 const availableLids=useMemo(()=>{
  if(!boxId)return [];
  try{return matchingLids(project,boxId);}catch{return [];}
 },[project,boxId]);
 const selectedLid=availableLids.find(l=>l.id===lidId);
 const submit=(e:FormEvent<HTMLFormElement>)=>{
  e.preventDefault();setError("");
  if(!boxId||!selectedLid){setError("Create or select the matching lid first.");return;}
  try{
   const vals=Object.fromEntries(Object.entries(values).map(([k,v])=>{
    if(!v.trim()||!Number.isFinite(Number(v)))throw new Error("Enter a valid "+k+" dimension.");
    return [k,Number(v)];
   })) as Record<HingeField,number>;
   addHingedLid(boxId,selectedLid.id,{...vals,side});
   setOpen(false);
  }catch(e){setError(e instanceof Error?e.message:"The hinge could not be generated.");}
 };
 if(!open)return null;
 const boxIds=pairInfo.shellIds.length?pairInfo.shellIds:[];
 return <div className="ad5x-hinge-shade"
  onPointerDown={e=>e.stopPropagation()}
  onClick={e=>{if(e.target===e.currentTarget)setOpen(false);}}>
  <form className="ad5x-hinge-dialog" role="dialog" aria-modal="true"
    aria-label="Add hinge to box and matching lid" onSubmit={submit}>
   <header>
     <Link2 size={17} aria-hidden="true"/>
     <strong>Box & lid hinge</strong><span>Removable-pin · 3 alternating knuckles</span>
     <button type="button" aria-label="Close hinge editor" onClick={()=>setOpen(false)}><X size={17}/></button>
   </header>
   <main>
    <p className="ad5x-hinge-intro">Create two barrel sections attached to the box wall and a matching centre section attached to its separate lid. A physical pin joins them after printing.</p>
    {boxIds.length===0?
      <p className="ad5x-hinge-warning" role="note">
        No compatible hollow box was found. Select a hollow box or its separate matching lid, then open <strong>Hardware & mounting → Add hinge</strong>.
      </p>:
      <>
        <div className="ad5x-hinge-pair">
         <label>Hollow box
          <select aria-label="Hinge box" value={boxId}
            onChange={e=>{setBoxId(e.target.value);setLidId(matchingLids(project,e.target.value)[0]?.id||"");}}>
           {boxIds.map(id=><option key={id} value={id}>{project.nodes[id]?.label||"Hollow box"}</option>)}
          </select>
         </label>
         <label>Matching lid
          <select aria-label="Hinge matching lid" value={selectedLid?.id||""} disabled={availableLids.length===0}
            onChange={e=>setLidId(e.target.value)}>
           {availableLids.length===0?<option value="">No matching lid</option>:
             availableLids.map(l=><option key={l.id} value={l.id}>
               {l.label} — {l.width.toFixed(1)} × {l.depth.toFixed(1)} mm
             </option>)}
          </select>
         </label>
        </div>
        {!selectedLid&&<p className="ad5x-hinge-warning" role="note">
         No matching lid exists for this box. Use <strong>Organizers, lids & bins → Matching lid</strong> first.
         No geometry will be changed until both parts exist.</p>}
        <label className="ad5x-hinge-wall-label">Hinge wall
         <select aria-label="Hinge wall" value={side} onChange={e=>setSide(e.target.value as HingeSide)}>
          <option value="back">Back wall</option><option value="front">Front wall</option>
          <option value="left">Left wall</option><option value="right">Right wall</option>
         </select>
        </label>
        <div className="ad5x-hinge-knuckles" aria-label="Three hinge sections">
          <span>BOX</span><span>LID</span><span>BOX</span>
        </div>
        <div className="ad5x-hinge-fields">
          {fields.map(f=><label key={f.key}>{f.label}
            <input type="text" inputMode="decimal" aria-label={f.label}
              value={values[f.key]} onChange={e=>setValues(v=>({...v,[f.key]:e.target.value}))}/>
          </label>)}
        </div>
      </>
    }
    <p className="ad5x-hinge-note"><LockKeyhole size={14} aria-hidden="true"/>
      <span><strong>Print orientation preserved:</strong> the lid stays separate and face-down on the build plate. Only the matching hinge pieces are added to each model. Opening/closing is a physical action, not an animated joint.</span>
    </p>
    <p className="ad5x-hinge-note">Dimensions are nominal and <strong>NOT physically fit-tested</strong>. Use a real measured pin and print a small hinge test before a complete enclosure. Horizontal barrel overhangs may need support.</p>
    {error&&<p className="ad5x-hinge-error" role="alert">{error}</p>}
   </main>
   <footer>
    <button type="button" className="ad5x-hinge-cancel" onClick={()=>setOpen(false)}>Cancel</button>
    <button type="submit" className="ad5x-hinge-add" disabled={!boxId||!selectedLid}>
      Add hinge to both parts
    </button>
   </footer>
  </form>
 </div>;
}