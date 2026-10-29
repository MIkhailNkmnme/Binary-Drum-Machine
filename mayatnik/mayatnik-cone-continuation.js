/* Cone continuation keeps the original visible crop and its cell addresses.
   The finite prefix is calculated on its original clipped field. Only after
   that prefix, new cones acquire complete, initially empty, hidden wings.
   Extending a UI horizon never recalculates history or allocates a halo. */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./mayatnik-core.js'));
  else root.MayatnikConeContinuation = factory(root.MAYATNIK || MAYATNIK);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (core) {
  'use strict';
  const DEFAULT_CHECKPOINT_BYTES = 32 * 1024 * 1024;
  function create({ rows, direction = 'pend', pair = false, checkpointBytes = DEFAULT_CHECKPOINT_BYTES } = {}) {
    if (!Number.isSafeInteger(rows) || rows < 1 || rows > 4096) throw new RangeError('Rows must be an integer from 1 to 4096');
    if (direction !== 'pend' && direction !== 'pendR') throw new RangeError('Unknown pendulum direction');
    if (typeof pair !== 'boolean') throw new TypeError('Pair must be boolean');
    if (!Number.isSafeInteger(checkpointBytes) || checkpointBytes < 0) throw new RangeError('Invalid checkpoint byte budget');
    const H = rows, W = 2 * H - 1, anchor = H - 1, size = W * H, baseMax = pair ? H : W;
    const left = new Int8Array(size).fill(-1), checkpoints = new Map();
    const checkpointLimit = Math.min(baseMax, Math.floor(checkpointBytes / size));
    const checkpointStride = Math.max(1, Math.ceil(baseMax / Math.max(1, checkpointLimit)));
    let work = { W, H, val: left }, origin = 0, k = 0, max = baseMax, lo = 1, hi = 0, retainedBytes = 0;

    function frameNumber(value) {
      if (!Number.isSafeInteger(value) || value < 0) throw new RangeError('Frame must be a nonnegative safe integer');
    }
    function metadata() {
      return { left, W, H, anchor, k, max, baseMax, vertices: pair && k ? 2 * k - 1 : k,
        lo, hi, workingW: work.W, workingOrigin: origin };
    }
    function extend(target) { frameNumber(target); max = Math.max(max, target); return metadata(); }
    function publish() {
      if (work.val === left) return;
      for (let r = 0; r < H; r++) left.set(work.val.subarray(r * work.W - origin, r * work.W - origin + W), r * W);
    }
    function reset() { left.fill(-1); work = { W, H, val: left }; origin = 0; k = 0; lo = 1; hi = 0; }
    function allocate(width) {
      if (!Number.isSafeInteger(width) || !Number.isSafeInteger(width * H)) throw new RangeError('Cone continuation field is too large');
      try { return new Int8Array(width * H).fill(-1); }
      catch (error) { throw new RangeError('Not enough memory to continue the cone field', { cause: error }); }
    }
    // Capacity is not the simulation boundary: every post-prefix cone must fit
    // in full. Unvisited extra capacity stays empty, so allocation chunk sizes
    // cannot influence the visible bits or a replay after reloading the page.
    function contain(from, to) {
      if (from >= origin && to < origin + work.W) return;
      const neededLo = Math.min(origin, from), neededHi = Math.max(origin + work.W - 1, to);
      const neededW = neededHi - neededLo + 1;
      const capacity = Math.max(neededW, Math.ceil(work.W * 1.5));
      const nextOrigin = neededLo - Math.floor((capacity - neededW) / 2), val = allocate(capacity);
      for (let r = 0; r < H; r++) val.set(work.val.subarray(r * work.W, (r + 1) * work.W), r * capacity + origin - nextOrigin);
      work = { W: capacity, H, val }; origin = nextOrigin;
    }
    function checkpoint() {
      const bytes = work.val.byteLength;
      if (!checkpointLimit || bytes > checkpointBytes || (k % checkpointStride && k !== baseMax) || checkpoints.has(k)) return;
      while (retainedBytes + bytes > checkpointBytes || checkpoints.size >= checkpointLimit) {
        const oldest = checkpoints.keys().next().value;
        retainedBytes -= checkpoints.get(oldest).val.byteLength; checkpoints.delete(oldest);
      }
      // A checkpoint is optional; failure to allocate it must not undo a valid
      // newly calculated frame. The working field's allocation errors surface.
      let val;
      try { val = work.val.slice(); } catch (error) { if (error instanceof RangeError) return; throw error; }
      checkpoints.set(k, { val, W: work.W, origin, lo, hi }); retainedBytes += bytes;
    }
    function step() {
      const offset = k === 0 ? 0 : k % 2 ? -Math.ceil(k / 2) : k / 2;
      const a = pair && k ? anchor - k : anchor + (direction === 'pendR' ? -offset : offset);
      const b = pair && k ? anchor + k : a;
      if (k >= baseMax) contain(Math.min(a, b) - (H - 1), Math.max(a, b) + H - 1);
      if (pair && k) core.conePair(work, a - origin, b - origin, H);
      else core.cone(work, a - origin, H);
      const low = Math.min(a, b) - anchor, high = Math.max(a, b) - anchor;
      if (lo > hi) { lo = low; hi = high; } else { lo = Math.min(lo, low); hi = Math.max(hi, high); }
      k++; checkpoint();
    }
    function restore(at, saved) {
      // Prepare the replacement before changing the live state.
      const val = saved.W === W && saved.origin === 0 ? left : allocate(saved.W);
      val.set(saved.val);
      work = { W: saved.W, H, val }; origin = saved.origin; k = at; lo = saved.lo; hi = saved.hi;
    }
    function seek(target) {
      extend(target);
      let best = target >= k ? k : 0, saved = null;
      for (const [at, candidate] of checkpoints) if (at > best && at <= target) { best = at; saved = candidate; }
      try {
        if (saved) restore(best, saved);
        else if (target < k) reset();
        while (k < target) step();
      } finally { publish(); }
      return metadata();
    }
    function copyTo(target, source = 'cone', mirror = false, contribution = null) {
      if (!(target instanceof Int8Array) || target.length !== size) throw new RangeError('Target must be an Int8Array matching the visible field');
      if (source !== 'cone') throw new RangeError('Continuation supports only the cone source');
      if (target.buffer === left.buffer || target.buffer === work.val.buffer) throw new TypeError('Target must not alias a source field');
      if (contribution && (!(contribution instanceof Uint8Array) || contribution.length !== size ||
          contribution.buffer === target.buffer || contribution.buffer === left.buffer || contribution.buffer === work.val.buffer)) {
        throw new RangeError('Contribution map must be a separate Uint8Array matching the visible field');
      }
      // Like the finite compare engine, mirror affects other sources, not cone.
      target.set(left);
      if (contribution) for (let i = 0; i < size; i++) contribution[i] = left[i] === 1 ? 1 : 0;
      return target;
    }
    function readCell(row, column) {
      if (!Number.isSafeInteger(row) || !Number.isSafeInteger(column)) throw new RangeError('Cell coordinates must be safe integers');
      return row < 0 || row >= H || column < origin || column >= origin + work.W ? -1 : work.val[row * work.W + column - origin];
    }
    return { seek, extend, copyTo, readCell, memory: () => ({
      workingBytes: work.val.byteLength + (work.val === left ? 0 : left.byteLength),
      checkpointBytes: retainedBytes, checkpointCount: checkpoints.size,
      checkpointLimit, checkpointStride, checkpointBudget: checkpointBytes
    }) };
  }
  return { create };
});
