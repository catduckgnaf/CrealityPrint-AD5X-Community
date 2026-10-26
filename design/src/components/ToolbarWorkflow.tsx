import { useEffect, useState } from "react";
import { AlignHorizontalSpaceAround, CircleDot, Crosshair, MousePointer2, Ruler } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useScene } from "../state/store";
import { isGroup } from "../types/scene";
import { editablePattern } from "../lib/editablePattern";

import { QuickTools } from "./QuickTools";
import { PatternEditor } from "./PatternEditor";
import { PrecisionPanel } from "./PrecisionPanel";
import { toolbarWorkflowAvailabilityFromSelection } from "../lib/toolbarWorkflow";

type Panel = "holes" | "centre" | "distance" | "spacing";

function WorkflowButton({
  label, icon: Icon, disabled, active, onClick,
}: {
  label: string; icon: LucideIcon; disabled?: boolean; active?: boolean; onClick: () => void;
}) {
  return (
    <button type="button"
      title={label} aria-label={label} aria-expanded={active}
      disabled={disabled} onClick={onClick}
      className={"design-icon-button " + (active ? "is-active" : "")}>
      <Icon size={21} strokeWidth={1.65}/>
    </button>
  );
}

/** Task-first shortcuts to existing CAD actions. No replacement geometry engine. */
export function ToolbarWorkflow() {
  const selection = useScene(s => s.selection);
  const nodes = useScene(s => s.project.nodes);
  const multiSelectMode = useScene(s => s.multiSelectMode);
  const setMultiSelectMode = useScene(s => s.setMultiSelectMode);
  const [open, setOpen] = useState<Panel | null>(null);

  const selected = selection.length === 1 ? nodes[selection[0]] : undefined;
  const editableGroup = selected && isGroup(selected) ? editablePattern(selected, nodes) : null;
  const available = toolbarWorkflowAvailabilityFromSelection(selection, nodes);

  useEffect(() => {
    if (open && !available[open]) setOpen(null);
  }, [open, available.holes, available.centre, available.distance, available.spacing]);

  useEffect(()=>{
    const onWorkflow=(event:Event)=>{
      const requested=(event as CustomEvent<Panel>).detail;
      if((requested==="holes"||requested==="centre"||
          requested==="distance"||requested==="spacing") && available[requested]){
        setOpen(requested);
      }
    };
    window.addEventListener("ad5x-open-workflow",onWorkflow);
    return ()=>window.removeEventListener("ad5x-open-workflow",onWorkflow);
  },[available.holes,available.centre,available.distance,available.spacing]);

  const toggle = (panel: Panel) => setOpen(previous => previous === panel ? null : panel);
  const buttonData = [
    { panel: "holes", label: "Mounting holes — create or edit", icon: CircleDot },
    { panel: "centre", label: "Centre objects", icon: Crosshair },
    { panel: "distance", label: "Set exact distance", icon: Ruler },
    { panel: "spacing", label: "Space objects evenly", icon: AlignHorizontalSpaceAround },
  ] as const;

  return (
    <div className="design-workflow-tools relative flex items-center gap-0.5">
      <WorkflowButton
        label="Select more — click multiple objects without holding Shift"
        icon={MousePointer2} active={multiSelectMode}
        onClick={() => {setMultiSelectMode(!multiSelectMode);setOpen(null);}}
      />
      {buttonData.map(({panel,label,icon})=> (
        <WorkflowButton key={panel} label={label} icon={icon}
          disabled={!available[panel]} active={open===panel}
          onClick={()=>toggle(panel)} />
      ))}
      {open && (
        <>
          <button type="button" className="fixed inset-0 z-10 cursor-default" aria-label="Close tool panel"
            onClick={()=>setOpen(null)} />
          <div role="dialog" aria-label={buttonData.find(item=>item.panel===open)?.label}
            className="design-workflow-popover absolute left-0 top-full z-20 mt-2 w-72 max-h-[65vh] overflow-y-auto rounded-md border border-neutral-300 bg-white p-2 shadow-xl">
            {open==="holes" && selected && !isGroup(selected) && selected.kind==="box" &&
              <QuickTools node={selected} hideSurface />}
            {open==="holes" && selected && isGroup(selected) && editableGroup &&
              <PatternEditor group={selected} />}
            {open!=="holes" && <PrecisionPanel ids={selection} focus={open} />}
          </div>
        </>
      )}
    </div>
  );
}
