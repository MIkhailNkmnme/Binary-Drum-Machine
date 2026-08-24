/* Zerkalius Fold — часть 5/5: ВИД И СТАРТ.
   Выравнивание паттернов, шрифты, межстрочный и межбуквенный, цвета и пресеты,
   перетаскивание и ширины колонок, ось и сплиттеры, настройки вида,
   saveCache/loadCache, тачпад, подсказки и вся стартовая навеска обработчиков.
   Подключается ПОСЛЕДНИМ, после fold-4-tools.js. */

/* ВЫРАВНИВАНИЕ ПОЛЕЙ ПАТТЕРНОВ (v0.971). Раньше это был просто text-align текста в ячейке, три
   положения (⇤/↔/⇥). Теперь П1 и П2 — ПОЛНОЦЕННЫЕ ПОЛЯ с той же геометрией, что и цепочка: кнопка
   гоняет по всему списку FIELD_ALIGNS (см. fold-1-core.js), включая обе лесенки и их "½", а
   отступ каждой строки печатается столбцами через alignShift() — отсюда и "треуголы".
   text-align (--pat-ta/--pat2-ta) при этом принудительно left: положение задаётся напечатанным
   отступом, и второе, конкурирующее правило только смазывало бы картинку. */
function applyPatAligns(){
  document.documentElement.style.setProperty("--pat-ta", "left");
  document.documentElement.style.setProperty("--pat2-ta", "left");
  // Бейдж номера шага при правом выравнивании резервирует место слева (см. body.pat-ta-right).
  document.body.classList.toggle("pat-ta-right", patAlign === "right");
  document.body.classList.toggle("pat2-ta-right", pat2Align === "right");
  const b1 = document.getElementById("bAlignPatL"), b2 = document.getElementById("bAlignPatR");
  if (b1) b1.textContent = FIELD_ALIGN_ICON[patAlign] || "⇤";
  if (b2) b2.textContent = FIELD_ALIGN_ICON[pat2Align] || "⇤";
  /* Отметка "act" в полосе выравниваний зависит от того, куда полоса сейчас бьёт (v0.976). Ставим
     её ИМЕННО ОТСЮДА: applyPatAligns() зовут все пути, меняющие выравнивание крайних полей, —
     кнопка-половинка ⇤, сама полоса при приёмнике П1/П2 и восстановление настроек из кэша
     (там patAlign/pat2Align приходят ПОЗЖЕ приёмника, и без этого вызова полоса подсветила бы
     выравнивание, которое уже сменилось). */
  if (typeof syncAlignActMarks === "function") syncAlignActMarks();
}
function cyclePatAlign(which){
  const cur = which === "l" ? patAlign : pat2Align;
  const field = which === "l" ? "L" : "R";
  let idx = FIELD_ALIGNS.indexOf(cur);
  if (idx < 0) idx = 0;
  // fieldAlignAllowed крайние поля не режет, но проверку зовём всё равно: запрет живёт в ОДНОМ
  // месте (CENTER_FIELD_LR_BAN), и если его когда-нибудь расширят на другие поля, цикл сам начнёт
  // их пропускать, а не разъедется с правилом.
  let next = cur;
  for (let k = 1; k <= FIELD_ALIGNS.length; k++) {
    const cand = FIELD_ALIGNS[(idx + k) % FIELD_ALIGNS.length];
    if (fieldAlignAllowed(field, cand)) { next = cand; break; }
  }
  if (which === "l") patAlign = next; else pat2Align = next;
  // applyPatAligns() заодно переставит отметку "act" в полосе, если та сейчас бьёт в это же поле
  // (см. alignTarget) — иначе кнопка-половинка и полоса разошлись бы в показаниях.
  applyPatAligns();
  render();
  saveCache();
}
/* ОТМЕТКА "act" В ПОЛОСЕ ВЫРАВНИВАНИЙ — ОДНО МЕСТО НА ВСЮ ПРОГРАММУ (v0.976). Раньше её ставил
   сам обработчик клика ("снять со всех, повесить на нажатую"), и это работало, пока полоса всегда
   правила центральное поле. Теперь у полосы есть ПРИЁМНИК (alignTarget): подсвечена должна быть
   кнопка того выравнивания, которое стоит У ПРИЁМНИКА, а не последняя нажатая. У крайних полей
   осевых выравниваний не бывает вовсе — при приёмнике П1/П2 кнопки ⊙/⊙½/↥/↥½ не подсвечены
   никогда, и это правильно: они адресованы цепочке. */
/* ВЫРАВНИВАНИЕ ГРУППЫ, КОТОРУЮ СЕЙЧАС ВЫДЕЛИЛИ (v0.977) — или null, если выделение не совпадает
   ровно с одной готовой группой. Нужно ТОЛЬКО для подсветки: пока выделены строки одной группы,
   в полосе должна гореть ЕЁ кнопка, а не выравнивание поля — иначе непонятно, что даст повторный
   клик (а он группу распускает). Частичное выделение группы или сборная солянка из разных групп
   подсветки не получают: назначать им всё равно придётся заново, целиком. */
function selectedRowsGroupAlign(){
  if (!st.selectedRows || st.selectedRows.size < 2) return null;
  const rows = Array.from(st.selectedRows);
  const g = rowGroupOfField(alignTarget, rows[0]);   // группа ТОГО поля, в которое сейчас бьёт полоса
  if (!g || g.rows.length !== rows.length) return null;
  for (const r of rows) if (rowGroupOfField(alignTarget, r) !== g) return null;
  return g.align;
}
function syncAlignActMarks(){
  const grp = document.getElementById("alignGrp");
  if (!grp) return;
  const cur = selectedRowsGroupAlign()
           || (alignTarget === "L" ? patAlign : (alignTarget === "R" ? pat2Align : st.align));
  grp.querySelectorAll("button[data-val]").forEach(b => {
    b.classList.toggle("act", b.getAttribute("data-val") === cur);
  });
}
/* ОБЩИЙ СДВИГ КРАЙНИХ ПОЛЕЙ в пикселях — из столбцов через РЕАЛЬНЫЙ шаг столбца (тот же, каким
   render() печатает отступы), поэтому сдвиг всегда попадает ровно в колонку, а не "примерно".
   Зовётся в конце render() (шаг меряется по уже отрисованным битам) и из самой протяжки. */
function applyPatOffsets(){
  const step = (typeof realColStepPx === "function" ? realColStepPx() : 0) || 8;
  const root = document.documentElement;
  root.style.setProperty("--pat-off-l", ((patOffL || 0) * step).toFixed(2) + "px");
  root.style.setProperty("--pat-off-r", ((patOffR || 0) * step).toFixed(2) + "px");
  /* ВЕРТИКАЛЬ (v0.982) — в ВЫСОТАХ СТРОКИ, а не в пикселях: сдвиг на одну строку обязан оставаться
     сдвигом на одну строку при любом кегле и любом межстрочном. Высота берётся из --row-h, её
     считает updateRowHeight() как round(кегль × межстрочный) — ровно та же величина, которой
     живут сами строки. */
  const rowH = parseFloat(getComputedStyle(root).getPropertyValue("--row-h")) || 12;
  root.style.setProperty("--pat-offy-l", ((patOffLY || 0) * rowH).toFixed(2) + "px");
  root.style.setProperty("--pat-offy-r", ((patOffRY || 0) * rowH).toFixed(2) + "px");
  root.style.setProperty("--bits-offy", ((bitsOffY || 0) * rowH).toFixed(2) + "px");
}
/* СТОПОР У ЛЕВОГО КРАЯ БРАУЗЕРА, А НЕ ОБРЕЗКА (v1.010, запрос пользователя: "биты попадая туда
   заходят за неё и упираются в границу браузера, каждая строка по-своему... не обрезать их, а
   стопорить"). Протяжка П1 мышью (pan.field==="L" в блоке "ТАЩИТЬ ПОЛЕ ЗА БИТЫ" ниже) уводит
   .pat-shift сколь угодно далеко влево (наезжать можно докуда угодно, см. v0.976) — без стопора
   она рано или поздно уезжает ЗА ФИЗИЧЕСКИЙ ЛЕВЫЙ КРАЙ ОКНА БРАУЗЕРА (x=0) и там просто обрезается
   вьюпортом, невидимо. НУЖНО СТОПОРИТЬ, А НЕ ДАВАТЬ ОБРЕЗАТЬ — и ПО КАЖДОЙ СТРОКЕ ОТДЕЛЬНО: строки
   могут отличаться (своё выравнивание, длина паттерна), поэтому самая левая точка — не общий
   счёт от patOffL, а РЕАЛЬНЫЙ getBoundingClientRect() каждого отрисованного .pat-shift.
   Зависимость патOffL→пиксели строго линейна (шаг = realColStepPx()), поэтому одной поправки
   ЦЕЛЫМИ столбцами хватает без цикла: если самая левая точка ушла в минус, отодвигаем patOffL
   вправо ровно настолько, чтобы она вернулась на 0 (с округлением вверх — лучше на пиксель левее
   от точной границы, чем снова пересечь её). */
function clampPatOffLLeftEdge(){
  const shifts = document.querySelectorAll("#rows .ln .pat > .pat-shift");
  if (!shifts.length) return;
  let minLeft = Infinity;
  shifts.forEach(el => { const l = el.getBoundingClientRect().left; if (l < minLeft) minLeft = l; });
  if (!(minLeft < 0)) return;
  const step = realColStepPx() || 8;
  patOffL = (patOffL || 0) + Math.ceil(-minLeft / step);
  applyPatOffsets();
}
/* СДВИНУТЬ ПОЛЕ НА N СТОЛБЦОВ / N СТРОК (v0.982). Одна точка входа для мыши, клавиатуры и сброса —
   иначе три способа двигать поле разошлись бы в мелочах (что считать шагом, кого перерисовывать).
   Центральному полю горизонталь — это st.axisCenterOffset, та же величина, что у ручки оси;
   вертикаль у всех трёх чисто визуальная и перерисовки не требует. */
function nudgeField(field, dCols, dRows){
  if (field === "C") {
    if (dCols) {
      st.axisCenterOffset = (st.axisCenterOffset || 0) + dCols;
      axisPinCol = axisBaseCol() + st.axisCenterOffset;
    }
    if (dRows) bitsOffY = (bitsOffY || 0) + dRows;
    if (dCols) { render(); } else { applyPatOffsets(); }
  } else if (field === "L") {
    patOffL = (patOffL || 0) + dCols;
    patOffLY = (patOffLY || 0) + dRows;
    applyPatOffsets();
  } else {
    patOffR = (patOffR || 0) + dCols;
    patOffRY = (patOffRY || 0) + dRows;
    applyPatOffsets();
  }
}
/* СДВИНУТЬ ВСЕ ТРИ ПОЛЯ РАЗОМ (v0.988) — клавиатурный аналог протяжки за пустое место холста
   (v0.985, "как горизонтальный скролл, сразу всех"). lastPanField встаёт в "ALL" тем же кликом
   вне полей и строк (см. canvasPanEl.mousedown в блоке протяжки ниже) — Alt+стрелки после такого
   клика попадают сюда, а не в nudgeField() одного поля. */
function nudgeAllFields(dCols, dRows){
  nudgeField("L", dCols, dRows);
  nudgeField("R", dCols, dRows);
  nudgeField("C", dCols, dRows);
}
const bAlignPatLEl = document.getElementById("bAlignPatL");
// e.detail >= 2 — второй (и далее) click той же двойной-клик-последовательности: цикл ей не
// достаётся, дальше идёт dblclick-сброс (см. dblReset выше) — иначе двойной клик успевал бы
// провернуть цикл на два шага ПЕРЕД тем, как поле вернётся на место.
if (bAlignPatLEl) bAlignPatLEl.onclick = e => { if (e.detail < 2) cyclePatAlign("l"); };
const bAlignPatREl = document.getElementById("bAlignPatR");
if (bAlignPatREl) bAlignPatREl.onclick = e => { if (e.detail < 2) cyclePatAlign("r"); };
applyPatAligns();
// Запрет левого/правого у центрального поля — сразу на старте: гасим кнопки и, если из кэша
// пришло запрещённое выравнивание, уводим поле на "по центру" (см. syncAlignBanned в fold-3).
if (typeof syncAlignBanned === "function") syncAlignBanned();
/* ═══ ОКНО «ℹ Поле» (v0.972, запрос пользователя: "убираем номера в подсказку — окно в меню,
   показывает текущее поле, строку, столбец, считает выделенные биты, отображает их") ═══
   Куда переехали номера строк из самих полей: в полях теперь только биты, а всё справочное —
   здесь. Показывает ПОД КУРСОРОМ: какое поле (П1 / Цепочка / П2), какая строка, какой столбец;
   и отдельно — сколько бит сейчас выбрано и какие именно.
   СТОЛБЕЦ СЧИТАЕТСЯ ГЕОМЕТРИЕЙ, А НЕ ПО data-col. Атрибут data-col render() проставляет только
   в режиме "▭ Выбор ячеек" (иначе на каждый бит пришлось бы по span'у — см. там же), а окно
   должно работать всегда. Меряем от левого края СОДЕРЖИМОГО поля тем же шагом колонки, каким
   render() печатает отступы (realColStepPx) — то есть ровно теми же столбцами, что видит глаз.
   Выбранные биты берутся из ДВУХ наборов: cellSel — "строка|СТОЛБЕЦ полотна" (центральное поле),
   patCellSel — "строка|индекс символа в тексте паттерна" (поля паттернов). Системы координат у
   них разные (см. их объявления в fold-1-core.js), поэтому и разбираются они по отдельности. */
var fieldInfoOn = false;
var fieldInfoAt = { field: null, row: null, col: null };

function fieldInfoLabel(f){
  return f === "L" ? "П1 (левое)" : (f === "R" ? "П2 (правое)" : (f === "C" ? "Цепочка (центр)" : "—"));
}
/* Биты центрального поля, лежащие в cellSel, — по возрастанию строки, затем столбца. Столбец
   переводится в индекс внутри строки тем же сдвигом, каким она напечатана (rowShiftFor). */
function fieldInfoSelectedBits(){
  const out = [];
  if (typeof cellSel !== "undefined" && cellSel.size) {
    let maxLen = 0;
    for (const s of st.rows) if (s && s.length > maxLen) maxLen = s.length;
    const keys = Array.from(cellSel).map(k => {
      const p = k.split("|");
      return { r: +p[0], c: +p[1] };
    }).sort((a, b) => a.r - b.r || a.c - b.c);
    for (const k of keys) {
      const s = st.rows[k.r] || "";
      if (!s.length) continue;
      const sh = rowShiftFor(maxLen, k.r, s, st.align);
      const idx = k.c - sh;
      out.push((idx >= 0 && idx < s.length) ? s[idx] : "·");
    }
  }
  if (typeof patCellSel !== "undefined" && patCellSel.size) {
    const keys = Array.from(patCellSel).map(k => {
      const p = k.split("|");
      return { r: +p[0], c: +p[1] };
    }).sort((a, b) => a.r - b.r || a.c - b.c);
    for (const k of keys) {
      const p = st.pats[k.r];
      const t = (p && p.text) ? p.text : "";
      out.push((k.c >= 0 && k.c < t.length) ? t[k.c] : "·");
    }
  }
  return out;
}
function updateFieldInfo(){
  const el = document.getElementById("fieldInfo");
  if (!el || !fieldInfoOn) return;
  const bits = fieldInfoSelectedBits();
  const at = fieldInfoAt;
  const rowTxt = (at.row == null) ? "—" : String(rowLabel(at.row));
  const colTxt = (at.col == null) ? "—" : String(at.col + 1);
  let html = '<span class="fi-field">' + fieldInfoLabel(at.field) + "</span>" +
             " · строка <b>" + rowTxt + "</b> · столбец <b>" + colTxt + "</b>" +
             " · выбрано бит: <b>" + bits.length + "</b>";
  if (bits.length) html += '<span class="fi-bits">' + bits.join("") + "</span>";
  el.innerHTML = html;
}
/* Курсор ходит по полям — ловим делегированно на всём полотне: строки перерисовываются каждым
   render(), вешать слушатель на каждую было бы бессмысленно. */
(function(){
  const sc = document.getElementById("screenCanvas");
  if (!sc) return;
  sc.addEventListener("mousemove", (e) => {
    if (!fieldInfoOn) return;
    const ln = e.target.closest && e.target.closest(".ln");
    if (!ln) { fieldInfoAt = { field: null, row: null, col: null }; updateFieldInfo(); return; }
    const row = +ln.getAttribute("data-idx");
    let host = e.target.closest(".bits"), field = "C";
    if (!host) { host = e.target.closest(".pat");  if (host) field = "L"; }
    if (!host) { host = e.target.closest(".pat2"); if (host) field = "R"; }
    if (!host) { fieldInfoAt = { field: null, row: row, col: null }; updateFieldInfo(); return; }
    // Отсчёт — от левого края СОДЕРЖИМОГО: у .bits это внутренняя обёртка (на ней висит
    // transform полушага/отрицательного сдвига, см. halfShiftAttr), у полей паттернов — сама
    // ячейка с её padding-left.
    const inner = (field === "C" && host.firstElementChild) ? host.firstElementChild : host;
    const rect = inner.getBoundingClientRect();
    const step = (typeof realColStepPx === "function" ? realColStepPx() : 0) || 1;
    const col = Math.floor((e.clientX - rect.left) / step);
    fieldInfoAt = { field: field, row: row, col: col >= 0 ? col : null };
    updateFieldInfo();
  });
  sc.addEventListener("mouseleave", () => {
    if (!fieldInfoOn) return;
    fieldInfoAt = { field: null, row: null, col: null };
    updateFieldInfo();
  });
})();
function applyFieldInfo(){
  document.body.classList.toggle("show-field-info", fieldInfoOn);
  // Номера строк живут в полях и уходят вместе с включением окна — в этом и смысл переноса
  // ("на полях чисто биты должны быть").
  document.body.classList.toggle("hide-rownums", fieldInfoOn);
  const b = document.getElementById("bToggleFieldInfo");
  if (b) b.classList.toggle("overlay-on", fieldInfoOn);
  updateFieldInfo();
}
/* Кнопка общего выключателя выделения (v0.974). Сам запрет держит selectionAllowed() в
   fold-1-core.js — она зовётся на входе КАЖДОГО выделяющего обработчика; здесь только
   переключатель и вид кнопки. Значок меняется 🔓/🔒, чтобы состояние читалось без наведения. */
function applySelectEnabled(){
  const b = document.getElementById("bToggleSelect");
  if (b) {
    b.textContent = selectEnabled ? "🔓" : "🔒";
    b.classList.toggle("overlay-on", !selectEnabled);
  }
}
const bToggleSelectEl = document.getElementById("bToggleSelect");
if (bToggleSelectEl) {
  bToggleSelectEl.onclick = () => {
    selectEnabled = !selectEnabled;
    applySelectEnabled();
    saveCache();
    say(selectEnabled
      ? "🔓 Выделение включено — строки, паттерны и биты снова выделяются."
      : "🔒 Выделение выключено — по полотну ничего не выделяется, поля по-прежнему двигаются.");
  };
}
applySelectEnabled();

const bToggleFieldInfoEl = document.getElementById("bToggleFieldInfo");
if (bToggleFieldInfoEl) {
  bToggleFieldInfoEl.onclick = () => {
    fieldInfoOn = !fieldInfoOn;
    applyFieldInfo();
    saveCache();
    say(fieldInfoOn
      ? "ℹ Поле: окно включено, номера строк убраны из полей — в полях остались чисто биты."
      : "ℹ Поле: окно выключено, колонки номеров вернулись в поля.");
  };
}

/* === МАРКЕР 10.4: ВИЗУАЛЬНЫЕ НАСТРОЙКИ === */
/* Ползунки шрифта, межстрочного и межсимвольного интервала */
const fs = document.getElementById("fs");
const lh = document.getElementById("lh");
const ls = document.getElementById("ls");

/* Высота строки .ln раньше считалась в CSS как calc(--chain-fs * --chain-lh) — при дробном
   произведении (напр. 19 * 0.65 = 12.35px) сама СЕТКА строк остаётся идеально ровной
   (getBoundingClientRect подтверждает), но у каждой строки РАЗНЫЙ дробный остаток накопленной
   Y-позиции (0, 12.35, 24.7, 37.05...) — при рендере текста браузер подгоняет глифы под
   пиксельную сетку (хинтинг), и округление дробного остатка "плавает" от строки к строке.
   Отсюда одинаковые пары символов (напр. "0" над "0") визуально то сливаются, то нет. Считаем
   произведение здесь в JS и ОКРУГЛЯЕМ до целого пикселя (--row-h) — тогда высота каждой строки
   буквально одно и то же целое число, без дробного остатка вообще. */
function updateRowHeight(){
  const px = Math.round((+fs.value) * (+lh.value));
  document.documentElement.style.setProperty("--row-h", px + "px");
}
/* Сразу при разборе скрипта — на случай самой первой загрузки без кэша вообще (там ветка
   loadCache() не зовёт applyFont()/applyLh(), полагаясь на CSS :root по умолчанию); без этого
   --row-h не проставился бы вообще, и .ln откатилась бы на хардкод-заглушку 12px в CSS. */
updateRowHeight();
function applyFont(){
  const v = +fs.value;
  document.documentElement.style.setProperty("--chain-fs", v + "px");
  document.getElementById("fsVal").textContent = v;
  updateRowHeight();
}
fs.oninput = () => { applyFont(); saveCacheSoon(); };

function applyLh(){
  const v = +lh.value;
  document.documentElement.style.setProperty("--chain-lh", v);
  document.getElementById("lhVal").textContent = v;
  updateRowHeight();
}
lh.oninput = () => { applyLh(); saveCacheSoon(); };
/* ДВОЙНОЙ КЛИК ПО ЗНАЧКУ "↕" (v0.908, запрос пользователя "пусть двойной щелчок по значку делает
   такую высоту междустрочных отступов, чтобы все строки поместились в экран — если это возможно").
   Считаем, сколько вертикали реально доступно строкам: от верхней кромки #rows до низа
   прокручиваемого холста (.canvas) — так учитываются и полоса выравниваний, и линейка столбцов, и
   зарезервированное сверху место под overlay-бары (--result-box-h).
   Высота строки — --row-h = round(--chain-fs * --chain-lh) (см. updateRowHeight), поэтому нужный
   интервал = доступная высота / число строк / кегль. Округляем ВНИЗ по шагу ползунка (0.05):
   лишние полпикселя на строку на тысяче строк дают полэкрана.
   Ползунок ниже 0.2 не опускается — если и на минимуме не влезает, ставим минимум и честно
   говорим, на сколько строк не хватило: дальше уменьшать надо уже кегль ("A"). */
function fitLhToScreen(){
  const rowsEl = document.getElementById("rows");
  const n = st.rows ? st.rows.length : 0;
  if (!rowsEl || !n) { say("Интервал по экрану: в цепочке нет строк."); return; }
  const scroller = rowsEl.closest(".canvas");
  if (!scroller) { say("Интервал по экрану: не нашёл холст — мерить не от чего."); return; }
  const avail = scroller.clientHeight -
    (rowsEl.getBoundingClientRect().top - scroller.getBoundingClientRect().top);
  if (avail <= 0) { say("Интервал по экрану: под строки не осталось места на холсте."); return; }
  const step = +lh.step || 0.05, lo = +lh.min || 0.2, hi = +lh.max || 2;
  const want = (avail / n) / (+fs.value || 1);
  const snapped = Math.max(lo, Math.min(hi, Math.floor(want / step) * step));
  lh.value = snapped.toFixed(2);
  applyLh();
  render(); saveCache();
  const rowPx = Math.round((+fs.value) * (+lh.value)) || 1;
  const fit = Math.floor(avail / rowPx);
  say(fit >= n
    ? `Интервал ${lh.value}: все ${n} строк помещаются в экран.`
    : `Интервал ${lh.value} — это минимум ползунка, влезает ${fit} строк из ${n}. Дальше уменьшайте кегль ползунком «A».`);
}
{
  // Значок стоит перед ползунком внутри общей .chk-обёртки — вешаем на неё, но срабатываем
  // только по самому значку: двойной клик по ползунку менять интервал не должен.
  const lhWrap = lh.closest("label");
  if (lhWrap) lhWrap.addEventListener("dblclick", (e) => {
    if (!e.target.closest(".view-slider-icon")) return;
    e.preventDefault();
    fitLhToScreen();
  });
}

function applyLs(){
  const v = +ls.value;
  document.documentElement.style.setProperty("--chain-ls", v + "px");
  document.getElementById("lsVal").textContent = v;
}
ls.oninput = () => { applyLs(); saveCacheSoon(); };

/* "📐90°" — подбирает межсимвольный интервал (ls) так, чтобы ячейка символа стала КВАДРАТНОЙ
   (ширина = высоте строки --row-h) при текущих fs/lh — тогда любая "лестница" (1,11,111...)
   в таблице строк идёт ровно по 45°. Естественную ширину символа (БЕЗ letter-spacing) меряем
   через canvas.measureText() тем же шрифтом/размером, что и сама таблица (--chain-ff/--chain-fs)
   — жёстко хардкодить соотношение ширина/высота нельзя, оно своё у каждого из 6 шрифтов
   (см. #chainFontSel). letter-spacing браузер добавляет ПОСЛЕ каждого символа как есть, поэтому
   искомый ls = высота_строки − natural_width, округлённый до шага ползунка (0.5). */
function applySquareCellLs(){
  const fsPx = +fs.value;
  const lhVal = +lh.value;
  const rowH = Math.round(fsPx * lhVal); // та же формула, что и updateRowHeight()/--row-h
  const ff = getComputedStyle(document.documentElement).getPropertyValue("--chain-ff").trim() || '"Roboto Mono", Consolas, monospace';
  const measureCanvas = document.createElement("canvas");
  const ctx = measureCanvas.getContext("2d");
  ctx.font = fsPx + "px " + ff;
  const naturalW = ctx.measureText("0").width;
  let target = Math.round((rowH - naturalW) * 2) / 2; // шаг ползунка ls — 0.5
  const min = +ls.min, max = +ls.max;
  const clamped = Math.max(min, Math.min(max, target));
  ls.value = clamped;
  applyLs();
  saveCache();
  if (clamped !== target) {
    say(`📐 Квадратная ячейка требует ls=${target}, но ползунок ограничен [${min}; ${max}] — поставлено ближайшее ${clamped}, идеального 90° не будет.`);
  } else {
    say(`📐 Ячейка символа теперь квадратная (${rowH}×${rowH}px) — лестница идёт ровно по 45°.`);
  }
}
const rightTriangle90BtnEl = document.getElementById("rightTriangle90Btn");
if (rightTriangle90BtnEl) rightTriangle90BtnEl.onclick = applySquareCellLs;

/* Выбор шрифта цифр полотна (см. #chainFontSel/--chain-ff в CSS) */
const chainFontSelEl = document.getElementById("chainFontSel");
function applyChainFont(){
  if (chainFontSelEl) document.documentElement.style.setProperty("--chain-ff", chainFontSelEl.value);
}
if (chainFontSelEl) chainFontSelEl.onchange = () => { applyChainFont(); saveCache(); };

/* Ползунок яркости будущих строк */
const dimEl = document.getElementById("dim");
function applyDim(){
  document.documentElement.style.setProperty("--dim-op", dimEl.value / 100);
  document.getElementById("dimVal").textContent = dimEl.value;
}
dimEl.oninput = () => { applyDim(); saveCacheSoon(); };

/* --- ЛОГИКА ЦВЕТОВ И ПРЕСЕТОВ --- */
const PRESETS = {
    matrix: { c1: '#ffffff', c0: '#00ff66', bg: '#050505' },
    cyber: { c1: '#ffcc00', c0: '#00ccff', bg: '#0a0a1a' },
    blood: { c1: '#ffffff', c0: '#ff0000', bg: '#1a0000' },
    synthwave: { c1: '#00ffff', c0: '#ff00ff', bg: '#0f0515' },
    zerkalius: { c1: '#dcdcdc', c0: '#0066cc', bg: '#050a15' },
    crypto: { c1: '#ff3333', c0: '#555555', bg: '#000000' },
    bw: { c1: '#ffffff', c0: '#555555', bg: '#000000' }
};

const col1 = document.getElementById("col1");
const col0 = document.getElementById("col0");
const colBg = document.getElementById("colBg");
// Цвет битов, изменённых последним шагом (.bit-chg) — раньше был хардкодом в CSS.
const colChg = document.getElementById("colChg");
// Цвет НОВЫХ бит (.bit-new, см. newBitsMap) — дописанных построениями и зеркалами.
const colNew = document.getElementById("colNew");

function applyColors() {
  document.documentElement.style.setProperty("--c1", col1.value);
  document.documentElement.style.setProperty("--c0", col0.value);
  document.documentElement.style.setProperty("--cbg", colBg.value);
  if (colChg) document.documentElement.style.setProperty("--cchg", colChg.value);
  if (colNew) document.documentElement.style.setProperty("--cnew", colNew.value);
}

/* ФОН КАЖДОЙ ИЗ ТРЁХ ПАНЕЛЕЙ ОТДЕЛЬНО (v0.983, запрос пользователя: "нужно задавать отдельно
   цвета для всех панелей"). Отдельная функция, а не веткой внутри applyColors(): те красят биты
   и общий фон полотна (--cbg, под всеми тремя полями), эта — сами поля (--fld-l/--fld-c/--fld-r,
   см. CSS v0.972/v0.983). Разные слои, разный смысл, поэтому и разные пикеры/разная функция. */
const colFieldL = document.getElementById("colFieldL");
const colFieldC = document.getElementById("colFieldC");
const colFieldR = document.getElementById("colFieldR");
function applyFieldColors() {
  if (colFieldL) document.documentElement.style.setProperty("--fld-l", colFieldL.value);
  if (colFieldC) document.documentElement.style.setProperty("--fld-c", colFieldC.value);
  if (colFieldR) document.documentElement.style.setProperty("--fld-r", colFieldR.value);
}
if (colFieldL) colFieldL.oninput = () => { applyFieldColors(); saveCacheSoon(); };
if (colFieldC) colFieldC.oninput = () => { applyFieldColors(); saveCacheSoon(); };
if (colFieldR) colFieldR.oninput = () => { applyFieldColors(); saveCacheSoon(); };

/* #RRGGBB -> rgba(...) с заданной прозрачностью — цвет <input type="color"> всегда непрозрачный,
   а фон выделенной строки (--rowbg-sel) должен оставаться полупрозрачным, иначе перекроет
   текст строки под собой. */
function hexToRgba(hex, alpha){
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || "");
  if (!m) return hex;
  return "rgba(" + parseInt(m[1], 16) + "," + parseInt(m[2], 16) + "," + parseInt(m[3], 16) + "," + alpha + ")";
}

/* Фон ТОЛЬКО для выделенных строк (см. #rowBgSel в HTML, .ln.selected фон в CSS) — цвет +
   отдельный ползунок прозрачности (#rowBgSelOpacity, 0-100%) — запрос пользователя
   "прозрачность выделения фона нужно сюда же" (раньше была зашита в коде — 0.18). */
const rowBgSel = document.getElementById("rowBgSel");
const rowBgSelOpacityEl = document.getElementById("rowBgSelOpacity");
const rowBgSelOpacityValEl = document.getElementById("rowBgSelOpacityVal");

function applyColorsSel() {
  const opacityPct = rowBgSelOpacityEl ? +rowBgSelOpacityEl.value : 18;
  if (rowBgSelOpacityValEl) rowBgSelOpacityValEl.textContent = opacityPct + "%";
  document.documentElement.style.setProperty("--rowbg-sel", hexToRgba(rowBgSel.value, opacityPct / 100));
}

/* Снимок текущих цветов — для сохранения их ОТДЕЛЬНО у каждой цепочки (см. createDefaultTabState/
   saveActiveTabState/loadTabState ниже). Объявлена function-декларацией (поднимается целиком),
   поэтому её можно звать из тех функций, хотя они в файле раньше — реально выполнятся они
   только после того, как col1/currentPreset и т.д. уже объявлены (см. порядок вызова loadCache()). */
function captureColors(){
  return {
    c1: col1 ? col1.value : "#ff3333",
    c0: col0 ? col0.value : "#555555",
    cBg: colBg ? colBg.value : "#000000",
    preset: typeof currentPreset !== "undefined" ? currentPreset : "crypto",
    customPreset: st.customPreset || null,
    rowBgSel: rowBgSel ? rowBgSel.value : "#ffcf6b",
    rowBgSelOpacity: rowBgSelOpacityEl ? rowBgSelOpacityEl.value : 18,
    c01: typeof col01El !== "undefined" && col01El ? col01El.value : "#ff9900",
    cv1: typeof colVert1El !== "undefined" && colVert1El ? colVert1El.value : "#00ccff",
    cd1: typeof colDiag1El !== "undefined" && colDiag1El ? colDiag1El.value : "#66ff66",
    c11r: typeof col1RightEl !== "undefined" && col1RightEl ? col1RightEl.value : "#a78bfa",
    cdf: typeof colDiagFoldEl !== "undefined" && colDiagFoldEl ? colDiagFoldEl.value : "#ff5ecb",
    cdl: typeof colDiffLeftEl !== "undefined" && colDiffLeftEl ? colDiffLeftEl.value : "#4dd0e1",
    cdu: typeof colDiffUpEl !== "undefined" && colDiffUpEl ? colDiffUpEl.value : "#ff8fa3"
  };
}

const bHighlight01El = document.getElementById("bHighlight01");
if (bHighlight01El) {
  bHighlight01El.onclick = () => {
    st.highlight01 = !st.highlight01;
    bHighlight01El.classList.toggle("mode-act", st.highlight01);
    render();
    saveCache();
  };
}

/* Цвет подсветки "01" (см. #bHighlight01/.hl01 в CSS) — свой пикер, БЕЗ прозрачности (сплошной
   цвет текста для 0 и 1 в найденном пробеге — прозрачный фон был почти не виден). */
const col01El = document.getElementById("col01");
function applyColor01(){
  if (col01El) document.documentElement.style.setProperty("--c01-hl", col01El.value);
}
if (col01El) {
  col01El.oninput = () => { applyColor01(); saveCacheSoon(); };
}

/* "1 правее 1" (см. #bHighlight1Right/.hl11r в CSS) — та же логика вкл/выкл + цвет, что у "01";
   считать нечего заранее, признак берётся прямо в render() по соседу слева. */
const bHighlight1RightEl = document.getElementById("bHighlight1Right");
if (bHighlight1RightEl) {
  bHighlight1RightEl.onclick = () => {
    st.highlight1Right = !st.highlight1Right;
    bHighlight1RightEl.classList.toggle("mode-act", st.highlight1Right);
    render();
    saveCache();
  };
}
const col1RightEl = document.getElementById("col1Right");
function applyColor1Right(){
  if (col1RightEl) document.documentElement.style.setProperty("--c11r-hl", col1RightEl.value);
}
if (col1RightEl) {
  col1RightEl.oninput = () => { applyColor1Right(); saveCacheSoon(); };
}

/* "Δ◧" и "Δ▲" (v0.968, запрос пользователя "подсвет битов, которые поменялись с предыдущим левым,
   и другая с верхним") — обычные показные переключатели, той же выделки, что "01"/"1 правее 1"
   рядом. "Δ◧" считать заранее нечего, признак виден прямо в строке; "Δ▲" сравнивает строку с той,
   что над ней, в ЭКРАННЫХ столбцах — за это отвечает computeDiffUpMask() в fold-2-render.js. */
