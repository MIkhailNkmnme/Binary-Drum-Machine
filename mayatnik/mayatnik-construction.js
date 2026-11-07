/* Optional variants of the ordinary pendulum; custom sources keep their own seed. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./mayatnik-core.js'):MAYATNIK);if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikConstruction=api;})(globalThis,function(Core){
  'use strict';
  const walk=s=>!!s&&s.sequenceApexWalk===true&&!s.sequenceSourceOn&&!s.compareSource&&!s.edgeWrap&&!s.pair&&s.mode==='pend';
  const active=s=>!!s&&!s.sequenceSourceOn&&!s.compareSource&&(s.sequenceOwnGrid===true||s.sequenceInverseAbove===true||walk(s));
  const stride=s=>active(s)&&s.sequenceOwnGrid?2:1;
  const key=s=>active(s)?'ordinary-v1:'+stride(s)+':'+Number(!!s.sequenceInverseAbove)+':'+Number(!!s.edgeWrap)+(walk(s)?':apex-walk-xor-v2-'+(s.sequenceApexStart||'seed')+':'+(s.sequenceApexSides||'one')+':'+Number(!!s.sequenceApexZeroTwice):''):s&&!s.sequenceSourceOn&&!s.compareSource&&s.edgeWrap?'ordinary-edge-v1':'';
  const LEGACY_MESSAGE='Работа Маятника сохранена другой версией построения. Перестройте поле; исходные файлы сохранены.';
  const legacy=s=>active(s)&&(s.constructionEvolution!==1||walk(s)&&s.apexWalkEvolution!==2);
  function assertCompatible(s){if(legacy(s))throw Error(LEGACY_MESSAGE);}
  function wrap(s,offset){
    if(!s.edgeWrap||s.sequenceSourceOn||s.compareSource)return offset;
    const step=stride(s),radius=s.rows-1,half=Math.floor(radius/step),count=2*half+1;
    return ((((offset/step+half)%count)+count)%count-half)*step;
  }
  function legOf(index,skip){
    let leg=Math.max(0,Math.ceil(skip?(Math.sqrt(8*index+1)-1)/2:(Math.sqrt(8*index+9)-3)/2));
    const end=n=>skip?n*(n+1)/2:(n+1)*(n+2)/2-1;
    while(end(leg)<index)leg++;while(leg>0&&end(leg-1)>=index)leg--;return leg;
  }
  function walkOffset(index,skipZero=false){
    if(index===0)return -1;const leg=legOf(index,skipZero),previous=leg%2?-(leg+1)/2:leg/2;
    const delta=index-(skipZero?(leg-1)*leg/2:leg*(leg+1)/2-1);
    return previous+(leg%2?1:-1)*(delta+(skipZero&&delta>=Math.abs(previous)?1:0));
  }
  function walkSpan(frames,skip=false){
    if(frames<1)return [0,0];const index=frames-1,leg=legOf(index,skip),end=walkOffset(index,skip);
    return [Math.min(0,-Math.ceil(leg/2),end),Math.max(0,Math.floor(leg/2),end)];
  }
  function walkBounds(s,frames){
    const skip=s.sequenceApexStart==='skip',sides=s.sequenceApexSides||'one';
    if(sides==='one')return walkSpan(frames,skip);
    const complete=sides==='alternate'?Math.floor(frames/2):frames,[lo,hi]=walkSpan(complete,skip),radius=Math.max(-lo,hi);
    const partial=sides==='alternate'&&frames%2?walkOffset(complete,skip):0;
    return [Math.min(-radius,partial),Math.max(radius,partial)];
  }
  function offset(s,index){return wrap(s,(walk(s)?walkOffset((s.sequenceApexSides==='alternate'?Math.floor(index/2):index),s.sequenceApexStart==='skip')*(s.sequenceApexSides==='alternate'&&index%2?-1:1):Core.offset(s.mode,index))*stride(s));}
  function offsets(s,index){
    if(walk(s)&&s.sequenceApexSides==='both'){const n=offset(s,index);return n===0&&!s.sequenceApexZeroTwice?[0]:[n,-n];}
    return s.pair&&s.mode==='pend'?[wrap(s,-(index+1)*stride(s)),wrap(s,(index+1)*stride(s))]:[offset(s,index)];
  }
  function rangeKey(s){return [s.rows,s.steps,s.mode,s.bg,+!!s.sequenceOwnGrid,+!!s.sequenceInverseAbove,s.sequenceApexStart||'seed',s.sequenceApexSides||'one',+!!s.sequenceApexZeroTwice].join(':');}
  const baseFrameCache=new WeakMap();
  function baseFrames(s){
    if(!walk(s))return s.steps;
    const goal=Math.max(1,s.steps),cacheKey=[goal,stride(s),s.sequenceApexStart||'seed',s.sequenceApexSides||'one'].join(':'),cached=baseFrameCache.get(s);
    if(cached?.key===cacheKey)return cached.frames;
    const reached=count=>{const bounds=apexSpan(s,count);return bounds?bounds[1]-bounds[0]+1:0;};
    let lo=0,hi=Math.max(1,goal);
    while(reached(hi)<goal){hi*=2;if(!Number.isSafeInteger(hi))throw Error('Размах требует слишком большого номера хода');}
    while(lo<hi){const mid=lo+Math.floor((hi-lo)/2);if(reached(mid)>=goal)hi=mid;else lo=mid+1;}
    let result=Math.max(1,lo);if(s.sequenceApexSides==='alternate'&&result%2)result++;
    baseFrameCache.set(s,{key:cacheKey,frames:result});return result;
  }
  function frames(s){const base=baseFrames(s);return walk(s)&&s.apexWalkRangeKey===rangeKey(s)&&Number.isSafeInteger(s.apexWalkMax)?Math.max(base,s.apexWalkMax):base;}
  function span(s,frames){
    if(s.edgeWrap&&!s.sequenceSourceOn&&!s.compareSource){const edge=Math.floor((s.rows-1)/stride(s))*stride(s);return [-edge,edge];}
    return (walk(s)?walkBounds(s,frames):s.pair&&s.mode==='pend'?[-frames,frames]:Core.span(s.mode,frames)).map(n=>n*stride(s));
  }
  function apexSpan(s,count){
    if(!walk(s))return null;
    const seeded=!['empty','skip'].includes(s.sequenceApexStart);
    if(count<1)return seeded?[0,0]:null;
    if(count===1&&!seeded&&s.sequenceApexSides!=='both')return [-stride(s),-stride(s)];
    return span(s,count);
  }
  function geometry(s,vertices=s.steps,rows=s.rows){
    if(walk(s))vertices=Math.max(vertices,frames(s));
    if(s.edgeWrap&&!s.sequenceSourceOn&&!s.compareSource)return {W:2*rows-1,anchor:rows-1};
    const bounds=(walk(s)?walkBounds(s,vertices):Core.span(s.mode,vertices)).map(n=>n*stride(s)),pad=rows-1,result={W:bounds[1]-bounds[0]+2*pad+1,anchor:pad-bounds[0]};
    if(active(s)&&result.W*rows>100000000)throw Error('Варианты Маятника превышают размер поля 100 миллионов клеток. Уменьшите число строк.');
    return result;
  }
  function* xorApexRows(field,visits,depth,lastAt,stamp){
    const {W,H,val}=field,counts=new Map();for(const a of visits)if(a>=0&&a<W)counts.set(a,(counts.get(a)||0)+1);
    const apices=[...counts.keys()].sort((a,b)=>a-b);if(!apices.length)return;
    for(const a of apices){const old=val[a];val[a]=Number((old===1)^(counts.get(a)%2));if(lastAt&&val[a]!==old)lastAt[a]=stamp;}
    yield 0;
    for(let r=1;r<Math.min(depth,H);r++){
      const ranges=[];for(const a of apices){const lo=a-r,hi=a+r,last=ranges.at(-1);if(last&&lo<=last[1]+2)last[1]=Math.max(last[1],hi);else ranges.push([lo,hi]);}
      for(const [lo,hi]of ranges){let c=lo;if(c<0)c+=Math.ceil(-c/2)*2;
        for(;c<=hi&&c<W;c+=2){const q=r*W+c,up=q-W,L=c>0&&val[up-1]===1,R=c+1<W&&val[up+1]===1,old=val[q];val[q]=Number((old===1)^L^R);if(lastAt&&val[q]!==old)lastAt[q]=stamp;}
      }yield r;
    }
  }
  function* rows(field,apices,depth,invert=false,lastAt,stamp,xorApex=false){
    const visits=apices;apices=[...new Set(apices)];
    const walk=xorApex?xorApexRows(field,visits,depth,lastAt,stamp):apices.length===2?Core.conePairRows(field,apices[0],apices[1],depth,lastAt,stamp):Core.coneRows(field,apices[0],depth,lastAt,stamp);
    for(const r of walk){
      if(invert&&r>0)for(const a of apices){let c=a-r+1;if(c<0)c+=Math.ceil(-c/2)*2;
        for(;c<a+r&&c<field.W;c+=2){const q=r*field.W+c,above=field.val[q-field.W];if(field.val[q]===-1&&above>=0){field.val[q]=1-above;if(lastAt)lastAt[q]=stamp;}}}
      yield r;
    }
  }
  function run(field,apices,depth,invert=false,lastAt,stamp,xorApex=false){for(const r of rows(field,apices,depth,invert,lastAt,stamp,xorApex)){/* shared full and manual pass */}return field;}
  function step(field,geo,s,index,lastAt,stamp=index+1){return run(field,offsets(s,index).map(n=>geo.anchor+n),s.rows,active(s)&&!!s.sequenceInverseAbove,lastAt,stamp,walk(s));}
  function initial(field,geo,s,lastAt){if(walk(s)&&!['empty','skip'].includes(s.sequenceApexStart)){const a=geo.anchor,old=field.val[a];field.val[a]=1;if(lastAt&&old!==1)lastAt[a]=0;run(field,[a],s.rows,active(s)&&!!s.sequenceInverseAbove,lastAt,0);}else if(s.pair&&s.mode==='pend')run(field,[geo.anchor],s.rows,active(s)&&!!s.sequenceInverseAbove,lastAt,0);return field;}
  return {active,walk,walkOffset,rangeKey,baseFrames,frames,apexSpan,stride,key,legacy,assertCompatible,LEGACY_MESSAGE,wrap,offset,offsets,span,geometry,rows,run,step,initial};
});
