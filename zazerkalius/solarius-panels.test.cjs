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
