'use strict';

// Store the two column parities separately. Each update touches just one of them.
function createPackedRhomb(height, {reverseAtContact = false} = {}) {
  const width = 2 * height - 1;
  const middle = height / 2;
  const anchor = height - 1;
  const words = Math.ceil(height / 32);
  const stride = 2 * words;
  const bits = new Uint32Array(height * stride);
  const centers = [anchor, anchor];
  const directions = [1, -1];
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

  function advance(lastRow = height - 1) {
    const before = reverseAtContact ? separation() : 0;
    const branch = frame & 1;
    const previous = centers[branch];
    if (frame) centers[branch] = move(previous, directions[branch]);
    const center = centers[branch];
    bits[(center & 1) * words + (center >> 6)] |= 1 << ((center >> 1) & 31);
    for (let row = 1; row <= lastRow; row++) transformRow(row, center);
    leftmost = Math.min(leftmost, center);
    rightmost = Math.max(rightmost, center);
    frame++;
    const contact = reverseAtContact && before === height - 2 && separation() === height - 1 && Math.abs(center - previous) === 1;
    if (contact) turn();
    return contact;
  }

  function separation() {
    return Math.abs(centers[0] - centers[1]);
  }

  function turn() {
    directions[0] *= -1;
    directions[1] *= -1;
  }

  // A full route preserves the phase. At the proven return, the saved field
  // can be reused and reversed to obtain the last frames without a long run.
  function skipToReturn(reference, interval) {
    bits.set(reference.bits);
    centers.splice(0, 2, ...reference.centers);
    directions.splice(0, 2, ...reference.directions);
    frame = reference.frame + interval;
    leftmost = reference.leftmost;
    rightmost = reference.rightmost;
  }

  function retreat() {
    if (frame <= (reverseAtContact ? height : width)) throw new RangeError('Обратный расчёт начинается с опорного кадра.');
    if (reverseAtContact && separation() === height - 1) turn();
    frame--;
    const branch = frame & 1;
    const center = centers[branch];
    for (let row = height - 1; row > 0; row--) transformRow(row, center);
    centers[branch] = move(center, -directions[branch]);
  }

  function cell(row, column) {
    const radius = radii[row];
    if (leftmost !== 0 || rightmost !== width - 1) {
      const first = Math.max(leftmost, column - radius);
      const candidate = first + ((column - radius - first) & 1);
      if (candidate > Math.min(rightmost, column + radius)) return -1;
    }
    return (bits[row * stride + (column & 1) * words + (column >> 6)] >>> ((column >> 1) & 31)) & 1;
  }

  // Compute the first possible changed row at half the proven return time.
  // At each stage only the two immediate rows above the target can contribute.
  function contactWitness() {
    if (!reverseAtContact || frame !== 0) throw Error('Свидетель строится с пустого поля и с разворотом.');
    const first = height;
    const routePeriod = 4 * (height - 1);
    const slice = row => bits.slice(row * stride, (row + 1) * stride);
    while (frame < first) advance(2);
    const reference = bits.slice(0, 3 * stride);
    const phase = String([...centers, ...directions]);
    const route = new Uint16Array(routePeriod);
    for (let i = 0; i < routePeriod; i++) {
      advance(2);
      route[i] = centers[(frame - 1) & 1];
    }
    if (String([...centers, ...directions]) !== phase || reference.subarray(0, 2 * stride).some((v, i) => v !== bits[i])) {
      throw Error('Не совпал маршрут или две верхние строки после круга.');
    }
    let delta = slice(2).map((value, i) => value ^ reference[2 * stride + i]);
    const row = height / 2;
    for (let target = 4; target <= row; target += 2) {
      bits.fill(0, (target - 2) * stride, (target + 1) * stride);
      bits.set(delta, (target - 2) * stride);
      for (const center of route) {
        transformRow(target - 1, center);
        transformRow(target, center);
      }
      delta = slice(target);
    }
    const word = delta.findIndex(Boolean);
    if (word < 0) return null;
    const bit = 31 - Math.clz32(delta[word] & -delta[word]);
    return {row, column: 2 * ((word % words) * 32 + bit) + Number(word >= words)};
  }

  return {width, height, centers, directions, advance, retreat, cell, skipToReturn, contactWitness,
    get frame() { return frame; },
    snapshot() { return {bits: bits.slice(), centers: centers.slice(), directions: directions.slice(), leftmost, rightmost, frame}; }};
}

module.exports = {createPackedRhomb};
