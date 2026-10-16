const test = require('node:test'), assert = require('node:assert/strict');
global.window = {}; require('./mayatnik-fold.js');
const {model} = window.MayatnikFold;
const walk = m => { const fwd = []; let f = 0; while (f < m.max) { f = m.pairStep(f, 1); fwd.push(f); }
  const back = []; while (f > 0) { f = m.pairStep(f, -1); back.push(f); } return {fwd, back}; };

test('парой: правая и левая за один шаг, хвост одной стороны — по одному', () => {
  const {fwd, back} = walk(model({width: 7, height: 1, center: 2, data: new Int8Array(7).fill(1)}));
  assert.deepEqual(fwd, [2, 4, 5, 6]);
  assert.deepEqual(back, [5, 4, 2, 0]);
});

test('парой: назад по тем же парам, что и вперёд', () => {
  for (const [w, c] of [[9, 4], [6, 0], [6, 5], [1534, 767], [1534, 700]]) {
    const {fwd, back} = walk(model({width: w, height: 1, center: c, data: new Int8Array(w).fill(1)}));
    assert.deepEqual(back, fwd.slice(0, -1).reverse().concat(0), `w=${w} c=${c}`);
  }
});

test('парой: середина кадра после пары — XOR обоих сложенных столбцов', () => {
  const m = model({width: 5, height: 1, center: 2, data: Int8Array.from([1, 0, 1, 1, 0])});
  m.seek(m.pairStep(0, 1));   // правая 3 и левая 1
  assert.equal(m.bit(2, 0), 1 ^ 1 ^ 0);
});

test('srcAt: клетка свёртки знает свой исходный столбец, центр — нет', () => {
  const m = model({width: 7, height: 1, center: 3, data: new Int8Array(7).fill(1)});
  assert.equal(m.srcAt(3), -1);
  assert.deepEqual([0, 1, 2, 4, 5, 6].map(x => m.srcAt(x)), [0, 1, 2, 4, 5, 6]);
  m.seek(2);   // правая на 1 влево, левая на 1 вправо
  assert.deepEqual([1, 2, 4, 5].map(x => m.srcAt(x)), [0, 1, 5, 6]);
  assert.equal(m.srcAt(0), -1);   // слева уехало за край
});

test('вертикальная: то же, что горизонтальная на транспонированном поле', () => {
  const W = 3, H = 7, data = Int8Array.from({length: W * H}, (_, i) => (i * 7 + 3) % 5 % 2);
  const T = new Int8Array(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) T[x * H + y] = data[y * W + x];
  const v = model({width: W, height: H, center: 3, data, axis: 'v'}), h = model({width: H, height: W, center: 3, data: T});
  assert.equal(v.max, h.max);
  for (let f = 0; f <= v.max; f++) { v.seek(f); h.seek(f);
    for (let y = 0; y < H; y++) { assert.equal(v.srcAt(y), h.srcAt(y)); for (let x = 0; x < W; x++) assert.equal(v.bit(x, y), h.bit(y, x), `f=${f} x=${x} y=${y}`); } }
  assert.ok(v.isMid(0, 3) && !v.isMid(3, 0));
});
