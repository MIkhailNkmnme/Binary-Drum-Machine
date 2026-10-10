// v0.1081: constant speed per ball (user: «постоянная для каждого шарика; когда я начал про шарики, я сразу сказал, что скорость константа»;
// «но возможны шарики с разными константными скоростями»). Auto picks a speed once — for the first segment — then it never changes:
// no per-segment retuning, no waiting at a joint. A joint without an exact edge on the ball's line (no width tolerance) and without an
// open cut-out is an arc hit. Every ring mode, every start, both frame sizes.
// Run: node zazerkalius/tests/ball-auto.test.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const pi = Math.PI;
const context = {
  window: {}, Z: { coneSpinMode: 'bit', coneAutoSp: 10, coneBallMult: '1', coneBallArc: false },
  document: { readyState: 'loading', addEventListener() {}, getElementById() { return null; } }
};
vm.createContext(context);
const source = fs.readFileSync(path.join(__dirname, '../zz-ball.js'), 'utf8');
vm.runInContext(source.replace('  if (document.readyState === "loading")', `
  window.autoTest = { boundaryPoints, movingGroup,
    run(S, w, point, auto, dt, loop = false, limit = 40) {
      enabled = true; Z.coneBallArc = loop;
      const pose = t => ({ ...S, rings: S.rings.map((r, k) => ({ ...r, phase: r.phase + w[k] * t })) });
      begin(S, true, true, { point, route: point.r === 0 ? 'out' : 'cross', period: 6, speed: 1, auto });
      let fixed = null, changed = false, waited = false, constantTravel = true;
      for (let t = 0; t < limit && F.stage !== 'done' && F.stage !== 'lost'; t += dt) {
        advance(dt, pose(t), pose(t + dt));
        if (F.stage === 'wait') waited = true;
        const effective = F.arc ? F.arc.speed : F.seg ? F.seg.speed : F.speed;
        if (fixed === null) fixed = effective;
        else if (Math.abs(effective - fixed) > 1e-12) changed = true;
        constantTravel &&= Math.abs(F.travel - fixed * F.elapsed) < 1e-8;
      }
      Z.coneBallArc = false;
      return { ...ballInfo(F), fixed, changed, waited, constantTravel, loss: F.loss };
    }
  };
  if (document.readyState === "loading")`), context);
const { boundaryPoints, movingGroup, run } = context.window.autoTest;
// Raw block angles in parts of each ring, as zz-ui lays them out per mode.
const parts = (P, list) => list.map(([lo, hi]) => ({ lo: lo * 2 * pi / P, hi: hi * 2 * pi / P }));
const modes = {
  'T−1': parts(3, [[0, 1], [1, 2]]),
  'между': parts(3, [[0, 1], [2, 3]]),
  'симм.': parts(3, [[0, 1], [1.5, 2.5]]),
  '2n': parts(4, [[0, 1], [1, 2]]),
  'все': parts(2, [[0, 1], [1, 2]]),
  'N щель': [{ lo: 0, hi: 2 * pi }]
};
const row1 = { half: [{ lo: pi / 2, hi: 3 * pi / 2 }], quad: parts(4, [[1, 2], [3, 4]]), slit: [{ lo: -pi / 2, hi: pi / 2 }] };
const geometry = (k2, k1, phases, k3) => ({
  shape: 'auto', spin: 0,
  rings: [
    { ri: 0, ro: 1, phase: phases[0], blocks: k1, tol: 0 },
    { ri: 1, ro: 2, phase: phases[1], blocks: k2, tol: 0 },
    ...(k3 ? [{ ri: 2, ro: 3, phase: phases[2], blocks: k3, tol: 0 }] : [])
  ]
});
const rates = { bit: [pi, 2 * pi / 3, pi / 2], opp: [pi, -4 * pi / 3, pi / 3], obit: [pi, -2 * pi / 3, -pi / 5] };
let runs = 0, exited = 0, hit = 0;
for (const [name, k2] of Object.entries(modes)) for (const [r1, k1] of Object.entries(row1)) {
  for (const [mode, w] of Object.entries(rates)) for (const phases of [[0, 0, 0], [.123, -.71, .4], [1.9, .33, -2.2]]) {
    for (const k3 of [null, parts(5, [[0, 1], [1, 2], [2, 3]])]) {
      const S = geometry(k2, k1, phases, k3), label = `${name}/${r1}/${mode}/${phases}/${k3 ? 3 : 2}`;
      for (const point of boundaryPoints(S)) for (const dt of [1 / 60, .073]) {
        const ball = run(S, w, point, true, dt);
        assert.equal(ball.loss, true, label + ' every ball checks the joint (arc rule)');
        assert.equal(ball.waited, false, label + ' ' + point.id + ' never waits at a joint');
        assert.equal(ball.changed, false, label + ' ' + point.id + ' keeps one constant speed after the first segment');
        assert.equal(ball.constantTravel, true, label + ' ' + point.id + ' travels at the same speed from launch');
        assert.ok(ball.tuned <= 1, label + ' speed is selected at most once');
        assert.ok(ball.stage === 'done' || ball.stage === 'lost', label + ' ' + point.id + ' ends: exit or arc hit, got ' + ball.stage);
        runs++; if (ball.stage === 'done') exited++; else hit++;
      }
    }
  }
}
assert.ok(exited > 0 && hit > 0, 'both outcomes occur: exact joints pass, others hit an arc');
// A start inside K1 without an opposite edge must keep its first speed after the centre reversal.
{
  const S = geometry(modes['T−1'], [{ lo: 0, hi: 2 * pi }], [.123, -.71, 0]);
  for (const dt of [1 / 60, .073]) {
    const ball = run(S, rates.bit, { k: 0, raw: 0, r: .5, id: 'inside K1' }, true, dt);
    assert.equal(ball.changed, false, 'centre reversal must not select another speed');
    assert.equal(ball.constantTravel, true, 'constant travel from the first segment through the reversal');
    assert.equal(ball.fixed, 1);
  }
}
// Fixed speed modes and explicit speeds: never tuned at all.
{
  const S = geometry(modes['T−1'], row1.half, [.123, -.71, 0]);
  for (const point of boundaryPoints(S)) {
    const ball = run(S, rates.bit, point, false, 1 / 60);
    assert.equal(ball.changed, false); assert.equal(ball.waited, false);
    assert.ok(Math.abs(ball.fixed - 1) < 1e-12, 'explicit speed 1 stays 1');
  }
}
// ∞ loop: arcs at the ball's own speed, no waiting.
for (const name of ['T−1', 'между', 'все']) {
  const L = geometry(modes[name], row1.half, [.3, -.2]);
  const ball = run(L, rates.bit, boundaryPoints(L)[0], true, .037, true, 30);
  assert.equal(ball.waited, false, name + ' loop never waits'); assert.equal(ball.changed, false, name + ' loop keeps its speed');
}
// Group launches still find a common constant speed or fall back to a first-segment auto speed.
context.Z.coneBallAuto = true; context.Z.coneBallBatch = false;
const plain = geometry(modes['T−1'], row1.half, [.123, -.71, 0]);
for (const count of [1, 2, 3]) {
  const group = movingGroup(plain, rates.bit, 6, count);
  assert.ok(!group.error, group.error); assert.equal(group.runs.length, count);
}
console.log(`PASS: constant speed per ball in T−1, между, симм., 2n, все, N щель × half/quad/slit ring 1 × 3 spin modes × 2/3 rings: ${runs} runs (${exited} exited, ${hit} arc hits), no waiting, no retuning; ∞ loops; groups`);
