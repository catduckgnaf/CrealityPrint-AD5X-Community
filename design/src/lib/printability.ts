
export interface BedIssue {id:string;message:string;severity:"warning"|"unknown";}
export interface ShapeBounds {min:{x:number;y:number;z:number};max:{x:number;y:number;z:number};}
/** Checks visual world AABBs, not manifold validity or slicer G-code. */
export function checkPrintableBounds(id:string,box:ShapeBounds,bed:[number,number]|null,height=220):BedIssue[]{
  const issues:BedIssue[]=[];
  if(!bed||bed[0]<=0||bed[1]<=0) {
    issues.push({id,severity:"unknown",message:"Build-plate size is not configured."});
    return issues;
  }
  if(![box.min.x,box.min.y,box.min.z,box.max.x,box.max.y,box.max.z].every(Number.isFinite)){
    return [{id,severity:"unknown",message:"Could not evaluate model bounds."}];
  }
  const halfW=bed[0]/2,halfD=bed[1]/2,t=0.05;
  if(box.min.x< -halfW-t||box.max.x>halfW+t||box.min.y< -halfD-t||box.max.y>halfD+t)
    issues.push({id,severity:"warning",message:"Extends outside the printable X/Y plate."});
  if(box.min.z< -t)
    issues.push({id,severity:"warning",message:"Part of the object is below Z=0."});
  if(box.max.z>height+t)
    issues.push({id,severity:"warning",message:"Extends above the "+height+" mm height limit."});
  if(box.max.z<t)
    issues.push({id,severity:"warning",message:"Object is not above the build plate."});
  return issues;
}
