'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const synthesis=require('./mayatnik-synthesis-pendulums.js');
const core=require('./mayatnik-core.js');
const empty=n=>new Int8Array(n).fill(-1);
const make=(options={},bits=[-1,0,1])=>synthesis.create({width:bits.length,height:1,sourceBits:bits,options:{sourceA:'source',sourceB:'memory',...options}});

test('normalizeOptions exposes defaults and validates UI patches without creating a field',()=>{
  assert.deepEqual(synthesis.normalizeOptions({}),synthesis.defaults);
  assert.deepEqual(synthesis.normalizeOptions(),synthesis.defaults);
  assert.equal(synthesis.normalizeOptions({delayB:3}).delayB,3);
  assert.equal(synthesis.normalizeOptions({sourceB:'feedback'}).sourceB,'feedback');
  assert.throws(()=>synthesis.normalizeOptions({delayB:17}));
});

// Independent original recurrence, with no calls to the production core.
function reference(mode,frame,width,height,anchor,depth){
  depth=Math.min(depth,height);
  const W=2*(depth+128)+1,center=depth+128,f=empty(W*depth);
  const offset=k=>mode==='left'?-k:mode==='right'?k:mode==='pendR'?(k%2?(k+1)/2:-k/2):(k%2?-(k+1)/2:k/2);
  for(let k=0;k<=(mode==='cone'?0:frame);k++){
    const vertices=mode==='pair'&&k?[center-k,center+k]:[center+(k?offset(k):0)];
    const original=vertices.map(a=>{if(f[a]<0)f[a]=1;return f[a];});
    for(const a of vertices)f[a]=1;
    for(let r=1;r<depth;r++)for(let c=0;c<W;c++){
      if(!vertices.some(a=>Math.abs(c-a)<=r&&(c-a-r)%2===0))continue;
      const i=r*W+c,left=c>0?f[i-W-1]:-1,right=c+1<W?f[i-W+1]:-1;
      f[i]=Number((f[i]===1)^(left===1)^(right===1));
    }
    if(depth>1)vertices.forEach((a,j)=>{f[a]=original[j];});
  }
  const out=empty(width*height);
  for(let y=0;y<depth;y++)for(let x=0;x<width;x++){
    const c=x-anchor+center;if(c>=0&&c<W)out[y*width+x]=f[y*W+c];
  }
  return out;
}

test('UMD loads with the actual browser lexical MAYATNIK and no CommonJS globals',()=>{
  const context=vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'mayatnik-core.js'),'utf8'),context);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'mayatnik-synthesis-pendulums.js'),'utf8'),context);
  assert.equal(vm.runInContext('MayatnikSynthesisPendulums.create({width:3,height:3}).a[1]',context),1);
});

test('all operations distinguish absent from zero on the full three-state truth table',()=>{
  const A=[-1,-1,-1,0,0,0,1,1,1],B=[-1,0,1,-1,0,1,-1,0,1];
  const expected={xor:[-1,0,1,0,0,1,1,1,0],or:[-1,0,1,0,0,1,1,1,1],
    and:[-1,-1,-1,-1,0,0,-1,0,1],subtract:[-1,-1,-1,0,0,0,1,1,0],
    mask:[-1,-1,-1,-1,-1,0,-1,-1,1],a:A,b:B};
  for(const [operation,want]of Object.entries(expected)){
    const e=make({operation},A);e.setMemory(B);assert.deepEqual([...e.output],want,operation);
  }
});

test('every generated source matches independent recurrence, including asymmetric crops and initial cone',()=>{
  for(const mode of ['pend','pendR','left','right','pair','cone']){
    for(const [width,height,anchor,depth]of [[11,9,0,16],[10,17,8,32],[35,32,17,32]]){
      const e=synthesis.create({width,height,anchor,options:{sourceA:mode,sourceB:'source',operation:'a',depth}});
      for(let t=0;t<=23;t++){
        assert.deepEqual(e.a,reference(mode,t,width,height,anchor,depth),`${mode} ${width} ${height} anchor${anchor} frame${t}`);
        if(t<23)e.step();
      }
    }
  }
});

test('crop edges cannot feed back into the generated cone',()=>{
  const width=5,height=16,anchor=0;
  const e=synthesis.create({width,height,anchor,options:{sourceA:'right',depth:16,operation:'a'}});
  for(let k=0;k<17;k++)e.step();
  const cropped=core.field(width,height,'empty');
  for(let k=0;k<=17;k++)core.cone(cropped,anchor+k,height);
  assert.notDeepEqual(e.a,cropped.val,'fixture must expose incorrect early cropping');
  assert.deepEqual(e.a,reference('right',17,width,height,anchor,16));
});

