/* Small GIF89a encoder. Exact per-image palettes; clear LZW before 10-bit codes.
   Encoding runs in a Worker, one frame in flight. Equal frames extend delay. */
(function(root){
  'use strict';
  function encoder(width,height,{trim=false,mergeEqual=true}={}){
    if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>65535||height>65535)throw Error('Некорректный размер GIF.');
    const chunks=[],word=n=>[n&255,n>>8&255];
    // Every image owns its palette, including independently exported frame().
    // Trimmed recordings add only a black background table; every image still owns its exact palette.
    chunks.push(Uint8Array.from([...Array.from('GIF89a',c=>c.charCodeAt(0)),...word(width),...word(height),trim?240:112,0,0,...(trim?[0,0,0,255,255,255]:[])]));
    chunks.push(Uint8Array.from([33,255,11,...Array.from('NETSCAPE2.0',c=>c.charCodeAt(0)),3,1,0,0,0]));
    let previous=null,lastControl=null,lastImageStart=0,union=null;
    const descriptors=[];
    function dimensions(){return trim&&union?{width:union.right-union.left,height:union.bottom-union.top}:{width,height};}
    function output(){
      if(!trim)return chunks;
      const size=dimensions(),head=chunks[0].slice(),out=[head,...chunks.slice(1)];
      head.set(word(size.width),6);head.set(word(size.height),8);
      for(const {at,box}of descriptors){const descriptor=chunks[at].slice(),x=box.empty?0:box.left-(union?.left||0),y=box.empty?0:box.top-(union?.top||0);descriptor.set(word(x),1);descriptor.set(word(y),3);out[at]=descriptor;}
      return out;
    }
    function add(rgba,delay){
      if(!rgba||rgba.length!==width*height*4)throw Error('Повреждены пиксели кадра GIF.');
      if(!Number.isFinite(delay))throw Error('Некорректная длительность кадра GIF.');
      let box={left:0,top:0,right:width,bottom:height,empty:false};
      if(trim){
        let left=width,top=height,right=0,bottom=0;
        for(let y=0;y<height;y++)for(let x=0;x<width;x++){const q=(y*width+x)*4;if(rgba[q]||rgba[q+1]||rgba[q+2]){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x+1);bottom=Math.max(bottom,y+1);}}
        if(right>left&&bottom>top){box={left,top,right,bottom,empty:false};union=union?{left:Math.min(union.left,left),top:Math.min(union.top,top),right:Math.max(union.right,right),bottom:Math.max(union.bottom,bottom)}:{left,top,right,bottom};}
        else box={left:0,top:0,right:1,bottom:1,empty:true};
      }
      const frameWidth=box.right-box.left,frameHeight=box.bottom-box.top;
      const pixels=new Uint8Array(frameWidth*frameHeight),indices=new Map(),colours=[];let same=mergeEqual&&!!previous&&previous.box.left===box.left&&previous.box.top===box.top&&previous.box.right===box.right&&previous.box.bottom===box.bottom&&previous.box.empty===box.empty;
      for(let i=0;i<pixels.length;i++){
        const j=((Math.floor(i/frameWidth)+box.top)*width+i%frameWidth+box.left)*4,rgb=(rgba[j]<<16)|(rgba[j+1]<<8)|rgba[j+2];let index=indices.get(rgb);
        if(index===undefined){
          if(colours.length===256)throw Object.assign(Error('В кадре GIF больше 256 цветов (обнаружено не менее 257). Точное сохранение этого кадра в GIF недоступно.'),{code:'GIF_PALETTE_OVERFLOW',colourCount:257});
          index=colours.length;indices.set(rgb,index);colours.push(rgb);
        }
        pixels[i]=index;
        // Indices alone are insufficient: a new palette can recolour the same pattern.
        if(same&&rgb!==previous.colours[previous.pixels[i]])same=false;
      }
      delay=Math.max(1,Math.min(65535,Math.round(delay)));
      if(mergeEqual&&same&&lastControl){const total=lastControl[4]+(lastControl[5]<<8)+delay;if(total<=65535){lastControl[4]=total&255;lastControl[5]=total>>8;return;}}
      previous={pixels,colours,box};lastControl=Uint8Array.from([33,249,4,trim?8:4,...word(delay),0,0]);chunks.push(lastControl);
      lastImageStart=chunks.length;
      const tableBits=Math.max(1,Math.ceil(Math.log2(colours.length))),palette=new Uint8Array(3*(1<<tableBits));
      for(let i=0;i<colours.length;i++){palette[i*3]=colours[i]>>>16;palette[i*3+1]=(colours[i]>>>8)&255;palette[i*3+2]=colours[i]&255;}
      descriptors.push({at:chunks.length,box});
      chunks.push(Uint8Array.from([44,...word(box.left),...word(box.top),...word(frameWidth),...word(frameHeight),128|(tableBits-1)]),palette,Uint8Array.of(8));
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
    function frame(){if(!previous)throw Error('В GIF нет кадров.');const out=output();return new Blob([out[0],...out.slice(lastImageStart),Uint8Array.of(59)],{type:'image/gif'});}
    let measuredChunks=0,encodedBytes=0;
    function byteLength(){
      for(;measuredChunks<chunks.length;measuredChunks++)encodedBytes+=chunks[measuredChunks].byteLength;
      return encodedBytes;
    }
    function drain(){
      if(trim||mergeEqual)throw Error('Поток GIF требует фиксированного размера и отдельных кадров.');
      descriptors.length=0;
      return new Blob(chunks.splice(0));
    }
    return {add,frame,dimensions,byteLength,drain,finish(){if(!previous)throw Error('В GIF нет кадров.');return new Blob([...output(),Uint8Array.of(59)],{type:'image/gif'});}};
  }
  function record({width,height,capture,onDone,onError}){
    const ratio=Math.min(1,1024/width,1024/height),w=Math.max(1,Math.round(width*ratio)),h=Math.max(1,Math.round(height*ratio));
    const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const g=canvas.getContext('2d',{willReadFrequently:true});
    const code=`const encoder=(${encoder.toString()});let gif;onmessage=e=>{try{const m=e.data;if(m.type==='start'){gif=encoder(m.width,m.height,{trim:true});postMessage({ready:true});}else if(m.type==='frame'){gif.add(m.pixels,m.delay);postMessage({ready:true});}else if(m.type==='stop')postMessage({blob:gif.finish(),...gif.dimensions()});}catch(error){postMessage({error:String(error.message||error)});}};`;
    const url=URL.createObjectURL(new Blob([code],{type:'text/javascript'})),worker=new Worker(url);URL.revokeObjectURL(url);
    let stopping=false,finished=false,closed=false,timer=0,busy=true,frames=0,pending=null,stopAt=0;
    function fail(error){if(closed)return;closed=true;clearTimeout(timer);worker.terminate();pending=null;onError?.(error);}
    function take(){const source=capture();g.imageSmoothingEnabled=false;g.clearRect(0,0,w,h);g.drawImage(source,0,0,w,h);return {pixels:g.getImageData(0,0,w,h).data,at:performance.now()};}
    function send(until){const frame=pending;pending=null;frames++;busy=true;worker.postMessage({type:'frame',pixels:frame.pixels,delay:Math.max(1,Math.round((until-frame.at)/10))},[frame.pixels.buffer]);}
    function finish(){if(closed||finished||busy)return;if(pending){send(stopAt);return;}finished=true;busy=true;worker.postMessage({type:'stop'});}
    function tick(){if(closed||stopping)return;try{const next=take();send(next.at);pending=next;}catch(error){fail(error);}}
    worker.onmessage=e=>{if(closed)return;if(e.data.error){fail(Error(e.data.error));return;}if(e.data.blob){closed=true;worker.terminate();onDone(e.data.blob,{width:e.data.width||w,height:e.data.height||h,frames});return;}
      busy=false;if(stopping)finish();else timer=setTimeout(tick,Math.max(0,100-(performance.now()-pending.at)));};
    worker.onerror=e=>fail(Error(e.message));worker.postMessage({type:'start',width:w,height:h});
    // Keep the first visible frame while the worker starts. Its duration becomes
    // known at the next capture or Stop, so elapsed time belongs to this frame.
    try{pending=take();}catch(error){Promise.resolve().then(()=>fail(error));}
    return {width:w,height:h,stop(){if(stopping||closed)return;stopping=true;stopAt=performance.now();clearTimeout(timer);finish();}};
  }
  async function batch(sizes,{stream=false}={}){
    const code=`const encoder=(${encoder.toString()});
      let gifs,stream;
      onmessage=e=>{try{
        const {type,sizes,frames,delay}=e.data;
        if(type==='start'){
          stream=e.data.stream;
          gifs=sizes.map(({width,height})=>encoder(width,height,{trim:!stream,mergeEqual:false}));
          postMessage({});
        }
        else if(type==='frame'){
          for(let i=0;i<gifs.length;i++)gifs[i].add(frames[i],delay);
          if(stream)postMessage({blobs:gifs.map(gif=>gif.drain())});
          else{
            if(gifs.reduce((total,gif)=>total+gif.byteLength(),0)>256*1048576)throw Error('Четыре GIF превысили 256 МиБ. Выберите меньше кадров.');
            postMessage({});
          }
        }
        else postMessage({blobs:gifs.map(gif=>gif.finish())});
      }catch(error){postMessage({error:String(error.message||error)});}};`;
    const url=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));
    let worker;
    try{worker=new Worker(url);}finally{URL.revokeObjectURL(url);}
    let pending=null,closed=false;
    function close(error){
      if(closed)return;
      closed=true;worker.terminate();
      const request=pending;pending=null;
      if(request)request.reject(error||Error('Запись GIF завершена.'));
    }
    function exchange(message,transfer=[]){
      if(closed||pending)return Promise.reject(Error('Кодировщик GIF недоступен.'));
      return new Promise((resolve,reject)=>{
        pending={resolve,reject};
        try{worker.postMessage(message,transfer);}catch(error){close(error);}
      });
    }
    worker.onmessage=({data})=>{
      if(data.error){close(Error(data.error));return;}
      const request=pending;pending=null;request?.resolve(data);
    };
    worker.onerror=event=>close(Error(event.message||'Ошибка кодировщика GIF.'));
    worker.onmessageerror=()=>close(Error('Ошибка передачи кадра GIF.'));
    await exchange({type:'start',sizes,stream});
    return {
      add(frames,delay){return exchange({type:'frame',frames,delay},frames.map(frame=>frame.buffer));},
      async finish(){try{return (await exchange({type:'stop'})).blobs;}finally{close();}},
      cancel(){close(new DOMException('Запись GIF отменена.','AbortError'));}
    };
  }
  async function squareSink(sizes){
    const paths=sizes.map(size=>size+'x'+size+'.gif'),files=[],writers=[];
    let parent,name;
    async function dispose(){
      await Promise.allSettled(writers.map(writer=>writer?.abort()));
      if(parent&&name)await parent.removeEntry(name,{recursive:true}).catch(()=>{});
    }
    try{
      const directory=await navigator.storage.getDirectory();
      parent=await directory.getDirectoryHandle('mayatnik-square-gifs',{create:true});
      name=Date.now()+'-'+crypto.randomUUID();
      const job=await parent.getDirectoryHandle(name,{create:true});
      for(const path of paths){
        const file=await job.getFileHandle(path,{create:true});
        files.push(file);writers.push(await file.createWritable());
      }
      return {
        append:blobs=>Promise.all(blobs.map((blob,i)=>writers[i].write(blob))),
        async finish(){
          await Promise.all(writers.map(writer=>writer.close()));
          writers.length=0;
          return Promise.all(files.map(file=>file.getFile()));
        },
        dispose
      };
    }catch(_){
      await dispose();
      const chunks=sizes.map(()=>[]);let bytes=0;
      return {
        async append(blobs){
          for(let i=0;i<blobs.length;i++){
            bytes+=blobs[i].size;
            if(bytes>256*1048576)throw Error('Браузер не предоставил временное хранилище, а GIF заняли больше 256 МиБ.');
            chunks[i].push(blobs[i]);
          }
        },
        async finish(){return chunks.map(parts=>new Blob(parts,{type:'image/gif'}));},
        async dispose(){for(const parts of chunks)parts.length=0;}
      };
    }
  }
  const api={encoder,record,batch,squareSink};if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikGif=api;
})(typeof globalThis==='object'?globalThis:this);
