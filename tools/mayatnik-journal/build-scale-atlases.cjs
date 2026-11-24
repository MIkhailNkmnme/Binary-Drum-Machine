'use strict';

const { createHash } = require('node:crypto');
const { readFileSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const { createContext, runInContext } = require('node:vm');
const root = path.resolve(__dirname, '../..');
const mayatnik = path.join(root, 'mayatnik');
const core = require('../../mayatnik/mayatnik-core.js');
const construction = require('../../mayatnik/mayatnik-construction.js');
const coneBits = require('../../mayatnik/mayatnik-axis-cone-bits.js');
const { phasePlan, phaseSourceIndex } = require('../../mayatnik/mayatnik-scale-stack-view.js');
const { create, sample, LARGE_ROWS } = require('../../mayatnik/scale-atlases/source.js');
const gif = require('../../issledovanie/image-journal/recipes/totem-axis-catalog/frame-index.json');
const sizes = [128, 256, 512, 1024, 2048, 4096];

let recording;
const sources = create(core, construction, () => {
  if (!recording) {
    const context = createContext({window: {atob}});
    for (const name of ['mayatnik-axis-512-data.js', 'mayatnik-axis-512.js']) {
      runInContext(readFileSync(path.join(mayatnik, name), 'utf8'), context, {filename: name});
    }
    recording = {size: context.window.MayatnikAxis512Data.size, bank: context.window.MayatnikAxisArchive};
  }
  return recording;
}, coneBits);

function verifyFrame(rows, number) {
  const source = sources.read(rows, number);
  const {width, height, pixels, palette} = source;
  const plan = phasePlan(width, height, 3);
  const reconstructed = new Uint32Array(pixels.length);
  const occupied = [];
  for (const phase of plan.items) {
    const tile = sample(source, phase, phaseSourceIndex);
    occupied.push(tile.occupied);
    for (let y = 0; y < phase.validHeight; y++) {
      for (let x = 0; x < phase.validWidth; x++) {
        reconstructed[phaseSourceIndex(phase, x, y)] = tile.raster[y * phase.width + x];
      }
    }
  }
  const rgb = rows === 512 ? Buffer.alloc(pixels.length * 3) : null;
  for (let index = 0; index < pixels.length; index++) {
    const value = palette ? palette[pixels[index] + 1] : pixels[index];
    if (reconstructed[index] !== value) throw Error(`Фазы не восстанавливают ${rows}/${number}`);
    if (rgb) {
      rgb[index * 3] = value & 255;
      rgb[index * 3 + 1] = value >>> 8 & 255;
      rgb[index * 3 + 2] = value >>> 16 & 255;
    }
  }
  if (rgb && createHash('sha256').update(rgb).digest('hex') !== gif.frames[number].sha256) {
    throw Error(`Кадр записи 512/${number} не совпадает с GIF`);
  }
  return {number, occupiedAt3: occupied};
}

function countLargeFrame(height, anchor, number) {
  // Every visited apex of one parity adds a cone of that parity. The row
  // contains the interval between the outer apices, at a stride of two.
  const extremes = core.span('pend', number);
  const left = anchor + extremes[0];
  const right = anchor + extremes[1];
  const occupiedAt3 = Array(9).fill(0);
  for (let y = 0; y < height; y++) {
    const base = 3 * (y % 3);
    for (let parity = 0; parity < 2; parity++) {
      const first = left + ((left ^ parity) & 1) - y;
      const last = right - ((right ^ parity) & 1) + y;
      const count = (last - first) / 2 + 1;
      for (let i = 0; i < Math.min(3, count); i++) {
        occupiedAt3[base + (first + 2 * i) % 3] += Math.ceil((count - i) / 3);
      }
    }
  }
  return {number, occupiedAt3};
}

function verifyLargeFrame(rows, {number, occupiedAt3}) {
  const source = sources.read(rows, number);
  const {width, height, pixels} = source;
  let covered = 0;
  for (const phase of phasePlan(width, height, 3).items) {
    const tile = sample(source, phase, phaseSourceIndex, true);
    for (let y = 0; y < phase.height; y++) {
      for (let x = 0; x < phase.width; x++) {
        const sx = 3 * x + phase.dx, sy = 3 * y + phase.dy;
        const present = sx < width && sy < height;
        const expected = present ? pixels[sy * width + sx] + 1 : 0;
        if (tile.raster[y * phase.width + x] !== expected) throw Error(`Фазы не восстанавливают ${rows}/${number}`);
        if (present) covered++;
      }
    }
    if (tile.occupied !== occupiedAt3[phase.index]) throw Error(`Неверное число клеток в ${rows}/${number}`);
  }
  if (covered !== width * height) throw Error(`Фазы не покрывают ${rows}/${number}`);
}

const requested = process.argv.slice(2).map(Number);
if (requested.some(rows => !sizes.includes(rows))) {
  throw Error('Укажите размеры атласов: 128, 256, 512, 1024, 2048 или 4096');
}

for (const rows of requested.length ? requested : sizes) {
  const step = rows >= 1024 ? 4 : 1;
  const numbers = rows === 512 ? gif.frames.map(frame => frame.frame) :
    Array.from({length: rows / step}, (_, index) => (index + 1) * step);
  let width, height, frames;
  if (rows >= LARGE_ROWS) {
    const {W, anchor} = construction.geometry({rows, steps: rows, mode: 'pend'});
    width = W;
    height = rows;
    frames = numbers.map(number => countLargeFrame(height, anchor, number));
    for (const index of [0, frames.length / 2 - 1, frames.length - 1]) {
      verifyLargeFrame(rows, frames[index]);
    }
  } else {
    ({width, height} = sources.read(rows, numbers[0]));
    frames = numbers.map(number => verifyFrame(rows, number));
  }
  const levels = [];
  for (let factor = 2; factor <= Math.floor(height / 8); factor++) {
    const {items: [first], total} = phasePlan(width, height, factor, 0, 1);
    levels.push({factor, width: first.width, height: first.height, phases: total});
  }
  const index = {rows, width, height, ...(rows === 512 ? {sourceSha256: gif.source_sha256} : {}), levels, frames};
  writeFileSync(path.join(mayatnik, 'scale-atlases', `index-${rows}.json`), JSON.stringify(index) + '\n');
  const check = rows >= LARGE_ROWS ? 'первый, средний и последний кадры сверены по фазам ÷3'
    : 'все кадры восстановлены из фаз ÷3';
  console.log(`${rows}: ${frames.length} кадров, ${levels.length} коэффициентов; ${check}`);
}
