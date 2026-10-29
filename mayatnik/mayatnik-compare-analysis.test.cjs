const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Core = require('./mayatnik-core.js');
const Analysis = require('./mayatnik-compare-analysis.js');
const Compare = require('./mayatnik-compare.js');

function oracle(o) {
  const H = o.rows, W = 2 * H - 1, anchor = H - 1, max = o.steps ?? (o.pair ? H : W);
  const cone = Core.field(W, H, 'empty', anchor), global = new Int8Array(W * H).fill(-1);
  const frames = [new Int8Array(W * H).fill(-1)], lastAt = new Int32Array(W * H).fill(-1);
  for (let k = 1; k <= max; k++) {
    const positions = o.pair && k > 1 ? [anchor - k + 1, anchor + k - 1] : [anchor + Core.offset(o.direction, o.pair ? 0 : k - 1)];
    if (positions.length === 2) Core.conePair(cone, positions[0], positions[1], H);
    else Core.cone(cone, positions[0], H);
    for (const p of positions) global[p] = 1;
    for (let r = 1; r < H; r++) for (let c = 0; c < W; c++) {
      const q = r * W + c, inputs = [global[q], c ? global[q - W - 1] : -1, c + 1 < W ? global[q - W + 1] : -1].filter(x => x >= 0);
      global[q] = inputs.length ? inputs.reduce((a, b) => a ^ b) : -1;
    }
    const field = new Int8Array(W * H);
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
      const q = r * W + c, a = cone.val[q], b = global[r * W + (o.mirror ? W - 1 - c : c)];
      field[q] = o.source === 'cone' ? a : o.source === 'field' ? b : a < 0 && b < 0 ? -1 : o.source === 'xor' ? Number((a === 1) !== (b === 1)) : Number(a === 1 && b === 1);
      if (field[q] !== frames[k - 1][q]) lastAt[q] = k;
    }
    frames.push(field);
  }
  return { frames, lastAt, W, H, max };
}

test('exact future maps match independent full histories for all sources, mirrors, directions and pair modes', async () => {
  const analyzer = Analysis.createFrozenAnalyzer({ preferWorker: false, yieldTask: () => Promise.resolve() });
  for (const direction of ['pend', 'pendR']) for (const pair of [false, true]) for (const source of ['cone', 'field', 'xor', 'and']) for (const mirror of [false, true]) {
    const options = { rows: 9, direction, pair, source, mirror }, expected = oracle(options);
    const pending = analyzer.ensure(options);
    assert.equal(pending.lastAt, null); assert.equal(pending.status, 'pending');
    const result = await pending.promise;
    assert.equal(result.status, 'ready'); assert.deepEqual(result.lastAt, expected.lastAt, JSON.stringify(options));
    assert.equal(analyzer.ensure(options), result, 'same configuration reuses the completed map');
    for (let k = 0; k <= expected.max; k++) for (let q = 0; q < expected.lastAt.length; q++) {
      const stable = expected.lastAt[q] >= 0 && expected.lastAt[q] <= k;
      if (stable) for (let future = k + 1; future <= expected.max; future++) assert.equal(expected.frames[future][q], expected.frames[k][q]);
    }
  }
});

test('cancellation releases the current job and cannot publish a partial map', async () => {
  let release, ready = 0;
  const analyzer = Analysis.createFrozenAnalyzer({ preferWorker: false,
    yieldTask: () => new Promise(resolve => { release = resolve; }), onReady: () => ready++ });
  const record = analyzer.ensure({ rows: 8, source: 'field' });
  await Promise.resolve();
  assert.equal(typeof release, 'function');
  analyzer.cancel(); release();
  assert.equal((await record.promise).status, 'cancelled');
  await Promise.resolve(); assert.equal(record.lastAt, null); assert.equal(ready, 0); assert.equal(analyzer.current(), null);
});

test('a shortened construction horizon has its own exact map and cache identity', async () => {
  const analyzer = Analysis.createFrozenAnalyzer({ preferWorker: false, yieldTask: () => Promise.resolve() });
  for (const pair of [false, true]) {
    const options = { rows: 9, direction: 'pend', pair, source: 'field', mirror: false };
    const full = await analyzer.ensure(options).promise;
    const short = await analyzer.ensure({ ...options, steps: 3 }).promise;
    assert.notEqual(short.key, full.key); assert.equal(short.total, 3);
    assert.deepEqual(short.lastAt, oracle({ ...options, steps: 3 }).lastAt);
    assert.ok(short.lastAt.some((n, i) => n !== full.lastAt[i]));
  }
});

test('worker failure falls back to the same exact scan without exposing partial results', async () => {
  const script = fs.readFileSync(path.join(__dirname, 'mayatnik-compare-analysis.js'), 'utf8');
  let terminated = 0;
  class BrokenWorker {
    postMessage() { queueMicrotask(() => this.onerror({ preventDefault() {} })); }
    terminate() { terminated++; }
  }
  const context = vm.createContext({ MayatnikCompare: Compare, Worker: BrokenWorker, URL, Int8Array, Int32Array,
    document: { currentScript: { src: 'https://example.test/mayatnik/mayatnik-compare-analysis.js' } }, setTimeout });
  vm.runInContext(script, context);
  const options = { rows: 8, direction: 'pendR', source: 'xor', mirror: true };
  const result = await context.MayatnikCompareAnalysis.createFrozenAnalyzer({ yieldTask: () => Promise.resolve() }).ensure(options).promise;
  assert.equal(result.status, 'ready'); assert.equal(terminated, 1);
  assert.deepEqual(result.lastAt, oracle(options).lastAt);
});

