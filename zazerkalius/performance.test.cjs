const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ui = fs.readFileSync(path.join(__dirname, 'zz-ui.js'), 'utf8');
function declaration(marker) {
  const at = ui.indexOf(marker); assert.ok(at >= 0, marker);
  for (let end = ui.indexOf('\n', at); end >= 0; end = ui.indexOf('\n', end + 1)) {
    const code = ui.slice(at, end);
    try { new vm.Script(code); return code; } catch (e) { if (!(e instanceof SyntaxError)) throw e; }
  }
  throw new Error(marker);
}
function listMock(rows) {
  let writes = 0, replaced = 0;
  const root = { className: 'rl-inner', nodes: rows.map(html => ({ html, set outerHTML(v) { this.html = v; replaced++; } })), querySelectorAll() { return this.nodes; } };
  const L = { firstElementChild: root, set innerHTML(v) { writes++; this.html = v; this.firstElementChild = { className: 'rl-inner', nodes: [], querySelectorAll() { return this.nodes; } }; } };
  return { L, root, counts: () => ({ writes, replaced }) };
}
test('unchanged rows and mounted footer are not rebuilt', () => {
  const {L, root, counts} = listMock(['a','b']); L._zzRows = { root, head: 'head', rows: ['a','b'], tail: 'tail' };
  const ctx = vm.createContext({L}); vm.runInContext(declaration('function rowsDomPatch('), ctx);
  vm.runInContext('rowsDomPatch(L,"head",["a","b"],"tail")', ctx);
  assert.deepEqual(counts(), {writes:0,replaced:0}); assert.equal(L.firstElementChild, root);
});
test('a bit edit replaces only its row', () => {
  const {L, root, counts} = listMock(['a','b']); L._zzRows = { root, head:'h', rows:['a','b'], tail:'t' };
  const ctx = vm.createContext({L}); vm.runInContext(declaration('function rowsDomPatch('), ctx);
  vm.runInContext('rowsDomPatch(L,"h",["a","changed"],"t")', ctx);
  assert.deepEqual(counts(), {writes:0,replaced:1}); assert.equal(root.nodes[0].html,'a'); assert.equal(root.nodes[1].html,'changed');
});
test('structural changes or stale roots fall back to a full rebuild', () => {
  for (const mode of ['count','head','tail','root','missing']) {
    const {L,root,counts} = listMock(['a']); L._zzRows = {root,head:'h',rows:['a'],tail:'t'};
    if (mode === 'root') L.firstElementChild = {...root};
    if (mode === 'missing') root.nodes = [];
    const ctx = vm.createContext({L}); vm.runInContext(declaration('function rowsDomPatch('),ctx);
    vm.runInContext(`rowsDomPatch(L,${JSON.stringify(mode === 'head' ? 'new' : 'h')},${JSON.stringify(mode === 'count' ? ['a','b'] : ['a'])},${JSON.stringify(mode === 'tail' ? 'new' : 't')})`,ctx);
    assert.equal(counts().writes,1,mode);
  }
});
test('width cache ignores generated sizing classes but invalidates content, fonts and units', () => {
  const el = { textContent:'button', tagName:'BUTTON', classList:['tz','w2'], getAttribute:()=>null };
  const style = {font:'14px monospace',letterSpacing:'0px',paddingLeft:'4px',paddingRight:'4px',borderLeftWidth:'1px',borderRightWidth:'1px'};
  const ctx = vm.createContext({el, getComputedStyle:()=>style, cgbSnap:{fontEpoch:0}}); vm.runInContext(declaration('function cgbMeasureKey('),ctx);
  const key = () => vm.runInContext('cgbMeasureKey(el,80,70)',ctx); const before=key();
  el.classList=['wm','w4','tz']; assert.equal(key(),before);
  el.textContent='longer'; assert.notEqual(key(),before); el.textContent='button';
  style.font='20px serif'; assert.notEqual(key(),before); style.font='14px monospace';
  ctx.cgbSnap.fontEpoch++; assert.notEqual(key(),before);
  assert.notEqual(vm.runInContext('cgbMeasureKey(el,90,70)',ctx),before);
});
test('unsupported WebGL is detected once and remains on the CPU fallback', () => {
  let attempts=0; const ctx=vm.createContext({document:{createElement:()=>({getContext:()=>{attempts++;return null;}})}});
  vm.runInContext(declaration('function coneArtGpu('),ctx);
  assert.equal(vm.runInContext('coneArtGpu({},10,10,[11,13,18])',ctx),null);
  assert.equal(vm.runInContext('coneArtGpu({},10,10,[11,13,18])',ctx),null); assert.equal(attempts,1);
});
test('large field updates retain dimming classes and avoid empty custom-property writes', () => {
  const render=declaration('function renderRows(');
  assert.match(render,/\["rlsq", "tri90", "rnhov", "dimsel", "dimcur"\]/);
  assert.match(render,/if \(L.className !== listClass\)/);
  assert.match(declaration('function rowNumDigits('),/getPropertyValue\("--rc-cols"\)\.trim\(\)/);
  assert.match(declaration('function cutPartsPlace('),/if \(fc\._cutPlaced === placementKey\(\)\) return/);
});
test('in-place editing invalidates its row even when the edit is cancelled', () => {
  assert.match(declaration('function editRowInPlace('), /L\._zzRows\.rows\[i\] = null/);
  const {L,root,counts}=listMock(['a','b']); L._zzRows={root,head:'h',rows:['a',null],tail:'t'};
  const ctx=vm.createContext({L}); vm.runInContext(declaration('function rowsDomPatch('),ctx);
  vm.runInContext('rowsDomPatch(L,"h",["a","b"],"t")',ctx);
  assert.deepEqual(counts(),{writes:0,replaced:1});
});
test('GPU is limited to the pixel-equivalent modes and leaves axes and hit testing intact', () => {
  const art=declaration('function coneTopArtSync(');
  assert.match(art,/!Z\.coneGlow && !Z\.cone3d \? coneArtGpu/);
  assert.match(art,/destination-in/); assert.match(art,/if \(Z\.coneAxes\)/);
  assert.match(declaration('function coneArtBlocksButton('),/getImageData\(x, y, 1, 1\)/);
});
