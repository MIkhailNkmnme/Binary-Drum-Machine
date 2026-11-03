/* Static GIF frames use native images: resizing never allocates a scaled canvas. */
(function(root,factory){
 'use strict';
 if(typeof module==='object'&&module.exports)module.exports={create:factory};
 else root.MayatnikGifStrip=factory(root);
})(typeof window==='object'?window:globalThis,function(win){
 'use strict';
 const doc=win.document,key='mayatnik.gifStrip.size.v1';
 let section,track,title,status,observer,items=[],urls=[],selected=0,width=1,height=1,edge=192,drag=null,fieldRestore=null;
 try{const saved=JSON.parse(win.localStorage.getItem(key));if(Number.isFinite(saved)&&saved>0)edge=saved;}catch{}
 const maxEdge=()=>Math.max(192,Math.min(2048,Math.max(win.innerWidth||0,win.innerHeight||0)*2));
 const size=()=>({width:edge*width/Math.max(width,height),height:edge*height/Math.max(width,height)});
 function save(){try{win.localStorage.setItem(key,JSON.stringify(edge));}catch{}}
 function resize(value,persist=true){
  edge=Math.max(96,Math.min(maxEdge(),value));const s=size();
  if(section){section.style.setProperty('--may-gif-width',s.width+'px');section.style.setProperty('--may-gif-height',s.height+'px');
   for(const item of items){item.handle.setAttribute('aria-valuemin','96');item.handle.setAttribute('aria-valuemax',String(maxEdge()));item.handle.setAttribute('aria-valuenow',String(Math.round(edge)));item.handle.setAttribute('aria-valuetext',Math.round(s.width)+' × '+Math.round(s.height)+' пикселей');}}
  if(persist)save();
 }
 function select(index,focus=false){
  selected=Math.max(0,Math.min(items.length-1,index));
  items.forEach((item,i)=>{const active=i===selected;item.button.setAttribute('aria-pressed',String(active));item.handle.hidden=!active;item.handle.tabIndex=active?0:-1;});
  if(focus){items[selected].button.focus({preventScroll:true});items[selected].cell.scrollIntoView?.({block:'nearest',inline:'nearest'});}
 }
 function finish(){
  if(!drag)return;const previous=drag;drag=null;
  try{if(previous.handle.hasPointerCapture?.(previous.id))previous.handle.releasePointerCapture(previous.id);}catch{}
  section.classList.remove('may-gif-resizing');save();
 }
 function reveal(){
  if(!fieldRestore){const wrap=doc.getElementById('wrap'),height=wrap?.getBoundingClientRect().height;
   if(wrap&&height>0){const old={flex:wrap.style.flex,height:wrap.style.height,boxSizing:wrap.style.boxSizing};
    const parent=wrap.parentElement,layout=win.getComputedStyle(parent),parentOld={gridTemplateRows:parent.style.gridTemplateRows,overflowY:parent.style.overflowY};
    if(layout.display==='grid'){
     // Chromium resolves these tracks to pixels. Freeze every existing row before
     // adding a final auto row, so an expanding strip cannot consume the 1fr field.
     const tracks=layout.gridTemplateRows,parts=tracks.match(/(?:[^\s(]+\([^)]*\)|[^\s]+)/g)||[];
     section.style.gridColumn='1 / -1';section.style.gridRow=String(parts.length+1);
     parent.style.gridTemplateRows=tracks+' auto';parent.style.overflowY='auto';
    }
    wrap.style.flex='0 0 auto';wrap.style.boxSizing='border-box';wrap.style.height=height+'px';
    fieldRestore=()=>{Object.assign(wrap.style,old);Object.assign(parent.style,parentOld);section.style.gridColumn='';section.style.gridRow='';};}}
  section.hidden=false;section.scrollIntoView?.({block:'nearest',inline:'nearest'});
 }
 function hide(){finish();if(section)section.hidden=true;fieldRestore?.();fieldRestore=null;}
 function mount(){
  if(section)return true;const wrap=doc.getElementById('wrap');if(!wrap?.parentNode)return false;
  section=doc.createElement('section');section.id='mayGifStrip';section.hidden=true;section.setAttribute('aria-label','Кадры GIF');section.setAttribute('data-no-mini','');
  const header=doc.createElement('div');header.className='may-gif-strip-header';
  title=doc.createElement('span');title.className='may-gif-strip-title';
  const close=doc.createElement('button');close.type='button';close.className='gz-hx may-standard';close.textContent=win.HubButtonText?.shortCaption('× Скрыть')||'× Скрыть';close.title='Скрыть ленту кадров GIF';close.setAttribute('aria-label',close.title);close.addEventListener('click',hide);
  header.append(title,close);track=doc.createElement('div');track.className='may-gif-strip-track';track.setAttribute('role','group');track.setAttribute('aria-label','Кадры GIF. Выберите кадр; угол выбранного кадра меняет размер всей ленты.');track.tabIndex=0;
  status=doc.createElement('span');status.className='may-gif-strip-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  section.append(header,track,status);wrap.insertAdjacentElement('afterend',section);
  if(win.IntersectionObserver)observer=new win.IntersectionObserver(entries=>{for(const entry of entries){const img=entry.target;if(entry.isIntersecting)img.src=img.dataset.frameUrl;else img.removeAttribute('src');}},{root:track,rootMargin:'200px'});
  // Bubble isolation preserves native touch scrolling and focused keyboard controls.
  for(const type of ['pointerdown','pointermove','pointerup','pointercancel','mousedown','mousemove','mouseup','click','dblclick','contextmenu','keydown','keyup','wheel','touchstart','touchmove','touchend'])section.addEventListener(type,event=>event.stopPropagation());
  section.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();hide();}});
  return true;
 }
 function frame(entry,index){
  const cell=doc.createElement('div');cell.className='may-gif-strip-frame';
  const imageBox=doc.createElement('div');imageBox.className='may-gif-strip-image';
  const button=doc.createElement('button');button.type='button';button.className='may-gif-strip-select';button.title='Выбрать кадр '+(index+1)+', строк: '+entry.rows;button.setAttribute('aria-label',button.title);
  const img=doc.createElement('img');img.loading='lazy';img.decoding='async';img.dataset.frameUrl=urls[index];if(observer)observer.observe(img);else img.src=urls[index];img.alt='Кадр '+(index+1);img.draggable=false;button.append(img);
  button.addEventListener('click',()=>select(index));
  button.addEventListener('keydown',event=>{let next=index;if(event.key==='ArrowRight')next++;else if(event.key==='ArrowLeft')next--;else if(event.key==='Home')next=0;else if(event.key==='End')next=items.length-1;else return;event.preventDefault();select(next,true);});
  const handle=doc.createElement('span');handle.className='may-gif-strip-resize';handle.setAttribute('role','slider');handle.setAttribute('aria-label','Размер всех кадров GIF');handle.title='Изменить размер всех кадров: потяните угол или используйте стрелки, Home и End';handle.textContent='◢';
  handle.addEventListener('pointerdown',event=>{if((event.button!==undefined&&event.button!==0)||event.isPrimary===false)return;event.preventDefault();finish();select(index);drag={id:event.pointerId,x:event.clientX,y:event.clientY,edge,handle};section.classList.add('may-gif-resizing');try{handle.setPointerCapture(event.pointerId);}catch{}});
  handle.addEventListener('keydown',event=>{const step=event.shiftKey?32:8;let value=edge;if(event.key==='ArrowRight'||event.key==='ArrowDown')value+=step;else if(event.key==='ArrowLeft'||event.key==='ArrowUp')value-=step;else if(event.key==='Home')value=96;else if(event.key==='End')value=maxEdge();else return;event.preventDefault();resize(value);});
  handle.addEventListener('lostpointercapture',finish);
  const caption=doc.createElement('div');caption.className='may-gif-strip-caption';caption.textContent=(index+1)+' · '+entry.rows+' строк';
  imageBox.append(button,handle);cell.append(imageBox,caption);track.append(cell);return {cell,button,handle};
 }
 function release(){finish();observer?.disconnect();track?.querySelectorAll('img').forEach(img=>img.removeAttribute('src'));urls.forEach(url=>win.URL.revokeObjectURL(url));urls=[];items=[];track?.replaceChildren();}
 function show(frames,options={}){
  const w=Number(options.width),h=Number(options.height);
  if(!Array.isArray(frames)||!frames.length||!Number.isFinite(w)||!Number.isFinite(h)||w<=0||h<=0||frames.some(f=>!f?.blob||!Number.isFinite(f.rows)||f.rows<0))return false;
  if(!mount())return false;
  // Create the replacement before releasing the previous generation.
  const next=[];try{for(const entry of frames)next.push(win.URL.createObjectURL(entry.blob));}catch{next.forEach(url=>win.URL.revokeObjectURL(url));return false;}
  release();urls=next;width=w;height=h;selected=0;
  items=frames.map(frame);title.textContent=(options.name?String(options.name)+' · ':'')+frames.length+' кадров';title.title=title.textContent;
  status.textContent='Стрелки выбирают кадры. Угол выбранного кадра меняет размер всей ленты.';
  resize(edge,false);select(0);reveal();track.scrollLeft=0;track.scrollTop=0;return true;
 }
 function open(){if(!items.length)return false;reveal();return true;}
 win.addEventListener('pointermove',event=>{if(!drag||event.pointerId!==drag.id)return;event.preventDefault();const s=Math.max(width,height),vx=width/s,vy=height/s;resize(drag.edge+((event.clientX-drag.x)*vx+(event.clientY-drag.y)*vy)/(vx*vx+vy*vy),false);},{passive:false,capture:true});
 for(const type of ['pointerup','pointercancel'])win.addEventListener(type,event=>{if(drag&&event.pointerId===drag.id)finish();},true);
 function relayout(){if(!items.length)return;const visible=section&&!section.hidden;if(visible)hide();resize(edge,false);if(visible)reveal();}
 win.addEventListener('blur',finish);win.addEventListener('resize',relayout);
 if(win.MutationObserver&&doc.body)new win.MutationObserver(relayout).observe(doc.body,{attributes:true,attributeFilter:['class']});
 win.addEventListener('pagehide',()=>{hide();release();});
 return {show,open,hide};
});
