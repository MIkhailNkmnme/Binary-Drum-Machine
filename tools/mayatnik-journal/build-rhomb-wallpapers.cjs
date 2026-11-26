'use strict';

const { createHash } = require('node:crypto');
const { mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
const { deflateSync } = require('node:zlib');
const sharp = require('sharp');
const { createModel, pngChunk } = require('./analyze-rhomb-period.cjs');
const { colourCentralAxes } = require('./build-rhomb-atlas.cjs');
const { createPackedRhomb } = require('./rhomb-packed.cjs');
const core = require('../../mayatnik/mayatnik-core.js');
const edgeFlow = require('../../mayatnik/mayatnik-edge-flow.js');

const root = join(__dirname, '../..');
const output = process.argv[2] ?? join(root, 'issledovanie/desktop-wallpapers/rhomb-1024');
const sourceRecipes = join(root, 'issledovanie/image-journal/rhomb-collection/recipes.json');
const rows = 1024;
const width = 3840;
const height = 2160;
const stride = width + 1;
const centerX = Math.round(width * 0.526);
const centerY = height / 2;
const shadeCount = 24;
const maxArtworkWidth = Math.floor(width * 0.91);
const maxArtworkHeight = Math.floor(height * 0.86);

// Share the journal's pixel classifications and palette with the wallpaper render.
const source = readFileSync(join(__dirname, 'build-rhomb-collection.cjs'), 'utf8');
const start = source.indexOf('const paletteDefinitions = ');
const end = source.indexOf('function writeImage(', start);
if (start < 0 || end < 0) throw Error('Не найдены функции раскраски журнальной коллекции.');
const { groups, palettes, fieldView, pairView, coinView, squareView, mix } =
  Function(source.slice(start, end) + '\nreturn {groups, palettes, fieldView, pairView, coinView, squareView, mix};')();

// Keep the exact app model in this realm for the larger fields.
const createExactModel = Function('MAYATNIK', 'MayatnikEdgeFlow', 'return (' + createModel.toString() + ');')(core, edgeFlow);
const sourceData = JSON.parse(readFileSync(sourceRecipes, 'utf8'));

function wallpaperPalette(palette) {
  const background = Buffer.from(palette.colors[0], 'hex');
  const tone = Buffer.from(palette.colors[2], 'hex');
  const shades = Array.from({length: shadeCount}, (_, index) =>
    mix(background, tone, 0.085 * index / (shadeCount - 1)));
  return Buffer.concat([palette.png, ...shades]);
}

function makeBackdrop(firstShade) {
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const dy = (y - centerY) / (height * .7);
    const row = y * stride + 1;
    for (let x = 0; x < width; x++) {
      const dx = (x - centerX) / (width * .52);
      const intensity = Math.max(0, 1 - dx * dx - dy * dy);
      raw[row + x] = firstShade + Math.round(intensity * intensity * (shadeCount - 1));
    }
  }
  return raw;
}

function squareArtwork(view) {
  const rotated = squareView(view, 1);
  const {width: w, height: h, pixels} = rotated;
  let left = w, top = h, right = -1, bottom = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!pixels[y * w + x]) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  if (right < left) throw Error('Пустая квадратная проекция.');
  const resultWidth = right - left + 1, resultHeight = bottom - top + 1;
  const result = Buffer.alloc(resultWidth * resultHeight);
  for (let y = 0; y < resultHeight; y++) {
    const from = (top + y) * w + left;
    pixels.copy(result, y * resultWidth, from, from + resultWidth);
  }
  return {width: resultWidth, height: resultHeight, pixels: result};
}

