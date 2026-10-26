import {
  Component,
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { SmartContextMenu, type ContextState } from "./SmartContextMenu";
import {ModelDimensions} from "./ModelDimensions";
import {DimensionEditor} from "./DimensionEditor";
import {LiveBendHandle} from "./LiveBendControls";
import {useLiveBend} from "../lib/liveBendState";
import {useDirectEdit} from "../lib/directEditState";
import {DirectEditHandles} from "./DirectEditControls";
import {LabelMoveHandle} from "./LabelMoveControls";
import {useLabelMove} from "../lib/labelMoveState";
import {useTrayRounding} from "../lib/trayRoundingState";
import {TrayRoundingHandles} from "./TrayRoundingControls";
import {SectionController,ReferencePlane} from "./AdvancedViewport";
import {AlignmentGuides} from "./AlignmentGuides";
import "./smart-context.css";
import { Grid, OrbitControls, OrthographicCamera, PerspectiveCamera, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { useScene } from "../state/store";
import { isGroup, type PrimitiveKind, type SceneNode, type ShapeNode } from "../types/scene";
import { sceneApi, type ViewName } from "../lib/sceneApi";
import {groupPath} from "../lib/groupWorkflow";
import {editableModelRoot} from "../lib/modelPanelTools";
import {isConnectorPrefabId} from "../lib/connectorPrefabs";
import {contextMenuX} from "../lib/contextMenuPlacement";
import {addManualDivider,dividerPlacementFloor,planManualDivider,snapDividerPoint,type DividerPlacementAxis} from "../lib/manualDivider";
import {planPartialDivider,addPartialDivider} from "../lib/workshopTools";
import {finishGroupEdit} from "../lib/groupInteractions";
import {GroupFocusControls} from "./GroupFocusControls";
import { gizmoState } from "../lib/gizmoState";
import { shouldMeasurePointer, shouldCruiseDrag } from "../lib/selectionModifiers";
import { ShapeMesh } from "./ShapeMesh";
import { GroupMesh } from "./GroupMesh";
import { Gizmo } from "./Gizmo";
import { ResizeHandles } from "./ResizeHandles";
import { AlignDots } from "./AlignDots";
import { CenterMarker } from "./CenterMarker";
import { FilletEdges } from "./FilletEdges";
import { FilletBar } from "./FilletBar";
import { MeasureOverlay } from "./MeasureOverlay";
import { RulerOverlay } from "./RulerOverlay";
import { ViewCube } from "./ViewCube";
import { PlacementPreview } from "./PlacementPreview";
import { measureState } from "../lib/measure";
import { SceneRig } from "./SceneRig";
import { placementState } from "../lib/placement";

// CAD/STL convention: Z is up, the workplane is XY.
THREE.Object3D.DEFAULT_UP.set(0, 0, 1);

export const SHAPE_DRAG_TYPE = "application/x-shape-kind";
export const CONNECTOR_DRAG_TYPE = "application/x-connector-cutout";

const VIEWS: { view: ViewName; label: string; key: string }[] = [
  { view: "top", label: "Top", key: "1" },
  { view: "front", label: "Front", key: "2" },
  { view: "right", label: "Right", key: "3" },
  { view: "iso", label: "Iso", key: "4" },
];

function ViewButtons() {
  const ortho = useScene((s) => s.ortho);
  const setOrtho = useScene((s) => s.setOrtho);
  return (
    <div className="absolute left-2 top-2 flex flex-col gap-1">
      {VIEWS.map(({ view, label, key }) => (
        <button
          key={view}
          onClick={() => sceneApi.setView(view)}
          title={`${label} view (${key})`}
          className="w-14 rounded border border-neutral-300 bg-white/90 px-1.5 py-0.5 text-xs text-neutral-600 hover:bg-white"
        >
          {label}
        </button>
      ))}
      <button
        onClick={() => sceneApi.zoomToFit()}
        title="Zoom to fit (F)"
        className="w-14 rounded border border-neutral-300 bg-white/90 px-1.5 py-0.5 text-xs font-medium text-neutral-700 hover:bg-white"
      >
        Fit
      </button>
      <button
        onClick={() => setOrtho(!ortho)}
        title="Toggle orthographic projection"
        className={`w-14 rounded border px-1.5 py-0.5 text-xs ${
          ortho
            ? "border-neutral-700 bg-neutral-800 text-white"
            : "border-neutral-300 bg-white/90 text-neutral-600 hover:bg-white"
        }`}
      >
        Ortho
      </button>
    </div>
  );
}

// Swaps between perspective and orthographic cameras, carrying the viewpoint
// (position, target, apparent zoom) across the switch.
function Cameras() {
  const ortho = useScene((s) => s.ortho);
  const persp = useRef<THREE.PerspectiveCamera>(null);
  const orthoCam = useRef<THREE.OrthographicCamera>(null);
  const size = useThree((s) => s.size);
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const prev = useRef(ortho);

  useEffect(() => {
    if (prev.current === ortho) return;
    prev.current = ortho;
    const from = ortho ? persp.current : orthoCam.current;
    const to = ortho ? orthoCam.current : persp.current;
    if (!from || !to) return;
    const target = controls
      ? controls.target.clone()
      : new THREE.Vector3(0, 0, 0);
    to.up.set(0, 0, 1);
    to.position.copy(from.position);
    if (ortho) {
      const d = from.position.distanceTo(target);
      (to as THREE.OrthographicCamera).zoom =
        size.height / (2 * d * Math.tan(THREE.MathUtils.degToRad(22.5)));
    }
    to.updateProjectionMatrix();
    to.lookAt(target);
  }, [ortho, controls, size.height]);

  // Restore the orbit target after drei rebuilds the controls for the new
  // default camera.
  const savedTarget = useRef(new THREE.Vector3());
  useEffect(() => {
    if (controls) {
      controls.target.copy(savedTarget.current);
      controls.update();
      const save = () => savedTarget.current.copy(controls.target);
      controls.addEventListener("change", save);
      return () => controls.removeEventListener("change", save);
    }
  }, [controls]);

  return (
    <>
      <PerspectiveCamera
        ref={persp}
        makeDefault={!ortho}
        position={[240, -240, 195]}
        up={[0, 0, 1]}
        fov={45}
        near={0.1}
        far={5000}
      />
      <OrthographicCamera
        ref={orthoCam}
        makeDefault={ortho}
        position={[240, -240, 195]}
        up={[0, 0, 1]}
        near={-5000}
        far={5000}
      />
    </>
  );
}

// With one finger doing double duty — orbit the view, but also drag gizmos,
// resize handles, the view cube and measure points — orbit has to stand down
// whenever one of those owns the gesture. On mouse this was handled by using
// different buttons; on touch there's only the one.
function ControlsGate() {
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  useFrame(() => {
    if (!controls) return;
    const busy = gizmoState.busy();
    if (controls.enabled === busy) controls.enabled = !busy;
  });
  return null;
}

type PlateSurface = "printer" | "textured" | "smooth" | "plain";

// Display-only mesh from the original AD5X Creality Print profile, not a CAD node.
// Mesh is positioned below the Z=0 print workplane. Nothing here gets STL-exported.
function AD5XPhysicalPlate() {
  const geometry = useLoader(STLLoader, "/plates/flashforge_ad5x_buildplate_model.stl");
  return (
    <mesh geometry={geometry} position={[0, 0, -2.66]} raycast={() => null}>
      <meshStandardMaterial color="#45474c" roughness={0.9} metalness={0.08} side={THREE.DoubleSide} />
    </mesh>
  );
}

// Grid and original FlashForge artwork are baked into a SINGLE opaque texture.
// Raster minification/mipmaps make the lines stable when zooming and orbiting.
// No parallel transparent planes or 3D grid lines can depth-fight.
function PlateArtwork({ bed, surface }: { bed: [number, number]; surface: PlateSurface }) {
  const textures = useTexture({
    printer: "/plates/printer_stable.png",
    textured: "/plates/textured_stable.png",
    smooth: "/plates/smooth_stable.png",
  });
  useEffect(() => {
    Object.values(textures).forEach((texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.generateMipmaps = true;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.anisotropy = 16;
      texture.needsUpdate = true;
    });
  }, [textures]);
  const useNativeFrame = surface === "printer" && bed[0] === 220 && bed[1] === 220;
  return (
    <group>
      {useNativeFrame && <AD5XPhysicalPlate />}
      <mesh position={[0, 0, -0.08]} raycast={() => null}>
        <planeGeometry args={bed} />
        {surface === "plain" ? (
          <meshBasicMaterial color="#555d68" toneMapped={false} side={THREE.DoubleSide} />
        ) : (
          <meshBasicMaterial map={textures[surface]} toneMapped={false} side={THREE.DoubleSide} />
        )}
      </mesh>
    </group>
  );
}

// Build-plate outline: the printable footprint, so parts can be laid out
// against a real printer's bed.
function BuildPlate() {
  const surface = useScene((s) => s.plateSurface);
  const bed = useScene((s) => s.bed);
  const outline = useMemo(() => {
    if (!bed) return null;
    const [w, d] = bed;
    const pts = [
      new THREE.Vector3(-w / 2, -d / 2, 0),
      new THREE.Vector3(w / 2, -d / 2, 0),
      new THREE.Vector3(w / 2, d / 2, 0),
      new THREE.Vector3(-w / 2, d / 2, 0),
      new THREE.Vector3(-w / 2, -d / 2, 0),
    ];
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: "#35d76b", transparent: true, opacity: 0.85, depthTest: false, depthWrite: false }),
    );
    line.raycast = () => null;
    line.renderOrder = 500;
    return line;
  }, [bed]);
  if (!outline || !bed) return null;
  return (
    <>
      <primitive object={outline} />
      <PlateArtwork bed={bed} surface={surface} />

    </>
  );
}

