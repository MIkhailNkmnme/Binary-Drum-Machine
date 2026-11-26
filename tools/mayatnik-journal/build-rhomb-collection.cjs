'use strict';

const { createHash } = require('node:crypto');
const { mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
const { deflateSync } = require('node:zlib');
const { createModel, pngChunk } = require('./analyze-rhomb-period.cjs');
const { colourCentralAxes } = require('./build-rhomb-atlas.cjs');
const { createPackedRhomb } = require('./rhomb-packed.cjs');

const defaultOutput = join(__dirname, '../../issledovanie/image-journal/rhomb-collection');
const pagesOnly = process.argv[2] === '--pages';
const output = pagesOnly ? defaultOutput : process.argv[2] ?? defaultOutput;
const wallpaperDirectory = '../../desktop-wallpapers/rhomb-1024/';
const paletteDefinitions = [
  ['amber', 'Янтарь', '160d18', '4d2940', 'ffc06d', 'f48053', 'a28cff', 'ffe6a3'],
  ['teal', 'Бирюза', '061c22', '16494d', 'a8f8e6', '61cfed', 'f2a96a', 'd9ffb0'],
  ['coral', 'Коралл', '240e1c', '653047', 'ffa59d', 'ffc57e', 'e281f0', 'fff0cc'],
  ['indigo', 'Индиго', '0c112b', '323e78', 'b7c6ff', 'aa8bff', '55e0db', 'f4bfff'],
  ['jade', 'Нефрит', '0b1a12', '305440', 'b1ed93', 'e4d76d', '68dfbb', 'edffcd'],
  ['copper', 'Медь', '1c1410', '61412f', 'f2ab7c', 'ffd19c', '62c4bd', 'f9e8af'],
  ['violet', 'Аметист', '19102a', '4d3370', 'e6b8ff', 'f990bf', 'a7adff', 'fff2fc'],
  ['sky', 'Лазурь', '0a192d', '244d76', '97e2ff', '79aaff', 'a5ed9a', 'e5ffff'],
  ['rose', 'Фуксия', '220e26', '642d61', 'ffa2e7', 'f974a8', '94d8ff', 'ffd9c6'],
  ['silver', 'Серебро', '121719', '424c53', 'e7f2ef', 'a4b8da', 'e5bb8c', 'fcfff5'],
];
const groups = [
  ['build-modes', 'Построение поля'],
  ['field-views', 'Виды поля'],
  ['coin', 'Ромб-монета'],
  ['hub', 'Ромбовые виды Хаба'],
];
const routes = [
  ['bounce', 'Отскок'],
  ['wrap', 'Перескок'],
  ['reverse', 'Разворот при касании'],
];
const modes = [
  ['overlay', 'Наложение'],
  ['xor', 'XOR'],
  ['and', 'AND'],
];
const pendulum = '../../../mayatnik/romb.html';
const hub = '../../../index.html';
const options = {rows: 128, widthFactor: 2, edge: 'wrap', accumulation: 'xor', view: 'field'};
const series = [
  ...[2, 4].flatMap(widthFactor => routes.flatMap(([edge, name]) =>
    ['xor', 'and'].map(accumulation => ({
      ...options, id: `field-${widthFactor}-${edge}-${accumulation}`, group: 'build-modes',
      name: `${name} · ${widthFactor}N−1 · ${accumulation.toUpperCase()}`, widthFactor, edge, accumulation,
    })))),
  ...[
    {id: 'join-left', name: 'Склейка влево', joinLeft: true},
    {id: 'join-right', name: 'Склейка вправо', joinRight: true},
    {id: 'join-both', name: 'Склейка в обе стороны', joinLeft: true, joinRight: true},
    {id: 'repeats', name: 'Совпадающие блоки 2 × 2', repeats: true},
    {id: 'square', name: 'Квадратная проекция поля', square: true},
    {id: 'pair', name: 'Два ромба', view: 'pair'},
    {id: 'field-axes', name: 'Поле с цветными осями', axes: true},
  ].map(item => ({...options, group: 'field-views', ...item})),
  ...modes.flatMap(([combination, label]) => [false, true].map(flipSecond => ({
    ...options, id: `coin-${combination}${flipSecond ? '-mirror' : ''}`, group: 'coin',
    name: label + (flipSecond ? ' · с отражением' : ''), view: 'coin', combination, flipSecond,
  }))),
  {...options, id: 'coin-square', group: 'coin', name: 'Наложение · квадратная проекция',
    view: 'coin', combination: 'overlay', square: true},
  ...[
    {id: 'hub-four', name: 'Четыре треугольника'},
    {id: 'hub-four-axes', name: 'Четыре треугольника · цветные оси', axes: true},
    {id: 'hub-vertical', name: 'Вверх-вниз', vertical: true},
    {id: 'hub-vertical-axes', name: 'Вверх-вниз · цветные оси', vertical: true, axes: true},
  ].map(item => ({...options, rows: 1024, group: 'hub', view: 'hub', ...item})),
];

function rgb(hex) {
  return Buffer.from(hex, 'hex');
}

function mix(from, to, amount) {
  return Buffer.from([...from].map((channel, index) => Math.round(channel + (to[index] - channel) * amount)));
}

const palettes = paletteDefinitions.map(([id, name, ...colors]) => {
  const [background, zero, one, first, second, shared] = colors.map(rgb);
  const tones = [first, second, shared];
  return {
    id, name, colors,
    png: Buffer.concat([background, zero, one,
      ...tones.flatMap(color => [mix(background, color, 0.35), color]),
      ...tones.map(color => mix(background, color, 0.55)),
      mix(background, one, 0.43)]),
  };
});

function colorIndex(bit, mark = 0) {
  return bit < 0 ? (mark ? 8 + mark : 0) : 1 + mark * 2 + bit;
}

function raster(width, height) {
  return {width, height, pixels: Buffer.alloc(width * height)};
}

function readCell({W, H, val}, row, column) {
  return column >= 0 && column < W && row >= 0 && row < H ? val[row * W + column] : -1;
}

function radiusAt(row, height) {
  return Math.min(row, height - 1 - row);
}

function matchBlock(field, row, column, from, to) {
  const top = row - (row & 1);
  const offset = column - from;
  const left = offset - (offset & 1);
  const radius = radiusAt(top, field.H - 1);
  if (left < -radius || left + 1 > radius) return false;
  for (let dy = 0; dy < 2; dy++) {
    for (let dx = 0; dx < 2; dx++) {
      const bit = readCell(field, top + dy, from + left + dx);
      if (bit < 0 || bit !== readCell(field, top + dy, to + left + dx)) return false;
    }
  }
  return true;
}

function fieldView({field, route}, item, marks) {
  const {W, H, val} = field;
  const half = (W - 1) / 2;
  const first = item.joinLeft ? -half : 0;
  const last = item.joinRight ? W + half : W;
  const centers = route().slice(2).reverse();
  const result = raster(last - first, H);
  for (let row = 0; row < H; row++) {
    const radius = radiusAt(row, H);
    for (let x = first; x < last; x++) {
      const column = (x + W) % W;
      const index = row * W + column;
      let mark = marks?.[index] || 0;
      if (x < 0) mark = 1;
      else if (x >= W) mark = 2;
      else if (item.repeats && centers[0] !== centers[1] &&
        (matchBlock(field, row, column, centers[0], centers[1]) ||
         matchBlock(field, row, column, centers[1], centers[0]))) mark = 3;
      else if (!item.axes && !item.square) {
        if (Math.abs(x - centers[0]) === radius) mark |= 1;
        if (Math.abs(x - centers[1]) === radius) mark |= 2;
      }
      result.pixels[row * result.width + x - first] = colorIndex(val[index], mark);
    }
  }
  return result;
}

function pairView({field, route}, item, marks) {
  const {W, H} = field;
  const middle = H / 2 - 1;
  const gap = Math.max(3, H / 16);
  const width = 2 * (H - 1) + gap;
  const result = item.vertical ? raster(H, width) : raster(width, H);
  const centers = route().slice(2).reverse();
  for (const [side, center] of centers.entries()) {
    for (let row = 0; row < H; row++) {
      const radius = radiusAt(row, H);
      for (let offset = -radius; offset <= radius; offset++) {
        const x = side * (H - 1 + gap) + middle + offset;
        const column = center + offset;
        const bit = readCell(field, row, column);
        let mark = column >= 0 && column < W ? marks?.[row * W + column] || 0 : 0;
        if (item.vertical && !mark && Math.abs(offset) === radius) mark = side + 1;
        const color = colorIndex(bit, mark);
        const index = item.vertical ? x * H + H - 1 - row : row * width + x;
        result.pixels[index] = color;
      }
    }
  }
  if (item.view === 'hub' && !item.vertical) {
    const seam = H / 2;
    for (let x = 0; x < width; x++) {
      const index = seam * width + x;
      if (!result.pixels[index]) result.pixels[index] = 12;
    }
  }
  return result;
}

function coinView({field, route}, {combination, flipSecond}) {
  const {H} = field;
  const middle = H / 2 - 1;
  const result = raster(H - 1, H);
  const [first, second] = route().slice(2);
  for (let row = 0; row < H; row++) {
    const radius = radiusAt(row, H);
    for (let offset = -radius; offset <= radius; offset++) {
      const left = readCell(field, row, first + offset);
      const right = readCell(field, row, second + (flipSecond ? -offset : offset));
      if (left < 0 && right < 0) continue;
      const a = left === 1;
      const b = right === 1;
      let color;
      if (combination === 'overlay') color = a && b ? colorIndex(1, 3) : a ? colorIndex(1, 1)
        : b ? colorIndex(1, 2) : colorIndex(0);
      else color = colorIndex(Number(combination === 'xor' ? a !== b : a && b));
      result.pixels[row * result.width + middle + offset] = color;
    }
  }
  return result;
}

function squareView(source, scale) {
  const {width, height, pixels} = source;
  const side = Math.ceil((width + height) * Math.SQRT1_2 * scale);
  const result = raster(side, side);
  const step = Math.SQRT1_2 / scale;
  for (let y = 0; y < side; y++) {
    const v = (y + 0.5) * step - width / 2;
    for (let x = 0; x < side; x++) {
      const u = (x + 0.5) * step;
      const row = Math.floor(u + v);
      const column = Math.floor(u - v);
      if (row >= 0 && row < height && column >= 0 && column < width) {
        result.pixels[y * side + x] = pixels[row * width + column];
      }
    }
  }
  return result;
}

function writeImage(path, image, palette, scale) {
  const {width, height, pixels} = image;
  const padding = Math.max(10, Math.round(Math.min(width, height) * scale / 22));
  const outWidth = width * scale + 2 * padding;
  const outHeight = height * scale + 2 * padding;
  const stride = outWidth + 1;
  const raw = Buffer.alloc(stride * outHeight);
  for (let y = 0; y < height; y++) {
    const start = (padding + y * scale) * stride + 1 + padding;
    for (let x = 0; x < width; x++) {
      raw.fill(pixels[y * width + x], start + x * scale, start + (x + 1) * scale);
    }
    for (let dy = 1; dy < scale; dy++) raw.copy(raw, start + dy * stride, start, start + width * scale);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(outWidth);
  header.writeUInt32BE(outHeight, 4);
  header[8] = 8;
  header[9] = 3;
  writeFileSync(path, Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header), pngChunk('PLTE', palette.png),
    pngChunk('IDAT', deflateSync(raw, {level: 9})), pngChunk('IEND', Buffer.alloc(0)),
  ]));
  return {width: outWidth, height: outHeight};
}

