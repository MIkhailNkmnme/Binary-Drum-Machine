/* v6. Главная: синхронное сравнение конусов 5.7 и глобального XOR 5.8.
   Рабочая и последняя опубликованная пара полей, без истории кадров. */
(() => {
  'use strict';
  const left = document.getElementById('hubCones'), right = document.getElementById('hubXor');
  if (!left || !right || typeof MAYATNIK === 'undefined') return;
  const coneCtx = left.getContext('2d', { alpha: false });
  const xorCtx = right.getContext('2d', { alpha: false });
  if (!coneCtx || !xorCtx) return;
  const H = 1024, W = 2 * H - 1, CENTER = W >> 1;
  const FIRST_FRAME = 8, INTERVAL = 120, ROW_CHUNK = 64;
  left.width = right.width = W; left.height = right.height = H;
  const cones = MAYATNIK.field(W, H, 'empty', CENTER);
  const grid = new Int8Array(W * H).fill(-1);
  const publishedLeft = new Int8Array(W * H), publishedRight = new Int8Array(W * H);
  const coneImage = coneCtx.createImageData(W, H), xorImage = xorCtx.createImageData(W, H);
  const root = document.getElementById('hubXorBackground'), blend = document.getElementById('hubBlend');
  const blendCtx = blend && blend.getContext('2d', { alpha: false });
  if (blend) { blend.width = W; blend.height = H; }
  const blendImage = blendCtx && blendCtx.createImageData(W, H);
  const modeButton = document.getElementById('hubCompareMode'), mirrorButton = document.getElementById('hubCompareMirror');
  const pauseButton = document.getElementById('hubComparePause');
  const paletteButton = document.getElementById('hubComparePalette'), paletteMenu = document.getElementById('hubComparePaletteMenu');
  const PALETTES = {
    ice: { label: 'Лёд', left: [88,183,255], right: [255,179,91], common: [232,237,245], legend: 'Конусы — голубой · Всё поле — оранжевый · Общие — белый' },
    mint: { label: 'Мята', left: [115,228,165], right: [255,135,207], common: [255,211,91], legend: 'Конусы — мятный · Всё поле — розовый · Общие — жёлтый' },
    mono: { label: 'Моно', left: [255,255,255], right: [153,153,153], common: [221,221,221], legend: 'Конусы — белый · Всё поле — серый · Общие — светло-серый' },
    green: { label: 'Зелёный', left: [51,122,52], right: [51,122,52], common: [51,122,52], legend: 'Конусы, всё поле и общие — зелёный' }
  };
  const STORAGE = 'zerk_hub_compare_v1', MODES = ['split', 'xor', 'and'];
  const view = { mode: 'split', mirror: false, zoom: 1, palette: 'ice', pan: { left: { x: 0, y: 0 }, right: { x: 0, y: 0 }, blend: { x: 0, y: 0 } } };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE));
    if (saved && typeof saved === 'object') {
      if (MODES.includes(saved.mode)) view.mode = saved.mode;
      if (typeof saved.mirror === 'boolean') view.mirror = saved.mirror;
      if (Object.prototype.hasOwnProperty.call(PALETTES, saved.palette)) view.palette = saved.palette;
      if (typeof saved.zoom === 'number' && Number.isFinite(saved.zoom)) view.zoom = Math.max(1, Math.min(64, saved.zoom));
      for (const key of ['left', 'right', 'blend']) for (const axis of ['x', 'y']) {
        const value = saved.pan?.[key]?.[axis];
        if (typeof value === 'number' && Number.isFinite(value)) view.pan[key][axis] = value;
      }
    }
  } catch (_) {}
  let published = false;
  let frame = -1, row = 1, timer = 0, nextFrame = true, started = performance.now();
  let cycle = 0, awaitingStats = false, failed = false, paused = false, controller = null;
  let drag = null, middle = null, swallowClick = false;
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
    const label = paused ? 'Продолжить оба построения' : 'Пауза обоих построений';
    pauseButton.setAttribute('aria-label', label); pauseButton.title = label;
    pauseButton.classList.toggle('gz-on', paused);
    text('hubComparePauseIcon', paused ? '▶' : 'Ⅱ');
  }
  if (pauseButton) pauseButton.addEventListener('click', () => {
    if (failed) return;
    paused = !paused;
    clearTimeout(timer); timer = 0;
    syncPlayback();
    // Neither the partially computed row nor an in-flight statistics job is
    // discarded. The statistics continuation also respects this pause.
    if (!paused) { started = performance.now(); schedule(0); }
  });
  syncPlayback();

  function saveView() {
    try { localStorage.setItem(STORAGE, JSON.stringify(view)); } catch (_) {}
  }
  function text(id, value) {
    const node = document.getElementById(id); if (node) node.textContent = value;
  }
  const PAN_KEYS = ['left', 'right', 'blend'], canvases = { left, right, blend };
  const CONTROL_SELECTOR = 'button,a,input,select,textarea,summary,label,dialog,[contenteditable],[role="button"],[role="slider"],[role="dialog"],[role="group"],.hub,#hubCompareTools,#hubComparePanel,.gz-rail,.gz-ladder,.hubRombGrid,.hubMirrorSettings,.hubBitView,.hubColorEditor,#hubRail,#hubZoom,#hubFieldTools';
  function isControl(event) { return !!event.target?.closest?.(CONTROL_SELECTOR); }
  function paneRect(key) { return canvases[key]?.parentElement?.getBoundingClientRect?.(); }
  function paneAt(event) {
    for (const key of view.mode === 'split' ? ['left', 'right'] : ['blend']) {
      const rect = paneRect(key);
      if (rect && rect.width > 0 && rect.height > 0 && event.clientX >= rect.left && event.clientX < rect.left + rect.width && event.clientY >= rect.top && event.clientY < rect.top + rect.height) return key;
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
      const pan = view.pan[key], rect = paneRect(key);
      if (view.zoom === 1) pan.x = pan.y = 0;
      else if (rect && rect.width > 0 && rect.height > 0) {
        const pw = rect.width, ph = rect.height, fit = Math.min(pw / W, ph / H);
        const sw = W * fit * view.zoom, sh = H * fit * view.zoom;
        const baseX = key === 'left' ? 0 : key === 'right' ? pw - sw : (pw - sw) / 2;
        pan.x = sw > pw ? Math.max(pw - sw - baseX, Math.min(-baseX, pan.x)) : 0;
        const yLimit = Math.max(0, (sh - ph) / 2);
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
    const previous = drag; drag = null;
    document.body?.classList?.toggle('hubCompareDragging', false);
    try { root.releasePointerCapture?.(previous.id); } catch (_) {}
    saveView();
  }
  function syncView() {
    const modeLabel = { split: 'Рядом', xor: 'XOR', and: 'AND' }[view.mode];
    const mirrorLabel = view.mirror ? 'Зеркально' : 'Прямо';
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
    text('hubCompareOverlayLabel', modeLabel + ' · ' + mirrorLabel);
    text('hubComparePaletteLabel', palette.label); text('hubComparePaletteIcon', '◐');
    text('hubCompareLegend', palette.legend);
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
      mirrorButton.title = 'Правый источник: ' + mirrorLabel + '. Отражение по горизонтали перед XOR или AND';
      mirrorButton.setAttribute('aria-label', 'Правый источник: ' + mirrorLabel);
      mirrorButton.setAttribute('aria-pressed', String(view.mirror));
      mirrorButton.classList.toggle('gz-on', view.mode !== 'split' && view.mirror);
    }
  }
  function renderBlend(a, b) {
    if (!blendImage || view.mode === 'split') return;
    const palette = PALETTES[view.palette];
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
      const i = r * W + c, j = r * W + (view.mirror ? W - 1 - c : c);
      const av = a[i] === 1, bv = b[j] === 1;
      const on = view.mode === 'xor' ? av !== bv : av && bv;
      paint(blendImage.data, i, on ? 1 : 0, view.mode === 'and' ? palette.common : av ? palette.left : palette.right);
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
      if (event.button === 1) middle = null;
      if (isControl(event) || event.ctrlKey || event.metaKey || (event.pointerType && event.pointerType !== 'mouse' && event.pointerType !== 'pen')) return;
      const key = paneAt(event); if (!key) return;
      if (event.button === 1) {
        finishDrag(); middle = { id: event.pointerId }; consume(event);
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
      if (!drag || event.pointerId !== drag.id) return;
      consume(event);
      if (event.buttons === 0) { finishDrag(); return; }
      drag.lastX = event.clientX; drag.lastY = event.clientY;
      view.pan[drag.key].x = drag.panX + event.clientX - drag.x;
      view.pan[drag.key].y = drag.panY + event.clientY - drag.y;
      applyPan(true);
    }, capture);
    window.addEventListener('pointerup', event => {
      if (middle && event.pointerId === middle.id && event.button === 1) consume(event);
      if (drag && event.pointerId === drag.id && event.button === 0) { consume(event); swallowClick = true; finishDrag(); }
    }, capture);
    window.addEventListener('pointercancel', event => {
      if (middle && event.pointerId === middle.id) { consume(event); middle = null; }
      if (drag && event.pointerId === drag.id) { consume(event); finishDrag(); }
    }, capture);
    window.addEventListener('mousedown', event => {
      if ((event.button === 1 && middle) || (event.button === 0 && drag)) consume(event);
    }, capture);
    window.addEventListener('auxclick', event => {
      if (event.button === 1 && middle) { consume(event); middle = null; }
    }, capture);
    window.addEventListener('click', event => {
      if (swallowClick && event.button === 0) { swallowClick = false; if (!isControl(event)) consume(event); }
    }, capture);
    window.addEventListener('blur', () => { middle = null; swallowClick = false; finishDrag(); });
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
    pixels[p + 3] = 255;
  }
  function renderPublished() {
    const palette = PALETTES[view.palette];
    for (let i = 0; i < W * H; i++) {
      paint(coneImage.data, i, publishedLeft[i], palette.left);
      paint(xorImage.data, i, publishedRight[i], palette.right);
    }
    coneCtx.putImageData(coneImage, 0, 0); xorCtx.putImageData(xorImage, 0, 0);
    renderBlend(publishedLeft, publishedRight);
  }
  function schedule(delay) {
    if (!timer && !document.hidden && !awaitingStats && !failed && !paused) timer = setTimeout(tick, delay);
  }
  function tick() {
    timer = 0;
    if (document.hidden || awaitingStats || failed || paused) return;
    if (nextFrame) {
      nextFrame = false; frame++; row = 1; started = performance.now();
      // Все 2047 вершин внутри рамки пройдены: обе стороны начинают новый цикл.
      // Не заворачиваем вершины через край и не меняем исходный алгоритм cone.
      if (frame === W) { frame = 0; cycle++; cones.val.fill(-1); grid.fill(-1); }
      const d = Math.ceil(frame / 2), pos = CENTER + (frame % 2 ? -d : d);
      grid[pos] = 1;
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
        grid[i] = xor3(grid[i], c > 0 ? grid[up + c - 1] : -1,
          c + 1 < W ? grid[up + c + 1] : -1);
      }
    }
    if (row < H) { schedule(0); return; }
    if (visible) {
      // Оба готовых изображения публикуются в одном задании, без промежуточного кадра.
      publishedLeft.set(cones.val); publishedRight.set(grid);
      left.dataset.frame = right.dataset.frame = String(frame);
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
