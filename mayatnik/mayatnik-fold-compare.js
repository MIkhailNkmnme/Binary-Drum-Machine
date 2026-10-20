/* v2: exact vertical folds on a half-cell lattice; v2 — any axis through two points (cell centre = x + 1/2); source bits never change. */
(function(root){
  'use strict';
  function create({W,H,val,anchor=0,frame=0,span=null}){
    if(!Number.isInteger(W)||!Number.isInteger(H)||W<1||H<1||val.length!==W*H)throw Error('Invalid field');
    const data=Int8Array.from(val);let left=W,right=-1,top=H,bottom=-1;
    // Only actual cone occupancy; visual trimming of uniform strips must not remove bits.
    if(span)for(let y=0;y<H;y++)for(let x=0;x<W;x++){
      const c=x-anchor,lo=Math.max(span[0],c-y),hi=Math.min(span[1],c+y),first=lo+((c+y-lo)%2+2)%2;
      if(first>hi)data[y*W+x]=-1;
    }
    for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(data[y*W+x]>=0){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
    const empty=right<left,width=empty?0:right-left+1,height=empty?0:bottom-top+1;
    const bit=(x,y)=>x>=0&&x<W&&y>=0&&y<H?data[y*W+x]:-1;
    const clamp=n=>Math.max(0,Math.min(width,Math.round(n)));
    // Cell centre x + 1/2 reflects to (2*left + step) - x - 1/2.
    const target=(x,step)=>2*left+clamp(step)-x-1;
    function pair(x,y,step){
      step=clamp(step);const sx=target(x,step);
      if(x<left||x>right||y<top||y>bottom)return null;
      if(sx===x)return {kind:'fixed',x,sx,y,to:bit(x,y),from:bit(x,y)};
      if(x<sx||sx<left)return null;
      const from=bit(sx,y),to=bit(x,y);
      const kind=from<0?(to<0?'empty':'missing'):to<0?'overhang':from===to?'same':'different';
      return {kind,x,sx,y,from,to};
    }
    function analyze(step){
      step=clamp(step);const n=Math.floor(step/2),out={step,axis:left+step/2,distance:step/2,same:0,different:0,overhang:0,missing:0,fixed:0,first:null};
      for(let y=top;y<=bottom;y++){
        const row=y*W;
        for(let k=0;k<n;k++){
          const sx=left+k,x=2*left+step-sx-1,a=data[row+sx],b=data[row+x];
          if(a<0&&b<0)continue;
          const kind=a<0?'missing':b<0?'overhang':a===b?'same':'different';out[kind]++;
          if(kind==='different'&&!out.first)out.first={sx,x,y,from:a,to:b};
        }
        if(step%2&&data[row+left+n]>=0)out.fixed++;
      }
      out.pairs=out.same+out.different;
      out.match=out.pairs>0&&out.different===0&&out.overhang===0&&out.missing===0;
      return out;
    }
    // v2: axis through A and B (cell-centre coordinates). Side < 0 is the source (folded) side, > 0 the target.
    // A reflected centre is rounded to the nearest cell: exact for 0°, 45°, 90°; nearest cell for other slopes.
    function line(A,B,flip){
      let dx=B.x-A.x,dy=B.y-A.y;const L=Math.hypot(dx,dy);if(!L)return null;dx/=L;dy/=L;const g=flip?-1:1;
      const side=(px,py)=>{const s=((px-A.x)*dy-(py-A.y)*dx)*g;return Math.abs(s)<1e-9?0:s;};
      const mirror=(x,y)=>{const ux=x+.5-A.x,uy=y+.5-A.y,t=ux*dx+uy*dy;return [Math.round(A.x+2*t*dx-ux-.5)+0,Math.round(A.y+2*t*dy-uy-.5)+0];};
      function pair(x,y){
        if(empty||x<left||x>right||y<top||y>bottom)return null;const s=side(x+.5,y+.5),to=bit(x,y);
        if(s===0)return {kind:'fixed',x,y,sx:x,sy:y,from:to,to};
        if(s<0)return null;
        const [sx,sy]=mirror(x,y),from=bit(sx,sy),kind=from<0?(to<0?'empty':'missing'):to<0?'overhang':from===to?'same':'different';
        return {kind,x,y,sx,sy,from,to};
      }
      function analyze(){
        const out={same:0,different:0,overhang:0,missing:0,fixed:0,first:null};
        for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++){
          const a=data[y*W+x],s=side(x+.5,y+.5);
          if(s===0){if(a>=0)out.fixed++;continue;}
          if(s>0)continue;
          const [tx,ty]=mirror(x,y),b=bit(tx,ty);if(a<0&&b<0)continue;
          const kind=a<0?'missing':b<0?'overhang':a===b?'same':'different';out[kind]++;
          if(kind==='different'&&!out.first)out.first={sx:x,sy:y,x:tx,y:ty,from:a,to:b};
        }
        out.pairs=out.same+out.different;out.match=out.pairs>0&&out.different===0&&out.overhang===0&&out.missing===0;
        const c=[[left,top],[right,top],[left,bottom],[right,bottom]].map(([x,y])=>side(x+.5,y+.5));
        out.atStart=c.every(v=>v>=0);out.atEnd=c.every(v=>v<=0);
        return out;
      }
      return {A,B,flip:!!flip,dx,dy,side,mirror,pair,analyze};
    }
    return {W,H,anchor,frame,left,right,top,bottom,width,height,empty,max:width,bit,target,pair,analyze,line};
  }
  const api={create};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MayatnikFoldCompare=api;
})(typeof globalThis!=='undefined'?globalThis:this);