function suggestedFrames(item, width) {
  if (item.group === 'hub') return [149, 333, 517, 761, 1009, 1259, 1511, 1823, 2167, 2567];
  if (item.group === 'coin') return [92, 134, 183, 223, 259, 288, 331, 383, 448, 507];
  if (item.group === 'field-views') return [71, 117, 166, 207, 269, 301, 349, 403, 479, 533];
  if (item.edge === 'reverse') return item.accumulation === 'and'
    ? [22, 41, 59, 79, 106, 128, 148, 173, 203, 245]
    : [128, 134, 150, 167, 189, 214, 252, 298, 376, 484];
  if (item.accumulation === 'and') {
    const early = item.edge === 'wrap' ? [37, 65, 99, 153] : [31, 57, 87, 139];
    return early.concat([3, 23, 48, 77, 106, 143].map(offset => width + offset));
  }
  const offsets = item.edge === 'wrap' ? [4, 17, 33, 47, 82, 113, 157, 209, 267, 359]
    : [3, 11, 26, 49, 72, 100, 151, 194, 239, 313];
  return offsets.map(offset => width + offset);
}

function simulate(item, width) {
  if (item.group !== 'hub') {
    const model = createModel(item.rows, width, item.edge === 'wrap', item.edge === 'reverse');
    return {advance: () => model.advanceFrame(item.accumulation === 'and'), snapshot: () => model};
  }
  const model = createPackedRhomb(item.rows);
  const field = {W: width, H: item.rows, val: new Int8Array(width * item.rows)};
  return {
    advance: () => model.advance(),
    snapshot() {
      for (let row = 0; row < field.H; row++) {
        for (let col = 0; col < width; col++) field.val[row * width + col] = model.cell(row, col);
      }
      return {field, route: () => [0, 0, ...model.centers]};
    },
  };
}

