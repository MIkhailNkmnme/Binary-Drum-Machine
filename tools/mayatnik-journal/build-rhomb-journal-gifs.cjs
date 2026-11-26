'use strict';

const { createHash } = require('node:crypto');
const { mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
const sharp = require('sharp');
const { createPackedRhomb } = require('./rhomb-packed.cjs');
const { colourCentralAxes } = require('./build-rhomb-atlas.cjs');
const { groups, palettes, fieldView, pairView, coinView, squareView } = require('./build-rhomb-collection.cjs');

const root = join(__dirname, '../..');
const pagesOnly = process.argv[2] === '--page';
const output = (pagesOnly ? undefined : process.argv[2]) ??
  join(root, 'issledovanie/image-journal/rhomb-collection/gifs');
const {series} = JSON.parse(readFileSync(join(root, 'issledovanie/desktop-wallpapers/rhomb-1024/recipes.json'), 'utf8'));
const rows = 512;
const step = 4;
const poseCount = 16;
const keyDelay = 6300;
const regularDelay = 2580;
const duration = 180000;
const renderers = {field: fieldView, pair: pairView, coin: coinView, hub: pairView};
const colours = new Map(palettes.map(palette => [palette.id, palette]));

function startField(item) {
  const packed = createPackedRhomb(rows, {
    widthFactor: item.widthFactor, bounce: item.edge === 'bounce',
    reverseAtContact: item.edge === 'reverse', and: item.accumulation === 'and',
  });
  const field = {W: packed.width, H: rows, val: new Int8Array(rows * packed.width)};
  const marks = item.axes ? new Uint8Array(field.val.length) : null;
  const queue = marks && new Int32Array(marks.length);
  const model = {field, route: () => [0, 0, ...packed.centers]};
  return frame => {
    while (packed.frame < frame) packed.advance();
    for (let y = 0; y < rows; y++) {
      const start = y * field.W;
      for (let x = 0; x < field.W; x++) field.val[start + x] = packed.cell(y, x);
    }
    if (marks) colourCentralAxes(model, marks, queue);
    const view = renderers[item.view](model, item, marks);
    return item.square ? squareView(view, 1) : view;
  };
}

function bright(value) {
  return value > 0 && value <= 8 && (value & 1) === 0;
}

function symmetry({width, height, pixels}) {
  let left = width, right = -1, top = height, bottom = -1, cells = 0;
  for (let y = 0; y < height; y++) {
    const offset = y * width;
    for (let x = 0; x < width; x++) {
      if (!bright(pixels[offset + x])) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
      cells++;
    }
  }
  if (cells < 2) return {symmetry: 0, cells, axis: ''};
  let vertical = 0, horizontal = 0;
  for (let y = top; y <= bottom; y++) {
    const row = y * width;
    const opposite = (bottom + top - y) * width;
    for (let x = left; x <= right; x++) {
      if (!bright(pixels[row + x])) continue;
      vertical += Number(bright(pixels[row + left + right - x]));
      horizontal += Number(bright(pixels[opposite + x]));
    }
  }
  const axis = vertical >= horizontal ? 'vertical' : 'horizontal';
  return {symmetry: Math.max(vertical, horizontal) / cells, cells, axis};
}

function chooseKeys(item) {
  const lookup = startField(item);
  const early = [1, 2, 4, 6, 8, 12, 16, 24, 32, 48];
  const windows = [0, 2, 5, 8].map(index => {
    const from = item.images[index];
    const center = Math.max(step, Math.round(from.frame * rows / item.rows / step) * step);
    const candidates = Array.from({length: 9}, (_, i) => center + (i - 4) * 2 * step)
      .filter(frame => frame >= step);
    return {from, center, candidates};
  });
  const comparisons = new Map();
  const candidates = new Set([...early, ...windows.flatMap(window => window.candidates)]);
  for (const candidate of [...candidates].sort((a, b) => a - b)) {
    comparisons.set(candidate, symmetry(lookup(candidate)));
  }

  const used = new Set();
  const keys = windows.map(({from, center, candidates}) => {
    const eligible = candidates.filter(frame => !used.has(frame));
    eligible.sort((a, b) => {
      const first = comparisons.get(a), second = comparisons.get(b);
      return Number(second.cells >= 16) - Number(first.cells >= 16) ||
        second.symmetry - first.symmetry || Math.abs(a - center) - Math.abs(b - center);
    });
    const frame = eligible[0];
    if (frame === undefined) throw Error('Нет разных опорных кадров для ' + item.id);
    used.add(frame);
    const {symmetry: score, axis, cells} = comparisons.get(frame);
    return {frame, sourceFrame: from.frame, palette: from.palette, symmetry: Math.round(score * 100), axis, cells};
  });

  const strongest = Math.max(...keys.map(key => key.symmetry));
  if (strongest < 65) {
    const visible = early.filter(frame => !used.has(frame) && comparisons.get(frame).cells >= 16);
    visible.sort((a, b) => comparisons.get(b).symmetry - comparisons.get(a).symmetry);
    const frame = visible[0];
    if (frame !== undefined) {
      const {symmetry: score, axis, cells} = comparisons.get(frame);
      const percent = Math.round(score * 100);
      if (percent > strongest) {
        keys[0] = {frame, sourceFrame: null, palette: keys[0].palette, symmetry: percent, axis, cells};
      }
    }
  }
  return keys.sort((a, b) => a.frame - b.frame);
}

function planPoses(keys) {
  return keys.flatMap((key, phase) => {
    const first = Math.max((key.frame - 1) % step + 1, key.frame - 4 * step);
    return Array.from({length: poseCount}, (_, i) => {
      const frame = first + i * step;
      return {frame, key: key.frame, phase, palette: key.palette, delay: frame === key.frame ? keyDelay : regularDelay};
    });
  });
}

function paint(view, palette, target) {
  const table = new Uint32Array(256);
  for (let i = 0; i < palette.length; i += 3) {
    table[i / 3] = palette[i] | (palette[i + 1] << 8) | (palette[i + 2] << 16) | 0xff000000;
  }
  const dest = new Uint32Array(target.buffer, target.byteOffset, target.length / 4);
  for (let i = 0; i < dest.length; i++) dest[i] = table[view.pixels[i]];
}

async function build(item) {
  const keys = chooseKeys(item);
  const poses = planPoses(keys);
  const captures = new Map();
  poses.forEach((pose, i) => {
    const matches = captures.get(pose.frame) ?? [];
    matches.push(i);
    captures.set(pose.frame, matches);
  });
  const timeline = [...captures.keys()].sort((a, b) => a - b);
  const lookup = startField(item);
  const first = lookup(timeline[0]);
  const {width, height} = first;
  const stride = width * height * 4;
  const strip = Buffer.allocUnsafe(stride * poses.length);
  for (const frame of timeline) {
    const view = frame === timeline[0] ? first : lookup(frame);
    for (const slot of captures.get(frame)) {
      const palette = colours.get(poses[slot].palette);
      paint(view, palette.png, strip.subarray(slot * stride, (slot + 1) * stride));
    }
  }

  const gif = await sharp(strip, {raw: {width, height: height * poses.length, channels: 4, pageHeight: height}})
    .gif({delay: poses.map(pose => pose.delay), loop: 1, colours: 32, dither: 0, effort: 2,
      interFrameMaxError: 0, interPaletteMaxError: 0, keepDuplicateFrames: true})
    .toBuffer();
  const metadata = await sharp(gif, {animated: true}).metadata();
  if (metadata.pages !== poses.length || metadata.delay?.reduce((n, ms) => n + ms, 0) !== duration ||
      metadata.pageHeight !== height || metadata.width !== width || Math.min(width, height) < rows - 1) {
    throw Error('Файл GIF не совпадает с рецептом ' + item.id + ' · ' + JSON.stringify(metadata));
  }
  const strongest = keys.reduce((best, key) => key.symmetry > best.symmetry ? key : best);
  const still = poses.findIndex(pose => pose.frame === strongest.frame && pose.palette === strongest.palette);
  const file = item.id + '.gif';
  const preview = item.id + '.webp';
  writeFileSync(join(output, file), gif);
  await sharp(strip.subarray(still * stride, (still + 1) * stride), {raw: {width, height, channels: 4}})
    .resize({width: 640, height: 420, fit: 'inside', withoutEnlargement: true})
    .webp({quality: 85}).toFile(join(output, preview));
  console.log(item.id, metadata.pages, width + '×' + height, (gif.length / 1048576).toFixed(1) + ' МиБ');
  return {id: item.id, name: item.name, group: item.group, rows, columns: rows * item.widthFactor - 1,
    width, height, duration, step, frames: metadata.pages, keys, file, preview,
    bytes: gif.length, sha256: createHash('sha256').update(gif).digest('hex')};
}

async function main() {
  const manifest = join(output, 'index.json');
  if (pagesOnly) {
    writeFileSync(join(output, '../gifs.html'), html(JSON.parse(readFileSync(manifest, 'utf8')).items));
    return;
  }
  mkdirSync(output, {recursive: true});
  const items = [];
  for (const item of series) items.push(await build(item));
  writeFileSync(manifest, JSON.stringify({
    source: '../../../desktop-wallpapers/rhomb-1024/recipes.json', duration, rows, items
  }, null, 2) + '\n');
  writeFileSync(join(output, '../gifs.html'), html(items));
}

function galleryCard(item) {
  const best = item.keys.reduce((first, key) => key.symmetry > first.symmetry ? key : first);
  const original = best.sourceFrame === null
    ? `<a href="wallpapers.html#${item.id}">Серия на 1024 строки</a>`
    : `<a href="frame.html?series=${item.id}&amp;palette=${best.palette}&amp;edition=1024">Исходный кадр ${best.sourceFrame}</a>`;
  const axis = best.axis === 'vertical' ? 'вертикальной' : 'горизонтальной';
  const metrics = best.axis ? ` · ${best.symmetry} % совпадений по ${axis} оси` : '';
  return `        <figure id="${item.id}">
          <a class="image-link" href="gifs/${item.file}" aria-label="Открыть GIF «${item.name}»"><img src="gifs/${item.preview}" alt="${item.name} · опорный кадр ${best.frame}" loading="lazy" decoding="async"></a>
          <figcaption>
            <span class="figure-name">${item.name}</span>
            <p class="rhomb-settings">Кадры ${item.keys.map(key => key.frame).join(', ')}${metrics}</p>
            <span class="figure-links"><a href="gifs/${item.file}">Смотреть GIF</a><a href="gifs/${item.file}" download>Скачать GIF</a>${original}</span>
          </figcaption>
        </figure>`;
}

function html(items) {
  return `<!doctype html>
<!-- Собрано tools/mayatnik-journal/build-rhomb-journal-gifs.cjs. -->
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#101317">
  <meta name="description" content="Ромбовые GIF для Журнала картинок. По три минуты на вид, поля на 512 строк.">
  <title>Ромбовые GIF · Журнал картинок</title>
  <link rel="stylesheet" href="../style.css?v=017">
  <link rel="stylesheet" href="style.css?v=002">
</head>
<body>
  <a class="skip" href="#rombs">К анимациям</a>
  <header class="site-bar">
    <nav class="site-nav shell" aria-label="Разделы сайта">
      <a class="brand" href="../#rhomb-collection">Журнал картинок</a>
      <div class="site-links"><a href="./">Цветные кадры</a><a href="wallpapers.html">Кадры на 1024 строки</a></div>
    </nav>
  </header>
  <main id="rombs" class="shell">
    <header class="rhomb-intro">
      <p class="entry-meta">${items.length} GIF · 3:00 каждая · 512 строк</p>
      <h1>Ромбовые GIF</h1>
      <p>Для каждого вида выбраны четыре опорных кадра. Если в ранней фазе отражение заметнее, она тоже включена. Соседние состояния идут с шагом 4. В подписях указана доля единиц, совпавших при отражении лучшего опорного кадра.</p>
      <nav class="contents" aria-label="Группы анимаций">
        ${groups.map(([id, label]) => `<a href="#${id}">${label}</a>`).join('\n        ')}
      </nav>
    </header>
${groups.map(([id, label]) => `    <section class="entry" id="${id}" aria-labelledby="${id}-title">
      <header class="entry-heading"><h2 id="${id}-title">${label}</h2></header>
      <div class="figures rhomb-gif-grid">
${items.filter(item => item.group === id).map(galleryCard).join('\n')}
      </div>
    </section>`).join('\n')}
    <footer class="entry"><a href="gifs/index.json">Параметры и длительности GIF (JSON)</a> · <a href="#rombs">К началу</a></footer>
  </main>
</body>
</html>
`;
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
