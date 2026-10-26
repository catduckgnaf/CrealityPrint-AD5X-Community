import {describe,expect,it} from "vitest";
import palette from "../components/CommandPalette.tsx?raw";
import toolbar from "../components/ToolbarWorkflow.tsx?raw";
import {toolbarWorkflowAvailability} from "./toolbarWorkflow";

describe("v18.7.1 command search uses existing CAD panels",()=>{
 it("discovers the four core modelling workflows by name",()=>{
  for(const name of ["Create or edit mounting holes","Centre selected objects","Set exact distance","Space evenly"]){
   expect(palette).toContain(name);
  }
 });
 it("sends panel requests directly to the existing toolbar components",()=>{
  expect(palette).toContain('new CustomEvent("ad5x-open-workflow"');
  expect(toolbar).toContain('window.addEventListener("ad5x-open-workflow",onWorkflow)');
  expect(toolbar).toContain("available[requested]");
 });
 it("respects existing selection availability gates",()=>{
  expect(toolbarWorkflowAvailability(0,false,false).holes).toBe(false);
  expect(toolbarWorkflowAvailability(1,true,false).holes).toBe(true);
  expect(toolbarWorkflowAvailability(2,false,false).distance).toBe(true);
  expect(toolbarWorkflowAvailability(3,false,false).spacing).toBe(true);
 });
});
