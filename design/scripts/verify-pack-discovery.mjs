// Disposable integration check: a data file alone becomes a real placeable component.
// Operates ONLY in this development copy; refuses to overwrite existing smoke fixtures.
import {readFileSync,writeFileSync,existsSync,unlinkSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {resolve,dirname} from "node:path";
import {spawnSync} from "node:child_process";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const data=resolve(root,"src/extensions/packs/test-only-discovery.json");
const test=resolve(root,"src/extensions/pack-discovery-smoke.test.ts");
if(existsSync(data)||existsSync(test))throw Error("Smoke paths already exist; inspect rather than overwrite.");
const original=JSON.parse(readFileSync(resolve(root,"src/assets/component-library/components.json"),"utf8"));
const component=structuredClone(original.components[0]);
component.id="test-only-discovery";
component.name="Temporary discovery fixture — not a new real product";
const created=[];
try{
 writeFileSync(data,JSON.stringify({apiVersion:1,id:"test.discovery",version:"1.0.0",components:[component]},null,2),"utf8");created.push(data);
 writeFileSync(test,`
import {it,expect,vi} from "vitest";
vi.mock("../state/store",()=>({useScene:{getState:vi.fn(),setState:vi.fn()}}));
import {COMPONENTS,catalogPlacementId} from "../lib/componentCatalog";
import {connectorPrefabNodes} from "../lib/connectorPrefabs";
import {emptyProject} from "../types/scene";
import {parseProjectFile} from "../lib/projectFile";
it("a dropped JSON pack is discovered by the real UI catalogue, placement and save/open path",()=>{
 expect(COMPONENTS).toHaveLength(9);
 const id=catalogPlacementId("test-only-discovery");
 expect(id).toBe("component-test-only-discovery");
 const {group,parts}=connectorPrefabNodes(id!);
 expect(parts[0].params.w).toBe(42);expect(parts[0].params.d).toBe(27);
 expect(group.component?.packId).toBe("test.discovery");
 const project={...emptyProject(),rootOrder:[group.id],nodes:{[group.id]:group,...Object.fromEntries(parts.map(p=>[p.id,p]))}};
 expect(parseProjectFile(JSON.stringify(project))).toEqual(project);
});
`,"utf8");created.push(test);
 const result=spawnSync(process.execPath,[resolve(root,"node_modules/vitest/vitest.mjs"),"run",test],{cwd:root,stdio:"inherit"});
 if(result.error)throw result.error;
 process.exitCode=result.status??1;
}finally{
 for(const path of created.reverse())unlinkSync(path);
 console.log("Temporary test pack and test removed; no product catalogue changed.");
}
