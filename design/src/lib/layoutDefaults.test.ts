import { describe, it, expect } from "vitest";
import * as THREE from "three";
import {chooseFixed, chooseAxis} from "./layoutDefaults";
const item = (id:string, x:number, y:number, w:number, h:number) => ({
  id,box:new THREE.Box3(new THREE.Vector3(x,y,0),new THREE.Vector3(x+w,y+h,5)),
});
describe("simple positioning defaults",()=>{
 it("keeps the first selected object fixed for a pair",()=>{
  expect(chooseFixed([item("post",0,0,10,10),item("base",0,0,100,100)])).toBe("post");
 });
 it("uses the largest base as fixed reference with three shapes",()=>{
  const s=[item("post",10,10,8,8),item("base",0,0,100,30),item("post2",80,10,8,8)];
  expect(chooseFixed(s)).toBe("base");
 });
 it("guesses X for posts distributed left to right",()=>{
  const s=[item("base",0,0,100,30),item("left",5,10,8,8),item("right",80,10,8,8)];
  expect(chooseAxis(s,"base")).toBe(0);
 });
 it("guesses Y for posts distributed front to back",()=>{
  const s=[item("base",0,0,30,100),item("front",10,5,8,8),item("back",10,80,8,8)];
  expect(chooseAxis(s,"base")).toBe(1);
 });
 it("guesses Y for an above/below pair",()=>{
  expect(chooseAxis([item("a",10,0,10,10),item("b",12,60,10,10)],"a")).toBe(1);
 });
});
