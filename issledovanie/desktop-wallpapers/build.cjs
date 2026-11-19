'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawn } = require('node:child_process');
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const sharp = require('sharp');
const Scenes = require('../../mayatnik/mayatnik-phone-scenes.js');

const width = 3840;
const height = 2160;
const drawingWidth = 1920;
const drawingHeight = 1080;
const sampleRate = 12;
const fps = 24;
const seconds = 8;
const media = path.join(__dirname, 'media');

const works = [
  {
    id: 'pendulum-duet', title: 'Зеркальный дуэт', group: 'pendulums',
    scene: 'geometric-pendulums-duet', colors: ['#60e9ce', '#ffc98d', '#e4fff2', '#327485'],
    ground: '#071418', halo: '#183b39', placements: [[960, 370, 1360, 338], [960, 710, 1360, 338, 180]],
  },
  {
    id: 'pendulum-counter', title: 'Встречный ход', group: 'pendulums',
    scene: 'geometric-pendulums-counter', colors: ['#899cff', '#fa96c3', '#e0dcff', '#55488a'],
    ground: '#0e1020', halo: '#292452', placements: [[507, 550, 806, 470, -10], [1413, 530, 806, 470, 170]],
  },
  {
    id: 'pendulum-trail', title: 'Восемь кадров следа', group: 'pendulums',
    scene: 'geometric-pendulums-trail', colors: ['#f7c681', '#dc806a', '#fff1bc', '#8e5547'],
    ground: '#1a100d', halo: '#4b2b1c', placements: [[880, 313, 1340, 224], [1070, 540, 1460, 224], [880, 767, 1340, 224]],
  },
  {
    id: 'zerk-growth', title: 'Медный рост', group: 'zerkalius', seed: '11010011011',
    colors: ['#e99564', '#ffbc80', '#ffd9a2', '#ac6554'], ground: '#1a100e', halo: '#49241d',
    placements: [[960, 545, 1100, 870], [277, 632, 378, 310], [1643, 632, 378, 310]],
  },
  {
    id: 'zerk-reflection', title: 'Встречные конусы', group: 'zerkalius', seed: '101100100111011',
    colors: ['#64bdab', '#85e6c8', '#c3ffe0', '#659c9b'], ground: '#041619', halo: '#144246',
    placements: [[547, 515, 945, 820, -12], [1373, 565, 945, 820, 168]],
  },
  {
    id: 'zerk-stitch', title: 'Стык отражений', group: 'zerkalius', seed: '11101000100101111',
    colors: ['#759bfd', '#b4befb', '#e5ddff', '#7d68b7'], ground: '#0e1124', halo: '#232a56',
    placements: [[415, 600, 731, 690, -10], [960, 481, 776, 690, 180], [1505, 600, 731, 690, 10]],
  },
  {
    id: 'rhomb-aurora', title: 'Полярный свет', group: 'rhombi',
    scene: 'geometric-rhombi-aurora', colors: ['#43b7a6', '#74e4d0', '#b3ffe9', '#5289a4'],
    ground: '#03151c', halo: '#154b50', placements: [[960, 540, 810, 478], [370, 540, 488, 289], [1550, 540, 488, 289]],
  },
  {
    id: 'rhomb-mosaic', title: 'Плитка XOR', group: 'rhombi',
    scene: 'geometric-rhombi-mosaic', colors: ['#c991ff', '#f2a6e9', '#ead5ff', '#917ed0'],
    ground: '#100e1e', halo: '#342553', placements: [[960, 540, 728, 447], [377, 387, 650, 405], [1543, 693, 650, 405]],
  },
  {
    id: 'rhomb-axes', title: 'Две оси', group: 'rhombi',
    scene: 'geometric-rhombi-axes', colors: ['#61bfdc', '#82e0ff', '#d9f6fd', '#9c92fa'],
    ground: '#071321', halo: '#153459', placements: [[960, 540, 899, 452], [503, 540, 666, 334, 90], [1417, 540, 666, 334, 90]],
  },
];

