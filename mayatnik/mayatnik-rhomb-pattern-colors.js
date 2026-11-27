/* Раскраска Ромбового Маятника v0.008 */
(() => {
  "use strict";

  // Check neighbours in the full joined field so a shape crossing a search band's
  // boundary cannot be matched in part.
  const reach = 12;
  const maxStride = 2 * reach + 2;

  function create(sourceWidth, H, start = 0, end = sourceWidth) {
    const W = end - start;
    const marks = new Uint8Array(Math.ceil(W * H / 8));
    // Boundaries use field coordinates; each axis seeds its two adjacent cells.
    const centralAxis = Math.floor(sourceWidth / 2);
    const boundaries = [centralAxis];
    if (start < 0) boundaries.push(0);
    if (end > sourceWidth) boundaries.push(sourceWidth);
    const axes = boundaries.filter(boundary => boundary > start && boundary < end)
      .map(boundary => ({boundary: boundary - start, seeds: [boundary - 1 - start, boundary - start]}));
    const seedColumns = axes.flatMap(axis => axis.seeds);
    const columns = Int32Array.from({length: W}, (_, x) => (x + start + sourceWidth) % sourceWidth);
    const labels = new Uint32Array(H * maxStride);
    const queue = new Int32Array(labels.length);
    const valueAt = (values, x, y) => values[y * sourceWidth + columns[x]];

    function mark(index) {
      marks[index >> 3] |= 1 << (index & 7);
    }

    function hasReflection(count, label, origin, stride, boundary) {
      for (let i = 0; i < count; i++) {
        const index = queue[i];
        const y = Math.floor(index / stride);
        const x = origin + index % stride;
        const reflected = 2 * boundary - 1 - x;
        const local = reflected - origin;
        if (reflected < 0 || reflected >= W || local < 0 || local >= stride ||
            labels[y * stride + local] !== label) return false;
      }
      return true;
    }

    function markSymmetricPatterns(values, {boundary, seeds}) {
      const origin = seeds[0] - reach;
      const stride = 2 * reach + seeds.length;
      labels.fill(0);
      let label = 0;
      for (let row = 0; row < H; row++) {
        for (const column of seeds) {
          const bit = valueAt(values, column, row);
          if (bit < 0) continue;
          const seed = row * stride + column - origin;
          if (labels[seed]) continue;
          let count = 1;
          let complete = true;
          labels[seed] = ++label;
          queue[0] = seed;

          for (let head = 0; head < count; head++) {
            const point = queue[head];
            const y = Math.floor(point / stride);
            const x = origin + point % stride;

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

          if (!complete || count < 4 || !hasReflection(count, label, origin, stride, boundary)) continue;
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
        for (const axis of axes) markSymmetricPatterns(values, axis);
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

    return {update, centralAxis};
  }

  window.MayatnikRhombPatternColors = {create};
})();
