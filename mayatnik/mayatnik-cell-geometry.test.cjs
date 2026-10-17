const {test}=require('node:test'),assert=require('node:assert/strict'),G=require('./mayatnik-cell-geometry.js');
test('magnet selects cell corner, side midpoint and center',()=>{
  const hit=(x,y)=>G.snap(x,y,3,3,()=>true);
  assert.deepEqual(hit(1.08,1.1),{x:1,y:1,kind:'угол / граница'});
  assert.deepEqual(hit(1.51,1.1),{x:1.5,y:1,kind:'середина грани'});
  assert.deepEqual(hit(1.52,1.48),{x:1.5,y:1.5,kind:'центр бита'});
});
test('outer edges can be reached from the empty side; distant emptiness is rejected',()=>{
  const has=(x,y)=>x===1&&y===1;
  assert.deepEqual(G.snap(.85,1.5,4,4,has),{x:1,y:1.5,kind:'середина грани'});
  assert.deepEqual(G.snap(2.2,2.2,4,4,has),{x:2,y:2,kind:'угол / граница'});
  assert.equal(G.snap(3.8,3.8,4,4,has),null);
  assert.equal(G.snap(0,0,4,4,()=>false),null);
});
test('line deletion uses segment distance, not the infinite axis',()=>{
  assert.equal(G.distance({x:1,y:1},{x:0,y:0},{x:2,y:2}),0);
  assert.equal(G.distance({x:4,y:0},{x:0,y:0},{x:2,y:0}),2);
});
