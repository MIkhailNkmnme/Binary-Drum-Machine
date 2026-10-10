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
  run(ctx, `var state={rows:['0'],lanes:[['11'],['0']],lane:1,lanesHid:[[],[0]],motionExact:{old:true},coneHold:{1:3}};
    zzInitialRowsMigrate(state,'old saved state','page');`);
  assert.equal(ctx.state.rows.length, 71);
  assert.equal(ctx.state.rows, ctx.state.lanes[1]);
  assert.equal(ctx.state.lanes[0][0], '11');
  assert.equal(ctx.state.lanesHid[1].length, 0);
  assert.equal(ctx.state.coneHold, undefined);
  assert.equal(items.get('page_before_rows_sequence_1'), 'old saved state');
  run(ctx, `state.rows=['101'];zzInitialRowsMigrate(state,'later saved state','page');`);
  assert.equal(ctx.state.rows[0], '101');
  assert.equal(items.get('page_before_rows_sequence_1'), 'old saved state');
});

test('explicitly imported sessions retain their own rows', () => {
  const {ctx, items} = context();
  ctx.sessionStorage.getItem = () => 'session.json';
  run(ctx, `var state={rows:['101']};zzInitialRowsMigrate(state,'saved session','page');`);
  assert.equal(ctx.state.rows[0], '101');
  assert.equal(ctx.state.rowsSequenceRevision, 1);
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
