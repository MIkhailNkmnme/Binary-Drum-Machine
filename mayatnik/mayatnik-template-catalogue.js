import { catalogueIndex, pngSource, readFigure } from '../issledovanie/image-journal/atlas/figures/figure-data.js?v=1';
import { dragType, mountWorkbench } from './mayatnik-template-workbench.js?v=3';

const SIZES = [128, 256, 512, 1024, 2048, 4096];
const PAGE_SIZE = 24;
const $ = id => document.getElementById(id);
const format = value => value.toLocaleString('ru-RU');
const caption = text => window.HubButtonText?.shortCaption(text) || text;
const tabs = [...document.querySelectorAll('[data-size]')];
const source = $('source'), origin = $('origin'), query = $('query');
const catalogue = $('catalogue-cards'), catalogueStatus = $('catalogue-status');
const libraryControls = ['library-sort', 'library-bit', 'library-kind', 'library-min', 'library-max'];
const requestedSize = () => Number(new URLSearchParams(location.search).get('size'));
const selectedSize = () => SIZES.includes(requestedSize()) ? requestedSize() : 128;
let size = selectedSize(), page = 0, exactCells = null, sequence = 0, localSequence = 0;
let local = [], localError = false, currentEntries = new Map();
const entriesByIndex = new WeakMap();

function command(text, action, title = text) {
  const button = document.createElement('button'), label = document.createElement('span');
  button.type = 'button';
  button.className = 'gz-hx';
  button.title = title;
  button.setAttribute('aria-label', title);
  label.textContent = caption(text);
  button.append(label);
  button.onclick = action;
  return button;
}

function rgba(hex) {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return 0;
  const rgb = parseInt(hex.slice(1), 16);
  return (0xff000000 | (rgb & 255) << 16 | (rgb & 0xff00) | rgb >>> 16) >>> 0;
}

function atlasName(size, number) {
  return 'Фигура ' + String(number).padStart(size === 512 ? 3 : 4, '0');
}

function atlasEntry(size, number, offset, index) {
  return { key: 'atlas:' + size + ':' + number, name: atlasName(size, number), source: 'atlas',
    size, atlas: { size, number }, offset, index };
}

async function resolveAtlas({ size, number }) {
  const index = await catalogueIndex(size), offset = index.ids.indexOf(number);
  if (offset < 0) throw Error('Фигура больше не найдена в Атласе.');
  return atlasEntry(size, number, offset, index);
}

async function figureAsset(entry) {
  return entry.figure ??= await readFigure(entry.size, entry.offset, entry.index);
}

function partCanvas(part) {
  const { mask } = part;
  const image = new ImageData(mask.width, mask.height), rgbaData = new Uint32Array(image.data.buffer);
  if (!part.bits && !part.ink) rgbaData.set(mask.data);
  else for (let i = 0; i < rgbaData.length; i++) {
    const bit = part.bits?.[i];
    if (mask.data[i]) rgbaData[i] = part.ink || ((bit === 0 || bit === 1) ? part.palette[bit] : mask.data[i]);
  }
  const canvas = document.createElement('canvas');
  canvas.width = mask.width;
  canvas.height = mask.height;
  canvas.getContext('2d').putImageData(image, 0, 0);
  return canvas;
}

