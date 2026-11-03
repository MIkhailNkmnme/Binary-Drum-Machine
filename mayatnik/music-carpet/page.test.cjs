'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM}=require('C:/Users/Mhl/AppData/Local/Temp/codex-setka-dom/node_modules/jsdom');
const {mount}=require('./page');
const html=fs.readFileSync(__dirname+'/index.html','utf8'),css=fs.readFileSync(__dirname+'/page.css','utf8');
const bank=['robot','pulse','glass','space'].map((id,index)=>({id,name:'Пример '+index,description:'Описание '+index,duration:2.6,audio:'audio-examples/'+id+'.mp3',wav:'audio-examples/'+id+'.wav',preset:'audio-examples/'+id+'.json',work:'audio-examples/'+id+'.mayatnik',thumbnail:'audio-examples/source-field.svg'}));
function score(id){return {id,source:{width:5,height:6,bits:Int8Array.from([1,1,1,0,1,...new Array(25).fill(0)])},duration:2.6,timeline:[
 {index:0,start:0,end:.4,notes:[{midi:60}],onesRuns:[[0,3],[4,1]]},
 {index:2,start:.4,end:1.5,notes:[{midi:64}],onesRuns:[]},
 {index:4,start:1.5,end:2,notes:[{midi:67}],onesRuns:[[1,2]]}
]};}
function fixture(options={}){
 const dom=new JSDOM(html,{url:'https://example.test/mayatnik/music-carpet/',runScripts:'outside-only'}),win=dom.window,doc=win.document;
 const style=doc.createElement('style');style.textContent=css;doc.head.append(style);
 let serial=0;const queued=new Map(),draws=[],layouts=[],states=[];
 const paint=[];
 const canvas=doc.getElementById('carpet'),stage=doc.getElementById('carpet-stage'),ctx={canvas,fillRect(...box){paint.push({kind:'fill',colour:this.fillStyle,box});},strokeRect(...box){paint.push({kind:'stroke',colour:this.strokeStyle,box});}};
 win.HTMLCanvasElement.prototype.getContext=()=>ctx;
 stage.getBoundingClientRect=()=>({left:0,top:0,width:600,height:600});
 canvas.getBoundingClientRect=()=>({left:0,top:0,width:parseFloat(canvas.style.width)||600,height:parseFloat(canvas.style.height)||600});
 canvas.setPointerCapture=()=>{};canvas.releasePointerCapture=()=>{};
 const media=new Map();
 for(const element of doc.querySelectorAll('audio,video')){
  const state={time:0,paused:true,ended:false,plays:0,pauses:0,duration:2.6};media.set(element,state);
  Object.defineProperties(element,{currentTime:{get:()=>state.time,set:value=>{state.time=value;element.dispatchEvent(new win.Event('seeking'));element.dispatchEvent(new win.Event('timeupdate'));}},paused:{get:()=>state.paused},ended:{get:()=>state.ended},duration:{get:()=>state.duration}});
  element.play=()=>{state.plays++;state.paused=false;state.ended=false;element.dispatchEvent(new win.Event('play'));return Promise.resolve();};
  element.pause=()=>{state.pauses++;const changed=!state.paused;state.paused=true;if(changed)element.dispatchEvent(new win.Event('pause'));};
  element.load=()=>{state.time=0;};
 }
 const visual={async prepare(entry){return options.prepare?options.prepare(entry):score(entry.id);},stateAt(prepared,time){states.push(time);return prepared.timeline.find(step=>time>=step.start&&time<step.end)||null;},layout(source,box){const scale=Math.max(1,Math.floor(Math.min(box.width/source.width,box.height/source.height))),result={left:Math.floor((box.width-source.width*scale)/2),top:Math.floor((box.height-source.height*scale)/2),scale,width:source.width*scale,height:source.height*scale};layouts.push(result);return result;},draw(context,prepared,time,box){draws.push({prepared,time,box,index:this.stateAt(prepared,time)?.index??null});return this.layout(prepared.source,box);}};
 const api=mount({document:doc,bank:options.bank||bank,visual:options.visual||visual,initialId:options.initialId,requestFrame:callback=>{queued.set(++serial,callback);return serial;},cancelFrame:id=>queued.delete(id)});
 const audio=doc.getElementById('carpet-audio'),video=doc.getElementById('carpet-video');
 const pointer=(type,x,y,id=7)=>{const event=new win.MouseEvent(type,{bubbles:true,cancelable:true,button:0,clientX:x,clientY:y});Object.defineProperty(event,'pointerId',{value:id});canvas.dispatchEvent(event);return event;};
 return {dom,win,doc,api,canvas,stage,audio,video,media,draws,layouts,states,queued,pointer,paint,ctx,
  frame(timestamp=99999){const first=queued.entries().next().value;if(first){queued.delete(first[0]);first[1](timestamp);}},
  close(){api.destroy();dom.window.close();}};
}
test('four examples expose WAV, MP3, JSON, original frames and MP4 without autoplay',async()=>{
 const f=fixture();try{await f.api.ready;assert.equal(f.doc.querySelector('h1').textContent,'Музыкальный ковёр');assert.equal(f.doc.querySelectorAll('[data-select-track]').length,4);assert.equal(f.doc.querySelectorAll('.downloads a').length,20);
  assert.match(f.audio.src,/\/mayatnik\/audio-examples\/robot\.wav$/);assert.match(f.video.src,/robot\.mp4$/);assert.equal(f.media.get(f.audio).plays,0);assert.equal(f.media.get(f.video).plays,0);assert.equal(f.queued.size,0);
  assert.equal(f.doc.getElementById('carpet-play').disabled,false);assert.equal(f.draws.at(-1).index,0);assert.equal(f.canvas.style.width,'600px');assert.equal(f.canvas.style.height,'600px');
 }finally{f.close();}
});
test('a selected track can be opened directly, with an unknown ID falling back to the first example',async()=>{
 for(const [initialId,expected]of [['glass','glass'],['missing','robot']]){
  const f=fixture({initialId});try{await f.api.ready;assert.equal(f.api.getState().selectedId,expected);assert.match(f.audio.src,new RegExp(expected+'\\.wav$'));assert.equal(f.media.get(f.audio).plays,0);}finally{f.close();}
 }
});
test('highlight reads actual media time with unequal steps, seek, pause and effect tails',async()=>{
 const f=fixture();try{await f.api.ready;f.audio.currentTime=.9;assert.equal(f.draws.at(-1).index,2);assert.match(f.doc.getElementById('carpet-notes').textContent,/Ми4/);
  await f.audio.play();f.frame(9999999);assert.equal(f.audio.currentTime,.9);assert.equal(f.draws.at(-1).index,2);
  f.audio.currentTime=1.7;f.frame();assert.equal(f.draws.at(-1).index,4);f.audio.pause();assert.equal(f.queued.size,0);assert.equal(f.audio.currentTime,1.7);
  f.audio.currentTime=2.2;assert.equal(f.draws.at(-1).index,null);assert.match(f.doc.getElementById('carpet-notes').textContent,/Затухание/);
  const state=f.media.get(f.audio);state.ended=true;state.time=2.6;f.audio.dispatchEvent(new f.win.Event('ended'));assert.equal(f.queued.size,0);assert.equal(f.draws.at(-1).index,null);assert.equal(f.doc.getElementById('carpet-status').textContent,'Запись завершена');
 }finally{f.close();}
});
test('pointer seeking respects integer layout, empty margins and selected row stride without starting audio',async()=>{
 const f=fixture();try{await f.api.ready;assert.equal(f.api.getState().prepared.timeline[1].index,2);const before=f.audio.currentTime;
  f.pointer('pointerdown',20,250);assert.equal(f.audio.currentTime,before);
  f.pointer('pointerdown',200,250);assert.equal(f.audio.currentTime,.4);f.pointer('pointermove',200,450);assert.equal(f.audio.currentTime,1.5);f.pointer('pointerup',200,450);
  f.pointer('pointermove',200,50);assert.equal(f.audio.currentTime,1.5);assert.equal(f.media.get(f.audio).plays,0);assert.equal(f.draws.at(-1).index,4);
 }finally{f.close();}
});
test('keyboard and reset move the reading position while retaining pause',async()=>{
 const f=fixture();try{await f.api.ready;const press=key=>f.canvas.dispatchEvent(new f.win.KeyboardEvent('keydown',{key,cancelable:true,bubbles:true}));
  press('ArrowDown');assert.equal(f.audio.currentTime,.4);press('ArrowDown');assert.equal(f.audio.currentTime,1.5);press('ArrowUp');assert.equal(f.audio.currentTime,.4);press('End');assert.equal(f.audio.currentTime,1.5);press('Home');assert.equal(f.audio.currentTime,0);
  f.audio.currentTime=1.7;f.doc.getElementById('carpet-reset').click();assert.equal(f.audio.currentTime,0);assert.equal(f.media.get(f.audio).plays,0);
  f.audio.currentTime=2.2;press('ArrowUp');assert.equal(f.audio.currentTime,1.5);
 }finally{f.close();}
});
test('video and audio cannot play together and the main picture follows the active recording',async()=>{
 const f=fixture();try{await f.api.ready;await f.audio.play();f.audio.currentTime=.8;await f.video.play();f.video.currentTime=1.7;f.frame();
  assert.equal(f.audio.paused,true);assert.equal(f.api.getState().active,'video');assert.equal(f.draws.at(-1).index,4);
  await f.audio.play();f.frame();assert.equal(f.video.paused,true);assert.equal(f.api.getState().active,'audio');assert.equal(f.draws.at(-1).index,2);
  await f.api.select('glass');assert.equal(f.audio.paused,true);assert.equal(f.video.paused,true);assert.equal(f.media.get(f.audio).plays,2);assert.match(f.audio.src,/glass\.wav$/);assert.equal(f.queued.size,0);
 }finally{f.close();}
});
test('late preparation cannot overwrite the selected track or restart after disposal',async()=>{
 let releasePulse,releaseGlass;const f=fixture({prepare:entry=>entry.id==='pulse'?new Promise(resolve=>{releasePulse=resolve;}):entry.id==='glass'?new Promise(resolve=>{releaseGlass=resolve;}):score(entry.id)});
 try{await f.api.ready;const pulse=f.api.select('pulse'),glass=f.api.select('glass');releaseGlass(score('glass'));await glass;releasePulse(score('pulse'));assert.equal(await pulse,false);assert.match(f.audio.src,/glass\.wav$/);
  const pending=f.api.select('pulse');f.api.destroy();releasePulse(score('pulse'));assert.equal(await pending,false);assert.equal(f.media.get(f.audio).plays,0);
 }finally{f.close();}
});
test('page hiding cancels animation and both media, without automatic resume',async()=>{
 const f=fixture();try{await f.api.ready;await f.audio.play();assert.equal(f.queued.size,1);Object.defineProperty(f.doc,'hidden',{value:true,configurable:true});f.doc.dispatchEvent(new f.win.Event('visibilitychange'));assert.equal(f.audio.paused,true);assert.equal(f.queued.size,0);
  Object.defineProperty(f.doc,'hidden',{value:false,configurable:true});f.doc.dispatchEvent(new f.win.Event('visibilitychange'));assert.equal(f.media.get(f.audio).plays,1);
  await f.video.play();f.win.dispatchEvent(new f.win.Event('pagehide'));assert.equal(f.video.paused,true);assert.equal(f.queued.size,0);
 }finally{f.close();}
});
test('small viewports keep at least the native bit resolution and no canvas interpolation',async()=>{
 const f=fixture();try{await f.api.ready;f.stage.getBoundingClientRect=()=>({width:3,height:2});f.api.resize();assert.equal(f.canvas.width,5);assert.equal(f.canvas.height,6);assert.equal(f.canvas.style.width,'5px');assert.equal(f.canvas.style.height,'6px');assert.match(css,/#carpet\{[^}]*image-rendering:pixelated/);assert.match(css,/\.carpet-stage\{[^}]*overflow:auto/);
 }finally{f.close();}
});
test('real built-in scores highlight exactly their real one-bit runs at the media position',async()=>{
 const realBank=require('../mayatnik-xorrom-bank'),visual=require('../mayatnik-xorrom-visual');
 const f=fixture({bank:realBank,visual});try{
  await f.api.ready;
  for(const entry of realBank){
   await f.api.select(entry.id);const prepared=f.api.getState().prepared,step=prepared.timeline[Math.floor(prepared.timeline.length/2)],box=visual.layout(prepared.source,{width:f.canvas.width,height:f.canvas.height});
   f.paint.length=0;f.audio.currentTime=(step.start+step.end)/2;
   assert.equal(f.canvas.getAttribute('aria-valuenow'),String(step.index));assert.equal(f.ctx.imageSmoothingEnabled,false);
   const lit=f.paint.filter(item=>item.kind==='fill'&&item.colour===visual.palette.active);
   assert.deepEqual(lit.map(item=>item.box),step.onesRuns.map(([x,length])=>[box.left+x*box.scale,box.top+step.index*box.scale,length*box.scale,box.scale]),entry.name);
   for(const [x,length] of step.onesRuns)for(let i=0;i<length;i++)assert.equal(prepared.source.bits[step.index*prepared.source.width+x+i],1);
   assert.equal(f.media.get(f.audio).plays,0);
  }
 }finally{f.close();}
});
