import {describe,it,expect} from "vitest";
import menu from "../components/SmartContextMenu.tsx?raw";
import shelf from "../components/HoverShelf.tsx?raw";
// @ts-expect-error Node-only test fixture; not part of browser bundle.
import {readFileSync} from "node:fs";
const css=readFileSync(new URL("../components/smart-context.css",import.meta.url),"utf8");
import app from "../App.tsx?raw";
import workshop from "../components/WorkshopTools.tsx?raw";
import banana from "../components/BananaPlugEditor.tsx?raw";
import db9 from "../lib/db9BoxMount.ts?raw";
import round from "../lib/roundPanelMount.ts?raw";

describe("v19.5.47 user-selected Hover Shelf retains real CAD workflows",()=>{
 it("keeps Design editor and original Workshop, removes only obsolete navigation",()=>{
  expect(app).not.toContain("<WorkshopNavigation");
  expect(app).toContain("<Toolbar />");
  expect(app).toContain("<Viewport />");
  expect(app).toContain("<WorkshopTools />");
 });
 it("keeps all empty-plate creation shortcuts behind the new contextual shelf",()=>{
  expect(menu).toContain('id:"create",label:"Create something"');
  for(const x of ["New tray / box...","New drilling jig...","Organizers & bins...",
    "PCB, connectors & fixtures...","Enclosures & lids...","Add box here","Add cylinder here"])expect(menu).toContain(x);
 });
 it("has exactly ONE adjacent shelf that opens on POINTER HOVER, click or keyboard focus",()=>{
  expect(shelf).toContain('className="design-hover-shelf-panel"');
  expect(shelf).toContain('onPointerEnter={()=>select(g.id)}');
  expect(shelf).toContain('onFocus={()=>select(g.id)}');
  expect(shelf).toContain('onClick={()=>select(g.id)}');
  expect(shelf).toContain('aria-haspopup="menu" aria-expanded={selected}');
  expect(shelf).toContain('onPointerLeave={()=>setActive(null)}');
  expect(shelf).toContain('if(e.key==="ArrowRight"||e.key==="Enter")');
  expect(shelf).toContain('if(e.key==="Escape"||e.key==="ArrowLeft")');
  expect(menu).not.toContain('ConnectorHoverBranch');
  expect(menu).not.toContain('data-connector-trigger="true"');
 });
 it("uses CSS sibling panel outside independently scrollable root; flips side at viewport edges",()=>{
  expect(css).toContain(".design-hover-shelf-host.opens-left > .design-hover-shelf-panel");
  expect(css).toContain("left:calc(100% - 2px)");
  expect(css).toContain("max-height:min(64vh,480px)");
  expect(css).toContain("ad5x-shelf-in");
  expect(css).toMatch(/\.design-hover-shelf-panel\s*\{[^}]*min-height:100%/s);
  expect(css).toContain("prefers-reduced-motion:reduce");
  expect(shelf).toContain('hoverShelfSide(rootRect.left,rootRect.right,viewRect.left,viewRect.right)');
  expect(menu).toContain('<HoverShelf title={contextTitle}');
 });
 it("flattens banana/DB9/XT60 choices into one shelf, no 3-level drill-down",()=>{
  for(const x of ["Banana plug 2 mm","Banana plug 3 mm","Banana plug 4 mm",
  "Banana plug Custom…","Banana socket Type B (12.2 mm cutout)","DB9 male",
  "DB9 female","XT60 panel mount (22 mm)"])expect(menu).toContain(x);
  expect(menu).not.toContain('submenuLabel="DB9 genders"');
  expect(menu).not.toContain('submenuLabel="Banana plug sizes"');
 });
 it("preserves banana sizes, custom empty diameter and existing hole editor",()=>{
  for(const [preset] of [["mini2-contact"],["mini3-contact"],["standard4-contact"],["custom"]] as const){
    expect(menu).toContain('openConnectorChoice("banana","'+preset+'")');
  }
  expect(banana).toContain("initialPresetId");
  expect(banana).toContain("spacedBananaHoles");
  expect(banana).toContain("onCreate(options)");
 });
 it("Workshop still closes only after successful real cutter operations",()=>{
  expect(workshop).toContain('const perform=(fn:()=>void,success:string,closeAfterSuccess=false)');
  const start=workshop.indexOf("const perform=");
  const end=workshop.indexOf("const field=",start);
  const handler=workshop.slice(start,end);
  expect(handler.indexOf("fn();")).toBeLessThan(handler.indexOf("setOpen(false)"));
  expect(handler.indexOf("setOpen(false)")).toBeLessThan(handler.indexOf("}catch(e)"));
  expect(handler).toContain("setError(e instanceof Error");
  expect(workshop).toContain('"Banana-plug holes added to your box",true)');
  expect(workshop).toContain('"Connector panel cutout added to the selected box",true)');
  expect(workshop).toContain('"DB9 "+options.gender+" cutout and mounting holes added to your box",true)');
 });
 it("uses unchanged original geometry and placement handlers for connector cuts",()=>{
  expect(workshop).toContain("applyBananaBoxHoles(target.id,options)");
  expect(workshop).toContain("applyDB9BoxMount(target.id,options)");
  expect(workshop).toContain("applyRoundPanelMount(target.id,options)");
  expect(db9).toContain("export function planDB9BoxMount(");
  expect(round).toContain("export function planRoundPanelMount(");
  expect(menu).toContain("editableModelRoot(project,ids)");
  expect(menu).toContain('setSelection([bananaBoxRootId])');
  expect(menu).toContain('openWorkshopRoute({tab:"Jigs",connectorChooser:true,connectorType,bananaPreset,rootId:bananaBoxRootId})');
 });
});