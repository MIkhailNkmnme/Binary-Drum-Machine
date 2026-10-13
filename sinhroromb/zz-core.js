/* Синхрофазотрон — математика без DOM. Точные дроби движения, операции над битами,
   построение строк, циклы и угловая геометрия света. */

/* ─── Четвёрка зеркал ─────────────────────────────────────────────────────────────────────── */
// Motion uses reduced fractions with arbitrary-size integer numerators and denominators.
// Angles and arc motion are fractions of a complete turn, not radian distances.
const ZZExact = (() => {
  const gcd = (a, b) => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) [a, b] = [b, a % b]; return a; };
  class Fraction {
    constructor(n, d = 1n) {
      if (!d) throw new RangeError("Zero denominator");
      if (d < 0n) { n = -n; d = -d; }
      const g = gcd(n, d); this.n = n / g; this.d = d / g;
    }
    add(value) { const b = from(value), g = gcd(this.d, b.d); return new Fraction(this.n * (b.d / g) + b.n * (this.d / g), this.d / g * b.d); }
    sub(value) { return this.add(from(value).neg()); }
    mul(value) { const b = from(value), g = gcd(this.n, b.d), h = gcd(b.n, this.d); return new Fraction(this.n / g * (b.n / h), this.d / h * (b.d / g)); }
    div(value) { const b = from(value); return this.mul(new Fraction(b.d, b.n)); }
    neg() { return new Fraction(-this.n, this.d); }
    abs() { return this.n < 0n ? this.neg() : this; }
    sign() { return this.n < 0n ? -1 : this.n > 0n ? 1 : 0; }
    cmp(value) { const b = from(value), n = this.n * b.d - b.n * this.d; return n < 0n ? -1 : n > 0n ? 1 : 0; }
    eq(value) { const b = from(value); return this.n === b.n && this.d === b.d; }
    floor() { return this.n >= 0n ? this.n / this.d : -((-this.n + this.d - 1n) / this.d); }
    ceil() { return -this.neg().floor(); }
    mod(value = 1) { const b = from(value); return this.sub(b.mul(this.div(b).floor())); }
    number() { return Number(this.n) / Number(this.d); }
    text() { return this.d === 1n ? String(this.n) : this.n + "/" + this.d; }
    toJSON() { return this.text(); }
  }
  function from(value = 0, denominator) {
    if (denominator !== undefined) return from(value).div(from(denominator));
    if (value instanceof Fraction) return value;
    if (typeof value === "bigint") return new Fraction(value);
    const text = String(value).trim().replace(",", ".");
    if (text.includes("/")) { const p = text.split("/"); if (p.length !== 2) throw new TypeError("Invalid fraction"); return from(p[0]).div(from(p[1])); }
    const m = /^([+-]?)(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/i.exec(text);
    if (!m || !(m[2] || m[3])) throw new TypeError("Invalid exact number: " + text);
    let n = BigInt((m[2] || "0") + (m[3] || "")), d = 1n;
    const scale = (m[3] || "").length - Number(m[4] || 0);
    if (scale > 0) d = 10n ** BigInt(scale); else n *= 10n ** BigInt(-scale);
    return new Fraction(m[1] === "-" ? -n : n, d);
  }
  return {from,gcd,min:(a, b) => from(a).cmp(b) <= 0 ? from(a) : from(b),max:(a, b) => from(a).cmp(b) >= 0 ? from(a) : from(b)};
})();