const bDiffLeftEl = document.getElementById("bDiffLeft");
if (bDiffLeftEl) {
  bDiffLeftEl.onclick = () => {
    st.diffLeftShow = !st.diffLeftShow;
    bDiffLeftEl.classList.toggle("mode-act", st.diffLeftShow);
    render(); saveCache();
  };
}
const colDiffLeftEl = document.getElementById("colDiffLeft");
function applyColorDiffLeft(){
  if (colDiffLeftEl) document.documentElement.style.setProperty("--cdl-hl", colDiffLeftEl.value);
}
if (colDiffLeftEl) colDiffLeftEl.oninput = () => { applyColorDiffLeft(); saveCacheSoon(); };

const bDiffUpEl = document.getElementById("bDiffUp");
if (bDiffUpEl) {
  bDiffUpEl.onclick = () => {
    st.diffUpShow = !st.diffUpShow;
    bDiffUpEl.classList.toggle("mode-act", st.diffUpShow);
    render(); saveCache();
  };
}
const colDiffUpEl = document.getElementById("colDiffUp");
function applyColorDiffUp(){
  if (colDiffUpEl) document.documentElement.style.setProperty("--cdu-hl", colDiffUpEl.value);
}
if (colDiffUpEl) colDiffUpEl.oninput = () => { applyColorDiffUp(); saveCacheSoon(); };

/* "1 под 1" (см. #bHighlightVert1/.hlv1 в CSS) — та же логика вкл/выкл + цвет, что у "01",
   просто другая функция подсчёта (computeVertOnesMask, сравнивает соседние строки). */
const bHighlightVert1El = document.getElementById("bHighlightVert1");
if (bHighlightVert1El) {
  bHighlightVert1El.onclick = () => {
    st.highlightVert1 = !st.highlightVert1;
    bHighlightVert1El.classList.toggle("mode-act", st.highlightVert1);
    render();
    saveCache();
  };
}
const colVert1El = document.getElementById("colVert1");
function applyColorVert1(){
  if (colVert1El) document.documentElement.style.setProperty("--cv1-hl", colVert1El.value);
}
if (colVert1El) {
  colVert1El.oninput = () => { applyColorVert1(); saveCacheSoon(); };
}

/* "1 по диагонали" (см. #bHighlightDiag1/.hld1 в CSS) — та же логика вкл/выкл + цвет, что у
   "01"/"1 под 1", просто другая функция подсчёта (computeDiagOnesMask). */
const bHighlightDiag1El = document.getElementById("bHighlightDiag1");
if (bHighlightDiag1El) {
  bHighlightDiag1El.onclick = () => {
    st.highlightDiag1 = !st.highlightDiag1;
    bHighlightDiag1El.classList.toggle("mode-act", st.highlightDiag1);
    render();
    saveCache();
  };
}
/* "По подсветке" (см. #bSearchOnlyHl, computeHighlightedOnlyRow()) — сам эффект
   применяется в getRowBits() и затрагивает только логику поиска; на подсветку/раскраску экрана
   не влияет, поэтому тут просто toggle + перерисовка (актуализирует состояние bg-поиска и т.п.,
   раз данные для поиска изменились). */
const bSearchOnlyHlEl = document.getElementById("bSearchOnlyHl");
if (bSearchOnlyHlEl) {
  bSearchOnlyHlEl.onclick = () => {
    st.searchOnlyHighlighted = !st.searchOnlyHighlighted;
    bSearchOnlyHlEl.classList.toggle("mode-act", st.searchOnlyHighlighted);
    render();
    saveCache();
  };
}

/* "⚖ Показать балансы" (см. #bShowBalances, formatBalanceTotals() в render()) — чисто визуальный
   тумблер, сам подсчёт целиком внутри render(). */
const bShowBalancesEl = document.getElementById("bShowBalances");
if (bShowBalancesEl) {
  bShowBalancesEl.onclick = () => {
    st.showBalances = !st.showBalances;
    bShowBalancesEl.classList.toggle("mode-act", st.showBalances);
    render();
    saveCache();
  };
}

/* "🔢 Двоичные номера" (см. rowNumText() в fold-4) — тоже чисто визуальный тумблер: номера строк
   во всех трёх колонках печатаются в двоичном виде. Ширину колонки номеров пересчитывает сам
   render() через fitNumW(), который меряет уже двоичную подпись. */
const bBinRowNumsEl = document.getElementById("bBinRowNums");
if (bBinRowNumsEl) {
  bBinRowNumsEl.onclick = () => {
    st.binRowNums = !st.binRowNums;
    bBinRowNumsEl.classList.toggle("mode-act", st.binRowNums);
    render();
    saveCache();
  };
}

/* "🔴 Изм. биты" — общий выключатель красной подсветки изменённых бит (см. chgBitsOn): гасит и
   штатную "изменён последним шагом", и ту, что оставляет "🎭 Маска". Чисто визуальный тумблер,
   состояние живёт в настройках вида. */
const bToggleChgBitsEl = document.getElementById("bToggleChgBits");
if (bToggleChgBitsEl) {
  bToggleChgBitsEl.onclick = () => {
    chgBitsOn = !chgBitsOn;
    bToggleChgBitsEl.classList.toggle("mode-act", chgBitsOn);
    say(chgBitsOn ? "Подсветка изменённых бит включена." : "Подсветка изменённых бит выключена.");
    render();
    saveCache();
  };
}

/* "Пробеги вместо битов" (см. #bRunsAsBits, formatRunsHtml() в render()) — тоже чисто
   визуальный тумблер. */
const bRunsAsBitsEl = document.getElementById("bRunsAsBits");
if (bRunsAsBitsEl) {
  bRunsAsBitsEl.onclick = () => {
    st.runsAsBits = !st.runsAsBits;
    bRunsAsBitsEl.classList.toggle("mode-act", st.runsAsBits);
    render();
    saveCache();
  };
}

const colDiag1El = document.getElementById("colDiag1");
function applyColorDiag1(){
  if (colDiag1El) document.documentElement.style.setProperty("--cd1-hl", colDiag1El.value);
}
if (colDiag1El) {
  colDiag1El.oninput = () => { applyColorDiag1(); saveCacheSoon(); };
}

/* "⧅⧄ Диагонали склейки" (см. #bHighlightDiagFold/.hldf в CSS, computeDiagFoldMask) — тот же
   механизм вкл/выкл + свой цвет, что у трёх подсветок выше. Считается только на ½-выравниваниях
   (diagAlignOk) — на других выравниваниях просто ничего не красит, кнопка при этом не блокируется:
   вернулись на любое "½" — подсветка снова на месте. */
const bHighlightDiagFoldEl = document.getElementById("bHighlightDiagFold");
if (bHighlightDiagFoldEl) {
  bHighlightDiagFoldEl.onclick = () => {
    st.highlightDiagFold = !st.highlightDiagFold;
    // Погасили кнопку — снимаем и выбор конкретной диагонали, иначе он остался бы "висеть" и
    // подсветка вернулась бы сама при следующем включении не там, где ждёшь.
    if (!st.highlightDiagFold) st.diagFoldPick = null;
    bHighlightDiagFoldEl.classList.toggle("mode-act", st.highlightDiagFold);
    render();
    saveCache();
  };
}
const colDiagFoldEl = document.getElementById("colDiagFold");
function applyColorDiagFold(){
  if (colDiagFoldEl) document.documentElement.style.setProperty("--cdf-hl", colDiagFoldEl.value);
}
if (colDiagFoldEl) {
  colDiagFoldEl.oninput = () => { applyColorDiagFold(); saveCacheSoon(); };
}

/* Пресеты цветов — раньше <select>, теперь кнопки (см. #presetGrp). currentPreset хранит,
   какой пресет активен ("" — ручные цвета, ни один пресет не выбран). setPresetActive
   подсвечивает нужную кнопку (button.mode-act — то же белое свечение, что у активного режима
   выполнения) и снимает подсветку с остальных. */
let currentPreset = "crypto"; // По умолчанию — пресет "Спектр" (см. class="mode-act" на кнопке в HTML)
const presetGrpEl = document.getElementById("presetGrp");
function setPresetActive(val){
  currentPreset = val || "";
  if (presetGrpEl) {
    presetGrpEl.querySelectorAll("button").forEach(b => {
      b.classList.toggle("mode-act", b.getAttribute("data-val") === currentPreset);
    });
  }
  // Свои слоты (#presetSlotGrp) — та же подсветка, значение вида "slot3". getElementById, а не
  // константа: setPresetActive() зовут из loadCache(), а он выполняется раньше этих объявлений.
  const slotGrp = document.getElementById("presetSlotGrp");
  if (slotGrp) {
    slotGrp.querySelectorAll("button[data-slot]").forEach(b => {
      b.classList.toggle("mode-act", ("slot" + b.dataset.slot) === currentPreset);
    });
  }
}
/* "Своя" (custom: true/false) — не фиксированная тройка цветов, как остальные PRESETS, а
   последние вручную подобранные (см. col1/col0/colBg.oninput ниже): любая ручная правка цвета
   ПРИ ЛЮБОМ активном пресете не трогает сам пресет, а переносит текущие цвета в "Своя" и
   переключает подсветку на неё. Пока своих цветов ещё не было (st.customPreset пуст) — клик
   по "Своя" запускает как отправную точку Ч/Б (см. PRESETS.bw). */
if (presetGrpEl) {
  presetGrpEl.querySelectorAll("button").forEach(btn => {
    btn.onclick = () => {
      const val = btn.getAttribute("data-val");
      if (val === "custom") {
        const c = st.customPreset || PRESETS.bw;
        col1.value = c.c1; col0.value = c.c0; colBg.value = c.bg || c.cBg;
        applyColors();
      } else if (PRESETS[val]) {
        const p = PRESETS[val];
        col1.value = p.c1;
        col0.value = p.c0;
        colBg.value = p.bg;
        applyColors();
      }
      setPresetActive(val);
      saveCache();
    };
  });
}

/* ЧЕТЫРЕ СВОИХ СЛОТА ЦВЕТОВ ("Своя 1..4", #presetSlotGrp, v0.841 — запрос пользователя
   "запоминает и на других цепочках синхронится, чтобы из одной в другую можно").
   ГЛОБАЛЬНЫЕ, в отличие от всех прочих настроек вида: st.colorSlots лежит рядом с вкладками
   (см. saveCache/loadCache, ровно как st.patBank), а не в uiSettings каждой цепочки — иначе
   перенести подобранный набор из одной цепочки в другую было бы нечем. "↺ Сброс настроек" их
   не трогает по той же причине.
   Клик — применить; клик по ПУСТОМУ слоту — сохранить в него текущие цвета; Ctrl+клик или
   правая кнопка — перезаписать занятый слот. */
function colorSlotGet(n){ return (Array.isArray(st.colorSlots) && st.colorSlots[n - 1]) || null; }
function updateColorSlotBtns(){
  const grp = document.getElementById("presetSlotGrp");
  if (!grp) return;
  grp.querySelectorAll("button[data-slot]").forEach(b => {
    const n = +b.dataset.slot;
    const c = colorSlotGet(n);
    b.classList.toggle("slot-empty", !c);
    // Рамка цветом "1" из слота — набор видно, не наводя мышь.
    b.style.borderColor = c ? c.c1 : "";
    b.title = c
      ? `Слот «Своя ${n}»: «1» — ${c.c1}, «0» — ${c.c0}, фон — ${c.bg}. Клик — применить, Ctrl+клик или правая кнопка — перезаписать текущими цветами. Слот ОБЩИЙ для всех цепочек`
      : `Слот «Своя ${n}» пуст. Клик — сохранить в него текущие цвета. Слот ОБЩИЙ для всех цепочек: сохранил тут — применяется в любой другой`;
  });
}
function colorSlotSave(n){
  if (!Array.isArray(st.colorSlots)) st.colorSlots = [];
  st.colorSlots[n - 1] = { c1: col1.value, c0: col0.value, bg: colBg.value };
  updateColorSlotBtns();
  setPresetActive("slot" + n);
  saveCache();
  say(`🎨 Цвета сохранены в «Своя ${n}» — слот общий для всех цепочек`);
}
function colorSlotApply(n){
  const c = colorSlotGet(n);
  if (!c) { colorSlotSave(n); return; }   // пустой слот — первый клик кладёт в него текущие цвета
  col1.value = c.c1; col0.value = c.c0; colBg.value = c.bg || c.cBg;
  applyColors();
  setPresetActive("slot" + n);
  saveCache();
}
{
  const slotGrp = document.getElementById("presetSlotGrp");
  if (slotGrp) {
    slotGrp.querySelectorAll("button[data-slot]").forEach(btn => {
      const n = +btn.dataset.slot;
      btn.onclick = (e) => { if (e.ctrlKey || e.metaKey) colorSlotSave(n); else colorSlotApply(n); };
      btn.oncontextmenu = (e) => { e.preventDefault(); colorSlotSave(n); };
    });
    updateColorSlotBtns();
  }
}

function markCustomColor(){
  applyColors();
  /* Активен один из СВОИХ СЛОТОВ ("Своя 1..4") — правка цвета уходит ПРЯМО В НЕГО и остаётся там
     (v0.846, запрос пользователя: "должны глобально меняться при изменении, сейчас просто одно и
     то же всегда"). Раньше любая правка перекидывала на общую "Свою", а слот оставался с тем
     снимком, что положили при сохранении, — и кнопка всегда возвращала одно и то же.
     say() тут нет намеренно: обработчик висит на oninput и срабатывает на каждое движение в
     палитре. Слот глобальный, поэтому изменение сразу видно во всех цепочках. */
  const slotN = /^slot([1-4])$/.exec(currentPreset || "");
  if (slotN) {
    if (!Array.isArray(st.colorSlots)) st.colorSlots = [];
    st.colorSlots[+slotN[1] - 1] = { c1: col1.value, c0: col0.value, bg: colBg.value };
    updateColorSlotBtns();
    saveCache();
    return;
  }
  st.customPreset = { c1: col1.value, c0: col0.value, bg: colBg.value };
  setPresetActive("custom");
  saveCache();
}
col1.oninput = markCustomColor;
col0.oninput = markCustomColor;
colBg.oninput = markCustomColor;
/* Цвет изменённых бит в пресеты НЕ входит (у них только c1/c0/bg) — поэтому свой обработчик:
   применяем переменную и сохраняем, но пресет на "свой" не переключаем. */
if (colChg) colChg.oninput = () => { applyColors(); st.colChg = colChg.value; saveCache(); };
/* Цвет новых бит — там же и по той же причине (в пресеты не входит). */
if (colNew) colNew.oninput = () => { applyColors(); st.colNew = colNew.value; saveCache(); };
/* ЕДИНСТВЕННЫЙ способ снять пометку «новый» (запрос пользователя: "при сохранении пусть не меняют
   своего цвета" — её не снимают ни сохранение, ни перезагрузка, ни Сброс). Сами биты не трогаем:
   меняется только их цвет. */
const bClearNewBitsEl = document.getElementById("bClearNewBits");
if (bClearNewBitsEl) bClearNewBitsEl.onclick = () => {
  if (!newBitsMap.size) { say("Новых бит и нет — снимать нечего."); return; }
  const n = newBitsMap.size;
  newBitsClearAll();
  render(); saveCache();
  say(`Пометка «новый» снята: строк ${n}. Биты остались на месте, просто стали обычного цвета.`);
};

/* Фон выделенных строк — цвет + прозрачность, без пресетов (см. #rowBgSel/#rowBgSelOpacity в HTML). */
rowBgSel.oninput = () => { applyColorsSel(); saveCacheSoon(); };
if (rowBgSelOpacityEl) rowBgSelOpacityEl.oninput = () => { applyColorsSel(); saveCacheSoon(); };

