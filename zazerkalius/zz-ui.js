/* ═══════════════════════════════════════════════════════════════════════════════════════════
   ZAZERKALIUS — ИНТЕРФЕЙС
   Всё состояние — в объекте Z; сохраняется в localStorage (обёрнуто в try: в приватном окне
   хранилища может не быть, и страница обязана работать без него). Математика — в zz-core.js.
   ═══════════════════════════════════════════════════════════════════════════════════════════ */
const ZZ_KEY = "zazerkalius_v1";
/* v0.030: окна можно вынести в отдельное окно браузера (⧉); их элементы живут уже в чужом документе,
   поэтому поиск по id смотрит и туда — иначе вынесенное окно перестало бы обновляться. */
const popups = new Map();   // id окна → window
const $ = (id) => {
  const el = document.getElementById(id);
  if (el) return el;
  for (const w of popups.values()) { try { const e = w.document.getElementById(id); if (e) return e; } catch (err) {} }
  return null;
};

const Z = {
  rows: ["1", "11", "101", "1111", "10001", "110011", "1010101", "11111111", "100000001"],
  cur: 4,
  fixShow: true,
  ff: '"Roboto Mono", Consolas, monospace',
  fs: 18,
  descentAlign: "center",
  cycOp: "rotLI", cycHeat: true,
  gf2Op: "rotLI", gf2T: 1,
  linSrc: "cur", structSrc: "cur", thruMode: "concatR",   // v0.042: structSrc — лента «🧪 Структуры»
  fixKind: "common", foldSrc: "cur", foldFirst: 1, foldStep: 1, bwtIdx: 0,   // v0.006
  foldAlign: "center",   // v0.008: выравнивание живого ⊿
  theme: "",             // v0.009: "" — как в системе, "light" / "dark" — выбрано кнопкой
  lanes: null, lane: 0, laneCount: 1,   // v0.015: до 4 полей строк; Z.rows — всегда рабочее поле (lanes[lane])
  laneView: "cols", axisPos: [], ovOp: "xor",   // v0.018: поля колонками / наложением; оси — в полуклетках
  pack: true,                            // v0.015: окна прижимаются к верху
  viewYaw: 30, viewPitch: 35,            // v0.024: 🧊 Вид — поворот взгляда, в градусах
  viewMode: "one", viewAng: {},          // v0.025: одна строка / все строки; у строки свой поворот
  viewShape: "stair",                    // v0.027: лесенка / гребёнка
  viewZoom: 1, viewPan: [0, 0], viewZoomRow: {},   // v0.028: масштаб колесом и сдвиг большой картинки; масштаб карточек
  viewLocal: {},                         // v0.029: свой поворот строки внутри стопки «все вместе»
  viewM: null,                           // v0.029: камера — матрица поворота 3×3 (крутится от текущего вида)
  viewOff: {},                           // v0.029: сдвиг строки в стопке (Ctrl + перетаскивание)
  viewGuides: true,                      // v0.029: полупрозрачные ось и плоскость
  viewSolo: false,                       // v0.031: крутить строки стопки по отдельности — только с галкой
  dockOrder: [],                         // v0.025: окна под полем строк, по порядку
  paneIcons: false,                      // v0.035: левая панель — значками в один столбик
  rowsH: 0,                              // v0.026: высота поля строк, когда под ним окна (0 — половина колонки)
  tplRef: null,   // v0.037: номер своего шаблона-эталона (⚑) — с ним сравниваются строки; null — ещё не выбран
  showFM: false, show01: false, showFix: false,   // v0.036: числа у номеров; красные неподвижные биты
  rowsAlign: "center", rowsW: 0, tpl: [], layoutVer: 0,   // v0.010: поле строк, ширина поля (0 — по умолчанию), свои шаблоны
  maskStr: "10", maskN: 16, maskMode: "pascal",   // v0.011: треугольник по маске (v0.012: и от строки)
  sigMsg: "1101", sigBase: "10", sigDev: "inv", sigShape: "tri", sigLen: 8, sigNoise: 0,   // v0.013: сигнал по базе
  manMode: "enc",   // v0.007: режим кнопки манчестерского кода — "enc" или "dec"
  ptrMin: 4, ptrPal: true, ptrAnti: true,
  win: {},          // id → { x, y, w, h, collapsed, hint }
  helpOn: true,
  z: 10,
};
const undoStack = [];
let gf2Last = null;

function load(){
  try {
    const raw = localStorage.getItem(ZZ_KEY);
    if (!raw) return;
    const u = JSON.parse(raw);
    if (u && Array.isArray(u.rows) && u.rows.every(zzIsBits)) Object.assign(Z, u);
  } catch (e) { /* хранилища нет — работаем с тем, что по умолчанию */ }
  if (!Z.rows.length) Z.rows = ["1"];
  Z.cur = Math.max(0, Math.min(Z.rows.length - 1, Z.cur | 0));
}
function save(){
  syncLane();
  try { localStorage.setItem(ZZ_KEY, JSON.stringify(Z)); } catch (e) { /* нет хранилища — не беда */ }
}
let msgTimer = 0;
function say(t){
  const m = $("msg");
  m.textContent = t; m.classList.add("show");
  clearTimeout(msgTimer); msgTimer = setTimeout(() => m.classList.remove("show"), Math.min(12000, 2500 + t.length * 45));
}
function cur(){ return Z.rows[Z.cur] || ""; }
/* v0.015: поля строк. Z.rows — ссылка на рабочее поле; кнопки по-прежнему могут присвоить Z.rows новый
   массив — syncLane() (в save, snapshot, renderRows) кладёт его обратно в Z.lanes. */
function syncLane(){ if (Array.isArray(Z.lanes)) Z.lanes[Z.lane] = Z.rows; }
function laneInit(){
  if (!Array.isArray(Z.lanes) || !Z.lanes.length || !Z.lanes.every(l => Array.isArray(l) && l.every(zzIsBits))) Z.lanes = [Z.rows];
  Z.lanes = Z.lanes.slice(0, 4).map(l => l.length ? l : ["1"]);
  while (Z.lanes.length < 4) Z.lanes.push(["1"]);
  Z.laneCount = Math.max(1, Math.min(4, Z.laneCount | 0 || 1));
  Z.lane = Math.max(0, Math.min(Z.laneCount - 1, Z.lane | 0));
  Z.rows = Z.lanes[Z.lane];
  Z.cur = Math.max(0, Math.min(Z.rows.length - 1, Z.cur | 0));
}
function snapshot(){
  syncLane();
  undoStack.push({ rows: Z.rows.slice(), cur: Z.cur, lane: Z.lane, lanes: Array.isArray(Z.lanes) ? Z.lanes.map(l => l.slice()) : null,
                   laneCount: Z.laneCount, axisPos: Array.isArray(Z.axisPos) ? Z.axisPos.slice() : [] });   // v0.022: и поля, и оси
  if (undoStack.length > 200) undoStack.shift();
  if (typeof rowSel !== "undefined") rowSel.clear();
}
function undo(){
  const u = undoStack.pop();
  if (!u) { say("↩ Отменять нечего."); return; }
  if (u.laneCount) { Z.laneCount = u.laneCount; Z.axisPos = u.axisPos; const lc = document.getElementById("laneCount"); if (lc) lc.value = String(Z.laneCount); }
  if (u.lanes) { Z.lanes = u.lanes; Z.lane = Math.max(0, Math.min(Z.laneCount - 1, u.lane | 0)); Z.rows = Z.lanes[Z.lane]; }
  else Z.rows = u.rows;
  Z.cur = Math.max(0, Math.min(Z.rows.length - 1, u.cur));
  renderAll(); save(); say("↩ Отменено.");
}
/* Сделать рабочим поле k (и строку row, если задана). */
function switchLane(k, row, quiet){
  k = Math.max(0, Math.min(Z.laneCount - 1, k | 0));
  syncLane();
  Z.lane = k; Z.rows = Z.lanes[k];
  if (!Z.rows.length) Z.rows.push("1");
  if (row !== undefined) Z.cur = row;
  Z.cur = Math.max(0, Math.min(Z.rows.length - 1, Z.cur));
  rowSel.clear();
  if (typeof chk !== "undefined") chk = null;
  renderAll(); save();
  if (!quiet) say(`Поле ${k + 1} — рабочее: окна, кнопки и шаблоны работают с его строками.`);
}
function esc(s){ return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

/* ─── Биты в разметке ────────────────────────────────────────────────────────────────────── */
/* Каждый бит — отдельная ячейка фиксированной ширины (--cw): на них ложатся указатели симметрии,
   и позиция бита в пикселях считается просто номером × шаг. */
function bitCells(s, mask, extraCls){
  let h = "";
  for (let i = 0; i < s.length; i++) {
    let c = "bit b" + s[i];
    if (mask) c += mask[i] ? " fx" : " mv";
    if (extraCls) c += extraCls(i);
    h += '<span class="' + c + '" data-i="' + i + '">' + s[i] + "</span>";
  }
  return h;
}
function bitsPlain(s){
  // Для длинных показов — без ячеек: единицы ярко, нули тускло, одной строкой.
  return s.replace(/1+/g, m => '<span class="b1">' + m + "</span>").replace(/(^|>)(0+)/g, (a, p, z) => p + '<span class="b0">' + z + "</span>");
}
function cellPx(){
  const pb = $("ptrBits"), probe = pb && pb.querySelector(".bit");   // v0.030: окно может быть вынесено
  if (probe) { const w = probe.getBoundingClientRect().width; if (w > 0) return w; }
  return Z.fs * 0.62;
}

/* ─── Столбик строк ──────────────────────────────────────────────────────────────────────── */
/* v0.010: поле строк в центре. Длинная строка показывается первыми ROW_SHOW битами (дальше — сколько
   ещё), править её можно всю. Во время правки на месте поле не перерисовывается. */
const ROW_SHOW = 4096;
/* v0.036, запрос «неподвижных бит 2, меняющихся 6 — рядом с номером строки, компактно; кнопку, чтобы прямо в
   строках подсветила красным неподвижные; число 0 и 1 у номеров — отдельной кнопкой». */
/* v0.037, запрос «крась номер строки, если там есть изменённые по сравнению с сохранённой версией биты, и снимай
   краску, если восстановилось». Сохранённая версия — свой шаблон-столбик, отмеченный ⚑ (Z.tplRef); по умолчанию —
   последний сохранённый «＋ Столбик». Сравнение — строка в строку, рабочее поле; считается при каждой отрисовке,
   поэтому краска снимается сама, как только строка снова равна эталону. */
function tplRefRows(){ const t = typeof Z.tplRef === "number" && Z.tpl[Z.tplRef]; return t ? t.rows : null; }
function rowChanged(i){ const R = tplRefRows(); return !!R && (i >= R.length || Z.rows[i] !== R[i]); }
function rowChgInfo(){
  const R = tplRefRows(); if (!R) return "";
  let n = 0; for (let i = 0; i < Z.rows.length; i++) if (i >= R.length || Z.rows[i] !== R[i]) n++;
  const gone = Math.max(0, R.length - Z.rows.length);
  return ` · против «${Z.tpl[Z.tplRef].name}»: ` + (n || gone ? `изменено ${n} стр.` + (gone ? `, недостаёт ${gone}` : "") : "без изменений");
}
function rowCounts(s){
  if (s === undefined || (!Z.showFM && !Z.show01)) return "";
  let h = "";
  if (Z.showFM) {
    let fx = 0; const n = s.length;
    for (let i = 0; i < n; i++) if (s[i] === s[n - 1 - i]) fx++;
    h += '<span class="rc" title="неподвижных бит ' + fx + " (разворот их не трогает), меняющихся " + (n - fx) + '"><span class="rcf">' + fx + '</span>·<span class="rcm">' + (n - fx) + "</span></span>";
  }
  if (Z.show01) {
    const k = zzOnes(s);
    h += '<span class="rc" title="нулей ' + (s.length - k) + ", единиц " + k + '"><span class="b0">' + (s.length - k) + '</span>:<span class="b1">' + k + "</span></span>";
  }
  return h;
}
function bitsShow(s){
  const x = s.length > ROW_SHOW ? s.slice(0, ROW_SHOW) : s;
  if (!Z.showFix) return bitsPlain(x);
  const n = s.length; let h = "";
  for (let i = 0; i < x.length; i++) h += '<span class="b' + x[i] + (x[i] === s[n - 1 - i] ? " fxr" : "") + '">' + x[i] + "</span>";
  return h;
}
let rowEditing = -1;
/* v0.012: выделенные строки (щелчок по номеру) — не сохраняются; любая правка строк их снимает (snapshot). */
const rowSel = new Set();
let rowSelAnchor = -1;
/* ─── Поля наложением, оси (v0.018) ───────────────────────────────────────────────────────────
   Запрос пользователя: «в каждом поле нужно до 4 осей для каждой строки» → вариант «4 черты — 4
   треугольника, с возможностью перемещать друг через друга с наложением». Поля (v0.015) встают в одно
   пространство; у поля l ось Z.axisPos[l] — в ПОЛУКЛЕТКАХ (1 клетка = 1ch шрифта цифр). Строка длиной L
   начинается: по центру — A − L, влево — A, вправо — A − 2L (всё в полуклетках), бит j — на +2j.
   Совпавшие места сводятся ovCombine; сдвинутые на полклетки — рисуются оба, внахлёст. */
const OV_SHOW = 1024;
/* v0.022, запрос пользователя «Del выделенной оси» (снимок: ручка оси 3). Щелчок по ручке БЕЗ перетаскивания
   выделяет ось (и делает её поле рабочим); Del удаляет выделенную ось вместе с её полем, ↩ вернёт.
   Выделение снимает любой другой щелчок по полю и Esc — чтобы Del, нажатый ради строки, не снёс поле. */
let axSel = -1;
function deleteLane(k){
  if (Z.laneCount <= 1) { say("Это единственное поле — удалять нечего."); axSel = -1; renderRows(); return; }
  snapshot();
  syncLane();
  Z.lanes.splice(k, 1); Z.lanes.push(["1"]);
  if (Array.isArray(Z.axisPos)) Z.axisPos.splice(k, 1);
  Z.laneCount--;
  if (Z.lane > k) Z.lane--; else if (Z.lane === k) Z.lane = Math.max(0, k - 1);
  Z.lane = Math.min(Z.lane, Z.laneCount - 1);
  Z.rows = Z.lanes[Z.lane];
  Z.cur = Math.max(0, Math.min(Z.rows.length - 1, Z.cur));
  axSel = -1;
  $("laneCount").value = String(Z.laneCount);
  renderAll(); save();
  say(`Del: ось ${k + 1} удалена вместе с её полем. Полей — ${Z.laneCount}, рабочее — ${Z.lane + 1}. ↩ вернёт.`);
}   // бит на строку в показе; в «⤓ итог» идут все
function ovAl(){ return Z.rowsAlign || "center"; }
function ovStart(A, L){ const al = ovAl(); return al === "left" ? A : al === "right" ? A - 2 * L : A - L; }
function ovMinA(L){ const al = ovAl(); return al === "left" ? 0 : al === "right" ? 2 * L : L; }
function laneRows(l){ return l === Z.lane ? Z.rows : Z.lanes[l]; }
function laneMaxLen(l){ let m = 0; for (const s of laneRows(l)) if (s.length > m) m = s.length; return Math.min(m, OV_SHOW); }
function ovAxes(){
  if (!Array.isArray(Z.axisPos)) Z.axisPos = [];
  let x = 2;
  for (let l = 0; l < Z.laneCount; l++) {
    const L = laneMaxLen(l);
    if (typeof Z.axisPos[l] !== "number") Z.axisPos[l] = ovAl() === "left" ? x : ovAl() === "right" ? x + 2 * L : x + L;
    Z.axisPos[l] = Math.max(ovMinA(L), Math.round(Z.axisPos[l]));
    x = Math.max(x, ovStart(Z.axisPos[l], L) + 2 * L + 6);
  }
  return Z.axisPos;
}
function ovCombine(list){
  const op = Z.ovOp || "xor";
  if (op === "xor") return list.reduce((x, e) => x ^ (e.b === "1" ? 1 : 0), 0) ? "1" : "0";
  if (op === "or") return list.some(e => e.b === "1") ? "1" : "0";
  if (op === "and") return list.every(e => e.b === "1") ? "1" : "0";
  const a = list.find(e => e.l === Z.lane) || list[list.length - 1];
  return a.b;
}
/* Места строки i: Map полуклетка → [{ l, b }], по всем полям. cap — сколько бит строки брать. */
function ovRowMap(i, A, cap){
  const m = new Map();
  for (let l = 0; l < Z.laneCount; l++) {
    const s = laneRows(l)[i]; if (s === undefined) continue;
    const Lc = Math.min(s.length, cap), st = ovStart(A[l], Lc);
    for (let j = 0; j < Lc; j++) { const p = st + 2 * j; let e = m.get(p); if (!e) { e = []; m.set(p, e); } e.push({ l, b: s[j], fx: s[j] === s[s.length - 1 - j] }); }
  }
  return m;
}
function ovHeight(){ let H = 0; for (let l = 0; l < Z.laneCount; l++) H = Math.max(H, laneRows(l).length); return H; }
function renderRowsOver(){
  const L = $("rowList"), N = Z.laneCount;
  L.className = "ov-mode";
  const A = ovAxes(), H = ovHeight();
  let maxEnd = 0;
  for (let l = 0; l < N; l++) { const Lm = laneMaxLen(l); maxEnd = Math.max(maxEnd, ovStart(A[l], Lm) + 2 * Lm, A[l] + 2); }
  const W = (maxEnd + 6) / 2 + "ch";
  const lines = A.slice(0, N).map((a, l) => '<i class="axl l' + l + '" style="left:' + (a / 2) + 'ch"></i>').join("");
  let h = '<div class="ov-inner"><div class="ovr axrow"><span class="no" title="Оси полей">оси</span><span class="trk" style="width:' + W + '">';
  for (let l = 0; l < N; l++)
    // v0.020: ручка — внутри точки .axp со шрифтом цифр: ch у самой ручки считался бы от её мелкого шрифта.
    h += '<span class="axp" style="left:' + (A[l] / 2) + 'ch"><span class="axh l' + l + (l === Z.lane ? " act" : "") + (l === axSel ? " sel" : "") + '" data-ax="' + l + '" title="Ось поля ' + (l + 1) + ' — тащи влево / вправо: оси проходят друг через друга, строки накладываются. Щелчок — выделить, Del — удалить ось с её полем">' + (l + 1) + "</span></span>";
  h += lines + "</span></div>";
  for (let i = 0; i < H; i++) {
    let t = "";
    for (const [p, list] of ovRowMap(i, A, OV_SHOW)) {
      if (list.length === 1) {
        const e = list[0];
        t += '<span class="ob l' + e.l + " b" + e.b + (e.l === Z.lane ? " la" : "") + (Z.showFix && e.fx ? " fxr" : "") + '" data-l="' + e.l + '" style="left:' + (p / 2) + 'ch">' + e.b + "</span>";
      } else {
        const v = ovCombine(list), top = list.find(e => e.l === Z.lane) || list[list.length - 1];
        t += '<span class="ob mix b' + v + '" data-l="' + top.l + '" style="left:' + (p / 2) + 'ch" title="' +
             list.map(e => "поле " + (e.l + 1) + ": " + e.b).join(", ") + " → " + v + '">' + v + "</span>";
      }
    }
    h += '<div class="rw ovr' + (i === Z.cur ? " cur" : "") + (rowSel.has(i) ? " sel" : "") + '" data-r="' + i + '"><span class="no' + (rowChanged(i) ? " chg" : "") + '" title="строка ' + i + (rowChanged(i) ? " — изменена против эталона ⚑" : "") + ' · щелчок — выделить">' + i + rowCounts(Z.rows[i]) +
         '</span><span class="trk" style="width:' + W + '">' + lines + t + "</span></div>";
  }
  L.innerHTML = h + "</div>";
  const tot = Z.rows.reduce((a, s) => a + s.length, 0);
  $("fieldInfo").textContent = `наложение ${N} полей · рабочее ${Z.lane + 1} · ${Z.rows.length} стр. · ${tot} бит · текущая ${Z.cur}`;
  const c = L.querySelector(".rw.cur > .no");
  if (c) c.scrollIntoView({ block: "nearest" });
}
/* «⤓ итог»: по каждой строке — места слева направо; совпавшие сведены, пустые целые клетки между — нули. */
function ovResult(){
  const A = ovAxes(), H = ovHeight(), out = [];
  for (let i = 0; i < H; i++) {
    const m = ovRowMap(i, A, Infinity);
    const P = Array.from(m.keys()).sort((a, b) => a - b);
    let r = "", prev = null;
    for (const p of P) {
      if (prev !== null) { const gap = Math.floor((p - prev) / 2) - 1; if (gap > 0) r += "0".repeat(gap); }
      r += m.get(p).length === 1 ? m.get(p)[0].b : ovCombine(m.get(p));
      prev = p;
    }
    if (r) out.push(r);
  }
  return out;
}
function ovControls(){
  const N = Z.laneCount || 1, ov = N > 1 && Z.laneView === "over";
  $("laneView").style.display = "";   // v0.019: виден всегда («где?» — при одном поле его не было)
  ["ovOp", "bOvReset", "bOvOut"].forEach(id => { $(id).style.display = ov ? "" : "none"; });
  return ov;
}
function renderRows(){
  if (rowEditing >= 0) return;
  syncLane();
  if (ovControls()) { renderRowsOver(); return; }   // v0.018
  const L = $("rowList"), N = Z.laneCount || 1;
  L.className = "al-" + (Z.rowsAlign || "center") + (N > 1 ? " multi" : "");
  L.style.setProperty("--lanes", N);
  const lanes = []; for (let l = 0; l < N; l++) lanes.push(l === Z.lane ? Z.rows : Z.lanes[l]);
  const H = Math.max(...lanes.map(x => x.length));
  let h = '<div class="rl-inner">';
  // v0.015: заголовки полей — только когда их больше одного.
  if (N > 1) {
    h += '<div class="rw lhrow"><span class="no"></span>';
    for (let l = 0; l < N; l++)
      h += '<span class="lh' + (l === Z.lane ? " act" : "") + '" data-l="' + l + '" title="Поле ' + (l + 1) + (l === Z.lane ? " — рабочее" : " — щелчок: сделать рабочим") + '">поле ' + (l + 1) + " · " + lanes[l].length + " стр.</span>";
    h += "</div>";
  }
  for (let i = 0; i < H; i++) {
    h += '<div class="rw' + (i === Z.cur ? " cur" : "") + (rowSel.has(i) ? " sel" : "") + '" data-r="' + i + '"><span class="no' + (rowChanged(i) ? " chg" : "") + '" title="строка ' + i + (rowChanged(i) ? " — изменена против эталона ⚑" : "") + ' · щелчок — выделить">' + i + rowCounts(Z.rows[i]) + "</span>";
    for (let l = 0; l < N; l++) {
      const s = lanes[l][i], act = l === Z.lane;
      if (s === undefined) { h += '<span class="bits' + (act ? " la" : "") + '" data-l="' + l + '"></span>'; continue; }
      // v0.012: биты — в своём .bx (только 0 и 1: по нему считаются места выделенных символов), «ещё N бит» — снаружи.
      // v0.015: .bx — только у рабочего поля; выделение и Del работают с ним.
      h += '<span class="bits' + (act ? " la" : "") + '" data-l="' + l + '" title="' + (N > 1 ? "поле " + (l + 1) + ", " : "") + "строка " + i + ", " + s.length + ' бит · двойной щелчок — править">' +
           '<span class="' + (act ? "bx" : "bxo") + '">' + bitsShow(s) + "</span>" +
           (s.length > ROW_SHOW ? '<span class="more"> … ещё ' + (s.length - ROW_SHOW) + " бит</span>" : "") + "</span>";
    }
    h += "</div>";
  }
  L.innerHTML = h + "</div>";
  const tot = Z.rows.reduce((a, s) => a + s.length, 0);
  $("fieldInfo").textContent = (N > 1 ? `поле ${Z.lane + 1} из ${N} · ` : "") + `${Z.rows.length} стр. · ${tot} бит · текущая ${Z.cur} (${cur().length} бит)` + rowChgInfo();
  const c = L.querySelector(".rw.cur > .bits.la") || L.querySelector(".rw.cur > .no");
  if (c) c.scrollIntoView({ block: "nearest", inline: "nearest" });
}
/* ─── Выделение символов мышью (v0.012) ─────────────────────────────────────────────────────
   Запрос пользователя: «выделение, удаление по Del, выделение посимвольно без лишних пробелов в фоне
   выделения, Ctrl+V вставка». Выделение — обычное выделение браузера; здесь оно переводится в места
   бит: для каждой задетой строки — [a, b) в её битах. Номера строк выделению не поддаются (CSS), в
   .bx лежат только 0 и 1, поэтому счёт символов в диапазоне — это и есть номер бита. Если выделение
   уходит за конец показанной длинной строки — до её настоящего конца. null — выделения в поле нет. */
function cnt01(s){ let c = 0; for (let i = 0; i < s.length; i++) if (s[i] === "0" || s[i] === "1") c++; return c; }
function textSelInRows(){
  const sel = window.getSelection && window.getSelection();
  if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
  const rg = sel.getRangeAt(0), L = $("rowList");
  if (!L.contains(rg.commonAncestorContainer) && rg.commonAncestorContainer !== L) return null;
  const out = [];
  L.querySelectorAll(".rw").forEach(rw => {
    if (!rg.intersectsNode(rw)) return;
    const bx = rw.querySelector(".bx"); if (!bx) return;
    const i = +rw.dataset.r, s = Z.rows[i]; if (s === undefined) return;
    const pos = (node, off) => { const r = document.createRange(); r.setStart(bx, 0); r.setEnd(node, off); return cnt01(r.toString()); };
    let a, b;
    if (bx.contains(rg.startContainer) || bx === rg.startContainer) a = pos(rg.startContainer, rg.startOffset);
    else if (rg.comparePoint(bx, 0) === 0) a = 0; else return;
    if (bx.contains(rg.endContainer) || bx === rg.endContainer) b = pos(rg.endContainer, rg.endOffset);
    else if (rg.comparePoint(bx, bx.childNodes.length) === 0) b = s.length; else return;
    if (b > a) out.push({ i, a, b });
  });
  return out.length ? out : null;
}
function clearTextSel(){ const s = window.getSelection && window.getSelection(); if (s) s.removeAllRanges(); }
/* Del: выделенные символы → из строк; иначе выделенные строки → целиком; иначе — текущая строка. */
let delAtEnd = false;   // v0.021: последний Del снёс нижнюю строку — вверх не идём
function deleteSelection(){
  const parts = textSelInRows();
  if (parts) {
    snapshot();
    let gone = 0, rowsGone = 0;
    for (const p of parts.slice().sort((x, y) => y.i - x.i)) {
      const s = Z.rows[p.i], ns = s.slice(0, p.a) + s.slice(p.b);
      gone += p.b - p.a;
      if (ns) Z.rows[p.i] = ns; else { Z.rows.splice(p.i, 1); rowsGone++; if (Z.cur > p.i) Z.cur--; }
    }
    if (!Z.rows.length) Z.rows = ["1"];
    Z.cur = Math.max(0, Math.min(Z.cur, Z.rows.length - 1));
    clearTextSel(); renderAll(); save();
    say(`Del: удалено бит — ${gone}` + (rowsGone ? `, опустевших строк убрано — ${rowsGone}` : "") + ". ↩ вернёт.");
    return;
  }
  /* v0.021, баг-репорт «Del на строке не должен удалять вверх, не переключать выделение — только нижние».
     Del без выделения удаляет текущую строку, и на её место встаёт нижняя — повторный Del идёт вниз. Но на
     ПОСЛЕДНЕЙ строке текущей становилась верхняя, и следующий Del ел столбик вверх. Теперь, удалив
     последнюю строку, Del останавливается: следующий нажатый подряд ничего не трогает. Стоп снимает
     любой щелчок по полю или стрелка. */
  if (!rowSel.size && delAtEnd && Z.cur === Z.rows.length - 1) {
    say("Del: ниже строк больше нет — вверх Del не удаляет. Удалить эту строку — щелчок по ней и Del, или «✕ Удалить».");
    return;
  }
  const list = rowSel.size ? Array.from(rowSel).sort((a, b) => b - a) : [Z.cur];
  const wasLast = !rowSel.size && Z.cur === Z.rows.length - 1;
  snapshot();
  for (const i of list) { Z.rows.splice(i, 1); if (Z.cur > i) Z.cur--; }
  delAtEnd = wasLast;
  let note = "";
  if (!Z.rows.length) { Z.rows = ["1"]; note = " Столбик не бывает пустым — осталась строка «1»."; }
  Z.cur = Math.max(0, Math.min(Z.cur, Z.rows.length - 1));
  renderAll(); save();
  say(`Del: удалено строк — ${list.length}.${note} ↩ вернёт.`);
}

/* Правка на месте: строка превращается в поле ввода той же гарнитуры. */
function editRowInPlace(i){
  const L = $("rowList");
  const rw = L.querySelector('.rw[data-r="' + i + '"]');
  if (!rw) return;
  Z.cur = i;
  rowEditing = i;
  const bits = rw.querySelector(".bits.la") || rw.querySelector(".bits");
  const inp = document.createElement("input");
  inp.type = "text"; inp.value = Z.rows[i]; inp.spellcheck = false;
  inp.size = Math.max(4, Math.min(Z.rows[i].length + 2, 400));
  bits.innerHTML = ""; bits.appendChild(inp);
  inp.focus(); inp.select();
  let done = false;
  const finish = (keep) => {
    if (done) return; done = true;
    rowEditing = -1;
    if (keep) {
      const v = inp.value.replace(/[^01]/g, "");
      if (!v) say("Пустая строка не сохраняется — строка осталась прежней. Удалить её — «✕ Удалить».");
      else if (v !== Z.rows[i]) { snapshot(); Z.rows[i] = v; say(`Строка ${i} исправлена: ${v.length} бит. ↩ вернёт.`); }
    }
    renderAll(); save();
  };
  inp.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Enter") { e.preventDefault(); finish(true); }
    else if (e.key === "Escape") { e.preventDefault(); finish(false); }
  });
  inp.addEventListener("input", () => { inp.size = Math.max(4, Math.min(inp.value.length + 2, 400)); });
  inp.addEventListener("blur", () => finish(true));
}

