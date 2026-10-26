/* v2. Главная: синхронное сравнение конусов 5.7 и глобального XOR 5.8.
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
  let frame = -1, row = 1, timer = 0, nextFrame = true, started = performance.now();

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
