/* ═══════════════════════════════════════════════════════════════════════════════════════════
   ZAZERKALIUS — ЯДРО (математика без интерфейса)
   Заведено 2026-09-22. Всё, что здесь, — ЧИСТЫЕ функции над строками из 0 и 1: ни DOM, ни
   состояния страницы. Перенесено из Zerkalius Layers (fold-layers, v1.516–1.546) по смыслу
   один в один — там эти вещи проверены пользователем; здесь они просто вынуты из интерфейса:
     • четвёрка зеркал V₄ (сама, ⇄, 🔁, ⇄🔁) и неподвижные биты;
     • оси симметрии — Манакер (палиндромы и антипалиндромы), в строке и в ленте;
     • ▽ спуск и край, 🔺+1 (Паскаль по модулю 2), 🔢+1;
     • GF(2): аффинные шаги F(x) = A·x ⊕ b, неподвижные точки Гауссом;
     • Берлекэмп — Мэсси (линейная сложность);
     • ядро децимации;
     • детектор цикла и «память» бит по циклу.
   ═══════════════════════════════════════════════════════════════════════════════════════════ */

/* ─── Четвёрка зеркал ─────────────────────────────────────────────────────────────────────── */
function zzInv(s){ let o = ""; for (let i = 0; i < s.length; i++) o += s[i] === "1" ? "0" : "1"; return o; }
function zzRev(s){ return s.split("").reverse().join(""); }
function zzInvRev(s){ return zzInv(zzRev(s)); }
function zzIsBits(s){ return typeof s === "string" && s.length > 0 && /^[01]+$/.test(s); }

/* НЕПОДВИЖНЫЕ БИТЫ РАЗВОРОТА. Бит №k стоит на месте, если равен своему зеркальному «№ n−1−k»:
   значений всего два, и такой бит разворот не трогает. Остальные — МЕНЯЮЩИЕСЯ. Отсюда факт,
   найденный в Layers (кнопка «🔁 Инв меняющихся», v1.519): инвертировать ровно меняющиеся биты —
   то же самое, что развернуть строку. Это и есть определение меняющихся. */
function zzFixedMask(s){
  const n = s.length, m = new Array(n);
  for (let i = 0; i < n; i++) m[i] = s[i] === s[n - 1 - i];
  return m;
}
function zzFlipMoving(s){
  const m = zzFixedMask(s); let o = "";
  for (let i = 0; i < s.length; i++) o += m[i] ? s[i] : (s[i] === "1" ? "0" : "1");
  return o;
}

/* ОРБИТА под V₄ и кто её держит. У инверсии неподвижных строк нет (бит не равен сам себе
   инвертированному), поэтому орбита — 2 или 4, а стабилизатор — пусто, ⇄ или ⇄🔁. */
function zzOrbit(s){
  const imgs = { self: s, rev: zzRev(s), inv: zzInv(s), invRev: zzInvRev(s) };
  const uniq = new Set(Object.values(imgs));
  const stab = [];
  if (imgs.rev === s) stab.push("rev");
  if (imgs.invRev === s) stab.push("invRev");
  // Каноника — наименьшая из четырёх: одинаковая у всей орбиты, по ней орбиты и сравнивают.
  let canon = s; for (const v of uniq) if (v < canon) canon = v;
  return { imgs, size: uniq.size, stab, canon };
}

/* ─── Оси симметрии (Манакер) ─────────────────────────────────────────────────────────────── */
/* d1[c] — половина нечётного палиндрома с центром на бите c: длина 2·d1[c] − 1. */
function zzManacherOdd(s){
  const n = s.length, d = new Array(n).fill(0);
  for (let i = 0, l = 0, r = -1; i < n; i++) {
    let k = i > r ? 1 : Math.min(d[l + r - i], r - i + 1);
    while (i - k >= 0 && i + k < n && s[i - k] === s[i + k]) k++;
    d[i] = k--;
    if (i + k > r) { l = i - k; r = i + k; }
  }
  return d;
}
/* d2[c] — половина чётного палиндрома в шве между битами c−1 и c: длина 2·d2[c]. */
function zzManacherEven(s){
  const n = s.length, d = new Array(n).fill(0);
  for (let i = 0, l = 0, r = -1; i < n; i++) {
    let k = i > r ? 0 : Math.min(d[l + r - i + 1], r - i + 1);
    while (i - k - 1 >= 0 && i + k < n && s[i - k - 1] === s[i + k]) k++;
    d[i] = k--;
    if (i + k > r) { l = i - k - 1; r = i + k; }
  }
  return d;
}
/* Подмена t[i] = s[i] ⊕ (i нечётный): антипалиндромы превращаются в чётные палиндромы. */
function zzAntiTransform(s){
  let o = "";
  for (let i = 0; i < s.length; i++) o += ((s[i] === "1") !== ((i & 1) === 1)) ? "1" : "0";
  return o;
}
/* ВСЕ МАКСИМАЛЬНЫЕ ОСИ строки длиной от minLen. Каждая: { kind: "pal"|"anti", pos2, lo, hi, len }.
   pos2 — место оси в полубитах: 2·c — по самому биту c, 2·c − 1 — в шве перед битом c. Это и есть
   «указатель симметрии»: куда поставить зеркальце, чтобы кусок lo..hi отразился в себя
   (у антипалиндрома — в своё инвертированное). Манакер даёт по одной, самой длинной оси на каждое
   место, так что короче её на том же месте осей нет. */
