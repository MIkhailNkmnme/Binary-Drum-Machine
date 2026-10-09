const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const core = vm.createContext({});
vm.runInContext(readFileSync(__dirname + '/zz-core.js', 'utf8'), core);
const ring = (edges, rate = 0) => ({ edges: edges.map(core.zzEdgeNorm).sort((a, b) => a - b), rate });

test('a boundary must reach every inner ring, including the central ring', () => {
  assert.equal(core.zzAlignedEdges([ring([0]), ring([0.2]), ring([0])]).length, 0);
  assert.equal(core.zzAlignedEdges([ring([0]), ring([0]), ring([0])]).length, 1);
});
test('fast rotation stops on an exact alignment between frames', () => {
  const hit = core.zzEdgeMeet([ring([0]), ring([1], -2), ring([0.5], -1)], 1);
  assert.ok(hit); assert.ok(Math.abs(hit.ph - 0.5) < 1e-10);
  assert.equal(hit.angles.length, 1);
});
test('partial alignments do not stop rotation', () => {
  assert.equal(core.zzEdgeMeet([ring([0]), ring([0.9], -2), ring([0.5], -1)], 1), null);
});
test('clockwise and anticlockwise crossings work across zero degrees', () => {
  const forward = core.zzEdgeMeet([ring([0.1]), ring([6.1], 1)], 0.5);
  assert.ok(forward); assert.ok(Math.abs(forward.ph - (2 * Math.PI + 0.1 - 6.1)) < 1e-9);
  const back = core.zzEdgeMeet([ring([6.1]), ring([0.1], 1)], -0.5);
  assert.ok(back); assert.ok(Math.abs(back.ph - (6.1 - 2 * Math.PI - 0.1)) < 1e-9);
});
test('resume skips the old alignment and can find the next one', () => {
  assert.equal(core.zzEdgeMeet([ring([0]), ring([0], 1)], 0.2), null);
  const hit = core.zzEdgeMeet([ring([0]), ring([0], 1)], 7);
  assert.ok(hit); assert.ok(Math.abs(hit.ph - 2 * Math.PI) < 1e-10);
});
test('rings rotating together form no new alignment', () => {
  assert.equal(core.zzEdgeMeet([ring([0], 2), ring([0], 2)], 100), null);
});
test('held central and outer rings still check the moving ring between them', () => {
  const hit = core.zzEdgeMeet([ring([0]), ring([0.3], -1), ring([0])], 0.4);
  assert.ok(hit); assert.ok(Math.abs(hit.ph - 0.3) < 1e-10);
});
test('ray candidates include opposite edges and crossings through the angular seam', () => {
  const opposite = core.zzEdgeEvents([ring([0]), ring([Math.PI - 0.2], 1)], 0.4);
  assert.ok(opposite.some(ph => Math.abs(ph - 0.2) < 1e-9));
  const back = core.zzEdgeEvents([ring([Math.PI - 0.1]), ring([0.1], 1)], -0.4);
  assert.ok(back.some(ph => Math.abs(ph + 0.2) < 1e-9));
  assert.equal(core.zzEdgeEvents([ring([0]), ring([0], 1)], 0.2).length, 0);
});

test('a semicircle leaves exactly one diameter, not a sector', () => {
  const half = [[0, Math.PI]], lines = core.zzCtrIsolated(half, half);
  assert.equal(lines.length, 1); assert.ok(Math.abs(lines[0]) < 1e-9);
});
test('an isolated ray survives a contact between consecutive ring openings', () => {
  const exit = core.zzArcClosedAnd([[0, 1], [Math.PI, Math.PI + 1]], [[1, 2], [Math.PI + 1, Math.PI + 2]]);
  const lines = core.zzCtrIsolated([[0, 2 * Math.PI]], exit);
  assert.equal(lines.length, 1); assert.ok(Math.abs(lines[0] - 1) < 1e-9);
});
test('the angular seam at 0 and 360 degrees keeps a single ray', () => {
  const meet = core.zzArcClosedAnd([[0, 0.2]], [[6, 2 * Math.PI]]);
  assert.equal(meet.length, 1); assert.equal(meet[0][0], 0); assert.equal(meet[0][1], 0);
});
test('a finite opening remains a sector with no additional isolated ray', () => {
  assert.equal(core.zzCtrIsolated([[0, 2 * Math.PI]], [[0.2, 0.8], [Math.PI + 0.2, Math.PI + 0.8]]).length, 0);
});
test('a missing opposite opening and a blocking ring produce no diameter', () => {
  assert.equal(core.zzCtrIsolated([[0, 2 * Math.PI]], [[0.2, 0.8]]).length, 0);
  const exit = core.zzArcClosedAnd([[1, 1], [Math.PI + 1, Math.PI + 1]], [[1.1, 1.5], [Math.PI + 1.1, Math.PI + 1.5]]);
  assert.equal(core.zzCtrIsolated([[0, 2 * Math.PI]], exit).length, 0);
});

