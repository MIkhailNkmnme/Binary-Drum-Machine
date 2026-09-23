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
