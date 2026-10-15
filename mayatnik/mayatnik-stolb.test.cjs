const test = require('node:test'), assert = require('node:assert/strict');
const {model} = require('./mayatnik-stolb.js');

test('ход туда-обратно без повтора концов', () => {
  const m = model({lo: -2, hi: 2, col: -2}), seen = [];
  for (let i = 0; i < 10; i++) { seen.push(m.col); m.step(1); }
  assert.deepEqual(seen, [-2, -1, 0, 1, 2, 1, 0, -1, -2, -1]);
  assert.equal(m.period, 8);
});

test('старт со своего столбца, назад через край', () => {
  const m = model({lo: 0, hi: 3, col: 2});
  assert.equal(m.col, 2); assert.equal(m.dir, 1);
  m.step(-3); assert.equal(m.col, 1); assert.equal(m.dir, -1);   // 2 → 1 → 0 → (назад по кругу) 1, идёт влево
});

test('перепутанные края и один столбец', () => {
  assert.deepEqual([model({lo: 5, hi: 1, col: 9}).lo, model({lo: 5, hi: 1, col: 9}).hi, model({lo: 5, hi: 1, col: 9}).col], [1, 5, 5]);
  const one = model({lo: 4, hi: 4, col: 4}); one.step(7); assert.equal(one.col, 4); assert.equal(one.period, 1);
});
