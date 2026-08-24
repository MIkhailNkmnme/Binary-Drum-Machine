/* Zerkalius Fold — часть 4/5: ИНСТРУМЕНТЫ.
   Выбор отдельных ячеек, оси по битам, поворот выделения, заливка квадратом,
   верхнее зеркало и зеркала по бокам, свёртка-конверт, цепочка паттернов,
   тетрис, режим чётности, последовательности interleave/XOR.
   Подключается ПОСЛЕ fold-3-ops.js. Порядок файлов менять нельзя. */

/* === ВЫБОР ОТДЕЛЬНЫХ ЯЧЕЕК (БИТОВ) КУРСОРОМ ===
   cellSel — набор ключей "строка|столбец" (столбец — НОМЕР КОЛОНКИ ПОЛОТНА, тот же, что в
   data-col у бита: сдвиг строки уже учтён, поэтому прямоугольник получается визуальным, а не
   "по индексам внутри строк"). cellSelMode — включён ли режим: пока он выключен, .bits не ловит
   мышь вовсе (клик проваливается к строке, как раньше), и ничего не меняется.
   var — на них смотрит render(), который может вызваться раньше этой строки. */
var cellSel = new Set();
var cellSelMode = false;
var cellDragAnchor = null; // {r, col} — с какой ячейки начали протяжку прямоугольника

/* Ключ ячейки и разбор обратно. */
function cellKey(r, col){ return r + "|" + col; }
/* Индекс бита в строке r по номеру колонки полотна (или -1, если строка туда не достаёт). */
function cellBitIdx(r, col, maxLen){
  const s = st.rows[r] || "";
  if (!s.length) return -1;
  const j = col - rowShiftFor(maxLen, r, s, st.align);
  return (j >= 0 && j < s.length) ? j : -1;
}
function cellSelMaxLen(){
  let m = 0;
  for (const s of st.rows) if (s && s.length > m) m = s.length;
  return m;
}
/* Прямоугольник от якоря протяжки до текущей ячейки — все настоящие биты внутри рамки.
   ПРЕЖНЕЕ ВЫДЕЛЕНИЕ НЕ СТИРАЕТСЯ (запрос пользователя: "нажатие на другие биты — добавлять/
   отключать биты, а не перемещать выделение"): рамка накладывается ПОВЕРХ снимка набора на
   момент начала протяжки (base). del=true — та же рамка не добавляет, а снимает биты (протяжка,
   начатая с уже выбранного бита). Полностью очистить набор можно только кнопкой "✕ Очистить биты". */
function cellSelectRect(r0, c0, r1, c1, base, del){
  const maxLen = cellSelMaxLen();
  const rLo = Math.min(r0, r1), rHi = Math.max(r0, r1);
  const cLo = Math.min(c0, c1), cHi = Math.max(c0, c1);
  cellSel = new Set(base || cellSel);
  for (let r = rLo; r <= rHi; r++) {
    for (let c = cLo; c <= cHi; c++) {
      if (cellBitIdx(r, c, maxLen) < 0) continue;
      const key = cellKey(r, c);
      if (del) cellSel.delete(key); else cellSel.add(key);
    }
  }
}
/* Ячейки выделения, разложенные по строкам: Map(строка → отсортированный список колонок). */
function cellSelByRow(){
  const byRow = new Map();
  for (const key of cellSel) {
    const [rs, cs] = key.split("|");
    const r = +rs, c = +cs;
    if (!byRow.has(r)) byRow.set(r, []);
    byRow.get(r).push(c);
  }
  byRow.forEach(list => list.sort((a, b) => a - b));
  return byRow;
}
/* ОБРАЗЕЦ ИЗ ВЫБРАННЫХ ЯЧЕЕК (v0.912, запрос пользователя "кнопку в поиск — Показать выделенное,
   как в фон-поиске, чтобы сразу в цепочках показал совпадения"). Биты выбранных ячеек, собранные
   в одну строку: строки идут сверху вниз, внутри строки — столбцы слева направо. Ячейки, попавшие
   за пределы своей строки (cellBitIdx < 0), пропускаются: настоящего бита там нет. */
function cellSelSampleText(){
  const byRow = cellSelByRow();
  const maxLen = cellSelMaxLen();
  let out = "";
  for (const r of Array.from(byRow.keys()).sort((a, b) => a - b)) {
    const s = st.rows[r] || "";
    for (const c of byRow.get(r)) {
      const j = cellBitIdx(r, c, maxLen);
      if (j >= 0) out += s[j];
    }
  }
  /* Биты, выбранные В ПАТТЕРНЕ (v0.950), идут в тот же образец — в порядке слева направо. Они
     всегда из ОДНОЙ строки (см. patCellSel), так что порядок однозначен и склейка с битами из
     строк не перемешивается. Так выбранный кусок паттерна ищется и подсвечивается везде — и в
     строках, и в самой колонке паттернов (см. cellSamplePats в render). */
  const pr = patCellSelRow();
  if (pr >= 0) {
    const t = (st.pats[pr] && st.pats[pr].text) || "";
    const idxs = [];
    for (const key of patCellSel) {
      const p = key.split("|");
      if (+p[0] === pr) idxs.push(+p[1]);
    }
    idxs.sort((a, b) => a - b);
    for (const k of idxs) if (k >= 0 && k < t.length) out += t[k];
  }
  return out;
}
function cellSelUpdateBtns(){
  const b = document.getElementById("bCellMode");
  if (b) b.classList.toggle("mode-act", cellSelMode);
  document.body.classList.toggle("cell-mode", cellSelMode);
}
const bCellModeEl = document.getElementById("bCellMode");
if (bCellModeEl) {
  bCellModeEl.onclick = () => {
    cellSelMode = !cellSelMode;
    // Набор ячеек при выключении НЕ стирается, только прячется (подсветка и клики по битам живут
    // лишь в режиме) — запрос пользователя: "при отключении не удалять, а скрывать; при включении
    // снова показать построенные выделения". Стирает набор только кнопка "✕ Очистить биты".
    // "⊙ Оси по битам" НЕ гасим: режим выбора ячеек — это лишь способ ДОБАВЛЯТЬ/СНИМАТЬ ячейки
    // мышью, а уже построенные по ним оси (и подсветка самих ячеек) к нему не относятся — они
    // живут, пока включены оси по битам (запрос пользователя).
    cellSelUpdateBtns();
    say(cellSelMode
      ? "Выбор ячеек: клик — одна, протяжка — прямоугольник, Ctrl+клик — по одной."
      : "Выбор ячеек выключен.");
    render();
  };
}
const bCellClearEl = document.getElementById("bCellClear");
if (bCellClearEl) bCellClearEl.onclick = () => {
  cellSel.clear();
  patCellSel.clear();   // и биты, выбранные в колонке паттернов (v0.950)
  say("Выделения битов очищены — и в строках, и в паттернах.");
  render();
};

/* === "⊙ ОСИ ПО БИТАМ" (bitAxisMode) ===
   Оси Круга задаются не столбцами, а ВЫБРАННЫМИ ЯЧЕЙКАМИ: каждая строка, где есть выбранные
   биты, превращается в СВОЮ группу осей (см. addAxisGroup — группа с row=r действует от строки r
   вниз до следующей такой же строки, ровно как у "⊙ Оси по «1» строки"). Столбцовые оси и оси по
   битам взаимоисключимы (запрос пользователя): включение этого режима стирает все прежние группы,
   а назначение столбца-оси ("⊙ Ось сюда"/"⊙ Оси по «1»") выключает режим и убирает битовые оси.
   Группы пересобираются, когда меняется сам набор ячеек или выравнивание (см. bitAxisSig): между
   пересборками группы живут обычной жизнью — их можно снимать по одной кнопкой "✕ Снять выбор". */
var bitAxisMode = false;
var bitAxisSig = "";
function bitAxisSignature(){
  return st.align + "|" + Array.from(cellSel).sort().join(",");
}
function syncBitAxesFromCells(){
  const byRow = cellSelByRow();
  const maxLen = cellSelMaxLen();
  const groups = [];
  for (const r of Array.from(byRow.keys()).sort((a, b) => a - b)) {
    const sRow = st.rows[r] || "";
    if (!sRow.length) continue;
    const sh = rowShiftFor(maxLen, r, sRow, st.align);
    // p2 — позиции осей в ПОЛУстолбцах на самой строке-якоре: нужны диагональному режиму
    // ("⤡ Диагональные столбцы на «½»"), у вертикальных осей это просто 2×столбец. Считается
    // ровно так же, как в "⊙ Оси по «1» строки" (axisColShift2x + 2×локальный индекс).
    const h2 = axisColShift2x(r, sRow, st.align, maxLen);
    const cols = [], p2 = [];
    for (const c of byRow.get(r)) {
      const k = c - sh;
      if (k < 0 || k >= sRow.length) continue; // ячейка вне самой строки — осью быть не может
      cols.push(c); p2.push(h2 + 2 * k);
    }
    if (cols.length) groups.push({ cols, p2, row: r, anch: r });
  }
  st.axisSnapGroups = groups;
  syncAxisSnapCols();
}
/* Пересборка по требованию — зовётся из render(): набор ячеек меняется в нескольких местах
   (клик, протяжка, "✕ Снять"), а render() после каждого из них всё равно вызывается. */
function bitAxesRefresh(){
  if (!bitAxisMode) return;
  const sig = bitAxisSignature();
  if (sig === bitAxisSig) return;
  bitAxisSig = sig;
  syncBitAxesFromCells();
}
function setBitAxisMode(on, quiet){
  bitAxisMode = !!on;
  const b = document.getElementById("bCellAxis");
  if (b) b.classList.toggle("mode-act", bitAxisMode);
  if (bitAxisMode) {
    // Режим осмыслен только вместе с выбором ячеек — включаем его заодно.
    if (!cellSelMode) { cellSelMode = true; cellSelUpdateBtns(); }
    if (typeof colPickMode !== "undefined" && colPickMode) setColPickMode(false);
    st.selectedCol = -1;
    bitAxisSig = bitAxisSignature();
    syncBitAxesFromCells();
    if (!quiet) say(cellSel.size
      ? "Оси по битам: выбранные ячейки стали осями — каждая строка с ячейками держит их до следующей такой строки."
      : "Оси по битам включены: выбирайте ячейки — они сразу станут осями (строка и вниз до следующей строки с ячейками).");
  } else {
    // Выключение снимает ИМЕННО битовые оси (других в этом режиме и не было).
    st.axisSnapGroups = [];
    syncAxisSnapCols();
    bitAxisSig = "";
    if (!quiet) say("Оси по битам выключены — оси сняты.");
  }
  render(); saveCache();
}
const bCellAxisEl = document.getElementById("bCellAxis");
if (bCellAxisEl) bCellAxisEl.onclick = () => setBitAxisMode(!bitAxisMode);

/* "🔢 Выделить столбцы" (colPickMode) — выбор столбца КЛИКОМ ПО САМОМУ БИТУ в цепочке.
   Линейка столбцов теперь чистая (без палочек и крестиков), поэтому столбец берут прямо из
   строк: у битов и так проставлен data-col (см. render), остаётся только ловить по ним клик —
   ровно тем же приёмом, что и режим выбора ячеек (body.col-pick в CSS открывает .bits для
   мыши). Диапазон строк, в котором столбец подсвечивается, прежний — colSelectRowRange():
   выделена одна строка — от начала до неё, выделено несколько — только между крайними.
   ДАННЫЕ НЕ ТРОГАЮТСЯ: это выделение, а не "⇅ Сдвиг к «1»" — строки никуда не едут. */
var colPickMode = false;
function setColPickMode(on){
  colPickMode = !!on;
  const b = document.getElementById("bColPickMode");
  if (b) b.classList.toggle("mode-act", colPickMode);
  document.body.classList.toggle("col-pick", colPickMode);
  say(colPickMode
    ? "Выделение столбцов: клик по любому символу цепочки выбирает его столбец."
    : "Выделение столбцов кликом выключено.");
  render();
}
const bColPickModeEl = document.getElementById("bColPickMode");
if (bColPickModeEl) bColPickModeEl.onclick = () => setColPickMode(!colPickMode);
/* "✕ Снять выбор" — снимает ПО ОДНОЙ ГРУППЕ ОСЕЙ за нажатие (запрос пользователя): группа —
   это то, что назначено одним действием (все единицы строки кнопкой "⊙ Оси по «1» строки" или
   один столбец ручным кликом), и у каждой свой цвет. Снимается ПОСЛЕДНЯЯ группа, а если
   выделенный жёлтым столбец входит в какую-то группу — именно она.
   Групп не осталось — кнопка снимает обычное жёлтое выделение столбца.
   Заодно выключает режим "🔢 Выбор столбца" (запрос пользователя: "Снять выбор столбца пусть и
   отключает сразу кнопку Выбор столбца") — тихо, без своего say(), чтобы не перебивать сообщение
   про снятую группу/столбец. */
function clearAxisGroupOnce(){
  if (colPickMode) {
    colPickMode = false;
    document.body.classList.remove("col-pick");
    const bMode = document.getElementById("bColPickMode");
    if (bMode) bMode.classList.remove("mode-act");
  }
  const groups = axisGroups();
  if (!groups.length) {
    if (st.selectedCol >= 0) { st.selectedCol = -1; say("Выделение столбца снято."); render(); saveCache(); }
    else say("Ни осей, ни выделенного столбца — снимать нечего.");
    return;
  }
  let gi = -1;
  if (st.selectedCol >= 0) gi = groups.findIndex(g => g.cols.includes(st.selectedCol));
  if (gi < 0) gi = groups.length - 1;
  const g = groups[gi];
  const gone = g.cols.slice().sort((a, b) => a - b).map(c => c + 1).join(", ");
  const zone = (g.row == null) ? "" : ` (зона со строки ${rowLabel(g.row)} и ниже)`;
  groups.splice(gi, 1);
  syncAxisSnapCols();
  say(groups.length
    ? `Группа осей снята${zone}: столбцы ${gone}. Осталось групп: ${groups.length}.`
    : `Группа осей снята${zone}: столбцы ${gone} — осей больше нет, круговые сдвиги ◄/► снова обычные.`);
  render(); saveCache();
}
const bColSelClearEl = document.getElementById("bColSelClear");
if (bColSelClearEl) bColSelClearEl.onclick = clearAxisGroupOnce;
// Та же кнопка, но плавающая над полем цепочек — видна, пока включён "🔢 Выбор столбца"
// (см. #colPickFloat в CSS и body.col-pick в setColPickMode).
const bColSelClearFloatEl = document.getElementById("bColSelClearFloat");
if (bColSelClearFloatEl) bColSelClearFloatEl.onclick = clearAxisGroupOnce;
/* Сам клик по биту. Ставим на #rows в фазе перехвата (как у выбора ячеек), чтобы он не успел
   переставить выделение СТРОК. Режим ячеек приоритетнее — если включён он, тут не мешаем. */
{
  const rowsElPick = document.getElementById("rows");
  if (rowsElPick) {
    rowsElPick.addEventListener("mousedown", (e) => {
      if (!selectionAllowed()) return; // "🔒 Выделение" выключено
      if (!colPickMode || cellSelMode || e.button !== 0) return;
      const el = e.target.closest && e.target.closest("[data-col]");
      if (!el) return;
      const col = +el.dataset.col;
      if (isNaN(col)) return;
      e.preventDefault();
      e.stopPropagation();
      st.selectedCol = (col === st.selectedCol) ? -1 : col;
      render(); saveCache();
    }, true);
  }
}

/* Мышь по битам — только в режиме выбора ячеек (иначе .bits вообще не ловит события, см. CSS). */
{
  const rowsEl = document.getElementById("rows");
  if (rowsEl) {
    /* ПОПАДАНИЕ В ЯЧЕЙКУ — СНАЧАЛА СТРОКА ПО ВЕРТИКАЛИ, ПОТОМ БИТ (v0.949, баг-репорт пользователя
       "тыкаю на один символ, а выделяется с другой строки"). Причина промаха: межстрочное в
       цепочке плотное (line-height заметно меньше кегля), поэтому ИНЛАЙНОВЫЕ боксы бит соседних
       строк налезают друг на друга по вертикали. e.target при этом отдаёт не тот span, который
       видно под курсором, а тот, что оказался выше в порядке отрисовки, — то есть соседнюю
       строку. Сами .ln блочные, их прямоугольники не пересекаются никогда, поэтому строку
       определяем ПО Y среди .ln, а нужный бит выбираем из elementsFromPoint — там под точкой
       лежат оба претендента, и мы честно берём того, кто из найденной строки. */
    const rowElAtY = (y) => {
      for (const cand of rowsEl.children) {
        if (!cand.classList || !cand.classList.contains("ln")) continue;
        const r = cand.getBoundingClientRect();
        if (y >= r.top && y < r.bottom) return cand;
      }
      return null;
    };
    const cellAtEvent = (e) => {
      const lnY = rowElAtY(e.clientY);
      const want = lnY ? lnY.dataset.idx : null;
      let el = e.target.closest && e.target.closest("[data-col]");
      // Прямое попадание годится, только если оно из ТОЙ ЖЕ строки, что дала вертикаль.
      if (el && want != null) {
        const ln = el.closest(".ln");
        if (!ln || ln.dataset.idx !== want) el = null;
      }
      if (!el && want != null && typeof document.elementsFromPoint === "function") {
        for (const cand of document.elementsFromPoint(e.clientX, e.clientY)) {
          if (!cand.hasAttribute || !cand.hasAttribute("data-col")) continue;
          const ln = cand.closest(".ln");
          if (ln && ln.dataset.idx === want) { el = cand; break; }
        }
      }
      if (!el) return null;
      const ln = el.closest(".ln");
      if (!ln) return null;
      const r = +ln.dataset.idx, col = +el.dataset.col;
      return (isNaN(r) || isNaN(col)) ? null : { r, col };
    };
    /* Бит В КОЛОНКЕ ПАТТЕРНОВ (v0.950): те же два шага, что и у бит строки, — строка по вертикали,
       затем нужный span из неё. Спаны с data-pcol существуют только в режиме выбора ячеек. */
    const patCellAtEvent = (e) => {
      const lnY = rowElAtY(e.clientY);
      const want = lnY ? lnY.dataset.idx : null;
      let el = e.target.closest && e.target.closest("[data-pcol]");
      if (el && want != null) {
        const ln = el.closest(".ln");
        if (!ln || ln.dataset.idx !== want) el = null;
      }
      if (!el && want != null && typeof document.elementsFromPoint === "function") {
        for (const cand of document.elementsFromPoint(e.clientX, e.clientY)) {
          if (!cand.hasAttribute || !cand.hasAttribute("data-pcol")) continue;
          const ln = cand.closest(".ln");
          if (ln && ln.dataset.idx === want) { el = cand; break; }
        }
      }
      if (!el) return null;
      const ln = el.closest(".ln");
      if (!ln) return null;
      const r = +ln.dataset.idx, k = +el.dataset.pcol;
      return (isNaN(r) || isNaN(k)) ? null : { r, k };
    };
    // Протяжка по битам паттерна — своим якорем: диапазон внутри ОДНОГО паттерна.
    let patCellDrag = null;
    const patCellRange = (r, k0, k1, base, del) => {
      patCellSel = new Set(base || patCellSel);
      const lo = Math.min(k0, k1), hi = Math.max(k0, k1);
      for (let k = lo; k <= hi; k++) {
        const key = r + "|" + k;
        if (del) patCellSel.delete(key); else patCellSel.add(key);
      }
    };
    rowsEl.addEventListener("mousedown", (e) => {
      if (!selectionAllowed()) return; // "🔒 Выделение" выключено — биты не выбираются
      if (!cellSelMode || e.button !== 0) return;
      /* Паттерны проверяем ПЕРВЫМИ: их спаны лежат в той же .ln, что и биты строки, и общий
         сброс "клик мимо бита" (см. ниже) иначе стёр бы набор ещё до того, как мы поймём, что
         кликнули по паттерну. */
      const pcell = patCellAtEvent(e);
      if (pcell) {
        e.preventDefault();
        e.stopPropagation();
        const cur = patCellSelRow();
        // ПОСТРОЧНО (требование пользователя): пока набор не снят, чужие строки не трогаем.
        if (cur >= 0 && cur !== pcell.r) {
          say(`Биты паттерна выбираются только в ОДНОЙ строке — сейчас идёт выбор в строке №${cur + 1}. Снимите его (клик по выбранным или «✕ Очистить биты»), потом выбирайте в другой.`);
          return;
        }
        const key = pcell.r + "|" + pcell.k;
        const del = patCellSel.has(key);
        patCellDrag = { r: pcell.r, k: pcell.k, base: new Set(patCellSel), del };
        patCellRange(pcell.r, pcell.k, pcell.k, patCellDrag.base, del);
        render(); saveCache();
        return;
      }
      const cell = cellAtEvent(e);
      e.preventDefault();
      e.stopPropagation(); // не даём клику выделить строку
      /* КЛИК МИМО БИТА — СНЯТЬ ВЕСЬ НАБОР (v0.941, запрос пользователя "мимо битов не снимает
         выделение ячеек"). Это возврат к поведению, которое когда-то убрали (боялись потерять
         набор от случайного промаха), и снова просят вернуть. Делать это надо ИМЕННО ЗДЕСЬ:
         обработчик висит на #rows в фазе ПЕРЕХВАТА и глушит событие stopPropagation'ом, так что
         общий сброс на холсте (см. #screenCanvas в fold-2) при включённом режиме выбора ячеек
         не получает клик вообще — он работает только когда режим выключен. */
      if (!cell) {
        if (cellSel.size || patCellSel.size) {
          cellSel.clear();
          patCellSel.clear();   // биты паттерна снимаются тем же кликом мимо (v0.950)
          render(); saveCache();
          say("Выделения битов сняты (клик мимо битов).");
        }
        return;
      }
      const key = cellKey(cell.r, cell.col);
      // Любой клик по биту — ПЕРЕКЛЮЧАТЕЛЬ (был выбран — снялся, не был — добавился), Ctrl больше
      // не нужен: выделение накапливается, а не перепрыгивает на новый бит. Протяжка от этого же
      // бита продолжает то же действие: с невыбранного — добавляет рамку, с выбранного — снимает.
      const del = cellSel.has(key);
      cellDragAnchor = { r: cell.r, col: cell.col, base: new Set(cellSel), del };
      cellSelectRect(cell.r, cell.col, cell.r, cell.col, cellDragAnchor.base, del);
      render();
    }, true);
    rowsEl.addEventListener("mousemove", (e) => {
      if (!cellSelMode || !patCellDrag || e.buttons !== 1) return;
      const pcell = patCellAtEvent(e);
      if (!pcell || pcell.r !== patCellDrag.r) return;   // за пределы своего паттерна не выходим
      patCellRange(patCellDrag.r, patCellDrag.k, pcell.k, patCellDrag.base, patCellDrag.del);
      render();
    });
    window.addEventListener("mouseup", () => { patCellDrag = null; });
    rowsEl.addEventListener("mousemove", (e) => {
      if (!cellSelMode || !cellDragAnchor || e.buttons !== 1) return;
      const cell = cellAtEvent(e);
      if (!cell) return;
      cellSelectRect(cellDragAnchor.r, cellDragAnchor.col, cell.r, cell.col,
                     cellDragAnchor.base, cellDragAnchor.del);
      render();
    });
    window.addEventListener("mouseup", () => { cellDragAnchor = null; });
  }
}

/* Общая обёртка операций над выбранными ячейками: снимок для отката, проверка "есть ли выбор",
   перерисовка и запись кэша. fn получает Map(строка → колонки) и общую ширину полотна. */
function cellSelApply(name, fn){
  if (!cellSel.size) { say("Сначала выберите ячейки (режим «▭ Выбор ячеек»)."); return; }
  const byRow = cellSelByRow();
  const maxLen = cellSelMaxLen();
  snapshot();
  const touched = fn(byRow, maxLen);
  insertedFlagsMap.clear();
  say(`${name}: ячеек — ${touched}.`);
  render(); saveCache();
}
const bCellInvertEl = document.getElementById("bCellInvert");
if (bCellInvertEl) bCellInvertEl.onclick = () => cellSelApply("Инверсия ячеек", (byRow, maxLen) => {
  let n = 0;
  byRow.forEach((cols, r) => {
    const s = st.rows[r] || "";
    if (!s.length) return;
    const arr = s.split("");
    for (const c of cols) {
      const j = cellBitIdx(r, c, maxLen);
      if (j < 0) continue;
      if (arr[j] === "0") { arr[j] = "1"; n++; }
      else if (arr[j] === "1") { arr[j] = "0"; n++; }
    }
    st.rows[r] = arr.join("");
    invFlagsMap.delete(r);
  });
  return n;
});
/* Сдвиг ПО ВЫБРАННЫМ ПОЗИЦИЯМ внутри каждой строки: значения выбранных ячеек строки крутятся по
   кругу между собой, остальные биты не трогаются. */
function cellSelShift(dir){
  cellSelApply(dir < 0 ? "Сдвиг ячеек влево" : "Сдвиг ячеек вправо", (byRow, maxLen) => {
    let n = 0;
    byRow.forEach((cols, r) => {
      const s = st.rows[r] || "";
      if (!s.length) return;
      const arr = s.split("");
      const idxs = cols.map(c => cellBitIdx(r, c, maxLen)).filter(j => j >= 0);
      if (idxs.length < 2) return;
      const vals = idxs.map(j => arr[j]);
      for (let k = 0; k < idxs.length; k++) {
        const from = dir < 0 ? (k + 1) % vals.length : (k - 1 + vals.length) % vals.length;
        arr[idxs[k]] = vals[from];
      }
      st.rows[r] = arr.join("");
      invFlagsMap.delete(r);
      n += idxs.length;
    });
    return n;
  });
}
const bCellShiftLEl = document.getElementById("bCellShiftL");
if (bCellShiftLEl) bCellShiftLEl.onclick = () => cellSelShift(-1);
const bCellShiftREl = document.getElementById("bCellShiftR");
if (bCellShiftREl) bCellShiftREl.onclick = () => cellSelShift(1);
/* Поворот выбранного прямоугольника на 90° ПО ЧАСОВОЙ, НА МЕСТЕ: значения читаются по габаритной
   рамке выделения и раскладываются повёрнутыми в ту же рамку. Ячейки, где в строке нет бита,
   пропускаются — за пределы данных ничего не выходит. */
const bCellRotateEl = document.getElementById("bCellRotate");
if (bCellRotateEl) bCellRotateEl.onclick = () => cellSelApply("Поворот ячеек 90°", (byRow, maxLen) => {
  let rLo = Infinity, rHi = -Infinity, cLo = Infinity, cHi = -Infinity;
  byRow.forEach((cols, r) => {
    if (r < rLo) rLo = r;
    if (r > rHi) rHi = r;
    for (const c of cols) { if (c < cLo) cLo = c; if (c > cHi) cHi = c; }
  });
  if (!isFinite(rLo)) return 0;
  const H = rHi - rLo + 1, W = cHi - cLo + 1;
  const src = [];
  for (let r = 0; r < H; r++) {
    src.push([]);
    for (let c = 0; c < W; c++) {
      const j = cellBitIdx(rLo + r, cLo + c, maxLen);
      src[r].push(j >= 0 ? (st.rows[rLo + r] || "")[j] : null);
    }
  }
  // Поворот по часовой: новая ячейка (r,c) берётся из старой (H-1-c, r) — рамка та же, поэтому
  // при неквадратном выделении часть значений в неё не попадает, а часть мест остаётся как было.
  const rows = new Map();
  let n = 0;
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      const sr = H - 1 - c, sc = r;
      if (sr < 0 || sr >= H || sc < 0 || sc >= W) continue;
      const v = src[sr][sc];
      if (v === null || v === undefined) continue;
      const rowIdx = rLo + r;
      const j = cellBitIdx(rowIdx, cLo + c, maxLen);
      if (j < 0) continue;
      if (!rows.has(rowIdx)) rows.set(rowIdx, (st.rows[rowIdx] || "").split(""));
      rows.get(rowIdx)[j] = v;
      n++;
    }
  }
  rows.forEach((arr, r) => { st.rows[r] = arr.join(""); invFlagsMap.delete(r); });
  return n;
});

/* "◺ Поворот 90°" — блок строк кладётся на СЕТКУ ПО ТЕКУЩЕМУ ВЫРАВНИВАНИЮ (rowShiftFor знает про
   все режимы, включая лесенки и оси) и поворачивается по часовой: каждый столбец сетки становится
   строкой, прочитанной СНИЗУ ВВЕРХ. Вертикальная ось симметрии (у треугольника — его высота)
   ложится горизонтально (запрос пользователя).
   Пустые места ВНУТРИ новой строки становятся нулями (иначе строка распалась бы на куски), по
   краям — просто обрезаются, поэтому ступенчатая форма фигуры сохраняется.
   Число строк меняется (строк становится столько, сколько было столбцов), поэтому блок в таблице
   заменяется целиком — вместе с паттернами/флагами и с поправкой разделителей строк. */
function rotateSelected90(ccw){
  const sel = (st.selectedRows && st.selectedRows.size) ? Array.from(st.selectedRows).sort((a, b) => a - b) : null;
  // ОДНА выделенная строка = блок ОТ САМОГО ВЕРХА до неё (запрос пользователя: "когда выделена
  // одна строка, всё что выше неё участвует"). Выделение при этом реально расширяется — видно, с
  // чем работала кнопка, и следующее нажатие крутит ту же фигуру дальше.
  if (sel && sel.length === 1 && sel[0] > 0) {
    const top = sel[0];
    sel.length = 0;
    st.selectedRows = new Set();
    for (let i = 0; i <= top; i++) { sel.push(i); st.selectedRows.add(i); }
  }
  const start = sel ? sel[0] : 0;
  const end = sel ? sel[sel.length - 1] : st.rows.length - 1;

  const src = [];
  for (let i = start; i <= end; i++) src.push(st.rows[i] || "");
  if (!src.some(s => s.length)) { say("Поворот: нет непустых строк."); return; }

  let maxLen = 0;
  for (const s of src) if (s.length > maxLen) maxLen = s.length;
  const shifts = src.map((s, k) => s.length ? rowShiftFor(maxLen, start + k, s, st.align) : 0);
  let minCol = Infinity, maxCol = -Infinity;
  src.forEach((s, k) => {
    if (!s.length) return;
    if (shifts[k] < minCol) minCol = shifts[k];
    if (shifts[k] + s.length - 1 > maxCol) maxCol = shifts[k] + s.length - 1;
  });
  if (!isFinite(minCol)) { say("Поворот: нечего поворачивать."); return; }

  const R = src.length, W = maxCol - minCol + 1;
  const cellAt = (r, col) => {
    const s = src[r];
    const j = col - shifts[r];
    return (j >= 0 && j < s.length) ? s[j] : null;
  };
  const out = [];
  for (let c = 0; c < W; c++) {
    // ПО ЧАСОВОЙ: столбцы слева направо, каждый читается СНИЗУ ВВЕРХ (нижняя строка блока
    // становится левым краем новой строки, вершина фигуры уезжает вправо).
    // ПРОТИВ ЧАСОВОЙ: столбцы справа налево, каждый читается СВЕРХУ ВНИЗ — ось ложится в другую
    // сторону, вершина смотрит влево (запрос пользователя: "надо вниз вертикальную ложить").
    const col = ccw ? (maxCol - c) : (minCol + c);
    let line = "";
    if (ccw) { for (let r = 0; r < R; r++) { const ch = cellAt(r, col); line += (ch === null ? " " : ch); } }
    else { for (let r = R - 1; r >= 0; r--) { const ch = cellAt(r, col); line += (ch === null ? " " : ch); } }
    line = line.replace(/^ +/, "").replace(/ +$/, "").replace(/ /g, "0");
    out.push(line);
  }

  snapshot();
  // ПАТТЕРНЫ НЕ ТРОГАЕМ ВООБЩЕ (запрос пользователя): они остаются на своих номерах — поворот
  // меняет только сами строки. Если строк стало больше, чем паттернов, список паттернов просто
  // дополняется пустыми, чтобы длины сходились; лишние паттерны (когда строк стало меньше) тоже
  // остаются на месте — ни один не теряется.
  // РЕЗУЛЬТАТ ЛОЖИТСЯ НА ВЫДЕЛЕННУЮ СТРОКУ И ВЫШЕ (запрос пользователя: "квадрат не строим вниз
  // ниже выделения"). Повёрнутый блок занимает W строк, исходный — R. Раньше он просто вставлялся
  // на место блока, и при W > R лишние строки появлялись ПОД выделением, то есть фигура росла вниз.
  // Теперь нижний край жёстко привязан к нижней строке блока (она же выделенная), а недостающие
  // строки берутся СВЕРХУ: сперва те, что реально есть над блоком, а если их не хватает до самого
  // верха цепочки — ровно столько пустых строк добавляется в её начало. Ниже выделения при этом не
  // переписывается ни одна строка.
  let blockEnd = end;
  const lackTop = Math.max(0, W - (blockEnd + 1));
  if (lackTop) {
    const blanks = new Array(lackTop).fill("");
    st.rows.splice(0, 0, ...blanks);
    st.used.splice(0, 0, ...blanks.map(() => false));
    blockEnd += lackTop;
  }
  const from = blockEnd - W + 1;
  const newUsed = out.map(() => false);
  st.rows.splice(from, W, ...out);
  st.used.splice(from, W, ...newUsed);
  while (st.pats.length < st.rows.length) {
    st.pats.push({ text: "", ord: st.pats.length, found: false, kind: null, step: null });
  }
  // Разделители внутри блока теряют смысл, а те, что ниже, едут вместе со сдвигом числа строк.
  if (st.rowDividers && st.rowDividers.size) {
    const delta = W - R, shifted = new Set();
    for (const d of st.rowDividers) {
      if (d >= start && d <= end) continue;
      shifted.add(d > end ? d + delta : d);
    }
    st.rowDividers = shifted;
  }
  insertedFlagsMap.clear();
  invFlagsMap.clear();
  maskChangedMap.clear(); maskBaseRows = null;
  // ВЫДЕЛЕНИЕ НЕ СБРАСЫВАЕМ (запрос пользователя): выделенным остаётся ВЕСЬ новый блок, поэтому
  // следующее нажатие крутит ту же фигуру дальше. Если до поворота выделения не было (крутили всю
  // цепочку), так и оставляем — тогда и следующий поворот пойдёт по всей цепочке.
  if (sel) {
    // Выделенными остаются РОВНО строки результата — он мог уехать вверх, и старые номера уже
    // указывали бы не туда.
    const ns = new Set();
    for (let i = from; i <= blockEnd && i < st.rows.length; i++) ns.add(i);
    st.selectedRows = ns;
  }
  st.hit = null;
  const dirLabel = ccw ? "против часовой" : "по часовой";
  say(`Поворот 90° (${dirLabel}): было ${R} стр. × ${W} столб. — стало ${W} стр. Паттерны не тронуты.`);
  logStep("Поворот 90°", `${start + 1}–${end + 1}`, out.join(""), `Блок ${R}×${W} повёрнут ${dirLabel}`);
  render(); saveCache();
}
/* Проверить фон-поиск ПРЯМО СЕЙЧАС и, если паттерн нашёлся, захватить находку — тот же захват, что
   и после ручного ◄/►Круга (см. afterShiftBgCheck): "🧲 Захват находки" / "⬇ Расширять вниз",
   авто-зеркала (они внутри captureFoundRow) и "🎯 При находке: достраивать".
   Нужен операциям, которые меняют биты НЕ сдвигом — "⬔ До квадрата", "◺/◹ 90°": раньше находка
   после них только подсвечивалась, а выделение стояло на месте (запрос пользователя: "До квадрата
   дал паттерн, захват включён, а выделение не расширилось"). Возвращает true, если что-то
   захвачено, — вызывающему остаётся перерисовать. */
function captureOnFindNow(){
  if (!st.captureOnFind && !st.growDownOnFind) return false;
  const bgInfo = computeBgSearchTarget();
  if (!bgInfo || !bgInfo.matched) return false;
  captureFoundRow(bgInfo.targetIdx, st.growDownOnFind);
  captureBelowRun(st.growDownOnFind); // и дальше по подряд помеченным "🔽 Все ниже"
  topBuildOnHitStep();
  return true;
}
const bRotate90El = document.getElementById("bRotate90");
if (bRotate90El) bRotate90El.onclick = () => { rotateSelected90(false); if (captureOnFindNow()) { render(); saveCache(); } };
const bRotate90CcwEl = document.getElementById("bRotate90ccw");
if (bRotate90CcwEl) bRotate90CcwEl.onclick = () => { rotateSelected90(true); if (captureOnFindNow()) { render(); saveCache(); } };

/* "⬔ До квадрата" — достраивает фигуру до КВАДРАТА зеркалом по главной диагонали ВВЕРХ (запрос
   пользователя: "если треугольник — зеркально по диагонали вверх").
   Работает по той же сетке текущего выравнивания, что и поворот 90° (rowShiftFor знает про лесенки
   и оси), поэтому у лесенки 1 / 11 / 111 ступеньки лежат ровно по диагонали, а не по длинам строк.
   Правило простое: в каждую пустую клетку кладётся значение ЗЕРКАЛЬНОЙ ей клетки (r,c) ← (c,r).
   У нижнего треугольника это ровно и достраивает верхний, давая квадрат. Клетка, пустая и у себя,
   и у зеркала (фигура была не треугольником), заполняется нулём — квадрат должен остаться
   квадратом, дыр в нём быть не может.
   Сторона квадрата — max(строк, столбцов): меньшей стороной квадрат не накрыл бы всю фигуру, и
   часть данных пришлось бы отрезать. */
/* Что достроило ПОСЛЕДНЕЕ нажатие: {start, n, cells, inv}. cells — клетки, которых в исходной
   фигуре не было (ключ r<<16|c внутри блока). Нужно для повторных нажатий: достраивать во второй
   раз уже нечего (фигура — квадрат), поэтому клик инвертирует ровно эти клетки, следующий
   возвращает как было, и так по кругу (запрос пользователя). Исходные биты не трогаются никогда. */
let squareFillLast = null;
/* Что достроил последний "⬔ До квадрата ПО ХВОСТАМ" — чтобы повторное нажатие инвертировало ровно
   ту часть, которую оно же и добавило (то же поведение, что у обычного режима, см. squareFillLast).
   { start, end, H, ranges: [[строка, от, до]] } — диапазоны ДОСТРОЕННЫХ бит, конец не включая. */
var squareTailLast = null;
/* "⬔ До квадрата" для блока, который треугольником НЕ является (запрос пользователя): треугольник
   ищется в ХВОСТАХ строк — нижняя строка блока даёт H бит, каждая следующая вверх на один меньше,
   до одного. Достраивается зеркалом по главной диагонали ТОЛЬКО этот треугольник, а ГОЛОВЫ строк
   (всё, что левее хвоста) остаются на месте: строка = голова + квадратная часть.
   Хвосты берутся как самостоятельный блок с выровненными левыми краями — обычный прямоугольный
   треугольник длин 1..H, у которого верхняя половина целиком набирается зеркалом (нулями добивать
   нечего, зеркальная клетка есть всегда). */
function squareFillTails(start, end){
  const R = end - start + 1;
  // ПОВТОРНОЕ нажатие по тому же блоку — инверсия достроенного, а не новая достройка.
  if (squareTailLast && squareTailLast.start === start && squareTailLast.end === end) {
    let ok = true;
    for (const rg of squareTailLast.ranges) {
      const s = st.rows[rg[0]];
      if (typeof s !== "string" || s.length < rg[2]) { ok = false; break; }
    }
    if (ok) {
      snapshot();
      let flipped = 0;
      for (const rg of squareTailLast.ranges) {
        const s = st.rows[rg[0]];
        let out = s.slice(0, rg[1]);
        for (let p = rg[1]; p < rg[2]; p++) {
          const ch = s[p];
          out += (ch === "0" || ch === "1") ? (ch === "1" ? "0" : "1") : ch;
          if (ch === "0" || ch === "1") flipped++;
        }
        st.rows[rg[0]] = out + s.slice(rg[2]);
      }
      squareTailLast.inv = !squareTailLast.inv;
      insertedFlagsMap.clear();
      invFlagsMap.clear();
      maskChangedMap.clear(); maskBaseRows = null;
      st.hit = null;
      say(`До квадрата (по хвостам): достроенная часть ${squareTailLast.inv ? "инвертирована" : "возвращена как была"} — ${flipped} бит. Ещё нажатие — обратно.`);
      logStep("До квадрата ⇄", `${start + 1}–${end + 1}`, "", `Инверсия достроенных хвостов, ${flipped} бит`);
      render(); saveCache();
      return;
    }
    squareTailLast = null;
  }
  // Максимальная высота треугольника в хвостах. Идём СНИЗУ ВВЕРХ: при высоте h нижней строке нужно
  // h бит, следующей вверх h−1, и так до одного бита у верхней. Значит строка, стоящая j-й снизу,
  // ограничивает высоту сверху величиной (её длина + j) — берём минимум по всем уже пройденным и
  // растим h, пока он в этот минимум укладывается. Как только очередная строка коротка — выше не
  // поднимаемся: ограничение только падает.
  let H = 0, bound = Infinity;
  for (let j = 0; j < R; j++) {
    const s = st.rows[end - j] || "";
    bound = Math.min(bound, s.length + j);
    if (bound >= j + 1) H = j + 1; else break;
  }
  if (H < 2) {
    say("До квадрата: блок не треугольник, и в хвостах строк треугольника тоже нет — нужны хотя бы две нижние строки с растущими хвостами.");
    return;
  }
  const tri = [], heads = [];
  for (let k = 0; k < H; k++) {
    const s = st.rows[end - H + 1 + k] || "";
    tri.push(s.slice(s.length - (k + 1)));
    heads.push(s.slice(0, s.length - (k + 1)));
  }
  snapshot();
  const ranges = [];
  let mirrored = 0;
  for (let k = 0; k < H; k++) {
    let line = tri[k];
    // Клетки правее диагонали берутся зеркалом: (k, c) ← (c, k), а у треугольника длин 1..H такая
    // клетка есть всегда, потому что c > k.
    for (let c = k + 1; c < H; c++) { line += tri[c][k]; mirrored++; }
    const r = end - H + 1 + k;
    st.rows[r] = heads[k] + line;
    if (c_len(k, H) > 0) ranges.push([r, heads[k].length + k + 1, heads[k].length + H]);
    insertedFlagsMap.delete(r);
    invFlagsMap.delete(r);
  }
  maskChangedMap.clear(); maskBaseRows = null;
  st.hit = null;
  squareTailLast = { start: start, end: end, H: H, ranges: ranges, inv: false };
  squareFillLast = null;
  say(`До квадрата (по хвостам): в строках ${end - H + 2}–${end + 1} найден треугольник ${H}×${H}, достроен зеркалом ${mirrored} бит. Головы строк не тронуты. Ещё нажатие — инверсия достроенной части.`);
  logStep("До квадрата (хвосты)", `${end - H + 2}–${end + 1}`, "", `Треугольник ${H}×${H}, зеркалом ${mirrored} бит`);
  render(); saveCache();
}
/* Сколько бит достроено в строке k треугольника высоты H (0 — ничего, у самой нижней строки). */
function c_len(k, H){ return H - k - 1; }
function squareFillSelected(){
  const sel = (st.selectedRows && st.selectedRows.size) ? Array.from(st.selectedRows).sort((a, b) => a - b) : null;
  // ОДНА выделенная строка = блок ОТ САМОГО ВЕРХА до неё (запрос пользователя: "пусть все до
  // верха сначала выделит и потом квадрат"). Выделение при этом реально расширяется — видно, с
  // чем работала кнопка, и повторное нажатие (инверсия достроенного) видит тот же блок.
  if (sel && sel.length === 1 && sel[0] > 0) {
    const top = sel[0];
    sel.length = 0;
    st.selectedRows = new Set();
    for (let i = 0; i <= top; i++) { sel.push(i); st.selectedRows.add(i); }
  }
  const start = sel ? sel[0] : 0;
  const end = sel ? sel[sel.length - 1] : st.rows.length - 1;

  // ПОВТОРНОЕ нажатие по тому же блоку — инверсия достроенной части вместо нового достроения.
  // Сверяем не только границы блока, но и что все его строки всё ещё длины n: если фигуру успели
  // поправить руками, запомненные координаты уже ничего не значат — тогда достраиваем заново.
  if (squareFillLast && squareFillLast.start === start && squareFillLast.n === (end - start + 1)) {
    const n = squareFillLast.n;
    let ok = true;
    for (let r = 0; r < n; r++) {
      const s = st.rows[start + r];
      if (typeof s !== "string" || s.length !== n) { ok = false; break; }
    }
    if (ok) {
      snapshot();
      let flipped = 0;
      for (const key of squareFillLast.cells) {
        const r = key >> 16, c = key & 0xffff;
        const s = st.rows[start + r];
        const ch = s[c];
        if (ch !== "0" && ch !== "1") continue;
        st.rows[start + r] = s.slice(0, c) + (ch === "1" ? "0" : "1") + s.slice(c + 1);
        flipped++;
      }
      squareFillLast.inv = !squareFillLast.inv;
      insertedFlagsMap.clear();
      invFlagsMap.clear();
      maskChangedMap.clear(); maskBaseRows = null;
      st.hit = null;
      say(`До квадрата: достроенная часть ${squareFillLast.inv ? "инвертирована" : "возвращена как была"} — ${flipped} бит. Ещё нажатие — обратно.`);
      logStep("До квадрата ⇄", `${start + 1}–${end + 1}`, "", `Инверсия достроенной части, ${flipped} бит`);
      render(); saveCache();
      return;
    }
    squareFillLast = null;
  }

  // Блок из НЕСКОЛЬКИХ строк достраивается по ТРЕУГОЛЬНИКУ В ХВОСТАХ строк, головы остаются на
  // месте (запрос пользователя). Прежний путь (ниже) строил квадрат из всего блока и, когда
  // столбцов больше, чем строк, ДОБАВЛЯЛ недостающие строки ПОД выделением — "строит ещё ниже
  // выделенных, не надо, только в выделенных с краю". По хвостам число строк не меняется вовсе:
  // квадрат целиком помещается в сами выделенные строки, у их края. Для ровной лесенки 1/11/111
  // результат тот же, что и раньше: головы там пустые, а хвосты — весь блок.
  if (end > start) { squareFillTails(start, end); return; }
  const src = [];
  for (let i = start; i <= end; i++) src.push(st.rows[i] || "");
  if (!src.some(s => s.length)) { say("До квадрата: нет непустых строк."); return; }

  let maxLen = 0;
  for (const s of src) if (s.length > maxLen) maxLen = s.length;
  const shifts = src.map((s, k) => s.length ? rowShiftFor(maxLen, start + k, s, st.align) : 0);
  let minCol = Infinity, maxCol = -Infinity;
  src.forEach((s, k) => {
    if (!s.length) return;
    if (shifts[k] < minCol) minCol = shifts[k];
    if (shifts[k] + s.length - 1 > maxCol) maxCol = shifts[k] + s.length - 1;
  });
  if (!isFinite(minCol)) { say("До квадрата: нечего достраивать."); return; }

  const R = src.length, W = maxCol - minCol + 1;
  const N = Math.max(R, W);
  // Клетка сетки по номеру строки и столбца, отсчитанному от левого края фигуры (minCol).
  const cellAt = (r, c) => {
    if (r < 0 || r >= R) return null;
    const s = src[r];
    const j = (minCol + c) - shifts[r];
    return (j >= 0 && j < s.length) ? s[j] : null;
  };
  const out = [];
  let mirrored = 0, filled = 0;
  const addedCells = []; // клетки, которых в исходной фигуре не было — их инвертирует повторный клик
  for (let r = 0; r < N; r++) {
    let line = "";
    for (let c = 0; c < N; c++) {
      const own = cellAt(r, c);
      if (own !== null) { line += own; continue; }
      addedCells.push((r << 16) | c);
      const mir = cellAt(c, r); // зеркало по главной диагонали
      if (mir !== null) { line += mir; mirrored++; }
      else { line += "0"; filled++; }
    }
    out.push(line);
  }

  snapshot();
  // Паттерны не трогаем — как и у поворота: меняются только сами строки.
  const newUsed = out.map(() => false);
  st.rows.splice(start, R, ...out);
  st.used.splice(start, R, ...newUsed);
  while (st.pats.length < st.rows.length) {
    st.pats.push({ text: "", ord: st.pats.length, found: false, kind: null, step: null });
  }
  if (st.rowDividers && st.rowDividers.size) {
    const delta = N - R, shifted = new Set();
    for (const d of st.rowDividers) {
      if (d >= start && d <= end) continue;
      shifted.add(d > end ? d + delta : d);
    }
    st.rowDividers = shifted;
  }
  insertedFlagsMap.clear();
  invFlagsMap.clear();
  maskChangedMap.clear(); maskBaseRows = null;
  if (sel) {
    const ns = new Set();
    for (let i = start; i < start + N && i < st.rows.length; i++) ns.add(i);
    st.selectedRows = ns;
  }
  st.hit = null;
  squareFillLast = { start: start, n: N, cells: addedCells, inv: false };
  say(`До квадрата: было ${R} стр. × ${W} столб. — стал квадрат ${N}×${N} (зеркалом ${mirrored} бит, нулями ${filled}). Паттерны не тронуты. Ещё нажатие — инверсия достроенной части.`);
  logStep("До квадрата", `${start + 1}–${end + 1}`, out.join(""), `Блок ${R}×${W} достроен до ${N}×${N}`);
  render(); saveCache();
}
const bSquareFillEl = document.getElementById("bSquareFill");
if (bSquareFillEl) bSquareFillEl.onclick = () => { squareFillSelected(); if (captureOnFindNow()) { render(); saveCache(); } };

/* "☰ Выделить все" — выделяет все строки разом; если все уже выделены, клик снимает выделение.
   Данные не меняются, поэтому snapshot() не нужен. Счётчики кругового сдвига сбрасываются так же,
   как при обычном клике по строке (новое выделение = новая "сессия" сдвига, см. onclick по .ln). */
/* ПОСТРОЕНИЯ НАД ПЕРВОЙ СТРОКОЙ (запрос пользователя). Это обычные строки цепочки, добавленные
   СВЕРХУ, поэтому они сами по себе участвуют во всех склейках, поиске и XOR — ничего для этого
   делать не нужно. Отличаются только НУМЕРАЦИЕЙ: настоящая первая строка обязана остаться нулевой,
   значит достроенные уходят в минус (-1, -2, -3 сверху вниз). Сколько их сейчас — st.topBuilt.
   Номер строки для показа: у достроенных отрицательный, у настоящих прежний. */
function rowLabel(i){ return i - (st.topBuilt || 0); }
/* Тот же номер, но ТЕКСТОМ для показа в колонках номеров: при включённой кнопке "🔢 Двоичные
   номера" (#bBinRowNums во вкладке "Вид", st.binRowNums) — в двоичном виде, минус у достроенных
   сверху строк сохраняется (-5 → -101). Все расчёты, лог и сообщения по-прежнему зовут rowLabel()
   и остаются десятичными — тумблер чисто визуальный. */
function rowNumText(n){
  if (!st.binRowNums) return String(n);
  return (n < 0 ? "-" : "") + Math.abs(n).toString(2);
}
function rowLabelText(i){ return rowNumText(rowLabel(i)); }

/* === НОМЕРА СТРОК КАК ДАННЫЕ (v0.842, запрос пользователя) ===
   Номер берётся ВСЕГДА в двоичном виде — независимо от кнопки "🔢 Двоичные номера" (та только про
   показ): и паттерн, и строка цепочки обязаны остаться строкой из 0/1, иначе они выпадут из
   поиска и склеек. Достроенные сверху строки (номер отрицательный) пропускаются — "-101" бит-
   строкой не является. */
function numGlueLabel(i){
  const n = rowLabel(i);
  return n > 0 ? n.toString(2) : "";
}

/* "🔢 Номер к паттерну" (#bNumToPat во вкладке "Вид") — приклеивает номер строки к тексту её
   паттерна. Нажатия ходят по кругу: выкл → справа → слева → выкл (запрос пользователя "справа,
   слева, при нажатии чередуется"). Это НАСТОЯЩАЯ правка данных: приклеенные биты видит и поиск,
   и склейки — поэтому Escape/Сброс возвращают паттерны к сохранённой цепочке, а Undo снимает на
   шаг назад. Отдельного снимка "как было" не нужно: что именно приклеено, известно посимвольно
   (st.numGlue помнит сторону), и той же строкой номер отрывается обратно. */
const NUM_GLUE_NEXT = { "": "right", right: "left", left: "" };
function numGlueStrip(){
  const side = st.numGlue || "";
  if (side !== "right" && side !== "left") return;
  (st.pats || []).forEach((p, i) => {
    if (!p || !p.text) return;
    const num = numGlueLabel(i);
    if (!num) return;
    if (side === "right" && p.text.endsWith(num)) p.text = p.text.slice(0, -num.length);
    else if (side === "left" && p.text.startsWith(num)) p.text = p.text.slice(num.length);
  });
}
function numGlueToggle(){
  const next = NUM_GLUE_NEXT[st.numGlue || ""] || "right";
  snapshot();
  numGlueStrip();                 // сперва снимаем то, что приклеено сейчас — иначе номера копятся
  let n = 0;
  if (next) {
    (st.pats || []).forEach((p, i) => {
      if (!p || !p.text) return;
      const num = numGlueLabel(i);
      if (!num) return;
      p.text = next === "right" ? (p.text + num) : (num + p.text);
      // Текст паттерна изменился — прежняя отметка "найден" относится уже не к нему.
      p.found = false; p.kind = null; p.step = null;
      n++;
    });
  }
  st.numGlue = next;
  updateNumGlueBtn();
  render(); saveCache();
  say(next
    ? `🔢 Двоичные номера строк приклеены к паттернам ${next === "right" ? "СПРАВА" : "СЛЕВА"} (${n} шт.). Ещё нажатие — с другой стороны, третье — снять. Escape/Сброс вернут сохранённую цепочку`
    : "🔢 Номера от паттернов отклеены.");
  logStep("Номер к паттерну", "", "", next ? (next === "right" ? "справа" : "слева") + `, ${n} шт.` : "снято");
}
function updateNumGlueBtn(){
  const b = document.getElementById("bNumToPat");
  if (!b) return;
  const side = st.numGlue || "";
  b.textContent = "🔢 Номер к паттерну: " + (side === "right" ? "справа" : side === "left" ? "слева" : "выкл");
  b.classList.toggle("mode-act", !!side);
}

/* "🔢 Номер к строке" (#bNumToRow, v0.859, запрос пользователя "надо к цепочкам такую же кнопку") —
   ровно то же, что "🔢 Номер к паттерну", только номер приклеивается к САМОЙ СТРОКЕ цепочки, а не
   к её паттерну. Круг тот же: выкл → справа → слева → выкл; сторона помнится в st.numGlueRows и по
   ней же номер отрывается обратно. Отличие от "🔢 Номера вместо строк" — там содержимое строки
   заменяется целиком, тут дописывается к имеющимся битам, и это обратимо.
   Номер двоичный по той же причине: строка обязана остаться строкой из 0/1. */
function numGlueRowsStrip(){
  const side = st.numGlueRows || "";
  if (side !== "right" && side !== "left") return;
  st.rows = st.rows.map((s, i) => {
    if (!s) return s;
    const num = numGlueLabel(i);
    if (!num) return s;
    if (side === "right" && s.endsWith(num)) return s.slice(0, -num.length);
    if (side === "left" && s.startsWith(num)) return s.slice(num.length);
    return s;
  });
}
function numGlueRowsToggle(){
  const next = NUM_GLUE_NEXT[st.numGlueRows || ""] || "right";
  snapshot();
  numGlueRowsStrip();             // сперва снимаем приклеенное сейчас — иначе номера копятся
  let n = 0;
  if (next) {
    st.rows = st.rows.map((s, i) => {
      if (!s) return s;
      const num = numGlueLabel(i);
      if (!num) return s;
      n++;
      return next === "right" ? (s + num) : (num + s);
    });
  }
  st.numGlueRows = next;
  updateNumGlueRowsBtn();
  render(); saveCache();
  say(next
    ? `🔢 Двоичные номера приклеены к строкам цепочки ${next === "right" ? "СПРАВА" : "СЛЕВА"} (${n} шт.). Ещё нажатие — с другой стороны, третье — снять. Escape/Сброс вернут сохранённую цепочку`
    : "🔢 Номера от строк цепочки отклеены.");
  logStep("Номер к строке", "", "", next ? (next === "right" ? "справа" : "слева") + `, ${n} шт.` : "снято");
}
function updateNumGlueRowsBtn(){
  const b = document.getElementById("bNumToRow");
  if (!b) return;
  const side = st.numGlueRows || "";
  b.textContent = "🔢 Номер к строке: " + (side === "right" ? "справа" : side === "left" ? "слева" : "выкл");
  b.classList.toggle("mode-act", !!side);
}

/* НОМЕРА ВНУТРИ ЯЧЕЕК ПАТТЕРНОВ (v0.873, запрос пользователя) — своя кнопка «№» у каждой колонки
   в полосе выравниваний. Чистый показ: место под номер и его позицию задают классы body
   (patnum-l/patnum-r, см. CSS), сам номер печатает render(). У П2 номер стоит СПРАВА от паттерна
   (бейдж шага при этом уезжает влево), у П1 — зеркально, слева. */
function applyPatNumClasses(){
  document.body.classList.toggle("patnum-l", !!st.patNumL);
  document.body.classList.toggle("patnum-r", st.patNumR !== false);
  const bl = document.getElementById("bPatNumL");
  if (bl) bl.classList.toggle("overlay-on", !!st.patNumL);
  const br = document.getElementById("bPatNumR");
  if (br) br.classList.toggle("overlay-on", st.patNumR !== false);
}
/* Поля "по сколько строк на ступеньку" у лесенок (#stairsGrpL/#stairsGrpR, v0.875). Значение
   живёт в настройках вида (своё у каждой цепочки) и читается из alignShift() через
   stairsGroupFor(). Меньше 1 не бывает — пустое поле и мусор считаем единицей. */
function readStairsGroup(id, key){
  const el = document.getElementById(id);
  if (!el) return;
  const n = Math.round(+el.value);
  st[key] = (n > 1) ? Math.min(99, n) : 1;
  el.value = String(st[key]);
  render(); saveCache();
}
function applyStairsGroupInputs(){
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = String(v || 1); };
  set("stairsGrpL", st.stairsGroupL);
  set("stairsGrpR", st.stairsGroupR);
  set("stairsStepL", st.stairsStepL);
  set("stairsStepR", st.stairsStepR);
}

function togglePatNum(side){
  if (side === "l") st.patNumL = !st.patNumL;
  else st.patNumR = (st.patNumR === false);
  applyPatNumClasses();
  render(); saveCache();
}

/* "⤒🧩 Начало паттернов сюда" (#bPatZeroHere, v0.868, запрос пользователя "пусть нулевая строка в
   паттернах отдельно от цепочек выбирается и также функц как у цепочек").
   У ЦЕПОЧКИ нулевая строка — пустая граница, ниже которой идут данные (см. ensureZeroRow), и она
   одна на всё полотно. Колонке паттернов теперь можно задать СВОЮ такую границу: выделенная ячейка
   становится нулевой, и вся колонка сдвигается так, чтобы её паттерны начинались сразу под ней.
   Делаем это НАСТОЯЩИМ сдвигом массива st.pats, а не отдельным смещением при отрисовке: на
   st.pats[i] завязаны и поиск ("паттерн строки ниже выделенной"), и укладка, и "🌈 Все паттерны" —
   любое "виртуальное" смещение пришлось бы протаскивать через них все и разъезжалось бы с
   картинкой. Сдвинутый массив они видят как обычный, поэтому "функционирует как у цепочек"
   получается само.
   Вверх колонка может уехать только до самого верха полотна: выше индекса 0 места нет, эти ячейки
   отбрасываются (вернуть — Undo). */
function patColumnZeroHere(){
  const sel = (st.selectedPats && st.selectedPats.size === 1) ? Array.from(st.selectedPats)[0] : -1;
  if (sel < 0) {
    say("Начало паттернов: выдели РОВНО ОДНУ ячейку колонки паттернов — она и станет нулевой для неё.");
    return;
  }
  const zero = st.topBuilt || 0;
  const delta = sel - zero;
  if (!delta) { say("Эта ячейка уже нулевая для колонки паттернов."); return; }
  snapshot();
  const mkEmpty = () => ({ text: "", ord: 0, found: false, kind: null, step: null });
  if (delta > 0) {
    const head = [];
    for (let i = 0; i < delta; i++) head.push(mkEmpty());
    st.pats = head.concat(st.pats);
  } else {
    st.pats = st.pats.slice(-delta);
  }
  // ord — порядковый номер ячейки, по нему идут подписи и сортировки: после сдвига пересобираем.
  st.pats.forEach((p, i) => { if (p) p.ord = i; });
  st.selectedPats = new Set([zero]);   // выделение переезжает вместе с ячейкой — она теперь нулевая
  render(); saveCache();
  say(`⤒ Колонка паттернов сдвинута на ${Math.abs(delta)} ${delta > 0 ? "вниз" : "вверх"}: её нулевой стала выбранная ячейка. Цепочка не тронута. Вернуть — Undo.`);
  logStep("Начало паттернов", "", "", (delta > 0 ? "+" : "") + delta);
}

/* "➕🧩 Вставить ячейку паттернов" (#bPatInsertCell, v0.897, запрос пользователя "у паттернов также
   надо отдельно возможность удалять строку и добавлять через 0вую").
   Пара к "🗑🧩 Удалить ячейки паттернов": та выдёргивает ячейки и подтягивает колонку вверх, эта
   вставляет ПУСТУЮ и сдвигает всё ниже вниз — ровно то, что делает с цепочкой запись в нулевую
   строку, но только для колонки паттернов и не трогая цепочку.
   Куда вставлять: выделена ячейка — прямо на её место (она сама и всё ниже съезжает вниз); ничего
   не выделено — на нулевую ячейку колонки (индекс st.topBuilt), то есть колонка целиком уезжает на
   одну вниз. Хвост массива при этом обрезается до длины цепочки: ячеек не бывает больше, чем
   строк, а лишние всё равно нигде не показываются. */
function patInsertCellHere(){
  const zero = st.topBuilt || 0;
  const at = (st.selectedPats && st.selectedPats.size === 1) ? Array.from(st.selectedPats)[0] : zero;
  if (at < 0 || at > st.pats.length) { say("Вставить ячейку паттернов: непонятно куда — выдели одну ячейку колонки."); return; }
  snapshot();
  st.pats.splice(at, 0, { text: "", ord: at, found: false, kind: null, step: null });
  // ord — порядковый номер ячейки, по нему идут подписи и сортировки (см. patColumnZeroHere).
  st.pats.forEach((p, i) => { if (p) p.ord = i; });
  // Выделение переезжает вместе со своей ячейкой — она теперь на строку ниже.
  if (st.selectedPats && st.selectedPats.size) {
    st.selectedPats = new Set(Array.from(st.selectedPats).map(i => i >= at ? i + 1 : i));
  }
  render(); saveCache();
  say(`➕ Пустая ячейка паттернов вставлена на место ${rowLabel(at)}: колонка ниже съехала вниз. Цепочка не тронута. Вернуть — Undo или «🗑🧩 Удалить ячейки паттернов».`);
  logStep("Вставить ячейку паттернов", String(rowLabel(at)), "", "+1");
}

/* "⚖ Баланс: …" (#bBinBalance во вкладке "Вид", v0.863) — в каком виде печатать балансы строк
   (см. formatBalanceTotals в fold-2). Круг из пяти состояний: десятичный "1-0" (как было) → только
   «1» двоичным → только «0» двоичным → «1-0» двоичным → «0-1» двоичным. Чисто показ, данные не
   трогает; сама колонка балансов включается прежней кнопкой "⚖ Балансы". */
const BIN_BAL_NEXT = { "": "1", "1": "0", "0": "10", "10": "01", "01": "" };
const BIN_BAL_LABEL = { "": "10-й", "1": "2-й «1»", "0": "2-й «0»", "10": "2-й 1-0", "01": "2-й 0-1" };
function binBalanceToggle(){
  st.binBalance = BIN_BAL_NEXT[st.binBalance || ""] || "";
  updateBinBalanceBtn();
  render(); saveCache();
}
function updateBinBalanceBtn(){
  const b = document.getElementById("bBinBalance");
  if (!b) return;
  const m = st.binBalance || "";
  b.textContent = "⚖ Баланс: " + (BIN_BAL_LABEL[m] || "10-й");
  b.classList.toggle("mode-act", !!m);
}

/* "⚖ Балансы в цепочку" (#bBalanceToRows, v0.863, запрос пользователя "кнопку — балансы в
   цепочку") — каждая строка заменяется своим балансом В ДВОИЧНОМ ВИДЕ. Что именно кладётся,
   решает текущий вид кнопки "⚖ Баланс": только «1», только «0» или оба подряд (в выбранном
   порядке). При десятичном виде (кнопка выключена) кладём пару «1»+«0» — строка обязана остаться
   строкой из 0/1, десятичные цифры туда не годятся.
   Разделителя между двумя числами НЕТ намеренно: любой символ вне 0/1 выбьет строку из поиска и
   склеек. Идёт через общую textsToChainRows() — с ней же Undo, лог и обрезка пустого хвоста. */
function balancesToChainRows(){
  const mode = st.binBalance || "10";
  const texts = st.rows.map((s, i) => {
    if (!s) return "";
    const rb = computeRowBalance(s);
    const b1 = rb.total1.toString(2), b0 = rb.total0.toString(2);
    return mode === "1" ? b1 : mode === "0" ? b0 : mode === "01" ? (b0 + b1) : (b1 + b0);
  });
  textsToChainRows(texts, "Балансы");
}

/* "🔢 Номера вместо строк" (#bNumsAsRows) — «и вообще вместо цепочек чисто номера»: содержимое
   КАЖДОЙ строки заменяется её же номером в двоичном виде. Нулевая строка остаётся пустой (она
   граница построений, см. ensureZeroRow), достроенные сверху не трогаются. Операция
   разрушительная и обратной кнопки у неё нет — назад только Undo или Escape/Сброс (то есть "если
   не сохранил цепочку", как и просил пользователь). */
function numsAsRows(){
  snapshot();
  const zero = st.topBuilt || 0;
  let n = 0;
  st.rows = st.rows.map((s, i) => {
    if (i <= zero) return s;
    const num = numGlueLabel(i);
    if (!num) return s;
    n++;
    return num;
  });
  render(); saveCache();
  say(`🔢 Строки цепочки заменены своими номерами в двоичном виде: ${n} шт. Вернуть — Undo или Escape/Сброс (если цепочка не сохранена).`);
  logStep("Номера вместо строк", "", "", `${n} стр.`);
}
{
  const bNumToPatEl = document.getElementById("bNumToPat");
  if (bNumToPatEl) bNumToPatEl.onclick = numGlueToggle;
  const bNumToRowEl = document.getElementById("bNumToRow");
  if (bNumToRowEl) bNumToRowEl.onclick = numGlueRowsToggle;
  updateNumGlueRowsBtn();
  const bBinBalanceEl = document.getElementById("bBinBalance");
  if (bBinBalanceEl) bBinBalanceEl.onclick = binBalanceToggle;
  updateBinBalanceBtn();
  const bBalanceToRowsEl = document.getElementById("bBalanceToRows");
  if (bBalanceToRowsEl) bBalanceToRowsEl.onclick = balancesToChainRows;
  const bPatZeroHereEl = document.getElementById("bPatZeroHere");
  if (bPatZeroHereEl) bPatZeroHereEl.onclick = patColumnZeroHere;
  const bPatInsertCellEl = document.getElementById("bPatInsertCell");
  if (bPatInsertCellEl) bPatInsertCellEl.onclick = patInsertCellHere;
  const bPatNumLEl = document.getElementById("bPatNumL");
  if (bPatNumLEl) bPatNumLEl.onclick = () => togglePatNum("l");
  const bPatNumREl = document.getElementById("bPatNumR");
  if (bPatNumREl) bPatNumREl.onclick = () => togglePatNum("r");
  applyPatNumClasses();
  // change, а не input: пока цифру набирают, промежуточное значение (пустая строка, "0") дёргало
  // бы перерисовку всей цепочки на каждый символ.
  [["stairsGrpL", "stairsGroupL"], ["stairsGrpR", "stairsGroupR"],
   ["stairsStepL", "stairsStepL"], ["stairsStepR", "stairsStepR"]].forEach(pair => {
    const el = document.getElementById(pair[0]);
    if (el) el.onchange = () => readStairsGroup(pair[0], pair[1]);
  });
  applyStairsGroupInputs();
  const bNumsAsRowsEl = document.getElementById("bNumsAsRows");
  if (bNumsAsRowsEl) bNumsAsRowsEl.onclick = numsAsRows;
  updateNumGlueBtn();
}
/* НУЛЕВАЯ СТРОКА (запрос пользователя: "в 0 строке должно быть всегда 0 символов, паттерны
   загружать с 1 строки, и строку 0 не учитывать при построении вверх"). Строка с номером 0 — всегда
   ПУСТАЯ: она граница между построениями сверху (номера отрицательные) и настоящими данными
   (1, 2, 3…). Данные и паттерны шаблона начинаются с номера 1. Функция просто следит, что на этом
   месте действительно стоит пустая строка, и вставляет её, если её там нет; зовётся после любой
   загрузки данных (см. resetAll). Номер её индекса — st.topBuilt: выше только построения. */
function ensureZeroRow(keepPats){
  const at = st.topBuilt || 0;
  if (st.rows[at] === "") return;
  st.rows.splice(at, 0, "");
  st.used.splice(at, 0, false);
  // keepPats (v0.897, запрос пользователя "если через 0 строку добавляю, то паттерны не должны
  // ехать вниз") — колонка паттернов остаётся на месте: пустую ячейку добавляем в КОНЕЦ, только
  // чтобы длины массивов сошлись. Так зовёт ТОЛЬКО правка нулевой строки руками: там растёт
  // цепочка, паттерны к этому отношения не имеют, у них своя нулевая (см. patInsertCellHere).
  // Без флага (загрузка данных, Сброс, удаление строк) пустая ячейка по-прежнему вставляется НА
  // ТО ЖЕ место — там паттерн N обязан остаться напротив строки N шаблона.
  // keepPats === "none" (v0.958, запрос пользователя: "при удалении из строк цепочек не надо
  // ничего удалять и менять в паттернах") — колонку паттернов не трогаем ВООБЩЕ, даже пустой
  // ячейкой в хвосте. Так зовёт удаление строк (deleteSelectedRows): там паттерны живут своим
  // выделением, и возврат нулевой строки к ним отношения не имеет. Длины массивов при этом
  // расходятся — это штатно, render() считает число строк как Math.max(rows.length, pats.length);
  // а вот лишняя ячейка в конце дорисовала бы внизу пустую строку, то есть тоже "меняла" колонку.
  if (keepPats === "none") { /* паттерны не трогаем */ }
  else if (keepPats) st.pats.push({ text: "", ord: st.pats.length, found: false, kind: null, step: null });
  else st.pats.splice(at, 0, { text: "", ord: at, found: false, kind: null, step: null });
  if (st.selectedRows && st.selectedRows.size) {
    st.selectedRows = new Set(Array.from(st.selectedRows).map(r => r >= at ? r + 1 : r));
  }
  if (st.rowDividers && st.rowDividers.size) {
    st.rowDividers = new Set(Array.from(st.rowDividers).map(d => d >= at ? d + 1 : d));
  }
}
/* Зеркальная достройка ВВЕРХ: берём настоящие строки от первой до выделенной, их длины
   переворачиваем и кладём наверх столько же строк из нулей. Для 1/11/111 сверху появляются 000/00/0
   — то есть фигура отражается по горизонтали, но пустая (нулями), а не копией бит.
   mode "rebuild" — весь верх строится заново по текущему выделению; mode "append" — дописывается
   ОДНА строка на самый верх, под уже имеющиеся построения не подмешиваясь (запрос пользователя:
   "переписывать каждый раз верх отражение или дописывать новую строку"). */
function buildTopMirror(mode, keepSel){
  const built = st.topBuilt || 0;
  // Ориентир — САМАЯ НИЖНЯЯ выделенная строка с данными; выделение на нулевой или построенной
  // строке ориентиром быть не может.
  let selReal = -1;
  if (st.selectedRows) for (const r of st.selectedRows) if (r > built && r > selReal) selReal = r;
  const anchor0 = selReal >= 0 ? selReal : st.rows.length - 1;
  if (anchor0 <= built) {
    say("Достроение вверх: выделите строку с данными — номер 1 или ниже (нулевая строка всегда пустая и в построении не участвует).");
    return;
  }
  const multiSel = st.selectedRows ? Array.from(st.selectedRows).filter(r => r > built).length > 1 : false;
  // ШАГ ВНИЗ ДЕЛАЕТСЯ ДО ПОСТРОЕНИЯ (запрос пользователя: "не должно быть, что выделение на 4-й
  // строке, а вверху только 3 — надо 4"). keepSel (сработало само — по выделению строки мышью или
  // стрелкой) шага не делает: там строку выбрал пользователь.
  let anchor = anchor0;
  if (!keepSel && anchor + 1 < st.rows.length) anchor++;
  const need = anchor - built; // сколько зеркал нужно для строк 1..выделенная
  if (!need) { say("Достроение вверх: отражать нечего."); return; }
  snapshot();
  let shift = 0;
  if (built < need) {
    const add = need - built;
    const blanks = new Array(add).fill("");
    st.rows.splice(0, 0, ...blanks);
    st.used.splice(0, 0, ...blanks.map(() => false));
    st.pats.splice(0, 0, ...blanks.map(() => ({ text: "", ord: -1, found: false, kind: null, step: null })));
    st.topBuilt = need;
    shift = add;
  }
  // built > need — НИЧЕГО НЕ СНИМАЕМ (запрос пользователя: "если уже есть построение верхнее на
  // меньшую высоту, пусть просто затемняет и исключает из поиска, а не удаляет и строит заново").
  // Лишние зеркала остаются на месте, их и так не видно в расчётах: всё выше границы участия
  // затемнено и отдаёт пустую строку любому режиму (см. firstActiveRow/getRowBits).
  if (shift) {
    if (st.selectedRows && st.selectedRows.size) {
      st.selectedRows = new Set(Array.from(st.selectedRows).map(r => r + shift).filter(r => r >= 0));
    }
    if (st.rowDividers && st.rowDividers.size) {
      st.rowDividers = new Set(Array.from(st.rowDividers).map(d => d + shift).filter(d => d >= 0));
    }
    shiftRowMaps(shift);
  }
  // Раскладка: 0..B-1 — зеркала, B — нулевая строка, B + L — строка с номером L. Значит источник
  // зеркала j (сверху вниз) лежит в 2*B - j.
  const B = st.topBuilt || 0;
  const anchor2 = anchor + shift;
  let filled = 0;
  for (let j = 0; j < B; j++) {
    // Новое зеркало заполняем всегда; уже стоявшее — только в режиме "переписывать" (в режиме
    // "дописывать" построенное не трогаем, даже если строка-источник изменилась).
    const isNew = shift > 0 && j < shift;
    if (!isNew && mode !== "rebuild") continue;
    const srcIdx = 2 * B - j;
    if (srcIdx >= st.rows.length) continue;
    const val = topMirrorOf(st.rows[srcIdx]);
    if (st.rows[j] === val) continue;
    st.rows[j] = val;
    insertedFlagsMap.delete(j);
    invFlagsMap.delete(j);
    // Построенное сверху зеркало — строка «новых бит» целиком (см. newBitsMap).
    newBitsWhole(j, val.length);
    filled++;
  }
  const nextAnchor = anchor2;
  if (keepSel) {
    // АВТОМАТИЧЕСКАЯ достройка выделение не трогает вовсе — оно только съехало вместе с данными при
    // вставке строк сверху. Раньше тут срабатывало расширение, и после захвата находки (он выделяет
    // несколько строк) выделение накрывало ВСЕ построенные строки разом (запрос пользователя:
    // "выделение при захвате нижней — баг, на все верхние попадает").
  } else if (multiSel) {
    // Ручное нажатие, а выделено было несколько строк данных — расширяем ПО САМИМ ДАННЫМ: от первой
    // строки цепочки до той, под которую построили. Зеркала в выделение не берём: это не строки
    // цепочки, а её отражение, и работать с ними как со строками незачем.
    const B = st.topBuilt || 0;
    const ns = new Set();
    for (let r = B + 1; r <= nextAnchor; r++) ns.add(r);
    st.selectedRows = ns;
  } else {
    st.selectedRows = new Set([nextAnchor]);
  }
  maskChangedMap.clear(); maskBaseRows = null;
  st.hit = null;
  const extra = Math.max(0, B - need);
  say(`Достроение вверх: работает ${need} зеркал` + (shift ? `, дописано ${shift}` : "") +
      (extra ? `, ещё ${extra} сверху затемнены и в поиск не идут` : "") +
      `, обновлено строк ${filled}. Выделение — на строке ${rowLabel(nextAnchor)}.`);
  logStep("Достроение вверх", `-${need}…-1`, "", `зеркал ${need}, обновлено ${filled}`);
  // Только что построенное — это и есть то состояние, к которому Сброс/Escape потом возвращает
  // верх (см. topBaseCapture ниже).
  topBaseCapture();
  render(); saveCache();
}
/* СЛЕПОК ПОСТРОЕННЫХ СВЕРХУ СТРОК — то состояние, к которому Сброс/Escape их возвращает (запрос
   пользователя: "все построения в реальных строках должны сбрасываться Ресетом, Ескейпом, если их
   не сохранить специально"). Настоящие строки Сброс и так пересобирает из шаблона/💾-сохранёнки, а
   вот построенные сверху он НЕ УДАЛЯЕТ (более ранний запрос: "Escape пусть не удаляет верхние
   построения, только сбрасывает биты") — и всё, что в них потом дописали руками (Тетрис, "Зеркало
   шагами", вписанные зеркала, сдвиги), оставалось в них навсегда: в режиме "дописывать"
   refreshTopMirrors() их намеренно не трогает. Теперь Сброс возвращает им ровно те биты, что были
   на момент постройки: сами строки на месте, чужих правок в них нет.
   Слепок живёт в памяти сессии (в кэш не пишется): после перезагрузки страницы построенное
   становится своей же базой — см. topBaseCapture() при загрузке вкладки. */
let topBaseRows = [];
function topBaseCapture(){
  const need = st.topBuilt || 0;
  topBaseRows = need ? st.rows.slice(0, need) : [];
}
function topBaseRestore(){
  const need = st.topBuilt || 0;
  // Слепок снят под другое число построений (успели построить/убрать после него) — восстанавливать
  // нечего, лучше оставить как есть, чем разложить чужие биты не по тем строкам.
  if (!need || topBaseRows.length !== need) return 0;
  let n = 0;
  for (let j = 0; j < need; j++){
    if (st.rows[j] === topBaseRows[j]) continue;
    st.rows[j] = topBaseRows[j];
    invFlagsMap.delete(j);
    n++;
  }
  return n;
}
/* Убрать ВСЕ построения сверху — цепочка снова начинается со своей настоящей первой строки. */
/* ОБНОВИТЬ СОДЕРЖИМОЕ ЗЕРКАЛ под текущие строки-источники. Нужно в режиме "переписывать": нижние
   строки крутятся (◄/► вручную и под "Авто"), и зеркало обязано следовать за своим источником —
   иначе верх показывает вчерашнее состояние и с ним же участвует в поиске (запрос пользователя).
   В режиме "дописывать" построенное не трогаем: там это осознанный снимок.
   Раскладка канонична (см. buildTopMirror): 0..need-1 — зеркала, need — нулевая строка, need + L —
   строка с номером L, поэтому источник зеркала j лежит в 2*need - j. */
/* Сдвинуть все КАРТЫ, ключом которых служит НОМЕР СТРОКИ, на delta. Построения вверх вставляются
   и снимаются СВЕРХУ, поэтому индексы всех строк ниже съезжают — а карты продолжали бы указывать на
   прежние номера, то есть на чужие строки. Больнее всего это било по "◄/►Круг Инв": он крутит не
   только биты, но и флаги перевёрнутых бит (invFlagsMap), и со съехавшими флагами инверсия
   применялась не к тем битам (запрос пользователя: "ломает изменение битов при КругИнв").
   Ключи, ушедшие в минус (строки, которых больше нет), выбрасываем. */
function shiftRowMaps(delta){
  if (!delta) return;
  const maps = [insertedFlagsMap, invFlagsMap, newBitsMap, maskChangedMap, axisOffsetMap, axisBitShiftMap, axisBitDirMap, rowRotOffMap, mirrorsRowDone];
  for (const m of maps) {
    if (!m || !m.size) continue;
    const moved = [];
    for (const [k, v] of m) moved.push([k + delta, v]);
    m.clear();
    for (const kv of moved) if (kv[0] >= 0) m.set(kv[0], kv[1]);
  }
}
/* ЧЕМ ЗАПОЛНЯЕТСЯ ПОСТРОЕННАЯ СТРОКА (запрос пользователя: "кнопку — достраивает вверх не инверсию,
   а реверс-инверсию"): "inv" — просто инверсия строки-источника (0↔1), "revinv" — инверсия ПЛЮС
   разворот порядка бит. Одна функция на все места, где зеркало заполняется, чтобы достройка и
   обновление зеркал никогда не разошлись. */
function topMirrorOf(src){
  const t = src || "";
  if (st.topBuildKind === "revinv") return invertBits(reverseStr(t)); // инверсия + разворот
  if (st.topBuildKind === "rev") return reverseStr(t);                // только разворот, биты как есть
  return invertBits(t);                                               // только инверсия (по умолчанию)
}
function refreshTopMirrors(){
  const need = st.topBuilt || 0;
  if (!need || (st.topBuildMode || "rebuild") !== "rebuild") return 0;
  let n = 0;
  for (let j = 0; j < need; j++) {
    const val = topMirrorOf(st.rows[2 * need - j]);
    if (st.rows[j] === val) continue;
    st.rows[j] = val;
    n++;
  }
  // Пересобранный верх — новая база для Сброса (в режиме "переписывать" он и так следует за
  // источниками, а вот дописанного руками в нём после этого нет).
  if (n) topBaseCapture();
  return n;
}
function clearTopBuilt(){
  const built = st.topBuilt || 0;
  if (!built) { say("Убрать построения: их и нет."); return; }
  snapshot();
  st.rows.splice(0, built);
  st.used.splice(0, built);
  st.pats.splice(0, built);
  st.topBuilt = 0;
  topBaseCapture(); // построений нет — и базы для Сброса тоже
  shiftRowMaps(-built);
  // Нулевая строка построением НЕ является — она остаётся на месте и просто снова становится
  // самой верхней (см. ensureZeroRow).
  if (st.selectedRows && st.selectedRows.size) {
    st.selectedRows = new Set(Array.from(st.selectedRows).map(r => r - built).filter(r => r >= 0));
  }
  if (st.rowDividers && st.rowDividers.size) {
    st.rowDividers = new Set(Array.from(st.rowDividers).map(d => d - built).filter(d => d >= 0));
  }
  insertedFlagsMap.clear();
  invFlagsMap.clear();
  maskChangedMap.clear(); maskBaseRows = null;
  st.hit = null;
  say(`Построения убраны: снято ${built} стр. сверху.`);
  logStep("Убрать построения", "", "", `${built} стр.`);
  render(); saveCache();
}
/* Как достраивать, когда верх уже построен: "rebuild" — переписывать отражение целиком,
   "append" — дописывать по одной строке (см. #bTopBuildMode). */
function setTopBuildMode(m, quiet){
  st.topBuildMode = m;
  const b = document.getElementById("bTopBuildMode");
  if (b) {
    b.classList.toggle("mode-act", m === "append");
    b.textContent = m === "append" ? "↕ Верх: дописывать" : "↕ Верх: переписывать";
  }
  if (!quiet) say(m === "append"
    ? "Достроение вверх будет ДОПИСЫВАТЬ по одной строке, не трогая уже построенные."
    : "Достроение вверх будет ПЕРЕПИСЫВАТЬ весь верх отражением заново.");
}
/* "⬆ При находке" — достраивать вверх АВТОМАТИЧЕСКИ, как только фон-поиск нашёл совпадение
   (запрос пользователя). Работает во время прогона "🚀 Авто": на каждой находке делается ровно то
   же, что делает кнопка "⬆ Достроить вверх" в текущем режиме (переписывать/дописывать). Вне
   прогона ничего не меняется — там достройка по-прежнему только по нажатию. */
/* ОДНА АВТОДОСТРОЙКА "ПО НАХОДКЕ" — общий код для всех мест, где находка обнаружена: прогон
   "🚀 Авто", ручной круговой сдвиг ◄/►, "🧩 Паттерн-цепочка". Возвращает, на сколько строк съехали
   индексы (строки вставляются СВЕРХУ), чтобы вызывающий поправил свои запомненные номера строк.
   Выключено — не делает ничего и возвращает 0. */
function topBuildOnHitStep(){
  if (!st.topBuildOnHit) return 0;
  const before = st.rows.length;
  // keepSel: АВТОМАТИЧЕСКАЯ достройка выделение НЕ ДВИГАЕТ. Без этого она уводила выделение на
  // строку вниз на каждой находке — и следующий ◄/► крутил уже другую строку, из-за чего сдвиги
  // при включённой опции выглядели как неработающие (запрос пользователя). Шаг вниз остаётся
  // только у ручного нажатия кнопки.
  buildTopMirror(st.topBuildMode || "rebuild", true);
  return st.rows.length - before;
}
function setTopBuildOnHit(on, quiet){
  st.topBuildOnHit = !!on;
  const b = document.getElementById("bTopBuildOnHit");
  if (b) {
    b.classList.toggle("mode-act", st.topBuildOnHit);
    b.textContent = st.topBuildOnHit ? "🎯 При находке: достраивать" : "🎯 При находке: не трогать";
  }
  if (!quiet) {
    say(st.topBuildOnHit
      ? "Достроение вверх будет срабатывать САМО на каждой находке фон-поиска под «Авто»."
      : "Достроение вверх снова только по нажатию кнопки.");
    saveCache();
  }
}
const bTopBuildOnHitEl = document.getElementById("bTopBuildOnHit");
if (bTopBuildOnHitEl) bTopBuildOnHitEl.onclick = () => setTopBuildOnHit(!st.topBuildOnHit);

/* "✋ Вручную: всегда / только при находке" — условие для РУЧНОГО нажатия кнопки достройки
   (запрос пользователя: "чтобы достройка вручную только при находке срабатывала, если нет — то
   стоп"). Автодостройку по находке (#bTopBuildOnHit) эта настройка не касается вовсе. */
function setTopBuildNeedHit(on, quiet){
  st.topBuildNeedHit = !!on;
  const b = document.getElementById("bTopBuildNeedHit");
  if (b) {
    b.classList.toggle("mode-act", st.topBuildNeedHit);
    b.textContent = st.topBuildNeedHit ? "✋ Вручную: только при находке" : "✋ Вручную: всегда";
  }
  if (!quiet) {
    say(st.topBuildNeedHit
      ? "«⬆ Достроить вверх» теперь сработает только когда фон-поиск нашёл паттерн."
      : "«⬆ Достроить вверх» снова строит по нажатию в любом случае.");
    saveCache();
  }
}
/* "🖱 По выделению" — достраивать вверх сразу, как только строку выделили мышью (запрос
   пользователя). Режим достройки берётся текущий; выделение остаётся на щёлкнутой строке. */
function setTopBuildOnSelect(on, quiet){
  st.topBuildOnSelect = !!on;
  const b = document.getElementById("bTopBuildOnSelect");
  if (b) {
    b.classList.toggle("mode-act", st.topBuildOnSelect);
    b.textContent = st.topBuildOnSelect ? "🖱 По выделению: достраивать" : "🖱 По выделению: не трогать";
  }
  if (!quiet) {
    say(st.topBuildOnSelect
      ? "Верх будет достраиваться сразу при выделении строки мышью."
      : "Достройка по выделению выключена.");
    saveCache();
  }
}
/* "⬇ Расширять вниз" — на каждой находке добавлять к выделению строку ПОД ним, ничего не снимая
   сверху (запрос пользователя). Отличие от "🧲 Захват находки": тот у выделения, набранного
   руками, ведёт окно постоянного размера — добавляет снизу, снимает сверху. Здесь блок только
   растёт. Включён — сильнее "Захвата" (он в этом случае окном не едет). */
function setGrowDownOnFind(on, quiet){
  st.growDownOnFind = !!on;
  const b = document.getElementById("bGrowDownOnFind");
  if (b) {
    b.classList.toggle("mode-act", st.growDownOnFind);
    b.textContent = st.growDownOnFind ? "⬇ Расширять вниз: вкл" : "⬇ Расширять вниз: выкл";
  }
  if (!quiet) {
    say(st.growDownOnFind
      ? "Выделение будет расти ВНИЗ на каждой находке — верхняя граница остаётся на месте."
      : "Расширение выделения вниз выключено.");
    saveCache();
  }
}
const bGrowDownOnFindEl = document.getElementById("bGrowDownOnFind");
if (bGrowDownOnFindEl) bGrowDownOnFindEl.onclick = () => setGrowDownOnFind(!st.growDownOnFind);
/* "◀ Зеркало влево" — чистая настройка показа, данные не трогает (см. .lm-bit в CSS и render). */
/* "⇅ Вид: инверсия / реверс+инв" — переключатель заполнения построенных строк (см. topMirrorOf). */
const TOP_BUILD_KINDS = ["inv", "revinv", "rev"]; // порядок перебора по нажатиям кнопки
function setTopBuildKind(k, quiet){
  st.topBuildKind = TOP_BUILD_KINDS.indexOf(k) >= 0 ? k : "inv";
  const b = document.getElementById("bTopBuildKind");
  if (b) {
    b.classList.toggle("mode-act", st.topBuildKind !== "inv");
    b.textContent = st.topBuildKind === "revinv" ? "⇅ Вид: реверс+инв"
      : st.topBuildKind === "rev" ? "⇅ Вид: реверс"
      : "⇅ Вид: инверсия";
  }
  if (!quiet) {
    say(st.topBuildKind === "revinv" ? "Вверх достраивается ИНВЕРСИЯ + РЕВЕРС строки-источника."
      : st.topBuildKind === "rev" ? "Вверх достраивается РЕВЕРС строки-источника, биты как есть."
      : "Вверх достраивается инверсия строки-источника.");
    // В режиме "переписывать" верх пересобирается сразу под новый вид.
    refreshTopMirrors();
    render(); saveCache();
  }
}
/* "⤡ Диагональ осей" — три состояния (см. кнопку bAxisDiagCols): 0 выкл, 1 наклон по самой
   лестнице, −1 зеркальный. Подпись всегда показывает РЕАЛЬНОЕ направление (стрелку берём из
   axisDiagSlope2x на текущем выравнивании), а не абстрактное "прямо/обратно": на не-"½"
   выравниваниях диагонали нет вообще, и кнопка честно says об этом. */
const AXIS_DIAG_MODES = [0, 1, -1]; // порядок перебора по нажатиям
function setAxisDiagCols(m, quiet){
  st.axisDiagCols = AXIS_DIAG_MODES.indexOf(m | 0) >= 0 ? (m | 0) : 0;
  const b = document.getElementById("bAxisDiagCols");
  const slope = axisDiagSlope2x(st.align);
  if (b) {
    b.classList.toggle("mode-act", !!st.axisDiagCols);
    b.textContent = !st.axisDiagCols ? "⤡ Диагональ осей: выкл"
      : slope > 0 ? "⤡ Диагональ осей: ↘"
      : slope < 0 ? "⤡ Диагональ осей: ↙"
      : "⤡ Диагональ осей: не на этом выравн.";
  }
  if (!quiet) {
    say(!st.axisDiagCols
      ? "Диагональ осей выключена: ось снова обычный вертикальный столбец."
      : (slope
          ? `Ось идёт диагональю ${slope > 0 ? "вправо-вниз ↘" : "влево-вниз ↙"} с шагом ½ столбца на строку — попадает в биты строк любой чётности. Ещё нажатие: ${st.axisDiagCols > 0 ? "перевернуть наклон" : "выключить"}.`
          : "Диагональ осей включена, но работает только на «½»-выравниваниях (Центр ½ / Лесенка ½ / Лесенка правая ½) — на нынешнем ось осталась вертикальной."));
    render(); saveCache();
  }
}
const bAxisDiagColsEl = document.getElementById("bAxisDiagCols");
if (bAxisDiagColsEl) bAxisDiagColsEl.onclick = () => {
  // Перебор по кругу: выкл → своё направление → зеркальное → снова выкл.
  const cur = AXIS_DIAG_MODES.indexOf(st.axisDiagCols | 0);
  setAxisDiagCols(AXIS_DIAG_MODES[(cur + 1) % AXIS_DIAG_MODES.length]);
};
const bTopBuildKindEl = document.getElementById("bTopBuildKind");
if (bTopBuildKindEl) bTopBuildKindEl.onclick = () => {
  // Перебор по кругу: инверсия → реверс+инверсия → реверс → снова инверсия.
  const cur = TOP_BUILD_KINDS.indexOf(st.topBuildKind || "inv");
  setTopBuildKind(TOP_BUILD_KINDS[(cur + 1) % TOP_BUILD_KINDS.length]);
};
function setLeftMirror(on, quiet){
  st.leftMirror = !!on;
  const b = document.getElementById("bLeftMirror");
  if (b) b.classList.toggle("mode-act", st.leftMirror);
  if (!quiet) {
    say(st.leftMirror
      ? `Зеркало влево показано серым: ${mirrorKindWord("l")} — от её первого бита, сам бит не в счёт.`
      : "Зеркало влево убрано.");
    render(); saveCache();
  }
}
function setRightMirror(on, quiet){
  st.rightMirror = !!on;
  const b = document.getElementById("bRightMirror");
  if (b) b.classList.toggle("mode-act", st.rightMirror);
  if (!quiet) {
    say(st.rightMirror
      ? `Зеркало вправо показано серым: ${mirrorKindWord("r")} — от её последнего бита, сам бит не в счёт.`
      : "Зеркало вправо убрано.");
    render(); saveCache();
  }
}
/* Словами, что сейчас кладётся в зеркало ЭТОЙ стороны — для сообщений кнопок зеркал. */
function mirrorKindWord(side){
  const k = mirrorKindOf(side);
  return k === "rev" ? "реверс строки, биты как есть"
    : k === "inv" ? "инверсия строки без разворота"
    : k === "none" ? "копия строки как есть"
    : "реверс строки с инверсией бит";
}
/* "⇔ Вид ◀" / "⇔ Вид ▶" — чем заполняется зеркало КАЖДОЙ стороны, у левого и правого по
   отдельности (запрос пользователя: "для лев, прав — отдельно"; сначала вид был один на обе).
   Действует сразу везде: серый показ, поиск по зеркалам и "⇔ Вписать зеркала в строки" — все
   трое зовут mirrorSideBits() из ядра. Длина зеркала от вида не зависит, поэтому картинка при
   переключении не дёргается: меняются только сами биты. */
function setMirrorKind(side, k, quiet){
  const right = side === "r";
  const val = MIRROR_KINDS.indexOf(k) >= 0 ? k : "revinv";
  if (right) st.mirrorKindR = val; else st.mirrorKindL = val;
  const b = document.getElementById(right ? "bMirrorKindR" : "bMirrorKindL");
  if (b) {
    b.classList.toggle("mode-act", val !== "revinv");
    b.textContent = "⇔ Вид " + (right ? "▶" : "◀") + ": " + (val === "rev" ? "реверс"
      : val === "inv" ? "инверсия" : val === "none" ? "копия" : "реверс+инв");
  }
  if (!quiet) {
    const who = right ? "Правое" : "Левое";
    say(val === "rev" ? `${who} зеркало: только РЕВЕРС — строка отражается, биты остаются как есть.`
      : val === "inv" ? `${who} зеркало: только ИНВЕРСИЯ — порядок бит как в строке, значения 0↔1.`
      : val === "none" ? `${who} зеркало: КОПИЯ строки как есть — ни реверса, ни инверсии.`
      : `${who} зеркало: РЕВЕРС + ИНВЕРСИЯ — как было по умолчанию.`);
    render(); saveCache();
  }
}
/* "⊘ Ось ◀" / "⊘ Ось ▶" — убрать САМ опорный бит зеркала этой стороны (первый бит строки у
   левого, последний у правого). Выкл ("оставить") — как было всегда: бит в зеркало не входит, но
   в строке остаётся единственным центром симметрии. Вкл ("убрать") — бита нет вовсе, половинки
   смыкаются (запрос пользователя "ещё для каждой удалять осевой бит"). Как и вид зеркала,
   действует сразу везде: серый показ (см. cutHead/cutTail в render), поиск по зеркалам
   (mirrorCoreBits в mirroredRowBits) и "⇔ Вписать зеркала в строки" — там бит удаляется уже
   по-настоящему, из данных. У каждой стороны свой флаг. */
function setMirrorCutAxis(side, on, quiet){
  const right = side === "r";
  const val = !!on;
  if (right) st.mirrorCutAxisR = val; else st.mirrorCutAxisL = val;
  const b = document.getElementById(right ? "bMirrorCutR" : "bMirrorCutL");
  if (b) {
    b.classList.toggle("mode-act", val);
    b.textContent = "⊘ Ось " + (right ? "▶" : "◀") + ": " + (val ? "убрать" : "оставить");
  }
  if (!quiet) {
    const who = right ? "правого" : "левого";
    const bit = right ? "последний" : "первый";
    say(val
      ? `Осевой бит ${who} зеркала (${bit} бит строки) убирается — зеркало смыкается с остатком строки без центра.`
      : `Осевой бит ${who} зеркала (${bit} бит строки) остаётся на месте — как было.`);
    render(); saveCache();
  }
}
[["l", "bMirrorCutL"], ["r", "bMirrorCutR"]].forEach(([side, id]) => {
  const el = document.getElementById(id);
  if (el) el.onclick = () => setMirrorCutAxis(side, !(side === "r" ? st.mirrorCutAxisR : st.mirrorCutAxisL));
});
[["l", "bMirrorKindL"], ["r", "bMirrorKindR"]].forEach(([side, id]) => {
  const el = document.getElementById(id);
  // Перебор по кругу: реверс+инв → реверс → инверсия → копия → снова реверс+инв.
  if (el) el.onclick = () => {
    const cur = MIRROR_KINDS.indexOf(mirrorKindOf(side));
    setMirrorKind(side, MIRROR_KINDS[(cur + 1) % MIRROR_KINDS.length]);
  };
});
/* "⇔ Вписать зеркала в строки" — превратить показ в данные (запрос пользователя: "включить зеркала
   в поиск и вообще в строки"). До этого зеркала были чистой картинкой: серые биты рисовались в
   отступах и никуда не шли. Здесь они дописываются к самой строке — слева и/или справа, смотря что
   включено, — и дальше живут как обычные биты: ищутся, склеиваются, участвуют в XOR.
   Показ зеркал сразу выключается: иначе следующий же кадр нарисовал бы вокруг удлинённых строк
   зеркала зеркал, и понять, где данные, стало бы невозможно. */
/* silent — не сообщать "вписывать нечего": так зовут те, кто дёргает вписывание САМ, без прямого
   нажатия кнопки (автомат по захвату и подготовка к Кругу, см. mirrorsBeforeShift) — для них
   "уже всё вписано" нормальное состояние, а не повод писать в лог на каждом шаге. */
function applyMirrorsToRows(keepShow, sides, silent){
  // Стороны задаются ЯВНО (запрос пользователя: "нужно отдельные, иначе зеркало на зеркале").
  // Ручная кнопка берёт их у показа — вписывает ровно то, что видно; автоматика имеет свою
  // настройку сторон и от показа не зависит вовсе, поэтому не плодит зеркало на зеркале.
  const useLeft = sides ? !!sides.left : !!st.leftMirror;
  const useRight = sides ? !!sides.right : !!st.rightMirror;
  if (!useLeft && !useRight) {
    say(sides
      ? "Авто-зеркала: не выбрана сторона."
      : "Вписать зеркала: сначала включите «◀ Зеркало влево» и/или «▶ Зеркало вправо».");
    return;
  }
  // Та же граница, что и у показа: нужна выделенная строка, и вписываем по неё включительно, сверху
  // вниз. Без выделения вписывать нечего — на экране зеркал в этот момент тоже нет.
  const mirrorTo = (st.selectedRows && st.selectedRows.size) ? Math.max(...st.selectedRows) : -1;
  if (mirrorTo < 0) { say("Вписать зеркала: сначала выделите строку — зеркала строятся до неё сверху."); return; }
  // ПРЕДЕЛ СЧИТАЕТСЯ ПО КАЖДОЙ СТРОКЕ ОТДЕЛЬНО (mirrorsRowDone), а не одним счётчиком на всю
  // сессию. Общий счётчик означал "вписали один раз где угодно — и больше никогда": первое же
  // вписывание (в том числе автоматическое перед ручным Кругом, см. mirrorsBeforeShift) съедало
  // весь запас, и на следующих захватах зеркала уже не строились (запрос пользователя — "не
  // строит, не всегда"). По строкам предел работает так, как и задумывался: зеркало на зеркале не
  // появляется, каждая строка обрастает им не больше N раз, а КАЖДАЯ НОВАЯ захваченная строка своё
  // зеркало получает сразу. Рост при этом ограничен ровно так же (строка длиннее втрое, не больше
  // N раз), поэтому предохранитель по общему размеру ниже остаётся на месте.
  const maxApply = (st.mirrorsAutoMax == null) ? 1 : st.mirrorsAutoMax;
  const plan = [];
  let blocked = 0;
  // Вписывается ровно то, что ВИДНО: выделена одна строка — только её зеркало (см. mirrorTopRow).
  for (let r = mirrorTopRow(); r <= mirrorTo && r < st.rows.length; r++) {
    const s0 = st.rows[r] || "";
    if (s0.length < 2) continue; // из одного бита зеркала не выходит: сам бит в него не входит
    if ((mirrorsRowDone.get(r) || 0) >= maxApply) { blocked++; continue; }
    const left = useLeft ? mirrorSideBits(s0.slice(1), "l") : "";
    const right = useRight ? mirrorSideBits(s0.slice(0, -1), "r") : "";
    if (!left && !right) continue;
    // "⊘ Ось ◀/▶": опорный бит той стороны, что режет, из строки УДАЛЯЕТСЯ — тут по-настоящему,
    // в данных (на экране он просто не печатался, см. cutHead/cutTail в render). Стороны берутся
    // из useLeft/useRight, а не из st.leftMirror: автомат вписывает свои стороны, не те, что
    // показаны.
    const cutA = (useLeft && st.mirrorCutAxisL) ? 1 : 0;
    const cutB = (useRight && st.mirrorCutAxisR) ? 1 : 0;
    const core = (s0.length - cutB > cutA) ? s0.slice(cutA, s0.length - cutB) : "";
    // Хвостом кладём то, что нужно пометке «новые биты» (см. newBitsWrap ниже): сколько бит
    // приписано слева, сколько справа и какой длины остался сам корень строки.
    plan.push([r, left + core + right, left.length + right.length - cutA - cutB, left.length, right.length, core.length]);
  }
  if (!plan.length) {
    // Автомат молчит: он зовётся на каждом захвате, и "нечего вписывать" — его нормальное
    // состояние (все строки участка уже со своими зеркалами).
    if (!silent && !sides) {
      say(blocked
        ? `Вписать зеркала: во все строки участка зеркала уже вписаны по ${maxApply} раз(а). Увеличьте число рядом с кнопкой или сбросьте счёт «↺ Сбросом».`
        : "Вписать зеркала: подходящих строк нет (нужны строки хотя бы из двух бит).");
    }
    return;
  }
  // ПРЕДОХРАНИТЕЛЬ ПО РАЗМЕРУ: каждое вписывание удлиняет строку почти втрое, и на серии находок
  // цепочка легко раздувается до полной неработоспособности. Считаем итог заранее и отказываемся,
  // если он переходит границу разумного, — лучше сообщение, чем повисший браузер.
  const MIRRORS_MAX_BITS = 2000000;
  let totalAfter = 0;
  for (let r = 0; r < st.rows.length; r++) totalAfter += (st.rows[r] || "").length;
  for (const pr of plan) totalAfter += pr[2];
  if (totalAfter > MIRRORS_MAX_BITS) {
    say(`Вписать зеркала: отменено — получилось бы ${totalAfter} бит, это уже неподъёмно. Уменьшите участок или сбросьте цепочку.`);
    return;
  }
  snapshot();
  let added = 0;
  for (const pr of plan) {
    st.rows[pr[0]] = pr[1];
    added += pr[2];
    // Счёт вписываний ведётся по КАЖДОЙ строке отдельно (см. предел выше).
    mirrorsRowDone.set(pr[0], (mirrorsRowDone.get(pr[0]) || 0) + 1);
    // Длина строки изменилась — позиционные флаги к ней больше не относятся.
    insertedFlagsMap.delete(pr[0]);
    invFlagsMap.delete(pr[0]);
    // Вписанные зеркала — те же «новые биты», что и у построений (запрос пользователя: "такое же
    // поведение цветов для зеркал"): красятся своим цветом и держатся после сохранения.
    newBitsWrap(pr[0], pr[5], pr[3], pr[4]);
  }
  maskChangedMap.clear(); maskBaseRows = null;
  st.hit = null;
  // keepShow — вызвано АВТОМАТОМ (см. mirrorsAutoStep): показ не выключаем, иначе следующее
  // расширение выделения уже нечего было бы вписывать.
  // Ручное нажатие гасит ТОЛЬКО показ ◀/▶ (запрос пользователя). "⇔ Авто-зеркала" и "⇔ Место
  // под зеркала" не трогаем — это отдельные режимы, и снимать их за пользователя не надо.
  if (!keepShow) {
    setLeftMirror(false, true);
    setRightMirror(false, true);
  }
  say(`Зеркала вписаны в строки: ${plan.length} стр., добавлено ${added} бит. Теперь они участвуют в поиске и склейках; показ зеркал выключен.`);
  logStep("Вписать зеркала", plan.map(pr => rowLabel(pr[0])).join(","), "", `${plan.length} стр., +${added} бит`);
  render(); saveCache();
}
/* "⇔ Авто-зеркала" — строить зеркала и сразу вписывать их в строки, как только выделение
   РАСШИРИЛОСЬ захватом находки (запрос пользователя). Показ при этом не выключается: цикл должен
   повторяться на каждой следующей находке. Работает только если включено хотя бы одно зеркало —
   иначе непонятно, какую сторону вписывать. */
/* СКОЛЬКО РАЗ автоматика может вписать зеркала. По умолчанию ОДИН (запрос пользователя: "нужна
   настройка по умолчанию 1 — одно зеркало максимум строить влево и вправо"). Каждое вписывание
   удлиняет строку примерно втрое, поэтому без предела серия находок раздувала цепочку до
   неработоспособности — браузер вставал, и перезагрузка не помогала, потому что раздутые строки
   уже лежали в кэше. Счётчик обнуляется Сбросом и переключением самой кнопки. */
var mirrorsRowDone = new Map(); // строка → сколько раз в неё уже вписаны зеркала
const MIRROR_AUTO_SIDES = ["off", "left", "right", "both"]; // порядок перебора по нажатиям
function mirrorsAutoSides(){
  const m = st.mirrorsAutoSide || "off";
  if (m === "left") return { left: true, right: false };
  if (m === "right") return { left: false, right: true };
  if (m === "both") return { left: true, right: true };
  return null;
}
/* ПЕРЕД КРУГОВЫМ СДВИГОМ: если зеркала сейчас показаны, вписываем их в строки — сдвиг обязан
   крутить всё, что видно, а не только настоящие биты (запрос пользователя: "при Круге сдвиге — как
   будто включены зеркала в строки"). Показ после этого выключается сам (так работает вписывание):
   биты уже в данных, и рисовать поверх них зеркала зеркал нельзя. Предел вписываний общий, так что
   бесконтрольно цепочка не растёт.
   Зеркала выключены — не делает ничего, сдвиг идёт как обычно. */

/* "0️⃣→ Нули в сами строки" (st.padZeroReal, #cPadReal) — превратить подставляемые нули в
   НАСТОЯЩИЕ биты строк. Прямой аналог "⇔ Вписать зеркала в строки": то, что до сих пор было
   только показом/подстановкой на лету, дописывается в сами данные, и дальше живёт как обычные
   биты — крутится Кругом, идёт в XOR, склейки, поиск (запрос пользователя: "включает эти 0 в
   строки и меняет биты при Круге сдвиге — и вообще везде").
   Сетка — та же, что у "0 вместо пустот" (concatGridBounds по ВСЕЙ цепочке): каждая непустая
   строка добивается нулями слева и справа до общей занятой ширины. Пустые строки не трогаем —
   они и на экране пустые, и во всех расчётах пропускаются.
   silent — вызов не от самой галки (перед сдвигом), тогда молчим, если добивать нечего. */
function padZerosToRows(silent){
  if (!st.padZero || !st.padZeroReal) return false;
  const g = concatGridBounds(st, st.rows.length - 1);
  if (!g) return false;
  let maxLen = 0;
  for (const s of st.rows) if (s && s.length > maxLen) maxLen = s.length;
  const plan = [];
  for (let r = 0; r < st.rows.length; r++) {
    const s = st.rows[r] || "";
    if (!s.length) continue;
    const sh = rowShiftFor(maxLen, r, s, st.align);
    const left = sh - g.lo, right = g.hi - (sh + s.length - 1);
    if (left <= 0 && right <= 0) continue;
    plan.push([r, "0".repeat(Math.max(0, left)) + s + "0".repeat(Math.max(0, right)), Math.max(0, left) + Math.max(0, right)]);
  }
  if (!plan.length) {
    if (!silent) say("Нули в строки: добивать нечего — все строки уже во всю ширину.");
    return false;
  }
  snapshot();
  let added = 0;
  for (const pr of plan) {
    st.rows[pr[0]] = pr[1];
    added += pr[2];
    // Длина строки изменилась — позиционные флаги к ней больше не относятся.
    insertedFlagsMap.delete(pr[0]);
    invFlagsMap.delete(pr[0]);
  }
  maskChangedMap.clear(); maskBaseRows = null;
  st.hit = null;
  if (!silent) {
    say(`Нули вписаны в строки: ${plan.length} стр., добавлено ${added} бит. Теперь они участвуют во всём наравне с остальными битами.`);
    logStep("Нули в строки", plan.map(pr => rowLabel(pr[0])).join(","), "", `${plan.length} стр., +${added} бит`);
  }
  return true;
}
function mirrorsBeforeShift(){
  // "0️⃣→ Нули в сами строки" — та же идея, что и у зеркал: перед сдвигом добиваем строки
  // настоящими нулями, чтобы Круг крутил ВСЁ, что видно, а не только исходные биты.
  padZerosToRows(true);
  if (!st.leftMirror && !st.rightMirror) return;
  // ...и ТОЛЬКО когда включены "⇔ Авто-зеркала" (запрос пользователя: "Авто-зеркала выкл, а при
  // нажатии стрелки почему-то построились зеркала в строки"). Раньше здесь хватало одного лишь
  // ПОКАЗА зеркал: включил серые зеркала посмотреть — и первая же стрелка Круга молча вписывала
  // их в данные. Показ обязан оставаться показом; кнопка "Авто-зеркала" и есть единственное
  // разрешение вписывать зеркала без прямого нажатия "⇔ Вписать зеркала в строки".
  // Разрешение — от автоматики, а стороны по-прежнему ПОКАЗАННЫЕ: смысл вписывания перед Кругом
  // в том, чтобы сдвиг крутил всё, что видно на экране.
  if (!mirrorsAutoSides()) return;
  applyMirrorsToRows(false, null, true); // молча: строки участка могут быть уже со своими зеркалами
}
function mirrorsAutoStep(){
  const sides = mirrorsAutoSides();
  if (!sides) return;
  // Общего "предел исчерпан — больше никогда" тут больше нет: предел считается по каждой строке
  // отдельно внутри applyMirrorsToRows(), поэтому новая захваченная строка своё зеркало получает
  // всегда, даже если у строк выше оно уже вписано.
  // Показ зеркал тут ни при чём: у автоматики свои стороны, поэтому включать серые зеркала ради
  // вписывания не нужно, и зеркала на зеркале не появляется.
  applyMirrorsToRows(true, sides);
}
function setMirrorsAuto(m, quiet){
  st.mirrorsAutoSide = MIRROR_AUTO_SIDES.indexOf(m) >= 0 ? m : "off";
  mirrorsRowDone.clear(); // новая настройка — счёт вписываний с нуля
  const b = document.getElementById("bMirrorsAuto");
  const lbl = { off: "выкл", left: "влево", right: "вправо", both: "обе стороны" };
  if (b) {
    b.classList.toggle("mode-act", st.mirrorsAutoSide !== "off");
    b.textContent = "⇔ Авто-зеркала: " + lbl[st.mirrorsAutoSide];
  }
  if (!quiet) {
    say(st.mirrorsAutoSide === "off"
      ? "Авто-зеркала выключены."
      : `Зеркала будут вписываться в строки сами (${lbl[st.mirrorsAutoSide]}) — на каждом расширении выделения находкой.`);
    saveCache();
  }
}
function setMirrorShiftAsIf(on, quiet){
  st.mirrorShiftAsIf = !!on;
  const b = document.getElementById("bMirrorShiftAsIf");
  if (b) {
    b.classList.toggle("mode-act", st.mirrorShiftAsIf);
    b.textContent = st.mirrorShiftAsIf ? "⇔ Место под зеркала: вкл" : "⇔ Место под зеркала: выкл";
  }
  if (!quiet) {
    say(st.mirrorShiftAsIf
      ? "Полотно расширено под зеркала: все строки сдвинуты одинаково, выравнивание прежнее."
      : "Место под зеркала убрано — видно столько, сколько влезает в отступы строк.");
    render(); saveCache();
  }
}
const bMirrorShiftAsIfEl = document.getElementById("bMirrorShiftAsIf");
if (bMirrorShiftAsIfEl) bMirrorShiftAsIfEl.onclick = () => setMirrorShiftAsIf(!st.mirrorShiftAsIf);
const mirrorsAutoMaxEl = document.getElementById("mirrorsAutoMax");
if (mirrorsAutoMaxEl) {
  mirrorsAutoMaxEl.onchange = () => {
    const v = Math.max(1, Math.min(99, parseInt(mirrorsAutoMaxEl.value, 10) || 1));
    mirrorsAutoMaxEl.value = v;
    st.mirrorsAutoMax = v;
    mirrorsRowDone.clear(); // предел сменили — счёт заново
    say(`Зеркала: не больше ${v} вписываний — и автоматикой, и вручную.`);
    saveCache();
  };
}
const bMirrorsAutoEl = document.getElementById("bMirrorsAuto");
if (bMirrorsAutoEl) bMirrorsAutoEl.onclick = () => {
  const cur = MIRROR_AUTO_SIDES.indexOf(st.mirrorsAutoSide || "off");
  setMirrorsAuto(MIRROR_AUTO_SIDES[(cur + 1) % MIRROR_AUTO_SIDES.length]);
};
/* Отдельной кнопки "⇔ Вписать зеркала в строки" больше нет (v0.886, запрос пользователя):
   вписывание происходит САМО при сохранении цепочки — см. tabSaveChainData() в fold-2. Сама
   applyMirrorsToRows() осталась на месте, её по-прежнему зовут автомат зеркал и подготовка к
   Кругу (mirrorsBeforeShift). */

/* "⇔ Зеркало шагами" — ПО ОДНОМУ биту зеркала за нажатие, наверх ЛЕСЕНКОЙ (запрос пользователя,
   его же разбор):
     1        зеркало строки "11" — это один бит "0", а над ней, в строке "1",
     11       как раз есть пустое место — туда он и уезжает:
     ---
     10
     11       дальше выделение переходит на СЛЕДУЮЩУЮ строку, и зеркало строится только для неё:
     ---      пусть строка "111", зеркало "00" — эти два бита уходят наверх ПО ОДНОМУ,
     100      первый в строку над ней, второй — ещё строкой выше:
     110
     111
   То есть каждый следующий бит зеркала уходит на строку ВЫШЕ предыдущего (первый — в строку прямо
   над выделенной), и кладётся в первое свободное место этой строки, то есть просто дописывается
   ей в конец ("все биты уходят наверх по одному как поместятся"). Никакой привязки к столбцу, в
   котором бит висел зеркалом, тут нет — иначе он ложился бы не в пустое место, а мимо строки.
   ОДНО НАЖАТИЕ = ВСЕ БИТЫ ЗЕРКАЛА ЭТОЙ СТРОКИ СРАЗУ (запрос пользователя "один шаг пусть все
   сразу биты от строки кладёт"), а не по одному, как было в первых версиях.
   ВЫДЕЛЕНИЕ ПЕРЕЕЗЖАЕТ НА СТРОКУ НИЖЕ ТОЛЬКО ПРИ НАХОДКЕ ФОН-ПОИСКА (запрос пользователя:
   "выделение переместить только если нашёлся фоновой поиск следующей") — то есть когда паттерн
   строки ПОД выделенной совпал с результатом (та же проверка computeBgSearchTarget(), что стоит
   у "⬆ Достроить вверх" с галкой "только при находке"). Не нашлось — выделение стоит, где стояло,
   и нажатие можно повторить (биты лягут ещё раз, дальше по тем же строкам вверх).
   Стороны — те, что ВКЛЮЧЕНЫ (◀/▶). Включены обе — биты идут по очереди: правый, левый, правый…
   Порядок внутри стороны — ОТ СТРОКИ НАРУЖУ: первым уезжает бит, стоявший вплотную к строке. */
/* Биты зеркал выделенной строки в порядке разбора (см. комментарий выше). */
function mirrorStepBits(selIdx){
  const s0 = st.rows[selIdx] || "";
  const out = [];
  if (s0.length < 2) return out; // из одного бита зеркала не выходит: сам опорный бит в него не входит
  // Правое зеркало печатается сразу за строкой, слева направо — вплотную к ней стоит его ПЕРВЫЙ
  // бит. Левое печатается перед строкой, поэтому у него вплотную стоит ПОСЛЕДНИЙ — его и берём
  // первым, дальше наружу.
  const right = st.rightMirror ? mirrorSideBits(s0.slice(0, -1), "r").split("") : [];
  const left = st.leftMirror ? mirrorSideBits(s0.slice(1), "l").split("").reverse() : [];
  const n = Math.max(left.length, right.length);
  for (let k = 0; k < n; k++) {
    if (k < right.length) out.push(right[k]);
    if (k < left.length) out.push(left[k]);
  }
  return out;
}
function mirrorStepUp(){
  if (!st.leftMirror && !st.rightMirror) { say("Зеркало шагами: сначала включите «◀ Зеркало влево» и/или «▶ Зеркало вправо»."); return; }
  if (!st.selectedRows || st.selectedRows.size !== 1) { say("Зеркало шагами: выделите ровно одну строку — её зеркало и разбирается."); return; }
  const selIdx = Array.from(st.selectedRows)[0];

  const bits = mirrorStepBits(selIdx);
  if (!bits.length) { say("Зеркало шагами: у этой строки зеркала нет (нужны хотя бы два бита)."); return; }
  // Каждый следующий бит — строкой выше, поэтому выше строки №1 класть уже некуда: сколько строк
  // над выделенной, столько бит и уместится.
  const canPlace = Math.min(bits.length, selIdx);
  if (canPlace <= 0) {
    say("Зеркало шагами: над выделенной строкой нет строк — класть некуда. Достройте вверх («⬆ Достроить вверх») или начните ниже.");
    return;
  }
  snapshot();
  for (let k = 0; k < canPlace; k++) {
    const dstIdx = selIdx - 1 - k;
    const dst = st.rows[dstIdx] || "";
    st.rows[dstIdx] = dst + bits[k];
    // Подсветка .bit-inv строки-приёмника остаётся на своих битах: дописанный — не перевёрнутый.
    const flags = invFlagsMap.get(dstIdx);
    if (flags && flags.length === dst.length) invFlagsMap.set(dstIdx, flags.concat([false]));
    // Ушедший наверх бит зеркала — «новый» (см. newBitsMap): приписан справа к строке-приёмнику.
    newBitsWrap(dstIdx, dst.length, 0, 1);
  }
  const left = bits.length - canPlace;
  // Фон-поиск считаем ДО переезда выделения: он смотрит на паттерн строки ПОД выделенной, а
  // выделение как раз на неё и переедет, если совпало.
  const bgInfo = computeBgSearchTarget();
  const matched = !!(bgInfo && bgInfo.matched);
  const nextIdx = selIdx + 1;
  let tail;
  if (!matched) {
    tail = "фон-поиск ничего не нашёл — выделение осталось на строке №" + (selIdx + 1) + ".";
  } else if (nextIdx >= st.rows.length) {
    tail = "фон-поиск нашёл, но ниже строк нет — выделение осталось на месте.";
  } else {
    st.selectedRows = new Set([nextIdx]);
    tail = `фон-поиск нашёл паттерн строки №${nextIdx + 1} — выделение перешло на неё.`;
  }
  render(); saveCache();
  say(`Зеркало шагами: наверх ушло бит ${canPlace}` + (left ? ` (ещё ${left} не поместилось — некуда выше)` : "") + `, ` + tail);
}
const bMirrorStepEl = document.getElementById("bMirrorStep");
if (bMirrorStepEl) bMirrorStepEl.onclick = mirrorStepUp;
const bRightMirrorEl = document.getElementById("bRightMirror");
if (bRightMirrorEl) bRightMirrorEl.onclick = () => setRightMirror(!st.rightMirror);
const bLeftMirrorEl = document.getElementById("bLeftMirror");
if (bLeftMirrorEl) bLeftMirrorEl.onclick = () => setLeftMirror(!st.leftMirror);
const bTopBuildOnSelectEl = document.getElementById("bTopBuildOnSelect");
if (bTopBuildOnSelectEl) bTopBuildOnSelectEl.onclick = () => setTopBuildOnSelect(!st.topBuildOnSelect);
const bTopBuildNeedHitEl = document.getElementById("bTopBuildNeedHit");
if (bTopBuildNeedHitEl) bTopBuildNeedHitEl.onclick = () => setTopBuildNeedHit(!st.topBuildNeedHit);
const bTopBuildEl = document.getElementById("bTopBuild");
if (bTopBuildEl) bTopBuildEl.onclick = () => {
  if (st.topBuildNeedHit) {
    const bgInfo = computeBgSearchTarget();
    if (!bgInfo || !bgInfo.matched) {
      say("Достроение вверх: стоп — находки нет, а стоит «только при находке».");
      return;
    }
  }
  buildTopMirror(st.topBuildMode || "rebuild");
};
const bTopBuildOffAllEl = document.getElementById("bTopBuildOffAll");
if (bTopBuildOffAllEl) bTopBuildOffAllEl.onclick = () => {
  // Гасим все автоматические режимы панели тихо (quiet=true) — сообщение будет одно, общее.
  setTopBuildOnSelect(false, true);
  setTopBuildNeedHit(false, true);
  setTopBuildOnHit(false, true);
  setLeftMirror(false, true);
  setRightMirror(false, true);
  setMirrorsAuto("off", true);
  const had = st.topBuilt || 0;
  if (had) clearTopBuilt(); // сама делает snapshot/render/saveCache
  else { render(); saveCache(); }
  say(had
    ? `Всё выключено, построения убраны — снято ${had} стр. сверху.`
    : "Всё выключено, построений сверху и не было.");
};
const bTopBuildClearEl = document.getElementById("bTopBuildClear");
if (bTopBuildClearEl) bTopBuildClearEl.onclick = clearTopBuilt;
const bTopBuildModeEl = document.getElementById("bTopBuildMode");
if (bTopBuildModeEl) bTopBuildModeEl.onclick = () => {
  setTopBuildMode((st.topBuildMode === "append") ? "rebuild" : "append");
  saveCache();
};

const bSelectAllRowsEl = document.getElementById("bSelectAllRows");
if (bSelectAllRowsEl) {
  bSelectAllRowsEl.onclick = () => {
    const n = st.rows.length;
    if (!n) { say("Строк нет."); return; }
    if (!st.selectedRows) st.selectedRows = new Set();
    const allSelected = st.selectedRows.size === n;
    st.manualShiftTurns = 0;
    st.shiftVariantTotal = null;
    st.shiftVariantRows = null;
    st.captureGrown = false;
    st.selectedRows = allSelected ? new Set() : new Set(st.rows.map((_, i) => i));
    updateVariantCounter();
    render();
    saveCache();
  };
}

const bInvertSelectedEl = document.getElementById("bInvertSelected");
if (bInvertSelectedEl) {
  bInvertSelectedEl.onclick = () => {
    if (!st.selectedRows || st.selectedRows.size === 0) { say("Выделите строку кликом."); return; }
    snapshot();
    for (const r of st.selectedRows) if (st.rows[r]) st.rows[r] = invertBits(st.rows[r]);
    render(); saveCache();
  };
}

/* "⇄ Реверс" (v0.968, запрос пользователя) — пара к "🔁 Инверсии", только разворачивает строки
   задом наперёд, а не меняет значения бит. Кнопка САМА СЕБЕ ОБРАТНАЯ: разворот — операция,
   применённая дважды дающая исходное, поэтому "по кругу вкл/выкл" получается само собой. Флажок
   st.revToggled только ЗАЖИГАЕТ кнопку, пока цепочка стоит развёрнутой, — на сами данные он не
   влияет и ничего не хранит, кроме чётности нажатий.
   Ничего не выделено — работает по ВСЕМ строкам (у "Инверсии" тут ругань, но у разворота нет
   причины требовать выделение: это цельная операция над картинкой, а не точечная правка). */
const bReverseSelectedEl = document.getElementById("bReverseSelected");
if (bReverseSelectedEl) {
  bReverseSelectedEl.onclick = () => {
    const idxs = (st.selectedRows && st.selectedRows.size)
      ? Array.from(st.selectedRows).sort((a, b) => a - b)
      : st.rows.map((_, i) => i);
    const live = idxs.filter(r => st.rows[r] && st.rows[r].length);
    if (!live.length) { say("⇄ Реверс: разворачивать нечего — нет непустых строк."); return; }
    snapshot();
    for (const r of live) {
      st.rows[r] = reverseStr(st.rows[r]);
      // Строка перевёрнута целиком — позиционные пометки к ней больше не относятся (то же
      // правило, что и везде, где строка переписывается не по месту).
      invFlagsMap.delete(r);
      insertedFlagsMap.delete(r);
      newBitsMap.delete(r);
    }
    st.revToggled = !st.revToggled;
    bReverseSelectedEl.classList.toggle("mode-act", st.revToggled);
    render(); saveCache();
    say(`⇄ Реверс: развёрнуто строк — ${live.length}` +
        (st.revToggled ? ". Повторный клик вернёт как было." : ". Строки вернулись в исходный вид."));
    logStep("Реверс", live.map(r => rowLabel(r)).join(","), "", "");
  };
}

/* "⇄🔎 Реверс: неподвижные" — ПОКАЗ, данные не трогает. Подсвечивает биты, которые от разворота
   строки не изменятся: те, что стоят на палиндромных позициях (бит №k равен биту №«длина−1−k»).
   Сам признак считается прямо в render() по строке — заранее готовить нечего, тут только
   переключатель (см. isRevKeep/.hlrk). */
const bReverseKeepEl = document.getElementById("bReverseKeep");
if (bReverseKeepEl) {
  bReverseKeepEl.onclick = () => {
    st.revKeepShow = !st.revKeepShow;
    bReverseKeepEl.classList.toggle("mode-act", st.revKeepShow);
    render(); saveCache();
    say(st.revKeepShow
      ? "⇄🔎 Реверс: подсвечены биты, которые разворот строки НЕ изменит (палиндромные позиции)."
      : "⇄🔎 Реверс: подсветка неподвижных бит снята.");
  };
}

/* "✉ Конверт ⧄" — складывание картинки по ДИАГОНАЛИ (запрос пользователя). Кнопка ДВУХШАГОВАЯ:
   первое нажатие только подсвечивает биты диагонали, по которой пойдёт сгиб (envPreview/.env-diag),
   второе — собственно складывает.
   Диагональ выходит из ПЕРВОГО (левого) символа выделенной строки и идёт вправо-вверх, по одному
   столбцу на строку: строка R столбец c0, строка R−1 столбец c0+1, и так до верха участка. Всё,
   что лежит НАД этой диагональю, отражается через неё (как лист бумаги, сложенный конвертом) и
   ХОРится с тем, что лежит под ней; сами верхние ячейки после сгиба гасятся в 0. Ячейки НА самой
   диагонали ХОРить не с чем (они отражаются сами в себя) — по правилу пользователя они просто
   становятся "1" ("если 0 на диагонали, он становится 1").
   Отражение в экранных координатах (строка r, столбец col): линия — это r + col = K, отражение
   меняет строку и столбец местами относительно неё: (r, col) → (K − col, K − r).
   Считаем, как и все диагональные режимы, в ПОЛУСТОЛБЦАХ (×2), чтобы полушаг ½-выравниваний был
   целым числом, а геометрия совпадала с экранной: сдвиг строки — тот же rowShiftFor() от того же
   maxLen, что и в render(), плюс полушаговый нудж (hasHalfNudge).
   Участок — как у диагональных режимов (diagStartIdx): выделено несколько строк — от самой верхней
   выделенной, одна — от 1-й строки таблицы. Ячейки, которым после отражения некуда лечь (в строке
   нет такого столбца, или отражение уводит за пределы участка), считаются потерянными — их число
   уходит в сообщение, чтобы обрезка не была молчаливой. */
function foldEnvelopeXor(){
  if (!st.selectedRows || st.selectedRows.size === 0) { say("Выделите строку кликом."); return; }
  const R = Math.max(...st.selectedRows);
  const start = st.selectedRows.size > 1 ? Math.min(...st.selectedRows) : 0;
  if (!(st.rows[R] || "").length) { say("Выделенная строка пустая — от неё не идёт диагональ."); return; }

  // Геометрия ровно та же, что на экране: maxLen по ВСЕМ строкам (см. render()).
  let maxLen = 0;
  for (const s of st.rows) if (s.length > maxLen) maxLen = s.length;
  const isHalf = st.align === "halfcenter" || st.align === "halfstairs" || st.align === "rhalfstairs";
  const sh2x = st.rows.map((s, i) => (s && s.length)
    ? 2 * rowShiftFor(maxLen, i, s, st.align) + (isHalf && hasHalfNudge(s, maxLen, st.align, i) ? 1 : 0)
    : 0);
  // Индекс символа в строке i, стоящего в полустолбце c2x (−1 — такого символа нет: строка левее/
  // правее или сидит в чужой полусетке).
  const cellAt = (i, c2x) => {
    const s = st.rows[i] || "";
    if (!s.length) return -1;
    const d = c2x - sh2x[i];
    if (d < 0 || d % 2 !== 0) return -1;
    const k = d / 2;
    return k < s.length ? k : -1;
  };

  const K = sh2x[R] + 2 * R;               // инвариант диагонали: полустолбец + 2*номер строки

  // ПЕРВОЕ нажатие — только показать диагональ, по которой пойдёт сгиб (запрос пользователя),
  // складывает уже ВТОРОЕ. Показ гаснет сам, если сменить выделение/выравнивание/длины строк
  // (см. envPreviewKey/render), так что вслепую по устаревшей линии сложить нельзя.
  const key = envPreviewKey();
  if (!envPreview || envPreview.key !== key) {
    const cells = new Map();
    let n = 0;
    for (let r = start; r <= R; r++) {
      const k = cellAt(r, K - 2 * r);
      if (k < 0) continue;
      cells.set(r, new Set([k]));
      n++;
    }
    envPreview = { key, cells };
    render();
    say("Конверт: показана диагональ (" + n + " ячеек) — нажмите «Конверт» ещё раз, чтобы сложить.");
    return;
  }
  envPreview = null;

  const src = st.rows.map(s => s.split("")); // читаем ТОЛЬКО отсюда — исходная картинка
  const res = st.rows.map(s => s.split("")); // пишем сюда (верх и низ диагонали не пересекаются)

  let moved = 0, lost = 0;
  for (let r = start; r <= R; r++) {
    const row = src[r];
    for (let k = 0; k < row.length; k++) {
      const ch = row[k];
      if (ch !== "0" && ch !== "1") continue;
      const c = sh2x[r] + 2 * k;
      if (c + 2 * r >= K) continue;        // не над диагональю (на ней или под ней) — не двигаем
      res[r][k] = "0";                     // сгиб: верхняя половина уходит вниз
      const rTo2 = K - c;                  // ×2, чтобы поймать чужую полусетку
      if (rTo2 % 2 !== 0) { lost++; continue; }
      const rTo = rTo2 / 2;
      if (rTo < start || rTo > R) { lost++; continue; }
      const kTo = cellAt(rTo, K - 2 * r);
      if (kTo < 0) { lost++; continue; }
      const v = res[rTo][kTo];
      if (v !== "0" && v !== "1") { lost++; continue; }
      res[rTo][kTo] = (v === ch) ? "0" : "1";
      moved++;
    }
  }
  // Сама диагональ — всегда "1".
  let diagCells = 0;
  for (let r = start; r <= R; r++) {
    const k = cellAt(r, K - 2 * r);
    if (k < 0) continue;
    const v = res[r][k];
    if (v !== "0" && v !== "1") continue;
    res[r][k] = "1";
    diagCells++;
  }

  snapshot();
  let touched = 0;
  for (let r = start; r <= R; r++) {
    const nv = res[r].join("");
    if (nv !== st.rows[r]) {
      st.rows[r] = nv;
      insertedFlagsMap.delete(r);
      invFlagsMap.delete(r);
      touched++;
    }
  }
  render(); saveCache();
  say("Конверт: сложено " + moved + " бит, диагональ " + diagCells + " → 1, строк изменено " + touched +
      (lost ? (", не легло " + lost) : ""));
}
const bFoldEnvelopeEl = document.getElementById("bFoldEnvelope");
if (bFoldEnvelopeEl) bFoldEnvelopeEl.onclick = foldEnvelopeXor;

/* "🔴 Инверсия между символами" (11→1010): после КАЖДОГО символа строки вставляется его
   инверсия. Работает по выделенным строкам, а если ничего не выделено — по всем (тот же принцип,
   что у "🗑 ←1"/"🗑 1→"). Вставленные позиции запоминаются в insertedFlagsMap и красятся красным. */
const bInsertInversionEl = document.getElementById("bInsertInversion");
if (bInsertInversionEl) {
  bInsertInversionEl.onclick = () => {
    const idxs = (st.selectedRows && st.selectedRows.size)
      ? Array.from(st.selectedRows).sort((a, b) => a - b)
      : st.rows.map((_, i) => i);
    if (!idxs.length) return;
    snapshot();
    let touched = 0;
    for (const r of idxs) {
      const src = st.rows[r];
      if (!src || !src.length) continue;
      let out = "", flags = [];
      for (const ch of src) {
        out += ch; flags.push(false);
        // Не-битовые символы (если вдруг попадутся) не инвертируем — вставлять нечего.
        const inv = ch === "0" ? "1" : ch === "1" ? "0" : null;
        if (inv !== null) { out += inv; flags.push(true); }
      }
      st.rows[r] = out;
      insertedFlagsMap.set(r, flags);
      // Строка стала вдвое длиннее — старая раскраска "перевёрнутых" битов к ней уже не относится.
      invFlagsMap.delete(r);
      touched++;
    }
    if (!touched) { say("Нечего вставлять — строки пустые."); return; }
    say(`Инверсия между символами: обработано строк — ${touched}`);
    render(); saveCache();
  };
}

/* ПОСЛЕДНЯЯ строка, участвующая в "🧩 Паттерн-цепочке" — и в укладке битов, и в сборке результата
   фон-поиска (см. computeBgSearchTarget/chainIdx). Управляется отключалкой в рамке самой кнопки
   (запрос пользователя):
     ⛔ Ниже выделенной — выкл  → останавливаемся на самой выделенной строке;
     ⛔ Всё кроме 1-й ниже — выкл → плюс первая строка под ней (та, чей паттерн ищется);
     обе выключены              → вся таблица до последней строки.
   anchor — текущая выделенная строка (seqAnchorIdx). */
/* Строки, которые "🧩 Паттерн-цепочка" уже брала в работу в этой сессии. Нужны, чтобы строка,
   впервые попавшая в участок НЕ с самого начала, не притаскивала в цепочку свои прежние биты:
   при "⛔ Всё кроме 1-й ниже — выкл" это ровно та самая первая строка под выделением — после
   переезда выделения она новая, а укладка на этом шаге уже идёт XOR-ом (запрос пользователя
   "эту 1-ю нижнюю надо сначала обнулять, прежде чем включать в поиск и укладку"). */
var patChainSeenRows = new Set();

/* Добить строку нулями до общей ширины ПО ТЕКУЩЕМУ ВЫРАВНИВАНИЮ — тот же приём, что у штатного
   шага "Дополнение нулями (паддинг)" в doStep(): нули дописываются с обеих сторон ровно так, как
   строка стоит на полотне. Нужен "🧩 Паттерн-цепочке" при включённой "0️⃣ 0 вместо пустот".
   Math.max(0, …) с обеих сторон — у лесенок сдвиг считается от номера строки и может уходить в
   минус, а repeat() от отрицательного числа бросает RangeError. */
function padRowToLen(str, targetLen, align, rowIdx){
  if (!str || str.length >= targetLen) return str;
  const shift = alignShift(targetLen, str.length, align, rowIdx);
  return "0".repeat(Math.max(0, shift)) + str + "0".repeat(Math.max(0, targetLen - str.length - shift));
}

function patChainLastIdx(anchor){
  const last = st.rows.length - 1;
  // "⛔ Ниже выделенной — выкл": ни укладка битов, ни сборка результата не должны трогать строку
  // под выделенной вообще (запрос пользователя) — участок кончается на самой выделенной.
  if (st.chainCutBelow) return Math.min(anchor, last);
  if (st.chainCutTail) return Math.min(anchor + 1, last);
  return last;
}

/* Номера паттернов, которые можно укладывать "🧩 Паттерн-цепочкой" — только у строк ДО ВЫДЕЛЕННОЙ
   ВКЛЮЧИТЕЛЬНО (запрос пользователя "не класть паттерны из строк ниже выделенной"). Паттерн строки
   под выделенной — это то, что фон-поиск как раз ИЩЕТ, укладывать его бессмысленно, а всё, что
   ещё ниже, к текущему участку не относится.
   Список КОЛЬЦЕВОЙ: паттерны кончились — начинаем с первого, поэтому очередной берётся по остатку
   от деления счётчика на длину списка. */
/* Лента, которую цепочка кладёт под номером i: текст паттерна или биты самой строки — смотря
   что выбрано кнопкой "🧩 Кладёт" (st.chainSrcRows). Всё остальное в цепочке работает с этим
   текстом одинаково, поэтому источник спрятан в одну функцию. */
function patChainSrcText(i){
  if (st.chainSrcRows) return (st.rows && st.rows[i]) ? st.rows[i] : "";
  const p = st.pats ? st.pats[i] : null;
  return (p && p.text) ? p.text : "";
}
function patChainUsableIdxs(){
  const out = [];
  const limit = st.chainSrcRows ? (st.rows ? st.rows.length : 0) : (st.pats ? st.pats.length : 0);
  const last = Math.min(seqAnchorIdx(), limit - 1);
  for (let i = 0; i <= last; i++) {
    if (patChainSrcText(i)) out.push(i);
  }
  return out;
}
/* ПОЛНЫЙ КРУГ ЦЕПОЧКИ — сколько укладок имеет смысл делать вообще. Паттерны идут по кольцу, а
   накладываются XOR-ом, и XOR с тем же паттерном во второй раз его отменяет: значит ДВА прохода по
   списку возвращают биты ровно к тому, что было после первой укладки, и дальше идёт точный повтор
   (запрос пользователя "можно подсчитать количество кругов, после которых бесполезно крутить").
   0 — паттернов нет, считать нечего. */
function patChainCycleLen(){
  const n = patChainUsableIdxs().length;
  return n ? n * 2 : 0;
}
/* Сколько укладок сделано в ТЕКУЩЕМ круге — от последнего переезда выделения (см.
   st.patChainCycleBase), а не от начала сессии: после переезда участок другой и круг начинается
   заново. */
function patChainCyclePos(){
  return Math.max(0, (st.patChainStep || 0) - (st.patChainCycleBase || 0));
}

/* Какой паттерн ляжет СЛЕДУЮЩИМ нажатием (индекс в st.pats) или -1, если укладывать нечего. */
function patChainNextIdx(){
  const usable = patChainUsableIdxs();
  if (!usable.length) return -1;
  return usable[(st.patChainStep || 0) % usable.length];
}

/* "🧩 Паттерн-цепочка": на каждом нажатии берёт ОЧЕРЕДНОЙ паттерн (1-й, 2-й, 3-й...), растягивает
   его повтором по кругу до длины каждой выделенной строки и кладёт в строку: первый — заменой,
   каждый следующий — XOR-ом с тем, что уже лежит. st.patChainStep — только счётчик "какой паттерн
   класть следующим"; на фон-поиск он не влияет, тот как всегда сверяется с паттерном строки ниже
   выделенной. Сбрасывается "↺ Сбросом". */
/* ОДИН ШАГ "Паттерн-цепочки" — вынесен отдельно, потому что его гоняет ещё и своя кнопка "Авто"
   (см. patChainAutoTick ниже). Возвращает { ok, matched }: ok=false — дальше идти нечего
   (паттернов нет / нет непустых строк), matched — нашёл ли фон-поиск совпадение на этом шаге. */
/* silent=true ("⏩ Турбо" под своим "Авто") — не перерисовывать таблицу и не писать кэш на этом
   шаге: и то, и другое стоит дороже самой укладки, а промежуточные кадры на такой скорости всё
   равно не разглядеть. Находка/остановка рисуются всегда (см. patChainAutoTick). */
function patChainApplyOnce(silent){
    // РАБОТАЕТ ТОЛЬКО ПРИ РОВНО ОДНОЙ ВЫДЕЛЕННОЙ СТРОКЕ (запрос пользователя). Вся раскладка
    // цепочки завязана на "выделенная / +1 искомая", и при нескольких выделенных строках (или ни
    // одной) эти адреса перестают быть однозначными — поэтому просто стоп.
    if (!st.selectedRows || st.selectedRows.size !== 1) {
      say("Паттерн-цепочка: нужна РОВНО одна выделенная строка — стоп.");
      return { ok: false, matched: false };
    }
    // ПОЛУШАГ "ПЕРЕЕЗД ВЫДЕЛЕНИЯ" — ОТДЕЛЬНОЕ нажатие (запрос пользователя "сделай раздельно
    // полушаг: выделение-перемещение, а вкладывание битов — последующее"). На шаге, где нашёлся
    // паттерн, выделение не двигается: сначала видно подсветку находки во всех строках (см.
    // patChainHitRows в render()). Следующее нажатие ТОЛЬКО переставляет выделение на найденную
    // строку и на этом заканчивается — биты не кладутся. И лишь нажатие после него укладывает
    // очередной паттерн. Под "▶ Авто" это просто два тика подряд, ok:true — прогон продолжается.
    if (st.patChainPendingMove >= 0 && st.patChainPendingMove < st.rows.length) {
      const moveTo = st.patChainPendingMove;
      st.patChainPendingMove = -1;
      // "⬇ Расширять вниз" (см. #bGrowDownOnFind) — выделение не ПЕРЕЕЗЖАЕТ на находку, а
      // ДОРАСТАЕТ до неё: прежние строки остаются выделенными, снизу добавляется найденная.
      if (st.growDownOnFind) {
        if (!st.selectedRows) st.selectedRows = new Set();
        st.selectedRows.add(moveTo);
        st.captureGrown = true;
      } else {
        st.selectedRows = new Set([moveTo]);
        st.captureGrown = false; // выделение не "выросло" — оно переехало, правило окна ни при чём
      }
      // ОДНОВРЕМЕННО С ПЕРЕЕЗДОМ обнуляем новую строку ПОД выделением (запрос пользователя): она
      // только что стала искомой, и её прежние биты не должны попасть ни в укладку, ни в результат
      // поиска. Помечаем её как уже задействованную — повторно обнулять при укладке не нужно.
      const below = moveTo + 1;
      let zeroed = false;
      if (below < st.rows.length && st.rows[below] && /1/.test(st.rows[below])) {
        snapshot(); // строки меняем — шаг должен откатываться "↩ Отменой", как любой другой
        st.rows[below] = st.rows[below].replace(/1/g, "0");
        insertedFlagsMap.delete(below);
        invFlagsMap.delete(below);
        zeroed = true;
      }
      if (below < st.rows.length) patChainSeenRows.add(below);
      // Участок сменился — круг считаем заново с этого места (см. patChainCyclePos).
      st.patChainCycleBase = st.patChainStep || 0;
      say(`Паттерн-цепочка: выделение переехало на строку ${moveTo}` +
          (zeroed ? `, строка ${below} обнулена` : "") +
          ", круг считается заново — следующим нажатием ляжет паттерн.");
      st.bgSearchLastHit = -1;
      render(); saveCache();
      return { ok: true, matched: false };
    }
    st.patChainPendingMove = -1;
    const step = st.patChainStep || 0;          // сколько уже уложено за сессию
    const patIdx = patChainNextIdx();            // какой паттерн класть сейчас (по кругу)
    // Источник ленты — паттерн или сама строка, см. patChainSrcText/#bChainSrcRows.
    const patText = patIdx >= 0 ? patChainSrcText(patIdx) : "";
    if (!patText) { say(st.chainSrcRows ? "Паттерн-цепочка: непустых строк нет — укладывать нечего." : "Паттерн-цепочка: паттернов нет — укладывать нечего."); return { ok: false, matched: false }; }
    // ПАТТЕРН КЛАДЁТСЯ НА ВСЕ БИТЫ ТАБЛИЦЫ — во все строки, включая нижние (запрос пользователя),
    // если только отключалка в рамке кнопки не обрезала участок снизу (см. patChainLastIdx).
    // Выделение тут не набор рабочих строк, а только указатель для фон-поиска: строка под
    // выделенной (anchor + 1) — та, чей паттерн ищется, и она тоже заливается.
    const anchor = seqAnchorIdx();
    const fillTo = Math.min(st.rows.length - 1, anchor + 1);
    const lastIdx = patChainLastIdx(anchor);
    const idxs = st.rows.map((_, i) => i).filter(r => r <= lastIdx);
    snapshot();
    // Флаг "искомая строка залита цепочкой" — только если она РЕАЛЬНО заливалась: при
    // "⛔ Ниже выделенной — выкл" цепочка до неё не доходит, и включать её в расчёт нельзя
    // (запрос пользователя: "с нижней строкой вообще не должен работать").
    st.patChainFilledTo = (lastIdx >= fillTo) ? fillTo : -1;
    let touched = 0;
    // Для "Черновика шага" собираем ТРИ ленты по всей длине участка: что было (сквозная),
    // что накладываем (тот же паттерн, растянутый на всю длину) и что получилось.
    let beforeAll = "", afterAll = "";
    // КАК УКЛАДЫВАТЬ (st.chainTileMode, см. #chainTileGrp): "none" — заново в каждой строке;
    // "right"/"left" — сквозной лентой слева направо / справа налево; "snakeR"/"snakeL" — змейкой
    // с чередованием направления по строкам. flowOff — позиция внутри паттерна, с которой
    // начинается очередная строка (у "none" всегда 0), rowNo — порядковый номер строки в участке,
    // по нему змейка и чередует направление.
    const tileMode = st.chainTileMode || "none";
    const tileFlow = tileMode !== "none";
    let flowOff = 0, rowNo = 0;
    if (step === 0) patChainSeenRows.clear(); // новая сессия цепочки — все строки заново "новые"
    // "0️⃣ 0 вместо пустот" РАБОТАЕТ И ТУТ (запрос пользователя): пустые места внутри участка
    // становятся настоящими нулями — строки добиваются до общей ширины по текущему выравниванию, и
    // паттерн ложится в них наравне со всеми. Без этого короткие строки получали паттерн только на
    // своей длине, а пустоты так и оставались дырами и в укладке, и в результате поиска.
    if (st.padZero) {
      let wide = 0;
      for (const r of idxs) { const s = st.rows[r] || ""; if (s.length > wide) wide = s.length; }
      for (const r of idxs) {
        const s = st.rows[r] || "";
        if (!s.length || s.length >= wide) continue;
        st.rows[r] = padRowToLen(s, wide, st.align, r);
        insertedFlagsMap.delete(r);
        invFlagsMap.delete(r);
      }
    }
    // ПЕРВЫЙ ШАГ В РЕЖИМЕ "🧩 Кладёт: строки" НЕ ЗАТИРАЕТ СТРОКИ (запрос пользователя: "убери
    // первое обнуление строк"). Обычный режим кладёт первый паттерн ЗАМЕНОЙ — там это безобидно,
    // текст паттерна лежит в своей колонке. А когда лентой служат САМИ СТРОКИ, замена уничтожает
    // ровно то, что укладывается: первая же укладка стирала всю цепочку, из которой берётся
    // следующая лента. Поэтому тут первый шаг такой же XOR, как все следующие, а вместо затирания
    // при первом же шаге обнуляются ВСЕ строки НИЖЕ выделения — им и положено собираться заново.
    const wipeFirst = !st.chainSrcRows;
    // СТРОКИ НИЖЕ ВЫДЕЛЕНИЯ, СОВПАВШИЕ С УКЛАДЫВАЕМОЙ ЛЕНТОЙ, ОБНУЛЯЮТСЯ — в любом режиме
    // источника, и на каждой укладке, а не только на первой (запрос пользователя: "в любых режимах
    // обнулять ниже выделения — только если строка = паттерну"). Обнуляются ИМЕННО совпавшие:
    // раньше в режиме "Кладёт: строки" на первом шаге сносилось всё подряд ниже выделения, и это
    // же повторялось на автосбросе после холостых кругов (жалоба "почему-то и нижние обнуляет").
    // Сравнение дословное, вся строка целиком: это отпечаток самой ленты, а не случайное совпадение
    // куска. Строки выше и сама выделенная тут не при чём — они укладываются обычным путём ниже.
    let zeroedBelow = 0;
    for (let r = anchor + 1; r < st.rows.length; r++) {
      const sz = st.rows[r];
      // ЛЕНТА ЦЕЛИКОМ ЛЕЖИТ В СТРОКЕ — строка обнуляется (запрос пользователя: "строки, у которых
      // паттерн уже находится целиком в строке, эту строку обнулить"). Раньше сверялось дословное
      // равенство всей строки, поэтому строка с тем же паттерном, но длиннее его, не считалась —
      // а именно она и есть уже собранная. Ищем ПОДСТРОКОЙ, без кольца и без инверсий: это отпечаток
      // ровно той ленты, которую сейчас кладём.
      if (!sz || !sz.length || sz.indexOf(patText) < 0) continue;
      st.rows[r] = sz.replace(/1/g, "0");
      insertedFlagsMap.delete(r);
      invFlagsMap.delete(r);
      zeroedBelow++;
    }
    for (const r of idxs) {
      let cur = st.rows[r];
      if (!cur || !cur.length) continue;
      // ПЕРВОЕ ПОПАДАНИЕ СТРОКИ В ЦЕПОЧКУ ПОСЛЕ СТАРТА — сначала обнуляем её (см. patChainSeenRows):
      // на шаге 0 строки и так переписываются целиком, а вот строка, добравшаяся до участка позже
      // (после переезда выделения — при "⛔ Всё кроме 1-й ниже — выкл" это первая строка под
      // выделением), иначе внесла бы в XOR свои прежние биты, которых в цепочке быть не должно.
      if (step > 0 && !patChainSeenRows.has(r)) {
        cur = cur.replace(/1/g, "0");
        st.rows[r] = cur;
      }
      patChainSeenRows.add(r);
      beforeAll += cur;
      // Повтор паттерна ПО КРУГУ до длины строки: 100 → 100100100…, обрезается по месту.
      let tiled = "";
      if (tileFlow) {
        // Направление хода ленты по ЭТОЙ строке: у змеек чередуется по номеру строки в участке.
        const leftward = tileMode === "left"
          || (tileMode === "snakeR" && rowNo % 2 === 1)
          || (tileMode === "snakeL" && rowNo % 2 === 0);
        const buf = new Array(cur.length);
        for (let k = 0; k < cur.length; k++) {
          // Лента всегда идёт "по своему ходу": при ходе влево очередной символ ложится с
          // ПРАВОГО края строки, поэтому позиция считается с конца.
          buf[leftward ? (cur.length - 1 - k) : k] = patText[(flowOff + k) % patText.length];
        }
        tiled = buf.join("");
        flowOff = (flowOff + cur.length) % patText.length;
      } else {
        while (tiled.length < cur.length) tiled += patText;
        tiled = tiled.slice(0, cur.length);
      }
      rowNo++;
      // Заменой — только самый первый паттерн за сессию; дальше всегда XOR, в том числе когда
      // список пошёл по второму кругу.
      if (step === 0 && wipeFirst) {
        st.rows[r] = tiled;
      } else {
        let out = "";
        for (let k = 0; k < cur.length; k++) {
          const a = cur[k], c = tiled[k];
          out += ((a === "0" || a === "1") && (c === "0" || c === "1")) ? (a === c ? "0" : "1") : a;
        }
        st.rows[r] = out;
      }
      // Строка переписана целиком — старые пометки вставленных/перевёрнутых битов к ней не относятся.
      afterAll += st.rows[r];
      insertedFlagsMap.delete(r);
      invFlagsMap.delete(r);
      touched++;
    }
    if (!touched) { say("Паттерн-цепочка: нет непустых строк."); return { ok: false, matched: false }; }
    // Строки-"эха" искомого паттерна (раньше он клался для вида в строку anchor + 2) больше нет —
    // убрана по запросу пользователя: теперь паттерн ложится на ВСЕ строки, и отдельная служебная
    // строка в этой раскладке только мешала бы.
    st.patChainStep = step + 1;
    const nextIdx = patChainNextIdx();
    const cycLen = patChainCycleLen();
    say(`Паттерн-цепочка: уложен паттерн №${patIdx + 1} ('${patText}') в ${touched} стр.` +
        (step === 0 && !st.chainSrcRows ? "" : " (XOR с прежним)") +
        (zeroedBelow ? `, ниже выделения обнулено ${zeroedBelow} стр. с этим паттерном` : "") +
        (cycLen ? ` — круг ${Math.min(patChainCyclePos(), cycLen)}/${cycLen}` : "") +
        (nextIdx >= 0 ? `, следующим ляжет №${nextIdx + 1}` : ""));
    // "🧲 Захват находки" — работает и здесь, но выделение ПЕРЕМЕЩАЕТСЯ, а НЕ растёт, и не прямо
    // сейчас: на этом шаге только ЗАПОМИНАЕМ, куда переехать (st.patChainPendingMove) — сначала
    // должна быть видна подсветка находки во всех строках при неподвижном выделении, а сам переезд
    // случится в начале СЛЕДУЮЩЕГО нажатия (см. начало функции). Общий captureFoundRow() (он
    // добавляет строку к выделению / едет окном) цепочке не годится — ей нужна ровно одна строка.
    // Черновик шага: "Накладываем" (паттерн по всей длине) над "Сквозной" (что было), результат
    // под ними — их и рисует общий блок черновика (запрос пользователя).
    let tiledAll = "";
    while (tiledAll.length < beforeAll.length) tiledAll += patText;
    tiledAll = tiledAll.slice(0, beforeAll.length);
    // НОМЕР ШАГА (запрос пользователя "не пишет номер шага"): цепочка — такой же шаг, как и
    // остальные операции, поэтому двигаем общий счётчик st.step (его показывает "🧾 Черновик шага
    // № N") и кладём номер уложенного паттерна в st.shiftVariantTurns — именно оттуда лог находок
    // берёт колонку "шаг" (см. bgFindLog.unshift). stepStale=false — шаг настоящий, не "остаточный".
    st.step = (st.step || 0) + 1;
    st.shiftVariantTurns = st.patChainStep;
    st.stepStale = false;
    logStep("Паттерн-цепочка", idxs.map(r => r + 1), afterAll,
      `Паттерн №${patIdx + 1} ('${patText}')` + (step === 0 ? " — заполнение" : " — XOR с прежним"),
      [], [{ name: "Накладываем", text: tiledAll }, { name: "Сквозная", text: beforeAll }]);
    const bgInfoNow = computeBgSearchTarget();
    const matched = !!(bgInfoNow && bgInfoNow.matched);
    if (matched && (st.captureOnFind || st.growDownOnFind)) st.patChainPendingMove = bgInfoNow.targetIdx;
    st.bgSearchLastHit = -1;
    // "⏩ Турбо": промежуточные кадры не рисуем и кэш не пишем — но находку показываем всегда,
    // иначе не видно, ради чего всё и крутилось.
    if (!silent || matched) { render(); saveCache(); }
    return { ok: true, matched };
}

const bPatChainEl = document.getElementById("bPatChain");
if (bPatChainEl) bPatChainEl.onclick = () => {
  const res = patChainApplyOnce();
  // Та же автодостройка по находке, что и в прогоне (запрос пользователя).
  if (res && res.matched) {
    mirrorsAutoStep();
    const delta = topBuildOnHitStep();
    if (delta && patChainSeenRows && patChainSeenRows.size) {
      const moved = Array.from(patChainSeenRows).map(r => r + delta);
      patChainSeenRows.clear();
      for (const r of moved) patChainSeenRows.add(r);
    }
  }
};

/* "Авто" для Паттерн-цепочки — отдельная кнопка рядом с ней: гоняет тот же шаг подряд, кадр за
   кадром, пока не остановят. Останавливается сама при находке (если включено "🛑 Стоп на находке"),
   когда укладывать стало нечего, или повторным кликом. Со своим состоянием, чтобы не мешать общей
   кнопке "Авто" (autoRun) — у той свои режимы и свой st.running. */
// var, а не let: до этой строки к таймеру обращается глобальный хоткей Escape (см. keydown-
// обработчик выше по файлу) — с let это была бы ошибка временной мёртвой зоны.
/* ИСХОДНЫЕ БИТЫ СТРОКИ — из сохранёнки вкладки, если она есть, иначе из шаблона. Ровно те же два
   источника и в том же порядке, что у "↺ Сброса" (см. resetAll), поэтому "вернуть к шаблону"
   означает здесь то же самое, что и там. null — восстановить неоткуда. */
function templateRowBits(i){
  const saved = st.tabs && st.tabs[st.activeTab] ? st.tabs[st.activeTab].savedChain : null;
  if (saved) {
    if (saved.rows && i < saved.rows.length) return saved.rows[i];
    if (saved.tplRows && i < saved.tplRows.length) return saved.tplRows[i];
    return null;
  }
  return (st.tplRows && i < st.tplRows.length) ? st.tplRows[i] : null;
}
/* Вернуть к шаблону ВСЕ строки ВЫШЕ выделенной (запрос пользователя: за два круга цепочки ничего
   не нашлось — "сбросить все верхние и ещё раз прокрутить"). Трогаются только сами биты: паттерны,
   выделение, счётчики шагов и настройки остаются как были — это не общий Сброс, а откат участка,
   на котором цепочка работала. Возвращает, сколько строк реально изменилось. */
function patChainResetAbove(){
  const anchor = seqAnchorIdx();
  let n = 0;
  for (let i = 0; i < anchor && i < st.rows.length; i++) {
    const src = templateRowBits(i);
    if (src == null || src === st.rows[i]) continue;
    st.rows[i] = src;
    insertedFlagsMap.delete(i);
    invFlagsMap.delete(i);
    n++;
  }
  if (n) { maskChangedMap.clear(); maskBaseRows = null; st.hit = null; }
  return n;
}
/* Сколько кругов цепочки прошло без единой находки и сколько раз уже сбрасывались верхние строки.
   Живут только внутри прогона "▶ Авто" цепочки — обнуляются на старте и на любой находке. */
var patChainNoHitCycles = 0, patChainResetsDone = 0;
var patChainAutoTimer = null;
// Подпись кнопки переключается вместе с её состоянием — тем же приёмом, что у общей #bAuto
// (см. setAutoBtnState): пока прогон идёт, на кнопке "⏹ Стоп", иначе "▶ Авто" (запрос
// пользователя: "СТОП когда работает").
function setPatChainAutoBtnState(running){
  const b = document.getElementById("bPatChainAuto");
  if (!b) return;
  b.classList.toggle("mode-act", !!running);
  b.textContent = running ? "⏹ Стоп" : "▶ Авто";
}
function patChainAutoStop(msg){
  if (patChainAutoTimer) { cancelAnimationFrame(patChainAutoTimer); patChainAutoTimer = null; }
  setPatChainAutoBtnState(false);
  // Под "⏩ Турбо" промежуточные кадры не рисовались — при остановке обязательно показываем
  // итоговое состояние и сохраняем его.
  if (st.turboAuto) { render(); saveCache(); }
  if (msg) say(msg);
}
/* Под "⏩ Турбо" (та же общая галка, что и у большого "Авто") шаг идёт "молча": без render() и
   saveCache(), поэтому за кадр успевает уложиться целая ПАЧКА паттернов — время кадра тратится на
   саму укладку, а не на перерисовку таблицы. Находка и остановка рисуются всегда. */
function patChainAutoTick(){
  // Под "🐢 Замедление" молчаливый режим отключаем: каждый уложенный паттерн должен быть виден.
  const turbo = !!st.turboAuto && !st.slowAuto;
  const t0 = performance.now();
  do {
    const res = patChainApplyOnce(turbo);
    if (!res.ok) { patChainAutoStop("Паттерн-цепочка (Авто): укладывать больше нечего — стоп."); return; }
    if (res.matched) patChainNoHitCycles = 0; // нашлось — счёт "кругов вхолостую" начинается заново
    // Автодостройка вверх по находке (запрос пользователя). Строки вставляются сверху, поэтому
    // список уже задействованных строк цепочки съезжает на ту же величину.
    if (res.matched) {
      mirrorsAutoStep();
      const delta = topBuildOnHitStep();
      if (delta && patChainSeenRows && patChainSeenRows.size) {
        const moved = Array.from(patChainSeenRows).map(r => r + delta);
        patChainSeenRows.clear();
        for (const r of moved) patChainSeenRows.add(r);
      }
    }
    if (res.matched && st.stopOnHit) { patChainAutoStop("Паттерн-цепочка (Авто): найдено — стоп."); return; }

    // ПОЛНЫЙ КРУГ ПРОЙДЕН — дальше биты в точности повторяются (см. patChainCycleLen), гонять
    // прогон дальше бессмысленно (запрос пользователя "и остановить при достижении").
    const cyc = patChainCycleLen();
    if (cyc && patChainCyclePos() >= cyc) {
      // КРУГ ПРОЙДЕН. Дальше биты в точности повторяются — но прогон теперь не обязательно
      // кончается (запрос пользователя: "когда ничего не нашлось за 2 прохода, надо сбросить все
      // верхние и ещё раз прокрутить"). Считаем круги вхолостую: первый — просто идём дальше,
      // после второго возвращаем строки ВЫШЕ выделенной к шаблону и начинаем укладку с нуля.
      patChainNoHitCycles++;
      st.patChainCycleBase = st.patChainStep || 0; // следующий круг считается заново
      if (patChainNoHitCycles < 2) {
        say(`Паттерн-цепочка (Авто): круг ${patChainNoHitCycles} вхолостую (${cyc} укладок), идём дальше.`);
      } else {
        // Второй сброс подряд означал бы буквальный повтор того же самого: после отката верхних
        // строк и обнуления счётчиков состояние ровно то, с которого прогон начинался, и следующие
        // два круга повторят его шаг в шаг. Поэтому один откат делаем, а на втором честно
        // останавливаемся, а не крутим вечно одно и то же.
        if (patChainResetsDone >= 1) {
          patChainAutoStop(`Паттерн-цепочка (Авто): после сброса верхних строк ещё два круга вхолостую — дальше повторяется то же самое, остановлено.`);
          return;
        }
        const n = patChainResetAbove();
        patChainResetsDone++;
        patChainNoHitCycles = 0;
        st.patChainStep = 0;
        st.patChainCycleBase = 0;
        st.patChainFilledTo = -1;
        st.patChainPendingMove = -1;
        patChainSeenRows.clear();
        say(`Паттерн-цепочка (Авто): два круга вхолостую — верхние строки возвращены к шаблону (${n} стр.), укладка пошла заново.`);
        render(); saveCache();
        patChainAutoTimer = autoFrame(patChainAutoTick);
        return;
      }
    }
  } while (turbo && !st.slowAuto && performance.now() - t0 < 12);
  if (turbo) say(`⏩ Турбо (Паттерн-цепочка): уложено ${st.patChainStep} — идёт поиск…`);
  patChainAutoTimer = autoFrame(patChainAutoTick);
}
const bPatChainAutoEl = document.getElementById("bPatChainAuto");
if (bPatChainAutoEl) {
  bPatChainAutoEl.onclick = () => {
    if (patChainAutoTimer) { patChainAutoStop("Паттерн-цепочка (Авто): остановлено."); return; }
    setPatChainAutoBtnState(true);
    patChainNoHitCycles = 0; patChainResetsDone = 0;
    say("Паттерн-цепочка (Авто): пошла укладка…");
    patChainAutoTimer = autoFrame(patChainAutoTick);
  };
}

const bPadZerosAboveEl = document.getElementById("bPadZerosAbove");
if (bPadZerosAboveEl) {
  bPadZerosAboveEl.onclick = () => {
    if (!st.selectedRows || st.selectedRows.size === 0) { say("Выделите строку кликом."); return; }
    snapshot();
    // При нескольких выделенных строках цель длины — одна для всех: самая длинная
    // из выделенных (а не каждая своя), иначе более короткая выделенная строка
    // ограничивала бы дополнение строк над ней.
    let len = 0;
    for (const selIdx of st.selectedRows) if (st.rows[selIdx] && st.rows[selIdx].length > len) len = st.rows[selIdx].length;
    for (const selIdx of st.selectedRows) {
      if (!st.rows[selIdx]) continue;
      for (let i = 0; i < selIdx; i++) {
        const rowLen = st.rows[i].length;
        if (rowLen < len) {
          const shift = alignShift(len, rowLen, st.align, i);
          // Math.max(0, …) с обеих сторон — см. комментарий у padToLen() в doStep(): у "лесенок"
          // в минус может уйти и правый остаток, и сам сдвиг.
          st.rows[i] = "0".repeat(Math.max(0, shift)) + st.rows[i] + "0".repeat(Math.max(0, len - rowLen - shift));
        }
      }
    }
    render(); saveCache();
  };
}

/* Тетрис: 1-биты строки НАД выделенной "падают" в неё — в её 0-пустоты. Тетрис НИЧЕГО НЕ КРУТИТ
   (запрос пользователя: "пусть просто кладёт верхнюю в нижнюю если условие соблюдено, не надо
   крутить"; раньше клик, при котором строка не влезала, делал один круговой сдвиг выделенной и
   так перебирал весь круг — этого больше нет вообще, вместе с tetrisRotKey/tetrisRotAttempt/
   tetrisRotOriginal). Каждый клик делает РОВНО ОДНО из следующих действий:
   1) Условие соблюдено (ни один 1-бит падающей не приходится на 1-бит выделенной, см.
      tetrisLayPlan()) — ПАДЕНИЕ: выделенная получает 1-биты падающей, строка сверху гасит ВСЕ
      свои биты, что были 1 (и упали), в 0 (какие были 0 — так и остаются), её длина не меняется.
      Переход выделения на строку ниже — НЕ в этом же клике (см. п.3). Опустевшая строка сверху
      (aboveIdx) "закрывается": все строки, что были НАД ней (0..aboveIdx-1), сдвигаются вниз на
      одну — как в классическом тетрисе при очистке линии — самая верхняя (0) остаётся пустой
      (запрос пользователя: "если строка падает вниз то все которые над нею уже есть тоже вниз
      сдвигаются"). Строки не удаляются (массив st.rows той же длины), invFlagsMap/rowDividers
      едут вместе со своим содержимым.
   2) Условие НЕ соблюдено (1 падает ровно на 1) — клик ничего не меняет, только сообщение.
      Никаких поворотов и никакого возврата строки "к исходному виду" тут больше нет — строка и
      так не тронута.
   3) Строка только что приняла падение (см. tetrisPendingAdvance) — клик ТОЛЬКО переводит
      выделение на строку НИЖЕ (selIdx+1, если она есть), без изменения битов — чтобы тетрис
      можно было продолжать вниз по таблице, просто повторяя клики.
   Длина падающей строки БОЛЬШЕ не проверяется (раньше "длиннее выделенной" = сразу отказ): биты,
   которым некуда падать, теперь доращивают выделенную нулями — см. tetrisLayPlan().
   st.pats и st.used не трогаются вообще — они на строки никак не завязаны в этой функции. */
/* Строки в таблице визуально выровнены (⇤/↔/⇥) относительно ОБЩЕЙ самой длинной строки —
   короткая строка не начинается с raw-индекса 0 на экране, если align не "left" (см.
   alignShift()/render()). "1 над 0" на глаз проверяется ИМЕННО по видимым колонкам, а не по
   сырым индексам символов — поэтому падение должно сравнивать falling[i] не с floor[i], а с
   floor[i + offset], где offset — разница их собственных визуальных сдвигов относительно той же
   общей ширины maxLen, что использует render(). При align="left" alignShift всегда 0 для обеих
   строк, offset тоже 0 — поведение не меняется (полностью совместимо со старым). */
/* fallingIdx/floorIdx — НОМЕРА этих строк в таблице. Нужны "Лесенкам": с тех пор как они считают
   ступеньку от номера строки, а не от длины, разница сдвигов без номеров была бы неверной (у
   остальных выравниваний номер не участвует, и результат тот же, что и раньше). */
function tetrisAlignOffset(fallingLen, floorLen, fallingIdx, floorIdx){
  let maxLen = 0;
  for (const s of st.rows) if (s.length > maxLen) maxLen = s.length;
  return alignShift(maxLen, fallingLen, st.align, fallingIdx) - alignShift(maxLen, floorLen, st.align, floorIdx);
}
function bitsFitIntoGaps(falling, floor, offset){
  offset = offset || 0;
  for (let i = 0; i < falling.length; i++){
    if (falling[i] !== "1") continue;
    const j = i + offset;
    // 1-бит падающей визуально приходится мимо выделенной строки (левее/правее её видимого
    // диапазона) — падать некуда, это тоже "не влезает", а не молча игнорируется.
    if (j < 0 || j >= floor.length) return false;
    if (floor[j] === "1") return false;
  }
  return true;
}
/* То же самое для обычного Тетриса, но БЕЗ отказа по границам: 1-бит падающей, который визуально
   приходится левее/правее выделенной строки, — это не "не влезает", а повод дорастить выделенную
   нулями с нужной стороны (запрос пользователя: при "Лесенке" строка "1" над "110" стоит на одну
   колонку левее, и результат должен быть "1110", а не отказ). Единственное условие падения —
   1-бит падающей не приходится ровно на 1-бит выделенной.
   Возвращает { ok, padL, padR } — сколько нулей дописать слева/справа перед укладкой.
   Тетрис 2 и Тетрис-Ось этим НЕ пользуются: у них поведение по границам прежнее
   (bitsFitIntoGaps выше), они по-прежнему крутят строку. */
function tetrisLayPlan(falling, floor, offset){
  offset = offset || 0;
  let padL = 0, padR = 0;
  for (let i = 0; i < falling.length; i++){
    if (falling[i] !== "1") continue;
    const j = i + offset;
    if (j < 0) { padL = Math.max(padL, -j); continue; }
    if (j >= floor.length) { padR = Math.max(padR, j - floor.length + 1); continue; }
    if (floor[j] === "1") return { ok: false, padL: 0, padR: 0 };
  }
  return { ok: true, padL, padR };
}
/* Направление/инверсия поворота для Тетриса и Тетриса 2 — те же 4 варианта, что и у кнопок
   ◄/►Круг/Круг Инв (st.lastDirMode), а не жёстко "вправо + инверсия" — запрос пользователя
   "пусть тетрис 2 и тетрис сдвигают с инверсией или без в зависимости от [режима] и направление
   право-лево". lastDirMode ещё ни разу не выбран (null) — по умолчанию вправо с инверсией, как
   было раньше (то, с чего тетрис вообще начинался).
   stripInv=true — Тетрис 2 берёт НАПРАВЛЕНИЕ из lastDirMode, но ИНВЕРСИЮ игнорирует всегда
   (использует обычный Круг, не Круг Инв) — запрос пользователя "Тетрис 2 по умолчанию Круг (не
   инверт)". Тетрис (обычный) вызывает без параметра — следует lastDirMode полностью, включая
   инверсию. */
function tetrisRotateFns(stripInv){
  let mode = st.lastDirMode || "shiftRInv";
  if (stripInv) mode = mode === "shiftLInv" ? "shiftL" : (mode === "shiftRInv" ? "shiftR" : mode);
  if (mode === "shiftL") return { rotate: rotateStrLeft, rotateFlags: rotateInvFlagsLeft, label: "◄ Круг" };
  if (mode === "shiftR") return { rotate: rotateStrRight, rotateFlags: rotateInvFlagsRight, label: "► Круг" };
  if (mode === "shiftLInv") return { rotate: rotateStrLeftInv, rotateFlags: rotateInvFlagsLeftInv, label: "◄ Круг Инв" };
  return { rotate: rotateStrRightInv, rotateFlags: rotateInvFlagsRightInv, label: "► Круг Инв" };
}
// Строка, в которую только что упало (см. "Шаг 2" ниже) и которая ждёт ОТДЕЛЬНОГО клика,
// переводящего выделение на строку ниже — само падение больше не делает это в том же клике.
// -1 = ничего не ждёт. Сбрасывается, как только клик пришёл на ДРУГУЮ строку (проверка по
// равенству selIdx), так что случайный клик по другой строке не запускает лишний переход.
let tetrisPendingAdvance = -1;
function tetrisDrop(){
  if (!st.selectedRows || st.selectedRows.size !== 1) { say("Выделите ровно одну строку — тетрис роняет строку сверху именно в неё."); return; }
  const selIdx = Array.from(st.selectedRows)[0];

  if (tetrisPendingAdvance === selIdx) {
    // Отдельный шаг: строка уже приняла падение на прошлом клике — этот клик только переводит
    // выделение на строку ниже, без каких-либо изменений битов.
    tetrisPendingAdvance = -1;
    const nextIdx = selIdx + 1;
    if (nextIdx >= st.rows.length) { say("🧱 Тетрис: это последняя строка — переходить некуда."); return; }
    st.selectedRows = new Set([nextIdx]);
    render(); saveCache();
    say(`🧱 Тетрис: выделение перешло на строку №${nextIdx + 1}.`);
    return;
  }

  if (selIdx <= 0) { say("Над выделенной строкой ничего нет — падать нечему."); return; }
  const aboveIdx = selIdx - 1;
  const falling = st.rows[aboveIdx] || "";
  const floor0 = st.rows[selIdx] || "";
  if (!falling.length) { say("Строка сверху пуста — падать нечему."); return; }
  if (!floor0.length) { say("Выделенная строка пуста — падать некуда."); return; }

  // Смещение между визуальными колонками falling и floor при текущем выравнивании таблицы
  // (⇤/↔/⇥/лесенки) — см. tetrisAlignOffset(). При align="left" всегда 0 (как раньше).
  const offset = tetrisAlignOffset(falling.length, floor0.length, aboveIdx, selIdx);
  const plan = tetrisLayPlan(falling, floor0, offset);

  if (!plan.ok) {
    // Единственный отказ, который остался: 1 падает ровно на 1. Строку не трогаем и не крутим.
    say("🧱 Тетрис: 1-бит падающей строки приходится ровно на 1-бит выделенной — условие не соблюдено, класть некуда.");
    return;
  }

  {
    // Условие соблюдено — кладём. Переход выделения на строку ниже — ОТДЕЛЬНЫЙ следующий клик
    // (см. tetrisPendingAdvance выше), не сразу вместе с падением.
    snapshot();
    // padL/padR — биты падающей, которым при текущем выравнивании места в выделенной строке не
    // хватило (лесенка сдвигает строки друг относительно друга): дорастаем нулями, а не отказываем.
    const mergedArr = ("0".repeat(plan.padL) + floor0 + "0".repeat(plan.padR)).split("");
    for (let i = 0; i < falling.length; i++){
      if (falling[i] === "1") mergedArr[i + offset + plan.padL] = "1";
    }
    if (plan.padL || plan.padR){
      // Подсветка .bit-inv едет вместе со своими битами — дописанные нули не подсвечены.
      const flags = getInvFlags(selIdx, floor0.length);
      invFlagsMap.set(selIdx, new Array(plan.padL).fill(false).concat(flags, new Array(plan.padR).fill(false)));
      // Пометка «новых бит» едет так же: дописанные Тетрисом нули новыми не считаются, а прежние
      // новые биты остаются на своих местах внутри выросшей строки (см. newBitsWrap).
      const nb = newBitsMap.get(selIdx);
      if (nb && nb.length === floor0.length) {
        newBitsMap.set(selIdx, new Array(plan.padL).fill(false).concat(nb, new Array(plan.padR).fill(false)));
      }
    }
    st.rows[selIdx] = mergedArr.join("");
    st.rows[aboveIdx] = "0".repeat(falling.length);
    // Опустевшая строка сверху (aboveIdx) "закрывается" — все строки, что были НАД ней, сами
    // сдвигаются вниз на одну (как в классическом тетрисе при очистке линии): строка i-1
    // занимает место строки i, самая верхняя (0) остаётся пустой — запрос пользователя "если
    // строка падает вниз то все которые над нею уже есть тоже вниз сдвигаются". Подсветка
    // .bit-inv (invFlagsMap) и разделители (rowDividers) едут вместе со своими строками, чтобы
    // не отвязаться от съехавшего содержимого.
    const topLen = st.rows[0].length;
    for (let i = aboveIdx; i > 0; i--){
      st.rows[i] = st.rows[i - 1];
      if (invFlagsMap.has(i - 1)) invFlagsMap.set(i, invFlagsMap.get(i - 1)); else invFlagsMap.delete(i);
      // Пометка «новых бит» — часть содержимого строки, едет вниз вместе с ним.
      if (newBitsMap.has(i - 1)) newBitsMap.set(i, newBitsMap.get(i - 1)); else newBitsMap.delete(i);
      if (st.rowDividers && st.rowDividers.has(i - 1)) st.rowDividers.add(i); else if (st.rowDividers) st.rowDividers.delete(i);
    }
    st.rows[0] = "0".repeat(topLen);
    invFlagsMap.delete(0);
    newBitsMap.delete(0);
    if (st.rowDividers) st.rowDividers.delete(0);
    tetrisPendingAdvance = selIdx;
    render(); saveCache();
    say(`🧱 Тетрис: строка №${aboveIdx + 1} легла в выделенную №${selIdx + 1}, строки выше сдвинуты вниз — нажмите ещё раз, чтобы перейти на строку ниже.`);
    return;
  }
}
const bTetrisEl = document.getElementById("bTetris");
if (bTetrisEl) bTetrisEl.onclick = tetrisDrop;

/* Тетрис 2 — зеркало обычного Тетриса: падают 1-биты строки ПОД выделенной, ВВЕРХ в неё (а не
   строки НАД, вниз) — запрос пользователя. Тот же принцип на каждом клике (поворот направлением
   из tetrisRotateFns(true) / падение / переход выделения), см. комментарий у tetrisDrop() —
   тут только различия:
   1) Падающая строка ДЛИННЕЕ выделенной — В ОТЛИЧИЕ от обычного Тетриса это НЕ отклоняется сразу:
      разрешено, ЕСЛИ "лишний" хвост падающей (за пределами длины выделенной) весь из нулей — тем
      единицам просто некуда падать, но раз их и нет, ничего не теряется (запрос пользователя:
      "если там строка длиннее то не впадёт даже в эти нули пока её выходящий за биты текущей
      наполнен 1 а не 0"). bitsFitIntoGaps() это уже умеет сама (для "1" за границей — false, для
      "0" за границей — просто пропускается), отдельная проверка длины тут не нужна вообще.
   2) Падение: выделенная получает 1-биты строки ПОД ней, та строка гасится в 0 — как и раньше,
      без каскадного сдвига других строк (это отдельная фича обычного Тетриса, тут не просили).
   3) Переход выделения — ВНИЗ, на саму опустевшую строку (не ещё дальше) — чтобы дальше
      проверять, может ли СЛЕДУЮЩАЯ (ещё ниже) строка впасть в эти освободившиеся нули —
      запрос пользователя "дальше смотрим может ли следующая впасть в эти 0ли".
   4) Шаг 1 (не влезает) — ДВУХУРОВНЕВЫЙ поиск, не только по выделенной: если строка СНИЗУ
      длиннее и в её "хвосте" (за пределами длины выделенной) стоит 1 — ни один поворот ОДНОЙ
      выделенной этого не исправит (см. bitsFitIntoGaps: "1" за границей = не влезает всегда,
      независимо от поворота выделенной) — запрос пользователя: "если под выделенной строка, в
      которой на месте выходящего бита стоит 1ца, то нужно двигать нижнюю до тех пор пока там
      не будет 0, затем передвигать выделенную; если пройден круг и ничего не впадает, то снова
      двигать нижнюю, и так далее, пока обе строки не сделают [полный] круг оборотов". Крутим
      ВЫДЕЛЕННУЮ (как обычно) один круг; если весь круг выделенной исчерпан без фита —
      восстанавливаем выделенную к ЕЁ истинному оригиналу и КРУТИМ СТРОКУ СНИЗУ на один шаг (тот
      же клик), затем на следующих кликах снова крутим выделенную полный круг против УЖЕ НОВОЙ
      ориентации строки снизу — и так далее, пока строка снизу тоже не пройдёт полный круг (тогда
      сдаёмся, возвращаем ОБЕ строки к их истинным оригиналам). Направление — общее для обеих
      строк, из tetrisRotateFns(true) — инверсию Тетрис 2 всегда игнорирует (см. её комментарий,
      запрос пользователя "Тетрис 2 по умолчанию Круг (не инверт)"). */
let tetris2PendingAdvance = -1;
let tetris2RotKey = null;
let tetris2FloorAttempt = 0;
let tetris2FloorOriginal = null;
let tetris2FloorOriginalFlags = null;
let tetris2FloorOriginalNew = null;  // снимок пометки «новых бит», см. newBitsSnap
let tetris2BelowAttempt = 0;
let tetris2BelowOriginal = null;
let tetris2BelowOriginalFlags = null;
let tetris2BelowOriginalNew = null;
function tetris2Drop(){
  if (!st.selectedRows || st.selectedRows.size !== 1) { say("Выделите ровно одну строку — Тетрис 2 роняет строку СНИЗУ именно в неё."); return; }
  const selIdx = Array.from(st.selectedRows)[0];

  if (tetris2PendingAdvance === selIdx) {
    tetris2PendingAdvance = -1;
    const nextIdx = selIdx + 1;
    if (nextIdx >= st.rows.length) { say("🧱 Тетрис 2: это последняя строка — переходить некуда."); return; }
    st.selectedRows = new Set([nextIdx]);
    render(); saveCache();
    say(`🧱 Тетрис 2: выделение перешло на опустевшую строку №${nextIdx + 1}.`);
    return;
  }

  const belowIdx = selIdx + 1;
  if (belowIdx >= st.rows.length) { say("Под выделенной строкой ничего нет — падать неоткуда."); return; }
  const falling = st.rows[belowIdx] || "";
  const floor0 = st.rows[selIdx] || "";
  if (!falling.length) { say("Строка снизу пуста — падать нечему."); return; }
  if (!floor0.length) { say("Выделенная строка пуста — падать некуда."); return; }

  const offset = tetrisAlignOffset(falling.length, floor0.length, belowIdx, selIdx);

  if (bitsFitIntoGaps(falling, floor0, offset)) {
    snapshot();
    const mergedArr = floor0.split("");
    for (let i = 0; i < falling.length; i++){
      if (falling[i] === "1") mergedArr[i + offset] = "1";
    }
    st.rows[selIdx] = mergedArr.join("");
    st.rows[belowIdx] = "0".repeat(falling.length);
    tetris2PendingAdvance = selIdx;
    tetris2RotKey = null; tetris2FloorAttempt = 0; tetris2FloorOriginal = null; tetris2FloorOriginalFlags = null;
    tetris2BelowAttempt = 0; tetris2BelowOriginal = null; tetris2BelowOriginalFlags = null;
    render(); saveCache();
    say(`🧱 Тетрис 2: строка №${belowIdx + 1} впала вверх в выделенную №${selIdx + 1} — нажмите ещё раз, чтобы перейти на опустевшую строку.`);
    return;
  }

  // Шаг 1: не влезает как есть — двухуровневый поиск (см. комментарий над функцией). Направление —
  // из tetrisRotateFns() (та же, что активна у ◄/►Круг/Круг Инв), инверсию Тетрис 2 ИГНОРИРУЕТ
  // всегда (stripInv=true) — запрос пользователя "Тетрис 2 по умолчанию Круг (не инверт)".
  const { rotate, rotateFlags, label } = tetrisRotateFns(true);
  const key = belowIdx + ":" + selIdx;
  if (tetris2RotKey !== key) {
    // Новая пара строк — фиксируем ИСТИННЫЕ оригиналы ОБЕИХ (к ним возвращаемся, если весь
    // двухуровневый поиск в итоге ничего не найдёт).
    tetris2RotKey = key;
    tetris2FloorAttempt = 0;
    tetris2FloorOriginal = floor0;
    tetris2FloorOriginalFlags = getInvFlags(selIdx, floor0.length).slice();
    tetris2FloorOriginalNew = newBitsSnap(selIdx);
    tetris2BelowAttempt = 0;
    tetris2BelowOriginal = falling;
    tetris2BelowOriginalFlags = getInvFlags(belowIdx, falling.length).slice();
    tetris2BelowOriginalNew = newBitsSnap(belowIdx);
  }
  const maxFloorAttempts = tetris2FloorOriginal.length * 2;
  const maxBelowAttempts = tetris2BelowOriginal.length * 2;
  snapshot();

  if (tetris2FloorAttempt < maxFloorAttempts) {
    // Круг выделенной для ТЕКУЩЕЙ ориентации строки снизу ещё не исчерпан — крутим выделенную
    // на один шаг, как в обычном Тетрисе.
    const rotatedFloor = rotate(st.rows[selIdx]);
    const rotatedFloorFlags = rotateFlags(getInvFlags(selIdx, st.rows[selIdx].length));
    tetris2FloorAttempt++;
    // Круг мог замкнуться САМ (вернуться к оригиналу) раньше maxFloorAttempts — форсируем переход
    // к строке снизу на следующем клике, не дожидаясь формального предела попыток.
    if (rotatedFloor === tetris2FloorOriginal) tetris2FloorAttempt = maxFloorAttempts;
    st.rows[selIdx] = rotatedFloor;
    invFlagsMap.set(selIdx, rotatedFloorFlags);
    rotateNewBitsRow(selIdx, rotateFlags); // пометка «новых» едет вместе с битами
    render(); saveCache();
    say(`🧱 Тетрис 2: выделенная строка повёрнута (${label}, попытка ${tetris2FloorAttempt}/${maxFloorAttempts}) — нажмите ещё раз.`);
    return;
  }

  if (tetris2BelowAttempt < maxBelowAttempts) {
    // Круг выделенной исчерпан без фита — возвращаем выделенную к истинному оригиналу и крутим
    // строку СНИЗУ на один шаг (запрос пользователя: "если под выделенной строка, в которой на
    // месте выходящего бита стоит 1ца — двигать нижнюю, пока там не будет 0"). Следующие клики
    // снова крутят выделенную полный круг, но уже против НОВОЙ ориентации строки снизу.
    st.rows[selIdx] = tetris2FloorOriginal;
    invFlagsMap.set(selIdx, tetris2FloorOriginalFlags);
    newBitsPut(selIdx, tetris2FloorOriginalNew);
    tetris2FloorAttempt = 0;

    const rotatedBelow = rotate(st.rows[belowIdx]);
    const rotatedBelowFlags = rotateFlags(getInvFlags(belowIdx, st.rows[belowIdx].length));
    tetris2BelowAttempt++;
    if (rotatedBelow === tetris2BelowOriginal) tetris2BelowAttempt = maxBelowAttempts;
    st.rows[belowIdx] = rotatedBelow;
    invFlagsMap.set(belowIdx, rotatedBelowFlags);
    rotateNewBitsRow(belowIdx, rotateFlags);
    render(); saveCache();
    say(`🧱 Тетрис 2: круг выделенной исчерпан — повёрнута строка снизу (${label}, попытка ${tetris2BelowAttempt}/${maxBelowAttempts}) — нажмите ещё раз.`);
    return;
  }

  // Оба круга (выделенной под каждую ориентацию снизу, и самой строки снизу) исчерпаны — нигде
  // не подошло. Возвращаем ОБЕ строки к их истинным оригиналам.
  st.rows[selIdx] = tetris2FloorOriginal;
  invFlagsMap.set(selIdx, tetris2FloorOriginalFlags);
  newBitsPut(selIdx, tetris2FloorOriginalNew);
  st.rows[belowIdx] = tetris2BelowOriginal;
  invFlagsMap.set(belowIdx, tetris2BelowOriginalFlags);
  newBitsPut(belowIdx, tetris2BelowOriginalNew);
  tetris2RotKey = null; tetris2FloorAttempt = 0; tetris2FloorOriginal = null; tetris2FloorOriginalFlags = null;
  tetris2BelowAttempt = 0; tetris2BelowOriginal = null; tetris2BelowOriginalFlags = null;
  render(); saveCache();
  say(`🧱 Тетрис 2: испробованы все повороты обеих строк (${label}) — ни одно расположение не даёт впасть, обе строки возвращены к исходному виду.`);
}
const bTetris2El = document.getElementById("bTetris2");
if (bTetris2El) bTetris2El.onclick = tetris2Drop;

/* Ось ВНУТРИ строки для "Тетрис-Ось" — запрос пользователя ("ось у каждого выравнивания будет —
   0 символ, у каждого кроме выравнивания Ось"): для ЛЮБОГО выравнивания, кроме самой "⊙ Ось" —
   ось строки это просто её ПЕРВЫЙ символ (локальный индекс 0), никакого поиска общего столбца по
   всем строкам больше не нужно. Только под выравниванием "⊙ Ось" ось — текущий индекс символа
   строки, стоящий на общей оси-столбце (см. getAxisOffset/axisRowShift выше — крутится
   ◄/►Круг(Инв) в режиме "Ось"). */
function axisCharIdxOf(rowIdx, len){
  if (!len) return 0;
  return st.align === "axis" ? getAxisOffset(rowIdx, len) : 0;
}

/* Тетрис-Ось — запрос пользователя: по нажатию 1-биты ВЫДЕЛЕННОЙ строки (кроме Оси, см.
   axisCharIdxOf()) двигаются ВВЕРХ, в 0-пустоты строки НАД ней. Ось — единственный бит,
   который никогда не переносится и не учитывается при проверке "влезает ли" — она остаётся "1"
   в выделенной, даже когда все остальные её биты после переноса гасятся в 0.
   Поиск поворота — ОДНОУРОВНЕВЫЙ (запрос пользователя "тут надо вращать выделенную только, а не
   над нею"): крутится ТОЛЬКО ВЫДЕЛЕННАЯ (selIdx) строка, строка НАД (aboveIdx) вообще не
   вращается и остаётся неподвижной "плитой". Ось при этом ВСЕГДА выключена из проверки/переноса
   (позиция внутри выделенной строки не зависит от поворотов — сдвиг и длина не меняются
   вращением). Найдя фит — перенос вверх, выделение переходит на строку НИЖЕ опустевшей. */
let tetrisAxisPendingAdvance = -1;
let tetrisAxisRotKey = null;
let tetrisAxisAttempt = 0;
let tetrisAxisOriginal = null;
let tetrisAxisOriginalFlags = null;
let tetrisAxisOriginalNew = null;
function tetrisAxisDrop(){
  if (!st.selectedRows || st.selectedRows.size !== 1) { say("Выделите ровно одну строку — Тетрис-Ось двигает её биты вверх."); return; }
  const selIdx = Array.from(st.selectedRows)[0];

  if (tetrisAxisPendingAdvance === selIdx) {
    tetrisAxisPendingAdvance = -1;
    const nextIdx = selIdx + 1;
    if (nextIdx >= st.rows.length) { say("🧱 Тетрис-Ось: это последняя строка — переходить некуда."); return; }
    st.selectedRows = new Set([nextIdx]);
    render(); saveCache();
    say(`🧱 Тетрис-Ось: выделение перешло на строку №${nextIdx + 1}.`);
    return;
  }

  if (selIdx <= 0) { say("Над выделенной строкой ничего нет — двигать некуда."); return; }
  const aboveIdx = selIdx - 1;
  const falling0 = st.rows[selIdx] || "";
  const floor0 = st.rows[aboveIdx] || "";
  if (!falling0.length) { say("Выделенная строка пуста — двигать нечего."); return; }
  if (!floor0.length) { say("Строка сверху пуста — двигать некуда."); return; }

  const offset = tetrisAlignOffset(falling0.length, floor0.length, selIdx, aboveIdx);
  const axisCharIdx = axisCharIdxOf(selIdx, falling0.length); // позиция оси ВНУТРИ выделенной
                                               // строки — вращением не меняется (сдвиг и длина
                                               // строк вращением не трогаются), остаётся тем же
                                               // индексом весь поиск.
  const noAxis = (s) => (axisCharIdx >= 0 && axisCharIdx < s.length) ? (s.slice(0, axisCharIdx) + "0" + s.slice(axisCharIdx + 1)) : s;

  if (bitsFitIntoGaps(noAxis(falling0), floor0, offset)) {
    snapshot();
    const fallingChecked = noAxis(falling0);
    const mergedArr = floor0.split("");
    for (let i = 0; i < fallingChecked.length; i++){
      if (fallingChecked[i] === "1") mergedArr[i + offset] = "1";
    }
    st.rows[aboveIdx] = mergedArr.join("");
    // Выделенная гасится в 0, КРОМЕ оси — та остаётся "1" (по определению оси).
    const newSel = "0".repeat(falling0.length).split("");
    if (axisCharIdx >= 0 && axisCharIdx < falling0.length) newSel[axisCharIdx] = "1";
    st.rows[selIdx] = newSel.join("");
    tetrisAxisPendingAdvance = selIdx;
    tetrisAxisRotKey = null;
    tetrisAxisAttempt = 0; tetrisAxisOriginal = null; tetrisAxisOriginalFlags = null;
    render(); saveCache();
    say(`🧱 Тетрис-Ось: биты строки №${selIdx + 1} (кроме оси) перенесены вверх в №${aboveIdx + 1} — нажмите ещё раз, чтобы перейти на строку ниже.`);
    return;
  }

  // Шаг 1: не влезает (без учёта оси) — одноуровневый поиск: крутим ТОЛЬКО falling (выделенную),
  // floor (строка НАД) не трогается вообще. Направление/инверсия — из tetrisRotateFns() (та же,
  // что активна у ◄/►Круг/Круг Инв).
  const { rotate, rotateFlags, label } = tetrisRotateFns();
  const key = aboveIdx + ":" + selIdx;
  if (tetrisAxisRotKey !== key) {
    tetrisAxisRotKey = key;
    tetrisAxisAttempt = 0;
    tetrisAxisOriginal = falling0;
    tetrisAxisOriginalFlags = getInvFlags(selIdx, falling0.length).slice();
    tetrisAxisOriginalNew = newBitsSnap(selIdx);
  }
  const maxAttempts = tetrisAxisOriginal.length * 2;
  snapshot();

  if (tetrisAxisAttempt < maxAttempts) {
    const rotatedFalling = rotate(st.rows[selIdx]);
    const rotatedFallingFlags = rotateFlags(getInvFlags(selIdx, st.rows[selIdx].length));
    tetrisAxisAttempt++;
    if (rotatedFalling === tetrisAxisOriginal) tetrisAxisAttempt = maxAttempts;
    st.rows[selIdx] = rotatedFalling;
    invFlagsMap.set(selIdx, rotatedFallingFlags);
    rotateNewBitsRow(selIdx, rotateFlags); // пометка «новых» едет вместе с битами
    render(); saveCache();
    say(`🧱 Тетрис-Ось: выделенная строка повёрнута (${label}, попытка ${tetrisAxisAttempt}/${maxAttempts}) — нажмите ещё раз.`);
    return;
  }

  // Круг исчерпан — нигде не подошло. Возвращаем выделенную к истинному оригиналу.
  st.rows[selIdx] = tetrisAxisOriginal;
  invFlagsMap.set(selIdx, tetrisAxisOriginalFlags);
  newBitsPut(selIdx, tetrisAxisOriginalNew);
  tetrisAxisRotKey = null;
  tetrisAxisAttempt = 0; tetrisAxisOriginal = null; tetrisAxisOriginalFlags = null; tetrisAxisOriginalNew = null;
  render(); saveCache();
  say(`🧱 Тетрис-Ось: испробованы все повороты выделенной строки (${label}) — ни одно расположение не даёт (без учёта оси) впасть, строка возвращена к исходному виду.`);
}
const bTetrisAxisEl = document.getElementById("bTetrisAxis");
if (bTetrisAxisEl) bTetrisAxisEl.onclick = tetrisAxisDrop;

const bDelFirstEl = document.getElementById("bDelFirst");
if (bDelFirstEl) {
  bDelFirstEl.onclick = () => {
    snapshot();
    let deleted = 0;

    if (st.selectedRows && st.selectedRows.size > 0) {
      for (const idx of st.selectedRows) {
        if (st.rows[idx] && st.rows[idx].length > 0) {
          st.rows[idx] = st.rows[idx].slice(1);
          deleted++;
        }
      }
    } else {
      for (let i = 0; i < st.rows.length; i++) {
        if (st.rows[i] && st.rows[i].length > 0) {
          st.rows[i] = st.rows[i].slice(1);
          deleted++;
        }
      }
    }

    render(); saveCache();
    say(`Удалён первый символ из ${deleted} строк.`);
  };
}

/* Отслеживает "только что добавленный кликом bAddRightToggle бит", чтобы повторный клик по тем
   же строкам переключал его 1↔0 вместо добавления нового — см. bAddRightToggle ниже. Любая
   другая правка этих строк (в т.ч. bDelLast) сбрасывает состояние. */
let addRightState = null; // {idxs:number[], length:number[], value:'0'|'1'}

/* Удалить последний символ (справа) — прямой аналог bDelFirst, только с другого конца строки. */
const bDelLastEl = document.getElementById("bDelLast");
if (bDelLastEl) {
  bDelLastEl.onclick = () => {
    snapshot();
    let deleted = 0;

    if (st.selectedRows && st.selectedRows.size > 0) {
      for (const idx of st.selectedRows) {
        if (st.rows[idx] && st.rows[idx].length > 0) {
          st.rows[idx] = st.rows[idx].slice(0, -1);
          deleted++;
        }
      }
    } else {
      for (let i = 0; i < st.rows.length; i++) {
        if (st.rows[i] && st.rows[i].length > 0) {
          st.rows[i] = st.rows[i].slice(0, -1);
          deleted++;
        }
      }
    }

    addRightState = null; // длины строк поменялись — предыдущий "добавленный бит" больше не актуален
    render(); saveCache();
    say(`Удалён последний символ из ${deleted} строк.`);
  };
}

/* "🗑 ↔1" — удалить ЦЕНТРАЛЬНЫЙ символ строки (прямой аналог bDelFirst/bDelLast, только вырез
   идёт из середины, а не с края). У нечётной длины середина одна; у чётной середины как таковой
   нет — берём ЛЕВЫЙ из двух средних ((len − 1) >> 1), тем же правилом округления вниз, каким
   alignShift() кладёт лишний пробел справа при "По центру". Строки длиной 0 пропускаются.
   Флаги (инверсии/вставки) не переносятся — ровно как у bDelFirst/bDelLast. */
const bDelMidEl = document.getElementById("bDelMid");
if (bDelMidEl) {
  bDelMidEl.onclick = () => {
    snapshot();
    let deleted = 0;

    const cutMid = (i) => {
      const s = st.rows[i];
      if (!s || !s.length) return;
      const mid = (s.length - 1) >> 1;
      st.rows[i] = s.slice(0, mid) + s.slice(mid + 1);
      deleted++;
    };

    if (st.selectedRows && st.selectedRows.size > 0) {
      for (const idx of st.selectedRows) cutMid(idx);
    } else {
      for (let i = 0; i < st.rows.length; i++) cutMid(i);
    }

    addRightState = null; // длины строк поменялись — предыдущий "добавленный бит" больше не актуален
    render(); saveCache();
    say(`Удалён центральный символ из ${deleted} строк.`);
  };
}

/* "⋮ Биты" — показ через один бит (st.parityView, см. applyParityMask). Нажатия перебирают по
   кругу: все → чёт → нечёт → чёт по сквозной → нечёт по сквозной → снова все.
   ДАННЫЕ НЕ ТРОГАЮТСЯ вообще: это слой показа/расчёта поверх строк, поэтому каждое нажатие
   считается от ИСХОДНЫХ строк, а не от уже проредённых, и Undo тут не нужен. */
const PARITY_LABELS = ["⋮ Биты: все", "⋮ Биты: чёт", "⋮ Биты: нечёт", "⋮ Биты: чёт скв.", "⋮ Биты: нечёт скв."];
const PARITY_SAY = [
  "Показаны все биты — прореживание выключено.",
  "Показаны ЧЁТНЫЕ биты каждой строки (2,4,6…), остальные — точки и в расчёты не идут.",
  "Показаны НЕЧЁТНЫЕ биты каждой строки (1,3,5…), остальные — точки и в расчёты не идут.",
  "Показаны ЧЁТНЫЕ биты ПО СКВОЗНОЙ — счёт идёт непрерывно с первого бита первой строки.",
  "Показаны НЕЧЁТНЫЕ биты ПО СКВОЗНОЙ — счёт идёт непрерывно с первого бита первой строки."
];
function setParityView(m, quiet){
  const n = PARITY_LABELS.length;
  st.parityView = (((m | 0) % n) + n) % n;
  const b = document.getElementById("bParityView");
  if (b) {
    b.classList.toggle("mode-act", !!st.parityView);
    b.textContent = PARITY_LABELS[st.parityView];
  }
  if (!quiet) {
    say(PARITY_SAY[st.parityView]);
    render(); saveCache();
  }
}
const bParityViewEl = document.getElementById("bParityView");
if (bParityViewEl) bParityViewEl.onclick = () => setParityView((st.parityView | 0) + 1);

/* "🧩⬇ Паттерны в цепочку" — стереть ВСЕ строки цепочки и положить вместо них тексты паттернов,
   строка в строку: строка №N = паттерн №N. Сами паттерны остаются на местах (снимаются только
   отметки "найден"/kind/step — цепочка новая, старые находки к ней не относятся).
   Шаблон (st.tplRows) НЕ трогаем: "↺ Сброс" по-прежнему возвращает к нему, а не к паттернам. */
/* Тело вынесено в функцию (v0.822): ровно тем же способом в цепочку кладётся и КЭШ ПАТТЕРНОВ
   (st.patBank, кнопка "🧩⬇ В цепочку" в подвале списка цепочек) — логика "стереть строки и
   положить вместо них тексты" у них одна на двоих, дублировать её вторым экземпляром незачем.
   texts — готовый список текстов, srcLabel — как называть источник в сообщении и в логе шагов. */
function textsToChainRows(texts, srcLabel) {
  texts = texts.slice();
  // Хвост пустых паттернов в строки не превращаем — иначе цепочка обрастает пустыми строками.
  while (texts.length && !texts[texts.length - 1]) texts.pop();
  if (!texts.some(t => t.length)) { say(srcLabel + " в цепочку: вставлять нечего — список пуст."); return; }
  snapshot();
  st.rows = texts.slice();
  st.used = st.rows.map(() => false);
  st.pats = st.rows.map((t, i) => {
    const p = st.pats[i];
    return p ? { ...p, found: false, kind: null, step: null }
             : { text: "", ord: i, found: false, kind: null, step: null };
  });
  // Строки заменены целиком — всё, что привязано к их прежним позициям, больше не про них.
  st.topBuilt = 0;
  topBaseCapture();
  invFlagsMap.clear();
  insertedFlagsMap.clear();
  axisOffsetMap.clear();
  axisBitShiftMap.clear();
  axisBitDirMap.clear();
  rowRotOffMap.clear();
  edgeOnesSideMap.clear();
  mirrorsRowDone.clear();
  maskChangedMap.clear(); maskBaseRows = null;
  st.step = 0; st.passCount = 0; st.tailBuffer = ""; st.hit = null;
  st.horizBitIdx = 0; st.lastXorBitA = null;
  st.selectedRows = new Set();
  ensureZeroRow();
  // Выделение как после Сброса — первая строка с данными (многие режимы без выделения не идут).
  const f = firstDataIdx();
  if (f >= 0) st.selectedRows = new Set([f]);
  const filled = st.rows.filter(t => t.length).length;
  render(); saveCache();
  say(`${srcLabel} вставлены в цепочку: ${filled} стр. (строка №N = запись №N). Прежние строки удалены — вернуть можно Undo.`);
  logStep(srcLabel + " в цепочку", "", "", `${filled} стр.`);
}
/* "🗑 Удалить ячейки паттернов" (v0.829, запрос пользователя: "нужно чтоб вручную можно было
   удалять строки, даже пустые, в паттернах отдельно от цепочек"). Обычный Delete работает по
   выделению каждой колонки отдельно и колонку паттернов сам по себе не трогает вообще (см.
   deleteSelectedRows в fold-3-ops.js); здесь же удаляются ТОЛЬКО выделенные ячейки
   колонки паттернов, всё, что ниже, подтягивается вверх, а строки цепочки не трогаются вообще.
   Пустые ячейки удаляются наравне с заполненными: ими как раз и выравнивают колонку.
   Выделять ячейки — клик по колонке паттернов (st.selectedPats), тот же набор, что использует
   "🌈 Все паттерны". p.ord НЕ пересчитываем: это привязка "паттерн ↔ его исходная строка", она
   от сдвига колонки не меняется. */
const bDelPatsEl = document.getElementById("bDelPats");
if (bDelPatsEl) {
  bDelPatsEl.onclick = () => {
    const sel = (st.selectedPats && st.selectedPats.size)
      ? Array.from(st.selectedPats).sort((a, b) => b - a) // сверху вниз нельзя: индексы поедут
      : [];
    if (!sel.length) { say("Удалить ячейки паттернов: сначала выдели их в колонке паттернов (клик по ячейке, можно и по пустой)."); return; }
    snapshot();
    let gone = 0;
    for (const i of sel) if (i >= 0 && i < st.pats.length) { st.pats.splice(i, 1); gone++; }
    st.selectedPats = new Set();
    render(); saveCache();
    say(`Удалено ячеек паттернов: ${gone}. Строки цепочки не тронуты, нижние паттерны подтянулись вверх — вернуть можно Undo.`);
    logStep("Удалить ячейки паттернов", "", "", `${gone} шт.`);
  };
}
const bPatsToRowsEl = document.getElementById("bPatsToRows");
if (bPatsToRowsEl) {
  bPatsToRowsEl.onclick = () => textsToChainRows(st.pats.map(p => (p && p.text) ? p.text : ""), "Паттерны");
}

/* "1/0→" — добавляет бит СПРАВА к выделенным строкам (или всем, если ничего не выделено).
   Первый клик дописывает '1'. Если следующий клик — снова по тем же самым строкам, и с прошлого
   клика их длина/последний символ не менялись НИКАК (ни другой кнопкой, ни правкой, ни undo —
   проверяется по факту, а не флагом "было ли что-то ещё"), то новый бит НЕ добавляется, а тот же
   самый последний символ переключается 1↔0. Любое постороннее изменение длины/содержимого этих
   строк само по себе "сбрасывает" продолжение — следующий клик снова допишет новый бит. */
const bAddRightToggleEl = document.getElementById("bAddRightToggle");
if (bAddRightToggleEl) {
  bAddRightToggleEl.onclick = () => {
    const idxs = (st.selectedRows && st.selectedRows.size > 0)
      ? Array.from(st.selectedRows).sort((a, b) => a - b)
      : st.rows.map((_, i) => i);
    if (idxs.length === 0) { say("Нечего дополнять — нет строк."); return; }

    const canToggle = !!addRightState
      && addRightState.idxs.length === idxs.length
      && addRightState.idxs.every((v, i) => v === idxs[i])
      && idxs.every((idx, i) => st.rows[idx]
        && st.rows[idx].length === addRightState.length[i]
        && st.rows[idx][st.rows[idx].length - 1] === addRightState.value);

    snapshot();
    if (canToggle) {
      const newVal = addRightState.value === "1" ? "0" : "1";
      for (const idx of idxs) st.rows[idx] = st.rows[idx].slice(0, -1) + newVal;
      addRightState.value = newVal;
      addRightState.length = idxs.map(idx => st.rows[idx].length);
      say(`Добавленный бит переключён на ${newVal} (${idxs.length} строк).`);
    } else {
      for (const idx of idxs) {
        if (st.rows[idx] == null) continue;
        st.rows[idx] = st.rows[idx] + "1";
      }
      addRightState = {
        idxs: idxs.slice(),
        length: idxs.map(idx => st.rows[idx] ? st.rows[idx].length : 0),
        value: "1"
      };
      say(`Добавлена 1 справа (${idxs.length} строк). Повторный клик — переключит на 0.`);
    }
    render(); saveCache();
  };
}

/* "⨁ XOR выдел" — ПРОСТО XOR, без всяких режимов и поисков (запрос пользователя: "пусть просто
   делает хор всех выделенных или всех до верха если одна выделена, хор прямо в выделенной строке
   записать"):
     выделено НЕСКОЛЬКО строк — ХОР-ятся ровно они;
     выделена ОДНА — ХОР-ятся все строки от самого верха и до неё включительно.
   Результат кладётся ПРЯМО В ВЫДЕЛЕННУЮ строку (при нескольких выделенных — в САМУЮ НИЖНЮЮ из
   них: она и есть та, до которой всё сложили). Считает xorRowsDownTo() — та же геометрия, что и
   у всех остальных XOR-ов: колонка в колонку по экрану, с учётом выравнивания, полустолбцов "½"
   и показанных зеркал.
   Прежний режим st.xorSelectedMode (прогон со сдвигами и поиском совпадения) отсюда убран; сам
   пошаговый механизм (doXorSelectedStep) не тронут — он остался за прогонами "Авто". */
const bXorSelectedEl = document.getElementById("bXorSelected");
if (bXorSelectedEl) {
  bXorSelectedEl.onclick = () => {
    if (!st.selectedRows || st.selectedRows.size === 0) { say("XOR выдел: выделите строку кликом."); return; }
    const sel = Array.from(st.selectedRows).sort((a, b) => a - b);
    const dstIdx = sel[sel.length - 1];
    const idxs = sel.length > 1 ? sel : Array.from({ length: dstIdx + 1 }, (_, i) => i);
    if (idxs.length < 2) { say("XOR выдел: складывать нечего — над выделенной строкой ничего нет."); return; }
    const res = xorRowsDownTo(st.rows, dstIdx, st.align, st, idxs);
    if (!res.length) { say("XOR выдел: все участвующие строки пусты."); return; }
    snapshot();
    st.rows[dstIdx] = res;
    // Длина строки изменилась — прежние флаги перевёрнутых бит к ней уже не относятся.
    invFlagsMap.delete(dstIdx);
    // НАШЁЛСЯ ФОН-ПОИСК — ПЕРЕКЛЮЧАЕМ ВЫДЕЛЕНИЕ КАК ОБЫЧНО (запрос пользователя), то есть на
    // строку ниже: выделение съезжает на одну вниз ЦЕЛИКОМ (у одной строки это и есть обычный
    // переход на следующую, у нескольких — то же окно, сдвинутое на строку). Считаем находку ДО
    // переезда: фон-поиск смотрит на паттерн строки ПОД выделенной, а выделение как раз на неё и
    // переедет. Не нашлось — выделение стоит, где стояло.
    const bgInfo = computeBgSearchTarget();
    const matched = !!(bgInfo && bgInfo.matched);
    const canMove = matched && dstIdx + 1 < st.rows.length;
    if (canMove) st.selectedRows = new Set(sel.map(r => r + 1));
    render(); saveCache();
    say((sel.length > 1
      ? `XOR выдел: сложены выделенные строки (${sel.map(r => r + 1).join(", ")}) — результат записан в строку №${dstIdx + 1}. `
      : `XOR выдел: сложены строки №1…№${dstIdx + 1} — результат записан в строку №${dstIdx + 1}. `) +
      (canMove ? `Фон-поиск нашёл паттерн строки №${dstIdx + 2} — выделение съехало на строку ниже.`
               : matched ? "Фон-поиск нашёл, но ниже строк нет — выделение осталось на месте."
                         : "Фон-поиск ничего не нашёл — выделение осталось на месте."));
    logStep("XOR выдел", sel.length > 1 ? sel.map(r => r + 1).join(",") : `1–${dstIdx + 1}`, "", res);
  };
}

/* "⨁ XOR чёт" (v0.960, запрос пользователя: "здесь xor раздели на две кнопки — та, что сейчас, и
   XOR по своим чётностям, строкам всем сверху, так же"). Отдельная кнопка рядом с "⨁ XOR выдел",
   вся разница — В НАБОРЕ СКЛАДЫВАЕМЫХ СТРОК:
     "⨁ XOR выдел" — подряд все строки сверху до выделенной (или ровно выделенные);
     "⨁ XOR чёт"   — сверху до выделенной, но ТОЛЬКО те, чья ДЛИНА той же чётности, что у неё:
                     у выделенной 8 бит → идут все строки чётной длины (2, 4, 6, 8, 10…);
                     у выделенной 7 бит → все нечётной (1, 3, 5, 7, 9…).
   ЧЁТНОСТЬ БЕРЁТСЯ ИЗ ДЛИНЫ СТРОКИ, а не из её номера (уточнение пользователя, v0.961): считаем
   по числу бит в самой строке (st.rows[i].length) — то же число, что видно в колонке длин.
   Пустые строки пропускаются: длины у них нет, а формально нулевая длина затащила бы их во
   всякий "чётный" набор.
   Несколько выделенных строк набор НЕ задают (в отличие от "XOR выдел"): чётность берётся у
   самой нижней из них, и складывается всё сверху по этой чётности — иначе кнопка повторяла бы
   соседнюю. Всё остальное — геометрия колонок (xorRowsDownTo), запись результата в выделенную
   строку, сброс invFlagsMap и переезд выделения вниз при находке фон-поиска — один в один как у
   "⨁ XOR выдел". */
const bXorParityEl = document.getElementById("bXorParity");
if (bXorParityEl) {
  bXorParityEl.onclick = () => {
    if (!st.selectedRows || st.selectedRows.size === 0) { say("XOR чёт: выделите строку кликом."); return; }
    const sel = Array.from(st.selectedRows).sort((a, b) => a - b);
    const dstIdx = sel[sel.length - 1];
    const rowLen = i => (st.rows[i] ? st.rows[i].length : 0);
    const selLen = rowLen(dstIdx); // ДО записи результата: он ложится в эту же строку и её длину меняет
    const want = selLen % 2;
    if (!selLen) { say("XOR чёт: выделенная строка пуста — не от чего брать чётность длины."); return; }
    const idxs = [];
    for (let i = 0; i <= dstIdx; i++) if (rowLen(i) && rowLen(i) % 2 === want) idxs.push(i);
    const parWord = want === 0 ? "чётной" : "нечётной";
    if (idxs.length < 2) { say(`XOR чёт: складывать нечего — выше выделенной нет строк ${parWord} длины.`); return; }
    const res = xorRowsDownTo(st.rows, dstIdx, st.align, st, idxs);
    if (!res.length) { say("XOR чёт: все участвующие строки пусты."); return; }
    snapshot();
    st.rows[dstIdx] = res;
    // Длина строки изменилась — прежние флаги перевёрнутых бит к ней уже не относятся.
    invFlagsMap.delete(dstIdx);
    // Находку считаем ДО переезда выделения — ровно как в "⨁ XOR выдел" (см. там же почему).
    const bgInfo = computeBgSearchTarget();
    const matched = !!(bgInfo && bgInfo.matched);
    const canMove = matched && dstIdx + 1 < st.rows.length;
    if (canMove) st.selectedRows = new Set(sel.map(r => r + 1));
    render(); saveCache();
    const nums = idxs.map(rowLabel).join(", ");
    say(`XOR чёт: сложены строки ${parWord} длины — №${nums} (по ${selLen} бит у выделенной). Результат записан в строку ${rowLabel(dstIdx)}. ` +
      (canMove ? `Фон-поиск нашёл паттерн строки ниже — выделение съехало на строку вниз.`
               : matched ? "Фон-поиск нашёл, но ниже строк нет — выделение осталось на месте."
                         : "Фон-поиск ничего не нашёл — выделение осталось на месте."));
    logStep("XOR чёт", nums, "", res);
  };
}

/* "⧬ Интерлив" — ОДИН шаг по выделению (запрос пользователя: "записать в нижнюю, переписав её, и
   выделение на неё перепрыгнуть, если она совпала с паттерном"). Переплетаются те же две строки,
   что и у одноимённого режима фон-поиска: строка НАД выделенной и сама выделенная
   (interleavePairRows — значит с учётом полустолбцов "½"-выравниваний и показанных зеркал).
   Результат ПЕРЕЗАПИСЫВАЕТ СТРОКУ ПОД ВЫДЕЛЕННОЙ (если её нет — она создаётся внизу, v0.959) и
   сверяется с ЕЁ ЖЕ паттерном — тем самым, что и так сверяет фон-поиск. НАШЁЛСЯ — выделение перепрыгивает на эту нижнюю строку (следующее
   нажатие переплетёт уже следующую пару вниз); НЕ нашёлся — выделение остаётся на месте (раньше
   переезжало безусловно).
   Прежнее поведение (режим st.interleaveMode: прогон по парам сверху вниз) отсюда убрано; сам
   пошаговый механизм (doInterleaveStep) остался нетронутым для "⧬ Интерлив сквозной" и прогонов. */
const bInterleaveSearchEl = document.getElementById("bInterleaveSearch");
if (bInterleaveSearchEl) {
  bInterleaveSearchEl.onclick = () => {
    if (!st.selectedRows || !st.selectedRows.size) { say("⧬ Интерлив: выделите строку кликом."); return; }
    const selIdx = Math.max(...st.selectedRows);
    const aboveIdx = selIdx - 1, targetIdx = selIdx + 1;
    if (aboveIdx < 0) { say("⧬ Интерлив: нужна строка НАД выделенной — переплетать не с чем."); return; }
    const res = interleavePairRows(st, aboveIdx, selIdx, st.align);
    if (!res.length) { say("⧬ Интерлив: обе строки пусты — переплетать нечего."); return; }
    snapshot();
    // СТРОКИ ПОД ВЫДЕЛЕННОЙ НЕТ — ЗАВОДИМ ЕЁ (v0.959, запрос пользователя: "если нет, то всё
    // равно записать — создать строку"). Раньше кнопка тут просто ругалась и не делала ничего,
    // и спуск подряд ("жать ⧬ и ехать вниз") обрывался на последней строке цепочки.
    // Выделенная строка всегда существует, значит targetIdx = selIdx + 1 максимум равен
    // st.rows.length — дописать надо ровно одну пустую строку в самый низ.
    // Колонку паттернов НЕ трогаем (у новой строки паттерна нет, сверять нечего): длины массивов
    // расходятся штатно, число строк на экране = Math.max(rows.length, pats.length).
    const rowAdded = targetIdx >= st.rows.length;
    if (rowAdded) { st.rows.push(""); st.used.push(false); }
    st.rows[targetIdx] = res;
    // Длина строки изменилась — позиционные флаги к ней больше не относятся (как и везде, где
    // строка переписывается целиком).
    insertedFlagsMap.delete(targetIdx);
    invFlagsMap.delete(targetIdx);
    maskChangedMap.clear(); maskBaseRows = null;
    st.hit = null;
    // Паттерн ЭТОЙ ЖЕ строки — ровно тот, что сверял фон-поиск и раньше. Сверка общая
    // (findPatternKinds), то есть с теми же настройками: ⏭ Без 1-го, ⇌ Инв/Рев, кольцо и прочее.
    const pat = st.pats[targetIdx];
    const patText = pat && pat.text ? pat.text : "";
    const kinds = patText ? findPatternKinds(res, patText) : null;
    const found = !!(kinds && kinds.length);
    // ВЫДЕЛЕНИЕ ПРЫГАЕТ НА НЕЁ ВСЕГДА (запрос пользователя: "вниз делает интерливинг и сам туда
    // прыгает"), независимо от того, совпал паттерн или нет: бывшая выделенная становится
    // "строкой сверху", и следующее нажатие переплетает уже следующую пару вниз — кнопку можно
    // жать подряд, спускаясь по цепочке. Короткое время условие было "прыгать только при
    // находке" (v0.775) — без находки выделение стояло, и спуск обрывался.
    // С включённым "⬇ Расширять вниз" выделение не переезжает, а ДОРАСТАЕТ до неё — прежние
    // строки остаются выделенными.
    if (st.growDownOnFind) {
      st.selectedRows.add(targetIdx);
      st.captureGrown = true;
    } else {
      st.selectedRows = new Set([targetIdx]);
      st.captureGrown = false;
    }
    // Граница показа зеркал/участка сместилась вместе с выделением — новой строке своё зеркало
    // (если включены "⇔ Авто-зеркала"), как и при захвате находки.
    mirrorsAutoStep();
    say(`⧬ Интерлив: строки ${rowLabel(aboveIdx)}+${rowLabel(selIdx)} переплетены в строку ${rowLabel(targetIdx)} (${res.length} бит) — ` +
        (patText ? (found ? `паттерн этой строки НАЙДЕН (${KIND_LABELS_RU[kinds[0].kind] || "прямая"}).`
                          : "паттерна этой строки в ней нет.")
                 : "у неё нет паттерна для сверки.") +
        " Выделение перепрыгнуло на неё." + (rowAdded ? " Строки под выделенной не было — она создана внизу." : ""));
    logStep("Интерлив", `${rowLabel(aboveIdx)}+${rowLabel(selIdx)} → ${rowLabel(targetIdx)}`, res, found ? "паттерн найден" : "");
    render(); saveCache();
  };
}

/* "⧬ Интерлив сквозной" — старт с строки, отмеченной выделением (нужна хотя бы одна строка ВЫШЕ
   для сквозной и одна строка НИЖЕ для паттерна-цели, см. doInterleaveSeqStep()). Если поиск УЖЕ
   идёт (st.interleaveSeqMode) — повторный клик кнопкой ПРОДОЛЖАЕТ его на один сдвиг дальше, а не
   перезапускает с offset=0 на той же строке: раньше сброс шёл БЕЗУСЛОВНО на каждый клик, поэтому
   ручные повторные клики (в отличие от "🚀 Авто", который сам крутит цикл и сюда не заходит)
   зацикливались на первом же сдвиге (см. запрос пользователя — "не делает сдвиги"). */
const bInterleaveSeqSearchEl = document.getElementById("bInterleaveSeqSearch");
if (bInterleaveSeqSearchEl) {
  bInterleaveSeqSearchEl.onclick = () => {
    if (st.interleaveSeqMode) { doInterleaveSeqStep(); return; }
    if (!st.selectedRows || st.selectedRows.size === 0) { say("Выделите строку кликом."); return; }
    const idx = Math.min(...Array.from(st.selectedRows));
    if (idx <= 0 || idx + 1 >= st.rows.length) {
      say("Нужна хотя бы одна строка выше выделенной (для сквозной) и одна ниже (для паттерна).");
      return;
    }
    // Взаимоисключающая подсветка с остальными "режимами Авто" (Шаг/XOR/.../Круг/Спираль/XOR
    // сквозной) — тот же приём, что и у setLastDirMode()/setMode(): гасим их, раз теперь этот
    // режим тоже полноценно участвует в mode-act (см. запрос пользователя, кнопка перенесена
    // в flowGroup).
    if (st.lastDirMode) setLastDirMode(null);
    STEP_MODE_BTN_IDS.forEach(id => { const el = document.getElementById(id); if (el) el.classList.remove("mode-act"); });
    st.xorSelectedMode = false;
    st.interleaveMode = false;
    st.xorSeqMode = false;
    const xorSeqBtn = document.getElementById("bXorSeqSearch");
    if (xorSeqBtn) xorSeqBtn.classList.remove("mode-act");

    st.interleaveSeqMode = true;
    st.interleaveSeqIdx = idx;
    st.interleaveSeqOffset = 0;
    st.interleaveSeqTryRow = -1;
    st.interleaveSeqBlockN = 1;
    bInterleaveSeqSearchEl.classList.add("mode-act");
    say(`Режим Интерлив сквозной активен. Ищу подходящий поворот...`);
    doInterleaveSeqStep();
  };
}

/* "⨁ XOR сквозной" — то же самое, что "⧬ Интерлив сквозной" выше, только XOR вместо интерливинга
   (см. doXorSeqStep(), запрос пользователя — "также надо чтобы работал Xor"). */
const bXorSeqSearchEl = document.getElementById("bXorSeqSearch");
if (bXorSeqSearchEl) {
  bXorSeqSearchEl.onclick = () => {
    if (st.xorSeqMode) { doXorSeqStep(); return; }
    if (!st.selectedRows || st.selectedRows.size === 0) { say("Выделите строку кликом."); return; }
    const idx = Math.min(...Array.from(st.selectedRows));
    if (idx <= 0 || idx + 1 >= st.rows.length) {
      say("Нужна хотя бы одна строка выше выделенной (для сквозной) и одна ниже (для паттерна).");
      return;
    }
    if (st.lastDirMode) setLastDirMode(null);
    STEP_MODE_BTN_IDS.forEach(id => { const el = document.getElementById(id); if (el) el.classList.remove("mode-act"); });
    st.xorSelectedMode = false;
    st.interleaveMode = false;
    st.interleaveSeqMode = false;
    const seqBtn = document.getElementById("bInterleaveSeqSearch");
    if (seqBtn) seqBtn.classList.remove("mode-act");

    st.xorSeqMode = true;
    st.xorSeqIdx = idx;
    st.xorSeqOffset = 0;
    st.xorSeqTryRow = -1;
    bXorSeqSearchEl.classList.add("mode-act");
    say(`Режим XOR сквозной активен. Ищу подходящий поворот...`);
    doXorSeqStep();
  };
}

/* "🔎 Проверка" — ПРОСТОЙ ШАГ БЕЗ СДВИГОВ (запрос пользователя: "нужна кнопка простого шага без
   сдвигов всяких, вдруг уже есть паттерны — смотреть"). Все остальные шаги что-нибудь двигают:
   ▶ Шаг крутит строку (autoShift), ⨁ XOR дополняет нулями и переписывает строки, Гориз.XOR гонит
   скользящую цепочку, ◄/► Круг поворачивают. Иногда нужно ровно обратное — НИЧЕГО не трогая,
   посмотреть, не совпал ли паттерн ПРЯМО СЕЙЧАС, в текущем положении строк.
   Эта кнопка не меняет ни одной строки: считает те же режимы фон-поиска, что и так считаются на
   каждом render() (computeBgSearchTarget — включая ВСЕ фазы "🎭 Маски"), и записывает разбор в
   "Черновик шага" + принудительно в "Лог находок". Именно принудительно: обычная запись в лог
   идёт только когда находка СМЕНИЛАСЬ (st.bgSearchLastHit, см. render), а тут пользователь сам
   спросил — ответ должен появиться, даже если та же строка уже была записана раньше.
   snapshot() НЕ берём — откатывать нечего, строки не тронуты. */
/* opts (v0.934) — только подпись шага в Черновике: {title, note}. Понадобилось "Проверке маской
   +1 бит" (doMaskGrowCheck ниже): проверка у неё ровно та же самая, отличается лишь тем, что в
   разборе шага надо видеть, каким именно началом маски она сделана. */
function doPlainCheck(opts){
  if (!bgSearchActive()) {
    say("🔎 Проверка: фон-поиск выключен — включите его (клик по заголовку «🔍 Фон-поиск») и отметьте хотя бы один режим.");
    return false;
  }
  const bg = computeBgSearchTarget();
  if (!bg) {
    say("🔎 Проверка: нет цели — выделите кликом строку (не самую первую), паттерн берётся из строки под ней.");
    return false;
  }
  const hits = bg.results.filter(r => r.matched);
  const mask = (typeof maskBits === "function") ? maskBits() : "";
  // Итог шага — СПИСОК СОВПАВШИХ РЕЖИМОВ (с фазой маски прямо в подписи, см. bgModeShortLabel),
  // а не битовая строка: битов тут нет ни одной "своей", их показывает панель "Результат".
  const summary = hits.length
    ? hits.map(r => bgModeShortLabel(r.mode) + "[" + r.kinds.map(kd => KIND_LABELS_SHORT[kd.kind] + (kd.skip ? "⏭" : "")).join(",") + "]").join("  ")
    : "совпадений нет";
  const summaryHtml = hits.length
    ? hits.map(r => '<span class="chain-hit-bits' + (KIND_CLS[r.kinds[0].kind] ? " " + KIND_CLS[r.kinds[0].kind] : "") + '">' +
        esc(bgModeShortLabel(r.mode)) + '</span> ').join("")
    : '<span class="empty">совпадений нет</span>';
  /* opts.pickHit (v0.951, запрос пользователя "пусть если найдёт — сразу подсветит её в строках"):
     кладём найденный режим в st.bgHitPick — тот самый механизм, которым клик по строке находки
     раскладывает её по битам цепочки (см. hitRes в render). Раньше после успешного шага надо было
     ещё найти находку глазами в «Результате» и кликнуть по ней. Берём ПЕРВЫЙ совпавший режим:
     их может быть несколько, а показать в строках можно только один. */
  if (opts && opts.pickHit && hits.length) st.bgHitPick = hits[0].mode;
  /* ЧТО ИМЕННО НАШЛОСЬ — В ЧЕРНОВИК (v0.952, запрос пользователя "найденный результат записать в
     черновик: номер паттерна, паттерн и где нашёлся"). Раньше в разборе шага стоял только список
     совпавших режимов, а сам искомый паттерн и место находки приходилось выковыривать из панели
     "Результат". Пишем номер строки-цели, её паттерн и по каждому совпавшему режиму — вид
     совпадения и позицию с длиной. Больше четырёх режимов не перечисляем: подпись шага и так
     длинная, а полный разбор всё равно ниже, в блоках Черновика. */
  const targetPat = (st.pats[bg.targetIdx] && st.pats[bg.targetIdx].text) || "";
  const foundNote = hits.length
    ? ` НАЙДЕНО — паттерн №${bg.targetIdx + 1} «${targetPat}»: ` +
      hits.slice(0, 4).map(r => bgModeShortLabel(r.mode) + " — " +
        r.kinds.map(kd => KIND_LABELS_RU[kd.kind] + (kd.skip ? " без 1-го" : "") +
          ", позиция " + (kd.start + 1) + ", длина " + kd.len).join("; ")
      ).join(" | ") + (hits.length > 4 ? ` и ещё режимов: ${hits.length - 4}` : "") + "."
    : "";
  st.step++;
  logStep((opts && opts.title) || "🔎 Проверка без сдвигов",
    `${rowLabel(bg.aboveIdx)}+${rowLabel(bg.selIdx)}`,
    summary,
    ((opts && opts.note) ? opts.note + " " : "") +
      `Проверено режимов: ${bg.results.length}` + (mask ? ` (маска ${mask}, ${mask.length} фаз)` : "") +
      `; совпало: ${hits.length}. Строки не менялись.` + foundNote,
    [],
    // Искомый паттерн — отдельной строкой во «Входах»: он и есть то, что ищут, а раньше в разборе
    // шага его битов не было вовсе.
    [{ name: "№" + rowLabel(bg.aboveIdx), text: bg.rowAbove },
     { name: "№" + rowLabel(bg.selIdx), text: bg.rowSel },
     { name: "патт. №" + (bg.targetIdx + 1), text: targetPat }],
    null, summaryHtml);
  if (hits.length) {
    // Та же форма записи, что и у автоматического лога (mode -> kinds), см. render() → bgFindLog.
    const matches = {};
    for (const r of hits) matches[r.mode] = r.kinds;
    bgFindLog.unshift({ row: bg.targetIdx, step: 0, matches });
    if (bgFindLog.length > BG_FIND_LOG_MAX) bgFindLog.length = BG_FIND_LOG_MAX;
    say(`🔎 Проверка: паттерн строки ${rowLabel(bg.targetIdx)} УЖЕ найден — совпало режимов: ${hits.length}. Разбор — в Черновике и «Логе находок».`);
  } else {
    say(`🔎 Проверка: в текущем положении паттерн строки ${rowLabel(bg.targetIdx)} не найден ни одним из ${bg.results.length} режимов.` +
        (mask ? ` Маска ${mask} — все ${mask.length} фаз расписаны в Черновике.` : ""));
  }
  render();
  return hits.length > 0;
}

/* === "📈 ПРОВЕРКА МАСКОЙ +1 БИТ" (v0.934) ==================================================
   Запрос пользователя: "кнопку шаг проверки по сквозной маске по нарастающей, берёт первые биты
   маски (минимум чтобы были 1 и 0) — потом следующий бит, потом ещё бит, и так маска растёт на
   1 бит за одну проверку, проверить всю длину, несколько шагов — всё в черновике подробно
   описать: какая сейчас маска, строка, фаза".
   ОДИН КЛИК = ОДИН ШАГ. Маска берётся не откуда-то ещё, а из того же поля «🎭 Маска (прореж.)»:
   первый шаг ставит в него САМОЕ КОРОТКОЕ НАЧАЛО этой маски, в котором есть и «1», и «0» (короче
   нельзя — маска без нуля ничего не выбрасывает, без единицы ничего не берёт, и maskBitsRaw
   такую всё равно считает отсутствующей), каждый следующий — на один бит длиннее. Дошли до
   полной длины — следующий клик начинает с начала.
   Зачем: длинные маски из «➡ Сквозные» целиком берут почти ничего, зато их короткие начала —
   вполне осмысленные прореживания, и главное видно, НА КАКОЙ ДЛИНЕ находка появляется или
   пропадает. Сама проверка — та же doPlainCheck (строки не двигаются, считаются все включённые
   режимы и все фазы маски), поэтому весь разбор шага — маска, прорежённые строки по фазам,
   сквозная с наложенной маской — рисуется обычным Черновиком, без своего кода отрисовки.
   ПОЛНАЯ МАСКА обхода живёт в st.maskGrowBase отдельно от поля: в поле по ходу дела стоит
   очередное НАЧАЛО, и брать базу оттуда же значило бы, что маска перестанет расти. Если поле
   поправили руками (в нём уже не то начало, что мы ставили) — обход начинается заново от того,
   что в поле сейчас. */
function maskGrowMinLen(base){
  for (let k = 2; k <= base.length; k++){
    const p = base.slice(0, k);
    if (p.indexOf("1") >= 0 && p.indexOf("0") >= 0) return k;
  }
  return 0;
}
// Длинные маски (сквозная — тысячи бит) в подпись шага целиком не влезают.
function maskShortNote(m){ return m.length > 48 ? (m.slice(0, 48) + "…") : m; }
// Флаг для авто-шага (v0.952): последний шаг замкнул круг — список масок пройден целиком.
var maskGrowWrapped = false;
function doMaskGrowCheck(){
  maskGrowWrapped = false;
  const field = (typeof maskBitsRaw === "function") ? maskBitsRaw() : "";
  /* ИСТОЧНИК — МНОГОСТРОЧНОЕ ПОЛЕ СПИСКА (v0.947, запрос пользователя "это должно работать из
     поля, куда вручную можно писать много строк"). Список масок под «🎭 Перебором» и так набирают
     руками или кнопками-заполнителями — логично наращивать именно его маски, а не одну из
     однострочного поля. Обход идёт ПО ОЧЕРЕДИ: сначала все начала первой маски списка, потом
     второй и так далее; кончился список — начинаем сначала. Список пуст — работаем как раньше,
     по маске из поля «🎭 Маска (прореж.)». */
  const list = (typeof maskScanListMasks === "function") ? maskScanListMasks() : [];
  /* ПУСТО И ТАМ, И ТАМ — БЕРЁМ СКВОЗНУЮ ВЫДЕЛЕННОЙ СТРОКИ (v0.953, запрос пользователя: "если в
     поле для маски ничего нет, то сам берёт сквозную из фон-поиска для выделенной строки, потом
     при первой же находке переключает выделение и заново собирает сквозные, итд").
     Это самый частый сценарий: маску не набирают руками, её РОЛЬ играет сама цепочка, склеенная
     до выделенной строки (тот же concatRowsDownTo, что у режима «Сквозная →»). Наращивание тогда
     идёт по её началам, а после перехода на следующую строку сквозная собирается заново — уже
     длиннее на строку. Признак источника держим в st.maskGrowSrc: поле мы САМИ забиваем очередным
     началом, и по одному его виду отличить "пользователь ввёл маску" от "мы взяли сквозную"
     на следующем шаге уже нельзя. */
  let base = st.maskGrowBase || "";
  let len = st.maskGrowLen | 0;
  /* «ПРОДОЛЖАЕМ ОБХОД» — ТОЛЬКО ПО ПОЛЮ И БАЗЕ (исправлено в v0.956; баг-репорт пользователя:
     "маска не растёт, +1 бит не прибавляется, авто пишет что список пройден").
     В v0.947 сюда добавилось лишнее условие source[idx] === base — и оно ломало ВСЁ наращивание:
     очередное начало мы САМИ пишем в поле маски, а непустое поле на следующем шаге и становится
     источником. То есть source[0] — это уже префикс, а base — полная маска, равенства нет
     никогда, каждый шаг считался новым стартом, длина падала к минимальной, и следующий вызов
     сразу упирался в «маска пройдена целиком» → «круг замкнулся» → авто вставало.
     Признак продолжения ровно один: в поле стоит РОВНО ТО начало базы, которое мы туда положили. */
  const continuing = !!base && len > 0 && len <= base.length && field === base.slice(0, len);
  /* Источник нужен только когда обход НАЧИНАЕТСЯ или переходит к следующей маске. Пока идём по
     той же базе, источник — она сама: поле в этот момент занято её началом и о списке/сквозной
     ничего не говорит. */
  let seqBase = "";
  if (!list.length && !continuing && !field) {
    const sel = (st.selectedRows && st.selectedRows.size) ? Math.max(...st.selectedRows) : -1;
    if (sel >= 0 && typeof concatRowsDownTo === "function") seqBase = concatRowsDownTo(st, sel);
  }
  const source = list.length ? list
               : (continuing ? [base] : (field ? [field] : (seqBase ? [seqBase] : [])));
  if (!source.length) {
    say("📈 Наращивать нечего: список масок и поле «🎭 Маска (прореж.)» пусты, а строка не выделена — сквозную собрать не из чего.");
    return false;
  }
  let idx = st.maskGrowIdx | 0;
  if (idx >= source.length) idx = 0;
  let restarted = false, moved = false;
  /* Следующая ПРИГОДНАЯ маска списка: у которой вообще есть начало с «1» и «0» разом (сплошные
     единицы такого начала не дают — прореживать нечем, шагать не по чему). Возвращает -1, если
     весь список из таких. */
  const nextUsable = (from) => {
    for (let n = 0; n < source.length; n++) {
      const j = (from + n) % source.length;
      if (maskGrowMinLen(source[j]) > 0) return j;
    }
    return -1;
  };
  // continuing посчитан ВЫШЕ, до выбора источника (см. комментарий там же): источник зависит от
  // того, продолжаем мы обход или начинаем, а не наоборот.
  if (!continuing) {
    idx = nextUsable(0);
    restarted = true;
  } else if (len >= base.length) {
    // Эта маска пройдена целиком — переходим к следующей в списке.
    const nxt = nextUsable(idx + 1);
    moved = nxt !== idx;
    restarted = nxt <= idx;   // прокрутились по кругу к началу списка
    maskGrowWrapped = restarted;
    idx = nxt;
  } else {
    len++;
  }
  if (idx < 0) {
    say("📈 Наращивать нечего: ни в одной маске нет начала, где есть и «1», и «0».");
    return false;
  }
  if (!continuing) st.maskGrowSrc = list.length ? "list" : (seqBase ? "seq" : "field");
  if (!continuing || moved || restarted) {
    base = source[idx];
    len = maskGrowMinLen(base);
  }
  if (!len) {
    say("📈 Наращивать нечего: в маске нет ни одного начала, где есть и «1», и «0».");
    return false;
  }
  st.maskGrowIdx = idx;
  const min0 = maskGrowMinLen(base);
  const mask = base.slice(0, len);
  st.maskGrowBase = base;
  st.maskGrowLen = len;
  // Ставим начало в само поле: дальше всё (поиск, фазы, подсветка, Черновик) работает как с любой
  // обычной маской — отдельной ветки "а сейчас у нас растущая маска" в движке нет и не нужно.
  st.bgMaskText = mask;
  const el = elById("bgMaskText");
  if (el) el.value = mask;
  if (typeof updateBgMaskPaintBtn === "function") updateBgMaskPaintBtn();
  st.bgSearchLastHit = -1;
  const stepNo = len - min0 + 1, stepsTotal = base.length - min0 + 1;
  // Из какого источника идёт маска — видно и в Черновике, и в сообщении: со списком в работе важно
  // не потерять, какая по счёту его строка сейчас наращивается.
  const src = list.length ? `маска ${idx + 1} из ${list.length} в списке`
            : (st.maskGrowSrc === "seq" ? `сквозная до строки ${(st.selectedRows && st.selectedRows.size) ? Math.max(...st.selectedRows) + 1 : "?"} (${base.length} бит)`
                                        : "маска из поля");
  const note = `📈 Нарастающая маска (${src}): начало ${maskShortNote(mask)} — ${len} бит из ${base.length}` +
    ` (шаг ${stepNo} из ${stepsTotal}, фаз ${len})` +
    (moved ? ", перешли к следующей маске списка" : "") +
    (restarted ? ", обход начат заново" : "") +
    `. Полная маска: ${maskShortNote(base)}.`;
  const found = doPlainCheck({ title: "📈 Проверка маской +1 бит", note, pickHit: true });
  saveCache();
  // Своё сообщение — ПОСЛЕ doPlainCheck: там свой say(), и последний остаётся на экране.
  // Нашлось — плашка зелёная (say(..., "hit")): при долгом переборе шагов иначе не отличить.
  const last = len >= base.length && idx === source.length - 1;
  say(`📈 ${src}, шаг ${stepNo} из ${stepsTotal}: ${maskShortNote(mask)} (${len} из ${base.length} бит)` +
      (found ? " — ЕСТЬ находка, показана в строках." : " — находки нет.") +
      (len >= base.length
        ? (last ? " Список пройден, следующий клик начнёт сначала." : " Маска пройдена, следующий клик возьмёт следующую из списка.")
        : "") +
      " Подробный разбор — в Черновике.",
      found ? "hit" : "");
  if (found) render();   // st.bgHitPick выставлен внутри проверки — перерисовываем с подсветкой
  return found;
}
const bMaskGrowCheckEl = document.getElementById("bMaskGrowCheck");
if (bMaskGrowCheckEl) bMaskGrowCheckEl.onclick = () => doMaskGrowCheck();
/* АВТО-ШАГ (v0.952, запрос пользователя "нужен авто шаг"). Прокликать вручную тысячи начал
   невозможно, поэтому тот же doMaskGrowCheck крутится сам через setTimeout — не циклом: цикл
   заблокировал бы вкладку намертво, а тут между шагами браузер успевает и перерисовать, и принять
   нажатие «Стоп». Пауза берётся из «🐢 Замедления», как у обычного Авто (кадр ≈ 16мс), без него
   — минимальная. Останов: находка (при включённом «🛑 Стоп на находке»), полный круг по списку
   масок, повторное нажатие кнопки. */
let maskGrowAutoTimer = null;
function maskGrowAutoOn(){ return maskGrowAutoTimer !== null; }
function updateMaskGrowAutoBtn(){
  const b = elById("bMaskGrowAuto");
  if (!b) return;
  b.textContent = maskGrowAutoOn() ? "⏸ Стоп" : "▶ Авто";
  b.classList.toggle("mode-act", maskGrowAutoOn());
}
function maskGrowAutoStop(msg, kind){
  if (maskGrowAutoTimer !== null) { clearTimeout(maskGrowAutoTimer); maskGrowAutoTimer = null; }
  updateMaskGrowAutoBtn();
  if (msg) say(msg, kind || "");
}
function maskGrowAutoTick(){
  const found = doMaskGrowCheck();
  // Кнопку могли нажать повторно прямо во время шага — тогда таймера уже нет и продолжать нечего.
  if (maskGrowAutoTimer === null) return;
  /* НАШЛОСЬ — ПЕРЕХОДИМ НА СЛЕДУЮЩУЮ СТРОКУ И ИДЁМ ДАЛЬШЕ (v0.952, запрос пользователя "при
     находке выделить следующую строку и продолжить"). Цель поиска задаётся выделением: паттерн
     берётся из строки ПОД выделенной (см. computeBgSearchTarget), значит сдвиг выделения на
     строку вниз — это переход к следующему искомому паттерну. Наращивание маски при этом НЕ
     сбрасывается: продолжаем с того начала, на котором нашли, — на соседней строке оно чаще
     всего и работает. Строк ниже не осталось — останавливаемся. */
  if (found) {
    const cur = (st.selectedRows && st.selectedRows.size) ? Math.max(...st.selectedRows) : -1;
    const nextRow = cur + 1;
    const hasNext = cur >= 0 && nextRow < st.rows.length && (st.rows[nextRow] || "").length &&
                    (nextRow + 1) < st.rows.length && (st.rows[nextRow + 1] || "").length;
    if (!hasNext) {
      maskGrowAutoStop("📈 Авто остановлено: ЕСТЬ находка, но следующей строки с паттерном ниже уже нет.", "hit");
      return;
    }
    st.selectedRows = new Set([nextRow]);
    st.bgSearchLastHit = -1;
    /* Маска была СКВОЗНОЙ выделенной строки — значит для новой строки её надо собрать заново
       (v0.953, прямая просьба пользователя: "при первой же находке переключает выделение и заново
       собирает сквозные, итд"). Обнуляем обход И само поле: следующий шаг увидит пустое поле,
       пустой список — и возьмёт сквозную уже до новой строки, на строку длиннее.
       Список/ручная маска так не сбрасываются: их выбрали намеренно, и на новой строке они те же. */
    if (st.maskGrowSrc === "seq") {
      st.maskGrowBase = ""; st.maskGrowLen = 0; st.maskGrowIdx = 0;
      st.bgMaskText = "";
      const mel = elById("bgMaskText");
      if (mel) mel.value = "";
      if (typeof updateBgMaskPaintBtn === "function") updateBgMaskPaintBtn();
    }
    say(`📈 Находка! Выделение перешло на строку №${nextRow + 1}` +
        (st.maskGrowSrc === "seq" ? ", сквозная собирается заново — уже до неё." : ", продолжаю с той же маски."), "hit");
    render();
  }
  if (maskGrowWrapped) {
    maskGrowAutoStop("📈 Авто остановлено: список масок пройден целиком, находок больше нет.");
    return;
  }
  const pause = st.slowAuto ? Math.max(16, (st.slowFrames || 10) * 16) : 0;
  maskGrowAutoTimer = setTimeout(maskGrowAutoTick, pause);
}
const bMaskGrowAutoEl = document.getElementById("bMaskGrowAuto");
if (bMaskGrowAutoEl) bMaskGrowAutoEl.onclick = () => {
  if (maskGrowAutoOn()) { maskGrowAutoStop("📈 Авто остановлено вручную."); return; }
  maskGrowAutoTimer = setTimeout(maskGrowAutoTick, 0);
  updateMaskGrowAutoBtn();
  say("📈 Авто-шаг запущен: маска растёт сама. Остановится на находке, в конце списка или по кнопке «⏸ Стоп».");
};
updateMaskGrowAutoBtn();
const bMaskGrowResetEl = document.getElementById("bMaskGrowReset");
if (bMaskGrowResetEl) bMaskGrowResetEl.onclick = () => {
  if (typeof maskGrowAutoStop === "function") maskGrowAutoStop();   // сброс на ходу — сначала стоп
  st.maskGrowBase = ""; st.maskGrowLen = 0; st.maskGrowIdx = 0;
  saveCache();
  say("📈 Наращивание сброшено: следующий клик по «Проверка маской +1 бит» начнёт с первой маски списка (а если список пуст — с той, что стоит в поле).");
};

function doInterleaveStep() {
  if (!st.interleaveMode || st.interleavePairIdx < 0) return false;

  const aIdx = st.interleavePairIdx;
  const bIdx = aIdx + 1;

  if (bIdx >= st.rows.length) {
    st.interleaveMode = false;
    say("Конец строк.");
    return false;
  }

  const rowA = getRowBits(st, aIdx);
  const rowB = getRowBits(st, bIdx);
  const intResult = interleavePairRows(st, aIdx, bIdx, st.align);

  let searchResult = intResult;
  const cInterleaveXor = document.getElementById("cInterleaveXor");
  const useXor = cInterleaveXor && cInterleaveXor.checked;

  if (useXor) {
    searchResult = xorPair(intResult, rowB, st.align);
    say(`Интерливинг (${aIdx+1}-${bIdx+1}) + XOR нижней: ${searchResult}`);
  } else {
    say(`Интерливинг (${aIdx+1}-${bIdx+1}): ${searchResult}`);
  }

  const nextPatIdx = bIdx + 1;
  const nextPat = st.pats[nextPatIdx];

  if (!nextPat || !nextPat.text) {
    st.interleaveMode = false;
    say("Нет паттерна для сравнения.");
    return false;
  }

  const patFull = nextPat.text;
  const patSkip = patBase(patFull);
  const patRev = reverseStr(patFull);
  const patRevSkip = patRev.length > 1 ? patRev.slice(1) : "";

  let matchType = "";
  if (searchResult.indexOf(patFull) >= 0) {
    matchType = "паттерн целиком";
  } else if (patSkip !== patFull && searchResult.indexOf(patSkip) >= 0) {
    matchType = "паттерн без 1-го";
  } else if (searchResult.indexOf(patRev) >= 0) {
    matchType = "реверс целиком";
  } else if (patRevSkip && searchResult.indexOf(patRevSkip) >= 0) {
    matchType = "реверс без 1-го";
  }

  if (matchType) {
    st.interleaveMode = false;
    st.selectedRows.clear();
    st.selectedRows.add(bIdx);
    st.selectedRows.add(nextPatIdx);
    st.aIdx = bIdx;
    st.bIdx = nextPatIdx;
    render(); saveCache();
    say(`✓ Совпадение (${matchType})! Выделение на ${bIdx + 1}-${nextPatIdx + 1}`);
    return false;
  }

  st.interleavePairIdx = bIdx;
  return true;
}

/* "Интерлив сквозной" (см. #bInterleaveSeqSearch): правая часть — САМА строка idx, БЕЗ поворотов
   (как есть, getRowBits()); крутится не она, а ЛЕВАЯ часть — сквозная (все строки ВЫШЕ idx +
   САМА строка idx, horizChainText(idx) + getRowBits(st, idx) — см. запрос пользователя: без её
   собственных бит перебор поворотов не проходил по всей длине кольца): строка "прогоняется" по
   всей длине сквозной — крутится не сама сквозная, а её "кольцо" (seq + ringNextLap(seq), тот же
   довесок, что рисуется в Черновике как "Скв×2") — rotationsOf() перебирает повороты ЭТОГО
   удвоенного кольца, а не просто seq: без довеска перебор проходил только по половине того, что
   визуально показано кольцом, и при включённой 🔁 Инв.кольцо/реверс пропускал реально другие
   сдвиги (см. запрос пользователя). Дальше — повторяются. На каждом повороте строка интерливится
   с НАЧАЛА этого повёрнутого варианта (выравнивание всегда "left" — именно это и даёт "скольжение" строки по
   всей длине сквозной, а не одно фиксированное положение по st.align). Проверяем каждый сдвиг
   против паттерна СЛЕДУЮЩЕЙ строки (idx+1), как обычный Интерлив. Строка не меняется — нечего
   сохранять, просто фиксируем найденный сдвиг и, в отличие от обычного "⧬ Интерлив" (который
   останавливается на первом же совпадении), сразу продолжаем на следующую строку — та же
   сквозная теперь включает и её.

   Если у idx не нашлось совпадения НИ НА ОДНОМ сдвиге — не останавливаемся сразу, а пробуем
   строку НАД ней (idx-1), потом ещё выше и т.д., с той же самой (замороженной) сквозной и тем же
   паттерном-целью idx+1 (см. tryRow ниже, запрос пользователя). Останавливаемся, только когда
   НИ ОДНА строка от idx и выше не подошла, или строки кончились.

   ОДИН ВЫЗОВ = ОДИН СДВИГ (см. запрос пользователя — "пока так сделаем чтобы убедиться как
   работает"): не перебираем все повороты за раз молча, а на каждом отдельном сдвиге логируем
   сквозную (в её текущем повороте) и саму строку в "Черновик последнего шага" (logStep(), те же
   inputs, что показывает обычный черновик) — так видно, что реально проверяется на каждом шаге.
   st.interleaveSeqOffset хранит, на каком сдвиге текущей строки мы сейчас; сбрасывается в 0 при
   переходе на новую строку. */
/* Останавливает "Интерлив сквозной" и гасит подсветку её кнопки — единая точка выхода вместо
   разбросанных "st.interleaveSeqMode = false" по всей doInterleaveSeqStep(), чтобы подсветка
   .mode-act всегда гасла синхронно с самим флагом (см. запрос пользователя — режим должен вести
   себя как остальные режимы "Авто", взаимоисключающе). */
function stopInterleaveSeq(msg){
  st.interleaveSeqMode = false;
  const btn = document.getElementById("bInterleaveSeqSearch");
  if (btn) btn.classList.remove("mode-act");
  if (msg) say(msg);
}

function doInterleaveSeqStep() {
  if (!st.interleaveSeqMode || st.interleaveSeqIdx < 0) return false;

  const idx = st.interleaveSeqIdx;
  if (idx <= 0 || idx >= st.rows.length) {
    stopInterleaveSeq("Конец строк.");
    return false;
  }

  const nextPatIdx = idx + 1;
  const nextPat = st.pats[nextPatIdx];
  if (!nextPat || !nextPat.text) {
    stopInterleaveSeq("Нет паттерна для сравнения.");
    return false;
  }

  // Сквозная и паттерн-цель ЗАМОРОЖЕНЫ на весь перебор. Сквозная включает и саму ВЫДЕЛЕННУЮ
  // строку (idx), не только строки строго выше неё (см. запрос пользователя) — иначе перебор
  // поворотов не проходил по всей длине кольца.
  const seq = horizChainText(idx) + getRowBits(st, idx);
  if (!seq.length) {
    stopInterleaveSeq("Сквозная пустая — нет строк выше для интерливинга.");
    return false;
  }

  // 🪞 "Сквозная сама с собой" (st.seqSelfMode) — правая (неподвижная) часть тоже сама seq, а не
  // строка idx: сквозная въезжает сама в себя навстречу, голова к голове (см. запрос
  // пользователя).
  const selfMode = !!st.seqSelfMode;
  const row = selfMode ? seq : getRowBits(st, idx);
  // "Кольцо" для перебора поворотов — сква + ОДИН дополнительный виток (ringNextLap, тот же,
  // что рисуется в Черновике как "Скв×2") — см. запрос пользователя: без витка перебор шёл
  // только по ПОЛОВИНЕ того, что визуально показано кольцом. При включённой 🔁 Инв.кольцо/
  // реверс виток даёт РЕАЛЬНО другие сдвиги (не повтор seq), их нельзя пропускать.
  const ringSeq = seq + ringNextLap(seq);
  const seqRotations = row.length ? rotationsOf(ringSeq) : [];
  const offset = st.interleaveSeqOffset || 0;

  // 🧱 Блочный интерлив (st.interleaveSeqBlockN): раньше на "ни один сдвиг не подошёл" режим
  // переключался на строку ВЫШЕ — теперь ВМЕСТО этого пробует БОЛЬШИЙ размер блока: N=1 — обычный
  // побитовый интерлив (1 бит сквозной, 1 бит строки, снова 1...), N=2 — блоками по 2 символа,
  // N=3 — по 3, и т.д. (см. запрос пользователя — "если не наход, то делает интерливинг не через
  // 1 бит а через 2 бита потом через 3 и тд", "вместо" перехода на строку выше, не "и"). Строка
  // всегда одна — idx (или сама seq в selfMode), больше не переключается. Максимум — длина row:
  // при N ≥ row.length блок уже не даёт новой структуры (вся строка уходит одним куском).
  if (!st.interleaveSeqBlockN || st.interleaveSeqBlockN < 1) st.interleaveSeqBlockN = 1;
  const blockN = st.interleaveSeqBlockN;

  if (!row.length || offset >= seqRotations.length) {
    const maxN = Math.max(1, row.length);
    if (!row.length || blockN >= maxN) {
      st.interleaveSeqOffset = 0;
      st.interleaveSeqBlockN = 1;
      stopInterleaveSeq(`Интерлив сквозной${selfMode ? " (сама с собой)" : ""}: для строки ${idx + 1} совпадений не найдено ни на одном сдвиге ни при одном размере блока (1..${maxN}).`);
      return false;
    }
    st.interleaveSeqBlockN = blockN + 1;
    st.interleaveSeqOffset = 0;
    say(`Интерлив сквозной: блок ${blockN} не подошёл ни на одном сдвиге, пробую блок ${blockN + 1}...`);
    render(); saveCache();
    return true;
  }

  const patFull = nextPat.text;
  const seqRot = seqRotations[offset];
  const searchResult = interleavePair(seqRot, row, "left", blockN);

  // findPatternKinds() — тот же общий поиск, что и у обычных шагов/фон-поиска: сама учитывает
  // "⏭ Без 1-го" (st.skipFirst) И "⇌ Инв/Рев" (st.allKinds — инверсия/реверс/инверсия+реверс).
  // Она же ищет по КОЛЬЦУ (text + ringNextLap(text).slice(0,len-1) внутри) — а ringNextLap() сама
  // учитывает "🔁 Инв. кольцо" (st.ringInvert), так что и оно уже подключено само собой, раз
  // поиск идёт через findPatternKinds(), а не через ручной indexOf() (см. запросы пользователя —
  // "Без 1-го подключается?"/"Инв.кольцо тоже должна тут работать"/"по кольцу потом ищется?").
  const kinds = findPatternKinds(searchResult, patFull);
  const matchType = kinds.length ? KIND_LABELS_RU[kinds[0].kind] + (kinds[0].skip ? " (без 1-го)" : "") : "";

  // Раскраска "Итог" по ИСТОЧНИКУ каждого символа (все биты строки — синим) — см.
  // interleavePairMarked()/.interleave-src-row в CSS. И ДОПОЛНИТЕЛЬНО — сам найденный паттерн
  // (kinds, уже посчитан выше), чтобы было видно, ГДЕ конкретно совпадение (см. запрос
  // пользователя — "не вижу в результирующей нахождения паттерна"). blockN — та же блочность,
  // что и у самого поиска (searchResult), иначе подсветка разъехалась бы с текстом.
  const searchResultHtml = interleavePairMarked(seqRot, row, "left", kinds, blockN);

  // Для показа в Черновике — сквозная НЕПОДВИЖНА (не повёрнутая seqRot, а исходная seq) и
  // УДВОЕНА, т.к. сдвиг кольцевой — строка на больших offset вылезает за правый край ОДНОЙ
  // сквозной и "заезжает" на её начало по кругу, второй экземпляр справа это показывает вместо
  // обрезки на границе. Второй (довесочный) экземпляр — СЕРЫМ (та же .chain-ring-ext, что и у
  // "Результат фон-поиска"), чтобы визуально не путать его с настоящей сквозной; и это
  // ringNextLap(seq), а не голое повторение seq — если включена "🔁 Инв. кольцо" (st.ringInvert),
  // довесок реально ИНВЕРТИРОВАН (0↔1), как и при настоящем кольцевом поиске в
  // findPatternKinds() (см. запрос пользователя). Строка — с отступом в offset пробелов, чтобы
  // был виден сдвиг бит-в-бит (сам поиск по-прежнему считается через seqRot — это лишь то же
  // самое сравнение в эквивалентном отображении). Короткая подпись "Скв×2" (не длинное
  // описание) — не влезающая в 36px-колонку подписей сбивала бы общее выравнивание битов у всех
  // строк Черновика.
  const seqExtHtml = bitsHtml(seq) + '<span class="chain-ring-ext">' + bitsHtml(ringNextLap(seq)) + '</span>';
  const rowLabel = selfMode ? "Сквозная" : ("№" + (idx + 1));
  const blockTag = blockN > 1 ? `, блок ${blockN}` : "";
  const stepDesc = (selfMode ? "Сквозная сама с собой" : `Строка ${idx + 1}`) +
      `, сдвиг сквозной ${offset}/${seqRotations.length - 1}${blockTag}, паттерн строки ${nextPatIdx + 1} — ` +
      (matchType ? `совпадение (${matchType})` : "нет совпадения");
  logStep(
    "Интерлив сквозной",
    // selfMode: правая часть — вся сквозная 0..idx, показываем весь её диапазон строк, а не
    // одну строку (formatOpRows сам сожмёт массив в диапазон "1-N").
    selfMode ? Array.from({ length: idx + 1 }, (_, i) => i + 1) : [idx + 1],
    searchResult,
    stepDesc,
    [],
    [{ name: "Скв×2", html: seqExtHtml }, { name: rowLabel, text: " ".repeat(offset) + row }],
    null,
    searchResultHtml
  );
  // Живой пересчёт при смене st.seqGlueMode/st.ringInvert/st.ringReverse/st.seqSelfMode ПОСЛЕ
  // записи шага — см. recomputeSeqStepDisplay()/renderStepLogBox(). tryRow сохраняется = idx
  // (для совместимости с recomputeSeqStepDisplay, откат на строку выше там больше не бывает).
  st.lastOp.seqStepInfo = { idx, tryRow: idx, offset, blockN, mode: 'interleave' };

  const foundLabel = selfMode ? "сама с собой" : `строка ${idx + 1}`;
  if (matchType) {
    // В выделении остаётся ТОЛЬКО следующая строка (nextPatIdx), не обе — иначе повторный клик
    // по кнопке (он берёт старт как Math.min(...selectedRows), см. её обработчик) снова находил
    // бы МЕНЬШИЙ индекс (уже пройденную) и перезапускал поиск вместо продолжения дальше.
    st.selectedRows.clear();
    st.selectedRows.add(nextPatIdx);
    st.aIdx = idx;
    st.bIdx = nextPatIdx;
    say(`✓ Интерлив сквозной: ${foundLabel} — найдено (${matchType}, сдвиг сквозной ${offset}${blockTag}), иду дальше...`);
    st.interleaveSeqIdx = idx + 1;
    st.interleaveSeqOffset = 0;
    st.interleaveSeqBlockN = 1;
    render(); saveCache();
    return true;
  }

  st.interleaveSeqOffset = offset + 1;
  say(`Интерлив сквозной: ${foundLabel}, блок ${blockN}, сдвиг ${offset + 1}/${seqRotations.length}...`);
  render(); saveCache();
  return true;
}

/* Останавливает "XOR сквозной" и гасит подсветку её кнопки — см. stopInterleaveSeq() выше,
   тот же приём. */
function stopXorSeq(msg){
  st.xorSeqMode = false;
  const btn = document.getElementById("bXorSeqSearch");
  if (btn) btn.classList.remove("mode-act");
  if (msg) say(msg);
}

/* "XOR сквозной" (см. #bXorSeqSearch) — ПОЛНАЯ копия механики doInterleaveSeqStep() выше (та же
   заморозка сквозной/паттерна-цели, тот же перебор по кругу с откатом на строку выше при полном
   провале, тот же "один вызов = один сдвиг"), только комбинирование через xorPair()/
   xorPairMarked() вместо interleavePair()/interleavePairMarked() (см. запрос пользователя —
   "также надо чтобы работал Xor", по образцу интерливинга по сквозной). */
function doXorSeqStep() {
  if (!st.xorSeqMode || st.xorSeqIdx < 0) return false;

  const idx = st.xorSeqIdx;
  if (idx <= 0 || idx >= st.rows.length) {
    stopXorSeq("Конец строк.");
    return false;
  }

  const nextPatIdx = idx + 1;
  const nextPat = st.pats[nextPatIdx];
  if (!nextPat || !nextPat.text) {
    stopXorSeq("Нет паттерна для сравнения.");
    return false;
  }

  // Сквозная включает и саму ВЫДЕЛЕННУЮ строку (idx) — см. doInterleaveSeqStep() выше, тот же фикс.
  const seq = horizChainText(idx) + getRowBits(st, idx);
  if (!seq.length) {
    stopXorSeq("Сквозная пустая — нет строк выше для XOR.");
    return false;
  }

  // 🪞 "Сквозная сама с собой" (st.seqSelfMode) — см. doInterleaveSeqStep() выше, тот же фикс.
  const selfMode = !!st.seqSelfMode;
  if (st.xorSeqTryRow < 0 || st.xorSeqTryRow > idx) st.xorSeqTryRow = idx;
  const tryRow = selfMode ? idx : st.xorSeqTryRow;

  const row = selfMode ? seq : getRowBits(st, tryRow);
  // "Кольцо" для перебора — см. doInterleaveSeqStep() выше, тот же фикс (иначе перебор шёл
  // только по половине кольца, показанного в Черновике как "Скв×2").
  const ringSeq = seq + ringNextLap(seq);
  const seqRotations = row.length ? rotationsOf(ringSeq) : [];
  const offset = st.xorSeqOffset || 0;

  if (!row.length || offset >= seqRotations.length) {
    if (selfMode || tryRow <= 0) {
      st.xorSeqOffset = 0;
      st.xorSeqTryRow = -1;
      stopXorSeq(selfMode
        ? `XOR сквозной (сама с собой): для строки ${idx + 1} совпадений не найдено ни на одном сдвиге.`
        : `XOR сквозной: для строки ${idx + 1} совпадений не найдено ни в одной строке от неё и выше.`);
      return false;
    }
    st.xorSeqTryRow = tryRow - 1;
    st.xorSeqOffset = 0;
    say(`XOR сквозной: строка ${tryRow + 1} не подошла ни на одном сдвиге, пробую строку ${tryRow} (выше)...`);
    render(); saveCache();
    return true;
  }

  const patFull = nextPat.text;
  const seqRot = seqRotations[offset];
  const searchResult = xorPair(seqRot, row, "left");

  const kinds = findPatternKinds(searchResult, patFull);
  const matchType = kinds.length ? KIND_LABELS_RU[kinds[0].kind] + (kinds[0].skip ? " (без 1-го)" : "") : "";

  // Подсветка найденного паттерна поверх "Итога" — см. interleavePairMarked() выше.
  const searchResultHtml = xorPairMarked(seqRot, row, "left", kinds);
  const seqExtHtml = bitsHtml(seq) + '<span class="chain-ring-ext">' + bitsHtml(ringNextLap(seq)) + '</span>';
  const rowLabel = selfMode ? "Сквозная" : ("№" + (tryRow + 1));
  const stepDesc = (selfMode ? "Сквозная сама с собой" : (`Строка ${tryRow + 1}` + (tryRow !== idx ? ` (вместо ${idx + 1})` : ""))) +
      `, сдвиг сквозной ${offset}/${seqRotations.length - 1}, паттерн строки ${nextPatIdx + 1} — ` +
      (matchType ? `совпадение (${matchType})` : "нет совпадения");
  logStep(
    "XOR сквозной",
    selfMode ? Array.from({ length: idx + 1 }, (_, i) => i + 1) : [tryRow + 1],
    searchResult,
    stepDesc,
    [],
    [{ name: "Скв×2", html: seqExtHtml }, { name: rowLabel, text: " ".repeat(offset) + row }],
    null,
    searchResultHtml
  );
  st.lastOp.seqStepInfo = { idx, tryRow, offset, mode: 'xor' };

  const foundLabel = selfMode ? "сама с собой" : `строка ${tryRow + 1}`;
  if (matchType) {
    st.selectedRows.clear();
    st.selectedRows.add(nextPatIdx);
    st.aIdx = tryRow;
    st.bIdx = nextPatIdx;
    say(`✓ XOR сквозной: ${foundLabel} — найдено (${matchType}, сдвиг сквозной ${offset}), иду дальше...`);
    st.xorSeqIdx = idx + 1;
    st.xorSeqTryRow = -1;
    st.xorSeqOffset = 0;
    render(); saveCache();
    return true;
  }

  st.xorSeqOffset = offset + 1;
  say(`XOR сквозной: ${foundLabel}, сдвиг ${offset + 1}/${seqRotations.length}...`);
  render(); saveCache();
  return true;
}

function doXorSelectedStep() {
  if (!st.xorSelectedMode || st.xorSelectedIdx < 0) return false;

  const selIdx = st.xorSelectedIdx;
  const xorResult = xorRowsDownTo(st.rows, selIdx, st.align, st);

  const nextPatIdx = selIdx + 1;
  const nextPat = st.pats[nextPatIdx];

  if (!nextPat || !nextPat.text) {
    st.xorSelectedMode = false;
    say("Нет паттерна для сравнения.");
    return false;
  }

  const aIdx = 0, bIdx = nextPatIdx - 1;
  const chain = buildChain(st, aIdx, bIdx);
  const searchText = chain.text + xorResult;

  if (!searchText.length) {
    snapshot();
    st.rows[selIdx + 1] = rotateStrRight(st.rows[selIdx + 1]);
    render(); saveCache();
    return true;
  }

  const patFull = nextPat.text;
  const patSkip = patBase(patFull);
  const patRev = reverseStr(patFull);
  const patRevSkip = patRev.length > 1 ? patRev.slice(1) : "";

  let matchType = "";

  if (patFull && searchText.indexOf(patFull) >= 0) {
    matchType = "паттерн целиком";
  } else if (patSkip !== patFull && searchText.indexOf(patSkip) >= 0) {
    matchType = "паттерн без 1-го";
  } else if (patRev && searchText.indexOf(patRev) >= 0) {
    matchType = "реверс целиком";
  } else if (patRevSkip && searchText.indexOf(patRevSkip) >= 0) {
    matchType = "реверс без 1-го";
  }

  if (matchType) {
    st.xorSelectedMode = false;
    st.selectedRows.clear();
    st.selectedRows.add(selIdx + 1);
    st.aIdx = selIdx + 1;
    st.bIdx = Math.min(selIdx + 2, st.rows.length - 1);
    render(); saveCache();
    say(`✓ Совпадение (${matchType})! Перейдено на строку ${selIdx + 2}`);
    return false;
  }

  snapshot();
  st.rows[selIdx + 1] = rotateStrRight(st.rows[selIdx + 1]);
  render(); saveCache();
  return true;
}

/* СДВИНУТЬ ПОЛЕ/ВСЕ ПОЛЯ СТРЕЛКОЙ (v0.982/988, вынесено в отдельную функцию в v0.994 — теперь
   её зовут ДВА разных обработчика: Alt+стрелки (всегда) и замок 🔒 без Alt, когда последним
   хватали именно поле, а не границу, см. lastGrabWasBorder). Три цели, как решает lastPanField:
   "ALL" (кликнули мимо полей и строк) — все три поля разом; "L"/"R"/"C" (взяли конкретное поле за
   биты) — оно одно. До первого касания мышью — "C" (цепочка). */
function doFieldNudge(key){
  const dCols = key === "ArrowRight" ? 1 : (key === "ArrowLeft" ? -1 : 0);
  const dRows = key === "ArrowDown" ? 1 : (key === "ArrowUp" ? -1 : 0);
  if (lastPanField === "ALL" && typeof nudgeAllFields === "function") {
    nudgeAllFields(dCols, dRows);
    saveCache();
    say(`Все три поля: сдвиг на ${dCols ? (dCols > 0 ? "столбец вправо" : "столбец влево") : (dRows > 0 ? "строку вниз" : "строку вверх")}. Клик мимо полей и строк выбирает "все поля разом", клик по конкретному полю — снова только его; «⌖ Поля на место» во вкладке «Вид» вернёт всё к предустановкам.`);
  } else if (typeof nudgeField === "function") {
    nudgeField(lastPanField, dCols, dRows);
    saveCache();
    const nm = lastPanField === "L" ? "П1" : (lastPanField === "R" ? "П2" : "Цепочка");
    say(`${nm}: сдвиг на ${dCols ? (dCols > 0 ? "столбец вправо" : "столбец влево") : (dRows > 0 ? "строку вниз" : "строку вверх")}. Стрелки двигают поле, за которое брались последним (с Alt — всегда, без Alt — если под замком 🔒 и последней хватали именно поле); «⌖ Поля на место» во вкладке «Вид» вернёт всё к предустановкам.`);
  }
}

// ГЛОБАЛЬНЫЕ ХОТКЕИ (срабатывают, только если мы не вводим текст в инпутах)
document.addEventListener("keydown", e => {
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT") return;

  // Ctrl+Z / Cmd+Z — отмена ЛЮБОЙ ручной операции (снапшот берётся тем же
  // общим механизмом, что и у обычного шага: редактирование строки, сдвиг,
  // добавление нулей, удаление первого символа и т.д. — все они уже вызывают snapshot()).
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "z") {
    e.preventDefault();
    document.getElementById("bUndo").click();
    return;
  }

  // Ctrl+Y и Ctrl+Shift+Z — повтор отменённого (обе привычные раскладки сразу, см. кнопку
  // "↪ Повтор" в верхнем меню).
  if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))) {
    e.preventDefault();
    const rb = document.getElementById("bRedo");
    if (rb) rb.click();
    return;
  }

  // Ctrl+C / Cmd+C — копирует выделенные (кликом) строки текстом, с выравниванием (см.
  // copySelectedRows). Если ничего не выделено кликом ИЛИ есть обычное текстовое выделение
  // мышью (например в окошке результата) — не вмешиваемся, пусть браузер копирует как обычно.
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
    if (st.selectedRows && st.selectedRows.size > 0 && !window.getSelection().toString()) {
      e.preventDefault();
      copySelectedRows();
      return;
    }
  }

  // "+" и "−" — размер шрифта цепочки (запрос пользователя). Это тот же ползунок "Шрифт" в
  // настройках вида (#fs), поэтому подпись, высота строк и кэш обновляются сами. Ловим все
  // привычные варианты: основные клавиши, NumPad и "=" (на нём "+" без Shift). Ctrl/Meta не
  // трогаем — там системный зум браузера.
  if (!e.ctrlKey && !e.metaKey && !e.altKey && ("+=-−".includes(e.key) || e.key === "Add" || e.key === "Subtract")) {
    const fsEl = document.getElementById("fs");
    if (fsEl) {
      const step = (e.key === "-" || e.key === "−" || e.key === "Subtract") ? -1 : 1;
      const next = Math.max(+fsEl.min || 6, Math.min(+fsEl.max || 22, (+fsEl.value || 12) + step));
      if (next !== +fsEl.value) {
        e.preventDefault();
        fsEl.value = String(next);
        fsEl.dispatchEvent(new Event("input", { bubbles: true })); // тот же путь, что и мышью
      }
      return;
    }
  }

  // Q — горячая клавиша "🔢 Выбор столбца" вкл/выкл (запрос пользователя), без Ctrl/Alt/Meta,
  // чтобы не мешать системным сочетаниям.
  if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === "q") {
    e.preventDefault();
    setColPickMode(!colPickMode);
    return;
  }

  if (e.key === "Enter") {
    /* ПОД ЗАМКОМ (🔒) ENTER ТОЖЕ МОЛЧИТ (v0.996, запрос пользователя: "тут Энтер тоже отключи,
       Авто включает" — про то, что под замком случайное нажатие Enter запускало «▶ Авто»).
       Тот же принцип, что и у остальных клавиш под замком (см. selectionAllowed()): замок держит
       содержимое неприкосновенным, а случайный Enter посреди перетаскивания границы/поля не
       должен внезапно срывать прогон. preventDefault не ставим — под замком у Enter и так нет
       другого дела, глушить браузерное поведение (которого тут и не было бы — формы нет) незачем. */
    if (selectionAllowed()) {
      e.preventDefault();
      autoRun();
    }
  } else if (e.key === "Escape") {
    e.preventDefault();
    // РЕЖИМ ПЕРЕНОСА СТРОК Escape отменяет ПЕРВЫМ и на этом останавливается (запрос пользователя:
    // "если не сохранить, то при отключении режима или Escape — всё сбрасывать"). Дальше по
    // ветке идёт общий Сброс цепочки к шаблону, а он тут не нужен: человек отменяет раскрой, а
    // не всю работу.
    if (typeof wrapModeOn === "function" && wrapModeOn()) { wrapCancel(); return; }
    closeMenus();
    /* ESCAPE СНИМАЕТ ВСЕ ВЫДЕЛЕНИЯ РАЗОМ (v0.974, запрос пользователя: "сделай по Escape — убрать
       выделения все, и паттернов, строк и цепочек"). Наборов четыре, и живут они порознь:
       st.selectedRows — строки цепочки, st.selectedPats — ячейки колонки паттернов,
       cellSel — биты полотна, patCellSel — биты внутри паттерна (см. их объявления в fold-1-core).
       Раньше Escape не трогал выделение вовсе — это было прежнее требование ("Сброс/Escape
       выделение не трогает"), теперь отменено этим запросом. Выбранный столбец и накопитель
       "📌 Зафиксировать" снимаем заодно: это тоже выделения, просто других видов. */
    if (st.selectedRows) st.selectedRows.clear();
    if (st.selectedPats) st.selectedPats.clear();
    if (typeof cellSel !== "undefined") cellSel.clear();
    if (typeof patCellSel !== "undefined") patCellSel.clear();
    if (typeof cellPin !== "undefined") cellPin.clear();
    st.selectedCol = -1;
    st.captureGrown = false;
    // Escape сначала ОСТАНАВЛИВАЕТ прогоны — общий "Авто" и свой "Авто" Паттерн-цепочки, — и
    // только потом сбрасывает (запрос пользователя "пусть Esc останавливает и сбрасывает Авто
    // цепочки"). Без этого цепочка продолжала укладывать паттерны прямо поверх сброшенных строк.
    st.running = false;
    if (typeof patChainAutoTimer !== "undefined" && patChainAutoTimer) {
      patChainAutoStop("Паттерн-цепочка (Авто): остановлено (Escape).");
    }
    // Сброс по Escape НЕ выделяет первую строку на пустом выделении (запрос пользователя).
    resetNoAutoSelect = true;
    document.getElementById("bReset").click();
    // Выделение строк (st.selectedRows) Escape НЕ трогает — то же поведение, что и у клика по
    // самой кнопке "↺ Сброс" (см. resetAll()) — запрос пользователя (отменяет более раннее
    // "снимай выделение по Escape").
    // НАТИВНОЕ выделение текста браузером (протяжка мышью по битам/паттернам, обычный
    // window.getSelection()) — отдельная штука от st.selectedRows, Escape его по-прежнему чистит.
    if (window.getSelection) {
      const sel = window.getSelection();
      if (sel && sel.removeAllRanges) sel.removeAllRanges();
    }
  } else if (e.key === "Delete") {
    // Delete — удалить выделенные (кликом) строки. НЕ связано с откатом шага.
    e.preventDefault();
    deleteSelectedRows();
  } else if (e.key === "Backspace") {
    e.preventDefault();
    document.getElementById("bUndo").click();
  } else if (e.key === "F2") {
    // Редактирование выделенной строки (если выделена ровно одна)
    e.preventDefault();
    if (st.selectedRows && st.selectedRows.size === 1) {
      startEditRow([...st.selectedRows][0]);
    }
  } else if (e.altKey && (e.key === "ArrowLeft" || e.key === "ArrowRight" ||
                          e.key === "ArrowUp" || e.key === "ArrowDown")) {
    /* ALT + СТРЕЛКИ — ТОЧНАЯ ПОДГОНКА ПОЛЯ (v0.982, запрос пользователя). Мышью поле ведут грубо,
       а поставить его ровно на нужный столбец хочется без промаха: ←/→ — один СТОЛБЕЦ, ↑/↓ — одна
       СТРОКА. Сама логика — в doFieldNudge() ниже, её же зовёт замок 🔒 без Alt (v0.994).
       Ветка стоит ПЕРЕД замком (🔒): под замком стрелки без Alt двигают ГРАНИЦУ или ПОЛЕ в
       зависимости от того, за что брались последним (lastGrabWasBorder), а Alt+стрелки — ВСЕГДА
       про поле, независимо от замка и от того, что схвачено последним. */
    e.preventDefault();
    doFieldNudge(e.key);
  } else if (!selectionAllowed() && !lastGrabWasBorder && (e.key === "ArrowLeft" || e.key === "ArrowRight" ||
                                     e.key === "ArrowUp" || e.key === "ArrowDown")) {
    /* ПОД ЗАМКОМ (🔒), БЕЗ ALT, ПОСЛЕДНИМ БРАЛИ ПОЛЕ — ТЕ ЖЕ СТРЕЛКИ, ЧТО И С ALT (v0.994, запрос
       пользователя: "без Альта можно, если вкл" — про замок). Под замком стрелки и так свободны
       от своих обычных дел (сдвиг битов, выбор строк), поэтому Alt как доп. подтверждение больше
       не нужен — но ТОЛЬКО пока последним хватали ИМЕННО ПОЛЕ (см. lastGrabWasBorder ниже): если
       последней брали ГРАНИЦУ, эта же комбинация клавиш остаётся за её шириной (следующая ветка). */
    e.preventDefault();
    doFieldNudge(e.key);
  } else if (!selectionAllowed() && (e.key === "ArrowLeft" || e.key === "ArrowRight" ||
                                     e.key === "ArrowUp" || e.key === "ArrowDown")) {
    /* ПОД ЗАМКОМ (🔒) СТРЕЛКИ ДВИГАЮТ НЕ СОДЕРЖИМОЕ, А КАРТИНКУ (v0.975, запрос пользователя:
       "верх-вниз стрелки — двигали влево-право границу выделенную, а верх-низ все строки").
       ←/→ — ГРАНИЦА ПОЛЯ, ровно та, за которую последней брались мышью (activeBorderId, его
       ставит makeColResizer; до первого касания это граница центрального поля). Шаг — один
       столбец (realColStepPx), тот же, каким мерится всё остальное, чтобы граница вставала по
       битам, а не по случайным пикселям.
       ↑/↓ — ВСЯ КАРТИНКА разом: прокрутка полотна на высоту строки. Именно прокрутка, а не
       перестановка строк: под замком содержимое не меняется вовсе, в этом весь смысл режима. */
    e.preventDefault();
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      // vsplitL0 (v0.986) — та же переменная, что у vsplit (оба конца одной колонки П1), но
      // ЗЕРКАЛЬНЫЙ знак: у этой границы "шире" — это ВЛЕВО, а не вправо, как у остальных трёх
      // (см. invert у makeColResizer() в fold-5-ui.js — тут та же логика, только клавишами).
      const map = { vsplit: "--pat-w", vsplitL0: "--pat-w", vsplit2: "--bits-w", vsplit3: "--pat-w2" };
      const sel = { vsplit: ".pat", vsplitL0: ".pat", vsplit2: ".bits", vsplit3: ".pat2" };
      const varName = map[activeBorderId] || "--bits-w";
      const row = document.querySelector("#rows .ln") || document.querySelector(".chain-head");
      const colEl = row ? row.querySelector(sel[activeBorderId] || ".bits") : null;
      if (!colEl) return;
      const step = Math.max(1, Math.round((typeof realColStepPx === "function" ? realColStepPx() : 8) || 8));
      const grow = activeBorderId === "vsplitL0" ? (e.key === "ArrowLeft") : (e.key === "ArrowRight");
      const w = Math.max(40, Math.round(colEl.getBoundingClientRect().width + (grow ? step : -step)));
      document.documentElement.style.setProperty(varName, w + "px");
      // Те же флаги "ширину ведут рукой", что ставит перетаскивание, — иначе ближайший render()
      // отменил бы шаг автоподбором ширины.
      if (activeBorderId === "vsplit" || activeBorderId === "vsplitL0") patWManual = true;
      else if (activeBorderId === "vsplit2") { bitsWManual = true; document.body.classList.add("bits-w-manual"); }
      else patW2Manual = true;
      if (typeof updateSplitPositions === "function") updateSplitPositions();
      saveCache();
    } else {
      const sc = document.getElementById("screenCanvas");
      if (!sc) return;
      const rowEl = document.querySelector("#rows .ln");
      const h = rowEl ? Math.max(4, Math.round(rowEl.getBoundingClientRect().height)) : 12;
      sc.scrollTop += (e.key === "ArrowDown" ? h : -h);
    }
  } else if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && st.selectedCol >= 0) {
    // Пока выбран столбец, ◄► переключают ВЫБРАННЫЙ СТОЛБЕЦ (не крутят символы строк).
    e.preventDefault();
    let maxLen = 0;
    for (const s of st.rows) if (s.length > maxLen) maxLen = s.length;
    const next = e.key === "ArrowRight" ? Math.min(visibleColCount(maxLen) - 1, st.selectedCol + 1) : Math.max(0, st.selectedCol - 1);
    setSelectedColOnly(next);
  } else if (e.key === "ArrowLeft") {
    e.preventDefault();
    if (bShiftLEl) bShiftLEl.click();
  } else if (e.key === "ArrowRight") {
    e.preventDefault();
    if (bShiftREl) bShiftREl.click();
  } else if (e.code === "Numpad4") {
    // Нумпад 4/6 — те же ◄/►, но с инверсией бита на границе (см. bShiftLInv/bShiftRInv).
    // e.code (не e.key) — чтобы работало независимо от NumLock (иначе e.key от Numpad4 при
    // выключенном NumLock совпадает с обычной ArrowLeft и перехватывался бы веткой выше).
    e.preventDefault();
    if (bShiftLInvEl) bShiftLInvEl.click();
  } else if (e.code === "Numpad6") {
    e.preventDefault();
    if (bShiftRInvEl) bShiftRInvEl.click();
  } else if (e.code === "Numpad0") {
    // Нумпад 0 — переключить разделитель-границу снизу выделенной строки (см. toggleRowDivider).
    e.preventDefault();
    toggleRowDivider();
  } else if ((e.key === "ArrowDown" || e.key === "ArrowUp") && st.diagFoldPick) {
    // Пока в "Результате" ВЫБРАНА ДИАГОНАЛЬ (клик по её строке, см. st.diagFoldPick), ▲▼
    // переключают выбор на соседнюю диагональ, а не двигают выделение строк (запрос пользователя).
    // Список берём прямо из отрисованной панели — тогда порядок ровно тот, что видно на экране,
    // включая обе стороны (Диаг. ↘ и Диаг. ↙) и хвостовую строку "#49+". По краям заворачивается.
    // Снять выбор (и вернуть ▲▼ выделению строк) — повторный клик по выбранной строке.
    e.preventDefault();
    const diagKeys = Array.from(document.querySelectorAll("#chainText .chain-result-line"))
      .map(el => el.dataset.mode)
      .filter(m => m && m.indexOf("#") >= 0);
    if (!diagKeys.length) return;
    let di = diagKeys.indexOf(st.diagFoldPick);
    di = di < 0 ? 0 : (di + (e.key === "ArrowDown" ? 1 : -1) + diagKeys.length) % diagKeys.length;
    bgResultExpanded.delete(st.diagFoldPick);
    st.diagFoldPick = diagKeys[di];
    bgResultExpanded.add(st.diagFoldPick);
    render();
    const pickedEl = document.querySelector('#chainText .chain-result-line[data-mode="' + st.diagFoldPick + '"]');
    if (pickedEl) pickedEl.scrollIntoView({ block: "nearest" });
  } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    // Двигает ВЫДЕЛЕНИЕ строки вверх/вниз (не путать с ◄► — те крутят символы внутри строки).
    e.preventDefault();
    if (!st.selectedRows) st.selectedRows = new Set();
    const n = Math.max(st.rows.length, st.pats.length);
    if (n === 0) return;
    let cur = st.selectedRows.size === 1 ? [...st.selectedRows][0] : st.bIdx;
    if (typeof cur !== "number" || cur < 0) cur = 0;
    const next = e.key === "ArrowDown" ? Math.min(n - 1, cur + 1) : Math.max(0, cur - 1);
    st.selectedRows.clear();
    st.selectedRows.add(next);
    // "🖱 По выделению: достраивать" — стрелки ↑↓ переключают выделение так же, как клик мышью,
    // значит и верх должен приводиться к новому выделению здесь тоже (запрос пользователя).
    // keepSel: выделение остаётся там, куда его увела стрелка, иначе оно уезжало бы ещё на строку.
    // buildTopMirror сама зовёт render()/saveCache(), поэтому дальше только прокрутка.
    if (st.topBuildOnSelect) {
      buildTopMirror(st.topBuildMode || "rebuild", true);
      // Строки вставились/снялись сверху — номер строки, к которой прокручивать, съехал вместе с ней.
      const sel = st.selectedRows.size ? Math.max(...st.selectedRows) : next;
      scrollToRow(sel);
      return;
    }
    render();
    saveCache();
    scrollToRow(next); // по номеру, а не по элементу — см. scrollToRow
  }
});

// Защита от отсутствующих элементов DOM
const bLoadEl = document.getElementById("bLoad");
if (bLoadEl) bLoadEl.onclick = () => { loadTemplate(); saveCache(); };

const bSideEl = document.getElementById("bSide");
if (bSideEl) bSideEl.onclick = () => { document.body.classList.toggle("hide-side"); saveCache(); };

/* Жирность символов 0/1 (см. #bBoldBits/body.bold-bits в CSS) — простой тумблер без своего
   цвета, та же mode-act подсветка кнопки, что у "01"/"1↕1"/"1⤡1". */
const bBoldBitsEl = document.getElementById("bBoldBits");
if (bBoldBitsEl) {
  bBoldBitsEl.onclick = () => {
    const on = document.body.classList.toggle("bold-bits");
    bBoldBitsEl.classList.toggle("mode-act", on);
    saveCache();
  };
}

/* ПРИЁМНИК ВЫРАВНИВАНИЙ (v0.976 — v1.003, запрос пользователя: "последний щелчок над битами
   выбирает цепочку для выравнивания" + "в центре кнопку-индикатор, по кругу переключает выбор" +
   "кнопки П1 и П2 удали"). Раньше приёмник переключался ДВУМЯ кнопками «◧ П1»/«П2 ◨» по бокам
   полосы — их убрали совсем. Теперь ДВА равноправных пути к тому же самому alignTarget:
     1. АВТОМАТИЧЕСКИ — последним кликом/протяжкой за биты любого поля (см. mousedown в блоке
        "ТАЩИТЬ ПОЛЕ ЗА БИТЫ", fold-5-ui.js: там же, где lastPanField, теперь ставится и
        alignTarget — без своего сообщения, тихо, иначе сообщение сыпалось бы на каждый клик).
     2. РУКАМИ — клик по кнопке-индикатору #bAlignTargetInd в центре полосы (см. HTML), она же
        показывает ТЕКУЩИЙ приёмник и по клику гонит его по кругу: П1 → Ц → П2 → снова П1.
   syncAlignBanned() ниже — общая точка: и гасит ⇤/⇥ там, где сейчас запрещено, и перекладывает
   текст/подсветку индикатора на актуальный приёмник — вызывается из ОБОИХ путей. */
const ALIGN_TARGET_ORDER = ["L", "C", "R"];
const ALIGN_TARGET_LABEL = { L: "П1", C: "Ц", R: "П2" };
function setAlignTarget(field, quiet){
  if (ALIGN_TARGET_ORDER.indexOf(field) < 0) field = "C";
  alignTarget = field;
  if (typeof syncAlignBanned === "function") syncAlignBanned();
  if (!quiet) {
    say(alignTarget === "C"
        ? "Приёмник полосы выравниваний — ЦЕНТРАЛЬНОЕ поле (цепочка)."
        : "Приёмник полосы выравниваний — " + (alignTarget === "L" ? "ЛЕВОЕ поле (П1)" : "ПРАВОЕ поле (П2)") +
          ". Осевые (⊙/⊙½/↥/↥½) по-прежнему уходят цепочке — в колонке паттернов им опереться не на что.");
    saveCache();
  }
}
const bAlignTargetIndEl = document.getElementById("bAlignTargetInd");
if (bAlignTargetIndEl) {
  bAlignTargetIndEl.onclick = () => {
    const idx = ALIGN_TARGET_ORDER.indexOf(alignTarget);
    setAlignTarget(ALIGN_TARGET_ORDER[(idx < 0 ? -1 : idx) + 1 >= ALIGN_TARGET_ORDER.length ? 0 : idx + 1]);
  };
}


/* === "⇄ СДВИГ ПО МАСКЕ" (v0.785) ==========================================================
   Круговой сдвиг битов НЕ всей строкой целиком, а по маске — ДВУМЯ НЕЗАВИСИМЫМИ КОЛЬЦАМИ
   (запрос пользователя: "биты под 1 и под 0 становятся разными на одной строке"):
     группа A — позиции, где маска даёт «1»;
     группа B — позиции, где «0».
   Каждая группа крутится ПО СВОИМ ПОЗИЦИЯМ и только по ним: значения переезжают с одной позиции
   группы на следующую позицию ТОЙ ЖЕ группы, а между группами биты не перемешиваются никогда.
   Поэтому маска "10" на строке 8 бит даёт два кольца по 4 бита — чётное и нечётное, и после
   сдвига строка выглядит совсем иначе, чем после обычного ◄/►.
   Маска — ОБЩАЯ с прореживающей (поле #bgMaskText, v0.929, запрос пользователя "и поля маск
   движения и просто объединение"). Раньше у сдвига было своё поле #maskShiftText: два поля с
   одинаковым смыслом стояли в одной вкладке друг под другом, и набранное в одном молча не
   работало в другом. Берём maskBitsRaw() — САМ ТЕКСТ поля, без выключателя «🎭 По маске»: тот
   гасит поиск, а сдвиг — ручное действие и от режима поиска зависеть не должен.
   Направлений задумано три пары; сделана первой пара «к центру / от центра» (запрос
   пользователя — "первым сделай центру"), ◄/► идут тем же механизмом, ▲/▼ пока заглушка. */
function maskShiftBits(){
  return (typeof maskBitsRaw === "function") ? maskBitsRaw() : "";
}
/* Позиции строки, разложенные по двум группам маски. Маска идёт по кругу, как везде в приложении. */
function maskShiftGroups(len, mask){
  const n = mask.length, g1 = [], g0 = [];
  for (let i = 0; i < len; i++) (mask[i % n] === "1" ? g1 : g0).push(i);
  return [g1, g0];
}
/* Циклический сдвиг массива значений: dir=-1 — влево (первый уходит в конец), dir=1 — вправо. */
function rotVals(v, dir){
  if (v.length < 2) return v.slice();
  return dir === 1 ? [v[v.length - 1]].concat(v.slice(0, -1)) : v.slice(1).concat([v[0]]);
}
/* Один шаг сдвига для ОДНОЙ группы значений.
   left/right — обычное кольцо по позициям группы.
   center/uncenter — группа делится пополам, и половины крутятся В РАЗНЫЕ стороны: к центру левая
   едет вправо, правая влево (вытесненные из середины возвращаются на края своей половины), от
   центра — наоборот. При нечётной длине средний элемент не принадлежит ни одной половине и
   стоит на месте. Обе операции — перестановки и точно обратны друг другу, так что "к центру" и
   "от центра" отменяют одна другую. */
function maskShiftVals(v, mode){
  if (mode === "left")  return rotVals(v, -1);
  if (mode === "right") return rotVals(v, 1);
  const k = v.length, mid = Math.floor(k / 2);
  if (k < 2) return v.slice();
  const L = v.slice(0, mid), R = v.slice(k - mid), M = (k % 2) ? [v[mid]] : [];
  const toCenter = mode === "center";
  return rotVals(L, toCenter ? 1 : -1).concat(M, rotVals(R, toCenter ? -1 : 1));
}
/* ЗАМОРОЗКА ГРУППЫ (v0.823, запрос пользователя: "нужна кнопка заморозить 1 или 0 в маске,
   чтобы не двигались 1 а только 0 например"). st.maskShiftFreeze: "" — едут обе группы (как
   было), "1" — биты под «1» маски стоят намертво, едет только группа «0», "0" — наоборот.
   Стоящая группа не участвует в сдвиге ВООБЩЕ: её позиции и значения остаются как есть, а
   вторая группа крутится по своим позициям ровно так же, как раньше — то есть заморозка это
   не отдельный режим сдвига, а фильтр "какие кольца сегодня крутим". */
function maskShiftFreeze(){
  const f = st.maskShiftFreeze;
  return (f === "1" || f === "0") ? f : "";
}
function maskShiftRow(s, mask, mode){
  const out = s.split("");
  const freeze = maskShiftFreeze();
  // maskShiftGroups отдаёт [группа «1», группа «0»] — индекс 0 это «1», индекс 1 это «0».
  maskShiftGroups(s.length, mask).forEach((grp, gi) => {
    if (grp.length < 2) return;
    if (freeze === (gi === 0 ? "1" : "0")) return; // эта группа заморожена — не трогаем
    const nv = maskShiftVals(grp.map(i => s[i]), mode);
    grp.forEach((pos, j) => { out[pos] = nv[j]; });
  });
  return out.join("");
}
const MASK_SHIFT_LABELS = {
  center: "к центру", uncenter: "от центра", left: "влево", right: "вправо"
};
function maskShiftApply(mode){
  if (mode === "up" || mode === "down") {
    // ▲/▼ — сдвиг бита в строку выше/ниже по тому же столбцу. Кнопки заведены сразу (запрос
    // пользователя: "все три запиши и кнопки сделай"), сама механика — следующим заходом:
    // тут нужно решить, что делать со строками разной длины и с выравниванием, а это отдельный
    // разговор, не такой же однострочный, как поворот внутри строки.
    say("▲/▼ по маске: пока не сделано — сначала «к центру/от центра» и ◄/►. Скажи, и добавлю вертикаль.");
    return;
  }
  const mask = maskShiftBits();
  if (!mask) { say("⇄ Сдвиг по маске: впишите маску в поле рядом (например 110)."); return; }
  if (mask.indexOf("1") < 0 || mask.indexOf("0") < 0) {
    // Одна группа на всю строку — это ровно обычный круговой сдвиг, для него есть ◄/► Круг.
    say("⇄ Сдвиг по маске: в маске нужны И «1», И «0» — иначе группа получается одна, а это обычный Круг.");
    return;
  }
  if (!st.selectedRows || !st.selectedRows.size) { say("⇄ Сдвиг по маске: выделите строку (или несколько)."); return; }
  const rows = Array.from(st.selectedRows).sort((a, b) => a - b);
  snapshot();
  let changed = 0;
  for (const r of rows) {
    const s = st.rows[r] || "";
    if (s.length < 2) continue;
    const out = maskShiftRow(s, mask, mode);
    if (out === s) continue;
    st.rows[r] = out;
    // Длина не меняется, но значения бит — да: позиционные пометки прошлых операций к ним
    // больше не относятся (как и везде, где строка переписывается целиком).
    invFlagsMap.delete(r);
    insertedFlagsMap.delete(r);
    changed++;
  }
  maskChangedMap.clear(); maskBaseRows = null;
  const frz = maskShiftFreeze();
  const frzNote = frz ? `, «${frz}» заморожены` : "";
  say(changed
    ? `⇄ Сдвиг по маске ${mask} (${MASK_SHIFT_LABELS[mode]}${frzNote}): сдвинуто строк — ${changed}.`
    : `⇄ Сдвиг по маске ${mask}${frzNote}: ничего не изменилось (в группах меньше двух бит${frz ? ", либо едет только замороженная" : ""}).`);
  render(); saveCache();
}
/* ПЕРЕЕЗД СТАРОЙ МАСКИ СДВИГА В ОБЩЕЕ ПОЛЕ (v0.929). Своё поле у сдвига убрано, но в кэше у
   пользователя лежит st.maskShiftText — если общее поле пусто, а старая маска сдвига есть,
   переносим её, чтобы набранное не пропало при обновлении. Разовая операция: после переноса
   st.maskShiftText очищается и больше нигде не читается. */
if (st.maskShiftText) {
  if (!(st.bgMaskText || "").replace(/[^01]/g, "")) {
    st.bgMaskText = st.maskShiftText;
    const el = document.getElementById("bgMaskText");
    if (el) el.value = st.bgMaskText;
  }
  st.maskShiftText = "";
}
for (const [id, mode] of [["bMaskShiftCenter", "center"], ["bMaskShiftUncenter", "uncenter"],
                          ["bMaskShiftLeft", "left"], ["bMaskShiftRight", "right"],
                          ["bMaskShiftUp", "up"], ["bMaskShiftDown", "down"]]) {
  const el = document.getElementById(id);
  if (el) el.onclick = () => maskShiftApply(mode);
}
/* "❄ Заморозить" — тоггл на три состояния по кругу: выкл → «1» → «0» → выкл. Отдельной кнопкой,
   а не парой галок: состояний ровно три и они взаимоисключающие. Подсветка .mode-act — общий
   приём для всех включённых режимов в приложении. */
const MASK_FREEZE_ORDER = ["", "1", "0"];
const MASK_FREEZE_LABELS = { "": "выкл", "1": "стоят 1", "0": "стоят 0" };
function updateMaskShiftFreezeBtn(){
  const b = elById("bMaskShiftFreeze");
  if (!b) return;
  const f = maskShiftFreeze();
  b.textContent = "❄ Заморозить: " + MASK_FREEZE_LABELS[f];
  b.classList.toggle("mode-act", f !== "");
}
const bMaskShiftFreezeEl = document.getElementById("bMaskShiftFreeze");
if (bMaskShiftFreezeEl) {
  bMaskShiftFreezeEl.onclick = () => {
    const i = MASK_FREEZE_ORDER.indexOf(maskShiftFreeze());
    st.maskShiftFreeze = MASK_FREEZE_ORDER[(i + 1) % MASK_FREEZE_ORDER.length];
    updateMaskShiftFreezeBtn();
    render(); saveCache();
  };
  updateMaskShiftFreezeBtn();
}

/* "🎨 ПОДСВЕТКА МАСКИ" — ОДНА КНОПКА НА ДВА РЕЖИМА (v0.929, запрос пользователя: "подсветка —
   тоже дубль, пусть будет одна, но переключает пусть режимы 2, без отключенного режима, а
   отключать когда в поле маска ничего нет").
   БЫЛО ДВЕ кнопки с одинаковым смыслом: #bMaskPaint (группы «⇄ Сдвига по маске», st.maskPaintMode)
   и #bBgMaskPaint (биты, которые берёт прореживающая маска, st.bgMaskPaintMode) — каждая на ТРИ
   состояния со своим «выкл». Маска с v0.929 общая (см. maskShiftBits выше), значит красили они
   одно и то же двумя разными путями; в render() ветка сдвига к тому же всегда перебивала
   ветку прореживания. Осталась одна кнопка и одно состояние st.bgMaskPaintMode:
     seq — сквозной счёт: фаза идёт непрерывно через строки диапазона, как будто они склеены в
           одну ленту (тогда на разных строках под «1» маски попадают разные столбцы);
     row — маска начинается ЗАНОВО в каждой строке (фаза 0 = первый бит строки).
   ОТДЕЛЬНОГО «выкл» НЕТ: подсветка гаснет сама, когда в поле маски пусто (или в маске нет «1»
   и «0» разом — тогда делить биты на две группы не на что, см. maskBitsRaw). Кнопка в этот
   момент показывает «нет маски» и блокируется, чтобы не переключать невидимое.
   Красит САМУ ЦИФРУ двумя цветами (st.maskPaintColor1/0). Стоит в самом низу цепочки подсветок
   в render() — любая адресная подсветка (находка, изменённые биты, выбранная ячейка) её
   перебивает. Диапазон строк — colSelectRowRange(): выделена одна — от верха до неё, выделено
   несколько — только они, не выделено ничего — вся цепочка. */
const BG_MASK_PAINT_LABELS = { seq: "сквозно", row: "от строки" };
// Единственная точка нормализации: старый кэш мог хранить "off" (третье состояние, которого
// больше нет) — считаем его "сквозно". render() читает st.bgMaskPaintMode тем же правилом
// ("row" или всё остальное = "seq"), поэтому расхождения между кнопкой и картинкой не будет.
function bgMaskPaintMode(){ return st.bgMaskPaintMode === "row" ? "row" : "seq"; }
/* ВЫКЛЮЧАТЕЛЬ ОТДЕЛЬНО ОТ РЕЖИМА (v0.936, запрос пользователя "рядом кнопку вкл/выкл вообще
   подсветки, сократи названия, расположи на одной строке"). Автогашение при пустом поле никуда
   не делось — оно про "красить нечего"; этот флаг про "не крась, хотя есть чем", чтобы посмотреть
   строки в обычных цветах, не стирая саму маску. При пустом поле обе кнопки блокируются. */
function bgMaskPaintOn(){ return st.bgMaskPaintOn !== false; }
function updateBgMaskPaintBtn(){
  const mask = (typeof maskBitsRaw === "function") ? maskBitsRaw() : "";
  const live = !!mask && bgMaskPaintOn();
  const bOn = elById("bBgMaskPaintOn");   // elById — панель «Маски» может жить в своём окне
  if (bOn) {
    bOn.textContent = mask ? (bgMaskPaintOn() ? "👁 вкл" : "👁 выкл") : "👁 нет маски";
    bOn.classList.toggle("mode-act", live);
    bOn.disabled = !mask;
  }
  const b = elById("bBgMaskPaint");
  if (b) {
    b.textContent = "🎨 " + BG_MASK_PAINT_LABELS[bgMaskPaintMode()];
    b.classList.toggle("mode-act", live);
    b.disabled = !live;   // режим нечего переключать, пока не красим
  }
}
const bBgMaskPaintOnEl = document.getElementById("bBgMaskPaintOn");
if (bBgMaskPaintOnEl) bBgMaskPaintOnEl.onclick = () => {
  st.bgMaskPaintOn = !bgMaskPaintOn();
  updateBgMaskPaintBtn();
  say(bgMaskPaintOn()
    ? `Подсветка маски включена (${BG_MASK_PAINT_LABELS[bgMaskPaintMode()]}).`
    : "Подсветка маски погашена — сама маска в поле осталась.");
  render(); saveCache();
};
const bBgMaskPaintEl = document.getElementById("bBgMaskPaint");
if (bBgMaskPaintEl) {
  bBgMaskPaintEl.onclick = () => {
    st.bgMaskPaintMode = bgMaskPaintMode() === "seq" ? "row" : "seq";
    updateBgMaskPaintBtn();
    const mask = (typeof maskBitsRaw === "function") ? maskBitsRaw() : "";
    say(bgMaskPaintMode() === "seq"
      ? `Подсветка маски ${mask}: сквозной счёт через строки диапазона.`
      : `Подсветка маски ${mask}: маска начинается заново в каждой строке.`);
    render(); saveCache();
  };
}
updateBgMaskPaintBtn();
/* Цвета групп — общие на обе подсветки (см. mpColor в render). Красится сама цифра, поэтому цвет
   стоит брать поконтрастнее к обычным цветам битов, иначе группы сольются с неподсвеченными. */
for (const [id, key, def] of [["maskPaintColor1", "maskPaintColor1", "#b060ff"],
                              ["maskPaintColor0", "maskPaintColor0", "#22d3ee"]]) {
  const el = document.getElementById(id);
  if (!el) continue;
  el.value = st[key] || def;
  el.oninput = () => { st[key] = el.value; render(); saveCache(); };
}



/* === ЗНАЧКИ-КОПИИ КОНТРОЛОВ НАД ПОЛОТНОМ (v0.794) ========================================
   Полоса ВО ВСЮ ШИРИНУ поля цепочек (запрос пользователя: "пусть тут по всей ширине можно
   прикрепить"), пустая по умолчанию — наполняет её пользователь сам:
     ПЕРЕТАСКИВАНИЕ = КОПИРОВАНИЕ: контрол остаётся на своём месте, наверху появляется значок.
     Тащить можно ЛЮБОЙ контрол панелей (кнопку или галку) И ЛЮБУЮ КНОПКУ ВЕРХНЕГО МЕНЮ
     (v0.923) — кроме вкладок-панелей, за них таскают сами панели.
     Значок встаёт ТУДА, ГДЕ ОТПУСТИЛИ: позиция хранится долей ширины (0..1), поэтому держится
     на месте и при изменении размера окна. Уже закреплённый значок можно перетащить в другое
     место той же полосы — он просто переедет.
     Клик по значку = клик по самому контролу (вся логика режима остаётся в одном месте).
     Двойной клик по значку — открепить.
   Состояние читается У САМОГО КОНТРОЛА, а не из st: галка — по checked, кнопка — по своим
   классам-признакам включённости (.mode-act/.act/.overlay-on/.bg-search-active). Поэтому набор
   ни с чем не разъезжается и не надо знать имя поля состояния для каждой кнопки.
   Хранится отдельным ключом localStorage, не в раскладке панелей: это набор ярлыков, а не
   геометрия окон. */
const BADGE_KEY = "zerk_fold_badges";
/* [{ id, x }], x — доля ширины полосы от 0 до 1. */
let badgePins = [];
try {
  const savedPins = JSON.parse(localStorage.getItem(BADGE_KEY) || "null");
  if (Array.isArray(savedPins)) {
    badgePins = savedPins.filter(p => p && p.id).map(p => ({ id: p.id, x: +p.x || 0 }));
  } else if (savedPins && Array.isArray(savedPins.L) && Array.isArray(savedPins.R)) {
    // Миграция с двух угловых полосок (v0.793): левые раскладываем от левого края, правые — к
    // правому, дальше пользователь двигает их как хочет.
    savedPins.L.forEach((id, i) => badgePins.push({ id, x: Math.min(0.45, 0.02 + i * 0.045) }));
    savedPins.R.forEach((id, i) => badgePins.push({ id, x: Math.max(0.55, 0.98 - i * 0.045) }));
  }
} catch (e) { /* мусор в кэше — начинаем с пустой полосы */ }
function saveBadgePins(){
  try { localStorage.setItem(BADGE_KEY, JSON.stringify(badgePins)); } catch (e) {}
}
/* Включён ли контрол ПРЯМО СЕЙЧАС. null — у контрола нет состояния (обычная кнопка-действие):
   такой значок всегда рисуется обычным, гасить его не за чем. */
function badgeCtrlOn(el){
  if (!el) return null;
  if (el.tagName === "INPUT" && el.type === "checkbox") return !!el.checked;
  for (const c of ["mode-act", "act", "overlay-on", "bg-search-active"]) {
    if (el.classList.contains(c)) return true;
  }
  // Кнопка-переключатель в выключенном виде от кнопки-действия неотличима — но и вреда от
  // "рисуем обычным" тут нет: пользователь сам решил, что этот ярлык ему нужен.
  return null;
}
/* Подпись контрола: у галки — текст её label, у кнопки — собственный текст. */
function badgeCtrlLabel(el){
  if (!el) return "";
  const host = (el.tagName === "INPUT") ? (el.closest("label") || el) : el;
  return (host.textContent || "").replace(/\s+/g, " ").trim();
}
/* Что показать на значке: первое "слово" подписи — обычно это как раз эмодзи-иконка ("🎭", "⏭",
   "⧬+⨁"). Пусто (галка без текста) — берём id. Длиннее 4 символов не пускаем, иначе значок
   перестаёт быть значком. */
function badgeCtrlIcon(el, id){
  const first = (badgeCtrlLabel(el).split(" ")[0] || "").trim();
  const src = first || id.replace(/^[bc]/, "");
  return Array.from(src).slice(0, 4).join("");
}
function renderStateBadges(){
  const box = document.getElementById("stateBadges");
  if (!box) return;
  let html = "";
  for (const pin of badgePins) {
    const el = document.getElementById(pin.id);
    if (!el) continue;              // контрол пропал (переименовали id) — молча пропускаем
    const on = badgeCtrlOn(el);
    const label = badgeCtrlLabel(el) || pin.id;
    // translateX(-50%) — значок центрируется по точке, куда его положили, поэтому у самого края
    // он не вылезает за полосу наполовину, а плавно упирается (см. clamp при сохранении x).
    /* ПОДСКАЗКА — КОРОТКАЯ (v0.831, запрос пользователя "подсказка нужна проще: название и инфо
       ВКЛ/Выкл"): только подпись контрола и его состояние, без инструкции про клик, двойной клик
       и перетаскивание — она была длиннее самой подписи и повторялась у каждого значка. Если
       подпись САМА уже говорит "ВКЛ"/"ВЫКЛ" (как у "🎭 По маске: ВКЛ"), второй раз не дописываем. */
    const saysState = /ВКЛ|ВЫКЛ/.test(label);
    const stateNote = (on === null || saysState) ? "" : (on ? " — ВКЛ" : " — ВЫКЛ");
    // Включён — обводим рамкой (v0.832, запрос пользователя "когда включена — рамкой обводи,
    // чтобы понятно было, вкл она или выкл"): выключенный значок и так приглушён (.off), но
    // между "выключен" и "состояния нет" разницы на глаз не было.
    html += '<span class="state-badge' + (on === false ? " off" : (on ? " on" : "")) + '" data-ctrl="' + pin.id +
      '" style="left:' + (pin.x * 100).toFixed(3) + '%" title="' +
      esc(label + stateNote) + '">' +
      esc(badgeCtrlIcon(el, pin.id)) + '</span>';
  }
  box.innerHTML = html;
}
/* Клик — жмём тот же контрол, что и в панели: у галки .click() сам переключает checked и шлёт
   change, у кнопки срабатывает её onclick. Двойной клик снимает значок. */
const badgeBoxEl = document.getElementById("stateBadges");
if (badgeBoxEl) {
  badgeBoxEl.onclick = (e) => {
    const b = e.target.closest(".state-badge");
    if (!b) return;
    const el = document.getElementById(b.getAttribute("data-ctrl"));
    if (el) el.click();
    renderStateBadges();
  };
  badgeBoxEl.ondblclick = (e) => {
    const b = e.target.closest(".state-badge");
    if (!b) return;
    const id = b.getAttribute("data-ctrl");
    badgePins = badgePins.filter(p => p.id !== id);
    saveBadgePins();
    renderStateBadges();
    say("Значок убран из полосы.");
  };
}

/* ПЕРЕТАСКИВАНИЕ. Свой mousedown/mousemove/mouseup, а не HTML5 drag-and-drop — тот в приложении
   уже занят вставкой фигуры файлом и конфликтует (та же причина, по которой на ручном драге
   сделаны и сами панели-вкладки). Порог в 5px: пока мышь не уехала, это обычный клик по контролу
   (или по значку) и он должен работать как всегда.
   Источников два: контрол в панели (тогда это КОПИРОВАНИЕ) и уже стоящий значок (тогда это
   перемещение по полосе). */
let badgeDrag = null;
document.addEventListener("mousedown", (e) => {
  if (e.button !== 0) return;
  // Уже стоящий значок — двигаем его самого.
  const badge = e.target.closest(".state-badge");
  if (badge) {
    badgeDrag = { id: badge.getAttribute("data-ctrl"), move: true, x0: e.clientX, y0: e.clientY, moved: false, ghost: null };
    return;
  }
  /* Контрол ВНУТРИ панели ИЛИ В ВЕРХНЕМ МЕНЮ — копируем (#menuBar добавлен в v0.923, запрос
     пользователя "кнопки из верхнего меню тоже должны быть копируемыми значками на поле
     цепочек"). Там живут ↩/↪, 💾, 📌, 🗗 и переключатели окон 🔗Р/ 🧾Ч/ — ими пользуются чаще
     всего, а до верхней полосы каждый раз тянуться мышью через весь экран.
     Шапки панелей (.panel-head) и вкладки (.menu-btn) по-прежнему не трогаем: за них таскают
     сами панели, и перехват сломал бы их перетаскивание. Заголовок и ссылка на Хаб — не
     button/input, до проверки ниже они и не доходят. Кнопки в выпадающем списке цепочек (💾/↺/✕
     у каждой) своих id не имеют, поэтому отсеются там же: значок без id не привязать к контролу. */
  const host = e.target.closest("#leftPanel, #rightPanel, .menu-drop, .floating-panel, #menuBar");
  if (!host || e.target.closest(".panel-head, .menu-btn")) return;
  let ctrl = e.target.closest("button, input[type=checkbox]");
  // ХВАТАТЬ МОЖНО ЗА ПОДПИСЬ (запрос пользователя — "эти тоже туда" про галки «Без 1-го», «Инв.
  // кольцо» и прочие). Сама <input type=checkbox> — квадратик в 13px, целиться в него мышью
  // бессмысленно, а закрывающий её <label> внутри себя и содержит: closest() от текста подписи
  // до чекбокса не дойдёт (он вложен, а не наоборот), поэтому ищем его сверху вниз.
  if (!ctrl) {
    const lab = e.target.closest("label");
    if (lab) ctrl = lab.querySelector('input[type=checkbox]');
  }
  if (!ctrl || !ctrl.id) return;
  badgeDrag = { id: ctrl.id, move: false, x0: e.clientX, y0: e.clientY, moved: false, ghost: null };
}, true);
document.addEventListener("mousemove", (e) => {
  if (!badgeDrag) return;
  if (!badgeDrag.moved) {
    if (Math.abs(e.clientX - badgeDrag.x0) < 5 && Math.abs(e.clientY - badgeDrag.y0) < 5) return;
    badgeDrag.moved = true;
    // Тащим за подпись — браузер иначе начнёт выделять её текст, и вместо переноса получается
    // синее выделение через пол-панели.
    e.preventDefault();
    // Полоса-приёмник получает видимую рамку, пока идёт перенос (тот же приём, что подсветка
    // доков при перетаскивании вкладок) — иначе в пустую полосу нечем целиться.
    document.body.classList.add("badge-dragging");
    const el = document.getElementById(badgeDrag.id);
    const g = document.createElement("div");
    g.className = "badge-ghost";
    g.textContent = badgeCtrlIcon(el, badgeDrag.id);
    document.body.appendChild(g);
    badgeDrag.ghost = g;
  }
  if (badgeDrag.ghost) {
    // Призрак цепляется к ВЕРХНЕМУ КРАЮ курсора (запрос пользователя: "рука неудобно прилипает
    // к значку"): раньше он висел на 8px ниже-правее острия и лез под саму руку-курсор, закрывая
    // то место, куда целишься. Смещение делает CSS (translate(-50%,-115%)) — тут просто ставим
    // точку острия.
    badgeDrag.ghost.style.left = e.clientX + "px";
    badgeDrag.ghost.style.top = e.clientY + "px";
  }
});
document.addEventListener("mouseup", (e) => {
  if (!badgeDrag) return;
  const drag = badgeDrag;
  badgeDrag = null;
  if (drag.ghost) drag.ghost.remove();
  document.body.classList.remove("badge-dragging");
  if (!drag.moved) return;   // обычный клик — ничего не перехватываем
  /* ПОСЛЕ НАСТОЯЩЕГО ПЕРЕТАСКИВАНИЯ ГЛУШИМ СЛЕДУЮЩИЙ КЛИК (v0.924). Браузер шлёт click по
     кнопке-источнику даже когда мышь уехала с неё на сотни пикселей, — то есть протащить контрол
     на полосу значило заодно НАЖАТЬ его. У кнопок панелей это в основном безобидно, но с v0.923
     источником стало и верхнее меню: попытка перетащить оттуда "📌" срабатывала как обычное
     нажатие и прятала ВСЕ панели разом (баг-репорт "разметка полетела снова"). Тот же фокус, что
     и с rowDragMoved у выделения строк протяжкой: одноразовый перехватчик на фазе capture,
     который съедает ровно один ближайший click и снимает сам себя. */
  const swallow = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
  document.addEventListener("click", swallow, true);
  setTimeout(() => document.removeEventListener("click", swallow, true), 0);
  const box = document.getElementById("stateBadges");
  if (box) {
    const r = box.getBoundingClientRect();
    // ЗОНА ПРИЁМА ШИРОКАЯ (запрос пользователя: "от кнопки зажато провести прямо до площади").
    // Полоса тонкая (18px), и требовать попадания в неё пиксель в пиксель — мучение: целимся
    // в ПОЛОСУ СВЕРХУ полотна целиком. Вверх пускаем до самого верха окна (там меню-бар, мимо
    // не промахнёшься), вниз — с запасом в 60px. По горизонтали доля зажимается в 0..1, значок
    // центрируется по точке (translateX(-50%)) и у краёв наружу не вылезает.
    /* Нижняя граница зоны широкая (см. выше), а ВЕРХНЯЯ появилась в v0.923 вместе с
       перетаскиванием из верхнего меню: раньше принималось всё, что выше полосы, вплоть до самого
       верха окна — и теперь любой микро-сдвиг мыши на кнопке меню (5px порога) закреплял бы
       значок, хотя до полосы её никто не доводил. Требуем дотянуть хотя бы до подступов к полосе. */
    const inBand = e.clientY <= r.bottom + 70 && e.clientY >= r.top - 30 &&
      e.clientX >= r.left && e.clientX <= r.right;
    if (inBand && r.width > 0) {
      const x = Math.max(0.01, Math.min(0.99, (e.clientX - r.left) / r.width));
      const found = badgePins.find(p => p.id === drag.id);
      if (found) found.x = x;                       // уже стоял — просто переехал
      else badgePins.push({ id: drag.id, x: x });   // КОПИЯ: контрол остался в своей панели
      saveBadgePins();
      renderStateBadges();
      if (!drag.move) {
        const el = document.getElementById(drag.id);
        say("Значок закреплён: " + (badgeCtrlLabel(el) || drag.id) + ". Двойной клик по нему — убрать.");
      }
    } else if (drag.move) {
      // Утащили значок ПРОЧЬ с полосы — это и есть "снять" (кроме двойного клика).
      badgePins = badgePins.filter(p => p.id !== drag.id);
      saveBadgePins();
      renderStateBadges();
      say("Значок убран из полосы.");
    }
  }
  // Протяжка кончилась — гасим клик, который браузер выдаст следом: иначе контрол сработал бы
  // сам по себе от одного лишь перетаскивания.
  const killClick = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
  document.addEventListener("click", killClick, { capture: true, once: true });
  setTimeout(() => document.removeEventListener("click", killClick, true), 0);
});

/* === "✂ РЕЖИМ ПЕРЕНОСА СТРОК" (v0.798) ===================================================
   Две вертикальные линии — слева и справа — отрезают у строк края, и отрезанное уезжает В НОВУЮ
   СТРОКУ ПОД СОБОЙ, а всё, что ниже, съезжает вниз (запрос пользователя: "две линии тяну на
   строки, биты перенести на другую строку под себя, а другие строки смещать вниз").
   РЕЖЕТ ПО ЧИСЛУ БИТ ОТ КРАЯ (а не по столбцу экрана): у каждой строки диапазона отрезается
   ОДИНАКОВОЕ число бит от её собственного края, независимо от выравнивания и длины.
   КОНЕЦ, КОТОРЫМ КУСОК ЛОЖИТСЯ В НОВУЮ СТРОКУ, по умолчанию ПРОТИВОПОЛОЖНЫЙ (отрезали слева —
   легло справа, кусок как бы огибает строку); галка "тем же концом" переключает.
   ДИАПАЗОН СТРОК — тот же colSelectRowRange(), что и везде: выделена одна строка → от первой до
   неё, выделено несколько → только они, нет выделения → все строки.
   ПРЕДПРОСМОТР, А НЕ ПРАВКА: при входе в режим снимается слепок, и каждое движение линий
   пересобирает цепочку ИЗ СЛЕПКА заново. Не нажал "✔ Применить" — выход из режима (та же кнопка
   или Escape) возвращает всё как было (прямой запрос пользователя). */
let wrapBase = null;   // { rows, pats, used } — слепок на входе в режим
function wrapModeOn(){ return !!wrapBase; }
/* Пересобрать цепочку из слепка под текущие линии. Инкрементально резать нельзя: линии ездят
   туда-сюда, и накопленные срезы было бы не отмотать. */
function wrapRebuild(){
  if (!wrapBase) return;
  const L = Math.max(0, st.wrapL | 0), R = Math.max(0, st.wrapR | 0);
  const r = colSelectRowRange();
  const n = wrapBase.rows.length;
  const lo = Math.max(0, r.lo);
  const hi = Math.min(n - 1, r.hi === Infinity ? n - 1 : r.hi);
  const rows = [], pats = [], used = [];
  for (let i = 0; i < n; i++) {
    const s = wrapBase.rows[i] || "";
    const inRange = i >= lo && i <= hi;
    // Резать нечего, если линии не выставлены, строка вне диапазона или целиком помещается
    // между линиями (тогда середина пуста и переносить было бы саму строку).
    if (!inRange || (!L && !R) || s.length <= L + R) {
      rows.push(s); pats.push(wrapBase.pats[i]); used.push(wrapBase.used[i]);
      continue;
    }
    const left = L ? s.slice(0, L) : "";
    const right = R ? s.slice(s.length - R) : "";
    const mid = s.slice(L, s.length - R);
    // Противоположным концом: отрезанное СЛЕВА встаёт в новой строке СПРАВА, и наоборот —
    // поэтому порядок кусков переворачивается.
    const moved = st.wrapOpposite === false ? (left + right) : (right + left);
    rows.push(mid); pats.push(wrapBase.pats[i]); used.push(wrapBase.used[i]);
    if (moved) {
      rows.push(moved);
      // У новой строки своей ячейки паттерна нет — заводим пустую (ord:-1 = "не из шаблона",
      // тот же приём, что у достроенных сверху строк).
      pats.push({ text: "", ord: -1, found: false, kind: null, step: null });
      used.push(false);
    }
  }
  st.rows = rows; st.pats = pats; st.used = used;
  render();
}
function wrapStart(){
  if (wrapBase) return;
  wrapBase = {
    rows: st.rows.slice(),
    pats: st.pats.slice(),
    used: st.used.slice()
  };
  if (st.wrapOpposite === undefined) st.wrapOpposite = true;
  st.wrapL = st.wrapL | 0; st.wrapR = st.wrapR | 0;
  document.body.classList.add("wrap-mode");
  updateWrapUi();
  wrapRebuild();
  say("✂ Перенос строк: тяни линии мышью по полотну (левая половина — левая линия, правая — правая). «✔ Применить» закрепит, Escape или повторный клик по кнопке — отменит.");
}
/* Выход БЕЗ применения — цепочка возвращается к слепку. */
function wrapCancel(quiet){
  if (!wrapBase) return;
  st.rows = wrapBase.rows; st.pats = wrapBase.pats; st.used = wrapBase.used;
  wrapBase = null;
  st.wrapL = 0; st.wrapR = 0;
  document.body.classList.remove("wrap-mode");
  updateWrapUi();
  render(); saveCache();
  if (!quiet) say("✂ Перенос строк отменён — цепочка вернулась как была.");
}
/* "✔ Применить" — фиксируем то, что видно, и выходим. snapshot() берём ЗДЕСЬ и от СЛЕПКА:
   в st.rows сейчас лежит уже перекроенная цепочка, и откат должен вести к исходной. */
function wrapCommit(){
  if (!wrapBase) return;
  const preview = { rows: st.rows, pats: st.pats, used: st.used };
  st.rows = wrapBase.rows; st.pats = wrapBase.pats; st.used = wrapBase.used;
  snapshot();
  st.rows = preview.rows; st.pats = preview.pats; st.used = preview.used;
  const added = preview.rows.length - wrapBase.rows.length;
  wrapBase = null;
  st.wrapL = 0; st.wrapR = 0;
  document.body.classList.remove("wrap-mode");
  // Длины строк изменились — позиционные пометки прошлых операций к ним больше не относятся.
  invFlagsMap.clear(); insertedFlagsMap.clear();
  maskChangedMap.clear(); maskBaseRows = null;
  updateWrapUi();
  render(); saveCache();
  say(`✂ Перенос применён: добавлено строк — ${added}. Отменить целиком — «↩ Отмена».`);
}
function updateWrapUi(){
  const b = document.getElementById("bWrapMode");
  if (b) {
    b.classList.toggle("mode-act", wrapModeOn());
    b.textContent = wrapModeOn() ? "✂ Перенос строк: идёт" : "✂ Перенос строк";
  }
  const info = document.getElementById("wrapInfo");
  if (info) info.textContent = wrapModeOn() ? ("слева " + (st.wrapL | 0) + " · справа " + (st.wrapR | 0)) : "";
  const cm = document.getElementById("bWrapCommit");
  if (cm) cm.style.display = wrapModeOn() ? "" : "none";
}
const bWrapModeEl = document.getElementById("bWrapMode");
if (bWrapModeEl) bWrapModeEl.onclick = () => { if (wrapModeOn()) wrapCancel(); else wrapStart(); };
const bWrapCommitEl = document.getElementById("bWrapCommit");
if (bWrapCommitEl) bWrapCommitEl.onclick = wrapCommit;
const cWrapOppositeEl = document.getElementById("cWrapOpposite");
if (cWrapOppositeEl) {
  cWrapOppositeEl.checked = st.wrapOpposite !== false;
  cWrapOppositeEl.onchange = () => {
    st.wrapOpposite = cWrapOppositeEl.checked;
    if (wrapModeOn()) wrapRebuild();
    saveCache();
  };
}
/* Кнопки-шаги на случай, когда мышью неудобно (и чтобы можно было выставить ровное число бит). */
for (const [id, delta, side] of [["bWrapLDec", -1, "L"], ["bWrapLInc", 1, "L"],
                                 ["bWrapRDec", -1, "R"], ["bWrapRInc", 1, "R"]]) {
  const el = document.getElementById(id);
  if (!el) continue;
  el.onclick = () => {
    if (!wrapModeOn()) { say("✂ Сначала включите режим переноса."); return; }
    const key = side === "L" ? "wrapL" : "wrapR";
    st[key] = Math.max(0, (st[key] | 0) + delta);
    updateWrapUi();
    wrapRebuild();
  };
}

/* ЛИНИИ ТЯНУТСЯ МЫШЬЮ ПО ПОЛОТНУ. Пока режим включён, протяжка по полю строк не выделяет строки
   (см. проверку wrapModeOn() в обработчиках #rows), а двигает ближайшую линию: начал в левой
   половине — левую, в правой — правую. Число бит считается по ширине символа (realColStepPx),
   тем же счётом, что и всё остальное позиционирование. */
let wrapDrag = null;
document.addEventListener("mousedown", (e) => {
  if (!wrapModeOn() || e.button !== 0) return;
  const rowsEl = document.getElementById("rows");
  if (!rowsEl || !rowsEl.contains(e.target)) return;
  const r = rowsEl.getBoundingClientRect();
  const side = (e.clientX - r.left) < r.width / 2 ? "L" : "R";
  wrapDrag = { side, x0: e.clientX, start: st[side === "L" ? "wrapL" : "wrapR"] | 0 };
  e.preventDefault();
  e.stopPropagation();
}, true);
document.addEventListener("mousemove", (e) => {
  if (!wrapDrag) return;
  const step = (typeof realColStepPx === "function") ? realColStepPx() : 0;
  if (!(step > 0)) return;
  // Левая линия едет вправо — режет больше; правая наоборот (её "внутрь" — это влево).
  const d = Math.round((e.clientX - wrapDrag.x0) / step) * (wrapDrag.side === "L" ? 1 : -1);
  const val = Math.max(0, wrapDrag.start + d);
  const key = wrapDrag.side === "L" ? "wrapL" : "wrapR";
  if (st[key] === val) return;
  st[key] = val;
  updateWrapUi();
  wrapRebuild();
});
document.addEventListener("mouseup", () => { wrapDrag = null; });

/* "🧹 Очистить" — СТЕРЕТЬ СОДЕРЖИМОЕ, не трогая места (запрос пользователя: "очистка всех
   строк"). В отличие от Delete строки и ячейки остаются, просто становятся пустыми — ни номера,
   ни соответствие строк паттернам не съезжают.
   Колонки, как и при удалении (см. deleteSelectedRows), берутся СВОИМИ выделениями:
     выделены строки           → чистятся их биты;
     выделены ячейки паттернов → чистятся их тексты;
     выделено и там, и там     → и то, и другое;
     не выделено ничего        → чистятся ВСЕ строки цепочки (паттерны при этом целы: стереть
                                 разом весь список паттернов — потеря, которую не восстановить
                                 ничем, кроме Отмены). */
function clearSelectedOrAll(){
  const rowSel = (st.selectedRows && st.selectedRows.size) ? Array.from(st.selectedRows) : null;
  const patSel = (st.selectedPats && st.selectedPats.size) ? Array.from(st.selectedPats) : null;
  snapshot();
  let rowsDone = 0, patsDone = 0;
  const rowIdxs = rowSel || (patSel ? [] : st.rows.map((_, i) => i));
  for (const i of rowIdxs) {
    if (i < 0 || i >= st.rows.length || !st.rows[i]) continue;
    st.rows[i] = "";
    invFlagsMap.delete(i); insertedFlagsMap.delete(i);
    rowsDone++;
  }
  for (const i of (patSel || [])) {
    const p = (i >= 0 && i < st.pats.length) ? st.pats[i] : null;
    if (!p || !p.text) continue;
    p.text = ""; p.found = false; p.kind = null; p.step = null;
    patsDone++;
  }
  maskChangedMap.clear(); maskBaseRows = null;
  // Нулевая строка должна остаться ровно одна и на своём месте — после очистки строк выше неё
  // могла образоваться вторая пустая (см. ensureZeroRow).
  ensureZeroRow();
  render(); saveCache();
  const parts = [];
  if (rowsDone) parts.push(`строк — ${rowsDone}` + (rowSel ? "" : " (все)"));
  if (patsDone) parts.push(`паттернов — ${patsDone}`);
  say(parts.length ? "🧹 Очищено: " + parts.join(", ") + ". Строки и ячейки на местах."
                   : "🧹 Очищать нечего — всё и так пусто.");
}
const bClearAllRowsEl = document.getElementById("bClearAllRows");
if (bClearAllRowsEl) bClearAllRowsEl.onclick = clearSelectedOrAll;
