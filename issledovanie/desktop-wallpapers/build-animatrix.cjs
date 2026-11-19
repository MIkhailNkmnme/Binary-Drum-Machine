'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const sharp = require('sharp');
const Source = require('../../mayatnik/mayatnik-animatrix-source.js');

const width = 3840;
const height = 2160;
const rows = 128;
const algorithm = 'codeWave';
const expectedCounts = new Map([[173, 5278], [174, 2656], [175, 3690], [176, 1874]]);
const palettes = [
  { frame: 173, name: 'Лазурь', ground: '#050a15', stops: ['#dbf8ff', '#31e3e8', '#5575ff'] },
  { frame: 174, name: 'Янтарь', ground: '#10090a', stops: ['#fff4be', '#ffb449', '#e86365'] },
  { frame: 175, name: 'Аметист', ground: '#0e091b', stops: ['#f4e2ff', '#bb78fd', '#7468fb'] },
  { frame: 176, name: 'Полярное сияние', ground: '#041415', stops: ['#e3ffad', '#63eab3', '#42cfea'] },
];

function colorRamp(stops) {
  const rgb = stops.map(stop => Buffer.from(stop.slice(1), 'hex'));
  return Array.from({ length: 41 }, (_, index) => {
    const step = Math.min(1, Math.floor(index / 20));
    const blend = (index - step * 20) / 20;
    return '#' + Buffer.from(rgb[step].map((value, channel) =>
      Math.round(value + (rgb[step + 1][channel] - value) * blend))).toString('hex');
  });
}

function design(engine, palette) {
  const { bits, present } = engine;
  const cell = Math.floor(Math.min((width - 360) / engine.width, (height - 320) / engine.height));
  const left = Math.floor((width - engine.width * cell) / 2);
  const top = Math.floor((height - engine.height * cell) / 2);
  const half = Math.ceil(cell / 2);
  const colors = colorRamp(palette.stops);
  const groups = colors.map(() => []);
  let ones = 0;
  for (let y = 0; y < engine.height; y++) {
    for (let x = 0; x < engine.width; x++) {
      const index = y * engine.width + x;
      if (!present[index] || bits[index] !== 1) continue;
      const px = left + cell * x + half;
      const py = top + cell * y;
      const color = Math.round((0.85 * y / (engine.height - 1) + 0.15 * x / (engine.width - 1)) * (colors.length - 1));
      groups[color].push('M' + px + ' ' + py + 'l' + half + ' ' + half + ' -' + half + ' ' + half + ' -' + half + ' -' + half + 'z');
      ones++;
    }
  }
  const marks = groups.map((pieces, index) => pieces.length
    ? '<path fill="' + colors[index] + '" d="' + pieces.join('') + '"/>' : '').join('');
  return { ones, svg: '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height +
    '"><rect width="100%" height="100%" fill="' + palette.ground + '"/>' + marks + '</svg>' };
}

function hash(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function save(bytes, name) {
  const file = 'media/' + name;
  await fs.writeFile(path.join(__dirname, file), bytes);
  return { path: file, bytes: bytes.length, sha256: hash(bytes) };
}

async function main() {
  await fs.mkdir(path.join(__dirname, 'media'), { recursive: true });
  const source = { rows, type: 'clean', algorithm, timing: 'matrix', direction: 'down', cycles: 2, unit: 'pass' };
  const engine = Source.create({
    ...Source.defaults(), rows, animatrixOn: true,
    animatrixSource: Source.demo(rows, source.type, algorithm),
    animatrixAlgorithm: algorithm, animatrixTiming: source.timing, animatrixDirection: source.direction,
    animatrixCycles: source.cycles,
  });
  const items = [];
  for (const palette of palettes) {
    Source.advance(engine, palette.frame - engine.sourceFrame);
    if (engine.sourceFrame !== palette.frame) throw Error('Frame unavailable: ' + palette.frame);
    const { svg, ones } = design(engine, palette);
    const expected = expectedCounts.get(palette.frame);
    if (ones !== expected) throw Error('Unexpected number of units at pass ' + palette.frame + ': ' + ones);
    const drawing = sharp(Buffer.from(svg));
    const image = await drawing.png().toBuffer();
    const preview = await drawing.clone().resize(768, 432).webp({ quality: 86 }).toBuffer();
    const stem = 'animatrix-' + palette.frame;
    items.push({
      ...palette, ones, fieldSha256: hash(Buffer.concat([engine.present, engine.bits])),
      image: await save(image, stem + '.png'), preview: await save(preview, stem + '.webp'),
    });
  }
  const manifest = { version: '0.003', width, height, source, items };
  await fs.writeFile(path.join(__dirname, 'animatrix.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log('Exported passes ' + items.map(({frame, ones}) => frame + ': ' + ones).join(', '));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
