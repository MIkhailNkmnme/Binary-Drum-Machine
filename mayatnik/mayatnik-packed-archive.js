/* Read the planar archive in bounded strips, for search or direct GPU upload. */
(function(root){
  'use strict';
  const planes=['bits','present'],stripeRows=128;
  async function read(archived,consume,current=()=>true){
    const {blob,format,width,height,stride}=archived;
    if(!blob||!['deflate','raw'].includes(format)||
      ![width,height,stride].every(Number.isSafeInteger)||width<1||height<1||stride<Math.ceil(width/32))
      throw Error('Некорректный упакованный снимок');
    let source=blob.stream();
    if(format==='deflate'){
      let at=0;
      // Small compressed inputs also bound temporary inflate output.
      source=new ReadableStream({
        async pull(controller){
          if(at>=blob.size){controller.close();return;}
          const end=Math.min(blob.size,at+8192);
          controller.enqueue(new Uint8Array(await blob.slice(at,end).arrayBuffer()));
          at=end;
        }
      }).pipeThrough(new DecompressionStream('deflate'));
    }
    const stream=source;
    const reader=stream.getReader();
    let chunk=new Uint8Array(0),offset=0;
    try{
      for(const plane of planes)for(let y=0;y<height;y+=stripeRows){
        if(!current())throw new DOMException('Чтение снимка отменено','AbortError');
        const rows=Math.min(stripeRows,height-y),data=new Uint32Array(stride*rows);
        const bytes=new Uint8Array(data.buffer);
        for(let at=0;at<bytes.length;){
          if(offset===chunk.length){
            const next=await reader.read();
            if(next.done)throw Error('Упакованный снимок закончился внутри полосы');
            chunk=next.value;offset=0;
            if(!chunk.length)continue;
          }
          const n=Math.min(bytes.length-at,chunk.length-offset);
          bytes.set(chunk.subarray(offset,offset+n),at);
          offset+=n;at+=n;
        }
        if(!current())throw new DOMException('Чтение снимка отменено','AbortError');
        await consume({plane,y,rows,data});
      }
      if(offset!==chunk.length)throw Error('В упакованном снимке есть лишние данные');
      for(let next=await reader.read();!next.done;next=await reader.read())
        if(next.value.length)throw Error('В упакованном снимке есть лишние данные');
    }finally{
      try{await reader.cancel();}catch(_){}
      reader.releaseLock();
    }
  }
  root.MayatnikPackedArchive={read};
})(globalThis);
