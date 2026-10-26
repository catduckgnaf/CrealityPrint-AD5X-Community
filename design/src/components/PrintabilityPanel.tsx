import {useEffect,useState} from "react";
import {AlertTriangle,CheckCircle2,ClipboardCheck,HelpCircle,X} from "lucide-react";
import {useScene} from "../state/store";
import {sceneApi} from "../lib/sceneApi";
import {isGroup} from "../types/scene";
import {checkPrintableBounds,type BedIssue} from "../lib/printability";

interface Row {name:string;issues:BedIssue[];}
export function PrintabilityPanel(){
  const [open,setOpen]=useState(false);
  const [rows,setRows]=useState<Row[]>([]);
  const [skipped,setSkipped]=useState(0);
  const [checked,setChecked]=useState(false);
  const bed=useScene(s=>s.bed);
  useEffect(()=>{
    const toggle=()=>{setOpen(v=>!v);setChecked(false);};
    window.addEventListener("ad5x-toggle-preflight",toggle);
    return ()=>window.removeEventListener("ad5x-toggle-preflight",toggle);
  },[]);
  const run=()=>{
    const scene=useScene.getState();
    const results:Row[]=[];
    let unknown=0;
    for(const id of scene.project.rootOrder){
      const node=scene.project.nodes[id];
      if(!node||node.hidden)continue;
      const box=sceneApi.getNodeBounds(id);
      if(!box||box.isEmpty()){unknown++;continue;}
      results.push({
        name:node.label||(isGroup(node)?"Group":node.kind),
        issues:checkPrintableBounds(id,box,scene.bed,220),
      });
    }
    setRows(results);setSkipped(unknown);setChecked(true);
  };
  if(!open)return null;
  const warnings=rows.flatMap(r=>r.issues.filter(i=>i.severity==="warning"));
  const unknowns=rows.flatMap(r=>r.issues.filter(i=>i.severity==="unknown"));
  const clean=checked&&warnings.length===0&&unknowns.length===0&&skipped===0;
  return <aside className="design-print-check" aria-label="Printability checks">
    <header><ClipboardCheck size={18}/><strong>Printability checks</strong>
      <button type="button" onClick={()=>setOpen(false)} aria-label="Close printability"><X size={16}/></button>
    </header>
    <p>Checks displayed model bounds against {bed?bed.join(" × ")+" mm":"unconfigured"} XY and the AD5X 220 mm height limit.</p>
    <button type="button" className="design-check-run" onClick={run}>Check current objects</button>
    {checked&&<>
      {clean?<div className="design-print-ok"><CheckCircle2 size={17}/> No boundary warnings found for {rows.length} visible objects.</div>:
       <div className="design-print-issue"><AlertTriangle size={17}/> {warnings.length} warnings, {unknowns.length+skipped} not fully checked</div>}
      {rows.flatMap((row,i)=>row.issues.map((issue,j)=><p key={i+"-"+j} className="design-print-message">
        <strong>{row.name}:</strong> {issue.message}
      </p>))}
      {skipped>0&&<p className="design-print-message"><HelpCircle size={14}/> {skipped} objects did not have usable rendered bounds. Not marked safe.</p>}
      {rows.length===0&&skipped===0&&<p>No visible objects to check.</p>}
    </>}
    <footer>This is a geometry-position preflight, not a mesh-repair or guaranteed printability test. No objects or slicer settings are changed.</footer>
  </aside>;
}
