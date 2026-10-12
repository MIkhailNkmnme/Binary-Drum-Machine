#!/usr/bin/env node
/* ===========================================================================
   mayatnik-big.cjs — Маятник (Хоррориус) на десятки тысяч строк, вне браузера.
   2026-10-12, слово пользователя: «отдельную программу для 70 000+ строк с выгрузкой
   уменьшенных картинок и цифр — точно».

   Правило то же, что у страницы mayatnik/Zerkalius-mayatnik.html (ТРЕУГСЖАТИЯ из _pzl.xlsm):
   вершины якорь, −1, +1, −2, +2, … в строке 0, каждая пускает вниз конус правила 90,
   клетка = старое ⊕ левый ⊕ правый родитель (родители уже пересчитаны). Фон пустой.

   Чем отличается от страницы (и почему влезает в память):
   - бит — 1 бит, по 32 в слове Uint32Array; строка конуса считается словами,
     32 клетки за операцию: row[r] ^= ((row[r−1] << 1) ^ (row[r−1] >> 1)) & маска;
   - хранится только конус якоря (|c| ≤ r) треугольником, с полем в 2 клетки по краям.
     Снаружи — полоса «1» (Исследование, раздел 14½: доказано, что она замкнута и вся из единиц),
     её значения не считаются, а ставятся по формуле: клетка за краем = 1, если её накрыл
     хоть один поставленный конус (та же формула, что у цвета на странице), иначе пусто = 0.
     Память ≈ N²/8 байт: 70 000 строк — ~0,6 ГБ, 100 000 — ~1,25 ГБ.

   Запуск (из папки Binary-Drum-Machine):
     node mayatnik/mayatnik-big.cjs --rows 70000                 до N/3 (гибель последней дыры)
     node mayatnik/mayatnik-big.cjs --rows 20000 --steps 80000   до 4N (застывание)
     node mayatnik/mayatnik-big.cjs --rows 512 --check           сверка с ядром страницы
   Ключи: --rows N, --steps n (по умолчанию ⌈N/3⌉ + ⌈N/64⌉), --frames K (контрольных кадров, 24),
          --width px (ширина картинок, 2000), --out папка (по умолчанию E:\GD\_pzl\mayatnik-big\N…),
          --save-min m (сохранять состояние раз в m минут, 20; 0 — не сохранять), --fresh (не продолжать),
          --bits (2026-10-12: последний кадр ещё и бит в бит — kadr-NNNNNN-bity.png, пиксель = бит, всё поле:
          белый — 1, серый — 0, тёмный — пусто; PNG 2 бита на пиксель с палитрой).
   Выгрузка: kadr-NNNNNN.png (серое — доля единиц в клетке картинки, чёрное — дыры, тёмно-синее — пусто),
             cifry.csv и cifry.json (дыра по закону и по замеру, доля единиц, время), progress.json, state.*.
   =========================================================================== */
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib');

// ---------- ключи ----------
const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : (argv[i + 1] === undefined || argv[i + 1].startsWith('--') ? true : argv[i + 1]); };
const N = Math.max(8, parseInt(opt('rows', 1024), 10));
const STEPS = parseInt(opt('steps', Math.ceil(N / 3) + Math.ceil(N / 64)), 10);
const FRAMES = Math.max(1, parseInt(opt('frames', 24), 10));
const IMGW = Math.max(64, parseInt(opt('width', 2000), 10));
const SAVE_MIN = parseFloat(opt('save-min', 20));
const CHECK = !!opt('check', false), FRESH = !!opt('fresh', false), BITS = !!opt('bits', false);
const OUT = path.resolve(String(opt('out', path.join(__dirname, '..', '..', '..', 'mayatnik-big', `N${N}-n${STEPS}`))));

// ---------- вершины маятника ----------
const offset = k => k === 0 ? 0 : (k % 2 ? -((k + 1) >> 1) : (k >> 1));
const span = k => k <= 0 ? [0, -1] : [-(k >> 1), (k - 1) >> 1];   // крайние вершины после k конусов (k ≥ 1)
// Клетку (r, c) накрыл хоть один из k конусов: вершина a из [lo, hi], |c − a| ≤ r, a ≡ c + r (mod 2)
function covered(r, c, lo, hi) {
  const a0 = Math.max(lo, c - r), a1 = Math.min(hi, c + r);
  if (a0 > a1) return 0;
  const first = a0 + (((c + r - a0) % 2) + 2) % 2;
  return first <= a1 ? 1 : 0;
}

