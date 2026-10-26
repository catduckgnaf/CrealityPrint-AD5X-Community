import {describe,it,expect} from "vitest";
import source from "../components/Toolbar.tsx?raw";
describe("AD5X direct STEP export",()=>{
  it("offers a direct CAD-solid STEP action in normal Export menu",()=>{
    expect(source).toContain("STEP — CAD solid (preferred)");
    expect(source).toContain("onClick={()=>{void onExportStep();}}");
  });
  it("uses real local OpenCascade bridge and blocks incomplete responses",()=>{
    expect(source).toContain('stepBridgePort(location.port)+"/export-step"');
    expect(source).toContain('"X-AD5X-Step-Bridge":"1"');
    expect(source).toContain("!response.ok");
    expect(source).toContain("blob.size<200");
    expect(source).toContain("exportingStep");
  });
});
