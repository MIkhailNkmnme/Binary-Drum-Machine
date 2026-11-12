/* Temporary tiled OPFS storage for exact packed-field search in a dedicated
 * worker. The original field is never assembled in RAM. Each plane is fed in
 * sequential row strips; plane order and strip heights may differ.
 *
 * Host names: mayatnik-spool-<unique>.bin
 * OPFS directory: mayatnik-packed-spool-v1
 * On forced worker termination the host must remove that exact name from that
 * directory. No automatic sweeping: another worker may own an older file.
 */
(function(root,factory){
  const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikPackedSpool=api;
})(typeof globalThis==='object'?globalThis:this,function(root){
  'use strict';
  const DIRECTORY='mayatnik-packed-spool-v1';
  const NAME_PATTERN=/^mayatnik-spool-[A-Za-z0-9_-]{1,160}\.bin$/;
  const TILE_ROWS=128,TILE_WORDS=16,PLANE_WORDS=TILE_ROWS*TILE_WORDS,PLANE_BYTES=PLANE_WORDS*4;
  const TILE_BYTES=2*PLANE_BYTES,HEADER_BYTES=4096,CACHE_BYTES=16*1048576;
  const PLANE_NAMES=['bits','present'];

  function planeNumber(plane){
    if(plane==='bits')return 0;if(plane==='present')return 1;
    throw new RangeError('Плоскость снимка должна быть bits или present.');
  }
  function validInteger(value,min=0){return Number.isSafeInteger(value)&&value>=min;}
  function geometry({width,height,stride}={}){
    if(!validInteger(width,1)||!validInteger(height,1)||!validInteger(stride,1)||stride<Math.ceil(width/32)||
      !Number.isSafeInteger(width*height)||!Number.isSafeInteger(stride*height))throw new RangeError('Некорректная геометрия упакованного снимка.');
    const tileColumns=Math.ceil(stride/TILE_WORDS),tileRows=Math.ceil(height/TILE_ROWS),tileCount=tileColumns*tileRows;
    const fileBytes=HEADER_BYTES+tileCount*TILE_BYTES;
    if(!Number.isSafeInteger(tileCount)||!Number.isSafeInteger(fileBytes))throw new RangeError('Слишком большой временный снимок.');
    return {width,height,stride,tileColumns,tileRows,tileCount,fileBytes};
  }

  /**
   * open(name,{width,height,stride}) -> Promise<spool>
   * append({y,rows,bits,present}) -> Promise<void>
   * appendPlane({plane,y,rows,data}) -> Promise<void>
   * finish() -> Promise<snapshot>, only after BOTH complete planes
   * snapshot.readValue(r,c) -> -1 | 0 | 1, synchronous after finish()
   * readPlaneRows(plane,start,rows) -> Uint32Array, synchronous after finish()
   * close() -> Promise<void>, closes and removes this spool only
   *
   * Input/output row stride is the ORIGINAL GPU stride, including padding.
   * No 128-row alignment is required. readPlaneRows allocates only the rows
   * requested by its caller; callers should keep archive strips bounded.
   */
  async function open(name,dimensions){
    if(typeof name!=='string'||!NAME_PATTERN.test(name))throw new RangeError('Недопустимое имя временного снимка Маятника.');
    const g=geometry(dimensions);
    if(typeof root.DedicatedWorkerGlobalScope==='undefined'||!(root instanceof root.DedicatedWorkerGlobalScope)||
      !root.navigator?.storage?.getDirectory)throw new Error('Временный снимок OPFS доступен только в dedicated worker.');
    const directory=await (await root.navigator.storage.getDirectory()).getDirectoryHandle(DIRECTORY,{create:true});
    try{
      await directory.getFileHandle(name);
      throw new Error('Временный снимок с таким именем уже существует; нужно новое уникальное имя.');
    }catch(error){if(error?.name!=='NotFoundError')throw error;}
    const file=await directory.getFileHandle(name,{create:true});
    if(typeof file.createSyncAccessHandle!=='function')throw new Error('Браузер не поддерживает синхронное чтение OPFS в worker.');
    // A unique host-generated name and the exclusive access handle prevent
    // concurrent owners. Never truncate or delete a pre-existing spool.
    const access=await file.createSyncAccessHandle();
    if(access.getSize()!==0){access.close();throw new Error('Временный файл уже содержит данные; снимок не перезаписан.');}

    const cache=new Map(),initialized=new Uint8Array(Math.ceil(g.tileCount*2/8));
    const received=[0,0],createdAt=Date.now();
    let cacheBytes=0,finished=false,closed=false,failed=null,closing=null;
    let bytesRead=0,bytesWritten=0;
    function ensureOpen(){if(closed)throw new Error('Временный снимок уже закрыт.');if(failed)throw failed;}
    function ensureFinished(){ensureOpen();if(!finished)throw new Error('Обе плоскости временного снимка ещё не приняты полностью.');}
    function fail(error){failed=error instanceof Error?error:new Error(String(error));throw failed;}
    function marked(key){return !!(initialized[Math.floor(key/8)]&(1<<(key&7)));}
    function mark(key){initialized[Math.floor(key/8)]|=1<<(key&7);}
    function pageOffset(key){return HEADER_BYTES+Math.floor(key/2)*TILE_BYTES+(key%2)*PLANE_BYTES;}
    function writeAll(bytes,at){
      let offset=0;
      while(offset<bytes.byteLength){
        const n=access.write(bytes.subarray(offset),{at:at+offset});
        if(!validInteger(n,1)||n>bytes.byteLength-offset)throw new Error('Не удалось полностью записать плитку OPFS.');
        offset+=n;bytesWritten+=n;
      }
    }
    function readAll(bytes,at){
      let offset=0;
      while(offset<bytes.byteLength){
        const n=access.read(bytes.subarray(offset),{at:at+offset});
        if(!validInteger(n,1)||n>bytes.byteLength-offset)throw new Error('Временная плитка OPFS повреждена или прочитана не полностью.');
        offset+=n;bytesRead+=n;
      }
    }
    function flushEntry(entry){
      if(!entry.dirty)return;
      writeAll(new Uint8Array(entry.data.buffer),pageOffset(entry.key));
      mark(entry.key);entry.dirty=false;
    }
    function page(tile,plane){
      const key=tile*2+plane,old=cache.get(key);
      if(old){cache.delete(key);cache.set(key,old);return old;}
      while(cacheBytes+PLANE_BYTES>CACHE_BYTES){
        const [oldKey,entry]=cache.entries().next().value;
        flushEntry(entry);cache.delete(oldKey);cacheBytes-=PLANE_BYTES;
      }
      const data=new Uint32Array(PLANE_WORDS);
      if(marked(key))readAll(new Uint8Array(data.buffer),pageOffset(key));
      else if(finished)throw new Error('В завершённом снимке отсутствует плитка.');
      const entry={key,data,dirty:false};cache.set(key,entry);cacheBytes+=PLANE_BYTES;return entry;
    }
    function header(complete){
      const bytes=new Uint8Array(HEADER_BYTES),metadata=new TextEncoder().encode(JSON.stringify({
        magic:'mayatnik-packed-spool',version:1,name,width:g.width,height:g.height,stride:g.stride,
        tileRows:TILE_ROWS,tileWords:TILE_WORDS,tileColumns:g.tileColumns,fileBytes:g.fileBytes,
        createdAt,updatedAt:Date.now(),received:{bits:received[0],present:received[1]},complete
      }));
      if(metadata.length>=HEADER_BYTES)throw new Error('Заголовок снимка OPFS слишком велик.');
      bytes.set(metadata);writeAll(bytes,0);
    }
    function validateAppend(plane,y,rows,data){
      ensureOpen();if(finished)throw new Error('Завершённый снимок нельзя дописывать.');
      if(!validInteger(y)||!validInteger(rows,1)||y!==received[plane]||y+rows>g.height)
        throw new RangeError('Полосы '+PLANE_NAMES[plane]+' должны идти подряд от строки 0 без пропусков и повторов.');
      if(!(data instanceof Uint32Array)||data.length!==rows*g.stride)throw new RangeError('Размер полосы '+PLANE_NAMES[plane]+' не совпадает с исходным GPU stride.');
    }
    function writePlane(plane,y,rows,data){
      for(let stripRow=0;stripRow<rows;){
        const row=y+stripRow,tileRow=Math.floor(row/TILE_ROWS),localRow=row%TILE_ROWS,count=Math.min(rows-stripRow,TILE_ROWS-localRow);
        for(let tx=0;tx<g.tileColumns;tx++){
          const word=tx*TILE_WORDS,wordCount=Math.min(TILE_WORDS,g.stride-word),entry=page(tileRow*g.tileColumns+tx,plane);
          for(let dy=0;dy<count;dy++){
            const from=(stripRow+dy)*g.stride+word;
            entry.data.set(data.subarray(from,from+wordCount),(localRow+dy)*TILE_WORDS);
          }
          entry.dirty=true;
        }
        stripRow+=count;
      }
      received[plane]+=rows;
    }
    async function appendPlane({plane,y,rows,data}={}){
      const p=planeNumber(plane);validateAppend(p,y,rows,data);
      try{writePlane(p,y,rows,data);}catch(error){fail(error);}
    }
    async function append({y,rows,bits,present}={}){
      // Validate both inputs first. A malformed second plane must not consume
      // the first one's row range and leave an apparently retryable strip.
      validateAppend(0,y,rows,bits);validateAppend(1,y,rows,present);
      try{writePlane(0,y,rows,bits);writePlane(1,y,rows,present);}catch(error){fail(error);}
    }
    let lastTile=-1,lastPresent=null,lastBits=null;
    function readValue(r,c){
      ensureFinished();
      if(!Number.isInteger(r)||!Number.isInteger(c)||r<0||c<0||r>=g.height||c>=g.width)return -1;
      const word=Math.floor(c/32),tile=Math.floor(r/TILE_ROWS)*g.tileColumns+Math.floor(word/TILE_WORDS),at=(r%TILE_ROWS)*TILE_WORDS+word%TILE_WORDS,shift=c&31;
      try{
        if(tile!==lastTile){lastPresent=page(tile,1).data;lastBits=null;lastTile=tile;}
        if(!(lastPresent[at]>>>shift&1))return -1;
        lastBits??=page(tile,0).data;
        return lastBits[at]>>>shift&1;
      }catch(error){return fail(error);}
    }
    const snapshot=Object.freeze({width:g.width,height:g.height,stride:g.stride,readValue});
    async function finish(){
      ensureOpen();if(finished)return snapshot;
      if(received[0]!==g.height||received[1]!==g.height)throw new Error('Снимок неполон: bits '+received[0]+'/'+g.height+', present '+received[1]+'/'+g.height+'.');
      try{
        for(const entry of cache.values())flushEntry(entry);
        for(let key=0;key<g.tileCount*2;key++)if(!marked(key))throw new Error('Геометрия снимка неполна: отсутствует плитка.');
        if(access.getSize()!==g.fileBytes)throw new Error('Размер файла снимка не совпадает с полной геометрией.');
        header(true);access.flush();finished=true;return snapshot;
      }catch(error){return fail(error);}
    }
    function readPlaneRows(plane,start,rows){
      ensureFinished();lastTile=-1;lastPresent=lastBits=null;
      const p=planeNumber(plane);
      if(!validInteger(start)||!validInteger(rows)||start+rows>g.height)throw new RangeError('Строки чтения выходят за снимок.');
      const out=new Uint32Array(rows*g.stride);
      try{
        for(let destRow=0;destRow<rows;){
          const row=start+destRow,tileRow=Math.floor(row/TILE_ROWS),localRow=row%TILE_ROWS,count=Math.min(rows-destRow,TILE_ROWS-localRow);
          for(let tx=0;tx<g.tileColumns;tx++){
            const word=tx*TILE_WORDS,wordCount=Math.min(TILE_WORDS,g.stride-word),entry=page(tileRow*g.tileColumns+tx,p);
            for(let dy=0;dy<count;dy++){
              const from=(localRow+dy)*TILE_WORDS;
              out.set(entry.data.subarray(from,from+wordCount),(destRow+dy)*g.stride+word);
            }
          }
          destRow+=count;
        }
        return out;
      }catch(error){return fail(error);}
    }
    function close(){
      if(closing)return closing;
      closed=true;cache.clear();cacheBytes=0;
      closing=(async()=>{
        let closeError=null;try{access.close();}catch(error){closeError=error;}
        try{await directory.removeEntry(name);}catch(error){if(error?.name!=='NotFoundError')throw error;}
        if(closeError)throw closeError;
      })();
      return closing;
    }
    try{header(false);access.flush();}
    catch(error){try{await close();}catch(_){}throw error;}
    return {name,directory:DIRECTORY,append,appendPlane,finish,snapshot,readPlaneRows,close,
      stats:()=>({received:{bits:received[0],present:received[1]},complete:finished,closed,cacheBytes,cacheLimit:CACHE_BYTES,
        tileRows:TILE_ROWS,tileWords:TILE_WORDS,fileBytes:g.fileBytes,bytesRead,bytesWritten})};
  }
  return {open,DIRECTORY,TILE_ROWS,TILE_WORDS,CACHE_BYTES};
});
