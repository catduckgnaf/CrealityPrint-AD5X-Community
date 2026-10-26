import {useEffect,useMemo,useState} from "react";
import {BookOpen,Check,FileDown,Search,X,Move3d} from "lucide-react";
import {useScene} from "../state/store";
import {applyComponentBoxMount} from "../lib/componentBoxMount";
import {applyUserSizedComponentCut,type UserCutShape} from "../lib/userSizedComponentCut";
import type {BananaBoxFace} from "../lib/workshopTools";
import {COMPONENT_LIBRARY_EVENT} from "../lib/workshopRouting";
import {
 COMPONENT_LIBRARY,COMPONENTS,componentById,catalogPlacementId,catalogDxfUrl,catalogThumbnailUrl,componentStatusLabel,
 type ComponentCutout
} from "../lib/componentCatalog";
import "./component-library.css";

/** Read-only physical component records, with explicitly opted-in cutout
 * placement only for evidence-backed supported openings in enabled packs.
 * No cutter automatically modifies the selected enclosure.
 */
function measurementSummary(cut:ComponentCutout|null):string{
 if(!cut)return "Measurements needed — panel opening unknown";
 return cut.shape==="rectangle"
  ?`${cut.width_mm} × ${cut.height_mm} mm rectangular opening (nominal)`
  :`D profile Ø${cut.dxf_uses_nominal_diameter_mm} mm, flat-to-opposite ${cut.dxf_uses_nominal_flat_to_opposite_mm} mm (nominal)`;
}
const catalogueImage=(id:string)=>catalogThumbnailUrl(componentById(id)!);

