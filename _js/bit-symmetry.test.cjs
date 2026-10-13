const test = require('node:test');
const assert = require('node:assert/strict');
const {find, analyze, colorAt} = require('./bit-symmetry.js');

// Deliberately simple oracle, using physical centered-row coordinates instead of palindrome radii.
function brute(rows, minPairs = 2, minRows = 2) {
  const width = Math.max(...rows.map(r => r.length)), result = [];
  for (let x2 = -width; x2 <= width; x2++) {
    let segment = null;
    const finish = () => { if (segment?.rows.length >= minRows) result.push(segment); segment = null; };
    rows.forEach((row, y) => {
      const center = (x2 + row.length - 1) / 2, odd = Number.isInteger(center);
      let left = odd ? center - 1 : Math.floor(center), right = odd ? center + 1 : Math.ceil(center), pairs = 0, kinds = new Set();
      if (!odd || /[01]/.test(row[center] || '')) while (left >= 0 && right < row.length && /[01]/.test(row[left]) && row[left] === row[right]) {
        kinds.add(row[left]); pairs++; left--; right++;
      }
      if (pairs < minPairs || kinds.size !== 2) { finish(); return; }
      segment ||= {x2, y0:y, y1:y, rows:[]}; segment.y1 = y;
      segment.rows.push({y, left:left + 1, right:right - 1, pairs});
    }); finish();
  }
  return result;
}
const geometry = data => data.segments.map(({x2,y0,y1,rows}) => ({x2,y0,y1,rows}));

test('exact axes agree with an independent oracle on staggered rows and empty cells', () => {
  let seed = 419;
  const rand = n => { seed = (Math.imul(seed,1664525) + 1013904223) >>> 0; return seed % n; };
  for (let k = 0; k < 100; k++) {
    const rows = Array.from({length:12}, () => Array.from({length:10 + rand(14)}, () => '0011.'[rand(5)]).join(''));
    assert.deepEqual(geometry(find(rows,{minPairs:2,minRows:2})), brute(rows));
  }
});

test('a broken row ends the line; a later symmetric region starts a new segment', () => {
  const row = '010110011010', rows = [...Array(8).fill(row), '010010011010', ...Array(8).fill(row)];
  const central = find(rows).segments.filter(s => s.x2 === 0);
  assert.deepEqual(central.map(s => [s.y0,s.y1]), [[0,7],[9,16]]);
});

test('solid zeros, solid ones and empty cells are not motifs', () => {
  for (const bit of ['0','1','.']) assert.equal(find(Array(20).fill(bit.repeat(80))).segments.length,0);
  const data = find(Array(8).fill('010110.011010'));
  assert.equal(data.segments.some(s => s.x2 === 0),false);
  assert.equal(data.colors[0][6],0);
});

test('both pixel-center and between-pixel axes share the geometric center of a growing triangle', () => {
  const rows = Array.from({length:16}, (_,r) => {
    const half = '01011010'.slice(0,6 + r % 3);
    return half + (r % 2 ? '1' : '') + [...half].reverse().join('');
  });
  const s = find(rows).segments.find(s => s.x2 === 0);
  assert.equal(s.y0,0); assert.equal(s.y1,15);
  s.rows.forEach(r => assert.equal(r.left + r.right, rows[r.y].length - 1));
});

test('overlapping axes never leave different colours on a mirror pair', () => {
  const rows = Array(10).fill('01'.repeat(24)), data = find(rows);
  assert.ok(data.segments.length > 1);
  for (const s of data.segments) for (const r of s.rows) for (let j = r.left; j <= r.right; j++) {
    assert.equal(colorAt(data,r.y,j),colorAt(data,r.y,r.left + r.right - j));
  }
});

test('cached analysis follows actual row changes and preserves source bits', () => {
  const rows = Array(8).fill('010110011010'), before = rows.slice(), data = analyze(rows);
  assert.equal(analyze(rows),data); assert.deepEqual(rows,before);
  rows[3] = '1'.repeat(12);
  assert.notEqual(analyze(rows),data);
  assert.equal(analyze(rows).colors[3].some(Boolean),false);
});

