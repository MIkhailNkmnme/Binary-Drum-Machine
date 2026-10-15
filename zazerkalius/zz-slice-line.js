/* Instant slicing through the exact zero-width seam of ring 1. */
const ZZSliceLine = (() => {
  "use strict";
  const Q = ZZExact.from, QUARTER = Q(1, 4);
  const gate = state => state.rings[0].phaseQ.add(state.spinQ).sub(QUARTER);
  const aligned = (state, angle) => gate(state).sub(angle).mod().eq(0);
  // Exclude the start and include the end: shared frame edges fire once.
  function* crossings(start, end, angle) {
    const a = Q(start).sub(angle), delta = Q(end).sub(start);
    if (!delta.sign()) return;
    if (delta.sign() > 0) {
      const last = a.add(delta).floor();
      for (let n = a.floor() + 1n; n <= last; n++) yield Q(n).sub(a).div(delta);
    } else {
      const last = a.add(delta).ceil();
      for (let n = a.ceil() - 1n; n >= last; n--) yield Q(n).sub(a).div(delta);
    }
  }
  function cut(slicing, state, angle, onCut, limit = state.rings.length, start = 1, onRepeat) {
    if (!aligned(state, angle)) return false;
    for (let k = Math.max(0,start); k < Math.min(state.rings.length,limit); k++) {
      const raw = Q(angle).sub(state.rings[k].phaseQ).sub(state.spinQ).mod();
      for (const collection of [slicing.cuts, slicing.completedCuts]) {
        const list = collection[k] || (collection[k] = []);
        if (!list.some(value => value.eq(raw))) {
          list.push(raw);
          if (collection === slicing.cuts && onCut) onCut(k, raw);
        } else if (collection === slicing.cuts && onRepeat) onRepeat(k,raw);
      }
    }
    return true;
  }
  return {gate, aligned, crossings, cut};
})();