// ---------- поле: треугольник строк, общий столбцовый отсчёт X = c + OFF ----------
const OFF = N + 3;                                  // X ≥ 1 для |c| ≤ N + 2
const w0 = new Int32Array(N), w1 = new Int32Array(N), base = new Int32Array(N);   // слов < 2³¹ при N ≤ ~250 000
let total = 0;
for (let r = 0; r < N; r++) { w0[r] = (OFF - r - 2) >> 5; w1[r] = (OFF + r + 2) >> 5; base[r] = total - w0[r]; total += w1[r] - w0[r] + 1; }
const bytes = total * 4;
let F;
try { F = new Uint32Array(total); } catch (e) { console.error(`Не хватило памяти на поле ${N} строк: нужно ${(bytes / 1e9).toFixed(2)} ГБ.`); process.exit(1); }
const idx = (r, w) => base[r] + w;                  // индекс слова w строки r (без проверки границ)
const getBit = (r, c) => { const X = c + OFF, w = X >> 5; if (r < 0 || r >= N || w < w0[r] || w > w1[r]) return 0; return (F[idx(r, w)] >>> (X & 31)) & 1; };
const setBit = (r, c, b) => { const X = c + OFF, w = X >> 5, i = idx(r, w), m = 1 << (X & 31); F[i] = b ? (F[i] | m) : (F[i] & ~m); };

// Поле за краем конуса якоря (2 клетки с каждой стороны) — по формуле полосы «1»
function margins(r, lo, hi) { for (const c of [-r - 2, -r - 1, r + 1, r + 2]) setBit(r, c, covered(r, c, lo, hi)); }

const PAR = [0x55555555, 0xAAAAAAAA | 0];           // биты с чётным / нечётным X
// Один конус: вершина a; конус ∩ конус якоря, строки 1…N−1
function cone(k) {
  const a = offset(k), [lo, hi] = span(k + 1);
  if (k === 0) setBit(0, 0, 1);
  margins(0, lo, hi);
  for (let r = 1; r < N; r++) {
    margins(r - 1, lo, hi);                          // родители за краем — по формуле, с учётом этого конуса
    const cl = Math.max(a - r, -r), ch = Math.min(a + r, r);
    if (cl > ch) continue;
    const Xl = cl + OFF, Xh = ch + OFF, wl = Xl >> 5, wh = Xh >> 5;
    const pm = PAR[(a + r + OFF) & 1];
    const bp = base[r - 1], b = base[r], p0 = w0[r - 1], p1 = w1[r - 1];
    // соседние слова прошлой строки держим в переменных: pl — слева, pc — само, pr — справа
    let pl = wl - 1 >= p0 ? F[bp + wl - 1] : 0, pc = F[bp + wl];
    const mL = (~0 << (Xl & 31)), mH = ((Xh & 31) === 31 ? ~0 : ((1 << ((Xh & 31) + 1)) - 1));
    if (wl === wh) {
      const pr = wh + 1 <= p1 ? F[bp + wh + 1] : 0;
      F[b + wl] ^= (((pc << 1) | (pl >>> 31)) ^ ((pc >>> 1) | (pr << 31))) & pm & mL & mH;
      continue;
    }
    let pr = F[bp + wl + 1];                         // крайнее левое слово — с маской края
    F[b + wl] ^= (((pc << 1) | (pl >>> 31)) ^ ((pc >>> 1) | (pr << 31))) & pm & mL;   // родители X − 1 и X + 1
    pl = pc; pc = pr;
    for (let w = wl + 1; w < wh; w++) {              // середина строки — без проверок
      pr = F[bp + w + 1];
      F[b + w] ^= (((pc << 1) | (pl >>> 31)) ^ ((pc >>> 1) | (pr << 31))) & pm;
      pl = pc; pc = pr;
    }
    pr = wh + 1 <= p1 ? F[bp + wh + 1] : 0;          // крайнее правое слово
    F[b + wh] ^= (((pc << 1) | (pl >>> 31)) ^ ((pc >>> 1) | (pr << 31))) & pm & mH;
  }
}

