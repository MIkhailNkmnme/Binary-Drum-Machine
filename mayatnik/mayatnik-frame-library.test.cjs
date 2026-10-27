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
test('supplied frozen capture survives a delayed library queue and never invokes live host capture',async()=>{
 const f=fixture();await f.api.ready;let release;const held=new Promise(resolve=>release=resolve),first=f.api.save('Delayed',held);let live=10;
 const captured=Promise.resolve({blob:new Blob(['exact-'+live]),thumbnail:'exact',frame:live,rows:256}),second=f.api.save('Found',captured);live=99;f.host.capture=()=>{throw Error('Late live capture');};
 release({blob:new Blob(['first']),thumbnail:'first',frame:1,rows:256});await first;const id=await second;assert.equal(f.api.list().find(x=>x.id===id).frame,10);await f.api.open(id);assert.deepEqual(f.restores,['exact-10']);
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

test('old frame records remain Views while whole Frames use an independent namespace',async()=>{
 const f=fixture(),old=await f.api.save('Legacy view'),views=L.create({...f.host,kind:'view'}),frames=L.create({...f.host,namespace:'whole-frames',kind:'frame'});
 await Promise.all([views.ready,frames.ready]);assert.equal(views.list()[0].id,old);assert.deepEqual(frames.list(),[]);assert.match(views.getState().message,/видов/);
 const before=structuredClone(f.map.get(L.INDEX_KEY)),whole=await frames.save('Whole');assert.deepEqual(f.map.get(L.INDEX_KEY),before);assert.ok(f.map.has('whole-frames-library-item:'+whole));
 await frames.rename(whole,'Entire');await views.remove(old);assert.equal(frames.list()[0].name,'Entire');assert.ok(f.map.get('whole-frames-library-item:'+whole));
 const again=L.create({...f.host,namespace:'whole-frames'});await again.ready;assert.equal(again.list()[0].id,whole);await again.open(whole);assert.equal(f.restores.length,1);
 assert.throws(()=>L.create({...f.host,namespace:'bad/key'}),/namespace/);
});

function unionFixture(){
 const record={id:'same:legacy',name:'View',thumbnail:'cropped',frame:3,rows:128,createdAt:100};
 const map=new Map([[L.INDEX_KEY,{version:1,items:[record]}],[L.ITEM_PREFIX+record.id,new Blob(['view'])],['whole-frames-library-v1',{version:1,items:[{...record,name:'Frame',thumbnail:'whole'}]}],['whole-frames-library-item:'+record.id,new Blob(['frame'])]]),f=fixture(map);
 const capture=f.host.capture;f.host.capture=async()=>({...await capture(),previewKind:'whole'});
 const union=()=>L.create({...f.host,namespace:'whole-frames',namespaces:['whole-frames','frame'],kind:'frame'});
 return {...f,union};
}

test('federated Frames preserve colliding IDs and exact payloads without migration writes',async()=>{
 const f=unionFixture(),api=f.union();await api.ready;
 assert.deepEqual(api.list().map(x=>[x.id,x.previewKind]),[['whole-frames:same:legacy','whole'],['frame:same:legacy','view']]);
 assert.equal(f.calls.filter(c=>c[0]==='write').length,0);
 await api.open('frame:same:legacy');await api.download('whole-frames:same:legacy');
 assert.deepEqual(f.restores,['view']);assert.deepEqual(f.downloads,[['frame','Frame']]);
 await api.rename('frame:same:legacy','Renamed view');assert.equal(f.map.get(L.INDEX_KEY).items[0].name,'Renamed view');assert.equal(f.map.get('whole-frames-library-v1').items[0].name,'Frame');
 await api.remove('frame:same:legacy');const again=f.union();await again.ready;
 assert.deepEqual(again.list().map(x=>x.id),['whole-frames:same:legacy']);assert.equal(f.map.get(L.ITEM_PREFIX+'same:legacy'),null);
 const id=await again.save('New');assert.ok(id.startsWith('whole-frames:'));assert.equal(f.map.get(L.INDEX_KEY).items.length,0);assert.equal(f.map.get('whole-frames-library-v1').items.length,2);
});

test('failed federated writes preserve both sources, and deleted orphan blobs never reappear',async()=>{
 const f=unionFixture(),api=f.union();await api.ready;f.fail((op,key)=>op==='write'&&key===L.INDEX_KEY);
 await assert.rejects(api.remove('frame:same:legacy'),/quota/);await assert.rejects(api.rename('frame:same:legacy','Lost'),/quota/);assert.equal(api.list().length,2);
 f.fail((op,key)=>op==='write'&&key==='whole-frames-library-v1');await assert.rejects(api.save('Lost'),/quota/);
 const reload=f.union();await reload.ready;assert.equal(reload.list().length,2);assert.equal([...f.map].filter(([k,v])=>k.startsWith('whole-frames-library-item:')&&v).length,1);
 f.fail((op,key)=>op==='write'&&key.startsWith(L.ITEM_PREFIX));await api.remove('frame:same:legacy');assert.match(api.getState().message,/не удалось очистить/);
 const deleted=f.union();await deleted.ready;assert.deepEqual(deleted.list().map(x=>x.id),['whole-frames:same:legacy']);assert.ok(f.map.get(L.ITEM_PREFIX+'same:legacy'));
});

test('failed source load forbids writes to the valid half of the unified library',async()=>{
 const f=unionFixture();f.map.set(L.INDEX_KEY,{version:1,items:[{id:'broken'}]});const api=f.union();await assert.rejects(api.ready);assert.deepEqual(api.list(),[]);await assert.rejects(api.save());assert.equal(f.calls.filter(c=>c[0]==='write').length,0);
});

test('legacy previews refresh only after successful real open; thumbnail write failure does not undo open',async()=>{
 const f=unionFixture();let previews=0;f.host.refreshThumbnail=()=>{previews++;return {thumbnail:'complete'};};const api=f.union();await api.ready;assert.equal(previews,0);
 f.fail((op,key)=>op==='write'&&key===L.INDEX_KEY);await api.open('frame:same:legacy');assert.equal(api.getState().selectedId,'frame:same:legacy');assert.match(api.getState().message,/эскиз не удалось сохранить/);assert.equal(api.list()[1].previewKind,'view');assert.equal(f.restores.length,1);
 f.fail(()=>false);await api.open('frame:same:legacy');assert.equal(api.list()[1].thumbnail,'complete');assert.equal(api.list()[1].previewKind,'whole');assert.equal(f.map.get(L.INDEX_KEY).items[0].previewKind,'whole');assert.equal(await f.map.get(L.ITEM_PREFIX+'same:legacy').text(),'view');
 await api.open('frame:same:legacy');assert.equal(previews,2,'finished thumbnail is not regenerated on every open');
 const reload=f.union();await reload.ready;assert.equal(reload.list()[1].previewKind,'whole');
});

test('old and unified libraries survive portable backup round trip with source IDs intact',async()=>{
 const codec=require('./mayatnik-backup-codec.js'),f=unionFixture(),api=f.union();await api.ready;await api.rename('frame:same:legacy','Portable');await api.save('New');
 const encoded=await codec.encode({entries:[...f.map].map(([key,value])=>({key,value})),local:[]}),decoded=(await codec.decode(encoded)).snapshot;
 const restored=fixture(new Map(decoded.entries.map(e=>[e.key,e.value]))),union=L.create({...restored.host,namespace:'whole-frames',namespaces:['whole-frames','frame']});await union.ready;assert.deepEqual(union.list(),api.list());await union.open('frame:same:legacy');assert.deepEqual(restored.restores,['view']);
});
