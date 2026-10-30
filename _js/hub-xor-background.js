/* v13 (Хаб v0.472). Скорость плеера — 0,25× … 1024× шагом ×2; номер хаба
   скрыт, пока плеер идёт (на паузе возвращается).
   v12 (Хаб v0.471). Точные packed-поля, отрисовка без распаковки, 8×/16×.
   v11 (Хаб v0.470). Скорость плеера 0,25× / 0,5× / 1× / 2× / 4×; кадр
   рисуется 32-битными словами, 5.9 не перерисовывается на промежуточных
   кадрах, на 4× кадр режется одним куском 1024 строки — 4× обгоняет 2×.
   v10 (v0.469). Скорость плеера: 0,25× / 0,5× / 1× / 2× — кнопка в
   меню сравнения; интервал кадра — 120 мс / скорость, выбор сохраняется.
   Пока панель статистики закрыта, расчёт кадра не ждёт: плеер идёт со
   скоростью кнопки, статистика начинается при открытии панели.
   v9 (v0.467). В наложении поля 1, 2 и 3 включаются отдельными кнопками:
   горит кнопка — поле участвует в XOR/AND, погашена — не участвует. Хотя бы
   одно поле остаётся включённым. Зеркально читаются поля 2 и 3, поле 1 —
   прямое. v8 (v0.463). Двойной щелчок по любому полю — пауза и продолжение всех трёх
   построений, в любом виде сравнения и в дзене; в дзене кнопки «Пауза» и «Меню»
   скрыты, поэтому выход из дзена ещё и удержанием указателя на поле.
   v7. Главная: синхронное сравнение трёх полей — конусы 5.7, «обе стороны» 5.9
   (пара вершин −m/+m одним проходом) и глобальный XOR 5.8. Третье поле на экране
   перевёрнуто (scaleY(-1) в CSS), данные у всех трёх в обычной ориентации.
   В наложении XOR/AND доступны любые наборы полей 1, 2, 3. */
