/* ═══════════════════════════════════════════════════════════════════════════════════════════
   ZAZERKALIUS — ИНТЕРФЕЙС
   Всё состояние — в объекте Z; сохраняется в localStorage (обёрнуто в try: в приватном окне
   хранилища может не быть, и страница обязана работать без него). Математика — в zz-core.js.
   ═══════════════════════════════════════════════════════════════════════════════════════════ */
/* v0.141, «нужна своя html для этого (◯ Конус) с полем строк, вообще всё без других вкладок»: адрес с ?solo=cone
   (его открывает Zerkalius-konus.html) — страница из поля строк и одного окна на весь стол. Память у неё своя, чтобы
   раскладка окон Zazerkalius не портилась; при первом запуске строки и настройки берутся из Zazerkalius. */
const ZZ_SOLO = (() => {
  try { const s = new URLSearchParams(location.search).get("solo"); return s && /^[a-z0-9-]+$/.test(s) && document.getElementById("w-" + s) ? "w-" + s : ""; }
  catch (e) { return ""; }
})();
/* v0.184, «на обои вместо — в index поставим?» (по снимку конуса-октаэдра в дзене): ?solo=cone&bg=1 — живой фон хаба. Только конус
   (3D, зеркало вниз, свет, медленно крутится целиком), без кнопок и подсказок; строки — Серпинский на 64; память не читается и
   не пишется — фон не трогает настройки и строки страницы «◯ Конус». */
/* v0.185, «сохранил пресет — как его дальше, например в Мультфильмы?»: ?solo=cone&preset=<имя> — показ пресета из presety/<имя>.js
   (его пишет presety/dobavit.py из файла «💾 Всё»; страница подключает файл сама, до этого скрипта). Как фон хаба: только конус и
   кручение, память не читается и не пишется; состояние — из пресета. */
const ZZ_PRESET = (window.ZZ_PRESET_DATA && window.ZZ_PRESET_DATA.state && Array.isArray(window.ZZ_PRESET_DATA.state.rows)) ? window.ZZ_PRESET_DATA : null;
const ZZ_BG = (() => { try { return !!ZZ_SOLO && (new URLSearchParams(location.search).get("bg") === "1" || !!ZZ_PRESET); } catch (e) { return false; } })();
/* v0.196, «как сохранять, чтобы по ссылке открывали прямо там» → «да» (вся страница, а не только конус): ?preset=<имя> без solo —
   весь Zazerkalius в состоянии пресета: окна, конус, лазер, поля строк. Память не читается и не пишется: гость крутит и гоняет
   лазер, его собственные строки и раскладка не тронуты, а ссылка при каждом открытии снова даёт пресет как есть. */
const ZZ_PRESET_FULL = !!ZZ_PRESET && !ZZ_SOLO;
const ZZ_PRESET_LAYOUT = ["home", "win", "dockOrder", "z", "layoutVer", "rowsH", "rowsW", "ctw", "cgrpPos", "cgrpSize", "cgrpDock", "cgrpMove", "paneW", "paneWUser", "padPos", "tpl", "tplRef", "pins", "coneBtns"];   // конусу одному (?solo=cone) — ни к чему
const ZZ_KEY = ZZ_BG ? "zazerkalius_bg" : ZZ_SOLO ? "zazerkalius_solo_" + ZZ_SOLO.slice(2) : "zazerkalius_v1";
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
  lanesHid: null,                        // v0.112: строки за границей (ниже черты) — у каждого поля свой хвост
  fillCells: null,                       // v0.114: строка для заполнения под чертой — «.» пусто, «0» / «1»
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
const ZZ_ROWS0 = Z.rows.slice();   // v0.123: начальный столбик — до того, как load() положит сохранённый
const undoStack = [];
let gf2Last = null;

function load(){
  if (ZZ_PRESET) {   // v0.185: пресет
    const u = JSON.parse(JSON.stringify(ZZ_PRESET.state));
    if (ZZ_SOLO) for (const k of ZZ_PRESET_LAYOUT) delete u[k];   // v0.196: в пресете теперь и раскладка — для всей страницы
    if (u.rows.every(zzIsBits)) Object.assign(Z, u);
    if (ZZ_PRESET_FULL && !Z.home) Z.home = homeOf(Z);   // v0.196: «↺ Начальные» и «⟲ всё на места» — к пресету
    return;
  }
  if (ZZ_BG) return;   // v0.184: фон хаба — всегда по умолчанию
  try {
    let raw = localStorage.getItem(ZZ_KEY), first = false;
    if (!raw && ZZ_SOLO) { raw = localStorage.getItem("zazerkalius_v1"); first = true; }   // v0.141: первый запуск отдельной страницы
    if (!raw) return;
    const u = JSON.parse(raw);
    if (first && u) { delete u.win; delete u.dockOrder; delete u.pins; }   // окна Zazerkalius ей ни к чему
    if (u && Array.isArray(u.rows) && u.rows.every(zzIsBits)) Object.assign(Z, u);
  } catch (e) { /* хранилища нет — работаем с тем, что по умолчанию */ }
  if (!Z.rows.length) Z.rows = ["1"];
  Z.cur = Math.max(0, Math.min(Z.rows.length - 1, Z.cur | 0));
}
let sessLoading = false;   // v0.115: файл сессии уже лёг в хранилище, страница перезагружается — ничего поверх не писать
function save(){
  syncLane();
  if (ZZ_BG) return;   // v0.184: фон хаба ничего не запоминает
  if (ZZ_PRESET_FULL) return;   // v0.196: пресет по ссылке — тоже
  if (sessLoading) return;
  try { localStorage.setItem(ZZ_KEY, JSON.stringify(Z)); } catch (e) { /* нет хранилища — не беда */ }
}
let msgTimer = 0, tipEl = null, tipTimer = 0, tipShown = false;
function say(t){
  const m = $("msg");
  clearTimeout(tipTimer); tipShown = false;   // v0.294: сообщение перекрывает подсказку
  m.textContent = t; m.classList.add("show");
  clearTimeout(msgTimer); msgTimer = setTimeout(() => m.classList.remove("show"), Math.min(12000, 2500 + t.length * 45));
}
/* v0.294, по снимку всплывшей подсказки шаблона — «все подсказки показывай в области уведомлений»: подсказки браузера (title) не
   всплывают у мыши — их текст идёт в #msg внизу, пока мышь над элементом (через 250 мс). На время наведения title переезжает в
   data-zz-tip (иначе браузер покажет и своё окошко) и возвращается при уходе мыши и при нажатии — код, читающий .title, его видит. */
function tipOff(keepMsg){
  clearTimeout(tipTimer);
  if (tipEl) { if (!tipEl.hasAttribute("title") && tipEl.dataset.zzTip != null) tipEl.setAttribute("title", tipEl.dataset.zzTip); delete tipEl.dataset.zzTip; tipEl = null; }
  if (tipShown && !keepMsg) { tipShown = false; $("msg").classList.remove("show"); }
}
document.addEventListener("mouseover", (e) => {
  const el = e.target && e.target.closest ? e.target.closest("[title], [data-zz-tip]") : null;
  if (el === tipEl) return;
  tipOff();
  if (!el) return;
  const t = el.getAttribute("title") || el.dataset.zzTip || ""; if (!t.trim()) return;
  tipEl = el; el.dataset.zzTip = t; el.removeAttribute("title");
  tipTimer = setTimeout(() => { const m = $("msg"); clearTimeout(msgTimer); m.textContent = t; m.classList.add("show"); tipShown = true; }, 250);
}, true);
document.addEventListener("mouseout", (e) => { if (tipEl && !(e.relatedTarget && tipEl.contains(e.relatedTarget))) tipOff(); }, true);
/* v0.295, по снимку висящего сообщения после выбора «Серп 90» — «убирай уведомления, которые после нажатия, — при любом следующем
   клике»: любое нажатие сперва гасит висящее уведомление (и подсказку); если сам щелчок что-то скажет — его сообщение встанет следом. */
document.addEventListener("pointerdown", () => { tipOff(); clearTimeout(msgTimer); $("msg").classList.remove("show"); }, true);   // v0.294: и title на место до обработчиков
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
  if (!Array.isArray(Z.lanesHid) || !Z.lanesHid.every(l => Array.isArray(l) && l.every(zzIsBits))) Z.lanesHid = [];   // v0.112
  Z.lanesHid = Z.lanesHid.slice(0, 4); while (Z.lanesHid.length < 4) Z.lanesHid.push([]);
}
/* v0.061, «замок на изменение строк» (снимок кнопок над полем). Почти каждая правка строк начинается со snapshot() — точки
   отмены; при закрытом замке он прерывает правку до изменения (ZZ_LOCK — тихо, без «⚠ ошибки»). Правка на месте и ↩ —
   проверяют замок сами. */
function rowsLocked(){ if (!Z.rowLock) return false; say("🔒 Строки заперты — открой замок над полем строк, чтобы менять."); return true; }
function snapshot(){
  if (rowsLocked()) throw new Error("ZZ_LOCK");
  undoPush(undoState());
  if (typeof rowSel !== "undefined") rowSel.clear();
}
function undoState(){
  syncLane();
  return { rows: Z.rows.slice(), cur: Z.cur, lane: Z.lane, lanes: Array.isArray(Z.lanes) ? Z.lanes.map(l => l.slice()) : null,
           laneCount: Z.laneCount, axisPos: Array.isArray(Z.axisPos) ? Z.axisPos.slice() : [],   // v0.022: и поля, и оси
           lanesHid: hidCopy() };   // v0.112: и строки за границей — иначе ↩ задвоил бы спрятанные
}
function undoPush(u){ undoStack.push(u); if (undoStack.length > 200) undoStack.shift(); redoStack.length = 0; }   // v0.158: новая правка — повторять больше нечего
/* v0.158, «и повтор — слева от всех кнопок»: ↪ Повторить — то, что отменил ↩. Отмена кладёт состояние до себя в redoStack,
   повтор — обратно в undoStack; любая новая правка (undoPush) повторы стирает. */
const redoStack = [];
function undoApply(u){
  if (u.laneCount) { Z.laneCount = u.laneCount; Z.axisPos = u.axisPos; const lc = document.getElementById("laneCount"); if (lc) lc.value = String(Z.laneCount); }
  if (u.lanes) { Z.lanes = u.lanes; Z.lane = Math.max(0, Math.min(Z.laneCount - 1, u.lane | 0)); Z.rows = Z.lanes[Z.lane]; }
  else Z.rows = u.rows;
  if (u.lanesHid) Z.lanesHid = u.lanesHid;   // v0.112
  Z.cur = Math.max(0, Math.min(Z.rows.length - 1, u.cur));
  renderAll(); save();
}
function undo(){
  if (rowsLocked()) return;   // v0.061
  const u = undoStack.pop();
  if (!u) { say("↩ Отменять нечего."); return; }
  redoStack.push(undoState()); if (redoStack.length > 200) redoStack.shift();
  undoApply(u); say("↩ Отменено. ↪ — повторить.");
}
function redo(){
  if (rowsLocked()) return;
  const u = redoStack.pop();
  if (!u) { say("↪ Повторять нечего."); return; }
  undoStack.push(undoState()); if (undoStack.length > 200) undoStack.shift();
  undoApply(u); say("↪ Повторено.");
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
/* v0.239, «как в Cellcosmos — энтропия и симметрия»: у текущей строки в сведениях поля — H (энтропия по тройкам бит) и ⇄
   (зеркальность); что это — в подсказке сведений. Счёт — zzRowEntropy / zzRowMirror в ядре. */
const ROW_METR_TIP = "\nH — энтропия текущей строки по тройкам бит: 0 — один рисунок повторяется, 1 — шум (все восемь троек поровну)." +
  "\n⇄ — зеркальность: сколько бит совпадает со своим отражением с другого конца. 100% — палиндром, 0% — антипалиндром (⇄ = инверсия).";
function rowMetr(){ const s = cur(); return s.length < 2 ? "" : ` · H ${zzRowEntropy(s).toFixed(2)} · ⇄ ${Math.round(zzRowMirror(s) * 100)}%`; }
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
    let fx = 0; const n = s.length, ir = Z.showFix === "ir";   // v0.058: в режиме реверс-инверсии — её неподвижные
    for (let i = 0; i < n; i++) if (ir ? s[i] !== s[n - 1 - i] : s[i] === s[n - 1 - i]) fx++;
    h += '<span class="rc" title="неподвижных бит ' + fx + (ir ? " (реверс-инверсия их не трогает)" : " (разворот их не трогает)") + ", меняющихся " + (n - fx) + '"><span class="rcf">' + fx + '</span><span>·</span><span class="rcm">' + (n - fx) + "</span></span>";   // v0.050: колонками
  }
  if (Z.show01) {
    const k = zzOnes(s);
    h += '<span class="rc" title="нулей ' + (s.length - k) + ", единиц " + k + '"><span class="b0">' + (s.length - k) + '</span><span>:</span><span class="b1">' + k + "</span></span>";
  }
  return h;
}
/* v0.058, «сюда же реверс-инверс» (по кнопке «🔴 неподв.»): режим неподвижных бит — true: при развороте (бит = зеркальному,
   красным), "ir": при реверс-инверсии (бит ≠ зеркальному — разворот с инверсией кладёт его на то же место, зелёным). */
function fixAt(s, i){ const n = s.length; return Z.showFix === "ir" ? s[i] !== s[n - 1 - i] : s[i] === s[n - 1 - i]; }
function fixCls(){ return Z.showFix === "ir" ? " fxi" : " fxr"; }
function bitsShow(s){
  const x = s.length > ROW_SHOW ? s.slice(0, ROW_SHOW) : s;
  if (!Z.showFix) return bitsPlain(x);
  const c = fixCls(); let h = "";
  for (let i = 0; i < x.length; i++) h += '<span class="b' + x[i] + (fixAt(s, i) ? c : "") + '">' + x[i] + "</span>";
  return h;
}
/* v0.456, по снимку поля строк — «добавь отображение квадратами вместо бит и ромбами; ромбами — только когда чёт-нечет строки длиной идут, чтобы
   ромбы вкладывались друг в друга»: вид бит в поле (Z.bitView: txt — цифры, sq — квадраты, rh — ромбы). Каждый бит — <i class="q"> с той же
   цифрой (прозрачной — выделение, щелчки и счёт бит по тексту работают как прежде), фигура — ::before цветом бита (нули — бледно). Ромб —
   шириной в символ и высотой в два ряда: у строк, чья длина отличается от соседней на нечётное (сдвиг на полсимвола, при выравнивании по центру),
   ромбы соседних рядов входят друг в друга сплошной решёткой; у остальных строк — квадраты. Размеры — --qw (символ) и --qh (шаг рядов), меряет renderRows */
function bitsCells(s){
  const x = s.length > ROW_SHOW ? s.slice(0, ROW_SHOW) : s, fc = Z.showFix ? fixCls() : ""; let h = "";
  for (let i = 0; i < x.length; i++) h += '<i class="q b' + x[i] + (fc && fixAt(s, i) ? fc : "") + '">' + x[i] + "</i>";
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
function deleteLane(k, how){
  if (Z.laneCount <= 1) { say("Это единственное поле — удалять нечего."); axSel = -1; renderRows(); return; }
  snapshot();
  syncLane();
  Z.lanes.splice(k, 1); Z.lanes.push(["1"]);
  Z.lanesHid.splice(k, 1); Z.lanesHid.push([]);   // v0.112
  if (Array.isArray(Z.axisPos)) Z.axisPos.splice(k, 1);
  Z.laneCount--;
  if (Z.lane > k) Z.lane--; else if (Z.lane === k) Z.lane = Math.max(0, k - 1);
  Z.lane = Math.min(Z.lane, Z.laneCount - 1);
  Z.rows = Z.lanes[Z.lane];
  Z.cur = Math.max(0, Math.min(Z.rows.length - 1, Z.cur));
  axSel = -1;
  $("laneCount").value = String(Z.laneCount);
  renderAll(); save();
  say((how ? `${how} ${k + 1} удалено со всеми строками` : `Del: ось ${k + 1} удалена вместе с её полем`) + `. Полей — ${Z.laneCount}, рабочее — ${Z.lane + 1}. ↩ вернёт.`);
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
function ovRowMap(i, A, cap, hid){   // v0.112: hid — строка i из-за границы
  const m = new Map();
  for (let l = 0; l < Z.laneCount; l++) {
    const s = (hid ? hidRows(l) : laneRows(l))[i]; if (s === undefined) continue;
    const Lc = Math.min(s.length, cap), st = ovStart(A[l], Lc);
    for (let j = 0; j < Lc; j++) { const p = st + 2 * j; let e = m.get(p); if (!e) { e = []; m.set(p, e); } e.push({ l, b: s[j], fx: fixAt(s, j) }); }
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
        t += '<span class="ob l' + e.l + " b" + e.b + (e.l === Z.lane ? " la" : "") + (Z.showFix && e.fx ? fixCls() : "") + '" data-l="' + e.l + '" style="left:' + (p / 2) + 'ch">' + e.b + "</span>";
      } else {
        const v = ovCombine(list), top = list.find(e => e.l === Z.lane) || list[list.length - 1];
        t += '<span class="ob mix b' + v + '" data-l="' + top.l + '" style="left:' + (p / 2) + 'ch" title="' +
             list.map(e => "поле " + (e.l + 1) + ": " + e.b).join(", ") + " → " + v + '">' + v + "</span>";
      }
    }
    h += '<div class="rw ovr' + (i === Z.cur ? " cur" : "") + (rowSel.has(i) ? " sel" : "") + '" data-r="' + i + '"><span class="no' + (rowChanged(i) ? " chg" : "") + '" title="строка ' + (i + 1) + (rowChanged(i) ? " — изменена против эталона ⚑" : "") + ' · щелчок — выделить">' + '<span class="rn">' + (i + 1) + '</span>' + rowLockBadge(i) + rowCounts(Z.rows[i]) +
         '</span><span class="trk" style="width:' + W + '">' + lines + t + "</span></div>";
  }
  h += '<div id="infoSlot"></div>' + cutLine() + '<div id="cutSlot"></div>';   // v0.237: сведения — под последней строкой; v0.112; v0.225: под чертой — кнопки достройки и шаблоны
  let HH = 0; for (let l = 0; l < N; l++) HH = Math.max(HH, hidRows(l).length);
  for (let j = 0; j < HH; j++) {
    let t = "";
    for (const [p, list] of ovRowMap(j, A, OV_SHOW, true)) t += '<span class="ob" style="left:' + (p / 2) + 'ch">' + (list.length === 1 ? list[0].b : ovCombine(list)) + "</span>";
    h += hidRowHtml(H + j, '<span class="trk" style="width:' + W + '">' + lines + t + "</span>").replace('class="rw hid"', 'class="rw ovr hid"');
  }
  L.innerHTML = h + "</div>"; cutPanelMount();   // v0.225
  const tot = Z.rows.reduce((a, s) => a + s.length, 0);
  $("fieldInfo").textContent = `наложение ${N} полей · рабочее ${Z.lane + 1} · ${Z.rows.length} стр. · ${tot} бит · текущая ${Z.cur + 1}` + (hidCount() ? ` · за границей ${hidCount()} стр.` : "") + rowMetr();
  $("fieldInfo").title = $("fieldInfo").textContent + ROW_METR_TIP;   // v0.077: целиком — в подсказке
  fieldInfoFit();   // v0.209
  $("rowList").classList.toggle("dimsel", rowSel.size > 0); $("rowList").classList.toggle("dimcur", !rowSel.size && !document.body.classList.contains("nocur"));   // v0.213 / v0.221: выделение (или выбранная строка) — остальные строки гаснут
  rowsFit(); rowsLockAllPlace(); rowBitMark(); wallMark();   // v0.153, v0.167, v0.173; v0.347 — стенка
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
/* v0.071, по снимку поля с треугольником «1 / 11 / 111»: «кнопку — треугольник в 90°», «подобрать межсимвольный». Строка
   k+1 шире строки k на один символ и по центру сдвинута на полсимвола; чтобы стороны шли под 45° (угол при вершине 90°),
   полсимвола должно равняться шагу строк: шаг символа = 2 × шаг строк, т. е. межсимвольный = 2·шаг строк − ширина цифры.
   Ширина — по пробе шрифтом поля, шаг строк — по настоящей строке поля. */
function tri90Apply(){
  const L = $("rowList"); if (!L) return;
  const on = !!Z.tri90 && !ovControls();
  L.classList.toggle("tri90", on);
  if (!on) return;
  // v0.074, «нет 90»: .rw — не блок (номер и биты стоят прямо в сетке поля), его высота 0 — шаг строк меряем по битам
  // двух соседних строк (или по высоте самих бит, если строка одна)
  const bl = L.querySelectorAll(".rw .bits"), bits = bl[0]; if (!bits) return;
  const pr = document.createElement("span");
  pr.style.cssText = "position:absolute;visibility:hidden;white-space:pre;letter-spacing:0;font-family:var(--ff);font-size:var(--fs)";
  pr.textContent = "0101010101"; bits.appendChild(pr);
  const cw = pr.getBoundingClientRect().width / 10; pr.remove();
  const pitch = bl.length > 1 ? Math.abs(bl[1].getBoundingClientRect().top - bl[0].getBoundingClientRect().top) || bits.getBoundingClientRect().height : bits.getBoundingClientRect().height;
  const ls = Math.max(0, 2 * pitch - cw);
  L.style.setProperty("--ls90", ls.toFixed(2) + "px");
  Z.tri90Ls = Math.round(ls * 10) / 10;
}
/* v0.092: замок кольца конуса — значком перед номером строки (🔒 заперто / 🔓 открыто — бледно; золотая рамка — свой
   замок), «↻k» — кольцо повёрнуто на вид. Щелчок — запереть / отпереть, правый — снова по общей галке. */
/* v0.097, «в 0-й строке не должно быть ничего, с 1-й строки вписываем биты»: строки нумеруются для глаза С ЕДИНИЦЫ — в поле,
   у замков, в таблицах, в текстах окон и сообщениях (строка треугольника номер k — k бит). Внутри всё по-прежнему с нуля. */
/* v0.382, «покажи другими значками, просто полоской»: вместо 🔒 / 🔓 — полоска из CSS: заперто — сплошная, открыто — пустая золотая. */
function rowLockBadge(i){
  if (typeof coneLocked !== "function") return "";
  const lk = coneLocked(i), own = Z.coneLocks && Z.coneLocks[i] !== undefined, rr = Math.round((typeof coneRot !== "undefined" && coneRot[i]) || 0);
  return '<span class="rlk' + (lk ? " on" : "") + (own ? " own" : "") + '" data-lk="' + i + '" title="Кольцо ' + (i + 1) + ' в конусе: ' + (lk ? "заперто — крутится только на вид" : "открыто — крутит саму строку") +
    ' · щелчок — ' + (lk ? "отпереть" : "запереть") + ' (общий замок над столбиком — все разом)"></span>' +'<span class="rrot"' + (rr ? ' data-rr="' + i + '" title="Кольцо повёрнуто на вид на ' + rr + ' — щелчок: снять накрутку"' : "") + '>' + (rr ? "↻" + rr : "") + "</span>";   // v0.101: щелчок — снять   // v0.093: столбик поворота есть всегда — столбики ровные
}
/* v0.112, «под нижней строкой последней поставь линию-границу; если за неё вверх — пусть скрывает строки ниже неё, делая их
   бесцветными, и этих строк как будто нет». Строки за границей лежат отдельно — хвост Z.lanesHid[l] у поля l, а в Z.rows / Z.lanes
   только строки над чертой; поэтому окна, конус, кнопки, счёт и шаблоны их просто не видят — как будто их нет. Граница одна на
   все поля и стоит под нижней строкой; тянешь её вверх — у каждого поля над ней остаётся не больше k строк (хотя бы одна), вниз —
   строки возвращаются на свои места. Двойной щелчок по черте — вернуть все. Перенос черты — правка: ↩ вернёт. */
const CUT_PANEL = document.getElementById("cutPanel");   // v0.225: кнопки достройки и шаблоны — живут под чертой, переносятся при каждой отрисовке поля
const FIELD_INFO = document.getElementById("fieldInfo");   // v0.237, «эту надпись вниз, под последнюю строку»: сведения поля — строкой под последней строкой
function cutPanelMount(){
  const s = document.getElementById("cutSlot"); if (s && CUT_PANEL && CUT_PANEL.parentNode !== s) s.appendChild(CUT_PANEL);
  const f = document.getElementById("infoSlot"); if (f && FIELD_INFO && FIELD_INFO.parentNode !== f) f.appendChild(FIELD_INFO);
  const b = document.getElementById("bCutClr"); if (b) b.disabled = !hidCount();   // v0.245: 🗑 — только когда под чертой что-то есть
  cutHidUi();   // v0.288
  clrPlace();   // v0.290
}
/* v0.290, «вот тут в нижний угол всегда»: 🗑 лежит в #field поверх поля строк — в правом нижнем углу его видимой части, левее и выше
   полос прокрутки. Место пересчитывается при каждой отрисовке поля и при смене размеров поля (ResizeObserver). */
/* v0.293, «убери влево значок и уведомление — за значки, если накладываются»: 🗑 — в ЛЕВОМ нижнем углу, выше полосы прокрутки, и
   лежит прямо в body (position:fixed, z-index 51) — из #field (там isolation) его над уведомлением #msg (z-index 50) не поднять.
   Место — по видимой части #rowList на экране; поле скрыто — 🗑 тоже. */
const CLR_BTN = document.getElementById("bCutClr");
if (CLR_BTN) document.body.appendChild(CLR_BTN);
function clrPlace(){
  const L = document.getElementById("rowList"); if (!CLR_BTN || !L) return;
  const r = L.getBoundingClientRect(), off = !L.getClientRects().length || r.width < 40 || r.height < 30;
  CLR_BTN.style.visibility = off ? "hidden" : ""; if (off) return;
  CLR_BTN.style.left = (r.left + L.clientLeft + 6) + "px";
  CLR_BTN.style.bottom = (window.innerHeight - (r.top + L.clientTop + L.clientHeight) + 4) + "px";
}
if (window.ResizeObserver) { const ro = new ResizeObserver(() => clrPlace()); ["rowList", "field"].forEach(id => { const e = document.getElementById(id); if (e) ro.observe(e); }); }
window.addEventListener("resize", () => clrPlace());
/* v0.288, «убери выделение, когда нет внизу ничего»: «Заменить» и «⤒ из-под черты» — про строки, что уже лежат под чертой; когда там
   пусто, обе ничего не делают, и подсветка не горит. Сохранённый выбор не меняется — подсветится, как только под чертой появятся строки. */
/* v0.361, «„Заменить“ удали; жёлтая обводка — либо-либо»: «Заменить» снята (строки под чертой при достройке больше не стираются — сдвигаются
   вниз, ниже новых; стереть их — 🗑). Горит одно: «⤒ из-под черты», когда она включена и под чертой есть строки (черта вниз сперва вернёт их),
   иначе — способ достройки (🔺 Серп 90 / 30 / маска), им и будут строиться строки. */
function cutHidUi(){
  const t = document.getElementById("bCutTake"); if (!t) return;
  const take = hidCount() > 0 && Z.cutTake !== false, m = Z.cutGen || "r90";
  t.classList.toggle("on", take);   // v0.253
  for (const [id, v] of [["bCutR90", "r90"], ["bCutR30", "r30"], ["bCutMask", "mask"]]) { const b = document.getElementById(id); if (b) b.classList.toggle("on", !take && m === v); }
}
function hidRows(l){ return (Z.lanesHid && Z.lanesHid[l]) || []; }
function hidCopy(){ return Array.isArray(Z.lanesHid) ? Z.lanesHid.map(l => l.slice()) : null; }
function hidCount(){ let c = 0; for (let l = 0; l < (Z.laneCount || 1); l++) c += hidRows(l).length; return c; }
function cutHeight(){ let H = 0; for (let l = 0; l < (Z.laneCount || 1); l++) H = Math.max(H, laneRows(l).length); return H; }
/* v0.225, «когда тянуть за линию вниз — строки достраиваются от верхней», «под линией — кнопки Серп 90, 30, маска (умолч. 01 и поле
   для неё)», «если под полосой есть другие — их удалить» → «кнопку: удалить или сдвинуть вниз», «туда же свои сохранённые пресеты».
   Черту тянут вниз за нижнюю строку — каждая новая строка достраивается от строки над ней: 🔺 Серп 90 — правило 90 (строка на 2 бита
   длиннее, как заготовки Аниматрицы), 30 — правило 30, маска — маска Z.cutMask подряд на бит длиннее. Строки, что были под чертой:
   🗑 удалить (Z.cutHidMode = "del", по умолчанию) или ⤓ сдвинуть вниз ("keep") — остаются под чертой ниже новых. Замок строк (⛔)
   достраивать не даёт — тогда черта, как прежде, только возвращает строки из-под себя. */
/* v0.234, «объединить с тем html, где нарезка треугольника на мелкие и строится анимация (Треугольник): взять их и расположить
   друг под другом в Зазеркалиусе» (по снимку столбика из треугольников по 16 строк). Как в Треугольнике: треугольник строк режется без
   остатка на полосы высотой h, в полосе n — n + 1 треугольников ▲ (вершина вверху). Строки ▲: строка t полосы — кусок строки
   n·h + t с позиции g·h·j длиной g·t + 1, где g — на сколько растёт строка (1 — Паскаль, 2 — правила 90, 30…). Куски ставятся
   друг под другом в выбранном порядке: по рядам (→), вдоль левой стороны (↘), вдоль правой (↙); «без пустых» — без ▲ из одних нулей. */
/* v0.237, «нужны ▼, и вообще все вариации настроек — по размерам, по порядку…» (как в Треугольнике): фигуры — ▲, ▼ (как есть: строки
   убывают), ▼ перевёрнутые (строки растут), ▲▼ (обе, по порядку), ◇ ромбы (▲ и ▼ под ним — ромб, разрезанный горизонтальной
   диагональю), ⧗ часы (▼ над ▲, склеенные вершиной); порядок — по рядам, вдоль левой стороны, вдоль правой, каждый в обе стороны.
   ▼ полосы n между ▲ j и j + 1: строка t — кусок строки n·h + t с позиции g·h·j + g·t + 1 длиной g·(h − t) − 1 (строка нулевой длины
   отбрасывается). */
const TRI_UNITS = { up: "▲", dn: "▼", dnf: "▼ перевёрнутые", both: "▲▼", rh: "◇ ромбы", hg: "⧗ часы" };
const TRI_ORDERS = { rows: "по рядам →", rowsR: "по рядам ←", left: "вдоль левой ↘", leftR: "вдоль левой ↖", right: "вдоль правой ↙", rightR: "вдоль правой ↗" };
function triCut(rows, h, order, skipEmpty, unit){
  const n = rows.length;
  if (n < 2) return { err: "✂ Нечего резать — нужен треугольник хотя бы из двух строк." };
  if (rows[0].length !== 1) return { err: "✂ Режу треугольник от вершины в один бит — первая строка должна быть из одного бита." };
  const g = rows[1].length - rows[0].length;
  if (g !== 1 && g !== 2) return { err: "✂ Строки должны расти на 1 бит (Паскаль) или на 2 (правила 90, 30…) — здесь не так." };
  for (let i = 0; i < n; i++) if (rows[i].length !== g * i + 1) return { err: `✂ Строка ${i + 1} — ${rows[i].length} бит, а в треугольнике (+${g}) должно быть ${g * i + 1}.` };
  const bands = Math.floor(n / h);
  if (!bands) return { err: `✂ Строк ${n} — меньше одной полосы высотой ${h}.` };
  const up = (lev, j) => { const rs = []; for (let t = 0; t < h; t++) { const a = g * h * j; rs.push(rows[lev * h + t].slice(a, a + g * t + 1)); } return rs; };
  const dn = (lev, j) => { const rs = []; for (let t = 0; t < h; t++) { const a = g * h * j + g * t + 1, L = g * (h - t) - 1; if (L > 0) rs.push(rows[lev * h + t].slice(a, a + L)); } return rs; };
  const u = TRI_UNITS[unit] ? unit : "up", items = [];
  for (let lev = 0; lev < bands; lev++) for (let j = 0; j <= lev; j++) {
    if (u === "up" || u === "both") items.push({ lev, j, k: 0, rs: up(lev, j) });
    if ((u === "dn" || u === "both") && j < lev) items.push({ lev, j, k: 1, rs: dn(lev, j) });
    if (u === "dnf" && j < lev) items.push({ lev, j, k: 1, rs: dn(lev, j).reverse() });
    if (u === "rh" && lev + 1 < bands) items.push({ lev, j, k: 0, rs: up(lev, j).concat(dn(lev + 1, j)) });
    if (u === "hg" && j < lev && lev + 1 < bands) items.push({ lev, j, k: 1, rs: dn(lev, j).concat(up(lev + 1, j + 1)) });
  }
  const kept = skipEmpty ? items.filter(it => it.rs.some(r => r.indexOf("1") >= 0)) : items;
  const o = TRI_ORDERS[order] ? order : "rows", d = /R$/.test(o) ? -1 : 1, base = o.replace(/R$/, "");
  const key = base === "left" ? (it) => [it.j, d * it.lev, it.k] : base === "right" ? (it) => [it.lev - it.j, d * it.lev, it.k] : (it) => [it.lev, d * it.j, d * it.k];
  kept.sort((x, y) => { const a = key(x), b = key(y); return a[0] - b[0] || a[1] - b[1] || a[2] - b[2]; });
  return { g, bands, items: kept, rows: [].concat(...kept.map(it => it.rs)) };
}
/* v0.241, по статье «When Information Hits a Wall: Barriers in Cellular Automata» (dev.to) — «да» на «стенку в правилах»: одна клетка
   поля заморожена — не обновляется и держит своё начальное значение; сигнал на ней отражается, делится или гаснет. Столбец стенки —
   от вершины треугольника (Z.barOff: 0 — по центру, минус — влево, плюс — вправо; по умолчанию −8). Действует на заготовки
   Аниматрицы, карту ▦ 256 и достройку под чертой (Серп 90 / 30), когда нажата «стенка» (Z.barOn). */
function barOffV(){ const v = Math.round(+Z.barOff); return Number.isFinite(v) ? v : -8; }
/* v0.357, по снимку «▮ Столб | от −8» — «убери „от“, расположи 2 окна: слева 8, справа 0 — так по 2 столба можно задать»: столбов два —
   Z.barL бит влево от вершины и Z.barR бит вправо (0 — с этой стороны столба нет). Прежний один сдвиг Z.barOff переходит сам:
   минус — влево, плюс — вправо */
function barLR(){
  if (Z.barL === undefined && Z.barR === undefined) { const v = barOffV(); Z.barL = v < 0 ? -v : 0; Z.barR = v > 0 ? v : 0; }
  const f = (x) => { x = Math.round(+x); return Number.isFinite(x) ? Math.max(0, Math.min(512, x)) : 0; };
  return [f(Z.barL), f(Z.barR)];
}
function barOffs(){ const [l, r] = barLR(), o = []; if (l) o.push(-l); if (r) o.push(r); return o; }   // сдвиги столбов от вершины
function barLab(){ const [l, r] = barLR(); return [l ? "◀" + l : "", r ? r + "▶" : ""].filter(Boolean).join(" ") || "нет"; }
function barApply(next, prev){   // новая строка: клетка столбца стенки — как в строке над ней (заморожена)
  if (!Z.barOn) return next;
  for (const off of barOffs()) {   // v0.357: столбов до двух
    const kn = Math.floor((next.length - 1) / 2) + off, kp = Math.floor((prev.length - 1) / 2) + off;
    if (kn < 0 || kn >= next.length) continue;
    const v = kp >= 0 && kp < prev.length ? prev[kp] : "0";
    next = next.slice(0, kn) + v + next.slice(kn + 1);
  }
  return next;
}
function ecaRowsBar(rule, seed, H){   // как zzEcaRows (фон за краем — как делает правило), но со стенкой
  if (!Z.barOn) return zzEcaRows(rule, seed, H);
  seed = zzIsBits(seed) ? seed : "1";
  const L = seed.length, W = L + 2 * H + 2, c = H + 1, bcs = barOffs().map(o => c + Math.floor((L - 1) / 2) + o).filter(b => b >= 0 && b < W);   // v0.357: до двух столбов
  let row = new Uint8Array(W); for (let i = 0; i < L; i++) row[c + i] = seed[i] === "1" ? 1 : 0;
  const bvs = bcs.map(b => row[b]), out = [];
  for (let y = 0; y < H; y++) {
    let s = ""; for (let x = c - y; x < c + L + y; x++) s += row[x] ? "1" : "0";
    out.push(s);
    const n = new Uint8Array(W);
    for (let x = 0; x < W; x++) { const l = x ? row[x - 1] : row[0], m = row[x], r = x < W - 1 ? row[x + 1] : row[W - 1]; n[x] = (rule >> (l * 4 + m * 2 + r)) & 1; }
    bcs.forEach((b, i) => { n[b] = bvs[i]; });
    row = n;
  }
  return out;
}
function pascalRowsBar(seed, H){
  if (!Z.barOn) return zzPascalRows(seed, H);
  const r = [zzIsBits(seed) ? seed : "1"];
  while (r.length < H) { const p = r[r.length - 1]; r.push(barApply(zzPascalNext(p), p)); }
  return r;
}
const CUT_GEN_MAX = 1024;
function cutEcaNext(rule, s){
  const L = s.length, b = (x) => (x >= 0 && x < L && s[x] === "1" ? 1 : 0); let o = "";
  for (let x = -1; x <= L; x++) o += (rule >> (b(x - 1) * 4 + b(x) * 2 + b(x + 1))) & 1 ? "1" : "0";
  return o;
}
function cutGenNext(s, prev){
  const m = Z.cutGen || "r90";
  // v0.237, «при построении учитывай: если стоит Серпинский — строит не с 1, а с 11»: треугольник +1 (или строка одна) — Паскаль, +1 бит;
  // треугольник +2 — правило 90, +2 бита (как заготовки Аниматрицы)
  if (m === "r90" && (!prev || s.length - prev.length !== 2)) return barApply(zzPascalNext(s || "1"), s || "1");   // v0.241: и стенка
  if (m === "mask") { const mk = zzIsBits(Z.cutMask) ? Z.cutMask : "01"; let o = ""; for (let i = 0; i <= (s || "").length; i++) o += mk[i % mk.length]; return o; }
  return barApply(cutEcaNext(m === "r30" ? 30 : 90, s || "1"), s || "1");   // v0.241: и стенка
}
function cutAt(k, gen){
  syncLane();
  k = Math.max(1, k | 0);
  for (let l = 0; l < (Z.laneCount || 1); l++) {
    if (gen && k > Z.lanes[l].length) {   // v0.225: вниз за нижнюю — достроить от верхней
      /* v0.253, «когда под линией у строк есть биты — кнопку, чтобы их включать, когда вниз тянуть; она по умолчанию»: «⤒ из-под черты»
         (Z.cutTake, по умолчанию вкл) — черта вниз сперва возвращает строки, что лежат под ней, и только когда они кончились — достраивает. */
      const vis = Z.lanes[l].slice(); let hid = hidRows(l).slice();
      if (Z.cutTake !== false) while (vis.length < k && hid.length) vis.push(hid.shift());
      if (vis.length < k) { while (vis.length < k && vis.length < CUT_GEN_MAX) vis.push(cutGenNext(vis[vis.length - 1], vis[vis.length - 2])); }   // v0.361: «Заменить» снята — что под чертой, остаётся ниже новых
      Z.lanes[l] = vis; Z.lanesHid[l] = hid;
      continue;
    }
    const all = Z.lanes[l].concat(hidRows(l)), v = Math.max(1, Math.min(all.length, k));
    Z.lanes[l] = all.slice(0, v); Z.lanesHid[l] = all.slice(v);
  }
  Z.rows = Z.lanes[Z.lane];
  Z.cur = Math.min(Z.cur, Z.rows.length - 1);
  for (const i of [...rowSel]) if (i >= Z.rows.length) rowSel.delete(i);
}
function cutLine(){
  const n = hidCount();
  return '<div class="cutln' + (n ? " on" : "") + '" title="Граница строк — тяни вверх: строки ниже черты бесцветные, и их как будто нет — окна, конус и кнопки их не видят; вниз — вернуть. Двойной щелчок — вернуть все. ↩ отменит">' +
    '<span class="cuth">' + (n ? "⎯ за границей " + n + " стр." : "⎯ граница") + "</span></div>";
}
/* v0.324, по снимку черты под строками — «когда вниз тянуть — пусть появляется окошко, по умолчанию до следующего 2, 4, 8, 16… ближайшего,
   и можно руками набрать номер строки»: протянул черту вниз и отпустил — у черты окошко «↧ до [N] ✓ ✕». N — ближайшая степень двойки не
   меньше того, до куда дотянул (дотянул до 3 — 4, до 9 — 16; до 1024 — предел достройки). Число можно набрать своё; Enter или ✓ —
   достроить (или вернуть из-под черты, как тянул бы) до строки N, Esc или ✕ — оставить как есть. Одна точка ↩ на каждое действие. */
/* v0.338, «и вверх, и при применении строки надо удерживать на месте это окно, чтобы ещё раз нажать можно»: окошко — и после протяжки
   вверх (там по умолчанию ближайшая степень двойки снизу: дотянул до 11 — 8); Enter / ✓ перестраивает поле, а окошко остаётся открытым
   на том же месте, число снова выделено — можно набрать другое и применить ещё раз. Закрывают ✕, Esc, щелчок мимо. */
function cutAsk(k, down = true){
  let box = document.getElementById("cutAsk");
  if (!box) {
    box = document.createElement("div"); box.id = "cutAsk"; box.hidden = true;
    box.innerHTML = '<span title="До какой строки достроить поле — набери номер строки">↧ до</span><input type="number" min="1" max="' + CUT_GEN_MAX + '" step="1">' +
      '<button type="button" data-a="ok" title="Достроить до этой строки (Enter)">✓</button><button type="button" data-a="x" title="Оставить как есть (Esc)">✕</button>';
    document.body.appendChild(box);
    const inp = box.querySelector("input");
    const close = () => { box.hidden = true; removeEventListener("pointerdown", away, true); };
    const go = () => {
      const N = Math.min(CUT_GEN_MAX, Math.round(+inp.value));
      if (N >= 1 && N !== cutHeight()) { const pre = undoState(); cutAt(N, !Z.rowLock); cutMove(null, pre); rowsFit(); fieldInfoFit(); }
      /* v0.355, по снимку «↧ до 64» — «после применения показать след. цифру»: в окошке — уже следующая степень двойки в ту же сторону
         (вниз: 64 → 128, вверх: 64 → 32), Enter — и дальше; своё число набирается поверх */
      const h = cutHeight(); let q = 1;
      if (box._down) { while (q <= h) q *= 2; q = Math.min(CUT_GEN_MAX, q); } else { while (q * 2 < h) q *= 2; if (q >= h) q = h; }
      inp.value = q; inp.focus(); inp.select();   // v0.338: окошко остаётся на месте — можно ещё раз
    };
    const away = (e) => { if (!box.contains(e.target)) close(); };
    box._open = () => { addEventListener("pointerdown", away, true); };
    inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); go(); } else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); } else e.stopPropagation(); });
    box.addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; if (b.dataset.a === "ok") go(); else close(); });
  }
  let p = 1; if (down) while (p < k) p *= 2; else while (p * 2 <= k) p *= 2;   // вниз — ближайшая степень двойки сверху, вверх — снизу
  const inp = box.querySelector("input"); inp.value = Math.min(CUT_GEN_MAX, p); box._down = down;   // v0.355: куда шли — туда и следующее число
  const ln = document.querySelector("#rowList .cutln"), r = ln ? ln.getBoundingClientRect() : null;
  box.hidden = false;
  const bw = box.offsetWidth, bh = box.offsetHeight;
  const x = r ? Math.max(4, Math.min(innerWidth - bw - 4, r.left + 40)) : 40, y = r ? Math.max(4, Math.min(innerHeight - bh - 4, r.bottom + 4)) : 60;
  box.style.left = Math.round(x) + "px"; box.style.top = Math.round(y) + "px";
  box._open(); inp.focus(); inp.select();
}
/* Перенос черты на k строк (Infinity — вниз до конца): точка отмены — состояние до переноса (pre, когда черту тащат). Замок строк
   перенос не держит: биты не меняются, строки только уходят за черту и возвращаются. */
function cutMove(k, pre){
  pre = pre || undoState();
  if (k !== null) cutAt(k === Infinity ? 1e9 : k);
  let same = true;   // строк у поля всего столько же — состояние задаёт число строк за чертой
  for (let l = 0; l < (Z.laneCount || 1); l++) if (((pre.lanesHid && pre.lanesHid[l]) || []).length !== hidRows(l).length || ((pre.lanes && pre.lanes[l]) || []).length !== (Z.lanes[l] || []).length) same = false;   // v0.225: и достроенные строки
  if (same) { renderRows(); if (!hidCount()) say("⎯ Граница под нижней строкой — строк за ней нет. Тяни черту вверх, чтобы спрятать строки ниже неё."); return; }
  undoPush(pre);
  renderAll(); save();
  const n = hidCount();
  say(n ? `⎯ За границей ${n} стр. — бесцветные, и их как будто нет: окна и кнопки видят ${Z.rows.length} стр. Тяни черту вниз или двойной щелчок по ней — вернуть. ↩ отменит.` : "⎯ Все строки снова над границей.");
}
/* v0.114, «после нижней черты сделай как бы строку для заполнения из пустых ячеек по числу +1» и «одну из них заполни 1».
   Под чертой — строка пустых ячеек: на одну больше, чем в нижней строке над чертой; первая сразу «1». Щелчок по ячейке —
   пусто → 1 → 0 → пусто; «＋» у номера — строка уходит в поле под нижнюю (пустые ячейки — нулями), ↩ вернёт; под чертой
   появляется следующая, снова +1. В конусе она же — пунктирное кольцо снаружи, ячейки щёлкаются так же. Черновик запоминается;
   сменилась длина нижней строки — строка для заполнения начинается заново. */
function fillLen(){ const s = Z.rows[Z.rows.length - 1]; return (s ? s.length : 0) + 1; }
function fillDraft(){
  const L = fillLen();
  // v0.128, «все пустые строки — 0, без 1 начальной»: строка для заполнения начинается пустой (было — «1» в первой ячейке, v0.114).
  // Черновик, оставшийся от прежнего начала («1» и пусто), один раз очищается: эту «1» ставила страница, а не лазер и не рука.
  if (!Z.fillV128) { Z.fillV128 = true; if (typeof Z.fillCells === "string" && Z.fillCells === "1" + ".".repeat(L - 1)) Z.fillCells = null; }
  if (typeof Z.fillCells !== "string" || Z.fillCells.length !== L || !/^[.01]*$/.test(Z.fillCells)) Z.fillCells = ".".repeat(L);
  return Z.fillCells;
}
function fillCycle(k){
  const f = fillDraft(); if (k < 0 || k >= f.length) return;
  const nx = { ".": "1", "1": "0", "0": "." }[f[k]];
  Z.fillCells = f.slice(0, k) + nx + f.slice(k + 1);
  renderRows(); save();
}
function fillCommit(){
  const f = fillDraft(), row = f.replace(/\./g, "0"), empty = (f.match(/\./g) || []).length;
  try { snapshot(); } catch (err) { if (err.message === "ZZ_LOCK") return; throw err; }
  Z.rows.push(row); Z.cur = Z.rows.length - 1; Z.fillCells = null;
  renderAll(); save();
  say(`＋ Строка ${Z.rows.length} (${row.length} бит) — в поле${empty ? `, пустые ячейки (${empty}) — нулями` : ""}. Под чертой — следующая, ${fillLen()} ячеек. ↩ вернёт.`);
}
/* v0.118, «как удалить нижнюю строку — пустую — и заново»: «✕» у номера строки для заполнения (или правый щелчок по её кольцу
   в конусе) — черновик стирается, строка снова пустая (v0.128: без «1» в первой ячейке). Строки поля не трогает. */
function fillReset(){
  const f = fillDraft(), was = f.replace(/\./g, "").length, hv = Z.voidHits && Z.voidHits.h ? Object.keys(Z.voidHits.h).length : 0;
  Z.fillCells = null; if (Z.voidHits) { Z.voidHits.h = {}; coneLaserResetAll(); } renderRows(); save();   // v0.138: и остановленные кольца снова крутятся   // v0.127: и счёт проходов в пустых кольцах
  say(was || hv ? `✕ Строка для заполнения — заново: ${fillLen()} пустых ячеек` + (hv ? `; пустые кольца до 256 — тоже без меток (было ${hv}).` : ".") : "✕ Строка для заполнения и так пустая.");   // v0.128: без начальной «1»
}
function fillRowHtml(N){
  const f = fillDraft(); let c = "";
  for (let k = 0; k < f.length; k++) c += '<span class="fc' + (f[k] === "." ? " fe" : " b" + f[k]) + '" data-k="' + k + '">' + (f[k] === "." ? "&nbsp;" : f[k]) + "</span>";
  let h = '<div class="rw fillrw"><span class="no" title="Строка для заполнения — ' + f.length + ' ячеек, на одну больше нижней строки"><span class="rn"><b>' + (Z.rows.length + 1) + '</b><span class="fctl"><span class="fadd" title="＋ В строки: встанет под нижней строкой (пустые ячейки — нулями), ↩ вернёт">＋</span><span class="fdel" title="✕ Заново: стереть строку для заполнения — снова все ячейки пустые, и метки лазера в пустых кольцах тоже стираются. В конусе — правый щелчок по её кольцу">✕</span></span></span><span></span><span></span></span>';   // v0.224: ＋ ✕ — мелко под номером
  for (let l = 0; l < N; l++) h += '<span class="bits' + (l === Z.lane ? " la" : "") + '" data-l="' + l + '">' + (l === Z.lane ? '<span class="fcs" title="Щелчок по ячейке: пусто → 1 → 0 → пусто. ＋ слева — в строки">' + c + "</span>" : "") + "</span>";
  return h + "</div>";
}
function hidRowHtml(i, cells){ return '<div class="rw hid" data-h="' + i + '"><span class="no" title="за границей — строки как будто нет"><span class="rn">' + (i + 1) + "</span><span></span><span></span></span>" + cells + "</div>"; }
/* v0.153, «в строках уменьши межстрочный отступ до 0.7 минимум, когда не все строки помещаются по высоте»: после отрисовки поле
   меряется; влезают — межстрочный обычный (1.25), нет — сжимается ровно настолько, чтобы влезли, но не ниже 0.7 (дальше — прокрутка).
   Ужатое поле (.rlsq) держит и колонку номеров в высоту строки, иначе замок 🔒 не дал бы строке стать ниже. */
const RL_MAX = 1.25, RL_MIN = 0.7;
function rowsFit(){
  // v0.265: пока тянут черту — шаг строк прежний, даже размер поля не меряем (каждый замер — полная раскладка); подгонка — когда отпустят
  if ((document.body.classList.contains("cutdrag") || document.body.classList.contains("wdrag")) && $("rowList") && $("rowList").style.getPropertyValue("--rlh")) return;   // v0.269: и пока тянут ширину поля
  const L = $("rowList"); if (!L || !L.clientHeight) return;
  const was = L.style.getPropertyValue("--rlh");
  /* v0.246, «почему всё тормозит»: каждая подгонка — 4–5 полных раскладок поля (на 260 строках — по 0,1 с). Строк, шрифта и размера
     поля столько же, сколько в прошлый раз, и всё помещается — шаг строки прежний, раскладка одна. */
  const n = L.querySelectorAll(".rw:not(.lhrow)").length, fs = Z.fs || 16;
  /* v0.280, «граница — всё равно тормоза»: ширину из ключа убрали — строки не переносятся (white-space:pre), высота поля от ширины не
     зависит; полоса прокрутки вбок меняет clientHeight, он в ключе. Прежде каждое отпускание границы — 4–5 раскладок поля (0,13 с на 66 строках). */
  const base = [fs, Z.ff, Z.laneCount, L.clientHeight].join("|"), key = n + "|" + base;
  if (rowsFit.key === key && (+was && +was <= RL_MIN + 1e-6 || L.scrollHeight <= L.clientHeight + 1)) return;   // и когда ужато до предела — теснее всё равно некуда
  /* v0.265, «зависание у границы перетаскивания строк поля»: пока тянут черту, строк на каждом шаге другое число — и подгонка каждый
     раз заново раскладывала поле 4–5 раз (на 400 строках — 0,6 с на шаг). Теперь: пока черту тянут — шаг строк прежний (подгонка —
     когда отпустят); строк стало больше, а шаг и так самый тесный — тоже прежний, без раскладок. */
  if (rowsFit.base === base && +was && +was <= RL_MIN + 1e-6 && n >= (rowsFit.n || 0)) { rowsFit.key = key; rowsFit.n = n; return; }
  rowsFit.key = key; rowsFit.base = base; rowsFit.n = n;
  L.classList.remove("rlsq"); L.style.removeProperty("--rlh");
  if (L.scrollHeight <= L.clientHeight + 1) { if (was) rowsFitDone(); return; }
  if (!n) return;
  L.classList.add("rlsq");
  let rl = RL_MAX;
  for (let k = 0; k < 3; k++) {   // шаг строки округляется до пикселя — две-три поправки
    const over = L.scrollHeight - L.clientHeight; if (over <= 0) break;
    const nx = Math.max(RL_MIN, rl - over / n / fs - (k ? 0.5 / fs : 0));
    if (nx >= rl) break;
    rl = nx; L.style.setProperty("--rlh", rl.toFixed(3));
    if (rl <= RL_MIN) break;
  }
  if (L.style.getPropertyValue("--rlh") !== was) rowsFitDone();
}
function wShield(on){   // v0.280: накладка с курсором ↔ на время протяжки границы (вместо курсора у каждого элемента страницы)
  let s = document.getElementById("wShield");
  if (on && !s) { s = document.createElement("div"); s.id = "wShield"; document.body.appendChild(s); } else if (!on && s) s.remove();
}
function rowsFitDone(){ if (Z.tri90) tri90Apply(); }   // ◸ 90° считает межсимвольный от шага строк
/* v0.167, «надпись вправо, над замками — центральный замок (общий)»: над столбиком замков у строк — общий замок колец (галка «запрет
   сдвига строк» в «Кольцах»): щелчок — как по галке. Место по горизонтали — по замку первой строки (столбик номера стоит на месте
   при прокрутке вбок, а ширина его колонок в em — и мельчает в ужатом поле). */
/* v0.209, по снимку «i3 стр. · 934 бит…» (начало сведений ушло под колонку номеров и замков) — «подвинь надпись»: сведения не заходят
   под левую колонку — начинаются сразу за ней, не влезли — многоточие в конце (целиком — в подсказке). */
function fieldInfoFit(){
  if (document.body.classList.contains("cutdrag") || document.body.classList.contains("wdrag")) return;   // v0.269: и ширину поля; v0.265: пока тянут черту — кнопки над столбиками не двигаем (замер — раскладка поля); поставятся, когда отпустят
  const fi = $("fieldInfo"), bar = $("fieldInfoBar"); if (!fi || !bar) return;
  const no = document.querySelector("#rowList .rw > .no"), w = no ? no.getBoundingClientRect().right - bar.getBoundingClientRect().left : 90;
  const setMW = (el, v) => { if (el.style.maxWidth !== v) el.style.maxWidth = v; };   // v0.246: то же значение — не трогать (иначе лишняя раскладка всего поля)
  setMW(fi, (fi.parentNode && fi.parentNode.id === "infoSlot" ? Math.max(40, ($("rowList").clientWidth || 200) - 16) : Math.max(40, Math.round(bar.clientWidth - Math.max(0, w) - 14 - 6))) + "px");   // v0.237: под строками — во всю ширину поля
  if (CUT_PANEL && $("rowList")) setMW(CUT_PANEL, Math.max(60, $("rowList").clientWidth - 12) + "px");   // v0.230: кнопки под чертой — в ширину видимого поля, с переносом
  /* v0.212, «запрет сдвига строк — не дубль замка?» → «да (убрать), но общий замок всегда над столбиком должен стоять»: галки в «Кольцах»
     не видно (она осталась скрытой — на ней держится общий замок), а общий замок в полосе ввода сдвигается так, что его середина —
     ровно над столбиком замков строк. */
  /* v0.212, «а над номерами — сброс строк, кнопку на начальные»: «↺» (жмёт «↺ Начальные») — над колонкой номеров, общий замок — над
     столбиком замков; сначала левая, потом правая (её место зависит от левой). */
  const nr = document.querySelector("#rowList .rw:not(.hid):not(.fillrw) > .no");
  const over = (B, cell) => {
    if (!B || !cell) return;
    // v0.246: без сброса в 0 — поправка к нынешнему сдвигу; то же значение не пишется (каждая запись — ещё одна раскладка поля)
    const a = B.getBoundingClientRect(), k = cell.getBoundingClientRect(), m0 = parseFloat(B.style.marginLeft) || 0;
    if (!k.width) return;
    const v = Math.round(m0 + (k.left + k.width / 2) - (a.left + a.width / 2)) + "px";   // и влево — в отступ полосы
    if (B.style.marginLeft !== v) B.style.marginLeft = v;
  };
  if (nr) { over($("bRowsStartTop"), nr.querySelector(".rn")); over($("coneLockAll"), nr.querySelector(".rlk")); over($("bConeAllHome"), nr.querySelector(".rrot")); }   // v0.214: и ⟲ — над кручениями
}
function rowsLockAllPlace(){   // v0.169: общий замок — кнопкой в начале полосы ввода; здесь только его значок
  const A = $("coneLockAll"); if (!A) return;
  const on = Z.coneLock !== false; A.textContent = ""; A.classList.toggle("off", !on);   // v0.382: значок — полоска из CSS, как у строк
}
/* v0.173, на вопрос о правиле «биты на конусе ↔ строки» — «покажи бит, щелчок с Ctrl — смена бита». В плоском конусе бит под мышью
   обведён золотом, и тот же бит подсвечен в его строке в поле (Highlight API — без перерисовки строк); Ctrl + щелчок по сектору
   меняет этот бит 0 ↔ 1 в самой строке (↩ вернёт; замок строк ⛔ не пускает). Бит — по углу с учётом поворота всего конуса и кольца. */
let coneBitHover = null;
function coneBitAt(e){
  if (Z.cone3d || !coneGeom) return null;
  const h = coneRing(e); if (h === -1 || h.fill !== undefined) return null;
  const s = Z.rows[h.i], n = s && s.length; if (!n) return null;
  const step = 2 * Math.PI / n, t = h.a - (Z.coneSpin || 0) * Math.PI / 180, u = (((t + Math.PI / 2) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  return { i: h.i, j: ((Math.floor(u / step + coneRotOf(h.i)) % n) + n) % n };
}
function rowBitMark(){
  if (!window.CSS || !CSS.highlights || typeof Highlight === "undefined") return;
  CSS.highlights.delete("conebit");
  const b = coneBitHover; if (!b) return;
  const bx = $("rowList").querySelector('.rw[data-r="' + b.i + '"] .bx'); if (!bx) return;
  const w = document.createTreeWalker(bx, NodeFilter.SHOW_TEXT); let k = 0, nd;
  while ((nd = w.nextNode())) {
    const t = nd.textContent;
    for (let q = 0; q < t.length; q++) if (t[q] === "0" || t[q] === "1") {
      if (k === b.j) { const r = document.createRange(); r.setStart(nd, q); r.setEnd(nd, q + 1); CSS.highlights.set("conebit", new Highlight(r)); return; }
      k++;
    }
  }
}
function coneBitFlip(b){
  const s = Z.rows[b.i]; if (!s || b.j >= s.length) return;
  try { snapshot(); } catch (err) { if (err.message === "ZZ_LOCK") return; throw err; }
  const v = s[b.j] === "1" ? "0" : "1";
  Z.rows[b.i] = s.slice(0, b.j) + v + s.slice(b.j + 1); syncLane();
  renderAll(); save(); say(`◯ Строка ${b.i + 1}, бит ${b.j + 1}: ${s[b.j]} → ${v} — и в поле строк. ↩ вернёт.`);
}
/* v0.276, по снимку списка «1 поле … 4 поля» — «здесь ＋ создать (поле), и показывать только, если создано 1, 2, 3 поля»: в списке —
   только поля, что есть (1 … сколько сейчас), и «＋ создать поле», пока их меньше 4 */
function laneCountUi(){
  const s = document.getElementById("laneCount"); if (!s) return;
  const n = Math.max(1, Math.min(4, Z.laneCount | 0 || 1));
  if (s.dataset.n !== String(n)) {
    let h = ""; for (let k = 1; k <= n; k++) h += `<option value="${k}">${k} ${k === 1 ? "поле" : "поля"}</option>`;
    if (n < 4) h += '<option value="new">＋ создать поле</option>';
    s.innerHTML = h; s.dataset.n = String(n);
  }
  s.value = String(n);
}
function renderRows(){
  if (rowEditing >= 0) return;
  syncLane();
  laneCountUi();   // v0.276
  if (typeof renderCone === "function") { clearTimeout(renderRows._cone); renderRows._cone = setTimeout(renderCone, 0); }   // v0.076: выделение в поле — и в конусе
  if (ovControls()) { renderRowsOver(); return; }   // v0.018
  const L = $("rowList"), N = Z.laneCount || 1, qv = Z.bitView === "sq" || Z.bitView === "rh";
  L.className = "al-" + (Z.rowsAlign || "center") + (N > 1 ? " multi" : "") + (qv ? " vq" : "") + (Z.bitView === "sq" ? " vsq" : "") + ["rlsq", "tri90", "rnhov"].map(c => L.classList.contains(c) ? " " + c : "").join("");
  const qrh = (i) => {   // v0.456: ромбы — строке, чья длина отличается от соседней на нечётное (ряды сдвинуты на полсимвола)
    if (Z.bitView !== "rh" || (Z.rowsAlign || "center") !== "center" || Z.rows[i] === undefined) return false;
    const n = Z.rows[i].length, odd = (j) => Z.rows[j] !== undefined && Math.abs(Z.rows[j].length - n) % 2 === 1;
    return odd(i - 1) || odd(i + 1);
  };   // v0.246: ужатость, 90° и подсветка номеров — не сбрасывать
  L.style.setProperty("--lanes", N);
  const lanes = []; for (let l = 0; l < N; l++) lanes.push(l === Z.lane ? Z.rows : Z.lanes[l]);
  const H = Math.max(...lanes.map(x => x.length));
  let h = '<div class="rl-inner">';
  // v0.015: заголовки полей — только когда их больше одного.
  if (N > 1) {
    h += '<div class="rw lhrow"><span class="no"></span>';
    for (let l = 0; l < N; l++)
      h += '<span class="lh' + (l === Z.lane ? " act" : "") + '" data-l="' + l + '" title="Поле ' + (l + 1) + (l === Z.lane ? " — рабочее" : " — щелчок: сделать рабочим") + '">поле ' + (l + 1) + " · " + lanes[l].length + " стр." +
        '<span class="lhx" data-lx="' + l + '" title="✕ Удалить поле ' + (l + 1) + ' со всеми строками (↩ вернёт)">✕</span></span>';   // v0.247
    h += "</div>";
  }
  for (let i = 0; i < H; i++) {
    h += '<div class="rw' + (i === Z.cur ? " cur" : "") + (rowSel.has(i) ? " sel" : "") + (qrh(i) ? " qrh" : "") + '" data-r="' + i + '"><span class="no' + (rowChanged(i) ? " chg" : "") + '" title="строка ' + (i + 1) + (rowChanged(i) ? " — изменена против эталона ⚑" : "") + ' · щелчок — выделить">' + '<span class="rn">' + (i + 1) + '</span>' + rowLockBadge(i) + rowCounts(Z.rows[i]) + "</span>";
    for (let l = 0; l < N; l++) {
      const s = lanes[l][i], act = l === Z.lane;
      if (s === undefined) { h += '<span class="bits' + (act ? " la" : "") + '" data-l="' + l + '"></span>'; continue; }
      // v0.012: биты — в своём .bx (только 0 и 1: по нему считаются места выделенных символов), «ещё N бит» — снаружи.
      // v0.015: .bx — только у рабочего поля; выделение и Del работают с ним.
      h += '<span class="bits' + (act ? " la" : "") + '" data-l="' + l + '" title="' + (N > 1 ? "поле " + (l + 1) + ", " : "") + "строка " + i + ", " + s.length + ' бит · щелчок по биту — выделить, протяжка — выделить строки, F2 / Enter — править">' +
           '<span class="' + (act ? "bx" : "bxo") + '">' + (qv ? bitsCells(s) : bitsShow(s)) + "</span>" +
           (s.length > ROW_SHOW ? '<span class="more"> … ещё ' + (s.length - ROW_SHOW) + " бит</span>" : "") + "</span>";
    }
    h += "</div>";
  }
  // v0.112: черта-граница под нижней строкой, под ней — строки за границей, бесцветные
  h += '<div id="infoSlot"></div>' + cutLine() + fillRowHtml(N) + '<div id="cutSlot"></div>';   // v0.237: сведения — под последней строкой
  //   // v0.114: сразу под чертой — строка для заполнения; v0.225: под ней — кнопки достройки и шаблоны
  let HH = 0; for (let l = 0; l < N; l++) HH = Math.max(HH, hidRows(l).length);
  for (let j = 0; j < HH; j++) {
    let t = "";
    for (let l = 0; l < N; l++) {
      const s = hidRows(l)[j];
      t += '<span class="bits' + (l === Z.lane ? " la" : "") + '" data-l="' + l + '">' + (s === undefined ? "" : '<span class="bxh">' + (s.length > ROW_SHOW ? s.slice(0, ROW_SHOW) : s) + "</span>" +
           (s.length > ROW_SHOW ? '<span class="more"> … ещё ' + (s.length - ROW_SHOW) + " бит</span>" : "")) + "</span>";
    }
    h += hidRowHtml(H + j, t);
  }
  L.innerHTML = h + "</div>"; cutPanelMount();   // v0.225
  const tot = Z.rows.reduce((a, s) => a + s.length, 0);
  $("fieldInfo").textContent = (N > 1 ? `поле ${Z.lane + 1} из ${N} · ` : "") + `${Z.rows.length} стр. · ${tot} бит · текущая ${Z.cur + 1} (${cur().length} бит)` + (hidCount() ? ` · за границей ${hidCount()} стр.` : "") + rowMetr() + rowChgInfo();
  $("fieldInfo").title = $("fieldInfo").textContent + ROW_METR_TIP;   // v0.077: целиком — в подсказке
  fieldInfoFit();   // v0.209
  $("rowList").classList.toggle("dimsel", rowSel.size > 0); $("rowList").classList.toggle("dimcur", !rowSel.size && !document.body.classList.contains("nocur"));   // v0.213 / v0.221: выделение (или выбранная строка) — остальные строки гаснут
  rowsFit(); rowsLockAllPlace(); rowBitMark(); wallMark();   // v0.153, v0.167, v0.173; v0.347 — стенка
  if (qv) {   // v0.456: размеры фигур — символ и шаг рядов, как их поставил rowsFit
    const q = L.querySelector(".rw[data-r] i.q"), rw = L.querySelectorAll(".rl-inner > .rw[data-r] > .bits");
    if (q) L.style.setProperty("--qw", q.getBoundingClientRect().width.toFixed(2) + "px");
    if (q && Z.bitView === "sq") L.style.setProperty("--qsq", q.getBoundingClientRect().width.toFixed(2) + "px");   // v0.458: шаг рядов = ширина символа — ячейка квадратная
    if (rw.length > 1) L.style.setProperty("--qh", (rw[1].getBoundingClientRect().top - rw[0].getBoundingClientRect().top).toFixed(2) + "px");
  }
  // v0.242, «черту тяну вниз — прыгает всё вверх»: пока черту тащат, поле не прокручивается к текущей строке
  if (document.body.classList.contains("cutdrag")) return;
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
/* v0.347, по снимку выделенных бит — «выделенные биты кнопку Стенка помечает и морозит»: 🧱 стенка — выделенные мышью биты рабочего поля
   помечаются (кирпичным фоном в строках) и замораживаются: волна Аниматрицы их не переписывает, они держат своё значение, а соседи
   считаются от них как обычно. Z.walls { строка: [[a, b), …] } — отрезки бит, слитые и по порядку; помнится и едет в «💾 Всё». */
function wallRows(){ if (!Z.walls || typeof Z.walls !== "object" || Array.isArray(Z.walls)) Z.walls = {}; return Z.walls; }
function wallNorm(list){ const a = list.filter(p => p[1] > p[0]).sort((x, y) => x[0] - y[0]), o = [];
  for (const [x, y] of a) { const t = o[o.length - 1]; if (t && x <= t[1]) t[1] = Math.max(t[1], y); else o.push([x, y]); } return o; }
function wallCovers(r, a, b){ const w = Z.walls && Z.walls[r]; return !!w && w.some(([x, y]) => x <= a && y >= b); }
function wallMask(r, n){   // замороженные биты строки r длины n — массив 0/1 или null
  const w = Z.walls && Z.walls[r]; if (!w || !w.length) return null;
  const m = new Uint8Array(n); for (const [x, y] of w) for (let j = Math.max(0, x); j < Math.min(n, y); j++) m[j] = 1; return m;
}
function wallCount(){ let c = 0; for (const k in (Z.walls || {})) for (const [x, y] of Z.walls[k]) c += y - x; return c; }
function wallHits(r, a, b){ const w = Z.walls && Z.walls[r]; return !!w && w.some(([x, y]) => x < b && y > a); }   // v0.363: задевает ли отрезок замороженное
function wallToggle(parts){   // v0.363: выделение задевает замороженное — разморозить выделенное; иначе — заморозить (прежде снимало, только если целиком внутри)
  const W = wallRows(), off = parts.some(p => wallHits(p.i, p.a, p.b));
  for (const p of parts) {
    const cur = W[p.i] || [];
    if (!off) W[p.i] = wallNorm(cur.concat([[p.a, p.b]]));
    else { const o = []; for (const [x, y] of cur) { if (y <= p.a || x >= p.b) o.push([x, y]); else { if (x < p.a) o.push([x, p.a]); if (y > p.b) o.push([p.b, y]); } } W[p.i] = o; }
    if (!W[p.i].length) delete W[p.i];
  }
  return !off;
}
function wallMark(){   // подсветка стенки в строках (Highlight API — строки не перерисовываются)
  if (!window.CSS || !CSS.highlights || typeof Highlight === "undefined") return;
  const L = $("rowList"), rs = [], W = Z.fzShow === false ? {} : (Z.walls || {});   // v0.353: 👁 вид выключен — не показывать
  for (const k in W) {
    const bx = L && L.querySelector('.rw[data-r="' + k + '"] .bx'); if (!bx) continue;
    const at = (j) => { const w = document.createTreeWalker(bx, NodeFilter.SHOW_TEXT); let c = 0, nd, last = null;
      while ((nd = w.nextNode())) { const n = nd.textContent.length; last = nd; if (c + n > j) return [nd, j - c]; c += n; }
      return last ? [last, last.textContent.length] : null; };
    for (const [x, y] of W[k]) { const p = at(x), q = at(y); if (!p || !q) continue; const rg = document.createRange(); try { rg.setStart(p[0], p[1]); rg.setEnd(q[0], q[1]); if (!rg.collapsed) rs.push(rg); } catch (e) { /* строка короче стенки */ } }
  }
  if (rs.length) CSS.highlights.set("zwall", new Highlight(...rs)); else CSS.highlights.delete("zwall");
  // v0.353: ▮ Столб — клетка floor((длина − 1) / 2) + сдвиг в каждой строке (там, где её держит построение по правилу)
  const rb = [];
  if (Z.barOn && Z.fzShow !== false && L) {
    const offs = barOffs();   // v0.357: до двух столбов
    L.querySelectorAll(".rw[data-r] .bx").forEach((bx) => {
      const r = +bx.closest(".rw").dataset.r, s = Z.rows[r]; if (!s) return;
      for (const off of offs) {
        const j = Math.floor((s.length - 1) / 2) + off; if (j < 0 || j >= s.length) continue;
        const w = document.createTreeWalker(bx, NodeFilter.SHOW_TEXT); let c = 0, nd;
        while ((nd = w.nextNode())) { const n = nd.textContent.length; if (c + n > j) { const rg = document.createRange(); rg.setStart(nd, j - c); rg.setEnd(nd, j - c + 1); rb.push(rg); break; } c += n; }
      }
    });
  }
  if (rb.length) CSS.highlights.set("zbar", new Highlight(...rb)); else CSS.highlights.delete("zbar");
}
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
    say("Del: ниже строк больше нет — вверх Del не удаляет. Удалить эту строку — щелчок по ней и Del.");   // v0.306: «✕ Удалить» снята
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
  if (rowsLocked()) return;   // v0.061
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
      else if (v !== Z.rows[i]) { snapshot(); Z.rows[i] = v; say(`Строка ${i + 1} исправлена: ${v.length} бит. ↩ вернёт.`); }
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
  { name: "🔺 Серп. ×16", title: "16 строк треугольника Паскаля по модулю 2 от «1»", rows: () => { const r = ["1"]; while (r.length < 16) r.push(zzPascalNext(r[r.length - 1])); return r; } },
  { name: "⇉ Туэ–Морс", title: "0110100110010110… — 1→10, 0→01, пять раз от «0»", rows: () => [zzThueMorse(32)] },
  { name: "🔢 0…15", title: "Номера 0…15 по 4 бита", rows: () => Array.from({ length: 16 }, (_, i) => i.toString(2).padStart(4, "0")) },
  { name: "🪞 Палиндр.", title: "Случайная половина + её отражение ⇄", rows: () => { const h = randomBits(8); return [h + zzRev(h)]; } },
  { name: "🔁 Антипал.", title: "Случайная половина + её инв-отражение ⇄🔁", rows: () => { const h = randomBits(8); return [h + zzInvRev(h)]; } },
  { name: "〰 0101…", title: "Период 2", rows: () => ["01".repeat(8)] },
  { name: "⚠ Сбой 011…", title: "Почти периодическая с одним сбоем — пример к ⇅ Сортировке сдвигов", rows: () => ["011011011011010011"] },
  { name: "🎲 Случ.", title: "Случайная строка длиной как текущая (нет строк — 16 бит)", rows: () => [randomBits(cur().length || 16)] },   // v0.308: как снятая кнопка «🎲 Случ.»
];
function tplInsert(rows, name){
  if (!rows || !rows.length) return;
  snapshot();
  Z.rows.splice(Z.cur + 1, 0, ...rows);
  Z.cur += rows.length;
  renderAll(); save();
  say(`Шаблон «${name}»: ${rows.length === 1 ? "строка " + rows[0].length + " бит" : rows.length + " стр."} под текущей. ↩ вернёт.`);
}
/* v0.066, по снимку своего шаблона «Столбик · 70 стр.»: «при клике заменять текущие, а не достраивать вниз». Свой шаблон
   щелчком ЗАМЕНЯЕТ: столбик — весь столбик, строка — текущую строку. Shift + щелчок — как раньше, вставить под текущей. */
function tplReplace(rows, name){
  if (!rows || !rows.length) return;
  snapshot();
  if (rows.length > 1) { Z.rows = rows; syncLane(); Z.cur = Math.min(Z.cur, rows.length - 1); }
  else Z.rows[Z.cur] = rows[0];
  renderAll(); save();
  say(`Шаблон «${name}»: ${rows.length > 1 ? "столбик заменён — " + rows.length + " стр." : "строка " + Z.cur + " заменена"}. Shift + щелчок — вставить под текущей. ↩ вернёт.`);
}
function renderTpl(){
  let h = "";
  TPL_BUILTIN.forEach((t, k) => {
    h += '<div class="tpl"><button class="tb" data-b="' + k + '" title="' + esc(t.title) + '">' + esc(t.name) + "</button></div>";
  });
  $("tplList").innerHTML = h; h = "";   // v0.296: под чертой — только встроенные; свои — в шапке (#tplMine)
  Z.tpl.forEach((t, k) => {
    const tip = t.rows.length === 1 ? t.rows[0].slice(0, 200) : t.rows.length + " стр.: " + t.rows.slice(0, 6).map(r => r.slice(0, 40)).join(" / ");
    // v0.301: текущий шаблон (Z.tplRef) — жёлтым; ⚑ и 💾 у шаблона сняты — в текущий пишет «💾 Сохр»
    h += '<div class="tpl mine' + (Z.tplRef === k ? " cur" : "") + '"><button class="tb" data-u="' + k + '" title="' + esc(tip) + (Z.tplRef === k ? ' · ТЕКУЩИЙ: с ним сравниваются строки (номера изменённых — золотом), в него пишет «💾 Сохр»' : "") + ' · щелчок — загрузить в поле и сделать текущим, Shift + щелчок — вставить под текущей строкой · двойной щелчок — переименовать">' + esc(t.name) + "</button>" +
         '<button class="tx" data-x="' + k + '" title="Удалить этот шаблон">✕</button></div>';
  });
  $("tplMine").innerHTML = h;
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
  $("descentHead").textContent = `строка ${Z.cur + 1} · ${n} бит`;
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
    `${r.lab}, t = ${t}, строка ${Z.cur + 1} (${r.n} бит).\n` +
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
/* v0.045, запрос пользователя по снимку «Цикла и памяти»: «это тоже живое изменение, вообще всё живым надо сделать».
   Каждое окно-расчёт считает само при отрисовке, если открыто, — но только когда изменилось то, от чего оно зависит
   (ключ: строка, её номер, настройки окна, для ленточных — весь столбик). Иначе любое действие на странице гоняло бы
   все расчёты заново. Кнопки остались — пересчитать вручную. Тяжёлое на длинных строках — по кнопке. */
const liveKeys = {};
function winOpen(id){ const w = $(id); return !!w && !w.classList.contains("collapsed") && w.style.display !== "none"; }
function liveRun(id, key, fn){ if (!winOpen(id) || liveKeys[id] === key) return; liveKeys[id] = key; fn(); }
function renderLinLive(){
  liveRun("w-lin", Z.linSrc + "|" + (Z.linSrc === "all" ? Z.rows.join("|") : cur()), runLin);
}
function renderLiveRest(){
  const s = cur(), rk = Z.rows.join("|");
  liveRun("w-cycle", Z.cycOp + "|" + Z.cycHeat + "|" + s, runCycle);
  liveRun("w-gf2", Z.gf2Op + "|" + Z.gf2T + "|" + Z.cur + "|" + s, () => {
    if (s.length <= 256) runGf2();
    else { gf2Last = null; $("gf2Out").textContent = `Строка ${s.length} бит — сама не считаю: алгебра матриц ${s.length}×${s.length} тяжела на каждый щелчок. «🧮 Решить» — по кнопке.`; }
  });
  liveRun("w-tape", (Z.tapeMode || "thru") + "|" + Z.thruMode + "|" + rk, Z.tapeMode === "decim" ? runDecim : runThru);
  liveRun("w-orbit", Z.cur + "|" + $("orbitSub").checked + "|" + rk, runOrbit);
  liveRun("w-bwt", Z.cur + "|" + s, () => {
    if (s.length <= 4096) runBwt(true);
    else $("bwtOut").textContent = `Строка ${s.length} бит — сортировку сдвигов делаю только по кнопке «⇅».`;
  });
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

/* ─── ⚖ Балансы (v0.050) ───────────────────────────────────────────────────────────────────────
   Запрос пользователя: «окно, где каждой строке вживую будет сопоставляться баланс, общий баланс до текущей строки
   по всем; также и по числу неменяющихся с общим; и также неменяющиеся лентой до текущей». Для каждой строки:
   нулей : единиц и перевес (1 − 0); то же нарастающим итогом от строки 0 до неё; неподвижные при развороте биты
   (· меняющиеся) и их нарастающий итог; и неподвижные у ЛЕНТЫ — строк 0…i, выписанных подряд одной строкой и
   развёрнутых целиком. Лента считается до 400 строк или 200 000 бит — дальше «—». */
const BAL_ROWS = 400, BAL_TAPE = 200000;
function renderBal(){
  liveRun("w-bal", Z.cur + "|" + Z.rows.join("|"), () => {
    let z = 0, o = 0, fxs = 0, tape = "", h = "", curTxt = "";
    const N = Z.rows.length;
    for (let i = 0; i < N; i++) {
      const s = Z.rows[i], n = s.length, k = zzOnes(s);
      let fx = 0; for (let j = 0; j < n; j++) if (s[j] === s[n - 1 - j]) fx++;
      z += n - k; o += k; fxs += fx;
      let tfx = null;
      if (i < BAL_ROWS && tape.length + n <= BAL_TAPE) { tape += s; const L = tape.length; tfx = 0; for (let j = 0; j < L; j++) if (tape[j] === tape[L - 1 - j]) tfx++; }
      const sg = (x) => (x > 0 ? "+" : x < 0 ? "−" : "") + Math.abs(x);
      if (i === Z.cur) curTxt = `Строка ${i + 1}: ${n - k}:${k} (перевес ${sg(k - (n - k))}); до неё всего ${z}:${o} (${sg(o - z)}); ` +
        `неподвижных ${fx} из ${n}, до неё всего ${fxs} из ${z + o}` + (tfx !== null ? `; лентой 0…${i} (${tape.length} бит) неподвижных ${tfx}` : "") + ".";
      if (i < BAL_ROWS) h += `<tr data-r="${i}"${i === Z.cur ? ' class="cur"' : ""}><td class="n">${i + 1}</td><td class="n">${n}</td>` +
        `<td class="n"><span class="b0">${n - k}</span>:<span class="b1">${k}</span></td><td class="n">${sg(k - (n - k))}</td>` +
        `<td class="n"><span class="b0">${z}</span>:<span class="b1">${o}</span></td><td class="n">${sg(o - z)}</td>` +
        `<td class="n"><span class="rcf">${fx}</span>·<span class="rcm">${n - fx}</span></td><td class="n">${fxs}</td>` +
        `<td class="n">${tfx === null ? "—" : `<span class="rcf">${tfx}</span>·<span class="rcm">${tape.length - tfx}</span>`}</td></tr>`;
    }
    $("balOut").textContent = curTxt;
    $("balTbl").innerHTML = '<table class="btbl"><thead><tr><th>№</th><th>бит</th><th title="нулей : единиц в строке">0:1</th><th title="единиц минус нулей">±</th>' +
      '<th title="нулей : единиц — всего от строки 0 до этой">Σ 0:1</th><th title="перевес нарастающим итогом">Σ ±</th>' +
      '<th title="неподвижных при развороте · меняющихся">неподв.</th><th title="неподвижных — всего от строки 0 до этой">Σ неподв.</th>' +
      '<th title="строки 0…этой, выписанные подряд одной лентой и развёрнутые целиком: неподвижных · меняющихся">лентой</th></tr></thead><tbody>' + h + "</tbody></table>" +
      (N > BAL_ROWS ? `<div class="dim">… ещё ${N - BAL_ROWS} строк — итоги наверху считаются по всем</div>` : "");
    const tr = $("balTbl").querySelector("tr.cur");
    if (tr) { const box = $("balTbl"), top = tr.offsetTop - box.clientHeight / 2; if (tr.offsetTop < box.scrollTop + 24 || tr.offsetTop > box.scrollTop + box.clientHeight - 24) box.scrollTop = Math.max(0, top); }
  });
}

/* ─── △ Разложить на ▲ ▼ ◇ (v0.070) ─────────────────────────────────────────────────────────────
   Таблица по размерам (2…64 и степени двойки до высоты треугольника): сколько ▲, ▼, ◇ и сколько среди них разных
   рисунков (и форм — с точностью до зеркала). Щелчок по размеру — ниже галерея разных фигур этого размера, самые частые
   первыми, с числом повторов. Живое: строки поменялись — пересчитано. */
const TILES_GAL = 60;
function tilesFig(rows, S){
  // фигура как в поле: строки по центру, бит через пробел — полшага на строку
  return rows.map(r => " ".repeat(Math.max(0, S - r.length)) + r.split("").map(c => '<span class="b' + c + '">' + c + "</span>").join(" ")).join("\n");
}
function renderTiles(){
  const src = rowSel.size >= 2 ? Array.from(rowSel).sort((a, b) => a - b) : Z.rows.map((_, i) => i);
  liveRun("w-tiles", (Z.tilesS || 0) + "|" + (Z.tilesKind || "rh") + "|" + src.join(",") + "|" + src.map(i => Z.rows[i]).join("|"), () => {
    const rows = src.map(i => Z.rows[i]), blk = zzTriBlock(rows);
    if (!blk.ok) {
      $("tilesOut").innerHTML = rows.length < 2 ? "Нужен треугольник — хотя бы две строки." :
        `Это не треугольник: у строки ${src[blk.at] + 1} длина ${rows[blk.at].length}, а должна быть на 1 больше предыдущей (${rows[blk.at - 1].length + 1}). ` +
        "Выдели строки треугольника (щелчок по номеру, Shift — диапазон) или построй его: «△ Треугольник из строки».";
      $("tilesTbl").innerHTML = ""; $("tilesGal").innerHTML = ""; return;
    }
    const H = rows[0].length - 1 + rows.length, sizes = [];
    for (let S = 2; S <= Math.min(64, H); S++) sizes.push(S);
    for (let S = 128; S <= H; S *= 2) sizes.push(S);
    let S0 = Z.tilesS && sizes.includes(Z.tilesS) ? Z.tilesS : sizes.find(S => S >= 4 && (S & (S - 1)) === 0 && S * 2 <= H) || sizes[0];
    let h = "";
    for (const S of sizes) {
      const T = zzTiles(rows, S);
      if (!T.up.length) continue;
      const cu = zzTileCensus(T.up), cd = zzTileCensus(T.down), cr = zzTileCensus(T.rh), pw = (S & (S - 1)) === 0;
      h += `<tr data-s="${S}"${S === S0 ? ' class="cur"' : ""}><td class="n">${pw ? "<b>" + S + "</b>" : S}</td>` +
        `<td class="n">${T.up.length}</td><td class="n">${cu.distinct} <span class="dim">/ ${cu.forms}</span></td>` +
        `<td class="n">${T.down.length}</td><td class="n">${cd.distinct} <span class="dim">/ ${cd.forms}</span></td>` +
        `<td class="n">${T.rh.length}</td><td class="n">${cr.distinct} <span class="dim">/ ${cr.forms}</span></td></tr>`;
    }
    $("tilesTbl").innerHTML = '<table class="btbl"><thead><tr><th title="размер: сторона ▲ в строках (степени двойки — жирным)">S</th>' +
      '<th title="треугольников вершиной вверх">▲</th><th title="разных рисунков / форм (зеркальные — одна форма)">разных</th>' +
      '<th title="треугольников вершиной вниз (сторона S−1)">▼</th><th title="разных рисунков / форм">разных</th>' +
      '<th title="ромбов: ▲ и ▼ под ним">◇</th><th title="разных рисунков / форм">разных</th></tr></thead><tbody>' + h + "</tbody></table>";
    const T = zzTiles(rows, S0), kind = Z.tilesKind || "rh", list = kind === "up" ? T.up : kind === "down" ? T.down : T.rh, C = zzTileCensus(list);
    const nm = { up: "▲ вершиной вверх", down: "▼ вершиной вниз", rh: "◇ ромбов" }[kind];
    $("tilesOut").innerHTML = `Треугольник: ${rows.length} строк (${rows[0].length}…${rows[rows.length - 1].length} бит)` + (rowSel.size >= 2 ? ", выделенные" : "") +
      `. Размер <b>${S0}</b>: ${nm} ${list.length}, разных рисунков <b>${C.distinct}</b>, форм ${C.forms}.` +
      (list.length ? ` Ниже — разные, самые частые первыми${C.items.length > TILES_GAL ? ` (первые ${TILES_GAL})` : ""}.` : " Такой фигуры этого размера здесь нет.");
    $("tilesGal").innerHTML = C.items.slice(0, TILES_GAL).map((it, i) =>
      `<div class="tfig" title="полоса ${it.b}, место ${it.k}${it.n > 1 ? " (первая из " + it.n + ")" : ""}"><pre>${tilesFig(it.rows, S0)}</pre><div class="dim">№${i + 1} · ×${it.n}</div></div>`).join("");
  });
}

/* ─── 📐 Лесенки — таблица (v0.062) ────────────────────────────────────────────────────────────
   Запрос пользователя по тексту «🧊 Вида» (сверху, хорда, площади, описанные): «всё это в табличном виде по каждой
   строке». У каждой строки: единиц X и нулей Z (точка, куда приходит лесенка), число лесенок в ту же точку C(n, X) и его
   чётность (нечётно ⇔ X AND Z = 0 — Серпинский), пересечения и касания хорды концов, площади под / над лесенкой,
   между лесенкой и хордой (и перевес), описанные прямоугольник, квадрат и круг. Живое, как «⚖ Балансы». */
const STEPS_ROWS = 400;
function stepsNum(x){ return Number.isInteger(x) ? String(x) : x.toFixed(1); }
function stepsBinom(n, k){
  const b = binomBig(n, k), s = b.toString();
  return s.length <= 12 ? s : s.slice(0, 3).replace(/^(\d)(\d+)/, "$1,$2") + "·10^" + (s.length - 1);
}
function renderSteps(){
  liveRun("w-steps", Z.cur + "|" + Z.rows.join("|"), () => {
    const N = Z.rows.length; let h = "", tot = { cross: 0, touch: 0, under: 0, over: 0, between: 0 };
    for (let i = 0; i < N; i++) {
      const st = viewChordStats(Z.rows[i]);
      tot.cross += st.cross; tot.touch += st.touch; tot.under += st.under; tot.over += st.over; tot.between += st.between;
      if (i >= STEPS_ROWS) continue;
      const odd = (st.X & st.Z) === 0;
      h += `<tr data-r="${i}"${i === Z.cur ? ' class="cur"' : ""}><td class="n">${i + 1}</td><td class="n"><span class="b1">${st.X}</span></td><td class="n"><span class="b0">${st.Z}</span></td>` +
        `<td class="n" title="${binomBig(st.X + st.Z, st.X)}">${stepsBinom(st.X + st.Z, st.X)}</td><td class="n">${odd ? "нечёт" : '<span class="dim">чёт</span>'}</td>` +
        `<td class="n">${st.cross ? `<span class="rcf">${st.cross}</span>` : 0}</td><td class="n">${st.touch}</td>` +
        `<td class="n">${st.under}</td><td class="n">${st.over}</td><td class="n">${stepsNum(st.between)}</td><td class="n">${st.signed ? (st.signed > 0 ? "над " : "под ") + stepsNum(Math.abs(st.signed)) : "—"}</td>` +
        `<td class="n">${st.rect}</td><td class="n">${st.sq}</td><td class="n">${stepsNum(st.circ)}</td></tr>`;
    }
    $("stepsOut").textContent = `Всего по ${N} строкам: пересечений хорды ${tot.cross}, касаний ${tot.touch}; площадь под лесенками ${tot.under}, над ${tot.over}, между лесенкой и хордой ${stepsNum(tot.between)}.`;
    $("stepsTbl").innerHTML = '<table class="btbl"><thead><tr><th>№</th><th title="единиц — шагов вправо">1</th><th title="нулей — шагов к себе">0</th>' +
      '<th title="лесенок в ту же точку — C(n, единиц), число из треугольника Паскаля; наведи — полностью">C(n,k)</th><th title="чётность C(n,k): нечётно, когда единиц AND нулей = 0 (Серпинский)">Серп.</th>' +
      '<th title="пересечений хорды концов с лесенкой">⟋ пер.</th><th title="касаний хорды (вершина на хорде без перехода на другую сторону)">кас.</th>' +
      '<th title="площадь под лесенкой: прямоугольники «1 × нулей до неё» — пар «0 раньше 1»">под</th><th title="над лесенкой: X·Z минус «под» — пар «1 раньше 0»">над</th>' +
      '<th title="площадь между лесенкой и хордой">между</th><th title="с какой стороны хорды площади больше и на сколько">перевес</th>' +
      '<th title="описанный прямоугольник X·Z">□ X·Z</th><th title="описанный квадрат max(X,Z)²">■ max²</th><th title="круг вокруг прямоугольника π(X²+Z²)/4">○ круг</th></tr></thead><tbody>' + h + "</tbody></table>" +
      (N > STEPS_ROWS ? `<div class="dim">… ещё ${N - STEPS_ROWS} строк — итоги наверху считаются по всем</div>` : "");
    const tr = $("stepsTbl").querySelector("tr.cur");
    if (tr) { const box = $("stepsTbl"); if (tr.offsetTop < box.scrollTop + 24 || tr.offsetTop > box.scrollTop + box.clientHeight - 24) box.scrollTop = Math.max(0, tr.offsetTop - box.clientHeight / 2); }
  });
}

/* ─── ◯ Конус (v0.048) ───────────────────────────────────────────────────────────────────────
   Запрос пользователя: «◯ конус — да, но его нужно видом сверху: кольца расходящиеся, и чтоб крутить можно было
   руками каждое» (к разговору «каждую строку в треугольнике считать кольцевой: 111 как ни крути — 111, а 1000 — это
   0100…»). Строка k — кольцо k, от центра наружу; бит — дуга своего кольца, 1 ярко, 0 тускло. Тянешь по кольцу —
   оно крутится (отпустил — встаёт на целый бит); щелчок без поворота — строка становится текущей. Поворот — только
   вид, строки не меняются, пока не нажато «⤓ в строки». Одинаковые кольца (одно ожерелье: те же биты по кругу) —
   одним цветом обводки. */
const CONE_MAX = 256;   // v0.200: было 160 — заготовки Аниматрицы по 256 строк
/* v0.051, «конус — супер; надо ещё чётче разграничить кольца, и выделять при наведении; цвета брать из поля строк, в том
   числе и символов; и если меняется там — то и здесь, и если крутить тут — то там». Кольца — с явным зазором и тонкой
   чертой между ними; наведённое кольцо обводится и подсвечивает свою строку в поле; цвета — те же, что у бит в поле
   (--b1 / --b0, неподвижные красным, если в поле включено «неподв.»), а когда дуга крупная — рисуется и сам символ 0 / 1
   шрифтом поля. Поворот кольца теперь поворачивает САМУ строку: пока тянешь — строка в поле крутится вместе (на
   каждом целом бите), отпустил — записано (↩ вернёт весь поворот разом). Поле строк меняется — конус перерисован. */
let coneRot = [], coneGeom = null, coneDrag = null, coneHover = -1;
let coneZoom = 1, conePan = [0, 0];   // v0.049: масштаб вокруг курсора и сдвиг (в пикселях холста)
function coneCss(v, dflt){ try { return getComputedStyle(document.documentElement).getPropertyValue(v).trim() || dflt; } catch (e) { return dflt; } }
function coneInfo(){
  const nk = Z.rows.map(zzNecklace), groups = new Map();
  nk.forEach((k, i) => { const key = Z.rows[i].length + ":" + k.canon; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(i); });
  return { nk, groups };
}
function coneHoverRow(i){
  // подсветка строки в поле под наведённым кольцом
  const L = $("rowList"); if (!L) return;
  L.querySelectorAll(".rw.hov").forEach(el => el.classList.remove("hov"));
  if (i >= 0) { const el = L.querySelector('.rw[data-r="' + i + '"]'); if (el) el.classList.add("hov"); }
}
/* v0.373, по снимку группы «Лазер» в 3D — «в 3D лазер: все кнопки пока что неактивные нужно»: в 3D лазер не рисуется и не считается,
   поэтому все кнопки, поля и списки группы «Лазер» в 3D неактивны (бледные, не жмутся, подсказка — почему); группу можно двигать.
   Вышел из 3D — возвращаются, как были (то, что было неактивно само по себе, — таким и остаётся). Метка — data-d3 / .dis3 */
function lasUi3d(){
  const G = document.querySelector(".cgrp.cg-las"); if (!G) return;
  const on = !!Z.cone3d;
  G.querySelectorAll("button, input, select").forEach(el => {
    if (on) { if (!el.dataset.d3) el.dataset.d3 = el.disabled ? "was" : "1"; if (!el.disabled) el.disabled = true; }   // и если что-то включило его заново
    else if (el.dataset.d3) { if (el.dataset.d3 === "1") el.disabled = false; delete el.dataset.d3; }
  });
  G.querySelectorAll("label").forEach(l => l.classList.toggle("dis3", on));
  if (G.classList.contains("las3d") !== on) { G.classList.toggle("las3d", on); if (on) { G.dataset.tip0 = G.title; G.title = "⌖ Лазер в 3D пока не работает — кнопки неактивны. Выйди из 3D (🧊), чтобы включить лазер"; } else if (G.dataset.tip0 !== undefined) { G.title = G.dataset.tip0; delete G.dataset.tip0; } }
}
function renderCone(){
  lasUi3d();   // v0.373
  if (!winOpen("w-cone")) return;
  { const b3 = $("bC3d"), bo = $("bC3Octa"); if (b3) b3.classList.toggle("on", !!Z.cone3d); if (bo) bo.classList.toggle("on", !!Z.coneOcta); }   // v0.270: кнопки над пультом — как галки
  { const p3 = $("cone3Pad"); if (p3) p3.classList.toggle("flat", !Z.cone3d); }   // v0.157: кнопки 3D — только в 3D; v0.164: в 2D — одна зелёная «всё на места»
  const cv = $("coneCv"); if (!cv) return;
  const R = cv.getBoundingClientRect(); if (R.width < 20 || R.height < 20) return;
  const dpr = window.devicePixelRatio || 1, W = Math.round(R.width * dpr), H = Math.round(R.height * dpr);
  if (cv.width !== W) cv.width = W; if (cv.height !== H) cv.height = H;
  const g = cv.getContext("2d");
  coneVeil = "";   // v0.213: цвет вуали — фон холста, берётся раз за кадр
  const cBg = coneCss("--bg", "#0b0d12"), c1 = coneCss("--b1", "#22d3ee"), c0 = coneCss("--b0", "#7d8699"), cR = coneCss("--red", "#ff6b6b"),
        cg = coneCss("--gold", "#ffd166"), cA = coneCss("--acc", "#b98cf0"), cL = coneCss("--line", "#262d3d"), ff = coneCss("--ff", "monospace"), cT = coneCss("--txt", "#d8dde8"), cIn = "#38bdf8", cOut = "#fb923c", cUp = "#d946ef", cDn = "#14b8a6";   // v0.090: границы 0→1 / 1→0   // v0.087: края колец — внутренний / внешний
  g.fillStyle = cBg; g.fillRect(0, 0, W, H);
  /* v0.103, «лампа Аладдина запущена» → «как её зажечь»: ✨ свет — из центра расходится тёплое свечение, единицы и неподвижные
     светятся своим цветом (тень-ореол), в 3D ближнее ярче дальнего. */
  const glow = !!Z.coneGlow;
  if (glow) {
    const gx = W / 2 + conePan[0], gy = H / 2 + conePan[1], gr = Math.min(W, H) * 0.55 * Math.max(1, coneZoom * 0.8);
    const lg = g.createRadialGradient(gx, gy, 0, gx, gy, gr);
    lg.addColorStop(0, "rgba(255,214,120,0.55)"); lg.addColorStop(0.35, "rgba(255,170,60,0.18)"); lg.addColorStop(1, "rgba(255,150,40,0)");
    g.fillStyle = lg; g.fillRect(0, 0, W, H);
  }
  const N = Math.min(Z.rows.length, CONE_MAX);
  while (coneRot.length < Z.rows.length) coneRot.push(0);
  coneRot.length = Z.rows.length;
  const fillOn = !Z.cone3d && Z.rows.length <= CONE_MAX;   // v0.114: снаружи — пунктирное кольцо для заполнения (в плоском виде)
  const cx = W / 2 + conePan[0], cy = H / 2 + conePan[1], rMax = (Math.min(W, H) / 2 - 6 * dpr) * coneZoom, r0 = rMax * 0.05, dr = (rMax - r0) / Math.max(1, fillOn ? coneRingsTotal(N) : N);   // v0.127: и пустые кольца до 256
  coneGeom = { cx, cy, r0, dr, N, dpr, fill: fillOn };
  const clockRays = Z.coneClock && fillOn ? coneClockTrace() : null, cE = "#1c2130";   // v0.131: пустая ячейка — чёрная (в обеих темах)   // v0.116: луч-часы — прошёл все кольца: «1» в ячейку под ним
  if (clockRays) {
    const hits = clockRays.filter(R => R.pass && R.cell >= 0); if (hits.length) coneClockMark(hits);
    // v0.127: стоим (крутят мышью, довод, щель) — луч дошёл до края: проход, единицы ячейкам пустых колец; во время ▶ это делает sweep
    const any = clockRays.some(R => R.pass);
    if (!coneSpinning) { if (any && coneClockWas === false) { clockRays.forEach(R => { if (R.pass) coneClockRecord(R); }); save(); } coneClockWas = any; }
    if (!coneSpinning && coneWallPaint(clockRays)) save();   // v0.131: упёрся в бит — красит его (тянут строку 1, довод, щель)
  } else coneWallWas = null;
  { const cc = $("coneCycle"); if (cc) { const t = coneCycleText(); if (cc.textContent !== t) cc.textContent = t; } }   // v0.119: счёт кругов
  const { nk, groups } = coneInfo();
  const HUES = [200, 30, 120, 290, 0, 60, 170, 330, 90, 250];
  const gcol = new Map(); let gi = 0;
  for (const [key, ids] of groups) if (ids.length > 1) gcol.set(key, `hsl(${HUES[gi++ % HUES.length]} 80% 60%)`);
  const same = $("coneSame") ? $("coneSame").checked : true;
  const band = Z.coneClean ? 1 : 0.72;   // доля кольца под биты; остальное — зазор до следующего (v0.222: у чистых колец зазора нет — кольца сомкнуты)
  // v0.076, «галку — скрыть все, кроме выделенных; выделение нескольких — по Ctrl»: видны выделенные (rowSel — то же
  // выделение, что в поле строк) и текущее; выделенные обведены голубым.
  const focus = coneFocus(), only = !!Z.coneOnlySel && focus.length > 0, shown = (i) => !only || focus.includes(i), cS = coneCss("--acc2", "#22d3ee");
  // v0.098: весь конус повёрнут на Z.coneSpin градусов (⟲ ⟳) — плоский вид поворачивается целиком вокруг центра
  const spin2d = !Z.cone3d && Z.coneSpin ? Z.coneSpin * Math.PI / 180 : 0;
  if (spin2d) { g.save(); g.translate(cx, cy); g.rotate(spin2d); g.translate(-cx, -cy); }
  /* v0.079, «лучи — то есть сектора закрасить полупрозрачно до центра своими цветами, можно градиент до центра» → «только когда
     одна выделена или несколько, но не все». Галка «сектора к центру»: у выделенных колец (ничего не выделено — у текущего)
     каждый бит закрашивает свой клин от кольца до центра своим цветом, к центру бледнея. Рисуется до колец — кольца поверх. */
  if (Z.coneSect && !Z.cone3d) {
    const secRows = coneFocus().filter(i => i < N && shown(i));
    const rgba = (col, a) => { g.fillStyle = col; const c = g.fillStyle; if (c[0] === "#") { const v = parseInt(c.slice(1), 16); return `rgba(${v >> 16 & 255},${v >> 8 & 255},${v & 255},${a})`; } return c.replace(/rgba?\(([^)]+)\)/, (m, p) => `rgba(${p.split(",").slice(0, 3).join(",")},${a})`); };
    for (const i of secRows) {
      const s = Z.rows[i], n = s && s.length; if (!n) continue;
      const rin = r0 + i * dr, step = 2 * Math.PI / n, rot = coneRotOf(i);
      const bitCol = (j) => { const fix = Z.showFix && fixAt(s, j); return { col: fix ? (Z.showFix === "ir" ? coneCss("--green", "#6ee7a0") : cR) : s[j] === "1" ? c1 : c0, strong: s[j] === "1" || fix }; };
      // v0.113, «из центра — что за синие полосы идут»: клин на каждый бит давал на каждой границе бит шов — сглаживание двух
      // полупрозрачных клиньев на общей кромке пропускает фон, и из центра шла тонкая светлая / синяя черта. Теперь подряд идущие
      // биты одного цвета — один клин (coneSectRuns), черта остаётся только там, где цвет и правда меняется.
      for (const run of coneSectRuns(n, bitCol)) {
        const a = -Math.PI / 2 + (run.j - rot) * step, { col, strong } = run.c;
        const gr = g.createRadialGradient(cx, cy, 0, cx, cy, rin);
        gr.addColorStop(0, rgba(col, 0)); gr.addColorStop(1, rgba(col, strong ? 0.5 : 0.22));
        g.beginPath();
        if (run.len < n) g.moveTo(cx, cy);   // всё кольцо одним цветом — круг (многоугольник) целиком, без кромки от центра
        coneArc(g, cx, cy, i, rin, a, a + run.len * step); g.closePath(); g.fillStyle = gr; g.fill();
      }
      /* v0.162, по снимку клиньев — «в секторах пиши биты 0 и 1, к центру низом»: в каждом клине — его бит, повёрнутый так, что низ
         цифры смотрит в центр (верх — наружу, к кольцу). Кегль — по ширине клина на этой высоте; слишком узкий клин — без цифры. */
      const rt = rin * 0.8, fz = Math.min(rt * step * 0.7, rin * 0.16, 64 * dpr);
      if (fz >= 5 * dpr) {
        g.save(); g.font = `700 ${Math.round(fz)}px ${ff}`; g.textAlign = "center"; g.textBaseline = "middle";
        for (let j = 0; j < n; j++) {
          const m = -Math.PI / 2 + (j + 0.5 - rot) * step;
          g.save(); g.translate(cx + rt * Math.cos(m), cy + rt * Math.sin(m)); g.rotate(m + Math.PI / 2);   // поверх поворота всего конуса (spin2d)
          g.globalAlpha = s[j] === "1" ? 0.95 : 0.7; g.fillStyle = cT; g.fillText(s[j], 0, 0); g.restore();
        }
        g.restore();
      }
    }
  }
  // v0.080: зеркало кольца — у выделенных колец (или текущего) свои неподвижные
  const mirMode = Z.coneMir || "off", mirMap = new Map();
  if (mirMode !== "off") for (const i of coneFocus()) if (i < N && Z.rows[i]) { const mi = coneMirInfo(Z.rows[i], mirMode, i); if (mi) mirMap.set(i, mi); }
  const coneDots = [];   // v0.111: точки (строки из 1 бита) — поверх колец
  if (Z.cone3d) { coneGeom = null; cone3DDraw(g, { W, H, dpr, N, shown, mirMap, c1, c0, cR, cg, cA, cT, cS }); } else {   // v0.082: объём
  for (let i = 0; i < N; i++) {
    const s = Z.rows[i], n = s.length; if (!n || !shown(i)) continue;
    const rin = r0 + i * dr, rout = rin + Math.max(1, dr * band), step = 2 * Math.PI / n, rot = coneRotOf(i);
    if (rout < 0 || rin > Math.hypot(W, H) + Math.hypot(cx - W / 2, cy - H / 2)) continue;
    const MI = mirMap.get(i), blank = !!clockRays;   // v0.131: при луч-часах ячейки колец строк пустые — чёрные, 1 ставит лазер
    const gap = Z.coneClean ? 0 : clockRays && n > 1 ? (coneNoGap() ? 0 : coneSlitHalf(n))   // v0.222: «чистые кольца» — без прорезей   // v0.208: ☀ «0 — проход» — без прорезей; v0.124: при луч-часах щель между битами — та, что в расчёте (ползунок «щель»)
      : n > 1 && step * rin > 3 * dpr ? Math.min(step * 0.12, 1.5 * dpr / Math.max(1, rin)) : 0;
    const arcLen = step * (rin + rout) / 2, fsz = Math.min(dr * band * 0.95, arcLen * 0.85);
    const glyph = fsz >= 5 * dpr;   // v0.162, «вид сверху на все — пиши 1 и 0 на секторах»: символ — почти во всю ширину кольца и с 5 px (прежде 0.8 ширины и с 8 px — у узких колец цифр не было)
    /* v0.110, «почему так? может, надо крест и точку?» — на «строки из 1 и 2 бит остаются кругами»: у одного бита многоугольника
       нет, у двух бит «стороны» легли бы на один отрезок и слились. v0.111, по снимку «всё равно круг» (точка была диском во всё
       нулевое кольцо) и «давай сделаем 2 бита двумя Г в разные стороны на одной плоскости — сверху будет крест», «углами по
       центру»: 1 бит — маленькая ТОЧКА в самом центре (рисуется поверх всего, после колец); 2 бита — две Г, углом в центре:
       у бита j руки идут на четверть и на три четверти его половины круга (под прямым углом друг к другу), вторая Г — зеркально
       напротив. Вместе — косой крест; граница между битами — в щели между Г, короткой чертой у края (0→1 сиреневая, 1→0
       бирюзовая, одинаковые — бледная). Символ бита — внутри своей Г. Крест крутится вместе с кольцом. */
    if (Z.conePoly && n <= 2) {
      const green = coneCss("--green", "#6ee7a0");
      const colOf = (j) => { const fix = MI ? MI.fix[j] : Z.showFix && fixAt(s, j);
        let col = fix ? (MI ? (MI.c180 ? green : cR) : Z.showFix === "ir" ? green : cR) : s[j] === "1" ? c1 : c0;
        if (MI && MI.odd) col = MI.cls[j] === 2 ? green : MI.cls[j] === 1 ? cg : cR;
        if (blank) return [cE, true];   // v0.131: при луч-часах ячейки пустые
        return [col, s[j] === "1" || !!fix || !!(MI && MI.odd)]; };
      const w = Math.max(2 * dpr, Math.min(dr * band * 0.4, 14 * dpr * Math.max(1, coneZoom)));
      if (n === 1) { const [col, strong] = colOf(0); coneDots.push({ i, col, strong, r: Math.max(3 * dpr, w * 0.9), ch: s[0] }); }
      else {
        g.lineCap = "butt"; g.lineJoin = "miter";
        for (let j = 0; j < 2; j++) {   // Г бита j: конец руки → центр → конец второй руки
          const a = -Math.PI / 2 + (j - rot) * step, a1 = a + step / 4, a2 = a + step * 3 / 4, [col, strong] = colOf(j);
          g.strokeStyle = col; g.lineWidth = w; g.globalAlpha = strong ? 0.95 : 0.45;
          if (glow && strong) { g.shadowColor = col; g.shadowBlur = Math.max(6 * dpr, Math.min(dr * 0.9, 30 * dpr)); }
          g.beginPath(); g.moveTo(cx + rout * Math.cos(a1), cy + rout * Math.sin(a1)); g.lineTo(cx, cy); g.lineTo(cx + rout * Math.cos(a2), cy + rout * Math.sin(a2)); g.stroke();
          g.globalAlpha = 1; g.shadowBlur = 0;
          const am = a + step / 2, rm = rout * 0.5, fsz = Math.min(dr * band * 0.8, rout * 0.3);
          if (fsz >= 8 * dpr && !blank) { g.save(); g.translate(cx + rm * Math.cos(am), cy + rm * Math.sin(am)); g.rotate(am + Math.PI / 2); g.fillStyle = col;
            g.font = `700 ${Math.round(fsz)}px ${ff}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(s[j], 0, 0); g.restore(); }
        }
        g.lineJoin = "round";
        for (let j = 0; j < 2; j++) {   // граница перед битом j — в щели между Г, у края
          const a = -Math.PI / 2 + (j - rot) * step, pv = s[(j + 1) % 2], diff = !blank && pv !== s[j];
          g.strokeStyle = diff ? (pv === "0" ? cUp : cDn) : cT; g.globalAlpha = diff ? 0.95 : 0.3; g.lineWidth = diff ? Math.max(1.5 * dpr, w * 0.5) : Math.max(1, dpr);
          g.beginPath(); g.moveTo(cx + rout * 0.6 * Math.cos(a), cy + rout * 0.6 * Math.sin(a)); g.lineTo(cx + rout * Math.cos(a), cy + rout * Math.sin(a)); g.stroke();
        }
        g.globalAlpha = 1;
      }
    } else {
    for (let j = 0; j < n; j++) {
      const a = -Math.PI / 2 + (j - rot) * step, fix = MI ? MI.fix[j] : Z.showFix && fixAt(s, j);
      let col = fix ? (MI ? (MI.c180 ? coneCss("--green", "#6ee7a0") : cR) : Z.showFix === "ir" ? coneCss("--green", "#6ee7a0") : cR) : s[j] === "1" ? c1 : c0;
      if (MI && MI.odd) col = MI.cls[j] === 2 ? coneCss("--green", "#6ee7a0") : MI.cls[j] === 1 ? cg : cR;   // v0.081: против пары — сколько совпало
      if (blank) col = cE;   // v0.131: при луч-часах ячейка пустая — чёрная, без 0/1
      if (Z.coneArcs === false) continue;   // v0.375: «◠ дуги» выключены — дуг битов нет (границы, кольца, лучи — как были)
      g.beginPath(); coneArc(g, cx, cy, i, rout, a + gap, a + step - gap); coneArc(g, cx, cy, i, rin, a + step - gap, a + gap, true); g.closePath();   // v0.109: у многоугольника — сторона
      /* v0.078, «чётче границы внутри кольца и цвета ярче — сливаются»: заливка плотнее (у единиц и неподвижных — почти
         сплошная, у нулей — заметная), символ поверх единицы — цветом фона (контраст на плотной заливке), у нуля — своим
         цветом; между битами — тёмные черты, по краям кольца — контур. */
      const strong = blank || s[j] === "1" || fix || !!(MI && MI.odd);
      /* v0.152, «поправь отображение битов в конусе: раньше цвет символа в строках был фоном сектора в кольце, сектор — бит»:
         сектор заливается сплошь ровно тем цветом, каким его символ стоит в поле строк — и у 1, и у 0 (прежде нули — на 28%). */
      g.globalAlpha = 0.95; g.fillStyle = col;
      if (glow && strong) { g.shadowColor = col; g.shadowBlur = Math.max(6 * dpr, Math.min(dr * 0.9, 30 * dpr)); }
      g.fill(); g.globalAlpha = 1; if (glow && strong) g.shadowBlur = 0;
      if (glyph && !blank) {
        const am = a + step / 2, rm = (rin + rout) / 2 * coneRho(i, am);
        g.save(); g.translate(cx + rm * Math.cos(am), cy + rm * Math.sin(am)); g.rotate(am + Math.PI / 2);
        g.fillStyle = cBg; g.font = `700 ${Math.round(fsz)}px ${ff}`; g.textAlign = "center"; g.textBaseline = "middle";   // v0.152: цифра — тёмным поверх сплошной заливки
        g.fillText(s[j], 0, 0); g.restore();
      }
    }
    /* v0.090, «граница — цветом, сами построятся», «где надо»: граница красится по тому, что разделяет. Биты разные — яркая:
       0→1 (по часовой) — сиреневая, 1→0 — бирюзовая; одинаковые — тонкая бледная. Края серий видны сразу, узор проступает. */
    if (n > 1 && step * rin > 3 * dpr) {
      for (let j = 0; j < n; j++) {
        const a = -Math.PI / 2 + (j - rot) * step, pv = s[(j - 1 + n) % n], nx = s[j], diff = !blank && pv !== nx;
        g.strokeStyle = diff ? (pv === "0" ? cUp : cDn) : cT; g.globalAlpha = diff ? 0.95 : 0.3; g.lineWidth = diff && !clockRays ? Math.max(1.5 * dpr, Math.min(dr * 0.1, 4 * dpr)) : Math.max(1, dpr * 0.8);   // v0.124: при луч-часах черта тонкая — щель видна пустой
        g.beginPath(); g.moveTo(cx + rin * Math.cos(a), cy + rin * Math.sin(a)); g.lineTo(cx + rout * Math.cos(a), cy + rout * Math.sin(a)); g.stroke();
      }
      g.globalAlpha = 1;
    }
    if (dr > 4 * dpr && !Z.coneClean) {   // v0.222: «чистые кольца» — без контура; контур кольца — v0.087, «границу внутреннюю и внешнюю кольца надо как-то различать, цветом»: внутренняя голубая, внешняя оранжевая
      g.lineWidth = Math.max(1, dpr * 1.1);
      g.strokeStyle = cIn; g.globalAlpha = 0.75; g.beginPath(); coneArc(g, cx, cy, i, rin, 0, 2 * Math.PI); g.stroke();
      g.strokeStyle = cOut; g.globalAlpha = 0.75; g.beginPath(); coneArc(g, cx, cy, i, rout, 0, 2 * Math.PI); g.stroke(); g.globalAlpha = 1;
    }
    // черта между кольцами — чтобы кольца читались раздельно
    g.strokeStyle = cL; g.lineWidth = Math.max(1, dpr * 0.8); g.beginPath(); coneArc(g, cx, cy, i, rout + dr * (1 - band) / 2, 0, 2 * Math.PI); g.stroke();
    }   // v0.110: конец обычного кольца / многоугольника
    const key = n + ":" + nk[i].canon;
    if (same && gcol.has(key)) { g.strokeStyle = gcol.get(key); g.lineWidth = Math.max(1, dr * 0.12); g.beginPath(); coneArc(g, cx, cy, i, rout + dr * (1 - band) / 2, 0, 2 * Math.PI); g.stroke(); }
    // v0.057, «выделение колец золотым — непонятно, какую-то черту поперёк кольца делает, путает»: обе окружности были одним
    // контуром, и canvas соединял их отрезком (справа, на угле 0). Теперь — каждая своим контуром, без перемычки.
    /* v0.213, «выделять кольцо или строку — синхронно, и остальные при этом гаснут немного»: есть выделение (Shift + щелчок по кольцу,
       Ctrl + щелчок по строке — оно общее у колец и строк) — невыделенные кольца под полупрозрачной вуалью цвета холста. */
    if (focus.length && !focus.includes(i)) {   // v0.221: «выделение строки — это когда все остальные тушатся светом» — и у выбранной строки
      if (!coneVeil) coneVeil = getComputedStyle(g.canvas).backgroundColor || cBg;
      g.strokeStyle = coneVeil; g.lineWidth = Math.max(1, rout - rin + dpr); g.globalAlpha = 0.55; g.beginPath(); coneArc(g, cx, cy, i, (rin + rout) / 2, 0, 2 * Math.PI); g.stroke(); g.globalAlpha = 1;
    }
    if (rowSel.has(i)) { g.strokeStyle = cS; g.lineWidth = Math.max(1.5 * dpr, dr * 0.12); g.beginPath(); coneArc(g, cx, cy, i, (rin + rout) / 2, 0, 2 * Math.PI); g.globalAlpha = 0.35; g.stroke(); g.globalAlpha = 1; }
    if (i === Z.cur && !document.body.classList.contains("nocur") && !Z.coneClean) {   // v0.222: у чистых колец текущее видно по яркости (остальные гаснут); v0.107: Esc гасит и в конусе; v0.087: текущее — те же цвета краёв, толще (внутри голубой, снаружи оранжевый)
      g.lineWidth = Math.max(2 * dpr, dr * 0.12);
      g.strokeStyle = cIn; g.beginPath(); coneArc(g, cx, cy, i, rin - dr * 0.04, 0, 2 * Math.PI); g.stroke();
      g.strokeStyle = cOut; g.beginPath(); coneArc(g, cx, cy, i, rout + dr * 0.04, 0, 2 * Math.PI); g.stroke();
    }
    if (i === coneHover) { g.strokeStyle = cA; g.lineWidth = Math.max(2 * dpr, dr * 0.14); g.globalAlpha = 0.85; g.beginPath(); coneArc(g, cx, cy, i, rin - dr * 0.06, 0, 2 * Math.PI); g.stroke(); g.beginPath(); coneArc(g, cx, cy, i, rout + dr * 0.06, 0, 2 * Math.PI); g.stroke(); g.globalAlpha = 1; }
    if (Z.coneBit1 && !(Z.conePoly && n <= 2)) {   // v0.318, «подсветить 1 бит каждой строки»: бит 0 — золотой обводкой
      const a = -Math.PI / 2 - rot * step;
      g.strokeStyle = cg; g.globalAlpha = 1; g.lineJoin = "round"; g.lineWidth = Math.max(1.5 * dpr, Math.min(dr * 0.12, 4 * dpr));
      g.beginPath(); coneArc(g, cx, cy, i, rout, a, a + step); coneArc(g, cx, cy, i, rin, a + step, a, true); g.closePath(); g.stroke();
    }
  }
  if (clockRays) {   // v0.131: биты строк, в которые упирался луч, — закрашены золотом, с «1», «11», «111»…
    const VH = coneVoidHits();
    for (const k in VH) {
      const [i, j] = k.split(":").map(Number); if (i >= N || !shown(i)) continue;
      const n = Z.rows[i].length, cnt = VH[k] | 0; if (!n || j >= n || !cnt) continue;
      const rin = r0 + i * dr, rout = rin + Math.max(1, dr * band), step = 2 * Math.PI / n, a = -Math.PI / 2 + (j - coneRotOf(i)) * step;
      const gp = n > 1 && !coneNoGap() && !Z.coneClean ? coneSlitHalf(n) : 0, fsz = Math.min(dr * band * 0.8, step * (rin + rout) / 2 * 0.85);   // v0.216: «Без щелей» — краска сплошная
      g.beginPath(); coneArc(g, cx, cy, i, rout, a + gp, a + step - gp); coneArc(g, cx, cy, i, rin, a + step - gp, a + gp, true); g.closePath();
      g.fillStyle = cg; g.globalAlpha = Math.min(0.95, 0.6 + 0.12 * cnt); g.fill(); g.globalAlpha = 1;
      if (fsz >= 7 * dpr) {
        const tx = "1".repeat(Math.min(cnt, 9)), am = a + step / 2, rm = (rin + rout) / 2 * coneRho(i, am);
        g.save(); g.translate(cx + rm * Math.cos(am), cy + rm * Math.sin(am)); g.rotate(am + Math.PI / 2);
        g.fillStyle = cBg; g.font = `bold ${Math.round(tx.length > 1 ? fsz / Math.min(3, tx.length) * 1.4 : fsz)}px ${ff}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(tx, 0, 0); g.restore();
      }
    }
  }
  if (window.zzSndHeads) {   // v0.376: ◉ головки звука — обводка сектора звучащего бита
    g.lineWidth = Math.max(2 * dpr, Math.min(dr * 0.14, 5 * dpr)); g.shadowBlur = 8 * dpr;
    for (const [i, j, kd] of window.zzSndHeads) {
      g.strokeStyle = g.shadowColor = sndHeadCol(kd);   // v0.383: столбцовая — золотом
      if (i >= N || !shown(i)) continue; const n = (Z.rows[i] || "").length; if (!n || j >= n) continue;
      const rin = r0 + i * dr, rout = rin + Math.max(1, dr * band), step = 2 * Math.PI / n, a = -Math.PI / 2 + (j - coneRotOf(i)) * step;
      g.beginPath(); if (n > 1) { coneArc(g, cx, cy, i, rout, a, a + step); coneArc(g, cx, cy, i, rin, a + step, a, true); g.closePath(); } else { g.arc(cx, cy, rout, 0, 2 * Math.PI); } g.stroke();
    }
    g.shadowBlur = 0;
  }
  if (fillOn) {   // v0.114: кольцо для заполнения — ячейки пунктиром, заполненные — цветом бита; бит 0 — сверху, как у всех
    const f = fillDraft(), n = f.length, rin = r0 + N * dr, rout = rin + Math.max(1, dr * band), step = 2 * Math.PI / n, rotF = coneFillRot();   // v0.117: крутится со всеми
    const gp = n > 1 && !coneNoGap() && !Z.coneClean ? Math.min(step * 0.1, 1.5 * dpr / Math.max(1, rin)) : 0, fsz = Math.min(dr * band * 0.8, step * (rin + rout) / 2 * 0.85);   // v0.216
    g.lineWidth = dpr; g.setLineDash([3 * dpr, 3 * dpr]);
    for (let k = 0; k < n; k++) {
      const a = -Math.PI / 2 + (k - rotF) * step;
      g.beginPath();
      if (n > 1) { g.arc(cx, cy, rout, a + gp, a + step - gp); g.arc(cx, cy, rin, a + step - gp, a + gp, true); g.closePath(); }
      else { g.arc(cx, cy, rout, 0, 2 * Math.PI); g.moveTo(cx + rin, cy); g.arc(cx, cy, rin, 0, 2 * Math.PI, true); }
      if (f[k] !== ".") { g.fillStyle = f[k] === "1" ? c1 : c0; g.globalAlpha = f[k] === "1" ? 0.95 : 0.55; g.fill("evenodd"); }
      g.strokeStyle = cA; g.globalAlpha = 0.75; g.stroke(); g.globalAlpha = 1;
      if (f[k] !== "." && fsz >= 8 * dpr) {
        const am = a + step / 2, rm = (rin + rout) / 2, hc = f[k] === "1" ? (coneVoidHits()[N + ":" + k] | 0) : 0, tx = hc > 1 ? "1".repeat(hc) : f[k];   // v0.127: прошёл 2+ раз — 11, 111…
        g.save(); g.translate(cx + rm * Math.cos(am), cy + rm * Math.sin(am)); g.rotate(am + Math.PI / 2);
        g.fillStyle = cBg; g.font = `${Math.round(tx.length > 1 ? fsz / Math.min(3, tx.length) * 1.4 : fsz)}px ${ff}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(tx, 0, 0); g.restore();
      }
    }
    g.setLineDash([]);
    /* v0.127: пустые кольца до строки 256 — еле заметные: контур кольца и черты ячеек (где черта шире 3 пикселей); ячейки, через
       которые прошёл луч, — закрашены (чем больше проходов, тем плотнее), с «1», «11», «111»… если влезает. */
    const T = coneRingsTotal(N), VH = coneVoidHits(), marks = new Map();
    for (const k in VH) { const [j, c] = k.split(":").map(Number); if (j > N && j < T) { if (!marks.has(j)) marks.set(j, []); marks.get(j).push([c, VH[k]]); } }
    // v0.129, «совсем не видно граней у пустых — сделай хотя бы у ближайших более заметными»: ближнее пустое кольцо — ярко, дальше
    // гаснет (×0,88 на кольцо, не бледнее 0,12); у ближних — и внешний край, и черта толще.
    g.strokeStyle = cA;
    for (let j = N + 1; j < T; j++) {
      const d = j - N - 1, r1 = r0 + j * dr, r2 = r1 + dr * band, n = coneVoidLen(j, N), st = 2 * Math.PI / n, rt = coneVoidRot(j, n);
      g.globalAlpha = Math.max(0.12, 0.75 * Math.pow(0.88, d)); g.lineWidth = d < 6 ? Math.max(1, dpr) : Math.max(0.6, dpr * 0.6);
      g.beginPath(); g.moveTo(cx + r1, cy); g.arc(cx, cy, r1, 0, 2 * Math.PI);
      if (d < 6) { g.moveTo(cx + r2, cy); g.arc(cx, cy, r2, 0, 2 * Math.PI); }
      if (st * r1 > 3 * dpr) for (let k = 0; k < n; k++) { const a = -Math.PI / 2 + (k - rt) * st, c = Math.cos(a), s = Math.sin(a); g.moveTo(cx + r1 * c, cy + r1 * s); g.lineTo(cx + r2 * c, cy + r2 * s); }
      g.stroke();
    }
    g.globalAlpha = 1;
    for (const [j, list] of marks) {
      const rin = r0 + j * dr, rout = rin + Math.max(1, dr * band), n = coneVoidLen(j, N), st = 2 * Math.PI / n, rt = coneVoidRot(j, n);
      const fsz = Math.min(dr * band * 0.8, st * (rin + rout) / 2 * 0.85);
      for (const [k, cnt] of list) {
        const a = -Math.PI / 2 + (k - rt) * st;
        g.beginPath(); g.arc(cx, cy, rout, a, a + st); g.arc(cx, cy, rin, a + st, a, true); g.closePath();
        g.fillStyle = c1; g.globalAlpha = Math.min(0.95, 0.45 + 0.2 * cnt); g.fill(); g.globalAlpha = 1;
        if (fsz >= 7 * dpr) {
          const tx = "1".repeat(Math.min(cnt, 9)), am = a + st / 2, rm = (rin + rout) / 2;
          g.save(); g.translate(cx + rm * Math.cos(am), cy + rm * Math.sin(am)); g.rotate(am + Math.PI / 2);
          g.fillStyle = cBg; g.font = `${Math.round(tx.length > 1 ? fsz / Math.min(3, tx.length) * 1.4 : fsz)}px ${ff}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(tx, 0, 0); g.restore();
        }
      }
    }
  }
  if (window.zzMusRay && !Z.cone3d) {   // v0.441: 🎵 головка музыкального лазера — луч из центра, на конце точка; v0.442 — головок несколько, у каждой свой цвет
    /* v0.443: у головки за шаг — отрезки пути [угол, кольцо, что]: «on» / «in» — стоит на кольце (до его середины, точка светлая), «wall» —
       упёрлась в «1» и отразилась (до внутреннего края кольца, точка красная, дальше — бледный отрезок обратно сквозь центр), «fill» —
       в кольце для заполнения, «out» — за краем. Кольцо, которое головка занимает, обведено её цветом */
    g.save(); g.lineCap = "round"; const lw = Math.max(1.5 * dpr, Math.min(dr * 0.12, 3 * dpr)), pr = Math.max(3 * dpr, Math.min(dr * 0.22, 6 * dpr));
    for (const M of window.zzMusRay) {
      const col = M.c || cg;
      if (M.ring >= 0 && M.ring < N) { g.strokeStyle = col; g.globalAlpha = 0.45; g.lineWidth = Math.max(2 * dpr, dr * band * 0.35); g.beginPath(); coneArc(g, cx, cy, M.ring, r0 + M.ring * dr + dr * band / 2, 0, 2 * Math.PI); g.stroke(); }
      M.seg.forEach(([deg, i, kd], q) => {
        const a = -Math.PI / 2 + deg * Math.PI / 180, last = q === M.seg.length - 1;
        const rs = kd === "wall" ? (r0 + i * dr) * coneRho(i, a) : i < N ? (r0 + i * dr + dr * band / 2) * coneRho(i, a) : kd === "fill" ? r0 + N * dr + dr * band / 2 : r0 + (N + 1) * dr, px = cx + rs * Math.cos(a), py = cy + rs * Math.sin(a);
        g.strokeStyle = g.shadowColor = col; g.shadowBlur = last ? 10 * dpr : 0; g.globalAlpha = last ? 0.9 : 0.4; g.lineWidth = lw;
        g.beginPath(); g.moveTo(cx, cy); g.lineTo(px, py); g.stroke(); g.shadowBlur = 0;
        g.globalAlpha = last ? 1 : 0.6; g.fillStyle = kd === "wall" ? cR : "#fff7d6"; g.beginPath(); g.arc(px, py, pr, 0, 2 * Math.PI); g.fill();
      });
    }
    g.restore();
  }
  for (const d of coneDots) {   // v0.111: точка — в самом центре, поверх Г
    g.beginPath(); g.arc(cx, cy, d.r, 0, 2 * Math.PI); g.fillStyle = d.col; g.globalAlpha = d.strong ? 1 : 0.6;
    if (glow && d.strong) { g.shadowColor = d.col; g.shadowBlur = Math.max(6 * dpr, d.r * 2); }
    g.fill(); g.shadowBlur = 0; g.globalAlpha = 1; g.strokeStyle = cBg; g.lineWidth = Math.max(1, dpr); g.stroke();
  }
  // v0.080: ось зеркала кольца (диаметр) и хорды между парами бит — золотом равные, серым разные; 180° — пары через центр
  for (const [i, MI] of mirMap) {
    if (!shown(i) || Z.rows[i].length < 2) continue;   // v0.086: у кольца из одного бита лучей нет — только сектор к центру
    const s = Z.rows[i], n = s.length, step = 2 * Math.PI / n, rot = coneRotOf(i), rm = r0 + i * dr + dr * band / 2, rout = r0 + i * dr + dr * band;
    const ang = (j) => -Math.PI / 2 + (j - rot + 0.5) * step;
    if (!MI.c180) {
      const aa = -Math.PI / 2 + (MI.m / 2 - rot + 0.5) * step;
      g.save(); g.strokeStyle = cg; g.lineWidth = Math.max(1.5, 1.6 * dpr); g.setLineDash([8 * dpr, 5 * dpr]); g.globalAlpha = 0.9;
      g.beginPath(); g.moveTo(cx - (rout + 6 * dpr) * Math.cos(aa), cy - (rout + 6 * dpr) * Math.sin(aa)); g.lineTo(cx + (rout + 6 * dpr) * Math.cos(aa), cy + (rout + 6 * dpr) * Math.sin(aa)); g.stroke(); g.restore();
    }
    if (MI.odd) {   // v0.081: от центра каждого бита — через центр кольца в границу напротив
      for (let j = 0; j < n; j++) {
        const a1 = ang(j), a2 = -Math.PI / 2 + (j + MI.k + 1 - rot) * step, c = MI.cls[j];
        g.strokeStyle = c ? cg : cT; g.globalAlpha = c === 2 ? 0.8 : c === 1 ? 0.45 : 0.2; g.lineWidth = Math.max(1, dpr * (c === 2 ? 1.3 : 0.8));
        const r1 = rm * coneRho(i, a1), r2 = rm * coneRho(i, a2);   // v0.109: у многоугольника — точки на сторонах
        g.beginPath(); g.moveTo(cx + r1 * Math.cos(a1), cy + r1 * Math.sin(a1)); g.lineTo(cx + r2 * Math.cos(a2), cy + r2 * Math.sin(a2)); g.stroke();
        const hit = coneOuterHit(i, a2);   // v0.083: и дальше — во внешнее кольцо
        if (hit) {
          const rm2 = (r0 + (i + 1) * dr + dr * band / 2) * coneRho(i + 1, a2), ga = g.globalAlpha;
          g.setLineDash([3 * dpr, 3 * dpr]); g.beginPath(); g.moveTo(cx + r2 * Math.cos(a2), cy + r2 * Math.sin(a2)); g.lineTo(cx + rm2 * Math.cos(a2), cy + rm2 * Math.sin(a2)); g.stroke(); g.setLineDash([]);
          g.globalAlpha = Math.min(1, ga + 0.3); g.fillStyle = hit.boundary ? cA : hit.bit === "1" ? c1 : c0; g.strokeStyle = cBg;
          g.beginPath(); g.arc(cx + rm2 * Math.cos(a2), cy + rm2 * Math.sin(a2), Math.max(2.5 * dpr, dr * 0.14), 0, 2 * Math.PI); g.fill(); g.lineWidth = dpr; g.stroke();
        }
      }
      g.globalAlpha = 1; continue;
    }
    for (let j = 0; j < n; j++) {
      const p = MI.partner(j); if (p <= j) continue;
      const a1 = ang(j), a2 = ang(p);
      g.strokeStyle = MI.fix[j] ? cg : cT; g.globalAlpha = MI.fix[j] ? 0.75 : 0.22; g.lineWidth = Math.max(1, dpr * (MI.fix[j] ? 1.3 : 0.8));
      const r1 = rm * coneRho(i, a1), r2 = rm * coneRho(i, a2);
      g.beginPath(); g.moveTo(cx + r1 * Math.cos(a1), cy + r1 * Math.sin(a1)); g.lineTo(cx + r2 * Math.cos(a2), cy + r2 * Math.sin(a2)); g.stroke();
    }
    g.globalAlpha = 1;
  }
  // v0.055: лучи к центру от границ бит — текущего кольца или всех
  const rays = Z.coneRays || "off";
  if (rays !== "off") {
    g.strokeStyle = cA; g.lineWidth = Math.max(0.6, dpr * (rays === "cur" ? 0.9 : 0.5)); g.globalAlpha = rays === "cur" ? 0.6 : 0.2;
    g.beginPath();
    const rayRows = rays === "cur" ? coneFocus().filter(i => i < N) : [...Array(N).keys()];   // v0.108: «текущего» — те, что в фокусе
    for (const i of rayRows) {
      const s = Z.rows[i], n = s.length; if (n < 2 || !shown(i)) continue;   // v0.086: у одного бита лучей нет
      const rout = r0 + i * dr + Math.max(1, dr * band), step = 2 * Math.PI / n, rot = coneRotOf(i);
      // v0.089, «есть лучи от центров бит, а есть от границ — от границ, похоже, не надо; оставь только границы на кольце, чтобы туда
      // запускать лучи от бит других»: лучи — от центра каждого бита (середины дуги) к центру; границы — черты на самом кольце.
      for (let j = 0; j < n; j++) { const a = -Math.PI / 2 + (j - rot + 0.5) * step, ro = rout * coneRho(i, a); g.moveTo(cx, cy); g.lineTo(cx + ro * Math.cos(a), cy + ro * Math.sin(a)); }
    }
    g.stroke(); g.globalAlpha = 1;
  }
  if (clockRays) {   // v0.116: луч-часы — золотой луч из центра до стены (красная черта поперёк) или до кольца для заполнения (точка)
    const tNow = performance.now(), rEnd = r0 + coneRingsTotal(N) * dr, hw = Math.max(3 * dpr, dr * 0.18);   // v0.127: прошедший — сквозь пустые кольца до края
    coneClockFlash = coneClockFlash.filter(F => tNow - F.t < 900);
    /* v0.124, «чем задана ширина лазера и междубитья?» → «да» на «сделать ползунок ширины щели»: лазер — клин той же угловой
       ширины, что щель (Z.coneSlit, градусы): у центра узкий, к краю шире — ровно как щели в кольцах, которые тоже по углу. Проходит
       кольцо, если середина луча в щели, то есть луч хотя бы наполовину в ней. Светлая сердцевина — середина, по ней и считается. */
    const hs = coneSlitHalf(), cCore = "#fff7d6", lite = clockRays.length > 12;   // v0.201: ✺ — лучей много, без свечения (тени дорогие)
    /* v0.134, «когда прошёл через щель, то в месте этом убери свечение на толщине кольца, чтобы видно было эту щель»: holes —
       толщины колец [от, до], чьи щели луч прошёл; там клин и свечение не рисуются (вырезаны), остаётся тонкая сердцевина. */
    const beam = (a, r1, alpha, bold, holes) => {
      const h = Math.max(hs, 1.5 * dpr / Math.max(1, r1));   // совсем узкую щель клин не тоньше 3 пикселей на конце — иначе не видно
      if (holes && holes.length) {
        g.save(); g.beginPath(); g.arc(cx, cy, r1 + 40 * dpr, 0, 2 * Math.PI);
        for (const [ri, ro] of holes) { g.moveTo(cx + ro, cy); g.arc(cx, cy, ro, 0, 2 * Math.PI); g.moveTo(cx + ri, cy); g.arc(cx, cy, ri, 0, 2 * Math.PI); }
        g.clip("evenodd");
      }
      g.globalAlpha = alpha * (bold ? 0.75 : 0.55); g.fillStyle = cg; g.shadowColor = cg; g.shadowBlur = lite ? 0 : bold ? 16 * dpr : 10 * dpr;
      g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, r1, a - h, a + h); g.closePath(); g.fill(); g.shadowBlur = 0;
      if (holes && holes.length) g.restore();
      g.globalAlpha = alpha; g.strokeStyle = cCore; g.lineWidth = (bold ? 2 : 1.5) * dpr;
      g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + r1 * Math.cos(a), cy + r1 * Math.sin(a)); g.stroke(); g.globalAlpha = 1;
    };
    g.save(); g.lineCap = "round";
    if (coneSunOn()) {   // v0.206: солнце — диск строки 1 и освещённые сектора до каждого кольца
      const S = coneSunTrace(), rIn = (b) => r0 + (b - 1) * dr + Math.max(1, dr * band), rAt = (b) => r0 + b * dr;
      const sect = (ri, ro, lo, hi) => { g.beginPath(); g.arc(cx, cy, ro, lo - Math.PI / 2, hi - Math.PI / 2); g.arc(cx, cy, Math.max(0, ri), hi - Math.PI / 2, lo - Math.PI / 2, true); g.closePath(); g.fill(); };
      g.fillStyle = cg; g.globalAlpha = 0.85; g.shadowColor = cg; g.shadowBlur = 18 * dpr;
      g.beginPath(); g.arc(cx, cy, r0 + Math.max(1, dr * band), 0, 2 * Math.PI); g.fill(); g.shadowBlur = 0;
      g.globalAlpha = 0.3;
      for (const [b, lit] of S.bands) for (const [lo, hi] of lit) sect(rIn(b), rAt(b), lo, hi);
      for (const [lo, hi] of S.out) sect(rIn(S.end), rEnd, lo, hi);
      g.globalAlpha = 1;
    } else {   // v0.119 / v0.121: вырез в кольце строки 1 — прорезь цветом фона шириной в щель (v0.124), края золотые
      const ri = r0 - dpr, ro = r0 + Math.max(1, dr * band) + dpr, a = coneCutAngle(), h = Math.max(hs, 1.5 * dpr / Math.max(1, ri));   // v0.139: вырез — отдельно от лазера
      g.fillStyle = cBg; g.beginPath(); g.arc(cx, cy, ro, a - h, a + h); g.arc(cx, cy, Math.max(0, ri), a + h, a - h, true); g.closePath(); g.fill();
      g.strokeStyle = cg; g.lineWidth = Math.max(1.5 * dpr, dpr); g.lineCap = "butt"; g.beginPath();
      for (const e of [a - h, a + h]) { g.moveTo(cx + ri * Math.cos(e), cy + ri * Math.sin(e)); g.lineTo(cx + ro * Math.cos(e), cy + ro * Math.sin(e)); }
      g.stroke(); g.lineCap = "round";
    }
    for (let q = 0; q < coneLaserK(); q++) {   // v0.191: прежние лазеры — тонкой бледной чертой
      const a = coneLaserAngle(q); g.globalAlpha = 0.28; g.strokeStyle = cg; g.lineWidth = dpr; g.setLineDash([4 * dpr, 4 * dpr]);
      g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + rEnd * Math.cos(a), cy + rEnd * Math.sin(a)); g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
    }
    for (const R of clockRays) {
      const rs = R.pass ? (R.vstop < coneRingsTotal(N) ? r0 + R.vstop * dr + dr * band / 2 : rEnd) : (r0 + R.stop * dr) * coneRho(R.stop, R.a), px = cx + rs * Math.cos(R.a), py = cy + rs * Math.sin(R.a);   // v0.129: пойман пустым кольцом — до его ячейки
      const holes = R.stop > 0 || R.pass ? [[r0 - dpr, r0 + Math.max(1, dr * band) + dpr]] : [];   // v0.134: вырез строки 1 (v0.139: если открыт) и щели, пройденные лучом
      for (let q = 0; q < R.g.length; q += 2) { const ri = r0 + R.g[q] * dr; holes.push([ri - dpr, ri + Math.max(1, dr * band) + dpr]); }
      beam(R.a, rs, R.pass ? 1 : 0.9, R.pass, holes);
      if (R.pass) { g.fillStyle = cCore; g.shadowColor = cg; g.shadowBlur = lite ? 0 : 16 * dpr; g.beginPath(); g.arc(px, py, Math.max(4 * dpr, dr * 0.15), 0, 2 * Math.PI); g.fill(); g.shadowBlur = 0; }
      else {   // стена — красная дуга поперёк клина (чуть шире его)
        const h = Math.max(hs, 1.5 * dpr / Math.max(1, rs)) + Math.max(hw * 0.5, 3 * dpr) / Math.max(1, rs);
        g.strokeStyle = cR; g.lineWidth = Math.max(3 * dpr, dr * 0.08); g.beginPath(); g.arc(cx, cy, rs, R.a - h, R.a + h); g.stroke();
        /* v0.134, «пусть лазер, когда светит на границу какого-то кольца, не в щель, подсвечивает её»: край ячейки, в которую луч
           упёрся, светится во всю ячейку; если луч лёг рядом со щелью (ближе трёх её ширин), светится и граница этой щели —
           видно, насколько не довёл. */
        if (R.wall) {
          const b = R.wall[0], n = Z.rows[b].length, st = 2 * Math.PI / n, rot = coneRotOf(b), gp = n > 1 ? coneSlitHalf(n) : 0, ri = r0 + b * dr, ro = ri + Math.max(1, dr * band);
          const a0 = -Math.PI / 2 + (R.wall[1] - rot) * st;
          g.save(); g.shadowColor = cR; g.shadowBlur = lite ? 0 : 12 * dpr; g.strokeStyle = cR; g.lineWidth = Math.max(2.5 * dpr, dr * 0.07); g.lineCap = "butt";
          g.beginPath(); if (n > 1) coneArc(g, cx, cy, b, ri, a0 + gp, a0 + st - gp); else { g.moveTo(cx + ri, cy); g.arc(cx, cy, ri, 0, 2 * Math.PI); } g.stroke();
          const u = (R.a + Math.PI / 2) / st + rot, ab = -Math.PI / 2 + (Math.round(u) - rot) * st;
          if (n > 1 && Math.abs(u - Math.round(u)) * st < 3 * Math.max(hs, gp)) {
            g.strokeStyle = cg; g.shadowColor = cg; g.lineWidth = Math.max(2 * dpr, dr * 0.05);
            for (const e of [ab - gp, ab + gp]) { g.beginPath(); g.moveTo(cx + ri * Math.cos(e), cy + ri * Math.sin(e)); g.lineTo(cx + ro * Math.cos(e), cy + ro * Math.sin(e)); g.stroke(); }
          }
          g.restore();
        }
      }
    }
    for (const F of coneClockFlash)   // прошёл между кадрами — вспышка, гаснет за 0,9 с
      beam(F.a, F.j !== undefined && F.j < coneRingsTotal(N) ? r0 + F.j * dr + dr * band / 2 : rEnd, Math.max(0, 1 - (tNow - F.t) / 900), true);
    g.restore();
  }
  // метка «начала» строк — сверху: сюда встаёт бит 0
  g.strokeStyle = cg; g.lineWidth = 1 * dpr; g.beginPath(); g.moveTo(cx, cy - rMax + 2 * dpr); g.lineTo(cx, cy - rMax - 14 * dpr);   /* v0.086: метка начала — короткий штрих снаружи колец, а не черта от центра (её принимали за луч) */ g.globalAlpha = 0.5; g.stroke(); g.globalAlpha = 1;
  if (coneBitHover && coneBitHover.i < N && Z.rows[coneBitHover.i] && shown(coneBitHover.i)) {   // v0.173: бит под мышью — золотой рамкой
    const { i, j } = coneBitHover, n = Z.rows[i].length, rin = r0 + i * dr, rout = rin + Math.max(1, dr * band), step = 2 * Math.PI / n, a = -Math.PI / 2 + (j - coneRotOf(i)) * step;
    g.beginPath(); coneArc(g, cx, cy, i, rout, a, a + step); coneArc(g, cx, cy, i, rin, a + step, a, true); g.closePath();
    g.strokeStyle = cg; g.lineWidth = 2 * dpr; g.globalAlpha = 1; g.stroke();
  }
  }   // v0.082: конец плоского вида
  if (spin2d) g.restore();
  // текст
  const i = Z.cur, s = cur(), k = nk[i], key = s.length + ":" + k.canon, mates = (groups.get(key) || []).filter(j => j !== i);
  const multi = [...groups.values()].filter(v => v.length > 1);
  $("coneOut").innerHTML =
    // v0.148: строки «под мышью» / «наведи на кольцо» больше нет — видимых подсказок не делаем (слово пользователя)
    (mirMap.has(i) ? (() => { const MI = mirMap.get(i); return MI.odd ? `Через центр 180° (кольцо ${s.length} бит — нечётное): напротив каждого бита граница, то есть пара бит. Совпал с обоими <b>${MI.both}</b> (зелёные), с одним <b>${MI.one}</b> (золотые), ни с одним <b>${MI.none}</b> (красные).` +
      (() => { if (!Z.rows[i + 1]) return "\n"; let o = 0, z = 0, b = 0, same = 0; const n = s.length, rot = coneRotOf(i), step = 2 * Math.PI / n;
        for (let j = 0; j < n; j++) { const h = coneOuterHit(i, -Math.PI / 2 + (j + MI.k + 1 - rot) * step); if (!h) continue; if (h.boundary) b++; else { if (h.bit === "1") o++; else z++; if (h.bit === s[j]) same++; } }
        return ` Дальше лучи уходят во внешнее кольцо ${i + 1} (${Z.rows[i + 1].length} бит): в единицу <b>${o}</b>, в ноль <b>${z}</b>` + (b ? `, в границу ${b}` : "") + `; в такой же бит, как исходный, — ${same}.\n`; })()
      : MI.c180 ? `Через центр 180°: пар «бит — бит напротив» ${s.length / 2}, равных ${MI.f / 2} (зелёные), разных ${(s.length - MI.f) / 2}.\n`
      : `Ось кольца №${MI.m}${MI.m === s.length - 1 ? " (как у строки ⇄)" : ""}: неподвижных <b>${MI.f}</b> из ${s.length} (красные), лучшая ось даёт ${MI.bestF}` + (MI.bestF === s.length ? " — кольцо зеркально само себе" : "") + `.\n`; })() : "") +
    (clockRays && clockRays.length ? (() => { const p = clockRays.filter(R => R.pass);   // v0.116
      const dv = Z.coneAimRot ? ` (строка 1 довёрнута на ${Math.round(Z.coneAimRot * 10) / 10}°)` : "";
      const hv = Object.values(coneVoidHits()), vt = hv.length ? ` Пустые кольца: помечено ячеек ${hv.length}, проходов через них ${hv.reduce((s, x) => s + x, 0)}, больше всех — ${Math.max(...hv)} раз.` : "";   // v0.127
      if (clockRays.length === 1) return (p.length ? `⌖ Лазер (вверх) через вырез${dv} проходит все строки` + (p[0].cell >= 0 ? ` — в строке для заполнения ячейка ${p[0].cell + 1}` : " — в строке для заполнения между ячейками") + (p[0].cell < 0 ? (p[0].vstop < coneRingsTotal(Math.min(Z.rows.length, CONE_MAX)) ? `, ловит пустое кольцо ${p[0].vstop + 1} (ячейка ${p[0].cells[0][1] + 1})` : ", и через щели всех пустых колец — за край") : "") + "." : (clockRays[0].stop ? `⌖ Лазер (вверх) через вырез${dv} — луч держит стена кольца ${clockRays[0].stop + 1}.` : `⌖ Лазер стоит вверх, вырез строки 1 в стороне${dv} — выход закрыт, луч упирается в строку 1. Крути (▶, рукой, ⌖◁ ⌖▷) — откроется, когда вырез пройдёт мимо лазера.`)) + vt + "\n";
      return `⌖ Лучей из строки 1 — ${clockRays.length}: до края доходят ${p.length}${p.length ? " (ячейки " + p.map(R => R.cell + 1).join(", ") + ")" : ""}, остальные держат стены.\n`; })() : "") +
    `${coneLocked(i) ? "🔒" : "🔓"} Кольцо ${i + 1} ${coneLocked(i) ? "заперто" : "открыто"}${Z.coneLocks && Z.coneLocks[i] !== undefined ? " (свой замок)" : " (по общей галке)"}` + ((coneRot[i] || 0) ? `, повёрнуто на вид на ${Math.round(coneRot[i])}` : "") + `.\n` +
    `Строка ${i + 1}: ${s.length} бит — кольцо встаёт в <b>${k.orbit}</b> ${k.orbit === 1 ? "положение (как ни крути — то же)" : "разных положений"}; ` +
    `наименьший вид <span class="mono">${bitsPlain(k.canon.length > 80 ? k.canon.slice(0, 80) + "…" : k.canon)}</span> — до него повернуть на ${k.shift}.\n` +
    (mates.length ? `То же кольцо, что у строк: ${mates.slice(0, 20).map(j => j + 1).join(", ")}${mates.length > 20 ? "…" : ""}.\n` : "") +
    `Разных колец <b>${groups.size}</b> на ${Z.rows.length} строк` + (multi.length ? `; совпадающих групп ${multi.length}: ` + multi.slice(0, 8).map(v => v.slice(0, 6).map(j => j + 1).join("=") + (v.length > 6 ? "…" : "")).join(" · ") : "") +
    (Z.rows.length > CONE_MAX ? `.\nНарисованы первые ${CONE_MAX} колец из ${Z.rows.length}.` : ".") +
    (coneZoom !== 1 ? ` Масштаб ×${coneZoom.toFixed(coneZoom < 10 ? 1 : 0)}.` : "");
  // v0.092: таблица строк у конуса убрана — замки у номеров строк в поле
}
/* v0.088, «справа сделай таблицу с номерами строк — замков, строк, как в поле строк; теперь его свернём, а это — на первое
   место, просто то будет дублем». Справа от конуса — строки столбика: номер, замок кольца (🔒 заперто / 🔓 открыто; золотая
   рамка — свой замок, без рамки — по общей галке), сама строка в цветах поля (неподвижные — как в поле), «↻k» — кольцо
   повёрнуто на вид. Щелчок — текущая, Ctrl + щелчок — выделить (то же выделение, что в поле), щелчок по замку — запереть /
   отпереть это кольцо. Перерисовывается, только когда что-то из этого поменялось. */
let coneListKey = "";
function renderConeList(){
  const L = $("coneList"); if (!L) return;
  const only = !!Z.coneOnlySel;
  const key = Z.cur + "|" + [...rowSel].join(",") + "|" + JSON.stringify(Z.coneLocks || {}) + "|" + (Z.coneLock !== false) + "|" + Z.showFix + "|" + only + "|" +
    coneRot.map(x => Math.round(x || 0)).join(",") + "|" + Z.rows.join("|");
  if (key === coneListKey) return;
  const curChanged = coneListKey.split("|")[0] !== String(Z.cur);
  coneListKey = key;
  const N = Math.min(Z.rows.length, 400);
  let h = "";
  for (let i = 0; i < N; i++) {
    const lk = coneLocked(i), own = Z.coneLocks && Z.coneLocks[i] !== undefined, rr = Math.round(coneRot[i] || 0);
    const hid = only && !(rowSel.has(i) || i === Z.cur);
    h += `<div class="cl${i === Z.cur ? " cur" : ""}${rowSel.has(i) ? " sel" : ""}${hid ? " hid" : ""}" data-r="${i}"><span class="cn">${i}</span>` +
      `<button class="clk${own ? " own" : ""}" data-l="${i}" title="${lk ? "Заперто — крутится только на вид" : "Открыто — крутится сама строка"}${own ? " (свой замок)" : " (по общей галке)"} · щелчок — ${lk ? "отпереть" : "запереть"}">${lk ? "🔒" : "🔓"}</button>` +
      `<span class="cb">${bitsShow(Z.rows[i])}</span>${rr ? `<span class="cr">↻${rr}</span>` : ""}</div>`;
  }
  if (Z.rows.length > N) h += `<div class="dim" style="padding:2px 6px">… ещё ${Z.rows.length - N} строк</div>`;
  const st = L.scrollTop; L.innerHTML = h; L.scrollTop = st;
  if (curChanged) { const c = L.querySelector(".cl.cur"); if (c && (c.offsetTop < L.scrollTop || c.offsetTop > L.scrollTop + L.clientHeight - 20)) L.scrollTop = Math.max(0, c.offsetTop - L.clientHeight / 2); }
}

/* v0.080, «теперь, когда видим кольца, нужен для них другой реверс — неменяемых; всё, что через центр, как-то должно
   реагировать». Зеркало кольца — ось через центр. На кольце начала нет, поэтому осей n: отражение с номером m кладёт бит j
   на место (m − j) mod n; обычный ⇄ строки — ось m = n − 1. Неподвижные — биты, равные своему отражению. «Через центр
   180°» — пары диаметрально напротив (j и j + n/2). coneAxisM: номер оси для кольца по режиму. */
/* v0.083, «похоже, луч, проходящий между битов, надо продолжать во внешнее кольцо!» У нечётного кольца прямая от бита через
   центр выходит в границу между битами; дальше она продолжается наружу и попадает в следующее (внешнее) кольцо — в какой-то бит
   или снова в границу. coneOuterHit: куда в кольце i+1 попадает угол a — номер бита и не граница ли (с точностью до 1e-6 шага). */
function coneOuterHit(i, a){
  const s2 = Z.rows[i + 1]; if (!s2) return null;
  const n2 = s2.length, st2 = 2 * Math.PI / n2, rot2 = coneRotOf(i + 1);
  const u = (a + Math.PI / 2) / st2 + rot2, fl = Math.floor(u + 1e-9), fr = u - fl;
  const j = ((fl % n2) + n2) % n2;
  return { j, bit: s2[j], boundary: fr < 1e-6 || fr > 1 - 1e-6, pair: s2[((j - 1) % n2 + n2) % n2] + s2[j] };
}
/* v0.116, «пусть с центра через все кольца в стороны проходит луч, который проходит между границами битов, и когда он дойдёт
   моментом хоть до нижней строки — то место, куда он упадёт, пометить 1; как часы, между зубьями; а так луч держится стенами
   колец; в 1 строке». Галка «⌖ луч-часы»: луч выходит из центра через каждую границу строки 1 (у строки из одного бита граница
   одна — стрелка часов). Кольцо он проходит только в щель — там, где у кольца граница бит (шириной щели — coneSlitHalf, v0.124); попал на
   бит — стена, луч там и стоит. Прошёл все кольца (до нижней строки над чертой включительно) — ячейка строки для заполнения
   под ним становится «1». Кольца стоят — считается один раз; крутятся (▶ по биту / навстречу) — между кадрами по мелким шагам
   (coneClockSweep), чтобы миг, когда щели сошлись, не проскочил между кадрами. */
/* v0.124: щель — ползунок «щель» (Z.coneSlit, градусов во всю ширину, по умолчанию 2). Луч проходит кольцо, если граница его бит не
   дальше половины щели от середины луча. У кольца с мелкими битами щель не шире 0,9 бита — иначе в щель превратилось бы всё кольцо.
   Та же половина щели — прорезь между битами на рисунке и полуширина клина лазера. */
function coneSlitHalf(n){
  const w = Math.max(0.1, Math.min(20, +Z.coneSlit || 2)) * Math.PI / 360;
  return n ? Math.min(w, Math.PI / n * 0.9) : w;
}
let coneClockFlash = [];                      // вспышки лучей, прошедших между кадрами: { a, t }
/* v0.119, «в 1 строке сделай 4 выреза для направления луча — там я вручную сначала его направлю». В кольце строки 1 — четыре
   выреза: вверх, вправо, вниз, влево (↑ → ↓ ←); они вырезаны в самом кольце и крутятся вместе с ним. Щелчок по кольцу строки 1
   (при ⌖ луч-часах) — луч пойдёт через ближайший вырез (Z.coneAim = 0…3). Прежде луч шёл через границы строки 1 — у строки из
   одного бита это и был единственный «вырез» сверху; теперь направление выбирается. */
/* v0.121, «убери из 1 строки 4 выреза, оставь один»: вырез один — там, где бит 0 строки 1 (сверху, пока кольцо не довёрнуто);
   направление луча задаётся доводом кольца (тянуть мышью, ⌖◁ ⌖▷). Прежний выбор выреза (Z.coneAim) при запуске переводится в довод. */
function coneAim(){ return 0; }
function coneAimAngle(q){ const n0 = (Z.rows[0] || "1").length || 1; return -Math.PI / 2 + (q === undefined ? coneAim() : q) * Math.PI / 2 - coneRotOf(0) * 2 * Math.PI / n0; }
/* v0.139, «а в самом начале, когда лазер из центра идёт в 1 строку, то его положение относительно выхода из 1 кольца, где одна щель,
   установи в противоположной стороне, сам лазер пусть стоит неподвижно», «и направлен вверх»: лазер — неподвижный, всегда вверх.
   Вырез строки 1 в начале — внизу, напротив него, и крутится вместе с кольцом строки 1 (кручением ▶, рукой, ⌖◁ ⌖▷). Выход открыт,
   только когда вырез проходит мимо лазера (в пределах щели), — тогда луч идёт наружу; иначе упирается в кольцо строки 1 изнутри.
   Строка 1 так и остаётся затвором: остановка колец её не трогает. */
/* v0.191, «после вылета — как начать ещё на том же рисунке бит» → «просто когда лазер вылетает, сделай 45°: следующий лазер становится
   активен, и т. д.»: лазеров восемь, через 45° по часовой (Z.voidHits.lk — номер нынешнего, с 0; первый — вверх). Луч ушёл за край —
   включается следующий, а кольца, которые встали, отпускаются там, где стоят (coneReleaseRings): рисунок бит тот же, дальше крутятся
   с него. После восьмого — пауза. Сброс — вместе с остановленными кольцами (⟲ всё на места, ✕, правый щелчок по ▶, смена режима). */
function coneLaserK(){ return (Z.voidHits && Z.voidHits.lk) | 0; }
/* v0.194, «где задать количество и начальный угол?» (выбрано: просто угол от верха): лазеров N (Z.coneLasers, 1…72, по умолчанию 8),
   шаг — 360°/N; первый — на угле Z.coneLaser0 (градусы по часовой от верха, по умолчанию 0). Поля — в «Лазере», рядом с 🎯. */
function coneLasersN(){ return Math.max(1, Math.min(72, Math.round(+Z.coneLasers) || 8)); }
function coneLaserDegRaw(k){ k = k === undefined ? coneLaserK() : k; return ((((+Z.coneLaser0 || 0) + k * 360 / coneLasersN()) % 360) + 360) % 360; }
function coneLaserDeg(k){ return Math.round(coneLaserDegRaw(k) * 1000) / 1000; }   // v0.202: до тысячных — шаг 1/(1+…+T) круга бывает сотыми долями градуса
/* v0.202, «почему лазер крутится? надо кнопку фикс лазера и стрелку крутить на заданное частей круга, по умолчанию 45» и «ещё на число самой
   длинной, когда все, а все — это 1+2+3+…+T». Лазер крутился вместе со всем конусом («Всё», ⟲ ⟳ — поворот Z.coneSpin): он был нарисован и
   считался в системе конуса. «📌 лазер» (Z.coneLaserFix, по умолчанию включено) — лазер стоит на экране, конус едет под ним: в системе
   конуса угол лазера минус поворот конуса. «↻» поворачивает лазер (и все лучи ✺) на шаг, правый щелчок — назад; шаг — 45°, 1/T круга
   (T — бит в самой длинной строке) или 1/(1+2+…+T) круга (Z.coneLaserStepK: "45" | "T" | "S"). */
function coneLaserFixed(){ return Z.coneLaserFix !== false; }
function coneLaserSpinOff(){ return coneLaserFixed() && !Z.cone3d ? (Z.coneSpin || 0) * Math.PI / 180 : 0; }
function coneMaxLen(){ const N = Math.min(Z.rows.length, CONE_MAX); let m = 1; for (let i = 0; i < N; i++) m = Math.max(m, (Z.rows[i] || "").length); return m; }
function coneLaserStepDeg(){ const k = Z.coneLaserStepK || "45", T = coneMaxLen(); return k === "T" ? 360 / T : k === "S" ? 720 / (T * (T + 1)) : 45; }
function coneLaserAngle(k){ return -Math.PI / 2 + coneLaserDegRaw(k) * Math.PI / 180 - coneLaserSpinOff(); }
/* v0.201, «сделай, чтобы в лазере лучей было сколько бит в строках — до 256, по кругу из центра; вылетел — его больше нет в круге, и так
   гонять до последнего» (выбрано: все сразу, кольца общие). Кнопка «✺ все лучи» в «Лазере»: лучей столько, сколько бит в самой длинной
   строке конуса (не больше 256), шаг — 360° / число, первый — на угле «от …°». Светят все сразу. Кольца общие: встаёт кольцо, из которого
   вышел любой луч; луч, ушедший за край, гаснет насовсем и отпускает кольца (как смена лазера). Все живые лучи упёрлись в стоящие
   кольца — затор: кольца отпускаются и полбита (во «Встреч Стр» — клетку самой длинной строки) не встают. Погасли все — пауза.
   Погасшие — Z.voidHits.fd { номер: 1 }, отпуск без остановки — Z.voidHits.nf { from — фаза, span }. */
function coneFanOn(){ return !!Z.coneFan && !!Z.coneClock && !Z.coneSun; }   // v0.206: солнце главнее
function coneFanN(){ const N = Math.min(Z.rows.length, CONE_MAX); let m = 1; for (let i = 0; i < N; i++) m = Math.max(m, (Z.rows[i] || "").length); return Math.min(256, m); }
function coneFanAngle(k){ return -Math.PI / 2 + ((+Z.coneLaser0 || 0) + k * 360 / coneFanN()) * Math.PI / 180 - coneLaserSpinOff(); }   // v0.202: 📌 — на экране стоит
function coneFanDead(){ const V = Z.voidHits; if (!V) return {}; if (!V.fd || typeof V.fd !== "object") V.fd = {}; return V.fd; }
function coneFanAlive(){ const fd = coneFanDead(), M = coneFanN(), out = []; for (let k = 0; k < M; k++) if (!fd[k]) out.push(k); return out; }
function coneFanStuck(R){   // луч упёрся в стоящее кольцо — сам не сдвинется
  if (!R.stop && !R.pass) return coneRingFrozen(0);
  if (R.wall) return coneRingFrozen(R.wall[0]);
  if (R.pass && R.cells.length) return coneRingFrozen(R.cells[0][0]);
  return false;
}
function coneFanStep(tr){   // вылетевшие за край — гаснут; затор — отпустить кольца. → { out — погасло сейчас, left — живых, freed — затор разобран }
  coneVoidHits(); const V = Z.voidHits, fd = coneFanDead(); let out = 0, freed = false;
  for (const R of tr) if (R.k !== undefined && R.pass && !R.cells.length && coneRingFrozen(0)) { fd[R.k] = 1; out++; delete coneWallWasM[R.k]; }
  if (out) { coneReleaseRings(); coneLogDirty(); }
  else {
    const alive = tr.filter(R => R.k !== undefined && !fd[R.k]);
    if (alive.length && alive.every(coneFanStuck) && coneReleaseRings() > 0) {
      const m = Z.coneSpinMode || "all";
      V.nf = { from: Z.coneSpinPh || 0, span: coneBitMode(m) ? 0.5 : 360 / coneFanN() };
      freed = true; coneLogDirty();
    }
  }
  return { out, left: coneFanAlive().length, freed };
}
function coneFanClampDph(dph, m){   // у ✺ за кадр — не больше шагов, чем успеем просчитать (иначе луч проскочит щели): крутится медленнее
  const N = Math.min(Z.rows.length, CONE_MAX); if (!N || !dph) return dph;
  let maxDeg = 0; for (let i = 0; i < N; i++) maxDeg = Math.max(maxDeg, coneBitMode(m) ? Math.abs(dph) * 360 / (Z.rows[i].length || 1) : Math.abs(dph));
  let tolDeg = coneSlitHalf() * 180 / Math.PI; for (let i = 1; i < N; i++) tolDeg = Math.min(tolDeg, coneSlitHalf(Z.rows[i].length || 1) * 180 / Math.PI);
  const need = maxDeg / tolDeg, cap = coneFanStepsCap(N);
  return need > cap ? dph * cap / need : dph;
}
/* v0.206, «первая строка — там один бит, круг — это солнце, оно всегда светит; дальше если 11, то там две щели, размер щелей — ширина
   луча, одинаковая; и так дальше: из 11 всегда два луча» и «ещё настройку, где 1 — не часть круга как бит, а вырез, из которого идёт луч
   его ширины» (выбрано: ширина выреза — 360° / число единиц в строке), «между битами тут щелей нет, работает без щелей».
   Кнопка «☀ солнце» в «Лазере» (Z.coneSun): строка 1 — солнце в центре, светит всегда и во все стороны, выреза-затвора нет. Свет идёт
   наружу кольцо за кольцом как набор освещённых секторов (углы от верха по часовой, в системе конуса):
   · пропуск «щели» (Z.coneSunCut = "gaps") — кольцо пропускает свет только в щелях между битами (ширина — ползунок «щель»): у «11» — два луча;
   · пропуск «1 — вырез» ("ones") — щелей нет; каждая «1» строки — окно шириной 360° / число единиц этой строки по центру своей ячейки,
     «0» — стена; строка для заполнения — сплошная стена, ловит весь дошедший свет.
   Ячейка, на которую упал свет (стена под освещённым сектором), красится, как от лазера: при каждом новом освещении — единица в счёт
   (Z.voidHits.h), её видно на конусе и в «✎ в поле 2». Кольца от солнца не встают, лучи не гаснут. */
function coneSunOn(){ return !!Z.coneSun && !!Z.coneClock; }
/* v0.208, по снимку «☀ солнце · 1 — вырез» — «в этом режиме у битов не должно быть щелей; щель тут — 0, вся его длина, а 1 — это стена»:
   второй пропуск теперь «0 — проход, 1 — стена» ("zero"; прежнее "ones" читается так же): щелей между битами нет, каждый «0» пропускает
   свет во всю ширину своей ячейки, «1» — стена; на рисунке у колец нет прорезей между битами. Окно «360° / число единиц» (v0.206) убрано. */
function coneSunCut(){ return Z.coneSunCut === "zero" || Z.coneSunCut === "ones" ? "zero" : "gaps"; }
/* v0.216, по снимку краски с чёрными прорезями — «щелей не должно быть, назови «Без щелей»»: пропуск «zero» зовётся «Без щелей»; в нём нет
   прорезей ни у колец строк, ни у закрашенных светом ячеек, ни у строки для заполнения. */
function coneNoGap(){ return coneSunOn() && coneSunCut() === "zero"; }
const TAU2 = 2 * Math.PI;
function ivNorm(lo, hi, out){   // [lo, hi] → в [0, 2π), с разрезом через 0
  const w = hi - lo; if (w <= 0) return;
  if (w >= TAU2) { out.push([0, TAU2]); return; }
  const a = ((lo % TAU2) + TAU2) % TAU2, b = a + w;
  if (b <= TAU2) out.push([a, b]); else { out.push([a, TAU2]); out.push([0, b - TAU2]); }
}
function ivUnion(L){ L.sort((x, y) => x[0] - y[0]); const o = []; for (const [a, b] of L) { const t = o[o.length - 1]; if (t && a <= t[1]) t[1] = Math.max(t[1], b); else o.push([a, b]); } return o; }
function ivAnd(A, B){ const o = []; let i = 0, j = 0; while (i < A.length && j < B.length) { const lo = Math.max(A[i][0], B[j][0]), hi = Math.min(A[i][1], B[j][1]); if (hi > lo) o.push([lo, hi]); if (A[i][1] < B[j][1]) i++; else j++; } return o; }
function ivMinus(A, B){
  const o = []; let j = 0;
  for (const [a0, a1] of A) {
    let lo = a0; while (j < B.length && B[j][1] <= lo) j++;
    for (let k = j; k < B.length && B[k][0] < a1; k++) { if (B[k][0] > lo) o.push([lo, B[k][0]]); lo = Math.max(lo, B[k][1]); }
    if (lo < a1) o.push([lo, a1]);
  }
  return o;
}
function coneSunOpen(b, N, R){   // открытые места кольца b: [[от, до]] в [0, 2π)
  const n = R.n, st = TAU2 / n, out = [];
  if (coneSunCut() === "zero") {   // v0.208: «0» — проход во всю ячейку, «1» — стена, щелей нет
    if (b >= N) return [];   // строка для заполнения и пустые — сплошные
    const s = Z.rows[b];
    for (let j = 0; j < n; j++) if (s[j] === "0") ivNorm((j - R.rot) * st, (j + 1 - R.rot) * st, out);
  } else { const h = coneSlitHalf(n); for (let q = 0; q < n; q++) { const c = (q - R.rot) * st; ivNorm(c - h, c + h, out); } }
  return ivUnion(out);
}
function coneSunTrace(){   // → { bands: [[кольцо, свет перед ним]], hits: ["кольцо:ячейка"], out: свет за последним кольцом, end }
  const N = Math.min(Z.rows.length, CONE_MAX), T = coneRingsTotal(N), bands = [], hits = new Set();
  let lit = [[0, TAU2]], b = 1;
  for (; b < T && lit.length; b++) {
    const R = coneRingNR(b); if (!R) break;
    bands.push([b, lit]);
    const open = coneSunOpen(b, N, R), st = TAU2 / R.n;
    for (const [lo, hi] of ivMinus(lit, open)) {
      if (hi - lo < 1e-9) continue;
      const u0 = Math.floor(lo / st + R.rot + 1e-7), u1 = Math.ceil(hi / st + R.rot - 1e-7);   // v0.208: касание границы — не соседняя ячейка
      for (let u = u0; u < u1 && u - u0 < R.n; u++) hits.add(b + ":" + (((u % R.n) + R.n) % R.n));
    }
    lit = ivAnd(lit, open);
  }
  return { bands, hits: [...hits], out: lit, end: b };
}
/* v0.208, «в этом режиме сделай неактивными те кнопки, которые не влияют» (по снимку «щель» и «⌖→ след.»): при ☀ гаснут всё лазерное —
   довод строки 1, ⏸ на проходе, 🔮, 🎯 с номером, число лазеров и «от …°», ⌖→ след., 📌 лазер, ↻ с шагом; при «0 — проход» ещё «щель» и
   «пустые до 256» (свет ловит строка для заполнения). Список пропуска неактивен, пока солнце выключено. */
const CONE_SUN_OFF = ["bConeAimL", "bConeAimR", "bConeClockStop", "bConePred", "bConeGo", "coneGoN", "coneLasersN", "coneLaser0", "bLaserChain", "bLaserFix", "bLaserTurn", "coneLaserStepK"];
function coneSunUi(){
  const sun = coneSunOn(), zero = sun && coneSunCut() === "zero";
  const set = (id, off) => { const el = document.getElementById(id); if (!el) return; el.disabled = off; const lb = el.closest("label"); if (lb) lb.classList.toggle("dis", off); };
  CONE_SUN_OFF.forEach(id => set(id, sun));
  set("coneSlit", zero); set("coneVoid", zero); set("coneSunCut", !sun);
  { const lb = document.getElementById("coneClock"); if (lb && lb.closest("label")) lb.closest("label").classList.toggle("sunmode", sun); }   // v0.208: либо лазер, либо солнце — горит одно
}
let coneSunWas;   // ячейки, освещённые на прошлом шаге; undefined — ещё не смотрели (тогда красим только нетронутые)
function coneSunPaint(){
  const S = coneSunTrace(), now = new Set(S.hits), first = coneSunWas === undefined, h = coneVoidHits(); let ch = false;
  for (const k of now) if (first ? !h[k] : !coneSunWas.has(k)) { h[k] = (h[k] | 0) + 1; ch = true; }
  coneSunWas = now;
  if (ch) coneLogDirty();
  return ch;
}
function coneFanStepsCap(N){ return 2000; }   // шагов за кадр — как у одного лазера; сколько успеем, решает время (coneClockSweep, ~12 мс)
function coneCutAngle(){ return coneAimAngle() + Math.PI; }
function coneAngDiff(x, y){ let d = (x - y) % (2 * Math.PI); if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; return d; }
function coneCutOpen(){ return Math.abs(coneAngDiff(coneCutAngle(), coneLaserAngle())) <= coneSlitHalf(); }
/* v0.120, «дай возможность ось соединять вручную со следующим кольцом в щели, при этом крутя внутреннее кольцо, а не внешнее».
   Кольцо строки 1 (с вырезами) при луч-часах крутится мышью само по себе и плавно — не целыми битами (у строки из одного бита
   целый бит — это полный оборот), — на Z.coneAimRot градусов; остальные кольца стоят. Когда луч подходит к щели кольца 2 (границе
   его бит) ближе ~10 пикселей, кольцо защёлкивается — луч ровно в щели. «⌖◁ ⌖▷» — луч в соседнюю щель кольца 2, правый щелчок —
   довод снят. */
/* v0.131, «не идёт лазер дальше 2 строки, хотя проход есть»: довод ставил луч ровно в середину щели кольца 2. Щель кольца 3
   (после ▶ с паузой кольца стоят не на целых битах) могла лежать чуть в стороне — щели перекрываются, проход есть, а середина
   луча уже мимо, и он упирался в стену. Теперь луч встаёт в середину общего прохода: берём щель кольца 2, пересекаем со щелью
   кольца 3, 4… пока пересечение не пусто — луч в его середину, так он проходит все кольца, через которые проход вообще есть. */
/* v0.133, «не идёт дальше 2» (одна строка «1»): довод искал щели только в кольце строки 2 — а когда строка одна, следующее
   кольцо — строка для заполнения, за ней пустые; довода не было, рукой в щель шириной 2° не попасть, и луч упирался в строку для
   заполнения. Теперь кольца для довода — все подряд: строки, строка для заполнения, пустые до 256 (как их видит луч). */
function coneRingNR(b){   // кольцо b ≥ 1 на пути луча: { n — ячеек, rot — поворот в ячейках } или null — колец больше нет
  const N = Math.min(Z.rows.length, CONE_MAX);
  if (b < N) { const n = Z.rows[b].length; return n ? { n, rot: coneRotOf(b) } : null; }
  if (Z.cone3d || Z.rows.length > CONE_MAX || b >= coneRingsTotal(N)) return null;
  const n = coneVoidLen(b, N); return { n, rot: coneVoidRot(b, n) };
}
/* v0.198, «скорость надо больше возможностей»: ползунок кручения — по логарифму, 1…3600 (было 5…120 ровным шагом), рядом — число. */
function spinSpOf(p){ const v = Math.pow(3600, p / 100); return v < 10 ? Math.round(v * 10) / 10 : Math.round(v); }
function spinPosOf(sp){ return Math.max(0, Math.min(100, Math.round(100 * Math.log(Math.max(1, sp)) / Math.log(3600)))); }
function spinSpUi(){
  const v = Math.abs(Z.coneAutoSp ?? 30), el = $("coneAutoSpV"); if (!el) return;
  const f = (x) => x < 10 ? (Math.round(x * 10) / 10).toString().replace(".", ",") : Math.round(x);
  el.textContent = coneBitMode(Z.coneSpinMode || "all") ? f(v / 10) + " бит/с" : f(v) + "°/с";
}
function coneDirUi(){   // v0.136: ползунок — величина скорости, кнопка — направление
  const sp = Z.coneAutoSp ?? 30; if (!sp) Z.coneAutoSp = 30;
  $("coneAutoSp").value = spinPosOf(Math.abs(sp || 30)); $("bConeDir").textContent = sp < 0 ? "↺ против" : "↻ по часовой"; spinSpUi();
  const d3 = $("bC3Dir"); if (d3) d3.textContent = sp < 0 ? "↺" : "↻";   // v0.279: направление и в пульте
  coneSpinModeUi();
}
function coneSpinModeUi(){   // v0.279, «это вынеси в кнопки»: режим кручения — кнопками, горит выбранный (список coneSpinMode — скрытый, держит значение)
  const m = Z.coneSpinMode || "all"; document.querySelectorAll("#coneSpinModeB > button").forEach(b => b.classList.toggle("on", b.dataset.sm === m));
}
function coneAimDeep(a){
  const gapAt = (R, x) => {   // щель кольца, ближайшая к углу x: [от, до]
    const st = 2 * Math.PI / R.n, c = -Math.PI / 2 + (Math.round((x + Math.PI / 2) / st + R.rot) - R.rot) * st, h = coneSlitHalf(R.n);
    return [c - h, c + h];
  };
  const R1 = coneRingNR(1); if (!R1) return a;
  let [lo, hi] = gapAt(R1, a);
  for (let b = 2, R; (R = coneRingNR(b)); b++) {
    const [l, r] = gapAt(R, (lo + hi) / 2), L = Math.max(lo, l), H = Math.min(hi, r);
    if (H - L < 1e-9) break;   // дальше прохода нет — луч в середину того, что прошёл
    lo = L; hi = H;
  }
  return (lo + hi) / 2;
}
function coneAimSnap(){   // v0.139: тянешь строку 1 — вырез защёлкивается на лазере (ближе ~10 пикселей)
  if (!coneGeom) return false;
  const d = coneAngDiff(coneCutAngle(), coneLaserAngle()), tol = 10 * coneGeom.dpr / Math.max(1, coneGeom.r0 + coneGeom.dr);
  if (Math.abs(d) > tol) return false;
  Z.coneAimRot = (Z.coneAimRot || 0) - d * 180 / Math.PI;
  return true;
}
function coneAimSettle(){
  Z.coneAimRot = (((Z.coneAimRot || 0) % 360) + 540) % 360 - 180;
  save(); renderCone();   // v0.127: довёл до щели вручную — это проход, его засчитает renderCone
  const R = coneClockTrace()[0], deg = Math.round(Z.coneAimRot * 10) / 10, N = Math.min(Z.rows.length, CONE_MAX);
  say(`⌖ Строка 1 довёрнута на ${deg}°` + (!R ? "." : !R.stop && !R.pass ? " — вырез в стороне, выход закрыт: лазер упирается в строку 1." : R.pass ? (R.vstop < coneRingsTotal(N) ? ` — вырез на лазере, луч проходит все строки, ловит кольцо ${R.vstop + 1}.` : " — вырез на лазере, луч проходит все кольца.") : ` — вырез на лазере, луч держит стена кольца ${R.stop + 1}.`));
}
function coneAimStep(d){   // v0.139: ⌖▷ / ⌖◁ — крутить строку 1 по / против часовой, пока вырез не встанет на лазер (открыт → закрыть: напротив)
  const TAU = 2 * Math.PI, x = coneAngDiff(coneLaserAngle(), coneCutAngle());
  let t = coneCutOpen() ? (d > 0 ? Math.PI : -Math.PI) : d > 0 ? ((x % TAU) + TAU) % TAU : -((((-x) % TAU) + TAU) % TAU);
  Z.coneAimRot = (Z.coneAimRot || 0) + t * 180 / Math.PI;
  coneAimSettle();
}
/* v0.127, «хотя не так (выход с остановкой): дострой до 256 строк после последней — пустые, можно еле заметными показать, но если
   луч пройдёт — помечать 1, если 2 и более раз — всё записать в бит, пусть там будет хоть три 111 в одном бите». Снаружи кольца
   для заполнения — пустые кольца до строки 256 (галка «до 256»): каждое на ячейку длиннее предыдущего, как строка для заполнения,
   и крутятся по тем же правилам. Стен у них нет — луч, прошедший строки, идёт сквозь все пустые кольца до края и в каждом
   помечает ячейку, через которую прошёл (попал в границу ячеек в пределах щели — прошёл между ними, ничего не метит). Проход луча
   засчитывается один раз (пока щели держатся вместе — это один проход); каждый проход прибавляет ячейке единицу: 1, 11, 111…
   Счёт — Z.voidHits: { sig, h: { "кольцо:ячейка": сколько } }; сменилось число строк или длина нижней — счёт начинается заново. */
const CONE_VOID_TO = 256;
function coneVoidOn(){ return Z.coneVoid !== false && !!Z.coneClock && !coneNoGap(); }   // v0.216: «Без щелей» — свет ловит строка для заполнения, пустые кольца не нужны   // только при луч-часах — без луча они лишь сжимали бы кольца строк
// сколько колец всего в плоском конусе: строки + кольцо для заполнения (+ пустые до 256)
function coneRingsTotal(N){ return coneVoidOn() ? Math.max(N + 1, CONE_VOID_TO) : N + 1; }
function coneVoidLen(j, N){ const s = Z.rows[N - 1]; return (s ? s.length : 0) + (j - N + 1); }   // кольцо j ≥ N: на ячейку длиннее предыдущего
/* v0.117: кольцо для заполнения (и v0.127: пустые за ним) — как следующие за нижним кольца: «каждое по биту» — на тот же бит, что
   все; «навстречу» — по своей чётности. Ручной накрутки у них нет. */
function coneVoidRot(j, n){
  const m = Z.coneSpinMode || "all", ph = coneRingPh(j);   // v0.138
  if (m === "bit") return -ph;
  if (m === "obit") return -(j % 2 ? -1 : 1) * ph;   // v0.161
  if (m === "opp") return -(j % 2 ? -1 : 1) * ph / 360 * n;
  return 0;
}
/* v0.161, «Встреч Бит — так же, как Каждое, но через строку в одну сторону»: режим obit — каждое кольцо на бит за шаг, как «bit», но
   нечётные (строки 2, 4, …) — в обратную сторону. Всё, что зависит от шага «по биту» (скорость, шаги ◀ ▶, лазер, цикл), — как у «bit». */
function coneBitMode(m){ return m === "bit" || m === "obit"; }
/* v0.138, «в тот момент, когда первая ячейка строки покрасится битом, этот диск (кольцо) останавливай — то есть все внутренние не
   будут крутиться»: лазер впервые закрасил ячейку кольца b (стена, строка для заполнения или пустое) — кольцо b и все внутри него
   (2…b) встают на фазе этого мига и больше не крутятся; внешние крутятся дальше. (v0.139: правило другое — см. coneFreezeRing.) Фазы остановленных —
   Z.voidHits.fz { кольцо: фаза }; стираются вместе с краской (✕ у строки для заполнения, смена строк) и «⟲ всё на места». */
function coneFrozen(){ const V = Z.voidHits; if (!V) return null; if (!V.fz || typeof V.fz !== "object") V.fz = {}; return V.fz; }
function coneRingPh(i){   // v0.191: отпущенное кольцо крутится дальше со своего места — со сдвигом Z.voidHits.off[i]
  const V = Z.voidHits, fz = V && V.fz; if (fz && fz[i] !== undefined) return fz[i];
  return (Z.coneSpinPh || 0) + ((V && V.off && V.off[i]) || 0);
}
function coneRingFrozen(i){ const fz = Z.voidHits && Z.voidHits.fz; return !!fz && fz[i] !== undefined; }
function coneReleaseRings(){   // v0.191: остановленные кольца — отпустить, не сдвигая: их нынешняя фаза становится сдвигом; → сколько отпущено
  const V = Z.voidHits; if (!V || !V.fz) return 0;
  const ph = Z.coneSpinPh || 0, off = V.off && typeof V.off === "object" ? V.off : (V.off = {}); let n = 0;
  for (const k of Object.keys(V.fz)) { off[k] = V.fz[k] - ph; n++; }
  V.fz = {}; return n;
}
/* v0.202, «убери то, что по умолчанию сейчас лазер, когда уходит, — до 8 лазеров, потом следующие; это надо вкл/выкл»: переход к следующему
   лазеру после вылета — кнопка «⌖→ след.» (Z.coneLaserChain, по умолчанию выключено). Выключено — луч вышел за край, и пауза, как до v0.191. */
function coneLaserNextIf(){ return !!Z.coneLaserChain && coneLaserNext(); }
function coneLaserNext(){   // v0.191: следующий лазер (+45°); → false, если все восемь уже были
  coneVoidHits(); const V = Z.voidHits, k = V.lk | 0;
  if (k + 1 >= coneLasersN()) return false;
  coneExArchive(false); V.ex = {}; V.exI = {};   // v0.193: вылеты прежнего лазера — в постоянную статистику
  coneReleaseRings(); V.lk = k + 1; V.lph = Z.coneSpinPh || 0; coneWallWas = undefined; coneClockWas = null; coneLogDirty();
  return true;
}
function coneLaserResetAll(){ coneExArchive(true); const V = Z.voidHits; if (V) { V.fz = {}; V.ex = {}; V.exI = {}; V.off = {}; V.lk = 0; V.exH = []; V.lph = Z.coneSpinPh || 0; V.fd = {}; delete V.nf; } coneWallWasM = {}; coneSunWas = undefined; }   // v0.201: и лучи ✺ — снова все
/* v0.193, «всё съело» (после сброса «🚪 Вылет из строк» пуст, а прогноз — от старого набора): вылеты хранились вместе с краской и стирались
   любым сбросом — ⟲, ✕, правым щелчком по ▶, сменой режима или строк. Теперь вылет каждого лазера по окончании (следующий лазер, сброс,
   смена строк) переезжает в постоянную статистику Z.coneExLog — прогон, лазер, старт, режим, строки; стирает её только ✕ в самом блоке.
   Прогон — от сброса до сброса. Хранятся последние 64 лазера. */
const CONE_EXLOG_MAX = 64;
function coneExArchive(endRun){
  const V = Z.voidHits; if (!V) return;
  const ex = V.ex && typeof V.ex === "object" ? V.ex : {}, keys = Object.keys(ex);
  const L = Array.isArray(Z.coneExLog) ? Z.coneExLog : (Z.coneExLog = []), run = Z.coneExRun | 0;
  if (keys.length) {
    const I = V.exI || {};
    L.push({ run, k: V.lk | 0, ang: coneLaserDeg(V.lk | 0), fan: coneFanOn() ? coneFanN() : 0, lph: V.lph || 0, m: V.lm || Z.coneSpinMode || "all", N: parseInt(V.sig, 10) || 0,
             rows: keys.map(Number).sort((x, y) => x - y).map(b => [b, ex[b], I[b] || {}]) });
    if (L.length > CONE_EXLOG_MAX) L.splice(0, L.length - CONE_EXLOG_MAX);
  }
  if (endRun && L.length && L[L.length - 1].run === run) Z.coneExRun = run + 1;
  coneLogDirty();
}
/* v0.139, «то есть кольцо останавливается только в момент выхода лазера из него наружу»: встаёт кольцо, из которого луч вышел —
   строка 1, когда вырез прошёл мимо лазера, дальше — каждое кольцо, чью щель луч прошёл. Краска остановки не вызывает. */
function coneFreezeRing(i){
  const fz = coneFrozen() || (coneVoidHits(), coneFrozen());
  if (fz[i] !== undefined) return false;
  fz[i] = coneRingPh(i); return true;   // v0.191: со сдвигом отпущенного кольца
}
function coneFreezePassed(R){   // кольца, из которых луч вышел: строка 1 (вырез открыт) и все с пройденными щелями; → новые остановленные
  if (!R || !(coneBitMode(Z.coneSpinMode) || Z.coneSpinMode === "opp") || (!R.stop && !R.pass)) return [];
  const nf = Z.voidHits && Z.voidHits.nf;   // v0.201: ✺ — затор только что разобран, кольца пока не встают
  if (nf) { if (Math.abs((Z.coneSpinPh || 0) - nf.from) < nf.span) return []; delete Z.voidHits.nf; }
  const got = []; if (coneFreezeRing(0)) got.push(0);
  for (let q = 0; q < R.g.length; q += 2) if (coneFreezeRing(R.g[q])) got.push(R.g[q]);
  return got;
}
function coneFillRot(){ const N = Math.min(Z.rows.length, CONE_MAX); return coneVoidRot(N, fillLen()); }
function coneVoidHits(){
  const N = Math.min(Z.rows.length, CONE_MAX), s = Z.rows[N - 1], sig = N + ":" + (s ? s.length : 0);
  if (!Z.voidHits || Z.voidHits.sig !== sig || typeof Z.voidHits.h !== "object") { if (Z.voidHits && Z.voidHits.ex) coneExArchive(true); Z.voidHits = { sig, h: {}, lph: Z.coneSpinPh || 0 }; }   // v0.193: вылеты — в статистику
  return Z.voidHits.h;
}
function coneClockTrace(){
  const N = Math.min(Z.rows.length, CONE_MAX), s0 = Z.rows[0]; if (!N || !s0) return [];
  const TAU = 2 * Math.PI, T = coneRingsTotal(N), out = [];
  if (coneSunOn()) return [];   // v0.206: у солнца лучей-лазеров нет — свет считает coneSunTrace
  const rays = coneFanOn() ? coneFanAlive().map(k => [k, coneFanAngle(k)]) : [[undefined, coneLaserAngle()]];   // v0.201: ✺ — все живые лучи
  const cut = coneCutAngle(), cutH = coneSlitHalf();
  for (const [k, a] of rays) {   // v0.139: лазер неподвижный, вверх; выход — вырез строки 1
    if (Math.abs(coneAngDiff(cut, a)) > cutH) { out.push({ a, k, stop: 0, pass: false, cell: -1, cells: [], vstop: T, wall: null, g: [] }); continue; }   // вырез в стороне — выход закрыт
    let b = 1, wall = null; const g = [];   // v0.134: g — щели, сквозь которые прошёл: кольцо, граница (перед ячейкой), подряд
    for (; b < N; b++) {
      const n = Z.rows[b].length; if (!n) break;
      const st = TAU / n, u = (a + Math.PI / 2) / st + coneRotOf(b);
      if (Math.abs(u - Math.round(u)) * st > coneSlitHalf(n)) { wall = [b, ((Math.floor(u) % n) + n) % n]; break; }
      g.push(b, ((Math.round(u) % n) + n) % n);   // на бит — стена (v0.124: щель с ползунка); v0.131: [кольцо, бит] — его красит
    }
    const pass = b >= N, cells = [];   // cells: [кольцо, ячейка] — где луч поймали (кольцо N — для заполнения)
    let cell = -1, vstop = T;
    /* v0.129, «после того как прошли через какое-то кольцо — ловить лазер следующим кольцом, его битами, и т. д.»: пустые кольца —
       тоже стены. Луч идёт дальше только в щель между ячейками; первое пустое кольцо, где он попал в ячейку, его ловит — там луч
       и стоит, и эта ячейка получает единицу. Прошёл щели всех пустых колец — уходит за край, ничего не метит. */
    if (pass) for (let j = N; j < T; j++) {
      const n = coneVoidLen(j, N), st = TAU / n, q = ((((a + Math.PI / 2) % TAU) + TAU) % TAU) / st + coneVoidRot(j, n);
      if (Math.abs(q - Math.round(q)) * st <= coneSlitHalf(n)) { g.push(j, ((Math.round(q) % n) + n) % n); continue; }   // в щель между ячейками — дальше
      const c = ((Math.floor(q) % n) + n) % n;
      cells.push([j, c]); if (j === N) cell = c; vstop = j; break;   // поймало это кольцо
    }
    out.push({ a, k, stop: b, pass, cell, cells, vstop, wall, g });
  }
  return out;
}
// проход луча: ячейкам, через которые он прошёл, — по единице; в строке для заполнения ещё и «1» (как было)
function coneClockRecord(R){}   // v0.134: единицы ячейкам пустых колец ставит coneWallPaint — на каждой смене конца луча, как стенам

/* v0.131, «там должен её покрасить и поставить 1» (луч упёрся в ячейку бита строки 3), «смысл в том, что лазер красит все биты,
   на которые упадёт», «все ячейки изначально пустые»: у колец строк — свой слой краски, сначала пустой. Луч упёрся в бит (стена) —
   эта ячейка закрашивается и получает «1»; упал на неё ещё раз (ушёл и вернулся) — «11», «111»… как у пустых колец. Пока луч стоит
   на той же ячейке, это одно попадание. Биты самих строк не меняются. Счёт — в том же Z.voidHits (ключ «кольцо:бит», кольца строк
   меньше N); ✕ у строки для заполнения стирает и его. */
let coneWallWas;   // куда луч пришёл на прошлом шаге (ключ конца луча); undefined — ещё не смотрели
/* v0.134, «тут надо лог вести: на каком проходе какая ячейка какой строки, и также переход сквозь щель»: всякий раз, когда конец луча
   сменился (упёрся в другую ячейку, пойман другим кольцом, ушёл за край), — запись в «📜 Лог лазера»: номер, угол луча, где он
   кончился и что стало в ячейке (1, 11, 111…), и сквозь какие щели прошёл по пути («стр 2: 2|1» — между ячейками 2 и 1). */
/* v0.186, по логу лазера — «напиши биты на момент вылета из строки каждой» (выбрано: вся строка от щели): когда луч впервые выходит
   из кольца строки, записывается сама строка, прочитанная от щели вылета — с ячейки сразу за щелью, по часовой. Строка 1 — от точки под
   лучом (выход — её вырез). Одна запись на строку, первая; стирается вместе с краской (✕ у строки для заполнения, «⟲ всё на места»,
   правый щелчок по ▶, смена строк). Z.voidHits.ex { номер строки с 0: биты }. */
function coneExitNote(R){
  if (!R || (!R.stop && !R.pass)) return;   // вырез закрыт — луч из строки 1 не вышел
  const N = Math.min(Z.rows.length, CONE_MAX); coneVoidHits();
  const ex = Z.voidHits.ex && typeof Z.voidHits.ex === "object" ? Z.voidHits.ex : (Z.voidHits.ex = {});
  let added = false;
  const exI = Z.voidHits.exI && typeof Z.voidHits.exI === "object" ? Z.voidHits.exI : (Z.voidHits.exI = {});
  const note = (b, kb) => {
    if (b >= N || ex[b] !== undefined) return;
    const s = Z.rows[b]; if (!s) return;
    const n = s.length, k = ((Math.round(kb) % n) + n) % n;
    ex[b] = s.slice(k) + s.slice(0, k); added = true;
    /* v0.192, «покажи номер, статистику: на каком угле начальное положение, из какой вылетел и т. д.»: щель вылета (ячейки слева|справа,
       с 1; у строки 1 — вырез), поворот кольца по часовой от его начала (°) и сколько повернули с включения лазера (фаза). */
    Z.voidHits.lm = Z.coneSpinMode || "all";   // v0.193: режим, в котором вылетал
    exI[b] = { s: b === 0 ? "вырез" : `${((k - 1 + n) % n) + 1}|${k + 1}`, a: Math.round(((((-coneRotOf(b) * 360 / n) % 360) + 360) % 360) * 10) / 10,
               d: (Z.coneSpinPh || 0) - ((Z.voidHits.lph) || 0) };
  };
  { const s0 = Z.rows[0] || "", n0 = s0.length || 1; note(0, (R.a + Math.PI / 2) / (2 * Math.PI / n0) + coneRotOf(0)); }
  for (let q = 0; q < R.g.length; q += 2) note(R.g[q], R.g[q + 1]);
  if (added) coneLogDirty();
}
let coneWallWasM = {};   // v0.201: ✺ — конец каждого луча на прошлом шаге (номер → ключ)
function coneRayKey(R){ return !R ? null : R.wall ? "w" + R.wall : R.pass ? (R.cells.length ? "v" + R.cells[0] : "e") : "s" + R.stop; }
function coneWallPaint(tr){
  if (coneSunOn()) return coneSunPaint();   // v0.206: солнце — свой счёт краски
  if (coneFanOn()) {   // v0.201: все лучи — у каждого свой конец, краска и лог — как у одного
    const N = Math.min(Z.rows.length, CONE_MAX), first = coneWallWas === undefined;
    if (first) coneWallWasM = {};
    coneWallWas = "fan"; let ch = false;
    for (const R of tr) {
      const fzNew = coneFreezePassed(R); if (fzNew.length) ch = true;
      coneExitNote(R);
      const k = coneRayKey(R); if (k === coneWallWasM[R.k]) continue;
      coneWallWasM[R.k] = k;
      if (!k || first) continue;   // загрузка страницы и включение попаданием не считаются
      const h = coneVoidHits(); let cnt = 0;
      if (R.wall) { const hk = R.wall[0] + ":" + R.wall[1]; cnt = h[hk] = (h[hk] | 0) + 1; }
      else if (R.cells.length) { const hk = R.cells[0][0] + ":" + R.cells[0][1]; cnt = h[hk] = (h[hk] | 0) + 1; }
      coneLogAdd(R, cnt, N, fzNew); ch = true;
    }
    return ch;
  }
  const R = tr[0], N = Math.min(Z.rows.length, CONE_MAX), fzNew = coneFreezePassed(R);   // v0.139: вышел из кольца — оно встаёт
  coneExitNote(R);   // v0.186
  const k = !R ? null : R.wall ? "w" + R.wall : R.pass ? (R.cells.length ? "v" + R.cells[0] : "e") : "s" + R.stop, first = coneWallWas === undefined;
  if (k === coneWallWas) return fzNew.length > 0;
  coneWallWas = k;
  if (!k || first) return false;   // загрузка страницы попаданием не считается
  const h = coneVoidHits(); let cnt = 0;
  if (R.wall) { const hk = R.wall[0] + ":" + R.wall[1]; cnt = h[hk] = (h[hk] | 0) + 1; }
  else if (R.cells.length) { const hk = R.cells[0][0] + ":" + R.cells[0][1]; cnt = h[hk] = (h[hk] | 0) + 1; }   // пойман пустым кольцом
  coneLogAdd(R, cnt, N, fzNew);
  return true;
}
/* v0.140, «это всё записывай справа и компактнее»: запись короткая — без угла (лазер всегда вверх), щели и остановленные кольца —
   диапазонами номеров строк («‖2–256»); полная запись (ячейки у каждой щели) — в подсказке при наведении и в копии ⧉. */
function coneRanges(a){
  const v = [...new Set(a)].sort((x, y) => x - y), out = [];
  for (let i = 0; i < v.length; i++) { let j = i; while (j + 1 < v.length && v[j + 1] === v[j] + 1) j++; out.push(j > i ? `${v[i]}–${v[j]}` : `${v[i]}`); i = j; }
  return out.join(",");
}
function coneLogAdd(R, cnt, N, froze){
  const L = Z.coneLog && Array.isArray(Z.coneLog.list) ? Z.coneLog : (Z.coneLog = { n: 0, list: [] });
  L.n = (L.n | 0) + 1;
  const len = (b) => b < N ? Z.rows[b].length : coneVoidLen(b, N), ones = (c) => "1".repeat(Math.min(c, 9)) + (c > 9 ? "(" + c + ")" : "");
  const gs = [], gr = []; for (let q = 0; q < R.g.length; q += 2) { const b = R.g[q], n = len(R.g[q]) || 1, kb = R.g[q + 1]; gr.push(b + 1); gs.push(`${b + 1}: ${((kb - 1 + n) % n) + 1}|${kb + 1}`); }
  const fz = froze && froze.length ? froze.map(x => x + 1) : [];
  const tag = (b) => b === N ? "з" : b > N ? "п" : "";   // з — строка для заполнения, п — пустая
  const short = R.wall ? `▮ ${R.wall[0] + 1}:${R.wall[1] + 1}→${ones(cnt)}`
    : R.pass && R.cells.length ? `◎ ${R.cells[0][0] + 1}${tag(R.cells[0][0])}:${R.cells[0][1] + 1}` + (cnt ? `→${ones(cnt)}` : "")
    : R.pass ? "↗ край" : R.stop ? `■ ${R.stop + 1}` : "■ закрыт";
  const full = R.wall ? `упёрся: стр ${R.wall[0] + 1}, яч ${R.wall[1] + 1} → ${ones(cnt)}`
    : R.pass && R.cells.length ? `пойман: стр ${R.cells[0][0] + 1}${R.cells[0][0] === N ? " (для заполнения)" : R.cells[0][0] > N ? " (пустая)" : ""}, яч ${R.cells[0][1] + 1}` + (cnt ? ` → ${ones(cnt)}` : "")
    : R.pass ? "за край" : R.stop ? `стоп: стр ${R.stop + 1}` : "стоп: выход строки 1 закрыт";
  L.list.push({ n: L.n,
    t: `${L.n} ${R.k !== undefined ? "✺" + (R.k + 1) + " " : ""}${short}` + (fz.length ? ` ⏹${coneRanges(fz)}` : "") + (gr.length ? ` ‖${coneRanges(gr)}` : ""),   // v0.201: ✺ — номер луча
    f: `№${L.n} · ${R.k !== undefined ? "луч " + (R.k + 1) + " · " : ""}${full}` + (fz.length ? ` · встали кольца ${coneRanges(fz)}` : "") + (gs.length ? ` · сквозь щели: ${gs.join(", ")}` : "") });
  if (L.list.length > 1000) L.list.splice(0, L.list.length - 1000);
  coneLogDirty();
}
let coneLogRaf = 0;
function coneLogDirty(){ if (!coneLogRaf) coneLogRaf = requestAnimationFrame(() => { coneLogRaf = 0; coneLogRender(); }); }
/* v0.195, «сразу надо в строки писать биты, заполнив сначала нулями строки соответствующей длины» (выбрано: в поле 2, «1» — куда упал луч):
   кнопка «✎ в поле 2» в «Лазере». Включена — в соседнем поле строк (поле 2; если рабочее — поле 2, то поле 3) столько же строк из нулей
   той же длины, что строки конуса, и ещё строка для заполнения; ячейка, в которую упал луч (стена в строке, поимка строкой для заполнения),
   становится «1» — от всех лазеров вместе, как краска на конусе. Конус и рабочее поле не меняются. Прежнее содержимое того поля при
   включении откладывается (Z.coneOutBak), правый щелчок по кнопке возвращает его. Пишется после каждого события луча (с логом). */
function coneOutLane(){ return Z.lane === 1 ? 2 : 1; }
function coneOutRows(){
  const N = Math.min(Z.rows.length, CONE_MAX), h = (Z.voidHits && Z.voidHits.h) || {}, out = [];
  const row = (b, n) => { let t = ""; for (let c = 0; c < n; c++) t += h[b + ":" + c] > 0 ? "1" : "0"; return t; };
  for (let b = 0; b < N; b++) out.push(row(b, (Z.rows[b] || "").length));
  out.push(row(N, fillLen()));   // строка для заполнения
  return out;
}
function coneOutSync(){
  if (!Z.coneOutOn || !Array.isArray(Z.lanes)) return;
  const t = coneOutLane(), rows = coneOutRows(), was = Z.lanes[t];
  if (Array.isArray(was) && was.length === rows.length && was.every((x, i) => x === rows[i])) return;
  Z.lanes[t] = rows; renderRows(); save();
}
function coneLogRender(){
  coneOutSync();   // v0.195
  const box = $("coneLogBox"); if (!box) return;
  box.style.display = Z.coneClock ? "flex" : "none";
  const list = Z.coneLog && Array.isArray(Z.coneLog.list) ? Z.coneLog.list : [];
  $("coneLogN").textContent = list.length ? `(${list.length}${list.length >= 1000 ? ", последние" : ""})` : "— пока пусто: тяни строку 1, ⌖◁ ⌖▷, ◀ ▶ или ▶ крутить";
  let h = ""; for (let i = list.length - 1, m = 0; i >= 0 && m < 300; i--, m++) h += '<div title="' + esc(list[i].f || list[i].t) + '">' + esc(list[i].t) + "</div>";
  $("coneLog").innerHTML = h;
  /* v0.192, «окно поправь» (видно было только ⌖2 — первый лазер уезжал вверх) и «покажи номер, статистику»: у каждого лазера — заголовок
     (номер, угол лазера, откуда начал, сколько строк прошёл) и таблица: строка, биты от щели, щель вылета, поворот кольца, через сколько
     от включения лазера. Нынешний лазер — сверху. */
  conePredRender();   // v0.193
  const Ls = coneExitLasers(), N = Math.min(Z.rows.length, CONE_MAX), cur = Ls[Ls.length - 1];
  $("coneExN").textContent = (coneFanOn() ? `(✺ живых лучей ${coneFanAlive().length} из ${coneFanN()}: вышли из ${cur.rows.length} из ${N} строк)` : cur.rows.length ? `(лазер ${cur.k + 1} из ${coneLasersN()}: ${cur.rows.length} из ${N} строк)` : `— лазер ${cur.k + 1}: ещё ни из одной строки`) + (Ls.length > 1 ? ` · в статистике ${Ls.length - 1}` : "");
  $("coneEx").innerHTML = Ls.slice().reverse().filter(L => L.rows.length || L === cur).map(L =>
    '<div class="lh">' + esc(coneExitHead(L, N)) + "</div>" + (L.rows.length ? '<table><tr><th>стр</th><th>биты от щели</th><th>щель</th><th>кольцо</th><th>через</th></tr>' +
    L.rows.map(([b, t, I]) => "<tr><td>" + (b + 1) + "</td><td>" + esc(t) + "</td><td>" + esc(I.s || "") + "</td><td>" + (I.a !== undefined ? I.a + "°" : "") + "</td><td>" + (I.d !== undefined ? conePredFmt(I.d, coneBitMode(L.m || Z.coneSpinMode)) : "") + "</td></tr>").join("") + "</table>" : "")).join("");
}
function coneExitLasers(){   // v0.192: все лазеры — [{ k, lph, rows: [[строка, биты, { s щель, a поворот°, d через }]] }], нынешний последним
  const V = Z.voidHits || {}, rowsOf = (ex, I) => Object.keys(ex || {}).map(Number).sort((x, y) => x - y).map(b => [b, ex[b], (I && I[b]) || {}]);
  const out = (Array.isArray(Z.coneExLog) ? Z.coneExLog : []).slice();   // v0.193: постоянная статистика
  out.push({ run: Z.coneExRun | 0, k: coneLaserK(), ang: coneLaserDeg(), fan: coneFanOn() ? coneFanN() : 0, lph: V.lph || 0, m: V.lm || Z.coneSpinMode || "all", N: Math.min(Z.rows.length, CONE_MAX), rows: rowsOf(V.ex, V.exI), live: true });
  return out;
}
function coneExitHead(L, N){
  const mm = L.m || Z.coneSpinMode || "all", bitm = coneBitMode(mm), m = ({ bit: "Каждое", obit: "Встреч Бит", opp: "Встреч Стр", all: "Всё" })[mm];
  return `прогон ${(L.run | 0) + 1} · ` + (L.fan ? `✺ ${L.fan} лучей от ${+Z.coneLaser0 || 0}°` : `⌖${L.k + 1} · лазер ${L.ang !== undefined ? L.ang : L.k * 45}°`) + ` · старт с фазы ${conePredFmt(L.lph, bitm)} · ${m} · вышел из ${L.rows.length} из ${L.N || N} строк` + (L.live ? " · сейчас" : "");
}
function coneExitHist(){   // v0.191: прежние лазеры — [[номер лазера, [[строка, биты]]]]
  const H = Z.voidHits && Array.isArray(Z.voidHits.exH) ? Z.voidHits.exH : [];
  return H.map(([q, ex]) => [q, Object.keys(ex || {}).map(Number).sort((x, y) => x - y).map(b => [b, ex[b]])]);
}
function coneExitRows(){   // [[номер строки с 0, биты от щели]] по порядку строк
  const ex = Z.voidHits && Z.voidHits.ex && typeof Z.voidHits.ex === "object" ? Z.voidHits.ex : {};
  return Object.keys(ex).map(Number).sort((x, y) => x - y).map(b => [b, ex[b]]);
}
/* v0.187, «мы же можем заранее просчитать, что получится на 10 строке?» → «да» на кнопку «🔮 просчитать»: прогон лазера от нынешнего
   положения до конца — без анимации, на копии: тем же шагом, что ◀ ▶ (не шире самой узкой щели), тем же счётом (coneWallPaint —
   остановка колец, краска, вылет из строк). Конец — луч ушёл за край (при ▶ там пауза) или прошёл целый круг (во «Встреч Стр» —
   360°, по биту — длина самой длинной строки). После прогона всё возвращается как было: фаза, краска, лог, остановленные кольца.
   Итог — conePred: у каждой строки угол (бит) вылета и биты от щели, пойманные строкой для заполнения ячейки, чем кончилось. */
let conePred = null;
function conePredict(){
  const m = Z.coneSpinMode || "all", N = Math.min(Z.rows.length, CONE_MAX);
  if (coneSunOn()) return { err: "☀ Солнце светит всегда — вылета у него нет. ▶ крутить — и смотри краску (и ✎ в поле 2)." };   // v0.206
  if (!Z.coneClock) return { err: "⌖ Прогноз — для лазера: включи «луч-часы»." };
  if (m === "all") return { err: "🔮 Во «Всё» кольца друг относительно друга не сдвигаются — луч никуда не продвинется. Выбери Каждое, Встреч Стр или Встреч Бит." };
  if (!N) return { err: "Строк нет." };
  const bak = { ph: Z.coneSpinPh, vh: JSON.stringify(Z.voidHits || null), log: JSON.stringify(Z.coneLog || null), fill: Z.fillCells, n: Z.coneClockN, wall: coneWallWas, wm: JSON.stringify(coneWallWasM) };
  const bitm = coneBitMode(m), dir = (Z.coneAutoSp ?? 30) < 0 ? -1 : 1;
  let tolDeg = coneSlitHalf() * 180 / Math.PI; for (let i = 1; i < N; i++) tolDeg = Math.min(tolDeg, coneSlitHalf(Z.rows[i].length || 1) * 180 / Math.PI);
  const maxLen = Math.max(...Z.rows.slice(0, N).map(s => s.length || 1));
  const perUnit = bitm ? 360 / Math.max(1, Math.min(...Z.rows.slice(0, N).map(s => s.length || 1))) : 1;
  const d = dir * tolDeg / perUnit / 2, span = bitm ? maxLen : 360, steps = Math.min(200000, Math.ceil(span / Math.abs(d)) + 2);
  const ph0 = Z.coneSpinPh || 0, rows = [], fill = [];
  let end = "", endPh = null;
  try {
    coneVoidHits(); Z.voidHits.ex = {}; Z.voidHits.exI = {}; Z.voidHits.lph = Z.coneSpinPh || 0;
    coneWallWas = undefined; coneWallPaint(coneClockTrace());   // нынешний конец луча — отправная точка, не попадание
    const seen = new Set();
    const snap = (ph) => { for (const [b, t] of coneExitRows()) if (!seen.has(b)) { seen.add(b); rows.push([b, ph - ph0, t]); } };
    snap(ph0);
    for (let st = 1; st <= steps; st++) {
      const ph = ph0 + d * st; Z.coneSpinPh = ph;
      const tr = coneClockTrace(), R = tr[0];
      coneWallPaint(tr); snap(ph);
      for (const Q of coneFanOn() ? tr : [R]) if (Q && Q.pass && Q.cells.length && Q.cells[0][0] === N && !fill.includes(Q.cells[0][1])) fill.push(Q.cells[0][1]);
      if (coneFanOn()) { if (!coneFanStep(tr).left) { end = "edge"; endPh = ph - ph0; break; } }   // v0.201: ✺ — пока не вылетят все
      else if (R && R.pass && !R.cells.length) { end = "edge"; endPh = ph - ph0; break; }
    }
    if (!end) { end = "cycle"; endPh = d * steps; }
  } finally {
    Z.coneSpinPh = bak.ph; Z.voidHits = JSON.parse(bak.vh); if (!Z.voidHits) delete Z.voidHits;
    Z.coneLog = JSON.parse(bak.log); if (!Z.coneLog) delete Z.coneLog;
    Z.fillCells = bak.fill; Z.coneClockN = bak.n; coneWallWas = bak.wall; coneWallWasM = JSON.parse(bak.wm);
  }
  return { m, bitm, rows, fill, end, endPh, N, sig: conePredSig() };
}
function conePredFmt(v, bitm){ return bitm ? (Math.round(Math.abs(v) * 100) / 100) + " бит" : (Math.round(Math.abs(v) * 10) / 10) + "°"; }
function conePredSig(){ return (Z.coneSpinMode || "all") + "|" + Z.rows.slice(0, CONE_MAX).join(","); }   // v0.193: прогноз — для этих строк и режима
function conePredRender(){
  const box = $("conePred"); if (!box) return;
  if (conePred && conePred.sig !== conePredSig()) conePred = null;   // v0.193: строки или режим сменились — прежний прогноз не показывать
  const P = conePred;
  if (!P) { $("conePredN").textContent = "— 🔮 просчитать в «Лазере»"; box.innerHTML = ""; return; }
  $("conePredN").textContent = `(${({ bit: "Каждое", obit: "Встреч Бит", opp: "Встреч Стр" })[P.m] || P.m}: вылетит строк ${P.rows.length} из ${P.N})`;
  let h = P.rows.map(([b, v, t]) => '<div><b>' + (b + 1) + '</b> <i>' + conePredFmt(v, P.bitm) + '</i> ' + esc(t) + "</div>").join("");
  h += '<div class="pend">' + (P.end === "edge" ? "↗ за край через " + conePredFmt(P.endPh, P.bitm) : "за круг (" + conePredFmt(P.endPh, P.bitm) + ") за край не вышел") +
       " · строка для заполнения: " + (P.fill.length ? "«1» в ячейках " + P.fill.map(c => c + 1).join(", ") : "ничего не поймала") + "</div>";
  box.innerHTML = h;
}
function coneClockMark(hits){
  let f = fillDraft(); const ch = [];
  for (const h of hits) if (h.cell >= 0 && h.cell < f.length && f[h.cell] !== "1") { f = f.slice(0, h.cell) + "1" + f.slice(h.cell + 1); ch.push(h.cell + 1); }
  if (!ch.length) return;
  f = f.replace(/\./g, "0");   // v0.136, «когда бит покрасил в строке — покажи остальные нулями, заполни»: лазер поставил «1» — пустые ячейки строки становятся 0
  Z.fillCells = f; renderRows(); save();
  say(`⌖ Луч прошёл все кольца — в строке для заполнения «1» в ячейке ${ch.join(", ")}.`);
}
/* v0.119, «сделай кнопку остановка по проходу лазера, пауза, потом вручную продолжить, и показывай цикл — сколько прошло кругов
   и сколько их всего». Проход — миг, когда лазер дошёл до края; пока щели держатся вместе (несколько шагов подряд), это ОДИН
   проход (coneClockWas — был ли проход на прошлом шаге). Z.coneClockN — счёт проходов. С «⏸ на проходе» sweep возвращает фазу
   первого прохода — там кручение и встаёт. Возвращает null, если вставать не надо. */
let coneClockWas = null, coneSpinning = false;   // v0.127: null — ещё не смотрели (загрузка страницы проходом не считается)
function coneClockSweep(ph0, dph, m){
  if (!dph || !coneGeom || !coneGeom.fill) return null;   // нет кольца для заполнения (3D, слишком много строк) — не метим
  const N = Math.min(Z.rows.length, CONE_MAX); if (!N) return null;
  let maxDeg = 0;   // быстрее всех поворачивается за кадр — отсюда число шагов (относительная скорость двух колец — до двух таких)
  for (let i = 0; i < N; i++) maxDeg = Math.max(maxDeg, coneBitMode(m) ? Math.abs(dph) * 360 / (Z.rows[i].length || 1) : Math.abs(dph));
  let tolDeg = coneSlitHalf() * 180 / Math.PI; const n0 = Z.rows[0].length || 1;
  for (let i = 1; i < N; i++) tolDeg = Math.min(tolDeg, coneSlitHalf(Z.rows[i].length || 1) * 180 / Math.PI);   // самая узкая щель — шаг не шире её
  const K = Math.max(1, Math.min(Math.ceil(maxDeg / tolDeg), coneFanOn() ? coneFanStepsCap(N) : Math.floor(200000 / (N * n0)), 2000));   // v0.201: ✺ — свой предел
  const hits = [], seen = new Set(), t = performance.now();
  let stopPh = null, rec = 0, part = null;   // v0.201: part — ✺ не успели за кадр: докуда просчитано
  for (let s = 1; s <= K; s++) {
    Z.coneSpinPh = ph0 + dph * s / K;
    let any = false;
    const tr = coneClockTrace();
    for (const R of tr) if (R.pass) { any = true; if (R.cell >= 0 && !seen.has(R.cell)) { seen.add(R.cell); hits.push(R); } }
    if (any && !coneClockWas) {
      Z.coneClockN = (Z.coneClockN | 0) + 1; if (Z.coneClockStop) stopPh = Z.coneSpinPh;
      for (const R of tr) if (R.pass) { coneClockRecord(R); rec++; coneClockFlash.push({ a: R.a, t, j: R.vstop }); }   // v0.127: проход — единица ячейке, что поймала (v0.129)
    }
    coneClockWas = any;
    if (coneWallPaint(tr)) rec++;   // v0.131: на каждом шаге — бит, в который упёрся луч, красится
    if (stopPh !== null) break;
    if ((coneFanOn() || coneSunOn()) && s < K && performance.now() - t > 12) { part = ph0 + dph * s / K; break; }   // v0.201: ✺ — кадр не дольше ~12 мс, остальное — в следующем
  }
  Z.coneSpinPh = ph0;
  if (hits.length) coneClockMark(hits); else if (rec) save();
  return stopPh !== null ? { ph: stopPh } : part !== null ? { ph: part, part: true } : null;
}
/* Цикл кручения — через сколько все кольца (и кольцо для заполнения) разом встают на свои места. «Каждое по биту»: кольцо из n бит
   возвращается через n бит, все вместе — через НОК длин (BigInt: у сотни разных длин он астрономический). «Навстречу»: все кольца
   поворачиваются на один угол — все на местах через 360°. Круг — оборот стрелки (строки 1). */
function coneCycleBits(){
  const N = Math.min(Z.rows.length, CONE_MAX), g = (a, b) => { while (b) [a, b] = [b, a % b]; return a; };
  let L = 1n;
  const add = (n) => { if (n > 0) { const b = BigInt(n); L = L / g(L, b) * b; } };
  for (let i = 0; i < N; i++) add(Z.rows[i].length);
  if (coneGeom && coneGeom.fill) add(fillLen());
  return L;
}
function coneBigFmt(b){ const s = b.toString(); return s.length <= 15 ? Number(b).toLocaleString("ru-RU") : `${s[0]},${s.slice(1, 3)}·10^${s.length - 1}`; }
function coneCycleText(){
  const m = Z.coneSpinMode || "all", ph = Math.abs(Z.coneSpinPh || 0), n0 = (Z.rows[0] || "1").length || 1;
  const pass = Z.coneClock ? ` · проходов лазера ${Z.coneClockN | 0}` : "";
  if (coneBitMode(m)) {
    const L = coneCycleBits(), tot = L / BigInt(n0), Ln = Number(L);
    const inCyc = Ln <= 1e15 ? (ph % Ln) / n0 : ph / n0, cyc = Ln <= 1e15 ? Math.floor(ph / Ln) : 0;
    return `⟳ круг ${Math.floor(inCyc).toLocaleString("ru-RU")} из ${coneBigFmt(tot)}` + (cyc ? ` · цикл ${cyc + 1}` : "") + pass;
  }
  if (m === "opp") return `⟳ круг ${Math.floor(ph / 360).toLocaleString("ru-RU")} · цикл — 1 круг (360°), каждый круг все кольца на местах` + pass;
  return Z.coneClock ? `⟳ всё целиком — кольца друг относительно друга не сдвигаются${pass}` : "";
}
function coneCycleCheck(ph0, ph1, m){
  let L = 0, n0 = (Z.rows[0] || "1").length || 1;
  if (coneBitMode(m)) { const b = coneCycleBits(); if (b > 1000000000000000n) return; L = Number(b); } else if (m === "opp") L = 360; else return;   // v0.161: навстречу по биту — кольцо из n бит на месте через n бит в любую сторону, цикл тот же
  if (Math.floor(Math.abs(ph0) / L) !== Math.floor(Math.abs(ph1) / L))
    say(`⟳ Цикл пройден — все кольца снова на своих местах (${coneBitMode(m) ? coneBigFmt(BigInt(L / n0)) + " кругов" : "360°"}${Z.coneClock ? `, проходов лазера ${Z.coneClockN | 0}` : ""}).`);
}
/* v0.109, «этажи-многоугольники вместо колец» (было предложено: «строка из n бит — не круг, а правильный n-угольник:
   3 бита — треугольник, 4 — квадрат; конус станет ступенчатой пирамидой»). Галка «⬡ многоугольники»: кольцо из n бит (n ≥ 3)
   рисуется правильным n-угольником, бит — его СТОРОНА, границы бит — вершины. Вершины лежат на прежней окружности, стороны
   хордами внутри неё; углы у бит те же, что у дуг, поэтому лучи, оси, хорды и «луч во внешнее кольцо» считаются как раньше —
   меняется только расстояние от центра. Многоугольник крутится вместе со своими битами. Строки из 1 и 2 бит — точка и крест (v0.110, см. renderCone). */
function conePoly(i){ const n = (Z.rows[i] || "").length; return Z.conePoly && n >= 3 ? n : 0; }
// во сколько раз точка многоугольника кольца i под углом t ближе к центру, чем окружность через его вершины
function coneRho(i, t){
  const n = conePoly(i); if (!n) return 1;
  const step = 2 * Math.PI / n, rot = coneRotOf(i), u = (t + Math.PI / 2) / step + rot, m = -Math.PI / 2 + (Math.floor(u) + 0.5 - rot) * step;
  return Math.cos(step / 2) / Math.cos(t - m);
}
/* v0.113: биты кольца из n бит — отрезками подряд одного цвета (по кругу: последний отрезок может перейти через бит 0).
   c(j) — цвет бита: строка, число или объект — сравниваются по JSON. Отрезок: { j — первый бит, len — сколько бит, c — цвет }. */
function coneSectRuns(n, c){
  const cs = [], ks = [];
  for (let j = 0; j < n; j++) { cs.push(c(j)); ks.push(JSON.stringify(cs[j])); }
  let st = 0; while (st < n && ks[st] === ks[(st + n - 1) % n]) st++;
  if (st === n) return [{ j: 0, len: n, c: cs[0] }];
  const out = [];
  for (let k = 0; k < n; k++) {
    const j = (st + k) % n;
    if (k && ks[j] === ks[(j + n - 1) % n]) out[out.length - 1].len++; else out.push({ j, len: 1, c: cs[j] });
  }
  return out;
}
// путь по кольцу i радиуса r от угла a0 до a1 (ccw — в обратную сторону): у круга — дуга, у многоугольника — ломаная через вершины
function coneArc(g, cx, cy, i, r, a0, a1, ccw){
  const n = conePoly(i); if (!n) { g.arc(cx, cy, r, a0, a1, !!ccw); return; }
  const step = 2 * Math.PI / n, rot = coneRotOf(i), e = 1e-9;
  const U = (t) => (t + Math.PI / 2) / step + rot, V = (k) => -Math.PI / 2 + (k - rot) * step;
  const pt = (t) => { const q = r * coneRho(i, t); g.lineTo(cx + q * Math.cos(t), cy + q * Math.sin(t)); };
  pt(a0);
  if (!ccw) { for (let k = Math.floor(U(a0) + e) + 1; k < U(a1) - e; k++) pt(V(k)); }
  else { for (let k = Math.ceil(U(a0) - e) - 1; k > U(a1) + e; k--) pt(V(k)); }
  pt(a1);
}
/* v0.084, «надо сохранять положение, изменённое вручную, для каждого кольца»: у каждого кольца своя ручная ось —
   Z.coneAxisOffs[номер строки] (сдвиг от оси строки ⇄ в полубитах); нет своей — общий, как было. Запоминается. */
function coneAxisOff(i){ const o = Z.coneAxisOffs; return o && i !== undefined && o[i] !== undefined ? o[i] : (Z.coneAxisOff || 0); }
function coneAxisM(s, mode, i){
  const n = s.length;
  if (mode === "lin") return n - 1;
  if (mode === "man") return (((n - 1 + coneAxisOff(i)) % n) + n) % n;
  let best = n - 1, bf = -1;   // при равенстве — ось строки ⇄ (её считаем первой)
  { let f = 0; for (let j = 0; j < n; j++) if (s[j] === s[n - 1 - j]) f++; bf = f; }
  for (let m = 0; m < n; m++) { let f = 0; for (let j = 0; j < n; j++) if (s[j] === s[((m - j) % n + n) % n]) f++; if (f > bf) { bf = f; best = m; } }
  return best;
}
function coneMirInfo(s, mode, i){
  const n = s.length; if (!n || mode === "off") return null;
  if (mode === "c180") {
    /* v0.081, «конечно!» — на «сделать 180° и для нечётных колец»: у нечётного кольца (n = 2k + 1) прямая от центра бита j
       через центр выходит ровно на границу между битами j+k и j+k+1 — напротив бита стоит пара. cls: 2 — бит совпал с
       обоими, 1 — с одним, 0 — ни с одним. */
    if (n % 2) {
      const k = (n - 1) / 2, pair = (j) => [(j + k) % n, (j + k + 1) % n], cls = [];
      let both = 0, one = 0, none = 0;
      for (let j = 0; j < n; j++) { const [p1, p2] = pair(j), c = (s[p1] === s[j]) + (s[p2] === s[j]); cls[j] = c; if (c === 2) both++; else if (c === 1) one++; else none++; }
      return { c180: true, odd: true, cls, pair, fix: cls.map(c => c === 2), partner: () => -1, f: both, both, one, none, k };
    }
    const pt = (j) => (j + n / 2) % n, fix = []; let f = 0;
    for (let j = 0; j < n; j++) { fix[j] = s[j] === s[pt(j)]; if (fix[j]) f++; }
    return { c180: true, fix, partner: pt, f };
  }
  const m = coneAxisM(s, mode, i), pt = (j) => ((m - j) % n + n) % n, fix = []; let f = 0;
  for (let j = 0; j < n; j++) { fix[j] = s[j] === s[pt(j)]; if (fix[j]) f++; }
  let bestF = 0; for (let mm = 0; mm < n; mm++) { let q = 0; for (let j = 0; j < n; j++) if (s[j] === s[((mm - j) % n + n) % n]) q++; bestF = Math.max(bestF, q); }
  return { m, fix, partner: pt, f, bestF };
}
/* ─── ◯ Конус в объёме (v0.082) ─────────────────────────────────────────────────────────────────
   Запрос пользователя: «похоже, нужно будет поднять этот конус в высоту ещё, чтобы всё это разглядеть — нити, лучи». Кольцо
   i — на своей высоте: z = (N/2 − i)·высота, радиус i + 0.6, вершина конуса сверху. Камера — поворот вокруг оси конуса и наклон
   (90° — вид сверху, как плоский конус; 0° — сбоку). Рисуется по глубине (дальнее раньше): сектора, биты, потом нити — ось
   конуса, оси зеркал колец, хорды, лучи. Мышь: тянешь — вращать, с Ctrl — сдвиг, колесо — масштаб, двойной щелчок — вид по
   умолчанию. Биты — те же цвета и та же логика неподвижных, что в плоском конусе. */
function cone3DDraw(g, o){
  const { W, H, dpr, N, shown, mirMap, c1, c0, cR, cg, cA, cT, cS } = o;
  const yaw = ((Z.cone3Yaw ?? 30) - (Z.coneSpin || 0)) * Math.PI / 180, el = (Z.cone3El ?? 50) * Math.PI / 180, hk = Z.cone3H ?? 1;
  const cyw = Math.cos(yaw), syw = Math.sin(yaw), ce = Math.cos(el), se = Math.sin(el);
  const octa = !!Z.coneOcta;   // v0.100: ⧗ зеркало вниз — октаэдр
  const Rw = N + 1, span = Math.max(Rw, N * hk * ce * (octa ? 1.1 : 0.6) + Rw * se), sc = (Math.min(W, H) / 2 - 10 * dpr) / Math.max(1, span) * coneZoom;
  const cx = W / 2 + conePan[0], cy = H / 2 + conePan[1];
  const P = (x, y, z) => { const x1 = x * cyw - y * syw, y1 = x * syw + y * cyw; return [cx + x1 * sc, cy - (z * ce + y1 * se) * sc, z * se - y1 * ce]; };
  const ringZ = (i) => (octa ? (N - 1 - i) : (N / 2 - i)) * hk, ringR = (i) => i + 0.6;   // при октаэдре основание — на середине
  const at = (i, a, r) => { r *= coneRho(i, a); return P(r * Math.cos(a), -r * Math.sin(a), ringZ(i)); };   // как в плоском: угол −π/2 — верх; v0.109: многоугольник
  const green = coneCss("--green", "#6ee7a0");
  // сектора к центру своего кольца
  if (Z.coneSect) {
    const secRows = coneFocus().filter(i => i < N && shown(i));
    for (const i of secRows) {
      const s = Z.rows[i], n = s && s.length; if (!n) continue;
      const step = 2 * Math.PI / n, rot = coneRotOf(i), c = P(0, 0, ringZ(i)), r = ringR(i);
      for (const run of coneSectRuns(n, (j) => s[j] === "1")) {   // v0.113: подряд одинаковые биты — один клин, без швов
        const a = -Math.PI / 2 + (run.j - rot) * step, strong = run.c, K = Math.max(6, Math.ceil(run.len * 6));
        g.beginPath();
        if (run.len < n) g.moveTo(c[0], c[1]);
        for (let q = 0; q <= K; q++) { const p = at(i, a + run.len * step * q / K, r); if (q || run.len < n) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); }
        g.closePath(); g.globalAlpha = strong ? 0.28 : 0.1; g.fillStyle = strong ? c1 : c0; g.fill();
      }
    }
    g.globalAlpha = 1;
  }
  // биты — дугами на своей высоте, по глубине
  const items = [];
  const lw = Math.max(1.2 * dpr, Math.min(sc * 0.6, 26 * dpr) * (Z.cone3Bw ?? 1));   // v0.197, «регулировать высоту 3D битов»: ▬ — множитель толщины
  for (let i = 0; i < N; i++) {
    const s = Z.rows[i], n = s.length; if (!n || !shown(i)) continue;
    const step = 2 * Math.PI / n, rot = coneRotOf(i), r = ringR(i), MI = mirMap.get(i);
    const K = Math.max(2, Math.ceil(step / 0.12));
    for (let j = 0; j < n; j++) {
      const a = -Math.PI / 2 + (j - rot) * step, fix = MI ? MI.fix[j] : Z.showFix && fixAt(s, j);
      let col = fix ? (MI ? (MI.c180 ? green : cR) : Z.showFix === "ir" ? green : cR) : s[j] === "1" ? c1 : c0;
      if (MI && MI.odd) col = MI.cls[j] === 2 ? green : MI.cls[j] === 1 ? cg : cR;
      const strong = s[j] === "1" || fix || !!(MI && MI.odd), pts = [];
      const gap = n > 1 ? step * 0.06 : 0, tiny = Z.conePoly && n <= 2;   // v0.110: 1 бит — точка, 2 — крест
      if (tiny && n === 1) pts.push(at(i, a, 0));
      else if (tiny) pts.push(at(i, a + step / 4, r), at(i, a, 0), at(i, a + step * 3 / 4, r));   // v0.111: Г углом в центре
      else for (let q = 0; q <= K; q++) pts.push(at(i, a + gap + (step - 2 * gap) * q / K, r));
      items.push({ pts, col, dot: tiny && n === 1, a: 0.95, near: tiny ? (pts[0][2] + pts[pts.length - 1][2]) / 2 : at(i, a + step / 2, r)[2], cur: i === Z.cur && !document.body.classList.contains("nocur"), sel: rowSel.has(i),   // v0.107
        ch: s[j], pc: tiny ? pts[0] : at(i, a + step / 2, r), w: tiny ? 0 : n === 1 ? 2 * r * sc : Math.hypot(pts[0][0] - pts[K][0], pts[0][1] - pts[K][1]), cd: P(0, 0, ringZ(i))[2], m: false, first: j === 0 });   // v0.243: цифра бита; v0.318: first — бит 0
    }
  }
  // v0.090: границы бит в объёме — там, где биты разные: 0→1 сиреневая, 1→0 бирюзовая
  const ticks = [];
  for (let i = 0; i < N; i++) {
    const s = Z.rows[i], n = s.length; if (n < 2 || !shown(i)) continue;
    const step = 2 * Math.PI / n, rot = coneRotOf(i), r = ringR(i);
    for (let j = 0; j < n; j++) { const pv = s[(j - 1 + n) % n]; if (pv === s[j]) continue; const a = -Math.PI / 2 + (j - rot) * step, cr = Z.conePoly && n === 2; ticks.push({ p: at(i, a, cr ? r * 0.6 : r - 0.38), q: at(i, a, cr ? r : r + 0.38), col: pv === "0" ? "#d946ef" : "#14b8a6" }); }
  }
  /* v0.100, «3» — на «зеркало под основанием, как в знаке»: под последним кольцом (общим основанием) — та же пирамида вниз:
     кольцо i отражено через основание (высота −(N−1−i)), биты инвертированы (0 ↔ 1), как в «Октаэдре». Неподвижные при
     развороте у инверсии те же — красятся так же. */
  const octaSet = octa && Z.coneOctaSel === "cur" ? new Set(coneFocus()) : null;   // v0.359: ⧗ выдел. — только кольца в фокусе
  if (octa) for (let i = 0; i < N - 1; i++) {
    const s = Z.rows[i], n = s.length; if (!n || !shown(i) || (octaSet && !octaSet.has(i))) continue;
    const step = 2 * Math.PI / n, rot = coneRotOf(i), r = ringR(i), zm = -(N - 1 - i) * hk, K = Math.max(2, Math.ceil(step / 0.12)), gap = n > 1 ? step * 0.06 : 0;
    const atM = (a, rr = r) => { const q = rr * coneRho(i, a); return P(q * Math.cos(a), -q * Math.sin(a), zm); }, tiny = Z.conePoly && n <= 2;
    for (let j = 0; j < n; j++) {
      const a = -Math.PI / 2 + (j - rot) * step, inv = s[j] === "1" ? "0" : "1", fix = Z.showFix && fixAt(s, j);
      const col = fix ? (Z.showFix === "ir" ? green : cR) : inv === "1" ? c1 : c0, pts = [];
      if (tiny && n === 1) pts.push(atM(a, 0)); else if (tiny) pts.push(atM(a + step / 4), atM(a, 0), atM(a + step * 3 / 4));
      else for (let q = 0; q <= K; q++) pts.push(atM(a + gap + (step - 2 * gap) * q / K));
      items.push({ pts, col, dot: tiny && n === 1, a: (inv === "1" || fix) ? 0.9 : 0.4, near: tiny ? (pts[0][2] + pts[pts.length - 1][2]) / 2 : atM(a + step / 2)[2], cur: false, sel: false,
        ch: inv, pc: tiny ? pts[0] : atM(a + step / 2), w: tiny ? 0 : n === 1 ? 2 * r * sc : Math.hypot(pts[0][0] - pts[K][0], pts[0][1] - pts[K][1]), cd: P(0, 0, zm)[2], m: true });   // v0.243: цифра бита
    }
  }
  items.sort((p, q) => p.near - q.near);
  g.lineCap = "butt"; g.lineJoin = "round";
  // v0.103: ✨ свет в объёме — ближнее ярче, единицы с ореолом
  let nMin = Infinity, nMax = -Infinity; if (Z.coneGlow) for (const it of items) { nMin = Math.min(nMin, it.near); nMax = Math.max(nMax, it.near); }
  for (const it of items) {
    if (Z.coneArcs === false) break;   // v0.375: «◠ дуги» выключены — в 3D дуг битов нет (и у зеркала)
    g.beginPath();
    if (it.dot) g.arc(it.pts[0][0], it.pts[0][1], lw * 0.9, 0, 2 * Math.PI);   // v0.110: точка
    else { g.moveTo(it.pts[0][0], it.pts[0][1]); for (let q = 1; q < it.pts.length; q++) g.lineTo(it.pts[q][0], it.pts[q][1]); }
    const lit = Z.coneGlow ? 0.45 + 0.55 * (nMax > nMin ? (it.near - nMin) / (nMax - nMin) : 1) : 1;
    if (Z.coneGlow && it.a > 0.8) { g.shadowColor = it.col; g.shadowBlur = Math.max(5 * dpr, Math.min(lw * 1.4, 26 * dpr)); }
    g.strokeStyle = it.col; g.globalAlpha = it.a * lit; g.lineWidth = lw; if (it.dot) { g.fillStyle = it.col; g.fill(); } else g.stroke();
    if (Z.coneGlow) g.shadowBlur = 0;
    if (it.cur || it.sel) { g.strokeStyle = it.cur ? cg : cS; g.globalAlpha = 0.9; g.lineWidth = Math.max(1, dpr * 1.2); g.stroke(); }
    if (Z.coneBit1 && it.first) { g.strokeStyle = cg; g.globalAlpha = 1; g.lineWidth = Math.max(2 * dpr, lw * 0.4); g.stroke(); }   // v0.318: ① 1-й бит — золотой чертой
  }
  g.globalAlpha = 1;
  g.lineWidth = Math.max(1.5 * dpr, Math.min(sc * 0.08, 4 * dpr));
  for (const t of ticks) { g.strokeStyle = t.col; g.beginPath(); g.moveTo(t.p[0], t.p[1]); g.lineTo(t.q[0], t.q[1]); g.stroke(); }
  if (window.zzSndHeads) {   // v0.376: ◉ головки звука — точка на звучащем бите
    g.shadowBlur = 10 * dpr;
    for (const [i, j, kd] of window.zzSndHeads) {
      g.fillStyle = g.shadowColor = sndHeadCol(kd);   // v0.383: столбцовая — золотом
      if (i >= N || !shown(i)) continue; const n = (Z.rows[i] || "").length; if (!n || j >= n) continue;
      const q = at(i, -Math.PI / 2 + (j - coneRotOf(i) + 0.5) * 2 * Math.PI / n, ringR(i));
      g.beginPath(); g.arc(q[0], q[1], Math.max(3 * dpr, Math.min(sc * 0.18, 9 * dpr)), 0, 2 * Math.PI); g.fill();
    }
    g.shadowBlur = 0;
  }
  /* v0.243, «3D-режим — при виде сбоку и сверху, когда ровно, показывает биты»: наклон ровно 0° (сбоку) или 90° (сверху) — на
     каждом бите его цифра. Сбоку — только ближняя половина кольца (дальняя за ней); сверху зеркало под основанием не подписывается
     (лежит ровно под верхним). Цифра — по ширине бита на экране: у краёв сбоку, где биты сжаты, мелкие не пишутся. */
  { const elD = Z.cone3El ?? 50, side = Math.abs(elD) < 1, top = Math.abs(elD - 90) < 1;
    if (Z.cone3Dig && (side || top)) {   // v0.251: только когда включено «01» (по умолчанию выкл)
      const fnt = coneCss("--ff", "monospace");
      g.textAlign = "center"; g.textBaseline = "middle"; g.lineJoin = "round"; g.globalAlpha = 1;
      for (const it of items) {
        if (top ? it.m : it.near < it.cd - 1e-6) continue;
        const fs = Math.min(lw * 0.95, (it.w || lw) * 0.95, 30 * dpr);
        if (fs < 7 * dpr) continue;
        g.font = `bold ${Math.round(fs)}px ${fnt}`;
        g.lineWidth = Math.max(2, fs * 0.22); g.strokeStyle = "rgba(0,0,0,.85)"; g.strokeText(it.ch, it.pc[0], it.pc[1]);
        g.fillStyle = it.ch === "1" ? "#fff" : "rgba(255,255,255,.7)"; g.fillText(it.ch, it.pc[0], it.pc[1]);
      }
      g.textAlign = "start"; g.textBaseline = "alphabetic";
    }
  }
  // ось конуса
  const top = P(0, 0, ringZ(0) + hk), bot = P(0, 0, octa ? -(N - 1) * hk - hk : ringZ(N - 1) - hk);
  g.save(); g.strokeStyle = cg; g.globalAlpha = 0.5; g.lineWidth = Math.max(1, dpr); g.setLineDash([6 * dpr, 5 * dpr]);
  g.beginPath(); g.moveTo(top[0], top[1]); g.lineTo(bot[0], bot[1]); g.stroke(); g.restore();
  // оси зеркал колец и хорды — нити через центр своего кольца
  for (const [i, MI] of mirMap) {
    if (!shown(i) || Z.rows[i].length < 2) continue;   // v0.086: у кольца из одного бита лучей нет — только сектор к центру
    const s = Z.rows[i], n = s.length, step = 2 * Math.PI / n, rot = coneRotOf(i), r = ringR(i), ang = (j) => -Math.PI / 2 + (j - rot + 0.5) * step;
    if (!MI.c180) {
      const aa = -Math.PI / 2 + (MI.m / 2 - rot + 0.5) * step, p1 = at(i, aa, r + 0.5), p2 = at(i, aa + Math.PI, r + 0.5);
      g.save(); g.strokeStyle = cg; g.lineWidth = Math.max(1.5, 1.6 * dpr); g.setLineDash([8 * dpr, 5 * dpr]); g.globalAlpha = 0.9;
      g.beginPath(); g.moveTo(p1[0], p1[1]); g.lineTo(p2[0], p2[1]); g.stroke(); g.restore();
    }
    for (let j = 0; j < n; j++) {
      let q1, q2, c;
      if (MI.odd) { q1 = at(i, ang(j), r); q2 = at(i, -Math.PI / 2 + (j + MI.k + 1 - rot) * step, r); c = MI.cls[j]; }
      else { const p = MI.partner(j); if (p <= j) continue; q1 = at(i, ang(j), r); q2 = at(i, ang(p), r); c = MI.fix[j] ? 2 : 0; }
      g.strokeStyle = c ? cg : cT; g.globalAlpha = c === 2 ? 0.8 : c === 1 ? 0.45 : 0.2; g.lineWidth = Math.max(1, dpr * (c === 2 ? 1.3 : 0.8));
      g.beginPath(); g.moveTo(q1[0], q1[1]); g.lineTo(q2[0], q2[1]); g.stroke();
      if (MI.odd) {   // v0.083: нить дальше — вниз, во внешнее кольцо
        const a2 = -Math.PI / 2 + (j + MI.k + 1 - rot) * step, hit = coneOuterHit(i, a2);
        if (hit) { const q3 = at(i + 1, a2, ringR(i + 1)); g.setLineDash([3 * dpr, 3 * dpr]); g.beginPath(); g.moveTo(q2[0], q2[1]); g.lineTo(q3[0], q3[1]); g.stroke(); g.setLineDash([]);
          g.fillStyle = hit.boundary ? cA : hit.bit === "1" ? c1 : c0; g.beginPath(); g.arc(q3[0], q3[1], Math.max(2.5 * dpr, sc * 0.12), 0, 2 * Math.PI); g.fill(); }
      }
    }
    g.globalAlpha = 1;
  }
  // лучи к центру своего кольца
  const rays = Z.coneRays || "off";
  if (rays !== "off") {
    g.strokeStyle = cA; g.lineWidth = Math.max(0.6, dpr * (rays === "cur" ? 0.9 : 0.5)); g.globalAlpha = rays === "cur" ? 0.6 : 0.2;
    g.beginPath();
    const rayRows = rays === "cur" ? coneFocus().filter(i => i < N) : [...Array(N).keys()];   // v0.108: «текущего» — те, что в фокусе
    for (const i of rayRows) {
      const s = Z.rows[i], n = s.length; if (n < 2 || !shown(i)) continue;   // v0.086: у одного бита лучей нет
      const step = 2 * Math.PI / n, rot = coneRotOf(i), c = P(0, 0, ringZ(i));
      for (let j = 0; j < n; j++) { const e = at(i, -Math.PI / 2 + (j - rot + 0.5) * step, ringR(i) + 0.4); g.moveTo(c[0], c[1]); g.lineTo(e[0], e[1]); }   // v0.089: от центров бит
      /* v0.372, по снимку «✳ все» — «проверь — работает для зеркала?» — не работало: лучи были только у верхнего конуса. Теперь и у
         отражённых вниз колец (⧗ зеркало; при «⧗ выдел.» — только у отражённых), на их высоте; основание не повторяется */
      if (octa && i < N - 1 && (!octaSet || octaSet.has(i))) {
        const zm = -(N - 1 - i) * hk, cm = P(0, 0, zm);
        for (let j = 0; j < n; j++) { const a = -Math.PI / 2 + (j - rot + 0.5) * step, q = (ringR(i) + 0.4) * coneRho(i, a), e = P(q * Math.cos(a), -q * Math.sin(a), zm); g.moveTo(cm[0], cm[1]); g.lineTo(e[0], e[1]); }
      }
    }
    g.stroke(); g.globalAlpha = 1;
  }
  /* v0.381, «обои доработать всё как есть, но добавить по горизонту зеркального конуса две пирамиды Серпинского высотой до вершины конуса,
     справа и слева, чтобы соприкасались почти катетами» (выбрано: прямоугольные, катетом к конусу), «звук пустить по обеим пирамидам сразу
     и показать биты-головки»: только фон хаба (без пресета). Строки поля (Паскаль mod 2, строка r — r + 1 бит) — прямоугольным треугольником:
     вершина — на высоте вершины конуса, основание — на горизонте (плоскость зеркала), вертикальный катет — у самого широкого места конуса,
     гипотенуза — наружу; левый — зеркальный. v0.395, «теперь треугольники гипотенузой к центру» (по снимку-показу — «да»): строки прижаты
     к внешнему краю — вертикальный катет снаружи, гипотенуза смотрит на конус. Единицы — цветом единиц, нули — бледно; головки звука (zzSndHeads) — бирюзой в обоих */
  if (ZZ_BG && !ZZ_PRESET && Z.coneOcta && N > 1) {
    const base = P(0, 0, 0), apex = P(0, 0, (N - 1) * hk + hk), hpx = base[1] - apex[1];
    if (hpx > 20) {
      let xl = Infinity, xr = -Infinity;
      for (let q = 0; q < 72; q++) { const p = at(N - 1, q / 72 * 2 * Math.PI, ringR(N - 1) + 0.4); xl = Math.min(xl, p[0]); xr = Math.max(xr, p[0]); }
      const RN = N, cell = hpx / RN, gap = Math.max(2 * dpr, cell * 1.2), s1 = cell * 0.78, s0 = cell * 0.34;
      const heads = new Map((window.zzSndHeads || []).map(([r, j, kd]) => [r + ":" + j, sndHeadCol(kd)]));   // v0.383: столбцовая — золотом
      for (let r = 0; r < RN; r++) {
        const s = Z.rows[r] || "", y = apex[1] + r * cell;
        for (let j = 0; j < s.length; j++) {
          const hc = heads.get(r + ":" + j), hd = !!hc, on = s[j] === "1", sz = hd || on ? s1 : s0;
          g.fillStyle = hd ? hc : on ? c1 : c0; g.globalAlpha = hd ? 1 : on ? 0.85 : 0.3;
          if (hd) { g.shadowColor = hc; g.shadowBlur = 10 * dpr; }
          const off = RN - s.length + j, xR = xr + gap + off * cell, xL = xl - gap - (off + 1) * cell, o2 = (cell - sz) / 2;   // v0.395: строки прижаты к внешнему краю — гипотенуза к центру
          g.fillRect(xR + o2, y + o2, sz, sz); g.fillRect(xL + o2, y + o2, sz, sz);
          if (hd) g.shadowBlur = 0;
        }
      }
      g.globalAlpha = 1;
    }
  }
  // метка «начала» — вертикаль бит 0 у вершины
  const m1 = at(Math.max(0, N - 1), -Math.PI / 2, ringR(Math.max(0, N - 1)) + 0.1), m2 = at(Math.max(0, N - 1), -Math.PI / 2, ringR(Math.max(0, N - 1)) + 0.6);
  g.strokeStyle = cg; g.globalAlpha = 0.35; g.lineWidth = dpr; g.beginPath(); g.moveTo(m1[0], m1[1]); g.lineTo(m2[0], m2[1]); g.stroke(); g.globalAlpha = 1;
  g.fillStyle = cT; g.globalAlpha = 0.7; g.font = `${Math.round(11 * dpr)}px system-ui, sans-serif`;
  /* v0.415, по снимку «◯ Конус» с текстом под ним — «за заголовком текст какой-то, подвинь его вправо»: строка 3D начинается сразу за
     заголовком окна (текст заголовка меряется диапазоном — сама ячейка тянется на всю шапку); без шапки (страница конуса) — у края, как было */
  let x3 = 8;
  { const cvx = $("coneCv"), wt = document.querySelector("#w-cone .whead .wt");
    if (cvx && wt && wt.getClientRects().length) { const rg = document.createRange(); rg.selectNodeContents(wt); x3 = Math.max(8, rg.getBoundingClientRect().right - cvx.getBoundingClientRect().left + 14); } }
  if (!document.body.classList.contains("zen")) g.fillText(`3D · поворот ${Math.round((Z.cone3Yaw ?? 30) % 360)}° · наклон ${Math.round(Z.cone3El ?? 50)}° · высота ×${(hk).toFixed(1)}`, x3 * dpr, 16 * dpr);
  g.globalAlpha = 1;
}
function coneRing(e){
  if (!coneGeom) return -1;
  const cv = $("coneCv"), r = cv.getBoundingClientRect(), G = coneGeom;
  const x = (e.clientX - r.left) * G.dpr - G.cx, y = (e.clientY - r.top) * G.dpr - G.cy, rr = Math.hypot(x, y);
  let i = Math.floor((rr - G.r0) / G.dr);
  if (Z.conePoly) {   // v0.109: у многоугольников расстояние до стороны зависит от угла — ищем этаж, в чью полосу попали
    const t = Math.atan2(y, x) - (Z.coneSpin || 0) * Math.PI / 180; i = -1;
    for (let k = 0; k < G.N; k++) { const q = rr / coneRho(k, t); if (q >= G.r0 + k * G.dr && q < G.r0 + (k + 1) * G.dr) { i = k; break; } }
  }
  if (G.fill && Math.floor((rr - G.r0) / G.dr) === G.N && (i === -1 || i >= G.N)) {   // v0.114: кольцо для заполнения — какая ячейка
    const n = fillLen(), t = Math.atan2(y, x) - (Z.coneSpin || 0) * Math.PI / 180, u = (((t + Math.PI / 2) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    return { i: G.N, a: Math.atan2(y, x), fill: ((Math.floor(u / (2 * Math.PI / n) + coneFillRot()) % n) + n) % n };   // v0.117: кольцо повёрнуто кручением
  }
  return i >= 0 && i < G.N ? { i, a: Math.atan2(y, x) } : -1;
}
/* v0.085, «надо сохранять положение, изменённое вручную, для каждого кольца», «замок может индивидуальный». Замок у каждого
   кольца свой (Z.coneLocks[номер строки]; нет своего — общая галка «запрет сдвига строк»). Запертое кольцо крутится мышью
   только на вид: строка не меняется, а поворот запоминается у кольца (Z.coneRot, целыми битами). Незапертое, как прежде,
   крутит саму строку. */
function coneLocked(i){ const L = Z.coneLocks; return L && L[i] !== undefined ? !!L[i] : Z.coneLock !== false; }
/* v0.104, «гит и это» — на «▶ крутить с выбором: всё целиком / каждое по биту / навстречу». Поворот кольца на экране =
   свой поворот «на вид» (coneRot) + поворот кручения: «каждое по биту» — все кольца на одно и то же число бит (угол у
   маленьких больше — они вертятся быстрее), «навстречу» — одинаковый угол, чётные по часовой, нечётные против. «Всё
   целиком» — прежнее: весь конус одним углом (Z.coneSpin). Z.coneSpinPh — фаза кручения: бит (по биту) или градусы. */
/* v0.108, «не снимается» (после Esc в конусе оставалось текущее кольцо — с осью зеркала, хордами, при «только выделенные» — одно
   оно): кольца «в фокусе» — выделенные; нет выделения — текущее, а после Esc — никакое. При «только выделенные» и пустом фокусе
   видны все кольца. */
let coneVeil = "";   // v0.213
function coneFocus(){ return rowSel.size ? [...rowSel] : (document.body.classList.contains("nocur") ? [] : [Z.cur]); }
function coneRotOf(i){
  let base = coneRot[i] || 0; const m = Z.coneSpinMode || "all", ph = coneRingPh(i);   // v0.138: остановленное кольцо — на своей фазе
  if (i === 0 && Z.coneAimRot) base -= Z.coneAimRot / 360 * ((Z.rows[0] || "").length || 1);   // v0.120: строка 1 довёрнута вручную (градусы, по часовой)
  if (m === "bit") return base - ph;
  if (m === "obit") return base - (i % 2 ? -1 : 1) * ph;   // v0.161
  if (m === "opp") { const n = (Z.rows[i] || "").length || 1; return base - (i % 2 ? -1 : 1) * ph / 360 * n; }
  return base;
}
/* v0.389, «добавь ещё нот — До Ре Ми Фа Соль Ля Си; серыми, не включёнными, при включении — цветные» и «разве не 7 всего нот в музыке?» —
   головок звука семь, по нотам, и цвет по номеру kd радугой: 0 До — красный (строки подряд, бывший ♫), 1 Ре — оранжевый (столбцы, бывший ♪),
   2 Ми — жёлтый, 3 Фа — зелёный, 4 Соль — голубой, 5 Ля — синий, 6 Си — фиолетовый. Одна функция на поле строк, 2D, 3D и пирамиды.
   Радуга — только в фоне хаба (body.bgmode); в самой странице головки прежние: строчная — бирюза, столбцовая — золото */
function sndHeadCol(kd){
  if (!document.body.classList.contains("bgmode")) return (kd | 0) === 1 ? "#ffd166" : "#22d3ee";
  return ["#ff5f6d", "#ff9f43", "#ffe066", "#7ee787", "#4dd4ff", "#6b8cff", "#c38cf5"][kd | 0] || "#ff5f6d";
}
function coneRotStr(s, k){ const n = s.length; k = ((k % n) + n) % n; return k ? s.slice(k) + s.slice(0, k) : s; }
function setupCone(){
  const cv = $("coneCv");
  /* v0.309, «поле Конус — одиночный клик без перемещения — снять выделение»: щелчок по холсту конуса без сдвига (без Ctrl и Shift) —
     как Esc: выделенные кольца (строки) сняты, подсветки текущего нет. Прежде (v0.248) щелчок по кольцу делал его строку текущей. */
  const coneUnsel = () => {
    if (!rowSel.size && document.body.classList.contains("nocur")) return;
    const n = rowSel.size; rowSel.clear(); rowSelAnchor = -1; document.body.classList.add("nocur"); renderRows(); renderCone();
    say(n ? `◯ Выделение снято (${n}).` : "◯ Выделение снято.");
  };
  cv.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    if (Z.cone3d) {   // v0.082: в объёме — тянешь: вращать (с Ctrl — сдвиг)
      e.preventDefault(); cv.setPointerCapture(e.pointerId); cv.style.cursor = e.ctrlKey ? "move" : "grabbing";
      const x0 = e.clientX, y0 = e.clientY, yw0 = Z.cone3Yaw ?? 30, el0 = Z.cone3El ?? 50, p0 = conePan.slice(), dpr = window.devicePixelRatio || 1, ctrl = e.ctrlKey;
      let moved3 = false;   // v0.309
      const mv = (ev) => {
        if (Math.abs(ev.clientX - x0) + Math.abs(ev.clientY - y0) > 3) moved3 = true;
        if (ctrl) conePan = [p0[0] + (ev.clientX - x0) * dpr, p0[1] + (ev.clientY - y0) * dpr];
        else { Z.cone3Yaw = yw0 + (ev.clientX - x0) * 0.5; Z.cone3El = Math.max(0, Math.min(90, el0 + (ev.clientY - y0) * 0.4)); }
        renderCone();
      };
      const up3 = () => { cv.removeEventListener("pointermove", mv); cv.removeEventListener("pointerup", up3); cv.removeEventListener("pointercancel", up3); cv.style.cursor = "grab"; save(); if (!moved3 && !ctrl) coneUnsel(); };   // v0.309
      cv.addEventListener("pointermove", mv); cv.addEventListener("pointerup", up3); cv.addEventListener("pointercancel", up3);
      return;
    }
    const h = coneRing(e);
    /* v0.248, «в конусах курсором двигать круги — только через Ctrl», «в поле конуса»: кольцо на холсте конуса крутится, только если
       тянуть его с Ctrl; без Ctrl тянешь — сдвигается весь вид (как мимо колец), щелчок — выбрать строку. Ctrl + щелчок без движения —
       выделить / снять, как прежде. */
    const ctrlK = e.ctrlKey || e.metaKey;
    if (h !== -1 && h.fill !== undefined && !ctrlK) { e.preventDefault(); fillCycle(h.fill); return; }   // v0.114: ячейка кольца для заполнения
    if (h !== -1 && h.i === 0 && Z.coneClock && ctrlK && !e.shiftKey) {   // v0.119: кольцо строки 1 при луч-часах — щелчок: вырез; v0.120: тянешь — крутится только оно; v0.248: с Ctrl
      e.preventDefault(); cv.setPointerCapture(e.pointerId); cv.style.cursor = "grabbing";
      const x0 = e.clientX, y0 = e.clientY, r0v = Z.coneAimRot || 0;
      const ang = (ev) => { const cvr = cv.getBoundingClientRect(), G = coneGeom || { dpr: 1, cx: 0, cy: 0 }; return Math.atan2((ev.clientY - cvr.top) * G.dpr - G.cy, (ev.clientX - cvr.left) * G.dpr - G.cx); };
      let last = ang(e), turn = 0, moved = false;
      const mv = (ev) => {
        if (Math.abs(ev.clientX - x0) + Math.abs(ev.clientY - y0) > 3) moved = true;
        if (!moved) return;
        const a = ang(ev); let da = a - last; if (da > Math.PI) da -= 2 * Math.PI; if (da < -Math.PI) da += 2 * Math.PI; turn += da; last = a;
        Z.coneAimRot = r0v + turn * 180 / Math.PI; coneAimSnap(); renderCone();
      };
      const up = () => {
        cv.removeEventListener("pointermove", mv); cv.removeEventListener("pointerup", up); cv.removeEventListener("pointercancel", up); cv.style.cursor = "grab";
        if (moved) { coneAimSettle(); return; }
        if (Z.coneNoPick) return;   // v0.281: 🚫 выбор колец
        if (rowSel.has(0)) rowSel.delete(0); else rowSel.add(0);   // v0.248: Ctrl + щелчок — выделить / снять, как у остальных колец
        renderRows(); renderCone(); say(`◯ Выделено колец: ${rowSel.size}. Кольцо строки 1 при луч-часах крутится с Ctrl — вместе с вырезом, защёлкивается лучом в щели кольца 2.`);
      };
      cv.addEventListener("pointermove", mv); cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
      return;
    }
    // v0.085: запертое кольцо (своим замком или общей галкой) крутится только на вид; сдвиг вида — мимо колец или с Ctrl
    if (h === -1 || !ctrlK || e.shiftKey) {   // v0.049: мимо колец — сдвиг всего вида; v0.173: и с Shift; v0.248: и без Ctrl (кольцо крутит только Ctrl)
      e.preventDefault(); cv.setPointerCapture(e.pointerId); cv.style.cursor = "move";
      const x0 = e.clientX, y0 = e.clientY, p0 = conePan.slice(), dpr = window.devicePixelRatio || 1;
      let movedP = false;
      const mv = (ev) => { if (Math.abs(ev.clientX - x0) + Math.abs(ev.clientY - y0) > 3) movedP = true; conePan = [p0[0] + (ev.clientX - x0) * dpr, p0[1] + (ev.clientY - y0) * dpr]; renderCone(); };
      /* v0.231, «выделение нескольких — через Ctrl, а не Shift» (как строки в поле): Ctrl + щелчок по кольцу — выделить / снять,
         Shift + щелчок по сектору — сменить бит (в v0.173 было наоборот). */
      const ctrl = e.ctrlKey || e.metaKey, shift = e.shiftKey, bit = shift && !ctrl ? coneBitAt(e) : null;
      const upP = () => {
        cv.removeEventListener("pointermove", mv); cv.removeEventListener("pointerup", upP); cv.removeEventListener("pointercancel", upP); cv.style.cursor = "grab";
        if (!movedP && bit) { conePan = p0; coneBitFlip(bit); return; }   // v0.231: Shift + щелчок по сектору — сменить бит (v0.173 — Ctrl)
        if (!movedP && !ctrl && !shift) { conePan = p0; coneUnsel(); return; }   // v0.309: щелчок без сдвига — снять выделение
        if (!movedP && h !== -1 && Z.coneNoPick) { conePan = p0; renderCone(); return; }   // v0.281, «нужна кнопка запрета выделения колец»: 🚫 выбор — щелчок по кольцу ничего не выбирает
        if (!movedP && h !== -1 && ctrl) {   // v0.231: с Ctrl; v0.076: щелчок по кольцу — выделить / снять (то же выделение, что в поле); v0.173 — с Shift (Ctrl — смена бита)
          conePan = p0;
          if (rowSel.has(h.i)) rowSel.delete(h.i); else rowSel.add(h.i);
          renderRows(); renderCone();
          say(`◯ Выделено колец: ${rowSel.size}` + (Z.coneOnlySel ? " — видны только они и текущее." : ". Галка «только выделенные» скроет остальные."));
          return;
        }
      };
      cv.addEventListener("pointermove", mv); cv.addEventListener("pointerup", upP); cv.addEventListener("pointercancel", upP);
      return;
    }
    e.preventDefault(); cv.setPointerCapture(e.pointerId); cv.style.cursor = "grabbing";
    coneDrag = { i: h.i, last: h.a, turn: 0, base: Z.rows[h.i], applied: 0, snap: false, view: coneLocked(h.i), v0: coneRot[h.i] || 0 };
  });
  cv.addEventListener("pointermove", (e) => {
    if (!coneDrag) {   // наведение: обвести кольцо и его строку в поле
      const h = coneRing(e), i = h === -1 || h.fill !== undefined || Z.coneNoPick ? -1 : h.i;   // v0.281: 🚫 выбор — и без обводки при наведении
      const b = coneBitAt(e), bc = (b ? b.i + ":" + b.j : "") !== (coneBitHover ? coneBitHover.i + ":" + coneBitHover.j : "");   // v0.173
      if (bc) { coneBitHover = b; rowBitMark(); cv.title = b ? `Строка ${b.i + 1}, бит ${b.j + 1}: ${Z.rows[b.i][b.j]} · Shift + щелчок — сменить · Ctrl + щелчок — выделить кольцо · Ctrl + тянуть — крутить кольцо` : ""; }
      if (i !== coneHover) { coneHover = i; coneHoverRow(i); renderCone(); } else if (bc) renderCone();
      return;
    }
    const cvr = cv.getBoundingClientRect(), G = coneGeom, D = coneDrag;
    const a = Math.atan2((e.clientY - cvr.top) * G.dpr - G.cy, (e.clientX - cvr.left) * G.dpr - G.cx);
    let da = a - D.last; if (da > Math.PI) da -= 2 * Math.PI; if (da < -Math.PI) da += 2 * Math.PI;
    D.turn += da; D.last = a;
    const n = D.base.length, rot = -D.turn / (2 * Math.PI / n), k = Math.round(rot);
    if (D.view) { coneRot[D.i] = D.v0 + rot; renderCone(); return; }   // запертое — только вид
    if (k !== D.applied) {   // целый бит — крутим саму строку, поле видит сразу
      if (!D.snap) { snapshot(); D.snap = true; }
      Z.rows[D.i] = coneRotStr(D.base, k); D.applied = k;
      renderRows(); coneHoverRow(coneHover);
    }
    coneRot[D.i] = D.v0 + rot - D.applied;   // остаток до целого бита — плавность под мышью (поверх своего вида кольца)
    renderCone();
  });
  cv.addEventListener("pointerleave", () => { if (coneBitHover) { coneBitHover = null; rowBitMark(); cv.title = ""; if (coneHover === -1) renderCone(); } if (!coneDrag && coneHover !== -1) { coneHover = -1; coneHoverRow(-1); renderCone(); } });
  const up = () => {
    if (!coneDrag) return;
    const D = coneDrag; coneDrag = null; cv.style.cursor = "grab";
    const n = D.base.length, k = ((D.applied % n) + n) % n;
    if (Math.abs(D.turn) < 0.02) {   // v0.248: кольцо берётся только с Ctrl — не повернул, значит Ctrl + щелчок: выделить / снять
      if (Z.coneNoPick) { coneRot[D.i] = D.v0; renderCone(); return; }   // v0.281: 🚫 выбор
      coneRot[D.i] = D.v0; if (rowSel.has(D.i)) rowSel.delete(D.i); else rowSel.add(D.i); renderRows(); renderCone();
      say(`◯ Выделено колец: ${rowSel.size}` + (Z.coneOnlySel ? " — видны только они и текущее." : ". Галка «только выделенные» скроет остальные.")); return;
    }
    if (D.view) {   // запертое кольцо: поворот вида — целым битом, запомнить у кольца
      coneRot[D.i] = ((Math.round(coneRot[D.i]) % n) + n) % n; Z.coneRot = coneRot.map(x => Math.round(x || 0));
      if (Z.cur !== D.i) Z.cur = D.i;
      renderAll(); save(); say(`◯ Кольцо ${D.i + 1} заперто — повёрнуто только на вид (${coneRot[D.i]}), строка та же. Положение запомнено.`); return;
    }
    coneRot[D.i] = D.v0;
    if (Z.cur !== D.i) Z.cur = D.i;
    renderAll(); save();
    if (k) say(`◯ Строка ${D.i + 1} повёрнута на ${k} (влево по кругу) — и в поле строк. ↩ вернёт.`);
  };
  cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
  $("bConeCanon").onclick = () => {
    if (Z.rows.some((_, i) => coneLocked(i))) {   // v0.085: запертые кольца — к наименьшему только на вид, незапертые — сами строки
      let kv = 0; Z.rows.forEach((s, i) => { if (coneLocked(i)) { const sh = zzNecklace(s).shift; if (sh !== (coneRot[i] || 0)) kv++; coneRot[i] = sh; } });
      Z.coneRot = coneRot.map(x => Math.round(x || 0));
      const free = Z.rows.map((s, i) => [s, i]).filter(([s, i]) => !coneLocked(i) && zzNecklace(s).shift);
      if (free.length) { snapshot(); free.forEach(([s, i]) => { Z.rows[i] = zzNecklace(s).canon; }); syncLane(); }
      renderAll(); save(); say(`◯ К наименьшему: запертые кольца — на вид (${kv}), незапертые строки повёрнуты (${free.length}).`); return;
    }
    let k = 0; const out = Z.rows.map(s => { const r = zzNecklace(s); if (r.shift) k++; return r.canon; });
    if (!k) { say("◯ Все строки уже в наименьшем виде."); return; }
    snapshot(); Z.rows = out; syncLane(); renderAll(); save();
    say(`◯ Строки повёрнуты к наименьшему виду: ${k}. Одинаковые кольца теперь и в поле одинаковые. ↩ вернёт.`);
  };
  $("coneSame").onchange = () => renderCone();
  coneRot = Array.isArray(Z.coneRot) ? Z.coneRot.slice() : [];
  $("coneList").addEventListener("click", (e) => {   // v0.088: таблица строк конуса
    const lk = e.target.closest(".clk");
    if (lk) {
      const i = +lk.dataset.l; if (!Z.coneLocks || typeof Z.coneLocks !== "object") Z.coneLocks = {};
      Z.coneLocks[i] = !coneLocked(i); save(); renderCone();
      say(`◯ Кольцо ${i + 1} ${Z.coneLocks[i] ? "заперто — крутится только на вид" : "открыто — крутит саму строку"}. Правый щелчок по замку — снова по общей галке.`); return;
    }
    const row = e.target.closest(".cl[data-r]"); if (!row) return;
    const i = +row.dataset.r;
    if (e.ctrlKey || e.metaKey) { if (rowSel.has(i)) rowSel.delete(i); else rowSel.add(i); renderRows(); renderCone(); return; }
    if (i !== Z.cur) { Z.cur = i; renderAll(); save(); }
  });
  $("coneList").addEventListener("contextmenu", (e) => {
    const lk = e.target.closest(".clk"); if (!lk) return;
    e.preventDefault(); const i = +lk.dataset.l; if (Z.coneLocks) delete Z.coneLocks[i]; save(); renderCone(); say(`◯ Кольцо ${i + 1} — снова по общей галке «запрет сдвига строк».`);
  });   // v0.085: сохранённые положения колец
  // v0.210, по снимку «🔒 кольца» — «эту кнопку удали, замки есть у каждой строки»: кнопки замка выделенных колец больше нет — свой замок
  // у каждой строки в столбике замков (и правый щелчок по замку кольца в списке колец снимает его, как прежде).
  /* v0.098, «3D — это, конечно, нечто шедевральное», «поставь кнопку крутить вправо-влево — всю, потом, похоже, каждое по
     отдельности». ⟲ ⟳ — весь конус (плоский — вокруг центра, 3D — вокруг оси): щелчок 15°, держишь — крутится; правый — к 0°.
     ◁ ▷ — выделенные кольца (или текущее) на бит: запертое — на вид, открытое — сама строка. */
  let spinT = 0, spinI = 0;
  const spinStop = () => { clearTimeout(spinT); clearInterval(spinI); spinT = spinI = 0; save(); };
  const spinGo = (dir) => (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    /* v0.166, «крутить по длине 1 бита нижней строки или выделенной — нижней самой, если несколько»: шаг — один бит (360° / длина)
       самой нижней из выделенных строк, ничего не выделено — нижней строки конуса. Держишь — дальше тем же шагом. */
    const sel = [...rowSel].filter(i => i < Math.min(Z.rows.length, CONE_MAX)), k = sel.length ? Math.max(...sel) : Math.min(Z.rows.length, CONE_MAX) - 1;
    const deg = 360 / Math.max(1, (Z.rows[k] || "").length || 1);
    const go = () => { Z.coneSpin = ((Z.coneSpin || 0) + dir * deg) % 360; renderCone(); };
    go(); say(`◯ Весь конус на бит строки ${k + 1} (${(Z.rows[k] || "").length} бит) — ${+deg.toFixed(2)}°.`);
    spinT = setTimeout(() => { spinI = setInterval(go, 140); }, 350);
  };
  for (const [id, dir] of [["bConeSpinL", -1], ["bConeSpinR", 1]]) {
    const b = $(id);
    b.addEventListener("pointerdown", spinGo(dir));
    ["pointerup", "pointerleave", "pointercancel"].forEach(ev => b.addEventListener(ev, () => { if (spinT || spinI) spinStop(); }));
    b.addEventListener("contextmenu", (e) => { e.preventDefault(); Z.coneSpin = 0; save(); renderCone(); say("◯ Конус — снова в начальном положении."); });
  }
  const ringStep = (dir) => {   // dir: +1 — по часовой, −1 — против
    const T = rowSel.size ? [...rowSel].filter(i => i < Z.rows.length) : [Z.cur], free = T.filter(i => !coneLocked(i)), sel = [...rowSel];
    if (free.length) { snapshot(); free.forEach(i => { Z.rows[i] = coneRotStr(Z.rows[i], -dir); }); sel.forEach(i => rowSel.add(i)); }
    T.filter(i => coneLocked(i)).forEach(i => { const n = Z.rows[i].length; coneRot[i] = (((Math.round(coneRot[i] || 0) - dir) % n) + n) % n; });
    Z.coneRot = coneRot.map(x => Math.round(x || 0));
    renderAll(); save();
  };
  /* v0.102, «как запустить кручение — пока что обычное, всех сразу» и «и видеозапись». ▶ крутить — весь конус крутится сам
     (Z.coneSpin растёт со скоростью ползунка, град/с; минус — в другую сторону), ещё раз — стоп. ⏺ видео — запись холста
     конуса (MediaRecorder, 30 кадров/с, .webm): только сам конус, без кнопок; ещё раз — стоп, файл скачивается. */
  let autoRaf = 0, autoT0 = 0;
  let offDrive = false;   // v0.284: 🎞 покадровая запись сама двигает кручение — кадр анимации ничего не крутит
  const autoTick = (ts) => {
    if (!autoRaf) return;
    if (offDrive) { autoT0 = 0; autoRaf = requestAnimationFrame(autoTick); return; }
    if (ZZ_BG && autoT0 && ts - autoT0 < 48) { autoRaf = requestAnimationFrame(autoTick); return; }   // v0.184: фоном хаба — не чаще 20 кадров в секунду (кадр ~20 мс, кручение медленное)
    const dt = autoT0 ? Math.min(0.1, (ts - autoT0) / 1000) : 0; autoT0 = ts;
    if (!autoStep(dt)) return;
    renderCone();
    autoRaf = requestAnimationFrame(autoTick);
  };
  /* v0.284: один шаг кручения на dt секунд — всё, что делал кадр анимации (режимы, лазер, ✺, остановки на проходе); false — кручение
     встало само (пауза уже сделана). Зовут кадр анимации (dt — по часам) и 🎞 покадровая запись (dt — ровно 1/fps). */
  const autoStep = (dt) => {
    const sp = Z.coneAutoSp ?? 30, m = Z.coneSpinMode || "all";   // v0.104: режимы кручения
    if (m === "all") {
      const s0 = Z.coneSpin || 0, ds = sp * dt;
      if (Z.coneClock && coneLaserFixed() && !Z.cone3d && ds) {   // v0.202: 📌 — конус едет под стоящим лазером: попадания между кадрами, мелкими шагами
        const N = Math.min(Z.rows.length, CONE_MAX); let tolDeg = coneSlitHalf() * 180 / Math.PI;
        for (let i = 1; i < N; i++) tolDeg = Math.min(tolDeg, coneSlitHalf(Z.rows[i].length || 1) * 180 / Math.PI);
        const K = Math.max(1, Math.min(Math.ceil(Math.abs(ds) / tolDeg * 2), 2000)), t = performance.now(); let rec = 0;
        for (let s = 1; s <= K; s++) { Z.coneSpin = s0 + ds * s / K; if (coneWallPaint(coneClockTrace())) rec++; if (s < K && performance.now() - t > 12) break; }
        Z.coneSpin %= 360; if (rec) save();
      } else Z.coneSpin = (s0 + ds) % 360;
    }
    else {
      let dph = coneBitMode(m) ? sp / 10 * dt : sp * dt;   // бит в секунду = скорость / 10
      if (coneFanOn()) dph = coneFanClampDph(dph, m);   // v0.201: ✺ — не быстрее, чем успеваем считать
      const ph0 = Z.coneSpinPh || 0;
      const st = Z.coneClock ? coneClockSweep(ph0, dph, m) : null;   // v0.116: луч-часы — миг, когда щели сошлись, между кадрами
      if (st && !st.part) {   // v0.119: «⏸ на проходе» — встать ровно там, где лазер прошёл
        Z.coneSpinPh = st.ph; autoSet(false); renderCone();
        say(`⏸ Лазер прошёл все кольца (проход ${Z.coneClockN | 0}) — пауза. ▶ крутить — дальше.`);
        return false;
      }
      Z.coneSpinPh = st && st.part ? st.ph : ph0 + dph;   // v0.201: ✺ — кольца только до просчитанного; v0.119: без обрезки по 100 оборотов — иначе сбивался счёт кругов
      coneCycleCheck(ph0, Z.coneSpinPh, m);
      if (coneFanOn()) {   // v0.201: ✺ — вылетевшие гаснут, затор — отпустить; погасли все — пауза
        const F = coneFanStep(coneClockTrace());
        if (F.out || F.freed) { save(); coneLogRender(); }
        if (!F.left) { autoSet(false); renderCone(); say(`⏹ Все ${coneFanN()} лучей вылетели — пауза. Заново — ✕ у строки для заполнения или ⟲ всё на места.`); return false; }
      } else if (Z.coneClock) { const R = coneClockTrace()[0];   // v0.139, «и так все кольца пройдёт наружу»: вышел за край — все кольца на пути встали, пауза
        if (R && R.pass && !R.cells.length && coneRingFrozen(0)) {
          if (coneLaserNextIf()) { const k = coneLaserK(); save(); coneLogRender(); say(`⌖ Луч вышел наружу — лазер ${k + 1} из ${coneLasersN()}, ${coneLaserDeg(k)}°: кольца крутятся дальше с того же рисунка.`); }   // v0.191
          else { autoSet(false); renderCone(); say(!Z.coneLaserChain ? `⏹ Луч вышел наружу — пауза (следующий лазер не включается: «⌖→ след.» выключено).` : `⏹ Все ${coneLasersN()} лазеров прошли — пауза. Заново — ✕ у строки для заполнения или ⟲ всё на места.`); return false; }
        } }
    }
    return true;
  };
  const autoSet = (on) => {
    if (on && !autoRaf && Z.coneClock && (Z.coneSpinMode || "all") !== "all") {   // v0.189: все кольца строк стоят — крутить нечего, сказать
      const fz = Z.voidHits && Z.voidHits.fz, N = Math.min(Z.rows.length, CONE_MAX);
      if (coneFanOn() && !coneFanAlive().length) { say(`⏹ Все ${coneFanN()} лучей уже вылетели. Заново — ✕ у строки для заполнения или ⟲ всё на места.`); on = false; }   // v0.201
      else if (fz && N && Z.rows.slice(0, N).every((_, i) => fz[i] !== undefined) && !(coneFanOn() ? coneReleaseRings() > 0 : coneLaserNextIf())) { say("⏹ Все кольца строк стоят — луч уже прошёл их. Отпустить — 🎯 до строки, ⟲ всё на места или ✕ у строки для заполнения."); on = false; }
    }
    if (on && !autoRaf) { autoT0 = 0; coneClockWas = !!Z.coneClock && coneClockTrace().some(R => R.pass); coneSpinning = true; autoRaf = requestAnimationFrame(autoTick); }   // v0.119: стоим на проходе — он уже засчитан
    if (!on && autoRaf) { cancelAnimationFrame(autoRaf); autoRaf = 0; coneSpinning = false; save(); }
    $("bConeAuto").classList.toggle("on", on); $("bConeAuto").textContent = on ? "⏸ стоп" : "▶ крутить";
    const a3 = $("bC3Auto"); if (a3) { a3.classList.toggle("on", on); a3.textContent = on ? "⏸ стоп" : "▶ крутить"; }   // v0.279: копия в пульте
  };
  $("bConeAuto").onclick = () => autoSet(!autoRaf);
  /* v0.135, «сделай паузу при клике на поле, а плей — только по кнопке»: щелчок по конусу или по полю строк, пока кольца крутятся, —
     пауза (до любого другого действия щелчка); дальше — только ▶ крутить. */
  // v0.175, «пауза — не один, а двойной щелчок»: одиночный щелчок по конусу или полю строк кручение больше не останавливает (v0.135 — останавливал)
  /* v0.157, «пауза и двойной щелчок — воспроизведение по полю»: щелчок по конусу — пауза (v0.135), двойной щелчок — ▶ крутить.
     Сброс вида (масштаб, сдвиг, поворот 3D), что прежде был на двойном щелчке, — теперь Ctrl + двойной щелчок. */
  $("coneCv").addEventListener("dblclick", (e) => { if (e.ctrlKey || e.altKey || e.shiftKey) return; const on = !autoRaf; autoSet(on); say(on ? "▶ Кручу — двойной щелчок по конусу. Ещё двойной — пауза." : "⏸ Пауза — двойной щелчок по конусу. Ещё двойной — дальше."); });   // v0.175: двойной щелчок — и пуск, и пауза
  /* v0.134, «нужна кнопка вперёд-назад для Плея, вручную, чтобы смотреть»: ◀ ▶ — кручение (тем же режимом, что ▶ крутить) до
     следующего события лазера: конец луча сменился — упёрся в другую ячейку, пойман другим кольцом, прошёл. Каждый шаг — в лог. */
  const coneStep = (dir) => {
    autoSet(false);
    const m = Z.coneSpinMode || "all";
    if (m === "all") { say("◀ ▶ шагают кручением «Каждое», «Встреч Стр» или «Встреч Бит» — «всё целиком» не сдвигает кольца друг относительно друга. Выбери режим рядом с ▶."); return; }
    if (!Z.coneClock) { Z.coneClock = true; $("coneClock").checked = true; }
    const N = Math.min(Z.rows.length, CONE_MAX); if (!N) return;
    let tolDeg = coneSlitHalf() * 180 / Math.PI; for (let i = 1; i < N; i++) tolDeg = Math.min(tolDeg, coneSlitHalf(Z.rows[i].length || 1) * 180 / Math.PI);
    const perUnit = coneBitMode(m) ? 360 / Math.max(1, Math.min(...Z.rows.slice(0, N).map(s => s.length || 1))) : 1;   // градусов за единицу фазы у самого быстрого кольца
    const d = dir * (Z.coneAutoSp < 0 ? -1 : 1) * tolDeg / perUnit / 2, key = (R) => !R ? "" : R.wall ? "w" + R.wall : R.pass ? (R.cells.length ? "v" + R.cells[0] : "e") : "s" + R.stop;   // v0.136: вперёд — в выбранном направлении
    if (coneSunOn()) {   // v0.206: ☀ — до мига, когда свет упал иначе
      const k0 = coneSunTrace().hits.join("|"), p0 = Z.coneSpinPh || 0; let p = p0, s = 0;
      for (; s < 3000; s++) { p += d; Z.coneSpinPh = p; if (coneSunTrace().hits.join("|") !== k0) break; }
      if (s >= 3000) { Z.coneSpinPh = p0; say("☀ За 3000 мелких шагов свет не сменился — крути ▶."); return; }
      save(); renderCone(); say((dir > 0 ? "▶ Шаг вперёд" : "◀ Шаг назад") + ": свет упал иначе."); return;
    }
    const keyAll = () => coneFanOn() ? coneClockTrace().map(R => R.k + key(R)).join("|") : key(coneClockTrace()[0]);   // v0.201: ✺ — конец любого луча
    const ph0 = Z.coneSpinPh || 0, k0 = keyAll();
    let ph = ph0, s = 0;
    for (; s < 20000; s++) { ph += d; Z.coneSpinPh = ph; if (keyAll() !== k0) break; }
    if (s >= 20000 && coneFanOn()) { Z.coneSpinPh = ph0; const F = coneFanStep(coneClockTrace()); save(); renderCone(); coneLogRender();
      say(F.freed ? "✺ Все живые лучи упёрлись в стоящие кольца — кольца отпущены. ◀ ▶ — дальше." : `✺ За 20 000 мелких шагов ни один луч не сдвинулся (живых ${F.left}).`); return; }
    if (s >= 20000) { Z.coneSpinPh = ph0; const R = coneClockTrace()[0];
      if (R && R.pass && !R.cells.length && coneRingFrozen(0) && coneLaserNextIf()) { const k = coneLaserK(); save(); renderCone(); coneLogRender(); say(`⌖ Лазер ${k + 1} из ${coneLasersN()}, ${coneLaserDeg(k)}° — прежний вышел наружу. ◀ ▶ — шагать дальше.`); return; }   // v0.191
      say(R && R.pass && !R.cells.length ? "⏹ Лазер вышел наружу — все кольца на его пути встали. Заново — ✕ у строки для заполнения или ⟲ всё на места." : "◀ ▶: за 20 000 мелких шагов конец луча не сменился — крути ▶ или сдвинь строку 1."); return; }
    save(); renderCone();
    if (coneFanOn()) {   // v0.201: ✺ — вылетевшие гаснут
      const F = coneFanStep(coneClockTrace()); if (F.out || F.freed) { save(); renderCone(); coneLogRender(); }
      if (!F.left) { say(`⏹ Все ${coneFanN()} лучей вылетели. Заново — ✕ у строки для заполнения или ⟲ всё на места.`); return; }
    }
    const L = Z.coneLog && Z.coneLog.list, last = L && L[L.length - 1];
    say((dir > 0 ? "▶ Шаг вперёд" : "◀ Шаг назад") + (last ? ": " + last.t : "."));
  };
  $("bConeStepB").onclick = () => coneStep(-1);
  $("bConeStepF").onclick = () => coneStep(1);
  /* v0.188, «как сделать, чтобы луч дошёл до 10 строки» → «да» на «🎯 до строки N»: крутить (тем же режимом и шагом, что ◀ ▶) до мига,
     когда луч проходит строку N — выходит из её кольца через щель; там и встать. По пути всё как при ▶: кольца, которые луч прошёл,
     встают, стены красятся, лог пишется. Номер — в поле рядом (Z.coneGoN). Строка уже пройдена или до неё не дойти за круг — ничего
     не меняется. */
  const goN = $("coneGoN"); goN.value = Z.coneGoN || 10;
  goN.onchange = () => { Z.coneGoN = Math.max(1, Math.round(+goN.value) || 1); goN.value = Z.coneGoN; save(); };
  const outLab = () => { const b = $("bConeOut"); b.classList.toggle("on", !!Z.coneOutOn); b.textContent = `✎ в поле ${coneOutLane() + 1}`; };   // v0.195
  outLab();
  $("bConeOut").onclick = () => {
    if (!Array.isArray(Z.lanes)) { say("✎ Полей строк нет — писать некуда."); return; }
    Z.coneOutOn = !Z.coneOutOn;
    const t = coneOutLane();
    if (Z.coneOutOn) {
      Z.coneOutBak = { t, rows: (Z.lanes[t] || []).slice() };   // что было в поле — в запас
      if (!Z.coneClock) { Z.coneClock = true; $("coneClock").checked = true; }
      if ((Z.laneCount | 0) < t + 1) $("laneCount").onchange({ target: { value: String(t + 1) } });   // v0.276: в списке — только есть поля, число передаём прямо
      coneOutSync(); renderRows();
      say(`✎ Пишу в поле ${t + 1}: строки из нулей той же длины (+ строка для заполнения); куда упадёт луч — там «1». Прежнее поле ${t + 1} — в запасе, правый щелчок по ✎ вернёт.`);
    } else say(`✎ Больше не пишу в поле ${t + 1} — что там есть, остаётся.`);
    outLab(); save();
  };
  $("bConeOut").oncontextmenu = (e) => {
    e.preventDefault(); const B = Z.coneOutBak;
    if (!B || !Array.isArray(B.rows) || !Array.isArray(Z.lanes)) { say("✎ Запаса нет — возвращать нечего."); return; }
    Z.coneOutOn = false; Z.lanes[B.t] = B.rows.length ? B.rows.slice() : ["1"]; delete Z.coneOutBak; outLab(); renderRows(); save();
    say(`✎ Поле ${B.t + 1} вернулось как было до записи лазера.`);
  };
  const fanLab = () => { const b = $("bConeFan"); if (b) b.classList.toggle("on", !!Z.coneFan); };   // v0.201: ✺ все лучи
  fanLab();
  $("bConeFan").onclick = () => {
    Z.coneFan = !Z.coneFan; coneLaserResetAll(); coneWallWas = undefined; coneClockWas = null;
    if (Z.coneFan && Z.coneSun) { Z.coneSun = false; sunLab(); }   // v0.206: ✺ и ☀ — что-то одно
    if (Z.coneFan && !Z.coneClock) { Z.coneClock = true; $("coneClock").checked = true; }
    fanLab(); save(); renderCone(); coneLogRender();
    say(Z.coneFan ? `✺ Все лучи: ${coneFanN()} из центра через ${Math.round(36000 / coneFanN()) / 100}°, первый — ${+Z.coneLaser0 || 0}°. Светят разом, вылетевший гаснет. ▶ крутить — до последнего.` : `⌖ Снова по одному лазеру: ${coneLasersN()} через ${Math.round(3600 / coneLasersN()) / 10}°.`);
  };
  const sunLab = () => { $("bConeSun").classList.toggle("on", !!Z.coneSun); { const b = $("coneSunCut"), z = coneSunCut() === "zero"; b.textContent = z ? "Без щелей" : "щели"; b.classList.toggle("on", z); } coneSunUi(); };   // v0.228: пропуск — одна кнопка-переключатель   // v0.206: ☀ солнце
  sunLab();
  $("bConeSun").onclick = () => {
    Z.coneSun = !Z.coneSun;
    if (Z.coneSun) { if (Z.coneFan) { Z.coneFan = false; fanLab(); } if (!Z.coneClock) { Z.coneClock = true; $("coneClock").checked = true; } }
    coneLaserResetAll(); coneWallWas = undefined; coneSunWas = undefined; coneClockWas = null;
    sunLab(); save(); renderCone(); coneLogRender();
    say(Z.coneSun ? (coneSunCut() === "zero" ? "☀ Солнце, без щелей: строка 1 светит всегда; «0» — проход во всю ячейку, «1» — стена. ▶ крутить — свет красит стены." : "☀ Солнце: строка 1 светит всегда; свет проходит кольца только в щелях между битами (ширина — «щель»): у «11» — два луча. ▶ крутить — свет красит стены.") : "☀ Солнце выключено — снова лазер.");
  };
  $("coneSunCut").onclick = () => { Z.coneSunCut = coneSunCut() === "zero" ? "gaps" : "zero"; coneSunWas = undefined; sunLab(); save(); renderCone(); coneLogRender();   // v0.228: щелчок — щели ↔ Без щелей
    say(coneSunCut() === "zero" ? "☀ Без щелей: «0» пропускает свет во всю свою ширину, «1» — стена." : "☀ Пропуск — щели между битами, ширина — ползунок «щель»."); };
  const lzN = $("coneLasersN"), lz0 = $("coneLaser0");   // v0.194: сколько лазеров и угол первого
  lzN.value = coneLasersN(); lz0.value = +Z.coneLaser0 || 0;
  lzN.onchange = () => { Z.coneLasers = Math.max(1, Math.min(72, Math.round(+lzN.value) || 8)); lzN.value = Z.coneLasers; save(); renderCone(); coneLogRender();
    say(`⌖ Лазеров ${Z.coneLasers}, шаг ${Math.round(3600 / Z.coneLasers) / 10}°` + (coneLaserK() + 1 > Z.coneLasers ? ` — нынешний (${coneLaserK() + 1}) уже за последним: дальше пауза.` : ".")); };
  lz0.onchange = () => { let v = +lz0.value || 0; v = Math.round((((v % 360) + 360) % 360) * 1e4) / 1e4; Z.coneLaser0 = v; lz0.value = v; save(); renderCone(); coneLogRender();   // v0.202: и доли градуса (v0.205: комментарий глотал хвост строки)
    say(`⌖ Первый лазер — ${v}° от верха по часовой; нынешний (${coneLaserK() + 1}) — ${coneLaserDeg()}°.`); };
  const fixLab = () => $("bLaserFix").classList.toggle("on", coneLaserFixed());   // v0.202: 📌 лазер, ↻ шаг
  const chainLab = () => $("bLaserChain").classList.toggle("on", !!Z.coneLaserChain);   // v0.202: ⌖→ след.
  chainLab();
  $("bLaserChain").onclick = () => {
    Z.coneLaserChain = !Z.coneLaserChain; chainLab(); save();
    say(Z.coneLaserChain ? `⌖→ Луч вышел за край — включается следующий лазер (+${Math.round(3600 / coneLasersN()) / 10}°), до ${coneLasersN()}.` : "⌖→ Выключено: луч вышел за край — пауза, следующий лазер не включается.");
  };
  fixLab();
  $("bLaserFix").onclick = () => {
    Z.coneLaserFix = !coneLaserFixed(); fixLab(); coneWallWas = undefined; save(); renderCone(); coneLogRender();
    say(coneLaserFixed() ? "📌 Лазер стоит на месте — конус («Всё», ⟲ ⟳) крутится под ним." : "📌 Лазер снят с места — крутится вместе со всем конусом, как прежде.");
  };
  const stepSel = $("coneLaserStepK"), f4 = (x) => +x.toFixed(x < 1 ? 4 : 2);
  const stepLab = () => { const T = coneMaxLen(), S = T * (T + 1) / 2; stepSel.options[1].text = `1/${T} = ${f4(360 / T)}°`; stepSel.options[2].text = `1/(1+…+${T}) = 1/${S} = ${f4(360 / S)}°`; };
  stepSel.value = ["45", "T", "S"].includes(Z.coneLaserStepK) ? Z.coneLaserStepK : "45"; stepLab();
  stepSel.onfocus = stepSel.onmousedown = stepLab;
  stepSel.onchange = () => { Z.coneLaserStepK = stepSel.value; save(); say(`↻ Шаг лазера — ${f4(coneLaserStepDeg())}°.`); };
  const laserTurn = (dir) => {
    const d = coneLaserStepDeg(); let v = ((((+Z.coneLaser0 || 0) + dir * d) % 360) + 360) % 360; v = Math.round(v * 1e6) / 1e6;
    Z.coneLaser0 = v; lz0.value = f4(v); coneWallWas = undefined; save(); renderCone(); coneLogRender();
    say(`${dir > 0 ? "↻" : "↺"} Лазер повёрнут на ${dir > 0 ? "+" : "−"}${f4(d)}° — теперь ${f4(v)}° от верха по часовой.`);
  };
  $("bLaserTurn").onclick = () => laserTurn(1);
  $("bLaserTurn").oncontextmenu = (e) => { e.preventDefault(); laserTurn(-1); };
  $("bConeGo").onclick = () => {
    autoSet(false);
    if (coneSunOn()) { say("🎯 — для лазера; у солнца свет идёт всегда. Выключи ☀, чтобы вести луч до строки."); return; }   // v0.206
    /* v0.190, снимок «что не так?» (режим «Всё», лог «1 закрыт»): во «Всё» конус крутится целиком, вырез строки 1 относительно лазера не
       сдвигается — луч не выйдет никогда. 🎯 теперь сам переключает на «Встреч Стр» (как выбрать его рядом с ▶) и крутит дальше. */
    let switched = false;
    if ((Z.coneSpinMode || "all") === "all") { const sel = $("coneSpinMode"); sel.value = "opp"; sel.onchange({ target: sel }); switched = true; }
    const m = Z.coneSpinMode || "all", N = Math.min(Z.rows.length, CONE_MAX);
    if (!N) return;
    if (!Z.coneClock) { Z.coneClock = true; $("coneClock").checked = true; }
    const t = Math.min(N, Math.max(1, Math.round(+goN.value) || 1)) - 1; goN.value = Z.coneGoN = t + 1;
    const passed = (R) => !!R && (t === 0 ? (R.stop > 0 || R.pass) : R.g.some((v, q) => q % 2 === 0 && v === t));
    if (passed(coneClockTrace()[0])) { say(`🎯 Луч уже проходит строку ${t + 1}. Заново — ⟲ всё на места или ✕ у строки для заполнения.`); return; }
    const bitm = coneBitMode(m), dir = (Z.coneAutoSp ?? 30) < 0 ? -1 : 1;
    let tolDeg = coneSlitHalf() * 180 / Math.PI; for (let i = 1; i < N; i++) tolDeg = Math.min(tolDeg, coneSlitHalf(Z.rows[i].length || 1) * 180 / Math.PI);
    const perUnit = bitm ? 360 / Math.max(1, Math.min(...Z.rows.slice(0, N).map(s => s.length || 1))) : 1;
    const d = dir * tolDeg / perUnit / 2, span = bitm ? Math.max(...Z.rows.slice(0, N).map(s => s.length || 1)) : 360;
    const steps = Math.min(200000, Math.ceil(span / Math.abs(d)) + 2);
    const bak = { ph: Z.coneSpinPh, vh: JSON.stringify(Z.voidHits || null), log: JSON.stringify(Z.coneLog || null), n: Z.coneClockN, wall: coneWallWas, xl: JSON.stringify(Z.coneExLog || null), xr: Z.coneExRun };
    const ph0 = Z.coneSpinPh || 0;
    let R = null, ok = false, freed = 0;
    const run = () => {
      for (let st = 1; st <= steps; st++) {
        Z.coneSpinPh = ph0 + d * st;
        const tr = coneClockTrace(); R = tr[0]; coneWallPaint(tr);
        if (passed(R)) return true;
        if (R && R.pass && !R.cells.length) return false;   // ушёл за край раньше
      }
      return false;
    };
    ok = run();
    /* v0.189: не дошёл, а кольца стоят с прошлого прохода (или остались от другого режима) — отпустить их и ещё раз с этого места.
       Краска и лог остаются; не выйдет и так — всё назад, как было. */
    const fz0 = JSON.parse(bak.vh || "null"), nfz = fz0 && fz0.fz ? Object.keys(fz0.fz).length : 0;
    if (!ok && nfz) {
      Z.coneSpinPh = bak.ph; Z.voidHits = JSON.parse(bak.vh); coneReleaseRings(); coneExArchive(false); Z.voidHits.ex = {}; Z.voidHits.exI = {}; Z.voidHits.lph = Z.coneSpinPh || 0;   // v0.191: отпустить на месте
      Z.coneLog = JSON.parse(bak.log); if (!Z.coneLog) delete Z.coneLog; Z.coneClockN = bak.n; coneWallWas = undefined;
      coneWallPaint(coneClockTrace());   // нынешний конец луча — отправная точка
      if (passed(coneClockTrace()[0])) { save(); renderCone(); coneLogRender(); say(`🎯 Отпустил остановленные кольца (${nfz}) — луч сразу проходит строку ${t + 1}.`); return; }
      ok = run(); if (ok) freed = nfz;
    }
    if (!ok) {
      Z.coneSpinPh = bak.ph; Z.voidHits = JSON.parse(bak.vh); if (!Z.voidHits) delete Z.voidHits;
      Z.coneLog = JSON.parse(bak.log); if (!Z.coneLog) delete Z.coneLog; Z.coneClockN = bak.n; coneWallWas = bak.wall;
      Z.coneExLog = JSON.parse(bak.xl); if (!Z.coneExLog) delete Z.coneExLog; Z.coneExRun = bak.xr;   // v0.193
      renderCone(); say(`🎯 До строки ${t + 1} луч за круг не доходит — ничего не менял. Посмотри 🔮 прогноз или ⟲ всё на места.`); return;
    }
    save(); renderCone(); coneLogRender();
    const turned = conePredFmt(Z.coneSpinPh - ph0, bitm), ex = Z.voidHits && Z.voidHits.ex && Z.voidHits.ex[t];
    say("🎯 " + (switched ? "Во «Всё» луч не выходит — переключил на «Встреч Стр». " : "") + (freed ? `Отпустил остановленные кольца (${freed}). ` : "") + `Луч прошёл строку ${t + 1} — повернул на ${turned}` + (ex ? `; строка от щели вылета: ${ex}` : "") +
        (R.wall ? `. Дальше упирается в строку ${R.wall[0] + 1}.` : R.pass ? (R.cells.length ? ". Прошёл все строки — пойман строкой для заполнения." : ". Прошёл все строки и ушёл за край.") : "."));
  };
  $("bConeLogClr").onclick = () => { Z.coneLog = { n: 0, list: [] }; save(); coneLogRender(); say("📜 Лог лазера очищен."); };
  $("bConePred").onclick = () => {   // v0.187
    const P = conePredict();
    if (P.err) { say(P.err); return; }
    conePred = P; conePredRender(); renderCone(); coneLogRender();
    const W = $("coneTxtWin"); if (W && W.hidden) $("bConeTxt").click();
    say(`🔮 Прогноз: вылетит строк ${P.rows.length} из ${P.N}; ` + (P.end === "edge" ? "луч уйдёт за край через " + conePredFmt(P.endPh, P.bitm) : "за круг за край не выйдет") +
        (P.fill.length ? `; строка для заполнения поймает ячейки ${P.fill.map(c => c + 1).join(", ")}.` : "; строка для заполнения ничего не поймает.") + " Конус не менялся.");
  };
  $("bConePredCopy").onclick = () => {
    if (!conePred || !conePred.rows.length) { say("🔮 Прогноза нет — 🔮 просчитать в «Лазере»."); return; }
    const t = conePred.rows.map(([, , b]) => b).join("\n");
    (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => say(`🔮 Скопировано строк прогноза: ${conePred.rows.length}. Ctrl+V в поле строк вставит их столбиком.`), () => say("🔮 Не вышло скопировать."));
  };
  conePredRender();
  $("bConeExClr").onclick = () => {   // v0.193: стереть статистику вылетов (и вылеты нынешнего лазера)
    const n = (Array.isArray(Z.coneExLog) ? Z.coneExLog.length : 0); Z.coneExLog = []; Z.coneExRun = 0;
    if (Z.voidHits) { Z.voidHits.ex = {}; Z.voidHits.exI = {}; }
    save(); coneLogRender(); say(`🚪 Статистика вылетов стёрта (лазеров было ${n}). Кольца и краска не тронуты.`);
  };
  $("bConeExCopy").onclick = () => {   // v0.186: столбик строк от щели вылета — строка на строку, вставляется в поле Ctrl+V
    const N = Math.min(Z.rows.length, CONE_MAX), bitm = coneBitMode(Z.coneSpinMode), Ls = coneExitLasers().filter(L => L.rows.length);
    if (!Ls.length) { say("🚪 Луч ещё ни из одной строки не вышел."); return; }
    const ex = Ls.reduce((c, L) => c + L.rows.length, 0);   // v0.192: со статистикой — таблицей через табуляцию, лазеры через пустую строку
    const t = Ls.map(L => coneExitHead(L, N) + "\nстр\tбиты от щели\tщель\tкольцо\tчерез\n" +
      L.rows.map(([b, x, I]) => [b + 1, x, I.s || "", I.a !== undefined ? I.a + "°" : "", I.d !== undefined ? conePredFmt(I.d, coneBitMode(L.m || Z.coneSpinMode)) : ""].join("\t")).join("\n")).join("\n\n");
    (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => say(`🚪 Скопировано: лазеров ${Ls.length}, строк ${ex} — со статистикой, таблицей (вставляется в Excel по столбцам).`), () => say("🚪 Не вышло скопировать."));
  };
  $("bConeLogCopy").onclick = () => {
    const t = (Z.coneLog && Z.coneLog.list || []).map(e => e.f || e.t).join("\n");   // v0.140: в копию — полные записи
    if (!t) { say("📜 Лог пуст."); return; }
    (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => say("📜 Лог скопирован — " + Z.coneLog.list.length + " записей."), () => say("📜 Не вышло скопировать — выдели текст лога мышью."));
  };
  coneLogRender();
  {   // v0.140: панель текста и лога — справа, от низа кнопок до низа окна
    const tl = document.querySelector("#w-cone .wbody > .tools"), cb = $("coneBot");
    const place = () => { if (tl && cb && cb.parentElement === tl.parentElement) cb.style.top = (tl.offsetTop + tl.offsetHeight + 4) + "px"; };
    if (tl && cb && window.ResizeObserver) new ResizeObserver(place).observe(tl);
    place();
  }
  /* v0.122, «нужна кнопка, которая сбрасывает биты всех строк» (после «как сбрасывать накрученные биты, чтобы по умолчанию
     вернулось»; до неё сброс был в трёх местах): «⟲ всё на места» — разом у всех колец накрутка «на вид», кручение (и счёт кругов
     и проходов), довод строки 1. Строки не трогает: сдвиг строки открытым кольцом — настоящая правка, её возвращает ↩. */
  $("bConeAllHome").onclick = () => {
    autoSet(false);
    const H = Z.home;
    if (H) {   // v0.125: своё умолчание (⭐) — положения колец и настройки конуса, как запомнены
      coneRot.length = 0; (Array.isArray(H.coneRot) ? H.coneRot : []).forEach(x => coneRot.push(Math.round(x || 0))); Z.coneRot = coneRot.slice();
      Z.coneSpin = H.coneSpin || 0; Z.coneSpinPh = H.coneSpinPh || 0; Z.coneAimRot = H.coneAimRot || 0; Z.coneClockN = 0; coneClockFlash = []; coneLaserResetAll();   // v0.138
      const keys = ["coneClock", "coneClockStop", "coneVoid", "coneSlit", "coneSpinMode", "coneAutoSp", "coneGlow", "conePoly", "coneSect", "coneOnlySel", "cone3d", "coneOcta", "cone3Dig", "cone3H", "cone3Bw", "animOp", "animSp", "animByPass", "animRowsN", "animSeed",
                    "coneRays", "coneMir", "coneLock", "coneLocks", "coneAxisOff", "coneAxisOffs", "coneOctaSel"];   // v0.359: и что отражает зеркало
      for (const k of keys) { if (k in H) Z[k] = JSON.parse(JSON.stringify(H[k])); else delete Z[k]; }
      for (const k of ["coneClock", "coneGlow", "conePoly", "coneSect", "coneOnlySel", "cone3d", "coneOcta", "cone3Dig"]) { const el = $(k); if (el) el.checked = !!Z[k]; }
      $("coneLock").checked = Z.coneLock !== false; $("coneVoid").checked = Z.coneVoid !== false;
      $("coneRays").value = Z.coneRays || "off"; $("coneMir").value = Z.coneMir || "off"; $("coneSpinMode").value = Z.coneSpinMode || "all";
      { const os = $("coneOctaSel"); if (os) os.value = Z.coneOcta ? (Z.coneOctaSel === "cur" ? "cur" : "all") : "off"; }   // v0.359
      coneDirUi(); $("cone3H").value = Z.cone3H ?? 1; $("cone3Bw").value = Z.cone3Bw ?? 1; $("animOp").value = Z.animOp || "xor"; $("animSp").value = Z.animSp ?? 40; $("animByPass").checked = !!Z.animByPass;
      $("coneSlit").value = +Z.coneSlit || 2; $("coneSlitV").textContent = (+Z.coneSlit || 2).toFixed(1).replace(".", ",") + "°";
      $("bConeClockStop").classList.toggle("on", !!Z.coneClockStop);
      coneClockWas = !!Z.coneClock && coneClockTrace().some(R => R.pass);
      save(); renderRows(); renderCone();
      say("⟲ Всё на местах — из умолчания ⭐: положения колец, кручение, довод строки 1 и настройки конуса. Счёт проходов — с нуля. Биты строк не менялись.");
      return;
    }
    const k = coneRot.filter(x => Math.round(x || 0)).length;
    coneRot.fill(0); Z.coneRot = coneRot.slice();
    Z.coneSpin = 0; Z.coneSpinPh = 0; Z.coneClockN = 0; Z.coneAimRot = 0; coneClockFlash = []; coneLaserResetAll();   // v0.138
    coneClockWas = !!Z.coneClock && coneClockTrace().some(R => R.pass);
    save(); renderRows(); renderCone();
    say(`⟲ Всё на местах: накрутка снята${k ? ` (у колец: ${k})` : ""}, кручение и счёт — с нуля, строка 1 без довода. Биты строк не менялись.`);
  };
  /* v0.105, «режим дзен»: только конус на весь экран (и во весь экран браузера, если можно); всё остальное спрятано.
     Выход — Esc (или выход из полноэкранного). Подсказка внизу гаснет через три секунды. */
  let zenT = 0;
  /* v0.176, «режим дзен с показом кнопок пульта, по колесику-щелчку вкл/выкл, масштаб, перемещение — всё мышкой»: средняя кнопка
     (колесо) над конусом: щёлкнул, не сдвинув, — дзен вкл/выкл; тянешь — сдвиг вида (и в плоском, и в 3D). Колесо — масштаб, как было. */
  { const cvz = $("coneCv");
    cvz.addEventListener("pointerdown", (e) => {
      if (e.button !== 1) return;
      e.preventDefault(); e.stopPropagation(); try { cvz.setPointerCapture(e.pointerId); } catch (err) { /* указатель уже отпущен */ }
      const x0 = e.clientX, y0 = e.clientY, p0 = conePan.slice(), dpr = window.devicePixelRatio || 1; let moved = false;
      const mv = (ev) => { if (Math.abs(ev.clientX - x0) + Math.abs(ev.clientY - y0) > 4) { moved = true; cvz.style.cursor = "move"; } if (moved) { conePan = [p0[0] + (ev.clientX - x0) * dpr, p0[1] + (ev.clientY - y0) * dpr]; renderCone(); } };
      const up = () => { cvz.removeEventListener("pointermove", mv); cvz.removeEventListener("pointerup", up); cvz.removeEventListener("pointercancel", up); cvz.style.cursor = "grab";
        if (!moved) zenSet(!document.body.classList.contains("zen")); };
      cvz.addEventListener("pointermove", mv); cvz.addEventListener("pointerup", up); cvz.addEventListener("pointercancel", up);
    }, true);
    cvz.addEventListener("auxclick", (e) => { if (e.button === 1) e.preventDefault(); });
    cvz.addEventListener("mousedown", (e) => { if (e.button === 1) e.preventDefault(); });   // без автопрокрутки браузера
  }
  window.zenSet = (on) => {
    const w = $("w-cone");
    if (on && w.classList.contains("collapsed")) w.querySelector(".bc").click();
    if (window.cgrpZenMove) cgrpZenMove(on);   // v0.256: отмеченные 🧘 группы с левой панели — на время дзена к конусу
    document.body.classList.toggle("zen", on); document.body.classList.remove("zen-quiet");
    clearTimeout(zenT); if (on) zenT = setTimeout(() => document.body.classList.add("zen-quiet"), 3000);
    try { if (on && !document.fullscreenElement && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {}); else if (!on && document.fullscreenElement) document.exitFullscreen().catch(() => {}); } catch (e) {}
    requestAnimationFrame(() => { renderCone(); if (!on) { packWins(); renderAll(); } });
  };
  $("bConeZen").onclick = () => zenSet(true);
  document.addEventListener("fullscreenchange", () => { if (!document.fullscreenElement && document.body.classList.contains("zen")) zenSet(false); });
  $("bConeAuto").oncontextmenu = (e) => { e.preventDefault(); Z.coneSpin = 0; Z.coneSpinPh = 0; Z.coneClockN = 0; coneLaserResetAll(); save(); renderCone(); coneLogRender(); say("◯ Кручение сброшено — всё на своих местах."); };   // v0.104
  $("coneSpinMode").value = Z.coneSpinMode || "all";
  {   // v0.124: ползунок ширины щели — один для расчёта и рисунка
    const sl = $("coneSlit"), sv = $("coneSlitV"), show = () => { sv.textContent = (+Z.coneSlit || 2).toFixed(1).replace(".", ",") + "°"; };
    sl.value = +Z.coneSlit || 2; show();
    sl.oninput = () => { Z.coneSlit = +sl.value; show(); renderCone(); };
    sl.onchange = () => save();
    sl.ondblclick = () => { Z.coneSlit = 2; sl.value = 2; show(); save(); renderCone(); };
  }
  if (Z.coneAim) { Z.coneAimRot =(Z.coneAimRot || 0) + 90 * (Z.coneAim | 0); Z.coneAim = 0; }   // v0.121: был выбран вырез → луч туда же, доводом
  for (const [id, d] of [["bConeAimL", -1], ["bConeAimR", 1]]) {   // v0.120: луч — в соседнюю щель кольца 2, крутится только строка 1
    $(id).onclick = () => { if (!Z.coneClock) { Z.coneClock = true; $("coneClock").checked = true; } coneAimStep(d); };
    $(id).oncontextmenu = (e) => { e.preventDefault(); Z.coneAimRot = 0; coneClockWas = coneClockTrace().some(R => R.pass); save(); renderCone(); say("⌖ Довод строки 1 снят — она снова на своём месте."); };
  }
  $("bConeClockStop").classList.toggle("on", !!Z.coneClockStop);   // v0.119
  $("bConeClockStop").onclick = () => {
    Z.coneClockStop = !Z.coneClockStop; $("bConeClockStop").classList.toggle("on", Z.coneClockStop);
    if (Z.coneClockStop && !Z.coneClock) { Z.coneClock = true; $("coneClock").checked = true; }
    save(); renderCone();
    say(Z.coneClockStop ? "⏸ На проходе: как только лазер пройдёт все кольца, кручение встанет. Дальше — ▶ крутить." : "⏸ Без остановок: лазер метит ячейки на ходу.");
  };
  /* v0.189, «и ничего не крутит» (снимок: Встреч Бит, одна строка, вырез закрыт): остановленные кольца (Z.voidHits.fz) хранят фазу в
     единицах своего режима — во «Встреч Стр» в градусах, в Каждое / Встреч Бит в битах. После смены режима 179° читались как 179 бит,
     вырез строки 1 вставал закрытым навсегда, и крутить было нечего. Теперь смена режима отпускает кольца (краска и лог остаются). */
  $("coneSpinModeB").onclick = (e) => { const b = e.target.closest("button[data-sm]"); if (!b) return; const sel = $("coneSpinMode"); sel.value = b.dataset.sm; sel.onchange({ target: sel }); };   // v0.279
  $("bC3Auto").onclick = () => $("bConeAuto").click();   // v0.279: пульт жмёт те же кнопки «Кручения»
  $("bC3Auto").oncontextmenu = (e) => $("bConeAuto").oncontextmenu(e);
  $("bC3Dir").onclick = () => $("bConeDir").click();
  $("coneSpinMode").onchange = (e) => { Z.coneSpinMode = e.target.value; spinSpUi(); coneSpinModeUi(); Z.coneSpinPh = 0; Z.coneClockN = 0; coneLaserResetAll(); coneWallWas = undefined; save(); renderCone(); coneLogRender();
    say({ all: "▶ Всё целиком: весь конус одним поворотом.", bit: "▶ Каждое по биту: маленькие кольца вертятся быстрее — рисунок закручивается спиралью.", obit: "▶ Навстречу по биту: каждое кольцо на бит за шаг, через строку — в обратную сторону.", opp: "▶ Навстречу по строкам: чётные кольца по часовой, нечётные против, с одной скоростью." }[Z.coneSpinMode] + " Правый щелчок по ▶ — всё на места."); };
  /* v0.136, «эта скорость непонятная — раздели: одна только скорость, а направление задавать другой кнопкой; слева-справа — стрелки
     шаг»: ползунок — величина (5…120), знак Z.coneAutoSp — направление, его переключает «↻ по часовой / ↺ против». */
  coneDirUi();
  $("coneAutoSp").oninput = (e) => { Z.coneAutoSp = (Z.coneAutoSp < 0 ? -1 : 1) * spinSpOf(+e.target.value); spinSpUi(); };   // v0.198: по логарифму
  $("coneAutoSp").onchange = () => save();
  $("bConeDir").onclick = () => { Z.coneAutoSp = -(Z.coneAutoSp || 30); coneDirUi(); save(); say(Z.coneAutoSp < 0 ? "↺ Кручение — против часовой." : "↻ Кручение — по часовой."); };
  /* v0.198, «аниматрицу надо ещё сюда» (из Треугольника) и «скорость — больше возможностей». 🌊 Волна сверху вниз: строка r+1
     переписывается операцией с уже переписанной строкой r; дошла до низа — проход. Строки разной длины складываются ПО УГЛУ
     на конусе (выбор пользователя): бит j нижнего кольца берёт бит верхнего кольца, лежащий на луче через середину бита j, с
     учётом поворота колец (coneRotOf — накрутка, кручение). Счёт проходов; картина повторилась — цикл (сравнение по отпечатку).
     ⏮ — к началу прохода, ещё раз — на проход назад. Строки правили не волной (руками, ↩, шаблон) — счёт заново.
     Скорость — строк в секунду, 0,5…5000 по логарифму. */
  const ANIM_OPS = { xor: (a, b) => a ^ b, xnor: (a, b) => 1 - (a ^ b), nand: (a, b) => 1 - (a & b), nor: (a, b) => 1 - (a | b), and: (a, b) => a & b, or: (a, b) => a | b };
  const animSpOf = (p) => 0.5 * Math.pow(10000, p / 100);
  const animHash = (s) => { let h1 = 0xdeadbeef, h2 = 0x41c6ce57; for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909); h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h2 >>> 0).toString(36) + ":" + (h1 >>> 0).toString(36) + ":" + s.length; };
  let animRaf = 0, animT0 = 0, animAcc = 0, animSig = null, aRow = 0, aPass = 0, aPer = 0, aPer0 = 0, animSeen = new Map(), animHist = [], animStart = null;   // v0.331: animStart — биты до первой волны
  const animKey = () => Z.rows.join(",");
  const animSync = () => {
    const k = animKey(); if (animSig === k) return;
    animSig = k; aRow = 0; aPass = 0; aPer = 0; aPer0 = 0; animSeen = new Map([[animHash(k), 0]]); animHist = [{ p: 0, rows: Z.rows.slice() }]; animStart = Z.rows.slice();
  };
  const animStep1 = () => {   // одна строка волны
    const R = Z.rows, N = R.length; if (N < 2) return;
    if (aRow >= N - 1) aRow = 0;
    const A = R[aRow], B = R[aRow + 1], nA = A.length, nB = B.length, rA = coneRotOf(aRow), rB = coneRotOf(aRow + 1), f = ANIM_OPS[Z.animOp] || ANIM_OPS.xor;
    let o = "";
    const fz = wallMask(aRow + 1, nB);   // v0.347: 🧱 стенка — замороженные биты держат своё значение
    for (let j = 0; j < nB; j++) { if (fz && fz[j]) { o += B[j]; continue; } let k = Math.floor((j + 0.5 - rB) / nB * nA + rA) % nA; if (k < 0) k += nA; o += f(A.charCodeAt(k) & 1, B.charCodeAt(j) & 1) ? "1" : "0"; }
    R[aRow + 1] = o;
    if (++aRow < N - 1) return;
    aRow = 0; aPass++;
    const k = animKey(), h = animHash(k);
    if (animSeen.has(h)) { if (!aPer) { aPer0 = animSeen.get(h); aPer = aPass - aPer0; say(`🔁 Аниматрица: проход ${aPass} повторяет проход ${aPer0} — цикл ${aPer} ${aPer === 1 ? "проход" : "прох."}`); } }
    else if (animSeen.size < 500000) animSeen.set(h, aPass);
    animHist.push({ p: aPass, rows: R.slice() });
    const lim = Math.max(8, Math.floor(2e7 / Math.max(1, k.length)));   // история ⏮ — не больше ~20 млн бит
    if (animHist.length > lim) animHist.splice(0, animHist.length - lim);
  };
  const animUi = () => {
    const N = Z.rows.length;
    // v0.329, «проход — это же цикл?»: нет — проход = волна сверху донизу; цикл = через сколько проходов картина повторилась
    $("animInfo").textContent = `проход ${aPass} · волна ${aRow}/${Math.max(0, N - 1)}` + (aPer ? ` · цикл ${aPer} прох. (с ${aPer0}-го)` : "");
    { const L = $("rowList"), F = $("field"); if (L && F) F.style.setProperty("--aiTop", (L.offsetTop + 3) + "px"); }   // v0.358: у первой строки — по верху поля строк
    const sp = animSpOf(Z.animSp ?? 40); $("animSpV").textContent = (sp < 10 ? sp.toFixed(1).replace(".", ",") : Math.round(sp)) + (Z.animByPass ? " прох/с" : " стр/с");   // v0.329: было «цикл/с» — считает проходы
  };
  const animDone = () => { animSig = animKey(); renderAll(); save(); animUi(); };
  const animGuard = () => { if (rowsLocked()) return false; if (Z.rows.length < 2) { say("🌊 Аниматрице нужно хотя бы две строки."); return false; } return true; };
  const animTick = (ts) => {
    if (!animRaf) return;
    const dt = animT0 ? Math.min(0.1, (ts - animT0) / 1000) : 0; animT0 = ts;
    animAcc += animSpOf(Z.animSp ?? 40) * dt;
    let n = Math.floor(animAcc); animAcc -= n;
    if (n) {
      animSync(); const t0 = performance.now();
      /* v0.199, «по циклу аниматрицы»: ⟳ циклами (с v0.329 — «⟳ проходами») — за шаг плеера весь проход волны (как «Плеер — целыми циклами» в Треугольнике);
         начат посреди прохода — сперва дойти до его конца. На экране — только картины на границе циклов. */
      if (Z.animByPass) while (n-- > 0) { const p = aPass; let g = Z.rows.length + 1; do animStep1(); while (aPass === p && --g > 0); if (performance.now() - t0 > 30) { animAcc = 0; break; } }
      else while (n-- > 0) { animStep1(); if ((n & 63) === 0 && performance.now() - t0 > 30) { animAcc = 0; break; } }   // не успевает — не копить долг
      animSig = animKey(); renderRows(); animUi();
    }
    animRaf = requestAnimationFrame(animTick);
  };
  const animSet = (on) => {
    if (on && !animRaf) { if (!animGuard()) return; undoPush(undoState()); animSync(); animT0 = 0; animAcc = 0; animRaf = requestAnimationFrame(animTick); }
    if (!on && animRaf) { cancelAnimationFrame(animRaf); animRaf = 0; animDone(); }
    $("bAnimPlay").classList.toggle("on", !!animRaf); $("bAnimPlay").textContent = animRaf ? "⏸ волна" : "▶ волна";
  };
  $("bAnimPlay").onclick = () => animSet(!animRaf);
  $("bAnimStep").onclick = () => { animSet(false); if (!animGuard()) return; undoPush(undoState()); animSync(); animStep1(); animDone(); };
  $("bAnimPass").onclick = () => { animSet(false); if (!animGuard()) return; undoPush(undoState()); animSync(); const p = aPass; let g = Z.rows.length + 1; do animStep1(); while (aPass === p && --g > 0); animDone(); };
  $("bAnimBack").onclick = () => {
    animSet(false); if (!animGuard()) return; animSync();
    let want = aRow > 0 ? aPass : aPass - 1;
    while (animHist.length && animHist[animHist.length - 1].p > want) animHist.pop();
    const e = animHist[animHist.length - 1];
    if (!e || e.p !== want) { say(want < 0 ? "⏮ Это начало — раньше прохода 0 некуда." : "⏮ Дальше назад истории нет."); animUi(); return; }
    undoPush(undoState());
    const R = Z.rows; R.length = 0; e.rows.forEach(s => R.push(s));
    aPass = e.p; aRow = 0; if (aPer && aPer0 + aPer > aPass) { aPer = 0; aPer0 = 0; }
    for (const [h, p] of animSeen) if (p > aPass) animSeen.delete(h);
    animDone(); say(`⏮ К началу прохода ${aPass}.`);
  };
  /* v0.331, «в группу Аниматрица — кнопку: возврат всех битов на какие были»: ⤺ возврат — поле снова такое, каким было до первой волны
     (проход 0), сколько бы проходов ни прошло; счёт проходов и цикла — с нуля. «До первой волны» — с последней правки строк не волной
     (руками, шаблоном, заготовкой, ↩): после неё волна начинает заново. ↩ вернёт то, что было перед возвратом. */
  $("bAnimHome").onclick = () => {
    animSet(false); if (!animGuard()) return; animSync();
    if (!animStart || (aPass === 0 && aRow === 0)) { say("⤺ Волна ещё не шла — биты и так те, что были."); animUi(); return; }
    undoPush(undoState());
    const R = Z.rows; R.length = 0; animStart.forEach(s => R.push(s));
    const k = animKey(); aRow = 0; aPass = 0; aPer = 0; aPer0 = 0; animSeen = new Map([[animHash(k), 0]]); animHist = [{ p: 0, rows: R.slice() }];
    animDone(); say("⤺ Все биты — какие были до волны (проход 0). ↩ вернёт.");
  };
  {   // v0.347: 🧱 стенка — выделение берётся в момент нажатия (щелчок по кнопке выделение не сбрасывает)
    const b = $("bWall"), ui = () => { const n = wallCount(); b.classList.toggle("on", n > 0); b.textContent = n ? "🧱 Бит " + n : "🧱 Бит"; };
    let got = null;
    b.addEventListener("mousedown", (e) => { got = textSelInRows(); e.preventDefault(); });
    b.onclick = () => {
      const parts = got || textSelInRows(); got = null;
      /* v0.363, по снимку «🧱 Бит 7» — «не снимает выделение, заморозку»: без выделения горящая кнопка размораживает все (↩ не нужен —
         заморозить заново: выдели и нажми) */
      if (!parts) { if (wallCount()) { const n = wallCount(); Z.walls = {}; save(); wallMark(); ui(); say(`🧱 Разморожено всё — ${n} бит. Заморозить: выдели биты мышью и нажми «🧱 Бит».`); }
        else say("🧱 Выдели биты мышью в строках — и нажми: они заморозятся (волна их не меняет)."); return; }
      const on = wallToggle(parts), n = parts.reduce((a, p) => a + p.b - p.a, 0);
      clearTextSel(); save(); wallMark(); ui();
      say(on ? `🧱 Бит: ${n} заморожено — волна их не меняет. Всего замороженных ${wallCount()}.` : `🧱 Разморожено ${n} бит. Осталось ${wallCount()}.`);
    };
    b.oncontextmenu = (e) => { e.preventDefault(); if (!wallCount()) return; Z.walls = {}; save(); wallMark(); ui(); say("🧱 Все биты разморожены."); };
    ui();
    // v0.353: 👁 вид — показывать замороженные (Столб и Бит) подсветкой в строках; по умолчанию вкл
    const v = $("bFzShow"), vUi = () => v.classList.toggle("on", Z.fzShow !== false);
    if (v) { vUi(); v.onclick = () => { Z.fzShow = Z.fzShow === false; vUi(); save(); wallMark(); say(Z.fzShow !== false ? "👁 Замороженные видны: ▮ Столб — голубым, 🧱 Бит — кирпичным." : "👁 Замороженные не подсвечены (заморозка при этом действует)."); }; }
  }
  $("animOp").value = Z.animOp || "xor";
  $("animOp").onchange = (e) => { Z.animOp = e.target.value; save(); };
  $("animByPass").checked = !!Z.animByPass;   // v0.199
  $("animByPass").onchange = (e) => { Z.animByPass = e.target.checked; animAcc = 0; save(); animUi(); };
  $("animSp").value = Z.animSp ?? 40;
  $("animSp").oninput = (e) => { Z.animSp = +e.target.value; animUi(); };
  $("animSp").onchange = () => save();
  /* v0.200, «заготовки, по умолчанию 256 строк: все серпинские правила и последовательности»: выбор в списке — поле строк
     заменяется целиком (↩ вернёт), счёт волны — заново. */
  $("animRowsN").value = Z.animRowsN || 256;
  $("animRowsN").onchange = (e) => { Z.animRowsN = Math.max(2, Math.min(1024, Math.round(+e.target.value) || 256)); e.target.value = Z.animRowsN; save(); };
  $("animSeed").value = Z.animSeed || "1";
  $("animSeed").onchange = (e) => { const v = e.target.value.replace(/[^01]/g, ""); Z.animSeed = v || "1"; e.target.value = Z.animSeed; save(); };
  $("animPreset").onchange = (e) => {
    const v = e.target.value, lab = e.target.selectedOptions[0] ? e.target.selectedOptions[0].textContent : v; e.target.value = "";
    if (!v) return;
    const H = Z.animRowsN || 256, seed = Z.animSeed || "1";
    animApply(v === "pascal" ? pascalRowsBar(seed, H) : v.startsWith("r") ? ecaRowsBar(+v.slice(1), seed, H) : zzSeqRows(v.slice(2), H), Z.barOn && v[0] !== "s" ? lab + " + столб " + barLab() : lab);   // v0.241: стенка
  };
  function animApply(rows, lab){   // v0.239: общее у списка заготовок и карты правил ▦
    animSet(false);
    try { snapshot(); } catch (err) { return; }
    Z.rows = rows; syncLane(); Z.cur = 0;
    animSig = null; animSync();
    renderAll(); save(); animUi();
    say(`🌊 Заготовка «${lab.trim()}»: ${rows.length} стр., последняя — ${rows[rows.length - 1].length} бит. ↩ вернёт.`);
  }
  /* v0.239, «как в Cellcosmos — карта всех 256 правил сеткой 16×16»: ▦ рядом со списком заготовок — все элементарные
     автоматы миниатюрами (32 строки из нынешнего сида), номер в углу. Наведение — правило и его средние метрики по
     миниатюре (энтропия, зеркальность, доля единиц); щелчок — правило строками в поле, как заготовка (строк — сколько
     в поле рядом, ↩ вернёт); выбранное обведено золотым, карта остаётся открытой — можно перебирать подряд.
     Закрыть — ▦ ещё раз, Esc или щелчок мимо. */
  const ecaMapClose = () => {
    const m = $("ecaMap"); if (m) m.remove();
    document.removeEventListener("pointerdown", ecaMapOut, true); document.removeEventListener("keydown", ecaMapKey, true);
  };
  const ecaMapOut = (e) => { const m = $("ecaMap"); if (m && !m.contains(e.target) && !$("bEcaMap").contains(e.target)) ecaMapClose(); };
  const ecaMapKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); ecaMapClose(); } };
  $("bEcaMap").onclick = () => {
    if ($("ecaMap")) { ecaMapClose(); return; }
    const seed = Z.animSeed || "1", T = 32;
    const rgb = (c, d) => { const m = /^#([0-9a-f]{6})$/i.exec(c) || /^#([0-9a-f]{6})$/i.exec(d); const v = parseInt(m[1], 16); return [v >> 16, (v >> 8) & 255, v & 255]; };
    const C1 = rgb(coneCss("--b1", "#e8ecf4"), "#e8ecf4"), C0 = rgb(coneCss("--b0", "#5d6678"), "#5d6678");
    const m = document.createElement("div"), box = document.createElement("div");
    m.id = "ecaMap"; box.className = "ecaGrid";
    for (let r = 0; r < 256; r++) {
      const rows = ecaRowsBar(r, seed, T), W = rows[T - 1].length, cv = document.createElement("canvas");   // v0.241: со стенкой, если она нажата
      cv.width = W; cv.height = T;
      const g = cv.getContext("2d"), im = g.createImageData(W, T);
      rows.forEach((s, y) => {
        const x0 = (W - s.length) >> 1;
        for (let x = 0; x < s.length; x++) { const k = (y * W + x0 + x) * 4, on = s[x] === "1", c = on ? C1 : C0; im.data[k] = c[0]; im.data[k + 1] = c[1]; im.data[k + 2] = c[2]; im.data[k + 3] = on ? 255 : 70; }
      });
      g.putImageData(im, 0, 0);
      const st = zzRowsStats(rows), cell = document.createElement("div"), nb = document.createElement("span");
      cell.className = "ecaC"; cell.dataset.r = r; nb.textContent = r;
      cell.title = `Правило ${r} — щелчок: строками в поле (${Z.animRowsN || 256} стр., сид ${seed}; ↩ вернёт)\n` +
        `энтропия ${st.h.toFixed(2)} · зеркальность ${Math.round(st.m * 100)}% · единиц ${Math.round(st.d * 100)}% (средние по миниатюре)`;
      cell.append(cv, nb); box.appendChild(cell);
    }
    box.onclick = (e) => {
      const c = e.target.closest(".ecaC"); if (!c) return;
      box.querySelectorAll(".ecaC.on").forEach(x => x.classList.remove("on")); c.classList.add("on");
      animApply(ecaRowsBar(+c.dataset.r, seed, Z.animRowsN || 256), `Правило ${c.dataset.r}` + (Z.barOn ? " + столб " + barLab() : ""));   // v0.241: стенка
    };
    m.appendChild(box); document.body.appendChild(m);
    const b = $("bEcaMap").getBoundingClientRect(), mw = m.offsetWidth, mh = m.offsetHeight;
    m.style.left = Math.max(8, Math.min(innerWidth - mw - 8, b.left)) + "px";
    m.style.top = Math.max(8, b.bottom + 4 + mh > innerHeight ? b.top - mh - 4 : b.bottom + 4) + "px";
    document.addEventListener("pointerdown", ecaMapOut, true); document.addEventListener("keydown", ecaMapKey, true);
  };
  animUi();
  /* v0.240, «звук из бит» (третья идея Cellcosmos): группа «Звук» — поле звучит. ♫ — пуск / стоп. Режимы:
     «строка» — текущая строка идёт тактом слева направо, шаг — бит: 1 — нота, 0 — пауза; высота — число из трёх бит с этого
     места (0…7) — ступень лада, так что одинаковые рисунки в строке и звучат одинаково; строка кончилась — сначала.
     «столбцы» — шаг — столбец поля: звучат строки, у которых в нём 1, высота — по номеру строки (сверху — выше, через три
     октавы по кругу), не больше 8 голосов разом (первые сверху). Лад, темп (шагов в секунду) и громкость — рядом, всё
     помнится. Строки меняются на ходу (волна, правка, другая текущая) — звучит уже новое. Звук идёт и в запись ⏺ конуса
     напрямую, без захвата экрана; с включённым «звуком ПК» — из захвата: он и так слышит всё, иначе было бы дважды. */
  const SND_SCALES = { penta: [0, 2, 4, 7, 9], minor: [0, 2, 3, 5, 7, 8, 10], major: [0, 2, 4, 5, 7, 9, 11], chrom: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] };
  let snd = null, sndT = 0, sndStep = 0;
  const sndSc = () => SND_SCALES[Z.sndScale] || SND_SCALES.penta;
  const sndHz = (deg) => { const sc = sndSc(), o = Math.floor(deg / sc.length); return 110 * Math.pow(2, (sc[deg % sc.length] + 12 * o) / 12); };
  const sndCtx = () => {
    if (!snd) {
      const ctx = new (window.AudioContext || window.webkitAudioContext)(), out = ctx.createGain(), rec = ctx.createMediaStreamDestination();
      out.connect(ctx.destination); out.connect(rec);
      snd = { ctx, out, rec };
    }
    if (snd.ctx.state === "suspended") snd.ctx.resume();
    snd.out.gain.value = (Z.sndVol ?? 50) / 100;
    return snd;
  };
  window.zzSndStream = () => sndCtx().rec.stream;   // v0.394: дорожка «♫ Звука» — для видеозаписи хаба (фон с того же адреса)
  /* v0.257, «Звук — добавь, чтобы несколько строк выделенных — разными звуками на строку, и режим чтения строк, и по 2 строки, и разные
     варианты с музыкой; если её вкл — то также на видео»: тембр (Z.sndWave) — «разные» (у каждого голоса свой: треугольник, квадрат, пила,
     синус, и октавой ниже / выше) или один на всех (треугольник, синус, квадрат, пила, колокол). Новые режимы чтения — ниже, в sndTick. */
  const SND_WAVES = ["triangle", "square", "sawtooth", "sine"];
  const sndVoice = (v) => { const w = Z.sndWave || "mix"; return w === "mix" ? { type: SND_WAVES[v % 4], oct: [0, 1, -1][Math.floor(v / 4) % 3] } : { type: w, oct: 0 }; };
  const sndNote = (hz, t, len, g, v = 0) => {
    const vc = sndVoice(v), f = hz * Math.pow(2, vc.oct), bell = vc.type === "bell";
    const o = snd.ctx.createOscillator(), a = snd.ctx.createGain();
    o.type = bell ? "sine" : vc.type; o.frequency.value = f;
    if (vc.type === "square" || vc.type === "sawtooth") g *= 0.45;   // жёсткие тембры тише — чтобы голоса были ровнее
    const L = bell ? Math.min(1.6, len * 3) : len;
    a.gain.setValueAtTime(0, t); a.gain.linearRampToValueAtTime(g, t + 0.005); a.gain.exponentialRampToValueAtTime(0.0001, t + L);
    o.connect(a); a.connect(snd.out); o.start(t); o.stop(t + L + 0.02);
    if (bell) { const o2 = snd.ctx.createOscillator(), a2 = snd.ctx.createGain(); o2.type = "sine"; o2.frequency.value = f * 2.76;   // колокол — второй, негармонический обертон
      a2.gain.setValueAtTime(0, t); a2.gain.linearRampToValueAtTime(g * 0.4, t + 0.003); a2.gain.exponentialRampToValueAtTime(0.0001, t + L * 0.5);
      o2.connect(a2); a2.connect(snd.out); o2.start(t); o2.stop(t + L * 0.5 + 0.02); }
  };
  const sndBitHz = (s, i) => s[i] === "1" ? sndHz(parseInt((s + s + s).substr(i, 3), 2) + sndSc().length) : 0;   // 1 — нота (высота — три бита с этого места), 0 — пауза
  /* v0.380, по снимку двух головок рядом — выбрано «оставить по кругу» и «строки, где все 1-цы, пропускать, кроме той, где длина 1»: в режимах
     из нескольких строк (разом, подряд, по 2, столбцы) строки из одних единиц длиннее одного бита не звучат — их пропускают; «1» звучит */
  const sndAll1 = (r) => { const s = Z.rows[r] || ""; return s.length > 1 && s.indexOf("0") < 0; };
  const sndList = (allIfNone) => rowSel.size ? [...rowSel].filter(i => i < Z.rows.length && !sndAll1(i)).sort((a, b) => a - b) : allIfNone ? Z.rows.map((_, i) => i).filter(i => !sndAll1(i)) : [Z.cur];
  /* v0.260, «покажи, какой бит сейчас играется в строках (кнопку, по умолчанию вкл)»: ◉ бит — в строках поля подсвечен бит, на котором
     сейчас каждая звучащая строка (Highlight API, строки не перерисовываются). Z.sndMark, по умолчанию вкл. */
  /* v0.376, по снимку «Звука» — «кнопку показать головки на битах строк и в конусе»: «◉ головки» (была «◉ бит») — звучащие биты видны и
     в строках (как было), и на конусе: в 2D — обводка сектора бита, в 3D — точка на бите (zzSndHeads — [строка, бит]) */
  let sndConeRaf = 0;
  const sndMarkCone = (P) => { const was = !!window.zzSndHeads; window.zzSndHeads = Z.sndMark === false || !P || !P.length ? null : P.slice();
    if ((was || window.zzSndHeads) && !sndConeRaf) sndConeRaf = requestAnimationFrame(() => { sndConeRaf = 0; renderCone(); }); };
  const sndMark = (P) => {
    sndMarkCone(P);   // v0.376
    if (!window.CSS || !CSS.highlights || typeof Highlight === "undefined") return;
    if (Z.sndMark === false || !P || !P.length) { for (let q = 0; q < 7; q++) CSS.highlights.delete(q ? "sndbit" + (q + 1) : "sndbit"); return; }
    const Lr = $("rowList"), G = [];   // v0.383: столбцовая головка (третий элемент 1) — золотом; v0.389 — у каждой из семи своя подсветка sndbit, sndbit2…sndbit7
    for (const [r, j, kd] of P) {
      const bx = Lr.querySelector('.rw[data-r="' + r + '"] .bx'); if (!bx) continue;
      const w = document.createTreeWalker(bx, NodeFilter.SHOW_TEXT); let k = 0, nd;
      while ((nd = w.nextNode())) { const n = nd.textContent.length; if (k + n <= j) { k += n; continue; } const rg = document.createRange(); rg.setStart(nd, j - k); rg.setEnd(nd, j - k + 1); (G[kd | 0] = G[kd | 0] || []).push(rg); break; }   // в .bx только 0 и 1
    }
    for (let q = 0; q < 7; q++) { const nm = q ? "sndbit" + (q + 1) : "sndbit"; if (G[q] && G[q].length) CSS.highlights.set(nm, new Highlight(...G[q])); else CSS.highlights.delete(nm); }
  };
  /* v0.388, по снимку подсветки бита — «как будто бы сдвиг есть звука с картинкой»: подсветка ставилась сразу, а звук доходит до колонок
     позже — на задержку вывода звуковой карты (ctx.baseLatency + ctx.outputLatency; на Windows десятки мс, в Bluetooth-наушниках 0,2–0,3 с,
     больше шага при 6 битах в секунду) и ещё на 10 мс, на которые нота ставится вперёд. Теперь подсветка (в строках и на конусе) ставится
     с той же задержкой — вместе со звуком. Пока идёт запись видео, задержки нет: в ролик звук пишется до колонок, без неё.
     sndGen — номер пуска: отложенная подсветка от остановленного звука уже не ставится */
  let sndGen = 0, sndLatSaid = false;
  const sndLat = () => {
    if (!snd || rec || rrec) return 0;
    const c = snd.ctx, L = (c.baseLatency || 0) + (c.outputLatency || 0) + 0.01;
    if (!sndLatSaid && c.outputLatency) { sndLatSaid = true; console.info(`♫ Задержка звука до колонок: ${Math.round(L * 1000)} мс — подсветка бита сдвинута на столько же`); }
    return L;
  };
  const sndTick = () => {
    const P = []; snd2Last = null; sndTick1(P); snd2Label();
    const L = sndLat(), g = sndGen;
    if (L > 0.015) setTimeout(() => { if (g === sndGen) sndMark(P); }, L * 1000); else sndMark(P);
  };
  // v0.318: ⁑ 2 бита — смещения читающих «головок» в строке длины n: [0] или [0, ↔] (по кругу; совпали — одна)
  /* v0.337, по снимку «⁑ 2 бита» — «пусть определяет количество бит и расстояние по строке, следующей после строки, где все 1-цы, и
     автоматом переключает при плее»: над читаемой строкой r (или она сама) ищется ближайшая строка из одних 1; следующая за ней строка —
     шаблон головок: сколько в ней 1 — столько бит звучит разом (до 8), где они стоят — на таком расстоянии от читаемого (у Серпинского
     под 1111 — 10001: два бита через 4). Строк из одних 1 выше нет — как прежде, два бита через ↔. Считается на каждом шаге — читаешь
     дальше вниз, прошёл следующую строку из 1 — шаблон сменился сам; что звучит сейчас — на кнопке. */
  let snd2Last = null, sndRC = null;   // v0.383: sndRC — разметка столбцов для «стр+стл»
  /* v0.387, «2 и более значков, каждый отдельно вкл/выкл»: у «стр+стл» головки включаются по отдельности — sndHR строчная, sndHC столбцовая.
     Их переключает фон хаба (сообщение { zerkSndHead: "r" | "c", on }); в самой странице обе всегда включены */
  /* v0.389: головок семь, по нотам — sndHeadsOn, набор включённых. До (r) — строки подряд и Ре (c) — столбцы сверху вниз, бас, как были;
     Ми — строки задом наперёд (с конца поля, справа налево), Фа — столбцы снизу вверх, Соль — диагональ ↘ (каждый шаг — следующая строка
     и следующий бит), Ля — диагональ ↙ (строки снизу вверх), Си — случайный бит поля. В фоне хаба у каждой головки своя тоника: мелодия
     сдвинута так, что звучит от своей ноты (база звукоряда — ля; До — на 3 полутона выше, Ре — на 5…), и несколько включённых звучат
     созвучием; в самой странице («стр+стл») сдвига нет. Цвет — sndHeadCol(kd) */
  const SND_HEADS = { r: { kd: 0, semi: 3 }, c: { kd: 1, semi: 5 }, mi: { kd: 2, semi: 7 }, fa: { kd: 3, semi: 8 }, sol: { kd: 4, semi: 10 },
    la: { kd: 5, semi: 0 }, si: { kd: 6, semi: 2 } };
  const sndSemi = (id) => ZZ_BG && SND_HEADS[id].semi ? Math.pow(2, SND_HEADS[id].semi / 12) : 1;
  let sndHeadsOn = new Set(["r", "c"]);
  const sndAuto = (r) => {
    if (!(r >= 0)) return null;
    for (let i = Math.min(r, Z.rows.length - 2); i >= 0; i--) {
      const s = Z.rows[i]; if (!s || s.indexOf("0") >= 0) continue;
      const t = Z.rows[i + 1], p = []; for (let j = 0; t && j < t.length && p.length < 8; j++) if (t[j] === "1") p.push(j);
      return p.length ? p.map(x => x - p[0]) : null;
    }
    return null;
  };
  const sndOffs = (n, r) => {
    if (!Z.snd2 || n < 2) return [0];
    const a = sndAuto(r);
    if (a) { const o = a.map(d => d % n).filter((d, i, A) => A.indexOf(d) === i); if (!snd2Last) snd2Last = a; return o; }
    const d = (Math.round(Z.snd2d || 4) % n + n) % n; if (!snd2Last) snd2Last = d ? [0, d] : [0]; return d ? [0, d] : [0];
  };
  const snd2Label = () => {   // v0.337: что звучит сейчас — на кнопке: «⁑ 2×8» (два бита через 8), «⁑ 3: 0,2,6» (неровно)
    const b = $("bSnd2"); if (!b) return;
    let t = "⁑ авто";
    if (Z.snd2 && (sndT || sndPaused) && snd2Last) { const a = snd2Last, k = a.length, d = k > 1 ? a[1] - a[0] : 0, even = a.every((x, i) => x === i * d);
      t = k < 2 ? "⁑ 1" : even ? `⁑ ${k}×${d}` : `⁑ ${k}: ${a.join(",")}`; }
    if (b.textContent !== t) b.textContent = t;
  };
  const sndTick1 = (P) => {
    const sp = Z.sndSp || 6, len = Math.min(0.6, 1.6 / sp), t = snd.ctx.currentTime + 0.01, sc = sndSc(), m = Z.sndMode || "row";
    if (m === "row") {
      const s = cur(); if (!s) return;
      const i = sndStep % s.length; sndStep = i + 1;
      const on = []; sndOffs(s.length, Z.cur).forEach((o, h) => { const j = (i + o) % s.length; P.push([Z.cur, j]); const hz = sndBitHz(s, j); if (hz) on.push([hz, h]); });
      on.forEach(([hz, v]) => sndNote(hz, t, len, 0.35 / Math.sqrt(on.length), v));   // v0.318: при ⁑ — два голоса
    } else if (m === "sel") {   // v0.257: выделенные строки (нет выделения — текущая) звучат разом, каждая своим голосом и в своём такте
      const L = sndList(false).slice(0, 8), k = sndStep++;
      const on = []; L.forEach((r, v) => { const s = Z.rows[r]; if (s) sndOffs(s.length, r).forEach((o) => { const j = (k + o) % s.length; P.push([r, j]); const hz = sndBitHz(s, j); if (hz) on.push([hz, v]); }); });
      on.forEach(([hz, v]) => sndNote(hz, t, len, 0.32 / Math.sqrt(on.length), v));
    } else if (m === "rc") {
      /* v0.383, «а что если добавить головку, идущую по столбцам» → «да» (и в Зазеркалиусе, и в фоне хаба, скорость одна): стр+стл — две
         головки разом. Строчная — как «подряд»: строки одна за другой слева направо (бирюза, ⁑ авто — к ней). Столбцовая — по столбцам: столбец
         сверху вниз (только строки, где он есть), потом следующий (золото, звучит октавой ниже — бас). Обе — на одном счёте шагов */
      const L = sndList(true); if (!L.length) return;
      const lens = L.map(r => (Z.rows[r] || "").length), tot = lens.reduce((a, b) => a + b, 0); if (!tot) return;
      const k = sndStep % tot; sndStep = k + 1, H = sndHeadsOn, n = L.length;
      const rpos = (x) => { let g = 0; while (x >= lens[g]) { x -= lens[g]; g++; } return [g, x]; };   // v0.389: место x-го бита при чтении строк подряд
      const [gi, kk] = rpos(k);
      const on = [], r1 = L[gi], s1 = Z.rows[r1];
      if (H.has("r")) sndOffs(s1.length, r1).forEach((o) => { const j = (kk + o) % s1.length; P.push([r1, j]); const hz = sndBitHz(s1, j); if (hz) on.push([hz * sndSemi("r"), gi % 4]); });
      if (kk === 0 && H.has("r")) sndShow([r1]);
      const key = L.length + ":" + tot + ":" + L[0] + ":" + L[L.length - 1];
      if (!sndRC || sndRC.key !== key) {   // сколько строк доходит до каждого столбца — один раз на поле
        const W = Math.max(...lens), cnt = new Array(W).fill(0); lens.forEach(x => { for (let c = 0; c < x; c++) cnt[c]++; });
        const cum = []; let a = 0; for (let c = 0; c < W; c++) { cum.push(a); a += cnt[c]; }
        sndRC = { key, cum, cnt };
      }
      // v0.389: место x-го бита при обходе по столбцам — [строка, столбец]; up(столбец) — этот столбец снизу вверх
      const cpos = (x, up) => {
        let lo = 0, hi = sndRC.cum.length - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (sndRC.cum[mid] <= x) lo = mid; else hi = mid - 1; }
        let rem = x - sndRC.cum[lo]; if (up && up(lo)) rem = sndRC.cnt[lo] - 1 - rem;
        for (let q = 0; q < n; q++) if (lens[q] > lo && rem-- === 0) return [L[q], lo];
        return null;
      };
      const bit = (p, id, f, v) => {   // головка id звучит на бите p = [строка, бит]; f — октава, v — голос
        if (!p) return; const s = Z.rows[p[0]]; if (!s || !(p[1] < s.length)) return;
        P.push([p[0], p[1], SND_HEADS[id].kd]);
        const hz = sndBitHz(s, p[1]); if (hz) on.push([hz * f * sndSemi(id), v]);
      };
      if (H.has("c")) bit(cpos(k), "c", 0.5, 8);
      const at = (g, x) => [L[g], x];
      if (H.has("mi")) bit(at(...rpos(tot - 1 - k)), "mi", 1, 3);
      if (H.has("fa")) bit(cpos(k, () => true), "fa", 1, 0);
      if (H.has("sol") && lens[k % n]) bit([L[k % n], k % lens[k % n]], "sol", 1, 3);
      if (H.has("la") && lens[n - 1 - k % n]) bit([L[n - 1 - k % n], k % lens[n - 1 - k % n]], "la", 1, 0);
      if (H.has("si")) bit(at(...rpos((Math.imul(k + 1, 2654435761) >>> 0) % tot)), "si", 1, 3);
      on.forEach(([hz, v]) => sndNote(hz, t, len, 0.32 / Math.sqrt(on.length), v));
    } else if (m === "seq" || m === "pair") {   // v0.257: чтение — строки одна за другой (по 2 — парами разом), выделенные или всё поле
      const L = sndList(true), G = m === "pair" ? 2 : 1, groups = [];
      for (let j = 0; j < L.length; j += G) groups.push(L.slice(j, j + G));
      const lens = groups.map(g => Math.max(...g.map(r => (Z.rows[r] || "").length), 1)), tot = lens.reduce((a, b) => a + b, 0); if (!tot) return;
      let k = sndStep % tot; sndStep = k + 1; let gi = 0; while (k >= lens[gi]) { k -= lens[gi]; gi++; }
      const on = []; groups[gi].forEach((r, v) => { const s = Z.rows[r]; if (s && k < s.length) sndOffs(s.length, r).forEach((o) => { const j = (k + o) % s.length; P.push([r, j]); const hz = sndBitHz(s, j); if (hz) on.push([hz, L.indexOf(r) % 12]); }); });
      on.forEach(([hz, v]) => sndNote(hz, t, len, 0.33 / Math.sqrt(on.length), v));
      if (k === 0) sndShow(groups[gi]);   // строка (пара) началась — сказать, какая
    } else {
      const W = Z.rows.reduce((a, r) => Math.max(a, r.length), 0); if (!W) return;
      const k = sndStep % W; sndStep = k + 1;
      const on = [];
      for (const o of sndOffs(W)) { const kk = (k + o) % W; let c = 0;   // v0.318: при ⁑ — два столбца разом, в каждом до 8 строк
        for (let r = 0; r < Z.rows.length && c < 8; r++) if (Z.rows[r][kk] === "1" && !sndAll1(r)) {   // v0.380: строки из одних 1 — мимо
         c++; P.push([r, kk]); if (!on.includes(r)) on.push(r); } }
      const n = sc.length * 3;
      on.forEach(r => sndNote(sndHz(n - 1 - (r % n)), t, len, 0.3 / Math.sqrt(on.length), r));   // v0.257: и тембр — по строке
    }
  };
  // v0.257: в чтении по очереди / парами — какие строки звучат, видно сообщением (строки поля не трогаем — выделение остаётся твоим)
  const sndShow = (g) => { if (!document.body.classList.contains("zen")) say(`♫ Звучит ${g.length > 1 ? "пара строк" : "строка"} ${g.map(r => r + 1).join(" + ")}`); };
  /* v0.374, по снимку «◀ ⏯ дальше ■ ▶» — «по умолчанию выделить стрелку, и запоминать последнюю выделенную — при плее задаёт направление»:
     Z.sndDir — 1 (▶, по умолчанию) или −1 (◀), горит своя стрелка. Звучит — стрелка меняет направление, звук идёт дальше; не звучит — шаг,
     как прежде, и тоже задаёт направление. Назад — sndStep идёт вниз по кругу периода (sndPer) */
  const sndLoop = () => { if (!sndT) return;
    if (Z.sndDir < 0) { const per = sndPer(); if (per) sndStep = ((sndStep - 2) % per + per) % per; }
    sndTick(); sndT = setTimeout(sndLoop, 1000 / (Z.sndSp || 6)); };
  /* v0.345, по снимку «♫ звук» — «пауза и шаг вперёд-назад, стрелки справа-слева»: ◀ ♫ звук ▶ и ⏸. Пауза держит место (sndStep)
     и подсветку бита, ⏯ — дальше с того же места; ◀ ▶ — один шаг назад / вперёд (звучит он один), звук при этом встаёт на паузу.
     Период шага — по режиму: длина текущей строки, самой длинной из звучащих, всех строк подряд или ширина поля */
  let sndPaused = false;
  /* v0.371, по снимку «■ звук | ⏯ дальше» — «пауза и звук — 1 размер, и рядом 0,5 — стоп; когда не включён, стоп неактивен»: одна кнопка
     в 1 ширину — ♫ звук (пуск) → ⏸ пауза (звучит) → ⏯ дальше (на паузе); рядом ■ в полкнопки — стоп совсем (следующий пуск — с начала),
     неактивна, пока звук не идёт и не на паузе */
  const sndUi = () => {
    const on = !!sndT || sndPaused, b = $("bSnd"); b.classList.toggle("on", on); b.classList.toggle("run", !!sndT);   // v0.351: звучит — рамка мигает (на паузе — нет)
    b.textContent = sndT ? "⏸" : sndPaused ? "⏯" : "♫";   // v0.423, «звук — уменьши длину, оставь там только символ, без текста» (слова — в подсказке)
    b.title = sndT ? "⏸ Пауза: звук встаёт, место и подсветка бита остаются (■ рядом — стоп совсем)" : sndPaused ? "⏯ Дальше с того же места (■ рядом — стоп совсем)" : "♫ Звук: поле звучит; ещё щелчок — ⏸ пауза (место и головки остаются), ещё — ⏯ дальше; ■ рядом — стоп и в начало. Строки меняются на ходу — звучит уже новое. Идёт и в запись ⏺ / mp4 конуса";
    { const bb = $("bSndB"), bf = $("bSndF"), back = Z.sndDir < 0; if (bb) { bb.classList.toggle("on", back); bb.title = "◀ Назад: звучит — играть в обратную сторону; не звучит — шаг назад (звук на паузе). Горит — направление"; } if (bf) { bf.classList.toggle("on", !back); bf.title = "▶ Вперёд: звучит — играть вперёд; не звучит — шаг вперёд (звук на паузе). Горит — направление"; } }   // v0.374
    /* v0.425, «стоп — выполняет стоп и паузу; при стопе стрелки — шаг, при паузе — плей; пауза — нажать — стоп, ничего не меняется; плей не
       нужен», «как запустить из стопа — поставить паузу»: ◆ показывает состояние (■ стоп, ⏸ пауза — горит, ♫ играет — мигает); стрелка
       направления шире (jwide), ◆ сдвигается к другой */
    /* v0.430, «начало: тишина, стрелка вправо горит одна, в середине значок плей (ноту убери); нажать плей — стрелка и плей объединятся
       цветом и станут !) — вертикальная палка и стрелка, типа пауза со стрелкой; нажать на них — пауза»: стоп — в ◆ ⏵ (не ▶ — по ▶ joinTag
       узнаёт стрелку), щелчок — играть в сторону горящей стрелки; играет — в ◆ ❙, ◆ и стрелка направления одного цвета и мигают вместе
      (◆ ❙ + стрелка = «пауза со стрелкой»), щелчок по любой из них — пауза; пауза — ⏸, горит (щелчок — стоп, стрелка — играть). Двойную
       «))» v0.430 было снял — v0.431 вернул: последняя нажатая стрелка двойная и горит */
    const p = $("bSndP"); if (p) { p.disabled = false; p.classList.toggle("on", sndPaused || !!sndT); p.classList.toggle("run", !!sndT);
      p.textContent = sndT ? "❙" : sndPaused ? "⏸" : "⏵";
      p.title = sndT ? "❙ Играет — щелчок (или по горящей стрелке): пауза, место остаётся" : sndPaused ? "⏸ Пауза — стрелка: играть в её сторону; щелчок: стоп (место то же)" : "⏵ Играть — в сторону горящей стрелки. Стрелки на стопе — шаг"; }
    { const bb = $("bSndB"), bf = $("bSndF"), back = Z.sndDir < 0, wide = (x, w) => { if (x && x.classList.contains("jwide") !== w) { x.classList.toggle("jwide", w); x._jw = 1; } };
      wide(bb, back); wide(bf, !back);   // v0.431, «последняя нажатая кнопка двойная — цвет забирает»: стрелка направления (она и есть последняя нажатая) — снова двойная «))» и горит
      // v0.427, «стрелка мигать должна фоном»: пока звук играет, фоном мигает стрелка направления; с v0.430 — вместе с ◆
      if (bb) bb.classList.toggle("run", !!sndT && back); if (bf) bf.classList.toggle("run", !!sndT && !back);
      // v0.430, «при плее другая стрелка становится красной — это стоп»
      if (bb) bb.classList.toggle("jstop", !!sndT && !back); if (bf) bf.classList.toggle("jstop", !!sndT && back);
      if (bb) bb.title = sndT ? (back ? "◀ Играет назад — щелчок: пауза" : "◀ Красная — стоп (место то же), направление — назад") : "◀ Назад: стоп — шаг назад; пауза — играть назад";   // v0.430
      if (bf) bf.title = sndT ? (!back ? "▶ Играет вперёд — щелчок: пауза" : "▶ Красная — стоп (место то же), направление — вперёд") : "▶ Вперёд: стоп — шаг вперёд; пауза — играть вперёд";
      if ((bb && bb._jw) || (bf && bf._jw)) { if (bb) bb._jw = 0; if (bf) bf._jw = 0; if (typeof joinTag === "function") joinTag(); } }
    snd2Label();   // v0.337: остановлен — «⁑ авто»
  };
  const sndSet = (on) => {
    sndPaused = false;
    /* v0.388: «else» ветки стоп с v0.374 стоял ВНУТРИ комментария — ■ и выключение обеих нот в хабе звук не останавливали */
    if (on) { sndCtx(); sndStep = Z.sndDir < 0 ? 1 : 0; sndT = setTimeout(sndLoop, 0); } else { clearTimeout(sndT); sndT = 0; sndGen++; sndMark(null); }   // v0.374: назад — с последнего шага
    sndUi();
  };
  const sndPer = () => {
    const m = Z.sndMode || "row", len = (r) => (Z.rows[r] || "").length;
    if (m === "row") return (cur() || "").length;
    if (m === "sel") return Math.max(0, ...sndList(false).slice(0, 8).map(len));
    if (m === "rc") return sndList(true).reduce((a, r) => a + (Z.rows[r] || "").length, 0);   // v0.383
    if (m === "seq" || m === "pair") { const L = sndList(true), G = m === "pair" ? 2 : 1; let t = 0; for (let j = 0; j < L.length; j += G) t += Math.max(1, ...L.slice(j, j + G).map(len)); return t; }
    return Z.rows.reduce((a, r) => Math.max(a, r.length), 0);
  };
  const sndPause = (p) => {
    if (p) { if (!sndT) return; clearTimeout(sndT); sndT = 0; sndPaused = true; }
    else { sndPaused = false; sndCtx(); sndT = setTimeout(sndLoop, 0); }
    sndUi();
  };
  const sndStepBy = (d) => {   // d = 1 — следующий шаг, -1 — предыдущий (sndStep — номер следующего)
    const per = sndPer(); if (!per) return;
    if (sndT) { clearTimeout(sndT); sndT = 0; }
    sndPaused = true; sndCtx();
    if (d < 0) sndStep = ((sndStep - 2) % per + per) % per; else sndStep = (sndStep % per + per) % per;
    sndTick(); sndUi();
  };
  $("bSnd").onclick = () => { if (sndT) sndPause(true); else if (sndPaused) sndPause(false); else sndSet(true); };   // v0.371: пуск / пауза / дальше
  /* v0.381: фон хаба — звук по кнопке «♫ Звук» хаба (сообщение { zerkSnd: true | false }): строки подряд, головки видны на конусе и в обеих
     пирамидах; хабу — ответ { zerkSndOn }, чтобы кнопка горела */
  if (ZZ_BG) addEventListener("message", (e) => {
    const d = e.data; if (!d || typeof d !== "object" || (d.zerkSnd === undefined && d.zerkSndHead === undefined && !d.zerkSndToggle && !d.zerkSndReset)) return;
    Z.sndMode = "rc"; Z.sndMark = true; rowSel.clear();   // v0.383: в фоне — две головки, строки и столбцы
    const RC = () => new Set(["r", "c"]);
    /* v0.392, «нужна и пауза при клике на странице, и плей — после паузы с того же момента, а сброс как-то иначе»: щелчок по пустому месту
       хаба (zerkSndToggle) — пауза: звук встаёт на месте (sndPause), конус перестаёт крутиться; ещё щелчок — дальше с того же шага, те же ноты,
       конус крутится дальше. Сброс — правый щелчок (zerkSndReset): все семь нот, звук с начала, конус — в начальное положение и крутится */
    const coneGo = (on) => { if ($("bConeAuto").classList.contains("on") !== on) $("bConeAuto").click(); };
    if (d.zerkSndReset) {
      clearTimeout(sndT); sndT = 0; sndPaused = false; sndGen++;
      sndHeadsOn = new Set(Object.keys(SND_HEADS)); sndSet(true);
      Z.coneSpin = 0; Z.coneSpinPh = 0; coneGo(true); renderCone();
    } else if (d.zerkSndToggle) {
      if (sndT) { sndPause(true); coneGo(false); }
      else if (sndPaused) { sndPause(false); coneGo(true); }
      else { sndHeadsOn = RC(); sndSet(true); coneGo(true); }
    } else if (d.zerkSndHead) {   // v0.387: одна головка — вкл / выкл; звук молчал — включается только она; все выключены — звук встаёт (v0.389 — любая из семи)
      const h = SND_HEADS[d.zerkSndHead] ? d.zerkSndHead : "r", on = !!d.on;
      if (sndPaused) {   // v0.392: на паузе — включил ноту: она добавляется, и всё идёт дальше с того же места; выключил последнюю — стоп
        if (on) { sndHeadsOn.add(h); sndPause(false); coneGo(true); } else { sndHeadsOn.delete(h); if (!sndHeadsOn.size) { sndSet(false); sndHeadsOn = RC(); } }
      } else if (!sndT) { if (!on) return; sndHeadsOn = new Set([h]); sndSet(true); }
      else { if (on) sndHeadsOn.add(h); else sndHeadsOn.delete(h); if (!sndHeadsOn.size) { sndSet(false); sndHeadsOn = RC(); } }
    } else if (d.zerkSnd) { if (!sndT && !sndPaused) { sndHeadsOn = RC(); sndSet(true); } } else { sndSet(false); sndHeadsOn = RC(); }
    const live = !!sndT || sndPaused;
    try { if (e.source) e.source.postMessage({ zerkSndOn: live, zerkSndPaused: sndPaused, zerkSndHeads: live ? [...sndHeadsOn] : [], zerkSndR: live && sndHeadsOn.has("r"), zerkSndC: live && sndHeadsOn.has("c") }, "*"); } catch (err) { /* хаб с другого адреса */ }
  });
  // v0.425: ◆ — играет → пауза; пауза → стоп (место то же); стоп → пауза (дальше стрелка — играть)
  // v0.430: стоп → ⏵ играть сразу (с того же места, в сторону горящей стрелки); прежде стоп → пауза, а играть — стрелкой
  if ($("bSndP")) $("bSndP").onclick = () => {
    if (sndT) sndPause(true);
    else if (sndPaused) { sndPaused = false; sndUi(); }
    else sndPause(false);
  };
  // v0.425: стрелка — направление; стоп — шаг (стоп остаётся), пауза — играть, играет — играть в её сторону
  const sndStepStop = (d) => {
    const per = sndPer(); if (!per) return;
    sndCtx();
    if (d < 0) sndStep = ((sndStep - 2) % per + per) % per; else sndStep = (sndStep % per + per) % per;
    sndTick(); sndUi();
  };
  const sndDirSet = (d) => {
    const was = Z.sndDir < 0 ? -1 : 1;
    if (sndT && was === d) { sndPause(true); return; }   // v0.430: играет — щелчок по горящей стрелке («!)» вместе с ◆) — пауза
    // v0.430, «при плее другая стрелка становится красной — это стоп» (место то же); v0.431: нажатая красная — последняя нажатая, направление
    // переходит на неё (станет двойной и горит), следующий ⏵ — в её сторону
    if (sndT) { clearTimeout(sndT); sndT = 0; sndPaused = false; Z.sndDir = d; save(); sndUi(); return; }
    Z.sndDir = d; save();
    if (sndT) { sndUi(); if (was !== d) say(d < 0 ? "◀ Звук — назад." : "▶ Звук — вперёд."); }
    else if (sndPaused) sndPause(false);
    else sndStepStop(d);
  };
  if ($("bSndB")) $("bSndB").onclick = () => sndDirSet(-1);
  if ($("bSndF")) $("bSndF").onclick = () => sndDirSet(1);
  sndUi();
  $("sndMode").value = Z.sndMode || "row";
  $("sndMode").onchange = (e) => { Z.sndMode = e.target.value; sndStep = 0; save(); };
  const sndMarkUi = () => $("bSndMark").classList.toggle("on", Z.sndMark !== false);   // v0.260
  sndMarkUi();
  /* v0.391, «кнопку записи звука»: ⏺ в группе «Звук» пишет дорожку «♫ Звука» (snd.rec — та же, что идёт в видео) в файл: .webm (opus), где
     webm не пишется — .m4a. Щелчок — старт (звук молчал — включается), ещё щелчок — стоп и файл в «Загрузки». Звук остановили посреди
     записи — в файле дальше тишина, запись идёт, пока не нажмёшь ⏺ ещё раз. Время записи — в подсказке кнопки */
  let srec = null, srecT = 0;
  $("bSndRec").onclick = async () => {
    const b = $("bSndRec");
    if (srec) { srec.stop(); return; }
    if (typeof MediaRecorder === "undefined" || !(window.AudioContext || window.webkitAudioContext)) { say("⏺ Этот браузер не умеет записывать звук."); return; }
    sndCtx(); if (!sndT) { if (sndPaused) sndPause(false); else sndSet(true); }
    const at = snd.rec.stream.getAudioTracks()[0]; if (!at) { say("⏺ Нет дорожки звука — запись не начата."); return; }
    const tr = at.clone(), stream = new MediaStream([tr]), chunks = [];
    const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4;codecs=mp4a.40.2", "audio/mp4"].find(m => MediaRecorder.isTypeSupported(m)) || "", m4a = mime.startsWith("audio/mp4");
    const r = srec = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 192000 } : undefined), t0 = Date.now();
    r.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    r.onstop = async () => {
      clearInterval(srecT); tr.stop(); srec = null; b.classList.remove("on"); b.textContent = "⏺";
      b.title = "⏺ Запись звука: пишет то, что играет ⏵, в файл .webm (только звук, без видео). Звук молчал — включится сам. Ещё щелчок — стоп, файл скачивается";
      let blob = new Blob(chunks, { type: m4a ? "audio/mp4" : "audio/webm" });
      const R = window.__zerkRecorder;   // как у видео: у webm из MediaRecorder в заголовке нет длительности — дописывает общий recorder.js
      if (!m4a && R && R.fixWebm) { try { blob = await R.fixWebm(blob, Date.now() - t0); } catch (err) { /* файл как есть */ } }
      const a = document.createElement("a"), d = new Date(), p2 = (x) => String(x).padStart(2, "0");
      a.href = URL.createObjectURL(blob); a.download = `Zerkalius-zvuk-${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}-${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}.${m4a ? "m4a" : "webm"}`;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      say(`⏺ Звук сохранён: ${a.download} (${(blob.size / 1048576).toFixed(1)} МБ).`);
    };
    r.start(1000); b.classList.add("on"); b.textContent = "⏹";
    const tick = () => { const s = Math.floor((Date.now() - t0) / 1000); b.title = `⏹ Идёт запись звука ${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")} — щелчок: стоп и файл`; };
    tick(); srecT = setInterval(tick, 1000);
    say("⏺ Запись звука пошла. Ещё щелчок по ⏹ — стоп, файл скачается.");
  };
  $("bSndMark").onclick = () => { Z.sndMark = Z.sndMark === false; sndMarkUi(); save(); if (Z.sndMark === false) sndMark(null);   // v0.376: и на конусе

    say(Z.sndMark !== false ? "◉ Показать — вкл: звучащие биты (головки) подсвечены в строках и на конусе." : "◉ Показать — выкл: звучащие биты не подсвечиваются."); };
  const snd2Ui = () => { $("bSnd2").classList.toggle("on", !!Z.snd2); $("snd2d").disabled = !Z.snd2; snd2Label(); };   // v0.318: ⁑ 2 бита и ↔; v0.337 — авто
  snd2Ui();
  $("bSnd2").onclick = () => { Z.snd2 = !Z.snd2; snd2Ui(); save(); say(Z.snd2 ? `⁑ Авто: сколько бит звучит разом и на каком расстоянии — по строке под ближайшей строкой из одних 1 выше читаемой; такой нет — два бита через ↔ ${Z.snd2d || 4}.` : "⁑ Звучит один бит."); };
  $("snd2d").value = Z.snd2d || 4;
  $("snd2d").oninput = (e) => { const v = Math.round(+e.target.value); if (v >= 1) Z.snd2d = v; };
  $("snd2d").onchange = (e) => { e.target.value = Z.snd2d || 4; save(); };
  $("sndWave").value = Z.sndWave || "mix";   // v0.257: тембр
  $("sndWave").onchange = (e) => { Z.sndWave = e.target.value; save(); };
  $("sndScale").value = Z.sndScale || "penta";
  $("sndScale").onchange = (e) => { Z.sndScale = e.target.value; save(); };
  $("sndSp").value = Z.sndSp || 6;
  $("sndSp").oninput = (e) => { Z.sndSp = +e.target.value; };
  $("sndSp").onchange = () => save();
  $("sndVol").value = Z.sndVol ?? 50;
  $("sndVol").oninput = (e) => { Z.sndVol = +e.target.value; if (snd) snd.out.gain.value = Z.sndVol / 100; };
  $("sndVol").onchange = () => save();
  /* v0.441, «конус — сделай музыкальный инструмент автомузыкальный: лазер — это головка, ходит по кругу, музыкальный режим лазера; на битах
     ноты, биты сам делает: в 0 стреляет — 0 переворачивается в ноту, след. раз попадает в неё — там уже 1 — нота; нота — в зависимости от
     строки»: «🎵 музыка» в «Лазере». Головка — луч из центра — ходит по кругу по часовой, за шаг на 1/T круга (T — бит в самой длинной
     строке; головка — посреди ячейки самого длинного кольца), темп — ♩ «Звука». На каждом шаге луч идёт наружу кольцо за кольцом и в каждом
     смотрит бит строки под собой: «1» — звучит нота этой строки, луч идёт дальше; «0» — становится «1» (нота записана, золотом), луч
     здесь стоит. Правило (Z.coneMusRule): «счёт» (по умолчанию) — прозвучавшая «1» снова «0», каждый луч — двоичный счётчик (строка 1 —
     младший бит): строка 1 звучит через шаг, строка 2 реже… ритм складывается сам, как в драм-машине; «копит» — «1» остаётся, рисунок
     только растёт. Высота — по строке: строка 1 — ниже всех, дальше вверх по ладу «Звука» (три октавы по кругу), тембр «🎨 разные» — у
     каждой строки свой, голосов разом не больше 8 (поровну из звучащих), громкость — «Звука». Биты пишутся прямо в строки поля (и в конус);
     при пуске — точка отмены, ↩ вернёт строки как были. «∅» — все строки в нули той же длины: лазер наберёт ноты с нуля. Луч-часы и
     солнце при пуске выключаются — у них ячейки колец пустые, а музыке нужны биты. Головка — Z.coneMusK (номер шага), помнится. */
  let musT = 0, musSaved = 0;
  const musWrite = () => Z.coneMusIn !== "read";
  const musUi = () => { const b = $("bConeMus"); if (b) b.classList.toggle("on", !!musT); const r = $("coneMusIn"); if (r) r.value = musWrite() ? "write" : "read"; };
  /* v0.442, «7 лазеров пусть — у каждого своя нота, по углу 360 на 7; и если на последней строке 0, то продолжаем — пишем в неё биты 1-0-1-0»:
     головок столько, сколько в поле «×» рядом с 🎵 (Z.coneMusN, 1…12, по умолчанию 7), через 360° / число. У каждой своя нота — ступень
     лада «Звука» от До (в мажоре — До Ре Ми Фа Соль Ля Си), свой тембр («🎨 разные») и свой цвет луча; строка задаёт октаву: внутренняя
     треть колец — низ, средняя — середина, внешняя — верх. Прошедшая все строки головка — в кольцо для заполнения: там ячейка всегда
     перещёлкивается 1 → 0 → 1 → 0 — пустая или «0» становится «1», «1» звучит и становится «0». Одинаковые ноты за шаг звучат один раз,
     голосов разом — не больше 12. */
  /* v0.443, «пусть лазер, попадая на строку, занимает её, пока всю по кругу не пройдёт; остальные проходят мимо неё; как проиграл — к
     следующей идёт; встаёт на строку только в щель и двигает её; при выходе идёт дальше; если 1-ца — отражается и идёт в другую сторону,
     сквозь центр даже; 1 при этом становится 0». Головки больше не бегут по кругу — стоят каждая на своём угле и двигают кольца.
     Головка идёт из центра наружу, кольцо за кольцом. Кольцо занято другой головкой — проходит мимо. Под головкой «0» — щель: головка
     встаёт на кольцо, занимает его («пишет» — щель становится «1», нота записана; «читает» — остаётся «0») и двигает — за шаг на бит,
     бит под ней звучит её нотой, если «1». Прошла весь круг (шагов — сколько бит в строке, кольцо вернулось на место) — выходит и идёт
     к следующему. Под головкой «1» — стена: «1» становится «0», головка отражается и идёт обратно сквозь центр — на противоположную
     сторону (угол + 180°) и оттуда снова наружу. Прошла все строки — строка для заполнения (1-0-1-0, как в v0.442) и снова из центра,
     тем же углом. Кольцо двигается «на вид» (coneRot — как запертое кольцо мышью): строка не сдвигается, биты те же. За шаг у головки
     в пути не больше 4 событий (стен подряд). Правило «счёт / копит» v0.441 ушло вместе с бегом по кругу — вместо него «пишет / читает».
     Головки — musL [{ a — угол°, r — кольцо (в пути — с какого идти), on — занимает, c — шагов по кругу }]; с пуском — все в центре. */
  const MUS_COL = ["#ff5f6d", "#ff9f43", "#ffe066", "#7ee787", "#4dd4ff", "#6b8cff", "#c38cf5"];
  const musN = () => Math.max(1, Math.min(12, Math.round(+Z.coneMusN) || 7));
  let musL = [];
  /* v0.444, на «щель — сейчас «0», другой вариант — граница между битами, как у луч-часов» — «делай»: щель выбирается (Z.coneMusSlit):
     «0» — как было; «граница» — головка встаёт на кольцо только там, где под ней граница бит (в пределах половины ползунка «щель», как
     луч-часы) и крутит его, стоя на этой границе, — звучит бит по часовой от неё. Не на границе — упирается в бит: «1» — стена (гаснет,
     головка отражается сквозь центр), «0» — стоит перед ним («пишет» — «0» становится «1», нота записана; на следующем шаге это уже стена).
     Головки при «границе» — ровно на углах 360° / число, без сдвига на полбита: головка на 0° видит границы всех колец, пока они не
     повёрнуты. Кольца, которых головка не занимает, стоят — чтобы щели сходились с головками, нужно «▶ крутить» (по биту / навстречу). */
  const musEdge = () => Z.coneMusSlit === "edge";
  const musInit = () => { const H = musN(), T = coneMaxLen(), o = musEdge() ? 0 : 180 / T; musL = Array.from({ length: H }, (_, h) => ({ a: h * 360 / H + o, r: 0, on: false, c: 0 })); };
  const musCell = (n, rot, a) => ((Math.floor(a / 360 * n + rot + 1e-9) % n) + n) % n;
  const musGap = (n, rot, a) => { const x = a / 360 * n + rot, k = Math.round(x); return Math.abs(x - k) * 2 * Math.PI / n <= coneSlitHalf(n) + 1e-9 ? ((k % n) + n) % n : -1; };   // v0.444: граница под головкой → бит по часовой от неё, иначе −1
  const musTick = () => {
    /* v0.446, «лазеры должны крутиться и двигать биты»: головки снова идут по кругу по часовой — за шаг на 1/T круга (T — бит в самой
       длинной строке), и в пути, и на кольце. Кольцо, на котором стоит головка, едет ей навстречу (против часовой) на 1 − n/T бита за
       шаг (n — бит в строке): головка относительно кольца проходит ровно бит за шаг, ни один не пропуская, а на экране двигаются оба —
       и головка, и биты (у самого длинного кольца оно почти стоит, у внутренних — бежит). Какой бит под головкой — считается от бита
       входа (L.j0) и числа шагов, не пересчётом угла: так дробные сдвиги не сбивают счёт. Полный круг относительно кольца — выход. */
    const N = Math.min(Z.rows.length, CONE_MAX), H = musN(), sc = sndSc(), write = musWrite(), T = coneMaxLen(), da = 360 / T;
    if (musL.length !== H) musInit();
    const fillOn = !Z.cone3d && Z.rows.length <= CONE_MAX, P = [], rays = [], hz = new Map(), busy = new Set();
    let ch = false, fch = false;
    const oct = (r) => Math.min(2, Math.floor(r * 3 / (N + 1)));
    const put = (s, j, v) => s.slice(0, j) + v + s.slice(j + 1);
    musL.forEach(L => { if (L.on && L.r < N && Z.rows[L.r].length) busy.add(L.r); else L.on = false; });
    musL.forEach((L, h) => {
      const deg = sc[h % sc.length] + 12 * Math.floor(h / sc.length), seg = [];
      const note = (r) => { const f = 130.81 * Math.pow(2, (deg + 12 * oct(r)) / 12), key = Math.round(f * 10); if (!hz.has(key)) hz.set(key, [f, h]); };
      if (L.on) {   // на кольце: бит под головкой звучит; головка — на 1/T круга по часовой, кольцо — навстречу, вместе ровно бит
        const r = L.r, n = Z.rows[r].length, j = (((L.j0 | 0) + L.c) % n + n) % n;
        if (Z.rows[r][j] === "1") note(r);
        P.push([r, j, 0]); seg.push([L.a, r, "on"]);
        L.a = (L.a + da) % 360;
        coneRot[r] = (((coneRot[r] || 0) + 1 - n / T) % n + n) % n;   // v0.445: без округления — подвинутое до границы кольцо держит её под головкой
        if (++L.c >= n) { L.on = false; busy.delete(r); L.r = r + 1; }
      } else for (let ev = 0; ev < 4; ev++) {   // в пути — наружу до щели или стены; v0.446: головка — на 1/T круга дальше
        if (ev === 0) L.a = (L.a + da) % 360;
        let r = L.r; while (r < N && (busy.has(r) || !Z.rows[r].length)) r++;
        if (r >= N) {   // все строки позади — строка для заполнения, потом снова из центра
          if (fillOn) {
            const f = fillDraft(), j = musCell(f.length, coneFillRot(), L.a);
            if (f[j] === "1") { note(N); Z.fillCells = put(f, j, "0"); } else Z.fillCells = put(f, j, "1");
            fch = true; seg.push([L.a, N, "fill"]);
          } else seg.push([L.a, N, "out"]);
          L.r = 0; break;
        }
        const s = Z.rows[r], e = musEdge() ? musGap(s.length, coneRotOf(r), L.a) : -1, j = e >= 0 ? e : musCell(s.length, coneRotOf(r), L.a);
        if (musEdge() && e >= 0) {   // v0.444: граница бит — встать на кольцо
          if (write && s[j] === "0") { Z.rows[r] = put(s, j, "1"); ch = true; P.push([r, j, 1]); }
          L.r = r; L.on = true; L.c = 0; L.j0 = j; busy.add(r); seg.push([L.a, r, "in"]); break;
        }
        /* v0.445, по снимку — «всё встало тут»: при «границе» головка перед «0» стояла и писала «1», на следующем шаге эта «1» была стеной —
           гасла в «0», головка отражалась… и так без конца: у строки 1 из одного бита граница одна, наверху, кольцо не двигается — через
           центр не проходил никто. Теперь упёрлась в «0» — сама подвигает кольцо, пока граница перед этим битом (против часовой от
           головки) не встанет под неё, и встаёт на кольцо (пишет — этот «0» становится «1» и звучит первым). «1» — по-прежнему стена. */
        if (musEdge() && s[j] === "0") {
          const n = s.length, x = L.a / 360 * n + coneRotOf(r);
          coneRot[r] = (((coneRot[r] || 0) - (x - Math.floor(x + 1e-9))) % n + n) % n;
          if (write) { Z.rows[r] = put(s, j, "1"); ch = true; P.push([r, j, 1]); }
          L.r = r; L.on = true; L.c = 0; L.j0 = j; busy.add(r); seg.push([L.a, r, "in"]); break;
        }
        if (s[j] === "0") {   // щель — встать на кольцо
          if (write) { Z.rows[r] = put(s, j, "1"); ch = true; P.push([r, j, 1]); }
          L.r = r; L.on = true; L.c = 0; L.j0 = j; busy.add(r); seg.push([L.a, r, "in"]); break;
        }
        Z.rows[r] = put(s, j, "0"); ch = true; P.push([r, j, 1]); seg.push([L.a, r, "wall"]);   // «1» — стена: гаснет, головка — сквозь центр на другую сторону
        L.a = (L.a + 180) % 360; L.r = 0;
      }
      rays.push({ c: MUS_COL[h % 7], seg, ring: L.on ? L.r : -1 });
    });
    if (ch) syncLane();
    if (hz.size) {
      sndCtx(); const sp = Z.sndSp || 6, len = Math.min(0.6, 1.6 / sp), t = snd.ctx.currentTime + 0.01;
      let V = [...hz.values()]; if (V.length > 12) V = Array.from({ length: 12 }, (_, q) => V[Math.round(q * (V.length - 1) / 11)]);
      V.forEach(([f, h]) => sndNote(f, t, len, 0.3 / Math.sqrt(V.length), h % 4));
    }
    const show = () => { if (!musT) return; window.zzMusRay = rays; if (ch || fch) renderRows(); else renderCone(); sndMark(P); };   // как у «Звука» (v0.388): картинка — вместе со звуком
    const L = sndLat(); if (L > 0.015) setTimeout(show, L * 1000); else show();
    if (Date.now() - musSaved > 5000) { musSaved = Date.now(); Z.coneRot = coneRot.map(x => Math.round(x || 0)); save(); }
  };
  const musLoop = () => {
    if (!musT) return;
    if (Z.rowLock) { musSet(false); say("🎵 Строки заперты — музыка встала."); return; }
    musTick(); musT = setTimeout(musLoop, 1000 / (Z.sndSp || 6));
  };
  const musSet = (on) => {
    if (on === !!musT) return;
    if (on) {
      if (rowsLocked()) return;
      if (Z.coneSun) $("bConeSun").click();
      if (Z.coneClock) { const c = $("coneClock"); c.checked = false; c.onchange({ target: c }); }
      undoPush(undoState()); sndCtx(); musInit(); musSaved = Date.now(); musT = setTimeout(musLoop, 0);
      say(`🎵 Музыка лазера: ${musN()} голов${musN() === 1 ? "ка" : musN() < 5 ? "ки" : "ок"} через ${Math.round(3600 / musN()) / 10}°, у каждой своя нота (строка — октава). Из центра наружу: «0» — щель, головка встаёт на кольцо и крутит его полный круг, играя его «1»; «1» — стена: гаснет, головка отражается сквозь центр. Занятое кольцо другие проходят мимо. ↩ вернёт строки.`);
    } else { clearTimeout(musT); musT = 0; window.zzMusRay = null; sndMark(null); Z.coneRot = coneRot.map(x => Math.round(x || 0)); renderCone(); save(); }
    musUi();
  };
  if ($("bConeMus")) {
    musUi();
    $("bConeMus").onclick = () => musSet(!musT);
    const mn = $("coneMusN"); mn.value = musN();   // v0.442: сколько головок
    mn.onchange = () => { Z.coneMusN = +mn.value; Z.coneMusN = musN(); mn.value = Z.coneMusN; save(); };
    const sl = $("coneMusSlit"); sl.value = musEdge() ? "edge" : "zero";   // v0.444: щель — «0» или граница бит
    sl.onchange = () => { Z.coneMusSlit = sl.value === "edge" ? "edge" : "zero"; if (musT) musInit(); save();
      say(musEdge() ? "🎵 Щель — граница бит (как у луч-часов): головка встаёт на кольцо, только когда под ней граница; иначе «1» — стена, перед «0» стоит. Чтобы щели сходились с головками — «▶ крутить» по биту или навстречу." : "🎵 Щель — «0»: головка встаёт на кольцо в «0», от «1» отражается."); };
    $("coneMusIn").onchange = (e) => { Z.coneMusIn = e.target.value === "read" ? "read" : "write"; save();   // v0.443
      say(musWrite() ? "🎵 Пишет: головка, встав в щель, ставит там «1» — нота записана." : "🎵 Читает: щель остаётся «0» — головка только играет кольцо; «1» гаснут от отражений."); };
    $("bConeMusZero").onclick = () => {
      try { snapshot(); } catch (err) { if (err.message === "ZZ_LOCK") return; throw err; }
      Z.rows = Z.rows.map(s => "0".repeat(s.length)); syncLane(); renderAll(); save();
      say("∅ Все строки — нули той же длины: 🎵 лазер наберёт ноты сам. ↩ вернёт.");
    };
  }
  /* v0.235, «подключать надо настройку — звук с компа»: правый щелчок по ⏺ — писать ли вместе с конусом звук ПК (Z.coneRecSnd,
     на кнопке значок ♪). Звук берётся захватом экрана — браузер при старте спросит, что показать: на Windows системный звук
     отдаётся только с «Весь экран» и галкой «Поделиться системным звуком», у вкладки — «звук вкладки». Картинка захвата в
     файл не идёт — только его звук. Захват закрыли кнопкой браузера — запись останавливается и сохраняется. */
  let rec = null, recT = 0, recBusy = false;
  let recPause = 0, recPausedAt = 0, frameOn = false;   // v0.256: сколько мс стояли на паузе, с какого мига пауза; ▣ кадр включён
  const recUi = () => {
    const b = $("bConeRec");
    b.classList.toggle("snd", !!Z.coneRecSnd);
    if (!rec) b.title = (Z.coneRecSnd ? "⏺♪ Видео со звуком ПК" : "⏺ Видео") + ": запись холста конуса (только сам конус, без кнопок) в файл .webm. Ещё раз — стоп и сохранить. Правый щелчок — звук ПК вкл/выкл. Удобно вместе с «▶ крутить»";
    const m = $("bConeRecMp4");   // v0.250
    if (m) { m.classList.toggle("snd", !!Z.coneRecSnd); if (!rec) m.title = (Z.coneRecSnd ? "⏺♪ mp4 со звуком ПК" : "⏺ mp4") + ": запись холста конуса в файл .mp4 (H.264) — открывается везде: телефон, Телеграм, YouTube. Ещё раз — стоп и сохранить. Правый щелчок — звук ПК вкл/выкл"; }
  };
  recUi();
  /* v0.236, «рамкой показать размер видео при записи конуса и расположить его изначально посередине»: пока идёт запись (и пока
     мышь над ⏺) холст обведён пунктиром — это и есть кадр видео, вверху его размер в пикселях. Рамка лежит поверх холста, а не
     на нём, — в файл не попадает. Со стартом записи конус встаёт в середину кадра: сдвиг сброшен, масштаб тот же. */
  /* v0.393, «запись видео нужна в формат мобильника или компа — по определению»: ролик теперь не размером холста (он какой угодно — как
     окно), а стандартного кадра по устройству: телефон — вертикальный 1080×1920, компьютер — горизонтальный 1920×1080. Из холста берётся
     область этого формата вокруг середины, по короткой стороне холста (конус в середине её и заполняет); чего в холсте нет — фон страницы.
     Кадр собирается на отдельном холсте recCv (recDraw) — его и пишут все три записи: ⏺ / mp4, ↻1 и 🎞. Рамка ▣ показывает эту область */
  const recFmt = () => {
    let mob = false;
    try { mob = (navigator.userAgentData && navigator.userAgentData.mobile) || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
      || (matchMedia("(pointer: coarse)").matches && Math.min(screen.width, screen.height) < 900); } catch (e) { mob = false; }
    return mob ? { W: 1080, H: 1920, mob: true } : { W: 1920, H: 1080, mob: false };
  };
  const recRect = (cv, F) => {   // область кадра в пикселях холста: формат F вокруг центрального квадрата (короткая сторона холста)
    const S = Math.min(cv.width, cv.height), a = F.W / F.H, w = a >= 1 ? S * a : S, h = a >= 1 ? S : S / a;
    return { x: (cv.width - w) / 2, y: (cv.height - h) / 2, w, h };
  };
  const recBg = (el) => { for (let e = el; e && e !== document.documentElement; e = e.parentElement) { const c = getComputedStyle(e).backgroundColor; if (c && !/rgba\(\s*0,\s*0,\s*0,\s*0\s*\)|transparent/.test(c)) return c; } return "#000"; };
  let recCv = null;
  const recDraw = (F) => {
    const cv = $("coneCv"); if (!recCv) recCv = document.createElement("canvas");
    if (recCv.width !== F.W) recCv.width = F.W; if (recCv.height !== F.H) recCv.height = F.H;
    const g = recCv.getContext("2d"), R = recRect(cv, F), s = F.W / R.w;
    g.fillStyle = recBg(cv); g.fillRect(0, 0, F.W, F.H);
    g.drawImage(cv, -R.x * s, -R.y * s, cv.width * s, cv.height * s);
    return recCv;
  };
  const recFrame = (on) => {
    const cv = $("coneCv"); let f = $("coneRecFrame");
    if (!on) { if (f) f.style.display = "none"; return; }
    if (!f) { f = document.createElement("div"); f.id = "coneRecFrame"; f.appendChild(document.createElement("span")); cv.parentNode.appendChild(f); }
    const F = recFmt(), R = recRect(cv, F), k = cv.offsetWidth / (cv.width || 1);   // v0.393: рамка — область кадра, видимая часть холста
    const x0 = Math.max(0, R.x) * k, y0 = Math.max(0, R.y) * k, x1 = Math.min(cv.width, R.x + R.w) * k, y1 = Math.min(cv.height, R.y + R.h) * k;
    f.style.cssText = `display:block;left:${cv.offsetLeft + x0}px;top:${cv.offsetTop + y0}px;width:${x1 - x0}px;height:${y1 - y0}px`;
    f.classList.toggle("paused", !!recPausedAt); f.classList.toggle("preview", !rec);   // v0.256: пауза — жёлтая, без записи (▣ кадр) — бледная
    f.firstChild.textContent = `${F.W}×${F.H} ${F.mob ? "📱" : "🖥"}` + (recPausedAt ? " · ⏸ пауза" : "");
  };
  if (window.ResizeObserver) new ResizeObserver(() => { if (rec || frameOn) recFrame(true); }).observe($("coneCv"));   // v0.256: и в дзене, и при смене размера окна
  /* v0.256, «видео — когда запись, на паузу можно?» → «да»: ⏸ (видна, пока идёт запись) — запись встаёт, конус можно крутить и
     настраивать, в файл это не идёт; ещё раз — дальше в тот же файл. Рамка кадра на паузе — жёлтая. */
  const pauseUi = () => {
    const p = $("bConeRecPause"); if (!p) return;
    p.classList.toggle("on", !!recPausedAt); p.textContent = recPausedAt ? "▶" : "⏸";
    p.title = recPausedAt ? "▶ Дальше — запись продолжается в тот же файл" : "⏸ Пауза записи: конус можно крутить и настраивать — в файл это не пойдёт; ещё раз — дальше";
  };
  $("bConeRecPause").onclick = () => {
    if (!rec) return;
    if (rec.state === "recording") { rec.pause(); recPausedAt = Date.now(); say("⏸ Запись на паузе — крути и настраивай, в файл не идёт. ▶ — дальше."); }
    else if (rec.state === "paused") { rec.resume(); recPause += Date.now() - recPausedAt; recPausedAt = 0; say("▶ Запись идёт дальше — в тот же файл."); }
    pauseUi(); recFrame(true);
  };
  /* v0.256, «кнопку рядом с видео — ставит расположение, как будет на видео»: ▣ кадр — конус в середину кадра (как при старте записи:
     сдвиг сброшен, масштаб тот же) и рамка кадра на холсте, пока не нажмёшь ещё раз. В файл рамка не идёт. */
  $("bConeFrame").onclick = () => {
    frameOn = !frameOn; $("bConeFrame").classList.toggle("on", frameOn);
    if (frameOn) { conePan = [0, 0]; renderCone(); }
    recFrame(frameOn || !!rec);
    say(frameOn ? "▣ Кадр видео: конус — в середине, рамка — то, что попадёт в файл (размер — вверху рамки). Ещё раз ▣ — убрать рамку." : "▣ Рамка кадра убрана.");
  };
  $("bConeRec").onmouseenter = $("bConeRecMp4").onmouseenter = () => recFrame(true);
  $("bConeRec").onmouseleave = $("bConeRecMp4").onmouseleave = () => { if (!rec && !frameOn) recFrame(false); };
  $("bConeRec").oncontextmenu = $("bConeRecMp4").oncontextmenu = (e) => {
    e.preventDefault();
    if (rec || recBusy) return;
    Z.coneRecSnd = !Z.coneRecSnd; save(); recUi();
    say(Z.coneRecSnd ? "⏺♪ Запись конуса — со звуком ПК. При старте браузер спросит, откуда звук: «Весь экран» + галка «Поделиться системным звуком»." : "⏺ Запись конуса — без звука.");
  };
  /* v0.250, «что с кнопкой видео? mp4 пишет?» → «добавь кнопку туда рядом с имеющейся»: ⏺ пишет .webm, рядом — «mp4» пишет .mp4 (H.264,
     со звуком — AAC): его открывает любой плеер и телефон без перекодировки. Идёт запись любой из двух — щелчок по любой её останавливает. */
  const recGo = async (fmt) => {
    const mp4 = fmt === "mp4", b = $(mp4 ? "bConeRecMp4" : "bConeRec"), cvx = $("coneCv");
    if (rec) { rec.stop(); return; }
    if (recBusy) return;
    if (!cvx.captureStream || typeof MediaRecorder === "undefined") { say("⏺ Этот браузер не умеет записывать холст."); return; }
    let cap = null, at = null;
    if (Z.coneRecSnd) {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) { say("⏺♪ Этот браузер не умеет брать звук ПК."); return; }
      recBusy = true;
      try { cap = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true, systemAudio: "include" }); }
      catch (err) { cap = null; }
      recBusy = false;
      if (!cap) { say("⏺♪ Захват звука отменён — запись не начата."); return; }
      at = cap.getAudioTracks()[0] || null;
      if (!at) {
        cap.getTracks().forEach(t => t.stop());
        say("⏺♪ Звук не выбран — запись не начата. В окне выбора: «Весь экран» и галка «Поделиться системным звуком» (или вкладка с галкой «звук вкладки»).");
        return;
      }
    }
    // v0.240: звучит «♫ звук» — его дорожка идёт в запись напрямую (копией: стоп записи не должен глушить звук)
    if (!at && snd && sndT) at = (snd.rec.stream.getAudioTracks()[0] || null) && snd.rec.stream.getAudioTracks()[0].clone();
    /* v0.257, «если её вкл — то также на видео»: дорожка «♫ Звук» идёт в запись всегда (без звука ПК) — включил музыку посреди записи,
       она тоже в файле; молчит — в файле тишина */
    if (!at && !cap && (window.AudioContext || window.webkitAudioContext)) { try { sndCtx(); at = snd.rec.stream.getAudioTracks()[0].clone(); } catch (err) { at = null; } }
    const sndLab = cap ? " со звуком ПК" : at && sndT ? " со звуком ♫" : "";
    const want = mp4 ? (at ? ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4;codecs=avc1,mp4a.40.2", "video/mp4"] : ["video/mp4;codecs=avc1.42E01E", "video/mp4;codecs=avc1", "video/mp4"])
      : at ? ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"] : ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
    const mime = want.find(m => MediaRecorder.isTypeSupported(m)) || "";
    if (mp4 && !mime) { if (cap) cap.getTracks().forEach(t => t.stop()); say("⏺ Этот браузер не пишет mp4 — жми ⏺ (webm). В Chrome и Edge mp4 есть с весны 2024."); return; }
    const F = recFmt(); recDraw(F);   // v0.393: пишется кадр формата устройства, собранный из холста
    const chunks = [], stream = recCv.captureStream(30);
    if (at) stream.addTrack(at);
    rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 12e6 } : undefined);
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    rec.onstop = async () => {
      clearInterval(recT); stream.getTracks().forEach(t => t.stop());
      if (recPausedAt) { recPause += Date.now() - recPausedAt; recPausedAt = 0; }   // v0.256: остановили с паузы
      const pausedMs = recPause; recPause = 0; document.body.classList.remove("conerec"); pauseUi();
      if (cap) cap.getTracks().forEach(t => t.stop());
      let blob = new Blob(chunks, { type: mp4 ? "video/mp4" : "video/webm" });
      // v0.235, «нет эскизов в плейлисте»: у webm из MediaRecorder в заголовке нет длительности — плеер пишет 0, эскиза не строит.
      // Дописывает её общий recorder.js (подключён без своей кнопки); нет модуля — файл уходит как раньше.
      const R = window.__zerkRecorder;
      if (!mp4 && R && R.fixWebm) blob = await R.fixWebm(blob, Date.now() - t0 - pausedMs);   // v0.250: у mp4 длительность в заголовке и так есть; v0.256: без пауз
      const a = document.createElement("a");
      const d = new Date(), p2 = (x) => String(x).padStart(2, "0");
      a.href = URL.createObjectURL(blob); a.download = `Zerkalius-konus-${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}-${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}.${mp4 ? "mp4" : "webm"}`;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      rec = null; b.classList.remove("on"); b.textContent = mp4 ? "mp4" : "⏺"; recUi();   // v0.155: кнопка квадратная — только значок
      recFrame(frameOn);   // v0.256: ▣ включён — рамка остаётся
      say(`⏺ Видео сохранено: ${a.download} (${(blob.size / 1048576).toFixed(1)} МБ${sndLab ? "," + sndLab : ""}).`);
    };
    if (at) { const r = rec; at.addEventListener("ended", () => { if (r.state !== "inactive") r.stop(); }); }
    rec.start(1000);
    { const r0 = rec, loop = () => { if (rec !== r0) return; if (!recPausedAt) recDraw(F); requestAnimationFrame(loop); }; requestAnimationFrame(loop); }   // v0.393: кадр — каждый кадр экрана, пока идёт эта запись
    const t0 = Date.now(); b.classList.add("on"); b.textContent = "⏹";
    recPause = 0; recPausedAt = 0; document.body.classList.add("conerec"); pauseUi();   // v0.256: ⏸ — видна, пока идёт запись
    const tick = () => { recFrame(true); const s = Math.floor((Date.now() - t0 - recPause - (recPausedAt ? Date.now() - recPausedAt : 0)) / 1000); b.title = `⏹ ${recPausedAt ? "Пауза" : "Идёт запись"}${sndLab} ${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")} — щелчок: стоп и сохранить`; };   // v0.155: время — в подсказке, на квадратной кнопке только ⏹
    conePan = [0, 0];   // v0.236: конус — в середину кадра
    renderCone(); tick(); recT = setInterval(tick, 500);
    say(`⏺ Пишу конус${mp4 ? " в mp4" : ""}${sndLab}… Ещё раз ${mp4 ? "⏹" : "⏺"} — стоп и сохранить. Холст пишется, только когда меняется, — включи «▶ крутить» или крути сам.`);
  };
  $("bConeRec").onclick = () => recGo("webm");
  $("bConeRecMp4").onclick = () => recGo("mp4");   // v0.250
  /* v0.270, «кнопку „записать ровно один оборот“ — видео повторяется без скачка» (для обоев Lively): ↻1 — запись ровно одного цикла
     кручения, по часам записи, а не кадров: «всё целиком» и «навстречу по строкам» — 360°, «по биту» — пока все кольца разом не
     вернутся на места (НОК длин строк, бит). Кручение ведёт сама запись: от места, где конус стоит, до того же места; последний кадр —
     за миг до начала, поэтому конец ролика стыкуется с началом. Скорость и направление — с ползунка «▶ крутить». Лазер в записи оборота
     не работает (он меняет рисунок — цикл бы не замкнулся). ⏸ — пауза, как обычно; ⏹ — стоп раньше срока. */
  let turnOn = false;
  const recTurn = async () => {
    if (rec) { rec.stop(); return; }
    if (recBusy || turnOn) return;
    const m = Z.coneSpinMode || "all", sp = Z.coneAutoSp ?? 30, dir = sp < 0 ? -1 : 1, bitm = coneBitMode(m);
    let P, v;   // цикл и скорость — в единицах фазы (градусы или биты) в секунду
    if (bitm) { const L = coneCycleBits(); if (L > 1000000000n) { say(`↻1 Цикл «по биту» — ${coneBigFmt(L)} бит: такой ролик не записать. Возьми «всё целиком» или «навстречу по строкам» (360°).`); return; } P = Number(L); v = Math.abs(sp) / 10; }
    else { P = 360; v = Math.abs(sp); }
    const D = P / v;
    if (!(D > 0.2)) { say("↻1 Скорость кручения — ноль: оборот не записать."); return; }
    if (D > 1800) { say(`↻1 Один оборот на этой скорости — ${Math.round(D / 60)} мин: слишком долго. Прибавь скорость ползунком «▶ крутить».`); return; }
    const wasAuto = !!autoRaf, wasClock = !!Z.coneClock; autoSet(false);
    const key = m === "all" ? "coneSpin" : "coneSpinPh", s0 = Z[key] || 0;
    if (wasClock) Z.coneClock = false;
    const fmt = typeof MediaRecorder !== "undefined" && ["video/mp4;codecs=avc1.42E01E", "video/mp4"].some(x => MediaRecorder.isTypeSupported(x)) ? "mp4" : "webm";
    turnOn = true; $("bConeRecTurn").classList.add("on");
    await recGo(fmt);
    const fin = () => {
      turnOn = false; $("bConeRecTurn").classList.remove("on");
      Z[key] = s0; if (wasClock) Z.coneClock = true; renderCone(); save();
      if (wasAuto) autoSet(true);
    };
    if (!rec) { fin(); return; }
    const r = rec; let t0 = performance.now(), last = t0;
    const step = () => {
      if (rec !== r || r.state === "inactive") { fin(); return; }   // остановили ⏹ раньше срока
      const now = performance.now();
      if (recPausedAt) t0 += now - last;   // на паузе время оборота стоит
      last = now;
      const e = (now - t0) / 1000;
      if (e >= D) { r.stop(); fin(); say(`↻1 Записан ровно один оборот (${D < 60 ? D.toFixed(1) + " с" : Math.round(D / 6) / 10 + " мин"}) — ролик можно крутить по кругу без скачка.`); return; }
      const ph = s0 + dir * v * e;
      Z[key] = m === "all" ? ((ph % 360) + 360) % 360 : ph;
      renderCone();
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    say(`↻1 Пишу ровно один оборот — ${D < 60 ? D.toFixed(1) + " с" : Math.round(D / 6) / 10 + " мин"} (${bitm ? P + " бит" : "360°"}, ${fmt}); остановится сам. Вкладку не сворачивай — иначе кадры встанут.${wasClock ? " Лазер на время записи выключен." : ""}`);
  };
  /* v0.283, «запись конуса для обоев можно как-то независимо сделать, чтоб не тормозил, даже если в браузере тормозит»: ↻1 пишет не в
     реальном времени (MediaRecorder снимал экран как есть — подтормозил кадр, и в ролике рывок), а ПОКАДРОВО: фаза кручения для кадра k —
     ровно s0 + P·k/N, кадр рисуется, уходит в кодировщик H.264 браузера (WebCodecs) с меткой времени k/fps, файл собирает mp4-muxer
     (jsdelivr, грузится при первой записи). Сколько бы кадр ни считался, в ролике они идут ровно; медленный компьютер просто дольше пишет.
     N кадров — ровно один период, последний — за шаг до начала: ролик замыкается без скачка. 60 кадров/с (правый щелчок по ↻1 — 30/60).
     Звука нет (обои). Ещё раз ↻1 — отмена. Нет WebCodecs или не загрузился упаковщик — прежняя запись в реальном времени. */
  /* v0.284: общий покадровый кодировщик — H.264 браузера (WebCodecs) + mp4-muxer 5.2.2 (jsdelivr); кадр — копия холста (стороны чётные),
     метка времени k/fps. Строка вместо объекта — почему не вышло. */
  const offYield = () => new Promise(r => { const c = new MessageChannel(); c.port1.onmessage = () => r(); c.port2.postMessage(0); });   // не тормозится в свёрнутой вкладке
  const offOpen = async (W, H, fps) => {
    if (!(window.VideoEncoder && window.VideoFrame)) return "Этот браузер не умеет покадровую запись (нет WebCodecs).";
    if (W < 16 || H < 16) return "Холст конуса слишком мал для видео.";
    let MX = null;
    try { MX = await import("https://cdn.jsdelivr.net/npm/mp4-muxer@5.2.2/+esm"); } catch (err) { MX = null; }
    if (!MX) return "Не загрузился упаковщик mp4 (нужен интернет).";
    const bitrate = Math.round(Math.max(4e6, Math.min(40e6, W * H * fps * 0.1)));
    let cfg = null;
    for (const codec of ["avc1.640034", "avc1.640033", "avc1.640028", "avc1.4d0028", "avc1.42001f"]) {
      const c = { codec, width: W, height: H, bitrate, framerate: fps, avc: { format: "avc" } };
      try { const q = await VideoEncoder.isConfigSupported(c); if (q && q.supported) { cfg = c; break; } } catch (err) { /* не этот */ }
    }
    if (!cfg) return `Кодировщик H.264 браузера не берёт ${W}×${H}.`;
    const muxer = new MX.Muxer({ target: new MX.ArrayBufferTarget(), video: { codec: "avc", width: W, height: H, frameRate: fps }, fastStart: "in-memory" });
    let err = null;
    const enc = new VideoEncoder({ output: (ch, meta) => muxer.addVideoChunk(ch, meta), error: (e) => { err = e; } });
    enc.configure(cfg);
    const tmp = document.createElement("canvas"); tmp.width = W; tmp.height = H; const tx = tmp.getContext("2d");
    return {
      err: () => err,
      add: async (src, k) => {
        tx.drawImage(src, 0, 0, W, H, 0, 0, W, H);
        const fr = new VideoFrame(tmp, { timestamp: Math.round(k * 1e6 / fps), duration: Math.round(1e6 / fps) });
        enc.encode(fr, { keyFrame: k % (fps * 2) === 0 }); fr.close();
        while (enc.encodeQueueSize > 6 && !err) await new Promise(r => { if ("ondequeue" in enc) enc.addEventListener("dequeue", r, { once: true }); else setTimeout(r, 4); });
      },
      done: async (keep) => {
        try { if (keep && !err) await enc.flush(); } catch (e) { err = err || e; }
        try { enc.close(); } catch (e) { /* уже закрыт */ }
        if (!keep || err) return null;
        muxer.finalize(); return new Blob([muxer.target.buffer], { type: "video/mp4" });
      },
    };
  };
  const offSave = (blob, tag) => {
    const a = document.createElement("a"), dd = new Date(), p2 = (x) => String(x).padStart(2, "0");
    a.href = URL.createObjectURL(blob); a.download = `Zerkalius-konus-${tag}-${dd.getFullYear()}${p2(dd.getMonth() + 1)}${p2(dd.getDate())}-${p2(dd.getHours())}${p2(dd.getMinutes())}${p2(dd.getSeconds())}.mp4`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    return a.download;
  };
  const tFmt = (x) => x < 60 ? x.toFixed(x < 10 ? 1 : 0) + " с" : Math.floor(x / 60) + ":" + String(Math.floor(x % 60)).padStart(2, "0") + " мин";
  /* v0.283, «запись конуса для обоев можно как-то независимо сделать, чтоб не тормозил, даже если в браузере тормозит»: ↻1 пишет не в
     реальном времени (MediaRecorder снимал экран как есть — подтормозил кадр, и в ролике рывок), а ПОКАДРОВО: фаза кручения для кадра k —
     ровно s0 + P·k/N. N кадров — ровно один период, последний — за шаг до начала: ролик замыкается без скачка. 60 кадров/с (правый
     щелчок по ↻1 — 30/60). Звука нет (обои). Ещё раз ↻1 — отмена. Не вышло (нет WebCodecs, интернета) — прежняя запись в реальном времени. */
  let offRun = null;
  const recTurnOff = async () => {
    if (offRun) { offRun.stop = true; return; }
    if (rec || recBusy || turnOn || offRec) return;
    const m = Z.coneSpinMode || "all", sp = Z.coneAutoSp ?? 30, dir = sp < 0 ? -1 : 1, bitm = coneBitMode(m);
    let P, v;
    if (bitm) { const L = coneCycleBits(); if (L > 1000000000n) { say(`↻1 Цикл «по биту» — ${coneBigFmt(L)} бит: такой ролик не записать. Возьми «всё целиком» или «навстречу по строкам» (360°).`); return; } P = Number(L); v = Math.abs(sp) / 10; }
    else { P = 360; v = Math.abs(sp); }
    const D = P / v;
    if (!(D > 0.2)) { say("↻1 Скорость кручения — ноль: оборот не записать."); return; }
    if (D > 1800) { say(`↻1 Один оборот на этой скорости — ${Math.round(D / 60)} мин: слишком долго. Прибавь скорость ползунком «▶ крутить».`); return; }
    const fps = Z.coneRecFps === 30 ? 30 : 60, N = Math.max(2, Math.round(D * fps));
    const cvx = $("coneCv"), b = $("bConeRecTurn");
    conePan = [0, 0]; renderCone();
    const F = recFmt(), W = F.W, H = F.H;   // v0.393: кадр — формат устройства
    offRun = { stop: false }; const run = offRun;
    b.classList.add("on"); b.textContent = "…";
    const E = await offOpen(W, H, fps);
    if (typeof E === "string" || run.stop) {
      offRun = null; b.classList.remove("on"); b.textContent = "↻1";
      if (run.stop) { if (typeof E !== "string") await E.done(false); return; }
      say("↻1 " + E + " Пишу по-старому, в реальном времени."); return recTurn();
    }
    const wasAuto = !!autoRaf, wasClock = !!Z.coneClock; autoSet(false);
    const key = m === "all" ? "coneSpin" : "coneSpinPh", s0 = Z[key] || 0;
    if (wasClock) Z.coneClock = false;
    coneHover = -1; document.body.classList.add("conerec2");
    const T0 = performance.now(); let lastUi = 0;
    say(`↻1 Пишу один оборот покадрово: ${N} кадров, ${fps} к/с, ${W}×${H} — ролик ${tFmt(D)}. Ровно, даже если браузер тормозит; ↻1 ещё раз — отмена.${wasClock ? " Лазер на время записи выключен." : ""}`);
    try {
      for (let k = 0; k < N; k++) {
        if (run.stop || E.err()) break;
        const ph = s0 + dir * P * k / N;
        Z[key] = m === "all" ? ((ph % 360) + 360) % 360 : ph;
        coneHover = -1; renderCone();
        await E.add(recDraw(F), k);
        const now = performance.now();
        if (now - lastUi > 300) {
          lastUi = now; const pc = Math.floor(k * 100 / N), left = k ? (now - T0) / k * (N - k) / 1000 : 0;
          b.textContent = pc + "%"; b.title = `↻1 Покадровая запись: кадр ${k} из ${N} (${pc}%), осталось ~${tFmt(left)}. Щелчок — отмена`;
        }
        await offYield();
      }
    } catch (err) { /* ошибку скажет E.err */ }
    const bad = E.err(), blob = await E.done(!run.stop && !bad);
    Z[key] = s0; if (wasClock) Z.coneClock = true;
    document.body.classList.remove("conerec2"); offRun = null; b.classList.remove("on"); b.textContent = "↻1"; b.title = turnTitle();
    renderCone(); save(); if (wasAuto) autoSet(true);
    if (run.stop) { say("↻1 Покадровая запись отменена — файл не сохранён."); return; }
    if (bad || !blob) { say("↻1 Ошибка кодировщика: " + ((bad && bad.message) || bad || "—") + " — файл не сохранён."); return; }
    const name = offSave(blob, "oborot"), took = (performance.now() - T0) / 1000;
    say(`↻1 Готово: ${name} — ровно один оборот, ${N} кадров по ${fps} к/с, ${W}×${H}, ${(blob.size / 1048576).toFixed(1)} МБ; считалось ${tFmt(took)}. Крутится по кругу без скачка.`);
  };
  /* v0.284, «и обычную запись mp4 тоже сделай покадровой — такую возможность»: 🎞 рядом с mp4 — запись КРУЧЕНИЯ покадрово. Каждый кадр —
     ровно 1/fps секунды кручения (тот же шаг, что у ▶: режимы, лазер, краска, ✺, остановки на проходе), рисуется и уходит в кодировщик;
     в ролике время ровное, как бы ни тормозил браузер, — медленный компьютер пишет дольше, быстрый — быстрее (на экране конус тогда
     идёт медленнее или быстрее, в файле — ровно). В файл идут только кадры, пока крутится: остановил ▶ или кручение встало само — запись
     ждёт; ▶ — дальше в тот же файл. Ручки (скорость, режим, лазер) крутить можно — всё идёт в запись. Ещё раз 🎞 — стоп и сохранить.
     Звука нет. Холст мышью не трогается (обводка в ролик не попадает). */
  let offRec = null;
  const recOff = async () => {
    if (offRec) { offRec.stop = true; return; }
    if (rec || recBusy || turnOn || offRun) return;
    const fps = Z.coneRecFps === 30 ? 30 : 60, cvx = $("coneCv"), b = $("bConeRecOff");
    conePan = [0, 0]; renderCone();
    const F = recFmt(), W = F.W, H = F.H;   // v0.393: кадр — формат устройства
    offRec = { stop: false }; const run = offRec;
    b.classList.add("on"); b.textContent = "…";
    const E = await offOpen(W, H, fps);
    if (typeof E === "string" || run.stop) { offRec = null; b.classList.remove("on"); b.textContent = "🎞"; if (typeof E === "string") say("🎞 " + E + " Пиши обычной mp4."); else await E.done(false); return; }
    if (!autoRaf) autoSet(true);
    offDrive = true; coneHover = -1; document.body.classList.add("conerec2");
    const T0 = performance.now(); let k = 0, lastUi = 0;
    say(`🎞 Пишу кручение покадрово: ${fps} к/с, ${W}×${H}. В ролике всё ровно, даже если браузер тормозит; пишется, пока крутится. Ещё раз 🎞 — стоп и сохранить.`);
    try {
      while (!run.stop && !E.err()) {
        if (!autoRaf) { await new Promise(r => setTimeout(r, 60)); continue; }   // кручение стоит — в файл ничего, ждём ▶
        autoStep(1 / fps);
        coneHover = -1; renderCone();
        await E.add(recDraw(F), k); k++;
        const now = performance.now();
        if (now - lastUi > 300) { lastUi = now; b.textContent = tFmt(k / fps).replace(" мин", "").replace(" с", "с"); b.title = `🎞 Идёт покадровая запись: в ролике ${tFmt(k / fps)} (${k} кадров, ${fps} к/с), пишется ${tFmt((now - T0) / 1000)}. Щелчок — стоп и сохранить`; }
        await offYield();
      }
    } catch (err) { /* ошибку скажет E.err */ }
    offDrive = false;
    const bad = E.err(), blob = await E.done(k > 0 && !bad);
    document.body.classList.remove("conerec2"); offRec = null; b.classList.remove("on"); b.textContent = "🎞"; b.title = offTitle();
    save();
    if (bad) { say("🎞 Ошибка кодировщика: " + (bad.message || bad) + " — файл не сохранён."); return; }
    if (!blob) { say("🎞 Ни одного кадра — конус не крутился. Файл не сохранён."); return; }
    const name = offSave(blob, "kadry");
    say(`🎞 Сохранено: ${name} — ${tFmt(k / fps)} ролика (${k} кадров по ${fps} к/с), ${W}×${H}, ${(blob.size / 1048576).toFixed(1)} МБ; писалось ${tFmt((performance.now() - T0) / 1000)}.`);
  };
  const offTitle = () => `🎞 mp4 покадрово: пишется кручение, каждый кадр — ровно 1/${Z.coneRecFps === 30 ? 30 : 60} с (режимы, лазер, краска — всё как у ▶), в ролике ровно, даже если браузер тормозит. Пишется, пока крутится (▶ стоп — запись ждёт). Ручки крутить можно. Без звука. Ещё раз — стоп и сохранить. Правый щелчок — 30 / 60 кадров/с (общий с ↻1)`;
  $("bConeRecOff").title = offTitle();
  $("bConeRecOff").onclick = recOff;
  $("bConeRecOff").oncontextmenu = (e) => { e.preventDefault(); if (offRec || offRun) return; Z.coneRecFps = Z.coneRecFps === 30 ? 60 : 30; save(); $("bConeRecOff").title = offTitle(); $("bConeRecTurn").title = turnTitle(); say(`🎞 ↻1 Покадровая запись — ${Z.coneRecFps} кадров/с.`); };
  const turnTitle = () => `↻1 Ровно один оборот для обоев — покадрово: каждый кадр считается сколько нужно, в ролике всё ровно, даже если браузер тормозит (${Z.coneRecFps === 30 ? 30 : 60} кадров/с, .mp4, без звука). Ролик замыкается без скачка. «Всё целиком» и «навстречу по строкам» — 360°, «по биту» — пока все кольца разом не вернутся на места. Скорость и направление — с «▶ крутить». Лазер на время записи выключен. Ещё раз — отмена. Правый щелчок — 30 / 60 кадров/с`;
  $("bConeRecTurn").title = turnTitle();
  $("bConeRecTurn").onclick = () => (window.VideoEncoder && window.VideoFrame ? recTurnOff() : recTurn());
  $("bConeRecTurn").oncontextmenu = (e) => { e.preventDefault(); if (offRun || offRec) return; Z.coneRecFps = Z.coneRecFps === 30 ? 60 : 30; save(); $("bConeRecTurn").title = turnTitle(); $("bConeRecOff").title = offTitle(); say(`↻1 🎞 Покадровая запись — ${Z.coneRecFps} кадров/с.`); };
  /* v0.267, «как записывать видео в области строк?» → вариант 1: поле строк — не холст, captureStream у него нет. Пишем саму вкладку
     (браузер спрашивает «Поделиться этой вкладкой?») и обрезаем кадр по полю строк (CropTarget, Chrome / Edge) — в файле ровно то, что
     на экране: подсветка, звучащий бит, черта, прокрутка.
     v0.268, «а если одну кнопку на всё — и потом выбор окна кликом: либо строки, либо конус, и потом 3D»: одна ⏺ в шапке; нажал —
     наводишь на окно (строки, ◯ конус, 🧊 вид, ▲ пирамида) — оно обведено, щелчок — пишется оно, Esc или щелчок мимо — отмена.
     Холсты (конус, вид, пирамида) пишутся напрямую, без вопроса браузера и без кнопок поверх; поле строк — вкладкой с обрезкой.
     Звук — дорожка «♫ Звук», как у записи конуса. Пока идёт запись — окно обведено красным пунктиром снаружи (в файл не идёт),
     ⏸ — пауза (рамка жёлтая). Формат — mp4, если браузер умеет, иначе webm. */
  const REC_T = [["rowList", "поле строк", "stroki"], ["coneCv", "конус", "konus"], ["viewCv", "🧊 вид", "vid"], ["pyrCv", "пирамида", "piramida"]];
  let rrec = null, rrT = 0, rrPause = 0, rrPausedAt = 0, rrEl = null, rrPick = null;
  const rrUi = () => {
    const b = $("bRowsRec"), p = $("bRowsRecPause");
    b.classList.toggle("on", !!rrec || !!rrPick); b.textContent = rrec ? "⏹" : "⏺";
    p.classList.toggle("on", !!rrPausedAt); p.textContent = rrPausedAt ? "▶" : "⏸";
    document.body.classList.toggle("rowsrec", !!rrec); document.body.classList.toggle("rowsrecp", !!rrPausedAt);
    document.querySelectorAll(".recon").forEach(x => x.classList.remove("recon"));
    if (rrec && rrEl) rrEl.classList.add("recon");
  };
  $("bRowsRecPause").onclick = () => {
    if (!rrec) return;
    if (rrec.state === "recording") { rrec.pause(); rrPausedAt = Date.now(); say("⏸ Запись на паузе — в файл не идёт. ▶ — дальше."); }
    else if (rrec.state === "paused") { rrec.resume(); rrPause += Date.now() - rrPausedAt; rrPausedAt = 0; say("▶ Запись идёт дальше — в тот же файл."); }
    rrUi();
  };
  const recTargetAt = (t) => {
    for (const [id, name, file] of REC_T) { const el = $(id); if (el && el.offsetParent && el.getClientRects().length && el.contains(t)) return { el, name, file }; }
    return null;
  };
  const pickEnd = () => {
    if (!rrPick) return;
    document.removeEventListener("pointerover", rrPick.over, true); document.removeEventListener("pointerdown", rrPick.down, true);
    document.removeEventListener("click", rrPick.click, true); document.removeEventListener("keydown", rrPick.key, true);
    document.querySelectorAll(".recpk").forEach(x => x.classList.remove("recpk")); document.body.classList.remove("recpick");
    rrPick = null; rrUi();
  };
  const recStart = async (T) => {
    const el = T.el, isCv = el.tagName === "CANVAS";
    let cap = null, vt = null;
    if (typeof MediaRecorder === "undefined") { say("⏺ Этот браузер не умеет записывать видео."); return; }
    if (isCv) {
      if (!el.captureStream) { say("⏺ Этот браузер не умеет записывать холст."); return; }
      vt = el.captureStream(30).getVideoTracks()[0];
    } else {
      const md = navigator.mediaDevices;
      if (!md || !md.getDisplayMedia) { say("⏺ Этот браузер не умеет записывать вкладку — нужен Chrome или Edge."); return; }
      try { cap = await md.getDisplayMedia({ video: { frameRate: 30 }, audio: false, preferCurrentTab: true, selfBrowserSurface: "include", surfaceSwitching: "exclude", monitorTypeSurfaces: "exclude" }); }
      catch (err) { cap = null; }
      if (!cap) { say("⏺ Запись отменена — вкладку не дали."); return; }
      vt = cap.getVideoTracks()[0];
      const ss = vt.getSettings ? vt.getSettings() : {};
      let cropped = false;
      if (ss.displaySurface === "browser" || ss.displaySurface === undefined) {
        try { if (window.CropTarget && vt.cropTo) { await vt.cropTo(await CropTarget.fromElement(el)); cropped = true; } } catch (err) { cropped = false; }
      }
      if (!cropped) {
        cap.getTracks().forEach(t => t.stop());
        say(ss.displaySurface && ss.displaySurface !== "browser" ? "⏺ Выбрана не эта вкладка — окно так не вырезать. Ещё раз ⏺ и в окне выбора — «Эта вкладка»." : "⏺ Этот браузер не умеет вырезать кусок вкладки — нужен Chrome или Edge (с 2022 года).");
        return;
      }
    }
    let at = null;
    if (window.AudioContext || window.webkitAudioContext) { try { sndCtx(); at = snd.rec.stream.getAudioTracks()[0].clone(); } catch (err) { at = null; } }
    const want = at ? ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4;codecs=avc1,mp4a.40.2", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"]
      : ["video/mp4;codecs=avc1.42E01E", "video/mp4;codecs=avc1", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
    const mime = want.find(m => MediaRecorder.isTypeSupported(m)) || "", mp4 = mime.startsWith("video/mp4");
    const stream = new MediaStream([vt].concat(at ? [at] : [])), chunks = [];
    const r = rrec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: isCv ? 12e6 : 8e6 } : undefined);
    rrEl = el;
    r.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    r.onstop = async () => {
      clearInterval(rrT); stream.getTracks().forEach(t => t.stop()); if (cap) cap.getTracks().forEach(t => t.stop());
      if (rrPausedAt) { rrPause += Date.now() - rrPausedAt; rrPausedAt = 0; }
      const pausedMs = rrPause; rrPause = 0; rrec = null; rrEl = null; rrUi();
      let blob = new Blob(chunks, { type: mp4 ? "video/mp4" : "video/webm" });
      const R = window.__zerkRecorder;
      if (!mp4 && R && R.fixWebm) blob = await R.fixWebm(blob, Date.now() - t0 - pausedMs);   // длительность в заголовок webm (как у конуса)
      const a = document.createElement("a"), d = new Date(), p2 = (x) => String(x).padStart(2, "0");
      a.href = URL.createObjectURL(blob); a.download = `Zerkalius-${T.file}-${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}-${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}.${mp4 ? "mp4" : "webm"}`;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      b.title = b.dataset.t || b.title;
      say(`⏺ Видео (${T.name}) сохранено: ${a.download} (${(blob.size / 1048576).toFixed(1)} МБ).`);
    };
    vt.addEventListener("ended", () => { if (r.state !== "inactive") r.stop(); });   // «Остановить показ» в браузере — стоп и сохранить
    r.start(1000);
    const t0 = Date.now(), b = $("bRowsRec"), p2s = (x) => String(x).padStart(2, "0");
    rrPause = 0; rrPausedAt = 0; rrUi();
    const tick = () => { const s = Math.floor((Date.now() - t0 - rrPause - (rrPausedAt ? Date.now() - rrPausedAt : 0)) / 1000); b.title = `⏹ ${rrPausedAt ? "Пауза" : "Идёт запись"}: ${T.name} ${p2s(Math.floor(s / 60))}:${p2s(s % 60)} — щелчок: стоп и сохранить`; };
    tick(); rrT = setInterval(tick, 500);
    if (el.id === "coneCv") { conePan = [0, 0]; renderCone(); }   // конус — в середину кадра, как у ⏺ конуса
    say(`⏺ Пишу: ${T.name}${mp4 ? " в mp4" : ""} — что в красной рамке.${isCv ? " Холст пишется, когда меняется." : ""} ⏹ в шапке — стоп и сохранить, ⏸ — пауза.`);
  };
  $("bRowsRec").dataset.t = $("bRowsRec").title;
  $("bRowsRec").onclick = () => {
    if (rrec) { rrec.stop(); return; }
    if (rrPick) { pickEnd(); say("⏺ Выбор окна для записи отменён."); return; }
    const over = (e) => { document.querySelectorAll(".recpk").forEach(x => x.classList.remove("recpk")); const T = recTargetAt(e.target); if (T) T.el.classList.add("recpk"); };
    const down = (e) => { if (e.target.closest("#bRowsRec")) return; e.stopPropagation(); e.preventDefault(); };   // выбор — не щелчок по окну: конус не крутится, строки не выделяются
    const click = (e) => {
      if (e.target.closest("#bRowsRec")) return;
      e.stopPropagation(); e.preventDefault();
      const T = recTargetAt(e.target); pickEnd();
      if (!T) { say("⏺ Мимо окон — запись не начата."); return; }
      recStart(T);
    };
    const key = (e) => { if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); pickEnd(); say("⏺ Выбор окна для записи отменён."); } };
    rrPick = { over, down, click, key };
    document.addEventListener("pointerover", over, true); document.addEventListener("pointerdown", down, true);
    document.addEventListener("click", click, true); document.addEventListener("keydown", key, true);
    document.body.classList.add("recpick"); rrUi();
    say("⏺ Щёлкни, что записывать: поле строк, ◯ конус, 🧊 вид или ▲ пирамиду (обводится под мышью). Esc — отмена.");
  };
  $("bConeRotClear").onclick = () => {   // v0.101: «как это снять — накрутку?»
    const T = rowSel.size ? [...rowSel] : Z.rows.map((_, i) => i);
    let k = 0; T.forEach(i => { if (Math.round(coneRot[i] || 0)) k++; coneRot[i] = 0; });
    Z.coneRot = coneRot.map(x => Math.round(x || 0)); save(); renderRows(); renderCone();
    say(k ? `◯ Накрутка снята у колец: ${k}${rowSel.size ? " (выделенных)" : ""}. Строки не менялись.` : "◯ Накрученных колец нет.");
  };
  $("bConeRingL").onclick = () => ringStep(-1);
  $("bConeRingR").onclick = () => ringStep(1);
  $("coneMir").value = Z.coneMir || "off";   // v0.080
  $("coneMir").onchange = (e) => { Z.coneMir = e.target.value; save(); renderCone(); };
  const axTargets = () => rowSel.size ? [...rowSel].filter(i => i < Z.rows.length) : [Z.cur];
  const axStep = (d) => {   // v0.084: у каждого кольца своя ось
    Z.coneMir = "man"; $("coneMir").value = "man";
    if (!Z.coneAxisOffs || typeof Z.coneAxisOffs !== "object") Z.coneAxisOffs = {};
    for (const i of axTargets()) Z.coneAxisOffs[i] = coneAxisOff(i) + d;
    save(); renderCone();
  };
  const axReset = (e) => { e.preventDefault(); if (Z.coneAxisOffs) for (const i of axTargets()) delete Z.coneAxisOffs[i]; save(); renderCone(); say("◯ Ось этих колец — снова как у строки ⇄."); };
  $("bConeAxL").onclick = () => axStep(-1);
  $("bConeAxR").onclick = () => axStep(1);
  $("bConeAxL").oncontextmenu = axReset; $("bConeAxR").oncontextmenu = axReset;
  $("bConeMirApply").onclick = () => {
    const mode = Z.coneMir && Z.coneMir !== "off" ? Z.coneMir : "lin";
    const idx = rowSel.size ? [...rowSel].filter(i => i < Z.rows.length) : [Z.cur], sel = idx.slice();
    snapshot();
    let k = 0;
    idx.forEach(i => {
      const s = Z.rows[i], n = s.length, MI = coneMirInfo(s, mode, i); if (!MI || MI.odd) return;
      let o = ""; for (let j = 0; j < n; j++) o += s[MI.partner(j)];
      if (o !== s) k++; Z.rows[i] = o;
    });
    sel.forEach(i => rowSel.add(i));
    renderAll(); save();
    say(`⇄ по оси кольца (${mode === "c180" ? "через центр 180°" : mode === "best" ? "лучшая ось" : mode === "man" ? "ось вручную" : "как у строки"}): изменено строк ${k} из ${idx.length}. ↩ вернёт.`);
  };
  $("coneGlow").checked = !!Z.coneGlow;   // v0.103
  $("coneGlow").onchange = (e) => { Z.coneGlow = e.target.checked; save(); renderCone(); if (Z.coneGlow) say("✨ Лампа горит. На тёмном фоне («☾ Тёмный» в шапке) — ярче всего."); };
  { const b = $("bConeArcs"), ui = () => b.classList.toggle("on", Z.coneArcs !== false);   // v0.375: ◠ дуги битов — показать / скрыть, по умолчанию показаны
    if (b) { ui(); b.onclick = () => { Z.coneArcs = Z.coneArcs === false; ui(); save(); renderCone(); say(Z.coneArcs !== false ? "◠ Дуги битов на конусе — видны." : "◠ Дуги битов скрыты: остались границы между битами, кольца, лучи и лазер."); }; } }
  $("coneOcta").checked = !!Z.coneOcta;   // v0.100
  $("coneOcta").onchange = (e) => { Z.coneOcta = e.target.checked; if (Z.coneOcta && !Z.cone3d) { Z.cone3d = true; $("cone3d").checked = true; } save(); renderCone();
    if (Z.coneOcta) say("⧗ Октаэдр: под основанием — та же пирамида вниз, отражённая и инвертированная (0 ↔ 1), как в знаке Zerkalius. Крути мышью.");
    const os = $("coneOctaSel"); if (os) os.value = Z.coneOcta ? (Z.coneOctaSel === "cur" ? "cur" : "all") : "off"; };
  /* v0.359, по снимкам «✳ все» и «⧗ зерк.» — «у зеркала тоже надо»: зеркало вниз — списком, как лучи: ⧗ нет / ⧗ выдел. / ⧗ все.
     «Выдел.» — отражены только кольца строк в фокусе (выделенные, нет выделения — текущая). Галка coneOcta — прежняя (спрятана): её жмут
     пульт (⧗ над 🧊) и пресеты, список за ней следит; Z.coneOctaSel — что отражать при включённом */
  { const os = $("coneOctaSel");
    if (os) { os.value = Z.coneOcta ? (Z.coneOctaSel === "cur" ? "cur" : "all") : "off";
      os.onchange = () => { const v = os.value; if (v !== "off") Z.coneOctaSel = v; const c = $("coneOcta"), on = v !== "off";
        if (c.checked !== on) { c.checked = on; c.onchange({ target: c }); } else { save(); renderCone(); }
        if (on) say(v === "cur" ? "⧗ Зеркало вниз — только у колец выделенных строк (нет выделения — у текущей)." : "⧗ Зеркало вниз — у всех колец."); }; } }
  $("coneVoid").checked = Z.coneVoid !== false;   // v0.127: пустые кольца до 256 (видны при луч-часах)
  $("coneVoid").onchange = (e) => { Z.coneVoid = e.target.checked; save(); renderCone();
    say(Z.coneVoid ? "▦ До 256: за строкой для заполнения — пустые кольца до строки 256, луч идёт сквозь них и метит ячейки на пути: 1, 11, 111… Кольца строк стали тоньше — колесо мыши приближает." : "▦ Пустые кольца скрыты — только строки и строка для заполнения. Счёт в них сохранён."); };
  $("coneClock").checked = !!Z.coneClock;   // v0.116
  $("coneClock").onchange = (e) => {
    /* v0.208, по снимку «⌖ луч-часы» и «☀ солнце», горящих вместе, — «это либо-либо, и выделение так же»: при солнце луч-часы не горят,
       щелчок по ним — обратно к лазеру (солнце выключается, луч-часы остаются включены). */
    if (Z.coneSun && !e.target.checked) { e.target.checked = true; $("bConeSun").click(); return; }
    Z.coneClock = e.target.checked; coneClockFlash = []; coneClockWas = null; coneSunUi(); save(); renderCone(); coneLogRender();   // v0.127: включение — не проход
    if (Z.coneClock) say("⌖ Луч-часы: луч из центра через границы строки 1 проходит кольцо только в щель между битами, на бит — упирается в стену. Дошёл до края — «1» в ячейку строки для заполнения. Крути кольца (▶ по биту / навстречу или мышью) — щели будут сходиться."); };
  /* v0.222, «сделай кнопку — чистые кольца, без границ»: галка «◯ чистые» в «Виде» (Z.coneClean) — у колец нет контура (голубой внутри,
     оранжевый снаружи), нет прорезей между битами — ни у колец, ни у краски, ни у строки для заполнения; текущее кольцо — без обводки. */
  $("coneClean").checked = !!Z.coneClean;
  $("coneClean").onchange = (e) => { Z.coneClean = e.target.checked; save(); renderCone(); say(Z.coneClean ? "◯ Чистые кольца: без контура и прорезей между битами." : "◯ Кольца — снова с контуром и прорезями."); };
  $("conePoly").checked = !!Z.conePoly;   // v0.109
  $("conePoly").onchange = (e) => { Z.conePoly = e.target.checked; save(); renderCone();
    if (Z.conePoly) say("⬡ Этажи-многоугольники: строка из n бит — n-угольник, бит — сторона. 1 бит — точка в центре, 2 — две Г углом в центре (крест), 3 — треугольник, 4 — квадрат."); };
  $("cone3d").checked = !!Z.cone3d;   // v0.082
  $("cone3d").onchange = (e) => { Z.cone3d = e.target.checked; save(); renderCone(); };
  $("coneBit1").checked = !!Z.coneBit1;   // v0.318: ① 1-й бит каждой строки
  $("coneBit1").onchange = (e) => { Z.coneBit1 = e.target.checked; save(); renderCone(); say(Z.coneBit1 ? "① Первый бит каждой строки — в золотой обводке." : "① Первый бит больше не подсвечен."); };
  $("cone3Dig").checked = !!Z.cone3Dig;   // v0.251: цифры бит сбоку / сверху — вкл / выкл, по умолчанию выкл
  $("cone3Dig").onchange = (e) => { Z.cone3Dig = e.target.checked; save(); renderCone();
    say(Z.cone3Dig ? "01 В 3D при наклоне ровно 0° (сбоку) или 90° (сверху) на битах — их цифры." : "01 Цифры бит в 3D — выкл."); };
  $("cone3H").value = Z.cone3H ?? 1;
  $("cone3H").oninput = (e) => { Z.cone3H = +e.target.value; if (!Z.cone3d) { Z.cone3d = true; $("cone3d").checked = true; } renderCone(); };
  $("cone3H").onchange = () => save();
  $("cone3Bw").value = Z.cone3Bw ?? 1;   // v0.197
  $("cone3Bw").oninput = (e) => { Z.cone3Bw = +e.target.value; if (!Z.cone3d) { Z.cone3d = true; $("cone3d").checked = true; } renderCone(); };
  $("cone3Bw").onchange = () => save();
  $("cone3Bw").ondblclick = () => { Z.cone3Bw = 1; $("cone3Bw").value = 1; save(); renderCone(); };
  /* v0.157, «в поле конуса кнопки управления для 3D»: ⟲ ⟳ поворот по 15°, ▲ ▼ наклон по 10° (0…90, как мышью), − ＋ масштаб к центру,
     ⌂ — вид по умолчанию. Держишь кнопку — повторяется. Видны только в 3D (renderCone прячет). */
  const c3Do = (k) => {
    if (k === "yaw-" || k === "yaw+") Z.cone3Yaw = (Z.cone3Yaw ?? 30) + (k === "yaw+" ? 15 : -15);
    else if (k === "el+" || k === "el-") Z.cone3El = Math.max(0, Math.min(90, (Z.cone3El ?? 50) + (k === "el+" ? 10 : -10)));
    else if (k === "z+" || k === "z-") { const z1 = Math.max(0.3, Math.min(60, coneZoom * (k === "z+" ? 1.25 : 0.8))), q = z1 / coneZoom; conePan = [conePan[0] * q, conePan[1] * q]; coneZoom = z1; }
    else if (k === "home") { Z.cone3Yaw = 30; Z.cone3El = 50; coneZoom = 1; conePan = [0, 0]; }
    renderCone();
  };
  /* v0.179, по снимку пульта — «перемещаемым»: пульт тянут за ручку ⠿ (или за фон между кнопками) куда угодно по холсту; двойной
     щелчок по ручке — обратно в правый нижний угол. Место — Z.padPos { x, y } в пикселях от угла холста; меняет только перетаскивание. */
  { const P = $("cone3Pad"), host = P.parentElement;
    const place = () => {
      const p = Z.padPos; P.classList.toggle("moved", !!p);
      if (!p) { P.style.left = P.style.top = ""; return; }
      const x = Math.max(0, Math.min(p.x, host.clientWidth - P.offsetWidth)), y = Math.max(0, Math.min(p.y, host.clientHeight - P.offsetHeight));
      P.style.left = Math.round(x) + "px"; P.style.top = Math.round(y) + "px";
    };
    P.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || e.target.closest("button")) return;
      e.preventDefault(); e.stopPropagation(); try { P.setPointerCapture(e.pointerId); } catch (err) { /* уже отпущен */ }
      const r = P.getBoundingClientRect(), hr = host.getBoundingClientRect(), p0 = Z.padPos || { x: r.left - hr.left, y: r.top - hr.top }, x0 = e.clientX, y0 = e.clientY; let moved = false;
      const mv = (ev) => { if (!moved && Math.abs(ev.clientX - x0) + Math.abs(ev.clientY - y0) < 4) return; moved = true; Z.padPos = { x: p0.x + ev.clientX - x0, y: p0.y + ev.clientY - y0 }; place(); };
      const up = () => { P.removeEventListener("pointermove", mv); P.removeEventListener("pointerup", up); P.removeEventListener("pointercancel", up); if (moved) save(); };
      P.addEventListener("pointermove", mv); P.addEventListener("pointerup", up); P.addEventListener("pointercancel", up);
    });
    P.querySelector(".c3grip").addEventListener("dblclick", (e) => { e.stopPropagation(); if (!Z.padPos) return; delete Z.padPos; place(); save(); });
    place();
    if (window.ResizeObserver) new ResizeObserver(place).observe(host);
  }
  $("bC3d").onclick = () => $("cone3d").click();   // v0.270: 🧊 3D и ⧗ зеркало над пультом жмут те же галки «Вида»
  $("bC3Octa").onclick = () => $("coneOcta").click();
  $("cone3Pad").addEventListener("pointerdown", (e) => {
    const b = e.target.closest("button[data-c3]"); if (!b) return;
    e.preventDefault(); const k = b.dataset.c3;
    if (!Z.cone3d && k !== "allhome") return;   // v0.314: в плоском виде кнопки 3D видны, но приглушены и не жмутся
    if (k === "allhome") { $("bConeAllHome").click(); return; }   // v0.164, «сюда же «Всё на места» — значком, зелёным»
    c3Do(k);
    if (k === "home") { save(); return; }
    let t = setTimeout(function rep(){ c3Do(k); t = setTimeout(rep, 90); }, 400);
    const up = () => { clearTimeout(t); save(); removeEventListener("pointerup", up); removeEventListener("pointercancel", up); };
    addEventListener("pointerup", up); addEventListener("pointercancel", up);
  });
  cv.addEventListener("dblclick", (e) => { if (!Z.cone3d || !e.altKey) return; Z.cone3Yaw = 30; Z.cone3El = 50; coneZoom = 1; conePan = [0, 0]; save(); renderCone(); });
  $("coneSect").checked = !!Z.coneSect;   // v0.079
  $("coneSect").onchange = (e) => { Z.coneSect = e.target.checked; save(); renderCone(); };
  $("coneOnlySel").checked = !!Z.coneOnlySel;   // v0.076
  $("coneNoPick").checked = !!Z.coneNoPick;   // v0.281
  $("coneNoPick").onchange = (e) => { Z.coneNoPick = e.target.checked; if (Z.coneNoPick && coneHover !== -1) { coneHover = -1; coneHoverRow(-1); } save(); renderCone();
    say(Z.coneNoPick ? "🚫 Кольца на холсте не выбираются: щелчок, Ctrl + щелчок и наведение их не трогают. Сдвиг вида и Ctrl + тянуть — как были." : "◯ Кольца снова выбираются щелчком (Ctrl — выделить)."); };
  $("coneOnlySel").onchange = (e) => { Z.coneOnlySel = e.target.checked; save(); renderCone(); if (Z.coneOnlySel && !rowSel.size) say("◯ Выделенных колец нет — видно только текущее. Ctrl + щелчок по кольцу — выделить."); };
  $("coneLock").checked = Z.coneLock !== false;   // v0.055: по умолчанию включён
  // v0.259, «не должно быть разницы, по какому — общий сразу все открывает и снимает, стирая различие»: общий замок запирает / отпирает
  // все кольца разом — свои замки колец стираются (прежде кольцо со своим замком общий не слушал и было в золотой рамке)
  $("coneLock").onchange = (e) => { Z.coneLock = e.target.checked; Z.coneLocks = {}; save(); renderRows(); renderCone(); say(Z.coneLock ? "🔒 Все кольца заперты: крутятся только на вид, строки не сдвигаются." : "🔓 Все кольца открыты: тянешь кольцо (с Ctrl) — крутится и сама строка в поле."); };
  cv.addEventListener("contextmenu", (e) => { const h = coneRing(e); if (h !== -1 && h.fill !== undefined) { e.preventDefault(); fillReset(); } });   // v0.118: правый щелчок по кольцу для заполнения — заново
  $("coneRays").value = Z.coneRays || "off";
  $("coneRays").onchange = (e) => { Z.coneRays = e.target.value; save(); renderCone(); };
  // v0.049: колесо — масштаб вокруг курсора (точка под курсором остаётся на месте); двойной щелчок мимо колец — как было
  cv.addEventListener("wheel", (e) => {
    e.preventDefault();
    const r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    const mx = (e.clientX - r.left) * dpr - cv.width / 2, my = (e.clientY - r.top) * dpr - cv.height / 2;
    const z1 = Math.max(0.3, Math.min(60, coneZoom * Math.exp(-e.deltaY * 0.0015)));
    const k = z1 / coneZoom;
    conePan = [mx - (mx - conePan[0]) * k, my - (my - conePan[1]) * k];
    coneZoom = z1; renderCone();
  }, { passive: false });
  cv.addEventListener("dblclick", (e) => { if (!e.altKey) return; coneZoom = 1;   /* v0.173: сброс вида — Alt + двойной щелчок (Ctrl + щелчок меняет бит) */ conePan = [0, 0]; renderCone(); });
  if (window.ResizeObserver) new ResizeObserver(() => renderCone()).observe(cv);
}

/* ─── ▲ Пирамида Паскаля (v0.109) ──────────────────────────────────────────────────────────────
   Было предложено: «у Паскаля есть 3D-аналог — пирамида Паскаля, где каждое число — сумма трёх над ним; по модулю 2 из неё
   получается тетраэдр Серпинского: этажи-треугольники по правилу „XOR трёх соседей сверху“, смотреть в том же 3D». Этажи
   считает zzPyramid (zz-core.js). Затравка: «1» — тетраэдр Серпинского; текущая строка — нижним краем верхнего этажа (грань
   под ней — тот же треугольник, что строит 🔺+1); строки поля — верхним этажом целиком. Единица — точка; этаж k на высоте −k,
   клетка (a, b, c) — в точке a·A + b·B + c·C, где A, B, C — рёбра правильного тетраэдра из вершины. Мышь — как в 3D конуса. */
const PYR_ROWMAX = 160, PYR_MAXONES = 120000;
let pyrData = null, pyrZoom = 1, pyrPan = [0, 0], pyrDrawKey = "";
function pyrSeedLayer(){
  const mode = Z.pyrSeed || "one", bits = (s, len) => { const u = new Uint8Array(len); for (let a = 0; a < len && a < s.length; a++) u[a] = s[a] === "1" ? 1 : 0; return u; };
  if (mode === "row") {
    let s = cur() || "1"; const cut = s.length > PYR_ROWMAX; if (cut) s = s.slice(0, PYR_ROWMAX);
    const L = []; for (let r = 0; r < s.length; r++) L.push(new Uint8Array(r + 1));
    L[s.length - 1] = bits(s, s.length);
    return { L, key: "row|" + s, what: `строка ${Z.cur + 1} (${s.length} бит${cut ? ", взяты первые " + PYR_ROWMAX : ""}) — нижним краем верхнего этажа` };
  }
  if (mode === "tri") {
    // строки поля (выделенные, если их ≥ 2) — верхним этажом: строка i встаёт на место r = (длина первой − 1) + i
    let rows = rowSel.size >= 2 ? [...rowSel].sort((p, q) => p - q).map(i => Z.rows[i]).filter(Boolean) : Z.rows.slice();
    const r0 = Math.max(0, (rows[0] || "1").length - 1), cut = r0 + rows.length > PYR_ROWMAX;
    if (cut) rows = rows.slice(0, Math.max(1, PYR_ROWMAX - r0));
    const K = Math.min(PYR_ROWMAX, r0 + rows.length) - 1, L = [];
    for (let r = 0; r <= K; r++) L.push(r >= r0 && rows[r - r0] !== undefined ? bits(rows[r - r0], r + 1) : new Uint8Array(r + 1));
    const tb = zzTriBlock(rows);
    return { L, key: "tri|" + rows.join("|"), what: `${rowSel.size >= 2 ? "выделенные строки" : "все строки поля"} (${rows.length}) — верхним этажом` +
      (tb.ok ? "" : ` · длины не растут по 1 (сбой на строке ${tb.at + 1}) — строки дополнены нулями или обрезаны по месту`) };
  }
  return { L: [Uint8Array.of(1)], key: "one", what: "«1» — тетраэдр Серпинского" };
}
function pyrBuild(){
  const sd = pyrSeedLayer(), n = Math.max(1, Math.min(160, Z.pyrN ?? 32)), key = sd.key + "|" + n;
  if (pyrData && pyrData.key === key) return pyrData;
  const res = zzPyramid(sd.L, n, PYR_MAXONES), K0 = sd.L.length - 1;
  const s3 = 1 / Math.sqrt(3), hz = Math.sqrt(2 / 3), E = [90, 210, 330].map(d => [s3 * Math.cos(d * Math.PI / 180), s3 * Math.sin(d * Math.PI / 180)]);
  const pts = [], perLayer = [];
  res.layers.forEach((L, li) => {
    const k = K0 + li; let c = 0;
    for (let r = 0; r < L.length; r++) { const row = L[r];
      for (let a = 0; a <= r; a++) if (row[a]) { const b = r - a, cc = k - r; pts.push(a * E[0][0] + b * E[1][0] + cc * E[2][0], a * E[0][1] + b * E[1][1] + cc * E[2][1], -k * hz, li); c++; } }
    perLayer.push(c);
  });
  pyrData = { key, what: sd.what, layers: res.layers, K0, n: res.layers.length, want: n, cut: res.cut, ones: res.ones, pts: new Float32Array(pts), perLayer, hz, E };
  return pyrData;
}
function renderPyr(force){
  if (!winOpen("w-pyr")) return;
  const cv = $("pyrCv"); if (!cv) return;
  const R = cv.getBoundingClientRect(); if (R.width < 20 || R.height < 20) return;
  const dpr = window.devicePixelRatio || 1, W = Math.round(R.width * dpr), H = Math.round(R.height * dpr);
  const D = pyrBuild();
  const sl = $("pyrShow"); if (sl && +sl.max !== D.n) { sl.max = D.n; sl.value = Math.min(D.n, Z.pyrShow || D.n); }   // этажей стало другое число — ползунок среза за ним
  const c1 = coneCss("--b1", "#22d3ee"), cBg = coneCss("--panel2", "#11151d"), cg = coneCss("--gold", "#ffd166"), cT = coneCss("--txt", "#d8dde8");
  const show = Math.max(1, Math.min(D.n, Z.pyrShow || D.n)), one = !!Z.pyrOne && show <= D.n, hue = !!Z.pyrHue;
  const yawD = Z.pyrYaw ?? 30, elD = Z.pyrEl ?? 25;
  const dk = [D.key, W, H, show, one, hue, yawD, elD, pyrZoom, pyrPan.join(","), c1, cBg].join("|");
  if (!force && dk === pyrDrawKey) return;
  pyrDrawKey = dk;
  if (cv.width !== W) cv.width = W; if (cv.height !== H) cv.height = H;
  const g = cv.getContext("2d");
  g.fillStyle = cBg; g.fillRect(0, 0, W, H);
  const yaw = yawD * Math.PI / 180, el = elD * Math.PI / 180, cyw = Math.cos(yaw), syw = Math.sin(yaw), ce = Math.cos(el), se = Math.sin(el);
  const Kend = D.K0 + D.n - 1, zMid = -(D.K0 + Kend) / 2 * D.hz;
  const span = Math.max(Kend / Math.sqrt(3) + 1, (Kend - D.K0 + 1) * D.hz * 0.6 + Kend / Math.sqrt(3) * se, 2) * 1.08;
  const sc = (Math.min(W, H) / 2 - 8 * dpr) / span * pyrZoom, cx = W / 2 + pyrPan[0], cy = H / 2 + pyrPan[1];
  // наклон el: 0° — сбоку, 90° — сверху; ось пирамиды — вертикаль экрана
  const P = (x, y, z) => { const x1 = x * cyw - y * syw, y1 = x * syw + y * cyw, zz = z - zMid; return [cx + x1 * sc, cy - (zz * ce + y1 * se) * sc, zz * se - y1 * ce]; };
  // каркас: тетраэдр от вершины (этаж 0) до последнего этажа — штрихом
  const ap = P(0, 0, 0), cor = D.E.map(e => P(e[0] * Kend, e[1] * Kend, -Kend * D.hz));
  g.save(); g.strokeStyle = cg; g.globalAlpha = 0.35; g.lineWidth = Math.max(1, dpr); g.setLineDash([5 * dpr, 5 * dpr]); g.beginPath();
  for (const c of cor) { g.moveTo(ap[0], ap[1]); g.lineTo(c[0], c[1]); }
  for (let q = 0; q < 3; q++) { g.moveTo(cor[q][0], cor[q][1]); g.lineTo(cor[(q + 1) % 3][0], cor[(q + 1) % 3][1]); }
  g.stroke(); g.restore();
  // точки — по глубине, дальние раньше
  const T = D.pts, cnt = T.length / 4, idx = [], sx = new Float32Array(cnt), sy = new Float32Array(cnt), sz = new Float32Array(cnt);
  for (let q = 0; q < cnt; q++) {
    const li = T[q * 4 + 3]; if (one ? li !== show - 1 : li >= show) continue;
    const p = P(T[q * 4], T[q * 4 + 1], T[q * 4 + 2]); sx[q] = p[0]; sy[q] = p[1]; sz[q] = p[2]; idx.push(q);
  }
  idx.sort((p, q) => sz[p] - sz[q]);
  let zMin = Infinity, zMax = -Infinity; for (const q of idx) { if (sz[q] < zMin) zMin = sz[q]; if (sz[q] > zMax) zMax = sz[q]; }
  const rad = Math.max(0.7 * dpr, 0.42 * sc), round = rad >= 2 * dpr;
  g.fillStyle = c1;
  for (const q of idx) {
    const lit = zMax > zMin ? 0.35 + 0.65 * (sz[q] - zMin) / (zMax - zMin) : 1;
    if (hue) g.fillStyle = `hsl(${Math.round(200 + 300 * T[q * 4 + 3] / Math.max(1, D.n))} 80% 60%)`;
    g.globalAlpha = lit;
    if (round) { g.beginPath(); g.arc(sx[q], sy[q], rad, 0, 2 * Math.PI); g.fill(); } else g.fillRect(sx[q] - rad, sy[q] - rad, 2 * rad, 2 * rad);
  }
  g.globalAlpha = 0.7; g.fillStyle = cT; g.font = `${Math.round(11 * dpr)}px system-ui, sans-serif`;
  g.fillText(`поворот ${Math.round(((yawD % 360) + 360) % 360)}° · наклон ${Math.round(elD)}°`, 8 * dpr, 16 * dpr);
  g.globalAlpha = 1;
  // текст
  const kShow = D.K0 + show - 1, onesK = D.perLayer[show - 1], pc = kShow.toString(2).split("").filter(x => x === "1").length;
  const shownOnes = one ? onesK : D.perLayer.slice(0, show).reduce((s, x) => s + x, 0);
  $("pyrOut").innerHTML = `Затравка: ${esc(D.what)}. Этажей ${D.n} (k = ${D.K0}…${Kend})` + (D.cut ? ` — остановлено на ${D.n} из ${D.want}: больше ${PYR_MAXONES} единиц не рисую` : "") + `.\n` +
    (one ? `Показан один этаж k = ${kShow}` : show < D.n ? `Показаны этажи до k = ${kShow}` : "Показаны все этажи") + `: единиц <b>${shownOnes}</b>` + (one ? "" : ` из ${D.ones}`) + `. На этаже k = ${kShow} единиц <b>${onesK}</b>` +
    ((Z.pyrSeed || "one") === "one" ? ` = 3^${pc} (в двоичной записи ${kShow} = ${kShow.toString(2)} единиц ${pc}) — у тетраэдра Серпинского всегда так.` : ".");
}
/* v0.270, по снимку полосы прокрутки вплотную к номерам строк — «этот скролл перемести влево конуса»: у колонки слева от поля строк
   (стол с конусом при «⇆ поле справа», левая панель) полоса прокрутки стояла справа — между ней и номерами. Теперь полоса — у левого
   края колонки: родная спрятана (прокрутка колесом та же), своя тонкая — слева; бегунок тянется, щелчок по полосе — на экран выше/ниже,
   колесо над ней крутит колонку. Направление письма (rtl) не трогаем: окна на столе стоят от левого края, rtl увёл бы их за край. */
function leftBarsInit(){
  const mk = (el, id, when, off) => {
    if (!el) return;
    const bar = document.createElement("div"); bar.id = id; bar.className = "lbar"; bar.innerHTML = "<i></i>"; document.body.appendChild(bar);
    const th = bar.firstChild; let raf = 0, h = 24;
    const upd = () => {
      raf = 0;
      const want = when();
      el.classList.toggle("lbarOn", want);
      const on = want && el.getClientRects().length && el.scrollHeight > el.clientHeight + 1;
      if (!on) { bar.style.display = "none"; return; }
      const r = el.getBoundingClientRect(), ch = el.clientHeight, sh = el.scrollHeight;
      h = Math.max(24, ch * ch / sh);
      bar.style.cssText = `display:block;left:${Math.round(r.left + (off ? off() : 0))}px;top:${Math.round(r.top)}px;height:${ch}px`;
      th.style.cssText = `height:${Math.round(h)}px;transform:translateY(${Math.round((ch - h) * el.scrollTop / (sh - ch))}px)`;
    };
    const q = () => { if (!raf) raf = requestAnimationFrame(upd); };
    el.addEventListener("scroll", q); addEventListener("resize", q);
    if (window.ResizeObserver) new ResizeObserver(q).observe(el);
    new MutationObserver(q).observe(document.body, { attributes: true, attributeFilter: ["class"] });
    new MutationObserver(q).observe(el, { attributes: true, attributeFilter: ["style", "class"], subtree: true, childList: true });
    bar.addEventListener("wheel", (e) => { e.preventDefault(); el.scrollTop += e.deltaY; }, { passive: false });
    bar.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return; e.preventDefault(); e.stopPropagation();
      if (e.target !== th) { const tr = th.getBoundingClientRect(); el.scrollTop += (e.clientY < tr.top ? -1 : 1) * el.clientHeight * 0.9; return; }
      const y0 = e.clientY, s0 = el.scrollTop, k = (el.scrollHeight - el.clientHeight) / Math.max(1, el.clientHeight - h);
      bar.setPointerCapture(e.pointerId); bar.classList.add("drag");
      const mv = (ev) => { el.scrollTop = s0 + (ev.clientY - y0) * k; };
      const up = () => { bar.removeEventListener("pointermove", mv); bar.removeEventListener("pointerup", up); bar.removeEventListener("pointercancel", up); bar.classList.remove("drag"); };
      bar.addEventListener("pointermove", mv); bar.addEventListener("pointerup", up); bar.addEventListener("pointercancel", up);
    });
    q();
  };
  const B = document.body;
  /* v0.272, «скролл и граница — друг на друге»: у левого края стола — хват ширины левой панели (#paneEdge, 3 px в стол); полоса — правее него */
  const paneEdgeR = () => { const e = $("paneEdge"); if (!e || !e.getClientRects().length) return 0; return Math.max(0, Math.ceil(e.getBoundingClientRect().right - $("desk").getBoundingClientRect().left) + 1); };
  mk($("desk"), "deskBar", () => B.classList.contains("field-right") && !B.classList.contains("zen"), paneEdgeR);
  mk($("rowsPane"), "paneBar", () => !B.classList.contains("zen"));
}
function setupPyr(){
  const cv = $("pyrCv"); if (!cv) return;
  cv.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault(); cv.setPointerCapture(e.pointerId);
    const x0 = e.clientX, y0 = e.clientY, yw0 = Z.pyrYaw ?? 30, el0 = Z.pyrEl ?? 25, p0 = pyrPan.slice(), dpr = window.devicePixelRatio || 1, ctrl = e.ctrlKey;
    cv.style.cursor = ctrl ? "move" : "grabbing";
    const mv = (ev) => {
      if (ctrl) pyrPan = [p0[0] + (ev.clientX - x0) * dpr, p0[1] + (ev.clientY - y0) * dpr];
      else { Z.pyrYaw = yw0 + (ev.clientX - x0) * 0.5; Z.pyrEl = Math.max(-90, Math.min(90, el0 + (ev.clientY - y0) * 0.4)); }
      renderPyr();
    };
    const up = () => { cv.removeEventListener("pointermove", mv); cv.removeEventListener("pointerup", up); cv.removeEventListener("pointercancel", up); cv.style.cursor = "grab"; save(); };
    cv.addEventListener("pointermove", mv); cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
  });
  cv.addEventListener("wheel", (e) => {
    e.preventDefault();
    const r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    const mx = (e.clientX - r.left) * dpr - cv.width / 2, my = (e.clientY - r.top) * dpr - cv.height / 2;
    const z1 = Math.max(0.3, Math.min(60, pyrZoom * Math.exp(-e.deltaY * 0.0015))), k = z1 / pyrZoom;
    pyrPan = [mx - (mx - pyrPan[0]) * k, my - (my - pyrPan[1]) * k]; pyrZoom = z1; renderPyr();
  }, { passive: false });
  cv.addEventListener("dblclick", () => { Z.pyrYaw = 30; Z.pyrEl = 25; pyrZoom = 1; pyrPan = [0, 0]; save(); renderPyr(); });
  const cutUi = () => { const n = pyrData ? pyrData.n : (Z.pyrN ?? 32); $("pyrShow").max = n; $("pyrShow").value = Math.min(n, Z.pyrShow || n); };
  $("pyrSeed").value = Z.pyrSeed || "one";
  $("pyrSeed").onchange = (e) => { Z.pyrSeed = e.target.value; Z.pyrShow = 0; save(); renderPyr(); cutUi();
    say({ one: "▲ От «1»: тетраэдр Серпинского — каждый этаж треугольник, клетка = XOR трёх соседей этажом выше.", row: "▲ От строки: текущая строка — нижний край верхнего этажа. Грань под ней растёт, как 🔺+1 от этой строки.", tri: "▲ От строк поля: весь столбик (или выделенные ≥ 2) — верхний этаж; лучше всего — треугольник, у которого длины растут по 1." }[Z.pyrSeed]); };
  $("pyrN").value = Z.pyrN ?? 32;
  $("pyrN").oninput = (e) => { Z.pyrN = +e.target.value; Z.pyrShow = 0; $("pyrNv").textContent = Z.pyrN; renderPyr(); cutUi(); };
  $("pyrN").onchange = () => save();
  $("pyrNv").textContent = Z.pyrN ?? 32;
  $("pyrShow").oninput = (e) => { Z.pyrShow = +e.target.value; renderPyr(); };
  $("pyrShow").onchange = () => save();
  $("pyrOne").checked = !!Z.pyrOne;
  $("pyrOne").onchange = (e) => { Z.pyrOne = e.target.checked; save(); renderPyr(); };
  $("pyrHue").checked = !!Z.pyrHue;
  $("pyrHue").onchange = (e) => { Z.pyrHue = e.target.checked; save(); renderPyr(); };
  // ▶ расти — этажи появляются по одному; ⟳ крутить — пирамида вертится вокруг оси
  let growRaf = 0, growT = 0, spinRaf = 0, spinT = 0;
  const growStop = () => { if (growRaf) cancelAnimationFrame(growRaf); growRaf = 0; $("bPyrGrow").classList.remove("on"); $("bPyrGrow").textContent = "▶ расти"; save(); };
  const growTick = (ts) => {
    if (!growRaf) return;
    if (!growT) growT = ts;
    const n = pyrData ? pyrData.n : 1, k = Math.min(n, 1 + Math.floor((ts - growT) / 1000 * Math.max(4, n / 6)));
    if (k !== Z.pyrShow) { Z.pyrShow = k; $("pyrShow").value = k; renderPyr(); }
    if (k >= n) { growStop(); return; }
    growRaf = requestAnimationFrame(growTick);
  };
  $("bPyrGrow").onclick = () => { if (growRaf) { growStop(); return; } pyrBuild(); cutUi(); growT = 0; Z.pyrShow = 1; growRaf = requestAnimationFrame(growTick); $("bPyrGrow").classList.add("on"); $("bPyrGrow").textContent = "⏸ стоп"; };
  const spinTick = (ts) => {
    if (!spinRaf) return;
    const dt = spinT ? Math.min(0.1, (ts - spinT) / 1000) : 0; spinT = ts;
    Z.pyrYaw = ((Z.pyrYaw ?? 30) + 25 * dt) % 360; renderPyr();
    spinRaf = requestAnimationFrame(spinTick);
  };
  $("bPyrSpin").onclick = () => {
    if (spinRaf) { cancelAnimationFrame(spinRaf); spinRaf = 0; save(); $("bPyrSpin").classList.remove("on"); return; }
    spinT = 0; spinRaf = requestAnimationFrame(spinTick); $("bPyrSpin").classList.add("on");
  };
  $("bPyrOut").onclick = () => {
    const D = pyrBuild(), show = Math.max(1, Math.min(D.n, Z.pyrShow || D.n)), L = D.layers[show - 1], k = D.K0 + show - 1;
    const rows = L.map(row => Array.from(row).join(""));
    snapshot();
    Z.rows.splice(Z.cur + 1, 0, ...rows); Z.cur += 1;
    renderAll(); save();
    say(`⤓ Этаж k = ${k} — в поле: ${rows.length} строк (длины 1…${rows.length}) под бывшей текущей. Последняя из них — грань пирамиды. ↩ вернёт.`);
  };
  if (window.ResizeObserver) new ResizeObserver(() => renderPyr()).observe(cv);
  requestAnimationFrame(cutUi);
}

/* ─── ✦ Развёртка октаэдра (v0.398) ──────────────────────────────────────────────────────────────
   «Разложи октаэдр на плоскость, разные варианты центровки вершин и рёбер» → «развёртку добавь в Зазеркалье». Октаэдр — как в окне
   «◆ Октаэдр»: T — верх, B — низ, E0…E3 — экватор; грань Ui = (T, Ei, Ei+1), Di = (B, Ei, Ei+1). Развёртка — дерево склеек граней:
   первая (U0) кладётся вершиной вверх, каждая следующая — отражением соседней через общее ребро. Строка k поля — ряд k грани от её
   вершины (T или B), в нём k + 1 бит (короче — нули, длиннее — лишнее не влезает); у нижних граней биты инвертированы, а зеркальность
   выходит сама — нижняя грань ложится отражением верхней. Центр варианта (вершина, середина ребра, середина грани) — в центре холста. */
const RAZV_V = [
  [[["U0","U1"],["U1","U2"],["U2","U3"],["U0","D0"],["U1","D1"],["U2","D2"],["U3","D3"]], ["v", "U0", "T"]],
  [[["U0","U1"],["U1","D1"],["U0","D0"],["U1","U2"],["U0","U3"],["D1","D2"],["D0","D3"]], ["v", "U0", "E1"]],
  [[["U0","D0"],["U0","U1"],["U0","U3"],["D0","D1"],["D0","D3"],["U1","U2"],["D3","D2"]], ["e", "U0", "E0", "E1"]],
  [[["U0","U1"],["U0","D0"],["U1","D1"],["U1","U2"],["U0","U3"],["U2","D2"],["U3","D3"]], ["e", "U0", "T", "E1"]],
  [[["U0","U1"],["U0","U3"],["U0","D0"],["U1","D1"],["D1","D2"],["D2","D3"],["D2","U2"]], ["f", "U0"]],
  [[["U0","D0"],["D0","D1"],["D1","U1"],["U1","U2"],["U2","D2"],["D2","D3"],["D3","U3"]], ["e", "U1", "T", "E2"]],
];
/* v0.408, «и развёртку Зеркалидуса»: тело развёртки — Зеркалидус (3 грани у половины, 6 всего; знак Zerkalius) или октаэдр (4, 8) —
   кнопки «△ Зеркалидус» / «◇ Октаэдр» (Z.razvNB, по умолчанию 3). Грань Ui = (T, Ei, Ei+1), Di = (B, Ei, Ei+1) при своём числе Ei; у
   каждого тела — свой набор вариантов (RAZV_SETS). Оси — пары вершин с серединой в центре: у Зеркалидуса одна, Верх–Низ (углы
   экватора все соседние), у октаэдра три. Вершина без оси — серая точка. */
const RAZV_V3 = [
  [[["U0","U1"],["U1","U2"],["U0","D0"],["U1","D1"],["U2","D2"]], ["v", "U0", "T"]],
  [[["U0","U1"],["U1","D1"],["U0","D0"],["U1","U2"],["D1","D2"]], ["v", "U0", "E1"]],
  [[["U0","D0"],["U0","U1"],["U0","U2"],["D0","D1"],["D0","D2"]], ["e", "U0", "E0", "E1"]],
  [[["U0","U1"],["U0","D0"],["U1","D1"],["U1","U2"],["U2","D2"]], ["e", "U0", "T", "E1"]],
  [[["U0","U1"],["U0","U2"],["U0","D0"],["U1","D1"],["U2","D2"]], ["f", "U0"]],
  [[["U0","D0"],["D0","D1"],["D1","U1"],["U1","U2"],["U2","D2"]], ["e", "U1", "T", "E2"]],
];
const RAZV_NAME3 = ["А · центр — вершина T (веер из трёх)", "Б · центр — вершина экватора", "В · центр — ребро экватора (зеркало)", "Г · центр — боковое ребро",
  "Д · центр — грань U0 (большой треугольник и два)", "Е · лента из 6 граней"];
const razvSet = () => (Z.razvNB === 4 ? { nb: 4, V: RAZV_V, N: RAZV_NAME } : { nb: 3, V: RAZV_V3, N: RAZV_NAME3 });
function razvUnfold(tree, nb){
  nb = nb || 4;
  const F = {}; for (let i = 0; i < nb; i++) { const a = "E" + i, b = "E" + ((i + 1) % nb); F["U" + i] = ["T", a, b]; F["D" + i] = ["B", a, b]; }
  const s3 = Math.sqrt(3) / 2, pos = { U0: { T: [0, 0], E0: [-0.5, s3], E1: [0.5, s3] } }, todo = tree.slice();
  while (todo.length) {
    const i = todo.findIndex(([p, c]) => pos[p] && !pos[c]); if (i < 0) break;
    const [p, c] = todo.splice(i, 1)[0], sh = F[p].filter(v => F[c].includes(v)), P = pos[p];
    const o = F[p].find(v => !sh.includes(v)), n = F[c].find(v => !sh.includes(v));
    const [x1, y1] = P[sh[0]], [x2, y2] = P[sh[1]], [ox, oy] = P[o], dx = x2 - x1, dy = y2 - y1;
    const t = ((ox - x1) * dx + (oy - y1) * dy) / (dx * dx + dy * dy), fx = x1 + t * dx, fy = y1 + t * dy;
    pos[c] = { [sh[0]]: P[sh[0]], [sh[1]]: P[sh[1]], [n]: [2 * fx - ox, 2 * fy - oy] };
  }
  return { F, pos };
}
/* v0.405, «развёртку покажи малыми картинками все сразу, и при выборе одной из них — крупно; выпадающий список не нужен»: над холстом —
   шесть маленьких развёрток (щелчок — эта крупно, выбранная в золотой рамке, имя варианта — в подсказке), крупная — на холсте, как было.
   Рисует одна razvDraw: у малой нет подписей, крест мельче, биты — только если клетка не мельче 1,2 px (иначе грани заливкой). Малые
   перерисовываются, только когда поменялись строки, цвета или размер (razvThumbKey). */
const RAZV_NAME = ["А · центр — вершина T", "Б · центр — вершина экватора", "В · центр — ребро экватора (зеркало)", "Г · центр — боковое ребро",
  "Д · два больших треугольника", "Е · лента из 8 граней"];
function razvDraw(cv, vi, big){
  const dpr = window.devicePixelRatio || 1, W = Math.max(20, cv.clientWidth), H = Math.max(20, cv.clientHeight);
  if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  const g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
  const RS = razvSet(), own = razvOwnOf(vi);
  /* v0.438: своя развёртка (vi = "o<номер>") — список граней {u — верхняя, P — [вершина, левая, правая]}; центр — середина охвата */
  let tree = [], C = null, F = {}, pos = {}, faces, cx, cy;
  if (own) {
    faces = own.f.map((f, i) => ({ n: (f.u ? "U" : "D") + own.f.slice(0, i).filter(q => !!q.u === !!f.u).length, up: !!f.u, P: f.P, ap: f.u ? "T" : "B" }));
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const f of faces) for (const [x, y] of f.P) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    cx = (x0 + x1) / 2; cy = (y0 + y1) / 2;
  } else {
    [tree, C] = RS.V[vi] || RS.V[0]; ({ F, pos } = razvUnfold(tree, RS.nb));   // v0.408: тело — Зеркалидус или октаэдр
    faces = Object.keys(pos).map(f => ({ n: f, up: f[0] === "U", P: F[f].map(v => pos[f][v]), ap: F[f][0] }));
    if (C[0] === "v") [cx, cy] = pos[C[1]][C[2]];
    else if (C[0] === "e") { const a = pos[C[1]][C[2]], b = pos[C[1]][C[3]]; cx = (a[0] + b[0]) / 2; cy = (a[1] + b[1]) / 2; }
    else { const P = Object.values(pos[C[1]]); cx = (P[0][0] + P[1][0] + P[2][0]) / 3; cy = (P[0][1] + P[1][1] + P[2][1]) / 3; }
  }
  let ex = 0.01, ey = 0.01;
  for (const f of faces) for (const [x, y] of f.P) { ex = Math.max(ex, Math.abs(x - cx)); ey = Math.max(ey, Math.abs(y - cy)); }
  const pad = big ? 14 : 4, k = Math.min((W / 2 - pad) / ex, (H / 2 - pad) / ey), T = ([x, y]) => [W / 2 + (x - cx) * k, H / 2 + (y - cy) * k];
  if (big) razvXf = { cx, cy, k, W, H, own: own ? vi : null };   // v0.438: для щелчков по своей развёртке
  const cs = getComputedStyle(document.documentElement), cU = cs.getPropertyValue("--acc2").trim() || "#4dd4ff", cD = cs.getPropertyValue("--gold").trim() || "#e8b64a";
  const L = Z.rows.map(s => String(s).replace(/[^01]/g, "")), R0 = Math.max(2, Math.min(160, L.length));
  const RB = big && Z.razvRomb ? razvRombs() : null, nRB = RB ? RB.list.length : 0;   // v0.440: ◇ ромбы из кадров
  const R = nRB ? RB.h + 1 : R0;
  const cell = k / R, rad1 = Math.max(0.7, cell * 0.3), rad0 = cell * 0.12, lbl = big && Z.razvLbl !== false, dots = big || cell >= 1.2;
  for (const fc of faces) {
    const f = fc.n, up = fc.up, col = up ? cU : cD, [A, Lv, Rv] = fc.P.map(T);
    const rb = nRB ? RB.list[(razvRombSeq + (parseInt(f.slice(1), 10) || 0)) % nRB] : null;   // v0.440: ромб пары граней
    g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(Lv[0], Lv[1]); g.lineTo(Rv[0], Rv[1]); g.closePath();
    g.globalAlpha = dots ? 0.1 : 0.3; g.fillStyle = col; g.fill(); g.globalAlpha = 1; g.strokeStyle = col; g.lineWidth = big ? 1.4 : 1; g.stroke();
    if (dots) {
      g.fillStyle = col;
      for (let r = 0; r < R; r++) {
        const row = rb ? (up ? rb.u : rb.d)[r] : (L[r] || "");
        for (let q = 0; q <= r; q++) {
          const v = rb ? row[q] : (row[q] === "1" ? 1 : 0) ^ (up ? 0 : 1);   // v0.440: у ромба низ — свой, без инверсии
          if (!v && rad0 < 0.8) continue;
          const a = (r - q + 1 / 3) / R, b = (q + 1 / 3) / R, x = A[0] + a * (Lv[0] - A[0]) + b * (Rv[0] - A[0]), y = A[1] + a * (Lv[1] - A[1]) + b * (Rv[1] - A[1]);
          g.globalAlpha = v ? 1 : 0.3;
          const rd = v ? rad1 : rad0;
          if (rd < 1.6) g.fillRect(x - rd, y - rd, 2 * rd, 2 * rd); else { g.beginPath(); g.arc(x, y, rd, 0, 2 * Math.PI); g.fill(); }
        }
      }
      g.globalAlpha = 1;
    }
    if (lbl) {
      const mx = (A[0] + Lv[0] + Rv[0]) / 3 + (Lv[0] + Rv[0] - 2 * A[0]) / 6 * 0.55, my = (A[1] + Lv[1] + Rv[1]) / 3 + (Lv[1] + Rv[1] - 2 * A[1]) / 6 * 0.55;
      g.font = "bold 12px system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
      g.lineWidth = 3; g.strokeStyle = "rgba(0,0,0,.75)"; g.strokeText(f, mx, my); g.fillStyle = "#e6edf3"; g.fillText(f, mx, my);
      g.textAlign = "left"; g.font = "11px system-ui, sans-serif"; g.strokeText(fc.ap, A[0] + 4, A[1] - 5); g.fillStyle = "#ff9a9a"; g.fillText(fc.ap, A[0] + 4, A[1] - 5);
    }
  }
  /* v0.406, «и в развёртке оси покажи»: у октаэдра грани со общим ребром — ромб, его дальние углы — противоположные вершины (концы оси).
     Через каждую склейку дерева развёртки — штрих между ними цветом оси: Верх–Низ светлая, E0–E2 розовая, E1–E3 зелёная; все вершины
     развёртки — точки цвета своей оси (одна вершина тела на развёртке бывает в нескольких местах). Только на крупной, кнопка «✛ оси». */
  if (own) return;   // v0.438: у своей развёртки ни осей (нет дерева склеек), ни креста центра
  if (big && Z.razvAx !== false) {
    // v0.408: ось — пара вершин с серединой в центре тела (у Зеркалидуса только Верх–Низ); вершина без оси — серая
    const P3 = { T: [0, 1, 0], B: [0, -1, 0] }; for (let i = 0; i < RS.nb; i++) P3["E" + i] = [Math.cos(2 * Math.PI * i / RS.nb), 0, Math.sin(2 * Math.PI * i / RS.nb)];
    const opp = (a, b) => Math.hypot(P3[a][0] + P3[b][0], P3[a][1] + P3[b][1], P3[a][2] + P3[b][2]) < 1e-6;
    const AXC0 = { T: "#e8edf5", B: "#e8edf5", E0: "#ff7ab6", E2: "#ff7ab6", E1: "#6ee7a0", E3: "#6ee7a0" };
    const AXC = {}; for (const k of Object.keys(P3)) AXC[k] = Object.keys(P3).some(o => o !== k && opp(k, o)) ? AXC0[k] : "#8b949e";
    g.save(); g.lineCap = "round"; g.lineWidth = 1.8; g.setLineDash([7, 5]); g.globalAlpha = 0.9;
    for (const [p, c] of tree) {
      const sh = F[p].filter(v => F[c].includes(v)), o = F[p].find(v => !sh.includes(v)), n = F[c].find(v => !sh.includes(v));
      if (!opp(o, n)) continue;
      const a = T(pos[p][o]), b = T(pos[c][n]);
      g.strokeStyle = AXC[o]; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
    }
    g.setLineDash([]); g.globalAlpha = 1;
    for (const f of Object.keys(pos)) for (const v of F[f]) { const q = T(pos[f][v]); g.fillStyle = AXC[v]; g.beginPath(); g.arc(q[0], q[1], 3.4, 0, 2 * Math.PI); g.fill(); }
    g.restore();
  }
  const m = big ? 9 : 4;
  g.strokeStyle = "#ff3b3b"; g.lineWidth = big ? 2.5 : 1.5; g.beginPath(); g.moveTo(W / 2 - m, H / 2); g.lineTo(W / 2 + m, H / 2); g.moveTo(W / 2, H / 2 - m); g.lineTo(W / 2, H / 2 + m); g.stroke();
}
let razvThumbKey = "", razvXf = null;
/* v0.438, по снимку развёртки Зеркалидуса с Серпинским — «добавь свою развёртку: из имеющихся создаёт копию, потом при клике по треугольнику
   просто копирует его по всем трём граням — зеркалит; если по грани (ребру) ткнуть — по этой грани зеркалит». Свои — Z.razvOwn [{nb, f: [{u, P}]}],
   u — верхняя (голубая, вершина T) или нижняя (золотая, B, биты инвертированы), P — [вершина, левая, правая] в единицах ребра. Зеркало грани
   через ребро — отражение всех трёх её точек (порядок тот же — биты ложатся зеркально). Через основание (левая–правая) род меняется: верхняя ↔
   нижняя, как U0 ↔ D0 через экватор; через боковое ребро — тот же род, как U0 ↔ U1. На место, где грань уже есть, копия не ложится. Выбранная
   — Z.razvV = "o<номер>"; миниатюры своих — после шести обычных, правый щелчок по ней — удалить. */
const razvOwnOf = (v) => (typeof v === "string" && v[0] === "o" && Array.isArray(Z.razvOwn) && Z.razvOwn[+v.slice(1)]) || null;
const razvCur = () => { const RS = razvSet(); return razvOwnOf(Z.razvV) ? Z.razvV : Math.min(RS.V.length - 1, Math.max(0, Z.razvV | 0)); };
function razvMirror(f, a, b){   // грань f через её ребро (a, b — номера вершин)
  const [x1, y1] = f.P[a], [x2, y2] = f.P[b], dx = x2 - x1, dy = y2 - y1, L = dx * dx + dy * dy;
  const P = f.P.map(([x, y]) => { const t = ((x - x1) * dx + (y - y1) * dy) / L, fx = x1 + t * dx, fy = y1 + t * dy; return [+(2 * fx - x).toFixed(6), +(2 * fy - y).toFixed(6)]; });
  return { u: (a === 1 && b === 2) ? (f.u ? 0 : 1) : (f.u ? 1 : 0), P };
}
const razvCen = (f) => [(f.P[0][0] + f.P[1][0] + f.P[2][0]) / 3, (f.P[0][1] + f.P[1][1] + f.P[2][1]) / 3];
const razvFree = (own, nf) => { const c = razvCen(nf); return !own.f.some(f => { const q = razvCen(f); return Math.hypot(q[0] - c[0], q[1] - c[1]) < 0.05; }); };
function renderRazv(){
  const cv = $("razvCv"), tb = $("razvThumbs"); if (!cv || !tb) return;
  $("bRazvLbl").classList.toggle("on", Z.razvLbl !== false);   // v0.399: галка → кнопка
  $("bRazvAx").classList.toggle("on", Z.razvAx !== false);   // v0.406
  const RS = razvSet(), OW = Array.isArray(Z.razvOwn) ? Z.razvOwn : [];
  const tk = RS.nb + "/" + OW.length;
  if (tb.dataset.nb !== tk) {
    tb.dataset.nb = tk; razvThumbKey = "";
    tb.innerHTML = RS.V.map((_, i) => `<canvas data-v="${i}" title="${RS.N[i]} — щелчок: крупно"></canvas>`).join("")
      + OW.map((_, i) => `<canvas data-v="o${i}" class="own" title="Своя ${i + 1} — щелчок: крупно и править (щелчок по треугольнику — зеркала через три ребра, у ребра — через него; правый — убрать треугольник). Правый щелчок здесь — удалить свою">`).join("");
  }
  $("bRazv3").classList.toggle("on", RS.nb === 3); $("bRazv4").classList.toggle("on", RS.nb === 4);   // v0.408
  const vi = razvCur();
  [...tb.children].forEach(c => c.classList.toggle("on", c.dataset.v === String(vi)));
  cv.style.cursor = razvOwnOf(vi) ? "crosshair" : "";
  if (!winOpen("w-razv")) return;
  razvDraw(cv, vi, true);
  const cs = getComputedStyle(document.documentElement), key = Z.rows.join("|") + "/" + cs.getPropertyValue("--acc2") + cs.getPropertyValue("--gold") + "/" + (window.devicePixelRatio || 1) + "/" + tb.clientWidth + "/" + (Z.razvOwnV | 0);
  if (key !== razvThumbKey) { razvThumbKey = key; [...tb.children].forEach(c => razvDraw(c, c.classList.contains("own") ? c.dataset.v : +c.dataset.v, false)); }
}
if ($("bRazvOwn")) $("bRazvOwn").onclick = () => {   // v0.438: копия выбранной (обычной или своей) — новой своей
  const RS = razvSet(), vi = razvCur(), src = razvOwnOf(vi);
  let f;
  if (src) f = src.f.map(q => ({ u: q.u, P: q.P.map(p => p.slice()) }));
  else { const { F, pos } = razvUnfold(RS.V[vi][0], RS.nb); f = Object.keys(pos).map(n => ({ u: n[0] === "U" ? 1 : 0, P: F[n].map(v => pos[n][v].map(x => +x.toFixed(6))) })); }
  if (!Array.isArray(Z.razvOwn)) Z.razvOwn = [];
  Z.razvOwn.push({ nb: RS.nb, f }); Z.razvV = "o" + (Z.razvOwn.length - 1); Z.razvOwnV = (Z.razvOwnV | 0) + 1;
  save(); renderRazv(); say(`✦ Своя развёртка ${Z.razvOwn.length} — копия. Щелчок по треугольнику — зеркала через три ребра, у ребра — через него, правый — убрать.`);
};
if ($("razvCv")) {
  const cv = $("razvCv");
  cv.addEventListener("contextmenu", (e) => { if (razvOwnOf(razvCur())) e.preventDefault(); });
  cv.addEventListener("pointerdown", (e) => {
    const vi = razvCur(), own = razvOwnOf(vi), X = razvXf; if (!own || !X || X.own !== vi) return;
    const b = cv.getBoundingClientRect(), px = e.clientX - b.left, py = e.clientY - b.top;
    const U = (p) => [X.W / 2 + (p[0] - X.cx) * X.k, X.H / 2 + (p[1] - X.cy) * X.k];   // единицы → пиксели
    const inside = (f) => { const [A, B, C] = f.P.map(U), s = (p, q, w) => (p[0] - w[0]) * (q[1] - w[1]) - (q[0] - w[0]) * (p[1] - w[1]), P = [px, py], d1 = s(P, A, B), d2 = s(P, B, C), d3 = s(P, C, A); return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0)); };
    const segD = (p, q) => { const L = (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2, t = Math.max(0, Math.min(1, ((px - p[0]) * (q[0] - p[0]) + (py - p[1]) * (q[1] - p[1])) / L)); return Math.hypot(px - p[0] - t * (q[0] - p[0]), py - p[1] - t * (q[1] - p[1])); };
    const done = (n) => { Z.razvOwnV = (Z.razvOwnV | 0) + 1; save(); renderRazv(); if (!n) say("✦ Туда уже есть треугольники — зеркало не легло."); };
    if (e.button === 2) {   // убрать треугольник (последний — нет)
      const i = own.f.findIndex(inside); if (i < 0 || own.f.length < 2) return;
      own.f.splice(i, 1); done(1); return;
    }
    if (e.button !== 0) return;
    // у ребра (ближе 7 px) — зеркало через это ребро той грани, у которой по ту сторону пусто
    const near = [];
    for (const f of own.f) for (const [a, c] of [[0, 1], [0, 2], [1, 2]]) { const d = segD(U(f.P[a]), U(f.P[c])); if (d < 7) near.push([d, f, a, c]); }
    near.sort((p, q) => p[0] - q[0]);
    if (near.length) {
      for (const [, f, a, c] of near) { const nf = razvMirror(f, a, c); if (razvFree(own, nf)) { own.f.push(nf); done(1); return; } }
      done(0); return;
    }
    const f = own.f.find(inside); if (!f) return;
    let n = 0; for (const [a, c] of [[1, 2], [0, 1], [0, 2]]) { const nf = razvMirror(f, a, c); if (razvFree(own, nf)) { own.f.push(nf); n++; } }
    done(n);
  });
}
if ($("razvThumbs")) $("razvThumbs").addEventListener("contextmenu", (e) => {   // v0.438: правый щелчок по своей — удалить
  const c = e.target.closest("canvas.own"); if (!c) return; e.preventDefault();
  const i = +c.dataset.v.slice(1), cur = razvOwnOf(Z.razvV) ? +String(Z.razvV).slice(1) : -1;
  Z.razvOwn.splice(i, 1);
  if (cur === i) Z.razvV = 0; else if (cur > i) Z.razvV = "o" + (cur - 1);
  Z.razvOwnV = (Z.razvOwnV | 0) + 1; save(); renderRazv(); say(`✦ Своя развёртка ${i + 1} удалена.`);
});
if ($("razvThumbs")) $("razvThumbs").onclick = (e) => { const c = e.target.closest("canvas[data-v]"); if (!c) return; Z.razvV = c.classList.contains("own") ? c.dataset.v : +c.dataset.v; save(); renderRazv(); };
if ($("bRazvLbl")) $("bRazvLbl").onclick = () => { Z.razvLbl = Z.razvLbl === false; save(); renderRazv(); };
if ($("bRazv3")) $("bRazv3").onclick = () => { Z.razvNB = 3; save(); renderRazv(); };   // v0.408
if ($("bRazv4")) $("bRazv4").onclick = () => { Z.razvNB = 4; save(); renderRazv(); };
if ($("bRazvAx")) $("bRazvAx").onclick = () => { Z.razvAx = Z.razvAx === false; save(); renderRazv(); };   // v0.406
if ($("razvCv") && window.ResizeObserver) new ResizeObserver(() => renderRazv()).observe($("razvCv"));

/* v0.432, «сделай окно с этими треугольниками, чтобы можно было там сделать сцены: выделяю цветом какие-то, сохраняю сцену 1, потом 2…»:
   окно «△ Сетка» — ряды равносторонних треугольников, как в кнопках (ряд — полвысоты кнопки, два ряда — кнопка). В ряду r треугольник c
   смотрит вверх, если (r + c) чётное; он занимает по x [c·t, c·t + s], t = s / 2. Цвет — щелчком (тот же цвет ещё раз — стереть, правый
   щелчок — стереть), протяжкой мыши — много. Сцены — Z.triScenes [{R, N, c: {"r_c": цвет}}]; «💾 сохранить» — в выбранную (Z.triCur), «＋ сцена» —
   новой; щелчок по номеру — открыть, правый — удалить. «⧉ в буфер» — все сцены текстом: по цветам номера треугольников (счёт по рядам с 1). */
const TRI_COL = [null, ["#8b949e", "серый"], ["#ffd166", "золотой"], ["#e5484d", "красный"], ["#22d3ee", "голубой"], ["#f472b6", "розовый"], ["#4ade80", "зелёный"], ["#a78bfa", "сиреневый"], ["#f8fafc", "белый"]];
const triGeo = { s: 0, hh: 0, pad: 8 };
const TRI_S1 = 24 / Math.sqrt(3), TRI_S9 = 90;   // v0.437: «масштаб до реального менять» — настоящая сторона (кнопка 24 px = два ряда) … крупно
/* v0.437: инструменты палитры — Z.triCol: цвет 1…8 — кисть (красит треугольник), 0 — ластик, −1 ☝ выбор группы, −2 ✦ точка в узел,
   −3 ╱ линия по ребру. У ✦ и ╱ свой цвет — Z.triTCol (выбирается в палитре, пока инструмент горит) */
function triState(){
  if (!Array.isArray(Z.triScenes)) Z.triScenes = [];
  for (const k of ["triCells", "triGLn", "triGIn", "triGTx", "triDots", "triLines"]) if (!Z[k] || typeof Z[k] !== "object") Z[k] = {};
  Z.triR = Math.max(1, Z.triR | 0 || 2); Z.triN = Math.max(1, Z.triN | 0 || 25);   // v0.437: считаются сами — сколько влезает в окно (renderTri)
  if (!(Z.triS >= TRI_S1 - 0.001 && Z.triS <= TRI_S9)) Z.triS = 40;
  if (!(Z.triCol >= -3 && Z.triCol < TRI_COL.length)) Z.triCol = 2;
  if (!(Z.triTCol >= 1 && Z.triTCol < TRI_COL.length)) Z.triTCol = 2;
  if (!(Z.triDotD > 0)) Z.triDotD = 3; if (!(Z.triLW > 0)) Z.triLW = 2;   // диаметр точки и толщина линии — в пикселях НАСТОЯЩЕГО размера
  if (!(Z.triCur >= 0 && Z.triCur < Z.triScenes.length)) Z.triCur = -1;
}
function triPts(r, c){   // три вершины треугольника в пикселях холста (без учёта dpr)
  const { s, hh, pad } = triGeo, t = s / 2, x = pad + c * t, y0 = pad + r * hh, y1 = y0 + hh;
  return (r + c) % 2 === 0 ? [[x, y1], [x + s, y1], [x + t, y0]] : [[x, y0], [x + s, y0], [x + t, y1]];
}
function triHit(px, py){
  const { s, hh, pad } = triGeo; if (!s) return null;
  const r = Math.floor((py - pad) / hh); if (r < 0 || r >= Z.triR) return null;
  const c0 = Math.floor((px - pad) / (s / 2));
  for (const c of [c0, c0 - 1]) {
    if (c < 0 || c >= Z.triN) continue;
    const [a, b, d] = triPts(r, c), sg = (p, q, w) => (p[0] - w[0]) * (q[1] - w[1]) - (q[0] - w[0]) * (p[1] - w[1]), P = [px, py];
    const d1 = sg(P, a, b), d2 = sg(P, b, d), d3 = sg(P, d, a);
    if (!((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))) return [r, c];
  }
  return null;
}
/* v0.437, «ставить светящиеся точки в узлы», «с диаметром задаваемым»: узел — вершина сетки. Линия j (0…R) — y = pad + j·hh; на ней узлы
   x = pad + i·t, где i + j нечётное. Точки — Z.triDots {"j_i": [цвет, диаметр]}; ✦ — щелчок у узла ставит точку (тот же цвет ещё раз или
   правый щелчок — убрать). «рисовать чисто обводкой разного цвета»: ╱ — линия по ребру сетки, Z.triLines {"j1_i1|j2_i2": [цвет, толщина]},
   щелчок и протяжка — по рёбрам под мышью (с того же цвета начал — стирает) */
const triNodeXY = (j, i) => [triGeo.pad + i * triGeo.s / 2, triGeo.pad + j * triGeo.hh];
const triNodeOf = (x, y) => [Math.round((y - triGeo.pad) / triGeo.hh), Math.round((x - triGeo.pad) / (triGeo.s / 2))];
function triNode(px, py){
  const { s, hh, pad } = triGeo; if (!s) return null;
  const t = s / 2, j = Math.round((py - pad) / hh); if (j < 0 || j > Z.triR) return null;
  let i = Math.round((px - pad) / t); if ((i + j) % 2 === 0) i += (px - pad) / t > i ? 1 : -1;
  if (i < 0 || i > Z.triN + 1) return null;
  return Math.hypot(pad + i * t - px, pad + j * hh - py) <= s * 0.4 ? [j, i] : null;
}
function triEdgeAt(px, py){   // ближайшее ребро треугольника под мышью — ключ "j1_i1|j2_i2" (узлы по порядку)
  const h = triHit(px, py); if (!h) return null;
  const P = triPts(h[0], h[1]); let best = null, bd = 1e9;
  for (const [a, b] of [[0, 1], [0, 2], [1, 2]]) {
    const [x1, y1] = P[a], [x2, y2] = P[b], L = (x2 - x1) ** 2 + (y2 - y1) ** 2, u = Math.max(0, Math.min(1, ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / L));
    const d = Math.hypot(px - x1 - u * (x2 - x1), py - y1 - u * (y2 - y1));
    if (d < bd) { bd = d; best = [triNodeOf(x1, y1), triNodeOf(x2, y2)]; }
  }
  const k = best.map(n => n.join("_")).sort(); return k.join("|");
}
const triVal = (v) => Array.isArray(v) ? v : [v | 0, 0];   // [цвет, размер]
function triLinesDraw(g, xy, sc){
  g.save(); g.lineCap = "round";
  for (const [key, v] of Object.entries(Z.triLines)) {
    const [k, w] = triVal(v); if (!TRI_COL[k]) continue;
    const [A, B] = key.split("|").map(p => p.split("_").map(Number)); if (Math.max(A[0], B[0]) > Z.triR || Math.max(A[1], B[1]) > Z.triN + 1) continue;
    const p = xy(A[0], A[1]), q = xy(B[0], B[1]);
    g.strokeStyle = TRI_COL[k][0]; g.lineWidth = Math.max(0.5, (w || Z.triLW) * sc); g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); g.stroke();
  }
  g.restore();
}
function triDotsDraw(g, xy, sc){
  for (const [key, v] of Object.entries(Z.triDots)) {
    const [k, d] = triVal(v), [j, i] = key.split("_").map(Number); if (j > Z.triR || i > Z.triN + 1 || !TRI_COL[k]) continue;
    const [x, y] = xy(j, i), c = TRI_COL[k][0], rad = Math.max(0.8, (d || Z.triDotD) * sc / 2);
    g.save(); g.fillStyle = c; g.shadowColor = c; g.shadowBlur = rad * 3;
    for (let n = 0; n < 2; n++) { g.beginPath(); g.arc(x, y, rad, 0, 2 * Math.PI); g.fill(); }   // дважды — свечение ярче
    g.shadowBlur = 0; g.fillStyle = "#fff"; g.globalAlpha = 0.85; g.beginPath(); g.arc(x, y, rad * 0.45, 0, 2 * Math.PI); g.fill();
    g.restore();
  }
}
/* v0.437, по снимку «⬡ по группам» — «дать выбирать цвет обводки каждой группе, и внутри неё сетку или нет, и сетку вне групп», «ставить
   буквы-символы на группы». ГРУППА — касающиеся рёбрами треугольники одного цвета (обход в ширину). Её настройки лежат на самих треугольниках
   (Z.triGLn — цвет обводки, Z.triGIn — сетка внутри да/нет, Z.triGTx — символ; ключ "r_c"), группа берёт первое найденное у своих; «☝» выбирает
   группу, настройка пишется всем её треугольникам. Перекрашенный или стёртый треугольник свои настройки теряет. Соседи: ▲ (r + c чётное) —
   основание вниз (r + 1, c), бока (r, c − 1) и (r, c + 1); ▼ — основание вверх (r − 1, c). Рёбра в порядке вершин [0-1 основание, 0-2, 1-2]. */
const triNb = (r, c) => [[0, 1, (r + c) % 2 === 0 ? [r + 1, c] : [r - 1, c]], [0, 2, [r, c - 1]], [1, 2, [r, c + 1]]];
function triModel(d){
  const R = d.R, N = d.N, K = (r, c) => { if (r < 0 || r >= R || c < 0 || c >= N) return 0; const k = d.c[r + "_" + c] | 0; return TRI_COL[k] ? k : 0; };
  const cid = {}, comps = [];
  for (let r = 0; r < R; r++) for (let c = 0; c < N; c++) {
    const k = K(r, c), key0 = r + "_" + c; if (!k || cid[key0] != null) continue;
    const g = { k, cells: [], ln: null, inn: null, tx: "" }, q = [[r, c]]; cid[key0] = comps.length;
    while (q.length) {
      const [a, b] = q.shift(), key = a + "_" + b; g.cells.push([a, b]);
      if (g.ln == null && d.gl && d.gl[key]) g.ln = d.gl[key];
      if (g.inn == null && d.gi && typeof d.gi[key] === "boolean") g.inn = d.gi[key];
      if (!g.tx && d.gt && d.gt[key]) g.tx = d.gt[key];
      for (const [, , n] of triNb(a, b)) { const nk = n[0] + "_" + n[1]; if (K(n[0], n[1]) === k && cid[nk] == null) { cid[nk] = comps.length; q.push(n); } }
    }
    comps.push(g);
  }
  return { K, cid, comps };
}
const triCurData = () => ({ R: Z.triR, N: Z.triN, c: Z.triCells, gl: Z.triGLn, gi: Z.triGIn, gt: Z.triGTx });
/* обводка по модели: граница группы — если режим не «без обводки»; рёбра внутри — если у группы «сетка внутри» (не задано — как режим: да в ▵ каждый,
   нет в ⬡ по группам). Цвет — свой у группы, иначе общий. bw — толщина границы, sel — выбранная группа (пунктиром поверх) */
function triEdges(g, M, pts, defLn, bw, sel, selCol){
  const mode = Z.triLnMode == null ? 1 : Z.triLnMode;
  g.lineCap = "round";
  M.comps.forEach((gr, gi) => {
    const inner = gr.inn != null ? gr.inn : mode === 1, B = new Path2D(), I = new Path2D();
    for (const [r, c] of gr.cells) {
      const P = pts(r, c);
      for (const [a, b, n] of triNb(r, c)) {
        const same = M.cid[n[0] + "_" + n[1]] === gi;
        if (same) { if (!inner || n[0] * 1000 + n[1] < r * 1000 + c) continue; I.moveTo(P[a][0], P[a][1]); I.lineTo(P[b][0], P[b][1]); }
        else { B.moveTo(P[a][0], P[a][1]); B.lineTo(P[b][0], P[b][1]); }
      }
    }
    g.strokeStyle = gr.ln || defLn;
    if (inner) { g.lineWidth = 1; g.stroke(I); }
    if (mode) { g.lineWidth = bw; g.stroke(B); }
    if (gi === sel) { g.save(); g.strokeStyle = selCol; g.lineWidth = 2; g.setLineDash([5, 4]); g.stroke(B); g.restore(); }
  });
}
function triText(g, M, pts, col, size){   // символ группы — посередине её треугольников
  g.textAlign = "center"; g.textBaseline = "middle"; g.font = `bold ${size}px Segoe UI, Arial`;
  for (const gr of M.comps) {
    if (!gr.tx) continue;
    let x = 0, y = 0; for (const [r, c] of gr.cells) { const P = pts(r, c); x += (P[0][0] + P[1][0] + P[2][0]) / 3; y += (P[0][1] + P[1][1] + P[2][1]) / 3; }
    g.fillStyle = col; g.fillText(gr.tx, x / gr.cells.length, y / gr.cells.length);
  }
}
const triSelComp = (M) => { const i = Z.triSel != null ? M.cid[Z.triSel] : null; return i == null ? -1 : i; };
function renderTri(){
  const cv = $("triCv"); if (!cv) return;
  triState();
  $("triS").value = Z.triS; $("bTriS1").classList.toggle("on", Z.triS <= TRI_S1 + 0.01);
  $("triDotD").value = Z.triDotD; $("triLW").value = Z.triLW;
  $("bTriNum").classList.toggle("on", Z.triNum !== false);
  $("bTriOut").classList.toggle("on", Z.triOut !== false);
  const pal = $("triPal");
  if (!pal.children.length) pal.innerHTML = `<button data-c="-1" title="☝ Выбрать группу: щелчок по группе — её обводка, сетка внутри и символ (строка «группа»). Alt + щелчок — то же любым инструментом">☝</button>`
    + `<button data-c="-2" title="✦ Точка в узел: щелчок у вершины — светящаяся точка диаметром ⌀ (цвет — выбери в палитре, пока ✦ горит); ещё щелчок тем же цветом или правый — убрать">✦</button>`
    + `<button data-c="-3" title="╱ Линия по ребру: щелчок или протяжка — рёбра сетки цветной линией толщиной ═ (цвет — в палитре, пока ╱ горит); начал с линии того же цвета или правой кнопкой — стирает">╱</button>`
    + TRI_COL.map((k, i) => i ? `<button data-c="${i}" title="${k[1]}" style="background:${k[0]}"></button>` : `<button data-c="0" title="Ластик — стирать">⌫</button>`).join("");
  const tool = Z.triCol < -1;
  [...pal.children].forEach(b => { const c = +b.dataset.c; b.classList.toggle("on", c === Z.triCol || (tool && c === Z.triTCol)); });
  for (const c of ["-2", "-3"]) pal.querySelector(`[data-c="${c}"]`).style.color = TRI_COL[Z.triTCol][0];
  $("triScenes").innerHTML = Z.triScenes.map((_, i) => `<button data-i="${i}" class="${i === Z.triCur ? "on" : ""}" title="Сцена ${i + 1}: щелчок — открыть, правый — удалить">${i + 1}</button>`).join("");
  $("bTriSave").textContent = Z.triCur >= 0 ? `💾 в ${Z.triCur + 1}` : "💾 сохранить";
  if (!winOpen("w-tri")) return;
  /* v0.437, «сделай сетку сразу на всё окно», «и масштаб до реального менять»: холст — на всё свободное место окна, треугольники — стороной
     Z.triS (ползунок, от настоящей до крупной; «1:1» — сразу настоящая); рядов и треугольников в ряду — сколько целых влезает (прежде поля
     «ряды / в ряду» и ручка снизу, v0.435 — сняты: рядов больше — окно выше). Закраска держится за номер ряда и места */
  const W = cv.clientWidth || 400, H = cv.clientHeight || 200, pad = triGeo.pad, s = Z.triS, hh = s * Math.sqrt(3) / 2;
  Z.triR = Math.max(1, Math.floor((H - 2 * pad) / hh)); Z.triN = Math.max(1, Math.floor((W - 2 * pad) / (s / 2)) - 1);
  triGeo.s = s; triGeo.hh = hh;
  const M = triModel(triCurData()), sel = triSelComp(M);
  if (sel < 0) Z.triSel = null;
  const cs = getComputedStyle(document.documentElement), line = cs.getPropertyValue("--line").trim() || "#555", txt = cs.getPropertyValue("--txt").trim() || "#ddd";
  const hex = (c) => "#" + triRGB(c).map(v => Math.round(v).toString(16).padStart(2, "0")).join("");
  const gr = sel >= 0 ? M.comps[sel] : null, mode = Z.triLnMode == null ? 1 : Z.triLnMode;
  $("triGrp").hidden = !gr;   // строка «группа» — только когда группа выбрана
  if (gr) {
    $("triGrpLab").textContent = `группа · ${TRI_COL[gr.k][1]} · ${gr.cells.length}`;
    $("triGLn").value = hex(gr.ln || Z.triLn || "#d8dde8");
    $("bTriGIn").classList.toggle("on", gr.inn != null ? gr.inn : mode === 1);
    if (document.activeElement !== $("triGTx")) $("triGTx").value = gr.tx || "";
  }
  const dpr = window.devicePixelRatio || 1;
  if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  const g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
  const num = Z.triNum !== false && s >= 26;
  g.lineJoin = "round";
  /* v0.436: фон и обводка — общие для сетки и живого вида; закрашенные — заливка без своих линий (шов в цвет), обводка — по режиму.
     v0.437: пустые треугольники — бледной сеткой, если «▦ вне групп» горит (выключишь — пустое место чистое) */
  cv.style.background = Z.triBg || "";
  const tri = (P) => { g.beginPath(); g.moveTo(P[0][0], P[0][1]); g.lineTo(P[1][0], P[1][1]); g.lineTo(P[2][0], P[2][1]); g.closePath(); };
  for (let r = 0; r < Z.triR; r++) for (let c = 0; c < Z.triN; c++) {
    const P = triPts(r, c), k = M.K(r, c); tri(P);
    if (k) { g.fillStyle = TRI_COL[k][0]; g.fill(); g.strokeStyle = TRI_COL[k][0]; g.lineWidth = 0.6; g.stroke(); }
    else if (Z.triOut !== false) { g.strokeStyle = line; g.globalAlpha = 0.5; g.lineWidth = 1; g.stroke(); g.globalAlpha = 1; }
  }
  triEdges(g, M, triPts, Z.triLn || line, mode === 2 ? 2 : 1, sel, txt);
  if (num) {
    g.textAlign = "center"; g.textBaseline = "middle"; g.font = `${Math.max(9, Math.min(14, s * 0.26))}px Segoe UI, Arial`;
    for (let r = 0; r < Z.triR; r++) for (let c = 0; c < Z.triN; c++) {
      const P = triPts(r, c), k = M.K(r, c), gt = k && M.comps[M.cid[r + "_" + c]].tx;
      if (k) continue;   // v0.454, «номера ромбов закрашенных скрывай»: номер — только у пустых
      g.fillStyle = k ? "#0e1116" : txt; g.globalAlpha = gt ? 0.3 : k ? 0.9 : 0.45; g.fillText(r * Z.triN + c + 1, (P[0][0] + P[1][0] + P[2][0]) / 3, (P[0][1] + P[1][1] + P[2][1]) / 3); g.globalAlpha = 1;
    }
  }
  triText(g, M, triPts, "#0e1116", Math.max(9, Math.min(40, s * 0.62)));
  // средняя черта каждой пары рядов (кнопка — два ряда) — пунктиром; v0.436 — только в режиме «каждый»
  if (mode === 1 && Z.triOut !== false) {
    g.strokeStyle = txt; g.globalAlpha = 0.25; g.setLineDash([4, 4]); g.lineWidth = 1;
    for (let r = 1; r < Z.triR; r += 2) { const y = pad + r * hh; g.beginPath(); g.moveTo(pad, y); g.lineTo(pad + (Z.triN + 1) * s / 2, y); g.stroke(); }
    g.setLineDash([]); g.globalAlpha = 1;
  }
  const sc = s / TRI_S1;   // размеры точек и линий заданы для настоящего размера — в сетке крупнее во столько же раз
  triLinesDraw(g, triNodeXY, sc);
  triDotsDraw(g, triNodeXY, sc);
  triLive(M);
}
/* v0.433, «можно сразу вживую смотреть, как будет выглядеть?»: та же сетка кнопками — высота двух рядов 24 px (с v0.434 — только 1:1), фон —
   панель групп, пустые треугольники — фон. Цвета — как у кнопок сцепки: серый — светлая кнопка (panel2 + 16% текста), золотой — горящая
   (+42% золота), красный — стоп (+60% красного), прочие — +42% своего. Обводка, символы, линии, точки, «▦ вне групп» — как в сетке (v0.437).
   С v0.437 — только занятая часть сетки (от первого до последнего закрашенного ряда и места, с линиями и точками), иначе при сетке на всё
   окно он раздувается; ориентация треугольников — по настоящим номерам */
function triRGB(c){ const g = triRGB.g || (triRGB.g = document.createElement("canvas").getContext("2d")); g.fillStyle = "#000"; g.fillStyle = c; const v = g.fillStyle; if (v[0] === "#") return [1, 3, 5].map(i => parseInt(v.slice(i, i + 2), 16)); const m = v.match(/[\d.]+/g) || [0, 0, 0]; return m.slice(0, 3).map(Number); }
function triLive(M){
  const box = $("triLive"); if (!box || !winOpen("w-tri")) return;
  M = M || triModel(triCurData());
  const cs = getComputedStyle(document.documentElement), V = (n, d) => cs.getPropertyValue(n).trim() || d;
  const p2 = triRGB(V("--panel2", "#1c2230")), mix = (c, a) => { const q = triRGB(c); return `rgb(${p2.map((x, i) => Math.round(x + (q[i] - x) * a)).join(",")})`; };
  const txt = V("--txt", "#e6edf3"), REAL = { 1: mix(txt, 0.16), 2: mix(V("--gold", "#ffd166"), 0.42), 3: mix("#e5484d", 0.6), 8: mix(txt, 0.7) };
  const col = (k) => REAL[k] || mix(TRI_COL[k][0], 0.42), dpr = window.devicePixelRatio || 1;
  // v0.434: фон живого вида и поля цветов (пустое значение — по теме; поле цвета показывает нынешний)
  box.style.background = Z.triBg || "";
  const hex = (c) => "#" + triRGB(c).map(v => Math.round(v).toString(16).padStart(2, "0")).join("");
  $("triBg").value = hex(Z.triBg || V("--panel", "#161b22")); $("triLn").value = hex(Z.triLn || "#d8dde8");
  const mode0 = Z.triLnMode == null ? 1 : Z.triLnMode, bl = $("bTriLn");
  bl.textContent = ["— без обводки", "▵ каждый", "⬡ по группам"][mode0]; bl.classList.toggle("on", mode0 > 0);
  let r0 = 1e9, r1 = -1, c0 = 1e9, c1 = -1;
  const grow = (a, b, c, d) => { r0 = Math.min(r0, a); r1 = Math.max(r1, b); c0 = Math.min(c0, c); c1 = Math.max(c1, d); };
  for (let r = 0; r < Z.triR; r++) for (let c = 0; c < Z.triN; c++) if (M.K(r, c)) grow(r, r, c, c);
  const node = (j, i) => { if (j > Z.triR || i > Z.triN + 1) return; grow(Math.max(0, j - 1), Math.min(Z.triR - 1, j), Math.max(0, i - 2), Math.min(Z.triN - 1, i)); };
  for (const key of Object.keys(Z.triDots)) { const [j, i] = key.split("_").map(Number); node(j, i); }
  for (const key of Object.keys(Z.triLines)) for (const p of key.split("|")) { const [j, i] = p.split("_").map(Number); node(j, i); }
  if (r1 < 0) { r0 = 0; r1 = 1; c0 = 0; c1 = 5; }
  box.querySelectorAll("canvas").forEach(cv => {
    const z = +cv.dataset.z || 1, s = 24 * z / Math.sqrt(3), hh = 12 * z, pad = 4 * z, t = s / 2;
    const W = Math.ceil(2 * pad + (c1 - c0 + 2) * t), H = Math.ceil(2 * pad + (r1 - r0 + 1) * hh);
    cv.style.width = W + "px"; cv.style.height = H + "px"; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    const pts = (r, c) => { const x = pad + (c - c0) * t, y0 = pad + (r - r0) * hh, y1 = y0 + hh; return (r + c) % 2 === 0 ? [[x, y1], [x + s, y1], [x + t, y0]] : [[x, y0], [x + s, y0], [x + t, y1]]; };
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      const k = M.K(r, c), P = pts(r, c);
      g.beginPath(); g.moveTo(P[0][0], P[0][1]); g.lineTo(P[1][0], P[1][1]); g.lineTo(P[2][0], P[2][1]); g.closePath();
      if (k) { g.fillStyle = col(k); g.fill(); g.strokeStyle = col(k); g.lineWidth = 0.6; g.stroke(); }   // шов в цвет — без просветов между треугольниками
      else if (Z.triOut !== false) { g.strokeStyle = "rgba(216,221,232,.12)"; g.lineWidth = 1; g.stroke(); }
    }
    triEdges(g, M, pts, Z.triLn || "rgba(216,221,232,.2)", 1, -1, "");
    triText(g, M, pts, txt, 12 * z);
    const xy = (j, i) => [pad + (i - c0) * t, pad + (j - r0) * hh];
    triLinesDraw(g, xy, z); triDotsDraw(g, xy, z);
  });
}
if ($("triCv")) {
  const cv = $("triCv"); let paint = -1, line = null;
  const rel = (e) => { const b = cv.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
  const at = (e) => triHit(...rel(e));
  cv.addEventListener("pointermove", (e) => { if (paint < 0 && !line) cv.style.cursor = Z.triCol === -1 ? "pointer" : Z.triCol < -1 ? "cell" : ""; });
  const put = (h) => {
    if (!h) return; const key = h[0] + "_" + h[1]; if ((Z.triCells[key] | 0) === paint) return;
    if (paint) Z.triCells[key] = paint; else delete Z.triCells[key];
    delete Z.triGLn[key]; delete Z.triGIn[key]; delete Z.triGTx[key];   // v0.437: перекрашенный — не в прежней группе, её настройки не несёт
    renderTri();
  };
  const putLine = (key) => {   // v0.437: ╱ — ребро цветной линией (line.set) или стереть
    if (!key) return; const v = Z.triLines[key];
    if (line.set) { const nv = [Z.triTCol, Z.triLW]; if (v && triVal(v)[0] === nv[0] && triVal(v)[1] === nv[1]) return; Z.triLines[key] = nv; }
    else { if (!v) return; delete Z.triLines[key]; }
    renderTri();
  };
  cv.addEventListener("contextmenu", (e) => e.preventDefault());
  cv.addEventListener("pointerdown", (e) => {
    triState(); const h = at(e);
    if (e.altKey && e.button === 0 || Z.triCol === -1) {   // v0.437: ☝ (или Alt) — выбрать группу, не красить
      Z.triSel = h && Z.triCells[h[0] + "_" + h[1]] ? h[0] + "_" + h[1] : null; save(); renderTri(); return;
    }
    if (Z.triCol === -2) {   // v0.437: ✦ — точка в узел
      const n = triNode(...rel(e)); if (!n) return;
      const key = n[0] + "_" + n[1], v = Z.triDots[key];
      if (e.button === 2 || (v && triVal(v)[0] === Z.triTCol)) delete Z.triDots[key]; else Z.triDots[key] = [Z.triTCol, Z.triDotD];
      save(); renderTri(); return;
    }
    if (Z.triCol === -3) {
      const key = triEdgeAt(...rel(e)); if (!key) return;
      const v = Z.triLines[key]; line = { set: !(e.button === 2 || (v && triVal(v)[0] === Z.triTCol)) };
      cv.setPointerCapture(e.pointerId); putLine(key); return;
    }
    if (!h) return;
    const k = Z.triCells[h[0] + "_" + h[1]] | 0;
    if (e.button === 2) {   // v0.454, «правой кнопкой по закрашенному — берёт его при следующем клике»: пипетка — цвет (в конструкторе — кисть кнопки)
      if (k && TRI_COL[k]) { Z.triCol = k; save(); renderTri(); say(`△ Кисть: ${TRI_COL[k][1]} — следующий щелчок красит ею.`); }
      return;
    }
    paint = k === Z.triCol ? 0 : Z.triCol;   // тот же цвет ещё раз — стереть
    cv.setPointerCapture(e.pointerId); put(h);
  });
  cv.addEventListener("pointermove", (e) => { if (paint >= 0) put(at(e)); else if (line) putLine(triEdgeAt(...rel(e))); });
  const end = () => { if (paint >= 0 || line) { paint = -1; line = null; save(); } };
  cv.addEventListener("pointerup", end); cv.addEventListener("pointercancel", end);
  if (window.ResizeObserver) new ResizeObserver(() => renderTri()).observe(cv);
  // v0.437: пока горит ✦ или ╱, цвет палитры — их цвет (инструмент остаётся); тот же инструмент ещё раз — назад к кисти
  $("triPal").onclick = (e) => {
    const b = e.target.closest("button[data-c]"); if (!b) return; const c = +b.dataset.c;
    if (c < -1 && Z.triCol === c) Z.triCol = Z.triPrevCol > 0 ? Z.triPrevCol : 2;
    else if (Z.triCol < -1 && c >= 1) Z.triTCol = c;
    else { if (Z.triCol >= 1) Z.triPrevCol = Z.triCol; Z.triCol = c; }
    save(); renderTri();
  };
  $("triS").oninput = () => { Z.triS = Math.max(TRI_S1, Math.min(TRI_S9, +$("triS").value || 40)); save(); renderTri(); };
  $("bTriS1").onclick = () => { if (Z.triS <= TRI_S1 + 0.01) Z.triS = Z.triS0 > TRI_S1 ? Z.triS0 : 40; else { Z.triS0 = Z.triS; Z.triS = TRI_S1; } save(); renderTri(); };
  $("triDotD").onchange = () => { Z.triDotD = Math.max(0.5, Math.min(40, +$("triDotD").value || 3)); save(); renderTri(); };
  $("triLW").onchange = () => { Z.triLW = Math.max(0.5, Math.min(20, +$("triLW").value || 2)); save(); renderTri(); };
  $("bTriNum").onclick = () => { Z.triNum = Z.triNum === false; save(); renderTri(); };
  // v0.434: живой вид — фон, цвет обводки, режим обводки по кругу: каждый треугольник → по группам цветов → без обводки
  // v0.436: фон и обводка — и в сетке построения, поэтому перерисовывается всё (renderTri зовёт и живой вид)
  $("triBg").oninput = () => { Z.triBg = $("triBg").value; save(); renderTri(); };
  $("triLn").oninput = () => { Z.triLn = $("triLn").value; if (!(Z.triLnMode > 0) && Z.triLnMode != null) Z.triLnMode = 1; save(); renderTri(); };
  $("bTriLn").onclick = () => { const m = Z.triLnMode == null ? 1 : Z.triLnMode; Z.triLnMode = (m + 1) % 3; save(); renderTri(); };
  $("bTriOut").onclick = () => { Z.triOut = Z.triOut === false; save(); renderTri(); };   // v0.437: сетка вне групп
  $("bTriLiveDef").onclick = () => { Z.triBg = null; Z.triLn = null; Z.triLnMode = 1; Z.triOut = true; save(); renderTri(); };
  // v0.437: выбранная группа — своя обводка, сетка внутри, символ (пишутся всем её треугольникам)
  const selGr = () => { const M = triModel(triCurData()), i = triSelComp(M); return i < 0 ? null : M.comps[i]; };
  const setAll = (map, v) => { const gr = selGr(); if (!gr) return; for (const [r, c] of gr.cells) { const key = r + "_" + c; if (v === null || v === "") delete Z[map][key]; else Z[map][key] = v; } save(); renderTri(); };
  $("triGLn").oninput = () => setAll("triGLn", $("triGLn").value);
  $("bTriGIn").onclick = () => { const gr = selGr(); if (!gr) return; const mode = Z.triLnMode == null ? 1 : Z.triLnMode; setAll("triGIn", !(gr.inn != null ? gr.inn : mode === 1)); };
  $("triGTx").oninput = () => setAll("triGTx", $("triGTx").value.trim());
  $("bTriGDef").onclick = () => { const gr = selGr(); if (!gr) return; for (const [r, c] of gr.cells) { const key = r + "_" + c; delete Z.triGLn[key]; delete Z.triGIn[key]; delete Z.triGTx[key]; } save(); renderTri(); };
  $("bTriClr").onclick = () => { triState(); for (const k of ["triCells", "triGLn", "triGIn", "triGTx", "triDots", "triLines"]) Z[k] = {}; Z.triSel = null; save(); renderTri(); };
  const cp = (o) => Object.assign({}, o);
  const snap = () => ({ R: Z.triR, N: Z.triN, c: cp(Z.triCells), gl: cp(Z.triGLn), gi: cp(Z.triGIn), gt: cp(Z.triGTx), d: cp(Z.triDots), l: cp(Z.triLines) });
  $("bTriNew").onclick = () => { triState(); Z.triScenes.push(snap()); Z.triCur = Z.triScenes.length - 1; save(); renderTri(); say(`△ Сцена ${Z.triCur + 1} сохранена.`); };
  $("bTriSave").onclick = () => { triState(); if (Z.triCur < 0) { $("bTriNew").click(); return; } Z.triScenes[Z.triCur] = snap(); save(); renderTri(); say(`△ Сцена ${Z.triCur + 1} перезаписана.`); };
  $("triScenes").onclick = (e) => {
    const b = e.target.closest("button[data-i]"); if (!b) return; triState();
    const i = +b.dataset.i, sc = Z.triScenes[i]; if (!sc) return;
    Z.triCur = i; Z.triCells = cp(sc.c); Z.triGLn = cp(sc.gl); Z.triGIn = cp(sc.gi); Z.triGTx = cp(sc.gt); Z.triDots = cp(sc.d); Z.triLines = cp(sc.l); Z.triSel = null;
    save(); renderTri();
  };
  $("triScenes").addEventListener("contextmenu", (e) => {
    const b = e.target.closest("button[data-i]"); if (!b) return; e.preventDefault(); triState();
    const i = +b.dataset.i; Z.triScenes.splice(i, 1);
    if (Z.triCur === i) Z.triCur = -1; else if (Z.triCur > i) Z.triCur--;
    save(); renderTri(); say(`△ Сцена ${i + 1} удалена; дальше номера сдвинулись.`);
  });
  $("bTriCopy").onclick = () => {
    triState(); if (!Z.triScenes.length) { say("△ Сцен пока нет — «＋ сцена» сохраняет."); return; }
    const NL = String.fromCharCode(10), cn = (k) => (TRI_COL[k] || [0, "?"])[1];
    const out = Z.triScenes.map((sc, i) => {
      const by = {};
      for (const [key, k] of Object.entries(sc.c)) { const [r, c] = key.split("_").map(Number); (by[k] = by[k] || []).push(r * sc.N + c + 1); }
      const parts = Object.keys(by).sort((a, b) => a - b).map(k => `${cn(k)}: ${by[k].sort((a, b) => a - b).join(", ")}`);
      const M = triModel({ R: sc.R, N: sc.N, c: sc.c, gl: sc.gl, gi: sc.gi, gt: sc.gt }), more = [];
      for (const g of M.comps) {   // v0.437: группы со своими настройками
        if (!(g.tx || g.ln || g.inn != null)) continue;
        const ids = g.cells.map(([r, c]) => r * sc.N + c + 1).sort((a, b) => a - b), bits = [];
        if (g.tx) bits.push(`символ «${g.tx}»`); if (g.ln) bits.push(`обводка ${g.ln}`); if (g.inn != null) bits.push(`сетка внутри ${g.inn ? "да" : "нет"}`);
        more.push(`  группа ${cn(g.k)} [${ids.join(", ")}]: ${bits.join(", ")}`);
      }
      const dots = {}; for (const [key, v] of Object.entries(sc.d || {})) { const [k, d] = triVal(v); (dots[k] = dots[k] || []).push(key.replace("_", ":") + (d ? ` ⌀${d}` : "")); }
      for (const k of Object.keys(dots)) more.push(`  точки ${cn(k)} (линия:узел): ${dots[k].join(", ")}`);
      const lines = {}; for (const [key, v] of Object.entries(sc.l || {})) { const [k, w] = triVal(v); (lines[k] = lines[k] || []).push(key.split("|").map(p => p.replace("_", ":")).join("–") + (w ? ` ═${w}` : "")); }
      for (const k of Object.keys(lines)) more.push(`  линии ${cn(k)} (узел–узел): ${lines[k].join(", ")}`);
      return `Сцена ${i + 1} (рядов ${sc.R}, в ряду ${sc.N}) — ${parts.length ? parts.join("; ") : "пусто"}` + (more.length ? NL + more.join(NL) : "");
    }).join(NL);
    const done = () => say(`△ ${Z.triScenes.length} сцен — в буфере.`);
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(out).then(done, () => { prompt("Скопируй:", out); });
    else prompt("Скопируй:", out);
  };
  renderTri();
}

/* ─── ◆ Октаэдр (v0.396) ─────────────────────────────────────────────────────────────────────
   «Весь Октаэдр в Зазеркалье, как одно из окон, наравне с Конусом»: в окне — страница Октаэдра целиком (?zz — своя память,
   без значка Хаба). Грузится, когда окно впервые открыто; готова — шлёт zz-okt-ready, и ей уходит столбик строк (zz-rows).
   Дальше строки уходят только при перемене и только с кнопкой «⇄ строки → грани» (Z.oktSync, по умолчанию вкл). */
let oktSent = null, oktReady = false;
function renderOkt(){
  const fr = $("oktFr"); if (!fr) return;
  $("bOktSync").classList.toggle("on", Z.oktSync !== false);   // v0.399: галка → кнопка
  if (!winOpen("w-okt")) return;
  if (!fr.getAttribute("src")) { fr.src = "../oktaedr/Zerkalius-oktaedr.html?zz"; return; }
  if (!oktReady || Z.oktSync === false) return;
  if (Z.razvRomb) {   // v0.440: ◇ ромбы из кадров — на 3D-тело, пары граней по ромбу (четыре — хватит и октаэдру)
    const RB = razvRombs(), n = RB.list.length;
    if (n) {
      const kk = "R" + RB.S + "/" + razvRombSeq + "/" + Z.rows.join("|"); if (kk === oktSent) return;
      oktSent = kk;
      const list = [0, 1, 2, 3].map(i => { const p = RB.list[(razvRombSeq + i) % n]; return { u: p.u, d: p.d }; });
      try { fr.contentWindow.postMessage({ type: "zz-rhombs", h: RB.h, list }, "*"); } catch (e) {}
      return;
    }
  }
  const k = Z.rows.join("|"); if (k === oktSent) return;
  oktSent = k;
  try { fr.contentWindow.postMessage({ type: "zz-rows", rows: Z.rows.slice() }, "*"); } catch (e) {}
}
window.addEventListener("message", (e) => {
  const fr = $("oktFr");
  if (!fr || e.source !== fr.contentWindow || !e.data || e.data.type !== "zz-okt-ready") return;
  oktReady = true; oktSent = null; renderOkt();
});
if ($("bOktSync")) $("bOktSync").onclick = () => { Z.oktSync = Z.oktSync === false; oktSent = null; save(); renderOkt(); };
if ($("bOktOpen")) $("bOktOpen").onclick = () => window.open("../oktaedr/Zerkalius-oktaedr.html", "_blank");
/* v0.440: ◇ РОМБЫ ИЗ КАДРОВ НА ТРИРАМИДУСЕ (слова пользователя: «самое главное — натянуть Аниматрицу на ТриРамидус», «ромбы из
   кадров», «раскадровка — развёртка есть», «на html — Зазеркалиус»; выбрано: кадры листаются, и на развёртке, и на 3D-теле). Ромбы —
   те же, что режет ◇ сетка в Code (Code 35.54, 35.78), только в координатах поля: строка r, место q (в строке r — r + 1 бит).
   Ромб высотой S = 2h с верхней вершиной (r0, q0) — { q0 ≤ q ≤ q0 + h, r0 − q0 ≤ r − q ≤ r0 − q0 + h }; вершины ромбов — (e·h, j·h),
   j = 0…e, ряд e годится, пока r0 + 2h не ниже последней строки. Горизонтальная диагональ (строка r0 + h) режет ромб на две грани тела:
   верх u — ряд k от вершины T, места q0…q0 + k; низ d — ряд k от вершины B = строка r0 + 2h − k, места q0 + h − k … q0 + h (место 0 —
   у того же угла экватора Ei, что и у верхней, поэтому на общем ребре обе половины сходятся). Пара граней i (Ui + Di — ромб
   развёртки «В») получает ромб (кадр + i) по кругу; кадр сдвигается на один каждые Z.razvRombMs мс. Низ — настоящий низ ромба,
   не инверсия верха. На развёртке — только крупная (малые картинки — как были); в Гранидус уходит сообщение zz-rhombs (Гранидус v0.069). */
var razvRombSeq = 0, razvRombTimer = 0;
function razvRombs(){
  const S = [8, 16, 32, 64].includes(+Z.razvRombS) ? +Z.razvRombS : 32, h = S / 2;
  const L = Z.rows.map(s => String(s).replace(/[^01]/g, "")), R = L.length;
  const bit = (r, q) => (L[r] && L[r][q] === "1" ? 1 : 0), list = [];
  for (let e = 0; e * h + 2 * h <= R - 1; e++) for (let j = 0; j <= e; j++) {
    const r0 = e * h, q0 = j * h, u = [], d = [];
    for (let k = 0; k <= h; k++) {
      const a = [], b = [];
      for (let q = 0; q <= k; q++) { a.push(bit(r0 + k, q0 + q)); b.push(bit(r0 + 2 * h - k, q0 + h - k + q)); }
      u.push(a); d.push(b);
    }
    list.push({ u, d, e, j });
  }
  return { S, h, list };
}
function razvRombTick(){
  clearTimeout(razvRombTimer); razvRombTimer = 0;
  if (!Z.razvRomb || Z.razvRombP) return;
  razvRombTimer = setTimeout(() => {
    razvRombTimer = 0;
    const n = razvRombs().list.length; razvRombSeq = n ? (razvRombSeq + 1) % n : 0;
    try { renderRazv(); } catch (e) { console.error(e); }
    try { renderOkt(); } catch (e) { console.error(e); }
    razvRombTick();
  }, Math.max(20, +Z.razvRombMs || 400));
}
if ($("bRazvRomb")) {
  const sync = () => {
    $("bRazvRomb").classList.toggle("on", !!Z.razvRomb);
    $("razvRombS").value = String([8, 16, 32, 64].includes(+Z.razvRombS) ? +Z.razvRombS : 32);
    $("razvRombMs").value = String(+Z.razvRombMs || 400);
    $("bRazvRombP").textContent = Z.razvRombP ? "▶" : "⏸";
  };
  $("bRazvRomb").onclick = () => {
    Z.razvRomb = !Z.razvRomb; razvRombSeq = 0; oktSent = null; save(); sync(); renderRazv(); renderOkt(); razvRombTick();
    if (Z.razvRomb) { const RB = razvRombs(); say(RB.list.length ? `◇ Ромбы из кадров: ${RB.list.length} ромбов по ${RB.S} строк — листаются по парам граней.` : `◇ Ромбы из кадров: в поле меньше ${RB.S + 1} строк — выберите ромб меньше.`); }
  };
  $("razvRombS").onchange = () => { Z.razvRombS = +$("razvRombS").value; razvRombSeq = 0; save(); renderRazv(); renderOkt(); };
  $("razvRombMs").oninput = () => { Z.razvRombMs = +$("razvRombMs").value; save(); razvRombTick(); };
  $("bRazvRombP").onclick = () => { Z.razvRombP = !Z.razvRombP; save(); sync(); razvRombTick(); };
  sync(); razvRombTick();
}
/* v0.409, «клик вне поля окна — скролл листает окна». Активное окно — то, в котором последний раз нажали мышь (zActiveWin); нажали вне
   окон — активного нет. Колесо над НЕактивным окном до его холстов и групп не доходит (перехват на входе, stopPropagation) — работает
   обычная прокрутка, стол листается. Над активным — как было (масштаб конуса, пирамиды…). Окно Гранидуса — чужая страница в рамке, колесо
   она забирает сама, поэтому пока оно не активно, над рамкой прозрачная крышка #oktShield (body без .okt-live): колесо над ней листает стол,
   щелчок — окно активно, крышка снята. На странице одного окна (?solo=…) и в фоне Хаба — как прежде, колесо сразу окну. */
let zActiveWin = null;
function zActiveSet(w){ zActiveWin = w || null; document.body.classList.toggle("okt-live", !!w && w.id === "w-okt"); }
document.addEventListener("pointerdown", (e) => { if (!ZZ_SOLO) zActiveSet(e.target.closest && e.target.closest(".win")); }, true);
window.addEventListener("wheel", (e) => {
  if (ZZ_SOLO || e.ctrlKey) return;
  const w = e.target.closest && e.target.closest(".win");
  if (w && w !== zActiveWin) e.stopPropagation();   // неактивное окно — колесо листает стол
}, { capture: true, passive: true });
// v0.410: кнопка «✦ развёртка» из окна Гранидуса переехала в шапку (закреплённое окно, см. razvPin0)

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
  let html = `${all ? `Все строки подряд: ${Z.rows.length} стр., ` : `Строка ${Z.cur + 1}: `}${r.N} бит. «Как есть» — ${r.raw} бит (N + 4 на номер метода).\n` +
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
  let h = `Строка ${Z.cur + 1} (${s.length} бит), орбита ${o.size} из 4.\n<b>Целиком</b> — строк той же орбиты: ${whole.length}\n`;
  whole.forEach(w => { h += `<span class="hit" data-r="${w.i}">строка ${w.i + 1} — ${ORBIT_NAMES[w.key]}</span>\n`; });
  if ($("orbitSub").checked) {
    const seen = new Set(), subs = [];
    let more = 0;
    for (const k of Object.keys(o.imgs)) {
      const img = o.imgs[k];
      if (!img || seen.has(img)) continue;   // v0.134: пустая строка — indexOf("") не даёт -1, поиск кусков зацикливался
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
        .forEach(x => { h += `<span class="hit" data-r="${x.i}">строка ${x.i + 1}, с бита ${x.p} — ${ORBIT_NAMES[x.k]}</span>\n`; });
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
  $("fixHead").textContent = `строка ${Z.cur + 1} · ${n} бит`;
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
function runBwt(live){   // v0.045: live — из живого пересчёта: поле «№ для обратного хода» не трогать
  const s = cur(), n = s.length;
  if (n > ZZ_BWT_MAX) { say(`⇅ Строка ${n} бит — длиннее ${ZZ_BWT_MAX}.`); return null; }
  const r = zzBwt(s);
  bwtLast = { src: s, row: Z.cur, last: r.last, index: r.index };
  if (!live) { Z.bwtIdx = r.index; $("bwtIdx").value = r.index; save(); }
  const back = zzUnbwt(r.last, r.index);
  const ru0 = zzRuns(s), ru1 = zzRuns(r.last);
  const cut = (x) => bitsPlain(x.length > 400 ? x.slice(0, 400) + "…" : x);
  $("bwtOut").innerHTML =
    `Строка ${Z.cur + 1}, ${n} бит: таблица ${n}×${n} сдвигов, отсортирована.\n` +
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
  snapshot();
  const at = Z.cur + 1;
  sigLast = { msg, clean, mask: P.mask, dev: P.dev, at, lens: sent.map(r => r.length) };   // v0.044: где лежит — чтобы читать его и без выделения
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
  /* v0.044, «проверь или объясни» по снимку: 71 строка «(все)» — выделение сигнала сбросилось, и весь столбик (строки
     треугольника) читался как сигнал: каша и «?». Теперь без выделения читается последний отправленный сигнал, если
     его строки на месте (там же и той же длины); иначе — весь столбик, но с предупреждением, и строки, далёкие и от
     базы, и от отступа (порча больше запаса), считаются «не похожими на сигнал». */
  let idx, src;
  const lastOk = sigLast && sigLast.at !== undefined && sigLast.lens.every((n, j) => Z.rows[sigLast.at + j] !== undefined && Z.rows[sigLast.at + j].length === n);
  if (rowSel.size) { idx = Array.from(rowSel).sort((a, b) => a - b); src = "выделенные"; }
  else if (lastOk) { idx = sigLast.lens.map((_, j) => sigLast.at + j); src = `последний отправленный сигнал: строки ${idx[0] + 1}…${idx[idx.length - 1] + 1}`; }
  else { idx = Z.rows.map((_, i) => i); src = "ничего не выделено и отправленного сигнала в столбике нет — прочитан ВЕСЬ столбик; строки, которые не сигнал, дают мусор"; }
  const rows = idx.map(i => Z.rows[i]);
  const dec = zzSignalDecode(rows, P.mask, P.dev);
  const alien = dec.filter(d => d.bit !== "?" && Math.min(d.d0, d.d1) > d.spare).length;
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
  $("sigOut").innerHTML = `Прочитано строк: ${rows.length} (${src}). База ${P.mask}, 1 — ${P.dev === "ones" ? "сплошные единицы" : "инверсия базы"}.\n` +
    (alien ? `⚠ Строк, не похожих на сигнал (далеко и от базы, и от отступа — дальше запаса): <b>${alien}</b> из ${rows.length}. Их биты — гадание. Выдели строки сигнала или «📡 В столбик» заново.\n` : "") +
    `Сообщение: <span class="mono">${bitsPlain(got.length > 120 ? got.slice(0, 120) + "…" : got)}</span>` +
    (unsure ? `\nНе решено строк: <b>${unsure}</b> — строка ровно посередине между базой и отступом (или база и отступ совпадают).` : "") + cmp;
  let h = "";
  dec.slice(0, 200).forEach((d, j) => {
    const r = rows[j];
    const shown = r.length > 64 ? r.slice(0, 64) + "…" : r;
    const warn = Math.min(d.d0, d.d1);
    h += '<div><span class="lno">' + (idx[j] + 1) + "</span>" + bitsPlain(shown) +
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
  const candTxt = loc.cand.map(([k, i]) => `строка ${chk.idx[k] + 1}, бит ${i}`).join("; ");
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
  if (cam && cam.overlay) cam.overlay(pr, ctx, V);   // v0.056: поверх — хорда и её точки
}
/* v0.056, «кнопку: линия соединяет концы, с подсчётом пересечений об себя же; площадь прямоугольников, площадь описанного
   квадрата или круга». Лесенка лежит в плоскости: «1» — шаг по X, «0» — по Z; X — единиц, Z — нулей. Хорда — прямая от
   начала до конца. С какой стороны хорды вершина k — знак f = x·Z − z·X; смена знака — пересечение (на отрезке или в
   вершине), ноль без смены — касание. Площади: под лесенкой — сумма прямоугольников «шаг 1 × сколько нулей было до него»
   (это число пар «0 раньше 1»), над ней — X·Z минус это; между лесенкой и хордой — ∫|z(x) − Z/X·x| dx; описанный
   прямоугольник X·Z, квадрат max(X, Z)², круг вокруг прямоугольника π(X² + Z²)/4. */
function viewChordStats(s){
  const n = Math.min(s.length, VIEW_MAX), P = [[0, 0]];
  let x = 0, z = 0, under = 0;
  for (let i = 0; i < n; i++) { if (s[i] === "1") { under += z; x++; } else z++; P.push([x, z]); }
  const X = x, Z = z, f = (p) => p[0] * Z - p[1] * X;
  let cross = 0, touch = 0, last = 0, zeros = [];
  const pts = [], tp = [];
  for (let k = 1; k < P.length; k++) {
    const v = k === P.length - 1 ? null : f(P[k]);
    if (v === 0) { zeros.push(P[k]); continue; }
    if (v === null) break;
    const sg = Math.sign(v);
    if (last && sg !== last) {
      cross++;
      if (zeros.length) pts.push(zeros[0]);
      else { const a = P[k - 1], b = P[k], fa = f(a), fb = f(b), t = fa / (fa - fb); pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
      for (const q of zeros.slice(1)) tp.push(q);
    } else for (const q of zeros) { touch++; tp.push(q); }
    zeros = []; last = sg;
  }
  if (!last) touch += zeros.length, zeros.forEach(q => tp.push(q));
  let between = 0, signed = 0;
  if (X && Z) {
    const m = Z / X;
    let xx = 0, zz = 0;
    for (let i = 0; i < n; i++) {
      if (s[i] !== "1") { zz++; continue; }
      const a = xx, c = zz, t0 = c / m;   // на [a, a+1] лесенка на высоте c, хорда — m·t
      signed += c - m * (a + 0.5);
      if (t0 <= a || t0 >= a + 1) between += Math.abs(c - m * (a + 0.5));
      else between += (c * (t0 - a) - m * (t0 * t0 - a * a) / 2) + (m * ((a + 1) * (a + 1) - t0 * t0) / 2 - c * (a + 1 - t0));
      xx++;
    }
  }
  return { X, Z, cross, touch, pts, tp, under, over: X * Z - under, between, signed, rect: X * Z, sq: Math.max(X, Z) ** 2, circ: Math.PI * (X * X + Z * Z) / 4 };
}
function viewChordOverlay(st){
  // точки лесенки в мире: как у viewPath — сдвинуты к центру
  const w = (p) => [p[0] - st.X / 2, 0, p[1] - st.Z / 2];
  return (pr, ctx, V) => {
    const a = pr(w([0, 0])), b = pr(w([st.X, st.Z]));
    ctx.save(); ctx.globalAlpha = 0.9; ctx.strokeStyle = V("--gold"); ctx.lineWidth = 2; ctx.setLineDash([7, 5]);
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = V("--red"); for (const p of st.pts) { const q = pr(w(p)); ctx.beginPath(); ctx.arc(q[0], q[1], 5, 0, 7); ctx.fill(); }
    ctx.strokeStyle = V("--red"); ctx.lineWidth = 1.5; for (const p of st.tp) { const q = pr(w(p)); ctx.beginPath(); ctx.arc(q[0], q[1], 5, 0, 7); ctx.stroke(); }
    ctx.restore();
  };
}
function viewChordTxt(st){
  const f = (x) => Number.isInteger(x) ? String(x) : x.toFixed(2);
  return `\n⟋ Хорда от начала до конца: пересечений с лесенкой <b>${st.cross}</b>` + (st.touch ? `, касаний ${st.touch}` : "") + ` (красные точки; касания — кружки).` +
    `\nПлощадь: под лесенкой (прямоугольники «1 × нулей до неё») <b>${st.under}</b>, над ней ${st.over}; между лесенкой и хордой <b>${f(st.between)}</b>` +
    (st.signed ? ` (перевес ${st.signed > 0 ? "над" : "под"} хордой ${f(Math.abs(st.signed))})` : "") + `.` +
    `\nОписанные: прямоугольник ${st.X}×${st.Z} = <b>${st.rect}</b>, квадрат ${Math.max(st.X, st.Z)}² = <b>${st.sq}</b>, круг π(X²+Z²)/4 ≈ <b>${f(st.circ)}</b>.`;
}
/* v0.056, «кнопку сохранения вида — до 3 пресетов»: вид = камера, масштаб, сдвиг. Пустой ① — щелчок запоминает;
   занятый — щелчок возвращает, правый щелчок перезаписывает, Shift + щелчок стирает. */
function viewPresetsUi(){
  const P = Z.viewPresets || [];
  document.querySelectorAll("#viewBtns button[data-p]").forEach(b => { const k = +b.dataset.p; b.classList.toggle("on", !!P[k]); });
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
/* v0.053, «когда выделена плоскость — с Ctrl и ещё кнопкой — сделай, чтобы по этой плоскости перпендикулярно
   вставать»: камера смотрит прямо на плоскость — к зрителю её ось (со стороны, с которой уже смотрели), а «вправо»
   экрана — ближайшая к нынешнему «вправо» ось мира в этой плоскости (как в 3D-программах, без лишнего вращения). */
function viewFacePlane(ax){
  const M = viewCamM(), a = ax === "x" ? [1, 0, 0] : ax === "y" ? [0, 1, 0] : [0, 0, 1];
  const dep = M[6] * a[0] + M[7] * a[1] + M[8] * a[2], v = a.map(c => dep < 0 ? -c : c);
  let r = null, best = -Infinity;
  for (let k = 0; k < 3; k++) if (!a[k]) for (const sg of [1, -1]) { const e = [0, 0, 0]; e[k] = sg; const dot = e[0] * M[0] + e[1] * M[1] + e[2] * M[2]; if (dot > best) { best = dot; r = e; } }
  const u = [v[1] * r[2] - v[2] * r[1], v[2] * r[0] - v[0] * r[2], v[0] * r[1] - v[1] * r[0]];   // вверх = к зрителю × вправо
  Z.viewM = [r[0], r[1], r[2], u[0], u[1], u[2], v[0], v[1], v[2]];
}
function viewTurn(dYaw, dPit){
  if (Z.viewMode !== "all" && viewLockAx) {
    // v0.053, «и стрелки сейчас вверх-вниз перпендикулярно — пусть лево-право»: ◀ ▶ — вращать в выделенной плоскости
    // (вокруг её оси), ▲ ▼ — наклон поперёк (вокруг горизонтали экрана); плоскость остаётся выделенной.
    Z.viewM = dYaw ? mMul(viewCamM(), mRotW(viewLockAx, dYaw)) : mMul(mRxS(dPit), viewCamM());
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
    $("viewModeHint").textContent = (viewLockAx ? `🔒 плоскость вокруг ${viewLockAx.toUpperCase()} выделена — ◀ ▶ вращают в ней, ▲ ▼ наклоняют, ⊥ — встать к ней (Esc — снять) · ` : "") + (!Z.viewSolo ? "щелчок по лесенке — выбрать строку · тянешь — вся стопка, с Ctrl — сдвиг · колесо — масштаб"
      : viewSel >= 0 && viewSel < N ? `✋ строка ${viewSel + 1} схвачена — тянешь её мышью: крутится она, с Ctrl — двигается; стрелки — вся стопка · щелчок по пустому — отпустить`
      : "щелчок по лесенке — схватить одну · тянешь пустое — вся стопка, с Ctrl — сдвиг · колесо — масштаб");
    $("viewOut").innerHTML = `Текущая строка ${Z.cur + 1} (ярче): ` + viewReading(s, viewCamM());
    return;
  }
  if (!all) {
    const camO = viewCam(), chord = Z.viewChord && Z.viewShape !== "comb" ? viewChordStats(s) : null;   // v0.056
    if (chord) camO.overlay = viewChordOverlay(chord);
    drawStair($("viewCv"), s, viewCamM(), 0, false,
      `строка ${Z.cur + 1} · ${s.length} бит` + (s.length > VIEW_MAX ? ` (нарисованы первые ${VIEW_MAX})` : "") + ` · ${viewName(viewCamM())}` + viewZoomTxt(), camO);
    $("viewModeHint").textContent = (viewLockAx ? `🔒 плоскость вокруг ${viewLockAx.toUpperCase()} выделена — ◀ ▶ вращают в ней, ▲ ▼ наклоняют, ⊥ — встать к ней (Esc — снять) · ` : "") + "колесо — масштаб · Ctrl + тянуть — сдвиг";
    $("viewOut").innerHTML = viewReading(s, viewCamM()) + (chord ? viewChordTxt(chord) : Z.viewChord && Z.viewShape === "comb" ? "\n⟋ Хорда — у лесенки; у гребёнки концов для неё нет." : "");
    return;
  }
  const N = Math.min(Z.rows.length, VIEW_CARDS), G = $("viewGrid");
  if (viewCardsN !== N || G.children.length !== N) {
    let h = "";
    for (let i = 0; i < N; i++) h += '<div class="vcard" data-r="' + i + '"><span class="vl">' + (i + 1) + '</span><canvas title="Тащи — повернуть эту строку; щелчок — сделать текущей"></canvas></div>';
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
  $("viewOut").innerHTML = `Текущая строка ${Z.cur + 1}: ` + viewReading(s, cy0, cp0);
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
    const order = [["w-mirror", 430], ["w-fix", 520], ["w-fold", 380], ["w-descent", 330], ["w-bwt", 460], ["w-sig", 460], ["w-chk", 460], ["w-view", 460], ["w-lin", 240], ["w-addr", 400], ["w-struct", 520], ["w-cone", 560], ["w-bal", 460], ["w-steps", 460], ["w-tiles", 560], ["w-pyr", 560], ["w-okt", 560], ["w-razv", 520], ["w-tri", 420],
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
    "w-struct":  { x: g, y: 2600 + 8 * g, w: mw, h: 520 },   // v0.042
    "w-cone":    { x: mw + 2 * g, y: 2600 + 8 * g, w: cw, h: 560 },   // v0.048
    "w-bal":     { x: g, y: 3140 + 9 * g, w: mw, h: 460 },   // v0.050
    "w-steps":   { x: mw + 2 * g, y: 3140 + 9 * g, w: cw, h: 460 },   // v0.062
    "w-tiles":   { x: g, y: 3600 + 10 * g, w: mw, h: 560 },   // v0.070
    "w-pyr":     { x: mw + 2 * g, y: 3600 + 10 * g, w: cw, h: 560 },   // v0.109
    "w-okt":     { x: g, y: 4160 + 11 * g, w: mw, h: 560 },   // v0.396
    "w-razv":    { x: mw + 2 * g, y: 4160 + 11 * g, w: cw, h: 560 },   // v0.398
    "w-tri":     { x: g, y: 4720 + 12 * g, w: mw, h: 420 },   // v0.432
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
    if (it.el.classList.contains("maxed")) {   // v0.095: развёрнутое на всю половину — вплотную, во всю ширину
      it.w.x = 0; it.w.w = D; it.el.style.left = "0px"; it.el.style.width = D + "px"; it.tx = 0;
      const Hd = $("desk").clientHeight; if (!it.w.collapsed && Hd > 200) { it.w.h = Hd; it.el.style.height = Hd + "px"; }   // и во всю видимую высоту
      continue;
    }
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
    let y = it.el.classList.contains("maxed") ? 0 : g;   // v0.095: развёрнутое — вплотную к верху
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
/* v0.141: страница одного окна (?solo=…) — остальные окна скрыты через style.display, поэтому winOpen их не считает и
   они ничего не пересчитывают; своё окно — развёрнуто, не пристыковано, во весь стол (стили body.solo). */
/* v0.158, «это всё (текст конуса и лог лазера) в отдельное окно с полным закрытием, плавающим везде, кнопку в верхнее меню»:
   #coneBot переезжает в #coneTxtWin — окно position:fixed поверх всего, тянется за шапку (не за край экрана), размер — за угол.
   ✕ закрывает совсем, «📝 Текст» в шапке открывает и закрывает. Z.ctw = { open, x, y, w, h } — в пикселях окна браузера. */
/* v0.326, по снимку окна «📝 Текст конуса и лог лазера» — «в низ конуса на всю длину, и с возможностью скрытия»: окно больше не плавает
   поверх всего — оно пристёгнуто к низу окна конуса полосой во всю его ширину, холст конуса кончается над ним (--ctwH). Тянешь заголовок
   вверх / вниз — высота; ▾ в заголовке (или двойной щелчок по нему) — скрыть текст, остаётся одна полоса-заголовок, ▴ — вернуть.
   «📝 Текст» в шапке и ✕ — убрать совсем, как прежде. Z.ctw = { open, h, min } (x, y, w прежнего плавающего окна больше не нужны). */
/* v0.349, по снимку полосы «📝 Текст конуса и лог лазера» поверх холста — «сделай как было: отдельная вкладка, но она привязана к Конусу
   ниже, либо отдельным окном в любое место, чтоб двигать»: окно текста снова своё (не внутри конуса, холст — во всё окно конуса), и у него
   два положения. 📌 приколото (по умолчанию) — стоит вплотную под окном конуса, той же ширины, ходит за ним; высота — за нижний край.
   Потянул за заголовок — открепилось и едет за мышью: свободное окно в любом месте, размер — за угол. 📌 — снова под конус. ▾ — свернуть до
   заголовка, ✕ — убрать (вернуть — «📝 Текст» в шапке). Z.ctw = { open, min, pin, h, x, y, w, fh } — fh: высота свободного окна */
function ctwInit(){
  const W = $("coneTxtWin"), cb = $("coneBot"), C = $("w-cone"); if (!W || !cb || !C) return;
  W.querySelector(".ctwBody").appendChild(cb); cb.style.top = "";
  document.body.appendChild(W);
  C.style.setProperty("--ctwH", "0px");   // холст конуса — до низа окна
  if (!Z.ctw || typeof Z.ctw !== "object") Z.ctw = { open: true };
  if (Z.ctw.pin === undefined) Z.ctw.pin = true;
  const head = W.querySelector(".ctwHead"), bMin = document.createElement("button"), bPin = document.createElement("button");
  bPin.id = "bCtwPin"; bPin.type = "button"; head.insertBefore(bPin, $("bCtwClose"));
  bMin.id = "bCtwMin"; bMin.type = "button"; head.insertBefore(bMin, $("bCtwClose"));
  let raf = 0, last = "";
  const coneBox = () => { if (!C.isConnected || C.classList.contains("collapsed") || getComputedStyle(C).display === "none") return null; const r = C.getBoundingClientRect(); return r.width > 20 ? r : null; };
  const place = () => {   // приколотое — под конусом; свободное — где поставили, но в пределах экрана
    const c = Z.ctw, min = !!c.min, vw = innerWidth, vh = innerHeight;
    if (c.pin) {
      const r = coneBox(); W.style.visibility = r ? "" : "hidden"; if (!r) return;
      const h = min ? head.offsetHeight + 2 : c.h, top = Math.min(Math.round(r.bottom + 2), vh - h);
      const L = Math.max(0, Math.round(r.left)), R = Math.min(vw, Math.round(r.right)), wd = Math.max(220, R - L);   // v0.352: не шире экрана
      const k = [L, top, wd, h, min].join(); if (k === last) return; last = k;
      W.style.left = Math.min(L, Math.max(0, vw - wd)) + "px"; W.style.top = Math.max(0, top) + "px"; W.style.width = wd + "px";
      W.style.height = min ? "" : c.h + "px";
    } else {
      W.style.visibility = ""; last = "";
      const w = Math.max(220, Math.min(c.w || 420, vw)), h = min ? head.offsetHeight + 2 : Math.max(110, Math.min(c.fh || 260, vh));
      // v0.352, по снимку окна, обрезанного справа, — «всё нераскрыто, надо, чтоб видно было»: свободное окно — целиком на экране (с кнопками 📌 ▾ ✕)
      c.x = Math.max(0, Math.min(Math.round(c.x ?? 40), vw - w)); c.y = Math.max(0, Math.min(Math.round(c.y ?? 80), vh - (min ? 30 : h)));
      W.style.left = c.x + "px"; W.style.top = c.y + "px"; W.style.width = w + "px"; W.style.height = min ? "" : h + "px";
    }
  };
  const loop = () => { raf = 0; if (Z.ctw.open === false || !Z.ctw.pin) return; place(); raf = requestAnimationFrame(loop); };   // за окном конуса — каждый кадр (его тащат, растягивают, прокручивают стол)
  const lay = () => {
    const c = Z.ctw, open = c.open !== false, min = !!c.min;
    c.h = Math.max(60, Math.min(Math.round(c.h) || 180, innerHeight - 40));
    W.hidden = !open; W.classList.toggle("min", min); W.classList.toggle("pin", !!c.pin); W.classList.toggle("free", !c.pin);
    $("bConeTxt").classList.toggle("on", open);
    bMin.textContent = min ? "▴" : "▾"; bMin.title = min ? "Показать текст конуса и лог лазера" : "Свернуть до заголовка (двойной щелчок по заголовку — то же)";
    bPin.classList.toggle("on", !!c.pin);
    bPin.title = c.pin ? "📌 Приколото под конусом — ходит за ним. Потяни за заголовок — открепить и поставить куда угодно" : "📌 Приколоть под окно конуса";
    bPin.textContent = "📌";
    last = ""; place();
    if (open && c.pin && !raf) raf = requestAnimationFrame(loop);
  };
  const flip = () => { Z.ctw.min = !Z.ctw.min; lay(); save(); };
  bMin.onclick = flip;
  bPin.onclick = () => { Z.ctw.pin = !Z.ctw.pin; lay(); save(); };
  head.addEventListener("dblclick", (e) => { if (!e.target.closest("button")) flip(); });
  $("bConeTxt").onclick = () => { Z.ctw.open = Z.ctw.open === false; lay(); save(); };
  $("bCtwClose").onclick = () => { Z.ctw.open = false; lay(); save(); };
  head.addEventListener("pointerdown", (e) => {   // заголовок — хват: тянешь — окно открепляется и едет за мышью
    if (e.button !== 0 || e.target.closest("button")) return;
    e.preventDefault(); head.setPointerCapture(e.pointerId);
    const r = W.getBoundingClientRect(), x0 = e.clientX, y0 = e.clientY; let moved = false;
    const mv = (ev) => {
      if (!moved && Math.abs(ev.clientX - x0) + Math.abs(ev.clientY - y0) < 4) return;
      if (!moved) { moved = true; const c = Z.ctw; if (c.pin) { c.pin = false; c.w = Math.round(r.width); if (!c.min) c.fh = Math.round(r.height); } }
      Z.ctw.x = Math.round(r.left + ev.clientX - x0); Z.ctw.y = Math.round(r.top + ev.clientY - y0); lay();
    };
    const up = () => { head.removeEventListener("pointermove", mv); head.removeEventListener("pointerup", up); head.removeEventListener("pointercancel", up); if (moved) save(); };
    head.addEventListener("pointermove", mv); head.addEventListener("pointerup", up); head.addEventListener("pointercancel", up);
  });
  // размер рукой (угол свободного окна, нижний край приколотого) — запомнить
  if (window.ResizeObserver) new ResizeObserver(() => {
    const c = Z.ctw; if (W.hidden || c.min) return;
    const w = Math.round(W.offsetWidth), h = Math.round(W.offsetHeight);
    if (c.pin) { if (Math.abs(h - c.h) > 1) { c.h = h; last = ""; save(); } }
    else if (Math.abs(w - (c.w || 0)) > 1 || Math.abs(h - (c.fh || 0)) > 1) { c.w = w; c.fh = h; save(); }
  }).observe(W);
  addEventListener("resize", () => { last = ""; place(); });
  lay();
}
/* v0.177, по снимку полосы групп конуса — «возможность перетаскивать каждую группу в любое место, с фоновым перекрытием всех ниже»:
   группу (Вид, Кольца, Кручение, Лазер) тянут за её подпись — она выходит из полосы и висит поверх холста на непрозрачной подложке,
   последняя тронутая — сверху. Двойной щелчок по подписи — обратно на полосу. Места — Z.cgrpPos { имя: { x, y } } в пикселях от
   угла полосы; меняет их только перетаскивание (сами не выравниваются и не переставляются). */
// v0.258: кнопка или галка (метка с флажком), которая переезжает между группами конуса, и её место по ссылке ("#id" или селектор)
/* v0.400, по снимку магнита Октаэдра — «такое же примагничивание надо» (группы конуса, окна): край ближе snap px к краю цели — встаёт на него,
   по горизонтали и вертикали отдельно, ближайший; цели — [элемент, прямоугольник], экранные координаты. Те, к кому прилипли, светятся (.zsnap). */
let zSnapOn = [];
function zSnapGlow(els){
  zSnapOn.forEach(e => { if (!els.includes(e)) e.classList.remove("zsnap"); });
  els.forEach(e => e.classList.add("zsnap")); zSnapOn = els.slice();
}
function zSnapTo(x, y, w, h, targets, snap){
  let dx = snap + 1, dy = snap + 1, ex = null, ey = null;
  for (const [el, q, ov = 0] of targets) {   // v0.478: ov — насколько встык заходить на цель (группа к группе — 1 px: рамка на рамку)
    for (const [t, v] of [[q.left, x], [q.right, x + w], [q.left + ov, x + w], [q.right - ov, x]]) if (Math.abs(t - v) < Math.abs(dx)) { dx = t - v; ex = el; }
    for (const [t, v] of [[q.top, y], [q.bottom, y + h], [q.top + ov, y + h], [q.bottom - ov, y]]) if (Math.abs(t - v) < Math.abs(dy)) { dy = t - v; ey = el; }
  }
  const hit = [];
  if (Math.abs(dx) <= snap) { x += dx; if (ex) hit.push(ex); }
  if (Math.abs(dy) <= snap) { y += dy; if (ey && !hit.includes(ey)) hit.push(ey); }
  return [x, y, hit];
}
function cgrpMoveEl(src){   // v0.320: кнопка из блока .cunit (◀ [ось] ▶) переезжает вместе со всем блоком
  const u = src && src.closest && src.closest(".cunit"); if (u) return u;
  return src && src.tagName === "INPUT" ? src.closest("label") : src;
}
function cgrpRefEl(k){ try { return k ? (k[0] === "#" ? document.getElementById(k.slice(1)) : document.querySelector(k)) : null; } catch (err) { return null; } }
function cgrpInit(){
  const tl = document.querySelector("#w-cone .wbody > .tools"); if (!tl) return;
  if (!Z.cgrpPos || typeof Z.cgrpPos !== "object") Z.cgrpPos = {};
  if (!Z.cgrpMin || typeof Z.cgrpMin !== "object") Z.cgrpMin = {};   // v0.204: свёрнутые до заголовка
  if (!Z.cgrpSize || typeof Z.cgrpSize !== "object") Z.cgrpSize = {};   // v0.315: размер, заданный уголком { имя: { w, h } }
  /* v0.348, «наборы кнопок — кроме тех, что только для конуса (кручение, кольца), — если переместить целиком на поле строк, то дать туда
     попасть, если частью — то так же, как сейчас»: группа, отпущенная ЦЕЛИКОМ над полем строк, встаёт поверх поля (.cfld, position: fixed)
     и ездит вместе с ним (ширина поля, панель, окно). Место — Z.cgrpFld { имя: { x, y } } от угла поля. Частью — как прежде: над холстом,
     прижатая к окну конуса. Назад — вытащить с поля или правый щелчок по заголовку. Кольца и Кручение на поле не встают. Поле спрятано,
     дзен или страница одного конуса — группа на полосе конуса, место на поле помнится */
  if (!Z.cgrpFld || typeof Z.cgrpFld !== "object") Z.cgrpFld = {};
  const FLD_NO = { "кольца": 1, "кручение": 1 };
  const fldRect = () => { const F = $("field"), B = document.body.classList; if (!F || B.contains("field-hidden") || B.contains("zen") || B.contains("solo")) return null; const r = F.getBoundingClientRect(); return r.width > 20 && r.height > 20 ? r : null; };
  const fldFits = (g, gr) => { if (FLD_NO[g.dataset.g]) return false; const fr = fldRect(); return !!fr && gr.left >= fr.left - 1 && gr.top >= fr.top - 1 && gr.right <= fr.right + 1 && gr.bottom <= fr.bottom + 1; };
  // v0.315: размер группы — уголком; у свёрнутой (cmin) — свой, до заголовка
  /* v0.332, по снимку группы «Вид», сжатой уголком до одной подписи, — «кнопки, если не помещаются в группе, — не давать размера»: группа
     не уже самой широкой кнопки и не ниже, чем нужно её кнопкам при этой ширине. Сохранённый размер не переписывается — меньший просто
     показывается нужным, а запоминается то, что видно, когда уголок отпустили. */
  const sizeApply = (g) => {
    { const s0 = Z.cgrpSize[g.dataset.g]; if (s0 && s0.w > Math.max(screen.availWidth || 0, window.innerWidth, 800)) { delete Z.cgrpSize[g.dataset.g]; save(); } }   // v0.505: шире экрана — сбой (см. ручку), размер снят
    const s = !g.classList.contains("cmin") && Z.cgrpSize[g.dataset.g]; g.classList.toggle("csz", !!s);
    if (!s) { g.style.width = g.style.height = ""; if (typeof tzcApply === "function") tzcApply(g); return; }
    g.style.width = Math.max(s.w, tzMinW(g)) + "px"; g.style.height = "";   // v0.334: высота — всегда по кнопкам; v0.480 — и не уже самого широкого блока
    if (typeof tzcApply === "function") tzcApply(g);   // v0.453: группа-конструктор переносит ряды рисунка под новую ширину
    if (typeof tzgFrame === "function") tzgFrame(g);   // v0.482: рамка — сразу под новый размер (иначе угол с ручкой-ромбом на миг вне рамки и не хватается)
    const b = g.querySelector(":scope > .cgb"); if (!b) return;
    if (b.scrollWidth > b.clientWidth + 1) g.style.width = (s.w + b.scrollWidth - b.clientWidth) + "px";   // не уже самой широкой кнопки
    /* v0.334, «не давать размера больше, если пустые области появляются»: ширина прижимается к правому краю самого длинного ряда кнопок —
       справа пустого места нет, и шире, чем все кнопки в один ряд, группа не становится */
    const br = b.getBoundingClientRect(); let right = br.left;
    for (const c of b.children) { const r = c.getBoundingClientRect(); if (r.width) right = Math.max(right, r.right); }
    const extra = Math.floor(br.right - right - 1); if (right > br.left && extra > 0) g.style.width = (parseFloat(g.style.width) - extra) + "px";
  };
  const NOGRAB = "button, input, select, textarea, label, a, canvas, .gzen, .cgsz";   // v0.315: всё остальное в группе — хват
  const wb = tl.parentElement; let zTop = 10;
  const groups = [...tl.querySelectorAll(":scope > .cgrp")];
  /* v0.238, по снимку групп «Аниматрица», «Лазер», «Кручение» — «все кнопки разъехались — компактными, и размер стандартизируй»: кнопки
     группы — в своём блоке .cgb рядом с подписью (подпись — хват во всю высоту, как было), блок переносится компактно; размеры — в CSS. */
  groups.forEach((g) => {
    if (g.querySelector(":scope > .cgb")) return;
    const b = document.createElement("div"); b.className = "cgb";
    [...g.childNodes].forEach((c) => { if (!(c.nodeType === 1 && c.classList.contains("glab"))) b.appendChild(c); });
    g.appendChild(b);
  });
  // v0.320: значок ползунка (текст перед ним в метке: ↕ ▬ ♩ 🔊 щель) — в свой span.sli, чтобы встать столбцом одной ширины
  groups.forEach((g) => g.querySelectorAll("label").forEach((l) => {
    if (!l.querySelector("input[type=range]")) return;
    const f = l.firstChild; if (!f || f.nodeType !== 3 || !f.textContent.trim()) return;
    const sp = document.createElement("span"); sp.className = "sli"; sp.textContent = f.textContent.trim(); l.replaceChild(sp, f);
  }));
  /* v0.327, по снимку «256 стр. · сид 1» — «текст убрать в поля»: подпись у числового / текстового поля группы — внутри самого поля:
     что стояло перед полем (сид, от, ↔, ⌖×) — слева в нём (.fpre), что после (стр., °) — справа (.fpost); поле отступает под них */
  groups.forEach((g) => g.querySelectorAll("label").forEach((l) => {
    const inp = l.querySelector("input[type=number], input[type=text]"); if (!inp || l.querySelector("input[type=range], input[type=checkbox]")) return;
    const pre = [], post = []; let after = false;
    [...l.childNodes].forEach((n) => { if (n === inp) after = true; else if (n.nodeType === 3 && n.textContent.trim()) (after ? post : pre).push(n); });
    if (!pre.length && !post.length) return;
    const mk = (nodes, cls) => { if (!nodes.length) return 0; const t = nodes.map(n => n.textContent.trim()).join(" "); nodes.forEach(n => n.remove()); const sp = document.createElement("span"); sp.className = cls; sp.textContent = t; l.appendChild(sp); return [...t].length; };
    const a = mk(pre, "fpre"), b = mk(post, "fpost"); l.classList.add("fin");
    if (a) inp.style.paddingLeft = `calc(${a}ch + 6px)`;
    if (b) inp.style.paddingRight = `calc(${b}ch + 6px)`;
  }));
  /* v0.366: магнит — край тащимой группы ближе SNAP px к краю окна конуса, поля строк или другой группы (любой стороной: вплотную или вровень) —
     встаёт ровно на него; по горизонтали и вертикали — отдельно, ближайший край. Координаты — экранные */
  const SNAP = 10;
  /* v0.502, по снимку «Вида» и «Аниматрицы» рядом — «примагничивать к левой группе, размагничивать при перемещении правой»: группа, поднесённая
     к соседней сбоку (ближе SNAP), входит в неё зубцами — выемки левого края на острия правого края соседки (заходит на t), ряд в ряд (шаг 24 px).
     Отпустил так — правая прицеплена к левой (Z.cgrpLink { правая: { to: левая, dy } }): левую двигают, растягивают, перестраивают — правая едет
     следом (linkSync); правую потянул — отцепилась. «И верхняя — нижняя так же, верхняя главная»: поднесённая под группу (или над ней) встаёт рамка
     на рамку (заходит на 1 px), левые края вровень, если близко; нижняя прицеплена к верхней ({ to, v: 1, dx }) */
  if (!Z.cgrpLink || typeof Z.cgrpLink !== "object") Z.cgrpLink = {};
  const gByKey = (k) => groups.find(o => o.dataset.g === k);
  const linkCycle = (right, left) => { for (let k = left, n = 0; k && n < 20; k = Z.cgrpLink[k] && Z.cgrpLink[k].to, n++) if (k === right) return true; return false; };
  const meshSnap = (g, x, y, w, h) => {
    const t = TZC_H / (2 * Math.sqrt(3)), P = TZC_H; let best = null;
    groups.forEach(o => {
      if (o === g || o.parentElement !== tl || !o.getClientRects().length || o.classList.contains("cfld") || !o.classList.contains("tzg")) return;
      const q = o.getBoundingClientRect(); if (q.width < 4 || y >= q.bottom - P / 2 || y + h <= q.top + P / 2) return;
      const yy = q.top + Math.round((y - q.top) / P) * P;
      for (const [side, xx] of [["r", q.right - t], ["l", q.left - w + t]]) {
        const d = Math.abs(x - xx); if (d >= SNAP + t || (best && d >= best.d)) continue;   // зона — и на глубину зубца (иначе брал простой магнит край в край)
        if (side === "r" ? linkCycle(g.dataset.g, o.dataset.g) : linkCycle(o.dataset.g, g.dataset.g)) continue;
        best = { d, x: xx, y: yy, o, side };
      }
    });
    groups.forEach(o => {   // сверху вниз: рамка на рамку
      if (o === g || o.parentElement !== tl || !o.getClientRects().length || o.classList.contains("cfld") || !o.classList.contains("tzg")) return;
      const q = o.getBoundingClientRect(); if (q.width < 4 || x >= q.right - P / 2 || x + w <= q.left + P / 2) return;
      const xx = Math.abs(x - q.left) < SNAP ? q.left : x;
      for (const [side, yy] of [["b", q.bottom - 1], ["t", q.top - h + 1]]) {
        const d = Math.abs(y - yy); if (d >= SNAP || (best && d >= best.d)) continue;
        if (side === "b" ? linkCycle(g.dataset.g, o.dataset.g) : linkCycle(o.dataset.g, g.dataset.g)) continue;
        best = { d, x: xx, y: yy, o, side };
      }
    });
    return best;
  };
  let linkSaveT = 0;
  const linkSync = () => {
    const tr = tl.getBoundingClientRect(), t = TZC_H / (2 * Math.sqrt(3)); let ch = false;
    for (let pass = 0; pass < 6; pass++) { let any = false;
      for (const [k, L] of Object.entries(Z.cgrpLink)) {
        const g = gByKey(k), o = L && gByKey(L.to);
        if (!g || !o) { delete Z.cgrpLink[k]; continue; }
        if (g.parentElement !== tl || o.parentElement !== tl || g.classList.contains("cdrag") || Z.cgrpFld[k] || Z.cgrpFld[L.to] || !o.getClientRects().length || !g.getClientRects().length) continue;
        const q = o.getBoundingClientRect(), x = L.v ? q.left - tr.left + (L.dx || 0) : q.right - t - tr.left, y = L.v ? q.bottom - 1 - tr.top : q.top - tr.top + (L.dy || 0), p = Z.cgrpPos[k];
        if (!p || Math.abs(p.x - x) > 0.5 || Math.abs(p.y - y) > 0.5) { Z.cgrpPos[k] = { x, y }; place(g); any = ch = true; }
      }
      if (!any) break; }
    if (ch && !document.body.classList.contains("cgdrag")) { clearTimeout(linkSaveT); linkSaveT = setTimeout(save, 400); }
  };
  setInterval(() => { if (!document.hidden) linkSync(); }, 300);
  const snapXY = (g, x, y, w, h) => {   // v0.400: через zSnapTo — и с подсветкой того, к чему прилипла
    const m = meshSnap(g, x, y, w, h); g._mesh = m;   // v0.502: зубцы в зубцы — сильнее прочего магнита
    if (m) { zSnapGlow([m.o]); return [m.x, m.y]; }
    const T = [], add = (el, ov) => { if (!el || !el.getClientRects().length) return; const q = el.getBoundingClientRect(); if (q.width > 4 && q.height > 4) T.push([el, q, ov || 0]); };
    /* v0.478, «магнитить только там, но без щелей — обводка на обводку ложить»: группа к группе встык заходит на 1 px — их рамки ложатся одна на другую */
    add(wb); add($("field")); groups.forEach(o => { if (o !== g) add(o, 1); });
    const [sx, sy, hit] = zSnapTo(x, y, w, h, T, SNAP); zSnapGlow(hit); return [sx, sy];
  };
  const place = (g) => {
    const f = !FLD_NO[g.dataset.g] && g.parentElement === tl && Z.cgrpFld[g.dataset.g], fr = f && fldRect();   // v0.348: на поле строк
    g.classList.toggle("cfld", !!fr);
    if (fr) {
      g.classList.add("cfloat"); const gw = g.offsetWidth, gh = g.offsetHeight;
      const x = Math.max(0, Math.min(f.x, fr.width - gw)), y = Math.max(0, Math.min(f.y, fr.height - gh));
      g.style.left = Math.round(fr.left + x) + "px"; g.style.top = Math.round(fr.top + y) + "px"; return;
    }
    const p = Z.cgrpPos[g.dataset.g]; g.classList.toggle("cfloat", !!p);
    if (!p) { g.style.left = g.style.top = ""; return; }
    const tr = tl.getBoundingClientRect(), br = wb.getBoundingClientRect(), gw = g.offsetWidth, gh = g.offsetHeight;
    /* v0.215, «пусть вкладки уезжают за поле строк, но не заголовком»: вправо группа может уйти за край окна (под поле строк), а край держит
       только её заголовок — он всегда виден, за него и вытаскивают обратно. Влево заголовок первым, поэтому там — как было. */
    /* v0.366, по снимку «Кольца», ушедших под поле строк, — «группы не скрывать теперь, а примагничивать к границам, всем, по всему периметру»:
       группа — всегда целиком внутри окна конуса (v0.215 «уезжают под поле строк» снято); притягивается к краям при перетаскивании (snapXY) */
    const x = Math.max(br.left - tr.left, Math.min(p.x, br.right - tr.left - gw)), y = Math.max(br.top - tr.top, Math.min(p.y, br.bottom - tr.top - gh));
    g.style.left = Math.round(x) + "px"; g.style.top = Math.round(y) + "px";
  };
  groups.forEach((g) => {
    const lab = g.querySelector(".glab"); if (!lab) return;
    g.dataset.g = lab.textContent.trim().toLowerCase();
    /* v0.256, «в режиме дзен показывать все кнопки и группы вкладок, которые отмечу (надо у них кнопку сделать)»: 🧘 в заголовке группы —
       отметить; отмеченные группы видны и в дзене (поверх конуса, где стоят; с левой панели — на время дзена у верхнего края). Z.cgrpZen. */
    if (!Z.cgrpZen || typeof Z.cgrpZen !== "object") Z.cgrpZen = {};
    if (!Z.zenGrpInit) { Z.cgrpZen["дзен"] = true; Z.zenGrpInit = 1; }   // v0.281: группа «Дзен» — видна в дзене с первого раза (дальше — как отметишь 🧘)
    const zb = document.createElement("span"); zb.className = "gzen"; lab.appendChild(zb);
    { const tb = document.createElement("span"); tb.className = "gtri"; tb.textContent = "△"; lab.appendChild(tb);   // v0.452: конструктор группы в «△ Сетке»
      tb.title = "△ Конструктор: группа — в окне «△ Сетка» треугольниками; крась и стирай — кнопки встают по рисунку";
      tb.addEventListener("pointerdown", (e) => { e.stopPropagation(); e.preventDefault(); if (e.button !== 0) return; tzcOpen(g); });
      tb.addEventListener("dblclick", (e) => e.stopPropagation()); }
    /* v0.495, «у каждой группы независимый цвет фона нажатой кнопки свой пусть»: фон нажатых — цветом самой группы (--gon, по умолчанию — цвет
       заголовка); ◆ в заголовке (закрашен тем фоном) — выбрать свой, правый щелчок — снова цвет группы. Z.cgrpOnC { имя: "#rrggbb" } */
    if (!Z.cgrpOnC || typeof Z.cgrpOnC !== "object") Z.cgrpOnC = {};
    { const ob = document.createElement("span"); ob.className = "gon"; ob.textContent = "◆"; lab.appendChild(ob);
      const onUi = () => { const c = Z.cgrpOnC[g.dataset.g]; if (c) g.style.setProperty("--gon", c); else g.style.removeProperty("--gon");
        ob.title = "◆ Цвет нажатых кнопок группы" + (c ? " — свой (правый щелчок — снова цвет группы)" : " — цвет группы; щелчок — выбрать свой"); };
      onUi();
      ob.addEventListener("pointerdown", (e) => { e.stopPropagation(); e.preventDefault(); if (e.button !== 0) return;
        const inp = document.createElement("input"); inp.type = "color"; inp.style.cssText = "position:fixed;left:" + e.clientX + "px;top:" + e.clientY + "px;width:0;height:0;opacity:0;border:0;padding:0";
        const rgb = (getComputedStyle(lab).color.match(/\d+(\.\d+)?/g) || []).slice(0, 3).map(Number), hex = (a) => "#" + a.map(v => Math.round(v).toString(16).padStart(2, "0")).join("");
        inp.value = Z.cgrpOnC[g.dataset.g] || (rgb.length === 3 ? hex(rgb) : "#888888");
        inp.addEventListener("input", () => { Z.cgrpOnC[g.dataset.g] = inp.value; onUi(); save(); });
        inp.addEventListener("change", () => { Z.cgrpOnC[g.dataset.g] = inp.value; onUi(); save(); inp.remove(); });
        inp.addEventListener("blur", () => setTimeout(() => inp.remove(), 0));
        document.body.appendChild(inp); inp.click(); });
      ob.addEventListener("contextmenu", (e) => { e.preventDefault(); e.stopPropagation(); if (!Z.cgrpOnC[g.dataset.g]) return; delete Z.cgrpOnC[g.dataset.g]; onUi(); save(); say("◆ Нажатые кнопки группы — снова её цветом."); });
      ob.addEventListener("dblclick", (e) => e.stopPropagation()); }
    // v0.367: закрытая группа (Z.cgrpOff) не видна; у «Гаммы» — ✕ закрыть (открыть — «🎨» в шапке)
    if (!Z.cgrpOff || typeof Z.cgrpOff !== "object") Z.cgrpOff = {};
    g.classList.toggle("coff", !!Z.cgrpOff[g.dataset.g]);
    if (g.dataset.g === "гамма") {
      const x = document.createElement("span"); x.className = "gx"; x.textContent = "✕"; x.title = "Закрыть группу «Гамма» (открыть — «🎨» в шапке)"; lab.appendChild(x);
      x.addEventListener("pointerdown", (e) => { e.stopPropagation(); e.preventDefault(); if (e.button !== 0) return; window.cgrpHide("гамма"); });
      x.addEventListener("dblclick", (e) => e.stopPropagation());
    }
    const zUi = () => { const on = !!Z.cgrpZen[g.dataset.g]; g.classList.toggle("zenon", on); zb.textContent = "🧘"; zb.title = on ? "🧘 Видна в дзене — щелчок: не показывать" : "🧘 Показывать эту группу и в дзене"; };
    zUi();
    zb.addEventListener("pointerdown", (e) => { e.stopPropagation(); e.preventDefault(); if (e.button !== 0) return; const k = g.dataset.g; if (Z.cgrpZen[k]) delete Z.cgrpZen[k]; else Z.cgrpZen[k] = true; zUi(); save();
      say(Z.cgrpZen[k] ? `🧘 Группа «${k}» — видна и в дзене.` : `🧘 Группа «${k}» в дзене не видна.`); });
    zb.addEventListener("dblclick", (e) => e.stopPropagation());
    lab.title = "Тяни (за подпись или любое пустое место группы) — перенести группу куда угодно (поверх холста); двойной щелчок по группе — свернуть до заголовка и обратно; правый щелчок по заголовку — обратно на полосу";
    g.classList.toggle("cmin", !!Z.cgrpMin[g.dataset.g]);
    g.style.minHeight = Z.cgrpMin[g.dataset.g] > 0 ? Z.cgrpMin[g.dataset.g] + "px" : "";   // v0.207: свёрнутая — прежней высоты
    { const sz = document.createElement("span"); sz.className = "cgsz"; sz.title = "Тяни — размер группы; двойной щелчок — прежний размер"; g.appendChild(sz);
      sz.addEventListener("pointerdown", (e) => {
        if (e.button !== 0) return;
        e.preventDefault(); e.stopPropagation(); try { sz.setPointerCapture(e.pointerId); } catch (err) { /* уже отпущен */ }
        const r = g.getBoundingClientRect(), x0 = e.clientX, y0 = e.clientY; let moved = false;
        const mv = (ev) => { moved = true; Z.cgrpSize[g.dataset.g] = { w: Math.max(60, Math.round(r.width + ev.clientX - x0)), h: Math.max(24, Math.round(r.height + ev.clientY - y0)) }; sizeApply(g); };
        const up = () => { sz.removeEventListener("pointermove", mv); sz.removeEventListener("pointerup", up); sz.removeEventListener("pointercancel", up);
          if (moved) { const q = Z.cgrpSize[g.dataset.g]; Z.cgrpSize[g.dataset.g] = { w: Math.min(q ? q.w : 1e9, g.offsetWidth), h: g.offsetHeight }; place(g); save(); } };   // v0.332: помнится то, что видно
          /* v0.505, по снимку «Вида» в одну строку — «ширина съехала» (в настройках — 3922 px): запоминалась видимая ширина, а группа конструктора бывает шире
             заданной (перенос рисунка) — каждое касание ромба прибавляло. Теперь — не больше того, что задано ручкой */
        sz.addEventListener("pointermove", mv); sz.addEventListener("pointerup", up); sz.addEventListener("pointercancel", up);
      });
      sz.addEventListener("dblclick", (e) => { e.preventDefault(); e.stopPropagation(); if (!Z.cgrpSize[g.dataset.g]) return; delete Z.cgrpSize[g.dataset.g]; sizeApply(g); place(g); save(); });
    }
    sizeApply(g);
    /* v0.354, «прокрутка на группе кнопок — в Конусе например — так же, как на поле конуса, а не скролл панелей надо»: колесо над группой
       конуса (на полосе и поверх холста) — то же, что над холстом: масштаб конуса вокруг курсора; над группой на поле строк — листает
       строки. Стол с окнами при этом не едет. Группы на левой панели — как прежде (листают панель), число или список в фокусе — меняют
       своё значение, Ctrl + колесо — масштаб страницы */
    g.addEventListener("wheel", (e) => {
      if (g.parentElement !== tl || e.ctrlKey || e.metaKey) return;
      const a = document.activeElement; if (a && g.contains(a) && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName) && a.contains(e.target)) return;
      e.preventDefault();
      if (g.classList.contains("cfld")) { const L = $("rowList"); if (L) { const k = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? L.clientHeight : 1; L.scrollTop += e.deltaY * k; L.scrollLeft += e.deltaX * k; } return; }
      const cv = $("coneCv"); if (cv) cv.dispatchEvent(new WheelEvent("wheel", { deltaX: e.deltaX, deltaY: e.deltaY, deltaMode: e.deltaMode, clientX: e.clientX, clientY: e.clientY, bubbles: true, cancelable: true }));
    }, { passive: false });
    g.addEventListener("pointerdown", (e) => {   // v0.315: прежде — только за подпись (lab), теперь за любое пустое место группы
      if (e.button !== 0 || e.target.closest(NOGRAB)) return;
      e.preventDefault(); try { g.setPointerCapture(e.pointerId); } catch (err) { /* уже отпущен */ }
      /* v0.252: пока тащат — группа висит над всей страницей (.cdrag, position: fixed), отпустил — решается, куда: над левой панелью —
         встаёт туда (в ряд с другими, перед той, над которой отпустил), иначе — висит поверх холста, как прежде (Z.cgrpPos). */
      const r = g.getBoundingClientRect(), x0 = e.clientX, y0 = e.clientY, dx = x0 - r.left, dy = y0 - r.top; let moved = false, lx = x0, ly = y0;
      g.style.zIndex = ++zTop;
      const mv = (ev) => {
        if (!moved && Math.abs(ev.clientX - x0) + Math.abs(ev.clientY - y0) < 4) return;
        if (!moved) { moved = true; g.style.width = r.width + "px"; g.classList.add("cdrag"); document.body.classList.add("cgdrag"); delete Z.cgrpLink[g.dataset.g]; }   // v0.502: потянул правую — отцепилась
        lx = ev.clientX; ly = ev.clientY;
        { const [sx, sy] = snapXY(g, lx - dx, ly - dy, r.width, g.offsetHeight); g.style.left = sx.toFixed(2) + "px"; g.style.top = Math.round(sy) + "px"; }   // v0.366: магнит
        linkSync();   // v0.502: прицепленные справа — следом
        const P = $("rowsPane"); if (P) P.classList.toggle("cgover", paneHit(lx, ly));   // (в дзене панели нет — paneHit ложь)
        const F = $("field"); if (F) F.classList.toggle("cgover", !paneHit(lx, ly) && fldFits(g, g.getBoundingClientRect()));   // v0.348: целиком над полем
      };
      const up = () => {
        g.removeEventListener("pointermove", mv); g.removeEventListener("pointerup", up); g.removeEventListener("pointercancel", up);
        if (!moved) return;
        const gr = g.getBoundingClientRect(), onF = !paneHit(lx, ly) && fldFits(g, gr), F = $("field"); if (F) F.classList.remove("cgover");   // v0.348
        g.classList.remove("cdrag"); document.body.classList.remove("cgdrag"); sizeApply(g); const P = $("rowsPane"); if (P) P.classList.remove("cgover"); zSnapGlow([]);   // v0.400
        if (paneHit(lx, ly)) { delete Z.cgrpFld[g.dataset.g]; dock(g, lx, ly); save(); return; }
        if (g.parentElement !== tl) undock(g);
        if (onF) { const fr = fldRect(); Z.cgrpFld[g.dataset.g] = { x: Math.round(gr.left - fr.left), y: Math.round(gr.top - fr.top) }; delete Z.cgrpPos[g.dataset.g]; place(g); save(); return; }   // v0.348: целиком на поле строк
        delete Z.cgrpFld[g.dataset.g];
        const tr = tl.getBoundingClientRect(); Z.cgrpPos[g.dataset.g] = { x: gr.left - tr.left, y: gr.top - tr.top }; place(g);
        { const m = g._mesh; g._mesh = null;   // v0.502: отпустил зубцами в соседку — прицепить правую к левой
          if (m && m.o.parentElement === tl) { const q = m.o.getBoundingClientRect(), g2 = g.getBoundingClientRect();
            const mine = m.side === "r" || m.side === "b", kid = mine ? g : m.o, par = mine ? m.o : g, kr = mine ? g2 : q, pr = mine ? q : g2;
            Z.cgrpLink[kid.dataset.g] = m.side === "r" || m.side === "l" ? { to: par.dataset.g, dy: Math.round(kr.top - pr.top) } : { to: par.dataset.g, v: 1, dx: Math.round(kr.left - pr.left) };
            if (!Z.cgrpPos[kid.dataset.g]) Z.cgrpPos[kid.dataset.g] = { x: kr.left - tr.left, y: kr.top - tr.top };
            say(`🧲 «${kid.dataset.g}» прицеплена ${m.side === "r" || m.side === "l" ? "справа" : "снизу"} к «${par.dataset.g}» — едет за ней; потянешь — отцепится.`); }
          linkSync(); }
        save();
      };
      g.addEventListener("pointermove", mv); g.addEventListener("pointerup", up); g.addEventListener("pointercancel", up);
    });
    /* v0.204, по снимку группы «Аниматрица» — «двойной клик по группе сворачивает её до заголовка»: двойной щелчок по заголовку или
       пустому месту группы (не по кнопке, полю, списку) — свернуть до заголовка, ещё раз — развернуть; Z.cgrpMin { имя: true }. Возврат
       вынесенной группы на полосу, что был на двойном щелчке по заголовку (v0.177), — теперь правый щелчок по заголовку. */
    g.addEventListener("dblclick", (e) => {
      if (e.target.closest("button, input, select, textarea, label, .gzen, .cgsz")) return;
      e.preventDefault(); e.stopPropagation();
      /* v0.207, «высота остаётся как была — нужно»: свёрнутая группа сужается до заголовка, а высоту держит прежнюю (Z.cgrpMin — её пиксели),
         чтобы соседние группы и полоса не прыгали. */
      const key = g.dataset.g, on = !Z.cgrpMin[key];
      if (on) Z.cgrpMin[key] = g.offsetHeight; else delete Z.cgrpMin[key];
      g.classList.toggle("cmin", on); g.style.minHeight = on ? Z.cgrpMin[key] + "px" : ""; cgbSnap(); sizeApply(g); cgrpCols(); place(g); save();
    });
    lab.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      if (g.parentElement !== tl) { undock(g); place(g); save(); return; }   // v0.252: с левой панели — обратно на полосу
      if (Z.cgrpFld[g.dataset.g]) { delete Z.cgrpFld[g.dataset.g]; delete Z.cgrpPos[g.dataset.g]; place(g); save(); return; }   // v0.348: с поля строк — на полосу
      if (!Z.cgrpPos[g.dataset.g]) return; delete Z.cgrpPos[g.dataset.g]; place(g); save();
    });
    place(g);
  });
  /* v0.252, «а сами панели вкладок — переносить на левую панель, чтоб там по 2–3 в ряду вставали» (группы конуса): группу тянут за
     заголовок на левую панель — она встаёт внизу панели в ряд с другими (сколько влезет в ширину — 2–3), перед той, над которой
     отпустили. Её край тянется мышью (двойной щелчок по краю — снова 250); v0.255: сама панель не расширяется, заголовок группы — сверху.
     Назад — вытащить за заголовок на холст или правый щелчок по заголовку (на полосу). Порядок — Z.cgrpDock, ширина — Z.paneW. */
  if (!Array.isArray(Z.cgrpDock)) Z.cgrpDock = [];
  const box = $("paneGrp"), head = $("paneGrpHead");
  // v0.400: магнит левой панели — ловит и в 40 px правее её края (как полоса магнита у Октаэдра)
  const paneHit = (x, y) => { const P = $("rowsPane"); if (!P || !box || document.body.classList.contains("pane-icons")) return false; const q = P.getBoundingClientRect(); return x >= q.left && x <= q.right + 40 && y >= q.top && y <= q.bottom; };
  const dockSync = () => {
    Z.cgrpDock = box ? [...box.children].map(c => c.dataset.g) : [];
    if (head) head.style.display = Z.cgrpDock.length ? "" : "none";
    paneWApply(true);
  };
  const dock = (g, x, y) => {
    if (!box) return;
    delete Z.cgrpPos[g.dataset.g]; g.classList.remove("cfloat"); g.style.left = g.style.top = "";
    let before = null;
    for (const c of box.children) { if (c === g) continue; const q = c.getBoundingClientRect(); if (y < q.top || (y <= q.bottom && x < q.left + q.width / 2)) { before = c; break; } }
    box.insertBefore(g, before); dockSync();
  };
  const undock = (g) => {   // обратно на полосу — на своё место среди остальных
    const i = groups.indexOf(g), next = groups.slice(i + 1).find(c => c.parentElement === tl) || null;
    tl.insertBefore(g, next); dockSync();
  };
  const paneWApply = (auto) => {
    const R = document.documentElement.style;
    // v0.255, «ширину самого поля не менять, левого»: панель сама больше не расширяется — только если край тянули рукой
    if (auto && !Z.paneWUser) delete Z.paneW;
    if (Z.paneW) R.setProperty("--paneW", Z.paneW + "px"); else R.removeProperty("--paneW");
  };
  if (box) {
    for (const k of Z.cgrpDock) { const g = groups.find(c => c.dataset.g === k); if (g) box.appendChild(g); }
    dockSync();
    const edge = $("paneEdge");
    if (edge) {
      edge.addEventListener("pointerdown", (e) => {
        if (e.button !== 0) return; e.preventDefault(); try { edge.setPointerCapture(e.pointerId); } catch (err) {}
        const P = $("rowsPane"), w0 = P.getBoundingClientRect().width, x0 = e.clientX; document.body.classList.add("wdrag"); wShield(true);
        // v0.271: как у ширины поля — пока тянут, за мышью тонкая черта, ширина панели встаёт, когда отпустили (живая перекладка тормозила)
        const pr = P.getBoundingClientRect(); let lx = x0, raf = 0, done = false; const g = document.createElement("div"); g.id = "wGhost"; document.body.appendChild(g);
        const wAt = () => Math.round(Math.max(180, Math.min(innerWidth * 0.7, w0 + lx - x0)));
        const draw = () => { raf = 0; g.style.cssText = `left:${Math.round(pr.left + wAt()) - 1}px;top:${Math.round(pr.top)}px;height:${Math.round(pr.height)}px`; };
        draw();
        const mv = (ev) => { if (!(ev.buttons & 1)) { up(); return; } lx = ev.clientX; if (!raf) raf = requestAnimationFrame(draw); };
        const up = () => {
          if (done) return; done = true;
          edge.removeEventListener("pointermove", mv); edge.removeEventListener("pointerup", up); edge.removeEventListener("pointercancel", up); removeEventListener("pointerup", up, true); removeEventListener("blur", up);
          if (raf) cancelAnimationFrame(raf); g.remove(); wShield(false);
          if (wAt() !== Math.round(w0)) { Z.paneW = wAt(); Z.paneWUser = true; paneWApply(false); }
          document.body.classList.remove("wdrag"); save(); requestAnimationFrame(() => { if (typeof packWins === "function") packWins(); renderAll(); });
        };
        edge.addEventListener("pointermove", mv); edge.addEventListener("pointerup", up); edge.addEventListener("pointercancel", up); addEventListener("pointerup", up, true); addEventListener("blur", up);
      });
      edge.addEventListener("dblclick", () => { delete Z.paneWUser; paneWApply(true); save(); renderAll(); });
    }
  }
  // v0.256: дзен — отмеченные 🧘 группы с левой панели (её в дзене нет) на это время переезжают на полосу конуса, потом обратно
  window.cgrpZenMove = (on) => {
    if (on) { if (box) [...box.children].forEach(g => { if (g.classList.contains("zenon")) { g.classList.add("zentmp"); tl.appendChild(g); } }); return; }
    const back = groups.filter(g => g.classList.contains("zentmp"));
    back.forEach(g => { g.classList.remove("zentmp"); delete Z.cgrpPos[g.dataset.g]; if (box) box.appendChild(g); place(g); });
    if (box && back.length) { for (const k of Z.cgrpDock) { const g = groups.find(c => c.dataset.g === k); if (g && g.parentElement === box) box.appendChild(g); } }
  };
  // v0.258: у каждой кнопки группы — её «дом» (куда вернуть); перенесённые между группами — на свои места
  groups.forEach(g => { const b = g.querySelector(":scope > .cgb"); if (b) b.querySelectorAll("button, label, select, input, .cunit").forEach(el => { if (!el.dataset.home) el.dataset.home = g.dataset.g; }); });
  // v0.281: и исходный сосед справа (ссылкой, "" — последней): перенос в конец своей же группы теперь запоминается (прежде забывался)
  groups.forEach(g => { const b = g.querySelector(":scope > .cgb"); if (b) [...b.children].forEach(el => { const n = el.nextElementSibling, c = n && (n.tagName === "LABEL" ? n.querySelector("input") : n); el.dataset.home0 = c ? btnKey(c) : ""; }); });
  if (Z.cgrpMove && typeof Z.cgrpMove === "object") for (const [k, m] of Object.entries(Z.cgrpMove)) {
    const el = cgrpMoveEl(cgrpRefEl(k)), g = groups.find(c => c.dataset.g === m.g), cgb = g && g.querySelector(":scope > .cgb");
    if (!el || !cgb || el.contains(g)) continue;
    const bf = cgrpMoveEl(cgrpRefEl(m.before)); cgb.insertBefore(el, bf && bf.parentElement === cgb ? bf : null);
  }
  addEventListener("resize", () => groups.forEach(place));
  /* v0.367: снаружи (кнопка «🎨» в шапке) — открыть группу: снять «закрыта» и «свёрнута», мигнуть рамкой; если её всё равно не видно
     (окно конуса закрыто или свёрнуто) — поставить на левую панель. Закрыть — спрятать. Открыта ли и видна — cgrpShown */
  window.cgrpShown = (k) => { const g = groups.find(c => c.dataset.g === k); return !!g && !Z.cgrpOff[k] && !g.classList.contains("cmin") && g.getClientRects().length > 0; };
  window.cgrpHide = (k) => { const g = groups.find(c => c.dataset.g === k); if (!g) return; Z.cgrpOff[k] = true; g.classList.add("coff"); save(); if (window.palUi) palUi(); };
  window.cgrpShow = (k) => {
    const g = groups.find(c => c.dataset.g === k); if (!g) return;
    delete Z.cgrpOff[k]; g.classList.remove("coff");
    if (Z.cgrpMin[k]) { delete Z.cgrpMin[k]; g.classList.remove("cmin"); g.style.minHeight = ""; }
    cgbSnap(); sizeApply(g); place(g);
    if (!g.getClientRects().length && g.parentElement === tl && box && !document.body.classList.contains("pane-icons")) { delete Z.cgrpPos[k]; delete Z.cgrpFld[k]; g.classList.remove("cfloat", "cfld"); g.style.left = g.style.top = ""; box.appendChild(g); dockSync(); }
    g.style.zIndex = ++zTop; g.classList.remove("cflash"); void g.offsetWidth; g.classList.add("cflash"); setTimeout(() => g.classList.remove("cflash"), 1600);
    try { g.scrollIntoView({ block: "nearest", inline: "nearest" }); } catch (err) { /* нет места */ }
    save(); if (window.palUi) palUi();
  };
  { // v0.348: поле строк меняет место и размер (ширина поля, панель, спрятать, дзен) — группы на нём едут следом
    const F = $("field"), re = () => groups.forEach(g => { if (Z.cgrpFld[g.dataset.g] && !g.classList.contains("cdrag")) place(g); });   // тащимую — не трогать
    if (F && window.ResizeObserver) new ResizeObserver(re).observe(F);
    new MutationObserver(re).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  }
  cgrpCols();
  cgbIcons();   // v0.317: подписи кнопок меняются (▶ / ⏸, «только значки») — пересчёт, кто значок
  { let t = 0; const mo = new MutationObserver(() => { if (!t) t = requestAnimationFrame(() => { t = 0; cgbIcons(); cgbSnap(); }); });   // v0.335: и ширины 1 / 2 / 4
    groups.forEach(g => mo.observe(g, { childList: true, characterData: true, subtree: true })); }
  cgbSnap();
}
// v0.317, «всем кнопкам и спискам — стандарт длины»: кнопка в группе, где не больше двух знаков (◀ ▶| ↻ ⏮ 01), — значок, в полширины (.ib)
/* v0.335, «стандарт ширины кнопки — ширины только 1, 2, 4»: всё в группе, что стояло своей шириной (подпись группы, «весь:», «по биту:»,
   полоса режимов кручения, «🎯 до строки», голые поля, счёт Аниматрицы), — шириной ровно в 1, 2 или 4 кнопки (с зазорами между ними):
   наименьшую, в которую влезает. Кнопки, списки, поля с подписью — уже в 1, ползунки и блоки ◀ [ ] ▶ — в 2; значки — в полкнопки (v0.317) */
const CG_FREE = ".cgrp > .glab, .cgrp > .cgb > .glab2, .cgrp > .cgb > span:not(.cunit), .cgrp > .cgb > input";
/* v0.339, по снимку «Вида» («🔴 неподв. ⇄» обрезана с обеих сторон) — «не совсем расположил»: кнопки, кнопки-галки и списки, которым
   мало одной ширины, — в 2 кнопки (или в 4), а не обрезаны (классы .w2 / .w4). Замер — разом для всех (одна перекладка страницы, а не на
   каждый элемент: при ▶ волне счёт меняется каждый кадр) */
const CG_BTN = ".cgrp > .cgb button:not(.zerk-arrow), .cgrp > .cgb label:has(> input[type=checkbox]), .cgrp > .cgb select";
function cgbSnap(){
  const bu0 = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--bu")) || 80, ct = document.querySelector("#w-cone .tools");
  const buC = (ct && parseFloat(getComputedStyle(ct).getPropertyValue("--bu"))) || bu0;   // v0.447: в конусе своя --bu (6s) и без зазоров
  const W = (k, el) => { const c = el.closest("#w-cone .tools, #paneGrp"), bu = c ? buC : bu0, gp = c ? 0 : 3; return k * bu + (k - 1) * gp; };   // v0.463: и левая панель
  const kOf = (w, el) => w <= W(1, el) + 0.5 ? 1 : w <= W(2, el) + 0.5 ? 2 : 4;
  const vis = (el) => el.getClientRects().length > 0;
  const free = [...document.querySelectorAll(CG_FREE)].filter(el => vis(el) && !el.classList.contains("tzk"));   // v0.452: место и размер кнопок конструктора — свои
  const btn = [...document.querySelectorAll(CG_BTN)].filter(el => vis(el) && !el.classList.contains("ib") && !el.closest(".cunit") && !el.classList.contains("tzk") && !el.dataset.w1);   // v0.490: data-w1 — всегда в одну
  document.querySelectorAll(".cgb [data-w1].w2, .cgb [data-w1].w4").forEach(el => el.classList.remove("w2", "w4"));
  free.forEach(el => { el.style.width = "max-content"; el.style.flex = "0 0 auto"; if (!el.style.boxSizing) el.style.boxSizing = "border-box"; });
  btn.forEach(el => { el._tzw = el.classList.contains("tz") ? el.style.getPropertyValue("width") : ""; if (el._tzw) el.style.removeProperty("width");
    el._tzf = el.classList.contains("tz") ? el.style.getPropertyValue("flex") : ""; if (el._tzf) el.style.removeProperty("flex");   // v0.479: и flex (у галок) — иначе замер берёт прежнюю ширину и раздувает кнопку
    el.classList.add("wm"); });   // v0.447: ширина .tz — своя, на замер снять
  const wf = free.map(el => el.getBoundingClientRect().width), wb = btn.map(el => el.getBoundingClientRect().width);
  btn.forEach(el => { el.classList.remove("wm"); if (el._tzw) el.style.setProperty("width", el._tzw, "important"); if (el._tzf) el.style.setProperty("flex", el._tzf, "important"); });
  free.forEach((el, i) => { el.style.width = W(kOf(wf[i], el), el) + "px"; });
  btn.forEach((el, i) => { const k = kOf(wb[i], el); if (el.classList.contains("w2") !== (k === 2)) el.classList.toggle("w2", k === 2); if (el.classList.contains("w4") !== (k === 4)) el.classList.toggle("w4", k === 4); });
  if (typeof triTag === "function") triTag();
}
function cgbIcons(){
  document.querySelectorAll(".cgrp > .cgb button:not(.zerk-arrow)").forEach((b) => { const on = [...b.textContent.trim()].length <= 2; if (b.classList.contains("ib") !== on) b.classList.toggle("ib", on); });
}
/* v0.203, «сделай как в Zerkalius-layers.html, чтобы кнопки можно было на холст в любое место» (там — «кнопки на поле цепочек», v1.594):
   любую кнопку с именем (id) тянешь мышью на холст конуса — там, куда бросил, встаёт её копия с той же подписью (оригинал на месте); та же
   кнопка уже на холсте — не удваивается, а переезжает. Копия жмёт оригинал ($ находит его и в вынесенном окне) и горит, как он (.on).
   Копию тянешь по холсту — переезжает; вытащил за холст, правый щелчок или Delete — убрана. Места — Z.coneBtns [{ id, x, y }], x и y —
   доли ширины и высоты холста (растянул окно — кнопки остаются на своих местах холста). Фон хаба и показ пресета их не рисуют. */
/* v0.281, по снимку «Кручения» — «дай мне возможность включать режим редактирования панелей — там переставлять кнопки и давать им
   названия или оставлять только значки». ✎ Правка в шапке: щелчок по кнопке группы (в конусе и на левой панели) не нажимает её, а
   открывает редактор — своё название, «◉ только значок», «↺ как было», и то же для всей группы; тянуть — переставить (v0.258, работает
   и без режима). Текст самой кнопки не трогается — его по-прежнему меняет код (▶ крутить → ⏸ стоп); подпись рисуется поверх
   (data-lab + ::before), значок берётся из живого текста. Своё название без значка получает живой значок кнопки впереди. Хранится
   Z.btnLab { ссылка: { t: название, m: "ico" } } — только по действию пользователя. */
function btnRef(el){   // кнопка или флажок → { id } или { sel } (единственный по data-… внутри блока с именем); v0.249 — из coneBtnsInit
  if (!el) return null;
  if (el.id) return { id: el.id };
  const d = Object.entries(el.dataset || {}).find(([k]) => !/^(home|home0|lab)$/.test(k)), box = el.parentElement && el.parentElement.closest("[id]"); if (!d || !box) return null;
  const sel = `#${CSS.escape(box.id)} ${el.tagName.toLowerCase()}[data-${d[0].replace(/[A-Z]/g, c => "-" + c.toLowerCase())}="${CSS.escape(d[1])}"]`;
  return document.querySelectorAll(sel).length === 1 ? { sel } : null;
}
function btnKey(el){ const r = btnRef(el); return r ? (r.sel || "#" + r.id) : ""; }
function btnIcon(raw){ const f = (raw || "").trim().split(/\s+/)[0] || ""; return f && !/[\p{L}\p{N}]/u.test(f) ? f : ""; }
function labCtl(el){ return el && el.tagName === "LABEL" ? el.querySelector("input[type=checkbox],input[type=radio]") : null; }   // v0.282: галка — метка с флажком
function labKey(el){ return !el ? "" : el.tagName === "LABEL" ? (labCtl(el) ? btnKey(labCtl(el)) : "") : btnKey(el); }   // галку помнят по её флажку
function btnLabApply(el){
  if (!el || !(el.tagName === "BUTTON" || labCtl(el))) return;   // v0.282: и галки
  const c = Z.btnLab && Z.btnLab[labKey(el)], raw = (el.textContent || "").replace(/\s+/g, " ").trim(), ic = btnIcon(raw);
  let t = raw;
  if (c && c.m === "ico" && ic) t = ic;
  else if (c && c.t) t = (ic && !btnIcon(c.t) ? ic + " " : "") + c.t;
  if (t !== raw) { el.dataset.lab = t; el.classList.add("blab"); } else if (el.classList.contains("blab")) { delete el.dataset.lab; el.classList.remove("blab"); }
}
/* v0.281, «сделай, чтобы кнопки можно было перемещать по любым группам-панелям»: панель — группа конуса (и на левой панели), полоса
   кнопок любого окна (.tools) и шапка. Кнопку или галку тянешь в любую из них — переезжает (сама, не копия); место — Z.btnMove
   { ссылка: { p: панель, before: ссылка | null } }, панель — имя группы, «окно/номер полосы» или «#top». Z.cgrpMove (v0.258) читается
   по-прежнему; переставил кнопку заново — её запись переходит в Z.btnMove. */
const PANEL_SEL = ".cgrp > .cgb, .win .tools, #top";
function panelOf(node){
  const p = node && node.closest ? node.closest(PANEL_SEL) : null;
  if (!p || p.querySelector(":scope > .cgrp") || node.closest("#btnEd, #coneBtns, #coneMain, #cone3Pad")) return null;   // внешняя полоса конуса — не панель, её группы — панели
  return p;
}
function panelKey(p){
  if (!p) return "";
  if (p.classList.contains("cgb")) return (p.parentElement && p.parentElement.dataset.g) || "";
  if (p.id === "top") return "#top";
  const w = p.closest(".win"); return w ? w.id + "/" + [...w.querySelectorAll(".tools")].indexOf(p) : "";
}
function panelByKey(k){
  if (!k) return null;
  if (k === "#top") return document.getElementById("top");
  if (k.includes("/")) { const [id, i] = k.split("/"), w = document.getElementById(id); return w ? w.querySelectorAll(".tools")[+i] || null : null; }
  return document.querySelector(`.cgrp[data-g="${CSS.escape(k)}"] > .cgb`);
}
function panelName(p){
  if (!p) return "";
  if (p.classList.contains("cgb")) return "группа «" + panelKey(p) + "»";
  if (p.id === "top") return "шапка";
  const w = p.closest(".win"); return "окно «" + ((w && w.dataset.title) || (w && w.id) || "") + "»";
}
function panelHomes(){   // у каждой кнопки панели — её дом и исходный сосед справа (куда вернуть); панели помечены .pnl
  document.querySelectorAll(PANEL_SEL).forEach((p) => {
    if (p.querySelector(":scope > .cgrp")) return;
    const k = panelKey(p); if (!k) return;
    p.classList.add("pnl");
    p.querySelectorAll("button, label, select, input, .cunit").forEach(el => { if (!el.dataset.home) el.dataset.home = k; });   // v0.320: и блоки .cunit
    [...p.children].forEach(el => { if (el.dataset.home0 === undefined) { const n = el.nextElementSibling, c = n && (n.tagName === "LABEL" ? n.querySelector("input") : n); el.dataset.home0 = c ? btnKey(c) : ""; } });
  });
  if (Z.btnMove && typeof Z.btnMove === "object") for (const [k, m] of Object.entries(Z.btnMove)) {
    const el = cgrpMoveEl(cgrpRefEl(k)), p = panelByKey(m && m.p);
    if (!el || !p || el.contains(p)) continue;
    const bf = cgrpMoveEl(cgrpRefEl(m.before)); p.insertBefore(el, bf && bf.parentElement === p ? bf : null);
  }
}
function panelEditInit(){
  if (ZZ_BG) return;
  if (!Z.btnLab || typeof Z.btnLab !== "object") Z.btnLab = {};
  panelHomes();
  const all = () => [...document.querySelectorAll(".pnl button, .pnl label")].filter(b => panelOf(b) && !b.closest("#zenBtns") && (b.tagName === "BUTTON" || labCtl(b)));
  all().forEach(btnLabApply);
  // код меняет текст кнопок сам (▶ крутить → ⏸ стоп) — подпись следом; свои перемены (data-lab) — атрибуты, их наблюдатель не видит
  const mo = new MutationObserver((ms) => { const s = new Set(); for (const m of ms) { const b = (m.target.nodeType === 1 ? m.target : m.target.parentElement); const x = b && b.closest && b.closest("button, label"); if (x) s.add(x); } s.forEach(btnLabApply); });
  document.querySelectorAll(".cgrp, .pnl").forEach(g => mo.observe(g, { childList: true, characterData: true, subtree: true }));
  let ed = null, cur = null;
  const close = () => { if (ed) ed.remove(); ed = null; if (cur) cur.classList.remove("bsel"); cur = null; };
  const set = (el, c) => {
    const k = labKey(el); if (!k) return;
    if (c && (c.t || c.m)) Z.btnLab[k] = c; else delete Z.btnLab[k];
    btnLabApply(el); save(); cgrpCols();
  };
  const open = (b) => {
    close();
    const k = labKey(b);
    if (!k) { say("✎ У этой кнопки нет своего имени — её название не запомнится. Перетащить можно."); return; }
    cur = b; b.classList.add("bsel");
    const c = Z.btnLab[k] || {}, raw = (b.textContent || "").replace(/\s+/g, " ").trim(), ic = btnIcon(raw), g = panelOf(b) || b.parentElement;
    ed = document.createElement("div"); ed.id = "btnEd";
    ed.innerHTML = '<span class="bedraw"></span><input type="text" spellcheck="false"><button data-e="ok" title="Готово (Enter)">✓</button>' +
      '<button data-e="ico" title="Только значок (' + (ic || "у этой кнопки значка нет") + ')">◉ значок</button><button data-e="def" title="Как было: исходная подпись, своё название стёрто">↺ как было</button>' +
      '<button data-e="gico" title="Всем кнопкам этой панели, у которых есть значок, — только значок">◉ вся панель</button><button data-e="gdef" title="Всей панели — исходные подписи">↺ вся панель</button>';
    ed.querySelector(".bedraw").textContent = (b.tagName === "LABEL" ? "Галка: " : "Кнопка: ") + raw + (b.title ? " — " + b.title.split(/ — |\. /)[0] : "");
    const inp = ed.querySelector("input"); inp.value = c.t || ""; inp.placeholder = raw + " — своё название";
    if (!ic) ed.querySelector('[data-e="ico"]').disabled = true;
    document.body.appendChild(ed);
    const r = b.getBoundingClientRect(), W = ed.offsetWidth, H = ed.offsetHeight;
    ed.style.left = Math.round(Math.max(4, Math.min(r.left, innerWidth - W - 4))) + "px";
    ed.style.top = Math.round(r.bottom + 4 + H > innerHeight ? Math.max(4, r.top - H - 4) : r.bottom + 4) + "px";
    inp.oninput = () => set(b, inp.value.trim() ? { t: inp.value.trim() } : null);
    inp.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); close(); } else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); } };
    ed.onclick = (e) => {
      const x = e.target.closest("button[data-e]"); if (!x) return;
      const w = x.dataset.e;
      if (w === "ok") close();
      else if (w === "ico") { set(b, { t: inp.value.trim() || undefined, m: "ico" }); }
      else if (w === "def") { inp.value = ""; set(b, null); }
      else if (w === "gico" || w === "gdef") {
        let n = 0;
        g.querySelectorAll("button, label").forEach(y => { if (y.closest("#zenBtns")) return; const k2 = labKey(y); if (!k2) return; const c2 = Z.btnLab[k2] || {};
          if (w === "gico") { if (!btnIcon((y.textContent || "").trim())) return; Z.btnLab[k2] = Object.assign({}, c2, { m: "ico" }); }
          else delete Z.btnLab[k2];
          btnLabApply(y); n++; });
        if (w === "gdef") inp.value = "";
        save(); cgrpCols(); say(w === "gico" ? `◉ Только значки — ${n} кнопок панели.` : `↺ Исходные подписи — ${n} кнопок панели.`);
      }
    };
    setTimeout(() => { inp.focus(); inp.select(); }, 0);
  };
  const on = (v) => {
    document.body.classList.toggle("cedit", v); $("bEdit").classList.toggle("on", v); if (!v) close();
    say(v ? "✎ Правка панелей: щелчок по кнопке — своё название или только значок; тяни — переставить в любую панель: группы конуса, полосы окон, шапку. Esc или ✎ — выйти." : "✎ Правка панелей — выключена, кнопки снова жмутся.");
  };
  $("bEdit").onclick = () => on(!document.body.classList.contains("cedit"));
  // в режиме правки кнопки групп не жмутся: нажатие, щелчок, двойной и правый не доходят до их обработчиков (перетаскивание — работает)
  const hit = (e) => { if (!document.body.classList.contains("cedit") || !e.target.closest) return null; const x = e.target.closest("button, label, select, input"); return x && x.id !== "bEdit" && !x.closest("#zenBtns") && panelOf(x) ? x : null; };
  for (const t of ["pointerdown", "mousedown", "pointerup", "mouseup", "dblclick", "contextmenu", "auxclick", "change", "input"]) document.addEventListener(t, (e) => {
    const x = hit(e); if (!x) return;
    e.stopPropagation();
    if (x.tagName !== "BUTTON" && (t === "mousedown" || t === "contextmenu")) e.preventDefault();   // списки не раскрываются, ползунки не едут
    if (t === "contextmenu") e.preventDefault();
  }, true);
  document.addEventListener("click", (e) => {
    const x = hit(e); if (!x) { if (ed && !e.target.closest("#btnEd")) close(); return; }
    e.stopPropagation(); e.preventDefault();
    const l = x.closest("label"), b = x.closest("button") || (labCtl(l) ? l : null);   // v0.282: и галка
    if (b) open(b); else say("✎ Списки и ползунки пока не переименовываются — только переставляются перетаскиванием.");
  }, true);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && document.body.classList.contains("cedit")) { if (ed) close(); else on(false); } }, true);
}
function coneBtnsInit(){
  const host = $("coneMain"); if (!host || ZZ_BG) return;
  if (!Array.isArray(Z.coneBtns)) Z.coneBtns = [];
  const L = document.createElement("div"); L.id = "coneBtns"; host.appendChild(L);
  const TYPE = "text/zz-btn";
  let drag = null;   // тащат копию с холста: { k, dx, dy, done }
  /* v0.249, по снимку «одинак.» и «3D» — «любые кнопки сделай переносимыми на поле, а не только те, что сейчас»: кроме кнопок с именем (id)
     на холст тянутся и галки (метка с флажком: копия щёлкает флажок и горит, когда он стоит), и кнопки без имени, но с меткой data-…
     в окне с именем (шаблоны, ⟲ ▲ ⌂ у 3D, виды «сверху / спереди»…) — такая запоминается селектором { sel }. */
  const CHK = "input[type=checkbox],input[type=radio]";
  const srcOf = (it) => !it ? null : it.sel ? document.querySelector(it.sel) : $(it.id);
  const refKey = (it) => it.sel || "#" + it.id;
  const refOf = btnRef;   // v0.281: общая (и для ✎ Правки); служебные data-home / data-lab ссылкой не считаются
  const grabOf = (t) => {   // что тянут: кнопка (не копия на холсте) или метка с флажком
    if (!t || !t.closest) return null;
    const b = t.closest("button"); if (b) return b.closest("#coneBtns") ? null : b;
    const l = t.closest("label"); return l && l.querySelector(CHK) ? l : null;
  };
  const ctlOf = (g) => g.tagName === "LABEL" ? g.querySelector(CHK) : g;
  const isChk = (src) => src.tagName === "INPUT" && (src.type === "checkbox" || src.type === "radio");
  const lab = (src) => {
    if (src.tagName === "INPUT") { const l = src.closest("label"); return (l && l.dataset.lab) || (l ? l.textContent : "").replace(/\s+/g, " ").trim() || (src.title || src.id || "").slice(0, 24); }
    return (src.dataset && src.dataset.lab) || (src.textContent || "").replace(/\s+/g, " ").trim() || (src.title || "").split(/ — |: |\. /)[0].slice(0, 24) || src.id;   // v0.281: своё название (✎) — и у копии
  };
  const refresh = () => {
    for (const b of L.children) {
      const it = Z.coneBtns[+b.dataset.k], src = srcOf(it);
      b.classList.toggle("gone", !src); if (!src) continue;
      b.classList.toggle("on", src.classList.contains("on") || (isChk(src) && src.checked)); b.disabled = !!src.disabled;   // v0.249: галка — горит, когда стоит   // v0.208: неактивна оригинал — неактивна и копия
      const t = lab(src); if (b.textContent !== t) b.textContent = t;
    }
  };
  const render = () => {
    L.innerHTML = "";
    const W = host.clientWidth, H = host.clientHeight;
    Z.coneBtns.forEach((it, k) => {
      const src = srcOf(it), b = document.createElement("button");
      b.type = "button"; b.draggable = true; b.dataset.k = k;
      b.textContent = src ? lab(src) : "?";
      b.title = (src ? (src.title || (src.closest("label") || {}).title || lab(src)) : "Этой кнопки сейчас нет") + " · тащи по холсту — переставить; за холст, правый щелчок или Delete — убрать";
      L.appendChild(b);
      const w = b.offsetWidth, h = b.offsetHeight;
      b.style.left = Math.round(Math.max(0, Math.min(it.x * W, W - w))) + "px";
      b.style.top = Math.round(Math.max(0, Math.min(it.y * H, H - h))) + "px";
    });
    refresh();
  };
  const remove = (k, why) => {
    const it = Z.coneBtns[k]; if (!it) return;
    const src = srcOf(it); Z.coneBtns.splice(k, 1); render(); save();
    say(`Кнопка «${src ? lab(src) : refKey(it)}» убрана с холста${why ? " — " + why : ""}.`);
  };
  L.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-k]"); if (!b) return;
    e.stopPropagation();
    const it = Z.coneBtns[+b.dataset.k], src = srcOf(it);
    if (!src) { say("Этой кнопки сейчас нет — она появится, когда вернётся её окно."); return; }
    if (b._pd) { b._pd = false; refresh(); setTimeout(refresh, 0); return; }   // v0.249: уже сработала на нажатие
    src.click(); refresh(); setTimeout(refresh, 0);
  });
  /* v0.249: есть кнопки, что действуют на нажатие, а не на щелчок (⟲ ▲ ⌂ у 3D — держишь, повторяется): нажатие на копии передаётся
     оригиналу; оригинал его взял (preventDefault) — щелчок копии больше не жмёт его второй раз. */
  L.addEventListener("pointerdown", (e) => {
    const b = e.target.closest("button[data-k]"); if (!b || e.button !== 0) return;
    const src = srcOf(Z.coneBtns[+b.dataset.k]); b._pd = false; if (!src || src.tagName === "INPUT") return;
    const ev = new PointerEvent("pointerdown", { bubbles: true, cancelable: true, button: 0, pointerId: e.pointerId, clientX: e.clientX, clientY: e.clientY });
    src.dispatchEvent(ev); b._pd = ev.defaultPrevented;
  });
  L.addEventListener("contextmenu", (e) => { const b = e.target.closest("button[data-k]"); if (!b) return; e.preventDefault(); remove(+b.dataset.k); });
  L.addEventListener("keydown", (e) => { const b = e.target.closest("button[data-k]"); if (b && (e.key === "Delete" || e.key === "Backspace")) { e.preventDefault(); remove(+b.dataset.k); } });
  L.addEventListener("dragstart", (e) => {
    const b = e.target.closest && e.target.closest("button[data-k]"); if (!b || !Z.coneBtns[+b.dataset.k]) return;
    e.stopPropagation();
    drag = { k: +b.dataset.k, dx: e.offsetX, dy: e.offsetY, done: false };
    e.dataTransfer.setData(TYPE, JSON.stringify(Z.coneBtns[drag.k])); e.dataTransfer.effectAllowed = "move";
  });
  L.addEventListener("dragend", (e) => {
    const d = drag; drag = null;
    if (d && !d.done && e.dataTransfer && e.dataTransfer.dropEffect === "none") remove(d.k, "вытащена за холст");
  });
  // любую кнопку (v0.249: и галку) можно потянуть: draggable ставится в миг нажатия (кнопки бывают и новые)
  /* v0.258, «не переносится на холст» (по снимку «⧗ зеркало»): у метки с флажком браузер решает, тащить ли, раньше, чем доходит
     нажатие, — с первого раза галка не тянулась. Теперь draggable ставится уже при наведении мыши. */
  document.addEventListener("pointerover", (e) => {
    const g = grabOf(e.target);
    if (g && !g.draggable && refOf(ctlOf(g))) g.draggable = true;
  }, true);
  document.addEventListener("pointerdown", (e) => {
    const g = grabOf(e.target);
    if (g && !g.draggable && refOf(ctlOf(g))) g.draggable = true;
  }, true);
  document.addEventListener("dragstart", (e) => {
    const g = grabOf(e.target), r = g && refOf(ctlOf(g)); if (!r) return;
    e.dataTransfer.setData(TYPE, JSON.stringify(r)); e.dataTransfer.effectAllowed = "copyMove";
  });
  const isBtn = (e) => !!e.dataTransfer && [...e.dataTransfer.types].includes(TYPE);
  /* v0.258, «надо у всех вкладок, чтобы могли — и между вкладками»: кнопку или галку любой группы конуса можно перетащить в другую
     группу — она (сама, не копия) переезжает туда, перед той кнопкой, над которой отпустил (над правой половиной — после неё). Место
     помнится (Z.cgrpMove { ссылка: { g: группа, before: ссылка | null } }); вернуть — перетащить обратно в свою группу. */
  const grpAt = (e) => { const p = panelOf(e.target); return p && p.classList.contains("pnl") ? p : null; };   // v0.281: любая панель (группа конуса, полоса окна, шапка)
  const hlOf = (p) => p.classList.contains("cgb") ? p.parentElement : p;
  const clearDrop = () => document.querySelectorAll(".cgdrop").forEach(x => x.classList.remove("cgdrop"));
  document.addEventListener("dragover", (e) => {
    if (!isBtn(e) || drag) return; const g = grpAt(e); clearDrop(); if (!g) return;
    e.preventDefault(); e.dataTransfer.dropEffect = "move"; hlOf(g).classList.add("cgdrop");
  });
  document.addEventListener("dragend", clearDrop, true);
  document.addEventListener("drop", (e) => {
    if (!isBtn(e) || drag) return; const g = grpAt(e); clearDrop(); if (!g) return;
    e.preventDefault();
    let r = null; try { r = JSON.parse(e.dataTransfer.getData(TYPE)); } catch (err) { r = null; }
    const src = srcOf(r), el = src && cgrpMoveEl(src); if (!el || !el.dataset.home || el.contains(g)) return;   // только кнопки панелей
    const cgb = g; let over = e.target; while (over && over.parentElement !== cgb) over = over.parentElement;
    let before = null;
    if (over && over !== el && over.parentElement === cgb) { const q = over.getBoundingClientRect(); before = e.clientX < q.left + q.width / 2 ? over : over.nextElementSibling; }
    if (before === el) before = el.nextElementSibling;
    cgb.insertBefore(el, before);
    const bref = before ? refOf(ctlOf(before)) : null;
    const k = refKey(r), pk = panelKey(g);
    if (!Z.btnMove || typeof Z.btnMove !== "object") Z.btnMove = {};
    if (Z.cgrpMove && Z.cgrpMove[k]) delete Z.cgrpMove[k];   // v0.281: запись v0.258 — в прошлое, место теперь в Z.btnMove
    const home = el.dataset.home === pk && (bref ? refKey(bref) : "") === el.dataset.home0;
    if (home) delete Z.btnMove[k]; else Z.btnMove[k] = { p: pk, before: bref ? refKey(bref) : null };
    save(); cgrpCols();
    say(home ? `«${lab(src)}» — снова на своём месте.` : `«${lab(src)}» — теперь: ${panelName(g)}. Вернуть — перетащи обратно (${panelName(panelByKey(el.dataset.home))}).`);
  });
  /* v0.281, «в режиме настройки кнопок нужна группа Дзен — туда кнопки копируются, а не перемещаются»: группа «Дзен» (#zenGrp) видна в ✎
     Правке и в дзене (отмечена 🧘 с первого раза). Кнопку или галку любой панели бросил в неё — встала копия (оригинал на месте), как у
     копий на холсте: жмёт оригинал, горит, как он. Копию тянешь внутри — переставить; вытащил наружу или правый щелчок в Правке — убрана.
     Z.zenBtns [{ id } | { sel }]. */
  const Zb = $("zenBtns");
  if (Zb) {
    if (!Array.isArray(Z.zenBtns)) Z.zenBtns = [];
    const TZ = "text/zz-zen";
    const zRender = () => {
      Zb.innerHTML = "";
      Z.zenBtns.forEach((it, k) => {
        const src = srcOf(it), b = document.createElement("button");
        b.type = "button"; b.draggable = true; b.dataset.zk = k; b.textContent = src ? lab(src) : "?";
        b.title = (src ? (src.title || (src.closest("label") || {}).title || lab(src)) : "Этой кнопки сейчас нет") + " · копия в «Дзене»";
        Zb.appendChild(b);
      });
      $("zenGrp").classList.toggle("empty", !Z.zenBtns.length); zRefresh();
    };
    const zRefresh = () => {
      for (const b of Zb.children) {
        const src = srcOf(Z.zenBtns[+b.dataset.zk]); b.classList.toggle("gone", !src); if (!src) continue;
        b.classList.toggle("on", src.classList.contains("on") || (isChk(src) && src.checked)); b.disabled = !!src.disabled && !document.body.classList.contains("cedit");
        const t = lab(src); if (b.textContent !== t) b.textContent = t;
      }
    };
    const zDel = (k) => { const it = Z.zenBtns[k]; if (!it) return; const src = srcOf(it); Z.zenBtns.splice(k, 1); zRender(); save(); say(`🧘 «${src ? lab(src) : refKey(it)}» — убрана из «Дзена».`); };
    const edit = () => document.body.classList.contains("cedit");
    Zb.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-zk]"); if (!b) return; e.stopPropagation(); e.preventDefault();
      if (edit()) { say("🧘 Копия в «Дзене»: тяни — переставить; вытащи наружу или правый щелчок — убрать. Подпись — как у оригинала."); return; }
      const src = srcOf(Z.zenBtns[+b.dataset.zk]); if (!src) { say("Этой кнопки сейчас нет."); return; }
      if (b._pd) { b._pd = false; setTimeout(zRefresh, 0); return; }
      src.click(); zRefresh(); setTimeout(zRefresh, 0);
    });
    Zb.addEventListener("pointerdown", (e) => {   // как у копий на холсте (v0.249): кнопки, что действуют на нажатие, получают его
      const b = e.target.closest("button[data-zk]"); if (!b || e.button !== 0 || edit()) return;
      const src = srcOf(Z.zenBtns[+b.dataset.zk]); b._pd = false; if (!src || src.tagName === "INPUT") return;
      const ev = new PointerEvent("pointerdown", { bubbles: true, cancelable: true, button: 0, pointerId: e.pointerId, clientX: e.clientX, clientY: e.clientY });
      src.dispatchEvent(ev); b._pd = ev.defaultPrevented;
    });
    Zb.addEventListener("contextmenu", (e) => { const b = e.target.closest("button[data-zk]"); if (!b) return; e.preventDefault(); e.stopPropagation(); if (edit()) zDel(+b.dataset.zk); });
    let zd = null;
    Zb.addEventListener("dragstart", (e) => {
      const b = e.target.closest && e.target.closest("button[data-zk]"); if (!b) return;
      e.stopPropagation(); zd = { k: +b.dataset.zk, done: false };
      e.dataTransfer.setData(TZ, String(zd.k)); e.dataTransfer.setData(TYPE, JSON.stringify({ zen: zd.k })); e.dataTransfer.effectAllowed = "move";
    });
    Zb.addEventListener("dragend", (e) => { const d = zd; zd = null; if (d && !d.done && e.dataTransfer && e.dataTransfer.dropEffect === "none") zDel(d.k); });
    Zb.addEventListener("dragover", (e) => { if (!isBtn(e)) return; e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = zd ? "move" : "copy"; clearDrop(); $("zenGrp").classList.add("cgdrop"); });
    Zb.addEventListener("drop", (e) => {
      if (!isBtn(e)) return; e.preventDefault(); e.stopPropagation(); clearDrop();
      const over = e.target.closest && e.target.closest("button[data-zk]");
      let at = over ? +over.dataset.zk + (e.clientX > over.getBoundingClientRect().left + over.offsetWidth / 2 ? 1 : 0) : Z.zenBtns.length;
      if (zd) {   // переставить копию
        const it = Z.zenBtns.splice(zd.k, 1)[0]; if (at > zd.k) at--; Z.zenBtns.splice(at, 0, it); zd.done = true; zRender(); save(); return;
      }
      let r = null; try { r = JSON.parse(e.dataTransfer.getData(TYPE)); } catch (err) { r = null; }
      const src = srcOf(r); if (!src || r.zen !== undefined) return;
      const ref = r.sel ? { sel: r.sel } : { id: r.id }, was = Z.zenBtns.findIndex(t => refKey(t) === refKey(ref));
      if (was >= 0) { Z.zenBtns.splice(was, 1); if (at > was) at--; }
      Z.zenBtns.splice(at, 0, ref); zRender(); save();
      say(was >= 0 ? `🧘 «${lab(src)}» — переставлена в «Дзене».` : `🧘 «${lab(src)}» — копия в «Дзене» (оригинал на месте). Видна в дзене.`);
    });
    setInterval(() => { if (Zb.children.length && Zb.offsetParent) zRefresh(); }, 400);
    zRender();
  }
  host.addEventListener("dragover", (e) => { if (!isBtn(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = drag ? "move" : "copy"; });
  host.addEventListener("drop", (e) => {
    if (!isBtn(e)) return;
    e.preventDefault();
    const d = drag;
    let r = null; try { r = d ? Z.coneBtns[d.k] : JSON.parse(e.dataTransfer.getData(TYPE)); } catch (err) { r = { id: e.dataTransfer.getData(TYPE) }; }   // v0.249: { id } или { sel }
    const src = srcOf(r);
    if (!src) return;
    let k = d ? d.k : Z.coneBtns.findIndex(t => refKey(t) === refKey(r));
    const fresh = k < 0;
    if (fresh) { Z.coneBtns.push(Object.assign(r.sel ? { sel: r.sel } : { id: r.id }, { x: 0, y: 0 })); k = Z.coneBtns.length - 1; }
    render();
    const me = L.children[k], hr = host.getBoundingClientRect(), W = host.clientWidth || 1, H = host.clientHeight || 1;
    const w = me ? me.offsetWidth : 28, h = me ? me.offsetHeight : 24;
    const dx = d ? d.dx : Math.min(w / 2, 14), dy = d ? d.dy : h / 2;   // новую — держим за левый край, где её знак
    const x = Math.max(0, Math.min(e.clientX - dx - hr.left, W - w)), y = Math.max(0, Math.min(e.clientY - dy - hr.top, H - h));
    Z.coneBtns[k].x = x / W; Z.coneBtns[k].y = y / H;
    if (me) { me.style.left = Math.round(x) + "px"; me.style.top = Math.round(y) + "px"; me.focus({ preventScroll: true }); }
    if (d) d.done = true;
    save();
    if (fresh) say(`«${lab(src)}» — на холсте. Тащи — переставить; за холст, правый щелчок или Delete — убрать.`);
  });
  if (window.ResizeObserver) new ResizeObserver(() => { if (Z.coneBtns.length) render(); }).observe(host);
  setInterval(() => { if (L.children.length) refresh(); }, 400);   // кнопки меняют вид и сами (▶ крутить → ⏸ стоп)
  render();
}
function cgrpCols(){   // v0.183: у каждой группы — столбцов на половину её видимых кнопок (два ряда)
  document.querySelectorAll("#w-cone .tools > .cgrp").forEach((g) => {
    const n = [...g.children].filter(c => !c.classList.contains("glab") && getComputedStyle(c).display !== "none").length;
    g.style.setProperty("--cols", Math.max(1, Math.ceil(n / 2)));
  });
  rhombTag();   // v0.401
}
/* v0.401, «все кнопки ромбами, равнобедр» — кнопка группы (конус, левая панель) — вытянутым ромбом (класс .rh1, см. CSS).
   v0.402, «размер 1, 2, 4, 8, 16 — сколько помещается целых ромбов», «треугольник — это стрелки, 4 штуки»: ромбом — кнопки всех размеров, в
   которые помещается хотя бы один целый ромб 24 px; кнопка, на которой одна стрелка ◀ ▶ ▲ ▼ (◄ ►), — треугольником (.tri-l|r|u|d).
   Ширина — вычисленная, а не измеренная: у спрятанной до поры кнопки (только для 3D и т.п.) она та же, и форма у неё сразу своя.
   Стрелки ползунков (.zerk-arrow) не трогаются. */
const RH_TRI = { "◀": "l", "◄": "l", "▶": "r", "►": "r", "▲": "u", "▼": "d" };
/* v0.416, «цельные треугольники»: формы — из целых равносторонних треугольников. Высота кнопки h — два ряда по h / 2, сторона s = h / √3,
   --t = s / 2 (глубина острия 120°). Ромб-кнопка — k = ⌊w / s⌋ треугольников по средней черте, поля --m = (w − k·s) / 2; стрелка ◀ ▶ —
   шеврон шириной 3t (--m = (w − 3t) / 2), ▲ ▼ — шириной h и высотой 3t (--m = (w − h) / 2, --my = (h − 3t) / 2). */
function rhombTag(){
  document.querySelectorAll("#w-cone .tools .cgb button, #paneGrp .cgb button").forEach(b => {
    if (b.classList.contains("zerk-arrow")) return;
    if (b.closest(".cjoin")) { b.classList.remove("rh1", "tri-l", "tri-r", "tri-u", "tri-d"); return; }   // v0.419: в сцепке — своя форма (joinTag)
    const ar = RH_TRI[b.textContent.trim()];
    if (ar !== "u" && ar !== "d" && b.closest("#w-cone .tools, #paneGrp")) { b.classList.remove("rh1", "tri-l", "tri-r"); return; }   // v0.447: в конусе — triTag; v0.463 — и на левой панели
    const cs = getComputedStyle(b), w = parseFloat(cs.width) || 0, h = parseFloat(cs.height) || 24;
    const sd = h / Math.sqrt(3), t = sd / 2, px = (v) => Math.max(0, v).toFixed(2) + "px";
    b.classList.toggle("rh1", !ar && w >= sd);
    for (const k of ["l", "r", "u", "d"]) b.classList.toggle("tri-" + k, ar === k);
    b.style.setProperty("--t", px(t)); b.style.setProperty("--h2", px(h / 2));
    if (ar === "l" || ar === "r") b.style.setProperty("--m", px((w - 5 * t) / 2));   // v0.418: ◀ ▶ — из шести треугольников (5t)
    else if (ar) { b.style.setProperty("--m", px((w - h) / 2)); b.style.setProperty("--my", px((h - 3 * t) / 2)); }
    else { const k = Math.max(1, Math.floor((w + 0.01) / sd)); b.style.setProperty("--m", px((w - k * sd) / 2)); }
  });
}
window.addEventListener("load", () => setTimeout(rhombTag, 0));
/* v0.419: СЦЕПКА ряда (.cjoin, data-ends — по знаку на край: «(» остриём влево, «)» — вправо). Кнопка i: левый край — знак i («(» —
   остриё, «)» — выемка), правый — знак i + 1 («)» — остриё, «(» — выемка). Глубина острия --t = h / (2√3) — остриё 120°, как у кнопок из
   треугольников. Зовётся из rhombTag (после каждой раскладки групп). */
function joinTag(){
  document.querySelectorAll("span.cjoin").forEach(sp => {
    if (sp.closest("#w-cone .tools .cgb, #paneGrp .cgb")) return;   // v0.503: в группах — общая цепочка из треугольников (triTag)
    const e = sp.dataset.ends || "", bs = [...sp.children].filter(c => c.tagName === "BUTTON" && !c.hidden && !c.classList.contains("tzk"));   // v0.452: и не из конструктора   // v0.425: спрятанные — не в сцепке
    bs.forEach((b, i) => {
      const L = e[i], R = e[i + 1], h = parseFloat(getComputedStyle(b).height) || 24;
      /* v0.422, «(стоп) — из скольких собран так: ()()()?» → «2 — подгони все под целые треугольники»: длина кнопки сцепки — целое число
         треугольников. В глубинах острия t: концы одного рода (остриё–остриё, выемка–выемка) — чётное 2k (k треугольников по ряду), разного
         (остриё–выемка, как стрелка) — нечётное 2n + 1; ближайшее к нынешней ширине, не меньше 2 и 3. Стрелки — 3 (4 треугольника). */
      if (!RH_TRI[b.textContent.trim()]) {
        const tt = h / (2 * Math.sqrt(3)), same = (L === "(") === (R === ")"), w0 = parseFloat(b.dataset.w0 || getComputedStyle(b).width) || 0;
        if (!b.dataset.w0) b.dataset.w0 = w0;
        let u = w0 / tt; u = same ? Math.max(2, 2 * Math.round(u / 2)) : Math.max(3, 2 * Math.round((u - 1) / 2) + 1);
        // v0.423, «на странице длинная какая-то СТОП»: длина может быть задана прямо — data-k (треугольников по средней черте): 2k, у «остриё–выемка» 2k + 1
        if (+b.dataset.k > 0) u = same ? 2 * +b.dataset.k : 2 * +b.dataset.k + 1;
        b.style.setProperty("width", (u * tt).toFixed(2) + "px", "important");
      }
      b.classList.add("jz");
      b.classList.toggle("jl-tip", L === "("); b.classList.toggle("jl-notch", L === ")");
      b.classList.toggle("jr-tip", R === ")"); b.classList.toggle("jr-notch", R === "(");
      b.classList.toggle("jarrow", !!RH_TRI[b.textContent.trim()]);
      b.style.setProperty("--t", (h / (2 * Math.sqrt(3))).toFixed(2) + "px");
      /* v0.423, по рисунку (стоп) = ()()() — «тут правильно, а на странице»: внутри кнопки сцепки — сетка её треугольников, как на рисунке:
         средняя черта и косые под ±60° через каждую вершину на средней черте (шаг — сторона s = 2t); от острия слева вершины — с x = 0, от
         выемки — с x = t. Картинка SVG — пятым слоем фона, рамка кнопки её обрезает. */
      { const t2 = h / (2 * Math.sqrt(3)), sd = 2 * t2, x0 = L === "(" ? 0 : t2;
        const W = RH_TRI[b.textContent.trim()] ? (b.classList.contains("jwide") ? 5 : 3) * t2 : (parseFloat(b.style.width) || parseFloat(getComputedStyle(b).width) || 0);   // стрелка — 3t (широкая — 5t), до пересчёта стиля
        let d = `M0 ${h / 2}H${W.toFixed(2)}`;
        for (let M = x0 - sd; M <= W + sd; M += sd) d += `M${(M - t2).toFixed(2)} 0L${(M + t2).toFixed(2)} ${h}M${(M + t2).toFixed(2)} 0L${(M - t2).toFixed(2)} ${h}`;
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W.toFixed(2)}" height="${h}"><path d="${d}" stroke="rgba(216,221,232,.2)" stroke-width="1" fill="none"/></svg>`;
        b.style.setProperty("--lat", `url("data:image/svg+xml,${encodeURIComponent(svg)}")`);
        /* v0.429, «две стрелки „))“»: у широкой стрелки (5t) — черта по стыку двух шевронов (маска для ::before, см. CSS). ▶ (выемка слева):
           первый шеврон 0…3t, стык — (2t, 0) → (3t, h/2) → (2t, h); ◀ (остриё слева): стык — (3t, 0) → (2t, h/2) → (3t, h) */
        if (RH_TRI[b.textContent.trim()] && b.classList.contains("jwide")) {
          const a = L === "(" ? 3 * t2 : 2 * t2, m = L === "(" ? 2 * t2 : 3 * t2;
          const dv = `<svg xmlns="http://www.w3.org/2000/svg" width="${W.toFixed(2)}" height="${h}"><path d="M${a.toFixed(2)} 0L${m.toFixed(2)} ${h / 2}L${a.toFixed(2)} ${h}" stroke="#000" stroke-width="2" fill="none"/></svg>`;
          b.style.setProperty("--jdiv", `url("data:image/svg+xml,${encodeURIComponent(dv)}")`);
        } else b.style.removeProperty("--jdiv"); }
    });
  });
}
{ const rt0 = rhombTag; rhombTag = function(){ rt0(); joinTag(); }; }
/* v0.447, по рисунку из «△ Сетки» — «пока только в группе Конус», «как на рисунке», стрелки — 46 47 / 102 103: кнопки групп окна конуса — из
   целых треугольников (класс .tz, см. CSS). Обычная — шестигранник: острия с обоих концов, длина — n сторон s по средней черте (полкнопки .ib —
   3, кнопка — 6, .w2 — 12, .w4 — 24); ◀ ▶ — шеврон из 4 треугольников (3t: выемка с одной стороны, остриё с другой); ▲ ▼ — как были (rhombTag).
   Внутри — сетка треугольников (как joinTag). Ушла из конуса (группа на левой панели) — форма снимается. Счёт — раз на вид кнопки (b._tzk) */
/* v0.448, по снимку «Своя» (сетка видна) и рисунку цепочки 215…303 — «внутри кнопок не надо сетку, все кнопки без зазора — прижать друг к другу,
   разделяй их обводкой»: сетки внутри нет; кнопки ряда сцеплены — остриё одной входит в выемку следующей (следующая заходит на t, как в сцепке
   «Звука»), первая в строке (или после поля, списка, подписи) — остриём. Граница — светлая обводка по контуру каждой кнопки (у соседей она общая).
   Сцепка считается по раскладке (одна строка — один верх), длина кнопки от неё не меняется: шаг всегда n сторон. */
/* v0.450, «три цвета короче; Своя и цвета — между цветами цвет фона Своя, и далее другие» (рисунок 215…302): «Своя» — остриём слева, выемкой
   справа; в выемку входит цвет 1, за ним 0 и а — шестигранники из 6 треугольников, остриё к острию; просветы между ними — цветом «Своя» (фон
   блока #palOwn, обрезан шестигранником). Блок — снова в две кнопки (24t). Трапеции v0.449 сняты. */
/* v0.449, по снимку «Своя 1 0 а» — «что за квадраты 3?? вот так их можно» (рисунок 237…327: голубая, сиреневая, красная трапеции встык): три
   цвета своей гаммы (#palOwn > label.pcol) — трапеции со скосами / \ из целых треугольников, n = 4 стороны по средней черте; через одну —
   узкая сверху (/ \) и узкая снизу (\ /), так они ложатся полосой без щелей. Сцепка теперь — для любых краёв: край — три отступа (верх,
   середина, низ) в t: остриё 1 0 1, выемка 0 1 0, скос «/» слева 2 1 0, «\» слева 0 1 2 (справа — зеркально). Соседи сходятся серединами
   (следующий заходит на e + b), если края не лезут друг на друга; кнопка-шестигранник берёт выемку, когда слева остриё, иначе — остриё.
   Соседом считается и последний элемент блока перед ней (span), и наоборот — так «Янтарь» прижат к последней трапеции. */
const TZ_TIP = [1, 0, 1], TZ_NOTCH = [0, 1, 0];
const tzFits = (r, l) => r[1] - r[0] <= l[0] - l[1] && r[1] - r[2] <= l[2] - l[1];   // правый край соседа r и левый l не перекрываются
function triOff(b){ b.classList.remove("tz", "tzar"); ["width", "flex", "margin-left", "--lat"].forEach(k => b.style.removeProperty(k)); b._tzk = ""; b._tzL = null; b._tzm = 0; }
function tzGeo(b){   // форма по b._tzL / b._tzR (края в t), b._tzn (сторон по средней черте), b._tzm (на сколько t зайти на соседа слева)
  const h = parseFloat(getComputedStyle(b).height) || 24, L = b._tzL || TZ_TIP, R = b._tzR, n = b._tzn, m = b._tzm || 0;
  const key = [L, R, n, h, m, b._tzar || "", b._gcol || ""].join("|");
  if (b._tzk === key && b.classList.contains("tz")) return;
  b._tzk = key;
  const t = Math.min(h, TZC_H) / (2 * Math.sqrt(3)), px = (v) => v.toFixed(2) + "px", W = (L[1] + R[1] + 2 * n) * t + (m ? 1 : 0);   // v0.478: шаг — по ряду 24 px, даже если кнопка на 1 px выше (заходит на ряд ниже)
  /* v0.451, «убери двойную обводку между кнопками»: у сцепленных каждая обводила общий край со своей стороны, и между линиями просвечивал
     тёмный шов (сглаживание двух краёв). Теперь следующая заходит на соседку ещё на 1 px (шире на 1 px — шаг тот же) и её край ложится поверх
     линии соседки: стык — одна линия, без шва */
  b.classList.remove("rh1", "tri-l", "tri-r"); b.classList.add("tz"); b.classList.toggle("tzar", !!b._tzar);
  [["--a", L[0]], ["--b", L[1]], ["--c", L[2]], ["--d", R[0]], ["--e", R[1]], ["--f", R[2]]].forEach(([k, v]) => b.style.setProperty(k, px(v * t)));
  b.style.setProperty("--t", px(t));
  b.style.setProperty("width", px(W), "important"); b._tzOwnW = parseFloat(px(W));   // v0.483: своя — чтобы не принять её за заданную
  if (b.tagName === "LABEL") b.style.setProperty("flex", "0 0 " + px(W), "important");
  if (m) b.style.setProperty("margin-left", px(-m * t - 1), "important"); else b.style.removeProperty("margin-left");
  const pts = [[L[0], 0], [W / t - R[0], 0], [W / t - R[1], h / 2], [W / t - R[2], h], [L[2], h], [L[1], h / 2]].map(([x, y]) => (x * t).toFixed(2) + "," + y).join(" ");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W.toFixed(2)}" height="${h}"><polygon points="${pts}" stroke="${b._gcol || "rgba(232,235,242,.8)"}" stroke-width="${Z.noLn ? 4 : 2}" fill="none"/></svg>`;   // v0.498: цветом фона — толще (видно 2 px)
  b.style.setProperty("--lat", `url("data:image/svg+xml,${encodeURIComponent(svg)}")`);
  // v0.467: маска толстой обводки нажатой (видна внутренняя половина — 2,5 px), цвет даёт CSS
  const so = `<svg xmlns="http://www.w3.org/2000/svg" width="${W.toFixed(2)}" height="${h}"><polygon points="${pts}" stroke="#000" stroke-width="5" fill="none"/></svg>`;
  b.style.setProperty("--lato", `url("data:image/svg+xml,${encodeURIComponent(so)}")`);
}
function triTag(){
  const vis = (el) => el.getClientRects().length > 0;
  /* v0.471, «у всех кнопок должна быть обводка цвета самой группы»: контур — цветом заголовка группы (как её рамка), берётся раз на группу */
  const gcm = new Map(), lnBg = tzLnBg(), gcol = (el) => { if (lnBg) return lnBg; const g = el.closest(".cgrp"); if (!g) return ""; if (!gcm.has(g)) { const l = g.querySelector(":scope > .glab"); gcm.set(g, l ? getComputedStyle(l).color : ""); } return gcm.get(g); };
  document.querySelectorAll(".tz").forEach(b => { if (!b.closest("#w-cone .tools .cgb, #paneGrp .cgb") && !(b.classList.contains("glab") && b.closest("#w-cone .tools, #paneGrp"))) triOff(b); });   // v0.486: заголовок группы — не трогать (он вне блока кнопок)
  const bs = [];
  /* v0.463, «вообще переделай сам у всех групп кнопок, включая ползунки и выпадающие списки, чтоб всё было стандартно»: из треугольников — всё, что
     стоит в группах (окно конуса и левая панель): кнопки, галки-кнопки, списки, ползунки, поля чисел, подписи; все в одной цепочке «остриё в выемку».
     Длина — целое число сторон: полкнопки 3, кнопка 6, двойная 12 (ползунок — 12), подпись — по своей ширине */
  document.querySelectorAll("#w-cone .tools .cgb :is(button, select, label, .glab2), #paneGrp .cgb :is(button, select, label, .glab2), #w-cone .tools .cgrp > .glab, #paneGrp .cgrp > .glab").forEach(b => {
    if (b.classList.contains("tzk")) return;   // v0.452: в конструкторе — своя форма (tzcApply)
    const cgb = b.closest(".cgb"); b._gcol = gcol(b);
    /* v0.473, «заголовок группы — это самая первая кнопка, и все следующие размещать на её же строке, если размер позволяет»: подпись группы — шестигранник
       в начале цепочки (у групп конструктора △ — как была: их раскладку задаёт рисунок) */
    if (b.classList.contains("glab")) {
      const g = b.parentElement, gb = g && g.querySelector(":scope > .cgb");
      if (!g || !g.closest("#w-cone .tools, #paneGrp")) { if (b.classList.contains("tz")) triOff(b); return; }   // v0.475: и у групп конструктора
      const sd = TZC_H / Math.sqrt(3), wRaw = parseFloat(b.style.width) || 0, own = b._tzOwnW && Math.abs(wRaw - b._tzOwnW) < 0.5, wInl = own ? 0 : wRaw;
      /* v0.483, «длина сама вытягивается»: своя ширина (её ставит tzGeo, с выемкой +t) — не «заданная»: иначе n + 0,5 округлялось в n + 1 при каждом
         пересчёте, и подпись росла без конца. Нужное место — без своих краёв */
      const edge = ((b._tzL || TZ_NOTCH)[1] + TZ_TIP[1]) * sd / 2, need = Math.ceil(((b.scrollWidth || 0) - edge) / sd - 0.05);
      b._tzar = ""; b._tzfix = true; b._tzL = TZ_NOTCH; b._tzR = TZ_TIP;
      b._tzn = Math.max(wInl ? Math.max(3, Math.round(wInl / sd)) : own ? Math.min(b._tzn0 || 6, Math.max(6, Math.ceil(need / 3) * 3)) : 6, Math.ceil(need / 3) * 3);
      b._tzn0 = b._tzn; b._tzx = 0; tzGeo(b); bs.push(b); return;
    }
    if (b.tagName !== "BUTTON" && !b.classList.contains("pcol")) {   // v0.463: не кнопка — шестигранник по своей ширине
      if (tzcItem(b, cgb) !== b || b.closest(".cjoin")) { if (b.classList.contains("tz")) triOff(b); return; }
      const sd = TZC_H / Math.sqrt(3), wRaw = parseFloat(b.style.width) || 0, rng = !!b.querySelector(".zerk-range-wrap");
      const own = b._tzOwnW && Math.abs(wRaw - b._tzOwnW) < 0.5, wInl = own ? 0 : wRaw;   // v0.483: своя ширина — не «заданная» (см. заголовок)
      b._tzar = ""; b._tzfix = false; b._tzR = TZ_TIP;
      b._tzn = b.classList.contains("fh") ? 3 : b.classList.contains("w4") ? 24 : b.classList.contains("w2") || rng ? 12 : b.classList.contains("glab2") && wInl ? Math.max(3, Math.round(wInl / sd))
        : b.classList.contains("glab2") ? (() => { const rg = document.createRange(); rg.selectNodeContents(b); return Math.max(3, Math.ceil((rg.getBoundingClientRect().width + 6) / sd)); })() : 6;   // v0.499: подпись — по длине текста («весь:» — 3 стороны, не 6)
      b._tzn0 = b._tzn; b._tzx = 0; tzGeo(b); bs.push(b); return;
    }
    if (b.closest("#paneGrp") && b.classList.contains("pcol")) { if (b.classList.contains("tz")) triOff(b); return; }
    if (b.tagName === "LABEL") {   // v0.450: цвет своей гаммы — шестигранник из 6 треугольников (n = 2), остриё к острию; просветы — цветом «Своя» (фон блока, CSS)
      b._tzar = ""; b._tzn = 2; b._tzfix = true; b._tzL = TZ_NOTCH; b._tzR = TZ_TIP;   // v0.486: и цвета — «стрелки вправо»
      b._tzn0 = b._tzn; b._tzx = 0; tzGeo(b); bs.push(b); b.parentElement.style.setProperty("--t", b.style.getPropertyValue("--t")); return;
    }
    const ar = RH_TRI[b.textContent.trim()];
    /* v0.503, по снимку «Звука» — «поправь все кнопки у звука»: блок ◀ ⏵ ▶ (.cjoin) рисовался по-старому, с косой сеткой внутри (крестики) — теперь
       его кнопки в общей цепочке из треугольников, как все */
    if (b.classList.contains("zerk-arrow") || ar === "u" || ar === "d") { if (b.classList.contains("tz")) triOff(b); return; }
    b._tzar = ar; b._tzn = ar ? 1 : b.classList.contains("ib") ? 3 : b.classList.contains("w4") ? 24 : b.classList.contains("w2") ? 12 : 6;
    b._tzR = ar === "l" ? TZ_NOTCH : TZ_TIP; b._tzfix = !!ar;
    if (ar) b._tzL = TZ_NOTCH;   // v0.485: ▶ — «стрелка вправо» (выемка — остриё), ◀ — «песочные часы» (выемки с обеих сторон)
    /* v0.486, «Своя также сделай»: «Своя» — как все, «стрелка вправо» (прежде, v0.450, — остриём слева и выемкой к цветам) */
    b._tzn0 = b._tzn; b._tzx = 0; tzGeo(b); bs.push(b);
  });
  const lastOf = (el) => { if (el.classList.contains("tz") || el.tagName !== "SPAN" || el.classList.contains("cjoin")) return el; const c = [...el.children].reverse().find(vis); return c ? lastOf(c) : el; };
  const prevOf = (b) => { for (let x = b; ; ) { let p = x.previousElementSibling; while (p && !vis(p)) p = p.previousElementSibling; if (p) return lastOf(p);
    x = x.parentElement;
    if (x && x.classList.contains("cgb")) { let q = x.previousElementSibling; while (q && !vis(q)) q = q.previousElementSibling; return q && q.classList.contains("glab") ? q : null; }   // v0.473: первая — к заголовку
    if (!x || x.tagName !== "SPAN" || x.classList.contains("cjoin")) return null; } };
  for (let pass = 0; pass < 2; pass++) {   // сцепка — по раскладке (одна строка — один верх); шаг от неё у стрелок меняется, поэтому второй проход
    let ch = false;
    bs.forEach(b => {
      if (!vis(b)) return;
      const p = prevOf(b), lk = !!p && p.classList.contains("tz") && !p.classList.contains("tzk") && Math.abs(p.getBoundingClientRect().top - b.getBoundingClientRect().top) < 6;
      let L = b._tzL || TZ_TIP;
      /* v0.485, «все кнопки пусть по умолчанию, если не редактировать, — стрелки вправо»: слева всегда выемка, справа остриё — остриё соседа входит в выемку */
      if (!b._tzfix) L = TZ_NOTCH;
      const m = lk && tzFits(p._tzR, L) ? p._tzR[1] + L[1] : 0;
      if (L !== b._tzL || m !== (b._tzm || 0)) { b._tzL = L; b._tzm = m; tzGeo(b); ch = true; }
    });
    if (!ch) break;
  }
  new Set(bs.map(b => b.closest(".cgrp")).filter(Boolean)).forEach(tzJustify);   // v0.484
}
/* v0.484, по снимку «Гаммы» с пустым местом справа — «пустой длины не должно быть, а нижний ромб-размер накладывай на кнопку»: последняя кнопка каждого
   ряда дотягивается до правого края (целыми сторонами), группа — по самому длинному ряду; ромб-ручка — на правом конце последней кнопки нижнего ряда.
   У группы конструктора кнопки нарисованы — там только ширина по рисунку и ромб на последней кнопке (tzcApply) */
function tzJustify(g){
  const cgb = g.querySelector(":scope > .cgb"); if (!cgb || !g.closest("#w-cone .tools, #paneGrp") || !g.classList.contains("tzg")) return;
  if (cgb.classList.contains("tzc") || g.classList.contains("cmin")) { tzHandle(g); return; }
  const t = TZC_H / (2 * Math.sqrt(3)), its = [...g.querySelectorAll(".tz")].filter(e => !e.classList.contains("tzk") && e.getClientRects().length && e.closest(".cgrp") === g);
  const sz = g.classList.contains("csz") && Z.cgrpSize && Z.cgrpSize[g.dataset.g];
  g.style.width = sz ? Math.max(sz.w, tzMinW(g)) + "px" : ""; g.style.flexShrink = "";
  its.forEach(e => { if (e._tzx) { e._tzx = 0; e._tzn = e._tzn0; tzGeo(e); } });
  if (!sz) { const mw = tzMinW(g); if (g.offsetWidth < mw) { g.style.width = mw + "px"; g.style.flexShrink = "0"; } }   // v0.499: сразу не уже самого широкого блока — иначе ряды разложатся по узкой и так и останутся
  const gl = g.getBoundingClientRect().left, rows = new Map();
  its.forEach(e => { const r = e.getBoundingClientRect(), k = Math.round(r.top); if (!rows.has(k)) rows.set(k, []); rows.get(k).push([e, r.right - gl]); });
  let maxR = 0; rows.forEach(a => a.forEach(([, x]) => { maxR = Math.max(maxR, x); }));
  const canGrow = (e) => e._tzn0 != null && !e._tzar && !e.classList.contains("pcol") && !(e.dataset && e.dataset.w1)   // v0.490: стрелки, цвета и data-w1 — не тянуть
    && (e.parentElement === cgb || inRow(e.parentElement));   // v0.493: кнопки внутри блоков — не тянуть; v0.494, «ширина у заголовка — поправь»: и заголовок не тянуть
  /* v0.499, по снимку «Кручения» — «наладь тут размеры»: внутри блока, стоящего одной строкой (шаг: ◀ ползунок ▶|), — тянуть можно; блок в несколько
     строк (режимы, когда не влезли в одну) — нет. Значки (◀ ▶| ⟲ ⟳) тянутся, только если больше в ряду тянуть нечего */
  function inRow(w){ return w && w.parentElement === cgb && w.tagName === "SPAN" && w.getBoundingClientRect().height < 30; }
  rows.forEach(a => { const x = Math.max(...a.map(q => q[1])), k = Math.floor((maxR - x) / (2 * t) + 0.02);
    let c = a.filter(q => canGrow(q[0])).sort((p, q) => q[1] - p[1]).map(q => q[0]);
    if (c.some(e => !e.classList.contains("ib"))) c = c.filter(e => !e.classList.contains("ib"));
    if (k <= 0 || !c.length) return;
    for (let i = 0; i < k; i++) c[i % c.length]._tzx = (c[i % c.length]._tzx || 0) + 1;   // v0.493: недостающее — поровну, по стороне на кнопку по кругу (справа налево)
    c.forEach(e => { if (e._tzx) { e._tzn = e._tzn0 + e._tzx; tzGeo(e); } }); });
  if (maxR > 0) { g.style.width = Math.ceil(maxR) + "px"; g.style.flexShrink = "0"; }   // v0.499: посчитанную ширину — не ужимать (доли пикселя переносили кнопку)
  tzHandle(g);
}
function tzHandle(g){   // ромб-ручка — на правом конце последней кнопки нижнего ряда
  const h = g.querySelector(":scope > .cgsz"); if (!h || !g.classList.contains("tzg")) return;
  const its = [...g.querySelectorAll(".tz, .tzk")].filter(e => e.closest(".cgrp") === g && e.getClientRects().length && !e.closest(".zerk-range-wrap"));
  if (!its.length) return;
  const gr = g.getBoundingClientRect(), t = TZC_H / (2 * Math.sqrt(3));
  let bot = -1e9; its.forEach(e => { bot = Math.max(bot, e.getBoundingClientRect().top); });
  let last = null, lr = null; its.forEach(e => { const r = e.getBoundingClientRect(); if (Math.abs(r.top - bot) < 6 && (!lr || r.right > lr.right)) { last = e; lr = r; } });
  if (!lr) return;
  h.style.setProperty("left", (lr.right - gr.left - 2 * t).toFixed(2) + "px", "important"); h.style.setProperty("top", (lr.top - gr.top).toFixed(2) + "px", "important");
  h.style.setProperty("right", "auto", "important"); h.style.setProperty("bottom", "auto", "important");
}
{ const rt1 = rhombTag; rhombTag = function(){ rt1(); triTag(); }; }
/* v0.452, по снимкам «Гаммы» и «△ Сетки» — «сделай кнопку рядом с заголовком, маленький значок: при нажатии данная панель отображается
   конструктором; здесь и тут я правлю руками кнопки». △ в заголовке группы конуса открывает окно «△ Сетка», привязанное к группе: каждая
   кнопка (и поле, список, цвет) — своя фигура из треугольников своего цвета с подписью. Красишь, стираешь, перекрашиваешь — кнопки группы на
   странице сразу встают по рисунку: место и форма — ровно те треугольники, что за ней числятся (Z.cgrpTri[группа].o: "r_c" → кнопка).
   Кому числится треугольник: касающиеся рёбрами одного цвета — одна фигура, она за той кнопкой, за которой большинство её треугольников;
   фигура без хозяина — за ближайшей кнопкой того же цвета (так кнопка может быть и из нескольких кусков). Обводка — одна линия на стык
   (слой поверх группы). Что в рисунок не попало — ниже, обычным рядом. Своё (что было в сетке) на время конструктора откладывается
   (Z.triMine) и возвращается по «✓ готово»; «↺ как было» — группа снова обычным рядом. */
const TZC_H = 24;
/* v0.497, «сделай её в цвет фона холста»: при «▱» (Z.noLn) обводки кнопок, заголовков, колец и стыков — цветом фона холста (--bg), а не группы */
function tzLnBg(){ return Z.noLn ? coneCss("--bg", "#0b0d12") : ""; }
const tzcGcol = (g) => { const bg = tzLnBg(); if (bg) return bg; const l = g && g.querySelector(":scope > .glab"); return (l && getComputedStyle(l).color) || "rgba(232,235,242,.8)"; };   // v0.471: цвет группы
const tzcGroup = (key) => [...document.querySelectorAll(".cgrp")].find(g => g.dataset.g === key) || null;
function tzcItem(el, cgb){   // элемент группы под точкой: кнопка, поле, список, подпись (не блок-обёртка; попал в обёртку — её первая кнопка)
  { const gl = el && el.closest && el.closest(".glab"); if (gl && cgb && gl.parentElement === cgb.parentElement) return gl; }   // v0.486: и заголовок группы
  if (!el || el === cgb || !cgb.contains(el)) return null;
  let x = el;
  while (x.parentElement && x.parentElement !== cgb) { const p = x.parentElement; if (p.tagName === "SPAN" && !p.closest("button, label, select")) break; x = p; }
  if (x.classList.contains("tzco")) return null;
  if (x.tagName === "SPAN" && x.querySelector("button, label, select, input")) return x.querySelector("button") || null;
  return x;
}
function tzcKey(el, cgb){ if (el.classList.contains("glab")) return "glab"; const k = btnKey(el); if (k) return k; const p = []; for (let x = el; x && x !== cgb; x = x.parentElement) p.unshift([...x.parentElement.children].indexOf(x)); return "@" + p.join("/"); }
function tzcFind(key, cgb){
  if (key === "glab") return cgb && cgb.parentElement ? cgb.parentElement.querySelector(":scope > .glab") : null;   // v0.486
  if (key[0] === "@") { let x = cgb; for (const i of key.slice(1).split("/")) x = x && x.children[+i]; return x || null; }
  try { return key[0] === "#" && !/[\s[>]/.test(key) ? document.getElementById(key.slice(1)) : document.querySelector(key); } catch (e) { return null; }
}
function tzcLabel(el){
  if (el.tagName === "SELECT") return (el.options[el.selectedIndex] || {}).text || "▾";
  const t = (el.dataset.lab || el.textContent || "").replace(/\s+/g, " ").trim();
  return [...t].slice(0, 8).join("") || (el.tagName === "LABEL" ? "▭" : "");
}
/* v0.454, по снимку «Своя», доведённой тем же цветом (надпись «Своя» — на каждом куске) — «как-то надо возможность указывать, что это
   относится к кнопке такой-то; у каждой кнопки пусть свой цвет будет»: в конструкторе у КАЖДОЙ кнопки группы своя кисть — свой цвет
   (TRI_COL[100 + i], i — номер кнопки в d.items, оттенки через золотой угол) с её надписью; кисти — в строке конструктора. Треугольник,
   закрашенный кистью кнопки, — её, где бы ни стоял (куски не обязаны касаться). Обычные цвета палитры — просто рисунок, кнопкам не
   принадлежат. Надпись кнопки в сетке — одна, на самом большом куске (а не символ на каждом). Прежний рисунок (v0.452–0.453: хозяин в d.o)
   переводится в кисти сам. */
const TZC_K0 = 100;
const tzcHue = (i) => `hsl(${Math.round((i * 137.508) % 360)}, 68%, 62%)`;
function tzcItems(g, d){   // все кнопки группы — в d.items (новые — в конец), их кисти — в TRI_COL
  const cgb = g.querySelector(".cgb"); if (!cgb) return;
  if (!Array.isArray(d.items)) d.items = [];
  for (const m of [d.c, d.o, d.gl, d.gi]) if (m) for (const k of Object.keys(m)) if (!/^\d+_\d+$/.test(k)) delete m[k];   // v0.462: битые номера треугольников (NaN, минус) — вон
  [g.querySelector(":scope > .glab"), ...cgb.querySelectorAll("button, select, label, .glab2")].filter(el => el && !el.hidden && tzcItem(el, cgb) === el).forEach(el => { const k = tzcKey(el, cgb); if (!d.items.includes(k)) d.items.push(k); });
  if (d.fmt !== 2) {   // рисунок v0.452–0.453 — в кисти
    d.c = d.c || {};
    for (const [k, w] of Object.entries(d.o || {})) { let i = d.items.indexOf(w); if (i < 0) { d.items.push(w); i = d.items.length - 1; } d.c[k] = TZC_K0 + i; }
    d.gt = {}; d.fmt = 2;
    if (Z.triBind === g.dataset.g) { Z.triCells = Object.assign({}, d.c); Z.triGTx = {}; }   // конструктор открыт — и сетке тот же рисунок, иначе она запишет поверх старый
  }
  TRI_COL.length = TZC_K0;
  d.items.forEach((w, i) => { const el = tzcFind(w, cgb); TRI_COL[TZC_K0 + i] = [tzcHue(i), (el && tzcLabel(el)) || w]; });
}
function tzcGrab(g){   // нынешняя раскладка группы → треугольники: опрос точкой в центре каждого треугольника (elementFromPoint видит и clip-path)
  /* v0.486, «эта группа в редактор не идёт почему-то»: с v0.473 блок кнопок растворён (display: contents), его прямоугольник нулевой — снимок выходил
     пустым («группу не видно»). Мерить по самой группе; заголовок — тоже кнопка рисунка */
  const cgb = g.querySelector(".cgb"), rc = g.getBoundingClientRect(), hh = TZC_H / 2, t = TZC_H / (2 * Math.sqrt(3));
  const its = [g.querySelector(":scope > .glab"), ...cgb.querySelectorAll("button, select, label, .glab2")].filter(el => el && el.getClientRects().length && tzcItem(el, cgb) === el);
  const tops = []; its.forEach(el => { const y = el.getBoundingClientRect().top; if (!tops.some(v => Math.abs(v - y) < 8)) tops.push(y); }); tops.sort((a, b) => a - b);
  let ox = rc.left; const f = its.find(el => el.classList.contains("tz"));
  if (f) { const X = Math.round((f.getBoundingClientRect().left + (f._tzL ? f._tzL[1] : 0) * t - ox) / t); if (((X % 2) + 2) % 2) ox -= t; }   // острия — в чётных узлах
  const cols = Math.ceil((rc.width + 2 * t) / t) + 1, o = {}, keyOf = new Map();
  tops.forEach((y0, j) => { for (let rr = 0; rr < 2; rr++) { const r = 2 * j + rr; for (let cc = 0; cc < cols; cc++) {
    const up = (r + cc) % 2 === 0, cx = ox + (cc + 1) * t, cy = y0 + rr * hh + (up ? 2 / 3 : 1 / 3) * hh;
    const it = tzcItem(document.elementFromPoint(cx, cy), cgb); if (!it) continue;
    if (!keyOf.has(it)) keyOf.set(it, tzcKey(it, cgb));
    o[r + "_" + cc] = keyOf.get(it); } } });
  const d = { c: {}, gt: {}, gl: {}, gi: {}, o, items: [], v: 1, on: true, fmt: 2 };
  tzcItems(g, d);
  for (const [k, w] of Object.entries(o)) { let i = d.items.indexOf(w); if (i < 0) { d.items.push(w); i = d.items.length - 1; } d.c[k] = TZC_K0 + i; }
  tzcItems(g, d);
  return d;
}
/* v0.462, на «после этого раскладка с переносом становится самим рисунком» — «а на те, что были, нельзя?»: перенос больше не впечатывается.
   Рисунок (d) — исходный, длинными рядами; в сетке — ВИД, как на экране: каждая кнопка сдвинута, как её сдвинул перенос (tzcView). Правка в сетке
   встаёт в рисунок с обратным сдвигом кнопки, чьей кистью закрашено (tzcUnview); линия ╱ — по кнопке с одной из сторон ребра. Шире группу —
   кнопки снова в длинные ряды, уже — переносятся; сетка следует за этим сама */
const tzcEq = (a, b) => { a = a || {}; b = b || {}; const ka = Object.keys(a); return ka.length === Object.keys(b).length && ka.every(k => JSON.stringify(a[k]) === JSON.stringify(b[k])); };
let tzcViewSh = {};   // сдвиги, по которым построен вид, что сейчас в сетке: обратный перевод — по ним, а не по новым (иначе правка ляжет не туда)
const tzcVO = (d) => { const it = d.items || [], o = {}; for (const [k, v] of Object.entries(Z.triCells || {})) { const w = it[(v | 0) - TZC_K0]; if (w) o[k] = w; } return o; };   // хозяева в сетке (вид)
function tzcView(g, d){   // рисунок → вид на экране
  const sh = (g && g._tzcSh) || {}, o = d.o || {};
  const mv = (map) => { const out = {}; for (const [k, v] of Object.entries(map || {})) { const w = o[k], [dr, dc] = (w && sh[w]) || [0, 0], [r, c] = k.split("_").map(Number); out[(r + dr) + "_" + (c + dc)] = v; } return out; };
  const l = {};
  for (const [key, v] of Object.entries(d.l || {})) {
    const [A, Bn] = key.split("|").map(q => q.split("_").map(Number)), [dr, dc] = tzcLineShift(A, Bn, o, sh);
    l[[[A[0] + dr, A[1] + dc], [Bn[0] + dr, Bn[1] + dc]].map(n => n.join("_")).sort().join("|")] = v;
  }
  return { c: mv(d.c), gl: mv(d.gl), gi: mv(d.gi), l };
}
function tzcUnview(g, d){   // вид в сетке → рисунок: обратный сдвиг кнопки, чьей кистью закрашено
  const sh = tzcViewSh || {}, vo = tzcVO(d);
  const back = (map) => { const out = {}; for (const [k, v] of Object.entries(map || {})) { const w = vo[k], [dr, dc] = (w && sh[w]) || [0, 0], [r, c] = k.split("_").map(Number); out[(r - dr) + "_" + (c - dc)] = v; } return out; };
  const l = {};
  for (const [key, v] of Object.entries(Z.triLines || {})) {
    const [A, Bn] = key.split("|").map(q => q.split("_").map(Number)), [dr, dc] = tzcLineShift(A, Bn, vo, sh);
    l[[[A[0] - dr, A[1] - dc], [Bn[0] - dr, Bn[1] - dc]].map(n => n.join("_")).sort().join("|")] = v;
  }
  return { c: back(Z.triCells), gl: back(Z.triGLn), gi: back(Z.triGIn), l };
}
function tzcSync(){   // окно → рисунок группы → кнопки; если перенос после правки лёг иначе — сетке новый вид (true)
  const key = Z.triBind, d = Z.cgrpTri && Z.cgrpTri[key]; if (!d) return false;
  const g = tzcGroup(key), U = tzcUnview(g, d), lines = !!(Z.triMine && "l" in Z.triMine);
  d.c = U.c; d.gl = U.gl; d.gi = U.gi; d.gt = {};
  if (lines) d.l = U.l;   // v0.457: линии ╱ — обводка группы
  const o = d.o = {}, it = d.items || [];
  for (const [k, v] of Object.entries(d.c)) { const w = it[(v | 0) - TZC_K0]; if (w) o[k] = w; }
  d.v = (d.v | 0) + 1;
  if (!g) return false;
  tzcApply(g);
  const V = tzcView(g, d);
  tzcViewSh = Object.assign({}, g._tzcSh || {});
  if (tzcEq(V.c, Z.triCells) && tzcEq(V.gl, Z.triGLn) && tzcEq(V.gi, Z.triGIn) && (!lines || tzcEq(V.l, Z.triLines))) return false;
  Z.triCells = V.c; Z.triGLn = V.gl; Z.triGIn = V.gi; if (lines) Z.triLines = V.l;
  return true;
}
function tzcBrushes(){   // кисти кнопок — в строке конструктора
  const box = $("triBindPal"), d = Z.cgrpTri && Z.cgrpTri[Z.triBind]; if (!box || !d) return;
  const used = new Set(Object.values(d.o || {}));
  box.innerHTML = (d.items || []).map((w, i) => { const k = TZC_K0 + i, c = TRI_COL[k]; if (!c) return "";
    return `<button data-c="${k}" class="${Z.triCol === k || (Z.triCol < -1 && Z.triTCol === k) ? "on" : ""}${used.has(w) ? "" : " unused"}" style="background:${c[0]}" title="Кисть кнопки «${esc(c[1])}»: закрашенное ею — её${used.has(w) ? "" : " (сейчас не нарисована — стоит под рисунком)"}">${esc(c[1])}</button>`; }).join("");
}
function tzcLabels(){   // надпись кнопки в сетке — одна, на самом большом её куске
  const cv = $("triCv"), d = Z.cgrpTri && Z.cgrpTri[Z.triBind]; if (!cv || !d || !winOpen("w-tri") || !triGeo.s) return;
  const g = cv.getContext("2d"), dpr = window.devicePixelRatio || 1, t = triGeo.s / 2, hh = triGeo.hh, pad = triGeo.pad;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const vo = tzcVO(d), by = {}; for (const [k, w] of Object.entries(vo)) { const [r, c] = k.split("_").map(Number); if (r < Z.triR && c < Z.triN) (by[w] = by[w] || []).push([r, c]); }
  { const vis = {}; for (const [k, w] of Object.entries(vo)) { const [r, c] = k.split("_").map(Number); if (r < Z.triR && c < Z.triN) vis[k] = w; }
    const lv = new Set(Object.values(vis));
    g.lineCap = "round"; if (!tzcManual(d)) for (const h of tzcHulls(vis, lv, d.items || [], triPts)) { g.strokeStyle = h.col; g.lineWidth = 3; g.stroke(new Path2D(h.d)); }
    for (const h of tzcRingPaths(vis, lv, (d.rings || []).map(rg => Object.assign({}, rg, { col: tzcGcol(tzcGroup(Z.triBind)) })), triPts)) { g.save(); g.clip(new Path2D(h.f)); g.strokeStyle = h.col; g.lineWidth = 2 * h.w * triGeo.s / TRI_S1; g.stroke(new Path2D(h.d)); g.restore(); }   // v0.459
    if (tzcPick && tzcSel.size) for (const h of tzcRingPaths(vis, lv, [{ items: [...tzcSel], col: "#fff" }], triPts)) {   // выбранные — пунктиром
      g.save(); g.strokeStyle = "#fff"; g.lineWidth = 2.5; g.setLineDash([6, 4]); g.stroke(new Path2D(h.d)); g.restore(); } }
  g.textAlign = "center"; g.textBaseline = "middle"; g.font = `bold ${Math.max(9, Math.min(22, triGeo.s * 0.42))}px Segoe UI, Arial`; g.fillStyle = "#0e1116";
  for (const [w, cells] of Object.entries(by)) {
    const i = (d.items || []).indexOf(w), c = TRI_COL[TZC_K0 + i]; if (!c) continue;
    const m = tzcMain(cells);
    g.fillText(c[1], pad + (m.c0 + m.c1 + 2) / 2 * t, pad + (m.r0 + m.r1 + 1) / 2 * hh);
  }
}
function tzcClean(el){
  el.classList.remove("tzk"); el._tzk = "";
  for (const k of ["width", "height", "left", "top", "margin", "margin-left", "padding-left", "padding-right", "--tzp", "--lat", "--lato"]) el.style.removeProperty(k);
}
function tzcOff(g){
  const cgb = g.querySelector(".cgb"); if (!cgb) return;
  (g._tzcEls || []).forEach(tzcClean); g._tzcEls = []; g._tzcv = -1; g._tzcSh = null;   // v0.462: и сдвиги переноса прежнего рисунка
  cgb.classList.remove("tzc"); cgb.style.removeProperty("padding-top"); cgb.style.removeProperty("min-width");
  const ov = cgb.querySelector(":scope > .tzco"); if (ov) ov.remove();
}
function tzcApply(g){
  const d = Z.cgrpTri && Z.cgrpTri[g.dataset.g], cgb = g.querySelector(".cgb");
  if (!cgb || !d || !d.on || !g.closest("#w-cone")) { if (cgb && cgb.classList.contains("tzc")) tzcOff(g); return; }
  const hh = TZC_H / 2, t = TZC_H / (2 * Math.sqrt(3)), s = 2 * t, px = (v) => v.toFixed(2) + "px";
  /* v0.453, «не перестраиваются при изменении длины группы»: группа, которой задан размер (ручка в углу), переносит ряды рисунка — целыми
     кнопками, как обычный ряд: что не влезло, уходит строкой ниже, к левому краю (сдвиг — на чётное число t, треугольники не переворачиваются) */
  let avail = Infinity;
  const sz = Z.cgrpSize && Z.cgrpSize[g.dataset.g];
  if (sz && g.classList.contains("csz")) { const gr = g.getBoundingClientRect(), cr = cgb.getBoundingClientRect(), gs = getComputedStyle(g);
    avail = sz.w - (cr.left - gr.left) - (parseFloat(gs.paddingRight) || 0) - (parseFloat(gs.borderRightWidth) || 0); }
  /* v0.468, по снимку «Роза нажата, а жирная обводка есть и у других» — обводка ⬚ вокруг ОДНОЙ кнопки — знак «нажата»: видна, только пока кнопка нажата
     (горит или галка включена); обводки нескольких кнопок (блоки) — всегда */
  /* v0.470: обводка ⬚ видна всегда, тонкая; v0.476, «убери вообще жирность обводки» — и у нажатой тонкая (жирной больше нет нигде) */
  const onSig = (d.rings || []).map(rg => (rg.items || []).some(w => tzcIsOn(tzcFind(w, cgb))) ? 1 : 0).join("");
  /* v0.475, по снимку «Гаммы» (заголовок отдельной строкой над рисунком) — «заголовок — это как кнопка, в её строке надо их ставить»: заголовок стоит
     поверх левого края первой строки, рисунок первой строки сдвинут вправо на его ширину (tc, в t, чётное); тесно — первая строка уходит под заголовок */
  const gl = g.querySelector(":scope > .glab");
  /* v0.494: заголовок в рисунке шире своего (так снимала добивка ряда до v0.494) — его клетки не в счёт: заголовок своей ширины, первой кнопкой (рисунок не трогаю) */
  let glIn = Object.values(d.o || {}).includes("glab"), glSkip = false;
  if (glIn && gl) { let c0 = 1e9, c1 = -1; for (const [k, w] of Object.entries(d.o)) if (w === "glab") { const c = +k.split("_")[1]; c0 = Math.min(c0, c); c1 = Math.max(c1, c); }
    if (c1 - c0 + 1 > 2 * Math.max(gl._tzn0 || 6, 6) + 3) { glIn = false; glSkip = true; } }
  const tcw = gl && (gl.classList.contains("tz") || gl.classList.contains("tzk")) && !glIn ? (glSkip || gl.classList.contains("tzk") ? (1 + 2 * Math.max(gl._tzn0 || 6, 3)) * t : parseFloat(gl.style.width) || 0) : 0;   // v0.494: у «раздутого» — своя обычная ширина
  const tip = Math.round(tcw / t); let tc = tip; tc += tc % 2;   // tip — остриё заголовка (в t)
  const ac = isFinite(avail) ? Math.max(4, Math.floor(avail / t)) : 1e9, key = d.v + "|" + ac + "|" + onSig + "|" + tc + "|" + tzcGcol(g);   // v0.497: и цвет обводки
  if (!g._tzcRO && window.ResizeObserver) { g._tzcRO = new ResizeObserver(() => tzcApply(g)); g._tzcRO.observe(g); }
  if (g._tzcv === key && cgb.classList.contains("tzc")) return;
  g._tzcv = key;
  const by = {}; for (const [k, w] of Object.entries(d.o || {})) { if (glSkip && w === "glab") continue; (by[w] = by[w] || []).push(k.split("_").map(Number)); }
  cgb.classList.add("tzc");
  const its = [];
  for (const [w, cells] of Object.entries(by)) {
    const el = tzcFind(w, cgb); if (!el || !(cgb.contains(el) || el.parentElement === g) || its.some(x => x.el === el)) continue;
    let r0 = 1e9, r1 = -1, c0 = 1e9, c1 = -1; for (const [r, c] of cells) { r0 = Math.min(r0, r); r1 = Math.max(r1, r); c0 = Math.min(c0, c); c1 = Math.max(c1, c); }
    its.push({ w, el, cells, r0, r1, c0, c1, dr: 0, dc: 0 });
  }
  // перенос: ряд рисунка (пара рядов треугольников) — строка; кнопки строки слева направо, не влезла — на новую строку
  /* v0.455, «кнопки под одной обводкой — не переносятся на другие строки»: кнопки под общей границей (tzcHulls) — один блок, переносится целиком */
  const oAll = {}; its.forEach(it => it.cells.forEach(([r, c]) => { oAll[r + "_" + c] = it.w; }));
  const uOf = tzcUnits(oAll, new Set(its.map(x => x.w)), d.rings), units = {};
  { /* v0.480, «группа не может быть короче, чем самая длинная группа кнопок; тут Своя + 3 цвета — это совмещённая кнопка»: кнопки одного блока-обёртки
       (span внутри группы, как «Своя + 1 0 а») — одна единица переноса */
    const byWrap = new Map();
    its.forEach(it => { const p = it.el.parentElement; if (!p || p === cgb || p.tagName !== "SPAN") return; const r = uOf[it.w] || it.w;
      if (!byWrap.has(p)) { byWrap.set(p, r); return; } const R0 = byWrap.get(p); if (r !== R0) for (const k of Object.keys(uOf)) if (uOf[k] === r) uOf[k] = R0; uOf[it.w] = R0; }); }
  its.forEach(it => { const u = uOf[it.w] || it.w, U = units[u] || (units[u] = { m: [], r0: 1e9, c0: 1e9, c1: -1 }); U.m.push(it); U.r0 = Math.min(U.r0, it.r0); U.c0 = Math.min(U.c0, it.c0); U.c1 = Math.max(U.c1, it.c1); });
  const lines = {}; Object.values(units).forEach(U => { const L = Math.floor(U.r0 / 2); (lines[L] = lines[L] || []).push(U); });
  g._tzMinW = Math.ceil(Math.max(0, ...Object.values(units).map(U => (U.c1 + 2 - U.c0) * t)) + 1);   // v0.480: уже — нельзя
  /* v0.465, по снимку «Гаммы» в две строки при широкой группе — «не даёт в одну строку размер группы»: группа с заданным размером течёт, как текст, в обе
     стороны — строки рисунка идут подряд, следующая подтягивается на эту, если влезает (сдвиг — на чётное число t), не влезает — перенос. Без заданного
     размера — как нарисовано (переноса нет) */
  const ev0 = (c) => c - (((c % 2) + 2) % 2);   // к левому краю — на чётное t
  const Ls = Object.keys(lines).map(Number).sort((a, b) => a - b);
  if (!isFinite(avail)) {   // без заданного размера — как нарисовано
    let out = 0, prev = null;
    for (const L of Ls) { if (prev != null) out += L - prev - 1;
      let dc = 0; if (prev == null && tip) { dc = tip - 1 - Math.min(...lines[L].map(U => U.c0)); if (((dc % 2) + 2) % 2) dc--; }   // v0.494: первая строка — выемкой на остриё заголовка (не сходится по чётности — заходит на него, а не щель)
      lines[L].forEach(U => U.m.forEach(it => { it.dc = dc; it.dr = 2 * (out - L); })); out++; prev = L; }
  } else {   // с заданным размером — поток
    let out = 0, cur = tip ? tip - 1 : 0, first = !tip, afterTitle = !!tip;   // cur — правый край занятого в текущей строке (в t); заголовок — первый в ней
    for (const L of Ls) {
      let dc = 0;
      lines[L].sort((a, b) => a.c0 - b.c0).forEach((U, i) => {
        if (i === 0) {
          let j = cur - U.c0; if (((j % 2) + 2) % 2) j += afterTitle ? -1 : 1; afterTitle = false;
          if (!first && U.c1 + 2 + j <= ac) dc = j;   // строка рисунка подтягивается на текущую
          else { if (!first) out++; dc = -ev0(U.c0); cur = 0; }   // (не влезла за заголовок — строкой ниже)
        } else if (U.c1 + 2 + dc > ac) { out++; dc = -ev0(U.c0); cur = 0; }
        U.m.forEach(it => { it.dc = dc; it.dr = 2 * (out - L); });
        cur = Math.max(cur, U.c1 + 2 + dc); first = false;
      });
    }
  }
  g._tzcSh = {}; its.forEach(it => { g._tzcSh[it.w] = [Number.isFinite(it.dr) ? it.dr : 0, Number.isFinite(it.dc) ? it.dc : 0]; });
  if (Z.triBind === g.dataset.g && !tzcEq(g._tzcSh, tzcViewSh)) setTimeout(() => renderTri(), 0);   // v0.462: перенос лёг иначе (тянут ширину) — сетке новый вид   // v0.461 / v0.462: сдвиги переноса — по ним сетка показывает вид (tzcView) и пишет правки назад (tzcUnview)
  let R = tc ? 2 : 0, N = tc;   // заголовок — в первой строке
  const o2 = {}, live = new Set();
  for (const it of its) {
    const { el, cells } = it, r0 = it.r0 + it.dr, c0 = it.c0 + it.dc, r1 = it.r1 + it.dr, c1 = it.c1 + it.dc;
    live.add(it.w); R = Math.max(R, r1 + 1); N = Math.max(N, c1 + 2);
    for (const [r, c] of cells) o2[(r + it.dr) + "_" + (c + it.dc)] = it.w;
    let p = "";
    /* v0.491, «проверь двойной высоты обводки, чтоб не было нигде»: соседние кнопки сходились краями ровно на границе, и сглаживание оставляло тёмный шов
       рядом с линией стыка — выглядело двойной обводкой. Каждый треугольник чуть больше (на 0,6 px от середины), коробка кнопки — на 1 px шире со всех
       сторон: соседи перекрываются, шов закрыт заливкой, линия стыка (слой .tzco) — одна */
    const EX = 0.6 / (s / Math.sqrt(3)), O = 1, ex = (P) => { const cx = (P[0][0] + P[1][0] + P[2][0]) / 3, cy = (P[0][1] + P[1][1] + P[2][1]) / 3;
      return P.map(([x, y]) => [x + (x - cx) * EX + O, y + (y - cy) * EX + O]); };
    for (const [r, c] of cells) {   // все треугольники — одного обхода, иначе по общим рёбрам виден шов
      const x = (c - it.c0) * t, y0 = (r - it.r0) * hh, y1 = y0 + hh;
      const Q = ex((r + c) % 2 === 0 ? [[x, y1], [x + s, y1], [x + t, y0]] : [[x, y0], [x + t, y1], [x + s, y0]]);
      p += `M${Q[0][0].toFixed(2)} ${Q[0][1].toFixed(2)}L${Q[1][0].toFixed(2)} ${Q[1][1].toFixed(2)}L${Q[2][0].toFixed(2)} ${Q[2][1].toFixed(2)}Z`;
    }
    el.classList.add("tzk", "tz");   // v0.486: и заголовок; v0.503, «поправь все кнопки у звука»: и ползунки, поля, списки — общее оформление (бегунок-стрелка, без рамок браузера)
    el._tzk = "";
    el.style.setProperty("--tzp", `path("${p}")`); el.style.setProperty("--lat", "none");
    { const set = new Set(cells.map(([r, c]) => r + "_" + c)), W0 = (it.c1 + 2 - it.c0) * t, H0 = (it.r1 + 1 - it.r0) * hh; let e = "";   // v0.467: маска толстой обводки нажатой — по границе своих треугольников
      for (const [r, c] of cells) { const x = (c - it.c0) * t, y0 = (r - it.r0) * hh, y1 = y0 + hh, Q = (r + c) % 2 === 0 ? [[x, y1], [x + s, y1], [x + t, y0]] : [[x, y0], [x + s, y0], [x + t, y1]];
        for (const [a, b, n] of triNb(r, c)) if (!set.has(n[0] + "_" + n[1])) e += `M${Q[a][0].toFixed(2)} ${Q[a][1].toFixed(2)}L${Q[b][0].toFixed(2)} ${Q[b][1].toFixed(2)}`; }
      el.style.setProperty("--lato", `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${W0.toFixed(2)}" height="${H0.toFixed(2)}"><path d="${e}" stroke="#000" stroke-width="5" stroke-linecap="round" fill="none"/></svg>`)}")`); }
    el.style.setProperty("left", px(c0 * t - 1), "important"); el.style.setProperty("top", px(r0 * hh - 1), "important");   // v0.491: коробка на 1 px шире со всех сторон
    el.style.setProperty("width", px((c1 + 2 - c0) * t + 2), "important"); el.style.setProperty("height", px((r1 + 1 - r0) * hh + 2), "important");
    el.style.setProperty("margin", "0", "important"); el.style.removeProperty("margin-left");
    const m = tzcMain(cells);   // подпись — посередине самого большого куска (кнопка бывает из нескольких кусков)
    el.style.setProperty("padding-left", px((m.c0 - it.c0) * t + 2), "important"); el.style.setProperty("padding-right", px((it.c1 - m.c1) * t + 2), "important");
  }
  const els = its.map(x => x.el);
  (g._tzcEls || []).forEach(el => { if (!els.includes(el)) tzcClean(el); });
  g._tzcEls = els;
  cgb.style.setProperty("padding-top", px(R * hh), "important"); cgb.style.setProperty("min-width", px(N * t), "important");
  if (isFinite(avail) && N * t > avail + 0.5) g.style.width = (sz.w + Math.ceil(N * t - avail)) + "px";   // v0.455: блок шире группы — группа по нему, а не обрезка
  else if (isFinite(avail)) g.style.width = (sz.w - Math.floor(avail - N * t)) + "px";   // v0.484: и не шире рисунка — пустого места справа нет
  // обводка — одна линия на стык: граница кнопки с другой кнопкой или с пустым местом
  let ov = cgb.querySelector(":scope > .tzco"); if (!ov) { ov = document.createElement("i"); ov.className = "tzco"; cgb.appendChild(ov); }
  const W = Math.max(1, N * t), H = Math.max(1, R * hh);
  ov.style.width = px(W); ov.style.height = px(H);
  const Pg = (r, c) => { const x = c * t, y0 = r * hh, y1 = y0 + hh; return (r + c) % 2 === 0 ? [[x, y1], [x + s, y1], [x + t, y0]] : [[x, y0], [x + s, y0], [x + t, y1]]; };
  const manual = tzcManual(d);   // v0.457 / v0.459: своя обводка (╱ или ⬚) — общая граница сама не рисуется
  let hull = manual ? "" : tzcHulls(o2, live, d.items || [], Pg).map(h => `<path d="${h.d}" stroke="${h.col}" stroke-width="2.5" stroke-linecap="round" fill="none"/>`).join("");
  /* v0.465, «жирная обводка — и перекрывает обводку других кнопок»: обводка ⬚ — только ВНУТРИ своей области (линия двойной толщины, обрезанная по
     области): на соседние кнопки не заходит, видимая толщина — ровно «═» */
  hull += tzcRingPaths(o2, live, (d.rings || []).map((rg, i) => Object.assign({}, rg, { col: tzcGcol(g), w: Z.noLn ? 2 : 1 })), Pg).map((h, i) => `<clipPath id="tzr${i}"><path d="${h.f}"/></clipPath><path d="${h.d}" stroke="${esc(h.col)}" stroke-width="${2 * h.w}" stroke-linecap="round" fill="none" clip-path="url(#tzr${i})"/>`).join("");
  if (d.l && Object.keys(d.l).length) { const sh = {}; its.forEach(it => { sh[it.w] = [it.dr, it.dc]; });
    for (const [key, v] of Object.entries(d.l)) {
      const [k, w] = triVal(v), col = tzcGcol(g); if (!TRI_COL[k] && k < TZC_K0) continue; /* v0.472: обводка — только цветом группы */
      const [A, Bn] = key.split("|").map(q => q.split("_").map(Number)), [dr, dc] = tzcLineShift(A, Bn, d.o || {}, sh);
      hull += `<path d="M${((A[1] + dc) * t).toFixed(2)} ${((A[0] + dr) * hh).toFixed(2)}L${((Bn[1] + dc) * t).toFixed(2)} ${((Bn[0] + dr) * hh).toFixed(2)}" stroke="${col}" stroke-width="${w || Z.triLW || 2}" stroke-linecap="round"/>`;
    } }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W.toFixed(2)}" height="${H}"><path d="${tzcEdges(o2, live, 0, 0)}" stroke="${tzcGcol(g)}" stroke-width="${Z.noLn ? 3 : 1}" stroke-linecap="round" fill="none" transform="translate(0 0.5)"/>${hull}</svg>`;   // v0.491: линия стыка — 1 px по пикселю
  ov.style.backgroundImage = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  if (typeof tzHandle === "function") tzHandle(g);   // v0.484: ромб-ручка — на последней кнопке
}
function tzcMain(cells){   // самый большой связный кусок: { c0, c1, r0, r1 }
  const set = new Set(cells.map(([r, c]) => r + "_" + c)), seen = new Set(); let main = [];
  for (const [r, c] of cells) {
    const k0 = r + "_" + c; if (seen.has(k0)) continue; const part = [], q = [[r, c]]; seen.add(k0);
    while (q.length) { const [a, b] = q.shift(); part.push([a, b]); for (const [, , n] of triNb(a, b)) { const nk = n[0] + "_" + n[1]; if (set.has(nk) && !seen.has(nk)) { seen.add(nk); q.push(n); } } }
    if (part.length > main.length) main = part;
  }
  return { n: main.length, c0: Math.min(...main.map(x => x[1])), c1: Math.max(...main.map(x => x[1])), r0: Math.min(...main.map(x => x[0])), r1: Math.max(...main.map(x => x[0])) };
}
/* v0.454, «каждой кнопке, если между её гранями другие, — дай общую границу цвета»: кнопка из нескольких кусков, между которыми стоят другие
   кнопки (как «Своя» с цветами 1 0 а), обводится общей границей своим цветом (кисти): её треугольники и целиком каждая кнопка, у которой хоть
   один треугольник — в том же ряду между её крайними. P(r, c) — вершины треугольника в нужных координатах */
/* v0.459, «обводка в редакторе кнопок — нужен режим, когда группы кнопок только выбираются, и потом, когда снова нажать кнопку режима, — всё
   объединит одной обводкой, и цвет обводки разный, чтоб задавать»: «⬚ обвести» в строке конструктора — режим выбора: щелчок по кнопке в сетке
   выбирает её (ещё щелчок — снимает), закраска не меняется; «⬚» ещё раз — выбранные кнопки получают одну общую обводку (граница их треугольников
   вместе) цветом из поля рядом. Обводок сколько угодно, у каждой свой цвет (d.rings [{ items, col }]); щелчок по обводке в списке — снять.
   Обведённые вместе кнопки при переносе рядов держатся одним блоком. Есть своя обводка — общая граница (v0.454) сама не рисуется */
let tzcPick = false;
const tzcSel = new Set();
const tzcIsOn = (el) => !!el && (el.classList.contains("on") || !!el.querySelector(":scope > input[type=checkbox]:checked"));   // v0.468: кнопка нажата / галка включена
const tzcManual = (d) => !!((d.l && Object.keys(d.l).length) || (d.rings && d.rings.length));
function tzcRingPaths(o, live, rings, P){   // обводка — граница объединения треугольников её кнопок
  const out = [];
  for (const rg of rings || []) {
    const S = new Set((rg.items || []).filter(w => live.has(w))); if (!S.size) continue;
    const H = new Set(Object.keys(o).filter(k => S.has(o[k]))); let d = "";
    /* v0.460, «обводка как-то криво работает — пусть просто берёт крайние выделенные кнопки и общей обводкой их»: в каждом ряду — всё от первого до
       последнего треугольника выбранных кнопок (просветы и кнопки между ними — внутри), обводка — по внешнему краю этого */
    const rows = {}; for (const k of H) { const [r, c] = k.split("_").map(Number), x = rows[r] || (rows[r] = [c, c]); x[0] = Math.min(x[0], c); x[1] = Math.max(x[1], c); }
    for (const [r, [c0, c1]] of Object.entries(rows)) for (let c = c0; c <= c1; c++) H.add(r + "_" + c);
    let f = "";
    for (const k of H) { const [r, c] = k.split("_").map(Number), Q = P(r, c);
      for (const [a, b, n] of triNb(r, c)) if (!H.has(n[0] + "_" + n[1])) d += `M${Q[a][0].toFixed(2)} ${Q[a][1].toFixed(2)}L${Q[b][0].toFixed(2)} ${Q[b][1].toFixed(2)}`;
      const up = (r + c) % 2 === 0, V = up ? [Q[0], Q[1], Q[2]] : [Q[0], Q[2], Q[1]];   // одного обхода — для обрезки
      f += `M${V[0][0].toFixed(2)} ${V[0][1].toFixed(2)}L${V[1][0].toFixed(2)} ${V[1][1].toFixed(2)}L${V[2][0].toFixed(2)} ${V[2][1].toFixed(2)}Z`; }
    out.push({ d, f, col: rg.col || "#ffd166", w: rg.w > 0 ? rg.w : 1.5 });   // v0.464: толщина — своя у обводки (═ при создании), прежние — 1,5
  }
  return out;
}
function tzcRingsUi(){
  const b = $("bTriRing"), box = $("triRings"), d = Z.cgrpTri && Z.cgrpTri[Z.triBind]; if (!b || !box) return;
  b.classList.toggle("on", tzcPick); b.textContent = tzcPick ? `⬚ обвести · ${tzcSel.size}` : "⬚ обвести";
  const lab = (w) => { const i = d && (d.items || []).indexOf(w), c = i >= 0 && TRI_COL[TZC_K0 + i]; return c ? c[1] : w; };
  box.innerHTML = (d && d.rings || []).map((rg, i) => `<button data-ri="${i}" style="border-color:${esc(tzcGcol(tzcGroup(Z.triBind)))};color:${esc(tzcGcol(tzcGroup(Z.triBind)))}" title="Обводка: ${esc(rg.items.map(lab).join(", "))} — щелчок: снять">⬚ ${rg.items.length}</button>`).join("");
}
function tzcUnits(o, live, rings){   // v0.455: кнопки под общей границей — один блок: кнопка → корень блока
  const by = {}, par = {}, f = (x) => (par[x] && par[x] !== x ? (par[x] = f(par[x])) : x);
  for (const [k, w] of Object.entries(o)) if (live.has(w)) (by[w] = by[w] || []).push(k.split("_").map(Number));
  for (const [w, cells] of Object.entries(by)) {
    if (tzcMain(cells).n === cells.length) continue;
    const rows = {}; for (const [r, c] of cells) { const x = rows[r] || (rows[r] = [c, c]); x[0] = Math.min(x[0], c); x[1] = Math.max(x[1], c); }
    for (const [r, [a, b]] of Object.entries(rows)) for (let c = a; c <= b; c++) { const v = o[r + "_" + c]; if (v && v !== w && live.has(v)) { const A = f(v), B = f(w); if (A !== B) par[A] = B; } }
  }
  for (const rg of rings || []) { const ws = (rg.items || []).filter(w => by[w]); for (let i = 1; i < ws.length; i++) { const A = f(ws[i]), B = f(ws[0]); if (A !== B) par[A] = B; } }   // v0.459: обведённые вместе — один блок
  const out = {}; for (const w of Object.keys(by)) out[w] = f(w); return out;
}
/* v0.457, по снимку «Своя 1 0 а» — «обводку не могу нормально положить для третьей кнопки, похоже, обводку надо отдельно рисовать»: в конструкторе
   инструмент «╱ линия по ребру» рисует обводку ГРУППЫ (d.l — у каждой группы своя; своё в сетке откладывается вместе с закраской). Цвет — любой
   из палитры или кисть кнопки (щелчок по кисти, пока горит ╱), толщина — «═». Линии сразу и на странице; при переносе рядов линия едет с кнопкой,
   к которой прилегает. Как только в группе есть своя обводка, общая граница (v0.454) сама не рисуется — решаешь ты */
const tzcCol = (k) => k >= TZC_K0 ? tzcHue(k - TZC_K0) : (TRI_COL[k] ? TRI_COL[k][0] : null);
function tzcLineShift(A, B, o, sh){   // сдвиг переноса для ребра A–B (узлы [j, i]) — по кнопке с одной из его сторон
  const hh = TZC_H / 2, t = TZC_H / (2 * Math.sqrt(3)), s = 2 * t;
  const mx = (A[1] + B[1]) / 2 * t, my = (A[0] + B[0]) / 2 * hh, dx = (B[1] - A[1]) * t, dy = (B[0] - A[0]) * hh, L = Math.hypot(dx, dy) || 1;
  const at = (x, y) => { const r = Math.floor(y / hh), c0 = Math.floor(x / t);
    for (const c of [c0, c0 - 1]) { const y0 = r * hh, y1 = y0 + hh, X = c * t, P = (r + c) % 2 === 0 ? [[X, y1], [X + s, y1], [X + t, y0]] : [[X, y0], [X + s, y0], [X + t, y1]];
      const sg = (p, q, w) => (p[0] - w[0]) * (q[1] - w[1]) - (q[0] - w[0]) * (p[1] - w[1]), Q = [x, y], d1 = sg(Q, P[0], P[1]), d2 = sg(Q, P[1], P[2]), d3 = sg(Q, P[2], P[0]);
      if (!((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))) return r + "_" + c; }
    return null; };
  for (const sgn of [1, -1]) { const k = at(mx - sgn * dy / L * 2, my + sgn * dx / L * 2), w = k && o[k]; if (w && sh[w]) return sh[w]; }
  return [0, 0];
}
function tzcHulls(o, live, items, P){
  const out = [], by = {};
  for (const [k, w] of Object.entries(o)) if (live.has(w)) (by[w] = by[w] || []).push(k.split("_").map(Number));
  for (const [w, cells] of Object.entries(by)) {
    if (tzcMain(cells).n === cells.length) continue;   // один кусок — обычная обводка
    const rows = {}; for (const [r, c] of cells) { const x = rows[r] || (rows[r] = [c, c]); x[0] = Math.min(x[0], c); x[1] = Math.max(x[1], c); }
    const H = new Set(cells.map(([r, c]) => r + "_" + c)), inner = new Set();
    for (const [r, [a, b]] of Object.entries(rows)) for (let c = a; c <= b; c++) { const v = o[r + "_" + c]; if (v && v !== w && live.has(v)) inner.add(v); }
    for (const v of inner) for (const [r, c] of by[v] || []) H.add(r + "_" + c);
    let d = "";
    for (const k of H) { const [r, c] = k.split("_").map(Number), Q = P(r, c);
      for (const [a, b, n] of triNb(r, c)) if (!H.has(n[0] + "_" + n[1])) d += `M${Q[a][0].toFixed(2)} ${Q[a][1].toFixed(2)}L${Q[b][0].toFixed(2)} ${Q[b][1].toFixed(2)}`; }
    const i = items.indexOf(w); out.push({ d, col: tzcHue(i < 0 ? 0 : i) });
  }
  return out;
}
function tzcEdges(o, live, ox, oy){   // путь SVG: рёбра на границе кнопки (с другой кнопкой — один раз)
  const hh = TZC_H / 2, t = TZC_H / (2 * Math.sqrt(3)), s = 2 * t;
  const P = (r, c) => { const x = ox + c * t, y0 = oy + r * hh, y1 = y0 + hh; return (r + c) % 2 === 0 ? [[x, y1], [x + s, y1], [x + t, y0]] : [[x, y0], [x + s, y0], [x + t, y1]]; };
  let ln = "";
  for (const [k, w] of Object.entries(o)) {
    if (!live.has(w)) continue;
    const [r, c] = k.split("_").map(Number), Q = P(r, c);
    for (const [a, b, n] of triNb(r, c)) {
      const nk = n[0] + "_" + n[1], v = o[nk]; if (v === w) continue; if (v && live.has(v) && nk < k) continue;
      ln += `M${Q[a][0].toFixed(2)} ${Q[a][1]}L${Q[b][0].toFixed(2)} ${Q[b][1]}`;
    }
  }
  return ln;
}
/* v0.453, «при редактировании покажи кнопки с надписями онлайн — как будет выглядеть»: под строкой конструктора в «△ Сетке» — живой вид
   группы в настоящую величину, ровно по рисунку (без переноса): каждый треугольник — цветом своей кнопки (фон кнопки, у цветов гаммы — сам
   цвет), подписи — шрифтом и цветом кнопки, на самом большом её куске; обводка — как на странице. Треугольники без кнопки — бледно цветом
   кисти. Перерисовывается с каждой правкой */
function tzcPreview(){
  const box = $("triBtnLive"), cv = $("triBtnCv"); if (!box || !cv) return;
  box.hidden = !Z.triBind; if (!Z.triBind) return;
  const d = Z.cgrpTri && Z.cgrpTri[Z.triBind], g = tzcGroup(Z.triBind), cgb = g && g.querySelector(".cgb"); if (!d || !cgb) return;
  const hh = TZC_H / 2, t = TZC_H / (2 * Math.sqrt(3)), s = 2 * t, pad = 6, o = tzcVO(d);
  let R = 0, N = 0; for (const k of Object.keys(Z.triCells || {})) { const [r, c] = k.split("_").map(Number); R = Math.max(R, r + 1); N = Math.max(N, c + 2); }
  const W = Math.max(40, N * t + 2 * pad), H = Math.max(TZC_H, R * hh) + 2 * pad, dpr = window.devicePixelRatio || 1;
  cv.style.width = W + "px"; cv.style.height = H + "px";
  if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  const x = cv.getContext("2d"); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, W, H);
  const P = (r, c) => { const X = pad + c * t, y0 = pad + r * hh, y1 = y0 + hh; return (r + c) % 2 === 0 ? [[X, y1], [X + s, y1], [X + t, y0]] : [[X, y0], [X + s, y0], [X + t, y1]]; };
  const tri = (Q) => { x.moveTo(Q[0][0], Q[0][1]); x.lineTo(Q[1][0], Q[1][1]); x.lineTo(Q[2][0], Q[2][1]); x.closePath(); };
  const els = {}, live = new Set();
  for (const w of new Set(Object.values(o))) { const el = tzcFind(w, cgb); if (el && (cgb.contains(el) || el.parentElement === g)) { els[w] = el; live.add(w); } }
  const fill = (el) => {
    if (el.classList.contains("pcol")) { const i = el.querySelector("input[type=color]"); if (i) return i.value; }
    const b = getComputedStyle(el).backgroundColor; return !b || b === "transparent" || /rgba\(.*,\s*0\)$/.test(b) ? getComputedStyle(document.documentElement).getPropertyValue("--panel2").trim() || "#1c2230" : b;
  };
  for (const [k, kc] of Object.entries(Z.triCells || {})) {
    const [r, c] = k.split("_").map(Number), w = o[k], el = w && els[w];
    x.beginPath(); tri(P(r, c));
    if (el) { x.fillStyle = fill(el); x.globalAlpha = 1; } else { x.fillStyle = (TRI_COL[kc | 0] || TRI_COL[1])[0]; x.globalAlpha = 0.25; }
    x.fill(); x.strokeStyle = x.fillStyle; x.lineWidth = 0.6; x.stroke(); x.globalAlpha = 1;
  }
  x.strokeStyle = tzcGcol(g); x.lineWidth = 1.5; x.lineCap = "round"; x.stroke(new Path2D(tzcEdges(o, live, pad, pad)));
  if (tzcManual(d)) {   // v0.457 / v0.459: своя обводка
    for (const h of tzcRingPaths(o, live, (d.rings || []).map(rg => Object.assign({}, rg, { col: tzcGcol(g) })), P)) { x.save(); x.clip(new Path2D(h.f)); x.strokeStyle = h.col; x.lineWidth = 2 * h.w; x.stroke(new Path2D(h.d)); x.restore(); }   // v0.465: внутрь
    for (const [key, v] of Object.entries(Z.triLines || {})) { const [k, w] = triVal(v), col = tzcGcol(g); if (!TRI_COL[k] && k < TZC_K0) continue; /* v0.472: обводка — только цветом группы */ const [A, Bn] = key.split("|").map(q => q.split("_").map(Number));
      x.strokeStyle = col; x.lineWidth = w || Z.triLW || 2; x.beginPath(); x.moveTo(pad + A[1] * t, pad + A[0] * hh); x.lineTo(pad + Bn[1] * t, pad + Bn[0] * hh); x.stroke(); }
  } else for (const h of tzcHulls(o, live, d.items || [], P)) { x.strokeStyle = h.col; x.lineWidth = 2.5; x.stroke(new Path2D(h.d)); }   // v0.454: общая граница
  for (const [w, el] of Object.entries(els)) {   // подписи
    const cells = Object.keys(o).filter(k => o[k] === w).map(k => k.split("_").map(Number)), m = tzcMain(cells), cs = getComputedStyle(el);
    let txt = el.classList.contains("pcol") ? ((el.querySelector("span") || {}).textContent || "") : el.tagName === "SELECT" ? ((el.options[el.selectedIndex] || {}).text || "") : (el.dataset.lab || el.textContent || "");
    txt = txt.replace(/\s+/g, " ").trim(); if (!txt || /transparent|rgba\(.*,\s*0\)$/.test(cs.color)) continue;
    const cx = pad + (m.c0 + m.c1 + 2) / 2 * t, cy = pad + (m.r0 + m.r1 + 1) / 2 * hh;
    x.save(); x.beginPath(); for (const [r, c] of cells) tri(P(r, c)); x.clip();
    x.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`; x.fillStyle = el.classList.contains("pcol") ? "#fff" : cs.color; x.textAlign = "center"; x.textBaseline = "middle";
    if (el.classList.contains("pcol")) { x.shadowColor = "#000"; x.shadowBlur = 2; }
    x.fillText(txt, cx, cy + 0.5); x.restore();
  }
}
/* v0.463, «и края самих полей групп теми же ромбами надо»: группа (окно конуса и левая панель) — с зубчатыми боками из тех же треугольников:
   на каждые 24 px высоты (ряд кнопок) — остриё наружу, как у кнопки; верх и низ ровные. Форма — clip-path (--gclip), рамка — слой ::before цветом
   заголовка группы (--gfc; с v0.464 — цвет её надписи, прежде — её рамки), обрезанный маской по контуру (--gmask). Пересчёт — при каждом изменении размера группы */
/* v0.466, по снимку двух ползунков — «значок прямо в ромбе ползунка, а числа бегают с ним справа или слева»: у ползунка в группе значок (.sli) стоит
   в ромбе-бегунке, число (.rv) — рядом с бегунком: справа, а если справа места нет — слева (.rvl). Место бегунка — --thx у метки (центр ромба, px);
   пересчёт — на движение ползунка, раз в 300 мс (значение меняет и код) и после раскладки групп */
function tzSliders(){
  document.querySelectorAll("#w-cone .tools .cgb label.tz, #paneGrp .cgb label.tz").forEach(L => {
    const r = L.querySelector(":scope > .zerk-range-wrap > input[type=range]"); if (!r || !r.getClientRects().length) return;
    const lr = L.getBoundingClientRect(), ir = r.getBoundingClientRect(), t = TZC_H / (2 * Math.sqrt(3)), tw = 5 * t;   // v0.473: бегунок — шестигранник 4t; v0.489 — «стрелка вправо» 5t
    const mn = +r.min || 0, mx = r.max === "" ? 100 : +r.max, v = +r.value, f = mx > mn ? Math.max(0, Math.min(1, (v - mn) / (mx - mn))) : 0;
    const x = ir.left - lr.left + tw / 2 + f * (ir.width - tw), rv = L.querySelector(".rv");
    const k = x.toFixed(1) + (rv ? "|" + rv.textContent : "");
    if (L._thk === k) return; L._thk = k;
    L.style.setProperty("--thx", x.toFixed(2) + "px");
    L.style.setProperty("--thp", Math.round(82 + 18 * f) + "%");   // v0.501: насыщенность бегунка — по значению (слева тусклее, справа — цвет группы); v0.504 — не темнее 82 %: тёмный значок в нём пропадал
    if (rv) { const w = rv.scrollWidth, right = ir.right - lr.left - (x + 2.5 * t) - 3; L.classList.toggle("rvl", w > right); }
  });
}
document.addEventListener("input", (e) => { if (e.target && e.target.type === "range") tzSliders(); }, true);
setInterval(() => { if (!document.hidden) tzcAll(); }, 300);   // и ползунки, и обводки «нажата» (v0.468) — кнопки загораются и гаснут сами
function tzgFrame(g){
  if (!g.closest("#w-cone .tools, #paneGrp")) { if (g.classList.contains("tzg")) { g.classList.remove("tzg"); for (const k of ["--gclip", "--gmask", "--gfc"]) g.style.removeProperty(k); g._tzgk = ""; } return; }
  if (!g._tzgRO && window.ResizeObserver) { g._tzgRO = new ResizeObserver(() => tzgFrame(g)); g._tzgRO.observe(g); }
  const W = g.offsetWidth, H = g.offsetHeight; if (!W || !H) return;
  const lab = g.querySelector(":scope > .glab"), fc = lab ? getComputedStyle(lab).color : getComputedStyle(g).borderTopColor, key = W + "x" + H + "|" + fc;   // v0.464, «пусть группа — обводка цвет, как у её текста»: рамка — цветом заголовка группы
  if (g._tzgk === key && g.classList.contains("tzg")) return;
  g._tzgk = key;
  const t = TZC_H / (2 * Math.sqrt(3)), P = TZC_H, zig = (y) => t * Math.abs(((y % P) + P) % P - P / 2) / (P / 2);
  const ys = []; for (let y = 0; y < H; y += P / 2) ys.push(y); ys.push(H);
  /* v0.479, «левая граница у групп пусть будет стрелкой вправо всегда»: левый край — выемкой (в середине ряда внутрь на t), правый — остриём, как был:
     вся группа — «стрелка вправо»; первая кнопка ряда — с выемкой слева, ложится в край вплотную (triTag) */
  const pts = [...ys.map(y => [t - zig(y), y]), ...ys.slice().reverse().map(y => [W - zig(y), y])];
  g.classList.add("tzg");
  g.style.setProperty("--gclip", `polygon(${pts.map(([x, y]) => x.toFixed(2) + "px " + y.toFixed(2) + "px").join(",")})`);
  /* v0.495, «нет верхней обводки»: верх и низ рамки — на полпикселя внутрь (линия по самому краю — видна лишь её половина, 1 px, и при дробной
     координате группы верх сглаживался до невидимого) */
  const yIn = (y) => Math.min(Math.max(y, 0.5), H - 0.5);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><polygon points="${pts.map(([x, y]) => x.toFixed(2) + "," + yIn(y).toFixed(2)).join(" ")}" fill="none" stroke="#000" stroke-width="2"/></svg>`;   // v0.464: рамка группы тоньше — видна половина, 1 px
  g.style.setProperty("--gmask", `url("data:image/svg+xml,${encodeURIComponent(svg)}")`);
  g.style.setProperty("--gfc", fc);
  clearTimeout(tzgFrame._t); tzgFrame._t = setTimeout(() => { if (typeof triTag === "function") triTag(); }, 0);   // v0.479: ряды могли перестроиться — первые кнопки рядов заново
}
/* v0.480: самая широкая неразрывная часть группы (px) — уже её группу не сделать: у конструктора — блок переноса (tzcApply), у обычной — кнопка или
   блок-обёртка (заголовок тоже) */
function tzMinW(g){
  const cgb = g.querySelector(":scope > .cgb"); if (!cgb) return 0;
  if (cgb.classList.contains("tzc")) return g._tzMinW || 0;
  let m = 0; for (const el of [...g.children, ...cgb.children]) { if (el === cgb || el.classList.contains("cgsz") || !el.getClientRects().length || getComputedStyle(el).position === "absolute") continue; m = Math.max(m, el.getBoundingClientRect().width - (el._tzx || 0) * TZC_H / Math.sqrt(3)); }   // v0.484: без растяжки до края (иначе минимум рос бы за ней)
  return Math.ceil(m) + 1;
}
function tzcIcons(){
  document.querySelectorAll(".cgrp .gtri").forEach(x => { const k = x.closest(".cgrp").dataset.g, d = Z.cgrpTri && Z.cgrpTri[k]; x.classList.toggle("on", Z.triBind === k || !!(d && d.on)); });
}
function tzcAll(){ document.querySelectorAll(".cgrp").forEach(g => { if (g.dataset.g) tzcApply(g); tzgFrame(g); }); tzcIcons(); tzSliders(); }
function tzcMine(){   // вернуть в сетку своё, отложенное на время конструктора
  const m = Z.triMine || {};
  Z.triCells = m.c || {}; Z.triGLn = m.gl || {}; Z.triGIn = m.gi || {}; Z.triGTx = m.gt || {}; Z.triCur = m.cur != null ? m.cur : -1; Z.triSel = m.sel || null;
  if ("l" in m) Z.triLines = m.l || {};   // v0.457
  tzcPick = false; tzcSel.clear(); tzcViewSh = {};   // v0.459
  Z.triBind = null; delete Z.triMine;
  TRI_COL.length = 9; if (Z.triCol >= 9) Z.triCol = 2;   // v0.454: кисти кнопок — только в конструкторе
}
function tzcOpen(g){
  if (!g.closest("#w-cone")) { say("△ Конструктор — пока для групп в окне конуса."); return; }
  const key = g.dataset.g; if (!Z.cgrpTri || typeof Z.cgrpTri !== "object") Z.cgrpTri = {};
  triState();
  if (Z.triBind && Z.triBind !== key) tzcClose(true);
  if (Z.triBind !== key) {
    Z.triMine = { c: Z.triCells, gl: Z.triGLn, gi: Z.triGIn, gt: Z.triGTx, l: Z.triLines, cur: Z.triCur, sel: Z.triSel };
    let d = Z.cgrpTri[key];
    if (!d || !d.c || !Object.keys(d.c).length) {   // v0.465: снимок — только с видимой группы (опрос точками экрана), иначе рисунок выйдет пустым
      g.scrollIntoView({ block: "nearest", inline: "nearest" });
      /* v0.486: снимок — точками экрана: если группу закрывает другое окно, закрытые кнопки молча выпадали. На миг снимка — окно конуса и группа поверх всего */
      const wc = $("w-cone"), z0 = wc ? wc.style.zIndex : "", gz0 = g.style.zIndex;
      if (wc) wc.style.zIndex = 2147483646; g.style.zIndex = 2147483646;
      const nd = tzcGrab(g);
      if (wc) wc.style.zIndex = z0; g.style.zIndex = gz0;
      { const miss = [g.querySelector(":scope > .glab"), ...g.querySelectorAll(".cgb button, .cgb select, .cgb label, .cgb .glab2")]
          .filter(el => el && el.getClientRects().length && tzcItem(el, g.querySelector(".cgb")) === el && !Object.values(nd.o).includes(tzcKey(el, g.querySelector(".cgb")))).length;
        if (miss) setTimeout(() => say(`△ ${miss} кноп. группы не попали в рисунок (были закрыты или за краем экрана) — их кисти есть, дорисуй в «Сетке» или «↺ как было» и △ ещё раз.`), 50); }
      if (!Object.keys(nd.c).length) { delete Z.triMine; say("△ Группу не видно на экране — прокрути к ней (или вытащи из-под окон) и нажми △ ещё раз."); return; }
      d = Z.cgrpTri[key] = nd;
    }
    d.on = true; tzcItems(g, d);
    const cp = (x) => Object.assign({}, x || {});
    g._tzcv = null; tzcApply(g);   // v0.462: перенос — по этому рисунку, а не по прежнему
    const V = tzcView(g, d); tzcViewSh = Object.assign({}, g._tzcSh || {});   // v0.461 / v0.462: в сетку — как стоит на экране (вид), рисунок остаётся исходным
    Z.triCells = V.c; Z.triGTx = {}; Z.triGLn = V.gl; Z.triGIn = V.gi; Z.triLines = cp(V.l); Z.triCur = -1; Z.triSel = null; Z.triBind = key;
    let N = 0, R = 0; for (const k of Object.keys(V.c)) { const [r, c] = k.split("_").map(Number); R = Math.max(R, r + 1); N = Math.max(N, c + 1); }
    if (typeof window.zzWinShow === "function") window.zzWinShow("w-tri");
    const cv = $("triCv"), W = (cv && cv.clientWidth) || 600, H = (cv && cv.clientHeight) || 300;
    Z.triS = Math.max(TRI_S1, Math.min(60, (W - 20) * 2 / (N + 2), (H - 20) / (R + 1) / (Math.sqrt(3) / 2)));   // вся группа — в окне
  }
  save(); renderTri(); tzcAll();
  say(`△ «${key}» — в конструкторе: у каждой кнопки своя кисть (строка конструктора в «Сетке»): закрашенное ею — её, где бы ни стояло. Обводка — «⬚ обвести» (выбрать кнопки, ⬚ ещё раз) или ╱ по рёбрам. Выход — ✓ готово.`);
}
function tzcClose(quiet){
  if (!Z.triBind) return;
  tzcSync(); tzcMine();
  save(); renderTri(); tzcAll();
  if (!quiet) say("△ Конструктор закрыт — раскладка группы осталась; вернуть обычный ряд — △ и «↺ как было».");
}
function tzcReset(){
  const key = Z.triBind; if (!key) return;
  delete Z.cgrpTri[key]; const g = tzcGroup(key);
  tzcMine(); if (g) tzcOff(g);
  save(); renderTri(); if (typeof rhombTag === "function") rhombTag(); tzcIcons();
  say(`△ «${key}» — снова обычным рядом.`);
}
{ const r0 = renderTri; renderTri = function(){
    if (Z.triBind && TRI_COL.length <= TZC_K0) { const g = tzcGroup(Z.triBind), d = Z.cgrpTri && Z.cgrpTri[Z.triBind]; if (g && d) tzcItems(g, d); }   // кисти — до triState
    if (Z.triBind && Z.triMine && !("l" in Z.triMine)) {   // v0.457: конструктор открыт до линий-обводки — нынешние линии остаются и в сетке, и в своём
      const d = Z.cgrpTri && Z.cgrpTri[Z.triBind]; Z.triMine.l = Object.assign({}, Z.triLines || {}); if (d) d.l = Object.assign({}, Z.triLines || {}); }
    r0();
    const pal = $("triPal"); if (pal) [...pal.children].forEach(b => { if (+b.dataset.c >= TZC_K0) b.remove(); });   // кисти — не в общей палитре
    const b = $("triBind"); if (b) { b.hidden = !Z.triBind; if (Z.triBind) $("triBindLab").textContent = `△ конструктор: ${Z.triBind}`; }
    if (Z.triBind) { if (tzcSync()) r0(); tzcBrushes(); tzcRingsUi(); tzcLabels(); }
    tzcPreview(); tzcIcons(); }; }
if ($("triBindPal")) $("triBindPal").onclick = (e) => { const b = e.target.closest("button[data-c]"); if (!b) return;
  if (Z.triCol < -1) Z.triTCol = +b.dataset.c; else Z.triCol = +b.dataset.c;   // v0.457: пока горит ╱ (или ✦) — кисть даёт им цвет
  save(); renderTri(); };
if ($("bTriBindOk")) $("bTriBindOk").onclick = () => tzcClose();
if ($("bTriBindReset")) $("bTriBindReset").onclick = () => tzcReset();
if ($("bTriRing")) $("bTriRing").onclick = () => {   // v0.459: режим выбора — и обвести выбранные
  const d = Z.cgrpTri && Z.cgrpTri[Z.triBind]; if (!d) return;
  if (!tzcPick) { tzcPick = true; tzcSel.clear(); say("⬚ Щёлкай кнопки в сетке — выбрать (ещё щелчок — снять). Нажми «⬚» ещё раз — выбранные получат одну обводку цветом из поля рядом."); }
  else {
    tzcPick = false;
    if (tzcSel.size) { (d.rings = d.rings || []).push({ items: [...tzcSel], w: Z.triLW > 0 ? Z.triLW : 1.5 }); /* v0.472: цвет — всегда цвет группы */ say(`⬚ Обведено кнопок: ${tzcSel.size}.`); }
    tzcSel.clear();
  }
  save(); renderTri();
};
if ($("triRings")) $("triRings").onclick = (e) => {
  const b = e.target.closest("button[data-ri]"), d = Z.cgrpTri && Z.cgrpTri[Z.triBind]; if (!b || !d || !d.rings) return;
  d.rings.splice(+b.dataset.ri, 1); save(); renderTri(); say("⬚ Обводка снята.");
};
if ($("triCv")) $("triCv").addEventListener("pointerdown", (e) => {   // в режиме выбора щелчок не красит, а выбирает кнопку
  if (!tzcPick || !Z.triBind) return;
  e.stopImmediatePropagation(); e.preventDefault();
  const r = $("triCv").getBoundingClientRect(), h = triHit(e.clientX - r.left, e.clientY - r.top), d = Z.cgrpTri && Z.cgrpTri[Z.triBind], w = h && d && tzcVO(d)[h[0] + "_" + h[1]];
  if (!w) return;
  if (tzcSel.has(w)) tzcSel.delete(w); else tzcSel.add(w);
  renderTri();
}, true);
{ const rt2 = rhombTag; rhombTag = function(){ rt2(); tzcAll(); }; }
window.addEventListener("load", () => setTimeout(() => { triState(); if (Z.triBind && !tzcGroup(Z.triBind)) tzcMine(); tzcAll(); tzcPreview(); }, 0));

function soloApply(){
  const el = $(ZZ_SOLO); if (!el) return;
  document.body.classList.add("solo");
  document.documentElement.classList.add("solo");   // v0.143: своя, посветлее, тёмная палитра — её читает и холст конуса
  el.classList.add("solo-win");
  document.querySelectorAll(".win").forEach(o => { if (o !== el) o.style.display = "none"; });
  if (el.classList.contains("docked")) undockWin(el);
  el.classList.remove("collapsed", "maxed");
  const w = Z.win[ZZ_SOLO]; if (w) { w.collapsed = false; w.dock = false; delete w.max0; }
  /* v0.142, по снимку текста конуса справа («Наведи на кольцо…», «Кольцо 4 заперто…») — «это всё вообще под строки»:
     на странице конуса текст и лог лазера — в поле строк, под строками; конусу — весь стол. */
  // v0.158: текст и лог — больше не под строками, а в своём плавающем окне (ctwInit)
  const t = el.dataset.title || ZZ_SOLO, h = document.querySelector("#top h1");
  if (h) h.textContent = "Zazerkalius " + t;   // v0.226, «тут название — после Zazerkalius, а не вместо»: «Zazerkalius ◯ Конус»
  document.title = "Zazerkalius " + t + " — " + ((document.title.match(/v[\d.]+/) || [""])[0]);
  $("desk").scrollTop = 0;
}
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
    '<button class="bm" title="⛶ На всю правую половину: окно встаёт наверх во всю ширину и высоту места справа от поля строк, остальные — под ним. Ещё раз — вернуть, как было">⛶</button>' +   // v0.060
    (el.id === "w-cone" && !ZZ_SOLO ? '<button class="bsolo" title="↗ Конус отдельно — в новой вкладке (эта же страница с ?solo=cone: одно окно конуса и поле строк, своя память)">↗</button>' : "") +   // v0.303
    '<button class="bp" title="В отдельное окно браузера — например, на второй монитор. Ещё раз ⧉ или закрыть то окно — вернуть">⧉</button>' +
    '<button class="bc" title="Свернуть / развернуть">–</button>';
  el.insertBefore(head, el.firstChild);
  /* v0.439, по снимку полосы «⇄ строки → грани | ↗» над Гранидусом — «и это тоже ненужная полоса»: обе кнопки — в шапку окна, перед ⛶,
     полосы нет, место — Гранидусу */
  if (el.id === "w-okt") { const tl = el.querySelector(".wbody > .tools"); if (tl) { const bm = head.querySelector(".bm"); [...tl.children].forEach(b => head.insertBefore(b, bm)); tl.remove(); } }
  // v0.043: полоса вдоль всего нижнего края — тянешь, меняется высота (угол справа внизу остаётся — ширина и высота)
  const grip = document.createElement("div");
  grip.className = "wgrip"; grip.title = "Тяни — высота окна";
  el.appendChild(grip);
  grip.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    Z.z++; el.style.zIndex = Z.z;
    const y0 = e.clientY, h0 = el.offsetHeight;
    grip.setPointerCapture(e.pointerId); grip.classList.add("on");
    el._userResize = true;
    const move = (ev) => { el.style.height = Math.max(60, Math.round(h0 + ev.clientY - y0)) + "px"; };
    const up = () => {
      grip.removeEventListener("pointermove", move); grip.removeEventListener("pointerup", up); grip.removeEventListener("pointercancel", up);
      grip.classList.remove("on");
      const w = st(); w.h = el.offsetHeight;
      setTimeout(() => { el._userResize = false; }, 350);
      packWins(); save();
    };
    grip.addEventListener("pointermove", move); grip.addEventListener("pointerup", up); grip.addEventListener("pointercancel", up);
  });
  head.querySelector(".bp").onclick = () => { if (popups.has(el.id)) popIn(el.id); else popOut(el); };   // v0.030
  /* v0.303, по снимку шапки «◯ Конус» — «сюда кнопку для открытия в …/Zerkalius-zazerkalius.html?solo=cone»: ↗ открывает эту же страницу
     с ?solo=cone в новой вкладке — адрес от нынешнего, так что и на localhost, и на сайте. */
  const bSolo = head.querySelector(".bsolo");
  if (bSolo) bSolo.onclick = () => { window.open(location.pathname + "?solo=cone", "_blank"); };
  /* v0.060, «сюда кнопку — на всю оставшуюся половину окна после поля строк, а все остальные под ним»: ⛶ ставит окно
     на верх стола во всю его ширину и видимую высоту, прежнее место запоминается (w.max0); остальные сдвигаются ниже —
     при «⤒ К верху» их укладывает packWins, без него — сдвигаются на высоту окна. Ещё раз ⛶ — место назад. */
  head.querySelector(".bm").onclick = () => {
    if (popups.has(el.id)) return;
    if (el.classList.contains("docked")) undockWin(el);
    const w = st(), g = 12, desk = $("desk");
    // v0.068: окно «развёрнуто», но узкое (так выходило до v0.068) — ⛶ не возвращает, а разворачивает как надо
    const full = el.offsetWidth >= desk.clientWidth - 3 * g - 4;
    if (w.max0 && full) {
      Object.assign(w, w.max0); delete w.max0;
      el.classList.remove("maxed");
      applyWin(el); packWins(); save(); return;
    }
    if (!w.max0) w.max0 = { x: w.x, y: w.y, w: w.w, h: w.h, pw: w.pw, px: w.px, collapsed: !!w.collapsed };
    /* v0.095, «нет — не занимает по высоте и ширине»: окно встаёт вплотную — от левого и верхнего края стола во всю ширину и
       видимую высоту (прежде с отступами 12 px, а раскладка ещё сдвигала его на 12 px вниз). */
    const W = Math.max(320, desk.clientWidth), H = Math.max(200, desk.clientHeight);
    if (w.collapsed) { w.collapsed = false; el.classList.remove("collapsed"); }
    /* v0.068, «эта кнопка — на всю ширину, оставшуюся после поля строк, а все остальные вверх или вниз» (снимок: ⛶ горит,
       а «◯ Конус» узкий). Раньше соседи уезжали вниз только без «⤒ К верху»; с ним раскладка сперва ужимала окно по
       соседям справа (fitWins) и потом, видя окно узким, оставляла соседей рядом. Теперь соседи ВСЕГДА сначала уходят ниже
       окна, и только потом раскладка — окно на всю ширину, остальные под ним. */
    document.querySelectorAll(".win").forEach(o => { const ow = Z.win[o.id]; if (o !== el && ow && !o.classList.contains("docked") && !o.classList.contains("popped")) { ow.y = Math.max(ow.y, 0) + H + 2 * g; o.style.top = ow.y + "px"; } });
    Object.assign(w, { x: 0, y: 0, w: W, h: H, pw: W, px: 0 });
    el.classList.add("maxed");
    applyWin(el); el.style.height = H + "px";
    Z.z++; el.style.zIndex = Z.z;
    packWins(); packWins(); save(); renderAll();   // второй проход: соседи уже ниже — ширина окна не ужата
    desk.scrollTop = 0;
  };
  if (Z.win[el.id] && Z.win[el.id].max0) el.classList.add("maxed");
  const st = () => (Z.win[el.id] = Z.win[el.id] || { x: 20, y: 20, w: 320, h: 240 });
  const bh = head.querySelector(".bh");
  if (bh) bh.onclick = () => { const w = st(); w.hint = !w.hint; el.classList.toggle("hint", w.hint); bh.classList.toggle("on", w.hint); save(); };
  if (bh && Z.win[el.id] && Z.win[el.id].hint) bh.classList.add("on");
  head.querySelector(".bc").onclick = () => {
    const w = st(); w.collapsed = !w.collapsed;
    el.classList.toggle("collapsed", w.collapsed);
    if (!w.collapsed) el.style.height = w.h + "px";
    parkSync();   // v0.094: при «поле справа» свёрнутое уходит в левую панель
    packWins();   // v0.015: свернул — нижние поднимаются
    if (!w.collapsed && el.id === "w-view") renderView();   // v0.039: свёрнутый «Вид» не рисуется — развернул, рисуем сразу
    if (!w.collapsed && el.id === "w-lin") renderLinLive();   // v0.040: и «Лин. сложность» так же
    if (!w.collapsed && el.id === "w-addr") renderAddrLive();   // v0.041
    if (!w.collapsed && el.id === "w-struct") renderStructLive();   // v0.042
    if (!w.collapsed) renderLiveRest();   // v0.045: и остальные живые окна
    if (!w.collapsed && el.id === "w-cone") renderCone();   // v0.048
    if (!w.collapsed && el.id === "w-bal") renderBal();   // v0.050
    if (!w.collapsed && el.id === "w-steps") renderSteps();   // v0.062
    if (!w.collapsed && el.id === "w-tiles") renderTiles();   // v0.070
    if (!w.collapsed && el.id === "w-pyr") renderPyr(true);   // v0.109
    if (!w.collapsed && el.id === "w-okt") renderOkt();   // v0.396
    if (!w.collapsed && el.id === "w-razv") renderRazv();   // v0.398
    if (!w.collapsed && el.id === "w-tri") renderTri();   // v0.432
    save();
  };
  // v0.016, запрос пользователя «двойной щелчок по заголовку»: свернуть / развернуть, как «–».
  head.addEventListener("dblclick", (e) => {
    if (e.target.closest("button") || ZZ_SOLO) return;
    e.preventDefault();
    const s = window.getSelection && window.getSelection(); if (s) s.removeAllRanges();
    head.querySelector(".bc").click();
  });
  const front = () => { Z.z++; el.style.zIndex = Z.z; };
  el.addEventListener("pointerdown", front);
  head.addEventListener("pointerdown", (e) => {
    if (e.target.closest("button") || e.button !== 0) return;
    if (ZZ_SOLO) return;   // v0.141: на странице одного окна оно стоит на месте
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
    /* v0.400, «такое же примагничивание надо» — окна: край окна ближе 10 px к краю другого окна, стола или поля строк — встаёт на него; сосед светится */
    const wt = [], wadd = (o) => { if (!o || o === el || !o.getClientRects().length) return; const q = o.getBoundingClientRect(); if (q.width > 4 && q.height > 4) wt.push([o, q]); };
    document.querySelectorAll(".win").forEach(o => { if (!o.classList.contains("docked") && o.style.display !== "none") wadd(o); });
    wadd($("desk")); wadd(field);
    const move = (ev) => {
      const of = overField(ev);
      const [nx, ny, hit] = of ? [ev.clientX - offX, ev.clientY - offY, []] : zSnapTo(ev.clientX - offX, ev.clientY - offY, el.offsetWidth, el.offsetHeight, wt, 10);
      zSnapGlow(hit);
      el.style.left = nx + "px"; el.style.top = ny + "px";
      field.classList.toggle("dock-hint", of);
    };
    const up = (ev) => {
      head.removeEventListener("pointermove", move); head.removeEventListener("pointerup", up);
      field.classList.remove("dock-hint"); zSnapGlow([]);   // v0.400
      const rs = el.getBoundingClientRect();   // v0.400: место — с учётом магнита, а не голой мыши
      el.classList.remove("dragging");
      if (overField(ev)) {
        dockWin(el, ev.clientY);
        el.style.left = ""; el.style.top = ""; el.style.width = "";
      } else {
        if (wasDocked) undockWin(el);
        const desk = $("desk"), d = desk.getBoundingClientRect();
        w.x = Math.max(0, Math.round(rs.left - d.left + desk.scrollLeft));
        w.y = Math.max(0, Math.round(rs.top - d.top + desk.scrollTop));
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
      if (el._userResize) { w.pw = w.w; w.px = w.x; el.querySelectorAll(".out").forEach(o => { o._hmax = 0; o.style.minHeight = ""; }); }   // v0.052: растянул окно — тексты мерятся заново
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
  palApply();   // v0.182: у гаммы свои цвета для светлой и тёмной темы
}
/* v0.182, «кнопка пресетов цветовой гаммы»: 🎨 в шапке — готовые гаммы по кругу (правый щелчок — назад). Гамма задаёт цвет единиц
   (--b1), нулей (--b0) и акцент (--acc) — ими красятся и строки, и конус, и окна; у каждой — свой набор для тёмной и светлой темы.
   «Исходная» — цвета страницы как были. Выбор — Z.pal (номер), едет и в «💾 Всё». */
const ZZ_PALS = [
  { name: "Своя" },   // v0.384: «Настраиваемая» → «Своя»   // v0.370: была «Исходная» — цвета страницы; теперь свои 1 / 0 / акцент (Z.palCust), не заданы — как было
  { name: "Янтарь", dark: ["#ffd166", "#94804f", "#ffb347"], light: ["#8a5a00", "#d8c7a0", "#b86e00"] },
  { name: "Океан", dark: ["#38bdf8", "#40709a", "#22d3ee"], light: ["#0369a1", "#a5c8e0", "#0e7490"] },
  { name: "Лес", dark: ["#6ee7a0", "#4f8466", "#4ade80"], light: ["#166534", "#a7c7b0", "#15803d"] },
  { name: "Роза", dark: ["#ff7ab6", "#935a76", "#f472b6"], light: ["#be185d", "#e3b3c8", "#db2777"] },
  { name: "Огонь", dark: ["#ff7a45", "#8a5443", "#fb923c"], light: ["#c2410c", "#e7bfae", "#ea580c"] },
  { name: "Контраст", dark: ["#ffffff", "#5a6272", "#e8ecf4"], light: ["#000000", "#cfd3db", "#1c2130"] },
];
/* v0.370, по снимку группы «Гамма» — «кнопки со своими цветами; Исходная — это Настраиваемая, к ней выбор цветов 0 и 1 и ещё что там»:
   кнопки гамм окрашены своими цветами (надпись — цвет единиц, фон — с оттенком нулей, рамка — акцент; выбранная — обведена акцентом).
   «Настраиваемая» (прежняя «Исходная») — свои цвета единиц, нулей и акцента: три выбора цвета рядом с ней. Свои — у каждой темы
   отдельно, Z.palCust = { dark: [1, 0, акцент], light: […] }; не заданы — цвета страницы, как было. Правый щелчок по «Настраиваемой» —
   вернуть цвета страницы */
const PAL_K = ["--b1", "--b0", "--acc"];
function palHex(c){ try { const x = document.createElement("canvas").getContext("2d"); x.fillStyle = "#000"; x.fillStyle = String(c || "").trim() || "#000"; const v = x.fillStyle; if (v[0] === "#") return v; const m = v.match(/\d+(\.\d+)?/g); return m ? "#" + m.slice(0, 3).map(n => (+n | 0).toString(16).padStart(2, "0")).join("") : "#000000"; } catch (e) { return "#000000"; } }
function palBase(){   // цвета страницы без гаммы (для нынешней темы)
  const st = document.documentElement.style, keep = PAL_K.map(k => st.getPropertyValue(k));
  PAL_K.forEach(k => st.removeProperty(k));
  const cs = getComputedStyle(document.documentElement), v = PAL_K.map(k => palHex(cs.getPropertyValue(k)));
  PAL_K.forEach((k, i) => { if (keep[i]) st.setProperty(k, keep[i]); });
  return v;
}
function palTheme(){ return themeIsLight() ? "light" : "dark"; }
function palCust(){ const c = Z.palCust && Z.palCust[palTheme()]; return Array.isArray(c) && c.length === 3 ? c : null; }
function palColors(i){ const P = ZZ_PALS[i] || ZZ_PALS[0]; return P.dark ? (themeIsLight() ? P.light : P.dark) : (palCust() || palBase()); }
function palApply(){
  const k = (Z.pal | 0) % ZZ_PALS.length, P = ZZ_PALS[k] || ZZ_PALS[0], st = document.documentElement.style, v = P.dark ? (themeIsLight() ? P.light : P.dark) : palCust();
  PAL_K.forEach((key, i) => { if (v) st.setProperty(key, v[i]); else st.removeProperty(key); });
  const b = $("bPal"); if (b) { b.textContent = "🎨 Гамма"; b.title = `🎨 Гамма (сейчас «${P.name}»): щелчок — открыть группу «Гамма» со всеми гаммами (открыта — закрыть); правый щелчок — следующая гамма`; }   // v0.369: подпись — «Гамма», выбранная — в подсказке и в группе
  palUi();
}
function palUi(){   // v0.367: в группе «Гамма» горит выбранная; «🎨» в шапке горит, пока группа открыта; v0.370 — кнопки своими цветами
  const k = (Z.pal | 0) % ZZ_PALS.length;
  document.querySelectorAll(".cg-pal button[data-pal]").forEach(b => {
    const i = +b.dataset.pal, v = palColors(i);
    b.classList.toggle("on", i === k);
    b.style.setProperty("--pc1", v[0]); b.style.setProperty("--pc0", v[1]); b.style.setProperty("--pca", v[2]);
  });
  /* v0.500, по снимку «Гаммы» — «тут цвета менять при нажатии на другие, а при нажатии на Своя — вернуть свои; но если изменить цвета, то это всё
     сохр. в Своя»: 1 / 0 / а показывают цвета выбранной гаммы (прежде — всегда «Своей») */
  const c = palColors(k);
  [["palC1", 0], ["palC0", 1], ["palCa", 2]].forEach(([id, i]) => { const el = $(id); if (el && document.activeElement !== el) el.value = palHex(c[i]); });
  const b = $("bPal"); if (b && window.cgrpShown) b.classList.toggle("on", cgrpShown("гамма"));
}
function palStep(d){
  Z.pal = (((Z.pal | 0) + d) % ZZ_PALS.length + ZZ_PALS.length) % ZZ_PALS.length; palApply(); save(); renderAll();
  say(`🎨 Гамма «${ZZ_PALS[Z.pal].name}» — ${Z.pal + 1} из ${ZZ_PALS.length}. Щелчок — следующая, правый — предыдущая.`);
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
/* v0.310, «скрывай вкладки при нажатии заголовка»: щелчок по заголовку группы левой панели (.pane-head) сворачивает всё, что под ним,
   до следующего заголовка; ещё щелчок — разворачивает. Какие свёрнуты — Z.paneFold (по тексту заголовка), помнится. Заголовки с id
   (◯ Группы конуса, Окна — их показывает и прячет код) и хват ширины панели не трогаются. В панели значками свёрнутое видно. */
function paneFoldBody(h){
  const out = [];
  for (let e = h.nextElementSibling; e && !e.classList.contains("pane-head"); e = e.nextElementSibling) if (e.id !== "paneEdge") out.push(e);
  return out;
}
function paneFoldApply(){
  if (!Z.paneFold || typeof Z.paneFold !== "object") Z.paneFold = {};
  document.querySelectorAll("#rowsPane > .pane-head:not([id])").forEach(h => {
    const k = h.textContent.trim(), f = !!Z.paneFold[k];
    h.classList.add("pf"); h.classList.toggle("folded", f);
    paneFoldBody(h).forEach(e => e.classList.toggle("pane-fold-hid", f));
  });
}
/* v0.323, «колёсико в левой панели — скролл всех окон»: колесо над левой панелью прокручивает стол со всеми окнами (#desk). Если под
   мышью то, что прокручивается само и ещё может (группы на панели, шаблоны, панель значками), — крутится оно, как прежде; поле ввода
   в фокусе — его. Shift + колесо — стол вбок, Ctrl + колесо — масштаб страницы, как всегда. */
function paneWheelInit(){
  const P = $("rowsPane"), D = $("desk"); if (!P || !D) return;
  P.addEventListener("wheel", (e) => {
    if (e.ctrlKey || e.metaKey) return;
    const k = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? D.clientHeight : 1, dy = e.deltaY * k, dx = e.deltaX * k;
    for (let n = e.target; n && n.nodeType === 1; n = n.parentElement) {
      if (n === document.activeElement && /^(INPUT|SELECT|TEXTAREA)$/.test(n.tagName)) return;
      const oy = getComputedStyle(n).overflowY;
      if (dy && !e.shiftKey && (oy === "auto" || oy === "scroll") && n.scrollHeight > n.clientHeight + 1 && (dy < 0 ? n.scrollTop > 0 : n.scrollTop + n.clientHeight < n.scrollHeight - 1)) return;
      if (n === P) break;
    }
    e.preventDefault();
    D.scrollBy(e.shiftKey ? { left: dy || dx } : { left: dx, top: dy });
  }, { passive: false });
}
function paneFoldInit(){
  document.querySelectorAll("#rowsPane > .pane-head:not([id])").forEach(h => {
    const t = h.getAttribute("title"); h.setAttribute("title", (t ? t + " · " : "") + "Щелчок по заголовку — свернуть / развернуть группу");
  });
  paneFoldApply();
  $("rowsPane").addEventListener("click", (e) => {
    const h = e.target.closest("#rowsPane > .pane-head:not([id])"); if (!h) return;
    const k = h.textContent.trim(); Z.paneFold[k] = !Z.paneFold[k]; if (!Z.paneFold[k]) delete Z.paneFold[k];
    paneFoldApply(); save(); if (typeof packWins === "function") packWins();
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
  const R = document.documentElement.style;   // v0.246: только когда поменялись — иначе пересчёт стилей всей страницы на каждой перерисовке
  if (R.getPropertyValue("--ff") !== String(Z.ff)) R.setProperty("--ff", Z.ff);
  if (R.getPropertyValue("--fs") !== Z.fs + "px") R.setProperty("--fs", Z.fs + "px");
  $("bFixShow").classList.toggle("on", Z.fixShow);
}
/* v0.034, баг-репорт «сломалось» (снимок: «🧊 Вид» в режиме «все строки» — холст со стрелками есть, карточек нет;
   у меня на тех же версиях не повторилось). «Вид» перерисовывается последним: если окно раньше него падало на
   данных пользователя, до «Вида» дело не доходило. Теперь каждое окно — в своём try: упавшее не гасит остальные,
   а ошибка с именем окна показывается внизу — её текст и нужен, чтобы починить. */
function renderAll(){
  const parts = [["вид страницы", applyView], ["поле строк", renderRows], ["90°", tri90Apply], ["крест", renderCross], ["указатели", renderPointers],
    ["спуск", renderDescent], ["поправка", renderFix], ["сложить", renderFoldLive], ["проверка", renderCheck], ["вид 🧊", renderView], ["лин. сложность", renderLinLive], ["адрес 🔎", renderAddrLive], ["структура 🧪", renderStructLive], ["цикл, GF(2), лента, орбита, ⇅", renderLiveRest], ["конус ◯", renderCone], ["балансы ⚖", renderBal], ["лесенки 📐", renderSteps], ["разложить △", renderTiles], ["пирамида ▲", renderPyr], ["октаэдр ◆", renderOkt], ["развёртка ✦", renderRazv]];
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
window.addEventListener("error", (e) => { if (String(e.message).includes("ZZ_LOCK")) { e.preventDefault(); return; } try { say(`⚠ Ошибка: ${e.message} · ${String(e.filename || "").split("/").pop()}:${e.lineno} — пришли этот текст.`); } catch (err) {} });

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
  rd.onload = () => { if (!loadSession(rd.result, f.name)) loadRowsText(rd.result, f.name); };   // v0.115: файл сессии узнаётся сам
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
/* ─── Сессия целиком в файл (v0.115) ─────────────────────────────────────────────────────────
   Запрос пользователя: «надо сохр настройки и все биты в файл, чтобы на другом компе». Всё состояние и так
   живёт в одном объекте Z (его же пишет save() в localStorage), поэтому файл — это Z целиком в JSON-обёртке:
   все 4 поля строк, строки за чертой, черновик строки для заполнения, свои шаблоны, окна, конус, вид, тема.
   Чтение кладёт Z из файла в хранилище и перезагружает страницу: init() сам разложит всё по полям и
   выпадающим спискам — вручную переносить сотню настроек значило бы что-то забыть. Прежнее состояние
   остаётся в хранилище под ключом ZZ_KEY + "_pered_failom" — на случай, если открыли не тот файл. */
const ZZ_SESS_FMT = "ZAZERKALIUS-SESSIYA";
function saveSession(){
  save();
  const d = new Date(), p2 = (n) => String(n).padStart(2, "0");
  const ver = (document.querySelector("#top .ver") || {}).textContent || "";
  const data = { format: ZZ_SESS_FMT, v: 1, page: ver, saved: d.toISOString(), state: Z };
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `zazerkalius-vse-${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}-${p2(d.getHours())}${p2(d.getMinutes())}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  const nb = (Array.isArray(Z.lanes) ? Z.lanes.slice(0, Z.laneCount) : [Z.rows]).reduce((s, l) => s + l.length, 0);
  say(`💾 Страница целиком сохранена в ${a.download}: строк ${nb}, поля, окна и настройки. На другом компьютере — «📂 Из файла» или перетащи файл на страницу.`);   // v0.302: кнопки — «💾 В файл» / «📂 Из файла»
}
/* v0.125, «сделай кнопку сохранения настроек и битов всех полей, чтобы при сбросе и Начальные — это применял, и когда файл загружен
   с другого компа — то тоже он становится умолчанием». ⭐ Умолчание — снимок Z в Z.home (без раскладки окон: она своя у каждого
   экрана). «↺ Начальные» берёт из него биты всех полей, «⟲ всё на места» — положения колец и настройки конуса. Открытый файл
   сессии сам становится умолчанием. Правый щелчок по ⭐ — забыть: снова встроенный столбик 1, 11, 101… и нулевые положения. */
const ZZ_HOME_SKIP = ["home", "win", "dockOrder", "z", "layoutVer", "rowsH", "rowsW", "coneBtns", "cgrpDock", "cgrpMove", "paneW", "paneWUser"];   // v0.252: и группы на левой панели   // v0.203: и кнопки на холсте — это раскладка
function homeOf(o){ const h = {}; for (const k of Object.keys(o)) if (!ZZ_HOME_SKIP.includes(k)) h[k] = o[k]; return JSON.parse(JSON.stringify(h)); }
function homeSave(){
  save(); Z.home = homeOf(Z); save(); homeBtn();
  const L = Array.isArray(Z.home.lanes) ? Z.home.lanes.slice(0, Z.home.laneCount || 1) : [Z.home.rows];
  say(`⭐ Умолчание запомнено: полей ${L.length}, строк ${L.reduce((s, l) => s + l.length, 0)}, положения колец и настройки. «↺ Начальные» и «⟲ всё на места» теперь возвращают это. Правый щелчок по ⭐ — забыть.`);
}
function homeForget(){
  if (!Z.home) { say("⭐ Своего умолчания нет — и так встроенное."); return; }
  delete Z.home; save(); homeBtn();
  say("⭐ Умолчание забыто: «↺ Начальные» — снова 1, 11, 101…, «⟲ всё на места» — нулевые положения.");
}
function homeBtn(){ const b = $("bHome"); if (b) b.classList.toggle("on", !!Z.home); }
/* Возвращает false, если текст — не файл сессии (тогда readFile читает его как строки). */
function loadSession(text, name){
  const t = String(text).trim();
  if (t[0] !== "{") return false;
  let data;
  try { data = JSON.parse(t); } catch (e) { return false; }
  if (!data || data.format !== ZZ_SESS_FMT) return false;
  const u = data.state;
  if (!u || !Array.isArray(u.rows) || !u.rows.every(zzIsBits)) { say(`📂 ${name}: файл сессии испорчен — строк из 0 и 1 в нём нет.`); return true; }
  if (!confirm(`Открыть «${name}»?\n\nВсе строки, поля и настройки страницы заменятся сохранёнными${data.saved ? " " + new Date(data.saved).toLocaleString() : ""}${data.page ? " (Zazerkalius " + data.page + ")" : ""}. Они же станут умолчанием для «↺ Начальные» и «⟲ всё на места».`)) { say("📂 Не открыто — всё как было."); return true; }
  try {
    const old = localStorage.getItem(ZZ_KEY);
    if (old) localStorage.setItem(ZZ_KEY + "_pered_failom", old);
    u.home = homeOf(u);   // v0.125: открытый файл становится умолчанием
    localStorage.setItem(ZZ_KEY, JSON.stringify(u));
    try { sessionStorage.setItem("zz_sess_loaded", name); } catch (e) {}
  } catch (e) { say(`📂 Не удалось записать в хранилище браузера (${e.message}) — в приватном окне так бывает.`); return true; }
  sessLoading = true;
  if (ZZ_PRESET_FULL) {   // v0.196: с пресета файл ложится в свою память — туда, на адрес без ?preset (иначе снова открылся бы пресет)
    const q = new URLSearchParams(location.search); q.delete("preset");
    location.replace(location.pathname + (q.toString() ? "?" + q : "") + location.hash);
  } else location.reload();
  return true;
}
function randomBits(n){ let o = ""; for (let i = 0; i < n; i++) o += Math.random() < 0.5 ? "0" : "1"; return o; }

function init(){
  load();
  /* v0.262, «после перезагрузки — выделенная строка почему-то, хотя я снял выделение»: снятая подсветка текущей строки (body.nocur)
     теперь помнится (Z.noCur) — следим за классом и пишем, когда он меняется */
  if (Z.noCur) document.body.classList.add("nocur");
  new MutationObserver(() => {
    const on = document.body.classList.contains("nocur");
    if (!!Z.noCur === on || document.body.classList.contains("bgmode")) return;
    Z.noCur = on; clearTimeout(init._nc); init._nc = setTimeout(save, 300);
  }).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  laneInit();   // v0.015
  if (typeof Z.tplRef !== "number") { Z.tplRef = -1; for (let k = Z.tpl.length - 1; k >= 0; k--) if (Z.tpl[k].rows.length > 1) { Z.tplRef = k; break; } }   // v0.037
  applyTheme();   // v0.009: до первой отрисовки — без вспышки тёмного
  document.querySelectorAll(".win").forEach(setupWin);
  // v0.010: стол стал уже (строки переехали в центр) — прежние места окон под него не годятся,
  // раскладываем один раз заново; дальше — как пользователь разложит.
  if ((Z.layoutVer | 0) < 10) { layoutAll(true); Z.layoutVer = 10; save(); }
  else layoutAll(false);
  dockRestore();   // v0.025: окна, пристыкованные под полем строк
  if (ZZ_SOLO) soloApply();   // v0.141
  ctwInit();   // v0.158
  cgrpInit();   // v0.177
  coneBtnsInit();   // v0.203
  try { panelEditInit(); } catch (err) { console.error(err); }   // v0.281: сбой правки панелей не должен останавливать остальной запуск
  leftBarsInit();   // v0.270
  if (window.ResizeObserver && $("fieldInfoBar")) new ResizeObserver(() => fieldInfoFit()).observe($("fieldInfoBar"));   // v0.209: поле шире/уже — сведения по месту
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => fieldInfoFit());   // v0.212: шрифт догрузился — кнопки над колонками ещё раз по месту
  $("bRowsStartTop").onclick = () => $("bRowsStart").click();   // v0.212: «↺» над номерами — то же, что «↺ Начало»
  $("coneLockAll").onclick = () => $("coneLock").click();   // v0.167: общий замок над столбиком замков — та же галка
  { const h1 = document.querySelector("#top h1"); if (h1) { h1.title = "Щелчок — перезагрузить страницу"; h1.style.cursor = "pointer"; h1.onclick = () => location.reload(); } }   // v0.162, «клик — перезагрузка» (по названию в шапке)
  // v0.026: высоту поля строк, растянутую за угол, запоминаем (только когда под ним окна).
  if (window.ResizeObserver) {
    let th = 0;
    new ResizeObserver(() => {
      if (!$("field").classList.contains("has-dock")) return;
      const h = Math.round($("rowList").offsetHeight);
      if (h > 0 && h !== Z.rowsH) { Z.rowsH = h; clearTimeout(th); th = setTimeout(save, 300); }
    }).observe($("rowList"));
    let rf = 0;   // v0.153: поле стало ниже / выше (окно, разделитель, окна под строками) — межстрочный подгоняется заново
    new ResizeObserver(() => { cancelAnimationFrame(rf); rf = requestAnimationFrame(rowsFit); }).observe($("rowList"));
  }

  const opEntries = Object.entries(ZZ_OPS).map(([k, o]) => [k, o.lab]);
  fillSelect("cycOp", opEntries, Z.cycOp);
  fillSelect("gf2Op", opEntries, Z.gf2Op);
  fillSelect("thruMode", Object.entries(ZZ_THRU_MODES), Z.thruMode);
  $("fontSel").value = Z.ff; $("fsVal").textContent = Z.fs;   // v0.217: размер — числом между ◀ ▶
  $("descentAlign").value = Z.descentAlign;
  $("cycHeat").checked = Z.cycHeat;
  $("gf2T").value = Z.gf2T;
  $("linSrc").value = Z.linSrc;
  $("fixKind").value = Z.fixKind; $("foldSrc").value = Z.foldSrc;
  $("foldFirst").value = Z.foldFirst; $("foldStep").value = Z.foldStep; $("bwtIdx").value = Z.bwtIdx;
  $("ptrMin").value = Z.ptrMin; $("ptrPal").checked = Z.ptrPal; $("ptrAnti").checked = Z.ptrAnti;

  // Строки
  // v0.092: замки колец у номеров строк — раньше выбора строки
  $("rowList").addEventListener("click", (e) => {   // v0.101: щелчок по «↻k» у номера — снять накрутку этого кольца
    const q = e.target.closest(".rrot[data-rr]"); if (!q) return;
    e.stopPropagation(); e.preventDefault();
    const i = +q.dataset.rr; coneRot[i] = 0; Z.coneRot = coneRot.map(x => Math.round(x || 0)); save(); renderRows(); renderCone();
    say(`◯ Кольцо ${i + 1}: накрутка снята — стоит как строка.`);
  }, true);
  $("rowList").addEventListener("click", (e) => {
    const b = e.target.closest(".rlk"); if (!b) return;
    e.stopPropagation(); e.preventDefault();
    const i = +b.dataset.lk; if (!Z.coneLocks || typeof Z.coneLocks !== "object") Z.coneLocks = {};
    Z.coneLocks[i] = !coneLocked(i); save(); renderRows(); renderCone();
    say(`◯ Кольцо ${i + 1} ${Z.coneLocks[i] ? "заперто — крутится только на вид" : "открыто — крутит саму строку"}.`);
  }, true);
  $("rowList").addEventListener("contextmenu", (e) => {
    const b = e.target.closest(".rlk"); if (!b) return;
    e.preventDefault(); e.stopPropagation(); const i = +b.dataset.lk; if (Z.coneLocks) delete Z.coneLocks[i]; save(); renderRows(); renderCone();
    say(`◯ Кольцо ${i + 1} — снова по общей галке «запрет сдвига строк».`);
  }, true);
  let rowNocurWas = false;   // v0.220: была ли строка «снята» до этого нажатия
  /* v0.244 (снято в v0.325, «наведение на бит под чертой — убери удаление по клику»): щелчок по строке за чертой удалял её и все
     строки до черты, наведение красило их красным. Больше нет — строки под чертой удаляет только 🗑. */
  /* v0.246: подсветка столбика номеров при наведении — классом (.rnhov), а не :has(:hover) в CSS: тот пересчитывал стили всего поля
     на каждое движение мыши по строкам */
  $("rowList").addEventListener("mouseover", (e) => {
    const L = $("rowList"), on = !!e.target.closest(".rw > .no > .rn"); if (L.classList.contains("rnhov") !== on) L.classList.toggle("rnhov", on);
    // v0.278, по снимку строки «66 стр. · 2211 бит · текущая 32 … · H 0.99 · ⇄ 56%» — «эту надпись убери здесь и помести её в подсказку
    // для номеров»: под строками её нет, она — в подсказке номера (вторым абзацем, свежая на каждое наведение)
    const no = e.target.closest(".rw[data-r] > .no");
    if (no && FIELD_INFO) { if (no.dataset.t0 === undefined) no.dataset.t0 = no.title; no.title = no.dataset.t0 + "\n\n" + (FIELD_INFO.title || FIELD_INFO.textContent); }
  });
  $("rowList").addEventListener("mouseleave", () => { $("rowList").classList.remove("rnhov"); });
  $("rowList").addEventListener("pointerdown", (e) => {
    if (e.target.closest("#cutPanel")) return;
    rowNocurWas = document.body.classList.contains("nocur");
    if (e.target.closest(".rw[data-r] > .bits")) return;   // v0.254: по битам подсветку здесь не трогаем — щелчок по биту выделяет строку сам (v0.266)
    if (e.target.closest(".rlk, .rrot")) return;   // v0.261, «нажимаю на 6 замок, а выделяется строка 21»: замок и ↻ — не выбор строки, подсветку текущей не зажигают
    // v0.263, «когда скролл двинул нижний — выделение само пришло в 17 строку»: полоса прокрутки, пустое место поля, строки под чертой,
    // кнопки под чертой — не выбор строки; подсветку текущей зажигает только нажатие на номер строки
    if (!e.target.closest(".rw[data-r] > .no > .rn")) return;   // v0.277: только сам номер (счётчики рядом — нет)
    document.body.classList.remove("nocur");
  });
  /* v0.254, «выделение в поле строк — по двойному щелчку или протяжкой» → «протяжкой по битам» и «вместо одного щелчка выделения —
     двойной нужен»: по битам одиночный щелчок больше не выбирает строку; двойной — выделить строку (ещё раз по ней же — снять,
     с Ctrl — добавить / убрать); протяжка по битам через несколько строк — выделить их подряд (с Ctrl — к прежним). Внутри одной
     строки протяжка по-прежнему выделяет символы (Del, Ctrl+C). Править строку на месте — F2 или Enter (прежде — двойной щелчок).
     Номера строк — как были: щелчок выделяет, двойной — ширина поля по умолчанию. */
  $("rowList").addEventListener("pointerdown", (e) => {
    // v0.264: выделение протяжкой — только с самих бит (цифр), мимо них протяжка двигает поле (ниже)
    // v0.277, «выделять тут только за номера — всю строку»: и с номера — протяжка через строки выделяет их целиком (как по битам)
    const rn = e.target.closest(".rw[data-r] > .no > .rn");
    const b = rn ? rn.parentElement : e.target.closest(".bx") && e.target.closest(".rw[data-r] > .bits"); if (!b || e.button !== 0 || rowEditing >= 0 || e.detail > 1) return;
    const r0 = b.parentElement, i0 = +r0.dataset.r; if (!(i0 < Z.rows.length) || (!rn && +b.dataset.l !== Z.lane)) return;
    const ctrl = e.ctrlKey || e.metaKey, base = ctrl ? new Set(rowSel) : new Set();
    let last = i0, rows = false, raf = 0;
    const at = (ev) => { const el = document.elementFromPoint(ev.clientX, ev.clientY), rw = el && el.closest && el.closest("#rowList .rw[data-r]"); return rw ? Math.min(+rw.dataset.r, Z.rows.length - 1) : last; };
    const mv = (ev) => {
      const i = at(ev); if (i === last && !(rows && i !== i0)) return;
      last = i;
      if (!rows && i === i0) return;   // в своей строке — обычное выделение символов
      if (!rows) { rows = true; document.body.classList.add("rowdrag"); }
      clearTextSel();
      rowSel.clear(); base.forEach(k => rowSel.add(k));
      for (let k = Math.min(i0, i); k <= Math.max(i0, i); k++) rowSel.add(k);
      rowSelAnchor = i0; Z.cur = i;
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; renderRows(); renderCone(); });
    };
    const up = () => {
      removeEventListener("pointermove", mv); removeEventListener("pointerup", up); removeEventListener("pointercancel", up);
      if (!rows) return;
      document.body.classList.remove("rowdrag"); if (raf) { cancelAnimationFrame(raf); raf = 0; }
      clearTextSel(); renderAll(); save();
      const eat = (ev) => { ev.stopPropagation(); ev.preventDefault(); };   // v0.266: щелчок в конце протяжки — не выбор одной строки
      addEventListener("click", eat, true); setTimeout(() => removeEventListener("click", eat, true), 0);
      say(`▤ Выделено строк: ${rowSel.size}. Del удалит, Ctrl+C скопирует, Esc снимет.`);
    };
    addEventListener("pointermove", mv); addEventListener("pointerup", up); addEventListener("pointercancel", up);
  });
  /* v0.264, «сделай перемещение вне клика бит в поле строк, а не выделение, оно — только на битах» (+ «но подсветка всей строки» — как
     была): протяжка по полю мимо самих бит (цифр) — двигает поле, как рукой (прокрутка вбок и вверх-вниз), выделение символов не
     начинается. Номера, замки, черта, кнопки под чертой, строка для заполнения, ручки осей — как были. Сдвинул — щелчок не срабатывает. */
  $("rowList").addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || rowEditing >= 0 || e.pointerType === "touch") return;
    const t = e.target;
    if (t.closest(".bx, .bxo, .ob, .no, .cutln, #cutPanel, #infoSlot, .fillrw, .lh, .axh, .axrow, button, input, select, textarea, label, a")) return;
    const L = $("rowList"), x0 = e.clientX, y0 = e.clientY, sl = L.scrollLeft, st = L.scrollTop; let moved = false;
    e.preventDefault();   // без выделения символов
    const mv = (ev) => {
      const dx = ev.clientX - x0, dy = ev.clientY - y0;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 4) return;
      if (!moved) { moved = true; document.body.classList.add("fpan"); clearTextSel(); }
      L.scrollLeft = sl - dx; L.scrollTop = st - dy;
    };
    const up = () => {
      removeEventListener("pointermove", mv); removeEventListener("pointerup", up); removeEventListener("pointercancel", up);
      if (!moved) return;
      document.body.classList.remove("fpan");
      const eat = (ev) => { ev.stopPropagation(); ev.preventDefault(); };   // щелчок после сдвига — не щелчок
      addEventListener("click", eat, true); setTimeout(() => removeEventListener("click", eat, true), 0);
    };
    addEventListener("pointermove", mv); addEventListener("pointerup", up); addEventListener("pointercancel", up);
  });
  document.addEventListener("keydown", (e) => {   // v0.254: F2 / Enter — править текущую строку на месте
    if ((e.key !== "F2" && e.key !== "Enter") || e.ctrlKey || e.altKey || e.metaKey || e.shiftKey || rowEditing >= 0) return;
    const t = e.target; if (t && (t.closest("input, textarea, select, button, [contenteditable]") )) return;
    if (document.body.classList.contains("zen") || !(Z.cur < Z.rows.length)) return;
    if (Z.laneCount > 1 && Z.laneView === "over") return;
    e.preventDefault(); editRowInPlace(Z.cur);
  });
  /* v0.220, по снимку выделенной строки 110011 — «клик по выделенной строке — снять выделение»: щелчок по текущей (или единственной
     выделенной) строке — как Esc: выделение снято, текущей нет; ещё щелчок — снова выбрана. */
  const rowUnselect = () => { rowSel.clear(); rowSelAnchor = -1; clearTextSel(); document.body.classList.add("nocur"); renderRows(); renderCone(); };
  // v0.309: нажатие по конусу больше не зажигает подсветку текущего (v0.107) — одиночный щелчок там снимает выделение
  // $("coneCv") pointerdown → nocur снят — убрано;   // v0.107: щелчок по кольцам — подсветка текущего снова   // v0.106: действие со строками — подсветка текущей снова видна
  document.addEventListener("keydown", (e) => { if (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "PageUp" || e.key === "PageDown" || e.key === "Home" || e.key === "End") document.body.classList.remove("nocur"); }, true);
  $("rowList").onclick = (e) => {
    if (rowEditing >= 0) return;
    delAtEnd = false;   // v0.021
    // v0.015: заголовок поля или ячейка чужого поля — сделать то поле рабочим.
    // v0.247, по снимку заголовка «поле 1 · 250 стр.» — «надо кнопку удалить поле»: ✕ в заголовке — поле уходит со всеми строками, ↩ вернёт
    const lx = e.target.closest(".lhx");
    if (lx) { try { deleteLane(+lx.dataset.lx, "✕ Поле"); } catch (err) { if (err.message === "ZZ_LOCK") say("⛔ Строки заперты — поле не удалить."); else throw err; } return; }
    const lh = e.target.closest(".lh"); if (lh) { switchLane(+lh.dataset.l); return; }
    if (e.target.closest(".axrow")) return;   // v0.018: ручки осей тащат, а не выбирают
    if (axSel >= 0) { axSel = -1; renderRows(); }   // v0.022: щелчок по полю снимает выделение оси
    const fc = e.target.closest(".fillrw .fc"); if (fc) { fillCycle(+fc.dataset.k); return; }   // v0.114: строка для заполнения
    if (e.target.closest(".fillrw .fadd")) { fillCommit(); return; }
    if (e.target.closest(".fillrw .fdel")) { fillReset(); return; }   // v0.118
    const r = e.target.closest(".rw"); if (!r || r.classList.contains("lhrow") || r.classList.contains("hid") || r.classList.contains("fillrw")) return;   // v0.112: за границей — строк нет
    const cell = e.target.closest(".bits, .ob");
    if (cell && +cell.dataset.l !== Z.lane && !textSelInRows()) { switchLane(+cell.dataset.l, +r.dataset.r); return; }
    const i = Math.min(+r.dataset.r, Z.rows.length - 1);
    // v0.012: щелчок по НОМЕРУ — выделение строк: просто — только эта, Ctrl — добавить/убрать, Shift — диапазон.
    if (e.target.closest(".no") && !e.target.closest(".rn")) return;   // v0.277, «выделять тут только за номера — всю строку»: счётчики н·м и 0·1 строку не выбирают
    if (e.target.closest(".no")) {
      if (e.shiftKey && rowSelAnchor >= 0) {
        if (!(e.ctrlKey || e.metaKey)) rowSel.clear();
        for (let k = Math.min(rowSelAnchor, i); k <= Math.max(rowSelAnchor, i); k++) rowSel.add(k);
      } else if (e.ctrlKey || e.metaKey) {
        if (rowSel.has(i)) rowSel.delete(i); else rowSel.add(i);
        rowSelAnchor = i;
      } else {
        if (Z.cur === i && !rowNocurWas && (!rowSel.size || (rowSel.size === 1 && rowSel.has(i)))) { rowUnselect(); return; }   // v0.220
        rowSel.clear(); rowSel.add(i); rowSelAnchor = i;
      }
      clearTextSel();
      Z.cur = i; renderAll(); save();
      return;
    }
    /* v0.266, «выделение сделай по 1 клику, но только по битам, вне бит — перетаскивание поля»: щелчок по самому биту (цифре) —
       выделить строку (ещё раз по ней же — снять, Ctrl — добавить / убрать, Shift — диапазон). Мимо бит — ничего (там протяжка
       двигает поле, v0.264). Протянул по символам в строке — это выделение символов, строку не выбирает. */
    if (!e.target.closest(".bx") || e.detail > 1 || textSelInRows() || !(+r.dataset.r < Z.rows.length)) return;
    clearTextSel(); document.body.classList.remove("nocur");
    if (e.shiftKey && rowSelAnchor >= 0) {
      if (!(e.ctrlKey || e.metaKey)) rowSel.clear();
      for (let k = Math.min(rowSelAnchor, i); k <= Math.max(rowSelAnchor, i); k++) rowSel.add(k);
    } else if (e.ctrlKey || e.metaKey) { if (rowSel.has(i)) rowSel.delete(i); else rowSel.add(i); rowSelAnchor = i; }
    else if (Z.cur === i && !rowNocurWas && (!rowSel.size || (rowSel.size === 1 && rowSel.has(i)))) { rowUnselect(); return; }   // v0.220: по выделенной — снять
    else { rowSel.clear(); rowSel.add(i); rowSelAnchor = i; }
    Z.cur = i; renderAll(); save();
  };
  // v0.010: двойной щелчок — правка строки на месте.
  $("rowList").ondblclick = (e) => {
    if (rowEditing >= 0) return;
    // v0.274: двойной щелчок по номеру ширину больше не сбрасывает — это делает двойной щелчок по границе поля
    // v0.112: двойной щелчок по черте — вернуть все строки (черту тащат с захватом указателя — щелчок приходит полю, смотрим, что под ним)
    const pt = document.elementFromPoint(e.clientX, e.clientY);
    if (pt && pt.closest(".cutln")) { cutMove(Infinity); return; }
    /* v0.291, «двойной клик по полю строк — должен убирать все выделения»: где угодно в поле (кроме черты и панели под ней) — снято всё:
       выделенные строки, подсветка текущей (как Esc), выделенный текст и выделение оси. До v0.290 двойной щелчок только убирал слово,
       выделенное им самим на битах (v0.266). v0.292: по строке — выделить её, снимает всё только двойной щелчок мимо строк. */
    if (e.target.closest("#cutPanel, button, input, select, textarea, label, a")) return;
    e.preventDefault();
    /* v0.292, «2 щелчка по строке — выделение, а по битам одинарный, как сейчас»: двойной щелчок по строке рабочего поля (номер, биты,
       пустое место в строке) — выделить её; снять всё — двойной щелчок мимо строк. Заголовки полей, ручки осей, строка для заполнения —
       ничего; строка чужого поля — его уже сделал рабочим одиночный щелчок. */
    /* v0.311, «2 клик по полю строк не убирает выделение — даже вне бит, должен убрать все»: выделяет двойной щелчок только по НОМЕРУ
       строки; по битам, по пустому месту в строке и мимо строк — снять всё. */
    if (e.target.closest(".lh, .axrow, .fillrw")) return;
    const r = e.target.closest(".no") && e.target.closest(".rw");
    if (r && !r.classList.contains("lhrow") && !r.classList.contains("hid")) {
      const c = e.target.closest(".bits, .ob"), i = +r.dataset.r;
      if ((c && +c.dataset.l !== Z.lane) || !(i < Z.rows.length)) return;
      clearTextSel(); document.body.classList.remove("nocur"); axSel = -1;
      rowSel.clear(); rowSel.add(i); rowSelAnchor = i; Z.cur = i; renderAll(); save();
      return;
    }
    const n = rowSel.size; rowSel.clear(); rowSelAnchor = -1; clearTextSel(); document.body.classList.add("nocur"); axSel = -1;
    renderRows(); renderCone();
    say(n ? `Выделение снято со всех строк (${n}).` : "Выделение снято.");
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
      Z.laneCount++; Z.lanes[k] = res; Z.lanesHid[k] = []; Z.axisPos[k] = undefined;
      $("laneCount").value = String(Z.laneCount);
      switchLane(k, 0, true);
      say(`⤓ Итог наложения (${op}) — ${res.length} строк в поле ${k + 1}, оно теперь рабочее. ↩ вернёт.`);
    } else {
      Z.rows = res; syncLane(); Z.cur = 0;
      renderAll(); save();
      say(`⤓ Все 4 поля заняты — итог наложения (${op}) записан в рабочее поле ${Z.lane + 1}. ↩ вернёт.`);
    }
  };
  // v0.112: черта-граница под нижней строкой — тащится вверх / вниз; строки ниже неё уходят за границу
  $("rowList").addEventListener("pointerdown", (e) => {
    const ln = e.target.closest(".cutln"); if (!ln || e.button !== 0 || rowEditing >= 0) return;
    e.preventDefault(); e.stopPropagation();
    const list = $("rowList"), pre = undoState(), H0 = cutHeight();   // v0.324: H0 — сколько строк было до протяжки
    let raf = 0, moved = false, lastY = e.clientY, lastX = e.clientX;
    /* v0.338, «число строк показывалось прямо во время протяжки»: у курсора — живая метка «N стр.» */
    let cnt = document.getElementById("cutCnt"); if (!cnt) { cnt = document.createElement("div"); cnt.id = "cutCnt"; document.body.appendChild(cnt); }
    const cntShow = () => { cnt.textContent = cutHeight() + " стр."; cnt.style.left = Math.round(lastX + 14) + "px"; cnt.style.top = Math.round(lastY + 12) + "px"; cnt.hidden = false; };
    list.setPointerCapture(e.pointerId);
    document.body.classList.add("cutdrag");
    const at = (y) => {   // сколько строк над курсором: середина строки выше него
      let k = 0, rh = 20; const vis = list.querySelectorAll(".rw[data-r]:not(.hid):not(.lhrow) > .no");
      vis.forEach(no => { const r = no.getBoundingClientRect(); if ((r.top + r.bottom) / 2 < y) k++; rh = r.height || rh; });
      /* v0.225: ниже черты — столько строк, сколько их помещается от черты до курсора (строка для заполнения, кнопки и строки
         под чертой не мешают): вниз — достроить (или вернуть из-под черты, если строки заперты). */
      const ln = list.querySelector(".cutln"), lb = ln ? ln.getBoundingClientRect().bottom : Infinity;
      if (k === vis.length && y > lb) k += Math.max(0, Math.round((y - lb) / rh));
      return Math.max(1, k);
    };
    const step = () => {
      raf = 0;
      const k = at(lastY);
      if (k === cutHeight()) return;
      cutAt(k, !Z.rowLock); moved = true; renderRows();   // v0.225: вниз — достраивать (если строки не заперты)
      cntShow();
    };
    /* v0.242: у края поля (или окна) — прокрутка, пока курсор там, даже если мышь стоит: черта дотягивается до строк за краем */
    let edge = 0;
    const edgeTick = () => {
      edge = 0;
      const lr = list.getBoundingClientRect(), top = Math.max(lr.top, 0), bot = Math.min(lr.bottom, innerHeight);
      const d = lastY < top + 24 ? -12 : lastY > bot - 24 ? 12 : 0;
      if (!d) return;
      const st = list.scrollTop; list.scrollTop += d;
      if (list.scrollTop !== st && !raf) raf = requestAnimationFrame(step);
      edge = requestAnimationFrame(edgeTick);
    };
    const move = (ev) => {
      if (!(ev.buttons & 1)) { up(); return; }   // v0.269: кнопку отпустили, а pointerup потерялся — черта не едет дальше сама
      lastY = ev.clientY; lastX = ev.clientX; if (moved) cntShow();
      if (!edge) edge = requestAnimationFrame(edgeTick);
      if (!raf) raf = requestAnimationFrame(step);
    };
    let fin = false;
    const up = () => {
      if (fin) return; fin = true;   // v0.271: и с окна, и с поля — один раз
      list.removeEventListener("pointermove", move); list.removeEventListener("pointerup", up); list.removeEventListener("pointercancel", up);
      removeEventListener("pointerup", up, true); removeEventListener("blur", up);
      if (edge) { cancelAnimationFrame(edge); edge = 0; }
      if (raf) { cancelAnimationFrame(raf); step(); }
      if (moved) cutMove(null, pre);
      document.body.classList.remove("cutdrag");   // v0.242: после итоговой перерисовки — поле остаётся там, где отпустили
      rowsFit(); fieldInfoFit();   // v0.265: шаг строк и кнопки над столбиками — один раз, когда отпустили
      cnt.hidden = true;
      if (moved && cutHeight() !== H0) cutAsk(cutHeight(), cutHeight() > H0);   // v0.324: протянул — окошко «до строки N»; v0.338 — и вверх
    };
    list.addEventListener("pointermove", move);
    list.addEventListener("pointerup", up);
    list.addEventListener("pointercancel", up);
    addEventListener("pointerup", up, true); addEventListener("blur", up);   // v0.271: отпустили где угодно (и окно потеряло фокус) — конец протяжки
  });
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
  laneCountUi();
  $("laneCount").onchange = (e) => {
    if (e.target.value === "new") {   // v0.276: ＋ создать поле — ещё одно, и оно рабочее
      const k = Math.min(3, Z.laneCount | 0); if ((Z.laneCount | 0) >= 4) { laneCountUi(); return; }
      syncLane(); Z.laneCount = k + 1; laneCountUi();
      const old = (Z.lanes[k] || []).length > 1 || (Z.lanes[k] && Z.lanes[k][0] !== "1");
      switchLane(k, 0, true);
      say(`＋ Поле ${k + 1} — ${old ? "вернулось со своими строками (" + Z.lanes[k].length + " стр.)" : "новое"}, оно рабочее. ✕ в заголовке поля — удалить.`);
      return;
    }
    Z.laneCount = Math.max(1, Math.min(4, +e.target.value || 1));
    if (Z.lane >= Z.laneCount) switchLane(0, undefined, true); else { renderAll(); save(); }
    say(Z.laneCount > 1 ? `Полей строк — ${Z.laneCount}, у каждого своя ось. Рабочее — поле ${Z.lane + 1}; сменить — щелчок по полю или ← / →.` : "Одно поле строк. Остальные поля не стёрты — вернутся, если полей снова станет больше.");
  };
  // v0.036: переключатели чисел у номеров и красных неподвижных бит
  const fmLabel = () => {
    $("bShowFM").classList.toggle("on", !!Z.showFM); $("bShow01").classList.toggle("on", !!Z.show01); $("bShowFix").classList.toggle("on", Z.showFix === true); $("bShowFixIr").classList.toggle("on", Z.showFix === "ir");   // v0.340: две кнопки, горит одна или ни одной
  };
  fmLabel();
  $("bShowFM").onclick = () => { Z.showFM = !Z.showFM; fmLabel(); renderRows(); save(); };
  $("bTri90").classList.toggle("on", !!Z.tri90);   // v0.071
  $("bTri90").onclick = () => {
    Z.tri90 = !Z.tri90; $("bTri90").classList.toggle("on", Z.tri90); tri90Apply(); save();
    if (Z.tri90) { const L = $("rowList"); requestAnimationFrame(() => { L.scrollLeft = Math.max(0, (L.scrollWidth - L.clientWidth) / 2); }); }   // v0.074: широкий треугольник — сразу к его середине
    say(Z.tri90 ? (ovControls() ? "◸ 90° включится, когда поля не наложением." : `◸ 90°: межсимвольный ${Z.tri90Ls} px — стороны треугольника под 45°, угол при вершине прямой. Сменишь шрифт или размер — подберётся заново.`) : "◸ 90° выключен — обычный интервал.");
  };
  $("bShow01").onclick = () => { Z.show01 = !Z.show01; fmLabel(); renderRows(); save(); };
  const lockUi = () => { $("bRowLock").textContent = Z.rowLock ? "⛔" : "✎";   /* v0.173: свой значок — не путать с общим замком колец 🔒 */ $("bRowLock").classList.toggle("on", !!Z.rowLock); document.body.classList.toggle("rowlock", !!Z.rowLock); };
  lockUi();
  $("bRowLock").onclick = () => { Z.rowLock = !Z.rowLock; lockUi(); save(); say(Z.rowLock ? "🔒 Строки заперты: менять нельзя ничем, смотреть — сколько угодно." : "🔓 Строки открыты для правки."); };   // v0.061
  const showFixSet = (m) => {   // v0.058 — одна кнопка по кругу; v0.340, «раздели на 2 кнопки, вкл либо либо»: 🔴 ⇄ и 🟢 ⇄🔁, включённая гасит другую
    Z.showFix = Z.showFix === m ? false : m;
    fmLabel(); renderAll(); save();
    say(Z.showFix === "ir" ? "🟢 Неподвижные при реверс-инверсии: бит не равен зеркальному — разворот с инверсией кладёт его на то же место."
      : Z.showFix ? "🔴 Неподвижные при развороте: бит равен зеркальному." : "Неподвижные не подсвечиваются.");
  };
  $("bShowFix").onclick = () => showFixSet(true);
  $("bShowFixIr").onclick = () => showFixSet("ir");
  $("rowsAlign").value = Z.rowsAlign || "center";
  $("rowsAlign").onchange = (e) => { Z.rowsAlign = e.target.value; renderRows(); save(); };
  if ($("bitView")) { $("bitView").value = Z.bitView || "txt";   // v0.456: вид бит — цифры, квадраты, ромбы
    $("bitView").onchange = (e) => { Z.bitView = e.target.value; renderRows(); save();
      if (Z.bitView === "rh") say((Z.rowsAlign || "center") !== "center" ? "◆ Ромбы — при выравнивании по центру; сейчас — квадраты." : "◆ Ромбы — у строк, чья длина отличается от соседней на нечётное (ромбы входят друг в друга); у остальных — квадраты."); }; }
  // 🧊 Вид (v0.024): кнопки, перетаскивание мышью, перерисовка при смене размера окна
  // v0.056: ① ② ③ — сохранённые виды, ⟋ — хорда концов
  const presetGo = (k, e, save_) => {
    if (!Array.isArray(Z.viewPresets)) Z.viewPresets = [null, null, null];
    const P = Z.viewPresets;
    if (e && e.shiftKey && P[k]) { P[k] = null; viewPresetsUi(); save(); say(`Вид ${"①②③"[k]} стёрт.`); return; }
    if (save_ || !P[k]) {
      P[k] = { M: viewCamM().slice(), zoom: Z.viewZoom || 1, pan: Array.isArray(Z.viewPan) ? Z.viewPan.slice() : [0, 0], mode: Z.viewMode };
      viewPresetsUi(); save(); say(`Вид ${"①②③"[k]} запомнен: ${viewName(P[k].M)}, масштаб ×${(P[k].zoom).toFixed(1)}. Щелчок — вернуть, правый — перезаписать, Shift — стереть.`); return;
    }
    Z.viewM = P[k].M.slice(); Z.viewZoom = P[k].zoom; Z.viewPan = P[k].pan.slice(); viewLockAx = null;
    renderView(); save();
  };
  document.querySelectorAll("#viewBtns button[data-p]").forEach(b => {
    b.addEventListener("click", (e) => presetGo(+b.dataset.p, e, false));
    b.addEventListener("contextmenu", (e) => { e.preventDefault(); presetGo(+b.dataset.p, null, true); });
  });
  viewPresetsUi();
  $("bViewChord").classList.toggle("on", !!Z.viewChord);
  $("bViewChord").onclick = () => { Z.viewChord = !Z.viewChord; $("bViewChord").classList.toggle("on", Z.viewChord); renderView(); save(); };
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
    const cv = $("viewCv");
    // v0.053: Ctrl + щелчок по кольцу — выделить его плоскость и сразу встать к ней перпендикулярно
    if (moveMode && e.button === 0 && Z.viewGuides !== false && Z.viewMode !== "all") {
      const r = cv.getBoundingClientRect(), ax = viewRingAt(cv, e.clientX - r.left, e.clientY - r.top);
      if (ax) { e.preventDefault(); viewLockAx = ax; viewFacePlane(ax); renderView(); save(); cv.focus({ preventScroll: true }); return; }
    }
    cv.setPointerCapture(e.pointerId); cv.style.cursor = panMode ? "move" : "grabbing";
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
  setupCone();   // v0.048
  setupPyr();   // v0.109
  /* v0.054, «сюда — возможность закреплять кнопки для вывода вверх панелей» (снимок пустой шапки). 📌 — режим: щелчок по
     любой кнопке с именем (id) кладёт её копию в шапку, щелчок по шапке окна — кнопку этого окна (развернуть, поднять,
     показать). Копия жмёт оригинал ($ находит его и в вынесенном окне). Правый щелчок — открепить. Z.pins запоминается. */
  if (!Array.isArray(Z.pins)) Z.pins = [];
  let pinMode = false;
  const pinLabel = (p) => {
    const el = $(p.id); if (!el) return null;
    if (p.t === "w") return el.dataset.title || p.id;
    const t = (el.textContent || "").trim().replace(/\s+/g, " ");
    return t ? (t.length > 24 ? t.slice(0, 23) + "…" : t) : p.id;
  };
  const renderPins = () => {
    let h = "";
    Z.pins.forEach((p, k) => {
      const lab = pinLabel(p); if (!lab) return;
      const tip = p.t === "w" ? `Окно «${lab}»: развернуть, поднять, показать` : (($(p.id) || {}).title || lab);
      h += `<button data-k="${k}"${p.t === "w" ? ' class="pinw"' : ""} title="${esc(tip + " · правый щелчок — открепить")}">${esc(lab)}</button>`;
    });
    $("pinBar").innerHTML = h;
  };
  const pinToggle = (p) => {
    const k = Z.pins.findIndex(q => q.t === p.t && q.id === p.id);
    if (k >= 0) Z.pins.splice(k, 1); else Z.pins.push(p);
    renderPins(); save();
    say(k >= 0 ? `📌 «${pinLabel(p) || p.id}» откреплено.` : `📌 «${pinLabel(p) || p.id}» — вверху. Ещё кнопки — щёлкай дальше; выход — 📌 или Esc.`);
  };
  const winShow = (id) => {
    const el = $(id); if (!el) return;
    if (id === "w-help" && !Z.helpOn) { $("bHelp").click(); }
    { const pb = document.querySelector('#paneWins button[data-w="' + id + '"]'); if (pb) pb.click(); }   // v0.410: и из списка окон слева
    if (el.classList.contains("collapsed")) el.querySelector(".bc").click();
    Z.z++; el.style.zIndex = Z.z;
    el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    el.classList.add("flash"); setTimeout(() => el.classList.remove("flash"), 800);
  };
  window.zzWinShow = winShow;   // v0.452: конструктор открывает «△ Сетку»
  $("pinBar").onclick = (e) => {
    const b = e.target.closest("button[data-k]"); if (!b) return;
    const p = Z.pins[+b.dataset.k]; if (!p) return;
    if (p.t === "w") winShow(p.id); else { const src = $(p.id); if (src) src.click(); else say("📌 Этой кнопки больше нет."); }
  };
  $("pinBar").oncontextmenu = (e) => {
    const b = e.target.closest("button[data-k]"); if (!b) return;
    e.preventDefault(); const p = Z.pins[+b.dataset.k]; if (p) pinToggle(p);
  };
  $("bPinMode").onclick = () => {
    pinMode = !pinMode;
    document.body.classList.toggle("pinmode", pinMode); $("bPinMode").classList.toggle("on", pinMode);
    say(pinMode ? "📌 Закрепление: щёлкни любую кнопку — она встанет в шапку; шапку окна — встанет кнопка окна. Выход — 📌 или Esc."
                : "📌 Закрепление выключено.");
  };
  const pinCatch = (e) => {
    if (!pinMode || e.target.closest("#top")) return;
    const head = e.target.closest(".whead"), b = e.target.closest("button");
    if (b && !head) {
      e.preventDefault(); e.stopPropagation();
      if (e.type !== "click") return;
      if (!b.id) { say("📌 У этой кнопки нет имени — её закрепить нельзя. Скажи какую — дам имя."); return; }
      pinToggle({ t: "b", id: b.id }); return;
    }
    if (head && !b) { e.preventDefault(); e.stopPropagation(); if (e.type === "click") pinToggle({ t: "w", id: head.parentElement.id }); }
  };
  document.addEventListener("click", pinCatch, true);
  document.addEventListener("dblclick", pinCatch, true);
  document.addEventListener("pointerdown", (e) => { if (pinMode && e.target.closest(".whead") && !e.target.closest("button")) e.stopPropagation(); }, true);   // шапку не таскать
  document.addEventListener("keydown", (e) => { if (pinMode && e.key === "Escape") { e.preventDefault(); $("bPinMode").click(); } }, true);
  /* v0.410, по снимкам «✦ развёртка» и шапки с «◆ Гранидус», «◯ Конус» — «сюда»: окно развёртки — закреплённой кнопкой в шапке, сразу за
     Гранидусом (или в конце). Один раз (Z.razvPin0): открепишь правым щелчком — само не вернётся. */
  if (!Z.razvPin0) {
    Z.razvPin0 = true;
    if (!Z.pins.some(p => p.t === "w" && p.id === "w-razv")) { const k = Z.pins.findIndex(p => p.t === "w" && p.id === "w-okt"); Z.pins.splice(k >= 0 ? k + 1 : Z.pins.length, 0, { t: "w", id: "w-razv" }); }
    save();
  }
  // v0.432: окно «△ Сетка» — тоже кнопкой в шапке, сразу за развёрткой (один раз, Z.triPin0)
  if (!Z.triPin0) {
    Z.triPin0 = true;
    if (!Z.pins.some(p => p.t === "w" && p.id === "w-tri")) { const k = Z.pins.findIndex(p => p.t === "w" && p.id === "w-razv"); Z.pins.splice(k >= 0 ? k + 1 : Z.pins.length, 0, { t: "w", id: "w-tri" }); }
    save();
  }
  renderPins();
  /* v0.052, «при изменении текста всё дёргается, на многих меню так же»: живые тексты окон меняют число строк
     (другая строка, наведение) — и всё, что под ними (холст конуса, таблицы, виды), прыгает вверх-вниз. Текст окна теперь
     не сжимается: высота запоминается наибольшей, только растёт (один раз) и не прыгает назад. Растянул окно — мерится
     заново. */
  document.querySelectorAll(".win .out").forEach(el => {
    new MutationObserver(() => {
      const h = el.offsetHeight;
      if (h > (el._hmax || 0)) { el._hmax = h; el.style.minHeight = h + "px"; }
    }).observe(el, { childList: true, characterData: true, subtree: true });
  });
  $("tilesKind").value = Z.tilesKind || "rh";   // v0.070
  $("tilesKind").onchange = (e) => { Z.tilesKind = e.target.value; save(); renderTiles(); };
  $("tilesTbl").addEventListener("click", (e) => { const tr = e.target.closest("tr[data-s]"); if (!tr) return; Z.tilesS = +tr.dataset.s; save(); renderTiles(); });
  $("stepsTbl").addEventListener("click", (e) => { const tr = e.target.closest("tr[data-r]"); if (!tr) return; const i = +tr.dataset.r; if (i !== Z.cur && i < Z.rows.length) { Z.cur = i; renderAll(); save(); } });   // v0.062
  $("balTbl").addEventListener("click", (e) => { const tr = e.target.closest("tr[data-r]"); if (!tr) return; const i = +tr.dataset.r; if (i !== Z.cur && i < Z.rows.length) { Z.cur = i; renderAll(); save(); } });   // v0.050
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
    if (b.dataset.t === "face") {   // v0.053: ⊥ — встать перпендикулярно выделенной плоскости
      if (Z.viewMode === "all") { say("⊥ В «все строки» у каждой карточки свой поворот — встать к плоскости можно в «одна строка» и «все вместе»."); return; }
      if (!viewLockAx) { say("⊥ Сначала выдели плоскость: потяни за её кольцо или Ctrl + щелчок по кольцу (тогда встанет сразу)."); return; }
      viewFacePlane(viewLockAx); renderView(); save(); return;
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
        if (i === Z.cur) $("viewOut").innerHTML = `Текущая строка ${Z.cur + 1}: ` + viewReading(Z.rows[i], ya, pi);
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
  $("maskMode").value = Z.maskMode;
  $("maskMode").onchange = (e) => { Z.maskMode = e.target.value; save(); };
  $("bMaskTri").onclick = () => {
    /* v0.047, «пусть строится от выделенной, поля рядом с кнопкой удали»: строка — текущая, число строк — само:
       Паскаль и маской — длина строки (не меньше 16), спуск — до одного бита, кольцо — пока строка не повторится. */
    const m = cur();
    if (!m) { say("△ Текущая строка пустая — строить не от чего."); return; }
    let n = Math.min(512, Math.max(16, m.length));
    if (Z.maskMode === "descent") n = m.length;
    if (Z.maskMode === "ring") { const c = zzCycle(m, "xorNb"); n = c.lam > 0 ? Math.min(256, c.mu + c.lam + 1) : 256; }
    const rows = zzMaskTriangle(m, n, Z.maskMode);
    snapshot();
    Z.rows.splice(Z.cur + 1, 0, ...rows);
    Z.cur += 1;   // текущей становится вершина — от неё и смотреть
    renderAll(); save();
    const modeTxt = { pascal: "🔺 Паскаль от строки", descent: "▽ спуск от строки", ring: "◯ кольцом от строки", start: "маской, каждая с начала", tape: "маской, сплошной лентой" }[Z.maskMode] || "";
    let ringTxt = "";   // v0.046: у цилиндра — где вход, где петля, умер ли в ноль
    if (Z.maskMode === "ring") {
      const c = zzCycle(m, "xorNb"), z = rows.findIndex(r => !/1/.test(r));
      ringTxt = c.lam < 0 ? " Петля длиннее потолка." : ` Кольцо ${m.length} бит: вход μ = ${c.mu}, петля λ = ${c.lam}` +
        (z >= 0 ? `, всё умерло в ноль на строке ${z}` + ((m.length & (m.length - 1)) === 0 ? " (длина — степень двойки)" : "") : "") + ".";
    }
    const bits = rows.reduce((a, r) => a + r.length, 0);
    say(`△ ${modeTxt} ${m.length > 24 ? m.slice(0, 24) + "…" : m}: ${rows.length} строк, всего ${bits} бит — под бывшей текущей.` +
        (Z.maskMode === "descent" && rows.length < n ? ` Спуск кончается на одном бите — строк не больше длины строки (${m.length}).` : "") + ringTxt + " ↩ вернёт.");
  };
  // Шаблоны
  /* v0.301, по снимку шаблона с 💾 ⚑ ✕ — «убери ＋ Столбик под чертой, поставь к шаблонам ＋ новый; выделенный шаблон — текущий, жёлтым,
     флажок тогда не нужен», и выбор «💾 Сохр — в текущий». Текущий шаблон (Z.tplRef) горит жёлтым: с ним сравниваются строки
     (номера изменённых — золотом, v0.037), в него пишет «💾 Сохр» (v0.298 — 💾 у шаблона). Щелчок по своему шаблону — загрузить его в поле,
     и он становится текущим; «＋ новый» — новый шаблон из всех бит, сразу текущий. ⚑ и 💾 у каждого шаблона сняты. */
  const tplCurT = () => (typeof Z.tplRef === "number" && Z.tpl[Z.tplRef]) || null;
  const tplNew = () => { const rows = Z.rows.slice(); Z.tpl.push({ name: tplName(rows), rows }); Z.tplRef = Z.tpl.length - 1; renderTpl(); renderRows(); save(); return Z.tpl[Z.tplRef]; };
  const tplClick = (e) => {   // v0.296: и под чертой (встроенные), и в группе «Сохранение» (свои)
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.b !== undefined) { const t = TPL_BUILTIN[+b.dataset.b]; tplInsert(t.rows(), t.name); }
    else if (b.dataset.u !== undefined) {   // v0.066: щелчок — заменить, Shift — вставить; v0.301: щелчок — и сделать текущим
      const k = +b.dataset.u, t = Z.tpl[k]; if (!t) return;
      if (!e.shiftKey) { Z.tplRef = k; renderTpl(); }
      (e.shiftKey ? tplInsert : tplReplace)(t.rows.slice(), t.name);
    }
    else if (b.dataset.x !== undefined) {
      const x = +b.dataset.x, t = Z.tpl.splice(x, 1)[0];
      if (typeof Z.tplRef === "number") { if (Z.tplRef === x) Z.tplRef = -1; else if (Z.tplRef > x) Z.tplRef--; }   // v0.037
      renderTpl(); renderRows(); save(); if (t) say(`Шаблон «${t.name}» удалён.`);
    }
  };
  const tplDbl = (e) => {
    const b = e.target.closest("button[data-u]"); if (!b) return;
    const t = Z.tpl[+b.dataset.u]; if (!t) return;
    const n = window.prompt("Имя шаблона", t.name);
    if (n && n.trim()) { t.name = n.trim().slice(0, 60); renderTpl(); save(); }
  };
  for (const id of ["tplList", "tplMine"]) { $(id).onclick = tplClick; $(id).ondblclick = tplDbl; }
  $("bTplNew").onclick = () => { const t = tplNew(); say(`＋ Новый шаблон «${t.name}» — ${t.rows.length} стр., он теперь текущий (жёлтый).`); };
  $("bTplSave").onclick = () => {   // v0.301: в текущий шаблон (v0.298: имя, данное страницей, — под новый размер; своё не трогается)
    const t = tplCurT();
    if (!t) { const n = tplNew(); say(`💾 Текущего шаблона не было — сохранён новый «${n.name}» (${n.rows.length} стр.), он теперь текущий.`); return; }
    const rows = Z.rows.slice();
    if (rows.length === t.rows.length && rows.every((r, i) => r === t.rows[i])) { say(`💾 «${t.name}» — и так такой же, менять нечего.`); return; }
    const n = rows.reduce((a, r, i) => a + (r !== t.rows[i] ? 1 : 0), 0) + Math.max(0, t.rows.length - rows.length);
    t.prev = { rows: t.rows, name: t.name };   // v0.299: прежние биты — для правого щелчка
    if (t.name === tplName(t.rows)) t.name = tplName(rows);
    t.rows = rows; renderTpl(); renderRows(); save();
    say(`💾 Шаблон «${t.name}» перезаписан: ${rows.length} стр., изменено ${n}. Правый щелчок по «💾 Сохр» — вернуть прежние.`);
  };
  /* v0.299: правый щелчок — прежние биты текущего шаблона и записанные меняются местами (ещё раз — снова записанные) */
  $("bTplSave").oncontextmenu = (e) => {
    e.preventDefault();
    const t = tplCurT(); if (!t) { say("💾 Текущего шаблона нет — возвращать нечего."); return; }
    if (!t.prev || !Array.isArray(t.prev.rows) || !t.prev.rows.length) { say(`💾 У «${t.name}» прежней версии нет — «💾 Сохр» в него ещё не писал.`); return; }
    const was = { rows: t.rows, name: t.name };
    t.rows = t.prev.rows; t.name = t.prev.name || t.name; t.prev = was;
    renderTpl(); renderRows(); save();
    say(`💾 Шаблон «${t.name}» — прежние биты (${t.rows.length} стр.). Правый щелчок ещё раз — снова записанные.`);
  };
  const cutUi = () => {   // v0.225: кнопки достройки под чертой
    const m = Z.cutGen || "r90";
    $("cutMask").value = Z.cutMask || "01";
    $("bBar").classList.toggle("on", !!Z.barOn); { const [l, r] = barLR(); $("barL").value = l; $("barR").value = r; }   // v0.241: стенка; v0.357 — два столба
    /* v0.286, по снимку «Заменить» и «⤒ из-под черты», горящих вместе, — «они вместе не могут быть включены, нелогично»: при «из-под черты»
       строки под чертой сперва возвращаются, и к достройке под чертой пусто — заменять нечего. Теперь одна или другая: включил одну —
       другая гаснет. Сохранённое не переписывается: при «из-под черты» «Заменить» показана выключенной (так она и работает). */
    cutHidUi();   // v0.288: подсветка — только когда под чертой что-то есть
  };
  const cutPick = (m, what) => { Z.cutGen = m; Z.cutTake = false; cutUi(); save(); say(`⎯ Тянешь черту вниз — строки достраиваются от верхней: ${what}. «⤒ Из-под черты» выключено.`); };   // v0.361: либо-либо
  $("bCutR90").onclick = () => cutPick("r90", "🔺 Серп 90 (правило 90, на 2 бита длиннее)");
  $("bCutR30").onclick = () => cutPick("r30", "правило 30 (на 2 бита длиннее)");
  $("bCutMask").onclick = () => cutPick("mask", `маска ${Z.cutMask || "01"} подряд (на бит длиннее)`);
  $("cutMask").onchange = (e) => { const v = e.target.value.replace(/[^01]/g, ""); Z.cutMask = v || "01"; e.target.value = Z.cutMask; Z.cutGen = "mask"; Z.cutTake = false; cutUi(); save(); say(`⎯ Маска достройки — ${Z.cutMask}.`); };
  $("bBar").onclick = () => { Z.barOn = !Z.barOn; cutUi(); save(); wallMark();   // v0.353: ▮ Столб — и подсветка в строках
    say(Z.barOn ? (barOffs().length ? `▮ Столб: ${barLab()} от вершины заморожено — держит начальное значение; достройка и заготовки Аниматрицы строятся с ним.` : "▮ Столб включён, но оба поля — 0: столбов нет. Задай, сколько бит влево и вправо от вершины.") : "▮ Столб снят — правила как есть."); };
  for (const [id, k] of [["barL", "barL"], ["barR", "barR"]]) $(id).onchange = (e) => {   // v0.357: слева и справа от вершины; 0 — нет
    barLR(); const v = Math.round(+e.target.value); Z[k] = Number.isFinite(v) ? Math.max(0, Math.min(512, v)) : 0; cutUi(); save(); wallMark();
    say(barOffs().length ? `▮ Столб: ${barLab()} бит от вершины (◀ — влево, ▶ — вправо).` : "▮ Столбов нет: оба поля — 0.");
  };
  $("bCutTake").onclick = () => { Z.cutTake = Z.cutTake === false; cutUi(); save();   // v0.253; v0.286: вкл — «Заменить» гаснет
    say((Z.cutTake !== false ? "⤒ Из-под черты — вкл: тянешь черту вниз — сперва возвращаются строки, что под ней, потом достраиваются новые." : "⤒ Из-под черты — выкл: черта вниз сразу достраивает новые строки, а те, что были под чертой, сдвигаются ниже.") + cutHidEmpty()); };
  const cutHidEmpty = () => hidCount() ? "" : " Под чертой сейчас пусто — подсветится, когда там будут строки.";   // v0.288
  $("bCutClr").onclick = () => {   // v0.245, «и кнопку — стереть всё под линией»: строки за чертой — насовсем, во всех полях; ↩ вернёт
    const n = hidCount(); if (!n) { say("🗑 Под чертой и так пусто."); return; }
    const pre = undoState(); Z.lanesHid = []; undoPush(pre); renderAll(); save();
    say(`🗑 Стёрто ${n} стр. под чертой. ↩ вернёт.`);
  };
  cutUi();
  const TRI_ORD = TRI_ORDERS;   // v0.234: ✂ нарезка; v0.237: все фигуры и порядки, щелчок — дальше, правый — назад
  const triUi = () => { $("bTriOrd").textContent = TRI_ORD[Z.triOrd] || TRI_ORD.rows; $("bTriUnit").textContent = TRI_UNITS[Z.triUnit] || TRI_UNITS.up; $("bTriEmpty").classList.toggle("on", Z.triSkip !== false); $("triH").value = Z.triH || 16; };
  triUi();
  const triCycle = (key, dict, def, dir) => { const k = Object.keys(dict); Z[key] = k[(k.indexOf(Z[key] || def) + dir + k.length) % k.length]; triUi(); save(); };
  $("bTriOrd").onclick = () => triCycle("triOrd", TRI_ORD, "rows", 1);
  $("bTriOrd").oncontextmenu = (e) => { e.preventDefault(); triCycle("triOrd", TRI_ORD, "rows", -1); };
  $("bTriUnit").onclick = () => triCycle("triUnit", TRI_UNITS, "up", 1);
  $("bTriUnit").oncontextmenu = (e) => { e.preventDefault(); triCycle("triUnit", TRI_UNITS, "up", -1); };
  $("bTriEmpty").onclick = () => { Z.triSkip = Z.triSkip === false; triUi(); save(); };
  $("triH").onchange = (e) => { Z.triH = Math.max(2, Math.min(256, Math.round(+e.target.value) || 16)); triUi(); save(); };
  $("bTriCut").onclick = () => {
    syncLane(); const h = Z.triH || 16, U = TRI_UNITS[Z.triUnit] || TRI_UNITS.up, R = triCut(Z.rows.slice(), h, Z.triOrd || "rows", Z.triSkip !== false, Z.triUnit || "up");
    if (R.err) { say(R.err); return; }
    if (!R.rows.length) { say(`✂ ${U}: при высоте ${h} кусков нет или все из одних нулей (выключи «без пустых»).`); return; }
    try { snapshot(); } catch (err) { return; }
    Z.rows = R.rows; syncLane(); Z.cur = 0; renderAll(); save();
    say(`✂ Нарезано: ${U} — ${R.items.length} шт., высота ${h} (${R.bands} полос, строки +${R.g}), ${TRI_ORD[Z.triOrd || "rows"]} — друг под другом, ${R.rows.length} стр. ↩ вернёт.`);
  };
  // v0.300, «шаблоны — только все строки, а не по одной»: «＋ Строка» (сохранить одну строку шаблоном) снята
  // Разделитель поля и окон: ширина поля в пикселях, двойной щелчок — по умолчанию.
  const applyRowsW = () => { if (Z.rowsW > 0) $("main").style.setProperty("--rowsW", Z.rowsW + "px"); else $("main").style.removeProperty("--rowsW"); };
  applyRowsW();
  /* v0.218, по снимку подсказки разделителя «Потяни — шире или уже…» — «границу для перетаскивания убери, функцию будет выполнять столбик
     номеров, подсвечивать немного при наведении»: разделителя нет; ширину поля строк меняет столбик номеров — тянешь его по горизонтали
     (дальше 6 px и больше вбок, чем вверх-вниз), короткий щелчок по номеру, замку, кручению — как был. */
  /* v0.224, «за саму границу тоже надо перетаскивать»: тот же жест — у невидимой полосы #fieldEdge (6 px у края поля со стороны стола). */
  const rowsWDrag = (e, list, strict) => {
    const x0 = e.clientX, y0 = e.clientY, w0 = $("field").getBoundingClientRect().width;
    /* v0.232, «после максимального уменьшения поле должно уезжать вправо и оставлять только немного — размер кнопок»: самое узкое поле —
       колонка номеров с кнопками ↺ 🔒 ⟲ над ней (прежде упор — 220 px); остальное уходит за край. */
    const nr = document.querySelector("#rowList .rw[data-r] > .no"), fl = $("field").getBoundingClientRect().left;
    const minW = nr ? Math.max(60, Math.ceil(nr.getBoundingClientRect().right - fl) + 8) : 100;
    const sg = document.body.classList.contains("field-right") ? -1 : 1;   // v0.091: поле справа — тянешь влево, поле шире
    /* v0.269, по снимку сжатого поля — «зависание при перетаскивании за границу: курсор уже отпустил, а она сама двигается и всё
       тормозит»: на 180 строках каждый шаг ширины — 1–2 с (раскладка и отрисовка всего поля, подгонка шага строк, кнопки над столбиками),
       и граница догоняла мышь уже после отпускания. Теперь ширина ставится не чаще кадра, подгонки — один раз, когда отпустили; а если
       кадр всё равно дольше 0,1 с — дальше поле не перекладывается, граница идёт за мышью тонкой чертой, ширина — когда отпустили. */
    /* v0.271, «тормоза от этой границы остались — граница отдельно от курсора тянется иногда»: (1) нажал на номер, повёл вниз (не вбок)
       и отпустил вне поля — «отпущено» до поля не доходило, слушатели оставались, и следующее движение над полем тянуло границу без
       нажатой кнопки. Теперь «отпущено» ловится на всём окне, а движение без нажатой кнопки сразу заканчивает протяжку. (2) Поле во время
       протяжки больше не перекладывается совсем: за мышью идёт тонкая черта (там встанет граница), ширина — когда отпустили. */
    const fr = $("field").getBoundingClientRect();
    let on = false, lastX = x0, raf = 0, ghost = null, done = false;
    const wAt = () => Math.max(minW, Math.min(window.innerWidth - 520, Math.round(w0 + sg * (lastX - x0))));
    const ghostAt = () => {
      raf = 0; if (!on) return;
      if (!ghost) { ghost = document.createElement("div"); ghost.id = "wGhost"; document.body.appendChild(ghost); }
      const w = wAt(), x = sg > 0 ? fr.left + w : fr.right - w;
      ghost.style.cssText = `left:${Math.round(x) - 1}px;top:${Math.round(fr.top)}px;height:${Math.round(fr.height)}px`;
    };
    const move = (ev) => {
      if (!(ev.buttons & 1)) { up(); return; }   // кнопку уже отпустили — протяжки нет
      const dx = ev.clientX - x0;
      if (!on) { if (strict && (Math.abs(dx) < 6 || Math.abs(dx) < Math.abs(ev.clientY - y0))) return; on = true; try { list.setPointerCapture(ev.pointerId); } catch (er) { /* отпущен */ } document.body.classList.add("wdrag"); wShield(true); }
      lastX = ev.clientX;
      if (!raf) raf = requestAnimationFrame(ghostAt);
    };
    const up = () => {
      if (done) return; done = true;
      list.removeEventListener("pointermove", move); list.removeEventListener("pointerup", up); list.removeEventListener("pointercancel", up);
      removeEventListener("pointerup", up, true); removeEventListener("pointercancel", up, true); removeEventListener("blur", up);
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      if (ghost) { ghost.remove(); ghost = null; }
      if (!on) return;
      on = false; wShield(false);
      Z.rowsW = wAt(); applyRowsW();
      document.body.classList.remove("wdrag"); packWins(); save(); renderPointers(); rowsFit(); fieldInfoFit();
      const kill = (ev) => { ev.stopPropagation(); ev.preventDefault(); };   // тянули — это не щелчок по номеру
      window.addEventListener("click", kill, { capture: true, once: true }); setTimeout(() => window.removeEventListener("click", kill, true), 0);
    };
    list.addEventListener("pointermove", move); list.addEventListener("pointerup", up); list.addEventListener("pointercancel", up);
    addEventListener("pointerup", up, true); addEventListener("pointercancel", up, true); addEventListener("blur", up);   // отпустили где угодно — конец
    /* v0.386, по снимку подсказки границы — «при перетаскивании влево также сначала покажи границу, куда упадёт»: хватаешь видимую черту
       (у поля справа она на левом краю 10-пиксельной полосы) и ведёшь наружу — мышь с первого же движения уходит с полосы, движения ей больше
       не приходят, протяжка не начиналась: ни черты, ни новой ширины (внутрь — вправо — работало). Теперь полоса держит мышь с самого
       нажатия, и черта идёт за ней в обе стороны */
    if (!strict) { try { list.setPointerCapture(e.pointerId); } catch (er) { /* отпущен */ } }
  };
  // v0.274, «перетаскивание за номера убери — там сейчас есть граница»: ширину поля меняет только граница #fieldEdge (номера — снова просто
  // выбор строки); двойной щелчок по границе — ширина по умолчанию (прежде — по номеру, v0.237)
  $("fieldEdge").addEventListener("pointerdown", (e) => { if (e.button !== 0) return; e.preventDefault(); rowsWDrag(e, $("fieldEdge"), false); });
  $("fieldEdge").addEventListener("dblclick", () => { Z.rowsW = 0; applyRowsW(); save(); packWins(); renderPointers(); rowsFit(); fieldInfoFit(); say("↔ Ширина поля строк — по умолчанию."); });
  // v0.091: ⇆ поле строк справа — окна слева
  /* v0.094, «и все остальные кнопки в левом режиме убрать под меню левое» (снимок: стопка свёрнутых шапок окон): при «⇆ поле
     справа» свёрнутые окна не стоят на столе, а кнопками — в левой панели под шаблонами; щелчок — развернуть окно на стол. */
  window.parkSync = () => {
    const on = !!Z.fieldRight, list = [];
    document.querySelectorAll(".win").forEach(el => {
      if (el.id === "w-help" || el.classList.contains("popped") || el.classList.contains("docked")) return;
      const parked = on && el.classList.contains("collapsed");
      if (parked) { el.style.display = "none"; el.dataset.parked = "1"; list.push(el); }
      else if (el.dataset.parked) { el.style.display = ""; delete el.dataset.parked; }
    });
    $("paneWinsHead").style.display = list.length ? "" : "none";
    $("paneWins").innerHTML = list.map(el => `<button data-w="${el.id}" title="Развернуть окно «${esc(el.dataset.title || el.id)}» на стол">${esc(el.dataset.title || el.id)}</button>`).join("");
    pwArrows();
  };
  /* v0.397: светящиеся ▲ ▼ у списка окон — горят, пока выше / ниже есть кнопки за краем; щелчок листает на ¾ видимого */
  function pwArrows(){
    const P = $("paneWins"), bx = $("paneWinsBox"); if (!P || !bx) return;
    const top = P.scrollTop > 2, bot = P.scrollTop + P.clientHeight < P.scrollHeight - 2;
    bx.querySelector(".pwArr.up").classList.toggle("on", top);
    bx.querySelector(".pwArr.dn").classList.toggle("on", bot);
  }
  $("paneWins").addEventListener("scroll", pwArrows, { passive: true });
  if (window.ResizeObserver) new ResizeObserver(pwArrows).observe($("paneWins"));
  document.querySelectorAll("#paneWinsBox .pwArr").forEach(a => a.addEventListener("click", () => {
    const P = $("paneWins"); P.scrollBy({ top: (a.classList.contains("up") ? -1 : 1) * Math.max(40, P.clientHeight * 0.75), behavior: "smooth" });
  }));
  $("paneWins").onclick = (e) => {
    const b = e.target.closest("button[data-w]"); if (!b) return;
    const el = $(b.dataset.w), w = Z.win[b.dataset.w]; if (!el || !w) return;
    w.collapsed = false; el.classList.remove("collapsed"); el.style.height = w.h + "px";
    parkSync(); Z.z++; el.style.zIndex = Z.z; packWins(); save(); renderAll();
    el.scrollIntoView({ block: "nearest" });
  };
  const sideUi = () => { document.body.classList.toggle("field-right", !!Z.fieldRight); $("bFieldSide").classList.toggle("on", !!Z.fieldRight);
    $("bFieldSide").textContent = Z.fieldRight ? "⇆ строки слева" : "⇆ строки справа"; };   // v0.412, «строки — слева»: подпись — куда переставит щелчок
  sideUi(); requestAnimationFrame(() => { parkSync(); packWins(); });
  $("bFieldSide").onclick = () => { Z.fieldRight = !Z.fieldRight; sideUi(); parkSync(); save(); requestAnimationFrame(() => { packWins(); renderAll(); renderPointers(); });
    say(Z.fieldRight ? "⇆ Окна слева, поле строк справа. Окно, прикреплённое под полем, перетащи за шапку на левую сторону — встанет среди окон." : "⇆ Поле строк снова слева."); };
  /* v0.109, «кнопка свернуть поле строк»: поле строк прячется целиком, окна берут его место (стол шире — окна раскладываются
     заново по ширине: «⤒ К верху» и ужатие по краю работают как при разделителе). Строки живут дальше — меняются кнопками
     слева и окнами; вернуть поле — ещё раз. Запоминается. */
  const hideUi = () => { document.body.classList.toggle("field-hidden", !!Z.fieldHidden); $("bFieldHide").classList.toggle("on", !!Z.fieldHidden); };
  hideUi();
  $("bFieldHide").onclick = () => { Z.fieldHidden = !Z.fieldHidden; hideUi(); save(); requestAnimationFrame(() => { packWins(); renderAll(); renderPointers(); });
    say(Z.fieldHidden ? "▭ Поле строк свёрнуто — окна на всю ширину. Строки те же; вернуть — ещё раз «▭ поле строк»." : "▭ Поле строк снова на месте."); };
  if ($("rowInput")) $("rowInput").addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const v = e.target.value.replace(/[^01]/g, "");
    if (!v) { say("Впиши строку из 0 и 1."); return; }
    if (e.shiftKey) { snapshot(); Z.rows[Z.cur] = v; renderAll(); save(); say(`Строка ${Z.cur + 1} заменена.`); }
    else insertBelow(v, `Добавлена строка ${Z.cur + 2}.`);
    e.target.value = "";
  });
  // Файл: кнопка, перетаскивание на страницу, вставка нескольких строк в поле
  $("bLoad").onclick = () => $("fileIn").click();
  $("fileIn").onchange = (e) => { readFile(e.target.files[0]); e.target.value = ""; };
  $("bSaveTxt").onclick = saveRowsTxt;
  $("bSaveAll").onclick = saveSession;   // v0.115
  $("bHome").onclick = homeSave; $("bHome").oncontextmenu = (e) => { e.preventDefault(); homeForget(); }; homeBtn();   // v0.125
  $("bLoadAll").onclick = () => $("fileAll").click();
  $("fileAll").onchange = (e) => { readFile(e.target.files[0]); e.target.value = ""; };
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
  if ($("rowInput")) $("rowInput").addEventListener("paste", (e) => {
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
  // v0.308, «отсюда удали дубли»: 🎲 Случ. и ● Зерно в «Построениях» сняты — их делают заготовки 🎲 Случ. и ● 1
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
  $("orbitSub").addEventListener("change", () => renderLiveRest());   // v0.045
  $("orbitOut").onclick = (e) => { const h = e.target.closest(".hit"); if (!h) return; Z.cur = +h.dataset.r; renderAll(); save(); };
  // v0.065: 🔁 Инверсия и ⇄ Реверс — над выделенными строками, ничего не выделено — над текущей
  const rowsOp = (f, name) => {
    const idx = rowSel.size ? Array.from(rowSel).filter(i => i < Z.rows.length) : [Z.cur];
    const sel = idx.slice();
    snapshot();
    idx.forEach(i => { Z.rows[i] = f(Z.rows[i]); });
    sel.forEach(i => rowSel.add(i));   // выделение остаётся — можно жать дальше
    renderAll(); save();
    say(idx.length > 1 ? `${name}: строк ${idx.length}. ↩ вернёт.` : `${name}: строка ${idx[0] + 1}. ↩ вернёт.`);
  };
  $("bRowInv").onclick = () => rowsOp(zzInv, "🔁 Инверсия");
  $("bRowRev").onclick = () => rowsOp(zzRev, "⇄ Реверс");
  // v0.072, «инверсия второй половины строки»: правая половина наоборот; у нечётной длины средний бит на месте
  $("bRowInvHalf").onclick = () => rowsOp(s => { const h = Math.ceil(s.length / 2); return s.slice(0, h) + zzInv(s.slice(h)); }, "🔁½ Инверсия второй половины");
  /* v0.069, «Инверсия * только неподвижных»: переворачиваются только неподвижные биты — по тому режиму, что выбран у
     «неподв.» (выкл и 🔴 — неподвижные при развороте, 🟢 — при реверс-инверсии). Заметь: инверсия неподвижных при
     развороте даёт ровно реверс-инверсию строки (пара «a a» → «ā ā», пара «a ā» стоит — это и есть ⇄🔁), так же как
     «Инв меняющихся» в зеркале даёт разворот. */
  $("bRowInvFix").onclick = () => rowsOp(s => { let o = ""; for (let i = 0; i < s.length; i++) o += fixAt(s, i) ? (s[i] === "1" ? "0" : "1") : s[i]; return o; },
    Z.showFix === "ir" ? "🔁* Инверсия неподвижных при реверс-инверсии" : "🔁* Инверсия неподвижных (вышла реверс-инверсия строки)");
  // v0.306, «удали её»: кнопка «✕ Удалить» (текущую строку) снята — строки удаляет Del по выделенным (deleteSelection)
  $("bClear").onclick = () => { snapshot(); Z.rows = ["1"]; Z.cur = 0; renderAll(); save(); say("🧹 Столбик очищен (↩ Ctrl+Z вернёт)."); };
  // v0.123, «вернуть сами биты всех строк к начальному набору (1, 11, 101…)» — «это»: столбик — снова начальный; хвост за чертой
  // рабочего поля тоже убирается (иначе черта вернула бы прежние строки под начальными).
  $("bRowsStart").onclick = () => {
    try { snapshot(); } catch (err) { if (err.message === "ZZ_LOCK") return; throw err; }
    const H = Z.home;
    if (H) {   // v0.125: своё умолчание (⭐) — биты всех полей, как запомнены
      if (Array.isArray(H.lanes) && H.lanes.length) {
        Z.lanes = H.lanes.map(l => l.slice()); Z.laneCount = H.laneCount || 1; Z.lane = H.lane | 0;
        Z.lanesHid = Array.isArray(H.lanesHid) ? H.lanesHid.map(l => l.slice()) : [];
        Z.axisPos = Array.isArray(H.axisPos) ? H.axisPos.slice() : [];
      } else { Z.lanes = [H.rows.slice()]; Z.laneCount = 1; Z.lane = 0; Z.lanesHid = []; }
      Z.cur = H.cur | 0; Z.fillCells = H.fillCells ?? null;
      laneInit();
      const lc = document.getElementById("laneCount"); if (lc) lc.value = String(Z.laneCount);
      renderAll(); save();
      const L = Z.lanes.slice(0, Z.laneCount);
      say(`↺ Начальные — из умолчания ⭐: полей ${L.length}, строк ${L.reduce((s, l) => s + l.length, 0)}. ↩ вернёт прежние.`);
      return;
    }
    Z.rows = ZZ_ROWS0.slice(); Z.cur = 0;
    if (Array.isArray(Z.lanesHid)) Z.lanesHid[Z.lane] = [];
    renderAll(); save();
    say(`↺ Начальные строки: ${ZZ_ROWS0.length} — от «1» до «${ZZ_ROWS0[ZZ_ROWS0.length - 1]}». ↩ вернёт прежние. Своё умолчание — ⭐ в шапке.`);
  };

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
  $("cycOp").onchange = (e) => { Z.cycOp = e.target.value; save(); renderLiveRest(); };   // v0.045: живое
  $("cycHeat").onchange = (e) => { Z.cycHeat = e.target.checked; save(); if ($("cycView").innerHTML) runCycle(); };
  $("bCycle").onclick = runCycle;
  // GF(2)
  $("gf2Op").onchange = (e) => { Z.gf2Op = e.target.value; save(); renderLiveRest(); };
  $("gf2T").onchange = (e) => { Z.gf2T = Math.max(1, Math.floor(+e.target.value || 1)); save(); renderLiveRest(); };
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
  $("thruMode").onchange = (e) => { Z.thruMode = e.target.value; Z.tapeMode = "thru"; save(); renderLiveRest(); };
  $("bThru").onclick = () => { Z.tapeMode = "thru"; save(); runThru(); };   // v0.045: окно ленты живёт в последнем выбранном режиме
  $("bDecim").onclick = () => { Z.tapeMode = "decim"; save(); runDecim(); };

  // ⇉ Манчестерский код (v0.007): одна кнопка, левый щелчок — сделать, правый — режим по кругу.
  const MAN_CAP = 1 << 20;
  const manLabel = () => {
    const b = $("bMan");
    b.textContent = Z.manMode === "dec" ? "⇇ Раскод" : "⇉ Код";   // v0.153: коротко, правило (1→10, 0→01) — в подсказке
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
  $("bBwt").onclick = () => runBwt();
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
  const fsStep = (d) => { Z.fs = Math.max(11, Math.min(40, (Z.fs | 0 || 18) + d)); $("fsVal").textContent = Z.fs; renderAll(); save(); };   // v0.217: ◀ ▶ вместо ползунка
  $("fsDn").onclick = () => fsStep(-1); $("fsUp").onclick = () => fsStep(1);
  /* v0.067, «Разложить не раскрывает окна; надо ещё кнопку Свернуть»: 📐 снова раскладывает и разворачивает все окна
     (как до v0.058), а сворачивание — отдельной кнопкой ▭: свернуть все; если все уже свёрнуты — развернуть все. */
  $("bLayout").onclick = () => {
    layoutAll(true); document.querySelectorAll(".win.maxed").forEach(el => el.classList.remove("maxed"));   // v0.060: ⛶ сбрасывается раскладкой
    packWins(); save(); renderPointers(); renderAll();
    say("📐 Окна разложены по местам и развёрнуты. ▭ — свернуть все.");
  };
  $("bCollapseAll").onclick = () => {
    const wins = Array.from(document.querySelectorAll(".win")).filter(el => el.id !== "w-help" && !el.classList.contains("popped") && el.style.display !== "none" && Z.win[el.id]);
    const open = wins.some(el => !el.classList.contains("collapsed"));
    wins.forEach(el => { const w = Z.win[el.id]; w.collapsed = open; el.classList.toggle("collapsed", open); if (!open) el.style.height = w.h + "px"; });
    parkSync(); packWins(); save(); if (!open) renderAll();
    say(open ? "▭ Все окна свёрнуты — развернуть: двойной щелчок по шапке, ▭ ещё раз — все." : "▭ Все окна развёрнуты.");
  };
  $("bUndo").onclick = undo;
  $("bRedo").onclick = redo;   // v0.158
  // v0.015: ⤒ окна к верху — вкл/выкл
  const packLabel = () => $("bPack").classList.toggle("on", !!Z.pack);
  packLabel();
  $("bPack").onclick = () => { Z.pack = !Z.pack; packLabel(); packWins(); save(); say(Z.pack ? "⤒ Окна прижимаются к верху." : "⤒ Выключено: окна стоят там, где их поставили."); };
  $("bTheme").onclick = () => { Z.theme = themeIsLight() ? "dark" : "light"; applyTheme(); save(); renderAll(); };
  /* v0.496, «тест: вообще убрать обводку — прозрачной сделать»: ▱ в шапке — обводки в группах (кнопки, ползунки, заголовки, рамки групп, кольца
     конструктора) другие или как были. Z.noLn, по умолчанию — включено. v0.497, «сделай её в цвет фона холста»: не прозрачные, а цветом фона (tzLnBg) */
  if (Z.noLn === undefined) Z.noLn = true;
  const lnUi = () => { document.documentElement.classList.toggle("noln", !!Z.noLn); $("bLn").classList.toggle("on", !Z.noLn);
    $("bLn").title = Z.noLn ? "▱ Обводки кнопок — толще, цветом фона холста (рамка группы — её цветом); щелчок — цветом группы" : "▱ Обводки кнопок — цветом группы; щелчок — цветом фона холста"; };
  lnUi();
  $("bLn").onclick = () => { Z.noLn = !Z.noLn; lnUi(); save(); if (typeof triTag === "function") triTag(); if (typeof tzcAll === "function") tzcAll(); say(Z.noLn ? "▱ Обводки — цветом фона холста." : "▱ Обводки — цветом группы."); };
  // v0.367: «🎨» в шапке — вызов группы «Гамма» (закрыта / свёрнута / не видна — открыть, открыта — закрыть); правый щелчок — следующая гамма
  $("bPal").onclick = () => { if (!window.cgrpShow) { palStep(1); return; } if (cgrpShown("гамма")) cgrpHide("гамма"); else cgrpShow("гамма"); palUi(); };
  $("bPal").oncontextmenu = (e) => { e.preventDefault(); palStep(1); };
  document.querySelectorAll(".cg-pal button[data-pal]").forEach(b => b.onclick = () => {
    Z.pal = +b.dataset.pal; palApply(); save(); renderAll(); say(`🎨 Гамма «${ZZ_PALS[Z.pal].name}».` + (Z.pal ? "" : " Цвета 1, 0 и акцента — рядом; правый щелчок — цвета страницы.")); });
  { const b0 = document.querySelector('.cg-pal button[data-pal="0"]');   // v0.370: правый щелчок по «Настраиваемой» — цвета страницы
    if (b0) b0.oncontextmenu = (e) => { e.preventDefault(); if (Z.palCust) delete Z.palCust[palTheme()]; Z.pal = 0; palApply(); save(); renderAll(); say("🎨 Своя — цвета страницы (для этой темы)."); }; }
  { let raf = 0;   // v0.370: свои цвета «Настраиваемой»: 1, 0, акцент — для нынешней темы; тянешь в выборе цвета — меняется сразу
    [["palC1", 0], ["palC0", 1], ["palCa", 2]].forEach(([id, i]) => { const el = $(id); if (!el) return;
      el.oninput = () => { const t = palTheme(); if (!Z.palCust || typeof Z.palCust !== "object") Z.palCust = {}; const c = palColors((Z.pal | 0) % ZZ_PALS.length).slice(); c[i] = el.value; Z.palCust[t] = c; Z.pal = 0; palApply();   // v0.500: правка на другой гамме — её цвета с правкой уходят в «Свою»
        if (!raf) raf = requestAnimationFrame(() => { raf = 0; renderAll(); }); };
      el.onchange = () => { save(); say(`🎨 Своя: ${["единицы", "нули", "акцент"][i]} — ${el.value}.`); }; }); }
  palUi();
  if (window.matchMedia) matchMedia("(prefers-color-scheme: light)").addEventListener("change", () => { if (!Z.theme) { palApply(); renderAll(); } });
  // v0.035: левая панель значками — переключатель и слежение за перерисованными кнопками
  $("bPaneIcons").onclick = () => { Z.paneIcons = !Z.paneIcons; applyPaneIcons(); save(); packWins(); };
  new MutationObserver(() => { if (Z.paneIcons) iconizePane(); }).observe($("rowsPane"), { childList: true, subtree: true, characterData: true });
  $("bHelp").onclick = () => { Z.helpOn = !Z.helpOn; layoutAll(false); save(); };

  // Клавиши: ↑/↓ — по строкам, Ctrl+Z — отмена (не в полях ввода).
  // v0.012: Del/Backspace — удалить выделенное, Ctrl+A — выделить все строки, Esc — снять выделение.
  document.addEventListener("keydown", (e) => {
    const t = e.target;
    if (e.key === "Escape" && document.body.classList.contains("zen")) { e.preventDefault(); zenSet(false); return; }   // v0.105: выйти из дзена
    if (document.body.classList.contains("zen") && !e.ctrlKey && !e.altKey && !e.metaKey) {   // v0.176, «кнопками стрелки»: в дзене стрелки двигают вид, + − — масштаб к центру
      const d = 40 * (window.devicePixelRatio || 1) * (e.shiftKey ? 4 : 1), mvK = { ArrowLeft: [d, 0], ArrowRight: [-d, 0], ArrowUp: [0, d], ArrowDown: [0, -d] }[e.key];
      if (mvK) { e.preventDefault(); conePan = [conePan[0] + mvK[0], conePan[1] + mvK[1]]; renderCone(); return; }
      const zk = { "+": 1.2, "=": 1.2, "-": 1 / 1.2, "_": 1 / 1.2 }[e.key];
      if (zk) { e.preventDefault(); const z1 = Math.max(0.3, Math.min(60, coneZoom * zk)), q = z1 / coneZoom; conePan = [conePan[0] * q, conePan[1] * q]; coneZoom = z1; renderCone(); return; }
    }
    /* v0.099, «Esc — снять выделение со строк всех»: Esc работает и тогда, когда фокус на галке, выборе или кнопке (после щелчка
       в окнах клавиша прежде пропускалась); из поля ввода Esc сперва уводит фокус. */
    if (e.key === "Escape" && t && t.closest && t.closest("input, select, textarea")) { if (t.matches("input[type=text], input[type=number], input:not([type]), textarea")) t.blur(); }
    else if (t && t.closest && t.closest("input, select, textarea")) return;
    if ((e.ctrlKey || e.metaKey) && (e.key === "y" || e.key === "н" || (e.shiftKey && (e.key === "Z" || e.key === "Я" || e.code === "KeyZ")))) { e.preventDefault(); redo(); return; }   // v0.158: ↪
    if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "я")) { e.preventDefault(); undo(); return; }
    if ((e.key === "Delete" || e.key === "Backspace") && axSel >= 0 && Z.laneCount > 1 && Z.laneView === "over") { e.preventDefault(); deleteLane(axSel); return; }   // v0.022
    if (e.key === "Escape" && axSel >= 0) { axSel = -1; renderRows(); say("Выделение оси снято."); return; }
    if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); deleteSelection(); return; }
    if ((e.ctrlKey || e.metaKey) && (e.key === "a" || e.key === "ф" || e.key === "A" || e.key === "Ф")) {
      e.preventDefault(); clearTextSel();
      rowSel.clear(); Z.rows.forEach((_, k) => rowSel.add(k)); rowSelAnchor = 0;
      renderRows(); say(`Выделены все строки — ${Z.rows.length}. Del удалит, Ctrl+C скопирует, Esc снимет.`); return;
    }
    if (e.key === "Escape") {   // v0.106: снять выделение строк и погасить подсветку текущей
      const n = rowSel.size; rowSel.clear(); clearTextSel(); document.body.classList.add("nocur"); renderRows();
      if (n) say(`Выделение снято со всех строк (${n}).`); return;
    }
    if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && Z.laneCount > 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
      e.preventDefault(); switchLane((Z.lane + (e.key === "ArrowRight" ? 1 : Z.laneCount - 1)) % Z.laneCount); return;
    }
    if (e.key === "ArrowUp" || e.key === "ArrowDown") delAtEnd = false;   // v0.021
    if (e.key === "ArrowUp" && Z.cur > 0) { e.preventDefault(); Z.cur--; renderAll(); save(); }
    else if (e.key === "ArrowDown" && Z.cur < Z.rows.length - 1) { e.preventDefault(); Z.cur++; renderAll(); save(); }
  });

  renderAll();
  applyPaneIcons();   // v0.035: панель значками — как запомнено (шаблоны уже нарисованы)
  paneFoldInit();   // v0.310
  paneWheelInit();   // v0.323
  // Шрифт мог догрузиться позже — ширина ячейки бита изменится, скобки надо переложить.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => renderPointers());
  // v0.017: ширина стола известна только теперь (разделитель поставлен) — окна под неё; и при смене размера окна браузера.
  packWins(); save();
  try {   // v0.115: страница перезагрузилась после открытия файла сессии
    const sn = sessionStorage.getItem("zz_sess_loaded");
    if (ZZ_PRESET_FULL) {   // v0.196
      const t = ZZ_PRESET.title || ZZ_PRESET.name || "пресет";
      document.title = "Zazerkalius — " + t;
      say(`👁 Пресет «${t}»: крути и запускай — правки не запоминаются, по ссылке он всегда такой. Забрать себе — «💾 В файл», потом «📂 Из файла» на своей странице.`);
    }
    if (sn) { sessionStorage.removeItem("zz_sess_loaded"); say(`📂 Открыто «${sn}»: строки, поля и настройки — из файла; они же теперь умолчание (⭐).`); }
  } catch (e) {}
  let rsz = 0;
  window.addEventListener("resize", () => { clearTimeout(rsz); rsz = setTimeout(() => { packWins(); save(); }, 200); });
}
function bgApply(){   // v0.184: живой фон хаба (?solo=cone&bg=1)
  document.body.classList.add("zen", "zen-quiet", "bgmode", "nocur");
  if (ZZ_PRESET) {   // v0.185: пресет — как сохранён, только крутится
    rowSel.clear(); renderAll();
    if (!document.getElementById("bConeAuto").classList.contains("on")) $("bConeAuto").click();
    document.title = "Zerkalius Конус — " + (ZZ_PRESET.title || ZZ_PRESET.name || "пресет");
    return;
  }
  const r = ["1"]; while (r.length < 64) r.push(zzPascalNext(r[r.length - 1]));
  Z.rows = r; Z.cur = 0; rowSel.clear(); syncLane();
  Object.assign(Z, { cone3d: true, coneOcta: true, coneGlow: true, cone3H: 2.6, cone3El: 12, cone3Yaw: 30, coneSpin: 0, coneSpinMode: "all", coneAutoSp: 10,
    coneClock: false, coneSect: false, coneOnlySel: false, conePoly: false, coneRays: "off", coneMir: "off", coneLock: true });
  for (const [id, v] of [["cone3d", true], ["coneOcta", true], ["coneGlow", true], ["coneClock", false], ["coneSect", false], ["coneOnlySel", false], ["conePoly", false], ["coneSame", false]]) { const el = $(id); if (el) el.checked = v; }
  coneZoom = 1; conePan = [0, 0];
  renderAll();
  if (!document.getElementById("bConeAuto").classList.contains("on")) $("bConeAuto").click();
  try { if (window.parent !== window) window.parent.postMessage({ zerkReady: true }, "*"); } catch (e) { /* хаб с другого адреса */ }
}
init();
if (ZZ_BG) bgApply();
/* v0.346, по снимку списка «◫ по центру / ◧ влево / ◨ вправо» — «в три значка»: списки выравнивания (поле строк, Спуск, ⊿ Сложить) —
   тремя кнопками-значками слитной полоской; горит выбранная. Сам список остаётся (спрятан): его значение, события и память — прежние,
   кнопка лишь ставит значение и шлёт change; значение, выставленное из кода, кнопки подхватывают сами */
(function selIcons(){
  const hook = (sel, upd) => { const d = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");
    try { Object.defineProperty(sel, "value", { configurable: true, get() { return d.get.call(this); }, set(x) { d.set.call(this, x); upd(); } }); } catch (err) { /* хватит событий */ } };
  ["rowsAlign", "descentAlign", "foldAlign"].forEach((id) => {
    const sel = $(id); if (!sel || sel.dataset.seg) return; sel.dataset.seg = "1";
    const box = document.createElement("span"); box.className = "segi"; box.title = sel.title;
    const bs = [...sel.options].map((o) => { const t = o.textContent.trim(), sp = t.indexOf(" "), b = document.createElement("button");
      b.type = "button"; b.textContent = sp > 0 ? t.slice(0, sp) : t; b.title = sp > 0 ? t.slice(sp + 1) : t; b.dataset.v = o.value;
      b.onclick = () => { if (sel.value === o.value) return; sel.value = o.value; sel.dispatchEvent(new Event("change", { bubbles: true })); };
      box.appendChild(b); return b; });
    const upd = () => bs.forEach(b => b.classList.toggle("on", b.dataset.v === sel.value));
    sel.after(box); sel.hidden = true; sel.style.display = "none";
    hook(sel, upd); sel.addEventListener("change", upd); upd();
  });
})();
