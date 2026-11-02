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
  const paths = [], rects = [], gap = 3;
  const dispW = () => rp === 2 ? 2 * width + gap : rp === 4 ? width + rows + 1 : width;
  const canvas = { width: dispW(), height: rows, style: {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: dispW(), height: rows }) };
  const noop = () => {};
  const g = { clearRect: noop, setTransform: noop, save: noop, restore: noop, beginPath: noop, rect: noop,
    clip: noop, lineTo: noop, closePath: noop, fill: noop, putImageData: noop,
    moveTo(x, y) { paths.push([x, y, this.fillStyle]); },
    fillRect(x,y,w,h) { rects.push([x,y,w,h,this.fillStyle]); },
    createImageData(w, h) { return { data: new Uint8ClampedArray(4*w*h) }; } };
  const h = vm.createContext({
    st: { rows, edgeWrap: true, edgeContinuous: true, edgeBounce: false, mode, pair, vtxFlash: true },
    f: core.field(width, rows, 'empty', anchor), geo: { anchor }, edgeMark: new Uint8Array(width*rows),
    MAYATNIK: core, MayatnikEdgeFlow: flow, total: () => 10*width,
    edgeJumps: 0, window: {}, gpuBig: null, konus: null, foldSuspend: noop, interval: Infinity,
    flashCellsQueue: [], third: null, flashSeed: false, pairOn: () => pair && mode === 'pend',
    animatrixOn: () => false, compareOn: () => false, joinedOn: () => rp===3,
    joinedWhole: () => false, joinedGeometry: () => ({config:{rotateParity:1,rotate:false},reflection:width-1}),
    dispW, rombP: () => rp, parityVisible: () => true, outShow: () => false,
    VX: 0, VW: width, VH: rows, RG: gap, cv: canvas, $: () => canvas,
    performance: { now: () => 100 }, requestAnimationFrame: () => 1, k: 0
  });
  vm.runInContext(['edgeCol','edgeRawApices','displayPoint','addOne','flashDrawRhombus','flashDrawJoined','flashDraw'].map(source).join('\n'), h);
  const overlay = h.flashDraw.o = { c: { style: {} }, g, list: [], n: -1, frame: -1, raf: 0 };
  return { h, paths, rects, overlay, anchor, width, gap };
}

// Each probe starts from empty cells, so even a revisited apex can be observed in f.val.
function probe(run, index) {
  const { h, overlay, paths, width } = run;
  h.k = index; h.f.val.fill(-1); overlay.list = []; paths.length = 0; run.rects.length=0;
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

function branchColour(rgb) {
  // Both the normal and whitened versions keep the travelling branch's hue.
  if(typeof rgb==='string')rgb=rgb.match(/^rgba\((\d+),(\d+),(\d+),/).slice(1,4).map(Number);
  if(rgb[0]===255 && rgb[2]<rgb[1])return 'yellow';
  if(rgb[2]===255 && rgb[0]<rgb[1])return 'blue';
  return 'other';
}

function apexColours(run,rp) {
  const { h,overlay,paths,rects,width,gap }=run;
  if(rp<0){
    const result=[];
    for(let col=0;col<width;col++){
      const pixel=overlay.id.data.slice(4*col,4*col+4);
      if(pixel[3])result.push([col,branchColour(pixel)]);
    }
    return result;
  }
  if(rp===3)return rects.filter(([,y,w])=>(y===0||y===2*h.VH-1)&&w===1)
    .map(([x,,,,colour])=>[x,branchColour(colour)]);
  if(rp===4)return paths.filter(([x,y])=>x-y===h.VH)
    .map(([,y,colour])=>[y,branchColour(colour)]);
  return paths.filter(([,y])=>y===0).map(([x,,colour])=>[
    x-.5-(rp===2&&x>width?width+gap:0),branchColour(colour)
  ]);
}

for(const bounce of [false,true])test((bounce?'reflection':'wrap')+' keeps both travelling branch colours at and beyond the boundary',()=>{
  for(const factor of [2,4,6,8])for(const mode of ['pend','pendR','pair'])for(const rp of [-1,0,1,2,3,4]){
    const run=harness(8,factor,mode==='pair'?'pend':mode,mode==='pair',rp);
    const {h,width,anchor}=run;h.st.edgeBounce=bounce;
    for(let beyond=0;beyond<=2;beyond++){
      // The right traveller advances through W-1 -> 0 -> 1 (or W-2 -> W-3 in reflection).
      const right=beyond===0||bounce?width-1-beyond:beyond-1,left=width-1-right;
      const travellers=[[left,'yellow'],[right,'blue']];
      const distance=anchor+beyond;
      const frames=mode==='pair'?[[distance-1,travellers]]:mode==='pend'
        ?[[2*distance-1,[travellers[0]]],[2*distance,[travellers[1]]]]
        :[[2*distance-1,[travellers[1]]],[2*distance,[travellers[0]]]];
      for(const [index,events] of frames){
        probe(run,index);
        const expected=events.filter(([col])=>rp!==0&&rp!==1||((col-anchor)&1)===rp);
        const byCol=(a,b)=>a[0]-b[0];
        assert.deepEqual(apexColours(run,rp).sort(byCol),expected.sort(byCol),
          `${mode}, W${width}, frame ${index+1}, view ${rp}, bounce ${bounce}`);
        if(rp===4&&events.length===1)for(const [,,colour] of run.paths){
          assert.equal(branchColour(colour),events[0][1], 'all cells in one cone follow its branch');
        }
      }
    }
  }
});
