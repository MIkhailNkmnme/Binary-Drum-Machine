/* v2: configurable minimum rows and pairs, both starting at 1. */
(() => {
  'use strict';
  const palette = ['#ffc76d', '#6fd9ff', '#c5a0ff', '#ff96b4', '#a9ed79', '#ffab79'];
  const cache = new Map();
  const workerURL = typeof document !== 'undefined' && document.currentScript ? new URL('bit-symmetry-worker.js?v=2', document.currentScript.src).href : null;
  let worker = null, running = null, workerFailed = false;
  let cacheCells = 0;
  const queued = new Map();
  const binary = b => b === '0' || b === '1';

  // Manacher radii: linear work per row, even for large uniform regions.
  // Empty cells are barriers, never matching bits.
  function radii(row) {
    const n = row.length, odd = new Int32Array(n), even = new Int32Array(n);
    for (let i = 0, l = 0, r = -1; i < n; i++) {
      let k = i > r ? 1 : Math.min(odd[l + r - i], r - i + 1);
      if (!binary(row[i])) k = 0;
      while (i - k >= 0 && i + k < n && binary(row[i - k]) && row[i - k] === row[i + k]) k++;
      odd[i] = k;
      if (i + k - 1 > r) { l = i - k + 1; r = i + k - 1; }
    }
    for (let i = 0, l = 0, r = -1; i < n; i++) {
      let k = i > r ? 0 : Math.min(even[l + r - i + 1], r - i + 1);
      while (i - k - 1 >= 0 && i + k < n && binary(row[i - k - 1]) && row[i - k - 1] === row[i + k]) k++;
      even[i] = k;
      if (i + k - 1 > r) { l = i - k; r = i + k - 1; }
    }
    return {odd, even};
  }

  function find(rows, {minPairs = 6, minRows = 8} = {}) {
    minPairs = Math.max(1, Math.round(minPairs)); minRows = Math.max(1, Math.round(minRows));
    const segments = [], active = new Map();
    const finish = s => { if (s.rows.length >= minRows) segments.push(s); };
    for (let y = 0; y < rows.length; y++) {
      const row = rows[y], n = row.length, {odd, even} = radii(row), ones = new Int32Array(n + 1), seen = new Set();
      for (let j = 0; j < n; j++) ones[j + 1] = ones[j] + (row[j] === '1' ? 1 : 0);
      function accept(i, pairs, center) {
        if (pairs < minPairs) return;
        const left = i - pairs, right = i + pairs - (center ? 0 : 1), one = ones[i] - ones[left];
        if (minPairs > 1 && (!one || one === pairs)) return; // A one-pair minimum also allows plain 00 / 11 matches.
        // x2 is horizontal position in half-bit units. Rows of different lengths share the same center.
        const x2 = 2 * i - (n - 1) - (center ? 0 : 1);
        let s = active.get(x2);
        if (!s) { s = {x2, y0: y, y1: y, rows: []}; active.set(x2, s); }
        s.y1 = y; s.rows.push({y, left, right, pairs}); seen.add(x2);
      }
      for (let i = 0; i < n; i++) { accept(i, odd[i] - 1, true); accept(i, even[i], false); }
      for (const [x2, s] of active) if (!seen.has(x2)) { finish(s); active.delete(x2); }
    }
    for (const s of active.values()) finish(s);
    segments.sort((a, b) => a.x2 - b.x2 || a.y0 - b.y0);
    // Overlapping symmetry regions share a colour, so a later axis cannot recolour just one half of a pair.
    const parents = segments.map((_, i) => i), root = i => { while (parents[i] !== i) { parents[i] = parents[parents[i]]; i = parents[i]; } return i; };
    const join = (a, b) => { a = root(a); b = root(b); if (a !== b) parents[Math.max(a, b)] = Math.min(a, b); };
    const intervals = rows.map(() => []), owners = rows.map(row => new Int32Array(row.length));
    segments.forEach((s, i) => s.rows.forEach(r => intervals[r.y].push({...r, i})));
    for (let y = 0; y < rows.length; y++) {
      intervals[y].sort((a, b) => a.left - b.left || a.right - b.right);
      let reach = -1, previous = -1;
      for (const r of intervals[y]) {
        if (r.left <= reach) join(previous, r.i);
        for (let j = Math.max(r.left, reach + 1); j <= r.right; j++) owners[y][j] = r.i + 1;
        if (r.right > reach) { reach = r.right; previous = r.i; }
      }
    }
    for (let i = 0; i < segments.length; i++) {
      const s = segments[i], x2 = segments[root(i)].x2;
      s.colorIndex = ((x2 % palette.length) + palette.length) % palette.length; s.color = palette[s.colorIndex];
    }
    const colors = owners.map(row => Uint8Array.from(row, owner => owner ? segments[owner - 1].colorIndex + 1 : 0));
    let matched = 0; for (const row of colors) for (const c of row) if (c) matched++;
    return {segments, colors, matched, minPairs, minRows};
  }

  function limits(rows, options = {}) {
    options ||= {};
    const positive = (value, fallback) => Number.isFinite(value) ? Math.max(1, Math.round(value)) : fallback;
    return {minPairs:positive(options.minPairs, Math.max(2, Math.min(6, Math.floor(rows.length / 64)))),
      minRows:positive(options.minRows, Math.max(3, Math.min(8, Math.floor(rows.length / 32))))};
  }
  const sourceKey = (rows, options) => options.minPairs + ',' + options.minRows + '|' + rows.join('\n');
  function analyze(rows, options) {
    options = limits(rows, options);
    const key = sourceKey(rows, options);
    if (cache.has(key)) return cache.get(key);
    const result = find(rows, options);
    remember(key, result);
    return result;
  }
  function remember(key, result) {
    if (cache.has(key)) cacheCells -= key.length;
    cache.set(key, result); cacheCells += key.length;
    while (cache.size > 8 || cacheCells > 8000000 && cache.size > 1) {
      const oldest = cache.keys().next().value; cacheCells -= oldest.length; cache.delete(oldest);
    }
  }
  function ready() { window.dispatchEvent(new Event('bitsymmetryready')); }
  function sendNext() {
    if (running !== null || !queued.size) return;
    // Prefer the latest frame. Only the exact same source can use its result.
    const key = [...queued.keys()].pop(), {rows, options} = queued.get(key); queued.delete(key);
    running = key; worker.postMessage({key, rows, options});
  }
  function request(rows, options) {
    options = limits(rows, options);
    const key = sourceKey(rows, options);
    if (cache.has(key)) return cache.get(key);
    if (key.length < 120000 || workerFailed || !workerURL || typeof Worker === 'undefined') return analyze(rows, options);
    if (!worker) {
      try {
        worker = new Worker(workerURL);
        worker.onmessage = e => { remember(e.data.key, e.data.result); running = null; ready(); sendNext(); };
        worker.onerror = () => { workerFailed = true; worker.terminate(); worker = null; queued.clear(); running = null; ready(); };
      } catch (_) { workerFailed = true; return analyze(rows, options); }
    }
    if (running !== key && !queued.has(key)) {
      queued.set(key, {rows:rows.slice(), options}); if (queued.size > 4) queued.delete(queued.keys().next().value);
      sendNext();
    }
    return null;
  }
  const colorAt = (data, r, j) => palette[(data?.colors[r]?.[j] || 0) - 1] || null;
  function drawAxes(ctx, data, point, lineWidth = 1, colorMap = c => c) {
    if (!data) return;
    ctx.save(); ctx.globalAlpha *= .9; ctx.lineWidth = lineWidth;
    for (const s of data.segments) {
      ctx.strokeStyle = colorMap(s.color); ctx.beginPath();
      ctx.moveTo(...point(s.x2, s.y0 - .35)); ctx.lineTo(...point(s.x2, s.y1 + .35)); ctx.stroke();
    }
    ctx.restore();
  }
  const api = {find, analyze, request, limits, colorAt, drawAxes};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else globalThis.ZZBitSymmetry = api;
})();
