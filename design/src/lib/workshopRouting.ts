/** Shared Workshop navigation contract. This routes into the EXISTING dialog
 * and tool handlers; it does not introduce another Workshop implementation.
 * Keep event names and payloads compatible with older UI callers.
 */
export const WORKSHOP_SECTIONS=[
 {id:"Tray",label:"Trays"},
 {id:"Enclosure",label:"Boxes & lids"},
 {id:"Jigs",label:"Jigs & fixtures"},
 {id:"Organizer",label:"Organizers"},
] as const;
export type WorkshopSection=typeof WORKSHOP_SECTIONS[number]["id"];

export const WORKSHOP_JOBS=[
 {id:"banana",label:"Banana plugs",description:"Put holes into your box"},
 {id:"drill",label:"Drilling template",description:"Guide holes"},
 {id:"pcb",label:"PCB holder",description:"Locate a board"},
 {id:"connector",label:"Connector panel",description:"Mount sockets"},
 {id:"pogo",label:"Pogo-pin guide",description:"Align test pins"},
 {id:"wire",label:"Wire comb",description:"Space wires"},
 {id:"cradle",label:"Connector cradle",description:"Soldering support"},
 {id:"clamp",label:"Adjustable clamp",description:"Experimental"},
] as const;
export type WorkshopJigKind=typeof WORKSHOP_JOBS[number]["id"];

export const WORKSHOP_CONNECTOR_IDS=[
 "banana","db9-male","db9-female","banana-type-b-socket","xt60-panel-03"
] as const;
export type WorkshopConnectorType=typeof WORKSHOP_CONNECTOR_IDS[number];
export const WORKSHOP_EVENT="ad5x-open-workshop";
export const COMPONENT_LIBRARY_EVENT="ad5x-open-component-library";
export interface WorkshopOpenDetail {
 tab?:WorkshopSection;
 jigKind?:WorkshopJigKind;
 connectorChooser?:boolean;
 connectorType?:WorkshopConnectorType;
 bananaPreset?:string;
 rootId?:string;
 enclosureTask?:"posts";
 hardwareIntent?:"heat-insert"|"standoff"|"screws";
}
export function isWorkshopSection(value:unknown):value is WorkshopSection {
 return WORKSHOP_SECTIONS.some(section=>section.id===value);
}
export function isWorkshopJigKind(value:unknown):value is WorkshopJigKind {
 return WORKSHOP_JOBS.some(job=>job.id===value);
}
export function isWorkshopConnectorType(value:unknown):value is WorkshopConnectorType {
 return WORKSHOP_CONNECTOR_IDS.some(id=>id===value);
}
export function openWorkshopRoute(detail:WorkshopOpenDetail):void {
 window.dispatchEvent(new CustomEvent(WORKSHOP_EVENT,{detail}));
}
export function openComponentLibrary(id?:string):void {
 window.dispatchEvent(new CustomEvent(COMPONENT_LIBRARY_EVENT,{detail:id?{id}:undefined}));
}