(() => {
  'use strict';
  const left = document.getElementById('hubCones'), right = document.getElementById('hubXor');
  if (!left || !right || typeof MAYATNIK === 'undefined') return;
  const coneCtx = left.getContext('2d', { alpha: true });
  const xorCtx = right.getContext('2d', { alpha: true });
  if (!coneCtx || !xorCtx) return;
  const middle = document.getElementById('hubPair');
  const pairCtx = middle && middle.getContext('2d', { alpha: true });
  const H = 1024, W = 2 * H - 1, CENTER = W >> 1;
  const FIRST_FRAME = 8, INTERVAL = 120, ROW_CHUNK = 64;
  left.width = right.width = W; left.height = right.height = H;
  if (middle) { middle.width = W; middle.height = H; }
  const kernel = HubXorKernel;
  const cones = kernel.create(W, H), grid = kernel.create(W, H), pairGrid = kernel.create(W, H);
  const packedLeft = kernel.create(W, H), packedRight = kernel.create(W, H), packedPair = kernel.create(W, H);
  let decoded = false, earlyStats = null;
  const publishedLeft = new Int8Array(W * H), publishedRight = new Int8Array(W * H), publishedPair = new Int8Array(W * H);
  const coneImage = coneCtx.createImageData(W, H), xorImage = xorCtx.createImageData(W, H);
  const pairImage = pairCtx && pairCtx.createImageData(W, H);
  // Пиксели пишутся одним 32-битным словом: на 2M клеток это заметно быстрее
  // четырёх записей в Uint8ClampedArray. На big-endian остаётся старый paint().
  const PIXELS = W * H;
  const LITTLE_ENDIAN = new Uint8Array(new Uint32Array([0x0a0b0c0d]).buffer)[0] === 0x0d;
  const conePixels = LITTLE_ENDIAN ? new Uint32Array(coneImage.data.buffer) : null;
  const xorPixels = LITTLE_ENDIAN ? new Uint32Array(xorImage.data.buffer) : null;
  const pairPixels = LITTLE_ENDIAN && pairImage ? new Uint32Array(pairImage.data.buffer) : null;
  let pairPainted = false;
  const root = document.getElementById('hubXorBackground'), blend = document.getElementById('hubBlend');
  const blendCtx = blend && blend.getContext('2d', { alpha: true });
  if (blend) { blend.width = W; blend.height = H; }
  const blendImage = blendCtx && blendCtx.createImageData(W, H);
  const blendPixels = LITTLE_ENDIAN && blendImage ? new Uint32Array(blendImage.data.buffer) : null;
  const modeButton = document.getElementById('hubCompareMode'), mirrorButton = document.getElementById('hubCompareMirror');
  const speedButton = document.getElementById('hubCompareSpeed');
  const pauseButton = document.getElementById('hubComparePause');
  const paletteButton = document.getElementById('hubComparePalette'), paletteMenu = document.getElementById('hubComparePaletteMenu');
  const pairsBox = document.getElementById('hubComparePairs');
  const PALETTES = {
    ice: { label: 'Лёд', left: [88,183,255], middle: [232,237,245], right: [255,179,91], common: [232,237,245], legend: 'Конусы — голубой · Обе стороны — белый · Всё поле — оранжевый · Общие — белый' },
    mint: { label: 'Мята', left: [115,228,165], middle: [255,211,91], right: [255,135,207], common: [255,211,91], legend: 'Конусы — мятный · Обе стороны — жёлтый · Всё поле — розовый · Общие — жёлтый' },
    mono: { label: 'Моно', left: [255,255,255], middle: [221,221,221], right: [153,153,153], common: [221,221,221], legend: 'Конусы — белый · Обе стороны — светло-серый · Всё поле — серый' },
    green: { label: 'Зелёный', left: [51,122,52], middle: [51,122,52], right: [51,122,52], common: [51,122,52], legend: 'Конусы, обе стороны, всё поле и общие — зелёный' }
  };
  const STORAGE = 'zerk_hub_compare_v1', MODES = ['split', 'xor', 'and'];
  const SPEEDS = [0.25, 0.5, 1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024];
  // 1 = конусы 5.7, 2 = обе стороны 5.9, 3 = всё поле 5.8.
  const FIELDS = [1, 2, 3];
  const FIELD_KEYS = { 1: 'left', 2: 'pair', 3: 'right' };
  const FIELD_NAMES = { 1: 'конусы 5.7', 2: 'обе стороны 5.9', 3: 'всё поле 5.8' };
  const LEGACY_PAIRS = { 12: [1, 2], 23: [2, 3], 31: [1, 3], 123: [1, 2, 3] };
  const view = { mode: 'split', mirror: false, zoom: 1, palette: 'ice', fields: [1, 2], speed: 1,
    pan: { left: { x: 0, y: 0 }, right: { x: 0, y: 0 }, blend: { x: 0, y: 0 }, pair: { x: 0, y: 0 } } };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE));
    if (saved && typeof saved === 'object') {
      if (MODES.includes(saved.mode)) view.mode = saved.mode;
      if (typeof saved.mirror === 'boolean') view.mirror = saved.mirror;
      if (Object.prototype.hasOwnProperty.call(PALETTES, saved.palette)) view.palette = saved.palette;
      if (Array.isArray(saved.fields)) {
        const fields = [...new Set(saved.fields.map(Number).filter(field => FIELDS.includes(field)))].sort((a, b) => a - b);
        if (fields.length) view.fields = fields;
      } else if (LEGACY_PAIRS[saved.pair]) view.fields = LEGACY_PAIRS[saved.pair].slice();   // прежняя пара 1–2 / 2–3 / 3–1 / 1–2–3
      if (typeof saved.zoom === 'number' && Number.isFinite(saved.zoom)) view.zoom = Math.max(1, Math.min(64, saved.zoom));
      if (SPEEDS.includes(saved.speed)) view.speed = saved.speed;
      for (const key of ['left', 'right', 'blend', 'pair']) for (const axis of ['x', 'y']) {
        const value = saved.pan?.[key]?.[axis];
        if (typeof value === 'number' && Number.isFinite(value)) view.pan[key][axis] = value;
      }
    }
  } catch (_) {}
  let published = false;
  let frame = -1, row = 1, timer = 0, nextFrame = true, started = performance.now();
  let publishedFrame = -1, publishedCycle = 0, statsFrame = -1;
  let pairStep = false;   // текущий кадр — шаг пары для 5.9 (переживает разбивку на куски строк)
  let cycle = 0, awaitingStats = false, failed = false, paused = false, controller = null;
  let drag = null, middle1 = null, swallowClick = false, holdTimer = 0, hold = null;
  try {
    if (typeof window !== 'undefined' && window.HubComparePanel?.create) controller = window.HubComparePanel.create({ W, H });
  } catch (error) { stop(error); }

  function stop(error) {
    failed = true; awaitingStats = false; clearTimeout(timer); timer = 0;
    syncPlayback();
    if (root) root.dataset.error = error instanceof Error ? error.message : String(error);
    if (controller && typeof controller.error === 'function') controller.error(error);
  }

  function syncPlayback() {
    if (root) root.dataset.paused = String(paused);
    if (document.body && document.body.classList) document.body.classList.toggle('hubPlaying', !failed && !paused);   // v0.472: номер хаба не виден, пока плеер идёт
    if (!pauseButton) return;
    pauseButton.disabled = failed;
    pauseButton.setAttribute('aria-pressed', String(paused));
    const label = paused ? 'Продолжить все три построения' : 'Пауза трёх построений';
    pauseButton.setAttribute('aria-label', label); pauseButton.title = label;
    pauseButton.classList.toggle('gz-on', paused);
    text('hubComparePauseIcon', paused ? '▶' : 'Ⅱ');
  }
  function togglePause() {
    if (failed) return;
    paused = !paused;
    clearTimeout(timer); timer = 0;
    syncPlayback();
    // Neither the partially computed row nor an in-flight statistics job is
    // discarded. The statistics continuation also respects this pause.
    if (!paused) {
      started = performance.now();
      // Если снимок на паузе ещё считается, он сам запустит следующий кадр.
      if (!awaitingStats) schedule(0);
    } else measureSnapshot();
  }
  if (pauseButton) pauseButton.addEventListener('click', togglePause);
  syncPlayback();

  // Дзен: в нём кнопок «Пауза» и «Меню» нет, поэтому выход — удержание на поле.
  function inZen() { return !!document.body && !!document.body.classList && document.body.classList.contains('hubCompareZen'); }
  function stopHold() { if (holdTimer) { clearTimeout(holdTimer); holdTimer = 0; } hold = null; }
  function startHold(event) {
    stopHold();
    hold = { id: event.pointerId, x: event.clientX, y: event.clientY };
    holdTimer = setTimeout(() => {
      holdTimer = 0; hold = null;
      if (!inZen()) return;
      document.getElementById('hubCompareZen')?.click();
    }, 700);
  }

  function saveView() {
    try { localStorage.setItem(STORAGE, JSON.stringify(view)); } catch (_) {}
  }
  function text(id, value) {
    const node = document.getElementById(id); if (node) node.textContent = value;
  }
  const PAN_KEYS = ['left', 'pair', 'right', 'blend'], canvases = { left, right, blend, pair: middle };
  const CONTROL_SELECTOR = 'button,a,input,select,textarea,summary,label,dialog,[contenteditable],[role="button"],[role="slider"],[role="dialog"],[role="group"],.hub,#hubCompareTools,#hubComparePanel,.gz-rail,.gz-ladder,.hubRombGrid,.hubMirrorSettings,.hubBitView,.hubColorEditor,#hubRail,#hubZoom,#hubFieldTools';
  function isControl(event) { return !!event.target?.closest?.(CONTROL_SELECTOR); }
  function paneRect(key) { return canvases[key]?.parentElement?.getBoundingClientRect?.(); }
  function insidePane(key, x, y) {
    const rect = paneRect(key);
    if (!rect || !rect.width || !rect.height) return false;
    const px = x - rect.left, py = y - rect.top, w = rect.width, h = rect.height;
    if (px < 0 || py < 0 || px > w || py > h) return false;
    if (key === 'blend') return true;
    // Прямоугольники панелей перекрываются на 25 %, а треугольники — нет:
    // 5.7 и 5.8 стоят на основании (▲), 5.9 перевёрнут (▼).
    const half = w / 2, k = key === 'pair' ? 1 - py / h : py / h;
    return Math.abs(px - half) <= half * k;
  }
  function paneAt(event) {
    for (const key of view.mode === 'split' ? ['pair', 'left', 'right'] : ['blend']) {
      if (insidePane(key, event.clientX, event.clientY)) return key;
    }
    return null;
  }
  function rebaseDrag() {
    if (!drag) return;
    drag.x = drag.lastX; drag.y = drag.lastY;
    drag.panX = view.pan[drag.key].x; drag.panY = view.pan[drag.key].y;
  }
  function applyPan(rebase = false) {
    for (const key of PAN_KEYS) {
      if (!canvases[key]) continue;
      const pan = view.pan[key], el = canvases[key].parentElement;
      // Масштаб теперь у самой панели: её раскладка не меняется, поэтому
      // границы берём из offset, а не из getBoundingClientRect с трансформом.
      const pw = el?.offsetWidth || 0, ph = el?.offsetHeight || 0;
      if (view.zoom === 1) pan.x = pan.y = 0;
      else if (pw > 0 && ph > 0) {
        const xLimit = Math.max(0, pw * (view.zoom - 1) / 2);
        const yLimit = Math.max(0, ph * (view.zoom - 1) / 2);
        pan.x = Math.max(-xLimit, Math.min(xLimit, pan.x));
        pan.y = Math.max(-yLimit, Math.min(yLimit, pan.y));
      }
      if (root) {
        const prefix = '--hubPan' + key[0].toUpperCase() + key.slice(1);
        root.style.setProperty(prefix + 'X', pan.x + 'px'); root.style.setProperty(prefix + 'Y', pan.y + 'px');
      }
    }
    if (rebase) rebaseDrag();
  }
  function finishDrag() {
    if (!drag) return;
    for (const key of PAN_KEYS) canvases[key]?.parentElement?.classList?.remove('hubDragTarget');
    const previous = drag;
    drag = null;
    document.body?.classList?.toggle('hubCompareDragging', false);
    try { root.releasePointerCapture?.(previous.id); } catch (_) {}
    saveView();
  }
  function syncView() {
    const modeLabel = { split: 'Рядом', xor: 'XOR', and: 'AND' }[view.mode];
    const mirrorLabel = view.mirror ? 'Зеркально' : 'Прямо';
    const fieldsLabel = view.fields.length ? view.fields.join('–') : 'без полей';
    const palette = PALETTES[view.palette], css = colour => 'rgb(' + colour.join(',') + ')';
    if (root) {
      root.dataset.mode = view.mode; root.dataset.palette = view.palette;
      root.style.setProperty('--hubCompareZoom', String(view.zoom));
      for (const key of ['left', 'right', 'common']) root.style.setProperty('--hubCompare' + key[0].toUpperCase() + key.slice(1), css(palette[key]));
    }
    if (drag && (view.mode === 'split' ? drag.key === 'blend' : drag.key !== 'blend')) finishDrag();
    applyPan(true);
    text('hubCompareModeLabel', modeLabel);
    text('hubCompareModeIcon', { split: '↔', xor: '⊕', and: '∧' }[view.mode]);
    text('hubCompareMirrorLabel', mirrorLabel); text('hubCompareMirrorIcon', view.mirror ? 'Ƨ1' : '11');
    text('hubCompareOverlayLabel', modeLabel + ' ' + fieldsLabel + ' · ' + mirrorLabel);
    text('hubComparePaletteLabel', palette.label); text('hubComparePaletteIcon', '◐');
    text('hubCompareLegend', palette.legend);
    if (pairsBox) {
      pairsBox.hidden = view.mode === 'split';
      for (const button of pairsBox.querySelectorAll('[data-hub-field]')) {
        const field = Number(button.dataset.hubField), selected = view.fields.includes(field);
        button.classList.toggle('gz-on', selected); button.setAttribute('aria-pressed', String(selected));
        button.title = 'Поле ' + field + ' — ' + FIELD_NAMES[field] + '. ' + (selected
          ? (view.fields.length === 1 ? 'Единственное включённое поле: выключить нельзя' : 'Включено: щелчок выключит его в наложении')
          : 'Выключено: щелчок включит его в наложении');
      }
    }
    if (paletteButton) {
      paletteButton.title = 'Цвета построений: ' + palette.label + '. Выбрать готовую палитру';
      paletteButton.setAttribute('aria-label', 'Цвета построений: ' + palette.label);
    }
    if (paletteMenu) for (const button of paletteMenu.querySelectorAll('[data-hub-palette]')) {
      const selected = button.dataset.hubPalette === view.palette;
      button.classList.toggle('gz-on', selected); button.setAttribute('aria-pressed', String(selected));
    }
    if (modeButton) {
      modeButton.title = 'Сравнение построений: ' + modeLabel + '. Щелчок: Рядом → XOR → AND';
      modeButton.setAttribute('aria-label', 'Сравнение построений: ' + modeLabel);
      modeButton.classList.toggle('gz-on', view.mode !== 'split');
    }
    if (mirrorButton) {
      mirrorButton.disabled = view.mode === 'split';
      mirrorButton.title = 'Зеркало: ' + mirrorLabel + '. Поля 2 и 3 читаются отражёнными по горизонтали перед XOR или AND, поле 1 — прямое';
      mirrorButton.setAttribute('aria-label', 'Зеркало: ' + mirrorLabel);
      mirrorButton.setAttribute('aria-pressed', String(view.mirror));
      mirrorButton.classList.toggle('gz-on', view.mode !== 'split' && view.mirror);
    }
    if (speedButton) {
      const label = speedLabel(view.speed);
      text('hubCompareSpeedLabel', label);
      speedButton.title = 'Скорость плеера: ' + label + '. Щелчок — следующая: ' + SPEEDS.map(speedLabel).join(' → ');
      speedButton.setAttribute('aria-label', 'Скорость плеера: ' + label);
      speedButton.classList.toggle('gz-on', view.speed !== 1);
    }
  }
  function speedLabel(value) { return (Number.isInteger(value) ? String(value) : String(value).replace('.', ',')) + '×'; }
  const FIELD_COLOUR = { left: 'left', pair: 'middle', right: 'right' };
  function selectedFields() { return view.fields.map(field => FIELD_KEYS[field]); }
  function colour32(colour) { return ((255 << 24) | (colour[2] << 16) | (colour[1] << 8) | colour[0]) >>> 0; }
  function renderBlend() {
    if (!blendImage || view.mode === 'split') return;
    const palette = PALETTES[view.palette];
    const fields = selectedFields().map(key => ({ key, colour: palette[FIELD_COLOUR[key]],
      colour32: colour32(palette[FIELD_COLOUR[key]]), data: key === 'pair' ? publishedPair : key === 'right' ? publishedRight : publishedLeft }));
    if (!fields.length) {
      if (blendPixels) blendPixels.fill(0); else blendImage.data.fill(0);
      blendCtx.putImageData(blendImage, 0, 0); blend.dataset.frame = left.dataset.frame; return;
    }
    const common32 = colour32(palette.common);
    if (blendPixels) {
      kernel.blend(fields.map(field => ({ data: field.key === 'pair' ? packedPair : field.key === 'right' ? packedRight : packedLeft, mirror: field.key !== 'left' })),
        blendPixels, view.mode === 'and', view.mirror, fields.map(field => field.colour32), common32);
    } else {
      decodePublished();
      for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
        const i = r * W + c;
        let ones = 0, all = true, colour = null;
        for (const field of fields) {
          const j = r * W + (view.mirror && field.key !== 'left' ? W - 1 - c : c);
          if (field.data[j] === 1) { ones++; if (!colour) colour = field.colour; }
          else all = false;
        }
        paint(blendImage.data, i, view.mode === 'xor' ? ones % 2 : (all ? 1 : 0), view.mode === 'and' ? palette.common : (colour || palette.common));
      }
    }
    blendCtx.putImageData(blendImage, 0, 0);
    blend.dataset.frame = left.dataset.frame;
  }
  function changeView() {
    syncView(); saveView();
    if (published) renderPublished(true);
  }
  function closePalette() {
    if (paletteMenu) paletteMenu.hidden = true;
    if (paletteButton) paletteButton.setAttribute('aria-expanded', 'false');
  }
  if (paletteButton && paletteMenu) {
    closePalette();
    paletteButton.addEventListener('click', () => {
      paletteMenu.hidden = !paletteMenu.hidden;
      paletteButton.setAttribute('aria-expanded', String(!paletteMenu.hidden));
    });
    paletteMenu.addEventListener('click', event => {
      const button = event.target.closest('[data-hub-palette]');
      if (!button || !Object.prototype.hasOwnProperty.call(PALETTES, button.dataset.hubPalette)) return;
      view.palette = button.dataset.hubPalette; closePalette(); changeView();
    });
    document.addEventListener('click', event => {
      if (!paletteMenu.contains(event.target) && !paletteButton.contains(event.target)) closePalette();
    });
    document.addEventListener('keydown', event => { if (event.key === 'Escape') closePalette(); });
  }
  if (modeButton) modeButton.addEventListener('click', () => {
    view.mode = MODES[(MODES.indexOf(view.mode) + 1) % MODES.length]; changeView();
  });
  if (mirrorButton) mirrorButton.addEventListener('click', () => {
    if (view.mode === 'split') return;
    view.mirror = !view.mirror; changeView();
  });
  if (speedButton) speedButton.addEventListener('click', () => {
    view.speed = SPEEDS[(SPEEDS.indexOf(view.speed) + 1) % SPEEDS.length];
    changeView();
  });
  if (pairsBox) pairsBox.addEventListener('click', event => {
    const button = event.target.closest('[data-hub-field]');
    if (!button) return;
    const field = Number(button.dataset.hubField);
    if (!FIELDS.includes(field)) return;
    if (view.fields.includes(field)) {
      // пустое наложение не показываем: последнее включённое поле остаётся
      if (view.fields.length === 1) return;
      view.fields = view.fields.filter(item => item !== field);
    } else view.fields = view.fields.concat(field).sort((a, b) => a - b);
    changeView();
  });
  if (root) window.addEventListener('wheel', event => {
    // Старый hub-view слушает capture на document и иначе забирает Ctrl+колесо.
    // Оставляем стандартный zoom браузера, не вызывая preventDefault.
    if (event.ctrlKey || event.metaKey) { event.stopImmediatePropagation(); return; }
    if (event.defaultPrevented) return;
    if (isControl(event)) return;
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
    const delta = event.deltaY * unit;
    if (!Number.isFinite(delta) || delta === 0) return;
    event.preventDefault(); event.stopImmediatePropagation();
    view.zoom = Math.max(1, Math.min(64, view.zoom * Math.exp(-delta * .0015)));
    root.style.setProperty('--hubCompareZoom', String(view.zoom));
    if (drag) {
      if (Number.isFinite(event.clientX)) drag.lastX = event.clientX;
      if (Number.isFinite(event.clientY)) drag.lastY = event.clientY;
    }
    applyPan(true); saveView();
  }, { capture: true, passive: false });
  if (root) {
    const capture = { capture: true, passive: false };
    const consume = event => { event.preventDefault(); event.stopImmediatePropagation(); };
    window.addEventListener('pointerdown', event => {
      swallowClick = false;
      if (event.button === 1) middle1 = null;
      stopHold();
      if (isControl(event) || event.ctrlKey || event.metaKey) return;
      const key = paneAt(event); if (!key) return;
      if (event.button === 0 && inZen()) startHold(event);
      if (event.pointerType && event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
      canvases[key]?.parentElement?.classList?.add('hubDragTarget');
      if (event.button === 1) {
        finishDrag(); middle1 = { id: event.pointerId }; consume(event);
        document.getElementById('hubCompareZen')?.click(); return;
      }
      if (event.button !== 0 || view.zoom <= 1) return;
      finishDrag(); consume(event);
      const pan = view.pan[key];
      drag = { key, id: event.pointerId, x: event.clientX, y: event.clientY, lastX: event.clientX, lastY: event.clientY, panX: pan.x, panY: pan.y };
      document.body?.classList?.toggle('hubCompareDragging', true);
      try { root.setPointerCapture?.(event.pointerId); } catch (_) {}
    }, capture);
    window.addEventListener('pointermove', event => {
      if (hold && event.pointerId === hold.id && (Math.abs(event.clientX - hold.x) > 8 || Math.abs(event.clientY - hold.y) > 8)) stopHold();
      if (!drag || event.pointerId !== drag.id) return;
      consume(event);
      if (event.buttons === 0) { finishDrag(); return; }
      drag.lastX = event.clientX; drag.lastY = event.clientY;
      view.pan[drag.key].x = drag.panX + event.clientX - drag.x;
      view.pan[drag.key].y = drag.panY + event.clientY - drag.y;
      applyPan(true);
    }, capture);
    window.addEventListener('pointerup', event => {
      stopHold();
      if (middle1 && event.pointerId === middle1.id && event.button === 1) consume(event);
      if (drag && event.pointerId === drag.id && event.button === 0) { consume(event); swallowClick = true; finishDrag(); }
    }, capture);
    window.addEventListener('pointercancel', event => {
      stopHold();
      if (middle1 && event.pointerId === middle1.id) { consume(event); middle1 = null; }
      if (drag && event.pointerId === drag.id) { consume(event); finishDrag(); }
    }, capture);
    window.addEventListener('mousedown', event => {
      if ((event.button === 1 && middle1) || (event.button === 0 && drag)) consume(event);
    }, capture);
    window.addEventListener('auxclick', event => {
      if (event.button === 1 && middle1) { consume(event); middle1 = null; }
    }, capture);
    // v0.463: двойной щелчок по любому полю — пауза и продолжение трёх построений
    // в любом виде (рядом/XOR/AND) и в дзене. Меню, панели и другие кнопки не считаются.
    window.addEventListener('dblclick', event => {
      if (event.button !== 0 || isControl(event)) return;
      if (!paneAt(event)) return;
      stopHold(); consume(event); togglePause();
    }, capture);
    window.addEventListener('click', event => {
      if (swallowClick && event.button === 0) { swallowClick = false; if (!isControl(event)) consume(event); }
    }, capture);
    window.addEventListener('blur', () => { middle1 = null; swallowClick = false; stopHold(); finishDrag(); });
    window.addEventListener('resize', () => { applyPan(true); saveView(); });
  }
  syncView();

  // Int8 snapshots are only needed by statistics or the big-endian renderer.
  // Keep them tied to the published frame even if computation is paused mid-row.
  function decodePublished() {
    if (decoded) return;
    kernel.unpack(packedLeft, publishedLeft); kernel.unpack(packedRight, publishedRight); kernel.unpack(packedPair, publishedPair);
    decoded = true;
  }
  function paint(pixels, i, value, colour) {
    const p = i * 4, on = value === 1;
    pixels[p] = on ? colour[0] : 0;
    pixels[p + 1] = on ? colour[1] : 0;
    pixels[p + 2] = on ? colour[2] : 0;
    pixels[p + 3] = on ? 255 : 0;   // пустые клетки прозрачны: при увеличении поля наезжают друг на друга
  }
  function renderPublished(force = false) {
    const palette = PALETTES[view.palette];
    if (view.mode === 'split') {
      if (conePixels) {
        const lc = colour32(palette.left), rc = colour32(palette.right), mc = colour32(palette.middle);
        kernel.paint(packedLeft, conePixels, lc); kernel.paint(packedRight, xorPixels, rc);
        // 5.9 меняется только через кадр: на промежуточных кадрах канвас не трогаем.
        const repaintPair = !!pairPixels && (force || pairStep || !pairPainted);
        if (repaintPair) kernel.paint(packedPair, pairPixels, mc);
        coneCtx.putImageData(coneImage, 0, 0); xorCtx.putImageData(xorImage, 0, 0);
        if (repaintPair) { pairCtx.putImageData(pairImage, 0, 0); pairPainted = true; }
      } else {
        decodePublished();
        for (let i = 0; i < PIXELS; i++) {
          paint(coneImage.data, i, publishedLeft[i], palette.left);
          paint(xorImage.data, i, publishedRight[i], palette.right);
          if (pairImage) paint(pairImage.data, i, publishedPair[i], palette.middle);
        }
        coneCtx.putImageData(coneImage, 0, 0); xorCtx.putImageData(xorImage, 0, 0);
        if (pairCtx) pairCtx.putImageData(pairImage, 0, 0);
      }
    }
    renderBlend();
  }
  function frameInterval() { return INTERVAL / view.speed; }
  function schedule(delay) {
    if (!timer && !document.hidden && !awaitingStats && !failed && !paused) timer = setTimeout(tick, delay);
  }
  function tick() {
    timer = 0;
    if (document.hidden || awaitingStats || failed || paused) return;
    if (nextFrame) {
      nextFrame = false; frame++; row = 1; started = performance.now();
      // Все 2047 вершин внутри рамки пройдены: все три поля начинают новый цикл.
      // Не заворачиваем вершины через край и не меняем исходный алгоритм cone.
      if (frame === W) { frame = 0; cycle++; kernel.reset(cones); kernel.reset(grid); kernel.reset(pairGrid); }
      const d = Math.ceil(frame / 2), pos = CENTER + (frame % 2 ? -d : d);
      kernel.apex(grid, pos);
      // 5.9 повторяет пару шагов тест-страницы: −m и +m одной дистанцией, ровно
      // один пересчёт на пару (кадры 0, 1, 3, 5…), поэтому поле совпадает с
      // «обе стороны» на той же странице кадр в кадр, но обновляется через кадр.
      const pairStepNow = frame === 0 || frame % 2 === 1;
      pairStep = pairStepNow;
      if (middle && pairStep) {
        kernel.apex(pairGrid, pos);
        const twin = 2 * CENTER - pos;
        if (twin >= 0 && twin < W) kernel.apex(pairGrid, twin);
      }
      // Один исходный cone за такт; packed-ядро сохраняет границы и чётность.
      kernel.cone(cones, pos);
    }
    const visible = frame >= FIRST_FRAME;
    // На высокой скорости режем кадр крупнее: меньше таймеров, больше кадров/с.
    const chunk = view.speed >= 4 ? 1024 : view.speed >= 2 ? 512 : ROW_CHUNK;
    const end = Math.min(H, row + chunk);
    kernel.sweep(grid, row, end);
    if (middle && pairStep) kernel.sweep(pairGrid, row, end);
    row = end;
    if (row < H) { schedule(0); return; }
    if (visible) {
      // Preserve the last displayed snapshot throughout the next cycle's
      // hidden warmup frames too (pause and palette changes can occur there).
      kernel.copy(packedLeft, cones); kernel.copy(packedRight, grid); kernel.copy(packedPair, pairGrid); decoded = false;
      // Готовые изображения публикуются в одном задании, без промежуточного кадра.
      left.dataset.frame = right.dataset.frame = String(frame);
      if (middle) middle.dataset.frame = String(frame);
      published = true;
      publishedFrame = frame; publishedCycle = cycle;
      renderPublished();
    }
    nextFrame = true;
    const continueFrame = () => {
      awaitingStats = false;
      schedule(visible ? Math.max(0, frameInterval() - (performance.now() - started)) : 0);
    };
    // Пока ни одна панель статистики не открыта, расчёт не тормозит плеер:
    // кадры идут со скоростью кнопки, статистика начинается при открытии панели.
    const statsOn = controller && typeof controller.measure === 'function' &&
      (typeof controller.active !== 'function' || controller.active());
    if (statsOn) {
      awaitingStats = true;
      try {
        let data;
        if (visible) { decodePublished(); data = [publishedLeft, publishedPair, publishedRight]; }
        else {
          if (!earlyStats) earlyStats = [new Int8Array(PIXELS), new Int8Array(PIXELS), new Int8Array(PIXELS)];
          kernel.unpack(cones, earlyStats[0]); kernel.unpack(pairGrid, earlyStats[1]); kernel.unpack(grid, earlyStats[2]);
          data = earlyStats;
        }
        Promise.resolve(controller.measure({ left: data[0], middle: data[1], right: data[2], W, H, frame, cycle }))
          .then(() => { statsFrame = frame; continueFrame(); }, stop);
      } catch (error) { stop(error); }
    } else continueFrame();
  }
  // Пауза/открытие панели на паузе: посчитать последний опубликованный кадр,
  // иначе панель осталась бы с «Подготовкой первого кадра» до продолжения.
  function measureSnapshot() {
    if (!paused || !published || failed || statsFrame === publishedFrame) return;
    if (!controller || typeof controller.measure !== 'function') return;
    if (typeof controller.active === 'function' && !controller.active()) return;
    if (awaitingStats) return;
    const target = publishedFrame, targetCycle = publishedCycle;
    decodePublished();
    awaitingStats = true;
    Promise.resolve(controller.measure({ left: publishedLeft, middle: publishedPair, right: publishedRight, W, H, frame: target, cycle: targetCycle }))
      .then(() => { statsFrame = target; awaitingStats = false; if (!paused) schedule(0); }, stop);
  }
  document.addEventListener('hubStatsActivated', () => { statsFrame = -1; measureSnapshot(); });
  document.addEventListener('visibilitychange', () => {
    clearTimeout(timer); timer = 0;
    // Скрытая вкладка сохраняет даже незаконченный кадр; пропуска кадров нет.
    if (!document.hidden) { started = performance.now(); schedule(0); }
  });
  schedule(0);
})();
