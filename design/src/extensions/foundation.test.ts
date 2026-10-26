import {describe,it,expect,vi} from "vitest";
vi.mock("../state/store",()=>({useScene:{getState:vi.fn(),setState:vi.fn()}}));
import {COMPONENTS,catalogPlacementId} from "../lib/componentCatalog";
import {componentRegistry,cutoutRegistry} from "./catalog";
import {createComponentRegistry,createCutoutRegistry,canPlaceComponent,validateRecord} from "./registry";
import {createComponentCutter} from "../lib/componentNominalCutouts";
import {connectorPrefabNodes,planPlaceConnector} from "../lib/connectorPrefabs";
import {emptyProject,type GroupNode} from "../types/scene";
import {parseProjectFile} from "../lib/projectFile";
import {parseComponentSnapshot} from "./snapshot";
import type {ComponentRecord,ComponentPack,GeometryBackend} from "./contracts";
const copy=<T,>(x:T):T=>JSON.parse(JSON.stringify(x));
const sample=():ComponentRecord=>({...copy(COMPONENTS[0]),id:"test-only-opening",supplier_sku:"TEST ONLY",revision:"2"});
const pack=(c:ComponentRecord):ComponentPack=>({apiVersion:1,id:"test.pack",version:"1.0.0",components:[c]});
describe("extension foundation: records, geometry and saved compatibility",()=>{
 it("discovers built-in geometry plugins and preserves only the original two enabled openings",()=>{
  expect(COMPONENTS).toHaveLength(8);
  expect(COMPONENTS.filter(c=>catalogPlacementId(c.id))).toHaveLength(2);
  expect(cutoutRegistry.get("rectangle")?.id).toBe("ad5x.rectangle-opening");
  expect(cutoutRegistry.get("d_flat_circle")?.id).toBe("ad5x.d-flat-opening");
 });
 it("accepts a new supported component through one pack record, without an ID allowlist",()=>{
  const c=sample(),r=createComponentRegistry([pack(c)]);
  expect(r.components[0].id).toBe(c.id);
  expect(canPlaceComponent(r.components[0])).toBe(true);
  const n=createComponentCutter(r.components[0]);
  expect(n.params.w).toBe(42);expect(n.params.d).toBe(27);
 });
 it("disables a pack or record without enabling incomplete cutouts",()=>{
  const c=sample();
  expect(createComponentRegistry([{...pack(c),enabled:false}]).components).toHaveLength(0);
  expect(canPlaceComponent(createComponentRegistry([pack({...c,enabled:false})]).get(c.id)!.record)).toBe(false);
  const pending=copy(COMPONENTS.find(x=>!x.mounting.cutout)!);
  expect(canPlaceComponent(pending)).toBe(false);
  expect(()=>createComponentCutter(pending)).toThrow("Measurements needed");
 });
 it("configuration can retire starter entries and packs without touching their source records",()=>{
  const c=sample();const before=JSON.stringify(c);
  const config={apiVersion:1,disabledPacks:[],disabledComponents:[c.id]};
  const r=createComponentRegistry([pack(c)],config);
  expect(r.components).toHaveLength(0);expect(r.get(c.id)?.record.enabled).toBe(false);
  expect(JSON.stringify(c)).toBe(before);
  expect(createComponentRegistry([pack(c)],{...config,disabledComponents:[],disabledPacks:["test.pack"]}).components).toHaveLength(0);
 });
 it("keeps measured and physically tested openings placeable; fit status requires evidence",()=>{
  const c=sample();c.status="measured_unfit_tested";validateRecord(c);
  expect(canPlaceComponent(c)).toBe(true);
  c.status="fit_tested";c.mounting.physical_fit_tested=true;
  expect(()=>validateRecord(c)).toThrow("Physical fit evidence");
  c.fit_evidence={date:"2026-10-24",specimen:"SYNTHETIC TEST ONLY",panel_thickness_mm:2,notes:"fixture"};
  validateRecord(c);expect(canPlaceComponent(c)).toBe(true);
  expect(createComponentCutter(c).label).toContain("FIT TESTED");
 });
 it("rejects duplicates, unsupported APIs, malformed dimensions and contradictory fit claims",()=>{
  const c=sample();
  expect(()=>createComponentRegistry([pack(c),{...pack(c),id:"another.pack"}])).toThrow("Duplicate component");
  expect(()=>createComponentRegistry([{...pack(c),apiVersion:2} as unknown as ComponentPack])).toThrow();
  const invalid=sample();invalid.mounting.cutout={shape:"rectangle",width_mm:NaN,height_mm:2,dimensions_from:"fixture"};
  expect(()=>validateRecord(invalid)).toThrow("Invalid cutout");
  const contradiction=sample();contradiction.mounting.physical_fit_tested=true;
  expect(()=>validateRecord(contradiction)).toThrow("conflicts");
  const plugin=cutoutRegistry.get("rectangle")!;
  expect(()=>createCutoutRegistry([plugin,plugin])).toThrow("Duplicate");
 });
 it("uses an explicit backend capability boundary and fails clearly for unsupported backends",()=>{
  const backend:GeometryBackend={id:"test",primitiveKinds:[],createShape:()=>{throw Error("must not run");}};
  expect(()=>createComponentCutter(sample(),backend)).toThrow("does not support");
 });
 it("saves applied dimensions and provenance; loading never consults current catalogue IDs",()=>{
  const placed=planPlaceConnector(emptyProject(),"component-mr-c14-switch",[0,0,20],[0,0,0]);
  const group=placed.project.nodes[placed.selectionId] as GroupNode;
  expect(group.component?.cutout).toEqual(COMPONENTS[0].mounting.cutout);
  expect(group.component?.packVersion).toBe(componentRegistry.get("mr-c14-switch")!.packVersion);
  const original=JSON.stringify(placed.project);
  group.component!.componentId="retired-plugin-no-longer-installed";
  group.component!.packId="removed.pack";
  const loaded=parseProjectFile(JSON.stringify(placed.project));
  expect(loaded).toEqual(placed.project);
  expect((loaded.nodes[group.id] as GroupNode).component!.componentId).toBe("retired-plugin-no-longer-installed");
  expect(original).toContain("mr-c14-switch");
 });
 it("old projects still load; missing metadata is optional; corrupt metadata is rejected",()=>{
  const {group,parts}=connectorPrefabNodes("db9-male");
  const p={...emptyProject(),nodes:{[group.id]:group,...Object.fromEntries(parts.map(n=>[n.id,n]))},rootOrder:[group.id]};
  expect(parseProjectFile(JSON.stringify(p))).toEqual(p);
  expect(parseComponentSnapshot(undefined)).toBeUndefined();
  expect(()=>parseComponentSnapshot({apiVersion:99})).toThrow("metadata");
 });
});
