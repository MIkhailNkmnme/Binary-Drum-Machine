/* Small GIF89a encoder. Fixed 3/3/2 palette; clear LZW before 10-bit codes.
   Encoding runs in a Worker, one frame in flight. Equal frames extend delay. */
(function(root){
  'use strict';
  function encoder(width,height){
    const chunks=[],word=n=>[n&255,n>>8&255];
    chunks.push(Uint8Array.from([...Array.from('GIF89a',c=>c.charCodeAt(0)),...word(width),...word(height),247,0,0]));
    const palette=new Uint8Array(768);for(let i=0;i<256;i++){palette[i*3]=Math.round((i>>5)*255/7);palette[i*3+1]=Math.round(((i>>2)&7)*255/7);palette[i*3+2]=Math.round((i&3)*255/3);}chunks.push(palette);
    chunks.push(Uint8Array.from([33,255,11,...Array.from('NETSCAPE2.0',c=>c.charCodeAt(0)),3,1,0,0,0]));
    let previous=null,lastControl=null;
    function add(rgba,delay){
      const pixels=new Uint8Array(width*height);let same=!!previous;
      for(let i=0;i<pixels.length;i++){const j=i*4,v=(rgba[j]>>5)<<5|(rgba[j+1]>>5)<<2|(rgba[j+2]>>6);pixels[i]=v;if(previous&&v!==previous[i])same=false;}
      delay=Math.max(1,Math.min(65535,Math.round(delay)));
      if(same&&lastControl){const total=lastControl[4]+(lastControl[5]<<8)+delay;if(total<=65535){lastControl[4]=total&255;lastControl[5]=total>>8;return;}}
      previous=pixels;lastControl=Uint8Array.from([33,249,4,4,...word(delay),0,0]);chunks.push(lastControl);
      chunks.push(Uint8Array.from([44,0,0,0,0,...word(width),...word(height),0,8]));
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
    return {add,finish:()=>new Blob([...chunks,Uint8Array.of(59)],{type:'image/gif'})};
  }
  function record({width,height,capture,onDone,onError}){
    const ratio=Math.min(1,1024/width,1024/height),w=Math.max(1,Math.round(width*ratio)),h=Math.max(1,Math.round(height*ratio));
    const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const g=canvas.getContext('2d',{willReadFrequently:true});
    const code=`const encoder=(${encoder.toString()});let gif;onmessage=e=>{try{const m=e.data;if(m.type==='start'){gif=encoder(m.width,m.height);postMessage({ready:true});}else if(m.type==='frame'){gif.add(m.pixels,m.delay);postMessage({ready:true});}else if(m.type==='stop')postMessage({blob:gif.finish()});}catch(error){postMessage({error:String(error.message||error)});}};`;
    const url=URL.createObjectURL(new Blob([code],{type:'text/javascript'})),worker=new Worker(url);URL.revokeObjectURL(url);
    let stopping=false,timer=0,last=performance.now(),busy=true,frames=0;
    function fail(error){clearTimeout(timer);worker.terminate();onError?.(error);}
    function tick(){if(stopping){worker.postMessage({type:'stop'});return;}try{
      const source=capture();g.imageSmoothingEnabled=false;g.clearRect(0,0,w,h);g.drawImage(source,0,0,w,h);const pixels=g.getImageData(0,0,w,h).data,now=performance.now(),delay=frames?Math.max(1,Math.round((now-last)/10)):10;last=now;frames++;busy=true;
      worker.postMessage({type:'frame',pixels,delay},[pixels.buffer]);
    }catch(e){fail(e);}}
    worker.onmessage=e=>{if(e.data.error){fail(Error(e.data.error));return;}if(e.data.blob){worker.terminate();onDone(e.data.blob,{width:w,height:h,frames});return;}
      busy=false;if(stopping)worker.postMessage({type:'stop'});else if(!frames)tick();else timer=setTimeout(tick,Math.max(0,100-(performance.now()-last)));};
    worker.onerror=e=>fail(Error(e.message));worker.postMessage({type:'start',width:w,height:h});
    return {width:w,height:h,stop(){if(stopping)return;stopping=true;clearTimeout(timer);if(!busy)worker.postMessage({type:'stop'});}};
  }
  const api={encoder,record};if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikGif=api;
})(typeof globalThis==='object'?globalThis:this);
