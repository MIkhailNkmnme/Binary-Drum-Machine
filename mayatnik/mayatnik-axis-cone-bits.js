(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MayatnikAxisConeBits = api;
})(globalThis, function () {
  'use strict';

  // In an ordinary left/right pendulum each apex is visited once. In a row,
  // the cone writes only its parity. Pack the even and odd columns separately.
  function create(width, height) {
    const stride = Math.ceil(Math.ceil(width / 2) / 32) + 2;
    const planes = [new Uint32Array(height * stride), new Uint32Array(height * stride)];
    const firstApex = [Infinity, Infinity];
    const lastApex = [-Infinity, -Infinity];

    function step(apex) {
      const originParity = apex & 1;
      const pair = apex >> 1;
      planes[originParity][1 + (pair >> 5)] |= 1 << (pair & 31);
      firstApex[originParity] = Math.min(firstApex[originParity], apex);
      lastApex[originParity] = Math.max(lastApex[originParity], apex);

      for (let row = 1, start = stride + 1; row < height; row++, start += stride) {
        const parity = (apex + row) & 1;
        const left = (apex - row) >> 1;
        const right = (apex + row) >> 1;
        const first = left >> 5;
        const last = right >> 5;
        const lo = -1 << (left & 31);
        const hi = -1 >>> (31 - (right & 31));
        const plane = planes[parity];
        const parent = planes[parity ^ 1];
        const from = start + first;
        const to = start + last;
        const up = from - stride;
        // For an even output x, its left parent is the preceding packed odd
        // column. For an odd output x, its right parent is the next even one.
        if (parity === 0) {
          const boundary = parent[up] ^ (parent[up] << 1) ^ (parent[up - 1] >>> 31);
          plane[from] ^= boundary & lo & (from === to ? hi : -1);
          for (let dst = from + 1, src = up + 1; dst < to; dst++, src++) {
            plane[dst] ^= parent[src] ^ (parent[src] << 1) ^ (parent[src - 1] >>> 31);
          }
          if (to > from) {
            const src = to - stride;
            plane[to] ^= (parent[src] ^ (parent[src] << 1) ^ (parent[src - 1] >>> 31)) & hi;
          }
        } else {
          const boundary = parent[up] ^ (parent[up] >>> 1) ^ (parent[up + 1] << 31);
          plane[from] ^= boundary & lo & (from === to ? hi : -1);
          for (let dst = from + 1, src = up + 1; dst < to; dst++, src++) {
            plane[dst] ^= parent[src] ^ (parent[src] >>> 1) ^ (parent[src + 1] << 31);
          }
          if (to > from) {
            const src = to - stride;
            plane[to] ^= (parent[src] ^ (parent[src] >>> 1) ^ (parent[src + 1] << 31)) & hi;
          }
        }
      }
    }

    function read(target) {
      // At each parity the visited apices are contiguous. Their cones cover
      // exactly the interval between the outer apices projected onto this row.
      for (let parity = 0; parity < 2; parity++) {
        const plane = planes[parity];
        for (let row = 0, base = 1, offset = parity; row < height; row++, base += stride, offset += width) {
          const origin = parity ^ (row & 1);
          if (firstApex[origin] === Infinity) continue;
          const lo = (firstApex[origin] - row) >> 1;
          const hi = (lastApex[origin] + row) >> 1;
          for (let col = lo; col <= hi; col++) {
            target[offset + 2 * col] = (plane[base + (col >> 5)] >>> (col & 31)) & 1;
          }
        }
      }
      return target;
    }

    return {step, read};
  }

  return {create};
});
