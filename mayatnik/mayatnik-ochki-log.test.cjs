const test=require('node:test'),assert=require('node:assert/strict');
const {create,KEY,sourceName,foundRows}=require('./mayatnik-ochki-log.js');
test('menu history command belongs to native Ochki definition and dispatches without a source HTML button',()=>{
  const fs=require('node:fs'),vm=require('node:vm'),source=fs.readFileSync(require('node:path').join(__dirname,'mayatnik-menu.js'),'utf8');
  const start=source.indexOf("{ id: 'ochki'"),end=source.indexOf('\n    { id:',start+1),events=[];
  assert.ok(start>=0&&end>start);
  const item=(src)=>({type:'toggle',src}),scope={button:item,check:item,ringSegments:item,selectSegments:item,num:src=>({type:'value',src}),Event,window:{dispatchEvent:event=>events.push(event.type)}};
  const group=vm.runInNewContext('('+source.slice(start,end).trim().replace(/,$/,'')+')',scope);
  const command=group.items.find(entry=>entry.src==='ochkiSearchLog');
  assert.equal(group.id,'ochki');assert.equal(command.type,'action');assert.equal(command.name,'Лог поиска');
  // Source-free native items survive the same narrow/wide split used by rail and flyouts.
  const narrow=group.items.filter(entry=>!['value','list','control','vpair'].includes(entry.type));assert.equal(narrow.at(-1),command);
  command.click();assert.deepEqual(events,['may-ochki-log-show']);
});
test('history labels use source names and full search result sequence numbers',()=>{
  assert.equal(sourceName('p123'),'XOR все 3');assert.equal(sourceName('a12'),'AND 1–2');assert.equal(sourceName(''),'Обычный Маятник');assert.equal(sourceName('pair'),'Обе 5.9');
  assert.equal(foundRows([{i:2},{i:0},{i:2}]),' · Строки последовательности № 1, 3');
});
function fixture(map=new Map()){
  const calls=[],opened=[];let fail=false;
  const storage={async read(key){calls.push(['read',key]);return structuredClone(map.get(key));},async write(value,key){calls.push(['write',key]);await new Promise(resolve=>setImmediate(resolve));if(fail)throw Error('quota');map.set(key,structuredClone(value));}};
  const library={ready:Promise.resolve(),async open(id){opened.push(id);},save(){throw Error('must not retake current frame');}};
  const log=create({storage:async()=>storage,library:async()=>library});
  return {log,map,calls,opened,storage,library,fail(value){fail=value;}};
}
const record=(id,status='saved')=>({id,status,savedId:status==='saved'?'frame:'+id:undefined,frame:14,rows:256,src:'horr',mirror:0,settings:{ochkiMode:'row'},sequence:['101'],finds:[{cells:[{r:1,c:2}]}],at:42});
test('concurrent updates serialize without losing entries; reload retains references and immutable search metadata',async()=>{
  const f=fixture(),a=record('a','saving');const first=f.log.record(a);a.sequence[0]='mutated';
  await Promise.all([first,f.log.record(record('b')),f.log.record(record('a'))]);
  assert.deepEqual(f.log.list().map(x=>x.id),['a','b']);
  assert.equal(f.map.get(KEY).items.length,2);assert.equal(f.map.get(KEY).items[0].status,'saved');
  const reload=fixture(f.map);await reload.log.ready;assert.deepEqual(reload.log.list(),f.log.list());
  const snapshot=reload.log.list();snapshot[0].finds[0].cells.length=0;assert.equal(reload.log.list()[0].finds[0].cells.length,1);
  assert.ok(f.calls.every(call=>call[1]===KEY),'history writes only its metadata index');
});
test('records wait for unavailable storage and preserve pre-await detail snapshots',async()=>{
  let resolveStorage;const f=fixture(),log=create({storage:()=>new Promise(resolve=>resolveStorage=resolve),library:async()=>f.library});
  const entry=record('early'),pending=log.record(entry);entry.sequence[0]='changed';
  await new Promise(resolve=>setImmediate(resolve));resolveStorage(f.storage);
  // Later storage calls can resolve immediately.
  await new Promise(resolve=>setImmediate(resolve));resolveStorage(f.storage);await pending;
  assert.equal(log.list()[0].sequence[0],'101');
});
test('storage rejection is observable, a later update persists previous history too',async()=>{
  const f=fixture();await f.log.ready;f.fail(true);
  await assert.rejects(f.log.record(record('a')),/quota/);assert.match(f.log.getState().storageError,/quota/);assert.equal(f.map.has(KEY),false);
  f.fail(false);await f.log.record(record('b'));assert.equal(f.log.getState().storageError,'');assert.equal(f.map.get(KEY).items.length,2);
});
test('open uses exact saved id with no capture and supports replay host hook',async()=>{
  const f=fixture();await f.log.record(record('a'));await f.log.record(record('b'));await f.log.open('a');assert.deepEqual(f.opened,['frame:a']);
  let restored;const log=create({storage:async()=>f.storage,library:async()=>f.library,async open(entry,library){restored=entry;await library.open(entry.savedId);}});
  await log.ready;await log.open('b');assert.equal(restored.settings.ochkiMode,'row');assert.deepEqual(restored.sequence,['101']);assert.deepEqual(f.opened,['frame:a','frame:b']);
});
test('error and interrupted entries cannot be opened; late saving never downgrades confirmed entry',async()=>{
  const f=fixture();await f.log.record(record('a'));await f.log.record(record('a','saving'));assert.equal(f.log.list()[0].status,'saved');
  await f.log.record({...record('error','error'),error:'disk full'});await assert.rejects(f.log.open('error'),/ещё не сохранён/);
  await f.log.record(record('pending','saving'));const reload=fixture(f.map);await reload.log.ready;assert.equal(reload.log.list().find(x=>x.id==='pending').status,'error');
  await f.log.record({...record('missing'),savedId:null});assert.equal(f.log.list().find(x=>x.id==='missing').status,'error');
});
test('history keeps more than 500 frames without truncation',async()=>{
  const f=fixture();for(let i=0;i<503;i++)await f.log.record(record(String(i)));assert.equal(f.map.get(KEY).items.length,503);
});
