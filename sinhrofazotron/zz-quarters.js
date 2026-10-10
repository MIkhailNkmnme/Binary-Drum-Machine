/* Синхрофазотрон: одно производное кольцо из долей битов каждой четверти.
   Угловые доли совпадают с балансами; исходные строки не изменяются. */
(() => {
  "use strict";
  const TAU = 2 * Math.PI;
  function clip(poly, cx, cy, nx, ny){
    const result = [], side = p => (p[0] - cx) * nx + (p[1] - cy) * ny;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length], da = side(a), db = side(b);
      if (da >= 0) result.push(a);
      if ((da >= 0) !== (db >= 0)) { const t = da / (da - db); result.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
    }
    return result;
  }
  function centre(poly){
    let area = 0, x = 0, y = 0;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length], cross = a[0] * b[1] - b[0] * a[1];
      area += cross; x += (a[0] + b[0]) * cross; y += (a[1] + b[1]) * cross;
    }
    return Math.abs(area) > 1e-8 ? [x / (3 * area), y / (3 * area)] : null;
  }
  function radius(poly, point){
    let r = Infinity;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length], dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy);
      if (length) r = Math.min(r, Math.abs(dx * (point[1] - a[1]) - dy * (point[0] - a[0])) / length);
    }
    return r;
  }
  function quarters(data, axis){
    const lists = [[], [], [], []];
    data.cells.forEach(cells => {
      const ring = [[], [], [], []];
      cells.forEach(cell => {
        const overlaps = cell.weights, angles = [Infinity, Infinity, Infinity, Infinity];
        for (const [a, b] of cell.arcs) {
          const arcs = []; ivNorm(a - axis, b - axis, arcs);
          for (const [lo, hi] of arcs) for (let q = 0; q < 4; q++) {
            const start = Math.max(lo, q * Math.PI / 2), end = Math.min(hi, (q + 1) * Math.PI / 2);
            if (end > start) angles[q] = Math.min(angles[q], start);
          }
        }
        overlaps.forEach((weight, q) => { if (weight.sign() > 0) ring[q].push({ bit: cell.bit, weight: weight.number(), angle: angles[q] }); });
      });
      ring.forEach((entries, q) => { entries.sort((a, b) => a.angle - b.angle); lists[q].push(...entries); });
    });
    return lists;
  }
  function layout(entries, mode){
    const total = entries.reduce((sum, e) => sum + e.weight, 0), n = entries.length;
    if (!total || !n) return { cells: [], period: 1, offset: 0 };
    const cut = ["cut", "cut2", "cutA", "cutS"].includes(mode), average = total / n;
    const gap = cut ? mode === "cut2" ? total : Math.max(0, total - average) : 0;
    const inverse = mode === "cut2" && cutPrevOwn(), alternate = inverse && cutPrevMode() === "alt";
    const cells = []; let at = 0;
    entries.forEach((e, i) => {
      cells.push({ ...e, start: at }); at += e.weight;
      if (alternate) { cells.push({ bit: 1 - e.bit, weight: e.weight, start: at }); at += e.weight; }
      else if (mode === "cutA" && i < n - 1) at += gap / Math.max(1, n - 1);
      else if (mode === "cutS") at += gap / n;
    });
    if (inverse && !alternate) entries.forEach(e => { cells.push({ bit: 1 - e.bit, weight: e.weight, start: at }); at += e.weight; });
    const period = total + gap;
    let offset = cut && !alternate && !["cutA", "cutS"].includes(mode) ? -total / 2 : -average / 2;
    if (Z.cutAlign === "l") offset = -total;
    else if (Z.cutAlign === "r") offset = 0;
    return { cells, period, offset };
  }
  window.zzQuarterRingDraw = (g, o) => {
    if (!Z.coneQuarterRings || Z.cone3d) return;
    const { W, H, cx, cy, dpr, ballClosedCount } = o, axis = coneBalanceAxisAngle();
    const data = coneBalanceData(ballClosedCount, true), lists = quarters(data, axis), colors = coneBalanceColors(data.quarters);
    const mode = coneSlitRaw(), ux = Math.cos(axis), uy = Math.sin(axis), vx = Math.sin(axis), vy = -Math.cos(axis);
    const bitColors = [coneCss("--b0", "#7d8699"), coneCss("--b1", "#22d3ee")], bg = coneCss("--bg", "#0b0d12"), ff = coneCss("--ff", "monospace");
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.shadowBlur = 0; g.setLineDash([]);
    for (let q = 0; q < 4; q++) {
      const sx = q < 2 ? 1 : -1, sy = q === 0 || q === 3 ? 1 : -1;
      let poly = clip([[0, 0], [W, 0], [W, H], [0, H]], cx, cy, sx * ux, sx * uy);
      poly = clip(poly, cx, cy, sy * vx, sy * vy); const point = centre(poly); if (!point) continue;
      const r = Math.max(0, radius(poly, point) - 14 * dpr); if (r < 12 * dpr) continue;
      const [x, y] = point, inner = r * 0.73, mid = (r + inner) / 2, pattern = layout(lists[q], mode);
      g.globalAlpha = 0.95;
      for (let i = 0; i < pattern.cells.length; i++) {
        const cell = pattern.cells[i], a = -Math.PI / 2 + axis + (cell.start + pattern.offset) / pattern.period * TAU, span = cell.weight / pattern.period * TAU;
        const slit = mode === "all" ? Math.min(span * 0.035, 1.5 * dpr / r) : mode === "one" ? Math.min(span * 0.035, coneSlitHalf()) : 0;
        const left = mode === "one" && i !== 0 ? 0 : slit, right = mode === "one" && i !== pattern.cells.length - 1 ? 0 : slit;
        g.fillStyle = bitColors[cell.bit]; g.beginPath(); g.arc(x, y, r, a + left, a + span - right);
        g.arc(x, y, inner, a + span - right, a + left, true); g.closePath(); g.fill();
        const size = Math.min((r - inner) * 0.85, mid * span * 0.72, 28 * dpr);
        if (size >= 6 * dpr) {
          const t = a + span / 2; g.save(); g.translate(x + mid * Math.cos(t), y + mid * Math.sin(t)); g.rotate(t + Math.PI / 2);
          g.fillStyle = bg; g.font = `700 ${size}px ${ff}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(String(cell.bit), 0, 0); g.restore();
        }
      }
      g.globalAlpha = 0.7; g.strokeStyle = colors[q]; g.lineWidth = dpr; g.beginPath(); g.arc(x, y, r + dpr, 0, TAU); g.stroke();
      const Q = data.quarters[q], diff = Q[1].sub(Q[0]), size = Math.min(14 * dpr, inner * 0.23);
      g.globalAlpha = 1; g.fillStyle = colors[q]; g.font = `900 ${size}px ${ff}`; g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText("Δ " + (diff.sign() > 0 ? "+" : "") + coneBalanceNumber(diff), x, y - size * 0.65);
      g.font = `700 ${size * 0.78}px ${ff}`; g.fillStyle = "#fff"; g.fillText(coneBalanceNumber(Q[1]) + "  ·  " + coneBalanceNumber(Q[0]), x, y + size * 0.65);
    }
    g.restore();
  };
})();
