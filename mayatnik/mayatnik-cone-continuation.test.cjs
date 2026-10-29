const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const finite = require('./mayatnik-compare.js');
const continuation = require('./mayatnik-cone-continuation.js');

// Independent sparse oracle: no core functions, no dense allocation boundary.
// Old operations alone are clipped; all subsequent cones have complete wings.
function oracle(rows, direction, pair, target) {
  const W = 2 * rows - 1, anchor = rows - 1, baseMax = pair ? rows : W;
  const cells = Array.from({ length: rows }, () => new Map());
  const get = (r, c) => cells[r]?.get(c) ?? -1;
  for (let k = 0; k < target; k++) {
    const offset = !k ? 0 : k % 2 ? -(k + 1) / 2 : k / 2;
    const apices = pair && k ? [anchor - k, anchor + k] : [anchor + (direction === 'pendR' ? -offset : offset)];
    const previous = apices.map(a => get(0, a) < 0 ? 1 : get(0, a));
    for (const a of apices) cells[0].set(a, 1);
    for (let r = 1; r < rows; r++) {
      const todo = new Set();
      for (const a of apices) for (let c = a - r; c <= a + r; c += 2) {
        if (k >= baseMax || c >= 0 && c < W) todo.add(c);
      }
      for (const c of todo) cells[r].set(c, Number(get(r, c) === 1) ^ Number(get(r - 1, c - 1) === 1) ^ Number(get(r - 1, c + 1) === 1));
      if (r === 1) apices.forEach((a, i) => cells[0].set(a, previous[i]));
    }
  }
  const crop = new Int8Array(rows * W);
  for (let r = 0; r < rows; r++) for (let c = 0; c < W; c++) crop[r * W + c] = get(r, c);
  return { crop, get };
}

for (const rows of [1, 2, 3, 4, 8, 17]) for (const direction of ['pend', 'pendR']) for (const pair of [false, true]) {
  test(`prefix and genuine continuation: N=${rows}, ${direction}, pair=${pair}`, () => {
    const W = 2 * rows - 1, baseMax = pair ? rows : W, budget = 9 * W * rows;
    const engine = continuation.create({ rows, direction, pair, checkpointBytes: budget });
    const old = finite.create({ rows, direction, pair });
    const live = engine.seek(0).left;
    for (let frame = 0; frame <= baseMax; frame++) {
      const state = engine.seek(frame), expected = old.seek(frame);
      assert.deepEqual(state.left, expected.left);
      for (const name of ['W', 'H', 'anchor', 'lo', 'hi', 'vertices']) assert.equal(state[name], expected[name], name);
      assert.strictEqual(state.left, live);
      assert.equal(state.workingW, W);
    }
    const frames = [baseMax + 1, baseMax + rows, baseMax + 2 * rows, 0, baseMax, baseMax + 2, baseMax + 2 * rows];
    for (const frame of frames) {
      const state = engine.seek(frame), want = oracle(rows, direction, pair, frame);
      assert.deepEqual(state.left, want.crop);
      assert.strictEqual(state.left, live);
      assert.equal(state.W, W); assert.equal(state.H, rows); assert.equal(state.anchor, rows - 1);
      for (let r = 0; r < rows; r++) for (let c = -frame - rows; c < W + frame + rows; c++) {
        assert.equal(engine.readCell(r, c), want.get(r, c), `frame ${frame}, cell ${r}/${c}`);
      }
      const memory = engine.memory();
      assert.ok(memory.checkpointBytes <= budget);
      assert.ok(memory.checkpointCount <= memory.checkpointLimit);
    }
    assert.equal(engine.seek(0).max, baseMax + 2 * rows);
  });
}

test('horizon extension is metadata only, preserving crop identity and allocated bytes', () => {
  const engine = continuation.create({ rows: 8 });
  const before = engine.seek(4), saved = before.left.slice(), memory = engine.memory();
  const after = engine.extend(1000000000);
  assert.equal(after.max, 1000000000); assert.equal(after.k, 4);
  assert.strictEqual(after.left, before.left); assert.deepEqual(after.left, saved);
  assert.deepEqual(engine.memory(), memory);
  assert.equal(engine.extend(1).max, 1000000000);
});

test('one seek, many seeks, a reload, and different checkpoint budgets produce the same halo', () => {
  for (const direction of ['pend', 'pendR']) for (const pair of [false, true]) {
    const rows = 11, target = 73;
    const direct = continuation.create({ rows, direction, pair, checkpointBytes: 0 });
    const stepped = continuation.create({ rows, direction, pair, checkpointBytes: 8192 });
    const reloaded = continuation.create({ rows, direction, pair, checkpointBytes: 1000000 });
    direct.seek(target);
    for (const frame of [1, 5, 23, 7, 48, 20, target, 2, target]) stepped.seek(frame);
    reloaded.extend(1000); reloaded.seek(target);
    for (const other of [stepped, reloaded]) {
      assert.deepEqual(other.seek(target).left, direct.seek(target).left);
      for (let r = 0; r < rows; r++) for (let c = -target; c <= target; c++) assert.equal(other.readCell(r, c), direct.readCell(r, c));
    }
    assert.equal(direct.memory().checkpointCount, 0);
  }
});

