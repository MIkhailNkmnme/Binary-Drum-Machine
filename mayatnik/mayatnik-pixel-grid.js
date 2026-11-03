/* Exact physical lattice scales for a square source grid with 45-degree turns.
   The lattice belongs to the projection, independently of frame, pan and CSS zoom. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.MayatnikPixelGrid=factory();
})(globalThis,function(){
  'use strict';
  const MAX_SIDE=16384,MAX_PIXELS=16e6;
  const fail=reason=>({ok:false,reason});
  const positive=n=>Number.isFinite(n)&&n>0;
  const tolerance=n=>16*Number.EPSILON*Math.max(1,Math.abs(n));
  // Trigonometric projection can give e.g. 4000.000000000001 for a
  // mathematically integer edge. Do not charge a phantom row of pixels.
  const pixelExtent=n=>Math.max(1,Math.ceil(n-tolerance(n)));
  function fits(width,height,quality){
    const w=pixelExtent(width*quality),h=pixelExtent(height*quality);
    return w<=MAX_SIDE&&h<=MAX_SIDE&&w*h<=MAX_PIXELS;
  }

  function policy({angle=0,pieceTurns=[0],width,height,dpr=1,maxZoom=512,oneToOne=false,halfCells=false,viewport=false,overview=false}={}){
    if(!positive(width)||!positive(height)||!positive(dpr)||!positive(maxZoom))
      return fail('Неверные размеры поля, масштаб или плотность экрана.');
    if(!Number.isSafeInteger(angle/45)||!Array.isArray(pieceTurns)||!pieceTurns.length||
       !pieceTurns.every(Number.isSafeInteger))return fail('Для точной сетки нужен угол, кратный 45°.');
    const pieceParity=pieceTurns[0]&1,parity=((angle/45)&1)^pieceParity;
    if(!pieceTurns.every(t=>(t&1)===pieceParity))
      return fail('У частей разные направления сетки: общая точная ступень масштаба невозможна.');
    const quantum=parity?Math.SQRT2:1,minK=halfCells&&!parity?2:1;
    if(oneToOne&&(quantum!==1||minK!==1))
      return fail('Для этой сборки точный режим несовместим с 1:1.');
    const limit=viewport?maxZoom*dpr:Math.min(maxZoom*dpr,MAX_SIDE/width,MAX_SIDE/height);
    const bound=limit/quantum;
    if(!Number.isSafeInteger(Math.floor(bound)))
      return fail('Точный масштаб выходит за числовой диапазон.');
    // Test the integer backing dimensions themselves: the continuous area
    // bound does not include ceil padding on each side.
    let lo=0,hi=oneToOne?Math.min(1,Math.floor(bound+tolerance(bound))):Math.floor(bound+tolerance(bound));
    while(lo<hi){
      const mid=lo+Math.ceil((hi-lo)/2);
      if(viewport||fits(width,height,mid*quantum))lo=mid;else hi=mid-1;
    }
    if(lo<minK)return fail('Точная сетка целиком не помещается в пределы масштаба и холста.');
    overview=!!overview&&!oneToOne;
    const overviewDivisor=pixelExtent(Math.max(width,height)*quantum),exactMinScale=minK*quantum/dpr;
    return {ok:true,reason:'',width,height,dpr,quantum,minK,maxK:lo,minScale:overview?quantum/(overviewDivisor*dpr):exactMinScale,maxScale:lo*quantum/dpr,viewport,overview,overviewDivisor,exactMinScale};
  }

  function snap(scale,p,direction='nearest'){
    if(!p?.ok||!positive(scale))return null;
    const v=scale*p.dpr/p.quantum;
    if(p.overview&&scale<p.exactMinScale){
      const n=v*p.overviewDivisor;
      const k=direction==='down'?Math.floor(n+tolerance(n)):direction==='up'?Math.ceil(n-tolerance(n)):direction==='nearest'?Math.round(n+tolerance(n)):NaN;
      return Number.isFinite(k)?Math.max(1,Math.min(p.minK*p.overviewDivisor,k))*p.quantum/(p.overviewDivisor*p.dpr):null;
    }
    let k;
    if(direction==='down')k=Math.floor(v+tolerance(v));
    else if(direction==='up')k=Math.ceil(v-tolerance(v));
    else if(direction==='nearest')k=Math.round(v+tolerance(v));
    else return null;
    return Math.max(p.minK,Math.min(p.maxK,k))*p.quantum/p.dpr;
  }
  function step(scale,p,dir){
    if(!p?.ok||!positive(scale)||(dir!==1&&dir!==-1))return null;
    if(p.overview&&scale<=p.exactMinScale)return snap(scale*1.5**dir,p,dir>0?'up':'down');
    const v=scale*p.dpr/p.quantum;
    const k=dir>0?Math.floor(v+tolerance(v))+1:Math.ceil(v-tolerance(v))-1;
    return Math.max(p.minK,Math.min(p.maxK,k))*p.quantum/p.dpr;
  }
  function raster(scale,p){
    if(!p?.ok||!positive(scale))return null;
    const v=scale*p.dpr/p.quantum,k=Math.round(v);
    if(p.overview&&scale<p.exactMinScale-tolerance(scale)){
      const n=v*p.overviewDivisor,index=Math.round(n);
      if(index<1||Math.abs(n-index)>tolerance(n))return null;
      const quality=index*p.quantum/p.overviewDivisor;
      return {k:index,divisor:p.overviewDivisor,quality,width:pixelExtent(p.width*quality),height:pixelExtent(p.height*quality),overview:true};
    }
    if(k<p.minK||k>p.maxK||Math.abs(v-k)>tolerance(v))return null;
    const quality=k*p.quantum;
    return {k,quality,width:pixelExtent(p.width*quality),height:pixelExtent(p.height*quality)};
  }
  function format(scale,p){
    const r=raster(scale,p);
    if(!r)return '';
    let n=r.k,d=r.divisor||1,a=n,b=d;while(b){const rest=a%b;a=b;b=rest;}n/=a;d/=a;
    const numerator=p.quantum===1?String(n):(n===1?'':String(n))+'√2';
    return numerator+'/'+d;
  }
  return {policy,snap,step,raster,format,MAX_SIDE,MAX_PIXELS};
});
