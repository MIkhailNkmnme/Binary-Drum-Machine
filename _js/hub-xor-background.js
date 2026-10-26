/* v1. Главная: глобальный XOR всего поля, как xorSimGrid в Маятнике.
   Один массив поля и один кадр, без кэша прошедших кадров и загрузки Маятника. */
(() => {
  'use strict';
  const canvas = document.getElementById('hubXor');
  if (!canvas) return;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return;
  const H = 1024, W = 2 * H - 1, CENTER = W >> 1;
  const FIRST_FRAME = 8, INTERVAL = 120, ROW_CHUNK = 64;
  canvas.width = W; canvas.height = H;
  const grid = new Int8Array(W * H).fill(-1);
  const image = ctx.createImageData(W, H), pixels = image.data;
  grid[CENTER] = 1;
  let frame = 0, row = 1, timer = 0, nextFrame = false, started = performance.now();

  // Пустота не участвует в XOR; три пустых входа оставляют клетку пустой.
  function xor3(a, b, c) {
    let v = a;
    if (b >= 0) v = v < 0 ? b : v ^ b;
    if (c >= 0) v = v < 0 ? c : v ^ c;
    return v;
  }
  function paint(i, value) {
    const p = i * 4, on = value === 1;
    // Точная палитра прежнего _img/hub-xor-1024.png: #337a34 / чёрный.
    pixels[p] = on ? 51 : 0;
    pixels[p + 1] = on ? 122 : 0;
    pixels[p + 2] = on ? 52 : 0;
    pixels[p + 3] = 255;
  }
  function schedule(delay) {
    if (!document.hidden) timer = setTimeout(tick, delay);
  }
  function tick() {
    timer = 0;
    if (document.hidden) return;
    if (nextFrame) {
      nextFrame = false; frame++; row = 1; started = performance.now();
      const d = Math.ceil(frame / 2);
      const pos = ((CENTER + (frame % 2 ? -d : d)) % W + W) % W;
      grid[pos] = 1;
    }
    const visible = frame >= FIRST_FRAME;
    if (visible && row === 1) for (let c = 0; c < W; c++) paint(c, grid[c]);
    const end = Math.min(H, row + ROW_CHUNK);
    for (; row < end; row++) {
      const base = row * W, up = base - W;
      for (let c = 0; c < W; c++) {
        const i = base + c;
        // In-place, сверху вниз: родители уже пересчитаны в этом же кадре.
        grid[i] = xor3(grid[i], c > 0 ? grid[up + c - 1] : -1,
          c + 1 < W ? grid[up + c + 1] : -1);
        if (visible) paint(i, grid[i]);
      }
    }
    if (row < H) { schedule(0); return; }
    if (visible) {
      ctx.putImageData(image, 0, 0);
      canvas.dataset.frame = String(frame);
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
