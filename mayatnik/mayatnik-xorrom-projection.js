/* A score of the assembled figure, using native cell addresses, never pixels or annotations. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./mayatnik-xorrom-field.js'));
  else root.MayatnikXorromProjection=factory(root.MayatnikXorromField);
})(globalThis,function(Field){
  'use strict';
  const maps=new WeakMap(),pause=()=>globalThis.scheduler?.yield?.()||new Promise(resolve=>setTimeout(resolve,0));
  function abort(){const error=Error('Чтение сборки Xorrom отменено.');error.name='AbortError';return error;}
  function size(plan,ratio){
    if(!plan?.available||typeof plan.pick!=='function'||!(ratio>0&&Number.isFinite(ratio)))throw Error('Xorrom: нужна доступная сборка Ромбо.');
    const width=Math.max(1,Math.ceil(plan.outputWidth*ratio-1e-9)),height=Math.max(1,Math.ceil(plan.outputHeight*ratio-1e-9));
    if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width*height>Field.MAX_CELLS||height>Field.MAX_ROWS)throw RangeError('Xorrom: слишком большая сборка. Уменьшите число строк или положение оси.');
    return {width,height};
  }
  async function mapping(plan,source,ratio,options){
    const {width,height}=size(plan,ratio),key=[source.width,source.height,ratio].join(':'),known=maps.get(plan)||new Map();maps.set(plan,known);
    if(!known.has(key)){
      const pending=(async()=>{
        const addresses=new Int32Array(width*height).fill(-1),point={x:0,y:0};
        for(let start=0;start<addresses.length;start+=8192){
          if(options.geometryCurrent&&!options.geometryCurrent())throw abort();
          const end=Math.min(addresses.length,start+8192);
          for(let q=start;q<end;q++){
            point.x=(q%width+.5)/ratio;point.y=(Math.floor(q/width)+.5)/ratio;const native=plan.pick(point);
            if(native){const x=Math.floor(native.x),y=Math.floor(native.y);if(x>=0&&y>=0&&x<source.width&&y<source.height)addresses[q]=y*source.width+x;}
          }
          if(end<addresses.length)await pause();
        }
        if(options.geometryCurrent&&!options.geometryCurrent())throw abort();
        return {width,height,addresses};
      })();known.set(key,pending);pending.catch(()=>{if(known.get(key)===pending)known.delete(key);});
    }
    return known.get(key);
  }
  async function capture(plan,source,options={}){
    if(!Number.isSafeInteger(source?.width)||!Number.isSafeInteger(source?.height)||source.width<1||source.height<1||typeof source.readBit!=='function')throw Error('Xorrom: нет исходных клеток сборки.');
    const check=()=>{if(options.cancelled?.()||source.current&&!source.current())throw abort();};check();
    const ratio=options.ratio===undefined?1:options.ratio,map=await mapping(plan,source,ratio,options);check();
    const index=(x,y)=>map.addresses[options.flip?(map.height-1-y)*map.width+map.width-1-x:y*map.width+x];
    const memo={readBit:new Int8Array(source.width*source.height).fill(-2),...(source.readRGB?{readRGB:new Int8Array(source.width*source.height).fill(-2)}:{})};
    const read=(method,x,y)=>{
      const q=index(x,y);if(q<0)return -1;const values=memo[method];if(values[q]!==-2)return values[q];
      const value=source[method](q%source.width,Math.floor(q/source.width));
      if(method==='readBit'?value!==-1&&value!==0&&value!==1:value!==-1&&value!==255&&(!Number.isInteger(value)||value<0||value>7))throw Error('Xorrom: неизвестный бит или RGB-категория исходной клетки.');
      values[q]=value===255?-1:value;return values[q];
    };
    const score=await Field.capture({width:map.width,height:map.height,current:source.current,readBit:(x,y)=>read('readBit',x,y),...(source.readRGB?{readRGB:(x,y)=>read('readRGB',x,y)}:{})},options);
    check();if(options.nativeAddresses){score.nativeWidth=source.width;score.nativeAt=index;}score.projection=Object.freeze({kind:'rombo',ratio,flip:!!options.flip,width:map.width,height:map.height,logicalWidth:plan.outputWidth,logicalHeight:plan.outputHeight});return score;
  }
  return {capture};
});