// Balance geometry is measured in complete turns. Only drawing converts to radians.
function zzBalanceArcs(start, end){
  const q = ZZExact.from, width = q(end).sub(start);
  if (width.sign() <= 0) return [];
  if (width.cmp(1) >= 0) return [[q(0), q(1)]];
  const lo = q(start).mod(1), hi = lo.add(width);
  return hi.cmp(1) <= 0 ? [[lo, hi]] : [[lo, q(1)], [q(0), hi.sub(1)]];
}
function zzBalanceWeights(arcs, width, shift = 0){
  const q = ZZExact.from, weights = Array(4).fill(q(0));
  for (const [a, b] of arcs) for (const [lo, hi] of zzBalanceArcs(a.add(shift), b.add(shift))) {
    for (let k = 0; k < 4; k++) {
      const overlap = ZZExact.min(hi, q(k + 1, 4)).sub(ZZExact.max(lo, q(k, 4)));
      if (overlap.sign() > 0) weights[k] = weights[k].add(overlap.div(width));
    }
  }
  return weights;
}

function zzInv(s){ let o = ""; for (let i = 0; i < s.length; i++) o += s[i] === "1" ? "0" : "1"; return o; }
function zzRev(s){ return s.split("").reverse().join(""); }
function zzInvRev(s){ return zzInv(zzRev(s)); }
function zzIsBits(s){ return typeof s === "string" && s.length > 0 && /^[01]+$/.test(s); }

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

function gf2Set(v, j){ v[j >>> 5] |= (1 << (j & 31)); }
function gf2Flip(v, j){ v[j >>> 5] ^= (1 << (j & 31)); }

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
  // v0.046: ◯ кольцом — строка кольцевая, следующая = XOR с соседом справа по кругу; длина не падает — цилиндр
  if (mode === "ring") { const r = [mask]; while (r.length < n) r.push(ZZ_OPS.xorNb.step(r[r.length - 1])); return r; }
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

/* ─── ◯ Ожерелье (v0.048) ────────────────────────────────────────────────────────────────────
   Строка, свёрнутая в кольцо, без начала: все её повороты — одно и то же. canon — наименьший поворот (вид
   ожерелья), shift — на сколько повернуть влево, чтобы его получить, orbit — сколько разных поворотов (период:
   у 111 — 1, у 1010 — 2, у 1000 — 4). */
function zzNecklace(s){
  const n = s.length;
  let p = n;
  for (let d = 1; d < n; d++) if (n % d === 0 && s.slice(d) + s.slice(0, d) === s) { p = d; break; }
  let best = s, k0 = 0;
  for (let k = 1; k < p; k++) { const r = s.slice(k) + s.slice(0, k); if (r < best) { best = r; k0 = k; } }
  return { canon: best, shift: k0, orbit: p };
}

/* ─── Заготовки Аниматрицы (v0.200) ─────────────────────────────────────────────────────────
   Запрос: «заготовки-пресеты, по умолчанию 256 строк: все серпинские правила и какие-нибудь последовательности».
   zzEcaRows — элементарный клеточный автомат (правило 0…255) из сида в середине пустой полосы; строка y — только
   световой конус: от сида на y клеток влево и вправо, длина 2y + длина сида. Поле достаточно широкое, края не мешают.
   Проверено перебором всех 256 правил из одной «1»: ровно треугольник правила 90 дают 18, 26, 82, 90, 146, 154, 210, 218 —
   из одной точки (и из 101) они совпадают, разные — с сида, где единицы стоят рядом (11, 1101…).
   zzPascalRows — Паскаль по модулю 2 (🔺+1): строка на бит длиннее, от сида.
   zzSeqBits — первые n членов последовательности 0/1; в заготовке строка i — первые i + 1 членов (треугольник префиксов). */
