'use strict';
/* v0.467: поля наложения 1, 2, 3 включаются отдельными кнопками.
   Проверяются структура разметки, независимое включение/выключение,
   хотя бы одно поле, сохранение и миграция прежних пар, а также
   попиксельное XOR/AND выбранных полей и правило зеркала (2 и 3). */
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const M = require('../mayatnik/mayatnik-core.js');
const source = fs.readFileSync(__dirname + '/hub-xor-background.js', 'utf8');
const MIN_H = 5, MIN_W = 2 * MIN_H - 1;

function element(extra = {}) {
  const events = {}, classes = new Set(), attributes = {};
  const el = {
    dataset: {}, attributes, style: { setProperty() {} }, hidden: false, title: '', disabled: false, textContent: '',
    classList: {
      toggle(name, on) { if (on === undefined) on = !classes.has(name); if (on) classes.add(name); else classes.delete(name); return on; },
      add(name) { classes.add(name); }, remove(name) { classes.delete(name); }, contains(name) { return classes.has(name); }
    },
    setAttribute(name, value) { attributes[name] = String(value); },
    addEventListener(name, fn) { (events[name] ||= []).push(fn); },
    fire(name, event = {}) { for (const fn of events[name] || []) fn(event); },
    closest() { return null; }, querySelectorAll() { return []; },
    ...extra
  };
  return el;
}
function canvas() {
  const ctx = {
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    last: null, puts: 0,
    putImageData(image) { ctx.last = image; ctx.puts++; }
  };
  const node = element({ width: 0, height: 0, getContext: () => ctx });
  node.parentElement = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 500, height: 300 }), classList: { add() {}, remove() {} } };
  node.ctx = ctx;
  return node;
}
function fixture({ saved = null } = {}) {
  const nodes = {}, timers = new Map(), listeners = {}, stored = [], delays = [];
  let serial = 0, time = 0;
  for (const id of ['hubXorBackground', 'hubComparePause', 'hubComparePauseIcon', 'hubCompareZen',
    'hubCompareMode', 'hubCompareModeLabel', 'hubCompareModeIcon', 'hubCompareMirror',
    'hubCompareMirrorLabel', 'hubCompareMirrorIcon', 'hubCompareSpeed', 'hubCompareSpeedLabel',
    'hubCompareCycle', 'hubCompareCycleLabel',
    'hubCompareOverlayLabel']) nodes[id] = element();
  for (const id of ['hubCones', 'hubXor', 'hubBlend', 'hubPair']) nodes[id] = canvas();
  const fieldButtons = [1, 2, 3].map(value => element({
    dataset: { hubField: String(value) },
    closest(selector) { return selector === '[data-hub-field]' ? this : null; }
  }));
  nodes.hubComparePairs = element({
    querySelectorAll(selector) { return selector === '[data-hub-field]' ? fieldButtons : []; }
  });
  const document = element();
  document.hidden = false; document.body = element();
  document.getElementById = id => nodes[id] || null;

  const context = {
    document, MAYATNIK: M, HubXorKernel: require('./hub-xor-kernel.js'), performance: { now: () => ++time },
    localStorage: { getItem: () => (saved ? JSON.stringify(saved) : null), setItem(key, value) { stored.push([key, value]); } },
    setTimeout(fn, delay) { delays.push(delay); const id = ++serial; timers.set(id, fn); return id; },
    clearTimeout: id => timers.delete(id),
    addEventListener(name, fn) { (listeners[name] ||= []).push(fn); },
    fire(name, event = {}) { for (const fn of listeners[name] || []) fn(event); }
  };
  context.window = context;
  const small = source.replace('const H = 1024', 'const H = ' + MIN_H).replace('FIRST_FRAME = 8', 'FIRST_FRAME = 0');
  vm.runInNewContext(small, context);
  const fields = () => fieldButtons.filter(button => button.attributes['aria-pressed'] === 'true').map(button => Number(button.dataset.hubField));
  const f = {
    nodes, fieldButtons, fields, stored, delays,
    clickField(value) { nodes.hubComparePairs.fire('click', { target: fieldButtons[value - 1], target2: null }); },
    clickMode() { nodes.hubCompareMode.fire('click'); },
    clickMirror() { nodes.hubCompareMirror.fire('click'); },
    clickSpeed() { nodes.hubCompareSpeed.fire('click'); },
    step() { assert.equal(timers.size, 1, 'one scheduled timer'); const [id, fn] = timers.entries().next().value; timers.delete(id); fn(); },
    async flush() { for (let i = 0; i < 5; i++) await Promise.resolve(); },
    async frame() {
      const start = nodes.hubCones.ctx.puts;
      for (let i = 0; i < 5 && nodes.hubCones.ctx.puts === start; i++) this.step();
      await this.flush();
      assert.ok(nodes.hubCones.ctx.puts > start, 'frame published');
    },
    setFields(target) {
      for (const value of [1, 2, 3]) {
        const on = this.fields().includes(value);
        if (on !== target.includes(value)) this.clickField(value);
      }
      assert.deepEqual(this.fields(), target.slice().sort((a, b) => a - b));
    }
  };
  return f;
}
function images(f) {
  return {
    1: f.nodes.hubCones.ctx.last.data,
    2: f.nodes.hubPair.ctx.last.data,
    3: f.nodes.hubXor.ctx.last.data
  };
}
const COLOURS = { 1: [88, 183, 255], 2: [232, 237, 245], 3: [255, 179, 91], common: [232, 237, 245] };
function expected(images, fields, mode, mirror) {
  const data = new Uint8ClampedArray(MIN_W * MIN_H * 4);
  for (let r = 0; r < MIN_H; r++) for (let c = 0; c < MIN_W; c++) {
    let ones = 0, all = true, colour = null;
    for (const field of fields) {
      const column = mirror && field !== 1 ? MIN_W - 1 - c : c;
      const j = (r * MIN_W + column) * 4;
      if (images[field][j + 3] === 255) {
        ones++; if (!colour) colour = COLOURS[field];
      } else all = false;
    }
    const on = mode === 'xor' ? ones % 2 === 1 : all;
    const p = (r * MIN_W + c) * 4;
    if (!on) continue;
    const rgb = mode === 'and' ? COLOURS.common : colour;
    data[p] = rgb[0]; data[p + 1] = rgb[1]; data[p + 2] = rgb[2]; data[p + 3] = 255;
  }
  return data;
}
function assertBlend(f, label) {
  const actual = f.nodes.hubBlend.ctx.last?.data;
  assert.ok(actual, label + ': blend rendered');
  assert.equal(actual.length, MIN_W * MIN_H * 4);
  assert.deepEqual(Array.from(actual), Array.from(f.nodes.hubBlend.ctx.expected), label + ': blend pixels');
}

