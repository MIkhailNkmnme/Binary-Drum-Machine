/* Матрёшки v0.003. Полностью свёрнутые строки хранят предыдущий уровень внутри. */
(function (root, factory) {
  const api = factory(typeof module === 'object' ? require('./matryoshki-core.js') : root.Matryoshki);
  if (typeof module === 'object') module.exports = api; else root.MatryoshkiPacking = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (M) {
  'use strict';
  function pack(layer) {
    let prefix = 1;
    while (prefix < layer.rows && layer.left[prefix] === prefix && layer.right[prefix] === prefix) prefix++;
    let child = null;
    if (prefix > 1) {
      let cap = 0;
      for (let d = 1; d < Math.min(prefix - 1, layer.limit); d *= 2) cap = d;
      const source = { rows: prefix, width: layer.width, center: layer.center, frame: layer.frame, data: layer.data.subarray(0, prefix * layer.width) };
      child = pack(M.project(source, cap));
    }
    // Если всё ушло внутрь, раскрываем содержимое вместо пустой оболочки с одним битом.
    if (prefix === layer.rows && child) return child;
    const rows = [0];
    for (let r = prefix; r < layer.rows; r++) rows.push(r);
    const left = rows.map(r => -r + layer.left[r]), right = rows.map(r => r - layer.right[r]);
    const node = { layer, rows, left, right, height: rows.length, child, placement: null };
    if (child) node.placement = fit(node, child);
    return node;
  }
  function fit(parent, child) {
    // Вложение вписано в оболочку. Координаты источника остаются в node.rows и layer.
    function candidate(scale, top) {
      let minX = -Infinity, maxX = Infinity;
      for (let y = 0; y < child.height; y++) {
        const first = Math.floor(top + y * scale), last = Math.ceil(top + (y + 1) * scale - 1e-9) - 1;
        for (let py = first; py <= last; py++) {
          if (py < 1 || py >= parent.height) return null;
          minX = Math.max(minX, parent.left[py] - .5 + .12 - (child.left[y] - .5) * scale);
          maxX = Math.min(maxX, parent.right[py] + .5 - .12 - (child.right[y] + .5) * scale);
        }
      }
      return minX <= maxX ? { x: (minX + maxX) / 2, y: top, scale } : null;
    }
    const maxScale = Math.min(.78, (parent.height - 1.25) / child.height);
    for (let scale = maxScale; scale > .001; scale *= .85) {
      const bottom = parent.height - child.height * scale - .12;
      for (let k = 0; k <= 8; k++) {
        const top = 1 + (bottom - 1) * k / 8;
        if (top >= 1) { const found = candidate(scale, top); if (found) return found; }
      }
    }
    throw Error('Не удалось разместить внутренний уровень.');
  }
  function origin(node, y, c) {
    if (!Number.isInteger(y) || y < 0 || y >= node.height) return null;
    return M.origin(node.layer, node.rows[y], c);
  }
  return { pack, origin };
});
