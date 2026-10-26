// @vitest-environment jsdom
import {describe,it,expect,vi} from "vitest";
vi.mock("../state/store",()=>({useScene:{getState:()=>({}),setState:()=>{}}}));
// @ts-expect-error Node declarations deliberately omitted from production tsconfig
import {readFileSync} from "node:fs";
// @ts-expect-error Node declarations deliberately omitted from production tsconfig
import {resolve} from "node:path";
// @ts-expect-error Node declarations deliberately omitted from production tsconfig
import {cwd} from "node:process";
import {serializeSceneModel} from "./exportStl";
import type {Project} from "../types/scene";
const root=resolve(cwd(),"test-fixtures/Acceptance_Fixtures");
const report=JSON.parse(readFileSync(resolve(cwd(),"test-fixtures/Cross_Feature_STEP_Acceptance_20261024/STEP_MATRIX_RESULTS.json"),"utf8")) as {rows:{model:string;size_mm:number[];volume_mm3:number}[]};
function parseBinaryStl(bytes:ArrayBuffer){
 const d=new DataView(bytes);
 const count=d.getUint32(80,true);
 if(bytes.byteLength!==84+count*50)throw new Error("STL length/triangle count mismatch");
 const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
 let signedVolume=0;
 for(let i=0;i<count;i++){
  const b=84+i*50;
  const v=[0,1,2].map(k=>[0,1,2].map(q=>d.getFloat32(b+12+k*12+q*4,true)));
  for(const p of v) for(let q=0;q<3;q++){if(!Number.isFinite(p[q]))throw new Error("nonfinite vertex");min[q]=Math.min(min[q],p[q]);max[q]=Math.max(max[q],p[q]);}
  const [a,c,e]=v;
  signedVolume+=(a[0]*(c[1]*e[2]-c[2]*e[1])+a[1]*(c[2]*e[0]-c[0]*e[2])+a[2]*(c[0]*e[1]-c[1]*e[0]))/6;
 }
 return {count,size:min.map((v,i)=>max[i]-v),min,signedVolume};
}
describe("current CAD STEP vs actual STL Prepare transfer parity",()=>{
 for(const expected of report.rows)it(expected.model,async()=>{
  const p=JSON.parse(readFileSync(resolve(root,expected.model+".json"),"utf8")) as Project;
  const result=serializeSceneModel(p);
  expect(result.blob).not.toBeNull();
  const stl=parseBinaryStl(await result.blob!.arrayBuffer());
  const dims=stl.size.map((v,i)=>Math.abs(v-expected.size_mm[i]));
  const vdiff=Math.abs(Math.abs(stl.signedVolume)-expected.volume_mm3)/expected.volume_mm3;
  console.log("PARITY",expected.model,"triangles",stl.count,"sizes",stl.size.map(x=>x.toFixed(3)).join(","),"deltas",dims.map(x=>x.toFixed(3)).join(","),"volumeDeltaPct",(100*vdiff).toFixed(2));
  expect(Math.max(...dims)).toBeLessThanOrEqual(.5);
  expect(vdiff).toBeLessThan(.08);
 });
});
