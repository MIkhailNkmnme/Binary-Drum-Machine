// Независимая сверка расчётов Маятника (v0.091): ядро (все режимы, фон, пара), цвет перекрытий,
// «Неизменные», «Шахматки 0» (плоско и ромбы), горизонтальная свёртка.
'use strict';
const fs = require('fs'), path = require('path');
const DIR = process.argv[2] || __dirname;   // запуск: node mayatnik/mayatnik-verify.cjs
const M = require(path.join(DIR, 'mayatnik-core.js'));
const html = fs.readFileSync(path.join(DIR, 'Zerkalius-mayatnik.html'), 'utf8');
let fails = 0; const bad = (msg) => { fails++; if (fails < 30) console.log('  ✗ ' + msg); };
const rnd = (() => { let s = 12345; return () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff; })();

// ---------- эталон ядра: 2D-массив, правило из шапки страницы, отдельно от MAYATNIK ----------
// новое = старое ⊕ L ⊕ R (пустое = 0), родитель-вершина всегда 1, пустая вершина → 1, родители — уже пересчитанные.
function refRun(mode, steps, D, bg, pair) {
  const T = mode === 'one' ? 1 : pair ? steps >> 1 : steps;
  const offs = []; if (pair) { offs.push([0]); for (let m = 1; m <= T; m++) offs.push([-m, m]); }
  else for (let k = 0; k < T; k++) offs.push([mode === 'pend' ? (k === 0 ? 0 : (k % 2 ? -((k + 1) >> 1) : k >> 1)) : mode === 'right' ? k : mode === 'left' ? -k : 0]);
  let lo = 0, hi = 0; for (const g of offs) for (const o of g) { lo = Math.min(lo, o); hi = Math.max(hi, o); }
  const pad = D - 1, W = hi - lo + 2 * pad + 1, A = pad - lo;
  const g = []; for (let r = 0; r < D; r++) g.push(new Array(W).fill(bg === '1' ? 1 : bg === '0' ? 0 : -1));
  const writes = []; for (let r = 0; r < D; r++) writes.push(new Array(W).fill(0));
  const frames = [g.map(row => row.slice())], wframes = [writes.map(r => r.slice())];
  for (const grp of offs) {
    const apexes = grp.map(o => A + o);
    for (const a of apexes) if (g[0][a] === -1) g[0][a] = 1;
    const isApex = c => apexes.includes(c);
    const get = (r, c) => (c < 0 || c >= W) ? 0 : (r === 0 && isApex(c)) ? 1 : (g[r][c] === 1 ? 1 : 0);
    for (let r = 1; r < D; r++) {
      const cells = new Set();
      for (const a of apexes) for (let c = a - r; c <= a + r; c += 2) if (c >= 0 && c < W) cells.add(c);
      for (const c of cells) { g[r][c] = (g[r][c] === 1 ? 1 : 0) ^ get(r - 1, c - 1) ^ get(r - 1, c + 1); writes[r][c]++; }
    }
    frames.push(g.map(row => row.slice())); wframes.push(writes.map(r => r.slice()));
  }
  if (pair) { frames.shift(); wframes.shift(); }   // у пары кадр 0 — уже с якорем
  return { W, A, T, frames, wframes };
}
function coreRun(mode, steps, D, bg, pair) {
  const T = mode === 'one' ? 1 : pair ? steps >> 1 : steps, S = mode === 'one' ? 1 : pair ? 2 * T + 1 : steps;
  const geo = M.geometry(mode, S, D), f = M.field(geo.W, D, bg), frames = [];
  if (pair) M.cone(f, geo.anchor, D);
  frames.push(f.val.slice());
  for (let k = 0; k < T; k++) {
    if (pair) M.conePair(f, geo.anchor - k - 1, geo.anchor + k + 1, D);
    else M.cone(f, geo.anchor + M.offset(mode, k), D);
    frames.push(f.val.slice());
  }
  return { geo, f, frames, T };
}

// ---------- «Неизменные» — функции прямо из страницы ----------
const grab = name => { const i = html.indexOf('function ' + name + '('); let d = 0, j = html.indexOf('{', i);
  for (; j < html.length; j++) { if (html[j] === '{') d++; else if (html[j] === '}' && --d === 0) break; } return html.slice(i, j + 1); };
const frozenFactory = new Function('MAYATNIK', 'env', `const st = env.st; const pairOn = env.pairOn; const total = env.total; let k = 0;
  ${grab('frozenRanges')} ${grab('frozenAt')} return { setK: v => { k = v; }, frozenRanges, frozenAt };`);

