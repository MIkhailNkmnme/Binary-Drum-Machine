/* Hub v0.205: portable full-scene files and an IndexedDB preset library. */
(() => {
  'use strict';
  const C=window.HubPresetCore,PENDING='zerk_hub_restore',SELECTED='zerk_hub_preset_selected';
  let boot=null,dbPromise,panel,list,status,saveButton,undoButton,selected=0,busy=false;
  // Apply before the other modules read their settings. Old pagehide saves cannot
  // overwrite the requested snapshot: those happen before this new document.
  try{
    boot=JSON.parse(sessionStorage.getItem(PENDING)||'null');
    if(boot&&!boot.key)boot.key='pending';
    if(boot?.settings)for(const key of C.keys){const value=boot.settings[key];if(value==null)localStorage.removeItem(key);else if(typeof value==='string')localStorage.setItem(key,value);}
    selected=Number(sessionStorage.getItem(SELECTED))||0;
  }catch(e){boot=null;}
  function database(){
    if(!dbPromise)dbPromise=new Promise((resolve,reject)=>{
      const request=indexedDB.open('zerkalius-hub-presets',1);
      request.onupgradeneeded=()=>{request.result.createObjectStore('presets',{keyPath:'id'});request.result.createObjectStore('meta');};
      request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
      request.onblocked=()=>reject(Error('Закройте другую вкладку Зеркалиуса и повторите'));
    });return dbPromise;
  }
  async function transaction(stores,mode,run){
    const db=await database();return new Promise((resolve,reject)=>{
      const tx=db.transaction(stores,mode);let result;
      tx.oncomplete=()=>resolve(result);tx.onabort=()=>reject(tx.error||Error('Не удалось сохранить в браузере'));tx.onerror=()=>{};
      run(tx,value=>{result=value;});
    });
  }
  const read=(store,key)=>transaction([store],'readonly',(tx,done)=>{const r=tx.objectStore(store).get(key);r.onsuccess=()=>done(r.result);});
  async function add(snapshot,defaultName){
    return transaction(['presets','meta'],'readwrite',(tx,done)=>{
      const meta=tx.objectStore('meta'),request=meta.get('counter');
      request.onsuccess=()=>{const id=(Number(request.result)||0)+1;meta.put(id,'counter');const record={...snapshot,id,name:defaultName?'Зеркалиус-'+id:snapshot.name};tx.objectStore('presets').put(record);done(record);};
    });
  }
  const message=text=>{status.textContent=text;};
  function choose(id){selected=id;sessionStorage.setItem(SELECTED,String(id));list?.querySelectorAll('[data-preset]').forEach(row=>row.dataset.selected=String(Number(row.dataset.preset)===id));}
  const controlKey=node=>node.id||node.dataset.pinControl||node.getAttribute('aria-label')||node.querySelector(':scope > summary')?.getAttribute('aria-label');
  function snapshot(){
    const settings=Object.fromEntries(C.keys.map(key=>[key,localStorage.getItem(key)]));
    const state={view:HubView.snapshot(),mirror:HubMirror.snapshot(),scene:HubScene.snapshot(),flow:HubFlow.snapshot(),image:HubImage.snapshot(),ui:{zen:HubZen.snapshot(),scroll:[scrollX,scrollY],open:[...document.querySelectorAll('#hubFieldTools details[open]')].map(controlKey).filter(Boolean),png:document.querySelector('[aria-label="Разрешение PNG по длинной стороне"]')?.value}};
    settings.zerk_hub_view=JSON.stringify(state.view.state);settings.zerk_hub_mirror=JSON.stringify(state.mirror.state);settings.zerk_hub_visible_rows=String(state.scene.rowLimit);
    state.ui.menu=window.HubMenuLayout?.snapshot();state.ui.romb=window.HubRombGrid?.snapshot();
    if(state.ui.menu)settings.zerk_hub_pins=JSON.stringify({groups:state.ui.menu.groups,controls:state.ui.menu.controls});
    return C.clone({format:'zerkalius-hub',version:1,name:'',createdAt:new Date().toISOString(),settings,state});
  }
  function download(record){
    const {id,...portable}=record;const blob=new Blob([JSON.stringify(portable)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=(record.name.replace(/[<>:"/\\|?*\u0000-\u001f]/g,'-')||'Зеркалиус')+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
  }
  async function load(record){
    C.validate(record);
    const key='pending-'+crypto.randomUUID();
    await transaction(['meta'],'readwrite',tx=>tx.objectStore('meta').put(record,key));
    sessionStorage.setItem(PENDING,JSON.stringify({key,settings:record.settings}));choose(record.id);location.reload();
  }
  async function run(action){
    if(busy)return;busy=true;saveButton.disabled=true;
    try{await action();}catch(e){message('Не удалось: '+(e.message||e));}finally{busy=false;saveButton.disabled=false;}
  }
  async function rename(record,row){
    choose(record.id);if(row.querySelector('input'))return;
    const label=row.querySelector('.hubPresetName'),input=document.createElement('input');input.value=record.name;input.maxLength=160;input.setAttribute('aria-label','Название шаблона '+record.id);label.replaceWith(input);input.focus();input.select();let done=false;
    const finish=async commit=>{if(done)return;done=true;if(commit&&input.value.trim()){record.name=input.value.trim();await run(async()=>{await transaction(['presets'],'readwrite',tx=>tx.objectStore('presets').put(record));message('Название сохранено');});}await render();};
    input.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Enter'){e.preventDefault();finish(true);}else if(e.key==='Escape'){e.preventDefault();finish(false);}});
    input.addEventListener('blur',()=>finish(true));
  }
  async function render(){
    const records=await transaction(['presets'],'readonly',(tx,done)=>{const r=tx.objectStore('presets').getAll();r.onsuccess=()=>done(r.result);});
    list.replaceChildren();
    if(!records.length){const empty=document.createElement('p');empty.textContent='Пока пусто. Сохраните текущее состояние.';list.append(empty);}
    for(const record of records){
      const row=document.createElement('div');row.className='hubPresetRow';row.dataset.preset=String(record.id);row.dataset.selected=String(selected===record.id);
      const number=document.createElement('button');number.type='button';number.className='hubRhomb';number.textContent=record.id;number.setAttribute('aria-label','Открыть шаблон '+record.id+': '+record.name);
      const name=document.createElement('button');name.type='button';name.className='hubPresetName';name.textContent=record.name;name.title='Открыть · ПКМ — переименовать · Delete — удалить выбранный';
      for(const button of [number,name])button.onclick=()=>run(()=>load(record));
      const file=document.createElement('button');file.type='button';file.className='hubPresetDownload';file.textContent='↓';file.setAttribute('aria-label','Скачать шаблон '+record.id);file.onclick=()=>{choose(record.id);download(record);};
      row.append(number,name,file);row.addEventListener('contextmenu',e=>{e.preventDefault();e.stopPropagation();rename(record,row);});list.append(row);
    }
  }
  async function restorePending(){
    if(!boot)return;
    await run(async()=>{
      const record=C.validate(await read('meta',boot.key)),s=record.state;
      await HubImage.restore(s.image);HubScene.restore(s.scene);HubMirror.restore(s.mirror);HubView.restore(s.view);
      if(s.ui?.png){const select=document.querySelector('[aria-label="Разрешение PNG по длинной стороне"]');select.value=s.ui.png;select.dispatchEvent(new Event('change'));}
      if(s.ui?.zen)HubZen.restore(s.ui.zen);window.scrollTo(...(s.ui?.scroll||[0,0]));
      // Layout and the source raster must settle before restoring particle grids.
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      HubFlow.restore(s.flow);
      for(const node of document.querySelectorAll('#hubFieldTools details'))if((s.ui?.open||[]).includes(controlKey(node)))node.open=true;
      window.HubMenuLayout?.restore(s.ui?.menu);if(s.ui?.romb)window.HubRombGrid?.restore(s.ui.romb);
      sessionStorage.removeItem(PENDING);await transaction(['meta'],'readwrite',tx=>tx.objectStore('meta').delete(boot.key));
      message('Открыт: '+record.name);document.body.dataset.presetRestored=String(record.id);
    });
  }
  function init(){
    const tools=document.getElementById('hubFieldTools');if(!tools)return;
    const wrap=document.createElement('div');wrap.className='hubPresetControls';
    const make=(id,text,label)=>{const b=document.createElement('button');b.type='button';b.id=id;b.className='hubRhomb';b.textContent=text;b.title=label;b.setAttribute('aria-label',label);wrap.append(b);return b;};
    saveButton=make('hubSaveState','↓\nСохр.','Сохранить всё состояние в файл и шаблоны');
    const toggle=make('hubPresetList','▤\nШабл.','Открыть список шаблонов');toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls','hubPresetsPanel');tools.append(wrap);
    panel=document.createElement('section');panel.id='hubPresetsPanel';panel.hidden=true;panel.setAttribute('aria-label','Шаблоны Зеркалиуса');
    const head=document.createElement('header'),title=document.createElement('strong');title.textContent='Шаблоны';
    const close=document.createElement('button');close.textContent='×';close.setAttribute('aria-label','Закрыть список шаблонов');head.append(title,close);
    const show=on=>{panel.hidden=!on;toggle.setAttribute('aria-expanded',String(on));if(on)render().catch(e=>message(e.message));};
    toggle.onclick=()=>show(panel.hidden);close.onclick=()=>show(false);
    const hint=document.createElement('small');hint.textContent='Клик — открыть · ПКМ — название · Delete — удалить выбранный';
    list=document.createElement('div');list.className='hubPresetList';
    const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.hidden=true;input.setAttribute('aria-label','Файл состояния Зеркалиуса');
    const upload=document.createElement('button');upload.className='hubRhomb';upload.textContent='↑\nФайл';upload.setAttribute('aria-label','Загрузить состояние из файла');upload.onclick=()=>input.click();
    input.onchange=()=>run(async()=>{const file=input.files[0];input.value='';if(!file)return;if(file.size>128*1024*1024)throw Error('Файл больше 128 МБ');const record=await add(C.validate(JSON.parse(await file.text())),false);choose(record.id);await render();message('Добавлен: '+record.name+'. Кликните, чтобы открыть.');});
    status=document.createElement('div');status.id='hubPresetStatus';status.setAttribute('role','status');
    undoButton=document.createElement('button');undoButton.className='hubPresetUndo';undoButton.textContent='Вернуть удалённый';undoButton.hidden=true;
    undoButton.onclick=()=>run(async()=>{const record=await read('meta','deleted');if(record){await transaction(['presets','meta'],'readwrite',tx=>{tx.objectStore('presets').put(record);tx.objectStore('meta').delete('deleted');});choose(record.id);await render();message('Шаблон возвращён');}undoButton.hidden=true;});
    panel.append(head,hint,list,upload,input,undoButton);document.body.append(panel,status);
    read('meta','deleted').then(record=>{undoButton.hidden=!record;}).catch(()=>{});
    // Keep canvas gestures and toolbar pinning out of the editable library.
    for(const type of ['pointerdown','dblclick','wheel'])panel.addEventListener(type,e=>e.stopPropagation());
    saveButton.onclick=()=>run(async()=>{message('Сохраняю…');const record=await add(snapshot(),true);choose(record.id);download(record);await render();message(record.name+' — сохранён в браузере, файл подготовлен');});
    document.addEventListener('keydown',e=>{
      if(e.key==='Escape'&&!e.target.closest('input'))show(false);
      if(e.key!=='Delete'||e.repeat||e.ctrlKey||e.metaKey||e.altKey||!selected||e.target.closest('input,textarea,select,[contenteditable]:not([contenteditable=false])'))return;
      e.preventDefault();const id=selected;run(async()=>{await transaction(['presets','meta'],'readwrite',tx=>{const store=tx.objectStore('presets'),r=store.get(id);r.onsuccess=()=>{if(r.result)tx.objectStore('meta').put(r.result,'deleted');store.delete(id);};});choose(0);undoButton.hidden=false;await render();message('Шаблон '+id+' удалён. Его можно вернуть в списке.');});
    });
    setTimeout(restorePending,0);
  }
  document.addEventListener('DOMContentLoaded',()=>setTimeout(init,0),{once:true});
})();
