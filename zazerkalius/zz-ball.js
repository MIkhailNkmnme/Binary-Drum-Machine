/* Solaris: a ball moves along the straight edges of ring bits and turns
   with its ring. At the ring joint and at the centre it moves onto a
   coincident edge; otherwise it reverses along its own edge.
   Optional outer arcs synchronize the next crossing with a separate speed.
   The rotation clock owns the experiment. */
(() => {
  "use strict";
  const TAU = 2 * Math.PI, EPS = 1e-7, ALIGN = 1e-6;
  const $ = id => document.getElementById(id);
  const norm = a => ((a + Math.PI) % TAU + TAU) % TAU - Math.PI;
  let F = null, enabled = false, paused = true, cycles = 0, passes = 0;
  let balls = [], batchBusy = false;
  let markers = [], drawn = null, lab = null, lastPoints = "";
  const routes = { out: "на вылет", cross: "через центр" };
  // v0.954, «текст — убери из окна»: пояснения, T₀ и состояние — в подсказках (заголовок, ▶ запуск, скорость), не строками в окне.
  const LAB_HELP = "Все старты: одинаковая постоянная скорость — диаметр за T₀ (½× — за 2T₀). T₀ — минимальный период повторения двух колец. Для одиночного старта — выбранный путь за T₀.\n1–4: внешние углы К2 · 5–8: внутренние · далее края К1 и центр. В обычном режиме шарик едет по прямым краям битов и поворачивается вместе со своим кольцом. Шарики переходят на К3 и следующие видимые кольца, включая кольцо за чертой. В ∞ на самом внешнем краю шарик огибает дугу и снова идёт через центр. Скорость на прямых сохраняется. Если впереди нет совпавшей прямой, в ∞ и на внешних кольцах шарик ждёт на своей дуге (жёлтый), вращаясь с ней, и продолжает при первом совпадении. При обычном опыте на К1–К2 несовпадение по-прежнему даёт разворот. Красный — был разворот, зелёный — выход без разворота. ↩ к старту и новый запуск возвращают кольца к последнему ручному повороту перед стартом, шарики — на старты. Нажми точку для одиночного старта.";
  const allStarts = () => Z.coneBallBatch !== false;
  const throughCount = () => [2, 3, 4].includes(+Z.coneBallThroughCount) ? +Z.coneBallThroughCount : 1;
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
    const w = rate(S).slice(0, 2), periods = w.map((v, k) => {
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
  // Solve the two joint crossings, not a frame-by-frame speed sweep. The ball
  // moves at constant radial speed; each candidate is an exact first alignment.
  function solveThrough(S, w, T, requestedPoint) {
    if (!S || w.length < 2 || !T) return { error: "Для расчёта нужны два кольца и ненулевая скорость вращения" };
    w = w.slice(0, 2);
    const J = S.rings[1].ri, R = S.rings[1].ro, width = R - J;
    if (Math.abs(S.rings[0].ro - J) > EPS) return { error: "Для сквозного прохода включи кольца без промежутков" };
    const edges = S.rings.map(r => [...new Set(r.blocks.flatMap(b => [b.lo, b.hi]))]);
    const starts = boundaryPoints(S).filter(p => p.k === 1 && Math.abs(p.r - R) < EPS)
      .sort((a, b) => Math.cos(angle(S, 1, a.raw)) - Math.cos(angle(S, 1, b.raw)));
    const selected = !allStarts() && starts.find(p => p.id === Z.coneBallStart);
    const points = requestedPoint ? [requestedPoint] : selected ? [selected] : starts;
    const dw = w[0] - w[1], equal = Math.abs(dw) < 1e-12;
    for (const point of points) {
      const candidates = [];
      for (const e of edges[0]) {
        // A centre crossing needs a physical edge on the opposite radius.
        const opposite = edges[0].find(f => Math.abs(norm(f - e - Math.PI)) < ALIGN);
        if (opposite === undefined) continue;
        const phase = norm(angle(S, 1, point.raw) - angle(S, 0, e));
        const times = equal ? (Math.abs(phase) < ALIGN ? [width * T / (2 * R)] : []) :
          Array.from({ length: 129 }, (_, n) => (phase + (n - 64) * TAU) / dw);
        for (const t of times) {
          if (!(t > EPS)) continue;
          const speed = width / t, duration = 2 * R / speed, mult = T / duration;
          if (!(mult > 0 && mult <= 1000)) continue;
          const t2 = (R + J) / speed, a2 = angle(S, 0, opposite) + w[0] * t2;
          const exitEdge = edges[1].find(f => Math.abs(norm(angle(S, 1, f) + w[1] * t2 - a2)) < ALIGN);
          if (exitEdge !== undefined) candidates.push({ point, speed, mult, duration, times: [t, R / speed, t2, duration] });
        }
      }
      if (candidates.length) return candidates.sort((a, b) => a.duration - b.duration)[0];
    }
    return { error: "Проход не найден за 64 относительных оборота. Попробуй другой старт или поворот кольца" };
  }
  function solveGroup(S, w, T, count) {
    const first = solveThrough(S, w, T);
    if (first.error || count === 1) return first.error ? first : { runs: [first] };
    const starts = boundaryPoints(S).filter(p => p.k === 1 && Math.abs(p.r - S.rings[1].ro) < EPS);
    const unique = starts.filter((p, i) => !starts.slice(0, i).some(q => Math.abs(norm(p.raw - q.raw)) < ALIGN));
    const opposite = unique.find(p => Math.abs(norm(p.raw - first.point.raw - Math.PI)) < ALIGN);
    if (!opposite) return { error: "Для встречной пары нужны противоположные внешние грани" };
    const second = solveThrough(S, w, T, opposite);
    if (second.error || Math.abs(second.mult / first.mult - 1) > 1e-9) return { error: "Встречная пара с общей скоростью для этого положения не найдена" };
    Object.assign(second, { speed: first.speed, mult: first.mult, duration: first.duration, times: first.times.slice() });
    const runs = [first, second];
    for (const p of unique) {
      if (runs.length >= count) break;
      if (runs.some(r => r.point.id === p.id)) continue;
      const result = solveThrough(S, w, T, p);
      if (!result.error) runs.push(result);
    }
    return runs.length === count ? { runs } : { error: "Найдено сквозных стартов: " + runs.length + " из " + count + ". Попробуй другое положение колец" };
  }
  function movingGroup(S, w, T, count) {
    const group = solveGroup(S, w, T, count);
    if (!group.error || !Z.coneBallArc || !T) return group;
    // Waiting makes an initially unmatched pose usable too. Keep four physical
    // outer starts, rather than requiring a precomputed uninterrupted crossing.
    const points = boundaryPoints(S).filter(p => p.k === 1 && Math.abs(p.r - S.rings[1].ro) < EPS);
    const unique = points.filter((p, i) => !points.slice(0, i).some(q => Math.abs(norm(p.raw - q.raw)) < ALIGN));
    const mult = fraction(Z.coneBallMult || "1");
    if (unique.length < count || !Number.isFinite(mult)) return group;
    const first = unique.find(p => p.id === Z.coneBallStart) || unique[0];
    const opposite = unique.find(p => Math.abs(norm(p.raw - first.raw - Math.PI)) < ALIGN);
    if (count > 1 && !opposite) return group;
    const ordered = [first, ...(opposite ? [opposite] : []), ...unique.filter(p => p !== first && p !== opposite)];
    const speed = 2 * S.rings[1].ro * mult / T;
    return { runs: ordered.slice(0, count).map(point => ({ point, speed, mult, duration: T / mult })) };
  }
  function speedText(value) {
    for (let d = 1; d <= 128; d++) {
      const n = Math.round(value * d);
      if (n > 0 && Math.abs(n / d - value) < 1e-12 * value) return d === 1 ? String(n) : n + "/" + d;
    }
    return String(value);
  }
  // Keep the straight-edge speed. Choose a constant speed on the next outer
  // arc so that BOTH joints of the following centre crossing line up again.
  function planArc(S, w, ball) {
    if (ball.k !== 1 || S.rings.length !== 2) return null;
    const block = S.rings[1].blocks.find(b => [b.lo, b.hi].some(e => Math.abs(norm(e - ball.raw)) < ALIGN));
    if (!block || !(ball.speed > 0)) return null;
    const fromLo = Math.abs(norm(block.lo - ball.raw)) < ALIGN;
    const from = fromLo ? block.lo : block.hi, to = fromLo ? block.hi : block.lo;
    const length = ball.R * Math.abs(to - from), natural = length / ball.speed;
    const J = S.rings[1].ri, t1 = (ball.R - J) / ball.speed, t2 = (ball.R + J) / ball.speed;
    const inner = S.rings[0].blocks.flatMap(b => [b.lo, b.hi]);
    const outer = S.rings[1].blocks.flatMap(b => [b.lo, b.hi]);
    const dw = w[0] - w[1], candidates = [];
    for (const e of inner) {
      const opposite = inner.find(f => Math.abs(norm(f - e - Math.PI)) < ALIGN);
      if (opposite === undefined) continue;
      const phase = norm(angle(S, 1, to) - angle(S, 0, e));
      const equal = Math.abs(dw) < 1e-12;
      const n0 = equal ? 0 : Math.round((dw * (natural + t1) - phase) / TAU);
      const durations = equal ? (Math.abs(phase) < ALIGN ? [natural] : []) :
        Array.from({ length: 7 }, (_, j) => (phase + (n0 + j - 3) * TAU) / dw - t1);
      for (const duration of durations) {
        if (!(duration > EPS)) continue;
        const endAngle = angle(S, 0, opposite) + w[0] * (duration + t2);
        if (!outer.some(f => Math.abs(norm(angle(S, 1, f) + w[1] * (duration + t2) - endAngle)) < ALIGN)) continue;
        candidates.push({ from, to, duration, elapsed: 0, speed: length / duration });
      }
    }
    return candidates.sort((a, b) => Math.abs(a.duration - natural) - Math.abs(b.duration - natural))[0] || null;
  }
  // Every start lies on a bit edge; bit and gap axes are not tracks.
  function startPoint(S) { const P = boundaryPoints(S); return P.find(p => p.id === Z.coneBallStart) || P[P.length - 1]; }
  function pauseRotation() { if (coneSpinning) $("bConeAuto").click(); }
  function readyText(S) {
    const p = startPoint(S); return "Старт: " + p.label + " · " + (routes[Z.coneBallRoute] || routes.cross) + " · ▶ запуск";
  }
  function status(s) { if (batchBusy) return; const el = $("coneBallStatus"); if (el && el.textContent !== s) el.textContent = s; if (el) el.title = s; }
  function snapshot() {
    if (!coneGeom || !coneCutOn() || !(coneHalfOn() || coneQuadOn() && conePartCount() % 2 === 0) || !(Z.coneClock || coneSunOn()) || Z.cone3d || Z.conePoly || cutPrevMode() || coneFreeOn() || Z.coneBitStep) return null;
    const N = Math.min(Z.rows.length, CONE_MAX);
    if (N + (coneGeom.fill ? 1 : 0) < 2) return null;
    const band = Z.coneClean ? 1 : 0.72, rings = [];
    for (let i = 0; i < N + (coneGeom.fill ? 1 : 0); i++) {
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
    // Include all visible rings in the counters, even though the route uses two.
    const rotation = [];
    for (let i = 0; i < N + (coneGeom.fill ? 1 : 0); i++) {
      const R = coneRingFeat(i === N ? "f" : i);
      rotation.push(R ? -R.x0 * R.step : 0);
    }
    return { rings, rotation, spin: (Z.coneSpin || 0) * Math.PI / 180, shape: rings.map(r => r.shape).join("|") };
  }
  function hint() { return "Для шариков: 2 части или 2 по симметрии у строки 1, 2 бита второго кольца (пустые тоже подходят), плоский вид и плавное кручение"; }
  function ui() {
    const b = $("bConeBall"); if (!b) return;
    b.classList.toggle("on", enabled); b.setAttribute("aria-pressed", String(enabled)); b.textContent = "● шарики";
    if ($("ballLabEnable")) {
      $("ballLabEnable").textContent = enabled ? "● вкл." : "○ выкл.";
      $("ballLabEnable").title = enabled ? "Шарики включены. Нажми, чтобы выключить их совсем: на конусе их не будет, панель спрячется; включить снова — «● шарики» в «Кручении»." : "Шарики выключены. Нажми, чтобы включить.";
      $("ballLabEnable").setAttribute("aria-pressed", String(enabled));
    }
    // v0.960, «а как совсем их отключить?»: выключены — на конусе ничего (ни шариков, ни точек стартов, ни пунктира) и панель спрятана;
    // включает их снова «● шарики» в «Кручении»
    if (lab) { const d = enabled ? "" : "none"; if (lab.style.display !== d) { lab.style.display = d; if (enabled) { lab._pzk = ""; window.zzBallLabSync(); } } }
    labControls();
  }
  function labControls() {
    if (!$("ballLabTime")) return;
    $("ballLabEnable").setAttribute("aria-pressed", String(enabled));
    $("ballLabPoints").setAttribute("aria-pressed", String(Z.coneBallPoints !== false));
    const mult = fraction(Z.coneBallMult || "1");
    lab.querySelectorAll("[data-ball-speed]").forEach(b => b.setAttribute("aria-pressed", String(Math.abs(fraction(b.dataset.ballSpeed) - mult) < 1e-10)));
    $("ballLabSpeed").dataset.active = String(Number.isFinite(mult));
    $("ballLabRoute").disabled = allStarts() || throughCount() > 1;
    $("ballLabRoute").value = allStarts() ? "cross" : routes[Z.coneBallRoute] ? Z.coneBallRoute : "cross";
    $("ballLabRoute").dataset.active = "true";
    $("ballLabStart").dataset.active = String(!!$("ballLabStart").value);
    const started = enabled && (balls.length ? balls : F ? [F] : []).some(b => !b.ready && b.stage !== "done");
    $("ballLabRun").setAttribute("aria-pressed", String(started && !paused));
    $("ballLabPause").setAttribute("aria-pressed", String(started && paused));
    $("ballLabPause").textContent = paused ? "▶ продолжить" : "⏸ пауза";
    $("ballLabDir").textContent = (Z.coneAutoSp ?? 30) < 0 ? "↺ против" : "↻ по часовой";
    $("ballLabDir").dataset.active = "true";
    if ($("ballLabArc")) $("ballLabArc").setAttribute("aria-pressed", String(!!Z.coneBallArc));
    const through = $("ballLabThrough");
    if (through) {
      const single = !balls.length && F && F.through;
      through.setAttribute("aria-pressed", String(!!single));
      through.textContent = single && F.stage === "done" ? (F.clean ? "✓ сквозной" : "✕ проход") : "↦ сквозной";
      lab.querySelectorAll("[data-ball-through]").forEach(b => {
        const active = balls.length === +b.dataset.ballThrough && balls.every(x => x.through);
        b.setAttribute("aria-pressed", String(active));
        b.textContent = (active && balls.every(x => x.stage === "done") ? (balls.every(x => x.clean) ? "✓ " : "✕ ") : +b.dataset.ballThrough === 2 ? "⇄ " : "↦ ") + b.dataset.ballThrough;
      });
      const group = balls.length > 1 && balls.every(x => x.through);
      const mixed = group && balls.some(x => Math.abs(x.mult / balls[0].mult - 1) > 1e-9);
      $("ballLabSpeed").readOnly = mixed;
      if (mixed) $("ballLabSpeed").value = "разные";
      else if ($("ballLabSpeed").value === "разные") $("ballLabSpeed").value = Z.coneBallMult || "1";
      const speeds = $("ballLabGroupSpeeds");
      speeds.hidden = !group;
      if (group) {
        speeds.textContent = balls.map(x => x.number + ": " + speedText(x.mult) + "×").join(" · ");
        $("ballLabRun").title = $("ballLabSpeed").title = "Сквозная группа · " + speeds.textContent + ". Скорость на прямых постоянна; в режиме ∞ скорость на дуге подбирается отдельно. Столкновений нет.";
        if (mixed) lab.querySelectorAll("[data-ball-speed]").forEach(b => b.setAttribute("aria-pressed", "false"));
      }
    }
  }
  function angle(S, k, raw) { return raw + S.rings[k].phase + S.spin; }
  function begin(S, clear = false, launch = false, options = {}) {
    if (clear) cycles = passes = 0;
    const dir = (Z.coneAutoSp ?? 30) < 0 ? -1 : 1, b = S.rings[0].blocks[0], aim = dir > 0 ? 0 : Math.PI;
    const p = options.point || startPoint(S), k = p.k;
    const raw = p.raw ?? [b.lo, b.hi].reduce((a, c) => Math.abs(norm(angle(S, 0, c) - aim)) < Math.abs(norm(angle(S, 0, a) - aim)) ? c : a);
    const R = S.rings[S.rings.length - 1].ro, requested = options.route || Z.coneBallRoute;
    const route = routes[requested] ? requested : "cross", mult = fraction(Z.coneBallMult || "1"), T = options.period ?? period(S);
    const move = route === "out" ? 1 : -1, length = route === "out" ? R - p.r : R + p.r;
    F = { shape: S.shape, dir, R, route, start: { k, raw, q: p.r }, length, move, stage: move > 0 ? "out" : "in", ready: !launch,
      q: p.r, k, raw, a: angle(S, k, raw), reversals: 0, clean: true, elapsed: 0, travel: 0, period: T, mult, speed: options.speed ?? (T && Number.isFinite(mult) ? length * mult / T : 0), loop: !!Z.coneBallArc, crossings: 0, arcs: 0 };
    F.ringTurns = (S.rotation || S.rings).map(() => 0);
    if (launch && !(F.speed > 0)) { F.ready = true; status(length <= EPS ? "Шарик уже на внешнем краю · выбери точку внутри или маршрут через центр" : "Для запуска нужны вращение и положительная дробная скорость"); metrics(S); return; }
    status(!enabled ? "Шарик выключен · серая точка — старт · ● вкл. — включить" : launch ? routes[route] + " · старт: " + p.label + " · скорость " + String(Z.coneBallMult || "1") + "×" : readyText(S));
    metrics(S);
  }
  function prepare(S, clear = false, launch = false) {
    balls = [];
    if (!allStarts() && throughCount() > 1) {
      const T = period(S), group = movingGroup(S, rate(S), T, throughCount());
      if (group.error) { F = null; status(group.error); metrics(S); return; }
      if (clear) cycles = passes = 0;
      batchBusy = true;
      try {
        group.runs.forEach((r, i) => {
          begin(S, false, launch, { point: r.point, route: "cross", period: T, speed: r.speed });
          balls.push(Object.assign(F, { id: r.point.id, number: i + 1, label: r.point.label, mult: r.mult, through: true }));
        });
      } finally { batchBusy = false; F = balls[0] || null; }
      batchStatus(); metrics(S); return;
    }
    if (!allStarts()) { begin(S, clear, launch); return; }
    if (clear) cycles = passes = 0;
    const T = period(S), mult = fraction(Z.coneBallMult || "1"), speed = T && Number.isFinite(mult) ? 2 * S.rings[S.rings.length - 1].ro * mult / T : 0;
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
    if (balls.every(b => b.ready)) { status(balls.every(b => b.through) ? count + " сквозных шарика на внешних гранях · ▶ запуск" : count + " шариков на местах: 4 внешних + 4 внутренних угла К2 + " + edges + " края К1 + центр · ▶ запуск вместе с вращением"); return; }
    const done = balls.filter(b => b.stage === "done"), clean = done.filter(b => b.clean).length, turned = balls.filter(b => !b.clean).length;
    const waiting = balls.filter(b => b.stage === "wait").length;
    if (balls.some(b => b.loop)) {
      status((paused ? "Пауза · " : "") + "∞ Шарики: " + count + " · по дуге " + balls.filter(b => b.stage === "arc").length + " · ждут прямую " + waiting + " · проходов " + balls.reduce((n, b) => n + b.crossings, 0) + " · разворотов " + balls.reduce((n, b) => n + b.reversals, 0) + (done.length ? " · остановились " + done.length : "")); return;
    }
    status((paused ? "Пауза · " : "") + "Шарики: " + count + " · движутся " + (count - done.length - waiting) + " · ждут прямую " + waiting + " · вышли " + done.length + " · без разворота " + clean + (turned ? " · красные: был разворот, НЕ проход" : ""));
  }
  function frame(A, B, dt) {
    let ds = B.spin - A.spin;
    if ((Z.coneSpinMode || "all") === "all") { const expected = (Z.coneAutoSp ?? 30) * dt * Math.PI / 180; ds += TAU * Math.round((expected - ds) / TAU); }
    const delta = A.rings.map((r, k) => B.rings[k].phase - r.phase + ds);
    const at = t => ({ shape: A.shape, spin: A.spin + ds * t, rings: A.rings.map((r, k) => ({ ...r, phase: r.phase + (B.rings[k].phase - r.phase) * t })) });
    const rotations = A.rotation || A.rings.map(r => r.phase), next = B.rotation || B.rings.map(r => r.phase);
    const turnDelta = rotations.map((p, k) => ((next[k] ?? p) - p + ds) / TAU);
    return { at, delta, turnDelta, distance: F.speed * dt };
  }
  // The edge of ring k lying on world angle a at this moment, if any.
  function edgeAt(S, k, a) {
    for (const b of S.rings[k].blocks) for (const e of [b.lo, b.hi]) if (Math.abs(norm(angle(S, k, e) - a)) < ALIGN) return e;
    return null;
  }
  function turn(why) {
    F.move = -F.move; F.stage = F.move > 0 ? "out" : "in"; F.reversals++; F.clean = false;
    F.length = F.travel + (F.move > 0 ? F.R - F.q : F.q + F.R);
    status(why + " · разворот по своей грани · НЕ проход · разворотов " + F.reversals);
  }
  function waitAt(next, opposite = false) {
    F.stage = "wait"; F.wait = { next, opposite };
    status("Ждёт прямую впереди · кольцо " + (F.k + 1) + " → " + (next + 1));
  }
  // Find the first alignment inside this frame, including one that has already
  // passed by its end. Waiting rides the current ring; it adds time, not distance.
  function nextAlignment(C, t, next, opposite) {
    const S = C.at(t), a = angle(S, F.k, F.raw) + (opposite ? Math.PI : 0);
    if (!opposite) {
      const own = S.rings[F.k], target = S.rings[next];
      if (Math.abs((F.move > 0 ? own.ro - target.ri : own.ri - target.ro)) > EPS) return null;
    }
    const delta = C.delta[F.k] - C.delta[next];
    let best = null;
    for (const b of S.rings[next].blocks) for (const edge of [b.lo, b.hi]) {
      const phase = norm(a - angle(S, next, edge));
      let h = 0;
      if (Math.abs(phase) >= ALIGN) {
        if (Math.abs(delta) < 1e-12) continue;
        h = (delta > 0 ? ((-phase % TAU) + TAU) % TAU : -((phase % TAU) + TAU) % TAU) / delta;
      }
      if (h < -1e-12 || t + h > 1 + 1e-12) continue;
      if (!best || h < best.h) best = { h: Math.max(0, h), edge };
    }
    return best;
  }
  function outerArc(S, C, dt) {
    const block = S.rings[F.k].blocks.find(b => [b.lo, b.hi].some(e => Math.abs(norm(e - F.raw)) < ALIGN));
    if (!block) { waitAt(F.k - 1); return; }
    const fromLo = Math.abs(norm(block.lo - F.raw)) < ALIGN;
    const from = fromLo ? block.lo : block.hi, to = fromLo ? block.hi : block.lo;
    // Prefer the existing synchronized two-ring orbit. A wider route always
    // has a physical arc fallback and waits at its next unmatched joint.
    F.arc = planArc(S, C.delta.map(v => v / dt), F) || {
      from, to, duration: F.q * Math.abs(to - from) / F.speed, elapsed: 0, speed: F.speed
    };
    F.raw = F.arc.from; F.stage = "arc";
  }
  // The ball sits on edge F.raw of ring F.k at distance F.q from the centre,
  // so it turns with that ring. Stops: the outer rim (exit), the joint between
  // the rings and the centre. Across the joint and through the centre it goes
  // on only along an edge lying on the same line at that moment.
  function advance(dt, A, B) {
    if (!enabled || !F || F.ready || F.stage === "done" || !(dt > 0)) return;
    if (!A || !B || A.shape !== F.shape || B.shape !== F.shape) { F = null; status(hint()); return; }
    const dir = (Z.coneAutoSp ?? 30) < 0 ? -1 : 1;
    if (dir !== F.dir) { begin(A, true); status("Направление изменено · ▶ запуск — новый опыт"); return; }
    const C = frame(A, B, dt); if (!(C.distance > 0)) { status("Нужна положительная дробная скорость и вращение колец"); return; }
    let t = 0, guard = 0;
    while (t < 1 - 1e-12 && guard++ < 256) {
      if (F.stage === "wait") {
        const found = nextAlignment(C, t, F.wait.next, F.wait.opposite);
        const h = found ? Math.min(found.h, 1 - t) : 1 - t;
        F.elapsed += dt * h; t += h;
        if (!found) break;
        F.k = F.wait.next; F.raw = found.edge;
        if (F.wait.opposite) F.move = 1;
        F.wait = null; F.stage = F.move > 0 ? "out" : "in";
        status("Продолжает по прямой · кольцо " + (F.k + 1));
        continue;
      }
      if (F.stage === "arc") {
        const arc = F.arc, seconds = Math.min(dt * (1 - t), Math.max(0, arc.duration - arc.elapsed));
        arc.elapsed += seconds; F.elapsed += seconds; F.travel += arc.speed * seconds; t += seconds / dt;
        F.raw = arc.from + (arc.to - arc.from) * Math.min(1, arc.elapsed / arc.duration);
        if (arc.duration - arc.elapsed > 1e-10) break;
        F.raw = arc.to; F.arc = null; F.arcs++; F.move = -1; F.stage = "in";
        continue;
      }
      const ring = A.rings[F.k];
      const stop = F.move > 0 ? ring.ro : ring.ri;
      const amount = Math.min(C.distance * (1 - t), Math.max(0, (stop - F.q) * F.move)), h = amount / C.distance;
      F.q += F.move * amount; F.travel += amount; F.elapsed += dt * h; t += h;
      if (Math.abs(F.q - stop) > EPS) break;
      F.q = stop;
      const S = C.at(t), a = angle(S, F.k, F.raw);
      if (F.k === A.rings.length - 1 && F.move > 0) {
        F.crossings++;
        if (F.loop) { outerArc(S, C, dt); continue; }
        finish(); break;
      }
      if (!F.k && F.move < 0) {
        const e = edgeAt(S, 0, a + Math.PI);
        if (e === null) { if (F.loop) waitAt(0, true); else turn("В центре нет грани напротив"); }
        else { F.raw = e; F.move = 1; F.stage = "out"; }
        continue;
      }
      const next = F.k + F.move, target = S.rings[next];
      const touching = Math.abs(stop - (F.move > 0 ? target.ri : target.ro)) < EPS;
      const e = touching ? edgeAt(S, next, a) : null;
      if (e === null) {
        if (F.loop || F.k >= 2 || next >= 2) waitAt(next);
        else turn("Грань кольца " + (next + 1) + " не совпала");
      }
      else { F.k = next; F.raw = e; }
    }
    // Freeze each result at the exact exit, including a partial final frame.
    F.ringTurns = F.ringTurns.map((v, k) => v + (C.turnDelta[k] || 0) * Math.min(t, 1));
    F.a = angle(C.at(Math.min(t, 1)), F.k, F.raw);
    metrics(B);
  }
  function finish() {
    F.stage = "done"; cycles++; if (F.clean) passes++;
    status(routes[F.route] + " · " + (F.clean ? "ПРОХОД без разворота" : "НЕ проход: был разворот") + " · время " + F.elapsed.toFixed(3) + " с · чистых " + passes + "/" + cycles);
    if (F.loopError) status(F.loopError);
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
    const S = snapshot(); if (on && S && (!F || F.ready)) { rememberStart(); prepare(S, true, true); }
    if (balls.length) { batchStatus(); if (S) metrics(S); return; }
    if (on && F && F.stage !== "done") status(F.stage === "wait" ? "Ждёт прямую впереди · кольцо " + (F.k + 1) : F.clean ? routes[F.route] + " · по граням битов" : "Продолжает · НЕ проход (был разворот)");
    else if (!on && F && !F.ready && F.stage !== "done") status("Пауза вместе с вращением · ▶ — продолжить");
    labControls();
  };
  window.zzBallRemember = () => {}; // Balls ride their bit edges; nothing to remember.
  window.zzBallDraw = (g, o) => {
    if (!enabled) { markers = []; drawn = null; return; }   // v0.960: выключены — на конусе ничего
    const { cx, cy, dr, dpr } = o, S = snapshot();
    if (S) {
      if (!F || F.shape !== S.shape) prepare(S, true);
      const R = S.rings[1].ro * dr;
      g.save(); g.lineWidth = dpr; g.strokeStyle = "#79e7e1"; g.globalAlpha = 0.26; g.setLineDash([3 * dpr, 4 * dpr]);
      for (const b of S.rings[1].blocks) { const lo = angle(S, 1, b.lo), hi = angle(S, 1, b.hi); g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + R * Math.cos(lo), cy + R * Math.sin(lo)); g.arc(cx, cy, R, lo, hi); g.lineTo(cx, cy); g.stroke(); }
      g.restore();
      if ($("ballLabPoints") && Z.coneBallPoints !== false && lab && !lab.classList.contains("pmin")) {
        markers = boundaryPoints(S).map(p => { const a = p.raw === null ? 0 : angle(S, p.k, p.raw); return { ...p, x: cx + p.r * dr * Math.cos(a), y: cy + p.r * dr * Math.sin(a) }; });
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
      for (const ball of balls.length ? balls : F ? [F] : []) if (ball.ready) { ball.q = ball.start.q; ball.k = ball.start.k; ball.raw = ball.start.raw; }
      metrics(S);
    }
    if (!S) { markers = []; drawn = null; F = null; balls = []; metrics(null); status(enabled ? hint() : "Шарики выключены · нажми ● вкл. · " + hint()); }
    const positions = [];
    for (const ball of balls.length ? balls : F ? [F] : []) {
      // A ball turns with the ring whose edge it rides.
      if (S) ball.a = angle(S, ball.k, ball.raw);
      const q = ball.q * dr, a = ball.a;
      const x = cx + q * Math.cos(a), y = cy + q * Math.sin(a);
      const color = !enabled ? "#a8b3c5" : ball.stage === "wait" ? "#ffd166" : !ball.clean ? "#ff5f6d" : ball.stage === "done" ? "#7ee787" : ball.loop && ball.number > 2 ? "#c89aff" : "#79e7e1";
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
  function reset(toStart = false) {
    F = null; balls = []; cycles = passes = 0;
    if (toStart) restoreStart();
    const S = snapshot(); if (S) prepare(S, true); else { metrics(null); status(enabled ? hint() : "Шарики выключены · нажми ● вкл. · " + hint()); } renderCone();
  }
  // The start pose is the user's last manual ring turn before a launch: a
  // launch from the starts remembers it, ↩ and a new launch return to it.
  const fresh = () => !(balls.length ? balls : F ? [F] : []).some(b => !b.ready);
  function rememberStart() { Z.coneBallPose = { pos: posCur(), fillFree: !!Z.coneFillFree }; save(); }
  function restoreStart() {
    pauseRotation();
    const P = Z.coneBallPose; if (!P || !P.pos) return;
    posApply({ ...P.pos, mode: Z.coneSpinMode || "all" });   // keep this experiment's spin mode
    Z.coneFillFree = !!P.fillFree; Z.coneTurns = []; Z.coneFillTurns = 0;
    save(); if (typeof renderRows === "function") renderRows();
  }
  function metrics(S) {
    if (batchBusy || !$("ballLabTime")) return;
    const P = S ? boundaryPoints(S) : [{ id: "center", label: "Центр" }], key = P.map(p => p.id).join("|");
    if (key !== lastPoints) {
      const select = $("ballLabStart"); select.replaceChildren();
      const all = document.createElement("option"); all.value = "all"; all.textContent = "Все " + (S ? P.length : 11) + ": углы К2, края К1 и центр"; select.appendChild(all);
      const group = document.createElement("option"); group.value = "group"; group.textContent = "Сквозная группа"; group.hidden = true; select.appendChild(group);
      for (const p of P) { const opt = document.createElement("option"); opt.value = p.id; opt.textContent = p.label; select.appendChild(opt); }
      lastPoints = key;
    }
    const grouped = !allStarts() && throughCount() > 1;
    const option = $("ballLabStart").querySelector('[value="group"]');
    if (option) { option.hidden = !grouped; option.textContent = "Сквозные: " + throughCount() + (throughCount() === 2 ? " навстречу" : " шарика"); }
    $("ballLabStart").value = grouped ? "group" : allStarts() ? "all" : S ? startPoint(S).id : "center";
    const T = F && !F.ready ? F.period : S ? period(S) : null, mult = F && !F.ready ? F.mult : fraction(Z.coneBallMult || "1");
    const elapsed = balls.length ? Math.max(...balls.map(b => b.elapsed)) : F ? F.elapsed : 0;
    const text = T && Number.isFinite(mult) ? "T₀ " + T.toFixed(3) + " с · " + (allStarts() ? "диаметр" : "путь") + " за " + (T / mult).toFixed(3) + " с" + (F && !F.ready ? " · прошло " + elapsed.toFixed(3) + " с" : "") : "Нужны два вращающихся кольца и положительная дробь";
    if ($("ballLabTime").textContent !== text) { $("ballLabTime").textContent = text; $("ballLabRun").title = $("ballLabSpeed").title = text; }
    $("ballLabRun").textContent = F && !F.ready ? "↻ новый запуск" : "▶ запуск";
    renderTurns();
    labControls();
  }
  function turnsFraction(value) {
    const a = Math.abs(value); if (a < 1e-10) return "0";
    let n, d, exact = false;
    for (d = 1; d <= 360; d++) {
      n = Math.round(a * d);
      if (n > 0 && Math.abs(a - n / d) < 1e-8) { exact = true; break; }
    }
    if (!exact) { d = 1000; n = Math.round(a * d); }
    const gcd = (x, y) => y ? gcd(y, x % y) : x;
    const divisor = gcd(n, d); n /= divisor; d /= divisor;
    const whole = Math.floor(n / d), rest = n % d;
    const text = rest ? (whole ? whole + " " : "") + rest + "/" + d : String(whole);
    return (exact ? "" : "≈ ") + (value < 0 ? "↺ −" : "↻ ") + text;
  }
  function renderTurns() {
    const el = $("ballLabTurns"); if (!el) return;
    const list = balls.length ? balls : F ? [F] : [];
    if (!list.length) { el.textContent = "Обороты колец: нет активного опыта"; return; }
    const rows = list.map(b => '<tr><th scope="row">' + (b.number || 1) + (b.stage === "done" ? (b.clean ? " ✓" : " ×") : "") + '</th>' + b.ringTurns.map(v => '<td' + (v < -1e-10 ? ' class="ccw"' : '') + '>' + turnsFraction(v) + '</td>').join('') + '</tr>').join('');
    const html = '<table><caption>Обороты колец за путь шарика</caption><thead><tr><th scope="col">Шарик</th>' + list[0].ringTurns.map((_, k) => '<th scope="col">К' + (k + 1) + '</th>').join('') + '</tr></thead><tbody>' + rows + '</tbody></table>';
    if (el.innerHTML !== html) el.innerHTML = html;
  }
  function choose(id) { if (id === "group") return; pauseRotation(); Z.coneBallThroughCount = 1; Z.coneBallBatch = id === "all"; if (id !== "all") Z.coneBallStart = id; save(); reset(); }
  function launch(config = {}) {
    if (config.through !== undefined) Z.coneBallThroughCount = config.through;
    else if (config.start !== undefined || config.batch !== undefined || config.mult !== undefined) Z.coneBallThroughCount = 1;
    if (config.start !== undefined) { Z.coneBallBatch = config.start === "all"; if (config.start !== "all") Z.coneBallStart = config.start; }
    if (config.batch !== undefined) Z.coneBallBatch = !!config.batch;
    if (config.route !== undefined && routes[config.route]) Z.coneBallRoute = config.route;
    if (config.mult !== undefined) Z.coneBallMult = String(config.mult);
    else if ($("ballLabSpeed") && !$("ballLabSpeed").readOnly) Z.coneBallMult = $("ballLabSpeed").value.trim();
    if (!Number.isFinite(fraction(Z.coneBallMult || "1"))) { status("Скорость: введи положительную дробь, например 1/3, 3/4 или 1,5"); return false; }
    if ($("ballLabSpeed")) { $("ballLabSpeed").value = Z.coneBallMult || "1"; $("ballLabSpeed").removeAttribute("aria-invalid"); }
    pauseRotation(); if (fresh()) rememberStart(); else restoreStart(); F = null; balls = [];
    enabled = true; Z.coneBallOn = true; ui();
    if (typeof coneReleaseRings === "function") coneReleaseRings();
    const S = snapshot(); if (!S) { status(hint()); return false; }
    prepare(S, true, true); save(); if (!F || F.ready) return false;
    if (!coneSpinning) $("bConeAuto").click();
    paused = !coneSpinning;
    renderCone(); return true;
  }
  function launchThrough(count = 1) {
    pauseRotation();
    if (!fresh()) { restoreStart(); F = null; balls = []; }
    if (Z.coneSun && $("bConeSun")) $("bConeSun").click();
    if (typeof coneReleaseRings === "function") coneReleaseRings();
    const S = snapshot(), group = S ? movingGroup(S, rate(S), period(S), count) : { error: hint() };
    const result = group.error ? group : group.runs[0];
    if (result.error) { status(result.error); say(result.error); renderCone(); return false; }
    if (!launch({ start: result.point.id, batch: false, route: "cross", mult: speedText(result.mult), through: count })) return false;
    F.through = true;
    if (count === 1) { F.speed = result.speed; F.mult = result.mult; }
    if (count > 1) batchStatus();
    else status("Сквозной проход · " + result.point.label + " · " + speedText(result.mult) + "× · " + result.duration.toFixed(3) + " с");
    labControls(); renderCone(); return true;
  }
  window.zzBallLaunch = launch;
  window.zzBallThrough = launchThrough;
  window.zzBallPoints = () => { const S = snapshot(); return S ? boundaryPoints(S) : []; };
  function ballInfo(b) { return { id: b.id, number: b.number, label: b.label, route: b.route, stage: b.stage, ready: b.ready, speed: b.speed, period: b.period, multiplier: b.mult, length: b.length, distance: b.travel, elapsed: b.elapsed, ringTurns: b.ringTurns.slice(), clean: b.clean, reversals: b.reversals, ring: b.k, edge: b.raw, q: b.q, angle: b.a, loop: b.loop, crossings: b.crossings, arcs: b.arcs, arcSpeed: b.arc && b.arc.speed, waitingForRing: b.wait ? b.wait.next + 1 : null, loopError: b.loopError }; }
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
    lab.innerHTML = `<div class="rth"><span class="ball-lab-name">● Шарики</span><span class="pbtn"><button type="button" class="pminbtn">−</button></span></div><div class="ball-lab-body">
      <div class="ball-lab-row"><button id="ballLabEnable" type="button">● вкл.</button><label>Путь <select id="ballLabRoute"><option value="cross">через центр</option><option value="out">на вылет</option></select></label><button id="ballLabPoints" type="button" aria-pressed="true">◎ точки</button></div>
      <label>Старт <select id="ballLabStart"><option value="all">Все 11: углы К2, края К1 и центр</option></select></label>
      <div class="ball-lab-row"><span>Кольцо 1</span><button type="button" data-ball-ring="0" data-step="-.5">−½</button><button type="button" data-ball-ring="0" data-step=".5">+½</button><span>Кольцо 2</span><button type="button" data-ball-ring="1" data-step="-.5">−½</button><button type="button" data-ball-ring="1" data-step=".5">+½</button></div>
      <div class="ball-lab-row"><label>Скорость × <input id="ballLabSpeed" type="text" inputmode="text" value="1" aria-label="Множитель скорости, десятичное число или дробь"></label><span class="ball-lab-fractions"><button type="button" data-ball-speed="1/4">¼</button><button type="button" data-ball-speed="1/3">⅓</button><button type="button" data-ball-speed="1/2">½</button><button type="button" data-ball-speed="2/3">⅔</button><button type="button" data-ball-speed="1">1</button><button type="button" data-ball-speed="3/2">³⁄₂</button><button type="button" data-ball-speed="2">2</button><button type="button" data-ball-speed="4">4</button><button type="button" data-ball-speed="8">8</button><button type="button" data-ball-speed="16">16</button><button type="button" data-ball-speed="32">32</button></span></div>
      <div class="ball-lab-row"><button id="ballLabThrough" type="button" aria-pressed="false" title="Рассчитать скорость и запустить один сквозной проход в текущем режиме вращения. Старт — выбранный внешний угол; при выборе всех точек начинаем поиск с крайнего левого. Кольца без промежутков. Поиск до 64 относительных оборотов; в конце зелёный шарик и ✓ — проход без разворота.">↦ сквозной</button><button type="button" data-ball-through="2" aria-pressed="false" title="Два шарика одновременно с противоположных внешних краёв, с одной постоянной скоростью. В центре проходят друг сквозь друга.">⇄ 2</button><button type="button" data-ball-through="3" aria-pressed="false" title="Три шарика одновременно с разных внешних граней. Каждому подбирается своя постоянная скорость; столкновений нет.">↦ 3</button><button type="button" data-ball-through="4" aria-pressed="false" title="Четыре шарика одновременно с четырёх внешних граней. Каждому подбирается своя постоянная скорость; столкновений нет.">↦ 4</button></div>
      <div class="ball-lab-row"><button id="ballLabArc" type="button" aria-pressed="false" title="∞ По дугам: четыре шарика переходят на К3 и следующие видимые кольца. На самом внешнем краю огибают дугу и идут обратно. При несовпадении прямых ждут на своей дуге и продолжают при их появлении. Ждущий шарик — жёлтый; скорость на прямых постоянна. Ещё раз — выключить и вернуть к старту.">∞ по дугам</button></div>
      <small id="ballLabGroupSpeeds" hidden title="Номер шарика: его постоянная скорость по прямым ×. На дугах скорость подбирается отдельно. Дробные кнопки выше возвращают обычный запуск одного шарика."></small>
      <div id="ballLabTime" hidden></div><div class="ball-lab-row"><button id="ballLabRun" type="button">▶ запуск</button><button id="ballLabPause" type="button">⏸ пауза</button><button id="ballLabReset" type="button">↩ к старту</button><button id="ballLabDir" type="button">↻ / ↺</button></div>
      <div id="ballLabTurns" title="Фактический поворот каждого кольца с момента запуска шарика, в оборотах по 360°. Дроби сокращены; ≈ — округление до 1/1000 оборота. ↻ по часовой, ↺ − против. На паузе счёт стоит; ✓ — чистый выход, × — выход с разворотами; результат зафиксирован. Новый запуск и ↩ обнуляют счёт. В режиме ∞ считается весь путь, включая дуги."></div>
      <div id="ballLabStatus" role="status" aria-live="polite" hidden></div></div>`;
    host.appendChild(lab); $("ballLabRoute").value = routes[Z.coneBallRoute] ? Z.coneBallRoute : "cross"; $("ballLabSpeed").value = Z.coneBallMult || "1";
    $("ballLabEnable").onclick = () => $("bConeBall").click();
    $("ballLabRun").onclick = () => launch();
    $("ballLabThrough").onclick = () => launchThrough(1);
    lab.querySelectorAll("[data-ball-through]").forEach(b => b.onclick = () => launchThrough(+b.dataset.ballThrough));
    $("ballLabArc").onclick = () => { Z.coneBallArc = !Z.coneBallArc; if (Z.coneBallArc) launchThrough(4); else reset(true); save(); labControls(); };
    $("ballLabPause").onclick = () => { if (paused && (!enabled || !F || F.ready)) launch(); else $("bConeAuto").click(); };
    $("ballLabReset").onclick = () => reset(true);
    $("ballLabDir").onclick = () => { pauseRotation(); $("bConeDir").click(); reset(); };
    $("ballLabStart").onchange = () => choose($("ballLabStart").value);
    $("ballLabRoute").onchange = () => { pauseRotation(); Z.coneBallThroughCount = 1; Z.coneBallRoute = $("ballLabRoute").value; save(); reset(); };
    $("ballLabSpeed").onchange = () => {
      if (!Number.isFinite(fraction($("ballLabSpeed").value))) { $("ballLabSpeed").setAttribute("aria-invalid", "true"); status("Введи положительную дробь, например 1/3 или 3/4"); return; }
      $("ballLabSpeed").removeAttribute("aria-invalid"); pauseRotation(); Z.coneBallThroughCount = 1; Z.coneBallMult = $("ballLabSpeed").value.trim(); save(); reset();
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
    const source = $("coneBallStatus"), syncStatus = () => { source.title = source.textContent; $("ballLabStatus").textContent = source.textContent; lab.querySelector(".ball-lab-name").title = source.textContent + "\n\n" + LAB_HELP; };
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
