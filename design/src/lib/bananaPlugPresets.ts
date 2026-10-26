/**
 * Banana PLUG holder choices supported by dated manufacturer / distributor information.
 * The nominal contact/pin diameter is not necessarily the insulated BODY diameter.
 * Neither number includes printer-specific fit clearance. Custom remains mandatory for
 * unidentified bodies. This list is not a mechanical press-fit guarantee.
 *
 * Source references (checked 2026-10-22):
 * RS Components: https://uk.rs-online.com/web/content/product-knowledge/electrical-and-electronics/cables-and-connectors/banana-plugs-guide
 * Warwick: https://us.warwickts.com/2149/Guide-to-Banana-Plugs
 * Radiall: https://www.radiall.com/media/document_library/COAX_Section20_2017_Banana.pdf
 * NPA: https://www.npa.com.au/pcb-hardware
 */
export type BananaPlugPresetId =
 "mini2-contact"|"mini3-contact"|"standard4-contact"|"us45-contact"|
 "npa-k6081-body"|"radiall-r941330-body"|"insulated4-body"|
 "shrouded4-body"|"stackable4-body"|"custom";

export type BananaPlugPreset={
 id:BananaPlugPresetId;
 label:string;
 measuredPart:"metal contact"|"insulated body"|"user measurement";
 holeDiameterMm:number|null;
 note:string;
 sourceName:string;
 sourceUrl:string;
};

/** Null = no universal verified body size. The input must be supplied manually. */
export const BANANA_PLUG_PRESETS:readonly BananaPlugPreset[]=[
 {
  id:"mini2-contact",label:"2 mm mini — metal contact",measuredPart:"metal contact",
  holeDiameterMm:2,note:"Nominal 2 mm contact. NOT the outside of an insulated grip or a guaranteed sliding fit.",
  sourceName:"Radiall 2 mm series",sourceUrl:"https://www.radiall.com/media/document_library/COAX_Section20_2017_Banana.pdf"
 },
 {
  id:"mini3-contact",label:"3 mm mini — metal contact",measuredPart:"metal contact",
  holeDiameterMm:3,note:"A mini connector nominal size; not a universal insulated body diameter.",
  sourceName:"RS Components banana-plug guide",sourceUrl:"https://uk.rs-online.com/web/content/product-knowledge/electrical-and-electronics/cables-and-connectors/banana-plugs-guide"
 },
 {
  id:"standard4-contact",label:"4 mm standard — metal contact",measuredPart:"metal contact",
  holeDiameterMm:4,note:"Common nominal banana contact size. Insulated 4 mm plugs can have much larger bodies.",
  sourceName:"RS Components banana-plug guide",sourceUrl:"https://uk.rs-online.com/web/content/product-knowledge/electrical-and-electronics/cables-and-connectors/banana-plugs-guide"
 },
 {
  id:"us45-contact",label:"4.5 mm type — metal contact",measuredPart:"metal contact",
  holeDiameterMm:4.5,note:"A less common nominal plug series. Verify against your exact part before printing.",
  sourceName:"NPA PCB Hardware banana plugs",sourceUrl:"https://www.npa.com.au/pcb-hardware"
 },
 {
  id:"npa-k6081-body",label:"NPA K6081 — 9.5 mm body",measuredPart:"insulated body",
  holeDiameterMm:9.5,note:"Specific 4.5 mm-series solder-mount plug listed with a 9.5 mm outside diameter; only for this exact model.",
  sourceName:"NPA K6081 specifications",sourceUrl:"https://www.npa.com.au/pcb-hardware"
 },
 {
  id:"radiall-r941330-body",label:"Radiall R941 330 — 10 mm body",measuredPart:"insulated body",
  holeDiameterMm:10,note:"Insulated 4 mm plug family with a Ø10 drawing callout; verify the actual grip section before using.",
  sourceName:"Radiall 4 mm banana catalog",sourceUrl:"https://www.radiall.com/media/document_library/COAX_Section20_2017_Banana.pdf"
 },
 {
  id:"insulated4-body",label:"4 mm insulated plug — measure body",measuredPart:"insulated body",
  holeDiameterMm:null,note:"The 4 mm designation refers to the contact, NOT the housing. Measure the body you want to hold.",
  sourceName:"Mueller banana plug catalog",sourceUrl:"https://www.muellerelectric.com/products/category/banana-connectors"
 },
 {
  id:"shrouded4-body",label:"4 mm shrouded plug — measure body",measuredPart:"insulated body",
  holeDiameterMm:null,note:"Safety shrouds and protective sleeves vary by model. A 4 mm hole would NOT hold the housing.",
  sourceName:"Mueller banana plug catalog",sourceUrl:"https://www.muellerelectric.com/products/category/banana-connectors"
 },
 {
  id:"stackable4-body",label:"4 mm stackable plug — measure body",measuredPart:"insulated body",
  holeDiameterMm:null,note:"Stackable bodies vary substantially. Measure the portion to be held; nominal contact remains 4 mm.",
  sourceName:"Radiall banana-plug catalog",sourceUrl:"https://www.radiall.com/media/document_library/COAX_Section20_2017_Banana.pdf"
 },
 {
  id:"custom",label:"Custom measured diameter…",measuredPart:"user measurement",
  holeDiameterMm:null,note:"Enter the real diameter you need, with any fit allowance you choose after measuring or testing.",
  sourceName:"User-entered",sourceUrl:""
 }
] as const;

export function bananaPlugPreset(id:BananaPlugPresetId):BananaPlugPreset{
 const choice=BANANA_PLUG_PRESETS.find(p=>p.id===id);
 if(!choice)throw new Error("Unknown banana-plug size selection.");
 return choice;
}

