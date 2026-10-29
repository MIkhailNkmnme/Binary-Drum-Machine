const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Core = require('./mayatnik-core.js');
const Compare = require('./mayatnik-compare.js');
const html = fs.readFileSync(__dirname + '/Zerkalius-mayatnik.html', 'utf8');
function section(start, end) {
  const a = html.indexOf(start), b = html.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, start); return html.slice(a, b);
}
function boot({ rows = 8, visible = rows, direction = 'pend', pair = false, legacy = false, source = 'cone', mirror = false, state = {} } = {}) {
  const engine = Compare.create({ rows, direction, pair });
  const c = { st: { mode: direction, pair, rows, steps: 4 * rows, fixLines: true, fixCross: true, fixDragK: true, saw: false, compareSource: source, ...state },
    k: 1, VX: 0, VW: legacy ? 12 * rows + 1 : 2 * rows - 1, VH: visible,
    geo: { anchor: legacy ? 6 * rows : rows - 1 }, MAYATNIK: Core,
    f: { H: rows, W: legacy ? 12 * rows + 1 : 2 * rows - 1, val: new Int8Array((legacy ? 12 * rows + 1 : 2 * rows - 1) * rows).fill(-1) },
    compareOn: () => !legacy, pairOn: () => pair, rombP: () => -1, total: () => legacy ? (pair ? 2 * rows : 4 * rows) : (pair ? rows : 2 * rows - 1),
    g: {}, vtxLabels() {}, fixPad: h => { c.pad = h; }, window: {}, save() {}, draw() {}, coneContinueAllowed:()=>false };
  vm.createContext(c);
  vm.runInContext(section('  function compareLimit(', '  function compareConfig(') +
    section('  function compareSpan(', '  function compareMaterialize(') +
    section('  function fixApexes(', '  // v0.127:') +
    section('  function fixSegments(', '  // v0.203:') +
    section('  function fixShown()', '  // v0.205:') +
    section('  function fixLinesDraw(', '  // v0.245 →') +
    section('  function areaFrame(', '  function areaCalc(') +
    section('  function guideBottom(', '  function lineMeasuresDraw('), c);
  c.seek = k => { c.k = k; if (!legacy) { const q = engine.seek(k); engine.copyTo(c.f.val, source, mirror); assert.deepEqual(Array.from(c.compareSpan()), [q.lo, q.hi]); } };
  c.points = () => [...c.fixPts(c.fixSegments(true), visible).values()];
  return c;
}

test('every comparison source shares one true meeting before, on and below the last visible row', () => {
  for (const direction of ['pend', 'pendR']) for (const pair of [false, true]) for (const source of ['cone', 'field', 'pair', 'p12', 'p23', 'p31', 'p123', 'a12', 'a23', 'a31', 'a123', 'xor', 'and']) for (const mirror of [false, true]) {
    for (const visible of [8, 3, 1]) {
      const c = boot({ direction, pair, source, mirror, visible });
      for (let k = 1; k <= c.total(); k++) {
        c.seek(k); const before = Array.from(c.f.val), [lo, hi] = c.compareSpan(), X = c.geo.anchor + (hi + lo) / 2, Y = (hi - lo + 2) / 2;
        const segs = c.fixSegments(true), pts = c.points();
        assert.equal(pts.length, 1, JSON.stringify({ direction, pair, source, mirror, visible, k }));
        assert.deepEqual(Array.from(pts[0]), [X, Y, Y, X, X]);
        for (const s of segs) { assert.equal(s[2], X); assert.equal(s[3], Y); assert.equal(s[6], Y); }
        assert.equal(c.areaFrame().q[2], Y); assert.equal(c.areaFrame().H, visible);
        assert.equal(c.guideHeight(), Math.max(visible, Y + .5));
        assert.deepEqual(Array.from(c.f.val), before); assert.equal(c.f.val.length, 15 * 8);
      }
      c.seek(c.total()); assert.equal(c.points()[0][2], 8, 'finite transport still ends at N, without adding frames');
    }
  }
});

test('legacy 4N paths keep their real intersections after the field and at the terminal frame', () => {
  for (const direction of ['pend', 'pendR']) for (const pair of [false, true]) {
    const c = boot({ direction, pair, legacy: true });
    for (let k = 1; k <= c.total(); k++) {
      c.seek(k); const pts = c.points(), segs = c.fixSegments(true), expectedY = pair ? k + 1 : (k + 1) / 2;
      assert.equal(pts.length, 1);
      for (const s of segs) {
        if (Number.isFinite(s[6])) { assert.equal(s[3], expectedY); assert.equal(pts[0][2], expectedY); }
        else assert.equal(s[3], c.VH - 1, 'legacy single open ray retains its field endpoint');
        assert.equal(s[2], pts[0][0]);
      }
    }
    assert.ok(c.points()[0][2] > c.VH); assert.equal(c.f.val.length, c.f.W * 8);
  }
});

