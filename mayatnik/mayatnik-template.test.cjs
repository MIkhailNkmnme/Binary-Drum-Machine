const {test}=require('node:test'),assert=require('node:assert/strict'),M=require('./mayatnik-template.js');
test('capture is exact, cropped, excludes other colours and leaves source intact',()=>{
 const p=Uint32Array.from([0,7,0,0,7,8,0,0,0]);const m=M.capture(p,3,3,7);
 assert.equal(m.count,2);assert.deepEqual([m.x,m.y,m.width,m.height],[1,0,1,2]);assert.equal(p[5],8);
 assert.equal(M.capture(p,3,3,9),null);assert.equal(M.capture(p,3,3,7,2,3),null);
});
test('height-only keeps x; proportional width scales about the axis; down is additive',()=>{
 const m={x:8,y:3,width:4,height:2,data:Uint32Array.from([7,0,0,7,7,0,0,7])};
 assert.deepEqual(M.rect(m,10,3,false,5),{x:8,y:8,width:4,height:6});
 const r=M.rect(m,10,3,true,5);assert.deepEqual(r,{x:4,y:8,width:12,height:6});
 assert.equal(M.contains(m,r,4.5,8.5),true);assert.equal(M.contains(m,r,10,10),false);assert.equal(M.contains(m,r,16,10),false);
});
test('silhouette symmetry is exact and does not assume every figure is symmetric',()=>{
 assert.deepEqual(M.symmetry({width:3,height:3,data:Uint32Array.from([0,1,0,1,1,1,0,1,0])}),{v:true,h:true,d:true,u:true});
 assert.deepEqual(M.symmetry({width:3,height:2,data:Uint32Array.from([0,1,0,1,1,1])}),{v:true,h:false,d:false,u:false});
});
