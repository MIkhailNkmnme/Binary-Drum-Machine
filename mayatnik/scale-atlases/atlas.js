import './indexed-png.js?v=2';

const byId = id => document.getElementById(id);
const rows = byId('rows');
const frame = byId('frame');
const factor = byId('factor');
const order = byId('order');
const page = byId('page');
const previous = byId('previous');
const next = byId('next');
const pageCount = byId('page-count');
const hideEmpty = byId('hide-empty');
const catalogStatus = byId('catalog-status');
const tiles = byId('tiles');
const mode = byId('mode');
const phaseMode = byId('phase-mode');
const compositionStatus = byId('composition-status');
const saveComposition = byId('save-composition');
const surface = byId('composition-surface');
const board = byId('board');
const preview = byId('preview');
const previewCanvas = byId('preview-canvas');
const worker = new Worker('worker.js?v=2');
const titles = new Intl.NumberFormat('ru-RU');
const canvasArea = 16_000_000;
const streamedArea = 64_000_000;
const maxSide = 16_384;
const preferencesKey = 'mayatnik-scale-atlases-v1';
const selection = new Map();
const visibleButtons = new Map();
const indexes = new Map();
let collection, plan, previewItem, loadNumber = 0, requestNumber = 0;
let busyRequest = false, queuedRequest, exportingComposition = false;

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function button(label, action) {
  const control = element('button');
  control.type = 'button';
  if (label) caption(control, label);
  control.addEventListener('click', action);
  return control;
}

function caption(control, label) {
  control.textContent = window.HubButtonText?.shortCaption(label) || label;
  control.title = label;
  if (!control.hasAttribute('aria-label')) control.setAttribute('aria-label', label);
}

function nameOf(item) {
  return `${item.rows} · кадр ${item.frame} · ÷${item.factor} · фаза ${item.index + 1}`;
}

function filename(item) {
  return `mayatnik-${item.rows}-k${item.frame}-q${item.factor}-dx${item.dx}-dy${item.dy}.png`;
}

function fittedSize(width, height, maxWidth, maxHeight) {
  const scale = Math.min(1, maxWidth / width, maxHeight / height);
  return [Math.max(1, Math.floor(width * scale)), Math.max(1, Math.floor(height * scale))];
}

