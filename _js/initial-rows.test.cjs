const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(__dirname, 'initial-rows.js'), 'utf8');
function context() {
  const items = new Map();
  const ctx = vm.createContext({window: {}, sessionStorage: { getItem: () => null },
    localStorage: { getItem: key => items.get(key), setItem: (key, value) => items.set(key, value) }});
  vm.runInContext(source, ctx);
  return {ctx, items};
}
const run = (ctx, code) => vm.runInContext(code, ctx);

function functionSource(ui, name) {
  const start = ui.indexOf('function ' + name + '(');
  assert.ok(start >= 0);
  for (let end = ui.indexOf('\n', start); end >= 0; end = ui.indexOf('\n', end + 1)) {
    const code = ui.slice(start, end);
    try { new vm.Script(code); return code; } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
    }
  }
  throw new Error('Cannot extract function ' + name);
}

for (const folder of ['zazerkalius', 'sinhrofazotron']) {
  test(folder + ': actual load and lane initialization retain migrated rows and the star snapshot', () => {
    const {ctx, items} = context();
    const ui = fs.readFileSync(path.join(root, folder, 'zz-ui.js'), 'utf8');
    run(ctx, fs.readFileSync(path.join(root, folder, 'zz-core.js'), 'utf8'));
    run(ctx, ui.slice(ui.indexOf('const Z ='), ui.indexOf('const undoStack')));
    run(ctx, `const ZZ_KEY='page', ZZ_SOLO='', ZZ_BG=false, ZZ_PRESET=null;
      function zzResetOnStart(){return false;}`);
    run(ctx, functionSource(ui, 'load') + '\n' + functionSource(ui, 'laneInit'));
    const raw = JSON.stringify({rows: ['0'], lanes: [['0'], ['11'], ['101'], ['1']],
      lane: 3, laneCount: 1, rowsSequenceRevision: 1,
      home: {rows: ['0'], lanes: [['0']], lane: 0, laneCount: 1, fs: 15}});
    items.set('page', raw);
    run(ctx, 'load(); laneInit();');
    assert.equal(run(ctx, 'Z.lane'), 0);
    assert.equal(run(ctx, 'Z.rows.length'), 71);
    assert.equal(run(ctx, 'Z.rows === Z.lanes[Z.lane]'), true);
    assert.equal(run(ctx, 'Z.lanes[1][0]'), '11');
    assert.equal(run(ctx, 'Z.home.rows.length'), 71);
    assert.equal(run(ctx, 'Z.home.lanes[Z.home.lane].length'), 71);
    assert.equal(run(ctx, 'Z.home.fs'), 15);
    assert.equal(items.get('page_before_rows_sequence_2'), raw);
    // Exercise the real "Initial rows" button, which restores the saved star.
    const buttonStart = ui.indexOf('$("bRowsStart").onclick = () => {');
    const buttonEnd = ui.indexOf('\n  };', buttonStart);
    assert.ok(buttonStart >= 0 && buttonEnd > buttonStart);
    run(ctx, `var buttons={}; function $(id){return buttons[id] ||= {};}
      var document={getElementById:()=>null};
      function snapshot(){} function rowsOrigSet(){} function renderAll(){}
      function save(){} function say(){};`);
    run(ctx, ui.slice(buttonStart, buttonEnd + '\n  };'.length));
    run(ctx, `Z.rows=['0']; Z.lanes[Z.lane]=Z.rows; buttons.bRowsStart.onclick();`);
    assert.equal(run(ctx, 'Z.rows.length'), 71);
    assert.equal(run(ctx, 'Z.rows === Z.lanes[Z.lane]'), true);
    // A subsequent reload must keep edits made after this one-time migration.
    run(ctx, `Z.rows=['101']; Z.lanes[Z.lane]=Z.rows;
      localStorage.setItem(ZZ_KEY,JSON.stringify(Z)); load(); laneInit();`);
    assert.equal(run(ctx, 'Z.rows.join()'), '101');
    assert.equal(items.get('page_before_rows_sequence_2'), raw);
  });
}

test('all 71 initial rows are preserved, including the duplicate first row', () => {
  const {ctx} = context();
  const rows = JSON.parse(run(ctx, 'JSON.stringify(ZZ_INITIAL_ROWS)'));
  assert.equal(rows.length, 71);
  assert.deepEqual(rows.slice(0,6), ['1','1','11','111','1000','10101']);
  assert.ok(rows.every(row => /^[01]+$/.test(row)));
  assert.equal(rows[70], '1101001001101110000100101101100100001100011010011011000100111011110001');
});

test('saved rows migrate once, preserving a backup and the other lanes', () => {
  const {ctx, items} = context();
  run(ctx, `var state={rows:['0'],lanes:[['11'],['0']],lane:1,laneCount:2,lanesHid:[[],[0]],motionExact:{old:true},coneHold:{1:3}};
    zzInitialRowsMigrate(state,'old saved state','page');`);
  assert.equal(ctx.state.rows.length, 71);
  assert.equal(ctx.state.rows, ctx.state.lanes[1]);
  assert.equal(ctx.state.lanes[0][0], '11');
  assert.equal(ctx.state.lanesHid[1].length, 0);
  assert.equal(ctx.state.coneHold, undefined);
  assert.equal(items.get('page_before_rows_sequence_2'), 'old saved state');
  run(ctx, `state.rows=['101'];zzInitialRowsMigrate(state,'later saved state','page');`);
  assert.equal(ctx.state.rows[0], '101');
  assert.equal(items.get('page_before_rows_sequence_2'), 'old saved state');
});

test('explicitly imported sessions retain their own rows', () => {
  const {ctx, items} = context();
  ctx.sessionStorage.getItem = () => 'session.json';
  run(ctx, `var state={rows:['101']};zzInitialRowsMigrate(state,'saved session','page');`);
  assert.equal(ctx.state.rows[0], '101');
  assert.equal(ctx.state.rowsSequenceRevision, 2);
  assert.equal(items.size, 0);
});

test('both page variants, factory resets, and background use the shared sequence', () => {
  for (const [folder, html] of [['zazerkalius','Zerkalius-zazerkalius.html'],['sinhrofazotron','Zerkalius-sinhrofazotron.html']]) {
    const markup = fs.readFileSync(path.join(root, folder, html), 'utf8');
    assert.ok(markup.indexOf('src="../_js/initial-rows.js') < markup.indexOf('src="zz-ui.js'));
    const ui = fs.readFileSync(path.join(root, folder, 'zz-ui.js'), 'utf8'), {ctx} = context();
    const start = ui.indexOf('const Z ='), end = ui.indexOf('const undoStack', start);
    assert.ok(start >= 0 && end > start);
    run(ctx, ui.slice(start, end));
    assert.equal(run(ctx, 'Z.rows.length'), 71);
    const factory = ui.match(/^const ZZ_FACTORY = .*;$/m)[0];
    run(ctx, factory + '\nzzUseInitialRows(ZZ_FACTORY);');
    assert.equal(run(ctx, 'ZZ_FACTORY.rows.length'), 71);
    assert.equal(run(ctx, 'ZZ_FACTORY.lanes[ZZ_FACTORY.lane].length'), 71);
    assert.match(ui, /const r = ZZ_INITIAL_ROWS\.slice\(\);/);
  }
  const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(index, /src="_js\/initial-rows\.js/);
  assert.match(index, /const PR = ZZ_INITIAL_ROWS;/);
  assert.match(index, /R0 = Math\.floor\(N \/ 8\), S = 7/);
});
