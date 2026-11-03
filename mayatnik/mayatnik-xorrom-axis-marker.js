/* The musical reader's actual grid geometry, in a clipped screen overlay. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.MayatnikXorromAxisMarker=factory();})(globalThis,function(){
 'use strict';
 const finite=p=>Array.isArray(p)&&p.length>=2&&p.slice(0,2).every(Number.isFinite);
 function mount(o){
  const doc=o.document||document,win=o.window||doc.defaultView,ns='http://www.w3.org/2000/svg';
  const root=doc.createElement('div'),svg=doc.createElementNS(ns,'svg'),glow=doc.createElementNS(ns,'path'),line=doc.createElementNS(ns,'path'),hit=doc.createElementNS(ns,'path'),cells=doc.createElementNS(ns,'path');
  root.className='may-xorrom-axis-marker';root.hidden=true;root.setAttribute('role','group');
  Object.assign(root.style,{position:'fixed',pointerEvents:'none',overflow:'hidden',zIndex:'8'});
  Object.assign(svg.style,{display:'block',width:'100%',height:'100%',overflow:'hidden'});
  for(const p of [glow,line,hit,cells]){p.setAttribute('fill','none');p.setAttribute('vector-effect','non-scaling-stroke');}
  glow.setAttribute('stroke-width','5');glow.setAttribute('opacity','.22');line.setAttribute('stroke-width','1');
  cells.setAttribute('stroke-width','1');cells.style.filter='drop-shadow(0 0 2px currentColor)';
  hit.setAttribute('stroke','transparent');hit.setAttribute('stroke-width','14');hit.style.pointerEvents='stroke';hit.style.cursor='grab';hit.setAttribute('tabindex','-1');
  svg.append(glow,line,cells,hit);root.append(svg);doc.body.append(root);
  let state=null,drag=null,disposed=false,cachedRuns=null,cachedGeometry=null,cachedPath=null;
  const bounds=()=>{const r=typeof o.figureRect==='function'?o.figureRect():null;return r&&r.width>0&&r.height>0?r:null;};
  function stop(cancelled){if(!drag)return;const previous=drag;drag=null;try{if(hit.hasPointerCapture?.(previous.id))hit.releasePointerCapture(previous.id);}catch(_){}o.onDragEnd?.({cancelled});}
  function hide(){stop(true);root.hidden=true;hit.setAttribute('tabindex','-1');}
  function render(){
   if(disposed||!state?.visible||!(state.width>0&&state.height>0)){hide();return;}
   const r=bounds(),v=o.viewport?.getBoundingClientRect?.()||r;if(!r||!v){hide();return;}
   const left=Math.max(r.left,v.left),top=Math.max(r.top,v.top),right=Math.min(r.left+r.width,v.left+v.width),bottom=Math.min(r.top+r.height,v.top+v.height);
   if(right<=left||bottom<=top){hide();return;}
   const sx=r.width/state.width,sy=r.height/state.height,x=p=>r.left-left+(p[0]+.5)*sx,y=p=>r.top-top+(p[1]+.5)*sy;
   Object.assign(root.style,{left:left+'px',top:top+'px',width:right-left+'px',height:bottom-top+'px',opacity:state.muted?'.35':'1'});
   svg.setAttribute('viewBox',`0 0 ${right-left} ${bottom-top}`);root.hidden=false;root.setAttribute('aria-label',state.name||'Линия чтения музыки');
   const colour=state.color||'#ffd35b';root.style.color=colour;root.style.zIndex=state.selected?'2147483646':'2147483645';for(const p of [glow,line,cells])p.setAttribute('stroke',colour);
   const hasLine=finite(state.a)&&finite(state.b),d=hasLine?`M${x(state.a)},${y(state.a)}L${x(state.b)},${y(state.b)}`:'';
   for(const p of [glow,line,hit])p.setAttribute('d',d);glow.style.display=state.selected?'':'none';
   hit.style.pointerEvents=hasLine?'stroke':'none';hit.setAttribute('tabindex',hasLine&&state.selected?'0':'-1');hit.setAttribute('aria-label',state.name||'Переместить линию чтения');
   const geometry=[r.left-left,r.top-top,sx,sy,right-left,bottom-top,state.width,state.height].join(':');
   if(!state.onesRuns||state.onesRuns!==cachedRuns||geometry!==cachedGeometry){
    const paths=[],xmin=Math.max(0,Math.floor((left-r.left)/sx)),xmax=Math.min(state.width,Math.ceil((right-r.left)/sx)),ymin=Math.max(0,Math.floor((top-r.top)/sy)),ymax=Math.min(state.height,Math.ceil((bottom-r.top)/sy));
    const add=(cx,cy,length)=>{if(!Number.isInteger(cx)||!Number.isInteger(cy)||!Number.isInteger(length)||length<1||cy<ymin||cy>=ymax)return;const start=Math.max(xmin,cx),end=Math.min(xmax,cx+length);if(end<=start)return;const px=x([start,cy])-sx/2,py=y([start,cy])-sy/2,width=(end-start)*sx;paths.push(`M${px},${py}h${width}v${sy}h${-width}Z`);};
    if(state.onesRuns)for(const run of state.onesRuns)add(run.x,run.y,run.length);else for(const c of state.ones||[])add(c.x,c.y,1);
    cachedRuns=state.onesRuns;cachedGeometry=geometry;cachedPath=paths.join('');
   }
   if(cells.getAttribute('d')!==cachedPath)cells.setAttribute('d',cachedPath);
  }
  function point(e,r= bounds()){return r?{x:(e.clientX-r.left)/r.width*state.width-.5,y:(e.clientY-r.top)/r.height*state.height-.5}:null;}
  function down(e){if(e.button!==0||!state||root.hidden||!finite(state.a)||!finite(state.b))return;const r=bounds(),p=point(e,r),dx=state.b[0]-state.a[0],dy=state.b[1]-state.a[1],length=Math.hypot(dx,dy);if(!p||!length)return;e.preventDefault();e.stopPropagation();stop(true);drag={id:e.pointerId,p,r,width:state.width,height:state.height,nx:-dy/length,ny:dx/length};try{hit.setPointerCapture?.(e.pointerId);}catch(_){}hit.focus();o.onDragStart?.(p);}
  function move(e){if(!drag||e.pointerId!==drag.id)return;e.preventDefault();e.stopPropagation();const d=drag,p={x:(e.clientX-d.r.left)/d.r.width*d.width-.5,y:(e.clientY-d.r.top)/d.r.height*d.height-.5},t=(p.x-d.p.x)*d.nx+(p.y-d.p.y)*d.ny,dx=t*d.nx||0,dy=t*d.ny||0;o.onDrag?.({x:d.p.x+dx,y:d.p.y+dy,dx,dy});}
  function up(e){if(!drag||e.pointerId!==drag.id)return;e.preventDefault();e.stopPropagation();stop(e.type!=='pointerup');}
  function lost(e){if(drag&&e.pointerId===drag.id)stop(true);}
  function key(e){if(root.hidden)return;if(e.key==='Escape'&&drag){e.preventDefault();stop(true);}o.onKey?.(e);}
  hit.addEventListener('pointerdown',down);win.addEventListener('pointermove',move);win.addEventListener('pointerup',up);win.addEventListener('pointercancel',up);hit.addEventListener('lostpointercapture',lost);hit.addEventListener('keydown',key);
  o.viewport?.addEventListener('scroll',render,{passive:true});win.addEventListener('resize',render);
  return {element:root,update(value){if(disposed)return;state=value?{...value,a:value.a?.slice(),b:value.b?.slice(),ones:(value.ones||[]).map(p=>({...p}))}:null;render();},hide(){state=null;hide();},destroy(){if(disposed)return;disposed=true;hide();o.viewport?.removeEventListener('scroll',render);win.removeEventListener('resize',render);win.removeEventListener('pointermove',move);win.removeEventListener('pointerup',up);win.removeEventListener('pointercancel',up);hit.removeEventListener('pointerdown',down);hit.removeEventListener('lostpointercapture',lost);hit.removeEventListener('keydown',key);root.remove();state=null;}};
 }
 return {mount};
});
