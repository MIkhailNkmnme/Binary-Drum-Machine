'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const M=require('../mayatnik/mayatnik-core.js');
const source=fs.readFileSync(__dirname+'/hub-xor-background.js','utf8');
function element(){const events={},classes=new Set();return {dataset:{},attributes:{},style:{setProperty(){}},classList:{toggle(k,on){if(on)classes.add(k);else classes.delete(k);}},setAttribute(k,v){this.attributes[k]=v;},addEventListener(k,fn){(events[k]||=[]).push(fn);},fire(k,e={}){for(const fn of events[k]||[])fn(e);},closest(){return null;}};}
function fixture({deferred=false}={}){
  const nodes={},timers=new Map(),measured=[],pending=[];let serial=0,time=0;
  for(const id of ['hubXorBackground','hubComparePause','hubComparePauseIcon'])nodes[id]=element();
  for(const id of ['hubCones','hubXor','hubBlend']){
    const c=nodes[id]=element();c.parentElement={getBoundingClientRect:()=>({left:0,top:0,width:500,height:300})};
    c.getContext=()=>({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){}});
  }
  const document=element();document.hidden=false;document.body=element();document.getElementById=id=>nodes[id]||null;
  const context={document,MAYATNIK:M,performance:{now:()=>++time},localStorage:{getItem:()=>null,setItem(){}},
    setTimeout(fn){const id=++serial;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id),
    addEventListener(){},HubComparePanel:{create:()=>({measure(input){measured.push({frame:input.frame,cycle:input.cycle,left:Array.from(input.left),right:Array.from(input.right)});return deferred?new Promise((resolve,reject)=>pending.push({resolve,reject})):Promise.resolve();},error(){}})} };
  context.window=context;
  const small=source.replace('const H = 1024','const H = 5').replace('FIRST_FRAME = 8','FIRST_FRAME = 0').replace('ROW_CHUNK = 64','ROW_CHUNK = 2');
  vm.runInNewContext(small,context);
  return {nodes,document,timers,measured,pending,
    pause:()=>nodes.hubComparePause.fire('click'),
    step(){assert.equal(timers.size,1,'one and only one scheduled timer');const [id,fn]=timers.entries().next().value;timers.delete(id);fn();},
    visibility(hidden){document.hidden=hidden;document.fire('visibilitychange');},
    async flush(){for(let i=0;i<5;i++)await Promise.resolve();},
    async frame(){const before=measured.length;for(let i=0;i<4&&measured.length===before;i++)this.step();assert.equal(measured.length,before+1);await this.flush();}
  };
}
test('48px pause diamond stays outside hidden Zen groups; release version and cache agree',()=>{
  const html=fs.readFileSync(__dirname+'/../index.html','utf8');
  assert.match(html,/<title>[^<]*v0\.461<\/title>/);
  assert.match(html,/hub-xor-background\.js\?v=460/);
  assert.match(html,/#hubComparePause\{[^}]*width:48px;height:48px/);
  assert.match(html,/#hubComparePause\{[^}]*clip-path:polygon\(50% 0,100% 50%,50% 100%,0 50%\)/);
  const hidden=html.match(/body\.hubCompareZen :is\(([^)]*)\)\{display:none!important\}/);
  assert.ok(hidden);assert.ok(!hidden[1].includes('#hubComparePause'));
  assert.match(html,/<button id="hubComparePause"[^>]*aria-label="Пауза трёх построений"/);
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
