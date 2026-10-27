const DB='print-doctor', ST='log';
function open(){return new Promise((res,rej)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>r.result.createObjectStore(ST,{keyPath:'id',autoIncrement:true});r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});}
async function tx(mode,fn){const db=await open();return new Promise((res,rej)=>{const t=db.transaction(ST,mode);const r=fn(t.objectStore(ST));t.oncomplete=()=>res(r&&r.result);t.onerror=()=>rej(t.error);});}
export const addEntry=(e)=>tx('readwrite',s=>s.add({...e,date:Date.now()}));
export const listEntries=async()=>((await tx('readonly',s=>s.getAll()))||[]).sort((a,b)=>b.date-a.date);
export const deleteEntry=(id)=>tx('readwrite',s=>s.delete(id));
