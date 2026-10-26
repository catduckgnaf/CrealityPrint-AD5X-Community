// @vitest-environment jsdom
import {describe,it,expect,beforeEach,afterEach} from "vitest";
import {act,createElement} from "react";
import {createRoot,type Root} from "react-dom/client";
import {useShortcuts} from "./useShortcuts";
import {useScene} from "../state/store";
import {useAuth} from "../state/auth";
import {emptyProject} from "../types/scene";

(globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
let host:HTMLDivElement,root:Root;
const Hook=()=>{useShortcuts();return null;};
beforeEach(async()=>{
 host=document.createElement("div");
 document.body.appendChild(host);root=createRoot(host);
 useScene.temporal.getState().clear();
 useScene.setState({project:emptyProject(),selection:[],editingGroupId:null,modalOpen:false});
 useScene.temporal.getState().clear();
 useAuth.setState({status:"offline"});
 await act(async()=>root.render(createElement(Hook)));
});
afterEach(async()=>{
 await act(async()=>root.unmount());
 host.remove();
 document.querySelectorAll('[data-test-dialog]').forEach(el=>el.remove());
});
const model=()=>{useScene.getState().addShape("box");return useScene.getState().selection[0];};
const dialog=(role:"dialog"|"menu")=>{
 const el=document.createElement("section");
 el.setAttribute("data-test-dialog","yes");el.setAttribute("role",role);
 const button=document.createElement("button");button.textContent="Apply";
 el.appendChild(button);document.body.appendChild(el);button.focus();return button;
};
const key=(button:HTMLButtonElement,key:string,ctrlKey=false)=>{
 button.dispatchEvent(new KeyboardEvent("keydown",{key,ctrlKey,bubbles:true,cancelable:true}));
};
describe("global scene shortcuts do not leak through open dialogs/menus",()=>{
 it.each(["Delete","Backspace"])("%s cannot delete an object when a modal button is focused",keyName=>{
  const id=model(),button=dialog("dialog");
  key(button,keyName);
  expect(useScene.getState().project.nodes[id]).toBeTruthy();
 });
 it("Ctrl+Z inside an open dialog cannot undo the scene or its geometry",()=>{
  const id=model(),button=dialog("dialog");
  key(button,"z",true);
  expect(useScene.getState().project.nodes[id]).toBeTruthy();
 });
 it("arrow keys inside a dialog cannot nudge the model",()=>{
  const id=model(),before=[...useScene.getState().project.nodes[id].position];
  const button=dialog("dialog");key(button,"ArrowRight");
  expect(useScene.getState().project.nodes[id].position).toEqual(before);
 });
 it("an open context menu protects scene contents too",()=>{
  const id=model(),button=dialog("menu");key(button,"Delete");
  expect(useScene.getState().project.nodes[id]).toBeTruthy();
 });
 it("with NO open dialog, normal Delete still deletes the chosen object",()=>{
  const id=model();
  const button=document.createElement("button");host.appendChild(button);
  key(button,"Delete");
  expect(useScene.getState().project.nodes[id]).toBeUndefined();
 });
});
