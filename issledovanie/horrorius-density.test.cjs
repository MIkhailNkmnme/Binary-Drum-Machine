/* Codex — независимый исследователь Хоррориуса · 12.10.2026. */
'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {popcount,rangeMask,accumulateWord}=require('./horrorius-density.cjs');
test('every partial-word mask matches explicit bits, including bit 31',()=>{
  for(let lo=0;lo<32;lo++)for(let hi=lo;hi<32;hi++){
    const m=rangeMask(lo,hi);assert.equal(popcount(m),hi-lo+1);
    for(let b=0;b<32;b++)assert.equal((m>>>b)&1,+(b>=lo&&b<=hi));
  }
});
test('integer downsampling equals per-cell counting for all alignments',()=>{
  let seed=179;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
  for(const s of [1,2,3,7,31,32,33,71,547])for(let trial=0;trial<300;trial++){
    const start=(rnd()%160)-32,word=rnd(),active=rnd(),n=170;
    const ones=new Float64Array(n),cells=new Float64Array(n),a=new Float64Array(n),b=new Float64Array(n);
    accumulateWord(ones,cells,word,active,start,s);
    for(let i=0;i<32;i++)if((active>>>i)&1){const x=Math.floor((start+i)/s);if(x>=0&&x<n){b[x]++;a[x]+=(word>>>i)&1;}}
    assert.deepEqual(ones,a);assert.deepEqual(cells,b);
  }
});
test('a word crossing a pixel boundary keeps the single one in its own bin',()=>{
  const ones=new Float64Array(2),cells=new Float64Array(2);
  accumulateWord(ones,cells,1,0xffffffff,20,33);
  assert.deepEqual([...ones],[1,0]);assert.deepEqual([...cells],[13,19]);
});
test('masked endpoint is retained even if word centre lies outside the triangle',()=>{
  const ones=new Float64Array(2),cells=new Float64Array(2);
  accumulateWord(ones,cells,1,1,33,33);
  assert.equal(ones[1],1);assert.equal(cells[1],1);
});
