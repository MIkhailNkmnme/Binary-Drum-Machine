const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const core = require('./mayatnik-core.js');
const flow = require('./mayatnik-edge-flow.js');
const html = fs.readFileSync(__dirname + '/Zerkalius-mayatnik.html', 'utf8');

test('edge dependencies disable unavailable controls without changing saved values',()=>{
  const begin=html.indexOf('  const edgeSync = () => {'),end=html.indexOf('  window.mayEdgeFlow=',begin);
  for(const edgeWrap of [false,true])for(const edgeRhombOn of [false,true])for(const edgeEndsOn of [false,true])for(const foreign of ['', 'animatrix','compare','sequence','test']){
    const st={edgeWrap,edgeRhombOn,edgeEndsOn,edgeClose:true,edgeBounce:true,edgeContinuous:true,edgeMarkOn:true,edgeEndsScale:1,sequenceSourceOn:foreign==='sequence'},before={...st},nodes=new Map();
    const get=id=>{if(!nodes.has(id))nodes.set(id,{style:{},attrs:{},setAttribute(k,v){this.attrs[k]=v;},selectedOptions:[{textContent:'4N−1'}]});return nodes.get(id);};
    const ctx={st,$:get,animatrixOn:()=>foreign==='animatrix',compareOn:()=>foreign==='compare',testPattern:foreign==='test'?{}:null,edgeWidthFactor:()=>4};vm.runInNewContext(html.slice(begin,end)+';this.sync=edgeSync;',ctx);ctx.sync();const active=edgeWrap&&!foreign;
    for(const id of ['edgeBounceTop','edgeContinuous','edgeEndsTop','edgeRhombTop','edgeWidthTop','edgeWidthCycle'])assert.equal(get(id).disabled,!active,id);
    assert.equal(get('edgeCloseTop').disabled,!active||!edgeRhombOn);for(const id of ['edgeEndsMinus','edgeEndsPlus'])assert.equal(get(id).disabled,!active||!edgeEndsOn);assert.deepEqual(st,before);
    st.edgeEndsScale=.5;ctx.sync();assert.equal(get('edgeEndsMinus').disabled,true);st.edgeEndsScale=2;ctx.sync();assert.equal(get('edgeEndsPlus').disabled,true);
  }
});

test('Reset control is off in startup and clean defaults; saved transport preference maps to the inverse visual state',()=>{
  const initial=html.slice(html.indexOf('  let st = '),html.indexOf('  if (!CHISTO)'));
  const first={MayatnikAnimatrixSource:{defaults:()=>({})}};vm.runInNewContext(initial+';this.state=st;',first);
  assert.equal(first.state.edgeContinuous,true);
  assert.equal(require('./mayatnik-reset-state.js').defaults().edgeContinuous,true);
  for(const continuous of [true,false]){
    const button={attrs:{},getAttribute(k){return this.attrs[k];},setAttribute(k,v){this.attrs[k]=v;},classList:{toggle(k,v){this[k]=v;}}};
    vm.runInNewContext(source('edgeFlowButtonSync')+';edgeFlowButtonSync();',{st:{edgeContinuous:continuous},$:()=>button});
    assert.equal(button.attrs['aria-pressed'],String(!continuous));assert.equal(button.classList.on,!continuous);
  }
});

function source(name) {
  const start = html.indexOf('function ' + name + '(');
  assert.ok(start >= 0, name);
  let end = html.indexOf('{', start) + 1, depth = 1;
  while (depth && end < html.length) {
    if (html[end] === '{') depth++;
    if (html[end] === '}') depth--;
    end++;
  }
  return html.slice(start, end);
}

