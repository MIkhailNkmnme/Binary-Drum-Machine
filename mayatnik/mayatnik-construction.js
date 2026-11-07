/* Optional variants of the ordinary pendulum; custom sources keep their own seed. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./mayatnik-core.js'):MAYATNIK);if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikConstruction=api;})(globalThis,function(Core){
  'use strict';
  const walk=s=>!!s&&s.sequenceApexWalk===true&&!s.sequenceSourceOn&&!s.compareSource&&!s.edgeWrap&&!s.pair&&s.mode==='pend';
  const active=s=>!!s&&!s.sequenceSourceOn&&!s.compareSource&&(s.sequenceOwnGrid===true||s.sequenceInverseAbove===true||walk(s));
  const stride=s=>active(s)&&s.sequenceOwnGrid?2:1;
  const key=s=>active(s)?'ordinary-v1:'+stride(s)+':'+Number(!!s.sequenceInverseAbove)+':'+Number(!!s.edgeWrap)+(walk(s)?':apex-walk-xor-v2-seeded':''):s&&!s.sequenceSourceOn&&!s.compareSource&&s.edgeWrap?'ordinary-edge-v1':'';
  const LEGACY_MESSAGE='Работа Маятника сохранена другой версией построения. Перестройте поле; исходные файлы сохранены.';
  const legacy=s=>active(s)&&(s.constructionEvolution!==1||walk(s)&&s.apexWalkEvolution!==2);
  function assertCompatible(s){if(legacy(s))throw Error(LEGACY_MESSAGE);}
  function wrap(s,offset){
    if(!s.edgeWrap||s.sequenceSourceOn||s.compareSource)return offset;
    const step=stride(s),radius=s.rows-1,half=Math.floor(radius/step),count=2*half+1;
    return ((((offset/step+half)%count)+count)%count-half)*step;
  }
  // Endpoints occur at indices 0,2,5,9,14,...: -1,+1,-2,+2,-3,...
  function walkOffset(index){
    if(index===0)return -1;
    let leg=Math.ceil((Math.sqrt(8*index+9)-3)/2);
    while((leg+1)*(leg+2)/2-1<index)leg++;
    while(leg>0&&leg*(leg+1)/2-1>=index)leg--;
    const previous=leg%2?-(leg+1)/2:leg/2;
    return previous+(leg%2?1:-1)*(index-(leg*(leg+1)/2-1));
  }
  function walkSpan(frames){let lo=0,hi=0;for(let i=0;i<frames;i++){const n=walkOffset(i);lo=Math.min(lo,n);hi=Math.max(hi,n);}return [lo,hi];}
  function offset(s,index){return wrap(s,(walk(s)?walkOffset(index):Core.offset(s.mode,index))*stride(s));}
  function offsets(s,index){return s.pair&&s.mode==='pend'?[wrap(s,-(index+1)*stride(s)),wrap(s,(index+1)*stride(s))]:[offset(s,index)];}
  function span(s,frames){
    if(s.edgeWrap&&!s.sequenceSourceOn&&!s.compareSource){const edge=Math.floor((s.rows-1)/stride(s))*stride(s);return [-edge,edge];}
    return (walk(s)?walkSpan(frames):s.pair&&s.mode==='pend'?[-frames,frames]:Core.span(s.mode,frames)).map(n=>n*stride(s));
  }
  function geometry(s,vertices=s.steps,rows=s.rows){
    if(s.edgeWrap&&!s.sequenceSourceOn&&!s.compareSource)return {W:2*rows-1,anchor:rows-1};
    const bounds=(walk(s)?walkSpan(vertices):Core.span(s.mode,vertices)).map(n=>n*stride(s)),pad=rows-1,result={W:bounds[1]-bounds[0]+2*pad+1,anchor:pad-bounds[0]};
    if(active(s)&&result.W*rows>100000000)throw Error('Варианты Маятника превышают размер поля 100 миллионов клеток. Уменьшите число строк.');
    return result;
  }
  function* xorApexRows(field,a,depth,lastAt,stamp){
    const {W,H,val}=field;if(a<0||a>=W)return;
    const old=val[a];val[a]=old===1?0:1;if(lastAt&&val[a]!==old)lastAt[a]=stamp;
    yield 0;
    for(let r=1;r<Math.min(depth,H);r++){
      let c=a-r;if(c<0)c+=Math.ceil(-c/2)*2;
      for(;c<=a+r&&c<W;c+=2){
        const q=r*W+c,up=q-W,L=c>0&&val[up-1]===1,R=c+1<W&&val[up+1]===1,old=val[q];
        val[q]=Number((old===1)^L^R);if(lastAt&&val[q]!==old)lastAt[q]=stamp;
      }
      yield r;
    }
  }
  function* rows(field,apices,depth,invert=false,lastAt,stamp,xorApex=false){
    apices=[...new Set(apices)];
    const walk=xorApex?xorApexRows(field,apices[0],depth,lastAt,stamp):apices.length===2?Core.conePairRows(field,apices[0],apices[1],depth,lastAt,stamp):Core.coneRows(field,apices[0],depth,lastAt,stamp);
    for(const r of walk){
      if(invert&&r>0)for(const a of apices){let c=a-r+1;if(c<0)c+=Math.ceil(-c/2)*2;
        for(;c<a+r&&c<field.W;c+=2){const q=r*field.W+c,above=field.val[q-field.W];if(field.val[q]===-1&&above>=0){field.val[q]=1-above;if(lastAt)lastAt[q]=stamp;}}}
      yield r;
    }
  }
  function run(field,apices,depth,invert=false,lastAt,stamp,xorApex=false){for(const r of rows(field,apices,depth,invert,lastAt,stamp,xorApex)){/* shared full and manual pass */}return field;}
  function step(field,geo,s,index,lastAt,stamp=index+1){return run(field,offsets(s,index).map(n=>geo.anchor+n),s.rows,active(s)&&!!s.sequenceInverseAbove,lastAt,stamp,walk(s));}
  function initial(field,geo,s,lastAt){if(walk(s)){const a=geo.anchor,old=field.val[a];field.val[a]=1;if(lastAt&&old!==1)lastAt[a]=0;run(field,[a],s.rows,active(s)&&!!s.sequenceInverseAbove,lastAt,0);}else if(s.pair&&s.mode==='pend')run(field,[geo.anchor],s.rows,active(s)&&!!s.sequenceInverseAbove,lastAt,0);return field;}
  return {active,walk,walkOffset,stride,key,legacy,assertCompatible,LEGACY_MESSAGE,wrap,offset,offsets,span,geometry,rows,run,step,initial};
});
