'use strict';

const { createHash } = require('node:crypto');
const { mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const { crc32, deflateSync, inflateSync } = require('node:zlib');
const Core = require('../../mayatnik/mayatnik-core.js');
const Construction = require('../../mayatnik/mayatnik-construction.js');
const ConeBits = require('../../mayatnik/mayatnik-axis-cone-bits.js');

const SIZE_LIMIT = 4096;
const RECTANGLE_LIMIT = 12_000_000;
const FRAME_INTERVAL = 4;
const BANK_FILE = path.resolve(__dirname, '../../mayatnik/mayatnik-axis-512-data.js');
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function getPalette() {
  const match = readFileSync(BANK_FILE, 'utf8').match(/^\s*palette: *(\[[^\r\n]+\]), *$/m);
  if (!match) throw new Error('Cannot read the existing 512 bank palette');
  const palette = JSON.parse(match[1]);
  if (palette[0] !== '#000000' || palette[1] !== '#ffe969' || palette[2] !== '#00008b') {
    throw new Error('The bit roles differ from the existing 512 bank palette');
  }
  return palette;
}

function digest(data) {
  return createHash('sha256').update(data).digest('hex');
}

function pngChunk(name, data) {
  const namedData = Buffer.concat([Buffer.from(name, 'ascii'), data]);
  const size = Buffer.alloc(4);
  size.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(namedData));
  return Buffer.concat([size, namedData, checksum]);
}

function png(width, height, compressed, palette) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 2;
  header[9] = 3;
  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk('IHDR', header),
    pngChunk('PLTE', Buffer.concat(palette.slice(0, 3).map(colour => Buffer.from(colour.slice(1), 'hex')))),
    pngChunk('tRNS', Buffer.from([0, 255, 255])),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

function scanlineStride(width) {
  return 1 + Math.ceil(width / 4);
}

function framePixels({ W, H, val }, left = 0, right = W - 1) {
  const stride = scanlineStride(W);
  const rows = Buffer.alloc(H * stride);
  const bits = [0, 0];
  for (let y = 0; y < H; y++) {
    const start = y * W;
    const row = y * stride + 1;
    for (let x = Math.max(0, left - y), end = Math.min(W - 1, right + y); x <= end; x++) {
      const bit = val[start + x];
      if (bit < 0) continue;
      bits[bit]++;
      rows[row + (x >> 2)] |= (2 - bit) << (6 - 2 * (x & 3));
    }
  }
  return { rows, bits };
}

function compressRows(rows, level) {
  const compressed = deflateSync(rows, {level});
  if (!inflateSync(compressed).equals(rows)) throw new Error('Packed PNG rows differ from their input');
  return compressed;
}

function readMask(file) {
  const image = readFileSync(file);
  for (let offset = PNG_SIGNATURE.length; offset < image.length;) {
    const length = image.readUInt32BE(offset);
    const start = offset + 8;
    if (image.toString('ascii', offset + 4, start) === 'IDAT') {
      return inflateSync(image.subarray(start, start + length));
    }
    offset = start + length + 4;
  }
  throw Error('Figure PNG has no image data: ' + file);
}

// Mark visited cells in the disposable frame, leaving the construction intact.
function collect(field, center, frame, queue, visit) {
  const { W, H, val } = field;
  let hits = 0;
  let axisCells = 0;
  let assignedAxisCells = 0;
  for (let y = 0; y < H; y++) if (val[y * W + center] >= 0) axisCells++;

  for (let seedY = 0; seedY < H; seedY++) {
    const seed = seedY * W + center;
    const bit = val[seed];
    if (bit < 0) continue;

    val[seed] = -1;
    queue[0] = seed;
    let count = 1;
    let xMin = center;
    let xMax = center;
    let yMin = seedY;
    let yMax = seedY;
    for (let head = 0; head < count; head++) {
      const offset = queue[head];
      const y = Math.floor(offset / W);
      const x = offset - y * W;
      if (x === center) assignedAxisCells++;
      xMin = Math.min(xMin, x);
      xMax = Math.max(xMax, x);
      yMin = Math.min(yMin, y);
      yMax = Math.max(yMax, y);
      const left = Math.max(x - 1, 0);
      const right = Math.min(x + 1, W - 1);
      const fromY = Math.max(y - 1, 0);
      const toY = Math.min(y + 1, H - 1);
      for (let ny = fromY; ny <= toY; ny++) {
        const row = ny * W;
        for (let neighbor = row + left; neighbor <= row + right; neighbor++) {
          if (val[neighbor] === bit) {
            val[neighbor] = -1;
            queue[count++] = neighbor;
          }
        }
      }
    }

    const width = xMax - xMin + 1;
    const height = yMax - yMin + 1;
    const stride = scanlineStride(width);
    const rows = Buffer.alloc(height * stride);
    for (let n = 0; n < count; n++) {
      const offset = queue[n];
      const y = Math.floor(offset / W);
      const x = offset - y * W - xMin;
      rows[(y - yMin) * stride + 1 + (x >> 2)] |= (2 - bit) << (6 - 2 * (x & 3));
    }
    visit({ width, height, bit, count, rows }, [frame, xMin, yMin]);
    hits++;
  }

  if (assignedAxisCells !== axisCells) throw new Error('The axis is not fully covered in frame ' + frame);
  return { hits, axisCells };
}

