import {useEffect, useMemo, useRef, useState} from "react";
import {Search} from "lucide-react";
import {useScene, undo, redo} from "../state/store";
import {sceneApi} from "../lib/sceneApi";
import {isGroup} from "../types/scene";
import {toolbarWorkflowAvailabilityFromSelection} from "../lib/toolbarWorkflow";
import {saveProjectFile} from "../lib/projectFile";

type Command = {
  id:string;
  label:string;
  keywords:string;
  group:string;
  hint?:string;
  ready?:boolean;
  act:()=>void;
};
const OPEN_EVENT="ad5x-open-commands";

/** Searchable access to existing editor commands, not another geometry engine. */
export function CommandPalette() {
  const [open,setOpen]=useState(false);
  const [query,setQuery]=useState("");
  const [active,setActive]=useState(0);
  const ref=useRef<HTMLInputElement>(null);
  const selected=useScene(s=>s.selection);
  const nodes=useScene(s=>s.project.nodes);
  const modalOpen=useScene(s=>s.modalOpen);
  const hasSelection=selected.length>0;
  const available=toolbarWorkflowAvailabilityFromSelection(selected,nodes);
  const openWorkflow=(kind:"holes"|"centre"|"distance"|"spacing")=>
    window.dispatchEvent(new CustomEvent("ad5x-open-workflow",{detail:kind}));
  const writable=hasSelection && selected.every(id=>nodes[id] && !nodes[id].locked);

  useEffect(()=>{
    const launch=()=>{if(!useScene.getState().modalOpen){setOpen(true);setQuery("");setActive(0);}};
    const keyboard=(e:KeyboardEvent)=>{
      if((e.ctrlKey||e.metaKey) && !e.altKey && e.key.toLowerCase()==="k") {
        if(useScene.getState().modalOpen) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        launch();
      }
    };
    window.addEventListener(OPEN_EVENT,launch);
    window.addEventListener("keydown",keyboard,true);
    return ()=>{
      window.removeEventListener(OPEN_EVENT,launch);
      window.removeEventListener("keydown",keyboard,true);
    };
  },[]);
  useEffect(()=>{if(open){ref.current?.focus();}},[open]);

  const commands=useMemo<Command[]>(()=>{
    const live=()=>useScene.getState();
    const action=(fn:()=>void)=>fn;
    return [
      {id:"save",label:"Save editable project (JSON)",keywords:"save backup project export",group:"Project",hint:"Local file",act:()=>saveProjectFile(live().project)},
      {id:"undo",label:"Undo",keywords:"undo revert back",group:"Project",hint:"Ctrl+Z",act:undo},
      {id:"redo",label:"Redo",keywords:"redo forward",group:"Project",hint:"Ctrl+Shift+Z",act:redo},
      {id:"copy",label:"Copy selection",keywords:"copy clipboard",group:"Edit",ready:hasSelection,act:()=>live().copySelection()},
      {id:"paste",label:"Paste",keywords:"paste clipboard",group:"Edit",hint:"Ctrl+V",act:()=>live().pasteClipboard()},
      {id:"duplicate",label:"Duplicate selection",keywords:"copy duplicate repeat",group:"Edit",ready:writable,hint:"Ctrl+D",act:()=>live().duplicateSelected()},
      {id:"delete",label:"Delete selection",keywords:"delete remove shape",group:"Edit",ready:writable,act:()=>live().deleteSelected()},
      {id:"select-all",label:"Select all",keywords:"select objects everything",group:"Edit",act:()=>live().selectAll()},
      {id:"select-more",label:"Toggle multi-select",keywords:"select more multiple",group:"Edit",act:()=>live().setMultiSelectMode(!live().multiSelectMode)},
      {id:"hide",label:"Hide selected objects",keywords:"hide invisible",group:"Edit",ready:hasSelection,act:()=>live().hideSelected()},
      {id:"show",label:"Show all hidden objects",keywords:"unhide visible reveal",group:"Edit",act:()=>live().showAll()},
      {id:"lock",label:"Lock or unlock selection",keywords:"lock unlock protect",group:"Edit",ready:hasSelection,act:()=>live().toggleLockSelected()},
      {id:"holes",label:"Create or edit mounting holes",keywords:"holes drilling screw bolt pattern",group:"CAD",ready:available.holes,act:()=>openWorkflow("holes")},
      {id:"centre",label:"Centre selected objects",keywords:"centre center align middle",group:"Arrange",ready:available.centre,act:()=>openWorkflow("centre")},
      {id:"distance",label:"Set exact distance",keywords:"distance gap separation precise",group:"Arrange",ready:available.distance,act:()=>openWorkflow("distance")},
      {id:"spacing",label:"Space evenly",keywords:"spacing distribute evenly between",group:"Arrange",ready:available.spacing,act:()=>openWorkflow("spacing")},
      {id:"box",label:"Add box",keywords:"rectangle cube primitive shape",group:"Shapes",act:()=>live().addShape("box")},
      {id:"cylinder",label:"Add cylinder",keywords:"round pillar primitive shape",group:"Shapes",act:()=>live().addShape("cylinder")},
      {id:"sphere",label:"Add sphere",keywords:"round ball shape",group:"Shapes",act:()=>live().addShape("sphere")},
      {id:"group",label:"Group selected objects",keywords:"combine grouping",group:"Shapes",ready:selected.length>1&&writable,act:()=>live().groupSelected()},
      {id:"ungroup",label:"Ungroup selection",keywords:"separate ungroup",group:"Shapes",ready:selected.some(id=>nodes[id]&&isGroup(nodes[id]))&&writable,act:()=>live().ungroupSelected()},
      {id:"drop",label:"Place selection on build plate",keywords:"drop bottom floor ground",group:"Arrange",ready:writable,act:()=>live().dropSelectedToWorkplane()},
      {id:"align",label:"Align selected objects",keywords:"align line centre",group:"Arrange",ready:selected.length>1&&writable,act:()=>live().setAlignMode(true)},
      {id:"move",label:"Move tool",keywords:"translate position",group:"Tools",hint:"G",act:()=>live().setTransformMode("translate")},
      {id:"rotate",label:"Rotate tool",keywords:"angle rotation",group:"Tools",hint:"R",act:()=>live().setTransformMode("rotate")},
      {id:"scale",label:"Scale tool",keywords:"resize scale dimensions",group:"Tools",hint:"S",act:()=>live().setTransformMode("scale")},
      {id:"round",label:"Round individual edges",keywords:"fillet curve edges",group:"Tools",ready:hasSelection,hint:"E",act:()=>{live().setFilletStyle("round");live().setFilletMode(true);}},
      {id:"measure",label:"Toggle measure tool",keywords:"distance measure",group:"Tools",hint:"M",act:()=>live().setMeasureMode(!live().measureMode)},
      {id:"snap",label:"Toggle grid snapping",keywords:"snap magnet on off",group:"Tools",act:()=>live().setSnap(!live().snap)},
      {id:"top",label:"Top view",keywords:"camera top above",group:"View",hint:"1",act:()=>sceneApi.setView("top")},
      {id:"front",label:"Front view",keywords:"camera front",group:"View",hint:"2",act:()=>sceneApi.setView("front")},
      {id:"right",label:"Right view",keywords:"camera right",group:"View",hint:"3",act:()=>sceneApi.setView("right")},
      {id:"iso",label:"Isometric view",keywords:"camera perspective iso",group:"View",hint:"4",act:()=>sceneApi.setView("iso")},
      {id:"fit",label:"Fit objects into view",keywords:"fit camera zoom home",group:"View",hint:"F",act:()=>sceneApi.zoomToFit()},
    ].filter(item=>item.ready!==false).map(c=>({...c,act:action(c.act)}));
  },[selected,nodes,hasSelection,writable]);
  const matches=useMemo(()=>{
    const q=query.trim().toLowerCase();
    return commands.filter(c=>!q || (c.label+" "+c.keywords+" "+c.group).toLowerCase().includes(q)).slice(0,25);
  },[commands,query]);
  const run=(c:Command)=>{
    setOpen(false);
    setQuery("");
    c.act();
  };
  if(!open || modalOpen) return null;
  return (
    <div className="design-command-overlay" onPointerDown={e=>e.stopPropagation()}
      onClick={e=>{if(e.target===e.currentTarget)setOpen(false);}}>
      <div className="design-command-palette" role="dialog" aria-modal="true" aria-label="Quick commands">
        <div className="design-command-search">
          <Search size={18} aria-hidden="true"/>
          <input ref={ref} type="text" value={query} placeholder="Search Design commands…"
            aria-label="Search commands" onChange={e=>{setQuery(e.target.value);setActive(0);}}
            onKeyDown={e=>{
              e.stopPropagation();
              if(e.key==="Escape"){e.preventDefault();setOpen(false);}
              if(e.key==="ArrowDown"){e.preventDefault();setActive(a=>Math.min(a+1,matches.length-1));}
              if(e.key==="ArrowUp"){e.preventDefault();setActive(a=>Math.max(0,a-1));}
              if(e.key==="Enter"&&matches[active]){e.preventDefault();run(matches[active]);}
            }}/>
          <span className="design-command-esc">Esc</span>
        </div>
        <div className="design-command-results" role="listbox" aria-label="Available commands">
          {matches.length===0&&<div className="design-command-empty">No matching commands</div>}
          {matches.map((c,i)=>(
            <button type="button" key={c.id} role="option" aria-selected={i===active}
              className={"design-command-result"+(i===active?" active":"")}
              onMouseEnter={()=>setActive(i)} onClick={()=>run(c)}>
              <span className="design-command-group">{c.group}</span>
              <span className="design-command-name">{c.label}</span>
              {c.hint&&<span className="design-command-hint">{c.hint}</span>}
            </button>
          ))}
        </div>
        <div className="design-command-footer">Enter to run · ↑↓ to navigate · Esc to close</div>
      </div>
    </div>
  );
}