// ---------- цифры: центральная дыра ----------
// Серия нулей через центр строки (c = 0 или c = −1 — шахматы), поиск словами
function zeroRun(r) {
  let best = 0;
  for (const c0 of [0, -1, 1]) {
    if (Math.abs(c0) > r || getBit(r, c0)) continue;
    let l = c0, h = c0;
    while (l - 1 >= -r && !getBit(r, l - 1)) { l--; if ((l + OFF) % 32 === 0) { while (l - 32 >= -r && F[idx(r, (l - 32 + OFF) >> 5)] === 0) l -= 32; } }
    while (h + 1 <= r && !getBit(r, h + 1)) { h++; if ((h + 1 + OFF) % 32 === 0) { while (h + 32 <= r && F[idx(r, (h + 1 + OFF) >> 5)] === 0) h += 32; } }
    best = Math.max(best, h - l + 1);
  }
  return best;
}
function hole() {
  const w = new Int32Array(N); for (let r = N >> 1; r < N; r++) w[r] = zeroRun(r);
  let best = null, r = N >> 1;
  while (r < N) {
    if (w[r] < 3) { r++; continue; }
    let t = r, b = r, area = 0, gap = 0;
    while (r < N && (w[r] >= 3 || gap < 2)) { if (w[r] >= 3) { area += w[r]; b = r; gap = 0; } else gap++; r++; }
    let rm = t; for (let q = t; q <= b; q++) if (w[q] > w[rm]) rm = q;
    if (!best || area > best.area) best = { top: rm, tip: b, width: w[rm], area };
  }
  return best;
}
const popc = x => { x -= (x >>> 1) & 0x55555555; x = (x & 0x33333333) + ((x >>> 2) & 0x33333333); return (((x + (x >>> 4)) & 0x0F0F0F0F) * 0x01010101) >>> 24; };

