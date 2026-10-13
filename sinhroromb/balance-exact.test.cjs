const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

function math() {
  const ctx = vm.createContext({ window: {}, performance, setTimeout });
  vm.runInContext(readFileSync(__dirname + '/zz-core.js', 'utf8'), ctx);
  const source = readFileSync(__dirname + '/zz-ui.js', 'utf8');
  const needed = new Set(('coneBalanceAxisAngle coneBalanceAxisTurn coneBalanceEqual coneBalanceAdd coneBalanceNumber coneBalancePauseData coneBalanceAllEqual coneBalancePauseSweep coneBalanceData coneBalanceCacheKey coneBalanceVector coneBalanceSearchKey coneBalancePairSearch coneBalanceAutoEqualize coneMotionRead coneMotionWrite coneMotionClock coneMotionSetClock coneMotionAdvance coneMotionOff coneMotionPhase coneMotionRot coneMotionPartPhase coneMotionRing coneMotionBitPosition coneFlat coneSol3d coneSlitMode coneCutOn coneCutP coneCutSym coneCutAlt coneCut2n coneHalfOn coneQuadOn coneRow1Slit conePartCount cutPrevMode cutPrevPos cutPrevOwn cutPrevCells cpInv bipyMode coneTorCut coneSlitRaw conePrevStep coneBitMode fillStillOn coneRingLenJ coneRingFeat coneMagRing coneFreeRing coneOneSlit coneCutSpread coneRow1Half coneRow1PartPhase coneRotOf coneRingPh coneFullOff coneBitF coneAim coneCutGeo coneCutOff ivUnion coneRotKeep').split(' '));
  // Load actual declarations without starting the UI.
  for (const match of source.matchAll(/^(?:async )?function (\w+)\(/gm)) {
    if (!needed.has(match[1])) continue;
    let end = source.indexOf('\n', match.index), script;
    for (;;) {
      try { script = new vm.Script(source.slice(match.index, end)); break; }
      catch (error) { if (!(error instanceof SyntaxError)) throw error; end = source.indexOf('\n', end + 1); if (end < 0) throw error; }
    }
    script.runInContext(ctx);
  }
  vm.runInContext(`var TAU2=2*Math.PI,CONE_MAX=256,coneRot=[],coneGeom={N:1,fill:false},coneSpinning=false,
    coneBalanceCache=null,coneBalanceSearching=false,coneBalanceVariantStats=null,coneMagStep=null,coneMagCount=null,
    Z={rows:['101'],coneSlits:'all',cutAlign:'r',coneSpinMode:'all',coneAutoSp:360};
    function save(){} function renderRows(){} function renderCone(){} function say(t){lastMessage=t;}
    function coneBalanceAutoTip(){} function magSymOf(){return 'both';} function coneMagK(){return {sym:true};}
    function coneMagFingerprint(){return JSON.stringify([coneRot,Z.coneSpin,Z.coneSpinPh]);}
    function coneRingSymAxes(){return [0.5,1.5];}
    var lastMessage='',q=ZZExact.from;`, ctx);
  return ctx;
}
const run = (ctx, code) => vm.runInContext(code, ctx);
const strings = value => JSON.parse(JSON.stringify(value));

test('third of a turn crosses a quarter as exact 3/4 and 1/4', () => {
  const c = math();
  assert.deepEqual(strings(run(c, 'zzBalanceWeights(zzBalanceArcs(q(0),q(1,3)),q(1,3))')), ['3/4','1/4','0','0']);
});

test('a bit across the turn seam preserves exactly one bit', () => {
  const c = math();
  assert.deepEqual(strings(run(c, 'zzBalanceWeights(zzBalanceArcs(q(-1,12),q(1,6)),q(1,4))')), ['2/3','0','0','1/3']);
});

test('whole ring balances keep exact counts and fractional quarters', () => {
  const c = math(), data = c.coneBalanceData(0, true);
  assert.deepEqual(strings(data.quarters), [['0','3/4'],['1/2','1/4'],['1/2','1/4'],['0','3/4']]);
  assert.deepEqual(strings(run(c, 'coneBalanceData(0).quarters.reduce(coneBalanceAdd)')), ['1','2']);
  assert.equal(c.coneBalanceNumber(data.quarters[0][1]), '3/4');
});

test('one third rotation retains its rational source and conserved bit totals', () => {
  const c = math();
  run(c, 'coneRot=[coneMotionWrite("rotation:0",q(1,3))]');
  assert.deepEqual(strings(run(c, 'coneBalanceData(0).quarters.reduce(coneBalanceAdd)')), ['1','2']);
  assert.equal(run(c, 'coneMotionRot(0,3,false).value.text()'), '1/3');
  assert.deepEqual(strings(run(c, 'coneBalanceVector(coneBalanceData(0,true).cells[0],q(1,7)).reduce((s,x,k)=>{s[k%2]=s[k%2].add(x);return s},[q(0),q(0)])')), ['1','2']);
});

test('tiny differences are neither erased in display nor accepted as equality', () => {
  const c = math();
  assert.equal(run(c, 'coneBalanceEqual([q(1),q(0)],[q(1).add(q(1,1000000000000n)),q(0)])'), false);
  assert.equal(run(c, 'coneBalanceNumber(q(1,1000000000000n))'), '1/1000000000000');
});

test('half ring and its inverse each contribute exactly one bit', () => {
  const c = math();
  run(c, `Object.assign(Z,{rows:['1'],coneSlits:'cut2',sunHalf:true,cutPrev:'alt'});`);
  assert.deepEqual(strings(run(c, 'coneBalanceData(0).quarters.reduce(coneBalanceAdd)')), ['1','1']);
});

test('cut symmetry, alternating inverse and split first ring conserve counts', () => {
  const c = math();
  for (const mode of ['cut','cut2','cutA','cutS']) {
    run(c, `Object.assign(Z,{rows:['1','101'],coneSlits:'${mode}',row1Whole:true,cutPrev:'alt'});coneRot=[0,0];`);
    assert.deepEqual(strings(run(c, 'coneBalanceData(0).quarters.reduce(coneBalanceAdd)')), mode === 'cut2' ? ['3','4'] : ['1','3']);
  }
  run(c, `Object.assign(Z,{rows:['1','101'],coneSlits:'cutS',laserQuad:true,row1Parts:'sym2'});`);
  assert.deepEqual(strings(run(c, 'coneBalanceData(0).quarters.reduce(coneBalanceAdd)')), ['1','3']);
});

test('pause lands exactly at first equality between frames in either direction', () => {
  for (const speed of [360,-360]) {
    const c = math();
    run(c, `Z.rows=['1010'];Z.coneAutoSp=${speed}`);
    const hit = c.coneBalancePauseSweep('1/5', true);
    assert.equal(hit.seconds.text(), '1/8');
    c.coneMotionAdvance(hit.seconds);
    assert.equal(c.coneBalanceAllEqual(c.coneBalanceData(0).quarters), true);
    const next = c.coneBalancePauseSweep('1/3', false);
    assert.equal(next.seconds.text(), '1/4');
  }
});

test('almost equal quarters never trigger a pause', () => {
  const c = math();
  run(c, `Z.rows=['1010'];coneMotionSetClock(q(0),q(45).add(q(1,1000000000000n)));Z.coneAutoSp=0;`);
  assert.equal(c.coneBalanceAllEqual(c.coneBalanceData(0).quarters), false);
  assert.equal(c.coneBalancePauseSweep(1, true).seconds, null);
});

test('auto balance applies a rational magnetic rotation and verifies exact equality', async () => {
  const c = math();
  run(c, `Z.rows=['1010'];`);
  await c.coneBalanceAutoEqualize();
  assert.equal(c.coneBalanceAllEqual(c.coneBalanceData(0).quarters), true, c.lastMessage);
  assert.ok(c.lastMessage.includes('равны'), c.lastMessage);
});

test('pair search refuses tiny residuals and keeps exact distinct options', async () => {
  const c = math();
  const result = await run(c, `coneBalancePairSearch([{options:[
    {value:[q('1/1000000000000'),q(0),q(0),q(0)]},
    {value:[q(0),q(0),q(0),q(0)]}
  ]}],[q(0),q(0),q(0),q(0)],[0,1],coneBalanceSearchKey(),performance.now()+1000)`);
  assert.ok(result.solution);
  assert.equal(result.solution[0].value[0].text(), '0');
});

test('frame pause preserves a non-decimal event time through legacy animation', () => {
  const c = math(), source = readFileSync(__dirname + '/zz-ui.js', 'utf8');
  const start = source.indexOf('  const autoStep = (dt) => {');
  const end = source.indexOf('  window.zzBallContinueFrame', start);
  run(c, `Z.rows=['1010'];Z.coneAutoSp=7;Z.coneBalancePause=true;
    var balancePauseArmed=true, stopped=false;
    function autoSet(value){stopped=!value;}
    function autoStepMove(dt){Z.coneSpin=((Z.coneSpin||0)+Z.coneAutoSp*dt)%360;return true;}
    ${source.slice(start,end)}
    autoStep(7);`);
  assert.equal(c.stopped, true);
  assert.equal(run(c, 'coneMotionClock().degrees.text()'), '45');
  assert.equal(c.coneBalanceAllEqual(c.coneBalanceData(0).quarters), true);
});

test('cached balances invalidate when exact state changes within the same Number projection', () => {
  const c = math();
  run(c, `Z.rows=['1010'];coneMotionSetClock(q(0),q(45));`);
  assert.equal(c.coneBalanceAllEqual(c.coneBalanceData(0).quarters), true);
  run(c, `coneMotionSetClock(q(0),q(45).add(q(1,1000000000000000000n)));`);
  assert.equal(c.Z.coneSpin, 45);
  assert.equal(c.coneBalanceAllEqual(c.coneBalanceData(0).quarters), false);
});

test('the complete 71-row sequence conserves both bit counts across all quarters', () => {
  const c = math();
  run(c, readFileSync(__dirname + '/../_js/initial-rows.js', 'utf8'));
  run(c, `Z.rows=ZZ_INITIAL_ROWS.slice();coneMotionSetClock(q(1,7),q(360,11));Z.coneSpinMode='obit';`);
  const source = c.Z.rows.join(''), ones = [...source].filter(ch => ch === '1').length;
  const totals = run(c, 'coneBalanceData(0,true).quarters.reduce(coneBalanceAdd)');
  assert.equal(totals[0].text(), String(source.length - ones));
  assert.equal(totals[1].text(), String(ones));
  assert.equal(c.Z.rows.join(''), source);
});
