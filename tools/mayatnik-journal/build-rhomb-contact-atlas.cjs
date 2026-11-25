'use strict';

const {mkdirSync, readFileSync, writeFileSync} = require('node:fs');
const {join} = require('node:path');
const {createHash} = require('node:crypto');
const {createPackedRhomb} = require('./rhomb-packed.cjs');

function contactAtlasFrames(size) {
  const {start, contactEvery, routePeriod} = size;
  return [1, ...[start, start + contactEvery, start + routePeriod].flatMap(frame => [frame - 1, frame, frame + 1])];
}

function createAtlasCollector(rows, width) {
  const values = new Int8Array(rows * width);
  const labels = new Uint32Array(values.length);
  const queue = new Int32Array(values.length);
  const records = new Map();
  const samples = [];

  function axes(label, cells, left, top, w, h) {
    const reflections = ['vertical', 'horizontal', 'diagonal', 'antidiagonal'];
    return reflections.slice(0, w === h ? 4 : 2).filter((_, axis) => {
      for (let i = 0; i < cells; i++) {
        const p = queue[i];
        const x = p % width - left;
        const y = Math.floor(p / width) - top;
        const rx = axis === 0 ? w - 1 - x : axis === 1 ? x : axis === 2 ? y : w - 1 - y;
        const ry = axis === 0 ? y : axis === 1 ? h - 1 - y : axis === 2 ? x : h - 1 - x;
        if (labels[(top + ry) * width + left + rx] !== label) return false;
      }
      return true;
    });
  }

  function add(model) {
    const [right, left] = model.centers;
    labels.fill(0);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < width; x++) values[y * width + x] = model.cell(y, x);
    }
    samples.push(model.frame);
    let label = 0;
    for (let y = 0; y < rows; y++) {
      for (let column = 0; column < width; column++) {
        const start = y * width + column;
        const bit = values[start];
        if (bit < 0 || labels[start]) continue;
        labels[start] = ++label;
        queue[0] = start;
        let cells = 1, branches = 0;
        let x0 = width, x1 = 0, y0 = rows, y1 = 0;
        for (let i = 0; i < cells; i++) {
          const p = queue[i];
          const x = p % width;
          const y = Math.floor(p / width);
          x0 = Math.min(x0, x); x1 = Math.max(x1, x);
          y0 = Math.min(y0, y); y1 = Math.max(y1, y);
          if (x === left) branches |= 1;
          if (x === right) branches |= 2;
          for (let ny = Math.max(0, y - 1); ny <= Math.min(rows - 1, y + 1); ny++) {
            for (let nx = Math.max(0, x - 1); nx <= Math.min(width - 1, x + 1); nx++) {
              const next = ny * width + nx;
              if (labels[next] || values[next] !== bit) continue;
              labels[next] = label;
              queue[cells++] = next;
            }
          }
        }
        if (cells < 4) continue;
        const w = x1 - x0 + 1, h = y1 - y0 + 1;
        const symmetric = axes(label, cells, x0, y0, w, h);
        if (!symmetric.length) continue;
        const mask = Buffer.alloc(Math.ceil(w * h / 8));
        for (let i = 0; i < cells; i++) {
          const p = queue[i];
          const pixel = (Math.floor(p / width) - y0) * w + p % width - x0;
          mask[pixel >> 3] |= 1 << (pixel & 7);
        }
        const key = bit + ':' + w + 'x' + h + ':' + createHash('sha256').update(mask).digest('hex');
        let record = records.get(key);
        if (!record) {
          record = {bit, width: w, height: h, cells, axes: symmetric, firstFrame: model.frame,
            branches: 0, centralBranches: 0, occurrences: 0, mask: mask.toString('base64')};
          records.set(key, record);
        }
        record.branches |= branches;
        record.centralBranches |= branches;
        record.occurrences++;
      }
    }
  }

  function write(directory) {
    mkdirSync(directory, {recursive: true});
    const figures = [...records.values()].sort((a, b) => b.cells - a.cells || a.firstFrame - b.firstFrame);
    figures.forEach((record, i) => {record.id = i + 1;});
    const centralShapes = figures.filter(record => record.centralBranches).length;
    const result = {rows, width, samples, figures, centralShapes};
    writeFileSync(join(directory, rows + '.json'), JSON.stringify(result) + '\n');
    return {rows, width, samples, figures: figures.length, centralShapes};
  }

  return {add, write};
}

function writeContactAtlas(directory = join(__dirname, '../../issledovanie/wolfram-nks/romb-contact-atlas')) {
  const {sizes} = JSON.parse(readFileSync(join(__dirname, '../../issledovanie/wolfram-nks/romb-contact.json'), 'utf8'));
  const index = sizes.map(size => {
    const {rows, width} = size;
    const model = createPackedRhomb(rows, {reverseAtContact: true});
    const collector = createAtlasCollector(rows, width);
    for (const frame of contactAtlasFrames(size)) {
      while (model.frame < frame) model.advance();
      collector.add(model);
    }
    const entry = collector.write(directory);
    console.log(`${rows} · ${entry.figures} фигур · ${entry.centralShapes} на осях`);
    return entry;
  });
  writeFileSync(join(directory, 'index.json'), JSON.stringify(index, null, 2) + '\n');
}

if (require.main === module) writeContactAtlas(process.argv[2]);
module.exports = {createAtlasCollector, contactAtlasFrames};
