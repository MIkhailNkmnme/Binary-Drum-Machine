/* Line-mounted controls. The host owns field state, persistence and painting. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./mayatnik-manual-lines.js'):root.MayatnikManualLines);if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikManualLinesView=api;})(globalThis,function(Geometry){
 'use strict';
 function mount(options){
  const host=options.host,doc=options.document||host.ownerDocument,panels=new Map();
  let current=null,drag=null,preferredId=null;
  const consume=e=>{e.preventDefault();e.stopImmediatePropagation();};
  const axis=id=>current?.axes.find(a=>a.id===id&&a.visible!==false);
  const listen=(node,type,fn)=>node.addEventListener(type,fn,true);
  function select(id){if(!axis(id))return;preferredId=id;for(const [key,{panel}]of panels){panel.dataset.selected=String(key===id);if(key===id)panel.style.setProperty('--manual-axis-colour',Geometry.SELECTED_COLOUR);else{const a=axis(key);if(a)panel.style.setProperty('--manual-axis-colour',a.colour||'#7cbcff');}}options.onSelect?.(id);}
  function end(e){
   if(!drag||e.pointerId!==drag.pointerId)return;
   const old=drag;drag=null;
   for(const [type,fn]of [['pointermove',move],['pointerup',end],['pointercancel',end],['lostpointercapture',end]])old.target.removeEventListener(type,fn,true);
   if(old.target.hasPointerCapture?.(old.pointerId))old.target.releasePointerCapture(old.pointerId);
   old.target.classList.remove('drag');options.onCommit?.(old.id,e.type==='pointercancel');
   consume(e);
  }
  function move(e){
   if(!drag||e.pointerId!==drag.pointerId)return;
   if(!axis(drag.id)){end(e);return;}
   const p=Geometry.dragPosition(drag.kind,drag.p,e.clientX-drag.x,e.clientY-drag.y,drag.scale,current.rows);
   options.onPosition?.(drag.id,p);consume(e);
  }
  function begin(id,e,target){
   if(e.button!==0||drag)return;const a=axis(id);if(!a)return;
   select(id);drag={id,kind:a.kind,p:a.p,x:e.clientX,y:e.clientY,scale:current.scale,pointerId:e.pointerId,target};
   target.setPointerCapture(e.pointerId);target.classList.add('drag');
   for(const [type,fn]of [['pointermove',move],['pointerup',end],['pointercancel',end],['lostpointercapture',end]])listen(target,type,fn);
   consume(e);
  }
  function create(id){
   const panel=doc.createElement('div');panel.className='may-manual-axis-controls';panel.hidden=true;panel.dataset.axisId=String(id);
   const parts={};
   for(const [key,text,title]of [['label','','Тянуть — двигать ось с шагом полклетки'],['add','+','Добавить ось между этой и началом поля'],['mirror1','',''],['mirror2','',''],['xor','XOR',''],['and','AND',''],['paint1','1',''],['paint0','0',''],['remove','×','Удалить ось'],['pin','📌','Показывать ручные оси в дзене']]){
    const button=doc.createElement('button');button.type='button';button.className='may-manual-axis-'+key;button.textContent=text;button.title=title;parts[key]=button;panel.append(button);
   }
   // The label is a coordinate/state value (button rules T06), not a command
   // caption. Keep its notation intact when the menu's text observer runs.
   parts.label.dataset.userLabel='';
   listen(parts.label,'pointerdown',e=>begin(id,e,parts.label));
   parts.label.ondblclick=e=>{if(axis(id)?.resettable){consume(e);options.onReset?.(id);}};
   for(const [key,action]of [['add','onAdd'],['remove','onDelete'],['pin','onPin']])parts[key].onclick=e=>{consume(e);if(axis(id)){select(id);options[action]?.(id);}};
   for(const mode of [1,2])parts['mirror'+mode].onclick=e=>{consume(e);const a=axis(id);if(a&&!parts['mirror'+mode].disabled){select(id);options.onMirror?.(id,Geometry.toggleMirror(a.mode,mode));}};
   for(const bit of [1,0])parts['paint'+bit].onclick=e=>{consume(e);const a=axis(id);if(a&&!parts['paint'+bit].disabled){select(id);options.onPaint?.(id,Geometry.togglePaint(a.paint,bit));}};
   for(const op of ['xor','and'])parts[op].onclick=e=>{consume(e);const a=axis(id);if(a){select(id);options.onOperation?.(id,Geometry.toggleOperation(a.op,op));}};
   doc.body.append(panel);return {panel,parts};
  }
  function render(snapshot){
   current=snapshot;const candidates=[];
   for(const {panel}of panels.values())panel.hidden=true;
   if(!snapshot)return;
   if(Object.hasOwn(snapshot,'selectedId'))preferredId=snapshot.selectedId;
   if(!snapshot.axes.some(a=>a.id===preferredId))preferredId=null;
   for(const a of snapshot.axes){if(a.visible===false||!a.segment)continue;
    if(!panels.has(a.id))panels.set(a.id,create(a.id));const {panel,parts}=panels.get(a.id);
    panel.hidden=false;panel.dataset.selected=String(a.id===preferredId);panel.style.setProperty('--manual-axis-colour',a.id===preferredId?Geometry.SELECTED_COLOUR:a.colour||'#7cbcff');
    panel.dataset.compact=String(snapshot.viewport.right-snapshot.viewport.left<392);
    const caption=Geometry.label(a,snapshot.anchor,snapshot.rows);parts.label.textContent=caption;parts.label.title=caption+' · Тянуть — двигать ось с шагом полклетки';parts.label.setAttribute('aria-label',caption);parts.label.style.cursor=a.kind==='h'?'ns-resize':a.kind==='v'?'ew-resize':a.kind==='d'?'nesw-resize':'nwse-resize';
    for(const button of Geometry.mirrorButtons(a.kind,a.p)){const element=parts['mirror'+button.mode];element.textContent=button.symbol;element.disabled=button.disabled;element.setAttribute('aria-pressed',String(!button.disabled&&a.mode===button.mode));
     element.title=button.disabled?'Зеркало диагонали доступно по центрам клеток':'Отражать '+button.direction+' · повторное нажатие выключает';}
    for(const bit of [1,0]){const element=parts['paint'+bit];element.disabled=a.paintDisabled===true;element.setAttribute('aria-pressed',String(!!(Geometry.paintMask(a.paint)&(bit===1?1:2))));
     element.title=caption+' · Раскраска битов '+bit+' вдоль оси · цвет «ТочкаОсь» · повторное нажатие выключает';element.setAttribute('aria-label',element.title);}
    for(const op of ['xor','and']){const element=parts[op];element.setAttribute('aria-pressed',String(Geometry.mirrorOperation(a.op)===op));element.title=caption+' · Зеркало '+op.toUpperCase()+' · повторное нажатие возвращает копирование';element.setAttribute('aria-label',element.title);}
    parts.remove.hidden=a.canDelete===false;parts.pin.hidden=a.pin===undefined;parts.pin.setAttribute('aria-pressed',String(!!a.pin));
    candidates.push({id:a.id,kind:a.kind,segment:a.segment,size:{width:panel.offsetWidth,height:panel.offsetHeight}});
   }
   for(const p of Geometry.controlLayout(candidates,snapshot.viewport)){
    const entry=panels.get(p.id);entry.panel.hidden=!!p.hidden;if(p.hidden)continue;
    Object.assign(entry.panel.style,{left:p.rect.left+'px',top:p.rect.top+'px'});
    entry.panel.dataset.detached=String(p.detached);entry.panel.dataset.overlap=String(p.overlap);
    options.onPlacement?.(p.id,p);
   }
   for(const [id,entry]of panels)if(!snapshot.axes.some(a=>a.id===id)){entry.panel.remove();panels.delete(id);}
  }
  function pointerDown(e){
   if(!current||e.defaultPrevented||e.button!==0||e.pointerType==='touch'||e.target.closest?.('button,input,select,textarea,[contenteditable="true"]')||options.canPick?.(e)===false)return;
   const hit=Geometry.hit(current.axes,e.clientX,e.clientY,{preferredId});if(hit)begin(hit.id,e,host);
  }
  function doubleClick(e){if(!current||e.button!==0||e.target.closest?.('button,input,select,textarea'))return;const found=Geometry.hit(current.axes,e.clientX,e.clientY,{preferredId});if(found&&axis(found.id)?.resettable){consume(e);options.onReset?.(found.id);}}
  function keyDown(e){
   if(e.defaultPrevented||e.isComposing||e.ctrlKey||e.altKey||e.metaKey||drag)return;
   const target=e.target;if(/^(input|select|textarea)$/i.test(target?.tagName||'')||target?.isContentEditable||target?.closest?.('[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="slider"],[role="spinbutton"]'))return;
   const a=axis(preferredId);if(!a||options.canKeyboard?.(e)===false)return;
   const p=Geometry.keyPosition(a.kind,a.p,e.key,!!e.shiftKey,current.rows);if(p===null)return;
   consume(e);if(p!==a.p){options.onPosition?.(a.id,p);options.onCommit?.(a.id,false);}
  }
  // Only an actual line hit is consumed. Empty space remains available to pan,
  // selection and painting; the visual canvas never becomes a full-screen hit box.
  host.addEventListener('pointerdown',pointerDown,true);
  host.addEventListener('dblclick',doubleClick,true);
  doc.addEventListener?.('keydown',keyDown,true);
  return {render,hit:(x,y)=>Geometry.hit(current?.axes||[],x,y,{preferredId}),
   destroy(){if(drag){const d=drag;for(const [type,fn]of [['pointermove',move],['pointerup',end],['pointercancel',end],['lostpointercapture',end]])d.target.removeEventListener(type,fn,true);if(d.target.hasPointerCapture?.(d.pointerId))d.target.releasePointerCapture(d.pointerId);drag=null;}
    host.removeEventListener('pointerdown',pointerDown,true);host.removeEventListener('dblclick',doubleClick,true);doc.removeEventListener?.('keydown',keyDown,true);for(const {panel}of panels.values())panel.remove();panels.clear();current=null;}};
 }
 return {mount};
});
