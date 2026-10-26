import { useEffect, useState } from "react";
import * as THREE from "three";
import { sceneApi } from "../lib/sceneApi";
import { useScene } from "../state/store";
import { chooseAxis, chooseFixed } from "../lib/layoutDefaults";
import { distanceBetween, type DistanceMode, type SpacingAxis, type SpacingMode } from "../lib/spacing";
import type { SceneNode } from "../types/scene";

/** The same precision engine as before, with a task-first UI. */
export function PrecisionPanel({ids,focus="all"}: {ids: string[];focus?:"all"|"centre"|"distance"|"spacing"}) {
  const nodes = useScene(s => s.project.nodes);
  const showCenter = useScene(s => s.showCenter);
  const setShowCenter = useScene(s => s.setShowCenter);
  const multiSelectMode = useScene(s => s.multiSelectMode);
  const precisionArrange = useScene(s => s.precisionArrange);

  const [mmText, setMmText] = useState("12");
  const [distanceMode, setDistanceMode] = useState<DistanceMode>("center-distance");
  const [marginMode, setMarginMode] = useState<"even-centers" | "even-margins">("even-centers");
  const [referenceOverride, setReferenceOverride] = useState("");
  const [axisOverride, setAxisOverride] = useState<SpacingAxis | null>(null);
  const [message, setMessage] = useState("");
  const [, refreshBounds] = useState(0);
  const idsKey = ids.join("|");

  useEffect(() => {
    setReferenceOverride("");
    setAxisOverride(null);
    setMessage("");
  }, [idsKey]);
  useEffect(() => {
    const immediate = window.setTimeout(() => refreshBounds(v => v + 1), 0);
    const followUp = window.setTimeout(() => refreshBounds(v => v + 1), 120);
    return () => { window.clearTimeout(immediate); window.clearTimeout(followUp); };
  }, [idsKey, nodes]);

  const available = ids
    .filter(id => nodes[id] && !nodes[id].hidden)
    .map(id => ({id, box: sceneApi.getNodeBounds(id), node: nodes[id]}))
    .filter((x): x is {id: string; box: THREE.Box3; node: SceneNode} => !!x.box && !x.box.isEmpty());

  const defaultFixed = chooseFixed(available);
  const referenceId = available.some(x => x.id === referenceOverride) ? referenceOverride : defaultFixed;
  const reference = available.find(x => x.id === referenceId);
  const other = available.find(x => x.id !== referenceId);
  const axis = axisOverride ?? chooseAxis(available, referenceId ?? "");
  const side = reference && other
    && other.box.getCenter(new THREE.Vector3()).getComponent(axis)
      < reference.box.getCenter(new THREE.Vector3()).getComponent(axis)
      ? "minus" as const : "plus" as const;
  const currentDistance = ids.length === 2 && reference && other
    ? distanceBetween(reference.box, other.box, axis, side, distanceMode) : null;
  const center = ids.length === 1 ? available[0]?.box.getCenter(new THREE.Vector3()) : null;
  const eligible = available.length === ids.length && available.length > 1
    && available.every(x => x.id === referenceId || !x.node.locked);

  const friendlyName = (node: SceneNode | undefined) => {
    if (!node) return "Object";
    const raw = "kind" in node ? node.kind : "group";
    return raw.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  };
  const fixedName = friendlyName(reference?.node);

  const arrange = (mode: SpacingMode) => {
    if (!referenceId) return;
    setMessage(precisionArrange(referenceId, mode, axis, Number(mmText), side));
  };
  const field = "w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-xs";
  const secondary = "w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-xs hover:bg-neutral-100 disabled:opacity-40";
  const primary = "w-full rounded-md bg-sky-600 px-2 py-2 text-xs font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="flex flex-col gap-2 rounded-md border border-sky-200 bg-sky-50/50 p-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-neutral-800">Position tools</span>
        <span className="text-[11px] text-neutral-500">{ids.length} selected</span>
      </div>

      {ids.length === 1 ? (
        <>
          {(focus==="all" || focus==="centre") && <button type="button" className={secondary} onClick={() => setShowCenter(!showCenter)}>
            {showCenter ? "Hide centre" : "Show centre"}
          </button>}
          {(focus==="all" || focus==="centre") && center && (
            <p className="text-[11px] text-neutral-600">
              X {center.x.toFixed(1)} · Y {center.y.toFixed(1)} · Z {center.z.toFixed(1)} mm
            </p>
          )}
          <p className="text-[11px] leading-snug text-neutral-600">
            {multiSelectMode
              ? "Now click another shape to include it."
              : "Want to position two shapes? Click Select more in the top toolbar, then click another."}
          </p>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between gap-1 text-[11px]">
            <span className="min-w-0 flex-1 truncate text-neutral-700">
              Fixed: <strong>{fixedName}</strong>
            </span>
            {ids.length === 2 && reference && other && (
              <button type="button"
                className="rounded border border-neutral-300 bg-white px-2 py-1 text-[11px] hover:bg-neutral-100"
                onClick={() => {setReferenceOverride(other.id); setAxisOverride(null); setMessage("");}}>
                Swap
              </button>
            )}
          </div>

          {focus!=="centre" && <div className="flex gap-1" aria-label="Spacing direction">
            {([0, 1] as const).map(a => (
              <button type="button" key={a} onClick={() => {setAxisOverride(a); setMessage("");}}
                aria-pressed={axis === a}
                className={"flex-1 rounded border px-1.5 py-1.5 text-[11px] " +
                  (axis === a ? "border-sky-500 bg-sky-100 font-semibold text-sky-900"
                    : "border-neutral-300 bg-white hover:bg-neutral-100")}>
                {a === 0 ? "Left ↔ Right" : "Front ↔ Back"}
              </button>
            ))}
          </div>}

          {ids.length === 2 ? (
            <>
              {(focus==="all" || focus==="centre") && <button type="button" className={secondary} disabled={!eligible}
                onClick={() => arrange("center-xy")}>
                Centre together
              </button>}
              {(focus==="all" || focus==="distance") && <>
              <div className="my-0.5 border-t border-neutral-200" />
              <label className="flex flex-col gap-1 text-[11px] text-neutral-600">
                Measure between
                <select className={field} value={distanceMode}
                  onChange={e => {setDistanceMode(e.target.value as DistanceMode);setMessage("");}}>
                  <option value="center-distance">Centres (screw hole spacing)</option>
                  <option value="gap">Outside edges (clearance)</option>
                  <option value="edge-center">Edge to centre</option>
                </select>
              </label>
              <label className="flex items-center justify-between gap-2 text-[11px] text-neutral-700">
                Distance
                <span className="flex items-center gap-1">
                  <input aria-label="Distance in mm" className="w-16 rounded border border-neutral-300 bg-white px-1 py-1 text-right text-xs"
                    type="number" min="0" max="1000" step="0.5" value={mmText}
                    onChange={e => setMmText(e.target.value)} />
                  mm
                </span>
              </label>
              <button type="button" className={primary} disabled={!eligible}
                onClick={() => arrange(distanceMode)}>
                Set {mmText || "…"} mm apart
              </button>
              {currentDistance !== null && (
                <p className="text-[11px] text-neutral-500">
                  {currentDistance < 0 && distanceMode === "gap" ? "Overlapping by " : "Currently: "}
                  {Math.abs(currentDistance).toFixed(1)} mm
                </p>
              )}
              </>}
            </>
          ) : (focus==="all" || focus==="spacing") ? (
            <>
              <p className="text-[11px] text-neutral-600">
                Space the other {ids.length - 1} shapes evenly inside the fixed shape.
              </p>
              <label className="flex items-center justify-between gap-2 text-[11px] text-neutral-700">
                From each side
                <span className="flex items-center gap-1">
                  <input aria-label="Margin in mm" className="w-16 rounded border border-neutral-300 bg-white px-1 py-1 text-right text-xs"
                    type="number" min="0" max="1000" step="0.5" value={mmText}
                    onChange={e => setMmText(e.target.value)} />
                  mm
                </span>
              </label>
              <select aria-label="Margin measured from" className={field} value={marginMode}
                onChange={e => {setMarginMode(e.target.value as "even-centers" | "even-margins"); setMessage("");}}>
                <option value="even-centers">To centres of holes/posts</option>
                <option value="even-margins">To outside edges of shapes</option>
              </select>
              <button type="button" className={primary} disabled={!eligible}
                onClick={() => arrange(marginMode)}>
                Space evenly
              </button>
            </>
          ) : null}

          {ids.length > 2 && (
            <details className="text-[11px] text-neutral-500">
              <summary className="cursor-pointer">Change fixed shape</summary>
              <select aria-label="Shape to keep fixed" className={field}
                value={referenceId ?? ""} onChange={e => {setReferenceOverride(e.target.value);setAxisOverride(null);setMessage("");}}>
                {available.map((x, i) => (
                  <option key={x.id} value={x.id}>{i+1}. {friendlyName(x.node)}</option>
                ))}
              </select>
            </details>
          )}
          {message && <p role="status" className="text-[11px] text-sky-800">{message}</p>}
          {!eligible && <p className="text-[11px] text-red-600">Unlock the shapes you want to move, or select visible objects.</p>}
        </>
      )}
    </div>
  );
}
