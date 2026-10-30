/* Actual match metadata only: enabled search controls are not evidence of a method. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikOchkiMethod=api;})(globalThis,function(){
  'use strict';
  function label(hit={}){
    const names={0:'горизонталь →',2:'вертикаль ↓',1:'диагональ ↘','-1':'диагональ ↙',v:'V ↘↗',snake:hit.manual?'ручная змея ↙↘':'змея ↙↘'};
    const name=names[hit.dir]||'способ не записан',variant={инв:'инверсия',рев:'реверс','инв+рев':'инверсия + реверс'}[hit.vn];
    return name+(variant?' · '+variant:'');
  }
  return {label};
});