test('rates, phase, zero speed and cycle reset use exact local frame indices',()=>{
  for(const rate of [0,.5,1,1.5,2,3]){
    const e=synthesis.create({width:13,height:8,anchor:5,options:{sourceA:'pair',sourceB:'pendR',rateA:rate,rateB:rate,phaseB:125,depth:16}});
    for(let t=0;t<=132;t++){
      if([0,1,2,3,43,64,85,127,128,129,132].includes(t)){
        assert.deepEqual(e.a,reference('pair',Math.floor(t*rate)%128,13,8,5,16),`A ${rate} ${t}`);
        assert.deepEqual(e.b,reference('pendR',Math.floor(t*rate+125)%128,13,8,5,16),`B ${rate} ${t}`);
      }
      if(t<132)e.step();
    }
  }
});

test('B reflections, translation and inversion preserve empty cells',()=>{
  const bits=[-1,0,1,1,-1,0];
  const expected={identity:bits,mirrorX:[1,0,-1,0,-1,1],mirrorY:[1,-1,0,-1,0,1],rotate180:[0,-1,1,1,0,-1]};
  for(const [transformB,want]of Object.entries(expected)){
    const e=synthesis.create({width:3,height:2,sourceBits:bits,options:{sourceB:'source',transformB,operation:'b'}});
    assert.deepEqual([...e.output],want);
    e.configure({invertB:true});assert.deepEqual([...e.output],want.map(v=>v<0?-1:1-v));
    e.configure({shiftX:1,shiftY:1});
    const translated=empty(6);translated[4]=want[0]<0?-1:1-want[0];translated[5]=want[1]<0?-1:1-want[1];
    assert.deepEqual(e.output,translated);
  }
});

test('memory and input ownership survive source updates, reset and configuration',()=>{
  const input=Int8Array.from([1,0,-1]),e=make({operation:'b'},input);input.fill(0);
  assert.deepEqual([...e.output],[1,0,-1]);
  e.updateSource([0,1,1]);assert.deepEqual([...e.output],[1,0,-1]);assert.equal(e.tick,0);
  e.step();e.configure({rateB:2});assert.equal(e.tick,0);assert.deepEqual([...e.output],[1,0,-1]);
  e.setMemory();assert.deepEqual([...e.output],[0,1,1]);
  e.reset([1,1,0]);assert.deepEqual([...e.output],[0,1,1]);
});

test('trail keeps recent ones with age and expires without counting redraws',()=>{
  const e=make({operation:'a',history:'trail',trailLength:3},[1,-1,0]);
  e.step([0,1,-1]);assert.deepEqual([...e.output],[1,1,-1]);assert.deepEqual([...e.age],[1,0,0]);
  e.updateSource([0,0,-1]);e.updateSource([0,0,-1]);
  assert.equal(e.tick,1);assert.deepEqual([...e.output],[1,0,-1]);assert.equal(e.age[0],1);
  e.step([0,0,-1]);assert.equal(e.output[0],1);assert.equal(e.age[0],2);
  e.step([0,0,-1]);assert.equal(e.output[0],0);
  e.configure({trailLength:1});e.step([-1,-1,-1]);assert.deepEqual([...e.output],[-1,-1,-1]);
});

test('accumulation XOR includes each clocked frame once and replaces unclocked current frame',()=>{
  const e=make({operation:'a',history:'accumulate'},[1,0,-1]);
  e.step([1,-1,1]);assert.deepEqual([...e.output],[0,0,1]);
  e.updateSource([0,-1,0]);assert.deepEqual([...e.output],[1,0,0]);
  e.updateSource([0,-1,0]);assert.deepEqual([...e.output],[1,0,0]);assert.equal(e.tick,1);
  e.step([-1,-1,-1]);assert.deepEqual([...e.output],[1,0,0]);
  e.reset();assert.deepEqual([...e.output],[-1,-1,-1]);
});

test('feedback starts with captured source and reads only the previous clocked output',()=>{
  const e=make({sourceB:'feedback',operation:'xor'},[1,0,-1]);
  assert.deepEqual([...e.b],[1,0,-1]);assert.deepEqual([...e.output],[0,0,-1]);
  e.step();assert.deepEqual([...e.b],[0,0,-1]);assert.deepEqual([...e.output],[1,0,-1]);
  e.updateSource([0,1,1]);assert.deepEqual([...e.b],[0,0,-1]);assert.deepEqual([...e.output],[0,1,1]);
  e.updateSource([0,1,1]);assert.deepEqual([...e.b],[0,0,-1]);assert.equal(e.tick,1);
  e.step();assert.deepEqual([...e.b],[0,1,1]);assert.deepEqual([...e.output],[0,0,0]);
  e.configure({sourceA:'feedback',sourceB:'source',operation:'a'});
  assert.deepEqual([...e.a],[0,1,1]);
  e.reset([1,1,-1]);assert.deepEqual([...e.a],[1,1,-1]);
});

