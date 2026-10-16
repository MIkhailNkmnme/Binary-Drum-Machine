const test=require('node:test'),assert=require('node:assert/strict'),{layout}=require('./hub-menu-tree.js');
const leaf=id=>({id}),branch=(id,...children)=>({id,children});
const tree=branch('root',branch('A',leaf('a'),leaf('b')),branch('B',leaf('c'),leaf('d')));
const pos=p=>p.cells.map(c=>[c.id,...c.pyr]);
// Соседние ряды решётки: dy = 1, dx отличается на нечётное число — ромбы касаются гранями.
const lattice=p=>p.cells.every(c=>(c.pyr[0]-c.pyr[1])%2===0);
test('one root on top; opened levels follow half a diamond lower without gaps',()=>{
 assert.deepEqual(layout(tree).cells,[{id:'root',head:true,pyr:[0,0]}]);
 const p=layout(tree,{open:['root','A']});
 assert.deepEqual(pos(p),[['root',0,0],['A',-1,1],['B',1,1],['a',0,2],['b',2,2]]);
 assert.ok(lattice(p));assert.equal(p.rows,3);
});
test('pinned buttons form a pyramid 1, 2, 3 under the root; edges touch',()=>{
 const p=layout(tree,{promoted:['a','b'],open:['root']});
 assert.deepEqual(pos(p),[['root',0,0],['a',-1,1],['b',1,1],['B',0,2]]);
 assert.deepEqual(layout(tree,{promoted:['b'],open:['root','A']}).cells.map(c=>c.id),['root','b','A','B','a']);
 const all=layout(tree,{promoted:['a','b','c','d']});assert.deepEqual(pos(all),[['a',0,0],['b',-1,1],['c',1,1],['d',0,2]]);
 assert.equal(all.cells[0].head,true);assert.ok(lattice(all));
});
test('a sixth button wraps to the next row; the next level starts right below',()=>{
 const t=branch('root',...Array.from({length:6},(_,i)=>branch('b'+i,leaf('x'+i))));
 const p=layout(t,{open:['root','b5']});
 assert.deepEqual(p.cells.find(c=>c.id==='b4').pyr,[5,1]);
 assert.deepEqual(p.cells.find(c=>c.id==='b5').pyr,[0,2]);
 assert.deepEqual(p.cells.find(c=>c.id==='x5').pyr,[1,3]);
 assert.ok(lattice(p));
});
test('promoted branch keeps its children and old unknown pins are ignored',()=>{
 assert.deepEqual(layout(tree,{promoted:['A','obsolete'],open:['A']}).cells.map(c=>c.id),['root','A','a','b']);
});
test('an actionable first button remains usable after all its settings are promoted',()=>{
 const t=branch('root',leaf('speed'));t.action=()=>{};
 assert.deepEqual(layout(t,{promoted:['speed']}).cells.map(c=>c.id),['root','speed']);
});