/* ─── Шаблоны (v0.010) ──────────────────────────────────────────────────────────────────────
   Запрос пользователя: «шаблоны, которые можно по нажатию вставить». Встроенные строятся заново при
   каждом щелчке (у случайных — новые биты), свои хранятся в Z.tpl и живут в памяти страницы. */
function zzThueMorse(n){ let o = ""; for (let i = 0; i < n; i++) { let x = i, p = 0; while (x) { p ^= x & 1; x >>>= 1; } o += p ? "1" : "0"; } return o; }
const TPL_BUILTIN = [
  { name: "● 1", title: "Зерно Серпинского — дальше 🔺+1", rows: () => ["1"] },
  { name: "🔺 Серпинский ×16", title: "16 строк треугольника Паскаля по модулю 2 от «1»", rows: () => { const r = ["1"]; while (r.length < 16) r.push(zzPascalNext(r[r.length - 1])); return r; } },
  { name: "Туэ–Морс 32", title: "0110100110010110… — 1→10, 0→01, пять раз от «0»", rows: () => [zzThueMorse(32)] },
  { name: "🔢 0…15", title: "Номера 0…15 по 4 бита", rows: () => Array.from({ length: 16 }, (_, i) => i.toString(2).padStart(4, "0")) },
  { name: "Палиндром 16", title: "Случайная половина + её отражение ⇄", rows: () => { const h = randomBits(8); return [h + zzRev(h)]; } },
  { name: "Антипалиндром 16", title: "Случайная половина + её инв-отражение ⇄🔁", rows: () => { const h = randomBits(8); return [h + zzInvRev(h)]; } },
  { name: "0101… 16", title: "Период 2", rows: () => ["01".repeat(8)] },
  { name: "011011…010011", title: "Почти периодическая с одним сбоем — пример к ⇅ Сортировке сдвигов", rows: () => ["011011011011010011"] },
  { name: "🎲 16", title: "Случайная строка из 16 бит", rows: () => [randomBits(16)] },
];
function tplInsert(rows, name){
  if (!rows || !rows.length) return;
  snapshot();
  Z.rows.splice(Z.cur + 1, 0, ...rows);
  Z.cur += rows.length;
  renderAll(); save();
  say(`Шаблон «${name}»: ${rows.length === 1 ? "строка " + rows[0].length + " бит" : rows.length + " стр."} под текущей. ↩ вернёт.`);
}
function renderTpl(){
  let h = "";
  TPL_BUILTIN.forEach((t, k) => {
    h += '<div class="tpl"><button class="tb" data-b="' + k + '" title="' + esc(t.title) + '">' + esc(t.name) + "</button></div>";
  });
  if (Z.tpl.length) h += '<div class="tpl-sep">свои</div>';
  Z.tpl.forEach((t, k) => {
    const tip = t.rows.length === 1 ? t.rows[0].slice(0, 200) : t.rows.length + " стр.: " + t.rows.slice(0, 6).map(r => r.slice(0, 40)).join(" / ");
    h += '<div class="tpl mine"><button class="tb" data-u="' + k + '" title="' + esc(tip) + ' · двойной щелчок — переименовать">' + esc(t.name) + "</button>" +
         '<button class="tref' + (Z.tplRef === k ? " on" : "") + '" data-r="' + k + '" title="' + (Z.tplRef === k ? "Эталон: номера строк, отличающихся от этого шаблона, — золотом. Щелчок — выключить сравнение" : "Сравнивать строки с этим шаблоном: номера изменённых — золотом") + '">⚑</button>' +
         '<button class="tx" data-x="' + k + '" title="Удалить этот шаблон">✕</button></div>';
  });
  $("tplList").innerHTML = h;
}
function tplName(rows){
  if (rows.length > 1) return `Столбик · ${rows.length} стр.`;
  const s = rows[0];
  return s.length > 14 ? s.slice(0, 12) + "…" + ` (${s.length})` : s;
}
function insertBelow(s, what){
  snapshot();
  Z.rows.splice(Z.cur + 1, 0, s);
  Z.cur++;
  renderAll(); save();
  if (what) say(what);
}

/* ─── Зеркальный крест ───────────────────────────────────────────────────────────────────── */
function renderCross(){
  const s = cur();
  const o = zzOrbit(s);
  const mask = Z.fixShow ? zzFixedMask(s) : null;
  const q = (cls, lab, img) => '<div class="q ' + cls + (Z.fixShow ? " showfix" : "") + '"><div class="lab">' + lab +
    (img === s && lab.indexOf("здесь") < 0 ? '<span class="eq">= сама строка</span>' : "") + '</div><div class="bitrow">' + bitCells(img, mask) + "</div></div>";
  $("cross").innerHTML =
    q("l", "здесь", s) + '<div class="mirV"></div>' + q("r", "⇄ разворот", o.imgs.rev) +
    '<div class="mirH"></div>' +
    q("l", "🔁 инверсия", o.imgs.inv) + '<div class="mirV"></div>' + q("r", "⇄🔁 инв-разворот", o.imgs.invRev);
  let fx = 0; for (const m of (mask || zzFixedMask(s))) if (m) fx++;
  const stabTxt = o.stab.length
    ? "строку держит " + o.stab.map(k => k === "rev" ? "⇄ разворот — палиндром" : "⇄🔁 инв-разворот — антипалиндром").join(" и ")
    : "ни одно зеркало её не держит";
  $("crossStats").innerHTML = `${s.length} бит · орбита <b>${o.size}</b> из 4 · ${stabTxt} · неподвижных бит <b>${fx}</b>, меняющихся <b>${s.length - fx}</b>`;
}

/* ─── Указатели симметрии ────────────────────────────────────────────────────────────────── */
/* Под строкой — скобки: каждая накрывает кусок, который отражается в себя (палиндром, фиолетовая)
   или в своё инвертированное (антипалиндром, бирюзовая); вертикальная черта скобки — сама ось,
   то есть куда поставить зеркальце. Скобки раскладываются по дорожкам, чтобы не накрывать друг
   друга; длинные — выше. Наведение подсвечивает кусок в строке. */
const PTR_MAX = 60;
function renderPointers(){
  const s = cur();
  $("ptrBits").innerHTML = '<div class="bitrow">' + bitCells(s, null) + "</div>";
  const all = zzAxesOf(s, Z.ptrMin).filter(a => (a.kind === "pal" ? Z.ptrPal : Z.ptrAnti));
  all.sort((a, b) => b.len - a.len || a.lo - b.lo);
  const axes = all.slice(0, PTR_MAX);
  const lanes = [];   // в каждой дорожке — занятые отрезки [lo, hi]
  const place = (a) => {
    for (let k = 0; ; k++) {
      if (!lanes[k]) lanes[k] = [];
      if (lanes[k].every(([l, h]) => a.hi < l - 0 || a.lo > h)) { lanes[k].push([a.lo, a.hi]); return k; }
    }
  };
  const cw = cellPx();
  let h = "";
  axes.forEach((a, idx) => {
    const k = place(a);
    const left = a.lo * cw, width = (a.hi - a.lo + 1) * cw;
    const ax = ((a.pos2 + 1) / 2 - a.lo) * cw;
    const kindTxt = a.kind === "pal" ? "палиндром" : "антипалиндром";
    const onBit = a.pos2 % 2 === 0;   // v0.035: ось по биту — сплошная черта с точкой; в шве между битами — пунктир
    const where = onBit ? `по биту ${a.pos2 / 2}` : `в шве между битами ${(a.pos2 - 1) / 2} и ${(a.pos2 + 1) / 2}`;
    h += '<div class="ptr' + (a.kind === "anti" ? " anti" : "") + (onBit ? " onbit" : " seam") + '" data-k="' + idx + '" style="left:' + left + "px;width:" + width +
         "px;top:" + (4 + k * 10) + "px;--ax:" + ax + 'px" title="' + kindTxt + ", " + a.len + " бит (" + a.lo + "…" + a.hi + "), ось " + where + '"></div>';
  });
  const lanesEl = $("ptrLanes");
  lanesEl.innerHTML = h;
  lanesEl.style.height = (lanes.length ? 8 + lanes.length * 10 : 0) + "px";
  lanesEl.style.width = (s.length * cw) + "px";
  lanesEl.onmouseover = (e) => {
    const p = e.target.closest(".ptr"); if (!p) return;
    const a = axes[+p.dataset.k]; if (!a) return;
    $("ptrBits").querySelectorAll(".bit").forEach((b, i) => {
      b.classList.toggle(a.kind === "pal" ? "hl" : "hla", i >= a.lo && i <= a.hi);
      b.classList.toggle("hlc", a.pos2 === 2 * i);   // v0.035: бит, через который идёт ось, — обведён
    });
  };
  lanesEl.onmouseout = () => $("ptrBits").querySelectorAll(".bit").forEach(b => b.classList.remove("hl", "hla", "hlc"));
  const np = all.filter(a => a.kind === "pal").length, na = all.length - np;
  const nOn = all.filter(a => a.pos2 % 2 === 0).length;   // v0.035: осей по биту (у антипалиндрома их не бывает)
  const longest = all.length ? all[0] : null;
  $("ptrLegend").innerHTML = all.length
    ? `<span class="p">▔│▔ палиндромов ${np}</span> · <span class="a">▔│▔ антипалиндромов ${na}</span> · ` +
      `<b>●│</b> ось по биту — ${nOn} · <b>┆</b> ось между битами — ${all.length - nOn} · самая длинная ось — ${longest.len} бит` +
      (all.length > PTR_MAX ? ` · показаны ${PTR_MAX} длиннейших из ${all.length}` : "") + " · наведи на скобку — кусок подсветится"
    : `осей от ${Z.ptrMin} бит нет — убавь порог`;
}

/* ─── ▽ Спуск ────────────────────────────────────────────────────────────────────────────── */
const DESCENT_SHOW = 64;
function renderDescent(){
  const s = cur(), n = s.length;
  const levels = zzDescent(s), edge = zzEdge(levels);
  const cells = n <= 200;
  let h = "";
  for (let k = 0; k < levels.length && k < DESCENT_SHOW; k++) {
    const l = levels[k];
    const rest = cells ? bitsPlain(l.slice(1)) : esc(l.slice(1));
    h += '<span class="dl">' + (k === 0 ? "строка" : "−" + k) + '</span><span class="dr">' +
         '<span class="edgebit b' + l[0] + '" title="Край: первый бит этажа ' + k + '">' + l[0] + "</span>" + rest + "</span>";
  }
  if (levels.length > DESCENT_SHOW) h += '<span class="dl">…</span><span class="dr" style="font-size:11px;color:var(--dim)">ещё ' + (levels.length - DESCENT_SHOW) + " этаж. — край учтён целиком</span>";
  h += '<span class="dl">край</span><span class="dr edge-row">' + bitsPlain(edge) + "</span>";
  const v = $("descentView");
  v.className = "dgrid al-" + Z.descentAlign;
  v.innerHTML = h;
  const eO = zzOnes(edge), sO = zzOnes(s);
  $("descentHead").textContent = `строка ${Z.cur} · ${n} бит`;
  const verdict = eO <= 1 ? "край — одна единица: строка целиком порождается правилом из одного бита"
    : eO * 4 <= sO ? "край заметно реже строки — в ней есть порядок"
    : "край не реже строки — порядка этим спуском не видно";
  $("descentVerdict").innerHTML = `Единиц в строке <b>${sO}</b>, в краю <b>${eO}</b> — ${verdict}.`;
}

/* ─── 🔁 Цикл и память ───────────────────────────────────────────────────────────────────── */
function runCycle(){
  const s = cur();
  const c = zzCycle(s, Z.cycOp);
  const out = $("cycOut"), view = $("cycView");
  if (c.lam < 0) out.innerHTML = `${c.lab}: за ${c.steps} шагов строка не повторилась — петля длиннее потолка.`;
  else out.innerHTML = `${c.lab}, ${s.length} бит: вход <b>μ = ${c.mu}</b>, петля <b>λ = ${c.lam}</b>` +
    (c.lam === 1 ? " — неподвижная точка: шаг больше ничего не меняет." : ".") +
    (c.states.length < c.mu + c.lam ? ` Показаны первые ${c.states.length} состояний.` : "");
  const heat = Z.cycHeat ? zzMemoryHeat(c.states) : null;
  const W = 200;
  let h = "";
  c.states.forEach((st, k) => {
    const inLoop = c.lam > 0 && k >= c.mu;
    let line = "";
    const len = Math.min(st.length, W);
    for (let i = 0; i < len; i++) {
      const lv = heat ? heat[k][i] : 0;
      line += lv ? '<span class="h' + lv + '">' + st[i] + "</span>" : '<span class="b' + st[i] + '">' + st[i] + "</span>";
    }
    if (st.length > W) line += "…";
    h += '<div class="' + (inLoop ? "loop" : "") + '"><span class="lno">' + k + "</span>" + line + "</div>";
  });
  view.innerHTML = h;
}

/* ─── 🧮 GF(2) ───────────────────────────────────────────────────────────────────────────── */
function runGf2(){
  const s = cur();
  const t = Math.max(1, Math.min(1e9, Math.floor(+Z.gf2T || 1)));
  const r = zzGf2(s, Z.gf2Op, t);
  const out = $("gf2Out");
  if (r.error) { out.textContent = "🧮 " + r.error + ". Возьми строку короче."; gf2Last = null; return; }
  gf2Last = r.x ? { x: r.x, row: Z.cur, src: s } : null;
  out.innerHTML =
    `${r.lab}, t = ${t}, строка ${Z.cur} (${r.n} бит).\n` +
    `Уравнение (Aᵗ ⊕ E)·x = bₜ: ранг <b>${r.rank}</b>, свободных ${r.free}; строк, неподвижных через t шагов: <b>${r.count}</b>.\n` +
    (r.per ? `Своя строка возвращается к себе через <b>${r.per}</b> шаг. — ` + (r.selfFixed ? "она сама из числа решений." : `через t = ${t} — нет.`)
           : `Своя строка за ${r.cap} шагов к себе не вернулась.`) +
    (r.x ? (r.diff ? `\nБлижайшее решение отличается от строки в ${r.diff} бит:\n<span class="mono">${bitsPlain(r.x.length > 200 ? r.x.slice(0, 200) + "…" : r.x)}</span>\n«⤓ Взять» сделает его текущей строкой.`
                   : "\nБлижайшее решение — сама строка.")
         : "\nРешений нет: система несовместна — никакая строка этой длины не вернётся к себе ровно через t шагов.");
}

/* ─── 🧮 Линейная сложность ──────────────────────────────────────────────────────────────── */
function runLin(){
  const tape = Z.linSrc === "all" ? Z.rows.join("") : cur();
  if (tape.length < 2) { $("linOut").textContent = "В ленте меньше двух бит — считать нечего."; return; }
  const r = zzLinComp(tape, 64);
  const ruleTxt = r.L === 0 ? "лента из одних нулей — правило пустое"
    : "бит = XOR битов, стоящих на " + (r.taps.length > 24 ? r.taps.slice(0, 24).join(", ") + ` … (всего отводов ${r.taps.length})` : r.taps.join(", ")) + " позиций раньше";
  const ratio = r.N ? (2 * r.L) / r.N : 1;
  // v0.005: на коротких лентах любой приговор — гадание: L около N/2 бывает и у порождённой правилом.
  const verdict = r.L === 0 ? "лента пустая по смыслу"
    : r.N < 16 ? `лента короткая (${r.N} бит) — по ней судить рано: возьми строку длиннее или «все строки подряд»`
    : ratio <= 0.25 ? `лента порождена простым правилом: хватает ${2 * r.L} бит вместо ${r.N}`
    : r.L >= r.N / 2 - Math.sqrt(r.N) ? "так ведёт себя случайная лента — линейного правила короче половины нет"
    : "правило есть, но длинное — выигрыш небольшой";
  const cut = (x) => x.length > 200 ? x.slice(0, 200) + "…" : x;
  $("linOut").innerHTML =
    `Лента ${r.N} бит${r.full > r.N ? ` (взяты первые ${r.N} из ${r.full})` : ""}: линейная сложность <b>L = ${r.L}</b>.\n` +
    `Правило: ${ruleTxt}.\n` +
    `Зерно: <span class="mono">${r.seed ? bitsPlain(cut(r.seed)) : "—"}</span>\n` +
    `Дальше по правилу: <span class="mono">${bitsPlain(r.next)}</span>\n` +
    `${verdict}.` + (r.ok ? "" : "\n⚠ Правило не воспроизвело ленту — так быть не должно, сообщи.");
}

/* v0.040, запрос пользователя: «при смене выделения строки вживую бы обновлять сразу результаты». Окно считает само
   при каждой отрисовке (смена текущей строки, правка, новые строки) — если оно не свёрнуто; свёрнутое не считает. */
function renderLinLive(){
  const w = $("w-lin");
  if (!w || w.classList.contains("collapsed") || w.style.display === "none") return;
  runLin();
}

/* ─── 🔎 Адрес строки (v0.041) ────────────────────────────────────────────────────────────────
   Живой пересчёт — коротко (глубина 4, 250 мс), чтобы щелчки по строкам не тормозили; «Искать глубже» —
   глубина 6 и до 4 с. Результат запоминается по строке: пока строка та же, глубокий ответ не затирается. */
