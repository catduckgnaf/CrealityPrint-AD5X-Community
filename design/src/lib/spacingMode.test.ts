import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { distanceBetween, planSpacing, type BoundsItem, type DistanceMode } from "./spacing";

const box = (id: string, x0:number, x1:number,y0=0,y1=20):BoundsItem => ({
  id, box:new THREE.Box3(new THREE.Vector3(x0,y0,0),new THREE.Vector3(x1,y1,8)),
});
const ref = box("base",0,100);
const post = box("post",30,40);

describe("distance mode choices",()=>{
  it("reads center-to-center distances, not the object edges",()=>{
    expect(distanceBetween(ref.box,post.box,0,"plus","center-distance")).toBeCloseTo(-15);
    expect(distanceBetween(ref.box,box("right",75,85).box,0,"plus","center-distance")).toBeCloseTo(30);
  });
  it("reads edge-to-edge clearance",()=>{
    expect(distanceBetween(ref.box,box("right",112,120).box,0,"plus","gap")).toBeCloseTo(12);
  });
  it("reads edge-to-center from reference edge",()=>{
    expect(distanceBetween(ref.box,box("right",107,117).box,0,"plus","edge-center")).toBeCloseTo(12);
  });
  for (const mode of ["center-distance","gap","edge-center"] as DistanceMode[]) {
    it("places the moving object at exactly 60 mm using "+mode,()=>{
      const moving = box("right",130,150);
      const p=planSpacing([ref,moving],"base",mode,0,60,"plus");
      expect(p.error).toBeUndefined();
      const shifted=moving.box.clone().translate(new THREE.Vector3(p.moves[0].delta[0],0,0));
      expect(distanceBetween(ref.box,shifted,0,"plus",mode)).toBeCloseTo(60,6);
      expect(p.moves[0].delta[1]).toBe(0);
      expect(p.moves[0].delta[2]).toBe(0);
    });
  }
  it("places hole centers 12 mm from both opposing base edges",()=>{
    const left=box("left",0,10),right=box("right",40,50);
    const p=planSpacing([ref,left,right],"base","even-centers",0,12);
    expect(p.moves).toHaveLength(2);
    expect((left.box.min.x+left.box.max.x)/2 + p.moves[0].delta[0]).toBeCloseTo(12);
    expect((right.box.min.x+right.box.max.x)/2 + p.moves[1].delta[0]).toBeCloseTo(88);
  });
  it("evenly places three hole centers between fixed end margins",()=>{
    const a=box("a",0,10),b=box("b",20,30),c=box("c",60,70);
    const p=planSpacing([ref,a,b,c],"base","even-centers",0,12);
    const actual=[a,b,c].map((q,i)=>q.box.getCenter(new THREE.Vector3()).x+p.moves[i].delta[0]);
    expect(actual).toEqual([12,50,88]);
  });
  it("allows negative signed measurements, but requires a nonnegative target",()=>{
    expect(planSpacing([ref,post],"base","center-distance",0,-2).error).toMatch(/0 and 1000/);
  });
  it("calculates rearward centre spacing on Y without changing X",()=>{
    const a=box("ref",0,20,0,20),b=box("moving",0,20,40,60);
    const p=planSpacing([a,b],"ref","center-distance",1,15,"minus");
    expect(p.moves).toEqual([{id:"moving",delta:[0,-55,0]}]);
  });
});
