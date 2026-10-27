/* Full backup operations. Storage adapters keep this module testable without a browser. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikBackup=api;})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 function create(host){
  let busy=false,message='',restored=false,terminal=false;const listeners=new Set();const state=()=>({busy,message,restored,terminal});
  function report(text){message=text;for(const fn of listeners)try{fn(state());}catch(_){}}
  async function run(label,action){if(busy||restored||terminal)throw Error('Дождитесь завершения текущего действия');host.guard?.();busy=true;report(label);try{return await action();}catch(e){report(e.message||String(e));throw e;}finally{busy=false;if(!restored&&!terminal)host.cache.freeze(false);report(message);}}
  function local(){const pairs=[];for(let i=0;i<host.local.length;i++){const key=host.local.key(i);if(host.codec.isLocalKey(key))pairs.push({key,value:host.local.getItem(key)});}return host.codec.validateLocal(pairs);}
  function putLocal(pairs){const existing=local();for(const {key}of existing)host.local.removeItem(key);for(const {key,value}of pairs)host.local.setItem(key,value);const sort=a=>JSON.stringify(a.slice().sort((x,y)=>x.key.localeCompare(y.key)));if(sort(local())!==sort(pairs))throw Error('Настройки записаны не полностью');}
  async function snapshot(){await host.otherTabs?.();await host.prepare();await host.cache.idle();host.cache.freeze(true);return {createdAt:new Date().toISOString(),appVersion:host.version,entries:await host.cache.snapshot(),local:host.exportLocal?host.codec.validateLocal(host.exportLocal(local())):local()};}
  async function capture(){return run('Сохраняю все библиотеки и текущую работу…',async()=>{const data=await snapshot(),blob=await host.codec.encode(data);report('Полная копия готова · '+(blob.size/1048576).toFixed(2)+' МиБ');return blob;});}
  async function inspect(file){return run('Проверяю архив…',async()=>{const data=await host.codec.decode(file);report('Архив проверен');return data;});}
  async function restore(file,confirm,onCommitted){return run('Проверяю архив перед восстановлением…',async()=>{
   const data=await host.codec.decode(file),next=data.snapshot;await host.validate?.(next);await host.otherTabs?.();
   if(!await confirm(next)){report('Восстановление отменено');return false;}
   report('Сохраняю предыдущие данные для отката…');const previous=await snapshot();
   // A separate recovery store must succeed before replacing live data.
   await host.recovery(previous);
   host.markRestoring(true);
   try{await host.cache.replace(next.entries);putLocal(next.local);}
   catch(error){try{await host.cache.replace(previous.entries);putLocal(previous.local);}catch(rollback){terminal=true;report('Нужен откат из резервной копии');throw Error('Ошибка восстановления; резервная копия оставлена в браузере. '+error.message+'; откат: '+rollback.message);}host.markRestoring(false);throw error;}
   restored=true;if(onCommitted)try{await onCommitted();}catch(_){}report('Восстановлено. Перезагрузка…');host.reload();return true;
  });}
  return {capture,inspect,restore,state,subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},local};
 }
 return {create};
});
