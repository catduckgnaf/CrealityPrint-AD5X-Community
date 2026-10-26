import type {ShapeNode} from "../types/scene";
import {makeShape} from "./primitives";
import {indexedClampParts,type IndexedClampOptions} from "./workshopTools";

/**
 * Functional candidate for the existing indexed PCB/connector clamp.
 *
 * Coarse adjustment: a pair of physically separated peg/hole rows, preventing
 * yaw rotation that the original single peg could not prevent.
 *
 * Fine adjustment: a real M4 machine screw passing through the movable jaw
 * and an M4 hex nut seated in its rear pocket pushes a separately printable
 * broad pressure pad. NO imaginary plastic threads or calibrated grip force.
 *
 * Assembly hardware: one real M4 nut and an approximately 25–30 mm M4 screw,
 * chosen to give the required reach at the selected index. The printed pad is
 * placed on the base in front of the movable jaw when clamping.
 *
 * Saved geometry is PRINT LAYOUT: base, parked jaw and pad are three separate
 * nonintersecting objects. Pin registration, screw stroke and pressure-pad
 * sliding are physical assembly actions, not claimed functional until printed.
 */
export function indexedScrewClampParts(options:IndexedClampOptions):ShapeNode[]{
  // Keep the original generator and its input checks available for recovery.
  const original=indexedClampParts(options);
  const {workWidth,workDepth,pegDiameter,clearance,step}=options;
  const jaw=original.find(x=>x.label==="Removable indexed jaw (print separately)");
  const peg=original.find(x=>x.label==="Removable jaw locating peg");
  const bores=original.filter(x=>x.role==="hole");
  if(!jaw||!peg||bores.length<2)throw new Error("Original clamp geometry is incomplete.");
  const jawWidth=12;
  const parkedX=jaw.position[0], jawDepth=workDepth-12;
  const boreRadius=(pegDiameter+clearance)/2;
  // Leave two separated strips of material between anti-yaw peg seats,
  // the separate pressure-pad guide grooves, and the M4 nut pocket.
  const pinY=Math.min(13,jawDepth/2-boreRadius-2.2);
  if(pinY<11 || jawDepth/2-pinY-boreRadius<2)
    throw new Error("Clamp depth is too narrow for paired locating pegs and guided pressure pad.");
  // Overall printable X span includes the separate pad and its two tongues.
  if(workWidth+50>218)
    throw new Error("Clamp base plus parked guided pad exceeds the AD5X 220 mm build plate.");
  // Account for increasing the movable jaw width from 8 mm to 12 mm.
  const lastX=Math.max(...bores.map(b=>b.position[0]))+2;
  if(workWidth/2-lastX-boreRadius<4)
    throw new Error("Clamp end index requires 4 mm printable edge material for the wider jaw.");
  if(step>12)
    throw new Error("The M4 fine-adjustment screw must bridge every index gap; use steps of 12 mm or less.");
  const parts=original;
  jaw.params={...jaw.params,w:jawWidth};
  jaw.label="Two-peg screw clamp movable jaw — M4 nut";
  jaw.feature="indexed-m4-clamp"; // stable identity; names may be edited
  // Spread both peg axes along Y without moving the screw bore at Y=0.
  peg.position=[parkedX,-pinY,3.2];
  peg.label="Clamp locating peg left";
  const secondPeg=makeShape("cylinder");
  secondPeg.params={r:pegDiameter/2,h:6.4,segments:64,bevel:0};
  secondPeg.position=[parkedX,pinY,3.2];
  secondPeg.role="solid";
  secondPeg.label="Clamp locating peg right";
  parts.push(secondPeg);
  // The two existing rows are registered to the SAME index station.
  // Avoid shared cutter IDs: every hole is a separate editable child.
  for(let i=0;i<bores.length;i++){
    const bore=bores[i];
    const x=bore.position[0]+(jawWidth-8)/2;
    bore.position=[x,-pinY,bore.position[2]];
    bore.label="Clamp station "+(i+1)+" left bore";
    const mate=makeShape("cylinder");
    mate.params={r:boreRadius,h:Number(bore.params.h),segments:64,bevel:0};
    mate.position=[x,pinY,bore.position[2]];
    mate.role="hole";
    mate.label="Clamp station "+(i+1)+" right bore";
    parts.push(mate);
  }
  const horizontalCylinder=(diameter:number,length:number,x:number,y:number,z:number,segments:number,label:string):ShapeNode=>{
    const cut=makeShape("cylinder");
    cut.params={r:diameter/2,h:length,segments,bevel:0};
    cut.position=[x,y,z];
    cut.rotation=[0,Math.PI/2,0]; // scene rotations are radians
    cut.role="hole";
    cut.label=label;
    return cut;
  };
  // Through-hole does not supply threads. M4 nut is compulsory for real grip.
  parts.push(horizontalCylinder(4.5,jawWidth+2,parkedX,0,11,64,"M4 clearance through movable jaw"));
  // Standard M4 nut: nominal 7 mm across flats. Six-sided pocket ~7.27 AF,
  // nominal 4.2 mm deep, open on the jaw's RIGHT side for inserting nut.
  parts.push(horizontalCylinder(8.4,4.3,parkedX+jawWidth/2-2.1,0,11,6,"M4 hex nut pocket — insert nut from rear"));
  // The pressure plate uses TWO linear tongues engaging underside grooves
  // in the jaw. This constrains pad yaw/tip while the M4 screw pushes it.
  // All three components are printed separately in flat Z=0 layouts.
  for(const side of [-1,1]){
    const slot=makeShape("box");
    slot.params={w:jawWidth+2,d:3.8,h:3.6,radius:0};
    slot.position=[parkedX,side*7,7.8]; // open to underside z=6
    slot.role="hole";
    slot.label=side<0?"Pressure-pad left guide groove":"Pressure-pad right guide groove";
    parts.push(slot);
  }
  // Broad removable pressure plate rests on base during actual assembly.
  // Park beside the jaw while printing; a shallow recess seats screw tip.
  const padX=parkedX+18;
  const pad=makeShape("box");
  pad.params={w:4,d:Math.min(jawDepth-4,24),h:12,radius:0};
  pad.position=[padX,0,6];
  pad.label="Separate sliding clamp pressure pad";
  pad.role="solid";
  parts.push(pad);
  for(const side of [-1,1]){
    const tongue=makeShape("box");
    tongue.params={w:17.4,d:3,h:3,radius:0};
    tongue.position=[padX+2+8.4,side*7,1.5];
    tongue.role="solid";
    tongue.label=side<0?"Sliding pad left guide tongue":"Sliding pad right guide tongue";
    parts.push(tongue);
  }
  parts.push(horizontalCylinder(5,1.8,padX+2-0.6,0,5,64,"Pressure-pad screw nose seat"));
  // Print the jaw flat with its two locating pegs pointing UP. Previously
  // the jaw floated 6 mm above the plate on pegs, causing unsupported spans.
  // All jaw holes/grooves are reflected with the jaw, preserving assembly fit.
  for(const item of parts){
    if(item===jaw || item===peg || item===secondPeg ||
       item.label==="M4 clearance through movable jaw" ||
       item.label?.startsWith("M4 hex nut pocket") ||
       item.label?.startsWith("Pressure-pad left guide groove") ||
       item.label?.startsWith("Pressure-pad right guide groove")){
      item.position=[item.position[0],item.position[1],18-item.position[2]];
    }
  }
  // Flip the jaw during assembly so the pins face DOWN into the indexed base.
  // The separately printed pressure pad then rests on the 6 mm base.
  return parts;
}
