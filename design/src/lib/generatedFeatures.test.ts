// @vitest-environment jsdom
import {beforeEach,describe,it,expect} from "vitest";
import {useScene} from "../state/store";
import {emptyProject,type Project,type GroupNode} from "../types/scene";
import {shellParts} from "./advancedModels";
import {identifyShell,addDividers,lidParts,type LidOptions} from "./boxFitTools";
import {inspectDividerSet} from "./dividerManagement";
import {findDividerEditTarget} from "./groupWorkflow";
import {collectTrayWalls,planAddPartial} from "./workshopTools";
import {deletePartialDivider} from "./dividerInteraction";
import {isGeneratedDividerLayer,isGeneratedHingeWrapper,partialDividerAxis} from "./generatedFeatures";
import {planHingedLid,DEFAULT_HINGE_OPTIONS} from "./hingedLid";
import {validateProject} from "./projectFile";

const first=useScene.getState();
const fixture=():Project=>{
 const parts=shellParts(80,60,22,2,2);
 const box:GroupNode={id:"box",type:"group",label:"Hollow box",childIds:parts.map(p=>p.id),
  position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]};
 return {...emptyProject(),nodes:{...Object.fromEntries(parts.map(p=>[p.id,p])),[box.id]:box},
  rootOrder:["box"]};
};
const lids:LidOptions={clearance:.3,thickness:2.4,lipDepth:4,lipWall:1.5,overhang:.5,bedGap:12};
beforeEach(()=>{
 useScene.temporal.getState().clear();
 useScene.setState({...first,project:fixture(),selection:[],editingGroupId:null,bed:[220,220]});
 useScene.temporal.getState().clear();
});
describe("Step 10: generated features must survive user object renaming",()=>{
 it("new generated divider wrapper keeps provenance after name edit and JSON round-trip",()=>{
  const id=addDividers("box",2,1,1.6,2);
  const initial=useScene.getState().project;
  expect(isGeneratedDividerLayer(initial.nodes[id],initial)).toBe(true);
  expect(inspectDividerSet(initial,id).dividerIds).toHaveLength(1);
  useScene.getState().updateNodeDisplay(id,{label:"My custom walls"});
  const renamed=useScene.getState().project;
  expect(renamed.nodes[id].label).toBe("My custom walls");
  expect(renamed.nodes[id].feature).toBe("divider-layer");
  expect(inspectDividerSet(renamed,id).dividerIds).toHaveLength(1);
  expect(collectTrayWalls(renamed,id)).toHaveLength(1);
  expect(findDividerEditTarget(renamed,id)).not.toBeNull();
  const reloaded=validateProject(JSON.parse(JSON.stringify(renamed)));
  expect(reloaded.nodes[id].feature).toBe("divider-layer");
  expect(inspectDividerSet(reloaded,id).dividerIds).toHaveLength(1);
  expect(reloaded.rootOrder).toEqual([id]);
 });
 it("legacy, untagged divider wrapper is identified after ordinary Object Explorer rename",()=>{
  const id=addDividers("box",2,1,1.6,2);
  const project=useScene.getState().project;
  const legacy={...project.nodes[id]};
  delete legacy.feature;
  useScene.setState({project:{...project,nodes:{...project.nodes,[id]:legacy}}});
  useScene.getState().updateNodeDisplay(id,{label:"Divider renamed"});
  const renamed=useScene.getState().project;
  expect(renamed.nodes[id].feature).toBe("divider-layer");
  expect(inspectDividerSet(renamed,id).dividerIds).toHaveLength(1);
 });
 it("legacy full-length walls retain recognition after being renamed BEFORE metadata existed",()=>{
  const id=addDividers("box",2,1,1.6,2);
  const project=useScene.getState().project;
  const node={...project.nodes[id],label:"Custom workshop grid"};
  delete node.feature;
  const old:Project={...project,nodes:{...project.nodes,[id]:node}};
  expect(isGeneratedDividerLayer(node,old)).toBe(true);
  expect(inspectDividerSet(old,id).dividerIds).toHaveLength(1);
  expect(collectTrayWalls(old,id)).toHaveLength(1);
 });
 it("partial divider keeps its X/Y identity when BOTH wrapper and part are renamed",()=>{
  const old=useScene.getState().project;
  const result=planAddPartial(old,"box","x",[0,0]);
  const partial=result.project.nodes[result.shapeId];
  expect(partial.feature).toBe("partial-divider-x");
  const layer=result.project.nodes[result.selectionId];
  expect(layer.feature).toBe("divider-layer");
  const renamed:Project={...result.project,nodes:{...result.project.nodes,
    [result.shapeId]:{...partial,label:"My shelf"},
    [result.selectionId]:{...layer,label:"Internal walls"}}};
  expect(partialDividerAxis(renamed.nodes[result.shapeId])).toBe("x");
  expect(collectTrayWalls(renamed,result.selectionId).some(x=>x.partial)).toBe(true);
  const deleted=deletePartialDivider(renamed,result.shapeId);
  expect(deleted.project.nodes[result.shapeId]).toBeUndefined();
  expect(deleted.project.rootOrder).toEqual([result.selectionId]);
 });
 it("renamed modern and pre-tag hinge wrappers are both protected against duplicate hinge application",()=>{
  const box=useScene.getState().project;
  const shapes=lidParts(identifyShell("box",box),lids,[220,220]);
  const lid:GroupNode={id:"lid",type:"group",label:"Matching lid",childIds:shapes.map(x=>x.id),
   position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]};
  const project:Project={...box,nodes:{...box.nodes,
   ...Object.fromEntries(shapes.map(p=>[p.id,p])),[lid.id]:lid},rootOrder:["box","lid"]};
  const hinged=planHingedLid(project,"box","lid",DEFAULT_HINGE_OPTIONS);
  const modern:Project={...hinged.project,nodes:{...hinged.project.nodes,
    [hinged.boxId]:{...hinged.project.nodes[hinged.boxId],label:"Toolbox side"},
    [hinged.lidId]:{...hinged.project.nodes[hinged.lidId],label:"Cover"}}};
  expect(isGeneratedHingeWrapper(modern,modern.nodes[hinged.boxId])).toBe(true);
  expect(()=>planHingedLid(modern,hinged.boxId,hinged.lidId,DEFAULT_HINGE_OPTIONS))
   .toThrow("already attached");
  const oldBox={...modern.nodes[hinged.boxId]};
  const oldLid={...modern.nodes[hinged.lidId]};
  delete oldBox.feature;delete oldLid.feature;
  const legacy:Project={...modern,nodes:{...modern.nodes,[hinged.boxId]:oldBox,[hinged.lidId]:oldLid}};
  expect(isGeneratedHingeWrapper(legacy,legacy.nodes[hinged.boxId])).toBe(true);
  expect(isGeneratedHingeWrapper(legacy,legacy.nodes[hinged.lidId])).toBe(true);
  expect(()=>planHingedLid(legacy,hinged.boxId,hinged.lidId,DEFAULT_HINGE_OPTIONS))
   .toThrow("already attached");
 });
 it("unknown/injected feature metadata is never accepted when opening a saved project",()=>{
  const project=fixture();
  const box=project.nodes.box;
  project.nodes.box={...box,feature:"unsupported" as never};
  const opened=validateProject(JSON.parse(JSON.stringify(project)));
  expect(opened.nodes.box.feature).toBeUndefined();
 });
});