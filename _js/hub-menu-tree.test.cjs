const test=require('node:test'),assert=require('node:assert/strict'),{layout}=require('./hub-menu-tree.js');
const leaf=id=>({id}),branch=(id,...children)=>({id,children});
const tree=branch('root',branch('A',leaf('a'),leaf('b')),branch('B',leaf('c'),leaf('d')));
const cr=p=>p.cells.map(c=>[c.id,c.column,c.row]);
test('one root on top; each opened level is the next row down',()=>{
 assert.deepEqual(layout(tree).cells,[{id:'root',column:0,row:0}]);
 assert.deepEqual(cr(layout(tree,{open:['root','A']})),[['root',0,0],['A',0,1],['B',1,1],['a',0,2],['b',1,2]]);
 assert.equal(layout(tree,{open:['root','A']}).columns,2);
});
test('promoted buttons form a row under the root; empty branches vanish and return',()=>{
 assert.deepEqual(cr(layout(tree,{promoted:['a','b'],open:['root']})),[['root',0,0],['a',0,1],['b',1,1],['B',0,2]]);
 assert.deepEqual(layout(tree,{promoted:['b'],open:['root','A']}).cells.map(c=>c.id),['root','b','A','B','a']);
 assert.deepEqual(cr(layout(tree,{promoted:['a','b','c','d']})),[['a',0,0],['b',1,0],['c',2,0],['d',3,0]]);
});
test('a sixth button wraps to a new row; the next level starts below it',()=>{
 const t=branch('root',...Array.from({length:6},(_,i)=>branch('b'+i,leaf('x'+i))));
 const p=layout(t,{open:['root','b5']});
 assert.deepEqual(p.cells.find(c=>c.id==='b4'),{id:'b4',column:4,row:1});
 assert.deepEqual(p.cells.find(c=>c.id==='b5'),{id:'b5',column:0,row:2});
 assert.deepEqual(p.cells.find(c=>c.id==='x5'),{id:'x5',column:0,row:3});
 assert.equal(p.columns,5);
});
test('promoted branch keeps its children and old unknown pins are ignored',()=>{
 assert.deepEqual(layout(tree,{promoted:['A','obsolete'],open:['A']}).cells.map(c=>c.id),['root','A','a','b']);
});
test('an actionable first button remains usable after all its settings are promoted',()=>{
 const t=branch('root',leaf('speed'));t.action=()=>{};
 assert.deepEqual(layout(t,{promoted:['speed']}).cells.map(c=>c.id),['root','speed']);
});
