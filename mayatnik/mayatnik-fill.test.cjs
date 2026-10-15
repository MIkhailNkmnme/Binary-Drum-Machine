const {test}=require('node:test'),assert=require('node:assert/strict');
const {fill,count}=require('./mayatnik-fill.js');
test('fill joins sides, never corners or opposite row edges',()=>{
 const p=Uint32Array.from([1,0,1,0,1,0,1,0,1]);
 assert.deepEqual([...fill(p,3,0,7)],[0]);assert.equal(count(p,3).regions,9);
 const edge=Uint32Array.from([0,0,1,1,0,0]);assert.equal(fill(edge,3,2,8).length,1);
});
test('fill covers an enclosed connected area, leaves boundary, equal colour is a no-op',()=>{
 const p=Uint32Array.from([0,0,0,0,0,0,1,1,1,0,0,1,0,1,0,0,1,1,1,0,0,0,0,0,0]);
 const q=fill(p,5,6,9);assert.equal(q.length,8);assert.equal(p[12],0);assert.equal(fill(p,5,6,9).length,0);
 const c=count(p,5);assert.equal(c.regions,3);assert.deepEqual(c.colours.get(0),{regions:2,pixels:17});
});
