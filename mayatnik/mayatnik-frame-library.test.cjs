const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const L=require('./mayatnik-frame-library.js');
function fixture(map=new Map()){
 const calls=[],restores=[],downloads=[];let serial=0,fail=()=>false;
 const storage={async read(key){calls.push(['read',key]);if(fail('read',key))throw Error('storage read');return structuredClone(map.get(key)??null);},async write(value,key){calls.push(['write',key,value]);if(fail('write',key,value))throw Error('quota');map.set(key,structuredClone(value));}};
 const host={storage,async capture(){const frame=++serial;return {blob:new Blob(['frame-'+frame]),thumbnail:'data:image/png;base64,thumb'+frame,name:'Кадр '+frame,frame,rows:512};},async restore(blob){restores.push(await blob.text());},async download(blob,name){downloads.push([await blob.text(),name]);}};
 return {map,calls,restores,downloads,host,api:L.create(host),fail(fn){fail=fn;}};
}
test('no capture until explicit save; concurrent saves are serial and both survive reload',async()=>{
 const f=fixture();await f.api.ready;assert.deepEqual(f.api.list(),[]);assert.deepEqual(f.calls,[['read',L.INDEX_KEY]]);
 const [a,b]=await Promise.all([f.api.save('Первый'),f.api.save('Второй')]);assert.notEqual(a,b);assert.deepEqual(f.api.list().map(x=>x.name),['Первый','Второй']);assert.equal(f.api.getState().busy,false);
 const reload=fixture(f.map);await reload.api.ready;assert.deepEqual(reload.api.list(),f.api.list());assert.deepEqual(reload.calls,[['read',L.INDEX_KEY]],'loading list never loads payloads');
 const list=reload.api.list();list[0].name='outside';assert.equal(reload.api.list()[0].name,'Первый');assert.ok(!('blob' in list[0]));
});
test('open and download use exact stored Blob, rename touches only index, delete never restores field',async()=>{
 const f=fixture();const id=await f.api.save();await f.api.open(id);assert.deepEqual(f.restores,['frame-1']);assert.equal(f.api.getState().selectedId,id);
 const start=f.calls.length;await f.api.rename(id,'Новое имя');assert.deepEqual(f.calls.slice(start).map(x=>x[1]),[L.INDEX_KEY]);
 await f.api.download(id);assert.deepEqual(f.downloads,[['frame-1','Новое имя']]);
 const n=f.calls.length;await f.api.remove(id);assert.deepEqual(f.calls.slice(n).map(x=>x[1]),[L.INDEX_KEY,L.ITEM_PREFIX+id]);assert.equal(f.map.get(L.ITEM_PREFIX+id),null);assert.deepEqual(f.api.list(),[]);assert.equal(f.api.getState().selectedId,null);assert.equal(f.restores.length,1);
});
test('failed payload or index saves do not publish cards or overwrite existing entries',async()=>{
 for(const failingKey of ['payload','index']){
  const f=fixture(),keep=await f.api.save('Keep');f.fail((op,key,value)=>op==='write'&&value!==null&&(failingKey==='index'?key===L.INDEX_KEY:key.startsWith(L.ITEM_PREFIX)));
  await assert.rejects(f.api.save('Lost'),/quota/);assert.deepEqual(f.api.list().map(x=>x.id),[keep]);assert.equal(f.api.getState().selectedId,keep);assert.equal(f.api.getState().busy,false);assert.match(f.api.getState().message,/ошибка/);
  assert.equal([...f.map].filter(([key,value])=>key.startsWith(L.ITEM_PREFIX)&&value).length,1);
  f.fail(()=>false);await f.api.save('Next');assert.equal(f.api.list().length,2,'queue remains usable after failure');
 }
});
test('failed rename/deletion index preserves card and payload; cleanup failure truthfully reports committed deletion',async()=>{
 const f=fixture(),id=await f.api.save('Keep');f.fail((op,key)=>op==='write'&&key===L.INDEX_KEY);
 await assert.rejects(f.api.rename(id,'Changed'));await assert.rejects(f.api.remove(id));assert.equal(f.api.list()[0].name,'Keep');assert.ok(f.map.get(L.ITEM_PREFIX+id) instanceof Blob);
 f.fail((op,key)=>op==='write'&&key.startsWith(L.ITEM_PREFIX));await f.api.remove(id);assert.deepEqual(f.api.list(),[]);assert.match(f.api.getState().message,/не удалось очистить/);assert.equal(f.restores.length,0);
});
test('load failure or corrupt index never turns into empty-library writes',async()=>{
 for(const bad of [{version:2,items:[]},{version:1,items:[{id:'broken'}]}]){
  const f=fixture(new Map([[L.INDEX_KEY,bad]]));await assert.rejects(f.api.ready);await assert.rejects(f.api.save());assert.equal(f.calls.filter(x=>x[0]==='write').length,0);assert.match(f.api.getState().message,/Не удалось загрузить/);
 }
 const f=fixture();f.fail(op=>op==='read');await assert.rejects(f.api.ready);assert.equal(f.api.getState().busy,false);
});
test('invalid captures, missing payloads and host errors propagate and never report success',async()=>{
 const f=fixture();f.host.capture=async()=>({blob:'not a Blob'});await assert.rejects(f.api.save(),/не содержит файл/);assert.deepEqual(f.api.list(),[]);
 f.host.capture=async()=>({blob:new Blob(['ok']),thumbnail:'thumb',frame:1,rows:10,name:'A'});const id=await f.api.save();f.host.restore=async()=>{throw Error('restore failed');};await assert.rejects(f.api.open(id),/restore failed/);assert.match(f.api.getState().message,/ошибка/);
 f.map.set(L.ITEM_PREFIX+id,null);await assert.rejects(f.api.download(id),/отсутствует/);await assert.rejects(f.api.rename(id,'  '),/пустым/);
});
test('subscriptions show operation state, cannot break storage commits, browser export has no DOM dependency',async()=>{
 const f=fixture(),events=[];f.api.subscribe(s=>events.push(s));f.api.subscribe(()=>{throw Error('view');});await f.api.ready;await f.api.save();assert.ok(events.some(s=>s.busy));assert.equal(events.at(-1).busy,false);assert.equal(f.api.list().length,1);
 const ctx=vm.createContext({});vm.runInContext(fs.readFileSync(__dirname+'/mayatnik-frame-library.js','utf8'),ctx);assert.equal(typeof ctx.MayatnikFrameLibrary.create,'function');
});
