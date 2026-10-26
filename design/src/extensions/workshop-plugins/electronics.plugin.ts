import {indexedScrewClampParts} from "../../lib/indexedScrewClamp";
import {parseJigHolePositions,pcbHolderParts,pcbMountingHoleParts,
 wireCombParts,connectorCradleParts,connectorPanelParts,connectorMeasuredPanelParts,
 pogoPinGuideParts,pogoMeasuredGuideParts} from "../../lib/workshopTools";
import type {DrillGrid,PcbHolderOptions,WireCombOptions,ConnectorCradleOptions} from "../../lib/workshopTools";
import type {WorkshopBuilderPlugin,WorkshopBuildContext} from "../workshopContract";

// Existing generators and validation remain the single geometry implementation.
const drill=(c:WorkshopBuildContext):DrillGrid=>({
 width:c.number("jigW"),depth:c.number("jigD"),height:c.number("jigH"),
 diameter:c.number("jigHole"),columns:c.number("jigCols"),rows:c.number("jigRows"),
 pitchX:c.number("jigPitchX"),pitchY:c.number("jigPitchY"),fence:false
});
const plugin=(jobId:string,build:WorkshopBuilderPlugin["build"]):WorkshopBuilderPlugin=>({
 apiVersion:1,id:"ad5x.workshop."+jobId,version:"1.0.0",jobId,build
});
const builders:WorkshopBuilderPlugin[]=[
 plugin("pcb",c=>{
  const o:PcbHolderOptions={
   boardWidth:c.number("pcbWidth"),boardDepth:c.number("pcbDepth"),
   clearance:c.number("pcbGap"),baseThickness:c.number("pcbBase"),
   railWidth:c.number("pcbRailWidth"),railHeight:c.number("pcbRailHeight"),
   backStopThickness:c.number("pcbStopWidth"),backStopHeight:c.number("pcbStopHeight"),
   margin:c.number("pcbMargin")
  };
  const parts=pcbHolderParts(o);
  if(c.pcbMounting)parts.push(...pcbMountingHoleParts(o,
   parseJigHolePositions(c.values.pcbHolePositions),c.number("pcbHoleDiameter")));
  return {label:c.pcbMounting?"PCB holder with mounting bores":"PCB edge locating holder",parts};
 }),
 plugin("wire",c=>{
  const o:WireCombOptions={
   count:c.number("combCount"),pitch:c.number("combPitch"),
   slotWidth:c.number("combSlot"),slotDepth:c.number("combSlotDepth"),
   plateDepth:c.number("combDepth"),baseThickness:c.number("combBase"),
   ridgeThickness:c.number("combRidgeW"),ridgeHeight:c.number("combRidgeH"),
   endMargin:c.number("combMargin")
  };
  return {label:"Open wire positioning comb",parts:wireCombParts(o)};
 }),
 plugin("clamp",c=>({
  label:"Two-peg indexed M4 screw clamp",
  parts:indexedScrewClampParts({
   workWidth:c.number("clampWidth"),workDepth:c.number("clampDepth"),
   minOpening:c.number("clampMin"),maxOpening:c.number("clampMax"),
   step:c.number("clampStep"),pegDiameter:c.number("clampPeg"),
   clearance:c.number("clampClearance")
  })
 })),
 plugin("cradle",c=>{
  const o:ConnectorCradleOptions={
   bodyWidth:c.number("cradleWidth"),bodyDepth:c.number("cradleDepth"),
   clearance:c.number("cradleGap"),baseThickness:c.number("cradleBase"),
   railWidth:c.number("cradleRailW"),railHeight:c.number("cradleRailH"),
   backStopThickness:c.number("cradleStopW"),backStopHeight:c.number("cradleStopH"),
   margin:c.number("cradleMargin")
  };
  return {label:"Connector soldering cradle",parts:connectorCradleParts(o)};
 }),
 plugin("connector",c=>{
  const o=drill(c);
  if(c.connectorMeasured)return {
   label:"Measured connector mounting panel",
   parts:connectorMeasuredPanelParts(o.width,o.depth,o.height,o.diameter,
    parseJigHolePositions(c.values.connectorPositions))
  };
  return {label:"Connector mounting panel",parts:connectorPanelParts(o)};
 }),
 plugin("pogo",c=>{
  const o=drill(c);
  if(c.pogoMeasured)return {
   label:"Measured pogo-pin guide",
   parts:pogoMeasuredGuideParts(o.width,o.depth,o.height,o.diameter,
    parseJigHolePositions(c.values.pogoPositions))
  };
  return {label:"Pogo-pin guide",parts:pogoPinGuideParts(o)};
 })
];
export default builders;