function zzAxesOf(s, minLen){
  const ml = Math.max(2, minLen | 0 || 2);
  const n = s.length, out = [];
  if (n < ml) return out;
  const d1 = zzManacherOdd(s), d2 = zzManacherEven(s), d2a = zzManacherEven(zzAntiTransform(s));
  for (let c = 0; c < n; c++) {
    const l1 = 2 * d1[c] - 1;
    if (l1 >= ml) out.push({ kind: "pal", pos2: 2 * c, lo: c - d1[c] + 1, hi: c + d1[c] - 1, len: l1 });
    const l2 = 2 * d2[c];
    if (l2 >= ml) out.push({ kind: "pal", pos2: 2 * c - 1, lo: c - d2[c], hi: c + d2[c] - 1, len: l2 });
    const la = 2 * d2a[c];
    if (la >= ml) out.push({ kind: "anti", pos2: 2 * c - 1, lo: c - d2a[c], hi: c + d2a[c] - 1, len: la });
  }
  return out;
}
/* Порог для ЛЕНТЫ (Layers v1.534): в случайной последовательности из N бит самый длинный
   палиндром растёт как 2·log₂N, и с порогом строки карта ленты тонула бы в шуме. */
function zzThruMinLen(n){ return Math.max(6, Math.ceil(2 * Math.log2(Math.max(2, n)))); }

/* ЛЕНТА ИЗ СТРОК и оси, идущие ЧЕРЕЗ стык строк (Layers «🪞 Оси сквозной»). Обходы — четыре;
   Инв-варианты не нужны: инверсия и разворот всей ленты осей не меняют.
   Возвращает { tape, rowAt, axes } — у каждой оси ещё rows: сколько строк она прошла. */
const ZZ_THRU_MODES = { concatR: "Сквоз →", concatL: "Сквоз ←", snakeL: "Змей ←", snakeR: "Змей →" };
function zzTape(rows, mode){
  let tape = ""; const rowAt = [];
  rows.forEach((s, r) => {
    let piece = s;
    if (mode === "concatL") piece = zzRev(s);
    else if (mode === "snakeL") piece = (r % 2 === 0) ? zzRev(s) : s;
    else if (mode === "snakeR") piece = (r % 2 === 0) ? s : zzRev(s);
    for (let i = 0; i < piece.length; i++) { tape += piece[i]; rowAt.push(r); }
  });
  return { tape, rowAt };
}
function zzThruAxes(rows, mode){
  const { tape, rowAt } = zzTape(rows, mode);
  const minLen = zzThruMinLen(tape.length);
  const axes = [];
  for (const a of zzAxesOf(tape, minLen)) {
    if (a.lo < 0 || a.hi >= tape.length) continue;
    const span = rowAt[a.hi] - rowAt[a.lo];
    if (span > 0) axes.push(Object.assign(a, { rows: span + 1, r0: rowAt[a.lo], r1: rowAt[a.hi] }));
  }
  return { tape, rowAt, axes, minLen };
}

/* ─── Построения ─────────────────────────────────────────────────────────────────────────── */
/* 🔺+1 — следующая строка треугольника Паскаля по модулю 2: строку обкладывают нулями по краям и
   под каждой парой пишут XOR. n бит → n+1. От «1» это ровно Серпинский (теорема Люка:
   бит k строки n равен 1, когда k AND n = k), но работает от ЛЮБОЙ строки. */
function zzPascalNext(s){
  const p = "0" + s + "0"; let o = "";
  for (let i = 0; i + 1 < p.length; i++) o += p[i] === p[i + 1] ? "0" : "1";
  return o;
}
/* 🔢+1 — строка как двоичное число плюс один; ведущие нули сохраняются (0011 → 0100). */
function zzBinInc(s){
  const n = (BigInt("0b" + s) + 1n).toString(2);
  return n.length >= s.length ? n : "0".repeat(s.length - n.length) + n;
}
/* ▽ СПУСК — XOR соседей БЕЗ краёв: n → n−1 → … → 1. Каждый этаж теряет бит, но ЛЕВЫЙ КРАЙ
   (первый бит каждого этажа, n штук) хранит строку целиком: это биномиальное преобразование над
   GF(2), и оно само себе обратное — спуск от края даёт саму строку. Не сжатие, а перекладка. */
function zzDescent(s){
  const levels = [s]; let cur = s;
  while (cur.length > 1) {
    let nx = "";
    for (let i = 0; i + 1 < cur.length; i++) nx += cur[i] === cur[i + 1] ? "0" : "1";
    levels.push(nx); cur = nx;
  }
  return levels;
}
function zzEdge(levels){ return levels.map(l => l[0]).join(""); }
function zzOnes(s){ let c = 0; for (let i = 0; i < s.length; i++) if (s[i] === "1") c++; return c; }

/* ─── Шаги и GF(2) ───────────────────────────────────────────────────────────────────────── */
/* Каждый шаг — аффинный над GF(2): F(x) = A·x ⊕ b. fill строит A и b (для алгебры), step — тот же
   шаг прямо над строкой (для прогона). AND в списке нет: он нелинеен и алгеброй не решается. */
