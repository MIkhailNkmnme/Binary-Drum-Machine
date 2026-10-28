/* v2. Exact source-field counts for three fields: 5.7 cones, 5.9 both sides,
   5.8 full field. The old 5.7/5.8 pair is kept; the middle field and all-three
   events are added. Empty (-1) is never counted as zero.
   No source buffers or past fields are retained. A cycle includes frames 0..W-1. */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HubCompareStats = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const EVENT_KEYS = ['balanceLeft', 'balanceMiddle', 'balanceRight', 'balanceBoth', 'balanceAll',
    'countsEqual', 'countsEqualAll',
    'fieldsEqual', 'fieldsEqualAll', 'fieldsMirrorEqual', 'fieldsMirrorEqualAll',
    'cumulativeBalanceLeft', 'cumulativeBalanceMiddle', 'cumulativeBalanceRight', 'cumulativeBalanceBoth', 'cumulativeBalanceAll',
    'cumulativeCountsEqual', 'cumulativeCountsEqualAll', 'areasShared', 'areasSharedAll',
    'areasEqual', 'areasEqualAll', 'namedAreasEqual', 'namedAreasEqualAll',
    'areaSumsEqual', 'areaSumsEqualAll', 'repeatedAreasLeft', 'repeatedAreasMiddle', 'repeatedAreasRight',
    'cumulativeAreaSumsEqual', 'cumulativeAreaSumsEqualAll'];
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
    let active = null, previousCycle = null, current = null, allowPartial = false;
    function newCycle(id, hasMiddle, startFrame = 0) {
      const events = {};
      EVENT_KEYS.forEach(key => { events[key] = []; });
      return { id, hasMiddle, startFrame, partial: startFrame !== 0, next: startFrame, frames: 0, complete: false, totals: {
        left: counts(0, 0, 0), middle: hasMiddle ? counts(0, 0, 0) : null, right: counts(0, 0, 0),
        countsEqual: true, countsEqualAll: false
      }, areas: { frames: 0, left: { figureCount: 0, sum: 0 }, middle: hasMiddle ? { figureCount: 0, sum: 0 } : null,
        right: { figureCount: 0, sum: 0 }, sumsEqual: false, sumsEqualAll: false }, events };
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
      const { left, middle, right, frame } = input || {};
      const hasMiddle = middle != null;
      const areas = input && input.areas;
      const cycle = input && input.cycle !== undefined ? input.cycle : 0;
      if (!Number.isSafeInteger(cycle) || cycle < 0) throw new RangeError('cycle must be a nonnegative integer');
      if (!Number.isInteger(frame) || frame < 0 || frame >= W) throw new RangeError('frame must be in 0..W-1');
      if (!left || !right || left.length !== size || right.length !== size) throw new RangeError('source field size mismatch');
      if (hasMiddle && middle.length !== size) throw new RangeError('middle field size mismatch');
      if (active && active.hasMiddle !== hasMiddle) throw new RangeError('middle field must be consistent within a cycle');
      if (active && cycle === active.id && active.complete) throw new RangeError('duplicate or out-of-order frame');
      if (active && cycle === active.id && frame !== active.next) throw new RangeError('duplicate or out-of-order frame');
      if ((!active || cycle !== active.id) && frame !== 0 && !(allowPartial && frame !== 0)) throw new RangeError('a cycle must start at frame 0');
      if (active && cycle !== active.id && (cycle <= active.id || (!active.complete && active.next !== 0))) throw new RangeError('complete the current cycle before starting the next');
      for (const side of hasMiddle ? ['left', 'middle', 'right'] : ['left', 'right']) {
        if (areas && (!areas[side] || !Number.isSafeInteger(areas[side].figureCount) || areas[side].figureCount < 0 ||
            !Number.isSafeInteger(areas[side].sum) || areas[side].sum < 0)) throw new TypeError('invalid area summary');
      }
      let lo = 0, lz = 0, le = 0, mo = 0, mz = 0, me = 0, ro = 0, rz = 0, re = 0;
      let fieldsEqual = true, fieldsMirrorEqual = true;
      let fieldsEqualML = true, fieldsMirrorEqualML = true, fieldsEqualMR = true, fieldsMirrorEqualMR = true;
      // One pass counts the fields and compares direct/reflected positions.
      for (let row = 0; row < H; row++) {
        const base = row * W, flip = base + W - 1;
        for (let col = 0; col < W; col++) {
          const i = base + col, a = left[i], c = right[i], b = hasMiddle ? middle[i] : 0;
          if (a === 1) lo++; else if (a === 0) lz++; else if (a === -1) le++;
          else throw new TypeError('left field must contain only -1, 0, 1');
          if (c === 1) ro++; else if (c === 0) rz++; else if (c === -1) re++;
          else throw new TypeError('right field must contain only -1, 0, 1');
          if (a !== c) fieldsEqual = false;
          if (fieldsMirrorEqual && a !== right[flip - col]) fieldsMirrorEqual = false;
          if (hasMiddle) {
            if (b === 1) mo++; else if (b === 0) mz++; else if (b === -1) me++;
            else throw new TypeError('middle field must contain only -1, 0, 1');
            if (a !== b) fieldsEqualML = false;
            if (b !== c) fieldsEqualMR = false;
            if (fieldsMirrorEqualML && a !== middle[flip - col]) fieldsMirrorEqualML = false;
            if (fieldsMirrorEqualMR && b !== right[flip - col]) fieldsMirrorEqualMR = false;
          }
        }
      }
      // Validation is atomic: a rejected record leaves history unchanged.
      if (!active || cycle !== active.id) {
        if (active) previousCycle = cycleSnapshot(active);
        active = newCycle(cycle, hasMiddle, frame);
        allowPartial = false;
      }
      const lc = counts(lo, lz, le), rc = counts(ro, rz, re), mc = hasMiddle ? counts(mo, mz, me) : null;
      active.totals.left = sum(active.totals.left, lc);
      active.totals.right = sum(active.totals.right, rc);
      if (mc) active.totals.middle = sum(active.totals.middle, mc);
      active.totals.countsEqual = same(active.totals.left, active.totals.right);
      active.totals.countsEqualAll = !!mc && same(active.totals.left, active.totals.middle) && same(active.totals.middle, active.totals.right);
      const flags = {
        balanceLeft: lc.balanced, balanceMiddle: !!mc && mc.balanced, balanceRight: rc.balanced,
        balanceBoth: lc.balanced && rc.balanced,
        balanceAll: !!mc && lc.balanced && mc.balanced && rc.balanced,
        countsEqual: same(lc, rc),
        countsEqualAll: !!mc && same(lc, mc) && same(mc, rc),
        fieldsEqual, fieldsEqualAll: !!mc && fieldsEqual && fieldsEqualML && fieldsEqualMR,
        fieldsMirrorEqual, fieldsMirrorEqualAll: !!mc && fieldsMirrorEqual && fieldsMirrorEqualML && fieldsMirrorEqualMR,
        cumulativeBalanceLeft: active.totals.left.balanced,
        cumulativeBalanceMiddle: !!mc && active.totals.middle.balanced,
        cumulativeBalanceRight: active.totals.right.balanced,
        cumulativeBalanceBoth: active.totals.left.balanced && active.totals.right.balanced,
        cumulativeBalanceAll: !!mc && active.totals.left.balanced && active.totals.middle.balanced && active.totals.right.balanced,
        cumulativeCountsEqual: active.totals.countsEqual,
        cumulativeCountsEqualAll: active.totals.countsEqualAll };
      if (areas) {
        active.areas.frames++;
        for (const side of hasMiddle ? ['left', 'middle', 'right'] : ['left', 'right']) {
          active.areas[side].figureCount += areas[side].figureCount;
          active.areas[side].sum += areas[side].sum;
        }
        const any = areas.left.figureCount > 0 && areas.right.figureCount > 0;
        const anyAll = any && !!mc && areas.middle.figureCount > 0;
        // Cumulative sums, not the current frame: the event is about cycle totals.
        active.areas.sumsEqual = active.areas.left.figureCount > 0 && active.areas.right.figureCount > 0 &&
          active.areas.left.sum === active.areas.right.sum;
        active.areas.sumsEqualAll = !!mc && active.areas.left.figureCount > 0 && active.areas.middle.figureCount > 0 &&
          active.areas.right.figureCount > 0 && active.areas.left.sum === active.areas.middle.sum &&
          active.areas.middle.sum === active.areas.right.sum;
        flags.areasShared = any && Array.isArray(areas.shared) && areas.shared.length > 0;
        flags.areasSharedAll = anyAll && Array.isArray(areas.sharedAll) && areas.sharedAll.length > 0;
        flags.areasEqual = any && areas.histogramEqual === true;
        flags.areasEqualAll = anyAll && areas.histogramEqualAll === true;
        flags.namedAreasEqual = any && areas.namedHistogramEqual === true;
        flags.namedAreasEqualAll = anyAll && areas.namedHistogramEqualAll === true;
        flags.areaSumsEqual = any && areas.left.sum === areas.right.sum;
        flags.areaSumsEqualAll = anyAll && areas.left.sum === areas.middle.sum && areas.middle.sum === areas.right.sum;
        flags.repeatedAreasLeft = Array.isArray(areas.left.repeated) && areas.left.repeated.length > 0;
        flags.repeatedAreasMiddle = !!areas.middle && Array.isArray(areas.middle.repeated) && areas.middle.repeated.length > 0;
        flags.repeatedAreasRight = Array.isArray(areas.right.repeated) && areas.right.repeated.length > 0;
        flags.cumulativeAreaSumsEqual = active.areas.sumsEqual;
        flags.cumulativeAreaSumsEqualAll = active.areas.sumsEqualAll;
      }
      EVENT_KEYS.forEach(key => { if (flags[key]) active.events[key].push(frame); });
      active.frames++;
      active.next = (frame + 1) % W;
      active.complete = active.next === 0;
      current = { frame, cycle, left: lc, middle: mc, right: rc,
        countsEqual: flags.countsEqual, countsEqualAll: flags.countsEqualAll,
        fieldsEqual, fieldsEqualAll: flags.fieldsEqualAll,
        fieldsMirrorEqual, fieldsMirrorEqualAll: flags.fieldsMirrorEqualAll,
        cumulative: clone(active.totals) };
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
      reset: function () { active = null; previousCycle = null; current = null; allowPartial = false; },
      // Плеер не считает статистику, пока панель закрыта. При открытии
      // счёт начинается с текущего кадра — цикл может быть неполным.
      startFrom: function () { active = null; previousCycle = null; current = null; allowPartial = true; }
    };
  }
  return { createTracker, formatFrames };
});
