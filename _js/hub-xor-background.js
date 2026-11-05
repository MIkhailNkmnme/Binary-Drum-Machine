/* v19 (Хаб v0.478). Пинг-понг показывает и кадры ниже стартовых 8 — отскок
   доходит до центра, а не стоит на кадре 8.
   v18 (Хаб v0.477). Кнопка «Цикл / Край / Пинг»: старый сброс на 2047,
   перескок вершины через край и пинг-понг с пересчётом поля (чекпоинты).
   v17 (Хаб v0.476). Вершина, дошедшая до края, перескакивает на противоположную
   сторону и идёт дальше в том же направлении; поле не сбрасывается.
   v16 (Хаб v0.475). Пинг-понг — откатан: обратный проход не пересчитывал поле.
   v14 (Хаб v0.473). Выше 16× плеер считает несколько кадров за тик и рисует
   последний: кнопка 32…1024× снова заметно ускоряет, узор тот же — кадры
   не пропускаются, только промежуточные не выводятся.
   v13 (Хаб v0.472). Скорость плеера — 0,25× … 1024× шагом ×2; номер хаба
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
  // v20 (2026-11-05): четвёртый режим «Рост» — на 2047-м шаге поле удваивается один раз
  // (1024→2048 строк, 2047→4095 столбцов), панели показывают увеличенное поле уменьшенным
  // вдвое: старый рисунок остаётся верхней половиной, масштаб — прежним.
  let FW = W, FH = H, FCENTER = CENTER, grown = false;
  const FIRST_FRAME = 8, INTERVAL = 120, ROW_CHUNK = 64;
  left.width = right.width = W; left.height = right.height = H;
  if (middle) { middle.width = W; middle.height = H; }
  const kernel = HubXorKernel;
  let cones = kernel.create(FW, FH), grid = kernel.create(FW, FH), pairGrid = kernel.create(FW, FH);
  let packedLeft = kernel.create(FW, FH), packedRight = kernel.create(FW, FH), packedPair = kernel.create(FW, FH);
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
  const cycleButton = document.getElementById('hubCompareCycle');
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
  const CYCLE_MODES = ['cycle', 'wrap', 'pingpong', 'grow'];
  const CYCLE_NAMES = { cycle: 'Цикл', wrap: 'Край', pingpong: 'Пинг', grow: 'Рост' };
  const CYCLE_TITLES = { cycle: 'Цикл: на 2047 поле сбрасывается и начинается заново', wrap: 'Край: дошедшая до края вершина перескакивает на противоположную сторону', pingpong: 'Пинг-понг: после 2047 плеер идёт назад с пересчётом поля', grow: 'Рост: на 2047 поле удваивается один раз, масштаб делится пополам; старый рисунок остаётся верхней половиной, построение продолжается в увеличенном поле' };
  // 1 = конусы 5.7, 2 = обе стороны 5.9, 3 = всё поле 5.8.
  const FIELDS = [1, 2, 3];
  const FIELD_KEYS = { 1: 'left', 2: 'pair', 3: 'right' };
  const FIELD_NAMES = { 1: 'конусы 5.7', 2: 'обе стороны 5.9', 3: 'всё поле 5.8' };
  const LEGACY_PAIRS = { 12: [1, 2], 23: [2, 3], 31: [1, 3], 123: [1, 2, 3] };
  const view = { mode: 'split', mirror: false, zoom: 1, palette: 'ice', fields: [1, 2, 3], speed: 1, cycleMode: 'wrap',
    pan: { left: { x: 0, y: 0 }, right: { x: 0, y: 0 }, blend: { x: 0, y: 0 }, pair: { x: 0, y: 0 } } };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE));
    if (saved && typeof saved === 'object') {
      if (MODES.includes(saved.mode)) view.mode = saved.mode;
      if (typeof saved.mirror === 'boolean') view.mirror = saved.mirror;
      if (Object.prototype.hasOwnProperty.call(PALETTES, saved.palette)) view.palette = saved.palette;
      if (Array.isArray(saved.fields)) {
        const fields = [...new Set(saved.fields.map(Number).filter(field => FIELDS.includes(field)))].sort((a, b) => a - b);
        // v0.481: прежняя пара по умолчанию 1–2 поднимается до 1–2–3 (все поля включены)
        if (fields.length) view.fields = (fields.length === 2 && fields[0] === 1 && fields[1] === 2) ? [1, 2, 3] : fields;
      } else if (LEGACY_PAIRS[saved.pair]) view.fields = LEGACY_PAIRS[saved.pair].slice();   // прежняя пара 1–2 / 2–3 / 3–1 / 1–2–3
      if (typeof saved.zoom === 'number' && Number.isFinite(saved.zoom)) view.zoom = Math.max(1, Math.min(64, saved.zoom));
      if (SPEEDS.includes(saved.speed)) view.speed = saved.speed;
      if (CYCLE_MODES.includes(saved.cycleMode)) view.cycleMode = saved.cycleMode;
      for (const key of ['left', 'right', 'blend', 'pair']) for (const axis of ['x', 'y']) {
        const value = saved.pan?.[key]?.[axis];
        if (typeof value === 'number' && Number.isFinite(value)) view.pan[key][axis] = value;
      }
    }
  } catch (_) {}
  let published = false;
  let step = -1, frame = -1, row = 1, timer = 0, nextFrame = true, started = performance.now();
  // v20 (Хаб v0.479). Вспышка конуса новой вершины поля 5.7 — по кнопке.
  let coneFlashOn = false, coneFlash = [];
  const CONE_FLASH_MS = 700;
  function paintConeFlash() {
    const g = view.mode === 'split' ? coneCtx : (blendCtx || coneCtx);
    if (!coneFlashOn || !g) { coneFlash.length = 0; return; }
    const now = performance.now();
    coneFlash = coneFlash.filter(x => now - x.t < CONE_FLASH_MS);
    if (coneFlash.length > 4) coneFlash.splice(0, coneFlash.length - 4);
    if (!coneFlash.length) return;
    for (const x of coneFlash) {
      const a = 0.18 * (1 - (now - x.t) / CONE_FLASH_MS);
      if (a <= 0) continue;
      g.save();
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = a;
      g.fillStyle = '#ffd35b';
      g.beginPath();
      g.moveTo(x.c, 0);
      g.lineTo(x.c - (H - 1), H - 1);
      g.lineTo(x.c + (H - 1), H - 1);
      g.closePath();
      g.fill();
      g.globalAlpha = Math.min(1, a * 4); g.lineWidth = 2; g.strokeStyle = '#ffd35b'; g.stroke();
      g.restore();
    }
  }
  let pingDir = 1, pingFrame = -1, pingCycle = 0, pingStarted = false;
  const pingCheckpoints = [], PING_CHECKPOINT = 64;
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
      pairsBox.hidden = false;   // v0.481: кнопки 1/2/3 видны в любом режиме
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
    if (cycleButton) {
      const label = CYCLE_NAMES[view.cycleMode] || CYCLE_NAMES.wrap;
      text('hubCompareCycleLabel', label);
      cycleButton.title = (CYCLE_TITLES[view.cycleMode] || CYCLE_TITLES.wrap) + '. Щелчок — Цикл → Край → Пинг-понг';
      cycleButton.setAttribute('aria-label', 'Режим края: ' + label);
      cycleButton.classList.toggle('gz-on', view.cycleMode !== 'wrap');
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
    if (blendPixels && !grown) {
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
  const prevFrameButton = document.getElementById('hubPrevFrame');
  if (prevFrameButton) prevFrameButton.addEventListener('click', () => {
    if (view.cycleMode !== 'pingpong') {   // первый щелчок — включить «Пинг» (он умеет идти назад)
      view.cycleMode = 'pingpong'; resetAnimation(); changeView();
      prevFrameButton.title = 'Режим «Пинг» включён — «−1 кадр» шагает назад по чекпоинтам';
      prevFrameButton.setAttribute('aria-label', 'Кадр назад: режим Пинг включён');
      return;
    }
    if (!paused) { paused = true; syncPlayback(); }
    const target = Math.max(0, (pingFrame < 0 ? frame : pingFrame) - 1);
    if (target === pingFrame) return;
    pingRecompute(target);
    pingFrame = target; frame = target; step = target; pingDir = -1;
    pingStarted = frame >= FIRST_FRAME;
    kernel.copy(packedLeft, cones); kernel.copy(packedRight, grid); kernel.copy(packedPair, pairGrid); decoded = false;
    left.dataset.frame = right.dataset.frame = String(frame);
    if (middle) middle.dataset.frame = String(frame);
    published = true; publishedFrame = frame; publishedCycle = cycle;
    renderPublished();
  });
  const coneFlashButton = document.getElementById('hubVtxFlash');
  if (coneFlashButton) coneFlashButton.addEventListener('click', () => { coneFlashOn = !coneFlashOn; coneFlashButton.setAttribute('aria-pressed', String(coneFlashOn)); coneFlashButton.classList.toggle('gz-on', coneFlashOn); if (!coneFlashOn) coneFlash.length = 0; });
  if (cycleButton) cycleButton.addEventListener('click', () => {
    view.cycleMode = CYCLE_MODES[(CYCLE_MODES.indexOf(view.cycleMode) + 1) % CYCLE_MODES.length];
    resetAnimation();
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
  function unpackDown() {
    const list = [[packedLeft, publishedLeft], [packedRight, publishedRight], [packedPair, publishedPair]];
    for (const [f, out] of list) {
      const { stride, bits, valid } = f;
      for (let r = 0; r < H; r++) {
        const base = (2 * r) * stride, row = r * W;
        for (let c = 0; c < W; c++) {
          const fc = 2 * c, w = fc >>> 5, m = 1 << (fc & 31);
          out[row + c] = (valid[base + w] & m) ? ((bits[base + w] & m) ? 1 : 0) : -1;
        }
      }
    }
  }
  function decodePublished() {
    if (decoded) return;
    if (grown) unpackDown();
    else { kernel.unpack(packedLeft, publishedLeft); kernel.unpack(packedRight, publishedRight); kernel.unpack(packedPair, publishedPair); }
    decoded = true;
  }
  function paint(pixels, i, value, colour) {
    const p = i * 4, on = value === 1;
    pixels[p] = on ? colour[0] : 0;
    pixels[p + 1] = on ? colour[1] : 0;
    pixels[p + 2] = on ? colour[2] : 0;
    pixels[p + 3] = on ? 255 : 0;   // пустые клетки прозрачны: при увеличении поля наезжают друг на друга
  }
  // Режим «Рост»: панель показывает вдвое уменьшенную копию увеличенного поля.
  function paintDown(f, pixels, colour) {
    const { stride, bits } = f;
    for (let r = 0; r < H; r++) {
      const base = (2 * r) * stride;
      let i = r * W;
      for (let c = 0; c < W; c++, i++) {
        const fc = 2 * c;
        pixels[i] = ((bits[base + (fc >>> 5)] >>> (fc & 31)) & 1) ? colour : 0;
      }
    }
  }
  function renderPublished(force = false) {
    const palette = PALETTES[view.palette];
    if (view.mode === 'split') {
      if (grown && conePixels) {
        const lc = colour32(palette.left), rc = colour32(palette.right), mc = colour32(palette.middle);
        paintDown(packedLeft, conePixels, lc); paintDown(packedRight, xorPixels, rc);
        const repaintPair = !!pairPixels && (force || pairStep || !pairPainted);
        if (repaintPair) paintDown(packedPair, pairPixels, mc);
        coneCtx.putImageData(coneImage, 0, 0); xorCtx.putImageData(xorImage, 0, 0);
        if (repaintPair) { pairCtx.putImageData(pairImage, 0, 0); pairPainted = true; }
      } else if (conePixels) {
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
    paintConeFlash();
  }
  function frameInterval() { return INTERVAL / view.speed; }
  // v0.473: после 16× плеер упирается в расчёт одного кадра. Чтобы кнопка
  // 32…1024× действительно ускоряла, за один тик считается несколько кадров,
  // а рисуется только последний: узор тот же, промежуточные кадры не видны.
  function framesPerTick() {
    return Math.min(16, Math.max(2, Math.round(view.speed / 8)));
  }
  function baseApexPos(s) {
    const d = Math.ceil(s / 2);
    return FCENTER + (s % 2 ? -d : d);
  }
  function apexPos(s) {
    const pos = baseApexPos(s);
    if (view.cycleMode === 'wrap') return ((pos % W) + W) % W;
    if (view.cycleMode === 'grow') return ((pos % FW) + FW) % FW;
    return pos;
  }
  function shiftCopy(dst, src, bitOffset) {
    const wordOff = bitOffset >>> 5;
    for (let r = 0; r < src.H; r++) {
      const sb = r * src.stride, db = r * dst.stride + wordOff;
      for (let w = 0; w < src.stride; w++) { dst.bits[db + w] = src.bits[sb + w]; dst.valid[db + w] = src.valid[sb + w]; }
    }
  }
  // Рост: один раз удваиваем поле; старый рисунок сдвигаем на половину ширины — он
  // становится верхней половиной нового, а панели показывают поле вдвое уменьшенным.
  function growField() {
    if (grown) return;
    const oldCones = cones, oldGrid = grid, oldPair = pairGrid;
    FW = 2 * FW + 1; FH = 2 * FH; FCENTER = (FW - 1) >> 1;
    const offset = (FW - oldCones.W) >> 1;
    cones = kernel.create(FW, FH); grid = kernel.create(FW, FH); pairGrid = kernel.create(FW, FH);
    packedLeft = kernel.create(FW, FH); packedRight = kernel.create(FW, FH); packedPair = kernel.create(FW, FH);
    shiftCopy(cones, oldCones, offset); shiftCopy(grid, oldGrid, offset); shiftCopy(pairGrid, oldPair, offset);
    grown = true; decoded = false;
  }
  function resetFields() {
    if (grown) {
      grown = false; FW = W; FH = H; FCENTER = CENTER;
      cones = kernel.create(FW, FH); grid = kernel.create(FW, FH); pairGrid = kernel.create(FW, FH);
      packedLeft = kernel.create(FW, FH); packedRight = kernel.create(FW, FH); packedPair = kernel.create(FW, FH);
      decoded = false;
    }
    kernel.reset(cones); kernel.reset(grid); kernel.reset(pairGrid);
  }
  function frameSpan() { return grown ? FW : W; }
  function advanceWholeFrame() {
    step++;
    if (view.cycleMode === 'grow' && !grown && step >= W) growField();
    if (view.cycleMode === 'cycle') {
      if (step >= W) { step = 0; cycle++; resetFields(); }
      frame = step;
    } else {
      const span = frameSpan();
      frame = step % span; cycle = Math.floor(step / span);
    }
    row = 1;
    const pos = apexPos(step);
    if (coneFlashOn) coneFlash.push({ c: pos, t: performance.now() });
    kernel.apex(grid, pos);
    pairStep = step === 0 || step % 2 === 1;
    if (middle && pairStep) {
      kernel.apex(pairGrid, pos);
      const twinRaw = 2 * FCENTER - pos;
      const twin = view.cycleMode === 'wrap' ? ((twinRaw % W) + W) % W
        : view.cycleMode === 'grow' ? ((twinRaw % FW) + FW) % FW : twinRaw;
      kernel.apex(pairGrid, twin);
    }
    kernel.cone(cones, pos);
    kernel.sweep(grid, 1, FH);
    if (middle && pairStep) kernel.sweep(pairGrid, 1, FH);
    row = FH;
  }
  function schedule(delay) {
    if (!timer && !document.hidden && !awaitingStats && !failed && !paused) timer = setTimeout(tick, delay);
  }
  function resetAnimation() {
    clearTimeout(timer); timer = 0;
    step = -1; frame = -1; cycle = 0; row = 1; nextFrame = true; started = performance.now();
    pingDir = 1; pingFrame = -1; pingCycle = 0; pingStarted = false; pingCheckpoints.length = 0;
    resetFields();
    published = false;
    if (!paused) schedule(0);
  }
  function pingApply(k) {
    frame = k; row = 1;
    if (coneFlashOn) coneFlash.push({ c: baseApexPos(k), t: performance.now() });
    const pos = baseApexPos(k);
    kernel.apex(grid, pos);
    pairStep = k === 0 || k % 2 === 1;
    if (middle && pairStep) {
      kernel.apex(pairGrid, pos);
      kernel.apex(pairGrid, 2 * CENTER - pos);
    }
    kernel.cone(cones, pos);
    kernel.sweep(grid, 1, H);
    if (middle && pairStep) kernel.sweep(pairGrid, 1, H);
    row = H;
  }
  function pingSave(k) {
    if (k < 0 || k % PING_CHECKPOINT) return;
    const i = k / PING_CHECKPOINT;
    let cp = pingCheckpoints[i];
    if (!cp) cp = pingCheckpoints[i] = { grid: kernel.create(W, H), pair: kernel.create(W, H), cones: kernel.create(W, H) };
    kernel.copy(cp.grid, grid); kernel.copy(cp.pair, pairGrid); kernel.copy(cp.cones, cones);
  }
  function pingRecompute(target) {
    if (target < 0) { resetFields(); frame = -1; return; }
    const cpFrame = Math.floor(target / PING_CHECKPOINT) * PING_CHECKPOINT;
    const cp = pingCheckpoints[cpFrame / PING_CHECKPOINT];
    let start = 0;
    if (cp) {
      kernel.copy(grid, cp.grid); kernel.copy(pairGrid, cp.pair); kernel.copy(cones, cp.cones);
      frame = cpFrame; start = cpFrame + 1;
    } else {
      resetFields(); frame = -1;
    }
    for (let k = start; k <= target; k++) pingApply(k);
    frame = target;
  }
  function pingTick(statsOn) {
    const startedAt = performance.now();
    const steps = view.speed > 16 && !statsOn ? framesPerTick() : 1;
    if (pingDir > 0) {
      if (pingFrame >= W - 1) { pingDir = -1; pingCycle++; }
      else {
        const advance = Math.min(steps, W - 1 - pingFrame);
        for (let i = 0; i < advance; i++) {
          pingFrame++; pingApply(pingFrame);
          if (pingFrame % PING_CHECKPOINT === 0) pingSave(pingFrame);
        }
      }
    }
    if (pingDir < 0) {
      const target = Math.max(0, pingFrame - steps);
      pingRecompute(target);
      pingFrame = target;
      if (pingFrame === 0) pingDir = 1;
    }
    frame = pingFrame; step = pingFrame; cycle = pingCycle;
    if (frame >= FIRST_FRAME) pingStarted = true;
    if (pingStarted) {
      kernel.copy(packedLeft, cones); kernel.copy(packedRight, grid); kernel.copy(packedPair, pairGrid); decoded = false;
      left.dataset.frame = right.dataset.frame = String(frame);
      if (middle) middle.dataset.frame = String(frame);
      published = true; publishedFrame = frame; publishedCycle = cycle;
      renderPublished();
    }
    const finish = () => schedule(Math.max(0, frameInterval() - (performance.now() - startedAt)));
    if (statsOn && pingStarted) {
      awaitingStats = true;
      decodePublished();
      Promise.resolve(controller.measure({ left: publishedLeft, middle: publishedPair, right: publishedRight, W, H, frame, cycle }))
        .then(() => { awaitingStats = false; if (!paused) finish(); }, stop);
      return;
    }
    finish();
  }
  function tick() {
    timer = 0;
    if (document.hidden || awaitingStats || failed || paused) return;
    // Пока ни одна панель статистики не открыта, расчёт не тормозит плеер:
    // кадры идут со скоростью кнопки, статистика начинается при открытии панели.
    const statsOn = controller && typeof controller.measure === 'function' &&
      (typeof controller.active !== 'function' || controller.active());
    if (view.cycleMode === 'pingpong') { pingTick(statsOn); return; }
    if (view.speed > 16 && !statsOn) {
      const startedAt = performance.now();
      const steps = framesPerTick();
      for (let i = 0; i < steps; i++) advanceWholeFrame();
      if (view.cycleMode === 'cycle' ? frame >= FIRST_FRAME : step >= FIRST_FRAME) {
        kernel.copy(packedLeft, cones); kernel.copy(packedRight, grid); kernel.copy(packedPair, pairGrid); decoded = false;
        left.dataset.frame = right.dataset.frame = String(frame);
        if (middle) middle.dataset.frame = String(frame);
        published = true; publishedFrame = frame; publishedCycle = cycle;
        renderPublished();
      }
      nextFrame = true;
      schedule(Math.max(0, frameInterval() - (performance.now() - startedAt)));
      return;
    }
    if (nextFrame) {
      nextFrame = false; step++; row = 1; started = performance.now();
      if (view.cycleMode === 'grow' && !grown && step >= W) growField();
      if (view.cycleMode === 'cycle') {
        if (step >= W) { step = 0; cycle++; resetFields(); }
        frame = step;
      } else {
        const span = frameSpan();
        frame = step % span; cycle = Math.floor(step / span);
      }
      const pos = apexPos(step);
      if (coneFlashOn) coneFlash.push({ c: pos, t: performance.now() });   // v0.480: вспышка в основном проходе
      kernel.apex(grid, pos);
      // 5.9 повторяет пару шагов тест-страницы: −m и +m одной дистанцией, ровно
      // один пересчёт на пару (кадры 0, 1, 3, 5…), поэтому поле совпадает с
      // «обе стороны» на той же странице кадр в кадр, но обновляется через кадр.
      const pairStepNow = step === 0 || step % 2 === 1;
      pairStep = pairStepNow;
      if (middle && pairStep) {
        kernel.apex(pairGrid, pos);
        const twinRaw = 2 * FCENTER - pos;
        const twin = view.cycleMode === 'wrap' ? ((twinRaw % W) + W) % W
          : view.cycleMode === 'grow' ? ((twinRaw % FW) + FW) % FW : twinRaw;
        kernel.apex(pairGrid, twin);
      }
      // Один исходный cone за такт; packed-ядро сохраняет границы и чётность.
      kernel.cone(cones, pos);
    }
    const visible = view.cycleMode === 'cycle' ? frame >= FIRST_FRAME : step >= FIRST_FRAME;
    // На высокой скорости режем кадр крупнее: меньше таймеров, больше кадров/с.
    const chunk = view.speed >= 4 ? 1024 : view.speed >= 2 ? 512 : ROW_CHUNK;
    const end = Math.min(FH, row + chunk);
    kernel.sweep(grid, row, end);
    if (middle && pairStep) kernel.sweep(pairGrid, row, end);
    row = end;
    if (row < FH) { schedule(0); return; }
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
