/* Pure finite-field ports of the selected-cell VBA transformations.
 * No canvas, storage, timers, vertex insertion or pattern-search side effects.
 * Coordinates are zero-based; outside the fixed field is empty (no wrapping).
 * RGB values are 0xRRGGBB. Empty and bit 0 are distinguished by present.
 */
(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const api = factory(
    node ? require('./mayatnik-animatrix-xoroorius.js') : root.MayatnikAnimatrixXoroorius,
    node ? require('./mayatnik-animatrix-interxor.js') : root.MayatnikAnimatrixInterxor,
    node ? require('./mayatnik-animatrix-excel-shapes.js') : root.MayatnikAnimatrixExcelShapes);
  if (node) module.exports = api;
  else root.MayatnikAnimatrixCore = api;
})(typeof globalThis === 'object' ? globalThis : this, function (Xoroorius, Interxor, Shapes) {
  'use strict';
  const TYPES = { bits: Uint8Array, present: Uint8Array, colours: Uint32Array,
    bold: Uint8Array, automatic: Uint8Array, fills: Uint32Array, filled: Uint8Array, selection: Uint8Array };
  const KEYS = Object.keys(TYPES);
  const EXCEL = {
    excelBounce: Xoroorius, excelChain: Interxor, excelChainDown: Interxor,
    excelTriangleDown: Shapes, excelTriangleUp: Shapes, excelTriangleBoth: Shapes,
    excelTrianglePend: Shapes, excelCollision: Shapes
  };
  const EXCEL_ALGORITHMS = Object.keys(EXCEL);
  const ALGORITHMS = ['two', 'three', 'shift', 'horr', 'zero', 'background', 'copyRows', ...EXCEL_ALGORITHMS];
  const DIRECTIONS = ['down', 'up', 'left', 'right'];
  const EMPTY = Object.freeze([0, 0, 0, 0, 0]); // present, bit, RGB, bold, colour participates

  function dimension(n) {
    if (!Number.isSafeInteger(n) || n < 1) throw new RangeError('Invalid field dimension');
    return n;
  }
  function count(n) {
    if (!Number.isSafeInteger(n) || n < 0) throw new RangeError('Invalid step count');
    return n;
  }
  function clip(s, a) {
    const x = Math.max(0, Math.min(s.width, Math.trunc(Number(a.x) || 0)));
    const y = Math.max(0, Math.min(s.height, Math.trunc(Number(a.y) || 0)));
    const right = Math.max(x, Math.min(s.width, Math.trunc((Number(a.x) || 0) + Number(a.width || 0))));
    const bottom = Math.max(y, Math.min(s.height, Math.trunc((Number(a.y) || 0) + Number(a.height || 0))));
    return { x, y, width: right - x, height: bottom - y };
  }
  function each(s, a, fn) {
    for (let y = a.y; y < a.y + a.height; y++)
      for (let x = a.x; x < a.x + a.width; x++) fn(y * s.width + x, x, y);
  }
  function maskAreas(s, mask) {
    // Preserve supplied VBA Areas when available. Otherwise merge identical
    // horizontal runs on adjacent rows; arbitrary masks have a canonical order.
    const result = []; let previous = new Map();
    for (let y = 0; y < s.height; y++) {
      const next = new Map();
      for (let x = 0; x < s.width;) {
        if (!mask[y * s.width + x]) { x++; continue; }
        const left = x; while (x < s.width && mask[y * s.width + x]) x++;
        const key = left + ':' + x, old = previous.get(key);
        const a = old || { x: left, y, width: x - left, height: 0 };
        a.height++; if (!old) result.push(a); next.set(key, a);
      }
      previous = next;
    }
    return result;
  }
  function cloneSeed(seed) {
    const width = dimension(seed.width), height = dimension(seed.height), size = width * height;
    if (!Number.isSafeInteger(size)) throw new RangeError('Field is too large');
    const out = { width, height };
    for (const [key, Type] of Object.entries(TYPES)) {
      if (seed[key] != null && seed[key].length !== size) throw new RangeError('Invalid ' + key + ' length');
      out[key] = seed[key] == null ? new Type(size) : Type.from(seed[key]);
    }
    if (seed.present == null) {
      const values = seed.bits || [];
      for (let i = 0; i < size; i++) out.present[i] = values[i] != null && values[i] >= 0 ? 1 : 0;
    }
    const {bits,present,bold,automatic,filled,selection,colours,fills}=out;
    for (let i = 0; i < size; i++) {
      bits[i] = present[i] && bits[i] === 1 ? 1 : 0;
      present[i] = +!!present[i];
      bold[i] = +!!bold[i];
      automatic[i] = +!!automatic[i];
      filled[i] = +!!filled[i];
      selection[i] = +!!selection[i];
      colours[i] &= 0xffffff; fills[i] &= 0xffffff;
    }
    if (Array.isArray(seed.areas)) {
      out.areas = seed.areas.map(a => clip(out, a)).filter(a => a.width && a.height);
      out.selection.fill(0); for (const a of out.areas) each(out, a, i => { out.selection[i] = 1; });
    } else {
      if (seed.selection == null) out.selection.set(out.present);
      out.areas = maskAreas(out, out.selection);
    }
    return out;
  }
  function copySeed(seed, shareMetadata = false) {
    const out = { width: seed.width, height: seed.height, areas: seed.areas.map(area => ({ ...area })) };
    // copyRows changes only bits/presence/marks. Font, fill and selection data
    // stay immutable and can be shared by its calculators and checkpoints.
    for (const key of KEYS) out[key] = shareMetadata && key !== 'bits' && key !== 'present' ? seed[key] : seed[key].slice();
    return out;
  }
  const firstScanRow = s => s.algorithm === 'copyRows' && !s.copyRowsGaps ? 2 : 1;
  function copyRowsCycleFrames(height, mirror, byAxis, wrap, gaps) {
    if (wrap || gaps) return height - 1;
    if (!mirror || byAxis) return height - 2;
    const lastAxis = Math.floor(height / 2);
    return lastAxis * (lastAxis - 1) / 2 + height - lastAxis - 1;
  }
  function resetProgress(s) {
    const first = firstScanRow(s);
    s.stepCount = s.rowCount = s.cycle = 0;
    if (s.copyRowsOriginalHeight) s.copyRowsVisibleHeight = s.copyRowsOriginalHeight;
    s.cursorRow = s.height > first ? first : 0;
    s.done = s.scan && s.height <= first;
    s._scanSelectionRows = null;
    if (s.excelCycleFrames) s.excelPhase = 0;
    if (s.interxorPatterns) {
      s.interxorFound ??= new Uint8Array(s.interxorPatterns.length);
      s.interxorFound.fill(0);
    }
    if (s.algorithm === 'copyRows') {
      s.copyMarks ??= new Uint8Array(s.bits.length);
      s.copyMarks.fill(0);
      s.copyAxis = s.copyRowsGaps ? (s.direction === 'up' ? s.height - 1.5 : 0.5) : 1;
      if (s.copyRowsGaps && !s.done) s.cursorRow = s.direction === 'up' ? s.height - 2 : 1;
    }
    return s;
  }
  function create(seed, options = {}) {
    const algorithm = options.algorithm || 'two', direction = options.direction || 'down';
    if (!ALGORITHMS.includes(algorithm)) throw new RangeError('Unknown algorithm');
    if (!DIRECTIONS.includes(direction)) throw new RangeError('Unknown direction');
    const excel = EXCEL[algorithm];
    const scan = !excel && (!!options.scan || algorithm === 'copyRows');
    const gaps = algorithm === 'copyRows' && options.copyRowsGaps === true;
    if (scan && direction !== 'down' && !(gaps && direction === 'up')) throw new RangeError('Row scan supports down only');
    // Source owns freshly generated procedural seeds; adopting one avoids a
    // second full allocation. Ordinary callers retain the cloning contract.
    const initial = algorithm === 'copyRows' && options.copyRowsOwnedSeed ? seed : cloneSeed(seed);
    const state = copySeed(initial, algorithm === 'copyRows');
    state.algorithm = algorithm; state.direction = direction; state.scan = scan;
    state.copyRowsGaps = gaps;
    if (gaps) state.copyRowsProtected = initial.present;
    state.copyRowsMirror = gaps || algorithm === 'copyRows' && options.copyRowsMirror === true;
    state.copyRowsByAxis = gaps || state.copyRowsMirror && options.copyRowsByAxis === true;
    state.copyRowsExcel = !gaps && state.copyRowsByAxis && options.copyRowsExcel === true;
    state.copyRowsWrap = !gaps && state.copyRowsByAxis && !state.copyRowsExcel && options.copyRowsWrap === true;
    if (!gaps && state.copyRowsByAxis && !state.copyRowsWrap && !state.copyRowsExcel && options.copyRowsOriginalHeight)
      state.copyRowsOriginalHeight = options.copyRowsOriginalHeight;
    if (excel) {
      state.excelAnchor = options.excelAnchor ?? Math.floor((initial.width - 1) / 2);
      state.excelDepth = options.excelDepth ?? 128;
      state.excelColourChangesOnly = options.excelColourChangesOnly === true;
      state.excelCycleFrames = options.excelCycleFrames ?? excel.cycleFrames(initial, state);
    }
    if (algorithm === 'excelCollision') state.collisionFillEmpty = options.collisionFillEmpty;
    if (excel === Interxor && options.interxorPatterns?.length) {
      state.interxorPatterns = Object.freeze(options.interxorPatterns.slice());
    }
    Object.defineProperty(state, '_seed', { value: initial });
    Object.defineProperty(state, '_scanSelectionRows', { value: null, writable: true });
    return resetProgress(state);
  }
  function snapshot(s) {
    return Object.assign(s.algorithm === 'copyRows' ? copySeed(s, true) : cloneSeed(s), { algorithm: s.algorithm, direction: s.direction, scan: s.scan,
      stepCount: s.stepCount, rowCount: s.rowCount, cursorRow: s.cursorRow, cycle: s.cycle, done: s.done,
      ...(s.excelCycleFrames ? { excelPhase: s.excelPhase, excelAnchor: s.excelAnchor, excelDepth: s.excelDepth, excelColourChangesOnly: s.excelColourChangesOnly } : {}),
      ...(s.algorithm === 'excelCollision' ? { collisionFillEmpty: s.collisionFillEmpty } : {}),
      ...(s.interxorFound ? { interxorPatterns: s.interxorPatterns, interxorFound: s.interxorFound.slice() } : {}),
      ...(s.copyRowsGaps ? { copyRowsGaps: true, copyRowsProtected: s.copyRowsProtected } : {}),
      ...(s.copyMarks ? { copyMarks: s.copyMarks.slice(), copyAxis: s.copyAxis, copyRowsMirror: s.copyRowsMirror, copyRowsByAxis: s.copyRowsByAxis, copyRowsWrap: s.copyRowsWrap, copyRowsExcel: s.copyRowsExcel, copyRowsOriginalHeight: s.copyRowsOriginalHeight } : {}) });
  }
  function reset(s) {
    const initial = s._seed;
    for (const key of KEYS) if(s[key] !== initial[key]) s[key].set(initial[key]);
    s.areas = initial.areas.map(area => ({ ...area }));
    return resetProgress(s);
  }
  // Independent calculator at the same immutable seed, without duplicating it.
  function forkInitial(s) {
    const state = copySeed(s._seed, s.algorithm === 'copyRows');
    Object.assign(state, { algorithm: s.algorithm, direction: s.direction, scan: s.scan, copyRowsMirror: s.copyRowsMirror, copyRowsByAxis: s.copyRowsByAxis, copyRowsWrap: s.copyRowsWrap, copyRowsExcel: s.copyRowsExcel, copyRowsOriginalHeight: s.copyRowsOriginalHeight });
    state.copyRowsGaps = s.copyRowsGaps;
    if (s.copyRowsGaps) state.copyRowsProtected = s._seed.present;
    if (s.excelCycleFrames) Object.assign(state, { excelCycleFrames: s.excelCycleFrames, excelAnchor: s.excelAnchor, excelDepth: s.excelDepth, excelColourChangesOnly: s.excelColourChangesOnly });
    if (s.algorithm === 'excelCollision') state.collisionFillEmpty = s.collisionFillEmpty;
    if (s.interxorPatterns) state.interxorPatterns = s.interxorPatterns;
    Object.defineProperty(state, '_seed', { value: s._seed });
    Object.defineProperty(state, '_scanSelectionRows', { value: null, writable: true });
    return resetProgress(state);
  }
  // Counters are excluded: they cannot affect the next transformation. Areas'
  // order is included because VBA processes overlapping Areas in that order.
  function sameState(a, b) {
    if (!!a.copyRowsGaps !== !!b.copyRowsGaps) return false;
    if (a.copyRowsGaps) {
      if (a.direction !== b.direction || a.copyRowsProtected.length !== b.copyRowsProtected.length) return false;
      if(a.copyRowsProtected !== b.copyRowsProtected)
        for (let i = 0; i < a.copyRowsProtected.length; i++) if (a.copyRowsProtected[i] !== b.copyRowsProtected[i]) return false;
    }
    if (a.width !== b.width || a.height !== b.height || a.cursorRow !== b.cursorRow ||
        a.done !== b.done || a.areas.length !== b.areas.length) return false;
    if (a.excelPhase !== undefined || b.excelPhase !== undefined) {
      if (a.algorithm !== b.algorithm || a.excelPhase !== b.excelPhase || a.excelAnchor !== b.excelAnchor || a.excelDepth !== b.excelDepth || a.excelColourChangesOnly !== b.excelColourChangesOnly) return false;
      if (a.algorithm === 'excelBounce' && (a.stepCount === 0) !== (b.stepCount === 0)) return false;
      if (a.algorithm === 'excelCollision' && a.collisionFillEmpty !== b.collisionFillEmpty) return false;
    }
    if (!!a.interxorFound !== !!b.interxorFound) return false;
    if (a.interxorFound && (a.interxorFound.length !== b.interxorFound.length ||
        a.interxorFound.some((value, i) => value !== b.interxorFound[i] || a.interxorPatterns[i] !== b.interxorPatterns[i]))) return false;
    for (let i = 0; i < a.areas.length; i++) for (const key of ['x', 'y', 'width', 'height'])
      if (a.areas[i][key] !== b.areas[i][key]) return false;
    for (const key of KEYS) if(a[key] !== b[key])
      for (let i = 0; i < a[key].length; i++) if (a[key][i] !== b[key][i]) return false;
    if (!!a.copyMarks !== !!b.copyMarks) return false;
    if (a.copyMarks) {
      if (a.copyRowsMirror !== b.copyRowsMirror || a.copyRowsByAxis !== b.copyRowsByAxis || a.copyRowsWrap !== b.copyRowsWrap ||
          a.copyRowsExcel !== b.copyRowsExcel || a.copyRowsOriginalHeight !== b.copyRowsOriginalHeight || a.copyAxis !== b.copyAxis || a.copyMarks.length !== b.copyMarks.length) return false;
      for (let i = 0; i < a.copyMarks.length; i++) if (a.copyMarks[i] !== b.copyMarks[i]) return false;
    }
    return true;
  }
  function index(s, x, y) { return x < 0 || y < 0 || x >= s.width || y >= s.height ? -1 : y * s.width + x; }
  function read(s, i, style = 'live', allowed = true) {
    if (i < 0 || !allowed) return EMPTY;
    if (style === 'live' && !s.present[i]) return EMPTY;
    const p = s.present[i], colour = s.colours[i];
    return [p, p ? s.bits[i] : 0, colour, s.bold[i],
      p && colour !== 0 && (style === 'snapshot' ? colour !== 0xffffff : !s.automatic[i]) ? 1 : 0];
  }
  function raw(s, i) {
    if (i < 0) return EMPTY;
    return [s.present[i], s.present[i] ? s.bits[i] : 0, s.colours[i], s.bold[i], s.present[i]];
  }
  function calculate(kind, a, b, c = EMPTY, vertical = true) {
    const sum = a[1] + b[1] + c[1];
    const colour = a[4] ? a[2] : b[4] ? b[2] : c[4] ? c[2] : 0;
    const mixed = b[4] && b[2] !== colour || c[4] && c[2] !== colour;
    const bit = kind === 'three' ? (vertical ? +(sum === 1 || sum === 2) : +(sum === 1)) : sum % 2;
    return [1, bit, mixed ? 0 : colour, a[3] ^ b[3] ^ c[3], 0];
  }
  function calculateZero(a, b, vertical) {
    if (!a[0] && !b[0]) return [0, 0, a[2], a[3] ^ b[3], 0];
    const both = a[1] && b[1];
    return [1, a[1] ^ b[1], both ? 0 : !vertical || a[1] || !b[1] ? a[2] : b[2], a[3] ^ b[3], 0];
  }
  function put(s, i, v) {
    s.present[i] = v[0]; s.bits[i] = v[0] ? v[1] : 0;
    s.colours[i] = v[2]; s.bold[i] = v[3]; s.automatic[i] = 0;
  }
  function select(s, mask, areas) {
    s.selection.set(mask); s.areas = areas || maskAreas(s, mask);
  }
  function markYellow(s) {
    for (let i = 0; i < s.selection.length; i++) if (s.selection[i]) { s.filled[i] = 1; s.fills[i] = 0xffff00; }
  }
  function isShift(s) { return s.algorithm === 'shift' || s.algorithm === 'horr'; }
  function targets(s) {
    const seen = new Uint8Array(s.bits.length), order = [], dy = s.direction === 'down' ? 1 : -1;
    // Insertion order: VBA Selection.Areas order, then rows, columns, left/right target.
    for (const area of s.areas) each(s, area, (i, x, y) => {
      if (!s.selection[i]) return;
      for (let dx = -1; dx <= 1; dx += 2) {
        const t = index(s, x + dx, y + dy);
        if (t >= 0 && !seen[t]) { seen[t] = 1; order.push(t); }
      }
    });
    return order;
  }
  function diagonal(s) {
    const next = new Uint8Array(s.bits.length), dy = s.direction === 'down' ? -1 : 1;
    let any = false;
    for (const i of targets(s)) {
      const x = i % s.width, y = Math.floor(i / s.width);
      const l = index(s, x - 1, y + dy), r = index(s, x + 1, y + dy);
      const a = read(s, l, 'live', l >= 0 && !!s.selection[l]);
      const b = read(s, r, 'live', r >= 0 && !!s.selection[r]), c = read(s, i);
      if (!a[0] && !b[0] && !c[0]) continue;
      put(s, i, calculate(s.algorithm, a, b, c)); next[i] = 1; any = true;
    }
    if (any) select(s, next); // VBA leaves selection unchanged if no result exists.
    return any;
  }
  function expanded(s, a, direction) {
    const x = a.x, y = a.y, w = a.width, h = a.height;
    if (direction === 'down') return clip(s, { x: Math.max(0, x - 1), y, width: w + (x ? 2 : 1), height: h + 1 });
    if (direction === 'up') return y ? clip(s, { x: Math.max(0, x - 1), y: y - 1, width: w + (x ? 2 : 1), height: h + 1 }) : null;
    if (direction === 'right') return clip(s, { x, y, width: w + 1, height: h });
    return x ? clip(s, { x: x - 1, y, width: w + 1, height: h }) : null;
  }
  function pairIndices(s, a, x, y) {
    const inside = (xx, yy) => xx < a.x || xx >= a.x + a.width || yy < a.y || yy >= a.y + a.height ? -1 : index(s, xx, yy);
    if (s.direction === 'down') return [inside(x - 1, y - 1), inside(x + 1, y - 1)];
    if (s.direction === 'up') return [inside(x - 1, y + 1), inside(x + 1, y + 1)];
    return [inside(x + (s.direction === 'right' ? -1 : 1), y), inside(x, y)];
  }
  function fillPair(s, from, i, a, b) {
    const fa = a >= 0 && !!from.filled[a], fb = b >= 0 && !!from.filled[b];
    s.filled[i] = fa !== fb ? 1 : 0;
    if (s.filled[i]) s.fills[i] = from.fills[fa ? a : b];
  }
  function snapshotStep(s) {
    const next = new Uint8Array(s.bits.length), areas = [], vertical = s.direction === 'down' || s.direction === 'up';
    for (const original of s.areas) {
      const area = expanded(s, original, s.direction); if (!area) continue;
      const from = cloneSeed(s); areas.push(area);
      each(s, area, (i, x, y) => {
        next[i] = 1;
        if (s.direction === 'down' && y === area.y || s.direction === 'up' && y === area.y + area.height - 1 ||
            s.direction === 'right' && x === area.x || s.direction === 'left' && x === area.x + area.width - 1) return;
        const [a, b] = pairIndices(s, area, x, y);
        if (s.algorithm === 'background') fillPair(s, from, i, a, b);
        else put(s, i, calculateZero(read(from, a, 'snapshot'), read(from, b, 'snapshot'), vertical));
      });
    }
    if (areas.length) select(s, next, areas);
    return areas.length > 0;
  }
  function horizontal(s) {
    const next = new Uint8Array(s.bits.length), areas = [], right = s.direction === 'right';
    // VBA three's omitted boundary arguments retain their previous bold values.
    const staleBold = [0, 0, 0];
    for (const original of s.areas) {
      let area;
      if (isShift(s) && !right) area = clip(s, { ...original, width: original.width + 1 });
      else area = expanded(s, original, s.direction) || original;
      const from = cloneSeed(s); areas.push(area);
      if (isShift(s) && !right) {
        // Range.Cut moves all cell properties before the two-input calculation.
        for (let y = original.y; y < original.y + original.height; y++) {
          for (let x = original.x; x < area.x + area.width; x++) {
            const dst = index(s, x, y), src = x > original.x ? index(s, x - 1, y) : -1;
            for (const key of KEYS) if (key !== 'selection') s[key][dst] = src < 0 ? 0 : from[key][src];
          }
        }
      }
      each(s, area, (i, x, y) => {
        next[i] = 1;
        if (s.algorithm === 'three') {
          const v = [EMPTY, EMPTY, EMPTY];
          for (let k = 0; k < 3; k++) {
            const xx = right ? x - 2 + k : x + k;
            if (xx >= area.x && xx < area.x + area.width) {
              v[k] = read(from, index(s, xx, y), 'snapshot'); staleBold[k] = v[k][3];
            } else v[k] = [0, 0, 0, staleBold[k], 0];
          }
          put(s, i, calculate('three', v[0], v[1], v[2], false)); return;
        }
        if (isShift(s) && !right) {
          const local = x - original.x;
          const a = local < original.width ? raw(from, index(s, x, y)) : EMPTY;
          const b = local > 0 ? raw(from, index(s, x - 1, y)) : EMPTY;
          put(s, i, calculate('shift', a, b)); return;
        }
        if (right && x === area.x || !right && x === area.x + area.width - 1) return;
        if (!right && original.x === 0) return; // two's LEFT at first column is a no-op.
        const other = index(s, x + (right ? -1 : 1), y);
        const live = isShift(s), source = live ? s : from;
        const a = live ? raw(source, other) : read(source, other, 'snapshot');
        const b = live ? raw(source, i) : read(source, i, 'snapshot');
        put(s, i, calculate(s.algorithm, a, b));
      });
    }
    if (areas.length) select(s, next, areas);
    return areas.length > 0;
  }
  function matrixStep(s) {
    const excel = EXCEL[s.algorithm];
    if (excel) {
      if (s.done || excel.step(s) === false) { s.done = true; return; }
      s.stepCount++;
      s.excelPhase = (s.excelPhase + 1) % s.excelCycleFrames;
      if (s.excelPhase === 0) s.cycle++;
      return;
    }
    if (isShift(s)) s.filled.fill(0); // VBA clears backgrounds across the active sheet.
    let worked;
    if (s.algorithm === 'zero' || s.algorithm === 'background') worked = snapshotStep(s);
    else worked = s.direction === 'down' || s.direction === 'up' ? diagonal(s) : horizontal(s);
    if (isShift(s)) markYellow(s);
    s.stepCount++; s.done = !worked;
  }
  function copySourceRow(s, y) {
    if (s.copyRowsMirror) return 2 * s.copyAxis - y;
    const groupSize = Math.floor((1 + Math.sqrt(1 + 8 * (y - 2))) / 2);
    const groupStart = 2 + groupSize * (groupSize - 1) / 2;
    const sourceStart = groupSize - 1;
    const first = sourceStart + ((groupStart - sourceStart) & 1);
    return first - (y - groupStart);
  }
  function copyTargetAvailable(s, row, target) {
    if (s.copyRowsGaps) return !s.copyRowsProtected[target];
    return s.present[target] || (s.copyRowsOriginalHeight && row >= s.copyRowsOriginalHeight);
  }
  function mergeCopyRow(s, sourceRow, y, capture, sourceBits = s.bits) {
    const width = s.width, from = sourceRow * width, to = y * width;
    capture(y);
    // Reflection keeps the column; a half-row axis crosses the two parities.
    for (let x = 0; x < width; x++) {
      const source = from + x, target = to + x;
      if (!s.present[source] || !copyTargetAvailable(s, y, target)) continue;
      if (!s.present[target]) {
        s.present[target] = 1;
        if (s.copyRowsOriginalHeight) s.copyRowsVisibleHeight = Math.max(s.copyRowsVisibleHeight, y + 1);
      }
      const bit = sourceBits[source];
      if (s.copyRowsExcel) {
        s.bits[target] = 1 - (s.bits[target] & bit);
      } else {
        s.bits[target] ^= bit;
        s.copyMarks[target] = bit ? 1 : 2;
      }
    }
  }
  function wrapCopyRow(y, height) {
    // At odd heights the two parities have different numbers of rows.
    const parity = y & 1, count = Math.floor((height + 1 - parity) / 2);
    return parity + 2 * (Math.floor(y / 2) % count);
  }
  function hasCopyRow(s, row) {
    const start = row * s.width;
    return s.present.subarray(start, start + s.width).includes(1);
  }
  function copyLastRow(s) {
    if (s.copyRowsGaps) return s.direction === 'up' ? Math.max(0, 2 * s.copyAxis - s.height + 1) : Math.min(2 * s.copyAxis, s.height - 1);
    if (!s.copyRowsByAxis) return s.cursorRow;
    const axis = s.copyAxis;
    if (s.copyRowsExcel && !hasCopyRow(s, axis)) return axis;
    return s.copyRowsWrap || s.copyRowsOriginalHeight ? 2 * axis : Math.min(2 * axis, s.height - 1);
  }
  function visitCopyRows(s, last, visit) {
    if (s.copyRowsGaps) {
      const direction = s.direction === 'up' ? -1 : 1;
      // Sources and destinations are on opposite sides of this half-row axis,
      // so writes cannot become sources until the next frame.
      for (let y = s.cursorRow; direction > 0 ? y <= last : y >= last; y += direction)
        visit(2 * s.copyAxis - y, y);
      return;
    }
    if (!s.copyRowsByAxis) {
      visit(copySourceRow(s, last), last);
      return;
    }
    const axis = s.copyAxis;
    for (let y = axis + 1; y <= last; y++) {
      const upper = 2 * axis - y;
      if (s.copyRowsExcel) {
        if (!hasCopyRow(s, upper) || !hasCopyRow(s, y)) break;
        visit(y, upper);
      } else {
        visit(upper, y < s.height ? y : wrapCopyRow(y, s.height));
      }
    }
  }
  function visitNextCopyCells(s, { left, right, top, bottom }, visit) {
    if (s.algorithm !== 'copyRows' || s.height < (s.copyRowsGaps ? 2 : 3) || left >= right || top >= bottom) return;
    visitCopyRows(s, copyLastRow(s), (sourceRow, targetRow) => {
      if ((sourceRow < top || sourceRow >= bottom) && (targetRow < top || targetRow >= bottom)) return;
      const from = sourceRow * s.width, to = targetRow * s.width;
      for (let x = left; x < right; x++) {
        if (s.present[from + x] && copyTargetAvailable(s, targetRow, to + x)) visit(sourceRow, targetRow, x);
      }
    });
  }
  function scanCopyRows(s, capture) {
    if (s.height < (s.copyRowsGaps ? 2 : 3)) { s.done = true; return; }
    const last = copyLastRow(s);
    // Wrapped destinations may also be sources for this frame.
    const sourceBits = last >= s.height ? s.bits.slice(0, s.copyAxis * s.width) : s.bits;
    visitCopyRows(s, last, (from, to) => {
      mergeCopyRow(s, from, to, capture, sourceBits);
      s.rowCount++;
    });
    if (s.copyRowsGaps) {
      s.copyAxis += s.direction === 'up' ? -1 : 1;
      if (s.copyAxis < 0 || s.copyAxis > s.height - 1) {
        s.copyAxis = s.direction === 'up' ? s.height - 1.5 : 0.5;
        s.cycle++;
      }
      s.cursorRow = s.direction === 'up' ? Math.floor(s.copyAxis) : Math.ceil(s.copyAxis);
    } else if (s.copyRowsByAxis) {
      s.copyAxis++;
      if (s.copyAxis === (s.copyRowsOriginalHeight || s.height) - (s.copyRowsWrap ? 0 : 1)) { s.copyAxis = 1; s.cycle++; }
      s.cursorRow = s.copyRowsWrap ? wrapCopyRow(s.copyAxis + 1, s.height) : s.copyAxis + 1;
    } else {
      s.cursorRow++;
      if (s.cursorRow === s.height) {
        s.copyAxis = 1;
        s.cursorRow = 2;
        s.cycle++;
      } else if (s.copyRowsMirror && s.cursorRow > 2 * s.copyAxis) {
        s.copyAxis++;
        s.cursorRow = s.copyAxis + 1;
      }
    }
    s.stepCount++;
    s.done = false;
  }
  function scanRow(s, capture) {
    if (s.height < 2) { s.done = true; return; }
    const y = s.cursorRow;
    if (s._scanSelectionRows === null) {
      // Only the first scan after create/reset may carry an arbitrary seed mask.
      // Subsequent frames hold selection in one row, independent of field height.
      const rows = new Set();
      for (const a of s.areas) for (let r = a.y; r < a.y + a.height; r++) rows.add(r);
      s._scanSelectionRows = [...rows];
    }
    for (const row of s._scanSelectionRows) {
      capture(row);
      s.selection.fill(0, row * s.width, (row + 1) * s.width);
    }
    capture(y);
    // A row is atomic. All parents are existing cells of the preceding row;
    // targets comprise the existing row plus one diagonal extension of parents.
    for (let x = 0; x < s.width; x++) {
      const i = y * s.width + x, l = index(s, x - 1, y - 1), r = index(s, x + 1, y - 1);
      const background = s.algorithm === 'background';
      const has = j => j >= 0 && (s.present[j] || background && s.filled[j]);
      if (!has(i) && !has(l) && !has(r)) continue;
      s.selection[i] = 1;
      if (background) fillPair(s, s, i, l, r);
      else {
        const a = read(s, l), b = read(s, r);
        put(s, i, s.algorithm === 'zero' ? calculateZero(a, b, true) : calculate(s.algorithm, a, b, read(s, i)));
      }
    }
    const areas = [];
    for (let x = 0; x < s.width;) {
      if (!s.selection[y * s.width + x]) { x++; continue; }
      const left = x;
      while (x < s.width && s.selection[y * s.width + x]) x++;
      areas.push({ x: left, y, width: x - left, height: 1 });
    }
    s.areas = areas;
    s._scanSelectionRows = areas.length ? [y] : [];
    s.stepCount++; s.rowCount++;
    s.cursorRow++;
    if (s.cursorRow >= s.height) { s.cursorRow = 1; s.cycle++; }
    s.done = false;
  }
  function bounds(s) {
    if (s.scan) return areaBounds(s.areas);
    let x = s.width, y = s.height, right = -1, bottom = -1;
    for (let i = 0; i < s.selection.length; i++) if (s.selection[i]) {
      const xx = i % s.width, yy = Math.floor(i / s.width);
      x = Math.min(x, xx); y = Math.min(y, yy); right = Math.max(right, xx); bottom = Math.max(bottom, yy);
    }
    return right < 0 ? null : { x, y, width: right - x + 1, height: bottom - y + 1 };
  }
  function report(s, before) {
    let changed = 0;const changedCells=s.trackChanges?[]:null;
    const {bits,present,colours,bold,automatic,fills,filled,selection}=s;
    for (let i = 0; i < s.bits.length; i++) {
      if (before.bits[i] !== bits[i] || before.present[i] !== present[i] || before.colours[i] !== colours[i] ||
          before.bold[i] !== bold[i] || before.automatic[i] !== automatic[i] || before.fills[i] !== fills[i] ||
          before.filled[i] !== filled[i] || before.selection[i] !== selection[i]) changed++;
      if(changedCells&&visualChanged(s,before,i,i))changedCells.push(i);
    }
    return { changed, done: s.done, rows: s.rowCount, steps: s.stepCount,
      cursorRow: s.cursorRow, cycle: s.cycle, bounds: bounds(s),...(changedCells?{changedCells}:{}) };
  }
  function visualChanged(s,before,i,j){
    if(s.copyRowsGaps&&before.copyMarks&&s.copyMarks[i]!==before.copyMarks[j])return true;
    if(s.present[i]!==before.present[j]||s.filled[i]!==before.filled[j])return true;
    if(s.present[i]&&(s.bits[i]!==before.bits[j]||s.colours[i]!==before.colours[j]||
        s.bold[i]!==before.bold[j]||s.automatic[i]!==before.automatic[j]))return true;
    return !!s.filled[i]&&s.fills[i]!==before.fills[j];
  }
  function advance(s, n = 1) {
    count(n);
    if (s.scan) return advanceScan(s, n);
    const before = cloneSeed(s);
    for (let i = 0; i < n; i++) {
      matrixStep(s);
      if (s.done) break;
    }
    return report(s, before);
  }
  function advanceScan(s, n) {
    // Save each touched row once per call. A one-frame advance copies/compares
    // only the receiving row and previous selection row, never the whole field.
    // Replay consumes no intermediate raster reports and materializes the
    // complete final field. Keep its exact steps while omitting row snapshots.
    const trackDirty = !(s.algorithm === 'copyRows' && s.trackDirtyRows === false && !s.trackChanges);
    const beforeRows = new Map();
    const keys = s.copyRowsGaps ? (s.trackChanges ? [...KEYS, 'copyMarks'] : ['bits', 'present', 'copyMarks']) :
      s.algorithm === 'copyRows' && !s.trackChanges ? (s.copyRowsOriginalHeight ? ['bits', 'present'] : ['bits']) : KEYS;
    const capture = row => {
      if (!trackDirty) return;
      if (beforeRows.has(row)) return;
      const start = row * s.width, end = start + s.width, copy = {};
      for (const key of keys) copy[key] = s[key].slice(start, end);
      beforeRows.set(row, copy);
    };
    for (let i = 0; i < n; i++) {
      if (s.algorithm === 'copyRows') scanCopyRows(s, capture);
      else scanRow(s, capture);
      if (s.done) break;
    }
    let changed = 0;const changedCells=s.trackChanges?[]:null;
    const dirtyRows = [];
    for (const [row, before] of beforeRows) {
      const start = row * s.width; let dirty = false;
      for (let x = 0; x < s.width; x++) {
        for (const key of keys) if (before[key][x] !== s[key][start + x]) {
          changed++; dirty = true; break;
        }
        if(changedCells&&visualChanged(s,before,start+x,x))changedCells.push(start+x);
      }
      if (dirty) dirtyRows.push(row);
    }
    dirtyRows.sort((a, b) => a - b);
    return { changed: trackDirty ? changed : null, done: s.done, rows: s.rowCount, steps: s.stepCount,
      cursorRow: s.cursorRow, cycle: s.cycle, bounds: areaBounds(s.areas), dirtyRows: trackDirty ? dirtyRows : null,
      ...(!trackDirty ? { dirtyTracking: false } : {}),
      ...(s.copyRowsGaps ? { copyRowsGaps: true, copyAxis: s.copyAxis } : {}),...(changedCells?{changedCells}:{}) };
  }
  function areaBounds(areas) {
    let selectedBounds = null;
    for (const a of areas) {
      if (!selectedBounds) selectedBounds = { ...a };
      else {
        const right = Math.max(selectedBounds.x + selectedBounds.width, a.x + a.width);
        const bottom = Math.max(selectedBounds.y + selectedBounds.height, a.y + a.height);
        selectedBounds.x = Math.min(selectedBounds.x, a.x);
        selectedBounds.y = Math.min(selectedBounds.y, a.y);
        selectedBounds.width = right - selectedBounds.x;
        selectedBounds.height = bottom - selectedBounds.y;
      }
    }
    return selectedBounds;
  }
  function stepRows(s, n = 1) {
    if (!s.scan) throw new Error('stepRows requires scan=true');
    return advance(s, n);
  }
  function seek(s, frame) { count(frame); reset(s); return advance(s, frame); }
  return { create, cloneSeed, snapshot, reset, advance, stepRows, seek, bounds, forkInitial, sameState,
    copyRowsCycleFrames, visitNextCopyCells, excelAlgorithms: EXCEL_ALGORITHMS.slice(),
    excelCycleFrames: (seed, options) => EXCEL[options.algorithm].cycleFrames(seed, options),
    excelConeOrigin: Shapes.coneOrigin,
    interxorWidth: (seed, options) => Interxor.requiredWidth(seed, options),
    algorithms: ALGORITHMS.slice(), directions: DIRECTIONS.slice() };
});