function buildSeries(item) {
  const width = item.widthFactor * item.rows - 1;
  const simulation = simulate(item, width);
  const marks = item.axes ? new Uint8Array(width * item.rows) : null;
  const queue = marks && new Int32Array(marks.length);
  const directory = join(output, 'png', item.id);
  const render = {field: fieldView, pair: pairView, coin: coinView, hub: pairView}[item.view];
  mkdirSync(directory, {recursive: true});
  let frame = 0;
  const seen = new Set();
  const images = suggestedFrames(item, width).map((target, index) => {
    const palette = palettes[index];
    let image;
    for (let candidate = Math.max(target, frame + 1); candidate < target + 32; candidate++) {
      while (frame < candidate) {
        simulation.advance();
        frame++;
      }
      const snapshot = simulation.snapshot();
      if (marks) colourCentralAxes(snapshot, marks, queue);
      const view = render(snapshot, item, marks);
      const signature = createHash('sha256').update(view.pixels).digest('hex');
      if (seen.has(signature)) continue;
      seen.add(signature);
      image = view;
      break;
    }
    if (!image) throw Error(`Не удалось выбрать новый кадр для ${item.id} после ${target}.`);
    const file = `png/${item.id}/${palette.id}.png`;
    const scale = item.group === 'hub' ? 1 : 3;
    const dimensions = writeImage(join(output, file), item.square ? squareView(image, scale) : image, palette,
      item.square ? 1 : scale);
    return {frame, palette: palette.id, file, ...dimensions};
  });
  return {...item, width, images};
}

