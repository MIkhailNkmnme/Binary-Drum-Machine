/* v0.778: ссылка включает раскраску клеток (заливка и чёрно-белая краска) компактными разреженными сериями.
   v0.748: ссылка на построение и настройки Маятника — #s=<1|0>.<base64url>.
   v0.758: в описании ссылки — вид «Треугольники» (rombTri) и «Ромбы · всё поле».
   Внутри — настройки поля и вида (st), кадр, инструменты, цвета и краску клеток.
   Шаблоны не включаются.
   Код: '1.' — deflate-raw (CompressionStream), '0.' — несжатый JSON в base64url. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikShareLink=api;})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const VERSION=1,HASH='s',MAX_CODE=400000,MAX_FRAME=1048576,MAX_PAINT_CELLS=20000000;
  const inNode=typeof module==='object'&&module.exports;
  const animatrix=inNode?require('./mayatnik-animatrix-source.js'):globalThis.MayatnikAnimatrixSource;
  const edge=inNode?require('./mayatnik-edge-flow.js'):globalThis.MayatnikEdgeFlow;
  const MODES=['pend','pendR','left','right','one'];
  const BACKGROUNDS=['empty','0','1','chess'];
  const COMPARE_SOURCES=['','cone','field','pair','p12','p23','p31','p123','a12','a23','a31','a123','xor','and'];
  const VIEWS={col:'Перекрытия',bits:'Биты',rgbNeighbours:'RGB-соседи',digits:'Биты · цифры',digitsOnly:'Биты · цифры',bitContours:'Биты · контуры',romb0:'Ромбы чёт',rombTri:'Треугольники',romb1:'Ромбы нечёт',romb2:'Ромбы обе',rombAll:'Ромбы всё поле',rombJoin:'Соединённый',rombJoin180:'Соединённый 180',black:'Чёрное'};
  function b64url(bytes){let s='';for(let i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode.apply(null,bytes.subarray(i,i+0x8000));return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
  function unb64url(text){if(typeof text!=='string'||!/^[A-Za-z0-9_-]+$/.test(text))throw Error('Ссылка повреждена: неверные символы');const padded=text.replace(/-/g,'+').replace(/_/g,'/'),s=atob(padded+'==='.slice((padded.length+3)%4)),bytes=new Uint8Array(s.length);for(let i=0;i<s.length;i++)bytes[i]=s.charCodeAt(i);return bytes;}
  const isPlainObject=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
  const integer=(value,lo,hi,message)=>{if(!Number.isInteger(value)||value<lo||value>hi)throw Error(message);return value;};
  function putVarint(out,value){let n=value;do{let b=n%128;n=Math.floor(n/128);if(n)b|=128;out.push(b);}while(n);}
  function readVarint(bytes,cursor){let value=0,mul=1;for(let i=0;i<5;i++){if(cursor.i>=bytes.length)throw Error('Ссылка повреждена: обрезана краска');const b=bytes[cursor.i++];value+=(b&127)*mul;if(!Number.isSafeInteger(value)||value>0xffffffff)throw Error('Ссылка повреждена: значение краски слишком велико');if(!(b&128))return value;mul*=128;}throw Error('Ссылка повреждена: неверный код краски');}
  function encodeRuns(values,kind){if(!values)return '';const out=[];let q=0,previousEnd=0;while(q<values.length){let value=kind==='bits'?(values[q]>=0?values[q]+1:0):values[q]>>>0;if(!value){q++;continue;}const start=q++;while(q<values.length){const next=kind==='bits'?(values[q]>=0?values[q]+1:0):values[q]>>>0;if(next!==value)break;q++;}putVarint(out,start-previousEnd);putVarint(out,q-start);putVarint(out,value);previousEnd=q;}return b64url(Uint8Array.from(out));}
  function decodeRuns(text,length,kind,allocate=true){const bytes=text?unb64url(text):new Uint8Array(0),cursor={i:0};let out=allocate?(kind==='bits'?new Int8Array(length).fill(-1):kind==='mark'?new Uint8Array(length):new Uint32Array(length)):null,previousEnd=0;while(cursor.i<bytes.length){const start=previousEnd+readVarint(bytes,cursor),count=readVarint(bytes,cursor),value=readVarint(bytes,cursor);if(!count||start<previousEnd||start+count>length||!value||kind==='bits'&&value>2||kind==='mark'&&value!==1)throw Error('Ссылка повреждена: неверная серия краски');if(out)out.fill(kind==='bits'?value-1:value,start,start+count);previousEnd=start+count;}return out;}
  function normalizePaint(value){if(value==null)return null;if(!isPlainObject(value))throw Error('В ссылке повреждена раскраска');const x=integer(value.x,0,100000000,'В ссылке неверное начало раскраски'),width=integer(value.width,1,MAX_PAINT_CELLS,'В ссылке неверная ширина раскраски'),height=integer(value.height,1,MAX_PAINT_CELLS,'В ссылке неверная высота раскраски'),length=width*height;if(!Number.isSafeInteger(length)||length>MAX_PAINT_CELLS)throw Error('Раскраска слишком велика для ссылки');for(const key of ['fill','bits'])if(typeof value[key]!=='string'||value[key].length>MAX_CODE)throw Error('В ссылке неверные данные раскраски');decodeRuns(value.fill,length,'fill',false);decodeRuns(value.bits,length,'bits',false);return {x,width,height,fill:value.fill,bits:value.bits};}
  function encodePaint(value){if(!isPlainObject(value))throw Error('Нет данных раскраски');const {x,width,height,fill,bits}=value,length=integer(width,1,MAX_PAINT_CELLS,'Неверная ширина раскраски')*integer(height,1,MAX_PAINT_CELLS,'Неверная высота раскраски');if(!Number.isSafeInteger(length)||length>MAX_PAINT_CELLS||!Number.isInteger(x)||x<0||x>100000000)throw Error('Раскраска слишком велика для ссылки');if(fill!=null&&(!(fill instanceof Uint32Array)||fill.length!==length))throw Error('Некорректная цветная краска');if(bits!=null&&(!(bits instanceof Int8Array)||bits.length!==length||bits.some(v=>v < -1||v>1)))throw Error('Некорректная чёрно-белая краска');return normalizePaint({x,width,height,fill:encodeRuns(fill,'fill'),bits:encodeRuns(bits,'bits')});}
  function decodePaint(value){const paint=normalizePaint(value);if(!paint)return null;const length=paint.width*paint.height;return {...paint,fill:decodeRuns(paint.fill,length,'fill'),bits:decodeRuns(paint.bits,length,'bits')};}
  function edgeSeedSize(seed){
    if(!isPlainObject(seed))throw Error('В ссылке повреждена опора круга');
    const width=integer(seed.width,1,MAX_PAINT_CELLS,'В ссылке неверная ширина опоры круга');
    const height=integer(seed.height,8,4096,'В ссылке неверная высота опоры круга');
    integer(seed.laps,1,Number.MAX_SAFE_INTEGER,'В ссылке неверный номер круга');
    integer(seed.jumps,0,Number.MAX_SAFE_INTEGER,'В ссылке неверный счётчик перескоков');
    return integer(width*height,1,MAX_PAINT_CELLS,'Опора круга слишком велика для ссылки');
  }
  function normalizeEdgeSeed(seed,state){
    if(seed==null)return null;
    const size=edgeSeedSize(seed);
    if(state&&(!state.edgeWrap||state.edgeContinuous||state.animatrixOn||state.sequenceSourceOn||state.compareSource||
      seed.height!==state.rows||seed.width!==edge.widthFactor(state)*state.rows-1))throw Error('Опора круга не совпадает с полем ссылки');
    for(const [key,kind] of [['values','bits'],['mark','mark']]){
      if(typeof seed[key]!=='string'||seed[key].length>MAX_CODE)throw Error('В ссылке неверные данные опоры круга');
      decodeRuns(seed[key],size,kind,false);
    }
    const {width,height,values,mark,jumps,laps}=seed;
    return {width,height,values,mark,jumps,laps};
  }
  function encodeEdgeSeed(seed){
    const size=edgeSeedSize(seed),{width,height,values,mark,jumps,laps}=seed;
    if(!(values instanceof Int8Array)||values.length!==size||values.some(v=>v < -1||v>1)||
      !(mark instanceof Uint8Array)||mark.length!==size||mark.some(v=>v>1))throw Error('Некорректные клетки опоры круга');
    return normalizeEdgeSeed({width,height,values:encodeRuns(values,'bits'),mark:encodeRuns(mark,'mark'),jumps,laps});
  }
  function decodeEdgeSeed(seed){
    const checked=normalizeEdgeSeed(seed);if(!checked)return null;
    const size=checked.width*checked.height;
    return {...checked,values:decodeRuns(checked.values,size,'bits'),mark:decodeRuns(checked.mark,size,'mark')};
  }
  function normalizePayload(value){
    if(!isPlainObject(value))throw Error('Ссылка не содержит данных Маятника');
    if(value.v!==VERSION)throw Error('Ссылка сделана другой версией Маятника (формат '+value.v+')');
    if(!isPlainObject(value.state))throw Error('В ссылке нет настроек Маятника');
    const state=value.state;
    const rows=integer(state.rows,8,4096,'В ссылке некорректное число строк');
    const steps=integer(state.steps,1,16384,'В ссылке некорректное число вершин');
    if(!MODES.includes(state.mode))throw Error('В ссылке некорректный ход маятника');
    if(!BACKGROUNDS.includes(state.bg))throw Error('В ссылке некорректный фон поля');
    if(!COMPARE_SOURCES.includes(state.compareSource??''))throw Error('В ссылке неизвестное построение');
    if(state.sequenceSource!=null){if(!isPlainObject(state.sequenceSource)||state.sequenceSource.version!==1||!Array.isArray(state.sequenceSource.rows)||!state.sequenceSource.rows.length)throw Error('В ссылке повреждён свой исходный рисунок');if(state.sequenceSource.rows.length>4096||state.sequenceSource.rows.some(row=>typeof row!=='string'||!/^[01]+$/.test(row)))throw Error('В ссылке повреждены строки своего рисунка');if(state.sequenceSourceOn&&state.compareSource)throw Error('В ссылке два источника поля');}
    if(state.animatrixOn)animatrix.assertState(state);
    edge.validate(state);
    const limit=state.animatrixOn&&animatrix.unlimited(state)?animatrix.frames(state):MAX_FRAME;
    const k=integer(Number(value.k),0,limit,'В ссылке некорректный кадр');
    const tools=isPlainObject(value.tools)?{...value.tools}:{};
    const colours=isPlainObject(value.colours)?{...value.colours}:{};
    const colourAuto=isPlainObject(value.colourAuto)?{...value.colourAuto}:{};
    const paint=normalizePaint(value.paint);
    const edgeSeed=normalizeEdgeSeed(value.edgeSeed,state);
    let display=null;
    if(value.display!=null){
      const {scrollLeft,scrollTop}=value.display;
      if(!isPlainObject(value.display)||![scrollLeft,scrollTop].every(n=>Number.isFinite(n)&&n>=0))throw Error('В ссылке повреждено положение просмотра');
      display={scrollLeft,scrollTop};
    }
    return {v:VERSION,at:typeof value.at==='string'?value.at:'',k,state:{...state,rows,steps},tools,colours,colourAuto,paint,...(edgeSeed?{edgeSeed}:{}),...(display?{display}:{})};
  }
  function pack(value){return JSON.stringify(normalizePayload(value));}
  function unpack(text){let data;try{data=JSON.parse(text);}catch(_){throw Error('Ссылка повреждена: данные не читаются');}return normalizePayload(data);}
  async function encode(value){
    const raw=new TextEncoder().encode(pack(value));
    if(typeof CompressionStream==='function'){
      const packed=await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer();
      return '1.'+b64url(new Uint8Array(packed));
    }
    return '0.'+b64url(raw);
  }
  async function decode(code){
    if(typeof code!=='string'||!code)throw Error('Пустая ссылка');
    if(code.length>MAX_CODE)throw Error('Ссылка слишком длинная (больше '+Math.round(MAX_CODE/1024)+' КБ)');
    const match=/^([01])\.([A-Za-z0-9_-]+)$/.exec(code);
    if(!match)throw Error('Ссылка повреждена: неверный код');
    const bytes=unb64url(match[2]);
    if(match[1]==='1'){
      if(typeof DecompressionStream!=='function')throw Error('Этот браузер не умеет распаковывать ссылку');
      let packed;try{packed=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer();}catch(_){throw Error('Ссылка повреждена: не распаковывается');}
      return unpack(new TextDecoder().decode(packed));
    }
    return unpack(new TextDecoder().decode(bytes));
  }
  function hashCode(hash){const match=/^#s=([A-Za-z0-9._-]+)$/.exec(typeof hash==='string'?hash:'');return match&&match[1].length<=MAX_CODE?match[1]:'';}
  function urlFor(base,code){const clean=String(base||'').split('#')[0];if(!/^[a-z][a-z0-9+.-]*:\/\//i.test(clean))throw Error('Неизвестный адрес страницы');return clean+'#s='+code;}
  function describe(payload){
    const state=payload?.state||{},rows=Number(state.rows)||0,k=Number(payload?.k)||0,steps=Number(state.steps)||0;
    const pair=!!state.pair&&state.mode==='pend';
    const construction=state.animatrixOn?'Аниматрица'+(state.animatrixTiming==='rows'?' по строкам':''):state.compareSource==='cone'?'Конусы':state.compareSource?'Сравнение':state.sequenceSourceOn?'Свой маятник':state.edgeWrap?(state.edgeBounce?'Отскок':'Перескок')+(state.edgeContinuous?' без сброса':''):'Маятник';
    const view=VIEWS[state.view]||'Биты';
    let maximum=pair?Math.floor(steps/2):steps;
    if(state.animatrixOn)maximum=animatrix.frames(state);
    else if(state.compareSource){
      const span=pair?rows:2*rows-1;
      maximum=state.vmode==='n3'?Math.min(span,pair?Math.ceil((steps+1)/2):steps):span;
      const key=[rows,state.mode==='pendR'?'pendR':'pend',Number(pair)].join(':');
      if(state.compareSource==='cone'&&state.coneContinueKey===key&&Number.isSafeInteger(state.coneContinueMax))maximum=Math.max(maximum,state.coneContinueMax);
    }
    else if(edge.active(state))maximum=edge.limit(state);
    else if(state.mode==='one')maximum=state.sequenceSourceOn?0:1;
    const summary=[rows+' строк','кадр '+k+' из '+maximum,(pair?'пара · ':'')+construction,view].filter(Boolean).join(' · ');
    return {title:'Ссылка '+rows+' строк · кадр '+k+(construction!=='Маятник'?' · '+construction:''),summary};
  }
  return {VERSION,HASH,MAX_CODE,MAX_FRAME,MAX_PAINT_CELLS,MODES,BACKGROUNDS,COMPARE_SOURCES,VIEWS,b64url,unb64url,normalizePayload,encodePaint,decodePaint,encodeEdgeSeed,decodeEdgeSeed,pack,unpack,encode,decode,hashCode,urlFor,describe};
});
