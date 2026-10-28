/* v2. One complete area analysis of up to three fields per request; caller applies backpressure. */
'use strict';
importScripts('hub-compare-areas.js?v=2');
const analyzer = HubCompareAreas.createAnalyzer();
onmessage = event => {
  const {id, ...input} = event.data;
  try { postMessage({id, areas:analyzer.analyzeAreas(input)}); }
  catch (error) { postMessage({id, error:error.message || String(error)}); }
};
