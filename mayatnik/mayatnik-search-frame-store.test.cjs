const test=require('node:test'),assert=require('node:assert/strict');
const {create,PREFIX}=require('./mayatnik-search-frame-store.js');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const record=(frame=7,finds=[{i:0,p:0,dir:1,text:'101',cells:[1,4,7]}])=>({frame,settings:{view:'bits',mode:'pend'},sequence:['101','101'],finds});
function fixture(map=new Map(),options={}){
  let captures=0,writes=0,failWrite=false,failCapture=false;
  const cache={async read(key){return structuredClone(map.get(key));},async write(value,key){writes++;await tick();if(failWrite)throw Error('quota');map.set(key,structuredClone(value));}};
  const store=create({storage:options.storage||(()=>Promise.resolve(cache)),capture:options.capture||(r=>{captures++;if(failCapture)throw Error('capture failed');return Promise.resolve({blob:new Blob(['exact '+r.frame]),frame:r.frame});})});
  return {store,map,cache,get captures(){return captures;},get writes(){return writes;},failWrite(value){failWrite=value;},failCapture(value){failCapture=value;}};
}
test('freezes record and captures the live field synchronously before storage or caller mutation',async()=>{
  let release,live='old',seen;
  const gate=new Promise(resolve=>release=resolve),f=fixture(),store=create({storage:()=>gate,capture:r=>{seen=r;const blob=new Blob([live]);return Promise.resolve({blob,frame:r.frame});}});
  const input=record(),pending=store.ensure('frame',input);
  assert.equal(seen.frame,7);input.finds[0].cells[0]=999;input.settings.view='changed';live='new';release(f.cache);
  const saved=await pending;assert.equal(await saved.snapshot.blob.text(),'old');assert.equal(saved.record.finds[0].cells[0],1);assert.equal(saved.record.settings.view,'bits');
  saved.record.finds[0].cells[0]=888;assert.equal((await store.load('frame')).record.finds[0].cells[0],1);
});
test('concurrent and repeated findings share one capture and merge without losing distinct hits',async()=>{
  const f=fixture(),a=record(),b=record(7,[{...a.finds[0],i:1},{...a.finds[0],p:1},{...a.finds[0],cells:[2,5,8]}]);
  const one=f.store.ensure('same',a),two=f.store.ensure('same',b),three=f.store.ensure('same',record());
  await f.store.idle();await Promise.all([one,two,three]);
  const saved=await f.store.load('same');assert.equal(f.captures,1);assert.equal(saved.record.finds.length,4);assert.equal(saved.record.count,4);assert.equal(f.map.size,1);
  await f.store.ensure('same',a);assert.equal(f.captures,1);
});
test('new instances reuse the persisted snapshot and merge records; warm load avoids capture',async()=>{
  const f=fixture();await f.store.ensure('saved',record());
  const next=fixture(f.map,{capture:r=>({blob:new Blob(['new live field']),frame:r.frame})});
  const saved=await next.store.ensure('saved',record(7,[{i:1,cells:[10]}]));assert.equal(await saved.snapshot.blob.text(),'exact 7');assert.equal(saved.record.finds.length,2);
  const warm=fixture(f.map);await warm.store.load('saved');await warm.store.ensure('saved',record());assert.equal(warm.captures,0);
});
test('frame, sequence and settings collisions reject without overwriting the exact saved frame',async()=>{
  const f=fixture();await f.store.ensure('key',record());
  await assert.rejects(f.store.ensure('key',record(8)),/другому кадру/);
  await assert.rejects(f.store.ensure('key',{...record(),sequence:['000']}),/sequence/);
  await assert.rejects(f.store.ensure('key',{...record(),settings:{mode:'right'}}),/settings/);
  const next=fixture(f.map);await assert.rejects(next.store.ensure('key',record(9)),/frame/);
  await next.store.ensure('key',record());
  assert.equal(f.map.get(PREFIX+'key').record.frame,7);
});
test('capture failure is observable and retry captures the new exact candidate',async()=>{
  const f=fixture();f.failCapture(true);await assert.rejects(f.store.ensure('retry',record()),/capture failed/);assert.equal(f.map.size,0);
  f.failCapture(false);await f.store.ensure('retry',record());assert.equal(f.captures,2);assert.equal((await f.store.load('retry')).complete,true);
});
test('quota failure propagates to ensure and idle; retry reuses the frozen snapshot',async()=>{
  const f=fixture();f.failWrite(true);const saved=f.store.ensure('retry',record()),idle=f.store.idle();
  await Promise.all([assert.rejects(saved,/quota/),assert.rejects(idle,/quota/)]);assert.equal(f.map.size,0);
  f.failWrite(false);await f.store.ensure('retry',record());assert.equal(f.captures,1);assert.equal((await f.store.load('retry')).record.frame,7);
});
test('unknown keys return null and corrupt or mismatched snapshots are rejected',async()=>{
  const f=fixture();assert.equal(await f.store.load('unknown'),null);assert.equal(f.captures,0);
  f.map.set(PREFIX+'broken',{complete:true,record:record(),snapshot:{blob:'not a blob'}});
  await assert.rejects(f.store.load('broken'),/точного снимка/);
  const wrong=fixture(new Map(),{capture:()=>({blob:new Blob(['data']),frame:8})});await assert.rejects(wrong.store.ensure('wrong',record()),/Номер снимка/);
});
test('load waits for pending hit merges and preserves long caller keys without hashing',async()=>{
  const f=fixture(),key='source:'+('0123456789'.repeat(55));
  const first=f.store.ensure(key,record()),second=f.store.ensure(key,record(7,[{i:1,cells:[99]}])),loaded=f.store.load(key);
  assert.equal((await loaded).record.finds.length,2);await Promise.all([first,second]);assert.ok(f.map.has(PREFIX+key));
});
test('storage read failures retry without taking a later replacement snapshot',async()=>{
  const f=fixture();let fail=true,captures=0;
  const cache={...f.cache,read:key=>fail?Promise.reject(Error('read failed')):f.cache.read(key)};
  const store=create({storage:()=>cache,capture:r=>{captures++;return {blob:new Blob(['frozen']),frame:r.frame};}});
  await assert.rejects(store.ensure('retry',record()),/read failed/);fail=false;
  const saved=await store.ensure('retry',record());assert.equal(captures,1);assert.equal(await saved.snapshot.blob.text(),'frozen');
});
test('typed paths and reordered settings retain the same stable finding identity',async()=>{
  const f=fixture();await f.store.ensure('same',record());
  const next=record();next.settings={mode:'pend',view:'bits'};next.finds[0].cells=new Uint32Array([1,4,7]);
  assert.equal((await f.store.ensure('same',next)).record.finds.length,1);
});
