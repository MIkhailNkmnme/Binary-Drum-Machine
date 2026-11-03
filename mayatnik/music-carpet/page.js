/* Музыкальный ковёр v0.002. The recorded media clock drives the bit reader. */
(function(root,factory){const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;else root.MusicCarpet=value;})(globalThis,function(){
 'use strict';
 const fmt=time=>{time=Math.max(0,Number.isFinite(time)?time:0);return Math.floor(time/60)+':'+String(Math.floor(time%60)).padStart(2,'0');};
 function mount({document:doc,bank,visual,requestFrame,cancelFrame,initialId}={}){
  if(!doc||!Array.isArray(bank)||!bank.length||!visual?.prepare||!visual?.draw||!visual?.layout||!visual?.stateAt)throw Error('Не удалось загрузить музыкальные примеры.');
  const win=doc.defaultView,el=id=>doc.getElementById(id),canvas=el('carpet'),stage=el('carpet-stage'),audio=el('carpet-audio'),video=el('carpet-video'),ctx=canvas.getContext('2d',{alpha:false});
  const request=requestFrame||win.requestAnimationFrame.bind(win),cancel=cancelFrame||win.cancelAnimationFrame.bind(win);
  let selected=null,prepared=null,active=audio,generation=0,raf=null,disposed=false,drag=null,drawKey='',resizeObserver;
  const entries=new Map(bank.map(entry=>[entry.id,entry])),listeners=[],buttons=new Map();
  const asset=name=>new win.URL('../'+name,doc.baseURI).href;
  function listen(target,type,handler,options){target.addEventListener(type,handler,options);listeners.push(()=>target.removeEventListener(type,handler,options));}
  function stopRAF(){if(raf!==null){cancel(raf);raf=null;}}
  function pause(media){try{media.pause();}catch(_){}}
  function status(text){el('carpet-status').textContent=text;}
  function stepAt(time){return prepared?visual.stateAt(prepared,time):null;}
  function noteName(note){if(note.drum)return {kick:'Бочка',snare:'Малый',hat:'Хэт'}[note.drum]||note.drum;if(!Number.isFinite(note.midi))return '';return ['До','До♯','Ре','Ре♯','Ми','Фа','Фа♯','Соль','Соль♯','Ля','Ля♯','Си'][((note.midi%12)+12)%12]+(Math.floor(note.midi/12)-1);}
  function render(force=false){
   if(disposed||!prepared)return;
   const time=Number.isFinite(active.currentTime)?active.currentTime:0,step=stepAt(time),key=generation+':'+canvas.width+':'+canvas.height+':'+(step?.index??'tail');
   if(force||key!==drawKey){if(ctx)visual.draw(ctx,prepared,time,{width:canvas.width,height:canvas.height});drawKey=key;}
   el('carpet-row').textContent=step?'Строка '+step.index+' / '+(prepared.source.height-1):'Строка —';
   const notes=(step?.notes||[]).map(noteName).filter(Boolean);el('carpet-notes').textContent=step?'Ноты строки: '+(notes.length?notes.join(' · '):'пауза'):'Затухание / конец записи';
   el('track-clock').textContent=fmt(time)+' / '+fmt(Number.isFinite(active.duration)&&active.duration>0?active.duration:prepared.duration||selected.duration);
   if(step){canvas.setAttribute('aria-valuenow',String(step.index));canvas.setAttribute('aria-valuetext','Строка '+step.index);}
   else canvas.setAttribute('aria-valuetext','Активной строки нет');
   const playing=!active.paused&&!active.ended;el('carpet-play').setAttribute('aria-pressed',String(playing));el('carpet-play').querySelector('span').textContent=playing?'Ⅱ Пауза':'▶ Старт';
  }
  function frame(){raf=null;if(disposed)return;render();if(!active.paused&&!active.ended)raf=request(frame);}
  function schedule(){if(raf===null&&!disposed&&!active.paused&&!active.ended)raf=request(frame);}
  function resize(){
   if(disposed||!prepared)return;
   const ratio=Math.max(1,Number(win.devicePixelRatio)||1),rect=stage.getBoundingClientRect(),width=Math.max(prepared.source.width,Math.floor((stage.clientWidth||rect.width||prepared.source.width)*ratio)),height=Math.max(prepared.source.height,Math.floor((stage.clientHeight||rect.height||prepared.source.height)*ratio));
   if(canvas.width!==width)canvas.width=width;if(canvas.height!==height)canvas.height=height;
   canvas.style.width=width/ratio+'px';canvas.style.height=height/ratio+'px';render(true);
  }
  async function toggle(){
   if(disposed||!prepared)return;
   if(!active.paused&&!active.ended){pause(active);return;}
   try{if(active.ended)active.currentTime=0;await active.play();}catch(error){status(error?.message||'Нажмите кнопку пуска на проигрывателе.');}
  }
  function reset(){pause(audio);pause(video);stopRAF();if(prepared){active.currentTime=prepared.timeline[0]?.start||0;render(true);status('Начало записи');}}
  function nearest(row){let best=null,distance=Infinity;for(const step of prepared?.timeline||[]){const delta=Math.abs(step.index-row);if(delta<distance){best=step;distance=delta;}}return best;}
  function seekRow(row){const step=nearest(row);if(!step)return;/* HTMLMediaElement truncates seek positions to microseconds. Round up into this score step. */active.currentTime=Math.min(step.start===0?0:(Math.floor(step.start*1e6)+2)/1e6,(step.start+step.end)/2);render(true);status('Строка '+step.index);}
  function pointerRow(event,clamp){
   if(!prepared)return null;const rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height)return null;
   const x=(event.clientX-rect.left)*canvas.width/rect.width,y=(event.clientY-rect.top)*canvas.height/rect.height,box=visual.layout(prepared.source,{width:canvas.width,height:canvas.height});
   if(!clamp&&(x<box.left||x>=box.left+box.width||y<box.top||y>=box.top+box.height))return null;
   return Math.max(0,Math.min(prepared.source.height-1,Math.floor((y-box.top)/box.scale)));
  }
  async function select(id){
   const entry=entries.get(id);if(!entry||disposed)return false;
   const run=++generation;selected=entry;prepared=null;drawKey='';drag=null;pause(audio);pause(video);stopRAF();active=audio;
   for(const media of [audio,video]){media.removeAttribute('src');try{media.load();}catch(_){}}
   el('carpet-play').disabled=true;el('carpet-reset').disabled=true;el('track-title').textContent=entry.name;el('track-description').textContent=entry.description||'';status('Подготовка битового поля…');
   for(const [key,button]of buttons){const chosen=key===id;button.setAttribute('aria-pressed',String(chosen));button.closest('article').setAttribute('aria-current',String(chosen));}
   video.poster=asset(entry.thumbnail||'audio-examples/source-field.svg');el('video-download').href=asset('audio-examples/'+entry.id+'.mp4');el('video-download').download=entry.id+'.mp4';
   try{
    const ready=await visual.prepare(entry);if(disposed||generation!==run)return false;
    prepared=ready;audio.src=asset(entry.wav);video.src=asset('audio-examples/'+entry.id+'.mp4');
    try{audio.load();video.load();}catch(_){}
    canvas.setAttribute('aria-valuemax',String(prepared.source.height-1));el('carpet-play').disabled=false;el('carpet-reset').disabled=false;resize();status('Готово · нажмите Старт');return true;
   }catch(error){if(!disposed&&generation===run)status(error?.message||'Не удалось прочитать поле примера.');return false;}
  }
  function createPlaylist(){
   const fragment=doc.createDocumentFragment();
   for(const entry of bank){
    const card=doc.createElement('article');card.className='track-card';card.dataset.track=entry.id;const heading=doc.createElement('div');heading.className='card-title';const title=doc.createElement('h3');title.textContent=entry.name;const duration=doc.createElement('time');duration.textContent=fmt(entry.duration);heading.append(title,duration);
    const description=doc.createElement('p');description.textContent=entry.description||'';const choose=doc.createElement('button');choose.className='gz-hx';choose.type='button';choose.title='Выбрать пример: '+entry.name;choose.setAttribute('aria-label',choose.title);choose.innerHTML='<span class="gz-nm">◇ Выбрать</span>';choose.dataset.selectTrack=entry.id;listen(choose,'click',()=>select(entry.id));buttons.set(entry.id,choose);
    const downloads=doc.createElement('div');downloads.className='downloads';
    for(const [name,label,titleText]of [[entry.audio,'↓ MP3','Скачать аудио MP3'],[entry.wav,'↓ WAV','Скачать аудио WAV'],[entry.preset,'↓ JSON','Скачать музыкальные настройки JSON'],[entry.work,'↓ Кадр','Скачать исходный кадр с настройками'],['audio-examples/'+entry.id+'.mp4','↓ Видео','Скачать видео с подсветкой битов']]){
     if(!name)continue;const link=doc.createElement('a');link.className='gz-hx';link.href=asset(name);link.download=name.split('/').pop();link.title=titleText+': '+entry.name;link.setAttribute('aria-label',link.title);const caption=doc.createElement('span');caption.className='gz-nm';caption.textContent=label;link.append(caption);downloads.append(link);
    }
    card.append(heading,description,choose,downloads);fragment.append(card);
   }
   el('carpet-playlist').replaceChildren(fragment);
  }
  for(const media of [audio,video]){
   listen(media,'play',()=>{active=media;pause(media===audio?video:audio);stopRAF();render(true);schedule();status(media===audio?'Играет аудио':'Играет видео');});
   for(const type of ['timeupdate','seeking','seeked','loadedmetadata'])listen(media,type,()=>{if(media===active){render(type==='seeking');schedule();}});
   listen(media,'pause',()=>{if(media===active){stopRAF();render();if(prepared)status('Пауза');}});
   listen(media,'ended',()=>{if(media===active){stopRAF();render(true);status('Запись завершена');}});
   listen(media,'error',()=>{if(media===active&&media.hasAttribute('src')){stopRAF();status('Не удалось загрузить запись. Попробуйте скачать файл.');}});
  }
  listen(el('carpet-play'),'click',toggle);listen(el('carpet-reset'),'click',reset);
  listen(canvas,'pointerdown',event=>{if(event.button!==0)return;const row=pointerRow(event,false);if(row===null)return;event.preventDefault();drag=event.pointerId;try{canvas.setPointerCapture(drag);}catch(_){}seekRow(row);});
  listen(canvas,'pointermove',event=>{if(drag!==event.pointerId)return;event.preventDefault();const row=pointerRow(event,true);if(row!==null)seekRow(row);});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])listen(canvas,type,event=>{if(drag!==event.pointerId)return;try{canvas.releasePointerCapture(drag);}catch(_){}drag=null;});
  listen(canvas,'keydown',event=>{if(!prepared)return;const now=stepAt(active.currentTime),timeline=prepared.timeline,found=timeline.findIndex(step=>step.index===now?.index),index=found>=0?found:active.currentTime>=(timeline.at(-1)?.end||0)?timeline.length:0;let step;
   if(event.key==='ArrowUp')step=timeline[Math.max(0,index-1)];else if(event.key==='ArrowDown')step=timeline[Math.min(timeline.length-1,index+1)];else if(event.key==='Home')step=timeline[0];else if(event.key==='End')step=timeline.at(-1);else if(event.key===' '||event.key==='Enter'){event.preventDefault();toggle();return;}else return;
   event.preventDefault();if(step)seekRow(step.index);
  });
  listen(win,'resize',resize);if(win.ResizeObserver){resizeObserver=new win.ResizeObserver(resize);resizeObserver.observe(stage);}
  listen(doc,'visibilitychange',()=>{if(doc.hidden){pause(audio);pause(video);stopRAF();}});
  listen(win,'pagehide',()=>{pause(audio);pause(video);stopRAF();});
  createPlaylist();const requested=initialId||new win.URL(doc.URL).searchParams.get('track'),ready=select(entries.has(requested)?requested:bank[0].id);
  return {ready,select,render,resize,seekRow,toggle,getState:()=>({selectedId:selected?.id,prepared,active:active===audio?'audio':'video'}),destroy(){if(disposed)return;disposed=true;generation++;pause(audio);pause(video);stopRAF();resizeObserver?.disconnect();listeners.splice(0).forEach(fn=>fn());}};
 }
 return {mount,fmt};
});
if(typeof document==='object'&&document.querySelector('[data-carpet]')){
 const start=()=>{try{window.musicCarpet=MusicCarpet.mount({document,bank:window.MayatnikXorromBank,visual:window.MayatnikXorromVisual});}catch(error){document.getElementById('carpet-status').textContent=error.message;}};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
}
