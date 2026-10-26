import {describe,it,expect,vi} from "vitest";
vi.mock("../state/store",()=>({useScene:{getState:vi.fn(),setState:vi.fn()}}));
vi.mock("./sceneApi",()=>({sceneApi:{getNodeBounds:vi.fn()}}));
// @ts-ignore Existing project deliberately does not include Node typings; Vitest runs these Node test utilities. 
import {readFileSync,existsSync} from "node:fs";
// @ts-ignore Test-only Node import; do not modify existing project tsconfig.
import {join} from "node:path";
// @ts-ignore Test-only Node import; no new dependencies.
import {createHash} from "node:crypto";
import {CONNECTOR_PRESETS} from "./connectorPrefabs";
import {CONNECTOR_THUMBNAILS,connectorThumbnail} from "./connectorThumbnails";
import paletteSource from "../components/Palette.tsx?raw";

// @ts-ignore process is provided by Vitest Node, not by the browser build.
const asset=(id:string)=>join(process.cwd(),"public","connector-thumbnails",id+".svg");
describe("LOCKED — one unique dark-industrial picture for every connector",()=>{
 it("every real selectable connector has exactly one explicit assigned image (including future additions)",()=>{
  const ids=CONNECTOR_PRESETS.map(p=>p.id);
  expect(Object.keys(CONNECTOR_THUMBNAILS).sort()).toEqual([...ids].sort());
  expect(new Set(ids).size).toBe(ids.length);
  const paths=ids.map(connectorThumbnail);
  expect(new Set(paths).size).toBe(ids.length);
  for(const id of ids){
   expect(connectorThumbnail(id)).toBe("/connector-thumbnails/"+id+".svg");
   expect(existsSync(asset(id))).toBe(true);
  }
 });
 it("all seven pictures are distinct, fully self-contained, dark industrial and valid SVG assets",()=>{
  const ids=CONNECTOR_PRESETS.map(p=>p.id);
  const hashes=new Set<string>();
  for(const id of ids){
   const svg=readFileSync(asset(id),"utf8");
   expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
   expect(svg).toContain('viewBox="0 0 160 160"');
   expect(svg).toContain('id="bg"');
   expect(svg).toContain('id="metal"');
   expect(svg).toContain('fill="url(#bg)"');
   expect(svg).toContain('filter id="shadow"');
   expect(svg.length).toBeGreaterThan(2500);
   expect(svg).not.toMatch(/<image\b|https?:\/\/(?!www\.w3\.org\/2000\/svg)|data:|<script\b|<foreignObject\b/);
   hashes.add(createHash("sha256").update(svg).digest("hex"));
  }
  expect(hashes.size).toBe(ids.length);
 });
 it("banana contacts, banana socket, DB9 male/female and XT60 have identifiable model-specific artwork",()=>{
  const a=readFileSync(asset("banana-mini2"),"utf8");
  const b=readFileSync(asset("banana-mini3"),"utf8");
  const c=readFileSync(asset("banana-standard4"),"utf8");
  const s=readFileSync(asset("banana-type-b-socket"),"utf8");
  const male=readFileSync(asset("db9-male"),"utf8");
  const female=readFileSync(asset("db9-female"),"utf8");
  const xt=readFileSync(asset("xt60-panel-03"),"utf8");
  expect(a).toContain("blueBody");
  expect(b).toContain("blackBody");
  expect(c).toContain("redBody");
  expect(s).toContain("Banana panel socket");
  expect(male).toContain("DB9 male");
  expect(female).toContain("DB9 female");
  expect(male).toContain('fill="url(#gold)"'); // visible pins
  expect(female).toContain('fill="#091016"'); // dark front sockets rendered
  expect(xt).toContain("XT60 panel mount");
  expect(xt).toContain('fill="url(#yellowBody)"');
 });
 it("shows a physical connector thumbnail while preserving the SAME placeable cutter workflow and theme",()=>{
  expect(paletteSource).toContain('<img src={connectorThumbnail(id)}');
  expect(paletteSource).toContain('aria-label="Palette category"');
  expect(paletteSource).toContain("setPlacingConnector(placingConnector===id?null:id)");
  expect(paletteSource).toContain('e.dataTransfer.setData(CONNECTOR_DRAG_TYPE,id)');
  expect(paletteSource).not.toContain("CONNECTOR_ICONS");
  expect(paletteSource).not.toContain("<Icon size={30}");
  expect(paletteSource).toContain('ad5x-palette-tile');
 });
});
