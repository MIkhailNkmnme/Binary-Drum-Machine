const test=require('node:test');
const assert=require('node:assert/strict');
const {JSDOM}=require('C:/Users/Mhl/AppData/Local/Temp/codex-setka-dom/node_modules/jsdom');
const audio=require('./mayatnik-xorrom.js');
const host=require('./mayatnik-xorrom-host.js');
function fixture(extra={}){
  const dom=new JSDOM('<div id="viewport"><canvas></canvas></div>',{pretendToBeVisual:true}),win=dom.window,doc=win.document;
  const viewport=doc.querySelector('div'),figure=doc.querySelector('canvas');
  let offset=0,settings={bpm:120,gain:.4},saved=0,ctxCount=0,coreState='stopped',opts,rendered;
  const snapshot={width:2,height:4,rows:Array.from({length:4},()=>({bits:new Int8Array([1,0]),ones:1,colors:new Uint32Array(8)}))};
  viewport.getBoundingClientRect=()=>({left:10,top:20,right:210,bottom:120,width:200,height:100});
  figure.getBoundingClientRect=()=>({left:0,top:offset,right:300,bottom:offset+200,width:300,height:200});
  const engine={...audio,create(config){opts=config;return {
    async start(){const snap=await config.getSnapshot();coreState='playing';config.onState('playing');return !!snap;},
    pause(){coreState='paused';config.onState(coreState);},stop(){coreState='stopped';config.onState(coreState);},
    setSettings(value){this.settings=value;},getState:()=>coreState,getStream:()=>stream,
    dispose(){this.stop();}};},renderWav(s,config,options){rendered={s,config,options};return {bytes:new Uint8Array([1]),duration:60,truncated:true};}};
  const stream={original:true};win.AudioContext=function(){ctxCount++;};
  const api=host.mount({window:win,document:doc,viewport,figure:()=>figure,engine,getSettings:()=>settings,setSettings:s=>{settings=s;saved++;},getSnapshot:extra.getSnapshot||async function(){return snapshot;}});
  return {api,win,doc,snapshot,get opts(){return opts;},get saved(){return saved;},get ctxCount(){return ctxCount;},get rendered(){return rendered;},restore(s){settings=s;},scroll(y){offset=y;win.dispatchEvent(new win.Event('scroll'));},close(){api.dispose();dom.window.close();},stream};
}
test('mount and restored settings stay silent; patches normalize and persist without per-step writes',async()=>{
  const f=fixture();assert.equal(f.ctxCount,0);assert.equal(f.api.getState().state,'stopped');
  assert.equal(f.api.getSettings().gain,.4);f.api.setSettings({gain:4,bpm:0});assert.equal(f.api.getSettings().gain,1);assert.equal(f.api.getSettings().bpm,60);assert.equal(f.saved,1);
  f.restore({gain:.1,bpm:160});f.api.refresh();assert.equal(f.api.getSettings().gain,.1);assert.equal(f.ctxCount,0);
  await f.api.start();f.opts.onStep({index:1,notes:[{midi:60}]});assert.equal(f.saved,1);assert.equal(f.api.getStream(),f.stream);f.close();
});
test('marker tracks actual row, clips to viewport, hides after scroll and stop',async()=>{
  const f=fixture();await f.api.start();f.opts.onStep({index:1,notes:[]});const marker=f.doc.getElementById('mayXorromRow');
  assert.equal(marker.style.top,'50px');assert.equal(marker.style.height,'50px');assert.equal(marker.style.left,'10px');assert.equal(marker.style.width,'200px');assert.equal(marker.style.pointerEvents,'none');
  f.api.pause();assert.equal(marker.style.opacity,'0.45');f.scroll(-500);await new Promise(r=>f.win.setTimeout(r,25));assert.equal(marker.style.display,'none');f.api.stop();assert.equal(f.api.getState().index,-1);f.close();assert.equal(f.doc.getElementById('mayXorromRow'),null);
});
test('pending capture receives cancellation and cannot start after stop',async()=>{
  let resolve,wasCancelled;const f=fixture({getSnapshot:({cancelled})=>new Promise(r=>{resolve=()=>{wasCancelled=cancelled();r(f.snapshot);};})});
  const pending=f.api.start();f.api.stop();resolve();assert.equal(await pending,false);assert.equal(wasCancelled,true);assert.equal(f.api.getState().state,'stopped');f.close();
});
test('source errors and runtime errors publish plain messages',async()=>{
  const f=fixture({getSnapshot:async()=>{throw Error('Field missing');}});await assert.rejects(f.api.start(),/Field missing/);assert.equal(f.api.getState().error,'Field missing');f.opts.onError(Error('Audio failed'));assert.equal(f.api.getState().error,'Audio failed');f.close();
});
test('WAV uses private played snapshot, preserves settings, and explicitly reports cap',async()=>{
  const f=fixture();await f.api.start();f.snapshot.rows[0].bits[0]=0;f.api.pause();const wav=await f.api.exportWav();
  assert.equal(f.rendered.s.rows[0].bits[0],1);assert.equal(Object.isFrozen(f.rendered.s),true);assert.equal(f.rendered.options.maxSeconds,60);assert.equal(wav.name,'xorrom-field.wav');assert.match(wav.note,/60/);assert.match(wav.note,/обрезан/);assert.equal(wav.blob.type,'audio/wav');f.close();
});
function realFixture(getSnapshot){
  const dom=new JSDOM('<div><canvas></canvas></div>',{pretendToBeVisual:true}),win=dom.window;
  const node=()=>({connect(){},disconnect(){}});
  class Context extends win.EventTarget{
    constructor(){super();this.state='running';this.currentTime=0;this.destination=node();}
    createGain(){return {...node(),gain:{value:1,setTargetAtTime(){},setValueAtTime(){},linearRampToValueAtTime(){}}};}
    async close(){this.state='closed';}
  }
  win.AudioContext=Context;
  const api=host.mount({window:win,viewport:win.document.querySelector('div'),figure:()=>win.document.querySelector('canvas'),getSnapshot});
  return {api,close:async()=>{await api.dispose();dom.window.close();}};
}
test('actual core cancels a deferred capture without a ghost start',async()=>{
  let complete,cancelled;
  const f=realFixture(options=>new Promise(resolve=>{complete=()=>{cancelled=options.cancelled();resolve({height:1,rows:[{ones:0}]});};}));
  const pending=f.api.start();f.api.stop();complete();assert.equal(await pending,false);assert.equal(cancelled,true);assert.equal(f.api.getState().state,'stopped');await f.close();
});
test('actual core startup error reaches subscribers and caller',async()=>{
  const f=realFixture(async()=>{throw Error('No current field');});const errors=[];f.api.subscribe(s=>errors.push(s.error));
  await assert.rejects(f.api.start(),/No current field/);assert.equal(f.api.getState().error,'No current field');assert.ok(errors.includes('No current field'));await f.close();
});