let addrLast = null;
function addrShort(x){ return x.length > 48 ? x.slice(0, 48) + "…" : x; }
function addrArg(nd){
  switch (nd.op) {
    case "lit": return "«" + addrShort(nd.arg) + "»";
    case "tm": return "от " + nd.arg;
    case "rep": return "период " + nd.arg;
    case "pas": return nd.arg + " шаг.";
    case "rot": return "на " + nd.arg;
  }
  return "";
}
function addrExpr(nd){
  const a = addrArg(nd), nm = ZZ_ADDR_NAMES[nd.op];
  return nd.kid ? nm + (a ? " [" + a + "]" : "") + " ( " + addrExpr(nd.kid) + " )" : nm + (a ? " " + a : "");
}
function runAddr(deep){
  const s = cur();
  if (!deep && addrLast && addrLast.s === s) { $("addrOut").innerHTML = addrLast.html; return; }
  const r = zzAddress(s, deep ? 6 : 4, deep ? 4000 : 250);
  const b = r.best, N = r.N;
  const chain = []; for (let nd = b; nd; nd = nd.kid) chain.push(nd);
  const steps = chain.slice().reverse().map((nd, i) => {
    const own = nd.cost - (nd.kid ? nd.kid.cost : 0);
    return `${i + 1}. ${ZZ_ADDR_NAMES[nd.op]}${addrArg(nd) ? " " + addrArg(nd) : ""} → <span class="mono">${bitsPlain(addrShort(zzAddrBuild(nd)))}</span> · ${own} бит`;
  }).join("\n");
  const gain = N - b.cost;
  const per = Object.values(r.perOp).sort((a, c) => a.cost - c.cost).map(nd => `${ZZ_ADDR_NAMES[nd.op]} ${nd.cost}`).join(" · ");
  const html =
    `Строка ${N} бит${r.full > N ? ` (взяты первые ${N} из ${r.full})` : ""}. Самый короткий найденный адрес: <b>${b.cost} бит</b> — ` +
    (gain > 0 ? `короче строки на <b>${gain}</b>.` : gain === 0 ? "столько же, сколько строка." : `на ${-gain} длиннее строки: структуры, которую видит этот мир, нет — адрес «как есть» и плата за мир.`) +
    `\nАдрес: ${esc(addrExpr(b))}\n` + steps +
    `\nПо первой операции: ${per}.` +
    `\n${r.cut ? "⏱ Время вышло — это лучшее из найденного, короче может быть. «🔎 Искать глубже» — дольше и глубже." : `Перебрано ${r.nodes} вариантов, глубина ${deep ? 6 : 4}${deep ? "" : " («🔎 Искать глубже» — до 6)"}.`}` +
    (r.ok ? " Адрес собран обратно — совпало ✓" : "\n⚠ Адрес не собрался обратно в строку — так быть не должно, сообщи.");
  addrLast = { s, html, deep: !!deep };
  $("addrOut").innerHTML = html;
}
function renderAddrLive(){
  const w = $("w-addr");
  if (!w || w.classList.contains("collapsed") || w.style.display === "none") return;
  runAddr(false);
}

/* ─── 🧪 Поиск структуры (v0.042) ─────────────────────────────────────────────────────────────
   Живое окно: считает при каждой отрисовке, если не свёрнуто; результат запоминается по ленте и номеру строки. */
let structLast = null;
function structCmp(s, name, c){
  // строка против кандидата бит в бит: совпавшие — тускло, несовпавшие — красным
  let h = ""; const n = Math.min(s.length, 160);
  for (let k = 0; k < n; k++) h += s[k] === c[k] ? '<span class="b0">' + c[k] + "</span>" : '<span class="dif">' + c[k] + "</span>";
  return `<span class="mono">${h}${s.length > n ? "…" : ""}</span> — ${name}: совпало ${s.length - zzHamEq(s, c)} из ${s.length}`;
}
function renderStructLive(){
  const w = $("w-struct");
  if (!w || w.classList.contains("collapsed") || w.style.display === "none") return;
  const all = Z.structSrc === "all", s = all ? Z.rows.join("") : cur();
  const key = (all ? "A" : "C" + Z.cur + ":") + s;
  if (structLast && structLast.key === key) { $("structOut").innerHTML = structLast.html; return; }
  if (s.length < 2) { $("structOut").textContent = "Меньше двух бит — искать нечего."; return; }
  const r = zzStructure(s, all ? { all: true, rows: Z.rows } : { rows: Z.rows, cur: Z.cur });
  const best = r.methods[0], gain = r.raw - best.cost;
  let html = `${all ? `Все строки подряд: ${Z.rows.length} стр., ` : `Строка ${Z.cur}: `}${r.N} бит. «Как есть» — ${r.raw} бит (N + 4 на номер метода).\n` +
    (gain > 0 ? `<b>Структура есть:</b> лучший — «${best.name}», <b>${best.cost} бит</b>, короче на <b>${gain}</b>.`
              : "Ни один метод не короче «как есть» — структуры, которую видят эти методы, нет.") +
    '\n<table class="stbl">' + r.methods.map(m => `<tr class="${m === best && gain > 0 ? "best" : m.name === "как есть" ? "raw" : ""}"><td>${esc(m.name)}</td><td class="n">${m.cost}</td><td class="n">${r.raw - m.cost > 0 ? "−" + (r.raw - m.cost) : ""}</td><td>${esc(m.note)}</td></tr>`).join("") + "</table>";
  if (!all) {
    const N = s.length, i = Z.cur;
    html += `\nНомер ${i} = <span class="mono">${zzBin(i)}</span> (${zzBin(i).length} бит) · длина ${N} = <span class="mono">${zzBin(N)}</span> (${zzBin(N).length} бит). Строка: <span class="mono">${bitsPlain(N > 160 ? s.slice(0, 160) + "…" : s)}</span>\n` +
      zzFromNumCands(i, N).map(([name, c]) => structCmp(s, name, c)).join("\n");
  }
  structLast = { key, html };
  $("structOut").innerHTML = html;
}

/* ─── 🧬 Лента: оси и ядро ───────────────────────────────────────────────────────────────── */
function runThru(){
  const res = zzThruAxes(Z.rows, Z.thruMode);
  const out = $("tapeOut");
  if (!res.axes.length) {
    out.innerHTML = `${ZZ_THRU_MODES[Z.thruMode]}: лента ${res.tape.length} бит, порог ${res.minLen}. Осей через стык строк нет — короче порога оси в ленте такой длины бывают и случайно.`;
    return;
  }
  const ax = res.axes.slice().sort((a, b) => b.len - a.len);
  const np = ax.filter(a => a.kind === "pal").length;
  let h = `${ZZ_THRU_MODES[Z.thruMode]}: лента ${res.tape.length} бит, порог ${res.minLen}. Через стык строк: палиндромных <b>${np}</b>, антипалиндромных <b>${ax.length - np}</b>.\n`;
  ax.slice(0, 16).forEach(a => {
    h += `${a.kind === "pal" ? "▔│▔ палиндром" : "▔│▔ антипалиндром"} ${a.len} бит — строки ${a.r0}…${a.r1} (${a.rows} стр.)\n`;
  });
  if (ax.length > 16) h += `… и ещё ${ax.length - 16}`;
  out.innerHTML = h;
}
function runDecim(){
  const tape = Z.rows.join("");
  const N = tape.length;
  const out = $("tapeOut");
  if (N < 48) { out.textContent = `🧬 В ленте ${N} бит — слишком мало, чтобы прореживать хотя бы на два уровня. Нужно от 48: добавь строк.`; return; }
  const L = Math.max(6, Math.min(16, Math.floor(N / 8)));
  const lines = [], closed = [];
  for (let k = 2; k <= 8; k++) {
    const sz = zzDecimation(tape, k, L);
    let v;
    if (sz.length < 3) v = "мало уровней — не судить";
    else if (sz[sz.length - 1] === sz[sz.length - 2]) { v = `✓ замкнулось на ${sz[sz.length - 1]}`; closed.push(k); }
    else v = "растёт";
    lines.push(`k=${k}:  ${sz.join(" → ")}   ${v}`);
  }
  out.innerHTML = `🧬 Ядро децимации — лента ${N} бит (все строки, сквоз →), окно ${L} бит, счёт по четвёркам V₄:\n` +
    `<span class="mono">${lines.join("\n")}</span>\n` +
    (closed.length ? `Похоже на автоматную при k = ${closed.join(", ")}: новые виды прореживаний кончились.`
                   : "Ни при одном k ядро не замкнулось — конечного автомата за лентой не видно.");
}

/* ─── 🔎 Орбита (v0.004) ────────────────────────────────────────────────────────────────────
   Запрос пользователя (из предложенного): поиск строки по её орбите. Целиком — строки той же
   орбиты V₄ (одна каноника). Кусками — вхождения самой строки и её отражений внутрь других строк;
   собственное место текущей строки (строка cur, позиция 0, она сама) не считается. */
const ORBIT_NAMES = { self: "сама", rev: "⇄ развёрнутая", inv: "🔁 инвертированная", invRev: "⇄🔁 инв-развёрнутая" };
const ORBIT_SUB_MAX = 200;
function runOrbit(){
  const s = cur(), o = zzOrbit(s);
  const out = $("orbitOut");
  const whole = [];
  Z.rows.forEach((r, i) => {
    if (i === Z.cur || r.length !== s.length) return;
    if (zzOrbit(r).canon !== o.canon) return;
    const key = Object.keys(o.imgs).find(k => o.imgs[k] === r) || "self";
    whole.push({ i, key });
  });
  let h = `Строка ${Z.cur} (${s.length} бит), орбита ${o.size} из 4.\n<b>Целиком</b> — строк той же орбиты: ${whole.length}\n`;
  whole.forEach(w => { h += `<span class="hit" data-r="${w.i}">строка ${w.i} — ${ORBIT_NAMES[w.key]}</span>\n`; });
  if ($("orbitSub").checked) {
    const seen = new Set(), subs = [];
    let more = 0;
    for (const k of Object.keys(o.imgs)) {
      const img = o.imgs[k];
      if (seen.has(img)) continue;
      seen.add(img);
      Z.rows.forEach((r, i) => {
        if (r.length < img.length) return;
        let p = r.indexOf(img);
        while (p >= 0) {
          const trivial = (i === Z.cur && p === 0 && k === "self") || (r.length === img.length);
          if (!trivial) { if (subs.length < ORBIT_SUB_MAX) subs.push({ i, p, k }); else more++; }
          p = r.indexOf(img, p + 1);
        }
      });
    }
    h += `<b>Кусками</b> внутри строк: ${subs.length + more}` + (more ? ` (показаны первые ${ORBIT_SUB_MAX})` : "") + "\n";
    subs.sort((a, b) => a.i - b.i || a.p - b.p)
        .forEach(x => { h += `<span class="hit" data-r="${x.i}">строка ${x.i}, с бита ${x.p} — ${ORBIT_NAMES[x.k]}</span>\n`; });
  }
  out.innerHTML = h;
}

/* ─── ⇋ Поправка зеркала (v0.006) ────────────────────────────────────────────────────────────
   Из Layers v1.625 («а что если отзеркалить строку — половины данных достаточно» → «половину
   обозначим на симметричные и несимметричные биты»). Считается сама при каждой смене строки, как
   спуск. «△ От центра» — вопрос «строку разделить пополам, и её центр будет 1 бит, начало
   треугольника, а при чётной…»: этажи от середины наружу, по биту слева и справа; пара, которая не
   сошлась, — золотом. Это та же поправка D, прочитанная от центра. */
const FIX_SHOW = 512, CENTER_SHOW = 48;
function markBits(bits, D){
  let h = "";
  const n = Math.min(bits.length, FIX_SHOW);
  for (let i = 0; i < n; i++)
    h += D[i] === "1" ? '<span class="edgebit b' + bits[i] + '" title="Несимметричный: пара не сошлась">' + bits[i] + "</span>" : '<span class="b' + bits[i] + '">' + bits[i] + "</span>";
  return h + (bits.length > FIX_SHOW ? "…" : "");
}
function renderFix(){
  const s = cur(), n = s.length;
  const view = $("fixView"), out = $("fixOut"), cv = $("fixCenter");
  $("fixHead").textContent = `строка ${Z.cur} · ${n} бит`;
  if (n < 2) { view.innerHTML = ""; cv.innerHTML = ""; $("fixCenterHead").textContent = ""; out.textContent = "В строке один бит — половин нет."; return; }
  const h = n >> 1, odd = n & 1;
  const L = s.slice(0, h), R = s.slice(n - h);
  const { all, best } = zzMirrorAll(s);
  const cut = (x) => bitsPlain(x.length > FIX_SHOW ? x.slice(0, FIX_SHOW) + "…" : x);
  let g = '<span class="dl">L</span><span class="dr">' + markBits(L, best.D) + "</span>" +
          '<span class="dl">R</span><span class="dr">' + cut(R) + "</span>";
  if (odd) g += '<span class="dl">середина</span><span class="dr">' + bitsPlain(s[h]) + "</span>";
  for (const a of all)
    g += '<span class="dl" title="' + esc(a.k.name) + '">D ' + a.k.sign + (a === best ? " ★" : "") + '</span><span class="dr">' + markBits(a.D, a.D) +
         ' <span class="dim" style="font-size:11px">' + a.ones + " из " + h + "</span></span>";
  view.innerHTML = g;
  const f = zzMirrorFolds(s), plan = zzMirrorPlan(s);
  const foldTxt = f.folds.length ? f.folds.map(x => x.m + " " + x.sign + (x.mid ? "(+ср.)" : "")).join(" → ") + " → " + f.seed.length : "не складывается ни разу";
  const planTxt = plan.steps.length ? plan.steps.map(p => p.m + " " + p.sign + (p.ones ? " попр." + p.ones : "")).join(" → ") + " → зерно " + plan.seed.length : "сырьём: зеркала не окупаются";
  const verdict = best.ones === 0 && plan.cost * 4 <= n ? "строка симметрична на многих этажах — хранится в разы короче"
    : best.ones === 0 ? "половины хватает: поправка пустая"
    : plan.cost < n ? `поправка редкая — строка «почти ${best.k.name}», сжимается`
    : "поправка — мусор: зеркала тут не помогают";
  out.innerHTML = `${n} бит = половина ${h} + поправка ${h}${odd ? " + средний бит" : ""}. Лучше всех — ${best.k.name} ${best.k.sign}: несимметричных бит <b>${best.ones}</b> из ${h}.\n` +
    `Складывания подряд без поправки: <b>${f.folds.length}</b> (${foldTxt}).\n` +
    `Цена в мире зеркал ≈ <b>${plan.cost}</b> бит вместо ${n} (${planTxt}) — ${verdict}.`;
  // △ От центра: зеркальные виды (⇄ или ⇄🔁) — у повторов пары вокруг центра не стоят.
  const k = best.k.rev ? best.k : ZZ_MIRROR_KINDS[0];
  const c0 = odd ? h : h - 1, c1 = h;               // вершина: бит h (нечётная) или пара h−1, h
  const layers = odd ? h + 1 : h;
  let ch = "", radius = -1;
  for (let j = 0; j < layers && j < CENTER_SHOW; j++) {
    const a = c0 - j, b = c1 + j;
    const pairBad = (a !== b) && ((s[a] !== s[b]) !== k.inv);
    let row = "";
    for (let i = a; i <= b; i++) {
      const edge = (i === a || i === b) && a !== b;
      row += (edge && pairBad) ? '<span class="edgebit b' + s[i] + '">' + s[i] + "</span>" : '<span class="b' + s[i] + '">' + s[i] + "</span>";
    }
    ch += '<span class="dl">' + (j === 0 ? "центр" : "+" + j) + '</span><span class="dr">' + row + "</span>";
  }
  for (let j = odd ? 1 : 0; j < layers; j++) { const a = c0 - j, b = c1 + j; if ((s[a] !== s[b]) !== k.inv) { radius = j; break; } }
  if (layers > CENTER_SHOW) ch += '<span class="dl">…</span><span class="dr" style="font-size:11px;color:var(--dim)">ещё ' + (layers - CENTER_SHOW) + " этаж.</span>";
  cv.innerHTML = ch;
  const goodLayers = radius < 0 ? layers : radius;   // этажей от вершины без золота
  const palLen = radius < 0 ? n : (odd ? 2 * radius - 1 : 2 * radius);
  $("fixCenterHead").textContent = `${k.sign} · вершина — ${odd ? "средний бит" : "средняя пара"}, этажей ${layers}; ` +
    (radius < 0 ? `ни одной золотой пары — вся строка ${k.sign === "⇄" ? "палиндром" : "антипалиндром"}`
                : `без золота подряд ${goodLayers} — в центре ${k.sign === "⇄" ? "палиндром" : "антипалиндром"} ${palLen} бит`) +
    (odd && k.inv ? " (средний бит — сам по себе: антипалиндром нечётной длины не бывает)" : "");
}

/* ─── ⊿ Сложить в форму (v0.006; живой показ — v0.008) ─────────────────────────────────────
   v0.008, запрос пользователя: «ещё туда онлайн-создание треугольника из строки, которую другими
   инструментами, например этой кнопкой, меняем». Показ строится в renderAll, то есть после любой
   правки строк; в столбик кладёт по-прежнему только «⊿ Сложить». */
const FOLD_ROWS = 128, FOLD_COLS = 256;
function foldNow(){
  const tape = Z.foldSrc === "all" ? Z.rows.join("") : cur();
  const first = Math.max(1, Math.floor(+Z.foldFirst || 1)), step = Math.max(0, Math.floor(+Z.foldStep || 0));
  return { tape, first, step, r: zzFoldShape(tape, first, step) };
}
function renderFoldLive(){
  const { tape, first, step, r } = foldNow();
  const shapeTxt = step === 0 ? `прямоугольник шириной ${first}` : `строки ${first}, ${first + step}, ${first + 2 * step}…`;
  const verdict = r.fresh * 4 <= tape.length ? "в этой форме лента почти вся выводится из себя — порядок виден"
    : r.fresh < tape.length ? "кое-где строки выводятся из предыдущих"
    : "строки друг из друга не выводятся — в этой форме порядка не видно";
  $("foldOut").innerHTML = `${Z.foldSrc === "all" ? "Все строки подряд" : "Строка " + Z.cur}: ${tape.length} бит → <b>${r.pieces.length}</b> стр., ${shapeTxt}` +
    (r.tail ? `, последняя — хвост ${r.tail} бит` : "") + ".\n" +
    `Строк «предыдущая + бит»: <b>${r.plusBit}</b>, «🔺+1 от предыдущей»: <b>${r.pascal}</b>, повторов предыдущей: <b>${r.same}</b>.\n` +
    `Новых бит ≈ <b>${r.fresh}</b> из ${tape.length} — ${verdict}.`;
  const v = $("foldView");
  v.className = "dgrid al-" + (Z.foldAlign || "center");
  const bits = (x) => { let h = ""; for (let i = 0; i < x.length; i++) h += '<span class="b' + x[i] + '">' + x[i] + "</span>"; return h; };
  const mark = { pascal: " 🔺", plus: " +", same: " =", fresh: "" };
  let h = "";
  for (let k = 0; k < r.pieces.length && k < FOLD_ROWS; k++) {
    const p = r.pieces[k], kind = r.kinds[k];
    const cut = p.length > FOLD_COLS;
    const q = cut ? p.slice(0, FOLD_COLS) : p;
    let row;
    if (kind === "pascal" || kind === "same") row = '<span class="der">' + bits(q) + "</span>";
    else if (kind === "plus") {
      const old = Math.min(r.pieces[k - 1].length, q.length);
      row = '<span class="der">' + bits(q.slice(0, old)) + '</span><span class="nb">' + q.slice(old) + "</span>";
    } else row = bits(q);
    const title = kind === "pascal" ? "🔺+1 от предыдущей — нового 0 бит" : kind === "same" ? "повтор предыдущей — нового 0 бит"
      : kind === "plus" ? "предыдущая + новые биты (золотом)" : "вся строка — новые биты";
    h += '<span class="dl" title="' + title + '">' + (k + 1) + mark[kind] + '</span><span class="dr">' + row + (cut ? "…" : "") + "</span>";
  }
  if (r.pieces.length > FOLD_ROWS) h += '<span class="dl">…</span><span class="dr" style="font-size:11px;color:var(--dim)">ещё ' + (r.pieces.length - FOLD_ROWS) + " стр. — в счёте учтены</span>";
  v.innerHTML = h;
}
function runFold(){
  const { tape, first, step, r } = foldNow();
  if (r.pieces.length > 20000) { say(`⊿ Вышло бы ${r.pieces.length} строк — слишком много: возьми первую длину или шаг побольше.`); return; }
  snapshot();
  Z.rows = r.pieces; Z.cur = 0;
  renderAll(); save();
  // Окно после этого показывает уже новый столбик (живой показ), поэтому итог — в сообщении.
  say(`⊿ Сложено в столбик: ${r.pieces.length} стр.` + (r.tail ? `, последняя — хвост ${r.tail} бит` : "") +
      `. «+ бит» ${r.plusBit}, «🔺+1» ${r.pascal}, повторов ${r.same}; новых бит ≈ ${r.fresh} из ${tape.length}. ↩ вернёт.`);
}

/* ─── ⇅ Сортировка сдвигов (v0.006, только в Зазеркалиусе) ─────────────────────────────────
   Запрос пользователя после разговора про «порядок строк, которым можно закодировать порядок в
   строке». Не считается сама на каждую строку — сортировка длинной строки заметна; по кнопке. */
const BWT_ROWS = 48, BWT_COLS = 96;
let bwtLast = null;
function runBwt(){
  const s = cur(), n = s.length;
  if (n > ZZ_BWT_MAX) { say(`⇅ Строка ${n} бит — длиннее ${ZZ_BWT_MAX}.`); return null; }
  const r = zzBwt(s);
  bwtLast = { src: s, row: Z.cur, last: r.last, index: r.index };
  Z.bwtIdx = r.index; $("bwtIdx").value = r.index; save();
  const back = zzUnbwt(r.last, r.index);
  const ru0 = zzRuns(s), ru1 = zzRuns(r.last);
  const cut = (x) => bitsPlain(x.length > 400 ? x.slice(0, 400) + "…" : x);
  $("bwtOut").innerHTML =
    `Строка ${Z.cur}, ${n} бит: таблица ${n}×${n} сдвигов, отсортирована.\n` +
    `Последний столбец: <span class="mono">${cut(r.last)}</span>\n` +
    `Оригинал встал в строку <b>№ ${r.index}</b> — это и есть номер для обратного хода.\n` +
    `Серий одинаковых бит: в строке <b>${ru0}</b>, в столбце <b>${ru1}</b> — ` +
    (ru1 * 2 <= ru0 ? "сортировка свела похожие биты вместе, столбец записывается короче."
      : ru1 < ru0 ? "серий стало меньше, но ненамного."
      : "серий не меньше — в этой строке сортировке нечего собирать.") + "\n" +
    `Обратный ход по столбцу и номеру: ${back === s ? "✓ строка восстановлена бит в бит" : "⚠ не сошёлся — так быть не должно, сообщи"}.`;
  // Таблица: первые BWT_ROWS строк (и строка оригинала, если она ниже), последний столбец — золотом.
  const rows = [];
  for (let j = 0; j < n && j < BWT_ROWS; j++) rows.push(j);
  if (r.index >= BWT_ROWS) rows.push(-1, r.index);
  let h = "";
  for (const j of rows) {
    if (j < 0) { h += '<div class="dim">…</div>'; continue; }
    const o = r.order[j];
    const rot = s.slice(o) + s.slice(0, o);
    const body = rot.length > BWT_COLS ? rot.slice(0, BWT_COLS - 1) : rot.slice(0, -1);
    let line = "";
    for (let i = 0; i < body.length; i++) line += '<span class="b' + body[i] + '">' + body[i] + "</span>";
    if (rot.length > BWT_COLS) line += "…";
    line += '<span class="lastc">' + rot[rot.length - 1] + "</span>";
    h += '<div class="' + (j === r.index ? "loop" : "") + '"><span class="lno">' + j + "</span>" + line + (j === r.index ? ' <span class="dim">← оригинал</span>' : "") + "</div>";
  }
  if (n > BWT_ROWS && r.index < BWT_ROWS) h += '<div class="dim">… ещё ' + (n - BWT_ROWS) + " строк</div>";
  $("bwtView").innerHTML = h;
  return r;
}

