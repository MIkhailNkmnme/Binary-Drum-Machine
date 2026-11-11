/* Render the exact Animatrix states linked in the Research page.
 * Run: node issledovanie/animatrix-excel/generate.cjs
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Source = require('../../mayatnik/mayatnik-animatrix-source.js');
const Core = require('../../mayatnik/mayatnik-animatrix-core.js');
const Shapes = require('../../mayatnik/mayatnik-animatrix-excel-shapes.js');
const Share = require('../../mayatnik/mayatnik-share-link.js');
const Grid = require('../../mayatnik/mayatnik-staggered-grid.js');
const { encoder } = require('../../mayatnik/mayatnik-gif.js');

const page = path.join(__dirname, '..', 'Zerkalius-issledovanie.html');
const escape = value => String(value).replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'
})[c]);
const hex = value => '#' + value.toString(16).padStart(6, '0');

function cells(s) {
  const result = [];
  for (let q = 0; q < s.present.length; q++) {
    if (!s.present[q] && !s.filled[q]) continue;
    result.push({
      x: q % s.width,
      y: Math.floor(q / s.width),
      bit: s.present[q] ? s.bits[q] : null,
      fill: s.filled[q] ? hex(s.fills[q]) : null,
      colour: s.automatic[q] ? '#000000' : hex(s.colours[q]),
      bold: !!s.bold[q]
    });
  }
  return result;
}

function bounds(panels) {
  const box = { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity };
  for (const { entries } of panels) for (const { x, y } of entries) {
    box.left = Math.min(box.left, x);
    box.right = Math.max(box.right, x + 1);
    box.top = Math.min(box.top, y);
    box.bottom = Math.max(box.bottom, y + 1);
  }
  if (!Number.isFinite(box.left)) throw Error('В примере нет клеток для увеличения.');
  return box;
}

function panelsFor(id, state, frame) {
  const engine = Source.create(state);
  const advance = at => {
    Source.advance(engine, at - engine.sourceFrame);
    if (engine.sourceFrame !== at) throw Error('Не построен кадр ' + at + ' для ' + id);
    return cells(Core.snapshot(engine));
  };
  if (id === 'excel-zero-palette') {
    const entries = advance(frame);
    return [
      { title: 'Красный', zero: '#ff0000', entries },
      { title: 'Синий', zero: '#0000ff', entries },
      { title: 'Зелёный', zero: '#008000', entries }
    ];
  }
  if (id === 'excel-pattern-colours') return [
    { title: '1 · Прямое', entries: advance(1) },
    { title: '2 · Инверсия', entries: advance(2) },
    { title: '3 · Реверс', entries: advance(frame) }
  ];
  return [
    { title: 'Исходник · кадр 0', entries: advance(0) },
    { title: 'Результат · кадр ' + frame, entries: advance(frame) }
  ];
}

function detailFor(state, panels, { phase, stride }) {
  const { height, areas } = state.animatrixSource;
  const { animatrixAlgorithm: algorithm } = state;
  const limits = {
    copyRows: [0, 8],
    excelBounce: [0, 2],
    excelChain: [0, 4],
    excelChainDown: [0, 4],
    excelTriangleDown: [0, 9],
    excelTriangleUp: [height - 9, height],
    excelCollision: [0, 9],
    excelTriangleBoth: [Math.floor((height - 1) / 2) - 4, Math.floor((height - 1) / 2) + 5],
    excelTrianglePend: [Math.floor((height - 1) / 2) - 4, Math.floor((height - 1) / 2) + 5]
  };
  const area = algorithm === 'excelCollision' ? areas[0] : null;
  const selection = area && (area.width !== state.animatrixSource.width || area.height !== height) ? area : null;
  const [top, bottom] = selection ? [selection.y, selection.y + selection.height] : limits[algorithm];
  return panels.map(({ entries }) => ({ entries: entries.filter(({ x, y }) =>
    y >= top && y < bottom && (!selection || (x >= selection.x && x < selection.x + selection.width)))
    .map(entry => ({ ...entry, x: Grid.leftHalf(entry.x, entry.y, phase, stride) / 2 })) }));
}

async function overview(entries, width, height, fillFor, { phase, stride }) {
  const pixels = new Uint8Array(width * height * 4);
  const background = [16, 26, 37, 255];
  for (let i = 0; i < pixels.length; i += 4) pixels.set(background, i);
  for (const entry of entries) {
    const left = Grid.leftHalf(entry.x, entry.y, phase, stride);
    if (Grid.column(left, entry.y, phase, stride) !== entry.x) throw Error('Клетка выходит из решётки.');
    const rgb = Number.parseInt(fillFor(entry).slice(1), 16);
    pixels.set([rgb >>> 16, rgb >>> 8 & 255, rgb & 255, 255], (entry.y * width + entry.x) * 4);
  }
  const halfWidth = Grid.halfWidth(width, stride), halfHeight = 2 * height;
  const empty = new Uint32Array(Uint8Array.from(background).buffer)[0];
  const raster = Grid.sample({ width, height, data: pixels }, halfWidth, halfHeight, phase, 1, 0, 0, empty, stride);
  const gif = encoder(halfWidth, halfHeight);
  gif.add(raster, 1);
  return 'data:image/gif;base64,' + Buffer.from(await gif.frame().arrayBuffer()).toString('base64');
}

async function figure(name, state, panels) {
  const { width, height } = state.animatrixSource;
  const W = 960, gap = 12, margin = 20;
  const panelWidth = (W - 2 * margin - gap * (panels.length - 1)) / panels.length;
  const layout = Source.staggeredLayout(state);
  const plotWidth = panelWidth - 48, scale = plotWidth / Grid.halfWidth(width, layout.stride);
  const overviewY = 63, overviewHeight = height * 2 * scale;
  const detail = detailFor(state, panels, layout);
  const box = bounds(detail), cols = box.right - box.left, rows = box.bottom - box.top;
  const size = Math.min(32, plotWidth / cols);
  const detailY = overviewY + overviewHeight + 61;
  const H = Math.ceil(detailY + rows * size + 22);
  const text = (x, y, value, font = 17, fill = '#e6eef7', attr = '') =>
    `<text x="${x}" y="${y}" font-size="${font}" fill="${fill}" ${attr}>${escape(value)}</text>`;
  const rect = (x, y, w, h, fill, attr = '') =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" ${attr}/>`;
  const coneBackground = Source.coneMode(state.animatrixAlgorithm);
  const bitFill = (entry, zero) => {
    if (entry.fill) return entry.fill;
    if (coneBackground) {
      const colour = Shapes.cellBackground(entry.bit, Number.parseInt(entry.colour.slice(1), 16),
        zero ? Number.parseInt(zero.slice(1), 16) : null);
      if (colour !== null) return hex(colour);
    }
    return entry.bit ? state.bitOneColour : state.bitZeroColour;
  };
  const digits = (entry, zero) => {
    if (coneBackground) return entry.bit ? state.digitOneColour : state.digitZeroColour;
    if (zero) return entry.bit ? '#000000' : zero;
    if (state.animatrixCopyRowsLayout === 'mirrorExcel') return entry.bit ? '#0066cc' : '#dcdcdc';
    return entry.colour;
  };

  const out = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="title desc">`,
    `<title id="title">${escape(name)} · поле ${width} × ${height}</title>`,
    '<desc id="desc">Верхняя часть показывает всё поле. Нижняя увеличивает выделенные строки и показывает цифры.</desc>',
    rect(0, 0, W, H, '#0c131d', 'rx="10"'),
    '<g font-family="Arial, sans-serif">',
    text(margin, 22, 'Встык · полное поле · ' + height + ' строк', 15, '#aebfd2'),
    text(margin, detailY - 39, 'Увеличение · строки ' + (box.top + 1) + '–' + box.bottom, 15, '#aebfd2')
  ];

  const overviews = new Map();
  for (const [index, { title, entries, zero }] of panels.entries()) {
    const x = margin + index * (panelWidth + gap), fieldX = x + 37;
    const plotX = fieldX + (plotWidth - cols * size) / 2;
    out.push(text(fieldX, 47, title, 20));
    out.push(rect(fieldX, overviewY, plotWidth, overviewHeight, '#101a25', 'stroke="#556d85"'));
    const overviewKey = coneBackground && zero ? zero : entries;
    if (!overviews.has(overviewKey)) {
      overviews.set(overviewKey, await overview(entries, width, height, entry => bitFill(entry, zero), layout));
    }
    out.push(`<image x="${fieldX}" y="${overviewY}" width="${plotWidth}" height="${overviewHeight}" href="${overviews.get(overviewKey)}" style="image-rendering:pixelated"/>`);
    for (const row of [1, 64, 128, 192, height]) {
      const y = overviewY + (row - .5) * 2 * scale;
      out.push(text(fieldX - 7, y + 4, row, 14, '#b9cce0', 'text-anchor="end"'));
      out.push(`<path d="M${fieldX - 5} ${y}h5" stroke="#768da6"/>`);
    }
    out.push(rect(fieldX + box.left * 2 * scale - 2, overviewY + box.top * 2 * scale - 2,
      cols * 2 * scale + 4, rows * 2 * scale + 4, 'none', 'stroke="#65baf4" stroke-width="1.6"'));
    out.push(rect(fieldX, detailY - 8, plotWidth, rows * size + 16, '#172331', 'rx="6" stroke="#405b75"'));
    for (let row = box.top; row < box.bottom; row++) {
      out.push(text(fieldX - 7, detailY + (row - box.top + .72) * size,
        row + 1, Math.min(15, size * .72), '#b9cce0', 'text-anchor="end"'));
    }
    for (const entry of detail[index].entries) {
      const px = plotX + (entry.x - box.left) * size, py = detailY + (entry.y - box.top) * size;
      out.push(rect(px, py, size - .7, size - .7, bitFill(entry, zero), 'rx="1"'));
      if (entry.bit === null) continue;
      const colour = digits(entry, zero);
      const weight = entry.bold || state.animatrixCopyRowsLayout === 'mirrorExcel' && entry.bit ? 700 : 400;
      const stroke = colour === '#dcdcdc' ? '#17202d' : '#ffffff';
      out.push(text(px + size / 2, py + size * .73, entry.bit, Math.min(24, size * .76), colour,
        `text-anchor="middle" font-family="Consolas, monospace" font-weight="${weight}" stroke="${stroke}" stroke-width=".8" paint-order="stroke"`));
    }
  }
  out.push('</g></svg>', '');
  return { markup: out.join('\n'), width: W, height: H };
}

async function main() {
  const html = fs.readFileSync(page, 'utf8');
  const articles = [...html.matchAll(/<article id="(excel-[^"]+)" class="excel-example">([\s\S]*?)<\/article>/g)];
  if (articles.length !== 12) throw Error('Ожидались 12 примеров Аниматрицы.');
  const figures = [];
  for (const [, id, article] of articles) {
    const name = article.match(/<h3>([^<]+)<\/h3>/)[1];
    const filename = article.match(/src="animatrix-excel\/([\w-]+\.svg)/)[1];
    const code = article.match(/mayatnik\.html\?v=\d+#s=([^"]+)"/)[1];
    const { k, state } = await Share.decode(code);
    if (state.animatrixStaggeredGrid !== true || state.rows !== 256 || state.animatrixSource.height !== 256)
      throw Error(id + ' должен открываться встык на 256 строках.');
    const { markup, width, height } = await figure(name, state, panelsFor(id, state, k));
    figures.push({ filename, markup, width, height, frame: k, field: [state.animatrixSource.width, state.rows] });
  }
  for (const { filename, markup } of figures) fs.writeFileSync(path.join(__dirname, filename), markup);
  const metadata = figures.map(({ markup, ...figure }) => figure);
  fs.writeFileSync(path.join(os.tmpdir(), 'codex-animatrix-excel-figures.json'), JSON.stringify(metadata, null, 2));
  for (const { filename, frame, field, height } of metadata) {
    console.log(filename + ' · кадр ' + frame + ' · поле ' + field.join('×') + ' · SVG 960×' + height);
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
