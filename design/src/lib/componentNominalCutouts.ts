/** Compatibility entry point for the established placement path. */
import type {ShapeNode} from "../types/scene";
import {componentForPlacement} from "./componentCatalog";
import {cutoutRegistry} from "../extensions/catalog";
import {currentGeometryBackend} from "../extensions/backend";
import type {GeometryBackend,ComponentRecord} from "../extensions/contracts";
import {canPlaceComponent} from "../extensions/registry";
export {nominalDProfile} from "../extensions/plugins/panel-openings.plugin";
export const COMPONENT_CUTTER_DEPTH_MM=24;
export function createComponentCutter(component:ComponentRecord,backend:GeometryBackend=currentGeometryBackend):ShapeNode{
 if(!canPlaceComponent(component))throw Error("Measurements needed — this component has no safe cutout.");
 const cutout=component.mounting.cutout!,plugin=cutoutRegistry.get(cutout.shape);
 if(!plugin||plugin.requiredPrimitives.some(kind=>!backend.primitiveKinds.includes(kind)))
  throw Error("Geometry backend does not support this cutout.");
 const part=plugin.create(JSON.parse(JSON.stringify(cutout)),COMPONENT_CUTTER_DEPTH_MM,backend);
 part.label=component.supplier_sku+" — "+(component.status==="fit_tested"?"FIT TESTED":"NOMINAL UNTESTED")+" opening";
 part.role="hole";part.rotation=[Math.PI/2,0,0];part.position=[0,0,0];
 return part;
}
export function nominalComponentCutter(placementId:string):ShapeNode{
 const component=componentForPlacement(placementId);
 if(!component)throw Error("Measurements needed — this component has no safe cutout.");
 return createComponentCutter(component);
}