/* ─── 📡 Сигнал по базе (v0.013) ────────────────────────────────────────────────────────────── */
let sigLast = null;   // последнее отправленное: { msg, clean: строки без шума, mask, dev }
function sigParams(){
  const b = ($("sigBase").value || "").replace(/[^01]/g, "") || "10";
  return { mask: b, dev: $("sigDev").value, shape: $("sigShape").value,
           len: Math.max(1, Math.min(4096, Math.floor(+$("sigLen").value || 8))),
           noise: Math.max(0, Math.min(100, +$("sigNoise").value || 0)) };
}
function sigSend(){
  const msg = ($("sigMsg").value || "").replace(/[^01]/g, "");
  if (!msg) { say("📡 Впиши сообщение из 0 и 1 или возьми текущую строку."); return; }
  if (msg.length > 512) { say(`📡 Сообщение ${msg.length} бит — больше 512 строк в столбик не кладу.`); return; }
  const P = sigParams();
  const clean = zzSignalEncode(msg, P.mask, P.dev, P.shape, P.len);
  const sent = P.noise > 0 ? clean.map(r => zzNoise(r, P.noise / 100)) : clean.slice();
  let flipped = 0; sent.forEach((r, j) => flipped += zzHam(r, clean[j]));
  sigLast = { msg, clean, mask: P.mask, dev: P.dev };
  snapshot();
  const at = Z.cur + 1;
  Z.rows.splice(at, 0, ...sent);
  Z.cur = at;
  rowSel.clear(); for (let j = 0; j < sent.length; j++) rowSel.add(at + j); rowSelAnchor = at;
  renderAll(); save();
  const bits = sent.reduce((a, r) => a + r.length, 0);
  $("sigOut").innerHTML = `Отправлено: сообщение <b>${msg.length}</b> бит → <b>${sent.length}</b> строк, ${bits} бит сигнала` +
    (P.noise > 0 ? `, шум ${P.noise} % — испорчено бит <b>${flipped}</b>` : ", без шума") +
    `. Строки ${at}…${at + sent.length - 1} выделены — «📡 Прочитать».`;
  $("sigView").innerHTML = "";
  say(`📡 Сигнал в столбике: ${sent.length} строк под бывшей текущей, выделены. ↩ вернёт.`);
}
function sigRead(){
  const P = sigParams();
  const idx = rowSel.size ? Array.from(rowSel).sort((a, b) => a - b) : Z.rows.map((_, i) => i);
  const rows = idx.map(i => Z.rows[i]);
  const dec = zzSignalDecode(rows, P.mask, P.dev);
  const got = dec.map(d => d.bit).join("");
  const unsure = dec.filter(d => d.bit === "?").length;
  let cmp = "";
  const same = sigLast && sigLast.msg.length === rows.length && sigLast.mask === P.mask && sigLast.dev === P.dev;
  if (same) {
    let ok = 0, broke = 0, saved = 0;
    for (let j = 0; j < rows.length; j++) {
      if (got[j] === sigLast.msg[j]) ok++;
      const e = zzHam(rows[j], sigLast.clean[j]);
      broke += e; if (e > 0 && got[j] === sigLast.msg[j]) saved++;
    }
    cmp = `\nС отправленным <span class="mono">${bitsPlain(sigLast.msg.length > 120 ? sigLast.msg.slice(0, 120) + "…" : sigLast.msg)}</span>: совпало <b>${ok}</b> из ${rows.length}` +
          (broke ? `; испорчено бит ${broke}, строк, прочитанных верно несмотря на порчу, — <b>${saved}</b>` : "") +
          (ok === rows.length ? " — сообщение дошло целиком." : " — часть бит потеряна: шум больше запаса.");
  }
  $("sigOut").innerHTML = `Прочитано строк: ${rows.length} (${rowSel.size ? "выделенные" : "все"}). База ${P.mask}, 1 — ${P.dev === "ones" ? "сплошные единицы" : "инверсия базы"}.\n` +
    `Сообщение: <span class="mono">${bitsPlain(got.length > 120 ? got.slice(0, 120) + "…" : got)}</span>` +
    (unsure ? `\nНе решено строк: <b>${unsure}</b> — строка ровно посередине между базой и отступом (или база и отступ совпадают).` : "") + cmp;
  let h = "";
  dec.slice(0, 200).forEach((d, j) => {
    const r = rows[j];
    const shown = r.length > 64 ? r.slice(0, 64) + "…" : r;
    const warn = Math.min(d.d0, d.d1);
    h += '<div><span class="lno">' + idx[j] + "</span>" + bitsPlain(shown) +
         ' <span class="dim">→ ' + (d.bit === "?" ? "?" : "<b>" + d.bit + "</b>") + ` · до базы ${d.d0}, до отступа ${d.d1}, запас ${d.spare}` +
         (warn > d.spare ? " · ⚠ порча больше запаса" : warn > 0 ? " · исправлено " + warn : "") + "</span></div>";
  });
  if (dec.length > 200) h += '<div class="dim">… ещё ' + (dec.length - 200) + " строк</div>";
  $("sigView").innerHTML = h;
  say(`📡 Прочитано: ${got.length > 40 ? got.slice(0, 40) + "…" : got}` + (unsure ? ` (не решено ${unsure})` : ""));
}

/* ─── 🔍 Проверка треугольника (v0.014) ─────────────────────────────────────────────────────
   chk.idx — номера строк треугольника, взятые кнопкой «🔍 Проверить» (выделенные или все); дальше
   окно живое: renderAll пересчитывает его по этим же номерам. Щелчок по биту в окне переворачивает
   его в самой строке (с отменой). */
let chk = null;
const CHK_ROWS = 128, CHK_COLS = 256;
function chkRows(){ return chk ? chk.idx.map(i => Z.rows[i]).filter(r => r !== undefined) : []; }
function renderCheck(){
  if (!chk) return;
  const rows = chkRows(), out = $("chkOut"), view = $("chkView");
  if (rows.length !== chk.idx.length) { out.innerHTML = "Строк треугольника больше нет на прежних местах — «🔍 Проверить» заново."; view.innerHTML = ""; return; }
  const T = zzTriChecks(rows, $("chkMode").value);
  if (T.err) { out.innerHTML = `Строки ${chk.idx[0]}…${chk.idx[chk.idx.length - 1]}: ${T.err}.`; view.innerHTML = ""; return; }
  const br = zzTriBroken(rows, T.checks);
  const loc = zzTriLocate(rows, T.checks, br);
  const kind = T.mode === "descent" ? "▽ спуск" : "🔺 Паскаль";
  const candTxt = loc.cand.map(([k, i]) => `строка ${chk.idx[k]}, бит ${i}`).join("; ");
  out.innerHTML = `${kind}: ${rows.length} строк, проверок <b>${T.checks.length}</b>, сломано <b>${loc.nb}</b>.` +
    (!loc.nb ? " Треугольник цел — все тройки сходятся."
      : loc.cand.length === 1 ? `\nИспорчен один бит — <b>${candTxt}</b> (обведён): все сломанные проверки проходят через него. «🩹 Исправить» или щелчок по нему.`
      : loc.cand.length > 1 ? `\nПод одну ошибку подходят несколько бит: ${candTxt} — у каждого все проверки сломаны.`
      : "\nОдним битом это не объяснить — ошибок больше одной. «🩹 Исправить» попробует переворотами по выгоде.");
  let h = "";
  for (let k = 0; k < rows.length && k < CHK_ROWS; k++) {
    const r = rows[k];
    let line = "";
    const n = Math.min(r.length, CHK_COLS);
    for (let i = 0; i < n; i++) {
      const b = loc.bad[k][i];
      const isC = loc.cand.some(([a, c]) => a === k && c === i);
      line += '<span class="b' + r[i] + (b ? " k" + Math.min(3, b) : "") + (isC ? " cand" : "") + '" data-k="' + k + '" data-i="' + i +
              '" title="строка ' + chk.idx[k] + ", бит " + i + ": проверок " + loc.deg[k][i] + ", сломано " + b + ' · щелчок — перевернуть">' + r[i] + "</span>";
    }
    if (r.length > CHK_COLS) line += "…";
    h += '<span class="dl">' + chk.idx[k] + '</span><span class="dr">' + line + "</span>";
  }
  if (rows.length > CHK_ROWS) h += '<span class="dl">…</span><span class="dr" style="font-size:11px;color:var(--dim)">ещё ' + (rows.length - CHK_ROWS) + " строк — в счёте учтены</span>";
  view.innerHTML = h;
}

/* ─── 🧊 Вид: строка как лесенка (v0.024; все строки карточками — v0.025) ──────────────────────
   Из отвлечения пользователя: «1 — линия лежит на экране, 0 — линия от экрана ко мне». Бит 1 — шаг +x, бит 0 —
   шаг +z (к зрителю); путь лежит в плоскости y = 0. Проекция ортогональная: поворот вокруг вертикали (yaw),
   затем наклон (pitch); pitch 90° — вид сверху, где z идёт вниз по экрану. Строк длиннее VIEW_MAX не рисуем.
   v0.025, запрос «показать сразу все строки в таком виде с возможностью кручения каждой по отдельности»:
   режим «все строки» — карточки; у строки i свой поворот Z.viewAng[i] (нет — общий Z.viewYaw/Pitch). */
const VIEW_MAX = 4096, VIEW_CARDS = 128;
const VIEWS = { top: [0, 90], front: [0, 0], left: [90, 0], back: [180, 0], right: [270, 0], iso: [30, 35] };
function viewPath(s){
  const n = Math.min(s.length, VIEW_MAX), P = [[0, 0, 0]];
  let x = 0, z = 0;
  for (let i = 0; i < n; i++) { if (s[i] === "1") x++; else z++; P.push([x, 0, z]); }
  return P.map(([a, b, c]) => [a - x / 2, b, c - z / 2]);
}
function binomBig(n, k){ k = Math.min(k, n - k); let r = 1n; for (let i = 1; i <= k; i++) r = r * BigInt(n - k + i) / BigInt(i); return r; }
/* v0.029, «от текущего вида крутится в одной плоскости»: камера — матрица M (строки — оси экрана: вправо,
   вверх, к зрителю). Из поворота и наклона: M = Rx(наклон)·Ry(поворот) — то же, что было. Стрелки и мышь
   крутят вокруг осей ЭКРАНА: M' = R_экрана · M, поэтому поворот идёт от того, как картинка стоит сейчас. */
function viewMYP(yawD, pitD){
  const y = yawD * Math.PI / 180, p = pitD * Math.PI / 180, cy = Math.cos(y), sy = Math.sin(y), cp = Math.cos(p), sp = Math.sin(p);
  return [cy, 0, sy, sp * sy, cp, -sp * cy, -cp * sy, sp, cp * cy];
}
function mMul(A, B){
  const C = new Array(9);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) C[r * 3 + c] = A[r * 3] * B[c] + A[r * 3 + 1] * B[3 + c] + A[r * 3 + 2] * B[6 + c];
  return C;
}
function mRyS(aD){ const a = aD * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c]; }
function mRxS(aD){ const a = aD * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, -s, 0, s, c]; }
function viewCamM(){ if (!Array.isArray(Z.viewM) || Z.viewM.length !== 9) Z.viewM = viewMYP(Z.viewYaw, Z.viewPitch); return Z.viewM; }
/* Откуда смотрим: ровно спереди / сверху / … — или null (наискосок). Допуск ≈ 14°. */
function viewKey(M){
  const T = 0.97, upZ = M[7], upY = M[4], xX = M[0], zX = M[2];
  if (upZ > T) return xX > T ? "top" : xX < -T ? "topback" : "topany";
  if (upZ < -T) return xX > T ? "bottom" : xX < -T ? "bottomback" : "bottomany";
  if (upY > T) return xX > T ? "front" : xX < -T ? "back" : zX > T ? "left" : zX < -T ? "right" : null;
  return null;
}
const VIEWKEY_YP = { front: [0, 0], left: [90, 0], back: [180, 0], right: [270, 0], top: [0, 90], topback: [180, 90], bottom: [0, -90], bottomback: [180, -90], topany: [45, 90], bottomany: [45, -90] };
const VIEWKEY_NAME = { front: "спереди", left: "слева", back: "сзади", right: "справа", top: "сверху", topback: "сверху, обойдя", bottom: "снизу", bottomback: "снизу, обойдя", topany: "сверху", bottomany: "снизу" };
function viewName(M){ const k = viewKey(M); return k ? VIEWKEY_NAME[k] : "наискосок"; }
/* Привести «откуда смотрим» (матрица или поворот/наклон) к ровным поворот/наклон — для чтения. */
function viewNormYP(yawD, pitD){
  const M = Array.isArray(yawD) ? yawD : viewMYP(yawD, pitD);
  return VIEWKEY_YP[viewKey(M)] || [45, 35];
}
function viewAng(i){ const a = Z.viewAng && Z.viewAng[i]; return a ? a : [Z.viewYaw, Z.viewPitch]; }
function viewReading(s, yawD, pitD){
  [yawD, pitD] = viewNormYP(yawD, pitD);   // v0.029: матрица или углы → ровный вид или «наискосок»
  if (Z.viewShape === "comb") return combReading(s, yawD, pitD);   // v0.027
  const n = s.length, k = zzOnes(s), m = n - k;
  const yaw = ((yawD % 360) + 360) % 360, p = pitD;
  const near = (a, b) => Math.abs(((a - b + 540) % 360) - 180) <= 8;
  const cut = (x) => x.length > 160 ? x.slice(0, 160) + "…" : x;
  if (p >= 80) {
    const c = binomBig(n, k), cs = c.toString();
    const cTxt = cs.length <= 30 ? cs : "≈ 10^" + (cs.length - 1) + " (" + cs.length + " цифр)";
    const odd = (k & m) === 0;
    return `<b>Сверху</b> — виден весь путь: ${k} шагов вправо (единицы) и ${m} к себе (нули), в точку (${k}, ${m}). ` +
      `Лесенок в ту же точку — C(${n}, ${k}) = <b>${cTxt}</b>, число из треугольника Паскаля; оно <b>${odd ? "нечётное" : "чётное"}</b> — ` +
      `в треугольнике Серпинского здесь ${odd ? "1" : "0"} (${k} AND ${m} ${odd ? "= 0" : "≠ 0"}).`;
  }
  if (Math.abs(p) <= 8) {
    const V = near(yaw, 0) ? { name: "спереди", img: s, mir: "сама строка", dash: "1" }
      : near(yaw, 90) ? { name: "слева", img: zzInv(s), mir: "🔁 инверсия", dash: "0" }
      : near(yaw, 180) ? { name: "сзади", img: zzRev(s), mir: "⇄ разворот", dash: "1" }
      : near(yaw, 270) ? { name: "справа", img: zzInvRev(s), mir: "⇄🔁 инв-разворот", dash: "0" } : null;
    if (V) {
      const src = V.name === "сзади" || V.name === "справа" ? zzRev(s) : s;
      let morse = ""; for (let i = 0; i < src.length && i < 160; i++) morse += src[i] === V.dash ? "—" : "·";
      if (src.length > 160) morse += "…";
      const len = V.dash === "1" ? k : m;
      return `<b>${V.name[0].toUpperCase() + V.name.slice(1)}</b> — чёрточки это ${V.dash === "1" ? "единицы" : "нули"}, точки — ${V.dash === "1" ? "нули" : "единицы"} (отрезки смотрят на тебя). ` +
        `Как азбука Морзе: <span class="mono">${morse}</span>\nЭто ${V.mir}: <span class="mono">${bitsPlain(cut(V.img))}</span>\n` +
        `Но честная проекция сливает точки с концами чёрточек: видна сплошная черта длиной ${len} — порядок отсюда не прочесть. Весь путь виден сверху или наискосок.`;
    }
  }
  return `<b>Наискосок</b> — единицы и нули идут в разные стороны экрана, и строка читается целиком: ${k} единиц, ${m} нулей. ` +
    `Кнопки — встать ровно сверху, спереди, слева, сзади или справа.`;
}
/* v0.027, «лесенка / гребёнка» — вариант пользователя: «в азбуке Морзе 1 — чёрточка вертикальная: ! ! . !».
   Лесенка: отрезки друг за другом (1 — шаг +x, 0 — шаг +z). Гребёнка: каждый бит на своём месте в ряд (x = i),
   1 — палочка вверх (+y), 0 — палочка к зрителю (+z). Спереди гребёнка — штрихкод «| | · |»; поворот на 90°
   вокруг оси ряда (вид сверху) превращает палочки в точки и обратно — это 🔁 инверсия; полоборота вокруг
   вертикали — ⇄ разворот. Отрезок: { a, b, bit }. */
