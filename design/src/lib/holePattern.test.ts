import { describe, it, expect } from "vitest";
import * as THREE from "three";
import {planHolePattern} from "./holePattern";
const bounds = new THREE.Box3(new THREE.Vector3(0,0,0),new THREE.Vector3(100,60,8));

describe("one-click hole pattern",()=>{
  it("creates two centered holes 12mm from opposite X edges",()=>{
    const p=planHolePattern(bounds,"two",12,4);
    expect(p.error).toBeUndefined();
    expect(p.points).toEqual([[12,30,4],[88,30,4]]);
    expect(p.height).toBe(10);
  });
  it("chooses the longer Y side for two holes in a tall bracket",()=>{
    const tall=new THREE.Box3(new THREE.Vector3(0,0,0),new THREE.Vector3(30,100,6));
    const p=planHolePattern(tall,"two",12,4);
    expect(p.error).toBeUndefined();
    expect(p.points).toEqual([[15,12,3],[15,88,3]]);
    expect(p.height).toBe(8);
  });
  it("rejects too little length on the selected long side",()=>{
    const small=new THREE.Box3(new THREE.Vector3(0,0,0),new THREE.Vector3(8,20,6));
    expect(planHolePattern(small,"two",12,4).error).toMatch(/length/);
  });
  it("creates four corner holes with 12mm centre margins",()=>{
    const p=planHolePattern(bounds,"four",12,4);
    expect(p.points).toEqual([[12,12,4],[12,48,4],[88,12,4],[88,48,4]]);
  });
  it("uses translated world bounds, not origin",()=>{
    const moved=bounds.clone().translate(new THREE.Vector3(200,-25,10));
    const p=planHolePattern(moved,"two",12,4);
    expect(p.points).toEqual([[212,5,14],[288,5,14]]);
  });
  it("refuses a hole crossing the outside edge",()=>{
    expect(planHolePattern(bounds,"four",2,6).error).toMatch(/too wide/);
  });
  it("refuses holes that cannot fit across width",()=>{
    expect(planHolePattern(bounds,"four",50,4).error).toMatch(/room/);
  });
  it("refuses four holes that cannot fit in depth",()=>{
    expect(planHolePattern(bounds,"four",30,4).error).toMatch(/room/);
  });
  it("refuses excessive size, NaN and negative inputs",()=>{
    expect(planHolePattern(bounds,"two",12,101).error).toBeTruthy();
    expect(planHolePattern(bounds,"two",NaN,4).error).toBeTruthy();
    expect(planHolePattern(bounds,"two",12,-1).error).toBeTruthy();
  });
  it("cutter extends beyond both faces, and does not modify bounds",()=>{
    const before=bounds.clone();
    const p=planHolePattern(bounds,"four",10,5);
    expect(p.height).toBe(10);
    expect(bounds.equals(before)).toBe(true);
  });
});
