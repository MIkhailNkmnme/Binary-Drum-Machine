/* Solaris: every ball retains its launch diameter and reverses at a wall.
   The rotation clock owns the experiment. */
(() => {
  "use strict";
  const TAU = 2 * Math.PI, EPS = 1e-7;
  const $ = id => document.getElementById(id);
  const norm = a => ((a + Math.PI) % TAU + TAU) % TAU - Math.PI;
  const positive = a => ((a % TAU) + TAU) % TAU;
  let F = null, enabled = false, paused = true, cycles = 0, passes = 0;
  let balls = [], batchBusy = false;
  let markers = [], drawn = null, lab = null, lastPoints = "";
  const routes = { out: "на вылет", cross: "через центр" };
  const allStarts = () => Z.coneBallBatch !== false;
  // Keep coincident endpoints separate: each belongs to its own bit edge.
  function boundaryPoints(S) {
    const out = [];
    for (const [tag, r] of [["outer", S.rings[1].ro], ["inner", S.rings[1].ri]]) {
      S.rings[1].blocks.forEach((b, j) => [b.lo, b.hi].forEach((raw, side) => out.push({
        id: "edge:1:" + j + ":" + side + ":" + tag, k: 1, raw, r, kind: "edge",
        label: "К2 · " + (tag === "outer" ? "внешний" : "внутренний") + " угол " + (j * 2 + side + 1)
      })));
    }
    S.rings[0].blocks.forEach((b, j) => [b.lo, b.hi].forEach((raw, side) => out.push({
      id: "edge:0:" + j + ":" + side, k: 0, raw, r: S.rings[0].ro, kind: "edge", label: "К1 · край " + (j * 2 + side + 1)
    })));
    out.push({ id: "center", k: 0, raw: null, r: 0, kind: "center", label: "Центр" });
    return out;
  }
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
    const w = rate(S), periods = w.map((v, k) => {
      const B = S.rings[k].blocks, pitch = TAU / B.length;
      const repeated = B.length > 1 && B.every((b, j) => Math.abs(norm(b.lo - B[0].lo - j * pitch)) < EPS && Math.abs((b.hi - b.lo) - (B[0].hi - B[0].lo)) < EPS);
      return Math.abs(v) < 1e-12 ? 0 : (repeated ? pitch : TAU) / Math.abs(v);
    }).filter(Boolean);
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
  function singlePoints(S) { return [...boundaryPoints(S), ...points(S).filter(p => p.id !== "center")]; }
  function startPoint(S) { return singlePoints(S).find(p => p.id === Z.coneBallStart) || points(S)[0]; }
  function pauseRotation() { if (coneSpinning) $("bConeAuto").click(); }
  function readyText(S) {
    const p = startPoint(S); return "Старт: " + p.label + " · " + (routes[Z.coneBallRoute] || routes.cross) + " · ▶ запуск";
  }
  function status(s) { if (batchBusy) return; const el = $("coneBallStatus"); if (el && el.textContent !== s) el.textContent = s; }
  function snapshot() {
    if (!coneGeom || !coneCutOn() || !(coneHalfOn() || coneQuadOn() && conePartCount() % 2 === 0) || !(Z.coneClock || coneSunOn()) || Z.cone3d || Z.conePoly || cutPrevMode() || coneFreeOn() || Z.coneBitStep) return null;
    const N = Math.min(Z.rows.length, CONE_MAX);
    if (N + (coneGeom.fill ? 1 : 0) < 2) return null;
    const band = Z.coneClean ? 1 : 0.72, rings = [];
    for (let i = 0; i < 2; i++) {
      const R = coneRingFeat(i === N ? "f" : i); if (!R) return null;
      const blocks = [];
      if (i === 0) {
        if (coneQuadOn()) for (let q = 1; q < conePartCount(); q += 2) blocks.push({ lo: -Math.PI / 2 + q * R.step, hi: -Math.PI / 2 + (q + 1) * R.step, bit: 0 });
        else blocks.push({ lo: Math.PI / 2, hi: 3 * Math.PI / 2, bit: 0 });
      }
      else {
        const bits = i === N ? fillDraft() : Z.rows[i];
        // Unfilled draft cells still have the same physical perimeter/edges.
        // Their paint value must not hide the launch points on that perimeter.
        for (let j = 0; j < R.n; j++) if (bits[j] === "0" || bits[j] === "1" || i === N && bits[j] === ".") {
          const p = R.cut ? cutPos(j, R.n) : j;
          blocks.push({ lo: -Math.PI / 2 + p * R.step, hi: -Math.PI / 2 + (p + 1) * R.step, bit: j });
        }
      }
      rings.push({ ri: i, ro: i + band, phase: -R.x0 * R.step, blocks, shape: [R.n, R.P, R.cut, band, blocks.map(b => b.lo + "," + b.hi).join(";")].join(":") });
    }
    const B = rings[1].blocks;
    if (B.length !== 2) return null;
    return { rings, spin: (Z.coneSpin || 0) * Math.PI / 180, shape: rings.map(r => r.shape).join("|") };
  }
  function hint() { return "Для шариков: 2 части или 2 по симметрии у строки 1, 2 бита второго кольца (пустые тоже подходят), плоский вид и плавное кручение"; }
  function ui() {
    const b = $("bConeBall"); if (!b) return;
    b.classList.toggle("on", enabled); b.setAttribute("aria-pressed", String(enabled)); b.textContent = "● шарики";
    if ($("ballLabEnable")) {
      $("ballLabEnable").textContent = enabled ? "● вкл." : "○ выкл.";
      $("ballLabEnable").title = enabled ? "Шарики включены. Нажми, чтобы выключить движение." : "Движение выключено. Нажми, чтобы включить шарики.";
      $("ballLabEnable").setAttribute("aria-pressed", String(enabled));
    }
    labControls();
  }
  function labControls() {
    if (!$("ballLabTime")) return;
    $("ballLabEnable").setAttribute("aria-pressed", String(enabled));
    $("ballLabPoints").setAttribute("aria-pressed", String(Z.coneBallPoints !== false));
    const mult = fraction(Z.coneBallMult || "1");
    lab.querySelectorAll("[data-ball-speed]").forEach(b => b.setAttribute("aria-pressed", String(Math.abs(fraction(b.dataset.ballSpeed) - mult) < 1e-10)));
    $("ballLabSpeed").dataset.active = String(Number.isFinite(mult));
    $("ballLabRoute").disabled = allStarts();
    $("ballLabRoute").value = allStarts() ? "cross" : routes[Z.coneBallRoute] ? Z.coneBallRoute : "cross";
    $("ballLabRoute").dataset.active = "true";
    $("ballLabStart").dataset.active = String(!!$("ballLabStart").value);
    const started = enabled && (balls.length ? balls : F ? [F] : []).some(b => !b.ready && b.stage !== "done");
    $("ballLabRun").setAttribute("aria-pressed", String(started && !paused));
    $("ballLabPause").setAttribute("aria-pressed", String(started && paused));
    $("ballLabPause").textContent = paused ? "▶ продолжить" : "⏸ пауза";
    $("ballLabDir").textContent = (Z.coneAutoSp ?? 30) < 0 ? "↺ против" : "↻ по часовой";
    $("ballLabDir").dataset.active = "true";
  }
  function angle(S, k, raw) { return raw + S.rings[k].phase + S.spin; }
  function nextContact(S, q, target) {
    const sign = target > q ? 1 : -1;
    const contacts = [...new Set(S.rings.flatMap(r => [r.ri, r.ro, -r.ri, -r.ro]))];
    return contacts.filter(v => (v - q) * sign > EPS && (target - v) * sign >= 0).reduce((best, v) => Math.abs(v - q) < Math.abs(best - q) ? v : best, target);
  }
  function begin(S, clear = false, launch = false, options = {}) {
    if (clear) cycles = passes = 0;
    const dir = (Z.coneAutoSp ?? 30) < 0 ? -1 : 1, b = S.rings[0].blocks[0], aim = dir > 0 ? 0 : Math.PI;
    const p = options.point || startPoint(S), k = p.k;
    const raw = p.raw ?? [b.lo, b.hi].reduce((a, c) => Math.abs(norm(angle(S, 0, c) - aim)) < Math.abs(norm(angle(S, 0, a) - aim)) ? c : a);
    const R = S.rings[1].ro, requested = options.route || Z.coneBallRoute;
    const route = routes[requested] ? requested : "cross", mult = fraction(Z.coneBallMult || "1"), T = options.period ?? period(S);
    const length = route === "out" ? R - p.r : R + p.r;
    F = { shape: S.shape, dir, R, route, start: { k, raw, q: p.r }, length, stage: route === "cross" ? "cross" : "out", ready: !launch,
      q: p.r, k, raw, a: angle(S, k, raw), target: route === "out" ? R : -R, reversals: 0, clean: true, waits: 0, wait: null, elapsed: 0, travel: 0, period: T, mult, speed: options.speed ?? (T && Number.isFinite(mult) ? length * mult / T : 0) };
    if (launch && !(F.speed > 0)) { F.ready = true; status(length <= EPS ? "Шарик уже на внешнем краю · выбери точку внутри или маршрут через центр" : "Для запуска нужны вращение и положительная дробная скорость"); metrics(S); return; }
    status(!enabled ? "Шарик выключен · серая точка — старт · ● вкл. — включить" : launch ? routes[route] + " · старт: " + p.label + " · скорость " + String(Z.coneBallMult || "1") + "×" : readyText(S));
    metrics(S);
  }
  function prepare(S, clear = false, launch = false) {
    balls = [];
    if (!allStarts()) { begin(S, clear, launch); return; }
    if (clear) cycles = passes = 0;
    const T = period(S), mult = fraction(Z.coneBallMult || "1"), speed = T && Number.isFinite(mult) ? 2 * S.rings[1].ro * mult / T : 0;
    batchBusy = true;
    try {
      boundaryPoints(S).forEach((point, i) => {
        begin(S, false, launch, { point, route: point.r === 0 ? "out" : "cross", period: T, speed });
        balls.push(Object.assign(F, { id: point.id, label: point.label, number: i + 1 }));
      });
    } finally { batchBusy = false; F = balls[0] || null; }
    batchStatus(); metrics(S);
  }
  function batchStatus() {
    if (!balls.length) return;
    const count = balls.length, edges = count - 9;
    if (!enabled) { status("Шарики выключены · " + count + " серых точек — старты · нажми ● вкл. или ▶ запуск"); return; }
    if (balls.every(b => b.ready) && !(balls[0].speed > 0)) { status(count + " шариков на местах · для запуска нужны вращение и положительная дробная скорость"); return; }
    if (balls.every(b => b.ready)) { status(count + " шариков на местах: 4 внешних + 4 внутренних угла К2 + " + edges + " края К1 + центр · ▶ запуск вместе с вращением"); return; }
    const done = balls.filter(b => b.stage === "done"), waiting = balls.filter(b => b.wait && b.stage !== "done");
    const moving = balls.length - done.length - waiting.length, clean = done.filter(b => b.clean).length;
    status((paused ? "Пауза · " : "") + count + " шариков · движутся " + moving + " · ждут " + waiting.length + " · вышли " + done.length + " · без ожидания " + clean + (waiting.length ? " · красные: НЕ проход" : ""));
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
    F.clean = false; F.waits++; F.wait = { k: hit.k, bit: hit.bit, a: F.a, join: hit.join };
    status(hit.join !== undefined ? `Ждёт совпадения граней у кольца ${hit.k + 1} · НЕ проход · ожиданий ${F.waits}` : `2 кольца · ждёт: кольцо ${hit.k + 1}, бит ${hit.bit} · НЕ проход · ожиданий ${F.waits}`);
  }
  // A straight flight has a fixed world angle. Rotation only moves obstacles;
  // it must never carry a ball sideways along an inner circular boundary.
  function straightOpen(C, t, sign) {
    const S = C.at(t), contact = nextContact(S, F.q, sign * F.R);
    const amount = Math.min(C.distance * (1 - t), Math.abs(contact - F.q), 1e-4);
    if (amount <= 1e-12) return true;
    const h = amount / C.distance;
    return !radialHit(S, F.q, F.q + sign * amount, F.a, 0, C.delta.map(d => d * h));
  }
  function straightTurn(sign) {
    F.target = sign * F.R; F.stage = sign > 0 ? "out" : "cross";
    F.length = F.travel + Math.abs(F.target - F.q);
    F.reversals++; F.clean = false;
  }
  function straightRelease(C, from) {
    const S = C.at(0), candidates = [from];
    // Check every opening that sweeps across the fixed position, including
    // both directions when the ball is exactly at the center.
    const sides = Math.abs(F.q) < EPS ? [0, Math.PI] : [F.q < 0 ? Math.PI : 0];
    for (let k = 0; k < 2; k++) {
      const v = -C.delta[k]; if (Math.abs(v) < 1e-12) continue;
      for (const side of sides) for (const b of S.rings[k].blocks) for (const edge of [b.lo, b.hi]) {
        const u = F.a + side - S.rings[k].phase - S.spin;
        const lo = Math.ceil((Math.min(u + v * from, u + v) - edge) / TAU - EPS);
        const hi = Math.floor((Math.max(u + v * from, u + v) - edge) / TAU + EPS);
        for (let j = lo; j <= hi; j++) candidates.push((edge + j * TAU - u) / v);
      }
    }
    const sign = F.target > F.q ? 1 : -1;
    for (const candidate of candidates.sort((a, b) => a - b)) {
      if (candidate < from - EPS || candidate >= 1 - 1e-10) continue;
      const t = Math.max(from, candidate);
      if (straightOpen(C, t, sign)) return { t, sign };
      if (straightOpen(C, t, -sign)) return { t, sign: -sign };
    }
    return null;
  }
  function advanceStraight(dt, C, B) {
    let t = 0, guard = 0;
    while (t < 1 - 1e-10 && guard++ < 64) {
      if (Math.abs(F.q - F.target) <= EPS) { finish(); break; }
      if (F.wait) {
        const release = straightRelease(C, t);
        if (!release) { F.elapsed += dt * (1 - t); break; }
        F.elapsed += dt * (release.t - t); t = release.t; F.wait = null;
        if (release.sign !== (F.target > F.q ? 1 : -1)) straightTurn(release.sign);
      }
      const S = C.at(t), sign = F.target > F.q ? 1 : -1;
      const contact = nextContact(S, F.q, F.target);
      const amount = Math.min(C.distance * (1 - t), Math.abs(contact - F.q)), h = amount / C.distance;
      const hit = radialHit(S, F.q, F.q + sign * amount, F.a, 0, C.delta.map(d => d * h));
      const fraction = hit ? hit.t : 1;
      F.q += sign * amount * fraction; F.travel += amount * fraction;
      F.elapsed += dt * h * fraction; t += h * fraction;
      if (hit) {
        straightTurn(-sign);
        if (straightOpen(C, t, -sign)) continue;
        waitAt(hit); continue;
      }
      if (Math.abs(F.q - F.target) <= EPS) { finish(); break; }
    }
    metrics(B);
  }
  function advance(dt, A, B) {
    if (!enabled || !F || F.ready || F.stage === "done" || !(dt > 0)) return;
    if (!A || !B || A.shape !== F.shape || B.shape !== F.shape) { F = null; status(hint()); return; }
    const dir = (Z.coneAutoSp ?? 30) < 0 ? -1 : 1;
    if (dir !== F.dir) { begin(A, true); status("Направление изменено · ▶ запуск — новый опыт"); return; }
    const C = frame(A, B, dt); if (!(C.distance > 0)) { status("Нужна положительная дробная скорость и вращение колец"); return; }
    advanceStraight(dt, C, B);
  }
  function finish() {
    F.stage = "done"; cycles++; if (F.clean) passes++;
    status(routes[F.route] + " · " + (F.clean ? "ПРОХОД без ожидания" : "НЕ проход: было ожидание или разворот") + " · время " + F.elapsed.toFixed(3) + " с · чистых " + passes + "/" + cycles);
  }
  window.zzBallActive = () => enabled && !!snapshot();
  window.zzBallBeforeSpin = () => {
    if (!enabled) return null;
    const S = snapshot(); if (!S) { status(hint()); return null; }
    if (!F || F.shape !== S.shape) prepare(S); return S;
  };
  window.zzBallAfterSpin = (dt, before) => {
    if (!enabled) return;
    const S = snapshot();
    if (!balls.length) { advance(dt, before, S); return; }
    if (!before || !S || balls.some(b => b.shape !== S.shape || b.shape !== before.shape)) { balls = []; F = null; status(hint()); return; }
    if (balls.some(b => b.dir !== ((Z.coneAutoSp ?? 30) < 0 ? -1 : 1))) { prepare(S, true); status("Направление изменено · ▶ — общий запуск"); return; }
    batchBusy = true;
    try { for (const ball of balls) { F = ball; advance(dt, before, S); } }
    finally { batchBusy = false; F = balls[0]; }
    batchStatus(); metrics(S);
  };
  window.zzBallSpinState = on => {
    paused = !on; if (!enabled) return;
    if (on && snapshot() && typeof coneReleaseRings === "function") coneReleaseRings();
    const S = snapshot(); if (on && S && (!F || F.ready)) prepare(S, true, true);
    if (balls.length) { batchStatus(); if (S) metrics(S); return; }
    if (on && F && !F.wait && F.stage !== "done") status(F.clean ? routes[F.route] + " · постоянная скорость по дорожке" : "Продолжает · НЕ проход (было ожидание)");
    else if (!on && F && !F.ready && F.stage !== "done" && !F.wait) status("Пауза вместе с вращением · ▶ — продолжить");
  };
  window.zzBallRemember = () => {}; // Straight flights retain their launch line.
  window.zzBallDraw = (g, o) => {
    const { cx, cy, dr, dpr } = o, S = snapshot();
    if (S) {
      if (!F || F.shape !== S.shape) prepare(S, true);
      const R = S.rings[1].ro * dr;
      g.save(); g.lineWidth = dpr; g.strokeStyle = "#79e7e1"; g.globalAlpha = 0.26; g.setLineDash([3 * dpr, 4 * dpr]);
      for (const b of S.rings[1].blocks) { const lo = angle(S, 1, b.lo), hi = angle(S, 1, b.hi); g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + R * Math.cos(lo), cy + R * Math.sin(lo)); g.arc(cx, cy, R, lo, hi); g.lineTo(cx, cy); g.stroke(); }
      g.restore();
      if ($("ballLabPoints") && Z.coneBallPoints !== false && lab && !lab.classList.contains("pmin")) {
        markers = (allStarts() ? boundaryPoints(S) : singlePoints(S)).map(p => { const a = p.raw === null ? 0 : angle(S, p.k, p.raw); return { ...p, x: cx + p.r * dr * Math.cos(a), y: cy + p.r * dr * Math.sin(a) }; });
        drawn = { dpr }; const unique = [];
        g.save(); g.lineWidth = 1.5 * dpr;
        for (const p of markers) {
          if (unique.some(v => Math.hypot(v.x - p.x, v.y - p.y) < 2 * dpr)) continue; unique.push(p);
          const selected = allStarts() || markers.some(v => v.id === (Z.coneBallStart || "center") && Math.hypot(v.x - p.x, v.y - p.y) < 2 * dpr);
          const joint = p.r === 1 && markers.some(v => v.r === 1 && v.k !== p.k && Math.hypot(v.x - p.x, v.y - p.y) < Math.max(dr * 1e-6, 1e-8));
          g.strokeStyle = selected ? "#ffd166" : joint ? "#7ee787" : p.kind === "edge" ? "#79e7e1" : "#cd94ff";
          g.fillStyle = "#10141c"; g.beginPath(); g.arc(p.x, p.y, (selected ? 6 : 4) * dpr, 0, TAU); g.fill(); g.stroke();
        }
        g.restore();
      } else { markers = []; drawn = null; }
      for (const ball of balls.length ? balls : F ? [F] : []) if (ball.ready) { ball.q = ball.start.q; ball.a = angle(S, ball.start.k, ball.start.raw); }
      metrics(S);
    }
    if (!S) { markers = []; drawn = null; F = null; balls = []; metrics(null); status(enabled ? hint() : "Шарики выключены · нажми ● вкл. · " + hint()); }
    const positions = [];
    for (const ball of balls.length ? balls : F ? [F] : []) {
      const q = ball.q * dr, a = ball.wait ? ball.wait.a : ball.a;
      const x = cx + q * Math.cos(a), y = cy + q * Math.sin(a);
      const color = !enabled ? "#a8b3c5" : ball.wait || ball.stage === "done" && !ball.clean ? "#ff5f6d" : ball.stage === "done" ? "#7ee787" : "#79e7e1";
      g.save(); g.fillStyle = color; g.shadowColor = color; g.shadowBlur = 9 * dpr; g.beginPath(); g.arc(x, y, 4 * dpr, 0, TAU); g.fill(); g.shadowBlur = 0;
      if (ball.number) {
        // Offset only the labels when starts coincide; retain exact positions.
        const overlap = positions.filter(p => Math.hypot(p.x - x, p.y - y) < 12 * dpr).length;
        g.font = "bold " + 16 * dpr + "px monospace"; g.textAlign = "left"; g.textBaseline = "bottom";
        const tx = x + 7 * dpr, ty = y - (8 + 18 * overlap) * dpr;
        g.lineWidth = 4 * dpr; g.strokeStyle = "#0b0d12"; g.strokeText(String(ball.number), tx, ty); g.fillText(String(ball.number), tx, ty);
      }
      positions.push({ x, y }); g.restore();
    }
  };
  function reset(home = false) {
    F = null; balls = []; cycles = passes = 0;
    if (home) homeRotation();
    const S = snapshot(); if (S) prepare(S, true); else { metrics(null); status(enabled ? hint() : "Шарики выключены · нажми ● вкл. · " + hint()); } renderCone();
  }
  function homeRotation() {
    pauseRotation();
    const speed = Z.coneAutoSp, mode = Z.coneSpinMode;
    $("bConeAllHome").click();
    // The home pose can store its own spin settings. Keep this experiment's.
    Z.coneAutoSp = speed; Z.coneSpinMode = mode;
    if ($("coneSpinMode")) $("coneSpinMode").value = mode || "all";
    if (typeof coneDirUi === "function") coneDirUi();
    if (typeof coneSpinModeUi === "function") coneSpinModeUi();
    if (typeof spinSpUi === "function") spinSpUi();
    save();
  }
  function metrics(S) {
    if (batchBusy || !$("ballLabTime")) return;
    const P = S ? singlePoints(S) : [{ id: "center", label: "Центр" }], key = P.map(p => p.id).join("|");
    if (key !== lastPoints) {
      const select = $("ballLabStart"); select.replaceChildren();
      const all = document.createElement("option"); all.value = "all"; all.textContent = "Все " + (S ? boundaryPoints(S).length : 11) + ": углы К2, края К1 и центр"; select.appendChild(all);
      for (const p of P) { const opt = document.createElement("option"); opt.value = p.id; opt.textContent = p.label; select.appendChild(opt); }
      lastPoints = key;
    }
    $("ballLabStart").value = allStarts() ? "all" : S ? startPoint(S).id : "center";
    const T = F && !F.ready ? F.period : S ? period(S) : null, mult = F && !F.ready ? F.mult : fraction(Z.coneBallMult || "1");
    const elapsed = balls.length ? Math.max(...balls.map(b => b.elapsed)) : F ? F.elapsed : 0;
    const text = T && Number.isFinite(mult) ? "T₀ " + T.toFixed(3) + " с · " + (allStarts() ? "диаметр" : "путь") + " за " + (T / mult).toFixed(3) + " с" + (F && !F.ready ? " · прошло " + elapsed.toFixed(3) + " с" : "") : "Нужны два вращающихся кольца и положительная дробь";
    if ($("ballLabTime").textContent !== text) $("ballLabTime").textContent = text;
    $("ballLabRun").textContent = F && !F.ready ? "↻ новый запуск" : "▶ запуск";
    labControls();
  }
  function choose(id) { pauseRotation(); Z.coneBallBatch = id === "all"; if (id !== "all") Z.coneBallStart = id; save(); reset(); }
  function launch(config = {}) {
    if (config.start !== undefined) { Z.coneBallBatch = config.start === "all"; if (config.start !== "all") Z.coneBallStart = config.start; }
    if (config.batch !== undefined) Z.coneBallBatch = !!config.batch;
    if (config.route !== undefined && routes[config.route]) Z.coneBallRoute = config.route;
    if (config.mult !== undefined) Z.coneBallMult = String(config.mult);
    else if ($("ballLabSpeed")) Z.coneBallMult = $("ballLabSpeed").value.trim();
    if (!Number.isFinite(fraction(Z.coneBallMult || "1"))) { status("Скорость: введи положительную дробь, например 1/3, 3/4 или 1,5"); return false; }
    pauseRotation(); F = null; balls = []; homeRotation();
    enabled = true; Z.coneBallOn = true; ui();
    if (typeof coneReleaseRings === "function") coneReleaseRings();
    const S = snapshot(); if (!S) { status(hint()); return false; }
    prepare(S, true, true); save(); if (F.ready) return false;
    if (!coneSpinning) $("bConeAuto").click();
    paused = !coneSpinning;
    renderCone(); return true;
  }
  window.zzBallLaunch = launch;
  window.zzBallPoints = () => { const S = snapshot(); return S ? allStarts() ? boundaryPoints(S) : singlePoints(S) : []; };
  function ballInfo(b) { return { id: b.id, number: b.number, label: b.label, route: b.route, stage: b.stage, ready: b.ready, speed: b.speed, period: b.period, multiplier: b.mult, length: b.length, distance: b.travel, elapsed: b.elapsed, clean: b.clean, waits: b.waits, reversals: b.reversals, waiting: !!b.wait, q: b.q, angle: b.a }; }
  window.zzBallInfo = () => F && { ...ballInfo(F), batch: allStarts(), balls: balls.map(ballInfo) };
  window.zzBallLabSync = () => {
    if (!lab) return;
    plateFoldSync(lab);
    if (!lab._pzk) plateZig(lab, SOL_PLATES.solBallLab.col);
    platePlace(lab);
  };
  function initLab() {
    if (typeof ZZ_BG !== "undefined" && ZZ_BG) return;
    const host = $("w-cone").querySelector(":scope > .wbody");
    lab = document.createElement("div"); lab.id = "solBallLab";
    if (Z.coneBallLabMin === undefined) Z.coneBallLabMin = Z.coneBallLabOpen === false;
    lab.innerHTML = `<div class="rth"><span>● Шарики</span><span class="pbtn"><button type="button" class="pminbtn">−</button></span></div><div class="ball-lab-body">
      <div class="ball-lab-row"><button id="ballLabEnable" type="button">● вкл.</button><label>Путь <select id="ballLabRoute"><option value="cross">через центр</option><option value="out">на вылет</option></select></label><button id="ballLabPoints" type="button" aria-pressed="true">◎ точки</button></div>
      <label>Старт <select id="ballLabStart"><option value="all">Все 11: углы К2, края К1 и центр</option></select></label>
      <div class="ball-lab-row"><span>Кольцо 1</span><button type="button" data-ball-ring="0" data-step="-.5">−½</button><button type="button" data-ball-ring="0" data-step=".5">+½</button><span>Кольцо 2</span><button type="button" data-ball-ring="1" data-step="-.5">−½</button><button type="button" data-ball-ring="1" data-step=".5">+½</button></div>
      <div class="ball-lab-row"><label>Скорость × <input id="ballLabSpeed" type="text" inputmode="text" value="1" aria-label="Множитель скорости, десятичное число или дробь"></label><span class="ball-lab-fractions"><button type="button" data-ball-speed="1/4">¼</button><button type="button" data-ball-speed="1/3">⅓</button><button type="button" data-ball-speed="1/2">½</button><button type="button" data-ball-speed="2/3">⅔</button><button type="button" data-ball-speed="1">1</button><button type="button" data-ball-speed="3/2">³⁄₂</button><button type="button" data-ball-speed="2">2</button><button type="button" data-ball-speed="4">4</button><button type="button" data-ball-speed="8">8</button><button type="button" data-ball-speed="16">16</button><button type="button" data-ball-speed="32">32</button></span></div>
      <small>Все старты: одинаковая постоянная скорость — диаметр за T₀ (½× — за 2T₀). T₀ — минимальный период повторения двух колец. Для одиночного старта — выбранный путь за T₀.</small>
      <div id="ballLabTime"></div><div class="ball-lab-row"><button id="ballLabRun" type="button">▶ запуск</button><button id="ballLabPause" type="button">⏸ пауза</button><button id="ballLabReset" type="button">↩ к старту</button><button id="ballLabDir" type="button">↻ / ↺</button></div>
      <small>1–4: внешние углы К2 · 5–8: внутренние · далее края К1 и центр. При закрытом проходе каждый шарик разворачивается по той же прямой; если обе стороны закрыты — ждёт. Красный — ожидание, зелёный — выход без ожидания и разворота. Новый запуск возвращает кольца и шарики на места. Нажми точку для одиночного старта.</small><div id="ballLabStatus" role="status" aria-live="polite"></div></div>`;
    host.appendChild(lab); $("ballLabRoute").value = routes[Z.coneBallRoute] ? Z.coneBallRoute : "cross"; $("ballLabSpeed").value = Z.coneBallMult || "1";
    $("ballLabEnable").onclick = () => $("bConeBall").click();
    $("ballLabRun").onclick = () => launch();
    $("ballLabPause").onclick = () => { if (paused && (!enabled || !F || F.ready)) launch(); else $("bConeAuto").click(); };
    $("ballLabReset").onclick = () => reset(true);
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
    plateInit(lab);
    new MutationObserver(() => {
      Z.coneBallLabOpen = !lab.classList.contains("pmin"); renderCone();
    }).observe(lab, { attributes: true, attributeFilter: ["class"] });
    const source = $("coneBallStatus"), syncStatus = () => { $("ballLabStatus").textContent = source.textContent; };
    new MutationObserver(syncStatus).observe(source, { childList: true, characterData: true, subtree: true }); syncStatus();
    $("coneCv").addEventListener("pointerdown", e => {
      if (!enabled || !drawn || e.button && e.button !== 0) return;
      const cv = $("coneCv"), r = cv.getBoundingClientRect(), x = (e.clientX - r.left) * cv.width / r.width, y = (e.clientY - r.top) * cv.height / r.height;
      const point = markers.reduce((best, p) => !best || Math.hypot(p.x - x, p.y - y) < Math.hypot(best.x - x, best.y - y) ? p : best, null);
      if (!point || Math.hypot(point.x - x, point.y - y) > 14 * drawn.dpr) return;
      e.preventDefault(); e.stopImmediatePropagation(); choose(point.id);
    }, true);
    ui(); window.zzBallLabSync();
  }
  function init() {
    if (!$("bConeBall")) return;
    enabled = Z.coneBallOn !== false; paused = !coneSpinning; ui(); reset();
    $("bConeBall").onclick = () => {
      enabled = !enabled; Z.coneBallOn = enabled; ui(); save(); reset();
      if (enabled && coneSpinning) { window.zzBallSpinState(true); renderCone(); }
    };
    $("bConeBallReset").onclick = () => reset(true);
    initLab(); reset();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true }); else init();
})();
