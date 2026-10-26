import { describe, it, expect } from "vitest";
import view from "../components/Viewport.tsx?raw";
import app from "../App.tsx?raw";
// @ts-ignore: Vitest has Node builtins even though browser tsconfig excludes them
import {readFileSync} from "node:fs";
// @ts-ignore: Vitest has Node builtins even though browser tsconfig excludes them
import {resolve} from "node:path";
declare const process: {cwd():string};
const css=readFileSync(resolve(process.cwd(),"src/prepare-match.css"),"utf8");
describe("v18.5 design menus and FlashForge buildplate", () => {
  it("puts the whole toolbar stacking context over sibling Three.js canvas", () => {
    expect(css).toContain(".design-toolbar.design-native-ribbon");
    expect(css).toContain("z-index: 100");
    expect(css).toContain("overflow: visible");
    expect(app).toContain("<Toolbar />");
  });
  it("positions the settings menu toward the workspace rather than under the left palette", () => {
    expect(css).toContain(".design-toolbar-settings > .absolute");
    expect(css).toContain("left: 0;");
    expect(css).toContain("right: auto;");
  });
  it("uses the exact native AD5X decorative physical plate, but only at 220 x 220", () => {
    expect(view).toContain('surface === "printer" && bed[0] === 220 && bed[1] === 220');
    expect(view).toContain('"/plates/flashforge_ad5x_buildplate_model.stl"');
    expect(view).toContain("raycast={() => null}");
  });
  it("composites transparent white AD5X markings over a dark plate instead of solid white", () => {
    expect(view).toContain('"/plates/printer_stable.png"');
    expect(view).toContain('map={textures[surface]}');
    expect(view).not.toContain("transparent alphaTest={0.015}");
    expect(view).toContain("THREE.LinearMipmapLinearFilter");
  });
  it("draws finite 10 mm grid lines beneath markings without touching CAD export", () => {
    expect(view).not.toContain("<PlateGrid");
    expect(view).not.toContain("<lineSegments geometry={geometry}");
    expect(view).toContain("<AD5XPhysicalPlate />");
    expect(view).toContain("depthTest: false, depthWrite: false");
  });
});
