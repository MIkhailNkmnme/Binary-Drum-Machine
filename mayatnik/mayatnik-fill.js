/* Exact raster flood fill: equal RGBA colours, four neighbours, no diagonal joins. */
(function(root){
  'use strict';
  function neighbours(q,w,n,visit){
    if(q%w)visit(q-1);if(q%w<w-1)visit(q+1);
    if(q>=w)visit(q-w);if(q+w<n)visit(q+w);
  }
  function fill(pixels,w,start,colour){
    if(start<0||start>=pixels.length||pixels[start]===colour)return new Uint32Array();
    const old=pixels[start],queue=new Uint32Array(pixels.length);let head=0,tail=1;
    queue[0]=start;pixels[start]=colour;
    const visit=q=>{if(pixels[q]===old){pixels[q]=colour;queue[tail++]=q;}};
    while(head<tail)neighbours(queue[head++],w,pixels.length,visit);
    return queue.slice(0,tail);
  }
  function count(pixels,w){
    const seen=new Uint8Array(pixels.length),queue=new Uint32Array(pixels.length),colours=new Map();let regions=0;
    for(let i=0;i<pixels.length;i++){
      if(seen[i])continue;const colour=pixels[i];let head=0,tail=1;queue[0]=i;seen[i]=1;
      const visit=q=>{if(!seen[q]&&pixels[q]===colour){seen[q]=1;queue[tail++]=q;}};
      while(head<tail)neighbours(queue[head++],w,pixels.length,visit);
      regions++;const entry=colours.get(colour)||{regions:0,pixels:0};entry.regions++;entry.pixels+=tail;colours.set(colour,entry);
    }
    return {regions,colours};
  }
  const api={fill,count};if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikFill=api;
})(typeof window==='object'?window:globalThis);
