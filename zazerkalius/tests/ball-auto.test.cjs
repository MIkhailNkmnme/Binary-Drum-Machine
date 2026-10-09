// Auto-tuned straight speeds: every ring mode, every start, no reversals.
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
      const speeds = new Set();
      for (let t = 0; t < limit && F.stage !== 'done'; t += dt) {
        advance(dt, pose(t), pose(t + dt));
        if (F.seg) speeds.add(Math.round(F.seg.speed * 1e9));
      }
      Z.coneBallArc = false;
      return { ...ballInfo(F), speeds: speeds.size };
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
  // «N щель»: the only edge of a row ring is its slit, so one block covers the whole circle.
  'N щель': [{ lo: 0, hi: 2 * pi }]
};
// Without cuts ring 1 is one bit: its slit and the line through the centre opposite it.
const row1 = { half: [{ lo: pi / 2, hi: 3 * pi / 2 }], quad: parts(4, [[1, 2], [3, 4]]), slit: [{ lo: -pi / 2, hi: pi / 2 }] };
const geometry = (k2, k1, phases, k3) => ({
  shape: 'auto', spin: 0,
  rings: [
    { ri: 0, ro: 1, phase: phases[0], blocks: k1 },
    { ri: 1, ro: 2, phase: phases[1], blocks: k2 },
    ...(k3 ? [{ ri: 2, ro: 3, phase: phases[2], blocks: k3 }] : [])
  ]
});
const rates = { bit: [pi, 2 * pi / 3, pi / 2], opp: [pi, -4 * pi / 3, pi / 3], obit: [pi, -2 * pi / 3, -pi / 5] };
let runs = 0, retuned = 0;
for (const [name, k2] of Object.entries(modes)) for (const [r1, k1] of Object.entries(row1)) {
  for (const [mode, w] of Object.entries(rates)) for (const phases of [[0, 0, 0], [.123, -.71, .4], [1.9, .33, -2.2]]) {
    for (const k3 of [null, parts(5, [[0, 1], [1, 2], [2, 3]])]) {
      const S = geometry(k2, k1, phases, k3), label = `${name}/${r1}/${mode}/${phases}/${k3 ? 3 : 2}`;
      for (const point of boundaryPoints(S)) for (const dt of [1 / 60, .073]) {
        const ball = run(S, w, point, true, dt);
        assert.equal(ball.stage, 'done', label + ' ' + point.id + ' must exit');
        assert.equal(ball.reversals, 0, label + ' ' + point.id + ' never reverses');
        assert.equal(ball.clean, true, label);
        assert.equal(ball.ring, S.rings.length - 1, label + ' exits through the outermost ring');
        runs++; if (ball.tuned) retuned++;
      }
    }
  }
}
assert.ok(retuned > runs / 2, 'most passages need retuned segment speeds');
// Without tuning the same poses do reverse: the feature, not the geometry, makes them clean.
const plain = geometry(modes['T−1'], row1.half, [.123, -.71, 0]);
assert.ok(boundaryPoints(plain).some(p => run(plain, rates.bit, p, false, 1 / 60).reversals > 0));
// Speed is never more than 4x the nominal one.
const S = geometry(modes['T−1'], row1.half, [.123, -.71, 0]);
const fast = run(S, rates.opp, boundaryPoints(S)[0], true, 1 / 60);
assert.ok(fast.elapsed >= fast.distance / 4 - 1e-9);
// Same-rate rings: aligned joints keep the nominal speed, unaligned ones wait instead of reversing.
const still = run(geometry(modes['2n'], row1.half, [0, 0]), [pi, pi], boundaryPoints(geometry(modes['2n'], row1.half, [0, 0]))[0], true, 1 / 60, false, 5);
assert.equal(still.reversals, 0);
// ∞ loop keeps going cleanly in a mode without opposite outer edges.
for (const name of ['T−1', 'между']) {
  const L = geometry(modes[name], row1.half, [.3, -.2]);
  const ball = run(L, rates.bit, boundaryPoints(L)[0], true, .037, true, 60);
  assert.notEqual(ball.stage, 'done'); assert.equal(ball.reversals, 0); assert.ok(ball.arcs >= 5, name + ' loop repeats');
}
// Group launches fall back to auto-tuned runs when no common constant speed exists.
context.Z.coneBallAuto = true; context.Z.coneBallBatch = false;
for (const count of [1, 2, 3]) {
  const group = movingGroup(plain, rates.bit, 6, count);
  assert.ok(!group.error, group.error); assert.equal(group.runs.length, count);
  assert.ok(group.runs.every(r => r.auto));
}
context.Z.coneBallAuto = false;
assert.ok(movingGroup(plain, rates.bit, 6, 2).error, 'without tuning T−1 has no opposite pair');
console.log(`PASS: auto-tuned speeds in T−1, между, симм., 2n, все, N щель × half/quad/slit ring 1 × 3 spin modes × 2/3 rings: ${runs} runs, ${retuned} retuned, 0 reversals; ∞ loops; group fallback`);