function makeDrag(el, varName, x0fn, min, max){
  el.addEventListener("mousedown", e => {
    e.preventDefault();
    const x0 = x0fn();
    el.classList.add("drag");
    document.body.classList.add("dragging");
    // Границу схватили — гасим ЛЮБУЮ уже включённую подсветку слоя (v0.992): без этого она
    // застревала на том поле, что было под курсором ДО захвата ручки, и всю протяжку границы
    // одно из полей стояло приглушённым без причины. См. mousemove-фильтр по body.dragging ниже.
    if (document.body.dataset.hov) document.body.dataset.hov = "";
    const move = ev => {
      const w = Math.max(min, Math.min(max, ev.clientX - x0));
      document.documentElement.style.setProperty(varName, w + "px");
      updateSplitPositions(); // линия должна ехать вместе с колонкой, а не отставать до render()
    };
    const up = () => {
      el.classList.remove("drag");
      document.body.classList.remove("dragging");
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      saveCache();
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  });
}

function makeDragRight(el, varName, min, max, onManual){
  el.addEventListener("mousedown", e => {
    e.preventDefault();
    if (onManual) onManual(); // ручку тронули — автоподбор ширины больше не вмешивается
    const chainRect = document.getElementById("chain").getBoundingClientRect();
    const rightEdge = chainRect.right;
    
    el.classList.add("drag");
    document.body.classList.add("dragging");
    // Границу схватили — гасим ЛЮБУЮ уже включённую подсветку слоя (v0.992): без этого она
    // застревала на том поле, что было под курсором ДО захвата ручки, и всю протяжку границы
    // одно из полей стояло приглушённым без причины. См. mousemove-фильтр по body.dragging ниже.
    if (document.body.dataset.hov) document.body.dataset.hov = "";
    
    const move = ev => {
      let w = rightEdge - ev.clientX; // Чем левее мышь, тем шире колонка
      w = Math.max(min, Math.min(max, w));
      document.documentElement.style.setProperty(varName, w + "px");
      updateSplitPositions(); // линия едет вместе с колонкой, не дожидаясь следующего render()
    };
    
    const up = () => {
      el.classList.remove("drag");
      document.body.classList.remove("dragging");
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      saveCache();
    };
    
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  });
}

/* Минимум 40px, а не 20 — .pat/.pat2 сами резервируют padding-left:4px+padding-right:28px
   (=32px) под отступ и под бейдж номера шага (.st), это не место под текст паттерна. При
   старом минимуме 20px место под сам текст уходило в минус (браузер зажимает контент-бокс в 0),
   и при перетаскивании колонки к минимуму текст паттерна визуально утыкался прямо в границу
   .vsplit/.vsplit2 — 40px оставляет от него хотя бы ~8px реального места под текст. */
/* ТРИ СТОЛБЦА: П1 | Цепочки | П2 — каждый тянется своей границей, независимо от остальных и без
   потолка (запрос пользователя "как три столбца в экселе"). Ширина считается ПРИРАЩЕНИЕМ: на
   старте берём реальную ширину столбца из DOM и дальше просто прибавляем смещение мыши. Прежние
   makeDrag/makeDragRight мерили от краёв полотна (.chain) — и как только строка стала шире него
   (раздвинутые колонки + горизонтальная прокрутка), правая ручка начинала прыгать невпопад
   ("паттерны неадекватно перемещаются правые"). Приращение от этого не зависит вообще.
   selectorOfCol — по какому элементу первой строки мерить текущую ширину столбца. */
/* ═══ ВЕРТИКАЛЬ = МЕЖСТРОЧНЫЙ ОТСТУП (v0.977, разведено по местам в v0.980) ═══
   Один и тот же жест в двух местах, поэтому и код один:
     НА ГРАНИЦЕ ПОЛЯ (.vsplit/.vsplit2/.vsplit3) — БЕЗ всяких клавиш. Там вертикали больше делать
       нечего: горизонталь занята шириной столбца, и промахнуться смыслом невозможно.
     НА САМОМ ПОЛЕ (протяжка бит, см. "ТАЩИТЬ ПОЛЕ ЗА БИТЫ") — ТОЛЬКО С ЗАЖАТЫМ CTRL. Без него
       вертикаль там обязана молчать: поле таскают вбок постоянно, и рука неизбежно ходит вверх-вниз.
   ТОЧКА ОТСЧЁТА ПЕРЕВЗВОДИТСЯ В МОМЕНТ, КОГДА ЖЕСТ СТАНОВИТСЯ АКТИВНЫМ (нажали Ctrl посреди
   протяжки), а не на mousedown: иначе разом применился бы весь накопленный до этого вертикальный
   путь и интервал прыгнул бы к краю шкалы. Отпустил Ctrl, нажал снова — отсчёт с текущего места,
   поэтому подкручивать можно сколько угодно раз за одну протяжку.
   6px мыши на один шаг ползунка "↕": мельче — и интервал дёргался бы от дрожания руки. */
function makeLhVDrag(y0){
  let anchorY = y0, anchorVal = lh ? +lh.value : 0.65, armed = true;
  const stepV = +(lh && lh.step) || 0.05;
  const loV = +(lh && lh.min) || 0.2, hiV = +(lh && lh.max) || 2.0;
  return (y, active) => {
    if (!lh) return;
    if (!active) { armed = false; return; }
    if (!armed) { armed = true; anchorY = y; anchorVal = +lh.value; }
    const steps = Math.round((y - anchorY) / 6);
    if (!steps) return;
    const v = Math.min(hiV, Math.max(loV, +(anchorVal + steps * stepV).toFixed(2)));
    if (v !== +lh.value) { lh.value = v; applyLh(); }
  };
}
/* ГОРИЗОНТАЛЬ = МЕЖСИМВОЛЬНЫЙ ИНТЕРВАЛ, ПОКА ЗАЖАТ SHIFT (v0.983, запрос пользователя: "при
   зажатом контрл пусть влево-вправо меняет межсимвольный" — держалось на Ctrl вместе с межстрочным;
   разведено на Shift в v0.991, запрос пользователя: "межсимвольный интервал — только по Shift").
   Полный аналог makeLhVDrag() выше, только по другой оси и другому ползунку (--chain-ls, #ls).
   Живёт отдельной функцией, а не веткой внутри makeLhVDrag, потому что решётка привязки разная:
   у lh — px/строка через --row-h, у ls — свой шаг ползунка в px без пересчёта. Интервал ОДИН на
   всё приложение (тот же ползунок "↔" в "Виде"), поэтому крутить его можно с любого из трёх полей
   — эффект общий. */
function makeLsHDrag(x0){
  let anchorX = x0, anchorVal = ls ? +ls.value : 0, armed = true;
  const stepV = +(ls && ls.step) || 0.5;
  const loV = +(ls && ls.min) || -5, hiV = +(ls && ls.max) || 10;
  return (x, active) => {
    if (!ls) return;
    if (!active) { armed = false; return; }
    if (!armed) { armed = true; anchorX = x; anchorVal = +ls.value; }
    const steps = Math.round((x - anchorX) / 6);
    if (!steps) return;
    const v = Math.min(hiV, Math.max(loV, +(anchorVal + steps * stepV).toFixed(2)));
    if (v !== +ls.value) { ls.value = v; applyLs(); }
  };
}
function makeColResizer(el, varName, selectorOfCol, minPx, onManual, invert){
  if (!el) return;
  el.addEventListener("mousedown", e => {
    if (e.button !== 0) return;
    e.preventDefault();
    const row = document.querySelector("#rows .ln") || document.querySelector(".chain-head");
    const colEl = row ? row.querySelector(selectorOfCol) : null;
    const startW = colEl ? colEl.getBoundingClientRect().width : minPx;
    const startX = e.clientX;
    // Вертикаль здесь — межстрочный отступ, ТОЛЬКО С CTRL (было без Ctrl в v0.980 — "на границе и
    // без него"; отменено в v0.990, запрос пользователя: "межстрочный интервал — только по
    // контролу, даже на границах пусть", ради единообразия с протяжкой поля, где Ctrl уже
    // обязателен). Общий механизм — makeLhVDrag() выше.
    const lhDrag = makeLhVDrag(e.clientY);
    // ЗЕРКАЛЬНЫЙ ЗНАК (invert) — держим параметр на будущее (ни один из текущих вызовов его не
    // передаёт: единственный, который передавал, vsplitL0, с v1.010 у этого резайзера вообще не
    // висит, см. блок "vsplitL0 — СДВИГ ВСЕХ ТРЁХ ПОЛЕЙ" ниже по файлу).
    const sign = invert ? -1 : 1;
    el.classList.add("drag");
    document.body.classList.add("dragging");
    // Границу схватили — гасим ЛЮБУЮ уже включённую подсветку слоя (v0.992): без этого она
    // застревала на том поле, что было под курсором ДО захвата ручки, и всю протяжку границы
    // одно из полей стояло приглушённым без причины. См. mousemove-фильтр по body.dragging ниже.
    if (document.body.dataset.hov) document.body.dataset.hov = "";
    // Запоминаем, за какую границу взялись: под замком (🔒) её же двигают стрелки ←/→
    // (см. ветку в обработчике клавиш, fold-4-tools.js).
    if (el.id) activeBorderId = el.id;
    lastGrabWasBorder = true;   // под замком (🔒) без Alt стрелки пойдут в границу, а не в поле
    /* ЗАФИКСИРОВАТЬ ПЕРЕМЕННУЮ НА ЗАМЕРЕННОЙ ШИРИНЕ ДО onManual() (v1.000, баг-репорт
       пользователя: "vsplit2 — при её нажатии всё затемняет"). У #vsplit2 onManual переключает
       .bits с flex:1 (растёт, заполняя свободное место строки) на flex:0 (жёсткая ширина ровно
       varName) — см. body.bits-w-manual в CSS. Если varName (--bits-w) на тот момент хранит
       СТАРОЕ значение (render() не успел досчитать его под текущую ширину, или строка выросла за
       счёт flex-grow сверх --bits-w), переключение на flex:0 мгновенно, ещё ДО первого движения
       мыши, схлопывало колонку до этого старого меньшего значения — и на месте, где только что
       был текст, обнажался чёрный фон холста (--cbg). Выглядело это ровно как "потемнение" при
       одном нажатии на ручку, без какой-либо протяжки. У остальных трёх границ (.pat/.pat2)
       такого нет — они и без onManual всегда flex:0, скачка ширины при переключении неоткуда
       взяться. Ставим varName ровно в startW (то, что только что честно замерили из DOM) —
       переключение flex:1→flex:0 происходит на ТОЙ ЖЕ ширине, без скачка. */
    document.documentElement.style.setProperty(varName, Math.round(startW) + "px");
    if (onManual) onManual();
    const move = ev => {
      const w = Math.max(minPx, Math.round(startW + sign * (ev.clientX - startX)));
      document.documentElement.style.setProperty(varName, w + "px");
      lhDrag(ev.clientY, !!ev.ctrlKey);   // ВНИЗ — строки расходятся, ВВЕРХ — сходятся, только с Ctrl
      updateSplitPositions();
    };
    const up = () => {
      el.classList.remove("drag");
      document.body.classList.remove("dragging");
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      updateSplitPositions();
      saveCache();
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  });
}
makeColResizer(document.getElementById("vsplit"), "--pat-w", ".pat", 40, () => { patWManual = true; });
/* vsplitL0 (внешняя левая граница П1) БОЛЬШЕ НЕ через makeColResizer — с v1.010 она не меняет
   ширину П1 вовсе (за это отвечает только #vsplit выше), а двигает все три поля разом. Свой
   отдельный обработчик — см. блок "vsplitL0 — СДВИГ ВСЕХ ТРЁХ ПОЛЕЙ" ниже. */
makeColResizer(document.getElementById("vsplit2"), "--bits-w", ".bits", 40, () => {
  // Ширину повели рукой — подгонка по оси больше не «применена», её двойной клик снимать нечего.
  axisFitOn = false;
  bitsWManual = true;
  document.body.classList.add("bits-w-manual");
});
makeColResizer(document.getElementById("vsplit3"), "--pat-w2", ".pat2", 40, () => { patW2Manual = true; });
/* ДВОЙНОЙ КЛИК ПО ГРАНИЦЕ КОЛОНКИ ПАТТЕРНОВ — подогнать её ширину так, чтобы влез самый длинный
   паттерн (запрос пользователя). Расчёт тот же, что у автоподгонки правой колонки (fitPatW2):
   реальный шаг символа × длину самого длинного паттерна плюс собственные отступы ячейки.
   Флаг "ширину тянули руками" (patW2Manual) намеренно НЕ трогаем: если автоподгонка правой
   колонки ещё жива, она и дальше будет считать то же самое, а если её уже отключили ручкой —
   выставленная двойным кликом ширина так и останется. */
function fitPatColumnTo(varName){
  let maxLen = 0;
  for (const p of (st.pats || [])) if (p && p.text && p.text.length > maxLen) maxLen = p.text.length;
  if (!maxLen) { say("Подгонка ширины: паттернов нет."); return; }
  const step = realColStepPx() || 8;
  const w = Math.max(40, Math.min(1200, Math.round(maxLen * step) + 36));
  document.documentElement.style.setProperty(varName, w + "px");
  updateSplitPositions();
  saveCache();
  say(`Ширина колонки паттернов подогнана под самый длинный паттерн — ${maxLen} бит.`);
}
{
  const vL = document.getElementById("vsplit");
  if (vL) vL.addEventListener("dblclick", e => { e.preventDefault(); fitPatColumnTo("--pat-w"); });
  const vR = document.getElementById("vsplit3");
  if (vR) vR.addEventListener("dblclick", e => { e.preventDefault(); fitPatColumnTo("--pat-w2"); });
  /* ПУТЬ НАЗАД ДЛЯ СРЕДНЕГО СТОЛБЦА (v0.916). Его ширину задают руками (перетаскивание #vsplit2)
     и двойной клик по оси (axisCenterAndFitBits) — оба ставят bitsWManual, и render() перестаёт
     считать --bits-w по самой длинной строке. Флаг живёт в кэше, поэтому неудачная ширина
     переживала и перезагрузку: вернуть её было нечем (баг-репорт "двойной щелчок по оси всё
     сломал"). Двойной клик по этой же ручке снимает флаг — ближайший render() пересчитает
     ширину сам. Общий визуальный сдвиг тоже обнуляем: он мог остаться от подгонки. */
  const vM = document.getElementById("vsplit2");
  if (vM) vM.addEventListener("dblclick", e => { e.preventDefault(); axisFitReset(); });
}

/* ═══ vsplitL0 — СДВИГ ВСЕХ ТРЁХ ПОЛЕЙ (v1.010, запрос пользователя: "левая граница сейчас
   расширяет левое поле, измени чтоб её можно было двигать вправо — смещая все поля при этом, а
   слева открывается пустотка"; уточнение — "влево просто пустое место убирает до границы экрана
   и все поля обратно влево тянет"; "П1 шире — пусть только правая граница делает") ═══
   Тот же манёвр, что у "протяжки вне строк" (panAll, см. блок ниже) — patOffL/patOffR/
   axisCenterOffset сдвигаются ОДНИМ И ТЕМ ЖЕ d в столбцах — но за ОТДЕЛЬНУЮ РУЧКУ, а не за пустой
   холст, и с ограничением, которого у panAll нет: НАЗАД (влево) можно утянуть только до нуля —
   до состояния "пустоты нет, поля прижаты к левому краю экрана", не дальше (иначе получилось бы
   даже не то же самое, что обычная протяжка панорамирования, а дублирующий с ней контрол).
   Ширину П1 эта ручка больше НЕ трогает — за неё отвечает только #vsplit (внутренняя граница). */
{
  const vL0 = document.getElementById("vsplitL0");
  const PAN_L0_DEAD_PX = 3;
  let panL0 = null;
  if (vL0) vL0.addEventListener("mousedown", e => {
    if (e.button !== 0 || e.metaKey || e.altKey) return;
    e.preventDefault();
    vL0.classList.add("drag");
    document.body.classList.add("dragging");
    if (document.body.dataset.hov) document.body.dataset.hov = "";
    // Под замком (🔒) стрелки ←/→ двигают ИМЕННО эту границу (activeBorderId) — см. её же ветку
    // в обработчике клавиш, fold-4-tools.js.
    activeBorderId = "vsplitL0";
    lastGrabWasBorder = true;
    panL0 = { x0: e.clientX, moved: false, lhDrag: makeLhVDrag(e.clientY),
              baseL: patOffL || 0, baseC: st.axisCenterOffset || 0, baseR: patOffR || 0 };
  });
  window.addEventListener("mousemove", e => {
    if (!panL0) return;
    if (!(e.buttons & 1)) {
      panL0 = null; vL0.classList.remove("drag"); document.body.classList.remove("dragging");
      return;
    }
    panL0.lhDrag(e.clientY, !!e.ctrlKey);   // ВНИЗ — строки расходятся, ВВЕРХ — сходятся, только с Ctrl
    const dx = e.clientX - panL0.x0;
    if (!panL0.moved) {
      if (Math.abs(dx) < PAN_L0_DEAD_PX) return;
      panL0.moved = true;
    }
    const step = realColStepPx() || 8;
    let d = Math.round(dx / step);
    // Стопор влево — до нуля (упор в левый край экрана), не в минус. Общий для всех трёх, чтобы
    // не разъезжались между собой при повторных протяжках этой же ручкой.
    const floorD = -Math.min(panL0.baseL, panL0.baseC, panL0.baseR);
    if (d < floorD) d = floorD;
    patOffL = panL0.baseL + d;
    patOffR = panL0.baseR + d;
    st.axisCenterOffset = panL0.baseC + d;
    axisPinCol = axisBaseCol() + st.axisCenterOffset;
    render();
  });
  window.addEventListener("mouseup", () => {
    if (!panL0) return;
    const moved = panL0.moved;
    panL0 = null;
    if (vL0) vL0.classList.remove("drag");
    document.body.classList.remove("dragging");
    if (!moved) return;
    saveCache();
  });
}


/* Ширина ПРАВОЙ колонки паттернов — по самому длинному паттерну, чтобы он влезал целиком, а не
   обрезался многоточием (запрос пользователя). Считается тем же шагом столбца, что и биты
   (realColStepPx — ширина символа + letter-spacing), плюс собственные отступы .pat2
   (padding-left:4px + padding-right:28px под бейдж номера шага) и небольшой запас.
   Как только пользователь сам подвинул ручку .vsplit2 — автоподбор отключается (patW2Manual),
   иначе следующий же render() отменил бы ручную ширину. Флаг живёт вместе с самой шириной в
   настройках вида (см. saveCache/applyUiSettings). */
/* Позиции вертикальных разделителей .vsplit/.vsplit2 — по РЕАЛЬНОЙ геометрии колонок, а не по
   CSS-формуле от краёв .chain. Формула работала, пока строка всегда была ровно шириной с полотно;
   теперь строка может быть ШИРЕ него (колонки паттернов раздвинуты ручками, включается
   горизонтальная прокрутка — см. .bits/--bits-w), и правый разделитель, отмеренный от правого
   края .chain, уезжал далеко от самой колонки паттернов (запрос пользователя "уехала верт.
   граница у правых паттернов"). Меряем по первой реальной строке: правый край .pat и левый край
   .pat2 — это и есть стыки, где линии должны стоять. */
function updateSplitPositions(){
  const chainEl = document.getElementById("chain");
  if (!chainEl) return;
  const row = document.querySelector("#rows .ln") || document.querySelector(".chain-head");
  if (!row) return;
  const cr = chainEl.getBoundingClientRect();
  const v1 = document.getElementById("vsplit"), v2 = document.getElementById("vsplit2"), v3 = document.getElementById("vsplit3");
  const patEl = row.querySelector(".pat"), pat2El = row.querySelector(".pat2"), bitsEl = row.querySelector(".bits");
  // П1 | Цепочки — граница по правому краю левой колонки паттернов.
  if (v1 && patEl && !document.body.classList.contains("hide-pat-l")) {
    v1.style.left = (patEl.getBoundingClientRect().right - cr.left + 1) + "px";
    v1.style.right = "auto";
  }
  // ВНЕШНИЙ край П1 (v0.986) — по ЛЕВОМУ краю той же колонки. Зона захвата 11px (см. CSS)
  // центрируется на самой границе, а не прижимается к ней одним краем, как у остальных трёх —
  // снаружи П1 больше нет соседнего поля, которое отъело бы половину места под руку.
  const v0 = document.getElementById("vsplitL0");
  if (v0 && patEl && !document.body.classList.contains("hide-pat-l")) {
    v0.style.left = (patEl.getBoundingClientRect().left - cr.left - 5) + "px";
    v0.style.right = "auto";
  }
  // Цепочки | П2 — по правому краю поля битов (если правая колонка скрыта, всё равно показываем
  // границу: ею тянут ширину среднего столбца).
  if (v2 && bitsEl) {
    v2.style.left = (bitsEl.getBoundingClientRect().right - cr.left + 1) + "px";
    v2.style.right = "auto";
  }
  // Правый край П2 — им тянется ширина самой правой колонки.
  if (v3 && pat2El && !document.body.classList.contains("hide-pat-r")) {
    v3.style.left = (pat2El.getBoundingClientRect().right - cr.left + 1) + "px";
    v3.style.right = "auto";
  }
}

/* Ширину ЛЕВОЙ колонки паттернов тоже подбираем автоматически (v0.862, запрос пользователя
   "убери отступы слева от паттернов левых"): раньше она держалась на фиксированных 12em из CSS, и
   при коротких паттернах (или совсем без них) слева от цепочки оставалась широкая пустая полоса.
   Флаг тот же по смыслу, что и patW2Manual: подвинул ручку #vsplit руками — автоподбор выключен,
   иначе следующий render() отменил бы ручную ширину. */
var patWManual = false;
var patW2Manual = false; // var, а не let: и saveCache(), и render() могут дотянуться до флага
                         // раньше, чем выполнится эта строка (у let это была бы TDZ-ошибка)
// Ширину среднего столбца (поля цепочек) тянули руками — render() больше не пересчитывает
// --bits-w по длине самой длинной строки, ширина остаётся ровно той, что выставили.
var bitsWManual = false;
function fitPatW(){
  if (patWManual) return;
  let maxLen = 0;
  for (const p of (st.pats || [])) if (p && p.text && p.text.length > maxLen) maxLen = p.text.length;
  const step = realColStepPx() || 8;
  // Паттернов нет вовсе — колонка сжимается до минимума, а не держит пустые 12em.
  // +32 — собственные отступы .pat (слева 0, справа 28px под бейдж «#N») плюс небольшой запас;
  // плюс ширина номера, если он включён внутри П1 (body.patnum-l).
  const numW = st.patNumL
    ? (parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--num-w")) || 0) : 0;
  const w = Math.max(40, Math.min(1200, Math.round(maxLen * step) + 32 + numW));
  document.documentElement.style.setProperty("--pat-w", w + "px");
}
function fitPatW2(){
  if (patW2Manual) return;
  let maxLen = 0;
  for (const p of (st.pats || [])) if (p && p.text && p.text.length > maxLen) maxLen = p.text.length;
  if (!maxLen) return;
  const step = realColStepPx() || 8;
  // Номер строки внутри ячейки П2 (если включён кнопкой «№», см. body.patnum-r) съедает часть её
  // ширины — box-sizing:border-box. Без прибавки его ширины автоширина резала бы длинные паттерны
  // ровно на номер.
  const numW = (st.patNumR === false) ? 0
    : (parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--num-w")) || 0);
  const w = Math.max(40, Math.min(1200, Math.round(maxLen * step) + 36 + numW));
  document.documentElement.style.setProperty("--pat-w2", w + "px");
}

/* Ширина колонки номеров строк (--num-w, см. .num в CSS). Меряется по РЕАЛЬНОЙ раскладке —
   невидимым span'ом с тем же классом .num внутри таблицы, поэтому учитывает и текущий шрифт
   цепочки (--chain-fs), и letter-spacing (--chain-ls), которые пользователь крутит ползунками.
   Ширина ставится ОДНА на все строки и на линейку столбцов: иначе строка с более длинным номером
   раздувает свой бокс (у flex-элемента min-width:auto) и уезжает вправо относительно соседей —
   ровно это и было со 100-й строки, когда номер становился трёхзначным. Нижняя граница — ширина
   двузначного номера, чтобы на коротких списках вид остался прежним (2em ≈ "00"). */
var numProbeEl = null; // var, а не let: render() может вызвать fitNumW() раньше этой строки (TDZ)
/* extraHtml (v0.889) — «болванка» самой широкой метки баланса: с этой версии баланс печатается
   ВНУТРИ поля номера (см. render()/balanceSampleHtml()), значит и место под него держит та же
   --num-w. Меряем номер ВМЕСТЕ с этой болванкой, в той же разметке (класс .row-balance со своим
   font-size и padding) — иначе метка раздувала бы бокс номера и вся строка ехала бы вправо. */
function fitNumW(numPadW, extraHtml){
  const host = document.getElementById("rows");
  if (!host) return;
  // render() перезаписывает innerHTML целиком — линейку каждый раз создаём заново.
  if (!numProbeEl || !numProbeEl.isConnected || numProbeEl.parentNode !== host) {
    numProbeEl = document.createElement("span");
    numProbeEl.className = "num num-probe";
    host.appendChild(numProbeEl);
  }
  const pad = "0".repeat(Math.max(1, numPadW | 0));
  // ДВЕ РАЗНЫЕ ШИРИНЫ (v0.904, запрос пользователя "при включении/откл балансов ось не должна
  // прыгать"). Раньше --num-w была одна на всех, а с v0.889 в неё входит ещё и метка баланса —
  // и её ширину получали ЗАОДНО номера ВНУТРИ ячеек паттернов (.num-r2/.num-p1), которые никаких
  // балансов не показывают. Хуже того, fitPatW()/fitPatW2() прибавляют --num-w к ширине САМИХ
  // колонок паттернов: включение балансов раздувало обе колонки на ширину метки, поле цепочек
  // уезжало вправо на двойную величину, а вместе с ним прыгала и ось.
  //   --num-w  — чистый номер в кегле паттерна: для .num-r2/.num-p1 и для fitPatW/fitPatW2.
  //              Балансы на неё не влияют вообще, поэтому колонки паттернов стоят на месте.
  //   --numl-w — номер ПЛЮС болванка самой широкой метки баланса, в кегле поля цепочек (.85em):
  //              только для .num-l2, где метка и печатается.
  // Номер и там и там ВСЕГДА десятичный и уже добит пробелами до общей ширины numPadW (см.
  // render()); отдельного замера самого отрицательного номера не нужно — минус у построений уже
  // учтён в самом numPadW, он считается по обоим краям цепочки.
  numProbeEl.className = "num num-probe";
  numProbeEl.textContent = pad;
  const wNum = Math.ceil(numProbeEl.getBoundingClientRect().width) + 1;
  // Болванку меряем в той же разметке, в какой она печатается: класс .num-l2 (свой кегль .85em)
  // плюс сама метка в .row-balance (свой font-size и padding).
  numProbeEl.className = "num num-l2 num-probe";
  numProbeEl.innerHTML = pad + (extraHtml || "");
  const wL = Math.ceil(numProbeEl.getBoundingClientRect().width) + 1;
  if (wNum > 0) document.documentElement.style.setProperty("--num-w", wNum + "px");
  if (wL > 0) document.documentElement.style.setProperty("--numl-w", wL + "px");
}

/* Ручка переноса начала отсчёта столбцов — запрос пользователя "для каждого выравнивания нужна
   эта передвигающая начало линия столбца": раньше была видна и работала ТОЛЬКО под "⊙ Ось"/
   "Ось 1/2", теперь двигает st.axisCenterOffset ДЛЯ ЛЮБОГО выравнивания (см. alignShift()/
   resolveAxisBitShift-ветки, где offset теперь тоже прибавляется). Перетаскиваемая граница НАД
   линейкой столбцов (не во всю высоту, как #vsplit/#vsplit2, чтобы не наезжать на сами биты
   строк). В отличие от .vsplit/.vsplit2 (сдвигают CSS-переменную ширины панели), тут тянем
   st.axisCenterOffset — целое число СИМВОЛОВ (колонок), пересчитывается из пикселей через
   ширину одного символа линейки (.col-cell). */
function axisCharWidthPx(){
  const cell = document.querySelector("#colHeader .col-cell");
  if (cell) { const w = cell.getBoundingClientRect().width; if (w > 0) return w; }
  return 8; // разумный запасной вариант, если линейка ещё не отрисована
}
/* Настоящий шаг столбца внутри .bits, В ОТЛИЧИЕ от axisCharWidthPx() (та меряет .col-cell —
   display:flex, letter-spacing на flex-items не действует). Строки битов — обычный inline-текст
   (span'ы внутри одного span'а), там letter-spacing реально раздвигает символы.
   Меряем НАПРЯМУЮ по уже отрисованному DOM — расстояние между двумя реальными соседними битами
   (data-col N и N+1) в первой попавшейся строке, где такая пара есть. Раньше здесь стоял
   canvas.measureText("0")+letter-spacing (тот же приём, что applySquareCellLs()) — но выяснилось,
   что Canvas 2D измеряет текст НЕ идентично тому, как браузер реально раскладывает inline-текст
   со letter-spacing (используется наверное другой алгоритм субпиксельного округления) — на
   большом сдвиге (сотни колонок) эта мелкая на 1 символ погрешность накапливалась в заметный
   перекос столбцов (запрос пользователя — "строки уезжают" даже после перехода на px). Прямой
   замер по DOM такой ошибки не копит вообще — это и есть окончательный источник истины.
   Используется и в drag-обработчике #axisSplit (перевод px мыши в колонки), и в
   updateAxisSplitPosition() (запасной путь, если бит-элемента ещё нет), и в render() (transform
   довеска extraCh) — везде должен быть ОДИН И ТОТ ЖЕ шаг. */
/* КЭШ ЗАМЕРА. Сам замер дорогой: querySelectorAll по ВСЕМ битам строки + два
   getBoundingClientRect (а это принудительный пересчёт раскладки), и зовётся он по 3-4 раза за
   ОДИН render() (renderColHeader → offAttr, colStepPx, --bits-w, fitPatW2). На картинке
   1000x1000 каждый такой вызов перебирает тысячу узлов — четыре полных пересчёта раскладки на
   кадр только ради одного и того же числа.
   Шаг столбца зависит ТОЛЬКО от шрифта, его размера и letter-spacing — от СОДЕРЖИМОГО строк он
   не зависит вообще, поэтому ключ кэша строим по этим трём CSS-переменным: поменял пользователь
   ползунок — ключ разошёлся, меряем заново; не поменял — отдаём прошлое число.
   Результат canvas-прикидки (ветка ниже, когда строк в DOM ещё нет) НЕ кэшируем: он
   приблизительный и обязан смениться настоящим замером, как только строки отрисуются.
   var, а не let: realColStepPx() может быть вызвана из render() ещё на инициализации, раньше
   этой строки (у let это была бы TDZ-ошибка — в этом файле уже наступали на такое дважды). */
var colStepCache = null; // {key, val}
function colStepCacheKey(){
  const cs = getComputedStyle(document.documentElement);
  return (cs.getPropertyValue("--chain-fs") || "") + "|" +
         (cs.getPropertyValue("--chain-ff") || "") + "|" +
         (cs.getPropertyValue("--chain-ls") || "");
}
function realColStepPx(){
  const cacheKey = colStepCacheKey();
  if (colStepCache && colStepCache.key === cacheKey) return colStepCache.val;
  const rowsEl = document.getElementById("rows");
  if (rowsEl) {
    for (const row of rowsEl.children) {
      // СЧИТАЕМ КОЛОНКИ ПО СИМВОЛАМ, а не по числу span'ов. Раньше здесь бралось
      // querySelectorAll(".bits .b0, .bits .b1") и расстояние делилось на (число span'ов - 1) —
      // это верно, только если КАЖДЫЙ бит лежит в собственном span'е с классом b0/b1. Оба условия
      // больше не выполняются: биты с одинаковым оформлением теперь склеены в один span (см. emit()
      // в render()), да и раньше между крайними битами могли попасться span'ы БЕЗ b0/b1
      // (.hit, .xored-bit, .env-diag) и голый текст паддинга — они в счёт не входили, и делитель
      // выходил меньше настоящего числа колонок, т.е. шаг завышался.
      // Идём по плоскому списку узлов строки (.bits > span — тот самый враппер с extraCh-
      // трансформом, внутри него всё лежит одним уровнем) и накапливаем номер колонки по ДЛИНЕ
      // ТЕКСТА каждого узла: и "&nbsp;" паддинга, и многосимвольный склеенный span, и одиночный
      // бит считаются одинаково честно — один символ = одна колонка.
      const wrap = row.querySelector ? row.querySelector(".bits > span") : null;
      if (!wrap) continue;
      let col = 0, firstEl = null, firstCol = 0, lastEl = null, lastCol = 0;
      for (const node of wrap.childNodes) {
        const len = (node.textContent || "").length;
        // Крайними точками замера годится ЛЮБОЙ элемент (у текстового узла нет своего
        // прямоугольника) — его левый край стоит ровно на колонке, посчитанной до него.
        if (node.nodeType === 1 && len > 0) {
          if (!firstEl) { firstEl = node; firstCol = col; }
          lastEl = node; lastCol = col;
        }
        col += len;
      }
      if (!firstEl || firstEl === lastEl || lastCol === firstCol) continue;
      // Меряем на ВСЮ длину строки (первый элемент → последний), а не по одной соседней паре: одна
      // пара даёт расстояние в один символ, и субпиксельная погрешность этого замера потом
      // умножается на сотни колонок сдвига. Деление длинной базы на число колонок между ними
      // усредняет её и даёт шаг с точностью, которой хватает на любой сдвиг.
      const d = (lastEl.getBoundingClientRect().left - firstEl.getBoundingClientRect().left) / (lastCol - firstCol);
      // Кэшируем ТОЛЬКО настоящий замер по DOM (см. colStepCache выше) — он и есть источник истины.
      if (d > 0) { colStepCache = { key: cacheKey, val: d }; return d; }
    }
  }
  // Запасной вариант — строки ещё не отрисованы (самый первый рендер) — canvas-оценка.
  const fsPx = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--chain-fs")) || 12;
  const ff = getComputedStyle(document.documentElement).getPropertyValue("--chain-ff").trim() || '"Roboto Mono", Consolas, monospace';
  const ls = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--chain-ls")) || 0;
  const c = document.createElement("canvas");
  const ctx = c.getContext("2d");
  ctx.font = fsPx + "px " + ff;
  const w = ctx.measureText("0").width + ls;
  return w > 0 ? w : 8;
}
/* Значение st.axisCenterOffset, при котором ручка #axisSplit встаёт РОВНО ПОСЕРЕДИНЕ видимой
   области битов (между колонками паттернов .pat/.pat2, т.е. между #vsplit и #vsplit2).
   ПЕРЕКЛЮЧЕНИЕ ВЫРАВНИВАНИЯ сюда больше НЕ сбрасывает — теперь ось остаётся на своём столбце
   (см. обработчик #alignGrp), функция оставлена как готовый "сброс оси на центр".
   Середина видимой области = столбец maxLen/2 — та же величина, что и статическая ось
   у "⊙ Ось" (см. axisRowShift()).
   Для не-⊙ выравниваний линия привязана к ПЕРВОМУ БИТУ ПЕРВОЙ строки (см.
   updateAxisSplitPosition() ниже), поэтому нужный offset = (середина) − (собственный сдвиг этого
   выравнивания). alignShift()/resolveAxisBitShift() теперь offset НЕ включают вообще (он —
   отдельный общий визуальный сдвиг картинки, см. комментарий в alignShift()), так что их
   результат и есть искомый собственный сдвиг, без каких-либо поправок. */
/* Ограничение ручки #axisSplit: ось цепочек НЕ ДОЛЖНА выходить за колонки паттернов (запрос
   пользователя). Раньше drag-обработчик писал st.axisCenterOffset = startOffset + deltaCols вообще
   без границ, и линию можно было утащить хоть на сотни колонок — вместе со всей картинкой, под
   колонки паттернов и за экран.
   Позиция линии линейна по offset с шагом ровно в одну колонку (см. updateAxisSplitPosition), так
   что достаточно загнать в пределы САМ НОМЕР СТОЛБЦА, на котором стоит ось: 0 — левый край поля
   битов (граница с левой колонкой паттернов), colsMax — правый (граница с правой).
   Ширину поля меряем по реальной геометрии .bits, а не считаем из maxLen: средний столбец тянут
   руками за #vsplit2 (--bits-w, bitsWManual), и расчёт по длине строк тут расходился бы с тем, что
   на экране. Столбец оси при offset = 0 берём той же формулой, что и updateAxisSplitPosition, —
   иначе зажим считал бы одно, а линия рисовалась по другому. */
/* Столбец, на котором ось стоит при st.axisCenterOffset = 0, для ТЕКУЩЕГО выравнивания — то есть
   собственная точка отсчёта режима. Фактический столбец оси = axisBaseCol() + axisCenterOffset
   (та же формула, что в updateAxisSplitPosition). Вынесено отдельно, потому что этим же счётом
   живут clampAxisOffset(), centerAxisOffset() и удержание оси на месте при смене выравнивания. */
function axisBaseCol(){
  let maxLen = 0;
  for (const s of st.rows) if (s.length > maxLen) maxLen = s.length;
  // ПЕРВЫЙ БИТ ПЕРВОЙ СТРОКИ — точка отсчёта оси у ВСЕХ выравниваний без исключения (запрос
  // пользователя: "сделай, чтобы первый бит первой строки всегда был на оси у всех выравниваний").
  // Раньше у "⊙ Ось"/"Ось 1.2" тут стояла середина картинки (maxLen/2), и ось жила отдельной от
  // строк жизнью: середина зависит от длины самой длинной строки, поэтому на любое изменение
  // цепочки ось и биты разъезжались. Теперь ось привязана к самим данным, а rowShiftFor() знает
  // геометрию любого режима (оси, осевые по биту, лесенки) — отдельные случаи не нужны.
  const fd = firstRealRowIdx();
  if (fd < 0) return 0;
  return rowShiftFor(maxLen, fd, st.rows[fd] || "", st.align);
}
/* УДЕРЖАНИЕ ОСИ (запрос пользователя: "надо держать её", "при изменении числа строк биты уезжают
   влево... ось стоит на месте, двигать её нельзя"). У каждого выравнивания своя точка отсчёта —
   axisBaseCol(): у "⊙ Ось"/"Ось 1.2" это столбец maxLen/2, у остальных — сдвиг первой строки с
   данными. Обе зависят от того, что в цепочке лежит: подросли строки (достройка до квадрата,
   вставка, генерация), сдвинули ползунок числа строк, поменяли первую строку — точка отсчёта
   уезжает, и вместе с ней прыгает ВСЯ картинка, хотя пользователь ничего не двигал.
   Держим: точка отсчёта сместилась — ровно на столько же двигаем общий визуальный сдвиг в другую
   сторону. Ось и картинка остаются на своих местах, а вся остальная геометрия по-прежнему
   считается по обычным формулам выравнивания.
   Исключение — "ОсьБит"/"ОсьБит ½": там точка отсчёта это сдвиг первой строки, который двигает
   САМ пользователь, и удержание съедало бы его движение. Смену выравнивания держит свой код
   (см. обработчик #alignGrp), он с этим согласован — обе поправки дают один и тот же столбец. */
var axisPinCol = null;
function holdAxisOnMaxLenChange(maxLen){
  // "ОсьБит"/"ОсьБит ½" — единственные, кого держать НЕЛЬЗЯ: их точка отсчёта (сдвиг первой строки)
  // двигается самим пользователем, и удержание съедало бы этот сдвиг — строка вставала бы обратно.
  if (st.align === "axisbit" || st.align === "axisbit12") { axisPinCol = null; return; }
  const base = axisBaseCol();
  // ЗАКРЕПЛЁННЫЙ СТОЛБЕЦ, а не накопительная поправка. Раньше тут копилась разница точек отсчёта,
  // и любой ДРУГОЙ путь, меняющий сдвиг (зажим по краям, загрузка из кэша, смена выравнивания),
  // сбивал накопление — ось после этого уезжала сама, чаще всего влево, при перетаскивании
  // ползунка числа строк (запрос пользователя). Теперь столбец оси — самостоятельное значение:
  // сдвиг из него ВЫЧИСЛЯЕТСЯ каждый кадр, поэтому сбить его нечем, а меняют его только явные
  // действия — перетаскивание ручки оси и жёсткие зажимы (они синхронизируют закреплённый столбец
  // сразу, чтобы следующий кадр не отменил их работу).
  if (axisPinCol == null) { axisPinCol = base + (st.axisCenterOffset || 0); return; }
  // Точка отсчёта уехала (изменилось число строк ползунком, длина строк, содержимое первой
  // строки) — на столько же двигаем общий визуальный сдвиг обратно. Ось и картинка остаются на
  // своих местах, двигать их руками не приходится (запрос пользователя: "при изменении числа
  // строк биты уезжают влево... ось стоит на месте, двигать её нельзя").
  st.axisCenterOffset = axisPinCol - base;
}
/* ПОПРАВКА "ФОРМУЛА → ЭКРАН", в столбцах (запрос пользователя: "до левого паттерна не доходит,
   застопоривается, на центральном выравнивании").
   Положение строк на экране браузер считает по РЕАЛЬНОЙ ширине символа, а весь наш счёт колонок —
   по canvas.measureText() (realColStepPx). Расходятся они на доли пикселя, но сдвиг у "По центру"
   с короткой первой строкой — сотни колонок, и разница копится в заметный промах: формула уже
   говорит "ось на нулевом столбце", а бит на экране всё ещё правее границы с колонкой паттернов,
   и перетаскивание останавливается, не дойдя до края.
   Сам промах уже измеряется каждый кадр — updateAxisSplitPosition() кладёт его в axisMeasureFix.dx
   (замер минус формула, в пикселях), чтобы ставить ЛИНИЮ по месту. Здесь тот же промах переводится
   в столбцы и раздвигает границы зажимов ровно на него: тогда предел считается по тому, где бит
   стоит НА САМОМ ДЕЛЕ, и ось доезжает до обеих границ вплотную.
   Знак учитывается сам собой: промах вправо (dx>0) отпускает ручку дальше влево, промах влево
   (dx<0) наоборот придерживает её раньше, чтобы биты не залезли под паттерны.
   Пока не измерено (первый кадр, первая строка виртуализирована и не попала в DOM) — 0, то есть
   ровно прежнее поведение по формуле. Дикие значения отбрасываем: лучше зажать по формуле, чем
   отпустить ось в никуда из-за случайного замера. */
/* ГДЕ ОСЬ СТОИТ НА ЭКРАНЕ — пиксель левого края первого бита первой строки с данными, в
   координатах #chain. Прямой замер DOM, без формул: именно по этому месту updateAxisSplitPosition()
   ставит линию, и именно его надо удерживать при переключении выравниваний (запрос пользователя:
   "уезжает, дёргается ось при переключении") — формула и экран расходятся тем сильнее, чем больше
   сдвиг, а он у выравниваний разный, поэтому "тот же столбец" и "то же место" — не одно и то же.
   ".b0,.b1" (а не просто "span") — иначе первым найденным span'ом мог оказаться
   <span class="col-sel-bit"> ИЗ ПАДДИНГА (см. blankRun(): режим "🔢 Выбор столбца" красит ОДНУ
   пустую клетку ДО настоящего бита, если st.selectedCol туда попадает), и замер промахивался бы на
   весь отступ. "[data-col]" тут тоже не годится — он есть только у строк внутри colSelectRowRange().
   null — мерить нечего: цепочка пуста или первая строка виртуализирована и в DOM её нет. */
function axisScreenPx(){
  const chainEl = document.getElementById("chain");
  const fd = firstRealRowIdx();
  if (!chainEl || fd < 0) return null;
  const wrapEl = document.querySelector('#rows .ln[data-idx="' + fd + '"] .bits > span');
  const bitEl = wrapEl ? wrapEl.querySelector(".b0, .b1") : null;
  if (!bitEl) return null;
  return bitEl.getBoundingClientRect().left - chainEl.getBoundingClientRect().left;
}
/* РЕАЛЬНАЯ ширина одного символа бит — по уже отрисованному span'у: в нём склеен ПРОБЕГ одинаковых
   бит (см. emit/flushRun в render), поэтому ширина/длина даёт ровно один знак. Нужна там, где
   промах в доли пикселя виден глазом (полшага для линии оси в "½"-выравниваниях): realColStepPx()
   меряет шрифт через canvas.measureText и с реальной раскладкой браузера совпадает не идеально —
   ровно та же причина, по которой позиция самой линии берётся замером, а не формулой. */
function realBitCharPx(){
  const fd = firstRealRowIdx();
  if (fd < 0) return 0;
  const wrapEl = document.querySelector('#rows .ln[data-idx="' + fd + '"] .bits > span');
  const bitEl = wrapEl ? wrapEl.querySelector(".b0, .b1") : null;
  const len = bitEl ? (bitEl.textContent || "").length : 0;
  if (!len) return 0;
  return bitEl.getBoundingClientRect().width / len;
}
function axisDrawFixCols(){
  const chPx = realColStepPx();
  if (!(chPx > 0) || !axisMeasureFix || !axisMeasureFix.dx) return 0;
  const c = axisMeasureFix.dx / chPx;
  return (c > -1000 && c < 1000) ? c : 0;
}
function clampAxisOffset(off, maxLen){
  const bitsEl = document.querySelector("#colHeader .bits") || document.querySelector(".ln .bits");
  if (!bitsEl || !maxLen) return off;
  const chPx = realColStepPx();
  if (!(chPx > 0)) return off;
  const base = axisBaseCol();
  // Границы — по РЕАЛЬНОМУ положению бита, а не по формуле (см. axisDrawFixCols выше). Округляем
  // наружу: лучше отпустить на неполный столбец дальше — линию всё равно придержит жёсткий зажим
  // по полосе бит в updateAxisSplitPosition(), и она сядет ровно на границу.
  const fix = axisDrawFixCols();
  const lo = Math.floor(-base - fix);
  /* ПРАВОГО ПОТОЛКА БОЛЬШЕ НЕТ (v0.974, запрос пользователя: "убери запрет правой границы
     двигаться вправо за ось центральную"). Раньше здесь стоял hi = colsMax - base - fix, то есть
     сдвиг зажимался шириной ПОЛОСЫ БИТ: центральное поле не могло уехать вправо дальше
     собственной коробки и утыкалось в границу с П2. После v0.973, где .bits рисуется ПОВЕРХ
     колонок паттернов, этот потолок стал единственным, что мешало полю «заезжать своим центром
     на биты крайних полей», — снят.
     Левый зажим оставлен намеренно: он не декоративный, а держит точку отсчёта столбцов от ухода
     в отрицательные номера, на которых ломается вся арифметика колонок (data-col, линейка,
     склейки). colsMax теперь не нужен вовсе. */
  /* ЛЕВОГО ЗАЖИМА ТОЖЕ БОЛЬШЕ НЕТ (v0.976, запрос пользователя: "пусть все биты прямо до края
     могут наезжать, сейчас какой-то стопор есть"). Это и был последний стопор центрального поля:
     влево оно упиралось ровно в столбец 0 и дальше на биты П1 не заезжало.
     ПОЧЕМУ ЭТО БЕЗОПАСНО СЕЙЧАС И НЕ БЫЛО РАНЬШЕ: с v0.973 st.axisCenterOffset — ЧИСТО
     ВИЗУАЛЬНЫЙ сдвиг, он применяется одним transform'ом ко всей картинке разом (extraCh в
     render(), тот же довесок к линейке столбцов в renderColHeader()) и в геометрию строк не
     входит — alignShift() его не видит. То есть отрицательный сдвиг двигает КАРТИНКУ, а нумерация
     столбцов у данных остаётся своей, от нуля.
     Правило вынесено флагом, а не удалено: если где-то всплывёт счёт колонок, зависящий от знака
     (кандидат — colAtEvent/выбор столбцов), вернуть прежнее поведение — это true, одна правка. */
  const AXIS_OFFSET_CLAMP_LEFT = false;
  return AXIS_OFFSET_CLAMP_LEFT ? Math.max(lo, off) : off;
}
function centerAxisOffset(){
  let maxLen = 0;
  for (const s of st.rows) if (s.length > maxLen) maxLen = s.length;
  if (!maxLen) return 0;
  // Точка отсчёта теперь одна на все режимы (первый бит первой строки, см. axisBaseCol), поэтому
  // и центрирование считается одинаково: сдвиг, при котором эта точка встаёт на середину.
  return Math.floor(maxLen / 2) - axisBaseCol();
}
/* Пересчитывает position:absolute left/height/видимость #axisSplit — вызывается в конце
   render(). Столбец, где стоит линия: у "⊙ Ось"/"Ось 1/2" — maxLen/2 + axisCenterOffset (та же
   формула, что и в axisRowShift()) — там offset двигает ОСЬ ПОСЕРЕДИНЕ. У ЛЮБОГО другого
   выравнивания линия должна стоять РОВНО на первом символе первой (реально существующей) строки
   (запрос пользователя — "привязана к первому символу первой строки", а раньше ошибочно считалось
   axisCol=offset, т.е. как у "По левому краю", где это совпадает случайно: shift="По левому краю"
   как раз ВСЕГДА равен offset — а у "center"/"stairs"/т.п. первая строка сама по себе уже сдвинута
   на свой собственный alignShift(), офсет только ДОБАВЛЯЕТСЯ к нему — без этой строки линия
   стояла в другом месте, чем реальный первый бит первой строки, у всех выравниваний, кроме
   "По левому краю"). alignShift()/resolveAxisBitShift() сами уже прибавляют offset внутри себя —
   тут просто читаем ИХ РЕЗУЛЬТАТ для первой строки, как это делает и сам render() (см. shift
   в цикле рендера строк выше). Переводим в пиксели через реальный левый край .bits (зависит от
   текущей ширины панелей паттернов — .vsplit/.vsplit2 не участвуют в формуле напрямую, поэтому
   меряем фактическую геометрию, а не считаем через CSS-переменные). document.getElementById()
   каждый раз заново (не кэшируем в const на верхнем уровне) — эта функция ВЫЗЫВАЕТСЯ из render(),
   а render() дёргается местами ещё ДО того, как скрипт дойдёт до этого места (см. остальные
   render() выше по файлу) — кэш в const поймал бы temporal dead zone. */
/* Поправка "замер минус формула" для линии оси — см. её использование ниже. var по той же причине,
   что и остальные кэши: функция вызывается из render(), а тот дёргается ещё до этой строки. */
var axisMeasureFix = { key: null, dx: 0 };
/* Выравнивания "на полсимвола" (кнопки с "½") — у них линия оси рисуется по ЦЕНТРУ знака, а не по
   границе столбца, см. ниже в updateAxisSplitPosition(). */
const HALF_ALIGNS = new Set(["halfcenter", "halfstairs", "rhalfstairs", "axis12", "axisbit12"]);
function updateAxisSplitPosition(maxLen){
  const axisSplitEl = document.getElementById("axisSplit");
  if (!axisSplitEl) return;
  if (!maxLen) { axisSplitEl.classList.remove("act"); return; }
  const chainEl = document.getElementById("chain");
  const bitsEl = document.querySelector("#colHeader .bits") || document.querySelector(".ln .bits");
  const colHeaderEl = document.getElementById("colHeader");
  if (!chainEl || !bitsEl) { axisSplitEl.classList.remove("act"); return; }
  const chainRect = chainEl.getBoundingClientRect();
  const bitsRect = bitsEl.getBoundingClientRect();
  const chPx = realColStepPx();
  // Отдельной ветки для "⊙ Ось"/"Ось 1.2" больше нет: линия у всех выравниваний стоит на первом
  // бите первой строки (см. axisBaseCol), а он есть в DOM — значит и мерить его можно напрямую,
  // тем же путём, каким это уже делалось для остальных режимов.
  let leftPx, axisMeasured = null;   // axisMeasured — замер реального бита, нужен ещё и зажиму ниже
  {
    // Меряем НАПРЯМУЮ из уже отрисованного DOM первой существующей строки (её .bits > span —
    // тот самый span с extraCh-трансформом, см. render() — внутри первый настоящий бит-span
    // ".b0"/".b1" стоит СРАЗУ на реальной позиции строки: паддинг перед ним — просто текстовые
    // "&nbsp;", не спаны). Раньше здесь пересчитывали то же самое формулой (alignShift() *
    // chPx) — совпадает с реальным рендером только при МАЛЫХ сдвигах: canvas.measureText()
    // (см. realColStepPx()) даёт чуть другую ширину символа, чем реальная раскладка текста
    // браузером, и на большом сдвиге (напр. "По центру" с короткой первой строкой — там
    // сдвиг может быть сотни колонок) эта мелкая на один символ погрешность накапливается в
    // заметный пиксельный промах (запрос пользователя — "не совпадает, только у центрального").
    // Прямой замер геометрии такой ошибки не копит вообще.
    // ".b0,.b1" (а не просто "span") — иначе первым найденным span'ом мог оказаться
    // <span class="col-sel-bit"> ИЗ ПАДДИНГА (см. blankRun() — режим "🔢 Выбор столбца" красит
    // ОДНУ пустую клетку ДО настоящего бита, если st.selectedCol туда попадает), и линия
    // промахивалась на весь отступ. "[data-col]" тут тоже не годится — он есть только у строк
    // внутри colSelectRowRange() (см. colAttr там же), а класс b0/b1 — у любого реального бита.
    const fd = firstRealRowIdx();
    const measured = axisMeasured = axisScreenPx();
    // Формулу считаем ВСЕГДА: она и запасной путь, и база для поправки ниже. offset прибавляется
    // здесь ЯВНО: alignShift()/resolveAxisBitShift() его больше не содержат (он — общий визуальный
    // сдвиг картинки, см. комментарий в alignShift()).
    const len0 = fd >= 0 ? (st.rows[fd] || "").length : 0;
    const axisCol = axisBaseCol() + (st.axisCenterOffset || 0);    const formulaLeft = (bitsRect.left - chainRect.left) + axisCol * chPx;
    // Ключ поправки: всё, от чего зависит расхождение замера с формулой. При простой прокрутке он
    // не меняется — значит поправка остаётся в силе и линия стоит там же.
    const fixKey = st.align + "|" + (st.axisCenterOffset || 0) + "|" + maxLen + "|" + len0 + "|" + fd + "|" + chPx;
    if (measured != null) {
      leftPx = measured;
      // Запоминаем, насколько замер разошёлся с формулой. При виртуализации первой строки с данными
      // в DOM может не быть вовсе (уехала за окно), и тогда доступна только формула — без этой
      // поправки линия оси прыгала бы при прокрутке туда-сюда.
      axisMeasureFix = { key: fixKey, dx: leftPx - formulaLeft };
    } else {
      leftPx = formulaLeft + (axisMeasureFix.key === fixKey ? axisMeasureFix.dx : 0);
    }
  }
  // ЖЁСТКИЙ ЗАЖИМ линии в полосу бит: на колонки паттернов она не заезжает НИКОГДА (запрос
  // пользователя). clampAxisOffset() держит сам сдвиг, но он умеет не сработать — полосы бит ещё
  // нет в DOM, шаг столбца не измерился, значение пришло из старого кэша, — а нарисовать линию
  // поверх паттернов нельзя ни в одном из этих случаев.
  /* ПОЛОВИННЫЕ ВЫРАВНИВАНИЯ — ЛИНИЯ ПО ЦЕНТРУ СИМВОЛА (v0.856, запрос пользователя: "сделай её по
     центру символа в 1/2 выравниваниях, и слева справа остальные"). У обычных выравниваний ось
     стоит на ГРАНИЦЕ столбца (слева от символа) — так она и должна стоять, столбцы там целые.
     А "½"-режимы двигают строки на полсимвола, и граница столбца приходится ровно на середину
     знака соседней строки — линия выглядела воткнутой в цифру сбоку. Сдвигаем её на полшага,
     чтобы она шла ПО ЦЕНТРУ символа. Сдвиг чисто визуальный: ни st.axisCenterOffset, ни расчёт
     столбца (axisBaseCol) он не трогает, поэтому перетаскивание и арифметика колонок прежние. */
  if (HALF_ALIGNS.has(st.align)) {
    // Полшага берём по РЕАЛЬНОЙ ширине знака (realBitCharPx), а не по chPx: chPx считан через
    // canvas.measureText и расходится с раскладкой браузера на доли пикселя — на полушаге это
    // видно глазом ("както не совсем по центру символа"). Плюс поправка на толщину самой линии:
    // ::before рисуется ОТ левого края, а по центру знака должна прийтись её середина.
    const charPx = realBitCharPx() || chPx;
    const lineW = 1.5;
    leftPx += charPx / 2 - lineW / 2;
  }
  /* ПОЛОСА ЗАЖИМА ОБЯЗАНА ВКЛЮЧАТЬ РЕАЛЬНО ИЗМЕРЕННЫЙ БИТ (v0.931, баг-репорт пользователя:
     "уходит ручка-ось от самих строк", на других цепочках нормально). bitsRect — габариты
     ЭЛЕМЕНТА .bits, а строки внутри него сдвинуты трансформом (extraCh, см. halfShiftAttr в
     render): у "Лесенки правой"/осевых режимов с большим st.axisCenterOffset биты уезжают за
     край собственной коробки. Коробка при этом не двигается — и зажим стаскивал линию на её
     край, за сотни пикселей от бита, на который она только что честно села по замеру
     (в цифрах пользователя: бит на 662, коробка с 930, линия оказалась на 927).
     Сам зажим нужен и остаётся — он не даёт нарисовать ось поверх колонок паттернов, когда
     позиция взята формулой (полосы бит ещё нет в DOM, шаг столбца не измерился, значение из
     старого кэша). Но замеренный бит по определению стоит там, где он нарисован, поэтому
     раздвигаем полосу до него: зажим продолжает ловить дикие значения и перестал спорить с
     реальной геометрией. */
  let bandLeft = bitsRect.left - chainRect.left;
  if (axisMeasured != null) bandLeft = Math.min(bandLeft, axisMeasured);
  /* ЗАЖИМ ТЕПЕРЬ ТОЛЬКО СЛЕВА (v0.974, та же правка, что и в clampAxisOffset выше). Прежний
     bandRight не давал ручке уйти правее полосы бит — вместе со снятым потолком сдвига он стал
     бессмысленным: сдвиг уезжает вправо, а ручка упиралась бы в край коробки и отставала от
     своей же оси. Слева зажим нужен по-прежнему — там за краем начинаются отрицательные номера
     столбцов. */
  leftPx = Math.max(bandLeft, leftPx);
  axisSplitEl.style.left = leftPx + "px";

  /* ДЛИНА РУЧКИ — ровно на ОДНУ СТРОКУ ниже линейки столбцов (v0.856, запрос пользователя:
     "ручку-ось укороти, пусть только на строку, на бит ложится"). Раньше тут стояли фиксированные
     46px "чтобы удобнее было хватать" — при плотном межстрочном это накрывало три-четыре верхних
     строки. Меряем ВЫСОТУ РЕАЛЬНОЙ СТРОКИ (она зависит от шрифта и ползунка межстрочного), а не
     считаем формулой: ровно столько линия и заезжает на биты — на один ряд, ни больше. */
  const rowEl = document.querySelector("#rows .ln");
  const rowH = rowEl ? rowEl.getBoundingClientRect().height : 16;
  const headBottom = colHeaderEl ? (colHeaderEl.getBoundingClientRect().bottom - chainRect.top) : 24;
  axisSplitEl.style.height = (Math.max(16, headBottom) + Math.max(8, rowH)) + "px";
  axisSplitEl.classList.add("act");
  // Полоса выравниваний (#alignGrp) — не по центру экрана, а РОВНО НАД ОСЬЮ первой строки, и
  // едет вместе с ручкой оси/границами столбцов (запрос пользователя). Считаем в координатах
  // .main-layout — именно от неё отсчитывается её position:absolute; transform:translateX(-50%)
  // из CSS ставит на ось её ЦЕНТР. По краям придерживаем, чтобы полоса не уехала за экран.
  const alignGrpEl = document.getElementById("alignGrp");
  const mainEl = alignGrpEl && alignGrpEl.offsetParent;
  if (alignGrpEl && mainEl) {
    const mainRect = mainEl.getBoundingClientRect();
    // На ось садится не центр полосы, а ЗАЗОР между её половинами (#alignAxisGap, v0.848): линия
    // проходит между группами кнопок, где её и можно схватить. Половины разной ширины, поэтому
    // "translateX(-50%)" тут больше не годится — считаем смещение зазора внутри полосы (offsetLeft
    // отсчитывается от неё же: она position:absolute, то есть сама себе offsetParent для детей).
    /* ПОЛОСА ЗАКРЕПЛЕНА (v0.976, запрос пользователя: "пусть верхняя панель вообще будет всегда
       закреплена"). Раньше её зазор (#alignAxisGap) садился РОВНО НА ОСЬ, и вся полоса ездила
       по горизонтали вместе с цепочкой: тянешь ось или поле — кнопки уползают следом, а крайние
       (◧ П1 / П2 ◨ / лесеночные счётчики) уходят за край экрана и становятся недоступны. Это
       стало окончательно неудобно, когда полоса превратилась в главный пульт полей: теперь ею
       переключают выравнивание не только цепочки, но и П1/П2 (см. alignTarget), а с v0.976 поля
       ещё и таскают мышью — полоса дёргалась бы на каждое движение.
       Теперь она стоит НАМЕРТВО по центру .main-layout и не зависит ни от оси, ни от сдвигов
       полей. Сама линия оси внутри полосы (#alignGrp::after по --axis-x) считается по-прежнему от
       реального положения оси — просто теперь она ездит ВНУТРИ неподвижной полосы, а если ось
       ушла за её край, линия прячется под overflow:hidden самой полосы.
       Вертикаль — в positionAlignGrpTop() ниже, она и так была привязана к стопке баров. */
    alignGrpEl.style.left = Math.max(2, Math.round((mainRect.width - alignGrpEl.offsetWidth) / 2)) + "px";
    // ВЫСОТА: полоса стоит не под верхним меню, а СРАЗУ НАД первой строкой цепочки (v0.839,
    // запрос пользователя). Сам расчёт — в positionAlignGrpTop() (fold-3): его же зовёт
    // layoutOverlayBoxes(), чтобы полоса ехала вместе со строками, пока тянут высоту
    // "Результата", а не догоняла их следующей перерисовкой.
    positionAlignGrpTop();
    // Где внутри полосы проходит ось — для линии-продолжения (#alignGrp::after). Считаем ПОСЛЕ
    // сдвигов: у краёв экрана полосу придерживают, и её центр перестаёт совпадать с осью.
    const grpRect = alignGrpEl.getBoundingClientRect();
    alignGrpEl.style.setProperty("--axis-x", ((chainRect.left + leftPx) - grpRect.left).toFixed(1) + "px");
  }
}
/* ДВОЙНОЙ КЛИК ПО ОСИ ЦЕПОЧЕК (v0.903, запрос пользователя: "пусть ставит ось в середину между
   границами паттернов, а границы паттернов раздвигает так, чтобы самая длинная строка поместилась
   между и не залезала даже на балансы").
   Два требования решаются одной формулой. Пусть cols — ширина поля битов в столбцах, off — общий
   визуальный сдвиг (st.axisCenterOffset), base — столбец оси при off = 0 (см. axisBaseCol()).
     ось ровно посередине:   base + off = cols/2
     ничего не вылезает:     minShift + off >= 1  и  maxEnd + off <= cols - 1
   Подставив off из первого во второе, получаем
     cols >= 2*(base - minShift + 1)   и   cols >= 2*(maxEnd - base + 1),
   то есть cols = 2 * max(...). Берём именно так: ось встаёт точно в середину, а поле раздвигается
   ровно настолько, чтобы самая длинная строка (и любая другая) уместилась целиком, с запасом в
   один столбец от каждой границы — значит на колонку паттернов слева она не заезжает, а вместе с
   ней и на поле номеров с балансами, которое стоит ещё левее.
   Считаем по РЕАЛЬНОЙ геометрии выравнивания (rowShiftFor), а не по одной maxLen: у лесенок и
   осевых режимов строки разъезжаются вбок, и "самая длинная" далеко не всегда самая правая. */
/* Подгонка сейчас применена — второй двойной клик по оси её СНИМЕТ (v0.925, баг-репорт "ось
   цепочек съехала"). Отдельный флаг, а не bitsWManual: тот бывает поднят и обычным
   перетаскиванием ручки #vsplit2, и снимать чужую ручную ширину двойным кликом по оси было бы
   свинством. Живёт только в памяти сессии: после перезагрузки первый двойной клик снова
   подгоняет — это и логичнее, и безопаснее, чем «неизвестно, в каком мы состоянии». */
var axisFitOn = false;
/* ═══ «⌖ ПОЛЯ НА МЕСТО» (v0.978, запрос пользователя: "левое и правое поля уехали куда-то, не могу
   достать их, как вернуть — сделай возврат к предустановкам, чтобы рядом стояли по фэншую") ═══
   С v0.976 поля таскаются мышью и упоров у них больше нет — значит нужен и путь назад. Достать
   уехавшее поле обратно протяжкой можно (сами КОРОБКИ полей стоят на месте, уезжают только глифы,
   так что хватать по-прежнему есть за что), но искать, сколько и куда тянуть, — не дело.
   Возвращает РАЗОМ всё, что двигает геометрию трёх полей:
     сдвиги   — patOffL / patOffR / st.axisCenterOffset в ноль, закреплённый столбец оси снят;
     ширины   — все три колонки назад на АВТОПОДБОР (ручные флаги сняты), то есть П1 по самому
                длинному паттерну, цепочка по самой длинной строке, П2 по паттерну же;
     подгонка — снята (axisFitOn), она тоже держала ширину среднего столбца.
   Строки, паттерны, выравнивания и группы НЕ трогаются: это возврат раскладки, а не сброс работы. */
/* Переключатель «◑ Слои» (v0.982). quiet — восстановление из кэша: там сообщение ни к чему. */
function setLayerFocus(on, quiet){
  document.body.classList.toggle("layers-on", !!on);
  if (!on) document.body.dataset.hov = "";
  const b = document.getElementById("bLayerFocus");
  if (b) b.classList.toggle("mode-act", !!on);
  if (!quiet) {
    say(on ? "Слои: поле под курсором в полную яркость, два других приглушены — так видно, чьи биты чьи при наложении."
           : "Слои выключены: все три поля рисуются в полную яркость, как раньше.");
    saveCache();
  }
}
{
  const b = document.getElementById("bLayerFocus");
  if (b) b.onclick = () => setLayerFocus(!document.body.classList.contains("layers-on"));
}
/* «⬇ Меню вниз» (v1.006, запрос пользователя: "в Вид кнопку расположить панель меню верхнее
   внизу экрана"). Тот же приём, что и у setLayerFocus() выше — класс на body, кнопка
   подсвечивается mode-act, состояние сохраняется через captureUiSettings/applyUiSettings. */
function setMenuBarBottom(on, quiet){
  document.body.classList.toggle("menubar-bottom", !!on);
  const b = document.getElementById("bMenuBarBottom");
  if (b) b.classList.toggle("mode-act", !!on);
  /* Стопка баров/#alignGrp реагируют на освободившийся/занятый верх экрана только через
     overlayTopBase() (fold-3-ops.js) — пересчитать сразу, иначе догонят только на следующей
     render()/resize. */
  if (typeof layoutOverlayBoxes === "function") layoutOverlayBoxes();
  if (!quiet) {
    say(on ? "Полоса меню — внизу экрана." : "Полоса меню вернулась наверх.");
    saveCache();
  }
}
{
  const b = document.getElementById("bMenuBarBottom");
  if (b) b.onclick = () => setMenuBarBottom(!document.body.classList.contains("menubar-bottom"));
}
function resetFieldsLayout(){
  patOffL = 0;
  patOffR = 0;
  patOffLY = 0;
  patOffRY = 0;
  bitsOffY = 0;
  st.axisCenterOffset = 0;
  axisPinCol = null;
  axisFitOn = false;
  patWManual = false;
  patW2Manual = false;
  bitsWManual = false;
  document.body.classList.remove("bits-w-manual");
  applyPatOffsets();
  render();
  saveCache();
  say("Поля на месте: сдвиги П1 / цепочки / П2 обнулены, ширины всех трёх колонок снова считаются автоматически. Строки, паттерны и выравнивания не тронуты.");
}
{
  const b = document.getElementById("bResetFields");
  if (b) b.onclick = () => resetFieldsLayout();
  /* ДВОЙНОЙ КЛИК ПО «⇤» (bAlignPatL/bAlignPatR) — вернуть на место ТОЛЬКО своё поле. Короткий
     путь для обычного случая "перетянул одно, остальное устраивает"; одиночный клик у этих кнопок
     занят циклом выравнивания и остаётся при своём. Раньше висело на «◧ П1»/«П2 ◨» — те кнопки
     убраны в v1.003, повесили на их соседей ⇤, которые остались на месте. */
  const dblReset = (id, which) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("dblclick", e => {
      e.preventDefault();
      if (which === "L") { patOffL = 0; patOffLY = 0; } else { patOffR = 0; patOffRY = 0; }
      applyPatOffsets();
      saveCache();
      say((which === "L" ? "Левое поле (П1)" : "Правое поле (П2)") + " возвращено на место — сдвиг обнулён.");
    });
  };
  dblReset("bAlignPatL", "L");
  dblReset("bAlignPatR", "R");
}
function axisFitReset(quiet){
  axisFitOn = false;
  bitsWManual = false;          // ширину среднего столбца снова считает render() по строкам
  st.axisCenterOffset = 0;      // общий визуальный сдвиг картинки
  axisPinCol = null;            // и закреплённый за осью столбец (см. holdAxisOnMaxLenChange)
  render(); saveCache();
  if (!quiet) say("Подгонка снята: ширина поля цепочек снова автоматическая, сдвиг оси сброшен.");
}
function axisCenterAndFitBits(){
  // Повторный двойной клик — откат. Так у операции есть путь назад тем же движением, которым её
  // включили, и не надо помнить про ручку #vsplit2.
  if (axisFitOn) { axisFitReset(); return; }
  let maxLen = 0;
  for (const s of st.rows) if (s.length > maxLen) maxLen = s.length;
  if (!maxLen) { say("Ось: в цепочке нет ни одной строки с битами — раздвигать нечего."); return; }
  let minShift = Infinity, maxEnd = -Infinity;
  for (let i = 0; i < st.rows.length; i++) {
    const s = st.rows[i] || "";
    if (!s.length) continue;
    const sh = rowShiftFor(maxLen, i, s, st.align);
    if (sh < minShift) minShift = sh;
    if (sh + s.length > maxEnd) maxEnd = sh + s.length;
  }
  if (!isFinite(minShift)) { say("Ось: в цепочке нет ни одной строки с битами — раздвигать нечего."); return; }
  const base = axisBaseCol();
  /* ДВА ВАРИАНТА ШИРИНЫ (v0.916 — исправление того, что натворила v0.903):
       tight   — поле ПЛОТНО по картинке: сколько столбцов она реально занимает, плюс по одному
                 запаса с каждой стороны;
       axisFit — поле, симметричное вокруг оси (формула выше), то есть ось ровно посередине.
     Ось посередине стоит дороже, и на НЕСИММЕТРИЧНЫХ вокруг неё выравниваниях — очень дорого: у
     "по левому краю" ось сидит на первом бите первой строки, значит axisFit ≈ вдвое шире картинки,
     и половина поля остаётся пустой, а цепочка уезжает в дальний край. Именно это и случилось у
     пользователя ("двойной щелчок по оси всё сломал"): раньше axisFit брался ВСЕГДА.
     Теперь ось выводим в середину, только пока переплата не больше половины; иначе подгоняем поле
     плотно и просто прижимаем картинку к левому краю поля. */
  const tight = (maxEnd - minShift) + 2;
  const axisFit = 2 * Math.max(base - minShift + 1, maxEnd - base + 1);
  const useAxis = axisFit <= tight * 1.5;
  const cols = Math.max(2, useAxis ? axisFit : tight);
  const step = realColStepPx() || 8;
  // Потолок в пикселях — страховка от абсурдной ширины (битая геометрия выравнивания, гигантская
  // цепочка): лучше поле с прокруткой, чем неработоспособное окно.
  document.documentElement.style.setProperty("--bits-w", Math.min(400000, Math.round(cols * step)) + "px");
  // Ширину среднего столбца выставили сами — render() больше не пересчитывает её по maxLen, иначе
  // ближайший же кадр вернул бы прежнюю (тот же флаг, что ставит ручка #vsplit2). Вернуть
  // автоширину — двойной клик по самой ручке #vsplit2.
  bitsWManual = true;
  st.axisCenterOffset = useAxis ? (Math.round(cols / 2) - base) : (1 - minShift);
  // Закрепляем за осью новый столбец, иначе удержание вернёт её на прежнее место (см.
  // holdAxisOnMaxLenChange) — ровно то же делает перетаскивание ручки.
  axisPinCol = base + st.axisCenterOffset;
  axisFitOn = true;
  render(); saveCache();
  say(`Поле цепочек — ${cols} столбцов, самая длинная строка (${maxLen} бит) помещается целиком` +
      (useAxis ? ", ось ровно посередине." :
       ". Ось посередине не ставил: картинка вокруг неё несимметрична, и поле пришлось бы раздуть вдвое. Вернуть автоширину — двойной клик по ручке между цепочкой и правыми паттернами."));
}
/* ═══ ТАЩИТЬ ПОЛЕ ЗА БИТЫ (v0.976, запрос пользователя: "пусть будет передвижение — тянуть за поле,
   где биты, в любом месте, кроме осей; если просто щелк — выделение оставим, а тянуть — то двигаем
   все биты этой панели") ═══
   Раньше поле можно было двигать только за узкие ручки: центральное — за #axisSplit (линия оси
   шириной в пару пикселей), крайние — вообще никак, у них своего сдвига не было. Теперь хватать
   можно ГДЕ УГОДНО по самому полю, и тянется РОВНО ТО поле, над которым нажали.
   ЩЕЛЧОК И ПРОТЯЖКА РАЗВЕДЕНЫ МЁРТВОЙ ЗОНОЙ: пока мышь не уехала на PAN_DEAD_PX, не происходит
   ничего — отпустил, и это обычный клик со всем прежним выделением. Как только зона пройдена,
   начинается перемещение, а протяжки-выделения (строчная rowDragAnchor и паттернная
   patDragAnchor, см. fold-3-ops.js), заведённые тем же mousedown, отменяются: одно движение мыши
   делает одно дело. Флаг fieldPanMoved гасит click, который браузер шлёт следом за mouseup.
   ЧТО ИМЕННО ДВИГАЕТСЯ: у центрального поля — st.axisCenterOffset (та же величина, что у ручки
   оси), у крайних — patOffL/patOffR. Все три — ЧИСТО ВИЗУАЛЬНЫЕ сдвиги: данные, нумерация
   столбцов и геометрия выравниваний от них не зависят вообще.
   «КРОМЕ ОСЕЙ» — прямое требование: ручка оси, её продолжение внутри полосы кнопок, границы полей
   и линейка столбцов тянут своё и панорамированию не отдаются. Режимы, где протяжка уже занята
   (выбор ячеек, выбор столбцов, перенос строк), тоже пропускаем. */
/* ОБЩАЯ ГЕОМЕТРИЯ ДЛЯ ДВУХ РАЗНЫХ ПРОТЯЖЕК (v1.009) — вынесена сюда, НАД обоими блоками (этим и
   "ПРОТЯЖКА ВНЕ СТРОК" ниже), потому что нужна ОБОИМ, а они в разных {}-областях видимости.
   Отвечает на один вопрос: лежат ли под курсором РЕАЛЬНО ОТРИСОВАННЫЕ (сдвинутые --bits-offy)
   биты какой-нибудь строки цепочки — независимо от того, чья .ln (если вообще чья-то) физически
   стоит в этой точке экрана. Нужна для баг-репорта "не цепляет перетаскиванием биты, если они уже
   сдвинуты и находятся ниже границы полей, у паттернов такого бага нет": при большом bitsOffY
   биты ПОСЛЕДНИХ строк списка уезжают (position:relative+top) ЗА ПРЕДЕЛЫ собственной высоты
   #rows (тот кончается вместе со своими строками, чужой оверфлоу его не раздвигает) — то есть на
   пустое полотно .canvas. Раньше это полотно занято ДРУГОЙ протяжкой — "тянуть все три поля
   разом" (см. блок ниже, слушает #screenCanvas ИМЕННО из-за той же особенности #rows) — она
   ничего не знала про сдвинутые биты и просто хватала клик себе. Эта функция даёт обеим протяжкам
   ОБЩИЙ критерий: если курсор на самом деле накрывает нарисованные биты — забирает протяжка ЗА
   БИТЫ (см. wiring ниже), а "разом" уступает; если бит там нет — как и было, полотно за "разом". */
function chainShiftedBitsHit(e){
  const off = Math.round((typeof bitsOffY === "number" ? bitsOffY : 0) || 0);
  if (!off) return false;   // без сдвига биты не покидают #rows — старая проверка по #rows и так работает
  const rows = document.querySelectorAll("#rows .ln");
  for (let i = 0; i < rows.length; i++) {
    const bits = rows[i].querySelectorAll(".bits > span .b0, .bits > span .b1");
    if (!bits.length) continue;
    const r0 = bits[0].getBoundingClientRect(), r1 = bits[bits.length - 1].getBoundingClientRect();
    const left = Math.min(r0.left, r1.left), right = Math.max(r0.right, r1.right);
    const top = Math.min(r0.top, r1.top), bottom = Math.max(r0.bottom, r1.bottom);
    if (e.clientX >= left && e.clientX < right && e.clientY >= top && e.clientY < bottom) return true;
  }
  return false;
}
{
  /* СЛУШАТЕЛЬ — НА #screenCanvas, А НЕ НА #rows (испр. v1.009, баг-репорт пользователя: "не
     цепляет перетаскиванием биты, если они уже сдвинуты и находятся ниже границы полей; у
     паттернов такого бага нет"). Раньше слушатель висел на #rows, и это работало для сдвига ВНУТРЬ
     #rows (соседняя .ln перекрыта, но геометрия ищется по ВСЕМ строкам, см. fieldAtEventEl ниже) —
     но НЕ для ПОСЛЕДНИХ строк списка: их сдвинутые (position:relative + top:var(--bits-offy)) биты
     рисуются НИЖЕ собственной границы #rows (у него своя высота — по нормальному потоку, оверфлоу
     соседей её не раздвигает), то есть уже НАД пустым полем .canvas, а не над #rows. У .bits и её
     span'ов pointer-events:none (см. комментарий в fieldAtEventEl), значит клик там проваливается
     СКВОЗЬ них и достаётся .canvas — своему, а не #rows, предку. mousedown на .canvas НИКОГДА не
     всплывёт ДО слушателя на #rows: #rows его потомок, а не предок, всплытие идёт только вверх.
     Оттого жест ломался молча, ровно там, где и жаловался пользователь.
     У паттернов (.pat/.pat2) бага нет: те САМИ ловят мышь (pointer-events НЕ убран), и e.target —
     это они сами, где бы ни были нарисованы — им #rows-граница вообще не указ.
     Слушатель на #screenCanvas ловит и старые случаи (там всё так же есть .ln/#rows), и новый —
     клик мимо #rows, но внутри холста. Проверки .vsplit/#axisSplit/#alignGrp/#colHeader ниже как
     были, так и остались первым фильтром. */
  const rowsPanEl = document.getElementById("screenCanvas");
  const PAN_DEAD_PX = 3;   // мёртвая зона: меньше — это щелчок, а не протяжка
  let pan = null;
  /* КАКОЕ ПОЛЕ ТЯНЕМ — ПО САМИМ БИТАМ ПОД КУРСОРОМ, А НЕ ПО КОРОБКЕ ПОЛЯ (v0.981, запрос
     пользователя: "не могу двигать левое-правое поля; пусть не поля, а за биты — перетаскивание не
     привязано к полю").
     В v0.976 поле определялось по коробкам ячеек строки, и это ломало ровно тот случай, ради
     которого всё затевалось: утащил биты П1 вправо — они теперь висят над коробкой цепочки, и
     схватить их больше нечем. Коробка-то не поехала, поехали глифы, а мышь спрашивала коробку.
     Теперь спрашиваем то, ЧТО НАРИСОВАНО ПОД КУРСОРОМ: глифы крайних полей живут в .pat/.pat2 и
     ловят мышь даже там, куда уехали за свои границы (overflow:visible, см. CSS v0.976), поэтому
     схватить их можно везде, где они видны. Биты цепочки мышь не ловят вовсе (.ln .bits
     {pointer-events:none} — так было всегда, клик проваливается к строке), значит "не попал в
     крайнее поле" и означает "это центральное". Отсюда и правило в одну строку.
     ПОБОЧНЫЙ ЭФФЕКТ, КОТОРЫЙ НУЖЕН: пустое место в коробке П1/П2 (там, где паттернов нет) тоже
     тянет своё поле — иначе короткие паттерны были бы почти неуловимы. */
  const fieldAtEventEl = (e) => {
    /* ПРИОРИТЕТ ТОМУ, ЧТО НАРИСОВАНО СВЕРХУ (v0.984, баг-репорт пользователя: "не могу за биты
       двигать центральную, когда она находится в поле панелей"). У .ln .bits СТОИТ pointer-events:
       none (одна из старых основ разметки — без него клик по битам одной строки при плотном
       межстрочном мог попасть в СОСЕДНЮЮ .ln, чей текст вылез поверх, см. комментарий у самого
       правила в CSS). Поэтому e.target НИКОГДА не бывает глифом цепочки — клик всегда достаётся
       чему-то ещё: обычно самой .ln, но там, где сдвинутые биты цепочки визуально лежат НАД
       коробкой П1/П2 (а с v0.976 упора нет, наезжать можно докуда угодно), под курсором физически
       оказывается .pat/.pat2 — и хватала она, хотя сверху нарисована цепочка.
       Раз e.target не спросить, спрашиваем ГЕОМЕТРИЮ: у РЕАЛЬНО ОТРИСОВАННОГО span'а бит цепочки
       (тот, что несёт transform сдвига оси, halfShiftAttr в render()) берём getBoundingClientRect
       — она уже учитывает и обычный сдвиг выравнивания (напечатанные &nbsp), и transform оси
       (st.axisCenterOffset). Курсор внутри этого прямоугольника — значит попали в цепочку, ровно
       как оно и нарисовано (z-index:2 у .bits>span выше z-index:1 у .pat-shift, см. CSS v0.976/
       982) — вне зависимости от того, чья КОРОБКА там физически стоит. */
    /* УТОЧНЕНО В v0.998 (баг-репорт пользователя: "биты когда накладываются, даже в том месте где
       не накладываются, перемещаю — не та цепочка двигается"). Прежняя проверка брала rect ВСЕГО
       span'а .bits > span целиком — а в него, кроме самих бит "0"/"1", входит ещё и ОТСТУП
       выравнивания: неразрывные пробелы (&nbsp), которыми alignShift() двигает короткую строку
       внутри общей ширины (напр. "по центру" короткой строки на фоне длинной цепочки). Пробелы
       НЕВИДИМЫ, но занимают реальную ширину — и span целиком оказывался ШИРЕ, чем видимые глифы,
       залезая в место, где на экране НЕТ ни одного бита цепочки, только паттерн. Клик туда честно
       "не должен принадлежать цепочке" — а принадлежал, поэтому и хватало не то поле.
       ТЕПЕРЬ МЕРИМ ПО САМИМ БИТАМ: первому и последнему span'ам .b0/.b1 внутри строки (render()
       рисует пробег одинаковых бит одним span'ом, но крайние всегда есть, если строка не пуста) —
       их общий охват и есть РЕАЛЬНО ВИДИМАЯ область бит, без пустого отступа по краям. */
    /* ПЕРЕДЕЛАНО В v1.006 (баг-репорт пользователя, после того как модель v1.004 "содержимое
       строки N уезжает В КОРОБКУ строки N+bitsOffY" оказалась неполной: "биты стоят на своих
       строках, но все строки сдвинуты вниз за нижнюю границу поля — биты центрального поля не
       захватываются"). У ПОСЛЕДНИХ строк списка сдвинутые биты (position:relative + top:
       var(--bits-offy) на .bits>span) уезжают НЕ в чужую .ln — а вообще ЗА ПРЕДЕЛЫ последней
       строки, в пустоту #rows под ней (там уже никакой .ln нет). Точный пересчёт "какая строка
       под курсором минус сдвиг" там бьёт мимо: подставлять нечего.
       ВМЕСТО ГЕОМЕТРИЧЕСКОГО ПересЧЁТА — ПРЯМОЙ ПЕРЕБОР. Пока bitsOffY не нулевой, дешёвая
       геометрия недостаточна: спрашиваем ПООЧЕРЁДНО каждую отрисованную строку (виртуализация и
       так держит в DOM только окно видимости + запас, это не тысячи узлов), меряем её
       .bits>span — она несёт --bits-offy наравне со всеми, поэтому getBoundingClientRect() уже
       стоит там, где реально нарисовано, независимо от того, куда уехала СОБСТВЕННАЯ коробка
       .ln. Первая строка, чьи биты накрывают курсор — та и есть. bitsOffY===0 (подавляющее
       большинство кликов, вертикаль не тронута) — путь остаётся дешёвым: смотрим только ту .ln,
       что под курсором, без перебора вообще. */
    const off = Math.round((typeof bitsOffY === "number" ? bitsOffY : 0) || 0);
    const checkBits = lnEl => {
      const bits = lnEl ? lnEl.querySelectorAll(".bits > span .b0, .bits > span .b1") : null;
      if (!bits || !bits.length) return false;
      const r0 = bits[0].getBoundingClientRect();
      const r1 = bits[bits.length - 1].getBoundingClientRect();
      const left = Math.min(r0.left, r1.left), right = Math.max(r0.right, r1.right);
      const top = Math.min(r0.top, r1.top), bottom = Math.max(r0.bottom, r1.bottom);
      return e.clientX >= left && e.clientX < right && e.clientY >= top && e.clientY < bottom;
    };
    if (off) {
      const rows = document.querySelectorAll("#rows .ln");
      for (let i = 0; i < rows.length; i++) if (checkBits(rows[i])) return "C";
    } else {
      const ln = e.target.closest(".ln");
      if (checkBits(ln)) return "C";
    }
    const patEl = e.target.closest(".pat2, .pat");
    if (!patEl) return "C";
    return patEl.classList.contains("pat2") ? "R" : "L";
  };
  if (rowsPanEl) rowsPanEl.addEventListener("mousedown", e => {
    /* Ctrl БОЛЬШЕ НЕ ОТСЕИВАЕТСЯ (v0.980, запрос пользователя: "на всём поле пусть по контролу"):
       Ctrl + протяжка вверх-вниз по полю крутит межстрочный отступ. Ctrl + КЛИК при этом остаётся
       за выделением строк — до мёртвой зоны PAN_DEAD_PX мы не делаем ничего и событие не трогаем,
       так что обработчик клика в fold-3-ops.js получает его как раньше. */
    if (e.button !== 0 || e.metaKey || e.altKey) return;
    if (cellSelMode || colPickMode) return;
    if (typeof wrapModeOn === "function" && wrapModeOn()) return;
    if (e.target.tagName === "INPUT" || e.target.closest(".edit-row-input")) return;
    if (e.target.closest("#axisSplit, .vsplit, .vsplit2, .vsplit3, #alignGrp, #colHeader")) return;
    const ln = e.target.closest(".ln");
    /* КРОМЕ .ln — ЕЩЁ И ПУСТОЕ МЕСТО ВНУТРИ #rows (v1.006), ПЛЮС ГЕОМЕТРИЧЕСКОЕ ПОПАДАНИЕ В
       СДВИНУТЫЕ БИТЫ ДАЖЕ ЗА ПРЕДЕЛАМИ #rows (v1.009, баг-репорт: "биты стоят на своих строках,
       но все строки сдвинуты вниз за нижнюю границу поля — биты центрального поля не
       захватываются"). При большом bitsOffY глифы .bits>span (position:relative+top) визуально
       уезжают НИЖЕ СВОЕЙ ЖЕ строки — и если это последние строки списка, уезжают вообще ЗА
       ПРЕДЕЛЫ собственной высоты #rows (той, что по нормальному потоку, чужой оверфлоу её не
       раздвигает) — то есть уже на пустое полотно .canvas. Раньше слушатель сидел на #rows, и
       туда это событие вообще не всплывало (#rows — потомок .canvas, а не предок, см. комментарий
       у rowsPanEl про перенос слушателя на #screenCanvas); "#rows"-проверку саму по себе тут
       НЕ РАСШИРЯЕМ до "любая точка холста" — иначе отбирали бы клики у protяжки "все поля разом"
       (см. её блок ниже, она как раз ХОЗЯИН пустого полотна). Вместо этого — узкий, геометрический
       пропуск: chainShiftedBitsHit() отвечает да только там, где под курсором и правда нарисованы
       биты, а не просто пустой холст. */
    if (!ln && !(e.target.closest && e.target.closest("#rows")) && !chainShiftedBitsHit(e)) return;
    const field = fieldAtEventEl(e);
    lastPanField = field;   // им же двигают стрелки с Alt (см. обработчик клавиш в fold-4-tools.js)
    /* ПОСЛЕДНИЙ ЩЕЛЧОК НАД БИТАМИ — ОН ЖЕ ПРИЁМНИК ПОЛОСЫ ВЫРАВНИВАНИЙ (v1.003, запрос
       пользователя: "последний щелчок над битами выбирает цепочку для выравнивания"). Раньше
       приёмник переключали ОТДЕЛЬНЫМИ кнопками «◧ П1»/«П2 ◨» (убраны, см. кнопку-индикатор
       #bAlignTargetInd в fold-4-tools.js) — теперь он просто следует за тем же кликом/протяжкой,
       что уже переставляет lastPanField. quiet:true — тихо, без say(): иначе сообщение сыпалось
       бы на КАЖДЫЙ клик по полю, а это самое частое действие в приложении. */
    if (typeof setAlignTarget === "function") setAlignTarget(field, true);
    lastGrabWasBorder = false;   // под замком (🔒) без Alt стрелки пойдут в поле, а не в границу
    pan = { field: field, x0: e.clientX, y0: e.clientY, moved: false,
            lhDrag: makeLhVDrag(e.clientY), lsDrag: makeLsHDrag(e.clientX),
            baseY: field === "C" ? (bitsOffY || 0) : (field === "L" ? (patOffLY || 0) : (patOffRY || 0)),
            base: field === "C" ? (st.axisCenterOffset || 0) : (field === "L" ? (patOffL || 0) : (patOffR || 0)) };
  });
  window.addEventListener("mousemove", e => {
    if (!pan) return;
    if (!(e.buttons & 1)) { pan = null; return; }   // кнопку отпустили мимо окна
    const dx = e.clientX - pan.x0;
    /* CTRL / SHIFT — ШРИФТ, НЕ СДВИГ ПОЛЯ. Изначально (v0.983) обе ручки шрифта — межстрочный и
       межсимвольный — сидели на Ctrl вместе. С v0.991 (запрос пользователя: "межсимвольный
       интервал — только по Shift") они разведены по разным клавишам: Ctrl — по-прежнему
       межстрочный (makeLhVDrag, вертикаль; так же и на границах полей, см. makeColResizer выше),
       Shift — межсимвольный (makeLsHDrag, горизонталь). Обе считаются НЕЗАВИСИМО от мёртвой зоны
       PAN_DEAD_PX — она про начало перетаскивания ПОЛЯ, а тут поле как раз НЕ двигается. Интервал
       и межстрочный общие на всё приложение, поэтому крутить их можно с любого из трёх полей —
       эффект виден сразу везде. Пока зажата любая из двух клавиш, сдвиг поля (что вбок, что
       вверх-вниз) не применяется вовсе — так что случайно увести поле, регулируя шрифт,
       невозможно. Обе ветки ОДИНАКОВЫЕ по структуре и не смешиваются: Ctrl+Shift разом что-то
       одно да перехватит первым (проверка идёт по порядку) — двух шрифтовых ручек сразу не бывает
       и не нужно. */
    // Обе ручки шрифта вызываем КАЖДЫЙ кадр, а не только пока их клавиша зажата — иначе "armed"
    // внутри makeLhVDrag()/makeLsHDrag() не разоружается вовремя (Ctrl держат, Shift тоже держат,
    // отпустили Ctrl — точка отсчёта Shift-ручки должна перевзвестись СЕЙЧАС, а не остаться от
    // момента до Ctrl). Ctrl главнее: пока он зажат, у Shift-ручки active=false, даже если Shift
    // тоже нажат.
    pan.lhDrag(e.clientY, !!e.ctrlKey);
    pan.lsDrag(e.clientX, !!e.shiftKey && !e.ctrlKey);
    if (e.ctrlKey) {
      if (!pan.moved) { pan.moved = true; fieldPanMoved = true; rowDragAnchor = null; patDragAnchor = null;
                        document.body.classList.add("field-panning"); }
      return;
    }
    if (e.shiftKey) {
      if (!pan.moved) { pan.moved = true; fieldPanMoved = true; rowDragAnchor = null; patDragAnchor = null;
                        document.body.classList.add("field-panning"); }
      return;
    }
    if (!pan.moved) {
      /* МЁРТВАЯ ЗОНА ПО ОБЕИМ ОСЯМ (v0.987) — раньше мерилась ТОЛЬКО по dx, потому что раньше
         протяжка поля вообще не умела в вертикаль без Shift. Теперь вертикаль равноправна: чисто
         вертикальная протяжка (dx почти не набрался) обязана так же снимать поле с места, иначе
         с одним dx в условии она молча повисала бы в "ещё не решили, клик это или тяг". */
      if (Math.abs(dx) < PAN_DEAD_PX && Math.abs(e.clientY - pan.y0) < PAN_DEAD_PX) return;
      pan.moved = true;
      fieldPanMoved = true;
      rowDragAnchor = null;
      patDragAnchor = null;
      document.body.classList.add("field-panning");
    }
    const step = realColStepPx() || 8;
    const d = Math.round(dx / step);   // сдвиг ЦЕЛЫМИ столбцами — как и у ручки оси
    /* ВЕРТИКАЛЬНЫЙ СДВИГ ПОЛЯ — БЕЗ SHIFT (v0.982, "3D-развороты"; требование Shift снято в
       v0.987 по запросу пользователя: "думаю строк перемещение вниз-верх без шифта можно").
       Поля расходятся не только по столбцам, но и по строкам, и наложение перестаёт быть плоским.
       Шаг — ровно ВЫСОТА СТРОКИ, чтобы биты соседних полей продолжали стоять по одной сетке,
       просто на другом её ряду. Отсчёт — от точки самого mousedown (pan.y0/pan.baseY), без
       перевзвода: раз модификатора больше нет, взводить его не на чем — вертикаль участвует в
       протяжке с первого же движения, вместе с горизонталью, одной диагональю. */
    {
      const rowH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--row-h")) || 12;
      const dRows = Math.round((e.clientY - pan.y0) / Math.max(4, rowH));
      const v = pan.baseY + dRows;
      if (pan.field === "C") bitsOffY = v; else if (pan.field === "L") patOffLY = v; else patOffRY = v;
      applyPatOffsets();
    }
    if (pan.field === "C") {
      st.axisCenterOffset = pan.base + d;
      // Тот же приём, что у ручки оси: закрепляем за ней новый столбец, иначе ближайший же кадр
      // вернул бы ось на прежнее место (см. holdAxisOnMaxLenChange).
      axisPinCol = axisBaseCol() + st.axisCenterOffset;
      render();
    } else {
      // Крайним полям перерисовка не нужна вовсе: их сдвиг — одна CSS-переменная на обёртке
      // .pat-shift, разметка от него не меняется ни на символ. Поэтому протяжка П1/П2 идёт
      // ровно и не грузит страницу, в отличие от центрального поля, где сдвиг входит в transform
      // строк и линейки столбцов.
      if (pan.field === "L") patOffL = pan.base + d; else patOffR = pan.base + d;
      applyPatOffsets();
      if (pan.field === "L") clampPatOffLLeftEdge();
    }
  });
  /* ═══ «◑ СЛОИ»: ПОЛЕ ПОД КУРСОРОМ — В ПОЛНУЮ ЯРКОСТЬ, ОСТАЛЬНЫЕ ПРИГЛУШЕНЫ (v0.982) ═══
     Когда три поля лежат друг на друге, глазом не разобрать, чьи биты чьи. Приглушаем чужие —
     и слой под курсором сразу читается отдельно от остальных. Гасится ТОЛЬКО прозрачность самих
     глифов (.pat-shift и обёртка бит), не коробок: opacity на .pat/.pat2/.bits завела бы им
     контекст наложения и порядок слоёв (v0.976) рассыпался бы.
     Атрибут пишем только на смене поля: mousemove идёт потоком, а перекраска всей цепочки на
     каждое движение мыши — верный способ уронить отзывчивость. */
  if (rowsPanEl) rowsPanEl.addEventListener("mousemove", e => {
    if (!document.body.classList.contains("layers-on")) return;
    /* НЕ ГАСИТЬ ПОЛЯ ПРИ ПЕРЕТЯГИВАНИИ ГРАНИЦ (v0.992, запрос пользователя: "при перетягивании
       границ — не затемняй"). body.dragging ставят makeColResizer() (все четыре .vsplit*) и
       startAxisDrag() — во время такого перетаскивания мышь неизбежно проходит НАД строками, и
       подсветка слоя дёргалась вместе с ней, хотя пользователь двигает ширину/ось, а не смотрит
       на наложение бит. body.field-panning (наша же протяжка полей, v0.976/985) сюда НЕ входит —
       там подсветка слоя как раз к месту: именно её и тащат. */
    if (document.body.classList.contains("dragging")) return;
    const f = e.target.closest(".ln") ? fieldAtEventEl(e) : "";
    if (document.body.dataset.hov !== f) document.body.dataset.hov = f;
  });
  if (rowsPanEl) rowsPanEl.addEventListener("mouseleave", () => {
    if (document.body.dataset.hov) document.body.dataset.hov = "";
  });
  window.addEventListener("mouseup", () => {
    if (!pan) return;
    const moved = pan.moved || fieldPanMoved;   // Ctrl-вертикаль тоже считается протяжкой
    pan = null;
    document.body.classList.remove("field-panning");
    if (!moved) return;
    saveCache();
    // Сброс через setTimeout — click браузер шлёт ПОСЛЕ mouseup, и он должен успеть увидеть флаг
    // (тот же приём, что у строчной и паттернной протяжек в fold-3-ops.js).
    setTimeout(() => { fieldPanMoved = false; }, 0);
  });
}

/* ═══ ПРОТЯЖКА ВНЕ СТРОК — ВСЕ ТРИ ПОЛЯ РАЗОМ, КАК ГОРИЗОНТАЛЬНЫЙ СКРОЛЛ (v0.985, запрос
   пользователя: "сделай перетаскивание как по скролу горизонт нижнему сразу всех при перемещении
   курсором вне полей снизу сверху") ═══
   Протяжка ЗА БИТЫ (блок выше) двигает ОДНО поле — то, что под курсором. Эта протяжка — за ПУСТОЕ
   МЕСТО холста (там, где НЕТ ни одной строки — обычно ниже последней, иногда выше первой при
   малом числе строк) — двигает ВСЕ ТРИ поля СРАЗУ на одно и то же число столбцов, как будто
   схватили всю картинку целиком. Только горизонталь — по смыслу это то же самое, что тянуть
   ползунок горизонтального скролла внизу холста, а тот двигает только вбок.
   Слушатель висит на #screenCanvas (не на #rows — под последней строкой это уже ПОЛОТНО, не
   #rows: тот высотой ровно в свои строки и заканчивается вместе с ними), с тем же списком
   исключений, что и у "клика мимо" для сброса выбора ячеек (см. её блок в fold-2-render.js):
   служебные элементы холста ведут свою протяжку сами. */
{
  const canvasPanEl = document.getElementById("screenCanvas");
  const PAN_ALL_DEAD_PX = 3;   // своя мёртвая зона: PAN_DEAD_PX выше — в другом блоке, вне видимости
  let panAll = null;
  if (canvasPanEl) canvasPanEl.addEventListener("mousedown", e => {
    if (e.button !== 0 || e.ctrlKey || e.metaKey || e.altKey) return;
    if (cellSelMode || colPickMode) return;
    if (typeof wrapModeOn === "function" && wrapModeOn()) return;
    if (e.target.closest(".ln")) return;   // по строке — та протяжка выше, эта не её дело
    /* v1.009: НЕ ТОЛЬКО по .ln — ещё и если курсор геометрически лежит на СДВИНУТЫХ бит-глифах,
       которые --bits-offy увёл ЗА пределы #rows на пустое полотно (см. chainShiftedBitsHit() и
       комментарий у неё же). Иначе эта протяжка отбирала бы такой клик у "тащить поле за биты"
       выше — тот теперь тоже умеет забирать клики отсюда, но только эти, не любые. */
    if (e.target.closest("#alignGrp, #colHeader, .vsplit, .vsplit2, .vsplit3, .axis-split, #colPickFloat, .state-badges, button, input, select, label") || chainShiftedBitsHit(e)) return;
    // Клик мимо полей и строк — с этого момента Alt+стрелки двигают ВСЕ ТРИ поля разом, а не
    // последнее из них (v0.988, см. nudgeAllFields выше и ветку lastPanField в fold-4-tools.js).
    lastPanField = "ALL";
    lastGrabWasBorder = false;   // под замком (🔒) без Alt стрелки пойдут в поле, а не в границу
    panAll = { x0: e.clientX, moved: false,
               baseL: patOffL || 0, baseC: st.axisCenterOffset || 0, baseR: patOffR || 0 };
  });
  window.addEventListener("mousemove", e => {
    if (!panAll) return;
    if (!(e.buttons & 1)) { panAll = null; return; }
    const dx = e.clientX - panAll.x0;
    if (!panAll.moved) {
      if (Math.abs(dx) < PAN_ALL_DEAD_PX) return;
      panAll.moved = true;
      document.body.classList.add("field-panning");
    }
    const step = realColStepPx() || 8;
    const d = Math.round(dx / step);
    patOffL = panAll.baseL + d;
    patOffR = panAll.baseR + d;
    st.axisCenterOffset = panAll.baseC + d;
    axisPinCol = axisBaseCol() + st.axisCenterOffset;
    render();   // applyPatOffsets() входит в конец render() — красит и крайние поля тем же кадром
  });
  window.addEventListener("mouseup", () => {
    if (!panAll) return;
    const moved = panAll.moved;
    panAll = null;
    document.body.classList.remove("field-panning");
    if (!moved) return;
    saveCache();
  });
}

/* Начало перетаскивания оси. Вынесено функцией, потому что тянуть её можно ЗА ДВА МЕСТА: за саму
   ручку #axisSplit под полосой кнопок и за продолжение линии ВНУТРИ полосы (v0.843, запрос
   пользователя "линию между кнопок тоже цепляемой") — логика одна и та же. */
function startAxisDrag(e){
  const axisSplitEl = document.getElementById("axisSplit");
  e.preventDefault();
  const startX = e.clientX;
  const startOffset = st.axisCenterOffset || 0;
  const chPx = realColStepPx();
  if (axisSplitEl) axisSplitEl.classList.add("drag");
  document.body.classList.add("dragging");
  // Границу (ось) схватили — гасим ЛЮБУЮ уже включённую подсветку слоя (v0.992, см. тот же приём
  // у makeDrag()/makeColResizer() выше): без этого она застревала на поле, что было под курсором
  // до захвата ручки.
  if (document.body.dataset.hov) document.body.dataset.hov = "";
  const move = (ev) => {
    const deltaCols = Math.round((ev.clientX - startX) / chPx);
    st.axisCenterOffset = startOffset + deltaCols;
    // Ручка — единственный способ ПЕРЕДВИНУТЬ ось; закрепляем за ней новый столбец, иначе
    // ближайший же кадр вернул бы ось на прежнее место (см. holdAxisOnMaxLenChange).
    axisPinCol = axisBaseCol() + st.axisCenterOffset;
    render();
  };
  const up = () => {
    if (axisSplitEl) axisSplitEl.classList.remove("drag");
    document.body.classList.remove("dragging");
    window.removeEventListener("mousemove", move);
    window.removeEventListener("mouseup", up);
    saveCache();
  };
  window.addEventListener("mousemove", move);
  window.addEventListener("mouseup", up);
}
{
  const axisSplitEl = document.getElementById("axisSplit");
  if (axisSplitEl) axisSplitEl.addEventListener("mousedown", startAxisDrag);
  // Двойной клик — ось по центру + подгонка ширины поля битов (см. axisCenterAndFitBits).
  if (axisSplitEl) axisSplitEl.addEventListener("dblclick", (e) => { e.preventDefault(); axisCenterAndFitBits(); });
  /* Полоса кнопок: линия внутри неё нарисована псевдоэлементом, а у псевдоэлемента своих событий
     нет — они приходят на сам #alignGrp. Поэтому ловим mousedown на полосе и берём его себе,
     только если курсор рядом с линией (±AXIS_GRAB_PX от --axis-x). Всё, что дальше, — обычные
     клики по кнопкам выравнивания, их не трогаем.
     capture:true — mousedown должен достаться оси РАНЬШЕ кнопки, на краю которой стоит линия.
     Курсор col-resize над этой зоной ставится там же, на mousemove: рисовать его через CSS
     нечем — зона задана не геометрией элемента, а расстоянием до линии. */
  const alignGrpDragEl = document.getElementById("alignGrp");
  if (alignGrpDragEl) {
    const AXIS_GRAB_PX = 5;
    const nearAxis = (e) => {
      const x = parseFloat(getComputedStyle(alignGrpDragEl).getPropertyValue("--axis-x"));
      if (!isFinite(x)) return false;
      return Math.abs((e.clientX - alignGrpDragEl.getBoundingClientRect().left) - x) <= AXIS_GRAB_PX;
    };
    alignGrpDragEl.addEventListener("mousedown", (e) => {
      if (e.button !== 0 || !nearAxis(e)) return;
      e.stopPropagation();
      startAxisDrag(e);
    }, true);
    // Двойной клик по продолжению линии внутри полосы кнопок — то же, что и по самой ручке.
    alignGrpDragEl.addEventListener("dblclick", (e) => {
      if (!nearAxis(e)) return;
      e.stopPropagation(); e.preventDefault();
      axisCenterAndFitBits();
    }, true);
    alignGrpDragEl.addEventListener("mousemove", (e) => {
      alignGrpDragEl.style.cursor = nearAxis(e) ? "col-resize" : "";
    });
    alignGrpDragEl.addEventListener("mouseleave", () => { alignGrpDragEl.style.cursor = ""; });
  }
}
/* === МАРКЕР 11: CACHE === */
const CACHE_KEY = "zerk_fold_v1";
/* Метка раскладки. Сохранённая ширина боковых доков ложится инлайном на documentElement и потому
   перебивает CSS (см. loadCache). Пока метка совпадает — уважаем сохранённое (ширину тянут мышью).
   Не совпала — сохранённое считается снятым со старой раскладки и игнорируется, действует CSS.
   Увеличивай при изменении ширин в стилях, иначе правка не дойдёт до тех, у кого уже есть кэш. */
const LAYOUT_V = 2;
/* АВАРИЙНЫЙ РЕЖИМ: добавь "#safe" в конец адреса и перезагрузи — кэш НЕ читается и НЕ пишется.
   Нужен, когда сохранённое состояние само по себе вешает вкладку (много длинных цепочек ×
   включённые тяжёлые режимы фон-поиска): в другом браузере тот же файл открывается нормально
   именно потому, что там localStorage пуст. Запись тоже отключена — сохранённые цепочки
   остаются нетронутыми, их можно спокойно выгрузить (⬇ Файл в списке цепочек) и уже потом
   чистить. Без "#safe" всё работает как раньше. */
const SAFE_MODE = /(^|[#?&])safe\b/.test(location.hash + location.search);
/* Взводится кнопкой "🗑 Кэш" перед перезагрузкой — чтобы ни один saveCache(), случившийся между
   стиранием и reload, не записал всё обратно. */
let cacheWiped = false;
const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

/* Генератор фрактала Серпинского 90 (Rule 90 / Pascal mod 2) */
function generateSierpinski90(n) {
  const rows = [];
  let prev = [1];
  rows.push("1");
  for (let r = 1; r < n; r++) {
    const next = [1];
    for (let i = 1; i < prev.length; i++) {
      next.push(prev[i - 1] ^ prev[i]);
    }
    next.push(1);
    rows.push(next.join(""));
    prev = next;
  }
  return rows;
}

/* Генератор ДВОИЧНЫХ НОМЕРОВ (v0.885, запрос пользователя "добавь построение номеров"): строка i —
   само число i в двоичном виде, 1 / 10 / 11 / 100 / 101 … Длины растут ступеньками, как у
   Серпинского, поэтому обе фигуры одинаково ложатся на любое выравнивание. */
function generateBinaryNumbers(n) {
  const rows = [];
  for (let i = 1; i <= n; i++) rows.push(i.toString(2));
  return rows;
}

/* Снимок всех настроек-кнопок/галочек/ползунков — используется и обычным кэшем в localStorage,
   и кнопкой "💾 Сохран" (сохранение цепочки), чтобы не дублировать список полей дважды. */
function captureUiSettings(){
  return {
    pull: cPullEl.checked, order: cOrderEl.checked, nextOnly: cNextOnlyEl.checked,
    stageXor: cStageXorEl ? cStageXorEl.checked : false, invPass: cInvPassEl ? cInvPassEl.checked : false,
    autoShift: cAutoShiftEl ? cAutoShiftEl.checked : false, stopOnHit: cStopOnHitEl ? cStopOnHitEl.checked : true,
    stopOnBalance: cStopOnBalanceEl ? cStopOnBalanceEl.checked : false,
    turboAuto: cTurboAutoEl ? cTurboAutoEl.checked : false,
    captureOnFind: cCaptureOnFindEl ? cCaptureOnFindEl.checked : true,
    skipLast: cSkipLastEl ? cSkipLastEl.checked : false,
    vert: cVertEl.checked, pad: cPadEl.checked, padReal: cPadRealEl ? cPadRealEl.checked : false, tailZeros: cTailZerosEl ? cTailZerosEl.checked : false, kindsMode: st.kindsMode || "", cellSampleOn: !!st.cellSampleOn, cellSampleSeq: !!st.cellSampleSeq, skip1: cSkipEl.checked,
    ringInvert: cRingInvertEl ? cRingInvertEl.checked : false,
    ringReverse: cRingReverseEl ? cRingReverseEl.checked : false,
    ringOff: cRingOffEl ? cRingOffEl.checked : false,
    chainCutBelow: cChainCutBelowEl ? cChainCutBelowEl.checked : false,
    chainCutTail: cChainCutTailEl ? cChainCutTailEl.checked : false,
    chainTileMode: st.chainTileMode || "none",
    seqSelf: cSeqSelfEl ? cSeqSelfEl.checked : false,
    horizRotateOnFail: cHorizRotateOnFailEl ? cHorizRotateOnFailEl.checked : true,
    horizAlternateSide: cHorizAlternateSideEl ? cHorizAlternateSideEl.checked : false,
    horizReverseChain: cHorizReverseChainEl ? cHorizReverseChainEl.checked : false,
    horizShowLiveXor: cHorizShowLiveXorEl ? cHorizShowLiveXorEl.checked : true,
    axisSnap: cAxisSnapEl ? cAxisSnapEl.checked : true,
    axisBitBounce: cAxisBitBounceEl ? cAxisBitBounceEl.checked : false,
    edgeOnes: cEdgeOnesEl ? cEdgeOnesEl.checked : false,
    noSplitOnes: cNoSplitOnesEl ? cNoSplitOnesEl.checked : false,
    axisDiagCols: st.axisDiagCols | 0,
    interleavePadEven: cInterleavePadEvenEl ? cInterleavePadEvenEl.checked : false,
    axisSnapAny: cAxisSnapAnyEl ? cAxisSnapAnyEl.checked : false,
    axisCenterOffset: st.axisCenterOffset || 0,
    axisSnapCols: (st.axisSnapCols || []).slice(),
    axisSnapGroups: axisGroups().map(g => ({ cols: g.cols.slice(), p2: (g.p2 || []).slice(), row: g.row, anch: g.anch })),
    seqGlueMode: st.seqGlueMode || "right",
    align: st.align, mode: st.mode || "step1", rowCount: rowCountEl ? rowCountEl.value : 256,
    bgSearchModes: st.bgSearchModes,
    bgSearchOn: st.bgSearchOn !== false,
    bgMaskText: st.bgMaskText || "",
    bgMaskOn: st.bgMaskOn !== false,
    bgMaskRingRestart: st.bgMaskRingRestart !== false,
    // Свой список масок для "🎭 Перебора масок" (см. maskScanListMasks в fold-3).
    bgMaskScanList: st.bgMaskScanList || "",
    // "⇄ Сдвиг по маске": своего поля маски и своей подсветки у него больше нет (v0.929) —
    // маска общая (bgMaskText), подсветка одна (bgMaskPaintMode). Осталась только заморозка:
    // какая группа маски стоит на месте ("" обе едут, "1"/"0" — эта группа заморожена).
    maskShiftFreeze: st.maskShiftFreeze || "",
    // Единственная подсветка маски в строках: "seq" (сквозно) или "row" (от строки). Своего
    // "выкл" у неё нет — гаснет сама при пустом поле маски.
    bgMaskPaintMode: st.bgMaskPaintMode === "row" ? "row" : "seq",
    // Отдельный выключатель подсветки (v0.936), маску в поле не трогает.
    bgMaskPaintOn: st.bgMaskPaintOn !== false,
    colChg: (typeof colChg !== "undefined" && colChg) ? colChg.value : (st.colChg || "#ff3b3b"),
    colNew: (typeof colNew !== "undefined" && colNew) ? colNew.value : (st.colNew || "#00e5a0"),
    // Что делать с текущей цепочкой перед построением (см. BUILD_PLACE_MODES/#bBuildPlace).
    buildPlace: st.buildPlace || "clear",
    maskPaintColor1: st.maskPaintColor1 || "#b060ff",
    maskPaintColor0: st.maskPaintColor0 || "#22d3ee",
    bgSubPatterns: cBgSubPatternsEl ? cBgSubPatternsEl.checked : false,
    bgSearchAllBelow: cBgAllBelowEl ? cBgAllBelowEl.checked : false,
    fullPassMode: !!st.fullPassMode,
    bgAllPats: cBgAllPatsEl ? cBgAllPatsEl.checked : false,
    bgAllPatsEvery: cBgAllPatsEveryEl ? cBgAllPatsEveryEl.checked : false,
    bgAllPatsPartial: cBgAllPatsPartialEl ? cBgAllPatsPartialEl.checked : false,
    partialPick: st.partialPick || "any",
    chainSrcRows: !!st.chainSrcRows,
    allPatScopeSel: !!st.allPatScopeSel,
    topBuildMode: st.topBuildMode || "rebuild",
    topBuildKind: st.topBuildKind || "inv",
    topBuildOnHit: !!st.topBuildOnHit,
    topBuildNeedHit: !!st.topBuildNeedHit,
    topBuildOnSelect: !!st.topBuildOnSelect,
    growDownOnFind: !!st.growDownOnFind,
    parityView: st.parityView | 0,
    leftMirror: !!st.leftMirror,
    rightMirror: !!st.rightMirror,
    mirrorKindL: mirrorKindOf("l"),
    mirrorKindR: mirrorKindOf("r"),
    mirrorCutAxisL: !!st.mirrorCutAxisL,
    mirrorCutAxisR: !!st.mirrorCutAxisR,
    mirrorsAutoMax: st.mirrorsAutoMax == null ? 1 : st.mirrorsAutoMax,
    mirrorShiftAsIf: !!st.mirrorShiftAsIf,
    popupFontPx: popupFontPx,
    popupStyle: popupStyle,
    resultHeightLocked: resultHeightLocked,
    stepLogHeightLocked: stepLogHeightLocked,
    highlight01: !!st.highlight01,
    highlight1Right: !!st.highlight1Right,
    revKeepShow: !!st.revKeepShow,
    diffLeftShow: !!st.diffLeftShow,
    diffUpShow: !!st.diffUpShow,
    highlightVert1: !!st.highlightVert1,
    highlightDiag1: !!st.highlightDiag1,
    highlightDiagFold: !!st.highlightDiagFold,
    searchOnlyHighlighted: !!st.searchOnlyHighlighted,
    showBalances: !!st.showBalances,
    runsAsBits: !!st.runsAsBits,
    binRowNums: !!st.binRowNums,
    // Какой стороной сейчас приклеены номера к паттернам ("", "right", "left") — см. numGlueToggle():
    // по нему же они отрываются обратно, поэтому состояние обязано пережить перезагрузку.
    numGlue: st.numGlue || "",
    numGlueRows: st.numGlueRows || "",
    binBalance: st.binBalance || "",
    patNumL: !!st.patNumL, patNumR: st.patNumR !== false,
    stairsGroupL: st.stairsGroupL || 1, stairsGroupR: st.stairsGroupR || 1,
    stairsStepL: st.stairsStepL || 1, stairsStepR: st.stairsStepR || 1,
    chgBitsOn: chgBitsOn,
    fs: fs.value, lh: lh.value, ls: ls.value, dim: dimEl.value,
    chainFont: chainFontSelEl ? chainFontSelEl.value : undefined,
    sideW: cssVar("--side-w"), layoutV: LAYOUT_V, patW: cssVar("--pat-w"), patW2: cssVar("--pat-w2"),
    patWManual: patWManual, patW2Manual: patW2Manual,
    bitsW: cssVar("--bits-w"), bitsWManual: bitsWManual,
    patAlign: patAlign, pat2Align: pat2Align,
    fieldInfoOn: !!fieldInfoOn,
    selectEnabled: selectEnabled !== false,
    hideSide: document.body.classList.contains("hide-side"),
    // hidePatL/hidePatR больше не пишутся: скрытия колонок П1/П2 нет вовсе (v0.976). Вместо них —
    // приёмник выравниваний и собственные визуальные сдвиги крайних полей.
    alignTarget: alignTarget,
    patOffL: patOffL || 0, patOffR: patOffR || 0,
    patOffLY: patOffLY || 0, patOffRY: patOffRY || 0, bitsOffY: bitsOffY || 0,
    layerFocus: document.body.classList.contains("layers-on"),
    menuBarBottom: document.body.classList.contains("menubar-bottom"),
    msgPos: msgPos || "",
    c1: col1.value, c0: col0.value, cBg: colBg.value, preset: currentPreset,
    fldL: colFieldL ? colFieldL.value : "#161a22",
    fldC: colFieldC ? colFieldC.value : "#12141a",
    fldR: colFieldR ? colFieldR.value : "#161a22",
    customPreset: st.customPreset || null,
    boldBits: document.body.classList.contains("bold-bits"),
    rowBgSel: rowBgSel.value,
    rowBgSelOpacity: rowBgSelOpacityEl ? rowBgSelOpacityEl.value : 18,
    c01: col01El ? col01El.value : "#ff9900",
    cv1: colVert1El ? colVert1El.value : "#00ccff",
    cd1: colDiag1El ? colDiag1El.value : "#66ff66",
    c11r: col1RightEl ? col1RightEl.value : "#a78bfa",
    cdf: colDiagFoldEl ? colDiagFoldEl.value : "#ff5ecb"
  };
}

function applyUiSettings(u){
  if (!u) return;
  if (u.pull      !== undefined) cPullEl.checked      = u.pull;
  if (u.order     !== undefined) cOrderEl.checked     = u.order;
  if (u.nextOnly  !== undefined) cNextOnlyEl.checked  = u.nextOnly;
  if (u.stageXor  !== undefined) cStageXorEl.checked  = u.stageXor;
  if (u.invPass   !== undefined) cInvPassEl.checked   = u.invPass;
  if (u.autoShift !== undefined) cAutoShiftEl.checked = u.autoShift;
  if (u.stopOnHit !== undefined && cStopOnHitEl) cStopOnHitEl.checked = u.stopOnHit;
  if (u.stopOnBalance !== undefined && cStopOnBalanceEl) cStopOnBalanceEl.checked = u.stopOnBalance;
  if (u.turboAuto !== undefined && cTurboAutoEl) cTurboAutoEl.checked = u.turboAuto;
  if (typeof slowAutoSync === "function") slowAutoSync(); // "🐢 Замедление" — кнопка и ползунок из st
  if (u.captureOnFind !== undefined && cCaptureOnFindEl) cCaptureOnFindEl.checked = u.captureOnFind;
  if (u.horizRotateOnFail !== undefined && cHorizRotateOnFailEl) cHorizRotateOnFailEl.checked = u.horizRotateOnFail;
  if (u.horizAlternateSide !== undefined && cHorizAlternateSideEl) cHorizAlternateSideEl.checked = u.horizAlternateSide;
  if (u.horizReverseChain !== undefined && cHorizReverseChainEl) cHorizReverseChainEl.checked = u.horizReverseChain;
  if (u.horizShowLiveXor !== undefined && cHorizShowLiveXorEl) cHorizShowLiveXorEl.checked = u.horizShowLiveXor;
  if (u.axisSnap !== undefined && cAxisSnapEl) cAxisSnapEl.checked = u.axisSnap;
  if (u.axisBitBounce !== undefined && cAxisBitBounceEl) cAxisBitBounceEl.checked = u.axisBitBounce;
  if (u.edgeOnes !== undefined && cEdgeOnesEl) cEdgeOnesEl.checked = u.edgeOnes;
  if (u.noSplitOnes !== undefined && cNoSplitOnesEl) cNoSplitOnesEl.checked = u.noSplitOnes;
  // Старые сохранёнки хранили здесь галку (true/false) — число из неё получится тем же |0.
  if (u.axisDiagCols !== undefined) setAxisDiagCols(u.axisDiagCols | 0, true);
  if (u.interleavePadEven !== undefined && cInterleavePadEvenEl) cInterleavePadEvenEl.checked = u.interleavePadEven;
  if (u.axisSnapAny !== undefined && cAxisSnapAnyEl) cAxisSnapAnyEl.checked = u.axisSnapAny;
  if (u.axisCenterOffset !== undefined) st.axisCenterOffset = u.axisCenterOffset;
  // Старые сохранёнки хранили ОДИН столбец (axisSnapCol) — переносим его в массив.
  if (Array.isArray(u.axisSnapGroups)) {
    st.axisSnapGroups = u.axisSnapGroups.map(g => Array.isArray(g)
      ? { cols: g.slice(), row: null }
      : { cols: ((g && g.cols) || []).slice(),
          p2: (g && Array.isArray(g.p2)) ? g.p2.slice() : undefined,
          row: (g && g.row != null) ? g.row : null,
          anch: (g && g.anch != null) ? g.anch : undefined });
    syncAxisSnapCols();
  }
  else if (Array.isArray(u.axisSnapCols)) { st.axisSnapGroups = u.axisSnapCols.map(c => ({ cols: [c], row: null })); syncAxisSnapCols(); }
  else if (u.axisSnapCol !== undefined) st.axisSnapCols = (u.axisSnapCol >= 0) ? [u.axisSnapCol] : [];
  if (u.vert      !== undefined) cVertEl.checked      = u.vert;
  if (u.pad       !== undefined) cPadEl.checked       = u.pad;
  if (u.padReal !== undefined && cPadRealEl) cPadRealEl.checked = u.padReal;
  if (u.tailZeros !== undefined && cTailZerosEl) cTailZerosEl.checked = u.tailZeros;
  // kindsMode — новый формат (v0.912). Старый кэш хранил булево u.kinds: true означало "все
  // версии сразу", то есть нынешний "invrev".
  if (u.kindsMode !== undefined) setKindsMode(u.kindsMode, true);
  else if (u.kinds !== undefined) setKindsMode(u.kinds ? "invrev" : "", true);
  if (u.cellSampleOn !== undefined) setCellSampleOn(u.cellSampleOn, true);
  if (u.cellSampleSeq !== undefined) {
    st.cellSampleSeq = u.cellSampleSeq;
    if (typeof updateCellSampleSeqBtn === "function") updateCellSampleSeqBtn();
  }
  if (u.skip1     !== undefined) cSkipEl.checked      = u.skip1;
  if (u.skipLast  !== undefined && cSkipLastEl) { cSkipLastEl.checked = u.skipLast; st.skipLast = u.skipLast; }
  if (u.ringInvert !== undefined && cRingInvertEl) cRingInvertEl.checked = u.ringInvert;
  if (u.ringReverse !== undefined && cRingReverseEl) cRingReverseEl.checked = u.ringReverse;
  if (u.ringOff !== undefined && cRingOffEl) cRingOffEl.checked = u.ringOff;
  if (u.chainCutBelow !== undefined && cChainCutBelowEl) cChainCutBelowEl.checked = u.chainCutBelow;
  if (u.chainCutTail !== undefined && cChainCutTailEl) cChainCutTailEl.checked = u.chainCutTail;
  // chainTileFlow — старый формат (одна галка "сквозная укладка"); переносим в новый режим-группу.
  if (u.chainTileMode) { st.chainTileMode = u.chainTileMode; applyChainTileMode(); }
  else if (u.chainTileFlow !== undefined) { st.chainTileMode = u.chainTileFlow ? "right" : "none"; applyChainTileMode(); }
  if (u.seqSelf !== undefined && cSeqSelfEl) cSeqSelfEl.checked = u.seqSelf;

  if (u.seqGlueMode) {
    st.seqGlueMode = u.seqGlueMode;
    const seqBtns = document.querySelectorAll("#seqGlueGrp button");
    seqBtns.forEach(b => b.classList.toggle("act", b.getAttribute("data-val") === u.seqGlueMode));
  }

  if (u.align) {
    st.align = u.align;
    // Только кнопки выравниваний (data-val) — в полосе теперь живут и чужие, см. v0.866/v0.867:
    // без уточнения ".act" снимался бы и с них (у ◧П1/П2◨ он означает совсем другое).
    const alignBtns = document.querySelectorAll("#alignGrp button[data-val]");
    alignBtns.forEach(b => {
      if (b.getAttribute("data-val") === u.align) b.classList.add("act");
      else b.classList.remove("act");
    });
  }
  // ПОСЛЕ восстановления выравнивания: стрелка на кнопке "⤡ Диагональ осей" зависит от него, а
  // сам режим читался выше (u.axisDiagCols), когда st.align был ещё старый.
  setAxisDiagCols(st.axisDiagCols, true);

  if (u.mode) setMode(u.mode);

  if (u.bgMaskText !== undefined) {
    st.bgMaskText = u.bgMaskText;
    if (bgMaskTextEl) bgMaskTextEl.value = u.bgMaskText;
    // Маска теперь общая и ею же живёт подсветка — её кнопка гаснет/оживает вместе с полем.
    if (typeof updateBgMaskPaintBtn === "function") updateBgMaskPaintBtn();
  }
  if (u.bgMaskOn !== undefined) {
    st.bgMaskOn = u.bgMaskOn;
    if (typeof updateBgMaskOnBtn === "function") updateBgMaskOnBtn();
  }
  if (u.bgMaskRingRestart !== undefined) { st.bgMaskRingRestart = u.bgMaskRingRestart; if (cBgMaskRingRestartEl) cBgMaskRingRestartEl.checked = u.bgMaskRingRestart; }
  if (u.bgMaskScanList !== undefined) {
    st.bgMaskScanList = u.bgMaskScanList;
    if (bgMaskScanListEl) bgMaskScanListEl.value = u.bgMaskScanList;
    if (typeof updateMaskScanRangeNA === "function") updateMaskScanRangeNA();
  }
  // "⇄ Сдвиг по маске" — поле и трёхпозиционная кнопка подсветки (см. fold-4). Элементы ищем по
  // id прямо тут: их обработчики живут в fold-4, который грузится ПОСЛЕ этого файла, и держать на
  // них ссылки-константы здесь было бы рано.
  if (u.maskShiftFreeze !== undefined) {
    st.maskShiftFreeze = u.maskShiftFreeze;
    if (typeof updateMaskShiftFreezeBtn === "function") updateMaskShiftFreezeBtn();
  }
  if (u.bgMaskPaintOn !== undefined) {
    st.bgMaskPaintOn = u.bgMaskPaintOn;
    if (typeof updateBgMaskPaintBtn === "function") updateBgMaskPaintBtn();
  }
  if (u.bgMaskPaintMode !== undefined) {
    st.bgMaskPaintMode = u.bgMaskPaintMode;
    if (typeof updateBgMaskPaintBtn === "function") updateBgMaskPaintBtn();
  }
  if (u.colChg !== undefined && typeof colChg !== "undefined" && colChg) {
    colChg.value = u.colChg; st.colChg = u.colChg; applyColors();
  }
  if (u.colNew !== undefined && typeof colNew !== "undefined" && colNew) {
    colNew.value = u.colNew; st.colNew = u.colNew; applyColors();
  }
  if (u.buildPlace !== undefined) {
    st.buildPlace = u.buildPlace;
    if (typeof updateBuildPlaceBtn === "function") updateBuildPlaceBtn();
  }
  for (const key of ["maskPaintColor1", "maskPaintColor0"]) {
    if (u[key] === undefined) continue;
    st[key] = u[key];
    const el = document.getElementById(key);
    if (el) el.value = u[key];
  }
  if (u.bgSubPatterns !== undefined && cBgSubPatternsEl) { cBgSubPatternsEl.checked = u.bgSubPatterns; st.bgSubPatterns = u.bgSubPatterns; }
  if (u.bgSearchAllBelow !== undefined && cBgAllBelowEl) { cBgAllBelowEl.checked = u.bgSearchAllBelow; st.bgSearchAllBelow = u.bgSearchAllBelow; }
  // "🔻 Полный проход" — кнопка, а не чекбокс: состояние показывается классом mode-act (applyFullPassBtn).
  if (u.fullPassMode !== undefined) { st.fullPassMode = u.fullPassMode; if (typeof applyFullPassBtn === "function") applyFullPassBtn(); }
  if (u.bgAllPats !== undefined && cBgAllPatsEl) { cBgAllPatsEl.checked = u.bgAllPats; st.bgAllPats = u.bgAllPats; }
  if (u.bgAllPatsEvery !== undefined && cBgAllPatsEveryEl) { cBgAllPatsEveryEl.checked = u.bgAllPatsEvery; st.bgAllPatsEvery = u.bgAllPatsEvery; }
  if (u.bgAllPatsPartial !== undefined && cBgAllPatsPartialEl) { cBgAllPatsPartialEl.checked = u.bgAllPatsPartial; st.bgAllPatsPartial = u.bgAllPatsPartial; }
  if (u.partialPick) setPartialPick(u.partialPick, true);
  if (u.chainSrcRows !== undefined) setChainSrcRows(u.chainSrcRows, true);
  if (u.allPatScopeSel !== undefined) setAllPatScope(u.allPatScopeSel, true);
  if (u.topBuildMode) setTopBuildMode(u.topBuildMode, true);
  if (u.topBuildKind) setTopBuildKind(u.topBuildKind, true);
  if (u.topBuildOnHit !== undefined) setTopBuildOnHit(u.topBuildOnHit, true);
  if (u.topBuildNeedHit !== undefined) setTopBuildNeedHit(u.topBuildNeedHit, true);
  if (u.topBuildOnSelect !== undefined) setTopBuildOnSelect(u.topBuildOnSelect, true);
  if (u.growDownOnFind !== undefined) setGrowDownOnFind(u.growDownOnFind, true);
  if (u.parityView !== undefined) setParityView(u.parityView, true);
  if (u.leftMirror !== undefined) setLeftMirror(u.leftMirror, true);
  if (u.rightMirror !== undefined) setRightMirror(u.rightMirror, true);
  // mirrorKind — старый ОБЩИЙ вид зеркал, до разделения на стороны: раскладываем его на обе,
  // чтобы кэш, снятый прошлой версией, не сбрасывал настройку в "реверс+инв".
  if (u.mirrorKind) { setMirrorKind("l", u.mirrorKind, true); setMirrorKind("r", u.mirrorKind, true); }
  if (u.mirrorKindL) setMirrorKind("l", u.mirrorKindL, true);
  if (u.mirrorKindR) setMirrorKind("r", u.mirrorKindR, true);
  if (u.mirrorCutAxisL !== undefined) setMirrorCutAxis("l", u.mirrorCutAxisL, true);
  if (u.mirrorCutAxisR !== undefined) setMirrorCutAxis("r", u.mirrorCutAxisR, true);
  // Автоматику зеркал из кэша НЕ восстанавливаем: если она успела раздуть цепочку, то при загрузке
  // сразу продолжила бы с того же места, и выйти из этого было бы нечем (запрос пользователя: "всё
  // зависло, перезагрузка браузера не помогает"). После перезагрузки её нужно включить руками.
  setMirrorsAuto("off", true);
  if (u.mirrorShiftAsIf !== undefined) setMirrorShiftAsIf(u.mirrorShiftAsIf, true);
  if (u.mirrorsAutoMax !== undefined) {
    st.mirrorsAutoMax = Math.max(1, Math.min(99, u.mirrorsAutoMax | 0 || 1));
    if (mirrorsAutoMaxEl) mirrorsAutoMaxEl.value = st.mirrorsAutoMax;
  }
  if (u.popupFontPx !== undefined) { popupFontPx = u.popupFontPx; applyPopupFont(); }
  // Оформление окна результата (шрифт/цвета/интервал/раскраска 1-0) — см. popupStyle в fold-3.
  if (u.popupStyle && typeof u.popupStyle === "object") { popupStyle = Object.assign(popupStyle, u.popupStyle); applyPopupStyle(); }
  // applyResultHeightLock() тут НЕ вызываем — #chainText на этот момент ещё пустой/не
  // отрендерен реальным содержимым, замерять высоту рано; следующий render() (см. его конец)
  // сам применит актуальное resultHeightLocked с реальным контентом.
  if (u.resultHeightLocked !== undefined) resultHeightLocked = u.resultHeightLocked;
  // Высоту "Черновика шага" применит ближайший render() (applyStepLogBodyHeight) — тут только флаг.
  if (u.stepLogHeightLocked !== undefined) stepLogHeightLocked = u.stepLogHeightLocked;
  if (u.highlight01 !== undefined) {
    st.highlight01 = !!u.highlight01;
    const b = document.getElementById("bHighlight01");
    if (b) b.classList.toggle("mode-act", st.highlight01);
  }
  if (u.highlight1Right !== undefined) {
    st.highlight1Right = !!u.highlight1Right;
    const b = document.getElementById("bHighlight1Right");
    if (b) b.classList.toggle("mode-act", st.highlight1Right);
  }
  // v0.968 — три новые показные подсветки, тем же порядком.
  if (u.revKeepShow !== undefined) {
    st.revKeepShow = !!u.revKeepShow;
    const b = document.getElementById("bReverseKeep");
    if (b) b.classList.toggle("mode-act", st.revKeepShow);
  }
  if (u.diffLeftShow !== undefined) {
    st.diffLeftShow = !!u.diffLeftShow;
    const b = document.getElementById("bDiffLeft");
    if (b) b.classList.toggle("mode-act", st.diffLeftShow);
  }
  if (u.diffUpShow !== undefined) {
    st.diffUpShow = !!u.diffUpShow;
    const b = document.getElementById("bDiffUp");
    if (b) b.classList.toggle("mode-act", st.diffUpShow);
  }
  if (u.highlightVert1 !== undefined) {
    st.highlightVert1 = !!u.highlightVert1;
    const b = document.getElementById("bHighlightVert1");
    if (b) b.classList.toggle("mode-act", st.highlightVert1);
  }
  if (u.highlightDiag1 !== undefined) {
    st.highlightDiag1 = !!u.highlightDiag1;
    const b = document.getElementById("bHighlightDiag1");
    if (b) b.classList.toggle("mode-act", st.highlightDiag1);
  }
  if (u.highlightDiagFold !== undefined) {
    st.highlightDiagFold = !!u.highlightDiagFold;
    const b = document.getElementById("bHighlightDiagFold");
    if (b) b.classList.toggle("mode-act", st.highlightDiagFold);
  }
  if (u.searchOnlyHighlighted !== undefined) {
    st.searchOnlyHighlighted = !!u.searchOnlyHighlighted;
    const b = document.getElementById("bSearchOnlyHl");
    if (b) b.classList.toggle("mode-act", st.searchOnlyHighlighted);
  }
  if (u.showBalances !== undefined) {
    st.showBalances = !!u.showBalances;
    const b = document.getElementById("bShowBalances");
    if (b) b.classList.toggle("mode-act", st.showBalances);
  }
  if (u.runsAsBits !== undefined) {
    st.runsAsBits = !!u.runsAsBits;
    const b = document.getElementById("bRunsAsBits");
    if (b) b.classList.toggle("mode-act", st.runsAsBits);
  }
  if (u.binRowNums !== undefined) {
    st.binRowNums = !!u.binRowNums;
    const b = document.getElementById("bBinRowNums");
    if (b) b.classList.toggle("mode-act", st.binRowNums);
  }
  if (u.numGlue !== undefined) {
    st.numGlue = u.numGlue || "";
    updateNumGlueBtn();
  }
  if (u.numGlueRows !== undefined) {
    st.numGlueRows = u.numGlueRows || "";
    updateNumGlueRowsBtn();
  }
  if (u.binBalance !== undefined) {
    st.binBalance = u.binBalance || "";
    updateBinBalanceBtn();
  }
  if (u.patNumL !== undefined || u.patNumR !== undefined) {
    if (u.patNumL !== undefined) st.patNumL = !!u.patNumL;
    if (u.patNumR !== undefined) st.patNumR = !!u.patNumR;
    applyPatNumClasses();
  }
  if (u.stairsGroupL !== undefined || u.stairsGroupR !== undefined ||
      u.stairsStepL !== undefined || u.stairsStepR !== undefined) {
    st.stairsGroupL = Math.max(1, Math.round(+u.stairsGroupL) || 1);
    st.stairsGroupR = Math.max(1, Math.round(+u.stairsGroupR) || 1);
    st.stairsStepL = Math.max(1, Math.round(+u.stairsStepL) || 1);
    st.stairsStepR = Math.max(1, Math.round(+u.stairsStepR) || 1);
    applyStairsGroupInputs();
  }
  if (u.chgBitsOn !== undefined) {
    chgBitsOn = !!u.chgBitsOn;
    const b = document.getElementById("bToggleChgBits");
    if (b) b.classList.toggle("mode-act", chgBitsOn);
  }
  if (u.bgSearchOn !== undefined) st.bgSearchOn = !!u.bgSearchOn;
  if (u.bgSearchModes && u.bgSearchModes.length) {
    st.bgSearchModes = u.bgSearchModes;
    const bgBtns = document.querySelectorAll("#bgSearchModeGrp button");
    bgBtns.forEach(b => b.classList.toggle("act", st.bgSearchModes.includes(b.getAttribute("data-val"))));
  } else if (u.bgSearchMode) {
    /* Старый формат кэша (один режим строкой) — переносим в новый массив-мультиселект */
    st.bgSearchModes = [u.bgSearchMode];
    const bgBtns = document.querySelectorAll("#bgSearchModeGrp button");
    bgBtns.forEach(b => b.classList.toggle("act", st.bgSearchModes.includes(b.getAttribute("data-val"))));
  }
  // Старый формат кэша — отдельная галка "🔍 Фон-поиск" (убрана, см. bgSearchActive()) была
  // выключена — переносим это в новый формат: снимаем все режимы разом.
  if (u.bgSearch === false) {
    st.bgSearchModes = [];
    const bgBtns = document.querySelectorAll("#bgSearchModeGrp button");
    bgBtns.forEach(b => b.classList.remove("act"));
  }

  if (u.fs){ fs.value = u.fs; applyFont(); }
  if (u.chainFont && chainFontSelEl) { chainFontSelEl.value = u.chainFont; applyChainFont(); }
  if (u.lh){ lh.value = u.lh; applyLh(); }
  if (u.ls !== undefined){ ls.value = u.ls; applyLs(); }
  if (u.dim){ dimEl.value = u.dim; applyDim(); }

  // Ширина боковых доков. ВАЖНО: значение отсюда ложится ИНЛАЙНОМ на documentElement, а инлайн
  // перебивает любое правило в <style> — то есть сохранённая ширина сильнее той, что задана в CSS.
  // Из-за этого правка --side-w в стилях НЕ ДОХОДИЛА до тех, у кого уже лежала сохранёнка со старой
  // шириной (300px): в CSS одно, на экране другое, и разница объяснялась только через инспектор.
  // Поэтому вместе с шириной пишется метка раскладки (layoutV): не совпала с текущей — сохранённая
  // ширина считается устаревшей и не применяется, берётся значение из CSS. Меняешь ширины в стилях
  // и хочешь, чтобы это увидели все, — увеличь LAYOUT_V.
  if (u.sideW && u.layoutV === LAYOUT_V) document.documentElement.style.setProperty("--side-w", u.sideW);
  // Подстраховка от старых сохранёнок с шириной колонки паттернов ниже нового минимума
  // перетаскивания (40px, см. makeDrag/makeDragRight ниже) — при таком значении текст
  // паттерна раньше утыкался в границу .vsplit/.vsplit2 (см. комментарий там).
  if (u.patW)  document.documentElement.style.setProperty("--pat-w", Math.max(40, parseFloat(u.patW) || 40) + "px");
  if (u.patW2) document.documentElement.style.setProperty("--pat-w2", Math.max(40, parseFloat(u.patW2) || 40) + "px");
  // Ширину правой колонки пользователь двигал сам — автоподбор по длине паттерна (fitPatW2) не
  // вмешивается; иначе она подгоняется на каждом render().
  if (u.patWManual !== undefined) patWManual = !!u.patWManual;
  if (u.patW2Manual !== undefined) patW2Manual = !!u.patW2Manual;
  if (u.fieldInfoOn !== undefined) { fieldInfoOn = !!u.fieldInfoOn; applyFieldInfo(); }
  if (u.selectEnabled !== undefined) { selectEnabled = u.selectEnabled !== false; applySelectEnabled(); }
  if (u.patAlign || u.pat2Align) {
    if (u.patAlign) patAlign = u.patAlign;
    if (u.pat2Align) pat2Align = u.pat2Align;
    applyPatAligns();
    if (typeof syncAlignBanned === "function") syncAlignBanned();
  }
  if (u.bitsWManual) {
    bitsWManual = true;
    document.body.classList.add("bits-w-manual");
    if (u.bitsW) document.documentElement.style.setProperty("--bits-w", u.bitsW);
  }

  if (u.hideSide !== undefined) {
    if (u.hideSide) document.body.classList.add("hide-side");
    else document.body.classList.remove("hide-side");
  }
  /* СКРЫТИЯ КОЛОНОК П1/П2 БОЛЬШЕ НЕТ (v0.976). Классы снимаем ЯВНО и безусловно: в старых кэшах
     hidePatL/hidePatR могли остаться включёнными, и поле так и осталось бы невидимым, а вернуть
     его теперь нечем — кнопка занята другим делом. */
  document.body.classList.remove("hide-pat-l", "hide-pat-r");
  // Приёмник выравниваний и визуальные сдвиги крайних полей — на их место.
  if (u.alignTarget === "L" || u.alignTarget === "R" || u.alignTarget === "C") alignTarget = u.alignTarget;
  if (typeof u.patOffL === "number") patOffL = u.patOffL;
  if (typeof u.patOffR === "number") patOffR = u.patOffR;
  if (typeof u.patOffLY === "number") patOffLY = u.patOffLY;
  if (typeof u.patOffRY === "number") patOffRY = u.patOffRY;
  if (typeof u.bitsOffY === "number") bitsOffY = u.bitsOffY;
  if (u.layerFocus !== undefined) setLayerFocus(!!u.layerFocus, true);
  if (u.menuBarBottom !== undefined) setMenuBarBottom(!!u.menuBarBottom, true);
  if (typeof applyMsgPos === "function") applyMsgPos(u.msgPos || "");
  // Кнопку-индикатор приёмника (#bAlignTargetInd) синхронизирует syncAlignBanned() ниже — своего
  // отдельного кода тут больше не нужно (было для «◧ П1»/«П2 ◨», убраны в v1.003).
  if (typeof syncAlignBanned === "function") syncAlignBanned();
  if (typeof applyPatOffsets === "function") applyPatOffsets();

  if (u.c1) col1.value = u.c1;
  if (u.c0) col0.value = u.c0;
  if (u.cBg) colBg.value = u.cBg;
  if (u.customPreset !== undefined) st.customPreset = u.customPreset;
  if (u.preset !== undefined) setPresetActive(u.preset);
  applyColors();

  if (u.fldL && colFieldL) colFieldL.value = u.fldL;
  if (u.fldC && colFieldC) colFieldC.value = u.fldC;
  if (u.fldR && colFieldR) colFieldR.value = u.fldR;
  applyFieldColors();

  if (u.boldBits !== undefined) {
    document.body.classList.toggle("bold-bits", !!u.boldBits);
    const bb = document.getElementById("bBoldBits");
    if (bb) bb.classList.toggle("mode-act", !!u.boldBits);
  }

  if (u.rowBgSel) rowBgSel.value = u.rowBgSel;
  if (u.rowBgSelOpacity !== undefined && rowBgSelOpacityEl) rowBgSelOpacityEl.value = u.rowBgSelOpacity;
  applyColorsSel();

  if (u.c01 && col01El) col01El.value = u.c01;
  applyColor01();

  if (u.cv1 && colVert1El) colVert1El.value = u.cv1;
  applyColorVert1();

  if (u.cd1 && colDiag1El) colDiag1El.value = u.cd1;
  applyColorDiag1();

  if (u.c11r && col1RightEl) col1RightEl.value = u.c11r;
  applyColor1Right();

  if (u.cdf && colDiagFoldEl) colDiagFoldEl.value = u.cdf;
  applyColorDiagFold();

  if (u.cdl && colDiffLeftEl) colDiffLeftEl.value = u.cdl;
  applyColorDiffLeft();
  if (u.cdu && colDiffUpEl) colDiffUpEl.value = u.cdu;
  applyColorDiffUp();

  if (u.rowCount && rowCountEl) {
    rowCountEl.value = u.rowCount;
    document.getElementById("rowCountVal").textContent = rowCountEl.value;
  }

  readToggles();
}

/* Настройки вида/поиска (цвета, шрифт, галки и т.п.) — ОТДЕЛЬНО от данных цепочек, см. кнопки
   в #viewGroup и tabSaveChainData()/tabResetChainData() (те — только про rows/pats). Сброс
   всегда ведёт на жёстко зашитые значения по умолчанию (совпадают с исходными checked/value
   в самом HTML), а не на то, что было сохранено кнопкой "Сохр. настройки". */
const DEFAULT_UI_SETTINGS = {
  pull: true, order: true, nextOnly: false, stageXor: false, invPass: false,
  autoShift: false, stopOnHit: true, stopOnBalance: false, turboAuto: false, captureOnFind: true, vert: false, pad: false, kindsMode: "", cellSampleOn: false, cellSampleSeq: false, skip1: true,
  ringInvert: false, ringReverse: false, ringOff: false,
  chainCutBelow: false, chainCutTail: false, chainTileMode: "none",
  seqSelf: false, seqGlueMode: "right",
  horizRotateOnFail: true, horizAlternateSide: false, horizReverseChain: false, horizShowLiveXor: true,
  axisSnap: true, axisBitBounce: false, axisCenterOffset: 0,
  // Полоса выравниваний бьёт в центральное поле, крайние поля не сдвинуты (v0.976).
  alignTarget: "C", patOffL: 0, patOffR: 0,
  patOffLY: 0, patOffRY: 0, bitsOffY: 0, layerFocus: true, msgPos: "", menuBarBottom: false,
  axisSnapCols: [],
  axisSnapGroups: [],
  interleavePadEven: false,
  axisSnapAny: false,
  growDownOnFind: false,
  parityView: 0,
  colNew: "#00e5a0",
  buildPlace: "clear",
  align: "center", mode: "step1", rowCount: "100",
  bgSearchModes: ["interleave", "xor2", "xorAll", "concatR", "concatRInv", "concatRRevInv", "concatL", "concatLInv", "concatLRevInv", "concatSnake", "concatSnakeInv", "concatSnakeRevInv", "concatSnakeFromR", "concatSnakeFromRInv", "concatSnakeFromRRevInv", "vertR", "vertL", "snakeR", "snakeL", "vertZigR", "vertZigL", "diagR", "diagL"],
  bgSearchOn: true,
  bgSubPatterns: false,
  // "🎭 Маска" фон-поиска — пусто по умолчанию (ищем паттерн строки ниже, как всегда).
  bgMaskText: "",
  bgMaskOn: true,
  bgMaskRingRestart: true,
  bgMaskScanList: "",
  // "⇄ Сдвиг по маске": маска общая (bgMaskText), заморозка выключена. Подсветка маски одна и
  // своего "выкл" не имеет — по умолчанию сквозной счёт, гаснет сама при пустом поле маски.
  maskShiftFreeze: "",
  bgMaskPaintMode: "seq",
  bgMaskPaintOn: true,
  colChg: "#ff3b3b",
  maskPaintColor1: "#b060ff",
  maskPaintColor0: "#22d3ee",
  bgSearchAllBelow: false,
  fullPassMode: false,
  bgAllPats: false,
  // "🔁 Все вхождения" — подсвечивать паттерн ВЕЗДЕ, где встретился, а не только в первом
  // месте (работает только вместе с bgAllPats, см. findAllPatternsInResult).
  bgAllPatsEvery: false,
  // "🧩 Макс. часть" — см. findLongestPartialHit (тоже только вместе с bgAllPats).
  bgAllPatsPartial: false,
  // Какой кусок паттерна ищет "🧩 Макс. часть": "any" — любой (как было всегда), "head" — только
  // от начала паттерна, "tail" — только с его конца. См. #partPickGrp/findLongestPartialHit.
  partialPick: "any",
  chgBitsOn: true,
  popupFontPx: 10,
  popupStyle: { ff: "", fg: "", bg: "", lh: 1, bits: false, one: "#ffe08a", zero: "#5a6a85", bare: false, flow: false, maskCut: false, pulse: false, pulseSec: 1.6 },
  resultHeightLocked: true,
  stepLogHeightLocked: false,
  highlight01: false,
  highlightVert1: false,
  highlightDiag1: false,
  highlightDiagFold: false,
  searchOnlyHighlighted: false,
  showBalances: false,
  runsAsBits: false,
  binRowNums: false,
  numGlue: "",
  numGlueRows: "",
  binBalance: "",
  patNumL: false, patNumR: true,
  stairsGroupL: 1, stairsGroupR: 1, stairsStepL: 1, stairsStepR: 1,
  fs: "19", lh: "0.65", ls: "0", dim: "100",
  chainFont: '"Roboto Mono", Consolas, monospace',
  sideW: "300px", patW: "12em", patW2: "12em",
  hideSide: false, hidePatL: false, hidePatR: false,
  c1: "#ff3333", c0: "#555555", cBg: "#000000", preset: "crypto", customPreset: null,
  fldL: "#161a22", fldC: "#12141a", fldR: "#161a22",
  boldBits: false,
  rowBgSel: "#ffcf6b",
  rowBgSelOpacity: 18,
  c01: "#ff9900", cv1: "#00ccff", cd1: "#66ff66", c11r: "#a78bfa", cdf: "#ff5ecb"
};

/* Сохранение/сброс настроек вида. Кнопки переехали из вкладки "Вид" в подвал выпадающего списка
   цепочек (v0.834, запрос пользователя), а тот перерисовывается целиком при каждом renderTabs() —
   вешать onclick по id больше не на что. Поэтому тут просто функции, а зовёт их делегированный
   обработчик списка (см. data-act="uisave"/"uireset" в fold-2-render.js). */
function saveUiSettingsNow(){
  st.savedUiSettings = captureUiSettings();
  saveCache();
  say("✓ Настройки вида/поиска сохранены!");
}
function resetUiSettingsNow(){
  applyUiSettings(DEFAULT_UI_SETTINGS);
  render();
  saveCache();
  say("✓ Настройки вида/поиска сброшены к умолчаниям!");
}

function saveCache(){
  if (SAFE_MODE || cacheWiped) return; // см. SAFE_MODE/cacheWiped — кэш не перезаписываем
  try{
    saveActiveTabState(); // Обязательно сохраняем вкладку перед записью в сторадж
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      activeTab: st.activeTab || 0,
      tabs: st.tabs || [],
      ui: captureUiSettings(),
      savedUiSettings: st.savedUiSettings || null,
      // Кэш паттернов (см. st.patBank) — рядом с вкладками, а не внутри них: он один на все.
      patBank: st.patBank || [],
      // Свои слоты цветов "Своя 1..4" — там же и по той же причине: они общие для всех цепочек
      // (см. colorSlotSave/colorSlotApply).
      colorSlots: st.colorSlots || []
    }));
  }catch(e){}
}

/* ОТЛОЖЕННАЯ запись кэша — для мест, где saveCache() зовётся ПОТОКОМ.
   saveCache() выше сериализует ВСЕ вкладки целиком: на картинке 1000 строк по 1000 символов это
   мегабайты JSON, и localStorage.setItem пишет их СИНХРОННО, тормозя всё остальное. При этом
   ползунки шрифта/интервала/затемнения и ввод в текстовые поля зовут её на КАЖДЫЙ oninput —
   десятки раз за одно перетаскивание ручки и на каждое нажатие клавиши. Склеиваем такие пачки в
   одну запись.
   Что кладётся в кэш, при этом не меняется НИ НА ЙОТУ — меняется только момент записи, поэтому
   на поиск, подсветки и любую другую логику это не влияет. Чтобы отложенное не потерялось,
   дописываем его принудительно при уходе со страницы и при сворачивании вкладки.
   var — тот же случай, что colStepCache (вызов возможен раньше этой строки). */
var saveCacheTimer = null;
function saveCacheSoon(){
  if (saveCacheTimer) return; // пачка уже собирается — запись состоится в её конце
  saveCacheTimer = setTimeout(() => { saveCacheTimer = null; saveCache(); }, 250);
}
function flushSaveCache(){
  if (!saveCacheTimer) return;
  clearTimeout(saveCacheTimer);
  saveCacheTimer = null;
  saveCache();
}
window.addEventListener("beforeunload", flushSaveCache);
document.addEventListener("visibilitychange", () => { if (document.hidden) flushSaveCache(); });

function loadCache(){
  if (SAFE_MODE) {
    // Сообщение с задержкой — say() до готовности DOM ничего не покажет.
    setTimeout(() => say("Аварийный режим (#safe): сохранённые цепочки не загружены и не перезаписываются."), 300);
    return false;
  }
  let d = null;
  try{ d = JSON.parse(localStorage.getItem(CACHE_KEY) || "null"); }catch(e){}
  if (!d) return false;

  const u = d.ui || {};
  applyUiSettings(u);
  if (!u.mode) setMode("step1");
  if (!u.lh) applyLh();
  if (u.ls === undefined) applyLs();
  if (!u.dim) applyDim();
  if (u.hideSide === undefined) document.body.classList.add("hide-side");
  st.savedUiSettings = d.savedUiSettings || null;
  st.patBank = Array.isArray(d.patBank) ? d.patBank.filter(t => typeof t === "string") : [];
  // Слоты цветов — общие для всех цепочек, поэтому читаются из корня кэша, а не из uiSettings.
  st.colorSlots = Array.isArray(d.colorSlots) ? d.colorSlots.slice(0, 4).map(c => (c && c.c1) ? c : null) : [];
  updateColorSlotBtns();

  // Загружаем вкладки Цепочек из кэша
  if (d.tabs && d.tabs.length > 0) {
    st.tabs = d.tabs;
    st.activeTab = d.activeTab || 0;
    if (st.activeTab >= st.tabs.length) st.activeTab = 0;
    loadTabState(st.activeTab, true);
  } else {
    st.tplRows = generateSierpinski90(128);
    st.tplPats = generateSierpinski90(128);
    st.rows = st.tplRows.slice();
    st.used = st.rows.map(() => false);
    st.pats = st.tplPats.map((t, i) => ({ text: t, ord: i, found: false, kind: null, step: null }));
    st.selectedRows = new Set();
    st.step = 0; st.passCount = 0;
    st.tailBuffer = "";
    st.aIdx = 0; st.bIdx = 1;
    st.goingUp = false; st.hit = null; st.undo = []; st.redo = [];
    st.tabs = [createDefaultTabState("Цепочка 1")];
    st.activeTab = 0;
  }

  if (rowCountEl && st.tplRows.length > 0) {
    const total = Math.max(2, st.tplRows.length);
    rowCountEl.max = total;
    if (u.rowCount) rowCountEl.value = Math.min(total, +u.rowCount);
    else rowCountEl.value = total;
    document.getElementById("rowCountVal").textContent = rowCountEl.value;
  }
  
  readToggles();
  // st.lastDirMode не сохраняется между загрузками (см. captureUiSettings/applyUiSettings —
  // его там нет намеренно, это чисто рабочее состояние текущей сессии), поэтому ВСЕГДА null
  // после setMode() выше (тот сам его гасит). Реальное поведение по умолчанию у Тетриса/Тетриса 2
  // (см. tetrisRotateFns()) — "вправо с инверсией", если ни одна из 4 кнопок ещё не нажата — так
  // что кнопку ► Круг Инв нужно сразу пометить активной, а не оставлять ничего не подсвеченным,
  // раз это и есть фактически действующий режим — запрос пользователя "при этом кнопку выделить
  // тогда включить". Вызывается ПОСЛЕ всех setMode()/loadTabState() выше (те сбрасывают
  // lastDirMode в null), иначе тут же было бы затёрто обратно.
  setLastDirMode("shiftRInv");
  render();
  return st.rows.length > 0;
}

// ЗАЩИТА: Добавляем слушатели только если элементы существуют!
const taRowsEl = document.getElementById("taRows");
const taPatsEl = document.getElementById("taPats");
if (taRowsEl) taRowsEl.addEventListener("input", saveCacheSoon);
if (taPatsEl) taPatsEl.addEventListener("input", saveCacheSoon);

for (const el of [cSkipLastEl, cPullEl, cOrderEl, cNextOnlyEl, cStageXorEl, cInvPassEl, cAutoShiftEl, cStopOnHitEl, cStopOnBalanceEl, cTurboAutoEl, cCaptureOnFindEl, cVertEl, cPadEl, cSkipEl, cHorizRotateOnFailEl, cHorizAlternateSideEl, cHorizReverseChainEl]) {
  if (el) el.addEventListener("change", () => { readToggles(); saveCache(); });
}
// cRingInvert влияет только на панель результата фон-поиска (не на данные строк) — ему нужен
// явный render(), иначе изменение не видно, пока не случится другое действие (правка строки
// и т.п.), которое само вызовет render().
if (cRingInvertEl) cRingInvertEl.addEventListener("change", () => { readToggles(); render(); saveCache(); });
if (cRingReverseEl) cRingReverseEl.addEventListener("change", () => { readToggles(); render(); saveCache(); });
if (cRingOffEl) cRingOffEl.addEventListener("change", () => { readToggles(); render(); saveCache(); });
// Отключалка строк ниже выделения — две ВЗАИМОИСКЛЮЧАЮЩИЕ галки: включаешь одну, вторая сама
// снимается (обе разом смысла не имеют — "ниже ничего" строже, чем "только первая ниже").
if (cChainCutBelowEl) cChainCutBelowEl.addEventListener("change", () => {
  if (cChainCutBelowEl.checked && cChainCutTailEl) cChainCutTailEl.checked = false;
  readToggles(); render(); saveCache();
});
if (cChainCutTailEl) cChainCutTailEl.addEventListener("change", () => {
  if (cChainCutTailEl.checked && cChainCutBelowEl) cChainCutBelowEl.checked = false;
  readToggles(); render(); saveCache();
});
if (cSeqSelfEl) cSeqSelfEl.addEventListener("change", () => { readToggles(); render(); saveCache(); });
// cHorizShowLiveXor — тоже чисто про отображение строки в основной таблице (не про данные), см.
// её комментарий выше — нужен явный render(), как и у cRingInvert/cRingReverse/cSeqSelf.
if (cHorizShowLiveXorEl) cHorizShowLiveXorEl.addEventListener("change", () => { readToggles(); render(); saveCache(); });
if (cAxisSnapEl) cAxisSnapEl.addEventListener("change", () => { readToggles(); render(); saveCache(); });
// Настройка интерлива читается из st (см. readToggles) — перерисовка нужна, чтобы фон-поиск
// пересчитал свой результат под новую настройку сразу, а не после следующего действия.
if (cInterleavePadEvenEl) cInterleavePadEvenEl.addEventListener("change", () => { readToggles(); render(); saveCache(); });
if (cAxisSnapAnyEl) cAxisSnapAnyEl.addEventListener("change", () => { readToggles(); saveCache(); });
// "0️⃣→ Нули в сами строки" — включили, значит вписываем их прямо сейчас (дальше добивка
// повторяется перед каждым круговым сдвигом, см. mirrorsBeforeShift).
if (cTailZerosEl) cTailZerosEl.addEventListener("change", () => { readToggles(); render(); saveCache(); });
if (cPadRealEl) cPadRealEl.addEventListener("change", () => {
  readToggles();
  if (st.padZeroReal) {
    if (!st.padZero) say("Нули в строки: сначала включите «0 вместо пустот» — она задаёт саму сетку.");
    else padZerosToRows(false);
  }
  render(); saveCache();
});
// Смена режима края сбрасывает накопленные направления обхода — иначе строка, уже "идущая
// обратно", продолжила бы двигаться против только что нажатой кнопки.
if (cAxisBitBounceEl) cAxisBitBounceEl.addEventListener("change", () => { readToggles(); axisBitDirMap.clear(); rowRotOffMap.clear(); render(); saveCache(); });
if (cEdgeOnesEl) cEdgeOnesEl.addEventListener("change", () => { readToggles(); edgeOnesSideMap.clear(); render(); saveCache(); });
if (cNoSplitOnesEl) cNoSplitOnesEl.addEventListener("change", () => { readToggles(); render(); saveCache(); });

if (!loadCache()){
  /* Самая первая загрузка вообще (localStorage ещё пуст) — createDefaultTabState() берёт
     rows/pats/used ИЗ ЖИВОГО st (st.rows ? ... : []), а не из tplRows/tplPats. Раньше тут
     заполняли только tplRows/tplPats и сразу звали createDefaultTabState() — st.rows на тот
     момент был пуст (дефолт из объекта st), поэтому у самой первой вкладки rows оказывались
     пустыми и холст оставался чёрным до первого loadTabState()/resetAll() с других действий. */
  const s90 = generateSierpinski90(128);
  st.tplRows = s90;
  st.tplPats = s90.slice();
  st.rows = st.tplRows.slice();
  st.used = st.rows.map(() => false);
  st.pats = st.tplPats.map((t, i) => ({ text: t, ord: i, found: false, kind: null, step: null }));
  st.tabs = [createDefaultTabState("Цепочка 1")];
  st.activeTab = 0;
  loadTabState(0, true);
  applyColors();
  applyFieldColors();
  // loadTabState() выше применяет uiSettings свежесозданной вкладки (см. createDefaultTabState),
  // а это по пути дёргает setMode() — та гасит lastDirMode обратно в null, затирая то, что уже
  // выставил loadCache() (см. её конец) — досовём тот же дефолт ещё раз, уже после. setLastDirMode()
  // сама подсвечивает кнопку (прямой classList.toggle) — отдельный render() тут не нужен.
  setLastDirMode("shiftRInv");
  saveCache();
}
// Что построено сверху на момент загрузки — база для Сброса/Escape (сам слепок в кэш не пишется,
// см. topBaseCapture): после перезагрузки страницы построенное считается "как построено", и Сброс
// снимет с него только то, что допишут уже в этой сессии.
topBaseCapture();
/* === МАРКЕР TOUCHPAD: ВИРТУАЛЬНЫЙ КУРСОР ДЛЯ ТАЧ-УСТРОЙСТВ =================================
   Задача: на телефоне попадать по ОТДЕЛЬНОМУ БИТУ. Прямое касание для этого не годится в
   принципе — палец накрывает несколько строк сразу и физически закрывает собой то место, куда
   целишься. Поэтому работаем как удалёнка (AnyDesk и подобные): палец водит перекрестье
   ОТНОСИТЕЛЬНО, как по тачпаду ноутбука, а нажатия шлются отдельными кнопками.
   Разделение пальцев выбрано так, чтобы НИЧЕГО не отнять у браузера:
     один палец  — двигает перекрестье (только тут зовём preventDefault);
     два пальца  — не трогаем вообще, поэтому родная прокрутка и ЩИПКОВЫЙ ЗУМ работают как всегда.
   Клик синтезируем в элемент ПОД перекрестьем (elementFromPoint). Шлём полную последовательность
   pointerdown → mousedown → mouseup → click: обработчики в приложении навешаны на разные события
   (где-то onclick, где-то mousedown/mousemove), и половинчатая последовательность часть из них
   просто не разбудила бы.
   "Зажать" держит кнопку нажатой между касаниями — только так работают протяжки: выделение
   диапазона строк, выбор ячеек, перетаскивание ручки оси и разделителей колонок. */
function initTouchPad(){
  const cur = document.getElementById("vcur");
  const toggle = document.getElementById("vcurToggle");
  // Разметка курсора лежит в body ПОСЛЕ этого <script>, поэтому на момент разбора скрипта её ещё
  // нет — при немедленном запуске getElementById вернул бы null и весь режим молча не включился бы
  // вовсе. Отсюда отложенный старт ниже.
  if (!cur || !toggle) return;
  // Чувствительность: <1 — перекрестье движется МЕДЛЕННЕЕ пальца. Это и есть весь смысл затеи —
  // мелкое прицеливание там, где палец грубее цели.
  const SPEED = 0.6;
  let x = Math.round(innerWidth / 2), y = Math.round(innerHeight / 2);
  let lastX = 0, lastY = 0, tracking = false, held = false;

  const place = () => { cur.style.left = x + "px"; cur.style.top = y + "px"; };
  const clamp = () => {
    x = Math.max(0, Math.min(innerWidth - 1, x));
    y = Math.max(0, Math.min(innerHeight - 1, y));
  };
  const target = () => document.elementFromPoint(x, y);
  const fire = (el, type, extra) => {
    if (!el) return;
    const init = Object.assign({ bubbles: true, cancelable: true, clientX: x, clientY: y,
                                 view: window, button: 0, buttons: 1 }, extra || {});
    // PointerEvent есть не везде — там, где его нет, обходимся мышиными: приложение слушает
    // именно мышиные, pointer* добавлены только для полноты.
    if (type.startsWith("pointer")) {
      if (typeof PointerEvent !== "function") return;
      el.dispatchEvent(new PointerEvent(type, Object.assign({ pointerId: 1, pointerType: "touch",
                                                              isPrimary: true }, init)));
    } else {
      el.dispatchEvent(new MouseEvent(type, init));
    }
  };
  const press = () => { const el = target(); fire(el, "pointerdown"); fire(el, "mousedown"); return el; };
  const release = (el) => {
    const t = el || target();
    fire(t, "mouseup", { buttons: 0 });
    fire(t, "pointerup", { buttons: 0 });
    return t;
  };

  // ── Перемещение перекрестья одним пальцем ────────────────────────────────────────────────
  const onStart = (e) => {
    if (!document.body.classList.contains("vcur-on")) return;
    if (e.touches.length !== 1) { tracking = false; return; } // два пальца — отдаём браузеру
    // Касания по самой панели курсора и по кнопке включения — обычные нажатия, не движение.
    if (e.target.closest && e.target.closest("#vcurBar, #vcurToggle")) return;
    tracking = true;
    lastX = e.touches[0].clientX;
    lastY = e.touches[0].clientY;
    e.preventDefault();
  };
  const onMove = (e) => {
    if (!tracking || !document.body.classList.contains("vcur-on")) return;
    if (e.touches.length !== 1) { tracking = false; return; }
    const t = e.touches[0];
    x += (t.clientX - lastX) * SPEED;
    y += (t.clientY - lastY) * SPEED;
    lastX = t.clientX; lastY = t.clientY;
    clamp(); place();
    // Пока кнопка "зажата", движение должно доходить до приложения — иначе протяжкой ничего не
    // выделить: и выделение строк, и ручки слушают именно mousemove.
    if (held) { const el = target(); fire(el, "pointermove"); fire(el, "mousemove"); }
    e.preventDefault();
  };
  const onEnd = () => { tracking = false; };
  // passive:false обязателен — иначе preventDefault не сработает и страница будет уезжать под
  // пальцем вместо движения перекрестья.
  document.addEventListener("touchstart", onStart, { passive: false });
  document.addEventListener("touchmove", onMove, { passive: false });
  document.addEventListener("touchend", onEnd, { passive: true });
  document.addEventListener("touchcancel", onEnd, { passive: true });

  // ── Кнопки ───────────────────────────────────────────────────────────────────────────────
  const bind = (id, fn) => {
    const el = document.getElementById(id);
    if (!el) return;
    // click, а не touchstart: кнопки панели должны работать и мышью (удобно проверять на десктопе).
    el.addEventListener("click", (ev) => { ev.preventDefault(); ev.stopPropagation(); fn(); });
  };
  bind("vcurClick", () => { const el = press(); release(el); fire(el, "click", { buttons: 0 }); });
  bind("vcurDbl", () => {
    const el = press(); release(el); fire(el, "click", { buttons: 0, detail: 1 });
    press(); release(el); fire(el, "click", { buttons: 0, detail: 2 });
    fire(el, "dblclick", { buttons: 0, detail: 2 });
  });
  bind("vcurHold", () => {
    const btn = document.getElementById("vcurHold");
    if (!held) {
      press(); held = true;
      document.body.classList.add("vcur-hold");
      if (btn) btn.textContent = "✋ Отпустить";
    } else {
      const el = release(); held = false;
      fire(el, "click", { buttons: 0 });
      document.body.classList.remove("vcur-hold");
      if (btn) btn.textContent = "✊ Зажать";
    }
  });
  const setOn = (on) => {
    document.body.classList.toggle("vcur-on", on);
    if (on) { clamp(); place(); }
    else if (held) {
      // Выходя из режима, кнопку обязательно отпускаем: иначе приложение осталось бы думать, что
      // мышь всё ещё нажата, и следующая протяжка повела бы себя непредсказуемо.
      release(); held = false;
      document.body.classList.remove("vcur-hold");
      const btn = document.getElementById("vcurHold");
      if (btn) btn.textContent = "✊ Зажать";
    }
  };
  bind("vcurOff", () => setOn(false));
  toggle.addEventListener("click", (ev) => {
    ev.preventDefault();
    setOn(!document.body.classList.contains("vcur-on"));
  });
  addEventListener("resize", () => { clamp(); place(); });
  place();

  // "▤ Панели" — тот же переключатель, что и штатная кнопка (body.hide-side), просто доступный
  // с телефона. Состояние сохраняется тем же saveCache, так что после перезагрузки останется как
  // оставили.
  const sideBtn = document.getElementById("sideHideBtn");
  if (sideBtn) sideBtn.addEventListener("click", (ev) => {
    ev.preventDefault();
    document.body.classList.toggle("hide-side");
    saveCache();
  });
}
// Ждём разбора body — см. комментарий в initTouchPad. Если DOM уже готов (скрипт подключили иначе),
// запускаемся сразу.
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initTouchPad);
else initTouchPad();


/* ПОДСКАЗКИ (title) ВЫНЕСЕНЫ ИЗ РАЗМЕТКИ СЮДА. Длинные title раздували строки HTML до
   нескольких тысяч символов: одна такая строка при любом поиске по файлу выдаётся целиком и
   стоит дороже, чем весь остальной обход. Теперь в разметке стоит короткий data-tip=tN, а
   сам текст лежит здесь и проставляется в element.title при загрузке.
   ПРАВИТЬ ПОДСКАЗКУ НАДО ТУТ, а не в разметке. */
const TIPS = {
  t144: "Один клик — одна проверка «без сдвигов», но не всей маской целиком, а её НАЧАЛОМ, которое с каждым кликом длиннее на бит. Маски берутся из МНОГОСТРОЧНОГО ПОЛЯ СПИСКА ниже (по одной в строке — можно писать руками или набить кнопками «🧩 Паттерны»/«⛓ Строки»/«➡ Сквозные»): сначала проходятся все начала первой маски списка, потом второй и так далее, кончился список — обход идёт по кругу. Список пуст — наращивается маска из однострочного поля «🎭 Маска (прореж.)». Первый шаг берёт самое короткое начало, где есть и «1», и «0» (короче маска ничего не прореживает), последний — маску целиком; дальше обход начинается сначала. Задумано под длинные маски из «➡ Сквозные»: целиком такая почти ничего не берёт, зато видно, на какой длине начала находка появляется или пропадает. Строки при этом не двигаются — считаются все включённые режимы фон-поиска и все фазы текущего начала, а полный разбор шага (какая сейчас маска, какие строки, какая фаза, что взято и где совпало) пишется в «🧾 Черновик шага» и в «Лог находок». Начало ставится прямо в поле «🎭 Маска (прореж.)», так что подсветка и «Результат» показывают ровно его. Поле правили руками — обход начнётся заново от того, что в нём сейчас; кнопка ↺ рядом сбрасывает обход принудительно",
  t1:"Повтор отменённого шага (Ctrl+Y / Ctrl+Shift+Z). Ходит по той же цепочке, что и «↩ Отмена», только вперёд; как только сделано любое новое действие — повторять становится нечего",
  t2: "Открыть ВСЕ вкладки в отдельном окне: панели переезжают туда живыми (продолжают работать), в окне их можно свободно перемещать мышью за ручку ⋮⋮. Закрытие окна (или кнопка «Вернуть») возвращает панели на прежние места",
  t3: "Перед переплетением ДОБАВЛЯТЬ ОДИН БИТ «0» СЛЕВА к ВЕРХНЕЙ строке пары — но только если разность длин двух строк ЧЁТНАЯ (в том числе нулевая, когда строки одной длины). При чётной разности обе строки сидят в ОДНОЙ подсетке колонок: их биты стоят строго друг под другом, и переплетения не получается — выходит обычная склейка столбец в столбец. Лишний бит слева переводит верхнюю строку в соседнюю подсетку, и биты идут через один, как и должно быть. При нечётной разности ничего не добавляется. Действует на всё переплетение пары: и на кнопку «⧬ Интерлив», и на одноимённый режим фон-поиска. Сами строки не меняются — бит живёт только внутри расчёта",
  t4: "Тетрис (каждый клик — один отдельный шаг): крутит выделенную строку круговым сдвигом (направление/инверсия — та же, что активна у ◄/►Круг/Круг Инв) до подходящего поворота; когда влезает — отдельным кликом роняет 1-биты строки сверху в её 0-пустоты; следующим кликом переводит выделение на строку ниже. Строки никогда не удаляются и не сдвигаются",
  t5: "Тетрис 2 (каждый клик — один отдельный шаг): 1-биты строки ПОД выделенной падают ВВЕРХ в неё. Двухуровневый поиск поворотом выделенной и (если не помогло) строки снизу — направление то же, что активно у ◄/►Круг/Круг Инв, но БЕЗ инверсии (обычный Круг, даже если сейчас активен Круг Инв); когда влезает — падение (строка снизу гасится в 0); следующим кликом переводит выделение на опустевшую строку. Строка снизу может быть длиннее выделенной, если её лишний хвост весь из нулей",
  t6: "Тетрис-Ось (каждый клик — один отдельный шаг): 1-биты ВЫДЕЛЕННОЙ строки (кроме её оси — первый символ строки при любом выравнивании, кроме «⊙ Ось», где ось — текущий индекс на общем столбце-оси) двигаются ВВЕРХ в 0-пустоты строки над ней. Если не влезает — крутится ТОЛЬКО выделенная (строка над ней неподвижна), направление/инверсия — как у ◄/►Круг/Круг Инв. Когда влезает — перенос (выделенная гасится в 0, ось остаётся «1»); следующим кликом переводит выделение на строку ниже опустевшей",
  t7: "Не перерисовывать таблицу во время прокрутки под «Авто»: строки обновляются только когда фон-поиск что-то нашёл (и ещё раз при остановке). Заметно быстрее, потому что перерисовка и запись кэша на каждом кадре и съедают основное время; промежуточные варианты на такой скорости всё равно не разглядеть",
  t8: "Горизонтальный XOR, цепочка повёрнута к цели НАЧАЛОМ (цепочка развёрнута). Заходит она, как и вторая кнопка, ВСЕГДА СПРАВА — отличие только в том, какой стороной она касается цели первой. Крутит строку по кругу до находки",
  t9: "Горизонтальный XOR, цепочка повёрнута к цели КОНЦОМ (как есть). Заходит справа по одному биту, ксорит и крутит строку по кругу до находки",
  t10: "После полного прохода без находки — крутить целевую строку по кругу и заходить заново (пока не найдётся или не переберётся весь круг). Выключено — как совсем раньше: один проход, без находки — стоп. Игнорируется, если включена «↕ Развернуть цепочку» (баунс её полностью заменяет)",
  t11: "При каждом повороте (см. «Крутить по кругу») ещё и переключать сторону входа — справа, потом слева, потом снова справа...",
  t12: "Баунс: когда сквозная (копия строки) проходит через всю цель без находки — вместо остановки или поворота строки (см. «Крутить по кругу», её при этом полностью заменяет) просто разворачивает НАПРАВЛЕНИЕ и заходит заново с той стороны, откуда только что вышла, обратным ходом — туда-сюда, пока не найдётся",
  t13: "Пока идёт поиск — РЕАЛЬНО менять биты САМОЙ СТРОКИ на каждом шаге на текущий промежуточный XOR (то же значение, что и в «Черновике шага» → Результат), а не только показывать — дальнейшие шаги ксорят уже с этими изменёнными битами. Если весь поиск в итоге провалится без находки — строка вернётся к исходному виду. Выключено — строка не меняется до самой находки (только подсветка в «Черновике шага»)",
  t14: "Для «⊙ Ось»: вкл — на оси только «1», «0» перепрыгивается; выкл — сдвиг на любой символ. Для «Ось 1.2»: вкл — зазор только между «1» и «0» (строки без такой пары заморожены); выкл — зазор между любыми соседними символами, заморозки нет. Для ВСЕХ остальных выравниваний: вкл — Круг/Круг Инв крутят строку, пока на её оси (первый бит, у «По правому краю»/«Лесенки правой» — последний) не встанет «1»; выкл — обычный одиночный поворот",
  t15: "Дойдя до края, Круг не перескакивает через границу дальше по кругу, а разворачивается и идёт обратно до упора, потом снова вперёд. В «ОсьБит»/«ОсьБит ½» край — это предел допустимых положений относительно строки выше; в остальных выравниваниях — край собственного кольца поворотов строки (когда первый символ дошёл до другого конца)",
  t15b: "Круг/Круг Инв крутят строку (реальный поворот битов) в нажатую сторону, пока на первом И на последнем месте не встанут «1». Такого положения нет нигде по кругу — вместо остановки строка своими же битами встаёт на край, а какой край (левый/правый) — чередуется при каждом таком нажатии, а не зависит от кнопки. ВМЕСТЕ с «🔗 Не рвать «1»-группы» первая фаза («1» сразу на обоих краях) отключается — она и есть разрыв группы по шву; работает только чередование краёв, причём противоположный край обязан быть «0»",
  t15c: "Круг/Круг Инв не останавливаются на положении, где одна непрерывная группа «1» разорвана швом строки (первый И последний символ ОДНОВРЕМЕННО «1») — крутят дальше, пока группа не соберётся заново внутри строки. Пример: «11110000» может стать «01111000», но не «10000111» (там четвёрка единиц распалась на «1» слева и «111» справа). Имеет приоритет над «⇔ Крайние «1»»: та при обеих галках только чередует края, но разорвать группу больше не может",
  t16: "Спираль вверх: строки (все, либо выделенный диапазон) читаются одной лентой и сдвигаются по кругу на 1 символ в сторону, заданную переключателем ◄/► справа",
  t17: "Спираль вниз: строки (все, либо выделенный диапазон) читаются одной лентой и сдвигаются по кругу на 1 символ в сторону, противоположную переключателю ◄/► справа",
  t18: "Проекция XOR ПО ОДНОЙ ВЕРХНЕЙ СТРОКЕ ЗА НАЖАТИЕ: первое нажатие складывает выделенную строку с БЛИЖАЙШЕЙ строкой сверху, второе — со следующей выше, и так вверх по цепочке. Результат каждый раз перезаписывает саму выделенную строку. Берутся только те верхние строки, у которых есть БИТ НАД БИТОМ выделенной — то есть реально пересекающиеся с ней по столбцам; стоящие сбоку пропускаются, как и строки чужой подсетки на «½»-выравниваниях (их биты стоят в промежуточных полустолбцах и друг над другом не встают). Складывается по настоящим столбцам: выравнивание, полустолбцы «½», показанные зеркала. Сменили выделение — подъём начинается заново. Откатывается «↩ Отменой»",
  t19: "Клик по номеру столбца — как было всегда: каждую строку, которая своими символами реально достаёт до этого столбца, циклически сдвигает так, чтобы на нём оказалась «1» (с минимумом единиц слева от неё). Строки без единиц и не достающие до столбца не трогаются. Повторный клик по выбранному столбцу снимает выделение",
  t20: "ОДНА КНОПКА НА ДВА СПОСОБА НАЗНАЧИТЬ ОСИ (см. также «✕ Снять столбец»). ВЫДЕЛЕН СТОЛБЕЦ (жёлтый) — осью становится он. ИНАЧЕ ВЫДЕЛЕНА СТРОКА — осями становятся ВСЕ её единицы разом, отдельной группой своего цвета: она действует от этой строки и ниже — до следующей строки с назначенными осями, а выделение переносится на строки под ней (до следующей выделенной или до низа); сама строка-источник из выделения выходит, чтобы Круг её не крутил. НЕ ВЫДЕЛЕНО НИЧЕГО — просто включается режим, в котором клик по номеру столбца НАЗНАЧАЕТ его осью для круговых сдвигов: ни картинка, ни строки при этом НЕ ДВИГАЮТСЯ. Дальше ◄/►Круг крутит каждую строку так, чтобы на ЭТОМ столбце у неё стояла «1»: выпал ноль — пропуск, идём дальше до ближайшей единицы. ОСЕЙ МОЖНО НАЗНАЧИТЬ НЕСКОЛЬКО — каждое нажатие добавляет столбец к набору, и тогда подходит только то положение строки, где «1» стоит на ВСЕХ осях сразу (галка «⊙ Хватит любой из осей» ниже смягчает это до «хотя бы на одной»); нет такого положения — строка остаётся на месте. Строка, которая ни до одной оси не достаёт, не двигается вовсе. Снимается назначение только кнопкой «✕ Снять столбец» — клик по номеру (в том числе тот, которым снимают обычное жёлтое выделение) синий столбец не трогает",
  t21: "Клик по номеру столбца — ОБРЕЗКА: у каждой строки отрезается часть со стороны, ПРОТИВОПОЛОЖНОЙ текущему выравниванию, по этот столбец включительно. Выравнивание влево (и лесенки от левого края) — режется справа, вправо — слева, у центра/оси прижатой стороны нет, поэтому режется половина, дальняя от кликнутого столбца. Остаток снова встаёт по выравниванию. Работает по выделенным строкам, а если ничего не выделено — по всем. Отменяется обычным Undo",
  t22: "Снять назначенную ось («⊙ Ось сюда») — ПО ОДНОЙ ЗА НАЖАТИЕ: убирается та, что сейчас выделена жёлтым, а если выделенная не из осей — последняя назначенная. Когда осей не осталось, круговые сдвиги ◄/► снова обычные. Жёлтое выделение столбца тут ни при чём — его снимает клик по номеру, а назначение остаётся и запоминается, пока не нажать сюда",
  t23: "Выделять столбцы КЛИКОМ ПО СИМВОЛУ в цепочке: пока режим включён, клик по любому биту выделяет его столбец — до выделенной строки включительно (без выделения строк — по всей цепочке, при нескольких выделенных — только между крайними). Данные при этом НЕ трогаются: это чистое выделение, строки никуда не едут. Повторный клик по тому же столбцу снимает выделение. Клики по строкам в этом режиме столбец и выбирают, а не переставляют выделение строк",
  t24: "Снять жёлтое выделение столбца. Синий назначенный столбец («⊙ Ось сюда») это не трогает — его снимает соседняя кнопка «✕ Снять столбец»",
  t25: "Когда назначено НЕСКОЛЬКО осей («⊙ Ось сюда»): по умолчанию Круг ◄/► принимает только то положение строки, где «1» стоит на ВСЕХ осях сразу — а с этой галкой хватает ЛЮБОЙ ОДНОЙ из них, строка встаёт на ближайшее такое положение. На одной-единственной оси разницы нет",
  t26: "Взять ВСЕ единицы выделенной строки и назначить их столбцы осями для Круга — разом, вместо того чтобы тыкать в каждый столбец. Это ОТДЕЛЬНАЯ ГРУППА своего цвета: она действует на строки ОТ ЭТОЙ СТРОКИ И НИЖЕ — до следующей строки, где так же назначены оси. Зоны групп не накладываются друг на друга, прежние группы остаются на своих местах. Заодно выделение переносится на строки НИЖЕ этой: до следующей выделенной строки, а если её нет — до самого низа цепочки. Сама строка-источник из выделения выходит, чтобы Круг её не крутил (её единицы и задают оси). Дальше ◄/►Круг ставит нижние строки на эти оси: по умолчанию нужны «1» на всех сразу, с галкой ниже — хватит любой",
  t26b: "На «½»-выравниваниях (Центр ½/Лесенка ½/Лесенка правая ½) строки едут на ПОЛСТОЛБЦА за строку, поэтому вертикальная ось попадает в биты только у половины строк — у второй бит стоит в полустолбце между (это состояние «выкл», прежнее поведение). Нажатия перебирают ТРИ состояния: 1-е — ось становится НАКЛОННОЙ ЛИНИЕЙ с шагом ½ столбца на строку по наклону самой лестницы, 2-е — та же линия в ДРУГУЮ сторону, 3-е — снова выкл. Диагональ идёт через реальные биты строк ЛЮБОЙ чётности, поэтому подсветка видна сплошной наклонной линией, а не прерывистой вертикалью. Линия проходит через строку-якорь: у «⊙ Оси по «1» строки» это сама строка-источник, у клика по столбцу — верхняя выделенная строка",
  t27: "Достроить ВВЕРХ зеркало из строк: берутся настоящие строки от первой до выделенной, их порядок переворачивается, и над первой строкой кладётся столько же строк — каждая ИНВЕРСИЯ (0↔1) своей строки. Для 1/11/111 сверху появятся 000/00/0 (инверсия единиц), а для 101 — 010. Цепочка съезжает вниз, настоящая первая строка остаётся номером 0, а достроенные получают отрицательные номера и участвуют во всех склейках и поиске наравне с остальными",
  t28: "Что делать, когда верх УЖЕ построен: «переписывать» — каждый раз строить всё отражение заново по текущему выделению, все построенные строки обновляются. «Дописывать» — уже построенные НЕ ТРОГАТЬ вовсе, даже если настоящие строки с тех пор изменились: сверху просто доводится число строк до числа настоящих строк по выделенную включительно — не хватает, дописываются недостающие, а если выделение уехало выше, лишние снимаются с самого верха",
  t29: "Чем заполняются достроенные сверху строки, перебор по кругу: «инверсия» — просто инверсия строки-источника (0↔1); «реверс+инв» — инверсия плюс разворот порядка бит; «реверс» — только разворот, биты как есть. Переключение сразу пересобирает верх (в режиме «переписывать»)",
  t30: "Показать СЛЕВА зеркало у строк ОТ ВЕРХА ДО ВЫДЕЛЕННОЙ включительно (без выделения зеркал нет): биты идут от первого бита строки влево, сам первый бит в зеркало не входит, значения инвертированы (0↔1) — если не сменить вид кнопкой «⇔ Зеркала». Печатается серым и только для вида — данные не меняются, в склейки и поиск эти биты не идут, на лестничное выравнивание не влияют. Если левого отступа не хватает, видна та часть зеркала, что влезла — сдвинь ось правее",
  t31: "Показать СПРАВА зеркало у строк ОТ ВЕРХА ДО ВЫДЕЛЕННОЙ включительно (без выделения зеркал нет): биты идут от последнего бита строки вправо, сам последний бит в зеркало не входит, значения инвертированы (0↔1) — если не сменить вид кнопкой «⇔ Зеркала». Печатается серым и только для вида — данные не меняются, в склейки и поиск эти биты не идут, на выравнивание не влияют. Если правого отступа не хватает, видна та часть зеркала, что влезла",
  t33: "Дать зеркалам место: полотно расширяется на самое длинное зеркало слева и справа, и ровно на столько же растёт левый отступ КАЖДОЙ строки. Прибавка одинаковая для всех, поэтому выравнивание не меняется — картинка просто целиком встаёт правее, а линейка столбцов едет вместе с ней. Без этого зеркала видны лишь настолько, насколько влезли в собственные отступы строк. Данные не меняются",
  t34: "Вписывать зеркала в строки автоматически — В САМ МОМЕНТ, когда захват находки добавляет к выделению новую строку: зеркало ей строится сразу, до достройки вверх и прочего. Работает на всех путях захвата одинаково — в прогоне «Авто», на ручном ◄/►/Круге и в Паттерн-цепочке. Нажатия перебирают: выкл → влево → вправо → обе стороны. Сторона задаётся ЗДЕСЬ и от серого показа «◀/▶ Зеркало» не зависит — поэтому зеркало на зеркале не появляется",
  t35: "Сколько раз можно вписать зеркала В ОДНУ СТРОКУ — предел считается по каждой строке отдельно и общий для автоматики и для ручной кнопки «⇔ Вписать зеркала в строки». Каждое вписывание удлиняет строку почти втрое, поэтому по умолчанию 1: зеркало на зеркале не строится, но КАЖДАЯ новая захваченная строка своё зеркало получает. Счёт обнуляется «↺ Сбросом», сменой этого числа и переключением кнопки авто-зеркал",
  t36: "Достраивать вверх САМО, как только строка выделена мышью: выделил — верх сразу построился под неё. Переключил выделение на другую строку — верх приводится к ней заново (лишние зеркала снимаются, недостающие дописываются). Выделение при этом остаётся на той строке, по которой щёлкнули, вниз не уезжает",
  t37: "Условие для РУЧНОГО нажатия «⬆ Достроить вверх»: «только при находке» — кнопка сработает лишь тогда, когда фон-поиск прямо сейчас нашёл искомый паттерн, а без находки просто скажет «стоп» и ничего не построит. «Всегда» — обычное поведение, строит по нажатию в любом случае. На автодостройку по находке эта настройка не влияет",
  t38: "Достраивать вверх САМО на каждой находке — то же самое, что нажать «⬆ Достроить вверх», в текущем режиме (переписывать/дописывать). Работает везде, где находка вообще случается: прогон «🚀 Авто», ручной круговой сдвиг ◄/►, шаг и прогон «🧩 Паттерн-цепочки»",
  t39: "Убрать ВСЕ достроенные сверху строки — цепочка снова начинается со своей настоящей первой строки, нумерация возвращается к обычной",
  t40: "Выключить СРАЗУ ВСЁ в этой панели — «🖱 По выделению», «✋ Вручную: только при находке», «🎯 При находке», «◀ Зеркало влево», «▶ Зеркало вправо» — и заодно убрать все достроенные сверху строки. Одно нажатие возвращает цепочку к обычному виду",
  t41: "Выделить ВСЕ строки цепочки разом. Если все строки уже выделены — клик снимает выделение. Сами биты не меняются, работает только выделение",
  t42: "Заливка одним значением: первое нажатие ставит ВСЕ биты в 0, следующее — ВСЕ в 1, дальше снова 0, и так по кругу. Работает по выделенным строкам, а если ничего не выделено — по всем. Длины строк не меняются",
  t43: "Режим выбора ЯЧЕЕК: клик по биту — выбрать одну, протяжка мышью — прямоугольник, Ctrl+клик — добавить/снять по одной, клик по пустому месту — снять всё. Пока режим включён, клик по строке её не выделяет. Кнопки ниже работают ровно по выбранным ячейкам",
  t44: "Повернуть выбранный прямоугольник на 90° ПО ЧАСОВОЙ прямо на месте: биты внутри рамки выделения переставляются, за её пределы ничего не выходит. Считается по габаритной рамке выделения; ячейки, для которых в строке нет бита, пропускаются",
  t45: "Сдвинуть биты выбранных ячеек ВЛЕВО по кругу — внутри каждой строки выделения отдельно, только по выбранным позициям",
  t46: "Сдвинуть биты выбранных ячеек ВПРАВО по кругу — внутри каждой строки выделения отдельно, только по выбранным позициям",
  t47: "Повернуть блок строк на 90° ПО ЧАСОВОЙ: строки кладутся на сетку по ТЕКУЩЕМУ выравниванию, столбцы становятся строками (столбец читается снизу вверх) — вертикальная ось симметрии (у треугольника — его высота) ложится горизонтально, вершина смотрит ВПРАВО. Работает по выделенным строкам (берётся весь диапазон от верхней до нижней), а если ничего не выделено — по всей цепочке. Число строк меняется на число столбцов; пустые места внутри повёрнутой строки становятся нулями, по краям просто обрезаются",
  t48: "То же самое, но ПРОТИВ ЧАСОВОЙ: столбцы берутся справа налево и читаются сверху вниз — вершина треугольника смотрит ВЛЕВО, а ось ложится в другую сторону",
  t49: "Достроить фигуру до КВАДРАТА зеркалом по главной диагонали ВВЕРХ: в каждую пустую клетку кладётся значение зеркальной ей клетки, то есть у треугольника (лесенки 1/11/111...) верхняя половина достраивается из нижней. Клетка, пустая и у себя, и у зеркала, заполняется нулём — дыр в квадрате не остаётся. Сторона квадрата = max(строк, столбцов), чтобы вся фигура влезла целиком. Сетка берётся по ТЕКУЩЕМУ выравниванию, как и у поворотов. Работает по выделенным строкам, а если ничего не выделено — по всей цепочке. Паттерны не тронуты. ПОВТОРНОЕ нажатие достраивать уже нечего — оно ИНВЕРТИРУЕТ ровно ту часть, которую достроило предыдущее (исходная фигура не трогается), следующее возвращает как было, и так по кругу",
  t50: "Расширять выделение ВНИЗ при каждой находке: как только фон-поиск нашёл паттерн, строка ПОД выделением (та самая, чей паттерн искали) добавляется к выделению, а верхняя граница остаётся на месте — выделенный блок просто растёт вниз, строка за строкой. Отличие от «🧲 Захват находки»: тот при выделении, набранном руками, ведёт окно ПОСТОЯННОГО размера (добавляет снизу и снимает верхнюю), а тут ничего не снимается никогда. Работает и в прогоне «▶ Авто» (новая строка сразу начинает крутиться вместе с остальными), и на ручных ◄/►Круг, и в «🧩 Паттерн-цепочке» — там выделение не переезжает на находку, а дорастает до неё. Включённый режим сильнее «🧲 Захвата»: если включены оба, выделение растёт, а не едет окном",
  t51: "Удалить ЦЕНТРАЛЬНЫЙ символ строки — из выделенных строк (или всех, если ничего не выделено). У нечётной длины это ровно средний бит; у чётной середины как таковой нет, поэтому удаляется ЛЕВЫЙ из двух средних (так же, как «По центру» кладёт лишний пробел справа). Строка смыкается и становится короче на 1, встаёт по текущему выравниванию. Отменяется обычным Undo",
  t52: "Показывать в строках только КАЖДЫЙ ВТОРОЙ бит — остальные заменяются точками «.» и НЕ участвуют ни в чём: ни в склейках, ни в XOR, ни в интерливе, ни в поиске, ни в сквозной (точка — это не ноль, а «бита тут нет», как пустая клетка чужой полусетки). Нажатия перебирают: все → чёт → нечёт → чёт по сквозной → нечёт по сквозной → снова все. «Чёт/нечёт» считаются В КАЖДОЙ СТРОКЕ заново, от её первого бита; «по сквозной» — единой нумерацией с самого первого бита ПЕРВОЙ строки, поэтому в строке чётность зависит от суммы длин всех строк выше. Сами данные не меняются — точки живут только в показе и расчётах, любое нажатие считается от исходных строк",
  t53: "Паттерны → в цепочку: СНАЧАЛА удаляет все строки цепочки, потом вставляет вместо них ВСЕ паттерны — строка №N становится текстом паттерна №N, порядок и нумерация те же, что в колонке паттернов. Сами паттерны остаются на своих местах (отметки «найден» при этом снимаются — цепочка новая). Пустые паттерны дают пустые строки, хвост пустых отбрасывается. Достроенные сверху строки убираются. Отменяется обычным Undo; «↺ Сброс» по-прежнему возвращает к шаблону",
  t54: "Добавить бит справа: первый клик добавляет 1; повторный клик подряд по тем же строкам (пока ничего больше не менялось) не добавляет новый бит, а переключает только что добавленный между 1 и 0",
  t55: "Вставляет между каждым символом строки его инверсию (11→1010) — в выделенных строках, или во всех, если ничего не выделено. Вставленные символы подсвечиваются красным",
  t56: "Маска: накладывает паттерн строки на саму строку — XOR, строка на строку, столбец в столбец по ТЕКУЩЕМУ выравниванию цепочек. Одинаковые длины → 111 на 111 даёт 000. Работает по выделенным строкам, а если ничего не выделено — по всем. Биты, которые реально изменились, красятся красным и остаются красными, пока не изменится любой бит в любой строке",
  t57: "Красная подсветка бит, изменённых Маской: нажатие — убрать цвет, следующее — вернуть, и так по кругу. Сами биты не меняются, только их окраска",
  t58: "Конверт по диагонали: из ПЕРВОГО (левого) символа выделенной строки диагональ идёт вправо-вверх (столбец на строку). Всё, что над диагональю, складывается через неё, как конверт, и ХОРится с тем, что под ней; верхние ячейки после сгиба гасятся в 0. Сами биты на диагонали ХОРить не с чем — они становятся «1». Выделено несколько строк — участок от самой верхней выделенной, одна — от 1-й строки таблицы. Считается по ТЕКУЩЕМУ выравниванию, столбец в столбец с экраном",
  t59: "Паттерн-цепочка. Работает ТОЛЬКО когда выделена РОВНО ОДНА строка — иначе стоп. Паттерн кладётся на ВСЕ БИТЫ таблицы — во все строки, включая все нижние (если не обрезать участок галками «⛔» ниже: «Ниже выделенной — выкл» или «Всё кроме 1-й ниже — выкл» — они обрезают и укладку, и сборку результата фон-поиска одинаково). Выделение — не набор рабочих строк, а указатель для фон-поиска: строка СРАЗУ ПОД выделенной — та, чей паттерн ищется. 1-е нажатие: во все строки кладётся ПЕРВЫЙ паттерн, повторённый по кругу до длины строки — напр. 100 → 100100100... 2-е нажатие: то же со ВТОРЫМ паттерном, но не заменой, а XOR с тем, что уже лежит. 3-е — третьим, и так далее вниз по списку паттернов. Ниже выделенной ярко светится только первая строка (искомая) — все остальные идут тусклым, хотя тоже заполняются; при переезде выделения новая искомая строка загорается сразу. Фон-поиск при работающей цепочке собирает результат ПО ВСЕМ строкам таблицы, а найденный паттерн подсвечивается во всех строках, где он лежит, — выделение переезжает на находку только следующим нажатием, чтобы подсветку было видно. Всё это возвращается «↺ Сбросом». Сам фон-поиск как обычно сверяется с паттерном этой строки. Берутся только паттерны строк ДО ВЫДЕЛЕННОЙ включительно — то, что ниже, не укладывается (там лежит искомый паттерн). Паттерны идут по кругу: список кончился — снова с первого (заменой кладётся только самый первый за сессию, дальше всегда XOR). Номер следующего паттерна виден в заголовке окна «Результат». С включённой галкой «🧲 Захват находки» выделение ПЕРЕЕЗЖАЕТ на найденную строку (не растёт — выделённой всегда остаётся ровно одна строка), причём ОТДЕЛЬНЫМ полушагом: нажатие, на котором нашёлся паттерн, только подсвечивает находку; следующее нажатие ТОЛЬКО переставляет выделение (и заодно обнуляет новую строку под ним — её прежние биты в цепочку и в поиск не идут); и лишь третье кладёт очередной паттерн. Счётчик уложенных паттернов сбрасывается кнопкой «↺ Сброс». В заголовке «Результата» рядом с номером следующего паттерна виден и ПОЛНЫЙ КРУГ («круг 7/12»): паттерны идут по кольцу и накладываются XOR-ом, поэтому два прохода по списку возвращают биты к состоянию после первой укладки — дальше точный повтор, и «▶ Авто» на этом останавливается сам",
  t60: "Авто для Паттерн-цепочки: кладёт паттерны подряд, кадр за кадром, сам. Останавливается при находке (если включено «🛑 Стоп на находке»), когда укладывать нечего, или повторным кликом по этой же кнопке. К общей кнопке «Авто» отношения не имеет — у той свои режимы, но галку «⏩ Турбо» уважает: с ней промежуточные кадры не рисуются и за один кадр укладывается целая пачка паттернов, а таблица обновляется только на находке и при остановке",
  t61: "Все строки НИЖЕ выделенной вообще не участвуют: паттерн в них не кладётся, и в результат фон-поиска они не входят. Работает и укладка, и сборка результата только по строкам ДО выделенной включительно. Сам искомый паттерн (строки под выделенной) при этом ищется как обычно",
  t62: "Участвуют строки до выделенной ВКЛЮЧИТЕЛЬНО плюс ПЕРВАЯ под ней (та, чей паттерн ищется) — а весь хвост ниже отключён: паттерн туда не кладётся и в результат он не идёт. Эта первая строка под выделением, впервые попав в участок (после переезда выделения), сначала ОБНУЛЯЕТСЯ — её прежние биты в цепочку и в поиск не идут, дальше в неё кладётся паттерн как обычно",
  t63: "Что укладывает «🧩 Паттерн-цепочка»: по умолчанию ТЕКСТЫ ПАТТЕРНОВ из колонки, по кругу сверху вниз. С этой кнопкой вместо них по тому же кругу и по тем же номерам укладываются БИТЫ САМИХ СТРОК — строка 1, строка 2 и так далее до выделенной включительно, пустые пропускаются. Всё прочее — способ укладки (лента/змейка), «⛔» отсечки, XOR-наложение, счёт кругов — работает ровно так же",
  t64: "Сквозная лента СЛЕВА НАПРАВО: паттерн тянется через все строки подряд — следующая строка продолжает с того места, где кончилась предыдущая. Напр. паттерн 100 и строки по 4 бита: 1001, 0010, 0100...",
  t65: "Сквозная лента СПРАВА НАЛЕВО: то же самое, но лента входит в каждую строку с правого края и идёт влево, а в следующую строку переходит с её правого края",
  t66: "Змейка лево-право: ПЕРВАЯ строка участка укладывается слева направо, следующая — справа налево, и так через одну; лента непрерывна (конец строки стыкуется с началом следующей)",
  t67: "Разделитель-граница снизу выделенной строки (Numpad0) — «1 по диагонали» считается отдельно по каждой секции между разделителями, как будто других строк нет",
  t68: "Интерлив со сквозной: текущая строка (без изменений) интерливится с КАЖДЫМ круговым поворотом сквозной (всех строк выше и самой выделенной) — ищем совпадение в паттерне следующей строки. Не нашлось ни на одном сдвиге — пробуем БОЛЬШИЙ блок интерлива (сначала обычный побитовый, потом по 2 символа, по 3 и т.д.), строка при этом не меняется. Найдено — сразу идём дальше (сквозная теперь включает и её)",
  t69: "XOR со сквозной: текущая строка (без изменений) XOR'ится с КАЖДЫМ круговым поворотом сквозной (всех строк выше и самой выделенной) — ищем совпадение в паттерне следующей строки. Не нашлось ни на одном сдвиге — пробуем строку над ней, с той же сквозной. Найдено — сразу идём дальше (сквозная теперь включает и её), строка не меняется",
  t70: "Правая (неподвижная) часть — тоже сама сквозная (не конкретная строка): сквозная 'въезжает' сама в себя навстречу, голова к голове, один символ за шаг (одна копия стоит, другая крутится по кольцу). Действует на ОБА режима выше — Интерлив сквозной и XOR сквозной",
  t71: "Порядок строк обычный (строка 0 первая), но КАЖДАЯ ВТОРАЯ строка читается в обратном порядке БИТ внутри себя — змейкой/бустрофедоном",
  t72: "ПОСЛЕДНИЙ символ паттерна не проверяется (ищется его начало без хвостового бита). Работает вместе с «⏭ Без 1-го»: включены обе — от паттерна отрезаются оба края. Паттерн короче двух символов не режется вовсе",
  t73: "Кольцевой поиск в результирующей строке (Интерлив/XOR/Сквозная): при переходе на новый виток кольца биты инвертируются (0↔1) — 111 даёт кольцо 111 000 111 000... вместо 111 111 111..., и паттерн ищется уже в нём",
  t74: "То же самое кольцо, но следующий виток ЕЩЁ И реверсируется (порядок бит наоборот) — если включена ЕЩЁ и обычная 🔁 Инв. кольцо, следующий виток получается инвертирован И реверснут одновременно",
  t75: "ОТКЛЮЧИТЬ кольцо совсем: паттерн ищется только ВНУТРИ строки результата, без замыкания её саму на себя — находка, «переезжающая» через конец строки обратно в начало, больше не засчитывается. Обе 🔁-галки при этом не действуют (второго витка попросту нет), и в окне «Результат» продолжение кольца не рисуется",
  t76: "Пустые места (столбец засчитан — в нём есть символ хотя бы у одной строки, но КОНКРЕТНАЯ строка до него не достаёт) заполнять нулями вместо того, чтобы просто пропускать. Влияет на вертикальную склейку — режимы фон-поиска «Верт. →»/«Верт. ←», а также на вертикальную сквозную (↕ Верт.). Полностью пустые столбцы (дырки между разъехавшимися строками) пропускаются в любом случае, нулями не заполняются. Влияет и на «🧩 Паттерн-цепочку»: перед укладкой строки участка добиваются нулями до общей ширины по текущему выравниванию, и паттерн ложится в бывшие пустоты наравне со всеми битами",
  t77: "Вписывать эти нули ПРЯМО В СТРОКИ, а не подставлять их на лету. Как только галка включена, каждая строка добивается настоящими нулями до общей занятой ширины картинки — слева и справа, — и дальше они живут как обычные биты: крутятся ◄/►Кругом, идут в XOR, склейки, поиск, подсветки. Пока галка стоит, добивка повторяется перед каждым круговым сдвигом, поэтому новые пустоты тоже становятся нулями. Работает только вместе с «0 вместо пустот» — та задаёт саму сетку. ЭТО МЕНЯЕТ ДАННЫЕ: строки становятся длиннее, откатывается обычным Undo",
  t78: "Дописывать в конец КАЖДОГО результата фон-поиска столько нулей, какова длина ИСКОМОЙ строки — той, что стоит сразу под выделением и чей паттерн ищется. Как будто эта строка тоже участвовала в склейке, но целиком из нулей: «000…0» по её настоящей длине. Сами строки при этом не меняются — хвост живёт только в результате, зато паттерн, уходящий за конец, теперь есть чему покрыть",
  t79: "При круговом сдвиге (◄/►Круг/Круг Инв, вручную и под «Авто») — если фон-поиск нашёл совпадение, найденная строка попадает в выделение и крутится дальше вместе с остальными. Выделена ОДНА строка — выделение РАСТЁТ, и дальше тоже: вторая, третья, четвёртая находка просто добавляются снизу, с верхней строки выделение не снимается. Выделено НЕСКОЛЬКО ВРУЧНУЮ (Ctrl/Shift-кликом) — выделение едет ОКНОМ постоянного размера: найденная добавляется снизу, самая верхняя выбрасывается, число выделенных строк не меняется. Выключено — выделение не меняется само по себе",
  t80: "Остановить круговой сдвиг (◄/►Круг/Круг Инв) под «Авто», если суммарное число единиц и нулей по всем выделенным строкам стало РОВНО (баланс) — см. «⚖ Показать балансы»",
  t81: "Когда некуда двигаться (нет находок) — не переходить на 1-ю строку, а циклически сдвигать нижнюю строку и повторять операцию",
  t82: "КЛИК — включить/выключить фоновый поиск целиком. Выбранный набор режимов при этом сохраняется (в отличие от кнопки «Всё / Выкл», которая именно снимает/ставит галки режимов). Сам поиск: при любом изменении строк проверяет, найден ли паттерн строки НИЖЕ выделенной в выбранном результате; выделенная строка фиксирована и сама не двигается",
  t83: "Тоггл: выделить ВСЕ режимы ниже (включая 🧮 Суммы длин) / снять все. Это только про галки режимов — сам фон-поиск включается кликом по заголовку «🔍 Фон-поиск»",
  t84: "XOR РОВНО двух строк: выделенной и той, что прямо над ней. Складывается по столбцам с учётом реального сдвига строк — при полусимвольном смещении соседних строк это даёт переплетение бит (интерлив), при совпадении столбец-в-столбец — обычный XOR",
  t85: "XOR-Все: строки над выделенной и сама выделенная — на обычных выравниваниях просто все разом, на ½-выравниваниях делятся на 2 группы по чётности (см. hasHalfNudge) и результаты чередуются",
  t86: "Сквозная строка: все строки от 1-й до выделенной (включительно) просто склеены по порядку — новая строка приклеивается СПРАВА",
  t87: "Сквозная строка: все строки от 1-й до выделенной (включительно) просто склеены, но новая строка (сверху вниз) приклеивается СЛЕВА — итог идёт от выделенной к 1-й",
  t88: "Сквозная змейка, начиная СЛЕВА: все строки от 1-й до выделенной склеены по порядку, но у КАЖДОЙ ВТОРОЙ строки биты реверснуты — первая строка читается слева направо, вторая справа налево, третья снова слева. Зеркальная пара — «🔗 Сквозная 🐍 →», она начинает с правого края",
  t89: "Сквозная змейка, начиная СПРАВА: первая строка читается справа налево, вторая — слева направо, третья снова справа, и так далее. Зеркальная пара к «🔗 Сквозная 🐍 ←», где первая строка читается слева",
  t90: "Вертикальная склейка: строки от 1-й до выделенной читаются по СТОЛБЦАМ (сверху вниз в каждом столбце), столбцы слева направо. Столбец идёт в счёт, если символ есть хотя бы у одной строки; пустое место внутри такого столбца пропускается, а с галкой «0️⃣ 0 вместо пустот» (панель настроек) — заполняется нулём",
  t91: "Вертикальная склейка: строки от 1-й до выделенной читаются по СТОЛБЦАМ (сверху вниз в каждом столбце), столбцы справа налево. Столбец идёт в счёт, если символ есть хотя бы у одной строки; пустое место внутри такого столбца пропускается, а с галкой «0️⃣ 0 вместо пустот» (панель настроек) — заполняется нулём",
  t92: "Змейка: как вертикальная склейка, но направление чтения строк внутри столбца чередуется (то сверху вниз, то снизу вверх), столбцы слева направо",
  t93: "Змейка: как вертикальная склейка, но направление чтения строк внутри столбца чередуется (то сверху вниз, то снизу вверх), столбцы справа налево",
  t94: "Верт. зигзаг: столбцы берутся попеременно с двух краёв навстречу друг другу — самый левый, самый правый, следующий слева, следующий справа... до встречи в середине. Начинает с ЛЕВОГО края",
  t95: "Диагонали ↘: строки от 1-й до выделенной читаются по ДИАГОНАЛЯМ вниз-вправо (полстолбца вбок на каждую строку — та же диагональ, что подсвечивает «1⤡1»). Дойдя до НИЖНЕЙ границы участка, диагональ ОТСКАКИВАЕТ и идёт обратно вверх, продолжая уходить вбок в ту же сторону; от ВЕРХНЕЙ границы отражается так же — получается зигзаг поперёк участка, пока он не уйдёт вбок за край. Участок — от 1-й строки до выделенной, а при выделении НЕСКОЛЬКИХ строк ровно они (верхняя выделенная и есть верхняя граница). Каждая диагональ при этом начинается с ПЕРВОГО символа нижней строки участка (подъём по диагонали до своего начала) и заканчивается ПОСЛЕДНИМ символом нижней строки (спуск от края по крайней диагонали) — у всех строк результата общие первый и последний биты, различается середина. Сами диагонали перебираются слева направо. Пустое место внутри диагонали пропускается, а с галкой «0️⃣ 0 вместо пустот» — заполняется нулём. На ½-выравниваниях ход диагональный (полстолбца за строку). На выравниваниях 1:1 (⇤/↔/⇥ и прочие не-½) ход ОРТОГОНАЛЬНЫЙ, только по строкам и вертикалям, и рисует букву из трёх плеч. ↙ — «П_», по одной линии на СТОЛБЕЦ: снизу вверх по своему столбцу, поперёк ВЕРХНЕЙ строки влево (влево ход уходит только тут), вниз по левому краю до низа участка и хвостом по нижней (выделенной) строке вправо до её последнего символа — хвост начинается правее верхнего плеча, чтобы под верхней горизонталью не было нижней. ↘ — перевёрнутая «П» («∪»), по одной линии на СТРОКУ: от ПОСЛЕДНЕГО символа своей строки вниз до низа участка, дальше по НИЖНЕЙ строке влево до её начала и вверх по левому краю. Поэтому горизонтальные биты у ↘ всегда на нижней строке. На ЛЕСЕНКАХ осмыслен только один наклон: у «Лесенка»/«Лесенка ½» ↘, у «Лесенка правая»/«Лесенка правая ½» ↙ — зеркальная кнопка там гаснет",
  t96: "Диагонали ↙: зеркало предыдущего — диагонали идут вниз-влево (с теми же отскоками от обеих границ), перебираются справа налево. Работает на ЛЮБОМ выравнивании. На лесенках, наклонённых вниз-вправо («Лесенка», «Лесенка ½»), кнопка гаснет: там зеркальный ход шёл бы поперёк ступенек, осмыслен только ↘",
  t97: "Из каких комбинаций строк (включая саму выделенную) можно собрать длину искомой строки ниже (напр. длина искомой = 6 → строки 1+6, 2+5, 3+4, 1+2+4...), сверяя с её паттерном кольцевым поиском — каждая строка-источник в комбинации подсвечена своим цветом. Показывается в отдельной вкладке «Лог находок»",
  t98: "Например паттерн 1110, «Без 1-го» даёт 110 — с этой галкой ищем не только 110, но и ВСЕ варианты его циклического сдвига (101, 011). Найдено, если совпал хотя бы один. Полный список подпаттернов и какие из них нашлись — см. «🧾 Черновик последнего шага»",
  t99: "По умолчанию результат сверяется только с паттерном строки СРАЗУ НИЖЕ выделенной. С этой галкой — со всеми паттернами от неё и до конца списка, находка засчитывается по первой совпавшей строке. Каждая совпавшая строка помечается ЗЕЛЁНЫМ (текущая находка остаётся жёлтой) и метка НЕ гаснет сама: копится дальше и снимается только Сбросом или Escape",
  t100: "Искать в каждом результате СРАЗУ ВСЕ паттерны списка, а не один искомый. Перебор идёт с САМОЙ ВЕРХНЕЙ строки вниз; как только паттерн нашёлся — он засчитан и дальше не ищется (одна находка на паттерн, самая ранняя позиция). Каждый найденный паттерн подсвечивается СВОИМ цветом — и в строках результата, и в колонке паттернов, чтобы было видно, что где нашлось. Это ТОЛЬКО подсветка: на сообщение «паттерн строки N найден», лог находок, «🧲 Захват находки» и «🛑 Стоп на находке» эти находки не влияют — там по-прежнему считается только ИСКОМЫЙ паттерн строки под выделенной",
  t101: "Работает вместе с «🌈 Все паттерны». Без неё каждый паттерн засчитывается ОДИН раз — по самой ранней позиции, и дальше не ищется. С ней подсвечиваются ВСЕ вхождения паттерна по всем строкам, сколько бы раз он ни встретился. Вариант (сам паттерн / инверсия / реверс) при этом выбирается как обычно, приоритет у основного, — и уже все вхождения ИМЕННО ЭТОГО варианта и показываются",
  t102: "Поиск (все виды — интерлив/XOR/сквозная/конкат/вертикальный/змейкой и т.п.) считает «1» ТОЛЬКО там, где сейчас реально подсвечено цветом (01 / 1↕1 / 1⤡1), остальные позиции — «0», независимо от исходного бита. Работает только вместе с включённой хотя бы одной из этих подсветок — иначе везде «0»",
  t103: "Работает вместе с «🌈 Все паттерны». Если паттерн целиком в результате НЕ нашёлся — подсвечивается САМЫЙ ДЛИННЫЙ его непрерывный кусок, который там есть (не короче 2 бит), то есть видно, насколько близко подошло. Длины перебираются сверху вниз, на каждой длине сначала сам паттерн, потом инверсия/реверс (тот же приоритет вариантов, что и у обычной находки), внутри варианта куски слева направо. Если паттерн нашёлся целиком — эта галка ничего не меняет",
  t104: "Удалить из строк цепочек ВСЕ биты, подсвеченные сейчас как найденные паттерны — ровно то, что видно на экране: выделены паттерны в колонке, значит только они, не выделено ничего — весь список «🌈 Все паттерны». Оставшиеся биты строки смыкаются, строка становится короче и встаёт по ТЕКУЩЕМУ выравниванию. Работает по выделенным строкам, а если ничего не выделено — по всем, где есть находки. Отменяется обычным Undo",
  t105: "Каждый паттерн ищется ТОЛЬКО В СТРОКАХ ВЫШЕ САМОГО СЕБЯ: паттерн 5-й строки — по строкам 1–4, паттерн 2-й — только по 1-й, у паттерна самой верхней строки искать негде вовсе. Граница у каждого паттерна СВОЯ (его собственная строка) и от выделения не зависит. Вхождение засчитывается целиком: задело свою строку или что-то ниже — не идёт ни в подсветку, ни в метку колонки паттернов Это же правило действует и на находки РЕЖИМАМИ фон-поиска (Сквозные, XOR, Интерлив): их результат склеен из строк цепочки, и паттерн строки, попавшей в склейку, находил бы там сам себя — такие находки отбрасываются. С «вся цепочка» не отбрасывается ничто.",
  t106: "Любой непрерывный кусок паттерна — как было всегда: берётся самый длинный, который вообще есть в результате, откуда бы он ни начинался",
  t107: "Только кусок ОТ НАЧАЛА паттерна: подходят 1-й бит, первые два, первые три и т.д. — самый длинный из тех, что нашлись. Хвостовые куски не рассматриваются вовсе",
  t108: "Только кусок С КОНЦА паттерна: подходят последний бит, два последних, три последних и т.д. — самый длинный из тех, что нашлись. Куски от начала не рассматриваются вовсе",
  t109: "Особая подсветка: красит весь пробег нулей перед единицей целиком (плюс саму единицу) по всем строкам — напр. «0001» целиком, а не только «01»",
  t110: "Особая подсветка: красит «1», если в соседней строке (сверху или снизу) в той же колонке тоже «1» — с учётом текущего выравнивания",
  t111: "Особая подсветка: красит «1», если в соседней строке по диагонали (колонкой левее или правее) тоже «1» — с учётом текущего выравнивания, в любом режиме",
  t112: "Особая подсветка: красит САМИ ЛИНИИ ЗИГЗАГА, по которым режимы фон-поиска «⧅ Зигзаг ↘ →»/«⧄ Зигзаг ↙ ←» собирают результат — вместе с отскоками (линия идёт вниз, отражается от нижней границы, потом от верхней, и так зигзагом, пока не уйдёт вбок за край), все биты на линии, и «1», и «0»; соседние диагонали чередуются яркостью, чтобы было видно, где одна кончается и начинается следующая. Берутся ровно те диагонали, которые реально идут в результат (с обрывом на дырке), от 1-й строки до самой нижней выделенной. Какие наклоны рисовать — берётся из включённых режимов «Диаг.» (если не включён ни один — рисуются оба). Работает на любом выравнивании; на лесенках рисуется только осмысленный там наклон",
  t113: "Перебрать ВСЕ варианты «Суммы длин» для текущей выделенной строки прямо сейчас (даже если строки не менялись — обычный автопоиск пишет в лог только при ИЗМЕНЕНИИ находки) и записать в лог ВСЕ найденные, не только первый",
  t114: "Показать итоговый баланс строки: «N-M» — сумма всех единиц минус сумма всех нулей, «1» белым, «0» серым. Если единиц и нулей поровну — подсвечивается отдельно",
  t115: "Заменить сами биты 0/1 их пробегами со знаком, напр. «111001» -> «+3-2+1» (то же выравнивание, что у обычных битов). Посимвольные подсветки в этом режиме не действуют",
  t116: "Скопировать строки цепочки в буфер обмена — каждая своей строкой, с ведущими пробелами по текущему выравниванию (как они стоят в таблице). Выделены строки — копируются только они, ничего не выделено — вся цепочка. То же самое делает Ctrl+C по выделенным строкам",
  t117: "Свои цвета: последние вручную выбранные (col1/col0/colBg) — как только меняешь цвет вручную при любом активном пресете, сам пресет не трогается, а изменение уходит сюда и сохраняется в кэше. Пока своих цветов ещё не было — по умолчанию как Ч/Б",
  t118: "Красная подсветка изменённых бит: и «изменён последним шагом» (по стеку отката), и та, что оставляет «🎭 Маска». Нажатие — выключить совсем, повторное — вернуть. Состояние сохраняется в настройках вида",
  t119: "Подгоняет межсимвольный интервал (ls) так, чтобы ячейка символа стала квадратной (ширина = высоте строки --row-h) при текущих размере шрифта/межстрочном интервале. Любая 'лестница' (например 1,11,111...) в таблице строк получит ровно 45° диагональ и 90° угол. Содержимое строк не меняется — только геометрия символа",
  t120: "Круговой сдвиг (◄/►Круг/Круг Инв) под «Авто»: текущий вариант из общего числа (НОК длин выделенных строк, ×2 у Круг Инв) и номера строк, которые сейчас крутятся",
  t121: "⚖ Суммарный баланс единиц/нулей по ВСЕМ выделенным строкам вместе (виден, пока включено «⚖ Показать балансы») — подсвечивается акцентным, если единиц и нулей поровну",
  t122: "Закрепить высоту панели на текущем размере — дальше не растёт/не сжимается сама при смене содержимого (списка режимов/находок), просто скроллится внутри",
  t123: "Открыть результат в ОТДЕЛЬНОМ окне: там строки не обрезаются ни по ширине (переносятся), ни по длине — видно каждое вхождение паттерна целиком. Окно живое: обновляется вместе с панелью на каждом шаге",
  t124: "По центру, но с точностью до половины символа — короткая строка встаёт СТРОГО между символами длинной (напр. «1» строго между двумя «1» у «11»), а не вплотную к одной из них",
  t125: "Лесенка: каждая следующая строка сдвинута вправо на 1 колонку ОТНОСИТЕЛЬНО ПРЕДЫДУЩЕЙ — ровная диагональ вниз независимо от длин строк (две строки одинаковой длины тоже смещены друг от друга)",
  t126: "Лесенка ½: та же лестница по номерам строк, но вдвое положе — сдвиг на половину символа за строку, а не на целый",
  t127: "Лесенка правая: зеркало обычной Лесенки — строка читается как обычно, слева направо (НЕ реверсируется), но диагональ/ось — по ПОСЛЕДНЕМУ биту строки, а не по первому",
  t128: "Лесенка правая ½: та же правая лестница (диагональ по ПОСЛЕДНЕМУ биту строки), но вдвое положе — правый край смещается на полсимвола за шаг, а не на целый (так же, как «Лесенка ½» относится к обычной «Лесенке»)",
  t129: "Ось: столбец посередине видимой области. Изначально строка начинается с оси (как «По левому краю», но от центра). Круговой сдвиг ◄/►Круг(Инв) двигает ТОЛЬКО картинку — строка целиком уезжает влево/вправо от оси (не переставляя свои символы), не меняя реальные данные строки; куда именно останавливается сдвиг — см. галку «⊙ Ось: сдвиг только на «1»/между «1-0»» в «Правке строк». Поиск/XOR/Тетрис по-прежнему видят исходную строку, как будто её не двигали",
  t130: "Ось 1/2: та же ось, но она — ЗАЗОР между двумя соседними символами (полсимвол), не сам бит; при включённой галке «⊙ Ось: сдвиг только на «1»/между «1-0»» — только в зазоре между «1» и «0» (именно в этом порядке, не «0» и «1»; строки без такой пары заморожены, стоят по центру)",
  t131: "ОсьБит: ось — не фиксированный столбец, а строка НАД текущей. Круговой сдвиг ◄/►Круг(Инв) двигает строку так, чтобы хоть одна её «1» встала в тот же столбец, что хоть одна «1» строки выше (при включённой галке «⊙ Ось: сдвиг только на «1»/между «1-0»» — иначе обычный одиночный шаг). У первой строки/если строка выше пустая — двигать не на что",
  t132: "ОсьБит ½: та же ось-от-строки-выше, но ЗАЗОР между «1» и «0» строки выше (именно в этом порядке), не сам бит — аналогично «Ось 1.2»",
  t133: "Убрать/вернуть боковые панели — то же самое, что штатный переключатель панелей, но доступное с телефона, когда панели закрыли собой всё",
  t134: "Режим курсора: одним пальцем двигаешь перекрестье (как тачпад), двумя — обычная прокрутка и щипковый зум. Нужен, чтобы попадать по отдельным битам, где палец закрывает полстроки",
  t135: "Чем заполняется ЛЕВОЕ зеркало. Нажатие переключает по кругу: «реверс+инв» — как было, строка отражается и биты инвертируются; «реверс» — отражается, биты как есть; «инверсия» — порядок бит как в строке, значения 0↔1; «копия» — строка как есть. Вид действует и на серый показ, и на поиск по зеркалам, и на «⇔ Вписать зеркала в строки». У правого зеркала вид свой, отдельный",
  t136: "Чем заполняется ПРАВОЕ зеркало — те же четыре вида по кругу, что и у левого, но настраивается независимо от него",
  t137: "Убрать САМ осевой (опорный) бит ЛЕВОГО зеркала — первый бит строки. «Оставить» (как было всегда): бит в зеркало не входит, но в строке остаётся единственным центром симметрии — «1011» показывается как [зеркало от «011»] + «1011». «Убрать»: бита нет вовсе, зеркало смыкается с остатком — [зеркало от «011»] + «011». Действует и на серый показ, и на поиск по зеркалам, и на «⇔ Вписать зеркала в строки» — там бит удаляется уже из данных",
  t143: "Прогоняет по всем включённым режимам ВСЕ осмысленно различные маски до заданного периода и показывает те, что дают находку — паттерн строки под выделенной. Пропускаются только бессмысленные: сплошная, пустая и та, что сама есть повтор более короткой («1010» = «10»). Повороты маски НЕ пропускаются — это и есть её фазы, и находят они разное. Масок получается 2, 6, 12, 30, 54, 126, 240, 504, 990, 2046, 4020 для периодов 2…12; до периода 8 — 470 штук, до 10 — 1964, до 12 — 8030, и на 12+ интерфейс на секунды подвиснет (перебор синхронный). ФАЗЫ: по диапазону они уже покрыты самим списком (все повороты каждой маски в нём есть отдельными записями), а для своего списка масок фазы крутятся отдельно — но только пока перебор укладывается в бюджет работы (сумма длин масок × длина строки); на слишком длинных масках проверяется одна фаза, и об этом пишется в шапке результатов. Витки кольца перебор считает ТОЙ ЖЕ галкой «🎭 Маска заново каждый виток», что и обычный поиск: своего переключателя у него больше нет (раньше был «сквозной» с обратной логикой, и найденная им маска при клике не находилась). Снимите галку — маска ляжет на удвоенную строку, то есть пойдёт через границу витка: это второе, отдельное множество вариантов, его стоит прогнать отдельно. Если поле списка масок ниже непусто, диапазон длин не используется — перебор идёт ровно по списку. Клик по найденной маске ставит её в поле",
  t142: "Простой шаг БЕЗ сдвигов: ни одна строка не двигается, не крутится и не переписывается — просто проверяется, не совпал ли паттерн ПРЯМО СЕЙЧАС, в текущем положении строк (вдруг он там уже есть). Считаются все включённые режимы фон-поиска, а если задана «🎭 Маска» — то и все её фазы. Результат раскладывается в «🧾 Черновик шага» (какие режимы проверены, что совпало, а по маскам — отдельный разбор по фазам: сколько бит взято, где именно нашлось) и записывается в «Лог находок» — в том числе повторно, если та же строка уже находилась раньше",
  t141: "Как «🎭 Маска» ведёт себя на витках кольца (строка результата показывается и ищется повторённой). ВКЛЮЧЕНО (по умолчанию): в каждом витке маска начинается заново со своей фазы — маска ложится на саму строку, и уже результат повторяется кольцом. СНЯТО: маска идёт сквозь витки подряд, на границе витка счёт не сбрасывается — тогда во втором витке гаснут другие биты, чем в первом (если длина результата не делится на длину маски). Показ и поиск всегда согласованы: что погашено, то и не участвует. Этой же галкой считает и «🎭 Перебор масок» — своего переключателя витков у него нет, чтобы найденная им маска потом искалась ровно так же, как нашлась",
  t140: "🎭 Маска ПРОРЕЖИВАЕТ строку результата, а не ищется в ней. Маска прикладывается к результату по кругу: «1» — бит идёт в поиск, «0» — пропускается; фон-поиск ищет паттерн строки ниже в том, что осталось. Маска «10» — каждый второй бит. В самой строке результата ничего НЕ вырезается: пропущенные биты просто затемняются, видно и всю строку, и что из неё взято. СО СДВИГОМ: маска прикладывается с каждого своего символа, поэтому маска длины N даёт N строк результата (фазы «#м1», «#м2»…) — строка одна и та же, гаснут в ней разные биты, и совпадение считается в каждой отдельно. Работает у всех включённых режимов разом — Xor, Сквозные, поколоночные и прочие. Всё, кроме 0 и 1, из маски выбрасывается, писать можно с пробелами. Пустое поле (или маска из одних нулей) — режимы отдают свои результаты как всегда",
  t139: "Один клик = ВСЕ биты зеркала выделенной строки уходят НАВЕРХ ЛЕСЕНКОЙ: первый бит — в строку прямо над выделенной, второй — ещё строкой выше, и так далее; каждый дописывается в конец своей строки, в первое свободное место. Пример: строки «1» и «11», зеркало «11» — это «0», он уходит в пустое место над ней → «10»/«11»; у строки «111» зеркало «00» уедет сразу в две строки выше → «100»/«110»/«111». Выделение переходит на строку ниже ТОЛЬКО если фон-поиск нашёл её паттерн — иначе остаётся на месте и клик можно повторить. Стороны — те, что включены (обе — по очереди: правый бит, левый, правый…), порядок внутри стороны — от строки наружу",
  t138: "То же самое для ПРАВОГО зеркала: его осевой бит — ПОСЛЕДНИЙ бит строки. Флаг свой, независимый от левого; включены обе стороны с обрезкой — строка теряет и первый, и последний бит",
};
function applyTips(){
  for (const el of document.querySelectorAll('[data-tip]')) {
    const t = TIPS[el.dataset.tip];
    if (t && el.title !== t) el.title = t;
  }
}
applyTips();
// Часть разметки лежит в body ПОСЛЕ этого script — ей подсказки проставляем, когда документ
// дочитан (тот же приём, что и у разметки курсора ниже).
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applyTips);
