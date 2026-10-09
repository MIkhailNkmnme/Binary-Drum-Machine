// Collision semantics: real impacts paint the draft; slits and open cut-outs do not.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../zz-ball.js'), 'utf8');
const pi = Math.PI;
function experiment() {
  const hits = [], lost = [], writes = [], context = {
    window: {zzBallFillMark: cells => hits.push(...cells), zzBallLostRecord: row => lost.push(row)},
    Z: {rows:['1','11'],lane:0,coneSpinMode:'bit', coneAutoSp:10, coneBallMult:'1', coneBallBatch:false},
    coneGeom: {fill:true}, CONE_MAX:256, coneCutOn:()=>false, coneFlat:()=>true,
    coneSlitMode:()=>'all', coneHalfOn:()=>false, coneQuadOn:()=>false,
    save(){}, renderRows(){}, renderCone(){},
    cutPrevMode:()=>false, coneFreeOn:()=>false, coneSlitHalf:()=>.05, fillDraft:()=>context.Z.fillCells || '..',
    coneRingFeat:i=>({n:i===0?1:2,P:i===0?1:2,step:i===0?2*pi:pi,x0:0,xc:0,cut:false}),
    document: {readyState:'loading', addEventListener(){}, getElementById(){return null;}}
  };
  vm.createContext(context);
  const uiSource = fs.readFileSync(path.join(__dirname, '../zz-ui.js'), 'utf8');
  vm.runInContext(uiSource.slice(uiSource.indexOf('  window.zzBallCenterInit ='), uiSource.indexOf('  window.zzBallFillMark =')), context);
  const bitWrite = context.window.zzBallBitWrite;
  context.window.zzBallBitWrite = list => { writes.push(...list); return bitWrite(list); };
  vm.runInContext(source.replace('  if (document.readyState === "loading")', `
    window.impactTest = {
      start(S, {mark = true, loss = false, mode = 1, bounce = false, zero = false, route = 'out', omega = Math.PI / 3, point = {k:1,raw:0,r:1.5,label:'impact'}} = {}) {
        Z.coneBallZeroBounce = zero;
        Z.coneBallSpeedMode = mode; Z.coneBallImpact = bounce ? 'bounce' : 'stick'; rate = () => [omega, 0, 0];
        enabled = true; newRun(); markRun = mark; lossRun = loss; pendingMarks = [];
        begin(S, true, true, {point, route, period:6, speed:1, auto:route === 'in'});
      },
      step(dt, A, B = A) { advance(dt, A, B); flushMarks(); return ballInfo(F); },
      next(S) { begin(S, false, true, {point:{k:1,raw:0,r:1.5,label:'repeat'}, route:'out', period:6, speed:1, auto:false}); },
      stuck(S) { return stuck.map(group => ({...group,positions:group.samples.map(sample=>stuckPosition(S,group,sample))})); },
      stats() { return window.zzBallRunStats(); },
      clear() { window.zzBallClearRun(); },
      starts(S) { return outerStarts(S); },
      singleBitSnapshot(mode='through') { Z.rows=['1']; Z.coneBallCenter=mode; return snapshot(); },
      closed() { return window.zzBallCenterState().count; },
      initCenter() { initCenter(); return Z.rows[0]; },
      rows() { return Z.rows.slice(); },
      group(S, points, bounce=false) {
        enabled=true; Z.coneBallSpeedMode=1; Z.coneBallImpact=bounce?'bounce':'stick'; newRun(); balls=[]; markRun=false; lossRun=true;
        for(const point of points) { begin(S,false,true,{point,route:'in',period:6,speed:1,auto:false}); balls.push(F); }
      },
      groupStep(dt, A, B=A) { advanceInwardGroup(dt,A,B); F=balls[0]; flushMarks(); return balls.map(ballInfo); },
      simultaneous(dt,A,B=A) { const event = advanceInwardGroup(dt,A,B,true); flushMarks(); return {event, balls:balls.map(ballInfo)}; },
      promote(S) { restartRun(S); return ballInfo(F); }
    };
    if (document.readyState === "loading")`), context);
  return {api:context.window.impactTest, hits, lost, writes};
}
function geometry(phase, merged = false) {
  const cells = [{lo:-pi/2,hi:0,bit:0}, {lo:0,hi:pi/2,bit:1}];
  return {shape:'impact',spin:0,rings:[
    {ri:0,ro:1,phase:0,blocks:[{lo:0,hi:pi,bit:0}],tol:.05},
    {ri:1,ro:2,phase:0,blocks:[{lo:0,hi:pi,bit:0}],tol:.05},
    {ri:2,ro:3,phase,blocks:merged ? [{lo:-pi/2,hi:pi/2,bit:0,bitHi:1}] : cells,
      cells,tol:.05,fill:true}
  ]};
}
test('new inward experiment empties K1 once; an outside impact writes 1 into its actual bit', () => {
  const e=experiment(), S=geometry(0);
  assert.equal(e.api.initCenter(),'0');
  e.api.start(S,{route:'in',loss:true,mark:false,point:{k:1,raw:pi/4,r:1.5}});
  e.api.step(.6,S);
  assert.deepEqual(e.writes.map(h=>[h.k,h.bit,h.value]),[[0,0,'1']]);
  assert.equal(e.api.rows()[0],'1'); assert.equal(e.api.stats().rings[0].marks,1);
  assert.equal(e.api.initCenter(),'1','another launch must preserve the experiment');
  e.api.clear(); assert.equal(e.api.initCenter(),'0');
});
test('inward bounce writes 1 outside, then optional 0 on the outer arc from inside, never in its slit', () => {
  for(const zero of [false,true]) for(const phase of [0,pi/4]) for(const dt of [.017,1.6]) {
    const e=experiment(), S=geometry(phase); e.api.initCenter();
    e.api.start(S,{route:'in',loss:true,mark:false,bounce:true,zero,point:{k:1,raw:pi/4,r:1.5}});
    for(let t=0;t<1.6-1e-12;t+=dt) e.api.step(Math.min(dt,1.6-t),S);
    const expected=[[0,0,'1']]; if(zero && phase===0) expected.push([2,1,'0']);
    assert.deepEqual(e.writes.map(h=>[h.k,h.bit,h.value]),expected);
    assert.equal(e.api.stats().rings[2]?.zeros || 0,zero && phase===0 ? 1 : 0);
  }
});
test('closed zero ring keeps its bits until an outside hit paints only the struck bit', () => {
  const e=experiment(), S=geometry(0); e.api.initCenter();
  e.api.group(S,[{k:0,raw:0,r:.5}]); e.api.groupStep(1,S);
  assert.equal(e.api.closed(),1); assert.equal(e.api.rows()[0],'0');
  e.api.group(S,[{k:1,raw:pi/4,r:1.5}]); e.api.groupStep(1,S);
  assert.equal(e.api.closed(),2,'writing 1 must not invalidate closed geometry');
  assert.equal(e.api.rows()[0],'1'); assert.equal(e.api.rows()[1],'11');
});
test('simultaneous contacts stop at the exact shared event time and can continue', () => {
  const e=experiment(), S=geometry(0);
  e.api.group(S,[{k:1,raw:pi/4,r:1.5},{k:1,raw:pi/3,r:1.5}],true);
  const result=e.api.simultaneous(4,S);
  assert.equal(result.event.fraction,.125);
  assert.deepEqual(Array.from(result.event.events,e=>e.ring),['К1','К1']);
  for(const b of result.balls) { assert.equal(b.elapsed,.5); assert.equal(b.q,1); assert.equal(b.stage,'out'); }
  e.api.groupStep(.25,S); assert.equal(e.api.stats().rings[0].hits,2);
});
test('expanding closed centre captures another ball inside it and pauses at the same instant', () => {
  const e=experiment(), S=geometry(0);
  e.api.group(S,[{k:0,raw:0,r:.2},{k:0,raw:0,r:.7}]);
  const result=e.api.simultaneous(2,S);
  assert.equal(result.event.fraction,.1); assert.equal(result.event.events.length,2);
  assert.equal(e.api.closed(),1); assert.equal(e.api.stats().reachedCenter,2);
  for(const b of result.balls) assert.equal(b.elapsed,.2);
});
test('draft impact paints actual cell 0 and counts its absorption exactly once', () => {
  for (const loss of [false,true]) for (const dt of [.017,.6,2]) {
    const e = experiment(), S = geometry(pi/4); e.api.start(S,{loss});
    let b; for (let t=0;t<3;t+=dt) b=e.api.step(dt,S);
    assert.equal(b.stage,'lost'); assert.equal(b.lostAt,2); assert.equal(b.marked,0);
    assert.deepEqual(e.hits,[0]); assert.deepEqual(e.lost,[2]);
  }
});
test('passing a slit, including its width tolerance, never paints', () => {
  for (const phase of [0,.02,-.02]) {
    const e=experiment(), S=geometry(phase); e.api.start(S,{loss:true});
    assert.equal(e.api.step(2,S).stage,'done');
    assert.deepEqual(e.hits,[]); assert.deepEqual(e.lost,[]);
  }
});
test('rotating draft is hit at contact time, independent of frame size', () => {
  for(const dt of [.017,.6,2]) {
    const e=experiment(), pose=t=>geometry(pi*t/2); e.api.start(pose(0));
    let b; for(let t=0;t<3;t+=dt) b=e.api.step(dt,pose(t),pose(t+dt));
    assert.equal(b.stage,'lost'); assert.equal(b.marked,0);
    assert.deepEqual(e.hits,[0]); assert.deepEqual(e.lost,[2]);
    assert.ok(Math.abs(b.elapsed-.5)<1e-8,'impact time must be exactly the radial arrival');
  }
});
test('open cut-out passes without painting or absorption', () => {
  const e=experiment(), S=geometry(-3*pi/4); e.api.start(S,{loss:true});
  assert.equal(e.api.step(2,S).stage,'done');
  assert.deepEqual(e.hits,[]); assert.deepEqual(e.lost,[]);
});
test('merged slit-only wall retains interior bit index, including across zero', () => {
  for (const [phase,bit] of [[-pi/4,1],[pi/4,0],[0,1]]) {
    const e=experiment(), S=geometry(phase,true); e.api.start(S,{loss:true});
    assert.equal(e.api.step(2,S).stage,'lost');
    assert.deepEqual(e.hits,[bit]); assert.deepEqual(e.lost,[2]);
  }
});
test('ordinary loss without draft marking counts impact but does not paint', () => {
  const e=experiment(), S=geometry(pi/4); e.api.start(S,{mark:false,loss:true});
  assert.equal(e.api.step(2,S).stage,'lost');
  assert.deepEqual(e.hits,[]); assert.deepEqual(e.lost,[2]);
});
test('bounce paints contact cell and returns along the original edge without absorption', () => {
  const e=experiment(), S=geometry(pi/4); e.api.start(S,{loss:true,bounce:true});
  const b=e.api.step(.6,S);
  assert.equal(b.stage,'in'); assert.equal(b.ring,1); assert.equal(b.edge,0);
  assert.ok(Math.abs(b.q-1.9)<1e-10); assert.equal(b.marked,0);
  assert.deepEqual(e.hits,[0]); assert.deepEqual(e.lost,[]); assert.equal(e.api.stuck(S).length,0);
  assert.equal(e.api.stats().rings[2].bounces,1); assert.equal(e.api.stats().rings[2].hits,1);
});
test('fixed speed modes use the first ring full turn, support reverse, and disable auto tuning', () => {
  for(const mode of [2,3]) for(const sign of [-1,1]) {
    const e=experiment(), S=geometry(0);
    e.api.start(S,{mode,omega:sign*pi/3,mark:false,point:{k:0,raw:0,r:0,label:'centre'}});
    const b=e.api.step(mode===2?6:3,S);
    assert.ok(Math.abs(b.speed-(mode===2?1/6:1/3))<1e-10);
    assert.equal(b.auto,false); assert.equal(b.tuned,0); assert.equal(b.ring,1);
    assert.ok(Math.abs(b.q-1)<1e-10,'one radial edge per full/half first-ring turn');
  }
});
test('inward launch stops exactly at centre and reports the result once', () => {
  const e=experiment(), S=geometry(0);
  e.api.start(S,{route:'in',loss:true,mark:false,point:{k:2,raw:0,r:3,label:'outer'}});
  const b=e.api.step(7,S);
  assert.equal(b.stage,'done'); assert.equal(b.q,0); assert.equal(b.ring,0);
  assert.ok(Math.abs(b.elapsed-3)<1e-10,'partial final frame ends at centre');
  assert.equal(e.api.stats().reachedCenter,1); assert.equal(e.api.stats().exited,0);
  e.api.step(1,S); assert.equal(e.api.stats().reachedCenter,1);
});
test('inward impacts affect the inner target ring and bounce outward when selected', () => {
  for(const bounce of [false,true]) {
    const e=experiment(), S=geometry(0); S.rings[1].phase=-pi/4;
    e.api.start(S,{route:'in',loss:false,mark:false,bounce,point:{k:2,raw:0,r:3,label:'outer'}});
    const b=e.api.step(1.1,S);
    assert.equal(b.stage,bounce?'out':'lost'); assert.deepEqual(e.hits,[]);
    assert.equal(b.auto,false,'the inward experiment must measure real impacts rather than tune them away');
    if(bounce){ assert.ok(Math.abs(b.q-2.1)<1e-10); assert.equal(e.api.stats().rings[1].bounces,1); }
    else { assert.deepEqual(e.lost,[1]); assert.equal(e.api.stuck(S)[0].k,1); }
    assert.equal(e.api.stats().reachedCenter,0);
  }
});
test('all outer slit starts are distinct, including the full-circle seam', () => {
  const e=experiment(), S=geometry(0); S.rings[2].blocks=[{lo:-pi/2,hi:pi/2,bit:0},{lo:pi/2,hi:3*pi/2,bit:1}];
  const starts=e.api.starts(S); assert.equal(starts.length,2);
  assert.ok(starts.every(p=>p.k===2 && p.r===3));
});
test('one-bit first ring has one real slit; the opposite route and both half-circles are solid', () => {
  for (const mode of ['through','back','flip']) for (const a of [-pi/2+.02,pi/2,-pi/4,3*pi/4]) {
    const e=experiment(), S=e.api.singleBitSnapshot(mode), slit=Math.abs(a+pi/2)<.05;
    e.api.start(S,{route:'in',mark:false,point:{k:1,raw:a,r:2,label:'outer'}});
    const b=e.api.step(3,S);
    assert.equal(b.stage,slit?'done':'lost',mode+' at '+a);
    assert.equal(e.api.stats().reachedCenter,slit?1:0);
    if(!slit) {
      const p=e.api.stuck(S)[0].positions[0];
      assert.equal(p.q,1,'inward hit stays on the outer rim of K1');
      assert.ok(Math.abs(Math.atan2(Math.sin(p.a-a),Math.cos(p.a-a)))<1e-10);
    }
  }
});
test('one-bit first ring reflects an inward miss without teleporting inside it', () => {
  const e=experiment(), S=e.api.singleBitSnapshot();
  e.api.start(S,{route:'in',mark:false,bounce:true,point:{k:1,raw:pi/2,r:2,label:'opposite'}});
  const b=e.api.step(1.1,S);
  assert.equal(b.stage,'out'); assert.ok(Math.abs(b.q-1.1)<1e-10);
  assert.equal(e.api.stuck(S).length,0); assert.equal(e.api.stats().reachedCenter,0);
  assert.equal(e.api.stats().rings[0].bounces,1);
});
test('centre closes K1, the next inward hit closes K2, and reset reopens every slit', () => {
  for(const bounce of [false,true]) {
    const e=experiment(), S=e.api.singleBitSnapshot();
    e.api.group(S,[{k:1,raw:-pi/2,r:2,label:'real slit'}],bounce);
    assert.equal(e.api.groupStep(3,S)[0].stage,'done'); assert.equal(e.api.closed(),1);
    e.api.group(S,[{k:1,raw:0,r:2,label:'miss'}, {k:1,raw:pi,r:2,label:'opposite miss'}],bounce);
    const second=e.api.groupStep(3,S);
    assert.ok(second.every(b=>b.stage==='done'&&b.q===1));
    assert.equal(e.api.closed(),2); assert.equal(e.api.stats().reachedCenter,2);
    assert.equal(e.api.stats().rings[0].hits,2); assert.equal(e.api.stats().rings[0].bounces,0);
    assert.equal(e.api.starts(S).length,0,'closed outer ring has no new launch slit');
    e.api.clear(); assert.equal(e.api.closed(),0); assert.equal(e.api.starts(S).length,2);
  }
});
test('inward group closure follows event time rather than ball order or frame size', () => {
  for(const reverse of [false,true]) for(const dt of [.07,4]) {
    const e=experiment(), S=e.api.singleBitSnapshot();
    // B hits K1 after A has reached its centre, even when B is first in the array.
    const points=[{k:0,raw:-pi/2,r:.5,label:'A'}, {k:1,raw:0,r:2,label:'B'}];
    if(reverse) points.reverse(); e.api.group(S,points);
    let result; for(let t=0;t<4;t+=dt) result=e.api.groupStep(dt,S);
    assert.ok(result.every(b=>b.stage==='done')); assert.equal(e.api.closed(),2);
    assert.equal(e.api.stats().reachedCenter,2);
    assert.deepEqual(e.lost,[],'B reaches the expanded centre instead of sticking or bouncing');
  }
});
test('the closed centre expands across later rings, one ring for each inward arrival', () => {
  const e=experiment(), S=geometry(0);
  e.api.group(S,[{k:0,raw:0,r:.1,label:'seed'}]); e.api.groupStep(1,S); assert.equal(e.api.closed(),1);
  e.api.group(S,[{k:2,raw:0,r:3,label:'through K2'}]); e.api.groupStep(4,S); assert.equal(e.api.closed(),2);
  e.api.group(S,[{k:2,raw:pi/4,r:3,label:'hit closed K2'}]);
  assert.equal(e.api.groupStep(4,S)[0].q,2); assert.equal(e.api.closed(),3);
  assert.equal(e.api.stats().reachedCenter,1);
});
test('promotion preserves a reflected ball travelling back on an unchanged inner ring', () => {
  const e=experiment(), S=geometry(pi/4); e.api.start(S,{bounce:true,loss:true});
  const before=e.api.step(.6,S), grown={...geometry(pi/4),shape:'grown'};
  grown.rings[2].fill=false; grown.rings.push({...grown.rings[2],ri:3,ro:4,fill:true});
  const after=e.api.promote(grown);
  assert.equal(after.stage,'in'); assert.equal(after.ring,before.ring); assert.equal(after.q,before.q);
  assert.equal(e.api.stats().launched,1); assert.equal(e.api.stats().removed,0);
});
test('trapped ball stays at its exact contact and follows that cell after rotation/promotion', () => {
  const e=experiment(), S=geometry(pi/4,true); e.api.start(S); e.api.step(2,S);
  const group=e.api.stuck(S)[0], p=group.positions[0];
  assert.equal(group.k,2); assert.equal(group.bit,0); assert.equal(group.count,1);
  assert.equal(p.q,2,'outward hit stays on the inner rim of the target');
  assert.ok(Math.abs(p.a)<1e-10,'contact angle is not redistributed inside the bit');
  assert.ok(p.a>S.rings[2].cells[0].lo+S.rings[2].phase && p.a<S.rings[2].cells[0].hi+S.rings[2].phase);
  const rotated=geometry(pi/4+pi/3); rotated.rings[2].fill=false;
  assert.ok(Math.abs(e.api.stuck(rotated)[0].positions[0].a-p.a-pi/3)<1e-10);
  assert.equal(e.api.stuck(rotated)[0].count,1,'promotion retains the trapped ball');
  e.api.clear(); assert.equal(e.api.stuck(S).length,0); assert.equal(e.api.stats(),null);
});
test('current launch counts every impact after 64 moving slots and retains dense-cell total', () => {
  const e=experiment(), S=geometry(pi/4); e.api.start(S);
  for(let n=0;n<100;n++) { if(n)e.api.next(S); e.api.step(2,S); }
  const stats=e.api.stats(), group=e.api.stuck(S)[0];
  assert.equal(stats.launched,100); assert.equal(stats.rings[2].lost,100);
  assert.equal(stats.rings[1].entered,100); assert.equal(stats.rings[2].moving,0);
  assert.equal(group.count,100); assert.equal(group.samples.length,64);
  e.api.clear(); assert.equal(e.api.stats(),null);
  e.api.start(S); assert.equal(e.api.stats().launched,1); assert.equal(e.api.stuck(S).length,0);
});
test('intermediate ring loss belongs to that row and cannot paint the draft', () => {
  const e=experiment(), S=geometry(0);
  S.rings[1].phase=-pi/4;
  e.api.start(S,{loss:true,point:{k:0,raw:0,r:.5,label:'centre'}});
  assert.equal(e.api.step(2,S).stage,'lost');
  assert.deepEqual(e.hits,[]); assert.deepEqual(e.lost,[1]);
});
test('row totals survive more than 64 deaths and promotion of the draft to a row', () => {
  const ui=fs.readFileSync(path.join(__dirname,'../zz-ui.js'),'utf8');
  const start=ui.indexOf('function rowBallLostCounts('), end=ui.indexOf('function rowNumDigits(',start);
  assert.ok(start>0 && end>start);
  let badge={textContent:''}, renders=0;
  const context={Z:{lane:0,rows:['1']},window:{},document:{querySelectorAll(){return [badge];}},
    renderRows(){renders++;},save(){}};
  vm.createContext(context); vm.runInContext(ui.slice(start,end),context);
  context.window.zzBallLostReset();
  for(let n=0;n<75;n++) context.window.zzBallLostRecord(1);
  assert.equal(badge.textContent,'✕75'); assert.equal(context.window.zzBallLostTotal(),75);
  context.Z.rows.push('11'); // Former draft is now row 2; the next draft is row 3.
  context.window.zzBallLostRecord(2);
  assert.equal(context.Z.coneBallLost.counts[1],75);
  assert.equal(context.Z.coneBallLost.counts[2],1);
  assert.equal(context.window.zzBallLostTotal(),76);
  assert.equal(renders,1,'event updates must not rebuild the row layout');
  context.window.zzBallLostReset();
  assert.equal(context.window.zzBallLostTotal(),0);
});
