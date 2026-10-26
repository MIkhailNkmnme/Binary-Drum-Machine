/* v3. Главная: синхронное сравнение конусов 5.7 и глобального XOR 5.8.
   По одному полю и изображению на сторону, без кэша прошедших кадров. */
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
  const coneImage = coneCtx.createImageData(W, H), xorImage = xorCtx.createImageData(W, H);
  const root = document.getElementById('hubXorBackground'), blend = document.getElementById('hubBlend');
  const blendCtx = blend && blend.getContext('2d', { alpha: false });
  if (blend) { blend.width = W; blend.height = H; }
  const blendImage = blendCtx && blendCtx.createImageData(W, H);
  const modeButton = document.getElementById('hubCompareMode'), mirrorButton = document.getElementById('hubCompareMirror');
  const STORAGE = 'zerk_hub_compare_v1', MODES = ['split', 'xor', 'and'];
  const view = { mode: 'split', mirror: false, zoom: 1 };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE));
    if (saved && typeof saved === 'object') {
      if (MODES.includes(saved.mode)) view.mode = saved.mode;
      if (typeof saved.mirror === 'boolean') view.mirror = saved.mirror;
      if (typeof saved.zoom === 'number' && Number.isFinite(saved.zoom)) view.zoom = Math.max(1, Math.min(64, saved.zoom));
    }
  } catch (_) {}
  let published = false;
  let frame = -1, row = 1, timer = 0, nextFrame = true, started = performance.now();

  function saveView() {
    try { localStorage.setItem(STORAGE, JSON.stringify(view)); } catch (_) {}
  }
  function text(id, value) {
    const node = document.getElementById(id); if (node) node.textContent = value;
  }
  function syncView() {
    const modeLabel = { split: 'Рядом', xor: 'XOR', and: 'AND' }[view.mode];
    const mirrorLabel = view.mirror ? 'Зеркально' : 'Прямо';
    if (root) { root.dataset.mode = view.mode; root.style.setProperty('--hubCompareZoom', String(view.zoom)); }
    text('hubCompareModeLabel', modeLabel);
    text('hubCompareModeIcon', { split: '↔', xor: '⊕', and: '∧' }[view.mode]);
    text('hubCompareMirrorLabel', mirrorLabel); text('hubCompareMirrorIcon', view.mirror ? 'Ƨ1' : '11');
    text('hubCompareOverlayLabel', modeLabel + ' · ' + mirrorLabel);
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
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
      const i = r * W + c, j = r * W + (view.mirror ? W - 1 - c : c);
      // Опубликованный #337a34 означает бит 1; чёрный объединяет 0 и пустоту.
      const av = a[i * 4] === 51, bv = b[j * 4] === 51;
      paint(blendImage.data, i, (view.mode === 'xor' ? av !== bv : av && bv) ? 1 : 0);
    }
    blendCtx.putImageData(blendImage, 0, 0);
    blend.dataset.frame = left.dataset.frame;
  }
  function changeView() {
    syncView(); saveView();
    if (!published || view.mode === 'split' || !blendCtx) return;
    // Рабочие ImageData могут уже содержать часть следующего кадра.
    // Снимки берём только при переключении, из последней опубликованной пары.
    renderBlend(coneCtx.getImageData(0, 0, W, H).data, xorCtx.getImageData(0, 0, W, H).data);
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
    const target = event.target;
    if (target && target.closest && target.closest('button,a,input,select,textarea,summary,label,dialog,[contenteditable],[role="button"],[role="slider"],[role="dialog"],[role="group"],.hub,#hubCompareTools,.gz-rail,.gz-ladder,.hubRombGrid,.hubMirrorSettings,.hubBitView,.hubColorEditor,#hubRail,#hubZoom,#hubFieldTools')) return;
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
    const delta = event.deltaY * unit;
    if (!Number.isFinite(delta) || delta === 0) return;
    event.preventDefault(); event.stopImmediatePropagation();
    view.zoom = Math.max(1, Math.min(64, view.zoom * Math.exp(-delta * .0015)));
    root.style.setProperty('--hubCompareZoom', String(view.zoom)); saveView();
  }, { capture: true, passive: false });
  syncView();

  // Пустота не участвует в XOR; три пустых входа оставляют клетку пустой.
  function xor3(a, b, c) {
    let v = a;
    if (b >= 0) v = v < 0 ? b : v ^ b;
    if (c >= 0) v = v < 0 ? c : v ^ c;
    return v;
  }
  function paint(pixels, i, value) {
    const p = i * 4, on = value === 1;
    // Точная палитра прежнего _img/hub-xor-1024.png: #337a34 / чёрный.
    pixels[p] = on ? 51 : 0;
    pixels[p + 1] = on ? 122 : 0;
    pixels[p + 2] = on ? 52 : 0;
    pixels[p + 3] = 255;
  }
  function paintCell(i) {
    paint(coneImage.data, i, cones.val[i]);
    paint(xorImage.data, i, grid[i]);
  }
  function schedule(delay) {
    if (!document.hidden) timer = setTimeout(tick, delay);
  }
  function tick() {
    timer = 0;
    if (document.hidden) return;
    if (nextFrame) {
      nextFrame = false; frame++; row = 1; started = performance.now();
      // Все 2047 вершин внутри рамки пройдены: обе стороны начинают новый цикл.
      // Не заворачиваем вершины через край и не меняем исходный алгоритм cone.
      if (frame === W) { frame = 0; cones.val.fill(-1); grid.fill(-1); }
      const d = Math.ceil(frame / 2), pos = CENTER + (frame % 2 ? -d : d);
      grid[pos] = 1;
      // Один исходный cone за такт; его границы обрезаются самим общим ядром.
      MAYATNIK.cone(cones, pos, H);
    }
    const visible = frame >= FIRST_FRAME;
    if (visible && row === 1) for (let c = 0; c < W; c++) paintCell(c);
    const end = Math.min(H, row + ROW_CHUNK);
    for (; row < end; row++) {
      const base = row * W, up = base - W;
      for (let c = 0; c < W; c++) {
        const i = base + c;
        // In-place, сверху вниз: родители уже пересчитаны в этом же кадре.
        grid[i] = xor3(grid[i], c > 0 ? grid[up + c - 1] : -1,
          c + 1 < W ? grid[up + c + 1] : -1);
        if (visible) paintCell(i);
      }
    }
    if (row < H) { schedule(0); return; }
    if (visible) {
      // Оба готовых изображения публикуются в одном задании, без промежуточного кадра.
      coneCtx.putImageData(coneImage, 0, 0);
      xorCtx.putImageData(xorImage, 0, 0);
      left.dataset.frame = right.dataset.frame = String(frame);
      published = true;
      renderBlend(coneImage.data, xorImage.data);
    }
    nextFrame = true;
    schedule(visible ? Math.max(0, INTERVAL - (performance.now() - started)) : 0);
  }
  document.addEventListener('visibilitychange', () => {
    clearTimeout(timer); timer = 0;
    // Скрытая вкладка сохраняет даже незаконченный кадр; пропуска кадров нет.
    if (!document.hidden) { started = performance.now(); schedule(0); }
  });
  schedule(0);
})();