function sourceParts(entry) {
  if (entry.source === 'tray') {
    const { item, snapshot } = entry;
    const rk = snapshot.rk || 1, scale = (item.view.height ?? 100) / 100, ink = rgba(snapshot.templatePaint?.colours?.[item.id]);
    const palette = [snapshot.bitZeroColour ?? snapshot.st?.bitZeroColour ?? '#000000', snapshot.bitOneColour ?? snapshot.st?.bitOneColour ?? '#ffffff'].map(rgba);
    return {
      rk, parts: item.parts.map(part => {
        const mask = part.mask;
        const rect = MayatnikTemplate.rect(mask, part.axis ?? mask.x + mask.width / 2, scale, !!item.view.proportional, 0);
        if (Number.isFinite(part.axisOriginY)) rect.y = part.axisOriginY + (mask.y - part.axisOriginY) * scale;
        const bits = !part.sourceOrigin && !item.axis512Palette ? part.bitsData : null;
        return { rect, mask, bits, ink, palette };
      })
    };
  }
  const { shape } = entry.item, rk = shape.rk || 1;
  const scale = shape.compound ? 1 : (shape.height ?? 100) / 100;
  const parts = !shape.compound && shape.axisParts?.length ? shape.axisParts : shape.parts;
  return {
    rk, parts: parts.map(mask => {
      const x = mask.x ?? (mask.center ?? 0) * rk - mask.width / 2, y = mask.y ?? 0;
      const rect = MayatnikTemplate.rect({ ...mask, x, y }, mask.axis ?? x + mask.width / 2, scale, !shape.compound && !!shape.proportional, 0);
      if (Number.isFinite(mask.axisOriginY)) rect.y = mask.axisOriginY + (y - mask.axisOriginY) * scale;
      return { rect, mask };
    })
  };
}

function localCanvas(entry, thumbnail = false) {
  const { rk, parts } = sourceParts(entry);
  const positioned = parts.filter(({ mask, rect }) => mask?.data?.length === mask.width * mask.height &&
      Number.isSafeInteger(mask.width) && Number.isSafeInteger(mask.height) && mask.width > 0 && mask.height > 0 &&
      [rect.x, rect.y, rect.width, rect.height].every(Number.isFinite))
    .map(part => {
      const { rect } = part;
      return { ...part, x: Math.round(rect.x / rk), y: Math.round(rect.y / rk),
        width: Math.max(1, Math.round(rect.width / rk)), height: Math.max(1, Math.round(rect.height / rk)) };
    });
  if (!positioned.length) throw Error('Шаблон без доступного растра.');
  const x = Math.min(...positioned.map(part => part.x)), y = Math.min(...positioned.map(part => part.y));
  const width = Math.max(...positioned.map(part => part.x + part.width)) - x;
  const height = Math.max(...positioned.map(part => part.y + part.height)) - y;
  const scale = thumbnail ? Math.min(1, 152 / width, 92 / height) : 1;
  if (!thumbnail && (width * height > 12e6 || Math.max(width, height) > 32768)) throw Error('Шаблон слишком велик для растрового поля.');
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext('2d');
  context.imageSmoothingEnabled = false;
  for (const part of positioned) {
    context.drawImage(partCanvas(part), (part.x - x) * scale, (part.y - y) * scale, part.width * scale, part.height * scale);
  }
  if (thumbnail) {
    const factor = Math.min(6, 144 / canvas.width, 86 / canvas.height);
    canvas.style.width = canvas.width * factor + 'px';
  }
  return canvas;
}

async function toCanvas(entry) {
  if (!entry.atlas) return localCanvas(entry);
  const figure = await figureAsset(entry), picture = new Image();
  picture.src = pngSource(figure);
  await picture.decode();
  const canvas = document.createElement('canvas');
  canvas.width = figure.width;
  canvas.height = figure.height;
  canvas.getContext('2d').drawImage(picture, 0, 0);
  return canvas;
}

const workbench = mountWorkbench({ resolveAtlas, resolveEntry: key => currentEntries.get(key), toCanvas, caption });

function family(pixel) {
  const r = pixel & 255, g = pixel >>> 8 & 255, b = pixel >>> 16 & 255;
  if (!(r | g | b)) return 'чёрные';
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  if (max - min < 45) return (r + g + b) / 3 >= 150 ? 'белые' : 'чёрные';
  if (r >= 150 && g >= 150 && b < g - 60) return 'жёлтые';
  if (b === max && b - r > 40) return 'синие';
  if (r === max && r - g > 60 && r - b > 40) return 'красные';
  return 'другие';
}

