const {test}=require('node:test');
const assert=require('node:assert/strict');
const {create,normalise,KEY}=require('./mayatnik-template-folders.js');
function memory(value){const map=new Map(value?[[KEY,JSON.stringify(value)]]:[]);return {writes:0,getItem:k=>map.get(k),setItem(k,v){this.writes++;map.set(k,v);}};}
test('organisation preserves stable IDs and never owns template pixels',()=>{
 const storage=memory(),model=create(storage);model.reconcile(['standard:a','saved:1']);const folder=model.addFolder('Мои');model.move('template','standard:a',folder);model.reconcile(['saved:1','standard:a','saved:2']);
 assert.deepEqual(model.children(folder).map(n=>n.id),['standard:a']);assert.deepEqual(model.children('').filter(n=>n.kind==='template').map(n=>n.id),['saved:1','saved:2']);assert.ok(!JSON.stringify(model.snapshot()).includes('data'));
 const restored=create(storage);assert.deepEqual(restored.snapshot(),model.snapshot());
});
test('unchanged reconciliation never writes localStorage',()=>{
 const storage=memory(),model=create(storage);model.reconcile(['a','b']);const n=storage.writes;for(let i=0;i<100;i++)model.reconcile(['a','b']);assert.equal(storage.writes,n);
});
test('folder self and descendant moves cannot create cycles',()=>{
 const m=create(memory()),a=m.addFolder('a'),b=m.addFolder('b',a),c=m.addFolder('c',b);const before=m.snapshot();assert.equal(m.move('folder',a,a),false);assert.equal(m.move('folder',a,c),false);assert.deepEqual(m.snapshot(),before);
});
test('reordering and moving references keeps every entry exactly once',()=>{
 const m=create(memory());m.reconcile(['a','b','c']);assert.equal(m.move('template','c','','a','template'),true);assert.deepEqual(m.children('').map(n=>n.id),['c','a','b']);const p=m.addFolder('nested');m.move('template','a',p);m.move('template','a','');assert.deepEqual(m.children('').filter(n=>n.kind==='template').map(n=>n.id),['c','b','a']);assert.equal(m.snapshot().nodes.filter(n=>n.id==='a').length,1);
});
test('removing a folder promotes templates and subfolders without data loss',()=>{
 const m=create(memory());m.reconcile(['a','b']);const p=m.addFolder('p'),q=m.addFolder('q',p);m.move('template','a',p);m.move('template','b',q);m.removeFolder(p);assert.equal(m.children('').find(n=>n.id===q).parent,'');assert.equal(m.children('').find(n=>n.id==='a').parent,'');assert.equal(m.children(q)[0].id,'b');
});
test('external history snapshots restore moves and folders in both directions',()=>{
 const m=create(memory());m.reconcile(['a']);const before=m.snapshot(),p=m.addFolder('p');m.move('template','a',p);const after=m.snapshot();m.restore(before);assert.deepEqual(m.snapshot(),before);m.restore(after);assert.deepEqual(m.snapshot(),after);after.nodes[0].parent='corrupted';assert.notDeepEqual(m.snapshot(),after);
});
test('malformed or cyclic saved hierarchy is repaired safely',()=>{
 const state=normalise({nodes:[{kind:'folder',id:'a',parent:'b'},{kind:'folder',id:'b',parent:'a'},{kind:'template',id:'t',parent:'missing'},{kind:'template',id:'t',parent:''},{kind:'bad',id:'x'}]});assert.equal(state.nodes.length,3);assert.equal(state.nodes.find(n=>n.id==='t').parent,'');const folders=new Map(state.nodes.filter(n=>n.kind==='folder').map(n=>[n.id,n]));for(const folder of folders.values()){const seen=new Set();let n=folder;while(n){assert.ok(!seen.has(n.id));seen.add(n.id);n=folders.get(n.parent);}}
});
test('storage failures retain live organisation and report failure',()=>{
 const m=create({getItem(){throw Error('blocked');},setItem(){throw Error('full');}});m.reconcile(['a']);const p=m.addFolder('p');assert.equal(m.move('template','a',p),true);assert.equal(m.children(p)[0].id,'a');assert.equal(m.persistenceError,true);
});
