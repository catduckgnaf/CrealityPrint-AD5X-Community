import {COMPONENTS} from "../lib/componentCatalog";
import {openWorkshopRoute,openComponentLibrary,type WorkshopConnectorType,type WorkshopSection} from "../lib/workshopRouting";
import {useState} from "react";
import {maxFilletRadius} from "../lib/boxEdges";
import {identifyShell} from "../lib/boxFitTools";
import {identifyLid} from "../lib/boxFitExtra";
import {canRoundTray} from "../lib/trayRoundingCore";
import {
  AlignCenter, Box, Boxes, Clipboard, Copy, CornerUpRight, EyeOff, Focus, Group, Grid2X2, Layers, Lock,
  Bolt, LockOpen, Magnet, Move3d, RotateCcw, Ruler, Scissors, Shapes, Trash2, Type, View, Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { sceneApi } from "../lib/sceneApi";
import { useScene } from "../state/store";
import { isGroup } from "../types/scene";
import { roundFamily } from "../lib/rounding";
import { editablePattern } from "../lib/editablePattern";
import { resemblesHollowBox,findDividerEditTarget } from "../lib/groupWorkflow";
import {editableModelRoot} from "../lib/modelPanelTools";
import {findUngroupedDB9,groupUngroupedDB9} from "../lib/connectorCutGroup";
import type {BananaPlugPresetId} from "../lib/bananaPlugPresets";
import { inspectDividerSet,equalizeDividers,removeDividerSolids,selectedDividerContext } from "../lib/dividerManagement";
import {dividerLayers,consolidateDividerLayers,deleteAllDividerLayers,deletePartialDivider} from "../lib/dividerInteraction";
import { QuickTools } from "./QuickTools";
import { PatternEditor } from "./PatternEditor";
import { PrecisionPanel } from "./PrecisionPanel";
import {HoverShelf,type HoverShelfGroup} from "./HoverShelf";
import {Link2} from "lucide-react";
import {partialDividerAxis} from "../lib/generatedFeatures";

export type ContextState = {
  x: number;
  y: number;
  clientX: number;
  clientY: number;
  kind: "shape" | "empty";
  ids: string[];
};

type Detail = "holes" | "corners" | "centre" | "distance" | "spacing" | null;

function Action({
  icon: Icon, label, run, disabled = false, danger = false,
}: {
  icon: LucideIcon;
  label: string;
  run: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button type="button" role="menuitem" disabled={disabled} onClick={run}
      className={"design-context-item" + (danger ? " is-danger" : "")}>
      <Icon aria-hidden="true" size={16} strokeWidth={1.7}/>
      <span>{label}</span>
    </button>
  );
}

/** Existing CAD handlers, presented where the user right-clicks. */
export function SmartContextMenu({
  menu, close,
}: {
  menu: ContextState;
  close: () => void;
}) {
  const project = useScene(s => s.project);
  const nodes = project.nodes;
  const [detail, setDetail] = useState<Detail>(null);
  const [cornerRadius,setCornerRadius] = useState("3");
  const [cornerError,setCornerError] = useState("");
  const [dividerError,setDividerError] = useState("");
  const ids = menu.ids.filter(id => nodes[id] && !nodes[id].hidden);
  const only = ids.length === 1 ? nodes[ids[0]] : null;
  const locked = ids.some(id => !!nodes[id]?.locked);
  // Only show actions supported by the current editable geometry.
  // Never ungroup a Boolean hollow shell just to round it or add dividers.
  const canShell = !!only && isGroup(only) && !only.locked && !only.hidden && (() => {
    try { identifyShell(only.id, project); return true; } catch { return false; }
  })();
// Show relevant hollow-box actions even when a transform or grouping makes
  // them temporarily unavailable. identifyShell remains the edit safety gate.
  // Right-click a hollow box OR one of its nested parts: resolve its root.
  // The same connector menu is available for any selected editable solid.
  const bananaBoxRootId=ids.length===1?(()=>{
    try{return editableModelRoot(project,ids);}catch{return null;}
  })():null;
  const legacyDB9=ids.length===1?findUngroupedDB9(project,ids[0]):null;  const showShellTools=canShell || !!only&&isGroup(only)&&resemblesHollowBox(project,only.id);
  const shellReason=showShellTools&&!canShell&&only&&isGroup(only) ? (()=>{
    try{identifyShell(only.id,project);return "This group cannot be edited as a hollow box.";}
    catch(e){return e instanceof Error?e.message:"This hollow box requires a compatible, editable group.";}
  })() : null;
  const dividerEditor = !!only && isGroup(only) && !only.locked && !only.hidden ? findDividerEditTarget(project,only.id):null;
  const dividerTools = !!only&&isGroup(only)?(()=>{try{return inspectDividerSet(project,only.id);}catch{return null;}})():null;
  const knownLayers=!!only&&isGroup(only)?(()=>{try{return dividerLayers(project,only.id);}catch{return [];}})():[];
  const allDividerCount=knownLayers.reduce((n,l)=>n+l.dividerIds.length,0);
  const selectedPartial=!!only&&!isGroup(only)&&partialDividerAxis(only)!==null;
  const selectedDivider = !!only&&!isGroup(only)?selectedDividerContext(project,only.id):null;
  const canTrayRound = canShell && !!only && canRoundTray(only.id, project);
  const canLid = !!only && isGroup(only) && !only.locked && !only.hidden && (() => {
    try { identifyLid(only.id); return true; } catch { return false; }
  })();
  const canLabel = canShell || canLid || !!only && !isGroup(only) && only.kind === "box" &&
    only.role === "solid" && !only.locked && !only.hidden &&
    only.rotation.every(v => Math.abs(v) < 1e-5) &&
    only.scale.every(v => Math.abs(v - 1) < 1e-5);
  const openWorkshop=(tab:WorkshopSection)=>run(()=>{
    if(ids.length===1)useScene.getState().setSelection([ids[0]]);
    openWorkshopRoute({tab});
  });
  // Right-click hierarchy only selects a preset. Nothing cuts the box until
  // the user confirms the layout in the existing Workshop panel.
  const openConnectorChoice=(
    connectorType:WorkshopConnectorType,
    bananaPreset?:BananaPlugPresetId
  )=>()=>{
    if(!bananaBoxRootId)return;
    useScene.getState().setSelection([bananaBoxRootId]);
    openWorkshopRoute({tab:"Jigs",connectorChooser:true,connectorType,bananaPreset,rootId:bananaBoxRootId});
    close();
  };
  // Hover opens the first flyout. Following panels are state-controlled
  // and stay available while the cursor travels across them (including
  // diagonal moves), rather than disappearing when CSS :hover breaks.
  const openBoxTool = (page: "Lids" | "Dividers" | "Labels") =>
    run(() => window.dispatchEvent(new CustomEvent("ad5x-open-boxfit", {detail: {page}})));
  const canHoles = !!only && !only.locked && (
    (!isGroup(only) && only.kind === "box") ||
    (isGroup(only) && !!editablePattern(only, nodes))
  );
  const canRound = !!only && !only.locked && !isGroup(only) && !!roundFamily(only.kind);
  const canCorners=!!only && !isGroup(only) && only.kind==="box" && !only.locked;
  const title = menu.kind === "empty" ? "Build plate" :
    ids.length === 1 ? (only ? (isGroup(only) ? "Group" : only.kind) : "Object") : String(ids.length) + " objects";
  const run = (callback: () => void) => () => { callback(); close(); };
  const withScene = (callback: (s: ReturnType<typeof useScene.getState>) => void) =>
    run(() => callback(useScene.getState()));
  const subpanel = (next: Detail) => () => setDetail(next);


  // Route new Hardware menu shortcuts into EXISTING editable operations.
  // No geometry changes or implicit insertion on opening a menu item.
  const openHardwareWorkshop=(kind:"drill"|"posts"|"insert")=>run(()=>{
    if(ids.length===1)useScene.getState().setSelection([ids[0]]);
    if(kind==="drill"){
      openWorkshopRoute({tab:"Jigs",jigKind:"drill",hardwareIntent:"screws"});
    }else{
      openWorkshopRoute({tab:"Enclosure",enclosureTask:"posts",hardwareIntent:kind==="insert"?"heat-insert":"standoff"});
    }
  });
  const openHardwareAdvanced=(tool:"Parts"|"Holes",option:"standoff"|"mounting-tab"|"counterbore")=>
    run(()=>window.dispatchEvent(new CustomEvent("ad5x-open-hardware",{
      detail:tool==="Parts"?{tool,part:option}:{tool,holeStyle:option}
    })));
  const canHardwareOnModel=!!bananaBoxRootId&&!locked;
  const canCounterbore=!!only&&!isGroup(only)&&only.kind==="box"&&
    project.rootOrder.includes(only.id)&&!locked&&!only.hidden&&
    only.rotation.every(v=>Math.abs(v)<1e-5)&&
    only.scale.every(v=>Math.abs(v-1)<1e-5);
  // HOVER SHELF: organize existing proven handlers without changing their CAD effects.
  // Each category is contextual: a connector-hole group will not offer tray dividers.
  const shelfGroups:HoverShelfGroup[]=[];
  if(menu.kind==="shape"){
    if(showShellTools || dividerEditor || dividerTools || knownLayers.length>0 || selectedPartial || selectedDivider){
      shelfGroups.push({id:"dividers",label:"Dividers",icon:Grid2X2,contents:<>
        {showShellTools && <>
          <Action icon={Grid2X2} label="Dividers..." disabled={!canShell} run={openBoxTool("Dividers")}/>
          <Action icon={Move3d} label="Place lengthwise divider (click)" disabled={!canShell} run={run(()=>
            window.dispatchEvent(new CustomEvent("ad5x-manual-divider",{detail:{rootId:only!.id,axis:"x"}}))
          )}/>
          <Action icon={Move3d} label="Place widthwise divider (click)" disabled={!canShell} run={run(()=>
            window.dispatchEvent(new CustomEvent("ad5x-manual-divider",{detail:{rootId:only!.id,axis:"y"}}))
          )}/>
          <Action icon={Move3d} label="Place partial lengthwise divider (click)" disabled={!canShell} run={run(()=>
            window.dispatchEvent(new CustomEvent("ad5x-manual-divider",{detail:{rootId:only!.id,axis:"x",partial:true}}))
          )}/>
          <Action icon={Move3d} label="Place partial widthwise divider (click)" disabled={!canShell} run={run(()=>
            window.dispatchEvent(new CustomEvent("ad5x-manual-divider",{detail:{rootId:only!.id,axis:"y",partial:true}}))
          )}/>
        </>}
        {dividerEditor && <Action icon={Move3d} label="Edit / move dividers..." run={run(()=>{
          const target=findDividerEditTarget(useScene.getState().project,only!.id);
          if(!target)return;
          useScene.getState().setEditingGroup(target.parentId);
          useScene.getState().setSelection([target.dividerId]);
        })}/>}
        {dividerTools && <Action icon={Ruler} label="Space dividers equally" run={()=>{
          try {
            const next=equalizeDividers(useScene.getState().project,only!.id);
            if(next.project!==useScene.getState().project)useScene.setState({project:next.project});
            close();
          } catch(e) {setDividerError(e instanceof Error?e.message:"Unable to space these dividers.");}
        }}/>}
        {knownLayers.length>1 && <Action icon={Layers} label="Consolidate divider groups..." run={()=>{
          if(!window.confirm("Combine the automatic divider layers into one editable group? This preserves every divider, label and hollow cutter, and can be undone."))return;
          try{
            const done=consolidateDividerLayers(useScene.getState().project,only!.id);
            if(done.removedWrappers)useScene.setState({project:done.project});
            close();
          }catch(e){setDividerError(e instanceof Error?e.message:"Could not consolidate these groups.");}
        }}/>}
        {knownLayers.length>0&&allDividerCount>0 && <Action icon={Trash2} label="Delete all dividers..." danger run={()=>{
          if(!window.confirm("Delete all "+allDividerCount+" divider(s) across this box?\n\nThe hollow box and its cavity cutter will remain. You can Undo this change."))return;
          try {
            const next=deleteAllDividerLayers(useScene.getState().project,only!.id);
            useScene.setState({project:next.project,selection:[next.selectionId]});
            close();
          } catch(e){setDividerError(e instanceof Error?e.message:"Unable to remove these dividers.");}
        }}/>}
        {selectedPartial && <Action icon={Trash2} label="Delete this partial divider..." danger run={()=>{
          if(!window.confirm("Delete only this short divider? The hollow shell and other dividers remain."))return;
          try{const result=deletePartialDivider(useScene.getState().project,only!.id);
           useScene.setState({project:result.project,selection:[]});close();}
          catch(e){setDividerError(e instanceof Error?e.message:"Cannot delete this partial divider.");}
        }}/>}
        {selectedDivider && <Action icon={Trash2} label="Delete this divider..." danger run={()=>{
          if(!window.confirm("Delete only this divider?\n\nOther dividers, the box and its hollow cutter will remain. You can Undo."))return;
          try {
            const next=removeDividerSolids(useScene.getState().project,selectedDivider.groupId,selectedDivider.dividerId);
            useScene.setState({project:next.project,selection:[]});close();
          } catch(e){setDividerError(e instanceof Error?e.message:"Unable to remove this divider.");}
        }}/>}
      </>});
    }
    if(showShellTools){
      shelfGroups.push({id:"organizers",label:"Organizers, lids & bins",icon:Boxes,contents:<>
        <Action icon={Wrench} label="Tray measurements & tools..." disabled={!canShell} run={openWorkshop("Tray")}/>
        <Action icon={Boxes} label="Removable organizer inserts..." disabled={!canShell} run={openWorkshop("Organizer")}/>
        <Action icon={Box} label="Matching lid..." disabled={!canShell} run={openBoxTool("Lids")}/>
        <Action icon={Wrench} label="Enclosure posts & cable openings..." disabled={!canShell} run={openWorkshop("Enclosure")}/>
      </>});
    }
    if(bananaBoxRootId || canHoles || legacyDB9){
      shelfGroups.push({id:"connectors",label:"Connectors & holes",icon:Wrench,contents:<>
        {bananaBoxRootId && <>
          <Action icon={Boxes} label={`Physical component library (${COMPONENTS.length} SKUs)...`} run={run(()=>
            openComponentLibrary()
          )}/>
          <div className="design-hover-shelf-section">Banana plugs</div>
          <Action icon={Ruler} label="Banana plug 2 mm" run={openConnectorChoice("banana","mini2-contact")}/>
          <Action icon={Ruler} label="Banana plug 3 mm" run={openConnectorChoice("banana","mini3-contact")}/>
          <Action icon={Ruler} label="Banana plug 4 mm" run={openConnectorChoice("banana","standard4-contact")}/>
          <Action icon={Ruler} label="Banana plug Custom…" run={openConnectorChoice("banana","custom")}/>
          <Action icon={Wrench} label="Banana socket Type B (12.2 mm cutout)" run={openConnectorChoice("banana-type-b-socket")}/>
          <div className="design-hover-shelf-section">Panel connectors</div>
          <Action icon={Wrench} label="DB9 male" run={openConnectorChoice("db9-male")}/>
          <Action icon={Wrench} label="DB9 female" run={openConnectorChoice("db9-female")}/>
          <Action icon={Wrench} label="XT60 panel mount (22 mm)" run={openConnectorChoice("xt60-panel-03")}/>
          <Action icon={Wrench} label="Jig drill pattern..." run={openWorkshop("Jigs")}/>
          <div className="design-context-shell-hint" role="note">Banana sizes are contact sizes. Existing Workshop editors control cuts and measurements.</div>
        </>}
        {!bananaBoxRootId&&<Action icon={Boxes} label={`Physical component library (${COMPONENTS.length} SKUs)...`} run={run(()=>
          openComponentLibrary()
        )}/>}
        {canHoles && <Action icon={Shapes}
          label={isGroup(only!) ? "Edit mounting holes…" : "Add mounting holes…"}
          run={subpanel("holes")}/>}
        {legacyDB9 && <Action icon={Group} label="Group DB9 opening + screw holes" run={()=>{
          try {
            const changed=groupUngroupedDB9(useScene.getState().project,only!.id);
            useScene.setState({project:changed.project,selection:[changed.groupId],editingGroupId:changed.parentId});
            close();
          }catch(e){setDividerError(e instanceof Error?e.message:"Cannot group DB9 cutout.");}
        }}/>}
      </>});
    }
    // Screw holes and standoffs are visible in the same one-level Hover Shelf
    // as connectors. Each entry opens an existing WORKING editor, not a mockup.
    shelfGroups.push({id:"hardware",label:"Hardware & mounting",icon:Bolt,contents:<>
      <div className="design-hover-shelf-section">Screws & bores</div>
      <Action icon={Ruler} label="Screw clearance / drill holes..." disabled={!canHardwareOnModel}
        run={openHardwareWorkshop("drill")}/>
      {canCounterbore&&<Action icon={Shapes} label="Screw head counterbore..."
        run={openHardwareAdvanced("Holes","counterbore")}/>}
      <div className="design-hover-shelf-section">Posts & heat-set inserts</div>
      <Action icon={Bolt} label="Standoffs / mounting posts..." disabled={!canHardwareOnModel}
        run={openHardwareWorkshop("posts")}/>
      <Action icon={Bolt} label="Heat-set insert pilot bores (in posts)..." disabled={!canHardwareOnModel}
        run={openHardwareWorkshop("insert")}/>
      {(canShell||canLid)&&<>
        <div className="design-hover-shelf-section">Box & lid</div>
        <Action icon={Link2} label="Add removable-pin hinge to box & lid..."
          run={run(()=>window.dispatchEvent(new CustomEvent("ad5x-open-hinge",{
            detail:{rootId:only!.id}
          })))}/>
      </>}
      <div className="design-hover-shelf-section">Standalone editable parts</div>
      <Action icon={Bolt} label="Standalone screw standoff..."
        run={openHardwareAdvanced("Parts","standoff")}/>
      <Action icon={Shapes} label="Mounting tab with screw hole..."
        run={openHardwareAdvanced("Parts","mounting-tab")}/>
      <Action icon={Wrench} label="Threaded shaft shape (place)..."
        run={withScene(s=>s.setPlacing("thread"))}/>
      <div className="design-context-shell-hint" role="note">
        Heat-set pocket diameter must come from the insert manufacturer's specification; fit is not print-verified.
      </div>
    </>});    if(canTrayRound || canCorners || canRound || canLabel || showShellTools){
      shelfGroups.push({id:"geometry",label:"Edit geometry",icon:Scissors,contents:<>
        {showShellTools && <Action icon={CornerUpRight} label="Corners & floor..." disabled={!canTrayRound}
          run={run(() => window.dispatchEvent(new Event("ad5x-tray-round")))}/>}
        {canCorners && <Action icon={RotateCcw} label="Round four corners…" run={subpanel("corners")}/>}
        {canRound && <Action icon={Scissors} label="Round individual edges"
          run={withScene(s => { s.setFilletStyle("round"); s.setFilletMode(true); })}/>}
        {(showShellTools || canLabel) && <Action icon={Type} label="Text / label..." disabled={!canLabel} run={openBoxTool("Labels")}/>}
      </>});
    }
    shelfGroups.push({id:"arrange",label:"Position & arrange",icon:Move3d,contents:<>
      <Action icon={Move3d} label="Place on build plate"
        run={withScene(s => s.dropSelectedToWorkplane())} disabled={locked}/>
      {ids.length===2 && <>
        <Action icon={AlignCenter} label="Centre together…" run={subpanel("centre")} disabled={locked}/>
        <Action icon={Ruler} label="Exact distance…" run={subpanel("distance")} disabled={locked}/>
      </>}
      {ids.length>=3 && <Action icon={Ruler} label="Space evenly…" run={subpanel("spacing")} disabled={locked}/>}
      {ids.length>=2 && <Action icon={Magnet} label="Align objects"
        run={withScene(s => s.setAlignMode(true))} disabled={locked}/>}
      {ids.length>=2 && <Action icon={Group} label="Group" run={withScene(s => s.groupSelected())} disabled={locked}/>}
      {ids.some(id=>isGroup(nodes[id])) && <Action icon={Layers} label="Ungroup"
        run={withScene(s => s.ungroupSelected())} disabled={locked}/>}
    </>});
    shelfGroups.push({id:"manage",label:"Object controls",icon:Layers,contents:<>
      {only && isGroup(only) && !locked && <Action icon={Layers} label="Edit Inside (keep cuts)"
        run={withScene(s=>s.setEditingGroup(only.id))}/>}
      <Action icon={Copy} label="Duplicate" run={withScene(s => s.duplicateSelected())} disabled={locked}/>
      <Action icon={Clipboard} label="Copy" run={withScene(s => s.copySelection())}/>
      <Action icon={Wrench} label="Workshop tools · Trays / Boxes / Jigs..."
        run={openWorkshop(showShellTools?"Tray":"Jigs")}/>
      <Action icon={locked ? LockOpen : Lock} label={locked ? "Unlock" : "Lock"}
        run={withScene(s => s.toggleLockSelected())}/>
      <Action icon={EyeOff} label="Hide" run={withScene(s => s.hideSelected())}/>
      <Action icon={Trash2} label="Delete" danger disabled={locked}
        run={withScene(s => s.deleteSelected())}/>
    </>});
  } else {
    shelfGroups.push({id:"create",label:"Create something",icon:Boxes,contents:<>
      <Action icon={Wrench} label="New tray / box..." run={openWorkshop("Tray")}/>
      <Action icon={Wrench} label="New drilling jig..." run={openWorkshop("Jigs")}/>
      <Action icon={Boxes} label="Organizers & bins..." run={openWorkshop("Organizer")}/>
      <Action icon={Wrench} label="PCB, connectors & fixtures..." run={openWorkshop("Jigs")}/>
      <Action icon={Boxes} label={`Physical component library (${COMPONENTS.length} SKUs)...`} run={run(()=>
        openComponentLibrary()
      )}/>
      <Action icon={Box} label="Enclosures & lids..." run={openWorkshop("Enclosure")}/>
      <Action icon={Box} label="Add box here"
        run={run(() => sceneApi.dropShape("box",menu.clientX,menu.clientY))}/>
      <Action icon={Shapes} label="Add cylinder here"
        run={run(() => sceneApi.dropShape("cylinder",menu.clientX,menu.clientY))}/>
    </>});
    shelfGroups.push({id:"hardware",label:"Hardware & mounting",icon:Bolt,contents:<>
      <Action icon={Bolt} label="Standalone screw standoff..."
        run={openHardwareAdvanced("Parts","standoff")}/>
      <Action icon={Shapes} label="Mounting tab with screw hole..."
        run={openHardwareAdvanced("Parts","mounting-tab")}/>
      <Action icon={Wrench} label="Threaded shaft shape (place)..."
        run={withScene(s=>s.setPlacing("thread"))}/>
      <div className="design-context-shell-hint" role="note">Select a model to drill holes or add mounting posts.</div>
    </>});    shelfGroups.push({id:"clipboard",label:"Clipboard & selection",icon:Clipboard,contents:<>
      <Action icon={Clipboard} label="Paste" run={withScene(s=>s.pasteClipboard())}/>
      <Action icon={Boxes} label="Select all" run={withScene(s=>s.selectAll())}/>
    </>});
    shelfGroups.push({id:"view",label:"View & visibility",icon:View,contents:<>
      <Action icon={View} label="Show hidden objects" run={withScene(s=>s.showAll())}/>
      <Action icon={Focus} label="Fit objects" run={run(()=>sceneApi.zoomToFit())}/>
      <Action icon={Ruler} label="Top view" run={run(()=>sceneApi.setView("top"))}/>
      <Action icon={RotateCcw} label="Isometric view" run={run(()=>sceneApi.setView("iso"))}/>
    </>});
  }

  const contextTitle=menu.kind==="empty"?"Build plate":
    canShell?"Hollow box":only?.label||title;
  const contextHint=menu.kind==="empty"?"Create or arrange":
    ids.length>1?ids.length+" selected":only&&isGroup(only)&&only.childIds.length===3&&
      (only.label??"").toLowerCase().includes("db9")?"3 linked cutouts":"Tool groups";
  const quickActions=menu.kind==="shape"?<>
    <Action icon={Copy} label="Duplicate" run={withScene(s=>s.duplicateSelected())} disabled={locked}/>
    <Action icon={Clipboard} label="Copy" run={withScene(s=>s.copySelection())}/>
    <Action icon={Wrench} label="Workshop" run={openWorkshop(showShellTools?"Tray":"Jigs")}/>
  </>:<>
    <Action icon={Box} label="Add box" run={run(()=>sceneApi.dropShape("box",menu.clientX,menu.clientY))}/>
    <Action icon={Wrench} label="New jig" run={openWorkshop("Jigs")}/>
    <Action icon={Clipboard} label="Paste" run={withScene(s=>s.pasteClipboard())}/>
  </>;
  const footer=menu.kind==="shape"?<>
    <Action icon={locked?LockOpen:Lock} label={locked?"Unlock":"Lock"}
      run={withScene(s=>s.toggleLockSelected())}/>
    <Action icon={EyeOff} label="Hide" run={withScene(s=>s.hideSelected())}/>
    <Action icon={Trash2} label="Delete" danger disabled={locked}
      run={withScene(s=>s.deleteSelected())}/>
    {shellReason&&<div className="design-context-shell-hint" role="note">{shellReason}</div>}
    {dividerError&&<div className="design-context-shell-hint" role="alert">{dividerError}</div>}
  </>:<div className="design-hover-shelf-footnote">Hover or click a category for tools</div>;

  return detail ? (
    <div className="design-context-host design-hover-shelf-detail"
      onPointerDown={e=>e.stopPropagation()}
      onPointerMove={e=>e.stopPropagation()}
      onPointerUp={e=>e.stopPropagation()}
      onContextMenu={e=>e.preventDefault()}>
      <div className="design-context-menu" role="menu"
        aria-label={menu.kind==="empty"?"Build plate actions":"Selected shape actions"}>
      <div className="design-context-heading">
        {detail
          ? <button type="button" onClick={()=>setDetail(null)} className="design-context-back">
              {"< " + "Back to tools"}
            </button>
          : title}
      </div>
      {detail === "holes" && only && !isGroup(only) && only.kind === "box" &&
        <div className="design-context-subpanel"><QuickTools node={only} hideSurface/></div>}
      {detail === "holes" && only && isGroup(only) &&
        <div className="design-context-subpanel"><PatternEditor group={only}/></div>}
      {detail === "corners" && canCorners && only && !isGroup(only) && (
        <div className="design-context-subpanel">
          <p className="text-xs font-semibold mb-2">Round four upright corners</p>
          <label className="block text-xs text-neutral-600">
            Radius (mm)
            <input className="mt-1 w-full rounded border border-neutral-300 bg-white p-2 text-sm"
              type="number" step="0.5" min="0" aria-label="Corner radius in mm"
              value={cornerRadius}
              onChange={e=>{setCornerRadius(e.target.value);setCornerError("");}}/>
          </label>
          <p className="text-[11px] text-neutral-600 mt-1">
            Safe maximum {maxFilletRadius(Number(only.params.w)||20,Number(only.params.d)||20,Number(only.params.h)||20).toFixed(2)} mm.
            Top and bottom edges remain unchanged.
          </p>
          <div className="flex gap-2 mt-2">
            <button type="button" className="flex-1 rounded bg-green-700 px-2 py-1.5 text-white"
              onClick={()=>{
                if(!cornerRadius.trim()){setCornerError("Enter a radius.");return;}
                try{useScene.getState().roundBoxCorners(only.id,Number(cornerRadius));close();}
                catch(e){setCornerError(e instanceof Error?e.message:"Invalid radius");}
              }}>Apply radius</button>
            <button type="button" className="rounded border border-neutral-400 px-2"
              onClick={()=>{
                try{useScene.getState().roundBoxCorners(only.id,0);close();}
                catch(e){setCornerError(e instanceof Error?e.message:"Cannot remove rounding");}
              }}>Sharp</button>
          </div>
          {cornerError && <p role="alert" className="mt-2 text-xs text-red-700">{cornerError}</p>}
        </div>
      )}
      {(detail === "centre" || detail === "distance" || detail === "spacing") &&
        <div className="design-context-subpanel"><PrecisionPanel ids={ids} focus={detail}/></div>}


      </div>
    </div>
  ) : (
    <HoverShelf title={contextTitle} hint={contextHint} kind={menu.kind}
      groups={shelfGroups} quick={quickActions} footer={footer}/>
  );
}