test('the actual 128-row Horrorius hub source has visible exact local motifs', () => {
  const fs = require('node:fs'), vm = require('node:vm');
  const rows = vm.runInNewContext(fs.readFileSync(__dirname+'/horr-rows.js','utf8')+'; ZZ_HORR_ROWS');
  const data = analyze(rows);
  assert.ok(data.segments.length > 0); assert.ok(data.matched > 0);
  assert.equal(data.minPairs,2); assert.equal(data.minRows,4);
  for (const s of data.segments) for (const r of s.rows) for (let j = r.left; j <= r.right; j++) {
    assert.equal(rows[r.y][j],rows[r.y][r.left + r.right - j]);
  }
});

test('large requests stay asynchronous and never return another frame\'s result', () => {
  const fs = require('node:fs'), vm = require('node:vm'), workers = [], events = [];
  class Worker {
    constructor(url) { this.url=url; this.sent=[]; workers.push(this); }
    postMessage(message) { this.sent.push(message); }
    terminate() {}
    finish() { const {key,rows,options}=this.sent.at(-1); this.onmessage({data:{key,result:analyze(rows,options)}}); }
  }
  const context = {Worker,URL,document:{currentScript:{src:'http://localhost:8766/_js/bit-symmetry.js?v=1'}},
    window:{dispatchEvent:e=>events.push(e.type)},Event:class {constructor(type){this.type=type;}}};
  vm.runInNewContext(fs.readFileSync(__dirname+'/bit-symmetry.js','utf8'),context);
  const api=context.ZZBitSymmetry, A=Array(32).fill('.'.repeat(4000)+'010110011010'), B=A.slice(); B[0]+='1';
  assert.equal(api.request(A),null); assert.equal(api.request(A),null); assert.equal(workers[0].sent.length,1);
  assert.equal(api.request(B),null); workers[0].finish();
  assert.ok(api.request(A)); assert.equal(api.request(B),null);
  assert.equal(workers[0].sent.length,2); workers[0].finish(); assert.ok(api.request(B));
  assert.deepEqual(events,['bitsymmetryready','bitsymmetryready']);
  assert.match(workers[0].url,/bit-symmetry-worker\.js\?v=2$/);
  const custom={minPairs:1,minRows:1};assert.equal(api.request(A,custom),null);
  assert.equal(workers[0].sent.at(-1).options.minRows,1);assert.equal(workers[0].sent.at(-1).options.minPairs,1);
  workers[0].finish();assert.equal(api.request(A,custom).minRows,1);
  assert.notEqual(api.request(A,custom),api.request(A));
});

test('hub defaults turn on symmetry and an explicit off setting survives reload', () => {
  const fs = require('node:fs'), vm = require('node:vm');
  for (const saved of [null,{}, {bitSymmetry:false}, {symmetryMinimums:{minRows:1,minPairs:1}}]) {
    const context={window:{},document:{readyState:'loading',addEventListener(){}},localStorage:{getItem:()=>JSON.stringify(saved),setItem(){}}};
    vm.runInNewContext(fs.readFileSync(__dirname+'/hub-mirror.js','utf8'),context);
    assert.equal(context.window.HubMirror.state.bitSymmetry,saved?.bitSymmetry !== false);
    assert.equal(context.window.HubMirror.state.symmetryMinimums.minRows,saved?.symmetryMinimums?.minRows||4);
    assert.equal(context.window.HubMirror.state.symmetryMinimums.minPairs,saved?.symmetryMinimums?.minPairs||2);
  }
});

test('one-row motifs are returned at minimum 1 and removed at minimum 2',()=>{
  const rows=['0110'],single=analyze(rows,{minRows:1,minPairs:2}),two=analyze(rows,{minRows:2,minPairs:2});
  assert.equal(single.segments.length,1);assert.equal(single.segments[0].y0,0);assert.equal(single.segments[0].y1,0);
  assert.equal(single.matched,4);assert.equal(two.segments.length,0);
  assert.equal(analyze(rows,{minRows:1,minPairs:2}),single);
});
test('a one-pair minimum really accepts simple 00 and 11 matches',()=>{
  for(const row of ['00','11']){
    const data=analyze([row],{minRows:1,minPairs:1});assert.equal(data.segments.length,1);assert.equal(data.matched,2);
    assert.equal(analyze([row],{minRows:1,minPairs:2}).matched,0);
  }
});
test('invalid minimums are clamped or use defaults',()=>{
  const {limits}=require('./bit-symmetry.js');
  assert.deepEqual(limits(Array(128),{minRows:0,minPairs:-1}),{minRows:1,minPairs:1});
  assert.deepEqual(limits(Array(128),{minRows:NaN,minPairs:Infinity}),{minRows:4,minPairs:2});
});
