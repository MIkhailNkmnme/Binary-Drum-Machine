/* Canonical lattice scales and nearest-cell copies. No DOM measurement is a scale. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./mayatnik-pixel-grid.js'));
  else root.MayatnikPixelExactHost=factory(root.MayatnikPixelGrid);
})(globalThis,function(Grid){
  'use strict';
  function create({getState,getGeometry,onError=()=>{}}){
    let error='';
    function report(message=''){if(error!==message){error=message;onError(message);}return message;}
    function policyFor(patch={}){
      const state={...getState(),...patch},geometry=getGeometry(state);
      if(!geometry||geometry.reason)return {ok:false,reason:geometry?.reason||'Нет геометрии точной сетки.'};
      return Grid.policy({...geometry,oneToOne:!!state.zLimit});
    }
    function snap(scale,direction='nearest',powerBase){
      const p=policyFor();if(!p.ok){report(p.reason);return null;}
      let wanted=scale;
      if(Number.isInteger(powerBase)&&powerBase>=2&&powerBase<=10&&scale>0){
        const exponent=Math.log(scale*p.dpr/p.quantum)/Math.log(powerBase);
        wanted=powerBase**(direction==='down'?Math.floor(exponent+1e-12):direction==='up'?Math.ceil(exponent-1e-12):Math.round(exponent))*p.quantum/p.dpr;
      }
      const result=Grid.snap(wanted,p,direction);if(result===null)report('Недопустимый запрос масштаба.');else report('');return result;
    }
    function exportScale(){
      const p=policyFor();if(!p.ok){report(p.reason);return null;}
      const k=Math.min(p.maxK,Math.max(p.minK,Math.ceil(2/p.quantum-1e-12)));return k*p.quantum;
    }
    return {policyFor,canState:patch=>policyFor(patch).ok,snap,step:(scale,dir)=>Grid.step(scale,policyFor(),dir),format:scale=>Grid.format(scale,policyFor()),exportScale,report,getError:()=>error};
  }
  function resampleNearest(source,width,height){
    if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1||width>Grid.MAX_SIDE||height>Grid.MAX_SIDE||width*height>Grid.MAX_PIXELS||!source?.data||source.data.length!==source.width*source.height*4)throw RangeError('Неверный размер точного растра.');
    const data=new Uint8ClampedArray(width*height*4),input=new Uint32Array(source.data.buffer,source.data.byteOffset,source.data.byteLength/4),output=new Uint32Array(data.buffer);
    for(let y=0;y<height;y++){
      const sy=Math.min(source.height-1,Math.floor((y+.5)*source.height/height));
      for(let x=0;x<width;x++)output[y*width+x]=input[sy*source.width+Math.min(source.width-1,Math.floor((x+.5)*source.width/width))];
    }
    return {width,height,data};
  }
  return {create,resampleNearest};
});
