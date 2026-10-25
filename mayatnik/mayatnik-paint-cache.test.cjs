const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
// Transaction harness models queued IndexedDB transactions, structured cloning and abort rollback.
function harness(){
 let data=new Map(),tail=Promise.resolve(),nextFailure=false;
 const database={close(){},transaction(name,mode){assert.equal(name,'work');const tx={error:null},ops=[];let aborted=false;
  tx.abort=()=>{aborted=true;};tx.objectStore=()=>({
   get(key){const request={};ops.push(map=>{request.result=structuredClone(map.get(key));request.onsuccess?.();});return request;},
   getAllKeys(){const request={};ops.push(map=>{request.result=[...map.keys()];});return request;},
   getAll(){const request={};ops.push(map=>{request.result=structuredClone([...map.values()]);});return request;},
   put(value,key){const copy=structuredClone(value);ops.push(map=>map.set(key,copy));},clear(){ops.push(map=>map.clear());}
  });
  tail=tail.then(()=>new Promise(resolve=>setTimeout(()=>{const working=structuredClone(data);try{if(nextFailure){nextFailure=false;throw Error('QuotaExceeded');}if(!aborted)for(const operation of ops)operation(working);if(aborted)tx.onabort?.();else{if(mode==='readwrite')data=working;tx.oncomplete?.();}}catch(error){tx.error=error;tx.onerror?.();}resolve();},0)));return tx;
 }};
 const indexedDB={open(){const request={result:database};setTimeout(()=>request.onsuccess(),0);return request;}};
 const context={window:{},indexedDB,Promise,Set,Error};vm.runInNewContext(fs.readFileSync(require.resolve('./mayatnik-paint-cache.js'),'utf8'),context);
 return {api:context.window.MayatnikPaintCache,fail(){nextFailure=true;}};
}
test('cache flush waits for queued writes and snapshot captures matching keys and values',async()=>{
 const {api}=harness();const a=api.write({field:Int8Array.of(-1,0,1)}),b=api.write(new Blob(['binary']),'frame-library-item:one');await api.idle();await Promise.all([a,b]);const rows=Array.from(await api.snapshot());assert.equal(rows.length,2);assert.deepEqual(rows[0].value.field,Int8Array.of(-1,0,1));assert.equal(await rows[1].value.text(),'binary');
});
test('freeze blocks ordinary writes while atomic replacement remains available',async()=>{
 const {api}=harness();await api.write('old','old');api.freeze(true);await assert.rejects(api.write('bad'),/занято/);await api.replace([{key:'new',value:{paint:Uint32Array.of(123)}}]);assert.equal(await api.read('old'),undefined);assert.deepEqual((await api.read('new')).paint,Uint32Array.of(123));api.freeze(false);await api.write('works');assert.equal(await api.read(),'works');
});
test('replace validates duplicate keys and aborts without losing previous content on clone or transaction failure',async()=>{
 const {api,fail}=harness();await api.write('previous','old');await assert.rejects(api.replace([{key:'x',value:1},{key:'x',value:2}]));await assert.rejects(api.replace([{key:'x',value:()=>{}}]));assert.equal(await api.read('old'),'previous');fail();await assert.rejects(api.replace([{key:'x',value:2}]),/QuotaExceeded/);assert.equal(await api.read('old'),'previous');assert.equal(await api.read('x'),undefined);
});
