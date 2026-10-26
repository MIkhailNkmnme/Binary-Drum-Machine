/* A dedicated exact finite-cycle scan; the main thread owns cancellation. */
'use strict';
importScripts('mayatnik-core.js', 'mayatnik-compare.js?v=1', 'mayatnik-compare-analysis.js?v=1');
const analyzer = MayatnikCompareAnalysis.createFrozenAnalyzer({ preferWorker: false,
  onProgress: r => postMessage({ type: 'progress', done: r.done, total: r.total }),
  onReady: r => postMessage({ type: 'ready', lastAt: r.lastAt }, [r.lastAt.buffer]),
  onError: r => postMessage({ type: 'error', message: r.error })
});
onmessage = event => analyzer.ensure(event.data);
