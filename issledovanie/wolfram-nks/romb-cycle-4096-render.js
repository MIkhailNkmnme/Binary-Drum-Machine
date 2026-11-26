'use strict';

function createRhombCycleRenderer() {
  const rows = 4096;
  const columns = 8191;
  const block = 8;
  const height = rows / block;
  const width = Math.ceil(columns / block);
  const words = Math.ceil((columns + 1) / 64);
  const stride = 2 * words;
  const bits = new Uint32Array(rows * stride);
  const occupied = new Uint8Array(width);
  const ones = new Uint8Array(width);
  const marks = new Uint8Array(width * height);
  const rowLeft = new Uint16Array(rows);
  const rowRight = new Uint16Array(rows);
  let previousLeft = -1;
  let previousRight = -1;
  const stripWidth = 17;
  const stripRadius = (stripWidth - 1) / 2;
  const strip = new Int8Array(stripWidth * rows);
  const labels = new Uint32Array(strip.length);
  const queue = new Uint32Array(strip.length);
  const popcount = Uint8Array.from({length: 256}, (_, byte) => {
    let count = 0;
    for (; byte; byte &= byte - 1) count++;
    return count;
  });

  const colour = (r, g, b) => (0xff000000 | (b << 16) | (g << 8) | r) >>> 0;
  const background = colour(11, 22, 32);
  const density = Uint32Array.from({length: 17}, (_, level) => {
    const t = level / 16;
    return colour(Math.round(120 + 135 * t), Math.round(64 + 146 * t), Math.round(24 + 143 * t));
  });
  const axisColours = [
    null,
    [colour(129, 80, 172), colour(234, 191, 255)],
    [colour(49, 119, 93), colour(167, 245, 206)],
    [colour(155, 96, 30), colour(255, 218, 138)]
  ];

  function updateRowBounds(leftmost, rightmost) {
    if (leftmost === previousLeft && rightmost === previousRight) return;
    for (let y = 0; y < rows; y++) {
      const radius = Math.min(y, rows - 1 - y);
      rowLeft[y] = Math.max(0, leftmost - radius);
      rowRight[y] = Math.min(columns - 1, rightmost + radius);
    }
    previousLeft = leftmost;
    previousRight = rightmost;
  }

  function readStrip(center) {
    const origin = center - stripRadius;
    for (let y = 0; y < rows; y++) {
      const left = rowLeft[y], right = rowRight[y];
      const src = y * stride;
      const dst = y * stripWidth;
      for (let x = 0; x < stripWidth; x++) {
        const col = origin + x;
        strip[dst + x] = col < left || col > right ? -1 :
          (bits[src + (col & 1) * words + (col >> 6)] >>> ((col >> 1) & 31)) & 1;
      }
    }
    return origin;
  }

  function hasReflection(size, label, left, right, top, bottom) {
    let vertical = true;
    let horizontal = true;
    let diagonal = right - left === bottom - top;
    let antidiagonal = diagonal;
    for (let i = 0; i < size && (vertical || horizontal || diagonal || antidiagonal); i++) {
      const index = queue[i];
      const x = index % stripWidth;
      const y = Math.floor(index / stripWidth);
      const mx = left + right - x;
      const my = top + bottom - y;
      vertical = vertical && labels[y * stripWidth + mx] === label;
      horizontal = horizontal && labels[my * stripWidth + x] === label;
      diagonal = diagonal && labels[(top + x - left) * stripWidth + left + y - top] === label;
      antidiagonal = antidiagonal && labels[(top + right - x) * stripWidth + left + bottom - y] === label;
    }
    return vertical || horizontal || diagonal || antidiagonal;
  }

  function markShapes(center, flag) {
    const origin = readStrip(center);
    labels.fill(0);
    let label = 0;
    for (let y = 0; y < rows; y++) {
      const seed = y * stripWidth + stripRadius;
      const value = strip[seed];
      if (value < 0 || labels[seed]) continue;

      let size = 1;
      let left = stripRadius, right = stripRadius, top = y, bottom = y;
      labels[seed] = ++label;
      queue[0] = seed;
      for (let head = 0; head < size; head++) {
        const index = queue[head];
        const x = index % stripWidth;
        const yy = Math.floor(index / stripWidth);
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, yy);
        bottom = Math.max(bottom, yy);
        const fromX = Math.max(0, x - 1);
        const toX = Math.min(stripWidth - 1, x + 1);
        for (let ny = Math.max(0, yy - 1); ny <= Math.min(rows - 1, yy + 1); ny++) {
          for (let nx = fromX; nx <= toX; nx++) {
            const next = ny * stripWidth + nx;
            if (labels[next] || strip[next] !== value) continue;
            labels[next] = label;
            queue[size++] = next;
          }
        }
      }

      // A component reaching the crop can continue outside it. Only paint whole shapes.
      if (size < 4 || left === 0 || right === stripWidth - 1 ||
          !hasReflection(size, label, left, right, top, bottom)) continue;
      for (let i = 0; i < size; i++) {
        const index = queue[i];
        const x = origin + index % stripWidth;
        const row = Math.floor(index / (stripWidth * block));
        marks[row * width + (x >> 3)] |= flag;
      }
    }
  }

  function render(model, pixels) {
    const {centers, leftmost, rightmost} = model.snapshot(bits);
    const output = new Uint32Array(pixels.buffer, pixels.byteOffset, width * height);
    updateRowBounds(leftmost, rightmost);
    marks.fill(0);
    markShapes(centers[1], 1);
    markShapes(centers[0], 2);

    for (let row = 0; row < height; row++) {
      occupied.fill(0);
      ones.fill(0);
      for (let y = row * block; y < (row + 1) * block; y++) {
        const left = rowLeft[y], right = rowRight[y];
        const source = y * stride;
        for (let x = left >> 3; x <= right >> 3; x++) {
          const col = x * block;
          const index = source + (x >> 3);
          const shift = (x & 7) * 4;
          const even = (bits[index] >>> shift) & 15;
          const odd = (bits[index + words] >>> shift) & 15;
          ones[x] += popcount[(odd << 4) | even];
          occupied[x] += Math.min(right + 1, col + block) - Math.max(left, col);
        }
      }
      const band = row * width;
      for (let x = 0; x < width; x++) {
        const axis = marks[band + x] | Number(x === (centers[1] >> 3)) |
          (Number(x === (centers[0] >> 3)) << 1);
        output[band + x] = axis ? axisColours[axis][Number(ones[x] * 2 >= occupied[x])] :
          occupied[x] ? density[Math.round(16 * ones[x] / occupied[x])] : background;
      }
    }
    return pixels;
  }

  return {width, height, render};
}

if (typeof module === 'object' && module.exports) module.exports = {createRhombCycleRenderer};