test('v0.477 markup: three independent field buttons, the old pair buttons are gone', () => {
  const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
  assert.match(html, /<title>[^<]*v0\.477<\/title>/);
  assert.match(html, /hub-xor-kernel\.js\?v=476/);
  assert.match(html, /hub-xor-background\.js\?v=477/);
  const group = html.match(/<div id="hubComparePairs"[^>]*>([\s\S]*?)<\/div>/);
  assert.ok(group, 'field group exists');
  for (const value of [1, 2, 3]) {
    assert.match(group[1], new RegExp('data-hub-field="' + value + '"[^>]*aria-pressed="' + (value === 3 ? 'false' : 'true') + '"'), 'field ' + value);
    assert.match(group[1], new RegExp('title="Поле ' + value + ' — (конусы 5\\.7|обе стороны 5\\.9|всё поле 5\\.8)'));
  }
  assert.doesNotMatch(html, /data-hub-pair/);
  assert.ok(!html.includes('#hubComparePairs .gz-hx[data-hub-pair'), 'the old full-width 1–2–3 rule is gone');
  assert.match(html, /aria-label="Какие поля накладывать: 1 — конусы 5\.7, 2 — обе стороны 5\.9, 3 — всё поле 5\.8"/);
  assert.match(html, /<button id="hubCompareSpeed"[^>]*aria-label="Скорость плеера: 1×"/);
  assert.match(html, /id="hubCompareSpeedLabel"[^>]*>1×/);
});

