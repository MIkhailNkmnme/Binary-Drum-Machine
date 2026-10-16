/* Матрёшки v0.002: та же очередь расчёта в отдельном потоке. */
importScripts('../mayatnik/mayatnik-core.js?v=3', 'matryoshki-core.js?v=002', 'matryoshki-runtime.js?v=002');
const runner = MatryoshkiRuntime.createRunner();
runner.onmessage = ({ data }) => self.postMessage(data, data.snapshot ? [data.snapshot.data.buffer] : []);
self.onmessage = ({ data }) => runner.postMessage(data);
