/* Матрёшки v0.001: последовательное общее ядро — вне потока интерфейса. */
importScripts('../mayatnik/mayatnik-core.js?v=3', 'matryoshki-core.js?v=001');
let engine = null, request = null, working = false;
self.onmessage = ({ data }) => { request = data; if (!working) run(); };
function run() {
  working = true;
  try {
    const job = request;
    if (!engine || engine.rows !== job.rows || engine.frame > job.frame) engine = new Matryoshki.Engine(job.rows);
    const start = performance.now();
    while (!engine.advance(job.frame, 1) && performance.now() - start < 16) {}
    if (engine.frame === job.frame) {
      const snapshot = engine.snapshot(); self.postMessage({ id: job.id, snapshot }, [snapshot.data.buffer]); working = false;
    } else {
      self.postMessage({ id: job.id, progress: engine.frame, target: job.frame }); setTimeout(run, 0);
    }
  } catch (error) { self.postMessage({ id: request?.id, error: error.message }); working = false; }
}
