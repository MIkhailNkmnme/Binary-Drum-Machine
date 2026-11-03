/* The musical reader's actual grid geometry, in a clipped screen overlay. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.MayatnikXorromAxisMarker=factory();})(globalThis,function(){
 'use strict';
 const finite=p=>Array.isArray(p)&&p.length>=2&&p.slice(0,2).every(Number.isFinite);
 // Readers paint over the UI. Pick a line only for native pointer events
 // delivered to the field, so a button under the drawing gets its own click.
 const dispatchers=new WeakMap();
 function registerReader(win,viewport,reader){
  if(!viewport)return ()=>{};
  let group=dispatchers.get(win);
  if(!group){
   const readers=new Set();
   function pick(e){
    if(e.button!==0||e.defaultPrevented)return;
    const target=e.target;if(!target?.nodeType)return;
    if(target?.closest?.('button,input,select,textarea,a,label,summary,nav,[contenteditable=true],[role=button],[role=dialog]'))return;
    let best=null,bestDistance=Infinity;
    for(const item of readers){
     if(!item.viewport.contains(target)||target!==item.viewport&&target.tagName!=='CANVAS'&&!item.isFigure?.(target))continue;
     const distance=item.distance(e.clientX,e.clientY);
     if(distance<=7&&(distance<bestDistance||distance===bestDistance&&item.selected())){
      best=item;bestDistance=distance;
     }
    }
    if(best){best.down(e);if(e.defaultPrevented)e.stopImmediatePropagation();}
   }
   win.addEventListener('pointerdown',pick,{capture:true,passive:false});group={readers,pick};dispatchers.set(win,group);
  }
  const item={viewport,...reader};group.readers.add(item);
  return ()=>{group.readers.delete(item);if(!group.readers.size){win.removeEventListener('pointerdown',group.pick,true);dispatchers.delete(win);}};
 }
 function visibleField(doc,win,viewport){
  const r=viewport.getBoundingClientRect(),windowWidth=win.innerWidth||doc.documentElement.clientWidth;
  let edge=windowWidth;
  const library=doc.getElementById('mayatnikTemplatePanel');
  if(library&&!library.hidden){
   const p=library.getBoundingClientRect();
   if(p.width>0&&p.height>0&&p.top<(r.bottom??r.top+r.height)&&p.top+p.height>r.top){
    edge=Math.max(0,Math.min(edge,p.left));
    const handle=doc.querySelector('.mtp-resize');
    if(handle&&!handle.hidden){const h=handle.getBoundingClientRect();if(h.width>0&&h.height>0&&h.left+h.width>=edge-1)edge=Math.min(edge,Math.max(0,h.left));}
   }
  }
  const left=Math.max(0,r.left),top=Math.max(0,r.top),right=Math.min(r.right??r.left+r.width,edge),bottom=Math.min(r.bottom??r.top+r.height,win.innerHeight||doc.documentElement.clientHeight);
  return {left,top,right,bottom,width:Math.max(0,right-left),height:Math.max(0,bottom-top),rightInset:windowWidth-edge};
 }
 function clipLine(x1,y1,x2,y2,box){
  let start=0,end=1;const dx=x2-x1,dy=y2-y1;
  for(const [p,q] of [[-dx,x1-box.left],[dx,box.right-x1],[-dy,y1-box.top],[dy,box.bottom-y1]]){
   if(p===0){if(q<0)return null;continue;}
   if(p<0)start=Math.max(start,q/p);else end=Math.min(end,q/p);
   if(start>end)return null;
  }
  return {x1:x1+dx*start,y1:y1+dy*start,x2:x1+dx*end,y2:y1+dy*end};
 }
 function mount(o){
  const doc=o.document||document,win=o.window||doc.defaultView,ns='http://www.w3.org/2000/svg';
  const root=doc.createElement('div'),svg=doc.createElementNS(ns,'svg'),glow=doc.createElementNS(ns,'path'),line=doc.createElementNS(ns,'path'),hit=doc.createElementNS(ns,'path'),cells=doc.createElementNS(ns,'path');
  root.className='may-xorrom-axis-marker';root.hidden=true;root.setAttribute('role','group');
  Object.assign(root.style,{position:'fixed',pointerEvents:'none',overflow:'hidden',zIndex:'8'});
  Object.assign(svg.style,{display:'block',width:'100%',height:'100%',overflow:'hidden'});
  for(const p of [glow,line,hit,cells]){p.setAttribute('fill','none');p.setAttribute('vector-effect','non-scaling-stroke');}
  glow.setAttribute('stroke-width','5');glow.setAttribute('opacity','.22');line.setAttribute('stroke-width','1');
  cells.setAttribute('stroke-width','1');cells.style.filter='drop-shadow(0 0 2px currentColor)';
  hit.setAttribute('stroke','transparent');hit.setAttribute('stroke-width','14');hit.style.pointerEvents='none';hit.style.cursor='grab';hit.setAttribute('tabindex','-1');
  svg.append(glow,line,cells,hit);root.append(svg);doc.body.append(root);
  let visibleSegment=null,visibleBox=null,state=null,drag=null,disposed=false,cachedRuns=null,cachedGeometry=null,cachedPath=null;
  const bounds=()=>{const r=typeof o.figureRect==='function'?o.figureRect():null;return r&&r.width>0&&r.height>0?r:null;};
  function stop(cancelled){if(!drag)return;const previous=drag;drag=null;try{if(hit.hasPointerCapture?.(previous.id))hit.releasePointerCapture(previous.id);}catch(_){}o.onDragEnd?.({cancelled});}
  function hide(){visibleSegment=null;visibleBox=null;stop(true);root.hidden=true;hit.setAttribute('tabindex','-1');}
  function render(){
   if(disposed||!state?.visible||!(state.width>0&&state.height>0)){hide();return;}
   const r=bounds(),v=o.viewport?visibleField(doc,win,o.viewport):r;if(!r||!v){hide();return;}
   const left=Math.max(r.left,v.left),top=Math.max(r.top,v.top),right=Math.min(r.left+r.width,v.left+v.width),bottom=Math.min(r.top+r.height,v.top+v.height);
   if(right<=left||bottom<=top){hide();return;}
   visibleBox={left,top,right,bottom};
   const sx=r.width/state.width,sy=r.height/state.height,x=p=>r.left-left+(p[0]+.5)*sx,y=p=>r.top-top+(p[1]+.5)*sy;
   Object.assign(root.style,{left:left+'px',top:top+'px',width:right-left+'px',height:bottom-top+'px',opacity:state.muted?'.35':'1'});
   svg.setAttribute('viewBox',`0 0 ${right-left} ${bottom-top}`);root.hidden=false;root.setAttribute('aria-label',state.name||'Линия чтения музыки');
   const colour=state.color||'#ffd35b';root.style.color=colour;root.style.zIndex=state.selected?'2147483646':'2147483645';for(const p of [glow,line,cells])p.setAttribute('stroke',colour);
   const hasLine=finite(state.a)&&finite(state.b),d=hasLine?`M${x(state.a)},${y(state.a)}L${x(state.b)},${y(state.b)}`:'';
   for(const p of [glow,line,hit])p.setAttribute('d',d);glow.style.display=state.selected?'':'none';
   visibleSegment=hasLine?clipLine(left+x(state.a),top+y(state.a),left+x(state.b),top+y(state.b),visibleBox):null;hit.setAttribute('tabindex',hasLine&&state.selected?'0':'-1');hit.setAttribute('aria-label',state.name||'Переместить линию чтения');
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
  const unregister=registerReader(win,o.viewport,{down,selected:()=>!!state?.selected,isFigure:o.isFigure,distance(x,y){
   if(!visibleSegment||!visibleBox||x<visibleBox.left||x>visibleBox.right||y<visibleBox.top||y>visibleBox.bottom)return Infinity;
   const {x1,y1,x2,y2}=visibleSegment,dx=x2-x1,dy=y2-y1,length2=dx*dx+dy*dy;
   const t=length2?Math.max(0,Math.min(1,((x-x1)*dx+(y-y1)*dy)/length2)):0;
   return Math.hypot(x-x1-t*dx,y-y1-t*dy);
  }});
  hit.addEventListener('pointerdown',down);win.addEventListener('pointermove',move);win.addEventListener('pointerup',up);win.addEventListener('pointercancel',up);hit.addEventListener('lostpointercapture',lost);hit.addEventListener('keydown',key);
  o.viewport?.addEventListener('scroll',render,{passive:true});win.addEventListener('resize',render);
  return {element:root,visibleSegment:()=>visibleSegment,update(value){if(disposed)return;state=value?{...value,a:value.a?.slice(),b:value.b?.slice(),ones:(value.ones||[]).map(p=>({...p}))}:null;render();},hide(){state=null;hide();},destroy(){if(disposed)return;disposed=true;unregister();hide();o.viewport?.removeEventListener('scroll',render);win.removeEventListener('resize',render);win.removeEventListener('pointermove',move);win.removeEventListener('pointerup',up);win.removeEventListener('pointercancel',up);hit.removeEventListener('pointerdown',down);hit.removeEventListener('lostpointercapture',lost);hit.removeEventListener('keydown',key);root.remove();state=null;}};
 }
 return {mount,registerReader,visibleField};
});