function render(c, mir = false) {
  const strokes = [], dots = [], texts = [], stack = []; let path = [], dash = [];
  c.Path2D = class { constructor() { this.path = []; } moveTo(...p) { this.path.push(p); } lineTo(...p) { this.path.push(p); } };
  const G = { save() { stack.push(dash.slice()); }, restore() { dash = stack.pop(); }, setLineDash(v) { dash = v.slice(); },
    beginPath() { path = []; }, moveTo(...p) { path.push(p); }, lineTo(...p) { path.push(p); },
    arc(x, y) { dots.push([x, y]); }, fill() {}, strokeText() {}, fillText(t) { texts.push(t); } };
  c.axisStroke = (g, options = {}) => strokes.push({ path: options.path?.path || path, dash: dash.slice() });
  c.fixLinesDraw(G, 0, 0, 1, 1, 0, mir);
  return { strokes, dots, texts };
}
test('drawing joins two diagonals at one marker and one horizontal axis, with no phantom edge crosses', () => {
  for (const legacy of [false, true]) for (const areas of [false, true]) for (const mirrored of [false, true]) {
    const c = boot({ legacy, visible: 3, state: { areas } }); c.seek(c.total());
    const q = c.points()[0], x = (mirrored ? c.VW - 1 - q[4] : q[4]) + .5, y = q[2] + .5;
    const out = render(c, mirrored);
    assert.deepEqual(out.dots, [[x, y]]); assert.equal(out.texts.length, 1);
    const horizontals = out.strokes.filter(s => s.path.length === 2 && s.path[0][1] === s.path[1][1]);
    assert.equal(horizontals.length, 1); assert.deepEqual(horizontals[0].path, [[0, y], [c.VW, y]]);
    const toMeeting = out.strokes.filter(s => s.dash.length && s.path.at(-1)[0] === x && s.path.at(-1)[1] === y);
    assert.equal(toMeeting.length, 2);
    for (const s of out.strokes) assert.ok(s.path.at(-1)[1] >= s.path[0][1], 'no diagonal runs back upwards to the field');
    if (!mirrored) assert.ok(c.pad > (q[2] - c.VH) + 20);
  }
});

test('axis modes, lock and manual displacement keep a single shared center below the field', () => {
  const c = boot({ visible: 3, state: { fixLines: false, fixDy: 4, fixDx: 1 } }); c.seek(15);
  for (const [mode, axis] of [[0, 8], [1, 7.5], [2, 7]]) {
    c.st.fixAxis = mode; const q = c.points()[0];
    assert.deepEqual(Array.from(q), [7, 8, 12, axis, 8]);
    const out = render(c); assert.deepEqual(out.dots, [[8.5, 12.5]]);
    assert.equal(c.guideHeight(), 12.5); assert.equal(c.areaFrame().q[2], 12);
  }
  c.st.fixLockX = -2; assert.equal(c.points()[0][3], 5); assert.equal(c.points()[0][4], 8);
  c.st.fixDy = -100; assert.equal(c.points()[0][2], 1, 'upper limit still prevents accumulated offscreen displacement');
});

test('meeting seeds stay within actual bit storage when the meeting is below it', () => {
  const c = boot({ visible: 3 }); c.seek(15); const reads = [];
  Object.assign(c, { RK: 1, fillBit(x, y) { reads.push([x, y]); assert.ok(y >= 0 && y < 3 && x >= 0 && x < c.VW); return 1; } });
  vm.runInContext(section('  function meetSeedCells(', '  // v0.316:'), c);
  assert.equal(c.meetSeedCells(c.points()[0], 1).length, 3);
  c.st.fixAxis = 1; c.meetSeedCells(c.points()[0], 1);
  assert.ok(reads.length > 0); assert.equal(c.f.val.length, 120);
});

test('free pointer drag and keyboard displacement start below the field without snapping to its edge', () => {
  const c = boot({ visible: 3, state: { fixLines: false, fixDragK: false } }); c.seek(15);
  const handlers = {}; Object.assign(c, { rulerMode: false, rulerDrag: false, picOn: () => true,
    document: { body: { classList: { contains: () => false } } }, cv: { getBoundingClientRect: () => ({ left: 0, top: 0 }) }, scale: () => 10,
    wrap: { addEventListener(type, fn) { handlers[type] = fn; }, classList: { add() {}, toggle() {} }, setPointerCapture() {} },
    actSet() {}, lastAct: { kind: 'fix' } });
  vm.runInContext(section('  let fixDrag=null;', '  // v0.214:'), c);
  const event = (x, y) => ({ button: 0, pointerId: 1, clientX: x, clientY: y, preventDefault() {}, stopImmediatePropagation() {} });
  assert.equal(vm.runInContext('fixNear(75,85)', c), true);
  handlers.pointerdown(event(75, 85)); handlers.pointermove(event(75, 105));
  assert.equal(c.points()[0][2], 10); assert.equal(c.st.fixDy, 2);
  vm.runInContext(section('  function actArrow(', '  const fixEnd='), c);
  c.actArrow(0, 1); assert.equal(c.points()[0][2], 11);
});

test('frame dragging selects the same nearest frame without materializing candidate fields or changing current k', () => {
  for (const pair of [false, true]) {
    const c = boot({ pair }); c.seek(5); const field = Array.from(c.f.val), changes = [];
    Object.assign(c, { compareEnsure() { throw Error('geometry must not seek the field engine'); },
      Event: class {}, $: () => ({ value: c.k, dispatchEvent() { changes.push(this.value); } }) });
    vm.runInContext(section('  function fixMeetAt(', '  window.mayFixAxis='), c);
    for (const y of [1, 2.25, 3, 3.25, 3.5, 7.75, 8, 100]) {
      let expected = c.k, score = Infinity;
      for (let n = 1; n <= c.total(); n++) {
        const depth = pair ? n : (n + 1) / 2, d = Math.abs(depth - y) * 1e4 + Math.abs(n - c.k);
        if (d < score) { score = d; expected = n; }
      }
      changes.length = 0; c.fixDragFrame(y, 7);
      assert.deepEqual(changes, expected === c.k ? [] : [expected]); assert.equal(c.k, 5); assert.deepEqual(Array.from(c.f.val), field);
    }
  }
});