function libraryEntry(item, index) {
  const mask = item.shape.parts[0], rk = item.shape.rk || 1;
  let occupied = 0, first = 0;
  for (const pixel of mask?.data ?? []) {
    if (!pixel) continue;
    occupied++;
    first ||= pixel;
  }
  const { name = item.id } = item, fam = family(first);
  const automaticName = /авто · (\d+) бит · ([01])/.exec(name), occurrences = /×(\d+)\s*$/.exec(name);
  const bit = item.stats?.bit ?? (automaticName ? Number(automaticName[2]) : ({ белые: 1, синие: 1, чёрные: 0, красные: 0 })[fam] ?? null);
  const count = item.stats?.count ?? (occurrences ? Number(occurrences[1]) : 1);
  const n = item.stats?.n ?? (automaticName ? Number(automaticName[1]) : Math.round(occupied / (rk * rk)));
  const rows = Number(item.shape.fieldRows ?? item.stats?.rows ?? item.source?.rows);
  return { item, index, key: 'library:' + item.id, source: 'library', size: SIZES.includes(rows) ? rows : null,
    name, n, bit, count, bits: n * count, fam, auto: String(item.id).startsWith('saved:auto:') || !!automaticName,
    width: Math.round((mask?.width || 0) / rk), height: Math.round((mask?.height || 0) / rk) };
}

function trayEntries(snapshot, rows) {
  return (snapshot?.templates ?? []).filter(item => item.view?.tray && item.parts?.length).sort((a, b) => a.view.tray - b.view.tray)
    .map(item => ({ item, snapshot, key: 'tray:' + rows + ':' + item.id, name: item.name || item.hex,
      source: 'tray', size: rows, n: item.view.traySize, frame: snapshot.frame ?? snapshot.k }));
}

async function loadLocal() {
  const request = ++localSequence;
  const keys = ['templates', 'template-hidden', 'latest', ...SIZES.map(rows => 'template-tray:' + rows)];
  const results = await Promise.allSettled(keys.map(key => MayatnikPaintCache.read(key)));
  if (request !== localSequence) return;
  localError = results.some(result => result.status === 'rejected');
  const get = index => results[index].status === 'fulfilled' ? results[index].value : undefined;
  const removed = new Set(Array.isArray(get(1)) ? get(1) : []);
  const library = new Map((window.MayatnikUserTemplates ?? []).map(item => [item.id, item]));
  for (const item of Array.isArray(get(0)) ? get(0) : []) {
    if (item?.shape?.parts?.length && !String(item.id).startsWith('standard:')) library.set(item.id, item);
  }
  const latest = get(2);
  const trays = SIZES.flatMap((rows, index) => {
    const archive = get(index + 3);
    return trayEntries(archive ?? (latest?.st?.rows === rows ? latest : null), rows);
  });
  local = [...trays, ...[...library.values()].filter(item => !removed.has(item.id)).map(libraryEntry)];
  showStatistics();
  render();
}

function inTab(entry) {
  if (size !== 4096) return entry.size === size;
  if (origin.value === 'unknown') return entry.size == null;
  return !origin.value || entry.size === Number(origin.value);
}

function filteredLibrary(entries) {
  const bit = $('library-bit').value, kind = $('library-kind').value;
  const min = Number($('library-min').value) || 0, max = Number($('library-max').value) || Infinity;
  const sort = $('library-sort').value, key = sort.replace('-', ''), direction = sort.startsWith('-') ? -1 : 1;
  return entries.filter(entry => (bit === '' || String(entry.bit) === bit) &&
    (!kind || (kind === 'auto') === entry.auto) && entry.n >= min && entry.n <= max &&
    (exactCells == null || entry.n === exactCells)).sort((a, b) => {
      if (key === 'name') return a.name.localeCompare(b.name, 'ru');
      if (key === 'id') return a.index - b.index;
      return direction * (a[key] - b[key]) || a.index - b.index;
    });
}

function searchMatch(entry) {
  const value = query.value.trim().toLocaleLowerCase('ru');
  if (!value) return true;
  if (entry.atlas && /^\d+$/.test(value)) return Number(value) === entry.atlas.number;
  return (entry.name + ' ' + (entry.size ?? '')).toLocaleLowerCase('ru').includes(value);
}

function currentLibrary() {
  return filteredLibrary(local.filter(entry => entry.source === 'library' && inTab(entry) && searchMatch(entry)));
}

