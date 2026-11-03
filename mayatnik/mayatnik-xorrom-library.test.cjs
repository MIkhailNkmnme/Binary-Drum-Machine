'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM}=require('C:/Users/Mhl/AppData/Local/Temp/codex-setka-dom/node_modules/jsdom');
const Core=require('./mayatnik-xorrom.js'),Library=require('./mayatnik-xorrom-library.js');
const ids=['electro-robot','xor-pulse','glass-arpeggio','triangle-space'];
const bank=()=>ids.map((id,i)=>({id,name:['Электро-робот','XOR-пульс','Стеклянные ступени','Пространство треугольника'][i],description:'Учебный XOR пример '+i,settings:{...Core.DEFAULTS,timbre:i?'pluck':'robot'},audio:'audio-examples/'+id+'.mp3',wav:'audio-examples/'+id+'.wav',preset:'audio-examples/'+id+'.json',source:{rows:128,frame:31}}));
function transport(){let settings={...Core.DEFAULTS},listener;const calls=[];return {calls,getSettings:()=>({...settings}),getState:()=>({state:'stopped'}),pause(){calls.push('pause');},setSettings(value){calls.push('settings');settings={...value};listener?.();},start(){calls.push('start');},subscribe(fn){listener=fn;return()=>{listener=null;};}};}
async function framed(){
  const Work=require('./mayatnik-work-file.js'),entries=bank();
  for(const entry of entries){const blob=await Work.encode({k:31,st:{rows:128,xorrom:entry.settings},baseBits:new Int8Array(285*128)});entry.frame={format:'mayatnik-work',version:2,base64:Buffer.from(await blob.arrayBuffer()).toString('base64'),rows:128,k:31,width:285,height:128};entry.work='audio-examples/'+entry.id+'.mayatnik';entry.thumbnail='audio-examples/source-field.svg';}
  return entries;
}
test('built-ins are immutable copies and applying validates full settings, pauses and never starts audio',async()=>{
  const api=transport(),data=bank(),library=Library.create({api,bank:data,engine:Core});
  const listed=library.list();assert.equal(listed.length,4);assert.ok(listed.every(entry=>entry.builtin));listed[0].settings.gain=1;data[0].settings.gain=.99;
  assert.equal(library.list()[0].settings.gain,Core.DEFAULTS.gain);await library.open(ids[0]);assert.deepEqual(api.calls,['pause','settings']);assert.equal(api.getSettings().timbre,'robot');assert.equal(library.getState().selectedId,ids[0]);
  api.setSettings({...api.getSettings(),bpm:120});assert.equal(library.getState().selectedId,null);assert.equal(library.list().length,4);assert.equal(library.remove,undefined);assert.equal(library.save,undefined);library.dispose();
});
test('invalid banks and presets fail before applying; a disposed pending apply cannot change settings',async()=>{
  const api=transport(),invalid=bank();invalid[0].settings.attack='bad';assert.throws(()=>Library.create({api,bank:invalid,engine:Core}),/attack/);assert.deepEqual(api.calls,[]);
  const duplicate=bank();duplicate[1].id=duplicate[0].id;assert.throws(()=>Library.create({api,bank:duplicate,engine:Core}),/Повтор/);
  let release;api.pause=()=>new Promise(resolve=>{release=resolve;});const library=Library.create({api,bank:bank(),engine:Core});
  const pending=library.open(ids[0]);await Promise.resolve();library.dispose();release();await pending;assert.deepEqual(api.calls,[]);
});
test('JSON downloads retain every validated setting and media downloads use bundled files',async()=>{
  const api=transport(),dom=new JSDOM('<body></body>',{url:'https://example.test/mayatnik/'}),saved=[],anchors=[];
  dom.window.HTMLAnchorElement.prototype.click=function(){anchors.push({href:this.getAttribute('href'),name:this.download});};
  const library=Library.create({api,bank:bank(),engine:Core,document:dom.window.document,download:(blob,name)=>saved.push({blob,name})});
  await library.download(ids[0]);assert.equal(saved[0].name,'electro-robot.json');const value=JSON.parse(await saved[0].blob.text());assert.deepEqual(value,Core.validateSettings(bank()[0].settings));assert.equal(Object.keys(value).length,42);
  await library.download(ids[0],'wav');await library.download(ids[0],'mp3');assert.deepEqual(anchors,[{href:'audio-examples/electro-robot.wav',name:'electro-robot.wav'},{href:'audio-examples/electro-robot.mp3',name:'electro-robot.mp3'}]);assert.deepEqual(api.calls,[]);library.dispose();dom.window.close();
});
test('applying a saved frame pauses, restores bits then settings, with no implicit start',async()=>{
  const entries=await framed(),api=transport(),seen=[];
  const library=Library.create({api,bank:entries,engine:Core,restoreFrame:async entry=>{api.calls.push('restore');seen.push(entry);}});
  await library.open(ids[0]);assert.deepEqual(api.calls,['pause','restore','settings']);assert.equal(seen[0].frame.k,31);assert.equal(seen[0].frame.rows,128);assert.equal(library.getState().selectedId,ids[0]);
  seen[0].settings.gain=1;assert.equal(library.list()[0].settings.gain,Core.DEFAULTS.gain);assert.match(library.getState().message,/исходный кадр/);library.dispose();
});
test('bad frame metadata, base64 and missing restorer reject before pause; restoration failure preserves settings',async()=>{
  const entries=await framed(),invalids=[{...entries[0].frame,base64:'!bad!'}, {...entries[0].frame,base64:Buffer.from('not a frame').toString('base64')},{...entries[0].frame,k:-1},{...entries[0].frame,height:127},{...entries[0].frame,format:'wrong'}];
  for(const frame of invalids){const api=transport(),data=bank();data[0]={...entries[0],frame};const library=Library.create({api,bank:data,engine:Core,restoreFrame:()=>assert.fail('invalid frame restored')});await assert.rejects(library.open(ids[0]),/кадр|формат/);assert.deepEqual(api.calls,[]);library.dispose();}
  const api=transport(),missing=Library.create({api,bank:entries,engine:Core});await assert.rejects(missing.open(ids[0]),/недоступно/);assert.deepEqual(api.calls,[]);missing.dispose();
  const before=api.getSettings(),failing=Library.create({api,bank:entries,engine:Core,restoreFrame:()=>{api.calls.push('restore');throw Error('Кадр не восстановлен');}});await assert.rejects(failing.open(ids[0]),/не восстановлен/);assert.deepEqual(api.calls,['pause','restore']);assert.deepEqual(api.getSettings(),before);assert.equal(failing.getState().selectedId,null);failing.dispose();
});
test('saved frame downloads keep the complete .mayatnik work file',async()=>{
  const entries=await framed(),api=transport(),dom=new JSDOM('<body></body>',{url:'https://example.test/mayatnik/'}),anchors=[];
  dom.window.HTMLAnchorElement.prototype.click=function(){anchors.push({href:this.getAttribute('href'),name:this.download});};
  const library=Library.create({api,bank:entries,engine:Core,document:dom.window.document});await library.download(ids[0],'work');assert.deepEqual(anchors,[{href:'audio-examples/electro-robot.mayatnik',name:'electro-robot.mayatnik'}]);assert.deepEqual(api.calls,[]);library.dispose();dom.window.close();
});
function panel({detached=false,prepare,entries=bank(),restoreFrame}={}){
  const dom=new JSDOM('<body><button id="bTemplatePanel"></button><button id="bTemplateSave" disabled></button></body>',{url:'https://example.test/mayatnik/',runScripts:'outside-only'}),w=dom.window;
  w.structuredClone=structuredClone;w.requestAnimationFrame=()=>1;w.HTMLCanvasElement.prototype.getContext=()=>null;w.MayatnikLibraryDetached=detached;
  let plays=0,pauses=0;w.HTMLMediaElement.prototype.play=function(){plays++;return Promise.resolve();};w.HTMLMediaElement.prototype.pause=function(){pauses++;};w.HTMLMediaElement.prototype.load=function(){};
  const api=transport(),library=Library.create({api,bank:entries,engine:Core,document:w.document,restoreFrame});
  if(detached)w.opener={mayXorromLibrary:library};else{w.mayXorromLibrary=library;w.MayatnikXorromBank=entries;}
  prepare?.({w,api,library});w.eval(fs.readFileSync(require.resolve('./mayatnik-template-folders.js'),'utf8'));w.eval(fs.readFileSync(require.resolve('./mayatnik-template-panel.js'),'utf8'));w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  const control=w.MayatnikTemplatePanel,el=w.document.querySelector('#mayatnikTemplatePanel');return {dom,w,api,library,control,el,get plays(){return plays;},get pauses(){return pauses;},close(){w.dispatchEvent(new w.Event('pagehide'));library.dispose();dom.window.close();}};
}
const flush=async()=>{for(let i=0;i<8;i++)await new Promise(setImmediate);};
test('published bank contains four complete presets and bundled audio assets, with no generated copies on reload',()=>{
  const real=require('./mayatnik-xorrom-bank.js'),api=transport(),library=Library.create({api,bank:real,engine:Core});
  assert.deepEqual(real.map(entry=>entry.id),ids);assert.equal(library.list().length,4);assert.deepEqual(api.calls,[]);
  for(const entry of real){
    assert.equal(Object.keys(Core.validateSettings(entry.settings)).length,42);
    const preset=JSON.parse(fs.readFileSync(__dirname+'/'+entry.preset,'utf8'));assert.deepEqual(preset,entry.settings);
    for(const key of ['audio','wav'])assert.ok(fs.statSync(__dirname+'/'+entry[key]).size>1000,entry[key]);
    assert.equal(entry.thumbnail,'audio-examples/source-field.svg');assert.ok(fs.statSync(__dirname+'/'+entry.thumbnail).size>100);
    const bytes=fs.readFileSync(__dirname+'/'+entry.wav);assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WAVE');
  }
  library.dispose();const reopened=Library.create({api,bank:real,engine:Core});assert.equal(reopened.list().length,4);reopened.dispose();
});
test('real built-in work files restore exact source bits and settings together through the frame callback',async()=>{
  const real=require('./mayatnik-xorrom-bank.js'),Work=require('./mayatnik-work-file.js'),api=transport(),decoded=[];
  const library=Library.create({api,bank:real,engine:Core,restoreFrame:async entry=>{
    api.calls.push('restore');const bytes=Buffer.from(entry.frame.base64,'base64');assert.deepEqual(bytes,fs.readFileSync(__dirname+'/'+entry.work));
    const work=await Work.decode(new Blob([bytes]));assert.equal(work.format,'mayatnik-work');assert.equal(work.version,2);assert.equal(work.data.k,31);assert.equal(work.data.st.rows,128);assert.equal(work.data.field.length,entry.frame.width*entry.frame.height);assert.deepEqual(work.data.st.xorrom,entry.settings);decoded.push(work);
  }});
  for(const entry of real)await library.open(entry.id);assert.equal(decoded.length,4);assert.deepEqual(api.calls,real.flatMap(()=>['pause','restore','settings']));assert.ok(decoded.every(work=>work.data.field instanceof Int8Array));assert.ok(decoded.every(work=>work.data.field.some(bit=>bit===1)));library.dispose();
});
test('frame-aware music cards expose the source work download and apply the original frame without starting audio',async()=>{
  let f;f=panel({entries:await framed(),restoreFrame:()=>{f.api.calls.push('restore');}});try{
    f.control.openTab('music');const card=f.el.querySelector('[data-music-id="electro-robot"]');assert.match(f.el.querySelector('.mtp-music-intro').textContent,/исходный битовый кадр/);assert.ok(card.querySelector('[data-music-action="work"]'));assert.match(card.querySelector('[data-music-action="open"]').title,/исходный кадр/);
    const image=card.querySelector('.mtp-music-frame');assert.equal(image.getAttribute('src'),'audio-examples/source-field.svg');assert.equal(image.loading,'lazy');assert.equal(image.width,285);assert.equal(image.height,128);assert.equal(image.style.aspectRatio,'285 / 128');assert.match(image.alt,/Исходный кадр/);assert.equal(card.querySelector('.mtp-music-frame-caption').textContent,'Кадр 31 · 128 строк');
    const style=f.w.document.createElement('style');style.textContent=fs.readFileSync(require.resolve('./mayatnik-template-panel.css'),'utf8');f.w.document.head.append(style);assert.equal(f.w.getComputedStyle(image).imageRendering,'pixelated');assert.equal(f.w.getComputedStyle(image).objectFit,'contain');
    card.querySelector('[data-music-action="open"]').click();await flush();assert.deepEqual(f.api.calls,['pause','restore','settings']);assert.equal(f.plays,0);
  }finally{f.close();}
});
test('Музыка opens read-only four-card bank without autoplay; preview is separate from applying',async()=>{
  const f=panel();try{
    assert.equal(f.control.isOpen(),false);assert.equal(f.plays,0);assert.equal(f.el.querySelector('[data-library-tab="music"]').textContent,'Музыка');f.control.openTab('music');
    assert.equal(f.el.querySelectorAll('[data-music-id]').length,4);assert.equal(f.plays,0);assert.deepEqual(f.api.calls,[]);assert.equal(f.el.querySelector('.mtp-section-commands').hidden,true);
    const click=action=>f.el.querySelector('[data-music-id="electro-robot"] [data-music-action="'+action+'"]').click();click('preview');await flush();assert.equal(f.plays,1);assert.deepEqual(f.api.calls,['pause']);const audio=f.el.querySelector('audio');assert.equal(audio.getAttribute('src'),'audio-examples/electro-robot.mp3');assert.equal(audio.hidden,false);
    click('open');await flush();assert.ok(f.pauses>0);assert.equal(audio.hidden,true);assert.equal(audio.hasAttribute('src'),false);assert.deepEqual(f.api.calls,['pause','pause','settings']);assert.equal(f.api.getSettings().timbre,'robot');assert.equal(f.el.querySelector('[data-music-id="electro-robot"] [data-music-action="open"]').getAttribute('aria-pressed'),'true');assert.equal(f.plays,1);
    f.el.querySelector('.mtp-search').value='Стеклян';f.el.querySelector('.mtp-search').dispatchEvent(new f.w.Event('input'));assert.equal(f.el.querySelectorAll('[data-music-id]').length,1);
  }finally{f.close();}
});
test('preview stops on tab switch, close and pagehide, and a delayed preview cannot restart after close/reopen',async()=>{
  const f=panel();try{
    f.control.openTab('music');f.el.querySelector('[data-music-action="preview"]').click();await flush();f.control.openTab('templates');assert.equal(f.el.querySelector('audio').hasAttribute('src'),false);
    f.control.openTab('music');f.el.querySelector('[data-music-action="preview"]').click();await flush();f.control.setOpen(false);assert.equal(f.el.querySelector('audio').hasAttribute('src'),false);
    let resolve;f.library.preview=()=>new Promise(done=>{resolve=done;});f.control.openTab('music');f.el.querySelector('[data-music-action="preview"]').click();f.control.setOpen(false);f.control.openTab('music');resolve(bank()[0]);await flush();assert.equal(f.plays,2);assert.equal(f.el.querySelector('audio').hasAttribute('src'),false);
  }finally{f.close();}
});
test('detached library reads the same built-ins from its opener without copying them to storage',async()=>{
  const f=panel({detached:true});try{f.control.openTab('music');assert.equal(f.el.querySelectorAll('[data-music-id]').length,4);assert.equal(f.plays,0);f.el.querySelector('[data-music-action="open"]').click();await flush();assert.deepEqual(f.api.calls,['pause','settings']);assert.equal(f.w.localStorage.getItem('mayatnik-xorrom-library'),null);}finally{f.close();}
});
