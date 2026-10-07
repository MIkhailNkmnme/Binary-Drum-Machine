const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

// Ring 1: one half [π/2, 3π/2]; its edges π/2 and 3π/2 form one diameter.
// Ring 2: bits [0, π/2] and [π, 3π/2]; edges 0, π/2, π, 3π/2.
function experiment({ q = 1, angle = 0, speed = 1, route = 'cross', phase = [0, 0], rings } = {}) {
  const status = { textContent: '' };
  const ctx = vm.createContext({
    window: {}, Z: { coneAutoSp: 30, coneSpinMode: 'bit', coneBallBatch: false },
    document: { readyState: 'loading', addEventListener() {}, getElementById: id => id === 'coneBallStatus' ? status : null }
  });
  const source = readFileSync(__dirname + '/zz-ball.js', 'utf8');
  vm.runInContext(source.replace('  if (document.readyState === "loading")', `
    window.trial = { begin(S, options) { enabled = true; begin(S, true, true, options); }, advance };
    if (document.readyState === "loading")`), ctx);
  const S = { shape: 'trial', spin: 0, rings: rings || [
    { ri: 0, ro: 1, phase: phase[0], blocks: [{ lo: Math.PI / 2, hi: 3 * Math.PI / 2, bit: 0 }] },
    { ri: 1, ro: 2, phase: phase[1], blocks: [{ lo: 0, hi: Math.PI / 2, bit: 0 }, { lo: Math.PI, hi: 3 * Math.PI / 2, bit: 1 }] }
  ] };
  ctx.window.trial.begin(S, { point: { k: q >= 1 ? 1 : 0, r: q, raw: angle, label: 'test' }, route, speed, period: 12 });
  let current = S;
  return {
    status,
    step(dt, rotation = [0, 0]) {
      const next = { ...current, rings: current.rings.map((r, k) => ({ ...r, phase: r.phase + rotation[k] })) };
      ctx.window.trial.advance(dt, current, next); current = next;
      return ctx.window.zzBallInfo();
    }
  };
}
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`);
const same = (actual, expected) => near(Math.atan2(Math.sin(actual - expected), Math.cos(actual - expected)), 0);

test('a ball rides its bit edge and turns with that ring', () => {
  const trial = experiment({ q: 1.5, angle: Math.PI / 2 });
  const info = trial.step(0.1, [0.3, 0.2]);
  near(info.q, 1.4); same(info.angle, Math.PI / 2 + 0.2);
  assert.equal(info.ring, 1); assert.equal(info.reversals, 0);
});

test('at the joint the ball moves onto the coincident edge of the first ring', () => {
  const trial = experiment({ q: 1.5, angle: Math.PI / 2 });
  const info = trial.step(1);
  near(info.q, 0.5); same(info.angle, Math.PI / 2);
  assert.equal(info.ring, 0); assert.equal(info.reversals, 0); assert.equal(info.clean, true);
});

test('without a coincident edge at the joint the ball reverses along its own edge', () => {
  const trial = experiment({ q: 1.5, angle: 0 });
  const info = trial.step(1);
  near(info.q, 1.5); same(info.angle, 0);
  assert.equal(info.ring, 1); assert.equal(info.reversals, 1); assert.equal(info.stage, 'out');
  const done = trial.step(1);
  near(done.q, 2); near(done.distance, 1.5);
  assert.equal(done.stage, 'done'); assert.equal(done.clean, false);
});

test('the joint is checked at the moment of arrival, with rotated rings', () => {
  // The first ring turns −π/2 in half a second: its edge π/2 reaches angle 0 exactly on arrival.
  const trial = experiment({ q: 1.5, angle: 0 });
  const info = trial.step(1, [-Math.PI, 0]);
  near(info.q, 0.5); same(info.angle, -Math.PI / 2);
  assert.equal(info.ring, 0); assert.equal(info.edge, Math.PI / 2); assert.equal(info.reversals, 0);
});

test('through the centre the ball goes on along the opposite edge of the first ring', () => {
  const trial = experiment({ q: 0.5, angle: Math.PI / 2 });
  const info = trial.step(1, [0.4, 0]);
  near(info.q, 0.5); same(info.angle, 3 * Math.PI / 2 + 0.4);
  assert.equal(info.ring, 0); assert.equal(info.edge, 3 * Math.PI / 2); assert.equal(info.stage, 'out');
  assert.equal(info.reversals, 0);
});

test('a clean crossing exits at the outer rim on the opposite side', () => {
  const trial = experiment({ q: 2, angle: Math.PI / 2 });
  const info = trial.step(5);
  near(info.q, 2); same(info.angle, 3 * Math.PI / 2); near(info.distance, 4); near(info.elapsed, 4);
  assert.equal(info.ring, 1); assert.equal(info.stage, 'done'); assert.equal(info.clean, true);
});

test('inside the first ring a ball can bounce from joint to joint', () => {
  // The second ring is turned off the first ring's diameter: neither joint opens.
  const trial = experiment({ q: 0.5, angle: Math.PI / 2, route: 'out', phase: [0, 0.3] });
  const info = trial.step(2.5);
  near(info.q, 1); same(info.angle, 3 * Math.PI / 2);
  assert.equal(info.ring, 0); assert.equal(info.reversals, 2); assert.notEqual(info.stage, 'done');
});

test('a launch exactly at the joint decides at once', () => {
  const pass = experiment({ q: 1, angle: Math.PI / 2 }).step(0.25);
  near(pass.q, 0.75); assert.equal(pass.ring, 0); assert.equal(pass.reversals, 0);
  const back = experiment({ q: 1, angle: 0 }).step(0.25);
  near(back.q, 1.25); assert.equal(back.ring, 1); assert.equal(back.reversals, 1);
});

test('a fast ball handles a reversal and the exit in one frame', () => {
  const trial = experiment({ q: 1.8, angle: 0, speed: 10 });
  const info = trial.step(0.2);
  near(info.q, 2); near(info.distance, 1.8); near(info.elapsed, 0.18);
  assert.equal(info.stage, 'done'); assert.equal(info.reversals, 1);
});

test('a saved eight route falls back to the centre crossing', () => {
  const trial = experiment({ q: 1.5, angle: Math.PI / 2, route: 'eight' });
  const info = trial.step(0.2);
  near(info.q, 1.3); assert.equal(info.route, 'cross'); assert.equal(info.stage, 'in');
});
