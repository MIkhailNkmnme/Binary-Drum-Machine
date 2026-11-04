/* Selected frames retain their semantic grids through GIF editing. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikGifFrameSet=api;})(globalThis,function(){
 'use strict';
 function xor(frames,width,height,one=[232,237,245],zero=[91,100,117],background=[15,18,24]){
  if(!frames.length||width*height>2100000)throw Error('Выберите кадры; предел XOR —2100000пикселей');
  const bits=new Int8Array(width*height).fill(-1),pixels=new Uint8ClampedArray(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){const q=y*width+x;let value=0,occupied=false,mixed=false,r=0,g=0,b=0;
   for(const frame of frames){const s=frame.semantic,B=s?.bounds;if(!s?.bits||!B)throw Error('У кадра нет карты битов');
    if(x<B.left||x>=B.left+B.width||y<B.top||y>=B.top+B.height)continue;
    const sx=Math.min(s.width-1,Math.floor((x-B.left+.5)*s.width/B.width)),sy=Math.min(s.height-1,Math.floor((y-B.top+.5)*s.height/B.height)),bit=s.bits[sy*s.width+sx];
    if(bit===-1)continue;occupied=true;if(bit===-2)mixed=true;else value^=bit;
    if(frame.pixels){r^=frame.pixels[q*4];g^=frame.pixels[q*4+1];b^=frame.pixels[q*4+2];}
   }
   bits[q]=occupied?(mixed?-2:value):-1;const colour=!occupied?background:mixed?[r,g,b]:value?one:zero;pixels.set([...colour,255],q*4);
  }
  return {pixels,semantic:{width,height,bits,bounds:{left:0,top:0,width,height}}};
 }
 async function build(win,variant,frames,delay,operation='filter',colours={}){
  if(!frames.length)throw Error('Выберите хотя бы один кадр');const {width,height}=variant.plan;if(width*height>16777216)throw Error('Слишком большой кадр');
  const encoder=win.MayatnikGif.encoder(width,height),ticks=Math.max(2,Math.min(500,Math.round((Number(delay)||100)/10))),canvas=win.document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d'),decoded=[],result=[];
  for(const frame of frames){const bitmap=await win.createImageBitmap(frame.blob);try{if(bitmap.width!==width||bitmap.height!==height)throw Error('Размеры кадров различаются');ctx.clearRect(0,0,width,height);ctx.drawImage(bitmap,0,0);const pixels=ctx.getImageData(0,0,width,height).data;
    if(operation==='xor'){if((decoded.length+1)*width*height*4>128*1024*1024)throw Error('Выбрано слишком много кадров для XOR');decoded.push({...frame,pixels});}
    else{encoder.add(pixels,ticks);result.push(frame);}
   }finally{bitmap.close();}await new Promise(resolve=>win.setTimeout(resolve,0));
  }
  if(operation==='xor'){const combined=xor(decoded,width,height,colours.one,colours.zero,colours.background);const image=ctx.createImageData(width,height);image.data.set(combined.pixels);ctx.putImageData(image,0,0);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('Не удалось создать кадр XOR');encoder.add(combined.pixels,ticks);result.push({blob,rows:height,semantic:combined.semantic});}
  const blob=encoder.finish();win.MayatnikGifScale?.rememberDelay(blob,ticks*10);return {...variant,id:(variant.id||'gif')+'-'+operation+'-'+Date.now(),name:'mayatnik-'+operation+'.gif',blob,frames:result,delay:ticks*10,plan:{...variant.plan,levels:result.map(f=>f.rows)}};
 }
 return {xor,build};
});
