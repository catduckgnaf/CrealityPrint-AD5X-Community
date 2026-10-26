// @vitest-environment jsdom
import {describe,it,expect} from "vitest";
import {WORKSHOP_SECTIONS,WORKSHOP_JOBS,WORKSHOP_EVENT,COMPONENT_LIBRARY_EVENT,
 isWorkshopSection,isWorkshopJigKind,isWorkshopConnectorType,
 openWorkshopRoute,openComponentLibrary} from "./workshopRouting";

describe("one Workshop and physical-library route contract, shared by existing menus",()=>{
 it("exposes four exact existing sections and eight existing jigs without duplicate IDs",()=>{
  expect(WORKSHOP_SECTIONS.map(t=>t.id)).toEqual(["Tray","Enclosure","Jigs","Organizer"]);
  expect(WORKSHOP_JOBS.map(t=>t.id)).toEqual(["banana","drill","pcb","connector","pogo","wire","cradle","clamp"]);
  expect(new Set(WORKSHOP_JOBS.map(t=>t.id)).size).toBe(WORKSHOP_JOBS.length);
 });
 it("guards invalid navigation values without claiming another tool is supported",()=>{
  for(const id of WORKSHOP_SECTIONS.map(t=>t.id))expect(isWorkshopSection(id)).toBe(true);
  for(const id of WORKSHOP_JOBS.map(t=>t.id))expect(isWorkshopJigKind(id)).toBe(true);
  expect(isWorkshopSection("printer-settings")).toBe(false);
  expect(isWorkshopJigKind("unknown-plugin")).toBe(false);
  expect(isWorkshopJigKind(undefined)).toBe(false);
  expect(isWorkshopConnectorType("banana-type-b-socket")).toBe(true);
  expect(isWorkshopConnectorType("invented-hole")).toBe(false);
 });
 it("routes a screw hardware preset through the existing listener, with unchanged detail",()=>{
  const received:unknown[]=[];
  const listener=(e:Event)=>received.push((e as CustomEvent).detail);
  window.addEventListener(WORKSHOP_EVENT,listener);
  try {
   openWorkshopRoute({tab:"Jigs",jigKind:"drill",hardwareIntent:"screws"});
   expect(received).toEqual([{tab:"Jigs",jigKind:"drill",hardwareIntent:"screws"}]);
  } finally {window.removeEventListener(WORKSHOP_EVENT,listener);}
 });
 it("preserves connector identity and banana preset in a single Workshop event",()=>{
  const received:unknown[]=[];
  const listener=(e:Event)=>received.push((e as CustomEvent).detail);
  window.addEventListener(WORKSHOP_EVENT,listener);
  try {
   openWorkshopRoute({tab:"Jigs",connectorChooser:true,connectorType:"banana",bananaPreset:"mini3-contact",rootId:"box-1"});
   expect(received).toEqual([{tab:"Jigs",connectorChooser:true,connectorType:"banana",bananaPreset:"mini3-contact",rootId:"box-1"}]);
  } finally {window.removeEventListener(WORKSHOP_EVENT,listener);}
 });
 it("routes an exact catalogue selection or a plain open without changing geometry",()=>{
  const received:unknown[]=[];
  const listener=(e:Event)=>received.push((e as CustomEvent).detail);
  window.addEventListener(COMPONENT_LIBRARY_EVENT,listener);
  try {
   openComponentLibrary("mr-c14-switch");
   openComponentLibrary();
   expect(received).toEqual([{id:"mr-c14-switch"},null]);
  } finally {window.removeEventListener(COMPONENT_LIBRARY_EVENT,listener);}
 });
});
