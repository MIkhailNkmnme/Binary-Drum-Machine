(function(root){
  'use strict';
  const DEFAULT=4096,MAX=1048576;
  function normalize(value){if(value===0||typeof value==='string'&&value.trim()==='0')return 0;const n=Number(value);return Number.isFinite(n)&&n>0?Math.max(1,Math.min(MAX,Math.floor(n))):DEFAULT;}
  function area(width,height){return Math.max(1,Math.ceil(width-1e-9))*Math.max(1,Math.ceil(height-1e-9));}
  function error(limit){const n=normalize(limit),e=new Error(n===0?'Ограничение площади шаблона отключено.':`Шаблон не выделен: площадь больше ${n.toLocaleString('ru-RU')} бит. Лимит — кнопкой «Лимит» в разделе «Шаблоны» библиотеки.`);e.name='TemplateAreaLimitError';return e;}
  function allowed(width,height,limit){const n=normalize(limit);return n===0||area(width,height)<=n;}
  // No field-sized masks or queues. Bounding area is monotone, including holes.
  function flood({seed,key=q=>q,match,neighbours,point,limit}){
    const seen=new Set(),queue=[seed],indices=[];let head=0,x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
    seen.add(key(seed));
    while(head<queue.length){const q=queue[head++];if(!match(q))continue;const [x,y]=point(q);
      x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);
      if(!allowed(x1-x0+1,y1-y0+1,limit))throw error(limit);
      indices.push(q);neighbours(q,next=>{const k=key(next);if(!seen.has(k)){seen.add(k);queue.push(next);}});
    }
    return indices;
  }
  function capture(pixels,w,h,colour,left,right,rk,limit){
    let x0=right,x1=-1,y0=h,y1=-1,count=0;
    for(let y=0;y<h;y++)for(let x=left;x<right;x++)if(pixels[y*w+x]===colour){
      x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);count++;
      if(!allowed((x1-x0+1)/rk,(y1-y0+1)/rk,limit))throw error(limit);
    }
    if(!count)return null;const width=x1-x0+1,height=y1-y0+1,data=new Uint32Array(width*height);
    for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(pixels[(y+y0)*w+x+x0]===colour)data[y*width+x]=colour;
    return {x:x0,y:y0,width,height,data,count};
  }
  const api={DEFAULT,MAX,normalize,area,allowed,error,flood,capture};if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikTemplateLimit=api;
})(typeof window==='object'?window:globalThis);
