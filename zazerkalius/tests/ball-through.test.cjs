const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Exercise the production solver against the production movement engine.
const source = fs.readFileSync(path.join(__dirname, '../zz-ball.js'), 'utf8');
const context = {
  window: {}, Z: { coneSpinMode: 'bit', coneAutoSp: 10 },
  document: { readyState: 'loading', addEventListener() {}, getElementById() { return null; } }
};
vm.createContext(context);
vm.runInContext(source.replace('  if (document.readyState === "loading")', `
  window.test = {
    solveThrough, solveGroup, frame, turnsFraction,
    run(S, w, T, result, dt, loop = false) {
      const pose = t => ({ ...S, rings: S.rings.map((r, k) => ({ ...r, phase: r.phase + w[k] * t })) });
      enabled = true; Z.coneBallMult = speedText(result.mult); Z.coneBallArc = loop;
      begin(S, true, true, { point: result.point, route: "cross", period: T });
      let sawArc = false, arcBounds = true, constantStraightSpeed = true;
      const initialSpeed = F.speed;
      for (let t = 0; t < result.duration * (loop ? 20 : 1) + dt && F.stage !== "done"; t += dt) {
        advance(dt, pose(t), pose(t + dt));
        constantStraightSpeed &&= F.speed === initialSpeed;
        if (F.stage === "arc") {
          sawArc = true;
          arcBounds &&= F.q === S.rings[1].ro && S.rings[1].blocks.some(b => F.raw >= b.lo - EPS && F.raw <= b.hi + EPS) && F.arc.speed === F.speed;
        }
      }
      for (let k = 0; k < w.length; k++) assertTurns(F.ringTurns[k], w[k] * F.elapsed / (2 * Math.PI));
      const frozen = JSON.stringify(F.ringTurns);
      if (F.stage === "done") {
        advance(10, pose(F.elapsed), pose(F.elapsed + 10));
        if (JSON.stringify(F.ringTurns) !== frozen) throw new Error('completed counters must freeze');
      }
      Z.coneBallArc = false;
      return { ...ballInfo(F), sawArc, arcBounds, constantStraightSpeed };
    }
  };
  function assertTurns(actual, expected) {
    if (Math.abs(actual - expected) > 1e-8) throw new Error('turn count: ' + actual + ' != ' + expected);
  }
  if (document.readyState === "loading")`), context);
const { solveThrough, solveGroup, run } = context.window.test;
const pi = Math.PI;
const geometry = (offset = 0) => ({
  shape: 'two touching rings', spin: 0,
  rings: [
    { ri: 0, ro: 1, phase: offset, blocks: [{ lo: 0, hi: pi }] },
    { ri: 1, ro: 2, phase: 0, blocks: [{ lo: pi, hi: 5 * pi / 3 }, { lo: 0, hi: 2 * pi / 3 }] }
  ]
});
for (const [mode, rates, expected] of [
  ['bit', [pi, 2 * pi / 3], .5],
  ['opp', [pi, -4 * pi / 3], 3.5],
  ['obit', [pi, -2 * pi / 3], 2.5]
]) {
  for (const direction of [1, -1]) {
    context.Z.coneAutoSp = 10 * direction;
    const w = rates.map(x => x * direction), S = geometry();
    const solution = solveThrough(S, w, 6);
    assert.ok(!solution.error, solution.error);
    assert.ok(Math.abs(solution.mult - expected) < 1e-10);
    assert.equal(solution.point.raw, pi, 'prefer the leftmost outer start');
    for (const dt of [1 / 60, .073]) {
      const ball = run(S, w, 6, solution, dt);
      assert.equal(ball.stage, 'done');
      assert.equal(ball.reversals, 0);
      assert.equal(ball.clean, true);
      assert.ok(Math.abs(ball.distance - 4) < 1e-9);
    }
    for (const count of [2, 3, 4]) {
      const group = solveGroup(S, w, 6, count);
      assert.ok(!group.error, group.error);
      assert.equal(group.runs.length, count);
      assert.equal(new Set(group.runs.map(r => r.point.id)).size, count);
      assert.ok(Math.abs(group.runs[0].speed - group.runs[1].speed) < 1e-10);
      for (const r of group.runs) {
        const ball = run(S, w, 6, r, .073);
        assert.equal(ball.stage, 'done');
        assert.equal(ball.reversals, 0);
      }
      if (count > 2) {
        assert.ok(Math.abs(group.runs[2].mult - group.runs[0].mult) > .01);
        const wrongSpeed = { ...group.runs[2], mult: group.runs[0].mult, duration: group.runs[0].duration };
        { const wrong = run(S, w, 6, wrongSpeed, .073); assert.ok(wrong.reversals > 0 || wrong.stage === 'lost', 'third distinct start cannot use the first pair speed'); }   // v0.1081: miss = arc hit (stick) or bounce
      }
      if (count === 4) for (const r of group.runs) for (const dt of [.017, .073]) {
        // v0.1081: arcs run at the ball's own constant speed (no synchronised arc speed) — a loop is no longer guaranteed to stay aligned
        const ball = run(S, w, 6, r, dt, true);
        assert.ok(ball.constantStraightSpeed, mode + ' loop keeps one speed');
        if (ball.sawArc) assert.ok(ball.arcBounds, mode + ' arc stays on the outer rim of its block');
      }
    }
  }
}
context.Z.coneAutoSp = 10;
for (const offset of [pi / 6, pi / 2]) {
  const S = geometry(offset), w = [pi, 2 * pi / 3];
  const solution = solveThrough(S, w, 6);
  assert.ok(!solution.error, solution.error);
  assert.equal(run(S, w, 6, solution, .037).clean, true);
}
const gap = geometry(); gap.rings[0].ro = .72;
assert.match(solveThrough(gap, [pi, 2 * pi / 3], 6).error, /без промежутков/);
assert.ok(solveThrough(geometry(), [0, 0], null).error);
assert.ok(solveThrough(geometry(.123), [pi, 2 * pi / 3], 6).error, 'no false positive for incompatible phase');
const together = solveThrough(geometry(), [pi, pi], 2);
assert.equal(run(geometry(), [pi, pi], 2, together, .041).clean, true);
context.Z.coneBallBatch = false;
context.Z.coneBallStart = 'edge:1:1:0:outer';
assert.equal(solveThrough(geometry(), [pi, 2 * pi / 3], 6).point.raw, 0, 'respect selected external start');
context.Z.coneSpinMode = 'all'; context.Z.coneAutoSp = 30;
const A = { ...geometry(), spin: 359 * pi / 180, rotation: [0, 1, 2] };
const B = { ...A, spin: 2 * pi / 180 };
assert.ok(context.window.test.frame(A, B, .1).turnDelta.every(t => Math.abs(t - 3 / 360) < 1e-12), 'wrapped common spin and third-ring counter');
context.Z.coneSpinMode = 'obit';
const C = { ...A, rotation: [pi, 1 - pi / 2, 2] };
assert.deepEqual(Array.from(context.window.test.frame(A, C, 1).turnDelta), [.5, -.25, 0], 'each ring counted independently; stationary ring stays zero');
console.log('PASS: through passages, outer arcs, signed per-ring turns, partial final frames, frozen results, wrapped spin, third and stationary rings');

assert.equal(context.window.test.turnsFraction(8/15), '↻ 8/15');
assert.equal(context.window.test.turnsFraction(-1.2), '↺ −1 1/5');
assert.equal(context.window.test.turnsFraction(.800000000000003), '↻ 4/5');
assert.equal(context.window.test.turnsFraction(0), '0');
assert.ok(context.window.test.turnsFraction(.1234567).startsWith('≈ '));
