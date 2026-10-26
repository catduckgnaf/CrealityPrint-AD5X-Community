import { useEffect,useState } from "react";
import { Pencil, PenTool, RotateCcw } from "lucide-react";
import type { PrimitiveKind } from "../types/scene";
import { fallbackIcon, releaseIconRenderer, shapeIcon } from "../lib/shapeIcons";
import { useScene } from "../state/store";
import { SHAPE_DRAG_TYPE,CONNECTOR_DRAG_TYPE } from "./Viewport";
import {CONNECTOR_PRESETS} from "../lib/connectorPrefabs";
import {connectorThumbnail} from "../lib/connectorThumbnails";
import {COMPONENTS,catalogPlacementId,catalogThumbnailUrl} from "../lib/componentCatalog";
import {openComponentLibrary} from "../lib/workshopRouting";

const SKETCH_TOOLS = [
  { mode: "scribble", label: "Scribble", icon: Pencil },
  { mode: "extrude", label: "Extrude sketch", icon: PenTool },
  { mode: "revolve", label: "Revolve sketch", icon: RotateCcw },
] as const;

const KINDS: { kind: PrimitiveKind; label: string }[] = [
  { kind: "box", label: "Box" },
  { kind: "cylinder", label: "Cylinder" },
  { kind: "sphere", label: "Sphere" },
  { kind: "cone", label: "Cone" },
  { kind: "torus", label: "Torus" },
  { kind: "wedge", label: "Wedge" },
  { kind: "roof", label: "Roof" },
  { kind: "pyramid", label: "Pyramid" },
  { kind: "hemisphere", label: "Half Sphere" },
  { kind: "polygon", label: "Polygon" },
  { kind: "octagon", label: "Octagon" },
  { kind: "tube", label: "Tube" },
  { kind: "star", label: "Star" },
  { kind: "text", label: "Text" },
  { kind: "gear", label: "Gear" },
  { kind: "thread", label: "Thread" },
  { kind: "slot", label: "Slot" },
  { kind: "hex-pocket", label: "Hex nut pocket" },
  { kind: "countersink", label: "Countersunk hole" },
  { kind: "rounded-box", label: "Rounded box" },
  { kind: "l-bracket", label: "L-bracket" },
  { kind: "peg-mount", label: "Peg mount" },
];

