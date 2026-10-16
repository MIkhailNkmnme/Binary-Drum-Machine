/* Матрёшки v0.003. Общая очередь расчёта для Worker и открытия HTML с диска. */
(function (root, factory) {
  const api = factory(typeof module === 'object' ? require('./matryoshki-core.js') : root.Matryoshki);
  if (typeof module === 'object') module.exports = api; else root.MatryoshkiRuntime = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (M) {
  'use strict';
  function createRunner({ schedule = fn => setTimeout(fn, 0), now = () => performance.now() } = {}) {
    let engine = null, job = null, queued = false, stopped = false;
    const runner = { onmessage: null, postMessage(data) { if (stopped) return; job = data; enqueue(); }, terminate() { stopped = true; job = engine = null; } };
    function enqueue() { if (!queued) { queued = true; schedule(run); } }
    function run() {
      queued = false; if (stopped || !job) return;
      const current = job; let data;
      try {
        if (!engine || engine.rows !== current.rows || engine.frame > current.frame) engine = new M.Engine(current.rows);
        const start = now();
        while (!engine.advance(current.frame, 1) && now() - start < 12) {}
        if (engine.frame === current.frame) { data = { id: current.id, snapshot: engine.snapshot() }; job = null; }
        else { data = { id: current.id, progress: engine.frame, target: current.frame }; enqueue(); }
      } catch (error) { data = { id: current.id, error: error.message }; job = null; }
      runner.onmessage?.({ data });
    }
    return runner;
  }
  function createClient({ protocol = globalThis.location?.protocol, makeWorker = () => new Worker('matryoshki-worker.js?v=003'), onmessage } = {}) {
    let backend, latest = null, local = false, stopped = false;
    const receive = event => { if (!stopped) onmessage?.(event); };
    function fallback() {
      if (local || stopped) return;
      local = true; backend?.terminate(); backend = createRunner(); backend.onmessage = receive;
      if (latest) backend.postMessage(latest);
    }
    if (protocol === 'file:') fallback();
    else {
      try {
        backend = makeWorker(); backend.onmessage = receive;
        backend.onerror = event => { event.preventDefault?.(); fallback(); };
      } catch { fallback(); }
    }
    return { postMessage(data) { if (stopped) return; latest = data; backend.postMessage(data); }, terminate() { stopped = true; backend.terminate(); } };
  }
  return { createRunner, createClient };
});