function host(pair, bounce, continuous, factor = 2) {
  const rows = 8, width = factor * rows - 1, anchor = (width - 1) / 2, controls = new Map();
  const st = { rows, steps: width + 1, edgeWidth: factor, mode: 'pend', pair, edgeWrap: true, speed: 1,
    edgeBounce: bounce, edgeContinuous: continuous, edgeFlowMax: 0, edgeFlowKey: '' };
  const f = core.field(width, rows, 'empty', anchor);
  if (pair) core.cone(f, anchor, rows);
  const noop = () => {};
  const h = vm.createContext({
    st, f, geo: { anchor, W: width }, MAYATNIK: core, MayatnikEdgeFlow: flow,
    k: 0, interval: 4, snaps: new Map(), edgeMark: new Uint8Array(width * rows),
    edgeJumps: 0, edgeLaps: 0, target: 0, playing: false, window: {}, testPattern: null,
    rowBuild: null, gpuBig: null, konus: null, performance, Event, fast: false,
    t0: 0, paintJumpFrom: null, lastDraw: 0, drawMs: 0, coneAutoRun: false,
    $(id) { if (!controls.has(id)) controls.set(id, {}); return controls.get(id); },
    pairOn: () => pair, compareOn: () => false, coneContinueAllowed: () => false,
    templateFollowActive: () => false, gpuManualCpu: () => false, gpuPaintCpu: () => false,
    manualSnakeFrameWait: () => false, templateFollowFrameWait: () => false, ochkiFrameWait: () => false,
    constructionActive: () => false, flashRowCells: noop, rowBuildHighlightDraw: noop, bmGen: 0,
    animatrixRepeatStop: () => false, animatrixUnlimited: () => false, animatrixExtend: () => false,
    stopFrameTransports: noop, cancelFrameNavigation: noop, ochkiPauseCancel: noop,
    draw: noop, foldSuspend: noop, queueSession: noop, dispatchEvent: noop,
    advancePaintColour: noop, syncTransportPlayUI: noop, save: noop, next: noop,
    stop() { h.playing = false; h.fast = false; }, templateFollowStep(delta) { h.goToImmediate(h.k + delta); }
  });
  const functions = ['animatrixOn', 'edgeFlowOn', 'edgeFlowExtend', 'fieldFrames', 'total',
    'snap', 'edgeNextCycle', 'edgeCol', 'apexCol', 'addOne', 'goToImmediate',
    'edgeWidthFactor', 'edgeRawApices', 'coneAutoExtend', 'play', 'tick',
    'rowBuildCancel', 'rowBuildUnavailable', 'rowBuildStep', 'rowBuildBack'];
  vm.runInContext(functions.map(source).join('\n'), h);
  const playback = html.slice(html.indexOf('  const edgeLoop = '), html.indexOf('  function templateFollowFrameWait('));
  vm.runInContext(playback, h);
  const manual = html.match(/\$\('bStep'\)\.onclick = \(\) => \{[\s\S]*?\n  \};/);
  assert.ok(manual);
  vm.runInContext(manual[0], h);
  h.snap();
  // Drain only scheduled forward calculations. goToImmediate runs the real restore branch.
  h.drain = () => {
    while (h.playing && h.k < h.target) assert.equal(h.addOne(), true);
    h.stop();
  };
  return h;
}

function capture(h) {
  return { val: h.f.val.slice(), marks: h.edgeMark.slice(), jumps: h.edgeJumps,
    laps: h.edgeLaps, frame: h.k };
}
function step(h) { h.$('bStep').onclick(); h.drain(); }
function seek(h, frame) { h.goToImmediate(frame); h.drain(); }

