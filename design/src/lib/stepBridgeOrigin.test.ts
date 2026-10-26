import {describe,it,expect} from "vitest";
import {stepBridgePort} from "./stepBridgeOrigin";
describe("STEP bridge origin isolation",()=>{
 it("preserves the accepted production STEP bridge",()=>expect(stepBridgePort("18195")).toBe(18651));
 it("uses private staging STEP bridge for isolated native acceptance",()=>expect(stepBridgePort("18387")).toBe(18652));
 it("keeps other origins at the historical default",()=>expect(stepBridgePort("3000")).toBe(18651));
});
