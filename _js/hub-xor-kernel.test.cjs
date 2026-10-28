'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const K = require('./hub-xor-kernel.js'), M = require('../mayatnik/mayatnik-core.js');
// Independent scalar oracle: the original -1/0/1 per-cell recurrence.
function sweep(a, W, H, from = 1, to = H) {
  for (let r = from; r < to; r++) for (let c = 0; c < W; c++) {
    const i = r * W + c, up = i - W;
    let v = a[i];
    for (const p of [c ? a[up - 1] : -1, c + 1 < W ? a[up + 1] : -1]) if (p >= 0) v = v < 0 ? p : v ^ p;
    a[i] = v;
  }
}
function pack(a, W, H) {
  const f = K.create(W, H);
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    const v = a[r * W + c], i = r * f.stride + (c >>> 5), bit = 1 << (c & 31);
    if (v >= 0) f.valid[i] |= bit;
    if (v === 1) f.bits[i] |= bit;
  }
  return f;
}
function equal(f, a, label) { assert.deepEqual(K.unpack(f, new Int8Array(a.length)), a, label); }
test('all three fields match scalar at every adjacent frame, odd/even pair step, edges and cycle reset', () => {
  for (const H of [5, 17, 34]) {
    const W = 2 * H - 1, center = W >> 1;
    const cones = M.field(W, H, 'empty'), global = new Int8Array(W * H), pair = new Int8Array(W * H);
    const pc = K.create(W, H), pg = K.create(W, H), pp = K.create(W, H);
    for (let step = 0; step < W * 2 + 2; step++) {
      const frame = step % W;
      if (!frame) { cones.val.fill(-1); global.fill(-1); pair.fill(-1); K.reset(pc); K.reset(pg); K.reset(pp); }
      const d = Math.ceil(frame / 2), pos = center + (frame % 2 ? -d : d);
      M.cone(cones, pos, H); K.cone(pc, pos);
      global[pos] = 1; K.apex(pg, pos); sweep(global, W, H); K.sweep(pg, 1, H);
      if (!frame || frame % 2) {
        pair[pos] = pair[2 * center - pos] = 1; K.apex(pp, pos); K.apex(pp, 2 * center - pos);
        sweep(pair, W, H); K.sweep(pp, 1, H);
      }
      equal(pc, cones.val, 'cone ' + H + '/' + step); equal(pg, global, 'global ' + H + '/' + step); equal(pp, pair, 'pair ' + H + '/' + step);
    }
  }
});
test('partial fields preserve empty versus zero, word boundaries, cone clipping and partial-row continuation', () => {
  for (const W of [1, 31, 32, 33, 63, 64, 65, 2047]) {
    const H = 11, values = new Int8Array(W * H);
    let seed = 0x134ab;
    for (let i = 0; i < values.length; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; values[i] = seed % 3 - 1; }
    const f = pack(values, W, H), expected = values.slice();
    sweep(expected, W, H, 1, 4); K.sweep(f, 1, 4); equal(f, expected, 'partial rows');
    sweep(expected, W, H, 4, H); K.sweep(f, 4, H); equal(f, expected, 'continued rows');
    for (const pos of [0, W >> 1, W - 1]) {
      const c = pack(values, W, H), scalar = { W, H, val: values.slice() };
      M.cone(scalar, pos, H); K.cone(c, pos); equal(c, scalar.val, 'clipped cone ' + W + '/' + pos);
    }
  }
});
test('packed paint and every XOR/AND subset use exact colours in direct and mirrored coordinates', () => {
  const colours = [0xff123456, 0xffabcdef, 0xff675849], common = 0xff998877;
  for (const W of [9, 31, 32, 33, 65, 2047]) {
    const H = 5, scalar = [0, 1, 2].map(k => Int8Array.from({ length: W * H }, (_, i) => ((i * (k + 3) + (i >>> (k + 1))) % 7) % 3 - 1));
    const packed = scalar.map(a => pack(a, W, H)), pixels = new Uint32Array(W * H);
    for (let k = 0; k < 3; k++) {
      K.paint(packed[k], pixels, colours[k]);
      assert.deepEqual(pixels, Uint32Array.from(scalar[k], v => v === 1 ? colours[k] : 0));
    }
    for (let subset = 1; subset < 8; subset++) for (const and of [false, true]) for (const mirror of [false, true]) {
      const ids = [0, 1, 2].filter(k => subset & 1 << k);
      K.blend(ids.map(k => ({ data: packed[k], mirror: k !== 0 })), pixels, and, mirror, ids.map(k => colours[k]), common);
      const expected = new Uint32Array(W * H);
      for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
        const on = ids.filter(k => scalar[k][r * W + (mirror && k ? W - 1 - c : c)] === 1);
        if (and ? on.length === ids.length : on.length % 2) expected[r * W + c] = and ? common : colours[on[0]];
      }
      assert.deepEqual(pixels, expected, JSON.stringify({ W, subset, and, mirror }));
    }
  }
});
