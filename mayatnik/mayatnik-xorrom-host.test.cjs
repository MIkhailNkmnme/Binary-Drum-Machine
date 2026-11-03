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
  if(extra.ResizeObserver)win.ResizeObserver=extra.ResizeObserver;
  const api=host.mount({window:win,document:doc,viewport,figure:()=>extra.figure?.(doc,figure)||figure,engine,getSettings:()=>settings,setSettings:s=>{settings=s;saved++;},getSnapshot:extra.getSnapshot||async function(){return snapshot;}});
  return {api,win,doc,snapshot,get opts(){return opts;},get saved(){return saved;},get ctxCount(){return ctxCount;},get rendered(){return rendered;},restore(s){settings=s;},scroll(y){offset=y;win.dispatchEvent(new win.Event('scroll'));},close(){api.dispose();dom.window.close();},stream};
}
test('mount and restored settings stay silent; patches normalize and persist without per-step writes',async()=>{
  const f=fixture();assert.equal(f.ctxCount,0);assert.equal(f.api.getState().state,'stopped');
  assert.equal(f.api.getSettings().gain,.4);f.api.setSettings({gain:4,bpm:0});assert.equal(f.api.getSettings().gain,1);assert.equal(f.api.getSettings().bpm,96);assert.equal(f.saved,1);
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
 const marker=f.doc.getElementById('mayXorromRow');assert.equal(marker.style.display,'block');assert.equal(marker.style.top,'50px');assert.equal(marker.style.background,'transparent');
 figure.style.display='none';f.api.refresh();assert.equal(marker.style.display,'none');f.close();
});

test('marker keeps a one-pixel reading line at subpixel scale and uses physical geometry for rotated views',async()=>{
 const f=fixture();f.snapshot.height=1000;await f.api.start();f.opts.onStep({index:200,notes:[]});const marker=f.doc.getElementById('mayXorromRow');assert.equal(marker.style.display,'block');assert.equal(marker.style.height,'2px');assert.equal(marker.style.top,'39.1px');for(const dpr of [1,1.25,2]){f.win.devicePixelRatio=dpr;f.api.refresh();assert.equal(marker.querySelector('[data-xorrom-line]').style.height,'1px');assert.equal(marker.querySelector('path').getAttribute('stroke-width'),'1');}f.close();
 const dom=new JSDOM('<div><canvas></canvas></div>',{pretendToBeVisual:true}),win=dom.window,figure=win.document.querySelector('canvas'),viewport=win.document.querySelector('div');let config,visible=true;
 figure.style.visibility='hidden';figure.getBoundingClientRect=()=>({left:0,top:-1000,right:100,bottom:-800,width:100,height:200});viewport.getBoundingClientRect=()=>({left:0,top:0,right:100,bottom:200});
 const snapshot={height:4,rows:[{},{},{},{}]},engine={...audio,create(o){config=o;return{start:async()=>{await o.getSnapshot();o.onState('playing');return true;},setSettings(){},stop(){o.onState('stopped');},dispose(){},getStream(){return null;}};}};
 const api=host.mount({window:win,viewport,figure:()=>figure,figureRect:()=>({left:0,top:0,right:100,bottom:200,width:100,height:200}),isVisible:()=>visible,engine,getSnapshot:async()=>snapshot});await api.start();config.onStep({index:1,notes:[]});const m=win.document.getElementById('mayXorromRow');assert.equal(m.style.top,'50px');assert.equal(m.style.display,'block');visible=false;api.refresh();assert.equal(m.style.display,'none');assert.equal(api.getState().state,'playing');api.dispose();dom.window.close();
});


test('effective geometry is copied for display while manual settings and frozen region stay private',async()=>{
  const f=fixture();const region={id:7,area:6,width:3,height:2,perimeter:10,symmetryHeight:2,orientation:'down',triangleScore:1,exterior:false};
  for(const row of f.snapshot.rows)row.geometry={zero:region};
  f.api.setSettings({autoGeometry:true,gain:.4});await f.api.start();
  const effective=audio.effectiveSettings(f.api.getSettings(),f.snapshot.rows[1]);f.opts.onStep({index:1,notes:[],effective,geometry:region});
  const state=f.api.getState();assert.equal(state.geometry.id,7);assert.equal(state.effective.gain,.4);
  state.geometry.id=99;state.effective.gain=1;assert.equal(f.api.getState().geometry.id,7);assert.equal(f.api.getSettings().gain,.4);
  region.area=999;await f.api.exportWav();assert.equal(f.rendered.s.rows[0].geometry.zero.area,6);assert.equal(f.rendered.s.rows[0].geometry.zero,f.rendered.s.rows[1].geometry.zero);assert.equal(Object.isFrozen(f.rendered.s.rows[0].geometry.zero),true);
  f.api.setSettings({geometrySource:'symmetry',bpm:150});assert.equal(f.api.getState().effective.bpm,150);assert.equal(f.api.getState().effective.tonic,f.api.getSettings().tonic);assert.equal(f.api.getState().updating,false);
  f.api.stop();assert.equal(f.api.getState().geometry,null);assert.equal(f.api.getState().effective,null);f.close();
});


