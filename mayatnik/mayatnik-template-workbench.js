const STORE = 'template-workbench-v1';
export const dragType = 'application/x-zerkalius-template';
export const FIELD_WIDTH = 12286;
export const FIELD_HEIGHT = 4096;
export const FIELD_AXIS = 6143;

const PAGE = 2048;
const ROW_HEIGHT = 26;
const HISTORY_LIMIT = 60;
const rotations = [[1, 0, 0, 1], [0, 1, -1, 0], [-1, 0, 0, -1], [0, -1, 1, 0]];
const directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
const cell = (value, max) => Math.max(0, Math.min(max, Math.round(value)));
const zoomLimit = value => Math.max(1 / 16384, Math.min(32, value));
const colourValue = value => /^#[0-9a-f]{6}$/i.test(value) ? value : null;
const defaultColour = '#ffd778';

function bounds(layer) {
  const { width, height } = layer.sprite;
  const x = -Math.floor(width / 2), y = -Math.floor(height / 2);
  const [a, b, c, d] = rotations[layer.turn];
  const x1 = a * x + c * y, y1 = b * x + d * y;
  const x2 = a * (x + width) + c * (y + height), y2 = b * (x + width) + d * (y + height);
  return { x: layer.x + Math.min(x1, x2), y: layer.y + Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) };
}

function rasterSprite(canvas) {
  const { width, height } = canvas;
  if (width < 1 || height < 1) throw Error('В шаблоне нет клеток.');
  const rgba = canvas.getContext('2d').getImageData(0, 0, width, height).data;
  return { width, height, rgba, region: { image: canvas, x: 0, y: 0 } };
}

function storedRaster({ width, height, rgba }) {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 ||
      !(rgba instanceof Uint8ClampedArray) || rgba.length !== width * height * 4) throw Error('Повреждён сохранённый шаблон.');
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').putImageData(new ImageData(rgba, width, height), 0, 0);
  return { width, height, rgba, region: { image: canvas, x: 0, y: 0 } };
}

function packedAtlases() {
  // Open shelves of different heights share each raster surface.
  const shelves = new Map();
  let surface = null, nextRow = PAGE;
  return (picture, { width, height }) => {
    if (width > PAGE || height > PAGE) return { image: picture, x: 0, y: 0 };
    const rowHeight = 2 ** Math.ceil(Math.log2(height));
    let shelf = shelves.get(rowHeight);
    if (!shelf || shelf.x + width > PAGE) {
      if (nextRow + rowHeight > PAGE) {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = PAGE;
        surface = { canvas, context: canvas.getContext('2d') };
        nextRow = 0;
      }
      shelf = { ...surface, x: 0, y: nextRow };
      nextRow += rowHeight;
      shelves.set(rowHeight, shelf);
    }
    const x = shelf.x, y = shelf.y;
    shelf.context.drawImage(picture, x, y);
    shelf.x += width;
    return { image: shelf.canvas, x, y };
  };
}

