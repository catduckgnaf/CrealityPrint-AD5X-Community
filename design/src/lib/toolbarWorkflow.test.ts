import { describe, it, expect } from "vitest";
import { toolbarWorkflowAvailability as tools,toolbarWorkflowAvailabilityFromSelection as fromSelection } from "./toolbarWorkflow";
import {makeShape} from "./primitives";

describe("v18.3 contextual toolbar", () => {
  it("keeps geometry operations disabled without a selection", () => {
    expect(tools(0,false,false)).toEqual({holes:false,centre:false,distance:false,spacing:false});
  });
  it("offers create holes for one editable box", () => {
    expect(tools(1,true,false)).toEqual({holes:true,centre:true,distance:false,spacing:false});
  });
  it("offers edit holes for one editable generated pattern", () => {
    expect(tools(1,false,true).holes).toBe(true);
  });
  it("does not offer holes when locked/ineligible", () => {
    expect(tools(1,false,false).holes).toBe(false);
  });
  it("allows exact distance for two shapes, not spacing", () => {
    expect(tools(2,false,false)).toEqual({holes:false,centre:true,distance:true,spacing:false});
  });
  it("allows even spacing for three or more shapes", () => {
    expect(tools(3,false,false)).toEqual({holes:false,centre:false,distance:false,spacing:true});
  });
});

describe("shared selection availability used by BOTH toolbar and command palette",()=>{
 it("keeps all geometry controls disabled without a selection",()=>{
  expect(fromSelection([],{})).toEqual(tools(0,false,false));
 });
 it("offers mounting holes only for the same eligible unlocked box",()=>{
  const box=makeShape("box");
  expect(fromSelection([box.id],{[box.id]:box})).toEqual(tools(1,true,false));
  expect(fromSelection([box.id],{[box.id]:{...box,locked:true}})).toEqual(tools(1,false,false));
 });
 it("does not enable mounting holes on unrelated geometry or absent IDs",()=>{
  const cylinder=makeShape("cylinder");
  expect(fromSelection([cylinder.id],{[cylinder.id]:cylinder}).holes).toBe(false);
  expect(fromSelection(["missing"],{}).holes).toBe(false);
 });
 it("keeps distance and spacing enabled for the existing selection counts",()=>{
  expect(fromSelection(["one","two"],{})).toEqual(tools(2,false,false));
  expect(fromSelection(["one","two","three"],{})).toEqual(tools(3,false,false));
 });
});

