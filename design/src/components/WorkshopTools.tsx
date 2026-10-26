import {useEffect,useState} from "react";
import {X,Wrench} from "lucide-react";
import {BananaPlugEditor} from "./BananaPlugEditor";
import type {BananaPlugPresetId} from "../lib/bananaPlugPresets";
import {DB9BoxMountEditor} from "./DB9BoxMountEditor";
import {RoundPanelMountEditor} from "./RoundPanelMountEditor";
import {applyRoundPanelMount,type RoundConnectorId} from "../lib/roundPanelMount";
import {applyDB9BoxMount} from "../lib/db9BoxMount";
import {useScene} from "../state/store";
import {isGroup} from "../types/scene";
import {createShell} from "../lib/advancedModels";
import {createOrganizerInserts,type OrganizerOptions} from "../lib/organizerInserts";

import {compartmentAt,addShellFeature,enclosurePosts,cableOpening,createDrillJig,
 applyDrillExisting,applyDrillExistingPositions,parseJigHolePositions,createElectronicsJig,applyBananaBoxHoles,type DrillGrid,type CableSide} from "../lib/workshopTools";
import {dividerDistanceInfo,constrainDividerPosition} from "../lib/dividerInteraction";
import {resolveWorkshopShell} from "../lib/workshopSelection";
import {WORKSHOP_EVENT,WORKSHOP_SECTIONS,WORKSHOP_JOBS,isWorkshopSection,isWorkshopJigKind,isWorkshopConnectorType,type WorkshopOpenDetail,type WorkshopSection,type WorkshopJigKind,type WorkshopConnectorType} from "../lib/workshopRouting";
import {modelPanelTarget,applyModelPanelCut,editableModelRoot,applyModelDrill,modelDrillGrid,applyModelCableOpening,applyModelMountingPosts} from "../lib/modelPanelTools";
import {sceneApi} from "../lib/sceneApi";
import {workshopRegistry,workshopJobEnabled} from "../extensions/workshopCatalog";
type Tab=WorkshopSection;
const startValues={
 trayX:"0",trayY:"0",clearance:"20",
 trayW:"80",trayD:"60",trayH:"22",trayWall:"2",trayFloor:"2",
 postDiameter:"8",bore:"3.2",postHeight:"10",
 cableWidth:"12",cableHeight:"6",cableOffset:"0",cableBottom:"4",
 jigW:"100",jigD:"70",jigH:"8",jigHole:"4",jigCols:"3",jigRows:"2",
 jigPitchX:"30",jigPitchY:"25",jigOffsetX:"0",jigOffsetY:"0",jigPositions:"-20,-10; 20,-10; 0,15",
 pcbWidth:"60",pcbDepth:"40",pcbGap:"0.4",pcbBase:"5",
 pcbRailWidth:"4",pcbRailHeight:"3",pcbStopWidth:"4",pcbStopHeight:"5",pcbMargin:"5",pcbHoleDiameter:"3",pcbHolePositions:"",pogoPositions:"-18,0; -6,0; 6,0; 18,0",connectorPositions:"-20,0; 20,0",
 combCount:"6",combPitch:"6",combSlot:"2",combSlotDepth:"6",combDepth:"40",
 combBase:"5",combRidgeW:"6",combRidgeH:"10",combMargin:"8",
 cradleWidth:"12",cradleDepth:"22",cradleGap:"0.4",cradleBase:"5",
 cradleRailW:"4",cradleRailH:"7",cradleStopW:"4",cradleStopH:"6",cradleMargin:"6", clampWidth:"100",clampDepth:"50",clampMin:"12",clampMax:"72",clampStep:"10",clampPeg:"5",clampClearance:"0.3",
 gridCols:"2",gridRows:"2",binGap:"0.35",binWall:"1.6",binFloor:"1.6",binTopGap:"1",binBedGap:"6",
 binCol:"1",binRow:"1",binSpanCols:"2",binSpanRows:"1",
};
export function WorkshopTools(){
 const [open,setOpen]=useState(false);
 const [tab,setTab]=useState<Tab>("Tray");
 const [values,setValues]=useState(startValues);
 const [side,setSide]=useState<CableSide>("front");
 const [fence,setFence]=useState(true);
 const [enclosureTask,setEnclosureTask]=useState<"posts"|"opening"|"lid">("posts");
 const [postBoreExpanded,setPostBoreExpanded]=useState(false);
 const [hardwareIntent,setHardwareIntent]=useState<"heat-insert"|"screws"|null>(null);
 const [pcbMounting,setPcbMounting]=useState(false);
 const [connectorMeasured,setConnectorMeasured]=useState(false);
 const [pogoMeasured,setPogoMeasured]=useState(false);
 const [jigKind,setJigKind]=useState<WorkshopJigKind>("drill");
 const [connectorChooser,setConnectorChooser]=useState(false);
 const [bananaPresetId,setBananaPresetId]=useState<BananaPlugPresetId>("standard4-contact");
 const [connectorType,setConnectorType]=useState<WorkshopConnectorType>("banana");
 const [organizerMode,setOrganizerMode]=useState<"full"|"span"|"mixed">("full");
 const [feedback,setFeedback]=useState("");
 const [error,setError]=useState("");
 const selection=useScene(s=>s.selection);
 const project=useScene(s=>s.project);
 useEffect(()=>{
  const show=(event:Event)=>{
   const detail=(event as CustomEvent<WorkshopOpenDetail>).detail;
   // A right-click size opens the same existing Workshop editor, preset
   // already selected. A plain Workshop shortcut retains its original route.
   setConnectorChooser(detail?.connectorChooser===true);
   if(detail?.connectorChooser){
    const requested=detail.connectorType;
    if(isWorkshopConnectorType(requested))
     setConnectorType(requested as typeof connectorType);
    else setConnectorType("banana");
    setJigKind("banana");
    const preset=detail.bananaPreset;
    if(["mini2-contact","mini3-contact","standard4-contact","custom"].includes(preset??""))
     setBananaPresetId(preset as BananaPlugPresetId);
   }
   const intent=detail?.hardwareIntent;
   setHardwareIntent(intent==="heat-insert"||intent==="screws"?intent:null);
   const next=detail?.tab;
   if(isWorkshopSection(next))setTab(next);
   if(next==="Enclosure"&&detail?.enclosureTask==="posts"){
     setEnclosureTask("posts");
     setPostBoreExpanded(intent==="heat-insert");
   }
   const kind=detail?.jigKind;
   if(next==="Jigs"&&isWorkshopJigKind(kind)&&workshopJobEnabled(kind))
    setJigKind(kind as typeof jigKind);
   setError("");setFeedback("");setOpen(true);
  };
  window.addEventListener(WORKSHOP_EVENT,show);
  return ()=>window.removeEventListener(WORKSHOP_EVENT,show);
 },[]);
 if(!open)return null;
 const one=selection.length===1?project.nodes[selection[0]]:null;
 const selectedId=one?.id??null;
 const shellId=resolveWorkshopShell(project,selectedId);
 const number=(key:keyof typeof startValues)=>{
  const raw=values[key].trim();
  if(!raw||!Number.isFinite(Number(raw)))throw new Error("Enter a valid "+key+".");
  return Number(raw);
 };
 const shell=():string=>{
  if(!shellId)throw new Error("Select a hollow box or any part inside it first.");
  return shellId;
 };
 const chosenModel=():string=>editableModelRoot(project,selection);
 const isPlainBox=(id:string)=>{
  const n=project.nodes[id];
  return !!n&&!isGroup(n)&&n.kind==="box"&&n.role==="solid"&&
   (!n.params.radius||Number(n.params.radius)===0)&&
   n.rotation.every(v=>Math.abs(v)<1e-6)&&
   n.scale.every(v=>Math.abs(v-1)<1e-6)&&
   project.rootOrder.includes(id);
 };
 const modelBounds=(id:string)=>{
  const bounds=sceneApi.getNodeBounds(id);
  if(!bounds)throw new Error("Select this model in the viewport before adding a feature.");
  return bounds;
 };
 const drillGridOnSelection=()=>{
  const id=chosenModel();
  const dia=number("jigHole"),cols=number("jigCols"),rows=number("jigRows"),
   pitchX=number("jigPitchX"),pitchY=number("jigPitchY"),
   offsetX=number("jigOffsetX"),offsetY=number("jigOffsetY");
  if(isPlainBox(id))applyDrillExisting(id,dia,cols,rows,pitchX,pitchY,offsetX,offsetY);
  else applyModelDrill(id,modelBounds(id),dia,
   modelDrillGrid(dia,cols,rows,pitchX,pitchY,offsetX,offsetY));
 };
 const drillExactOnSelection=()=>{
  const id=chosenModel(),dia=number("jigHole"),points=parseJigHolePositions(values.jigPositions);
  if(isPlainBox(id))applyDrillExistingPositions(id,dia,points);
  else applyModelDrill(id,modelBounds(id),dia,points);
 };
 const perform=(fn:()=>void,success:string,closeAfterSuccess=false)=>{
  setError("");setFeedback("");
  try{
    fn();
    if(closeAfterSuccess){
      // Only close AFTER a confirmed successful model mutation. Validation
      // failures remain visible and editable in the same dialog.
      setOpen(false);
    }else{
      setFeedback(success+" - changes added to this project. Use File > Save project as JSON to keep an editable copy; Undo is available.");
    }
  }catch(e){
    setError(e instanceof Error?e.message:"Could not complete this operation.");
  }
 };
 const field=(key:keyof typeof startValues,label:string)=>
  <label key={key}>{label}
   <input type="text" inputMode="decimal" aria-label={label} value={values[key]}
    onChange={e=>{setValues(old=>({...old,[key]:e.target.value}));setError("");setFeedback("");}}/>
  </label>;
 const pickX=Number(values.trayX),pickY=Number(values.trayY);
 let measured:"" | string="";
 if(tab==="Tray"&&shellId&&Number.isFinite(pickX)&&Number.isFinite(pickY)){
  try{
   const m=compartmentAt(project,shellId,[pickX,pickY]);
   measured="Compartment: "+m.width.toFixed(1)+" × "+m.depth.toFixed(1)+
     " mm · X "+m.xMin.toFixed(1)+" to "+m.xMax.toFixed(1)+
     " · Y "+m.yMin.toFixed(1)+" to "+m.yMax.toFixed(1);
  }catch{measured="Enter a point inside an open compartment to read its dimensions.";}
 }
 const distance=selectedId?dividerDistanceInfo(project,selectedId):null;
 const placement=(axis:"x"|"y")=>{
  try{
   const id=shell();
   setOpen(false);
   window.dispatchEvent(new CustomEvent("ad5x-manual-divider",{detail:{rootId:id,axis,partial:true}}));
  }catch(e){setError(e instanceof Error?e.message:"Select a hollow tray.");}
 };
 const organizerOptions=():OrganizerOptions=>({
  cols:number("gridCols"),rows:number("gridRows"),gap:number("binGap"),wall:number("binWall"),
  floor:number("binFloor"),topGap:number("binTopGap"),bedGap:number("binBedGap"),
  mode:organizerMode,col:number("binCol"),row:number("binRow"),
  spanCols:number("binSpanCols"),spanRows:number("binSpanRows"),
 }); const createJig=()=>{
  const opts:DrillGrid={width:number("jigW"),depth:number("jigD"),height:number("jigH"),
   diameter:number("jigHole"),columns:number("jigCols"),rows:number("jigRows"),
   pitchX:number("jigPitchX"),pitchY:number("jigPitchY"),fence,
   offsetX:number("jigOffsetX"),offsetY:number("jigOffsetY")};
  createDrillJig(opts);
 };
 const createElectronics=()=>{
  // Existing store/history/selection action stays here; the trusted local
  // plugin only builds editable parts using the exact established generators.
  const result=workshopRegistry.build(jigKind,{
   number:key=>number(key as keyof typeof startValues),values,
   pcbMounting,connectorMeasured,pogoMeasured
  });
  createElectronicsJig(result.label,result.parts);
 };
 return <div className="design-advanced-shade" onClick={e=>{if(e.target===e.currentTarget)setOpen(false);}}>
  <section className="design-advanced-dialog ad5x-workshop-simple" role="dialog" aria-modal="true" aria-label="Workshop tools">
   <header><Wrench size={19}/><strong>Workshop — make a part</strong>
    <span>Native Design · all geometry stays editable</span>
    <button type="button" aria-label="Close workshop tools" onClick={()=>setOpen(false)}><X size={17}/></button>
   </header>
   <nav className="design-advanced-tabs" aria-label="Workshop sections">
    {WORKSHOP_SECTIONS.map(({id:t,label})=><button key={t} type="button"
      aria-pressed={tab===t} onClick={()=>{setTab(t);setConnectorChooser(false);setError("");setFeedback("");}}>{label}</button>)}
   </nav>
   <div className="design-advanced-content">
    {tab==="Tray"&&<>
     <div className="ad5x-simple-heading"><h3>Create a hollow tray</h3>
      <p>Start with the outside size. You can add internal dividers afterward.</p></div>
     <div className="design-advanced-fields">
      {field("trayW","Width")}{field("trayD","Length")}{field("trayH","Height")}
     </div>
     <button type="button" className="design-advanced-apply" onClick={()=>perform(()=>
      createShell(number("trayW"),number("trayD"),number("trayH"),
       number("trayWall"),number("trayFloor")),"Hollow tray created")}>Create hollow tray</button>
     <details className="ad5x-simple-extra"><summary>More options — wall, floor & dividers</summary>
      <div className="ad5x-simple-extra-body">
       <div className="design-advanced-fields">
        {field("trayWall","Wall thickness")}{field("trayFloor","Floor thickness")}
       </div>
       <h4>Place partial dividers</h4>
       <p>Select a hollow tray, then click inside it to place a short divider.</p>
       <button type="button" className="design-advanced-secondary" onClick={()=>placement("x")}>Click to place partial lengthwise divider</button>
       <button type="button" className="design-advanced-secondary" onClick={()=>placement("y")}>Click to place partial widthwise divider</button>
       <div className="design-advanced-fields">
        {field("trayX","Measure at X")}{field("trayY","Measure at Y")}
       </div>
       {measured&&<p role="status" className="design-advanced-info">{measured}</p>}
       {distance&&<div className="design-advanced-fields">
        {field("clearance",distance.axis==="x"?"Left inside gap":"Front inside gap")}
        <button type="button" className="design-advanced-secondary" onClick={()=>perform(()=>{
         const target=number("clearance"),info=dividerDistanceInfo(useScene.getState().project,selectedId!);
         if(!info)throw new Error("Select a full-length divider inside Edit / move dividers.");
         if(target<2||target>info.cavityMax-info.cavityMin-info.width-2)throw new Error("That compartment width would cross a wall.");
         const n=useScene.getState().project.nodes[selectedId!];
         const value=info.cavityMin+target+info.width/2;
         const wanted=[...n.position] as [number,number,number];wanted[info.axis==="x"?0:1]=value;
         const safe=constrainDividerPosition(useScene.getState().project,selectedId!,wanted);
         if(!safe)throw new Error("This divider is not editable.");
         useScene.setState(st=>({project:{...st.project,nodes:{...st.project.nodes,[selectedId!]:{...n,position:safe}}}}));
        },"Divider moved precisely")}>Set inside clearance</button>
       </div>}
       <p>Full-length dividers remain available under Group → Add.</p>
      </div>
     </details>
    </>}
    {tab==="Enclosure"&&<>
     <div className="ad5x-simple-heading"><h3>What would you like to add?</h3>
      <p>Select a hollow box in your design before adding features.</p></div>
     <div className="ad5x-simple-tool-grid" role="group" aria-label="Box feature">
      {([["posts","Mounting posts","Four corner posts"],["opening","Cable opening","Hole in a wall"],["lid","Matching lid","Use existing lid tool"]] as const).map(([value,title,description])=>
       <button key={value} type="button" aria-pressed={enclosureTask===value}
        onClick={()=>{setEnclosureTask(value);setError("");setFeedback("");}}>
        <strong>{title}</strong><small>{description}</small>
       </button>)}
     </div>
     {enclosureTask==="posts"?<>
      {hardwareIntent==="heat-insert"&&<p role="note">Heat-set inserts use a measured pilot bore in each post. Enter the insert manufacturer's recommended bore diameter below; the default is not a verified fit.</p>}
      <div className="design-advanced-fields">
       {field("postDiameter","Post diameter")}{field("postHeight","Post height")}
      </div>
      <button type="button" className="design-advanced-apply" onClick={()=>perform(()=>{
       const target=modelPanelTarget(project,selection);
       if(target.shell)addShellFeature(target.id,p=>enclosurePosts(p,target.id,
        number("postDiameter"),number("bore"),number("postHeight")),"Enclosure features");
       else applyModelMountingPosts(target.id,target.bounds!,number("postDiameter"),number("bore"),number("postHeight"));
      },"Four mounting posts added")}>Add four mounting posts</button>
      <details className="ad5x-simple-extra" open={postBoreExpanded} onToggle={e=>setPostBoreExpanded(e.currentTarget.open)}><summary>Advanced — pilot bore diameter</summary>
       <div className="ad5x-simple-extra-body">
        <div className="design-advanced-fields">{field("bore","Pilot bore diameter")}</div>
        <p>Screw and insert fit are nominal, not yet print-tested.</p>
       </div>
      </details>
     </>:enclosureTask==="opening"?<>
      <label>Choose a wall
       <select aria-label="Opening wall" value={side} onChange={e=>{setSide(e.target.value as CableSide);setError("");}}>
        <option value="front">Front</option><option value="back">Back</option>
        <option value="left">Left</option><option value="right">Right</option>
       </select>
      </label>
      <div className="design-advanced-fields">
       {field("cableWidth","Opening width")}{field("cableHeight","Opening height")}
      </div>
      <button type="button" className="design-advanced-apply" onClick={()=>perform(()=>{
       const target=modelPanelTarget(project,selection);
       if(target.shell)addShellFeature(target.id,p=>cableOpening(p,target.id,side,
        number("cableWidth"),number("cableHeight"),number("cableOffset"),number("cableBottom")),"Enclosure features");
       else applyModelCableOpening(target.id,target.bounds!,side,number("cableWidth"),number("cableHeight"),number("cableOffset"),number("cableBottom"));
      },"Wall opening added")}>Cut cable opening</button>
      <details className="ad5x-simple-extra"><summary>Advanced — precise opening position</summary>
       <div className="ad5x-simple-extra-body">
        <div className="design-advanced-fields">
         {field("cableOffset","Sideways offset")}{field("cableBottom","Height above floor")}
        </div>
       </div>
      </details>
     </>:<>
      <p>Use the existing matching-lid controls.</p>
      <button type="button" className="design-advanced-apply" onClick={()=>{
       setOpen(false);window.dispatchEvent(new CustomEvent("ad5x-open-boxfit",{detail:{page:"Lids"}}));
      }}>Open existing matching lid tools</button>
     </>}
    </>}
    {tab==="Organizer"&&<>
     <div className="ad5x-simple-heading"><h3>Make removable organizer bins</h3>
      <p>Select the model you want to modify. Bin sizes follow its inside dimensions.</p></div>
     <div className="design-advanced-fields">
      {field("gridCols","Grid columns")}{field("gridRows","Grid rows")}
     </div>
     <label>Bin layout
      <select aria-label="Bin layout" value={organizerMode} onChange={e=>{
       setOrganizerMode(e.target.value as "full"|"span"|"mixed");setError("");setFeedback("");
      }}>
       <option value="full">One removable bin in every cell</option>
       <option value="span">One larger bin spanning chosen cells</option>
       <option value="mixed">One spanning bin + individual bins in remaining cells</option>
      </select>
     </label>
     {organizerMode!=="full"&&<div className="design-advanced-fields">
      {field("binCol","Start column (1-based)")}{field("binRow","Start row (1-based)")}
      {field("binSpanCols","Columns wide")}{field("binSpanRows","Rows deep")}
     </div>}
     <button type="button" className="design-advanced-apply" onClick={()=>perform(()=>{
      const layout=createOrganizerInserts(shell(),organizerOptions());
      setFeedback(layout.bins.length+" removable bins created. Save the editable project as JSON.");
     },"Organizer inserts created")}>Create removable inserts</button>
     <details className="ad5x-simple-extra"><summary>Advanced — fit, walls & plate spacing</summary>
      <div className="ad5x-simple-extra-body">
       <div className="design-advanced-fields">
        {field("binGap","Side gap per cell")}{field("binWall","Bin wall thickness")}
        {field("binFloor","Bin floor thickness")}{field("binTopGap","Clearance below rim")}
        {field("binBedGap","Spacing beside box")}
       </div>
       <p>All clearances are nominal and have not been print-fitted. Existing bins do not resize automatically.</p>
      </div>
     </details>
    </>}
    {tab==="Jigs"&&<>
     {hardwareIntent==="screws"&&!connectorChooser&&<p role="note">Screw clearance: enter the measured hole diameter below, then use the existing drill-on-selected-model controls. No screw size is assumed.</p>}
     {connectorChooser?
      <div className="ad5x-connector-chooser">
       <div className="ad5x-simple-heading"><h3>Add connector type</h3>
        <p>Choose a connector to fit to the selected hollow box. No second plate.</p></div>
       <label>Connector type
        <select aria-label="Connector type" value={connectorType}
         onChange={e=>{setConnectorType(e.target.value as typeof connectorType);setError("");setFeedback("");}}>
         <option value="banana">Banana plugs — measured holes</option>
         <option value="db9-male">DB9 male — 9-pin D-sub</option>
         <option value="db9-female">DB9 female — 9-pin D-sub</option>
         <option value="banana-type-b-socket">Banana socket Type B — 12.2 mm panel cutout (BAN-STB-GRN)</option>
         <option value="xt60-panel-03">XT60 round panel mount — 22 mm cutout (XT60-PAN-03)</option>
        </select>
       </label>
       <button type="button" className="design-advanced-secondary"
        onClick={()=>{setConnectorChooser(false);setError("");setFeedback("");}}>
        Back to all jigs & fixtures
       </button>
      </div>
     :<>
      <div className="ad5x-simple-heading"><h3>What do you want to make?</h3><p>Choose a jig, enter the dimensions, then create it.</p></div>
      <div className="ad5x-simple-tool-grid" role="group" aria-label="Choose a jig">
      {WORKSHOP_JOBS.map(({id:kind,label:name,description})=>workshopJobEnabled(kind)?<button key={kind} type="button"
       aria-pressed={jigKind===kind} onClick={()=>{setJigKind(kind);setError("");setFeedback("");}}>
       <strong>{name}</strong><small>{description}</small></button>:null)}
      </div>
      <div className="ad5x-simple-heading"><h4>Dimensions</h4><p>All sizes are in millimetres.</p></div>
     </>}
     {connectorChooser&&(connectorType==="banana-type-b-socket"||connectorType==="xt60-panel-03")?
       (()=>{try{
        const target=modelPanelTarget(project,selection);
        return <div className="ad5x-banana-target">
         <RoundPanelMountEditor key={connectorType} shell={target.sh} targetName={target.shell?"box":"model"}
          modelId={connectorType as RoundConnectorId}
          onCreate={options=>perform(()=>
           target.shell?applyRoundPanelMount(target.id,options):applyModelPanelCut(target.id,target.bounds!,"round",options),
           "Connector panel cutout added to the selected box",true)}/>
        </div>;
       }catch(e){return <div className="ad5x-banana-errors" role="alert">
        <strong>Select the model you want to modify</strong>
        <p>{e instanceof Error?e.message:"Choose any editable solid model."}</p>
        <p>The selected model has not been changed.</p>
       </div>;}})()
     :connectorChooser&&(connectorType==="db9-male"||connectorType==="db9-female")?
       (()=>{try{
        const target=modelPanelTarget(project,selection);
        return <div className="ad5x-banana-target">
         <DB9BoxMountEditor key={connectorType} shell={target.sh} targetName={target.shell?"box":"model"}
          gender={connectorType==="db9-male"?"male":"female"}
          onCreate={options=>perform(()=>
           target.shell?applyDB9BoxMount(target.id,options):applyModelPanelCut(target.id,target.bounds!,"db9",options),
           "DB9 "+options.gender+" cutout and mounting holes added to your box",true)}/>
        </div>;
       }catch(e){return <div className="ad5x-banana-errors" role="alert">
        <strong>Select the model you want to modify</strong>
        <p>{e instanceof Error?e.message:"Choose any editable solid model."}</p>
        <p>No object was changed.</p>
       </div>;}})()
     :jigKind==="banana"?<>
      {(()=>{try{
       const target=modelPanelTarget(project,selection);
       return <div className="ad5x-banana-target">
        <p className="ad5x-banana-ok">Using your selected {target.shell?"hollow box":"model"} ({target.sh.width.toFixed(1)} x {target.sh.depth.toFixed(1)} x {target.sh.height.toFixed(1)} mm). No separate plate.</p>
        <BananaPlugEditor key={bananaPresetId} shell={target.sh} targetName={target.shell?"box":"model"} initialPresetId={bananaPresetId}
         onCreate={options=>perform(()=>
         target.shell?applyBananaBoxHoles(target.id,options):applyModelPanelCut(target.id,target.bounds!,"banana",options),
         "Banana-plug holes added to your box",true)}/>
       </div>;
      }catch(e){return <div className="ad5x-banana-errors" role="alert">
       <strong>Select the model you want to modify</strong>
       <p>{e instanceof Error?e.message:"Select an editable shape or group."}</p>
       <p>Select the model you want to modify, then return here.</p>
      </div>;}})()}
     </>:jigKind==="pcb"?<>
      <div className="design-advanced-fields">
       {field("pcbWidth","PCB width")}{field("pcbDepth","PCB depth")}{field("pcbGap","Side clearance")}
      </div>
      <button type="button" className="design-advanced-apply" onClick={()=>perform(createElectronics,"PCB holder created")}>Create PCB edge holder</button>
      <details className="ad5x-simple-extra"><summary>Advanced — rails, base & mounting holes</summary>
       <div className="ad5x-simple-extra-body">
        <div className="design-advanced-fields">
         {field("pcbBase","Base thickness")}{field("pcbRailWidth","Guide rail width")}{field("pcbRailHeight","Guide rail height")}
         {field("pcbStopWidth","Rear stop width")}{field("pcbStopHeight","Rear stop height")}{field("pcbMargin","Outer margin")}
        </div>
        <label><input type="checkbox" checked={pcbMounting} onChange={e=>{setPcbMounting(e.target.checked);setError("");}}/> Add measured PCB mounting bores</label>
        {pcbMounting&&<><div className="design-advanced-fields">{field("pcbHoleDiameter","Mounting bore diameter")}</div>
         <label>PCB mounting-hole centres X,Y (mm)<input type="text" aria-label="PCB mounting-hole centres" placeholder="-20,-10; 20,-10" value={values.pcbHolePositions} onChange={e=>{setValues(old=>({...old,pcbHolePositions:e.target.value}));setError("");}}/></label></>}
        <p>Open edge holder only. It does not clamp a PCB or guarantee its fit.</p>
       </div>
      </details>
     </>:jigKind==="wire"?<>
      <div className="design-advanced-fields">
       {field("combCount","Wire positions")}{field("combPitch","Wire spacing")}{field("combSlot","Slot width")}
      </div>
      <button type="button" className="design-advanced-apply" onClick={()=>perform(createElectronics,"Open wire comb created")}>Create open wire comb</button>
      <details className="ad5x-simple-extra"><summary>Advanced — slots, base & guide height</summary>
       <div className="ad5x-simple-extra-body"><div className="design-advanced-fields">
        {field("combSlotDepth","Open slot depth")}{field("combDepth","Plate depth")}
        {field("combBase","Base thickness")}{field("combRidgeW","Raised guide thickness")}
        {field("combRidgeH","Guide height")}{field("combMargin","End margin")}
       </div><p>For positioning wires, not gripping them. Check heat resistance.</p></div>
      </details>
     </>:jigKind==="clamp"?<>
      <p className="ad5x-simple-caution">Screw-actuated print candidate: two locating pegs prevent jaw yaw; an M4 nut and M4 machine screw (not printed) press the separate sliding pad against the part. Physical grip/fit is not yet verified.</p>
      <div className="design-advanced-fields">
       {field("clampWidth","Base width")}{field("clampDepth","Base depth")}
       {field("clampMin","Smallest opening")}{field("clampMax","Largest opening")}
      </div>
      <button type="button" className="design-advanced-apply" onClick={()=>perform(createElectronics,"Two-peg screw clamp candidate created")}>Create M4 screw clamp (test)</button>
      <details className="ad5x-simple-extra"><summary>Advanced — index step & peg fit</summary>
       <div className="ad5x-simple-extra-body"><div className="design-advanced-fields">
        {field("clampStep","Index position step (4–12 mm)")}{field("clampPeg","Peg diameter")}{field("clampClearance","Peg clearance")}
       </div></div>
      </details>
     </>:jigKind==="cradle"?<>
      <div className="design-advanced-fields">
       {field("cradleWidth","Connector body width")}{field("cradleDepth","Connector body depth")}{field("cradleGap","Side clearance")}
      </div>
      <button type="button" className="design-advanced-apply" onClick={()=>perform(createElectronics,"Connector cradle created")}>Create connector soldering cradle</button>
      <details className="ad5x-simple-extra"><summary>Advanced — guides, stop & base</summary>
       <div className="ad5x-simple-extra-body"><div className="design-advanced-fields">
        {field("cradleBase","Base thickness")}{field("cradleRailW","Side guide width")}{field("cradleRailH","Side guide height")}
        {field("cradleStopW","Rear stop thickness")}{field("cradleStopH","Rear stop height")}{field("cradleMargin","Outer margin")}
       </div><p>Supports the component. Does not grip it or guarantee a press fit.</p></div>
      </details>
     </>:<>
      <div className="design-advanced-fields">
       {field("jigW","Plate width")}{field("jigD","Plate depth")}
       {field("jigHole",jigKind==="pogo"?"Pin guide diameter":"Hole diameter")}
       {field("jigCols","Hole columns")}{field("jigRows","Hole rows")}
       {field("jigPitchX","Spacing X")}{field("jigPitchY","Spacing Y")}
      </div>
      {jigKind==="drill"&&<label className="ad5x-simple-check"><input type="checkbox" checked={fence} onChange={e=>{setFence(e.target.checked);setError("");}}/> Add back locating fence</label>}
      {jigKind==="drill"?<button type="button" className="design-advanced-apply" onClick={()=>perform(createJig,"Drilling jig created")}>Create new drilling jig</button>
       :<button type="button" className="design-advanced-apply" onClick={()=>perform(createElectronics,jigKind==="connector"?"Connector mounting panel created":"Pogo-pin guide created")}>{jigKind==="connector"?"Create connector mounting panel":"Create pogo-pin guide plate"}</button>}
      <details key={jigKind} className="ad5x-simple-extra"><summary>Advanced — thickness & exact hole positioning</summary>
       <div className="ad5x-simple-extra-body">
        <div className="design-advanced-fields">{field("jigH","Plate thickness")}</div>
        {jigKind==="drill"?<>
         <div className="design-advanced-fields">{field("jigOffsetX","Grid X offset")}{field("jigOffsetY","Grid Y offset")}</div>
         <h4>Modify the selected model</h4>
         <p>Select any editable model in your design. These operations add holes to that same model.</p>
         <button type="button" className="design-advanced-secondary" onClick={()=>perform(()=>drillGridOnSelection(),"Drill grid cut into selected solid")}>Add positioned hole grid to selected model</button>
         <div className="design-advanced-fields">{field("jigPositions","Exact hole centres (X,Y; X,Y; ...)")}</div>
         <button type="button" className="design-advanced-secondary" onClick={()=>perform(()=>drillExactOnSelection(),"Custom-position holes cut into selected solid")}>Add exact coordinate holes to selected model</button>
        </>:jigKind==="connector"?<>
         <label className="ad5x-simple-check"><input type="checkbox" checked={connectorMeasured} onChange={e=>{setConnectorMeasured(e.target.checked);setError("");}}/> Use measured connector hole positions instead of a grid</label>
         {connectorMeasured&&<label>Measured bore centres X,Y (mm)<input type="text" aria-label="Measured connector bore centres" value={values.connectorPositions} onChange={e=>{setValues(old=>({...old,connectorPositions:e.target.value}));setError("");}}/></label>}
        </>:jigKind==="pogo"?<>
         <label className="ad5x-simple-check"><input type="checkbox" checked={pogoMeasured} onChange={e=>{setPogoMeasured(e.target.checked);setError("");}}/> Use measured pogo-pin centres instead of a grid</label>
         {pogoMeasured&&<label>Measured pin centres X,Y (mm)<input type="text" aria-label="Measured pogo-pin centres" value={values.pogoPositions} onChange={e=>{setValues(old=>({...old,pogoPositions:e.target.value}));setError("");}}/></label>}
        </>:null}
        <p>All hole diameters and positions are user-entered. Unsafe clearances are rejected.</p>
       </div>
      </details>
     </>}
     {!connectorChooser&&<details className="ad5x-simple-extra ad5x-simple-list"><summary>Prefer a list of jig types?</summary>
      <label>Jig type<select aria-label="Jig type" value={jigKind} onChange={e=>{setJigKind(e.target.value as typeof jigKind);setError("");setFeedback("");}}>
       <option value="drill">Drilling template</option>
       {workshopJobEnabled("pcb")&&<option value="pcb">PCB edge locating holder</option>}
       {workshopJobEnabled("connector")&&<option value="connector">Connector or banana-socket mounting panel</option>}
       {workshopJobEnabled("pogo")&&<option value="pogo">Pogo-pin testing guide</option>}
       {workshopJobEnabled("wire")&&<option value="wire">Open wire soldering comb</option>}
       {workshopJobEnabled("cradle")&&<option value="cradle">Connector soldering cradle</option>}
       {workshopJobEnabled("clamp")&&<option value="clamp">Indexed M4 screw clamp (physical fit pending)</option>}
      </select></label>
     </details>}
    </>}
    {error&&<div role="alert" className="design-advanced-error">{error} <button type="button" onClick={()=>setError("")}>Dismiss</button></div>}
    {feedback&&<p role="status" className="design-advanced-info">{feedback}</p>}
   </div>
   <footer>Everything stays editable. Use Save project as JSON to keep your work.</footer>
  </section>
 </div>;
}