function gf2Words(n){ return (n + 31) >>> 5; }
function gf2Set(v, j){ v[j >>> 5] |= (1 << (j & 31)); }
function gf2Flip(v, j){ v[j >>> 5] ^= (1 << (j & 31)); }
function gf2Get(v, j){ return (v[j >>> 5] >>> (j & 31)) & 1; }
function gf2Zero(n){ const W = gf2Words(n); const A = []; for (let i = 0; i < n; i++) A.push(new Uint32Array(W)); return A; }
const zzX1 = (c) => c === "1" ? "0" : "1";
const ZZ_OPS = {
  rotLI:  { lab: "Круг Инв ◄",   fill(n, A, b){ for (let i = 0; i < n; i++) gf2Set(A[i], (i + 1) % n); gf2Set(b, n - 1); },
            step: s => s.slice(1) + zzX1(s[0]) },
  rotRI:  { lab: "Круг Инв ►",   fill(n, A, b){ for (let i = 0; i < n; i++) gf2Set(A[i], (i - 1 + n) % n); gf2Set(b, 0); },
            step: s => zzX1(s[s.length - 1]) + s.slice(0, -1) },
  rotL:   { lab: "Круг ◄",       fill(n, A, b){ for (let i = 0; i < n; i++) gf2Set(A[i], (i + 1) % n); },
            step: s => s.slice(1) + s[0] },
  rotR:   { lab: "Круг ►",       fill(n, A, b){ for (let i = 0; i < n; i++) gf2Set(A[i], (i - 1 + n) % n); },
            step: s => s[s.length - 1] + s.slice(0, -1) },
  rev:    { lab: "Разворот ⇄",   fill(n, A, b){ for (let i = 0; i < n; i++) gf2Set(A[i], n - 1 - i); },
            step: s => zzRev(s) },
  revInv: { lab: "Инв-разворот", fill(n, A, b){ for (let i = 0; i < n; i++) { gf2Set(A[i], n - 1 - i); gf2Set(b, i); } },
            step: s => zzInvRev(s) },
  xorNb:  { lab: "x ⊕ сосед справа", fill(n, A, b){ for (let i = 0; i < n; i++) { gf2Set(A[i], i); gf2Flip(A[i], (i + 1) % n); } },
            step: s => { const n = s.length; let o = ""; for (let i = 0; i < n; i++) o += s[i] === s[(i + 1) % n] ? "0" : "1"; return o; } },
  rule90: { lab: "Правило 90",   fill(n, A, b){ for (let i = 0; i < n; i++) { gf2Flip(A[i], (i - 1 + n) % n); gf2Flip(A[i], (i + 1) % n); } },
            step: s => { const n = s.length; let o = ""; for (let i = 0; i < n; i++) o += s[(i - 1 + n) % n] === s[(i + 1) % n] ? "0" : "1"; return o; } },
};
function gf2MulVec(A, v, n){
  const W = gf2Words(n); const out = new Uint32Array(W);
  for (let i = 0; i < n; i++) {
    let acc = 0; const r = A[i];
    for (let w = 0; w < W; w++) acc ^= r[w] & v[w];
    acc ^= acc >>> 16; acc ^= acc >>> 8; acc ^= acc >>> 4; acc ^= acc >>> 2; acc ^= acc >>> 1;
    if (acc & 1) gf2Set(out, i);
  }
  return out;
}
function gf2MulMat(A, B, n){
  const W = gf2Words(n); const C = gf2Zero(n);
  for (let i = 0; i < n; i++) {
    const ci = C[i], ai = A[i];
    for (let j = 0; j < n; j++) if (gf2Get(ai, j)) { const bj = B[j]; for (let w = 0; w < W; w++) ci[w] ^= bj[w]; }
  }
  return C;
}
// (A1,b1) после (A2,b2) = (A1·A2, A1·b2 ⊕ b1)
function gf2Compose(F1, F2, n){
  const b = gf2MulVec(F1.A, F2.b, n);
  for (let w = 0; w < b.length; w++) b[w] ^= F1.b[w];
  return { A: gf2MulMat(F1.A, F2.A, n), b };
}
function gf2Power(F, t, n){
  let R = { A: gf2Zero(n), b: new Uint32Array(gf2Words(n)) };
  for (let i = 0; i < n; i++) gf2Set(R.A[i], i);
  let P = F;
  while (t > 0) { if (t & 1) R = gf2Compose(P, R, n); t = Math.floor(t / 2); if (t) P = gf2Compose(P, P, n); }
  return R;
}
/* M·x = y методом Гаусса. Свободные переменные — из hint (битов самой строки), поэтому решение
   выходит «ближайшим» к ней по построению. { rank, x } или { rank, x: null }, если несовместно. */
function gf2Solve(M, y, n, hint){
  const W = gf2Words(n);
  const rows = M.map(r => r.slice());
  const rhs = []; for (let i = 0; i < n; i++) rhs.push(gf2Get(y, i));
  const pivCol = [];
  let r = 0;
  for (let c = 0; c < n && r < n; c++) {
    let p = -1; for (let i = r; i < n; i++) if (gf2Get(rows[i], c)) { p = i; break; }
    if (p < 0) continue;
    [rows[r], rows[p]] = [rows[p], rows[r]]; [rhs[r], rhs[p]] = [rhs[p], rhs[r]];
    for (let i = 0; i < n; i++) if (i !== r && gf2Get(rows[i], c)) { for (let w = 0; w < W; w++) rows[i][w] ^= rows[r][w]; rhs[i] ^= rhs[r]; }
    pivCol.push(c); r++;
  }
  for (let i = r; i < n; i++) if (rhs[i]) return { rank: r, x: null };
  const isPiv = new Uint8Array(n); for (const c of pivCol) isPiv[c] = 1;
  const x = new Uint8Array(n);
  for (let c = 0; c < n; c++) if (!isPiv[c]) x[c] = hint[c];
  for (let k = r - 1; k >= 0; k--) {
    const c = pivCol[k]; let v = rhs[k];
    for (let j = 0; j < n; j++) if (j !== c && x[j] && gf2Get(rows[k], j)) v ^= 1;
    x[c] = v;
  }
  return { rank: r, x };
}
const ZZ_GF2_MAX = 512;
/* Какие строки длины n вернутся к себе ровно через t шагов операции: (Aᵗ ⊕ E)·x = bₜ.
   Плюс собственный период самой строки — прямым прогоном, с потолком. */