export function Palette() {
  // Icons are rendered during the first render; the GPU context behind
  // them is released as soon as that is done.
  useEffect(() => releaseIconRenderer(), []);
  const setPlacing = useScene((s) => s.setPlacing);
  const placing = useScene((s) => s.placing);
  const setSketchMode = useScene((s) => s.setSketchMode);
  const setPlacingConnector=useScene(s=>s.setPlacingConnector);
  const placingConnector=useScene(s=>s.placingConnector);
  const [category,setCategory]=useState<"basic"|"connectors"|"components">("basic");

  return (
    <div className="design-palette flex w-32 flex-col gap-2 overflow-y-auto border-r border-neutral-200 bg-white p-3">
      <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
        <span className="sr-only">Choose palette category</span>
        <select value={category} onChange={e=>{setCategory(e.target.value as "basic"|"connectors"|"components");setPlacing(null);setPlacingConnector(null);}}
          aria-label="Palette category"
          className="ad5x-palette-category-picker min-w-0 w-full cursor-pointer rounded border border-neutral-500/40 bg-transparent px-1 py-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          <option value="basic">Basic Shapes</option>
          <option value="connectors">Connectors</option>
          <option value="components">Components</option>
        </select>
      </label>
      {category==="basic" ? (
        <div className="grid grid-cols-2 gap-1.5">
          {KINDS.map(({kind,label})=>(
            <button key={kind}
              onClick={()=>setPlacing(placing===kind?null:kind)}
              draggable
              onDragStart={e=>{
                e.dataTransfer.setData(SHAPE_DRAG_TYPE,kind);
                e.dataTransfer.effectAllowed="copy";
              }}
              title={label+" — click, then click the build plate to place"}
              aria-label={label}
              className={`flex aspect-square cursor-grab items-center justify-center rounded-md border hover:bg-neutral-100 active:bg-neutral-200 ${placing===kind?"border-blue-500 bg-blue-50":"border-neutral-200 hover:border-neutral-300"}`}>
              <span className="ad5x-palette-tile">
                <img src={shapeIcon(kind)||fallbackIcon(kind,label)} alt="" draggable={false} className="h-8 w-8"/>
                <span>{label}</span>
              </span>
            </button>
          ))}
        </div>
      ):category==="connectors"?(
        <>
          <div className="grid grid-cols-2 gap-1.5">
            {CONNECTOR_PRESETS.map(({id,label})=>{
              return <button key={id} type="button"
                aria-label={label}
                title={label+" cutout — click, then click in the design to place; drag to place also works"}
                draggable
                onDragStart={e=>{
                  e.dataTransfer.setData(CONNECTOR_DRAG_TYPE,id);
                  e.dataTransfer.effectAllowed="copy";
                }}
                onClick={()=>setPlacingConnector(placingConnector===id?null:id)}
                className={`flex aspect-square cursor-grab items-center justify-center rounded-md border hover:bg-neutral-100 active:bg-neutral-200 ${placingConnector===id?"border-blue-500 bg-blue-50":"border-neutral-200 hover:border-neutral-300"}`}>
                <span className="ad5x-palette-tile">
                  <img src={connectorThumbnail(id)} alt="" draggable={false}
                    width={48} height={44} loading="eager" decoding="async"
                    className="block h-11 w-12 rounded-[5px] object-contain" />
                  <span>{label}</span>
                </span>
              </button>;
            })}
          </div>
          <p className="text-[10px] leading-snug text-neutral-500">
            Movable cutout shapes. Position them like boxes, then group with a solid to cut.
          </p>
        </>
      ):(
        <>
          <div className="grid grid-cols-2 gap-1.5">
            {COMPONENTS.map(c=>{
              const placeId=catalogPlacementId(c.id);
              return <button key={c.id} type="button"
                aria-label={c.supplier_sku+" — "+(placeId?"Nominal cutout, untested":"Measurements needed")}
                title={c.name+" ("+c.supplier_sku+") — "+(placeId?"nominal untested cutout":"geometry not yet measured")}
                draggable={!!placeId}
                onDragStart={e=>{
                  if(!placeId){e.preventDefault();return;}
                  e.dataTransfer.setData(CONNECTOR_DRAG_TYPE,placeId);
                  e.dataTransfer.effectAllowed="copy";
                }}
                onClick={()=>openComponentLibrary(c.id)}
                className="flex aspect-square items-center justify-center rounded-md border border-neutral-500/40 hover:border-emerald-400 hover:bg-neutral-100/10 cursor-pointer">
                <span className="ad5x-palette-tile">
                  <img src={catalogThumbnailUrl(c)} alt="" draggable={false}
                    width={48} height={44} loading="lazy" decoding="async"
                    className="block h-11 w-12 rounded-[5px] object-contain"/>
                  <span className="text-[9px] break-all leading-tight">{c.supplier_sku}</span>
                </span>
              </button>;
            })}
          </div>
          <p className="text-[10px] leading-snug text-neutral-500">
            {COMPONENTS.length} physical parts. Select for dimensions and sources. {COMPONENTS.filter(c=>catalogPlacementId(c.id)).length} have documented openings.
          </p>
        </>
      )}
      <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
        Sketch
      </div>
      <div className="flex flex-col gap-1.5">
        {SKETCH_TOOLS.map(({ mode, label, icon: Icon }) => (
          <button
            key={mode}
            onClick={() => setSketchMode(mode)}
            title={label}
            className="flex items-center gap-2 rounded-md border border-neutral-200 px-2 py-1.5 text-xs hover:border-neutral-300 hover:bg-neutral-100"
          >
            <Icon size={14} strokeWidth={1.8} className="shrink-0 text-neutral-600" />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}