/* Own rows pane width; grid data and its undo history are untouched. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else{root.SetkaRowsResize=api;if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>api.mount(),{once:true});else api.mount();}})(globalThis,function(){
 'use strict';
 const KEY='setka-rows-width-v1',MIN=64,DEFAULT=260;
 function maximum(width){return Math.max(MIN,Math.min(width*.75,width-200));}
 function clamp(value,width){return Math.round(Math.max(MIN,Math.min(maximum(width),Number.isFinite(value)?value:DEFAULT)));}
 function mount(){
  const pane=document.getElementById('gridsRowsPane'),workspace=pane?.closest('.grids-workspace');
  if(!pane||!workspace)return null;if(pane._setkaRowsResize)return pane._setkaRowsResize;
  const mobile=matchMedia('(max-width:760px), (pointer:coarse) and (max-width:1100px)');
  let preferred=DEFAULT;try{const saved=JSON.parse(localStorage.getItem(KEY));if(typeof saved==='number'&&Number.isFinite(saved)&&saved>=MIN)preferred=saved;}catch(_){}
  let gesture=null,frame=0;
  const handle=document.createElement('div');handle.className='setka-rows-resize';handle.tabIndex=0;
  handle.setAttribute('role','separator');handle.setAttribute('aria-orientation','vertical');handle.setAttribute('aria-controls','gridsRowsPane');
  handle.setAttribute('aria-label','Ширина панели строк');handle.title='Тянуть влево или вправо — ширина строк. На минимуме — только номера. ← / → — изменить; Home — свернуть; End — расширить.';
  pane.prepend(handle);pane.classList.add('setka-rows-resizable');
  const width=()=>workspace.getBoundingClientRect().width||innerWidth;
  const redraw=()=>{if(!frame)frame=requestAnimationFrame(()=>{frame=0;window.renderRmb?.();window.setkaMenuRefresh?.();});};
  const apply=()=>{
   const value=clamp(preferred,width());pane.style.setProperty('--setka-rows-width',value+'px');
   pane.classList.toggle('setka-rows-collapsed',!mobile.matches&&value===MIN);handle.hidden=mobile.matches;
   handle.setAttribute('aria-valuemin',String(MIN));handle.setAttribute('aria-valuemax',String(Math.round(maximum(width()))));handle.setAttribute('aria-valuenow',String(value));handle.setAttribute('aria-valuetext',value===MIN?'Только номера строк':value+' пикселей');redraw();
  };
  const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(preferred));}catch(_){}};
  const consume=e=>{e.preventDefault();e.stopPropagation();};
  const finish=(e,cancel=false)=>{
   const d=gesture;if(!d||e.pointerId!=null&&d.id!==e.pointerId)return;gesture=null;
   if(cancel)preferred=d.preferred;else save();document.body.classList.remove('setka-resizing-rows');
   try{handle.releasePointerCapture(d.id);}catch(_){}apply();
  };
  handle.addEventListener('pointerdown',e=>{
   if(e.button!==0||mobile.matches||gesture)return;consume(e);handle.focus({preventScroll:true});
   gesture={id:e.pointerId,x:e.clientX,width:clamp(preferred,width()),preferred};
   handle.setPointerCapture(e.pointerId);document.body.classList.add('setka-resizing-rows');
  });
  handle.addEventListener('pointermove',e=>{if(!gesture||e.pointerId!==gesture.id)return;consume(e);preferred=clamp(gesture.width+gesture.x-e.clientX,width());apply();});
  handle.addEventListener('pointerup',e=>{if(gesture){consume(e);finish(e);}});
  handle.addEventListener('pointercancel',e=>finish(e,true));handle.addEventListener('lostpointercapture',e=>finish(e,true));
  handle.addEventListener('keydown',e=>{
   if(mobile.matches||gesture||!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;consume(e);
   preferred=e.key==='Home'?MIN:e.key==='End'?Math.round(maximum(width())):clamp(clamp(preferred,width())+(e.key==='ArrowLeft'?1:-1)*(e.shiftKey?32:16),width());
   apply();save();
  });
  addEventListener('keydown',e=>{if(e.key==='Escape'&&gesture){consume(e);finish(e,true);}});
  addEventListener('blur',e=>finish(e,true));
  const resize=()=>{if(mobile.matches&&gesture)finish({},true);else apply();};
  addEventListener('resize',resize);mobile.addEventListener?.('change',resize);
  const api={refresh:apply};pane._setkaRowsResize=api;apply();return api;
 }
 return {KEY,MIN,DEFAULT,maximum,clamp,mount};
});