export function mountWorkbench({ resolveAtlas, resolveEntry, describe, atlasImage, caption }) {
  const $ = id => document.getElementById(id);
  const field = $('field'), context = field.getContext('2d');
  const list = $('field-layers'), status = $('field-status'), empty = $('field-empty');
  const xInput = $('layer-x'), yInput = $('layer-y');
  const layerColour = $('layer-colour'), allColour = $('all-colour');
  const undoButton = $('composition-undo'), redoButton = $('composition-redo');
  const up = $('layer-up'), down = $('layer-down'), remove = $('layer-remove');
  const left = $('turn-left'), right = $('turn-right');
  const sampler = document.createElement('canvas');
  sampler.width = sampler.height = 1;
  const sample = sampler.getContext('2d', { willReadFrequently: true });
  const tintCanvas = document.createElement('canvas'), tint = tintCanvas.getContext('2d');
  const pack = packedAtlases(), layers = [], sprites = new Map();
  const undoActions = [], redoActions = [];
  let active = null, drag = null, serial = 0, drawFrame = 0, saveTimer = 0;
  let camera = null, fitted = true, writes = Promise.resolve();
  let queue = [], nextDecode = 0, decoding = 0;

  const tell = message => { status.textContent = message; };
  const view = () => ({ width: field.clientWidth, height: field.clientHeight });

  function overview() {
    const { width, height } = view();
    const zoom = zoomLimit(Math.min(Math.max(1, width - 24) / FIELD_WIDTH, Math.max(1, height - 24) / FIELD_HEIGHT));
    return { x: (width - FIELD_WIDTH * zoom) / 2, y: (height - FIELD_HEIGHT * zoom) / 2, zoom };
  }

  function asWorld(x, y) {
    const current = camera ?? overview();
    return { x: (x - current.x) / current.zoom, y: (y - current.y) / current.zoom };
  }

  function decodeVisible() {
    while (decoding < 8 && nextDecode < queue.length) {
      const sprite = queue[nextDecode++];
      if (sprite.loading || sprite.region || sprite.failed) continue;
      sprite.loading = true;
      decoding++;
      const entry = sprite.entry ?? resolveAtlas(sprite.atlas);
      Promise.resolve(entry).then(atlasImage).then(picture => {
        sprite.region = pack(picture, sprite);
      }).catch(() => {
        sprite.failed = true;
        tell('Часть фигур Атласа не удалось отобразить.');
      }).finally(() => {
        decoding--;
        sprite.loading = false;
        redraw();
        decodeVisible();
      });
    }
  }

  function drawGrid(width, height, ratio) {
    const { x, y, zoom } = camera, x2 = x + FIELD_WIDTH * zoom, y2 = y + FIELD_HEIGHT * zoom;
    if (x >= width || y >= height || x2 <= 0 || y2 <= 0) return;
    context.fillStyle = '#111720';
    context.fillRect(x, y, x2 - x, y2 - y);
    const interval = zoom >= 5 ? 1 : 2 ** Math.ceil(Math.log2(16 / zoom));
    const stride = interval * zoom;
    const align = value => (Math.floor(value * ratio) + .5) / ratio;
    context.strokeStyle = '#273649';
    context.lineWidth = 1 / ratio;
    context.beginPath();
    for (let xx = x + Math.max(0, Math.ceil(-x / stride)) * stride; xx < Math.min(width, x2); xx += stride) {
      context.moveTo(align(xx), Math.max(0, y));
      context.lineTo(align(xx), Math.min(height, y2));
    }
    for (let yy = y + Math.max(0, Math.ceil(-y / stride)) * stride; yy < Math.min(height, y2); yy += stride) {
      context.moveTo(Math.max(0, x), align(yy));
      context.lineTo(Math.min(width, x2), align(yy));
    }
    context.stroke();
    context.strokeStyle = '#506079';
    context.strokeRect(x, y, x2 - x, y2 - y);
    const axis = align(x + (FIELD_AXIS + .5) * zoom);
    context.beginPath();
    context.moveTo(axis, y);
    context.lineTo(axis, y2);
    context.stroke();
  }

  function drawRaster(target, layer, box) {
    const { sprite } = layer, region = sprite.region;
    if (!layer.turn && !layer.mirrored) {
      target.drawImage(region.image, region.x, region.y, sprite.width, sprite.height, box.x, box.y, sprite.width, sprite.height);
      return;
    }
    target.save();
    target.transform(...rotations[layer.turn], layer.x, layer.y);
    target.translate(-Math.floor(sprite.width / 2), -Math.floor(sprite.height / 2));
    if (layer.mirrored) { target.translate(sprite.width, 0); target.scale(-1, 1); }
    target.drawImage(region.image, region.x, region.y, sprite.width, sprite.height, 0, 0, sprite.width, sprite.height);
    target.restore();
  }

  function drawLayers(start, end, ratio, priority) {
    const zoom = camera.zoom * ratio, x = camera.x * ratio, y = camera.y * ratio;
    let colour = null, left, top, right, bottom;
    // Adjacent layers with the same ink need only one alpha mask in the viewport.
    function flushTint() {
      if (!colour) return;
      const width = right - left, height = bottom - top;
      tint.setTransform(1, 0, 0, 1, 0, 0);
      tint.globalCompositeOperation = 'source-in';
      tint.fillStyle = colour;
      tint.fillRect(left, top, width, height);
      tint.globalCompositeOperation = 'source-over';
      context.save();
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.drawImage(tintCanvas, left, top, width, height, left, top, width, height);
      context.restore();
      tint.clearRect(left, top, width, height);
      colour = null;
    }
    for (const layer of layers) {
      const sprite = layer.sprite, box = bounds(layer);
      if (box.x + box.width <= start.x || box.x >= end.x || box.y + box.height <= start.y || box.y >= end.y) continue;
      if (!sprite.region) {
        if (!sprite.loading && !sprite.failed) priority.add(sprite);
        continue;
      }
      const ink = layer.colour ?? null;
      if (ink !== colour) flushTint();
      if (!ink) { drawRaster(context, layer, box); continue; }
      if (!colour) {
        colour = ink;
        left = field.width; top = field.height; right = bottom = 0;
        if (tintCanvas.width !== field.width) tintCanvas.width = field.width;
        if (tintCanvas.height !== field.height) tintCanvas.height = field.height;
        tint.imageSmoothingEnabled = false;
        tint.setTransform(zoom, 0, 0, zoom, x, y);
      }
      drawRaster(tint, layer, box);
      left = Math.min(left, Math.max(0, Math.floor(x + box.x * zoom)));
      top = Math.min(top, Math.max(0, Math.floor(y + box.y * zoom)));
      right = Math.max(right, Math.min(field.width, Math.ceil(x + (box.x + box.width) * zoom)));
      bottom = Math.max(bottom, Math.min(field.height, Math.ceil(y + (box.y + box.height) * zoom)));
    }
    flushTint();
  }

  function draw() {
    const { width, height } = view();
    if (!width || !height) return;
    if (!camera || fitted) camera = overview();
    const ratio = Math.min(2, devicePixelRatio || 1);
    const canvasWidth = Math.round(width * ratio), canvasHeight = Math.round(height * ratio);
    if (field.width !== canvasWidth) field.width = canvasWidth;
    if (field.height !== canvasHeight) field.height = canvasHeight;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    drawGrid(width, height, ratio);
    const start = asWorld(0, 0), end = asWorld(width, height);
    const priority = new Set(active?.sprite.atlas && !active.sprite.region ? [active.sprite] : []);
    context.save();
    context.translate(camera.x, camera.y);
    context.scale(camera.zoom, camera.zoom);
    context.beginPath();
    context.rect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);
    context.clip();
    context.imageSmoothingEnabled = false;
    drawLayers(start, end, ratio, priority);
    if (active) {
      const box = bounds(active);
      context.strokeStyle = '#ffd778';
      context.lineWidth = 1.5 / camera.zoom;
      context.strokeRect(box.x, box.y, box.width, box.height);
    }
    context.restore();
    $('zoom-level').textContent = '×' + Number(camera.zoom.toPrecision(3)).toLocaleString('ru-RU', { maximumFractionDigits: 5 });
    queue = [...priority];
    nextDecode = 0;
    decodeVisible();
  }

  function redraw() {
    if (!drawFrame) drawFrame = requestAnimationFrame(() => { drawFrame = 0; draw(); });
  }

  function contains(layer, x, y) {
    const { sprite } = layer;
    if (!sprite.region) return false;
    const [a, b, c, d] = rotations[layer.turn], dx = x - layer.x, dy = y - layer.y;
    let px = Math.floor(a * dx + b * dy + Math.floor(sprite.width / 2));
    const py = Math.floor(c * dx + d * dy + Math.floor(sprite.height / 2));
    if (px < 0 || py < 0 || px >= sprite.width || py >= sprite.height) return false;
    if (layer.mirrored) px = sprite.width - 1 - px;
    if (sprite.rgba) return sprite.rgba[(py * sprite.width + px) * 4 + 3] !== 0;
    const { image, x: sx, y: sy } = sprite.region;
    sample.clearRect(0, 0, 1, 1);
    sample.drawImage(image, sx + px, sy + py, 1, 1, 0, 0, 1, 1);
    return sample.getImageData(0, 0, 1, 1).data[3] !== 0;
  }

  function scene() {
    const assets = [...new Map(layers.map(layer => [layer.key, layer.sprite]))];
    return {
      fieldWidth: FIELD_WIDTH, fitted, camera: { ...camera }, active: active?.id,
      sprites: assets.map(([key, sprite]) => ({ key, width: sprite.width, height: sprite.height,
        ...(sprite.atlas ? { atlas: sprite.atlas } : { rgba: sprite.rgba }) })),
      layers: layers.map(({ id, key, name, x, y, turn, mirrored, colour }) => ({ id, key, name, x, y, turn, mirrored, colour }))
    };
  }

  function save() {
    const data = scene();
    writes = writes.then(() => MayatnikPaintCache.write(data, STORE))
      .catch(() => tell('Браузер не сохранил поле композиции.'));
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { saveTimer = 0; save(); }, 220);
  }

  function syncHistory() {
    if (undoButton) undoButton.disabled = !undoActions.length || !!drag?.layer;
    if (redoButton) redoButton.disabled = !redoActions.length || !!drag?.layer;
  }

  function rememberAction(undo, redo, before = active, after = active) {
    undoActions.push({ undo, redo, before, after });
    if (undoActions.length > HISTORY_LIMIT) undoActions.shift();
    redoActions.length = 0;
    syncHistory();
    scheduleSave();
  }

  function historyStep(backward) {
    if (drag?.layer) return;
    const from = backward ? undoActions : redoActions, to = backward ? redoActions : undoActions;
    const action = from.pop();
    if (!action) return;
    if (backward) action.undo();
    else action.redo();
    to.push(action);
    select(backward ? action.before : action.after);
    scheduleSave();
  }

  addEventListener('pagehide', () => {
    if (!saveTimer) return;
    clearTimeout(saveTimer);
    saveTimer = 0;
    save();
  });

  function updateCoordinates() {
    xInput.value = active?.x ?? '';
    yInput.value = active?.y ?? '';
  }

  function updateColours() {
    if (layerColour) {
      layerColour.disabled = !active;
      layerColour.value = active?.colour ?? defaultColour;
    }
    if (allColour) {
      allColour.disabled = !layers.length;
      const ink = layers[0]?.colour;
      allColour.value = ink && layers.every(layer => layer.colour === ink) ? ink : defaultColour;
    }
  }

  function renderLayerList() {
    const focusId = Number(document.activeElement?.dataset.layer);
    const begin = Math.max(0, Math.floor(list.scrollTop / ROW_HEIGHT) - 2);
    const count = Math.ceil((list.clientHeight || 104) / ROW_HEIGHT) + 5;
    const track = document.createElement('li');
    track.className = 'layer-track';
    track.style.height = layers.length * ROW_HEIGHT + 'px';
    track.setAttribute('aria-hidden', 'true');
    const nodes = [track];
    let focus = null;
    for (let row = begin; row < Math.min(layers.length, begin + count); row++) {
      const layer = layers[layers.length - 1 - row];
      const item = document.createElement('li'), button = document.createElement('button'), name = document.createElement('span');
      item.className = 'layer-row';
      item.style.top = row * ROW_HEIGHT + 'px';
      item.setAttribute('aria-posinset', row + 1);
      item.setAttribute('aria-setsize', layers.length);
      button.type = 'button';
      button.className = 'gz-hx layer-label';
      button.title = layer.name;
      button.dataset.layer = layer.id;
      button.setAttribute('aria-pressed', String(layer === active));
      name.textContent = layer.name;
      button.append(name);
      button.onclick = () => { select(layer, false); scheduleSave(); };
      item.append(button);
      nodes.push(item);
      if (layer.id === focusId) focus = button;
    }
    list.replaceChildren(...nodes);
    focus?.focus({ preventScroll: true });
  }

  function select(layer, reveal = true) {
    active = layer;
    const index = layers.indexOf(layer);
    xInput.disabled = yInput.disabled = left.disabled = right.disabled = remove.disabled = index < 0;
    up.disabled = index < 0 || index === layers.length - 1;
    down.disabled = index < 1;
    empty.hidden = layers.length !== 0;
    list.hidden = layers.length === 0;
    if (reveal && index >= 0) {
      const row = (layers.length - 1 - index) * ROW_HEIGHT;
      if (row < list.scrollTop || row + ROW_HEIGHT > list.scrollTop + list.clientHeight) list.scrollTop = row;
    }
    renderLayerList();
    updateCoordinates();
    updateColours();
    syncHistory();
    redraw();
  }

  function position(event) {
    const rect = field.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function zoomAt(multiplier, point) {
    if (!point) {
      const { width, height } = view();
      point = { x: width / 2, y: height / 2 };
    }
    const current = asWorld(point.x, point.y), zoom = zoomLimit((camera ?? overview()).zoom * multiplier);
    camera = { x: point.x - current.x * zoom, y: point.y - current.y * zoom, zoom };
    fitted = false;
    redraw();
    scheduleSave();
  }

  function fit() {
    fitted = true;
    camera = overview();
    redraw();
    scheduleSave();
  }

  function showLayer(layer) {
    const box = bounds(layer), { width, height } = view(), existing = camera ?? overview();
    if (box.x * existing.zoom + existing.x >= 0 && (box.x + box.width) * existing.zoom + existing.x <= width &&
        box.y * existing.zoom + existing.y >= 0 && (box.y + box.height) * existing.zoom + existing.y <= height &&
        Math.max(box.width, box.height) * existing.zoom >= 24) return;
    const zoom = zoomLimit(Math.min(12, (width - 30) / box.width, (height - 30) / box.height));
    camera = { x: width / 2 - (box.x + box.width / 2) * zoom, y: height / 2 - (box.y + box.height / 2) * zoom, zoom };
    fitted = false;
  }

  function move(layer, x, y) {
    layer.x = cell(x, FIELD_WIDTH);
    layer.y = cell(y, FIELD_HEIGHT);
    updateCoordinates();
    redraw();
  }

  function rememberMove(layer, x, y) {
    const nextX = layer.x, nextY = layer.y;
    if (x === nextX && y === nextY) return false;
    rememberAction(
      () => { layer.x = x; layer.y = y; },
      () => { layer.x = nextX; layer.y = nextY; }, layer, layer
    );
    return true;
  }

  function moveWithHistory(layer, x, y) {
    const previousX = layer.x, previousY = layer.y;
    move(layer, x, y);
    rememberMove(layer, previousX, previousY);
  }

  function reorder(offset) {
    const from = layers.indexOf(active), to = from + offset;
    if (from < 0 || to < 0 || to >= layers.length) return;
    const swap = () => { [layers[from], layers[to]] = [layers[to], layers[from]]; };
    swap();
    select(active);
    rememberAction(swap, swap);
  }

  function rotate(offset) {
    if (!active) return;
    const layer = active, before = layer.turn, after = (before + offset + 4) % 4;
    layer.turn = after;
    redraw();
    rememberAction(() => { layer.turn = before; }, () => { layer.turn = after; });
  }

  function deleteLayer() {
    const index = layers.indexOf(active);
    if (index < 0 || drag?.layer) return;
    const layer = active;
    const erase = () => layers.splice(index, 1);
    erase();
    const next = layers[Math.min(index, layers.length - 1)] ?? null;
    select(next);
    rememberAction(() => layers.splice(index, 0, layer), erase, layer, next);
  }

  async function makeLayer(entry, point) {
    const source = await describe(entry);
    let sprite = sprites.get(entry.key);
    if (!sprite) {
      sprite = entry.atlas ? { width: source.width, height: source.height, atlas: entry.atlas, entry } : rasterSprite(source.canvas);
      sprites.set(entry.key, sprite);
    }
    const x = point?.x ?? (source.x + Math.floor(sprite.width / 2));
    const y = point?.y ?? (source.y + Math.floor(sprite.height / 2));
    return { key: entry.key, name: entry.name, id: ++serial, x: cell(x, FIELD_WIDTH), y: cell(y, FIELD_HEIGHT),
      turn: 0, mirrored: !!source.mirrored, sprite };
  }

  async function restore() {
    try {
      const saved = await MayatnikPaintCache.read(STORE);
      if (!saved || !Array.isArray(saved.layers) || !Array.isArray(saved.sprites)) return;
      const loaded = await Promise.allSettled(saved.sprites.map(async record => {
        if (!record.atlas) return [record.key, storedRaster(record)];
        const dimensions = Number.isSafeInteger(record.width) && Number.isSafeInteger(record.height) ?
          record : await describe(await resolveAtlas(record.atlas));
        return [record.key, { atlas: record.atlas, width: dimensions.width, height: dimensions.height }];
      }));
      for (const result of loaded) if (result.status === 'fulfilled') sprites.set(...result.value);
      const oldX = saved.fieldWidth ? 0 : FIELD_AXIS, oldY = saved.fieldWidth ? 0 : FIELD_HEIGHT / 2;
      for (const layer of saved.layers) {
        const sprite = sprites.get(layer.key);
        if (!sprite || !Number.isSafeInteger(layer.id) || !Number.isFinite(layer.x) || !Number.isFinite(layer.y)) continue;
        layers.push({ ...layer, x: cell(layer.x + oldX, FIELD_WIDTH), y: cell(layer.y + oldY, FIELD_HEIGHT),
          turn: rotations[layer.turn] ? layer.turn : 0, colour: colourValue(layer.colour), sprite });
        serial = Math.max(serial, layer.id);
      }
      if ([saved.camera?.x, saved.camera?.y, saved.camera?.zoom].every(Number.isFinite)) {
        const zoom = zoomLimit(saved.camera.zoom);
        camera = { x: saved.camera.x - oldX * zoom, y: saved.camera.y - oldY * zoom, zoom };
        fitted = saved.fitted ?? !layers.length;
      }
      active = layers.find(layer => layer.id === saved.active) ?? layers.at(-1) ?? null;
      if (layers.length !== saved.layers.length) tell('Часть сохранённых фигур сейчас недоступна.');
    } catch {
      tell('Не удалось загрузить сохранённое поле.');
    } finally {
      select(active);
    }
  }

  let addQueue = restore();
  function enqueue(action) {
    addQueue = addQueue.then(action).catch(error => tell(error?.message || 'Не удалось добавить фигуру.'));
    return addQueue;
  }

  function placeLayers(added, selection) {
    if (!added.length) return;
    const index = layers.length, previous = active;
    const place = () => { for (const layer of added) layers.push(layer); };
    place();
    select(selection);
    rememberAction(() => { layers.length = index; }, place, previous, selection);
  }

  function add(entry, point = null) {
    return enqueue(async () => {
      const layer = await makeLayer(entry, point);
      if (!point && !drag) showLayer(layer);
      placeLayers([layer], drag?.layer ?? layer);
      tell('На поле: ' + layer.name);
    });
  }

  function addAll(entries) {
    return enqueue(async () => {
      const known = new Set(layers.map(layer => layer.key)), pending = entries.filter(entry => !known.has(entry.key));
      const prepared = [];
      let failed = 0;
      for (let start = 0; start < pending.length; start += 192) {
        tell('Добавляю шаблоны: ' + start.toLocaleString('ru-RU') + ' / ' + pending.length.toLocaleString('ru-RU'));
        const group = await Promise.allSettled(pending.slice(start, start + 192).map(entry => makeLayer(entry)));
        for (const result of group) {
          if (result.status === 'fulfilled') prepared.push(result.value);
          else failed++;
        }
        await new Promise(resolve => requestAnimationFrame(resolve));
      }
      // Editing can continue while the catalogue loads. Commit the prepared insertion as one action.
      const placed = new Set(layers.map(layer => layer.key));
      const added = prepared.filter(layer => !placed.has(layer.key));
      placeLayers(added, active ?? added.at(-1));
      if (!drag) fit();
      tell('Добавлено: ' + added.length.toLocaleString('ru-RU') + (failed ? ' · недоступно: ' + failed.toLocaleString('ru-RU') : ''));
    });
  }

  $('zoom-in').onclick = () => zoomAt(Math.SQRT2);
  $('zoom-out').onclick = () => zoomAt(Math.SQRT1_2);
  $('fit-field').onclick = fit;
  undoButton?.addEventListener('click', () => historyStep(true));
  redoButton?.addEventListener('click', () => historyStep(false));
  layerColour?.addEventListener('change', () => {
    if (!active) return;
    const layer = active, before = layer.colour, after = layerColour.value;
    if (before === after) return;
    layer.colour = after;
    updateColours();
    redraw();
    rememberAction(() => { layer.colour = before; }, () => { layer.colour = after; });
  });
  allColour?.addEventListener('change', () => {
    const ink = allColour.value, previous = new Map();
    for (const layer of layers) {
      if (layer.colour === ink) continue;
      const before = layer.colour;
      if (!previous.has(before)) previous.set(before, []);
      previous.get(before).push(layer);
      layer.colour = ink;
    }
    if (!previous.size) return;
    const recolour = restore => {
      for (const [before, group] of previous) for (const layer of group) layer.colour = restore ? before : ink;
    };
    updateColours();
    redraw();
    rememberAction(() => recolour(true), () => recolour(false));
  });
  left.onclick = () => rotate(-1);
  right.onclick = () => rotate(1);
  up.onclick = () => reorder(1);
  down.onclick = () => reorder(-1);
  remove.onclick = deleteLayer;
  list.addEventListener('scroll', renderLayerList, { passive: true });
  for (const input of [xInput, yInput]) input.onchange = () => {
    if (!active) return;
    const value = input.valueAsNumber;
    if (!Number.isFinite(value)) { updateCoordinates(); return; }
    moveWithHistory(active, input === xInput ? value : active.x, input === yInput ? value : active.y);
  };

  function keyMove(event) {
    const direction = directions[event.key];
    if (!direction || !active || drag?.layer || event.ctrlKey || event.metaKey || event.altKey) return;
    event.preventDefault();
    const step = event.shiftKey ? 10 : 1;
    moveWithHistory(active, active.x + direction[0] * step, active.y + direction[1] * step);
  }
  field.addEventListener('keydown', keyMove);
  list.addEventListener('keydown', keyMove);
  document.addEventListener('keydown', event => {
    if (event.key !== 'Delete' || !active || drag || event.defaultPrevented || event.isComposing ||
        event.ctrlKey || event.altKey || event.metaKey || event.target.isContentEditable ||
        event.target.closest?.('input,textarea,select,[role="textbox"]')) return;
    event.preventDefault();
    if (!event.repeat) deleteLayer();
  });

  field.addEventListener('pointerdown', event => {
    if (drag || (event.button !== 0 && event.button !== 1)) return;
    camera ??= overview();
    const point = position(event), world = asWorld(point.x, point.y);
    const layer = event.button === 0 ? layers.findLast(item => contains(item, world.x, world.y)) : null;
    if (layer) select(layer);
    else if (event.button === 0) select(null);
    drag = { id: event.pointerId, layer, point, x: layer ? layer.x : camera.x, y: layer ? layer.y : camera.y };
    syncHistory();
    field.focus({ preventScroll: true });
    field.setPointerCapture(event.pointerId);
    event.preventDefault();
  });
  field.addEventListener('pointermove', event => {
    if (drag?.id !== event.pointerId) return;
    const point = position(event), dx = point.x - drag.point.x, dy = point.y - drag.point.y;
    if (drag.layer) move(drag.layer, drag.x + dx / camera.zoom, drag.y + dy / camera.zoom);
    else {
      fitted = false;
      camera.x = drag.x + dx;
      camera.y = drag.y + dy;
      redraw();
    }
  });
  for (const kind of ['pointerup', 'pointercancel', 'lostpointercapture']) field.addEventListener(kind, event => {
    if (drag?.id !== event.pointerId) return;
    const { layer, x, y } = drag;
    drag = null;
    if (!layer || !rememberMove(layer, x, y)) scheduleSave();
    syncHistory();
  });
  field.addEventListener('wheel', event => {
    event.preventDefault();
    if (!drag && event.deltaY) zoomAt(event.deltaY < 0 ? Math.SQRT2 : Math.SQRT1_2, position(event));
  }, { passive: false });
  field.addEventListener('dragover', event => {
    if (!event.dataTransfer.types.includes(dragType)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  });
  field.addEventListener('drop', event => {
    const entry = resolveEntry(event.dataTransfer.getData(dragType));
    if (!entry) return;
    event.preventDefault();
    const point = position(event);
    add(entry, asWorld(point.x, point.y));
  });

  for (const button of document.querySelectorAll('.composition .gz-hx > span')) button.textContent = caption(button.textContent);
  new ResizeObserver(redraw).observe(field);
  redraw();
  return { add, addAll };
}
