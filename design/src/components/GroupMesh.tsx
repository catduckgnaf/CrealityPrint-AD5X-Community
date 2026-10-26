import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import type { GroupNode } from "../types/scene";
import { nodeRole } from "../types/scene";
import { firstSolidColor, subtreeSignature } from "../lib/csg";
import { evaluateGroupAsync } from "../lib/csgAsync";
import { useManifoldLoaded } from "../lib/manifold";
import { useScene } from "../state/store";
import { handleMeshClick, MeshEdges } from "./ShapeMesh";
import {useSectionClipping} from "./AdvancedViewport";
import {useLabelMove} from "../lib/labelMoveState";
import {previewLabelNodes} from "../lib/labelMoveCore";
import {useTrayRounding} from "../lib/trayRoundingState";
import {trayTarget,trayRoundingNodes} from "../lib/trayRoundingCore";

export function GroupMesh({ node, dimmed = false }: { node: GroupNode; dimmed?: boolean }) {
  const selected = useScene((s) => s.selection.includes(node.id));
  const clipPlanes=useSectionClipping();
  const signature = useScene((s) => subtreeSignature(node, s.project.nodes));
  const nodes = useScene((s) => s.project.nodes);
  const labelPreview=useLabelMove(s=>s.session?.target.groupId===node.id?s.session:null);
  const trayPreview=useTrayRounding(s=>s.session?.id===node.id?s.session:null);
  const renderNodes=useMemo(()=>{
    const labelNodes=labelPreview?previewLabelNodes(labelPreview.target,nodes,labelPreview.dx,labelPreview.dy):nodes;
    if(!trayPreview)return labelNodes;
    try{
      const t=trayTarget(node.id,useScene.getState().project);
      return {...labelNodes,...trayRoundingNodes(t,trayPreview.settings)};
    }catch{return labelNodes;}
  },[nodes,labelPreview,trayPreview,node.id]);
  const renderSignature=signature
    +(labelPreview?"|label:"+labelPreview.dx+":"+labelPreview.dy:"")
    +(trayPreview?"|tray:"+trayPreview.settings.outside+":"+trayPreview.settings.scoop:"");
  const setEditingGroup = useScene((s) => s.setEditingGroup);
  const isTopLevel = useScene((s) => s.project.rootOrder.includes(node.id));
  const isFocusedChild=useScene(s=>{
    const parent=s.editingGroupId?s.project.nodes[s.editingGroupId]:null;
    return !!parent&&"childIds" in parent&&parent.childIds.includes(node.id);
  });
  // Groups cut before the boolean engine finished loading get cut again by it.
  const engineReady = useManifoldLoaded();

  // Re-runs only when a descendant changes, not when the group moves. The
  // boolean runs in a worker; the previous shape stays on screen until the
  // new one is ready, so a big cut never freezes the page or blanks the
  // group. A result for a signature the group has since moved past is
  // dropped.
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);
  useEffect(() => {
    let live = true;
    evaluateGroupAsync(node, renderNodes)
      .then((geo) => {
        if (live) setGeometry(geo);
        else geo?.dispose();
      })
      .catch((err) => {
        console.warn("Could not evaluate group", err);
        if (live) setGeometry(null);
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderSignature, engineReady]);
  useEffect(() => () => geometry?.dispose(), [geometry]);
  // Group Boolean meshes arrive asynchronously. The Inspector may have
  // measured an empty placeholder before the group existed in the scene.
  // Notify the separate DOM React root only AFTER this mesh has committed.
  useEffect(() => {
    if(!geometry)return;
    const timer=window.setTimeout(()=>
      window.dispatchEvent(new CustomEvent("ad5x-node-geometry-ready",{detail:{id:node.id}})),0);
    return ()=>window.clearTimeout(timer);
  },[geometry,node.id]);
  const inherited = useMemo(
    () => firstSolidColor(node, nodes),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [signature],
  );
  const color = node.color ?? inherited;
  // Nothing solid inside: a hole group, drawn like any other hole.
  const isHole = useScene((s) => nodeRole(node, s.project.nodes) === "hole");

  if (node.hidden || !geometry) return null;

  return (
    <mesh
      name={node.id}
      userData={dimmed ? {} : { nodeId: node.id }}
      geometry={geometry}
      position={node.position}
      rotation={node.rotation}
      scale={node.scale}
      raycast={dimmed ? () => null : undefined}
      onClick={dimmed ? undefined : (e) => handleMeshClick(e, node.id)}
      onDoubleClick={
        dimmed || (!isTopLevel&&!isFocusedChild)
          ? undefined
          : (e) => {
              e.stopPropagation();
              if (!useScene.getState().workplaneArmed && !node.locked) {
                setEditingGroup(node.id);
              }
            }
      }
    >
      <meshStandardMaterial
        color={isHole ? "#9aa0a6" : color}
        transparent={isHole || dimmed || !!node.transparent}
        opacity={dimmed ? 0.15 : isHole ? 0.4 : node.transparent ? 0.45 : 1}
        emissive={selected && !dimmed ? "#20af55" : "#000000"}
        emissiveIntensity={selected && !dimmed ? 0.28 : 0}
        roughness={0.65}
        metalness={0.05}
        side={THREE.DoubleSide}
        clippingPlanes={clipPlanes}
      />
      <MeshEdges geometry={geometry} faded={dimmed || isHole} />
    </mesh>
  );
}