function card(item, image, wallpaper) {
  const palette = palettes.find(entry => entry.id === image.palette);
  const base = wallpaper ? wallpaperDirectory : '';
  const frame = `frame.html?series=${item.id}&amp;palette=${image.palette}${wallpaper ? '&amp;edition=1024' : ''}`;
  return `          <figure id="${item.id}-${image.palette}">
            <a class="image-link" href="${base + image.file}" aria-label="${item.name} · ${palette.name} · кадр ${image.frame} · открыть PNG"><img src="${base + (wallpaper ? image.preview : image.file)}" alt="${item.name} в палитре «${palette.name}», кадр ${image.frame}" width="${wallpaper ? 640 : image.width}" height="${wallpaper ? 360 : image.height}" loading="lazy" decoding="async"></a>
            <figcaption><span class="rhomb-swatch" style="--swatch:#${palette.colors[2]}"></span><span>${palette.name}</span><small><a href="${frame}" aria-label="Открыть страницу кадра ${image.frame} · ${item.name} · ${palette.name}">Кадр ${image.frame}</a></small></figcaption>
          </figure>`;
}

function seriesSection(item, wallpaper) {
  const name = item.group === 'build-modes' ? `${item.rows} × ${item.width}`
    : `${item.rows} × ${item.width} · ${routes.find(([edge]) => edge === item.edge)[1]} · XOR`;
  return `      <section class="rhomb-series" id="${item.id}" aria-labelledby="${item.id}-title">
        <h3 id="${item.id}-title">${item.name}</h3>
        <p class="rhomb-settings">${name}</p>
        <div class="rhomb-grid">
${item.images.map(image => card(item, image, wallpaper)).join('\n')}
        </div>
      </section>`;
}

function groupSection([id, name], catalogue, wallpaper) {
  const items = catalogue.filter(item => item.group === id);
  const source = id === 'hub' ? `<a href="${hub}?four=axes">Открыть Хаб с осями</a>` : '';
  return `    <section class="entry rhomb-group" id="${id}" aria-labelledby="${id}-title">
      <h2 id="${id}-title">${name}</h2>
      ${source ? `<p>${source}</p>\n      ` : ''}<nav class="rhomb-series-nav" aria-label="${name}">${items.map(item =>
        `<a href="#${item.id}">${item.name}</a>`).join(' · ')}</nav>
${items.map(item => seriesSection(item, wallpaper)).join('\n')}
    </section>`;
}

