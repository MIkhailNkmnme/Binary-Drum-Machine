/* v8 (Хаб v0.463). Двойной щелчок по любому полю — пауза и продолжение всех трёх
   построений, в любом виде сравнения и в дзене; в дзене кнопки «Пауза» и «Меню»
   скрыты, поэтому выход из дзена ещё и удержанием указателя на поле.
   v7. Главная: синхронное сравнение трёх полей — конусы 5.7, «обе стороны» 5.9
   (пара вершин −m/+m одним проходом) и глобальный XOR 5.8. Третье поле на экране
   перевёрнуто (scaleY(-1) в CSS), данные у всех трёх в обычной ориентации.
   В наложении XOR/AND доступны любые две пары: 1–2, 2–3, 3–1. */
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
  const cones = MAYATNIK.field(W, H, 'empty', CENTER);
  const grid = new Int8Array(W * H).fill(-1);
  const pairGrid = new Int8Array(W * H).fill(-1);
  const publishedLeft = new Int8Array(W * H), publishedRight = new Int8Array(W * H), publishedPair = new Int8Array(W * H);
  const coneImage = coneCtx.createImageData(W, H), xorImage = xorCtx.createImageData(W, H);
  const pairImage = pairCtx && pairCtx.createImageData(W, H);
  const root = document.getElementById('hubXorBackground'), blend = document.getElementById('hubBlend');
  const blendCtx = blend && blend.getContext('2d', { alpha: true });
  if (blend) { blend.width = W; blend.height = H; }
  const blendImage = blendCtx && blendCtx.createImageData(W, H);
  const modeButton = document.getElementById('hubCompareMode'), mirrorButton = document.getElementById('hubCompareMirror');
  const pauseButton = document.getElementById('hubComparePause');
  const paletteButton = document.getElementById('hubComparePalette'), paletteMenu = document.getElementById('hubComparePaletteMenu');
  const pairsBox = document.getElementById('hubComparePairs');
  const PALETTES = {
    ice: { label: 'Лёд', left: [88,183,255], middle: [232,237,245], right: [255,179,91], common: [232,237,245], legend: 'Конусы — голубой · Обе стороны — белый · Всё поле — оранжевый · Общие — белый' },
    mint: { label: 'Мята', left: [115,228,165], middle: [255,211,91], right: [255,135,207], common: [255,211,91], legend: 'Конусы — мятный · Обе стороны — жёлтый · Всё поле — розовый · Общие — жёлтый' },
    mono: { label: 'Моно', left: [255,255,255], middle: [221,221,221], right: [153,153,153], common: [221,221,221], legend: 'Конусы — белый · Обе стороны — светло-серый · Всё поле — серый' },
    green: { label: 'Зелёный', left: [51,122,52], middle: [51,122,52], right: [51,122,52], common: [51,122,52], legend: 'Конусы, обе стороны, всё поле и общие — зелёный' }
  };
  const STORAGE = 'zerk_hub_compare_v1', MODES = ['split', 'xor', 'and'], PAIRS = ['12', '23', '31', '123'];
  const PAIR_LABEL = { 12: '1–2', 23: '2–3', 31: '3–1', 123: '1–2–3' };
  const view = { mode: 'split', mirror: false, zoom: 1, palette: 'ice', pair: '12',
    pan: { left: { x: 0, y: 0 }, right: { x: 0, y: 0 }, blend: { x: 0, y: 0 }, pair: { x: 0, y: 0 } } };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE));
    if (saved && typeof saved === 'object') {
      if (MODES.includes(saved.mode)) view.mode = saved.mode;
      if (typeof saved.mirror === 'boolean') view.mirror = saved.mirror;
      if (Object.prototype.hasOwnProperty.call(PALETTES, saved.palette)) view.palette = saved.palette;
      if (PAIRS.includes(saved.pair)) view.pair = saved.pair;
      if (typeof saved.zoom === 'number' && Number.isFinite(saved.zoom)) view.zoom = Math.max(1, Math.min(64, saved.zoom));
      for (const key of ['left', 'right', 'blend', 'pair']) for (const axis of ['x', 'y']) {
        const value = saved.pan?.[key]?.[axis];
        if (typeof value === 'number' && Number.isFinite(value)) view.pan[key][axis] = value;
      }
    }
  } catch (_) {}
  if (!middle) view.pair = '12';
  let published = false;
  let frame = -1, row = 1, timer = 0, nextFrame = true, started = performance.now();
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
    if (!paused) { started = performance.now(); schedule(0); }
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
    if (!middle) view.pair = '12';
    const modeLabel = { split: 'Рядом', xor: 'XOR', and: 'AND' }[view.mode];
    const mirrorLabel = view.mirror ? 'Зеркально' : 'Прямо';
    const pairLabel = PAIR_LABEL[view.pair];
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
    text('hubCompareOverlayLabel', modeLabel + ' ' + pairLabel + ' · ' + mirrorLabel);
    text('hubComparePaletteLabel', palette.label); text('hubComparePaletteIcon', '◐');
    text('hubCompareLegend', palette.legend);
    if (pairsBox) {
      pairsBox.hidden = view.mode === 'split';
      for (const button of pairsBox.querySelectorAll('[data-hub-pair]')) {
        const selected = button.dataset.hubPair === view.pair;
        button.classList.toggle('gz-on', selected); button.setAttribute('aria-pressed', String(selected));
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
      mirrorButton.title = 'Второе поле пары: ' + mirrorLabel + '. Отражение по горизонтали перед XOR или AND';
      mirrorButton.setAttribute('aria-label', 'Второе поле пары: ' + mirrorLabel);
      mirrorButton.setAttribute('aria-pressed', String(view.mirror));
      mirrorButton.classList.toggle('gz-on', view.mode !== 'split' && view.mirror);
    }
  }
  // 1 = конусы 5.7, 2 = обе стороны 5.9, 3 = всё поле 5.8.
  const FIELD_COLOUR = { left: 'left', pair: 'middle', right: 'right' };
  function pairFields() {
    if (view.pair === '23') return ['pair', 'right'];
    if (view.pair === '31') return ['right', 'left'];
    if (view.pair === '123') return ['left', 'pair', 'right'];   // v0.466: все три поля сразу
    return ['left', 'pair'];
  }
  function renderBlend() {
    if (!blendImage || view.mode === 'split') return;
    const palette = PALETTES[view.palette];
    const fields = pairFields().map(key => ({ key, colour: palette[FIELD_COLOUR[key]], data: key === 'pair' ? publishedPair : key === 'right' ? publishedRight : publishedLeft }));
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
      const i = r * W + c;
      let ones = 0, all = true, colour = null;
      for (const field of fields) {
        // зеркально читается всё, кроме первого поля: прежде — только второе из пары
        const j = r * W + (view.mirror && field !== fields[0] ? W - 1 - c : c);
        if (field.data[j] === 1) { ones++; if (!colour) colour = field.colour; }
        else all = false;
      }
      paint(blendImage.data, i, view.mode === 'xor' ? ones % 2 : (all ? 1 : 0), view.mode === 'and' ? palette.common : (colour || palette.common));
    }
    blendCtx.putImageData(blendImage, 0, 0);
    blend.dataset.frame = left.dataset.frame;
  }
  function changeView() {
    syncView(); saveView();
    if (published) renderPublished();
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
  if (pairsBox) pairsBox.addEventListener('click', event => {
    const button = event.target.closest('[data-hub-pair]');
    if (!button || !PAIRS.includes(button.dataset.hubPair)) return;
    view.pair = button.dataset.hubPair; changeView();
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

  // Пустота не участвует в XOR; три пустых входа оставляют клетку пустой.
  function xor3(a, b, c) {
    let v = a;
    if (b >= 0) v = v < 0 ? b : v ^ b;
    if (c >= 0) v = v < 0 ? c : v ^ c;
    return v;
  }
  function paint(pixels, i, value, colour) {
    const p = i * 4, on = value === 1;
    pixels[p] = on ? colour[0] : 0;
    pixels[p + 1] = on ? colour[1] : 0;
    pixels[p + 2] = on ? colour[2] : 0;
    pixels[p + 3] = on ? 255 : 0;   // пустые клетки прозрачны: при увеличении поля наезжают друг на друга
  }
  function renderPublished() {
    const palette = PALETTES[view.palette];
    for (let i = 0; i < W * H; i++) {
      paint(coneImage.data, i, publishedLeft[i], palette.left);
      paint(xorImage.data, i, publishedRight[i], palette.right);
      if (pairImage) paint(pairImage.data, i, publishedPair[i], palette.middle);
    }
    coneCtx.putImageData(coneImage, 0, 0); xorCtx.putImageData(xorImage, 0, 0);
    if (pairCtx) pairCtx.putImageData(pairImage, 0, 0);
    renderBlend();
  }
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
      if (frame === W) { frame = 0; cycle++; cones.val.fill(-1); grid.fill(-1); pairGrid.fill(-1); }
      const d = Math.ceil(frame / 2), pos = CENTER + (frame % 2 ? -d : d);
      grid[pos] = 1;
      // 5.9 повторяет пару шагов тест-страницы: −m и +m одной дистанцией, ровно
      // один пересчёт на пару (кадры 0, 1, 3, 5…), поэтому поле совпадает с
      // «обе стороны» на той же странице кадр в кадр, но обновляется через кадр.
      const pairStepNow = frame === 0 || frame % 2 === 1;
      pairStep = pairStepNow;
      if (middle && pairStep) {
        pairGrid[pos] = 1;
        const twin = 2 * CENTER - pos;
        if (twin >= 0 && twin < W) pairGrid[twin] = 1;
      }
      // Один исходный cone за такт; его границы обрезаются самим общим ядром.
      MAYATNIK.cone(cones, pos, H);
    }
    const visible = frame >= FIRST_FRAME;
    const end = Math.min(H, row + ROW_CHUNK);
    for (; row < end; row++) {
      const base = row * W, up = base - W;
      for (let c = 0; c < W; c++) {
        const i = base + c;
        // In-place, сверху вниз: родители уже пересчитаны в этом же кадре.
        const lv = c > 0 ? grid[up + c - 1] : -1, rv = c + 1 < W ? grid[up + c + 1] : -1;
        grid[i] = xor3(grid[i], lv, rv);
        if (middle && pairStep) {
          const pl = c > 0 ? pairGrid[up + c - 1] : -1, pr = c + 1 < W ? pairGrid[up + c + 1] : -1;
          pairGrid[i] = xor3(pairGrid[i], pl, pr);
        }
      }
    }
    if (row < H) { schedule(0); return; }
    if (visible) {
      // Готовые изображения публикуются в одном задании, без промежуточного кадра.
      publishedLeft.set(cones.val); publishedRight.set(grid); publishedPair.set(pairGrid);
      left.dataset.frame = right.dataset.frame = String(frame);
      if (middle) middle.dataset.frame = String(frame);
      published = true;
      renderPublished();
    }
    nextFrame = true;
    const continueFrame = () => {
      awaitingStats = false;
      schedule(visible ? Math.max(0, INTERVAL - (performance.now() - started)) : 0);
    };
    if (controller && typeof controller.measure === 'function') {
      awaitingStats = true;
      try {
        Promise.resolve(controller.measure({ left: cones.val, right: grid, W, H, frame, cycle })).then(continueFrame, stop);
      } catch (error) { stop(error); }
    } else continueFrame();
  }
  document.addEventListener('visibilitychange', () => {
    clearTimeout(timer); timer = 0;
    // Скрытая вкладка сохраняет даже незаконченный кадр; пропуска кадров нет.
    if (!document.hidden) { started = performance.now(); schedule(0); }
  });
  schedule(0);
})();
