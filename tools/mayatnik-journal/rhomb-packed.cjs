'use strict';

// Store the two column parities separately. Each update touches just one of them.
function createPackedRhomb(height) {
  const width = 2 * height - 1;
  const middle = height / 2;
  const anchor = height - 1;
  const words = Math.ceil(height / 32);
  const stride = 2 * words;
  const bits = new Uint32Array(height * stride);
  const centers = [anchor, anchor];
  const radii = Array.from({length: height}, (_, row) => Math.min(row, height - 1 - row));
  let leftmost = width, rightmost = -1;
  let frame = 0;

  function transformRow(row, center) {
    const radius = radii[row];
    const parity = (center - radius) & 1;
    const from = Math.max(0, (center - radius) >> 1);
    const to = Math.min((width - 1 - parity) >> 1, (center + radius) >> 1);
    const first = from >> 5, last = to >> 5;
    const low = -1 << (from & 31), high = -1 >>> (31 - (to & 31));
    const dest = row * stride + parity * words;
    if (row === middle) {
      for (let w = first; w <= last; w++) {
        const mask = (w === first ? low : -1) & (w === last ? high : -1);
        bits[dest + w] ^= bits[dest - stride + w] & mask;
      }
      return;
    }

    const source = (row - 1) * stride + (1 - parity) * words;
    if (row < middle) {
      for (let w = first; w <= last; w++) {
        const mask = (w === first ? low : -1) & (w === last ? high : -1);
        const upper = bits[source + w];
        const adjacent = parity
          ? (upper >>> 1) | (w + 1 < words ? bits[source + w + 1] << 31 : 0)
          : (upper << 1) | (w ? bits[source + w - 1] >>> 31 : 0);
        bits[dest + w] ^= (upper ^ adjacent) & mask;
      }
      return;
    }

    let carry = 0;
    for (let w = first; w <= last; w++) {
      const upper = bits[source + w];
      let prefix = parity ? upper : (upper << 1) | (w ? bits[source + w - 1] >>> 31 : 0);
      if (w === first) prefix &= low;
      prefix ^= prefix << 1;
      prefix ^= prefix << 2;
      prefix ^= prefix << 4;
      prefix ^= prefix << 8;
      prefix ^= prefix << 16;
      prefix ^= carry;
      carry = prefix >> 31;
      const mask = (w === first ? low : -1) & (w === last ? high : -1);
      bits[dest + w] ^= prefix & mask;
    }
  }

  function move(center, offset) {
    const next = center + offset;
    return next < 0 ? width - 1 : next === width ? 0 : next;
  }

  function advance() {
    const branch = frame & 1;
    if (frame) centers[branch] = move(centers[branch], branch ? -1 : 1);
    const center = centers[branch];
    bits[(center & 1) * words + (center >> 6)] |= 1 << ((center >> 1) & 31);
    for (let row = 1; row < height; row++) transformRow(row, center);
    leftmost = Math.min(leftmost, center);
    rightmost = Math.max(rightmost, center);
    frame++;
  }

  // A full route preserves the phase. At the proven return, the saved field
  // can be reused and reversed to obtain the last frames without a long run.
  function skipToReturn(reference, interval) {
    bits.set(reference.bits);
    centers.splice(0, 2, ...reference.centers);
    frame = reference.frame + interval;
    leftmost = 0;
    rightmost = width - 1;
  }

  function retreat() {
    if (frame <= width) throw new RangeError('Обратный расчёт начинается на заполненном поле.');
    frame--;
    const branch = frame & 1;
    const center = centers[branch];
    for (let row = height - 1; row > 0; row--) transformRow(row, center);
    centers[branch] = move(center, branch ? 1 : -1);
  }

  function cell(row, column) {
    const radius = radii[row];
    if (frame < width) {
      const first = Math.max(leftmost, column - radius);
      const candidate = first + ((column - radius - first) & 1);
      if (candidate > Math.min(rightmost, column + radius)) return -1;
    }
    return (bits[row * stride + (column & 1) * words + (column >> 6)] >>> ((column >> 1) & 31)) & 1;
  }

  return {width, height, centers, advance, retreat, cell, skipToReturn,
    get frame() { return frame; },
    snapshot() { return {bits: bits.slice(), centers: centers.slice(), frame}; }};
}

module.exports = {createPackedRhomb};
