'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const M=require('../mayatnik/mayatnik-core.js');
const source=fs.readFileSync(__dirname+'/hub-xor-background.js','utf8');
function element(){const events={},classes=new Set();return {dataset:{},attributes:{},style:{setProperty(){}},clicks:0,click(){this.clicks++;},classList:{toggle(k,on){if(on)classes.add(k);else classes.delete(k);},add(k){classes.add(k);},remove(k){classes.delete(k);},contains(k){return classes.has(k);}},setAttribute(k,v){this.attributes[k]=v;},addEventListener(k,fn){(events[k]||=[]).push(fn);},fire(k,e={}){for(const fn of events[k]||[])fn(e);},closest(){return null;}};}
function fixture({deferred=false,firstFrame=0}={}){
  const nodes={},timers=new Map(),measured=[],pending=[],listeners={};let serial=0,time=0;
  for(const id of ['hubXorBackground','hubComparePause','hubComparePauseIcon','hubCompareZen'])nodes[id]=element();
  for(const id of ['hubCones','hubXor','hubBlend']){
    const c=nodes[id]=element();c.parentElement={getBoundingClientRect:()=>({left:0,top:0,width:500,height:300}),classList:{add(){},remove(){},toggle(){}}};
    c.getContext=()=>({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){}});
  }
  const document=element();document.hidden=false;document.body=element();document.getElementById=id=>nodes[id]||null;
  const context={document,MAYATNIK:M,HubXorKernel:require('./hub-xor-kernel.js'),performance:{now:()=>++time},localStorage:{getItem:()=>null,setItem(){}},
    setTimeout(fn){const id=++serial;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id),
    addEventListener(k,fn){(listeners[k]||=[]).push(fn);},
    fire(k,e={}){for(const fn of listeners[k]||[])fn(e);},
    HubComparePanel:{create:()=>({measure(input){measured.push({frame:input.frame,cycle:input.cycle,left:Array.from(input.left),right:Array.from(input.right)});return deferred?new Promise((resolve,reject)=>pending.push({resolve,reject})):Promise.resolve();},error(){}})} };
  context.window=context;
  const small=source.replace('const H = 1024','const H = 5').replace('FIRST_FRAME = 8','FIRST_FRAME = '+firstFrame).replace('ROW_CHUNK = 64','ROW_CHUNK = 2');
  vm.runInNewContext(small,context);
  const pointer=(type,{pointerId=1,button=0,pointerType='mouse',clientX=250,clientY=150}={})=>context.fire(type,{pointerId,button,buttons:type==='pointerup'?0:1,pointerType,clientX,clientY,preventDefault(){},stopImmediatePropagation(){}});
  return {nodes,document,timers,measured,pending,
    pause:()=>nodes.hubComparePause.fire('click'),
    zen:on=>document.body.classList.toggle('hubCompareZen',on),
    dblclick(x,y,target=null,button=0){const e={button,clientX:x,clientY:y,target:target||element(),preventDefault(){e.defaultPrevented=true;},stopImmediatePropagation(){e.stopped=true;}};context.fire('dblclick',e);return e;},
    pointerdown:opts=>pointer('pointerdown',opts),
    pointermove:opts=>pointer('pointermove',opts),
    pointerup:opts=>pointer('pointerup',opts),
    runHold(){const ids=[...timers.keys()];assert.ok(ids.length,'hold timer scheduled');const fn=timers.get(ids[ids.length-1]);timers.delete(ids[ids.length-1]);fn();},
    step(){assert.equal(timers.size,1,'one and only one scheduled timer');const [id,fn]=timers.entries().next().value;timers.delete(id);fn();},
    visibility(hidden){document.hidden=hidden;document.fire('visibilitychange');},
    async flush(){for(let i=0;i<5;i++)await Promise.resolve();},
    async frame(){const before=measured.length;for(let i=0;i<4&&measured.length===before;i++)this.step();assert.equal(measured.length,before+1);await this.flush();}
  };
}
test('release version and cache agree; pause and zen buttons are hidden inside zen',()=>{
  const html=fs.readFileSync(__dirname+'/../index.html','utf8');
  assert.match(html,/<title>[^<]*v0\.471<\/title>/);
  assert.match(html,/hub-xor-background\.js\?v=471/);
  assert.match(html,/#hubComparePause\{[^}]*width:48px;height:48px/);
  assert.match(html,/#hubComparePause\{[^}]*clip-path:polygon\(50% 0,100% 50%,50% 100%,0 50%\)/);
  const hidden=html.match(/body\.hubCompareZen :is\(([^)]*)\)\{display:none!important\}/);
  assert.ok(hidden);
  assert.ok(hidden[1].includes('#hubComparePause'),'pause diamond is hidden in zen');
  assert.ok(hidden[1].includes('#hubCompareZen'),'zen/menu button is hidden in zen');
  assert.match(html,/<button id="hubComparePause"[^>]*aria-label="Пауза трёх построений"/);
  assert.match(html,/id="hubCompareZen"[^>]*title="[^"]*Esc[^"]*удержание/);
});
test('touch screens keep a translucent hollow diamond exit in zen',()=>{
  const html=fs.readFileSync(__dirname+'/../index.html','utf8');
  assert.match(html,/@media \(hover: none\),\(pointer: coarse\)\{/);
  const touch=html.slice(html.indexOf('@media (hover: none),(pointer: coarse){'));
  assert.match(touch,/body\.hubCompareZen #hubCompareZen\{[^}]*display:flex!important/,'кнопка снова видна только в этом медиазапросе');
  assert.match(touch,/body\.hubCompareZen #hubCompareZen\{[^}]*background:transparent!important/,'фона у ромба нет');
  assert.match(touch,/body\.hubCompareZen #hubCompareZen\{[^}]*opacity:\.42/,'ромб полупрозрачный');
  assert.match(touch,/body\.hubCompareZen #hubCompareZen\{[^}]*width:56px!important/,'ромб 56px — палец попадает');
  assert.match(touch,/body\.hubCompareZen #hubCompareZen::before\{[^}]*stroke-opacity/,'контур ромба рисует SVG, заливки нет');
  assert.match(touch,/body\.hubCompareZen #hubCompareZen \.gz-ic\{display:none\}/,'в ромбе остаётся слово, а не значок');
  assert.match(touch,/body\.hubCompareZen #hubCompareZen:is\(:active,:focus-visible\)\{opacity:1\}/,'касание показывает ромб полностью');
});
test('pause before start blocks both sources and resumes exactly once',async()=>{
  const f=fixture();f.pause();assert.equal(f.timers.size,0);assert.equal(f.measured.length,0);
  assert.equal(f.nodes.hubComparePauseIcon.textContent,'▶');assert.equal(f.nodes.hubComparePause.attributes['aria-pressed'],'true');
  f.pause();assert.equal(f.timers.size,1);assert.equal(f.nodes.hubComparePauseIcon.textContent,'Ⅱ');
  await f.frame();assert.deepEqual(f.measured.map(x=>x.frame),[0]);assert.equal(f.timers.size,1);
});
test('mid-chunk pause preserves exact source fields, frame sequence and cycle rollover',async()=>{
  const baseline=fixture(),paused=fixture();
  for(let i=0;i<11;i++)await baseline.frame();
  paused.step();assert.equal(paused.measured.length,0); // rows 1..2 completed
  paused.pause();assert.equal(paused.timers.size,0);
  paused.visibility(true);paused.visibility(false);assert.equal(paused.timers.size,0);
  paused.pause();assert.equal(paused.timers.size,1);
  for(let i=0;i<11;i++)await paused.frame();
  assert.deepEqual(paused.measured,baseline.measured);
  assert.deepEqual(paused.measured.map(x=>[x.cycle,x.frame]),[[0,0],[0,1],[0,2],[0,3],[0,4],[0,5],[0,6],[0,7],[0,8],[1,0],[1,1]]);
});
test('pause while statistics are pending lets current job settle but cannot start a new frame',async()=>{
  const f=fixture({deferred:true});await f.frame();assert.equal(f.timers.size,0);
  f.pause();f.pending.shift().resolve();await f.flush();assert.equal(f.timers.size,0);
  assert.deepEqual(f.measured.map(x=>x.frame),[0]);
  f.pause();assert.equal(f.timers.size,1);await f.frame();assert.equal(f.measured[1].frame,1);
});

test('pause during next-cycle hidden warmup measures the last displayed field, not the hidden new field',async()=>{
  const f=fixture({firstFrame:2});
  for(let i=0;i<10;i++)await f.frame();
  assert.deepEqual(f.measured.slice(-1).map(x=>[x.cycle,x.frame]),[[1,0]]);
  assert.equal(f.nodes.hubCones.dataset.frame,'8');
  const displayed=f.measured[8];
  f.pause();await f.flush();
  assert.deepEqual(f.measured[f.measured.length-1],displayed);
});
test('resume during pending statistics and hidden transitions never duplicates a timer',async()=>{
  const f=fixture({deferred:true});await f.frame();
  f.pause();f.visibility(true);f.pause();assert.equal(f.timers.size,0);
  f.visibility(false);assert.equal(f.timers.size,0);
  f.pending.shift().resolve();await f.flush();assert.equal(f.timers.size,1);
  f.visibility(false);f.visibility(false);assert.equal(f.timers.size,1);
  f.pause();f.pause();f.pause();f.pause();assert.equal(f.timers.size,1);
  await f.frame();assert.equal(f.measured[1].frame,1);assert.equal(f.timers.size,0);
});
test('resume while hidden waits for visibility and preserves unfinished frame',async()=>{
  const f=fixture();f.step();f.pause();f.visibility(true);f.pause();
  assert.equal(f.timers.size,0);f.visibility(false);assert.equal(f.timers.size,1);
  await f.frame();assert.equal(f.measured[0].frame,0);
});
test('failed statistics disables pause and cannot restart animation',async()=>{
  const f=fixture({deferred:true});await f.frame();f.pending.shift().reject(new Error('test failure'));await f.flush();
  assert.equal(f.nodes.hubComparePause.disabled,true);assert.match(f.nodes.hubXorBackground.dataset.error,/test failure/);
  f.pause();f.visibility(true);f.visibility(false);assert.equal(f.timers.size,0);
});
test('double click on the field pauses and resumes, in split, in overlays and in zen',async()=>{
  for(const zen of [false,true]){
    const f=fixture();f.zen(zen);f.dblclick(250,150);
    assert.equal(f.nodes.hubXorBackground.dataset.paused,'true','first double click pauses');
    assert.equal(f.nodes.hubComparePauseIcon.textContent,'▶');
    assert.equal(f.timers.size,0);
    const e=f.dblclick(250,150);
    assert.equal(f.nodes.hubXorBackground.dataset.paused,'false','second double click resumes');
    assert.equal(f.nodes.hubComparePauseIcon.textContent,'Ⅱ');
    assert.equal(f.timers.size,1);
    assert.equal(e.stopped,true,'double click is consumed before the old field handler');
    await f.frame();
  }
});
test('double click outside the fields or on a control does not toggle the pause',()=>{
  const f=fixture();
  f.dblclick(10,10);assert.equal(f.nodes.hubXorBackground.dataset.paused,'false');
  assert.equal(f.timers.size,1);
  f.dblclick(250,150,{closest:()=>({})});assert.equal(f.nodes.hubXorBackground.dataset.paused,'false');
  assert.equal(f.timers.size,1);
  f.dblclick(250,150,null,2);assert.equal(f.nodes.hubXorBackground.dataset.paused,'false');
  assert.equal(f.timers.size,1);
});
test('holding the field in zen leaves it once; moving cancels; outside zen nothing happens',()=>{
  const f=fixture();f.zen(true);
  f.pointerdown({pointerId:3,clientX:250,clientY:150});f.runHold();
  assert.equal(f.nodes.hubCompareZen.clicks,1,'long press asks the zen button to leave zen');
  f.pointerdown({pointerId:4,clientX:250,clientY:150});f.pointermove({pointerId:4,clientX:400,clientY:150});f.runHold();
  assert.equal(f.nodes.hubCompareZen.clicks,1,'moving the pointer cancels the hold');
  const g=fixture();g.pointerdown({pointerId:5,clientX:250,clientY:150});
  assert.equal(g.timers.size,1,'no hold timer outside zen');
  assert.equal(g.nodes.hubCompareZen.clicks,0);
});
