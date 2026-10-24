const test=require('node:test'),assert=require('node:assert/strict');
const {layout}=require('./mayatnik-menu-options.js');
test('predicted side respects screen and template-panel edge, including long lists',()=>{
 for(const right of [320,800,1400])for(const left of [4,right-124])for(const count of [1,5,8,25,100]){
  const column={left,right:left+120,width:120},owner={...column,top:560},g=layout(count,owner,column,right,600);
  assert.equal(g.side,left===4?'right':'left');assert.ok(g.left>=4);assert.ok(g.left+g.width<=right-4);assert.ok(g.top>=14);assert.ok(g.top+Math.min(g.rows,Math.floor((600-66)/50))*50-2+40<=586);assert.ok(g.rows*g.cols>=count);
 }
 const col={left:550,right:670,width:120};assert.equal(layout(5,{top:50},col,1000,800).side,'right');assert.equal(layout(5,{top:50},col,700,800).side,'left');
});
