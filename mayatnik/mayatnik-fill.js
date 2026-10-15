/* Exact raster flood fill: equal RGBA colours, four neighbours, no diagonal joins. */
(function(root){
  'use strict';
  function neighbours(q,w,n,visit,diagonal=false){
    if(q%w)visit(q-1);if(q%w<w-1)visit(q+1);
    if(q>=w)visit(q-w);if(q+w<n)visit(q+w);
    if(diagonal){if(q>=w){if(q%w)visit(q-w-1);if(q%w<w-1)visit(q-w+1);}if(q+w<n){if(q%w)visit(q+w-1);if(q%w<w-1)visit(q+w+1);}}
  }
  function fill(pixels,w,start,colour,diagonal=false){
    if(start<0||start>=pixels.length||pixels[start]===colour)return new Uint32Array();
    const old=pixels[start],queue=new Uint32Array(pixels.length);let head=0,tail=1;
    queue[0]=start;pixels[start]=colour;
    const visit=q=>{if(pixels[q]===old){pixels[q]=colour;queue[tail++]=q;}};
    while(head<tail)neighbours(queue[head++],w,pixels.length,visit,diagonal);
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
  function down(pixels,w,start,allowed){
    const seen=new Uint8Array(pixels.length),queue=new Uint32Array(pixels.length),all=new Uint32Array(pixels.length);let size=0,regions=0;
    for(let seed=start;seed<pixels.length;seed+=w){
      const colour=pixels[seed];if(seen[seed]||!allowed.includes(colour))continue;
      let head=0,tail=1;queue[0]=seed;seen[seed]=1;regions++;
      const visit=q=>{if(!seen[q]&&pixels[q]===colour){seen[q]=1;queue[tail++]=q;}};
      while(head<tail){const q=queue[head++];all[size++]=q;neighbours(q,w,pixels.length,visit);}
    }
    return {indices:all.slice(0,size),regions};
  }
  const api={fill,count,down};if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikFill=api;
})(typeof window==='object'?window:globalThis);
