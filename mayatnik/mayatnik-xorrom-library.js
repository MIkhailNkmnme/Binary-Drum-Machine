/* Built-in Xorrom examples are read-only recipes, never copies in user storage. */
(function(root,factory){const value=factory(root);if(typeof module==='object'&&module.exports)module.exports=value;else root.MayatnikXorromLibrary=value;})(globalThis,function(root){
  'use strict';
  const clone=value=>JSON.parse(JSON.stringify(value));
  function frameBytes(entry){
    const frame=entry.frame;
    if(!frame||typeof frame!=='object'||frame.format!=='mayatnik-work'||frame.version!==2||
      !Number.isSafeInteger(frame.rows)||frame.rows<1||frame.rows>16384||!Number.isSafeInteger(frame.k)||frame.k<0||
      !Number.isSafeInteger(frame.width)||frame.width<1||!Number.isSafeInteger(frame.height)||frame.height!==frame.rows||frame.width*frame.height>16777216||
      typeof frame.base64!=='string'||!frame.base64.length||frame.base64.length%4!==0||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(frame.base64))throw Error('Повреждён исходный кадр музыкального примера.');
    let binary;try{binary=root.atob(frame.base64);}catch(_){throw Error('Повреждён исходный кадр музыкального примера.');}
    if(!((binary.charCodeAt(0)===31&&binary.charCodeAt(1)===139)||binary.startsWith('MYTW0002')))throw Error('Неизвестный формат исходного кадра музыкального примера.');
    if(typeof entry.work!=='string'||!/^audio-examples\/[a-z0-9-]+\.mayatnik$/.test(entry.work))throw Error('Не найден файл исходного кадра музыкального примера.');
    return Uint8Array.from(binary,ch=>ch.charCodeAt(0));
  }
  function create({api,bank,engine,restoreFrame,document:doc=root.document,download,fetch:fetcher=root.fetch?.bind(root)}={}){
    if(!api||!engine?.validateSettings||!Array.isArray(bank))throw Error('Для музыкальной библиотеки нужны Xorrom и встроенные примеры.');
    const entries=bank.map(entry=>{
      if(!entry||typeof entry.id!=='string'||!entry.id||typeof entry.name!=='string'||!entry.name.trim())throw Error('Повреждено название музыкального примера.');
      for(const key of ['audio','wav','preset'])if(typeof entry[key]!=='string'||!/^audio-examples\/[a-z0-9-]+\.(mp3|wav|json)$/.test(entry[key]))throw Error('Некорректный файл музыкального примера.');
      return {...clone(entry),settings:engine.validateSettings(entry.settings),builtin:true};
    });
    if(new Set(entries.map(entry=>entry.id)).size!==entries.length)throw Error('Повтор музыкального примера.');
    let selectedId=null,busy=false,message='Встроенных примеров: '+entries.length,disposed=false,queue=Promise.resolve();
    const listeners=new Set(),win=doc?.defaultView||root;
    function find(id){const value=entries.find(entry=>entry.id===id);if(!value)throw Error('Музыкальный пример не найден.');return value;}
    function getState(){
      const selected=entries.find(entry=>entry.id===selectedId),current=api.getSettings();
      return {selectedId:selected&&Object.keys(selected.settings).every(key=>current[key]===selected.settings[key])?selectedId:null,busy,message};
    }
    const emit=()=>{if(!disposed)for(const fn of listeners)try{fn(getState());}catch(_){};};
    let lastSelected=null;
    const unlisten=api.subscribe?.(()=>{const value=getState().selectedId;if(value!==lastSelected){lastSelected=value;emit();}});
    function run(label,action){
      const result=queue.then(async()=>{if(disposed)return false;busy=true;message=label;emit();try{return await action();}catch(error){message=error?.message||String(error);throw error;}finally{busy=false;lastSelected=getState().selectedId;emit();}});
      queue=result.catch(()=>{});return result;
    }
    function clickDownload(href,name){
      if(!doc)throw Error('Скачивание недоступно.');
      const anchor=doc.createElement('a');anchor.href=href;anchor.download=name;anchor.hidden=true;doc.body.append(anchor);anchor.click();anchor.remove();
    }
    async function saveJSON(entry){
      const blob=new Blob([JSON.stringify(engine.validateSettings(entry.settings),null,2)+'\n'],{type:'application/json'});
      if(download){await download(blob,entry.id+'.json');return;}
      const url=win.URL.createObjectURL(blob);clickDownload(url,entry.id+'.json');win.setTimeout(()=>win.URL.revokeObjectURL(url),1000);
    }
    return {
      ready:Promise.resolve(),idle:()=>queue,getState,list:()=>entries.map(clone),
      subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},
      preview(id){return run('Подготовка прослушивания…',async()=>{const entry=find(id);await api.pause();if(disposed)return false;message='Пример: '+entry.name;return clone(entry);});},
      open(id){return run('Восстановление музыкального примера…',async()=>{const entry=find(id),settings=engine.validateSettings(clone(entry.settings));if(entry.frame!==undefined){frameBytes(entry);if(typeof restoreFrame!=='function')throw Error('Восстановление исходного кадра недоступно. Обновите страницу.');}await api.pause();if(disposed)return false;if(entry.frame!==undefined){await restoreFrame(clone(entry));if(disposed)return false;}api.setSettings(settings);selectedId=id;message='Применено: '+entry.name+(entry.frame?' — исходный кадр и настройки.':'.')+' Нажмите Старт в Xorrom.';return id;});},
      download(id,kind='json'){return run('Скачивание музыкального примера…',async()=>{const entry=find(id);if(kind==='json')await saveJSON(entry);else if(kind==='work'){frameBytes(entry);clickDownload(entry.work,entry.id+'.mayatnik');}else if(kind==='wav'||kind==='mp3')clickDownload(kind==='wav'?entry.wav:entry.audio,entry.id+'.'+kind);else throw Error('Неизвестный формат музыкального примера.');if(!disposed)message='Скачано: '+entry.name;return id;});},
      async exportItem(id){const entry=find(id);if(!fetcher)throw Error('Скачайте WAV и JSON кнопками музыкального примера.');const frame=entry.frame!==undefined?frameBytes(entry):null,response=await fetcher(entry.wav);if(!response.ok)throw Error('Не удалось прочитать WAV музыкального примера.');return {id,name:entry.name,files:[{extension:'.json',blob:new Blob([JSON.stringify(entry.settings,null,2)],{type:'application/json'})},{extension:'.wav',blob:await response.blob()},...(frame?[{extension:'.mayatnik',blob:new Blob([frame],{type:'application/octet-stream'})}]:[])]};},
      dispose(){if(disposed)return;disposed=true;unlisten?.();listeners.clear();}
    };
  }
  return {create};
});
