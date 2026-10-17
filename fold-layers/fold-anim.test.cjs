const {test}=require('node:test'),assert=require('node:assert/strict'),A=require('./fold-anim-core.js');
test('frame is identical to a sequence of row steps using the updated upper row',()=>{
 const base=['','1','111','10011','1000011'],a=base.slice(),b=base.slice(),sa=A.create(a,'above'),sb=A.create(b,'above');
 A.step(a,sa,'frame');for(let i=0;i<3;i++)A.step(b,sb);
 assert.deepEqual(a,b);assert.equal(sa.frame,1);assert.equal(sb.cursor,0);assert.deepEqual(a.slice(0,3),['','1','101']);
});
test('partial frame finishes at boundary; back restores rows, phase and highlights exactly',()=>{
 const rows=['','1','111','10011'],s=A.create(rows);A.step(rows,s);const partial=rows.slice(),last=s.last.slice();
 A.step(rows,s,'frame');assert.equal(s.frame,1);assert.equal(s.cursor,0);A.back(rows,s);assert.deepEqual(rows,partial);assert.equal(s.frame,0);assert.equal(s.cursor,1);assert.deepEqual(s.last,last);
 A.back(rows,s);assert.deepEqual(rows,s.base);assert.equal(s.history.length,0);
});
test('two-neighbor XOR uses both actual upper diagonal neighbors, empty exterior is zero',()=>{
 const rows=['1','000'];A.waveRow(rows,0,1,'neighbors');assert.equal(rows[1],'101');
});
test('zero changes still advances a frame and JSON round trip preserves backward playback',()=>{
 const rows=['','0','000'],s=A.create(rows);A.step(rows,s,'frame');assert.equal(s.frame,1);assert.equal(s.last.length,0);const copy=JSON.parse(JSON.stringify(s));assert(A.back(rows,copy));assert.equal(copy.frame,0);
});
test('128-row frozen source stays intact and both playback units agree',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),ctx={window:{}};vm.runInNewContext(fs.readFileSync(require.resolve('./horrohorius-128.js'),'utf8'),ctx);
 const source=['',...ctx.window.ZZ_HORROHORIUS_128.rows],rows=source.slice(),s=A.create(rows),other=source.slice(),q=A.create(other);
 A.step(rows,s,'frame');for(let i=0;i<127;i++)A.step(other,q);assert.deepEqual(rows,other);assert.deepEqual(s.base,source);assert(s.last.length>0);const restored=A.reset(rows,s);assert.deepEqual(rows,source);assert.equal(restored.frame,0);
});
