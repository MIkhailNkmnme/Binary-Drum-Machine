/* Rhomboid touch viewport v1: pinch/pan cancels pending single-finger edits. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ZZRmbTouch=api;})(globalThis,function(){
  'use strict';
  function frame(points){const [a,b]=points;return {x:(a.x+b.x)/2,y:(a.y+b.y)/2,distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y))};}
  function transform(start,current,view){const scale=Math.max(2,Math.min(160,view.s*current.distance/start.distance));return {s:scale,ox:current.x-(start.x-view.ox)*scale/view.s,oy:current.y-(start.y-view.oy)*scale/view.s};}
  function mount(cv,cfg){
    const points=new Map();let active=false,start=null,view=null;
    const consume=e=>{e.preventDefault();e.stopImmediatePropagation();};
    const point=e=>{const rect=cv.getBoundingClientRect();return {x:e.clientX-rect.left,y:e.clientY-rect.top};};
    const rebase=()=>{start=frame([...points.values()].slice(0,2));view={...cfg.view()};};
    cv.addEventListener('pointerdown',e=>{
      if(e.pointerType!=='touch')return;points.set(e.pointerId,point(e));
      if(points.size<2&&!active)return;
      consume(e);if(!active){active=true;cfg.cancel();}if(points.size===2)rebase();
      try{cv.setPointerCapture(e.pointerId);}catch(_){}
    },true);
    cv.addEventListener('pointermove',e=>{
      if(e.pointerType!=='touch'||!points.has(e.pointerId))return;points.set(e.pointerId,point(e));if(!active)return;consume(e);
      if(points.size>=2){const current=frame([...points.values()].slice(0,2));
        // Optional gesture metadata lets hosts quantize scale around the real midpoint.
        // The first argument retains the legacy smooth transform for existing callers.
        cfg.setView(transform(start,current,view),{start:{...start},current,view:{...view}});
      }
    },true);
    const end=e=>{
      if(e.pointerType!=='touch'||!points.has(e.pointerId))return;
      points.delete(e.pointerId);if(!active)return;consume(e);
      try{cv.releasePointerCapture(e.pointerId);}catch(_){}
      if(points.size>=2)rebase();else if(!points.size){active=false;start=view=null;cfg.save();}
    };
    cv.addEventListener('pointerup',end,true);cv.addEventListener('pointercancel',end,true);cv.addEventListener('lostpointercapture',end,true);
    const reset=()=>{if(active)cfg.save();active=false;start=view=null;points.clear();cfg.cancel();};
    cv.addEventListener('blur',()=>{if(active)reset();});
    if(typeof addEventListener==='function')addEventListener('blur',reset);
    return {active:()=>active,reset};
  }
  return {frame,transform,mount};
});
