/* v0.748: Библиотека → Ссылки. Хранит готовые ссылки на построение и настройки:
   имя, время, краткое описание и саму ссылку. Открытие применяет ссылку к текущей
   странице (без перезагрузки), ⧉ кладёт её в буфер, ↓ отдаёт текстовым файлом. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikLinkLibrary=api;})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const KEY='link-library-v1';
  const MAX_NAME=120,MAX_SUMMARY=300,MAX_LINK=400000;
  const ICON='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><path fill="none" stroke="#b48cff" stroke-width="3" d="M19 15l6-6a8 8 0 0111 11l-6 6M29 33l-6 6a8 8 0 01-11-11l6-6M18 30l12-12"/></svg>');
  const clone=value=>JSON.parse(JSON.stringify(value));
  const text=value=>typeof value==='string'?value.trim():'';
  function metadata(item){
    if(!item||typeof item.id!=='string'||!item.id)throw Error('Повреждён список ссылок');
    const name=text(item.name),link=text(item.link);
    if(!name)throw Error('У ссылки нет названия');
    if(!link||link.length>MAX_LINK||!/#s=[A-Za-z0-9._-]+$/.test(link))throw Error('Ссылка «'+name+'» повреждена');
    if(!Number.isFinite(item.createdAt))throw Error('У ссылки «'+name+'» нет даты');
    return {id:item.id,name:name.slice(0,MAX_NAME),createdAt:item.createdAt,link,summary:text(item.summary).slice(0,MAX_SUMMARY)};
  }
  function create(host){
    if(!host||typeof host.capture!=='function'||typeof host.restore!=='function')throw Error('Библиотеке ссылок нужен источник и приёмник');
    const storage=host.storage;
    let items=[],selectedId=null,busy=true,message='Загрузка ссылок…',serial=0,queue=Promise.resolve();
    const listeners=new Set();
    const getState=()=>({busy,message,selectedId});
    const emit=()=>{const value=getState();for(const listener of listeners){try{listener({...value});}catch(_){/* a view must not break a committed write */}}};
    const ready=Promise.resolve().then(async()=>{
      const saved=storage?await storage.read(KEY):null;
      if(saved!=null){if(saved.version!==1||!Array.isArray(saved.items))throw Error('Неизвестный формат библиотеки ссылок');items=saved.items.map(metadata);if(new Set(items.map(item=>item.id)).size!==items.length)throw Error('Повторяющиеся ссылки в библиотеке');}
      message=items.length?'Сохранённых ссылок: '+items.length:'Сохранённых ссылок пока нет';
    }).catch(error=>{message='Не удалось загрузить ссылки: '+(error?.message||String(error));throw error;}).finally(()=>{busy=false;emit();});
    ready.catch(()=>{});
    function run(label,operation){
      const result=queue.then(async()=>{await ready;busy=true;message=label;emit();
        try{return await operation();}catch(error){message=label+' — ошибка: '+(error?.message||String(error));throw new Error(error?.message||String(error),{cause:error});}finally{busy=false;emit();}
      });queue=result.catch(()=>{});return result;
    }
    function find(id){const item=items.find(entry=>entry.id===id);if(!item)throw Error('Сохранённая ссылка не найдена');return item;}
    function uniqueId(){let id;do{id=Date.now().toString(36)+'-'+(++serial).toString(36)+'-'+Math.random().toString(36).slice(2,8);}while(items.some(item=>item.id===id));return id;}
    async function write(next){if(storage)await storage.write({version:1,items:clone(next)},KEY);items=next;}
    async function copyLink(link){try{return !!(await host.copy?.(link));}catch(_){return false;}}
    function save(name){
      return run('Сохранение ссылки',async()=>{
        const captured=await host.capture();
        if(!captured||!text(captured.link))throw Error('Ссылка не собрана');
        const entry=metadata({id:uniqueId(),name:text(name)||text(captured.name)||'Ссылка',createdAt:Date.now(),link:captured.link,summary:captured.summary||''});
        await write([...items,entry]);selectedId=entry.id;
        const copied=await copyLink(entry.link);
        message=(copied?'Ссылка скопирована и сохранена в Библиотеку → Ссылки: ':'Ссылка сохранена в Библиотеку → Ссылки: ')+entry.name+(copied?'':' · буфер недоступен — кнопка ↓ или ⧉ скопирует позже');
        return entry.id;
      });
    }
    function open(id){return run('Открытие ссылки',async()=>{const item=find(id);await host.restore(item.link);selectedId=id;message='Открыто по ссылке: '+item.name;return id;});}
    function copy(id){return run('Копирование ссылки',async()=>{const item=find(id);const copied=await copyLink(item.link);message=copied?'Ссылка скопирована: '+item.name:'Буфер обмена недоступен — удалось сохранить; скачайте ↓ или разрешите буфер';return copied;});}
    function rename(id,name){return run('Переименование ссылки',async()=>{const item=find(id),title=text(name);if(!title)throw Error('Название ссылки не должно быть пустым');await write(items.map(entry=>entry.id===id?{...entry,name:title.slice(0,MAX_NAME)}:entry));message='Ссылка переименована: '+title;return id;});}
    function remove(id){return run('Удаление ссылки',async()=>{const item=find(id);await write(items.filter(entry=>entry.id!==id));if(selectedId===id)selectedId=null;message='Ссылка удалена из библиотеки: '+item.name;return id;});}
    function download(id){return run('Скачивание ссылки',async()=>{const item=find(id);await host.download(new Blob([item.link+'\r\n'],{type:'text/plain;charset=utf-8'}),item.name);message='Ссылка передана для скачивания: '+item.name;return id;});}
    return {ready,idle:()=>queue,KEY,list:()=>items.map(item=>({...item,thumbnail:ICON})),getState,
      subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener);},
      async exportItem(id){await ready;await queue;const item=find(id);return {id:item.id,name:item.name,files:[{extension:'.txt',blob:new Blob([item.link+'\r\n'],{type:'text/plain;charset=utf-8'})}]};},
      save,open,copy,rename,remove,download};
  }
  return {create,KEY,metadata,MAX_NAME,MAX_SUMMARY,MAX_LINK};
});
