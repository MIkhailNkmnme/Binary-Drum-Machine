/* Раскраска Ромбового Маятника v0.005 */
(() => {
  "use strict";

  // Search a narrow band around the original center column, checking neighbours in the
  // full field. A shape crossing the band boundary cannot be matched in part.
  const reach = 12;
  const stride = 2 * reach + 1;

  function create(W, H) {
    const marks = new Uint8Array(Math.ceil(W * H / 8));
    const center = Math.floor(W / 2);
    const origin = center - reach;
    const labels = new Uint32Array(H * stride);
    const queue = new Int32Array(labels.length);

    function mark(index) {
      marks[index >> 3] |= 1 << (index & 7);
    }

    function contains(x, y, label) {
      const local = x - origin;
      return local >= 0 && local < stride && labels[y * stride + local] === label;
    }

    function hasReflection(count, label, left, top, right, bottom) {
      let vertical = true, horizontal = true;
      let diagonal = right - left === bottom - top, antidiagonal = diagonal;
      for (let i = 0; i < count && (vertical || horizontal || diagonal || antidiagonal); i++) {
        const index = queue[i];
        const y = Math.floor(index / stride);
        const x = origin + index % stride;
        vertical = vertical && contains(left + right - x, y, label);
        horizontal = horizontal && contains(x, top + bottom - y, label);
        diagonal = diagonal && contains(left + y - top, top + x - left, label);
        antidiagonal = antidiagonal && contains(right - y + top, bottom - x + left, label);
      }
      return vertical || horizontal || diagonal || antidiagonal;
    }

    function update(values) {
      marks.fill(0);
      labels.fill(0);
      let label = 0;
      for (let row = 0; row < H; row++) {
        const index = row * W + center;
        const bit = values[index];
        if (bit < 0) continue;
        mark(index);

        const seed = row * stride + reach;
        if (labels[seed]) continue;
        let count = 1;
        let left = center, right = center, top = row, bottom = row;
        let complete = true;
        labels[seed] = ++label;
        queue[0] = seed;

        for (let head = 0; head < count; head++) {
          const point = queue[head];
          const y = Math.floor(point / stride);
          const x = origin + point % stride;
          left = Math.min(left, x);
          right = Math.max(right, x);
          top = Math.min(top, y);
          bottom = Math.max(bottom, y);

          for (let ny = Math.max(0, y - 1); ny <= Math.min(H - 1, y + 1); ny++) {
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
          mark(y * W + origin + point % stride);
        }
      }
      return marks;
    }

    return {update};
  }

  window.MayatnikRhombPatternColors = {create};
})();
