const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'Zerkalius-genezis.html'), 'utf8');
const run = (ctx, code) => vm.runInContext(code, ctx);
function extract(startText) {
  const start = html.indexOf(startText);
  assert.ok(start >= 0);
  for (let end = html.indexOf('\n', start); end >= 0; end = html.indexOf('\n', end + 1)) {
    const code = html.slice(start, end);
    try { new vm.Script(code); return code; } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
    }
  }
  throw new Error('Cannot extract ' + startText);
}
function page(saved) {
  const items = new Map(), elements = {linesInput: {value: ''}, patternInput: {value: ''}};
  if (saved) items.set('zerkalius_autosave_v1', saved);
  const sandbox = {localStorage: {getItem: key => items.get(key), setItem: (key, value) => items.set(key, value)},
    document: {getElementById: id => elements[id] || null, documentElement: {style: {setProperty(){}}}}};
  sandbox.window = sandbox;
  const ctx = vm.createContext(sandbox);
  for (const file of ['banks_data.js', 'initial-rows.js', 'genezis-initial-rows.js']) {
    run(ctx, fs.readFileSync(path.join(__dirname, file), 'utf8'));
  }
  run(ctx, html.slice(html.indexOf('const STATE ='), html.indexOf('const UI =')));
  run(ctx, `function safeChecked(id,fallback=false){return fallback;}
    function safeValue(id,fallback=''){return fallback;}
    function getNFactor(){return 2;} function LCM(){return 1;}
    function enforceLoop(){} function calculateState(){} function updatePatternBackdrop(){}
    function resetPositionWithHeightScale(){} function updateLogic(){} function updateSlotPanel(){}
    function restorePanelStates(){} function showNotification(){} function hexToRgba(color){return color;} const PRESETS={};
    function getGridMetrics(){return {lineHeight:16};}`);
  run(ctx, extract('function loadText('));
  run(ctx, extract('window.switchBank = function('));
  run(ctx, extract('function importSnapshotObject('));
  run(ctx, extract('window.createSnapshotObject = function('));
  const start = html.indexOf('let autoSnapshot = null;');
  const end = html.indexOf('positionFloatingToolbar();', start);
  run(ctx, html.slice(start, end));
  return {ctx, items, elements};
}

test('Genesis fresh startup loads all 71 shared rows into the real canvas and input', () => {
  const {ctx, elements} = page();
  assert.equal(run(ctx, 'STATE.lines.length'), 71);
  assert.equal(elements.linesInput.value, run(ctx, 'ZZ_INITIAL_ROWS.join("\\n")'));
  assert.equal(run(ctx, 'STATE.lines[1].orig'), '1');
  assert.equal(run(ctx, 'createSnapshotObject().rowsSequenceRevision'), 2);
  assert.ok(html.indexOf('src="_js/initial-rows.js') < html.indexOf('src="_js/genezis-initial-rows.js'));
});

test('Genesis saved single row migrates through real snapshot import, preserving settings and backup', () => {
  const raw = JSON.stringify({rows: ['0'], banks: [{lines: '11', patterns: ''}, {lines: '0', patterns: '101'}],
    activeBankIndex: 1, step: 42, panels: {saved: true}});
  const {ctx, items, elements} = page(raw);
  assert.equal(run(ctx, 'STATE.lines.length'), 71);
  assert.equal(run(ctx, 'STATE.activeBankIndex'), 1);
  assert.equal(run(ctx, 'STATE.banks[0].lines'), '11');
  assert.equal(elements.linesInput.value, run(ctx, 'ZZ_INITIAL_ROWS.join("\\n")'));
  assert.equal(run(ctx, 'STATE.globalStep'), 0);
  assert.equal(items.get('zerkalius_autosave_v1_before_rows_sequence_2'), raw);
  assert.deepEqual(JSON.parse(items.get('zerkalius_autosave_v1')).panels, {saved: true});
});

test('Genesis reload keeps edits saved after migration', () => {
  const {ctx} = page(JSON.stringify({rows: ['0']}));
  run(ctx, `loadText('101'); var saved=JSON.stringify(createSnapshotObject());`);
  const next = page(ctx.saved);
  assert.equal(run(next.ctx, 'STATE.lines.length'), 1);
  assert.equal(run(next.ctx, 'STATE.lines[0].orig'), '101');
  assert.equal(next.items.has('zerkalius_autosave_v1_before_rows_sequence_2'), false);
});
