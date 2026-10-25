/* Named button presets, separate from field/frame and template storage. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikSettingsLibrary=api;})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const KEY='settings-library-v1';
  const STATE_KEYS=('speed outline sym symBits symRowsMin symRowsMax symBitsMin symBitsMax symV symH symD symPlainV symPlainH symPlainD symTriangles symTriangleRows frozen ochki ochkiMode ochkiInv ochkiRev ochkiPattern ochkiLength bitOneColour bitZeroColour overOneColour overZeroColour digitOneColour digitZeroColour digitFont digitSize geomCenter fixLines blackMirror animHl fillArea fillGrow paintMeet paintAxis paintMid midOneOn midZeroOn midWide midOneColour midZeroColour verticalFillColour stolbFillColour triTop thirds zsnap zbase zLock zoom zMid ztop zBot linesOn contour mirCol mirOp rowLab heat sectors areas fixWide fixLow fixLowOut fixMirror fixFold fixRot fixHor fixCross fixAxis fixDown fixDragK sawFull saw lineMeasures').split(' ');
  const TOOL_KEYS=['fillMode','autoVertical','axisPicking','axisLineMode','rulerMode','mirrorLine','mirrorAxis','templatePickEnabled','templatePickMode'];
  const clone=value=>JSON.parse(JSON.stringify(value));
  function pick(state,tools={},controls={},colourAuto={}){
    const values={};for(const key of STATE_KEYS){const v=state[key];values[key]=v===undefined?null:v;}
    const modes={};for(const key of TOOL_KEYS)modes[key]=tools[key]??(key==='templatePickMode'?'one':key==='autoVertical'?0:false);
    const clocks={};for(const key of ['fillColour','verticalFillColour','stolbFillColour','midZeroColour','midOneColour']){const q=colourAuto[key];if(q&&['off','build','frame'].includes(q.mode)&&/^#[0-9a-f]{6}$/i.test(q.color))clocks[key]={mode:q.mode,color:q.color};}
    return {version:1,colourAuto:clocks,state:values,parity:Object.fromEntries(['cellsEven','cellsOdd','rowsEven','rowsOdd'].map(k=>[k,state.parity?.[k]!==false])),tools:modes,controls:{fillColour:controls.fillColour||'#ff7f27',fillMirror:controls.fillMirror!==false}};
  }
  function validate(value){
    if(!value||value.version!==1||!value.state||!value.tools||!value.parity||!/^#[0-9a-f]{6}$/i.test(value.controls?.fillColour))throw Error('Повреждён набор настроек');
    for(const k of STATE_KEYS){const v=value.state[k];if(v!==null&&typeof v!=='boolean'&&typeof v!=='string'&&!(typeof v==='number'&&Number.isFinite(v)))throw Error('Некорректная настройка: '+k);}
    for(const k of TOOL_KEYS){const v=value.tools[k];if(k==='autoVertical'?![0,1,2].includes(v):k==='templatePickMode'?!['one','add'].includes(v):typeof v!=='boolean')throw Error('Некорректный режим: '+k);}
    return pick(value.state,value.tools,value.controls,value.colourAuto);
  }
  function normalized(value){const next=validate(value);for(const k in next.parity)next.parity[k]=value.parity[k]!==false;return next;}
  function applyState(state,snapshot){const data=normalized(snapshot);for(const key of STATE_KEYS){if(data.state[key]===null)delete state[key];else state[key]=data.state[key];}state.parity={...data.parity};return data;}
  const signature=value=>JSON.stringify(normalized(value));
  function create(host){
    let items=[],selectedId=null,busy=true,message='Загрузка настроек…',serial=0,queue=Promise.resolve();const listeners=new Set();
    const emit=()=>{for(const fn of listeners)try{fn(getState());}catch(_){}};
    const getState=()=>{let selected=items.find(e=>e.id===selectedId);try{if(selected&&signature(host.capture())!==signature(selected.snapshot))selected=null;}catch(_){selected=null;}return {busy,message,selectedId:selected?.id||null};};
    const ready=Promise.resolve().then(async()=>{const saved=await host.storage.read(KEY);if(saved!=null){if(saved.version!==1||!Array.isArray(saved.items))throw Error('Неизвестный формат библиотеки настроек');items=saved.items.map(e=>{if(typeof e.id!=='string'||!e.id||typeof e.name!=='string'||!e.name.trim())throw Error('Повреждён список настроек');return {...e,snapshot:normalized(e.snapshot)};});if(new Set(items.map(e=>e.id)).size!==items.length)throw Error('Повторяющиеся наборы настроек');}message='Наборов: '+items.length;}).catch(e=>{message=e.message;throw e;}).finally(()=>{busy=false;emit();});ready.catch(()=>{});
    function run(label,fn){const result=queue.then(async()=>{await ready;busy=true;message=label;emit();try{return await fn();}catch(e){message=e.message;throw e;}finally{busy=false;emit();}});queue=result.catch(()=>{});return result;}
    async function write(next){await host.storage.write({version:1,items:clone(next)},KEY);items=next;}
    function find(id){const item=items.find(e=>e.id===id);if(!item)throw Error('Набор настроек не найден');return item;}
    return {ready,idle:()=>queue,getState,subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},refresh:emit,
      list:()=>items.map(({snapshot,...entry})=>({...entry,summary:'Режимы · цвета',thumbnail:'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><path fill="none" stroke="#b48cff" stroke-width="2" d="M3 8h26M3 16h26M3 24h26M10 4v8M22 12v8M14 20v8"/></svg>')})),
      save(name){return run('Сохранение настроек…',async()=>{const snapshot=normalized(host.capture()),id=Date.now().toString(36)+'-'+(++serial)+'-'+Math.random().toString(36).slice(2,8),entry={id,name:String(name||'Набор '+(items.length+1)).trim(),createdAt:Date.now(),snapshot};await write([...items,entry]);selectedId=id;message='Сохранено: '+entry.name;return id;});},
      open(id){return run('Применение настроек…',async()=>{const item=find(id);await host.restore(clone(item.snapshot));selectedId=id;message='Применено: '+item.name;return id;});},
      rename(id,name){return run('Переименование…',async()=>{find(id);name=String(name||'').trim();if(!name)throw Error('Введите название');await write(items.map(e=>e.id===id?{...e,name}:e));message='Переименовано: '+name;});},
      remove(id){return run('Удаление набора…',async()=>{find(id);await write(items.filter(e=>e.id!==id));if(selectedId===id)selectedId=null;message='Набор удалён';});},
      download(id){return run('Скачивание настроек…',async()=>{const item=find(id);await host.download(new Blob([JSON.stringify(item.snapshot,null,2)],{type:'application/json'}),item.name);message='Настройки скачаны';});}
    };
  }
  return {create,pick,applyState,normalized,KEY,STATE_KEYS,TOOL_KEYS};
});
