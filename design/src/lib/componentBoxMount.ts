/** Exact-SKU documented component aperture on an EXISTING selected hollow box.
 * Reuses the original shell Boolean wrapper and component cutout plugins.
 * No inferred fixing holes, automatic tolerances or new independent solids.
 */
import {identifyShell} from "./boxFitTools";
import {bananaBoxFaceSize,planShellFeature,type BananaBoxFace} from "./workshopTools";
import {bundleConnectorCutters} from "./connectorCutGroup";
import {componentById,isPlaceableNominalComponent} from "./componentCatalog";
import {createComponentCutter} from "./componentNominalCutouts";
import {componentSnapshot} from "../extensions/snapshot";
import {useScene} from "../state/store";
import {isGroup,type Project,type GroupNode,type ShapeNode} from "../types/scene";

export interface ComponentBoxMountOptions {
 componentId:string;
 face:BananaBoxFace;
 offsetX:number;
 offsetY:number;
}
export function componentBoxMountParts(project:Project,rootId:string,o:ComponentBoxMountOptions):ShapeNode[]{
 const component=componentById(o.componentId);
 if(!component||!isPlaceableNominalComponent(component))
  throw new Error("Measurements needed: no documented panel opening for this exact SKU.");
 if(!["front","back","left","right","floor"].includes(o.face))
  throw new Error("Choose a supported enclosure wall.");
 if(!Number.isFinite(o.offsetX)||!Number.isFinite(o.offsetY))
  throw new Error("Enter finite mounting offsets in mm.");
 const sh=identifyShell(rootId,project);
 const cutout=component.mounting.cutout!;
 // The circumscribed D-profile diameter is deliberately used for edge
 // clearance; never assume its clipped flat allows reduced wall margins.
 const w=cutout.shape==="rectangle"?cutout.width_mm:cutout.dxf_uses_nominal_diameter_mm;
 const h=cutout.shape==="rectangle"?cutout.height_mm:cutout.dxf_uses_nominal_diameter_mm;
 const [wallWidth,wallHeight]=bananaBoxFaceSize(sh,o.face);
 const rim=3;
 if(Math.abs(o.offsetX)+w/2>wallWidth/2-rim+1e-8||
    Math.abs(o.offsetY)+h/2>wallHeight/2-rim+1e-8)
  throw new Error("Component opening exceeds this wall; leave at least 3 mm from every edge.");
 const thick=o.face==="floor"?sh.floor:
  (o.face==="front"||o.face==="back"?sh.wallY:sh.wallX);
 if(!Number.isFinite(thick)||thick<0.5||thick>22)
  throw new Error("Unsupported wall thickness for local component opening.");
 const cutter=createComponentCutter(component);
 // Cut through ONLY this wall. The old freely movable 24 mm cutter is unchanged.
 cutter.params={...cutter.params,h:thick+2};
 cutter.label=component.supplier_sku+" documented "+o.face+" opening — nominal";
 if(o.face==="floor"){
  cutter.position=[sh.cx+o.offsetX,sh.cy+o.offsetY,sh.bottom+sh.floor/2];
  cutter.rotation=[0,0,0];
 }else if(o.face==="front"||o.face==="back"){
  cutter.position=[sh.cx+o.offsetX,
   sh.cy+(o.face==="front"?-1:1)*(sh.depth/2-sh.wallY/2),
   sh.bottom+sh.floor+(sh.height-sh.floor)/2+o.offsetY];
  cutter.rotation=[Math.PI/2,0,0];
 }else{
  cutter.position=[
   sh.cx+(o.face==="left"?-1:1)*(sh.width/2-sh.wallX/2),
   sh.cy+o.offsetX,
   sh.bottom+sh.floor+(sh.height-sh.floor)/2+o.offsetY];
  cutter.rotation=[0,Math.PI/2,Math.PI/2];
 }
 return [cutter];
}

export function planComponentBoxMount(project:Project,rootId:string,o:ComponentBoxMountOptions){
 const component=componentById(o.componentId);
 if(!component||!isPlaceableNominalComponent(component))
  throw new Error("Measurements needed for this exact component.");
 const cutters=componentBoxMountParts(project,rootId,o);
 const plan=planShellFeature(project,rootId,cutters,
  "Box with "+component.supplier_sku+" opening");
 const bundled=bundleConnectorCutters(plan.project,plan.selectionId,cutters,
  component.supplier_sku+" nominal wall cutout");
 const nodes={...bundled.project.nodes};
 const group=nodes[bundled.groupId];
 if(!isGroup(group))throw new Error("Component cutter group was not preserved.");
 const annotated:GroupNode={...group,component:componentSnapshot(component.id,Number(cutters[0].params.h))};
 nodes[annotated.id]=annotated;
 return {project:{...bundled.project,nodes},selectionId:plan.selectionId,
  cutoutGroupId:bundled.groupId,cutters:cutters.map(c=>c.id)};
}
export function applyComponentBoxMount(rootId:string,o:ComponentBoxMountOptions):string{
 let selected=rootId;
 useScene.setState(s=>{
  const next=planComponentBoxMount(s.project,rootId,o);
  selected=next.selectionId;
  return {project:next.project,selection:[selected]};
 });
 return selected;
}
