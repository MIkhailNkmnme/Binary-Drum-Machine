/* Local browser storage. Typed arrays retain exact paint and field pixels. */
(function(root){
  let dbPromise,frozen=false;
  const pending=new Set();
  function track(promise){pending.add(promise);promise.then(()=>pending.delete(promise),()=>pending.delete(promise));return promise;}
  function db(){return dbPromise||(dbPromise=new Promise((resolve,reject)=>{
    const req=indexedDB.open('zerk-mayatnik-paint',1);
    req.onupgradeneeded=()=>req.result.createObjectStore('work');
    req.onerror=()=>{dbPromise=null;reject(req.error);};req.onsuccess=()=>{req.result.onversionchange=()=>{req.result.close();dbPromise=null;};resolve(req.result);};
  }));}
  async function read(key='latest'){const database=await db();return new Promise((resolve,reject)=>{
    const tx=database.transaction('work','readonly'),req=tx.objectStore('work').get(key);
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });}
  function write(value,key='latest'){if(frozen)return Promise.reject(Error('Хранилище занято восстановлением архива'));return track((async()=>{const database=await db();return new Promise((resolve,reject)=>{
    const tx=database.transaction('work','readwrite');tx.objectStore('work').put(value,key);
    tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
  });})());}
  async function idle(){while(pending.size)await Promise.all([...pending]);}
  async function snapshot(){await idle();const database=await db();return new Promise((resolve,reject)=>{
    const tx=database.transaction('work','readonly'),store=tx.objectStore('work'),keys=store.getAllKeys(),values=store.getAll();
    tx.oncomplete=()=>resolve(keys.result.map((key,i)=>({key,value:values.result[i]})));tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
  });}
  function replace(entries){
    if(!Array.isArray(entries))return Promise.reject(Error('Некорректный архив хранилища'));
    const seen=new Set();for(const item of entries){if(!item||typeof item.key!=='string'||!item.key||seen.has(item.key))return Promise.reject(Error('Некорректный ключ архива'));seen.add(item.key);}
    return track((async()=>{const database=await db();return new Promise((resolve,reject)=>{
      const tx=database.transaction('work','readwrite'),store=tx.objectStore('work');
      tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Восстановление хранилища отменено'));
      try{store.clear();for(const item of entries)store.put(item.value,item.key);}catch(error){tx.abort();reject(error);}
    });})());
  }
  root.MayatnikPaintCache={read,write,snapshot,replace,idle,freeze(value){frozen=!!value;}};
})(window);
