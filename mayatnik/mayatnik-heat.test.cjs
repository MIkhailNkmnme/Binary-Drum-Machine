const test=require('node:test');
const assert=require('node:assert/strict');
const heat=require('./mayatnik-heat.js');

test('paused heat cools to exact blue/ice white; untouched parity cells cool globally',()=>{
  let time=0;const tracker=heat.create({now:()=>time}),field={};
  const values=new Int8Array([0,1,-1,0]);
  const observe=frame=>tracker.observe({values,field,frame,context:'a'});
  observe(0);assert.equal(tracker.colour(0,0),heat.cold[0]);
  time=100;values[0]=1;values[1]=0;observe(1);
  const hot=tracker.colour(1,0);assert.notEqual(hot,heat.cold[0]);
  time=1100;values[3]=1;observe(2);
  const half=tracker.colour(1,0);assert.notEqual(half,hot);assert.notEqual(half,heat.cold[0]);
  time=2100;assert.equal(tracker.colour(1,0),heat.cold[0]);assert.equal(tracker.colour(0,1),heat.cold[1]);
  assert.equal(tracker.colour(2,-1),null);assert.equal(tracker.hasWarm(),true);
  time=3100;assert.equal(tracker.colour(3,1),heat.cold[1]);assert.equal(tracker.hasWarm(),false);
  assert.notEqual(heat.cold[0],heat.cold[1]);
});

test('same-frame renders and paints never warm or refresh heat',()=>{
  let time=0;const tracker=heat.create({now:()=>time}),field={},values=new Int8Array([0]);
  const observe=frame=>tracker.observe({values,field,frame,context:'a'});
  observe(0);values[0]=1;observe(0);assert.equal(tracker.hasWarm(),false);
  time=100;values[0]=0;observe(1);assert.equal(tracker.hasWarm(),true);
  for(time=200;time<=2000;time+=100){observe(1);}
  assert.equal(tracker.colour(0,0),heat.cold[0]);assert.equal(tracker.hasWarm(),false);
  time=2200;observe(2);assert.equal(tracker.hasWarm(),false);
});

test('field, parity context, reverse, large jumps and explicit reset clear history',()=>{
  for(const reset of ['field','context','reverse','jump','reset']){
    let time=0;const tracker=heat.create({now:()=>time}),values=new Int8Array([0]);
    const state={values,field:{},frame:10,context:'a'};
    tracker.observe(state);time=1;values[0]=1;state.frame++;tracker.observe(state);
    assert.equal(tracker.hasWarm(),true);
    if(reset==='reset')tracker.reset();
    if(reset==='field')state.field={};if(reset==='context')state.context='b';
    if(reset==='reverse')state.frame--;if(reset==='jump')state.frame+=65;
    tracker.observe(state);assert.equal(tracker.hasWarm(),false,reset);
  }
});

function schedulerHarness(){
  let time=0,enabled=true,visible=true,draws=0,id=0;const timers=new Map();
  const scheduler=heat.createScheduler({setTimer:fn=>{timers.set(++id,fn);return id;},clearTimer:id=>timers.delete(id),
    redraw:()=>draws++,isEnabled:()=>enabled,isVisible:()=>visible,hasWarm:()=>time<2000});
  return {scheduler,timers,get draws(){return draws;},set time(v){time=v;},set enabled(v){enabled=v;},set visible(v){visible=v;},
    tick(){const [id,fn]=timers.entries().next().value;timers.delete(id);fn();}};
}
test('bounded cooling scheduler stops after cold and cancels on off/hidden/dispose',()=>{
  const h=schedulerHarness();h.scheduler.request();h.scheduler.request();assert.equal(h.timers.size,1);
  h.time=1000;h.tick();assert.equal(h.draws,1);assert.equal(h.timers.size,1);
  h.time=2000;h.tick();assert.equal(h.draws,2);assert.equal(h.timers.size,0);
  h.time=0;h.scheduler.request();h.enabled=false;h.scheduler.request();assert.equal(h.timers.size,0);
  h.enabled=true;h.scheduler.request();h.visible=false;h.scheduler.visibility();assert.equal(h.timers.size,0);
  h.time=3000;h.visible=true;h.scheduler.visibility();assert.equal(h.draws,3);assert.equal(h.timers.size,0);
  h.time=0;h.scheduler.request();h.scheduler.dispose();assert.equal(h.timers.size,0);
  h.scheduler.request();h.scheduler.visibility();assert.equal(h.draws,3);assert.equal(h.timers.size,0);
});

test('render crossing expiry receives one final cold repaint',()=>{
  let time=1900,callback,draws=0;
  const scheduler=heat.createScheduler({setTimer:fn=>{callback=fn;return 1;},clearTimer:()=>{},
    isEnabled:()=>true,isVisible:()=>true,hasWarm:()=>time<2000,
    redraw(){draws++;time+=150;}});
  scheduler.request();callback();assert.equal(draws,2);
});
