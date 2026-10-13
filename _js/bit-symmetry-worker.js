/* v1: keep local-axis scans off the UI thread. */
'use strict';
importScripts('bit-symmetry.js?v=1');
self.onmessage = ({data:{key, rows}}) => {
  self.postMessage({key, result:ZZBitSymmetry.analyze(rows)});
};
