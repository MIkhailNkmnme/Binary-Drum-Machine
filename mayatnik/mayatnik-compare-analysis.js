/* Exact last value change in one finite comparison sequence. No frame archive.
   The worker keeps large source sweeps off the UI; file:// falls back to yields. */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./mayatnik-compare.js'), null);
  else root.MayatnikCompareAnalysis = factory(root.MayatnikCompare,
    typeof document === 'object' ? document.currentScript?.src || location.href : null);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Compare, scriptURL) {
  'use strict';
  function normalized(options) {
    const { rows, direction = 'pend', pair = false, source = 'cone', mirror = false } = options;
    const max = pair ? rows : 2 * rows - 1, steps = options.steps === undefined ? max : options.steps;
    if (!Number.isSafeInteger(rows) || rows < 1 || rows > 4096 ||
        !['pend', 'pendR'].includes(direction) || typeof pair !== 'boolean' ||
        !['cone', 'field', 'pair', 'p12', 'p23', 'p31', 'p123', 'a12', 'a23', 'a31', 'a123', 'xor', 'and'].includes(source) || typeof mirror !== 'boolean' ||
        !Number.isSafeInteger(steps) || steps < 0 || steps > max) throw new RangeError('Invalid finite freeze configuration');
    return { rows, direction, pair, source, mirror, steps };
  }
  const keyOf = options => { const o = normalized(options); return [o.rows, o.direction, +o.pair, o.source, +o.mirror, o.steps].join('|'); };

  function createFrozenAnalyzer({ onProgress = () => {}, onReady = () => {}, onError = () => {}, preferWorker = true,
    yieldTask = () => new Promise(resolve => setTimeout(resolve, 0)) } = {}) {
    let current = null, serial = 0, worker = null;
    const active = record => current === record && record.serial === serial && record.status === 'pending';
    function cancel() {
      serial++;
      if (worker) { worker.terminate(); worker = null; }
      if (current?.status === 'pending') { current.status = 'cancelled'; current.resolve(current); }
      current = null;
    }
    function finish(record, lastAt) {
      if (!active(record)) return;
      record.lastAt = lastAt; record.status = 'ready'; record.done = record.total;
      record.resolve(record); onReady(record);
    }
    function progress(record, done) {
      if (!active(record)) return;
      record.done = done; onProgress(record);
    }
    async function run(record) {
      try {
        // Explicit zero checkpoints: only two source fields, two materialized
        // frames and one last-change map survive, independently of cycle length.
        const engine = Compare.create({ ...record.options, checkpointBytes: 0 });
        const size = record.W * record.H, previous = new Int8Array(size).fill(-1), values = new Int8Array(size);
        const lastAt = new Int32Array(size).fill(-1);
        let lastYield = Date.now(), lastProgress = 0;
        for (let k = 1; k <= record.total; k++) {
          if (!active(record)) return;
          engine.seek(k); engine.copyTo(values, record.options.source, record.options.mirror);
          for (let start = 0; start < size; start += 131072) {
            const end = Math.min(size, start + 131072);
            for (let q = start; q < end; q++) if (previous[q] !== values[q]) { previous[q] = values[q]; lastAt[q] = k; }
            if (Date.now() - lastYield >= 12) {
              await yieldTask(); if (!active(record)) return; lastYield = Date.now();
            }
          }
          if (Date.now() - lastProgress >= 100 || k === record.total) { progress(record, k); lastProgress = Date.now(); }
          // Even a small sequence can be cancelled between source frames.
          await yieldTask(); lastYield = Date.now();
        }
        finish(record, lastAt);
      } catch (error) {
        if (!active(record)) return;
        record.status = 'error'; record.error = error.message; record.resolve(record); onError(record);
      }
    }
    function ensure(options) {
      const config = normalized(options), key = keyOf(config);
      if (current?.key === key) return current;
      cancel();
      const record = { key, options: config, serial, W: 2 * config.rows - 1, H: config.rows,
        total: config.steps, done: 0, status: 'pending', lastAt: null };
      record.promise = new Promise(resolve => { record.resolve = resolve; }); current = record;
      let fallingBack = false;
      const fallback = () => {
        if (fallingBack || !active(record)) return;
        fallingBack = true; if (worker) { worker.terminate(); worker = null; }
        Promise.resolve().then(() => run(record));
      };
      if (preferWorker && scriptURL && typeof Worker === 'function') {
        try {
          worker = new Worker(new URL('mayatnik-compare-analysis-worker.js?v=1', scriptURL));
          worker.onmessage = event => {
            if (!active(record)) return;
            const data = event.data;
            if (data.type === 'progress') progress(record, data.done);
            else if (data.type === 'ready' && data.lastAt instanceof Int32Array && data.lastAt.length === record.W * record.H) {
              worker.terminate(); worker = null; finish(record, data.lastAt);
            } else if (data.type === 'error') fallback();
          };
          worker.onerror = event => { event.preventDefault?.(); fallback(); };
          worker.postMessage(config);
        } catch (_) { fallback(); }
      } else fallback();
      return record;
    }
    return { ensure, cancel, key: keyOf, current: () => current };
  }
  return { createFrozenAnalyzer, key: keyOf };
});
