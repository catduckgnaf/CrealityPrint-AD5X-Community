import {describe,it,expect} from "vitest";
import {checkPrintableBounds} from "./printability";
import {validateProject} from "./projectFile";
import explorer from "../components/ObjectExplorer.tsx?raw";
import recovery from "../components/ProjectRecovery.tsx?raw";
import dims from "../components/ModelDimensions.tsx?raw";
import guides from "../components/AlignmentGuides.tsx?raw";
import preflight from "../components/PrintabilityPanel.tsx?raw";
import app from "../App.tsx?raw";
import toolbar from "../components/Toolbar.tsx?raw";

const box=(min:[number,number,number],max:[number,number,number])=>({
 min:{x:min[0],y:min[1],z:min[2]},max:{x:max[0],y:max[1],z:max[2]},
});
describe("v18.8 printability bounds",()=>{
 it("accepts a box inside the 220x220x220 envelope",()=>{
   expect(checkPrintableBounds("a",box([-10,-20,0],[10,20,20]),[220,220])).toEqual([]);
 });
 it("warns when outside bed, below zero, or too tall",()=>{
   const issues=checkPrintableBounds("a",box([-120,-5,-2],[5,5,222]),[220,220]);
   expect(issues.map(x=>x.message)).toEqual(expect.arrayContaining([
     expect.stringContaining("X/Y"),
     expect.stringContaining("below Z=0"),
     expect.stringContaining("height limit"),
   ]));
 });
 it("never marks a missing bed or invalid bounds safe",()=>{
   expect(checkPrintableBounds("a",box([0,0,0],[2,2,2]),null)[0].severity).toBe("unknown");
   expect(checkPrintableBounds("a",box([0,0,NaN],[2,2,2]),[220,220])[0].severity).toBe("unknown");
 });
});
describe("v18.8 object naming format",()=>{
 it("keeps an optional node label through project-file validation",()=>{
   const data={
     version:1,id:"local",name:"test",rootOrder:["a"],
     nodes:{a:{id:"a",kind:"box",label:"Bolt holder",position:[0,0,10],
       rotation:[0,0,0],scale:[1,1,1],role:"solid",color:"#ff0000",params:{w:20,d:20,h:20}}},
   };
   expect(validateProject(data).nodes.a.label).toBe("Bolt holder");
 });
 it("limits name lengths and strips blank labels",()=>{
   const data={
     version:1,id:"local",name:"test",rootOrder:["a"],
     nodes:{a:{id:"a",kind:"box",label:"  x  ",position:[0,0,10],
       rotation:[0,0,0],scale:[1,1,1],role:"solid",color:"#ff0000",params:{w:20,d:20,h:20}}},
   };
   expect(validateProject(data).nodes.a.label).toBe("x");
 });
});
describe("v18.8 visual-only enhancements",()=>{
 it("uses the existing scene selection and node flag handlers",()=>{
   expect(explorer).toContain("useScene");
   expect(explorer).toContain("updateNodeDisplay");
   expect(explorer).toContain("node.childIds.map");
 });
 it("uses isolated browser checkpoints with deliberate restore confirmation",()=>{
   expect(recovery).toContain('saveCheckpoint(current,"Before restore")');
   expect(recovery).toContain("window.confirm");
   expect(recovery).toContain("flushLocal");
 });
 it("keeps parametric dimensions limited to unrotated unscaled boxes",()=>{
   expect(dims).toContain('node.kind==="box"');
   expect(dims).toContain("node.rotation.every");
   expect(dims).toContain("node.scale.every");
   expect(dims).toContain("ad5x-edit-dimension");
   expect(dims).not.toContain("onChange={e=>setDraft");
 });
 it("only draws alignment guides; does not modify geometry",()=>{
   expect(guides).toContain("sceneApi.getNodeBounds");
   expect(guides).not.toContain("setTransform");
   expect(guides).not.toContain("translateSelected");
 });
 it("does not claim meshes are safe when their bounds are absent",()=>{
   expect(preflight).toContain("unknown++");
   expect(preflight).toContain("not fully checked");
 });
 it("integrates all five workflows without opening Prepare",()=>{
   for(const c of ["<ObjectExplorer />","<ProjectRecovery />","<PrintabilityPanel />"])expect(app).toContain(c);
   expect(toolbar).toContain("Object explorer");
   expect(toolbar).toContain("Check printability");
   expect(app).not.toContain("sendToPrepare()");
 });
});
