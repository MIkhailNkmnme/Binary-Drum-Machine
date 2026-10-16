const test=require('node:test'),assert=require('node:assert/strict'),{layout}=require('./hub-menu-tree.js');
const leaf=id=>({id}),branch=(id,...children)=>({id,children});
const tree=branch('root',branch('A',leaf('a'),leaf('b')),branch('B',leaf('c'),leaf('d')));
test('initial level contains exactly one root; descendants unfold into successive columns',()=>{
 assert.deepEqual(layout(tree).cells,[{id:'root',column:0,row:0}]);
 assert.deepEqual(layout(tree,{open:['root','A']}).cells.map(c=>[c.id,c.column,c.row]),[['root',0,0],['A',1,0],['B',1,1],['a',2,0],['b',2,1]]);
});
test('promotions fill the first free positions downwards; empty branches vanish and return',()=>{
 const p=layout(tree,{promoted:['a','b'],open:['root']});assert.deepEqual(p.cells.map(c=>[c.id,c.column,c.row]),[['root',0,0],['a',0,1],['b',0,2],['B',1,0]]);
 const back=layout(tree,{promoted:['b'],open:['root','A']});assert.deepEqual(back.cells.map(c=>c.id),['root','b','A','B','a']);
 const all=layout(tree,{promoted:['a','b','c','d']});assert.deepEqual(all.cells.map(c=>[c.id,c.column,c.row]),[['a',0,0],['b',0,1],['c',0,2],['d',0,3]]);
});
test('a sixth button starts a new column; the next nesting level starts after it',()=>{
 const t=branch('root',...Array.from({length:6},(_,i)=>branch('b'+i,leaf('x'+i))));
 const p=layout(t,{open:['root','b5']});assert.deepEqual(p.cells.find(c=>c.id==='b5'),{id:'b5',column:2,row:0});assert.deepEqual(p.cells.find(c=>c.id==='x5'),{id:'x5',column:3,row:0});
});
test('promoted branch keeps its children and old unknown pins are ignored',()=>{
 const p=layout(tree,{promoted:['A','obsolete'],open:['A']});assert.deepEqual(p.cells.map(c=>c.id),['root','A','a','b']);
});
test('an actionable first button remains usable after all its settings are promoted',()=>{
 const t=branch('root',leaf('speed'));t.action=()=>{};
 assert.deepEqual(layout(t,{promoted:['speed']}).cells.map(c=>c.id),['root','speed']);
});
