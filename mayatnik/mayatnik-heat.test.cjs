const test=require('node:test');
const assert=require('node:assert/strict');
const heat=require('./mayatnik-heat.js');
function harness(bits=[0]){
  const tracker=heat.create(),values=new Int8Array(bits),state={values,field:{},frame:0,context:'a'};
  return {tracker,values,state,observe(frame=state.frame){state.frame=frame;tracker.observe(state);}};
}
test('frame changes add one, unchanged frames subtract one; levels saturate at 0 and 5',()=>{
  const h=harness();h.observe();assert.equal(h.tracker.level(0),0);
  const colours=[];
  for(let frame=1;frame<=8;frame++){
    h.values[0]^=1;h.observe(frame);assert.equal(h.tracker.level(0),Math.min(frame,5));
    colours.push(h.tracker.colour(0,h.values[0]));
  }
  assert.equal(new Set(colours.slice(0,5)).size,5);assert.equal(colours[4],colours[7]);assert.equal(h.tracker.hasWarm(),true);
  for(let frame=9;frame<=15;frame++){h.observe(frame);assert.equal(h.tracker.level(0),Math.max(0,13-frame));}
  assert.equal(h.tracker.colour(0,0),heat.cold[0]);assert.equal(h.tracker.hasWarm(),false);assert.notEqual(heat.cold[0],heat.cold[1]);
});
test('pause and repeated renders preserve heat regardless of elapsed time',()=>{
  const h=harness();h.observe();h.values[0]=1;h.observe(1);const colour=h.tracker.colour(0,1);
  for(let n=0;n<50;n++){h.observe(1);assert.equal(h.tracker.level(0),1);assert.equal(h.tracker.colour(0,1,1e12),colour);}
  assert.equal(h.tracker.hasWarm(),true);
});
test('same-frame paint is only a baseline, never a second model observation',()=>{
  const h=harness();h.observe();h.values[0]=1;h.observe(0);assert.equal(h.tracker.level(0),0);
  h.observe(1);assert.equal(h.tracker.level(0),0);
  h.values[0]=0;h.observe(2);assert.equal(h.tracker.level(0),1);
  h.values[0]=1;h.observe(2);assert.equal(h.tracker.level(0),1);h.observe(3);assert.equal(h.tracker.level(0),0);
});
test('field/context/size, reverse, skipped frame and reset start cold',()=>{
  for(const change of ['field','context','size','reverse','jump','reset']){
    const h=harness();h.observe(10);h.values[0]=1;h.observe(11);assert.equal(h.tracker.hasWarm(),true);
    if(change==='field')h.state.field={};if(change==='context')h.state.context='b';
    if(change==='size')h.state.values=new Int8Array([1,0]);if(change==='reverse')h.state.frame=10;
    if(change==='jump')h.state.frame=13;if(change==='reset')h.tracker.reset();
    h.observe();assert.equal(h.tracker.level(0),0,change);assert.equal(h.tracker.hasWarm(),false,change);
    h.state.values[0]=0;h.observe(h.state.frame+1);assert.equal(h.tracker.level(0),1,change);
  }
});
test('empty/newly occupied cells stay cold and disappearing cells discard heat',()=>{
  const h=harness([-1,0]);h.observe();h.values.set([1,1]);h.observe(1);
  assert.equal(h.tracker.level(0),0);assert.equal(h.tracker.level(1),1);
  h.values.set([0,-1]);h.observe(2);assert.equal(h.tracker.level(0),1);assert.equal(h.tracker.level(1),0);assert.equal(h.tracker.colour(1,-1),null);
  h.values.set([-1,-1]);h.observe(3);assert.equal(h.tracker.hasWarm(),false);
});
test('pure selection covers all/one/zero and alternation beginning with ones at frame #1',()=>{
  for(const bit of [0,1])assert.equal(heat.appliesTo(bit,'all',4,7),true);
  for(const bit of [-1,2,undefined])assert.equal(heat.appliesTo(bit,'all',1,1),false);
  for(const mode of ['one','zero'])for(const bit of [0,1])assert.equal(heat.appliesTo(bit,mode,3,123),bit===(mode==='one'?1:0));
  for(const period of [1,2,7,64])for(let frame=1;frame<=period*4;frame++){
    const selected=Math.floor((frame-1)/period)%2===0?1:0;
    assert.equal(heat.selectedBit('alternate',period,frame),selected);
    assert.equal(heat.appliesTo(selected,'alternate',period,frame),true);assert.equal(heat.appliesTo(1-selected,'alternate',period,frame),false);
  }
  assert.equal(heat.selectedBit('all',1,1),null);assert.equal(heat.selectedBit('alternate',1,0),1);
});
test('alternate period is an integer clamped to 1..64 with safe invalid defaults',()=>{
  for(const period of [-9,0,NaN,Infinity,undefined])assert.equal(heat.selectedBit('alternate',period,2),0);
  assert.equal(heat.selectedBit('alternate',2.9,3),0);assert.equal(heat.selectedBit('alternate',100,64),1);
  assert.equal(heat.selectedBit('alternate',100,65),0);assert.equal(heat.selectedBit('alternate','3',4),0);
  for(const frame of [NaN,Infinity,undefined,-9])assert.equal(heat.selectedBit('alternate',2,frame),1);
});
test('no timer scheduler remains',()=>assert.equal(heat.createScheduler,undefined));
