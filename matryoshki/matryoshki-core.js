/* Матрёшки v0.002. Исходное поле не сдвигается; слои — обратимые проекции его адресов. */
(function (root, factory) {
  const api = factory(typeof module === 'object' ? require('../mayatnik/mayatnik-core.js') : (typeof MAYATNIK !== 'undefined' ? MAYATNIK : root.MAYATNIK));
  if (typeof module === 'object') module.exports = api; else root.Matryoshki = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (M) {
  'use strict';
  const MEMORY_LIMIT = 64 * 1024 * 1024;
  function dimensions(rows) {
    if (!Number.isSafeInteger(rows) || rows < 2) throw Error('Нужно не менее двух строк.');
    const width = 6 * rows - 2;
    if (width * rows > MEMORY_LIMIT) throw Error('Для следующего участка нужно больше памяти. Выберите меньшую глубину просмотра; текущий кадр сохранён.');
    return { width, anchor: 3 * rows - 1 };
  }
  class Engine {
    constructor(rows) {
      const { width, anchor } = dimensions(rows);
      this.rows = rows; this.anchor = anchor; this.field = M.field(width, rows, 'empty'); this.frame = 0;
    }
    advance(target, budget = Infinity) {
      if (!Number.isSafeInteger(target) || target < this.frame) throw Error('Для обратного хода нужно восстановить исходное поле.');
      const stop = Math.min(target, 4 * this.rows), start = this.frame;
      while (this.frame < stop && this.frame - start < budget) {
        M.cone(this.field, this.anchor + M.offset('pend', this.frame), this.rows); this.frame++;
      }
      if (this.frame >= stop) this.frame = target;
      return this.frame === target;
    }
    snapshot() {
      const rows = this.rows, width = 2 * rows - 1, center = rows - 1, data = new Int8Array(width * rows).fill(-1);
      for (let r = 0; r < rows; r++) for (let c = -r; c <= r; c++) data[r * width + center + c] = this.field.val[r * this.field.W + this.anchor + c];
      return { rows, width, center, frame: this.frame, data };
    }
  }
  // Кадры — число вершин 0,-1,+1,... . После этих кадров клетка недостижима для будущих конусов.
  function deadline(r, c) { return c < 0 ? 2 * (r - c) : 2 * (r + c) + 1; }
  function shifts(r, frame, limit = Infinity) {
    return { left: Math.max(0, Math.min(r, limit, Math.floor(frame / 2) - r)), right: Math.max(0, Math.min(r, limit, Math.floor((frame - 1) / 2) - r)) };
  }
  function project(source, limit) {
    const { rows, width, center, frame, data } = source, bits = new Int8Array(data.length).fill(-1), frozen = new Uint8Array(data.length), left = new Uint32Array(rows), right = new Uint32Array(rows);
    for (let r = 0; r < rows; r++) {
      const s = shifts(r, frame, limit); left[r] = s.left; right[r] = s.right;
      let value = 0, count = 0, ready = true;
      for (let c = -s.left; c <= s.right; c++) {
        const v = data[r * width + center + c]; if (v < 0) continue;
        value ^= v; count++; ready = ready && frame >= deadline(r, c);
      }
      const axis = r * width + center; bits[axis] = count ? value : -1; frozen[axis] = count && ready ? 1 : 0;
      for (let c = -r; c <= r; c++) {
        if (c === 0) continue;
        const original = c < 0 ? c - s.left : c + s.right;
        if (Math.abs(original) > r) continue;
        const i = r * width + center + c; bits[i] = data[r * width + center + original]; frozen[i] = bits[i] >= 0 && frame >= deadline(r, original) ? 1 : 0;
      }
    }
    return { ...source, limit, bits, frozen, left, right };
  }
  function origin(layer, r, c) {
    if (r < 0 || r >= layer.rows || Math.abs(c) > r) return null;
    if (layer.bits[r * layer.width + layer.center + c] < 0) return null;
    if (c === 0) return { row: r, from: -layer.left[r], to: layer.right[r], folded: true };
    const original = c < 0 ? c - layer.left[r] : c + layer.right[r];
    return { row: r, from: original, to: original, folded: false };
  }
  return { Engine, dimensions, deadline, shifts, project, origin };
});
