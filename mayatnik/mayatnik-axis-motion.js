(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikAxisMotion=api;})(globalThis,function(){
 'use strict';
 function advance(p,direction,steps,lo,hi){
  const a=Math.ceil(lo*2),b=Math.floor(hi*2),span=b-a;if(span<=0)return {p:a/2,direction:0};
  const start=Math.max(a,Math.min(b,Math.round(p*2)))-a,phase=direction<0?2*span-start:start;
  const t=((phase+Math.max(0,Math.floor(steps)))%(2*span)+2*span)%(2*span);
  return {p:(a+(t<=span?t:2*span-t))/2,direction:t<span?1:-1};
 }
 function bounds(kind,width,height,anchor){return kind==='h'?[0,height]:kind==='v'?[-anchor-.5,width-anchor-.5]:kind==='d'?[-height-anchor,width-anchor]:[-anchor-1,width+height-anchor-1];}
 return {advance,bounds};
});
