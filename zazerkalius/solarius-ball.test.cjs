const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

function experiment({ q = 1, angle = 0, speed = 1, route = 'cross', rings } = {}) {
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
    { ri: 0, ro: 1, phase: 0, blocks: [{ lo: Math.PI / 2, hi: 3 * Math.PI / 2, bit: 0 }] },
    { ri: 1, ro: 2, phase: 0, blocks: [{ lo: 0, hi: Math.PI / 2, bit: 0 }, { lo: Math.PI, hi: 3 * Math.PI / 2, bit: 1 }] }
  ] };
  ctx.window.trial.begin(S, { point: { k: q >= 1 ? 1 : 0, r: q, raw: angle, label: 'test' }, route, speed, period: 12 });
  let current = S;
  return {
    info: () => ctx.window.zzBallInfo(),
    step(dt, rotation = [0, 0]) {
      const next = { ...current, rings: current.rings.map((r, k) => ({ ...r, phase: r.phase + rotation[k] })) };
      ctx.window.trial.advance(dt, current, next); current = next;
      return ctx.window.zzBallInfo();
    }
  };
}
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`);

test('a moving ball retains its world line while its ring rotates', () => {
  const trial = experiment({ q: 0.6, angle: Math.PI / 2 });
  const info = trial.step(0.1, [0.2, 0.1]);
  near(info.q, 0.5); near(info.angle, Math.PI / 2);
  assert.equal(info.waiting, false);
});

test('a blocked inward launch reverses outward on the same diameter', () => {
  const trial = experiment({ angle: Math.PI });
  const info = trial.step(0.25);
  near(info.q, 1.25); near(info.angle, Math.PI);
  assert.equal(info.reversals, 1); assert.equal(info.waiting, false);
  const done = trial.step(1);
  near(done.q, 2); near(done.distance, 1);
  assert.equal(done.stage, 'done'); assert.equal(done.clean, false);
});

test('a straight flight crosses a ring joint without needing coincident edges', () => {
  const trial = experiment({ q: 1.2, angle: -0.2 });
  const info = trial.step(0.4);
  near(info.q, 0.8); near(info.angle, -0.2);
  assert.equal(info.waiting, false); assert.equal(info.reversals, 0);
});

test('a rotating closed inner arc cannot carry a waiting ball sideways', () => {
  const trial = experiment({ angle: Math.PI });
  const waiting = trial.step(0.1, [0, -0.1]);
  near(waiting.q, 1); near(waiting.angle, Math.PI);
  assert.equal(waiting.waiting, true);
  const stillWaiting = trial.step(0.1, [0.2, -0.1]);
  near(stillWaiting.q, 1); near(stillWaiting.angle, Math.PI);
  assert.equal(stillWaiting.waiting, true);
});

test('a waiting ball leaves on the same line when the other direction opens', () => {
  const trial = experiment({ angle: Math.PI });
  trial.step(0.1, [0, -0.1]);
  const info = trial.step(0.2, [0, 0.2]);
  near(info.q, 1.1); near(info.angle, Math.PI);
  assert.equal(info.waiting, false); assert.equal(info.reversals, 1);
});

test('a fast flight bounces at the central obstacle without crossing it', () => {
  const trial = experiment({ q: 1.8, angle: Math.PI, speed: 10 });
  const info = trial.step(0.2);
  near(info.q, 2); near(info.distance, 1.8); near(info.elapsed, 0.18);
  assert.equal(info.stage, 'done'); assert.equal(info.reversals, 1);
});

test('an unobstructed center crossing exits on the opposite side', () => {
  const trial = experiment({ q: 1.5, angle: Math.PI / 2 });
  const info = trial.step(4);
  near(info.q, -2); near(info.distance, 3.5); near(info.angle, Math.PI / 2);
  assert.equal(info.stage, 'done'); assert.equal(info.clean, true);
});

test('an outward flight reverses at a wall and never ends on its old distance budget', () => {
  const trial = experiment({ q: 0.5, angle: 0.2, route: 'out' });
  const info = trial.step(2.3);
  near(info.q, 0.8); near(info.angle, 0.2); near(info.distance, 2.3);
  assert.equal(info.reversals, 2); assert.notEqual(info.stage, 'done');
  assert.equal(info.waiting, false);
});

test('a blocked flight can reverse when a gate opens later in the same frame', () => {
  const trial = experiment({ angle: Math.PI });
  const info = trial.step(2, [0, -Math.PI]);
  near(info.q, 2); near(info.angle, Math.PI);
  assert.equal(info.stage, 'done'); assert.equal(info.waiting, false);
  assert.equal(info.reversals, 1); assert.ok(info.waits > 0);
});

test('a saved eight route also moves on a straight diameter', () => {
  const trial = experiment({ q: 1.5, angle: Math.PI / 2, route: 'eight' });
  const info = trial.step(0.2);
  near(info.q, 1.3); near(info.angle, Math.PI / 2);
  assert.equal(info.stage, 'cross'); assert.equal(info.route, 'cross');
});
