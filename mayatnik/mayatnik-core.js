/* XOR-маятник: общее ядро страницы и зеркал. v1; сверено с Excel. */
const MAYATNIK = (() => {
  // val: Int8Array W*H, -1 пусто, 0, 1. v0.006: цвет не хранится — он считается по формуле (tint ниже)
  function field(W, H, bg) {
    const val = new Int8Array(W * H).fill(bg === '1' ? 1 : bg === '0' ? 0 : -1);
    return { W, H, val };
  }
  // CoreBuilder(startCell, buildDown=True, buildUp=False) — вершина в строке 0, глубина D строк
  function cone(f, a, D) {
    const { W, H, val } = f;
    if (a < 0 || a >= W) return;
    if (val[a] === -1) val[a] = 1;
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
        val[i] = nv;
      }
      if (r === 1) val[a] = apex;
    }
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
  return { field, cone, offset, geometry, tint, span };
})();
if (typeof module !== 'undefined') module.exports = MAYATNIK;
