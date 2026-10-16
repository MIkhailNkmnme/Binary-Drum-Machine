/* XOR-маятник: общее ядро страницы и зеркал. v2: + пара вершин одним проходом (conePair, tintPair).
   v3: необязательные lastAt, stamp у cone / conePair — в lastAt[i] пишется stamp, когда значение клетки i изменилось (карта застывания);
   без них расчёт прежний, бит в бит. */
const MAYATNIK = (() => {
  // val: Int8Array W*H, -1 пусто, 0, 1. v0.006: цвет не хранится — он считается по формуле (tint ниже)
  // v4: bg 'chess' — «1 шахматкой»: 1 на решётке якоря (c − anchor − r чётное), 0 на соседней.
  function field(W, H, bg, anchor = 0) {
    const val = new Int8Array(W * H).fill(bg === '1' ? 1 : bg === '0' ? 0 : -1);
    if (bg === 'chess') for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) val[r * W + c] = (c - anchor - r) & 1 ? 0 : 1;
    return { W, H, val };
  }
  // CoreBuilder(startCell, buildDown=True, buildUp=False) — вершина в строке 0, глубина D строк
  function cone(f, a, D, lastAt, stamp) {
    const { W, H, val } = f;
    if (a < 0 || a >= W) return;
    if (val[a] === -1) { val[a] = 1; if (lastAt) lastAt[a] = stamp; }
    const apex = val[a]; val[a] = 1;             // родитель-вершина всегда 1 (в Excel: parentCell = startCell)
    const last = Math.min(D, H);
    for (let r = 1; r < last; r++) {             // r = step − 1; клетки конуса a−r … a+r через одну
      const row = r * W, up = row - W, end = a + r;
      let c = a - r;
      if (c < 0) c += ((-c + 1) >> 1) << 1;
      for (; c <= end && c < W; c += 2) {
        const L = c > 0 ? val[up + c - 1] : 0, R = c + 1 < W ? val[up + c + 1] : 0;
        const i = row + c, old = val[i];
        const nv = ((old === 1) ^ (L === 1) ^ (R === 1)) ? 1 : 0;
        if (lastAt && nv !== old) lastAt[i] = stamp;
        val[i] = nv;
      }
      if (r === 1) val[a] = apex;
    }
  }
  // v2 (2026-10-13, Маятник v0.012): пара вершин a1, a2 (одной чётности) ОДНИМ проходом — «шаг влево и вправо сразу».
  // Строка за строкой пересчитываются клетки обоих конусов; клетка, попавшая в оба, — один раз: старое ⊕ левый ⊕ правый.
  // По очереди (cone, затем cone) выходит другое: левый конус пишет середину, пока правой вершины ещё нет.
  function conePair(f, a1, a2, D, lastAt, stamp) {
    const { W, H, val } = f;
    if (a1 > a2) { const t = a1; a1 = a2; a2 = t; }
    const ap = [];
    for (const a of [a1, a2]) { if (a < 0 || a >= W) continue; if (val[a] === -1) { val[a] = 1; if (lastAt) lastAt[a] = stamp; } ap.push([a, val[a]]); val[a] = 1; }
    const pass = (row, up, from, to) => {
      let c = from;
      if (c < 0) c += ((-c + 1) >> 1) << 1;
      for (; c <= to && c < W; c += 2) {
        const L = c > 0 ? val[up + c - 1] : 0, R = c + 1 < W ? val[up + c + 1] : 0, i = row + c, old = val[i];
        val[i] = ((old === 1) ^ (L === 1) ^ (R === 1)) ? 1 : 0;
        if (lastAt && val[i] !== old) lastAt[i] = stamp;
      }
    };
    const last = Math.min(D, H);
    for (let r = 1; r < last; r++) {
      const row = r * W, up = row - W;
      if (a2 - r <= a1 + r + 2) pass(row, up, a1 - r, a2 + r);   // конусы сошлись — один отрезок через одну
      else { pass(row, up, a1 - r, a1 + r); pass(row, up, a2 - r, a2 + r); }
      if (r === 1) for (const [a, v] of ap) val[a] = v;
    }
  }
  // Цвет при «паре сразу»: k пар после якоря. Записей в клетку = конус якоря + пары m ≤ k, чей конус −m или +m её
  // накрывает (накрыта обоими — всё равно одна запись). m той же чётности, что c + r; −m накрывает при m ∈ [−c−r, −c+r],
  // +m — при m ∈ [c−r, c+r], оба — при m ∈ [|c|−r, r−|c|]. Ответ как у tint: 0 — чёрный, 1 — синий, 2 — красный.
  function tintPair(r, c, v, k, filled) {
    if (r === 0) return 0;
    const p = ((c + r) % 2 + 2) % 2, ac = c < 0 ? -c : c;
    const cnt = (lo, hi) => { if (lo < 1) lo = 1; if (hi > k) hi = k; if (lo > hi) return 0;
      const first = lo + ((p - lo) % 2 + 2) % 2; return first > hi ? 0 : ((hi - first) >> 1) + 1; };
    let n = ac <= r && p === 0 ? 1 : 0;                  // конус якоря
    n += cnt(-c - r, -c + r) + cnt(c - r, c + r) - (ac <= r ? cnt(ac - r, r - ac) : 0);
    if (filled) n++;
    return n % 2 ? 0 : (v ? 1 : 2);
  }
  // Сдвиг k-й вершины от якоря
  function offset(mode, k) {
    if (mode === 'pend') return k === 0 ? 0 : (k % 2 ? -((k + 1) >> 1) : (k >> 1));
    if (mode === 'right') return k;
    if (mode === 'left') return -k;
    return 0;
  }
  // Ширина поля, чтобы все конусы влезли целиком, и столбец якоря
  function geometry(mode, S, D) {
    let lo = 0, hi = 0;
    for (let k = 0; k < S; k++) { const o = offset(mode, k); if (o < lo) lo = o; if (o > hi) hi = o; }
    const pad = D - 1;
    return { W: hi - lo + 2 * pad + 1, anchor: pad - lo };
  }
  // v0.006: цвет «мерцания» из Excel — это чётность числа конусов над клеткой: первая запись чёрная, каждая следующая
  // переключает «чёрный ↔ цветной», а цветной показывает бит на момент записи (он с тех пор не менялся).
  // Вершины всех ходов идут подряд, поэтому конусы над клеткой (r, c) — вершины a из [lo, hi] (относительно якоря)
  // с |c − a| ≤ r и той же чётностью, что c + r: их число считается сразу, без хранения.
  // Возвращает 0 — чёрный, 1 — синий (стал 1), 2 — красный (стал 0); v — бит клетки, filled — фон «все 1 / все 0».
  function tint(r, c, v, lo, hi, filled) {
    if (r === 0) return 0;                                 // строку вершин конусы не переписывают
    const a0 = Math.max(lo, c - r), a1 = Math.min(hi, c + r);
    let n = 0;
    if (a0 <= a1) { const first = a0 + (((c + r - a0) % 2) + 2) % 2; if (first <= a1) n = ((a1 - first) >> 1) + 1; }
    if (filled) n++;                                       // на заполненном фоне первая же запись — «перекрытие»
    return n % 2 ? 0 : (v ? 1 : 2);
  }
  // Крайние вершины после k конусов
  function span(mode, k) {
    let lo = 0, hi = 0;
    for (let j = 0; j < k; j++) { const o = offset(mode, j); if (o < lo) lo = o; if (o > hi) hi = o; }
    return [lo, hi];
  }
  return { field, cone, conePair, offset, geometry, tint, tintPair, span };
})();
if (typeof module !== 'undefined') module.exports = MAYATNIK;
