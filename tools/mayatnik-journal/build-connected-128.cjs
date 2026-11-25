const { readFileSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const Core = require('../../mayatnik/mayatnik-core.js');
const Construction = require('../../mayatnik/mayatnik-construction.js');
const { composeFree } = require('../../mayatnik/scale-atlases/indexed-png.js');

const directory = path.join(__dirname, '../../issledovanie/image-journal/atlas/figures/data/128');
const settings = { rows: 128, steps: 128, mode: 'pend', bg: 'empty' };
// Indexed PNG order is transparent, bit 1 (coral), bit 0 (turquoise).
const palette = [0, 0xff5778ea, 0xffadb451];

function components({ W, H, val }, center, queue) {
  const labels = new Int32Array(val.length);
  const shapes = [];
  for (let seed = 0; seed < val.length; seed++) {
    const bit = val[seed];
    if (bit < 0 || labels[seed]) continue;
    const label = shapes.length + 1;
    let cells = 1, central = false;
    let left = W, right = 0, top = H, bottom = 0;
    queue[0] = seed;
    labels[seed] = label;
    for (let head = 0; head < cells; head++) {
      const offset = queue[head];
      const x = offset % W, y = Math.floor(offset / W);
      central ||= x === center;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
      for (let ny = Math.max(0, y - 1); ny <= Math.min(H - 1, y + 1); ny++) {
        for (let nx = Math.max(0, x - 1); nx <= Math.min(W - 1, x + 1); nx++) {
          const neighbor = ny * W + nx;
          if (val[neighbor] !== bit || labels[neighbor]) continue;
          labels[neighbor] = label;
          queue[cells++] = neighbor;
        }
      }
    }
    const width = right - left + 1, height = bottom - top + 1;
    const raster = Buffer.alloc(width * height);
    for (let index = 0; index < cells; index++) {
      const offset = queue[index];
      const col = offset % W - left, row = Math.floor(offset / W) - top;
      raster[row * width + col] = 2 - bit;
    }
    shapes.push({ x: left, y: top, width, height, raster, cells, bit, seed, central });
  }
  return { labels, shapes };
}

function symmetric({ width, height, raster }) {
  const transforms = [
    ['vertical', (x, y) => y * width + width - 1 - x],
    ['horizontal', (x, y) => (height - 1 - y) * width + x],
    ['point', (x, y) => (height - 1 - y) * width + width - 1 - x]
  ];
  if (width === height) transforms.push(
    ['diagonal', (x, y) => x * width + y],
    ['antidiagonal', (x, y) => (height - 1 - x) * width + width - 1 - y]
  );
  return transforms.filter(([, to]) =>
    raster.every((pixel, i) => pixel === raster[to(i % width, Math.floor(i / width))])
  ).map(([name]) => name);
}

function metadata(record) {
  return { frames: record.frames, symmetry: record.symmetry, mirrorFrame: record.mirrorFrame, mirrorNumber: record.mirrorPartner?.number };
}

async function build() {
  const geometry = Construction.geometry(settings);
  const { anchor, W } = geometry;
  const field = Core.field(W, settings.rows, settings.bg, anchor);
  const queue = new Int32Array(field.val.length);
  const { ids } = JSON.parse(readFileSync(path.join(directory, 'index.json')));
  const original = JSON.parse(readFileSync(path.join(directory, 'chunk-0.json')));
  const publishedAt = new Map(original.map(([id, w, h, cells, frame, x, y]) =>
    [[frame, x, y, w, h, cells].join(':'), id]));
  const axisRecords = new Map();
  const central = new Map(), outside = new Map();
  const legacyCentral = new Set(), legacyOutside = new Set();
  let occurrences = 0, pairs = 0;

  for (let frame = 2; frame <= settings.steps; frame += 2) {
    Construction.step(field, geometry, settings, frame - 2);
    Construction.step(field, geometry, settings, frame - 1);
    const { labels, shapes } = components(field, anchor, queue);
    const records = shapes.map(shape => {
      const { width, height, x, y, cells, raster } = shape;
      const group = shape.central ? central : outside;
      const key = width + 'x' + height + ':' + raster.toString('base64');
      if (!group.has(key)) group.set(key, {
        ...shape, frame: null, frames: [], symmetry: symmetric(shape), mirrorFrame: null
      });
      const record = group.get(key);
      if (record.frames.at(-1) !== frame) record.frames.push(frame);
      if (frame >= 4 && record.frame === null) Object.assign(record, { frame, x, y });
      if (frame % 4 === 0) (shape.central ? legacyCentral : legacyOutside).add(record);
      if (shape.central) {
        const id = publishedAt.get([frame, x, y, width, height, cells].join(':'));
        if (id != null) axisRecords.set(id, record);
      } else occurrences++;
      return record;
    });

    if (frame === 2) continue;
    const [left, right] = Core.span(settings.mode, frame);
    const axisTwice = 2 * anchor + left + right;
    for (const [index, shape] of shapes.entries()) {
      const { seed, bit, cells, width, height, x, y, raster } = shape;
      const reflectedX = axisTwice - seed % W;
      if (reflectedX < 0 || reflectedX >= W) continue;
      const partner = labels[seed - seed % W + reflectedX] - 1;
      if (partner <= index) continue;
      const other = shapes[partner];
      if (other.bit !== bit || other.cells !== cells || other.width !== width || other.height !== height ||
          other.y !== y || other.x !== axisTwice - x - width + 1) continue;
      if (!raster.every((pixel, i) =>
        pixel === other.raster[i + width - 1 - 2 * (i % width)])) continue;
      const first = records[index], second = records[partner];
      if (first.mirrorFrame === null) {
        first.mirrorFrame = frame;
        first.mirrorPartner = second;
      }
      if (second.mirrorFrame === null) {
        second.mirrorFrame = frame;
        second.mirrorPartner = first;
      }
      pairs++;
    }
  }

  if (ids.some(id => !axisRecords.has(id))) throw Error('Не найдены исходные позиции всех фигур Атласа 128.');
  const published = new Set(axisRecords.values());
  // Preserve the identifiers of saved compositions from the catalogue sampled every fourth frame.
  const legacy = [...legacyOutside, ...[...legacyCentral].filter(record => !published.has(record))];
  const numbered = new Set(legacy);
  const newRecords = [...outside.values(), ...central.values()].filter(record =>
    record.frame !== null && !numbered.has(record) && !published.has(record));
  const additions = [...legacy, ...newRecords];
  for (const [index, record] of additions.entries()) record.number = index + 1;
  const figures = [];
  for (const record of additions) {
    const { number, x, y, width, height, cells, frame, bit, raster, central } = record;
    const blob = await composeFree([{ x: 0, y: 0, width, height, raster, palette }],
      { width, height, left: 0, top: 0 });
    const png = Buffer.from(await blob.arrayBuffer()).toString('base64');
    figures.push({ number, x, y, width, height, cells, frame, bit, central, ...metadata(record), png });
  }
  const axis = Object.fromEntries(ids.map(id => {
    const record = axisRecords.get(id);
    return [id, { ...metadata(record), x: record.x, y: record.y }];
  }));
  writeFileSync(path.join(directory, 'connected.json'),
    '{"axis":' + JSON.stringify(axis) + ',"figures":[\n' + figures.map(item => JSON.stringify(item)).join(',\n') + '\n]}\n');
  console.log(JSON.stringify({
    catalogueFrames: settings.steps / 2 - 1, added: newRecords.length, retained: legacy.length,
    frameTwo: [...additions, ...published].filter(record => record.frames[0] === 2).length,
    outsideOccurrences: occurrences, outside: figures.filter(figure => !figure.central).length,
    missingCentral: figures.filter(figure => figure.central).length,
    small: figures.filter(figure => figure.cells < 4).length,
    symmetric: figures.filter(figure => figure.symmetry.length).length,
    paired: figures.filter(figure => figure.mirrorFrame !== null).length, pairs,
    axis: ids.length, axisSymmetric: Object.values(axis).filter(figure => figure.symmetry.length).length,
    axisPaired: Object.values(axis).filter(figure => figure.mirrorFrame !== null).length
  }));
}

build().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
