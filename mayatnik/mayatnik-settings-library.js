/* Named button presets, separate from field/frame and template storage. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikSettingsLibrary=api;})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const Follow=typeof module==='object'&&module.exports?require('./mayatnik-template-follow.js'):globalThis.MayatnikTemplateFollow;
  const Batch=typeof module==='object'&&module.exports?require('./mayatnik-template-batch.js'):globalThis.MayatnikTemplateBatch;
  const Parity=typeof module==='object'&&module.exports?require('../_js/grid-parity.js'):globalThis.ZerkGridParity;
  const Pit=typeof module==='object'&&module.exports?require('./mayatnik-pit-copies.js'):globalThis.MayatnikPitCopies;
  const KEY='settings-library-v1';
  const STATE_KEYS=('rowStepOutline joined180 templateFindAll templateFrameSearch templateFrameSearchName speed outline sym symBits symRowsMin symRowsMax symBitsMin symBitsMax symV symH symD symPlainV symPlainH symPlainD symTriangles symTriangleRows frozen ochki ochkiThrough ochkiSkipSpaces ochkiEveryFrame ochkiRowReverseMask gifScaleStack gifScaleStackStep ochkiSnake manualSnake ochkiMode ochkiInv ochkiRev ochkiHalf ochkiPattern ochkiLength bitOneColour bitZeroColour bitContourColour1 bitContourColour2 bitContourMode bitContourColours overOneColour overZeroColour digitOneColour digitZeroColour digitFont digitSize geomCenter fixLines blackMirror animHl fillArea fillWholeColour paintFrameMode paintSame paintSymmetric fillGrow paintMeet paintAxis paintMid midOneOn midZeroOn midWide midOneColour midZeroColour verticalFillColour stolbFillColour axesFillColour autoFillColour growFillColour meetFillColour axisFillColour isolatedOneColour isolatedZeroColour autoFillPalette growOwnColour triTop thirds zsnap zbase zLock zLimit zOverview zoom zMid ztop zBot linesOn lineFamilies contour mirCol mirOp rowLab heat sectors areas fixWide fixLow fixLowOut fixMirror fixFold fixRot fixHor fixCross fixAxis fixDown fixDragK sawFull saw lineMeasures templateMaxArea viewUpsideDown autoAxes triangleMapSource triangleMapAxes triangleMapMask triangleMapMirror axisPalette crossMirror crossLabels crossMirrorMode crossMirrorSector').split(' ');
  const NEW_STATE_KEYS=new Set('templateFrameSearch templateFrameSearchName ochkiThrough ochkiSkipSpaces ochkiEveryFrame ochkiRowReverseMask gifScaleStack gifScaleStackStep zLimit zOverview paintFrameMode fillWholeColour rowStepOutline ochkiHalf joined180 manualSnake lineFamilies autoAxes triangleMapSource triangleMapAxes triangleMapMask triangleMapMirror axisPalette crossMirror crossLabels crossMirrorMode crossMirrorSector viewUpsideDown axesFillColour autoFillColour growFillColour meetFillColour axisFillColour isolatedOneColour isolatedZeroColour autoFillPalette growOwnColour'.split(' '));
  const THROUGH_DEFAULTS={templateFrameSearch:null,templateFrameSearchName:'',ochkiThrough:false,ochkiSkipSpaces:false,ochkiEveryFrame:false,ochkiRowReverseMask:false,gifScaleStack:false,gifScaleStackStep:8,gifScaleStackPhasePage:0,gifScaleStackMethod:'canvas',gifScaleStackMode:'rows',gifScaleStackBase:2,gifScaleStackHeight:'original'};
  const INVERT_DEFAULTS={invertKind:'bits',inverted:false,invertAuto:false,invertFrame:null};
  const ISOLATED_DEFAULTS={paintIsolated0:false,paintIsolated1:false,paintEmptyNeighbours:false};
  for(const key of ['kraftShadows','heatHoldZero','heatMode','heatPeriod','edgeRhombOn','romboRow','romboAngle','romboAssembly','romboSeam',...Object.keys(INVERT_DEFAULTS),...Object.keys(ISOLATED_DEFAULTS)]){STATE_KEYS.push(key);NEW_STATE_KEYS.add(key);}
  STATE_KEYS.push('gifScaleStackPhasePage','gifScaleStackHeight','gifScaleStackMethod','gifScaleStackMode','gifScaleStackBase');NEW_STATE_KEYS.add('gifScaleStackPhasePage');NEW_STATE_KEYS.add('gifScaleStackHeight');NEW_STATE_KEYS.add('gifScaleStackMethod');NEW_STATE_KEYS.add('gifScaleStackMode');NEW_STATE_KEYS.add('gifScaleStackBase');
  for(const key of Object.keys(Pit.DEFAULTS)){STATE_KEYS.push(key);NEW_STATE_KEYS.add(key);}
  STATE_KEYS.push('excelDigitPalette','animatrixStaggeredGrid','staggeredGrid','staggeredBlocks');
  NEW_STATE_KEYS.add('excelDigitPalette');
  NEW_STATE_KEYS.add('animatrixStaggeredGrid');
  NEW_STATE_KEYS.add('staggeredGrid');
  NEW_STATE_KEYS.add('staggeredBlocks');
  const TOOL_KEYS=['fillMode','autoVertical','axisPicking','axisLineMode','rulerMode','mirrorLine','mirrorAxis','templatePickEnabled','templatePickMode','templateDragEnabled'];
  const clone=value=>JSON.parse(JSON.stringify(value));
  function pick(state,tools={},controls={},colourAuto={}){
    const values={};for(const key of STATE_KEYS){const v=state[key];values[key]=v===undefined?null:key==='lineFamilies'||key==='templateFindAll'||key==='templateFrameSearch'?clone(v):v;}
    for(const [key,value]of Object.entries({...INVERT_DEFAULTS,...THROUGH_DEFAULTS}))if(state[key]===undefined)values[key]=value;
    for(const [key,value]of Object.entries(ISOLATED_DEFAULTS))if(state[key]===undefined)values[key]=value;
    Object.assign(values,Pit.normalize(state));
    const modes={};for(const key of TOOL_KEYS)modes[key]=tools[key]??(key==='templatePickMode'?'one':key==='autoVertical'?0:false);
    const clocks={};for(const key of ['fillColour','verticalFillColour','stolbFillColour','midZeroColour','midOneColour','axesFillColour','autoFillColour','growFillColour','meetFillColour','axisFillColour','isolatedOneColour','isolatedZeroColour']){const q=colourAuto[key];if(q&&['off','build','frame'].includes(q.mode)&&/^#[0-9a-f]{6}$/i.test(q.color))clocks[key]={mode:q.mode,color:q.color};}
    return {version:1,colourAuto:clocks,state:values,parity:Parity.normalize(state.parity),tools:modes,controls:{fillColour:controls.fillColour||'#ff7f27',fillMirror:controls.fillMirror!==false}};
  }
  function validate(value){
    if(!value||value.version!==1||!value.state||!value.tools||!value.parity||!/^#[0-9a-f]{6}$/i.test(value.controls?.fillColour))throw Error('Повреждён набор настроек');
    Pit.normalize(value.state,true);
    if(value.state.ochkiThrough!==undefined&&typeof value.state.ochkiThrough!=='boolean')throw Error('Некорректный режим Все сквозные');
    for(const key of Object.keys(ISOLATED_DEFAULTS))if(value.state[key]!==undefined&&typeof value.state[key]!=='boolean')throw Error('Некорректная настройка окраски: '+key);
    for(const key of ['inverted','invertAuto'])if(value.state[key]!==undefined&&typeof value.state[key]!=='boolean')throw Error('Некорректная инверсия: '+key);
    if(value.state.invertKind!==undefined&&!['bits','colour'].includes(value.state.invertKind))throw Error('Некорректный вид инверсии');
    if(value.state.invertFrame!=null&&(!Number.isSafeInteger(value.state.invertFrame)||value.state.invertFrame<0))throw Error('Некорректный кадр инверсии');
    if(value.state.edgeRhombOn!=null&&typeof value.state.edgeRhombOn!=='boolean')throw Error('Некорректный режим Ромбо');
    if(value.state.romboSeam!=null&&!['between','dedupe'].includes(value.state.romboSeam))throw Error('Некорректный шов Ромбо');
    for(const [key,max]of [['romboRow',1048576],['romboAngle',315],['romboAssembly',17]])if(value.state[key]!=null&&(!Number.isInteger(value.state[key])||value.state[key]<(key==='romboRow'?1:0)||value.state[key]>max||key==='romboAngle'&&value.state[key]%45))throw Error('Некорректная настройка Ромбо: '+key);
    for(const k of STATE_KEYS){const v=value.state[k];if(k==='templateFrameSearch'){if(v!=null){if(!Batch)throw Error('Поиск папки недоступен в этой странице');Batch.normalize(v);}continue;}if(k==='templateFindAll'){if(v!=null){if(!Follow)throw Error('Поиск шаблона недоступен в этой странице');Follow.normalize(v);}continue;}if(k==='lineFamilies'&&v!=null){if(typeof v!=='object'||Array.isArray(v)||!['h','v','d'].every(key=>typeof v[key]==='boolean')||Object.keys(v).length!==3)throw Error('Некорректная настройка: '+k);continue;}if((NEW_STATE_KEYS.has(k)||k==='templateMaxArea'||k==='ochkiSnake'||k==='bitContourColour1'||k==='bitContourColour2'||k==='bitContourMode'||k==='bitContourColours')&&v===undefined)continue;if(v!==null&&typeof v!=='boolean'&&typeof v!=='string'&&!(typeof v==='number'&&Number.isFinite(v)))throw Error('Некорректная настройка: '+k);}
    if(value.state.heatHoldZero!=null&&typeof value.state.heatHoldZero!=='boolean')throw Error('Некорректный режим сохранения тепла на нуле');
    if(value.state.heatPeriod!=null&&(!Number.isInteger(value.state.heatPeriod)||value.state.heatPeriod<1||value.state.heatPeriod>64))throw Error('Некорректный период тепла');
    for(const [key,values]of [['heatMode',['all','one','zero','alternate']],['paintFrameMode',['off','colour','cells']],['bitContourMode',['single','same','double','directional']],['bitContourColours',['auto','custom']],['triangleMapSource',['static','time']],['axisPalette',['purple-black','purple-red']],['crossMirrorMode',['lr','rl','tb','bt','sector']],['crossMirrorSector',['A1','A2','B1','B2','a1','a2','b1','b2','C1','C2']]])if(value.state[key]!=null&&!values.includes(value.state[key]))throw Error('Некорректная настройка: '+key);
    for(const key of ['ochkiThrough','ochkiSkipSpaces','ochkiEveryFrame','ochkiRowReverseMask','gifScaleStack','zLimit','zOverview','fillWholeColour','rowStepOutline','ochkiHalf','joined180','kraftShadows','autoAxes','triangleMapAxes','triangleMapMask','triangleMapMirror','crossMirror','crossLabels','viewUpsideDown','autoFillPalette','growOwnColour'])if(value.state[key]!=null&&typeof value.state[key]!=='boolean')throw Error('Некорректная настройка: '+key);
    for(const key of ['axesFillColour','autoFillColour','growFillColour','meetFillColour','axisFillColour','isolatedOneColour','isolatedZeroColour'])if(value.state[key]!=null&&!/^#[0-9a-f]{6}$/i.test(value.state[key]))throw Error('Некорректный цвет: '+key);
    if(value.state.gifScaleStackPhasePage!=null&&(!Number.isInteger(value.state.gifScaleStackPhasePage)||value.state.gifScaleStackPhasePage<0||value.state.gifScaleStackPhasePage>1562499))throw Error('Некорректная страница фаз');
    if(value.state.gifScaleStackMethod==='nearest')value.state.gifScaleStackMethod='canvas';
    if(value.state.gifScaleStackMethod!=null&&!['phases','viewport','canvas','average'].includes(value.state.gifScaleStackMethod))throw Error('Некорректный способ уменьшения');
    if(value.state.gifScaleStackHeight!=null&&!['original','cell','native','integer'].includes(value.state.gifScaleStackHeight))throw Error('Некорректная высота нижних построений');
    if(value.state.gifScaleStackMode!=null&&!['rows','powers','multiples'].includes(value.state.gifScaleStackMode))throw Error('Некорректный вариант уменьшения');
    if(value.state.gifScaleStackBase!=null&&(!Number.isInteger(value.state.gifScaleStackBase)||value.state.gifScaleStackBase<2||value.state.gifScaleStackBase>10000))throw Error('Некорректное число x');
    if(value.state.gifScaleStackStep!=null&&(!Number.isInteger(value.state.gifScaleStackStep)||value.state.gifScaleStackStep<1||value.state.gifScaleStackStep>65535))throw Error('Некорректный шаг высоты нижних треугольников');
    if(value.state.templateMaxArea!=null&&(!Number.isInteger(value.state.templateMaxArea)||value.state.templateMaxArea<0||value.state.templateMaxArea>1048576))throw Error('Некорректная максимальная площадь шаблона');
    for(const k of TOOL_KEYS){const v=k==='templateDragEnabled'&&value.tools[k]===undefined?false:value.tools[k];if(k==='autoVertical'?![0,1,2].includes(v):k==='templatePickMode'?!['one','add'].includes(v):typeof v!=='boolean')throw Error('Некорректный режим: '+k);}
    return pick(value.state,value.tools,value.controls,value.colourAuto);
  }
  function normalized(value){const next=validate(value);next.state.ochkiThrough=value.state.ochkiThrough===true;next.state.ochkiSkipSpaces=value.state.ochkiSkipSpaces===true;next.state.ochkiEveryFrame=value.state.ochkiEveryFrame===true;next.state.ochkiRowReverseMask=value.state.ochkiRowReverseMask===true;next.state.gifScaleStack=value.state.gifScaleStack===true;next.parity=Parity.normalize(value.parity);if(![1,3,4,6,9,11,12,14,16,17].includes(next.state.romboAssembly))next.state.romboAssembly=16;next.state.romboSeam=next.state.romboSeam==='dedupe'?'dedupe':'between';return next;}
  function applyState(state,snapshot){const data=normalized(snapshot);for(const key of STATE_KEYS){if(data.state[key]===null&&key!=='invertFrame')delete state[key];else state[key]=data.state[key];}state.parity={...data.parity};return data;}
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
      exportItem(id){const item=find(id),snapshot=clone(item.snapshot);return {id:item.id,name:item.name,files:[{extension:'.settings.json',blob:new Blob([JSON.stringify(snapshot,null,2)],{type:'application/json'})}]};},
      download(id){return run('Скачивание настроек…',async()=>{const item=find(id);await host.download(new Blob([JSON.stringify(item.snapshot,null,2)],{type:'application/json'}),item.name);message='Настройки скачаны';});}
    };
  }
  return {create,pick,applyState,normalized,KEY,STATE_KEYS,TOOL_KEYS};
});
