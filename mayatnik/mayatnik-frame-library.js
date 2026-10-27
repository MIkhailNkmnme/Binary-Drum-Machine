/* v0.623: Explicit saved-frame library. The index contains only metadata; each Blob has its own key. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikFrameLibrary=api;})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const INDEX_KEY='frame-library-v1',ITEM_PREFIX='frame-library-item:';
  const copy=items=>items.map(item=>({...item}));
  const nameOf=value=>typeof value==='string'?value.trim():'';
  const isBlob=value=>!!value&&typeof value==='object'&&Number.isFinite(value.size)&&value.size>=0&&typeof value.arrayBuffer==='function';
  function metadata(item){
    if(!item||typeof item.id!=='string'||!item.id||!nameOf(item.name)||typeof item.thumbnail!=='string'||!Number.isInteger(item.frame)||item.frame<0||!Number.isInteger(item.rows)||item.rows<1||!Number.isFinite(item.createdAt))throw Error('Повреждён список сохранённых кадров');
    return {id:item.id,name:nameOf(item.name),thumbnail:item.thumbnail,frame:item.frame,rows:item.rows,createdAt:item.createdAt,...(['whole','view'].includes(item.previewKind)?{previewKind:item.previewKind}:{})};
  }
  function create(host){
    const namespace=host.namespace??'frame',namespaces=host.namespaces??[namespace];
    if(!Array.isArray(namespaces)||!namespaces.includes(namespace)||new Set(namespaces).size!==namespaces.length||namespaces.some(n=>typeof n!=='string'||!/^[a-z0-9-]+$/.test(n)))throw Error('Invalid library namespace');
    // Federate the original indexes in place. No copied records, import markers or
    // tombstones: a deletion stays deleted, and old backups still contain every Blob.
    const federated=namespaces.length>1,publicId=(ns,id)=>federated?ns+':'+id:id;
    function location(id){if(!federated)return {ns:namespace,id};const split=id.indexOf(':'),ns=id.slice(0,split);if(!namespaces.includes(ns)||split<0)throw Error('Сохранённый кадр не найден');return {ns,id:id.slice(split+1)};}
    const payloadKey=id=>{const p=location(id);return p.ns+'-library-item:'+p.id;};
    const ordered=next=>federated?next.slice().sort((a,b)=>a.createdAt-b.createdAt||namespaces.indexOf(location(a.id).ns)-namespaces.indexOf(location(b.id).ns)):next;
    const display=text=>host.kind==='view'?String(text).replace(/Кадр/g,'Вид').replace(/кадров/g,'видов').replace(/кадра/g,'вида').replace(/кадр/g,'вид'):text;
    let items=[],selectedId=null,busy=true,message='Загрузка сохранённых кадров…',serial=0;
    const listeners=new Set(),storage=host.storage;
    const getState=()=>({busy,message:display(message),selectedId});
    const emit=()=>{const value=getState();for(const listener of listeners){try{listener({...value});}catch(_){/* A view must not turn a committed write into a failed operation. */}}};
    const readItem=async id=>{const entry=items.find(item=>item.id===id);if(!entry)throw Error('Сохранённый кадр не найден');const blob=await storage.read(payloadKey(id));if(!isBlob(blob))throw Error('Файл сохранённого кадра отсутствует или повреждён');return {entry,blob};};
    const ready=Promise.resolve().then(async()=>{
      const loaded=[];
      for(const ns of namespaces){const saved=await storage.read(ns+'-library-v1');
        if(saved!=null){if(saved.version!==1||!Array.isArray(saved.items))throw Error('Неизвестный формат списка сохранённых кадров');
          const next=saved.items.map(metadata),ids=new Set(next.map(item=>item.id));if(ids.size!==next.length)throw Error('Повторяющиеся идентификаторы сохранённых кадров');loaded.push(...next.map(item=>({...item,...(federated?{previewKind:item.previewKind||(ns==='frame'?'view':'whole')}:{ }),id:publicId(ns,item.id)})));}}
      items=ordered(loaded);
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
    function uniqueId(){let id;do{id=publicId(namespace,Date.now().toString(36)+'-'+(++serial).toString(36)+'-'+Math.random().toString(36).slice(2,10));}while(items.some(item=>item.id===id));return id;}
    async function writeIndex(next,ns){const stored=next.filter(item=>location(item.id).ns===ns).map(item=>({...item,id:location(item.id).id}));await storage.write({version:1,items:stored},ns+'-library-v1');items=copy(ordered(next));}
    function save(name,suppliedCapture){
      const frozen=suppliedCapture===undefined?null:Promise.resolve(suppliedCapture);if(frozen)frozen.catch(()=>{});
      return run('Сохранение кадра',async()=>{
      const captured=await (frozen||host.capture());if(!isBlob(captured?.blob))throw Error('Снимок кадра не содержит файл');
      const id=uniqueId(),entry=metadata({id,name:nameOf(name)||nameOf(captured.name)||display('Кадр ')+captured.frame,thumbnail:captured.thumbnail,previewKind:captured.previewKind,frame:captured.frame,rows:captured.rows,createdAt:Date.now()});
      const key=payloadKey(id);
      try{await storage.write(captured.blob,key);await writeIndex([...items,entry],namespace);}
      catch(error){try{await storage.write(null,key);}catch(_){}throw error;}
      selectedId=id;message='Кадр сохранён: '+entry.name;return id;
    });}
    function open(id){return run('Открытие кадра',async()=>{const {entry,blob}=await readItem(id);await host.restore(blob);selectedId=id;message='Кадр открыт: '+entry.name;
      if(entry.previewKind!=='whole'&&host.refreshThumbnail){try{const preview=await host.refreshThumbnail();if(typeof preview?.thumbnail!=='string')throw Error('Повреждён эскиз');await writeIndex(items.map(item=>item.id===id?{...item,thumbnail:preview.thumbnail,previewKind:'whole'}:item),location(id).ns);}catch(_){message+='; полный эскиз не удалось сохранить';}}
      return id;});}
    function rename(id,name){return run('Переименование кадра',async()=>{
      const title=nameOf(name);if(!title)throw Error('Название кадра не должно быть пустым');const entry=items.find(item=>item.id===id);if(!entry)throw Error('Сохранённый кадр не найден');
      if(entry.name!==title)await writeIndex(items.map(item=>item.id===id?{...item,name:title}:item),location(id).ns);message='Кадр переименован: '+title;return id;
    });}
    function remove(id){return run('Удаление кадра',async()=>{
      const entry=items.find(item=>item.id===id);if(!entry)throw Error('Сохранённый кадр не найден');
      await writeIndex(items.filter(item=>item.id!==id),location(id).ns);if(selectedId===id)selectedId=null;
      try{await storage.write(null,payloadKey(id));message='Кадр удалён из библиотеки: '+entry.name;}
      catch(_){message='Кадр удалён из списка; не удалось очистить его файл в памяти браузера';}
      return id;
    });}
    function download(id){return run('Скачивание кадра',async()=>{const {entry,blob}=await readItem(id);await host.download(blob,entry.name);message='Файл кадра передан для скачивания: '+entry.name;return id;});}
    return {ready,idle:()=>queue,list:()=>copy(items),getState,subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener);},async exportItem(id){await ready;await queue;const {entry,blob}=await readItem(id);return {id:entry.id,name:entry.name,files:[{extension:".mayatnik",blob}]};},save,open,rename,remove,download};
  }
  return {create,INDEX_KEY,ITEM_PREFIX};
});
