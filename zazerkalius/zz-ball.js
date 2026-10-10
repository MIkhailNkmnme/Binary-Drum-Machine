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
  // v0.1051, «после вылета шарика из 1 кольца сразу же за ним начинает вылет 2 и так далее»: цепочка вылетов из центра (до CHAIN_MAX шариков)
  let chain = false; const CHAIN_MAX = 64;
  /* v0.1073, по снимку «баг: 2-й шарик должен был вылететь во 2-е кольцо» (цепочка, «✕ дуга»): следующий шарик цепочки стартовал в конце кадра,
     а прежний выходил из кольца 1 посреди кадра — опоздание до 1/60 с (К1 из одного бита при 3 бит/с — до 0,3 рад). Прежде его скрывал допуск
     щели, без допусков (v0.1067) шарик бился. Теперь момент выхода из К1 запоминается долей кадра (k1Frac, кадр spinFrame), и новый шарик
     стартует ровно тогда: остаток кадра он проезжает сразу */
  let spinFrame = 0, inwardNextPending = false;
  const markK1 = (t, next) => { if (F && F.k === 0 && next === 1 && F.k1Frame !== spinFrame) { F.k1Frac = t; F.k1Frame = spinFrame; } };
  /* v0.1052, «режим: шарик вылетает и упирается в дугу, а не в щель или вырез, — исчезает»; скорость — «сначала автоподстройка на первый вылет первого
     шарика, и она постоянная дальше всегда»; внутри кольца — «едет по щели». lossRun — вылет из «Граней» с «✕ дуга»; lossSpeed — найденная скорость */
  let lossRun = false, lossSpeed = 0;
  /* v0.1055: «1 за чертой» записывает бит только при попадании в его дугу. Щель и открытый вырез пропускают без записи.
     При попадании шарик застревает в бите или отскакивает; все ячейки «1» — строка уходит в поле, вылеты продолжаются, счёт остаётся у строки. */
  let markRun = false, pendingMarks = [], pendingBits = [], markCfg = null;
  let balls = [], batchBusy = false;
  // Current launch only: totals outlive the 64 moving-ball slots and row promotion.
  let run = null, stuck = [];
  /* v0.1063, «как мне начать с 5 строки при закрытых 3 кольцах?»: закрытие хранится в состоянии (Z.coneBallClosed = {key, n}) — переживает
     перезагрузку и попадает в пресет; «◉ закрыто» задаёт его руками (zzBallSetClosed). Ключ — дорожка и длины строк, как прежде */
  let centerInitKey = "", centerBatch = false, pendingClosed = 0;
  const centerKey = () => (Z.lane | 0) + ":" + Z.rows.map(s => s.length).join("/");
  const centerCount = () => { const C = Z.coneBallClosed; return C && C.key === centerKey() ? Math.max(0, C.n | 0) : 0; };
  const setClosed = (n) => { Z.coneBallClosed = n > 0 ? { key: centerKey(), n } : null; };
  const clearCenter = () => { setClosed(0); pendingClosed = 0; centerInitKey = ""; };
  /* v0.1069, «если включён отскок, то „В центр“ при старте не ставить 0 в биты всех строк внутренних — пустыми делать, и К1 тоже»: при «удар: отскок»
     новый опыт делает все строки пустыми (Z.coneBallEmpty — пометка поверх строк, сами строки остаются из 0/1); биты ставят только удары —
     снаружи 1, изнутри 0 (если «0 изнутри»). Без отскока — как прежде: пустой (нулевой) только К1. Ключ инициализации — с отскоком: его смена = новый опыт */
  function initCenter() {
    const key = centerKey() + (bounceOn() ? "|b" : "");
    if (centerInitKey === key) return;
    if (window.zzBallCenterInit) window.zzBallCenterInit(bounceOn(), centerKey(), centerCount());   // v0.1063: заранее закрытые кольца хранят свои биты
    centerInitKey = key;
  }
  /* v0.1070, по снимку «0 поставил всё равно» (шарик ещё на старте): строки пустели только в миг запуска. Теперь стартовое состояние «В центр»
     показывается сразу — при смене отскока и по ↩ к старту */
  window.zzBallInwardPrime = () => { if (Z.coneBallRoute !== "in" || !snapshot()) return; centerInitKey = ""; initCenter(); };
  function closeCenterRing(k) {
    if (k !== centerCount()) return;
    if (centerBatch) pendingClosed = Math.max(pendingClosed, k + 1); else setClosed(k + 1);
  }
  window.zzBallCenterState = () => ({ count: centerCount(), radius: centerCount() });
  // v0.1063: «◉ закрыто» — сколько колец от центра закрыто до запуска; внешнее видимое кольцо всегда открыто (из него стартуют)
  window.zzBallSetClosed = (n) => { const S = snapshot(), max = S ? S.rings.length - 1 : Z.rows.length - 1;
    n = Math.max(0, Math.min(max, n | 0)); centerInitKey = centerKey(); setClosed(n); return n; };
  window.zzBallClosedMax = () => { const S = snapshot(); return S ? S.rings.length - 1 : Math.max(0, Z.rows.length - 1); };
  window.zzBallCloseRing = (k) => { closeCenterRing(k); return centerCount(); };   // v0.1058: «⚡ луч» закрывает своё стартовое кольцо тем же счётом, что «● в центр»
  const ringStats = k => run && (run.rings[k] ||= { entered: 0, passed: 0, hits: 0, lost: 0, bounces: 0, marks: 0, zeros: 0, reversals: 0, turns: 0 });
  function newRun() {
    run = { lane: Z.lane | 0, seconds: 0, launched: 0, exited: 0, reachedCenter: 0, removed: 0, mode: [2, 3].includes(+Z.coneBallSpeedMode) ? +Z.coneBallSpeedMode : 1, rings: [], results: [] }; stuck = [];
    if (window.zzBallLostReset) window.zzBallLostReset();
  }
  window.zzBallClearRun = (options = {}) => {
    if (!options.keepCenter) clearCenter();
    run = null; stuck = []; F = null; balls = []; pendingMarks = []; pendingBits = []; chain = lossRun = markRun = false; lossSpeed = 0; cycles = passes = 0;
    if (window.zzBallLostClear) window.zzBallLostClear();
  };
  window.zzBallRunStats = () => {
    if (!run || run.lane !== (Z.lane | 0)) return null;
    const list = (balls.length ? balls : F ? [F] : []).filter(b => !b.ready && b.stage !== "lost" && b.stage !== "done");
    return { ...run, closedCount: centerCount(), paused, speed: F ? F.speed : 0, period: F ? F.period : null,
      rings: run.rings.map((r, k) => ({ ...r, moving: list.filter(b => b.k === k && b.stage !== "wait").length, waiting: list.filter(b => b.k === k && b.stage === "wait").length })) };
  };
  let markers = [], drawn = null, lab = null, lastPoints = "";
  const routes = { out: "на вылет", cross: "через центр", in: "в центр" };
  // v0.954, «текст — убери из окна»: пояснения, T₀ и состояние — в подсказках (заголовок, ▶ запуск, скорость), не строками в окне.
  const LAB_HELP = "Скорость подбирается сама. Базовая — диаметр за T₀ (T₀ — минимальный период повторения двух колец). На каждом прямом отрезке до стыка шарик едет со своей постоянной скоростью, ближайшей к базовой (не быстрее 4×), и приходит к стыку ровно при совпадении граней; через центр — один отрезок до внешнего стыка К1. ↦ сквозной сначала ищет одну скорость на весь путь, нет её — едет с подстройкой.\n1–4: внешние углы К2 · 5–8: внутренние · далее края К1 и центр. Шарик едет по прямым краям битов (в «1 щель» и «все» — по щелям и границам битов; у строки 1 из одного бита — её щель и прямая напротив через центр) и поворачивается вместе со своим кольцом. Переходит на К3 и следующие видимые кольца, включая кольцо за чертой. В ∞ на самом внешнем краю огибает дугу и снова идёт через центр. Совпадения не будет (кольца крутятся одинаково) — ждёт на месте (жёлтый). Зелёный — выход без разворота, красный — был разворот. ↩ к старту и новый запуск возвращают кольца к последнему ручному повороту перед стартом, шарики — на старты. Нажми точку для одиночного старта.";
  const allStarts = () => Z.coneBallBatch !== false;
  // v0.1025: автоподстройка — на каждом прямом отрезке своя постоянная скорость, чтобы прийти к стыку в момент совпадения граней.
  const speedMode = () => [2, 3].includes(+Z.coneBallSpeedMode) ? +Z.coneBallSpeedMode : 1;
  const autoOn = () => speedMode() === 1 && Z.coneBallAuto === true;
  const bounceOn = () => Z.coneBallImpact === "bounce";
  function fixedSpeed(S) {
    const w = Math.abs(rate(S)[0] || 0), r = S.rings[0];
    return w * (r.ro - r.ri) / TAU * (speedMode() === 3 ? 2 : 1);
  }
  // v0.1046: что делает шарик в центре у кольца 1 из одного бита: "through" — насквозь по прямой напротив, "back" — обратно по тому же разрезу (v0.1044),
  // "flip" — кольцо 1 поворачивается на 180°, его щель встаёт на продолжение пути, и шарик едет дальше в ту же сторону
  const centerMode = () => ["through", "back", "flip"].includes(Z.coneBallCenter) ? Z.coneBallCenter : Z.coneBallOne ? "back" : "through";
  const CENTER_LABEL = { through: "центр: насквозь", back: "⊙ назад", flip: "⟳ щель 180°" };
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
  /* v0.1059, «режим В центр: авто скорость должна найти для текущего внешнего такую скорость, при которой во внутреннее зайдёт наибольшее количество
     шариков; или это не зависит от скорости? тогда хотя бы одно». Вся группа едет одной скоростью и приходит к стыку одновременно — через ширину / скорость;
     проходят те, у кого в этот миг щель внутреннего кольца (с допуском её ширины) или открытый вырез (lossPass). Картина на стыке зависит только от
     относительного поворота двух колец, поэтому перебирается один его период: моменты точных совпадений + частая сетка, не быстрее 4× базовой.
     Наибольшее число; при равенстве — ближе к базовой. Кольца крутятся одинаково — от скорости не зависит, остаётся базовая. */
  let inwardAuto = null, inwardFc = null;
  window.zzBallInwardAuto = () => inwardAuto;
  /* v0.1060, «мы заранее знаем, сколько шариков из внешнего в смежное внутреннее войдёт при одновременном старте?» — «да», и прогноз до запуска (выбрано «1»):
     вся группа одной скоростью идёт кольцо за кольцом одновременно; на каждом стыке — то же правило, что у движка (lossPass: щель с допуском или открытый
     вырез), закрытые кольца — центр, кольца закрываются после шага (как пакетом у одновременных событий). Удар — застрял (при отскоке — отмечен, дальше не
     прослеживается). Кольца крутятся равномерно, так что прогноз точный */
  window.zzBallInwardForecast = () => inwardFc;
  function inwardForecast(S, v) {
    const starts = outerStarts(S), w = rate(S), K = S.rings.length - 1;
    if (!starts.length || !(v > 0)) return null;
    let c = centerCount(), k = K, t = 0, center = 0, alive = starts.map(p => p.raw);
    const entered = {}, hits = {}, times = {};
    while (alive.length && k >= 0) {
      const ring = S.rings[k]; t += (ring.ro - ring.ri) / v;
      const St = { ...S, rings: S.rings.map((r, i) => ({ ...r, phase: r.phase + (w[i] || 0) * t })) };
      let close = c; const next = [];
      for (const raw of alive) {
        if (k === 0) { center++; close = Math.max(close, 1); continue; }
        if (k - 1 < c) { center++; if (k === c) close = Math.max(close, k + 1); continue; }
        const e = lossPass(St, k - 1, angle(St, k, raw));
        if (e === null) hits[k - 1] = (hits[k - 1] || 0) + 1; else { entered[k - 1] = (entered[k - 1] || 0) + 1; next.push(e); }
      }
      times[k] = t; c = close; alive = next; k--;
    }
    return { total: starts.length, outer: K, entered, hits, center, closedAfter: c, bounce: bounceOn(), seconds: t };
  }
  function inwardAutoSpeed(S, base) {
    inwardAuto = null;
    const k = S.rings.length - 1, inner = k - 1, starts = outerStarts(S), ring = S.rings[k];
    if (inner < 0 || !starts.length || !(base > 0)) return base;
    /* v0.1066, «снять предел ×4» (вариант 1): при одной щели в кольце быстрая полоса — «успеть, пока щели не разошлись после старта» — лежит выше
       ×4 (в пресете «В центр с 5-го кольца» — от ×7,3), и авто уходило в медленное окно через полный оборот (~95 с). Предела больше нет (до ×1000);
       годные времена идут отрезками — берётся точка внутри отрезка с запасом 15 % от краёв, ближайшая к базовой по отношению (×8 и ×1/8 одинаково далеки) */
    const w = rate(S), width = ring.ro - ring.ri, t0 = width / base, tmin = t0 / 1000, dw = (w[k] || 0) - (w[inner] || 0);
    const countAt = (t) => { const St = { ...S, rings: S.rings.map((r, i) => ({ ...r, phase: r.phase + (w[i] || 0) * t })) };
      return starts.filter(p => lossPass(St, inner, angle(St, k, p.raw)) !== null).length; };
    if (Math.abs(dw) < 1e-12) { inwardAuto = { count: countAt(t0), total: starts.length, ring: inner, fixed: true, mult: 1 }; return base; }
    const Prel = TAU / Math.abs(dw), t1 = Math.max(tmin + Prel, t0 + Prel / 2), cand = [];
    for (let j = 0; j <= 1440; j++) cand.push(tmin + (t1 - tmin) * j / 1440);
    for (let j = 0; j <= 400; j++) cand.push(tmin * Math.pow(t0 / tmin, j / 400));   // быстрые — частой сеткой по логарифму
    const innerEdges = S.rings[inner].blocks.flatMap(b => [b.lo, b.hi]), half = (S.rings[inner].tol || 0) / Math.abs(dw);
    for (const p of starts) for (const f of innerEdges) {   // точные совпадения: angle(k, raw) + w_k t = angle(inner, f) + w_inner t (mod 2π)
      const d = angle(S, inner, f) - angle(S, k, p.raw);
      for (let m = Math.ceil((dw * (dw > 0 ? tmin : t1) - d) / TAU) - 1; m <= Math.floor((dw * (dw > 0 ? t1 : tmin) - d) / TAU) + 1; m++) {
        const t = (d + m * TAU) / dw;
        for (const x of [t, t - half / 2, t + half / 2, t - half * 0.9, t + half * 0.9]) if (x >= tmin - 1e-12 && x <= t1 + 1e-12) cand.push(x);   // окно совпадения
      }
    }
    const pts = [...new Set(cand)].sort((a, b) => a - b).map(t => ({ t, c: countAt(t) })), top = Math.max(0, ...pts.map(q => q.c));
    let best = null;
    if (top > 0) for (let i = 0; i < pts.length; i++) {
      if (pts[i].c !== top) continue;
      let j = i; while (j + 1 < pts.length && pts[j + 1].c === top) j++;
      const a = pts[i].t, b = pts[j].t, mg = (b - a) * 0.15;
      let t = j > i ? Math.min(Math.max(t0, a + mg), b - mg) : a; if (countAt(t) !== top) t = (a + b) / 2; if (countAt(t) !== top) t = a;
      if (!best || Math.abs(Math.log(t / t0)) < Math.abs(Math.log(best.t / t0))) best = { t, c: top };   // ближе к базовой — по отношению («во сколько раз»), не по секундам
      i = j;
    }
    if (!best) { inwardAuto = { count: 0, total: starts.length, ring: inner, fixed: false, mult: 1 }; return base; }
    inwardAuto = { count: best.c, total: starts.length, ring: inner, fixed: false, mult: t0 / best.t };
    return width / best.t;
  }
  /* v0.1063, «базовая — одно кольцо за время, пока внешнее повернётся на бит — да»: прежде базовая была «радиус за T₀» (T₀ — по К1 и К2), мерка,
     не связанная с внешними кольцами. Теперь «×» у авто — во сколько раз быстрее, чем «ширина кольца, пока внешнее проходит один бит».
     Внешнее не крутится — прежняя (радиус за T₀) */
  function inwardBase(S) {
    const K = S.rings.length - 1, ring = S.rings[K], w = Math.abs(rate(S)[K] || 0);
    const cell = (ring.cells && ring.cells.length ? ring.cells : ring.blocks)[0];
    if (!cell || w < 1e-12) return null;
    const sec = (cell.hi - cell.lo) / w;
    return sec > 0 ? { speed: (ring.ro - ring.ri) / sec, sec } : null;
  }
  function outerStarts(S) {
    const k = S.rings.length - 1, ring = S.rings[k], points = [];
    if (k < centerCount()) return points;
    for (const b of ring.blocks) for (const raw of [b.lo, b.hi]) {
      if (points.some(p => Math.abs(norm(p.raw - raw)) < ALIGN)) continue;
      points.push({id:"outer-slit:" + points.length,k,raw,r:ring.ro,kind:"edge",label:"К" + (k + 1) + " · внешняя щель " + (points.length + 1)});
    }
    return points;
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
    if (!group.error || !(Z.coneBallArc || autoOn()) || !T) return group;
    // Waiting makes an initially unmatched pose usable too. Keep four physical
    // outer starts, rather than requiring a precomputed uninterrupted crossing.
    const points = boundaryPoints(S).filter(p => p.k === 1 && Math.abs(p.r - S.rings[1].ro) < EPS);
    const unique = points.filter((p, i) => !points.slice(0, i).some(q => Math.abs(norm(p.raw - q.raw)) < ALIGN));
    const mult = fraction(Z.coneBallMult || "1");
    // With auto-tuning every outer start works in any ring mode, even without an opposite pair.
    if (!unique.length || unique.length < count && !autoOn() || !Number.isFinite(mult)) return group;
    const first = unique.find(p => p.id === Z.coneBallStart) || unique[0];
    const opposite = unique.find(p => Math.abs(norm(p.raw - first.raw - Math.PI)) < ALIGN);
    if (count > 1 && !opposite && !autoOn()) return group;
    const ordered = [first, ...(opposite ? [opposite] : []), ...unique.filter(p => p !== first && p !== opposite)];
    const speed = 2 * S.rings[1].ro * mult / T;
    return { runs: ordered.slice(0, count).map(point => ({ point, speed, mult, duration: T / mult, auto: autoOn() })) };
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
  // v0.1026: «1 щель» и «все» — кольца без вырезов: грани — щели и границы битов, как у магнита (coneRingFeat).
  const inwardOne = (R) => !!R && !R.cut && Z.coneBallRoute === "in" && typeof coneOneSlit === "function" && coneOneSlit();   // v0.1064: одна щель и за чертой
  window.zzBallFillOne = () => Z.coneBallOn !== false && inwardOne(coneRingFeat("f"));
  const plainRings = () => coneFlat() && Z.rows.length <= CONE_MAX && coneSlitMode() !== "cut";
  function snapshot() {
    const cut = coneCutOn() && (coneHalfOn() || coneQuadOn() && conePartCount() % 2 === 0);
    // v0.1029: шарикам не нужны ни ⌖ луч-часы, ни ☀ — кручение колец идёт и без них.
    if (!coneGeom || !(cut || plainRings()) || Z.cone3d || Z.conePoly || cutPrevMode() || coneFreeOn() || Z.coneBitStep) return null;
    const N = Math.min(Z.rows.length, CONE_MAX);
    if (N + (coneGeom.fill ? 1 : 0) < 2) return null;
    const band = 1, rings = [];   // v0.1050: зазор между нарисованными кольцами (без «◯ чистых») — пустое место, шарик пересекает его по той же прямой; прежде ждал у зазора без конца
    for (let i = 0; i < N + (coneGeom.fill ? 1 : 0); i++) {
      const R = coneRingFeat(i === N ? "f" : i); if (!R) return null;
      const blocks = [], cells = []; let contactBlocks;
      if (i === 0) {
        if (!cut) {
          // One bit: the slit and the line through the centre opposite it (the magnet's two edges).
          if (R.n === 1) { const x = R.xc ?? 0, lo = -Math.PI / 2 + x * R.step;   // v0.1041: щель строки 1 и прямая напротив
            // v0.1044, «⊙ один путь»: у кольца 1 только разрез — один блок во весь круг; из центра шарик выходит по тому же разрезу
            blocks.push(centerMode() !== "through" ? { lo, hi: lo + 2 * Math.PI, bit: 0 } : { lo, hi: lo + Math.PI, bit: 0 });
            // The opposite radius is a route through the centre, not a second physical slit or an open half-circle.
            contactBlocks = [{ lo, hi: lo + TAU, bit: 0 }]; cells.push(...contactBlocks); }
          else for (let j = 0; j < R.n; j++) blocks.push({ lo: -Math.PI / 2 + j * R.step, hi: -Math.PI / 2 + (j + 1) * R.step, bit: j });
        }
        else if (coneQuadOn()) for (let q = 1; q < conePartCount(); q += 2) blocks.push({ lo: -Math.PI / 2 + q * R.step, hi: -Math.PI / 2 + (q + 1) * R.step, bit: 0 });
        else blocks.push({ lo: Math.PI / 2, hi: 3 * Math.PI / 2, bit: 0 });
      }
      else {
        // v0.1033: «N щель» — у кольца строки одна грань, щель между последним и первым битом: один блок во весь круг.
        /* v0.1064, «баг? в режиме N щель «В центр» сразу несколько шариков не может идти — там одна щель в каждом кольце»: кольцо за чертой
           (внешнее у «● в центр») имело щели на каждой границе ячеек (v0.1033, как у лазера), и из него стартовало по шарику на ячейку. Для «В центр»
           у него теперь тоже одна щель — между последней и первой ячейкой, как у колец строк. Вылеты наружу — по-прежнему */
        if (R.one || i === N && inwardOne(R)) { rings.push({ ri: i, ro: i + band, phase: -R.x0 * R.step, blocks: [{ lo: -Math.PI / 2, hi: 3 * Math.PI / 2, bit: 0 }], cells: Array.from({ length: R.n }, (_, j) => ({ lo: -Math.PI / 2 + j * R.step, hi: -Math.PI / 2 + (j + 1) * R.step, bit: j })), tol: 0, fill: i === N, shape: [R.n, R.P, "one", band].join(":") }); continue; }
        const bits = i === N ? fillDraft() : Z.rows[i];
        // Unfilled draft cells still have the same physical perimeter/edges.
        // Their paint value must not hide the launch points on that perimeter.
        for (let j = 0; j < R.n; j++) if (bits[j] === "0" || bits[j] === "1" || i === N && bits[j] === ".") {
          const p = R.cut ? cutPos(j, R.n) : j;
          blocks.push({ lo: -Math.PI / 2 + p * R.step, hi: -Math.PI / 2 + (p + 1) * R.step, bit: j });
        }
        cells.push(...blocks.map(b => ({ ...b })));   // границы битов сохраняются и при «▮ щель», когда стенка сливается
        // v0.1050, «вылет шарика из щели кольца 1 и дальше по щелям» (Грани, «▮ щель»): в вырезах соседние биты без выреза между ними — одна стенка,
        // её грани — только края вырезов (щели); стык через начало круга тоже сливается
        if (R.cut && Z.coneBallSlitOnly && blocks.length > 1) {
          blocks.sort((a, b) => a.lo - b.lo);
          const M = [{ ...blocks[0] }];
          for (const b of blocks.slice(1)) { const t = M[M.length - 1]; if (Math.abs(b.lo - t.hi) < 1e-9) { t.hi = b.hi; t.bitHi = b.bitHi ?? b.bit; } else M.push({ ...b }); }
          if (M.length > 1 && Math.abs(norm(M[M.length - 1].hi - M[0].lo)) < 1e-9) { const last = M.pop(); M[0] = { ...M[0], lo: last.lo - 2 * Math.PI }; }
          blocks.length = 0; blocks.push(...M);
        }
      }
      rings.push({ ri: i, ro: i + band, phase: -R.x0 * R.step, blocks, contactBlocks, cells, tol: 0, fill: i === N, oneWay: !i && !cut && R.n === 1 && centerMode() !== "through", shape: [R.n, R.P, R.cut, band, blocks.map(b => b.lo + "," + b.hi).join(";")].join(":") });
    }
    const B = rings[1].blocks;
    if (!B.length) return null;
    // Include all visible rings in the counters, even though the route uses two.
    const rotation = [];
    for (let i = 0; i < N + (coneGeom.fill ? 1 : 0); i++) {
      const R = coneRingFeat(i === N ? "f" : i);
      rotation.push(R ? -R.x0 * R.step : 0);
    }
    return { rings, rotation, clockPh: Z.coneSpinPh || 0, spin: (Z.coneSpin || 0) * Math.PI / 180, shape: rings.map(r => r.shape).join("|") };
  }
  function hint() { return "Для шариков: плоский вид, плавное кручение и хотя бы два кольца (луч-часы и солнце не нужны). В вырезах у строки 1 — 2 части или 2 по симметрии; в «1 щель» и «все» — как есть"; }
  function ui() {
    const b = $("bConeBall"); if (!b) return;
    b.classList.toggle("on", enabled); b.setAttribute("aria-pressed", String(enabled)); b.textContent = enabled ? "●" : "○";
    b.setAttribute("aria-label", enabled ? "Выключить шарики" : "Включить шарики");
    b.title = enabled ? "Шарики включены. Нажми, чтобы выключить движение и точки." : "Шарики выключены. Нажми, чтобы включить их снова.";
    // v0.1003: переключатель остаётся в заголовке единого меню; выключение прячет только его содержимое.
    if (lab) { lab.classList.toggle("ball-off", !enabled); lab._pzk = ""; window.zzBallLabSync(); }
    labControls();
  }
  function labControls() {
    if (!$("ballLabTime")) return;
    $("bConeBall").setAttribute("aria-pressed", String(enabled));
    $("ballLabPoints").setAttribute("aria-pressed", String(Z.coneBallPoints !== false));
    $("ballLabRoute").disabled = Z.coneBallRoute !== "in" && (allStarts() || throughCount() > 1);
    $("ballLabRoute").value = Z.coneBallRoute === "in" ? "in" : allStarts() ? "cross" : routes[Z.coneBallRoute] ? Z.coneBallRoute : "cross";
    $("ballLabRoute").dataset.active = "true";
    $("ballLabStart").dataset.active = String(!!$("ballLabStart").value);
    const started = enabled && (balls.length ? balls : F ? [F] : []).some(b => !b.ready && b.stage !== "done" && b.stage !== "lost");
    $("ballLabRun").setAttribute("aria-pressed", String(started && !paused));
    $("ballLabPause").setAttribute("aria-pressed", String(started && paused));
    $("ballLabPause").textContent = paused ? "▶ продолжить" : "⏸ пауза";
    $("ballLabDir").textContent = (Z.coneAutoSp ?? 30) < 0 ? "↺ против" : "↻ по часовой";
    $("ballLabDir").dataset.active = "true";
    if ($("ballLabArc")) $("ballLabArc").setAttribute("aria-pressed", String(!!Z.coneBallArc));
    if ($("ballLabOne")) { const m = centerMode(), b = $("ballLabOne"); b.setAttribute("aria-pressed", String(m !== "through")); if (b.textContent !== CENTER_LABEL[m]) b.textContent = CENTER_LABEL[m]; }
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
      const speeds = $("ballLabGroupSpeeds");
      speeds.hidden = !group;
      if (group) {
        speeds.textContent = balls.map(x => x.number + ": " + speedText(x.mult) + "×").join(" · ");
        $("ballLabRun").title = "Сквозная группа · " + speeds.textContent + (balls.some(x => x.auto) ? ". ⚙ Подстройка: на каждом прямом отрезке своя постоянная скорость." : ". Скорость на прямых постоянна; в режиме ∞ скорость на дуге подбирается отдельно.") + " Столкновений нет.";
      }
    }
  }
  function angle(S, k, raw) { return raw + S.rings[k].phase + S.spin; }
  function begin(S, clear = false, launch = false, options = {}) {
    if (clear) cycles = passes = 0;
    const dir = (Z.coneAutoSp ?? 30) < 0 ? -1 : 1, b = S.rings[0].blocks[0], aim = dir > 0 ? 0 : Math.PI;
    const p = options.point || startPoint(S), k = p.k;
    const raw = p.raw ?? ((options.slitStart ?? Z.coneBallSlitStart) ? b.lo : null) ?? [b.lo, b.hi].reduce((a, c) => Math.abs(norm(angle(S, 0, c) - aim)) < Math.abs(norm(angle(S, 0, a) - aim)) ? c : a);
    const R = S.rings[S.rings.length - 1].ro, requested = options.route || Z.coneBallRoute;
    const route = routes[requested] ? requested : "cross", mult = fraction(Z.coneBallMult || "1"), T = options.period ?? period(S);
    const move = route === "out" ? 1 : -1, length = route === "out" ? R - p.r : route === "in" ? p.r : R + p.r;
    F = { shape: S.shape, dir, R, route, start: { k, raw, q: p.r }, length, move, stage: move > 0 ? "out" : "in", ready: !launch,
      q: p.r, k, raw, a: angle(S, k, raw), reversals: 0, clean: true, elapsed: 0, travel: 0, period: T, mult, speed: options.speed ?? (T && Number.isFinite(mult) ? length * mult / T : 0), loop: !!Z.coneBallArc, crossings: 0, arcs: 0, auto: options.auto ?? autoOn(), seg: null, tuned: 0, loss: lossRun };
    F.ringTurns = (S.rotation || S.rings).map(() => 0);
    F.ringShapes = S.rings.map(r => r.shape); F.fillIndex = S.rings.findIndex(r => r.fill);
    // The inward experiment measures actual passages and impacts, without tuning arrivals to slits.
    if (route === "in") { F.auto = false; F.loss = true; }
    if (speedMode() !== 1) { F.speed = fixedSpeed(S); F.auto = false; }
    if (launch && !(F.speed > 0)) { F.ready = true; status(length <= EPS ? "Шарик уже на внешнем краю · выбери точку внутри или маршрут через центр" : "Для запуска нужны вращение и положительная дробная скорость"); metrics(S); return; }
    if (launch && run) { F.number = F.runNumber = ++run.launched; ringStats(k).entered++; rememberResult(); }
    status(!enabled ? "Шарик выключен · серая точка — старт · ● вкл. — включить" : launch ? routes[route] + " · старт: " + p.label + " · скорость " + String(Z.coneBallMult || "1") + "×" : readyText(S));
    metrics(S);
  }
  function prepare(S, clear = false, launch = false) {
    balls = [];
    if (Z.coneBallRoute === "in") {
      if (clear) cycles = passes = 0;
      const T = period(S), B = inwardBase(S), base = B ? B.speed : T ? S.rings[S.rings.length - 1].ro / T : 0;
      const speed = speedMode() === 1 && launch ? inwardAutoSpeed(S, base) : base;
      if (inwardAuto) Object.assign(inwardAuto, { base, bitSec: B ? B.sec : null, outer: S.rings.length - 1 });   // v0.1059: «1 — авто» — скорость, при которой во внутреннее кольцо зайдёт больше всего шариков
      batchBusy = true;
      try { outerStarts(S).forEach((point, i) => { begin(S, false, launch, {point,route:"in",period:T,speed}); balls.push(Object.assign(F,{id:point.id,number:i+1,label:point.label})); }); }
      finally { batchBusy = false; F = balls[0] || null; }
      inwardFc = launch && balls.length ? inwardForecast(S, balls[0].speed) : null;   // v0.1060: прогноз по фактической скорости группы
      batchStatus(); metrics(S); return;
    }
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
    if (balls.every(b => b.ready)) { status(balls.every(b => b.route === "in") ? (count === 1 ? "1 шарик во внешней щели · ● в центр — запуск" : count + " " + (count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14) ? "шарика" : "шариков") + " во внешних щелях · ● в центр — запуск всей группы") : balls.every(b => b.through) ? count + " сквозных шарика на внешних гранях · ▶ запуск" : count + " шариков на местах: 4 внешних + 4 внутренних угла К2 + " + edges + " края К1 + центр · ▶ запуск вместе с вращением"); return; }
    const done = balls.filter(b => b.stage === "done"), clean = done.filter(b => b.clean).length, turned = balls.filter(b => !b.clean).length;
    const waiting = balls.filter(b => b.stage === "wait").length, lost = balls.filter(b => b.stage === "lost").length;   // v0.1052
    if (balls.every(b => b.route === "in")) {
      status((paused ? "Пауза · " : "") + "В центр: " + count + " · движутся " + (count - done.length - waiting - lost) + " · дошли " + done.filter(b => b.atCenter).length + " · вышли назад " + done.filter(b => !b.atCenter).length + " · застряли " + lost + " · отскоки " + balls.reduce((n, b) => n + (b.bounces || 0), 0)); return;
    }
    if (balls.some(b => b.loop)) {
      status((paused ? "Пауза · " : "") + "∞ Шарики: " + count + " · по дуге " + balls.filter(b => b.stage === "arc").length + " · ждут прямую " + waiting + " · проходов " + balls.reduce((n, b) => n + b.crossings, 0) + " · разворотов " + balls.reduce((n, b) => n + b.reversals, 0) + (done.length ? " · остановились " + done.length : "")); return;
    }
    const totalLost = window.zzBallLostTotal ? window.zzBallLostTotal() : lost;
    status((paused ? "Пауза · " : "") + "Шарики: " + count + " · движутся " + (count - done.length - waiting - lost) + " · ждут прямую " + waiting + " · вышли " + done.length + " · без разворота " + clean + (totalLost ? " · застряли в дуге " + totalLost : "") + (turned ? " · красные: был разворот, НЕ проход" : ""));
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
    F.move = -F.move; F.stage = F.move > 0 ? "out" : "in"; F.reversals++; F.clean = false; F.seg = null;
    if (run) ringStats(F.k).reversals++;
    F.length = F.travel + (F.move > 0 ? F.R - F.q : F.q + F.R);
    status(why + " · разворот по своей грани · НЕ проход · разворотов " + F.reversals);
  }
  function waitAt(next, opposite = false) {
    F.stage = "wait"; F.wait = { next, opposite }; F.seg = null;
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
  // Auto-tuning: the straight run to the next joint gets one constant speed,
  // the one nearest to the nominal speed whose arrival meets an aligned edge
  // (at most 4x faster). Through the centre the run goes on along the
  // opposite edge of ring 1 up to its outer joint.
  function planSegment(S, C, dt) {
    const ring = S.rings[F.k]; let length, next, raw = F.raw, outward = F.move > 0;
    if (!F.k && F.move < 0) {
      const own = ring.blocks.flatMap(b => [b.lo, b.hi]).find(e => Math.abs(norm(e - F.raw - Math.PI)) < ALIGN);
      if (own === undefined && (!ring.oneWay || centerMode() === "flip")) return null;   // v0.1046: «щель 180°» — отрезок кончается в центре
      length = F.q + ring.ro; next = 1; raw = own === undefined ? F.raw : own; outward = true;   // v0.1044: «⊙ один путь» — обратно по тому же разрезу
    } else { length = outward ? ring.ro - F.q : F.q - ring.ri; next = F.k + F.move; }
    if (!(length > EPS) || next < 0 || next >= S.rings.length) return null;
    const target = S.rings[next];
    if (Math.abs(outward ? ring.ro - target.ri : ring.ri - target.ro) > EPS) return null;
    const dw = (C.delta[F.k] - C.delta[next]) / dt, nominal = length / F.speed, a = angle(S, F.k, raw);
    let best = null;
    for (const b of target.blocks) for (const f of [b.lo, b.hi]) {
      const phase = norm(a - angle(S, next, f));
      const times = Math.abs(dw) < 1e-12 ? (Math.abs(phase) < ALIGN ? [nominal] : []) :
        Array.from({ length: 7 }, (_, j) => ((Math.round((dw * nominal + phase) / TAU) + j - 3) * TAU - phase) / dw);
      for (const t of times) if (t >= nominal / 4 - 1e-12 && (best === null || Math.abs(t - nominal) < Math.abs(best - nominal))) best = t;
    }
    return best === null ? null : { speed: length / best };
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
    F.raw = F.arc.from; F.stage = "arc"; F.seg = null;
  }
  // v0.1055: actual bit interior at the impact angle. Never substitute an adjacent cell at a slit.
  function fillCellAt(ring, e) {
    const cells = ring.cells && ring.cells.length ? ring.cells : ring.blocks;
    for (const b of cells) { const d = ((e - b.lo) % TAU + TAU) % TAU; if (d >= 0 && d < b.hi - b.lo) return b.bit; }
    return null;
  }
  function stuckPosition(S, group, sample) {
    const ring = S.rings[group.k]; if (!ring) return null;
    const cell = (ring.cells && ring.cells.length ? ring.cells : ring.blocks).find(b => b.bit === group.bit); if (!cell) return null;
    return { a: angle(S, group.k, cell.lo + (cell.hi - cell.lo) * sample.u), q: ring.ri + (ring.ro - ring.ri) * sample.v, width: cell.hi - cell.lo };
  }
  function impactAt(k, S, a) {
    if (run) ringStats(k).hits++;
    writeInwardImpact(k, S, a);
    if (bounceOn()) {
      if (run) ringStats(k).bounces++;
      F.bounces = (F.bounces || 0) + 1;
      turn("Отскок от дуги кольца " + (k + 1)); return;
    }
    F.stage = "lost"; F.lostAt = k; F.seg = null; cycles++;
    if (run) ringStats(k).lost++;
    if (S) {
      const ring = S.rings[k], raw = a - ring.phase - S.spin, bit = fillCellAt(ring, raw);
      const cell = (ring.cells && ring.cells.length ? ring.cells : ring.blocks).find(b => b.bit === bit);
      if (cell) {
        let group = stuck.find(p => p.k === k && p.bit === bit);
        if (!group) { group = { k, bit, count: 0, samples: [] }; stuck.push(group); }
        group.count++;
        // Remain at the exact point of contact, attached to the struck ring.
        if (group.samples.length < 64) group.samples.push({ u: ((raw - cell.lo) % TAU + TAU) % TAU / (cell.hi - cell.lo), v: (F.q - ring.ri) / (ring.ro - ring.ri) });
      }
    }
    if (window.zzBallLostRecord) window.zzBallLostRecord(k);
    status("✕ Шарик " + (F.number || 1) + " застрял в бите кольца " + (k + 1));
  }
  function writeInwardImpact(k, S, a) {
    if (F.route !== "in") return;
    const value = F.move < 0 ? "1" : Z.coneBallZeroBounce && F.bounces > 0 ? "0" : null;
    if (value === null) return;
    const ring = S.rings[k], bit = fillCellAt(ring, a - ring.phase - S.spin);
    if (bit !== null) pendingBits.push({k, bit, value});
  }
  function enteredRing(k) { if (run) { ringStats(F.k).passed++; ringStats(k).entered++; } }
  // v0.1052: where the ball may enter ring k on world line a: an edge within the slit width (snaps to it), or an open
  // cut-out (no bit block covers a; the ball keeps its place and turns with that ring); null — it hits a bit's arc.
  /* v0.1067, «шарик и щель — идеальные линия и точка без ширины, поэтому никаких допусков… везде так»: щель (разрез) — линия без ширины, шарик — точка.
     Проходит только грань, лежащая ровно на его прямой (ALIGN — машинная точность, не ширина); вырез — открытая дуга. Прежде — допуск полуширины
     щели (coneSlitHalf, как у лазера) */
  function lossPass(S, k, a) {
    const R = S.rings[k], walls = R.contactBlocks || R.blocks; let best = null;
    for (const b of walls) for (const f of [b.lo, b.hi]) { const d = Math.abs(norm(angle(S, k, f) - a)); if (d < ALIGN && (best === null || d < best.d)) best = { d, f }; }
    if (best) return best.f;
    const raw = a - R.phase - S.spin;
    return walls.some(b => { const x = ((raw - b.lo) % TAU + TAU) % TAU; return x > 0 && x < b.hi - b.lo; }) ? null : raw;
  }
  // The ball sits on edge F.raw of ring F.k at distance F.q from the centre,
  // so it turns with that ring. Stops: the outer rim (exit), the joint between
  // the rings and the centre. Across the joint and through the centre it goes
  // on only along an edge lying on the same line at that moment.
  function advance(dt, A, B) {
    if (!enabled || !F || F.ready || F.stage === "done" || F.stage === "lost" || !(dt > 0)) return;
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
        markK1(t, F.wait.next); enteredRing(F.wait.next); F.k = F.wait.next; F.raw = found.edge;
        if (F.wait.opposite) F.move = 1;
        F.wait = null; F.seg = null; F.stage = F.move > 0 ? "out" : "in";
        status("Продолжает по прямой · кольцо " + (F.k + 1));
        continue;
      }
      if (F.stage === "arc") {
        const arc = F.arc, seconds = Math.min(dt * (1 - t), Math.max(0, arc.duration - arc.elapsed));
        arc.elapsed += seconds; F.elapsed += seconds; F.travel += arc.speed * seconds; t += seconds / dt;
        F.raw = arc.from + (arc.to - arc.from) * Math.min(1, arc.elapsed / arc.duration);
        if (arc.duration - arc.elapsed > 1e-10) break;
        F.raw = arc.to; F.arc = null; F.arcs++; F.move = -1; F.stage = "in"; F.seg = null;
        continue;
      }
      const ring = A.rings[F.k];
      const stop = F.move > 0 ? ring.ro : ring.ri;
      if (F.auto && !F.seg) { F.seg = planSegment(C.at(t), C, dt) || { speed: F.speed }; if (Math.abs(F.seg.speed / F.speed - 1) > 1e-9) F.tuned++; }
      const step = (F.seg ? F.seg.speed : F.speed) * dt;
      const amount = Math.min(step * (1 - t), Math.max(0, (stop - F.q) * F.move)), h = amount / step;
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
        if (F.route === "in") { F.atCenter = true; closeCenterRing(0); finish(); break; }
        const e = edgeAt(S, 0, a + Math.PI);
        if (e === null && S.rings[0].oneWay && centerMode() === "flip") {
          // v0.1046: остаток кадра шарик стоит в центре; после кадра кольцо 1 поворачивается на 180° (applyFlips), и его разрез — продолжение пути
          F.move = 1; F.stage = "out"; F.seg = null; F.flipReq = true; F.flips = (F.flips || 0) + 1;
          F.elapsed += dt * (1 - t); t = 1; break;
        }
        if (e === null && S.rings[0].oneWay) { F.move = 1; F.stage = "out"; }   // v0.1044: «⊙ один путь» — из центра по тому же разрезу, это не разворот
        else if (e === null) { if (F.loop) waitAt(0, true); else turn("В центре нет грани напротив"); }
        else { F.raw = e; F.move = 1; F.stage = "out"; }
        continue;
      }
      const next = F.k + F.move, target = S.rings[next];
      const touching = Math.abs(stop - (F.move > 0 ? target.ri : target.ro)) < EPS;
      if (F.route === "in" && F.move < 0 && next < centerCount() && touching) {
        if (run) ringStats(next).hits++;
        writeInwardImpact(next, S, a);
        F.atCenter = true; closeCenterRing(F.k); finish(); break;
      }
      let e = touching ? edgeAt(S, next, a) : null;
      if (markRun && target.fill && F.move > 0 && touching) {
        e = lossPass(S, next, a);
        if (e === null) {
          const j = fillCellAt(target, a - target.phase - S.spin);
          if (j !== null) { pendingMarks.push(j); F.marked = j; }
          markK1(t, next); impactAt(next, S, a); if (F.stage === "lost") break; else continue;
        }
      }
      if (F.loss && !F.auto && touching) {   // «✕ дуга» и «в центр»: щель или открытый вырез — дальше; дуга бита — застрять / отскочить.
        e = lossPass(S, next, a);
        if (e === null) { markK1(t, next); impactAt(next, S, a); if (F.stage === "lost") break; else continue; }
      }
      if (e === null) {
        if (F.loop || F.auto || F.k >= 2 || next >= 2) waitAt(next);
        else turn("Грань кольца " + (next + 1) + " не совпала");
      }
      else {
        if (F.loss && F.auto) { lossSpeed = F.seg ? F.seg.speed : F.speed; F.auto = false; F.speed = lossSpeed; }   // v0.1052: скорость первого вылета — дальше постоянная
        markK1(t, next); enteredRing(next); F.k = next; F.raw = e; F.seg = null;
      }
    }
    // Freeze each result at the exact exit, including a partial final frame.
    F.ringTurns = F.ringTurns.map((v, k) => v + (C.turnDelta[k] || 0) * Math.min(t, 1));
    F.a = angle(C.at(Math.min(t, 1)), F.k, F.raw);
    rememberResult();
    metrics(B);
  }
  function rememberResult(ball = F) {
    if (!run || !ball || !ball.runNumber) return;
    const result = { number: ball.runNumber, ringTurns: ball.ringTurns.slice(), stage: ball.stage, clean: ball.clean };
    const i = run.results.findIndex(b => b.number === result.number);
    if (i >= 0) run.results[i] = result; else { run.results.push(result); if (run.results.length > 64) run.results.shift(); }
  }
  function finish() {
    F.stage = "done"; F.seg = null; cycles++; if (F.clean) passes++;
    if (run) { if (F.atCenter) run.reachedCenter++; else run.exited++; ringStats(F.k).passed++; }
    status(routes[F.route] + " · " + (F.clean ? "ПРОХОД без разворота" : "НЕ проход: был разворот") + " · время " + F.elapsed.toFixed(3) + " с · чистых " + passes + "/" + cycles);
    if (F.loopError) status(F.loopError);
  }
  // Every inward ball sees closure at the same event time, independent of array order and frame size.
  function advanceInwardGroup(dt, A, B, stopAtSame = false) {
    const C = frame(A, B, dt); let elapsed = 0, guard = 0;
    while (elapsed < dt - 1e-12 && guard++ < 2048) {
      const live = balls.filter(b => !b.ready && b.stage !== "done" && b.stage !== "lost");
      if (!live.length) break;
      let step = dt - elapsed;
      for (const b of live) {
        const r = A.rings[b.k], stop = b.move > 0 ? r.ro : r.ri;
        step = Math.min(step, Math.max(1e-10, (stop - b.q) * b.move / b.speed));
      }
      const same = live.filter(b => {
        const r = A.rings[b.k], stop = b.move > 0 ? r.ro : r.ri;
        return Math.abs((stop - b.q) * b.move / b.speed - step) < 1e-9;
      }).map(b => ({number:b.number || 1, ring:!b.k && b.move < 0 ? "центр" : b.k + b.move >= A.rings.length ? "выход" : "К" + (b.k + b.move + 1)}));
      const before = C.at(elapsed / dt), after = C.at((elapsed + step) / dt);
      centerBatch = true; pendingClosed = centerCount();
      try { for (const b of live) { F = b; advance(step, before, after); } }
      finally { centerBatch = false; setClosed(pendingClosed); }
      elapsed += step;
      // A newly filled central ring also captures balls already inside it at this exact time.
      for (const b of live) if (b.stage !== "done" && b.stage !== "lost" && b.k < centerCount()) {
        F = b; F.atCenter = true; finish(); rememberResult();
        if (!same.some(e => e.number === b.number)) same.push({number:b.number || 1, ring:"центр К" + centerCount()});
      }
      if (stopAtSame && same.length > 1) return {fraction:elapsed / dt, events:same};
    }
    return null;
  }
  window.zzBallActive = () => enabled && !!snapshot();
  window.zzBallLive = () => (balls.length ? balls : F ? [F] : []).filter(b => !b.ready && b.stage !== "done" && b.stage !== "lost").length;   // v0.1072: шарики в пути
  // v0.1053: строка за чертой ушла в поле — кольца другие; вылеты продолжаются с центра, с найденной скоростью (если она есть)
  function restartRun(S) {
    const live = (balls.length ? balls : F ? [F] : []).filter(b => !b.ready && b.stage !== "done" && b.stage !== "lost");
    // Committing the draft adds a ring. Balls still riding unchanged inner rings keep their trajectory, including a bounce back.
    const kept = live.filter(b => b.ringShapes && S.rings.length > b.ringShapes.length && b.k < b.fillIndex && b.ringShapes.slice(0, b.k + 1).every((shape, k) => shape === S.rings[k].shape));
    if (run) run.removed += live.length - kept.length;
    if (kept.length) {
      kept.forEach(b => { b.shape = S.shape; b.R = S.rings[S.rings.length - 1].ro; b.seg = null; b.ringShapes = S.rings.map(r => r.shape); b.fillIndex = S.rings.findIndex(r => r.fill); while (b.ringTurns.length < S.rings.length) b.ringTurns.push(0); });
      balls = kept; F = kept[0]; return;
    }
    const c = boundaryPoints(S).find(p => p.id === "center"); balls = []; F = null; if (!c) return;
    batchBusy = true;
    try { begin(S, false, true, { point: c, route: "out", period: period(S), speed: lossRun && lossSpeed ? lossSpeed : undefined, auto: lossRun && lossSpeed ? false : undefined });
      if (chain) { const no = F.runNumber || 1; Object.assign(F, { number: no, label: "Вылет " + no }); balls = [F]; } }
    finally { batchBusy = false; }
    status("Строка ушла в поле · вылеты дальше: строк " + Z.rows.length);
  }
  window.zzBallBeforeSpin = () => {
    if (!enabled) return null;
    const S = snapshot(); if (!S) { status(hint()); return null; }
    if (!F || F.shape !== S.shape) { if (markRun && !paused) restartRun(S); else prepare(S); } return S;
  };
  // v0.1046: «⟳ щель 180°» — шарик дошёл до центра: кольцо 1 (один бит) поворачивается на полоборота довода строки 1. Все шарики на нём едут с ним;
  // в счёт оборотов кольца 1 — по ½ на переворот
  function applyFlips(list){
    const n = list.filter(b => b.flipReq).length; if (!n) return;
    list.forEach(b => { b.flipReq = false; if (b.ringTurns) b.ringTurns[0] += 0.5 * n * ((Z.coneAutoSp ?? 30) < 0 ? -1 : 1); });
    if (run) { ringStats(0).turns += 0.5 * n * ((Z.coneAutoSp ?? 30) < 0 ? -1 : 1); list.forEach(rememberResult); }
    Z.coneAimRot = ((((Z.coneAimRot || 0) + 180 * n) % 720) + 1080) % 720 - 360;
    save(); if (typeof renderCone === "function") renderCone();
  }
  function flushMarks() {
    if (pendingBits.length) {
      const list = pendingBits; pendingBits = [];
      const changes = window.zzBallBitWrite ? window.zzBallBitWrite(list) : [];
      for (const h of changes || []) if (run) ringStats(h.k)[h.value === "0" ? "zeros" : "marks"]++;
    }
    if (!pendingMarks.length) return;
    const list = pendingMarks; pendingMarks = [];
    const k = Z.rows.length;
    if (window.zzBallFillMark) { const written = window.zzBallFillMark(list); if (run) ringStats(k).marks += written || 0; }
  }
  window.zzBallAfterSpin = (dt, before) => {
    if (!enabled) return;
    spinFrame++;
    const S = snapshot();
    if (run && run.lane !== (Z.lane | 0)) window.zzBallClearRun();
    if (run && !paused && before && S && before.shape === S.shape && F && dt > 0) {
      run.seconds += dt; const C = frame(before, S, dt);
      C.turnDelta.forEach((v, k) => { ringStats(k).turns += v; });
    }
    if (!balls.length) { advance(dt, before, S); if (F) applyFlips([F]); flushMarks(); if (markRun && F && (F.stage === "done" || F.stage === "lost")) restartRun(snapshot() || S); return; }
    if (!before || !S || balls.some(b => b.shape !== S.shape || b.shape !== before.shape)) { if (markRun && S) { restartRun(S); return; } balls = []; F = null; status(hint()); return; }
    if (balls.some(b => b.dir !== ((Z.coneAutoSp ?? 30) < 0 ? -1 : 1))) { prepare(S, true); status("Направление изменено · ▶ — общий запуск"); return; }
    batchBusy = true;
    let simultaneous = null;
    try { if (balls.every(b => b.route === "in")) simultaneous = advanceInwardGroup(dt, before, S, true); else for (const ball of balls) { F = ball; advance(dt, before, S); } }
    finally { batchBusy = false; F = balls[0]; }
    if (simultaneous) {
      const f = simultaneous.fraction, C = frame(before, S, dt);
      Z.coneSpinPh = (before.clockPh || 0) + ((S.clockPh || 0) - (before.clockPh || 0)) * f;
      Z.coneSpin = ((C.at(f).spin * 180 / Math.PI) % 360 + 360) % 360;
      if (run) {
        run.seconds -= dt * (1 - f);
        C.turnDelta.forEach((v, k) => { ringStats(k).turns -= v * (1 - f); });
        run.simultaneous = {seconds:run.seconds, events:simultaneous.events};
      }
      pauseRotation();
    }
    applyFlips(balls);
    flushMarks();
    const afterMarks = markRun ? snapshot() : null;
    if (afterMarks && afterMarks.shape !== S.shape) {
      if (!F || F.shape !== afterMarks.shape) restartRun(afterMarks);
      batchStatus(); metrics(afterMarks); return;   // после заполнения строки не добавляем шарик со старой геометрией
    }
    // v0.1051: цепочка — последний вылетевший вышел из кольца 1 (или уже вылетел совсем): из центра стартует следующий
    // v0.1053: цепочка не кончается на CHAIN_MAX — вышедшие и исчезнувшие уходят из списка, номера идут дальше
    if (chain && balls.length >= CHAIN_MAX) { const live = balls.filter(b => b.stage !== "done" && b.stage !== "lost"); if (live.length < balls.length) balls = live.length ? live : [balls[balls.length - 1]]; }
    if (chain && balls.length < CHAIN_MAX) {
      const last = balls[balls.length - 1], c = boundaryPoints(S).find(p => p.id === "center");
      if (c && last && !last.ready && (last.k >= 1 || last.stage === "done" || last.stage === "lost")) {
        batchBusy = true;
        try { begin(S, false, true, { point: c, route: "out", period: last.period, speed: lossRun && lossSpeed ? lossSpeed : last.speed, auto: lossRun && lossSpeed ? false : undefined }); const no = F.runNumber || (last.number || balls.length) + 1; Object.assign(F, { number: no, label: "Вылет " + no }); balls.push(F);
          // v0.1073: прежний вышел из К1 в этом кадре на доле h — новый стартует тогда же и проезжает остаток кадра
          const h = last.k1Frame === spinFrame && Number.isFinite(last.k1Frac) ? Math.max(0, Math.min(1, last.k1Frac)) : 1;
          if (h < 1 - 1e-12 && before && before.shape === S.shape && dt > 0) {
            const C = frame(before, S, dt), A = C.at(h);
            if (before.rotation && S.rotation) A.rotation = before.rotation.map((v, k) => v + ((S.rotation[k] ?? v) - v) * h);
            advance(dt * (1 - h), A, S);
          } }
        finally { batchBusy = false; F = balls[0]; }
        batchStatus();
      }
    }
    batchStatus(); metrics(simultaneous ? snapshot() : S);
    /* v0.1076, «в центр: когда строка закрылась и осталось только внешнее кольцо — открыть следующее внешнее и пустить с него в центр»:
       закрыты все кольца, кроме внешнего (за чертой), шариков в пути нет — кольцо за чертой уходит в строки, закрытие сохраняется, и опыт
       сам запускается из нового внешнего кольца (zzBallInwardNext в zz-ui.js) */
    if (Z.coneBallRoute === "in" && run && !paused && !inwardNextPending && window.zzBallInwardNext) {
      const S2 = snapshot(), c = centerCount();
      if (S2 && S2.rings[S2.rings.length - 1].fill && c > 0 && c >= S2.rings.length - 1 && window.zzBallLive() === 0) {
        inwardNextPending = true; setTimeout(() => { try { window.zzBallInwardNext(); } finally { inwardNextPending = false; } }, 0);
      }
    }
  };
  window.zzBallSpinState = on => {
    paused = !on; if (!enabled) return;
    if (on && run) run.simultaneous = null;
    if (on && snapshot() && typeof coneReleaseRings === "function") coneReleaseRings();
    const S = snapshot(); if (on && S && (!F || F.ready)) { rememberStart(); newRun(); prepare(S, true, true); }
    if (balls.length) { batchStatus(); if (S) metrics(S); renderCone(); return; }
    if (on && F && F.stage !== "done") status(F.stage === "wait" ? "Ждёт прямую впереди · кольцо " + (F.k + 1) : F.clean ? routes[F.route] + " · по граням битов" : "Продолжает · НЕ проход (был разворот)");
    else if (!on && F && !F.ready && F.stage !== "done") status("Пауза вместе с вращением · ▶ — продолжить");
    labControls();
    renderCone();
  };
  window.zzBallRemember = () => {}; // Balls ride their bit edges; nothing to remember.
  // v0.1069: пустая ячейка строки — как пустая за чертой: фон, без цифры, пунктирный контур
  function drawEmpty(g, S, cx, cy, dr, dpr) {
    const M = window.zzBallEmptyMask ? window.zzBallEmptyMask() : null; if (!M) return;
    g.save(); g.fillStyle = typeof coneCss === "function" ? coneCss("--bg", "#0b0d12") : "#0b0d12"; g.strokeStyle = "#79e7e1"; g.lineWidth = dpr; g.setLineDash([3 * dpr, 3 * dpr]);
    for (let k = 0; k < M.length && k < S.rings.length; k++) {
      const m = M[k], ring = S.rings[k]; if (!m || !m.includes("1") || ring.fill) continue;
      const cells = ring.cells && ring.cells.length ? ring.cells : ring.blocks, ri = ring.ri * dr, ro = ring.ro * dr;
      for (const c of cells) {
        if (m[c.bit] !== "1") continue;
        const lo = angle(S, k, c.lo), hi = angle(S, k, c.hi);
        g.beginPath();
        const full = hi - lo >= TAU - 1e-9;
        if (full) { g.arc(cx, cy, ro, 0, TAU); g.moveTo(cx + ri, cy); g.arc(cx, cy, ri, 0, TAU, true); }
        else { g.arc(cx, cy, ro, lo, hi); g.arc(cx, cy, ri, hi, lo, true); g.closePath(); }
        g.globalAlpha = 1; g.fill("evenodd"); g.globalAlpha = 0.6; g.stroke();
        // v0.1072, «у первого кольца не видно грани из центра»: ячейка во весь круг (кольцо из одного бита) — её грань (разрез) отдельной прямой
        if (full) { g.beginPath(); g.moveTo(cx + ri * Math.cos(lo), cy + ri * Math.sin(lo)); g.lineTo(cx + ro * Math.cos(lo), cy + ro * Math.sin(lo)); g.stroke(); }
      }
    }
    // v0.1070: щель «N щель» — геометрия кольца, а не бит: поверх пустых ячеек снова видна (тонкая линия)
    if (typeof coneOneSlit === "function" && coneOneSlit()) {
      g.setLineDash([]); g.globalAlpha = 0.95; g.strokeStyle = typeof CONE_SLIT1_COL !== "undefined" ? CONE_SLIT1_COL : "#7ee787"; g.lineWidth = 1.5 * dpr; g.shadowColor = g.strokeStyle; g.shadowBlur = 8 * dpr;
      for (let k = Math.max(0, centerCount()); k < M.length && k < S.rings.length; k++) {
        const ring = S.rings[k]; if (!M[k] || !M[k].includes("1") || ring.fill || ring.blocks.length !== 1) continue;
        const a = angle(S, k, ring.blocks[0].lo); g.beginPath(); g.moveTo(cx + ring.ri * dr * Math.cos(a), cy + ring.ri * dr * Math.sin(a)); g.lineTo(cx + ring.ro * dr * Math.cos(a), cy + ring.ro * dr * Math.sin(a)); g.stroke();
      }
    }
    g.restore();
  }
  window.zzBallDraw = (g, o) => {
    if (!enabled) { markers = []; drawn = null; return; }   // v0.960: выключены — на конусе ничего
    const { cx, cy, dr, dpr } = o, S = snapshot();
    if (S) {
      if (!F || F.shape !== S.shape) { if (markRun && !paused) restartRun(S); else prepare(S, true); }   // v0.1053: строка ушла в поле — вылеты продолжаются
      const R = S.rings[1].ro * dr;
      g.save(); g.lineWidth = dpr; g.strokeStyle = "#79e7e1"; g.globalAlpha = 0.26; g.setLineDash([3 * dpr, 4 * dpr]);
      if (!centerCount()) for (const b of S.rings[1].blocks) { const lo = angle(S, 1, b.lo), hi = angle(S, 1, b.hi); g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + R * Math.cos(lo), cy + R * Math.sin(lo)); g.arc(cx, cy, R, lo, hi); g.lineTo(cx, cy); g.stroke(); }
      g.restore();
      if ($("ballLabPoints") && Z.coneBallPoints !== false && lab && !lab.classList.contains("pmin")) {
        markers = (Z.coneBallRoute === "in" ? outerStarts(S) : boundaryPoints(S)).map(p => { const a = p.raw === null ? 0 : angle(S, p.k, p.raw); return { ...p, x: cx + p.r * dr * Math.cos(a), y: cy + p.r * dr * Math.sin(a) }; });
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
      drawEmpty(g, S, cx, cy, dr, dpr);   // v0.1069: пустые ячейки строк (отскок «В центр»)
      for (const ball of balls.length ? balls : F ? [F] : []) if (ball.ready) { ball.q = ball.start.q; ball.k = ball.start.k; ball.raw = ball.start.raw; }
      metrics(S);
      g.save();
      for (const group of stuck) {
        for (const sample of group.samples) {
          const p = stuckPosition(S, group, sample); if (!p) continue;
          const x = cx + p.q * dr * Math.cos(p.a), y = cy + p.q * dr * Math.sin(p.a), radius = Math.max(dpr, Math.min(4 * dpr, dr * .1, p.q * dr * p.width * .18));
          g.fillStyle = "#ff6b6b"; g.strokeStyle = "#25141a"; g.lineWidth = dpr;
          g.beginPath(); g.arc(x, y, radius, 0, TAU); g.fill(); g.stroke();
        }
        if (group.count > 64) {
          const p = stuckPosition(S, group, {u:.5,v:.5}); if (!p) continue;
          g.font = "bold " + 12 * dpr + "px monospace"; g.textAlign = "center"; g.textBaseline = "middle"; g.strokeStyle = "#0b0d12"; g.lineWidth = 3 * dpr; g.fillStyle = "#ffb4b4";
          const text = "×" + group.count, x = cx + p.q * dr * Math.cos(p.a), y = cy + p.q * dr * Math.sin(p.a); g.strokeText(text, x, y); g.fillText(text, x, y);
        }
      }
      g.restore();
    }
    if (!S) { markers = []; drawn = null; F = null; balls = []; metrics(null); status(enabled ? hint() : "Шарики выключены · нажми ● вкл. · " + hint()); }
    const positions = [];
    for (const ball of balls.length ? balls : F ? [F] : []) {
      if (ball.stage === "lost") continue;   // v0.1052: упёрся в дугу — исчез
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
  function reset(toStart = false, keepCenter = false) {
    window.zzBallClearRun({keepCenter});   // v0.1063: при загрузке страницы закрытие (из памяти или пресета) остаётся
    if (toStart && !keepCenter && Z.coneBallRoute === "in") window.zzBallInwardPrime();   // v0.1070: ↩ к старту — сразу стартовое состояние нового опыта
    F = null; balls = []; cycles = passes = 0; chain = false; lossRun = false; lossSpeed = 0; markRun = false; pendingMarks = []; pendingBits = [];
    if (toStart) restoreStart();
    const S = snapshot(); if (S) prepare(S, true); else { metrics(null); status(enabled ? hint() : "Шарики выключены · нажми ● вкл. · " + hint()); } renderCone();
  }
  // The start pose is the user's last manual ring turn before a launch: a
  // launch from the starts remembers it, ↩ and a new launch return to it.
  const fresh = () => !(balls.length ? balls : F ? [F] : []).some(b => !b.ready);
  // v0.1064: старт шариков — общий стартовый снимок всех режимов (Z.coneStartPose, zz-ui.js coneStartMark / coneStartApply)
  function rememberStart() { coneStartMark(true); save(); }
  function restoreStart() {
    pauseRotation();
    if (!coneStartApply()) return;
    save(); if (typeof renderRows === "function") renderRows();
  }
  window.zzBallToStart = () => { if (F || balls.length) reset(false, true); };   // «↩ старт» в «Кручении»: шарики — на свои старты, закрытие колец остаётся
  function metrics(S) {
    if (batchBusy || !$("ballLabTime")) return;
    const P = S ? Z.coneBallRoute === "in" ? outerStarts(S) : boundaryPoints(S) : [{ id: "center", label: "Центр" }], key = P.map(p => p.id).join("|");
    if (key !== lastPoints) {
      const select = $("ballLabStart"); select.replaceChildren();
      const all = document.createElement("option"); all.value = "all"; all.textContent = Z.coneBallRoute === "in" ? "Все внешние щели: " + P.length : "Все " + (S ? P.length : 11) + ": углы К2, края К1 и центр"; select.appendChild(all);
      const group = document.createElement("option"); group.value = "group"; group.textContent = "Сквозная группа"; group.hidden = true; select.appendChild(group);
      for (const p of P) { const opt = document.createElement("option"); opt.value = p.id; opt.textContent = p.label; select.appendChild(opt); }
      lastPoints = key;
    }
    const grouped = !allStarts() && throughCount() > 1;
    const option = $("ballLabStart").querySelector('[value="group"]');
    if (option) { option.hidden = !grouped; option.textContent = "Сквозные: " + throughCount() + (throughCount() === 2 ? " навстречу" : " шарика"); }
    $("ballLabStart").value = Z.coneBallRoute === "in" ? "all" : grouped ? "group" : allStarts() ? "all" : S ? startPoint(S).id : "center";
    $("ballLabStart").disabled = Z.coneBallRoute === "in";
    const T = F && !F.ready ? F.period : S ? period(S) : null, mult = F && !F.ready ? F.mult : fraction(Z.coneBallMult || "1");
    const elapsed = balls.length ? Math.max(...balls.map(b => b.elapsed)) : F ? F.elapsed : 0;
    const text = T && Number.isFinite(mult) ? "T₀ " + T.toFixed(3) + " с · " + (allStarts() ? "диаметр" : "путь") + " за " + (T / mult).toFixed(3) + " с" + (F && !F.ready ? " · прошло " + elapsed.toFixed(3) + " с" : "") : "Нужны два вращающихся кольца и положительная дробь";
    if ($("ballLabTime").textContent !== text) { $("ballLabTime").textContent = text; $("ballLabRun").title = text; }
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
  window.zzBallTurnsFraction = turnsFraction;
  function renderTurns() {
    const el = $("ballLabTurns"); if (!el) return;
    const list = run ? run.results : []; el.hidden = !list.length;
    if (!list.length) { el.textContent = ""; return; }
    const count = Math.max(...list.map(b => b.ringTurns.length));
    const rows = list.map(b => '<tr><th scope="row">' + b.number + (b.stage === "lost" ? " ✕" : b.stage === "done" ? (b.clean ? " ✓" : " ×") : "") + '</th>' + Array.from({length:count}, (_, k) => { const v = b.ringTurns[k]; return '<td' + (v < -1e-10 ? ' class="ccw"' : '') + '>' + (v === undefined ? "—" : turnsFraction(v)) + '</td>'; }).join('') + '</tr>').join('');
    const html = '<table><caption>Обороты колец за путь шарика' + (run.launched > 64 ? ' · последние 64 из ' + run.launched : '') + '</caption><thead><tr><th scope="col">Шарик</th>' + Array.from({length:count}, (_, k) => '<th scope="col">К' + (k + 1) + '</th>').join('') + '</tr></thead><tbody>' + rows + '</tbody></table>';
    if (el.innerHTML !== html) el.innerHTML = html;
  }
  function choose(id) { if (id === "group") return; pauseRotation(); Z.coneBallThroughCount = 1; Z.coneBallBatch = id === "all"; if (id !== "all") Z.coneBallStart = id; save(); reset(); }
  function launch(config = {}) {
    if (config.through !== undefined) Z.coneBallThroughCount = config.through;
    else if (config.start !== undefined || config.batch !== undefined || config.mult !== undefined) Z.coneBallThroughCount = 1;
    if (config.start !== undefined) { Z.coneBallBatch = config.start === "all"; if (config.start !== "all") Z.coneBallStart = config.start; }
    if (config.batch !== undefined) Z.coneBallBatch = !!config.batch;
    if (config.route !== undefined && routes[config.route]) Z.coneBallRoute = config.route;
    // v0.1028: ручной скорости нет — базовая всегда 1× (диаметр за T₀), остальное делает подстройка; сквозной передаёт свою.
    Z.coneBallMult = config.mult !== undefined ? String(config.mult) : "1";
    Z.coneBallSlitOnly = !!config.slit; Z.coneBallSlitStart = !!config.slitStart;   // v0.1050: запуск из «Граней»
    pauseRotation(); if (fresh()) rememberStart(); else restoreStart(); F = null; balls = [];
    enabled = true; Z.coneBallOn = true; ui();
    if (typeof coneReleaseRings === "function") coneReleaseRings();
    if (Z.coneBallRoute === "in") initCenter();
    const S = snapshot(); if (!S) { status(hint()); return false; }
    if (Z.coneBallRoute !== "in") clearCenter();
    if (Z.coneBallRoute === "in" && centerCount() >= S.rings.length) { status("Все кольца закрыты · сброс снова откроет щели"); renderCone(); return false; }
    newRun();
    chain = !!config.chain; lossRun = !!config.loss; lossSpeed = 0; markRun = !!config.mark; pendingMarks = []; pendingBits = [];
    prepare(S, true, true); save(); if (!F || F.ready) return false;
    if (chain && !balls.length) { Object.assign(F, { number: 1, label: "Вылет 1" }); balls = [F]; batchStatus(); }   // v0.1051: первый шарик цепочки
    if (!coneSpinning) $("bConeAuto").click();
    paused = !coneSpinning;
    renderCone(); return true;
  }
  function launchThrough(count = 1) {
    pauseRotation();
    if (!fresh()) { restoreStart(); F = null; balls = []; }
    // v0.1029: солнце гасится, а с ним и луч-часы, которые оно включало само; иначе выключенное солнце оставляло луч лазера.
    if (Z.coneSun && $("bConeSun")) {
      $("bConeSun").click();
      const clock = $("coneClock"); if (Z.coneClock && clock && clock.onchange) { clock.checked = false; clock.onchange({ target: clock }); }
    }
    if (typeof coneReleaseRings === "function") coneReleaseRings();
    Z.coneBallMult = "1";
    const S = snapshot(), group = S ? movingGroup(S, rate(S), period(S), count) : { error: hint() };
    const result = group.error ? group : group.runs[0];
    if (result.error) { status(result.error); say(result.error); renderCone(); return false; }
    if (!launch({ start: result.point.id, batch: false, route: "cross", mult: speedText(result.mult), through: count })) return false;
    F.through = true;
    if (count === 1) { F.speed = result.speed; F.mult = result.mult; }
    if (count > 1) batchStatus();
    else status(result.auto ? "Сквозной с автоподстройкой · " + result.point.label + " · база " + speedText(result.mult) + "× · скорость на каждом отрезке своя" : "Сквозной проход · " + result.point.label + " · " + speedText(result.mult) + "× · " + result.duration.toFixed(3) + " с");
    labControls(); renderCone(); return true;
  }
  window.zzBallLaunch = launch;
  window.zzBallThrough = launchThrough;
  window.zzBallPoints = () => { const S = snapshot(); return S ? boundaryPoints(S) : []; };
  function ballInfo(b) { return { marked: b.marked, lostAt: b.lostAt, flips: b.flips || 0, flipReq: !!b.flipReq, auto: b.auto, tuned: b.tuned, segSpeed: b.seg && b.seg.speed, id: b.id, number: b.number, label: b.label, route: b.route, stage: b.stage, ready: b.ready, speed: b.speed, period: b.period, multiplier: b.mult, length: b.length, distance: b.travel, elapsed: b.elapsed, ringTurns: b.ringTurns.slice(), clean: b.clean, reversals: b.reversals, ring: b.k, edge: b.raw, q: b.q, angle: b.a, loop: b.loop, crossings: b.crossings, arcs: b.arcs, arcSpeed: b.arc && b.arc.speed, waitingForRing: b.wait ? b.wait.next + 1 : null, loopError: b.loopError }; }
  window.zzBallInfo = () => F && { ...ballInfo(F), batch: allStarts(), balls: balls.map(ballInfo) };
  window.zzBallLabSync = () => {
    if (!lab) return;
    Z.coneBallLabOpen = !lab.classList.contains("cmin");
  };
  // v0.1021: оформление группы тоже меняет class; оно не должно запускать новую отрисовку.
  function observeLabFold(el) {
    let open = !el.classList.contains("cmin"), raf = 0;
    new MutationObserver(() => {
      const next = !el.classList.contains("cmin");
      if (next === open) return;
      open = next; Z.coneBallLabOpen = next;
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; renderCone(); });
    }).observe(el, { attributes: true, attributeFilter: ["class"] });
  }
  function initLab() {
    if (typeof ZZ_BG !== "undefined" && ZZ_BG) return;
    lab = $("solBallLab"); const host = lab && lab.querySelector(":scope > .cgb"); if (!host) return;
    if (!host.querySelector(".ball-lab-body")) host.insertAdjacentHTML("beforeend", `<div class="ball-lab-body cgrp-fill">
      <div class="ball-lab-row"><label>Путь <select id="ballLabRoute"><option value="cross">через центр</option><option value="out">на вылет</option><option value="in">в центр</option></select></label><button id="ballLabPoints" type="button" aria-pressed="true">◎ точки</button></div>
      <label>Старт <select id="ballLabStart"><option value="all">Все 11: углы К2, края К1 и центр</option></select></label>
      <div class="ball-lab-row ball-lab-rings"><div class="ball-lab-ring"><span>Кольцо 1</span><button type="button" class="ib" data-ball-ring="0" data-step="-.5">−½</button><button type="button" class="ib" data-ball-ring="0" data-step=".5">+½</button></div><div class="ball-lab-ring"><span>Кольцо 2</span><button type="button" class="ib" data-ball-ring="1" data-step="-.5">−½</button><button type="button" class="ib" data-ball-ring="1" data-step=".5">+½</button></div></div>
      <div class="ball-lab-row"><button id="ballLabThrough" type="button" aria-pressed="false" title="Рассчитать скорость и запустить один сквозной проход в текущем режиме вращения. Старт — выбранный внешний угол; при выборе всех точек начинаем поиск с крайнего левого. Кольца без промежутков. Поиск до 64 относительных оборотов; в конце зелёный шарик и ✓ — проход без разворота.">↦ сквозной</button><button type="button" data-ball-through="2" aria-pressed="false" title="Два шарика одновременно с противоположных внешних краёв, с одной постоянной скоростью. В центре проходят друг сквозь друга.">⇄ 2</button><button type="button" data-ball-through="3" aria-pressed="false" title="Три шарика одновременно с разных внешних граней. Каждому подбирается своя постоянная скорость; столкновений нет.">↦ 3</button><button type="button" data-ball-through="4" aria-pressed="false" title="Четыре шарика одновременно с четырёх внешних граней. Каждому подбирается своя постоянная скорость; столкновений нет.">↦ 4</button></div>
      <div class="ball-lab-row"><button id="ballLabOne" type="button" aria-pressed="false" title="Что делает шарик в центре у кольца 1 из одного бита — по кругу:
центр: насквозь — едет дальше по прямой напротив разреза;
⊙ назад — у кольца 1 только разрез: пришёл по нему в центр — выходит по нему же обратно (не разворот, шарик зелёный);
⟳ щель 180° — дойдя до центра, шарик поворачивает кольцо 1 на полоборота: его щель встаёт на продолжение пути, и шарик едет дальше в ту же сторону. Все шарики на кольце 1 поворачиваются с ним; в оборотах кольца 1 — по ½ на переворот.
При ◐ и ✚ у кольца 1 свои грани с обеих сторон — там всегда насквозь.">центр: насквозь</button><button id="ballLabArc" type="button" aria-pressed="false" title="∞ По дугам: четыре шарика переходят на К3 и следующие видимые кольца. На самом внешнем краю огибают дугу и идут обратно. При несовпадении прямых ждут на своей дуге и продолжают при их появлении. Ждущий шарик — жёлтый; скорость на прямых постоянна. Ещё раз — выключить и вернуть к старту.">∞ по дугам</button></div>
      <small id="ballLabGroupSpeeds" hidden title="Номер шарика: его базовая скорость ×; на каждом отрезке она подстраивается под совпадение граней."></small>
      <div id="ballLabTime" hidden></div><div class="ball-lab-row"><button id="ballLabRun" type="button">▶ запуск</button><button id="ballLabPause" type="button">⏸ пауза</button><button id="ballLabReset" type="button">↩ к старту</button><button id="ballLabDir" type="button">↻ / ↺</button></div>
      <div id="ballLabTurns" title="Фактический поворот каждого кольца с момента запуска шарика, в оборотах по 360°. Дроби сокращены; ≈ — округление до 1/1000 оборота. ↻ по часовой, ↺ − против. На паузе счёт стоит; ✓ — чистый выход, × — выход с разворотами; результат зафиксирован. Новый запуск и ↩ обнуляют счёт. В режиме ∞ считается весь путь, включая дуги."></div>
      <div class="ball-lab-status-placeholder"></div></div>`);
    const statusLine = $("coneBallStatus");
    if (statusLine) { statusLine.className = "ball-lab-status"; lab.querySelector(".ball-lab-status-placeholder").replaceWith(statusLine); }
    $("ballLabRoute").value = routes[Z.coneBallRoute] ? Z.coneBallRoute : "cross";
    $("ballLabRun").onclick = () => launch();
    $("ballLabThrough").onclick = () => launchThrough(1);
    lab.querySelectorAll("[data-ball-through]").forEach(b => b.onclick = () => launchThrough(+b.dataset.ballThrough));
    $("ballLabOne").onclick = () => { const m = centerMode(); Z.coneBallCenter = m === "through" ? "back" : m === "back" ? "flip" : "through"; delete Z.coneBallOne; save(); reset(true); labControls(); };   // v0.1046: по кругу
    $("ballLabArc").onclick = () => { Z.coneBallArc = !Z.coneBallArc; if (Z.coneBallArc) launchThrough(4); else reset(true); save(); labControls(); };
    $("ballLabPause").onclick = () => { if (paused && (!enabled || !F || F.ready)) launch(); else $("bConeAuto").click(); };
    $("ballLabReset").onclick = () => reset(true);
    $("ballLabDir").onclick = () => { pauseRotation(); $("bConeDir").click(); reset(); };
    $("ballLabStart").onchange = () => choose($("ballLabStart").value);
    $("ballLabRoute").onchange = () => { pauseRotation(); Z.coneBallThroughCount = 1; Z.coneBallRoute = $("ballLabRoute").value; save(); reset(); };
    $("ballLabPoints").onclick = () => { Z.coneBallPoints = Z.coneBallPoints === false; $("ballLabPoints").setAttribute("aria-pressed", String(Z.coneBallPoints)); save(); renderCone(); };
    $("ballLabPoints").setAttribute("aria-pressed", String(Z.coneBallPoints !== false));
    lab.querySelectorAll("[data-ball-ring]").forEach(b => b.onclick = () => {
      pauseRotation(); const i = +b.dataset.ballRing;
      if (i === 1 && Z.rows.length === 1) { Z.coneFillTurn = (Z.coneFillTurn || 0) + +b.dataset.step; Z.coneFillFree = true; }
      else { coneRot[i] = (coneRot[i] || 0) + +b.dataset.step; Z.coneFree ||= {}; Z.coneFree[i] = true; }
      Z.coneRot = coneRot.slice(); save(); reset();
    });
    observeLabFold(lab);
    const source = $("coneBallStatus"), syncStatus = () => { source.title = source.textContent; const name = lab.querySelector(":scope > .glab"); if (name) name.title = source.textContent + "\n\n" + LAB_HELP; };
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
    Z.coneBallAuto = true; Z.coneBallMult = "1";   // v0.1028: только автоподстройка, ручной скорости нет
    enabled = Z.coneBallOn !== false; paused = !coneSpinning; ui(); reset(false, true);
    $("bConeBall").onclick = () => {
      enabled = !enabled; Z.coneBallOn = enabled; ui(); save(); reset();
      if (enabled && coneSpinning) { window.zzBallSpinState(true); renderCone(); }
    };
    $("bConeBallReset").onclick = () => reset(true);
    initLab(); reset(false, true);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true }); else init();
})();
