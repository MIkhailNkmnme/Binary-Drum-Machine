/* Local support data is deliberately outside the portable archive: file grants and rollback. */
(function(root){
 'use strict';let dbPromise;
 function db(){return dbPromise||(dbPromise=new Promise((resolve,reject)=>{const r=indexedDB.open('zerk-mayatnik-backup-support',1);r.onupgradeneeded=()=>r.result.createObjectStore('data');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);}));}
 root.MayatnikBackupSupport={async read(key){const d=await db();return new Promise((resolve,reject)=>{const r=d.transaction('data','readonly').objectStore('data').get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});},async write(key,value){const d=await db();return new Promise((resolve,reject)=>{const t=d.transaction('data','readwrite');t.objectStore('data').put(value,key);t.oncomplete=()=>resolve();t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error);});}};
 root.mayBackupRestoring=false;
 // Run before the old pagehide handlers: none of them may overwrite imported settings.
 const preventOldSave=e=>{if(root.mayBackupRestoring)e.stopImmediatePropagation();};root.addEventListener('pagehide',preventOldSave,true);document.addEventListener('visibilitychange',preventOldSave,true);
 let channel;const pending=new Map();if(root.BroadcastChannel){channel=new BroadcastChannel('mayatnik-backup-tabs-v1');channel.onmessage=e=>{if(e.data?.type==='ping')channel.postMessage({type:'pong',id:e.data.id});if(e.data?.type==='pong')pending.get(e.data.id)?.();};}
 root.mayBackupOtherTabs=()=>new Promise((resolve,reject)=>{if(!channel){resolve();return;}const id=Math.random().toString(36);let other=false;pending.set(id,()=>other=true);channel.postMessage({type:'ping',id});setTimeout(()=>{pending.delete(id);other?reject(Error('Закройте другие вкладки Маятника перед восстановлением')):resolve();},250);});
})(window);