function reflectedRows(seed) {
  const rows = [seed];
  const height = 52;
  const travel = 18;
  while (rows.length < height + travel) {
    const padded = '0' + rows.at(-1) + '0';
    const next = Array.from({ length: padded.length - 1 }, (_, i) => Number(padded[i] !== padded[i + 1]));
    rows.push(next.join(''));
  }
  return {
    travel,
    frame(k) {
      const width = rows.at(-1).length;
      const values = new Uint8Array(width * height);
      const window = rows.slice(k, k + height);
      const offsets = window.map(row => (width - row.length) / 2);
      window.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) values[y * width + x] = Number(row[x]);
      });
      return { values, width, height, offsets };
    },
  };
}

function makeModel(work) {
  if (work.seed) return reflectedRows(work.seed);
  const scene = Scenes.create(work.scene);
  const start = work.group === 'rhombi' ? scene.baseFrame - 8 : scene.baseFrame;
  return { travel: 18, frame: offset => scene.frame(start + offset) };
}

const fixed = number => Number(number.toFixed(2));
const paths = (groups, colors) => groups.map((parts, index) =>
  parts.length ? '<path fill="' + colors[index] + '" d="' + parts.join('') + '"/>' : '').join('');

function cellPaths(field, work) {
  const { width, height, values, a, b, age, offsets } = field;
  const rows = Array.from({ length: work.colors.length }, () => []);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x;
      if (values[index] !== 1) continue;
      const column = fixed(x + (offsets?.[y] ?? 0) + 0.5 - width / 2);
      const row = fixed(y + 0.5 - height / 2);
      if (work.group === 'pendulums') {
        const color = age[index] ? 3 : a[index] ? (b[index] ? 2 : 0) : 1;
        rows[color].push('M' + fixed(column - .41) + ' ' + fixed(row - .39) + 'h.82v.78h-.82z');
      } else {
        const color = Math.min(3, Math.floor(4 * y / height));
        const cellY = work.group === 'rhombi' ? fixed(height - y - .5) : row;
        rows[color].push('M' + column + ' ' + fixed(cellY - .47) + 'l.46 .47 -.46 .47 -.46 -.47z');
      }
    }
  }
  return paths(rows, work.colors);
}

function place(work, field, angle, drawing) {
  const drift = Math.sin(angle);
  const motif = work.group === 'rhombi'
    ? drawing + '<g transform="scale(1 -1)">' + drawing + '</g>' : drawing;
  return work.placements.map(([x, y, w, h, rotation = 0], index) => {
    const horizontal = (index % 2 ? -1 : 1) * drift * 12;
    const opacity = index === 0 ? 1 : .76 + .12 * Math.cos(angle + index);
    const transform = 'translate(' + fixed(x + horizontal) + ' ' + y + ') rotate(' + rotation +
      ') scale(' + fixed(w / field.width) + ' ' + fixed(h / field.height) + ')';
    return '<g opacity="' + opacity.toFixed(3) + '" transform="' + transform + '">' + motif + '</g>';
  }).join('');
}

function render(work, model, sample) {
  const angle = sample * Math.PI * 2 / (sampleRate * seconds);
  const offset = Math.round((1 - Math.cos(angle)) * model.travel / 2);
  const field = model.frame(offset);
  const focal = fixed(50 + Math.sin(angle) * 4);
  const marks = place(work, field, angle, cellPaths(field, work));
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height +
    '" viewBox="0 0 ' + drawingWidth + ' ' + drawingHeight + '">' +
    '<defs><radialGradient id="glow" cx="' + focal + '%" cy="51%" r="65%"><stop stop-color="' + work.halo +
    '"/><stop offset="1" stop-color="' + work.ground + '"/></radialGradient>' +
    '<pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">' +
    '<path d="M0 48V0H48" stroke="' + work.colors[0] + '" stroke-opacity=".105" fill="none"/>' +
    '<circle cx="0" cy="0" r="1.65" fill="' + work.colors[0] + '" opacity=".3"/></pattern></defs>' +
    '<rect width="100%" height="100%" fill="url(#glow)"/><rect width="100%" height="100%" fill="url(#grid)"/>' +
    '<path d="M80 540H1840M960 86V994" stroke="' + work.colors[0] + '" stroke-opacity=".24" stroke-dasharray="4 9"/>' +
    marks + '</svg>';
}

