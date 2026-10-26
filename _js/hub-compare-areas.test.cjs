const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const areas = require('./hub-compare-areas.js');
const MAYATNIK = require('../mayatnik/mayatnik-core.js');

// Independent oracle: run the actual current Mayatnik functions, preserving its
// cell-by-cell polygon tests. Only remove its presentation limit of 60 figures.
const source = fs.readFileSync(path.join(__dirname, '../mayatnik/Zerkalius-mayatnik.html'), 'utf8');
function section(start, end) { return source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start))); }
const oracleCode = section('  function areaCalc()', '  function fixPad(')
  .replace('if(tris.length>=60)break;', '') +
  section('  function areaTriPts(', '  function areaTriLines(') +
  section('  function cellIn(', '  function inPoly(') +
  section('  function areaFigs(', '  // v0.300:');

function oracle(values, W, H, frame, saw = true, sawFull = true) {
  const X = (W >> 1) - (frame % 2) / 2, Y = (frame + 2) / 2;
  const context = vm.createContext({ f: { W, H, val: values }, geo: { anchor: W >> 1 }, k: frame + 1,
    VX: 0, VW: W, VH: H, st: { rows: H, mode: 'pend', saw, sawFull },
    rombP: () => -1, pairOn: () => false, MAYATNIK,
    areaFrame: () => ({ q: [0, 0, Y, 0, X], H }),
    AREA_LET_PAL: ['white'], areaLetter: i => String(i) });
  vm.runInContext(oracleCode + ';result=areaFigs(areaCalc());', context);
  const groups = new Map();
  for (const f of context.result) {
    const key = f.nm + ':' + f.n;
    groups.set(key, (groups.get(key) || 0) + 1);
  }
  return [...groups].sort();
}
function actual(side) { return side.figures.map(f => [f.name + ':' + f.n, f.count]).sort(); }
function build(W, H, frame) {
  const f = MAYATNIK.field(W, H, 'empty', W >> 1), xor = new Int8Array(W * H).fill(-1);
  for (let k = 0; k <= frame; k++) {
    const pos = (W >> 1) + MAYATNIK.offset('pend', k);
    MAYATNIK.cone(f, pos, H); xor[pos] = 1;
    for (let r = 1; r < H; r++) for (let c = 0; c < W; c++) {
      const i = r * W + c;
      let v = xor[i];
      for (const p of [c > 0 ? xor[i - W - 1] : -1, c + 1 < W ? xor[i - W + 1] : -1]) {
        if (p >= 0) v = v < 0 ? p : v ^ p;
      }
      xor[i] = v;
    }
  }
  return { left: f.val, right: xor, W, H, frame };
}

test('all finite small frames match actual Mayatnik polygon and triangle counts', () => {
  const analyzer = areas.createAnalyzer();
  for (const [W, H] of [[15, 8], [31, 16], [63, 32]]) {
    for (let frame = 0; frame < W; frame++) {
      const input = build(W, H, frame), result = analyzer.analyzeAreas(input);
      assert.deepEqual(actual(result.left), oracle(input.left, W, H, frame), 'cone frame ' + frame + ' W ' + W);
      assert.deepEqual(actual(result.right), oracle(input.right, W, H, frame), 'xor frame ' + frame + ' W ' + W);
      assert.equal(result.geometry.H, H);
    }
  }
});

test('strict edges, empty corners and same-size equality preserve source semantics', () => {
  const W = 25, H = 13, values = new Int8Array(W * H).fill(-1);
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) if ((r * 17 + c * 11) % 7 > 1) values[r * W + c] = (r + c) % 2;
  for (const frame of [0, 1, 8, 23, 24]) {
    const result = areas.analyzeAreas({ left: values, right: values, W, H, frame });
    assert.deepEqual(actual(result.left), oracle(values, W, H, frame));
    assert.equal(result.histogramEqual, true);
    assert.equal(result.namedHistogramEqual, true);
  }
});

test('more than sixty inverse triangles are counted without truncation', () => {
  const W = 129, H = 81, values = new Int8Array(W * H).fill(-1);
  for (let y = 8; y + 4 < H; y += 8) for (let c = 4; c + 4 < W; c += 9) {
    for (let r = 0; r < 4; r++) for (let dx = -(3 - r); dx <= 3 - r; dx++) values[(y + r) * W + c + dx] = 0;
  }
  const result = areas.analyzeAreas({ left: values, right: values, W, H, frame: 8, saw: false });
  assert.deepEqual(actual(result.left), oracle(values, W, H, 8, false));
  assert.ok(result.left.figures.find(f => f.kind === 'down4').count > 60);
});

test('overlapping and separated zero triangles retain the original apex nesting rule', () => {
  const W = 63, H = 32;
  for (const pattern of ['zero', 'islands']) {
    const values = new Int8Array(W * H);
    if (pattern === 'islands') {
      for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
        values[r * W + c] = c % 17 === 0 || r % 13 === 0 ? 1 : 0;
      }
    }
    for (const frame of [0, 1, 8, 31, 62]) {
      const result = areas.analyzeAreas({ left: values, right: values, W, H, frame });
      assert.deepEqual(actual(result.left), oracle(values, W, H, frame), pattern + ' frame ' + frame);
    }
  }
});

test('input grids remain immutable and reusable analyzer rejects malformed frames', () => {
  const input = build(31, 16, 8), before = [input.left.slice(), input.right.slice()];
  const a = areas.createAnalyzer(), first = a.analyzeAreas(input);
  a.analyzeAreas(build(15, 8, 7));
  assert.deepEqual(a.analyzeAreas(input), first);
  assert.deepEqual(input.left, before[0]); assert.deepEqual(input.right, before[1]);
  assert.throws(() => a.analyzeAreas({ ...input, frame: 31 }), RangeError);
});

module.exports = { build };