function WorkplaneGrid() {
  const workplane = useScene((s) => s.workplane);
  const quaternion = useMemo(() => {
    if (!workplane) return null;
    return new THREE.Quaternion().setFromEuler(
      new THREE.Euler(...workplane.rotation, "XYZ"),
    );
  }, [workplane]);
  if (!workplane || !quaternion) return null;
  return (
    <group position={workplane.position} quaternion={quaternion}>
      <Grid
        rotation={[Math.PI / 2, 0, 0]}
        raycast={() => null}
        infiniteGrid
        cellSize={1}
        cellThickness={0.5}
        sectionSize={10}
        sectionThickness={1.2}
        cellColor="#4d7b5b"
        sectionColor="#2eaa61"
        fadeDistance={220}
        fadeStrength={1.2}
        side={THREE.DoubleSide}
      />
    </group>
  );
}

function DragChip() {
  const dragInfo = useScene((s) => s.dragInfo);
  if (!dragInfo) return null;
  return (
    <div className="pointer-events-none absolute right-2 top-2 rounded bg-neutral-800/90 px-2 py-1 font-mono text-xs text-white">
      {dragInfo}
    </div>
  );
}

function renderNode(node: SceneNode, dimmed: boolean) {
  return isGroup(node) ? (
    <GroupMesh key={node.id} node={node} dimmed={dimmed} />
  ) : (
    <ShapeMesh key={node.id} node={node} dimmed={dimmed} />
  );
}