function zzGf2(s, key, t){
  const op = ZZ_OPS[key] || ZZ_OPS.rotLI, n = s.length;
  if (n > ZZ_GF2_MAX) return { error: `строка ${n} бит — длиннее ${ZZ_GF2_MAX}, степень матрицы тут заметно задумается` };
  const F = { A: gf2Zero(n), b: new Uint32Array(gf2Words(n)) };
  op.fill(n, F.A, F.b);
  const Ft = gf2Power(F, t, n);
  const M = Ft.A.map(row => row.slice());
  for (let i = 0; i < n; i++) gf2Flip(M[i], i);
  const hint = new Uint8Array(n); for (let i = 0; i < n; i++) hint[i] = s[i] === "1" ? 1 : 0;
  const sol = gf2Solve(M, Ft.b, n, hint);
  const CAP = 20000;
  let cur = s, per = 0;
  for (let i = 1; i <= CAP; i++) { cur = op.step(cur); if (cur === s) { per = i; break; } }
  const free = n - sol.rank;
  const x = sol.x ? Array.from(sol.x).join("") : null;
  let diff = 0; if (x) for (let i = 0; i < n; i++) if (x[i] !== s[i]) diff++;
  return { lab: op.lab, n, t, rank: sol.rank, free, solvable: !!x, count: x ? (free <= 40 ? String(2 ** free) : "2^" + free) : "0",
           x, diff, per, cap: CAP, selfFixed: per > 0 && t % per === 0 };
}

/* ─── Линейная сложность (Берлекэмп — Мэсси) ─────────────────────────────────────────────── */
/* Кратчайшее правило «бит = XOR битов на позициях taps раньше», выдающее ленту ЦЕЛИКОМ; за n²
   шагов и с гарантией, что короче нет. У порождённой правилом ленты L мало, у случайной ≈ N/2. */
const ZZ_LINCOMP_MAX = 8192;
function zzBerlekampMassey(bits){
  const N = bits.length;
  let C = new Uint8Array(N + 1), B = new Uint8Array(N + 1);
  C[0] = 1; B[0] = 1;
  let L = 0, m = 1;
  for (let n = 0; n < N; n++) {
    let d = bits[n];
    for (let i = 1; i <= L; i++) d ^= C[i] & bits[n - i];
    if (!d) { m++; continue; }
    if (2 * L <= n) {
      const T = C.slice();
      for (let i = 0; i + m <= N; i++) if (B[i]) C[i + m] ^= 1;
      L = n + 1 - L; B = T; m = 1;
    } else {
      for (let i = 0; i + m <= N; i++) if (B[i]) C[i + m] ^= 1;
      m++;
    }
  }
  const taps = [];
  for (let i = 1; i <= L; i++) if (C[i]) taps.push(i);
  return { L, taps };
}
function zzLinComp(tape, more){
  const full = tape.length;
  if (tape.length > ZZ_LINCOMP_MAX) tape = tape.slice(0, ZZ_LINCOMP_MAX);
  const N = tape.length;
  const bits = new Uint8Array(N);
  for (let i = 0; i < N; i++) bits[i] = tape[i] === "1" ? 1 : 0;
  const { L, taps } = zzBerlekampMassey(bits);
  const gen = Array.from(bits.slice(0, L));
  for (let n = L; n < N + (more || 64); n++) { let v = 0; for (const t of taps) v ^= gen[n - t]; gen.push(v); }
  let ok = true;
  for (let i = 0; i < N; i++) if (gen[i] !== bits[i]) { ok = false; break; }
  return { N, full, L, taps, seed: tape.slice(0, L), next: gen.slice(N).join(""), ok };
}

/* ─── Ядро децимации ─────────────────────────────────────────────────────────────────────── */
/* Лента прореживается с шагом k: каждый k-й бит с каждого сдвига, потом k²-й… Окна длины L
   сводятся к представителю своей четвёрки V₄ и считаются. Перестал расти счёт — ядро замкнулось:
   лента устроена как k-автоматная (Туэ–Морс, бумажное складывание). Серпинский, склеенный из
   строк, НЕ замыкается и не должен: длины строк растут. На конечной ленте это повод
   присмотреться, а не теорема. */
function zzDecimation(tape, k, L){
  const N = tape.length;
  const canon = p => { const r = zzRev(p), i = zzInv(p), ri = zzInv(r); let m = p; for (const q of [r, i, ri]) if (q < m) m = q; return m; };
  const seen = new Set();
  const sizes = [];
  for (let m = 1; m <= 4096 && Math.floor(N / m) >= L; m *= k) {
    for (let r = 0; r < m; r++) {
      if (r + (L - 1) * m >= N) continue;
      let p = "";
      for (let j = 0; j < L; j++) p += tape[r + j * m];
      seen.add(canon(p));
    }
    sizes.push(seen.size);
  }
  return sizes;
}

