/* Exact search frames: capture before navigation, share snapshots and serialize hit merges. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.MayatnikSearchFrameStore=api;
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const PREFIX='ochki-found-frame-v1:';
  const clone=value=>structuredClone(value);
  function keyOf(key){if(typeof key!=='string'||!key)throw Error('Не задан ключ найденного кадра');return PREFIX+key;}
  function canonical(value){
    if(ArrayBuffer.isView(value))return Array.from(value);
    if(Array.isArray(value))return value.map(canonical);
    if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]));
    return value;
  }
  const identity=hit=>JSON.stringify(canonical([hit.i??null,hit.p??null,hit.dir??null,hit.text??null,hit.cells??[]]));
  function validateRecord(record){
    if(!record||!Number.isSafeInteger(record.frame)||record.frame<0||!Array.isArray(record.finds)||record.finds.some(hit=>!hit||typeof hit!=='object'))throw Error('Некорректная запись найденного кадра');
    return record;
  }
  function consistent(a,b){
    for(const name of ['frame','settings','sequence','width','height','rows','src','mirror','jumps','laps','local','joined','halves']){
      if(name==='frame'||a[name]!==undefined&&b[name]!==undefined){
        if(JSON.stringify(canonical(a[name]))!==JSON.stringify(canonical(b[name])))throw Error('Ключ найденного кадра относится к другому кадру или настройкам: '+name);
      }
    }
  }
  function validateSnapshot(snapshot,record){
    if(!snapshot||Object.prototype.toString.call(snapshot.blob)!=='[object Blob]'||typeof snapshot.blob.arrayBuffer!=='function'||!snapshot.blob.size)throw Error('Нет точного снимка найденного кадра');
    if(snapshot.frame!==undefined&&snapshot.frame!==record.frame)throw Error('Номер снимка не совпадает с найденным кадром');
    return snapshot;
  }
  function validateStored(stored){
    if(!stored||stored.complete!==true)throw Error('Сохранённый найденный кадр неполон');
    validateRecord(stored.record);validateSnapshot(stored.snapshot,stored.record);return stored;
  }
  function merge(a,b){
    if(a)consistent(a,b);
    const finds=[],seen=new Set();
    for(const hit of [...(a?.finds||[]),...b.finds]){const key=identity(hit);if(!seen.has(key)){seen.add(key);finds.push(hit);}}
    return {...a,...b,finds,count:finds.length};
  }
  function create({storage,capture}){
    if(typeof storage!=='function'||typeof capture!=='function')throw Error('Не задано хранилище найденных кадров');
    const entries=new Map(),pending=new Set();
    const entryFor=key=>{let entry=entries.get(key);if(!entry){entry={tail:Promise.resolve(),loaded:false,saved:null,snapshot:null,capture:null,anchor:null};entries.set(key,entry);}return entry;};
    function track(promise){pending.add(promise);promise.then(()=>pending.delete(promise),()=>pending.delete(promise));return promise;}
    async function read(entry,key,cache){
      if(entry.loaded)return;
      const value=await cache.read(keyOf(key));
      if(value!=null){const saved=clone(validateStored(value));entry.saved=saved;entry.snapshot=saved.snapshot;entry.anchor=clone(saved.record);}
      entry.loaded=true;
    }
    function forgetPacked(entry,key,operation){
      const forget=()=>{
        if(entry.tail===operation&&entry.snapshot?.kind==='packed-ochki-v1')entries.delete(key);
      };
      operation.then(forget,forget);
      return track(operation);
    }
    function ensure(key,record,captureFrame=capture){
      let entry,frozen,captured;
      try{
        keyOf(key);frozen=clone(validateRecord(record));entry=entryFor(key);
        if(entry.anchor)consistent(entry.anchor,frozen);else entry.anchor=clone(frozen);
        // This invocation must stay synchronous: capture's host freezes the live field now.
        // A cold instance may discover an older persisted snapshot afterwards and prefer it.
        if(!entry.snapshot&&!entry.capture){
          let candidate;try{candidate=captureFrame(clone(frozen));}catch(error){candidate=Promise.reject(error);}
          entry.capture=Promise.resolve(candidate).then(value=>({value:clone(validateSnapshot(value,frozen))}),error=>({error})).catch(error=>({error}));
        }
        captured=entry.capture;
      }catch(error){return Promise.reject(error);}
      const operation=entry.tail.catch(()=>{}).then(async()=>{
        const cache=await storage();await read(entry,key,cache);
        if(entry.saved)consistent(entry.saved.record,frozen);
        if(!entry.snapshot){
          const result=await captured;
          if(result.error){if(entry.capture===captured)entry.capture=null;throw result.error;}
          entry.snapshot=result.value;
        }
        validateSnapshot(entry.snapshot,frozen);
        const stored={snapshot:entry.snapshot,record:merge(entry.saved?.record,frozen),complete:true};
        await cache.write(clone(stored),keyOf(key));entry.saved=stored;
        return clone(stored);
      });
      entry.tail=operation;return forgetPacked(entry,key,operation);
    }
    function load(key){
      try{keyOf(key);}catch(error){return Promise.reject(error);}
      const entry=entryFor(key),operation=entry.tail.then(async()=>{const cache=await storage();await read(entry,key,cache);return entry.saved?clone(entry.saved):null;});
      entry.tail=operation;return forgetPacked(entry,key,operation);
    }
    async function idle(){while(pending.size)await Promise.all([...pending]);}
    return {ensure,load,idle};
  }
  return {create,PREFIX};
});
