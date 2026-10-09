const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const read = name => fs.readFileSync(path.join(__dirname, name), 'utf8');
const ui = read('zz-ui.js');
const ball = read('zz-ball.js');
const mobile = read('zz-mobile.js');
const page = read('Zerkalius-zazerkalius.html');

test('ball panel decoration cannot create a render mutation feedback loop', () => {
  const classes = new Set(['cmin']);
  const el = {classList: {contains: name => classes.has(name)}};
  const frames = []; let observer, renders = 0;
  const state = {};
  const context = vm.createContext({Z: state, el,
    MutationObserver: class {constructor(callback) {observer = callback;} observe() {}},
    requestAnimationFrame: callback => {frames.push(callback); return frames.length;},
    renderCone: () => {renders++; classes.add('tzg'); observer();}
  });
  vm.runInContext(declaration(ball, 'function observeLabFold('), context);
  vm.runInContext('observeLabFold(el)', context);
  for (let i = 0; i < 20; i++) {classes.add('on'); observer();}
  assert.equal(frames.length, 0); assert.equal(renders, 0);
  classes.delete('cmin'); observer(); observer();
  assert.equal(state.coneBallLabOpen, true); assert.equal(frames.length, 1);
  frames.shift()();
  assert.equal(renders, 1); assert.equal(frames.length, 0);
  classes.add('cmin'); observer(); classes.delete('cmin'); observer();
  assert.equal(frames.length, 1); frames.shift()();
  assert.equal(state.coneBallLabOpen, true); assert.equal(renders, 2); assert.equal(frames.length, 0);
});

function declaration(source, marker, start = 0) {
  const at = source.indexOf(marker, start);
  assert.ok(at >= 0, marker);
  let end = source.indexOf('\n', at);
  for (;;) {
    const text = source.slice(at, end);
    try { new vm.Script(text); return text; }
    catch (error) { if (!(error instanceof SyntaxError)) throw error; end = source.indexOf('\n', end + 1); assert.ok(end >= 0, marker); }
  }
}

test('the three former plates are static ordinary button groups', () => {
  for (const [id, cls, label] of [
    ['solBallLab', 'cg-ball', 'Шарики'],
    ['sunMoonTbl', 'cg-sun', '☀ · ☾'],
    ['lasAlgo', 'cg-algo-info', 'Алг. · подск.']
  ]) {
    const tag = page.match(new RegExp(`<div id="${id}"[^>]*>`));
    assert.ok(tag, id);
    assert.match(tag[0], /class="[^"]*\bcgrp\b/);
    assert.match(tag[0], new RegExp(`\\b${cls}\\b`));
    assert.match(page.slice(tag.index, tag.index + 500), new RegExp(`<span class="glab">${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</span>`));
  }
  assert.match(ui, /const SOL_PLATES = \{\};/);
});

test('their content uses the group body and never initializes a special plate', () => {
  const sun = declaration(ui, 'function sunTblBuild(');
  const algoAt = ui.indexOf('v0.1007: правила');
  const algo = ui.slice(algoAt, ui.indexOf('if (!lasDeps._b)', algoAt));
  const lab = declaration(ball, 'function initLab()');
  assert.match(sun, /:scope > \.cgb/);
  assert.doesNotMatch(sun, /plateInit|pminbtn|class="smh"/);
  assert.match(algo, /:scope > \.cgb/);
  assert.doesNotMatch(algo, /plateInit|class="rth"|pminbtn/);
  assert.match(lab, /\$\("solBallLab"\)/);
  assert.match(lab, /:scope > \.cgb/);
  assert.doesNotMatch(lab, /createElement\("div"\)|plateInit|class="rth"|pminbtn/);
});

test('full-width panel bodies cannot feed their own width back into group sizing', () => {
  const sun = declaration(ui, 'function sunTblBuild(');
  const rings = declaration(ui, 'function ringTblBuild(');
  const algoAt = ui.indexOf('v0.1007: правила');
  const algo = ui.slice(algoAt, ui.indexOf('if (!lasDeps._b)', algoAt));
  const lab = declaration(ball, 'function initLab()');
  for (const source of [sun, rings, algo, lab]) assert.match(source, /cgrp-fill/);

  const justify = declaration(ui, 'function tzJustify(');
  const minWidth = declaration(ui, 'function tzMinW(');
  assert.match(justify, /!e\.closest\("\.cgrp-fill"\)/);
  assert.match(minWidth, /el\.classList\.contains\("cgrp-fill"\)/);
});

