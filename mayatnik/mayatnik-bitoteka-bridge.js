/* Native Mayatnik records copied into the shared, local Zerkalius Bitoteka. */
(function(root){
  'use strict';
  const LEDGER='zerk_mayatnik_bitoteka_sync_v1',PREFIX='mayatnik:template:';
  function create(host){
    const storage=host.storage||root.localStorage,source=structuredClone(host.source||{name:'Маятник',page:location.href});
    const frameIds=new WeakMap();let queue=Promise.resolve(),pending=queue;
    const report=error=>{try{host.onError?.(error);}catch(_){}return error;};
    const enqueue=action=>{const job=queue.then(action).catch(error=>{throw report(error);});queue=job.catch(()=>{});pending=job;return job;};
    async function api(){const value=host.api();if(!value?.save||!value?.remove)throw Error('Битотека ещё не подключена. Повторите сохранение.');if(value.readyPromise)await value.readyPromise;return value;}
    function openUrl(id){const url=new URL(source.page||location.href,location.href);url.hash='bitoteka='+encodeURIComponent(id);return url.href;}
    function loadLedger(){
      const saved=storage.getItem(LEDGER);if(saved==null)return {version:1,entries:{}};
      let data;try{data=JSON.parse(saved);}catch(_){throw Error('Не удалось прочитать связь шаблонов с Битотекой. Исходная библиотека сохранена.');}
      if(data?.version!==1||!data.entries||typeof data.entries!=='object'||Array.isArray(data.entries))throw Error('Неизвестный формат связи шаблонов с Битотекой');
      for(const [nativeId,item] of Object.entries(data.entries))if(!nativeId||!item||item.id!==PREFIX+nativeId||typeof item.hash!=='string'||!/^[0-9a-f]{64}$/.test(item.hash))throw Error('Повреждена связь шаблонов с Битотекой');
      return data;
    }
    function writeLedger(ledger){storage.setItem(LEDGER,JSON.stringify(ledger));}
    async function hash(text){if(!root.crypto?.subtle)throw Error('Для сохранения шаблонов откройте Маятник по защищённому адресу сайта.');
      const digest=await root.crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');}
    // At most 96 x 96 sampled cells, independent of the native mask's area.
    // Runs of filled samples become safe numeric SVG rectangles, never user markup.
    function thumbnail(shape){
      const parts=shape?.parts;if(!Array.isArray(parts)||!parts.length)return null;
      const valid=parts.filter(p=>Number.isSafeInteger(p.width)&&p.width>0&&Number.isSafeInteger(p.height)&&p.height>0&&p.data&&p.data.length===p.width*p.height);
      if(!valid.length)return null;
      const totalHeight=valid.reduce((n,p)=>n+p.height,0),maxWidth=Math.max(...valid.map(p=>p.width));
      if(!Number.isSafeInteger(totalHeight))return null;
      const profile=shape.palette,styled=profile?.collection==='Kraftwerk'&&['background','light','dark'].every(key=>/^#[0-9a-f]{6}$/i.test(profile[key]||''));
      const scale=Math.min(1,96/maxWidth,96/totalHeight),W=Math.max(1,Math.ceil(maxWidth*scale)),H=Math.max(1,Math.ceil(totalHeight*scale)),rectangles=[],coloured=[];
      for(let y=0;y<H;y++){
        const sy=Math.min(totalHeight-1,Math.floor((y+.5)/scale));let offset=0,part=valid[0];
        for(const candidate of valid){part=candidate;if(sy<offset+candidate.height)break;offset+=candidate.height;}
        let start=-1;for(let x=0;x<=W;x++){
          const sx=Math.floor((x+.5)/scale),colour=x<W&&sx<part.width?Number(part.data[Math.min(part.height-1,sy-offset)*part.width+sx]):0;
          const filled=Number.isInteger(colour)&&colour>0&&colour<=0xffffffff;
          if(styled&&filled){const hex='#'+[colour&255,(colour>>>8)&255,(colour>>>16)&255].map(v=>v.toString(16).padStart(2,'0')).join('');coloured.push('<rect x="'+(x+2)+'" y="'+(y+2)+'" width="1" height="1" fill="'+hex+'"/>');}
          if(filled&&start<0)start=x;
          if(!filled&&start>=0){rectangles.push('<rect x="'+(start+2)+'" y="'+(y+2)+'" width="'+(x-start)+'" height="1"/>');start=-1;}
        }
      }
      const decoration=styled?'<g fill="'+profile.light+'" transform="translate('+(-.22*scale)+' '+(-.22*scale)+')">'+rectangles.join('')+'</g><g fill="'+profile.dark+'" transform="translate('+(.28*scale)+' '+(.28*scale)+')">'+rectangles.join('')+'</g>':'';
      return new Blob(['<svg xmlns="http://www.w3.org/2000/svg" width="'+(W+4)+'" height="'+(H+4)+'" viewBox="0 0 '+(W+4)+' '+(H+4)+'"><rect width="100%" height="100%" fill="'+(styled?profile.background:'#edf1f4')+'"/>'+decoration+'<g fill="#111820" shape-rendering="crispEdges">'+(styled?coloured.join(''):rectangles.join(''))+'</g></svg>'],{type:'image/svg+xml'});
    }
    function syncTemplates(entries){
      // Capture the call's catalog before queuing: later edits cannot change a
      // pending write's payload or silently make its ledger hash describe another edit.
      let copies;try{
        if(!Array.isArray(entries))throw Error('Список шаблонов недоступен');const seen=new Set();
        copies=entries.map(entry=>{if(!entry||typeof entry.id!=='string'||!entry.id||seen.has(entry.id))throw Error('Повторяется или отсутствует идентификатор шаблона');seen.add(entry.id);
          const text=JSON.stringify({format:'mayatnik-templates',version:1,templates:[entry]});return {id:entry.id,text};});
      }catch(error){return enqueue(()=>{throw error;});}
      return enqueue(async()=>{
        const library=await api(),ledger=loadLedger(),present=new Set(copies.map(item=>item.id));let saved=0,removed=0,unchanged=0;
        for(const copy of copies){
          const fingerprint=await hash(copy.text),previous=ledger.entries[copy.id];
          if(previous&&previous.hash===fingerprint){unchanged++;continue;}
          const entry=JSON.parse(copy.text).templates[0],id=PREFIX+copy.id,folder=entry.folder||'Шаблоны';
          await library.save({id,kind:'template',name:String(entry.name||'Шаблон'),filename:String(entry.name||'Шаблон')+'.template.json',blob:new Blob([copy.text],{type:'application/json'}),thumbnail:thumbnail(entry.shape),source,
            meta:{nativeId:entry.id,folder,openUrl:openUrl(id),...(entry.shape?.palette?.collection==='Kraftwerk'?{collection:'Kraftwerk',paletteName:entry.shape.palette.name,sourceImage:entry.shape.palette.source}:{})}});
          // Only successful writes enter the ledger. An unchanged native item
          // intentionally stays absent if the user later removes its shared copy.
          Object.defineProperty(ledger.entries,copy.id,{value:{id,hash:fingerprint},enumerable:true,configurable:true,writable:true});writeLedger(ledger);saved++;
        }
        for(const nativeId of Object.keys(ledger.entries))if(!present.has(nativeId)){
          await library.remove(ledger.entries[nativeId].id);delete ledger.entries[nativeId];writeLedger(ledger);removed++;
        }
        return {saved,removed,unchanged};
      });
    }
    function saveFrame(snapshot){
      let request;try{
        if(!snapshot||!(snapshot.blob instanceof Blob))throw Error('Нет готового файла кадра');
        let id=frameIds.get(snapshot);if(!id){id='mayatnik:frame:'+(snapshot.id!=null?String(snapshot.id):root.crypto.randomUUID());frameIds.set(snapshot,id);}
        request={id,blob:snapshot.blob,thumbnail:snapshot.thumbnail,name:String(snapshot.name||'Кадр '+(snapshot.frame??'')),frame:snapshot.frame,rows:snapshot.rows};
      }catch(error){return enqueue(()=>{throw error;});}
      return enqueue(async()=>{
        const library=await api();let image=null;
        if(request.thumbnail instanceof Blob)image=request.thumbnail;
        else if(typeof request.thumbnail==='string'&&request.thumbnail){
          if(!/^data:image\/[a-z0-9.+-]+[;,]/i.test(request.thumbnail))throw Error('Некорректная миниатюра кадра');
          const response=await fetch(request.thumbnail);if(!response.ok)throw Error('Не удалось прочитать миниатюру кадра');image=await response.blob();
        }
        return library.save({id:request.id,kind:'frame',name:request.name,blob:request.blob,thumbnail:image,source,
          meta:{frame:request.frame,rows:request.rows,openUrl:openUrl(request.id)}});
      });
    }
    return {syncTemplates,saveFrame,idle:()=>pending};
  }
  root.MayatnikBitotekaBridge={create};
})(window);
