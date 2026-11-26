(() => {
  "use strict";

  // Search a narrow band along each guide while checking neighbours in the
  // full field. A shape crossing the band boundary cannot be matched in part.
  const reach = 12;
  const stride = 2 * reach + 1;

  function create(W, H) {
    const marks = new Uint8Array(Math.ceil(W * H / 8));
    const origins = new Int32Array(H);
    const labels = new Uint32Array(H * stride);
    const queue = new Int32Array(labels.length);

    function mark(index) {
      marks[index >> 3] |= 1 << (index & 7);
    }

    function contains(x, y, label) {
      const local = x - origins[y];
      return local >= 0 && local < stride && labels[y * stride + local] === label;
    }

    function hasReflection(count, label, left, top, right, bottom) {
      let vertical = true, horizontal = true;
      let diagonal = right - left === bottom - top, antidiagonal = diagonal;
      for (let i = 0; i < count && (vertical || horizontal || diagonal || antidiagonal); i++) {
        const index = queue[i];
        const y = Math.floor(index / stride);
        const x = origins[y] + index % stride;
        vertical = vertical && contains(left + right - x, y, label);
        horizontal = horizontal && contains(x, top + bottom - y, label);
        diagonal = diagonal && contains(left + y - top, top + x - left, label);
        antidiagonal = antidiagonal && contains(right - y + top, bottom - x + left, label);
      }
      return vertical || horizontal || diagonal || antidiagonal;
    }

    function scanGuide(values, center, side, start, end) {
      labels.fill(0);
      let label = 0;
      for (let y = 0; y < H; y++) {
        const radius = Math.min(y, H - 1 - y);
        origins[y] = center + side * radius - reach;
      }

      for (let row = start; row < end; row++) {
        const column = origins[row] + reach;
        if (column < 0 || column >= W) continue;
        const index = row * W + column;
        const bit = values[index];
        if (bit < 0) continue;
        mark(index);

        const seed = row * stride + reach;
        if (labels[seed]) continue;
        let count = 1;
        let left = column, right = column, top = row, bottom = row;
        let complete = true;
        labels[seed] = ++label;
        queue[0] = seed;

        for (let head = 0; head < count; head++) {
          const point = queue[head];
          const y = Math.floor(point / stride);
          const x = origins[y] + point % stride;
          left = Math.min(left, x);
          right = Math.max(right, x);
          top = Math.min(top, y);
          bottom = Math.max(bottom, y);

          for (let ny = Math.max(0, y - 1); ny <= Math.min(H - 1, y + 1); ny++) {
            const origin = origins[ny];
            for (let nx = Math.max(0, x - 1); nx <= Math.min(W - 1, x + 1); nx++) {
              const local = nx - origin;
              const next = ny * stride + local;
              const inBand = local >= 0 && local < stride;
              if (inBand && labels[next]) continue;
              if (values[ny * W + nx] !== bit) continue;
              if (!inBand) complete = false;
              else {
                labels[next] = label;
                queue[count++] = next;
              }
            }
          }
        }

        if (!complete || count < 4 || !hasReflection(count, label, left, top, right, bottom)) continue;
        for (let i = 0; i < count; i++) {
          const point = queue[i];
          const y = Math.floor(point / stride);
          mark(y * W + origins[y] + point % stride);
        }
      }
    }

    function scanRhomb(values, center, start, end) {
      for (const side of [0, -1, 1]) scanGuide(values, center, side, start, end);
    }

    function update(values, centers, counterStep) {
      marks.fill(0);
      if (counterStep && centers[0] !== centers[1]) {
        scanRhomb(values, centers[1], 0, H / 2);
        scanRhomb(values, centers[0], H / 2, H);
      } else {
        for (const center of new Set(centers)) scanRhomb(values, center, 0, H);
      }
      return marks;
    }

    return {update};
  }

  window.MayatnikRhombPatternColors = {create};
})();