function zzEcaRows(rule, seed, H){
  seed = zzIsBits(seed) ? seed : "1";
  const L = seed.length, W = L + 2 * H + 2, c = H + 1;
  let row = new Uint8Array(W); for (let i = 0; i < L; i++) row[c + i] = seed[i] === "1" ? 1 : 0;
  const out = [];
  for (let y = 0; y < H; y++) {
    let s = ""; for (let x = c - y; x < c + L + y; x++) s += row[x] ? "1" : "0";
    out.push(s);
    const n = new Uint8Array(W);   // за краем полосы — та же крайняя клетка: фон, каким его делает правило
    for (let x = 0; x < W; x++) { const l = x ? row[x - 1] : row[0], m = row[x], r = x < W - 1 ? row[x + 1] : row[W - 1]; n[x] = (rule >> (l * 4 + m * 2 + r)) & 1; }
    row = n;
  }
  return out;
}
function zzPascalRows(seed, H){ const r = [zzIsBits(seed) ? seed : "1"]; while (r.length < H) r.push(zzPascalNext(r[r.length - 1])); return r; }
function zzSeqBits(name, n){
  const isPrime = (k) => { if (k < 2) return false; for (let d = 2; d * d <= k; d++) if (k % d === 0) return false; return true; };
  let o = "";
  if (name === "fib") { let a = "0", b = "01"; while (b.length < n) { const t = b + a; a = b; b = t; } return b.slice(0, n); }   // 0→01, 1→0
  if (name === "kol") { const s = [1, 2, 2]; for (let i = 2; s.length < n; i++) { const v = i % 2 ? 2 : 1; for (let k = 0; k < s[i]; k++) s.push(v); } return s.slice(0, n).map(v => v === 1 ? "1" : "0").join(""); }
  for (let i = 0; i < n; i++) {
    let b = 0;
    if (name === "tm") { let x = i, p = 0; while (x) { p ^= x & 1; x >>>= 1; } b = p; }
    else if (name === "rs") { let x = i, p = 0; while (x) { if ((x & 3) === 3) p ^= 1; x >>>= 1; } b = p; }   // Рудин — Шапиро: чётность пар «11»
    else if (name === "fold") { let k = i + 1; while (!(k & 1)) k >>>= 1; b = (k & 3) === 1 ? 1 : 0; }   // складывание бумаги (кривая дракона)
    else if (name === "pd") { let k = i + 1, v = 0; while (!(k & 1)) { k >>>= 1; v++; } b = v % 2 ? 0 : 1; }   // удвоение периода: 1→10, 0→11
    else if (name === "bs") { const t = i.toString(2).split("1").filter(z => z.length); b = i === 0 || t.every(z => z.length % 2 === 0) ? 1 : 0; }   // Баум — Свит
    else if (name === "prime") b = isPrime(i + 1) ? 1 : 0;
    else if (name === "sq") { const r = Math.round(Math.sqrt(i + 1)); b = r * r === i + 1 ? 1 : 0; }
    else if (name === "rnd") b = Math.random() < 0.5 ? 1 : 0;
    o += b ? "1" : "0";
  }
  return o;
}
function zzSeqRows(name, H){
  if (name === "cnt") return Array.from({ length: H }, (_, i) => (i + 1).toString(2));   // двоичный счёт 1, 10, 11, 100…
  if (name === "rnd") return Array.from({ length: H }, (_, i) => zzSeqBits("rnd", i + 1));
  const s = zzSeqBits(name, H); return Array.from({ length: H }, (_, i) => s.slice(0, i + 1));
}

/* ─── Метрики строки (v0.239) ────────────────────────────────────────────────────────────────────────────────────
   Запрос: «как в Cellcosmos — энтропия и симметрия». Энтропия — по тройкам соседних бит (какие «слова» длины 3
   встречаются и насколько поровну), делённая на 3: 0 — один рисунок повторяется, 1 — все восемь троек поровну (шум);
   строка короче 8 бит — по одиночным битам. Зеркальность — доля пар «бит и его отражение с другого конца», которые
   совпадают: 100% — палиндром (⇄ оставляет строку собой), 0% — антипалиндром (⇄ даёт её инверсию); средний бит
   нечётной строки пары не имеет и не считается. zzRowsStats — средние по набору строк и доля единиц. */