/* ─── Цикл и память ──────────────────────────────────────────────────────────────────────── */
/* Прогон шага от строки до первого повтора. Точная таблица встреченных состояний (без хэшей:
   строки короткие) до CAP шагов. Возвращает { mu, lam, states } — μ шагов до входа в петлю,
   λ — длина петли; states — пройденный путь (для показа), не длиннее SHOW. λ = 1 — неподвижная
   точка: шаг больше ничего не меняет. */
const ZZ_CYCLE_CAP = 20000, ZZ_CYCLE_SHOW = 256;
function zzCycle(s, key){
  const op = ZZ_OPS[key] || ZZ_OPS.rotLI;
  const seen = new Map([[s, 0]]);
  const states = [s];
  let cur = s;
  for (let i = 1; i <= ZZ_CYCLE_CAP; i++) {
    cur = op.step(cur);
    const was = seen.get(cur);
    if (was !== undefined) return { mu: was, lam: i - was, states, lab: op.lab, steps: i };
    seen.set(cur, i);
    if (states.length < ZZ_CYCLE_SHOW) states.push(cur);
  }
  return { mu: -1, lam: -1, states, lab: op.lab, steps: ZZ_CYCLE_CAP };
}
/* «🔥 Память по циклу» (Layers v1.531): бит разгорается, пока держит своё значение. Для каждого
   состояния пути — сколько шагов подряд каждый бит не менялся; уровень 0…4 для раскраски. */
function zzMemoryHeat(states){
  const heat = [];
  let age = null;
  for (const s of states) {
    if (!age) age = new Array(s.length).fill(0);
    else for (let i = 0; i < s.length; i++) age[i] = (s[i] === heat.prev[i]) ? age[i] + 1 : 0;
    heat.push(age.map(a => a >= 8 ? 4 : a >= 4 ? 3 : a >= 2 ? 2 : a >= 1 ? 1 : 0));
    heat.prev = s;
  }
  delete heat.prev;
  return heat;
}

/* ─── ⇋ Поправка зеркала (v0.006, из Layers v1.625–1.626) ────────────────────────────────── */
/* Строка = левая половина L + поправка D (+ средний бит при нечётной длине). Для каждого из
   четырёх способов достроить правую половину из L — зеркало ⇄, зеркало с инверсией ⇄🔁, повтор ⧉,
   повтор с инверсией ⧉🔁 — D по биту на бит L: 1 там, где пара не сошлась («несимметричный бит»).
   L + D — снова n бит: зеркало не сжимает, а раскладывает; выигрыш — когда D пустая или редкая. */
const ZZ_MIRROR_KINDS = [
  { sign: "⇄",   name: "зеркало",             rev: true,  inv: false, code: "00" },
  { sign: "⇄🔁", name: "зеркало с инверсией", rev: true,  inv: true,  code: "01" },
  { sign: "⧉",   name: "повтор",              rev: false, inv: false, code: "10" },
  { sign: "⧉🔁", name: "повтор с инверсией",  rev: false, inv: true,  code: "11" },
];
function zzMirrorMask(x, k){
  const m = x.length, h = m >> 1;
  let d = "";
  for (let i = 0; i < h; i++) {
    const p = k.rev ? x[m - 1 - i] : x[m - h + i];
    d += ((x[i] !== p) !== k.inv) ? "1" : "0";
  }
  return d;
}
/* Все четыре поправки и лучшая (меньше всего единиц; при равенстве — раньше в списке). */
function zzMirrorAll(s){
  const all = ZZ_MIRROR_KINDS.map(k => { const D = zzMirrorMask(s, k); return { k, D, ones: zzOnes(D) }; });
  let best = all[0];
  for (const a of all) if (a.ones < best.ones) best = a;
  return { all, best };
}
/* Складывания подряд без единой поправки. Ниже 4 бит не складываем: строку в 2–3 бита складывает
   любая пара ⇄ / ⇄🔁, это не находка. */
function zzMirrorFolds(s){
  const folds = [];
  let cur = s;
  while (cur.length >= 4) {
    const k = ZZ_MIRROR_KINDS.find(k => zzMirrorMask(cur, k).indexOf("1") < 0);
    if (!k) break;
    folds.push({ m: cur.length, sign: k.sign, mid: cur.length & 1 });
    cur = cur.slice(0, cur.length >> 1);
  }
  return { folds, seed: cur };
}
/* Грубая цена строки «в мире зеркал» — не доказательство. На каждом этаже: 1 бит «сложено или
   нет», 2 бита «каким зеркалом», средний бит, поправка сырьём или номерами позиций единиц, что
   короче (+1 бит, каким видом). Половина разбирается так же. Случайная строка выходит в n+1. */
function zzMirrorPlan(x){
  const m = x.length, raw = 1 + m;
  if (m < 4) return { cost: raw, steps: [], seed: x };
  const h = m >> 1, mid = m & 1;
  const sub = zzMirrorPlan(x.slice(0, h));
  const best = zzMirrorAll(x).best;
  const posBits = Math.max(1, Math.ceil(Math.log2(h)));
  const dCost = 1 + (best.ones ? Math.min(h, best.ones * posBits) : 0);
  const folded = 1 + 2 + mid + sub.cost + dCost;
  if (folded >= raw) return { cost: raw, steps: [], seed: x };
  return { cost: folded, steps: [{ m, sign: best.k.sign, ones: best.ones, mid }].concat(sub.steps), seed: sub.seed };
}
/* Поправки многих строк одним столбиком. common — один вид на все строки (тот, у которого единиц во
   всех D вместе меньше), иначе у каждой свой, и тогда его 2 бита стоят в начале её строки. Строки
   короче 2 бит половин не имеют — в столбик не идут. */