function viewSegs(s, shape, yOff){
  const n = Math.min(s.length, VIEW_MAX), segs = [], y0 = yOff || 0;
  if (shape === "comb") {
    const c = (n - 1) / 2;
    for (let i = 0; i < n; i++) {
      const x = i - c;
      segs.push(s[i] === "1" ? { a: [x, y0 - 0.5, -0.5], b: [x, y0 + 0.5, -0.5], bit: "1" }
                             : { a: [x, y0 - 0.5, -0.5], b: [x, y0 - 0.5, 0.5], bit: "0" });
    }
    return segs;
  }
  const P = viewPath(s);
  for (let i = 0; i + 1 < P.length; i++) segs.push({ a: [P[i][0], y0, P[i][2]], b: [P[i + 1][0], y0, P[i + 1][2]], bit: s[i] });
  return segs;
}
/* Общая отрисовка: groups — [{ segs, dim, bold }]. Метки: зелёная — начало строки, золотая — конец. */
function drawSegs(cv, groups, yawD, pitD, small, caption, shape, cam){
  const W = cv.clientWidth, H = cv.clientHeight; if (!W || !H) return;
  const dpr = window.devicePixelRatio || 1;
  if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  const ctx = cv.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
  // v0.029: yawD может быть матрицей камеры (крутится от текущего вида) или углом, как раньше.
  const M = Array.isArray(yawD) ? yawD : viewMYP(yawD, pitD);
  const rot = ([x, y, z]) => [M[0] * x + M[1] * y + M[2] * z, M[3] * x + M[4] * y + M[5] * z];
  let R = 1;
  for (const g of groups) for (const sg of g.segs) R = Math.max(R, Math.hypot(...sg.a), Math.hypot(...sg.b));
  const sc = Math.min(W, H) * (small ? 0.42 : 0.46) / R;
  // v0.028: cam — масштаб (колесо) и сдвиг (Shift+перетаскивание) картинки.
  const zm = cam && cam.zoom > 0 ? cam.zoom : 1, pan = cam && cam.pan ? cam.pan : [0, 0];
  const pr = (q) => { const [a, b] = rot(q); return [W / 2 + pan[0] + a * sc * zm, H / 2 + pan[1] - b * sc * zm]; };
  cv._scale = sc * zm; cv._M = M;   // v0.029: для Ctrl + перетаскивания — перевод пикселей в мир
  const css = getComputedStyle(document.documentElement), V = (n) => css.getPropertyValue(n).trim();
  const c1 = V("--acc"), c0 = V("--acc2"), cd = V("--dim");
  // v0.029, «добавить полупрозрачные ось и плоскость»: плоскость строки (у стопки — текущей) и вертикальная ось.
  if (cam && cam.guides) {
    let E = 1, ylo = Infinity, yhi = -Infinity;
    for (const g of groups) for (const sg of g.segs) for (const q of [sg.a, sg.b]) { E = Math.max(E, Math.abs(q[0]), Math.abs(q[2])); ylo = Math.min(ylo, q[1]); yhi = Math.max(yhi, q[1]); }
    E += 0.8;
    const py = cam.planeY || 0, P4 = [[-E, py, -E], [E, py, -E], [E, py, E], [-E, py, E]].map(pr);
    ctx.globalAlpha = 0.09; ctx.fillStyle = c0;
    ctx.beginPath(); ctx.moveTo(P4[0][0], P4[0][1]); for (let i = 1; i < 4; i++) ctx.lineTo(P4[i][0], P4[i][1]); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 0.35; ctx.strokeStyle = c0; ctx.lineWidth = 1; ctx.stroke();
    /* v0.032, «надо и плоскости ещё добавить, и чтобы за них крутить, когда остальная ось на месте, как в 3D-
       программах»: гизмо поворота. Три полупрозрачные плоскости-кольца через центр сцены — YZ (вокруг X, красное),
       XZ (вокруг Y, зелёное), XY (вокруг Z, синее) — и три оси. Схватил кольцо — крутится только вокруг его оси
       (см. viewRingAt и перетаскивание). Кольца запоминаются на холсте для щелчка. */
    const RG = R * 1.02, col = { x: V("--red"), y: V("--green"), z: "#4d8cff" };
    const ring = (ax) => { const pts = []; for (let k = 0; k <= 72; k++) { const t = k / 72 * Math.PI * 2, c = Math.cos(t) * RG, s = Math.sin(t) * RG;
      pts.push(pr(ax === "x" ? [0, c, s] : ax === "y" ? [c, 0, s] : [c, s, 0])); } return pts; };
    cv._rings = []; cv._center = pr([0, 0, 0]);
    for (const ax of ["x", "y", "z"]) {
      const pts = ring(ax), hot = cv._hotRing === ax || cv._dragRing === ax || (typeof viewLockAx !== "undefined" && viewLockAx === ax);
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (const q of pts) ctx.lineTo(q[0], q[1]); ctx.closePath();
      ctx.globalAlpha = hot ? 0.10 : 0.045; ctx.fillStyle = col[ax]; ctx.fill();
      ctx.globalAlpha = hot ? 0.95 : 0.5; ctx.strokeStyle = col[ax]; ctx.lineWidth = hot ? 3 : 1.6; ctx.stroke();
      cv._rings.push({ ax, pts });
      const e0 = pr(ax === "x" ? [-RG, 0, 0] : ax === "y" ? [0, -RG, 0] : [0, 0, -RG]), e1 = pr(ax === "x" ? [RG, 0, 0] : ax === "y" ? [0, RG, 0] : [0, 0, RG]);
      ctx.globalAlpha = 0.45; ctx.lineWidth = 1.2; ctx.setLineDash([6, 4]);
      ctx.beginPath(); ctx.moveTo(e0[0], e0[1]); ctx.lineTo(e1[0], e1[1]); ctx.stroke(); ctx.setLineDash([]);
      ctx.globalAlpha = 0.8; ctx.fillStyle = col[ax]; ctx.font = "11px system-ui, sans-serif"; ctx.fillText(ax.toUpperCase(), e1[0] + 3, e1[1] - 3);
    }
    ctx.globalAlpha = 1;
  } else cv._rings = [];
  ctx.lineCap = "round";
  const lw = Math.max(1.2, Math.min(small ? 3 : 5, sc * (shape === "comb" ? 0.22 : 0.14)));
  cv._proj = [];   // v0.029: где на экране отрезки каждой строки — для «схватить одну»
  for (const g of groups) {
    ctx.globalAlpha = g.dim ? 0.5 : 1;
    const w = g.bold ? lw * 1.7 : lw;
    const lines = g.idx !== undefined ? [] : null;
    if (lines) cv._proj.push({ idx: g.idx, lines });
    for (const sg of g.segs) {
      const a = pr(sg.a), b = pr(sg.b), col = sg.bit === "1" ? c1 : c0;
      if (lines) lines.push([a[0], a[1], b[0], b[1]]);
      if (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) < 1) {   // палочка смотрит на тебя — точка
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(a[0], a[1], Math.max(1.5, w * 0.75), 0, 7); ctx.fill();
      } else { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
    }
    if (shape !== "comb" && !g.dim && sc > 5 && g.segs.length <= 1024) {   // узлы лесенки
      ctx.fillStyle = cd; const r = Math.min(small ? 2 : 3, sc * 0.09);
      for (const sg of g.segs) { const a = pr(sg.a); ctx.beginPath(); ctx.arc(a[0], a[1], r, 0, 7); ctx.fill(); }
    }
    if (g.segs.length) {
      const f = g.segs[0], l = g.segs[g.segs.length - 1];
      const st = pr(f.a), en = pr(shape === "comb" ? l.a : l.b), rr = small ? 3 : (g.bold ? 4.5 : 3);
      const off = shape === "comb" ? rr + 4 : 0;   // у гребёнки метки — под рядом, чтобы не закрывать палочки
      ctx.fillStyle = V("--green"); ctx.beginPath(); ctx.arc(st[0], st[1] + off, rr, 0, 7); ctx.fill();
      ctx.fillStyle = V("--gold"); ctx.beginPath(); ctx.arc(en[0], en[1] + off, rr, 0, 7); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  // Значок осей: куда идут «1», «0» и верх.
  const O = small ? [16, H - 14] : [34, H - 30], L = small ? 10 : 22;
  const ax = (v, col, lab) => {
    const [a, b] = rot(v); const X = O[0] + a * L, Y = O[1] - b * L;
    ctx.strokeStyle = col; ctx.lineWidth = small ? 1.5 : 2; ctx.beginPath(); ctx.moveTo(O[0], O[1]); ctx.lineTo(X, Y); ctx.stroke();
    if (!small) { ctx.fillStyle = col; ctx.font = "11px system-ui, sans-serif"; ctx.fillText(lab, X + 3, Y + 4); }
  };
  if (shape === "comb") { ax([1, 0, 0], cd, "ряд"); ax([0, 1, 0], c1, "1"); ax([0, 0, 1], c0, "0"); }
  else { ax([1, 0, 0], c1, "1"); ax([0, 0, 1], c0, "0"); ax([0, 1, 0], cd, "↑"); }
  if (caption) { ctx.fillStyle = cd; ctx.font = "11px system-ui, sans-serif"; ctx.fillText(caption, 8, 14); }
}
/* Одна строка (крупно или карточкой). */
function drawStair(cv, s, yawD, pitD, small, caption, cam){
  const shape = Z.viewShape === "comb" ? "comb" : "stair";
  if (cam && cam.guides && shape === "comb") cam = Object.assign({}, cam, { planeY: -0.5 });   // v0.029: плоскость — по основаниям палочек
  drawSegs(cv, [{ segs: viewSegs(s, shape, 0), bold: !small }], yawD, pitD, small, caption, shape, cam);
}
/* v0.026, «все вместе»: строка i — на высоте −i·dy, одна под другой, как в поле строк; крутится вся стопка.
   Строк не больше VIEW_STACK, бит — не больше VIEW_STACK_BITS. У гребёнки шаг по высоте больше: палочки стоят. */
const VIEW_STACK = 256, VIEW_STACK_BITS = 1024;
function drawStack(cv, rows, yawD, pitD, curI, caption, cam){
  const shape = Z.viewShape === "comb" ? "comb" : "stair", dy = shape === "comb" ? 1.7 : 1.3;
  const N = Math.min(rows.length, VIEW_STACK), groups = [];
  for (let i = 0; i < N; i++) {
    const s = rows[i].length > VIEW_STACK_BITS ? rows[i].slice(0, VIEW_STACK_BITS) : rows[i];
    const y0 = ((N - 1) / 2 - i) * dy;
    let segs = viewSegs(s, shape, y0);
    // v0.029: свой поворот строки (схватил и покрутил) — вокруг её центра, до общего поворота камеры.
    const L = Z.viewLocal && Z.viewLocal[i];
    if (L && (L[0] || L[1])) {
      const ly = L[0] * Math.PI / 180, lp = L[1] * Math.PI / 180, cy = Math.cos(ly), sy = Math.sin(ly), cp = Math.cos(lp), sp = Math.sin(lp);
      const r3 = ([x, y, z]) => { const yy = y - y0, x1 = x * cy + z * sy, z1 = -x * sy + z * cy; return [x1, yy * cp - z1 * sp + y0, yy * sp + z1 * cp]; };
      segs = segs.map(sg => ({ a: r3(sg.a), b: r3(sg.b), bit: sg.bit }));
    }
    const O = Z.viewOff && Z.viewOff[i];   // v0.029: строка сдвинута Ctrl + перетаскиванием
    if (O && (O[0] || O[1] || O[2])) segs = segs.map(sg => ({ a: [sg.a[0] + O[0], sg.a[1] + O[1], sg.a[2] + O[2]], b: [sg.b[0] + O[0], sg.b[1] + O[1], sg.b[2] + O[2]], bit: sg.bit }));
    groups.push({ segs, idx: i, dim: curI >= 0 && i !== curI, bold: i === curI });
  }
  if (cam && cam.guides && curI >= 0) cam = Object.assign({}, cam, { planeY: ((N - 1) / 2 - curI) * dy + ((Z.viewOff && Z.viewOff[curI]) ? Z.viewOff[curI][1] : 0) });
  drawSegs(cv, groups, yawD, pitD, false, caption, shape, cam);
}
/* Чтение гребёнки с данной стороны. */
function combReading(s, yawD, pitD){
  const n = s.length, k = zzOnes(s), m = n - k;
  const yaw = ((yawD % 360) + 360) % 360;
  const near = (a, b) => Math.abs(((a - b + 540) % 360) - 180) <= 8;
  const bar = (x) => { let o = ""; for (let i = 0; i < x.length && i < 160; i++) o += x[i] === "1" ? "|" : "·"; return o + (x.length > 160 ? "…" : ""); };
  const cut = (x) => x.length > 160 ? x.slice(0, 160) + "…" : x;
  const flat = Math.abs(pitD) <= 8, up = Math.abs(pitD) >= 80;
  let V = null;
  if (flat && near(yaw, 0)) V = ["Спереди", s, "сама строка", "штрихкод: палочка — 1, точка — 0; порядок виден целиком"];
  else if (flat && near(yaw, 180)) V = ["Сзади", zzRev(s), "⇄ разворот", "та же гребёнка, обойдённая кругом, — порядок задом наперёд"];
  else if (up && near(yaw, 0)) V = [pitD > 0 ? "Сверху" : "Снизу", zzInv(s), "🔁 инверсия", "поворот на 90° вокруг оси ряда: стоячие палочки стали точками, лежащие встали"];
  else if (up && near(yaw, 180)) V = [pitD > 0 ? "Сверху, обойдя" : "Снизу, обойдя", zzInvRev(s), "⇄🔁 инв-разворот", "и поворот вокруг оси ряда, и полоборота"];
  if (V) return `<b>${V[0]}</b> — ${V[3]}: <span class="mono">${bar(V[1])}</span>\nЭто ${V[2]}: <span class="mono">${bitsPlain(cut(V[1]))}</span>`;
  if (flat && (near(yaw, 90) || near(yaw, 270)))
    return `<b>Сбоку</b>, вдоль ряда — все палочки встают одна за другой, остаётся крестик: видно только, что единицы ${k ? "есть" : "нет"} и нули ${m ? "есть" : "нет"}. Единственный вид, который теряет всё.`;
  return `<b>Наискосок</b> — палочки единиц и нулей смотрят в разные стороны, строка читается целиком: ${k} единиц, ${m} нулей. Кнопки — встать ровно спереди, сзади, сверху (🔁) или сбоку.`;
}
let viewCardsN = -1;
/* v0.029, запрос «возможность хватать за одну в общем виде — выделять, и управление стрелками на клавиатуре и
   кнопки вверх-вниз-вправо-влево на поле вверху справа». viewSel — схваченная строка стопки (−1 — никакой). */
let viewSel = -1;
function viewPick(cv, x, y){
  let best = -1, bd = 10;
  for (const g of cv._proj || []) for (const [ax, ay, bx, by] of g.lines) {
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
    const u = L2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L2)) : 0;
    const d = Math.hypot(x - ax - u * dx, y - ay - u * dy);
    if (d < bd) { bd = d; best = g.idx; }
  }
  return best;
}
function viewClampP(p){ return Math.max(-90, Math.min(90, p)); }
/* v0.032: кольцо гизмо под точкой (x, y холста) — "x" / "y" / "z" или null; ближе 9 px к его линии. */
function viewRingAt(cv, x, y){
  let best = null, bd = 9;
  for (const r of cv._rings || []) for (let k = 0; k + 1 < r.pts.length; k++) {
    const [ax, ay] = r.pts[k], [bx, by] = r.pts[k + 1], dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
    const u = L2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L2)) : 0;
    const d = Math.hypot(x - ax - u * dx, y - ay - u * dy);
    if (d < bd) { bd = d; best = r.ax; }
  }
  return best;
}
/* Поворот вокруг оси МИРА: M' = M · R(ось). */
function mRotW(ax, aD){
  const a = aD * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  return ax === "x" ? [1, 0, 0, 0, c, -s, 0, s, c] : ax === "y" ? [c, 0, s, 0, 1, 0, -s, 0, c] : [c, -s, 0, s, c, 0, 0, 0, 1];
}
/* Повернуть на шаг: схваченную строку стопки, карточку текущей строки («все строки») или картинку. */
/* v0.033, «пусть стрелки крутят, как будто последняя выделенная ось закреплена»: потянул за кольцо — его ось
   закреплена (viewLockAx), стрелки крутят только вокруг неё. Снимается свободным поворотом мышью или Esc. */
let viewLockAx = null;
function viewTurn(dYaw, dPit){
  if (Z.viewMode !== "all" && viewLockAx) {   // v0.033: вокруг закреплённой оси; ▶ ▲ — плюс, ◀ ▼ — минус
    Z.viewM = mMul(viewCamM(), mRotW(viewLockAx, dYaw || dPit));
    renderView(); save(); return;
  }
  // v0.029, «вся стопка»: стрелки в «все вместе» крутят всю стопку, схваченную строку — только мышь.
  if (Z.viewMode === "all") {
    if (!Z.viewAng) Z.viewAng = {};
    const a = viewAng(Z.cur);
    Z.viewAng[Z.cur] = [a[0] + dYaw, viewClampP(a[1] + dPit)];
  } else { Z.viewM = mMul(mRxS(dPit), mMul(mRyS(dYaw), viewCamM())); }   // v0.029: от текущего вида
  renderView(); save();
}
/* v0.028, запрос «масштаб менять колёсиком» (снимок: «все вместе», 70 строк — стопка точкой). */
function viewCam(){ return { zoom: Z.viewZoom || 1, pan: Array.isArray(Z.viewPan) ? Z.viewPan : [0, 0], guides: Z.viewGuides !== false }; }
function viewZoomTxt(){ const z = Z.viewZoom || 1; return Math.abs(z - 1) < 0.01 ? "" : ` · масштаб ×${z < 10 ? z.toFixed(1) : Math.round(z)}`; }
function renderView(){
  const win = $("w-view");
  if (!win || win.classList.contains("collapsed") || win.style.display === "none") return;
  const all = Z.viewMode === "all";
  $("viewCvWrap").style.display = all ? "none" : "flex";   // v0.029: холст — в обёртке со стрелками
  $("viewGrid").style.display = all ? "grid" : "none";
  const s = cur();
  if (Z.viewMode === "stack") {   // v0.026: все строки в одной сцене
    const N = Math.min(Z.rows.length, VIEW_STACK);
    drawStack($("viewCv"), Z.rows, viewCamM(), 0, Z.cur < N ? Z.cur : -1,
      `все вместе: ${N} строк` + (Z.rows.length > N ? ` из ${Z.rows.length}` : "") + ` · ${viewName(viewCamM())}` + viewZoomTxt(), viewCam());
    $("viewModeHint").textContent = (viewLockAx ? `🔒 ось ${viewLockAx.toUpperCase()} закреплена — стрелки крутят вокруг неё (Esc — снять) · ` : "") + (!Z.viewSolo ? "щелчок по лесенке — выбрать строку · тянешь — вся стопка, с Ctrl — сдвиг · колесо — масштаб"
      : viewSel >= 0 && viewSel < N ? `✋ строка ${viewSel} схвачена — тянешь её мышью: крутится она, с Ctrl — двигается; стрелки — вся стопка · щелчок по пустому — отпустить`
      : "щелчок по лесенке — схватить одну · тянешь пустое — вся стопка, с Ctrl — сдвиг · колесо — масштаб");
    $("viewOut").innerHTML = `Текущая строка ${Z.cur} (ярче): ` + viewReading(s, viewCamM());
    return;
  }
  if (!all) {
    drawStair($("viewCv"), s, viewCamM(), 0, false,
      `строка ${Z.cur} · ${s.length} бит` + (s.length > VIEW_MAX ? ` (нарисованы первые ${VIEW_MAX})` : "") + ` · ${viewName(viewCamM())}` + viewZoomTxt(), viewCam());
    $("viewModeHint").textContent = (viewLockAx ? `🔒 ось ${viewLockAx.toUpperCase()} закреплена — стрелки крутят вокруг неё (Esc — снять) · ` : "") + "колесо — масштаб · Ctrl + тянуть — сдвиг";
    $("viewOut").innerHTML = viewReading(s, viewCamM());
    return;
  }
  const N = Math.min(Z.rows.length, VIEW_CARDS), G = $("viewGrid");
  if (viewCardsN !== N || G.children.length !== N) {
    let h = "";
    for (let i = 0; i < N; i++) h += '<div class="vcard" data-r="' + i + '"><span class="vl">' + i + '</span><canvas title="Тащи — повернуть эту строку; щелчок — сделать текущей"></canvas></div>';
    G.innerHTML = h; viewCardsN = N;
  }
  G.querySelectorAll(".vcard").forEach((c, i) => {
    c.classList.toggle("cur", i === Z.cur);
    const [ya, pi] = viewAng(i);
    c.querySelector(".vl").textContent = i + " · " + Z.rows[i].length + " бит";
    drawStair(c.querySelector("canvas"), Z.rows[i], ya, pi, true, "", { zoom: (Z.viewZoomRow || {})[i] || 1 });
  });
  $("viewModeHint").textContent = `карточек ${N}` + (Z.rows.length > N ? ` из ${Z.rows.length}` : "") + " · крути каждую · кнопки — всем";
  const [cy0, cp0] = viewAng(Z.cur);
  $("viewOut").innerHTML = `Текущая строка ${Z.cur}: ` + viewReading(s, cy0, cp0);
}

/* ─── Окна ───────────────────────────────────────────────────────────────────────────────── */
/* Раскладка по умолчанию — от ширины стола: зеркало слева широким, справа столбец из спуска и
   цикла, под зеркалом GF(2) и лин. сложность, ниже лента и подсказки. */
function defaultLayout(){
  const g = 12;
  const W0 = $("desk").clientWidth || 900;
  // v0.010: стол стал правой колонкой; если он уже 900, окна идут одной колонкой, по важности.
  if (W0 < 900) {
    const w = Math.max(320, W0 - 2 * g);
    const order = [["w-mirror", 430], ["w-fix", 520], ["w-fold", 380], ["w-descent", 330], ["w-bwt", 460], ["w-sig", 460], ["w-chk", 460], ["w-view", 460], ["w-lin", 240], ["w-addr", 400], ["w-struct", 520],
                   ["w-gf2", 240], ["w-cycle", 330], ["w-tape", 260], ["w-orbit", 240], ["w-help", 300]];
    const out = {}; let y = g;
    for (const [id, h] of order) { out[id] = { x: g, y, w, h }; y += h + g; }
    return out;
  }
  const W = W0;
  const mw = Math.round(Math.min(760, (W - 3 * g) * 0.58));
  const cw = W - mw - 3 * g;
  const half = Math.round((mw - g) / 2);
  return {
    "w-mirror":  { x: g, y: g, w: mw, h: 430 },
    "w-descent": { x: mw + 2 * g, y: g, w: cw, h: 330 },
    "w-cycle":   { x: mw + 2 * g, y: 330 + 2 * g, w: cw, h: 330 },
    "w-gf2":     { x: g, y: 430 + 2 * g, w: half, h: 240 },
    "w-lin":     { x: half + 2 * g, y: 430 + 2 * g, w: half, h: 240 },
    "w-tape":    { x: mw + 2 * g, y: 660 + 3 * g, w: cw, h: 260 },
    "w-help":    { x: g, y: 670 + 3 * g, w: mw, h: 250 },
    "w-orbit":   { x: g, y: 920 + 4 * g, w: mw, h: 240 },
    // v0.006: ниже прежних — у кого окна уже разложены, прежние остаются на своих местах.
    "w-fix":     { x: g, y: 1160 + 5 * g, w: mw, h: 520 },
    "w-fold":    { x: mw + 2 * g, y: 920 + 4 * g, w: cw, h: 240 },
    "w-bwt":     { x: mw + 2 * g, y: 1160 + 5 * g, w: cw, h: 520 },
    "w-sig":     { x: g, y: 1680 + 6 * g, w: mw, h: 460 },   // v0.013
    "w-chk":     { x: mw + 2 * g, y: 1680 + 6 * g, w: cw, h: 460 },   // v0.014
    "w-view":    { x: g, y: 2140 + 7 * g, w: mw, h: 460 },   // v0.024
    "w-addr":    { x: mw + 2 * g, y: 2140 + 7 * g, w: cw, h: 460 },
    "w-struct":  { x: g, y: 2600 + 8 * g, w: mw, h: 520 },   // v0.042   // v0.041
  };
}
function applyWin(el){
  const id = el.id, w = Z.win[id];
  if (!w) return;
  el.style.left = w.x + "px"; el.style.top = w.y + "px";
  el.style.width = w.w + "px";
  if (!w.collapsed) el.style.height = w.h + "px";
  el.classList.toggle("collapsed", !!w.collapsed);
  el.classList.toggle("hint", !!w.hint);
}
/* ─── ⤒ Окна к верху (v0.015) ────────────────────────────────────────────────────────────────
   Запрос пользователя: «прижми поля автоматом к верху» (снимок: свёрнутый «▽ Спуск», под ним пустота).
   Окна идут сверху вниз по своему y, и каждое поднимается до нижнего края окон, стоящих над ним в той
   же полосе по x (хоть немного перекрывающихся по ширине). Места по x не трогаются. Зовётся после
   раскладки, сворачивания, перетаскивания и растягивания. На узком экране окна и так стопкой. */
/* v0.017: окна — в пределах стола. Снимок пользователя: свёрнутое окно, правый край с «?» и «–»
   срезан краем стола. Стол сужается, когда тянут разделитель или сужают окно браузера, а окна
   держали прежние места и ширину. Теперь окно шире стола ужимается (не уже 260 px), а вылезающее за
   правый край — сдвигается влево. Зовётся из packWins, то есть после любых перестановок, при смене
   размера окна браузера и после разделителя. */
/* v0.023, запрос пользователя «пусть восстанавливают ширину — если справа свободно» (снимок: «🪞 Зеркало»,
   ужатое в v0.017, так и осталось узким). Теперь ужатие ВРЕМЕННОЕ: окно помнит желаемую ширину pw и место px
   (pw — растянул за угол или «📐 Разложить»; не задана — сколько свободно) и каждый раз берёт min(pw, место
   до края стола или до окна справа, стоящего на той же высоте). Освободилось справа — ширина возвращается. */
function fitWins(){
  const D = $("desk").clientWidth; if (!D) return;
  const g = 12, MINW = 260;
  const items = Array.from(document.querySelectorAll(".win"))
    .filter(el => Z.win[el.id] && el.style.display !== "none" && getComputedStyle(el).position === "absolute")
    .map(el => {
      const w = Z.win[el.id];
      const px = typeof w.px === "number" ? w.px : w.x;
      return { el, w, tx: Math.max(g, Math.min(px, D - g - MINW)), y0: w.y, y1: w.y + el.offsetHeight };
    });
  for (const it of items) {
    const pw = typeof it.w.pw === "number" ? it.w.pw : Infinity;
    let right = D - g;
    for (const o of items) if (o !== it && o.tx > it.tx && o.y0 < it.y1 && it.y0 < o.y1) right = Math.min(right, o.tx - g);
    const tw = Math.round(Math.max(MINW, Math.min(pw, right - it.tx)));
    if (tw !== it.w.w || it.tx !== it.w.x) {
      it.w.w = tw; it.w.x = it.tx;
      it.el._fitW = tw;
      it.el.style.left = it.tx + "px"; it.el.style.width = tw + "px";
    }
  }
}
function packWins(){
  fitWins();   // v0.017
  if (!Z.pack) return;
  const g = 12;
  const items = Array.from(document.querySelectorAll(".win"))
    .filter(el => el.style.display !== "none" && getComputedStyle(el).position === "absolute" && Z.win[el.id])
    .map(el => ({ el, w: Z.win[el.id], h: el.offsetHeight, wd: el.offsetWidth }));
  items.sort((a, b) => (a.w.y - b.w.y) || (a.w.x - b.w.x));
  const placed = [];
  for (const it of items) {
    let y = g;
    for (const p of placed) if (it.w.x < p.w.x + p.wd && p.w.x < it.w.x + it.wd) y = Math.max(y, p.w.y + p.h + g);
    it.w.y = y; it.el.style.top = y + "px";
    placed.push(it);
  }
}
/* ─── Окна под полем строк (v0.025) ────────────────────────────────────────────────────────────
   Запрос пользователя: «возможность перетаскивать эти окна под поле строк». Окно, отпущенное над средней
   колонкой, встаёт в #fieldDock (класс .docked, на всю ширину, высота — своя); Z.dockOrder хранит порядок. */
function dockSave(){ Z.dockOrder = Array.from($("fieldDock").children).map(el => el.id); dockState(); }
/* v0.026: есть окна под строками — колонка прокручивается, у строк своя высота Z.rowsH (тянется за угол). */
function dockState(){
  const has = $("fieldDock").children.length > 0, L = $("rowList");
  $("field").classList.toggle("has-dock", has);
  L.style.height = has ? (Z.rowsH > 0 ? Z.rowsH : Math.max(160, Math.round($("field").clientHeight * 0.5))) + "px" : "";
}
function dockWin(el, clientY){
  const dock = $("fieldDock");
  let before = null;
  for (const c of dock.children) { if (c === el) continue; const r = c.getBoundingClientRect(); if (clientY < r.top + r.height / 2) { before = c; break; } }
  if (before) dock.insertBefore(el, before); else dock.appendChild(el);
  el.classList.add("docked");
  const w = Z.win[el.id]; if (w) w.dock = true;
  dockSave();
}
function undockWin(el){
  $("desk").appendChild(el);
  el.classList.remove("docked");
  const w = Z.win[el.id]; if (w) w.dock = false;
  dockSave();
}
function dockRestore(){
  const order = Array.isArray(Z.dockOrder) ? Z.dockOrder : [];
  for (const id of order) { const el = $(id); if (el && Z.win[id] && Z.win[id].dock) { $("fieldDock").appendChild(el); el.classList.add("docked"); } }
  dockState();
}
/* ─── ⧉ Окно — в отдельное окно браузера (v0.030) ────────────────────────────────────────────
   Запрос пользователя: «возможность каждого окна — в отдельное». Как панели Layers: в новое окно копируются
   все стили страницы, тема и шрифт цифр, а само окно переезжает туда целиком (adoptNode) — со всеми своими
   обработчиками, поэтому продолжает жить: пересчитывается, крутится, слушает строки. Закрыли то окно (или ⧉
   ещё раз) — окно возвращается на своё место: на стол или под поле строк. После перезагрузки страницы окна
   сами не выносятся: браузер не открывает окна без щелчка. */
