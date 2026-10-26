import type {CutoutPlugin} from "../contracts";
export function nominalDProfile(diameter:number,flatToOpposite:number):[number,number][]{
 if(!Number.isFinite(diameter)||!Number.isFinite(flatToOpposite)||diameter<=0||flatToOpposite<=diameter/2||flatToOpposite>diameter)
  throw Error("Invalid nominal D-shaped panel measurements.");
 const r=diameter/2,a=Math.acos((r-flatToOpposite)/r),points:[number,number][]=[];
 for(let i=0;i<=120;i++){const angle=-a+2*a*i/120;points.push([Number((r*Math.cos(angle)).toFixed(6)),Number((r*Math.sin(angle)).toFixed(6))]);}
 return points;
}
const plugins:CutoutPlugin[]=[
 {apiVersion:1,id:"ad5x.rectangle-opening",version:"1.0.0",shape:"rectangle",requiredPrimitives:["box"],
 create(c,depth,backend){if(c.shape!=="rectangle")throw Error("Wrong cutout plugin");const n=backend.createShape("box");
 n.params={w:c.width_mm,d:c.height_mm,h:depth,radius:0};return n;}},
 {apiVersion:1,id:"ad5x.d-flat-opening",version:"1.0.0",shape:"d_flat_circle",requiredPrimitives:["sketch"],
 create(c,depth,backend){if(c.shape!=="d_flat_circle")throw Error("Wrong cutout plugin");const n=backend.createShape("sketch");
 n.params={profile:JSON.stringify(nominalDProfile(c.dxf_uses_nominal_diameter_mm,c.dxf_uses_nominal_flat_to_opposite_mm)),h:depth};return n;}},
];
export default plugins;
