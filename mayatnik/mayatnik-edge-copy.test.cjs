'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const EC = require('./mayatnik-edge-copy.js');
const MAYATNIK = require('./mayatnik-core.js');

function fieldValue(W, H) {
  const a = new Int8Array(W * H);
  for (let i = 0; i < a.length; i++) a[i] = i % 7 === 0 ? -1 : (i % 3 === 0 ? 1 : 0);
  return a;
}

for (const f of [2, 4, 6, 8]) {
  const H = 8, W = f * H - 1;
  test(`edge copy ${f}N−1: exact bits, both orientations`, () => {
    const val = fieldValue(W, H);
    for (const edgeClose of [false, true]) {
      const c = EC.copy(val, W, H, edgeClose);
      assert.equal(c.height, H);
      assert.equal(c.width, c.panels.Lw + c.panels.Rw);
      assert.ok(c.panels.Lw > 0 && c.panels.Rw > 0);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < c.width; x++) {
          const sx = EC.srcColumn(c.panels, x);
          assert.equal(c.data[y * c.width + x], val[y * W + sx], `bit mismatch f=${f} close=${edgeClose} x=${x} y=${y}`);
        }
      }
    }
  });
}

test('edge copy has no source column loss at 6N−1 and 8N−1', () => {
  for (const f of [6, 8]) {
    const H = 16, W = f * H - 1, val = fieldValue(W, H);
    const c = EC.copy(val, W, H, false);
    assert.equal(c.width, W - (2 * H - 1));
    const cols = new Set();
    for (let x = 0; x < c.width; x++) cols.add(EC.srcColumn(c.panels, x));
    assert.equal(cols.size, c.width, 'every copied column is distinct — no compression');
  }
});

test('2N−1: mirrorDown gives a full rhombus below, bit for bit', () => {
  const H = 12, W = 2 * H - 1, val = fieldValue(W, H), c = EC.mirrorDown(val, W, H);
  assert.equal(c.width, W); assert.equal(c.height, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) assert.equal(c.data[y * W + x], val[(H - 1 - y) * W + x]);
});

test('4N−1: right edge stands left, left edge stands right', () => {
  const H = 10, W = 4 * H - 1, val = fieldValue(W, H), c = EC.copy(val, W, H, true), p = c.panels;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < p.Rw; x++) assert.equal(c.data[y * c.width + x], val[y * W + p.Rs + x]);
    for (let x = 0; x < p.Lw; x++) assert.equal(c.data[y * c.width + p.Rw + x], val[y * W + x]);
  }
});

test('edge copy matches cone-built field bit-for-bit', () => {
  const H = 32, W = 4 * H - 1, f = MAYATNIK.field(W, H, 'empty', (W - 1) / 2);
  for (let k = 0; k < 24; k++) MAYATNIK.cone(f, (W - 1) / 2 + (k % 2 ? 1 : -1) * Math.ceil(k / 2), H);
  for (const edgeClose of [false, true]) {
    const c = EC.copy(f.val, W, H, edgeClose);
    for (let y = 0; y < H; y++) for (let x = 0; x < c.width; x++) {
      const sx = EC.srcColumn(c.panels, x);
      assert.equal(c.data[y * c.width + x], f.val[y * W + sx]);
    }
  }
});