test('default overlay keeps fields 1 and 2, split mode hides the toggles', () => {
  const f = fixture();
  assert.deepEqual(f.fields(), [1, 2]);
  assert.equal(f.nodes.hubComparePairs.hidden, true);
  f.clickMode();
  assert.equal(f.nodes.hubComparePairs.hidden, false);
  assert.equal(f.nodes.hubCompareModeLabel.textContent, 'XOR');
  assert.equal(f.nodes.hubCompareOverlayLabel.textContent, 'XOR 1–2 · Прямо');
  assert.equal(f.fieldButtons[0].attributes['aria-pressed'], 'true');
  assert.equal(f.fieldButtons[2].attributes['aria-pressed'], 'false');
  assert.match(f.fieldButtons[0].title, /Включено: щелчок выключит/);
  assert.match(f.fieldButtons[2].title, /Выключено: щелчок включит/);
});

test('each button toggles only its own field; the last enabled field cannot be switched off', () => {
  const f = fixture();
  f.clickMode();
  f.clickField(3);
  assert.deepEqual(f.fields(), [1, 2, 3]);
  assert.equal(f.nodes.hubCompareOverlayLabel.textContent, 'XOR 1–2–3 · Прямо');
  f.clickField(1);
  assert.deepEqual(f.fields(), [2, 3]);
  assert.equal(f.nodes.hubCompareOverlayLabel.textContent, 'XOR 2–3 · Прямо');
  f.clickField(2);
  assert.deepEqual(f.fields(), [3]);
  f.clickField(3);
  assert.deepEqual(f.fields(), [3], 'the only enabled field stays on');
  assert.equal(f.fieldButtons[2].attributes['aria-pressed'], 'true');
  assert.match(f.fieldButtons[2].title, /Единственное включённое поле: выключить нельзя/);
  assert.equal(f.nodes.hubCompareOverlayLabel.textContent, 'XOR 3 · Прямо');
  f.clickField(1);
  assert.deepEqual(f.fields(), [1, 3], 'fields are kept in number order');
  assert.equal(f.nodes.hubCompareOverlayLabel.textContent, 'XOR 1–3 · Прямо');
  const saved = JSON.parse(f.stored[f.stored.length - 1][1]);
  assert.deepEqual(saved.fields, [1, 3]);
  assert.equal(saved.pair, undefined, 'no legacy pair key is written');
});

test('XOR and AND are calculated over exactly the enabled fields', async () => {
  const f = fixture();
  for (let i = 0; i < 4; i++) await f.frame();
  const fields = images(f);
  for (const field of [1, 2, 3]) {
    let ones = 0;
    for (let i = 3; i < fields[field].length; i += 4) if (fields[field][i] === 255) ones++;
    assert.ok(ones > 0, 'field ' + field + ' has enabled cells');
  }
  assert.notDeepEqual(Array.from(expected(fields, [1, 3], 'xor', false)), Array.from(expected(fields, [2, 3], 'xor', false)),
    'different field sets produce different overlays');
  f.clickMode();   // xor
  f.setFields([1, 2]);
  f.nodes.hubBlend.ctx.expected = expected(images(f), [1, 2], 'xor', false);
  assertBlend(f, 'xor 1–2');
  f.setFields([1, 3]);
  f.nodes.hubBlend.ctx.expected = expected(images(f), [1, 3], 'xor', false);
  assertBlend(f, 'xor 1–3');
  f.setFields([2, 3]);
  f.nodes.hubBlend.ctx.expected = expected(images(f), [2, 3], 'xor', false);
  assertBlend(f, 'xor 2–3');
  f.setFields([1, 2, 3]);
  f.nodes.hubBlend.ctx.expected = expected(images(f), [1, 2, 3], 'xor', false);
  assertBlend(f, 'xor 1–2–3');
  f.clickMode();   // and
  assert.equal(f.nodes.hubCompareModeLabel.textContent, 'AND');
  f.nodes.hubBlend.ctx.expected = expected(images(f), [1, 2, 3], 'and', false);
  assertBlend(f, 'and 1–2–3');
  f.setFields([1, 3]);
  f.nodes.hubBlend.ctx.expected = expected(images(f), [1, 3], 'and', false);
  assertBlend(f, 'and 1–3');
});

