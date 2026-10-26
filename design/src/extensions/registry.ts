import {EXTENSION_API_VERSION,type ComponentPack,type ComponentRecord,type CutoutPlugin} from "./contracts";
const idPattern=/^[a-z0-9][a-z0-9._-]{0,99}$/;
const finitePositive=(v:unknown):v is number=>typeof v==="number"&&Number.isFinite(v)&&v>0&&v<=1000;
export function validCutout(c:ComponentRecord["mounting"]["cutout"]):boolean {
 if(!c||typeof c.dimensions_from!=="string"||!c.dimensions_from.trim())return false;
 if(c.shape==="rectangle")return finitePositive(c.width_mm)&&finitePositive(c.height_mm);
 if(c.shape!=="d_flat_circle")return false;
 const d=c.dxf_uses_nominal_diameter_mm,f=c.dxf_uses_nominal_flat_to_opposite_mm;
 return [d,f,c.diameter_min_mm,c.diameter_max_mm,c.flat_to_opposite_edge_min_mm,c.flat_to_opposite_edge_max_mm].every(finitePositive)
 &&c.diameter_min_mm<=d&&d<=c.diameter_max_mm
 &&c.flat_to_opposite_edge_min_mm<=f&&f<=c.flat_to_opposite_edge_max_mm&&f>d/2&&f<=d;
}
export function validateRecord(c:ComponentRecord):void {
 if(!c||!idPattern.test(c.id)||![c.supplier_sku,c.name,c.supplier,c.category,c.mount_style].every(x=>typeof x==="string"&&x.trim()))
  throw Error("Invalid component identity");
 if((c.enabled!==undefined&&typeof c.enabled!=="boolean")||(c.revision!==undefined&&(typeof c.revision!=="string"||!c.revision.trim())))throw Error("Invalid record availability or revision");
 if(!c.mounting||typeof c.mounting.physical_fit_tested!=="boolean"||typeof c.mounting.printable_cutout_template!=="boolean")
  throw Error("Invalid mounting status: "+c.id);
 if(!["nominal_2d_template_unfit_tested","needs_measurement_before_geometry","measured_unfit_tested","fit_tested"].includes(c.status))
  throw Error("Unknown component status: "+c.id);
 if(!Array.isArray(c.sources)||!c.sources.length||c.sources.some(s=>!s||![s.url,s.source_type,s.supports,s.checked_on].every(x=>typeof x==="string"&&x.trim())))
  throw Error("Component evidence required: "+c.id);
 if(!Array.isArray(c.notes)||!Array.isArray(c.measurements_needed)||[...c.notes,...c.measurements_needed].some(x=>typeof x!=="string"))
  throw Error("Invalid component notes");
 if(c.mounting.cutout!==null&&!validCutout(c.mounting.cutout))throw Error("Invalid cutout: "+c.id);
 if(c.status==="needs_measurement_before_geometry"&&c.mounting.printable_cutout_template)throw Error("Incomplete component cannot enable geometry");
 if(c.status==="fit_tested"){
  const e=c.fit_evidence;
  if(!c.mounting.physical_fit_tested||!e||!e.date||!e.specimen||!finitePositive(e.panel_thickness_mm)||typeof e.notes!=="string")
   throw Error("Physical fit evidence required: "+c.id);
 }else if(c.mounting.physical_fit_tested)throw Error("Physical fit flag conflicts with status: "+c.id);
 if(c.thumbnail&&!/^thumbnails\/[A-Za-z0-9_.-]+\.(svg|png|webp|jpg)$/.test(c.thumbnail))throw Error("Invalid offline thumbnail");
 if(c.reference_diagram&&!/^references\/[A-Za-z0-9_.-]+\.(jpg|png|webp)$/.test(c.reference_diagram))throw Error("Invalid offline mechanical reference path");
}
export function createComponentRegistry(packs:readonly ComponentPack[],config:{apiVersion:number;disabledPacks:readonly string[];disabledComponents:readonly string[]}={apiVersion:1,disabledPacks:[],disabledComponents:[]}){
 if(config.apiVersion!==1||!Array.isArray(config.disabledPacks)||!Array.isArray(config.disabledComponents)||
 [...config.disabledPacks,...config.disabledComponents].some(x=>typeof x!=="string"||!idPattern.test(x)))
  throw Error("Invalid extension configuration");
 const records=new Map<string,{record:ComponentRecord;packId:string;packVersion:string}>();
 const packIds=new Set<string>();
 for(const pack of packs){
  if(pack.apiVersion!==EXTENSION_API_VERSION||!idPattern.test(pack.id)||typeof pack.version!=="string"||!pack.version.trim()||!Array.isArray(pack.components)|| (pack.enabled!==undefined&&typeof pack.enabled!=="boolean"))
   throw Error("Unsupported or invalid component pack");
  if(packIds.has(pack.id))throw Error("Duplicate pack: "+pack.id);
  packIds.add(pack.id);
  for(const record of pack.components){
   validateRecord(record);
   if(records.has(record.id))throw Error("Duplicate component: "+record.id);
   // Reserve disabled IDs too; a second pack may not silently replace old identities.
   records.set(record.id,{record:{...record,enabled:pack.enabled!==false&&record.enabled!==false&&!config.disabledPacks.includes(pack.id)&&!config.disabledComponents.includes(record.id)},packId:pack.id,packVersion:pack.version});
  }
 }
 return {
  entries:[...records.values()],
  components:[...records.values()].filter(x=>x.record.enabled!==false).map(x=>x.record),
  get:(id:string)=>records.get(id),
 };
}
export function createCutoutRegistry(plugins:readonly CutoutPlugin[]){
 const byShape=new Map<string,CutoutPlugin>(),ids=new Set<string>();
 for(const plugin of plugins){
  if(plugin.apiVersion!==EXTENSION_API_VERSION||!idPattern.test(plugin.id)||typeof plugin.version!=="string"||!plugin.version.trim()||typeof plugin.create!=="function"||!Array.isArray(plugin.requiredPrimitives)||!plugin.requiredPrimitives.length)
   throw Error("Invalid cutout plugin");
  if(ids.has(plugin.id)||byShape.has(plugin.shape))throw Error("Duplicate cutout plugin: "+plugin.id);
  ids.add(plugin.id);byShape.set(plugin.shape,plugin);
 }
 return {get:(shape:string)=>byShape.get(shape)};
}
export function canPlaceComponent(c:ComponentRecord):boolean{
 return c.enabled!==false&&c.status!=="needs_measurement_before_geometry"&&
 c.mounting.printable_cutout_template&&validCutout(c.mounting.cutout);
}
