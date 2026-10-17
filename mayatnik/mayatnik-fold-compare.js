/* v1: exact vertical folds on a half-cell lattice; source bits never change. */
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
    return {W,H,anchor,frame,left,right,top,bottom,width,height,empty,max:width,bit,target,pair,analyze};
  }
  const api={create};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MayatnikFoldCompare=api;
})(typeof globalThis!=='undefined'?globalThis:this);
