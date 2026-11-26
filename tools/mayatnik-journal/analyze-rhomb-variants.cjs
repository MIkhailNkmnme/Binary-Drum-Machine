'use strict';

const {createHash} = require('node:crypto');
const {readFileSync} = require('node:fs');
const path = require('node:path');
const {createPackedRhomb} = require('./rhomb-packed.cjs');

const sizes = Array.from({length: 10}, (_, i) => 2 ** (i + 3));
const gifs = path.resolve(__dirname, '../../issledovanie/wolfram-nks/romb-gifs');
const modal = process.argv[2];
const maxSize = Number(process.argv[3] || 4096);
const minSize = Number(process.argv[4] || 8);
const split = Number(process.argv[5] || 0);
const edgeFilter = process.argv[6];
const routeFilter = process.argv[7];

function catalogue(height) {
  const offsets = [0];
  for (let r = 0; r < height; r++) offsets.push(offsets[r] + 2 * Math.min(r, height - 1 - r) + 1);
  const masks = [Buffer.alloc(offsets[height]), Buffer.alloc(offsets[height])];
  const seen = new Set();
  const results = {
    frames: 0, diamonds: 0, repeated: 0, samePair: 0, mirrorPair: 0,
    vertical: 0, horizontal: 0, halfTurn: 0
  };

  function add(model) {
    results.frames++;
    if (!model.frame) return;
    for (let branch = 0; branch < 2; branch++) {
      const mask = masks[branch], center = model.centers[branch];
      for (let r = 0; r < height; r++) {
        const radius = Math.min(r, height - 1 - r);
        for (let i = offsets[r], c = center - radius; i < offsets[r + 1]; i++, c++) {
          mask[i] = c >= 0 && c < model.width ? model.cell(r, c) + 1 : 0;
        }
      }
      const hash = createHash('sha256').update(mask).digest('base64');
      if (seen.has(hash)) results.repeated++;
      seen.add(hash);
      results.diamonds++;
      let vertical = true, horizontal = true, halfTurn = true;
      for (let r = 0; r < height && (vertical || horizontal || halfTurn); r++) {
        const reverse = offsets[r + 1] - 1;
        const opposite = offsets[height - r - 1];
        for (let i = offsets[r], j = 0; i <= reverse && (vertical || horizontal || halfTurn); i++, j++) {
          if (vertical && mask[i] !== mask[reverse - j]) vertical = false;
          if (horizontal && mask[i] !== mask[opposite + j]) horizontal = false;
          if (halfTurn && mask[i] !== mask[mask.length - 1 - i]) halfTurn = false;
        }
      }
      results.vertical += Number(vertical);
      results.horizontal += Number(horizontal);
      results.halfTurn += Number(halfTurn);
    }
    if (masks[0].equals(masks[1])) results.samePair++;
    for (let r = 0; r < height; r++) {
      for (let i = offsets[r], j = offsets[r + 1] - 1; i < offsets[r + 1]; i++, j--) {
        if (masks[0][i] !== masks[1][j]) return;
      }
    }
    results.mirrorPair++;
  }
  return {add, results};
}

function xor(height, settings, model) {
  const period = model.routePeriod * height / 2;
  const witness = model.periodWitness();
  const start = model.start;
  const returned = start + period;
  let scan = null;
  if (height <= 128) {
    const simulation = createPackedRhomb(height, settings);
    scan = catalogue(height);
    scan.add(simulation);
    while (simulation.frame < returned) {
      simulation.advance();
      scan.add(simulation);
    }
  }
  return {start, period, returned, witness, scan: scan?.results ?? null};
}

function intersection(height, settings, model) {
  const stableAfter = model.start + (height - 1) * model.routePeriod;
  const limit = Math.min(stableAfter + model.routePeriod, height <= 256 ? Infinity :
    model.start + Math.max(2 * model.routePeriod, Math.floor(350_000_000 / (height * height / 96))));
  let lastChange = 0;
  const scan = height <= 128 ? catalogue(height) : null;
  scan?.add(model);
  while (model.frame < limit) {
    model.advance();
    scan?.add(model);
    if (model.changed) lastChange = model.frame;
    if (model.frame - lastChange === model.routePeriod) {
      return {start: lastChange, period: model.routePeriod, returned: model.frame, lastChange, stableAfter,
        scannedThrough: model.frame, scan: scan?.results ?? null};
    }
  }
  return {start: null, period: model.routePeriod, returned: null, lastChange, stableAfter,
    scannedThrough: model.frame, scan: scan?.results ?? null};
}

function scanGifSources(height, reverseAtContact) {
  const series = reverseAtContact ? 'contact' : 'sizes';
  const record = JSON.parse(readFileSync(path.join(gifs, series, 'index.json')))
    .find(entry => entry.rows === height);
  const model = createPackedRhomb(height, {reverseAtContact});
  const period = model.routePeriod * height / 2;
  const returned = model.start + period;
  const scan = catalogue(height);
  const wanted = new Set(record.frames);
  const pivot = height >= 256 ? 8 * height : returned;
  if (wanted.has(0)) scan.add(model);
  let reference;
  while (model.frame < Math.min(pivot, returned)) {
    model.advance();
    if (wanted.has(model.frame)) scan.add(model);
    if (model.frame === model.start) reference = model.snapshot();
  }
  if (model.frame < returned) {
    // Use the proven return to step back into the last selected frames.
    // Replay those frames in increasing order for the same counting convention.
    const late = record.frames.filter(frame => frame > pivot);
    if (late.length) {
      model.skipToReturn(reference, period);
      while (model.frame > late[0]) model.retreat();
      scan.add(model);
      while (model.frame < returned) {
        model.advance();
        if (wanted.has(model.frame)) scan.add(model);
      }
    }
  }
  if (scan.results.frames !== wanted.size) throw Error('Пропущен исходный кадр GIF с высотой ' + height);
  return {height, series, ...scan.results};
}

for (const height of sizes) {
  if (height < minSize || height > maxSize) continue;
  if (modal === 'sources') {
    for (const reverse of [false, true]) {
      console.log(JSON.stringify(scanGifSources(height, reverse)));
    }
    continue;
  }
  const and = modal === 'and';
  if (!and && modal !== 'xor') throw Error('Режимы расчёта: xor, and, sources.');
  const cache = new Map();
  for (const [i, widthFactor] of [2, 4].entries()) {
    if (split && split !== widthFactor) continue;
    for (const [j, bounce] of [false, true].entries()) {
      if (edgeFilter && edgeFilter !== (bounce ? 'bounce' : 'wrap')) continue;
      for (const reverseAtContact of [false, true]) {
        if (routeFilter && reverseAtContact !== (routeFilter === 'contact')) continue;
        const settings = {widthFactor, bounce, reverseAtContact, and};
        const model = createPackedRhomb(height, settings);
        // The route with contact never reaches either physical edge. For both
        // widths the complete diamonds are the same up to horizontal translation.
        const key = reverseAtContact ? 'contact' : i + ':' + j;
        if (!cache.has(key)) {
          cache.set(key, and ? intersection(height, settings, model) : xor(height, settings, model));
        }
        const result = cache.get(key);
        console.log(JSON.stringify({height, width: model.width, ...settings, ...result,
          witness: result.witness ? {...result.witness,
            column: result.witness.column + (reverseAtContact && !split ? (widthFactor / 2 - 1) * height : 0)} : null}));
      }
    }
  }
}