function gallery(catalogue, wallpaper = false) {
  const imageCount = catalogue.reduce((total, item) => total + item.images.length, 0);
  const title = wallpaper ? 'Ромбовые кадры на 1024 строки' : 'Ромбовые построения';
  return `<!doctype html>
<!-- Собрано tools/mayatnik-journal/build-rhomb-collection.cjs. -->
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#101317">
  <meta name="description" content="${imageCount} цветных кадров Ромбового Маятника и Хаба для Журнала картинок Зеркалиуса.">
  <title>${title} · Журнал картинок</title>
  <link rel="stylesheet" href="../style.css?v=017">
  <link rel="stylesheet" href="style.css?v=002">
</head>
<body>
  <a class="skip" href="#rhomb-collection">К коллекции</a>
  <header class="site-bar">
    <nav class="site-nav shell" aria-label="Разделы сайта">
      <a class="brand" href="../#rhomb-collection">Журнал картинок</a>
      <div class="site-links">
        <a href="${pendulum}">Ромбовый Маятник</a>
        <a href="../../wolfram-nks/romb-atlas.html">Атлас ромбов</a>
        <a href="${hub}?four=axes">Хаб</a>
      </div>
    </nav>
  </header>
  <main id="rhomb-collection" class="shell">
    <header class="rhomb-intro">
      <p class="entry-meta"><time datetime="2026-11-26">26 ноября 2026</time><span>${catalogue.length} серий · ${imageCount} PNG</span></p>
      <h1>${title}</h1>
      <p>${wallpaper ? 'В каждой серии десять кадров с полей в 1024 строки. PNG подготовлены в 3840 × 2160.' : 'В каждой серии десять рассчитанных кадров в десяти палитрах.'} Номер под изображением открывает страницу кадра.</p>
      <nav class="contents" aria-label="Группы коллекции">
        ${wallpaper ? '<a href="./">Цветная коллекция</a>' : '<a href="wallpapers.html">Кадры на 1024 строки</a>'}
        <a href="gifs.html">Трёхминутные GIF</a>
        ${groups.map(([id, name]) => `<a href="#${id}">${name}</a>`).join('\n        ')}
      </nav>
    </header>
${groups.map(group => groupSection(group, catalogue, wallpaper)).join('\n')}
    <footer id="recipe" class="entry rhomb-recipe">
      <h2>Как построить кадр</h2>
      <p>Начните с пустого поля в Ромбовом Маятнике. Выберите ширину, высоту, движение ветвей и способ накопления из заголовка серии и перейдите к кадру под изображением. Для разворота включите «Разворот при касании». Серии Ромба-монеты используют совмещение двух вырезок по центрам.</p>
      <p>Размеры в подписях относятся к исходному полю и указаны в порядке «строки × столбцы». Цвета показывают нули, единицы, ветви и оси. Парные виды собраны из вырезок вокруг центральных столбцов ветвей.</p>
      <p><a href="${wallpaper ? wallpaperDirectory : ''}recipes.json">Параметры кадров и палитр (JSON)</a> · <a href="${pendulum}">Ромбовый Маятник</a> · <a href="${hub}?four=vertical">Вертикальные ветви в Хабе</a> · <a href="#rhomb-collection">К началу коллекции</a></p>
    </footer>
  </main>
</body>
</html>
`;
}

function collectionFrames(item) {
  const simulation = simulate(item, item.width);
  const rasterize = {field: fieldView, pair: pairView, coin: coinView, hub: pairView}[item.view];
  let frame = 0;
  return function at(target) {
    if (target < frame) throw RangeError('Кадры коллекции обходятся по возрастанию.');
    while (frame < target) {
      simulation.advance();
      frame++;
    }
    return rasterize(simulation.snapshot(), item);
  };
}

if (require.main === module && pagesOnly) {
  const pictures = JSON.parse(readFileSync(join(output, 'recipes.json'), 'utf8'));
  const wallpapers = JSON.parse(readFileSync(join(output, wallpaperDirectory, 'recipes.json'), 'utf8'));
  writeFileSync(join(output, 'index.html'), gallery(pictures.series));
  writeFileSync(join(output, 'wallpapers.html'), gallery(wallpapers.series, true));
} else if (require.main === module) {
  const catalogue = series.map(buildSeries);
  writeFileSync(join(output, 'recipes.json'), JSON.stringify({
    initialField: 'empty',
    palettes: palettes.map(({png, ...palette}) => {
      const [background, zero, one, first, second, shared] = palette.colors.map(hex => '#' + hex);
      return {id: palette.id, name: palette.name, background, zero, one, first, second, shared};
    }),
    series: catalogue,
  }, null, 2) + '\n');
  writeFileSync(join(output, 'index.html'), gallery(catalogue));
  console.log(`${catalogue.length} серий, ${catalogue.reduce((count, item) => count + item.images.length, 0)} PNG.`);
}

module.exports = {collectionFrames, groups, palettes, fieldView, pairView, coinView, squareView};
