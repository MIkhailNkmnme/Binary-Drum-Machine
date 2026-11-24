'use strict';

const { createHash } = require('node:crypto');
const { readFileSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const { createContext, runInContext } = require('node:vm');
const root = path.resolve(__dirname, '../..');
const mayatnik = path.join(root, 'mayatnik');
const core = require('../../mayatnik/mayatnik-core.js');
const construction = require('../../mayatnik/mayatnik-construction.js');
const { phasePlan, phaseSourceIndex } = require('../../mayatnik/mayatnik-scale-stack-view.js');
const { create, sample } = require('../../mayatnik/scale-atlases/source.js');
const gif = require('../../issledovanie/image-journal/recipes/totem-axis-catalog/frame-index.json');

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
});

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

for (const rows of [128, 256, 512, 1024]) {
  const step = rows === 1024 ? 4 : 1;
  const numbers = rows === 512 ? gif.frames.map(frame => frame.frame) :
    Array.from({length: rows / step}, (_, index) => (index + 1) * step);
  const {width, height} = sources.read(rows, numbers[0]);
  const frames = numbers.map(number => verifyFrame(rows, number));
  const levels = [];
  for (let factor = 2; factor <= Math.floor(height / 8); factor++) {
    const {items: [first], total} = phasePlan(width, height, factor, 0, 1);
    levels.push({factor, width: first.width, height: first.height, phases: total});
  }
  const index = {rows, width, height, ...(rows === 512 ? {sourceSha256: gif.source_sha256} : {}), levels, frames};
  writeFileSync(path.join(mayatnik, 'scale-atlases', `index-${rows}.json`), JSON.stringify(index) + '\n');
  console.log(`${rows}: ${frames.length} кадров, ${levels.length} коэффициентов; все кадры восстановлены из фаз ÷3`);
}