function showStatistics() {
  const entries = local.filter(entry => entry.source === 'library' && inTab(entry));
  const counts = new Map(), families = new Map();
  let appearances = 0, bits = 0, auto = 0, ones = 0, zeroes = 0, oneBits = 0, zeroBits = 0;
  for (const entry of entries) {
    counts.set(entry.n, (counts.get(entry.n) ?? 0) + 1);
    families.set(entry.fam, (families.get(entry.fam) ?? 0) + 1);
    appearances += entry.count;
    bits += entry.bits;
    auto += Number(entry.auto);
    if (entry.bit === 1) { ones++; oneBits += entry.bits; }
    if (entry.bit === 0) { zeroes++; zeroBits += entry.bits; }
  }
  const sizes = [...counts.keys()].sort((a, b) => a - b);
  $('library-summary').textContent = [
    format(entries.length) + ' шаблонов (' + format(auto) + ' авто)',
    format(appearances) + ' встреч',
    format(bits) + ' бит всего',
    'из 1 — ' + format(ones) + ' (' + format(oneBits) + ' бит)',
    'из 0 — ' + format(zeroes) + ' (' + format(zeroBits) + ' бит)',
    sizes.length ? format(sizes[0]) + '…' + format(sizes.at(-1)) + ' кл.' : '',
    ...[...families].sort((a, b) => b[1] - a[1]).map(([family, count]) => family + ' ' + format(count))
  ].filter(Boolean).join(' · ');
  $('library-histogram').replaceChildren(...[...counts.entries()].sort((a, b) => a[0] - b[0]).map(([cells, count]) => {
    const button = command(String(cells), () => {
      exactCells = exactCells === cells ? null : cells;
      filterLibrary();
    }, format(cells) + ' клеток · ' + format(count) + ' шаблонов');
    button.className = '';
    button.setAttribute('aria-pressed', String(exactCells === cells));
    return button;
  }));
}

function card(entry) {
  const item = document.createElement('li'), picture = document.createElement('div');
  const title = document.createElement('strong'), meta = document.createElement('p');
  item.className = 'catalogue-card';
  picture.className = 'card-preview';
  picture.draggable = true;
  picture.title = 'Перетащить на поле';
  picture.ondragstart = event => {
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData(dragType, entry.key);
  };
  title.className = 'card-title';
  title.textContent = entry.name;
  title.title = entry.name;
  meta.className = 'card-meta';
  const add = command('+ На поле', () => workbench.add(entry), 'Добавить «' + entry.name + '» на поле');
  item.append(picture, title, meta, add);
  if (entry.figure) {
    const { figure } = entry, image = new Image();
    image.src = pngSource(figure);
    image.alt = '';
    image.draggable = false;
    image.decoding = 'async';
    image.style.width = figure.width * Math.min(6, 152 / figure.width, 92 / figure.height) + 'px';
    picture.append(image);
    meta.textContent = entry.size + ' · ' + figure.width + ' × ' + figure.height + ' · ' + format(figure.cells) + ' кл.';
  } else if (!entry.atlas) {
    const label = entry.source === 'tray' ? 'Из-под поля' : 'Битотека';
    try { picture.append(localCanvas(entry, true)); }
    catch { picture.textContent = 'Превью недоступно'; }
    meta.textContent = [entry.size ?? 'Размер не записан', label, entry.n != null ? format(entry.n) + ' кл.' : '',
      entry.count > 1 ? '×' + format(entry.count) : ''].filter(Boolean).join(' · ');
  } else {
    picture.textContent = 'Фигура недоступна';
    picture.draggable = false;
    add.disabled = true;
    meta.textContent = String(entry.size);
  }
  return item;
}

function indexCount(count) {
  $('catalogue-count').textContent = format(count) + ' шаблонов';
}

