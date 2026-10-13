/* v2: keep scans with the selected minimums off the UI thread. */
'use strict';
importScripts('bit-symmetry.js?v=2');
self.onmessage = ({data:{key, rows, options}}) => {
  self.postMessage({key, result:ZZBitSymmetry.analyze(rows, options)});
};
