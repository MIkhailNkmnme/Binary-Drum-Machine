/* Fixed-frame resolution animation. Sampling and GIF encoding run off the UI thread. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikGifScale=api;})(globalThis,function(){
  'use strict';
  const nominalDelay=new WeakMap();
  function delayTicks(ms){return Math.max(2,Math.min(500,Math.round((Number(ms)||200)/10)));}
  function plan(width,height,sequence='step8'){
    if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1)throw Error('Неверный размер кадра');
    if(!['step8','powers2'].includes(sequence))throw Error('Неизвестная последовательность');
    const rows=Math.max(8,Math.ceil(height/8)*8),levels=[];
    if(width>65535||rows>65535)throw Error('Размер превышает предел GIF (65535)');
    for(let n=8;n<=rows;n=sequence==='powers2'?n*2:n+8)levels.push(n);
    if(levels.at(-1)!==rows)levels.push(rows);
    levels.reverse(); // Always begin with the complete 1:1 source, then reduce to 8 rows.
    return {width,height:rows,sourceHeight:height,padded:rows-height,sequence,levels};
  }
  function validate(source,options={}){
    let p;
    if(options.levels){
      const levels=options.levels;if(!Array.isArray(levels)||!levels.length||levels[0]!==source.height||levels.some((n,i)=>!Number.isSafeInteger(n)||n<8||n>source.height||i>0&&n>=levels[i-1]))throw Error('Некорректные высоты построений: минимум8строк');
      p={width:source.width,height:source.height,sourceHeight:source.height,padded:0,sequence:'custom',levels:levels.slice()};
      if(!Number.isSafeInteger(p.width)||p.width<1||p.width>65535||p.height>65535)throw Error('Неверный размер кадра');
    }else p=plan(source.width,source.height,options.sequence);
    if(!source.pixels||source.pixels.length!==source.width*source.height*4)throw Error('Пиксели кадра повреждены');
    if(!['canvas','nearest','majority','average'].includes(options.method||'canvas'))throw Error('Неизвестный способ уменьшения');
    if(!['scale','pixels'].includes(options.presentation===undefined?'pixels':options.presentation))throw Error('Неизвестный вид GIF');
    if(p.width*p.height>16777216)throw Error('Кадр больше 16 миллионов пикселей. Уменьшите число строк для экспорта');
    if(p.width*p.height*p.levels.length>600000000)throw Error('Для такого кадра выберите степени 2 или уменьшите число строк');
    if(source.bits!=null){
      if(Object.prototype.toString.call(source.bits)!=='[object Int8Array]'||source.bits.length!==p.width*source.height)throw Error('Повреждена карта битов кадра');
      for(let i=0;i<source.bits.length;i++)if(source.bits[i]<-2||source.bits[i]>1)throw Error('Неизвестное значение бита кадра');
    }
    return p;
  }
  function validateAll(source,options={}){
    const p=validate(source,options),area=p.width*p.height;
    if(area*p.levels.length*4>600000000)throw Error('Для четырёх видов GIF выберите степени 2 или уменьшите число строк');
    // One reduced bit grid per method and level; one encoder stays active.
    // Keep a conservative reserve for the source, output, palette/LZW scratch.
    const grids=source.bits?p.levels.reduce((bytes,h)=>bytes+h*(Math.ceil(p.width*h/p.height)+3*Math.max(1,Math.round(p.width*h/p.height))),0):0;
    if(grids+area*32>384*1024*1024)throw Error('Четырём видам GIF не хватит памяти. Выберите степени 2 или уменьшите число строк');
    return p;
  }
  function prepare(source,p,background=[0,0,0]){
    const rgba=new Uint8ClampedArray(p.width*p.height*4);
    for(let i=0;i<rgba.length;i+=4){const a=i<source.pixels.length?source.pixels[i+3]/255:0;for(let c=0;c<3;c++)rgba[i+c]=Math.round((a?source.pixels[i+c]*a:0)+(background[c]||0)*(1-a));rgba[i+3]=255;}
    return rgba;
  }
  // Same physical-pixel centres and a single isotropic scale as sampleViewport.
  // The last partial column is background if its centre lies outside the field.
  function reduceCanvas(pixels,width,height,rows,bits){
    const scale=rows/height,w=Math.max(1,Math.ceil(width*scale-1e-12)),out=new Uint8ClampedArray(w*rows*4);
    const grid=bits?new Int8Array(w*rows):null;
    for(let y=0;y<rows;y++)for(let x=0;x<w;x++){
      const sx=Math.floor((x+.5)/scale),sy=Math.floor((y+.5)/scale),q=(y*w+x)*4;
      if(sx>=0&&sx<width&&sy>=0&&sy<height){const at=(sy*width+sx)*4;out.set(pixels.subarray(at,at+4),q);}else out[q+3]=255;
      if(grid)grid[y*w+x]=sx<width&&sy<height?bits[sy*width+sx]:-1;
    }
    return {pixels:out,width:w,height:rows,bits:grid};
  }
  // Exact area weights prevent dropped edge pixels when a level does not divide H.
  function reduce(pixels,width,height,rows,method='canvas',bits=null){
    if(method==='canvas')return reduceCanvas(pixels,width,height,rows,bits);
    const w=Math.max(1,Math.round(width*rows/height)),h=rows,out=new Uint8ClampedArray(w*h*4);
    const grid=bits?new Int8Array(w*h):null;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const left=x*width/w,right=(x+1)*width/w,top=y*height/h,bottom=(y+1)*height/h;
      const center=(Math.min(height-1,Math.floor((top+bottom)/2))*width+Math.min(width-1,Math.floor((left+right)/2)))*4,q=(y*w+x)*4;
      if(method==='nearest'){out.set(pixels.subarray(center,center+4),q);if(grid)grid[q/4]=bits[center/4];continue;}
      let total=0,r=0,g=0,b=0,common;const colours=method==='majority'?new Map():null,provenance=colours&&grid?new Map():null;
      for(let sy=Math.floor(top);sy<Math.ceil(bottom);sy++)for(let sx=Math.floor(left);sx<Math.ceil(right);sx++){
        const weight=(Math.min(right,sx+1)-Math.max(left,sx))*(Math.min(bottom,sy+1)-Math.max(top,sy));
        if(weight<=0)continue;const i=(sy*width+sx)*4;
        if(colours){
          const key=pixels[i]*65536+pixels[i+1]*256+pixels[i+2];colours.set(key,(colours.get(key)||0)+weight);
          if(provenance){const old=provenance.get(key),bit=bits[i/4];provenance.set(key,old===undefined||old===bit?bit:-2);}
        }else{
          r+=pixels[i]*weight;g+=pixels[i+1]*weight;b+=pixels[i+2]*weight;total+=weight;
          if(grid){const bit=bits[i/4];common=common===undefined||common===bit?bit:-2;}
        }
      }
      if(colours){let chosen=pixels[center]*65536+pixels[center+1]*256+pixels[center+2],best=colours.get(chosen)||0;for(const [key,count]of colours)if(count>best+1e-10){chosen=key;best=count;}out[q]=chosen>>>16;out[q+1]=(chosen>>>8)&255;out[q+2]=chosen&255;if(grid)grid[q/4]=provenance.get(chosen);}
      else{out[q]=Math.round(r/total);out[q+1]=Math.round(g/total);out[q+2]=Math.round(b/total);if(grid)grid[q/4]=common;}out[q+3]=255;
    }
    return {pixels:out,width:w,height:h,bits:grid};
  }
  function enlarge(small,width,height){
    const out=new Uint8ClampedArray(width*height*4),words=new Uint32Array(out.buffer),input=new Uint32Array(small.pixels.buffer,small.pixels.byteOffset,small.width*small.height),columns=Int32Array.from({length:width},(_,x)=>Math.min(small.width-1,Math.floor((x+.5)*small.width/width)));
    let previous=-1;
    for(let y=0;y<height;y++){const sy=Math.min(small.height-1,Math.floor((y+.5)*small.height/height)),row=y*width;
      if(sy===previous){words.copyWithin(row,row-width,row);continue;}
      for(let x=0;x<width;x++)words[row+x]=input[sy*small.width+columns[x]];previous=sy;
    }return out;
  }
  // Preserve the reduced raster at one GIF pixel per raster pixel. All frames
  // share one canvas; the unused area is background, never enlarged pixels.
  function center(small,width,height,background=[0,0,0]){
    if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1||width*height>16777216||
      !Number.isSafeInteger(small?.width)||!Number.isSafeInteger(small?.height)||small.width<1||small.height<1||small.width>width||small.height>height||small.pixels?.length!==small.width*small.height*4)throw Error('Неверный размер уменьшенного кадра GIF');
    const out=new Uint8ClampedArray(width*height*4),left=Math.floor((width-small.width)/2),top=Math.floor((height-small.height)/2);
    for(let i=0;i<out.length;i+=4){out[i]=background[0]||0;out[i+1]=background[1]||0;out[i+2]=background[2]||0;out[i+3]=255;}
    for(let y=0;y<small.height;y++)out.set(small.pixels.subarray(y*small.width*4,(y+1)*small.width*4),((top+y)*width+left)*4);
    return out;
  }

  // Serialized into the Blob worker along with the sampling functions and encoder.
  function renderJob({source,plan:p,methods,presentations,delay,background,all}){
    const pixels=prepare(source,p,background);
    let bits=null;
    if(source.bits){
      bits=new Int8Array(p.width*p.height).fill(-1);bits.set(source.bits);
    }
    const total=p.levels.length*methods.length*presentations.length;
    let done=0,encodedBytes=0;
    for(const method of methods){
      const methodStart=done,methodBytes=encodedBytes;let currentRows=p.height;
      try{
      const encoders=presentations.map(()=>encoder(p.width,p.height));
      for(const rows of p.levels){
        currentRows=rows;
        // Full-size reduction is an identity for all four methods.
        const small=rows===p.height?{pixels,width:p.width,height:rows,bits}:reduce(pixels,p.width,p.height,rows,method,bits);
        const frames=presentations.map((presentation,index)=>{
          const centered=presentation==='scale',bounds=centered?{left:Math.floor((p.width-small.width)/2),top:Math.floor((p.height-rows)/2),width:small.width,height:rows}:{left:0,top:0,width:p.width,height:p.height};
          const raster=rows===p.height?pixels:centered?center(small,p.width,p.height,background):enlarge(small,p.width,p.height);
          const gif=encoders[index];gif.add(raster,delay);const blob=gif.frame();
          // Static frame plus animation (the same compressed image + controls).
          // Actual compressed size, never an average compression assumption.
          encodedBytes+=2*blob.size+16;
          if(all&&encodedBytes>256*1024*1024)throw Error('Четыре GIF превышают 256 МиБ. Выберите степени 2 или уменьшите число строк');
          return {presentation,blob,bounds};
        });
        // Transfer each reduced grid once. Keep the 1:1 source for later methods.
        const grid=small.bits===bits&&bits?bits.slice():small.bits;
        done+=frames.length;
        postMessage({method,rows,width:small.width,frames,bits:grid,done,total},grid?[grid.buffer]:[]);
      }
      for(let i=0;i<presentations.length;i++)postMessage({method,presentation:presentations[i],blob:encoders[i].finish()});
      }catch(error){
        if(error.code!=='GIF_PALETTE_OVERFLOW')throw error;
        const warning={method,rows:currentRows,code:error.code,colourCount:error.colourCount,message:error.message};
        if(!all)throw Object.assign(error,{method,rows:currentRows});
        // Earlier levels of this method are incomplete as an animation. Drop
        // their accounting and tell the host to release their already sent blobs.
        encodedBytes=methodBytes;done=methodStart+p.levels.length*presentations.length;
        postMessage({variantError:warning,done,total});
      }
    }
    postMessage({complete:true});
  }
  function start(source,options,all){
    const p=all?validateAll(source,options):validate(source,options);
    const methods=all?['canvas','nearest','average']:[options.method||'canvas'];
    const presentations=all?['pixels']:[options.presentation===undefined?'pixels':options.presentation];
    const delay=delayTicks(options.delay);
    if(!globalThis.MayatnikGif?.encoder)throw Error('Кодировщик GIF не загружен');
    const code=[prepare,reduceCanvas,reduce,enlarge,center,globalThis.MayatnikGif.encoder,renderJob].map(fn=>fn.toString()).join('\n')+
      '\nonmessage=e=>{try{renderJob(e.data);}catch(error){postMessage({error:error.message||String(error),code:error.code,colourCount:error.colourCount,method:error.method,rows:error.rows});}};';
    const url=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));let worker;try{worker=new Worker(url);}finally{URL.revokeObjectURL(url);}
    const variants=new Map(),warnings=[];
    for(const method of methods)for(const presentation of presentations){
      const id=method+'-'+presentation;variants.set(id,{id,method,presentation,blob:null,frames:[],plan:p,delay:delay*10});
    }
    let settled=false,resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});
    function finish(error){
      if(settled)return;settled=true;worker.terminate();
      if(error){variants.clear();reject(error);return;}
      const results=[...variants.values()];variants.clear();
      if(!results.length){reject(Object.assign(Error('Все способы GIF недоступны: '+warnings[0].message),{code:'GIF_PALETTE_OVERFLOW',colourCount:warnings[0].colourCount,warnings}));return;}
      resolve(all?{variants:results,plan:p,warnings}:results[0]);
    }
    worker.onmessage=e=>{
      if(settled)return;const message=e.data;
      try{
        if(message.error){finish(Object.assign(Error(message.error),{code:message.code,colourCount:message.colourCount,method:message.method,rows:message.rows}));return;}
        if(message.variantError){
          const warning=message.variantError;warnings.push(warning);
          for(const presentation of presentations)variants.delete(warning.method+'-'+presentation);
          options.onProgress?.({done:message.done,total:message.total,method:warning.method,rows:warning.rows,presentation:presentations[0],error:warning});
          return;
        }
        if(message.complete){finish();return;}
        const {method,rows,bits,width}=message;
        if(message.blob){variants.get(method+'-'+message.presentation).blob=message.blob;nominalDelay.set(message.blob,delay);return;}
        for(let i=0;i<message.frames.length&&!settled;i++){
          const {presentation,blob,bounds}=message.frames[i];
          variants.get(method+'-'+presentation).frames.push({blob,rows,semantic:bits?{width,height:rows,bits,bounds}:null});
          options.onProgress?.({done:message.done-message.frames.length+i+1,total:message.total,rows,method,presentation});
        }
      }catch(error){finish(error);}
    };
    worker.onerror=e=>finish(Error(e.message||'Ошибка генератора'));
    worker.onmessageerror=()=>finish(Error('Ошибка передачи кадра GIF'));
    try{
      const pixels=new Uint8ClampedArray(source.pixels),bits=source.bits?new Int8Array(source.bits):null;
      worker.postMessage({source:{width:source.width,height:source.height,pixels,bits},plan:p,methods,presentations,delay,background:Array.from(options.background||[0,0,0]),all},bits?[pixels.buffer,bits.buffer]:[pixels.buffer]);
    }catch(error){finish(error);}
    const job={promise,plan:p,cancel(){finish(Object.assign(Error('Генерация отменена'),{name:'AbortError'}));}};
    if(!all)job.presentation=presentations[0];return job;
  }
  function generate(source,options={}){return start(source,options,false);}
  function generateAll(source,options={}){return start(source,options,true);}
  function rememberDelay(blob,delayMs){nominalDelay.set(blob,delayTicks(delayMs));return blob;}
  // Walk GIF records: the byte sequence of a graphics control extension can
  // also occur in an LZW payload, palette or comment. Never search for markers.
  async function retime(blob,delayMs){
    const bytes=new Uint8Array(await blob.arrayBuffer()),tick=delayTicks(delayMs),base=nominalDelay.get(blob);
    let pos=0,control=-1,images=0,start=0;const parts=[];
    function invalid(){throw Error('Повреждена структура GIF');}
    function take(length){const at=pos;pos+=length;if(pos>bytes.length)invalid();return at;}
    function byte(){return bytes[take(1)];}
    function word(at){return bytes[at]|(bytes[at+1]<<8);}
    function blocks(){let n;while((n=byte()))take(n);}
    function table(flags){if(flags&128)take(3*(2<<(flags&7)));}
    take(13);
    if(!['GIF87a','GIF89a'].includes(String.fromCharCode(...bytes.subarray(0,6)))||!word(6)||!word(8))invalid();
    // A GIF87a without controls gains a GIF89a extension when timed.
    if(bytes[4]===55){parts.push('GIF89a');start=6;}
    table(bytes[10]);
    for(;;){
      const mark=pos,kind=byte();
      if(kind===59){if(!images||control!==-1||pos!==bytes.length)invalid();break;}
      if(kind===33){
        const label=byte();
        if(label===249){
          if(control!==-1||byte()!==4)invalid();take(4);if(byte()!==0)invalid();control=mark;
        }else{blocks();if(label===1)control=-1;} // Plain Text consumes the preceding control.
        continue;
      }
      if(kind!==44)invalid();
      take(9);if(!word(mark+5)||!word(mark+7))invalid();table(bytes[mark+9]);
      const lzw=byte();if(lzw<2||lzw>8||!bytes[pos])invalid();blocks();images++;
      const header=control<0?Uint8Array.of(33,249,4,0,0,0,0,0):bytes.slice(control,control+8);
      const repeats=base&&control>=0?Math.max(1,Math.round(word(control+4)/base)):1;
      const maxRepeat=Math.floor(65535/tick);
      function gce(count){const h=header.slice();h[4]=(count*tick)&255;h[5]=(count*tick)>>8;return h;}
      const first=Math.min(repeats,maxRepeat);
      if(control<0){parts.push(blob.slice(start,mark),gce(first));start=mark;}
      else{parts.push(blob.slice(start,control),gce(first));start=control+8;}
      if(first<repeats){
        parts.push(blob.slice(start,pos));start=pos;
        for(let left=repeats-first;left>0;left-=maxRepeat)parts.push(gce(Math.min(left,maxRepeat)),blob.slice(mark,pos));
      }
      control=-1;
    }
    const output=new Blob([...parts,blob.slice(start)],{type:'image/gif'});nominalDelay.set(output,tick);return output;
  }
  return {plan,validate,validateAll,prepare,reduceCanvas,reduce,enlarge,center,generate,generateAll,rememberDelay,retime};
});