const popHome = new Map();   // id → { docked }
function popOut(el){
  const id = el.id;
  const r = el.getBoundingClientRect();
  const w = window.open("", "zz_" + id, "width=" + Math.max(420, Math.round(r.width)) + ",height=" + Math.max(320, Math.round(r.height) + 30));
  if (!w) { say("Браузер не дал открыть окно — разреши всплывающие окна для этой страницы."); return; }
  const styles = Array.from(document.querySelectorAll("style")).map(s => s.textContent).join("\n");
  const d = w.document;
  d.open();
  d.write('<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>' + esc(el.dataset.title || id) + " — Zazerkalius</title><style>" + styles + "</style><style>" +
    "html,body{height:100%;overflow:hidden;margin:0}" +
    ".win.popped{position:relative !important;left:0 !important;top:0 !important;width:100% !important;height:100% !important;resize:none;border:0;border-radius:0;box-shadow:none;min-height:0}" +
    ".win.popped.collapsed{height:auto !important}" +
    "</style></head><body></body></html>");
  d.close();
  const th = document.documentElement.getAttribute("data-theme");
  if (th) d.documentElement.setAttribute("data-theme", th);
  d.documentElement.style.cssText = document.documentElement.style.cssText;   // --ff, --fs
  const docked = el.classList.contains("docked");
  el.classList.remove("docked", "dragging");
  d.body.appendChild(d.adoptNode(el));
  el.classList.add("popped");
  popups.set(id, w); popHome.set(id, { docked });
  if (docked) dockSave();
  w.addEventListener("resize", () => { if (id === "w-mirror") renderPointers(); renderAll(); });
  w.addEventListener("pagehide", () => popIn(id));
  el.querySelector(".bp").classList.add("on");
  renderAll(); packWins(); save();
  say(`⧉ «${el.dataset.title || id}» — в отдельном окне. Закроешь его или нажмёшь ⧉ ещё раз — вернётся.`);
}
function popIn(id){
  const w = popups.get(id); if (!w) return;
  popups.delete(id);
  let el = null;
  try { el = w.document.getElementById(id); } catch (err) {}
  const home = popHome.get(id) || {}; popHome.delete(id);
  if (el) {
    document.adoptNode(el);
    el.classList.remove("popped");
    if (home.docked) { $("fieldDock").appendChild(el); el.classList.add("docked"); dockSave(); }
    else $("desk").appendChild(el);
    applyWin(el);
    const bp = el.querySelector(".bp"); if (bp) bp.classList.remove("on");
  }
  try { w.close(); } catch (err) {}
  renderAll(); packWins(); save();
}
window.addEventListener("beforeunload", () => { for (const w of popups.values()) { try { w.close(); } catch (err) {} } });
function layoutAll(reset){
  const def = defaultLayout();
  if (reset) document.querySelectorAll(".win.docked").forEach(undockWin);   // v0.025: «📐 Разложить» — все окна на стол
  document.querySelectorAll(".win").forEach(el => {
    if (reset || !Z.win[el.id]) {
      Z.win[el.id] = Object.assign({ collapsed: false, hint: false }, def[el.id] || { x: 20, y: 20, w: 320, h: 240 });
      Z.win[el.id].pw = Z.win[el.id].w; Z.win[el.id].px = Z.win[el.id].x;   // v0.023: желаемые ширина и место
    }
    applyWin(el);
  });
  $("w-help").style.display = Z.helpOn ? "" : "none";
  $("bHelp").classList.toggle("on", Z.helpOn);
  packWins();   // v0.015
}
function setupWin(el){
  const head = document.createElement("div");
  head.className = "whead";
  head.innerHTML = '<span class="wt">' + esc(el.dataset.title || el.id) + "</span>" +
    (el.querySelector(".whint") ? '<button class="bh" title="Подсказка: что это и почему">?</button>' : "") +
    '<button class="bp" title="В отдельное окно браузера — например, на второй монитор. Ещё раз ⧉ или закрыть то окно — вернуть">⧉</button>' +
    '<button class="bc" title="Свернуть / развернуть">–</button>';
  el.insertBefore(head, el.firstChild);
  head.querySelector(".bp").onclick = () => { if (popups.has(el.id)) popIn(el.id); else popOut(el); };   // v0.030
  const st = () => (Z.win[el.id] = Z.win[el.id] || { x: 20, y: 20, w: 320, h: 240 });
  const bh = head.querySelector(".bh");
  if (bh) bh.onclick = () => { const w = st(); w.hint = !w.hint; el.classList.toggle("hint", w.hint); bh.classList.toggle("on", w.hint); save(); };
  if (bh && Z.win[el.id] && Z.win[el.id].hint) bh.classList.add("on");
  head.querySelector(".bc").onclick = () => {
    const w = st(); w.collapsed = !w.collapsed;
    el.classList.toggle("collapsed", w.collapsed);
    if (!w.collapsed) el.style.height = w.h + "px";
    packWins();   // v0.015: свернул — нижние поднимаются
    if (!w.collapsed && el.id === "w-view") renderView();   // v0.039: свёрнутый «Вид» не рисуется — развернул, рисуем сразу
    if (!w.collapsed && el.id === "w-lin") renderLinLive();   // v0.040: и «Лин. сложность» так же
    if (!w.collapsed && el.id === "w-addr") renderAddrLive();
    if (!w.collapsed && el.id === "w-struct") renderStructLive();   // v0.042   // v0.041
    save();
  };
  // v0.016, запрос пользователя «двойной щелчок по заголовку»: свернуть / развернуть, как «–».
  head.addEventListener("dblclick", (e) => {
    if (e.target.closest("button")) return;
    e.preventDefault();
    const s = window.getSelection && window.getSelection(); if (s) s.removeAllRanges();
    head.querySelector(".bc").click();
  });
  const front = () => { Z.z++; el.style.zIndex = Z.z; };
  el.addEventListener("pointerdown", front);
  head.addEventListener("pointerdown", (e) => {
    if (e.target.closest("button") || e.button !== 0) return;
    if (el.classList.contains("popped")) return;   // v0.030: в отдельном окне окно стоит на всё окно
    if (window.matchMedia && window.matchMedia("(max-width:760px)").matches) return;   // узкий экран: окна стоят стопкой
    e.preventDefault();
    const w = st();
    // v0.025: пока тащишь — окно поверх всего (fixed), чтобы его можно было донести до поля строк.
    const r0 = el.getBoundingClientRect(), offX = e.clientX - r0.left, offY = e.clientY - r0.top;
    const wasDocked = el.classList.contains("docked");
    if (wasDocked) el.classList.remove("docked");   // иначе left/top: auto !important держат окно на месте
    el.classList.add("dragging");
    el.style.left = r0.left + "px"; el.style.top = r0.top + "px"; el.style.width = r0.width + "px";
    head.setPointerCapture(e.pointerId);
    const field = $("field");
    const overField = (ev) => { const f = field.getBoundingClientRect(); return ev.clientX >= f.left && ev.clientX <= f.right && ev.clientY >= f.top && ev.clientY <= f.bottom; };
    const move = (ev) => {
      el.style.left = (ev.clientX - offX) + "px"; el.style.top = (ev.clientY - offY) + "px";
      field.classList.toggle("dock-hint", overField(ev));
    };
    const up = (ev) => {
      head.removeEventListener("pointermove", move); head.removeEventListener("pointerup", up);
      field.classList.remove("dock-hint");
      el.classList.remove("dragging");
      if (overField(ev)) {
        dockWin(el, ev.clientY);
        el.style.left = ""; el.style.top = ""; el.style.width = "";
      } else {
        if (wasDocked) undockWin(el);
        const desk = $("desk"), d = desk.getBoundingClientRect();
        w.x = Math.max(0, Math.round(ev.clientX - offX - d.left + desk.scrollLeft));
        w.y = Math.max(0, Math.round(ev.clientY - offY - d.top + desk.scrollTop));
        el.style.left = w.x + "px"; el.style.top = w.y + "px"; el.style.width = w.w + "px";
        w.px = w.x;   // v0.023: поставил — это желаемое место
      }
      packWins(); save();
      if (el.id === "w-view") renderView();
    };
    head.addEventListener("pointermove", move);
    head.addEventListener("pointerup", up);
  });
  // Размер, растянутый за угол, запоминается.
  if (window.ResizeObserver) {
    let t = 0;
    // v0.023: растягивание за угол — это желаемая ширина pw; ширину, поставленную fitWins, желаемой не считаем.
    el.addEventListener("pointerdown", (e) => {
      const r = el.getBoundingClientRect();
      if (e.clientX > r.right - 20 && e.clientY > r.bottom - 20) el._userResize = true;
    });
    window.addEventListener("pointerup", () => { if (el._userResize) setTimeout(() => { el._userResize = false; }, 350); });
    new ResizeObserver(() => {
      const w = Z.win[el.id]; if (!w || w.collapsed) return;
      if (el.classList.contains("dragging")) return;
      if (el.classList.contains("docked")) { w.h = Math.round(el.offsetHeight); clearTimeout(t); t = setTimeout(save, 300); if (el.id === "w-mirror") renderPointers(); return; }   // v0.025
      if (getComputedStyle(el).position !== "absolute") return;
      w.w = Math.round(el.offsetWidth); w.h = Math.round(el.offsetHeight);
      if (el._userResize) { w.pw = w.w; w.px = w.x; }
      clearTimeout(t); t = setTimeout(() => { packWins(); save(); }, 300);   // v0.015: растянул — соседи подстраиваются
      if (el.id === "w-mirror") renderPointers();
    }).observe(el);
  }
}

/* ─── ☀ Светлый фон (v0.009) ───────────────────────────────────────────────────────────────
   Запрос пользователя: «сделай кнопку светлого фона всего html Зазеркалиуса». Цвета — токены на
   :root, у каждой темы свой набор (см. стили); кнопка ставит data-theme на <html>. Пока ничего не
   выбрано, страница идёт за системой. Надпись — то, что включится по щелчку. */
function themeIsLight(){
  if (Z.theme) return Z.theme === "light";
  return !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches);
}
function applyTheme(){
  if (Z.theme) document.documentElement.setAttribute("data-theme", Z.theme);
  else document.documentElement.removeAttribute("data-theme");
  const b = $("bTheme");
  if (b) b.textContent = themeIsLight() ? "🌙 Тёмный" : "☀ Светлый";
}

/* ─── v0.035: ЛЕВАЯ ПАНЕЛЬ ЗНАЧКАМИ (запрос по снимку панели: «возможность скрывать в значки в один столбик»).
   Кнопка ◂ в углу панели сворачивает её в узкий столбик: у каждой кнопки остаётся только значок — первое слово
   подписи, если в нём нет букв (🔺+1, 🎲, ⇅, 🧹, △, ＋…), иначе первые две буквы (у шаблонов «Туэ–Морс» — «Ту»);
   длинное — первые три знака. Полная подпись уходит в начало всплывающей подсказки. Заголовки разделов, поля
   ввода и ✕ у своих шаблонов в столбике не показываются; «△ Построить» строит по тому, что вписано в развёрнутой
   панели. ▸ разворачивает обратно, выбор запоминается. Кнопки, которые страница перерисовывает сама (шаблоны,
   ⇉/⇇ кода), превращаются в значки заново — за этим следит MutationObserver. ─── */
function paneIcon(label){
  const t = label.trim(), w = t.split(/\s+/)[0] || "";
  const ch = /[A-Za-zА-Яа-яЁё]/.test(w) ? Array.from(w.replace(/[^A-Za-zА-Яа-яЁё]/g, "")).slice(0, 2) : Array.from(w);
  return ch.length > 3 ? ch.slice(0, 3).join("") : ch.join("");
}
function iconizePane(){
  document.querySelectorAll("#rowsPane button").forEach(b => {
    if (b.id === "bPaneIcons" || b.classList.contains("tx")) return;
    const cur = b.textContent;
    if (b.dataset.icon !== undefined && b.dataset.icon === cur) return;   // уже значок
    if (b.dataset.tip0 === undefined) b.dataset.tip0 = b.title || "";
    const ic = paneIcon(cur);
    b.dataset.full = cur; b.dataset.icon = ic;
    b.title = cur.trim() + (b.dataset.tip0 ? " — " + b.dataset.tip0 : "");
    b.textContent = ic;
  });
}
function applyPaneIcons(){
  document.body.classList.toggle("pane-icons", !!Z.paneIcons);
  const t = $("bPaneIcons");
  if (t) { t.textContent = Z.paneIcons ? "▸" : "◂"; t.title = Z.paneIcons ? "Развернуть панель — кнопки с подписями" : "Свернуть панель в столбик значков (подписи — во всплывающих подсказках)"; }
  if (Z.paneIcons) { iconizePane(); return; }
  document.querySelectorAll("#rowsPane button[data-full]").forEach(b => {
    if (b.textContent === b.dataset.icon) b.textContent = b.dataset.full;
    b.title = b.dataset.tip0 || "";
    delete b.dataset.full; delete b.dataset.icon; delete b.dataset.tip0;
  });
}

/* ─── Всё разом ──────────────────────────────────────────────────────────────────────────── */
function applyView(){
  document.documentElement.style.setProperty("--ff", Z.ff);
  document.documentElement.style.setProperty("--fs", Z.fs + "px");
  $("bFixShow").classList.toggle("on", Z.fixShow);
}
/* v0.034, баг-репорт «сломалось» (снимок: «🧊 Вид» в режиме «все строки» — холст со стрелками есть, карточек нет;
   у меня на тех же версиях не повторилось). «Вид» перерисовывается последним: если окно раньше него падало на
   данных пользователя, до «Вида» дело не доходило. Теперь каждое окно — в своём try: упавшее не гасит остальные,
   а ошибка с именем окна показывается внизу — её текст и нужен, чтобы починить. */
function renderAll(){
  const parts = [["вид страницы", applyView], ["поле строк", renderRows], ["крест", renderCross], ["указатели", renderPointers],
    ["спуск", renderDescent], ["поправка", renderFix], ["сложить", renderFoldLive], ["проверка", renderCheck], ["вид 🧊", renderView], ["лин. сложность", renderLinLive], ["адрес 🔎", renderAddrLive], ["структура 🧪", renderStructLive]];
  if (!renderAll.tplDone) parts.splice(2, 0, ["шаблоны", () => { renderTpl(); renderAll.tplDone = true; }]);
  for (const [name, f] of parts) {
    try { f(); }
    catch (e) {
      console.error("Zazerkalius:", name, e);
      if (renderAll.lastErr !== name + e.message) { renderAll.lastErr = name + e.message; say(`⚠ Окно «${name}» не нарисовалось: ${e.message}` + (e.stack ? " · " + String(e.stack).split("\n")[1].trim() : "") + " — пришли этот текст."); }
    }
  }
}
// v0.034: любая ошибка страницы — внизу сообщением, с местом в коде.
window.addEventListener("error", (e) => { try { say(`⚠ Ошибка: ${e.message} · ${String(e.filename || "").split("/").pop()}:${e.lineno} — пришли этот текст.`); } catch (err) {} });

/* ─── Подключение ────────────────────────────────────────────────────────────────────────── */
function fillSelect(id, entries, val){
  const el = $(id);
  el.innerHTML = entries.map(([k, v]) => '<option value="' + k + '">' + esc(v) + "</option>").join("");
  el.value = val;
}
/* ─── Строки из файла (v0.002) ───────────────────────────────────────────────────────────────
   Запрос пользователя: «дай возможность сразу текст-файл закинуть со строками, как в других html».
   Тот же вид, что в Layers и Genezis: строка файла — строка столбика; из каждой берутся только 0 и 1
   (пробелы, запятые, номера строк выбрасываются), пустые пропускаются. Столбик ЗАМЕНЯЕТСЯ целиком —
   файл обычно и есть набор, с которым хотят работать; ↩ вернёт прежний. */
