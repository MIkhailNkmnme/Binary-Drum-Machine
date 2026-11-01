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
