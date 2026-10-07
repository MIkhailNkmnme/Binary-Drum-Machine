// Exhaust the relative whole/half-part starts of the two-ring geometry.
// Run: node zazerkalius/tests/ball-phases.test.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const pi = Math.PI, tau = 2 * pi;
const mod = a => ((a % tau) + tau) % tau;
const closeAngle = (a, b) => Math.abs(mod(a - b + pi) - pi) < 1e-8;
const context = {
  window: {}, Z: { coneSpinMode: 'bit', coneAutoSp: 10, coneBallArc: false },
  document: { readyState: 'loading', addEventListener() {}, getElementById() { return null; } }
};
vm.createContext(context);
const source = fs.readFileSync(path.join(__dirname, '../zz-ball.js'), 'utf8');
vm.runInContext(source.replace('  if (document.readyState === "loading")', `
  window.phaseTest = { solveThrough,
    run(S, w, result, dt) {
      enabled = true; Z.coneBallMult = String(result.mult);
      begin(S, true, true, {point: result.point, route: 'cross', period: 6, speed: result.speed});
      const pose = t => ({...S, rings: S.rings.map((r,k) => ({...r, phase:r.phase+w[k]*t}))});
      for (let t = 0; t < result.duration + dt; t += dt) advance(dt, pose(t), pose(t+dt));
      return ballInfo(F);
    }
  };
  if (document.readyState === "loading")`), context);
const { solveThrough, run } = context.window.phaseTest;
const outer = [0, 2*pi/3, pi, 5*pi/3];
const geometry = phase => ({shape:'half-part study',spin:0,rings:[
  {ri:0,ro:1,phase,blocks:[{lo:0,hi:pi}]},
  {ri:1,ro:2,phase:0,blocks:[{lo:0,hi:2*pi/3},{lo:pi,hi:5*pi/3}]}
]});
// First joint at t=1/v; second at 3t. With inner entry edge e=0 or pi:
// dw*t = a-phi-e (mod 2pi), and exit edge f = 3a-2phi-2e+pi (mod 2pi).
// The second equation is independent of the number of extra rotations.
// This proves impossibility at rejected phases, rather than relying on a cutoff.
function earliest(phase, a, dw) {
  let best = Infinity;
  for (const e of [0, pi]) {
    if (!outer.some(f => closeAngle(f, 3*a - 2*phase - 2*e + pi))) continue;
    let angle = mod(Math.sign(dw) * (a - phase - e));
    if (angle < 1e-8 || tau-angle < 1e-8) angle = tau; // t=0 cannot traverse width 1.
    best = Math.min(best, 4*angle/Math.abs(dw));
  }
  return best;
}
function fraction(x) {
  for (let d=1; d<=1000; d++) {
    const n=Math.round(x*d);
    if (Math.abs(x-n/d)<1e-8) return d===1 ? String(n) : n+'/'+d;
  }
  throw new Error('unexpected irrational result');
}
const report=[];
for (const [mode, rates] of [['bit',[pi,2*pi/3]],['opp',[pi,-4*pi/3]],['obit',[pi,-2*pi/3]]]) {
  for (const direction of [1,-1]) {
    context.Z.coneSpinMode=mode; context.Z.coneAutoSp=10*direction;
    const w=rates.map(v=>v*direction);
    for(let degrees=0; degrees<360; degrees+=30) {
      const phase=degrees*pi/180,S=geometry(phase),runs=[],exitEdges=[];
      for(let j=0;j<outer.length;j++) {
        const point={id:'edge:1:'+Math.floor(j/2)+':'+j%2+':outer',k:1,raw:outer[j],r:2};
        const expected=earliest(phase,point.raw,w[0]-w[1]);
        const result=solveThrough(S,w,6,point);
        assert.equal(!!result.error,!Number.isFinite(expected), `${mode}/${direction}/${degrees}/${j}: existence`);
        if(result.error) { runs.push(null); continue; }
        assert.ok(Math.abs(result.duration-expected)<1e-8,'solver found earliest admissible passage');
        for(const dt of [.017,.073]) {
          const ball=run(S,w,result,dt);
          assert.equal(ball.stage,'done'); assert.equal(ball.reversals,0); assert.equal(ball.clean,true);
          assert.ok(closeAngle(ball.edge,3*point.raw-2*phase+pi),'exit edge follows the analytical mapping');
          if(dt===.017) exitEdges.push(ball.edge);
          ball.ringTurns.forEach((v,k)=>assert.ok(Math.abs(v-w[k]*expected/tau)<1e-8));
        }
        runs.push(result);
      }
      assert.equal(!!runs[0],!!runs[2]); assert.equal(!!runs[1],!!runs[3]);
      for(const j of [0,1]) if(runs[j]) assert.ok(Math.abs(runs[j].duration-runs[j+2].duration)<1e-8);
      const all=runs.every(Boolean);
      if(all) {
        assert.ok(Math.abs(runs[0].speed-runs[1].speed)>1e-8,'the two fastest pairs have different speeds');
        const unique=exitEdges.filter((e,i)=>!exitEdges.slice(0,i).some(f=>closeAngle(e,f)));
        assert.equal(unique.length,2,'four starts use exactly two outer exit edges');
        unique.forEach(e=>assert.equal(exitEdges.filter(f=>closeAngle(e,f)).length,2));
      }
      report.push({mode,direction,degrees,pass:runs.filter(Boolean).length,
        pairA:all?fraction(Math.abs(w[1])*runs[0].duration/tau):'—',
        pairB:all?fraction(Math.abs(w[1])*runs[1].duration/tau):'—',
        allK2:all?fraction(Math.abs(w[1])*Math.max(...runs.map(r=>r.duration))/tau):'—',
        allTime:all?Math.max(...runs.map(r=>r.duration)):Infinity});
    }
  }
}
console.log('PASS: 12 phases × 3 modes × 2 directions × 4 starts; analytical completeness and minima; two simulation frame rates.');
console.table(report.filter(r=>r.mode==='obit'&&r.direction===-1).map(({degrees,pass,pairA,pairB,allK2})=>({degrees,pass,pairA,pairB,allK2})));
for(const mode of ['bit','opp','obit']) for(const direction of [1,-1]) {
  const rows=report.filter(r=>r.mode===mode&&r.direction===direction),best=Math.min(...rows.map(r=>r.allTime));
  console.log(mode,direction,'best phases:',rows.filter(r=>Math.abs(r.allTime-best)<1e-8).map(r=>r.degrees),'K2:',rows.find(r=>Math.abs(r.allTime-best)<1e-8).allK2);
}
