import * as THREE from "three";

/** Parametric bend around local Y, bending the length (local X) into XZ.
 * All dimensions are mm. The neutral axis maintains its arc length. */
export function maxBendAngle(width:number, height:number):number {
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)return 0;
  // The inside bend radius must remain larger than the half-thickness
  // so vertices never invert; limit to 150° for initial solid-box support.
  const radiusLimit=height/2+0.75;
  return Math.max(0,Math.min(150,(width/radiusLimit)*180/Math.PI*0.95));
}
export function checkedBendAngle(angle:number,width:number,height:number):number {
  const max=maxBendAngle(width,height);
  if(!Number.isFinite(angle)||Math.abs(angle)>max+0.001) {
    throw new Error("Bend angle exceeds the safe limit of "+max.toFixed(1)+"° for this box.");
  }
  return angle;
}
export function bendNeutralPoint(x:number,z:number,width:number,angleDegrees:number):[number,number] {
  if(Math.abs(angleDegrees)<0.00001)return [x,z];
  const theta=angleDegrees*Math.PI/180;
  const radius=width/theta;
  const phi=x/radius;
  return [(radius-z)*Math.sin(phi),radius*(1-Math.cos(phi))+z*Math.cos(phi)];
}
/** Generates closed, subdivision-rich printable geometry instead of a shader
 * deformation. Used by Design display, group booleans and STL export alike. */
export function bentBoxGeometry(width:number,depth:number,height:number,angle:number):THREE.BufferGeometry {
  checkedBendAngle(angle,width,height);
  const segments=Math.min(160,Math.max(12,Math.ceil(width/1.5)));
  const geo=new THREE.BoxGeometry(width,depth,height,segments,1,1);
  if(Math.abs(angle)<0.00001)return geo;
  const pos=geo.getAttribute("position") as THREE.BufferAttribute;
  const norms=geo.getAttribute("normal") as THREE.BufferAttribute;
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i),z=pos.getZ(i),nx=norms.getX(i),nz=norms.getZ(i);
    const phi=x/(width/(angle*Math.PI/180));
    const [newX,newZ]=bendNeutralPoint(x,z,width,angle);
    pos.setXYZ(i,newX,pos.getY(i),newZ);
    norms.setXYZ(i,nx*Math.cos(phi)-nz*Math.sin(phi),norms.getY(i),nx*Math.sin(phi)+nz*Math.cos(phi));
  }
  pos.needsUpdate=true;
  norms.needsUpdate=true;
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}
