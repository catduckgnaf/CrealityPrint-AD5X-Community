import {useEffect,useRef,useState} from "react";
import {Wrench, X} from "lucide-react";
import {useScene} from "../state/store";
import {isGroup} from "../types/scene";
import {
 createShell,repeatShape,mirroredCopy,drillBox,sketchPreset,insertLibrary,
 type RepeatMode,type HoleStyle,type SketchPreset,type LibraryItem,
} from "../lib/advancedModels";
import {useAdvancedView,type PlaneAxis} from "../lib/advancedView";
import {BoxFitTools} from "./BoxFitTools";

type Tool="Shell"|"Box & Fit"|"Pattern"|"Mirror"|"Holes"|"Sketch"|"Section"|"Reference"|"STEP"|"Parts";
const TOOLS:Tool[]=["Shell","Box & Fit","Pattern","Mirror","Holes","Sketch","Section","Reference","STEP","Parts"];

export function AdvancedTools(){
 const [open,setOpen]=useState(false);
 const [tool,setTool]=useState<Tool>("Shell");
 const [boxFitPage,setBoxFitPage]=useState<"Lids"|"Dividers"|"Labels">("Lids");
 const [error,setError]=useState("");
 const [info,setInfo]=useState("");
 const [stepBusy,setStepBusy]=useState(false);
 const [params,setParams]=useState<Record<string,string>>({
  w:"80",d:"55",h:"22",wall:"2",base:"2",count:"4",dx:"25",dy:"25",radius:"40",
  diameter:"4",holeX:"0",holeY:"0",depth:"8",headDiameter:"7",headDepth:"2",
  imageWidth:"120",opacity:"0.5",offset:"12",
 });
 const [repeatMode,setRepeatMode]=useState<RepeatMode>("linear");
 const [holeStyle,setHoleStyle]=useState<HoleStyle>("through");
 const [preset,setPreset]=useState<SketchPreset>("rectangle");
 const [part,setPart]=useState<LibraryItem>("standoff");
 const [mirrorAxis,setMirrorAxis]=useState<0|1>(0);
 const [sectionAxis,setSectionAxis]=useState<PlaneAxis>("z");
 const sectionEnabled=useAdvancedView(s=>s.sectionEnabled);
 const imageUrl=useAdvancedView(s=>s.imageUrl);
 const imageRef=useRef<HTMLInputElement>(null);
 const lastBlob=useRef<string|null>(null);
 const selected=useScene(s=>s.selection);
 const nodes=useScene(s=>s.project.nodes);
 const one=selected.length===1?nodes[selected[0]]:null;
 const canShape=!!one&&!isGroup(one)&&!one.locked&&!one.hidden;
 useEffect(()=>{
  const toggle=()=>{setOpen(o=>!o);setError("");setInfo("");};
  const openBoxFit=(event:Event)=>{
   const page=(event as CustomEvent<{page?:"Lids"|"Dividers"|"Labels"}>).detail?.page;
   if(page!=="Lids"&&page!=="Dividers"&&page!=="Labels")return;
   setBoxFitPage(page);
   setTool("Box & Fit");
   setOpen(true);
   setError("");setInfo("");
  };
  const openHardware=(event:Event)=>{
    const detail=(event as CustomEvent<{
      tool?:"Parts"|"Holes";part?:LibraryItem;holeStyle?:HoleStyle;
    }>).detail;
    if(detail?.tool==="Parts"){
      if(detail.part!=="standoff"&&detail.part!=="mounting-tab")return;
      setTool("Parts");setPart(detail.part);
    }else if(detail?.tool==="Holes"){
      if(detail.holeStyle!=="counterbore")return;
      setTool("Holes");setHoleStyle(detail.holeStyle);
    }else return;
    setOpen(true);setError("");setInfo("");
  };  window.addEventListener("ad5x-toggle-advanced",toggle);
  window.addEventListener("ad5x-open-hardware",openHardware);
  window.addEventListener("ad5x-open-boxfit",openBoxFit);
  return ()=>{
   window.removeEventListener("ad5x-toggle-advanced",toggle);
   window.removeEventListener("ad5x-open-hardware",openHardware);
   window.removeEventListener("ad5x-open-boxfit",openBoxFit);
  };
 },[]);
 useEffect(()=>()=>{if(lastBlob.current)URL.revokeObjectURL(lastBlob.current);},[]);
 const number=(name:string)=>{
  const text=params[name]||"";
  if(!text.trim()||!Number.isFinite(Number(text)))throw new Error("Enter a valid "+name+" value.");
  return Number(text);
 };
 const field=(key:string,label:string)=>
  <label key={key}>{label}<input type="text" inputMode="decimal" value={params[key]||""}
   onChange={e=>setParams(p=>({...p,[key]:e.target.value}))}/></label>;
 const run=(fn:()=>void)=>{
  setError("");setInfo("");
  try{fn();setInfo("Created in Design. Undo remains available.");}
  catch(e){setError(e instanceof Error?e.message:"Operation failed.");}
 };
 const exportStep=async()=>{
  if(stepBusy)return;
  setError("");setInfo("");setStepBusy(true);
  try{
   const project=useScene.getState().project;
   const response=await fetch("http://127.0.0.1:18651/export-step",{
    method:"POST",
    headers:{"Content-Type":"application/json","X-AD5X-Step-Bridge":"1"},
    body:JSON.stringify(project),
   });
   if(!response.ok){
    let detail="STEP export failed (HTTP "+response.status+").";
    try{const result=await response.json() as {error?:string};if(result.error)detail=result.error;}catch{/* non-JSON error */}
    throw new Error(detail);
   }
   const blob=await response.blob();
   if(blob.size<200||!response.headers.get("Content-Type")?.includes("step"))throw new Error("The CAD engine returned an invalid STEP download.");
   const url=URL.createObjectURL(blob);
   const anchor=document.createElement("a");anchor.href=url;
   anchor.download=(project.name.replace(/[^a-zA-Z0-9._-]+/g,"_").slice(0,80)||"AD5X_Design")+".step";
   document.body.appendChild(anchor);anchor.click();anchor.remove();
   window.setTimeout(()=>URL.revokeObjectURL(url),15000);
   setInfo("Real CAD STEP exported and verified by OpenCascade. Open the file in Creality Print Prepare.");
  }catch(e){setError(e instanceof Error?e.message:"STEP export failed. Ensure the local STEP engine is running.");}
  finally{setStepBusy(false);}
 };
 const chosen=()=>{if(!canShape||!one)throw new Error("Select one unlocked shape.");return one.id;};
 const loadReference=async(file:File|undefined)=>{
  if(!file)return;
  if(!/^image\/(png|jpeg|webp)$/.test(file.type)){setError("Use PNG, JPEG or WebP.");return;}
  if(file.size>15*1024*1024){setError("Reference must be under 15 MB.");return;}
  const url=URL.createObjectURL(file);
  const image=new Image();
  image.onload=()=>{
   if(lastBlob.current)URL.revokeObjectURL(lastBlob.current);
   lastBlob.current=url;
   const width=Number(params.imageWidth);
   if(!Number.isFinite(width)||width<=0||width>300){setError("Image width must be 1–300 mm.");URL.revokeObjectURL(url);return;}
   useAdvancedView.getState().setReference(url,width,image.height/image.width,Number(params.opacity));
   setInfo("Reference placed on XY workplane. It is session-only; keep the original image file.");
  };
  image.onerror=()=>{URL.revokeObjectURL(url);setError("Could not decode this image.");};
  image.src=url;
 };
 if(!open)return null;
 return <div className="design-advanced-shade" onClick={e=>{if(e.target===e.currentTarget)setOpen(false);}}>
  <section className="design-advanced-dialog" role="dialog" aria-label="Advanced Design tools" aria-modal="true">
   <header><Wrench size={19}/><strong>Advanced Design tools</strong>
    <span>Experimental · uses existing CAD engine</span>
    <button type="button" aria-label="Close advanced tools" onClick={()=>setOpen(false)}><X size={17}/></button>
   </header>
   <nav className="design-advanced-tabs" aria-label="Modelling tools">
    {TOOLS.map(t=><button key={t} type="button" aria-pressed={t===tool}
      onClick={()=>{setTool(t);setError("");setInfo("");}}>{t}</button>)}
   </nav>
   <div className="design-advanced-content">
    {tool==="Box & Fit"&&<BoxFitTools key={boxFitPage} initialPage={boxFitPage} />}
    {tool==="Shell"&&<>
     <p>Create an open-top hollow container using the existing solid-and-hole Boolean grouping.</p>
     <div className="design-advanced-fields">{field("w","Width (mm)")}{field("d","Length (mm)")}
      {field("h","Height (mm)")}{field("wall","Wall thickness (mm)")}{field("base","Base (mm)")}</div>
     <button className="design-advanced-apply" onClick={()=>run(()=>createShell(number("w"),number("d"),number("h"),number("wall"),number("base")))}>Create hollow box</button>
    </>}
    {tool==="Pattern"&&<>
     <p>Repeat one selected top-level shape. Duplicates remain editable individually. Up to 36 shapes.</p>
     <select value={repeatMode} onChange={e=>setRepeatMode(e.target.value as RepeatMode)}>
      <option value="linear">Linear</option><option value="grid">Rectangular grid</option>
      <option value="circular">Circular</option>
     </select>
     <div className="design-advanced-fields">{field("count","Total quantity")}
      {repeatMode!=="circular"&&<>{field("dx","X step (mm)")}{field("dy","Y step (mm)")}</>}
      {repeatMode==="circular"&&field("radius","Circle radius (mm)")}</div>
     <button className="design-advanced-apply" onClick={()=>run(()=>
      repeatShape(chosen(),repeatMode,number("count"),number("dx"),number("dy"),number("radius"))
     )}>Repeat selection</button>
    </>}
    {tool==="Mirror"&&<>
     <p>Keep the original and create a reflected copy across the machine origin (X=0 or Y=0). A separate Flip tool remains on the toolbar.</p>
     <select value={String(mirrorAxis)} onChange={e=>setMirrorAxis(Number(e.target.value) as 0|1)}>
      <option value="0">Mirror about X = 0</option><option value="1">Mirror about Y = 0</option>
     </select>
     <button className="design-advanced-apply" onClick={()=>run(()=>mirroredCopy(chosen(),mirrorAxis))}>Make mirrored copy</button>
    </>}
    {tool==="Holes"&&<>
     <p>Cut an editable hole in one unrotated box. The original box becomes part of a Boolean group.</p>
     <select value={holeStyle} onChange={e=>setHoleStyle(e.target.value as HoleStyle)}>
      <option value="through">Through hole</option>
      <option value="blind">Blind hole</option>
      <option value="counterbore">Counterbore</option>
     </select>
     <div className="design-advanced-fields">{field("diameter","Bore diameter (mm)")}
      {field("holeX","Offset X from centre")}{field("holeY","Offset Y from centre")}
      {holeStyle==="blind"&&field("depth","Blind depth")}
      {holeStyle==="counterbore"&&<>{field("headDiameter","Head diameter")}{field("headDepth","Head depth")}</>}</div>
     <button className="design-advanced-apply" onClick={()=>run(()=>
      drillBox(chosen(),number("diameter"),number("holeX"),number("holeY"),
       number("depth"),holeStyle,number("headDiameter"),number("headDepth"))
     )}>Cut hole in box</button>
     <p>For a countersunk rim, use the existing Round edges (E) tool in Sink mode. Threaded insert tolerances require a physical test.</p>
    </>}
    {tool==="Sketch"&&<>
     <p>Quick parametric outline presets that extrude into editable sketch shapes, or open the existing custom 2D sketcher.</p>
     <select value={preset} onChange={e=>setPreset(e.target.value as SketchPreset)}>
      <option value="rectangle">Rectangle</option><option value="hexagon">Hexagon</option>
      <option value="l-shape">L bracket outline</option>
     </select>
     <div className="design-advanced-fields">{field("w","Width")}{field("d","Depth")}{field("h","Extrusion height")}</div>
     <button className="design-advanced-apply" onClick={()=>run(()=>sketchPreset(preset,number("w"),number("d"),number("h")))}>Extrude preset</button>
     <button className="design-advanced-secondary" onClick={()=>{setOpen(false);useScene.getState().setSketchMode("extrude");}}>Open custom 2D sketcher</button>
     <p>Exact dimension constraints and face-attached sketches are not yet implemented.</p>
    </>}
    {tool==="Section"&&<>
     <p>Render-only clipping plane: reveal the inside of the model without cutting or changing exported geometry.</p>
     <select value={sectionAxis} onChange={e=>setSectionAxis(e.target.value as PlaneAxis)}>
      <option value="x">Cut on X plane</option><option value="y">Cut on Y plane</option><option value="z">Cut on Z plane</option>
     </select>
     <div className="design-advanced-fields">{field("offset","Plane position (mm)")}</div>
     <button className="design-advanced-apply" onClick={()=>run(()=>{
       useAdvancedView.getState().setSection(true,sectionAxis,number("offset"));
       setInfo("Section view enabled; CAD and STL remain intact.");
     })}>Enable section</button>
     <button className="design-advanced-secondary" disabled={!sectionEnabled}
      onClick={()=>{useAdvancedView.getState().setSection(false,sectionAxis,0);setInfo("Section view disabled.");}}>Clear section</button>
     <p>The cut preview is not capped; it is an inspection view only.</p>
    </>}
    {tool==="Reference"&&<>
     <p>Overlay an image on the XY build plate to trace a part. The width entered below controls its physical scale.</p>
     <div className="design-advanced-fields">{field("imageWidth","Image width (mm)")}
      {field("opacity","Opacity 0–1")}</div>
     <input ref={imageRef} type="file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
      hidden onChange={e=>{void loadReference(e.target.files?.[0]);e.target.value="";}}/>
     <button className="design-advanced-apply" onClick={()=>imageRef.current?.click()}>Choose reference image</button>
     {imageUrl&&<button className="design-advanced-secondary" onClick={()=>{
      useAdvancedView.getState().setReference(null,100,1,0.5);
      setInfo("Reference removed.");}}>Remove image</button>}
     <p>Session-only reference image, not embedded in your saved project. Keep the original file.</p>
    </>}
    {tool==="STEP"&&<>
     <p><strong>Export a real CAD STEP (.step)</strong> for Creality Print / OrcaSlicer. The local OpenCascade engine rebuilds CAD solids from the editable design dimensions and Boolean operations, not from an STL mesh.</p>
     <button className="design-advanced-apply" type="button" disabled={stepBusy} onClick={()=>{void exportStep();}}>{stepBusy?"Building STEP solid...":"Export STEP (CAD solid)"}</button>
     <p>Experimental supported shapes: non-rounded boxes, cylinders, nested Boolean groups, trays, simple enclosures and drill jigs. Unsupported geometry or invalid CAD solids cause a visible export error; nothing is silently omitted.</p>
     <p>Uses the local offline AD5X STEP engine. Editable project JSON stays the master file; this STEP is a CAD handoff for slicing.</p>
     <p>Legacy STEP import route (separate): <code>FreeCAD_STEP_to_STL.FCMacro</code>. This is not used by Export STEP.</p>
    </>}    {tool==="Parts"&&<>
     <p>Reusable parametric starter parts. Adjust the finished shapes with the existing Inspector and Boolean editor.</p>
     <select value={part} onChange={e=>setPart(e.target.value as LibraryItem)}>
      <option value="standoff">Screw standoff</option>
      <option value="mounting-tab">Mounting tab with hole</option>
      <option value="cable-guide">U-channel cable guide</option>
      <option value="tray">Hollow organizer tray</option>
     </select>
     <button className="design-advanced-apply" onClick={()=>run(()=>insertLibrary(part))}>Insert into Design</button>
     <p>These are geometric starting points, not tested snap-fit or fastener specifications.</p>
    </>}
    {error&&<p role="alert" className="design-advanced-error">{error}</p>}
    {info&&<p role="status" className="design-advanced-info">{info}</p>}
   </div>
   <footer>All edits remain local and reversible. Print settings, Z-Mod, Klipper, IFS and Send to Prepare are unchanged.</footer>
  </section>
 </div>;
}
