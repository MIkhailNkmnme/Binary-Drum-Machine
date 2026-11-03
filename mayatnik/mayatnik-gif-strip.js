/* Static GIF frames use native images: resizing never allocates a scaled canvas. */
(function(root,factory){
 'use strict';
 if(typeof module==='object'&&module.exports)module.exports={create:factory};
 else root.MayatnikGifStrip=factory(root);
})(typeof window==='object'?window:globalThis,function(win){
 'use strict';
 const doc=win.document,key='mayatnik.gifStrip.thumbSize.v2';
 let section,track,title,status,header,observer,panelObserver,stage,range,counter,playButton,previousButton,nextButton,modeButtons,download,items=[],urls=[],selected=0,width=1,height=1,edge=88,drag=null,moving=null,box=null,playing=false,timer=null,delay=100,busy=false,presentation='pixels',onPresentationChange=null,downloadUrl=null;
 try{const saved=JSON.parse(win.localStorage.getItem(key));if(Number.isFinite(saved)&&saved>0)edge=saved;}catch{}
 const maxEdge=()=>128;
 const size=()=>({width:edge*width/Math.max(width,height),height:edge*height/Math.max(width,height)});
 function save(){try{win.localStorage.setItem(key,JSON.stringify(edge));}catch{}}
 function resize(value,persist=true){
  edge=Math.max(64,Math.min(maxEdge(),value));const s=size();
  if(section){section.style.setProperty('--may-gif-width',s.width+'px');section.style.setProperty('--may-gif-height',s.height+'px');
   for(const item of items){item.handle.setAttribute('aria-valuemin','64');item.handle.setAttribute('aria-valuemax',String(maxEdge()));item.handle.setAttribute('aria-valuenow',String(Math.round(edge)));item.handle.setAttribute('aria-valuetext',Math.round(s.width)+' × '+Math.round(s.height)+' пикселей');}}
  if(persist)save();
 }
 function select(index,focus=false){
  if(!items.length)return;
  selected=Math.max(0,Math.min(items.length-1,index));
  items.forEach((item,i)=>{const active=i===selected;item.button.setAttribute('aria-pressed',String(active));item.handle.hidden=!active;item.handle.tabIndex=active?0:-1;});
  stage.src=urls[selected];stage.alt='Кадр '+(selected+1)+', '+items[selected].rows+' строк';range.value=String(selected);range.setAttribute('aria-valuetext','Кадр '+(selected+1)+' из '+items.length+', '+items[selected].rows+' строк');counter.textContent=(selected+1)+' / '+items.length+' · '+items[selected].rows+' строк';
  if(focus)items[selected].button.focus({preventScroll:true});
  revealSelected();
  schedule();
 }
 function revealSelected(){if(!items[selected]||!track)return;const cell=items[selected].cell.getBoundingClientRect(),view=track.getBoundingClientRect();if(view.width>0&&view.height>0)track.scrollLeft+=cell.left<view.left?cell.left-view.left:cell.right>view.right?cell.right-view.right:0;}
 function schedule(){if(timer!==null)win.clearTimeout(timer);timer=null;if(playing&&!section.hidden&&items.length>1)timer=win.setTimeout(()=>{timer=null;select((selected+1)%items.length);},delay);}
 function pause(){playing=false;if(timer!==null)win.clearTimeout(timer);timer=null;if(playButton){playButton.querySelector('.may-gif-button-caption').textContent='▶ Пуск';playButton.setAttribute('aria-label','Воспроизвести кадры GIF');playButton.setAttribute('aria-pressed','false');}}
 function play(){if(!items.length||section.hidden)return;playing=true;playButton.querySelector('.may-gif-button-caption').textContent='Ⅱ Пауза';playButton.setAttribute('aria-label','Приостановить просмотр GIF');playButton.setAttribute('aria-pressed','true');schedule();}
 function setBusy(value){busy=!!value;if(!section)return;section.setAttribute('aria-busy',String(busy));for(const button of modeButtons)button.disabled=busy;download.disabled=busy;download.setAttribute('aria-disabled',String(busy));}
 function finish(){
  if(!drag)return;const previous=drag;drag=null;
  try{if(previous.handle.hasPointerCapture?.(previous.id))previous.handle.releasePointerCapture(previous.id);}catch{}
  section.classList.remove('may-gif-resizing');save();
 }
 function viewport(){const v=win.visualViewport;return {left:v?.offsetLeft||0,top:v?.offsetTop||0,width:Math.max(1,v?.width||win.innerWidth||doc.documentElement.clientWidth||1),height:Math.max(1,v?.height||win.innerHeight||doc.documentElement.clientHeight||1)};}
 function measuredBox(){const r=section?.getBoundingClientRect();return {left:r?.width?r.left:box?.left,top:r?.height?r.top:box?.top,width:r?.width||box?.width,height:r?.height||box?.height};}
 function place(value){
  const view=viewport(),gap=Math.min(8,view.width/4,view.height/4),maxWidth=view.width-2*gap,maxHeight=view.height-2*gap;
  const w=Math.max(Math.min(240,maxWidth),Math.min(maxWidth,value.width)),h=Math.max(Math.min(320,maxHeight),Math.min(maxHeight,value.height));
  const left=Math.max(view.left+gap,Math.min(view.left+view.width-gap-w,value.left)),top=Math.max(view.top+gap,Math.min(view.top+view.height-gap-h,value.top));
  box={left,top,width:w,height:h};if(!section)return;
  const styles={left:left+'px',top:top+'px',width:w+'px',height:h+'px',minWidth:Math.min(240,maxWidth)+'px',minHeight:Math.min(320,maxHeight)+'px',maxWidth:(view.left+view.width-gap-left)+'px',maxHeight:(view.top+view.height-gap-top)+'px'};
  for(const [key,value]of Object.entries(styles))if(section.style[key]!==value)section.style[key]=value;
  revealSelected();
 }
 function initialBox(){const v=viewport(),w=Math.min(1000,v.width*.9),h=Math.min(720,v.height*.85);return {left:v.left+(v.width-w)/2,top:v.top+(v.height-h)/2,width:w,height:h};}
 function finishMove(){if(!moving)return;const previous=moving;moving=null;try{if(header.hasPointerCapture?.(previous.id))header.releasePointerCapture(previous.id);}catch{}section.classList.remove('may-gif-moving');}
 function reveal(){section.hidden=false;place(box?measuredBox():initialBox());}
 function hide(){pause();finish();finishMove();if(section)section.hidden=true;}
 function mount(){
  if(section)return true;if(!doc.body)return false;
  section=doc.createElement('section');section.id='mayGifStrip';section.hidden=true;section.setAttribute('role','dialog');section.setAttribute('aria-modal','false');section.setAttribute('aria-label','Гиф-Масштаб');section.setAttribute('data-no-mini','');
  header=doc.createElement('div');header.className='may-gif-strip-header';header.tabIndex=0;header.setAttribute('aria-label','Переместить окно Гиф-Масштаб: потяните шапку или используйте стрелки');
  title=doc.createElement('span');title.className='may-gif-strip-title';
  const close=button(win.HubButtonText?.shortCaption('× Скрыть')||'× Скрыть','may-gif-strip-close',hide);close.title='Скрыть ленту кадров GIF';close.setAttribute('aria-label',close.title);
  header.append(title,close);
  const toolbar=doc.createElement('div');toolbar.className='may-gif-strip-toolbar';
  function button(label,cls,handler,width=120){const node=doc.createElement('button');node.type='button';node.className='gz-hx may-standard '+cls;
   const caption=doc.createElement('span');caption.className='may-gif-button-caption';caption.textContent=label;
   const svg=doc.createElementNS('http://www.w3.org/2000/svg','svg'),polygon=doc.createElementNS('http://www.w3.org/2000/svg','polygon');svg.classList.add('may-standard-outline');svg.setAttribute('viewBox','0 0 '+width+' 24');svg.setAttribute('aria-hidden','true');polygon.setAttribute('points','12,0 '+(width-12)+',0 '+width+',12 '+(width-12)+',24 12,24 0,12');svg.append(polygon);node.append(caption,svg);node.addEventListener('click',handler);return node;}
  modeButtons=[['pixels','На весь кадр'],['scale','Уменьшать']].map(([value,label])=>{const node=button(label,'may-gif-strip-mode',()=>{if(!busy&&value!==presentation)onPresentationChange?.(value,selected);});node.dataset.presentation=value;node.setAttribute('aria-label',value==='pixels'?'Фигура занимает весь кадр GIF':'Фигура уменьшается внутри кадра GIF');return node;});
  download=button('↓ Скачать','may-gif-strip-download',()=>{if(busy||!downloadUrl)return;const anchor=doc.createElement('a');anchor.href=downloadUrl;anchor.download=download.dataset.filename;doc.body.append(anchor);anchor.click();anchor.remove();});download.hidden=true;toolbar.append(...modeButtons,download);
  const display=doc.createElement('div');display.className='may-gif-strip-display';stage=doc.createElement('img');stage.className='may-gif-strip-stage';stage.draggable=false;stage.decoding='async';display.append(stage);
  const transport=doc.createElement('div');transport.className='may-gif-strip-transport';
  previousButton=button('◀','may-gif-strip-previous',()=>select((selected-1+items.length)%items.length),40);previousButton.setAttribute('aria-label','Предыдущий кадр GIF');
  playButton=button('▶ Пуск','may-gif-strip-play',()=>playing?pause():play(),88);playButton.setAttribute('aria-label','Воспроизвести кадры GIF');playButton.setAttribute('aria-pressed','false');
  nextButton=button('▶','may-gif-strip-next',()=>select((selected+1)%items.length),40);nextButton.setAttribute('aria-label','Следующий кадр GIF');
  range=doc.createElement('input');range.type='range';range.min='0';range.step='1';range.className='may-gif-strip-seek';range.setAttribute('aria-label','Кадр GIF');range.addEventListener('input',()=>select(Number(range.value)));
  counter=doc.createElement('span');counter.className='may-gif-strip-counter';transport.append(previousButton,playButton,nextButton,range,counter);
  track=doc.createElement('div');track.className='may-gif-strip-track';track.setAttribute('role','group');track.setAttribute('aria-label','Миниатюры кадров GIF. Выбор меняет большой кадр; угол меняет размер миниатюр.');track.tabIndex=0;
  status=doc.createElement('span');status.className='may-gif-strip-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  section.append(header,toolbar,display,transport,track,status);doc.body.append(section);setBusy(busy);
  header.addEventListener('pointerdown',event=>{if(event.target.closest?.('button,input,select,a')||(event.button!==undefined&&event.button!==0)||event.isPrimary===false)return;event.preventDefault();finishMove();moving={id:event.pointerId,x:event.clientX,y:event.clientY,box:measuredBox()};section.classList.add('may-gif-moving');try{header.setPointerCapture(event.pointerId);}catch{}});
  header.addEventListener('lostpointercapture',finishMove);
  header.addEventListener('keydown',event=>{if(event.target!==header)return;const step=event.shiftKey?40:10,next=measuredBox();if(event.key==='ArrowLeft')next.left-=step;else if(event.key==='ArrowRight')next.left+=step;else if(event.key==='ArrowUp')next.top-=step;else if(event.key==='ArrowDown')next.top+=step;else if(event.key==='Home'){next.left=viewport().left;next.top=viewport().top;}else if(event.key==='End'){const v=viewport();next.left=v.left+v.width;next.top=v.top+v.height;}else return;event.preventDefault();place(next);});
  if(win.ResizeObserver){panelObserver=new win.ResizeObserver(()=>{if(section&&!section.hidden)place(measuredBox());});panelObserver.observe(section);}
  if(win.IntersectionObserver)observer=new win.IntersectionObserver(entries=>{for(const entry of entries){const img=entry.target;if(entry.isIntersecting&&track.contains(img))img.src=img.dataset.frameUrl;else img.removeAttribute('src');}},{root:track,rootMargin:'200px'});
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
  handle.addEventListener('keydown',event=>{const step=event.shiftKey?32:8;let value=edge;if(event.key==='ArrowRight'||event.key==='ArrowDown')value+=step;else if(event.key==='ArrowLeft'||event.key==='ArrowUp')value-=step;else if(event.key==='Home')value=64;else if(event.key==='End')value=maxEdge();else return;event.preventDefault();resize(value);});
  handle.addEventListener('lostpointercapture',finish);
  const caption=doc.createElement('div');caption.className='may-gif-strip-caption';caption.textContent=(index+1)+' · '+entry.rows+' строк';
  imageBox.append(button,handle);cell.append(imageBox,caption);track.append(cell);return {cell,button,handle,rows:entry.rows};
 }
 function release(){pause();finish();observer?.disconnect();stage?.removeAttribute('src');track?.querySelectorAll('img').forEach(img=>img.removeAttribute('src'));urls.forEach(url=>win.URL.revokeObjectURL(url));urls=[];if(downloadUrl)win.URL.revokeObjectURL(downloadUrl);downloadUrl=null;items=[];track?.replaceChildren();}
 function show(frames,options={}){
  const w=Number(options.width),h=Number(options.height);
  if(!Array.isArray(frames)||!frames.length||!Number.isFinite(w)||!Number.isFinite(h)||w<=0||h<=0||frames.some(f=>!f?.blob||!Number.isFinite(f.rows)||f.rows<0))return false;
  if(!mount())return false;
  // Create the replacement before releasing the previous generation.
  const next=[];let nextDownload=null;try{for(const entry of frames)next.push(win.URL.createObjectURL(entry.blob));if(options.blob)nextDownload=win.URL.createObjectURL(options.blob);}catch{next.forEach(url=>win.URL.revokeObjectURL(url));if(nextDownload)win.URL.revokeObjectURL(nextDownload);return false;}
  release();urls=next;downloadUrl=nextDownload;width=w;height=h;selected=0;delay=Number.isFinite(Number(options.delay))?Math.max(10,Number(options.delay)):100;presentation=options.presentation==='scale'?'scale':'pixels';onPresentationChange=typeof options.onPresentationChange==='function'?options.onPresentationChange:null;
  items=frames.map(frame);title.textContent=(options.name?String(options.name)+' · ':'')+frames.length+' кадров';title.title=title.textContent;
  range.max=String(items.length-1);for(const node of modeButtons){node.hidden=!onPresentationChange;node.setAttribute('aria-pressed',String(node.dataset.presentation===presentation));}download.hidden=!downloadUrl;download.dataset.filename=options.name?String(options.name):'Гиф-Масштаб.gif';previousButton.disabled=nextButton.disabled=playButton.disabled=items.length<2;range.disabled=items.length<2;
  status.textContent='Большой кадр вписан целиком. Миниатюры и бегунок выбирают кадр; кнопка Пуск проигрывает ленту.';setBusy(busy);
  resize(edge,false);track.scrollLeft=0;track.scrollTop=0;reveal();select(Number.isInteger(options.selectedIndex)?options.selectedIndex:0);return true;
 }
 function open(){if(!items.length)return false;reveal();return true;}
 win.addEventListener('pointermove',event=>{if(moving&&event.pointerId===moving.id){event.preventDefault();place({...moving.box,left:moving.box.left+event.clientX-moving.x,top:moving.box.top+event.clientY-moving.y});return;}if(!drag||event.pointerId!==drag.id)return;event.preventDefault();const s=Math.max(width,height),vx=width/s,vy=height/s;resize(drag.edge+((event.clientX-drag.x)*vx+(event.clientY-drag.y)*vy)/(vx*vx+vy*vy),false);},{passive:false,capture:true});
 for(const type of ['pointerup','pointercancel'])win.addEventListener(type,event=>{if(drag&&event.pointerId===drag.id)finish();if(moving&&event.pointerId===moving.id)finishMove();},true);
 function relayout(){if(!items.length)return;finishMove();resize(edge,false);if(section&&!section.hidden)place(measuredBox());}
 win.addEventListener('blur',()=>{finish();finishMove();});win.addEventListener('resize',relayout);win.visualViewport?.addEventListener('resize',relayout);win.visualViewport?.addEventListener('scroll',relayout);
 win.addEventListener('pagehide',()=>{hide();release();panelObserver?.disconnect();});
 return {show,open,hide,setBusy};
});