for (const bounce of [false, true]) for (const pair of [false, true]) {
  const mode = (bounce ? 'bounce' : 'wrap') + (pair ? ', paired' : ', single');
  test('manual step and seek preserve the current accumulated cycle: ' + mode, () => {
    const h = host(pair, bounce, false);
    const total = h.total(), generations = [];
    for (let cycle = 0; cycle < 3; cycle++) {
      const states = [];
      if (cycle) {
        const old = capture(h);
        step(h);
        const baseline = h.snaps.get(0);
        assert.deepEqual(baseline.val, old.val);
        assert.deepEqual(baseline.edgeMark, old.marks);
        assert.equal(baseline.edgeJumps, old.jumps);
        assert.equal(baseline.edgeLaps, cycle);
        assert.equal(h.k, 1);
        assert.equal(h.target, h.k);
        assert.ok(!h.snaps.has(total), 'new cycle must not retain a previous end snapshot');
      }
      for (let i = h.k; i <= total; i++) {
        if (h.k !== i) step(h);
        states[i] = capture(h);
      }
      assert.ok(h.edgeMark.some(Boolean));
      const tip = capture(h);
      for (const i of [3, 4, total - 1, 1, total]) {
        seek(h, i);
        assert.deepEqual(capture(h), states[i]);
      }
      assert.deepEqual(capture(h), tip);
      generations.push(tip);
    }
    assert.notDeepEqual(generations[0].val, generations[1].val);
  });
  test('manual step extends the continuous frame and replays the same marks: ' + mode, () => {
    const h = host(pair, bounce, true), base = h.total(), recorded = [];
    for (let i = 1; i <= 3 * base + 1; i++) {
      step(h);
      assert.equal(h.k, i);
      assert.equal(h.target, i);
      assert.ok(h.total() >= i);
      assert.equal(h.edgeJumps, flow.counts(h.st, i, h.f.W).jumps);
      recorded[i] = capture(h);
    }
    for (const i of [base - 1, base + 1, 2 * base, 1, 3 * base + 1]) {
      seek(h, i);
      assert.deepEqual(capture(h), recorded[i]);
    }
  });
}

test('Play from the endpoint and multi-step ticks preserve the same field as individual manual steps', () => {
  for (const continuous of [false, true]) for (const bounce of [false, true]) for (const pair of [false, true]) {
    const playing = host(pair, bounce, continuous), manual = host(pair, bounce, continuous);
    const base = playing.total();
    seek(playing, base);
    seek(manual, base);
    playing.play();
    assert.equal(playing.playing, true);
    for (const speed of [1, base - 1, base + 1, base, 2 * base + 1]) {
      playing.st.speed = speed;
      playing.tick();
      for (let i = 0; i < speed; i++) step(manual);
      const actual = capture(playing), expected = capture(manual);
      assert.deepEqual(actual.val, expected.val);
      assert.deepEqual(actual.marks, expected.marks);
      assert.equal(actual.jumps, expected.jumps);
      const absolute = s => continuous ? s.frame : s.laps * base + s.frame;
      assert.equal(absolute(actual), absolute(expected));
    }
  }
});

test('row stepping, undo and cancellation agree with full edge frames on different field widths', () => {
  for (const factor of [2, 4, 6, 8]) for (const bounce of [false, true]) for (const pair of [false, true]) {
    const h = host(pair, bounce, false, factor), manual = host(pair, bounce, false, factor);
    // The last ordinary frame places an off-field apex in every width.
    const before = h.total() - 1;
    seek(h, before);
    seek(manual, before);
    const original = capture(h);
    h.rowBuildStep();
    const firstRow = capture(h);
    h.rowBuildStep();
    assert.equal(h.rowBuildBack(), true);
    assert.equal(h.rowBuild.row, 1);
    assert.deepEqual(capture(h), firstRow);
    h.rowBuildCancel();
    assert.deepEqual(capture(h), original);
    for (let cycle = 0; cycle < 2; cycle++) {
      step(manual);
      for (let r = 0; r < h.f.H; r++) h.rowBuildStep();
      assert.equal(h.rowBuild, null);
      assert.deepEqual(capture(h), capture(manual));
    }
  }
});

