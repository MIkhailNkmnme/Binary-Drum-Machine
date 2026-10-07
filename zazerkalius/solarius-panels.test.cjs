const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, 'zz-ui.js'), 'utf8');
const groupStart = source.indexOf('function cgrpInit(){');

// Execute the actual UI helpers with a small geometry model, without a browser.
function declaration(marker, start = 0) {
  const at = source.indexOf(marker, start);
  assert.ok(at >= 0, marker);
  let end = source.indexOf('\n', at);
  for (;;) {
    const text = source.slice(at, end);
    try { new vm.Script(text); return text; }
    catch (error) { if (!(error instanceof SyntaxError)) throw error; end = source.indexOf('\n', end + 1); assert.ok(end >= 0, marker); }
  }
}
function classes(...initial) {
  const values = new Set(initial);
  return { contains: c => values.has(c), add: (...cs) => cs.forEach(c => values.add(c)), remove: (...cs) => cs.forEach(c => values.delete(c)), toggle(c, force = !values.has(c)) { force ? values.add(c) : values.delete(c); return force; } };
}
function style() { return { left: '', top: '', width: '', minHeight: '', setProperty(k, v) { this[k] = v; } }; }
function button() {
  const attrs = new Map(); let writes = 0, text = '';
  return { title: '', get textContent() { return text; }, set textContent(v) { writes++; text = v; }, get writes() { return writes; }, getAttribute: k => attrs.get(k) ?? null, setAttribute: (k, v) => attrs.set(k, v) };
}
function context() {
  const nodes = new Map(), body = { classList: classes() }, groups = [], Z = { rows: ['1', '10'], cgrpPos: {}, cgrpFld: {}, cgrpLink: {}, cgrpMin: {}, cgrpSize: {} };
  function node(id, parent, x, y, w = 100, h = 48, names = []) {
    const bt = button(), listeners = new Map(), header = { title: '', firstChild: { textContent: id }, addEventListener: (k, fn) => listeners.set(k, fn), removeEventListener: k => listeners.delete(k), setPointerCapture() {} };
    const el = { id, parentElement: parent, dataset: {}, classList: classes(...names), style: style(), hidden: false, fullW: w, fullH: h, baseX: x, baseY: y, scrollLeft: 0, scrollTop: 0, clientWidth: w, clientHeight: h, bt, header, listeners,
      closest() { return this.win || null; }, contains(a) { return a === this; }, addEventListener() {}, querySelector(q) { return q === '.pminbtn' || q === '.gfold' ? bt : header; },
      get offsetWidth() { return parseFloat(this.style.width) || (this.classList.contains('pmin') || this.classList.contains('cmin') ? 60 : this.fullW); },
      get offsetHeight() { return Math.max(this.classList.contains('pmin') || this.classList.contains('cmin') ? 24 : this.fullH, parseFloat(this.style.minHeight) || 0); },
      getBoundingClientRect() { const fixed = this.classList.contains('pdrag') || this.classList.contains('cdrag'), p = !fixed && this.parentElement ? this.parentElement.getBoundingClientRect() : { left: 0, top: 0 };
        const left = p.left + (parseFloat(this.style.left) || this.style.left === '0px' ? parseFloat(this.style.left) : this.baseX), top = p.top + (parseFloat(this.style.top) || this.style.top === '0px' ? parseFloat(this.style.top) : this.baseY), width = this.offsetWidth, height = this.offsetHeight;
        return { left, top, width, height, right: left + width, bottom: top + height }; },
      getClientRects() { return this.hidden || this.classList.contains('coff') ? [] : [this.getBoundingClientRect()]; }
    };
    nodes.set(id, el); return el;
  }
  const wb = node('body', null, 100, 40, 800, 600), tl = node('tools', wb, 0, 48, 800, 48), head = node('head', wb, 0, 0, 800, 24), cv = node('coneCv', wb, 0, 48, 800, 552);
  head.querySelector = () => null; wb.win = { querySelector: () => head }; cv.width = 800; cv.height = 552;
  const ctx = vm.createContext({ Z, groups, tl, wb, FLD_NO: { 'кольца': 1, 'кручение': 1 }, SNAP: 10, TZC_H: 24, coneZoom: 1, conePan: [0, 0], coneGeom: {}, zTop: 400, zSnapOn: [], linkSaveT: 0,
    document: { body, hidden: false, activeElement: null, getElementById: id => nodes.get(id) || null }, window: {}, screen: {}, cgTabsBottom: () => 88, fldRect: () => null,
    setTimeout: () => 0, clearTimeout() {}, save() { ctx.saved++; }, saved: 0, say() {}, cgbSnap() {}, cgrpCols() {}, sizeApply(g) { g.style.width = ''; }
  });
  ctx.$ = id => nodes.get(id) || null;
  const load = (marker, at = 0) => vm.runInContext(declaration(marker, at), ctx);
  load('const SOL_PLATES =');
  for (const name of ['solPanelName', 'solPanelFolded', 'solPanelRowStep', 'solEdgePosition', 'solLinkCycle', 'solLinkAttach', 'solFoldButton', 'coneAxisScr', 'solAxisPack', 'solAxisPanelX', 'platePinPlace', 'platePlace', 'plateFoldSync', 'plateFoldToggle', 'plateZig', 'plateSnap', 'plateAxis', 'plateInit', 'zSnapGlow', 'zSnapTo']) load('function ' + name + '(');
  for (const name of ['panels', 'onCanvas', 'nodePin', 'nodeUnpin', 'nodePlace', 'nodeSetPos', 'gByKey', 'linkCycle', 'meshSnap', 'linkSync', 'snapXY', 'attachMesh', 'wbTop', 'place', 'grpFix']) load('const ' + name + ' =', groupStart);
  load('window.zzAxisPanels =', groupStart);
  for (const name of ['zzPlateSnap', 'zzPanelLinkSync', 'zzPanelDragStart', 'zzPanelDragEnd']) load('window.' + name + ' =', groupStart);
  const run = expression => vm.runInContext(expression, ctx);
  function group(key, x = 100, y = 48, w = 100) { const g = node(key, tl, x, y, w, 48, ['tzg', 'cfloat']); g.dataset.g = key; groups.push(g); Z.cgrpPos[key] = { x, y }; return g; }
  function plate(id = 'ringTbl', x = 194, y = 96) { const el = node(id, wb, x, y, 180, 168, ['pzg']); ctx.plateInit(el); return el; }
  return { ctx, run, load, group, plate, nodes, body, Z };
}
const json = value => JSON.parse(JSON.stringify(value));

