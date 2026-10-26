import config from "./config.json";
import raw from "../assets/component-library/components.json";
import type {ComponentPack,CutoutPlugin} from "./contracts";
import {createComponentRegistry,createCutoutRegistry} from "./registry";
// Deterministic build-time discovery. No runtime downloads, eval, installers or dependencies.
const packs=import.meta.glob<ComponentPack>("./packs/*.json",{eager:true,import:"default"});
const modules=import.meta.glob<CutoutPlugin[]>("./plugins/*.plugin.ts",{eager:true,import:"default"});
export const componentRegistry=createComponentRegistry([
 {apiVersion:1,id:"ad5x.starter",version:raw.library_version,components:raw.components as unknown as ComponentPack["components"]},
 ...Object.keys(packs).sort().map(key=>packs[key]),
],config);
export const cutoutRegistry=createCutoutRegistry(Object.keys(modules).sort().flatMap(key=>modules[key]));
