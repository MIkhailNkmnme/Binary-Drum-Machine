const test = require('node:test'), assert = require('node:assert/strict');
const {model} = require('./mayatnik-stolb.js');

test('от центра до края и снова из центра', () => {
  const m = model({span: 3}), seen = [];
  for (let i = 0; i < 9; i++) { seen.push(m.t); m.step(1); }
  assert.deepEqual(seen, [0, 1, 2, 3, 0, 1, 2, 3, 0]);
  assert.equal(m.period, 4);
});

test('назад по кругу и старт с заданного шага', () => {
  const m = model({span: 3, t: 2});
  assert.equal(m.t, 2);
  m.step(-3); assert.equal(m.t, 3);   // 2 → 1 → 0 → (по кругу) 3
});

test('ширина 0 и выход за край', () => {
  const zero = model({span: 0}); zero.step(5); assert.equal(zero.t, 0); assert.equal(zero.period, 1);
  assert.equal(model({span: 4, t: 99}).t, 4);
  assert.equal(model({span: -2}).span, 0);
});
