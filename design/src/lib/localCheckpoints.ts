import type {Project} from "../types/scene";
import {accountKey} from "../state/cloudSync";
import {useAuth} from "../state/auth";

/** Separate, bounded IndexedDB checkpoints. Never writes over original files
 * or modifies the existing Sculpo cloud/IndexedDB autosave store. */
export interface Checkpoint {
  key:string;
  account:string;
  projectId:string;
  name:string;
  savedAt:number;
  reason:string;
  project:Project;
}
const DB="ad5x-design-checkpoints";
const STORE="snapshots";
const MAX_GLOBAL=20, MAX_PER_PROJECT=5;
let openPromise:Promise<IDBDatabase>|null=null;

function account():string {return accountKey(useAuth.getState().user?.username??null);}

function database():Promise<IDBDatabase> {
  if(openPromise)return openPromise;
  openPromise=new Promise<IDBDatabase>((resolve,reject)=>{
    const req=indexedDB.open(DB,1);
    req.onupgradeneeded=()=>{
      if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE,{keyPath:"key"});
    };
    req.onerror=()=>reject(req.error||new Error("Checkpoints unavailable"));
    req.onsuccess=()=>{
      req.result.onversionchange=()=>{req.result.close();openPromise=null;};
      resolve(req.result);
    };
  }).catch(e=>{openPromise=null;throw e;});
  return openPromise!;
}

async function transaction<T>(mode:IDBTransactionMode,request:(store:IDBObjectStore)=>IDBRequest<T>):Promise<T>{
  const db=await database();
  return new Promise<T>((resolve,reject)=>{
    const tx=db.transaction(STORE,mode);
    const req=request(tx.objectStore(STORE));
    let value:T;
    req.onsuccess=()=>{value=req.result;};
    tx.oncomplete=()=>resolve(value);
    tx.onerror=()=>reject(tx.error||new Error("Checkpoint transaction failed"));
    tx.onabort=()=>reject(tx.error||new Error("Checkpoint transaction aborted"));
  });
}
async function all():Promise<Checkpoint[]> {
  return transaction("readonly",s=>s.getAll()) as Promise<Checkpoint[]>;
}
export async function listCheckpoints():Promise<Checkpoint[]> {
  const key=account();
  return (await all()).filter(c=>c.account===key).sort((a,b)=>b.savedAt-a.savedAt);
}
export async function saveCheckpoint(project:Project,reason:"Automatic"|"Manual"|"Before restore"):Promise<Checkpoint>{
  if(!project.rootOrder.length)throw new Error("Nothing to checkpoint yet.");
  const savedAt=Date.now();
  const entry:Checkpoint={
    key:account()+"|"+project.id+"|"+savedAt+"|"+Math.random().toString(36).slice(2,9),
    account:account(),projectId:project.id,name:project.name,
    savedAt,reason,project:JSON.parse(JSON.stringify(project)) as Project,
  };
  await transaction("readwrite",s=>s.put(entry));
  const entries=await listCheckpoints();
  const keep=new Set<string>();const counts=new Map<string,number>();
  for(const item of entries){
    const n=counts.get(item.projectId)??0;
    if(n<MAX_PER_PROJECT && keep.size<MAX_GLOBAL) {
      keep.add(item.key);counts.set(item.projectId,n+1);
    }
  }
  for(const item of entries){
    if(!keep.has(item.key))await transaction("readwrite",s=>s.delete(item.key));
  }
  return entry;
}
export async function deleteCheckpoint(key:string):Promise<void>{
  const items=await listCheckpoints();
  if(!items.some(i=>i.key===key))throw new Error("Checkpoint not found");
  await transaction("readwrite",s=>s.delete(key));
}
