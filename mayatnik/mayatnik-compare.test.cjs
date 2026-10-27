const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const core = require('./mayatnik-core.js');
const compare = require('./mayatnik-compare.js');

// Independent whole-field oracle: collect the nonempty operands explicitly.
function expected(rows, direction, pair, operations) {
  const W = 2 * rows - 1, anchor = rows - 1;
  const cone = core.field(W, rows, 'empty', anchor), field = new Int8Array(W * rows).fill(-1);
  let vertices = 0, lo = 1, hi = 0;
  for (let k = 0; k < operations; k++) {
    const offset = k === 0 ? 0 : k % 2 ? -(k + 1) / 2 : k / 2;
    const positions = pair && k ? [anchor - k, anchor + k] : [anchor + (direction === 'pendR' ? -offset : offset)];
    if (positions.length === 2) core.conePair(cone, positions[0], positions[1], rows);
    else core.cone(cone, positions[0], rows);
    for (const position of positions) {
      field[position] = 1; vertices++;
      if (lo > hi) lo = hi = position - anchor;
      else { lo = Math.min(lo, position - anchor); hi = Math.max(hi, position - anchor); }
    }
    for (let r = 1; r < rows; r++) for (let c = 0; c < W; c++) {
      const values = [field[r * W + c], c ? field[(r - 1) * W + c - 1] : -1,
        c + 1 < W ? field[(r - 1) * W + c + 1] : -1].filter(value => value >= 0);
      field[r * W + c] = values.length ? values.reduce((a, b) => a ^ b) : -1;
    }
  }
  return { left: cone.val, right: field, vertices, lo, hi };
}

for (const rows of [1, 2, 3, 5, 8, 16]) for (const direction of ['pend', 'pendR']) for (const pair of [false, true]) {
  test(`${rows} rows / ${direction} / ${pair ? 'paired' : 'single'}: every operation and backward seek`, () => {
    const size = rows * (2 * rows - 1), engine = compare.create({ rows, direction, pair, checkpointBytes: 4 * size });
    const max = pair ? rows : 2 * rows - 1;
    for (const k of [...Array.from({ length: max + 1 }, (_, i) => i), ...Array.from({ length: max + 1 }, (_, i) => max - i)]) {
      const actual = engine.seek(k), want = expected(rows, direction, pair, k);
      assert.deepEqual(actual.left, want.left); assert.deepEqual(actual.right, want.right);
      assert.equal(actual.vertices, want.vertices); assert.equal(actual.lo, want.lo); assert.equal(actual.hi, want.hi);
      assert.equal(actual.W, 2 * rows - 1); assert.equal(actual.H, rows); assert.equal(actual.anchor, rows - 1);
      assert.equal(actual.k, k); assert.equal(actual.max, max);
      assert.ok(engine.memory().checkpointBytes <= 4 * size);
    }
  });
}

test('pair means one shared sweep after both seeds, and is different from two sequential sweeps', () => {
  const pair = compare.create({ rows: 5, pair: true }).seek(2);
  const sequential = compare.create({ rows: 5 }).seek(3);
  assert.equal(pair.vertices, 3); assert.equal(sequential.vertices, 3);
  assert.notDeepEqual(pair.right, sequential.right);
  assert.notDeepEqual(pair.left, sequential.left);
});

test('single operation 9 is Hub frame 8; cone and global inputs differ at the first added apex', () => {
  const engine = compare.create({ rows: 16 });
  const frame = engine.seek(9), want = expected(16, 'pend', false, 9);
  assert.deepEqual(frame.right, want.right); assert.equal(frame.vertices, 9);
  const first = engine.seek(2), i = first.W + first.anchor + 1;
  assert.equal(first.left[i], 1); assert.equal(first.right[i], 0);
});

test('5.9 both-sided field is symmetric, advances once per pair, and copies as pair', () => {
  const engine = compare.create({ rows: 16 });
  const symmetric = state => {
    const { W, H, both } = state;
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) if (both[r * W + c] !== both[r * W + (W - 1 - c)]) return false;
    return true;
  };
  const at2 = engine.seek(2), two = at2.both.slice();       // пара ±1 после шага 1
  const at3 = engine.seek(3), three = at3.both.slice();     // чётный шаг 2: 5.9 стоит
  assert.deepEqual(Array.from(three), Array.from(two), '5.9 advances only on pair steps');
  const at4 = engine.seek(4), four = at4.both;              // шаг 3: пара ±2
  assert.notDeepEqual(Array.from(four), Array.from(three), 'the next pair must change 5.9');
  for (const state of [at2, at3, at4]) assert.ok(symmetric(state), '5.9 must stay mirror-symmetric');
  const host = new Int8Array(at4.W * at4.H);
  engine.copyTo(host, 'pair');
  assert.deepEqual(Array.from(host), Array.from(four));
});