function zzRowEntropy(s){
  const n = s.length; if (!n) return 0;
  const k = n >= 8 ? 3 : 1, cnt = new Map(); let tot = 0;
  for (let i = 0; i + k <= n; i++) { const w = s.substr(i, k); cnt.set(w, (cnt.get(w) || 0) + 1); tot++; }
  let h = 0; for (const c of cnt.values()) { const q = c / tot; h -= q * Math.log2(q); }
  return h / k;
}
function zzRowMirror(s){
  const n = s.length, m = n >> 1; if (!m) return 1;
  let e = 0; for (let i = 0; i < m; i++) if (s[i] === s[n - 1 - i]) e++;
  return e / m;
}
function zzRowsStats(rows){
  let h = 0, m = 0, ones = 0, bits = 0;
  for (const s of rows) { h += zzRowEntropy(s); m += zzRowMirror(s); for (let i = 0; i < s.length; i++) if (s[i] === "1") ones++; bits += s.length; }
  const n = rows.length || 1; return { h: h / n, m: m / n, d: bits ? ones / bits : 0 };
}

/* v0.914: совпавшие границы колец. edges — отсортированные углы [0, 2π), rate — радиан на единицу фазы.
   Последнее кольцо — за чертой. Проверяются все внутренние кольца, а не только сосед.
   Поиск события аналитический: совпадение не теряется между кадрами даже при быстром вращении. */
function zzEdgeNorm(a){ const t = 2 * Math.PI; return ((a % t) + t) % t; }
function zzEdgeHas(edges, a, tol = 1e-6){
  a = zzEdgeNorm(a); let lo = 0, hi = edges.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (edges[m] < a) lo = m + 1; else hi = m; }
  for (const k of [lo - 1, lo]) { const e = edges[(k + edges.length) % edges.length]; if (e !== undefined && Math.abs(Math.atan2(Math.sin(e - a), Math.cos(e - a))) <= tol) return true; }
  return false;
}
function zzAlignedEdges(rings, ph = 0){
  if (rings.length < 2 || rings.some(r => !r.edges.length)) return [];
  const outer = rings[rings.length - 1];
  return outer.edges.map(a => zzEdgeNorm(a + outer.rate * ph)).filter(a => rings.slice(0, -1).every(r => zzEdgeHas(r.edges, a - r.rate * ph)));
}
function zzEdgeMeet(rings, dph){
  if (!dph || rings.length < 2 || rings.some(r => !r.edges.length)) return null;
  const outer = rings[rings.length - 1], inner = rings.slice(0, -1);
  const ref = inner.reduce((a, b) => Math.abs(b.rate - outer.rate) > Math.abs(a.rate - outer.rate) ? b : a);
  const v = (outer.rate - ref.rate) * dph, tau = 2 * Math.PI;
  if (Math.abs(v) < 1e-12) return null;   // общим поворотом новые совпадения не образуются
  const candidates = [];
  for (const a of outer.edges) for (const b of ref.edges) {
    const diff = a - b, lo = Math.min(diff, diff + v), hi = Math.max(diff, diff + v);
    for (let k = Math.ceil((lo - 1e-9) / tau); k <= Math.floor((hi + 1e-9) / tau); k++) {
      const u = (k * tau - diff) / v;
      if (u > 1e-8 && u <= 1 + 1e-9) candidates.push(Math.min(1, u));   // ▶ после паузы пропускает прежнее совпадение
    }
  }
  candidates.sort((a, b) => a - b); let prev = -1;
  for (const u of candidates) {
    if (Math.abs(u - prev) < 1e-10) continue; prev = u;
    const ph = dph * u, angles = zzAlignedEdges(rings, ph);
    if (angles.length) return { ph, angles };
  }
  return null;
}

/* v0.918: моменты встреч любых граней на одной прямой (включая противоположные).
   Пересекаем только перекрывающиеся траектории, чтобы найти касание и между кадрами. */