function wallpaper(view, palette, backdrop) {
  const scale = Math.min(maxArtworkWidth / view.width, maxArtworkHeight / view.height);
  const artworkWidth = Math.round(view.width * scale);
  const artworkHeight = Math.round(view.height * scale);
  const left = centerX - Math.floor(artworkWidth / 2);
  const top = centerY - Math.floor(artworkHeight / 2);
  const xs = Int32Array.from({length: artworkWidth}, (_, x) => Math.floor((x + 0.5) * view.width / artworkWidth));
  const raw = Buffer.from(backdrop);
  for (let y = 0; y < artworkHeight; y++) {
    const sourceRow = Math.floor((y + 0.5) * view.height / artworkHeight) * view.width;
    const dest = (top + y) * stride + left + 1;
    for (let x = 0; x < artworkWidth; x++) {
      const index = view.pixels[sourceRow + xs[x]];
      if (index) raw[dest + x] = index;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 3;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header), pngChunk('PLTE', palette),
    pngChunk('IDAT', deflateSync(raw, {level: 6})), pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function buildSimulation(item) {
  if (item.widthFactor === 2 && item.accumulation === 'xor' && item.edge !== 'bounce') {
    const packed = createPackedRhomb(rows, {reverseAtContact: item.edge === 'reverse'});
    const {width: columns} = packed;
    const field = {W: columns, H: rows, val: new Int8Array(columns * rows)};
    return {
      advance: () => packed.advance(),
      snapshot() {
        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < columns; x++) field.val[y * columns + x] = packed.cell(y, x);
        }
        return {field, route: () => [0, 0, ...packed.centers]};
      },
    };
  }
  const model = createExactModel(rows, item.width, item.edge === 'wrap', item.edge === 'reverse');
  const and = item.accumulation === 'and';
  return {advance: () => model.advanceFrame(and), snapshot: () => model};
}

const renderers = {field: fieldView, pair: pairView, coin: coinView, hub: pairView};

function groupTasks() {
  const catalogue = [];
  const simulations = new Map();
  for (const {images, rows: originalRows, ...item} of sourceData.series) {
    const current = {...item, rows, width: item.widthFactor * rows - 1, images: []};
    catalogue.push(current);
    const key = [item.widthFactor, item.edge, item.accumulation].join('/');
    if (!simulations.has(key)) simulations.set(key, new Map());
    const schedule = simulations.get(key);
    images.forEach(({frame, palette}, order) => {
      const scale = rows / originalRows;
      const target = scale === 1 ? frame : frame * scale - (frame % 2);
      const tasks = schedule.get(target) ?? [];
      tasks.push({item: current, order, palette, target});
      schedule.set(target, tasks);
    });
  }
  return {catalogue, simulations};
}

async function buildImages(simulations) {
  const paletteMap = new Map(palettes.map(palette => [palette.id, wallpaperPalette(palette)]));
  const backdrop = makeBackdrop(palettes[0].png.length / 3);
  const seenBySeries = new Map();
  const saved = new Set();
  for (const [key, schedule] of simulations) {
    const first = schedule.values().next().value[0].item;
    const simulation = buildSimulation(first);
    const marks = new Uint8Array(first.width * rows);
    const queue = new Int32Array(marks.length);
    let frame = 0;
    let last = Math.max(...schedule.keys());
    for (let target = Math.min(...schedule.keys()); target <= last; target++) {
      const tasks = schedule.get(target);
      if (!tasks) continue;
      while (frame < target) {
        simulation.advance();
        frame++;
      }
      const snapshot = simulation.snapshot();
      if (tasks.some(({item}) => item.axes)) colourCentralAxes(snapshot, marks, queue);
      for (const task of tasks) {
        const {item, order, palette} = task;
        const mask = renderers[item.view](snapshot, item, item.axes ? marks : null);
        const signature = createHash('sha256').update(mask.pixels).digest('hex');
        const seen = seenBySeries.get(item.id) ?? new Set();
        seenBySeries.set(item.id, seen);
        if (seen.has(signature)) {
          if (target - task.target >= 32) throw Error('Не удалось подобрать другой кадр для ' + item.id);
          const next = schedule.get(target + 1) ?? [];
          schedule.set(target + 1, next.concat(task));
          last = Math.max(last, target + 1);
          continue;
        }
        seen.add(signature);
        const directory = join(output, 'media', item.id);
        if (!saved.has(directory)) {
          mkdirSync(directory, {recursive: true});
          saved.add(directory);
        }
        const path = `media/${item.id}/${palette}`;
        const png = wallpaper(item.square ? squareArtwork(mask) : mask, paletteMap.get(palette), backdrop);
        writeFileSync(join(output, path + '.png'), png);
        await sharp(png).resize(640, 360).webp({quality: 84}).toFile(join(output, path + '.webp'));
        item.images[order] = {
          frame, palette, file: path + '.png', preview: path + '.webp', bytes: png.length,
          sha256: createHash('sha256').update(png).digest('hex'),
        };
      }
    }
    console.log(key, last);
  }
}

