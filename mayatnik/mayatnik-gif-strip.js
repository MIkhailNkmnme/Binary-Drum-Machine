/* Static GIF frames use native images: resizing never allocates a scaled canvas. */
(function(root,factory){
 'use strict';
 if(typeof module==='object'&&module.exports)module.exports={create:factory};
 else {root.MayatnikGifStrip=factory(root);root.MayatnikGifStrip.create=factory;}
})(typeof window==='object'?window:globalThis,function(win,hostOptions){
 'use strict';
 hostOptions=hostOptions||{};
 const doc=win.document,key='mayatnik.gifStrip.thumbSize.v2';
 let section,track,title,status,header,observer,panelObserver,stage,range,counter,playButton,previousButton,nextButton,download,items=[],urls=[],selected=0,width=1,height=1,edge=88,drag=null,moving=null,box=null,playing=false,timer=null,delay=100,busy=false,downloadUrl=null;
 try{const saved=JSON.parse(win.localStorage.getItem(key));if(Number.isFinite(saved)&&saved>0)edge=saved;}catch{}
 let groups=[],activeGroup=null,tracksArea,display,overlay,searchBar,searchStatus,digitButton,settingsBar,speedInput,speedRange,sequenceInput,generateButton,cancelButton,montageButton,libraryButton,frameButton,applyButton,recordButton,stackButton,recording=false,recordInfo={},stackEnabled=false,searchOptions={},searchToken=0,searchRun=null,searchTask=Promise.resolve(),searchYield=null,digits=false,frameSelectionStatus,selectAllButton,selectNoneButton,filterButton,xorButton;
 const allItems=()=>groups.length?groups.flatMap(g=>g.items):items;
 const boundedDelay=value=>Math.max(20,Math.min(5000,Math.round((Number(value)||100)/10)*10));
 function setDelay(value,notify=false){delay=boundedDelay(value);if(speedInput)speedInput.value=String(delay);if(speedRange)speedRange.value=String(delay);if(notify){searchOptions.onDelayChange?.(delay);schedule();}}
 const maxEdge=()=>128;
 const size=()=>({width:edge*width/Math.max(width,height),height:edge*height/Math.max(width,height)});
 function save(){try{win.localStorage.setItem(key,JSON.stringify(edge));}catch{}}
 function resize(value,persist=true){
  edge=Math.max(64,Math.min(maxEdge(),value));const s=size();
  if(section){section.style.setProperty('--may-gif-width',s.width+'px');section.style.setProperty('--may-gif-height',s.height+'px');
   for(const item of allItems()){item.handle.setAttribute('aria-valuemin','64');item.handle.setAttribute('aria-valuemax',String(maxEdge()));item.handle.setAttribute('aria-valuenow',String(Math.round(edge)));item.handle.setAttribute('aria-valuetext',Math.round(s.width)+' × '+Math.round(s.height)+' пикселей');}}
  for(const g of groups){const d=Math.max(g.variant.plan.width,g.variant.plan.height);g.track.style.setProperty('--may-gif-width',edge*g.variant.plan.width/d+'px');g.track.style.setProperty('--may-gif-height',edge*g.variant.plan.height/d+'px');}
  if(persist)save();
 }
 function selectedFrames(){return items.filter(item=>item.included!==false).map(item=>item.entry);}
 function selectionStatus(){if(frameSelectionStatus)frameSelectionStatus.textContent='Текущая лента: '+selectedFrames().length+' / '+items.length+' выбрано';}
 async function selectedVariant(){const variant=activeGroup?.variant;if(!variant)return variant;const frames=selectedFrames();if(!frames.length)throw Error('Выберите хотя бы один кадр');if(frames.length===items.length)return variant;if(typeof searchOptions.onFrameSet!=='function')throw Error('Обработка кадров недоступна');return searchOptions.onFrameSet({variant,frames,delay,operation:'filter'});}
 async function processFrames(operation){if(busy||!activeGroup)return;const frames=selectedFrames();if(!frames.length){status.textContent='Выберите хотя бы один кадр';return;}const group=activeGroup,options=searchOptions,old=groups.map(g=>g.variant);setBusy(true);try{const variant=await options.onFrameSet({variant:group.variant,frames,delay,operation});const variants=operation==='xor'?[...old,variant]:old.map(v=>v===group.variant?variant:v);options.onVariantsChange?.({variants,selectedVariant:variant.id});showVariants(variants,{...options,selectedVariant:variant.id,selectedIndex:0});}catch(error){status.textContent=error.message||'Ошибка обработки кадров';}finally{setBusy(false);}}
 function select(index,focus=false){
  if(!items.length)return;
  selected=Math.max(0,Math.min(items.length-1,index));
  allItems().forEach(item=>{const active=items[selected]===item;item.button.setAttribute('aria-pressed',String(active));item.handle.hidden=!active;item.handle.tabIndex=active?0:-1;});
  stage.src=(activeGroup?.urls||urls)[selected];stage.alt='Кадр '+(selected+1)+', '+items[selected].rows+' строк';range.value=String(selected);range.setAttribute('aria-valuetext','Кадр '+(selected+1)+' из '+items.length+', '+items[selected].rows+' строк');counter.textContent=(selected+1)+' / '+items.length+' · '+items[selected].rows+' строк';
  if(focus)items[selected].button.focus({preventScroll:true});
  updateSearchStatus();drawOverlay();searchOptions.onSelection?.({variant:activeGroup?.variant||null,index:selected,frame:items[selected].entry});
  revealSelected();
  schedule();
 }
 function revealSelected(){if(!items[selected]||!track)return;const cell=items[selected].cell.getBoundingClientRect(),view=track.getBoundingClientRect();if(view.width>0&&view.height>0)track.scrollLeft+=cell.left<view.left?cell.left-view.left:cell.right>view.right?cell.right-view.right:0;}
 function schedule(){if(timer!==null)win.clearTimeout(timer);timer=null;if(playing&&!section.hidden&&items.length>1)timer=win.setTimeout(()=>{timer=null;select((selected+1)%items.length);},delay);}
 function pause(){playing=false;if(timer!==null)win.clearTimeout(timer);timer=null;if(playButton){playButton.querySelector('.may-gif-button-caption').textContent='▶ Пуск';playButton.setAttribute('aria-label','Воспроизвести кадры GIF');playButton.setAttribute('aria-pressed','false');}}
 function play(){if(!items.length||section.hidden)return;playing=true;playButton.querySelector('.may-gif-button-caption').textContent='Ⅱ Пауза';playButton.setAttribute('aria-label','Приостановить просмотр GIF');playButton.setAttribute('aria-pressed','true');schedule();}
 function setBusy(value){busy=!!value;if(!section)return;section.setAttribute('aria-busy',String(busy));if(generateButton)generateButton.disabled=busy;if(cancelButton)cancelButton.hidden=!busy;if(speedInput)speedInput.disabled=busy;if(speedRange)speedRange.disabled=busy;if(sequenceInput)sequenceInput.disabled=busy;for(const b of [libraryButton,frameButton,applyButton,selectAllButton,selectNoneButton,filterButton,xorButton])if(b)b.disabled=busy;syncLiveButtons();download.disabled=busy;download.setAttribute('aria-disabled',String(busy));}
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
 function hide(){pause();clearSearch();finish();finishMove();if(section)section.hidden=true;hostOptions.onHide?.();}
 function mount(){
  if(section)return true;if(!doc.body)return false;
  section=doc.createElement('section');section.id='mayGifStrip';section.hidden=true;section.setAttribute('role','dialog');section.setAttribute('aria-modal','false');section.setAttribute('aria-label','Гиф-Масштаб');section.setAttribute('data-no-mini','');
  header=doc.createElement('div');header.className='may-gif-strip-header';header.tabIndex=0;header.setAttribute('aria-label','Переместить окно Гиф-Масштаб: потяните шапку или используйте стрелки');
  title=doc.createElement('span');title.className='may-gif-strip-title';
  const close=button(win.HubButtonText?.shortCaption('× Скрыть')||'× Скрыть','may-gif-strip-close',hide);close.title='Скрыть ленту кадров GIF';close.setAttribute('aria-label',close.title);
  header.append(title,close);
  const toolbar=doc.createElement('div');toolbar.className='may-gif-strip-toolbar';
  function button(label,cls,handler,width=120){const node=doc.createElement('button');node.type='button';node.className='gz-hx may-standard '+cls;
   const caption=doc.createElement('span');caption.className='may-gif-button-caption';caption.textContent=win.HubButtonText?.shortCaption(label)||label;node.title=label;node.setAttribute('aria-label',label);
   const svg=doc.createElementNS('http://www.w3.org/2000/svg','svg'),polygon=doc.createElementNS('http://www.w3.org/2000/svg','polygon');svg.classList.add('may-standard-outline');svg.setAttribute('viewBox','0 0 '+width+' 24');svg.setAttribute('aria-hidden','true');polygon.setAttribute('points','12,0 '+(width-12)+',0 '+width+',12 '+(width-12)+',24 12,24 0,12');svg.append(polygon);node.append(caption,svg);node.addEventListener('click',handler);return node;}
  download=button('↓ Скачать','may-gif-strip-download',async()=>{if(busy)return;if(searchOptions.onDownload){setBusy(true);try{await searchOptions.onDownload({variant:await selectedVariant(),index:selected,delay});}catch(error){status.textContent=error.message||'Ошибка сохранения';}finally{setBusy(false);}return;}const activeDownload=activeGroup?.downloadUrl||downloadUrl;if(!activeDownload)return;const anchor=doc.createElement('a');anchor.href=activeDownload;anchor.download=download.dataset.filename;doc.body.append(anchor);anchor.click();anchor.remove();});download.hidden=true;toolbar.append(download);
  async function exportSelection(callback,message){if(busy||!items.length)return;const payload={variant:activeGroup?.variant,index:selected,frame:items[selected].entry,delay};setBusy(true);try{if(callback==='onSaveLibrary'){payload.variant=await selectedVariant();payload.index=Math.max(0,payload.variant.frames.indexOf(items[selected].entry));}await searchOptions[callback](payload);status.textContent=message;}catch(error){status.textContent=error.message||'Ошибка экспорта';}finally{setBusy(false);}}
  libraryButton=button('В GIF-библиотеку','may-gif-strip-save-library',()=>exportSelection('onSaveLibrary','GIF сохранён: Библиотека → GIF → Масштабы'));libraryButton.setAttribute('aria-label','Сохранить анимацию в Библиотека → GIF → Масштабы');
  frameButton=button('Кадр в библиотеку','may-gif-strip-save-frame',()=>exportSelection('onSaveFrame','Кадр сохранён в библиотеку кадров'));frameButton.setAttribute('aria-label','Сохранить выбранный кадр в библиотеку кадров');
  applyButton=button('Кадр на поле','may-gif-strip-apply-frame',()=>exportSelection('onApplyFrame','Выбранный кадр заменил текущее поле'));applyButton.setAttribute('aria-label','Заменить текущее поле выбранным кадром GIF');
  for(const b of [libraryButton,frameButton,applyButton])b.hidden=true;toolbar.append(libraryButton,frameButton,applyButton);
  selectAllButton=button('Все кадры','may-gif-frames-all',()=>{for(const item of items){item.included=true;item.checkbox.checked=true;}selectionStatus();});
  selectNoneButton=button('Снять все','may-gif-frames-none',()=>{for(const item of items){item.included=false;item.checkbox.checked=false;}selectionStatus();});
  filterButton=button('Оставить выбранные','may-gif-frames-filter',()=>processFrames('filter'));
  xorButton=button('XOR выбранных','may-gif-frames-xor',()=>processFrames('xor'));
  frameSelectionStatus=doc.createElement('span');frameSelectionStatus.className='may-gif-frame-selection-status';toolbar.append(selectAllButton,selectNoneButton,filterButton,xorButton,frameSelectionStatus);
  display=doc.createElement('div');display.className='may-gif-strip-display';stage=doc.createElement('img');stage.className='may-gif-strip-stage';stage.draggable=false;stage.decoding='async';display.append(stage);stage.addEventListener('load',drawOverlay);
  const transport=doc.createElement('div');transport.className='may-gif-strip-transport';
  previousButton=button('◀','may-gif-strip-previous',()=>select((selected-1+items.length)%items.length),40);previousButton.setAttribute('aria-label','Предыдущий кадр GIF');
  playButton=button('▶ Пуск','may-gif-strip-play',()=>playing?pause():play(),88);playButton.setAttribute('aria-label','Воспроизвести кадры GIF');playButton.setAttribute('aria-pressed','false');
  nextButton=button('▶','may-gif-strip-next',()=>select((selected+1)%items.length),40);nextButton.setAttribute('aria-label','Следующий кадр GIF');
  range=doc.createElement('input');range.type='range';range.min='0';range.step='1';range.className='may-gif-strip-seek';range.setAttribute('aria-label','Кадр GIF');range.addEventListener('input',()=>select(Number(range.value)));
  counter=doc.createElement('span');counter.className='may-gif-strip-counter';transport.append(previousButton,playButton,nextButton,range,counter);
  track=doc.createElement('div');track.className='may-gif-strip-track';track.setAttribute('role','group');track.setAttribute('aria-label','Миниатюры кадров GIF. Выбор меняет большой кадр; угол меняет размер миниатюр.');track.tabIndex=0;
  tracksArea=doc.createElement('div');tracksArea.className='may-gif-strip-tracks';tracksArea.append(track);
  searchBar=doc.createElement('div');searchBar.className='may-gif-strip-search';searchBar.hidden=true;
  digitButton=button('0/1','may-gif-strip-digits',()=>{digits=!digits;searchOptions.digits=digits;searchOptions.onDigitsChange?.(digits);digitButton.setAttribute('aria-pressed',String(digits));drawOverlay();});digitButton.setAttribute('aria-label','Показать цифры битов');digitButton.setAttribute('aria-pressed','false');
  searchStatus=doc.createElement('span');searchStatus.className='may-gif-strip-search-status';searchStatus.setAttribute('role','status');searchStatus.setAttribute('aria-live','polite');
  searchBar.append(digitButton,searchStatus);
  settingsBar=doc.createElement('div');settingsBar.className='may-gif-strip-settings';settingsBar.hidden=true;
  const speedLabel=doc.createElement('label');speedLabel.textContent='мс/кадр ';speedInput=doc.createElement('input');speedInput.type='number';speedInput.min='20';speedInput.max='5000';speedInput.step='10';speedInput.className='may-gif-strip-speed';speedInput.setAttribute('aria-label','Задержка кадров GIF в миллисекундах');speedInput.addEventListener('change',()=>setDelay(speedInput.value,true));speedLabel.append(speedInput);
  speedRange=doc.createElement('input');speedRange.type='range';speedRange.min='20';speedRange.max='5000';speedRange.step='10';speedRange.className='may-gif-strip-speed-range';speedRange.setAttribute('aria-label','Скорость GIF: задержка кадра в миллисекундах');speedRange.addEventListener('input',()=>setDelay(speedRange.value,true));
  sequenceInput=doc.createElement('select');sequenceInput.className='may-gif-strip-sequence';sequenceInput.setAttribute('aria-label','Последовательность уменьшения GIF');for(const [value,text]of [['step8','Шаг 8'],['powers2','Степени 2']]){const o=doc.createElement('option');o.value=value;o.textContent=win.HubButtonText?.shortCaption(text)||text;sequenceInput.append(o);}
  generateButton=button('↻ Создать','may-gif-strip-generate',async()=>{if(busy||!searchOptions.onGenerate)return;setBusy(true);try{await searchOptions.onGenerate({sequence:sequenceInput.value,delay});}catch(error){status.textContent=error.message||'Ошибка создания';}finally{setBusy(false);}});generateButton.setAttribute('aria-label','Создать варианты GIF с выбранными настройками');
  cancelButton=button('× Отмена','may-gif-strip-cancel',()=>searchOptions.onCancel?.());cancelButton.setAttribute('aria-label','Отменить создание GIF');cancelButton.hidden=true;montageButton=button('▦ Монтаж','may-gif-strip-montage',()=>searchOptions.onMontage?.());montageButton.setAttribute('aria-label','Открыть монтаж GIF');settingsBar.append(speedLabel,speedRange,sequenceInput,generateButton,cancelButton,montageButton);
  recordButton=button('● Кадры GIF','may-gif-strip-record',async()=>{if(busy||(!recording&&!items.length))return;try{await searchOptions.onRecord({variant:activeGroup?.variant,index:selected,frame:items[selected]?.entry,delay});}catch(error){status.textContent=error.message||'Ошибка записи';}});recordButton.setAttribute('aria-label','Записать смену кадров Маятника на выбранном уровне детализации; повторно — завершить');
  stackButton=button('▦ Под полем','may-gif-strip-stack',()=>{try{const value=searchOptions.onStackToggle();if(typeof value==='boolean')setStackEnabled(value);}catch(error){status.textContent=error.message||'Ошибка показа масштабов';}});stackButton.setAttribute('aria-label','Показать или скрыть живые масштабы под оригиналом в Маятнике');settingsBar.append(recordButton,stackButton);
  status=doc.createElement('span');status.className='may-gif-strip-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  section.append(header,toolbar,settingsBar,searchBar,display,transport,tracksArea,status);doc.body.append(section);setBusy(busy);
  header.addEventListener('pointerdown',event=>{if(event.target.closest?.('button,input,select,a')||(event.button!==undefined&&event.button!==0)||event.isPrimary===false)return;event.preventDefault();finishMove();moving={id:event.pointerId,x:event.clientX,y:event.clientY,box:measuredBox()};section.classList.add('may-gif-moving');try{header.setPointerCapture(event.pointerId);}catch{}});
  header.addEventListener('lostpointercapture',finishMove);
  header.addEventListener('keydown',event=>{if(event.target!==header)return;const step=event.shiftKey?40:10,next=measuredBox();if(event.key==='ArrowLeft')next.left-=step;else if(event.key==='ArrowRight')next.left+=step;else if(event.key==='ArrowUp')next.top-=step;else if(event.key==='ArrowDown')next.top+=step;else if(event.key==='Home'){next.left=viewport().left;next.top=viewport().top;}else if(event.key==='End'){const v=viewport();next.left=v.left+v.width;next.top=v.top+v.height;}else return;event.preventDefault();place(next);});
  if(win.ResizeObserver){panelObserver=new win.ResizeObserver(()=>{if(section&&!section.hidden)place(measuredBox());drawOverlay();});panelObserver.observe(section);}
  if(win.IntersectionObserver)observer=new win.IntersectionObserver(entries=>{for(const entry of entries){const img=entry.target;if(entry.isIntersecting&&tracksArea.contains(img))img.src=img.dataset.frameUrl;else img.removeAttribute('src');}},{root:track,rootMargin:'200px'});
  // Bubble isolation preserves native touch scrolling and focused keyboard controls.
  for(const type of ['pointerdown','pointermove','pointerup','pointercancel','mousedown','mousemove','mouseup','click','dblclick','contextmenu','keydown','keyup','wheel','touchstart','touchmove','touchend'])section.addEventListener(type,event=>event.stopPropagation());
  section.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();hide();}});
  return true;
 }
 function frame(entry,index,group=null){
  const frameTrack=group?.track||track,frameUrls=group?.urls||urls;
  const cell=doc.createElement('div');cell.className='may-gif-strip-frame';
  const imageBox=doc.createElement('div');imageBox.className='may-gif-strip-image';
  const button=doc.createElement('button');button.type='button';button.className='may-gif-strip-select';button.title='Выбрать кадр '+(index+1)+(entry.label?', '+entry.label:', строк: '+entry.rows);button.setAttribute('aria-label',button.title);
  const img=doc.createElement('img');img.loading='lazy';img.decoding='async';img.dataset.frameUrl=frameUrls[index];if(observer)observer.observe(img);else img.src=frameUrls[index];img.alt='Кадр '+(index+1);img.draggable=false;button.append(img);
  button.addEventListener('click',()=>{if(group)activate(group,index);else select(index);});
  button.addEventListener('keydown',event=>{if(!['ArrowRight','ArrowLeft','Home','End'].includes(event.key))return;if(group&&activeGroup!==group)activate(group,index);let next=index;if(event.key==='ArrowRight')next++;else if(event.key==='ArrowLeft')next--;else if(event.key==='Home')next=0;else if(event.key==='End')next=items.length-1;else return;event.preventDefault();select(next,true);});
  const handle=doc.createElement('span');handle.className='may-gif-strip-resize';handle.setAttribute('role','slider');handle.setAttribute('aria-label','Размер всех кадров GIF');handle.title='Изменить размер всех кадров: потяните угол или используйте стрелки, Home и End';handle.textContent='◢';
  handle.addEventListener('pointerdown',event=>{if((event.button!==undefined&&event.button!==0)||event.isPrimary===false)return;event.preventDefault();finish();if(group)activate(group,index);else select(index);drag={id:event.pointerId,x:event.clientX,y:event.clientY,edge,handle};section.classList.add('may-gif-resizing');try{handle.setPointerCapture(event.pointerId);}catch{}});
  handle.addEventListener('keydown',event=>{const step=event.shiftKey?32:8;let value=edge;if(event.key==='ArrowRight'||event.key==='ArrowDown')value+=step;else if(event.key==='ArrowLeft'||event.key==='ArrowUp')value-=step;else if(event.key==='Home')value=64;else if(event.key==='End')value=maxEdge();else return;event.preventDefault();resize(value);});
  handle.addEventListener('lostpointercapture',finish);
  const caption=doc.createElement('div');caption.className='may-gif-strip-caption';caption.textContent=(index+1)+' · '+(entry.label||entry.rows+' строк');
  const checkLabel=doc.createElement('label'),checkbox=doc.createElement('input');checkbox.type='checkbox';checkbox.checked=true;checkbox.className='may-gif-frame-check';checkbox.setAttribute('aria-label','Включить кадр '+(index+1)+' в GIF и XOR');checkLabel.className='may-gif-frame-check-label';checkLabel.append(checkbox);checkLabel.append('В GIF / XOR');
  const item={cell,button,handle,checkbox,included:true,caption,captionText:caption.textContent,rows:entry.rows,entry};checkbox.addEventListener('change',()=>{item.included=checkbox.checked;if(group&&activeGroup!==group)activate(group,index);selectionStatus();});
  imageBox.append(button,handle);cell.append(imageBox,caption,checkLabel);frameTrack.append(cell);return item;
 }
 // Packed masks stay bounded independently of the cached image/semantic grids.
 const maskBudget=32*1024*1024;
 function clearSearch(){
  searchToken++;searchRun=null;
  if(searchYield){win.clearTimeout(searchYield.id);searchYield.resolve();searchYield=null;}
  for(const item of allItems()){item.search=null;item.caption.textContent=item.captionText;item.button.setAttribute('aria-label',item.button.title);}
  if(searchStatus){searchStatus.textContent='';searchStatus.setAttribute('aria-busy','false');}drawOverlay();
 }
 function updateSearchStatus(){
  if(!searchStatus)return;
  const run=searchRun,result=items[selected]?.search;
  if(!run){searchStatus.textContent=searchOptions.searchEnabled?.()?'':'Включите Поиск в Маятнике';return;}
  if(run.error){searchStatus.textContent='Поиск Маятника: '+run.error;searchStatus.setAttribute('aria-busy','false');return;}
  const progress=run.done<run.total?'Поиск Маятника: '+run.done+' / '+run.total+' кадров':'Поиск Маятника: '+run.total+' кадров';
  const frame=result?' · кадр: '+result.count+' совпадений'+(result.reason?' · '+result.reason:''):' · кадр: ожидает поиска';
  searchStatus.textContent=progress+' · всего: '+run.count+' совпадений'+frame+(run.errors?' · ошибок: '+run.errors:'')+(run.omitted?' · часть подсветки не сохранена: лимит памяти':'');
  searchStatus.setAttribute('aria-busy',String(run.done<run.total));
 }
 function yieldSearch(){return new Promise(resolve=>{searchYield={resolve,id:win.setTimeout(()=>{searchYield=null;resolve();},0)};});}
 function maskAt(result,index){return !!(result?.mask?.[index>>3]&(1<<(index&7)));}
 function semantic(){return items[selected]?.entry?.semantic;}
 function drawOverlay(){
  if(!overlay)return;const rect=display.getBoundingClientRect(),w=Math.round(rect.width),h=Math.round(rect.height);overlay.width=w;overlay.height=h;
  if(!w||!h)return;const ctx=overlay.getContext('2d');if(!ctx)return;ctx.clearRect(0,0,w,h);
  const searchResult=items[selected]?.search,searchMask=searchResult?.mask;
  const grid=semantic();if(!grid?.bits||!grid.width||!grid.height||(!digits&&!searchMask))return;
  const scale=Math.min(w/width,h/height),left=(w-width*scale)/2,top=(h-height*scale)/2,b=grid.bounds||{left:0,top:0,width,height},cw=b.width*scale/grid.width,ch=b.height*scale/grid.height;
  const readable=digits&&Math.min(cw,ch)>=9&&grid.bits.length<=100000;
  digitButton.title=readable?'Показать цифры битов; · — смешанный пиксель':'Показать цифры битов: увеличьте окно или выберите более мелкий кадр';
  if(!readable&&!searchMask)return;
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=Math.max(8,Math.min(18,Math.min(cw,ch)*.7))+'px monospace';
  for(let i=0;i<grid.bits.length;i++){const bit=grid.bits[i];if(bit===-1)continue;const x=left+(b.left+i%grid.width*b.width/grid.width)*scale,y=top+(b.top+Math.floor(i/grid.width)*b.height/grid.height)*scale;
   if((bit===0||bit===1)&&maskAt(searchResult,i)){ctx.fillStyle='rgba(255,190,40,.5)';ctx.fillRect(x,y,cw,ch);}
   if(readable){ctx.lineWidth=2;ctx.strokeStyle=bit===0?'#fff':'#000';ctx.fillStyle=bit===0?'#000':'#fff';const text=bit===0?'0':bit===1?'1':'·';if(win.MayatnikBitGlyph)win.MayatnikBitGlyph.draw(ctx,text,x+cw/2,y+ch/2,true);else{ctx.strokeText(text,x+cw/2,y+ch/2);ctx.fillText(text,x+cw/2,y+ch/2);}}
  }
 }
 async function runSearch(token,frames,search){
  const cancelled=()=>token!==searchToken||section.hidden||!searchOptions.searchEnabled?.();
  if(cancelled())return;
  const run=searchRun={total:frames.length,done:0,count:0,bytes:0,omitted:0,errors:0};updateSearchStatus();
  for(const item of frames){
   if(cancelled())return;
   const grid=item.entry.semantic;let result;
   try{
    if(!grid?.bits)throw Error('Биты кадра недоступны');
    const found=await search(grid,{cancelled,maxHits:0});if(cancelled())return;
    result={count:Number(found.count)||0,mask:null,reason:found.complete===false?(found.reason||'поиск не завершён'):''};
    if(found.mask&&result.count){
     const bytes=Math.ceil(grid.bits.length/8);
     if(run.bytes+bytes<=maskBudget){result.mask=new Uint8Array(bytes);for(let i=0;i<grid.bits.length;i++){if(found.mask[i]&&(grid.bits[i]===0||grid.bits[i]===1))result.mask[i>>3]|=1<<(i&7);if(i&&i%262144===0){await yieldSearch();if(cancelled())return;}}run.bytes+=bytes;}
     else{run.omitted++;result.reason='Подсветка не сохранена: лимит памяти';}
    }
   }catch(error){if(cancelled())return;if(error.code==='GIF_SEARCH_SETTINGS'){run.error=error.message||'Проверьте настройки Поиска Маятника';updateSearchStatus();return;}result={count:0,mask:null,reason:error.message||'Ошибка поиска'};run.errors++;}
   item.search=result;run.done++;run.count+=result.count;
   item.caption.textContent=item.captionText+' · '+result.count+' совпадений';item.button.setAttribute('aria-label',item.button.title+', '+result.count+' совпадений'+(result.reason?', '+result.reason:''));
   updateSearchStatus();if(items[selected]===item)drawOverlay();
   // Yield between cached frames even when each individual search is tiny.
   if(run.done<run.total)await yieldSearch();
  }
 }
 function release(){pause();clearSearch();finish();observer?.disconnect();stage?.removeAttribute('src');tracksArea?.querySelectorAll('img').forEach(img=>img.removeAttribute('src'));urls.forEach(url=>win.URL.revokeObjectURL(url));for(const group of groups){group.urls.forEach(url=>win.URL.revokeObjectURL(url));if(group.downloadUrl)win.URL.revokeObjectURL(group.downloadUrl);}groups=[];activeGroup=null;urls=[];if(downloadUrl)win.URL.revokeObjectURL(downloadUrl);downloadUrl=null;items=[];track?.replaceChildren();tracksArea?.replaceChildren(track);searchOptions={};searchBar&&(searchBar.hidden=true);settingsBar&&(settingsBar.hidden=true);overlay?.remove();overlay=null;}
 function activate(group,index=selected){
  pause();activeGroup=group;items=group.items;track=group.track;width=group.variant.plan.width;height=group.variant.plan.height;download.hidden=!!group.variant.previewOnly||!group.downloadUrl&&!searchOptions.onDownload;download.dataset.filename=group.variant.name||'Гиф-Масштаб.gif';
  title.textContent=group.label+' · '+items.length+' кадров';title.title=title.textContent;range.max=String(items.length-1);previousButton.disabled=nextButton.disabled=playButton.disabled=range.disabled=items.length<2;
  for(const g of groups){g.element.setAttribute('data-selected',String(g===group));g.heading.setAttribute('aria-pressed',String(g===group));g.track.style.setProperty('--may-gif-width',(edge*g.variant.plan.width/Math.max(g.variant.plan.width,g.variant.plan.height))+'px');g.track.style.setProperty('--may-gif-height',(edge*g.variant.plan.height/Math.max(g.variant.plan.width,g.variant.plan.height))+'px');}
  for(const [b,key]of [[libraryButton,'onSaveLibrary'],[frameButton,'onSaveFrame'],[applyButton,'onApplyFrame']])b.hidden=typeof searchOptions[key]!=='function'||b===libraryButton&&!!group.variant.previewOnly;
  select(index);resize(edge,false);syncLiveButtons();selectionStatus();
 }
 function syncLiveButtons(){
  if(recordButton){recordButton.hidden=typeof searchOptions.onRecord!=='function'||!!activeGroup?.variant.previewOnly&&!recording;recordButton.setAttribute('aria-pressed',String(recording));recordButton.disabled=busy||!!recordInfo.starting||!!recordInfo.finishing||(!recording&&!items.length);recordButton.querySelector('.may-gif-button-caption').textContent=recording?'■ Завершить':'● Кадры GIF';}
  if(stackButton){stackButton.hidden=typeof searchOptions.onStackToggle!=='function';stackButton.setAttribute('aria-pressed',String(stackEnabled));}
 }
 function setRecording(value,info={}){recording=!!value;recordInfo=info||{};syncLiveButtons();}
 function setStackEnabled(value){stackEnabled=!!value;syncLiveButtons();}
 function configure(options){
  searchOptions=options;if(typeof options.digits==='boolean'){digits=options.digits;digitButton.setAttribute('aria-pressed',String(digits));}for(const b of [selectAllButton,selectNoneButton,filterButton,xorButton])b.hidden=typeof options.onFrameSet!=='function';settingsBar.hidden=false;sequenceInput.value=options.sequence||'step8';generateButton.hidden=typeof options.onGenerate!=='function';cancelButton.hidden=!busy;montageButton.hidden=typeof options.onMontage!=='function';
  for(const [b,key]of [[libraryButton,'onSaveLibrary'],[frameButton,'onSaveFrame'],[applyButton,'onApplyFrame']])b.hidden=typeof options[key]!=='function'||!items.length;
  setDelay(Number.isFinite(Number(options.delay))?options.delay:delay);syncLiveButtons();
 }
 function openSettings(options={}){
  if(!mount())return false;configure(options);if(!items.length){title.textContent='Гиф-Масштаб';range.disabled=previousButton.disabled=nextButton.disabled=playButton.disabled=true;download.hidden=true;status.textContent='Выберите скорость и последовательность, затем нажмите Создать.';}
  reveal();setBusy(busy);drawOverlay();refreshSearch();return true;
 }
 function showVariants(variants,options={}){
  if(!Array.isArray(variants)||!variants.length||variants.some(v=>!v?.frames?.length||!Number.isFinite(v.plan?.width)||!Number.isFinite(v.plan?.height)||v.plan.width<=0||v.plan.height<=0||v.frames.some(f=>!f?.blob||!Number.isFinite(f.rows)||f.rows<0)))return false;
  if(!mount())return false;
  const next=[];try{for(const variant of variants){const group={variant,urls:[],downloadUrl:null};next.push(group);for(const frame of variant.frames)group.urls.push(win.URL.createObjectURL(frame.blob));if(variant.blob)group.downloadUrl=win.URL.createObjectURL(variant.blob);}}catch{for(const g of next){g.urls.forEach(u=>win.URL.revokeObjectURL(u));if(g.downloadUrl)win.URL.revokeObjectURL(g.downloadUrl);}return false;}
  release();setDelay(options.delay??variants[0].delay??100);groups=next;searchOptions=options;tracksArea.replaceChildren();tracksArea.classList.add('may-gif-strip-tracks-many');searchBar.hidden=false;configure(options);
  overlay=doc.createElement('canvas');overlay.className='may-gif-strip-overlay';overlay.setAttribute('aria-hidden','true');display.append(overlay);
  if(observer){observer.disconnect();observer=new win.IntersectionObserver(entries=>{for(const e of entries){if(e.isIntersecting&&tracksArea.contains(e.target))e.target.src=e.target.dataset.frameUrl;else e.target.removeAttribute('src');}},{root:tracksArea,rootMargin:'200px'});}
  const names={canvas:'Как на холсте',nearest:'Ближайший',majority:'Большинство',average:'Средний цвет',pixels:'На весь кадр',scale:'Уменьшать',phases:'Все фазы'};
  for(const group of groups){group.label=group.variant.label||((names[group.variant.method]||group.variant.method)+' · '+(names[group.variant.presentation]||group.variant.presentation));group.element=doc.createElement('div');group.element.className='may-gif-strip-variant';group.element.dataset.variant=String(group.variant.id);group.heading=doc.createElement('button');group.heading.type='button';group.heading.className='may-gif-strip-variant-label';group.heading.textContent=group.label;group.heading.title=group.label;group.heading.addEventListener('click',()=>activate(group));group.track=doc.createElement('div');group.track.className='may-gif-strip-track';group.track.setAttribute('aria-label',group.label);group.track.tabIndex=0;group.element.append(group.heading,group.track);tracksArea.append(group.element);group.items=group.variant.frames.map((f,i)=>frame(f,i,group));}
  setBusy(busy);reveal();activate(groups.find(g=>g.variant.id===options.selectedVariant)||groups[0],Number.isInteger(options.selectedIndex)?options.selectedIndex:0);refreshSearch();return true;
 }
 function show(frames,options={}){
  const w=Number(options.width),h=Number(options.height);
  if(!Array.isArray(frames)||!frames.length||!Number.isFinite(w)||!Number.isFinite(h)||w<=0||h<=0||frames.some(f=>!f?.blob||!Number.isFinite(f.rows)||f.rows<0))return false;
  if(!mount())return false;
  // Create the replacement before releasing the previous generation.
  const next=[];let nextDownload=null;try{for(const entry of frames)next.push(win.URL.createObjectURL(entry.blob));if(options.blob)nextDownload=win.URL.createObjectURL(options.blob);}catch{next.forEach(url=>win.URL.revokeObjectURL(url));if(nextDownload)win.URL.revokeObjectURL(nextDownload);return false;}
  release();for(const b of [libraryButton,frameButton,applyButton,selectAllButton,selectNoneButton,filterButton,xorButton])b.hidden=true;tracksArea.classList.remove('may-gif-strip-tracks-many');urls=next;downloadUrl=nextDownload;width=w;height=h;selected=0;delay=Number.isFinite(Number(options.delay))?Math.max(10,Number(options.delay)):100;
  items=frames.map((entry,index)=>frame(entry,index));title.textContent=(options.name?String(options.name)+' · ':'')+frames.length+' кадров';title.title=title.textContent;
  range.max=String(items.length-1);download.hidden=!downloadUrl;download.dataset.filename=options.name?String(options.name):'Гиф-Масштаб.gif';previousButton.disabled=nextButton.disabled=playButton.disabled=items.length<2;range.disabled=items.length<2;
  status.textContent='Большой кадр вписан целиком. Миниатюры и бегунок выбирают кадр; кнопка Пуск проигрывает ленту.';setBusy(busy);
  resize(edge,false);track.scrollLeft=0;track.scrollTop=0;reveal();select(Number.isInteger(options.selectedIndex)?options.selectedIndex:0);refreshSearch();return true;
 }
 function open(){if(!items.length)return false;reveal();drawOverlay();refreshSearch();return true;}
 win.addEventListener('pointermove',event=>{if(moving&&event.pointerId===moving.id){event.preventDefault();place({...moving.box,left:moving.box.left+event.clientX-moving.x,top:moving.box.top+event.clientY-moving.y});return;}if(!drag||event.pointerId!==drag.id)return;event.preventDefault();const s=Math.max(width,height),vx=width/s,vy=height/s;resize(drag.edge+((event.clientX-drag.x)*vx+(event.clientY-drag.y)*vy)/(vx*vx+vy*vy),false);},{passive:false,capture:true});
 for(const type of ['pointerup','pointercancel'])win.addEventListener(type,event=>{if(drag&&event.pointerId===drag.id)finish();if(moving&&event.pointerId===moving.id)finishMove();},true);
 function relayout(){if(!section)return;drawOverlay();finishMove();resize(edge,false);if(section&&!section.hidden)place(measuredBox());}
 function refreshSearch(){
  clearSearch();
  if(!items.length||section.hidden||!searchOptions.searchEnabled?.()||typeof searchOptions.search!=='function'){updateSearchStatus();return searchTask;}
  searchStatus.textContent='Поиск Маятника: подготовка всех кадров…';searchStatus.setAttribute('aria-busy','true');
  const token=searchToken,frames=allItems().slice(),search=searchOptions.search;
  // Wait for the cancelled predecessor so repeated changes never multiply searches.
  searchTask=searchTask.then(()=>runSearch(token,frames,search));return searchTask;
 }
 win.addEventListener('may-gif-search-change',refreshSearch);
 win.addEventListener('blur',()=>{finish();finishMove();});win.addEventListener('resize',relayout);win.visualViewport?.addEventListener('resize',relayout);win.visualViewport?.addEventListener('scroll',relayout);
 win.addEventListener('pagehide',()=>{hide();release();panelObserver?.disconnect();});
 return {show,showVariants,openSettings,open,hide,setBusy,setRecording,setStackEnabled,refreshSearch,setProgress:text=>{if(status)status.textContent=String(text||'');}};
});
