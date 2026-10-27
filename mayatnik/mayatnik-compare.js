/* v2. Three finite source fields: original cones 5.7, whole-field XOR 5.8 and
   the both-sided field 5.9 (the same vertex plus its mirror, one sweep per pair).
   k counts operations: empty at 0, centre at 1, then one apex or one pair.
   Returned fields are live read-only views; copyTo materializes a host field. */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./mayatnik-core.js'));
  else root.MayatnikCompare = factory(MAYATNIK);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (core) {
  'use strict';
  const DEFAULT_CHECKPOINT_BYTES = 32 * 1024 * 1024;
  function create({ rows, direction = 'pend', pair = false, checkpointBytes = DEFAULT_CHECKPOINT_BYTES } = {}) {
    if (!Number.isSafeInteger(rows) || rows < 1 || rows > 4096) throw new RangeError('Rows must be an integer from 1 to 4096');
    if (direction !== 'pend' && direction !== 'pendR') throw new RangeError('Unknown pendulum direction');
    if (typeof pair !== 'boolean') throw new TypeError('Pair must be boolean');
    if (!Number.isSafeInteger(checkpointBytes) || checkpointBytes < 0) throw new RangeError('Invalid checkpoint byte budget');
    const H = rows, W = 2 * H - 1, anchor = H - 1, size = W * H;
    const leftField = core.field(W, H, 'empty', anchor);
    const left = leftField.val, right = new Int8Array(size).fill(-1), both = new Int8Array(size).fill(-1);
    const max = pair ? H : W, bytesPerCheckpoint = 3 * size;
    const checkpointLimit = Math.min(max, Math.floor(checkpointBytes / bytesPerCheckpoint));
    const checkpointStride = Math.max(1, Math.ceil(max / Math.max(1, checkpointLimit)));
    const checkpoints = new Map();
    let k = 0, lo = 1, hi = 0;

    function metadata() {
      return { left, right, both, W, H, anchor, k, max, vertices: pair && k ? 2 * k - 1 : k, lo, hi };
    }
    function reset() { left.fill(-1); right.fill(-1); both.fill(-1); k = 0; lo = 1; hi = 0; }
    function include(position) {
      const offset = position - anchor;
      if (lo > hi) lo = hi = offset;
      else { lo = Math.min(lo, offset); hi = Math.max(hi, offset); }
      right[position] = 1;
    }
    // Same rowwise sweep for any grid: value ⊕ up-left ⊕ up-right, empties skipped.
    function sweep(grid) {
      for (let r = 1; r < H; r++) {
        const base = r * W, up = base - W;
        for (let c = 0; c < W; c++) {
          const i = base + c, l = c ? grid[up + c - 1] : -1, rr = c + 1 < W ? grid[up + c + 1] : -1;
          let value = grid[i];
          if (l >= 0) value = value < 0 ? l : value ^ l;
          if (rr >= 0) value = value < 0 ? rr : value ^ rr;
          grid[i] = value;
        }
      }
    }
    function step() {
      let position;
      if (pair && k > 0) {
        position = anchor - k;
        const b = anchor + k;
        core.conePair(leftField, position, b, H); include(position); include(b);
      } else {
        position = anchor + core.offset(direction, pair ? 0 : k);
        core.cone(leftField, position, H); include(position);
      }
      // Both new pair seeds are present before the single rowwise sweep.
      sweep(right);
      // 5.9: the same vertex and its mirror, swept once per pair — frames 0, 1, 3, 5…
      // (the in-between frame only advances 5.8, so 5.9 matches the both-sided page).
      if (!pair && (k === 0 || k % 2 === 1)) {
        both[position] = 1;
        const twin = 2 * anchor - position;
        if (twin >= 0 && twin < W) both[twin] = 1;
        sweep(both);
      }
      k++;
      if (!checkpointLimit || (k % checkpointStride && k !== max) || checkpoints.has(k)) return;
      // Evict before allocating, so retained checkpoint bytes never exceed budget.
      if (checkpoints.size === checkpointLimit) checkpoints.delete(checkpoints.keys().next().value);
      checkpoints.set(k, { left: left.slice(), right: right.slice(), both: both.slice(), lo, hi });
    }
    function seek(target) {
      if (!Number.isSafeInteger(target) || target < 0 || target > max) throw new RangeError('Frame outside finite source sequence');
      let best = target >= k ? k : 0, saved = null;
      for (const [at, checkpoint] of checkpoints) if (at > best && at <= target) { best = at; saved = checkpoint; }
      if (saved) { left.set(saved.left); right.set(saved.right); both.set(saved.both); k = best; lo = saved.lo; hi = saved.hi; }
      else if (target < k) reset();
      while (k < target) step();
      return metadata();
    }
    function copyTo(target, source = 'cone', mirror = false, contribution = null) {
      if (!(target instanceof Int8Array) || target.length !== size) throw new RangeError('Target must be an Int8Array matching the field');
      if (!['cone', 'field', 'pair', 'p12', 'p23', 'p31', 'p123', 'xor', 'and'].includes(source)) throw new RangeError('Unknown comparison source');
      if (target.buffer === left.buffer || target.buffer === right.buffer || target.buffer === both.buffer) throw new TypeError('Target must not alias a source field');
      if (contribution && (!(contribution instanceof Uint8Array) || contribution.length !== size || contribution.buffer === target.buffer || contribution.buffer === left.buffer || contribution.buffer === right.buffer || contribution.buffer === both.buffer)) throw new RangeError('Contribution map must be a separate Uint8Array matching the field');
      for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
        const i = r * W + c, j = r * W + (mirror ? W - 1 - c : c), a = left[i], b = right[j];
        if (source === 'cone') target[i] = a;
        else if (source === 'field') target[i] = b;
        else if (source === 'pair') target[i] = pair ? b : both[i];
        else if (source === 'p12' || source === 'p23' || source === 'p31' || source === 'p123') {
          const c = pair ? b : both[i];
          const xs = (...v) => v.every(x => x < 0) ? -1 : v.reduce((s, x) => s ^ (x === 1 ? 1 : 0), 0);
          target[i] = source === 'p12' ? xs(a, c) : source === 'p23' ? xs(c, b) : source === 'p31' ? xs(b, a) : xs(a, c, b);
        }
        else target[i] = a < 0 && b < 0 ? -1 : source === 'xor' ? (a === 1) ^ (b === 1) : (a === 1) & (b === 1);
        // Bit flags describe lit input contributions; 0 and empty remain distinct in target.
        if (contribution) {
          if (source === 'pair') contribution[i] = (pair ? b : both[i]) === 1 ? 2 : 0;
          else contribution[i] = (source !== 'field' && a === 1 ? 1 : 0) | (source !== 'cone' && b === 1 ? 2 : 0);
        }
      }
      return target;
    }
    return { seek, copyTo, memory: () => ({ workingBytes: 3 * size, checkpointBytes: checkpoints.size * bytesPerCheckpoint,
      checkpointCount: checkpoints.size, checkpointLimit, checkpointStride }) };
  }
  return { create };
});