function zzMirrorLayer(rows, common){
  const idx = [];
  rows.forEach((s, i) => { if (s.length >= 2) idx.push(i); });
  const masks = idx.map(i => ZZ_MIRROR_KINDS.map(k => { const D = zzMirrorMask(rows[i], k); return { D, ones: zzOnes(D) }; }));
  const totals = ZZ_MIRROR_KINDS.map((_, j) => masks.reduce((a, m) => a + m[j].ones, 0));
  let cj = 0;
  for (let j = 1; j < totals.length; j++) if (totals[j] < totals[cj]) cj = j;
  const use = [0, 0, 0, 0];
  let ones = 0;
  const out = idx.map((i, n) => {
    let j = cj;
    if (!common) { j = 0; for (let q = 1; q < 4; q++) if (masks[n][q].ones < masks[n][j].ones) j = q; }
    use[j]++; ones += masks[n][j].ones;
    return (common ? "" : ZZ_MIRROR_KINDS[j].code) + masks[n][j].D;
  });
  const halfBits = idx.reduce((a, i) => a + (rows[i].length >> 1), 0);
  return { out, idx, totals, common: cj, use, ones, halfBits, distinct: new Set(out).size, skipped: rows.length - idx.length };
}

/* ─── ⊿ Сложить лентой в форму (v0.006, из Layers v1.627) ─────────────────────────────────── */
/* Лента режется на куски длиной first, first+step, first+2·step…: 1 и 1 — треугольник, шаг 0 —
   прямоугольник ширины first. Форма бесплатна (её знают обе стороны), но порядка не добавляет —
   это линза. Сразу считается, что в форме видно: строка = предыдущая + бит (нового 1 бит), строка =
   🔺+1 от предыдущей (0 бит: Паскаль, a, a⊕b, …, b), строка повторяет предыдущую (0 бит). */
function zzFoldShape(tape, first, step){
  const pieces = [];
  for (let p = 0, len = first; p < tape.length; p += len, len += step) pieces.push(tape.slice(p, p + len));
  // 🔺+1 без обкладки нулями сверху: a0, a0⊕a1, …, a(n−2)⊕a(n−1), a(n−1) — то же, что zzPascalNext.
  let plusBit = 0, pascal = 0, same = 0, fresh = pieces.length ? pieces[0].length : 0;
  const kinds = pieces.length ? ["fresh"] : [];   // v0.008: вид каждой строки — для живого показа
  for (let k = 1; k < pieces.length; k++) {
    const a = pieces[k - 1], b = pieces[k];
    const nx = zzPascalNext(a);
    const isPascal = b.length <= nx.length && b.length >= a.length && nx.startsWith(b) && b.length > 0;
    const isPlus = !isPascal && b.length > a.length && b.startsWith(a);
    const isSame = !isPascal && !isPlus && b.length > 0 && a.startsWith(b);
    if (isPascal) { pascal++; kinds.push("pascal"); }
    else if (isPlus) { plusBit++; fresh += b.length - a.length; kinds.push("plus"); }
    else if (isSame) { same++; kinds.push("same"); }
    else { fresh += b.length; kinds.push("fresh"); }
  }
  const lastFull = pieces.length ? pieces[pieces.length - 1].length === first + (pieces.length - 1) * step : true;
  return { pieces, kinds, plusBit, pascal, same, fresh, tail: lastFull ? 0 : pieces[pieces.length - 1].length };
}

/* ─── ⇅ Сортировка сдвигов — преобразование Барроуза — Уилера (v0.006) ────────────────────── */
/* Все циклические сдвиги строки — строки квадратной таблицы; таблица сортируется; хранится только
   ПОСЛЕДНИЙ столбец и номер строки, где встал оригинал. Порядок сортировки бесплатен (отсортировать
   может любой), и он кодирует порядок в строке: по столбцу и номеру строка восстанавливается целиком.
   Счёт честный — n бит + номер; выигрыш в том, что сортировка сводит похожие биты в длинные серии.
   Сортировка — удвоением префиксов (n·log²n), ничьи (у периодических строк сдвиги совпадают) — по
   номеру сдвига; обратный ход — через соответствие «последний столбец → первый». */
const ZZ_BWT_MAX = 65536;
function zzBwt(s){
  const n = s.length;
  let rank = new Int32Array(n);
  for (let i = 0; i < n; i++) rank[i] = s[i] === "1" ? 1 : 0;
  const idx = []; for (let i = 0; i < n; i++) idx.push(i);
  const tmp = new Int32Array(n);
  for (let k = 1; ; k *= 2) {
    const r = rank, kk = k;
    const key2 = (i) => r[(i + kk) % n];
    idx.sort((a, b) => (r[a] - r[b]) || (key2(a) - key2(b)));
    tmp[idx[0]] = 0;
    for (let j = 1; j < n; j++) {
      const a = idx[j - 1], b = idx[j];
      tmp[b] = tmp[a] + ((r[a] !== r[b] || key2(a) !== key2(b)) ? 1 : 0);
    }
    rank = Int32Array.from(tmp);
    if (n < 2 || tmp[idx[n - 1]] === n - 1 || 2 * k >= n) break;
  }
  const rk = rank;
  idx.sort((a, b) => (rk[a] - rk[b]) || (a - b));
  let last = "";
  for (let j = 0; j < n; j++) last += s[(idx[j] - 1 + n) % n];
  return { order: idx, last, index: idx.indexOf(0) };
}
function zzUnbwt(last, index){
  const n = last.length;
  if (!n || index < 0 || index >= n) return null;
  let c0 = 0; for (let i = 0; i < n; i++) if (last[i] === "0") c0++;
  const lf = new Int32Array(n);
  let s0 = 0, s1 = 0;
  for (let i = 0; i < n; i++) lf[i] = last[i] === "0" ? s0++ : c0 + s1++;
  const out = new Array(n);
  for (let k = n - 1, r = index; k >= 0; k--) { out[k] = last[r]; r = lf[r]; }
  return out.join("");
}
/* Число серий одинаковых бит: «0011101» — 4. */
function zzRuns(s){ let r = s.length ? 1 : 0; for (let i = 1; i < s.length; i++) if (s[i] !== s[i - 1]) r++; return r; }

