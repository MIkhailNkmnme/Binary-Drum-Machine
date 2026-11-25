'use strict';

const { mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
const { encoder } = require('../../mayatnik/mayatnik-gif.js');
const { createModel } = require('./analyze-rhomb-period.cjs');

const studyDirectory = join(__dirname, '../../issledovanie/wolfram-nks');
const defaultDirectory = join(studyDirectory, 'romb-gifs');
const colours = {
  8: ['янтарная', '4e350f', 'ffcd72'],
  16: ['изумрудная', '144f42', '9af4c7'],
  32: ['сиреневая', '4b3477', 'ddc1ff'],
  64: ['голубая', '21627e', 'bdebf8'],
  128: ['коралловая', '813c4b', 'ffb8b0']
};
const loopExtension = Buffer.concat([Buffer.from([33, 255, 11]), Buffer.from('NETSCAPE2.0'), Buffer.from([3, 1, 0, 0, 0])]);

function paint(values, width, height, scale, pixels, palette) {
  const outputWidth = width * scale;
  for (let y = 0; y < height * scale; y++) {
    const row = Math.floor(y / scale) * width;
    for (let x = 0; x < outputWidth; x++) {
      const colour = palette[values[row + Math.floor(x / scale)] + 1];
      const i = (y * outputWidth + x) * 4;
      pixels[i] = colour[0];
      pixels[i + 1] = colour[1];
      pixels[i + 2] = colour[2];
      pixels[i + 3] = 255;
    }
  }
}

async function writeGif(directory, name, animation, loop) {
  const bytes = Buffer.from(await animation.finish().arrayBuffer());
  const extension = bytes.indexOf(loopExtension);
  if (extension !== 13) throw Error('Не найден ожидаемый блок повтора GIF.');
  const output = loop ? bytes : Buffer.concat([bytes.subarray(0, extension), bytes.subarray(extension + loopExtension.length)]);
  writeFileSync(join(directory, name), output);
  return {file: name, bytes: output.length};
}

async function buildSize(directory, size) {
  const {rows, width, firstFullFrame, period} = size;
  const [colourName, zero, one] = colours[rows];
  const palette = ['0b1620', zero, one].map(hex => Buffer.from(hex, 'hex'));
  const scale = Math.max(1, Math.floor(96 / rows));
  const gifWidth = width * scale, gifHeight = rows * scale;
  const pixels = new Uint8Array(gifWidth * gifHeight * 4);
  const intro = encoder(gifWidth, gifHeight, {mergeEqual: false});
  const loop = encoder(gifWidth, gifHeight, {mergeEqual: false});
  const simulation = createModel(rows, width, true);
  const samples = Math.min(240, period);
  const loopFrames = Array.from({length: samples}, (_, i) =>
    firstFullFrame + Math.round(i * (period - 1) / (samples - 1)));
  const loopSelection = new Set(loopFrames);
  let reference, phase;

  for (let frame = 0; frame < firstFullFrame + period; frame++) {
    const isIntro = frame <= firstFullFrame;
    const isLoop = loopSelection.has(frame);
    if (isIntro || isLoop) paint(simulation.val, width, rows, scale, pixels, palette);
    if (isIntro) intro.add(pixels, frame === firstFullFrame ? 50 : 6);
    if (isLoop) loop.add(pixels, 7);
    if (frame === firstFullFrame) {
      reference = Buffer.from(simulation.val);
      phase = simulation.phase();
    }
    simulation.advance();
  }
  if (!Buffer.from(simulation.val).equals(reference) || phase !== simulation.phase()) {
    throw Error('Не подтверждён цикл GIF для размера ' + rows);
  }
  const before = await writeGif(directory, rows + '-before.gif', intro, false);
  const cycle = await writeGif(directory, rows + '-cycle.gif', loop, true);
  return {
    rows, width, period, gifWidth, gifHeight, palette: {name: colourName, zero: '#' + zero, one: '#' + one},
    before: {...before, from: 0, to: firstFullFrame, frames: firstFullFrame + 1},
    cycle: {...cycle, from: firstFullFrame, to: firstFullFrame + period - 1, frames: loopFrames}
  };
}

async function writeGifs(directory = defaultDirectory) {
  mkdirSync(directory, {recursive: true});
  const periods = JSON.parse(readFileSync(join(studyDirectory, 'romb-period.json'), 'utf8')).sizes;
  const files = [];
  for (const size of periods.filter(item => item.factor === 2 && item.edge === 'wrap')) {
    files.push(await buildSize(directory, size));
  }
  writeFileSync(join(directory, 'index.json'), JSON.stringify(files, null, 2) + '\n');
  return files.map(({rows, before, cycle}) => ({rows, introFrames: before.frames, cycleFrames: cycle.frames.length,
    bytes: before.bytes + cycle.bytes}));
}

if (require.main === module) {
  writeGifs(process.argv[2]).then(files => console.log(JSON.stringify(files, null, 2))).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
module.exports = {writeGifs};