test('attachment directions choose the right/lower follower and retain offsets', () => {
  const { ctx } = context(), a = { left: 100, top: 120 }, b = { left: 40, top: 70 };
  for (const side of ['r', 'l', 'b', 't']) {
    const links = {}, kid = ctx.solLinkAttach(links, 'a', '@ringTbl', side, a, b), mine = side === 'r' || side === 'b';
    assert.equal(kid, mine ? 'a' : '@ringTbl');
    assert.equal(links[kid].to, mine ? '@ringTbl' : 'a');
    assert.equal(side === 'b' || side === 't' ? links[kid].dx : links[kid].dy, (mine ? 1 : -1) * (side === 'b' || side === 't' ? 60 : 50));
  }
});
test('cycles are rejected even in a chain longer than twenty panels', () => {
  const { ctx } = context(), links = {};
  for (let i = 0; i < 30; i++) links['g' + i] = { to: 'g' + (i + 1) };
  assert.equal(ctx.solLinkCycle(links, 'g30', 'g0'), true);
  assert.equal(ctx.solLinkAttach(links, 'g30', 'g0', 'r', { top: 0 }, { top: 0 }), null);
  assert.equal(ctx.solLinkCycle(links, '@ringTbl', 'g0'), false);
});
test('table-to-group and group-to-table snapping use the same tooth grid', () => {
  const { group, plate, run } = context(); const g = group('вид'), p = plate();
  const a = run('meshSnap(document.getElementById("ringTbl"), 294, 138, 180, 168)');
  assert.equal(a.o, g); assert.equal(a.side, 'r'); assert.equal(a.y, 136);
  const b = run('meshSnap(groups[0], 468, 138, 100, 48)');
  assert.equal(b.o, p); assert.equal(b.side, 'r'); assert.equal(b.y, 136);
  const c = run('meshSnap(document.getElementById("ringTbl"), 200, 183, 180, 168)');
  assert.equal(c.side, 'b'); assert.equal(c.y, 183);
});
test('moving the parent moves the attached table; missing closed tables keep saved links', () => {
  const { Z, group, plate, run, nodes } = context(); const g = group('вид'), p = plate();
  Z.cgrpLink['@ringTbl'] = { to: 'вид', dy: 0 }; run('linkSync()');
  const before = p.getBoundingClientRect(); Z.cgrpPos['вид'].x += 40; run('place(groups[0]); linkSync()');
  assert.equal(p.getBoundingClientRect().left - before.left, 40);
  assert.equal(p.getBoundingClientRect().top, g.getBoundingClientRect().top);
  nodes.delete('ringTbl'); run('linkSync()'); assert.deepEqual(Z.cgrpLink['@ringTbl'], { to: 'вид', dy: 0 });
});
test('long attachment chains update fully in one sync', () => {
  const { Z, group, run } = context(), gs = [];
  for (let i = 0; i < 11; i++) gs.push(group('g' + i, i ? 0 : 50, 48, 40));
  for (let i = 10; i > 0; i--) Z.cgrpLink['g' + i] = { to: 'g' + (i - 1), dy: 0 };
  run('linkSync()');
  for (let i = 1; i < gs.length; i++) assert.ok(Math.abs(gs[i].getBoundingClientRect().left - (gs[i - 1].getBoundingClientRect().right - 24 / (2 * Math.sqrt(3)))) <= .5);
});
test('folding a table preserves settings and pulls a group up frame-to-frame', () => {
  const { ctx, Z, group, plate, run } = context(), g = group('вид'), p = plate();
  Z.cgrpLink['вид'] = { to: '@ringTbl', v: 1, dx: 0 }; run('linkSync()');
  const rows = JSON.stringify(Z.rows); ctx.plateFoldToggle(p);
  assert.equal(Z.ringTblMin, true); assert.equal(p.classList.contains('pmin'), true); assert.equal(p.bt.getAttribute('aria-expanded'), 'false');
  assert.equal(g.getBoundingClientRect().top, p.getBoundingClientRect().bottom - 1);
  assert.equal(JSON.stringify(Z.rows), rows);
  assert.equal(json(JSON.parse(JSON.stringify(Z))).ringTblMin, true);
  ctx.plateFoldToggle(p); assert.equal(g.getBoundingClientRect().top, p.getBoundingClientRect().bottom - 1); assert.equal(p.bt.getAttribute('aria-expanded'), 'true');
});
test('folding a group keeps its position and moves the attached table with its width', () => {
  const { ctx, Z, group, plate, run, load } = context(), g = group('вид'), p = plate();
  ctx.g = g; ctx.lab = g.header; ctx.fold = g.bt; load('const foldUi =', groupStart); load('const foldToggle =', groupStart);
  Z.cgrpLink['@ringTbl'] = { to: 'вид', dy: 0 }; run('linkSync()'); const before = p.getBoundingClientRect().left, xy = json(Z.cgrpPos['вид']);
  run('foldToggle()'); assert.equal(p.getBoundingClientRect().left, before - 40); assert.deepEqual(json(Z.cgrpPos['вид']), xy); assert.equal(g.bt.textContent, '+');
  run('foldToggle()'); assert.equal(p.getBoundingClientRect().left, before); assert.equal(g.bt.textContent, '−');
});
test('an ordinary header click does not detach; dragging does, and Alt leaves followers behind', () => {
  const { ctx, Z, group, plate } = context(); group('вид'); group('щели', 400); const p = plate();
  Z.cgrpLink['@ringTbl'] = { to: 'вид', dy: 0 }; Z.cgrpLink['щели'] = { to: '@ringTbl', v: 1, dx: 0 };
  const e = { button: 0, pointerId: 1, clientX: 310, clientY: 142, altKey: true, target: { closest: () => null }, preventDefault() {}, stopPropagation() {} };
  p.listeners.get('pointerdown')(e); p.listeners.get('pointerup')(); assert.ok(Z.cgrpLink['@ringTbl']);
  p.listeners.get('pointerdown')(e); p.listeners.get('pointermove')({ clientX: 470, clientY: 246 });
  assert.equal(Z.cgrpLink['@ringTbl'], undefined); assert.equal(Z.cgrpLink['щели'], undefined);
  p.listeners.get('pointerup')(); assert.equal(p.classList.contains('pdrag'), false); assert.ok(ctx.saved > 0);
});
test('axis pins follow zoom and pan without clamping the panel into view', () => {
  const { ctx, Z, plate } = context(), p = plate(); Z.ringTblPin = 200;
  ctx.platePlace(p); const before = p.getBoundingClientRect(); ctx.coneZoom = 4; ctx.conePan = [20, 30]; ctx.platePlace(p);
  const after = p.getBoundingClientRect(); assert.equal(after.left - before.left, 620); assert.equal(after.top - before.top, 30); assert.equal(p.classList.contains('axpin'), true);
});
test('unchanged fold state does not repeatedly rewrite header text', () => {
  const { ctx } = context(), b = button(); ctx.solFoldButton(b, false, 'Вид'); const count = b.writes;
  for (let i = 0; i < 10; i++) ctx.solFoldButton(b, false, 'Вид'); assert.equal(b.writes, count);
});
