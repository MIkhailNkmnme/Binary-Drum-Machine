import assert from 'node:assert/strict';
import {test} from 'node:test';
import {compareFrames, gridFor, youtubeVideoId} from './diff.mjs';

const pixels = (width, height, get) => ({width, height,
  data: Uint8ClampedArray.from(Array.from({length: width * height}, (_, i) => [...get(i), 255]).flat())});

test('размер ячейки можно выбрать от одного пикселя до четырёх блоков с полным покрытием', () => {
  assert.deepEqual(gridFor(5, 3, 1, 1), {width: 1, height: 1, columns: 5, rows: 3});
  assert.deepEqual(gridFor(5, 3, 900, 900), {width: 3, height: 2, columns: 2, rows: 2});
  assert.deepEqual(gridFor(1, 3, 99, 99), {width: 1, height: 2, columns: 1, rows: 2});
});

test('точный расчёт RGB на неполных краях, смена порога, одинаковые кадры', () => {
  const black = pixels(5, 3, () => [0, 0, 0]);
  const corner = pixels(5, 3, index => index === 14 ? [255, 255, 255] : [0, 0, 0]);
  const grid = gridFor(5, 3, 3, 2);
  const changed = compareFrames(black, corner, grid, 0);
  assert.equal(changed.changed, 1);
  assert.equal(changed.average, 100 / 15);
  assert.deepEqual([...changed.scores], [0, 0, 0, 50]);
  assert.equal(changed.maximum, 50);
  assert.equal(compareFrames(black, corner, grid, 50.1).changed, 0);
  assert.equal(compareFrames(black, black, grid, 0).changed, 0);
});

test('первый кадр и смена размеров не дают ложного сравнения', () => {
  const frame = pixels(5, 3, () => [255, 255, 255]);
  const other = pixels(1, 3, () => [0, 0, 0]);
  const grid = gridFor(5, 3, 1, 1);
  assert.equal(compareFrames(null, frame, grid, 0).hasPrevious, false);
  assert.equal(compareFrames(other, frame, grid, 0).hasPrevious, false);
});

test('плеер принимает только корректные адреса YouTube', () => {
  for (const url of ['https://youtu.be/f-dUVYPt1Pk', 'https://www.youtube.com/watch?v=f-dUVYPt1Pk', 'https://youtube.com/shorts/f-dUVYPt1Pk']) {
    assert.equal(youtubeVideoId(url), 'f-dUVYPt1Pk');
  }
  assert.equal(youtubeVideoId('https://not-youtube.com/watch?v=f-dUVYPt1Pk'), null);
  assert.equal(youtubeVideoId('https://youtube.com/watch?v=%3Cscript%3E'), null);
});
