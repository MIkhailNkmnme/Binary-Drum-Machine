/* Search metadata is stored independently; older entries can retain Library frame references. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else api.install(root);
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const KEY='ochki-search-log-v1';
  const SOURCE_NAMES={'':'Обычный Маятник',legacy:'Обычный Маятник',horr:'Обычный Маятник',cone:'Конусы 5.7',field:'Поле 5.8',pair:'Обе 5.9',p12:'XOR 1–2',p23:'XOR 2–3',p31:'XOR 3–1',p123:'XOR все 3',a12:'AND 1–2',a23:'AND 2–3',a31:'AND 3–1',a123:'AND все 3',xor:'XOR 1–3',and:'AND 1–3'};
  const sourceName=value=>SOURCE_NAMES[value??'']||'Построение';
  function foundRows(finds){const numbers=[...new Set((finds||[]).filter(hit=>Number.isInteger(hit.i)).map(hit=>hit.i+1))].sort((a,b)=>a-b);return numbers.length?' · Строки последовательности № '+numbers.slice(0,20).join(', ')+(numbers.length>20?' … (всего '+numbers.length+')':''):'';}
  const clone=value=>JSON.parse(JSON.stringify(value));
  const errorText=error=>error?.message||String(error);
  function create(host){
    let items=[],message='Загрузка лога поиска…',storageError='',queue=Promise.resolve();
    const pending=new Set(),listeners=new Set(),emit=()=>{for(const listener of listeners)try{listener();}catch(_){}};
    const ready=Promise.resolve().then(async()=>{
      const storage=await host.storage(),saved=await storage.read(KEY);
      if(saved!=null){if(saved.version!==1||!Array.isArray(saved.items))throw Error('Неизвестный формат лога поиска');
        items=saved.items.map(entry=>{if(!entry||typeof entry.id!=='string')throw Error('Повреждён лог поиска');return clone(entry);});}
      // A browser closing during a save cannot have acknowledged the final frame.
      items=items.map(entry=>entry.status==='saving'?{...entry,status:'error',error:'Сохранение было прервано. Кадр не подтверждён.'}:entry);
      message='';emit();
    }).catch(error=>{storageError='Не удалось загрузить лог поиска: '+errorText(error);message=storageError;emit();throw error;});
    ready.catch(()=>{});
    function record(detail){
      // Freeze before any async boundary: animation mutates its live results.
      const entry=clone(detail);
      const result=queue.then(async()=>{
        await ready;
        if(typeof entry.id!=='string'||!entry.id||!['found','saving','saved','error'].includes(entry.status))throw Error('Некорректная запись лога поиска');
        const index=items.findIndex(item=>item.id===entry.id),previous=index<0?{}:items[index];
        // Ignore late progress events after a confirmed terminal status.
        if(entry.status==='saving'&&['saved','error'].includes(previous.status))return;
        const next={...previous,...entry};
        if(next.status==='saved'&&!next.savedId){next.status='error';next.error='Библиотека не подтвердила сохранённый кадр';}
        if(index<0)items.push(next);else items[index]=next;
        pending.add(entry.id);emit();
        try{const storage=await host.storage();await storage.write({version:1,items:clone(items)},KEY);storageError='';message='';}
        catch(error){storageError='Не удалось сохранить лог поиска: '+errorText(error);message=storageError;emit();throw error;}
        finally{pending.delete(entry.id);emit();}
        emit();
      });queue=result.catch(()=>{});return result;
    }
    async function open(id){
      await ready;
      const entry=items.find(item=>item.id===id);
      if(entry?.status!=='saved'||!entry.savedId)throw Error('Кадр ещё не сохранён');
      const library=await host.library();await library.ready;
      const snapshot=clone(entry);
      if(host.open)await host.open(snapshot,library);else await library.open(snapshot.savedId);
      return snapshot.savedId;
    }
    return {ready,record,open,idle:()=>queue,list:()=>clone(items),getState:()=>({message,storageError,pending:[...pending]}),subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener);}};
  }
  function install(root){
    const waitFor=get=>new Promise(resolve=>{const poll=()=>{const value=get();if(value)resolve(value);else root.setTimeout(poll,40);};poll();});
    const log=create({storage:()=>waitFor(()=>root.MayatnikPaintCache),library:()=>waitFor(()=>root.mayFrameLibrary),
      async open(entry,library){const detail={entry,handled:null};root.dispatchEvent(new CustomEvent('may-ochki-log-open',{detail}));
        if(detail.handled)await detail.handled;else throw Error('Открытие кадра пока не готово. Повторите после загрузки страницы.');}});
    // Listen immediately, before storage, Library or DOM initialization.
    root.addEventListener('may-ochki-log-record',event=>{const result=log.record(event.detail);if(event.detail)event.detail.persisted=result;result.catch(()=>{});});
    let panel,list,status,opener,opening=false;
    function render(){
      if(!list)return;
      const oldScroll=list.scrollTop,entries=log.list().reverse();list.replaceChildren();
      status.textContent=log.getState().message||'Записей поиска: '+entries.length;
      const library=root.mayFrameLibrary,frames=new Map((library?.list()||[]).map(frame=>[frame.id,frame]));
      for(const entry of entries){
        const row=document.createElement('article');row.className='may-ochki-log-entry';
        const preview=frames.get(entry.savedId)?.thumbnail;
        if(preview){const img=document.createElement('img');img.src=preview;img.alt='Кадр '+entry.frame;img.loading='lazy';row.append(img);}
        const info=document.createElement('div'),title=document.createElement('strong');title.textContent='Кадр '+entry.frame+' · '+(entry.rows??frames.get(entry.savedId)?.rows??'—')+' строк';info.append(title);
        const text=document.createElement('p');text.textContent=new Date(entry.at||0).toLocaleString('ru-RU')+' · Построение: '+sourceName(entry.src??entry.source)+' · '+(entry.mirror?'Зеркально':'Прямо')+' · Найдено: '+(entry.count??entry.finds?.length??0)+foundRows(entry.finds);info.append(text);
        const state=document.createElement('p');state.className='may-ochki-log-state';state.textContent=entry.status==='found'?(log.getState().pending.includes(entry.id)?'Запись находок…':log.getState().storageError?'Находки не записаны: '+log.getState().storageError:'Находки записаны в лог'):entry.status==='saved'?(log.getState().pending.includes(entry.id)?'Кадр в библиотеке; сохранение лога…':log.getState().storageError?'Кадр в библиотеке; лог не сохранён':'Сохранён в библиотеке и логе'):entry.status==='saving'?'Сохранение кадра…':'Ошибка сохранения: '+(entry.error||'неизвестная ошибка');info.append(state);
        const b=button('Открыть кадр',async()=>{opening=true;render();try{await log.open(entry.id);panel.close();}catch(error){status.textContent='Не удалось открыть кадр: '+errorText(error);}finally{opening=false;renderButtons();}});
        b.disabled=entry.status!=='saved'||opening;if(entry.status!=='found')info.append(b);row.append(info);list.append(row);
      }
      list.scrollTop=oldScroll;
    }
    function renderButtons(){if(!list)return;for(const [i,row]of [...list.children].entries()){const entry=log.list().reverse()[i],button=row.querySelector('button');if(button)button.disabled=opening||entry.status!=='saved';}}
    function button(label,run){const b=document.createElement('button');b.type='button';b.className='gz-hx';b.title=label;b.setAttribute('aria-label',label);const name=document.createElement('span');name.className='gz-nm';name.textContent=label;b.append(name);b.addEventListener('click',run);return b;}
    function show(){
      if(!document.body)return;
      if(!panel){panel=document.createElement('dialog');panel.id='mayOchkiSearchLog';panel.setAttribute('aria-labelledby','mayOchkiSearchLogTitle');
        const header=document.createElement('header'),title=document.createElement('h2');title.id='mayOchkiSearchLogTitle';title.textContent='Лог поиска Очков';header.append(title,button('Закрыть',()=>panel.close()));
        status=document.createElement('p');status.className='may-ochki-log-status';status.setAttribute('role','status');list=document.createElement('div');list.className='may-ochki-log-list';panel.append(header,status,list);document.body.append(panel);
        panel.addEventListener('close',()=>opener?.focus());log.subscribe(render);root.mayFrameLibrary?.subscribe(render);log.ready.then(render,render);}
      opener=document.activeElement;render();if(!panel.open)panel.showModal();
    }
    root.MayatnikOchkiLog={...log,show};
    root.addEventListener('may-ochki-log-show',show);
    return root.MayatnikOchkiLog;
  }
  return {KEY,create,install,sourceName,foundRows};
});
