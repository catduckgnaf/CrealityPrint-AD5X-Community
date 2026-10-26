import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { planSpacing, type BoundsItem } from "./spacing";
const b = (id: string, xmin: number, xmax: number, ymin=0, ymax=30): BoundsItem => ({
  id, box: new THREE.Box3(new THREE.Vector3(xmin,ymin,0),new THREE.Vector3(xmax,ymax,10)),
});
describe("exact centre, edge gaps and margins", () => {
  const base=b("base",0,100,0,80);
  it("equal 12 mm margins from opposite outer edges",()=>{
    const p=planSpacing([base,b("left",5,15),b("right",55,65)],"base","even-margins",0,12);
    expect(p.error).toBeUndefined();
    expect(p.moves).toHaveLength(2);
    expect(p.moves[0].delta[0]).toBeCloseTo(7);  // left min moves 5 → 12
    expect(p.moves[1].delta[0]).toBeCloseTo(23); // right min moves 55 → 78
    expect(p.moves.every(m=>m.delta[1]===0 && m.delta[2]===0)).toBe(true);
  });
  it("evenly separates three posts while keeping the edge margins",()=>{
    const p=planSpacing([base,b("a",1,11),b("b",30,40),b("c",45,55)],"base","even-margins",0,12);
    const starts=[1,30,45].map((n,i)=>n+p.moves[i].delta[0]);
    expect(starts[0]).toBeCloseTo(12);
    expect(starts[1]).toBeCloseTo(45);
    expect(starts[2]).toBeCloseTo(78);
  });
  it("rejects layouts that cannot fit instead of overlapping posts",()=>{
    const p=planSpacing([b("base",0,30),b("a",0,12),b("b",20,32)],"base","even-margins",0,8);
    expect(p.error).toMatch(/cannot fit/);
    expect(p.moves).toHaveLength(0);
  });
  it("gap exactly 12 mm right of reference, untouched Y/Z",()=>{
    const p=planSpacing([b("base",0,60),b("post",65,73,10,15)],"base","gap",0,12);
    expect(p.moves).toEqual([{id:"post",delta:[7,0,0]}]);
  });
  it("gap exactly 12 mm left of reference",()=>{
    const p=planSpacing([b("base",0,60),b("post",-18,-10)],"base","gap",0,12,"minus");
    expect(p.moves).toEqual([{id:"post",delta:[-2,0,0]}]);
  });
  it("center XY keeps Z and reference unchanged",()=>{
    const p=planSpacing([base,b("post",0,10,0,10)],"base","center-xy",0,0);
    expect(p.moves).toEqual([{id:"post",delta:[45,35,0]}]);
  });
  it("margins work along Y for front and back posts",()=>{
    const p=planSpacing([base,b("front",0,10,0,10),b("back",0,10,40,50)],"base","even-margins",1,12);
    expect(p.moves).toEqual([{id:"front",delta:[0,12,0]},{id:"back",delta:[0,18,0]}]);
  });
  it("invalid negative margins are rejected",()=>{
    expect(planSpacing([base,b("a",0,10)],"base","gap",0,-12).error).toMatch(/0 and 1000/);
  });
});
