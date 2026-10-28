/* v2. Geometric areas from Mayatnik areaCalc/areaFigs, on the finite Hub source grids.
   v2: три поля — 5.7 конусы, 5.9 обе стороны, 5.8 всё поле; сравнения пары 5.7/5.8
   сохранены, добавлены общие площади и равенство всех трёх.
   Source figures overlap: their summed areas are not a partition of the field. */
(function (root) {
  'use strict';

  const NAMES = {
    top: 'верх', upperLeft: 'треугольник ◁', upperRight: 'треугольник ▷',
    cornerLeft: 'угол ◁', cornerRight: 'угол ▷', sawLeft: 'пила ◁',
    sawRight: 'пила ▷', innerLeft: 'пила внутри ◁', innerRight: 'пила внутри ▷'
  };

  function createAnalyzer() {
    let width = 0, height = 0, prefix, heights, covered, nextCandidate, heightHeads, coverLo, coverHi;
    function prepare(W, H) {
      if (W === width && H === height) return;
      width = W; height = H;
      prefix = new Uint32Array((W + 1) * H);
      heights = new Uint32Array(W * H);
      covered = new Uint8Array(W * H);
      nextCandidate = new Int32Array(W * H);
      heightHeads = new Int32Array(H + 1);
      coverLo = new Int32Array(H); coverHi = new Int32Array(H);
    }

    function analyzeSide(values, W, H, X, Y, saw, sawFull) {
      const byFigure = new Map(), upper = [0, 0, 0, 0, 0];
      const stride = W + 1;
      covered.fill(0);
      coverLo.fill(W); coverHi.fill(-1);
      // A zero-only height DP is equivalent to areaCalc's all-bit DP for its
      // selected zero triangles. Scratch storage is reused between sources.
      for (let r = 0; r < H; r++) {
        let count = 0;
        const base = r * W, pre = r * stride;
        prefix[pre] = 0;
        for (let c = 0; c < W; c++) {
          const i = base + c, v = values[i], occupied = v >= 0;
          prefix[pre + c + 1] = count += occupied ? 1 : 0;
          heights[i] = v !== 0 ? 0 : r > 0 && c > 0 && c < W - 1
            ? 1 + Math.min(heights[i - W - 1], heights[i - W], heights[i - W + 1]) : 1;
          if (r > 0 && Math.abs(c - X) < Y - r) {
            if (occupied) upper[0]++;
            if (c !== X) upper[1 + (occupied ? 0 : 2) + (c < X ? 0 : 1)]++;
          }
        }
      }
      const add = (kind, n, name = NAMES[kind]) => {
        if (!n) return;
        const key = kind + ':' + n, entry = byFigure.get(key);
        if (entry) entry.count++;
        else byFigure.set(key, { kind, name, n, count: 1 });
      };
      ['top', 'upperLeft', 'upperRight', 'cornerLeft', 'cornerRight'].forEach((kind, i) => add(kind, upper[i]));

      // Height buckets preserve h descending, then r/c ascending, without
      // allocating/sorting millions of candidate objects on nearly zero fields.
      heightHeads.fill(-1);
      for (let r = H - 1; r >= Math.max(0, Math.floor(Y) + 1); r--) {
        for (let c = W - 1; c >= 0; c--) {
          const i = r * W + c, h = heights[i];
          if (h >= 4 && (r + 1 === H || heights[i + W] !== h + 1)) {
            nextCandidate[i] = heightHeads[h]; heightHeads[h] = i;
          }
        }
      }
      const triangles = [];
      for (let h = H; h >= 4; h--) for (let i = heightHeads[h]; i >= 0; i = nextCandidate[i]) {
        if (covered[i]) continue;
        const t = { h, r: Math.floor(i / W), c: i % W };
        triangles.push(t);
        // Original nesting rule tests the apex against earlier (larger) ▼.
        // A coverage bitmap makes that test constant time, without a 60 limit.
        for (let r = t.r - t.h + 1; r <= t.r; r++) {
          const d = t.r - r, lo = t.c - d, hi = t.c + d, base = r * W;
          if (coverHi[r] < 0) {
            covered.fill(1, base + lo, base + hi + 1);
            coverLo[r] = lo; coverHi[r] = hi;
          } else if (coverLo[r] >= 0 && lo <= coverHi[r] + 1 && hi >= coverLo[r] - 1) {
            // Common large overlapping triangles only extend an existing row
            // interval. Avoid repeatedly writing the already covered interior.
            if (lo < coverLo[r]) covered.fill(1, base + lo, base + coverLo[r]);
            if (hi > coverHi[r]) covered.fill(1, base + coverHi[r] + 1, base + hi + 1);
            coverLo[r] = Math.min(lo, coverLo[r]); coverHi[r] = Math.max(hi, coverHi[r]);
          } else {
            covered.fill(1, base + lo, base + hi + 1); coverLo[r] = -1;
          }
        }
      }

      // Convex polygon row intervals with strict edges: exactly cellIn(P,c,r),
      // but occupied cells are counted by prefix sums instead of cell arrays.
      function poly(kind, P, half = 0, name) {
        let area2 = 0, y0 = Infinity, y1 = -Infinity;
        for (let i = 0; i < P.length; i++) {
          const a = P[i], b = P[(i + 1) % P.length];
          area2 += a[0] * b[1] - a[1] * b[0];
          y0 = Math.min(y0, a[1]); y1 = Math.max(y1, a[1]);
        }
        if (!area2) return;
        const sign = Math.sign(area2);
        let n = 0;
        for (let r = Math.max(0, Math.floor(y0)); r <= Math.min(H - 1, Math.ceil(y1)); r++) {
          let lo = 0, hi = W - 1;
          for (let i = 0; i < P.length && lo <= hi; i++) {
            const a = P[i], b = P[(i + 1) % P.length];
            const A = sign * (a[1] - b[1]);
            const B = sign * ((b[0] - a[0]) * (r - a[1]) + (b[1] - a[1]) * a[0]);
            if (A > 0) lo = Math.max(lo, Math.floor(-B / A) + 1);
            else if (A < 0) hi = Math.min(hi, Math.ceil(-B / A) - 1);
            else if (B <= 0) hi = -1;
          }
          if (half) {
            lo = Math.max(lo, Math.floor(X - (r - Y)) + 1);
            hi = Math.min(hi, Math.ceil(X + (r - Y)) - 1);
            if (half > 0) lo = Math.max(lo, Math.floor(X) + 1);
            else hi = Math.min(hi, Math.ceil(X) - 1);
          }
          if (lo <= hi) n += prefix[r * stride + hi + 1] - prefix[r * stride + lo];
        }
        add(kind, n, name);
      }

      const ry = Math.max(0, Math.min(H - 1, Math.round(Y)));
      let eL = -1, eR = -1;
      for (let c = 0; c < W; c++) if (values[ry * W + c] >= 0) {
        if (eL < 0) eL = c;
        eR = c;
      }
      if (eR >= 0 && Y > ry) { eL -= Y - ry; eR += Y - ry; }
      const edges = eR < 0 ? [] : [
        { e: eL - .5, sg: -1, t: Math.abs(eL - .5 - X) / 2, kind: 'sawLeft', inner: 'innerLeft' },
        { e: eR + .5, sg: 1, t: Math.abs(eR + .5 - X) / 2, kind: 'sawRight', inner: 'innerRight' }
      ];
      function tooth(cx, cy, sg, t) {
        const o = cx + sg * t;
        return [
          [[cx, cy], [cx, cy + t], [o, cy + t]],
          [[cx, cy + t], [cx, cy + 2 * t], [o, cy + t]],
          [[cx, cy + 2 * t], [o, cy + t], [o, cy + 2 * t]],
          [[cx, cy + 2 * t], [o, cy + 2 * t], [o, cy + 3 * t]]
        ];
      }
      if (saw) for (const { e, sg, t, kind } of edges) {
        if (t < .5) continue;
        for (let k = -2; Y + k * t < H; k++) {
          const cy = Y + k * t, parts = tooth(e + sg * k * t, cy, sg, t);
          if (k > -2) { poly(kind, parts[0]); poly(kind, parts[1]); }
          if (cy + t < H) { poly(kind, parts[2]); poly(kind, parts[3]); }
        }
      }
      // Same fallback as areaFigs: inner saw exists only without any selected ▼.
      // Bounds are geometric, with neither the visual 4096 nor 60000 safety cap.
      if (saw && sawFull && !triangles.length) {
        for (const { e, sg, t, inner } of edges) {
          if (t < .5) continue;
          const K = Math.ceil((H - Y) / (2 * t)) + 2;
          for (let i = 0; Y + i * t < H + 2 * t; i++) {
            const j = i - 2, y = Y + sg * (e - X) + j * t;
            const r0 = Math.max(0, Math.floor(y) + 1), r1 = Math.min(H - 1, Math.ceil(y + t) - 1);
            if (r0 > r1) continue;
            // R maps the four tooth triangles into one horizontal strip. Their
            // strict horizontal intervals are counted directly. Different i
            // occupy different strips; k shifts by 2t, with complementary
            // diagonals in the overlap, so these triangles never duplicate.
            const endK = Math.min(K, Math.ceil((j + 3) / 2) - 1);
            for (let k = 0; k <= endK; k++) {
              const x = X + sg * (j - 2 * k) * t;
              const counts = [0, 0, 0, 0];
              for (let r = r0; r <= r1; r++) {
                const v = r - y;
                const halfLo = Math.max(0, Math.floor(X - (r - Y)) + 1, sg > 0 ? Math.floor(X) + 1 : 0);
                const halfHi = Math.min(W - 1, Math.ceil(X + (r - Y)) - 1, sg < 0 ? Math.ceil(X) - 1 : W - 1);
                for (let p = 0; p < 4; p++) {
                  const u0 = p === 0 ? v : p === 1 ? t : p === 2 ? 2 * t - v : 2 * t;
                  const u1 = p === 0 ? t : p === 1 ? 2 * t - v : p === 2 ? 2 * t : 2 * t + v;
                  const lo = Math.max(halfLo, Math.floor(x + (sg > 0 ? u0 : -u1)) + 1);
                  const hi = Math.min(halfHi, Math.ceil(x + (sg > 0 ? u1 : -u0)) - 1);
                  if (lo <= hi) counts[p] += prefix[r * stride + hi + 1] - prefix[r * stride + lo];
                }
              }
              for (const n of counts) add(inner, n);
            }
          }
        }
      }
      // The zero DP guarantees every cell in these complete, in-bounds ▼ is
      // occupied. Strict cellIn rows have 2h-1, 2h-3, …, 1 cells: exactly h².
      for (const { h } of triangles) add('down' + h, h * h, '▼' + h);

      const figures = [...byFigure.values()].sort((a, b) => a.kind.localeCompare(b.kind) || b.n - a.n);
      const hist = new Map(), types = new Map();
      let figureCount = 0, sum = 0;
      for (const f of figures) {
        figureCount += f.count; sum += f.n * f.count;
        let h = hist.get(f.n);
        if (!h) hist.set(f.n, h = { n: f.n, count: 0, names: [] });
        h.count += f.count; h.names.push(f.name);
        let g = types.get(f.kind);
        if (!g) types.set(f.kind, g = { kind: f.kind, name: f.name, count: 0, sum: 0, min: f.n, max: f.n });
        g.count += f.count; g.sum += f.n * f.count; g.min = Math.min(g.min, f.n); g.max = Math.max(g.max, f.n);
      }
      const histogram = [...hist.values()].sort((a, b) => b.n - a.n);
      return { figures, histogram, groups: [...types.values()], figureCount, sum,
        repeated: histogram.filter(h => h.count > 1) };
    }

    function analyzeAreas({ left, middle, right, W, H, frame, anchor = W >> 1, saw = true, sawFull = true }) {
      const hasMiddle = middle != null;
      if (!Number.isInteger(W) || !Number.isInteger(H) || W < 1 || H < 1 ||
          !Number.isInteger(frame) || frame < 0 || frame >= W ||
          !Number.isFinite(anchor) || !left || !right || left.length !== W * H || right.length !== W * H ||
          (hasMiddle && (!middle || middle.length !== W * H))) {
        throw new RangeError('Area analysis requires two or three finite W × H fields and a frame in [0,W).');
      }
      prepare(W, H);
      const X = anchor - (frame % 2) / 2, Y = (frame + 2) / 2;
      const a = analyzeSide(left, W, H, X, Y, saw, sawFull);
      const m = hasMiddle ? analyzeSide(middle, W, H, X, Y, saw, sawFull) : null;
      const b = analyzeSide(right, W, H, X, Y, saw, sawFull);
      const bh = new Map(b.histogram.map(h => [h.n, h]));
      const shared = a.histogram.filter(h => bh.has(h.n)).map(h => ({ n: h.n,
        left: h.count, right: bh.get(h.n).count, namesLeft: h.names, namesRight: bh.get(h.n).names }));
      const mh = m ? new Map(m.histogram.map(h => [h.n, h])) : null;
      // v2: площади, которые есть у всех трёх, и полное совпадение всех трёх.
      const sharedAll = mh ? a.histogram.filter(h => mh.has(h.n) && bh.has(h.n)).map(h => ({ n: h.n,
        left: h.count, middle: mh.get(h.n).count, right: bh.get(h.n).count,
        namesLeft: h.names, namesMiddle: mh.get(h.n).names, namesRight: bh.get(h.n).names })) : [];
      const histogramEqualAll = !!mh && a.histogram.length === m.histogram.length && m.histogram.length === b.histogram.length &&
        sharedAll.length === a.histogram.length && sharedAll.every(h => h.left === h.middle && h.middle === h.right);
      const namedHistogramEqualAll = !!mh && JSON.stringify(a.figures) === JSON.stringify(m.figures) &&
        JSON.stringify(m.figures) === JSON.stringify(b.figures);
      const sumsEqualAll = !!mh && a.sum === m.sum && m.sum === b.sum;
      return {
        geometry: { X, Y, W, H, frame, vertices: frame + 1, finite: true,
          note: 'Общая геометрия точки конуса; только клетки исходного поля. На 5.8 это не граница застывания.' },
        left: a, middle: m, right: b, shared, sharedAll,
        histogramEqual: a.histogram.length === b.histogram.length && shared.length === a.histogram.length && shared.every(h => h.left === h.right),
        histogramEqualAll,
        namedHistogramEqual: JSON.stringify(a.figures) === JSON.stringify(b.figures),
        namedHistogramEqualAll,
        sumsEqualAll
      };
    }
    return { analyzeAreas };
  }
  const api = { createAnalyzer, analyzeAreas: createAnalyzer().analyzeAreas };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.HubCompareAreas = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
