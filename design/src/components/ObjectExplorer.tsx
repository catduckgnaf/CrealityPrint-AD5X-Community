import {useEffect,useState} from "react";
import {ChevronDown,ChevronRight,Eye,EyeOff,FolderTree,Lock,LockOpen,X} from "lucide-react";
import {useScene} from "../state/store";
import {isGroup,type SceneNode} from "../types/scene";
import {groupDisplay,isBooleanGroup} from "../lib/groupWorkflow";
import {selectFromObjectTree,openGroupForEditing,finishGroupEdit} from "../lib/groupInteractions";

function display(node:SceneNode):string {
  if(node.label)return node.label;
  if(isGroup(node))return "Group ("+node.childIds.length+" parts)";
  if(node.role==="hole")return node.kind==="box"?"Cavity (cutout)":"Cutout ("+node.kind+")";
  return node.kind==="box"?"Solid box":node.kind.replace(/-/g," ");
}

/** Display metadata is stored on nodes; geometry and group ancestry are unchanged. */
export function ObjectExplorer() {
  const [open,setOpen]=useState(false);
  const [collapsed,setCollapsed]=useState<Set<string>>(new Set());
  const [editing,setEditing]=useState<string|null>(null);
  const [draft,setDraft]=useState("");
  const nodes=useScene(s=>s.project.nodes);
  const roots=useScene(s=>s.project.rootOrder);
  const selection=useScene(s=>s.selection);
  const projectName=useScene(s=>s.project.name);
  const editingGroupId=useScene(s=>s.editingGroupId);
  const setSelection=useScene(s=>s.setSelection);
  const updateNodeDisplay=useScene(s=>s.updateNodeDisplay);
  useEffect(()=>{
    const toggle=()=>setOpen(v=>!v);
    const reveal=()=>setOpen(true);
    window.addEventListener("ad5x-toggle-explorer",toggle);
    window.addEventListener("ad5x-open-explorer",reveal);
    return ()=>{
      window.removeEventListener("ad5x-toggle-explorer",toggle);
      window.removeEventListener("ad5x-open-explorer",reveal);
    };
  },[]);
  const toggleGroup=(id:string)=>setCollapsed(prev=>{
    const next=new Set(prev);
    if(next.has(id))next.delete(id);else next.add(id);
    return next;
  });
  const rename=(id:string)=>{
    const label=draft.trim().slice(0,80);
    if(label)updateNodeDisplay(id,{label});
    else updateNodeDisplay(id,{label:""});
    setEditing(null);
  };
  const project={nodes,rootOrder:roots};
  const choose=(id:string,additive:boolean)=>selectFromObjectTree(id,additive);
  const render=(id:string,depth:number):React.ReactNode=>{
    const node=nodes[id];
    if(!node || depth>32)return null;
    const group=isGroup(node);
    const marked=selection.includes(id);
    return <div key={id}>
      <div className={"design-object-row"+(marked?" selected":"")} style={{paddingLeft:8+depth*13}}
        onClick={e=>choose(id,e.shiftKey||e.ctrlKey)}>
        {group?
          <button type="button" title="Expand or collapse group" onClick={e=>{e.stopPropagation();toggleGroup(id);}}>
            {collapsed.has(id)?<ChevronRight size={13}/>:<ChevronDown size={13}/>}
          </button>:
          <span className="design-object-spacer"/>}
        <span className={"design-object-kind"+(!group&&node.role==="hole"?" is-cutout":"")} title={!group&&node.role==="hole"?"Cutout: removes material while grouped":group?"Grouped parts":"Solid shape"}>{group?"▧":node.role==="hole"?"◇":"⬡"}</span>
        {editing===id?
          <input autoFocus maxLength={80} aria-label="Object name" value={draft}
            onClick={e=>e.stopPropagation()}
            onChange={e=>setDraft(e.target.value)}
            onKeyDown={e=>{
              e.stopPropagation();
              if(e.key==="Enter")rename(id);
              if(e.key==="Escape")setEditing(null);
            }}
            onBlur={()=>rename(id)}/>:
          <button type="button" className="design-object-label" title="Double-click to rename"
            onDoubleClick={e=>{e.stopPropagation();setDraft(display(node));setEditing(id);}}
            onClick={e=>{e.stopPropagation();choose(id,e.shiftKey||e.ctrlKey);}}>
            {display(node)}
          </button>}
        {group&&!node.locked&&!node.hidden&&<button type="button" className="design-object-edit"
          title="Edit parts inside this group without ungrouping" aria-label={"Edit inside "+display(node)}
          onClick={e=>{e.stopPropagation();openGroupForEditing(id);}}>
          Edit
        </button>}
        <button type="button" title={node.hidden?"Show":"Hide"} aria-label={node.hidden?"Show object":"Hide object"}
          onClick={e=>{e.stopPropagation();updateNodeDisplay(id,{hidden:!node.hidden});}}>
          {node.hidden?<EyeOff size={14} color="#8f9da7"/>:<Eye size={14}/>}
        </button>
        <button type="button" title={node.locked?"Unlock":"Lock"} aria-label={node.locked?"Unlock object":"Lock object"}
          onClick={e=>{e.stopPropagation();updateNodeDisplay(id,{locked:!node.locked});}}>
          {node.locked?<Lock size={14} color="#e4a955"/>:<LockOpen size={14}/>}
        </button>
      </div>
      {group&&!collapsed.has(id)&&node.childIds.map(child=>render(child,depth+1))}
    </div>;
  };
  if(!open)return null;
  return <aside className="design-object-explorer" aria-label="Object Explorer">
    <header>
      <FolderTree size={17}/>
      <strong>Objects</strong>
      <span className="design-object-count">{roots.length} top-level</span>
      <button type="button" aria-label="Close Object Explorer" onClick={()=>setOpen(false)}><X size={16}/></button>
    </header>
    <p className="design-object-subhead">{projectName} · Click a part to edit inside its group · double-click its name to rename</p>
    {editingGroupId&&<div className="design-objects-editing">
      <span>Editing: {groupDisplay(project,editingGroupId)}</span>
      <button type="button" onClick={finishGroupEdit}>Done</button>
    </div>}
    {selection.length===1&&isBooleanGroup(project,selection[0])&&!editingGroupId&&
      <p className="design-objects-tip">This group contains holes. Use Edit to keep its cuts intact.</p>}
    <div className="design-object-scroll">{roots.length?roots.map(id=>render(id,0)):
      <p className="design-object-empty">Add a shape to see it here.</p>}</div>
    <footer>
      <button type="button" onClick={()=>setSelection(roots.filter(id=>nodes[id]&&!nodes[id].hidden))}>Select visible</button>
      <button type="button" onClick={()=>useScene.getState().groupSelected()} disabled={selection.length<2}>Group</button>
      <button type="button" onClick={()=>useScene.getState().ungroupSelected()} disabled={!selection.some(id=>isGroup(nodes[id]))}>Ungroup</button>
    </footer>
  </aside>;
}
