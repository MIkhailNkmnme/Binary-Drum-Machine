/* Small GIF89a encoder. Exact per-image palettes; clear LZW before 10-bit codes.
   Encoding runs in a Worker, one frame in flight. Equal frames extend delay. */
(function(root){
  'use strict';
  function encoder(width,height){
    if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>65535||height>65535)throw Error('Некорректный размер GIF.');
    const chunks=[],word=n=>[n&255,n>>8&255];
    // Every image owns its palette, including independently exported frame().
    // No global table: different images may use different sets of 256 colours.
    chunks.push(Uint8Array.from([...Array.from('GIF89a',c=>c.charCodeAt(0)),...word(width),...word(height),112,0,0]));
    chunks.push(Uint8Array.from([33,255,11,...Array.from('NETSCAPE2.0',c=>c.charCodeAt(0)),3,1,0,0,0]));
    let previous=null,lastControl=null,lastImageStart=0;
    function add(rgba,delay){
      if(!rgba||rgba.length!==width*height*4)throw Error('Повреждены пиксели кадра GIF.');
      if(!Number.isFinite(delay))throw Error('Некорректная длительность кадра GIF.');
      const pixels=new Uint8Array(width*height),indices=new Map(),colours=[];let same=!!previous;
      for(let i=0;i<pixels.length;i++){
        const j=i*4,rgb=(rgba[j]<<16)|(rgba[j+1]<<8)|rgba[j+2];let index=indices.get(rgb);
        if(index===undefined){
          if(colours.length===256)throw Object.assign(Error('В кадре GIF больше 256 цветов (обнаружено не менее 257). Точное сохранение этого кадра в GIF недоступно.'),{code:'GIF_PALETTE_OVERFLOW',colourCount:257});
          index=colours.length;indices.set(rgb,index);colours.push(rgb);
        }
        pixels[i]=index;
        // Indices alone are insufficient: a new palette can recolour the same pattern.
        if(previous&&rgb!==previous.colours[previous.pixels[i]])same=false;
      }
      delay=Math.max(1,Math.min(65535,Math.round(delay)));
      if(same&&lastControl){const total=lastControl[4]+(lastControl[5]<<8)+delay;if(total<=65535){lastControl[4]=total&255;lastControl[5]=total>>8;return;}}
      previous={pixels,colours};lastControl=Uint8Array.from([33,249,4,4,...word(delay),0,0]);chunks.push(lastControl);
      lastImageStart=chunks.length;
      const tableBits=Math.max(1,Math.ceil(Math.log2(colours.length))),palette=new Uint8Array(3*(1<<tableBits));
      for(let i=0;i<colours.length;i++){palette[i*3]=colours[i]>>>16;palette[i*3+1]=(colours[i]>>>8)&255;palette[i*3+2]=colours[i]&255;}
      chunks.push(Uint8Array.from([44,0,0,0,0,...word(width),...word(height),128|(tableBits-1)]),palette,Uint8Array.of(8));
      const out=[];let accumulator=0,bits=0,next=258,dict=new Map();
      const code=v=>{accumulator|=v<<bits;bits+=9;while(bits>=8){out.push(accumulator&255);accumulator>>>=8;bits-=8;}};
      code(256);let prefix=pixels[0];
      for(let i=1;i<pixels.length;i++){
        const k=pixels[i],key=prefix*256+k,found=dict.get(key);
        if(found!==undefined){prefix=found;continue;}
        code(prefix);dict.set(key,next++);prefix=k;
        if(next>=500){code(256);dict.clear();next=258;}
      }
      code(prefix);code(257);if(bits)out.push(accumulator&255);
      for(let i=0;i<out.length;i+=255){const block=out.slice(i,i+255);chunks.push(Uint8Array.from([block.length,...block]));}chunks.push(Uint8Array.of(0));
    }
    // A static, independently decodable copy of the last image, using the exact
    // palette and LZW bytes already encoded. No re-sampling or second encoder.
    function frame(){if(!previous)throw Error('В GIF нет кадров.');return new Blob([chunks[0],...chunks.slice(lastImageStart),Uint8Array.of(59)],{type:'image/gif'});}
    return {add,frame,finish(){if(!previous)throw Error('В GIF нет кадров.');return new Blob([...chunks,Uint8Array.of(59)],{type:'image/gif'});}};
  }
  function record({width,height,capture,onDone,onError}){
    const ratio=Math.min(1,1024/width,1024/height),w=Math.max(1,Math.round(width*ratio)),h=Math.max(1,Math.round(height*ratio));
    const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const g=canvas.getContext('2d',{willReadFrequently:true});
    const code=`const encoder=(${encoder.toString()});let gif;onmessage=e=>{try{const m=e.data;if(m.type==='start'){gif=encoder(m.width,m.height);postMessage({ready:true});}else if(m.type==='frame'){gif.add(m.pixels,m.delay);postMessage({ready:true});}else if(m.type==='stop')postMessage({blob:gif.finish()});}catch(error){postMessage({error:String(error.message||error)});}};`;
    const url=URL.createObjectURL(new Blob([code],{type:'text/javascript'})),worker=new Worker(url);URL.revokeObjectURL(url);
    let stopping=false,finished=false,closed=false,timer=0,busy=true,frames=0,pending=null,stopAt=0;
    function fail(error){if(closed)return;closed=true;clearTimeout(timer);worker.terminate();pending=null;onError?.(error);}
    function take(){const source=capture();g.imageSmoothingEnabled=false;g.clearRect(0,0,w,h);g.drawImage(source,0,0,w,h);return {pixels:g.getImageData(0,0,w,h).data,at:performance.now()};}
    function send(until){const frame=pending;pending=null;frames++;busy=true;worker.postMessage({type:'frame',pixels:frame.pixels,delay:Math.max(1,Math.round((until-frame.at)/10))},[frame.pixels.buffer]);}
    function finish(){if(closed||finished||busy)return;if(pending){send(stopAt);return;}finished=true;busy=true;worker.postMessage({type:'stop'});}
    function tick(){if(closed||stopping)return;try{const next=take();send(next.at);pending=next;}catch(error){fail(error);}}
    worker.onmessage=e=>{if(closed)return;if(e.data.error){fail(Error(e.data.error));return;}if(e.data.blob){closed=true;worker.terminate();onDone(e.data.blob,{width:w,height:h,frames});return;}
      busy=false;if(stopping)finish();else timer=setTimeout(tick,Math.max(0,100-(performance.now()-pending.at)));};
    worker.onerror=e=>fail(Error(e.message));worker.postMessage({type:'start',width:w,height:h});
    // Keep the first visible frame while the worker starts. Its duration becomes
    // known at the next capture or Stop, so elapsed time belongs to this frame.
    try{pending=take();}catch(error){Promise.resolve().then(()=>fail(error));}
    return {width:w,height:h,stop(){if(stopping||closed)return;stopping=true;stopAt=performance.now();clearTimeout(timer);finish();}};
  }
  const api={encoder,record};if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikGif=api;
})(typeof globalThis==='object'?globalThis:this);
