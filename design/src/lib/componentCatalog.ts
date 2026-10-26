/** Backwards-compatible facade. Records and geometry plugins live under extensions/. */
import raw from "../assets/component-library/components.json";
import {componentRegistry,cutoutRegistry} from "../extensions/catalog";
import {canPlaceComponent} from "../extensions/registry";
import type {ComponentRecord} from "../extensions/contracts";
export type {ComponentRecord,ComponentCutout} from "../extensions/contracts";
export const COMPONENT_LIBRARY={...raw,components:componentRegistry.components,component_count:componentRegistry.components.length};
export const COMPONENTS:readonly ComponentRecord[]=componentRegistry.components;
export const componentById=(id:string):ComponentRecord|undefined=>componentRegistry.get(id)?.record;
export const isPlaceableNominalComponent=(c:ComponentRecord):boolean=>
 canPlaceComponent(c)&&!!cutoutRegistry.get(c.mounting.cutout!.shape);
export const COMPONENT_NOMINAL_IDS=COMPONENTS.filter(isPlaceableNominalComponent).map(c=>c.id);
export type ComponentNominalId=string;
export type ComponentPlacementId=`component-${string}`;
export function catalogPlacementId(id:string):ComponentPlacementId|null{
 const c=componentById(id);
 return c&&isPlaceableNominalComponent(c)?`component-${id}`:null;
}
export function componentForPlacement(id:string):ComponentRecord|null{
 if(!id.startsWith("component-"))return null;
 const c=componentById(id.slice("component-".length));
 return c&&catalogPlacementId(c.id)===id?c:null;
}
export function catalogDxfUrl(c:ComponentRecord):string|null{
 const rel=c.mounting.cutout_dxf_file;
 return rel&&/^cutouts\/[A-Za-z0-9_.-]+\.dxf$/.test(rel)?"/component-library/"+rel:null;
}
export function catalogThumbnailUrl(c:ComponentRecord):string{
 return "/component-library/"+(c.thumbnail??"thumbnails/"+c.id+".svg");
}
export function componentStatusLabel(c:ComponentRecord):string{
 return c.status==="fit_tested"?"Fit tested":c.status==="measured_unfit_tested"?"Measured · untested":
 isPlaceableNominalComponent(c)?"Nominal cutout":c.reference_diagram?"Supplier drawing · cutout unknown":"Measurements needed";
}