function bitmap(item, canvas = document.createElement('canvas'), maxWidth = Infinity, maxHeight = Infinity) {
  const [width, height] = fittedSize(item.width, item.height, maxWidth, maxHeight);
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  const image = context.createImageData(width, height);
  const pixels = new Uint32Array(image.data.buffer);
  if (!item.palette && width === item.width && height === item.height) {
    pixels.set(item.raster);
  } else {
    for (let y = 0; y < height; y++) {
      const offset = Math.floor(y * item.height / height) * item.width;
      for (let x = 0; x < width; x++) {
        const value = item.raster[offset + Math.floor(x * item.width / width)];
        pixels[y * width + x] = item.palette ? item.palette[value] : value;
      }
    }
  }
  context.putImageData(image, 0, 0);
  return canvas;
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = element('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

function download(canvas, name, status) {
  canvas.toBlob(blob => {
    if (!blob) {
      status.textContent = 'Не удалось создать PNG.';
      return;
    }
    downloadBlob(blob, name);
  }, 'image/png');
}

function setPageControls(loading) {
  page.disabled = loading || !plan || plan.pages === 1;
  previous.disabled = loading || !plan || plan.page === 0;
  next.disabled = loading || !plan || plan.page + 1 === plan.pages;
  if (plan) {
    page.max = String(plan.pages);
    page.value = String(plan.page + 1);
  }
  pageCount.textContent = plan ? `из ${titles.format(plan.pages)}` : '';
}

function sendPageRequest(request) {
  if (busyRequest) {
    queuedRequest = request;
    return;
  }
  busyRequest = true;
  worker.postMessage(request);
}

function requestPage(number = 0) {
  if (!collection) return;
  visibleButtons.clear();
  tiles.replaceChildren();
  const level = collection.levels.find(level => level.factor === Number(factor.value));
  const current = collection.frames[frame.selectedIndex];
  if (!level || !current) return;
  plan = null;
  const sample = level.factor === 3 ? ` · непустых фаз ${current.occupiedAt3.filter(Boolean).length} из 9` : '';
  byId('source-note').textContent = `Поле ${collection.width} × ${collection.height} · фаза ${level.width} × ${level.height} · ${titles.format(level.phases)} фаз${sample}`;
  catalogStatus.textContent = 'Рассчитываются фазы…';
  setPageControls(true);
  sendPageRequest({id: ++requestNumber, rows: collection.rows, frame: current.number, factor: level.factor, page: number});
}

function selectLevels(value) {
  const levels = collection.levels;
  const list = order.value === 'large' ? levels : [...levels].reverse();
  factor.replaceChildren(...list.map(level => new Option(`${level.width} × ${level.height} · ÷${level.factor}`, String(level.factor))));
  factor.value = levels.some(level => level.factor === value) ? String(value) : '3';
}

async function loadCollection(number, level, pageNumber = 0) {
  const request = ++loadNumber;
  requestNumber++;
  queuedRequest = null;
  plan = null;
  collection = null;
  frame.disabled = factor.disabled = order.disabled = true;
  setPageControls(true);
  tiles.replaceChildren();
  catalogStatus.textContent = 'Загрузка атласа…';
  byId('source-note').textContent = '';
  try {
    const size = Number(rows.value);
    if (!indexes.has(size)) {
      const response = await fetch(`index-${size}.json`);
      if (!response.ok) throw Error(`Атлас ${size} не открылся (HTTP ${response.status}).`);
      indexes.set(size, await response.json());
    }
    if (request !== loadNumber) return;
    collection = indexes.get(size);
    frame.replaceChildren(...collection.frames.map(({number}) => new Option(String(number), String(number))));
    if (collection.frames.some(item => item.number === number)) frame.value = String(number);
    selectLevels(level);
    frame.disabled = factor.disabled = order.disabled = false;
    requestPage(pageNumber);
  } catch (error) {
    if (request === loadNumber) catalogStatus.textContent = error.message;
  }
}

function syncSelectionButtons() {
  for (const [key, control] of visibleButtons) {
    const included = selection.has(key);
    control.setAttribute('aria-pressed', String(included));
    caption(control, included ? 'В сборке' : 'В сборку');
  }
}

function showPreview(item) {
  previewItem = item;
  byId('preview-title').textContent = nameOf(item);
  if (item.palette) bitmap(item, previewCanvas, 1024, 640);
  else bitmap(item, previewCanvas);
  preview.showModal();
}

function renderTiles() {
  if (!plan) return;
  const fragment = document.createDocumentFragment();
  const pictured = plan.items.filter(item => !hideEmpty.checked || item.occupied);
  visibleButtons.clear();
  for (const item of pictured) {
    const card = element('figure', '', 'tile');
    const inspect = button('', () => showPreview(item));
    inspect.className = 'tile-preview';
    inspect.setAttribute('aria-label', 'Рассмотреть ' + nameOf(item));
    inspect.append(item.palette ? bitmap(item, undefined, 192, 112) : bitmap(item));
    const caption = element('figcaption', `Фаза ${item.index + 1} · dx ${item.dx}, dy ${item.dy}`);
    const toggle = button('В сборку', () => togglePhase(item));
    toggle.setAttribute('aria-label', 'Фаза в сборке · ' + nameOf(item));
    visibleButtons.set(item.id, toggle);
    card.append(inspect, caption, toggle);
    fragment.append(card);
  }
  const range = `Фазы ${titles.format(plan.start + 1)}–${titles.format(plan.end)} из ${titles.format(plan.total)}`;
  catalogStatus.textContent = pictured.length ? range : `${range}. На этой странице все фазы пустые.`;
  tiles.replaceChildren(fragment);
  syncSelectionButtons();
}

function togglePhase(item) {
  if (selection.has(item.id)) {
    selection.delete(item.id);
  } else {
    const last = Array.from(selection.values()).at(-1);
    selection.set(item.id, {...item, x: last ? last.x + last.width + 4 : 0, y: last?.y || 0});
  }
  renderSelection();
  syncSelectionButtons();
}

function coordinate(item, key, phases) {
  const label = element('label', key.toUpperCase());
  const input = element('input');
  input.type = 'number';
  input.step = '1';
  input.value = item[key];
  input.disabled = phases;
  input.setAttribute('aria-label', key.toUpperCase() + ' · ' + nameOf(item));
  input.addEventListener('change', () => {
    const value = input.valueAsNumber;
    if (Number.isSafeInteger(value)) item[key] = value;
    input.value = item[key];
    drawComposition();
  });
  label.append(input);
  return label;
}

function renderSelection() {
  const items = Array.from(selection.values());
  const first = items[0];
  phaseMode.disabled = !first || !items.every(item => item.rows === first.rows && item.factor === first.factor);
  if (phaseMode.disabled) mode.value = 'free';
  const phases = mode.value === 'phases';
  const entries = items.map(item => {
    const row = element('li');
    const inspect = button('', () => showPreview(item));
    inspect.className = 'selection-preview';
    inspect.textContent = `${nameOf(item)} · ${item.width} × ${item.height}`;
    inspect.setAttribute('aria-label', 'Рассмотреть ' + nameOf(item));
    const placement = element('div', '', 'placement');
    const remove = button('Убрать', () => togglePhase(item));
    remove.setAttribute('aria-label', 'Убрать из сборки · ' + nameOf(item));
    placement.append(coordinate(item, 'x', phases), coordinate(item, 'y', phases), remove);
    row.append(inspect, placement);
    return row;
  });
  byId('selection').replaceChildren(...entries);
  drawComposition();
}

function setBoard(width, height) {
  board.width = width;
  board.height = height;
  return board.getContext('2d');
}

function drawPhases(items, width, height) {
  const context = setBoard(width, height);
  const image = context.createImageData(width, height);
  const pixels = new Uint32Array(image.data.buffer);
  for (const item of items) {
    for (let y = 0; y < item.validHeight; y++) {
      const row = (item.factor * y + item.dy) * width + item.dx;
      for (let x = 0; x < item.validWidth; x++) {
        const colour = item.raster[y * item.width + x];
        if (colour) pixels[row + item.factor * x] = colour;
      }
    }
  }
  context.putImageData(image, 0, 0);
}

function drawLargePreview(items, {width, height, left = 0, top = 0}, aligned) {
  const [previewWidth, previewHeight] = fittedSize(width, height, 960, 640);
  const context = setBoard(previewWidth, previewHeight);
  const image = context.createImageData(previewWidth, previewHeight);
  const pixels = new Uint32Array(image.data.buffer);
  const factor = aligned ? items[0].factor : 1;
  const yStep = Math.max(1, Math.floor(height / (previewHeight * factor)));
  const xStep = Math.max(1, Math.floor(width / (previewWidth * factor)));
  for (const item of items) {
    const dx = aligned ? item.dx : item.x - left;
    const dy = aligned ? item.dy : item.y - top;
    const tileWidth = aligned ? item.validWidth : item.width;
    const tileHeight = aligned ? item.validHeight : item.height;
    for (let y = 0; y < tileHeight; y += yStep) {
      const row = Math.floor((factor * y + dy) * previewHeight / height) * previewWidth;
      for (let x = 0; x < tileWidth; x += xStep) {
        const colour = item.palette[item.raster[y * item.width + x]];
        if (colour) {
          const column = Math.floor((factor * x + dx) * previewWidth / width);
          pixels[row + column] = colour;
        }
      }
    }
  }
  context.putImageData(image, 0, 0);
}

function freeLayout(items) {
  let {x: left, y: top} = items[0];
  for (const item of items) {
    left = Math.min(left, item.x);
    top = Math.min(top, item.y);
  }
  let width = 0, height = 0;
  for (const item of items) {
    width = Math.max(width, item.x - left + item.width);
    height = Math.max(height, item.y - top + item.height);
  }
  const area = width * height;
  const limit = items.every(item => item.palette) ? streamedArea : canvasArea;
  const tooLarge = width > maxSide || height > maxSide || area > limit;
  return {left, top, width, height, limit, tooLarge, streamed: area > canvasArea && !tooLarge};
}

function drawComposition() {
  const items = Array.from(selection.values());
  const first = items[0];
  surface.hidden = !first;
  saveComposition.disabled = !first || exportingComposition;
  if (!first) {
    compositionStatus.textContent = 'Добавьте фазы из каталога.';
    return;
  }

  let width, height;
  if (mode.value === 'phases') {
    width = first.sourceWidth;
    height = first.sourceHeight;
    if (first.palette) drawLargePreview(items, {width, height}, true);
    else drawPhases(items, width, height);
  } else {
    const layout = freeLayout(items);
    ({width, height} = layout);
    if (layout.tooLarge) {
      compositionStatus.textContent = `Допустимо до ${titles.format(layout.limit)} пикселей и ${titles.format(maxSide)} по стороне. Сдвиньте фигуры ближе друг к другу.`;
      saveComposition.disabled = surface.hidden = true;
      return;
    }
    if (layout.streamed) {
      drawLargePreview(items, layout, false);
    } else {
      const context = setBoard(width, height);
      const tile = document.createElement('canvas');
      for (const item of items) context.drawImage(bitmap(item, tile), item.x - layout.left, item.y - layout.top);
    }
  }
  compositionStatus.textContent = `Фаз в сборке ${items.length} · ${width} × ${height} пикселей`;
}

async function downloadComposition() {
  const items = Array.from(selection.values());
  if (!items.length || exportingComposition) return;
  const name = 'mayatnik-sborka-faz.png';
  const aligned = mode.value === 'phases';
  const layout = aligned ? null : freeLayout(items);
  if (layout?.tooLarge) return;
  if (!(aligned ? items[0].palette : layout.streamed)) {
    download(board, name, compositionStatus);
    return;
  }
  exportingComposition = saveComposition.disabled = true;
  try {
    const encoder = globalThis.MayatnikScaleAtlasPng;
    const file = await (aligned ? encoder.compose(items) : encoder.composeFree(items, layout));
    downloadBlob(file, name);
  } catch (_) {
    compositionStatus.textContent = 'Не удалось создать PNG исходного размера.';
  } finally {
    exportingComposition = false;
    saveComposition.disabled = surface.hidden;
  }
}

worker.onmessage = ({data}) => {
  busyRequest = false;
  const waiting = queuedRequest;
  queuedRequest = null;
  if (waiting?.id === requestNumber) sendPageRequest(waiting);
  if (data.id !== requestNumber || !collection) return;
  if (data.error) {
    catalogStatus.textContent = data.error;
    setPageControls(false);
    return;
  }
  plan = {...data.plan, items: data.plan.items.map(item => ({...item,
    rows: collection.rows, frame: Number(frame.value), id: `${collection.rows}:${frame.value}:${item.key}`
  }))};
  setPageControls(false);
  renderTiles();
  saveBrowse();
};
worker.onerror = () => {
  busyRequest = false;
  queuedRequest = null;
  catalogStatus.textContent = 'Не удалось запустить расчёт фаз. Обновите страницу.';
};
rows.addEventListener('change', () => loadCollection(undefined, Number(factor.value)));
frame.addEventListener('change', () => requestPage());
factor.addEventListener('change', () => requestPage());
order.addEventListener('change', () => { if (collection) selectLevels(Number(factor.value)); saveBrowse(); });
page.addEventListener('change', () => requestPage(Math.max(0, page.valueAsNumber - 1)));
previous.addEventListener('click', () => requestPage(plan.page - 1));
next.addEventListener('click', () => requestPage(plan.page + 1));
hideEmpty.addEventListener('change', () => { renderTiles(); saveBrowse(); });
mode.addEventListener('change', renderSelection);
saveComposition.addEventListener('click', downloadComposition);
byId('save-phase').addEventListener('click', () => {
  if (!previewItem) return;
  const canvas = previewItem.palette ? bitmap(previewItem) : previewCanvas;
  download(canvas, filename(previewItem), byId('preview-title'));
});
preview.addEventListener('close', () => {
  previewItem = null;
  previewCanvas.width = previewCanvas.height = 0;
});

function saveBrowse() {
  if (!plan || !collection) return;
  try {
    localStorage.setItem(preferencesKey, JSON.stringify({rows: rows.value, frame: Number(frame.value),
      factor: Number(factor.value), page: plan.page, order: order.value, hideEmpty: hideEmpty.checked}));
  } catch (_) { /* Browsing also works without local storage. */ }
}

for (const control of document.querySelectorAll('button')) caption(control, control.textContent);
const params = new URLSearchParams(location.search);
let preferences = {};
try { preferences = JSON.parse(localStorage.getItem(preferencesKey) || '{}') || {}; } catch (_) {}
const initialRows = params.get('rows') || preferences.rows;
if (Array.from(rows.options).some(option => option.value === initialRows)) rows.value = initialRows;
if (preferences.order === 'small') order.value = 'small';
if (preferences.hideEmpty === false) hideEmpty.checked = false;
loadCollection(Number(params.get('frame') ?? preferences.frame), Number(params.get('factor') ?? preferences.factor),
  params.has('rows') ? 0 : preferences.page);
