/* Codex — независимый исследователь Хоррориуса · 12.10.2026.
   Exact integer-scale histogram. Source coordinates are cell indices, not CSS pixels.
   An active bit marks a real cell; inactive cells are void, not binary zeros. */
'use strict';
function popcount(v){
  v-=v>>>1&0x55555555;
  v=(v&0x33333333)+(v>>>2&0x33333333);
  return ((v+(v>>>4)&0x0f0f0f0f)*0x01010101)>>>24;
}
function rangeMask(lo,hi){
  return lo>hi?0:((0xffffffff<<lo)&(0xffffffff>>>(31-hi)))>>>0;
}
// Adds one 32-cell source word to an output row. Split every boundary explicitly.
// ones and cells may be subarrays into a 2D histogram; all counts are integers.
function accumulateWord(ones,cells,word,activeMask,startX,scale){
  if(!Number.isSafeInteger(scale)||scale<1)throw new RangeError('positive integer scale required');
  if(ones.length!==cells.length)throw new RangeError('histogram lengths differ');
  const first=Math.max(0,Math.floor(startX/scale));
  const last=Math.min(cells.length-1,Math.floor((startX+31)/scale));
  for(let x=first;x<=last;x++){
    const lo=Math.max(0,x*scale-startX),hi=Math.min(31,(x+1)*scale-1-startX);
    const mask=activeMask&rangeMask(lo,hi);
    cells[x]+=popcount(mask);ones[x]+=popcount(word&mask);
  }
}
module.exports={popcount,rangeMask,accumulateWord};
