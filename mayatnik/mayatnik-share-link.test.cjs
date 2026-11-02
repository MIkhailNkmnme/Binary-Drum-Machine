'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const SL = require('./mayatnik-share-link.js');

const state = {
  rows: 128, steps: 512, mode: 'pend', bg: 'empty', view: 'bits', speed: 4,
  pair: false, edgeWrap: true, edgeBounce: false, edgeWidth: 4, compareSource: '',
  sequenceSourceOn: false, zoom: 'fit', templateMaxArea: 4096,
  sym: false, symBits: false, vrows: 0, parity: { cellsEven: true, cellsOdd: true, rowsEven: true, rowsOdd: true, colsEven: true, colsOdd: true, rowLevels: [], cellLevels: [], colLevels: [], rowFill: 'none' }
};
const payload = () => ({ v: 1, at: '2026-11-01T09:00:00.000Z', k: 107, state: structuredClone(state), tools: { fillMode: false, autoVertical: 0, templatePickMode: 'one' }, colours: { fillColour: '#ff7f27', fillMirror: true }, colourAuto: {} });

test('ссылка сжимается и читается обратно без потерь', async () => {
  const code = await SL.encode(payload());
  assert.match(code, /^[01]\.[A-Za-z0-9_-]+$/);
  assert.equal(code[0], '1', 'в Node есть CompressionStream — код сжатый');
  const back = await SL.decode(code);
  assert.deepEqual(back.state, state);
  assert.equal(back.k, 107);
  assert.equal(back.tools.templatePickMode, 'one');
  assert.equal(back.colours.fillColour, '#ff7f27');
});

test('несжатый код 0. тоже читается', async () => {
  const raw = new TextEncoder().encode(SL.pack(payload()));
  const code = '0.' + SL.b64url(raw);
  const back = await SL.decode(code);
  assert.equal(back.state.rows, 128);
  assert.equal(back.k, 107);
});

test('код из адреса #s=… вынимается и собирается обратно', async () => {
  const code = await SL.encode(payload());
  assert.equal(SL.hashCode('#s=' + code), code);
  assert.equal(SL.hashCode('#s=' + code + '&tab=1'), '');
  assert.equal(SL.hashCode('#' + code), '');
  assert.equal(SL.urlFor('https://1001100.online/mayatnik/Zerkalius-mayatnik.html?v=1#old', code),
    'https://1001100.online/mayatnik/Zerkalius-mayatnik.html?v=1#s=' + code);
  assert.throws(() => SL.urlFor('mayatnik.html', code), /адрес/);
});

test('описание ссылки: строки, кадр, построение, вид', () => {
  const d = SL.describe({ k: 107, state });
  assert.match(d.summary, /^128 строк · кадр 107 из 512 · Перескок · Биты$/);
  assert.match(d.title, /^Ссылка 128 строк · кадр 107 · Перескок$/);
  const pair = SL.describe({ k: 3, state: { ...state, pair: true, steps: 64, edgeWrap: false, sequenceSourceOn: true, view: 'romb0' } });
  assert.match(pair.summary, /кадр 3 из 32 · пара · Свой маятник · Ромбы чёт/);
  const tri = SL.describe({ k: 7, state: { ...state, view: 'rombTri' } });
  assert.match(tri.summary, /· Треугольники$/);
});

test('испорченная ссылка не применяется', async () => {
  await assert.rejects(SL.decode(''), /Пустая/);
  await assert.rejects(SL.decode('2.AAAA'), /повреждена/);
  await assert.rejects(SL.decode('1.AAAA'), /не распаковывается/);
  await assert.rejects(SL.decode('привет'), /неверный код/);
  assert.throws(() => SL.normalizePayload(null), /не содержит/);
  assert.throws(() => SL.normalizePayload({ v: 2, state }), /другой версией/);
  assert.throws(() => SL.normalizePayload({ v: 1 }), /нет настроек/);
  assert.throws(() => SL.normalizePayload({ v: 1, k: 0, state: { ...state, rows: 4 } }), /число строк/);
  assert.throws(() => SL.normalizePayload({ v: 1, k: 0, state: { ...state, steps: 0 } }), /число вершин/);
  assert.throws(() => SL.normalizePayload({ v: 1, k: 0, state: { ...state, mode: 'diag' } }), /ход маятника/);
  assert.throws(() => SL.normalizePayload({ v: 1, k: 0, state: { ...state, bg: 'red' } }), /фон поля/);
  assert.throws(() => SL.normalizePayload({ v: 1, k: 0, state: { ...state, compareSource: 'bogus' } }), /построение/);
  assert.throws(() => SL.normalizePayload({ v: 1, k: -1, state }), /кадр/);
  assert.throws(() => SL.normalizePayload({ v: 1, k: 0, state: { ...state, sequenceSourceOn: true, sequenceSource: { version: 1, rows: ['10', 'x1'] } } }), /строки своего рисунка/);
  await assert.rejects(SL.decode('1.' + 'A'.repeat(SL.MAX_CODE)), /слишком длинная/);
});