// ---------- картинка: уменьшенный конус якоря ----------
function crc32(buf) { let c, crc = 0xFFFFFFFF; for (let n = 0; n < buf.length; n++) { c = (crc ^ buf[n]) & 0xFF; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; } return (crc ^ 0xFFFFFFFF) >>> 0; }
function png(file, W, H, rgb) {
  const chunk = (t, d) => { const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc((W * 3 + 1) * H); for (let y = 0; y < H; y++) { raw[y * (W * 3 + 1)] = 0; rgb.copy(raw, y * (W * 3 + 1) + 1, y * W * 3, (y + 1) * W * 3); }
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]));
}
function picture(file, k) {
  const s = Math.max(1, Math.ceil((2 * N + 1) / IMGW)), W = Math.ceil((2 * N + 1) / s), H = Math.ceil(N / s);
  const ones = new Float64Array(W * H), cells = new Float64Array(W * H), [lo, hi] = span(k);
  for (let r = 0; r < N; r++) {
    const y = Math.floor(r / s);
    if (s >= 32) {                                     // крупный масштаб: слово целиком — в столбец его середины
      for (let w = w0[r]; w <= w1[r]; w++) { const xc = w * 32 + 16 - OFF; if (xc < -r - 15 || xc > r + 15) continue;
        const x = Math.min(W - 1, Math.max(0, Math.floor((xc + N) / s))), mid = Math.max(-r, Math.min(r, xc));
        const pm = F[idx(r, w)] & wordMask(r, w); ones[y * W + x] += popc(pm); cells[y * W + x] += popc(wordMask(r, w)) * (covered(r, mid, lo, hi) || k > 1 ? 1 : 0); }
    } else {
      for (let c = -r; c <= r; c++) { if (!covered(r, c, lo, hi)) continue; const x = Math.floor((c + N) / s); cells[y * W + x]++; ones[y * W + x] += getBit(r, c); }
    }
  }
  const rgb = Buffer.alloc(W * H * 3);
  for (let i = 0; i < W * H; i++) {
    let R = 13, G = 15, B = 22;                        // вне конуса — тёмный фон
    if (cells[i] > 0) { const d = ones[i] / cells[i]; const g = Math.round(40 + 200 * d); R = G = B = g; if (d === 0) { R = 30; G = 34; B = 48; } }
    rgb[i * 3] = R; rgb[i * 3 + 1] = G; rgb[i * 3 + 2] = B;
  }
  png(file, W, H, rgb);
  return { W, H, s };
}
// Кадр бит в бит (--bits): всё поле, столбцы lo − (N − 1) … hi + (N − 1). Внутри конуса якоря — биты поля,
// снаружи — полоса «1» там, где лёг хоть один конус, иначе пусто. PNG: палитра, 2 бита на пиксель, строки потоком в deflate.
function bitsPng(file, k) {
  const [lo, hi] = span(k), c0 = lo - (N - 1), Wd = hi - lo + 2 * (N - 1) + 1, rowB = Math.ceil(Wd / 4);
  const chunk = (t, d) => { const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(Wd, 0); ihdr.writeUInt32BE(N, 4); ihdr[8] = 2; ihdr[9] = 3;
  const plte = Buffer.from([13, 15, 22, 91, 100, 117, 232, 237, 245]);   // пусто, 0, 1 — цвета страницы
  const parts = [], line = Buffer.alloc(rowB + 1);
  let ones = 0, zeros = 0;
  for (let r = 0; r < N; r++) {
    line.fill(0);
    for (let x = 0; x < Wd; x++) {
      const c = c0 + x; let v;
      if (Math.abs(c) <= r) v = getBit(r, c) ? 2 : (covered(r, c, lo, hi) ? 1 : 0);
      else v = covered(r, c, lo, hi) ? 2 : 0;
      if (v === 2) ones++; else if (v === 1) zeros++;
      if (v) line[1 + (x >> 2)] |= v << (6 - 2 * (x & 3));
    }
    parts.push(Buffer.from(line));
  }
  const idat = zlib.deflateSync(Buffer.concat(parts), { level: 6 });
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('PLTE', plte), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]));
  return { W: Wd, H: N, c0, ones, zeros };
}
// Маска клеток конуса якоря (|c| ≤ r) в слове w строки r
function wordMask(r, w) {
  const Xl = -r + OFF, Xh = r + OFF, a = w * 32, b = a + 31;
  if (b < Xl || a > Xh) return 0;
  let m = ~0; if (a < Xl) m &= (~0 << (Xl - a)); if (b > Xh) m &= ((Xh - a) === 31 ? ~0 : ((1 << (Xh - a + 1)) - 1)); return m >>> 0;
}

// ---------- сверка с ядром страницы ----------
function check() {
  const M = require('./mayatnik-core.js');
  const S = STEPS, g = M.geometry('pend', S, N), f = M.field(g.W, N, 'empty');
  let bad = 0, cmp = 0;
  const marks = new Set([1, 2, 3, 5, 8, 13, Math.floor(S / 2), S]);
  for (let k = 0; k < S; k++) {
    M.cone(f, g.anchor + M.offset('pend', k), N); cone(k);
    if (!marks.has(k + 1)) continue;
    for (let r = 0; r < N; r++) for (let c = -r; c <= r; c++) { const v = f.val[r * g.W + g.anchor + c]; cmp++; if ((v === 1 ? 1 : 0) !== getBit(r, c)) bad++; }
  }
  console.log(`Сверка с ядром страницы: ${N} строк, ${S} вершин — сравнено ${cmp} клеток конуса якоря, расхождений ${bad}.`);
  process.exit(bad ? 1 : 0);
}

