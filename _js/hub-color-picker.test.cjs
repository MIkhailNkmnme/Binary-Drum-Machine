const test=require('node:test'),assert=require('node:assert/strict');
const {diamondPoint}=require('./hub-color-picker.js');
test('diamond vertices preserve the full saturation and brightness range',()=>{
 assert.deepEqual(diamondPoint(.5,0),{s:0,v:1});
 assert.deepEqual(diamondPoint(1,.5),{s:1,v:1});
 assert.deepEqual(diamondPoint(.5,1),{s:1,v:0});
 assert.deepEqual(diamondPoint(0,.5),{s:0,v:0});
 for(const s of [0,.17,.5,.89,1])for(const v of [0,.21,.75,1]){
  const p=diamondPoint((s+v)/2,(1+s-v)/2);assert.ok(Math.abs(p.s-s)<1e-12);assert.ok(Math.abs(p.v-v)<1e-12);
 }
 assert.deepEqual(diamondPoint(2,.5),{s:1,v:1});
});
