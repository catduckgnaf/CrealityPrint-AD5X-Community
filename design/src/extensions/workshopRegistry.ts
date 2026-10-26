import {WORKSHOP_EXTENSION_API_VERSION,type WorkshopBuilderPlugin,type WorkshopBuildContext} from "./workshopContract";
const validId=/^[a-z0-9][a-z0-9._-]{0,99}$/;
export function createWorkshopRegistry(plugins:readonly WorkshopBuilderPlugin[],disabledJobs:readonly string[]=[]){
 if(!Array.isArray(disabledJobs)||disabledJobs.some(x=>typeof x!=="string"||!validId.test(x))||
   new Set(disabledJobs).size!==disabledJobs.length)throw Error("Invalid disabled Workshop jobs");
 const byJob=new Map<string,WorkshopBuilderPlugin>();
 const byId=new Set<string>();
 for(const plugin of plugins){
  if(!plugin||plugin.apiVersion!==WORKSHOP_EXTENSION_API_VERSION||
    !validId.test(plugin.id)||!validId.test(plugin.jobId)||
    typeof plugin.version!=="string"||!plugin.version.trim()||
    typeof plugin.build!=="function")throw Error("Invalid Workshop plugin");
  if(byId.has(plugin.id)||byJob.has(plugin.jobId))throw Error("Duplicate Workshop plugin: "+plugin.id);
  byId.add(plugin.id);byJob.set(plugin.jobId,plugin);
 }
 // Reserved disabled IDs cannot be silently reassigned by another plugin.
 const blocked=new Set(disabledJobs);
 return {
  get:(jobId:string)=>blocked.has(jobId)?undefined:byJob.get(jobId),
  available:(jobId:string)=>!blocked.has(jobId)&&byJob.has(jobId),
  enabledJobs:[...byJob.keys()].filter(job=>!blocked.has(job)),
  build:(jobId:string,ctx:WorkshopBuildContext)=>{
   const plugin=blocked.has(jobId)?undefined:byJob.get(jobId);
   if(!plugin)throw Error("Workshop tool is disabled or unavailable: "+jobId);
   const result=plugin.build(ctx);
   if(!result||typeof result.label!=="string"||!result.label.trim()||
    !Array.isArray(result.parts)||!result.parts.length)
    throw Error("Workshop generator returned no editable parts: "+jobId);
   return result;
  }
 };
}
