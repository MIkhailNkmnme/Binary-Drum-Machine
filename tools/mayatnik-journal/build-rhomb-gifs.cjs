'use strict';

const { mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
const { encoder } = require('../../mayatnik/mayatnik-gif.js');
const { createModel } = require('./analyze-rhomb-period.cjs');
const { colourCentralAxes } = require('./build-rhomb-atlas.cjs');

const studyDirectory = join(__dirname, '../../issledovanie/wolfram-nks');
const defaultDirectory = join(studyDirectory, 'romb-gifs/diamonds');
const defaultAxesDirectory = join(studyDirectory, 'romb-gifs/axes');
const colours = {
  8: ['янтарная', '4e350f', 'ffcd72'],
  16: ['изумрудная', '144f42', '9af4c7'],
  32: ['сиреневая', '4b3477', 'ddc1ff'],
  64: ['голубая', '21627e', 'bdebf8'],
  128: ['коралловая', '813c4b', 'ffb8b0']
};
const loopExtension = Buffer.concat([Buffer.from([33, 255, 11]), Buffer.from('NETSCAPE2.0'), Buffer.from([3, 1, 0, 0, 0])]);
const glyphs = {
  '0': '111101101101111', '1': '010110010010111', '2': '111001111100111',
  '3': '111001111001111', '4': '101101111001001', '5': '111100111001111',
  '6': '111100111101111', '7': '111001010010010', '8': '111101111101111',
  '9': '111101111001111', 'X': '101101010101101', 'F': '111100110100100',
  'C': '111100100100111', ' ': '000000000000000'
};

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

if (require.main === module) {
  writeGifs(process.argv[2], process.argv[3]).then(files => console.log(JSON.stringify(files, null, 2))).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
module.exports = {writeGifs};
