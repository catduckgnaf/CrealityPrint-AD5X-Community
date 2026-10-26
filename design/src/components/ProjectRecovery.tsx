import {useEffect,useRef,useState} from "react";
import {Clock3,Download,HardDrive,RotateCcw,ShieldCheck,Trash2,X} from "lucide-react";
import {useScene} from "../state/store";
import {flushLocal,useCloudSync} from "../state/cloudSync";
import {saveProjectFile,validateProject} from "../lib/projectFile";
import {listCheckpoints,saveCheckpoint,deleteCheckpoint,type Checkpoint} from "../lib/localCheckpoints";

type SaveState="initial"|"saving"|"saved"|"failed";
/** Existing 800-ms IndexedDB autosave remains authoritative.
 * Checkpoints are independent, opt-in restores backed by a current snapshot. */
export function ProjectRecovery(){
  const [open,setOpen]=useState(false);
  const [items,setItems]=useState<Checkpoint[]>([]);
  const [state,setState]=useState<SaveState>("initial");
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const project=useScene(s=>s.project);
  const local=useCloudSync(s=>s.local);
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const checkpointTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const latestProject=useRef(project);
  const lastCheckpoint=useRef(0);
  useEffect(()=>{
    const show=()=>{setOpen(v=>!v);setMessage("");};
    window.addEventListener("ad5x-toggle-recovery",show);
    return ()=>window.removeEventListener("ad5x-toggle-recovery",show);
  },[]);
  useEffect(()=>{
    latestProject.current=project;
    setState("saving");
    if(timer.current)clearTimeout(timer.current);
    timer.current=setTimeout(()=>{
      void flushLocal().then(()=>{
        setState(useCloudSync.getState().local==="ok"?"saved":"failed");
      }).catch(()=>setState("failed"));
    },1500);
    if(checkpointTimer.current)clearTimeout(checkpointTimer.current);
    if(project.rootOrder.length){
      checkpointTimer.current=setTimeout(()=>{
        if(Date.now()-lastCheckpoint.current<180_000)return;
        const captured=latestProject.current;
        void saveCheckpoint(captured,"Automatic").then(()=>{
          lastCheckpoint.current=Date.now();
          if(open)void refresh();
        }).catch(()=>{/* Explicitly don't claim checkpoint success. Existing autosave is unaffected. */});
      },30_000);
    }
    return ()=>{
      if(timer.current)clearTimeout(timer.current);
      if(checkpointTimer.current)clearTimeout(checkpointTimer.current);
    };
  },[project]);
  async function refresh(){
    try{setItems(await listCheckpoints());}
    catch(e){setMessage(e instanceof Error?e.message:"Recovery history unavailable");}
  }
  useEffect(()=>{if(open)void refresh();},[open]);
  const make=async()=>{
    setBusy(true);setMessage("");
    try{
      await saveCheckpoint(useScene.getState().project,"Manual");
      lastCheckpoint.current=Date.now();
      await refresh();setMessage("Checkpoint saved locally.");
    }catch(e){setMessage(e instanceof Error?e.message:"Checkpoint failed");}
    finally{setBusy(false);}
  };
  const restore=async(entry:Checkpoint)=>{
    if(!window.confirm("Restore '"+entry.name+"' from "+new Date(entry.savedAt).toLocaleString()+"? The current design will be checkpointed first."))return;
    setBusy(true);setMessage("");
    try{
      const current=useScene.getState().project;
      if(current.rootOrder.length)await saveCheckpoint(current,"Before restore");
      const candidate=validateProject(entry.project);
      useScene.getState().loadProject(candidate);
      await refresh();
      setMessage("Recovered locally. Save an editable JSON copy when ready.");
    }catch(e){setMessage(e instanceof Error?e.message:"Restore failed");}
    finally{setBusy(false);}
  };
  const erase=async(entry:Checkpoint)=>{
    if(!window.confirm("Delete this recovery checkpoint only?"))return;
    setBusy(true);
    try{await deleteCheckpoint(entry.key);await refresh();}
    catch(e){setMessage(e instanceof Error?e.message:"Delete failed");}
    finally{setBusy(false);}
  };
  return <>
    <button type="button" className={"design-save-indicator "+(state==="failed"?"failed":"")}
      title="Open local save status and recovery checkpoints"
      onClick={()=>setOpen(true)}>
      <HardDrive size={13}/>
      {state==="saving"?"Saving…":state==="saved"?"Saved locally":state==="failed"?"Save issue":"Local autosave"}
    </button>
    {open&&<div className="design-recovery-backdrop" onClick={e=>{if(e.target===e.currentTarget)setOpen(false);}}>
      <section className="design-recovery-panel" role="dialog" aria-modal="true" aria-label="Project recovery">
        <header><ShieldCheck size={19}/><strong>Project recovery</strong>
          <button type="button" aria-label="Close recovery" onClick={()=>setOpen(false)}><X size={17}/></button></header>
        <p>Design's existing IndexedDB autosave stays active. These are separate local snapshots in this browser, not cloud backups.</p>
        <p className="design-recovery-status">Browser save: {state==="saved"?"confirmed":state==="failed"?"could not verify":state==="saving"?"in progress":"checking"} · Storage: {local}</p>
        <div className="design-recovery-actions">
          <button type="button" disabled={busy} onClick={make}><Clock3 size={15}/> Save checkpoint</button>
          <button type="button" onClick={()=>saveProjectFile(useScene.getState().project)}><Download size={15}/> Export editable JSON</button>
        </div>
        <h3>Recent recovery points</h3>
        <div className="design-recovery-scroll">
          {items.length===0&&<p>No checkpoints recorded yet.</p>}
          {items.map(entry=><div className="design-recovery-entry" key={entry.key}>
            <div><strong>{entry.name}</strong><span>{entry.reason} · {new Date(entry.savedAt).toLocaleString()}</span></div>
            <button disabled={busy} type="button" title="Restore" onClick={()=>void restore(entry)}><RotateCcw size={15}/></button>
            <button disabled={busy} type="button" title="Remove checkpoint" onClick={()=>void erase(entry)}><Trash2 size={15}/></button>
          </div>)}
        </div>
        {message&&<p role="status" className="design-recovery-message">{message}</p>}
        <footer>Up to 5 recovery points per project, 20 total. Restore never overwrites a disk file automatically.</footer>
      </section>
    </div>}
  </>;
}
