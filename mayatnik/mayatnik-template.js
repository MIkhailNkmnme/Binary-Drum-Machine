/* A colour mask and its centred transform; independent of the bit field. */
(function(root){
  'use strict';
  function capture(pixels,w,h,colour,left=0,right=w){
    let x0=right,x1=-1,y0=h,y1=-1,count=0;
    for(let y=0;y<h;y++)for(let x=left;x<right;x++)if(pixels[y*w+x]===colour){
      x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);count++;
    }
    if(!count)return null;
    const width=x1-x0+1,height=y1-y0+1,data=new Uint32Array(width*height);
    for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(pixels[(y+y0)*w+x+x0]===colour)data[y*width+x]=colour;
    return {x:x0,y:y0,width,height,data,count};
  }
  function rect(mask,axis,sy,proportional,down){
    const sx=proportional?sy:1;
    return {x:axis+(mask.x-axis)*sx,y:mask.y+down,width:mask.width*sx,height:mask.height*sy};
  }
  function contains(mask,r,x,y){
    if(x<r.x||y<r.y||x>=r.x+r.width||y>=r.y+r.height)return false;
    return !!mask.data[Math.floor((y-r.y)/r.height*mask.height)*mask.width+Math.floor((x-r.x)/r.width*mask.width)];
  }
  function symmetry(mask){
    const {width:w,height:h,data}=mask;let v=true,horizontal=true,d=w===h,u=w===h;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const b=!!data[y*w+x];
      if(b!==!!data[y*w+w-1-x])v=false;
      if(b!==!!data[(h-1-y)*w+x])horizontal=false;
      if(d&&b!==!!data[x*w+y])d=false;
      if(u&&b!==!!data[(w-1-x)*w+h-1-y])u=false;
    }
    return {v,h:horizontal,d,u};
  }
  function edges(mask){
    const {width:w,height:h,data}=mask,out=[];
    for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(data[y*w+x]){
      if(!y||!data[(y-1)*w+x])out.push(x,y,x+1,y);
      if(y===h-1||!data[(y+1)*w+x])out.push(x,y+1,x+1,y+1);
      if(!x||!data[y*w+x-1])out.push(x,y,x,y+1);
      if(x===w-1||!data[y*w+x+1])out.push(x+1,y,x+1,y+1);
    }
    return new Float32Array(out);
  }
  const api={capture,rect,contains,symmetry,edges};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikTemplate=api;
})(typeof window==='object'?window:globalThis);
