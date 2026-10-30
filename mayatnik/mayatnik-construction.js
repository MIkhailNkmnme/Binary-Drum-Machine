/* Optional variants of the ordinary pendulum; custom sources keep their own seed. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./mayatnik-core.js'):MAYATNIK);if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikConstruction=api;})(globalThis,function(Core){
  'use strict';
  const active=s=>!!s&&!s.sequenceSourceOn&&!s.compareSource&&(s.sequenceOwnGrid===true||s.sequenceInverseAbove===true);
  const stride=s=>active(s)&&s.sequenceOwnGrid?2:1;
  const key=s=>active(s)?'ordinary-v1:'+stride(s)+':'+Number(!!s.sequenceInverseAbove)+':'+Number(!!s.edgeWrap):s&&!s.sequenceSourceOn&&!s.compareSource&&s.edgeWrap?'ordinary-edge-v1':'';
  const LEGACY_MESSAGE='Работа обычного Маятника сохранена до включения вариантов решётки и инверсии. Перестройте поле; исходные файлы сохранены.';
  const legacy=s=>active(s)&&s.constructionEvolution!==1;
  function assertCompatible(s){if(legacy(s))throw Error(LEGACY_MESSAGE);}
  function wrap(s,offset){
    if(!s.edgeWrap||s.sequenceSourceOn||s.compareSource)return offset;
    const step=stride(s),radius=s.rows-1,half=Math.floor(radius/step),count=2*half+1;
    return ((((offset/step+half)%count)+count)%count-half)*step;
  }
  function offset(s,index){return wrap(s,Core.offset(s.mode,index)*stride(s));}
  function offsets(s,index){return s.pair&&s.mode==='pend'?[wrap(s,-(index+1)*stride(s)),wrap(s,(index+1)*stride(s))]:[offset(s,index)];}
  function span(s,frames){
    if(s.edgeWrap&&!s.sequenceSourceOn&&!s.compareSource){const edge=Math.floor((s.rows-1)/stride(s))*stride(s);return [-edge,edge];}
    return (s.pair&&s.mode==='pend'?[-frames,frames]:Core.span(s.mode,frames)).map(n=>n*stride(s));
  }
  function geometry(s,vertices=s.steps,rows=s.rows){
    if(s.edgeWrap&&!s.sequenceSourceOn&&!s.compareSource)return {W:2*rows-1,anchor:rows-1};
    const bounds=Core.span(s.mode,vertices).map(n=>n*stride(s)),pad=rows-1,result={W:bounds[1]-bounds[0]+2*pad+1,anchor:pad-bounds[0]};
    if(active(s)&&result.W*rows>100000000)throw Error('Варианты Маятника превышают размер поля 100 миллионов клеток. Уменьшите число строк.');
    return result;
  }
  function* rows(field,apices,depth,invert=false,lastAt,stamp){
    apices=[...new Set(apices)];
    const walk=apices.length===2?Core.conePairRows(field,apices[0],apices[1],depth,lastAt,stamp):Core.coneRows(field,apices[0],depth,lastAt,stamp);
    for(const r of walk){
      if(invert&&r>0)for(const a of apices){let c=a-r+1;if(c<0)c+=Math.ceil(-c/2)*2;
        for(;c<a+r&&c<field.W;c+=2){const q=r*field.W+c,above=field.val[q-field.W];if(field.val[q]===-1&&above>=0){field.val[q]=1-above;if(lastAt)lastAt[q]=stamp;}}}
      yield r;
    }
  }
  function run(field,apices,depth,invert=false,lastAt,stamp){for(const r of rows(field,apices,depth,invert,lastAt,stamp)){/* shared full and manual pass */}return field;}
  function step(field,geo,s,index,lastAt,stamp=index+1){return run(field,offsets(s,index).map(n=>geo.anchor+n),s.rows,active(s)&&!!s.sequenceInverseAbove,lastAt,stamp);}
  function initial(field,geo,s,lastAt){if(s.pair&&s.mode==='pend')run(field,[geo.anchor],s.rows,active(s)&&!!s.sequenceInverseAbove,lastAt,0);return field;}
  return {active,stride,key,legacy,assertCompatible,LEGACY_MESSAGE,wrap,offset,offsets,span,geometry,rows,run,step,initial};
});
