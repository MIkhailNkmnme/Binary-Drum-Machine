const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const core = require('./mayatnik-core.js');
const flow = require('./mayatnik-edge-flow.js');
const html = fs.readFileSync(__dirname + '/Zerkalius-mayatnik.html', 'utf8');

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

function harness(rows, factor, mode, pair, rp) {
  const width = rows * factor - 1, anchor = (width - 1) / 2;
  const paths = [], gap = 3;
  const dispW = () => rp === 2 ? 2 * width + gap : rp === 4 ? width + rows + 1 : width;
  const canvas = { width: dispW(), height: rows, style: {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: dispW(), height: rows }) };
  const noop = () => {};
  const g = { clearRect: noop, setTransform: noop, save: noop, restore: noop, beginPath: noop, rect: noop,
    clip: noop, lineTo: noop, closePath: noop, fill: noop, putImageData: noop,
    moveTo(x, y) { paths.push([x, y]); }, createImageData(w, h) { return { data: new Uint8ClampedArray(4*w*h) }; } };
  const h = vm.createContext({
    st: { rows, edgeWrap: true, edgeContinuous: true, edgeBounce: false, mode, pair, vtxFlash: true },
    f: core.field(width, rows, 'empty', anchor), geo: { anchor }, edgeMark: new Uint8Array(width*rows),
    MAYATNIK: core, MayatnikEdgeFlow: flow, total: () => 10*width,
    edgeJumps: 0, window: {}, gpuBig: null, konus: null, foldSuspend: noop, interval: Infinity,
    flashCellsQueue: [], third: null, flashSeed: false, pairOn: () => pair && mode === 'pend',
    animatrixOn: () => false, compareOn: () => false, joinedOn: () => false,
    dispW, rombP: () => rp, parityVisible: () => true, outShow: () => false,
    VX: 0, VW: width, VH: rows, RG: gap, cv: canvas, $: () => canvas,
    performance: { now: () => 100 }, requestAnimationFrame: () => 1, k: 0
  });
  vm.runInContext(['edgeCol','edgeRawApices','displayPoint','addOne','flashDrawRhombus','flashDraw'].map(source).join('\n'), h);
  const overlay = h.flashDraw.o = { c: { style: {} }, g, list: [], n: -1, frame: -1, raf: 0 };
  return { h, paths, overlay, anchor, width, gap };
}

// Each probe starts from empty cells, so even a revisited apex can be observed in f.val.
function probe(run, index) {
  const { h, overlay, paths, width } = run;
  h.k = index; h.f.val.fill(-1); overlay.list = []; paths.length = 0;
  assert.equal(h.addOne(), true);
  const columns = [];
  for (let c = 0; c < width; c++) if (h.f.val[c] === 1) columns.push(c);
  h.flashDraw();
  assert.equal(h.flashCellsQueue.length, 0);
  return columns;
}

function compareFlashes(run, index, rp, expected) {
  const { overlay, paths, anchor, width, gap, h } = run;
  const columns = probe(run, index);
  assert.deepEqual(columns, Array.from(new Set(expected)).sort((a,b) => a-b));
  let actual;
  if (rp < 0) {
    const pixels = new Uint32Array(overlay.id.data.buffer, 0, width);
    actual = Array.from(pixels.keys()).filter(c => pixels[c] >>> 24);
  } else if (rp === 4) {
    // The top vertex of the glyph for row zero is (VH+c,c).
    actual = paths.filter(([x,y]) => x-y === h.VH).map(([,y]) => y);
  } else {
    actual = paths.filter(([,y]) => y === 0).map(([x]) => x-.5);
  }
  const visible = expected.filter(c => rp !== 0 && rp !== 1 || ((c-anchor)&1) === rp);
  const physical = rp===2 ? visible.map(c => c+(((c-anchor)&1) ? width+gap : 0)) : visible;
  assert.deepEqual(Array.from(new Set(actual)).sort((a,b)=>a-b), Array.from(new Set(physical)).sort((a,b)=>a-b),
    `N=${h.VH}, W=${width}, frame=${index+1}, view=${rp}`);
}

test('continuous edge CPU apex and flash agree before, at and after both edges for each width and direction', () => {
  for (const factor of [2,4,6,8]) for (const mode of ['pend','pendR','pair']) {
    for (const rp of [-1,2,4,0,1]) {
      const run = harness(8, factor, mode==='pair'?'pend':mode, mode==='pair', rp);
      const { width, anchor } = run;
      if (mode==='pair') {
        for (const [index, cols] of [[anchor-1,[0,width-1]],[anchor,[width-1,0]],[anchor+1,[width-2,1]],[width-1,[anchor,anchor]]]) {
          compareFlashes(run,index,rp,cols);
        }
      } else {
        const columns = mode==='pend'?[0,width-1,width-1,0,width-2,1]:[width-1,0,0,width-1,1,width-2];
        for (let j=0;j<columns.length;j++) compareFlashes(run,width-2+j,rp,[columns[j]]);
      }
    }
  }
});

test('558 rows, width 2N−1: flat flash paints the real apex across both edges', () => {
  const run = harness(558, 2, 'pend', false, -1);
  for (const [frame,col] of [[1114,0],[1115,1114],[1116,1114],[1117,0],[1118,1113],[1119,1]]) {
    compareFlashes(run,frame-1,-1,[col]);
  }
});