test('hidden source canvas remains a valid geometry anchor while display is painted by layers',async()=>{
 const f=fixture();const figure=f.doc.querySelector('canvas');figure.style.visibility='hidden';await f.api.start();f.opts.onStep({index:1,notes:[{midi:60}]});
 const marker=f.doc.getElementById('mayXorromRow');assert.equal(marker.style.display,'block');assert.equal(marker.style.top,'50px');assert.notEqual(marker.style.background,'transparent');
 figure.style.display='none';f.api.refresh();assert.equal(marker.style.display,'none');f.close();
});

test('marker has a visible two-pixel band at subpixel scale and uses physical geometry for rotated views',async()=>{
 const f=fixture();f.snapshot.height=1000;await f.api.start();f.opts.onStep({index:200,notes:[]});const marker=f.doc.getElementById('mayXorromRow');assert.equal(marker.style.display,'block');assert.equal(marker.style.height,'2px');assert.equal(marker.style.top,'39.1px');f.close();
 const dom=new JSDOM('<div><canvas></canvas></div>',{pretendToBeVisual:true}),win=dom.window,figure=win.document.querySelector('canvas'),viewport=win.document.querySelector('div');let config,visible=true;
 figure.style.visibility='hidden';figure.getBoundingClientRect=()=>({left:0,top:-1000,right:100,bottom:-800,width:100,height:200});viewport.getBoundingClientRect=()=>({left:0,top:0,right:100,bottom:200});
 const snapshot={height:4,rows:[{},{},{},{}]},engine={...audio,create(o){config=o;return{start:async()=>{await o.getSnapshot();o.onState('playing');return true;},setSettings(){},stop(){o.onState('stopped');},dispose(){},getStream(){return null;}};}};
 const api=host.mount({window:win,viewport,figure:()=>figure,figureRect:()=>({left:0,top:0,right:100,bottom:200,width:100,height:200}),isVisible:()=>visible,engine,getSnapshot:async()=>snapshot});await api.start();config.onStep({index:1,notes:[]});const m=win.document.getElementById('mayXorromRow');assert.equal(m.style.top,'50px');assert.equal(m.style.display,'block');visible=false;api.refresh();assert.equal(m.style.display,'none');assert.equal(api.getState().state,'playing');api.dispose();dom.window.close();
});
