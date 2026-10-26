/** Stable provenance for generated geometry.
 * Names are user-editable DISPLAY TEXT and must never be used as CAD identities.
 * This module has NO dependencies on the store, so it is safe in models,
 * serialisation, context menus and Undo/Redo.
 */
import {isGroup,type GroupNode,type Project,type SceneNode,type ShapeNode,type GeneratedFeature} from "../types/scene";
const legal=(s:SceneNode):GeneratedFeature|undefined=>{
 if(isGroup(s)){
  if(s.label==="Box with dividers"||s.label==="Box (dividers removed)")return "divider-layer";
  if(s.label==="Box with removable-pin hinge")return "hinge-box";
  if(s.label==="Lid with removable-pin hinge")return "hinge-lid";
 }else{
  if(s.label==="Partial lengthwise divider")return "partial-divider-x";
  if(s.label==="Partial widthwise divider")return "partial-divider-y";
 }
 return undefined;
};
export const generatedFeature=(node:SceneNode|undefined):GeneratedFeature|undefined=>
 node?.feature??(node?legal(node):undefined);
export const preserveFeatureOnRename=<T extends SceneNode>(node:T):T=>{
 if(node.feature)return node;
 const old=legal(node);
 return old?{...node,feature:old}:node;
};
const near=(a:number,b:number,tolerance=.035)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=tolerance;

/** Conservative backwards compatibility with pre-metadata scenes where the
 * wrapper was already renamed: only recognise actual Boolean hollow shells
 * wrapped with FULL-LENGTH thin, solid divider walls. Do NOT guess arbitrary
 * partial dividers, unrelated mounting tabs or edited custom assemblies.
 */
function legacyDividerShape(project:Pick<Project,"nodes">,root:GroupNode):boolean{
 if(root.childIds.length<2)return false;
 const additions=root.childIds.slice(1).map(id=>project.nodes[id]);
 if(!additions.length||additions.some(node=>!node||isGroup(node)))return false;
 const walls=additions as ShapeNode[];
 if(walls.some(n=>n.kind!=="box"||n.role!=="solid"||n.hidden||n.locked||
  n.rotation.some(v=>!near(v,0,.00001))||n.scale.some(v=>!near(v,1,.00001))))return false;
 let id=root.childIds[0];const seen=new Set<string>();
 for(let depth=0;depth<12;depth++){
  if(seen.has(id))return false;seen.add(id);
  const node=project.nodes[id];
  if(!node||!isGroup(node))return false;
  if(node.childIds.length===2){
   const a=project.nodes[node.childIds[0]],b=project.nodes[node.childIds[1]];
   if(a&&b&&!isGroup(a)&&!isGroup(b)&&a.role==="solid"&&b.role==="hole"&&
      a.kind==="box"&&b.kind==="box"){
    const w=Number(b.params.w),d=Number(b.params.d);
    if(!(w>0&&d>0)||!(Number(a.params.w)>w&&Number(a.params.d)>d))return false;
    return walls.every(v=>{
      const vw=Number(v.params.w),vd=Number(v.params.d);
      // A full-span divider projects just past both cavity faces.
      const x=vw>0&&vw<=6&&near(vd,d+.65,.15);
      const y=vd>0&&vd<=6&&near(vw,w+.65,.15);
      return x!==y;
    });
   }
  }
  const next=project.nodes[node.childIds[0]];
  if(!next||!isGroup(next))return false;
  id=next.id;
 }
 return false;
}
export function isGeneratedDividerLayer(node:SceneNode|undefined,project?:Pick<Project,"nodes">):boolean{
 if(!node||!isGroup(node))return false;
 return generatedFeature(node)==="divider-layer"||
   (!!project&&legacyDividerShape(project,node));
}
export function partialDividerAxis(node:SceneNode|undefined):"x"|"y"|null{
 if(!node||isGroup(node))return null;
 const f=generatedFeature(node);
 return f==="partial-divider-x"?"x":f==="partial-divider-y"?"y":null;
}
/** A legacy, already-renamed hinge can be identified without display names:
 * the exact 1/2 [web, barrel, bore] triplets made by v19.5.53. Only these
 * geometry identities count; loose boxes, posts and general hole patterns
 * must not be mistaken for a hinge.
 */
function structuralHinge(project:Pick<Project,"nodes">,node:GroupNode):boolean{
 const extra=node.childIds.slice(1);
 if(extra.length!==3&&extra.length!==6)return false;
 for(let i=0;i<extra.length;i+=3){
  const items=extra.slice(i,i+3).map(id=>project.nodes[id]);
  if(items.some(v=>!v||isGroup(v)))return false;
  const [web,barrel,bore]=items as ShapeNode[];
  if(web.kind!=="box"||web.role!=="solid"||
    barrel.kind!=="cylinder"||barrel.role!=="solid"||
    bore.kind!=="cylinder"||bore.role!=="hole")return false;
  if(!barrel.position.every((v,j)=>near(v,bore.position[j],1e-4))||
    !barrel.rotation.every((v,j)=>near(v,bore.rotation[j],1e-4)))return false;
  if(Number(barrel.params.r)<=Number(bore.params.r)+.5||
    Number(bore.params.h)<Number(barrel.params.h))return false;
 }
 return true;
}
export function isGeneratedHingeWrapper(project:Pick<Project,"nodes">,node:SceneNode|undefined):boolean{
 if(!node||!isGroup(node))return false;
 const f=generatedFeature(node);
 return f==="hinge-box"||f==="hinge-lid"||structuralHinge(project,node);
}