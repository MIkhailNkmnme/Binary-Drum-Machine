'use strict';

const {readFileSync} = require('node:fs');
const path = require('node:path');
const {createPackedRhomb} = require('./rhomb-packed.cjs');

const root = path.resolve(__dirname, '../..');
const seriesRoot = path.join(root, 'issledovanie/wolfram-nks/romb-gifs');
const initialRows = [...readFileSync(path.join(root, '_js/initial-rows.js'), 'utf8')
  .split(']);', 1)[0].matchAll(/"([01]+)"/g)].map(match => match[1]);
const patterns = initialRows.slice(5, 71);
if (patterns.length !== 66 || patterns[0] !== '10101' || patterns.some((word, i) => word.length !== i + 5)) {
  throw Error('Проверьте исходные строки 5–70 начальной последовательности.');
}

function automaton(minimum = 5) {
  const next = [[-1, -1]];
  const outputs = [[]];
  const links = [0];
  for (const [index, word] of patterns.entries()) {
    if (word.length < minimum) continue;
    let state = 0;
    for (const digit of word) {
      const bit = Number(digit);
      if (next[state][bit] === -1) {
        next[state][bit] = next.length;
        next.push([-1, -1]);
        outputs.push([]);
      }
      state = next[state][bit];
    }
    outputs[state].push(index);
  }

  const queue = [];
  for (let bit = 0; bit < 2; bit++) {
    const state = next[0][bit];
    if (state > 0) {
      links[state] = 0;
      queue.push(state);
    } else next[0][bit] = 0;
  }
  for (const state of queue) {
    for (let bit = 0; bit < 2; bit++) {
      const child = next[state][bit];
      const fallback = next[links[state]][bit];
      if (child < 0) next[state][bit] = fallback;
      else {
        links[child] = fallback;
        outputs[child].push(...outputs[fallback]);
        queue.push(child);
      }
    }
  }
  // Low 15 bits are the offset of the next two transitions; the high bit
  // is set exactly where that transition completes at least one pattern.
  if (2 * next.length >= 32768) throw RangeError('Слишком большой автомат.');
  const edges = new Int16Array(2 * next.length);
  for (let i = 0; i < next.length; i++) {
    for (let bit = 0; bit < 2; bit++) {
      const end = next[i][bit];
      edges[2 * i + bit] = 2 * end | (outputs[end].length ? 32768 : 0);
    }
  }
  return {edges, outputs};
}

const allLengths = automaton();
const longLengths = automaton(30);
const steps = [[2, 0], [0, 2], [1, 1], [-1, 1]];

function scan(model) {
  const {width, height, frame} = model;
  if (!frame) return [];
  return scanGrid(width, height, model.snapshot());
}

