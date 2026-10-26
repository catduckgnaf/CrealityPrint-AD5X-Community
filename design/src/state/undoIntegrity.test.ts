// @vitest-environment jsdom
import {beforeEach,describe,it,expect} from "vitest";
import {useScene,undo,redo} from "./store";
import {emptyProject,isGroup} from "../types/scene";
const snapshot=useScene.getState();
beforeEach(()=>{
 useScene.temporal.getState().clear();
 useScene.setState({
  ...snapshot,project:emptyProject(),selection:[],
  editingGroupId:null,alignAnchors:[],dragInfo:null,smartDup:null,
 });
 useScene.temporal.getState().clear();
});
const assertValid=()=>{
 const s=useScene.getState();
 const ids=s.project.nodes;
 expect(s.selection.every(id=>!!ids[id])).toBe(true);
 expect(s.alignAnchors.every(id=>!!ids[id])).toBe(true);
 if(s.editingGroupId){
  expect(ids[s.editingGroupId]&&isGroup(ids[s.editingGroupId])).toBeTruthy();
 }
};
describe("scene history must never leave scene UI referencing vanished nodes",()=>{
 it("undoing creation clears now-dangling selection and redo restores solid without crashing",()=>{
  useScene.getState().addShape("box");
  const id=useScene.getState().selection[0];
  expect(useScene.getState().project.nodes[id]).toBeDefined();
  undo();
  expect(useScene.getState().project.nodes[id]).toBeUndefined();
  assertValid();
  redo();
  expect(useScene.getState().project.nodes[id]).toBeDefined();
  assertValid();
 });
 it("grouping then undo/redo never retains the removed group as selection",()=>{
  useScene.getState().addShape("box");
  const a=useScene.getState().selection[0];
  useScene.getState().addShape("cylinder");
  const b=useScene.getState().selection[0];
  useScene.getState().setSelection([a,b]);
  useScene.getState().groupSelected();
  const gid=useScene.getState().selection[0];
  expect(isGroup(useScene.getState().project.nodes[gid])).toBe(true);
  undo();
  expect(useScene.getState().project.nodes[gid]).toBeUndefined();
  assertValid();
  redo();
  assertValid();
  expect(isGroup(useScene.getState().project.nodes[gid])).toBe(true);
 });
 it("delete / undo / redo does not lose original solid geometry or leave dead references",()=>{
  useScene.getState().addShape("box");
  const id=useScene.getState().selection[0];
  const original=JSON.stringify(useScene.getState().project.nodes[id]);
  useScene.getState().deleteSelected();
  assertValid();
  undo();
  assertValid();
  expect(JSON.stringify(useScene.getState().project.nodes[id])).toBe(original);
  useScene.getState().setSelection([id]);
  redo();
  assertValid();
  expect(useScene.getState().project.nodes[id]).toBeUndefined();
 });
 it("clears invalid editing group and align anchors when undo removes their group",()=>{
  useScene.getState().addShape("box");
  const a=useScene.getState().selection[0];
  useScene.getState().addShape("box");
  const b=useScene.getState().selection[0];
  useScene.getState().setSelection([a,b]);
  useScene.getState().groupSelected();
  const gid=useScene.getState().selection[0];
  useScene.setState({editingGroupId:gid,alignAnchors:[gid],dragInfo:gid});
  undo();
  assertValid();
  expect(useScene.getState().editingGroupId).toBeNull();
  expect(useScene.getState().dragInfo).toBeNull();
 });
 it("direct project replacement, import, or scene reset also reconciles stale references",()=>{
  useScene.getState().addShape("box");
  const id=useScene.getState().selection[0];
  useScene.setState({alignAnchors:[id],dragInfo:id});
  useScene.setState({project:emptyProject()});
  assertValid();
  expect(useScene.getState().selection).toEqual([]);
  // DragInfo is a user-facing dimension STRING, not a node ID.
  // Direct project updates must not interfere with live gizmo measurement.
  expect(useScene.getState().dragInfo).toBe(id);
 });
});