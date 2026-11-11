/* Spreadsheet cone, diamond and 180° collision rules on a finite bit field. */
(function (root, factory) {
  const inNode = typeof module === 'object' && module.exports;
  const api = factory(inNode ? require('./mayatnik-core.js') : MAYATNIK);
  if (inNode) module.exports = api;
  else root.MayatnikAnimatrixExcelShapes = api;
})(globalThis, function (pendulum) {
  'use strict';

  const BLACK = 0x000000, BLUE = 0x0000ff, RED = 0xff0000;

  function coneOrigin(seed, { algorithm, excelAnchor }) {
    const { width, height, areas, selection } = seed;
    const first = areas?.[0];
    if (first && (first.width < width || first.height < height)) {
      return { x: first.x, y: first.y };
    }
    if (!areas && selection?.includes(0)) {
      const selected = selection.indexOf(1);
      if (selected >= 0) return { x: selected % width, y: Math.floor(selected / width) };
    }
    return {
      x: Number.isInteger(excelAnchor) ? Math.max(0, Math.min(width - 1, excelAnchor)) : Math.floor((width - 1) / 2),
      y: algorithm === 'excelTriangleDown' ? 0 : algorithm === 'excelTriangleUp' ? height - 1 : Math.floor((height - 1) / 2)
    };
  }

  function cycleFrames(seed, options) {
    if (options.algorithm !== 'excelTriangleBoth' && options.algorithm !== 'excelTrianglePend') return 1;
    const { x } = coneOrigin(seed, options);
    const roomRight = seed.width - 1 - x;
    if (options.algorithm === 'excelTriangleBoth') return roomRight + 1;
    // The alternating walk restarts after its first out-of-field position.
    return Math.min(2 * x + 1, 2 * roomRight + 2);
  }

  function parentBit(s, x, row, apex) {
    if (x < 0 || x >= s.width) return 0;
    const i = row + x;
    return i === apex ? 1 : s.bits[i];
  }

  function buildCone(s, x, y, direction, depth, painter) {
    const { width, height, bits, present, colours, automatic, filled, fills } = s;
    const apex = y * width + x;
    const available = direction > 0 ? height - y : y + 1;
    for (let level = 1; level < Math.min(depth, available); level++) {
      const row = (y + level * direction) * width;
      const previous = row - direction * width;
      const start = x - level, end = Math.min(width - 1, x + level);
      let col = Math.max(0, start);
      col += (col - start) & 1;
      for (; col <= end; col += 2) {
        const i = row + col;
        if (painter) {
          filled[i] = 1;
          fills[i] = fills[apex];
          continue;
        }
        const result = bits[i] ^ parentBit(s, col - 1, previous, apex) ^ parentBit(s, col + 1, previous, apex);
        if (s.excelColourChangesOnly && present[i] && bits[i] === result) continue;
        const overlap = present[i] && colours[i] !== RED && colours[i] !== BLUE;
        bits[i] = result;
        present[i] = 1;
        colours[i] = overlap ? (result ? BLUE : RED) : BLACK;
        automatic[i] = 0;
      }
    }
  }

  function collide(s) {
    const { x, y, width, height } = s._seed.areas?.[0] || { x: 0, y: 0, width: s.width, height: s.height };
    const size = width * height;
    for (let q = 0; q < Math.ceil(size / 2); q++) {
      const row = Math.floor(q / width), col = q % width;
      const a = (y + row) * s.width + x + col;
      const b = (y + height - 1 - row) * s.width + x + width - 1 - col;
      // Both cells receive the same XOR of the two original values.
      s.bits[a] = s.bits[b] = s.bits[a] ^ s.bits[b];
      s.present[a] = s.present[b] = 1;
    }
    s.cursorRow = y;
  }

  function step(s) {
    if (s.algorithm === 'excelCollision') {
      collide(s);
      return true;
    }
    const { x: anchor, y } = coneOrigin(s._seed, s);
    let x = anchor;
    if (s.algorithm === 'excelTriangleBoth') x += s.excelPhase;
    else if (s.algorithm === 'excelTrianglePend') x += pendulum.offset('pend', s.excelPhase);

    const apex = y * s.width + x;
    const painter = !s.present[apex] && !!s.filled[apex];
    if (!painter && !s.present[apex]) {
      s.present[apex] = s.bits[apex] = 1;
      s.colours[apex] = BLACK;
      s.automatic[apex] = 0;
    }
    const depth = Number.isInteger(s.excelDepth) && s.excelDepth > 0 ? s.excelDepth : 128;
    if (s.algorithm !== 'excelTriangleUp') buildCone(s, x, y, 1, depth, painter);
    if (s.algorithm !== 'excelTriangleDown') buildCone(s, x, y, -1, depth, painter);
    s.cursorRow = y;
    return true;
  }

  return { coneOrigin, cycleFrames, step };
});
