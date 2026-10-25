const test=require('node:test'),assert=require('node:assert/strict');
const {layout,slot}=require('./mayatnik-menu-options.js');
test('predicted side respects screen and template-panel edge, including long lists',()=>{
 for(const right of [320,800,1400])for(const left of [4,right-124])for(const count of [1,5,8,25,100]){
  const column={left,right:left+120,width:120},owner={...column,top:560},g=layout(count,owner,column,right,600);
  assert.equal(g.side,left===4?'right':'left');assert.ok(g.left>=4);assert.ok(g.left+g.width<=right-4);assert.ok(g.top>=14);assert.ok(g.top+Math.min(g.rows,Math.floor((600-66)/50))*50-2+40<=586);assert.ok(g.rows*g.cols>=count);
 }
 const col={left:550,right:670,width:120};assert.equal(layout(5,{top:50},col,1000,800).side,'right');assert.equal(layout(5,{top:50},col,700,800).side,'left');
});

test('a very wide library leaves a bounded single-column dropdown without repeated cells',()=>{
 for(const right of [80,110,128])for(const count of [3,5,25]){
  const column={left:4,right:124,width:120},g=layout(count,{top:50},column,right,300),cells=Array.from({length:count},(_,i)=>slot(i,g.cols));
  assert.ok(g.left>=4);assert.ok(g.left+g.width<=right-4);assert.equal(g.cols,right<128?1:2);
  assert.equal(new Set(cells.map(c=>c.row+':'+c.column)).size,count);assert.equal(g.rows,Math.max(...cells.map(c=>c.row)));
 }
});

test('two options right, two left, then down: every count stays inside two columns',()=>{
 assert.deepEqual(Array.from({length:9},(_,i)=>slot(i)),[
  {row:1,column:2},{row:2,column:2},{row:1,column:1},{row:2,column:1},
  {row:3,column:2},{row:4,column:2},{row:3,column:1},{row:4,column:1},{row:5,column:2}
 ]);
 const column={left:4,right:124,width:120};
 for(let count=1;count<=100;count++){
  const g=layout(count,{top:50},column,320,250),cells=Array.from({length:count},(_,i)=>slot(i,g.cols));
  assert.ok(g.cols<=2);assert.equal(g.width,120);assert.equal(g.rows,Math.max(...cells.map(c=>c.row)));
  assert.equal(new Set(cells.map(c=>c.row+':'+c.column)).size,count);
  assert.ok(cells.every(c=>c.column<=g.cols));if(count>8)assert.equal(g.scroll,true);
 }
});
