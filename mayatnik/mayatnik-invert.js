/* Frame inversion is a presentation of the current field. Construction snapshots
 * remain in their original bit representation. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikInvert=api;
})(globalThis,function(){
  'use strict';
  const kind=state=>state.invertKind==='colour'?'colour':'bits';
  const bits=state=>state.inverted===true&&kind(state)==='bits';
  const colour=state=>state.inverted===true&&kind(state)==='colour';
  const bit=value=>value===0||value===1?1-value:value;
  function values(source,owned=false){
    const out=owned?source:source.slice();
    for(let i=0;i<out.length;i++)out[i]=bit(out[i]);
    return out;
  }
  function show(state,frame){
    if(!state.invertAuto||!Number.isSafeInteger(frame)||frame<0||state.invertFrame===frame)return false;
    const previous=state.invertFrame;
    state.invertFrame=frame;
    if(!Number.isSafeInteger(previous)||previous<0)return false;
    state.inverted=!state.inverted;
    return true;
  }
  return {kind,bits,colour,bit,values,show};
});
