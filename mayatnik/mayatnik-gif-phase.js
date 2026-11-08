/* Residue phases for the GIF Scale window. Every frame is the complete field:
   the cells of one phase keep their source colour and position, all other cells
   are background. So the frames XOR back into the original picture, and any
   single phase can be saved or applied to the field. Encoding runs in a Worker. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikGifPhase=api;})(globalThis,function(){
 'use strict';
 const MAX_FRAME_CELLS=64*1024*1024;   // frames × cells of one page
 const MAX_SEMANTIC_CELLS=48*1024*1024; // exact bit maps while they fit in memory
 const MAX_XOR_CELLS=2100000;
 function renderPhaseJob({width,height,factor,items,delay,background,semantic,sourcePixels,sourceBits}){
  const gif=encoder(width,height),area=width*height,pixels=new Uint8ClampedArray(area*4),bits=semantic?new Int8Array(area):null;
  const bg=[Number(background?.[0])||0,Number(background?.[1])||0,Number(background?.[2])||0],total=items.length;
  const gridWidth=Math.ceil(width/factor),gridHeight=Math.ceil(height/factor);
  for(let index=0;index<total;index++){
   const item=items[index]||{},dx=Math.max(0,Math.floor(Number(item.dx)||0)),dy=Math.max(0,Math.floor(Number(item.dy)||0));
   for(let i=0;i<pixels.length;i+=4){pixels[i]=bg[0];pixels[i+1]=bg[1];pixels[i+2]=bg[2];pixels[i+3]=255;}
   if(bits)bits.fill(-1);
   for(let row=0;row<gridHeight;row++){
    const sy=row*factor+dy;if(sy>=height)break;
    for(let col=0;col<gridWidth;col++){
     const sx=col*factor+dx;if(sx>=width)break;
     const at=sy*width+sx,source=at*4,alpha=(sourcePixels[source+3]||0)/255;
     pixels[source]=Math.round(sourcePixels[source]*alpha+bg[0]*(1-alpha));
     pixels[source+1]=Math.round(sourcePixels[source+1]*alpha+bg[1]*(1-alpha));
     pixels[source+2]=Math.round(sourcePixels[source+2]*alpha+bg[2]*(1-alpha));
     if(bits)bits[at]=sourceBits?sourceBits[at]:-1;
    }
   }
   gif.add(pixels,delay);
   let semanticFrame=null,transfer=[];
   if(bits){const copy=bits.slice();semanticFrame={width,height,bits:copy,bounds:{left:0,top:0,width,height}};transfer=[copy.buffer];}
   postMessage({index,rows:height,label:'dx='+dx+', dy='+dy,blob:gif.frame(),semantic:semanticFrame,done:index+1,total},transfer);
  }
  postMessage({complete:true,blob:gif.finish()});
 }
 // Phase frames are full-size, so every frame carries the field geometry and the
 // strip can show, save and apply any of them. The bit maps are transferred only
 // while the whole page still fits the memory reserve.
 function generatePhases(source,options={}){
  const width=source?.width,height=source?.height,items=options.items;
  if(!source||!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1)throw Error('Неверный размер кадра');
  if(!Array.isArray(items)||!items.length)throw Error('Нет фаз для переноса в Гиф-Масштаб');
  if(!source.pixels||source.pixels.length!==width*height*4)throw Error('Повреждены пиксели кадра');
  if(!globalThis.MayatnikGif?.encoder)throw Error('Кодировщик GIF не загружен');
  const factor=Math.max(2,Math.floor(Number(options.factor)||2)),area=width*height,total=items.length;
  if(total>10000)throw Error('Слишком много фаз для одного GIF');
  if(area*total>MAX_FRAME_CELLS)throw Error('Для всех фаз этого поля не хватит памяти: уменьшите поле или выберите меньший x');
  const semantic=area*total<=MAX_SEMANTIC_CELLS,ticks=Math.max(2,Math.min(500,Math.round((Number(options.delay)||200)/10)));
  const code='const encoder=('+globalThis.MayatnikGif.encoder.toString()+');\nconst renderPhaseJob=('+renderPhaseJob.toString()+');\n'+
   'onmessage=e=>{try{renderPhaseJob(e.data);}catch(error){postMessage({error:error.message||String(error)});}};';
  const url=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));let worker;try{worker=new Worker(url);}finally{URL.revokeObjectURL(url);}
  const frames=[];let settled=false,resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});
  function finish(error,variant){if(settled)return;settled=true;worker.terminate();if(error)reject(error);else resolve(variant);}
  worker.onmessage=e=>{if(settled)return;const message=e.data;try{
   if(message.error){finish(Error(message.error));return;}
   if(message.complete){
    if(frames.filter(Boolean).length!==total)throw Error('Не все кадры фаз получены');
    finish(null,{id:'phases-pixels',method:'phases',presentation:'pixels',name:options.name||'mayatnik-fazy.gif',semantic,frames:frames.slice(),blob:message.blob,delay:ticks*10,plan:{width,height,sourceHeight:height,padded:0,sequence:'custom',levels:frames.map(()=>height)}});
    return;
   }
   if(!Number.isInteger(message.index)||!message.blob)return;
   frames[message.index]={blob:message.blob,rows:message.rows,label:message.label,semantic:message.semantic||null};
   options.onProgress?.({done:message.done,total:message.total,index:message.index});
  }catch(error){finish(error);}};
  worker.onerror=e=>finish(Error(e.message||'Ошибка генератора фаз'));
  worker.onmessageerror=()=>finish(Error('Ошибка передачи кадра фаз'));
  try{
   const pixels=new Uint8ClampedArray(source.pixels),bits=source.bits?new Int8Array(source.bits):null;
   worker.postMessage({width,height,factor,items:items.map(item=>({dx:Number(item.dx)||0,dy:Number(item.dy)||0})),delay:ticks,background:Array.from(options.background||[0,0,0]),semantic,sourcePixels:pixels,sourceBits:bits},bits?[pixels.buffer,bits.buffer]:[pixels.buffer]);
  }catch(error){finish(error);}
  return {promise,cancel(){finish(Object.assign(Error('Генерация отменена'),{name:'AbortError'}));}};
 }
 // Exact XOR of phase frames from their bit maps: no decoded frame rasters kept,
 // so a whole page can be assembled even when the blob-based XOR would be too big.
 async function combine(win,variant,frames,delay=200,options={}){
  if(!Array.isArray(frames)||!frames.length)throw Error('Выберите кадры для XOR');
  const width=variant?.plan?.width,height=variant?.plan?.height;
  if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1||width*height>MAX_XOR_CELLS)throw Error('XOR фаз: не более 2 100 000 пикселей');
  const area=width*height,bits=new Int8Array(area).fill(-1),occupied=new Uint8Array(area),mixed=new Uint8Array(area),value=new Uint8Array(area),owners=new Map();
  for(const frame of frames){
   const grid=frame?.semantic;if(!grid?.bits||grid.width!==width||grid.height!==height)throw Error('У кадра нет точной карты битов');
   for(let i=0;i<area;i++){
    const bit=grid.bits[i];if(bit===-1)continue;occupied[i]=1;
    if(bit===-2){if(!mixed[i]){mixed[i]=1;let list=owners.get(frame);if(!list)owners.set(frame,list=[]);list.push(i);}}
    else value[i]^=bit;
   }
  }
  const one=options.one||[232,237,245],zero=options.zero||[91,100,117],background=options.background||[0,0,0];
  const pack=rgb=>(Number(rgb[0])||0)*65536+(Number(rgb[1])||0)*256+(Number(rgb[2])||0);
  const colours=new Uint32Array(area);
  for(let i=0;i<area;i++){
   if(!occupied[i]){bits[i]=-1;colours[i]=pack(background);continue;}
   if(mixed[i]){bits[i]=-2;colours[i]=0;continue;}
   bits[i]=value[i];colours[i]=value[i]?pack(one):pack(zero);
  }
  for(const [frame,list] of owners){
   if(typeof win.createImageBitmap!=='function')throw Error('Не удалось прочитать кадр фазы');
   const bitmap=await win.createImageBitmap(frame.blob);
   try{
    const canvas=win.document.createElement('canvas');canvas.width=width;canvas.height=height;
    const context=canvas.getContext('2d');context.drawImage(bitmap,0,0);
    const data=context.getImageData(0,0,width,height).data;
    for(const at of list)colours[at]=(data[at*4]<<16)|(data[at*4+1]<<8)|data[at*4+2];
   }finally{bitmap.close();}
  }
  const pixels=new Uint8ClampedArray(area*4);
  for(let i=0;i<area;i++){const rgb=colours[i];pixels[i*4]=rgb>>>16;pixels[i*4+1]=rgb>>>8&255;pixels[i*4+2]=rgb&255;pixels[i*4+3]=255;}
  const canvas=win.document.createElement('canvas');canvas.width=width;canvas.height=height;
  const context=canvas.getContext('2d'),image=context.createImageData(width,height);image.data.set(pixels);context.putImageData(image,0,0);
  const png=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
  if(!png)throw Error('Не удалось создать кадр XOR фаз');
  const ticks=Math.max(2,Math.min(500,Math.round((Number(delay)||200)/10))),encoder=win.MayatnikGif.encoder(width,height);
  encoder.add(pixels,ticks);const blob=encoder.finish();win.MayatnikGifScale?.rememberDelay(blob,ticks*10);
  return {...variant,id:(variant.id||'phases')+'-xor-'+Date.now(),name:'mayatnik-fazy-xor.gif',blob,semantic:true,delay:ticks*10,frames:[{blob:png,rows:height,label:'XOR фаз',semantic:{width,height,bits,bounds:{left:0,top:0,width,height}}}],plan:{...variant.plan,levels:[height]}};
 }
 return {generatePhases,combine};
});