test('live B delay holds the initial frame and advances only on steps, before transforms',()=>{
  const e=make({sourceB:'source',operation:'b',delayB:2,transformB:'mirrorX',invertB:true},[1,0,-1]);
  const reflected=bits=>bits.slice().reverse().map(v=>v<0?-1:1-v);
  const frames=[[1,0,-1],[0,1,-1],[1,1,0],[-1,0,0],[0,0,1]];
  for(let t=0;t<frames.length;t++){
    if(t)e.step(frames[t]);
    assert.deepEqual([...e.b],reflected(frames[Math.max(0,t-2)]));
  }
  const before=[...e.b];e.updateSource([1,0,1]);e.updateSource([0,1,0]);
  assert.deepEqual([...e.b],before);assert.equal(e.tick,4);
  const held=make({sourceB:'source',operation:'b',delayB:1},[1,0,-1]);
  held.updateSource([0,1,1]);assert.deepEqual([...held.b],[1,0,-1]);
  held.step();assert.deepEqual([...held.b],[0,1,1]);
});

test('generated B delay is distinct from phase, and feedback with delay replays from JSON',()=>{
  const e=synthesis.create({width:9,height:8,options:{sourceB:'pair',operation:'b',phaseB:17,rateB:2,delayB:3}});
  for(let t=0;t<9;t++){
    assert.deepEqual(e.b,reference('pair',17+Math.max(0,t-3)*2,9,8,4,64));e.step();
  }
  for(const history of ['none','trail','accumulate']){
    const a=synthesis.create({width:9,height:8,options:{sourceA:'pend',sourceB:'feedback',delayB:4,history,operation:'xor'}});
    for(let i=0;i<12;i++)a.step();
    const b=synthesis.create({width:9,height:8});b.restore(JSON.parse(JSON.stringify(a.snapshot())));
    assert.deepEqual(a.snapshot(),b.snapshot());
    for(let i=0;i<32;i++){a.step();b.step();assert.deepEqual(a.output,b.output);}
  }
});

test('delay/feedback snapshots and memory limits reject invalid input atomically',()=>{
  const e=make({sourceB:'feedback',delayB:2});e.step();const saved=e.snapshot();
  for(const mutate of [s=>{s.feedback[0]=2;},s=>{s.delaySeed=[];},s=>{s.delayQueue=[];},s=>{s.delayQueue[0][0]=-2;},s=>{s.options.delayB=17;}]){
    const bad=structuredClone(saved);mutate(bad);assert.throws(()=>e.restore(bad));assert.deepEqual(e.snapshot(),saved);
  }
  assert.throws(()=>synthesis.create({width:2048,height:512,options:{history:'trail',trailLength:64}}),/memory limit/);
  const large=synthesis.create({width:1024,height:256});const before=large.options;
  assert.throws(()=>large.configure({history:'trail',trailLength:64,delayB:16}),/memory limit/);
  assert.deepEqual(large.options,before);assert.equal(large.tick,0);
});

test('JSON snapshot restores outputs, history, memory, change map and future replay',()=>{
  for(const history of ['none','trail','accumulate']){
    const e=synthesis.create({width:17,height:12,anchor:4,options:{sourceA:'pend',sourceB:'pair',phaseB:17,rateB:.5,history}});
    for(let t=0;t<10;t++)e.step();
    const saved=JSON.parse(JSON.stringify(e.snapshot()));
    const copy=synthesis.create({width:17,height:12,anchor:4});copy.restore(saved);
    assert.deepEqual(copy.snapshot(),saved);assert.deepEqual(copy.output,e.output);assert.deepEqual(copy.changed,e.changed);assert.deepEqual(copy.age,e.age);
    for(let t=0;t<130;t++){e.step();copy.step();assert.deepEqual(copy.output,e.output);}
    saved.source.fill(1);assert.notDeepEqual(copy.snapshot().source,saved.source);
  }
});

test('malformed snapshots and invalid updates never mutate engine state',()=>{
  const e=make({history:'accumulate'});e.step();const before=e.snapshot();
  const mutations=[s=>{s.version=2;},s=>{s.width++;},s=>{s.anchor=-1;},s=>{s.tick=.5;},s=>{s.tick=-1;},
    s=>{s.options.depth=17;},s=>{delete s.options.depth;},s=>{s.source[0]=2;},s=>{s.source.pop();},
    s=>{s.memory=null;},s=>{s.prefix[1]=NaN;},s=>{s.trail=[s.source];},s=>{s.changed[0]=-1;}];
  for(const mutate of mutations){const bad=structuredClone(before);mutate(bad);assert.throws(()=>e.restore(bad));assert.deepEqual(e.snapshot(),before);}
  for(const act of [()=>e.step([2,0,1]),()=>e.updateSource([]),()=>e.setMemory([null,0,1]),()=>e.configure({phaseB:128}),()=>e.reset([1])]){
    assert.throws(act);assert.deepEqual(e.snapshot(),before);
  }
});

test('all recipe options produce bounded valid fields and shared core remains untouched',()=>{
  assert.ok(synthesis.recipes.length>=8);
  for(const recipe of synthesis.recipes){
    const e=synthesis.create({width:39,height:16,sourceBits:new Int8Array(39*16).fill(1),options:recipe.options});
    for(let i=0;i<4;i++)e.step();
    assert.equal(e.output.length,39*16);assert.ok(e.output.every(v=>v===-1||v===0||v===1));
    assert.equal(e.stats.ones+e.stats.zeros+e.stats.empty,e.output.length);
  }
});