test('длинная ссылка на полное поле остаётся короткой', async () => {
  const full = { ...state, rows: 512, steps: 2048, edgeWidth: 8, parity: state.parity, lineFamilies: { h: true, v: false, d: true }, userLines: [{ r: 1, c: 2 }] };
  const code = await SL.encode({ ...payload(), k: 2048, state: full });
  assert.ok(code.length < 4000, 'ссылка ' + code.length + ' знаков');
});

test('snapshot links preserve all state keys, controls, colours, source, paint and frame', async () => {
  const defaults = require('./mayatnik-reset-state.js').defaults();
  const animatrix = require('./mayatnik-animatrix-source.js');
  const edge = require('./mayatnik-edge-flow.js');
  const common = { ...defaults, ...state, rows: 8, steps: 32, zoom: 3,
    rgbNeighbourFilters: [1, 4, 7], rgbNeighbourBW: 2, view: 'rgbNeighbours',
    vtxFlash: true, bitOneColour: '#34aabb', frameT: 13, speed: 11 };
  const flow = { ...common, edgeContinuous: true, edgeBounce: true };
  Object.assign(flow, edge.range(flow, 91));
  const sources = [
    [common, 27], [flow, 91],
    [{ ...common, compareSource: 'xor', compareMirror: true }, 12],
    [{ ...common, sequenceSourceOn: true, sequenceSource: { version: 1, rows: ['10', '011'] } }, 14],
    [{ ...common, ...animatrix.defaults(), animatrixOn: true, animatrixSource: animatrix.demo(8),
      animatrixCycleMode: 'repeat', animatrixFrameMax: 1500002 }, 1500001]
  ];
  const fill = Uint32Array.from([0, 4294967295, 0, 255, 255, 123]);
  const bits = Int8Array.from([-1, 0, 1, -1, 1, 0]);
  for (const [source, k] of sources) {
    const data = { ...payload(), state: source, k, display: { scrollLeft: 25.5, scrollTop: 41.25 }, tools: { autoVertical: 2, fillMode: true, axisPicking: true },
      colourAuto: { fillColour: { key: 'fillColour', index: 12, color: '#23bbaa', mode: 'frame' } },
      paint: SL.encodePaint({ x: 3, width: 3, height: 2, fill, bits }) };
    const back = await SL.decode(await SL.encode(data));
    assert.deepEqual(back, data);
    assert.deepEqual(SL.decodePaint(back.paint), { x: 3, width: 3, height: 2, fill, bits });
  }
  assert.match(SL.describe({ state: flow, k: 91 }).summary, /91 из 96/);
  assert.match(SL.describe({ state: sources[2][0], k: 12 }).summary, /12 из 15/);
  assert.match(SL.describe({ state: sources[4][0], k: 1500001 }).summary, /1500001 из 1500002/);
  assert.throws(() => SL.normalizePayload({ ...payload(), state: sources[4][0], k: 1500003 }), /кадр/);
  assert.throws(() => SL.normalizePayload({ ...payload(), display: { scrollLeft: 0, scrollTop: -1 } }), /просмотра/);
});

test('legacy edge links carry the piecewise-replay baseline and reject incompatible geometry', async () => {
  const width = 15, height = 8, size = width * height;
  const values = Int8Array.from({ length: size }, (_, i) => i % 3 - 1);
  const mark = Uint8Array.from({ length: size }, (_, i) => Number(i % 4 === 0));
  const seed = { width, height, jumps: 9, laps: 3, values, mark };
  const legacy = { ...state, rows: height, steps: width + 1, edgeWidth: 2, edgeContinuous: false };
  const data = { ...payload(), k: 3, state: legacy, edgeSeed: SL.encodeEdgeSeed(seed) };
  const back = await SL.decode(await SL.encode(data));
  assert.deepEqual(SL.decodeEdgeSeed(back.edgeSeed), seed);
  assert.equal(SL.decodeEdgeSeed((await SL.decode(await SL.encode(payload()))).edgeSeed), null);
  for (const bad of [{ edgeWidth: 4 }, { sequenceSourceOn: true }, { edgeContinuous: true }, { edgeWrap: false }]) {
    assert.throws(() => SL.normalizePayload({ ...data, state: { ...legacy, ...bad } }), /опора круга/i);
  }
  assert.throws(() => SL.encodeEdgeSeed({ ...seed, mark: new Uint8Array(size).fill(2) }), /клетки/);
  assert.throws(() => SL.decodeEdgeSeed({ ...data.edgeSeed, mark: SL.b64url(Uint8Array.of(0, 1, 2)) }), /серия/);
  assert.throws(() => SL.normalizePayload({ ...data, edgeSeed: { ...data.edgeSeed, laps: -1 } }), /номер круга/);
});
