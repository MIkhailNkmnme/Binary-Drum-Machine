/* Раскраска Ромбового Маятника v0.007 */
(() => {
  "use strict";

  // Check neighbours in the full joined field so a shape crossing a search band's
  // boundary cannot be matched in part.
  const reach = 12;
  const maxStride = 2 * reach + 2;

  function create(sourceWidth, H, start = 0, end = sourceWidth) {
    const W = end - start;
    const marks = new Uint8Array(Math.ceil(W * H / 8));
    const axisColumns = [[Math.floor(sourceWidth / 2) - start]];
    // A join lies between the last column of one segment and the first of the next.
    if (start < 0) axisColumns.push([-1 - start, -start]);
    if (end > sourceWidth) axisColumns.push([sourceWidth - 1 - start, sourceWidth - start]);
    const seedColumns = axisColumns.flat();
    const columns = Int32Array.from({length: W}, (_, x) => (x + start + sourceWidth) % sourceWidth);
    const labels = new Uint32Array(H * maxStride);
    const queue = new Int32Array(labels.length);
    const valueAt = (values, x, y) => values[y * sourceWidth + columns[x]];

    function mark(index) {
      marks[index >> 3] |= 1 << (index & 7);
    }

    function hasReflection(count, label, origin, stride, left, top, right, bottom) {
      const contains = (x, y) => {
        const local = x - origin;
        return local >= 0 && local < stride && labels[y * stride + local] === label;
      };
      let vertical = true, horizontal = true;
      let diagonal = right - left === bottom - top, antidiagonal = diagonal;
      for (let i = 0; i < count && (vertical || horizontal || diagonal || antidiagonal); i++) {
        const index = queue[i];
        const y = Math.floor(index / stride);
        const x = origin + index % stride;
        vertical = vertical && contains(left + right - x, y);
        horizontal = horizontal && contains(x, top + bottom - y);
        diagonal = diagonal && contains(left + y - top, top + x - left);
        antidiagonal = antidiagonal && contains(right - y + top, bottom - x + left);
      }
      return vertical || horizontal || diagonal || antidiagonal;
    }

    function markSymmetricPatterns(values, seeds) {
      const origin = seeds[0] - reach;
      const stride = 2 * reach + seeds.length;
      labels.fill(0);
      let label = 0;
      for (let row = 0; row < H; row++) {
        for (const column of seeds) {
          const bit = valueAt(values, column, row);
          if (bit < 0) continue;
          mark(row * W + column);

          const seed = row * stride + column - origin;
          if (labels[seed]) continue;
          let count = 1;
          let left = column, right = column, top = row, bottom = row;
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
                if (valueAt(values, nx, ny) !== bit) continue;
                if (!inBand) complete = false;
                else {
                  labels[next] = label;
                  queue[count++] = next;
                }
              }
            }
          }

          if (!complete || count < 4 || !hasReflection(count, label, origin, stride, left, top, right, bottom)) continue;
          for (let i = 0; i < count; i++) {
            const point = queue[i];
            const y = Math.floor(point / stride);
            mark(y * W + origin + point % stride);
          }
        }
      }
    }

    function update(values, mode = "patterns") {
      marks.fill(0);
      if (mode === "patterns") {
        for (const seeds of axisColumns) markSymmetricPatterns(values, seeds);
        return marks;
      }
      const pending = [];
      const move = (cell, dx, dy) => {
        const c = cell.c + dx, r = cell.r + dy;
        return c >= 0 && c < W && r >= 0 && r < H ? {c, r} : null;
      };
      // Reuse the same visited mask for every seed across the joined field.
      function flood({seed, match, neighbours}) {
        const enqueue = cell => {
          const index = cell.r * W + cell.c;
          if ((marks[index >> 3] & (1 << (index & 7))) || !match(cell)) return;
          mark(index);
          pending.push(index);
        };
        enqueue(seed);
        while (pending.length) {
          const index = pending.pop();
          neighbours({c: index % W, r: Math.floor(index / W)}, enqueue);
        }
      }
      for (const column of seedColumns) {
        for (let r = 0; r < H; r++) {
          const index = r * W + column;
          const bit = valueAt(values, column, r);
          if (bit < 0 || (marks[index >> 3] & (1 << (index & 7)))) continue;
          if (mode === "bit") mark(index);
          else window.MayatnikCellArea.select({
            seed: {c: column, r}, bit, mode, topology: "square", move, flood,
            match: cell => valueAt(values, cell.c, cell.r) === bit
          });
        }
      }
      return marks;
    }

    return {update};
  }

  window.MayatnikRhombPatternColors = {create};
})();
