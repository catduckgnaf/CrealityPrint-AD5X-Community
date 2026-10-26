/**
 * Placeable connector CUTOUT objects (not printable connector hardware).
 * Existing exact panel outlines and cutout diameters are reused. Each object
 * is one hole-only group, so it can be moved/rotated like a Box, then grouped
 * with a solid to subtract the whole assembly in one operation.
 */
import * as THREE from "three";
import {db9PanelProfile,DB9_PANEL} from "./db9BoxMount";
import {roundConnector} from "./roundPanelMount";
import {bananaPlugPreset} from "./bananaPlugPresets";
import {makeShape} from "./primitives";
import {newId} from "./id";
import {evaluateGroup} from "./csg";
import {componentForPlacement,componentStatusLabel,type ComponentPlacementId} from "./componentCatalog";
import {componentSnapshot} from "../extensions/snapshot";
import {nominalComponentCutter,COMPONENT_CUTTER_DEPTH_MM} from "./componentNominalCutouts";
import type {GroupNode,Project,ShapeNode,Vec3} from "../types/scene";

export type ConnectorPrefabId=
 "banana-mini2"|"banana-mini3"|"banana-standard4"|
 "banana-type-b-socket"|"db9-male"|"db9-female"|"xt60-panel-03"|ComponentPlacementId;
export type ConnectorPreset={id:ConnectorPrefabId;label:string};
export const CONNECTOR_PRESETS=[
 {id:"banana-mini2",label:"Banana 2 mm"},
 {id:"banana-mini3",label:"Banana 3 mm"},
 {id:"banana-standard4",label:"Banana 4 mm"},
 {id:"banana-type-b-socket",label:"Banana socket"},
 {id:"db9-male",label:"DB9 male"},
 {id:"db9-female",label:"DB9 female"},
 {id:"xt60-panel-03",label:"XT60 mount"},
] as const satisfies readonly ConnectorPreset[];
export type OriginalConnectorId=typeof CONNECTOR_PRESETS[number]["id"];

export const isConnectorPrefabId=(id:string):id is ConnectorPrefabId=>
  CONNECTOR_PRESETS.some(p=>p.id===id)||componentForPlacement(id)!==null;

const CUTTER_DEPTH=24; // editable via existing transform controls after placement
const roundHole=(diameter:number,label:string):ShapeNode=>{
 const n=makeShape("cylinder");
 n.label=label;
 n.role="hole";
 n.params={r:diameter/2,h:CUTTER_DEPTH,segments:64,bevel:0};
 n.position=[0,0,0];
 // Upright front-wall cutting tool. Can be rotated to any other orientation.
 n.rotation=[Math.PI/2,0,0];
 return n;
};
export function connectorPrefabNodes(id:ConnectorPrefabId):{
 group:GroupNode;parts:ShapeNode[];
}{
 const known=CONNECTOR_PRESETS.find(p=>p.id===id);
 const catalog=componentForPlacement(id);
 if(!known&&!catalog)throw new Error("Unknown connector cutout preset.");
 const parts:ShapeNode[]=[];
 if(catalog){
  parts.push(nominalComponentCutter(id));
 }else if(id==="db9-male"||id==="db9-female"){
  const gender=id==="db9-male"?"male":"female";
  const outline=makeShape("sketch");
  outline.role="hole";outline.label="DB9 "+gender+" D-shaped panel opening";
  outline.params={profile:JSON.stringify(db9PanelProfile(0.2,false)),h:CUTTER_DEPTH};
  outline.position=[0,0,0];
  outline.rotation=[Math.PI/2,0,0];
  parts.push(outline);
  for(const sign of [-1,1]){
   const screw=roundHole(DB9_PANEL.nominalMountDiameter,
    "DB9 "+gender+" screw hole "+(sign<0?1:2));
   screw.position=[sign*DB9_PANEL.pitch/2,0,0];
   parts.push(screw);
  }
 }else if(id==="banana-type-b-socket"||id==="xt60-panel-03"){
  const info=roundConnector(id);
  parts.push(roundHole(info.cutoutDiameter,info.label+" cutout"));
 }else{
  const preset=id==="banana-mini2"?"mini2-contact":
               id==="banana-mini3"?"mini3-contact":"standard4-contact";
  const data=bananaPlugPreset(preset);
  if(!data.holeDiameterMm)throw new Error("Measured diameter is required.");
  parts.push(roundHole(data.holeDiameterMm,data.label+" opening"));
 }
 const group:GroupNode={id:newId(),type:"group",
  label:catalog?catalog.supplier_sku+" — "+componentStatusLabel(catalog)+" cutout":known!.label+" cutout",childIds:parts.map(p=>p.id),
  position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]};
 if(catalog)group.component=componentSnapshot(catalog.id,COMPONENT_CUTTER_DEPTH_MM);
 return {group,parts};
}

type Dimensions={halfW:number;halfD:number;bottom:number};
const sizes=new Map<ConnectorPrefabId,Dimensions>();
/** Same footprint shape as the ordinary placement-ghost engine. */
export function connectorFootprint(id:ConnectorPrefabId):Dimensions{
 const cached=sizes.get(id);if(cached)return cached;
 const {group,parts}=connectorPrefabNodes(id);
 const nodes=Object.fromEntries(parts.map(n=>[n.id,n]));
 const geom=evaluateGroup(group,nodes);
 if(!geom)throw new Error("Connector cutout geometry is unavailable.");
 geom.computeBoundingBox();
 const box=geom.boundingBox;
 if(!box||box.isEmpty())throw new Error("Invalid connector cutter geometry.");
 const result={halfW:Math.max(Math.abs(box.min.x),Math.abs(box.max.x)),
  halfD:Math.max(Math.abs(box.min.y),Math.abs(box.max.y)),
  bottom:-box.min.z};
 geom.dispose();
 sizes.set(id,result);
 return result;
}
/** Geometry for the SAME translucent placement preview as ordinary shapes. */
export function connectorPreviewGeometry(id:ConnectorPrefabId):THREE.BufferGeometry|null{
 const {group,parts}=connectorPrefabNodes(id);
 return evaluateGroup(group,Object.fromEntries(parts.map(n=>[n.id,n])));
}

export function planPlaceConnector(project:Project,id:ConnectorPrefabId,
 position:Vec3,rotation:Vec3):{project:Project;selectionId:string}{
 if(![...position,...rotation].every(Number.isFinite))
  throw new Error("Invalid placement coordinates.");
 const {group,parts}=connectorPrefabNodes(id);
 group.position=[...position];
 group.rotation=[...rotation];
 const nodes={...project.nodes};
 if(nodes[group.id]||parts.some(n=>nodes[n.id]))throw new Error("Connector node collision.");
 for(const n of parts)nodes[n.id]=n;
 nodes[group.id]=group;
 return {project:{...project,nodes,rootOrder:[...project.rootOrder,group.id]},
  selectionId:group.id};
}