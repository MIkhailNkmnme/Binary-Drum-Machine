/* Horizontal reflection from Xoroorius: one complete copy per frame. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MayatnikAnimatrixXoroorius = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';

  const plans = new WeakMap();

  function populatedRow(seed, first, selectedOnly = false) {
    for (let y = first; y < seed.height; y++) {
      const start = y * seed.width;
      for (let i = start; i < start + seed.width; i++) {
        if (seed.present[i] && (!selectedOnly || seed.selection[i])) return y;
      }
    }
    return -1;
  }

  function rowPositions(seed, y) {
    const positions = [], start = y * seed.width;
    for (let i = start; i < start + seed.width; i++) {
      if (seed.present[i]) positions.push(i);
    }
    return positions;
  }

  function gcd(a, b) {
    while (b) [a, b] = [b, a % b];
    return a;
  }

  function plan(seed) {
    if (plans.has(seed)) return plans.get(seed);
    const selected = populatedRow(seed, 0, true);
    const sourceRow = selected >= 0 ? selected : populatedRow(seed, 0);
    const resultRow = sourceRow < 0 ? -1 : populatedRow(seed, sourceRow + 1);
    if (resultRow < 0) {
      plans.set(seed, null);
      return null;
    }
    // In the field the next populated row supplies the strip's length and positions.
    const source = rowPositions(seed, sourceRow);
    const result = rowPositions(seed, resultRow);
    const period = 2 * result.length;
    const entry = { source, result, period, frames: period / gcd(period, source.length) };
    plans.set(seed, entry);
    return entry;
  }

  function cycleFrames(seed) {
    return plan(seed)?.frames ?? 1;
  }

  function step(s) {
    const seed = s._seed;
    const entry = plan(seed);
    if (!entry) return false;
    const { source, result, period } = entry;
    const first = s.stepCount === 0;
    for (const i of result) {
      if (first) s.bits[i] = s.present[i] = s.bold[i] = 0;
      s.colours[i] = s.automatic[i] = s.fills[i] = s.filled[i] = 0;
    }

    // Both end cells are visited twice, once on each leg of the reflection.
    const offset = s.excelPhase * source.length;
    for (let j = 0; j < source.length; j++) {
      const t = (offset + j) % period;
      const forward = t < result.length;
      const i = result[forward ? t : period - 1 - t];
      s.present[i] = s.bold[i] = 1;
      s.bits[i] ^= seed.bits[source[j]];
      s.colours[i] = forward ? 0x0000ff : 0xff0000;
    }

    if (result.every(i => s.present[i] && !s.bits[i])) {
      for (const i of result) {
        s.colours[i] = 0;
        s.filled[i] = 1;
        s.fills[i] = 0xffff00;
      }
    } else if (result.every(i => s.present[i] && s.bits[i])) {
      for (const i of result) s.colours[i] = 0x800080;
    }
    return true;
  }

  return { cycleFrames, step };
});
