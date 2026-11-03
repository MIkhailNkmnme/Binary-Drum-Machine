const test=require('node:test'),assert=require('node:assert/strict'),S=require('./mayatnik-gif-search.js');
const grid=rows=>({width:rows[0].length,height:rows.length,bits:Int8Array.from(rows.join(''),c=>c==='.'?-1:c==='?'?-2:+c)});
test('search reads exact saved bits, breaks at empty/mixed cells and includes overlapping hits',async()=>{
 const g=grid(['1111.11?11','0010.11?00']),before=g.bits.slice(),r=await S.search(g,{patterns:['11'],direction:'row'});
 assert.equal(r.count,6);assert.equal(r.mask[4],0);assert.equal(r.mask[7],0);assert.deepEqual(g.bits,before);
 for(const hit of r.hits)assert.equal(Array.from(hit.cells,q=>g.bits[q]).join(''),hit.text);
});
test('all four directions and variants use the same explicit cell grid',async()=>{
 const g=grid(['100','010','001']);for(const direction of ['row','col','diag','antidiag','all']){
  const r=await S.search(g,{patterns:['100'],direction,inverse:true,reverse:true});assert.ok(r.complete);for(const h of r.hits)assert.equal(Array.from(h.cells,q=>g.bits[q]).join(''),h.text);
 }
 const a=await S.search(g,{patterns:['111'],direction:'diag'});assert.equal(a.count,1);assert.deepEqual([...a.hits[0].cells],[0,4,8]);
 const b=await S.search(grid(['10110']),{patterns:['01001'],direction:'row',inverse:true});assert.equal(b.count,1);
});
test('maximal runs, alternating series and hit limits retain an exact full count and mask',async()=>{
 const g=grid(['11101111','01010101']);const r=await S.search(g,{pattern:'ones',min:3,maxHits:1});assert.equal(r.count,2);assert.equal(r.hits.length,1);assert.equal(r.mask.reduce((a,b)=>a+b),7);
 const a=await S.search(grid(['010101']),{pattern:'alternating',min:4});assert.equal(a.count,1);assert.equal(a.hits[0].text,'010101');
});
test('large searches yield and reject stale work without mutating a frame',async()=>{
 const g=grid(['0'.repeat(8192)]);let cancelled=false;await assert.rejects(S.search(g,{patterns:['1'],budgetMs:0,cancelled:()=>cancelled,yieldTask:async()=>{cancelled=true;}}),{name:'AbortError'});assert.ok(g.bits.every(v=>v===0));
 await assert.rejects(S.search(g,{patterns:['x']}),/последовательность/);await assert.rejects(S.search(g,{patterns:['1'],direction:'missing'}),/направление/);
});
