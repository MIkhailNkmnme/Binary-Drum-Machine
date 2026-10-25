/* Explicit saved-frame library. The index contains only metadata; each Blob has its own key. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikFrameLibrary=api;})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const INDEX_KEY='frame-library-v1',ITEM_PREFIX='frame-library-item:';
  const copy=items=>items.map(item=>({...item}));
  const nameOf=value=>typeof value==='string'?value.trim():'';
  const isBlob=value=>!!value&&typeof value==='object'&&Number.isFinite(value.size)&&value.size>=0&&typeof value.arrayBuffer==='function';
  function metadata(item){
    if(!item||typeof item.id!=='string'||!item.id||!nameOf(item.name)||typeof item.thumbnail!=='string'||!Number.isInteger(item.frame)||item.frame<0||!Number.isInteger(item.rows)||item.rows<1||!Number.isFinite(item.createdAt))throw Error('Повреждён список сохранённых кадров');
    return {id:item.id,name:nameOf(item.name),thumbnail:item.thumbnail,frame:item.frame,rows:item.rows,createdAt:item.createdAt};
  }
  function create(host){
    const namespace=host.namespace??'frame';if(!/^[a-z0-9-]+$/.test(namespace))throw Error('Invalid library namespace');
    const indexKey=namespace+'-library-v1',itemPrefix=namespace+'-library-item:';
    const display=text=>host.kind==='view'?String(text).replace(/Кадр/g,'Вид').replace(/кадров/g,'видов').replace(/кадра/g,'вида').replace(/кадр/g,'вид'):text;
    let items=[],selectedId=null,busy=true,message='Загрузка сохранённых кадров…',serial=0;
    const listeners=new Set(),storage=host.storage;
    const getState=()=>({busy,message:display(message),selectedId});
    const emit=()=>{const value=getState();for(const listener of listeners){try{listener({...value});}catch(_){/* A view must not turn a committed write into a failed operation. */}}};
    const index=next=>({version:1,items:copy(next)});
    const readItem=async id=>{const entry=items.find(item=>item.id===id);if(!entry)throw Error('Сохранённый кадр не найден');const blob=await storage.read(itemPrefix+id);if(!isBlob(blob))throw Error('Файл сохранённого кадра отсутствует или повреждён');return {entry,blob};};
    const ready=Promise.resolve().then(async()=>{
      const saved=await storage.read(indexKey);
      if(saved!=null){if(saved.version!==1||!Array.isArray(saved.items))throw Error('Неизвестный формат списка сохранённых кадров');
        const next=saved.items.map(metadata),ids=new Set(next.map(item=>item.id));if(ids.size!==next.length)throw Error('Повторяющиеся идентификаторы сохранённых кадров');items=next;}
      message=items.length?'Сохранённых кадров: '+items.length:'Сохранённых кадров пока нет';
    }).catch(error=>{message='Не удалось загрузить библиотеку кадров: '+(error?.message||String(error));throw error;}).finally(()=>{busy=false;emit();});
    // Consumers may subscribe before awaiting ready. Keep load failure observable without an unhandled rejection.
    ready.catch(()=>{});
    let queue=Promise.resolve();
    function run(label,operation){
      const result=queue.then(async()=>{await ready;busy=true;message=label;emit();
        try{return await operation();}catch(error){message=label+' — ошибка: '+(error?.message||String(error));throw new Error(display(error?.message||String(error)),{cause:error});}finally{busy=false;emit();}
      });queue=result.catch(()=>{});return result;
    }
    function uniqueId(){let id;do{id=Date.now().toString(36)+'-'+(++serial).toString(36)+'-'+Math.random().toString(36).slice(2,10);}while(items.some(item=>item.id===id));return id;}
    async function writeIndex(next){await storage.write(index(next),indexKey);items=copy(next);}
    function save(name){return run('Сохранение кадра',async()=>{
      const captured=await host.capture();if(!isBlob(captured?.blob))throw Error('Снимок кадра не содержит файл');
      const id=uniqueId(),entry=metadata({id,name:nameOf(name)||nameOf(captured.name)||display('Кадр ')+captured.frame,thumbnail:captured.thumbnail,frame:captured.frame,rows:captured.rows,createdAt:Date.now()});
      const key=itemPrefix+id;
      try{await storage.write(captured.blob,key);await writeIndex([...items,entry]);}
      catch(error){try{await storage.write(null,key);}catch(_){}throw error;}
      selectedId=id;message='Кадр сохранён: '+entry.name;return id;
    });}
    function open(id){return run('Открытие кадра',async()=>{const {entry,blob}=await readItem(id);await host.restore(blob);selectedId=id;message='Кадр открыт: '+entry.name;return id;});}
    function rename(id,name){return run('Переименование кадра',async()=>{
      const title=nameOf(name);if(!title)throw Error('Название кадра не должно быть пустым');const entry=items.find(item=>item.id===id);if(!entry)throw Error('Сохранённый кадр не найден');
      if(entry.name!==title)await writeIndex(items.map(item=>item.id===id?{...item,name:title}:item));message='Кадр переименован: '+title;return id;
    });}
    function remove(id){return run('Удаление кадра',async()=>{
      const entry=items.find(item=>item.id===id);if(!entry)throw Error('Сохранённый кадр не найден');
      await writeIndex(items.filter(item=>item.id!==id));if(selectedId===id)selectedId=null;
      try{await storage.write(null,itemPrefix+id);message='Кадр удалён из библиотеки: '+entry.name;}
      catch(_){message='Кадр удалён из списка; не удалось очистить его файл в памяти браузера';}
      return id;
    });}
    function download(id){return run('Скачивание кадра',async()=>{const {entry,blob}=await readItem(id);await host.download(blob,entry.name);message='Файл кадра передан для скачивания: '+entry.name;return id;});}
    return {ready,list:()=>copy(items),getState,subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener);},save,open,rename,remove,download};
  }
  return {create,INDEX_KEY,ITEM_PREFIX};
});
