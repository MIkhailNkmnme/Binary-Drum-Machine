// v0.1081: no waiting at a joint (constant speed per ball). Formerly this file checked waiting and resumption at K3/K4;
// now an outer joint without an exact edge on the ball's line is an arc hit at the exact arrival time — stick or bounce.
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
  rings: Array.from({length:count}, (_,k) => ({ri:k,ro:k+1,phase:k>=2?direction*pi/4:0, tol:0,
    blocks:k>=2?[{lo:0,hi:pi},{lo:pi,hi:2*pi}]:[{lo:0,hi:pi}]})) });   // outer rings closed all round (two halves): a miss is an arc, not an open cut-out
const pose = (S,w,t) => ({...S, rings:S.rings.map((r,k)=>({...r,phase:r.phase+w[k]*t}))});
const close = (a,b) => assert.ok(Math.abs(a-b)<1e-8, a+' != '+b);
for (const direction of [1,-1]) {
  context.Z.coneAutoSp = direction * 10;
  const S = geometry(3,direction), w=[0,0,direction*pi], start={k:1,raw:0,r:1.5};
  for (const impact of ['stick','bounce']) {
    context.Z.coneBallImpact = impact;
    for (const dt of [.017,.073,.6,1.1]) {
      test.start(S,start,1,false);
      let b; for (let t=0;t<.6+1e-9;t+=dt) b=test.step(dt,pose(S,w,t),pose(S,w,t+dt));
      assert.notEqual(b.stage,'wait','never waits ('+impact+', dt '+dt+')');
      if (impact==='stick') { assert.equal(b.stage,'lost'); close(b.q,2); close(b.distance,.5); close(b.elapsed,.5); }
      else { assert.equal(b.reversals,1,'bounce reverses at the joint'); }
    }
  }
  // A stationary incompatible joint: hit at arrival, no waiting time.
  context.Z.coneBallImpact = 'stick';
  const frozen=geometry(3,direction), zero=[0,0,0];
  test.start(frozen,start,1,true);
  const blocked=test.step(10,pose(frozen,zero,0),pose(frozen,zero,10));
  assert.equal(blocked.stage,'lost'); close(blocked.q,2); close(blocked.distance,.5); close(blocked.elapsed,.5);
  // Wider ∞ loop: never waits.
  const wider=geometry(4,direction), rates=[0,0,direction*pi,direction*pi/2];
  for(const dt of [.017,.073]) {
    test.start(wider,start,1,true);
    for(let t=0;t<20;t+=dt) { const b=test.step(dt,pose(wider,rates,t),pose(wider,rates,t+dt)); assert.notEqual(b.stage,'wait'); if (b.stage==='lost'||b.stage==='done') break; }
  }
}
const unmatched=geometry(3); unmatched.rings[0].phase=.123;
unmatched.rings[1].blocks=[{lo:0,hi:2*pi/3},{lo:pi,hi:5*pi/3}];
context.Z.coneBallArc=false;
assert.ok(test.movingGroup(unmatched,[pi,2*pi/3,pi/2],6,4).error);
context.Z.coneBallArc=true;
const fallback=test.movingGroup(unmatched,[pi,2*pi/3,pi/2],6,4);
assert.equal(fallback.runs.length,4);
close(Math.abs(fallback.runs[1].point.raw-fallback.runs[0].point.raw),pi);
console.log('PASS: no waiting — outer joint mismatch is an arc hit at arrival (stick/bounce, both directions, coarse frames), stationary mismatch, ∞ loop, unmatched group launch');
