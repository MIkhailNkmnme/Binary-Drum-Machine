/* Versioned seeds and source state for fixed-field Animatrix calculations.
 * A seed owns its geometry; the shared transport advances rows or matrices.
 * Packed words are little-endian RGB24 + six independent state flags.
 */
(function(root,factory){
  const Core=typeof module==='object'&&module.exports?require('./mayatnik-animatrix-core.js'):root.MayatnikAnimatrixCore;
  const api=factory(Core);
  if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikAnimatrixSource=api;
})(typeof globalThis==='object'?globalThis:this,function(Core){
  'use strict';
  const VERSION=1,EVOLUTION=1,MAX_CELLS=2100000,MAX_ROWS=4096,MAX_AREAS=65536;
  const ALGORITHMS=Core.algorithms;
  const excelMode=algorithm=>Core.excelAlgorithms.includes(algorithm);
  const interxorMode=algorithm=>algorithm==='excelChain'||algorithm==='excelChainDown';
  const DIRECTIONS=['down','up','left','right'];
  const checked=new WeakMap();
  const fail=message=>{throw Error(message);};
  function defaults(){return {animatrixOn:false,animatrixSource:null,animatrixAlgorithm:'two',animatrixTiming:'rows',animatrixDirection:'down',animatrixCycles:1,animatrixCycleMode:'finite',animatrixFrameMax:0,animatrixColours:'inherit',animatrixEvolution:EVOLUTION};}
  function dimensions(width,height){
    if(!Number.isSafeInteger(width)||width<1||!Number.isSafeInteger(height)||height<8||height>MAX_ROWS)fail('Некорректный размер исходника Аниматрицы: высота от 8 до 4096 строк.');
    const n=width*height;if(!Number.isSafeInteger(n)||n>MAX_CELLS)fail('Исходник Аниматрицы превышает 2 100 000 клеток.');return n;
  }
  function anchorValue(anchor,width){if(!Number.isSafeInteger(anchor)||anchor<0||anchor>=width)fail('Некорректный якорь исходника Аниматрицы.');return anchor;}
  function validateAreas(areas,width,height){
    if(areas==null)return null;
    if(!Array.isArray(areas)||areas.length>Math.min(MAX_AREAS,width*height))fail('Некорректное выделение Аниматрицы.');
    return areas.map(a=>{
      if(!a||!['x','y','width','height'].every(k=>Number.isSafeInteger(a[k]))||a.x<0||a.y<0||a.width<1||a.height<1||a.x+a.width>width||a.y+a.height>height)fail('Выделение Аниматрицы выходит за исходное поле.');
      return {x:a.x,y:a.y,width:a.width,height:a.height};
    });
  }
  function bytesToBase64(bytes){
    if(typeof Buffer!=='undefined')return Buffer.from(bytes).toString('base64');
    let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(binary);
  }
  function base64ToBytes(text,maxBytes){
    if(typeof text!=='string'||text.length>4*Math.ceil(maxBytes/3)||text.length%4||!/^[A-Za-z0-9+/]*={0,2}$/.test(text))fail('Повреждён код исходника Аниматрицы.');
    let bytes;
    try{
      if(typeof Buffer!=='undefined')bytes=Uint8Array.from(Buffer.from(text,'base64'));
      else{const binary=atob(text);bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);}
    }catch(_){fail('Повреждён код исходника Аниматрицы.');}
    if(bytes.length>maxBytes)fail('Код исходника Аниматрицы превышает размер поля.');return bytes;
  }
  function pack(words){
    let runs=0,last=-1;
    for(let i=0;i<words.length;i++)if(i===0||words[i]!==last){runs++;last=words[i];}
    const compressed=runs*2<words.length,bytes=new Uint8Array((compressed?runs*2:words.length)*4),view=new DataView(bytes.buffer);
    if(compressed){
      let out=0,start=0;
      for(let i=1;i<=words.length;i++)if(i===words.length||words[i]!==words[start]){view.setUint32(out,(i-start),true);view.setUint32(out+4,words[start],true);out+=8;start=i;}
    }else for(let i=0;i<words.length;i++)view.setUint32(i*4,words[i],true);
    return {mode:compressed?'rle':'raw',data:bytesToBase64(bytes)};
  }
  function unpack(value,n){
    if(!value||!['raw','rle'].includes(value.mode))fail('Неизвестный формат исходника Аниматрицы.');
    const bytes=base64ToBytes(value.data,n*4),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),words=new Uint32Array(n);
    if(value.mode==='raw'){
      if(bytes.length!==n*4)fail('Неверная длина исходника Аниматрицы.');
      for(let i=0;i<n;i++)words[i]=view.getUint32(i*4,true);
    }else{
      if(!bytes.length||bytes.length%8)fail('Повреждены серии исходника Аниматрицы.');
      let at=0;
      for(let i=0;i<bytes.length;i+=8){const count=view.getUint32(i,true),word=view.getUint32(i+4,true);if(!count||count>n-at)fail('Повреждена длина серии исходника Аниматрицы.');words.fill(word,at,at+count);at+=count;}
      if(at!==n)fail('Серии исходника Аниматрицы не заполняют поле.');
    }
    return words;
  }
  function signature(source,areas){return [source.version,source.width,source.height,source.anchor,source.words?.mode,source.words?.data,source.fills?.mode??'',source.fills?.data??'',JSON.stringify(areas)];}
  function assertSource(source){
    if(!source||typeof source!=='object'||Array.isArray(source)||source.version!==VERSION)fail('Неизвестная версия исходника Аниматрицы.');
    const n=dimensions(source.width,source.height);anchorValue(source.anchor,source.width);
    const areas=validateAreas(source.areas,source.width,source.height),stamp=signature(source,areas),old=checked.get(source);
    if(old&&old.stamp.every((value,index)=>value===stamp[index]))return source;
    const words=unpack(source.words,n),fills=source.fills==null?null:unpack(source.fills,n);
    let singleGrid=true;
    for(let i=0;i<n;i++){
      const flags=words[i]>>>24;
      if((flags&17)&&((i%source.width-source.anchor-Math.floor(i/source.width))&1))singleGrid=false;
      if(flags&192||!(flags&1)&&(flags&2))fail('Повреждены состояния клеток Аниматрицы.');
      if(fills&&fills[i]>0xffffff)fail('Повреждён цвет заливки Аниматрицы.');
    }
    if(areas){
      const mask=new Uint8Array(n);
      for(const a of areas)for(let y=a.y;y<a.y+a.height;y++)mask.fill(1,y*source.width+a.x,y*source.width+a.x+a.width);
      for(let i=0;i<n;i++)if(mask[i]!==((words[i]>>>29)&1))fail('Области выделения не совпадают с маской Аниматрицы.');
    }
    checked.set(source,{stamp,key:null,singleGrid});return source;
  }
  function decode(source){
    assertSource(source);const n=source.width*source.height,words=unpack(source.words,n),fills=source.fills?unpack(source.fills,n):new Uint32Array(n);
    const seed={width:source.width,height:source.height,bits:new Uint8Array(n),present:new Uint8Array(n),colours:new Uint32Array(n),bold:new Uint8Array(n),automatic:new Uint8Array(n),filled:new Uint8Array(n),fills,selection:new Uint8Array(n)};
    for(let i=0;i<n;i++){const flags=words[i]>>>24;seed.present[i]=flags&1;seed.bits[i]=(flags>>>1)&1;seed.bold[i]=(flags>>>2)&1;seed.automatic[i]=(flags>>>3)&1;seed.filled[i]=(flags>>>4)&1;seed.selection[i]=(flags>>>5)&1;seed.colours[i]=words[i]&0xffffff;}
    if(source.areas!=null)seed.areas=validateAreas(source.areas,source.width,source.height);
    return seed;
  }
  function encode(seed,options={}){
    if(!seed||typeof seed!=='object')fail('Не задан исходник Аниматрицы.');
    const anchor=options?.anchor??Math.floor((seed.width-1)/2);
    const n=dimensions(seed.width,seed.height);anchorValue(anchor,seed.width);
    for(const key of ['bits','present','colours','bold','automatic','fills','filled','selection']){
      const values=seed[key];if(values==null)continue;
      if(values.length!==n)fail('Неверная длина массива '+key+' исходника Аниматрицы.');
      for(let i=0;i<n;i++){
        const v=values[i];
        if(!Number.isInteger(v)||(key==='bits'?![-1,0,1].includes(v):key==='colours'||key==='fills'?v<0||v>0xffffff:v!==0&&v!==1))fail('Некорректный массив '+key+' исходника Аниматрицы.');
      }
    }
    validateAreas(seed.areas,seed.width,seed.height);
    const copy=Core.cloneSeed(seed),words=new Uint32Array(n),fills=new Uint32Array(n);let anyFillColour=false;
    for(let i=0;i<n;i++){
      const flags=copy.present[i]|(copy.bits[i]<<1)|(copy.bold[i]<<2)|(copy.automatic[i]<<3)|(copy.filled[i]<<4)|(copy.selection[i]<<5);
      words[i]=(copy.colours[i]|(flags<<24))>>>0;
      fills[i]=copy.filled[i]?copy.fills[i]:0;if(fills[i])anyFillColour=true;
    }
    const source={version:VERSION,width:seed.width,height:seed.height,anchor,words:pack(words)};
    if(anyFillColour)source.fills=pack(fills);
    if(seed.areas!=null)source.areas=copy.areas.map(a=>({...a}));
    assertSource(source);return source;
  }
  function active(state){return state?.animatrixOn===true;}
  function restoreFrame(state,frame,unit=state?.animatrixCopyRowsUnit){
    if(!active(state)||state.animatrixAlgorithm!=='copyRows'||state.animatrixCopyRowsLayout!==undefined||unit==='row'||!Number.isSafeInteger(frame)||frame<=0)return frame;
    const height=state.animatrixSource?.height??state.rows;
    if(!Number.isSafeInteger(height)||height<3)return frame;
    // v0.959 counted a growing group of rows as one frame.
    const rows=height-2,batches=Math.ceil((Math.sqrt(1+8*rows)-1)/2),partial=frame%batches;
    return Math.min(Number.MAX_SAFE_INTEGER,Math.floor(frame/batches)*rows+partial*(partial+1)/2);
  }
  function normalize(state){
    if(!state||typeof state!=='object'||Array.isArray(state))fail('Не заданы параметры Аниматрицы.');
    const next={...defaults(),...state};
    if(typeof next.animatrixOn!=='boolean'||!ALGORITHMS.includes(next.animatrixAlgorithm)||!['matrix','rows'].includes(next.animatrixTiming)||!DIRECTIONS.includes(next.animatrixDirection)||!['inherit','bits'].includes(next.animatrixColours))fail('Неизвестный режим Аниматрицы.');
    if(!Number.isSafeInteger(next.animatrixCycles)||next.animatrixCycles<1||next.animatrixCycles>64)fail('Число циклов Аниматрицы должно быть от 1 до 64.');
    if(!['finite','infinite','repeat'].includes(next.animatrixCycleMode))fail('Неизвестный режим циклов Аниматрицы.');
    if(!Number.isSafeInteger(next.animatrixFrameMax)||next.animatrixFrameMax<0)fail('Некорректная граница кадров Аниматрицы.');
    if(next.animatrixEvolution!==EVOLUTION)fail('Работа сохранена с другой версией расчёта Аниматрицы.');
    if(next.animatrixAlgorithm==='copyRows'){
      next.animatrixFrameMax=restoreFrame(next,next.animatrixFrameMax);
      if(Number.isSafeInteger(next.invertFrame))next.invertFrame=restoreFrame(next,next.invertFrame);
      next.animatrixCopyRowsUnit='row';
      if(next.animatrixCopyRowsLayout!==undefined&&!['mirror','mirrorByAxis','mirrorWrap','mirrorExcel'].includes(next.animatrixCopyRowsLayout))
        fail('Неизвестный порядок отражения строк Аниматрицы.');
      next.animatrixTiming='rows';
    }
    if(excelMode(next.animatrixAlgorithm)){
      next.animatrixTiming='matrix';
      next.animatrixDirection='down';
      next.animatrixExcelDepth=next.animatrixExcelDepth??128;
      if(!Number.isSafeInteger(next.animatrixExcelDepth)||next.animatrixExcelDepth<1||next.animatrixExcelDepth>MAX_ROWS)
        fail('Глубина треугольника должна быть от 1 до 4096 строк.');
    }
    if(next.animatrixTiming==='rows')next.animatrixDirection='down';
    if(active(next)){
      if(next.sequenceSourceOn||next.compareSource)fail('В Аниматрице одновременно включены разные источники поля.');
      assertSource(next.animatrixSource);
      if(next.animatrixAlgorithm==='copyRows'&&!checked.get(next.animatrixSource).singleGrid)
        fail('Для отражения строк возьмите поле с одной решёткой, например треугольник в виде «Встык».');
      if(next.rows!==undefined&&next.rows!==next.animatrixSource.height)fail('Число строк не совпадает с исходником Аниматрицы.');
    }
    return next;
  }
  function assertState(state){return normalize(state);}
  function geometry(state){const s=normalize(state),source=assertSource(s.animatrixSource);return {W:source.width,H:source.height,anchor:source.anchor};}
  const unlimited=state=>!!state&&['infinite','repeat'].includes(state.animatrixCycleMode);
  const copyRowsByAxis=layout=>layout==='mirrorByAxis'||layout==='mirrorWrap'||layout==='mirrorExcel';
  function excelOptions(source,algorithm,depth){
    return {algorithm,excelAnchor:source.anchor,excelDepth:depth};
  }
  function prepareExcel(source,algorithm,{resetFonts=true}={}){
    const seed=decode(source);
    if(resetFonts){seed.colours.fill(0);seed.bold.fill(0);seed.automatic.fill(1);}
    const width=seed.width,height=seed.height;
    const required=interxorMode(algorithm)?Core.interxorWidth(seed,excelOptions(source,algorithm)):width;
    const capacity=Math.floor(MAX_CELLS/height);
    const room=Math.min(source.anchor,width-1-source.anchor);
    const pad=interxorMode(algorithm)?Math.min(Math.floor((capacity-width)/2),Math.max(0,Math.ceil((required-1)/2-room))):0;
    if(!pad)return encode(seed,{anchor:source.anchor});
    const expandedWidth=width+2*pad,expanded={width:expandedWidth,height};
    for(const [key,values] of Object.entries(seed)){
      if(!ArrayBuffer.isView(values))continue;
      const target=new values.constructor(expandedWidth*height);
      for(let y=0;y<height;y++)target.set(values.subarray(y*width,(y+1)*width),y*expandedWidth+pad);
      expanded[key]=target;
    }
    if(seed.areas)expanded.areas=seed.areas.map(a=>a.x===0&&a.width===width?{...a,width:expandedWidth}:{...a,x:a.x+pad});
    return encode(expanded,{anchor:source.anchor+pad});
  }
  function cycleFrames(state){
    const s=normalize(state),source=assertSource(s.animatrixSource),layout=s.animatrixCopyRowsLayout;
    const algorithm=s.animatrixAlgorithm;
    if(excelMode(algorithm)){
      const record=checked.get(source),options=excelOptions(source,algorithm,s.animatrixExcelDepth);
      const key=algorithm+':'+s.animatrixExcelDepth;
      record.excelCycles??=new Map();
      if(!record.excelCycles.has(key))record.excelCycles.set(key,Core.excelCycleFrames(decode(source),options));
      return record.excelCycles.get(key);
    }
    if(algorithm==='copyRows')return Core.copyRowsCycleFrames(source.height,!!layout,copyRowsByAxis(layout),layout==='mirrorWrap');
    return s.animatrixTiming==='rows'?source.height-1:source.height;
  }
  function frames(state){const s=normalize(state),cycle=cycleFrames(s);return unlimited(s)?Math.max(cycle,s.animatrixFrameMax):cycle*s.animatrixCycles;}
  function extend(state,requested){
    frameCount(requested);const cycle=cycleFrames(state);
    return {animatrixFrameMax:Math.max(frames(state),Math.min(Number.MAX_SAFE_INTEGER,Math.ceil(requested/cycle)*cycle))};
  }
  function hash(text){let a=2166136261,b=5381;for(let i=0;i<text.length;i++){const c=text.charCodeAt(i);a=Math.imul(a^c,16777619)>>>0;b=(Math.imul(b,33)^c)>>>0;}return text.length+':'+a.toString(16)+':'+b.toString(16);}
  function stateKey(state){
    if(!active(state))return '';
    const s=normalize(state),source=assertSource(s.animatrixSource),record=checked.get(source);
    if(!record.key)record.key=hash(record.stamp.join('|'));
    const key=['animatrix-v'+EVOLUTION,record.key,s.animatrixAlgorithm,s.animatrixTiming,s.animatrixDirection,s.animatrixCycles,s.animatrixCycleMode].join(':');
    if(excelMode(s.animatrixAlgorithm))return key+':'+s.animatrixExcelDepth;
    return s.animatrixAlgorithm==='copyRows'&&s.animatrixCopyRowsLayout?key+':'+s.animatrixCopyRowsLayout:key;
  }
  function same(a,b){return active(a)===active(b)&&(!active(a)||stateKey(a)===stateKey(b));}
  function repeatReset(engine){
    engine._repeat=engine._cycleMode==='finite'?null:{phase:'period',power:1,length:0,checkpoint:Core.snapshot(engine),period:0,first:0,lead:0,pairSteps:0,a:null,b:null,detectedCycle:null};
  }
  function create(state){
    const s=normalize(state),layout=s.animatrixCopyRowsLayout,source=s.animatrixSource,cycle=cycleFrames(s);
    const engine=Core.create(decode(source),{...excelOptions(source,s.animatrixAlgorithm,s.animatrixExcelDepth),direction:s.animatrixDirection,
      excelCycleFrames:cycle,
      scan:s.animatrixTiming==='rows',copyRowsMirror:!!layout,copyRowsByAxis:copyRowsByAxis(layout),
      copyRowsWrap:layout==='mirrorWrap',copyRowsExcel:layout==='mirrorExcel'});
    engine.sourceFrame=0;
    Object.defineProperties(engine,{_sourceLimit:{value:unlimited(s)?Number.MAX_SAFE_INTEGER:frames(s)},_cycleFrames:{value:cycle},_cycleMode:{value:s.animatrixCycleMode},_repeat:{value:null,writable:true}});
    repeatReset(engine);return engine;
  }
  function reset(engine){Core.reset(engine);engine.sourceFrame=0;repeatReset(engine);return engine;}
  function frameCount(n){if(!Number.isSafeInteger(n)||n<0)fail('Некорректный номер кадра Аниматрицы.');return n;}
  function repeatInfo(engine){
    const r=engine?._repeat;if(!r)return null;
    const complete=r.phase==='complete';
    return {complete,phase:r.phase,firstCycle:complete?r.first:null,periodCycles:r.period||null,
      repeatCycle:complete?r.first+r.period:null,repeatFrame:complete?(r.first+r.period)*engine._cycleFrames:null,
      detectedCycle:r.detectedCycle,cycleFrames:engine._cycleFrames};
  }
  function repeatBoundary(engine){
    const r=engine._repeat;if(!r||r.phase!=='period')return;
    r.length++;
    // Brent compares actual typed arrays and ordered Areas, never a hash alone.
    if(Core.sameState(r.checkpoint,engine)){
      r.period=r.length;r.phase='start';r.checkpoint=null;
      r.a=Core.forkInitial(engine);r.b=Core.forkInitial(engine);
      r.lead=r.period*engine._cycleFrames;return;
    }
    if(r.length===r.power){r.checkpoint=Core.snapshot(engine);r.power*=2;r.length=0;}
  }
  function repeatWork(engine,budget){
    const r=engine._repeat;if(!r||r.phase!=='start')return;
    // Spread the second pass over normal frames; no long synchronous search.
    while(budget>0&&r.phase==='start'){
      if(r.lead){const n=Math.min(budget,r.lead);Core.advance(r.b,n);r.lead-=n;budget-=n;if(r.lead)break;}
      if(r.pairSteps===0&&Core.sameState(r.a,r.b)){
        r.phase='complete';r.detectedCycle=Math.floor(engine.sourceFrame/engine._cycleFrames);r.a=r.b=null;break;
      }
      const n=Math.min(budget,engine._cycleFrames-r.pairSteps);if(!n)break;
      Core.advance(r.a,n);Core.advance(r.b,n);r.pairSteps+=n;budget-=n;
      if(r.pairSteps===engine._cycleFrames){r.pairSteps=0;r.first++;}
    }
  }
  function seek(engine,frame){frameCount(frame);if(frame>engine._sourceLimit)fail('Кадр Аниматрицы за пределами выбранных циклов.');reset(engine);return advance(engine,frame);}
  function advance(engine,count=1){
    frameCount(count);let remaining=Math.min(count,Math.max(0,engine._sourceLimit-engine.sourceFrame));
    let report=null,changed=0;const dirty=new Set(),changedCells=engine.trackChanges?new Set():null;
    do{
      const n=Math.min(remaining,engine._cycleFrames-engine.sourceFrame%engine._cycleFrames);
      const before=engine.stepCount;
      report=Core.advance(engine,n);
      const advanced=engine.excelCycleFrames?engine.stepCount-before:n;
      engine.sourceFrame+=advanced;remaining-=advanced;changed+=report.changed;
      for(const row of report.dirtyRows||[])dirty.add(row);
      if(changedCells)for(const q of report.changedCells||[])changedCells.add(q);
      if(advanced&&engine.sourceFrame%engine._cycleFrames===0)repeatBoundary(engine);
      if(engine.excelCycleFrames&&report.done)break;
      repeatWork(engine,Math.max(1,advanced));
    }while(remaining);
    return {...report,changed,...(engine.scan?{dirtyRows:[...dirty].sort((a,b)=>a-b)}:{}),...(changedCells?{changedCells:[...changedCells]}:{}),frame:engine.sourceFrame,repeat:repeatInfo(engine)};
  }
  function copyTo(engine,values){if(!values||values.length!==engine.width*engine.height)fail('Размер поля не совпадает с Аниматрицей.');for(let i=0;i<values.length;i++)values[i]=engine.present[i]?engine.bits[i]:-1;return values;}
  function demo(rows=32,type='one',algorithm='two'){
    if(!Number.isSafeInteger(rows)||!['one','example'].includes(type)||!ALGORITHMS.includes(algorithm))fail('Неизвестный пример Аниматрицы.');
    const width=2*rows-1,n=dimensions(width,rows),anchor=rows-1;
    const seed={width,height:rows,bits:new Uint8Array(n),present:new Uint8Array(n),colours:new Uint32Array(n),bold:new Uint8Array(n),automatic:new Uint8Array(n),filled:new Uint8Array(n),fills:new Uint32Array(n),selection:new Uint8Array(n)};
    if(algorithm==='copyRows'||excelMode(algorithm)){
      for(let r=0;r<rows;r++)for(let x=0;x<=r;x++){
        const q=r*width+anchor-r+2*x,bit=Number((x&(r-x))===0);
        seed.present[q]=1;seed.bits[q]=bit;seed.colours[q]=bit?0xe8edf5:0x5b6475;
      }
      seed.areas=[{x:0,y:0,width,height:rows}];
    }
    else if(type==='one'){seed.bits[anchor]=seed.present[anchor]=seed.selection[anchor]=1;seed.colours[anchor]=0xffffff;seed.areas=[{x:anchor,y:0,width:1,height:1}];}
    else{
      const bits=[1,0,1,1,0],colours=[0xff0000,0xff0000,0x0070c0,0x0070c0,0],targets=[0,1,1,1,0,1,0],targetColours=[0,0x008000,0xff0000,0,0xff0000,0,0x0070c0];
      for(let j=0;j<bits.length;j++){const q=anchor-2+j;seed.present[q]=seed.selection[q]=1;seed.bits[q]=bits[j];seed.colours[q]=colours[j];seed.bold[q]=j%2;if(algorithm==='background'&&j<4){seed.filled[q]=1;seed.fills[q]=colours[j];}}
      for(let j=0;j<targets.length;j++){const q=width+anchor-3+j;seed.present[q]=1;seed.bits[q]=targets[j];seed.colours[q]=targetColours[j];if(algorithm==='background'){seed.filled[q]=1;seed.fills[q]=0x008000;}}
      seed.areas=[{x:anchor-2,y:0,width:5,height:1}];
    }
    const source=encode(seed,{anchor});
    return excelMode(algorithm)?prepareExcel(source,algorithm):source;
  }
  return {VERSION,EVOLUTION,MAX_CELLS,MAX_ROWS,defaults,active,normalize,assertState,validate:assertState,assertSource,validateSource:assertSource,encode,decode,geometry,frames,cycleFrames,unlimited,extend,repeatInfo,stateKey,same,create,reset,seek,advance,copyTo,demo,restoreFrame,excelMode,prepareExcel};
});