const html = fs.readFileSync(path.join(__dirname, 'Zerkalius-mayatnik.html'), 'utf8');
function section(start, end) { const a = html.indexOf(start); assert.ok(a >= 0, start); const b = html.indexOf(end, a + start.length); assert.ok(b > a, end); return html.slice(a, b); }
const geometryCode = section('  function figureBounds()', '  function zoneCalc(') +
  section('  function fixSegments(', '  function fixLinesDraw(') +
  section('  function fixPts(', '  function fixMirrorApply(') +
  section('  function areaFrame(', '  function fixPad(') +
  section('  function areaTriPts(', '  function areaTriLines(') +
  section('  function cellIn(', '  function inPoly(') +
  section('  function areaFigs(', '  // v0.300:');

test('host geometry counts actual finite fields and keeps common cone points for every source', () => {
  for (const direction of ['pend', 'pendR']) for (const pair of [false, true]) {
    const engine = Compare.create({ rows: 8, direction, pair }), max = pair ? 8 : 15;
    for (const k of [1, 2, max - 1, max]) for (const source of ['cone', 'field', 'xor', 'and']) {
      const state = engine.seek(k), val = new Int8Array(state.W * state.H); engine.copyTo(val, source, true);
      const context = vm.createContext({ f: { W: state.W, H: state.H, val }, geo: { anchor: state.anchor }, k,
        VX: 0, VW: state.W, VH: state.H, st: { mode: direction, rows: state.H, fixLines: true, compareSource: source, compareMirror: true, saw: false },
        compareOn: () => true, compareSpan: () => [state.lo, state.hi], total: () => max, rombP: () => -1, pairOn: () => pair,
        fixBound: () => true, AREA_LET_PAL: ['white'], areaLetter: String });
      vm.runInContext(geometryCode + ';result=areaCalc();figures=areaFigs(result);bounds=figureBounds();', context);
      assert.equal(context.result.H, state.H);
      assert.equal(context.result.X, state.anchor + (state.lo + state.hi) / 2);
      assert.equal(context.result.Y, (state.hi - state.lo + 2) / 2);
      let upper = 0;
      for (let r = 0; r < state.H; r++) {
        let first = state.W, last = -1;
        for (let c = 0; c < state.W; c++) if (val[r * state.W + c] >= 0) {
          first = Math.min(first, c); last = c;
          if (r > 0 && Math.abs(c - context.result.X) < context.result.Y - r) upper++;
        }
        assert.equal(context.bounds[0][r], first); assert.equal(context.bounds[1][r], last);
      }
      assert.equal(context.figures.find(f => f.nm === 'верх')?.n || 0, upper);
      for (const figure of context.figures) assert.ok(figure.cells.every(q => q >= 0 && q < val.length));
    }
  }
});

test('host freeze consumers keep pending cells mutable and read the exact completed map', () => {
  const values = Int8Array.from([1, 0, -1, 1, 0, 1]), map = { lastAt: null };
  const context = vm.createContext({ f: { W: 3, H: 2, val: values }, geo: { anchor: 1 }, k: 2,
    compareOn: () => true, compareFrozen: () => map, coneContinueUse: () => false, st: {}, total: () => 3,
    freezeCache: new Int32Array(6), freezeRowDone: new Uint8Array(2) });
  vm.runInContext(section('  function cellFreezeFrame(', '  function templateLockCheck(') +
    section('  function freezeRow(', '  const freezeInit=') +
    section('  function fixFrozen(', '  function fixSegments(') +
    ';pending=cellFreezeFrame(0,0);pendingFrozen=fixFrozen()(0,0);freezeRow(0);', context);
  assert.equal(context.pending, Infinity); assert.equal(context.pendingFrozen, false);
  assert.equal(context.freezeCache[0], 2147483647);
  map.lastAt = Int32Array.from([1, 3, -1, 2, 3, 1]);
  vm.runInContext('freezeRow(0);exact=cellFreezeFrame(0,0);stable=fixFrozen()(0,0);moving=fixFrozen()(0,1);', context);
  assert.equal(context.exact, 1); assert.equal(context.stable, true); assert.equal(context.moving, false);
  assert.deepEqual([...context.freezeCache.slice(0, 3)], [1, 3, 2147483647]);
});

test('whole-field heat follows actual changes and cooling outside new cone parity', () => {
  const W = 15, H = 8, f = { W, H, val: new Int8Array(W * H) }, px = new Uint32Array(W * H);
  const context = vm.createContext({ f, geo: { anchor: 7 }, img: { width: W }, st: { heat: true }, k: 1,
    VW: W, VH: H, VX: 0, RK: 1, compareOn: () => true, rombP: () => -1,
    rgba: () => 1, lockCell() {}, mixPx: () => 1 });
  vm.runInContext(section('  let heatPrev=', '  // v0.147:') + ';', context);
  context.px = px; vm.runInContext('heatApply(px);', context);
  // No fixApexes stub: the compare branch must not consult cone history at all.
  const q = 12; f.val[q] = 1; context.k = 2;
  vm.runInContext('heatApply(px);changed=heatRun[12];', context);
  assert.equal(context.changed, 1);
  context.k = 3; vm.runInContext('heatApply(px);run=heatRun[12];cool=heatCool[12];', context);
  assert.equal(context.run, 0); assert.equal(context.cool, 8);
});
