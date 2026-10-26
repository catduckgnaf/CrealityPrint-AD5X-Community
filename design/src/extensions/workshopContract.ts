import type {ShapeNode} from "../types/scene";
export const WORKSHOP_EXTENSION_API_VERSION=1 as const;
/** Existing Workshop remains the only host. Plugins build editable geometry;
 * the existing createElectronicsJig action owns state/history/selection.
 * Trusted local code is bundled at build time, not loaded at runtime.
 */
export interface WorkshopBuildContext {
 number:(key:string)=>number;
 values:Readonly<Record<string,string>>;
 pcbMounting:boolean;
 connectorMeasured:boolean;
 pogoMeasured:boolean;
}
export interface WorkshopBuildResult {
 label:string;
 parts:ShapeNode[];
}
export interface WorkshopBuilderPlugin {
 apiVersion:1;
 id:string;
 version:string;
 jobId:string;
 build:(context:WorkshopBuildContext)=>WorkshopBuildResult;
}