interface MarqueeRect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

// three throws outright when it cannot get a WebGL context, which took the
// whole app down with it. The usual cause is nothing to do with Sculpo: a
// Chrome GPU process that has fallen over, hardware acceleration switched
// off, or too many live WebGL tabs at once. Detect it and say so, rather
// than dying in a render.
// three only discovers a dead context by trying, and probing first is worse
// than useless: a probe canvas holds a context of its own, and browsers cap
// how many can be live at once, so the check can be what pushes the real
// renderer over the limit. Let it try, and catch the failure.
class WebGLBoundary extends Component<
  { children: (conservative: boolean) => ReactNode },
  { error: Error | null; tries: number }
> {
  state = { error: null as Error | null, tries: 0 };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    // First failure is not necessarily fatal. r3f asks for a
    // high-performance context by default, and a machine whose discrete GPU
    // is unavailable or blocklisted can refuse that outright rather than
    // quietly hand back the integrated one. Ask again, undemandingly.
    if (this.state.tries === 0 && /webgl/i.test(error.message)) {
      this.setState({ error: null, tries: 1 });
    }
  }

  render() {
    const { error, tries } = this.state;
    if (error) {
      // Anything not about WebGL belongs to the app-level boundary, which
      // reports it accurately instead of blaming the GPU.
      if (!/webgl/i.test(`${error.message}`)) throw error;
      if (tries > 0) return <NoWebGL />;
      return null; // componentDidCatch is about to retry
    }
    // The key forces a fresh canvas rather than reusing the failed one.
    return <Fragment key={tries}>{this.props.children(tries > 0)}</Fragment>;
  }
}

// Undemanding context settings for the retry: no preference for the discrete
// GPU, no multisampling, and an explicit willingness to accept a slow one.
const FALLBACK_GL = {
  powerPreference: "default" as const,
  antialias: false,
  failIfMajorPerformanceCaveat: false,
};

function NoWebGL() {
  return (
    <div className="flex h-full items-center justify-center bg-neutral-100 p-6">
      <div className="max-w-md space-y-3 rounded-lg border border-neutral-200 bg-white p-5 text-sm shadow-sm">
        <h2 className="text-base font-bold">This browser can&rsquo;t start 3D</h2>
        <p className="text-neutral-600">
          Sculpo draws with WebGL and the browser refused to create a context. Your
          saved work is untouched — this is a display problem, not a data one.
        </p>
        <ul className="list-disc space-y-1 pl-5 text-neutral-600">
          <li>Quit the browser fully and reopen it — a crashed GPU process is the
            most common cause, and it survives a plain reload.</li>
          <li>Close other heavy 3D/video tabs; browsers cap how many WebGL
            contexts can be live at once.</li>
          <li>Check hardware acceleration is on (in Chrome, visit
            <code className="mx-1 rounded bg-neutral-100 px-1">chrome://gpu</code>).</li>
        </ul>
        <button
          onClick={() => window.location.reload()}
          className="rounded bg-blue-600 px-3 py-1.5 text-white hover:bg-blue-700"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

/** Use the same active R3F camera as the CAD viewport, not a second renderer. */
function DividerFloorProjector(){
 const {camera,gl}=useThree();
 useEffect(()=>{
  const previous=sceneApi.dividerFloorPoint;
  sceneApi.dividerFloorPoint=(clientX,clientY,floorZ)=>{
   const rect=gl.domElement.getBoundingClientRect();
   if(!rect.width||!rect.height||!Number.isFinite(floorZ))return null;
   if(clientX<rect.left||clientX>rect.right||clientY<rect.top||clientY>rect.bottom)return null;
   const ndc=new THREE.Vector2(((clientX-rect.left)/rect.width)*2-1,1-((clientY-rect.top)/rect.height)*2);
   const ray=new THREE.Raycaster();
   ray.setFromCamera(ndc,camera);
   const point=new THREE.Vector3();
   if(!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,0,1),-floorZ),point))return null;
   if(![point.x,point.y,point.z].every(Number.isFinite))return null;
   return [point.x,point.y,point.z];
  };
  return ()=>{sceneApi.dividerFloorPoint=previous;};
 },[camera,gl]);
 return null;
}

