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
test('loop joins rows and the last bit to the first while skipping only empty cells',async()=>{
 const g=grid(['.10.','0.11']),before=g.bits.slice();
 const r=await S.search(g,{patterns:['001','110'],direction:'loop'});
 assert.equal(r.count,2);assert.deepEqual(r.hits.map(h=>[...h.cells]),[[2,4,6],[7,1,2]]);
 assert.deepEqual(g.bits,before);assert.equal(r.mask[0],0);assert.equal(r.mask[3],0);assert.equal(r.mask[5],0);
 for(const hit of r.hits){assert.equal(hit.direction,'loop');assert.equal(Array.from(hit.cells,q=>g.bits[q]).join(''),hit.text);}
 const barrier=await S.search(grid(['1?1']),{patterns:['111'],direction:'loop'});assert.equal(barrier.count,0);
 const seam=await S.search(grid(['1?1']),{patterns:['11'],direction:'loop'});assert.equal(seam.count,1);assert.deepEqual([...seam.hits[0].cells],[2,0]);
 for(const rows of [['...'],['???']])assert.equal((await S.search(grid(rows),{patterns:['0'],direction:'loop'})).count,0);
});
test('loop finite patterns may span repeated laps but every origin is counted once',async()=>{
 const r=await S.search(grid(['1.0']),{patterns:['10101','10101'],direction:'loop'});
 assert.equal(r.count,1);assert.deepEqual([...r.hits[0].cells],[0,2,0,2,0]);
 const repeated=await S.search(grid(['111']),{patterns:['11111'],direction:'loop',maxHits:1});
 assert.equal(repeated.count,3);assert.equal(repeated.hits.length,1);assert.deepEqual([...repeated.mask],[1,1,1]);
 const variants=await S.search(grid(['110.']),{patterns:['001'],direction:'loop',inverse:true,reverse:true,half:true});
 assert.ok(variants.count>0);for(const hit of variants.hits){assert.equal(Array.from(hit.cells,q=>['110.'][0][q]).join(''),hit.text);assert.ok(hit.variantFlags);}
});
test('loop maximal runs merge at the seam and preserve inverse and alternating semantics',async()=>{
 const ones=await S.search(grid(['11011']),{pattern:'ones',min:3,direction:'loop'});
 assert.equal(ones.count,1);assert.equal(ones.hits[0].text,'1111');assert.deepEqual([...ones.hits[0].cells],[3,4,0,1]);
 const zeros=await S.search(grid(['00100']),{pattern:'zeros',min:3,direction:'loop'});assert.equal(zeros.hits[0].text,'0000');
 const inverse=await S.search(grid(['11000']),{pattern:'ones',inverse:true,min:2,direction:'loop',maxHits:1});assert.equal(inverse.count,2);assert.equal(inverse.mask.reduce((a,b)=>a+b),5);assert.equal(inverse.hits.length,1);
 for(const [text,pattern]of [['1111','ones'],['0000','zeros'],['0101','alternating']]){
  const r=await S.search(grid([text]),{pattern,min:4,direction:'loop'});assert.equal(r.count,1);assert.equal(r.hits[0].text,text);
  assert.equal((await S.search(grid([text]),{pattern,min:5,direction:'loop'})).count,0);
 }
 const odd=await S.search(grid(['010']),{pattern:'alternating',min:3,direction:'loop'});assert.equal(odd.count,1);assert.equal(odd.hits[0].text,'010');
 const wrapped=await S.search(grid(['0110']),{pattern:'alternating',min:2,direction:'loop'});assert.equal(wrapped.count,2);
});
test('loop scanning and long matching remain cancellable with exact hit limits',async()=>{
 const g=grid(['01'.repeat(4096)]);let pauses=0;
 const r=await S.search(g,{patterns:['10'],direction:'loop',maxHits:0,budgetMs:0,yieldTask:async()=>{pauses++;}});
 assert.equal(r.count,4096);assert.equal(r.hits.length,0);assert.ok(r.mask.every(v=>v===1));assert.ok(pauses>0);assert.equal(r.yields,pauses);
 let cancelled=false;await assert.rejects(S.search(grid(['1']),{patterns:['1'.repeat(8192)],direction:'loop',budgetMs:0,cancelled:()=>cancelled,yieldTask:async()=>{cancelled=true;}}),{name:'AbortError'});
});
test('loop long words with no saved hits mark the ring once instead of traversing every repeated lap',async()=>{
 let yields=0;const r=await S.search(grid(['1'.repeat(64)]),{patterns:['1'.repeat(32768)],direction:'loop',maxHits:0,budgetMs:0,yieldTask:async()=>{yields++;}});
 assert.equal(r.count,64);assert.equal(r.hits.length,0);assert.ok(r.mask.every(v=>v===1));
 // Prefix construction, modular scan and one mask circuit require linear work.
 assert.ok(yields>=60&&yields<=70,`expected linear operation-gate yields, got ${yields}`);
});
test('loop KMP prefix construction and mismatch scanning both allow cancellation',async()=>{
 for(const word of ['1'.repeat(8192),'01']){
  const g=grid([word.length>2?'1':'0'.repeat(8192)]),cancelAt=word.length>2?1:9;let cancelled=false,yields=0;
  await assert.rejects(S.search(g,{patterns:[word],direction:'loop',maxHits:0,budgetMs:0,cancelled:()=>cancelled,yieldTask:async()=>{cancelled=++yields>=cancelAt;}}),{name:'AbortError'});
  assert.equal(yields,cancelAt);
 }
});
test('all through families keep four independent cycles with agreed geometric traversal',async()=>{
 const r=await S.search(grid(['111','111']),{pattern:'ones',min:6,direction:'loops'});
 assert.equal(r.count,4);
 assert.deepEqual(r.hits.map(h=>[h.direction,[...h.cells]]),[
  ['loop-row',[0,1,2,3,4,5]],['loop-col',[0,3,1,4,2,5]],
  ['loop-diag',[3,0,4,1,5,2]],['loop-antidiag',[0,1,3,2,4,5]]
 ]);
 const single=await S.search(grid(['1']),{patterns:['111'],direction:'loops'});
 assert.equal(single.count,4);for(const hit of single.hits)assert.deepEqual([...hit.cells],[0,0,0]);
 const limited=await S.search(grid(['111','111']),{pattern:'ones',min:6,direction:'loops',maxHits:0});
 assert.equal(limited.count,4);assert.equal(limited.hits.length,0);assert.ok(limited.mask.every(v=>v===1));
});
test('all through explicit matches wrap only their own family, skipping empty cells with unknown barriers',async()=>{
 const orders={'loop-row':[0,1,2,3,4,5],'loop-col':[0,3,1,4,2,5],'loop-diag':[3,0,4,1,5,2],'loop-antidiag':[0,1,3,2,4,5]};
 for(const rows of [['101','001'],['1.0','?01']]){
  const g=grid(rows);
  for(const word of ['10','01','110','001','101001101001']){
   const expected=[];
   for(const [direction,raw]of Object.entries(orders)){
    const cells=raw.filter(q=>g.bits[q]!==-1);
    for(let start=0;start<cells.length;start++){
     const hit=Array.from({length:word.length},(_,j)=>cells[(start+j)%cells.length]);
     if(hit.map(q=>g.bits[q]).join('')===word)expected.push([direction,hit]);
    }
   }
   const r=await S.search(g,{patterns:[word],direction:'loops'});
   assert.equal(r.count,expected.length);assert.deepEqual(r.hits.map(h=>[h.direction,[...h.cells]]),expected);
   assert.deepEqual([...r.mask],Array.from({length:6},(_,q)=>expected.some(([,hit])=>hit.includes(q))?1:0));
  }
 }
 const alt=await S.search(grid(['0101']),{pattern:'alternating',min:4,direction:'loops'});assert.equal(alt.count,4);
});


test('compact GIF search ignores empty cells, retains addresses, and stops at unknown bits',async()=>{
 const Search=require('./mayatnik-gif-search.js'),grid={width:7,height:1,bits:Int8Array.from([1,-1,0,-1,-1,1,-1])};
 assert.equal((await Search.search(grid,{patterns:['101'],direction:'row'})).count,0);
 const compact=await Search.search(grid,{patterns:['101'],direction:'row',skipSpaces:true});assert.equal(compact.count,1);assert.deepEqual(Array.from(compact.hits[0].cells),[0,2,5]);assert.deepEqual(Array.from(compact.mask),[1,0,1,0,0,1,0]);
 grid.bits[3]=-2;assert.equal((await Search.search(grid,{patterns:['101'],direction:'row',skipSpaces:true})).count,0);
});
