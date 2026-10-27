/* Cells touched along an axis. Edge-coincident axes visit both neighbours;
 * a single corner touch does not add a cell. No raster-sized allocations. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikAxisColour=api;})(globalThis,function(){
  'use strict';
  const EPS=1e-9;
  function clip(a,b,box){
    let lo=0,hi=1;const d=[b[0]-a[0],b[1]-a[1]];
    if(Math.hypot(...d)<EPS)return null;
    for(let k=0;k<2;k++){if(Math.abs(d[k])<EPS){if(a[k]<box[k]-EPS||a[k]>box[k+2]+EPS)return null;continue;}
      const u=(box[k]-a[k])/d[k],v=(box[k+2]-a[k])/d[k];lo=Math.max(lo,Math.min(u,v));hi=Math.min(hi,Math.max(u,v));}
    return hi-lo>EPS?[[a[0]+lo*d[0],a[1]+lo*d[1]],[a[0]+hi*d[0],a[1]+hi*d[1]]]:null;
  }
  function traceCells(a,b,{clip:box,diamond=false,anchor=0,parity=0,offset=0},visit){
    if(![...a,...b,...box,anchor,parity,offset].every(Number.isFinite))return;
    const segment=clip(a,b,box);if(!segment)return;
    const transform=([x,y])=>diamond?[(x-offset+y-anchor-parity)/2,(x-offset-y-anchor-parity+1)/2]:[x-offset,y];
    const A=transform(segment[0]),B=transform(segment[1]),D=[B[0]-A[0],B[1]-A[1]];
    const next=[0,1].map(k=>Math.abs(D[k])<EPS?Infinity:((D[k]>0?Math.floor(A[k]+EPS)+1:Math.ceil(A[k]-EPS)-1)-A[k])/D[k]);
    const step=D.map(d=>Math.abs(d)<EPS?Infinity:1/Math.abs(d));let t=0;
    while(t<1-EPS){const end=Math.min(1,...next);if(end>t+EPS){
      const mid=(t+end)/2,at=A.map((v,k)=>v+D[k]*mid),cells=at.map((v,k)=>Math.abs(D[k])<EPS&&Math.abs(v-Math.round(v))<EPS?[Math.round(v)-1,Math.round(v)]:[Math.floor(v)]);
      for(const i of cells[0])for(const j of cells[1]){const x=diamond?i+j+anchor+parity+offset:i+offset,y=diamond?i-j:j;visit(x,y);}
    }t=end;for(let k=0;k<2;k++)if(next[k]<=end+EPS)next[k]+=step[k];}
  }
  return {clip,traceCells};
});