// ---------- запуск ----------
if (CHECK) check();
fs.mkdirSync(OUT, { recursive: true });
const frameAt = new Set(); for (let i = 1; i <= FRAMES; i++) frameAt.add(Math.max(1, Math.round(STEPS * i / FRAMES)));
const rows = []; let k0 = 0;
const stFile = path.join(OUT, 'state.bin'), stJson = path.join(OUT, 'state.json');
if (!FRESH && fs.existsSync(stJson) && fs.existsSync(stFile)) {
  const st = JSON.parse(fs.readFileSync(stJson, 'utf8'));
  if (st.N === N && st.total === total) { const buf = fs.readFileSync(stFile); new Uint8Array(F.buffer).set(buf); k0 = st.k; rows.push(...st.rows); console.log(`Продолжаю с вершины ${k0} (сохранено ${st.when}).`); }
}
console.log(`Маятник ${N} строк, ${STEPS} вершин; поле ${(bytes / 1e9).toFixed(2)} ГБ; выгрузка: ${OUT}`);
const t0 = Date.now(); let lastSave = Date.now(), lastLog = 0;
const save = () => { if (SAVE_MIN <= 0) return; fs.writeFileSync(stFile, Buffer.from(F.buffer)); fs.writeFileSync(stJson, JSON.stringify({ N, total, k: kDone, rows, when: new Date().toISOString() })); lastSave = Date.now(); };
let kDone = k0;
const writeNumbers = () => {
  const head = 'вершина,верх_замер,верх_закон,кончик_замер,кончик_закон,ширина_замер,ширина_закон,доля_единиц,секунд';
  fs.writeFileSync(path.join(OUT, 'cifry.csv'), head + '\n' + rows.map(x => [x.n, x.top, x.topLaw, x.tip, x.tipLaw, x.width, x.widthLaw, x.density, x.sec].join(',')).join('\n') + '\n');
  fs.writeFileSync(path.join(OUT, 'cifry.json'), JSON.stringify({ N, steps: STEPS, rows }, null, 1));
};
for (let k = k0; k < STEPS; k++) {
  cone(k); kDone = k + 1;
  const now = Date.now(), el = (now - t0) / 1000, done = (k + 1 - k0) / (STEPS - k0);
  if (now - lastLog > 10000 || k + 1 === STEPS) {
    lastLog = now; const eta = el / Math.max(done, 1e-9) - el;
    process.stdout.write(`\rвершина ${k + 1} / ${STEPS} · ${(100 * (k + 1) / STEPS).toFixed(1)} % · прошло ${(el / 60).toFixed(1)} мин · осталось ~${(eta / 60).toFixed(1)} мин   `);
    fs.writeFileSync(path.join(OUT, 'progress.json'), JSON.stringify({ N, steps: STEPS, k: k + 1, minutes: el / 60, etaMinutes: eta / 60 }));
  }
  if (frameAt.has(k + 1)) {
    const n = k + 1, h = hole() || { top: null, tip: null, width: 0 };
    let ones = 0, cells = 0; for (let r = 0; r < N; r++) for (let w = w0[r]; w <= w1[r]; w++) { const m = wordMask(r, w); if (!m) continue; ones += popc(F[idx(r, w)] & m); cells += popc(m); }
    const pic = picture(path.join(OUT, `kadr-${String(n).padStart(6, '0')}.png`), n);
    const row = { n, top: h.top, topLaw: Math.round(N / 2 + n / 2), tip: h.tip, tipLaw: N - n, width: h.width, widthLaw: Math.max(0, N - 3 * n), density: +(ones / cells).toFixed(4), sec: +el.toFixed(1), imgScale: pic.s };
    rows.push(row); writeNumbers();
    process.stdout.write(`\nкадр n=${n}: дыра верх ${h.top} (закон ${row.topLaw}), кончик ${h.tip} (закон ${row.tipLaw}), ширина ${h.width} (закон ${row.widthLaw}); единиц ${(100 * row.density).toFixed(1)} %\n`);
  }
  if (SAVE_MIN > 0 && Date.now() - lastSave > SAVE_MIN * 60000 && k + 1 < STEPS) save();
}
writeNumbers();
if (SAVE_MIN > 0) save();
if (BITS) {
  const f = path.join(OUT, `kadr-${String(kDone).padStart(6, '0')}-bity.png`), b = bitsPng(f, kDone);
  fs.writeFileSync(path.join(OUT, 'bity.json'), JSON.stringify({ N, n: kDone, W: b.W, H: b.H, stolbec0: b.c0, edinic: b.ones, nulej: b.zeros, file: path.basename(f),
    cveta: { pusto: '#0d0f16', nol: '#5b6475', edinica: '#e8edf5' }, pravilo: 'пиксель (x, y) = бит строки y, столбца x + stolbec0 от якоря' }, null, 1));
  console.log(`\nКадр бит в бит: ${f} — ${b.W} × ${b.H}, единиц ${b.ones}, нулей ${b.zeros}`);
}
console.log(`\nГотово: ${((Date.now() - t0) / 60000).toFixed(1)} мин. Картинки и цифры — в ${OUT}`);
