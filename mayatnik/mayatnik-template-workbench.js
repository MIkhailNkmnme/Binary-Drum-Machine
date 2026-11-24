const STORE = 'template-workbench-v1';
export const dragType = 'application/x-zerkalius-template';
const rotations = [[1, 0, 0, 1], [0, 1, -1, 0], [-1, 0, 0, -1], [0, -1, 1, 0]];
const cell = value => Math.max(-1e6, Math.min(1e6, Math.round(value)));
const zoomLimit = value => Math.max(1 / 16384, Math.min(32, value));
const directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

function bounds(layer) {
  const { width, height } = layer.sprite.canvas;
  const x = -Math.floor(width / 2), y = -Math.floor(height / 2);
  const [a, b, c, d] = rotations[layer.turn];
  const x1 = a * x + c * y, y1 = b * x + d * y;
  const x2 = a * (x + width) + c * (y + height), y2 = b * (x + width) + d * (y + height);
  return { x: layer.x + Math.min(x1, x2), y: layer.y + Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) };
}

function contains(layer, x, y) {
  const [a, b, c, d] = rotations[layer.turn], sprite = layer.sprite;
  const dx = x - layer.x, dy = y - layer.y;
  const px = Math.floor(a * dx + b * dy + Math.floor(sprite.canvas.width / 2));
  const py = Math.floor(c * dx + d * dy + Math.floor(sprite.canvas.height / 2));
  return px >= 0 && py >= 0 && px < sprite.canvas.width && py < sprite.canvas.height &&
    sprite.rgba[(py * sprite.canvas.width + px) * 4 + 3] !== 0;
}

function spriteFromCanvas(canvas, atlas = null) {
  if (canvas.width < 1 || canvas.height < 1) throw Error('В шаблоне нет клеток.');
  const rgba = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
  return { canvas, rgba, atlas };
}

function spriteFromStored(saved) {
  const { width, height, rgba } = saved;
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 ||
      !(rgba instanceof Uint8ClampedArray) || rgba.length !== width * height * 4) throw Error('Повреждён сохранённый шаблон.');
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').putImageData(new ImageData(rgba, width, height), 0, 0);
  return { canvas, rgba, atlas: null };
}