function packRle({ width, height, rows }) {
  const stride = scanlineStride(width);
  const runs = [];
  let colour = rows[1] >> 6;
  let length = 0;
  for (let y = 0; y < height; y++) {
    const row = y * stride + 1;
    for (let x = 0; x < width; x++) {
      const index = (rows[row + (x >> 2)] >> (6 - 2 * (x & 3))) & 3;
      if (index !== colour || length === 32) {
        runs.push(((length - 1) << 3) | colour);
        colour = index;
        length = 0;
      }
      length++;
    }
  }
  runs.push(((length - 1) << 3) | colour);
  return Buffer.from(runs).toString('base64');
}

function writeLocal(folder, file, data) {
  const destination = path.join(folder, file);
  try {
    writeFileSync(destination, data, { flag: 'wx' });
  } catch (error) {
    if (error.code !== 'EEXIST' || !readFileSync(destination).equals(Buffer.from(data))) throw error;
  }
}

function build(folder, rows) {
  const SETTINGS = { rows, steps: rows, mode: 'pend', bg: 'empty' };
  const EXACT_LINK = `https://1001100.online/mayatnik/Zerkalius-mayatnik.html?chisto&n=${rows}&s=${rows}&k={frame}&mode=pend`;
  const SITE_FILE = path.resolve(__dirname, `../../mayatnik/mayatnik-axis-${rows}-data.js`);
  const palette = getPalette();
  const geometry = Construction.geometry(SETTINGS);
  const field = Core.field(geometry.W, SETTINGS.rows, SETTINGS.bg, geometry.anchor);
  const fast = rows === 4096 ? ConeBits.create(field.W, field.H) : null;
  const disposable = fast ? field : { ...field, val: new Int8Array(field.val.length) };
  const compressionLevel = fast ? 1 : 6;
  const queue = new Int32Array(field.val.length);
  const source = { ...SETTINGS, first: FRAME_INTERVAL, last: SETTINGS.steps, interval: FRAME_INTERVAL,
    connectivity: 8, bitRule: 'same', axis: 'center-column', link: EXACT_LINK };
  const size = [field.W, field.H];
  const center = geometry.anchor;
  const frames = [];
  const figures = [];
  const siteRecords = [];
  const byMask = new Map();
  let occurrences = 0;
  let webOccurrences = 0;

  mkdirSync(path.join(folder, 'frames'), { recursive: true });
  mkdirSync(path.join(folder, 'figures'), { recursive: true });

  for (let frame = 1; frame <= SETTINGS.steps; frame++) {
    if (fast) fast.step(geometry.anchor + Core.offset(SETTINGS.mode, frame - 1));
    else Construction.step(field, geometry, SETTINGS, frame - 1);
    if (frame % FRAME_INTERVAL !== 0) continue;
    const file = 'frames/frame-' + String(frame).padStart(4, '0') + '.png';
    if (fast) fast.read(field.val);
    const [left, right] = Core.span(SETTINGS.mode, frame);
    const frameImage = framePixels(field, center + left, center + right);
    const image = png(...size, compressRows(frameImage.rows, compressionLevel), palette);
    writeLocal(folder, file, image);
    const selected = [0, 0];
    let webHits = 0;
    if (!fast) disposable.val.set(field.val);
    const { hits, axisCells } = collect(disposable, center, frame, queue, (shape, occurrence) => {
      const { width, height, bit, count, rows } = shape;
      selected[bit] += count;
      const signature = width + 'x' + height + ':' + digest(rows);
      let item = byMask.get(signature);
      if (!item) {
        const id = figures.length + 1;
        const name = 'figures/figure-' + String(id).padStart(4, '0') + '.png';
        const counts = bit === 0 ? [count, 0] : [0, count];
        const withinSiteLimits = count <= SIZE_LIMIT && width * height <= RECTANGLE_LIMIT;
        const packed = compressRows(rows, compressionLevel);
        const figureImage = png(width, height, packed, palette);
        writeLocal(folder, name, figureImage);
        item = { id, width, height, counts, file: name, sha256: digest(figureImage),
          siteId: withinSiteLimits ? siteRecords.length + 1 : null, occurrences: [] };
        figures.push(item);
        if (withinSiteLimits) siteRecords.push([width, height, counts, packRle(shape), item.occurrences]);
        byMask.set(signature, item);
      } else if (!readMask(path.join(folder, item.file)).equals(rows)) {
        throw new Error('Different normalized masks have the same digest in frame ' + frame);
      }

      item.occurrences.push(occurrence);
      if (item.siteId !== null) webHits++;
    });
    if (selected.some((count, bit) => count > frameImage.bits[bit])) {
      throw new Error('The selected components exceed the source pixels in frame ' + frame);
    }
    occurrences += hits;
    webOccurrences += webHits;
    frames.push({ frame, file, sha256: digest(image), link: EXACT_LINK.replace('{frame}', frame),
      bits: frameImage.bits, selected, axisCells, occurrences: hits, webOccurrences: webHits });

    if (frame % (fast ? 64 : 128) === 0) console.log('Collected ' + frames.length + ' frames through ' + frame);
  }

  const localFigures = figures.length - siteRecords.length;
  const localOccurrences = occurrences - webOccurrences;
  const counts = { frames: frames.length, figures: figures.length, occurrences,
    webFigures: siteRecords.length, webOccurrences, localFigures, localOccurrences };
  const sumOccurrences = records => records.reduce((sum, record) => sum + record.occurrences.length, 0);
  if (counts.frames !== SETTINGS.steps / FRAME_INTERVAL || sumOccurrences(figures) !== occurrences ||
      sumOccurrences(figures.filter(record => record.siteId !== null)) !== webOccurrences) {
    throw new Error('Frame and figure indices contain different occurrence totals');
  }
  const limits = { maxOccupiedBits: SIZE_LIMIT, maxBoundingArea: RECTANGLE_LIMIT };
  const index = { version: 1, source, size, center, palette: palette.slice(0, 3), limits, counts, frames, figures };
  writeLocal(folder, 'index.json', JSON.stringify(index, null, 2) + '\n');
  const csv = ['id,site_id,frame,x,y,width,height,bit0,bit1,file'];
  for (const item of figures) {
    for (const [frame, x, y] of item.occurrences) {
      csv.push([item.id, item.siteId, frame, x, y, item.width, item.height, ...item.counts, item.file].join(','));
    }
  }
  writeLocal(folder, 'occurrences.csv', csv.join('\n') + '\n');

  if (rows >= 1024) {
    const lines = [
      '/* Generated by tools/mayatnik-journal/build-axis-1024.cjs. */',
      `window.MayatnikAxis${rows}Data = {`,
      '  version: 1,',
      '  size: ' + JSON.stringify(size) + ',',
      '  center: ' + center + ',',
      '  source: ' + JSON.stringify(source) + ',',
      '  palette: ' + JSON.stringify(palette) + ',',
      '  records: [',
      ...siteRecords.map(record => '    ' + JSON.stringify(record) + ','),
      '  ]',
      '};',
      ''
    ];
    writeFileSync(SITE_FILE, lines.join('\n'));
  }
  console.log(JSON.stringify(counts));
}

const rows = Number(process.argv[3] ?? 1024);
if (![3, 4].includes(process.argv.length) || ![128, 256, 1024, 2048, 4096].includes(rows) || typeof crc32 !== 'function') {
  console.error('Usage with Node.js 22 or newer: node tools/mayatnik-journal/build-axis-1024.cjs <atlas-directory> [128|256|1024|2048|4096]');
  process.exitCode = 1;
} else {
  build(path.resolve(process.argv[2]), rows);
}
