const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../zz-ball.js'), 'utf8');
const context = {
  window: {}, Z: { coneSpinMode: 'bit', coneAutoSp: 10, coneBallMult: '1' },
  document: { readyState: 'loading', addEventListener() {}, getElementById() { return null; } }
};
vm.createContext(context);
vm.runInContext(source.replace('  if (document.readyState === "loading")', `
  window.outerTest = { movingGroup,
    start(S, point, speed, loop) {
      enabled = true; Z.coneBallArc = loop;
      begin(S, true, true, {point, route:'out', period:6, speed});
    },
    step(dt, A, B) { advance(dt, A, B); return ballInfo(F); },
    info() { return ballInfo(F); }
  };
  if (document.readyState === "loading")`), context);
const test = context.window.outerTest, pi = Math.PI;
const geometry = (count, direction = 1) => ({ shape: 'outer-' + count, spin: 0,
  rings: Array.from({length:count}, (_,k) => ({ri:k,ro:k+1,phase:k>=2?direction*pi/4:0,
    blocks:[{lo:0,hi:pi}]})) });
const pose = (S,w,t) => ({...S, rings:S.rings.map((r,k)=>({...r,phase:r.phase+w[k]*t}))});
const close = (a,b) => assert.ok(Math.abs(a-b)<1e-8, a+' != '+b);
for (const direction of [1,-1]) {
  context.Z.coneAutoSp = direction * 10;
  const S = geometry(3,direction), w=[0,0,direction*pi];
  const start={k:1,raw:0,r:1.5};
  test.start(S,start,1,false);
  let ball=test.step(.6,pose(S,w,0),pose(S,w,.6));
  assert.equal(ball.stage,'wait'); assert.equal(ball.waitingForRing,3);
  assert.equal(ball.ring,1); close(ball.q,2); close(ball.distance,.5); close(ball.elapsed,.6);
  ball=test.step(.5,pose(S,w,.6),pose(S,w,1.1));
  assert.equal(ball.ring,2); assert.equal(ball.stage,'out');
  close(ball.q,2.35); close(ball.distance,.85); close(ball.elapsed,1.1);
  assert.equal(ball.reversals,0);
  // The coincidence at .75s lies inside the frame and is gone at its end.
  test.start(S,start,1,false);
  const coarse=test.step(1.1,pose(S,w,0),pose(S,w,1.1));
  close(coarse.q,ball.q); close(coarse.distance,ball.distance);
  for (const dt of [.017,.073,1.1]) {
    test.start(S,start,1,false);
    for(let t=0;t<3 && test.info().stage!=='done';t+=dt) test.step(dt,pose(S,w,t),pose(S,w,t+dt));
    const end=test.info();
    assert.equal(end.stage,'done'); assert.equal(end.ring,2); close(end.q,3);
    close(end.distance,1.5); close(end.elapsed,1.75);
    close(end.ringTurns[2],direction*1.75/2);
  }
  // K3 and K4 remain reachable in a continuing orbit. No synchronized arc
  // solver exists for this wider route; physical arcs plus waiting must work.
  const wider=geometry(4,direction), rates=[0,0,direction*pi,direction*pi/2];
  for(const dt of [.017,.073]) {
    test.start(wider,start,1,true);
    let arcs=0, sawWait=false, sawK4=false, previous=null;
    for(let t=0;t<60;t+=dt) {
      const b=test.step(dt,pose(wider,rates,t),pose(wider,rates,t+dt));
      assert.notEqual(b.stage,'done'); assert.ok(b.q>=-1e-8 && b.q<=4+1e-8);
      sawWait ||= b.stage==='wait'; sawK4 ||= b.ring===3; arcs=Math.max(arcs,b.arcs);
      if(previous && previous.stage==='wait' && b.stage==='wait') close(b.distance,previous.distance);
      previous=b;
    }
    assert.ok(sawWait && sawK4 && arcs>=2,'four-ring loop must wait, resume and repeat');
  }
  // A stationary incompatible joint waits without teleporting or counting travel.
  const frozen=geometry(3,direction), zero=[0,0,0];
  test.start(frozen,start,1,true);
  const blocked=test.step(10,pose(frozen,zero,0),pose(frozen,zero,10));
  assert.equal(blocked.stage,'wait'); close(blocked.q,2); close(blocked.distance,.5);
  close(blocked.elapsed,10); assert.equal(blocked.ring,1);
}
const unmatched=geometry(3); unmatched.rings[0].phase=.123;
unmatched.rings[1].blocks=[{lo:0,hi:2*pi/3},{lo:pi,hi:5*pi/3}];
context.Z.coneBallArc=false;
assert.ok(test.movingGroup(unmatched,[pi,2*pi/3,pi/2],6,4).error);
context.Z.coneBallArc=true;
const fallback=test.movingGroup(unmatched,[pi,2*pi/3,pi/2],6,4);
assert.equal(fallback.runs.length,4);
close(Math.abs(fallback.runs[1].point.raw-fallback.runs[0].point.raw),pi);
console.log('PASS: K3/K4, waiting without travel, automatic resumption inside coarse frames, both directions, repeated wider arcs, stationary mismatch, unmatched group launch');
