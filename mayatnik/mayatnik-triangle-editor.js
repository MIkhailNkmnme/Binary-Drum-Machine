/* МАЯ-438: finite-axis triangle assembly workspace. Geometry belongs to the assembly core. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikTriangleEditor=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const clone=v=>JSON.parse(JSON.stringify(v));
 const samePose=(a,b)=>a.x===b.x&&a.y===b.y&&a.turn===b.turn&&a.flip===b.flip;
 function compatible(layout,snapshot){return snapshot.available!==false&&!!layout&&layout.width===snapshot.width&&layout.height===snapshot.height&&String(layout.scope||'')===String(snapshot.scope||'');}
 function viewport(bounds,width,height,padding=24){const w=Math.max(1,bounds.maxX-bounds.minX),h=Math.max(1,bounds.maxY-bounds.minY),scale=Math.min(Math.max(1,width-2*padding)/w,Math.max(1,height-2*padding)/h);return {scale,x:(width-w*scale)/2-bounds.minX*scale,y:(height-h*scale)/2-bounds.minY*scale};}
 function worldPoint(view,x,y){return [(x-view.x)/view.scale,(y-view.y)/view.scale];}
 function portalGeometry(figure,clip,screen,height){
  const leftEdge=Math.max(0,clip.left),rightEdge=Math.min(screen.width,clip.right),topEdge=Math.max(0,clip.top),bottomEdge=Math.min(screen.height,clip.bottom),available=Math.max(1,rightEdge-leftEdge-8);
  const width=Math.min(available,Math.max(320,figure.width)),left=Math.max(leftEdge+4,Math.min(figure.left,rightEdge-width-4)),top=figure.bottom+8;
  const insetTop=Math.min(height,Math.max(0,topEdge-top)),insetBottom=Math.min(height-insetTop,Math.max(0,top+height-bottomEdge));
  return {left,top,width,clipPath:`inset(${insetTop}px 0px ${insetBottom}px 0px)`};
 }
 function mount(o){
  const doc=o.document||document,win=doc.defaultView,core=o.core||win.MayatnikTriangleAssembly;
  if(!core)throw new Error('MayatnikTriangleAssembly is required');
  let opened=false,selected=null,drag=null,draft=null,view=null,raf=0,destroyed=false,snapOn=true,thumbKey='',feedback='',unsub;
  const panel=doc.createElement('section');panel.className='may-triangle-editor';panel.hidden=true;panel.setAttribute('aria-label','Сборка треугольников');
  const tools=doc.createElement('div');tools.className='may-triangle-tools';panel.append(tools);
  const buttons={};
  function button(key,label,title,action){const b=doc.createElement('button');b.type='button';b.className='gz-hx';const space=label.indexOf(' '),ic=doc.createElement('span'),nm=doc.createElement('span');ic.className='gz-ic';ic.textContent=label.slice(0,space);nm.className='gz-nm';nm.textContent=win.HubButtonText?.shortCaption(label.slice(space+1))||label.slice(space+1);b.append(ic,nm);b.title=title;b.setAttribute('aria-label',title);b.onclick=()=>{action();sync();};tools.append(b);buttons[key]=b;return b;}
  button('find','△ Найти','Найти все треугольники между показанными конечными осями',find);
  button('enabled','△ Сборка','Применять собранное поле',()=>{if(compatible(layout(),o.snapshot()))o.enable(!o.isEnabled());});
  button('snap','⋈ Магнит','Притягивать совпадающие рёбра',()=>{snapOn=!snapOn;});
  button('left','↶ −45°','Повернуть выбранный треугольник на 45° влево',()=>change(p=>core.rotate(p,-1),'Поворот треугольника'));
  button('right','↷ +45°','Повернуть выбранный треугольник на 45° вправо',()=>change(p=>core.rotate(p,1),'Поворот треугольника'));
  button('flip','↔ Зеркало','Отразить выбранный треугольник',()=>change(p=>core.reflect(p),'Отражение треугольника'));
  button('reset','↺ Сброс','Вернуть выбранный треугольник на исходное место',()=>change(()=>({x:0,y:0,turn:0,flip:false}),'Сброс треугольника'));
  button('resetAll','↺ Все','Вернуть все треугольники на исходные места',()=>{const l=layout();if(drag||!compatible(l,o.snapshot()))return;const origin={x:0,y:0,turn:0,flip:false};if(l.pieces.every(p=>samePose(p.pose,origin)))return;const next=clone(l);for(const p of next.pieces)p.pose={...origin};save(next,'Сброс сборки');});
  button('close','× Закрыть','Закрыть редактор сборки',close);
  const status=doc.createElement('div');status.className='may-triangle-status';status.setAttribute('role','status');panel.append(status);
  const tray=doc.createElement('div');tray.className='may-triangle-tray';tray.setAttribute('aria-label','Все найденные треугольники');panel.append(tray);
  const workspace=doc.createElement('canvas');workspace.className='may-triangle-workspace';workspace.tabIndex=0;workspace.setAttribute('aria-label','Поле сборки. Перетаскивайте треугольники, поворачивайте и отражайте кнопками.');panel.append(workspace);
  // A body portal keeps field capture handlers scoped to the field from seeing workspace gestures.
  (o.host||doc.body).append(panel);
  const viewportNode=typeof o.viewport==='function'?o.viewport():o.viewport,spacer=doc.createElement('div');spacer.className='may-triangle-scroll-space';spacer.hidden=true;spacer.setAttribute('aria-hidden','true');if(viewportNode)viewportNode.append(spacer);
  function scrollSpace(){return opened?Math.ceil(panel.offsetHeight||440)+12:0;}
  function layout(){const l=draft||o.getLayout();return l&&Array.isArray(l.pieces)?l:null;}
  function save(next,label){draft=null;o.commit(next,label);}
  function change(fn,label){if(drag||!compatible(layout(),o.snapshot()))return;const next=clone(layout()),p=next.pieces.find(p=>p.id===selected);if(!p)return;const pose=fn(p);if(samePose(p.pose,pose))return;p.pose=pose;save(next,label);}
  function find(){cancel();feedback='';const s=o.snapshot();if(s.available===false){feedback=s.reason||'Поиск недоступен в текущем поле.';return;}try{const pieces=core.find(s);if(!pieces.length){feedback='Между показанными осями нет замкнутых треугольников.';return;}const next=core.normalize({width:s.width,height:s.height,sourceFrame:s.sourceFrame,scope:s.scope,pieces});if(!next){feedback='Не удалось построить сборку из показанных осей.';return;}selected=next.pieces[0].id;save(next,'Найти треугольники');o.enable(true);thumbKey='';}catch(err){feedback='Не удалось найти треугольники: '+err.message;}}
  function position(){if(o.host){panel.style.position='relative';return;}const figure=o.figure?.();if(!figure)return;const r=figure.getBoundingClientRect(),screen={width:win.innerWidth,height:win.innerHeight},clip=viewportNode?.getBoundingClientRect()||{left:0,top:0,right:screen.width,bottom:screen.height};let g=portalGeometry(r,clip,screen,panel.offsetHeight||440);panel.style.left=(g.left+win.scrollX)+'px';panel.style.top=(g.top+win.scrollY)+'px';panel.style.width=g.width+'px';g=portalGeometry(r,clip,screen,panel.offsetHeight||440);panel.style.clipPath=g.clipPath;}
  function boundsOf(l){let minX=0,minY=0,maxX=l.width,maxY=l.height;for(const p of l.pieces){for(const v of p.vertices){const q=core.forward(p,v);minX=Math.min(minX,q[0]);minY=Math.min(minY,q[1]);maxX=Math.max(maxX,q[0]);maxY=Math.max(maxY,q[1]);}}return {minX,minY,maxX,maxY};}
  function drawPiece(ctx,p,source,l,pose=true,outlineScale=view?.scale||1){const m=pose?core.matrix(p):[1,0,0,1,0,0];ctx.save();ctx.transform(...m);ctx.beginPath();p.vertices.forEach((v,i)=>i?ctx.lineTo(...v):ctx.moveTo(...v));ctx.closePath();ctx.save();ctx.clip();const xs=p.vertices.map(v=>v[0]),ys=p.vertices.map(v=>v[1]),x=Math.max(0,Math.min(...xs)),y=Math.max(0,Math.min(...ys)),w=Math.min(l.width,Math.max(...xs))-x,h=Math.min(l.height,Math.max(...ys))-y;if(source&&source.width&&w>0&&h>0){ctx.imageSmoothingEnabled=false;ctx.drawImage(source,x*source.width/l.width,y*source.height/l.height,w*source.width/l.width,h*source.height/l.height,x,y,w,h);}else{ctx.fillStyle='#1b2430';ctx.fill();}ctx.restore();ctx.strokeStyle=p.id===selected?'#ffe174':'#73e4a5';ctx.lineWidth=(p.id===selected?2:1)/outlineScale;ctx.stroke();ctx.restore();}
  function sizeCanvas(canvas,w,h){const ratio=Math.min(2,win.devicePixelRatio||1);canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio);const ctx=canvas.getContext('2d');ctx.setTransform(ratio,0,0,ratio,0,0);return ctx;}
  function thumbnails(l,source){const key=JSON.stringify(l.pieces.map(p=>[p.id,p.vertices]));if(key!==thumbKey){thumbKey=key;tray.replaceChildren();for(const [index,p] of l.pieces.entries()){const b=doc.createElement('button');b.type='button';b.className='may-triangle-thumbnail';b.title='Выбрать треугольник '+(index+1);b.setAttribute('aria-label',b.title);b.dataset.piece=String(p.id);const c=doc.createElement('canvas');c.width=88;c.height=64;b.append(c);const n=doc.createElement('span');n.textContent=String(index+1);b.append(n);b.onclick=()=>{selected=p.id;sync();};tray.append(b);}}
   for(let i=0;i<l.pieces.length;i++){const p=l.pieces[i],b=tray.children[i],c=b.firstChild,ctx=c.getContext('2d');b.classList.toggle('selected',p.id===selected);b.setAttribute('aria-pressed',String(p.id===selected));ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,c.width,c.height);const xs=p.vertices.map(v=>v[0]),ys=p.vertices.map(v=>v[1]),v=viewport({minX:Math.min(...xs),maxX:Math.max(...xs),minY:Math.min(...ys),maxY:Math.max(...ys)},88,64,5);ctx.setTransform(v.scale,0,0,v.scale,v.x,v.y);drawPiece(ctx,p,source,l,false,v.scale);}
  }
  function render(){raf=0;if(!opened||destroyed)return;position();spacer.style.height=scrollSpace()+'px';const l=layout(),s=o.snapshot(),valid=compatible(l,s);if(l&&!l.pieces.some(p=>p.id===selected))selected=null;buttons.enabled.disabled=!valid;buttons.enabled.classList.toggle('on',!!o.isEnabled());buttons.enabled.setAttribute('aria-pressed',String(!!o.isEnabled()));buttons.snap.classList.toggle('on',snapOn);buttons.snap.setAttribute('aria-pressed',String(snapOn));for(const key of ['left','right','flip','reset'])buttons[key].disabled=!valid||selected===null||!!drag;buttons.resetAll.disabled=!valid||!!drag;buttons.find.disabled=!!drag||s.available===false;
   const width=Math.max(240,workspace.clientWidth||panel.clientWidth||640),height=280,ctx=sizeCanvas(workspace,width,height);ctx.fillStyle='#080b10';ctx.fillRect(0,0,width,height);
   if(!l){status.textContent=(s.available===false?s.reason:null)||feedback||'Найдите треугольники между показанными осями.';tray.replaceChildren();thumbKey='';return;}
   status.textContent=(s.available===false?s.reason:null)||feedback||(valid?'Треугольники: '+l.pieces.length+(selected===null?'':' · выбран '+(l.pieces.findIndex(p=>p.id===selected)+1)):'Исходная геометрия поля изменилась. Сборка сохранена; верните исходное поле или найдите треугольники заново.');
   if(!drag||!view)view=viewport(boundsOf(l),width,height);ctx.save();ctx.translate(view.x,view.y);ctx.scale(view.scale,view.scale);const source=valid?o.sourceCanvas():null;for(const p of l.pieces)drawPiece(ctx,p,source,l);ctx.restore();thumbnails(l,source);
  }
  function sync(){if(opened&&!raf&&!destroyed)raf=win.requestAnimationFrame(render);}
  function eventPoint(e){const r=workspace.getBoundingClientRect();return worldPoint(view,(e.clientX-r.left)*(workspace.clientWidth/r.width),(e.clientY-r.top)*(workspace.clientHeight/r.height));}
  function down(e){if(e.button!==0||drag||!view||!compatible(layout(),o.snapshot()))return;const p=core.pick(layout().pieces,eventPoint(e));if(!p)return;e.preventDefault();e.stopPropagation();selected=p.id;draft=clone(o.getLayout());const start=eventPoint(e);drag={id:e.pointerId,start,pose:{x:0,y:0,turn:0,flip:false,...p.pose}};workspace.setPointerCapture?.(e.pointerId);sync();}
  function move(e){if(!drag||e.pointerId!==drag.id)return;e.preventDefault();e.stopPropagation();if(!compatible(draft,o.snapshot())){cancel();return;}const q=eventPoint(e),p=draft.pieces.find(p=>p.id===selected);p.pose={...drag.pose,x:drag.pose.x+q[0]-drag.start[0],y:drag.pose.y+q[1]-drag.start[1]};if(snapOn)p.pose=core.snap(p,draft.pieces.filter(x=>x.id!==selected),8/view.scale);sync();}
  function finish(e){if(!drag||e.pointerId!==drag.id)return;e.preventDefault();e.stopPropagation();const next=draft,id=drag.id,changed=!samePose(drag.pose,next.pieces.find(p=>p.id===selected).pose);drag=null;draft=null;workspace.releasePointerCapture?.(id);if(e.type==='pointerup'&&changed&&compatible(next,o.snapshot()))o.commit(next,'Перемещение треугольника');sync();}
  function cancel(){if(drag){const id=drag.id;drag=null;draft=null;workspace.releasePointerCapture?.(id);}sync();}
  workspace.addEventListener('pointerdown',down);workspace.addEventListener('pointermove',move);workspace.addEventListener('pointerup',finish);workspace.addEventListener('pointercancel',finish);workspace.addEventListener('lostpointercapture',cancel);
  function key(e){if(e.key==='Escape'){if(drag)cancel();else close();e.preventDefault();}}
  panel.addEventListener('keydown',key);win.addEventListener('resize',sync);win.addEventListener('scroll',sync,{passive:true});viewportNode?.addEventListener('scroll',sync,{passive:true});
  function open(){opened=true;panel.hidden=false;spacer.hidden=false;sync();}
  function close(){cancel();opened=false;panel.hidden=true;spacer.hidden=true;spacer.style.height='0px';}
  if(o.subscribe)unsub=o.subscribe(sync);
  return {open,close,toggle(){opened?close():open();},sync,scrollSpace,isOpen:()=>opened,destroy(){close();destroyed=true;if(raf)win.cancelAnimationFrame(raf);unsub?.();win.removeEventListener('resize',sync);win.removeEventListener('scroll',sync);viewportNode?.removeEventListener('scroll',sync);panel.remove();spacer.remove();}};
 }
 return {mount,compatible,viewport,worldPoint,portalGeometry};
});
