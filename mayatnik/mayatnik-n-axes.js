/* Independent N-axis sets, in displayed logical coordinates. No field or DOM writes. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.MayatnikNAxes=api;
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  function normaliseN(value){
    if(typeof value!=='number'&&typeof value!=='string'||typeof value==='string'&&!value.trim())return 3;
    const n=Number(value);return Number.isFinite(n)?Math.max(1,Math.min(64,Math.round(n))):3;
  }
  function createSet(value){
    if(!value||typeof value!=='object')return null;
    const {id,row,left,center,right}=value;
    if(!(typeof id==='string'&&id.trim()||typeof id==='number'&&Number.isFinite(id)))return null;
    if(!Number.isInteger(row)||row<0||![left,center,right].every(Number.isFinite)||left>center||center>right)return null;
    return {id,row,left,center,right,n:normaliseN(value.n)};
  }
  function positions(value){
    const set=createSet(value);if(!set)return [];
    const {left,center,right,n}=set,xs=[left];
    // Keep collapsed halves exact; weighted fallback avoids overflowing a finite span.
    const between=(a,b,t)=>a===b?a:Number.isFinite(b-a)?a+(b-a)*t:a*(1-t)+b*t;
    for(let step=1;step<n;step++)xs.push(between(left,center,step/n));
    xs.push(center);
    for(let step=1;step<n;step++)xs.push(between(center,right,step/n));
    xs.push(right);
    return [...new Set(xs)].sort((a,b)=>a-b);
  }
  function lines(set,bounds){
    if(!bounds||![bounds.top,bounds.bottom].every(Number.isFinite)||bounds.top>bounds.bottom)return [];
    return positions(set).map(x=>({x,a:[x,bounds.top],b:[x,bounds.bottom]}));
  }
  function normaliseSets(values){
    return Array.isArray(values)?values.map(createSet).filter(Boolean):[];
  }
  return {normaliseN,createSet,positions,lines,normaliseSets};
});