test('marker follows the assembled canvas and its resize while paused without recapturing or restarting audio',async()=>{
 let alternate=false,resize,captures=0,height=80;const observed=[],removed=[];class Observer{constructor(fn){resize=fn;}observe(n){observed.push(n);}unobserve(n){removed.push(n);}disconnect(){}}
 const f=fixture({ResizeObserver:Observer,figure:(doc,base)=>alternate?doc.getElementById('rombo'):base,getSnapshot:async()=>{captures++;return f.snapshot;}}),rombo=f.doc.createElement('canvas');rombo.id='rombo';f.doc.body.append(rombo);rombo.getBoundingClientRect=()=>({left:10,top:20,right:210,bottom:20+height,width:200,height});await f.api.start();f.opts.onStep({index:1,notes:[]});alternate=true;f.opts.onStep({index:1,notes:[]});assert.ok(observed.includes(rombo));assert.ok(removed.includes(f.doc.querySelector('div canvas')));const marker=f.doc.getElementById('mayXorromRow');assert.equal(marker.style.top,'40px');assert.equal(marker.style.height,'20px');f.api.pause();height=160;resize();await new Promise(r=>f.win.setTimeout(r,25));assert.equal(marker.style.top,'60px');assert.equal(marker.style.height,'40px');assert.equal(captures,1);assert.equal(f.api.getState().state,'paused');f.close();
});


test('restored backing settings stay silent; live notes identify both parts and disabling clears stale queued background labels',async()=>{
 const f=fixture();f.restore({backing:'pad',backingGain:.25,backingTimbre:'triangle',backingRows:8});f.api.refresh();assert.equal(f.ctxCount,0);assert.equal(f.api.getState().state,'stopped');assert.equal(f.api.getSettings().backingRows,8);
 await f.api.start();const step={index:1,notes:[{midi:60}],backing:{notes:[{midi:48},{midi:55}]}};f.opts.onStep(step);assert.deepEqual(f.api.getState().backingNotes.map(n=>n.midi),[48,55]);
 const saved=f.api.getState();saved.backingNotes[0].midi=1;assert.equal(f.api.getState().backingNotes[0].midi,48);f.api.setSettings({backing:'off'});f.opts.onStep(step);assert.deepEqual(f.api.getState().backingNotes,[]);f.api.stop();assert.deepEqual(f.api.getState().backingNotes,[]);f.close();
});
test('restart switch is saved and restored alongside all four backing settings without starting audio',()=>{
 const f=fixture(),backing={backing:'counter',backingGain:.4,backingTimbre:'triangle',backingRows:7};
 f.restore(backing);f.api.refresh();assert.equal(f.api.getSettings().restartOnFrame,false);
 const saved=f.api.setSettings({restartOnFrame:true});assert.equal(f.saved,1);
 f.restore(JSON.parse(JSON.stringify(saved)));f.api.refresh();
 assert.equal(f.api.getSettings().restartOnFrame,true);for(const [key,value] of Object.entries(backing))assert.equal(f.api.getSettings()[key],value);
 f.restore({restartOnFrame:'false'});f.api.refresh();assert.equal(f.api.getSettings().restartOnFrame,false);
 assert.equal(f.ctxCount,0);assert.equal(f.api.getState().state,'stopped');f.close();
});
test('reading line outlines contiguous ones on the full figure, including clipped and paused rows',async()=>{
 const rows=[[1,1,1,0,0,1,1],[1,1,-1,1,0,1,0],[0,0,0,0,0,0,0]].map(a=>({bits:Int8Array.from(a)}));
 let x=10,w=70;
 const f=fixture({getSnapshot:async()=>({frame:0,width:7,height:3,rows}),figure:(doc,source)=>{
   source.getBoundingClientRect=()=>({left:x,right:x+w,top:20,bottom:80,width:w,height:60});return source;
 }});
 await f.api.start();const marker=f.doc.getElementById('mayXorromRow'),path=marker.querySelector('path');
 const step=index=>f.opts.onStep({index,notes:[],manual:true});
 step(0);assert.equal(path.getAttribute('d'),'M0 0h30v20h-30Z M50 0h20v20h-20Z');
 assert.equal(path.getAttribute('fill'),'rgba(255,184,48,.28)');assert.equal(path.getAttribute('stroke'),'#fff2a6');assert.match(path.style.filter,/drop-shadow/);assert.equal(path.getAttribute('vector-effect'),'non-scaling-stroke');assert.equal(path.parentElement.style.pointerEvents,'none');
 const line=marker.querySelector('[data-xorrom-line]');assert.equal(line.style.height,'1px');assert.equal(line.style.top,'9.5px');assert.equal(marker.style.border,'');assert.equal(marker.style.boxShadow,'');
 f.api.pause();step(1);assert.equal(path.getAttribute('d'),'M0 0h20v20h-20Z M30 0h10v20h-10Z M50 0h10v20h-10Z');
 x=-45;w=350;step(0);assert.equal(path.getAttribute('d'),'M-55 0h150v20h-150Z M195 0h100v20h-100Z');
 assert.equal(path.parentElement.getAttribute('width'),'200');
 x=10;w=140;f.win.dispatchEvent(new f.win.Event('resize'));await new Promise(r=>f.win.setTimeout(r,25));
 assert.equal(path.getAttribute('d'),'M0 0h60v20h-60Z M100 0h40v20h-40Z');
 step(2);assert.equal(path.hasAttribute('d'),false);step(1);f.api.stop();assert.equal(path.hasAttribute('d'),false);f.close();
});
