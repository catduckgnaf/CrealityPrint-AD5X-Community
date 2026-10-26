import type {ShapeNode,PrimitiveKind} from "../types/scene";
export const EXTENSION_API_VERSION=1 as const;
export type ComponentCutout =
 | {shape:"rectangle";width_mm:number;height_mm:number;dimensions_from:string}
 | {shape:"d_flat_circle";diameter_min_mm:number;diameter_max_mm:number;
 flat_to_opposite_edge_min_mm:number;flat_to_opposite_edge_max_mm:number;
 dxf_uses_nominal_diameter_mm:number;dxf_uses_nominal_flat_to_opposite_mm:number;dimensions_from:string};
export type VerificationStatus="nominal_2d_template_unfit_tested"|"needs_measurement_before_geometry"|"measured_unfit_tested"|"fit_tested";
export interface ComponentRecord {
 id:string;supplier_sku:string;name:string;supplier:string;category:string;mount_style:string;
 manufacturer?:string;attributes?:Record<string,number|string|undefined>;
 enabled?:boolean;revision?:string;thumbnail?:string;reference_diagram?:string;
 mounting:{cutout:ComponentCutout|null;mounting_holes:Record<string,unknown>|null;
 other_verified_dimensions_mm?:Record<string,number>;physical_fit_tested:boolean;
 printable_cutout_template:boolean;model_step_file:string|null;cutout_dxf_file:string|null;};
 status:VerificationStatus;
 sources:{url:string;source_type:string;supports:string;checked_on:string}[];
 measurements_needed:string[];notes:string[];
 fit_evidence?:{date:string;specimen:string;panel_thickness_mm:number;notes:string};
}
export interface ComponentPack {apiVersion:1;id:string;version:string;enabled?:boolean;components:ComponentRecord[];}
/** Plugins return ordinary editable scene nodes; never persist executable code. */
export interface GeometryBackend {
 readonly id:string;
 readonly primitiveKinds:readonly PrimitiveKind[];
 createShape(kind:PrimitiveKind):ShapeNode;
}
export interface CutoutPlugin {
 apiVersion:1;id:string;version:string;shape:ComponentCutout["shape"];
 requiredPrimitives:readonly PrimitiveKind[];
 create(cutout:ComponentCutout,depth:number,backend:GeometryBackend):ShapeNode;
}
export interface ComponentSnapshot {
 apiVersion:1;componentId:string;packId:string;packVersion:string;recordRevision:string;
 supplierSku:string;status:VerificationStatus;cutout:ComponentCutout;
 cutterDepthMm:number;clearanceMm:number; // current placement uses nominal dimensions: zero
}