async function render() {
  const request = ++sequence, filter = source.value;
  catalogue.setAttribute('aria-busy', 'true');
  const options = size === 4096 ? [...SIZES].reverse().filter(value => !origin.value || value === Number(origin.value)) : [size];
  const indexes = filter && filter !== 'atlas' ? [] : await Promise.allSettled(options.map(async rows => [rows, await catalogueIndex(rows)]));
  if (sequence !== request) return;
  const atlasFailed = indexes.some(result => result.status === 'rejected');
  const atlas = indexes.flatMap(result => {
    if (result.status !== 'fulfilled') return [];
    const [rows, index] = result.value;
    if (!entriesByIndex.has(index)) entriesByIndex.set(index, index.ids.map((number, offset) => atlasEntry(rows, number, offset, index)));
    return entriesByIndex.get(index);
  }).filter(searchMatch);
  const libraries = !filter || filter === 'library' ? currentLibrary() : [];
  const trays = !filter || filter === 'tray' ? local.filter(entry => entry.source === 'tray' && inTab(entry) && searchMatch(entry)) : [];
  const entries = [...trays, ...libraries, ...atlas];
  const totalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  page = Math.max(0, Math.min(page, totalPages - 1));
  const items = entries.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  let failed = atlasFailed;
  await Promise.all(items.filter(entry => entry.atlas).map(async entry => {
    try { await figureAsset(entry); }
    catch { failed = true; }
  }));
  if (sequence !== request) return;
  currentEntries = new Map(items.map(entry => [entry.key, entry]));
  catalogue.replaceChildren(...items.map(card));
  catalogue.setAttribute('aria-busy', 'false');
  indexCount(entries.length);
  $('pagination').hidden = totalPages === 1;
  $('previous-page').disabled = page === 0;
  $('next-page').disabled = page === totalPages - 1;
  $('page-number').textContent = (page + 1) + ' / ' + format(totalPages);
  catalogueStatus.textContent = [failed ? 'Часть Атласа пока недоступна.' : '',
    localError && filter !== 'atlas' ? 'Не удалось прочитать часть шаблонов из памяти браузера.' : '',
    entries.length ? '' : 'В этой вкладке нет шаблонов по выбранным условиям.'].filter(Boolean).join(' ');
}

function refresh() {
  page = 0;
  showStatistics();
  render();
}

function switchSize(next, updateAddress) {
  size = next;
  if (updateAddress) {
    const url = new URL(location.href);
    url.searchParams.set('size', size);
    history.pushState({}, '', url);
  }
  for (const tab of tabs) {
    if (Number(tab.dataset.size) === size) tab.setAttribute('aria-current', 'page');
    else tab.removeAttribute('aria-current');
  }
  $('origin-label').hidden = size !== 4096;
  refresh();
}

for (const tab of tabs) tab.addEventListener('click', event => {
  if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  const next = Number(tab.dataset.size);
  if (next !== size) switchSize(next, true);
});
addEventListener('popstate', () => switchSize(selectedSize(), false));
for (const control of [query, source, origin]) control.addEventListener('input', refresh);

function filterLibrary() {
  source.value = 'library';
  refresh();
}
for (const id of libraryControls) $(id).addEventListener('input', filterLibrary);
$('library-reset').onclick = () => {
  for (const id of libraryControls) $(id).value = id === 'library-sort' ? 'n' : '';
  exactCells = null;
  refresh();
};
$('library-csv').onclick = async () => {
  const quote = value => '"' + String(value ?? '').replaceAll('"', '""') + '"';
  const records = currentLibrary().map(entry => [
    entry.name, entry.n, entry.bit, entry.width, entry.height, entry.fam, entry.count, entry.bits
  ].map(quote).join(';'));
  try {
    await navigator.clipboard.writeText(['название;бит;1/0;ширина;высота;цвет;встреч;бит всего', ...records].join('\n'));
    catalogueStatus.textContent = 'Скопировано шаблонов: ' + format(records.length);
  } catch {
    catalogueStatus.textContent = 'Не удалось скопировать CSV.';
  }
};
for (const [id, shift] of [['previous-page', -1], ['next-page', 1]]) {
  $(id).onclick = () => {
    page += shift;
    render();
    $('catalogue-heading').scrollIntoView({ block: 'start' });
  };
}
for (const button of document.querySelectorAll('.catalogue .gz-hx > span')) button.textContent = caption(button.textContent);
switchSize(size, false);
catalogueStatus.textContent = 'Загружаю шаблоны…';
loadLocal();
addEventListener('focus', loadLocal);