export function Viewport() {
  const bending=useLiveBend(s=>s.session!==null);
  const directEditing=useDirectEdit(s=>s.session!==null);
  const movingLabel=useLabelMove(s=>s.session!==null);
  const roundingTray=useTrayRounding(s=>s.session!==null);
  const showStandardHandles=!bending&&!directEditing&&!movingLabel&&!roundingTray;
  const nodes = useScene((s) => s.project.nodes);
  const rootOrder = useScene((s) => s.project.rootOrder);
  // AD5X Design: constrain the visible floor grid to the selected build plate.
 const clearSelection = useScene((s) => s.clearSelection);
  const workplaneArmed = useScene((s) => s.workplaneArmed);
  const editingGroupId = useScene((s) => s.editingGroupId);
  const setEditingGroup = useScene((s) => s.setEditingGroup);

  const editingGroup =
    editingGroupId && nodes[editingGroupId] && isGroup(nodes[editingGroupId])
      ? nodes[editingGroupId]
      : null;
  const focusPath=editingGroupId?groupPath({nodes,rootOrder},editingGroupId):[];
  // Keep ancestor group transforms when editing nested groups (lid in a label assembly).
  const focusedNode=(id:string,level:number):ReactNode=>{
    const current=nodes[id];
    if(!current||!isGroup(current))return null;
    return <group key={id} position={current.position} rotation={current.rotation} scale={current.scale}>
      {current.childIds.map(cid=>{
        const child=nodes[cid];if(!child)return null;
        if(level+1<focusPath.length&&cid===focusPath[level+1]&&isGroup(child))
          return focusedNode(cid,level+1);
        return renderNode(child,level+1<focusPath.length);
      })}
    </group>;
  };

  // If the edited group vanished (undo, load), leave edit mode.
  useEffect(() => {
    if(editingGroupId&&(!editingGroup||focusPath.length===0))setEditingGroup(null);
  },[editingGroupId,editingGroup,focusPath.length,setEditingGroup]);

  const [marquee, setMarquee] = useState<MarqueeRect | null>(null);
  const marqueeEndedAt = useRef(0);
  // A pointer that went down on empty canvas but hasn't moved enough to be a
  // marquee yet. Capturing here would swallow the browser's click event (and
  // with it click-to-deselect), so capture only once dragging actually starts.
  const pendingMarquee = useRef<{ x: number; y: number } | null>(null);
  // Touch marquee: press and hold on empty space, then drag.
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressStart = useRef<{ x: number; y: number } | null>(null);
  const cruiseDrag = useRef<string | null>(null);
  const rightStart = useRef<{x:number;y:number;dragged:boolean}|null>(null);
  const [contextMenu,setContextMenu] = useState<ContextState|null>(null);
  const [manualDivider,setManualDivider]=useState<{rootId:string;axis:DividerPlacementAxis;partial?:boolean}|null>(null);
  const [manualDividerError,setManualDividerError]=useState("");
  const [manualSnap,setManualSnap]=useState(true);
  const [manualPreview,setManualPreview]=useState<ShapeNode|null>(null);
  const updateManualPreview=(clientX:number,clientY:number,shift=false)=>{
   if(!manualDivider)return null;
   try{
    const project=useScene.getState().project;
    const z=dividerPlacementFloor(project,manualDivider.rootId);
    const hit=sceneApi.dividerFloorPoint(clientX,clientY,z);
    if(!hit){setManualPreview(null);return null;}
    const point=snapDividerPoint(project,manualDivider.rootId,manualDivider.axis,
      [hit[0],hit[1]],manualSnap&&!shift);
    const planned=manualDivider.partial?planPartialDivider(project,manualDivider.rootId,manualDivider.axis,point):
      planManualDivider(project,manualDivider.rootId,manualDivider.axis,point);
    setManualPreview(planned);setManualDividerError("");
    return point;
   }catch(err){
    setManualPreview(null);
    setManualDividerError(err instanceof Error?err.message:"Choose an inside position.");
    return null;
   }
  };
  useEffect(()=>{
   const start=(event:Event)=>{
    const detail=(event as CustomEvent<{rootId:string;axis:DividerPlacementAxis;partial?:boolean}>).detail;
    if(!detail||!["x","y"].includes(detail.axis))return;
    try{
     const state=useScene.getState();
     if(state.placing||state.workplaneArmed||state.measureMode||state.rulerPlacing||
        state.editingGroupId||gizmoState.busy())throw new Error("Finish the active editing tool before placing a divider.");
     dividerPlacementFloor(state.project,detail.rootId);
     setManualDivider({rootId:detail.rootId,axis:detail.axis,partial:!!detail.partial});
     setManualPreview(null);
     setManualDividerError("");
     setContextMenu(null);
    }catch(err){setManualDivider(null);setManualDividerError(err instanceof Error?err.message:"Unable to start divider placement.");}
   };
   const escape=(event:KeyboardEvent)=>{
    if(event.key==="Escape"&&manualDivider){
     event.preventDefault();event.stopImmediatePropagation();
     setManualDivider(null);setManualDividerError("");setManualPreview(null);
    }
   };
   window.addEventListener("ad5x-manual-divider",start);
   window.addEventListener("keydown",escape,true);
   return ()=>{
    window.removeEventListener("ad5x-manual-divider",start);
    window.removeEventListener("keydown",escape,true);
   };
  },[manualDivider]);
  const wrapper = useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(!contextMenu) return;
    const onEscape=(event:KeyboardEvent)=>{
      if(event.key==="Escape"){
        event.preventDefault();
        event.stopImmediatePropagation();
        setContextMenu(null);
      }
    };
    window.addEventListener("keydown",onEscape,true);
    return ()=>window.removeEventListener("keydown",onEscape,true);
  },[contextMenu]);
  const cruiseMode = useScene((s) => s.cruiseMode);
  const placing = useScene((s) => s.placing);
  const placingConnector=useScene(s=>s.placingConnector);
  const measureMode = useScene((s) => s.measureMode);
  const rulerPlacing = useScene((s) => s.rulerPlacing);

  const onPointerDown = (e: React.PointerEvent) => {
    if(e.button===2 && e.target instanceof HTMLCanvasElement) {
      rightStart.current={x:e.clientX,y:e.clientY,dragged:false};
      setContextMenu(null);
      return;
    }
    if(e.button===0) setContextMenu(null);
    if (e.button !== 0) return;
    if (!(e.target instanceof HTMLCanvasElement)) return;
    // A gizmo, resize handle, or the view cube owns this press — no viewport
    // tool should also react to it.
    if (gizmoState.busy()) return;
    const s = useScene.getState();
    if (s.rulerPlacing && !e.shiftKey && !s.multiSelectMode) {
      const snap = sceneApi.measureSnap(e.clientX, e.clientY);
      if (snap) s.setRulerOrigin([snap.point[0], snap.point[1]]);
      return;
    }
    if (shouldMeasurePointer(s.measureMode, e.shiftKey || s.multiSelectMode)) {
      const snap = sceneApi.measureSnap(e.clientX, e.clientY);
      if (snap) {
        const p = new THREE.Vector3(...snap.point);
        if (!measureState.p1 || measureState.p2) {
          // First point, or starting a fresh measurement after a finished one.
          measureState.p1 = p;
          measureState.p2 = null;
        } else {
          measureState.p2 = p;
        }
      }
      return;
    }
    if(s.placingConnector){
      sceneApi.placementMove(e.clientX,e.clientY);
      if(placementState.valid){
        const eu=new THREE.Euler().setFromQuaternion(placementState.quaternion,"XYZ");
        s.placeConnectorAt(s.placingConnector,
          placementState.position.toArray() as [number,number,number],
          [eu.x,eu.y,eu.z]);
        placementState.valid=false;
        gizmoState.lastInteractionEnd=performance.now();
      }
      return;
    }
    if (s.placing) {
      // On touch there's no hover to have positioned the ghost, so resolve the
      // drop point from this very press before committing.
      if (e.pointerType !== "mouse") sceneApi.placementMove(e.clientX, e.clientY);
      if (placementState.valid) {
        const eu = new THREE.Euler().setFromQuaternion(placementState.quaternion, "XYZ");
        s.placeShapeAt(
          s.placing,
          placementState.position.toArray() as [number, number, number],
          [eu.x, eu.y, eu.z],
        );
        placementState.valid = false;
        gizmoState.lastInteractionEnd = performance.now();
      }
      return;
    }
    if (s.workplaneArmed) return;
    if (shouldCruiseDrag(s.cruiseMode, !!s.editingGroupId, e.shiftKey || s.multiSelectMode)) {
      const id = sceneApi.hitNodeAt(e.clientX, e.clientY);
      if (id && s.project.nodes[id] && !s.project.nodes[id].locked) {
        s.setSelection([id]);
        cruiseDrag.current = id;
        gizmoState.handleActive = true;
        wrapper.current?.setPointerCapture(e.pointerId);
        return;
      }
    }
    if (sceneApi.hitTestNodes(e.clientX, e.clientY)) return;
    if (e.pointerType !== "mouse") {
      // On touch a one-finger drag orbits, so the marquee needs a gesture that
      // can't be confused with it: press and hold still, then drag. Any
      // movement before the hold completes means the user meant to orbit.
      const start = { x: e.clientX, y: e.clientY };
      const pointerId = e.pointerId;
      longPressStart.current = start;
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
      longPressTimer.current = setTimeout(() => {
        longPressTimer.current = null;
        longPressStart.current = null;
        // Take the gesture away from orbit for its remainder.
        gizmoState.handleActive = true;
        setMarquee({ x1: start.x, y1: start.y, x2: start.x, y2: start.y });
        try {
          wrapper.current?.setPointerCapture(pointerId);
        } catch {
          /* pointer already gone */
        }
      }, 400);
      return;
    }
    pendingMarquee.current = { x: e.clientX, y: e.clientY };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if(rightStart.current && (e.buttons & 2)) {
      const dx=e.clientX-rightStart.current.x;
      const dy=e.clientY-rightStart.current.y;
      if(Math.hypot(dx,dy)>6) rightStart.current.dragged=true;
    }
    const sNow = useScene.getState();
    if (sNow.measureMode) {
      const snap = sceneApi.measureSnap(e.clientX, e.clientY);
      measureState.hover = snap ? new THREE.Vector3(...snap.point) : null;
      measureState.hoverSnapped = !!snap?.snapped;
      return;
    }
    if (sNow.placing||sNow.placingConnector) {
      sceneApi.placementMove(e.clientX, e.clientY);
      return;
    }
    if (cruiseDrag.current) {
      sceneApi.cruiseMove(cruiseDrag.current, e.clientX, e.clientY);
      return;
    }
    // Any real movement during the hold means it was an orbit, not a marquee.
    const holdStart = longPressStart.current;
    if (holdStart && longPressTimer.current) {
      if (
        Math.abs(e.clientX - holdStart.x) >= 8 ||
        Math.abs(e.clientY - holdStart.y) >= 8
      ) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
        longPressStart.current = null;
      }
    }
    const pending = pendingMarquee.current;
    if (pending && !marquee) {
      if (Math.abs(e.clientX - pending.x) >= 4 || Math.abs(e.clientY - pending.y) >= 4) {
        setMarquee({ x1: pending.x, y1: pending.y, x2: e.clientX, y2: e.clientY });
        try {
          wrapper.current?.setPointerCapture(e.pointerId);
        } catch {
          // capture is an optimization; the drag still works without it
        }
      }
      return;
    }
    setMarquee((m) => (m ? { ...m, x2: e.clientX, y2: e.clientY } : m));
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pendingMarquee.current = null;
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    longPressStart.current = null;
    // A touch marquee borrowed the gesture from orbit; hand it back.
    if (marquee && e.pointerType !== "mouse") gizmoState.handleActive = false;
    if (cruiseDrag.current) {
      const id = cruiseDrag.current;
      cruiseDrag.current = null;
      gizmoState.handleActive = false;
      gizmoState.lastInteractionEnd = performance.now();
      wrapper.current?.releasePointerCapture(e.pointerId);
      const t = sceneApi.readNodeTransform(id);
      if (t) useScene.getState().setTransform(id, t.position, t.rotation, t.scale);
      return;
    }
    if (!marquee) return;
    try {
      wrapper.current?.releasePointerCapture(e.pointerId);
    } catch {
      // never captured; nothing to release
    }
    const { x1, y1, x2, y2 } = marquee;
    setMarquee(null);
    marqueeEndedAt.current = performance.now();
    const picked = sceneApi.pickInRect(x1, y1, x2, y2);
    const s = useScene.getState();
    s.setSelection(e.shiftKey ? [...new Set([...s.selection, ...picked])] : picked);
  };

  const marqueeStyle = useMemo(() => {
    if (!marquee || !wrapper.current) return null;
    const host = wrapper.current.getBoundingClientRect();
    return {
      left: Math.min(marquee.x1, marquee.x2) - host.left,
      top: Math.min(marquee.y1, marquee.y2) - host.top,
      width: Math.abs(marquee.x2 - marquee.x1),
      height: Math.abs(marquee.y2 - marquee.y1),
    };
  }, [marquee]);

  return (
    <div
      ref={wrapper}
      className="design-viewport relative h-full w-full"
      style={{ cursor: workplaneArmed || placing || placingConnector ? "crosshair" : undefined }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onContextMenu={(e)=>{
        if(!(e.target instanceof HTMLCanvasElement)) return;
        e.preventDefault();
        const press=rightStart.current;
        rightStart.current=null;
        if(press?.dragged || useScene.getState().modalOpen) return;
        const rect=wrapper.current?.getBoundingClientRect();
        if(!rect) return;
        const state=useScene.getState();
        const hit=sceneApi.hitNodeAt(e.clientX,e.clientY);
        let ids:string[]=[];
        if(hit && state.project.nodes[hit] && !state.project.nodes[hit].hidden) {
          ids=state.selection.includes(hit) ? [...state.selection] : [hit];
          if(ids.length!==state.selection.length || ids.some((id,i)=>id!==state.selection[i]))
            state.setSelection(ids);
        }
        // Reserve room for Connector type -> Banana plugs -> Size -> item
        // BEFORE showing the root menu. On this viewport, 4 panels fit
        // when the root shifts slightly left; allowing only the final
        // panel to flip made it overlap the first flyout (v19.5.39).
        const hasConnector=ids.length===1&&(()=>{
          try{editableModelRoot(state.project,ids);return true;}catch{return false;}
        })();
        const maxY=Math.max(6,rect.height-460);
        const x=contextMenuX(e.clientX-rect.left,rect.width,hasConnector);
        const y=Math.max(6,Math.min(e.clientY-rect.top,maxY));
        setContextMenu({kind:ids.length?"shape":"empty",ids,x,y,clientX:e.clientX,clientY:e.clientY});
      }}
      // A touch the browser takes over (a scroll, a system gesture) ends
      // the same way a lifted finger does, so no marquee or cruise drag is
      // left waiting for a release that never comes.
      onPointerCancel={onPointerUp}
      onDoubleClick={(e) => {
        if (
          editingGroupId &&
          e.target instanceof HTMLCanvasElement &&
          !sceneApi.hitTestNodes(e.clientX, e.clientY)
        ) {
          finishGroupEdit();
        }
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes(SHAPE_DRAG_TYPE)||e.dataTransfer.types.includes(CONNECTOR_DRAG_TYPE)) e.preventDefault();
      }}
      onDrop={(e) => {
        const kind=e.dataTransfer.getData(SHAPE_DRAG_TYPE);
        const connector=e.dataTransfer.getData(CONNECTOR_DRAG_TYPE);
        if(!kind&&!connector)return;
        e.preventDefault();
        if(kind)sceneApi.dropShape(kind as PrimitiveKind,e.clientX,e.clientY);
        else if(isConnectorPrefabId(connector))sceneApi.dropConnector(connector,e.clientX,e.clientY);
      }}
    >
      <WebGLBoundary>
        {(conservative) => (
      <Canvas
        gl={conservative ? FALLBACK_GL : undefined}
        onPointerMissed={(e) => {
          // Only a plain left-click on the canvas itself deselects. Clicks on
          // DOM overlays (dimension pills etc.) bubble here too — ignore them,
          // as well as the contextmenu/right-button events orbiting ends with.
          if (!(e.target instanceof HTMLCanvasElement)) return;
          if (e.type !== "click" || e.button !== 0) return;
          // A finished marquee or handle drag also ends with a click on empty
          // canvas — don't let that wipe the selection it just made.
          if (performance.now() - marqueeEndedAt.current < 300) return;
          if (performance.now() - gizmoState.lastInteractionEnd < 300) return;
          const s = useScene.getState();
          if (s.workplaneArmed) {
            // Workplane dropped on empty space resets to the floor.
            s.setWorkplane(null);
            return;
          }
          if (s.alignMode) {
            s.setAlignMode(false);
            return;
          }
          // Rounding: a click that misses every line is a near miss, not a
          // request to stop. The tool ends from its bar, the toolbar, E or Esc.
          if (s.filletMode) return;
          if (s.measureMode) return; // clicks are measurement points
          if(s.editingGroupId){
            finishGroupEdit();
            return;
          }
          clearSelection();
        }}
        className="bg-neutral-100"
      >
        <Cameras />
        <DividerFloorProjector />
        {manualPreview && <mesh key="manual-divider-ghost" position={manualPreview.position} raycast={()=>null}>
          <boxGeometry args={[Number(manualPreview.params.w),Number(manualPreview.params.d),Number(manualPreview.params.h)]}/>
          <meshBasicMaterial color="#36d399" transparent opacity={0.42} depthWrite={false} toneMapped={false}/>
        </mesh>}
        <ambientLight intensity={0.7} />
        <directionalLight position={[80, -60, 120]} intensity={1.4} />
        <directionalLight position={[-60, 80, 40]} intensity={0.4} />


        <SectionController />
        <BuildPlate />
        <ReferencePlane />
        <WorkplaneGrid />

        {rootOrder.map((id) => {
          const node = nodes[id];
          if (!node) return null;
          if(editingGroup&&focusPath[0]===id)return focusedNode(id,0);
          return renderNode(node, editingGroup !== null);
        })}

        <ViewCube />
        {showStandardHandles && <Gizmo />}
        {showStandardHandles && <ResizeHandles />}
        {showStandardHandles && <AlignDots />}
        {showStandardHandles && <AlignmentGuides />}
        {showStandardHandles && <ModelDimensions />}
        <LiveBendHandle />
        <TrayRoundingHandles />
        <DirectEditHandles />
        <LabelMoveHandle />
        <CenterMarker />
        <FilletEdges />
        <MeasureOverlay />
        <RulerOverlay />
        <PlacementPreview />
        <ControlsGate />
        <OrbitControls
          makeDefault
          // Zoom towards whatever is under the pointer rather than towards the
          // orbit target. Zooming at the centre means every close-up starts
          // with a scroll and then a pan to put the thing back on screen; this
          // keeps the point you aimed at where you aimed it, which is what
          // every other CAD tool does.
          zoomToCursor
          mouseButtons={{
            LEFT: undefined,
            MIDDLE: THREE.MOUSE.PAN,
            RIGHT: THREE.MOUSE.ROTATE,
          }}
          // Touch: one finger orbits (there's no right button to orbit with),
          // two fingers pinch-zoom and pan. One-finger drags on a shape or a
          // handle are handled by ControlsGate disabling orbit for them.
          touches={{
            ONE: THREE.TOUCH.ROTATE,
            TWO: THREE.TOUCH.DOLLY_PAN,
          }}
        />
        <SceneRig />
      </Canvas>
        )}
      </WebGLBoundary>
      <DimensionEditor />
      <ViewButtons />
      <DragChip />
      {marqueeStyle && (
        <div
          className="pointer-events-none absolute border border-blue-500 bg-blue-500/10"
          style={marqueeStyle}
        />
      )}
      {workplaneArmed && !placing && (
        <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded bg-neutral-800/90 px-3 py-1 text-xs text-white">
          Click a face to set the workplane — click empty space to reset
        </div>
      )}
      {placing && (
        <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded bg-neutral-800/90 px-3 py-1 text-xs text-white">
          Click to place the shape — it snaps against nearby objects · Esc to cancel
        </div>
      )}
      {placingConnector && (
        <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded bg-neutral-800/90 px-3 py-1 text-xs text-white">
          Click to place connector cutout, then move / rotate it like a box · Esc to cancel
        </div>
      )}      {rulerPlacing && (
        <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded bg-neutral-800/90 px-3 py-1 text-xs text-white">
          Click to drop the ruler — corners snap · then select a shape to see its size and offsets
        </div>
      )}
      {measureMode && (
        <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded bg-neutral-800/90 px-3 py-1 text-xs text-white">
          Measure: click two points — corners and midpoints snap · M or Esc to exit
        </div>
      )}
      {cruiseMode && !workplaneArmed && !placing && (
        <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded bg-neutral-800/90 px-3 py-1 text-xs text-white">
          Place on surface: drag a shape onto another face · Esc when finished — C or Esc to exit
        </div>
      )}
      <FilletBar />
      {manualDivider && <>
       <div className="absolute inset-0 z-[80] cursor-crosshair"
        aria-label="Click the tray floor to place divider"
        onPointerDown={e=>e.stopPropagation()}
        onPointerMove={e=>{updateManualPreview(e.clientX,e.clientY,e.shiftKey);}}
        onPointerLeave={()=>setManualPreview(null)}
        onContextMenu={e=>{e.preventDefault();setManualDivider(null);setManualDividerError("");setManualPreview(null);}}
        onClick={e=>{
         e.preventDefault();e.stopPropagation();
         const {rootId,axis,partial}=manualDivider;
         try{
          const point=updateManualPreview(e.clientX,e.clientY,e.shiftKey);
          if(!point)throw new Error("Choose a valid point on the inside floor.");
          const nextRoot=partial?addPartialDivider(rootId,axis,point):addManualDivider(rootId,axis,point);
          setManualDivider({rootId:nextRoot,axis,partial});setManualPreview(null);setManualDividerError("");
         }catch(err){setManualDividerError(err instanceof Error?err.message:"Could not place divider.");}
        }}/>
       <div className="absolute bottom-12 left-1/2 z-[81] -translate-x-1/2 rounded-lg border border-emerald-600 bg-neutral-900/95 px-4 py-3 text-xs text-white shadow-xl"
         role="status" onPointerDown={e=>e.stopPropagation()}>
        <span>Place {manualDivider.partial?"partial ":""}{manualDivider.axis==="x"?"lengthwise":"widthwise"} dividers · click repeatedly (1.6 mm)</span>
        {manualPreview&&<span className="ml-2 font-mono text-emerald-300">
          {manualDivider.axis.toUpperCase()} {manualPreview.position[manualDivider.axis==="x"?0:1].toFixed(1)} mm
        </span>}
        <label className="ml-3 inline-flex cursor-pointer items-center gap-1">
          <input type="checkbox" checked={manualSnap} onChange={e=>setManualSnap(e.target.checked)}/> Snap 1 mm
        </label>
        <span className="ml-2 text-neutral-400">Shift: temporarily free</span>
        <button type="button" className="ml-3 rounded bg-emerald-700 px-2 py-1 hover:bg-emerald-600"
         onClick={()=>{setManualDivider(null);setManualDividerError("");setManualPreview(null);}}>Done · Esc</button>
        {manualDividerError&&<p className="mt-2 text-amber-300" role="alert">{manualDividerError}</p>}
       </div>
      </>}
      {!manualDivider&&manualDividerError&&<div className="absolute bottom-12 left-1/2 z-[70] -translate-x-1/2 rounded bg-neutral-900/95 px-3 py-2 text-xs text-amber-300" role="alert"
       onClick={()=>setManualDividerError("")}>{manualDividerError} · click to dismiss</div>}
      {contextMenu && <>
        <button type="button" className="absolute inset-0 z-[90] cursor-default"
          aria-label="Dismiss context menu" onClick={()=>setContextMenu(null)}/>
        <div className="absolute z-[91]" style={{left:contextMenu.x,top:contextMenu.y}}>
          <SmartContextMenu
            key={contextMenu.x+"-"+contextMenu.y+"-"+contextMenu.ids.join(",")}
            menu={contextMenu} close={()=>setContextMenu(null)} />
        </div>
      </>}
      <GroupFocusControls />
    </div>
  );
}