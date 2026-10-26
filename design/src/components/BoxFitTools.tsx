import {useState} from "react";
import {useScene} from "../state/store";
import {createMatchingLid,addDividers,type LidOptions} from "../lib/boxFitTools";
import {addSnapStyleTabs,lidFitReport,distanceReport,addLabels,type ClipOptions,type LabelOptions} from "../lib/boxFitExtra";

type Page="Lids"|"Dividers"|"Clips"|"Fit"|"Labels";
const pages:Page[]=["Lids","Dividers","Clips","Fit","Labels"];
const base:Record<string,string>={
 clearance:"0.30",thickness:"2.4",lipDepth:"4",lipWall:"1.5",overhang:"0.5",bedGap:"12",
 columns:"3",rows:"2",divider:"1.6",topGap:"2",
 clipWidth:"8",clipHeight:"10",clipThickness:"1.5",clipGap:"0.8",catchDepth:"0.7",
 textSize:"7",textDepth:"0.8",lineSpacing:"2",
};
export function BoxFitTools({initialPage="Lids"}:{initialPage?:Page}={}){
 const [page,setPage]=useState<Page>(initialPage);
 const [values,setValues]=useState<Record<string,string>>(base);
 const [clipCount,setClipCount]=useState<2|4>(2);
 const [labelText,setLabelText]=useState("PARTS");
 const [labelMode,setLabelMode]=useState<"raised"|"recessed">("recessed");
 const [font,setFont]=useState<"sans"|"sans bold"|"serif">("sans bold");
 const [result,setResult]=useState("");
 const [error,setError]=useState("");
 const selection=useScene(s=>s.selection);
 const nodes=useScene(s=>s.project.nodes);
 const one=selection.length===1 ? nodes[selection[0]]:undefined;
 const call=(action:()=>unknown,what:string)=>{
  setError("");setResult("");
  try{
   action();setResult(what+" created in the editable Design project. Save/check before printing.");
  }catch(e){setError(e instanceof Error?e.message:"Could not create feature.");}
 };
 const number=(key:string)=>{
  const raw=values[key]?.trim();
  if(!raw||!Number.isFinite(Number(raw)))throw new Error("Enter a valid "+key+" value.");
  return Number(raw);
 };
 const field=(key:string,label:string)=><label key={key}>{label}
  <input aria-label={label} type="text" inputMode="decimal" value={values[key]??""}
   onChange={e=>setValues(s=>({...s,[key]:e.target.value}))}/>
 </label>;
 const selected=()=>{
  if(!one||one.hidden||one.locked)throw new Error("Select one visible, unlocked box or shell first.");
  return one.id;
 };
 const checkFit=()=>{
  setError("");setResult("");
  if(selection.length!==2){setError("Select both the shell and its matching lid (Shift-click) before checking.");return;}
  const [a,b]=selection;
  try{
   let r;
   try{r=lidFitReport(a,b);}
   catch{r=lidFitReport(b,a);}
   setResult(r.message+(r.warning?" Confirm dimensions before printing.":" Physical fit is not yet guaranteed."));
  }catch{
   try{setResult(distanceReport(selection).message);}
   catch(e){setError(e instanceof Error?e.message:"Clearance check unavailable.");}
  }
 };
 return <div className="design-boxfit">
  <div className="design-boxfit-nav" role="tablist" aria-label="Box and fit tools">
   {pages.map(p=><button key={p} type="button" role="tab" aria-selected={p===page}
    onClick={()=>{setPage(p);setError("");setResult("");}}>{p}</button>)}
  </div>
  {page==="Lids"&&<>
   <p>Select a simple hollow box or a box already fitted with dividers/tabs. Generates a separate, print-oriented lid alongside it.</p>
   <div className="design-advanced-fields">
    {field("clearance","Clearance per side (mm)")}
    {field("thickness","Lid thickness (mm)")}
    {field("lipDepth","Lip insertion depth (mm)")}
    {field("lipWall","Lip wall thickness (mm)")}
    {field("overhang","Lid overhang (mm)")}
    {field("bedGap","Gap beside box (mm)")}
   </div>
   <button className="design-advanced-apply" type="button" onClick={()=>call(()=>{
    const o:LidOptions={clearance:number("clearance"),thickness:number("thickness"),lipDepth:number("lipDepth"),
     lipWall:number("lipWall"),overhang:number("overhang"),bedGap:number("bedGap")};
    createMatchingLid(selected(),o);
   },"Matching lid")}>Create matching lid</button>
   <p>Clearance is a design allowance, not a calibrated printer tolerance. The lid prints outside face down, insertion lip up.</p>
  </>}
  {page==="Dividers"&&<>
   <p>Add connected interior walls to a hollow shell. Select the hollow box (not the lid), then choose compartments along X and Y.</p>
   <div className="design-advanced-fields">
    {field("columns","Compartments across X (1–8)")}
    {field("rows","Compartments across Y (1–8)")}
    {field("divider","Divider wall thickness (mm)")}
    {field("topGap","Gap below box rim (mm)")}
   </div>
   <button className="design-advanced-apply" onClick={()=>call(()=>addDividers(
    selected(),number("columns"),number("rows"),number("divider"),number("topGap")),"Compartment walls")}>
    Add dividers</button>
   <p>Existing cavity stays intact. Walls intersect the original floor and side walls to form a joined part.</p>
  </>}
  {page==="Clips"&&<>
   <p>Add cantilever-style retention tab prototypes to two sides of a hollow shell. Their fit and durability are experimental.</p>
   <select value={clipCount} onChange={e=>setClipCount(Number(e.target.value) as 2|4)}>
    <option value={2}>2 opposing tabs</option><option value={4}>4 opposing tabs</option>
   </select>
   <div className="design-advanced-fields">
    {field("clipWidth","Tab width (mm)")}
    {field("clipHeight","Beam height (mm)")}
    {field("clipThickness","Beam thickness (mm)")}
    {field("clipGap","Wall clearance (mm)")}
    {field("catchDepth","Retention catch projection (mm)")}
   </div>
   <button className="design-advanced-apply" onClick={()=>call(()=>{
    const options:ClipOptions={count:clipCount,tabWidth:number("clipWidth"),beamHeight:number("clipHeight"),
     thickness:number("clipThickness"),gap:number("clipGap"),catchDepth:number("catchDepth")};
    addSnapStyleTabs(selected(),options);
   },"Experimental clip tabs")}>Add clip prototypes</button>
   <p>Not a validated snap-fit pairing. Preview and print a small sample before trusting a real enclosure.</p>
  </>}
  {page==="Fit"&&<>
   <p>Select a shell and generated lid together, then inspect their designed lip-to-opening clearance. Other selections get a basic bounding-box distance report.</p>
   <button type="button" className="design-advanced-apply" onClick={checkFit}>Check selected two parts</button>
   <p>Adjust the lid clearance under Lids and regenerate if needed. This tool does not change slicer or filament settings.</p>
  </>}
  {page==="Labels"&&<>
   <p>Raised or engraved text on a solid box top, a hollow box outside front wall, or a matching lid underside. Existing hollow shells stay intact.</p>
   <label className="design-boxfit-text">Text (up to 6 lines)
    <textarea value={labelText} rows={3} maxLength={200} onChange={e=>setLabelText(e.target.value)}/>
   </label>
   <select aria-label="Text mode" value={labelMode} onChange={e=>setLabelMode(e.target.value as "raised"|"recessed")}>
    <option value="raised">Raised</option><option value="recessed">Recessed</option>
   </select>
   <select aria-label="Font" value={font} onChange={e=>setFont(e.target.value as "sans"|"sans bold"|"serif")}>
    <option value="sans bold">Sans bold</option><option value="sans">Sans</option><option value="serif">Serif</option>
   </select>
   <div className="design-advanced-fields">
    {field("textSize","Letter height (mm)")}
    {field("textDepth","Raised / engraved depth (mm)")}
    {field("lineSpacing","Extra line spacing (mm)")}
   </div>
   <button className="design-advanced-apply" onClick={()=>call(()=>{
    const options:LabelOptions={text:labelText,size:number("textSize"),depth:number("textDepth"),
     spacing:number("lineSpacing"),mode:labelMode,font};
    addLabels(selected(),options);
   },"Labels")}>Add labels to selected part</button>
   <p>The text remains editable as individual group children. Existing print dimensions and extrusion settings remain unchanged.</p>
  </>}
  {error&&<p className="design-advanced-error" role="alert">{error}</p>}
  {result&&<p className="design-advanced-info" role="status">{result}</p>}
 </div>;
}
