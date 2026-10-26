import {describe,it,expect,vi} from "vitest";
// @ts-expect-error Node test environment helpers
import {existsSync,readFileSync} from "node:fs";
// @ts-expect-error Node test environment helpers
import {join} from "node:path";
vi.mock("../state/store",()=>({useScene:{getState:vi.fn(),setState:vi.fn()}}));
import {componentById,COMPONENTS,COMPONENT_LIBRARY,componentStatusLabel,isPlaceableNominalComponent,catalogPlacementId} from "./componentCatalog";
import {nominalComponentCutter} from "./componentNominalCutouts";
declare const process:{cwd:()=>string};
describe("Phase 2 exact-SKU evidence without invented panel geometry",()=>{
 it("records supplier-drawn flange and hole pitch separately from the UNKNOWN C14-NO-SWITCH aperture",()=>{
  const c=componentById("mr-c14-no-switch")!;
  expect(COMPONENT_LIBRARY.library_version).toBe("0.2.0-phase2-staged");
  expect(c.mounting.other_verified_dimensions_mm?.front_flange_width_mm).toBe(50);
  expect(c.mounting.other_verified_dimensions_mm?.front_flange_height_mm).toBe(29);
  expect(c.mounting.mounting_holes?.diameter_mm).toBe(3.5);
  expect(c.mounting.mounting_holes?.count).toBe(2);
  expect(c.mounting.mounting_holes?.center_to_center_mm).toBe(40);
  expect(c.mounting.mounting_holes?.centers_xy_mm).toEqual([[-20,0],[20,0]]);
  expect(c.mounting.mounting_holes?.alignment_verified).toBe(true);
  expect(c.mounting.cutout).toBeNull();
  expect(c.mounting.printable_cutout_template).toBe(false);
  expect(catalogPlacementId(c.id)).toBeNull();
  expect(componentStatusLabel(c)).toContain("drawing");
  expect(c.notes.join(" ")).toContain("DOES NOT identify a verified panel cutout");
  expect(()=>nominalComponentCutter("component-"+c.id)).toThrow("Measurements needed");
 });
 it("bundles the exact source drawing OFFLINE without modifying the original source archive",()=>{
  const c=componentById("mr-c14-no-switch")!;
  expect(c.reference_diagram).toMatch(/^references\/[A-Za-z0-9_.-]+\.jpg$/);
  const p=join(process.cwd(),"public","component-library",c.reference_diagram!);
  expect(existsSync(p)).toBe(true);
  const img=readFileSync(p);
  expect(img.length).toBeGreaterThan(10000);
  expect(img[0]).toBe(0xFF);expect(img[1]).toBe(0xD8);
  const src=c.sources.find(s=>s.source_type==="supplier_dimensioned_image");
  expect(src?.url).toContain("/C14-NO-SWITCH/");
  expect(src?.supports).toContain("40 mm apart");
 });
 it("all 8 exact SKUs remain; 6 intentionally cannot cut unknown holes",()=>{
  expect(COMPONENTS).toHaveLength(8);
  expect(COMPONENTS.filter(isPlaceableNominalComponent).map(c=>c.supplier_sku).sort())
   .toEqual(["59-111","C14-SWITCH"]);
  expect(COMPONENTS.filter(c=>!isPlaceableNominalComponent(c))).toHaveLength(6);
  for(const sku of ["C14-NO-SWITCH","LEDH-03-CONC","LED-03-PLA","FUSE20","CAR-FEM-12V","DPM/BMT MINI DIG VOLTMT 2,5-30V"]){
   const c=COMPONENTS.find(c=>c.supplier_sku===sku)!;
   expect(c.mounting.cutout).toBeNull();
   expect(c.mounting.printable_cutout_template).toBe(false);
   expect(c.mounting.cutout_dxf_file).toBeNull();
   expect(catalogPlacementId(c.id)).toBeNull();
  }
 });
 it("supplier extras stay separate from physical cutout dimensions",()=>{
  const c14=componentById("mr-c14-no-switch")!;
  expect(c14.mounting.other_verified_dimensions_mm?.depth_mm).toBe(33);
  const meter=componentById("communica-dpm-bmt")!;
  expect(meter.attributes?.refresh_period_approx_ms).toBe(500);
  expect(meter.attributes?.operating_temperature_min_c).toBe(-10);
  expect(meter.attributes?.operating_temperature_max_c).toBe(65);
  const fuse=componentById("mr-fuse20")!;
  expect(fuse.notes.join(" ")).toContain("mounting washer");
  const car=componentById("mr-car-fem-12v")!;
  expect(car.notes.join(" ")).toContain("not suitable for the heat");
  const led=componentById("mr-ledh-03-conc")!;
  expect(led.notes.join(" ")).toContain("DIFFERENT SKU");
 });
});
