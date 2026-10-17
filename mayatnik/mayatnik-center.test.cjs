const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('./mayatnik-center.js'),M=require('./mayatnik-core.js');
test('empty field has no centre; rectangle includes both zero and one cells',()=>{
 assert.equal(C.measure(M.field(8,4,'empty')).center,null);
 assert.deepEqual(C.measure(M.field(8,4,'0')).center,{x:4,y:2});
 assert.deepEqual(C.measure(M.field(8,4,'1')).center,{x:4,y:2});
});
test('one cone has its area centre below half-height; colours do not move it',()=>{
 const f=M.field(11,4,'empty',5);M.cone(f,5,4);
 const a=C.measure(f);assert.deepEqual(a.center,{x:5.5,y:2.5});assert.equal(a.count,10);
 for(let i=0;i<f.val.length;i++)if(f.val[i]>=0)f.val[i]^=1;
 assert.deepEqual(C.measure(f).center,a.center);
});
test('translation and reflection of an asymmetric footprint transform its centre',()=>{
 const f={W:8,H:3,val:new Int8Array(24).fill(-1)};f.val[0]=1;f.val[9]=0;f.val[10]=1;
 const a=C.measure(f),g={...f,val:new Int8Array(24).fill(-1)};
 for(let r=0;r<3;r++)for(let c=0;c<8;c++)g.val[r*8+7-c]=f.val[r*8+c];
 assert.equal(C.measure(g).center.x,8-a.center.x);assert.equal(C.measure(g).center.y,a.center.y);
 assert.equal(a.zero,1);assert.equal(a.one,2);assert.equal(a.empty,21);
});
