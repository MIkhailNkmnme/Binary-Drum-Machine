/* Плоское зеркало хаба: отражение относительно линии через (x,y) с углом angle. */
(() => {
  'use strict';
  const matrix = (x, y, angle) => {
    const a = Math.cos(2 * angle), b = Math.sin(2 * angle);
    return [a, b, b, -a, x - a * x - b * y, y - b * x + a * y];
  };
  const point = (px, py, x, y, angle) => {
    const m = matrix(x, y, angle);
    return [m[0] * px + m[2] * py + m[4], m[1] * px + m[3] * py + m[5]];
  };
  const geometry = { matrix, point };
  if (typeof module !== 'undefined' && module.exports) module.exports = geometry;
  else window.ZZMirrorGeometry = geometry;
})();
