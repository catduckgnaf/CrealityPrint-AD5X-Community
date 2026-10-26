import {describe,it,expect} from "vitest";
import inspector from "../components/Inspector.tsx?raw";
import groups from "../components/GroupMesh.tsx?raw";
describe("v19.4.2 asynchronous grouped dimensions",()=>{
 it("notifies the Inspector when a worker finishes creating a Boolean group",()=>{
  expect(groups).toContain("ad5x-node-geometry-ready");
  expect(groups).toContain("if(!geometry)return");
  expect(groups).toContain("detail:{id:node.id}");
  expect(inspector).toContain('window.addEventListener("ad5x-node-geometry-ready",ready)');
  expect(inspector).toContain('window.removeEventListener("ad5x-node-geometry-ready",ready)');
  expect(inspector).toContain("if(id && key.split(\"|\").includes(id))measure()");
 });
 it("does not falsely say an unmeasured part is 0 millimetres",()=>{
  expect(inspector).toContain('value={dims ? mmToDisplay(dims[i], units) : null}');
  expect(inspector).toContain('placeholder={value===null?"Measuring…":undefined}');
  expect(inspector).toContain("disabled={value===null}");
  expect(inspector).toContain("sceneApi.scaleNodesAbout(ids, factors");
 });
});
