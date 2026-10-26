/**
 * Product-model-specific circular panel cutouts from Micro Robotics South Africa.
 * Never substitute these sizes for the associated electrical contact diameters,
 * other manufacturer variants or bare non-panel-mount plugs.
 *
 * 4 mm Type B banana SOCKET (BAN-STB-GRN): rated nominal connection Ø4mm,
 * but vendor specifies 12.2mm INSTALLATION PANEL CUTOUT.
 *   https://www.robotics.org.za/connectors/banana-jacks/BAN-STB-GRN
 *
 * XT60-PAN-03 round back-lock panel mount extension: seller specifies
 * 22mm recommended installation PANEL CUTOUT.
 *   https://www.robotics.org.za/connectors/panel-mount-connectors/XT60-PAN-03
 *
 * Both records are model-specific, not generic dimensional standards.
 * User controls fit allowance (0-1mm added per radial side); no press-fit
 * has been physically verified on this printer.
 */
import {makeShape} from "./primitives";
import {identifyShell} from "./boxFitTools";
import {bananaBoxFaceSize,planShellFeature,type BananaBoxFace,type PanelSizeInfo} from "./workshopTools";
import {useScene} from "../state/store";
import type {Project,ShapeNode} from "../types/scene";

export type RoundConnectorId="banana-type-b-socket"|"xt60-panel-03";

export interface RoundConnectorModel{
 id:RoundConnectorId;
 label:string;
 cutoutDiameter:number;
 description:string;
 source:string;
 documentStatus:"VENDOR_PRODUCT_CUTOUT";
}

export const ROUND_PANEL_MODELS:readonly RoundConnectorModel[]=[
 {id:"banana-type-b-socket",label:"4 mm banana SOCKET Type B (BAN-STB-GRN)",
  cutoutDiameter:12.2, description:"Panel-mount banana socket. 12.2 mm is the mounting hole, NOT the 4 mm electrical contact.",
  source:"https://www.robotics.org.za/connectors/banana-jacks/BAN-STB-GRN",
  documentStatus:"VENDOR_PRODUCT_CUTOUT"},
 {id:"xt60-panel-03",label:"XT60 round panel mount (XT60-PAN-03)",
  cutoutDiameter:22, description:"22 mm round back-lock panel aperture for this exact XT60 pass-through adapter, NOT loose XT60 plugs.",
  source:"https://www.robotics.org.za/connectors/panel-mount-connectors/XT60-PAN-03",
  documentStatus:"VENDOR_PRODUCT_CUTOUT"}
] as const;

export function roundConnector(id:RoundConnectorId):RoundConnectorModel{
 const row=ROUND_PANEL_MODELS.find(x=>x.id===id);
 if(!row)throw new Error("Unknown panel-mount connector type.");
 return row;
}

export interface RoundMountOptions{
 id:RoundConnectorId;
 face:BananaBoxFace;
 offsetX:number;
 offsetY:number;
 radialClearance:number;
}

export function roundMountIssues(sh:PanelSizeInfo,o:RoundMountOptions):string[]{
 const issues:string[]=[];
 let model:RoundConnectorModel;
 try{model=roundConnector(o.id);}catch{return ["Choose an available connector model."];}
 if(!["front","back","left","right","floor"].includes(o.face)){
  issues.push("Choose the box wall or inside floor.");
  return issues;
 }
 if(!Number.isFinite(o.radialClearance)||o.radialClearance<0||o.radialClearance>1)
  issues.push("Fit allowance must be between 0 and 1 mm per side.");
 if(!Number.isFinite(o.offsetX)||!Number.isFinite(o.offsetY))
  issues.push("Enter valid left/right and up/down positions.");
 if(issues.length)return issues;
 const d=model.cutoutDiameter+2*o.radialClearance;
 const [w,h]=bananaBoxFaceSize(sh,o.face);
 if(Math.abs(o.offsetX)+d/2>w/2-3+1e-8||
    Math.abs(o.offsetY)+d/2>h/2-3+1e-8)
  issues.push("The Ø"+d.toFixed(2)+" mm opening does not fit here. Leave 3 mm edge material, use a larger wall, or choose the inside floor.");
 return issues;
}

export function roundMountParts(project:Project,rootId:string,o:RoundMountOptions):ShapeNode[]{
 const sh=identifyShell(rootId,project);
 const errors=roundMountIssues(sh,o);
 if(errors.length)throw new Error(errors.join(" "));
 const model=roundConnector(o.id);
 const diameter=model.cutoutDiameter+o.radialClearance*2;
 let x:number,y:number,z:number,h:number;
 let rotation:[number,number,number];
 if(o.face==="floor"){
  x=sh.cx+o.offsetX;y=sh.cy+o.offsetY;
  z=sh.bottom+sh.floor/2;h=sh.floor+2;rotation=[0,0,0];
 }else if(o.face==="front"||o.face==="back"){
  x=sh.cx+o.offsetX;
  y=sh.cy+(o.face==="front"?-1:1)*(sh.depth/2-sh.wallY/2);
  z=sh.bottom+sh.floor+(sh.height-sh.floor)/2+o.offsetY;
  h=sh.wallY+2;rotation=[Math.PI/2,0,0];
 }else{
  x=sh.cx+(o.face==="left"?-1:1)*(sh.width/2-sh.wallX/2);
  y=sh.cy+o.offsetX;
  z=sh.bottom+sh.floor+(sh.height-sh.floor)/2+o.offsetY;
  h=sh.wallX+2;rotation=[0,Math.PI/2,0];
 }
 const cut=makeShape("cylinder");
 cut.label=model.label+" circular mounting opening";
 cut.params={r:diameter/2,h,segments:64,bevel:0};
 cut.position=[x,y,z];
 cut.rotation=rotation;
 cut.role="hole";
 return [cut];
}

export function planRoundPanelMount(project:Project,rootId:string,o:RoundMountOptions){
 const cutters=roundMountParts(project,rootId,o);
 const plan=planShellFeature(project,rootId,cutters,"Box with "+roundConnector(o.id).label+" opening");
 return {...plan,cutters:cutters.map(c=>c.id)};
}

export function applyRoundPanelMount(rootId:string,o:RoundMountOptions):string{
 let root=rootId;
 useScene.setState(state=>{
  const plan=planRoundPanelMount(state.project,rootId,o);
  root=plan.selectionId;
  return {project:plan.project,selection:[root]};
 });
 return root;
}

