'use strict';

const { mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
const { encoder } = require('../../mayatnik/mayatnik-gif.js');
const { createModel } = require('./analyze-rhomb-period.cjs');
const { colourCentralAxes } = require('./build-rhomb-atlas.cjs');
const { createPackedRhomb } = require('./rhomb-packed.cjs');
const { createAtlasCollector, contactAtlasFrames } = require('./build-rhomb-contact-atlas.cjs');

const studyDirectory = join(__dirname, '../../issledovanie/wolfram-nks');
const defaultDirectory = join(studyDirectory, 'romb-gifs/diamonds');
const defaultAxesDirectory = join(studyDirectory, 'romb-gifs/axes');
const sizeDirectory = join(studyDirectory, 'romb-gifs/sizes');
const contactDirectory = join(studyDirectory, 'romb-gifs/contact');
const contactAtlasDirectory = join(studyDirectory, 'romb-contact-atlas');
const colours = {
  8: ['янтарная', '4e350f', 'ffcd72'],
  16: ['изумрудная', '144f42', '9af4c7'],
  32: ['сиреневая', '4b3477', 'ddc1ff'],
  64: ['голубая', '21627e', 'bdebf8'],
  128: ['коралловая', '813c4b', 'ffb8b0'],
  256: ['бирюзовая', '14666c', 'b6ffef'],
  512: ['пурпурная', '742c62', 'ffacdf'],
  1024: ['синяя', '213d82', 'b9d1ff'],
  2048: ['оливковая', '4a5a22', 'e2f6a3'],
  4096: ['медная', '784018', 'ffd2a7']
};
const axisColours = ['8150ac', 'f0cfff', '31775d', 'acf2b7', '9b601e', 'ffda8a'];
const loopExtension = Buffer.concat([Buffer.from([33, 255, 11]), Buffer.from('NETSCAPE2.0'), Buffer.from([3, 1, 0, 0, 0])]);
const glyphs = {
  '0': '111101101101111', '1': '010110010010111', '2': '111001111100111',
  '3': '111001111001111', '4': '101101111001001', '5': '111100111001111',
  '6': '111100111101111', '7': '111001010010010', '8': '111101111101111',
  '9': '111101111001111', 'X': '101101010101101', 'F': '111100110100100',
  'C': '111100100100111', 'R': '110101110101101', ' ': '000000000000000'
};

function scheme(rows) {
  const [name, zero, one] = colours[rows];
  return {name, zero: '#' + zero, one: '#' + one,
    rgb: ['0b1620', zero, one, ...axisColours].map(hex => Buffer.from(hex, 'hex'))};
}

function paint(values, width, height, scale, pixels, palette, band, marks) {
  const outputWidth = width * scale;
  for (let y = 0; y < height * scale; y++) {
    const row = Math.floor(y / scale) * width;
    for (let x = 0; x < outputWidth; x++) {
      const source = row + Math.floor(x / scale);
      const bit = values[source];
      const mark = marks?.[source] || 0;
      const colour = palette[mark ? 3 + (mark - 1) * 2 + Number(bit === 1) : bit + 1];
      const i = ((y + band) * outputWidth + x) * 4;
      pixels[i] = colour[0];
      pixels[i + 1] = colour[1];
      pixels[i + 2] = colour[2];
      pixels[i + 3] = 255;
    }
  }
}

function paintLabel(pixels, width, band, textScale, text, color) {
  for (let i = 0; i < width * band * 4; i += 4) {
    pixels[i] = 14;
    pixels[i + 1] = 22;
    pixels[i + 2] = 35;
    pixels[i + 3] = 255;
  }
  const top = Math.floor((band - 5 * textScale) / 2);
  for (const [character, value] of Array.from(text).entries()) {
    const glyph = glyphs[value];
    for (let index = 0; index < glyph.length; index++) {
      if (glyph[index] !== '1') continue;
      const x = 3 + (character * 4 + index % 3) * textScale;
      const y = top + Math.floor(index / 3) * textScale;
      for (let dy = 0; dy < textScale; dy++) {
        for (let dx = 0; dx < textScale; dx++) {
          const i = ((y + dy) * width + x + dx) * 4;
          pixels[i] = color[0];
          pixels[i + 1] = color[1];
          pixels[i + 2] = color[2];
        }
      }
    }
  }
}

function crop({val, W, H}, center, mask) {
  const middle = H / 2 - 1;
  const width = H - 1;
  mask.fill(-1);
  for (let row = 0; row < H; row++) {
    const radius = Math.min(row, H - 1 - row);
    const from = Math.max(-radius, -center);
    const to = Math.min(radius, W - 1 - center);
    for (let offset = from; offset <= to; offset++) {
      mask[row * width + middle + offset] = val[row * W + center + offset];
    }
  }
}

function pairOfDiamonds(model, left, right, combined) {
  const [, , towardRight, towardLeft] = model.route();
  crop(model.field, towardLeft, left);
  crop(model.field, towardRight, right);
  const width = model.field.H - 1;
  const single = Buffer.from(left.buffer).equals(Buffer.from(right.buffer));
  combined.fill(-1);
  for (let row = 0; row < model.field.H; row++) {
    const target = row * (2 * width + 1);
    const begin = row * width;
    const end = begin + width;
    combined.set(left.subarray(begin, end), target);
    if (!single) combined.set(right.subarray(begin, end), target + width + 1);
  }
  return single;
}

function remember(poses, frame, values, single, keepLast = false) {
  const key = Buffer.from(values.buffer).toString('base64');
  if (!keepLast && poses.has(key)) return;
  poses.set(key, {frame, values: values.slice(), single});
}

async function writeGif(directory, name, animation, loop) {
  const bytes = Buffer.from(await animation.finish().arrayBuffer());
  const extension = bytes.indexOf(loopExtension);
  if (extension !== 13) throw Error('Не найден ожидаемый блок повтора GIF.');
  const output = loop ? bytes : Buffer.concat([bytes.subarray(0, extension), bytes.subarray(extension + loopExtension.length)]);
  writeFileSync(join(directory, name), output);
  return {file: name, bytes: output.length};
}

async function buildSize(directory, axisDirectory, size) {
  const {rows, width, firstFullFrame, period} = size;
  const [colourName, zero, one] = colours[rows];
  const palette = ['0b1620', zero, one].map(hex => Buffer.from(hex, 'hex'));
  const axisPalette = palette.concat(['8150ac', 'f0cfff', '31775d', 'acf2b7', '9b601e', 'ffda8a']
    .map(hex => Buffer.from(hex, 'hex')));
  const scale = Math.max(1, Math.floor(96 / rows));
  const gifWidth = width * scale;
  const textScale = gifWidth >= 192 ? 2 : 1;
  const band = 5 * textScale + 4;
  const gifHeight = rows * scale + band;
  const pixels = new Uint8Array(gifWidth * gifHeight * 4);
  const intro = encoder(gifWidth, gifHeight, {mergeEqual: false});
  const loop = encoder(gifWidth, gifHeight, {mergeEqual: false});
  const axisIntro = encoder(gifWidth, gifHeight, {mergeEqual: false});
  const axisLoop = encoder(gifWidth, gifHeight, {mergeEqual: false});
  const simulation = createModel(rows, width, true);
  const left = new Int8Array(rows * (rows - 1));
  const right = new Int8Array(left.length);
  const combined = new Int8Array(rows * width);
  const marks = new Uint8Array(combined.length);
  const queue = new Int32Array(combined.length);
  const introPoses = new Map(), loopPoses = new Map();
  const samples = Math.min(240, period);
  const loopFrames = Array.from({length: samples}, (_, i) =>
    firstFullFrame + Math.round(i * (period - 1) / (samples - 1)));
  const loopSelection = new Set(loopFrames);
  let reference, phase;
  const label = (frame, cycle) => paintLabel(pixels, gifWidth, band, textScale,
    rows + 'X' + width + ' F' + frame + ' C' + cycle, palette[2]);

  for (let frame = 0; frame < firstFullFrame + period; frame++) {
    const isIntro = frame <= firstFullFrame;
    const isLoop = loopSelection.has(frame);
    if (isIntro || isLoop) {
      const single = pairOfDiamonds(simulation, left, right, combined);
      if (isIntro) remember(introPoses, frame, combined, single, frame === firstFullFrame);
      if (isLoop) remember(loopPoses, frame, combined, single);
      if (frame) colourCentralAxes(simulation, marks, queue);
      paint(simulation.val, width, rows, scale, pixels, axisPalette, band, marks);
      if (isIntro) {
        label(frame, 0);
        axisIntro.add(pixels, frame === firstFullFrame ? 50 : 6);
      }
      if (isLoop) {
        label(frame, 1);
        axisLoop.add(pixels, 7);
      }
    }
    if (frame === firstFullFrame) {
      reference = Buffer.from(simulation.val);
      phase = simulation.phase();
    }
    simulation.advance();
  }
  if (!Buffer.from(simulation.val).equals(reference) || phase !== simulation.phase()) {
    throw Error('Не подтверждён цикл GIF для размера ' + rows);
  }
  const encodedIntro = [...introPoses.values()].sort((a, b) => a.frame - b.frame);
  const encodedLoop = [...loopPoses.values()];
  for (const pose of encodedIntro) {
    paint(pose.values, width, rows, scale, pixels, palette, band);
    label(pose.frame, 0);
    intro.add(pixels, pose.frame === firstFullFrame ? 50 : 6);
  }
  for (const pose of encodedLoop) {
    paint(pose.values, width, rows, scale, pixels, palette, band);
    label(pose.frame, 1);
    loop.add(pixels, 7);
  }
  const before = await writeGif(directory, rows + '-before.gif', intro, false);
  const cycle = await writeGif(directory, rows + '-cycle.gif', loop, true);
  const axisBefore = await writeGif(axisDirectory, rows + '-before.gif', axisIntro, false);
  const axisCycle = await writeGif(axisDirectory, rows + '-cycle.gif', axisLoop, true);
  const common = {
    rows, width, period, gifWidth, gifHeight, band, palette: {name: colourName, zero: '#' + zero, one: '#' + one},
  };
  const diamonds = {...common,
    before: {...before, from: 0, to: firstFullFrame, sampled: firstFullFrame + 1,
      frames: encodedIntro.map(pose => pose.frame), single: encodedIntro.filter(pose => pose.single).map(pose => pose.frame)},
    cycle: {...cycle, from: firstFullFrame, to: firstFullFrame + period - 1, sampled: samples,
      frames: encodedLoop.map(pose => pose.frame), single: encodedLoop.filter(pose => pose.single).map(pose => pose.frame)}
  };
  return {diamonds, axes: {...common,
    before: {...axisBefore, from: 0, to: firstFullFrame, frames: firstFullFrame + 1},
    cycle: {...axisCycle, from: firstFullFrame, to: firstFullFrame + period - 1, frames: loopFrames}
  }};
}

async function writeGifs(directory = defaultDirectory, axisDirectory = defaultAxesDirectory) {
  mkdirSync(directory, {recursive: true});
  mkdirSync(axisDirectory, {recursive: true});
  const periods = JSON.parse(readFileSync(join(studyDirectory, 'romb-period.json'), 'utf8')).sizes;
  const files = [];
  for (const size of periods.filter(item => item.factor === 2 && item.edge === 'wrap')) {
    files.push(await buildSize(directory, axisDirectory, size));
  }
  writeFileSync(join(directory, 'index.json'), JSON.stringify(files.map(item => item.diamonds), null, 2) + '\n');
  writeFileSync(join(axisDirectory, 'index.json'), JSON.stringify(files.map(item => item.axes), null, 2) + '\n');
  return files.map(({diamonds, axes}) => ({rows: diamonds.rows, introFrames: diamonds.before.frames.length,
    cycleFrames: diamonds.cycle.frames.length, bytes: diamonds.before.bytes + diamonds.cycle.bytes + axes.before.bytes + axes.cycle.bytes}));
}

function framesBetween(first, last, maxFrames) {
  const count = Math.min(maxFrames, last - first + 1);
  return Array.from({length: count}, (_, index) =>
    count === 1 ? first : first + Math.round(index * (last - first) / (count - 1)));
}

function paintOverview(model, pixels, block, band, palette, density) {
  const {width, height, centers} = model;
  const outputWidth = Math.ceil(width / block);
  const [right, left] = centers.map(center => Math.floor(center / block));
  for (let row = 0; row < height; row += block) {
    for (let column = 0; column < width; column += block) {
      let filled = 0, ones = 0;
      for (let y = row; y < row + block; y++) {
        for (let x = column; x < Math.min(width, column + block); x++) {
          const value = model.cell(y, x);
          filled += Number(value >= 0);
          ones += Number(value === 1);
        }
      }
      const x = column / block;
      const y = band + row / block;
      const axis = Number(x === left) | (Number(x === right) << 1);
      const colour = axis && model.frame ? palette[3 + (axis - 1) * 2 + Number(ones * 2 >= filled)]
        : filled ? density[Math.round(6 * ones / filled)] : palette[0];
      const pixel = (y * outputWidth + x) * 4;
      pixels[pixel] = colour[0];
      pixels[pixel + 1] = colour[1];
      pixels[pixel + 2] = colour[2];
      pixels[pixel + 3] = 255;
    }
  }
}

function gifLayout(rows, width) {
  const small = rows <= 128;
  const palette = scheme(rows);
  const colours = palette.rgb;
  const scale = Math.max(1, Math.floor(96 / rows));
  const block = Math.max(1, rows / 512);
  const gifWidth = small ? width * scale : Math.ceil(width / block);
  const textScale = small ? gifWidth >= 192 ? 2 : 1 : 2;
  const band = 5 * textScale + 4;
  const gifHeight = band + (small ? rows * scale : rows / block);
  const pixels = new Uint8Array(gifWidth * gifHeight * 4);
  const animation = encoder(gifWidth, gifHeight, {mergeEqual: false});
  const density = Array.from({length: 7}, (_, level) => colours[1].map((low, index) =>
    Math.round(low + level * (colours[2][index] - low) / 6)));
  return {small, palette, colours, scale, block, gifWidth, gifHeight, textScale, band, pixels, animation, density};
}

async function writeOneSize(directory, size) {
  const {rows, width} = size;
  const {small, palette, colours, scale, block, gifWidth, gifHeight, textScale, band, pixels, animation, density} = gifLayout(rows, width);
  const first = size.firstFullFrame ?? size.referenceFrame;
  const period = size.period ?? size.returnInterval;
  const end = first + period;
  const before = framesBetween(0, first - 1, small ? 256 : 25);
  const cycle = framesBetween(first, small ? end - 1 : first + width, small ? 240 : 25);
  const tail = small ? [end] : framesBetween(end - Math.floor(width / 6), end, 7);
  const frames = [...before, ...cycle, ...tail];

  function add(frame) {
    const phase = frame < first ? 0 : frame === end ? 2 : 1;
    paintLabel(pixels, gifWidth, band, textScale, rows + 'X' + width + ' F' + frame + ' C' + phase, colours[2]);
    animation.add(pixels, frame === first || frame === end ? 75 : small ? 7 : 14);
  }

  if (small) {
    const model = createModel(rows, width, true);
    const marks = new Uint8Array(model.val.length);
    const queue = new Int32Array(marks.length);
    let at = 0, reference;
    for (const frame of frames) {
      while (at < frame) {model.advance(); at++;}
      if (frame === first) reference = Buffer.from(model.val);
      if (frame === end && !Buffer.from(model.val).equals(reference)) throw Error('Не подтверждён возврат ' + rows);
      if (frame) colourCentralAxes(model, marks, queue);
      paint(model.val, width, rows, scale, pixels, colours, band, marks);
      add(frame);
    }
  } else {
    const model = createPackedRhomb(rows);
    let reference;
    for (const frame of [...before, ...cycle]) {
      while (model.frame < frame) model.advance();
      if (frame === first) reference = model.snapshot();
      paintOverview(model, pixels, block, band, colours, density);
      add(frame);
    }
    // Encode the computed tail in chronological order.
    model.skipToReturn(reference, period);
    const lastFrames = [];
    for (const frame of tail.slice().reverse()) {
      while (model.frame > frame) model.retreat();
      paintOverview(model, pixels, block, band, colours, density);
      lastFrames.push({frame, pixels: pixels.slice()});
    }
    for (const item of lastFrames.reverse()) {
      pixels.set(item.pixels);
      add(item.frame);
    }
  }
  const file = await writeGif(directory, rows + '.gif', animation, true);
  const {rgb, ...paletteInfo} = palette;
  return {...file, rows, width, gifWidth, gifHeight, first, period, end, frames, overview: !small, block, palette: paletteInfo};
}

async function writeSizeAnimations(directory = sizeDirectory) {
  mkdirSync(directory, {recursive: true});
  const {sizes, guaranteedSizes} = JSON.parse(readFileSync(join(studyDirectory, 'romb-period.json'), 'utf8'));
  const result = [];
  for (const size of [...sizes, ...guaranteedSizes].filter(item => item.factor === 2 && item.edge === 'wrap')) {
    const entry = await writeOneSize(directory, size);
    result.push(entry);
    console.log(`${entry.rows} · ${entry.frames.length} кадров · ${entry.bytes} байт`);
  }
  writeFileSync(join(directory, 'index.json'), JSON.stringify(result, null, 2) + '\n');
}

function paintContactContours(pixels, layout, model, contact) {
  const {small, scale, block, band, gifWidth, gifHeight} = layout;
  const cellScale = small ? scale : 1 / block;
  for (let branch = 0; branch < model.centers.length; branch++) {
    const center = model.centers[branch];
    const color = contact ? [255, 218, 138, 255] : branch ? [194, 136, 239, 255] : [138, 224, 172, 255];
    for (let y = band; y < gifHeight; y++) {
      const row = Math.floor((y - band) / cellScale);
      const radius = Math.min(row, model.height - 1 - row);
      for (const coordinate of [center - radius, center + radius]) {
        const x = Math.floor((coordinate + 0.5) * cellScale);
        if (x >= 0 && x < gifWidth) pixels.set(color, (y * gifWidth + x) * 4);
      }
    }
  }
}

async function writeContactSize(directory, atlasDirectory, size) {
  const {rows, width, start, routePeriod, contactEvery, period, returned} = size;
  const layout = gifLayout(rows, width);
  const {small, palette, colours, scale, block, gifWidth, gifHeight, textScale, band, pixels, animation, density} = layout;
  const model = createPackedRhomb(rows, {reverseAtContact: true});
  const collector = createAtlasCollector(rows, width);
  const touches = [start, start + contactEvery, start + routePeriod];
  const atlasFrames = new Set(contactAtlasFrames(size));
  const headEnd = small ? returned - 1 : touches.at(-1) + Math.floor(rows / 8);
  const gifFrames = new Set([...framesBetween(0, start - 1, small ? 128 : 23),
    ...framesBetween(start, headEnd, small ? 240 : 52), ...atlasFrames].filter(frame => small || frame !== 1));
  const early = [...new Set([...gifFrames, ...atlasFrames])].sort((a, b) => a - b);
  const tail = small ? [returned] : framesBetween(returned - Math.floor(rows / 12), returned, 9);
  const field = small ? {W: width, H: rows, val: new Int8Array(width * rows)} : null;
  const marks = field && new Uint8Array(field.val.length);
  const queue = field && new Int32Array(field.val.length);
  let reference;

  function render(frame) {
    if (small) {
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < width; col++) field.val[row * width + col] = model.cell(row, col);
      }
      if (frame) colourCentralAxes({field, route: () => [frame % 2, 0, ...model.centers]}, marks, queue);
      paint(field.val, width, rows, scale, pixels, colours, band, marks);
    } else paintOverview(model, pixels, block, band, colours, density);
    const isContact = frame >= start && (frame - start) % contactEvery === 0;
    if (frame) paintContactContours(pixels, layout, model, isContact);
    const phase = isContact ? 'R' + (1 + (frame - start) / contactEvery) : frame < start ? 'C0' : 'C1';
    paintLabel(pixels, gifWidth, band, textScale, rows + 'X' + width + ' F' + frame + ' ' + phase, colours[2]);
    animation.add(pixels, isContact ? 90 : small ? 7 : 13);
  }

  for (const frame of early) {
    while (model.frame < frame) model.advance();
    if (frame === start) reference = model.snapshot();
    if (atlasFrames.has(frame)) collector.add(model);
    if (gifFrames.has(frame)) render(frame);
  }
  if (!small) {
    model.skipToReturn(reference, period);
    while (model.frame > tail[0]) model.retreat();
  }
  for (const frame of tail) {
    while (model.frame < frame) model.advance();
    render(frame);
  }
  const present = model.snapshot();
  if (reference.bits.some((value, index) => value !== present.bits[index]) ||
      String([...reference.centers, ...reference.directions]) !== String([...present.centers, ...present.directions])) {
    throw Error('Поле разворота не вернулось у размера ' + rows);
  }
  const file = await writeGif(directory, rows + '.gif', animation, true);
  const {rgb, ...paletteInfo} = palette;
  const frames = [...early.filter(frame => gifFrames.has(frame)), ...tail];
  return {gif: {...file, rows, width, gifWidth, gifHeight, start, period, returned, frames, touches,
    overview: !small, block, palette: paletteInfo}, atlas: collector.write(atlasDirectory)};
}

async function writeContactAnimations(directory = contactDirectory, atlasDirectory = contactAtlasDirectory) {
  mkdirSync(directory, {recursive: true});
  const {sizes} = JSON.parse(readFileSync(join(studyDirectory, 'romb-contact.json'), 'utf8'));
  const result = [];
  for (const size of sizes) {
    const entry = await writeContactSize(directory, atlasDirectory, size);
    result.push(entry);
    console.log(`${entry.gif.rows} · ${entry.gif.frames.length} кадров · ${entry.atlas.figures} фигур`);
  }
  writeFileSync(join(directory, 'index.json'), JSON.stringify(result.map(item => item.gif), null, 2) + '\n');
  writeFileSync(join(atlasDirectory, 'index.json'), JSON.stringify(result.map(item => item.atlas), null, 2) + '\n');
}

if (require.main === module) {
  const mode = process.argv[2];
  const job = mode === '--sizes' ? writeSizeAnimations(process.argv[3])
    : mode === '--contact' ? writeContactAnimations(process.argv[3], process.argv[4])
      : writeGifs(process.argv[2], process.argv[3]).then(files => console.log(JSON.stringify(files, null, 2)));
  job.catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
module.exports = {writeGifs, scheme, framesBetween, paint, paintLabel};