const seriesNames = new Map(groups);
const paletteNames = new Map(palettes.map(palette => [palette.id, palette.name]));
const routes = {bounce: 'Отскок', wrap: 'Перескок', reverse: 'Разворот при касании'};

function galleryGroup([id, label], series) {
  const items = series.filter(item => item.group === id);
  return `    <section id="${id}" aria-labelledby="${id}-title">
      <h2 id="${id}-title">${label}</h2>
      <nav class="sections" aria-label="${label}">${items.map(item => `<a href="#${item.id}">${item.name}</a>`).join(' ')}</nav>
${items.map(showSeries).join('\n')}
    </section>`;
}

function showSeries(item) {
  return `      <section class="wallpaper-series" id="${item.id}" aria-labelledby="${item.id}-title">
        <h3 id="${item.id}-title">${item.name}</h3>
        <p class="section-note">Поле ${item.width} × ${item.rows} · ${routes[item.edge]} · ${item.accumulation.toUpperCase()}</p>
        <div class="gallery static-gallery wallpaper-grid">
${item.images.map(image => {
  const palette = paletteNames.get(image.palette);
  return `          <article>
            <a class="wallpaper-preview" href="${image.file}" aria-label="Открыть обои «${item.name} · ${palette}», кадр ${image.frame}"><img src="${image.preview}" width="640" height="360" alt="${item.name} в палитре «${palette}»" loading="lazy" decoding="async"></a>
            <div class="info"><h4>${palette}</h4><p>Кадр ${image.frame} · <a href="${image.file}" download>PNG 4K</a></p></div>
          </article>`;
}).join('\n')}
        </div>
      </section>`;
}

function gallery(series) {
  return `<!doctype html>
<!-- Собрано tools/mayatnik-journal/build-rhomb-wallpapers.cjs. -->
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Статичные ромбовые обои Зеркалиуса в 4K. 30 серий по десять цветных кадров на полях в 1024 строки.">
  <title>Ромбовые обои · 1024 строки · Зеркалиус</title>
  <link rel="stylesheet" href="../style.css?v=002">
  <link rel="stylesheet" href="style.css?v=001">
</head>
<body>
  <main>
    <nav class="breadcrumbs" aria-label="Разделы Зеркалиуса">
      <a href="../#rhomb-1024">Обои для компьютера</a>
      <a href="../../image-journal/rhomb-collection/">Ромбовая коллекция</a>
      <a href="../../../mayatnik/romb.html">Ромбовый Маятник</a>
    </nav>
    <header class="intro" id="top">
      <h1>Ромбовые обои</h1>
      <p>30 серий по десять кадров и палитр. Каждый кадр построен на поле в 1024 строки и подготовлен для широкого рабочего стола.</p>
      <p class="specs">3840 × 2160 <span>16:9 · PNG</span></p>
      <nav class="sections" aria-label="Группы обоев">
        ${[...seriesNames].map(([id, label]) => `<a href="#${id}">${label}</a>`).join('\n        ')}
      </nav>
    </header>
${groups.map(group => galleryGroup(group, series)).join('\n')}
    <footer>
      <p><a href="#top">К началу</a> · <a href="recipes.json">Кадры и параметры построения (JSON)</a></p>
    </footer>
  </main>
</body>
</html>
`;
}

async function main() {
  const {catalogue, simulations} = groupTasks();
  await buildImages(simulations);
  writeFileSync(join(output, 'recipes.json'), JSON.stringify({
    width, height, rows, initialField: 'empty', source: '../../image-journal/rhomb-collection/recipes.json',
    palettes: sourceData.palettes, series: catalogue,
  }, null, 2) + '\n');
  writeFileSync(join(output, 'index.html'), gallery(catalogue));
  console.log(`${catalogue.length} серий · ${catalogue.reduce((sum, item) => sum + item.images.length, 0)} обоев`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
