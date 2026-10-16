/* Матрёшки v0.003: та же очередь расчёта в отдельном потоке. */
importScripts('../mayatnik/mayatnik-core.js?v=3', 'matryoshki-core.js?v=003', 'matryoshki-runtime.js?v=003');
const runner = MatryoshkiRuntime.createRunner();
runner.onmessage = ({ data }) => self.postMessage(data, data.snapshot ? [data.snapshot.data.buffer] : []);
self.onmessage = ({ data }) => runner.postMessage(data);
