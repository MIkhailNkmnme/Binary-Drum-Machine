/* User-selected backup file, which may live in a Google Drive / other synced folder. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikBackupFile=api;})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const hash=async file=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer())),n=>n.toString(16).padStart(2,'0')).join('');
 function create(host){let handle=null,base=null,busy=false,loaded;const state=()=>({name:handle?.name||'',connected:!!handle,busy});
  async function permission(){await ready();if(!handle)throw Error('Сначала выберите файл облачной папки');if(await handle.queryPermission({mode:'readwrite'})!=='granted'&&await handle.requestPermission({mode:'readwrite'})!=='granted')throw Error('Нет разрешения на файл');}
  async function run(fn){if(busy)throw Error('Операция с файлом ещё выполняется');busy=true;try{return await fn();}finally{busy=false;}}
  async function connect(candidate){return run(async()=>{await ready();const file=await candidate.getFile();const digest=await hash(file);await host.saveTarget({handle:candidate,base:digest});handle=candidate;base=digest;return state();});}
  function ready(){return loaded||(loaded=(async()=>{const stored=await host.loadTarget();if(stored?.handle){handle=stored.handle;base=stored.base;}return state();})());}
  async function push(){await permission();return run(async()=>{const before=await handle.getFile();if(await hash(before)!==base)throw Error('Файл изменён извне. Сначала загрузите его или выберите новый файл; перезапись отменена.');
   const blob=await host.capture();const current=await handle.getFile();if(await hash(current)!==base)throw Error('Файл изменился во время сохранения. Перезапись отменена.');
   let writer;try{writer=await handle.createWritable({mode:'exclusive'});await writer.write(blob);await writer.close();}catch(e){try{await writer?.abort();}catch(_){}throw e;}base=await hash(blob);await host.saveTarget({handle,base});return blob.size;});}
  async function pull(confirm){await permission();return run(async()=>{const file=await handle.getFile();if(!file.size)throw Error('Выбранный файл пока пуст');const digest=await hash(file);return host.restore(file,confirm,async()=>{base=digest;await host.saveTarget({handle,base});});});}
  async function disconnect(){return run(async()=>{await ready();await host.saveTarget(null);handle=null;base=null;});}
  return {ready,connect,push,pull,disconnect,state};
 }
 return {create,hash};
});