test('mirror reads fields 2 and 3 flipped and leaves field 1 straight', async () => {
  const f = fixture();
  for (let i = 0; i < 4; i++) await f.frame();
  f.clickMode();          // xor
  f.setFields([1, 2, 3]);
  f.clickMirror();
  assert.equal(f.nodes.hubCompareMirrorLabel.textContent, 'Зеркально');
  assert.match(f.nodes.hubCompareMirror.title, /Поля 2 и 3/);
  f.nodes.hubBlend.ctx.expected = expected(images(f), [1, 2, 3], 'xor', true);
  assertBlend(f, 'xor mirrored 1–2–3');
  f.setFields([2, 3]);
  f.nodes.hubBlend.ctx.expected = expected(images(f), [2, 3], 'xor', true);
  assertBlend(f, 'xor mirrored 2–3');
  f.clickMode();          // and
  f.nodes.hubBlend.ctx.expected = expected(images(f), [2, 3], 'and', true);
  assertBlend(f, 'and mirrored 2–3');
  f.clickMirror();
  assert.equal(f.nodes.hubCompareMirrorLabel.textContent, 'Прямо');
});

test('saved fields win; the old 1–2 / 2–3 / 3–1 / 1–2–3 pairs are migrated', () => {
  for (const [pair, fields] of [['12', [1, 2]], ['23', [2, 3]], ['31', [1, 3]], ['123', [1, 2, 3]]]) {
    const f = fixture({ saved: { mode: 'xor', pair } });
    assert.deepEqual(f.fields(), fields, 'legacy pair ' + pair);
    assert.equal(f.nodes.hubCompareOverlayLabel.textContent, 'XOR ' + fields.join('–') + ' · Прямо');
  }
  const saved = fixture({ saved: { mode: 'and', fields: [3, 1, 3, 9] } });
  assert.deepEqual(saved.fields(), [1, 3], 'unknown and duplicate numbers are dropped');
  assert.equal(saved.nodes.hubCompareModeLabel.textContent, 'AND');
  const empty = fixture({ saved: { mode: 'xor', fields: [] } });
  assert.deepEqual(empty.fields(), [1, 2], 'empty selection falls back to 1 and 2');
  const broken = fixture({ saved: { mode: 'xor', fields: '123' } });
  assert.deepEqual(broken.fields(), [1, 2], 'a non-array selection is ignored');
});

test('player speed cycles 0,25×–1024×, scales the next frame delay and is saved', async () => {
  const f = fixture();
  assert.equal(f.nodes.hubCompareSpeedLabel.textContent, '1×');
  const seen = [];
  for (let i = 0; i < 13; i++) { f.clickSpeed(); seen.push(f.nodes.hubCompareSpeedLabel.textContent); }
  assert.deepEqual(seen, ['2×', '4×', '8×', '16×', '32×', '64×', '128×', '256×', '512×', '1024×', '0,25×', '0,5×', '1×']);
  assert.match(f.nodes.hubCompareSpeed.title, /0,25× → 0,5× → 1× → 2× → 4× → 8× → 16× → 32× → 64× → 128× → 256× → 512× → 1024×/);
  await f.frame();
  const one = f.delays[f.delays.length - 1];
  f.clickSpeed();   // 2×
  await f.frame();
  const two = f.delays[f.delays.length - 1];
  f.clickSpeed();   // 4×
  await f.frame();
  const four = f.delays[f.delays.length - 1];
  assert.ok(one > 0 && two > 0 && four > 0, 'positive delays');
  assert.ok(two < one, '2× schedules sooner than 1×');
  assert.ok(four < two, '4× schedules sooner than 2×');
  assert.equal(JSON.parse(f.stored[f.stored.length - 1][1]).speed, 4);
  f.clickSpeed();   // 8×
  await f.frame();
  const eight = f.delays[f.delays.length - 1];
  f.clickSpeed();   // 16×
  await f.frame();
  assert.ok(eight < four && f.delays[f.delays.length - 1] < eight);
  for (let i = 0; i < 6; i++) { f.clickSpeed(); await f.frame(); }   // 32× … 1024×
  assert.equal(f.nodes.hubCompareSpeedLabel.textContent, '1024×');
  assert.equal(JSON.parse(f.stored[f.stored.length - 1][1]).speed, 1024);
  f.clickSpeed();   // 0,25×
  f.clickSpeed();   // 0,5×
  await f.frame();
  assert.ok(f.delays[f.delays.length - 1] > one, '0,5× schedules later than 1×');
});