function parseRows(text){
  return String(text).split(/\r?\n/).map(l => l.replace(/[^01]/g, "")).filter(Boolean);
}
function loadRowsText(text, name){
  const rows = parseRows(text);
  if (!rows.length) { say(`📂 ${name || "Текст"}: строк из 0 и 1 не нашлось.`); return; }
  snapshot();
  Z.rows = rows; Z.cur = 0;
  renderAll(); save();
  const maxLen = rows.reduce((m, r) => Math.max(m, r.length), 0);
  say(`📂 ${name || "Текст"}: загружено строк — ${rows.length}, самая длинная — ${maxLen} бит. Прежний столбик вернёт ↩.`);
}
function readFile(f){
  if (!f) return;
  const rd = new FileReader();
  rd.onload = () => loadRowsText(rd.result, f.name);
  rd.onerror = () => say(`📂 Не удалось прочитать ${f.name}.`);
  rd.readAsText(f);
}
function saveRowsTxt(){
  const blob = new Blob([Z.rows.join("\r\n") + "\r\n"], { type: "text/plain" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "zazerkalius-stroki.txt";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function randomBits(n){ let o = ""; for (let i = 0; i < n; i++) o += Math.random() < 0.5 ? "0" : "1"; return o; }

function init(){
  load();
  laneInit();   // v0.015
  if (typeof Z.tplRef !== "number") { Z.tplRef = -1; for (let k = Z.tpl.length - 1; k >= 0; k--) if (Z.tpl[k].rows.length > 1) { Z.tplRef = k; break; } }   // v0.037
  applyTheme();   // v0.009: до первой отрисовки — без вспышки тёмного
  document.querySelectorAll(".win").forEach(setupWin);
  // v0.010: стол стал уже (строки переехали в центр) — прежние места окон под него не годятся,
  // раскладываем один раз заново; дальше — как пользователь разложит.
  if ((Z.layoutVer | 0) < 10) { layoutAll(true); Z.layoutVer = 10; save(); }
  else layoutAll(false);
  dockRestore();   // v0.025: окна, пристыкованные под полем строк
  // v0.026: высоту поля строк, растянутую за угол, запоминаем (только когда под ним окна).
  if (window.ResizeObserver) {
    let th = 0;
    new ResizeObserver(() => {
      if (!$("field").classList.contains("has-dock")) return;
      const h = Math.round($("rowList").offsetHeight);
      if (h > 0 && h !== Z.rowsH) { Z.rowsH = h; clearTimeout(th); th = setTimeout(save, 300); }
    }).observe($("rowList"));
  }

  const opEntries = Object.entries(ZZ_OPS).map(([k, o]) => [k, o.lab]);
  fillSelect("cycOp", opEntries, Z.cycOp);
  fillSelect("gf2Op", opEntries, Z.gf2Op);
  fillSelect("thruMode", Object.entries(ZZ_THRU_MODES), Z.thruMode);
  $("fontSel").value = Z.ff; $("fsRange").value = Z.fs;
  $("descentAlign").value = Z.descentAlign;
  $("cycHeat").checked = Z.cycHeat;
  $("gf2T").value = Z.gf2T;
  $("linSrc").value = Z.linSrc;
  $("fixKind").value = Z.fixKind; $("foldSrc").value = Z.foldSrc;
  $("foldFirst").value = Z.foldFirst; $("foldStep").value = Z.foldStep; $("bwtIdx").value = Z.bwtIdx;
  $("ptrMin").value = Z.ptrMin; $("ptrPal").checked = Z.ptrPal; $("ptrAnti").checked = Z.ptrAnti;

  // Строки
  $("rowList").onclick = (e) => {
    if (rowEditing >= 0) return;
    delAtEnd = false;   // v0.021
    // v0.015: заголовок поля или ячейка чужого поля — сделать то поле рабочим.
    const lh = e.target.closest(".lh"); if (lh) { switchLane(+lh.dataset.l); return; }
    if (e.target.closest(".axrow")) return;   // v0.018: ручки осей тащат, а не выбирают
    if (axSel >= 0) { axSel = -1; renderRows(); }   // v0.022: щелчок по полю снимает выделение оси
    const r = e.target.closest(".rw"); if (!r || r.classList.contains("lhrow")) return;
    const cell = e.target.closest(".bits, .ob");
    if (cell && +cell.dataset.l !== Z.lane && !textSelInRows()) { switchLane(+cell.dataset.l, +r.dataset.r); return; }
    const i = Math.min(+r.dataset.r, Z.rows.length - 1);
    // v0.012: щелчок по НОМЕРУ — выделение строк: просто — только эта, Ctrl — добавить/убрать, Shift — диапазон.
    if (e.target.closest(".no")) {
      if (e.shiftKey && rowSelAnchor >= 0) {
        if (!(e.ctrlKey || e.metaKey)) rowSel.clear();
        for (let k = Math.min(rowSelAnchor, i); k <= Math.max(rowSelAnchor, i); k++) rowSel.add(k);
      } else if (e.ctrlKey || e.metaKey) {
        if (rowSel.has(i)) rowSel.delete(i); else rowSel.add(i);
        rowSelAnchor = i;
      } else {
        rowSel.clear(); rowSel.add(i); rowSelAnchor = i;
      }
      clearTextSel();
      Z.cur = i; renderAll(); save();
      return;
    }
    // По битам: если мышью выделены символы — не перерисовываем (иначе выделение пропадёт).
    if (textSelInRows()) return;
    if (rowSel.size) { rowSel.clear(); rowSelAnchor = -1; }
    if (Z.cur === i) { renderRows(); return; }
    Z.cur = i; renderAll(); save();
  };
  // v0.010: двойной щелчок — правка строки на месте.
  $("rowList").ondblclick = (e) => {
    if (rowEditing >= 0) return;
    const r = e.target.closest(".rw"); if (!r || r.classList.contains("lhrow")) return;
    e.preventDefault();
    const sel = window.getSelection && window.getSelection(); if (sel) sel.removeAllRanges();
    if (Z.laneCount > 1 && Z.laneView === "over") {   // v0.018
      say("Править строку на месте — в виде «колонками». Здесь — поле ввода сверху: Shift+Enter заменит текущую строку рабочего поля.");
      return;
    }
    const cell = e.target.closest(".bits");
    if (cell && +cell.dataset.l !== Z.lane) switchLane(+cell.dataset.l, +r.dataset.r, true);
    if (+r.dataset.r < Z.rows.length) editRowInPlace(+r.dataset.r);
  };
  // v0.018: поля колонками / наложением; оси тащатся за ручки
  $("laneView").value = Z.laneView || "cols";
  $("laneView").onchange = (e) => {
    Z.laneView = e.target.value;
    // v0.019: наложение при одном поле смысла не имеет — полей сразу становится 2.
    if (Z.laneView === "over" && Z.laneCount < 2) { Z.laneCount = 2; $("laneCount").value = "2"; }
    renderRows(); save();
    if (Z.laneView === "over") say("Наложение: у каждого поля своя ось — тащи ручки-номера над строками; совпавшие биты сводятся (" + $("ovOp").selectedOptions[0].textContent + ").");
  };
  $("ovOp").value = Z.ovOp || "xor";
  $("ovOp").onchange = (e) => { Z.ovOp = e.target.value; renderRows(); save(); };
  $("bOvReset").onclick = () => { Z.axisPos = []; renderRows(); save(); say("↔ Оси разведены: поля рядом, не накладываясь."); };
  $("bOvOut").onclick = () => {
    const res = ovResult();
    if (!res.length) { say("⤓ Наложение пустое."); return; }
    snapshot();
    const op = $("ovOp").selectedOptions[0].textContent;
    if (Z.laneCount < 4) {
      const k = Z.laneCount;
      Z.laneCount++; Z.lanes[k] = res; Z.axisPos[k] = undefined;
      $("laneCount").value = String(Z.laneCount);
      switchLane(k, 0, true);
      say(`⤓ Итог наложения (${op}) — ${res.length} строк в поле ${k + 1}, оно теперь рабочее. ↩ вернёт.`);
    } else {
      Z.rows = res; syncLane(); Z.cur = 0;
      renderAll(); save();
      say(`⤓ Все 4 поля заняты — итог наложения (${op}) записан в рабочее поле ${Z.lane + 1}. ↩ вернёт.`);
    }
  };
  $("rowList").addEventListener("pointerdown", (e) => {
    const hd = e.target.closest(".axh"); if (!hd || e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    const l = +hd.dataset.ax, trk = hd.closest(".trk"), list = $("rowList");
    const probe = document.createElement("span");
    probe.textContent = "0000000000"; probe.style.cssText = "position:absolute;visibility:hidden;font-family:var(--ff);font-size:var(--fs)";
    trk.appendChild(probe);
    const half = probe.getBoundingClientRect().width / 20;
    probe.remove();
    if (!(half > 0)) return;
    const A0 = ovAxes()[l], x0 = e.clientX;
    let raf = 0, moved = false;
    list.setPointerCapture(e.pointerId);
    const move = (ev) => {
      const a = Math.max(ovMinA(laneMaxLen(l)), A0 + Math.round((ev.clientX - x0) / half));
      if (a === Z.axisPos[l]) return;
      Z.axisPos[l] = a; moved = true;
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; renderRows(); });
    };
    const up = () => {
      list.removeEventListener("pointermove", move); list.removeEventListener("pointerup", up);
      // v0.022: щелчок без сдвига — выделить ось (и сделать её поле рабочим); перетаскивание выделение снимает.
      if (!moved) {
        axSel = axSel === l ? -1 : l;
        if (axSel >= 0 && l !== Z.lane) switchLane(l, undefined, true); else renderRows();
        say(axSel >= 0 ? `Ось ${l + 1} выделена — Del удалит её вместе с полем ${l + 1} (↩ вернёт). Esc или щелчок по полю — снять.` : `Выделение оси ${l + 1} снято.`);
      } else { axSel = -1; renderRows(); }
      save();
    };
    list.addEventListener("pointermove", move);
    list.addEventListener("pointerup", up);
  });
  // v0.015: число полей строк
  $("laneCount").value = String(Z.laneCount);
  $("laneCount").onchange = (e) => {
    Z.laneCount = Math.max(1, Math.min(4, +e.target.value || 1));
    if (Z.lane >= Z.laneCount) switchLane(0, undefined, true); else { renderAll(); save(); }
    say(Z.laneCount > 1 ? `Полей строк — ${Z.laneCount}, у каждого своя ось. Рабочее — поле ${Z.lane + 1}; сменить — щелчок по полю или ← / →.` : "Одно поле строк. Остальные поля не стёрты — вернутся, если полей снова станет больше.");
  };
  // v0.036: переключатели чисел у номеров и красных неподвижных бит
  const fmLabel = () => { $("bShowFM").classList.toggle("on", !!Z.showFM); $("bShow01").classList.toggle("on", !!Z.show01); $("bShowFix").classList.toggle("on", !!Z.showFix); };
  fmLabel();
  $("bShowFM").onclick = () => { Z.showFM = !Z.showFM; fmLabel(); renderRows(); save(); };
  $("bShow01").onclick = () => { Z.show01 = !Z.show01; fmLabel(); renderRows(); save(); };
  $("bShowFix").onclick = () => { Z.showFix = !Z.showFix; fmLabel(); renderRows(); save(); };
  $("rowsAlign").value = Z.rowsAlign || "center";
  $("rowsAlign").onchange = (e) => { Z.rowsAlign = e.target.value; renderRows(); save(); };
  // 🧊 Вид (v0.024): кнопки, перетаскивание мышью, перерисовка при смене размера окна
  $("viewBtns").onclick = (e) => {
    const b = e.target.closest("button[data-v]"); if (!b) return;
    const v = VIEWS[b.dataset.v]; Z.viewYaw = v[0]; Z.viewPitch = v[1]; Z.viewM = viewMYP(v[0], v[1]);   // v0.029
    if (Z.viewMode === "all") Z.viewAng = {};   // v0.025: в «все строки» — всем карточкам сразу
    renderView(); save();
  };
  $("viewCv").addEventListener("pointerdown", (e) => {
    if (e.button !== 0 && e.button !== 2) return;
    // v0.028: Shift или правая кнопка — сдвинуть картинку; v0.029: и Ctrl — «просто передвижение, без кручения».
    const moveMode = e.ctrlKey || e.metaKey;
    const panMode = e.shiftKey || e.button === 2 || moveMode;
    const cv = $("viewCv"); cv.setPointerCapture(e.pointerId); cv.style.cursor = panMode ? "move" : "grabbing";
    cv.focus({ preventScroll: true });   // v0.029: чтобы стрелки клавиатуры крутили картинку
    const x0 = e.clientX, y0 = e.clientY, a0 = Z.viewYaw, b0 = Z.viewPitch;
    const p0 = Array.isArray(Z.viewPan) ? Z.viewPan.slice() : [0, 0];
    // v0.029: в «все вместе» — нажал на лесенку: схватил эту строку, крутится только она.
    let grab = -1;
    // v0.032: схватил кольцо гизмо — крутится только вокруг его оси, остальные стоят.
    let ringAx = null;
    if (!panMode && Z.viewGuides !== false) {
      const r = cv.getBoundingClientRect();
      ringAx = viewRingAt(cv, e.clientX - r.left, e.clientY - r.top);
      if (ringAx) { cv._dragRing = ringAx; viewLockAx = ringAx; renderView(); }   // v0.033: ось закреплена
    }
    // v0.031: схватить строку — только с галкой «крутить по отдельности»; без неё щелчок по лесенке выбирает строку.
    let picked = -1;
    if ((!panMode || moveMode) && !ringAx && Z.viewMode === "stack") {
      const r = cv.getBoundingClientRect();
      picked = viewPick(cv, e.clientX - r.left, e.clientY - r.top);
      if (Z.viewSolo) {
        grab = picked;
        if (grab >= 0) { viewSel = grab; if (Z.cur !== grab && grab < Z.rows.length) { Z.cur = grab; renderAll(); } else renderView(); }
      }
    }
    const l0 = grab >= 0 ? ((Z.viewLocal || {})[grab] || [0, 0]).slice() : null;
    const o0 = grab >= 0 ? ((Z.viewOff || {})[grab] || [0, 0, 0]).slice() : null;
    const M0 = viewCamM().slice();
    let raf = 0, moved = false;
    const move = (ev) => {
      if (Math.abs(ev.clientX - x0) + Math.abs(ev.clientY - y0) > 2) moved = true;
      if (ringAx) {
        // Угол поворота — как обходишь центр кольца на экране; ось смотрит к зрителю — по часовой стрелке наоборот.
        const r = cv.getBoundingClientRect(), c = cv._center || [r.width / 2, r.height / 2];
        const f0 = Math.atan2(-(y0 - r.top - c[1]), x0 - r.left - c[0]), f1 = Math.atan2(-(ev.clientY - r.top - c[1]), ev.clientX - r.left - c[0]);
        let df = (f1 - f0) * 180 / Math.PI; if (df > 180) df -= 360; if (df < -180) df += 360;
        const v = ringAx === "x" ? [1, 0, 0] : ringAx === "y" ? [0, 1, 0] : [0, 0, 1];
        const depth = M0[6] * v[0] + M0[7] * v[1] + M0[8] * v[2];
        let th;
        if (Math.abs(depth) > 0.25) th = df * Math.sign(depth);
        else {   // кольцо стоит ребром — крутим движением поперёк его оси
          const sx = M0[0] * v[0] + M0[1] * v[1] + M0[2] * v[2], sy = M0[3] * v[0] + M0[4] * v[1] + M0[5] * v[2], n = Math.hypot(sx, sy) || 1;
          th = ((ev.clientX - x0) * (-sy / n) + (-(ev.clientY - y0)) * (sx / n)) * 0.5;
        }
        Z.viewM = mMul(M0, mRotW(ringAx, th));
      }
      else if (moveMode && grab >= 0) {
        // v0.029: Ctrl на схваченной строке — двигать её: пиксели экрана → мир (обратная матрица = транспонированная).
        const k = cv._scale || 1, Mc = cv._M || M0, sx = (ev.clientX - x0) / k, sy = -(ev.clientY - y0) / k;
        if (!Z.viewOff) Z.viewOff = {};
        Z.viewOff[grab] = [o0[0] + Mc[0] * sx + Mc[3] * sy, o0[1] + Mc[1] * sx + Mc[4] * sy, o0[2] + Mc[2] * sx + Mc[5] * sy];
      }
      else if (panMode) Z.viewPan = [p0[0] + ev.clientX - x0, p0[1] + ev.clientY - y0];
      else if (grab >= 0) {
        if (!Z.viewLocal) Z.viewLocal = {};
        Z.viewLocal[grab] = [l0[0] - (ev.clientX - x0) * 0.5, viewClampP(l0[1] + (ev.clientY - y0) * 0.5)];
      } else {
        // v0.029: крутится от текущего вида — вокруг осей экрана.
        Z.viewM = mMul(mRxS((ev.clientY - y0) * 0.5), mMul(mRyS(-(ev.clientX - x0) * 0.5), M0));
        if (viewLockAx && moved) viewLockAx = null;   // v0.033: свободный поворот снимает закреплённую ось
      }
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; renderView(); });
    };
    const up = () => {
      cv.removeEventListener("pointermove", move); cv.removeEventListener("pointerup", up); cv.style.cursor = "grab";
      if (ringAx) { cv._dragRing = null; renderView(); save(); return; }   // v0.032
      if (!moved && !panMode && grab < 0 && viewSel >= 0) { viewSel = -1; renderView(); }   // щелчок по пустому — отпустить
      if (!moved && !Z.viewSolo && picked >= 0 && picked < Z.rows.length && picked !== Z.cur) { Z.cur = picked; renderAll(); }   // v0.031: щелчок — выбрать строку
      save();
    };
    cv.addEventListener("pointermove", move); cv.addEventListener("pointerup", up);
  });
  if (window.ResizeObserver) { const ro = new ResizeObserver(() => renderView()); ro.observe($("viewCv")); ro.observe($("viewGrid")); }
  // v0.028: колесо — масштаб к точке под курсором; двойной щелчок — масштаб и место как было; правая кнопка — сдвиг.
  let zt = 0;
  $("viewCv").addEventListener("wheel", (e) => {
    e.preventDefault();
    const cv = $("viewCv"), r = cv.getBoundingClientRect();
    const z0 = Z.viewZoom || 1, z1 = Math.max(0.2, Math.min(60, z0 * Math.exp(-e.deltaY * 0.0015)));
    const f = z1 / z0, p = Array.isArray(Z.viewPan) ? Z.viewPan : [0, 0];
    const mx = e.clientX - r.left - r.width / 2, my = e.clientY - r.top - r.height / 2;
    Z.viewPan = [mx - (mx - p[0]) * f, my - (my - p[1]) * f];
    Z.viewZoom = z1;
    renderView();
    clearTimeout(zt); zt = setTimeout(save, 300);
  }, { passive: false });
  $("viewCv").addEventListener("dblclick", () => { Z.viewZoom = 1; Z.viewPan = [0, 0]; renderView(); save(); });
  // v0.032: кольцо гизмо под мышью подсвечивается, курсор показывает, что за него можно крутить.
  $("viewCv").addEventListener("pointermove", (e) => {
    if (e.buttons) return;
    const cv = $("viewCv"), r = cv.getBoundingClientRect();
    const h = Z.viewGuides !== false ? viewRingAt(cv, e.clientX - r.left, e.clientY - r.top) : null;
    if (h !== (cv._hotRing || null)) { cv._hotRing = h; cv.style.cursor = h ? "alias" : "grab"; renderView(); }
  });
  $("viewCv").addEventListener("pointerleave", () => { const cv = $("viewCv"); if (cv._hotRing) { cv._hotRing = null; cv.style.cursor = "grab"; renderView(); } });
  // v0.029: стрелки — кнопками в углу картинки и клавишами, когда картинка в фокусе.
  // v0.033, «кнопка-крест: нажал и тянешь — двигается, как с Ctrl, сама стоит на месте».
  $("viewArrows").addEventListener("pointerdown", (e) => {
    const b = e.target.closest('button[data-t="pan"]'); if (!b || e.button !== 0) return;
    e.preventDefault();
    b.setPointerCapture(e.pointerId);
    const cv = $("viewCv"), x0 = e.clientX, y0 = e.clientY;
    const row = Z.viewMode === "stack" && Z.viewSolo && viewSel >= 0 ? viewSel : -1;
    const p0 = Array.isArray(Z.viewPan) ? Z.viewPan.slice() : [0, 0];
    const o0 = row >= 0 ? ((Z.viewOff || {})[row] || [0, 0, 0]).slice() : null;
    let raf = 0;
    const move = (ev) => {
      if (row >= 0) {
        const k = cv._scale || 1, Mc = cv._M || viewCamM(), sx = (ev.clientX - x0) / k, sy = -(ev.clientY - y0) / k;
        if (!Z.viewOff) Z.viewOff = {};
        Z.viewOff[row] = [o0[0] + Mc[0] * sx + Mc[3] * sy, o0[1] + Mc[1] * sx + Mc[4] * sy, o0[2] + Mc[2] * sx + Mc[5] * sy];
      } else Z.viewPan = [p0[0] + ev.clientX - x0, p0[1] + ev.clientY - y0];
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; renderView(); });
    };
    const up = () => { b.removeEventListener("pointermove", move); b.removeEventListener("pointerup", up); save(); };
    b.addEventListener("pointermove", move); b.addEventListener("pointerup", up);
  });
  $("viewArrows").onclick = (e) => {
    const b = e.target.closest("button[data-t]"); if (!b || b.dataset.t === "pan") return;
    if (b.dataset.t === "reset") {
      if (Z.viewMode === "stack" && viewSel >= 0) { if (Z.viewLocal) delete Z.viewLocal[viewSel]; if (Z.viewOff) delete Z.viewOff[viewSel]; }
      else if (Z.viewMode === "all") { if (Z.viewAng) delete Z.viewAng[Z.cur]; }
      else { Z.viewZoom = 1; Z.viewPan = [0, 0]; }
      renderView(); save(); return;
    }
    const [dy, dp] = b.dataset.t.split(",").map(Number);
    viewTurn(dy, dp);
  };
  $("viewCv").addEventListener("keydown", (e) => {
    const k = { ArrowLeft: [-15, 0], ArrowRight: [15, 0], ArrowUp: [0, 15], ArrowDown: [0, -15] }[e.key];
    if (k) { e.preventDefault(); e.stopPropagation(); viewTurn(k[0], k[1]); return; }
    if (e.key === "Escape" && (viewSel >= 0 || viewLockAx)) { e.preventDefault(); e.stopPropagation(); viewSel = -1; viewLockAx = null; renderView(); }
  });
  $("viewCv").addEventListener("contextmenu", (e) => e.preventDefault());
  $("viewGrid").addEventListener("wheel", (e) => {
    const card = e.target.closest(".vcard"); if (!card) return;
    e.preventDefault();
    const i = +card.dataset.r;
    if (!Z.viewZoomRow) Z.viewZoomRow = {};
    Z.viewZoomRow[i] = Math.max(0.2, Math.min(60, (Z.viewZoomRow[i] || 1) * Math.exp(-e.deltaY * 0.0015)));
    const [ya, pi] = viewAng(i);
    drawStair(card.querySelector("canvas"), Z.rows[i], ya, pi, true, "", { zoom: Z.viewZoomRow[i] });
    clearTimeout(zt); zt = setTimeout(save, 300);
  }, { passive: false });
  // v0.025: одна строка / все строки; карточки крутятся каждая своя, щелчок без поворота — текущая строка
  $("viewMode").value = Z.viewMode || "one";
  $("viewShape").value = Z.viewShape || "stair";   // v0.027
  $("viewGuides").checked = Z.viewGuides !== false;   // v0.029
  $("viewGuides").onchange = (e) => { Z.viewGuides = e.target.checked; renderView(); save(); };
  // v0.031: галка «крутить по отдельности» и сброс накрученных строк
  $("viewSolo").checked = !!Z.viewSolo;
  $("viewSolo").onchange = (e) => { Z.viewSolo = e.target.checked; if (!Z.viewSolo) viewSel = -1; renderView(); save(); };
  $("bViewReset").onclick = () => {
    const n = Object.keys(Z.viewLocal || {}).length + Object.keys(Z.viewOff || {}).length + Object.keys(Z.viewAng || {}).length;
    Z.viewLocal = {}; Z.viewOff = {}; Z.viewAng = {}; Z.viewZoomRow = {}; viewSel = -1;
    Z.viewZoom = 1; Z.viewPan = [0, 0];
    renderView(); save();
    say(n ? "⟲ Все строки на месте: отдельные повороты и сдвиги сброшены, масштаб — как был." : "⟲ Отдельно накрученных строк не было; масштаб и сдвиг сброшены.");
  };
  $("viewShape").onchange = (e) => { Z.viewShape = e.target.value; renderView(); save(); };
  $("viewMode").onchange = (e) => { Z.viewMode = e.target.value; viewCardsN = -1; renderView(); save(); };
  $("viewGrid").addEventListener("pointerdown", (e) => {
    const card = e.target.closest(".vcard"); if (!card || e.button !== 0) return;
    const i = +card.dataset.r, cv = card.querySelector("canvas");
    cv.setPointerCapture(e.pointerId); cv.style.cursor = "grabbing";
    const x0 = e.clientX, y0 = e.clientY, [a0, b0] = viewAng(i);
    let raf = 0, moved = false;
    const move = (ev) => {
      if (Math.abs(ev.clientX - x0) + Math.abs(ev.clientY - y0) < 3 && !moved) return;
      moved = true;
      if (!Z.viewAng) Z.viewAng = {};
      Z.viewAng[i] = [a0 - (ev.clientX - x0) * 0.5, Math.max(-90, Math.min(90, b0 + (ev.clientY - y0) * 0.5))];
      if (!raf) raf = requestAnimationFrame(() => {
        raf = 0; const [ya, pi] = Z.viewAng[i];
        drawStair(cv, Z.rows[i], ya, pi, true, "", { zoom: (Z.viewZoomRow || {})[i] || 1 });
        if (i === Z.cur) $("viewOut").innerHTML = `Текущая строка ${Z.cur}: ` + viewReading(Z.rows[i], ya, pi);
      });
    };
    const up = () => {
      cv.removeEventListener("pointermove", move); cv.removeEventListener("pointerup", up); cv.style.cursor = "grab";
      if (!moved && i < Z.rows.length) { Z.cur = i; renderAll(); }
      save();
    };
    cv.addEventListener("pointermove", move); cv.addEventListener("pointerup", up);
  });
  // 🔍 Проверка треугольника (v0.014)
  $("bChk").onclick = () => {
    const idx = rowSel.size ? Array.from(rowSel).sort((a, b) => a - b) : Z.rows.map((_, i) => i);
    chk = { idx };
    renderCheck();
    say(`🔍 Треугольник — ${idx.length} строк (${rowSel.size ? "выделенные" : "все"}); окно следит за ними и пересчитывается само.`);
  };
  $("chkMode").onchange = () => renderCheck();
  $("chkView").onclick = (e) => {
    const s = e.target.closest("span[data-k]"); if (!s || !chk) return;
    const k = +s.dataset.k, i = +s.dataset.i, r = chk.idx[k], row = Z.rows[r];
    if (row === undefined) return;
    const keep = new Set(rowSel);
    snapshot();
    Z.rows[r] = row.slice(0, i) + (row[i] === "1" ? "0" : "1") + row.slice(i + 1);
    keep.forEach(x => rowSel.add(x));
    renderAll(); save();
    say(`🔍 Строка ${r}, бит ${i} перевёрнут. ↩ вернёт.`);
  };
  $("bChkFix").onclick = () => {
    if (!chk) { say("🔍 Сначала «🔍 Проверить»."); return; }
    const rows = chkRows();
    const T = zzTriChecks(rows, $("chkMode").value);
    if (T.err) { say("🔍 " + T.err + "."); return; }
    const res = zzTriBitFlip(rows, T.checks, 500);
    if (!res.flips.length) { say(zzTriBroken(rows, T.checks).some(Boolean) ? "🩹 Ни один переворот не уменьшает число сломанных проверок — исправить так нельзя." : "🩹 Треугольник и так цел."); return; }
    const keep = new Set(rowSel);
    snapshot();
    chk.idx.forEach((ri, k) => { Z.rows[ri] = res.rows[k]; });
    keep.forEach(x => rowSel.add(x));
    renderAll(); save();
    const where = res.flips.slice(0, 8).map(([k, i]) => `${chk.idx[k]}:${i}`).join(", ") + (res.flips.length > 8 ? " …" : "");
    say(`🩹 Перевёрнуто бит — ${res.flips.length} (строка:бит — ${where}). ` + (res.left ? `Сломанных проверок осталось ${res.left}: ошибок больше, чем треугольник вытягивает.` : "Все проверки сошлись.") + " ↩ вернёт.");
  };
  // 📡 Сигнал по базе (v0.013)
  $("sigMsg").value = Z.sigMsg; $("sigBase").value = Z.sigBase; $("sigDev").value = Z.sigDev;
  $("sigShape").value = Z.sigShape; $("sigLen").value = Z.sigLen; $("sigNoise").value = Z.sigNoise;
  const sigKeep = () => {
    Z.sigMsg = ($("sigMsg").value || "").replace(/[^01]/g, ""); Z.sigBase = ($("sigBase").value || "").replace(/[^01]/g, "") || "10";
    Z.sigDev = $("sigDev").value; Z.sigShape = $("sigShape").value; Z.sigLen = Math.max(1, Math.floor(+$("sigLen").value || 8));
    Z.sigNoise = Math.max(0, Math.min(100, +$("sigNoise").value || 0)); save();
  };
  ["sigMsg", "sigBase", "sigDev", "sigShape", "sigLen", "sigNoise"].forEach(id => $(id).addEventListener("change", sigKeep));
  ["sigMsg", "sigBase"].forEach(id => $(id).addEventListener("keydown", (e) => e.stopPropagation()));
  $("bSigTake").onclick = () => { $("sigMsg").value = cur(); sigKeep(); say(`📡 Сообщение — текущая строка, ${cur().length} бит.`); };
  $("bSigSend").onclick = () => { sigKeep(); sigSend(); };
  $("bSigRead").onclick = () => { sigKeep(); sigRead(); };
  // △ Треугольник по маске (v0.011)
  $("maskIn").value = Z.maskStr; $("maskN").value = Z.maskN; $("maskMode").value = Z.maskMode;
  $("maskIn").addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") { e.preventDefault(); $("bMaskTri").click(); } });
  $("maskIn").onchange = (e) => { const v = e.target.value.replace(/[^01]/g, ""); if (v) Z.maskStr = v; e.target.value = Z.maskStr; save(); };
  $("maskN").onchange = (e) => { Z.maskN = Math.max(1, Math.min(512, Math.floor(+e.target.value || 16))); e.target.value = Z.maskN; save(); };
  $("maskMode").onchange = (e) => { Z.maskMode = e.target.value; save(); };
  $("bMaskTri").onclick = () => {
    const m = $("maskIn").value.replace(/[^01]/g, "");
    if (!m) { say("△ Впиши маску из 0 и 1 — например 10 или 110."); return; }
    Z.maskStr = m; $("maskIn").value = m;
    const n = Math.max(1, Math.min(512, Math.floor(+$("maskN").value || 16)));
    Z.maskN = n; $("maskN").value = n;
    const rows = zzMaskTriangle(m, n, Z.maskMode);
    snapshot();
    Z.rows.splice(Z.cur + 1, 0, ...rows);
    Z.cur += 1;   // текущей становится вершина — от неё и смотреть
    renderAll(); save();
    const modeTxt = { pascal: "🔺 Паскаль от строки", descent: "▽ спуск от строки", start: "маской, каждая с начала", tape: "маской, сплошной лентой" }[Z.maskMode] || "";
    const bits = rows.reduce((a, r) => a + r.length, 0);
    say(`△ ${modeTxt} ${m.length > 24 ? m.slice(0, 24) + "…" : m}: ${rows.length} строк, всего ${bits} бит — под бывшей текущей.` +
        (Z.maskMode === "descent" && rows.length < n ? ` Спуск кончается на одном бите — строк не больше длины строки (${m.length}).` : "") + " ↩ вернёт.");
  };
  // Шаблоны
  $("tplList").onclick = (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.b !== undefined) { const t = TPL_BUILTIN[+b.dataset.b]; tplInsert(t.rows(), t.name); }
    else if (b.dataset.u !== undefined) { const t = Z.tpl[+b.dataset.u]; if (t) tplInsert(t.rows.slice(), t.name); }
    else if (b.dataset.r !== undefined) {   // v0.037: ⚑ — эталон для сравнения
      const k = +b.dataset.r; Z.tplRef = Z.tplRef === k ? -1 : k;
      renderTpl(); renderRows(); save();
      say(Z.tplRef >= 0 ? `⚑ Эталон — «${Z.tpl[k].name}»: номера строк, которые от него отличаются, — золотом.` : "⚑ Сравнение с эталоном выключено.");
    }
    else if (b.dataset.x !== undefined) {
      const x = +b.dataset.x, t = Z.tpl.splice(x, 1)[0];
      if (typeof Z.tplRef === "number") { if (Z.tplRef === x) Z.tplRef = -1; else if (Z.tplRef > x) Z.tplRef--; }   // v0.037
      renderTpl(); renderRows(); save(); if (t) say(`Шаблон «${t.name}» удалён.`);
    }
  };
  $("tplList").ondblclick = (e) => {
    const b = e.target.closest("button[data-u]"); if (!b) return;
    const t = Z.tpl[+b.dataset.u]; if (!t) return;
    const n = window.prompt("Имя шаблона", t.name);
    if (n && n.trim()) { t.name = n.trim().slice(0, 60); renderTpl(); save(); }
  };
  $("bTplRow").onclick = () => { const rows = [cur()]; Z.tpl.push({ name: tplName(rows), rows }); renderTpl(); save(); say(`Строка ${Z.cur} (${cur().length} бит) сохранена шаблоном. Щелчок по нему — вставить под текущей.`); };
  $("bTplAll").onclick = () => { const rows = Z.rows.slice(); Z.tpl.push({ name: tplName(rows), rows }); Z.tplRef = Z.tpl.length - 1; renderTpl(); renderRows(); save(); say(`Столбик (${rows.length} стр.) сохранён шаблоном.`); };   // v0.037: сохранённый столбик — новый эталон; v0.038: комментарий съедал конец строки — страница не запускалась
  // Разделитель поля и окон: ширина поля в пикселях, двойной щелчок — по умолчанию.
  const applyRowsW = () => { if (Z.rowsW > 0) $("main").style.setProperty("--rowsW", Z.rowsW + "px"); else $("main").style.removeProperty("--rowsW"); };
  applyRowsW();
  $("split").addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const sp = $("split"), start = e.clientX, w0 = $("field").getBoundingClientRect().width;
    sp.classList.add("drag"); sp.setPointerCapture(e.pointerId);
    const move = (ev) => { Z.rowsW = Math.max(220, Math.min(window.innerWidth - 520, Math.round(w0 + ev.clientX - start))); applyRowsW(); };
    const up = () => { sp.classList.remove("drag"); sp.removeEventListener("pointermove", move); sp.removeEventListener("pointerup", up); packWins(); save(); renderPointers(); };
    sp.addEventListener("pointermove", move); sp.addEventListener("pointerup", up);
  });
  $("split").ondblclick = () => { Z.rowsW = 0; applyRowsW(); save(); };
  $("rowInput").addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const v = e.target.value.replace(/[^01]/g, "");
    if (!v) { say("Впиши строку из 0 и 1."); return; }
    if (e.shiftKey) { snapshot(); Z.rows[Z.cur] = v; renderAll(); save(); say(`Строка ${Z.cur} заменена.`); }
    else insertBelow(v, `Добавлена строка ${Z.cur + 1}.`);
    e.target.value = "";
  });
  // Файл: кнопка, перетаскивание на страницу, вставка нескольких строк в поле
  $("bLoad").onclick = () => $("fileIn").click();
  $("fileIn").onchange = (e) => { readFile(e.target.files[0]); e.target.value = ""; };
  $("bSaveTxt").onclick = saveRowsTxt;
  document.addEventListener("dragover", (e) => { if (e.dataTransfer && Array.from(e.dataTransfer.types || []).includes("Files")) { e.preventDefault(); document.body.classList.add("dragover"); } });
  document.addEventListener("dragleave", (e) => { if (!e.relatedTarget) document.body.classList.remove("dragover"); });
  document.addEventListener("drop", (e) => {
    document.body.classList.remove("dragover");
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (!f) return;
    e.preventDefault(); readFile(f);
  });
  // v0.012: Ctrl+C — только биты: выделенные символы (строка на строку), иначе выделенные строки,
  // иначе текущая строка. Выделение текста вне поля строк (в окнах) копируется как обычно.
  document.addEventListener("copy", (e) => {
    const t = e.target;
    if (t && t.closest && t.closest("input, textarea")) return;
    const parts = textSelInRows();
    const sel = window.getSelection && window.getSelection();
    let txt = null, what = "";
    if (parts) { txt = parts.map(p => Z.rows[p.i].slice(p.a, p.b)).join("\r\n"); what = `бит — ${parts.reduce((a, p) => a + p.b - p.a, 0)}`; }
    else if (sel && !sel.isCollapsed) return;
    else if (rowSel.size) { const l = Array.from(rowSel).sort((a, b) => a - b); txt = l.map(k => Z.rows[k]).join("\r\n"); what = `строк — ${l.length}`; }
    else { txt = cur(); what = `текущая строка, ${txt.length} бит`; }
    e.preventDefault();
    e.clipboardData.setData("text/plain", txt);
    say(`Ctrl+C: скопировано ${what}.`);
  });
  // v0.012: Ctrl+V — строки из буфера под текущей; если выделены символы в ОДНОЙ строке и в буфере
  // одна строка — заменяет выделенное. Поля ввода вставляют как обычно.
  document.addEventListener("paste", (e) => {
    const t = e.target;
    if (t && t.closest && t.closest("input, textarea, select")) return;
    const text = (e.clipboardData || window.clipboardData).getData("text");
    const rows = parseRows(text);
    e.preventDefault();
    if (!rows.length) { say("Ctrl+V: в буфере нет строк из 0 и 1."); return; }
    const parts = textSelInRows();
    if (parts && parts.length === 1 && rows.length === 1) {
      const p = parts[0], s = Z.rows[p.i];
      snapshot();
      Z.rows[p.i] = s.slice(0, p.a) + rows[0] + s.slice(p.b);
      Z.cur = p.i;
      clearTextSel(); renderAll(); save();
      say(`Ctrl+V: в строке ${p.i} ${p.b - p.a} бит заменены на ${rows[0].length}. ↩ вернёт.`);
      return;
    }
    snapshot();
    Z.rows.splice(Z.cur + 1, 0, ...rows);
    Z.cur += rows.length;
    clearTextSel(); renderAll(); save();
    say(`Ctrl+V: вставлено строк — ${rows.length}, под текущей. ↩ вернёт.`);
  });
  $("rowInput").addEventListener("paste", (e) => {
    const t = (e.clipboardData || window.clipboardData).getData("text");
    if (!/\n/.test(t)) return;                 // одна строка — обычная вставка в поле
    e.preventDefault();
    const rows = parseRows(t);
    if (!rows.length) { say("Во вставке нет строк из 0 и 1."); return; }
    snapshot();
    Z.rows.splice(Z.cur + 1, 0, ...rows);
    Z.cur += rows.length;
    renderAll(); save();
    say(`Вставлено строк — ${rows.length}, под текущей.`);
  });
  $("bSierpNext").onclick = () => insertBelow(zzPascalNext(cur()), "🔺+1: под каждой парой — XOR, по краям нули; строка выросла на бит.");
  $("bNumNext").onclick = () => insertBelow(zzBinInc(cur()), "🔢+1: следующий номер.");
  $("bRandom").onclick = () => insertBelow(randomBits(cur().length || 16), "🎲 Случайная строка той же длины.");
  $("bSeed").onclick = () => insertBelow("1", "● Зерно «1» — дальше 🔺+1 даст Серпинского.");
  $("bVMirror").onclick = () => { snapshot(); Z.rows.reverse(); Z.cur = Z.rows.length - 1 - Z.cur; renderAll(); save(); say("⇅ Столбик перевёрнут: первая ↔ последняя. Ещё раз — вернёт."); };
  // v0.004: ⇅ через текущую строку — она на месте, соседи парами (cur−k ↔ cur+k).
  $("bVMirrorCur").onclick = () => {
    const c = Z.cur, n = Z.rows.length;
    const k = Math.min(c, n - 1 - c);
    if (!k) { say("⇅ Вокруг текущей: с одной из сторон строк нет — меняться нечему."); return; }
    snapshot();
    for (let d = 1; d <= k; d++) { const a = c - d, b = c + d; const t = Z.rows[a]; Z.rows[a] = Z.rows[b]; Z.rows[b] = t; }
    renderAll(); save();
    say(`⇅ Вокруг строки ${c}: переставлено пар — ${k}` + (n - 1 - 2 * k > 0 ? `, ещё ${n - 1 - 2 * k} строк без пары остались на месте` : "") + ". Ещё раз — вернёт.");
  };
  $("bOrbit").onclick = runOrbit;
  $("orbitOut").onclick = (e) => { const h = e.target.closest(".hit"); if (!h) return; Z.cur = +h.dataset.r; renderAll(); save(); };
  $("bDelRow").onclick = () => {
    if (Z.rows.length <= 1) { say("Последнюю строку не удаляю — впиши другую через Shift+Enter."); return; }
    snapshot(); Z.rows.splice(Z.cur, 1); Z.cur = Math.min(Z.cur, Z.rows.length - 1); renderAll(); save();
  };
  $("bClear").onclick = () => { snapshot(); Z.rows = ["1"]; Z.cur = 0; renderAll(); save(); say("🧹 Столбик очищен (↩ Ctrl+Z вернёт)."); };

  // Зеркало
  $("bFixShow").onclick = () => { Z.fixShow = !Z.fixShow; renderAll(); save(); };
  const replaceCur = (s, what) => { snapshot(); Z.rows[Z.cur] = s; renderAll(); save(); say(what); };
  $("bGoRev").onclick = () => replaceCur(zzRev(cur()), "⇄ Шаг в зеркало: строка развёрнута.");
  $("bGoInv").onclick = () => replaceCur(zzInv(cur()), "🔁 Строка инвертирована.");
  $("bGoInvRev").onclick = () => replaceCur(zzInvRev(cur()), "⇄🔁 Строка инв-развёрнута.");
  $("bFlipMoving").onclick = () => {
    const s = cur(), f = zzFlipMoving(s);
    let k = 0; for (let i = 0; i < s.length; i++) if (s[i] !== f[i]) k++;
    replaceCur(f, `🔁 Инв меняющихся: перевёрнуто бит — ${k}. Неподвижные на месте. Результат совпадает с разворотом — ${f === zzRev(s) ? "как и должно" : "⚠ не совпал, сообщи"}.`);
  };
  $("ptrMin").onchange = (e) => { Z.ptrMin = Math.max(2, Math.min(64, +e.target.value || 4)); renderPointers(); save(); };
  $("ptrPal").onchange = (e) => { Z.ptrPal = e.target.checked; renderPointers(); save(); };
  $("ptrAnti").onchange = (e) => { Z.ptrAnti = e.target.checked; renderPointers(); save(); };

  // Спуск
  $("descentAlign").onchange = (e) => { Z.descentAlign = e.target.value; renderDescent(); save(); };
  // Цикл
  $("cycOp").onchange = (e) => { Z.cycOp = e.target.value; save(); };
  $("cycHeat").onchange = (e) => { Z.cycHeat = e.target.checked; save(); if ($("cycView").innerHTML) runCycle(); };
  $("bCycle").onclick = runCycle;
  // GF(2)
  $("gf2Op").onchange = (e) => { Z.gf2Op = e.target.value; save(); };
  $("gf2T").onchange = (e) => { Z.gf2T = Math.max(1, Math.floor(+e.target.value || 1)); save(); };
  $("bGf2").onclick = runGf2;
  $("bGf2Take").onclick = () => {
    if (!gf2Last) { say("⤓ Сначала «🧮 Решить»."); return; }
    if (gf2Last.row !== Z.cur || gf2Last.src !== cur()) { say("⤓ Решение считалось для другой строки — реши заново."); return; }
    replaceCur(gf2Last.x, "⤓ Текущая строка заменена ближайшим решением (↩ Ctrl+Z вернёт).");
  };
  // Лин. сложность, лента
  $("linSrc").onchange = (e) => { Z.linSrc = e.target.value; save(); renderLinLive(); };   // v0.040: сразу пересчитать
  $("bLin").onclick = runLin;
  $("structSrc").value = Z.structSrc || "cur";   // v0.042
  $("structSrc").onchange = (e) => { Z.structSrc = e.target.value; save(); renderStructLive(); };
  $("bAddr").onclick = () => { $("addrOut").textContent = "🔎 Ищу глубже…"; setTimeout(() => runAddr(true), 20); };   // v0.041
  $("thruMode").onchange = (e) => { Z.thruMode = e.target.value; save(); };
  $("bThru").onclick = runThru;
  $("bDecim").onclick = runDecim;

  // ⇉ Манчестерский код (v0.007): одна кнопка, левый щелчок — сделать, правый — режим по кругу.
  const MAN_CAP = 1 << 20;
  const manLabel = () => {
    const b = $("bMan");
    b.textContent = Z.manMode === "dec" ? "⇇ Раскод 10→1, 01→0" : "⇉ Код 1→10, 0→01";
    b.classList.toggle("on", Z.manMode === "dec");
  };
  manLabel();
  $("bMan").onclick = () => {
    const s = cur();
    if (Z.manMode !== "dec") {
      if (s.length * 2 > MAN_CAP) { say(`⇉ Вышло бы ${s.length * 2} бит — больше ${MAN_CAP}, не кодирую.`); return; }
      const c = zzManchester(s), tm = zzIsThueMorse(c);
      insertBelow(c, `⇉ Код: ${s.length} → ${c.length} бит, сведений столько же — второй бит пары = инверсия первого.` +
        (tm && c.length >= 4 ? ` Это Туэ–Морс${tm < 0 ? " (инвертированный)" : ""} на ${c.length} бит.` : " Жми ещё — от «0» выйдет Туэ–Морс."));
      return;
    }
    const r = zzUnmanchester(s);
    if (r.odd || r.bad.length) {
      const pos = r.bad.slice(0, 12).map(k => `${2 * k}–${2 * k + 1}`).join(", ") + (r.bad.length > 12 ? ` … всего ${r.bad.length}` : "");
      say(`⇇ Это не манчестерский код: ` + (r.odd ? "длина нечётная" : "") + (r.odd && r.bad.length ? "; " : "") +
          (r.bad.length ? `пары 00/11 на битах ${pos} — в коде таких не бывает, это ошибка, и она видна` : "") + ". Раскод не сделан.");
      return;
    }
    insertBelow(r.out, `⇇ Раскод: ${s.length} → ${r.out.length} бит — от каждой пары первый бит.`);
  };
  $("bMan").oncontextmenu = (e) => {
    e.preventDefault();
    Z.manMode = Z.manMode === "dec" ? "enc" : "dec";
    manLabel(); save();
    say(Z.manMode === "dec" ? "Режим: ⇇ раскод — от каждой пары первый бит." : "Режим: ⇉ код — 1 → 10, 0 → 01.");
  };

  // ⇋ Поправка → столбик (v0.006)
  $("fixKind").onchange = (e) => { Z.fixKind = e.target.value; save(); };
  $("bFixLayer").onclick = () => {
    const r = zzMirrorLayer(Z.rows, Z.fixKind !== "own");
    if (!r.out.length) { say("⇋ Поправки: во всех строках по одному биту — половин нет."); return; }
    snapshot();
    Z.rows = r.out; Z.cur = 0;
    renderAll(); save();
    const kc = ZZ_MIRROR_KINDS[r.common];
    const kindTxt = Z.fixKind === "own"
      ? `вид у каждой свой — первые 2 бита строки (00 ⇄, 01 ⇄🔁, 10 ⧉, 11 ⧉🔁), ${2 * r.out.length} бит на пачку`
      : `вид общий — ${kc.name} ${kc.sign}, 2 бита на всю пачку`;
    say(`⇋ Столбик заменён поправками ${r.out.length} строк` + (r.skipped ? ` (строк в 1 бит пропущено: ${r.skipped})` : "") +
        `. ${kindTxt}. Несимметричных бит ${r.ones} из ${r.halfBits}; разных поправок ${r.distinct} из ${r.out.length}` +
        (r.distinct === 1 && r.out.length > 1 ? " — у всех одна и та же, хватит одной строки" : "") + ". ↩ вернёт.");
  };
  // ⊿ Сложить (v0.006)
  $("foldSrc").onchange = (e) => { Z.foldSrc = e.target.value; renderFoldLive(); save(); };
  $("foldFirst").oninput = (e) => { const v = Math.floor(+e.target.value); if (v >= 1) { Z.foldFirst = v; renderFoldLive(); save(); } };
  $("foldFirst").onchange = (e) => { e.target.value = Z.foldFirst; };
  $("foldStep").oninput = (e) => { const v = Math.floor(+e.target.value); if (e.target.value !== "" && v >= 0) { Z.foldStep = v; renderFoldLive(); save(); } };
  $("foldStep").onchange = (e) => { e.target.value = Z.foldStep; };
  $("foldAlign").value = Z.foldAlign || "center";
  $("foldAlign").onchange = (e) => { Z.foldAlign = e.target.value; renderFoldLive(); save(); };
  $("bFold").onclick = runFold;
  // ⇅ Сортировка сдвигов (v0.006)
  $("bwtIdx").onchange = (e) => { Z.bwtIdx = Math.max(0, Math.floor(+e.target.value || 0)); e.target.value = Z.bwtIdx; save(); };
  $("bBwt").onclick = runBwt;
  $("bBwtPut").onclick = () => {
    const r = (bwtLast && bwtLast.row === Z.cur && bwtLast.src === cur()) ? bwtLast : runBwt();
    if (!r) return;
    insertBelow(r.last, `⤓ Последний столбец под строкой — № ${r.index}. «↶ Обратный ход» от него вернёт исходную.`);
  };
  $("bUnbwt").onclick = () => {
    const L = cur(), I = Math.floor(+$("bwtIdx").value || 0);
    if (I >= L.length) { say(`↶ Номер ${I} больше строк в таблице (${L.length}) — возьми от 0 до ${L.length - 1}.`); return; }
    const s = zzUnbwt(L, I);
    const chk = s ? zzBwt(s) : null;
    if (!chk || chk.last !== L || chk.index !== I) {
      // Не каждая пара «столбец + номер» бывает результатом сортировки: пар в n раз больше, чем строк.
      say(`↶ Такой пары «столбец ${L.length} бит + № ${I}» сортировка не выдаёт ни для одной строки: пар в ${L.length} раз больше, чем строк. Ничего не вставлено.`);
      return;
    }
    insertBelow(s, `↶ Обратный ход: по столбцу и № ${I} восстановлена строка ${s.length} бит.`);
  };

  // Шапка
  $("fontSel").onchange = (e) => { Z.ff = e.target.value; renderAll(); save(); };
  $("fsRange").oninput = (e) => { Z.fs = +e.target.value; renderAll(); save(); };
  $("bLayout").onclick = () => { layoutAll(true); save(); renderPointers(); };
  $("bUndo").onclick = undo;
  // v0.015: ⤒ окна к верху — вкл/выкл
  const packLabel = () => $("bPack").classList.toggle("on", !!Z.pack);
  packLabel();
  $("bPack").onclick = () => { Z.pack = !Z.pack; packLabel(); packWins(); save(); say(Z.pack ? "⤒ Окна прижимаются к верху." : "⤒ Выключено: окна стоят там, где их поставили."); };
  $("bTheme").onclick = () => { Z.theme = themeIsLight() ? "dark" : "light"; applyTheme(); save(); };
  // v0.035: левая панель значками — переключатель и слежение за перерисованными кнопками
  $("bPaneIcons").onclick = () => { Z.paneIcons = !Z.paneIcons; applyPaneIcons(); save(); packWins(); };
  new MutationObserver(() => { if (Z.paneIcons) iconizePane(); }).observe($("rowsPane"), { childList: true, subtree: true, characterData: true });
  $("bHelp").onclick = () => { Z.helpOn = !Z.helpOn; layoutAll(false); save(); };

  // Клавиши: ↑/↓ — по строкам, Ctrl+Z — отмена (не в полях ввода).
  // v0.012: Del/Backspace — удалить выделенное, Ctrl+A — выделить все строки, Esc — снять выделение.
  document.addEventListener("keydown", (e) => {
    const t = e.target;
    if (t && t.closest && t.closest("input, select, textarea")) return;
    if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "я")) { e.preventDefault(); undo(); return; }
    if ((e.key === "Delete" || e.key === "Backspace") && axSel >= 0 && Z.laneCount > 1 && Z.laneView === "over") { e.preventDefault(); deleteLane(axSel); return; }   // v0.022
    if (e.key === "Escape" && axSel >= 0) { axSel = -1; renderRows(); say("Выделение оси снято."); return; }
    if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); deleteSelection(); return; }
    if ((e.ctrlKey || e.metaKey) && (e.key === "a" || e.key === "ф" || e.key === "A" || e.key === "Ф")) {
      e.preventDefault(); clearTextSel();
      rowSel.clear(); Z.rows.forEach((_, k) => rowSel.add(k)); rowSelAnchor = 0;
      renderRows(); say(`Выделены все строки — ${Z.rows.length}. Del удалит, Ctrl+C скопирует, Esc снимет.`); return;
    }
    if (e.key === "Escape" && (rowSel.size || textSelInRows())) { rowSel.clear(); clearTextSel(); renderRows(); return; }
    if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && Z.laneCount > 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
      e.preventDefault(); switchLane((Z.lane + (e.key === "ArrowRight" ? 1 : Z.laneCount - 1)) % Z.laneCount); return;
    }
    if (e.key === "ArrowUp" || e.key === "ArrowDown") delAtEnd = false;   // v0.021
    if (e.key === "ArrowUp" && Z.cur > 0) { e.preventDefault(); Z.cur--; renderAll(); save(); }
    else if (e.key === "ArrowDown" && Z.cur < Z.rows.length - 1) { e.preventDefault(); Z.cur++; renderAll(); save(); }
  });

  renderAll();
  applyPaneIcons();   // v0.035: панель значками — как запомнено (шаблоны уже нарисованы)
  // Шрифт мог догрузиться позже — ширина ячейки бита изменится, скобки надо переложить.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => renderPointers());
  // v0.017: ширина стола известна только теперь (разделитель поставлен) — окна под неё; и при смене размера окна браузера.
  packWins(); save();
  let rsz = 0;
  window.addEventListener("resize", () => { clearTimeout(rsz); rsz = setTimeout(() => { packWins(); save(); }, 200); });
}
init();
