/* GIF assets share the archive-aware paint cache; media never enters localStorage. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikGifLibrary=api;})(globalThis,function(){
 'use strict';
 const INDEX='gif-library-v1',PREFIX='gif-library-item:',FOLDER='gif-scales';
 const clone=value=>structuredClone(value);
 const isBlob=value=>!!value&&Number.isFinite(value.size)&&value.size>0&&typeof value.arrayBuffer==='function';
 function create(storage){
  let state={version:1,folders:[],items:[]},queue=Promise.resolve(),serial=0;const listeners=new Set();
  const emit=()=>{for(const fn of listeners)try{fn();}catch(_){}};
  const ready=Promise.resolve().then(()=>storage.read(INDEX)).then(saved=>{
   if(saved==null)return;
   if(saved.version!==1||!Array.isArray(saved.folders)||!Array.isArray(saved.items)||saved.items.some(e=>!e||typeof e.id!=='string'||typeof e.name!=='string'||typeof e.folderId!=='string')||new Set(saved.items.map(e=>e.id)).size!==saved.items.length)throw Error('Повреждена библиотека GIF');
   state=clone(saved);
  });ready.catch(()=>{});
  function run(operation){const result=queue.then(()=>ready).then(operation);queue=result.catch(()=>{});return result;}
  async function read(id){await ready;const entry=state.items.find(e=>e.id===id);if(!entry)throw Error('GIF больше нет в библиотеке');const payload=await storage.read(PREFIX+id);if(!isBlob(payload?.blob))throw Error('Файл GIF не найден');return {...clone(entry),...payload};}
  return {
   ready,idle:()=>queue,subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},list:()=>clone(state.items),folders:()=>clone(state.folders),read,
   save(input){
    // Freeze metadata at the click; a queued save must retain the selected variant.
    let captured;try{if(!isBlob(input?.blob)||input.blob.type!=='image/gif')throw Error('Нет готового GIF для сохранения');captured={blob:input.blob,preview:typeof input.preview==='string'||isBlob(input.preview)?input.preview:null,name:String(input.name||'Масштабы.gif').trim()||'Масштабы.gif',metadata:clone(input.metadata||{})};}catch(error){return Promise.reject(error);}
    return run(async()=>{
     const folder=state.folders.find(f=>f.id===FOLDER)||state.folders.find(f=>f.name==='Масштабы');
     let id;do{id=Date.now().toString(36)+'-'+(++serial).toString(36)+'-'+Math.random().toString(36).slice(2,10);}while(state.items.some(e=>e.id===id));
     const entry={id,name:captured.name,folderId:folder?.id||FOLDER,metadata:captured.metadata,createdAt:Date.now()},next={...state,folders:folder?state.folders:[...state.folders,{id:FOLDER,name:'Масштабы'}],items:[...state.items,entry]};
     await storage.write({blob:captured.blob,preview:captured.preview},PREFIX+id);
     try{await storage.write(next,INDEX);}catch(error){try{await storage.write(null,PREFIX+id);}catch(_){}throw error;}
     state=next;emit();return clone(entry);
    });
   },
   remove(id){return run(async()=>{if(!state.items.some(e=>e.id===id))throw Error('GIF больше нет в библиотеке');const next={...state,items:state.items.filter(e=>e.id!==id)};await storage.write(next,INDEX);state=next;emit();await storage.write(null,PREFIX+id);});}
  };
 }
 return {create};
});