console.log('1. Ядро и цвет перекрытий против эталона');
let cases = 0, cells = 0;
for (const mode of ['pend', 'right', 'left', 'one']) for (const bg of ['empty', '0', '1']) for (const pair of mode === 'pend' ? [false, true] : [false])
  for (const [D, steps] of [[8, 5], [17, 12], [33, 40], [64, 64], [40, 160]]) {
    cases++;
    const ref = refRun(mode, steps, D, bg, pair), core = coreRun(mode, steps, D, bg, pair);
    if (ref.W !== core.geo.W || ref.A !== core.geo.anchor) { bad(`геометрия ${mode}/${bg}/${pair} D=${D}`); continue; }
    for (let k = 0; k <= ref.T; k++) {
      const a = ref.frames[k], b = core.frames[k];
      for (let r = 0; r < D; r++) for (let c = 0; c < ref.W; c++) { cells++; if (a[r][c] !== b[r * ref.W + c]) { bad(`бит ${mode}/${bg}/пара=${pair} D=${D} кадр ${k} (${r},${c}): эталон ${a[r][c]}, ядро ${b[r * ref.W + c]}`); r = D; break; } }
      // цвет: чётность записей (tint/tintPair) против счёта записей эталона
      const w = ref.wframes[k], filled = bg !== 'empty', sp = k ? M.span(mode, k) : [1, 0];   // как coneSpan страницы v0.091
      for (let r = 1; r < D; r++) for (let c = 0; c < ref.W; c++) {
        const v = a[r][c]; if (v < 0) continue;
        const t = pair ? M.tintPair(r, c - ref.A, v, k, filled) : M.tint(r, c - ref.A, v, sp[0], sp[1], filled);
        let n = w[r][c]; if (filled) n++;
        const exp = n % 2 ? 0 : (v ? 1 : 2);
        if (t !== exp) { bad(`цвет ${mode}/${bg}/пара=${pair} D=${D} кадр ${k} (${r},${c - ref.A}): ${t} ≠ ${exp}`); r = D; break; }
      }
    }
    // «Неизменные»: помеченный бит не меняется ни на одном следующем кадре
    const st = { mode, pair }, env = { st, pairOn: () => !!st.pair && st.mode === 'pend', total: () => mode === 'one' ? 1 : pair ? steps >> 1 : steps };
    const fz = frozenFactory(M, env);
    for (let k = 0; k <= ref.T; k++) {
      fz.setK(k); const R = fz.frozenRanges();
      for (let r = 0; r < D; r++) for (let c = 0; c < ref.W; c++) {
        const v = ref.frames[k][r][c]; if (v < 0 || !fz.frozenAt(R, r, c - ref.A)) continue;
        for (let t = k + 1; t <= ref.T; t++) if (ref.frames[t][r][c] !== v) { bad(`«Неизменные» ${mode}/${bg}/пара=${pair} D=${D}: кадр ${k} (${r},${c - ref.A}) помечен, а на кадре ${t} стал ${ref.frames[t][r][c]}`); t = ref.T + 1; r = D; c = ref.W; }
      }
      if (k === ref.T) for (let r = 0; r < D; r++) for (let c = 0; c < ref.W; c++) if (ref.frames[k][r][c] >= 0 && !fz.frozenAt(R, r, c - ref.A)) { bad(`последний кадр не весь неизменный ${mode}`); r = D; break; }
    }
  }
console.log(`   режимов×размеров: ${cases}, сравнено клеток по кадрам: ${cells.toLocaleString('ru-RU')}`);
// цвет при паре: эталон считает запись якоря отдельно — проверим на кадре 0 только якорь

// ---------- «Шахматки 0»: функция страницы против эталона union-find ----------
console.log('2. «Шахматки 0»: области страницы против эталона');
const chessFactory = new Function('env', `let {f, geo, st, VX, VW, VH, RK, RG, img, paintBits} = env; const ZL = new Int32Array(0), ZR = ZL;
  const rombP = () => env.rp, triangleFill = () => false; let chessScratch = null; const CHESS_PAD = 2;
  ${grab('chessZeroRegions')} return chessZeroRegions;`);
