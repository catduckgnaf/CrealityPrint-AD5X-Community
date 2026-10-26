import {create} from "zustand";
export type PlaneAxis="x"|"y"|"z";
interface AdvancedView{
  sectionEnabled:boolean;
  sectionAxis:PlaneAxis;
  sectionOffset:number;
  imageUrl:string|null;
  imageWidth:number;
  imageRatio:number;
  imageOpacity:number;
  setSection:(enabled:boolean,axis:PlaneAxis,offset:number)=>void;
  setReference:(url:string|null,width:number,ratio:number,opacity:number)=>void;
}
export const useAdvancedView=create<AdvancedView>()(set=>({
  sectionEnabled:false,sectionAxis:"z",sectionOffset:12,
  imageUrl:null,imageWidth:100,imageRatio:1,imageOpacity:0.5,
  setSection:(sectionEnabled,sectionAxis,sectionOffset)=>set({sectionEnabled,sectionAxis,sectionOffset}),
  setReference:(imageUrl,imageWidth,imageRatio,imageOpacity)=>set({imageUrl,imageWidth,imageRatio,imageOpacity}),
}));
