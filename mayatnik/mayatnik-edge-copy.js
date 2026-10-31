/* Копии двух крайних частей поля для вида «Ромбъ»: без масштабирования, бит в бит.
   Левый край — Lw столбцов от 0, правый — Rw столбцов от Rs. Обе копии повёрнуты на 180°. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MayatnikEdgeCopy = api;
})(globalThis, function () {
  'use strict';
  function panels(W, H, edgeClose) {
    W = W | 0; H = H | 0;
    const A = Math.floor((W - 1) / 2);
    const Lw = Math.max(1, A - (H - 1));
    const Rs = Math.min(W - 1, A + H);
    const Rw = Math.max(1, W - Rs);
    return { W, H, A, Lw, Rs, Rw, C: Lw + Rw, edgeClose: !!edgeClose };
  }
  function srcColumn(p, x) {
    if (x < p.Lw) return p.edgeClose ? p.Lw - 1 - x : x;
    const dx = x - p.Lw;
    return p.Rs + (p.edgeClose ? p.Rw - 1 - dx : dx);
  }
  function copy(val, W, H, edgeClose) {
    const p = panels(W, H, edgeClose), data = new Int8Array(p.C * p.H);
    for (let y = 0; y < p.H; y++) {
      for (let x = 0; x < p.C; x++) data[y * p.C + x] = val[y * p.W + srcColumn(p, x)];
    }
    return { width: p.C, height: p.H, data, panels: p };
  }
  return { panels, srcColumn, copy };
});
