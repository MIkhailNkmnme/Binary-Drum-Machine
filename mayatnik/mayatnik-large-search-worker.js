/* Run exact large-field search and freeze successful frames for the journal. */
'use strict';
importScripts('mayatnik-large-search.js?v=1000-dev3');

async function archiveFrame({width,height,stride,bits,present}){
  const format=typeof CompressionStream==='function'?'deflate':'raw';
  let blob;
  if(format==='deflate'){
    const planes=[bits,present];
    let plane=0,offset=0;
    const input=new ReadableStream({
      pull(controller){
        const words=planes[plane];
        if(!words){controller.close();return;}
        const size=Math.min(262144,words.length-offset);
        controller.enqueue(new Uint8Array(words.buffer,words.byteOffset+offset*4,size*4));
        offset+=size;
        if(offset===words.length){plane++;offset=0;}
      }
    });
    blob=await new Response(input.pipeThrough(new CompressionStream('deflate'))).blob();
  }else blob=new Blob([bits,present]);
  return {kind:'packed-ochki-v1',format,width,height,stride,blob};
}

// «Без полос»: use the first and last present zero of each source row.
function bandBounds({height,stride,width,bits,present},visibleRows){
  const lo=new Int32Array(height),hi=new Int32Array(height);
  lo.fill(-1);hi.fill(width-1);
  let first=-1;
  const lastWord=Math.ceil(width/32)-1;
  const endMask=width%32?0xffffffff>>>(32-width%32):0xffffffff;
  for(let row=0;row<visibleRows;row++){
    const base=row*stride;
    for(let word=0;word<=lastWord;word++){
      const zero=present[base+word]&~bits[base+word]&(word===lastWord?endMask:0xffffffff);
      if(zero){
        lo[row]=word*32+31-Math.clz32(zero&-zero);
        if(first<0)first=row;
        break;
      }
    }
    if(lo[row]<0)continue;
    for(let word=lastWord;word>=0;word--){
      const zero=present[base+word]&~bits[base+word]&(word===lastWord?endMask:0xffffffff);
      if(zero){hi[row]=word*32+31-Math.clz32(zero);break;}
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

async function runSearch({data:{snapshot,options,snake,archive,catalog}}){
  const progress=value=>self.postMessage({progress:value});
  try{
    if(catalog){
      importScripts('mayatnik-large-snake-catalog.js?v=1000-dev3');
      self.onmessage=runSearch;
      const mask=catalog.search.withoutBands?bandBounds(snapshot,catalog.search.bounds.height):null;
      const result=self.MayatnikLargeSnakeCatalog.compile({...catalog,snapshot,search:{...catalog.search,...mask}},progress);
      if(!result.complete)throw Error('Кадр проверен не полностью');
      progress({phase:'archive'});
      self.postMessage({result,archive:await archiveFrame(snapshot)});
      return;
    }
    if(snake&&!self.MayatnikLargeSnake){
      importScripts('mayatnik-large-snake.js?v=1000-dev2');
      self.onmessage=runSearch;
    }
    const engine=snake?self.MayatnikLargeSnake:self.MayatnikLargeSearch;
    const mask=options.withoutBands?bandBounds(snapshot,options.bounds.height):null;
    const result=engine.search(snapshot,{...options,...mask},progress);
    let saved,archiveError;
    if(archive&&result.complete&&result.found.length){
      progress({phase:'archive'});
      try{saved=await archiveFrame(snapshot);}
      catch(error){archiveError=error.message||String(error);}
    }
    const {typeRuns,...visible}=result;
    self.postMessage({result:visible,archive:saved,archiveError});
  }catch(error){
    self.postMessage({error:error.message||String(error)});
  }
}
self.onmessage=runSearch;
