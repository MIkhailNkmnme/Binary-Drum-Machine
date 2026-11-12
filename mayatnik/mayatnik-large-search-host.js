/* Keep at most one transferred GPU strip in flight. */
(function(root){
  'use strict';
  const DIRECTORY='mayatnik-packed-spool-v1';
  const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const abort=()=>new DOMException('Поиск отменён','AbortError');

  async function removeScratch(name){
    if(!/^mayatnik-spool-[A-Za-z0-9_-]{1,160}\.bin$/.test(name||''))return;
    if(typeof navigator.storage?.getDirectory!=='function')return;
    for(let attempt=0;attempt<6;attempt++){
      try{
        const dir=await (await navigator.storage.getDirectory()).getDirectoryHandle(DIRECTORY);
        await dir.removeEntry(name);
        return;
      }catch(error){
        if(error.name==='NotFoundError'&&attempt>=1)return;
        if(error.name==='SecurityError'||error.name==='NotAllowedError')return;
        await pause(30*(attempt+1));
      }
    }
  }

  function start({header,strips,archived,request,current=()=>true,onProgress=()=>{}}){
    const token=Array.from(crypto.getRandomValues(new Uint32Array(4)),x=>x.toString(36)).join('-');
    const name='mayatnik-spool-'+token+'.bin',worker=new Worker('mayatnik-large-search-worker.js?v=1001-dev');
    let pending=null,settled=false,resolveDone,rejectDone;
    const result=new Promise((resolve,reject)=>{resolveDone=resolve;rejectDone=reject;});
    function finish(error,value){
      if(settled)return;
      settled=true;
      worker.terminate();
      if(pending){pending.reject(error||abort());pending=null;}
      if(error){removeScratch(name).catch(()=>{});rejectDone(error);}
      else resolveDone(value);
    }
    function send(message,type,y){
      return new Promise((resolve,reject)=>{
        if(settled){reject(abort());return;}
        pending={type,y,resolve,reject};
        const transfer=message.strip?[...new Set([message.strip.bits.buffer,message.strip.present.buffer])]:[];
        try{worker.postMessage(message,transfer);}
        catch(error){finish(error);}
      });
    }
    worker.onerror=event=>finish(Error(event.message||'Не удалось запустить поиск по полосам'));
    worker.onmessageerror=()=>finish(Error('Браузер не смог передать данные поиска'));
    worker.onmessage=({data})=>{
      if(settled)return;
      if(!current()){finish(abort());return;}
      if(data.error){finish(Error(data.error));return;}
      if(data.progress){onProgress(data.progress);return;}
      if(data.result){finish(null,data);return;}
      if(!pending||data.type!==pending.type||data.type==='ack'&&data.y!==pending.y){
        finish(Error('Нарушен порядок передачи полос'));
        return;
      }
      const request=pending;pending=null;request.resolve();
    };
    (async()=>{
      await send({type:'begin',name,header,request,archived},'ready');
      if(!archived){
        for await(const strip of strips(()=>!settled&&current())){
          if(settled||!current())throw abort();
          await send({type:'strip',strip},'ack',strip.y);
          onProgress({phase:'read',done:strip.y+strip.rows,total:header.height});
        }
      }
      if(settled||!current())throw abort();
      worker.postMessage({type:'run'});
    })().catch(error=>finish(error));
    return {name,result,cancel:()=>finish(abort())};
  }

  function fromPacked({width,height,stride,bits,present}){
    return {header:{width,height,stride},async *strips(current){
      for(let y=0;y<height&&current();y+=128){
        const rows=Math.min(128,height-y),at=y*stride,end=at+rows*stride;
        yield {y,rows,bits:bits.slice(at,end),present:present.slice(at,end)};
      }
    }};
  }

  root.MayatnikLargeSearchHost={start,fromPacked,removeScratch};
})(globalThis);
