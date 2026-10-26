/* v1. Exact source-field counts. Empty (-1) is never counted as zero.
   No source buffers or past fields are retained. A cycle includes frames 0..W-1. */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HubCompareStats = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const EVENT_KEYS = ['balanceLeft', 'balanceRight', 'balanceBoth', 'countsEqual',
    'fieldsEqual', 'fieldsMirrorEqual', 'cumulativeBalanceLeft', 'cumulativeBalanceRight',
    'cumulativeBalanceBoth', 'cumulativeCountsEqual', 'areasShared', 'areasEqual',
    'namedAreasEqual', 'areaSumsEqual', 'repeatedAreasLeft', 'repeatedAreasRight', 'cumulativeAreaSumsEqual'];
  function counts(ones, zeros, empty) {
    const occupied = ones + zeros;
    return { ones, zeros, empty, occupied, delta: ones - zeros,
      balanced: occupied > 0 && ones === zeros };
  }
  function same(a, b) { return a.ones === b.ones && a.zeros === b.zeros && a.empty === b.empty; }
  function sum(a, b) { return counts(a.ones + b.ones, a.zeros + b.zeros, a.empty + b.empty); }
  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function ranges(frames) {
    const result = [];
    for (const frame of frames) {
      const last = result[result.length - 1];
      if (last && frame === last[1] + 1) last[1] = frame;
      else result.push([frame, frame]);
    }
    return result;
  }
  function formatFrames(frames) {
    return ranges(frames).map(pair => pair[0] === pair[1] ? String(pair[0]) : pair[0] + '–' + pair[1]).join(', ');
  }
  function createTracker(options) {
    const W = options && options.W, H = options && options.H;
    if (!Number.isSafeInteger(W) || W < 1 || !Number.isSafeInteger(H) || H < 1 || !Number.isSafeInteger(W * H)) {
      throw new RangeError('W and H must be positive safe integers');
    }
    const size = W * H;
    let active = null, previousCycle = null, current = null;
    function newCycle(id) {
      const events = {};
      EVENT_KEYS.forEach(key => { events[key] = []; });
      return { id, frames: 0, complete: false, totals: {
        left: counts(0, 0, 0), right: counts(0, 0, 0), countsEqual: true
      }, areas: { frames: 0, left: { figureCount: 0, sum: 0 }, right: { figureCount: 0, sum: 0 }, sumsEqual: false }, events };
    }
    function cycleSnapshot(cycle, includeFrames) {
      if (!cycle) return null;
      const result = clone(cycle);
      EVENT_KEYS.forEach(key => {
        const frames = result.events[key];
        result.events[key] = { count: frames.length, frames, ranges: ranges(frames) };
        if (includeFrames === false) delete result.events[key].frames;
      });
      return result;
    }
    function record(input) {
      const { left, right, frame } = input || {};
      const areas = input && input.areas;
      const cycle = input && input.cycle !== undefined ? input.cycle : 0;
      if (!Number.isSafeInteger(cycle) || cycle < 0) throw new RangeError('cycle must be a nonnegative integer');
      if (!Number.isInteger(frame) || frame < 0 || frame >= W) throw new RangeError('frame must be in 0..W-1');
      if (!left || !right || left.length !== size || right.length !== size) throw new RangeError('source field size mismatch');
      if (active && cycle === active.id && frame !== active.frames) throw new RangeError('duplicate or out-of-order frame');
      if ((!active || cycle !== active.id) && frame !== 0) throw new RangeError('a cycle must start at frame 0');
      if (active && cycle !== active.id && (!active.complete || cycle <= active.id)) throw new RangeError('complete the current cycle before starting the next');
      if (areas) for (const side of ['left', 'right']) {
        if (!areas[side] || !Number.isSafeInteger(areas[side].figureCount) || areas[side].figureCount < 0 ||
            !Number.isSafeInteger(areas[side].sum) || areas[side].sum < 0) throw new TypeError('invalid area summary');
      }
      let lo = 0, lz = 0, le = 0, ro = 0, rz = 0, re = 0;
      let fieldsEqual = true, fieldsMirrorEqual = true;
      // One pass counts both fields and compares direct/reflected positions.
      for (let row = 0; row < H; row++) {
        const base = row * W;
        for (let col = 0; col < W; col++) {
          const i = base + col, a = left[i], b = right[i];
          if (a === 1) lo++; else if (a === 0) lz++; else if (a === -1) le++;
          else throw new TypeError('left field must contain only -1, 0, 1');
          if (b === 1) ro++; else if (b === 0) rz++; else if (b === -1) re++;
          else throw new TypeError('right field must contain only -1, 0, 1');
          if (a !== b) fieldsEqual = false;
          if (fieldsMirrorEqual && a !== right[base + W - 1 - col]) fieldsMirrorEqual = false;
        }
      }
      // Validation is atomic: a rejected record leaves history unchanged.
      if (!active || cycle !== active.id) {
        if (active) previousCycle = cycleSnapshot(active);
        active = newCycle(cycle);
      }
      const lc = counts(lo, lz, le), rc = counts(ro, rz, re);
      active.totals.left = sum(active.totals.left, lc);
      active.totals.right = sum(active.totals.right, rc);
      active.totals.countsEqual = same(active.totals.left, active.totals.right);
      const flags = { balanceLeft: lc.balanced, balanceRight: rc.balanced,
        balanceBoth: lc.balanced && rc.balanced, countsEqual: same(lc, rc),
        fieldsEqual, fieldsMirrorEqual,
        cumulativeBalanceLeft: active.totals.left.balanced,
        cumulativeBalanceRight: active.totals.right.balanced,
        cumulativeBalanceBoth: active.totals.left.balanced && active.totals.right.balanced,
        cumulativeCountsEqual: active.totals.countsEqual };
      if (areas) {
        active.areas.frames++;
        for (const side of ['left', 'right']) {
          active.areas[side].figureCount += areas[side].figureCount;
          active.areas[side].sum += areas[side].sum;
        }
        const any = areas.left.figureCount > 0 && areas.right.figureCount > 0;
        active.areas.sumsEqual = active.areas.left.figureCount > 0 && active.areas.right.figureCount > 0 && active.areas.left.sum === active.areas.right.sum;
        flags.areasShared = any && Array.isArray(areas.shared) && areas.shared.length > 0;
        flags.areasEqual = any && areas.histogramEqual === true;
        flags.namedAreasEqual = any && areas.namedHistogramEqual === true;
        flags.areaSumsEqual = any && areas.left.sum === areas.right.sum;
        flags.repeatedAreasLeft = Array.isArray(areas.left.repeated) && areas.left.repeated.length > 0;
        flags.repeatedAreasRight = Array.isArray(areas.right.repeated) && areas.right.repeated.length > 0;
        flags.cumulativeAreaSumsEqual = active.areas.sumsEqual;
      }
      EVENT_KEYS.forEach(key => { if (flags[key]) active.events[key].push(frame); });
      active.frames++;
      active.complete = active.frames === W;
      current = { frame, cycle, left: lc, right: rc, countsEqual: flags.countsEqual,
        fieldsEqual, fieldsMirrorEqual, cumulative: clone(active.totals) };
      if (areas) { current.areas = clone(areas); current.cumulativeAreas = clone(active.areas); }
      return clone(current);
    }
    return {
      record,
      snapshot: function (options) {
        const includeFrames = !options || options.includeFrames !== false;
        const previous = clone(previousCycle);
        if (previous && !includeFrames) EVENT_KEYS.forEach(key => { delete previous.events[key].frames; });
        return { W, H, current: clone(current), cycle: cycleSnapshot(active, includeFrames), previousCycle: previous };
      },
      reset: function () { active = null; previousCycle = null; current = null; }
    };
  }
  return { createTracker, formatFrames };
});