function scanGrid(width, height, {bits, leftmost, rightmost, pixels, values, bounds}, remaining, minimum = 5) {
  const {edges, outputs} = minimum === 30 ? longLengths : allLengths;
  const stride = bits ? bits.length / height : 0;
  const words = stride / 2;
  const vertical = new Int16Array(2 * width);
  const diagonal = new Int16Array(width + height);
  const opposite = new Int16Array(width + height);
  const counts = new Uint32Array(4 * patterns.length);
  const first = new Int32Array(counts.length).fill(-1);

  function hit(offset, state, cell) {
    for (const pattern of outputs[state >> 1]) {
      if (remaining) {
        if (!remaining[pattern]) continue;
        remaining[pattern] = 0;
      }
      const index = offset + pattern;
      if (!counts[index]++) first[index] = cell;
    }
  }

  const stride2 = patterns.length * 2, stride3 = patterns.length * 3;
  const firstRow = bounds?.top ?? 0, lastRow = bounds?.bottom ?? height;
  for (let row = firstRow; row < lastRow; row++) {
    const radius = Math.min(row, height - row - 1);
    const origin = row * width;
    const packed = row * stride;
    const a = values ? bounds.left : pixels ? 0 : Math.max(0, leftmost - radius);
    const b = values ? bounds.right : pixels ? width - 1 : Math.min(width - 1, rightmost + radius);
    const diagOrigin = height - row - 1;
    const vertOrigin = (row & 1) * width;
    let even = 0, odd = 0;
    if (!values) {
      vertical.fill(0, vertOrigin, vertOrigin + a);
      vertical.fill(0, vertOrigin + b + 1, vertOrigin + width);
      diagonal.fill(0, diagOrigin, diagOrigin + a);
      diagonal.fill(0, diagOrigin + b + 1, diagOrigin + width);
      opposite.fill(0, row, row + a);
      opposite.fill(0, row + b + 1, row + width);
    }

    for (let col = a; col <= b; col++) {
      const parity = col & 1;
      const v = vertOrigin + col, d = diagOrigin + col, o = row + col;
      // The collection uses indices 1–8 for bits and all other indices for
      // backdrop and decorative seams. Adjacent pairs have the same palette role.
      const cell = values ? values[origin + col] : pixels ? pixels[origin + col] : 0;
      const empty = values ? cell < 0 : pixels ? cell < 1 || cell > 8
        : leftmost === rightmost && ((col - leftmost + radius) & 1);
      if (empty) {
        vertical[v] = diagonal[d] = opposite[o] = 0;
        if (parity) odd = 0;
        else even = 0;
        continue;
      }
      const bit = values ? cell : pixels ? (cell - 1) & 1
        : (bits[packed + parity * words + (col >> 6)] >>> ((col >> 1) & 31)) & 1;
      const h = edges[(parity ? odd : even) + bit];
      const vt = edges[vertical[v] + bit], dg = edges[diagonal[d] + bit], op = edges[opposite[o] + bit];
      if (parity) odd = h & 32767;
      else even = h & 32767;
      vertical[v] = vt & 32767;
      diagonal[d] = dg & 32767;
      opposite[o] = op & 32767;
      const terminal = origin + col;
      if (h < 0) hit(0, h & 32767, terminal);
      if (vt < 0) hit(patterns.length, vt & 32767, terminal);
      if (dg < 0) hit(stride2, dg & 32767, terminal);
      if (op < 0) hit(stride3, op & 32767, terminal);
    }
    // A shrinking or expanding envelope moves by at most one column per
    // row. Reset the two diagonal lines that have just crossed the grid edge.
    if (row + 1 < height) {
      diagonal[diagOrigin - 1] = 0;
      opposite[row + width] = 0;
    }
  }

  const summary = [];
  for (const [pattern, text] of patterns.entries()) {
    const byDirection = [];
    for (const [dir, [dx, dy]] of steps.entries()) {
      const i = dir * patterns.length + pattern;
      if (!counts[i]) continue;
      const x = first[i] % width + 1;
      const y = Math.floor(first[i] / width) + 1;
      byDirection.push([dir, counts[i], y - dy * (text.length - 1), x - dx * (text.length - 1), y, x]);
    }
    if (byDirection.length) summary.push([pattern + 5, byDirection]);
  }
  return summary;
}

function scanSeries(series, minHeight, maxHeight) {
  for (const record of JSON.parse(readFileSync(path.join(seriesRoot, series, 'index.json'), 'utf8'))) {
    const {rows: height, width, frames} = record;
    if (height < minHeight || height > maxHeight) continue;
    const model = createPackedRhomb(height, {reverseAtContact: series === 'contact'});
    const period = model.routePeriod * height / 2;
    const returned = model.start + period;
    const cut = height <= 128 ? returned : 8 * height;
    const wanted = new Set(frames);
    const earlyEnd = frames.filter(frame => frame <= cut).at(-1);
    let reference;
    let startHits;
    function emit() {
      const hits = model.frame === returned && startHits ? startHits : scan(model);
      if (model.frame === model.start) startHits = hits;
      console.log(JSON.stringify({series, height, width, frame: model.frame, hits}));
    }
    if (wanted.has(0)) emit();
    while (model.frame < earlyEnd) {
      model.advance();
      if (wanted.has(model.frame)) emit();
      if (model.frame === model.start) reference = model.snapshot();
    }
    for (const frame of frames.filter(value => value > cut).reverse()) {
      if (model.frame <= cut) model.skipToReturn(reference, period);
      while (model.frame > frame) model.retreat();
      emit();
    }
  }
}

function scanCollection() {
  const {collectionFrames} = require('./build-rhomb-collection.cjs');
  const file = path.join(root, 'issledovanie/image-journal/rhomb-collection/recipes.json');
  for (const series of JSON.parse(readFileSync(file, 'utf8')).series) {
    const at = collectionFrames(series);
    for (const {frame} of series.images) {
      const {width, height, pixels} = at(frame);
      const hits = scanGrid(width, height, {pixels});
      console.log(JSON.stringify({
        series: series.id, height: series.rows, width: series.width, frame,
        searchWidth: width, searchHeight: height, hits,
      }));
    }
  }
}

if (require.main === module) {
  const [series, minimum = '8', maximum = '4096'] = process.argv.slice(2);
  if (series === 'collection') scanCollection();
  else {
    if (!['sizes', 'contact'].includes(series)) throw Error('Укажите серию sizes, contact или collection.');
    scanSeries(series, Number(minimum), Number(maximum));
  }
}

module.exports = {patterns, scan, scanGrid, steps};