test('speeds above 16× simulate several frames per rendered frame', async () => {
  const fast = fixture({ saved: { speed: 1024 } });
  await fast.frame();
  const fastFrame = Number(fast.nodes.hubXor.dataset.frame);
  const slow = fixture({ saved: { speed: 16 } });
  await slow.frame();
  const slowFrame = Number(slow.nodes.hubXor.dataset.frame);
  assert.ok(Number.isInteger(fastFrame) && Number.isInteger(slowFrame));
  assert.ok(fastFrame >= slowFrame + 2, '1024× advances more frames than 16× per rendered frame (' + slowFrame + ' → ' + fastFrame + ')');
});

test('cycle mode button switches Цикл → Край → Пинг and is saved', () => {
  const f = fixture();
  assert.equal(f.nodes.hubCompareCycleLabel.textContent, 'Край');
  f.nodes.hubCompareCycle.fire('click');
  assert.equal(f.nodes.hubCompareCycleLabel.textContent, 'Пинг');
  assert.equal(JSON.parse(f.stored[f.stored.length - 1][1]).cycleMode, 'pingpong');
  f.nodes.hubCompareCycle.fire('click');
  assert.equal(f.nodes.hubCompareCycleLabel.textContent, 'Цикл');
  f.nodes.hubCompareCycle.fire('click');
  assert.equal(f.nodes.hubCompareCycleLabel.textContent, 'Край');
});

test('cycle mode resets the field at W and starts from frame 0', async () => {
  const f = fixture({ saved: { cycleMode: 'cycle' } });
  for (let i = 0; i < 10; i++) await f.frame();
  assert.equal(f.nodes.hubXor.dataset.frame, '0');
});

test('ping-pong reverse is recomputed and equals the same forward frame', async () => {
  const f = fixture({ saved: { cycleMode: 'pingpong' } });
  for (let i = 0; i < 8; i++) await f.frame();   // кадры 0…7 вперёд
  const forward = [f.nodes.hubCones.ctx.last.data.slice(), f.nodes.hubPair.ctx.last.data.slice(), f.nodes.hubXor.ctx.last.data.slice()];
  await f.frame();                                // 8 — полное поле
  await f.frame();                                // 8 → 7 назад, пересчёт
  assert.equal(f.nodes.hubXor.dataset.frame, '7');
  assert.deepEqual(f.nodes.hubCones.ctx.last.data, forward[0], '5.7 пересчитан точно');
  assert.deepEqual(f.nodes.hubPair.ctx.last.data, forward[1], '5.9 пересчитан точно');
  assert.deepEqual(f.nodes.hubXor.ctx.last.data, forward[2], '5.8 пересчитан точно');
});

test('saved player speed is restored and validated', () => {
  const half = fixture({ saved: { fields: [3], speed: 0.5 } });
  assert.equal(half.nodes.hubCompareSpeedLabel.textContent, '0,5×');
  assert.deepEqual(half.fields(), [3]);
  for (const speed of [8, 16, 32, 64, 128, 256, 512, 1024]) assert.equal(fixture({ saved: { speed } }).nodes.hubCompareSpeedLabel.textContent, speed + '×');
  const invalid = fixture({ saved: { speed: 7 } });
  assert.equal(invalid.nodes.hubCompareSpeedLabel.textContent, '1×');
});
