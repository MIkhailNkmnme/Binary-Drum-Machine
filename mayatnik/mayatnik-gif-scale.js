/* Fixed-frame resolution animation. Sampling and GIF encoding run off the UI thread. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikGifScale=api;})(globalThis,function(){
  'use strict';
  function plan(width,height,sequence='step8'){
    if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1)throw Error('Неверный размер кадра');
    if(!['step8','powers2'].includes(sequence))throw Error('Неизвестная последовательность');
    const rows=Math.max(8,Math.ceil(height/8)*8),levels=[];
    for(let n=8;n<=rows;n=sequence==='powers2'?n*2:n+8)levels.push(n);
    if(width>65535||rows>65535)throw Error('Размер превышает предел GIF (65535)');
    return {width,height:rows,sourceHeight:height,padded:rows-height,sequence,levels};
  }
  function validate(source,options={}){
    const p=plan(source.width,source.height,options.sequence);
    if(!source.pixels||source.pixels.length!==source.width*source.height*4)throw Error('Пиксели кадра повреждены');
    if(!['nearest','majority','average'].includes(options.method||'nearest'))throw Error('Неизвестный способ уменьшения');
    if(p.width*p.height>16777216)throw Error('Кадр больше 16 миллионов пикселей. Уменьшите число строк для экспорта');
    if(p.width*p.height*p.levels.length>600000000)throw Error('Для такого кадра выберите степени 2 или уменьшите число строк');
    return p;
  }
  function prepare(source,p,background=[0,0,0]){
    const rgba=new Uint8ClampedArray(p.width*p.height*4);
    for(let i=0;i<rgba.length;i+=4){const a=i<source.pixels.length?source.pixels[i+3]/255:0;for(let c=0;c<3;c++)rgba[i+c]=Math.round((a?source.pixels[i+c]*a:0)+(background[c]||0)*(1-a));rgba[i+3]=255;}
    return rgba;
  }
  // Exact area weights prevent dropped edge pixels when a level does not divide H.
  function reduce(pixels,width,height,rows,method='nearest'){
    const w=Math.max(1,Math.round(width*rows/height)),h=rows,out=new Uint8ClampedArray(w*h*4);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const left=x*width/w,right=(x+1)*width/w,top=y*height/h,bottom=(y+1)*height/h;
      const center=(Math.min(height-1,Math.floor((top+bottom)/2))*width+Math.min(width-1,Math.floor((left+right)/2)))*4,q=(y*w+x)*4;
      if(method==='nearest'){out.set(pixels.subarray(center,center+4),q);continue;}
      let total=0,r=0,g=0,b=0;const colours=method==='majority'?new Map():null;
      for(let sy=Math.floor(top);sy<Math.ceil(bottom);sy++)for(let sx=Math.floor(left);sx<Math.ceil(right);sx++){
        const weight=(Math.min(right,sx+1)-Math.max(left,sx))*(Math.min(bottom,sy+1)-Math.max(top,sy));
        if(weight<=0)continue;const i=(sy*width+sx)*4;
        if(colours){const key=pixels[i]*65536+pixels[i+1]*256+pixels[i+2];colours.set(key,(colours.get(key)||0)+weight);}
        else{r+=pixels[i]*weight;g+=pixels[i+1]*weight;b+=pixels[i+2]*weight;total+=weight;}
      }
      if(colours){let chosen=pixels[center]*65536+pixels[center+1]*256+pixels[center+2],best=colours.get(chosen)||0;for(const [key,count]of colours)if(count>best+1e-10){chosen=key;best=count;}out[q]=chosen>>>16;out[q+1]=(chosen>>>8)&255;out[q+2]=chosen&255;}
      else{out[q]=Math.round(r/total);out[q+1]=Math.round(g/total);out[q+2]=Math.round(b/total);}out[q+3]=255;
    }
    return {pixels:out,width:w,height:h};
  }
  function enlarge(small,width,height){
    const out=new Uint8ClampedArray(width*height*4),words=new Uint32Array(out.buffer),input=new Uint32Array(small.pixels.buffer,small.pixels.byteOffset,small.width*small.height),columns=Int32Array.from({length:width},(_,x)=>Math.min(small.width-1,Math.floor((x+.5)*small.width/width)));
    let previous=-1;
    for(let y=0;y<height;y++){const sy=Math.min(small.height-1,Math.floor((y+.5)*small.height/height)),row=y*width;
      if(sy===previous){words.copyWithin(row,row-width,row);continue;}
      for(let x=0;x<width;x++)words[row+x]=input[sy*small.width+columns[x]];previous=sy;
    }return out;
  }

  function generate(source,options={}){
    const p=validate(source,options),method=options.method||'nearest',delay=Math.max(2,Math.min(500,Math.round((Number(options.delay)||200)/10)));
    if(!globalThis.MayatnikGif?.encoder)throw Error('Кодировщик GIF не загружен');
    const code=`const prepare=${prepare.toString()},reduce=${reduce.toString()},enlarge=${enlarge.toString()},encoder=${globalThis.MayatnikGif.encoder.toString()};onmessage=e=>{try{const {source,plan:p,method,delay,background}=e.data,pixels=prepare(source,p,background),gif=encoder(p.width,p.height);for(let n=0;n<p.levels.length;n++){const rows=p.levels[n],small=reduce(pixels,p.width,p.height,rows,method);gif.add(enlarge(small,p.width,p.height),delay);postMessage({done:n+1,total:p.levels.length,rows});}postMessage({blob:gif.finish()});}catch(error){postMessage({error:error.message||String(error)});}};`;
    const url=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));let worker;try{worker=new Worker(url);}finally{URL.revokeObjectURL(url);}
    let settled=false,resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});
    const finish=(error,blob)=>{if(settled)return;settled=true;worker.terminate();error?reject(error):resolve({blob,plan:p,method,delay:delay*10});};
    worker.onmessage=e=>{if(e.data.error)finish(Error(e.data.error));else if(e.data.blob)finish(null,e.data.blob);else options.onProgress?.(e.data);};worker.onerror=e=>finish(Error(e.message||'Ошибка генератора'));
    // Own copy: transfer cannot detach the live field or the caller's snapshot.
    const pixels=new Uint8ClampedArray(source.pixels);try{worker.postMessage({source:{width:source.width,height:source.height,pixels},plan:p,method,delay,background:options.background||[0,0,0]},[pixels.buffer]);}catch(e){finish(e);}
    return {promise,plan:p,cancel(){finish(Object.assign(Error('Генерация отменена'),{name:'AbortError'}));}};
  }
  return {plan,validate,prepare,reduce,enlarge,generate};
});
