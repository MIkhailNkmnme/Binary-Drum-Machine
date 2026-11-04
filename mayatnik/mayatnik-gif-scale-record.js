/* Record actual presented frames at one locked GIF detail level. No capture timer. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(root,require('./mayatnik-gif-scale.js'),require('./mayatnik-gif.js'));
  else root.MayatnikGifScaleRecord=factory(root,root.MayatnikGifScale,root.MayatnikGif);
})(globalThis,function(root,Scale,Gif){
  'use strict';
  const METHODS=['canvas','nearest','majority','average'],MAX_AREA=16777216;
  function fault(message,code){return Object.assign(Error(message),{code});}
  function limit(value,maximum){return Number.isSafeInteger(value)&&value>0?Math.min(value,maximum):maximum;}
  // This function and the existing sampling functions are serialized into the worker.
  // Every source keeps its full extent. Changes in aspect ratio get background bars.
  function renderFrame(source,settings){
    const p={width:source.width,height:Math.max(8,Math.ceil(source.height/8)*8)},pixels=prepare(source,p,settings.background);
    let bits=null;if(source.bits){bits=new Int8Array(p.width*p.height).fill(-1);bits.set(source.bits);}
    const small=reduce(pixels,p.width,p.height,settings.rows,settings.method,bits);
    const ratio=Math.min(settings.width/p.width,settings.height/p.height),width=Math.max(1,Math.min(settings.width,Math.round(p.width*ratio))),height=Math.max(1,Math.min(settings.height,Math.round(p.height*ratio)));
    const bounds={left:Math.floor((settings.width-width)/2),top:Math.floor((settings.height-height)/2),width,height};
    const enlarged=enlarge(small,width,height),raster=width===settings.width&&height===settings.height?enlarged:center({pixels:enlarged,width,height},settings.width,settings.height,settings.background);
    return {raster,semantic:small.bits?{width:small.width,height:settings.rows,bits:small.bits,bounds}:null};
  }
  function workerMain(){
    let settings,gif,bytes=0,count=0;
    onmessage=e=>{try{
      const m=e.data;
      if(m.type==='start'){settings=m.settings;gif=encoder(settings.width,settings.height);postMessage({ready:true});}
      else if(m.type==='frame'){
        if(count>=settings.maxFrames)throw Object.assign(Error('Запись GIF превышает предел кадров'),{code:'GIF_RECORD_LIMIT'});
        const rendered=renderFrame(m.source,settings);gif.add(rendered.raster,settings.ticks);const blob=gif.frame();
        bytes+=blob.size*2+(rendered.semantic?.bits.byteLength||0)+64;
        if(bytes>settings.maxBytes)throw Object.assign(Error('Запись GIF превышает предел памяти'),{code:'GIF_RECORD_LIMIT'});
        count++;const frame={blob,rows:settings.rows,sourceFrame:m.frame,semantic:rendered.semantic};
        postMessage({frame,count,bytes},rendered.semantic?[rendered.semantic.bits.buffer]:[]);
      }else if(m.type==='stop')postMessage({blob:gif.finish(),count});
    }catch(error){postMessage({error:error.message||String(error),code:error.code||'GIF_RECORD_ERROR'});}};
  }
  function start(options={}){
    const {width,height,rows}=options,method=options.method||'canvas';
    if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1||width>65535||height>65535||width*height>MAX_AREA)throw fault('Неверный размер записи GIF','GIF_RECORD_SIZE');
    if(!Number.isSafeInteger(rows)||rows<1||rows>height)throw fault('Неверное число строк записи GIF','GIF_RECORD_SIZE');
    if(!METHODS.includes(method))throw fault('Неизвестный способ уменьшения GIF','GIF_RECORD_METHOD');
    if(!Scale?.reduceCanvas||!Gif?.encoder)throw Error('Модули записи GIF не загружены');
    const ticks=Math.max(2,Math.min(500,Math.round((Number(options.delay)||200)/10))),background=Array.from(options.background||[0,0,0],n=>Math.max(0,Math.min(255,Math.round(Number(n)||0)))).slice(0,3);
    while(background.length<3)background.push(0);
    const settings={width,height,rows,method,ticks,background,maxFrames:limit(options.maxFrames,4096),maxBytes:limit(options.maxBytes,128*1024*1024)};
    const maxQueue=limit(options.maxQueue,8),maxPendingBytes=limit(options.maxPendingBytes,64*1024*1024);
    const plan={width,height,sourceHeight:height,padded:0,sequence:'record',levels:[rows]};
    const code=[Scale.prepare,Scale.reduceCanvas,Scale.reduce,Scale.enlarge,Scale.center,Gif.encoder,renderFrame].map(fn=>fn.toString()).join('\n')+'\n('+workerMain.toString()+')();';
    const url=root.URL.createObjectURL(new Blob([code],{type:'text/javascript'}));let worker;
    try{worker=new root.Worker(url);}finally{root.URL.revokeObjectURL(url);}
    let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;}),queue=[],frames=[];
    let closed=false,stopping=false,ready=false,flight=null,sentStop=false,pendingBytes=0,accepted=0,lastKey,hasKey=false;
    function finish(error,result){
      if(closed)return;closed=true;worker.terminate();queue.length=0;flight=null;pendingBytes=0;
      if(error){frames.length=0;reject(error);}else resolve(result);
    }
    function pump(){
      if(closed||!ready||flight||sentStop)return;
      try{
        if(queue.length){flight=queue.shift();const {source,frame}=flight;worker.postMessage({type:'frame',source,frame},source.bits?[source.pixels.buffer,source.bits.buffer]:[source.pixels.buffer]);}
        else if(stopping){if(!frames.length){finish(fault('В записи GIF нет кадров','GIF_RECORD_EMPTY'));return;}sentStop=true;worker.postMessage({type:'stop'});}
      }catch(error){finish(error);}
    }
    worker.onmessage=e=>{
      if(closed)return;const message=e.data;
      try{
        if(message.error){finish(fault(message.error,message.code));return;}
        if(message.ready)ready=true;
        if(message.frame){pendingBytes-=flight.bytes;flight=null;frames.push(message.frame);options.onProgress?.({frames:frames.length,pending:queue.length,bytes:message.bytes});}
        if(message.blob){Scale.rememberDelay(message.blob,ticks*10);finish(null,{id:method+'-pixels-recorded',method,presentation:'pixels',recording:true,rows,delay:ticks*10,plan,blob:message.blob,frames});return;}
        pump();
      }catch(error){finish(error);}
    };
    worker.onerror=e=>finish(fault(e.message||'Ошибка записи GIF','GIF_RECORD_WORKER'));
    worker.onmessageerror=()=>finish(fault('Ошибка передачи кадра GIF','GIF_RECORD_WORKER'));
    try{worker.postMessage({type:'start',settings});}catch(error){finish(error);}
    function sourceBytes(source){
      const w=source?.width,h=source?.height,padded=Math.max(8,Math.ceil(h/8)*8);
      if(!Number.isSafeInteger(w)||!Number.isSafeInteger(h)||w<1||h<1||w>65535||padded>65535||w*padded>MAX_AREA)throw fault('Кадр записи GIF больше допустимого размера','GIF_RECORD_SIZE');
      if(source.pixels?.length!==w*h*4||Object.prototype.toString.call(source.pixels)!=='[object Uint8ClampedArray]')throw fault('Повреждены пиксели записи GIF','GIF_RECORD_SOURCE');
      if(source.bits!=null&&(Object.prototype.toString.call(source.bits)!=='[object Int8Array]'||source.bits.length!==w*h))throw fault('Повреждена карта битов записи GIF','GIF_RECORD_SOURCE');
      const reducedWidth=Math.max(1,method==='canvas'?Math.ceil(w*rows/padded-1e-12):Math.round(w*rows/padded));
      if(reducedWidth*rows>MAX_AREA)throw fault('Выбранному уровню GIF не хватит памяти','GIF_RECORD_SIZE');
      return source.pixels.byteLength+(source.bits?.byteLength||0);
    }
    const api={promise,plan,rows,method,delay:ticks*10,
      get pending(){return queue.length+(flight?1:0);},
      get pendingBytes(){return pendingBytes;},
      get canPush(){return !closed&&!stopping&&api.pending<maxQueue&&pendingBytes<maxPendingBytes&&accepted<settings.maxFrames;},
      capacity(source){return api.canPush&&pendingBytes+sourceBytes(source)<=maxPendingBytes;},
      push(source,{key,frame}={}){
        if(closed||stopping)throw fault('Запись GIF уже остановлена','GIF_RECORD_CLOSED');
        if(key!==undefined&&hasKey&&Object.is(lastKey,key))return false;
        try{
          const bytes=sourceBytes(source);
          if(accepted>=settings.maxFrames)throw fault('Запись GIF превышает предел кадров','GIF_RECORD_LIMIT');
          if(api.pending>=maxQueue||pendingBytes+bytes>maxPendingBytes)throw fault('Запись GIF не успевает за плеером. Уменьшите скорость или размер кадра','GIF_RECORD_BACKPRESSURE');
          const snapshot={width:source.width,height:source.height,pixels:new Uint8ClampedArray(source.pixels),bits:source.bits?new Int8Array(source.bits):null};
          queue.push({source:snapshot,frame,bytes});pendingBytes+=bytes;accepted++;hasKey=key!==undefined;lastKey=key;pump();return true;
        }catch(error){finish(error);throw error;}
      },
      stop(){if(!closed){stopping=true;pump();}return promise;},
      cancel(){finish(Object.assign(Error('Запись GIF отменена'),{name:'AbortError',code:'GIF_RECORD_CANCELLED'}));}
    };
    return api;
  }
  return {start};
});