function zzEdgeEvents(rings, dph){
  const period = Math.PI, eps = 1e-9, paths = [], events = [];
  for (const ring of rings) {
    const seen = new Set(), v = ring.rate * dph;
    for (const edge of ring.edges) {
      const a = zzEdgeNorm(edge) % period, key = Math.round(a / eps); if (seen.has(key)) continue; seen.add(key);
      const lo = Math.min(a, a + v), hi = Math.max(a, a + v);
      for (let k = Math.ceil((-hi - eps) / period); k <= Math.floor((period - lo + eps) / period); k++) {
        paths.push({ a: a + k * period, v, lo: Math.max(0, lo + k * period), hi: Math.min(period, hi + k * period) });
      }
    }
  }
  paths.sort((a, b) => a.lo - b.lo); let active = [];
  for (const p of paths) {
    active = active.filter(q => q.hi >= p.lo - eps);
    for (const q of active) {
      const speed = p.v - q.v; if (Math.abs(speed) < 1e-12) continue;
      const u = (q.a - p.a) / speed, x = p.a + p.v * u;
      if (u > 1e-8 && u <= 1 + eps && x >= -eps && x <= period + eps) events.push(Math.min(1, u));
    }
    active.push(p);
  }
  return events.sort((a, b) => a - b).filter((u, i, all) => !i || u - all[i - 1] > 1e-10).map(u => u * dph);
}

/* v0.916: замкнутые угловые просветы — касание краёв сохраняется точкой [a, a].
   Это отдельный расчёт для одиночных прямых: точки не превращаются в освещённые сектора. */
function zzArcClosedUnion(arcs, eps = 1e-9){
  const out = [];
  for (const [lo, hi] of arcs.map(a => a.slice()).sort((a, b) => a[0] - b[0])) {
    const last = out[out.length - 1];
    if (last && lo <= last[1] + eps) last[1] = Math.max(last[1], hi);
    else out.push([lo, hi]);
  }
  return out;
}
function zzArcClosedAnd(A, B, eps = 1e-9){
  const out = [], tau = 2 * Math.PI; let i = 0, j = 0;
  while (i < A.length && j < B.length) {
    const lo = Math.max(A[i][0], B[j][0]), hi = Math.min(A[i][1], B[j][1]);
    if (hi > lo + eps) out.push([lo, hi]);
    else if (hi >= lo - eps) out.push([(lo + hi) / 2, (lo + hi) / 2]);
    if (A[i][1] < B[j][1]) i++; else j++;
  }
  const at0 = L => L.some(([a]) => a <= eps), atEnd = L => L.some(([, b]) => b >= tau - eps);
  if ((at0(A) && atEnd(B)) || (atEnd(A) && at0(B))) out.push([0, 0]);
  return zzArcClosedUnion(out, eps);
}
function zzArcClosedShift(A, angle){
  const out = [], tau = 2 * Math.PI;
  for (const [lo, hi] of A) {
    const w = hi - lo, a = zzEdgeNorm(lo + angle), b = a + w;
    if (w >= tau) out.push([0, tau]);
    else if (b <= tau) out.push([a, b]);
    else out.push([a, tau], [0, b - tau]);
  }
  return zzArcClosedUnion(out);
}
function zzCtrIsolated(source, exit){
  const gap = zzArcClosedAnd(exit, zzArcClosedShift(exit, Math.PI));
  const lit = zzArcClosedAnd(source, gap), out = [];
  for (const [a, b] of lit) if (b - a <= 1e-9) {
    // 0 и 2π — одна граница: край существующего сектора не считается отдельной прямой.
    if (lit.some(([lo, hi]) => hi - lo > 1e-9 && [a, a - 2 * Math.PI, a + 2 * Math.PI].some(t => t >= lo - 1e-9 && t <= hi + 1e-9))) continue;
    const t = ((a % Math.PI) + Math.PI) % Math.PI;
    if (!out.some(x => Math.abs(Math.atan2(Math.sin(2 * (t - x)), Math.cos(2 * (t - x)))) < 2e-9)) out.push(t);
  }
  return out.sort((a, b) => a - b);
}
