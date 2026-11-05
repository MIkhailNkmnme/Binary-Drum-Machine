/* One local Zerkalius library shared by every page on the same origin. */
(function(root){
  'use strict';
  if(root.ZerkBitoteka)return;
  const DB_NAME='zerkalius-bitoteka',CHANNEL='zerkalius-bitoteka-change',KINDS=['video','gif','image','template','frame','work'];
  const LABELS={video:'Видео',gif:'GIF',image:'Изображения',template:'Шаблоны',frame:'Кадры',work:'Работы'};
  const script=document.currentScript,base=new URL('./',script?.src||location.href),listeners=new Set(),recent=new Set();
  let database=null,opening=null,channel=null,view=null,viewSerial=0,filter='',folder='',sourceImport=null,observer=null,retryAction=null,lastError='',returnFocus=null;
  const previewUrls=new Set();
  const uid=()=>root.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)+'-'+Math.random().toString(36).slice(2);
  function stylesheet(){
    const href=new URL('bitoteka.css?v=2',base).href;
    if([...document.querySelectorAll('link[rel="stylesheet"]')].some(link=>link.href===href))return;
    const link=document.createElement('link');link.rel='stylesheet';link.href=href;document.head.appendChild(link);
  }
  stylesheet();
  function db(){
    if(database)return Promise.resolve(database);if(opening)return opening;
    opening=new Promise((resolve,reject)=>{
      if(!root.indexedDB){reject(Error('Хранилище браузера недоступно. Разрешите сохранение данных сайта и повторите.'));return;}
      let request,settled=false;
      const fail=error=>{if(settled)return;settled=true;reject(error||Error('Не удалось открыть Битотеку'));};
      try{request=indexedDB.open(DB_NAME,2);}catch(error){fail(error);return;}
      request.onupgradeneeded=()=>{const store=request.result;
        if(!store.objectStoreNames.contains('entries')){const entries=store.createObjectStore('entries',{keyPath:'id'});entries.createIndex('kind','kind');}
        if(!store.objectStoreNames.contains('payloads'))store.createObjectStore('payloads',{keyPath:'id'});
        if(!store.objectStoreNames.contains('sourceImports'))store.createObjectStore('sourceImports',{keyPath:'id'});
      };
      request.onerror=()=>fail(request.error);
      request.onblocked=()=>fail(Error('Закройте старые вкладки Битотеки и повторите открытие.'));
      request.onsuccess=()=>{if(settled){request.result.close();return;}settled=true;database=request.result;
        database.onversionchange=()=>{database?.close();database=null;opening=null;};resolve(database);};
    }).catch(error=>{opening=null;throw error;});
    return opening;
  }
  async function transaction(stores,mode,run){
    const store=await db();return new Promise((resolve,reject)=>{
      let tx,result;try{tx=store.transaction(stores,mode);result=run(tx);}catch(error){reject(error);return;}
      tx.oncomplete=()=>resolve(typeof result==='function'?result():result);
      tx.onabort=()=>reject(tx.error||Error('Сохранение прервано; повторите действие.'));
      tx.onerror=()=>{}; // The transaction abort supplies the complete failure.
    });
  }
  function notify(event){
    if(!event||typeof event.token!=='string'||recent.has(event.token))return;
    recent.add(event.token);if(recent.size>64)recent.delete(recent.values().next().value);
    for(const fn of listeners){try{fn(event);}catch(error){console.error(error);}}
    if(view?.dialog.open)render();
  }
  function changed(type,id){
    const event={token:uid(),type,id,at:Date.now()};notify(event);
    try{channel?.postMessage(event);}catch(_){}
    try{localStorage.setItem(CHANNEL,JSON.stringify(event));}catch(_){}
  }
  try{channel=new BroadcastChannel(CHANNEL);channel.onmessage=event=>notify(event.data);}catch(_){}
  root.addEventListener('storage',event=>{if(event.key!==CHANNEL||!event.newValue)return;try{notify(JSON.parse(event.newValue));}catch(_){}});
  const extension=(kind,type)=>kind==='gif'?'.gif':type==='video/mp4'?'.mp4':type.startsWith('video/')?'.webm':type==='image/jpeg'?'.jpg':type==='image/webp'?'.webp':type.startsWith('image/')?'.png':['template','frame','work'].includes(kind)?'.json':'.bin';
  function filename(input){
    const name=String(input.filename||input.name||'Битотека').replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').trim()||'Битотека';
    return /\.[a-z0-9]{1,8}$/i.test(name)?name:name+extension(input.kind,input.blob.type);
  }
  function message(error){return error?.name==='QuotaExceededError'?'Недостаточно места в браузере. Скачайте нужные записи, освободите место и повторите сохранение.':error?.message||String(error);}
  function showError(error,retry){lastError=message(error);retryAction=retry||null;
    if(!document.body){document.addEventListener('DOMContentLoaded',()=>showError(error,retry),{once:true});return;}
    build();if(!view.dialog.open){returnFocus=document.activeElement;view.dialog.showModal();}paintError();
  }
  function paintError(){if(!view)return;view.error.textContent=lastError;view.error.hidden=!lastError;view.retry.hidden=!retryAction;}
  async function save(input){
    try{
      if(!input||!KINDS.includes(input.kind)||!(input.blob instanceof Blob))throw Error('Для Битотеки нужны тип записи и готовый файл.');
      if(input.thumbnail!=null&&(!(input.thumbnail instanceof Blob)||!input.thumbnail.type.startsWith('image/')))throw Error('Миниатюра должна быть файлом изображения.');
      const now=Date.now(),id=input.id==null?uid():String(input.id);
      if(!id||id.length>512)throw Error('Некорректный идентификатор записи');
      const item={id,kind:input.kind,name:String(input.name||'Без названия').slice(0,512),filename:filename(input),source:structuredClone(input.source??document.title??''),meta:structuredClone(input.meta??{}),createdAt:now,updatedAt:now,mime:input.blob.type,size:input.blob.size,hasThumbnail:!!input.thumbnail};
      await transaction(['entries','payloads'],'readwrite',tx=>{
        const entries=tx.objectStore('entries'),previous=entries.get(id);
        previous.onsuccess=()=>{if(previous.result)item.createdAt=previous.result.createdAt;entries.put(item);tx.objectStore('payloads').put({id,blob:input.blob,thumbnail:input.thumbnail||null});};
      });
      if(lastError&&!retryAction?.bitotekaSourceRetry){lastError='';retryAction=null;paintError();}changed('save',id);return structuredClone(item);
    }catch(error){showError(error,()=>save(input));throw error;}
  }
  async function list(options={}){
    const kind=options.kind;if(kind&&!KINDS.includes(kind))throw Error('Неизвестный раздел Битотеки');
    const entries=await transaction(['entries'],'readonly',tx=>{const store=tx.objectStore('entries'),request=kind?store.index('kind').getAll(kind):store.getAll();return ()=>request.result;});
    return entries.filter(item=>inFolder(item,options.folder)).sort((a,b)=>b.createdAt-a.createdAt||String(a.id).localeCompare(String(b.id)));
  }
  // Collections are independent of media kinds. Source collections include their files.
  function inFolder(item,value){
    if(!value||value==='Все')return true;
    if(value==='Kraftwerk')return item.meta?.collection==='Kraftwerk'||item.meta?.folder==='Kraftwerk';
    const path=String(item.meta?.folder||'');return path===value||path.startsWith(value+'/');
  }
  async function importProjectSources(){
    if(sourceImport)return sourceImport;
    sourceImport=(async()=>{
      const catalogUrl=new URL('../sources/kraftwerk/catalog.json',base),response=await fetch(catalogUrl,{cache:'no-cache'});
      if(!response.ok)throw Error('Каталог источников: HTTP '+response.status);
      const catalog=await response.json();
      if(!catalog||!Array.isArray(catalog.entries)||!Number.isInteger(catalog.version)||catalog.version<1)throw Error('Некорректный каталог источников');
      const failures=[];
      for(const entry of catalog.entries){
        try{
          if(!entry||typeof entry.id!=='string'||!entry.id||entry.id.length>512||!KINDS.includes(entry.kind)||typeof entry.url!=='string')throw Error('Некорректная запись каталога');
          const id=entry.id;
          const known=await transaction(['entries','sourceImports'],'readwrite',tx=>{
            const records=tx.objectStore('entries'),ledger=tx.objectStore('sourceImports'),seen=ledger.get(id),existing=records.get(id);
            let skip=false;
            existing.onsuccess=()=>{skip=!!seen.result||!!existing.result;if(existing.result&&!seen.result)ledger.put({id,version:catalog.version,at:Date.now()});};
            return ()=>skip;
          });
          if(known)continue;
          const assetUrl=new URL(entry.url,catalogUrl);
          if(!['http:','https:'].includes(assetUrl.protocol)||assetUrl.origin!==catalogUrl.origin)throw Error('Недопустимый адрес файла источника');
          const asset=await fetch(assetUrl);if(!asset.ok)throw Error('Файл источника: HTTP '+asset.status);
          const blob=await asset.blob();if(!blob.size)throw Error('Пустой файл источника');
          const now=Date.now(),meta=structuredClone(entry.meta||{});
          if(typeof meta.openUrl==='string')meta.openUrl=new URL(meta.openUrl,catalogUrl).href;
          const source=structuredClone(entry.source||{name:'Kraftwerk'});
          if(source&&typeof source==='object'&&typeof source.page==='string')source.page=new URL(source.page,catalogUrl).href;
          const item={id,kind:entry.kind,name:String(entry.name||'Без названия').slice(0,512),filename:filename({...entry,blob}),source,meta,createdAt:now,updatedAt:now,mime:blob.type,size:blob.size,hasThumbnail:false};
          const added=await transaction(['entries','payloads','sourceImports'],'readwrite',tx=>{
            const records=tx.objectStore('entries'),ledger=tx.objectStore('sourceImports'),seen=ledger.get(id),existing=records.get(id);let written=false;
            existing.onsuccess=()=>{
              if(seen.result)return;
              if(!existing.result){records.put(item);tx.objectStore('payloads').put({id,blob,thumbnail:null});written=true;}
              ledger.put({id,version:catalog.version,at:now});
            };return ()=>written;
          });
          if(added)changed('save',id);
        }catch(error){failures.push(String(entry?.name||entry?.id||'Источник')+': '+message(error));}
      }
      if(failures.length)throw Error('Не все источники добавлены. '+failures.join('\n'));
    })().catch(error=>{sourceImport=null;throw error;});
    return sourceImport;
  }
  async function refreshSources(){
    try{await importProjectSources();if(retryAction?.bitotekaSourceRetry){retryAction=null;lastError='';paintError();}await render();}
    catch(error){lastError=message(error);retryAction=()=>refreshSources();retryAction.bitotekaSourceRetry=true;paintError();}
  }
  async function get(id){return transaction(['entries','payloads'],'readonly',tx=>{
    const entry=tx.objectStore('entries').get(String(id)),payload=tx.objectStore('payloads').get(String(id));
    return ()=>entry.result?{...entry.result,blob:payload.result?.blob||null,thumbnail:payload.result?.thumbnail||null}:null;
  });}
  async function remove(id){
    try{await transaction(['entries','payloads'],'readwrite',tx=>{tx.objectStore('entries').delete(String(id));tx.objectStore('payloads').delete(String(id));});changed('remove',String(id));return true;}
    catch(error){showError(error,()=>remove(id));throw error;}
  }
  async function download(id){
    try{const item=await get(id);if(!item?.blob)throw Error('Файл этой записи не найден');
      const url=URL.createObjectURL(item.blob),anchor=document.createElement('a');anchor.href=url;anchor.download=item.filename;anchor.hidden=true;document.body.appendChild(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);return item;
    }catch(error){showError(error,()=>download(id));throw error;}
  }
  function button(label,caption,action,small=false){
    const node=document.createElement('button');node.type='button';node.className='gz-hx zbt-button'+(small?' zbt-small':'');node.title=label;node.setAttribute('aria-label',label);
    const text=document.createElement('span');text.dataset.userLabel='';text.textContent=caption;node.appendChild(text);if(action)node.addEventListener('click',action);return node;
  }
  function releasePreviews(){observer?.disconnect();observer=null;if(view)for(const video of view.grid.querySelectorAll('video')){video.pause();video.removeAttribute('src');video.load();}
    for(const url of previewUrls)URL.revokeObjectURL(url);previewUrls.clear();}
  function close(){if(!view)return;viewSerial++;releasePreviews();view.dialog.close();if(returnFocus?.isConnected)returnFocus.focus?.();}
  function build(){
    if(view)return;const dialog=document.createElement('dialog');dialog.id='zerkBitoteka';dialog.className='zbt';dialog.setAttribute('aria-labelledby','zbt-title');
    const header=document.createElement('header'),title=document.createElement('h2');title.id='zbt-title';title.textContent='Битотека';header.appendChild(title);
    const refresh=button('Обновить Битотеку','↻',()=>render(),true),dismiss=button('Закрыть Битотеку','×',close,true);header.append(refresh,dismiss);
    const filters=document.createElement('nav');filters.className='zbt-filters';filters.setAttribute('aria-label','Разделы Битотеки');
    const captions={video:'Видео',gif:'GIF',image:'Фото',template:'Шблоны',frame:'Кадры',work:'Работы'};
    for(const kind of ['',...KINDS]){const b=button(kind?LABELS[kind]:'Все записи',kind?captions[kind]:'Все',()=>{filter=kind;render();});b.dataset.kind=kind;filters.appendChild(b);}
    const folders=document.createElement('nav');folders.className='zbt-filters zbt-folders';folders.setAttribute('aria-label','Папки и коллекции Битотеки');
    for(const value of ['','Источники','Kraftwerk']){const b=button(value||'Все папки и коллекции',value||'Все',()=>{folder=value;render();});b.dataset.folder=value;folders.appendChild(b);}
    const status=document.createElement('p');status.className='zbt-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    const error=document.createElement('p');error.className='zbt-error';error.setAttribute('role','alert');error.hidden=true;
    const retry=button('Повторить действие','↻',async()=>{const action=retryAction;if(!action)return;retry.disabled=true;try{await action();}catch(_){}finally{retry.disabled=false;}},true);retry.hidden=true;
    const grid=document.createElement('div');grid.className='zbt-grid';grid.setAttribute('aria-label','Записи Битотеки');grid.tabIndex=0;
    const footer=document.createElement('footer');footer.textContent='Общая библиотека Зеркалиуса в этом браузере.';
    dialog.append(header,folders,filters,status,error,retry,grid,footer);document.body.appendChild(dialog);view={dialog,grid,status,error,retry,filters,folders};
    dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
    // A page may use global transport shortcuts; controls inside the library own theirs.
    dialog.addEventListener('keydown',event=>event.stopPropagation());dialog.addEventListener('keyup',event=>event.stopPropagation());
    dialog.addEventListener('click',event=>event.stopPropagation());
  }
  function sourceName(source){return typeof source==='string'?source:String(source?.name||source?.title||source?.app||source?.page||'Зеркалиус');}
  const bytes=n=>n>=1048576?(n/1048576).toFixed(1)+' МБ':n>=1024?Math.ceil(n/1024)+' КБ':n+' Б';
  async function preview(card,item,serial){
    try{const payload=await get(item.id);if(serial!==viewSerial||!view?.dialog.open||!card.isConnected||!payload)return;
      const slot=card.querySelector('.zbt-preview');const url=blob=>{const value=URL.createObjectURL(blob);previewUrls.add(value);return value;};
      if(item.kind==='video'&&payload.blob){const video=document.createElement('video');video.controls=true;video.preload='metadata';video.playsInline=true;video.src=url(payload.blob);if(payload.thumbnail)video.poster=url(payload.thumbnail);video.setAttribute('aria-label',item.name);slot.replaceChildren(video);}
      else if(payload.thumbnail||(['gif','image'].includes(item.kind)&&payload.blob)){const img=document.createElement('img');img.src=url(payload.thumbnail||payload.blob);img.alt=item.name;img.loading='lazy';slot.replaceChildren(img);}
    }catch(error){if(serial===viewSerial&&card.isConnected)card.querySelector('.zbt-preview').textContent=message(error);}
  }
  async function render(){
    if(!view?.dialog.open)return;const serial=++viewSerial;releasePreviews();view.grid.replaceChildren();view.status.textContent='Открываем записи…';paintError();
    for(const b of view.filters.children)b.setAttribute('aria-pressed',String(b.dataset.kind===filter));
    for(const b of view.folders.children)b.setAttribute('aria-pressed',String(b.dataset.folder===folder));
    try{const entries=await list({kind:filter||undefined,folder});if(serial!==viewSerial||!view.dialog.open)return;
      view.status.textContent=entries.length?'Записей: '+entries.length:'В этом разделе пока нет записей.';
      if(retryAction?.bitotekaReadRetry){retryAction=null;lastError='';paintError();}
      if('IntersectionObserver' in root)observer=new IntersectionObserver(records=>{for(const record of records)if(record.isIntersecting){observer?.unobserve(record.target);const item=record.target._entry;if(item)preview(record.target,item,serial);}},{root:view.grid,rootMargin:'128px'});
      for(const item of entries){
        const card=document.createElement('article');card.className='zbt-card';card._entry=item;
        const media=document.createElement('div');media.className='zbt-preview';media.textContent=LABELS[item.kind]||item.kind;
        const name=document.createElement('h3');name.textContent=item.name;name.title=item.name;name.dataset.userLabel='';
        const file=document.createElement('p');file.className='zbt-filename';file.textContent=item.filename;file.title=item.filename;
        const details=document.createElement('p');details.className='zbt-details';details.textContent=new Date(item.createdAt).toLocaleString('ru-RU')+' · '+bytes(item.size);
        const source=document.createElement('p');source.className='zbt-source';source.textContent=sourceName(item.source);source.title=source.textContent;
        const collection=document.createElement('p');collection.className='zbt-collection';collection.textContent=[item.meta?.folder,item.meta?.paletteName].filter(Boolean).join(' · ');collection.title=collection.textContent;collection.hidden=!collection.textContent;
        const actions=document.createElement('div');actions.className='zbt-actions';
        const down=button('Скачать «'+item.name+'»','↓',()=>download(item.id).catch(()=>{}),true);
        const del=button('Удалить «'+item.name+'» из Битотеки','×',async()=>{del.disabled=true;try{await remove(item.id);}catch(_){del.disabled=false;}},true);
        actions.append(down,del);
        if(typeof item.meta?.openUrl==='string'){
          let destination=null;try{const url=new URL(item.meta.openUrl,location.href);if(['http:','https:'].includes(url.protocol)&&url.origin===location.origin)destination=url.href;}catch(_){}
          if(destination){const label=String(item.id).startsWith('mayatnik:')?'Открыть в Маятнике':'Открыть в исходной странице';actions.appendChild(button(label,'⇗',()=>location.assign(destination),true));}
        }
        card.append(media,name,file,details,collection,source,actions);view.grid.appendChild(card);
        if(observer)observer.observe(card);else preview(card,item,serial);
      }
    }catch(error){if(serial!==viewSerial)return;view.status.textContent='Записи не удалось открыть.';lastError=message(error);retryAction=()=>render();retryAction.bitotekaReadRetry=true;paintError();}
  }
  async function open(options={}){
    if(options.kind&&!KINDS.includes(options.kind))throw Error('Неизвестный раздел Битотеки');
    if(!document.body)await new Promise(resolve=>document.addEventListener('DOMContentLoaded',resolve,{once:true}));
    build();filter=options.kind||'';folder=options.folder==='Все'?'':String(options.folder||'');if(!view.dialog.open){returnFocus=document.activeElement;view.dialog.showModal();}await render();await refreshSources();
  }
  const readyPromise=db();readyPromise.catch(()=>{});
  root.ZerkBitoteka={get readyPromise(){return db();},get ready(){return db();},save,list,get,remove,download,open,close,subscribe(fn){if(typeof fn!=='function')throw TypeError('Ожидается обработчик');listeners.add(fn);return()=>listeners.delete(fn);},kinds:KINDS.slice()};
  root.dispatchEvent(new CustomEvent('zerk-bitoteka-ready'));
})(window);
