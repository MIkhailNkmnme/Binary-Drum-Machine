/* Reproducible CPU-only benchmark, no timers/canvas upload. Browser FPS is
   measured separately. Run: node _js/hub-xor-kernel.bench.cjs */
'use strict';
const { performance } = require('node:perf_hooks');
const assert = require('node:assert/strict');
const K = require('./hub-xor-kernel.js'), M = require('../mayatnik/mayatnik-core.js');
const W = 2047, H = 1024, center = W >> 1, count = 48, warm = 12;
function scalarSweep(a) {
  for (let r = 1; r < H; r++) {
    const base = r * W, up = base - W;
    for (let c = 0; c < W; c++) {
      const i = base + c; let v = a[i];
      if (c > 0) { const p = a[up + c - 1]; if (p >= 0) v = v < 0 ? p : v ^ p; }
      if (c + 1 < W) { const p = a[up + c + 1]; if (p >= 0) v = v < 0 ? p : v ^ p; }
      a[i] = v;
    }
  }
}
const scalar = [M.field(W, H, 'empty'), M.field(W, H, 'empty'), M.field(W, H, 'empty')];
const packed = [K.create(W, H), K.create(W, H), K.create(W, H)];
const images = [0, 1, 2].map(() => new Uint32Array(W * H)), output = new Int8Array(W * H);
const totals = { scalarCompute: 0, packedCompute: 0, scalarPaint: 0, packedPaint: 0, unpackStats: 0 };
function time(key, frame, fn) { const start = performance.now(); fn(); if (frame >= warm) totals[key] += performance.now() - start; }
for (let frame = 0; frame < count + warm; frame++) {
  const d = Math.ceil(frame / 2), pos = center + (frame % 2 ? -d : d), pair = !frame || frame % 2;
  time('scalarCompute', frame, () => {
    M.cone(scalar[0], pos, H); scalar[2].val[pos] = 1; scalarSweep(scalar[2].val);
    if (pair) { scalar[1].val[pos] = scalar[1].val[2 * center - pos] = 1; scalarSweep(scalar[1].val); }
  });
  time('packedCompute', frame, () => {
    K.cone(packed[0], pos); K.apex(packed[2], pos); K.sweep(packed[2], 1, H);
    if (pair) { K.apex(packed[1], pos); K.apex(packed[1], 2 * center - pos); K.sweep(packed[1], 1, H); }
  });
  time('scalarPaint', frame, () => {
    for (let k = 0; k < 3; k++) if (k !== 1 || pair) for (let i = 0; i < W * H; i++) images[k][i] = scalar[k].val[i] === 1 ? 0xff998877 : 0;
  });
  time('packedPaint', frame, () => { for (let k = 0; k < 3; k++) if (k !== 1 || pair) K.paint(packed[k], images[k], 0xff998877); });
  // Full-sized oracle compares every -1/0/1 cell on both sides of a pair step.
  if ([0, 1, 2, 8, 9, count + warm - 1].includes(frame)) for (let k = 0; k < 3; k++) assert.deepEqual(K.unpack(packed[k], output), scalar[k].val, 'full field ' + frame + '/' + k);
  time('unpackStats', frame, () => { for (let k = 0; k < 3; k++) K.unpack(packed[k], output); });
}
const ms = Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, +(v / count).toFixed(3)]));
console.log(JSON.stringify({ W, H, frames: count, warmup: warm, node: process.version, msPerFrame: ms,
  computeSpeedup: +(totals.scalarCompute / totals.packedCompute).toFixed(2),
  computeAndPaintSpeedup: +((totals.scalarCompute + totals.scalarPaint) / (totals.packedCompute + totals.packedPaint)).toFixed(2),
  fullFieldOracle: 'PASS: frames 0,1,2,8,9,59; all three fields, every cell' }, null, 2));
