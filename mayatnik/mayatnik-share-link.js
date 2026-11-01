/* v0.748: ссылка на построение и настройки Маятника — #s=<1|0>.<base64url>.
   v0.758: в описании ссылки — вид «Треугольники» (rombTri) и «Ромбы · всё поле».
   Внутри — настройки поля и вида (st), кадр, инструменты и цвета. Ссылка не несёт
   раскраску и шаблоны: поле строится заново из настроек, поэтому ссылка короткая.
   Код: '1.' — deflate-raw (CompressionStream), '0.' — несжатый JSON в base64url. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikShareLink=api;})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const VERSION=1,HASH='s',MAX_CODE=400000,MAX_FRAME=1048576;
  const MODES=['pend','pendR','left','right','one'];
  const BACKGROUNDS=['empty','0','1','chess'];
  const COMPARE_SOURCES=['','cone','field','pair','p12','p23','p31','p123','a12','a23','a31','a123','xor','and'];
  const VIEWS={bits:'Биты',digits:'Цифры',romb0:'Ромбы чёт',rombTri:'Треугольники',romb1:'Ромбы нечёт',romb2:'Ромбы обе',rombAll:'Ромбы всё поле',rombJoin:'Соединённый',rombJoin180:'Соединённый 180',bitContours:'Контуры',black:'Чёрное'};
  function b64url(bytes){let s='';for(let i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode.apply(null,bytes.subarray(i,i+0x8000));return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
  function unb64url(text){if(typeof text!=='string'||!/^[A-Za-z0-9_-]+$/.test(text))throw Error('Ссылка повреждена: неверные символы');const padded=text.replace(/-/g,'+').replace(/_/g,'/'),s=atob(padded+'==='.slice((padded.length+3)%4)),bytes=new Uint8Array(s.length);for(let i=0;i<s.length;i++)bytes[i]=s.charCodeAt(i);return bytes;}
  const isPlainObject=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
  const integer=(value,lo,hi,message)=>{if(!Number.isInteger(value)||value<lo||value>hi)throw Error(message);return value;};
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
    const k=integer(Number(value.k),0,MAX_FRAME,'В ссылке некорректный кадр');
    const tools=isPlainObject(value.tools)?{...value.tools}:{};
    const colours=isPlainObject(value.colours)?{...value.colours}:{};
    const colourAuto=isPlainObject(value.colourAuto)?{...value.colourAuto}:{};
    return {v:VERSION,at:typeof value.at==='string'?value.at:'',k,state:{...state,rows,steps},tools,colours,colourAuto};
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
    const construction=state.compareSource==='cone'?'Конусы':state.compareSource?'Сравнение':state.sequenceSourceOn?'Свой маятник':state.edgeWrap?(state.edgeBounce?'Отскок':'Перескок'):'Маятник';
    const view=VIEWS[state.view]||'Биты';
    const summary=[rows+' строк','кадр '+k+' из '+(pair?Math.max(0,steps>>1):steps),(pair?'пара · ':'')+construction,view].filter(Boolean).join(' · ');
    return {title:'Ссылка '+rows+' строк · кадр '+k+(construction!=='Маятник'?' · '+construction:''),summary};
  }
  return {VERSION,HASH,MAX_CODE,MAX_FRAME,MODES,BACKGROUNDS,COMPARE_SOURCES,VIEWS,b64url,unb64url,normalizePayload,pack,unpack,encode,decode,hashCode,urlFor,describe};
});