test('all ternary XOR/AND operands preserve empty union, reflect only the right input, and identify contributions', () => {
  const engine = compare.create({ rows: 5 }), state = engine.seek(0), size = state.W * state.H;
  const values = [-1, 0, 1];
  for (let i = 0; i < size; i++) { state.left[i] = values[Math.floor(i / 3) % 3]; state.right[i] = values[i % 3]; }
  const beforeLeft = state.left.slice(), beforeRight = state.right.slice();
  const output = new Int8Array(size), flags = new Uint8Array(size);
  for (const source of ['cone', 'field', 'xor', 'and']) for (const mirror of [false, true]) {
    assert.equal(engine.copyTo(output, source, mirror, flags), output);
    for (let r = 0; r < state.H; r++) for (let c = 0; c < state.W; c++) {
      const i = r * state.W + c, j = r * state.W + (mirror ? state.W - 1 - c : c);
      const a = beforeLeft[i], b = beforeRight[j];
      const want = source === 'cone' ? a : source === 'field' ? b : a < 0 && b < 0 ? -1 : source === 'xor' ? Number((a === 1) !== (b === 1)) : Number(a === 1 && b === 1);
      assert.equal(output[i], want);
      assert.equal(flags[i], (source !== 'field' && a === 1 ? 1 : 0) | (source !== 'cone' && b === 1 ? 2 : 0));
    }
  }
  assert.deepEqual(state.left, beforeLeft); assert.deepEqual(state.right, beforeRight);
});

test('no-checkpoint backward replay is exact, retains the same working buffers, and does not alias host output', () => {
  const engine = compare.create({ rows: 8, checkpointBytes: 0 });
  const initial = engine.seek(0), l = initial.left, r = initial.right;
  const host = new Int8Array(initial.W * initial.H).fill(77);
  engine.seek(15); engine.copyTo(host, 'xor'); const savedHost = host.slice();
  const back = engine.seek(3);
  assert.equal(back.left, l); assert.equal(back.right, r);
  assert.deepEqual(back.right, expected(8, 'pend', false, 3).right);
  assert.deepEqual(host, savedHost); assert.equal(engine.memory().checkpointCount, 0);
  assert.equal(engine.memory().workingBytes, 3 * host.length);
});

test('4096 rows allocate no checkpoint when one pair of snapshots exceeds the default 32 MiB budget', () => {
  const engine = compare.create({ rows: 4096 }), memory = engine.memory();
  assert.equal(memory.workingBytes, 3 * 4096 * 8191);
  assert.equal(memory.checkpointLimit, 0); assert.equal(memory.checkpointBytes, 0);
});

test('reject invalid configuration, out-of-sequence seeks, and destructive or invalid targets before mutation', () => {
  for (const rows of [0, -1, 1.5, NaN, 4097]) assert.throws(() => compare.create({ rows }));
  assert.throws(() => compare.create({ rows: 5, direction: 'right' }));
  assert.throws(() => compare.create({ rows: 5, pair: 1 }));
  assert.throws(() => compare.create({ rows: 5, checkpointBytes: -1 }));
  const engine = compare.create({ rows: 5 }), state = engine.seek(2), before = state.right.slice();
  for (const k of [-1, 10, 1.2, Infinity]) assert.throws(() => engine.seek(k));
  assert.throws(() => engine.copyTo(state.left, 'xor'));
  assert.throws(() => engine.copyTo(state.right, 'and'));
  assert.throws(() => engine.copyTo(new Int8Array(2), 'cone'));
  const out = new Int8Array(45).fill(77);
  assert.throws(() => engine.copyTo(out, 'wrong'));
  assert.throws(() => engine.copyTo(out, 'xor', false, new Uint8Array(out.buffer)));
  assert.ok(out.every(value => value === 77)); assert.deepEqual(state.right, before);
});

test('browser global uses the same core and API without CommonJS or DOM', () => {
  const context = vm.createContext({ Int8Array, Uint8Array });
  vm.runInContext(fs.readFileSync(require.resolve('./mayatnik-core.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(require.resolve('./mayatnik-compare.js'), 'utf8'), context);
  const engine = context.MayatnikCompare.create({ rows: 5 });
  const result = engine.seek(4); assert.deepEqual(result.right, expected(5, 'pend', false, 4).right);
  assert.deepEqual(engine.copyTo(new Int8Array(45), 'field'), result.right);
});
