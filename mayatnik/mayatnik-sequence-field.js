/* Immutable binary bitmap supplies frame zero. Every following vertex uses
   the ordinary pendulum recurrence on the current field, including sparse gaps. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikSequenceField=api;})(globalThis,function(){
  'use strict';
  const Core=typeof module==='object'&&module.exports?require('./mayatnik-core.js'):MAYATNIK;
  const MAX_ROWS=4096,MAX_WORD=4096,MAX_BITS=2100000,MAX_CELLS=100000000,known=new WeakSet(),keys=new WeakMap();
  const EVOLUTION=3,LEGACY_MESSAGE='Этот свой маятник сохранён с прежним алгоритмом построения. Включите Своё заново из сохранённых исходных строк.';
  function capture(rows){
    if(!Array.isArray(rows)||!rows.length||rows.length>MAX_ROWS)throw Error('Для своего маятника нужны от 1 до 4096 строк библиотеки.');
    let bits=0;const copy=rows.map((word,i)=>{if(typeof word!=='string'||!/^[01]+$/.test(word))throw Error('Строка '+(i+1)+': допустимы только биты 0 и 1.');if(word.length>MAX_WORD)throw Error('Строка '+(i+1)+' длиннее 4096 битов. Исходное поле не изменено.');bits+=word.length;return word;});
    if(bits>MAX_BITS)throw Error('Исходный рисунок превышает 2100000 битов.');
    const source=Object.freeze({version:1,rows:Object.freeze(copy)});known.add(source);return source;
  }
  function normalize(source){if(source&&known.has(source))return source;if(!source||source.version!==1)throw Error('Повреждён исходный рисунок своего маятника.');return capture(source.rows);}
  const active=state=>!!state?.sequenceSourceOn&&!state.compareSource;
  const evolution=state=>state.sequenceOwnGrid===true?4:EVOLUTION;
  const legacy=state=>active(state)&&state.sequenceEvolution!==evolution(state);
  function assertEvolution(state){if(legacy(state))throw Error(LEGACY_MESSAGE);}
  function limit(state){const n=state.sequenceSourceLimit??0;if(!Number.isInteger(n)||n<0||n>MAX_ROWS)throw Error('Лимит своего исходника: от 0 (все строки) до 4096.');return n;}
  function activeRows(state,rows=state.rows){return Math.min(rows,normalize(state.sequenceSource).rows.length,limit(state)||MAX_ROWS);}
  const stride=state=>state.sequenceOwnGrid===true?2:1;
  function offsets(mode,frame,pair=false,stepSize=1){
    if(!Number.isSafeInteger(frame)||frame<1||(stepSize!==1&&stepSize!==2))throw Error('Некорректный ход своего маятника.');
    return pair?[-frame*stepSize,frame*stepSize]:[Core.offset(mode,frame)*stepSize];
  }
  function bounds(source,limit){source=normalize(source);if(!Number.isInteger(limit)||limit<1||limit>MAX_ROWS)throw Error('Число строк своего маятника должно быть от 1 до 4096.');let half=0;for(let r=0;r<Math.min(limit,source.rows.length);r++)half=Math.max(half,source.rows[r].length-1);return {left:-half,right:half,rows:Math.min(limit,source.rows.length)};}
  function frames(state){return state.mode==='one'?0:state.pair&&state.mode==='pend'?Math.floor(state.steps/2):state.steps;}
  function span(state,frame=frames(state)){
    if(!Number.isSafeInteger(frame)||frame<0)throw Error('Некорректный кадр своего маятника.');
    return (state.pair&&state.mode==='pend'?[-frame,frame]:Core.span(state.mode,frame+1)).map(value=>value*stride(state));
  }
  function extent(state,frame=frames(state),rows=state.rows){
    const b=bounds(state.sequenceSource,activeRows(state,rows));if(frame===0)return b;
    const [lo,hi]=span(state,frame),radius=rows-1;return {left:Math.min(b.left,lo-radius),right:Math.max(b.right,hi+radius),rows};
  }
  function geometry(state,base){if(!active(state))return base;const b=extent(state),left=Math.min(-base.anchor,b.left),right=Math.max(base.W-1-base.anchor,b.right),result={W:right-left+1,anchor:-left};if(!Number.isSafeInteger(result.W*state.rows)||result.W*state.rows>MAX_CELLS)throw Error('Свой маятник превышает безопасный размер поля 100 миллионов клеток.');return result;}
  function seed(field,geo,source,rowLimit=field.H){source=normalize(source);if(!Number.isInteger(field.W)||!Number.isInteger(field.H)||field.W<1||field.H<1||field.val?.length!==field.W*field.H)throw Error('Неверный размер исходного поля.');const b=bounds(source,Math.min(field.H,rowLimit));if(geo.anchor+b.left<0||geo.anchor+b.right>=field.W)throw Error('Поле не вмещает все биты исходных строк.');field.val.fill(-1);
    for(let r=0;r<b.rows;r++){const word=source.rows[r],start=geo.anchor-(word.length-1);for(let i=0;i<word.length;i++)field.val[r*field.W+start+2*i]=word.charCodeAt(i)-48;}
    return field;
  }
  function step(field,geo,source,mode,frame,pair=false,lastAt,stamp=frame,stepSize=1){
    normalize(source);if(!Number.isSafeInteger(frame)||frame<1||mode==='one')throw Error('Следующая вершина требует кадр от 1 и направление хода.');
    if(field.val?.length!==field.W*field.H||lastAt&&lastAt.length!==field.val.length)throw Error('Неверный размер поля своего маятника.');
    const apices=offsets(mode,frame,pair,stepSize),radius=field.H-1;
    if(apices.some(offset=>geo.anchor+offset-radius<0||geo.anchor+offset+radius>=field.W))throw Error('Поле не вмещает пересчёт строк своего маятника.');
    // Use exactly the same in-place row recurrence and paired union as the
    // ordinary pendulum; the immutable source is never stamped again.
    if(pair)Core.conePair(field,geo.anchor+apices[0],geo.anchor+apices[1],field.H,lastAt,stamp);
    else Core.cone(field,geo.anchor+apices[0],field.H,lastAt,stamp);
    return field;
  }
  function sourceAt(source,geo,r,c){source=normalize(source);const word=source.rows[r];if(word===undefined||!Number.isInteger(r)||!Number.isInteger(c))return null;const i=(c-geo.anchor+word.length-1)/2;return Number.isInteger(i)&&i>=0&&i<word.length?{row:r,index:i,bit:Number(word[i])}:null;}
  function key(source){source=normalize(source);if(keys.has(source))return keys.get(source);let a=2166136261,b=5381,n=0;for(const row of source.rows){for(const char of row){const code=char.charCodeAt(0);a=Math.imul(a^code,16777619)>>>0;b=(Math.imul(b,33)^code)>>>0;n++;}a=Math.imul(a^10,16777619)>>>0;b=(Math.imul(b,33)^10)>>>0;}const value=source.rows.length+':'+n+':'+a.toString(16)+':'+b.toString(16);keys.set(source,value);return value;}
  function stateKey(state){const n=limit(state);return key(state.sequenceSource)+(n?':limit:'+n:'')+(stride(state)===2?':grid:2':'');}
  function same(a,b){if(active(a)!==active(b))return false;if(!active(a))return true;const A=normalize(a.sequenceSource).rows,B=normalize(b.sequenceSource).rows;return stride(a)===stride(b)&&limit(a)===limit(b)&&A.length===B.length&&A.every((row,i)=>row===B[i]);}
  return {capture,normalize,active,legacy,assertEvolution,evolution,EVOLUTION,LEGACY_MESSAGE,limit,activeRows,stride,offsets,stateKey,bounds,frames,span,extent,geometry,seed,step,sourceAt,key,same,MAX_ROWS,MAX_WORD,MAX_BITS,MAX_CELLS};
});