test('host share capture and restore reproduce a later legacy cycle, colour and bit paint, view and tools', async () => {
  const links = require('./mayatnik-share-link.js');
  const make = () => {
    const h = host(false, true, false), buttons = new Map([['bStep', h.$('bStep')]]), noop = () => {};
    Object.assign(h, {
      MayatnikShareLink: links, MayatnikResetState: require('./mayatnik-reset-state.js'),
      MayatnikSettingsLibrary: { STATE_KEYS: [] }, MayatnikConstruction: require('./mayatnik-construction.js'),
      structuredClone, Int8Array, Uint8Array, Uint32Array, img: { width: 15, height: 8 },
      RK: 1, VX: 0, joinedOn: () => false, cellSelectionModel: null, SHARE_ACTIVE: true,
      fillMode: false, autoVertical: 0, axisPicking: false, rulerMode: false,
      axisLineMode: false, mirrorLine: false, templatePickMode: 'add', templatePickEnabled: false,
      templateDragEnabled: false, autoPaintIds: ['fillColour'], fillMask: null, paintBits: null,
      wrap: { scrollLeft: 0, scrollTop: 0 }, edgeLooping: false, templateDragging: false,
      mirState: () => h.st.mirAxis, cacheRestoring: false,
      reset() { h.f.val.fill(-1); h.edgeMark.fill(0); h.k = 0; h.edgeLaps = h.edgeJumps = 0; h.snaps.clear(); h.snap(); },
      goTo(frame) { seek(h, frame); },
      $(id) {
        if (!buttons.has(id)) buttons.set(id, { value: '', checked: false, setAttribute: noop, matches: () => false });
        return buttons.get(id);
      }
    });
    Object.assign(h.st, { ...h.MayatnikResetState.defaults(), ...h.st, bg: 'empty', mirAxis: { on: true },
      view: 'rgbNeighbours', rgbNeighbourFilters: [1, 3, 6], zoom: 4, constructionEvolution: 1 });
    for (const name of ('clearFillPreview syncPaintToolColours templatePickSync writeUI triangleMapSync crossMirrorSync applyBitColours lgSync blackMirrorSync animHlSync growSync meetSync triTopSync thirdsSync axisPaintSync zSnapSync zTopSync zLockSync zLinesSync edgeSync joined180Sync viewRotationSync midSync autoSync fillSync axisLinesSync rulerSync templateSync parityOverlayMask manualPaintClear selectTemplate lockWipe clearKonus mirrorLiveSet canvasSize layout centerAnchor queueDigits').split(' ')) h[name] = noop;
    const start = html.indexOf('  function captureSharePaint('), end = html.indexOf('  async function applyShareLink(');
    vm.runInContext(html.slice(start, end), h);
    return h;
  };
  const src = make(), dst = make();
  for (let i = 0; i < 2 * src.total() + 5; i++) step(src);
  src.fillMode = true; src.autoVertical = 2; src.axisPicking = true; src.templateDragEnabled = true;
  src.$('fillColour').value = '#abcdef'; src.$('fillMirror').checked = false;
  src.fillMask = new Uint32Array(120); src.fillMask[17] = 0xff123456;
  src.paintBits = new Int8Array(120).fill(-1); src.paintBits[14] = 0; src.paintBits[88] = 1;
  src.wrap.scrollLeft = 3; src.wrap.scrollTop = 2;
  const data = await links.decode(await links.encode(src.captureSharePayload()));
  await dst.applySharePayload(data, { booting: true, stash: false });
  assert.deepEqual(capture(dst), capture(src));
  assert.deepEqual(dst.fillMask, src.fillMask);
  assert.deepEqual(dst.paintBits, src.paintBits);
  assert.deepEqual(dst.st.rgbNeighbourFilters, src.st.rgbNeighbourFilters);
  assert.equal(dst.st.zoom, 4);
  assert.deepEqual(dst.wrap, src.wrap);
  assert.equal(dst.$('fillColour').value, '#abcdef');
  assert.equal(dst.$('fillMirror').checked, false);
  for (const key of ['fillMode', 'autoVertical', 'axisPicking', 'templateDragEnabled']) assert.equal(dst[key], src[key]);
  for (const frame of [0, 1, src.total()]) {
    seek(src, frame); seek(dst, frame);
    assert.deepEqual(capture(dst), capture(src), 'linked snapshot at local frame ' + frame);
  }
});