export function mountWorkbench({ resolveAtlas, resolveEntry, toCanvas, caption }) {
  const $ = id => document.getElementById(id);
  const field = $('field'), context = field.getContext('2d');
  const list = $('field-layers'), status = $('field-status'), empty = $('field-empty');
  const xInput = $('layer-x'), yInput = $('layer-y');
  const up = $('layer-up'), down = $('layer-down'), remove = $('layer-remove');
  const left = $('turn-left'), right = $('turn-right');
  const layers = [];
  const buttons = new Map();
  let active = null, drag = null, serial = 0, drawFrame = 0, saveTimer = 0;
  let camera = { x: 0, y: 0, zoom: 5 }, originCentred = false;
  let writes = Promise.resolve();

  function tell(message) { status.textContent = message; }

  function view() {
    return { width: field.clientWidth, height: field.clientHeight };
  }

  function draw() {
    const { width, height } = view();
    if (!width || !height) return;
    const pixelRatio = Math.min(2, devicePixelRatio || 1);
    if (!originCentred) {
      camera.x = width / 2;
      camera.y = height / 2;
      originCentred = true;
    }
    const canvasWidth = Math.round(width * pixelRatio), canvasHeight = Math.round(height * pixelRatio);
    if (field.width !== canvasWidth) field.width = canvasWidth;
    if (field.height !== canvasHeight) field.height = canvasHeight;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, width, height);
    const { x, y, zoom } = camera;
    const interval = zoom >= 8 ? 1 : zoom >= 1.5 ? 10 : 0;
    if (interval) {
      const stride = interval * zoom;
      context.strokeStyle = '#293646';
      context.lineWidth = 1 / pixelRatio;
      context.beginPath();
      for (let xx = ((x % stride) + stride) % stride; xx < width; xx += stride) {
        const line = (Math.floor(xx * pixelRatio) + .5) / pixelRatio;
        context.moveTo(line, 0);
        context.lineTo(line, height);
      }
      for (let yy = ((y % stride) + stride) % stride; yy < height; yy += stride) {
        const line = (Math.floor(yy * pixelRatio) + .5) / pixelRatio;
        context.moveTo(0, line);
        context.lineTo(width, line);
      }
      context.stroke();
    }
    context.translate(x, y);
    context.scale(zoom, zoom);
    context.imageSmoothingEnabled = false;
    for (const layer of layers) {
      const { canvas } = layer.sprite;
      context.save();
      context.transform(...rotations[layer.turn], layer.x, layer.y);
      context.drawImage(canvas, -Math.floor(canvas.width / 2), -Math.floor(canvas.height / 2));
      context.restore();
    }
    if (active) {
      const box = bounds(active);
      context.strokeStyle = '#ffd778';
      context.lineWidth = 1.5 / zoom;
      context.strokeRect(box.x, box.y, box.width, box.height);
    }
    $('zoom-level').textContent = '×' + Number(zoom.toPrecision(3)).toLocaleString('ru-RU', { maximumFractionDigits: 5 });
  }

  function redraw() {
    if (!drawFrame) drawFrame = requestAnimationFrame(() => { drawFrame = 0; draw(); });
  }

  function scene() {
    const assets = [...new Map(layers.map(layer => [layer.sprite, layer])).values()];
    return {
      camera: { ...camera },
      active: active?.id,
      sprites: assets.map(({ sprite, key }) => ({
        key, ...(sprite.atlas ? { atlas: sprite.atlas } : {
          width: sprite.canvas.width, height: sprite.canvas.height, rgba: sprite.rgba
        })
      })),
      layers: layers.map(({ id, key, name, x, y, turn }) => ({ id, key, name, x, y, turn }))
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

  function select(layer) {
    active = layer;
    const index = layers.indexOf(layer);
    xInput.disabled = yInput.disabled = left.disabled = right.disabled = remove.disabled = index < 0;
    up.disabled = index < 0 || index === layers.length - 1;
    down.disabled = index < 1;
    for (const [id, button] of buttons) button.setAttribute('aria-pressed', String(layer?.id === id));
    updateCoordinates();
    redraw();
  }

  function renderLayers() {
    const focusId = document.activeElement?.dataset.layer;
    buttons.clear();
    list.replaceChildren(...[...layers].reverse().map(layer => {
      const item = document.createElement('li'), button = document.createElement('button'), name = document.createElement('span');
      button.type = 'button';
      button.className = 'gz-hx layer-label';
      button.title = layer.name;
      button.dataset.layer = layer.id;
      name.textContent = layer.name;
      button.append(name);
      button.onclick = () => { select(layer); scheduleSave(); };
      item.append(button);
      buttons.set(layer.id, button);
      return item;
    }));
    empty.hidden = layers.length !== 0;
    select(active);
    if (focusId) (buttons.get(Number(focusId)) ?? buttons.get(active?.id))?.focus();
  }

  function asWorld(x, y) {
    return { x: (x - camera.x) / camera.zoom, y: (y - camera.y) / camera.zoom };
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
    const current = asWorld(point.x, point.y), zoom = zoomLimit(camera.zoom * multiplier);
    camera = { x: point.x - current.x * zoom, y: point.y - current.y * zoom, zoom };
    redraw();
    scheduleSave();
  }

  function fit() {
    const { width, height } = view();
    if (!layers.length) camera = { x: width / 2, y: height / 2, zoom: 5 };
    else {
      const boxes = layers.map(bounds);
      const x = Math.min(...boxes.map(box => box.x)), y = Math.min(...boxes.map(box => box.y));
      const rightEdge = Math.max(...boxes.map(box => box.x + box.width));
      const bottomEdge = Math.max(...boxes.map(box => box.y + box.height));
      const zoom = zoomLimit(Math.min(16, Math.max(1, width - 48) / (rightEdge - x), Math.max(1, height - 48) / (bottomEdge - y)));
      camera = { x: width / 2 - (x + rightEdge) * zoom / 2, y: height / 2 - (y + bottomEdge) * zoom / 2, zoom };
    }
    redraw();
    scheduleSave();
  }

  function move(layer, x, y) {
    layer.x = cell(x);
    layer.y = cell(y);
    updateCoordinates();
    redraw();
  }

  function reorder(offset) {
    const from = layers.indexOf(active), to = from + offset;
    if (from < 0 || to < 0 || to >= layers.length) return;
    [layers[from], layers[to]] = [layers[to], layers[from]];
    renderLayers();
    scheduleSave();
  }

  function rotate(offset) {
    if (!active) return;
    active.turn = (active.turn + offset + 4) % 4;
    redraw();
    scheduleSave();
  }

  function deleteLayer() {
    const index = layers.indexOf(active);
    if (index < 0) return;
    layers.splice(index, 1);
    active = layers[Math.min(index, layers.length - 1)] ?? null;
    renderLayers();
    scheduleSave();
  }

  async function atlasSprite(atlas) {
    return spriteFromCanvas(await toCanvas(await resolveAtlas(atlas)), atlas);
  }

  async function restore() {
    try {
      const saved = await MayatnikPaintCache.read(STORE);
      if (!saved || !Array.isArray(saved.layers) || !Array.isArray(saved.sprites)) return;
      const loaded = await Promise.allSettled(saved.sprites.map(async sprite => [
        sprite.key, sprite.atlas ? await atlasSprite(sprite.atlas) : spriteFromStored(sprite)
      ]));
      const sprites = new Map(loaded.filter(result => result.status === 'fulfilled').map(result => result.value));
      for (const layer of saved.layers) {
        const sprite = sprites.get(layer.key);
        if (!sprite || !Number.isSafeInteger(layer.id) || !Number.isFinite(layer.x) || !Number.isFinite(layer.y)) continue;
        layers.push({ ...layer, x: cell(layer.x), y: cell(layer.y), turn: rotations[layer.turn] ? layer.turn : 0, sprite });
        serial = Math.max(serial, layer.id);
      }
      if ([saved.camera?.x, saved.camera?.y, saved.camera?.zoom].every(Number.isFinite)) {
        camera = { ...saved.camera, zoom: zoomLimit(saved.camera.zoom) };
        originCentred = true;
      }
      active = layers.find(layer => layer.id === saved.active) ?? layers.at(-1) ?? null;
      if (layers.length !== saved.layers.length) tell('Часть сохранённых фигур сейчас недоступна.');
    } catch {
      tell('Не удалось загрузить сохранённое поле.');
    } finally {
      renderLayers();
    }
  }

  let addQueue = restore();
  function add(entry, at = null) {
    const task = addQueue.then(async () => {
      const sprite = layers.find(layer => layer.key === entry.key)?.sprite ??
        spriteFromCanvas(await toCanvas(entry), entry.atlas ?? null);
      const { width, height } = view();
      if (!originCentred) draw();
      const point = at ?? asWorld(width / 2, height / 2);
      const offset = at ? 0 : layers.length % 6 * 3;
      const layer = { key: entry.key, name: entry.name, id: ++serial, x: cell(point.x + offset), y: cell(point.y + offset), turn: 0, sprite };
      layers.push(layer);
      active = layer;
      if (!at && (sprite.canvas.width * camera.zoom > width - 24 || sprite.canvas.height * camera.zoom > height - 24)) fit();
      renderLayers();
      tell('На поле: ' + layer.name);
      scheduleSave();
    });
    addQueue = task.catch(error => tell(error?.message || 'Не удалось добавить фигуру.'));
    return addQueue;
  }

  $('zoom-in').onclick = () => zoomAt(Math.SQRT2);
  $('zoom-out').onclick = () => zoomAt(Math.SQRT1_2);
  $('fit-field').onclick = fit;
  left.onclick = () => rotate(-1);
  right.onclick = () => rotate(1);
  up.onclick = () => reorder(1);
  down.onclick = () => reorder(-1);
  remove.onclick = deleteLayer;
  for (const input of [xInput, yInput]) input.onchange = () => {
    if (!active) return;
    const value = input.valueAsNumber;
    if (!Number.isFinite(value)) { updateCoordinates(); return; }
    move(active, input === xInput ? value : active.x, input === yInput ? value : active.y);
    scheduleSave();
  };

  field.addEventListener('keydown', keyMove);
  list.addEventListener('keydown', keyMove);
  function keyMove(event) {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const direction = directions[event.key];
    if (!direction || !active) return;
    event.preventDefault();
    const step = event.shiftKey ? 10 : 1;
    move(active, active.x + direction[0] * step, active.y + direction[1] * step);
    scheduleSave();
  }

  field.addEventListener('pointerdown', event => {
    if (drag || (event.button !== 0 && event.button !== 1)) return;
    const point = position(event), world = asWorld(point.x, point.y);
    const layer = event.button === 0 ? layers.findLast(item => contains(item, world.x, world.y)) : null;
    if (layer) select(layer);
    else if (event.button === 0) select(null);
    drag = { id: event.pointerId, layer, point, x: layer ? layer.x : camera.x, y: layer ? layer.y : camera.y };
    field.focus({ preventScroll: true });
    field.setPointerCapture(event.pointerId);
    event.preventDefault();
  });
  field.addEventListener('pointermove', event => {
    if (drag?.id !== event.pointerId) return;
    const point = position(event), dx = point.x - drag.point.x, dy = point.y - drag.point.y;
    if (drag.layer) move(drag.layer, drag.x + dx / camera.zoom, drag.y + dy / camera.zoom);
    else {
      camera.x = drag.x + dx;
      camera.y = drag.y + dy;
      redraw();
    }
  });
  for (const kind of ['pointerup', 'pointercancel', 'lostpointercapture']) field.addEventListener(kind, event => {
    if (drag?.id !== event.pointerId) return;
    drag = null;
    scheduleSave();
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
    const key = event.dataTransfer.getData(dragType), entry = key && resolveEntry(key);
    if (!entry) return;
    event.preventDefault();
    const point = position(event);
    add(entry, asWorld(point.x, point.y));
  });

  for (const button of document.querySelectorAll('.composition .gz-hx > span')) button.textContent = caption(button.textContent);
  new ResizeObserver(redraw).observe(field);
  redraw();
  return { add };
}
