/* Rhomboid background grid v1: same row offsets and orientation as rendered cells. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ZZRmbGrid=api;})(globalThis,function(){
  'use strict';const mod2=n=>(n%2+2)%2;
  function runs(hs,u0,first,last,alignment){
    if(!hs.length||last<first)return [];
    const result=[],step=alignment==='c'?0:1,offset=(u0&1)?0:1;
    for(let row=first;row<=last;row++){
      const start=row<0?hs[0]+row*step:row>=hs.length?hs[hs.length-1]+(row-hs.length+1)*step:hs[row];
      const phase=mod2(start+offset+row),prior=result.at(-1);
      if(prior&&prior.phase===phase)prior.end=row+1;else result.push({start:row,end:row+1,phase});
    }
    return result;
  }
  function segments({hs,u0,alignment,tw,ox,oy,width,height},budget=50000){
    if(!hs.length||!(tw>0)||!(width>0)||!(height>0))return [];
    const half=tw/2,h=tw*Math.sqrt(3)/2,slope=half/h,first=Math.floor(-oy/h),last=Math.ceil((height-oy)/h)-1;
    const bands=runs(hs,u0,first,last,alignment),out=[];
    for(let row=first;row<=last+1;row++){const y=oy+row*h;out.push([0,y,width,y]);}
    let estimate=0;
    for(const band of bands){
      band.anchorY=oy+band.start*h;band.y0=Math.max(0,band.anchorY);band.y1=Math.min(height,oy+band.end*h);
      band.anchorX=ox+mod2(band.phase-band.start)*half;
      const span=Math.max(Math.abs(band.y0-band.anchorY),Math.abs(band.y1-band.anchorY))*slope;
      band.j0=Math.floor((-span-band.anchorX)/tw)-1;band.j1=Math.ceil((width+span-band.anchorX)/tw)+1;
      estimate+=2*(band.j1-band.j0+1);
    }
    // At extreme zoom draw a subset of real grid lines, never shifted approximations.
    const stride=Math.max(1,Math.ceil(estimate/budget));
    for(const b of bands)for(let j=b.j0;j<=b.j1;j+=stride){const x=b.anchorX+j*tw;
      for(const sign of [-1,1])out.push([x+sign*(b.y0-b.anchorY)*slope,b.y0,x+sign*(b.y1-b.anchorY)*slope,b.y1]);
    }
    return out;
  }
  return {runs,segments};
});