function refChess(val, W, H, VX, VW, anchor, p) {   // p<0 плоско, иначе решётка p
  const cell = (r, c) => { if (r < 0 || r >= H || c < 0 || c >= VW) return -1; if (p >= 0 && ((c + VX - anchor - p - r) % 2 + 2) % 2) return -1; return val[r * W + c + VX]; };
  const corner = p < 0 ? [[-1, -1], [-1, 1], [1, -1], [1, 1]] : [[0, -2], [0, 2], [-2, 0], [2, 0]];
  const side = p < 0 ? [[-1, 0], [1, 0], [0, -1], [0, 1]] : [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  const chess = (r, c) => cell(r, c) === 0 && corner.some(([dr, dc]) => cell(r + dr, c + dc) === 0);
  const par = new Int32Array(H * VW).map((_, i) => i), find = x => { while (par[x] !== x) x = par[x] = par[par[x]]; return x; };
  const uni = (a, b) => { a = find(a); b = find(b); if (a !== b) par[a] = b; };
  // v0.085: нули — цепочки через вершины; соседняя по стороне цепочка — если обе клетки касания шахматки
  for (let r = 0; r < H; r++) for (let c = 0; c < VW; c++) if (chess(r, c)) {
    for (const [dr, dc] of corner) if (cell(r + dr, c + dc) === 0) uni(r * VW + c, (r + dr) * VW + c + dc);
    for (const [dr, dc] of side) if (chess(r + dr, c + dc)) uni(r * VW + c, (r + dr) * VW + c + dc);
  }
  const lab = new Int32Array(H * VW); const map = new Map(); let largest = 0; const size = new Map();
  for (let r = 0; r < H; r++) for (let c = 0; c < VW; c++) if (chess(r, c)) { const root = find(r * VW + c); if (!map.has(root)) map.set(root, map.size + 1); const id = map.get(root); lab[r * VW + c] = id; size.set(id, (size.get(id) || 0) + 1); }
  for (const s of size.values()) largest = Math.max(largest, s);
  return { lab, count: map.size, largest };
}
let chessCases = 0;
for (const bg of ['empty', '0', '1']) for (const pair of [false, true]) for (const [D, steps] of [[24, 30], [64, 64], [96, 200], [128, 43]]) for (const view of ['col', 'romb0', 'romb1', 'romb2']) {
  const core = coreRun('pend', steps, D, bg, pair), { geo } = core;
  for (const kk of [Math.floor(core.T / 3), core.T]) {
    const val = core.frames[kk], f = { W: geo.W, val }, VX = 3, VW = geo.W - 6, VH = D, rp = view === 'col' ? -1 : view === 'romb0' ? 0 : view === 'romb1' ? 1 : 2;
    const fn = chessFactory({ f, geo, st: { noband: 0 }, VX, VW, VH, RK: 1, RG: 4, img: { width: VW }, paintBits: null, rp });
    const got = fn(null), P = 2, PW = got.PW; chessCases++;
    let count = 0, largest = 0;
    got.halves.forEach(h => {
      const ref = refChess(val, geo.W, D, VX, VW, geo.anchor, h.p);
      count += ref.count; largest = Math.max(largest, ref.largest);
      // разбиение то же: метки биективно соответствуют
      const a2b = new Map(), b2a = new Map();
      for (let r = 0; r < VH; r++) for (let c = 0; c < VW; c++) {
        const a = ref.lab[r * VW + c], b = h.id[(r + P) * PW + P + c];
        if (!!a !== !!b) { bad(`шахматки ${view}/${bg}/пара=${pair} D=${D} кадр ${kk}: клетка (${r},${c}) эталон ${a ? 'в области' : 'вне'}, страница ${b ? 'в области' : 'вне'}`); r = VH; break; }
        if (!a) continue;
        if ((a2b.has(a) && a2b.get(a) !== b) || (b2a.has(b) && b2a.get(b) !== a)) { bad(`шахматки ${view}/${bg}/пара=${pair} D=${D} кадр ${kk}: разные разбиения у (${r},${c})`); r = VH; break; }
        a2b.set(a, b); b2a.set(b, a);
      }
    });
    if (count !== got.count || largest !== got.largest) bad(`шахматки ${view}/${bg}/пара=${pair} D=${D} кадр ${kk}: областей ${got.count}/${count}, крупнейшая ${got.largest}/${largest}`);
  }
}
console.log(`   полей×видов×кадров: ${chessCases}`);

// ---------- Свёртка ----------
console.log('3. Горизонтальная свёртка против эталона');
global.window = {}; require(path.join(DIR, 'mayatnik-fold.js')); const Fold = window.MayatnikFold;
let foldCases = 0;
for (let t = 0; t < 40; t++) {
  const width = 3 + Math.floor(rnd() * 30), height = 1 + Math.floor(rnd() * 6), center = Math.floor(rnd() * width);
  const data = Int8Array.from({ length: width * height }, () => { const x = rnd(); return x < .15 ? -1 : x < .55 ? 0 : 1; });
  const m = Fold.model({ width, height, center, data }); foldCases++;
  if (m.max !== width - 1) bad(`свёртка: шагов ${m.max}, должно ${width - 1}`);
  // эталон кадра n: по очереди справа/слева (кончилась сторона — другая), сложенные столбцы XOR-ятся в центр
  const expect = n => { let l = 0, r = 0, side = 1; const folded = [center];
    for (let i = 0; i < n; i++) { if ((side === 1 && r < width - center - 1) || l === center) { r++; folded.push(center + r); } else { l++; folded.push(center - l); } side = -side; }
    const out = []; for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      if (x === center) { const vs = folded.map(c => data[y * width + c]).filter(v => v >= 0); out.push(vs.length ? vs.reduce((a, b) => a ^ b, 0) : -1); }
      else { const sx = x < center ? x - l : x + r; out.push(sx < 0 || sx >= width ? -1 : data[y * width + sx]); } }
    return out; };
  const order = [...Array(m.max + 1).keys()].sort(() => rnd() - .5).concat([0, m.max, 0]);
  for (const n of order) { m.seek(n); const e = expect(n);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (m.bit(x, y) !== e[y * width + x]) { bad(`свёртка w=${width} c=${center} кадр ${n} (${x},${y}): ${m.bit(x, y)} ≠ ${e[y * width + x]}`); y = height; break; } }
  m.seek(m.max); for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (x !== center && m.bit(x, y) !== -1) { bad(`свёртка: в конце остался столбец ${x}`); y = height; break; }
}
console.log(`   случайных полей: ${foldCases}`);
console.log(fails ? `ИТОГ: расхождений ${fails}` : 'ИТОГ: расхождений нет');
process.exit(fails ? 1 : 0);
