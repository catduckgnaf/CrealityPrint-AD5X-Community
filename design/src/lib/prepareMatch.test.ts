import {describe, expect, it} from "vitest";
// @ts-ignore: Vitest has Node builtins even though the browser tsconfig excludes them
import {readFileSync} from "node:fs";
// @ts-ignore: Vitest has Node builtins even though the browser tsconfig excludes them
import {resolve} from "node:path";
declare const process: { cwd: () => string };
const style=readFileSync(resolve(process.cwd(),"src/prepare-match.css"),"utf8");
import app from "../App.tsx?raw";
import toolbar from "../components/Toolbar.tsx?raw";
import palette from "../components/Palette.tsx?raw";
import inspector from "../components/Inspector.tsx?raw";
import viewport from "../components/Viewport.tsx?raw";

function token(name:string):string {
  const match=style.match(new RegExp(name+":\\s*(#[a-fA-F0-9]{6})\\s*;"));
  if (!match) throw new Error("Missing theme token: "+name);
  return match[1];
}
function lum(color:string):number {
  const x=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)/255)
    .map(v=>v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4));
  return x[0]*.2126+x[1]*.7152+x[2]*.0722;
}
function contrast(a:string,b:string):number {
  const x=lum(a),y=lum(b); return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
}
describe("Prepare-match design theme",()=>{
 it("attaches the theme only to the embedded Design root",()=>{
  expect(app).toContain('className="prepare-match-theme flex h-screen flex-col"');
  expect(app).toContain('import "./prepare-match.css"');
  expect(style).toContain("#root .prepare-match-theme");
 });
 it("keeps text and secondary labels readable",()=>{
  expect(contrast(token("--pm-text"),token("--pm-panel"))).toBeGreaterThan(7);
  expect(contrast(token("--pm-muted"),token("--pm-panel"))).toBeGreaterThan(4.5);
 });
 it("defines green active states, keyboard focus, disabled and hover states",()=>{
  expect(token("--pm-accent")).toBe("#35d76b");
  expect(contrast(token("--pm-accent"),token("--pm-toolbar"))).toBeGreaterThan(6);
  expect(style).toContain("button:focus-visible");
  expect(style).toContain(".design-icon-button.is-active");
  expect(style).toContain("button:disabled");
 });
 it("themes ribbon, palette, inspector and viewport together",()=>{
  for(const name of ["design-toolbar","design-palette","design-inspector","design-viewport"]) {
   expect(style).toContain("."+name);
  }
  expect(toolbar).toContain("design-icon-button");
  expect(palette).toContain("design-palette");
  expect(inspector).toContain("design-inspector");
  expect(viewport).toContain("design-viewport");
 });
 it("uses green selection cues and leaves Z-up workspace intact",()=>{
  expect(viewport).toContain('color: "#35d76b"');
  expect(viewport).toContain("THREE.Object3D.DEFAULT_UP.set(0, 0, 1)");
  expect(style).not.toMatch(/#root\s+(?:body|header|input)\s*\{/);
 });
});
