import config from "./config.json";
import {WORKSHOP_JOBS,type WorkshopJigKind} from "../lib/workshopRouting";
import type {WorkshopBuilderPlugin} from "./workshopContract";
import {createWorkshopRegistry} from "./workshopRegistry";
// Only trusted bundled local plugins. The existing Workshop/store remains host.
// Separate path from cutout plugins, so plugin contract types are never mixed.
const modules=import.meta.glob<WorkshopBuilderPlugin[]>(
 "./workshop-plugins/*.plugin.ts",{eager:true,import:"default"}
);
export const workshopRegistry=createWorkshopRegistry(
 Object.keys(modules).sort().flatMap(key=>modules[key]),
 config.disabledWorkshopJobs
);
/** Built-in editors remain available. Six electronics fixture builders are
 * data-discovered and can be retired without editing their source or saved geometry.
 */
export const workshopJobEnabled=(jobId:WorkshopJigKind):boolean=>
 jobId==="banana"||jobId==="drill"||workshopRegistry.available(jobId);
export const enabledWorkshopJobs=WORKSHOP_JOBS.filter(job=>workshopJobEnabled(job.id));