/* ─── ⇉ Манчестерский код: 1 → 10, 0 → 01 (v0.007) ───────────────────────────────────────── */
/* Запрос пользователя: «что если 1 это 10, а 0 это 01 из исходной строки, по очерёдности слева».
   Строка удваивается, сведений в ней столько же: второй бит пары — инверсия первого. Избыточность
   ради надёжности: трёх одинаковых подряд не бывает (самосинхронизация), пары 00 и 11 запрещены
   (ошибка видна), единиц ровно столько же, сколько нулей. Правило, применённое k раз к «0», даёт
   Туэ–Морса длины 2^k. Раскод — первый бит каждой пары; bad — номера пар 00/11 (с нуля). */
function zzManchester(s){ let o = ""; for (let i = 0; i < s.length; i++) o += s[i] === "1" ? "10" : "01"; return o; }
function zzUnmanchester(s){
  const bad = []; let o = "";
  for (let i = 0; i + 1 < s.length; i += 2) {
    if (s[i] === s[i + 1]) bad.push(i >> 1);
    o += s[i];
  }
  return { out: o, bad, odd: (s.length & 1) === 1 };
}
/* Туэ–Морс: бит i — чётность числа единиц в двоичной записи i. Проверка, не он ли (или его
   инверсия) вышел после очередного шага кода. */
function zzIsThueMorse(s){
  let a = true, b = true;
  for (let i = 0; i < s.length && (a || b); i++) {
    let x = i, p = 0; while (x) { p ^= x & 1; x >>>= 1; }
    const c = p ? "1" : "0";
    if (s[i] !== c) a = false;
    if (s[i] === c) b = false;
  }
  return a ? 1 : b ? -1 : 0;
}

/* ─── △ Треугольник по маске (v0.011) ─────────────────────────────────────────────────────── */
/* Запрос пользователя: «построить треугольник по маске 10 — любой маске, длина задаётся». Строка k
   (k = 1…n) длиной k заполняется маской. mode "start" — каждая строка начинает маску с начала:
   1, 10, 101, 1010…; "tape" — маска идёт сплошной лентой через все строки (лента свёрнута
   треугольником, как в ⊿), и если длина маски не делит длины строк, фаза сдвигается от строки к
   строке — проступают косые полосы. */
function zzMaskTriangle(mask, n, mode){
  // v0.012: треугольник ОТ строки — Паскаль вниз (n строк, каждая на бит длиннее) или спуск (не больше длины).
  if (mode === "pascal") { const r = [mask]; while (r.length < n) r.push(zzPascalNext(r[r.length - 1])); return r; }
  if (mode === "descent") return zzDescent(mask).slice(0, n);
  const rows = [];
  if (mode === "tape") {
    let p = 0;
    for (let k = 1; k <= n; k++) {
      let r = "";
      for (let i = 0; i < k; i++) { r += mask[p % mask.length]; p++; }
      rows.push(r);
    }
  } else {
    for (let k = 1; k <= n; k++) {
      let r = "";
      for (let i = 0; i < k; i++) r += mask[i % mask.length];
      rows.push(r);
    }
  }
  return rows;
}

/* ─── 📡 Сигнал по базе (v0.013) ──────────────────────────────────────────────────────────── */
/* Разговор пользователя: «сигнал: база 10101…, 11 — это первый бит = 1, так как вторая строка; второй
   бит 111 на третьей строке = 1» → «да, сделай Сигнал по базе». Каждый бит сообщения — ОДНА строка:
   0 — строка базы (маска, повторённая на длину строки), 1 — отступ от базы: её инверсия или сплошные
   единицы. Это расширение спектра (GPS, CDMA): бит растянут на k «чипов», сведений в строке 1 бит,
   остальное — запас прочности. Читается строка по тому, к чему она ближе по Хэммингу: к базе или к
   отступу. Между базой и отступом d несовпадающих бит — строка переживает до ⌊(d−1)/2⌋ испорченных.
   У инверсии d = k (вся длина), у «сплошных единиц» при базе 10 — только число нулей базы, ≈ k/2:
   поэтому настоящие системы шлют ±, то есть инверсию. */
