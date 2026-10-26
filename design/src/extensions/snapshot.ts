import type {ComponentSnapshot} from "./contracts";
import {componentRegistry} from "./catalog";
import {validCutout} from "./registry";
export function componentSnapshot(id:string,cutterDepthMm:number):ComponentSnapshot{
 const entry=componentRegistry.get(id),cutout=entry?.record.mounting.cutout;
 if(!entry||!cutout)throw Error("Component snapshot unavailable");
 return {apiVersion:1,componentId:id,packId:entry.packId,packVersion:entry.packVersion,
 recordRevision:entry.record.revision??entry.packVersion,supplierSku:entry.record.supplier_sku,
 status:entry.record.status,cutout:JSON.parse(JSON.stringify(cutout)),cutterDepthMm,clearanceMm:0};
}
/** Validate saved provenance independently of today's catalogue or installed plugins.
 * Geometry remains in ordinary child nodes; never regenerate it on load.
 */
export function parseComponentSnapshot(value:unknown):ComponentSnapshot|undefined{
 if(value===undefined)return undefined;
 if(!value||typeof value!=="object")throw Error("Invalid saved component metadata");
 const s=value as ComponentSnapshot;
 if(s.apiVersion!==1||![s.componentId,s.packId,s.packVersion,s.recordRevision,s.supplierSku].every(x=>typeof x==="string"&&x.length>0&&x.length<=200)
 ||!["nominal_2d_template_unfit_tested","measured_unfit_tested","fit_tested"].includes(s.status)
 ||!validCutout(s.cutout)||!Number.isFinite(s.cutterDepthMm)||s.cutterDepthMm<=0||s.cutterDepthMm>1000
 ||!Number.isFinite(s.clearanceMm)||s.clearanceMm<0||s.clearanceMm>10)
  throw Error("Invalid saved component metadata");
 return {apiVersion:1,componentId:s.componentId,packId:s.packId,packVersion:s.packVersion,
 recordRevision:s.recordRevision,supplierSku:s.supplierSku,status:s.status,
 cutout:JSON.parse(JSON.stringify(s.cutout)),cutterDepthMm:s.cutterDepthMm,clearanceMm:s.clearanceMm};
}