async function fileRecord(name) {
  const bytes = await fs.readFile(path.join(media, name));
  return { path: 'media/' + name, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
}

async function encode(work, model, file) {
  const pending = path.join(media, work.id + '.part.mp4');
  const encoder = spawn('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(sampleRate),
    '-vcodec', 'png', '-i', 'pipe:0', '-r', String(fps), '-an', '-c:v', 'libx264', '-threads', '4',
    '-preset', 'veryfast', '-crf', '22', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', pending,
  ], { stdio: ['pipe', 'ignore', 'pipe'], windowsHide: true });
  let stderr = '';
  encoder.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-6000); });
  const finished = new Promise((resolve, reject) => {
    encoder.once('error', reject);
    encoder.once('close', code => code === 0 ? resolve() : reject(Error('FFmpeg ' + code + ': ' + stderr)));
  });
  async function* frames() {
    for (let sample = 0; sample < sampleRate * seconds; sample++) {
      yield await sharp(Buffer.from(render(work, model, sample))).png({ compressionLevel: 1 }).toBuffer();
    }
  }
  try {
    await Promise.all([finished, pipeline(Readable.from(frames()), encoder.stdin)]);
    await fs.rename(pending, path.join(media, file));
  } catch (error) {
    encoder.kill();
    await finished.catch(() => {});
    await fs.rm(pending, { force: true });
    throw Error(work.id + ': ' + (stderr || error.message), { cause: error });
  }
}

async function build() {
  await fs.mkdir(media, { recursive: true });
  const manifestFile = path.join(__dirname, 'manifest.json');
  const engineNames = ['mayatnik-phone-scenes.js', 'mayatnik-phone-catalog.js', 'mayatnik-synthesis-pendulums.js'];
  const engineHashes = await Promise.all(engineNames.map(async name => [
    name, createHash('sha256').update(await fs.readFile(path.join(__dirname, '../../mayatnik', name))).digest('hex'),
  ]));
  const sources = Object.fromEntries(engineHashes);
  const fingerprint = createHash('sha256').update(await fs.readFile(__filename)).update(JSON.stringify(sources)).digest('hex');
  let previous;
  try { previous = JSON.parse(await fs.readFile(manifestFile, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const saved = process.argv.includes('--resume') && previous?.fingerprint === fingerprint ? previous.items : [];
  const manifest = { version: '0.001', width, height, fps, sampleRate, seconds, audio: false, fingerprint, sources, items: [] };
  for (const work of works) {
    const video = work.id + '.mp4', image = work.id + '.png', preview = work.id + '.webp';
    const before = saved.find(item => item.id === work.id);
    if (before && (await Promise.all([video, image, preview].map(fileRecord).map(promise => promise.catch(() => null))))
      .every((record, index) => record?.sha256 === [before.video, before.image, before.preview][index].sha256)) {
      manifest.items.push(before);
      console.log('Kept ' + work.id);
      continue;
    }
    const model = makeModel(work);
    const still = Buffer.from(render(work, model, 0));
    await sharp(still).png({ compressionLevel: 6 }).toFile(path.join(media, image));
    await sharp(still).resize(768, 432).webp({ quality: 85 }).toFile(path.join(media, preview));
    await encode(work, model, video);
    const item = {
      id: work.id, title: work.title, group: work.group,
      source: work.scene ? { recipe: work.scene } : { recipe: 'xor-pascal-zero-padded', seed: work.seed },
      video: await fileRecord(video), image: await fileRecord(image), preview: await fileRecord(preview),
    };
    manifest.items.push(item);
    await fs.writeFile(manifestFile, JSON.stringify(manifest, null, 2) + '\n');
    console.log('Produced ' + work.id + ' · ' + (item.video.bytes / 1048576).toFixed(2) + ' MiB · ' +
      manifest.items.length + '/' + works.length);
  }
}

build().catch(error => { console.error(error); process.exitCode = 1; });