test('full wings matter: N=4 frame 12 differs from an apex-only clipped halo', () => {
  const engine = continuation.create({ rows: 4 });
  assert.equal(engine.seek(12).left[3 * 7], 0);
  assert.equal(engine.readCell(0, -2), 1);
  // A wing outside the current range of seed apices is already a real bit.
  assert.equal(engine.readCell(3, -5), 1);
});

test('future workspace never leaks into old frame 4, even after a long continuation', () => {
  const engine = continuation.create({ rows: 3 });
  engine.seek(40);
  assert.equal(engine.seek(4).left[2 * 5], 0);
  assert.equal(engine.readCell(2, -1), -1);
  assert.deepEqual(engine.seek(9).left, oracle(3, 'pend', false, 9).crop);
});

test('capacity policy cannot change the continuation result', () => {
  const path = require.resolve('./mayatnik-cone-continuation.js');
  const source = fs.readFileSync(path, 'utf8').replace('Math.ceil(work.W * 1.5)', 'Math.ceil(work.W * 4)');
  const context = { module: { exports: {} }, require: () => require('./mayatnik-core.js'), Int8Array, Uint8Array };
  vm.runInNewContext(source, context);
  const generous = context.module.exports.create({ rows: 9 });
  const normal = continuation.create({ rows: 9 });
  for (const frame of [17, 18, 24, 49, 7, 35, 68]) {
    assert.deepEqual(generous.seek(frame).left, normal.seek(frame).left);
    for (let r = 0; r < 9; r++) for (let c = -70; c <= 80; c++) assert.equal(generous.readCell(r, c), normal.readCell(r, c));
  }
});

test('failed working allocation leaves the last completed frame usable', () => {
  const source = fs.readFileSync(require.resolve('./mayatnik-cone-continuation.js'), 'utf8');
  class LimitedArray extends Int8Array { constructor(size) { if (size > 28) throw new RangeError('test allocation failure'); super(size); } }
  const context = { module: { exports: {} }, require: () => require('./mayatnik-core.js'), Int8Array: LimitedArray, Uint8Array };
  vm.runInNewContext(source, context);
  const engine = context.module.exports.create({ rows: 4, checkpointBytes: 0 });
  const before = engine.seek(7).left.slice();
  assert.throws(() => engine.seek(8), /Not enough memory/);
  assert.equal(engine.extend(8).k, 7);
  assert.deepEqual(engine.seek(7).left, before);
  assert.equal(engine.readCell(0, -1), -1);
});

test('copyTo matches finite cone mirroring and contributions without allowing aliases', () => {
  const engine = continuation.create({ rows: 5 });
  const state = engine.seek(22), target = new Int8Array(45), contribution = new Uint8Array(45);
  engine.copyTo(target, 'cone', true, contribution);
  assert.deepEqual(target, state.left);
  assert.deepEqual(contribution, Uint8Array.from(target, x => x === 1 ? 1 : 0));
  assert.throws(() => engine.copyTo(state.left), /alias/);
  assert.throws(() => engine.copyTo(target, 'field'), /only the cone/);
  assert.throws(() => engine.copyTo(target, 'cone', false, new Uint8Array(target.buffer)), /separate/);
  assert.throws(() => engine.copyTo(new Int8Array(1)), /matching/);
});

test('invalid options and frames fail explicitly without changing the current frame', () => {
  for (const rows of [0, 1.5, 4097, NaN]) assert.throws(() => continuation.create({ rows }), RangeError);
  assert.throws(() => continuation.create({ rows: 4, direction: 'left' }), RangeError);
  assert.throws(() => continuation.create({ rows: 4, pair: 1 }), TypeError);
  assert.throws(() => continuation.create({ rows: 4, checkpointBytes: -1 }), RangeError);
  const engine = continuation.create({ rows: 4 }); engine.seek(4);
  for (const frame of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => engine.seek(frame), RangeError);
  assert.equal(engine.extend(7).k, 4);
  assert.throws(() => engine.readCell(0, 1.5), RangeError);
});

test('browser global works with the core lexical binding and no CommonJS', () => {
  const context = vm.createContext({ Int8Array, Uint8Array });
  vm.runInContext(fs.readFileSync(require.resolve('./mayatnik-core.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(require.resolve('./mayatnik-cone-continuation.js'), 'utf8'), context);
  const browser = context.MayatnikConeContinuation.create({ rows: 5, direction: 'pendR' });
  assert.deepEqual(browser.seek(21).left, oracle(5, 'pendR', false, 21).crop);
});