// Load actual UI math declarations without starting the page or accessing a browser.
function uiMath(){
  const source = readFileSync(__dirname + '/zz-ui.js', 'utf8');
  const ctx = vm.createContext({});
  vm.runInContext(readFileSync(__dirname + '/zz-core.js', 'utf8'), ctx);
  const needed = new Set(('ivNorm ivUnion ivAnd ivMinus coneSunTrace coneRingsTotal coneVoidOn coneFlat coneSol3d bipyMode coneSunOn coneSunTurnOn coneMoonTurn coneQuadOn coneQuadArcs coneSunSlit coneSunSlitArc coneSunHalf coneSunHalfArc coneLenOn coneCutOn coneSlitMode coneRingNR coneVoidLen coneRotOf coneRingPh fillStillOn coneBitF conePrevStep coneBitMode coneVoidRot coneSunGateOn coneSunGateOk coneLenScale coneLenK coneLenF coneSunCutR coneFillCut coneFillRot fillLen coneCutGeo coneCutP coneCutOff cutHoles coneCutSym coneCutAlt cutPer cutPos sunPass coneZeroOpen coneFreeOn fillDraft coneCellCovered coneFillPass coneOnesArcs cutBit sunWideMoonOn coneCutSpread coneCut2n coneSunCut coneNoGap').split(' '));
  for (const name of ['coneHalfOn', 'coneRow1Slit', 'conePartCount', 'coneRow1PartPhase', 'coneQuadOpen', 'coneRingFeat', 'coneMagRing', 'coneFeatEdges', 'coneFeatMids', 'cutSymHits', 'lightWide', 'lightPieces', 'coneFreeRing', 'fillFreeDraft', 'coneFreeCan', 'coneCtrHits', 'coneSunPaint', 'coneVoidHits', 'coneMoonSweep', 'coneSweepStep', 'coneSweepGet', 'coneSweepRayStep', 'coneEdgeSweep', 'coneCtrStopAt', 'coneClockSweep']) needed.add(name);
  for (const name of ['bipyGeo', 'rotTxt', 'turnsParts', 'turnsFmt']) needed.add(name);
  for (const name of ['coneAngDiff', 'magSymOf', 'magPartsOnly', 'coneRingSymAxes', 'coneSymTargets', 'conePartTargets', 'coneHandSnap', 'coneR1AxisSnap', 'coneNextHandSnap']) needed.add(name);
  for (const match of source.matchAll(/^function \w+\(/gm)) {
    if (!needed.has(match[0].slice(9, -1))) continue;
    let end = source.indexOf('\n', match.index), script;
    for (;;) {
      try { script = new vm.Script(source.slice(match.index, end)); break; }
      catch (error) { if (!(error instanceof SyntaxError)) throw error; end = source.indexOf('\n', end + 1); if (end < 0) throw error; }
    }
    script.runInContext(ctx);
  }
  vm.runInContext(`var TAU2=2*Math.PI,CONE_MAX=256,CONE_VOID_TO=256,coneRot=[0],coneSunWas,coneSweepAcc=null,Z={rows:['1'],coneClock:true,coneSun:true,coneSlits:'cut2',coneSunCut:'zero',coneSpinMode:'bit',coneSpinPh:0,coneAimRot:0,coneFillTurn:0,cutAlign:'c',cutLen:'ctr',coneVoid:false,moonOff:true,sunPassE:false};function hidAutoBack(){return false;}function coneLogDirty(){}function coneExArchive(){}`, ctx);
  return ctx;
}
function magnetMath(){
  const ctx = uiMath();
  vm.runInContext('var coneRingSymC=new Map(),coneGeom={r0:100,dr:30,dpr:1,fill:false};', ctx);
  Object.assign(ctx.Z, { rows: ['1', '11'], coneSlits: 'all', coneClock: true, coneSun: false,
    coneAimRot: 2, coneSpinMode: 'obit', magSym: 'both', magSnapParts: true });
  ctx.coneRot = [0, -1 / 6]; // Neighbor boundaries at 30° and 210°, away from canvas axes.
  return ctx;
}
test('first-ring magnetic steps use neighbor boundaries, never canvas axes', () => {
  for (const clock of [true, false]) for (const dir of [1, -1]) {
    const ctx = magnetMath(); ctx.Z.coneClock = clock;
    const hit = ctx.coneNextHandSnap(0, dir);
    assert.ok(hit, `clock=${clock}, dir=${dir}`);
    assert.equal(hit.what, 'граница части кольца 2');
    assert.ok(Math.abs(Math.sin(2 * hit.t)) > 0.1, 'neighbor is away from horizontal and vertical');
    ctx.Z.magSym = 'in';
    assert.equal(ctx.coneNextHandSnap(0, dir), null, 'no inner neighbor means no automatic target');
  }
});
test('full magnetic steps keep neighbor symmetry axes but omit canvas axes', () => {
  for (const clock of [true, false]) for (const dir of [1, -1]) {
    const ctx = magnetMath(); ctx.Z.coneClock = clock; ctx.Z.magSnapParts = false;
    const hit = ctx.coneNextHandSnap(0, dir);
    assert.ok(hit); assert.equal(hit.what, 'ось симметрии кольца 2');
    ctx.Z.magSym = 'in';
    assert.equal(ctx.coneNextHandSnap(0, dir), null);
  }
});
test('first-ring canvas-axis snap remains available for manual dragging', () => {
  const ctx = magnetMath(); ctx.Z.magSym = 'in';
  const snap = ctx.coneR1AxisSnap();
  assert.ok(snap); assert.ok(Math.abs(Math.sin(2 * snap.t)) < 1e-9);
  assert.ok(Math.abs(snap.deg + 2) < 1e-9);
  ctx.Z.coneClock = false;
  const hand = ctx.coneHandSnap(0);
  assert.ok(hand); assert.match(hand.what, /вертикаль|горизонталь/);
  assert.equal(ctx.coneNextHandSnap(0, 1), null);
});
test('all ring geometries persist when both light sources are off', () => {
  const ctx = uiMath(); ctx.Z.rows = ['1', '11', '111'];
  for (const mode of ['all', 'one', 'cut', 'cut2', 'cutA', 'cutS']) {
    ctx.Z.coneSlits = mode;
    const geometry = () => JSON.stringify({
      row: ctx.coneCutGeo(1, 2), outer: ctx.coneFillCut(),
      feature: ctx.coneRingFeat(1), centre: ctx.coneRingFeat(0),
      holes: ctx.cutHoles(2), quarter: ctx.coneQuadOn()
    });
    ctx.Z.coneClock = true; ctx.Z.coneSun = true;
    const lit = geometry();
    for (const [clock, sun] of [[true, false], [false, false]]) {
      ctx.Z.coneClock = clock; ctx.Z.coneSun = sun;
      assert.equal(geometry(), lit, mode);
      assert.equal(ctx.Z.coneClock, clock);
      assert.equal(ctx.Z.coneSun, sun);
      assert.equal(ctx.coneSunOn(), false);
    }
    const cut = !['all', 'one'].includes(mode);
    assert.equal(ctx.coneCutGeo(1, 2).cut, cut);
    assert.equal(ctx.coneCutGeo(1, 2).step, 2 * Math.PI / (mode === 'cut2' ? 4 : cut ? 3 : 2));
  }
});

test('turn fractions keep the denominator of each ring instead of reducing it', () => {
  const ctx = uiMath(); ctx.Z.coneClock = false; ctx.Z.coneSlits = 'all';
  ctx.Z.rows = ['1', '11111111', '111111111111'];
  assert.equal(ctx.turnsFmt(1.25, 1), '↻1 2/8');
  assert.equal(ctx.turnsFmt(1.25, 2), '↻1 3/12');
  assert.equal(ctx.turnsFmt(-0.5, 1), '↺−4/8');
  assert.equal(ctx.turnsFmt(2, 1), '↻2');
  assert.equal(ctx.turnsFmt(-0.01, 1), '0');
});

test('turn fractions follow the cut geometry, including the ring beyond the horizon', () => {
  const ctx = uiMath(); ctx.Z.rows = ['1', '111'];
  for (const mode of ['cut', 'cutA', 'cutS', 'cut2']) {
    ctx.Z.coneSlits = mode;
    const q = mode === 'cut2' ? 6 : 5, fillQ = mode === 'cut2' ? 8 : 7;
    assert.equal(ctx.turnsFmt(1 + 1 / q, 1), `↻1 1/${q}`);
    assert.equal(ctx.turnsFmt(-1 / fillQ, 'f'), `↺−1/${fillQ}`);
  }
  ctx.Z.coneClock = false; ctx.Z.coneSun = false;
  assert.equal(ctx.turnsFmt(0.5, 'f'), '↻4/8');
});

test('first-ring turn fractions follow its selected division and growth of the last row', () => {
  const ctx = uiMath(); ctx.Z.rows = ['1', '11'];
  ctx.Z.sunHalf = true;
  assert.equal(ctx.turnsFmt(0.5, 0), '↻1/2');
  ctx.Z.laserQuad = true;
  for (const [mode, q] of [[3, 3], [4, 4], ['sym2', 4], ['last', 4]]) {
    ctx.Z.row1Parts = mode;
    assert.equal(ctx.turnsFmt(1 / q, 0), `↻1/${q}`);
  }
  ctx.Z.rows.push('111');
  assert.equal(ctx.turnsFmt(0.5, 0), '↻3/6');
  ctx.Z.rows.push('11111');
  assert.equal(ctx.turnsFmt(0.5, 0), '↻5/10');
});

test('formatting continuous rotation rounds only the display to the nearest own part', () => {
  const ctx = uiMath(); ctx.Z.coneClock = false; ctx.Z.coneSlits = 'all'; ctx.Z.rows = ['1', '11111111'];
  ctx.Z.coneTurns = [1.08, -1.188765];
  const before = JSON.stringify(ctx.Z);
  assert.equal(ctx.turnsFmt(ctx.Z.coneTurns[1], 1), '↺−1 2/8');
  assert.equal(ctx.turnsFmt(1.99, 1), '↻2');
  assert.equal(ctx.turnsFmt(0.12499999999999997, 1), '↻1/8');
  assert.equal(JSON.stringify(ctx.Z), before);
});

test('turn fractions count the additional cells of the bipyramid ring', () => {
  const ctx = uiMath(); ctx.Z.rows = ['1', '111'];
  ctx.Z.coneClock = false; ctx.Z.coneSlits = 'all'; ctx.Z.cone3d = true; ctx.Z.coneBipy = true;
  assert.equal(ctx.turnsFmt(0.2, 1), '↻1/5');
});

test('the symmetric two-part first ring is half a symmetry step out of phase with row two', () => {
  const ctx = uiMath(); ctx.Z.rows = ['1', '11']; ctx.Z.row1Parts = 'sym2'; ctx.Z.laserQuad = true;
  const C = ctx.coneCutGeo(1, 2), R = ctx.coneRingFeat(0);
  const lastCenter = -Math.PI / 2 + (ctx.cutPos(0, 2) + C.off + 0.5) * C.step;
  const firstCenter = -Math.PI / 2 + (1.5 - R.x0) * R.step;
  assert.ok(Math.abs(firstCenter - lastCenter - Math.PI / 2) < 1e-9);
  assert.equal(ctx.coneQuadOpen(firstCenter), false);
  assert.equal(ctx.coneQuadOpen(firstCenter + Math.PI / 2), true);
});

test('first-ring symmetric parts grow with the last row before the horizon', () => {
  const ctx = uiMath(); ctx.Z.row1Parts = 'last'; ctx.Z.laserQuad = true;
  for (const n of [2, 3, 4, 5, 8]) {
    ctx.Z.rows = ['1', '11', '1'.repeat(n)];
    const C = ctx.coneCutGeo(2, n), R = ctx.coneRingFeat(0);
    assert.equal(ctx.conePartCount(), 2 * n);
    const lastCenter = -Math.PI / 2 + (ctx.cutPos(0, n) + C.off + 0.5) * C.step;
    const firstCenter = -Math.PI / 2 + (1.5 - R.x0) * R.step;
    assert.ok(Math.abs(firstCenter - lastCenter - Math.PI / n) < 1e-9);
    for (let j = 0; j < n; j++) {
      const a = firstCenter + j * 2 * Math.PI / n;
      assert.equal(ctx.coneQuadOpen(a), false);
      assert.equal(ctx.coneQuadOpen(a + Math.PI / n), true);
    }
    const solid = ctx.coneQuadArcs(false).reduce((sum, [a, b]) => sum + b - a, 0);
    assert.ok(Math.abs(solid - Math.PI) < 1e-9);
  }
});

test('actual center trace hits both edge bits with one diameter and no moonlight', () => {
  const ctx = uiMath(), result = ctx.coneSunTrace();
  assert.equal(result.ctrLines.length, 1);
  assert.ok(Math.abs(result.ctrLines[0] - Math.PI / 2) < 1e-9);
  assert.equal(result.bands.length, 0); assert.equal(JSON.stringify(result.hits.sort()), JSON.stringify(['1:0', '1:1']));
  assert.equal(result.zhits.length, 0); assert.equal(result.zbands.length, 0);
});
test('a single center ray actually writes ones, including with empty-cell passage enabled', () => {
  for (const emptyPass of [false, true]) {
    const ctx = uiMath(); ctx.Z.sunPassE = emptyPass;
    ctx.coneSunPaint();
    assert.equal(ctx.Z.fillCells, '11');
  }
});
test('single-ray XOR toggles on a new hit, not on every frame', () => {
  const ctx = uiMath(); Object.assign(ctx.Z, { sunXor: true, fillCells: '10' });
  ctx.coneSunPaint(); assert.equal(ctx.Z.fillCells, '01');
  ctx.coneSunPaint(); assert.equal(ctx.Z.fillCells, '01');
  ctx.Z.coneFillTurn = 0.25;
  assert.equal(ctx.coneSunTrace().ctrLines.length, 0);
  ctx.coneSunPaint();
  ctx.Z.coneFillTurn = 0;
  ctx.coneSunPaint(); assert.equal(ctx.Z.fillCells, '10');
});
test('a single ray respects zero walls without XOR', () => {
  const ctx = uiMath(); ctx.Z.fillCells = '0.';
  ctx.coneSunPaint(); assert.equal(ctx.Z.fillCells, '01');
});
test('full passage prevents a stationary ray from painting on contact, even with XOR', () => {
  for (const xor of [false, true]) for (const free of [false, true]) {
    const ctx = uiMath(); Object.assign(ctx.Z, { sunSweep: true, moonSweep: false, sunXor: xor, cutFree: free });
    const trace = ctx.coneSunTrace();
    assert.equal(trace.hits.length, 0);
    for (let frame = 0; frame < 4; frame++) ctx.coneSunPaint();
    assert.equal(ctx.Z.fillCells ?? '..', '..');
    if (free) assert.ok(!/[01]/.test(ctx.Z.fillFree));
  }
});
function rayPauseFixture(){
  const ctx = uiMath(); ctx.Z.coneEdgeStop = true;
  ctx.coneEdgeRings = () => {
    const r = ctx.coneRotOf(0), N = ctx.Z.rows.length;
    return [
      { edges: [0.5, 1.5].map(p => core.zzEdgeNorm((p - r) * Math.PI - Math.PI / 2)).sort((a, b) => a - b), x0: r - 0.5, step: Math.PI, rate: 0 },
      ...Array.from({ length: N }, (_, i) => {
        const C = ctx.coneSunCutR(i + 1, N);
        return { edges: Array.from({ length: C.P }, (_, p) => core.zzEdgeNorm((p - C.rot) * C.st - Math.PI / 2)).sort((a, b) => a - b), x0: C.rot, step: C.st, rate: 0 };
      }),
    ];
  };
  return ctx;
}
test('the pause button finds an isolated center ray between frames and preserves the phase', () => {
  const ctx = rayPauseFixture();
  assert.equal(ctx.coneCtrStopAt(-0.1), false);
  assert.equal(ctx.coneCtrStopAt(0), true);
  const hit = ctx.coneEdgeSweep(-0.1, 0.2);
  assert.ok(hit && hit.ray && hit.edges);
  assert.ok(Math.abs(hit.ph) < 1e-8);
  assert.equal(ctx.Z.coneSpinPh, 0);
  assert.equal(ctx.Z.fillCells, '..');   // поиск паузы сам не пишет биты
  assert.equal(ctx.coneEdgeSweep(0, 0.1), null);   // ▶ не ловит старую паузу повторно
  ctx.Z.coneEdgeStop = false;
  assert.equal(ctx.coneEdgeSweep(-0.1, 0.2), null);
});
test('an isolated ray stops rotation even without alignment of every ring boundary', () => {
  const ctx = rayPauseFixture();
  vm.runInContext(`Z.rows=['1','11'];coneRot=[0,0.2];Z.sunPass1=true;`, ctx);
  assert.equal(core.zzAlignedEdges(ctx.coneEdgeRings()).length, 0);
  assert.equal(ctx.coneCtrStopAt(0), true);
  const hit = ctx.coneEdgeSweep(-0.1, 0.2);
  assert.ok(hit && hit.ray); assert.ok(Math.abs(hit.ph) < 1e-8);
});
test('the rotation sweep pauses at the ray and then records according to the chosen rule', () => {
  for (const fullPass of [false, true]) {
    const ctx = rayPauseFixture();
    ctx.Z.sunSweep = fullPass; ctx.Z.moonSweep = false;
    Object.assign(ctx, { performance: { now: () => 0 }, coneFanOn: () => false, coneClockTrace: () => [], coneDegPh: () => 360, coneSlitHalf: () => Math.PI / 180, coneWallPaint: () => ctx.coneSunPaint() });
    vm.runInContext(`var coneGeom={fill:{}},coneClockWas=false;Z.coneSpinPh=-0.1;`, ctx);
    const stop = ctx.coneClockSweep(-0.1, 0.2, 'bit');
    assert.ok(stop && stop.ray); assert.ok(Math.abs(stop.ph) < 1e-8);
    assert.equal(ctx.Z.coneSpinPh, -0.1);
    ctx.Z.coneSpinPh = stop.ph; ctx.coneSunPaint();
    assert.equal(ctx.Z.fillCells, fullPass ? '..' : '11');
  }
});
function sweepFixture(){
  const ctx = uiMath(), C = { n: 2, P: 4, st: Math.PI / 2, rot: 0 };
  Object.assign(ctx.Z, { sunSweep: true, moonSweep: false });
  ctx.coneSunCutR = () => C;
  let rays = [];
  ctx.coneSunTrace = () => ({ bands: [], hits: [], zhits: [], zN: [], ctrRays: rays });
  return { ctx, C, step(p){ rays = p === null ? [] : [core.zzEdgeNorm(p * C.st)]; ctx.coneSunPaint(); } };
}
test('a ray writes one after sweeping the whole cell, including between sampled edges', () => {
  for (const path of [[0, 0.3, 0.6, 0.9, 1.2], [1, 0.7, 0.4, 0.1, -0.2]]) {
    const { ctx, step } = sweepFixture();
    for (const p of path.slice(0, -1)) { step(p); assert.equal(ctx.Z.fillCells, '..'); }
    step(path.at(-1)); assert.equal(ctx.Z.fillCells, '1.');
  }
});
test('an interrupted or reversed ray does not complete the old passage', () => {
  for (const path of [[0, 0.3, 0.6, null, 0.9, 1.2], [0, 0.3, 0.6, 0.3, 0.6, 0.9, 1.2], [0, 1.2]]) {
    const { ctx, step } = sweepFixture();
    for (const p of path) step(p);
    assert.equal(ctx.Z.fillCells, '..');
  }
});
test('ray passage follows movement relative to the fill ring', () => {
  const { ctx, C, step } = sweepFixture();
  for (const rot of [0, 0.3, 0.6, 0.9, 1.2]) { C.rot = rot; step(0); }
  assert.equal(ctx.Z.fillCells, '1.');
});
test('XOR waits for the completed ray passage and toggles only once', () => {
  const { ctx, step } = sweepFixture(); Object.assign(ctx.Z, { sunXor: true, fillCells: '10' });
  for (const p of [0, 0.3, 0.6, 0.9]) { step(p); assert.equal(ctx.Z.fillCells, '10'); }
  step(1.2); assert.equal(ctx.Z.fillCells, '00');
  step(1.2); assert.equal(ctx.Z.fillCells, '00');
});
test('closed ray hits handle the seam and the fractional bit boundaries', () => {
  const ctx = uiMath();
  ctx.Z.coneSlits = 'cutS';
  ctx.coneSunCutR = () => ({ n: 2, P: 3, st: 2 * Math.PI / 3, rot: 0 });
  const hits = new Set(); ctx.coneCtrHits([0], [[0, 0]], 1, hits);
  assert.deepEqual([...hits], ['1:0']);
  hits.clear(); ctx.coneCtrHits([0], [[Math.PI, Math.PI]], 1, hits);
  assert.deepEqual([...hits], ['1:1']);
  hits.clear(); ctx.coneCtrHits([0.1], [[Math.PI, Math.PI]], 1, hits);
  assert.equal(hits.size, 0);
});
test('ordinary sectors keep the previous center trace and cell hits', () => {
  const ctx = uiMath();
  for (const mode of ['cut', 'cut2', 'cutA', 'cutS']) for (const half of [false, true]) for (const phase of [0, 0.125, 0.5, 1]) {
    vm.runInContext(`Object.assign(Z,{rows:['1','11','111'],sunHalf:${half},coneSlits:'${mode}',cutAlign:'r',coneSpinPh:${phase},fillCells:null});coneRot=[0,0,0];`, ctx);
    // Force the inner pass to use the old intersection function for the reference result.
    const saved = ctx.zzArcClosedAnd; ctx.zzArcClosedAnd = ctx.ivAnd;
    const reference = ctx.coneSunTrace(); ctx.zzArcClosedAnd = saved;
    const current = ctx.coneSunTrace();
    for (const key of ['bands', 'out', 'hits', 'zhits', 'zbands', 'aout', 'pass']) {
      if (key === 'hits' && current.ctrLines.length) continue;   // новые попадания только у одиночной прямой
      assert.equal(JSON.stringify(current[key]), JSON.stringify(reference[key]), `${mode}, half=${half}, phase=${phase}: ${key}`);
    }
  }
});
test('the actual renderer draws one straight diameter without any sector fill', () => {
  const source = readFileSync(__dirname + '/zz-ui.js', 'utf8');
  const start = source.indexOf('      if (S.ctrLines.length)'), end = source.indexOf('      { const outs = S.out.filter', start);
  assert.ok(start >= 0 && end > start);
  const points = [], g = {
    save(){}, restore(){}, setLineDash(){}, beginPath(){}, stroke(){},
    moveTo(x, y){ points.push([x, y]); }, lineTo(x, y){ points.push([x, y]); },
  };
  vm.runInNewContext(source.slice(start, end), { g, S: { ctrLines: [0.7] }, cx: 100, cy: 120, roE: 80, dpr: 1, cg: '#ffd166' });
  assert.equal(points.length, 2);
  assert.ok(Math.abs(points[0][0] + points[1][0] - 200) < 1e-9);
  assert.ok(Math.abs(points[0][1] + points[1][1] - 240) < 1e-9);
  assert.ok(Math.abs(Math.hypot(points[0][0] - points[1][0], points[0][1] - points[1][1]) - 160) < 1e-9);
});
