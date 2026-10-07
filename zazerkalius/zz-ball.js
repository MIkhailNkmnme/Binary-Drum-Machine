/* Solaris v0.942: centre, first outer lobe, centre crossing, opposite lobe, centre.
   The rotation clock owns the ball. Waiting invalidates the whole passage. */
(() => {
  "use strict";
  const TAU = 2 * Math.PI, EPS = 1e-7;
  const $ = id => document.getElementById(id);
  const norm = a => ((a + Math.PI) % TAU + TAU) % TAU - Math.PI;
  const positive = a => ((a % TAU) + TAU) % TAU;
  let F = null, enabled = false, paused = true, cycles = 0, passes = 0;
  function status(s) { const el = $("coneBallStatus"); if (el && el.textContent !== s) el.textContent = s; }
  function snapshot() {
    if (!coneGeom || !coneCutOn() || !coneHalfOn() || !(Z.coneClock || coneSunOn()) || Z.cone3d || Z.conePoly || cutPrevMode() || coneFreeOn() || Z.coneBitStep) return null;
    const N = Math.min(Z.rows.length, CONE_MAX);
    if (N + (coneGeom.fill ? 1 : 0) < 2) return null;
    const band = Z.coneClean ? 1 : 0.72, rings = [];
    for (let i = 0; i < 2; i++) {
      const R = coneRingFeat(i === N ? "f" : i); if (!R) return null;
      const blocks = [];
      if (i === 0) blocks.push({ lo: Math.PI / 2, hi: 3 * Math.PI / 2, bit: 0 });
      else {
        const bits = i === N ? fillDraft() : Z.rows[i];
        for (let j = 0; j < R.n; j++) if (bits[j] === "0" || bits[j] === "1") {
          const p = R.cut ? cutPos(j, R.n) : j;
          blocks.push({ lo: -Math.PI / 2 + p * R.step, hi: -Math.PI / 2 + (p + 1) * R.step, bit: j });
        }
      }
      rings.push({ ri: i, ro: i + band, phase: -R.x0 * R.step, blocks, shape: [R.n, R.P, R.cut, band].join(":") });
    }
    const B = rings[1].blocks;
    if (B.length !== 2 || Math.abs(Math.abs(norm(B[1].lo - B[0].lo)) - Math.PI) > EPS || Math.abs((B[0].hi - B[0].lo) - (B[1].hi - B[1].lo)) > EPS) return null;
    return { rings, spin: (Z.coneSpin || 0) * Math.PI / 180, shape: rings.map(r => r.shape).join("|") };
  }
  function hint() { return "Шарик: нужны 2 части у строки 1 и два противоположных бита второго кольца («по симметрии»), плоский вид и плавное кручение"; }
  function ui() {
    const b = $("bConeBall"); if (!b) return;
    b.classList.toggle("on", enabled); b.setAttribute("aria-pressed", String(enabled)); b.textContent = "● восьмёрка";
  }
  function angle(S, k, raw) { return raw + S.rings[k].phase + S.spin; }
  function begin(S, clear = false) {
    if (clear) cycles = passes = 0;
    const dir = (Z.coneAutoSp ?? 30) < 0 ? -1 : 1, b = S.rings[0].blocks[0], aim = dir > 0 ? 0 : Math.PI;
    const raw = [b.lo, b.hi].reduce((a, c) => Math.abs(norm(angle(S, 0, c) - aim)) < Math.abs(norm(angle(S, 0, a) - aim)) ? c : a);
    const R = S.rings[1].ro, span = S.rings[1].blocks[0].hi - S.rings[1].blocks[0].lo;
    F = { shape: S.shape, dir, R, length: R * (4 + 2 * span), stage: "out", q: 0, k: 0, raw, a: angle(S, 0, raw), clean: true, waits: 0, wait: null, elapsed: 0 };
    status("2 кольца · шарик в центре · " + (paused ? "▶ крутить — начать восьмёрку" : dir > 0 ? "по часовой → вправо по грани" : "против часовой → влево по грани"));
  }
  function closed(S, k, a) {
    const u = positive(a - S.rings[k].phase - S.spin);
    return S.rings[k].blocks.find(b => { const d = positive(u - b.lo); return d > EPS && d < b.hi - b.lo - EPS; });
  }
  // First entrance into a repeated solid arc; exact boundary contact is allowed.
  function angularHit(u0, du, lo, hi, from, to) {
    lo += EPS; hi -= EPS; if (hi <= lo || to - from < 1e-12) return null;
    const u = u0 + du * from, q = Math.floor((u - lo) / TAU), a = lo + q * TAU, b = hi + q * TAU;
    if (u > a && u < b) return from;
    if (Math.abs(du) < 1e-12) return null;
    const edge = du > 0 ? lo + Math.ceil((u - lo) / TAU) * TAU : hi + Math.floor((u - hi) / TAU) * TAU;
    const t = (edge - u0) / du;
    return t >= from - EPS && t < to - 1e-12 ? Math.max(from, t) : null;
  }
  function frame(A, B, dt) {
    let ds = B.spin - A.spin;
    if ((Z.coneSpinMode || "all") === "all") { const expected = (Z.coneAutoSp ?? 30) * dt * Math.PI / 180; ds += TAU * Math.round((expected - ds) / TAU); }
    const delta = A.rings.map((r, k) => B.rings[k].phase - r.phase + ds);
    const at = t => ({ shape: A.shape, spin: A.spin + ds * t, rings: A.rings.map((r, k) => ({ ...r, phase: r.phase + (B.rings[k].phase - r.phase) * t })) });
    return { at, delta, distance: F.length * Math.max(...delta.map(Math.abs)) / TAU };
  }
  function radialHit(S, q0, q1, a0, da, delta) {
    const dq = q1 - q0; if (Math.abs(dq) < 1e-12) return null;
    let hit = null;
    for (let k = 0; k < 2; k++) {
      const r = S.rings[k];
      for (const sign of [-1, 1]) {
        const lo = sign < 0 ? -r.ro : r.ri, hi = sign < 0 ? -r.ri : r.ro;
        const t0 = (lo - q0) / dq, t1 = (hi - q0) / dq;
        const from = Math.max(0, Math.min(t0, t1)), to = Math.min(1, Math.max(t0, t1));
        if (to <= from) continue;
        const u0 = a0 + (sign < 0 ? Math.PI : 0) - r.phase - S.spin;
        for (const b of r.blocks) {
          const t = angularHit(u0, da - delta[k], b.lo, b.hi, from, to);
          if (t !== null && (!hit || t < hit.t)) hit = { t, k, bit: b.bit + 1 };
        }
      }
    }
    return hit;
  }
  function waitAt(hit) {
    F.clean = false; F.waits++; F.wait = { k: hit.k, bit: hit.bit, a: F.a };
    status(`2 кольца · ждёт: кольцо ${hit.k + 1}, бит ${hit.bit} · НЕ проход · ожиданий ${F.waits}`);
  }
  // Waiting freezes the world position. Resume at an open gate when the guiding
  // bit edge is back on that same line, avoiding a sideways jump through a wall.
  function waitRelease(C, from) {
    const W = F.wait, candidates = [from], a0 = angle(C.at(0), F.k, F.raw), da = C.delta[F.k];
    if (Math.abs(da) > 1e-12) {
      const start = a0 + da * from, end = a0 + da;
      const lo = Math.ceil((Math.min(start, end) - W.a) / TAU - EPS), hi = Math.floor((Math.max(start, end) - W.a) / TAU + EPS);
      for (let j = lo; j <= hi; j++) candidates.push((W.a + j * TAU - a0) / da);
    } else {
      const S0 = C.at(0);
      for (let k = 0; k < 2; k++) for (const b of S0.rings[k].blocks) for (const edge of [b.lo, b.hi]) {
        const v = -C.delta[k]; if (Math.abs(v) < 1e-12) continue;
        const u = W.a + (F.q < 0 ? Math.PI : 0) - S0.rings[k].phase - S0.spin;
        const u1 = u + v * from, u2 = u + v;
        const lo = Math.ceil((Math.min(u1, u2) - edge) / TAU - EPS), hi = Math.floor((Math.max(u1, u2) - edge) / TAU + EPS);
        for (let j = lo; j <= hi; j++) candidates.push((edge + j * TAU - u) / v);
      }
    }
    for (const t of candidates.sort((a, b) => a - b)) {
      if (t < from - EPS || t >= 1 - 1e-10) continue;
      const S = C.at(t), a = angle(S, F.k, F.raw); if (Math.abs(norm(a - W.a)) > 5 * EPS) continue;
      const sign = F.stage === "out" ? 1 : -1, radius = Math.abs(F.q + sign * 1e-5), ray = a + (F.q < 0 ? Math.PI : 0), soon = C.at(Math.min(1, t + 1e-6));
      if (S.rings.some((r, k) => radius > r.ri && radius < r.ro && (closed(S, k, ray) || closed(soon, k, ray + C.delta[F.k] * 1e-6)))) continue;
      return Math.max(from, t);
    }
    return null;
  }
  function startArc(S, second) {
    if (F.q < 0) F.a += Math.PI;
    F.q = F.R; F.k = 1;
    const raw = F.a - S.rings[1].phase - S.spin; let best = null;
    for (const b of S.rings[1].blocks) for (const side of ["lo", "hi"]) {
      const dist = Math.abs(norm(raw - b[side])); if (!best || dist < best.dist) best = { b, side, dist };
    }
    F.raw = raw; F.arcDir = best.side === "lo" ? 1 : -1;
    F.arcLeft = F.arcDir > 0 ? positive(best.b.hi - raw) : positive(raw - best.b.lo);
    F.arcEnd = F.arcDir > 0 ? best.b.hi : best.b.lo; F.stage = second ? "arc2" : "arc1";
  }
  function advance(dt, A, B) {
    if (!enabled || !F || !(dt > 0)) return;
    if (!A || !B || A.shape !== F.shape || B.shape !== F.shape) { F = null; status(hint()); return; }
    const dir = (Z.coneAutoSp ?? 30) < 0 ? -1 : 1; if (dir !== F.dir) begin(A);
    const C = frame(A, B, dt); if (!(C.distance > 0)) { status("Шарик: кольца стоят — отпусти их или сбрось кручение"); return; }
    let t = 0, guard = 0;
    while (t < 1 - 1e-10 && guard++ < 64) {
      if (F.stage === "done") break;
      if (F.wait) {
        const release = waitRelease(C, t); if (release === null) { F.elapsed += dt * (1 - t); return; }
        F.elapsed += dt * (release - t); t = release; F.wait = null; F.a = angle(C.at(t), F.k, F.raw);
        status("2 кольца · путь открылся, продолжает восьмёрку · НЕ проход (было ожидание)");
      }
      const S = C.at(t), a0 = angle(S, F.k, F.raw); F.a = a0;
      if (F.stage === "arc1" || F.stage === "arc2") {
        const amount = Math.min(C.distance * (1 - t), F.arcLeft * F.R), h = amount / C.distance;
        F.raw += F.arcDir * amount / F.R; F.arcLeft -= amount / F.R; F.elapsed += dt * h; t += h; F.a = angle(C.at(t), F.k, F.raw);
        if (F.arcLeft <= EPS) { F.raw = F.arcEnd; F.a = angle(C.at(t), 1, F.raw); F.stage = F.stage === "arc1" ? "cross" : "home"; }
        continue;
      }
      const target = F.stage === "out" ? F.R : F.stage === "cross" ? -F.R : 0, sign = target > F.q ? 1 : -1;
      const amount = Math.min(C.distance * (1 - t), Math.abs(target - F.q)), h = amount / C.distance, q1 = F.q + sign * amount;
      const hit = radialHit(S, F.q, q1, a0, C.delta[F.k] * h, C.delta.map(d => d * h)), fraction = hit ? hit.t : 1;
      F.q += sign * amount * fraction; F.elapsed += dt * h * fraction; t += h * fraction; F.a = angle(C.at(t), F.k, F.raw);
      if (hit) { waitAt(hit); continue; }
      if (Math.abs(F.q - target) <= EPS) {
        if (F.stage === "out") startArc(C.at(t), false);
        else if (F.stage === "cross") startArc(C.at(t), true);
        else { F.stage = "done"; F.q = 0; cycles++; if (F.clean) passes++; status(`2 кольца · восьмёрка ${cycles} замкнулась · ${F.clean ? "ПРОХОД без ожидания" : "НЕ проход: было ожидание"} · чистых ${passes}`); }
      }
    }
  }
  window.zzBallActive = () => enabled && !!snapshot();
  window.zzBallBeforeSpin = () => {
    if (!enabled) return null;
    const S = snapshot(); if (!S) { status(hint()); return null; }
    if (!F || F.shape !== S.shape || F.stage === "done") begin(S); return S;
  };
  window.zzBallAfterSpin = (dt, before) => { if (enabled) advance(dt, before, snapshot()); };
  window.zzBallSpinState = on => {
    paused = !on; if (!enabled) return;
    if (on && snapshot() && typeof coneReleaseRings === "function") coneReleaseRings();
    const S = snapshot(); if (on && S && !F) begin(S);
    else if (on && F && !F.wait && F.stage !== "done") status(F.clean ? "2 кольца · восьмёрка идёт вместе с вращением" : "2 кольца · продолжает восьмёрку · НЕ проход (было ожидание)");
    else if (!on && F && F.stage !== "done" && !F.wait) status("2 кольца · пауза вместе с вращением · ▶ — продолжить восьмёрку");
  };
  window.zzBallRemember = () => {}; // The line follows a real bit edge.
  window.zzBallDraw = (g, o) => {
    if (!enabled) return;
    const { cx, cy, dr, dpr } = o, S = snapshot();
    if (S) {
      const R = S.rings[1].ro * dr;
      g.save(); g.lineWidth = dpr; g.strokeStyle = "#79e7e1"; g.globalAlpha = 0.26; g.setLineDash([3 * dpr, 4 * dpr]);
      for (const b of S.rings[1].blocks) { const lo = angle(S, 1, b.lo), hi = angle(S, 1, b.hi); g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + R * Math.cos(lo), cy + R * Math.sin(lo)); g.arc(cx, cy, R, lo, hi); g.lineTo(cx, cy); g.stroke(); }
      g.restore();
    }
    const q = F ? F.q * dr : 0, a = F ? F.wait ? F.wait.a : F.a : 0;
    const color = F && F.wait ? "#ff5f6d" : F && F.stage === "done" && F.clean ? "#7ee787" : "#79e7e1";
    g.save(); g.fillStyle = color; g.shadowColor = color; g.shadowBlur = 9 * dpr; g.beginPath(); g.arc(cx + q * Math.cos(a), cy + q * Math.sin(a), 4 * dpr, 0, TAU); g.fill(); g.restore();
  };
  function reset() { F = null; cycles = passes = 0; const S = snapshot(); if (!enabled) status("Шарик выключен"); else if (S) begin(S, true); else status(hint()); renderCone(); }
  function init() {
    if (!$("bConeBall")) return;
    enabled = Z.coneBallOn !== false; paused = !coneSpinning; ui(); reset();
    $("bConeBall").onclick = () => { enabled = !enabled; Z.coneBallOn = enabled; F = null; ui(); save(); if (enabled) reset(); else { status("Шарик выключен"); renderCone(); } };
    $("bConeBallReset").onclick = reset;
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true }); else init();
})();
