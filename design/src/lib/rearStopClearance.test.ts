import {describe,it,expect,vi} from "vitest";
vi.mock("../state/store",()=>({useScene:{getState:()=>({}),setState:()=>{}}}));
import {pcbHolderParts,connectorCradleParts} from "./workshopTools";

const pcb={boardWidth:60,boardDepth:40,clearance:.1,baseThickness:5,
 railWidth:4,railHeight:3,backStopThickness:4,backStopHeight:5,margin:5};
const cradle={bodyWidth:35,bodyDepth:24,clearance:.1,baseThickness:5,
 railWidth:4,railHeight:7,backStopThickness:4,backStopHeight:6,margin:6};
describe("measured clearances for PCB rear stop AND connector cradle",()=>{
 it.each([.1,.2,.3,.4,1,5])("PCB %s mm: rear-stop inner face is at least the requested gap",clearance=>{
  const parts=pcbHolderParts({...pcb,clearance});
  const stop=parts[3],nearest=stop.position[1]-Number(stop.params.d)/2;
  const actual=nearest-pcb.boardDepth/2;
  expect(actual).toBeCloseTo(clearance,6);
 });
 it.each([.1,.2,.3,.4,1,5])("Connector %s mm: rear-stop face honours exact measured clearance",clearance=>{
  const parts=connectorCradleParts({...cradle,clearance});
  const stop=parts[3],nearest=stop.position[1]-Number(stop.params.d)/2;
  const actual=nearest-cradle.bodyDepth/2;
  expect(actual).toBeCloseTo(clearance,6);
 });
 it("keeps PCB and cradle rails connected to the rear stop despite full clearance",()=>{
  const [base,left,right,back]=pcbHolderParts({...pcb,clearance:.1});
  const [cbase,cleft,cright,cback]=connectorCradleParts({...cradle,clearance:.1});
  for(const pair of [[left,back],[right,back],[cleft,cback],[cright,cback]]){
   const rear=pair[0].position[1]+Number(pair[0].params.d)/2;
   const start=pair[1].position[1]-Number(pair[1].params.d)/2;
   expect(rear).toBeGreaterThan(start);
  }
  for(const [pl,stop] of [[base,back],[cbase,cback]]){
   expect(stop.position[2]-Number(stop.params.h)/2)
    .toBeLessThan(pl.position[2]+Number(pl.params.h)/2);
  }
 });
});
