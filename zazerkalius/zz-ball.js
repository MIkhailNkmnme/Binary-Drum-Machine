/* Solaris v0.944: manual starts, symmetry points, three routes and fractional
   constant speed along the track. The rotation clock owns the experiment. */
(() => {
  "use strict";
  const TAU = 2 * Math.PI, EPS = 1e-7;
  const $ = id => document.getElementById(id);
  const norm = a => ((a + Math.PI) % TAU + TAU) % TAU - Math.PI;
  const positive = a => ((a % TAU) + TAU) % TAU;
  let F = null, enabled = false, paused = true, cycles = 0, passes = 0;
  let markers = [], drawn = null, lab = null, lastPoints = "";
  const routes = { eight: "восьмёрка", out: "на вылет", cross: "через центр" };
  function fraction(value) {
    const parts = String(value).trim().replace(",", ".").split("/");
    if (!parts.every(p => /^\d+(?:\.\d+)?$/.test(p.trim())) || parts.length > 2) return NaN;
    const n = +parts[0] / (parts.length === 2 ? +parts[1] : 1);
    return Number.isFinite(n) && n > 0 && n <= 1000 ? n : NaN;
  }
  function rate(S) {
    const spin = Z.coneSpin, ph = Z.coneSpinPh, m = Z.coneSpinMode || "all", sp = Z.coneAutoSp ?? 30;
    let B;
    try {
      if (m === "all") Z.coneSpin = (spin || 0) + sp;
      else Z.coneSpinPh = (ph || 0) + (m === "bit" || m === "obit" ? sp / 10 : sp);
      B = snapshot();
    } finally { Z.coneSpin = spin; Z.coneSpinPh = ph; }
    if (!B) return [];
    return S.rings.map((r, k) => B.rings[k].phase - r.phase + (m === "all" ? sp * Math.PI / 180 : 0));
  }
  function period(S) {
    const w = rate(S), periods = w.map((v, k) => Math.abs(v) < 1e-12 ? 0 : (k === 0 ? TAU : Math.PI) / Math.abs(v)).filter(Boolean);
    if (!periods.length) return null;
    const base = Math.max(...periods);
    for (let n = 1; n <= 4096; n++) {
      const t = base * n;
      if (periods.every(p => Math.abs(t / p - Math.round(t / p)) < 1e-7)) return t;
    }
    return null;
  }
  function points(S) {
    const out = [{ id: "center", label: "Центр", r: 0, k: 0, raw: null, kind: "center" }];
    S.rings.forEach((ring, k) => {
      const features = [];
      ring.blocks.forEach((b, j) => {
        features.push({ raw: b.lo, kind: "edge", label: "грань " + (j * 2 + 1) }, { raw: b.hi, kind: "edge", label: "грань " + (j * 2 + 2) });
        features.push({ raw: (b.lo + b.hi) / 2, kind: "axis", label: "ось бита " + (j + 1) });
        const next = ring.blocks[(j + 1) % ring.blocks.length].lo + (j === ring.blocks.length - 1 ? TAU : 0);
        features.push({ raw: (b.hi + next) / 2, kind: "axis", label: "ось выреза " + (j + 1) });
      });
      features.forEach((p, j) => {
        const radii = [["joint", 1], ["rim", S.rings[1].ro]];
        if (Math.abs(S.rings[0].ro - 1) > EPS) radii.unshift(["inner", S.rings[0].ro]);
        for (const [tag, r] of radii) out.push({ ...p, id: k + ":" + j + ":" + tag, k, r, label: "К" + (k + 1) + " · " + p.label + " · " + (tag === "joint" ? "стык" : tag === "inner" ? "край К1" : "край") });
      });
    });
    return out;
  }
  function startPoint(S) { return points(S).find(p => p.id === Z.coneBallStart) || points(S)[0]; }
  function pauseRotation() { if (coneSpinning) $("bConeAuto").click(); }
  function readyText(S) {
    const p = startPoint(S); return "Старт: " + p.label + " · " + routes[Z.coneBallRoute || "eight"] + " · ▶ запуск";
  }
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
    b.classList.toggle("on", enabled); b.setAttribute("aria-pressed", String(enabled)); b.textContent = "● шарик";
    if ($("ballLabEnable")) { $("ballLabEnable").textContent = enabled ? "● вкл." : "○ выкл."; $("ballLabEnable").setAttribute("aria-pressed", String(enabled)); }
  }
  function angle(S, k, raw) { return raw + S.rings[k].phase + S.spin; }
  function begin(S, clear = false, launch = false) {
    if (clear) cycles = passes = 0;
    const dir = (Z.coneAutoSp ?? 30) < 0 ? -1 : 1, b = S.rings[0].blocks[0], aim = dir > 0 ? 0 : Math.PI;
    const p = startPoint(S), k = p.k;
    const raw = p.raw ?? [b.lo, b.hi].reduce((a, c) => Math.abs(norm(angle(S, 0, c) - aim)) < Math.abs(norm(angle(S, 0, a) - aim)) ? c : a);
    const R = S.rings[1].ro, span = S.rings[1].blocks[0].hi - S.rings[1].blocks[0].lo;
    const route = routes[Z.coneBallRoute] ? Z.coneBallRoute : "eight", mult = fraction(Z.coneBallMult || "1"), T = period(S);
    const length = route === "eight" ? R * (4 + 2 * span) : route === "out" ? R - p.r : R + p.r;
    F = { shape: S.shape, dir, R, route, start: { k, raw, q: p.r }, length, stage: route === "cross" ? "cross" : "out", ready: !launch,
      q: p.r, k, raw, a: angle(S, k, raw), clean: true, waits: 0, wait: null, elapsed: 0, travel: 0, period: T, mult, speed: T && Number.isFinite(mult) ? length * mult / T : 0 };
    if (route === "eight" && Math.abs(p.r - R) < EPS) {
      const u = positive(F.a - S.rings[1].phase - S.spin);
      const sector = S.rings[1].blocks.find(v => positive(u - v.lo) <= v.hi - v.lo + EPS);
      if (sector) {
        const side = Math.abs(norm(u - sector.lo)) < EPS ? 1 : Math.abs(norm(u - sector.hi)) < EPS ? -1 : dir;
        F.stage = "arc1"; F.k = 1; F.raw = u; F.arcDir = side;
        F.arcLeft = side > 0 ? positive(sector.hi - u) : positive(u - sector.lo);
        F.arcEnd = side > 0 ? sector.hi : sector.lo;
        F.start = { k: 1, raw: side > 0 ? sector.lo : sector.hi, q: p.r };
      }
    }
    if (launch && !(F.speed > 0)) { F.ready = true; status(length <= EPS ? "Шарик уже на внешнем краю · выбери точку внутри или маршрут через центр" : "Для запуска нужны вращение и положительная дробная скорость"); metrics(S); return; }
    status(launch ? routes[route] + " · старт: " + p.label + " · скорость " + String(Z.coneBallMult || "1") + "×" : readyText(S));
    metrics(S);
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
    return { at, delta, distance: F.speed * dt };
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
      const sign = F.stage === "out" ? 1 : -1, h = Math.min(1 - t, 1e-4 / Math.max(C.distance, 1e-12));
      if (radialHit(S, F.q, F.q + sign * C.distance * h, a, C.delta[F.k] * h, C.delta.map(d => d * h))) continue;
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
    if (best.dist > 1e-6) { F.clean = false; F.stage = "done"; status("НЕ проход: у внешнего края нет совпавшей грани для перехода на дугу · выбери другую скорость или старт"); return; }
    F.raw = raw; F.arcDir = best.side === "lo" ? 1 : -1;
    F.arcLeft = F.arcDir > 0 ? positive(best.b.hi - raw) : positive(raw - best.b.lo);
    F.arcEnd = F.arcDir > 0 ? best.b.hi : best.b.lo; F.stage = second ? "arc2" : "arc1";
  }
  function advance(dt, A, B) {
    if (!enabled || !F || F.ready || F.stage === "done" || !(dt > 0)) return;
    if (!A || !B || A.shape !== F.shape || B.shape !== F.shape) { F = null; status(hint()); return; }
    const dir = (Z.coneAutoSp ?? 30) < 0 ? -1 : 1;
    if (dir !== F.dir) { begin(A, true); status("Направление изменено · ▶ запуск — новый опыт"); return; }
    const C = frame(A, B, dt); if (!(C.distance > 0)) { status("Нужна положительная дробная скорость и вращение колец"); return; }
    let t = 0, guard = 0;
    while (t < 1 - 1e-10 && guard++ < 64) {
      if (F.stage === "done") break;
      if (F.wait) {
        const release = waitRelease(C, t); if (release === null) { F.elapsed += dt * (1 - t); return; }
        F.elapsed += dt * (release - t); t = release; F.wait = null; F.a = angle(C.at(t), F.k, F.raw);
        status("Путь открылся · НЕ проход (было ожидание)");
      }
      const S = C.at(t), a0 = angle(S, F.k, F.raw); F.a = a0;
      if (F.stage === "arc1" || F.stage === "arc2") {
        const amount = Math.min(C.distance * (1 - t), F.arcLeft * F.R, F.length - F.travel), h = amount / C.distance;
        F.raw += F.arcDir * amount / F.R; F.arcLeft -= amount / F.R; F.elapsed += dt * h; F.travel += amount; t += h; F.a = angle(C.at(t), F.k, F.raw);
        if (F.travel >= F.length - EPS) { finish(); break; }
        if (F.arcLeft <= EPS) { F.raw = F.arcEnd; F.a = angle(C.at(t), 1, F.raw); F.stage = F.stage === "arc1" ? "cross" : "home"; }
        continue;
      }
      const target = F.stage === "out" ? F.R : F.stage === "cross" ? -F.R : 0, sign = target > F.q ? 1 : -1;
      const amount = Math.min(C.distance * (1 - t), Math.abs(target - F.q), F.length - F.travel), h = amount / C.distance, q1 = F.q + sign * amount;
      const hit = radialHit(S, F.q, q1, a0, C.delta[F.k] * h, C.delta.map(d => d * h)), fraction = hit ? hit.t : 1;
      F.q += sign * amount * fraction; F.elapsed += dt * h * fraction; F.travel += amount * fraction; t += h * fraction; F.a = angle(C.at(t), F.k, F.raw);
      if (hit) { waitAt(hit); F.elapsed += dt * (1 - t); metrics(B); return; }
      if (F.travel >= F.length - EPS) { finish(); break; }
      if (Math.abs(F.q - target) <= EPS) {
        if (F.route !== "eight") { finish(); break; }
        if (F.stage === "out") startArc(C.at(t), false);
        else if (F.stage === "cross") startArc(C.at(t), true);
        else { F.q = 0; F.stage = "out"; F.k = F.start.k; F.raw = F.start.raw; F.a = angle(C.at(t), F.k, F.raw); }
      }
    }
    metrics(B);
  }
  function finish() {
    F.stage = "done"; cycles++; if (F.clean) passes++;
    status(routes[F.route] + " · " + (F.clean ? "ПРОХОД без ожидания" : "НЕ проход: было ожидание") + " · время " + F.elapsed.toFixed(3) + " с · чистых " + passes + "/" + cycles);
  }
  window.zzBallActive = () => enabled && !!snapshot();
  window.zzBallBeforeSpin = () => {
    if (!enabled) return null;
    const S = snapshot(); if (!S) { status(hint()); return null; }
    if (!F || F.shape !== S.shape) begin(S); return S;
  };
  window.zzBallAfterSpin = (dt, before) => { if (enabled) advance(dt, before, snapshot()); };
  window.zzBallSpinState = on => {
    paused = !on; if (!enabled) return;
    if (on && snapshot() && typeof coneReleaseRings === "function") coneReleaseRings();
    const S = snapshot(); if (on && S && (!F || F.ready)) begin(S, true, true);
    else if (on && F && !F.wait && F.stage !== "done") status(F.clean ? routes[F.route] + " · постоянная скорость по дорожке" : "Продолжает · НЕ проход (было ожидание)");
    else if (!on && F && !F.ready && F.stage !== "done" && !F.wait) status("Пауза вместе с вращением · ▶ — продолжить");
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
      if ($("ballLabPoints") && Z.coneBallPoints !== false && lab && lab.open) {
        markers = points(S).map(p => { const a = p.raw === null ? 0 : angle(S, p.k, p.raw); return { ...p, x: cx + p.r * dr * Math.cos(a), y: cy + p.r * dr * Math.sin(a) }; });
        drawn = { dpr }; const unique = [];
        g.save(); g.lineWidth = 1.5 * dpr;
        for (const p of markers) {
          if (unique.some(v => Math.hypot(v.x - p.x, v.y - p.y) < 2 * dpr)) continue; unique.push(p);
          const selected = markers.some(v => v.id === (Z.coneBallStart || "center") && Math.hypot(v.x - p.x, v.y - p.y) < 2 * dpr);
          const joint = p.r === 1 && markers.some(v => v.r === 1 && v.k !== p.k && Math.hypot(v.x - p.x, v.y - p.y) < Math.max(dr * 1e-6, 1e-8));
          g.strokeStyle = selected ? "#ffd166" : joint ? "#7ee787" : p.kind === "edge" ? "#79e7e1" : "#cd94ff";
          g.fillStyle = "#10141c"; g.beginPath(); g.arc(p.x, p.y, (selected ? 6 : 4) * dpr, 0, TAU); g.fill(); g.stroke();
        }
        g.restore();
      } else { markers = []; drawn = null; }
      if (F && F.ready) { const p = startPoint(S); F.q = p.r; F.a = p.raw === null ? angle(S, F.k, F.raw) : angle(S, p.k, p.raw); }
      metrics(S);
    }
    const q = F ? F.q * dr : 0, a = F ? F.wait ? F.wait.a : F.a : 0;
    const color = F && F.wait ? "#ff5f6d" : F && F.stage === "done" && F.clean ? "#7ee787" : "#79e7e1";
    g.save(); g.fillStyle = color; g.shadowColor = color; g.shadowBlur = 9 * dpr; g.beginPath(); g.arc(cx + q * Math.cos(a), cy + q * Math.sin(a), 4 * dpr, 0, TAU); g.fill(); g.restore();
  };
  function reset() { F = null; cycles = passes = 0; const S = snapshot(); if (!enabled) status("Шарик выключен"); else if (S) begin(S, true); else status(hint()); renderCone(); }
  function metrics(S) {
    if (!$("ballLabTime")) return;
    const P = points(S), key = P.map(p => p.id).join("|");
    if (key !== lastPoints) {
      const select = $("ballLabStart"); select.replaceChildren();
      for (const p of P) { const opt = document.createElement("option"); opt.value = p.id; opt.textContent = p.label; select.appendChild(opt); }
      lastPoints = key;
    }
    $("ballLabStart").value = startPoint(S).id;
    const T = F && !F.ready ? F.period : period(S), mult = F && !F.ready ? F.mult : fraction(Z.coneBallMult || "1");
    const text = T && Number.isFinite(mult) ? "T₀ " + T.toFixed(3) + " с · путь за " + (T / mult).toFixed(3) + " с" + (F && !F.ready ? " · прошло " + F.elapsed.toFixed(3) + " с" : "") : "Нужны два вращающихся кольца и положительная дробь";
    if ($("ballLabTime").textContent !== text) $("ballLabTime").textContent = text;
    $("ballLabRun").textContent = F && !F.ready && F.stage !== "done" ? "↻ новый запуск" : "▶ запуск";
    $("ballLabPause").textContent = paused ? "▶ продолжить" : "⏸ пауза";
  }
  function choose(id) { pauseRotation(); Z.coneBallStart = id; save(); reset(); }
  function launch(config = {}) {
    if (config.start !== undefined) Z.coneBallStart = config.start;
    if (config.route !== undefined && routes[config.route]) Z.coneBallRoute = config.route;
    if (config.mult !== undefined) Z.coneBallMult = String(config.mult);
    else if ($("ballLabSpeed")) Z.coneBallMult = $("ballLabSpeed").value.trim();
    if (!Number.isFinite(fraction(Z.coneBallMult || "1"))) { status("Скорость: введи положительную дробь, например 1/3, 3/4 или 1,5"); return false; }
    enabled = true; Z.coneBallOn = true; ui();
    if (typeof coneReleaseRings === "function") coneReleaseRings();
    const S = snapshot(); if (!S) { status(hint()); return false; }
    begin(S, true, true); save(); if (F.ready) return false;
    if (!coneSpinning) $("bConeAuto").click();
    paused = !coneSpinning;
    renderCone(); return true;
  }
  window.zzBallLaunch = launch;
  window.zzBallPoints = () => { const S = snapshot(); return S ? points(S) : []; };
  window.zzBallInfo = () => F && { route: F.route, stage: F.stage, ready: F.ready, speed: F.speed, period: F.period, multiplier: F.mult, length: F.length, distance: F.travel, elapsed: F.elapsed, clean: F.clean, waits: F.waits, q: F.q, angle: F.a };
  function initLab() {
    if (typeof ZZ_BG !== "undefined" && ZZ_BG) return;
    const host = $("w-cone").querySelector(":scope > .wbody");
    lab = document.createElement("details"); lab.id = "solBallLab"; lab.open = Z.coneBallLabOpen !== false;
    lab.innerHTML = `<summary>● Шарик — ручной опыт</summary><div class="ball-lab-body">
      <div class="ball-lab-row"><button id="ballLabEnable" type="button">● вкл.</button><label>Путь <select id="ballLabRoute"><option value="eight">восьмёрка</option><option value="out">на вылет</option><option value="cross">через центр</option></select></label><button id="ballLabPoints" type="button" aria-pressed="true">◎ точки</button></div>
      <label>Старт <select id="ballLabStart"></select></label>
      <div class="ball-lab-row"><span>Кольцо 1</span><button type="button" data-ball-ring="0" data-step="-.5">−½</button><button type="button" data-ball-ring="0" data-step=".5">+½</button><span>Кольцо 2</span><button type="button" data-ball-ring="1" data-step="-.5">−½</button><button type="button" data-ball-ring="1" data-step=".5">+½</button></div>
      <div class="ball-lab-row"><label>Скорость × <input id="ballLabSpeed" type="text" inputmode="text" value="1" aria-label="Множитель скорости, десятичное число или дробь"></label><span class="ball-lab-fractions"><button type="button" data-ball-speed="1/4">¼</button><button type="button" data-ball-speed="1/3">⅓</button><button type="button" data-ball-speed="1/2">½</button><button type="button" data-ball-speed="2/3">⅔</button><button type="button" data-ball-speed="1">1</button><button type="button" data-ball-speed="3/2">³⁄₂</button><button type="button" data-ball-speed="2">2</button><button type="button" data-ball-speed="4">4</button><button type="button" data-ball-speed="8">8</button><button type="button" data-ball-speed="16">16</button><button type="button" data-ball-speed="32">32</button></span></div>
      <small>1×: выбранный путь за T₀ — минимальный период повторения двух колец. ½× — за 2T₀. Скорость по дорожке постоянна.</small>
      <div id="ballLabTime"></div><div class="ball-lab-row"><button id="ballLabRun" type="button">▶ запуск</button><button id="ballLabPause" type="button">⏸ пауза</button><button id="ballLabReset" type="button">↩ к старту</button><button id="ballLabDir" type="button">↻ / ↺</button></div>
      <small>Точки на холсте: грани — голубые, оси — фиолетовые, совпавшие стыки — зелёные. Нажми точку, чтобы выбрать старт.</small><div id="ballLabStatus" role="status" aria-live="polite"></div></div>`;
    host.appendChild(lab); $("ballLabRoute").value = Z.coneBallRoute || "eight"; $("ballLabSpeed").value = Z.coneBallMult || "1";
    $("ballLabEnable").onclick = () => $("bConeBall").click();
    $("ballLabRun").onclick = () => launch(); $("ballLabPause").onclick = () => $("bConeAuto").click();
    $("ballLabReset").onclick = () => { pauseRotation(); reset(); };
    $("ballLabDir").onclick = () => { pauseRotation(); $("bConeDir").click(); reset(); };
    $("ballLabStart").onchange = () => choose($("ballLabStart").value);
    $("ballLabRoute").onchange = () => { pauseRotation(); Z.coneBallRoute = $("ballLabRoute").value; save(); reset(); };
    $("ballLabSpeed").onchange = () => {
      if (!Number.isFinite(fraction($("ballLabSpeed").value))) { $("ballLabSpeed").setAttribute("aria-invalid", "true"); status("Введи положительную дробь, например 1/3 или 3/4"); return; }
      $("ballLabSpeed").removeAttribute("aria-invalid"); pauseRotation(); Z.coneBallMult = $("ballLabSpeed").value.trim(); save(); reset();
    };
    $("ballLabPoints").onclick = () => { Z.coneBallPoints = Z.coneBallPoints === false; $("ballLabPoints").setAttribute("aria-pressed", String(Z.coneBallPoints)); save(); renderCone(); };
    $("ballLabPoints").setAttribute("aria-pressed", String(Z.coneBallPoints !== false));
    lab.querySelectorAll("[data-ball-speed]").forEach(b => b.onclick = () => { $("ballLabSpeed").value = b.dataset.ballSpeed; $("ballLabSpeed").onchange(); });
    lab.querySelectorAll("[data-ball-ring]").forEach(b => b.onclick = () => {
      pauseRotation(); const i = +b.dataset.ballRing;
      if (i === 1 && Z.rows.length === 1) { Z.coneFillTurn = (Z.coneFillTurn || 0) + +b.dataset.step; Z.coneFillFree = true; }
      else { coneRot[i] = (coneRot[i] || 0) + +b.dataset.step; Z.coneFree ||= {}; Z.coneFree[i] = true; }
      Z.coneRot = coneRot.slice(); save(); reset();
    });
    lab.addEventListener("toggle", () => { Z.coneBallLabOpen = lab.open; save(); renderCone(); });
    const source = $("coneBallStatus"), syncStatus = () => { $("ballLabStatus").textContent = source.textContent; };
    new MutationObserver(syncStatus).observe(source, { childList: true, characterData: true, subtree: true }); syncStatus();
    $("coneCv").addEventListener("pointerdown", e => {
      if (!enabled || !drawn || e.button && e.button !== 0) return;
      const cv = $("coneCv"), r = cv.getBoundingClientRect(), x = (e.clientX - r.left) * cv.width / r.width, y = (e.clientY - r.top) * cv.height / r.height;
      const point = markers.reduce((best, p) => !best || Math.hypot(p.x - x, p.y - y) < Math.hypot(best.x - x, best.y - y) ? p : best, null);
      if (!point || Math.hypot(point.x - x, point.y - y) > 14 * drawn.dpr) return;
      e.preventDefault(); e.stopImmediatePropagation(); choose(point.id);
    }, true);
    ui();
  }
  function init() {
    if (!$("bConeBall")) return;
    enabled = Z.coneBallOn !== false; paused = !coneSpinning; ui(); reset();
    $("bConeBall").onclick = () => { enabled = !enabled; Z.coneBallOn = enabled; F = null; ui(); save(); if (enabled) reset(); else { status("Шарик выключен"); renderCone(); } };
    $("bConeBallReset").onclick = () => { pauseRotation(); reset(); };
    initLab(); reset();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true }); else init();
})();
