/* Automatic vertical axes BETWEEN full-grid zero triangles.
 * Coordinates are cell edges: a cell (c,r) has centre (c+.5,r+.5).
 * The triangle geometry deliberately matches areaTriPts / areaCalc:
 * base (c+.5 +/- h,y), apex (c+.5,y+h), h*h zero cells.
 * No meeting-point restriction, candidate cap, palette, or canvas dependency. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikAutoAxes=api;})(globalThis,function createAutoAxes(){
  'use strict';
  function validate(field){
    const {W,H,val}=field||{};
    if(!Number.isSafeInteger(W)||!Number.isSafeInteger(H)||W<0||H<0||!Number.isSafeInteger(W*H)||!val||val.length<W*H)throw new TypeError('Expected finite W by H logical field');
  }
  function triangles(field,{minHeight=4}={}){
    validate(field);
    if(!Number.isInteger(minHeight)||minHeight<1)throw new RangeError('minHeight must be a positive integer');
    const {W,H,val}=field,heights=new Uint32Array(W*H),candidates=[];
    for(let r=0;r<H;r++)for(let c=0;c<W;c++){
      const i=r*W+c;if(val[i]!==0)continue;
      heights[i]=r&&c&&c<W-1?1+Math.min(heights[i-W-1],heights[i-W],heights[i-W+1]):1;
    }
    for(let r=0;r<H;r++)for(let c=0;c<W;c++){
      const i=r*W+c,h=heights[i];
      if(h>=minHeight&&!(r+1<H&&heights[i+W]===h+1))candidates.push(i);
    }
    candidates.sort((a,b)=>heights[b]-heights[a]||a-b);
    // Same accepted-apex exclusion as areaCalc, but O(1) membership.
    // Packed coverage avoids a triangles.some scan for every candidate.
    const stride=Math.ceil(W/32),covered=new Uint32Array(stride*H),result=[];
    for(const i of candidates){
      const c=i%W,r=Math.floor(i/W),h=heights[i];
      if(covered[r*stride+(c>>>5)]&(1<<(c&31)))continue;
      const y=r-h+1;
      result.push({x:c-h+1,y,h,w:2*h-1,n:h*h,bit:0});
      for(let row=y;row<=r;row++){
        const radius=r-row,lo=c-radius,hi=c+radius,L=lo>>>5,R=hi>>>5,base=row*stride;
        const left=0xffffffff<<(lo&31),right=0xffffffff>>>(31-(hi&31));
        if(L===R)covered[base+L]|=left&right;
        else{covered[base+L]|=left;covered.fill(0xffffffff,base+L+1,base+R);covered[base+R]|=right;}
      }
    }
    return result;
  }
  function union(intervals){
    intervals.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);const result=[];
    for(const interval of intervals){const prev=result[result.length-1];if(prev&&interval[0]<=prev[1])prev[1]=Math.max(prev[1],interval[1]);else result.push(interval.slice());}
    return result;
  }
  function segments(field,tris){
    validate(field);const {W,H,val}=field,result=[];
    const columns=[...new Set(tris.map(t=>t.x+t.h-1))].sort((a,b)=>a-b);
    for(const c of columns){
      if(c<0||c>=W||!Number.isInteger(c))continue;
      const blocked=[];
      for(const t of tris){
        const distance=Math.abs(c-(t.x+t.h-1));
        if(distance<t.h){const lo=Math.max(0,t.y),hi=Math.min(H,t.y+t.h-distance);if(hi>lo)blocked.push([lo,hi]);}
      }
      const holes=union(blocked);let j=0,r=0;
      // Unwritten rows are boundaries too; axes never cross absent field cells.
      while(r<H){
        while(r<H&&val[r*W+c]<0)r++;
        const start=r;while(r<H&&val[r*W+c]>=0)r++;
        let y=start;const end=r;
        while(j<holes.length&&holes[j][1]<=y)j++;
        for(let k=j;k<holes.length&&holes[k][0]<end;k++){
          if(holes[k][0]>y)result.push({x:c+.5,y0:y,y1:Math.min(end,holes[k][0]),h:Math.min(end,holes[k][0])-y});
          y=Math.max(y,holes[k][1]);if(y>=end)break;
        }
        if(y<end)result.push({x:c+.5,y0:y,y1:end,h:end-y});
      }
    }
    return result;
  }
  function analyze(field,options){const tris=triangles(field,options);return {triangles:tris,segments:segments(field,tris)};}
  function createWorker(){
    const source=`const api=(${createAutoAxes.toString()})();onmessage=e=>{const {id,field,options}=e.data;try{postMessage({id,...api.analyze(field,options)});}catch(error){postMessage({id,error:error.message});}};`;
    const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));
    try{return new Worker(url);}finally{URL.revokeObjectURL(url);}
  }
  return {triangles,segments,analyze,createWorker};
});
