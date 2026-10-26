import {useEffect, useState} from "react";
import type {GroupNode} from "../types/scene";
import {useScene} from "../state/store";
import {editablePattern} from "../lib/editablePattern";

/** Revises a generated pattern in-place, preserving shape and hole IDs. */
export function PatternEditor({group}:{group:GroupNode}) {
  const nodes=useScene(s=>s.project.nodes);
  const edit=useScene(s=>s.editHolePattern);
  const pattern=editablePattern(group,nodes);
  const [diameter,setDiameter]=useState("");
  const [offset,setOffset]=useState("");
  const [result,setResult]=useState("");
  useEffect(()=>{
    setDiameter(pattern?String(pattern.diameter):"");
    setOffset(pattern?String(pattern.offset):"");
    setResult("");
  },[group.id,pattern?.diameter,pattern?.offset]);

  if (!pattern) return null;
  return (
    <div className="rounded-md border border-sky-200 bg-sky-50/50 p-2 text-xs">
      <div className="font-semibold text-neutral-800">Edit mounting holes</div>
      <p className="mt-1 text-[11px] text-neutral-600">
        {pattern.layout==="two"?"2 holes":"4 corner holes"} · measured to hole centres
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-[11px]">
          Diameter (mm)
          <input aria-label="Edit hole diameter" type="number" min="0.5" step="0.5"
            className="w-full rounded border border-neutral-300 bg-white p-1.5 text-xs"
            value={diameter} onChange={e=>setDiameter(e.target.value)}/>
        </label>
        <label className="flex flex-col gap-1 text-[11px]">
          Edge to centre (mm)
          <input aria-label="Edit edge to centre" type="number" min="0.5" step="0.5"
            className="w-full rounded border border-neutral-300 bg-white p-1.5 text-xs"
            value={offset} onChange={e=>setOffset(e.target.value)}/>
        </label>
      </div>
      <button className="mt-2 w-full rounded bg-sky-600 p-2 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-40"
        disabled={!!group.locked} onClick={()=>{
          const message=edit(group.id,Number(offset),Number(diameter));
          setResult(message || "Hole pattern updated. Undo is available.");
        }}>
        Update hole pattern
      </button>
      {result && <p role="status" className="mt-1 text-[11px] text-neutral-600">{result}</p>}
      <p className="mt-1 text-[11px] text-neutral-500">
        Keeps the base and existing hole IDs. Manual hole changes won't be overwritten.
      </p>
    </div>
  );
}