test('edge settings prepare the chosen source without starting playback, even with a saved edge flag', () => {
  const start = html.indexOf('  function edgeActivateSource(');
  const end = html.indexOf('\n  };', html.indexOf("$('edgeBounceTop').onclick", start));
  assert.ok(start >= 0 && end > start);
  for (const foreign of ['animatrix', 'compare', 'sequence', 'test']) {
    for (const button of ['edgeWrapTop', 'edgeWrap', 'edgeMarkTop', 'edgeEndsTop', 'edgeBounceTop']) {
      const h = host(false, false, false);
      h.st.animatrixOn = foreign === 'animatrix';
      h.st.compareSource = foreign === 'compare' ? 'xor' : '';
      h.st.sequenceSourceOn = foreign === 'sequence';
      h.testPattern = foreign === 'test' ? { kind: 'xor' } : null;
      h.testXorInfo = h.testPattern;
      h.st.edgeBounce = h.st.edgeMarkOn = h.st.edgeEndsOn = true;
      let prepared = 0,started=0;
      Object.assign(h, {
        animatrixEngine: {}, compareEngine: {}, compareOn: () => !!h.st.compareSource,
        animatrixNewWork() {}, animatrixNotice() {}, edgeSync() {},
        build() {started++;},
        reset() {
          prepared++;h.playing=false;h.k=0;
          assert.equal(h.st.edgeWrap, true);
          assert.equal(h.st.animatrixOn, false);
          assert.equal(h.st.sequenceSourceOn, false);
          assert.equal(h.st.compareSource, '');
          assert.equal(h.testPattern, null);
          assert.equal(h.animatrixEngine, null);
          assert.equal(h.compareEngine, null);
        }
      });
      vm.runInContext(html.slice(start, end + 5), h);
      h.$(button).onclick();
      assert.equal(prepared, 1);assert.equal(started,0);assert.equal(h.playing,false);assert.equal(h.k,0);
      assert.equal(h.st.edgeBounce, true);
      if (button === 'edgeMarkTop') assert.equal(h.st.edgeMarkOn, true);
      if (button === 'edgeEndsTop') assert.equal(h.st.edgeEndsOn, true);
    }
  }
});

test('unlimited Animatrix play and seek cross 32-bit frames and stop cleanly at the safe integer limit', () => {
  const api = require('./mayatnik-animatrix-source.js'), h = host(false, false, false);
  Object.assign(h.st, api.defaults(), {
    animatrixOn: true, animatrixCycleMode: 'infinite', animatrixSource: api.demo(8),
    animatrixFrameMax: 2 ** 31 + 5, edgeWrap: false
  });
  Object.assign(h, { MayatnikAnimatrixSource: api, animatrixMaterialize() {}, animatrixNotice() {} });
  vm.runInContext(['animatrixUnlimited', 'animatrixExtend', 'animatrixRepeatStop'].map(source).join('\n'), h);
  h.k = h.total();
  const start = h.k;
  h.play(); h.tick();
  assert.equal(h.k, start + 1);
  assert.ok(h.total() >= h.k);
  h.goToImmediate(start + 4);
  h.drain();
  assert.equal(h.k, start + 4);
  h.goToImmediate(Infinity);
  assert.equal(h.k, start + 4);
  assert.equal(h.playing, false);
  h.goToImmediate(NaN);
  assert.equal(h.k, 0);
  h.st.animatrixFrameMax = Number.MAX_SAFE_INTEGER;
  h.k = h.st.animatrixFrameMax;
  h.play();
  assert.equal(h.playing, false);
  assert.equal(h.k, Number.MAX_SAFE_INTEGER);
  assert.ok(h.$('fillInfo').textContent);
});

test('normal edge playback keeps the same x steps and t delay after Pause then Play',()=>{
  for(const bounce of [false,true])for(const continuous of [false,true])for(const factor of [2,4,6,8])for(const frameT of [0,4]){
    const h=host(false,bounce,continuous,factor),delays=[],expected=frameT?200:'raf';h.st.speed=3;h.st.frameT=frameT;
    Object.assign(h,{setTimeout(fn,ms){delays.push(ms);return 1;},requestAnimationFrame(){delays.push('raf');return 1;}});
    vm.runInContext(source('next'),h);h.play();assert.equal(h.fast,false);assert.equal(delays.at(-1),expected);
    const first=h.k;h.tick();const count=h.k-first;assert.equal(count,Math.max(1,Math.round(3*Math.max(1,factor/4))));
    h.play();assert.equal(h.playing,false);h.play();assert.equal(h.fast,false);assert.equal(delays.at(-1),expected);
    const resumed=h.k;h.tick();assert.equal(h.k-resumed,count);assert.equal(delays.at(-1),expected);
  }
});
