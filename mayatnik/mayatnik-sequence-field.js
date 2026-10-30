/* Immutable binary bitmap, seeded once and translated/XORed in every new step.
   An explicit zero occupies its cell; the gaps between bits never write. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikSequenceField=api;})(globalThis,function(){
  'use strict';
  const Core=typeof module==='object'&&module.exports?require('./mayatnik-core.js'):MAYATNIK;
  const MAX_ROWS=4096,MAX_WORD=4096,MAX_BITS=2100000,MAX_CELLS=100000000,known=new WeakSet(),keys=new WeakMap();
  const EVOLUTION=2,LEGACY_MESSAGE='Этот свой маятник сохранён со старым смешанным построением. Включите Своё заново из сохранённых исходных строк.';
  function capture(rows){
    if(!Array.isArray(rows)||!rows.length||rows.length>MAX_ROWS)throw Error('Для своего маятника нужны от 1 до 4096 строк библиотеки.');
    let bits=0;const copy=rows.map((word,i)=>{if(typeof word!=='string'||!/^[01]+$/.test(word))throw Error('Строка '+(i+1)+': допустимы только биты 0 и 1.');if(word.length>MAX_WORD)throw Error('Строка '+(i+1)+' длиннее 4096 битов. Исходное поле не изменено.');bits+=word.length;return word;});
    if(bits>MAX_BITS)throw Error('Исходный рисунок превышает 2100000 битов.');
    const source=Object.freeze({version:1,rows:Object.freeze(copy)});known.add(source);return source;
  }
  function normalize(source){if(source&&known.has(source))return source;if(!source||source.version!==1)throw Error('Повреждён исходный рисунок своего маятника.');return capture(source.rows);}
  const active=state=>!!state?.sequenceSourceOn&&!state.compareSource;
  const legacy=state=>active(state)&&state.sequenceEvolution!==EVOLUTION;
  function assertEvolution(state){if(legacy(state))throw Error(LEGACY_MESSAGE);}
  function bounds(source,limit){source=normalize(source);if(!Number.isInteger(limit)||limit<1||limit>MAX_ROWS)throw Error('Число строк своего маятника должно быть от 1 до 4096.');let half=0;for(let r=0;r<Math.min(limit,source.rows.length);r++)half=Math.max(half,source.rows[r].length-1);return {left:-half,right:half,rows:Math.min(limit,source.rows.length)};}
  function frames(state){return state.mode==='one'?0:state.pair&&state.mode==='pend'?Math.floor(state.steps/2):state.steps;}
  function span(state,frame=frames(state)){
    if(!Number.isSafeInteger(frame)||frame<0)throw Error('Некорректный кадр своего маятника.');
    return state.pair&&state.mode==='pend'?[-frame,frame]:Core.span(state.mode,frame+1);
  }
  function geometry(state,base){if(!active(state))return base;const b=bounds(state.sequenceSource,state.rows),[lo,hi]=span(state),left=Math.min(-base.anchor,b.left+lo),right=Math.max(base.W-1-base.anchor,b.right+hi),result={W:right-left+1,anchor:-left};if(!Number.isSafeInteger(result.W*state.rows)||result.W*state.rows>MAX_CELLS)throw Error('Свой маятник превышает безопасный размер поля 100 миллионов клеток.');return result;}
  function seed(field,geo,source){source=normalize(source);if(!Number.isInteger(field.W)||!Number.isInteger(field.H)||field.W<1||field.H<1||field.val?.length!==field.W*field.H)throw Error('Неверный размер исходного поля.');const b=bounds(source,field.H);if(geo.anchor+b.left<0||geo.anchor+b.right>=field.W)throw Error('Поле не вмещает все биты исходных строк.');field.val.fill(-1);
    for(let r=0;r<b.rows;r++){const word=source.rows[r],start=geo.anchor-(word.length-1);for(let i=0;i<word.length;i++)field.val[r*field.W+start+2*i]=word.charCodeAt(i)-48;}
    return field;
  }
  function step(field,geo,source,mode,frame,pair=false,lastAt,stamp=frame){
    source=normalize(source);if(!Number.isSafeInteger(frame)||frame<1||mode==='one')throw Error('Новый сдвинутый рисунок требует кадр от 1 и направление хода.');
    const offsets=pair?[-frame,frame]:[Core.offset(mode,frame)],b=bounds(source,field.H);
    if(offsets.some(offset=>geo.anchor+b.left+offset<0||geo.anchor+b.right+offset>=field.W))throw Error('Поле не вмещает сдвинутый исходный рисунок.');
    if(field.val?.length!==field.W*field.H||lastAt&&lastAt.length!==field.val.length)throw Error('Неверный размер поля своего маятника.');
    // Merge two sorted sparse rows for a paired step: their overlap is XORed
    // once, so lastAt records the final change rather than an intermediate bit.
    for(let r=0;r<b.rows;r++){
      const word=source.rows[r],n=word.length,start=geo.anchor-(n-1),left=start+offsets[0],right=offsets.length===2?start+offsets[1]:Infinity;let i=0,j=0;
      while(i<n||j<n&&Number.isFinite(right)){
        const a=i<n?left+2*i:Infinity,z=j<n?right+2*j:Infinity,c=Math.min(a,z);let bit=0;
        if(a===c)bit^=word.charCodeAt(i++)-48;if(z===c)bit^=word.charCodeAt(j++)-48;
        const q=r*field.W+c,old=field.val[q],next=(old<0?0:old)^bit;field.val[q]=next;if(lastAt&&next!==old)lastAt[q]=stamp;
      }
    }return field;
  }
  function sourceAt(source,geo,r,c){source=normalize(source);const word=source.rows[r];if(word===undefined||!Number.isInteger(r)||!Number.isInteger(c))return null;const i=(c-geo.anchor+word.length-1)/2;return Number.isInteger(i)&&i>=0&&i<word.length?{row:r,index:i,bit:Number(word[i])}:null;}
  function key(source){source=normalize(source);if(keys.has(source))return keys.get(source);let a=2166136261,b=5381,n=0;for(const row of source.rows){for(const char of row){const code=char.charCodeAt(0);a=Math.imul(a^code,16777619)>>>0;b=(Math.imul(b,33)^code)>>>0;n++;}a=Math.imul(a^10,16777619)>>>0;b=(Math.imul(b,33)^10)>>>0;}const value=source.rows.length+':'+n+':'+a.toString(16)+':'+b.toString(16);keys.set(source,value);return value;}
  function same(a,b){if(active(a)!==active(b))return false;if(!active(a))return true;const A=normalize(a.sequenceSource).rows,B=normalize(b.sequenceSource).rows;return A.length===B.length&&A.every((row,i)=>row===B[i]);}
  return {capture,normalize,active,legacy,assertEvolution,EVOLUTION,LEGACY_MESSAGE,bounds,frames,span,geometry,seed,step,sourceAt,key,same,MAX_ROWS,MAX_WORD,MAX_BITS,MAX_CELLS};
});
