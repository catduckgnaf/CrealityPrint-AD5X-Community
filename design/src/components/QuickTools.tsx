import {useState} from "react";
import {useScene} from "../state/store";
import type {ShapeNode} from "../types/scene";

/** Small task-first panel. No second CAD engine or separate dialog. */
export function QuickTools({node,hideSurface=false}: {node:ShapeNode;hideSurface?:boolean}) {
  const createHolePattern = useScene(s=>s.createHolePattern);
  const cruiseMode = useScene(s=>s.cruiseMode);
  const setCruiseMode = useScene(s=>s.setCruiseMode);
  const [layout,setLayout] = useState<"two"|"four">("four");
  const [diameter,setDiameter] = useState("4");
  const [edge,setEdge] = useState("12");
  const [error,setError] = useState("");

  const primary = "w-full rounded-md bg-sky-600 px-2 py-2 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-40";
  const input = "w-full min-w-0 rounded border border-neutral-300 bg-white px-1.5 py-1 text-xs";
  return (
    <div className="rounded-md border border-neutral-200 bg-white p-2 text-xs">
      <div className="mb-2 font-semibold">Quick tools</div>
      {!hideSurface && <button type="button" disabled={!!node.locked}
        aria-pressed={cruiseMode}
        onClick={()=>{setCruiseMode(!cruiseMode);setError("");}}
        className={"w-full rounded-md border px-2 py-2 text-xs " +
          (cruiseMode?"border-sky-600 bg-sky-100 font-semibold text-sky-900":"border-neutral-300 hover:bg-neutral-100")}>
        {cruiseMode?"✓ Place on surface: on":"Place on surface"}
      </button>}
      {!hideSurface && cruiseMode && (
        <p className="mt-1 text-[11px] leading-snug text-neutral-600">
          Drag the shape onto another shape's face. Release to place it flush.
          Press Esc when finished.
        </p>
      )}
      {node.kind==="box" && (
        <div className="mt-3 flex flex-col gap-2 border-t border-neutral-200 pt-2">
          <div className="font-semibold">Mounting holes</div>
          <div className="flex gap-1">
            {(["two","four"] as const).map(item=>
              <button type="button" key={item} aria-pressed={layout===item}
                onClick={()=>{setLayout(item);setError("");}}
                className={"flex-1 rounded border px-2 py-1.5 text-xs "+
                  (layout===item?"border-sky-500 bg-sky-100 font-semibold":"border-neutral-300 hover:bg-neutral-100")}>
                {item==="two"?"2 holes":"4 corners"}
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-[11px] text-neutral-600">
              Hole diameter (mm)
              <input className={input} type="number" min="0.5" step="0.5" value={diameter}
                onChange={e=>setDiameter(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1 text-[11px] text-neutral-600">
              Edge to centre (mm)
              <input className={input} type="number" min="0.5" step="0.5" value={edge}
                onChange={e=>setEdge(e.target.value)} />
            </label>
          </div>
          <button type="button" disabled={!!node.locked} className={primary}
            onClick={()=>{
              const msg=createHolePattern(node.id,layout,Number(edge),Number(diameter));
              setError(msg);
            }}>
            Create through holes
          </button>
          <p className="text-[11px] leading-snug text-neutral-500">
            Automatically cuts the holes through this rectangular box. One undo step.
          </p>
          {error && <p role="status" className="text-[11px] text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}
