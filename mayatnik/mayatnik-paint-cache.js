/* Local browser storage. Typed arrays retain exact paint and field pixels. */
(function(root){
  let dbPromise;
  function db(){return dbPromise||(dbPromise=new Promise((resolve,reject)=>{
    const req=indexedDB.open('zerk-mayatnik-paint',1);
    req.onupgradeneeded=()=>req.result.createObjectStore('work');
    req.onerror=()=>reject(req.error);req.onsuccess=()=>resolve(req.result);
  }));}
  async function read(key='latest'){const database=await db();return new Promise((resolve,reject)=>{
    const tx=database.transaction('work','readonly'),req=tx.objectStore('work').get(key);
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });}
  async function write(value,key='latest'){const database=await db();return new Promise((resolve,reject)=>{
    const tx=database.transaction('work','readwrite');tx.objectStore('work').put(value,key);
    tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
  });}
  root.MayatnikPaintCache={read,write};
})(window);
