/* Immutable binary bitmap supplies frame zero. Every following vertex uses
   the ordinary pendulum recurrence on the current field, including sparse gaps. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikSequenceField=api;})(globalThis,function(){
  'use strict';
  const Core=typeof module==='object'&&module.exports?require('./mayatnik-core.js'):MAYATNIK;
  const MAX_ROWS=4096,MAX_WORD=4096,MAX_BITS=2100000,MAX_CELLS=100000000,known=new WeakSet(),keys=new WeakMap();
  const MAX_RECT_CELLS=12000000,ALPHABET='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const EVOLUTION=3,LEGACY_MESSAGE='Этот свой маятник сохранён с прежним алгоритмом построения. Включите Своё заново из сохранённых исходных строк.';
  function capture(rows){
    if(!Array.isArray(rows)||!rows.length||rows.length>MAX_ROWS)throw Error('Для своего маятника нужны от 1 до 4096 строк библиотеки.');
    let bits=0;const copy=rows.map((word,i)=>{if(typeof word!=='string'||!/^[01]+$/.test(word))throw Error('Строка '+(i+1)+': допустимы только биты 0 и 1.');if(word.length>MAX_WORD)throw Error('Строка '+(i+1)+' длиннее 4096 битов. Исходное поле не изменено.');bits+=word.length;return word;});
    if(bits>MAX_BITS)throw Error('Исходный рисунок превышает 2100000 битов.');
    const source=Object.freeze({version:1,rows:Object.freeze(copy)});known.add(source);return source;
  }
  function rectangleSize(width,height,anchor){
    if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||!Number.isSafeInteger(anchor)||
      width<1||height<8||height>MAX_ROWS||width*height>MAX_RECT_CELLS||anchor<0||anchor>=width)
      throw Error('Размер прямоугольника: от 8 до 4096 строк, всего до 12 миллионов клеток.');
  }
  function rectangle(width,height,anchor,read){
    rectangleSize(width,height,anchor);
    const rows=Array.from({length:height},(_,r)=>{
      let word='';
      for(let c=0;c<width;c+=6){
        let value=0;
        for(let b=0;b<6&&c+b<width;b++)if(read(r,c+b)===1)value|=1<<b;
        word+=ALPHABET[value];
      }
      return word;
    });
    return normalize({version:2,width,anchor,rows});
  }
  function normalize(source){
    if(source&&known.has(source))return source;
    if(source?.version===1)return capture(source.rows);
    if(source?.version!==2||!Array.isArray(source.rows))throw Error('Повреждён исходный рисунок своего маятника.');
    const {width,anchor,rows}=source;
    rectangleSize(width,rows.length,anchor);
    const length=Math.ceil(width/6),tail=width%6;
    if(rows.some(word=>typeof word!=='string'||word.length!==length||!/^[A-Za-z0-9+/]+$/.test(word)||
      tail&&ALPHABET.indexOf(word[length-1])>=1<<tail))throw Error('Повреждены биты прямоугольного исходника.');
    const result=Object.freeze({version:2,width,anchor,rows:Object.freeze(rows.slice())});
    known.add(result);return result;
  }
  const active=state=>!!state?.sequenceSourceOn&&!state.compareSource;
  const fixed=state=>active(state)&&state.sequenceSource?.version===2;
  const inverseAbove=state=>!fixed(state)&&state.sequenceInverseAbove===true;
  const evolution=state=>fixed(state)?7:inverseAbove(state)?(state.sequenceOwnGrid===true?6:5):state.sequenceOwnGrid===true?4:EVOLUTION;
  const legacy=state=>active(state)&&state.sequenceEvolution!==evolution(state);
  function assertEvolution(state){if(legacy(state))throw Error(LEGACY_MESSAGE);}
  function limit(state){const n=state.sequenceSourceLimit??0;if(!Number.isInteger(n)||n<0||n>MAX_ROWS)throw Error('Лимит своего исходника: от 0 (все строки) до 4096.');return n;}
  function activeRows(state,rows=state.rows){const source=normalize(state.sequenceSource);return Math.min(rows,source.rows.length,source.version===2?MAX_ROWS:limit(state)||MAX_ROWS);}
  const stride=state=>!fixed(state)&&state.sequenceOwnGrid===true?2:1;
  function offsets(mode,frame,pair=false,stepSize=1){
    if(!Number.isSafeInteger(frame)||frame<1||(stepSize!==1&&stepSize!==2))throw Error('Некорректный ход своего маятника.');
    return pair?[-frame*stepSize,frame*stepSize]:[Core.offset(mode,frame)*stepSize];
  }
  function bounds(source,limit){source=normalize(source);if(!Number.isInteger(limit)||limit<1||limit>MAX_ROWS)throw Error('Число строк своего маятника должно быть от 1 до 4096.');const rows=Math.min(limit,source.rows.length);if(source.version===2)return {left:-source.anchor,right:source.width-1-source.anchor,rows};let half=0;for(let r=0;r<rows;r++)half=Math.max(half,source.rows[r].length-1);return {left:-half,right:half,rows};}
  function frames(state){
    const pair=state.pair&&state.mode==='pend',steps=state.mode==='one'?0:pair?Math.floor(state.steps/2):state.steps;
    if(!fixed(state))return steps;
    const {anchor,width}=state.sequenceSource,right=width-1-anchor;
    const limit=pair?Math.min(anchor,right):state.mode==='pend'?Math.min(2*anchor,2*right+1):
      state.mode==='pendR'?Math.min(2*right,2*anchor+1):state.mode==='left'?anchor:right;
    return Math.min(steps,limit);
  }
  function span(state,frame=frames(state)){
    if(!Number.isSafeInteger(frame)||frame<0)throw Error('Некорректный кадр своего маятника.');
    return (state.pair&&state.mode==='pend'?[-frame,frame]:Core.span(state.mode,frame+1)).map(value=>value*stride(state));
  }
  function extent(state,frame=frames(state),rows=state.rows){
    const source=normalize(state.sequenceSource);
    const b=bounds(source,activeRows(state,rows));if(source.version===2||frame===0)return b;
    const [lo,hi]=span(state,frame),radius=rows-1;return {left:Math.min(b.left,lo-radius),right:Math.max(b.right,hi+radius),rows};
  }
  function geometry(state,base){if(!active(state))return base;const source=normalize(state.sequenceSource);if(source.version===2)return {W:source.width,anchor:source.anchor};const b=extent(state),left=Math.min(-base.anchor,b.left),right=Math.max(base.W-1-base.anchor,b.right),result={W:right-left+1,anchor:-left};if(!Number.isSafeInteger(result.W*state.rows)||result.W*state.rows>MAX_CELLS)throw Error('Свой маятник превышает безопасный размер поля 100 миллионов клеток.');return result;}
  function seed(field,geo,source,rowLimit=field.H,fillInverseAbove=false,frameZeroFill='off'){source=normalize(source);if(!Number.isInteger(field.W)||!Number.isInteger(field.H)||field.W<1||field.H<1||field.val?.length!==field.W*field.H)throw Error('Неверный размер исходного поля.');
    if(source.version===2){
      if(field.W!==source.width||geo.anchor!==source.anchor)throw Error('Границы исходного прямоугольника не совпадают с полем.');
      field.val.fill(0);
      for(let r=0;r<Math.min(field.H,source.rows.length);r++){
        const word=source.rows[r],offset=r*field.W;
        for(let c=0;c<field.W;c+=6){
          const value=ALPHABET.indexOf(word[c/6]);
          for(let b=0;b<6&&c+b<field.W;b++)field.val[offset+c+b]=(value>>b)&1;
        }
      }
      return field;
    }
    const b=bounds(source,Math.min(field.H,rowLimit));if(geo.anchor+b.left<0||geo.anchor+b.right>=field.W)throw Error('Поле не вмещает все биты исходных строк.');field.val.fill(-1);
    for(let r=0;r<b.rows;r++){const word=source.rows[r],start=geo.anchor-(word.length-1);for(let i=0;i<word.length;i++)field.val[r*field.W+start+2*i]=word.charCodeAt(i)-48;}
    // Fill only internal gaps of the selected source rows, once at frame zero.
    // Read the current row directly above: empty is not a bit to invert.
    if(Core.seedGapDirection(frameZeroFill)!=='off')Core.fillSeedGaps(field,geo.anchor,b.rows,r=>source.rows[r].length-1,frameZeroFill);
    else if(fillInverseAbove)for(let r=1;r<b.rows;r++){
      const half=source.rows[r].length-1,row=r*field.W,up=row-field.W;
      for(let c=geo.anchor-half+1;c<geo.anchor+half;c+=2){const q=row+c,v=field.val[up+c];if(field.val[q]===-1&&v>=0)field.val[q]=1-v;}
    }
    return field;
  }
  function step(field,geo,source,mode,frame,pair=false,lastAt,stamp=frame,stepSize=1){
    source=normalize(source);if(!Number.isSafeInteger(frame)||frame<1||mode==='one')throw Error('Следующая вершина требует кадр от 1 и направление хода.');
    if(field.val?.length!==field.W*field.H||lastAt&&lastAt.length!==field.val.length)throw Error('Неверный размер поля своего маятника.');
    const apices=offsets(mode,frame,pair,source.version===2?1:stepSize),radius=source.version===2?0:field.H-1;
    if(apices.some(offset=>geo.anchor+offset-radius<0||geo.anchor+offset+radius>=field.W))throw Error('Поле не вмещает пересчёт строк своего маятника.');
    // Use exactly the same in-place row recurrence and paired union as the
    // ordinary pendulum; the immutable source is never stamped again.
    if(pair)Core.conePair(field,geo.anchor+apices[0],geo.anchor+apices[1],field.H,lastAt,stamp);
    else Core.cone(field,geo.anchor+apices[0],field.H,lastAt,stamp);
    return field;
  }
  function sourceAt(source,geo,r,c){source=normalize(source);const word=source.rows[r];if(word===undefined||!Number.isInteger(r)||!Number.isInteger(c))return null;if(source.version===2)return c>=0&&c<source.width?{row:r,index:c,bit:(ALPHABET.indexOf(word[Math.floor(c/6)])>>(c%6))&1}:null;const i=(c-geo.anchor+word.length-1)/2;return Number.isInteger(i)&&i>=0&&i<word.length?{row:r,index:i,bit:Number(word[i])}:null;}
  function key(source){source=normalize(source);if(keys.has(source))return keys.get(source);let a=2166136261,b=5381,n=0;for(const row of source.rows){for(const char of row){const code=char.charCodeAt(0);a=Math.imul(a^code,16777619)>>>0;b=(Math.imul(b,33)^code)>>>0;n++;}a=Math.imul(a^10,16777619)>>>0;b=(Math.imul(b,33)^10)>>>0;}const value=source.rows.length+':'+n+':'+a.toString(16)+':'+b.toString(16);keys.set(source,value);return value;}
  function stateKey(state){const source=normalize(state.sequenceSource);if(source.version===2)return 'rectangle:'+source.width+':'+source.anchor+':'+key(source);const n=limit(state);return key(source)+(n?':limit:'+n:'')+(stride(state)===2?':grid:2':'')+(inverseAbove(state)?':fill:inv-above':'');}
  function same(a,b){if(active(a)!==active(b))return false;if(!active(a))return true;const A=normalize(a.sequenceSource),B=normalize(b.sequenceSource);if(A.version!==B.version||A.rows.length!==B.rows.length)return false;return (A.version===2?A.width===B.width&&A.anchor===B.anchor:inverseAbove(a)===inverseAbove(b)&&stride(a)===stride(b)&&limit(a)===limit(b))&&A.rows.every((row,i)=>row===B.rows[i]);}
  return {capture,rectangle,rectangleSize,normalize,active,fixed,legacy,assertEvolution,evolution,EVOLUTION,LEGACY_MESSAGE,limit,activeRows,inverseAbove,stride,offsets,stateKey,bounds,frames,span,extent,geometry,seed,step,sourceAt,key,same,MAX_ROWS,MAX_WORD,MAX_BITS,MAX_CELLS};
});
