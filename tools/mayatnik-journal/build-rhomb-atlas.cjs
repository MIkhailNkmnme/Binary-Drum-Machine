'use strict';

const { readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
const { inflateSync } = require('node:zlib');
const { createModel } = require('./analyze-rhomb-period.cjs');

const studyDirectory = join(__dirname, '../../issledovanie/wolfram-nks');
const atlasDirectory = join(__dirname, '../../issledovanie/image-journal/atlas/figures/data');
const readJson = path => JSON.parse(readFileSync(path, 'utf8'));
const referenceSizes = [128, 256, 512, 1024, 2048, 4096];

// Apply the catalogue's existing connectivity and reflection rules.
const source = readFileSync(join(__dirname, 'build-connected-128.cjs'), 'utf8');
const start = source.indexOf('function components(');
const end = source.indexOf('function metadata(', start);
if (start < 0 || end < 0) throw Error('Не найдены правила извлечения фигур каталога 128.');
const {components, symmetric} = new Function(source.slice(start, end) + '\nreturn {components, symmetric};')();

function geometryKey(width, height, mask) {
  return width + 'x' + height + ':' + mask.toString('base64');
}

function shapeMask(raster) {
  const mask = Buffer.alloc(Math.ceil(raster.length / 8));
  for (let i = 0; i < raster.length; i++) if (raster[i]) mask[i >> 3] |= 1 << (i & 7);
  return mask;
}

function sampledFrames(size) {
  const frames = [1];
  for (let frame = 2; frame < size.firstFullFrame; frame += 2) frames.push(frame);
  for (let round = 0; round < size.rounds; round++) frames.push(size.firstFullFrame + round * size.routePeriod);
  if (size.rows === 64) frames.push(2096);
  return [...new Set(frames)].sort((a, b) => a - b);
}

function branchMask(shape, centers, rows) {
  let hit = 0;
  for (let i = 0; i < shape.raster.length && hit !== 3; i++) {
    if (!shape.raster[i]) continue;
    const x = shape.x + i % shape.width;
    const y = shape.y + Math.floor(i / shape.width);
    const radius = Math.min(y, rows - 1 - y);
    if (Math.abs(x - centers[1]) <= radius) hit |= 1;
    if (Math.abs(x - centers[0]) <= radius) hit |= 2;
  }
  return hit;
}

function collect(size) {
  const simulation = createModel(size.rows, size.width, true);
  const queue = new Int32Array(simulation.val.length);
  const frames = sampledFrames(size);
  const figures = new Map();
  for (let at = 0, sample = 0; sample < frames.length;) {
    simulation.advance();
    at++;
    if (at !== frames[sample]) continue;
    sample++;
    const {shapes} = components(simulation.field, (size.width - 1) / 2, queue);
    const centers = simulation.route().slice(2);
    for (const shape of shapes) {
      if (shape.cells < 4) continue;
      const axes = symmetric(shape).filter(axis => axis !== 'point');
      if (!axes.length) continue;
      const {width, height, cells, bit} = shape;
      const mask = shapeMask(shape.raster);
      const key = geometryKey(width, height, mask);
      const identifier = bit + ':' + key;
      if (!figures.has(identifier)) {
        figures.set(identifier, {
          width, height, cells, bit, axes, mask: mask.toString('base64'),
          firstFrame: at, frames: 0, occurrences: 0, branches: 0, key
        });
      }
      const record = figures.get(identifier);
      record.occurrences++;
      if (record.lastFrame !== at) record.frames++;
      record.lastFrame = at;
      record.branches |= branchMask(shape, centers, size.rows);
    }
  }
  return {rows: size.rows, width: size.width, frames, figures: [...figures.values()]};
}

function paeth(left, above, diagonal) {
  const estimate = left + above - diagonal;
  const a = Math.abs(estimate - left);
  const b = Math.abs(estimate - above);
  const c = Math.abs(estimate - diagonal);
  return a <= b && a <= c ? left : b <= c ? above : diagonal;
}

function pngMask(png, width, height) {
  const bytes = Buffer.from(png, 'base64');
  const depth = bytes[24];
  if (bytes.readUInt32BE(16) !== width || bytes.readUInt32BE(20) !== height ||
    bytes[25] !== 3 || ![1, 2, 4, 8].includes(depth) || bytes[28]) {
    throw Error('Неподдерживаемый PNG шаблона.');
  }
  const image = [];
  let alpha;
  for (let at = 8; at < bytes.length;) {
    const length = bytes.readUInt32BE(at);
    const kind = bytes.toString('ascii', at + 4, at + 8);
    const data = bytes.subarray(at + 8, at + 8 + length);
    if (kind === 'IDAT') image.push(data);
    if (kind === 'tRNS') alpha = data;
    at += length + 12;
  }
  if (!alpha) throw Error('Шаблон PNG не содержит маску прозрачности.');
  const packed = inflateSync(Buffer.concat(image));
  const stride = Math.ceil(width * depth / 8);
  const decoded = Buffer.alloc(stride * height);
  const mask = Buffer.alloc(Math.ceil(width * height / 8));
  let cells = 0;
  for (let y = 0; y < height; y++) {
    const row = y * stride;
    const input = y * (stride + 1);
    const filter = packed[input];
    if (filter > 4) throw Error('Неподдерживаемый фильтр PNG.');
    for (let i = 0; i < stride; i++) {
      const left = i ? decoded[row + i - 1] : 0;
      const above = y ? decoded[row + i - stride] : 0;
      const diagonal = y && i ? decoded[row + i - stride - 1] : 0;
      const predictor = filter === 0 ? 0 : filter === 1 ? left : filter === 2 ? above
        : filter === 3 ? (left + above) >> 1 : paeth(left, above, diagonal);
      decoded[row + i] = packed[input + i + 1] + predictor;
    }
    for (let x = 0; x < width; x++) {
      const offset = x * depth;
      const index = (decoded[row + (offset >> 3)] >> (8 - depth - (offset & 7))) & ((1 << depth) - 1);
      if ((alpha[index] ?? 255) === 0) continue;
      const i = y * width + x;
      mask[i >> 3] |= 1 << (i & 7);
      cells++;
    }
  }
  return {mask, cells};
}

function compare(atlases) {
  const entries = atlases.flatMap(atlas => atlas.figures);
  const dimensions = new Set(entries.map(item => [item.width, item.height, item.cells].join(':')));
  const wanted = new Set(entries.map(item => item.key));
  const matches = new Map();
  let referenceFigures = 0;

  function visit(size, connected, number, width, height, cells, png) {
    referenceFigures++;
    if (!dimensions.has([width, height, cells].join(':'))) return;
    const decoded = pngMask(png, width, height);
    if (decoded.cells !== cells) throw Error('Размер маски не совпадает с карточкой ' + size + '/' + number);
    const key = geometryKey(width, height, decoded.mask);
    if (!wanted.has(key)) return;
    if (!matches.has(key)) matches.set(key, {total: 0, examples: []});
    const records = matches.get(key);
    records.total++;
    if (!records.examples.some(item => item.size === size && item.connected === connected)) {
      records.examples.push({size, connected, number});
    }
  }

  for (const size of referenceSizes) {
    const directory = join(atlasDirectory, String(size));
    const index = readJson(join(directory, 'index.json'));
    for (let chunk = 0; chunk < Math.ceil(index.ids.length / index.chunkSize); chunk++) {
      for (const [number, width, height, cells, , , , png] of readJson(join(directory, 'chunk-' + chunk + '.json'))) {
        visit(size, false, number, width, height, cells, png);
      }
    }
  }
  for (const item of readJson(join(atlasDirectory, '128/connected.json')).figures) {
    visit(128, true, item.number, item.width, item.height, item.cells, item.png);
  }
  for (const atlas of atlases) {
    for (const record of atlas.figures) {
      const match = matches.get(record.key);
      record.matchCount = match?.total ?? 0;
      record.matches = match?.examples ?? [];
      delete record.key;
      delete record.lastFrame;
    }
    atlas.figures.sort((a, b) => Number(b.matchCount > 0) - Number(a.matchCount > 0) ||
      b.occurrences - a.occurrences || a.firstFrame - b.firstFrame);
    atlas.figures.forEach((record, index) => {record.id = index + 1;});
    atlas.matchingShapes = atlas.figures.filter(record => record.matchCount).length;
  }
  return referenceFigures;
}

function writeAtlas(directory = studyDirectory) {
  const periods = readJson(join(studyDirectory, 'romb-period.json')).sizes;
  const atlases = periods.filter(size => size.factor === 2 && size.edge === 'wrap').map(collect);
  const referenceFigures = compare(atlases);
  const report = {referenceFigures, referenceSizes, atlases};
  writeFileSync(join(directory, 'romb-atlas.json'), JSON.stringify(report) + '\n');
  return atlases.map(atlas => ({
    rows: atlas.rows, frames: atlas.frames.length, figures: atlas.figures.length, matches: atlas.matchingShapes, referenceFigures
  }));
}

if (require.main === module) console.log(JSON.stringify(writeAtlas(process.argv[2]), null, 2));
module.exports = {writeAtlas};
