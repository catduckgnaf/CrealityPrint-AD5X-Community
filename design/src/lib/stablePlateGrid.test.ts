import {describe,expect,it} from "vitest";
import view from "../components/Viewport.tsx?raw";
describe("v18.5.2 stable build-plate rendering",()=>{
 it("has one opaque printable plane, never three coplanar layers",()=>{
   const chunk=view.split("function PlateArtwork(")[1].split("// Build-plate outline")[0];
   expect(chunk.match(/<planeGeometry/g)?.length).toBe(1);
   expect(chunk).not.toContain("transparent");
   expect(chunk).not.toContain("<PlateGrid");
 });
 it("configures mipmapped artwork for zoom stability",()=>{
   expect(view).toContain("THREE.LinearMipmapLinearFilter");
   expect(view).toContain("THREE.LinearFilter");
   expect(view).toContain("texture.anisotropy = 16");
 });
 it("avoids depth fights with the green perimeter line",()=>{
   expect(view).toContain("depthTest: false, depthWrite: false");
   expect(view).toContain("line.renderOrder = 500");
 });
});
