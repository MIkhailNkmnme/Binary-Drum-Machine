/* Acknowledge each packed strip before the host reads the next one. */
'use strict';
importScripts('mayatnik-packed-spool.js?v=1001','mayatnik-packed-archive.js?v=1001','mayatnik-large-search.js?v=1001');

const planes=['bits','present'];
const stripeRows=128;
let session=null,queue=Promise.resolve();

function archiveMetadata(snapshot,blob,format){
  return {kind:'packed-ochki-v1',format,width:snapshot.width,height:snapshot.height,stride:snapshot.stride,blob};
}

async function archiveFrame(snapshot,spool){
  const format=typeof CompressionStream==='function'?'deflate':'raw';
  let planeIndex=0,y=0;
  const input=new ReadableStream({
    pull(controller){
      const plane=planes[planeIndex];
      if(!plane){controller.close();return;}
      const rows=Math.min(stripeRows,snapshot.height-y);
      const words=spool.readPlaneRows(plane,y,rows);
      controller.enqueue(new Uint8Array(words.buffer,words.byteOffset,words.byteLength));
      y+=rows;
      if(y===snapshot.height){y=0;planeIndex++;}
    }
  });
  const stream=format==='deflate'?input.pipeThrough(new CompressionStream('deflate')):input;
  return archiveMetadata(snapshot,await new Response(stream).blob(),format);
}


function bandBounds(snapshot,spool,visibleRows){
  const {height,stride,width}=snapshot,lo=new Int32Array(height),hi=new Int32Array(height);
  lo.fill(-1);hi.fill(width-1);
  let first=-1;
  const lastWord=Math.ceil(width/32)-1;
  const endMask=width%32?0xffffffff>>>(32-width%32):0xffffffff;
  for(let y=0;y<visibleRows;y+=stripeRows){
    const rows=Math.min(stripeRows,visibleRows-y);
    const bits=spool.readPlaneRows('bits',y,rows),present=spool.readPlaneRows('present',y,rows);
    for(let i=0;i<rows;i++){
      const row=y+i,base=i*stride;
      const zeroWord=word=>present[base+word]&~bits[base+word]&(word===lastWord?endMask:0xffffffff);
      for(let word=0;word<=lastWord;word++){
        const zero=zeroWord(word);
        if(!zero)continue;
        lo[row]=word*32+31-Math.clz32(zero&-zero);
        if(first<0)first=row;
        break;
      }
      if(lo[row]<0)continue;
      for(let word=lastWord;word>=0;word--){
        const zero=zeroWord(word);
        if(zero){hi[row]=word*32+31-Math.clz32(zero);break;}
      }
    }
  }
  if(first<0)return {};
  for(let row=0;row<visibleRows;row++){
    if(lo[row]>=0)continue;
    const from=row<first?first:row-1;
    lo[row]=lo[from];hi[row]=hi[from];
  }
  return {rowLo:lo,rowHi:hi};
}

function catalogEngine(){
  if(!self.MayatnikLargeSnakeCatalog)importScripts('mayatnik-large-snake-catalog.js?v=1001');
  return self.MayatnikLargeSnakeCatalog;
}

async function searchFrame(spool,{options,snake,archive,catalog,query},progress){
  const snapshot=spool.snapshot;
  if(query){
    const result=await catalogEngine().query(query.method,query.catalog,{...query.options,snapshot},{worker:false,onProgress:progress});
    return {result};
  }
  if(catalog){
    const mask=catalog.search.withoutBands?bandBounds(snapshot,spool,catalog.search.bounds.height):null;
    const result=catalogEngine().compile({...catalog,snapshot,search:{...catalog.search,...mask}},progress);
    if(!result.complete)throw Error('Кадр проверен не полностью');
    progress({phase:'archive'});
    return {result,archive:await archiveFrame(snapshot,spool)};
  }
  if(snake&&!self.MayatnikLargeSnake){
    importScripts('mayatnik-large-snake.js?v=1001');
    self.onmessage=receive;
  }
  const engine=snake?self.MayatnikLargeSnake:self.MayatnikLargeSearch;
  const mask=options.withoutBands?bandBounds(snapshot,spool,options.bounds.height):null;
  const result=engine.search(snapshot,{...options,...mask},progress);
  let saved,archiveError;
  if(archive&&result.complete&&result.found.length){
    progress({phase:'archive'});
    try{saved=await archiveFrame(snapshot,spool);}
    catch(error){archiveError=error.message||String(error);}
  }
  const {typeRuns,...visible}=result;
  return {result:visible,archive:saved,archiveError};
}

async function handle(message){
  switch(message.type){
    case 'begin':{
      if(session)throw Error('Поиск по полосам уже запущен');
      const spool=await MayatnikPackedSpool.open(message.name,message.header);
      session={spool,request:message.request,archived:message.archived};
      self.postMessage({type:'ready'});
      return;
    }
    case 'strip':{
      if(!session||session.archived)throw Error('Нет активного потока GPU-полос');
      await session.spool.append(message.strip);
      self.postMessage({type:'ack',y:message.strip.y});
      return;
    }
    case 'run':{
      if(!session)throw Error('Нет подготовленного снимка для поиска');
      const {spool,request,archived}=session,progress=value=>self.postMessage({progress:value});
      if(archived){
        let loaded=0;
        await MayatnikPackedArchive.read(archived,async strip=>{
          await spool.appendPlane(strip);loaded+=strip.rows;
          progress({phase:'restore',done:loaded,total:archived.height*2});
        });
      }
      await spool.finish();
      const result=await searchFrame(spool,request,progress);
      await spool.close();
      session=null;
      self.postMessage(result);
      return;
    }
    default:throw Error('Неизвестное действие поиска по полосам');
  }
}
function receive({data}){
  queue=queue.then(()=>handle(data)).catch(async error=>{
    const spool=session?.spool;
    session=null;
    if(spool)try{await spool.close();}catch(_){}
    self.postMessage({error:error.message||String(error)});
  });
}
self.onmessage=receive;
