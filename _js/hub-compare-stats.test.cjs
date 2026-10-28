'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const { createTracker, formatFrames } = require('./hub-compare-stats.js');

function brute(a) {
  const ones = Array.from(a).filter(v => v === 1).length;
  const zeros = Array.from(a).filter(v => v === 0).length;
  return { ones, zeros, empty: a.length - ones - zeros, occupied: ones + zeros,
    delta: ones - zeros, balanced: ones + zeros > 0 && ones === zeros };
}
test('browser global and CommonJS exports', () => {
  const context = {};
  vm.runInNewContext(fs.readFileSync(require.resolve('./hub-compare-stats.js'), 'utf8'), context);
  assert.equal(typeof context.HubCompareStats.createTracker, 'function');
});
test('strict empty identity and reflection differ from equal counts', () => {
  const t = createTracker({ W: 3, H: 2 });
  const a = [-1, 0, 1, 1, 0, -1], b = [1, 0, -1, -1, 0, 1];
  const r = t.record({ left: a, right: b, frame: 0 });
  assert.deepEqual(r.left, brute(a));
  assert.deepEqual(r.right, brute(b));
  assert.equal(r.countsEqual, true);
  assert.equal(r.fieldsEqual, false);
  assert.equal(r.fieldsMirrorEqual, true);
  const emptyVsZero = createTracker({ W: 1, H: 1 }).record({ left: [-1], right: [0], frame: 0 });
  assert.equal(emptyVsZero.fieldsEqual, false);
  assert.equal(emptyVsZero.left.zeros, 0);
  assert.equal(emptyVsZero.left.balanced, false);
});
test('all 729 pairs of 3-cell fields match an independent oracle', () => {
  const fields = [];
  for (let n = 0; n < 27; n++) fields.push([n % 3 - 1, Math.floor(n / 3) % 3 - 1, Math.floor(n / 9) - 1]);
  for (const left of fields) for (const right of fields) {
    const result = createTracker({ W: 3, H: 1 }).record({ left, right, frame: 0 });
    assert.deepEqual(result.left, brute(left));
    assert.deepEqual(result.right, brute(right));
    assert.equal(result.countsEqual, left.slice().sort().join() === right.slice().sort().join());
    assert.equal(result.fieldsEqual, left.every((v, i) => v === right[i]));
    assert.equal(result.fieldsMirrorEqual, left.every((v, i) => v === right[2 - i]));
  }
});
test('cycle sums and cumulative balance moments include frame zero and hidden 1..7', () => {
  const t = createTracker({ W: 9, H: 1 });
  const ones = Array(9).fill(1), zeros = Array(9).fill(0), empty = Array(9).fill(-1);
  for (let frame = 0; frame < 9; frame++) {
    const left = frame % 2 === 0 ? ones : zeros;
    t.record({ left, right: frame < 8 ? left : empty, frame, cycle: 7 });
  }
  const s = t.snapshot();
  assert.equal(s.cycle.complete, true);
  assert.deepEqual(s.cycle.totals.left, brute([...ones, ...zeros, ...ones, ...zeros, ...ones, ...zeros, ...ones, ...zeros, ...ones]));
  assert.deepEqual(s.cycle.events.cumulativeBalanceBoth.frames, [1, 3, 5, 7]);
  assert.deepEqual(s.cycle.events.fieldsEqual, { count: 8, frames: [0,1,2,3,4,5,6,7], ranges: [[0,7]] });
  t.record({ left: empty, right: empty, frame: 0, cycle: 8 });
  assert.equal(t.snapshot().previousCycle.id, 7);
  assert.equal(t.snapshot().previousCycle.frames, 9);
  assert.equal(t.snapshot().cycle.totals.left.ones, 0);
  const compact = t.snapshot({ includeFrames: false });
  assert.equal('frames' in compact.previousCycle.events.fieldsEqual, false);
  assert.equal('frames' in compact.cycle.events.fieldsEqual, false);
});
test('rejects skipped, duplicate, invalid and premature rollover atomically', () => {
  const t = createTracker({ W: 2, H: 1 });
  const base = { left: [1, 0], right: [1, 0], frame: 0 };
  assert.throws(() => t.record({ ...base, frame: 1 }), /start/);
  t.record(base);
  const before = t.snapshot();
  for (const bad of [base, { ...base, cycle: 1 }, { ...base, frame: 1, left: [1, 2] }, { ...base, frame: 1, right: [] }]) {
    assert.throws(() => t.record(bad));
    assert.deepEqual(t.snapshot(), before);
  }
  t.record({ ...base, frame: 1 });
  assert.throws(() => t.record(base));
  assert.throws(() => t.record({ ...base, cycle: -1 }));
  t.reset();
  assert.equal(t.snapshot().current, null);
  t.record(base);
});
test('returned summaries cannot mutate tracker history or retain source buffers', () => {
  const t = createTracker({ W: 1, H: 1 }), left = [1], right = [1];
  const r = t.record({ left, right, frame: 0 });
  left[0] = 0; right[0] = -1; r.left.ones = 300;
  const snap = t.snapshot(); snap.cycle.events.fieldsEqual.frames.push(999);
  assert.equal(t.snapshot().current.left.ones, 1);
  assert.deepEqual(t.snapshot().cycle.events.fieldsEqual.frames, [0]);
});
test('area totals preserve multiplicities, overlap sums and nontrivial equality', () => {
  const t = createTracker({ W: 2, H: 1 });
  const side = { figureCount: 3, sum: 12, figures: [{ kind:'triangle',name:'triangle',n:4,count:3 }], repeated:[{ n:4,count:3 }] };
  const areas = { left: side, right: side, shared:[{ n:4,left:3,right:3 }], histogramEqual:true, namedHistogramEqual:true };
  const r = t.record({ left:[1,0], right:[1,0], frame:0, areas });
  assert.equal(r.cumulativeAreas.left.sum, 12);
  areas.left.sum = 999;
  assert.equal(t.snapshot().current.areas.left.sum, 12);
  const empty = { figureCount:0, sum:0, repeated:[] };
  t.record({ left:[0,1], right:[0,1], frame:1, areas:{ left:empty,right:empty,shared:[],histogramEqual:true,namedHistogramEqual:true } });
  const s = t.snapshot();
  assert.equal(s.cycle.areas.left.figureCount, 3);
  assert.deepEqual(s.cycle.events.areasEqual.frames, [0]);
  assert.deepEqual(s.cycle.events.cumulativeAreaSumsEqual.frames, [0,1]);
  assert.deepEqual(s.cycle.events.repeatedAreasLeft.frames, [0]);
});
test('frame formatting compresses consecutive moments without losing isolated zero', () => {
  assert.equal(formatFrames([0, 2, 3, 4, 8, 10, 11]), '0, 2–4, 8, 10–11');
  assert.equal(formatFrames([]), '');
});
test('1024-row source scan has exact full-size counts', () => {
  const W = 2047, H = 1024, N = W * H;
  const left = new Int8Array(N), right = new Int8Array(N);
  for (let i = 0; i < N; i++) left[i] = right[i] = i % 3 - 1;
  const start = performance.now();
  const r = createTracker({ W,H }).record({ left,right,frame:0 });
  const elapsed = performance.now() - start;
  assert.deepEqual(r.left, brute(left));
  assert.equal(r.fieldsEqual, true);
  console.log('2047×1024 exact stats scan: ' + elapsed.toFixed(1) + ' ms');
});
test('middle 5.9 is counted; all-three direct, mirror and count events are exact', () => {
  const symmetric = [0, 1, 0], other = [1, 1, 0];
  const same = createTracker({ W: 3, H: 1 }).record({ left: symmetric, middle: symmetric, right: symmetric, frame: 0 });
  assert.deepEqual(same.middle, brute(symmetric));
  assert.equal(same.countsEqualAll, true);
  assert.equal(same.fieldsEqualAll, true);
  assert.equal(same.fieldsMirrorEqualAll, true);
  const split = createTracker({ W: 3, H: 1 });
  const r = split.record({ left: symmetric, middle: other, right: symmetric, frame: 0 });
  assert.deepEqual(r.middle, brute(other));
  assert.equal(r.countsEqual, true, 'legacy 5.7/5.8 pair is unchanged');
  assert.equal(r.fieldsEqual, true);
  assert.equal(r.countsEqualAll, false);
  assert.equal(r.fieldsEqualAll, false);
  assert.equal(r.fieldsMirrorEqualAll, false);
  const s = split.snapshot();
  assert.deepEqual(s.cycle.events.fieldsEqual.frames, [0]);
  assert.deepEqual(s.cycle.events.fieldsEqualAll.frames, []);
  assert.equal(s.cycle.totals.middle.ones, 2);
  assert.equal(s.cycle.totals.countsEqualAll, false);
});
test('middle field must stay the same within a cycle and invalid middle data is rejected atomically', () => {
  const t = createTracker({ W: 2, H: 1 });
  const base = { left: [1, 0], middle: [1, 0], right: [1, 0], frame: 0 };
  t.record(base);
  const before = t.snapshot();
  assert.throws(() => t.record({ left: [1, 0], right: [1, 0], frame: 1 }), /consistent/);
  assert.throws(() => t.record({ ...base, frame: 1, middle: [1, 2] }), /middle field/);
  assert.deepEqual(t.snapshot(), before);
  t.record({ ...base, frame: 1 });
  assert.equal(t.snapshot().cycle.frames, 2);
});
test('partial start begins at the current frame and completes at the cycle wrap', () => {
  const t = createTracker({ W: 5, H: 1 });
  t.startFrom();
  const a = new Array(5).fill(0), b = new Array(5).fill(0);
  const first = t.record({ left: a, middle: a, right: b, frame: 3 });
  assert.equal(first.frame, 3);
  assert.equal(t.snapshot().cycle.startFrame, 3);
  assert.equal(t.snapshot().cycle.partial, true);
  t.record({ left: a, middle: a, right: b, frame: 4 });
  assert.equal(t.snapshot().cycle.complete, true);
  assert.equal(t.snapshot().cycle.frames, 2);
  t.record({ left: a, middle: a, right: b, frame: 0, cycle: 1 });
  assert.equal(t.snapshot().previousCycle.startFrame, 3);
  assert.equal(t.snapshot().previousCycle.partial, true);
});
test('all-three area events require the middle summary and use cumulative sums', () => {
  const t = createTracker({ W: 2, H: 1 });
  const side = { figureCount: 3, sum: 12, figures: [{ kind:'triangle',name:'triangle',n:4,count:3 }], repeated:[{ n:4,count:3 }] };
  const areas = { left: side, middle: side, right: side,
    shared:[{ n:4,left:3,right:3 }], sharedAll:[{ n:4,left:3,middle:3,right:3 }],
    histogramEqual:true, histogramEqualAll:true, namedHistogramEqual:true, namedHistogramEqualAll:true };
  const r = t.record({ left:[1,0], middle:[1,0], right:[1,0], frame:0, areas });
  assert.equal(r.cumulativeAreas.middle.sum, 12);
  assert.equal(r.cumulativeAreas.sumsEqualAll, true);
  const events = t.snapshot().cycle.events;
  assert.deepEqual(events.areasEqualAll.frames, [0]);
  assert.deepEqual(events.namedAreasEqualAll.frames, [0]);
  assert.deepEqual(events.areaSumsEqualAll.frames, [0]);
  assert.deepEqual(events.cumulativeAreaSumsEqualAll.frames, [0]);
  assert.deepEqual(events.repeatedAreasMiddle.frames, [0]);
  const empty = { figureCount:0, sum:0, repeated:[] };
  t.record({ left:[0,1], middle:[0,1], right:[0,1], frame:1, areas:{ left:empty,middle:empty,right:empty,
    shared:[],sharedAll:[],histogramEqual:true,histogramEqualAll:true,namedHistogramEqual:true,namedHistogramEqualAll:true } });
  assert.deepEqual(t.snapshot().cycle.events.cumulativeAreaSumsEqualAll.frames, [0,1]);
});
