'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const Stats = require('./hub-compare-stats.js');
const Areas = require('./hub-compare-areas.js');
const load = name => fs.readFileSync(path.join(__dirname, name), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));

function node() {
  const listeners = {}, classes = new Set();
  return { hidden:false, innerHTML:'',textContent:'',scrollTop:0,attributes:{},
    classList:{toggle(name,on){if(on)classes.add(name);else classes.delete(name);},contains:name=>classes.has(name)},
    setAttribute(name,value){this.attributes[name]=value;},
    addEventListener(name,fn){(listeners[name] ||= []).push(fn);},
    emit(name,event={}){for(const fn of listeners[name]||[])fn(event);} };
}
function harness({ worker='success', saved=null, deferred=false }={}) {
  const ids = ['hubComparePanel','hubComparePanelContent','hubCompareProgress','hubCompareCounts','hubCompareAreas','hubCompareEvents','hubCompareZen','hubCompareZenLabel'];
  const elements = Object.fromEntries(ids.map(id=>[id,node()]));
  const body=node(), document=node(), jobs=[], messages=[], workers=[];
  document.body=body;document.currentScript={src:'https://example.test/_js/hub-compare-panel.js?v=1'};
  document.getElementById=id=>elements[id]||null;
  const storage=new Map(saved ? [['zerk_hub_compare_panels_v1',JSON.stringify(saved)]] : []);
  class MockWorker {
    constructor(url) {
      if(worker==='constructorError')throw Error('disabled');
      this.url=String(url);this.terminated=false;workers.push(this);
      const scope={HubCompareAreas:Areas,onmessage:null,postMessage:data=>this.onmessage?.({data})};
      scope.importScripts=url=>{assert.match(url,/^hub-compare-areas\.js/);};
      this.scope=vm.createContext(scope);
      vm.runInContext(load('hub-compare-worker.js'),this.scope);
    }
    postMessage(message,transfer) {
      if(worker==='postError')throw Error('post failed');
      // Emulate structured clone and transferred buffers, so tests verify that
      // panel never transfers or modifies the caller's source field buffers.
      const data=structuredClone(message,{transfer});messages.push(data);
      const run=()=>{
        if(worker==='error')this.onerror?.({preventDefault(){}});
        else if(worker==='messageError')this.onmessageerror?.({});
        else if(worker==='reportedError')this.onmessage?.({data:{id:data.id,error:'analysis failed'}});
        else this.scope.onmessage({data});
      };
      if(deferred)jobs.push(run);else setTimeout(run,0);
    }
    terminate(){this.terminated=true;}
  }
  const context={document,HubCompareStats:Stats,HubCompareAreas:Areas,URL,setTimeout,location:{href:'https://example.test/index.html'},
    localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)}};
  if(worker!=='absent')context.Worker=MockWorker;
  context.window=context;
  vm.runInNewContext(load('hub-compare-panel.js'),context);
  const controller=context.HubComparePanel.create({W:5,H:3});
  return { controller,elements,document,body,workers,jobs,messages,storage };
}
function input(frame,cycle=0) {
  const left=new Int8Array(15).fill(0),middle=new Int8Array(15).fill(0),right=new Int8Array(15).fill(0);
  if(frame%2){left[0]=1;right[4]=1;}
  middle.set(left);   // v2: третье поле 5.9 участвует в таблицах и событиях
  return {left,middle,right,frame,cycle};
}
function activate(h) {
  if (h.elements.hubCompareCounts.attributes['aria-pressed'] !== 'true') h.elements.hubCompareCounts.emit('click');
}
async function complete(h,cycle=0) {activate(h);for(let frame=0;frame<5;frame++)await h.controller.measure(input(frame,cycle));}