test('legacy plate layout migrates to the three group keys', () => {
  const migration = declaration(ui, 'function sunPanelMergeLayout(');
  for (const pair of [
    ['@sunMoonTbl', '☀ · ☾'],
    ['@solBallLab', 'шарики'],
    ['@lasAlgo', 'алг. · подск.']
  ]) {
    assert.ok(migration.includes(`key: "${pair[1]}"`));
    assert.ok(migration.includes(`"${pair[0]}"`));
  }
  assert.match(migration, /Z\.cgrpPos\[d\.key\]/);
  assert.match(migration, /Z\.cgrpFld\[d\.key\]/);
  assert.match(migration, /Z\.cgrpMin\[d\.key\]/);
  assert.match(migration, /link\.to = d\.key/);
});

test('outline-off styling is inherited from ordinary groups', () => {
  assert.match(page, /html\.noln :is\(#w-cone \.tools, #paneGrp\) \.cgrp\.tzg::before\{display:none\}/);
  assert.match(page, /html\.noln :is\(#w-cone \.tools, #paneGrp\) \.cgrp:not\(\.tzg\)\{border-color:transparent !important\}/);
  for (const id of ['sunMoonTbl', 'solBallLab', 'lasAlgo']) {
    assert.doesNotMatch(page, new RegExp(`#${id}\\{[^}]*position:absolute`));
  }
});

test('all three use generic cgrp fold and drag state', () => {
  assert.match(ui, /g\.classList\.add\("cdrag"\)/);
  assert.match(ui, /Z\.cgrpPos\[g\.dataset\.g\] = \{ x: gr\.left - tr\.left, y: gr\.top - tr\.top \}/);
  assert.match(ball, /classList\.contains\("cmin"\)/);
  assert.match(mobile, /ballLab\._solFold/);
  assert.doesNotMatch(mobile, /plateFoldToggle\(ballLab/);
});

test('panel clusters refer only to current group keys', () => {
  const at = ui.indexOf('const sections = [');
  const block = ui.slice(at, ui.indexOf('];', at) + 2);
  assert.match(block, /"☀ · ☾"/);
  assert.match(block, /"шарики"/);
  assert.match(block, /"алг\. · подск\."/);
  assert.doesNotMatch(block, /@sunMoonTbl|@solBallLab|@lasAlgo/);
});

test('link-cycle guard still rejects long cycles', () => {
  const context = vm.createContext({});
  vm.runInContext(declaration(ui, 'function solLinkCycle('), context);
  const links = {};
  for (let i = 0; i < 30; i++) links['g' + i] = { to: 'g' + (i + 1) };
  assert.equal(context.solLinkCycle(links, 'g30', 'g0'), true);
  assert.equal(context.solLinkCycle(links, 'free', 'g0'), false);
});

test('fold button avoids rewriting unchanged accessible text', () => {
  const context = vm.createContext({});
  vm.runInContext(declaration(ui, 'function solFoldButton('), context);
  const attrs = new Map(); let writes = 0, text = '';
  const button = {
    title: '',
    get textContent() { return text; },
    set textContent(value) { writes++; text = value; },
    getAttribute: key => attrs.get(key) ?? null,
    setAttribute: (key, value) => attrs.set(key, value)
  };
  context.solFoldButton(button, false, 'Шарики');
  const count = writes;
  for (let i = 0; i < 10; i++) context.solFoldButton(button, false, 'Шарики');
  assert.equal(writes, count);
  assert.equal(button.getAttribute('aria-expanded'), 'true');
});

test('left pane zigzag keeps a permanently visible light outline', () => {
  const paneZig = declaration(ui, 'function paneZig(');
  assert.match(paneZig, /getPropertyValue\("--txt"\)/);
  assert.match(paneZig, /sq\(edgeLn, 1\.5\)/);
});

test('the top question button toggles all hover tips instead of the help window', () => {
  const tips = declaration(ui, 'function tipsApply(');
  assert.match(tips, /Z\.tipsOn !== false/);
  assert.match(tips, /"\[data-zz-tip\]" : "\[title\]"/);
  assert.match(ui, /\$\("bHelp"\)\.onclick = \(\) => \{ Z\.tipsOn/);
  assert.doesNotMatch(ui, /\$\("bHelp"\)\.onclick = \(\) => \{ Z\.helpOn/);
});

test('both jagged edges remain above the active window after raising it', () => {
  const nodes = { paneZigOv: { style: {} }, fieldZigOv: { style: {} } };
  const state = { z: 607 };
  const context = vm.createContext({ Z: state, document: { getElementById: id => nodes[id] } });
  vm.runInContext(declaration(ui, 'function paneZigZ('), context);
  for (const z of [10, 607, 900]) {
    state.z = z; context.paneZigZ();
    for (const node of Object.values(nodes)) assert.ok(Number(node.style.zIndex) > z);
  }
});

test('axes use the positioned ancestor and stay flush with the first menu strip', () => {
  const host = { clientLeft: 1, clientTop: 1, scrollLeft: 9, scrollTop: 11,
    getBoundingClientRect: () => ({ left: 221, top: 34, width: 844 }) };
  const attrs = {};
  const button = { style: {}, offsetWidth: 24, offsetParent: host,
    parentElement: { getBoundingClientRect() { throw new Error('static body is not the containing block'); } },
    setAttribute: (key, value) => { attrs[key] = value; } };
  const canvas = { getBoundingClientRect: () => ({ left: 221, right: 1065, top: 34, width: 844 }) };
  const context = vm.createContext({ Z: { coneAxes: true }, coneGeom: { dpr: 2, cx: 800 },
    cgTabsBottom: () => 62, document: { getElementById: id => ({ bC3Axes: button, coneCv: canvas })[id] } });
  vm.runInContext(declaration(ui, 'function c3AxesPlace('), context);
  context.c3AxesPlace();
  assert.equal(button.style.left, '396.0px');
  assert.equal(button.style.top, '10.0px');
  assert.equal(attrs['aria-pressed'], 'true');
  context.Z.coneAxes = false; context.c3AxesPlace();
  assert.equal(attrs['aria-pressed'], 'false');
});

test('canvas artwork cannot swallow the top axes button', () => {
  const context = vm.createContext({ document: { getElementById: () => ({
    hidden: false, getBoundingClientRect() { throw new Error('axes must bypass artwork hit testing'); }
  }) } });
  vm.runInContext(declaration(ui, 'function coneArtBlocksButton('), context);
  context.coneArtBlocksButton({ target: { closest: () => ({ id: 'bC3Axes' }) } });
});

test('window tabs keep their widths and positions when the selected tab changes', () => {
  const style = () => { const values = {}; return { values,
    setProperty: (key, value) => { values[key] = value; }, removeProperty: key => { delete values[key]; } }; };
  const buttons = ['Solarius', 'Бирамида', 'Развёртка', 'Сетка'].map(text => {
    const classes = new Set();
    return { tagName: 'BUTTON', textContent: text, dataset: {}, offsetTop: 0, style: style(),
      closest: selector => selector === '#pinBar' ? {} : null,
      classList: { contains: key => classes.has(key), add: key => classes.add(key), remove: key => classes.delete(key),
        toggle: (key, on) => on ? classes.add(key) : classes.delete(key) } };
  });
  const top = { children: [{ id: 'pinBar', children: buttons }], style: style(),
    classList: { add() {} }, scrollWidth: 800, clientWidth: 1200 };
  let measured;
  const context = vm.createContext({ TZC_H: 24, TZ_TIP: [1, 0, 1], TZ_NOTCH: [0, 1, 0], Z: {},
    window: {}, lpTag: {}, lpWin() {}, tzLnBg: () => '', getComputedStyle: () => ({ height: '24px', borderTopColor: '#888' }),
    document: { getElementById: id => id === 'top' ? top : null, createRange: () => ({ selectNodeContents: b => { measured = b; },
      getBoundingClientRect: () => ({ width: measured.textContent.length * 7 }) }) } });
  vm.runInContext(declaration(ui, 'function tzGeo(') + declaration(ui, 'function lpTop('), context);
  let baseline;
  for (const selected of [-1, 0, 1, 2, 3, 0]) {
    buttons.forEach((b, i) => b.classList.toggle('on', i === selected));
    context.lpTop('#888', () => true);
    let x = 0;
    const positions = buttons.map(b => { x += parseFloat(b.style.values['margin-left']) || 0;
      const width = parseFloat(b.style.values.width), result = { x, width }; x += width; return result; });
    if (!baseline) baseline = positions;
    else assert.deepEqual(positions, baseline);
  }
});

test('a group snaps under the top menu beside the window controls and stays there on the right teeth', () => {
  const visible = rect => ({ getClientRects: () => [rect], getBoundingClientRect: () => rect });
  const control = visible({ left: 48, right: 370, width: 322, top: 36, bottom: 61 });
  const head = { ...visible({ top: 34, bottom: 62 }), children: [control] };
  const body = { ...visible({ left: 44, right: 1768, top: 62, bottom: 863 }),
    closest: () => ({ ...visible({ left: 44, right: 1768, top: 34, bottom: 863 }), querySelector: () => head }) };
  const tabs = visible({ left: 118, right: 226, width: 108, top: 36, bottom: 55 });
  const edge = { ...visible({ left: 1760, right: 1768, top: 34, bottom: 863 }), style: { backgroundPosition: '0px 12px' } };
  const context = vm.createContext({ TZC_H: 24, document: {
    body: { classList: { contains: name => name === 'field-right' } },
    getElementById: id => ({ cgTabs: tabs, fieldZigOv: edge })[id]
  } });
  vm.runInContext(declaration(ui, 'function solPanelTop(') + declaration(ui, 'function solEdgePosition('), context);
  assert.equal(context.solPanelTop(body, 1468, 300), 34);
  assert.equal(context.solPanelTop(body, 200, 300), 62);
  assert.equal(context.solPanelTop(body), 62);
  const position = context.solEdgePosition({ offsetWidth: 300 }, { id: 'fieldZigOv', row: 0 },
    (x, width) => context.solPanelTop(body, x, width), 791);
  assert.equal(position.x, 1468);
  assert.equal(position.y, 34);
});

test('a group on the left teeth stays immediately below the Solarius menu without overlapping it', () => {
  const visible = rect => ({ getClientRects: () => [rect], getBoundingClientRect: () => rect });
  const title = visible({ left: 792, right: 920, width: 128, top: 34, bottom: 58 });
  const head = { ...visible({ top: 34, bottom: 58 }), children: [title] };
  const body = { ...visible({ left: 784, right: 1280, top: 58, bottom: 800 }),
    closest: () => ({ ...visible({ left: 784, right: 1280, top: 34, bottom: 800 }), querySelector: () => head }) };
  const edge = { ...visible({ left: 784, right: 792, top: 34, bottom: 800 }), style: { backgroundPosition: '0px 0px' } };
  const context = vm.createContext({ TZC_H: 24, document: {
    body: { classList: { contains: () => false } },
    getElementById: id => ({ cgTabs: null, fieldZigOv: edge })[id]
  } });
  vm.runInContext(declaration(ui, 'function solPanelTop(') + declaration(ui, 'function solEdgePosition('), context);
  assert.equal(context.solPanelTop(body, 784, 300), 58);
  const position = context.solEdgePosition({ offsetWidth: 300 }, { id: 'fieldZigOv', row: 0 },
    (x, width) => context.solPanelTop(body, x, width), 656);
  assert.equal(position.x, 784);
  assert.equal(position.y, 58);
  assert.equal(context.solPanelTop(body, 784, 300) - position.y, 0);
  // Рамка окна и фаза зубцов расходятся на 2 px: панель всё равно прижата к меню, а не к следующему ряду.
  head.getBoundingClientRect = () => ({ top: 35, bottom: 59 });
  edge.style.backgroundPosition = '0px 23px';
  const framed = context.solEdgePosition({ offsetWidth: 300 }, { id: 'fieldZigOv', row: 0 },
    (x, width) => context.solPanelTop(body, x, width), 656);
  assert.equal(framed.y, 59);
});

test('double click docks and restores a group while single click unfolds in the bottom dock', () => {
  const key = 'за чертой', folded = new Set();
  const state = { cgrpPos: { [key]: { x: 1200, y: -56 } }, cgrpFld: {}, cgrpMin: {},
    cgrpEdge: { [key]: { id: 'fieldZigOv', row: 0 } }, cgrpPin: {},
    cgrpLink: { child: { to: key, v: 1, dx: 0 } } };
  const g = { dataset: { g: key }, style: {}, classList: { toggle: (name, on) => on ? folded.add(name) : folded.delete(name) } };
  const context = vm.createContext({ Z: state, g, foldUi() {}, cgbSnap() {}, sizeApply() {}, cgrpCols() {},
    place() {}, linkSync() {}, save() {}, solHeaderRoom: () => 600,
    nodeUnpin: () => { delete state.cgrpEdge[key]; delete state.cgrpPin[key]; } });
  vm.runInContext(declaration(ui, 'function solLinkCycle(') + declaration(ui, 'const foldToggle = (') +
    declaration(ui, 'const dockToggle = () => {') + '; runDock = dockToggle; runFold = foldToggle;', context);
  context.runDock();
  assert.equal(state.cgrpFld[key].z, 'head');
  assert.equal(folded.has('cmin'), true);
  assert.equal(state.cgrpEdge[key], undefined);
  assert.equal(state.cgrpLink.child.to, key);
  context.runFold(false);
  assert.equal(folded.has('cmin'), false);
  assert.equal(state.cgrpFld[key].z, 'head');
  assert.ok(state.cgrpMinPos[key]);
  context.runFold(true);
  assert.equal(state.cgrpFld[key].z, 'head');
  context.runDock();
  assert.equal(folded.has('cmin'), false);
  assert.equal(state.cgrpFld[key], undefined);
  assert.equal(state.cgrpPos[key].x, 1200);
  assert.equal(state.cgrpPos[key].y, -56);
  assert.equal(state.cgrpEdge[key].row, 0);
  assert.equal(state.cgrpMinPos[key], undefined);
});