export function ComponentLibrary(){
 const [open,setOpen]=useState(false);
 const [selectedId,setSelectedId]=useState<string>(COMPONENTS[0]?.id??"");
 const [query,setQuery]=useState("");
 const [mountFace,setMountFace]=useState<BananaBoxFace>("front");
 const [mountX,setMountX]=useState("0");
 const [mountY,setMountY]=useState("0");
 const [mountError,setMountError]=useState("");
 const [userCutShape,setUserCutShape]=useState<UserCutShape>("circle");
 const [userCutWidth,setUserCutWidth]=useState("");
 const [userCutHeight,setUserCutHeight]=useState("");
 const setPlacingConnector=useScene(s=>s.setPlacingConnector);
 useEffect(()=>{
  const openCatalogue=(event:Event)=>{
   const requested=(event as CustomEvent<{id?:string}>).detail?.id;
   if(requested&&componentById(requested))setSelectedId(requested);
   setQuery("");setMountError("");setUserCutWidth("");setUserCutHeight("");setOpen(true);
  };
  window.addEventListener(COMPONENT_LIBRARY_EVENT,openCatalogue);
  return ()=>window.removeEventListener(COMPONENT_LIBRARY_EVENT,openCatalogue);
 },[]);
 useEffect(()=>{
  if(!open)return;
  const key=(event:KeyboardEvent)=>{if(event.key==="Escape"){event.stopPropagation();setOpen(false);}};
  window.addEventListener("keydown",key);
  return ()=>window.removeEventListener("keydown",key);
 },[open]);
 const matched=useMemo(()=>{
  const q=query.trim().toLocaleLowerCase();
  return q?COMPONENTS.filter(item=>[item.name,item.id,item.supplier_sku,item.category,item.supplier]
   .some(value=>value.toLocaleLowerCase().includes(q))):COMPONENTS;
 },[query]);
 if(!open)return null;
 const selected=COMPONENTS.find(c=>c.id===selectedId)||COMPONENTS[0];
 if(!selected)return <div role="dialog" aria-label="AD5X Component library"><p>No enabled component records.</p><button onClick={()=>setOpen(false)}>Close</button></div>;
 const placingId=selected?catalogPlacementId(selected.id):null;
 const cut=selected.mounting.cutout;
 const need=selected.measurements_needed;
 const detailDxf=catalogDxfUrl(selected);
 const mountOnSelectedBox=()=>{
  try{
   const state=useScene.getState();
   if(state.selection.length!==1)throw new Error("Select one hollow enclosure group before cutting it.");
   if(!mountX.trim()||!mountY.trim())throw new Error("Enter both offsets in mm.");
   applyComponentBoxMount(state.selection[0],{componentId:selected.id,face:mountFace,
    offsetX:Number(mountX),offsetY:Number(mountY)});
   setMountError("");setOpen(false);
  }catch(error){setMountError(error instanceof Error?error.message:"Unable to cut selected enclosure.");}
 };
 const cutWithUserMeasurements=()=>{
  try{
   const st=useScene.getState();
   if(st.selection.length!==1)throw Error("Select one existing hollow box first.");
   if(!userCutWidth.trim()||(userCutShape==="rectangle"&&!userCutHeight.trim()))
    throw Error("Enter your actual measured dimensions. No suggested or default sizes.");
   applyUserSizedComponentCut(st.selection[0],{componentId:selected.id,face:mountFace,
    offsetX:Number(mountX),offsetY:Number(mountY),shape:userCutShape,
    width:Number(userCutWidth),height:userCutShape==="rectangle"?Number(userCutHeight):undefined});
   setMountError("");setOpen(false);
  }catch(e){setMountError(e instanceof Error?e.message:"Unable to cut this wall.");}
 };
 const place=()=>{
  if(!placingId)return;
  // The existing connector placement ghost, independent movable HOLE group,
  // selection, movement, rotation and undo machinery are reused exactly.
  // The original model is NOT edited before the user groups the cutout.
  setPlacingConnector(placingId);
  setOpen(false);
 };
 return <div className="ad5x-components-shade" onPointerDown={e=>e.stopPropagation()}
   onClick={e=>{if(e.target===e.currentTarget)setOpen(false);}}>
  <section className="ad5x-components-dialog" role="dialog" aria-modal="true"
    aria-label="AD5X Component library">
   <header>
    <BookOpen size={19} aria-hidden="true"/>
    <strong>Component library</strong>
    <span>{COMPONENTS.length} physical panel parts · offline</span>
    <button type="button" aria-label="Close component library" onClick={()=>setOpen(false)}><X size={18}/></button>
   </header>
   <div className="ad5x-components-layout">
    <aside className="ad5x-components-list">
     <label className="ad5x-components-search">
       <Search size={14} aria-hidden="true"/>
       <input aria-label="Find component by SKU or name" value={query}
        placeholder="Search part or SKU…" onChange={e=>setQuery(e.target.value)}/>
     </label>
     <div className="ad5x-components-entries">
       {matched.map(item=><button type="button" key={item.id}
        className={"ad5x-components-entry"+(item.id===selected.id?" selected":"")}
        aria-pressed={item.id===selected.id}
        onClick={()=>{setSelectedId(item.id);setUserCutWidth('');setUserCutHeight('');setMountError('');}}>
        <img src={catalogueImage(item.id)} alt="" draggable={false}/>
        <span className="ad5x-components-entry-text">
         <strong>{item.supplier_sku}</strong>
         <small>{item.name}</small>
         <em>{componentStatusLabel(item)}</em>
        </span>
       </button>)}
       {!matched.length&&<p className="ad5x-components-muted">No matching components.</p>}
     </div>
    </aside>
    <main className="ad5x-components-detail">
     <div className="ad5x-components-product">
      <img src={catalogueImage(selected.id)} alt="" draggable={false}/>
      <div><h2>{selected.name}</h2><div className="ad5x-components-sku">SKU: {selected.supplier_sku}</div>
       <div className="ad5x-components-muted">{selected.supplier} · {selected.mount_style.replace(/_/g," ")}</div>
      </div>
     </div>
     <div className="ad5x-components-fitstatus">
       {placingId?<><Check size={15} aria-hidden="true"/> {selected.status==="fit_tested"?"Physical fit recorded for the documented specimen":"Documented opening · UNTESTED"}</>:
        <>Measurements needed before CAD placement</>}
     </div>
     {placingId&&<p className="ad5x-components-muted" role="note">Click “Place nominal cutout”, then click the build plate. It remains a separate movable, rotatable hole group. Your box will only be cut when you explicitly group the parts.</p>}
     <div className="ad5x-components-block">
       <strong>Panel opening</strong><p>{measurementSummary(cut)}</p>
       {selected.id==="mr-c14-switch"&&<p>Two Ø3.5 mm fixing holes, 50 mm apart, are listed, but their position relative to the rectangular opening is UNKNOWN. The nominal cutter deliberately contains <strong>no screw holes</strong>.</p>}
       {selected.id==="itw-59-111"&&<p>Nominal D-flat faces left; rotate the cutout to suit the real pushbutton. The manufacturer lists a diameter range, not a tested printable clearance.</p>}
       {selected.mounting.physical_fit_tested===false&&<p>No physical fit test has been recorded for this exact part.</p>}
     </div>
     {selected.reference_diagram&&<div className="ad5x-components-block" aria-label="Supplier reference drawing">
      <strong>Exact supplier drawing — reference only</strong>
      <figure className="ad5x-components-reference">
       <img src={"/component-library/"+selected.reference_diagram} alt={selected.supplier_sku+" original supplier front-view dimensions"}/>
       <figcaption>Dimensioned FRONT VIEW from the linked exact-SKU supplier. These outlines are not a verified panel aperture; automatic cutout remains disabled until rear-body fit geometry is established.</figcaption>
      </figure>
     </div>}
     {placingId&&<div className="ad5x-components-block" aria-label="Selected enclosure wall mounting">
      <strong>Cut selected enclosure wall</strong>
      <p>First select an existing hollow enclosure group. This adds only the documented opening to that box, keeps it editable, and does not invent fixing holes. The original movable cutout option stays available below.</p>
      <div className="flex flex-wrap gap-2 items-end">
       <label>Wall
        <select aria-label="Component wall" value={mountFace} onChange={e=>setMountFace(e.target.value as BananaBoxFace)} className="block rounded bg-neutral-800 border border-neutral-500 px-2 py-1">
         <option value="front">Front</option><option value="back">Back</option>
         <option value="left">Left</option><option value="right">Right</option>
         <option value="floor">Floor</option>
        </select>
       </label>
       <label>Horizontal offset (mm)
        <input aria-label="Component offset X" type="number" step="0.1" value={mountX} onChange={e=>setMountX(e.target.value)} className="block w-28 rounded bg-neutral-800 border border-neutral-500 p-1"/>
       </label>
       <label>Vertical offset (mm)
        <input aria-label="Component offset Y" type="number" step="0.1" value={mountY} onChange={e=>setMountY(e.target.value)} className="block w-28 rounded bg-neutral-800 border border-neutral-500 p-1"/>
       </label>
       <button type="button" onClick={mountOnSelectedBox} className="ad5x-components-place">Cut selected enclosure</button>
      </div>
      {mountError&&<p role="alert">{mountError}</p>}
     </div>}
     {selected.attributes&&Object.keys(selected.attributes).length>0&&
      <div className="ad5x-components-block"><strong>Part specifications (not mounting dimensions)</strong>
       <div className="ad5x-components-specs">
        {Object.entries(selected.attributes).map(([key,value])=>
         <span key={key}>{key.replace(/_/g," ")}: <b>{value}</b></span>)}
       </div>
      </div>}
     {selected.notes.length>0&&<div className="ad5x-components-block"><strong>Supplier notes and limitations</strong>
      <ul>{selected.notes.map((entry,i)=><li key={i}>{entry}</li>)}</ul>
     </div>}
     {!placingId&&<div className="ad5x-components-block" aria-label="User-measured draft cutter">
      <strong>Cut using your own dimensions — unverified</strong>
      <p>This is NOT an automatic or manufacturer-verified fit. Enter the opening dimensions measured from your exact part. The cut stays editable in your enclosure. No fixing holes, clearance or fit claim is added.</p>
      <div className="flex flex-wrap gap-2 items-end">
       <label>Shape<select aria-label="User cutout shape" value={userCutShape} onChange={e=>setUserCutShape(e.target.value as UserCutShape)} className="block rounded bg-neutral-800 border border-neutral-500 p-1">
        <option value="circle">Round hole</option><option value="rectangle">Rectangle</option>
       </select></label>
       <label>{userCutShape==="circle"?"Diameter (mm)":"Width (mm)"}
        <input aria-label="User cutout width" type="number" step="0.1" min="1" max="200" placeholder="Your measurement" value={userCutWidth} onChange={e=>setUserCutWidth(e.target.value)} className="block w-28 rounded bg-neutral-800 border border-neutral-500 p-1"/>
       </label>
       {userCutShape==="rectangle"&&<label>Height (mm)
        <input aria-label="User cutout height" type="number" step="0.1" min="1" max="200" placeholder="Your measurement" value={userCutHeight} onChange={e=>setUserCutHeight(e.target.value)} className="block w-28 rounded bg-neutral-800 border border-neutral-500 p-1"/>
       </label>}
       <label>Wall<select aria-label="User cutout wall" value={mountFace} onChange={e=>setMountFace(e.target.value as BananaBoxFace)} className="block rounded bg-neutral-800 border border-neutral-500 p-1">
         <option value="front">Front</option><option value="back">Back</option><option value="left">Left</option><option value="right">Right</option><option value="floor">Floor</option>
       </select></label>
       <label>Horizontal offset (mm)<input aria-label="User cutout offset X" type="number" step="0.1" value={mountX} onChange={e=>setMountX(e.target.value)} className="block w-28 rounded bg-neutral-800 border border-neutral-500 p-1"/></label>
       <label>Vertical offset (mm)<input aria-label="User cutout offset Y" type="number" step="0.1" value={mountY} onChange={e=>setMountY(e.target.value)} className="block w-28 rounded bg-neutral-800 border border-neutral-500 p-1"/></label>
       <button type="button" disabled={!userCutWidth.trim()||(userCutShape==="rectangle"&&!userCutHeight.trim())} onClick={cutWithUserMeasurements} className="ad5x-components-place">Cut using my measurements</button>
      </div>
      {mountError&&<p role="alert">{mountError}</p>}
     </div>}
     {selected.fit_evidence&&<div className="ad5x-components-block"><strong>Recorded fit</strong><p>{selected.fit_evidence.specimen} · {selected.fit_evidence.date} · panel {selected.fit_evidence.panel_thickness_mm} mm</p><p>{selected.fit_evidence.notes}</p></div>}
     {selected.mounting.other_verified_dimensions_mm&&Object.keys(selected.mounting.other_verified_dimensions_mm).length>0&&
       <div className="ad5x-components-block"><strong>Other supplier dimensions (mm)</strong>
        <div className="ad5x-components-specs">
          {Object.entries(selected.mounting.other_verified_dimensions_mm).map(([name,value])=>
           <span key={name}>{name.replace(/_/g," ")}: <b>{value}</b></span>)}
        </div>
       </div>}
     <div className="ad5x-components-block">
       <strong>Measurements still needed</strong>
       <ul>{need.map((entry,i)=><li key={i}>{entry}</li>)}</ul>
     </div>
     {selected.attributes?.electrical_class==="MAINS"&&
       <div className="ad5x-components-safety" role="note">Mains inlet: a printed fit is NOT evidence of electrical safety. Insulation, temperature, flame resistance, earth and cable clearance need separate verification.</div>}
     <div className="ad5x-components-sources">
       {selected.sources.map((s,i)=><a key={i} href={s.url} target="_blank" rel="noopener noreferrer">{s.source_type==="manufacturer"?"Manufacturer specification":"Supplier source"} ↗</a>)}
       {detailDxf&&<a href={detailDxf} download><FileDown size={13}/> Nominal DXF reference</a>}
     </div>
    </main>
   </div>
   <footer>
    <div className="ad5x-components-caveat">Original supplier records and nominal DXFs preserved · v{COMPONENT_LIBRARY.library_version} · no automatic fixing holes</div>
    <button type="button" className="ad5x-components-close" onClick={()=>setOpen(false)}>Close</button>
    <button type="button" className="ad5x-components-place" disabled={!placingId} onClick={place}
     title={placingId?"Place a nominal untested hole as a freely movable group; the box is not cut until you group it":"This product has no verified panel opening"}>
      <Move3d size={15}/>{placingId?(selected.status==="fit_tested"?"Place cutout":"Place nominal cutout"):"Measurements needed"}
    </button>
   </footer>
  </section>
 </div>;
}