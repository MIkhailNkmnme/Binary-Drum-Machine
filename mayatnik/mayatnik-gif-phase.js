/* Residue phases for the GIF Scale window. Every frame is one phase raster — the
   same picture the live strip shows, without holes. The frames keep their phase
   offsets, so "XOR of selected frames" puts the cells back at the source
   positions and assembles the original picture. Encoding runs in a Worker. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikGifPhase=api;})(globalThis,function(){
 'use strict';
 const MAX_ASSEMBLY_CELLS=2100000;
 function renderPhaseJob({width,height,factor,items,delay,background,sourcePixels,sourceBits}){
  const gridWidth=Math.ceil(width/factor),gridHeight=Math.ceil(height/factor),area=gridWidth*gridHeight;
  const gif=encoder(gridWidth,gridHeight),pixels=new Uint8ClampedArray(area*4),bits=new Int8Array(area);
  const bg=[Number(background?.[0])||0,Number(background?.[1])||0,Number(background?.[2])||0],total=items.length;
  for(let index=0;index<total;index++){
   const item=items[index]||{},dx=Math.max(0,Math.floor(Number(item.dx)||0)),dy=Math.max(0,Math.floor(Number(item.dy)||0));
   // Padding past the source edge is background, never an invented source bit.
   for(let i=0;i<pixels.length;i+=4){pixels[i]=bg[0];pixels[i+1]=bg[1];pixels[i+2]=bg[2];pixels[i+3]=255;}
   bits.fill(-1);
   for(let row=0;row<gridHeight;row++){
    const sy=row*factor+dy;if(sy>=height)break;
    for(let col=0;col<gridWidth;col++){
     const sx=col*factor+dx;if(sx>=width)break;
     const source=(sy*width+sx)*4,at=row*gridWidth+col,out=at*4,alpha=(sourcePixels[source+3]||0)/255;
     pixels[out]=Math.round(sourcePixels[source]*alpha+bg[0]*(1-alpha));
     pixels[out+1]=Math.round(sourcePixels[source+1]*alpha+bg[1]*(1-alpha));
     pixels[out+2]=Math.round(sourcePixels[source+2]*alpha+bg[2]*(1-alpha));
     if(sourceBits)bits[at]=sourceBits[sy*width+sx];
    }
   }
   gif.add(pixels,delay);
   const copy=bits.slice();
   postMessage({index,rows:gridHeight,label:'dx='+dx+', dy='+dy,phase:{dx,dy},blob:gif.frame(),semantic:{width:gridWidth,height:gridHeight,bits:copy,bounds:{left:0,top:0,width:gridWidth,height:gridHeight}},done:index+1,total},[copy.buffer]);
  }
  postMessage({complete:true,blob:gif.finish()});
 }
 // Frames are the phase rasters themselves: each is dense, as in the live strip,
 // and carries its offset so the page can be assembled back into the field.
 function generatePhases(source,options={}){
  const width=source?.width,height=source?.height,items=options.items;
  if(!source||!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1)throw Error('Неверный размер кадра');
  if(!Array.isArray(items)||!items.length)throw Error('Нет фаз для переноса в Гиф-Масштаб');
  if(!source.pixels||source.pixels.length!==width*height*4)throw Error('Повреждены пиксели кадра');
  if(!globalThis.MayatnikGif?.encoder)throw Error('Кодировщик GIF не загружен');
  const factor=Math.max(2,Math.floor(Number(options.factor)||2));
  if(items.length>10000)throw Error('Слишком много фаз для одного GIF');
  const gridWidth=Math.ceil(width/factor),gridHeight=Math.ceil(height/factor);
  if(gridWidth<1||gridHeight<1||gridWidth*gridHeight*items.length>64*1024*1024)throw Error('Слишком большое поле для переноса фаз');
  const ticks=Math.max(2,Math.min(500,Math.round((Number(options.delay)||200)/10)));
  const code='const encoder=('+globalThis.MayatnikGif.encoder.toString()+');\nconst renderPhaseJob=('+renderPhaseJob.toString()+');\n'+
   'onmessage=e=>{try{renderPhaseJob(e.data);}catch(error){postMessage({error:error.message||String(error)});}};';
  const url=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));let worker;try{worker=new Worker(url);}finally{URL.revokeObjectURL(url);}
  const frames=[];let settled=false,resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});
  function finish(error,variant){if(settled)return;settled=true;worker.terminate();if(error)reject(error);else resolve(variant);}
  worker.onmessage=e=>{if(settled)return;const message=e.data;try{
   if(message.error){finish(Error(message.error));return;}
   if(message.complete){
    if(frames.filter(Boolean).length!==items.length)throw Error('Не все кадры фаз получены');
    finish(null,{id:'phases-pixels',method:'phases',presentation:'pixels',name:options.name||'mayatnik-fazy.gif',label:options.label||('Все фазы ÷'+factor),semantic:true,phase:{factor,width,height,page:Number(options.page)||0,pages:Number(options.pages)||1,gridWidth,gridHeight},frames:frames.slice(),blob:message.blob,delay:ticks*10,plan:{width:gridWidth,height:gridHeight,sourceHeight:gridHeight,padded:0,sequence:'custom',levels:frames.map(()=>gridHeight)}});
    return;
   }
   if(!Number.isInteger(message.index)||!message.blob)return;
   frames[message.index]={blob:message.blob,rows:message.rows,label:message.label,phase:message.phase,semantic:message.semantic||null};
   options.onProgress?.({done:message.done,total:message.total,index:message.index});
  }catch(error){finish(error);}};
  worker.onerror=e=>finish(Error(e.message||'Ошибка генератора фаз'));
  worker.onmessageerror=()=>finish(Error('Ошибка передачи кадра фаз'));
  try{
   const pixels=new Uint8ClampedArray(source.pixels),bits=source.bits?new Int8Array(source.bits):null;
   worker.postMessage({width,height,factor,items:items.map(item=>({dx:Number(item.dx)||0,dy:Number(item.dy)||0})),delay:ticks,background:Array.from(options.background||[0,0,0]),sourcePixels:pixels,sourceBits:bits},bits?[pixels.buffer,bits.buffer]:[pixels.buffer]);
  }catch(error){finish(error);}
  return {promise,cancel(){finish(Object.assign(Error('Генерация отменена'),{name:'AbortError'}));}};
 }
 // Put the selected phase rasters back at their source positions. Every selected
 // phase owns disjoint cells, so no pixel is invented or blended.
 async function combine(win,variant,frames,delay=200,options={}){
  if(!Array.isArray(frames)||!frames.length)throw Error('Выберите кадры для сборки');
  const phase=variant?.phase;
  if(!phase||!Number.isSafeInteger(phase.width)||!Number.isSafeInteger(phase.height)||!Number.isSafeInteger(phase.factor)||phase.factor<2)throw Error('Этот кадр не является страницей фаз');
  const width=phase.width,height=phase.height,factor=phase.factor;
  if(width*height>MAX_ASSEMBLY_CELLS)throw Error('Сборка фаз: не более 2 100 000 пикселей');
  const bits=new Int8Array(width*height).fill(-1),colours=new Uint32Array(width*height);
  for(const frame of frames){
   const grid=frame?.semantic,offset=frame?.phase;
   if(!grid?.bits||!offset||!Number.isSafeInteger(offset.dx)||!Number.isSafeInteger(offset.dy))throw Error('У кадра нет положения фазы');
   if(grid.width!==phase.gridWidth||grid.height!==phase.gridHeight)throw Error('Размеры фаз различаются');
   if(typeof win.createImageBitmap!=='function')throw Error('Не удалось прочитать кадр фазы');
   const bitmap=await win.createImageBitmap(frame.blob);
   try{
    const canvas=win.document.createElement('canvas');canvas.width=grid.width;canvas.height=grid.height;
    const context=canvas.getContext('2d');context.drawImage(bitmap,0,0);
    const data=context.getImageData(0,0,grid.width,grid.height).data;
    for(let row=0;row<grid.height;row++){
     const sy=row*factor+offset.dy;if(sy>=height)break;
     for(let col=0;col<grid.width;col++){
      const sx=col*factor+offset.dx;if(sx>=width)break;
      const bit=grid.bits[row*grid.width+col];if(bit===-1)continue;
      const at=sy*width+sx,q=(row*grid.width+col)*4;
      bits[at]=bit;colours[at]=(data[q]<<16)|(data[q+1]<<8)|data[q+2];
     }
    }
   }finally{bitmap.close();}
  }
  const background=options.background||[0,0,0],bg=(Number(background[0])||0)*65536+(Number(background[1])||0)*256+(Number(background[2])||0);
  const pixels=new Uint8ClampedArray(width*height*4);
  for(let i=0;i<width*height;i++){const rgb=bits[i]===-1?bg:colours[i];pixels[i*4]=rgb>>>16;pixels[i*4+1]=rgb>>>8&255;pixels[i*4+2]=rgb&255;pixels[i*4+3]=255;}
  const canvas=win.document.createElement('canvas');canvas.width=width;canvas.height=height;
  const context=canvas.getContext('2d'),image=context.createImageData(width,height);image.data.set(pixels);context.putImageData(image,0,0);
  const png=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
  if(!png)throw Error('Не удалось создать собранный кадр фаз');
  const ticks=Math.max(2,Math.min(500,Math.round((Number(delay)||200)/10))),encoder=win.MayatnikGif.encoder(width,height);
  encoder.add(pixels,ticks);const blob=encoder.finish();win.MayatnikGifScale?.rememberDelay(blob,ticks*10);
  return {...variant,id:(variant.id||'phases')+'-assembled-'+Date.now(),name:'mayatnik-fazy-sborka.gif',label:'Сборка фаз · '+frames.length+' кадров',semantic:true,phase:null,delay:ticks*10,frames:[{blob:png,rows:height,label:'сборка фаз',semantic:{width,height,bits,bounds:{left:0,top:0,width,height}}}],plan:{width,height,sourceHeight:height,padded:0,sequence:'custom',levels:[height]}};
 }
 return {generatePhases,combine};
});