test('real worker algorithm emits areas and errors with matching request id', () => {
  const output=[], scope={HubCompareAreas:Areas,onmessage:null,importScripts(){},postMessage:data=>output.push(data)};
  vm.runInNewContext(load('hub-compare-worker.js'),scope);
  const data={id:19,...input(0),W:5,H:3};
  scope.onmessage({data});
  assert.equal(output[0].id,19);
  assert.deepEqual(plain(output[0].areas),plain(Areas.analyzeAreas(data)));
  scope.onmessage({data:{id:20,W:0,H:3,left:[],right:[],frame:0}});
  assert.equal(output[1].id,20);assert.equal(typeof output[1].error,'string');
});
test('worker path preserves caller buffers, records every frame and previous cycle', async () => {
  const h=harness(), expected=Stats.createTracker({W:5,H:3});
  activate(h);
  assert.equal(h.workers[0].url,'https://example.test/_js/hub-compare-worker.js?v=2');
  for(let frame=0;frame<5;frame++){
    const data=input(frame), original=Array.from(data.left);
    const got=await h.controller.measure(data);
    expected.record({...data,areas:Areas.analyzeAreas({...data,W:5,H:3})});
    assert.deepEqual(plain(got),expected.snapshot({includeFrames:false}));
    assert.deepEqual(Array.from(data.left),original);
    assert.equal(data.left.byteLength,15);
  }
  assert.equal(h.messages.length,5);
  assert.equal(h.controller.snapshot().cycle.complete,true);
  assert.deepEqual(plain(h.controller.snapshot().cycle.events.fieldsEqual.ranges),[[0,0],[2,2],[4,4]]);
  await h.controller.measure(input(0,1));
  assert.equal(h.controller.snapshot().previousCycle.frames,5);
  assert.match(h.elements.hubCompareProgress.textContent,/Кадр 0 · цикл 2 · 1 \/ 5/);
});
for(const worker of ['error','messageError','reportedError','postError','constructorError','absent']) {
  test(worker+' fallback preserves frame zero and completes the cycle',async()=>{
    const h=harness({worker});await complete(h);
    const snap=h.controller.snapshot();
    assert.equal(snap.cycle.frames,5);assert.equal(snap.cycle.complete,true);
    assert.deepEqual(plain(snap.cycle.events.fieldsEqual.ranges),[[0,0],[2,2],[4,4]]);
    assert.equal(snap.cycle.totals.left.ones,2);
    assert.equal(snap.cycle.totals.left.zeros,73);
    assert.equal(snap.cycle.areas.frames,5);
    if(h.workers.length)assert.equal(h.workers[0].terminated,true);
  });
}
test('worker backpressure rejects overlap and ignores stale worker replies',async()=>{
  const h=harness({deferred:true});activate(h);const first=h.controller.measure(input(0));
  await assert.rejects(h.controller.measure(input(1)),/ещё считается/);
  h.workers[0].onmessage({data:{id:999,areas:null}});
  assert.equal(h.controller.snapshot(),null);
  h.jobs.shift()();await first;
  const next=h.controller.measure(input(1));h.jobs.shift()();await next;
  assert.equal(h.controller.snapshot().cycle.frames,2);
});
test('main-thread fallback also rejects overlapping calls',async()=>{
  const h=harness({worker:'absent'});activate(h);const first=h.controller.measure(input(0));
  const second=h.controller.measure(input(1));
  await assert.rejects(second,/ещё считается/);await first;
});
test('worker failure midway keeps prior statistics and fallback stays under backpressure',async()=>{
  const h=harness({deferred:true});activate(h);
  const first=h.controller.measure(input(0));h.jobs.shift()();await first;
  const second=h.controller.measure(input(1));
  h.workers[0].onerror({preventDefault(){}});
  await assert.rejects(h.controller.measure(input(2)),/ещё считается/);
  await second;
  for(let frame=2;frame<5;frame++)await h.controller.measure(input(frame));
  assert.equal(h.controller.snapshot().cycle.frames,5);
  assert.equal(h.controller.snapshot().cycle.totals.left.ones,2);
  assert.deepEqual(plain(h.controller.snapshot().cycle.events.fieldsEqual.ranges),[[0,0],[2,2],[4,4]]);
});
test('mode buttons render numeric count, area and event tables while retaining scroll',async()=>{
  const h=harness();
  const {hubComparePanel:panel,hubComparePanelContent:content}=h.elements;
  assert.equal(panel.hidden,true);
  await complete(h);
  assert.equal(panel.hidden,false);assert.equal(h.elements.hubCompareCounts.attributes['aria-pressed'],'true');
  assert.match(content.innerHTML,/Единицы<\/td><td>0<\/td><td>0<\/td><td>0/);
  assert.match(content.innerHTML,/Единицы<\/td><td>2<\/td><td>2<\/td><td>2/);
  assert.match(content.innerHTML,/Количество 1 и 0 у всех трёх/);
  assert.match(content.innerHTML,/За цикл · 5 \/ 5 кадров/);
  panel.scrollTop=217;await h.controller.measure(input(0,1));
  assert.equal(panel.scrollTop,217);assert.match(content.innerHTML,/Завершённый цикл 1/);
  h.elements.hubCompareAreas.emit('click');
  assert.equal(h.elements.hubCompareCounts.attributes['aria-pressed'],'false');
  assert.match(content.innerHTML,/Сумма площадей/);assert.match(content.innerHTML,/перекрыва/);
  const a=h.controller.snapshot().current.areas;
  assert.ok(content.innerHTML.includes('<td>'+a.left.figureCount+'</td><td>'+a.middle.figureCount+'</td><td>'+a.right.figureCount+'</td>'));
  assert.match(content.innerHTML,/Равные площади у трёх/);
  h.elements.hubCompareEvents.emit('click');
  assert.match(content.innerHTML,/5\.7 и 5\.8: полное поле совпало прямо/);
  assert.match(content.innerHTML,/Все три: полное поле совпало прямо/);
  assert.match(content.innerHTML,/<td>3<\/td><td>0, 2, 4<\/td>/);
  assert.match(content.innerHTML,/<td>5<\/td><td>0–4<\/td>/);
  h.elements.hubCompareEvents.emit('click');assert.equal(panel.hidden,true);
});
test('statistics are on demand: no worker while closed, partial cycle when opened',async()=>{
  const h=harness();
  assert.equal(h.controller.active(),false);
  assert.equal(await h.controller.measure(input(0)),null);
  assert.equal(h.messages.length,0);
  h.elements.hubCompareCounts.emit('click');
  assert.equal(h.controller.active(),true);
  const first=await h.controller.measure(input(2));
  assert.equal(first.cycle.startFrame,2);
  assert.equal(first.cycle.partial,true);
  assert.equal(first.cycle.frames,1);
  await h.controller.measure(input(3));
  assert.equal(h.controller.snapshot().cycle.frames,2);
  h.elements.hubCompareCounts.emit('click');
  assert.equal(h.controller.active(),false);
  const closed=await h.controller.measure(input(4));
  assert.equal(closed.cycle.frames,2,'closed panel does not record');
  assert.equal(h.messages.length,2,'closed panel sends no worker job');
  h.elements.hubCompareCounts.emit('click');
  const reopened=await h.controller.measure(input(4));
  assert.equal(reopened.cycle.startFrame,4);
  assert.equal(reopened.cycle.frames,1);
});
test('Zen restores saved state, persists toggles and Escape restores menu',()=>{
  const h=harness({saved:{section:'counts',zen:true}});
  assert.equal(h.body.classList.contains('hubCompareZen'),true);
  assert.equal(h.elements.hubCompareZenLabel.textContent,'Меню');
  assert.equal(h.elements.hubComparePanel.hidden,false);
  h.document.emit('keydown',{key:'Escape'});
  assert.equal(h.body.classList.contains('hubCompareZen'),false);
  assert.equal(h.elements.hubCompareZen.attributes['aria-pressed'],'false');
  assert.deepEqual(JSON.parse(h.storage.get('zerk_hub_compare_panels_v1')),{section:'counts',zen:false});
  h.elements.hubCompareZen.emit('click');
  assert.equal(h.body.classList.contains('hubCompareZen'),true);
  assert.equal(JSON.parse(h.storage.get('zerk_hub_compare_panels_v1')).zen,true);
});
test('record failure settles the promise, displays message and exits Zen',async()=>{
  const h=harness({saved:{section:'counts',zen:true}});
  await assert.rejects(h.controller.measure(input(1)),/start at frame 0/);
  assert.equal(h.body.classList.contains('hubCompareZen'),false);
  assert.equal(h.elements.hubComparePanel.hidden,false);
  assert.match(h.elements.hubComparePanelContent.innerHTML,/Расчёт остановлен/);
});
