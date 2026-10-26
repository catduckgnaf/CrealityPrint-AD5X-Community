import * as THREE from "three";
import { STLExporter } from "three/addons/exporters/STLExporter.js";
import { OBJExporter } from "three/addons/exporters/OBJExporter.js";
import type { Project } from "../types/scene";
import { isGroup, nodeRole } from "../types/scene";
import { buildGeometry } from "./primitives";
import { evaluateGroup } from "./csg";
import { peekEvaluated } from "./csgAsync";
import { asClosedSolid, manifoldLoaded } from "./manifold";
import { downloadBlob, safeFilename } from "./download";
import { bakeTransform, composeMatrix } from "./transform";

export type ExportFormat = "stl" | "obj";

export interface ExportOptions {
  format?: ExportFormat;
  // When set, only these top-level nodes are exported.
  onlyIds?: string[];
}

export interface ExportResult {
  exported: number;
  skippedHoles: number;
}

// Exports top-level nodes: groups as their evaluated CSG solid, lone solid
// shapes as-is. Lone holes are skipped (nothing to cut). All compute is
// client-side; the file downloads straight from the browser.
export interface ExportPayload extends ExportResult {
  blob: Blob | null;
}

/** The same evaluated CSG + world transforms used by the existing file export,
 * but returns a Blob for the native Design -> Prepare handoff. No download
 * and no state mutation. Text, holes, lids and hinges use the original path.
 */
export function serializeSceneModel(project: Project, options: ExportOptions = {}): ExportPayload {
  const { format = "stl", onlyIds } = options;
  const scene = new THREE.Scene();
  let exported = 0;
  let skippedHoles = 0;

  const ids = onlyIds?.length
    ? project.rootOrder.filter((id) => onlyIds.includes(id))
    : project.rootOrder;

  for (const id of ids) {
    const node = project.nodes[id];
    if (!node || node.hidden) continue;

    let geometry: THREE.BufferGeometry | null;
    if (nodeRole(node, project.nodes) === "hole") {
      // Loose holes, single or grouped, have nothing to cut out here.
      skippedHoles++;
      continue;
    } else if (isGroup(node)) {
      // The viewport has usually evaluated this group already, in a worker.
      const known = peekEvaluated(node, project.nodes);
      geometry = known === undefined ? evaluateGroup(node, project.nodes) : known;
    } else {
      geometry = buildGeometry(node);
      // Lone text and SVG shapes get the same outline repair groups do.
      if (geometry && manifoldLoaded()) geometry = asClosedSolid(geometry);
    }
    if (!geometry || !geometry.getAttribute("position")?.count) continue;

    // Bake the node's transform into the vertices rather than setting it on
    // the mesh: the exporters apply a mesh's matrix to positions but never
    // reverse its winding, so a mirrored shape (negative scale) came out
    // inside-out — a cube of −8000 mm³ as a slicer sees it.
    const baked = bakeTransform(
      geometry,
      composeMatrix(node.position, node.rotation, node.scale),
    );
    scene.add(new THREE.Mesh(baked));
    exported++;
  }

  if (exported === 0) return { exported, skippedHoles, blob: null };

  scene.updateMatrixWorld(true);
  let blob: Blob;
  if (format === "obj") {
    const text = new OBJExporter().parse(scene);
    blob = new Blob([text], { type: "model/obj" });
  } else {
    const data = new STLExporter().parse(scene, { binary: true }) as DataView;
    const bytes = new Uint8Array(data.buffer as ArrayBuffer, data.byteOffset, data.byteLength);
    blob = new Blob([bytes], { type: "application/octet-stream" });
  }
  // Temporary meshes are private to this export and must not be retained
  // when the browser is asked to export repeatedly.
  scene.traverse(obj=>{
    if(obj instanceof THREE.Mesh) obj.geometry.dispose();
  });
  return {exported,skippedHoles,blob};
}

/** Existing file export behavior and filenames remain unchanged. */
export function exportSceneStl(project: Project, options: ExportOptions = {}): ExportResult {
  const result=serializeSceneModel(project,options);
  if(result.blob){
    const name=safeFilename(project.name)+"."+(options.format==="obj"?"obj":"stl");
    downloadBlob(result.blob,name);
  }
  return {exported:result.exported,skippedHoles:result.skippedHoles};
}