function zzBaseRow(mask, k){ let r = ""; for (let i = 0; i < k; i++) r += mask[i % mask.length]; return r; }
function zzDevRow(mask, k, dev){ return dev === "ones" ? "1".repeat(k) : zzInv(zzBaseRow(mask, k)); }
function zzHam(a, b){ let d = 0; const n = Math.min(a.length, b.length); for (let i = 0; i < n; i++) if (a[i] !== b[i]) d++; return d + Math.abs(a.length - b.length); }
/* shape "tri" — строка j длиной len + j (треугольник), "const" — все длиной len. */
function zzSignalEncode(msg, mask, dev, shape, len){
  const rows = [];
  for (let j = 0; j < msg.length; j++) {
    const k = shape === "const" ? len : len + j;
    rows.push(msg[j] === "1" ? zzDevRow(mask, k, dev) : zzBaseRow(mask, k));
  }
  return rows;
}
function zzSignalDecode(rows, mask, dev){
  return rows.map(r => {
    const k = r.length, B = zzBaseRow(mask, k), D = zzDevRow(mask, k, dev);
    const d0 = zzHam(r, B), d1 = zzHam(r, D), d = zzHam(B, D);
    return { bit: d === 0 ? "?" : d0 < d1 ? "0" : d1 < d0 ? "1" : "?", d0, d1, d, k, spare: Math.max(0, Math.floor((d - 1) / 2)) };
  });
}
/* Шум: каждый бит переворачивается с вероятностью p (0…1). */
function zzNoise(s, p){ let o = ""; for (let i = 0; i < s.length; i++) o += Math.random() < p ? (s[i] === "1" ? "0" : "1") : s[i]; return o; }

/* ─── 🔍 Проверка треугольника (v0.014) ───────────────────────────────────────────────────── */
/* Разговор пользователя: «как объединить биты правок так, чтобы одни и те же биты принадлежали двум
   разным строкам» → «да, сделай Проверку треугольника». Треугольник XOR — код, исправляющий ошибки:
   каждая тройка «два сверху, один под ними» даёт a ⊕ b ⊕ c = 0, и внутренний бит входит в ТРИ такие
   проверки (снизу в одну, сверху в две). Испорченный бит ломает ровно свои проверки, и общий у них —
   только он. Два вида треугольника:
     • ▽ спуск — строки короче на бит: низ[i] = верх[i] ⊕ верх[i+1];
     • 🔺 Паскаль — строки длиннее на бит: низ[i] = верх[i−1] ⊕ верх[i], за краями нули (у крайних
       бит проверка из двух).
   Проверка — список клеток [строка, место]; сломана, если XOR её бит = 1. */
function zzTriChecks(rows, mode){
  const n = rows.length;
  if (n < 2) return { err: "нужно хотя бы две строки" };
  let m = mode;
  const stepOk = (d) => rows.every((r, k) => k === 0 || r.length === rows[k - 1].length + d);
  if (m === "auto") m = stepOk(-1) ? "descent" : stepOk(1) ? "pascal" : null;
  if (!m) return { err: "длины строк не идут ни на бит короче (▽ спуск), ни на бит длиннее (🔺 Паскаль)" };
  const d = m === "descent" ? -1 : 1;
  for (let k = 1; k < n; k++)
    if (rows[k].length !== rows[k - 1].length + d)
      return { err: `строка ${k} длиной ${rows[k].length}, а для ${m === "descent" ? "▽ спуска" : "🔺 Паскаля"} нужна ${rows[k - 1].length + d}` };
  const checks = [];
  for (let k = 0; k + 1 < n; k++) {
    const L = rows[k].length;
    if (m === "descent") for (let i = 0; i + 1 < L; i++) checks.push([[k, i], [k, i + 1], [k + 1, i]]);
    else for (let i = 0; i <= L; i++) {
      const c = [];
      if (i - 1 >= 0) c.push([k, i - 1]);
      if (i < L) c.push([k, i]);
      c.push([k + 1, i]);
      checks.push(c);
    }
  }
  return { mode: m, checks };
}
function zzTriBroken(rows, checks){
  return checks.map(c => { let x = 0; for (const [r, i] of c) if (rows[r][i] === "1") x ^= 1; return x === 1; });
}
/* По каждой клетке: сколько у неё проверок (deg) и сколько из них сломано (bad). Кандидат в
   испорченные — клетка, у которой сломаны ВСЕ её проверки и которая одна покрывает все сломанные. */
function zzTriLocate(rows, checks, broken){
  const deg = rows.map(r => new Int32Array(r.length)), bad = rows.map(r => new Int32Array(r.length));
  let nb = 0;
  checks.forEach((c, j) => { if (broken[j]) nb++; for (const [r, i] of c) { deg[r][i]++; if (broken[j]) bad[r][i]++; } });
  const cand = [];
  if (nb) rows.forEach((r, k) => { for (let i = 0; i < r.length; i++) if (bad[k][i] === nb && deg[k][i] === nb) cand.push([k, i]); });
  return { deg, bad, nb, cand };
}
/* Исправление переворотом бит (как у декодеров LDPC, Галлагер, 1962): переворачиваем бит, у которого
   сломанных проверок больше, чем целых, — самый выгодный, — и повторяем, пока выгода есть. */
function zzTriBitFlip(rows, checks, maxIter){
  const R = rows.map(r => r.split(""));
  const flips = [];
  for (let it = 0; it < (maxIter || 500); it++) {
    const cur = R.map(a => a.join(""));
    const br = zzTriBroken(cur, checks);
    if (!br.some(Boolean)) break;
    const { deg, bad } = zzTriLocate(cur, checks, br);
    let best = null, gain = 0;
    R.forEach((a, k) => { for (let i = 0; i < a.length; i++) { const g = 2 * bad[k][i] - deg[k][i]; if (g > gain) { gain = g; best = [k, i]; } } });
    if (!best) break;
    const [k, i] = best;
    R[k][i] = R[k][i] === "1" ? "0" : "1";
    flips.push(best);
  }
  const out = R.map(a => a.join(""));
  return { rows: out, flips, left: zzTriBroken(out, checks).filter(Boolean).length };
}
