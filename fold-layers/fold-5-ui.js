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
  /* ═══ ЗАМОК ВЫРАВНИВАНИЮ БОЛЬШЕ НЕ МЕШАЕТ (v1.347) ═══
     Запрос пользователя: «выравнивания П1, П2, Ц при замке разблокируй».
     Здесь стоял запрет: под 🔒 кнопка «⇤» отвечала сообщением и не делала ничего. Рассуждение было
     такое — выравнивание меняет положение каждого паттерна, а замок это и запирает.
     На деле замок стережёт ДАННЫЕ и ручные сдвиги: чтобы не поехали биты, не выделилось лишнее, не
     утащили колонку мышью. Выравнивание же — способ ПОСМОТРЕТЬ на те же данные: ни одного бита оно
     не меняет, снимается тем же кликом обратно и живёт в настройках вида, а не в цепочке. Ровно
     поэтому у ЦЕПОЧКИ полоса выравниваний под замком никогда и не запиралась — запрет стоял только
     здесь, и это была несогласованность, а не правило.
     Убираем. Теперь все три поля ведут себя одинаково: под 🔒 их можно ровнять, но не двигать. */
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
  applyPatAligns();
  render();
  saveCache();
}
/* ОТМЕТКА "act" В ПОЛОСЕ ВЫРАВНИВАНИЙ — ОДНО МЕСТО НА ВСЮ ПРОГРАММУ (v0.976). Раньше её ставил
   сам обработчик клика ("снять со всех, повесить на нажатую"), и это разъезжалось с настоящим
   состоянием поля. Горит выравнивание ЦЕПОЧКИ — единственного поля, которое полоса правит
   (v1.143), — или выделенной группы строк, если выделение совпало ровно с ней. */
/* ВЫРАВНИВАНИЕ ГРУППЫ, КОТОРУЮ СЕЙЧАС ВЫДЕЛИЛИ (v0.977) — или null, если выделение не совпадает
   ровно с одной готовой группой. Нужно ТОЛЬКО для подсветки: пока выделены строки одной группы,
   в полосе должна гореть ЕЁ кнопка, а не выравнивание поля — иначе непонятно, что даст повторный
   клик (а он группу распускает). Частичное выделение группы или сборная солянка из разных групп
   подсветки не получают: назначать им всё равно придётся заново, целиком. */
function selectedRowsGroupAlign(){
  if (!st.selectedRows || st.selectedRows.size < 2) return null;
  /* ГРУППЫ ЕСТЬ ТОЛЬКО У ЦЕПОЧКИ (v1.090): в колонках паттернов выравнивание одно на всю колонку.
     Сохранённые в старых кэшах st.rowGroupsL/rowGroupsR сюда не попадают вовсе — rowGroupOf()
     смотрит только группы цепочки. */
  const rows = Array.from(st.selectedRows);
  const g = rowGroupOf(rows[0]);
  if (!g || g.rows.length !== rows.length) return null;
  for (const r of rows) if (rowGroupOf(r) !== g) return null;
  return g.align;
}
function syncAlignActMarks(){
  const grp = document.getElementById("alignGrp");
  if (!grp) return;
  const cur = selectedRowsGroupAlign() || st.align;
  grp.querySelectorAll("button[data-val]").forEach(b => {
    b.classList.toggle("act", b.getAttribute("data-val") === cur);
  });
}
/* СДВИГ ВСЕЙ РАСКЛАДКИ в пикселях — из столбцов/строк через РЕАЛЬНЫЙ шаг столбца и высоту строки
   (те же величины, какими render() печатает отступы), поэтому сдвиг всегда попадает ровно в
   колонку и ровно в строку, а не "примерно". Зовётся в конце render() (шаг меряется по уже
   отрисованным битам) и из протяжек ручек #vsplitL0/#hsplitTop.
   ЗДЕСЬ БЫЛИ ЕЩЁ ПЯТЬ ПЕРЕМЕННЫХ — --pat-off-l/r и --pat-offy-l/r/--bits-offy, сдвиги отдельных
   полей друг относительно друга. Удалены в v1.066 вместе со всем растаскиванием полей (см.
   комментарий «ПОЛЯ НЕПОДВИЖНЫ» в fold-1-core.js). Имя функции оставлено прежним: её зовут из
   десятка мест, а смысл «применить сдвиги раскладки к CSS» не изменился. */
function applyPatOffsets(){
  const step = (typeof realColStepPx === "function" ? realColStepPx() : 0) || 8;
  const root = document.documentElement;
  /* ВЕРТИКАЛЬ — в ВЫСОТАХ СТРОКИ, а не в пикселях: сдвиг на одну строку обязан оставаться сдвигом
     на одну строку при любом кегле и любом межстрочном. Высота берётся из --row-h, её считает
     updateRowHeight() как round(кегль × межстрочный) — ровно та же величина, которой живут сами
     строки. */
  const rowH = parseFloat(getComputedStyle(root).getPropertyValue("--row-h")) || 12;
  root.style.setProperty("--chain-shift-x", ((chainShiftCols || 0) * step).toFixed(2) + "px");
  // Вертикальный сдвиг ВСЕЙ раскладки (ручка #hsplitTop, v1.045).
  root.style.setProperty("--chain-shift-y", ((chainShiftRows || 0) * rowH).toFixed(2) + "px");
}
/* СДВИНУТЬ ОСЬ ЦЕПОЧКИ НА N СТОЛБЦОВ. Раньше это была nudgeField(field, dCols, dRows) — одна точка
   входа для сдвига ЛЮБОГО из трёх полей и по обеим осям (v0.982). Полей, которые двигаются, больше
   нет (v1.066), осталась одна величина — st.axisCenterOffset, общий сдвиг картинки цепочки, тот же,
   что у ручки #axisSplit. Вертикали у неё нет вовсе, поэтому и параметра dRows больше нет. */
/* ═══ ОСЬ ДВИГАЕТ ЦЕПОЧКУ, А НЕ НАЛОЖЕНИЯ (v1.257) ═══════════════════════════════════════════
   Запрос пользователя: «ось цепочек не должна двигать наложения».
   st.axisCenterOffset — общий сдвиг картинки цепочки, и он же входит в экранную позицию блоков
   (pasteCols в render: pb.col + off + …). Поэтому, двигая ось, человек тащил за собой и блоки —
   а блок на то и положен, чтобы стоять на выбранном месте, пока цепочку под ним подгоняют.
   Компенсируем: на сколько столбцов уехала ось, на столько же двигаем блоки обратно. На экране
   они остаются там, где стояли, а под ними едет цепочка — ровно то, ради чего ось и тянут.
   Такая же компенсация давно стоит у протяжки цепочки за биты (chainDrag в fold-4-tools.js) и у
   переключения выравниваний (v1.249) — теперь и у самой оси, всеми тремя путями. */
function pasteHoldOnAxisShift(dCols){
  if (!dCols || typeof pasteShiftAllBy !== "function") return;
  if (typeof pasteList === "function" && !pasteList().length) return;
  pasteShiftAllBy(dCols * 2, 0);   // в ПОЛУСТОЛБЦАХ: положение блока — col*2 + half
}
function nudgeAxis(dCols){
  if (!dCols) return;
  st.axisCenterOffset = (st.axisCenterOffset || 0) + dCols;
  axisPinCol = axisBaseCol() + st.axisCenterOffset;
  pasteHoldOnAxisShift(dCols);
  render();
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
  // ("на полях чисто биты должны быть"). Сам класс ставит applyRowNumMode(): у колонки теперь
  // есть и собственный выключатель, и решать, видна ли она, должен кто-то ОДИН.
  applyRowNumMode();
  const b = document.getElementById("bToggleFieldInfo");
  if (b) b.classList.toggle("overlay-on", fieldInfoOn);
  updateFieldInfo();
}

/* КОЛОНКА НОМЕРОВ СТРОК — кнопка «{10}» в полоске под осью (v1.033, запрос пользователя: "кнопку
   сюда слева вкл выкл номера строк и переключения 10-ной и 2-ном представлении их"). Одна кнопка
   на оба дела, по кругу — тот же приём, что у замка осей «+-+» рядом: состояний три, отдельный
   выключатель рядом с переключателем системы счисления был бы лишней кнопкой в тесной планке.
   Само число печатает rowNumColText() в fold-4, скрытие — CSS-класс body.hide-rownums.
   ОКНО «ℹ Поле» СИЛЬНЕЕ: пока оно включено, колонки нет в любом режиме (см. applyFieldInfo) —
   поэтому видимость считается здесь одним выражением, а не двумя независимыми toggle. */
/* ═══ РЕЖИМА «ВЫКЛЮЧЕНО» У КНОПКИ БОЛЬШЕ НЕТ (v1.417) ═══
   Запрос пользователя: «пусть кнопка № не отключает номера, а только меняет 10-2-10-2».
   Третье положение отсюда убрано: кнопка переключает систему счисления и только её. Номера в
   колонке теперь показываются всегда — а прятать их целиком по-прежнему умеет окно «ℹ Поле»
   (fieldInfoOn, см. applyRowNumMode: класс hide-rownums оно ставит само, независимо от режима).
   Само значение "off" из состояния не выпалывается: старый кэш мог сохранить его, и applyUiSettings
   ниже приведёт такое к "dec" сам — indexOf в новом списке его не найдёт. Подпись для него в
   ROW_NUM_LABEL тоже оставлена: она достаётся окну «ℹ Поле», когда колонка скрыта им. */
const ROW_NUM_ORDER = ["dec", "bin"];
/* Подписи обычные, словами (v1.081): «{10}/{01}/{—}» были частью ASCII-оформления планки,
   которого больше нет — кнопки стали обычными. */
/* Без пробела после «№» (v1.322) — см. PAT_NUM_LABEL в fold-4-tools.js, подписи парные. */
/* ═══ ПОДПИСЬ КНОПКИ — ТОЛЬКО «№», А ПРИ ПОКАЗЕ «№0» (v1.414) ═══
   Запрос пользователя: «оставь только символ №, и при показе пусть №0», уточнение — «всегда просто
   0».
   Прежние «№10 / №01 / №—» показывали ещё и систему счисления, и подпись из трёх знаков распирала
   кнопку. Цифра теперь одна и та же в обоих режимах показа — 0, — а различие «десятичные или
   двоичные» осталось в подсказке: на кнопке оно и не читалось, два похожих числа рядом скорее
   путали.
   Выключено — голое «№»: цифры нет, потому что нечего показывать. */
const ROW_NUM_LABEL = { dec: "№0", bin: "№0", off: "№" };
const ROW_NUM_NOTE = {
  dec: "Номера строк в колонке поля — десятичные.",
  bin: "Номера строк в колонке поля — двоичные. Номера внутри паттернов это не трогает: у них своя кнопка «🔢 Двоичные номера» во вкладке «Вид».",
  off: "Колонка номеров строк убрана — в поле остались только биты и метки баланса."
};
function applyRowNumMode(){
  const mode = st.rowNumMode || "dec";
  document.body.classList.toggle("hide-rownums", fieldInfoOn || mode === "off");
  const b = document.getElementById("bAxisRowNum");
  if (b) {
    b.textContent = ROW_NUM_LABEL[mode] || ROW_NUM_LABEL.dec;
    b.classList.toggle("on", mode !== "dec");
  }
  /* ВЕЛИЧИНУ ВСТАВКИ ПЕРЕСЧИТЫВАЕМ ЗДЕСЬ ЖЕ (v1.317). С этой версии столбец номеров вставляется
     влево, за счёт колонки П1, и на его ширину отступает вся строка (--rownum-ins, см. CSS и
     updateSplitPositions). Отступ обязан сняться ровно тогда же, когда исчезает столбец, — иначе
     поле цепочки уедет ВЛЕВО на его ширину и останется там до следующей отрисовки.
     Зовём отсюда, а не из вызывающих: гасит колонку эта функция, и путей к ней два — кнопка «№»
     (cycleRowNumMode, та render() делает сама) и окно «ℹ Поле» (applyFieldInfo, а вот та не
     перерисовывает вовсе). Строк ещё нет (стартовый вызов) — updateSplitPositions выйдет сама. */
  if (typeof updateSplitPositions === "function") updateSplitPositions();
}
/* ═══ КНОПКА ХОДИТ ТУДА-СЮДА, А НЕ ПО КРУГУ (v1.319) ═══
   Запрос пользователя: «измени туда-сюда, а не по кругу: 10-01-N-01 (-10-01-N-01)».
   Кольцо (…→ — → 10 →…) заставляло на пути от «№ —» обратно к «№ 01» проходить через «№ 10»:
   лишний кадр с другой системой счисления и другой шириной столбца, а с v1.317 ещё и с другим
   сдвигом всей левой стороны. Маятник этого перескока не делает — на краях он разворачивается и
   идёт тем же путём назад: 10 → 01 → — → 01 → 10 → …
   Направление живёт только в памяти вкладки и в кэш не пишется намеренно: оно самовосстановимо.
   Упёрлись в край, а шаг ведёт наружу — разворачиваемся и шагаем внутрь, откуда бы ни начали.
   Поэтому после F5 (dir=1) из «№ —» первый же клик честно даёт «№ 01», а не ошибку.
   ═══ ОТМЕНЕНО В v1.417 ═══ Положений стало два, и вся эта механика потеряла предмет: между «10» и
   «01» перескакивать не через что. Текст оставлен затем, чтобы при возврате третьего режима сразу
   было видно, почему кольцо тогда не годилось. */
/* Маятник (rowNumDir, v1.319) удалён в v1.417 вместе с третьим положением: между двумя режимами
   разворачиваться негде, и «туда-сюда» это просто переключение. */
function cycleRowNumMode(){
  const i = ROW_NUM_ORDER.indexOf(st.rowNumMode || "dec");
  st.rowNumMode = ROW_NUM_ORDER[(i < 0 ? 0 : i + 1) % ROW_NUM_ORDER.length];
  applyRowNumMode();
  /* ═══ ДВА ПРОХОДА, И ЭТО НЕ ЗАПАС «НА ВСЯКИЙ СЛУЧАЙ» (v1.420) ═══
     Запрос пользователя: «при увеличении ширины номеров влево должна сдвигать биты и номера у П1».
     Внутри render() порядок такой: сперва собирается разметка ВСЕХ строк, и только потом
     измеряется ширина номера (fitNumW) и считается просвет под колонку. А поправка, которая уводит
     содержимое П1 влево, живёт как раз в сборке строк и берёт просвет ГОТОВЫМ. На кадре, где
     сменилась система счисления, она берёт его прежним — номера уже двоичные и шире, а биты П1
     ещё не сдвинуты.
     Первый проход измеряет и обновляет просвет, второй раскладывает строки уже по нему. Разворачивать
     ради этого весь render (мерить до сборки) я не стал: замер опирается на живой DOM строк, и
     перестановка задела бы всё, что от неё зависит, — цена куда выше, чем один лишний проход на
     ОДИН клик мыши. В горячих путях (прокрутка, перерисовка по таймеру) этого удвоения нет.
     saveCache после обоих: сохранять состояние имеет смысл, когда картинка уже согласована. */
  render(); render(); saveCache();
  say(ROW_NUM_NOTE[st.rowNumMode]);
}
/* ═══ СИСТЕМУ СЧИСЛЕНИЯ МЕНЯЕТ ДВОЙНОЙ КЛИК ПО САМОЙ КОЛОНКЕ (v1.419) ═══
   Запрос пользователя: «кнопку убери, но когда показываются № — двойной клик по этому полю меняет
   10 на 2».
   Кнопка занимала место над колонкой и была единственным, ради чего просвет держали шире номеров.
   Теперь действие живёт там же, где виден результат: двойной клик прямо по номерам.
   ОДИНОЧНЫЙ КЛИК НЕ ТРОГАЕМ — он достаётся строке (выделение), и перехватывать его нельзя: колонка
   номеров это часть строки, а не отдельный элемент управления.
   Делегируем на #rows: строки перерисовываются целиком на каждый render, и слушатель, повешенный
   на саму колонку, пережил бы ровно один кадр.
   Колонка скрыта окном «ℹ Поле» — жест молчит: менять систему счисления у того, чего не видно,
   значит менять её вслепую. */
{
  const rowsForNumDbl = document.getElementById("rows");
  if (rowsForNumDbl) rowsForNumDbl.addEventListener("dblclick", (e) => {
    if (document.body.classList.contains("hide-rownums")) return;
    const numCell = e.target && e.target.closest ? e.target.closest(".num-l2") : null;
    if (!numCell || !numCell.closest(".ln")) return;
    e.preventDefault();
    e.stopPropagation();
    cycleRowNumMode();
  });
}

/* ═══ ПРОТЯЖКА ВВЕРХ-ВНИЗ ПО КОЛОНКЕ НОМЕРОВ = МЕЖСТРОЧНЫЙ (v1.460) ═══
   Запрос пользователя (со скриншотом ползунка «↕»): «в номерах Ц поле если верх вниз перетаскивать
   пусть работает».
   Колонка номеров цепочки (.num-l2) для мыши была почти мёртвой: одиночный клик по ней намеренно
   не делает ничего, протяжку выделения она не начинает (см. обе проверки .num-l2 в fold-3-ops.js),
   а живёт там один жест — двойной клик, переключающий систему счисления. Вертикаль в ней свободна
   целиком, а межстрочный до сих пор крутили либо на границе поля (.vsplit), либо с зажатым Ctrl
   над битами — и то и другое ещё нужно найти.
   Тут ручка сама просится: колонка идёт вдоль всей цепочки, узкая, промахнуться некуда, и результат
   виден ровно там, где тянешь. Ползунок тот же самый — «↕» во вкладке «Вид» (#lh), — поэтому и код
   тот же makeLhVDrag(): своей шкалы и своего шага не заводим.
   БЕЗ МОДИФИКАТОРОВ (active=true с первого кадра): в отличие от протяжки над битами, вертикали в
   колонке номеров больше нечего делать, путать не с чем. С любой зажатой клавишей жест не
   начинается — Ctrl/Shift над полотном заняты своими ручками, и перебивать их отсюда незачем.
   Горизонтальную прокрутку обзора не перехватываем (нет stopPropagation): она висит на
   #screenCanvas и включается только после 3px по горизонтали, так что вертикальному жесту не мешает
   и остаётся доступной с этого же места, как была.
   Колонка скрыта окном «ℹ Поле» — жест молчит, как и двойной клик выше. */
{
  const rowsForNumLh = document.getElementById("rows");
  let numLhDrag = null;
  if (rowsForNumLh) rowsForNumLh.addEventListener("mousedown", (e) => {
    if (e.button !== 0 || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
    if (document.body.classList.contains("hide-rownums")) return;
    const cell = e.target && e.target.closest ? e.target.closest(".num-l2") : null;
    if (!cell || !cell.closest(".ln")) return;
    numLhDrag = makeLhVDrag(e.clientY);
  });
  // Кнопку отпустили где угодно (в том числе за окном) — жест кончился: тот же приём, что у
  // прокрутки обзора, где проверяется e.buttons на каждом кадре.
  window.addEventListener("mousemove", (e) => {
    if (!numLhDrag) return;
    if (!(e.buttons & 1)) { numLhDrag = null; return; }
    numLhDrag(e.clientY, true);
  }, { passive: true });
  window.addEventListener("mouseup", () => { numLhDrag = null; });
  window.addEventListener("blur", () => { numLhDrag = null; });
}
{
  const bRowNum = document.getElementById("bAxisRowNum");
  if (bRowNum) bRowNum.onclick = () => cycleRowNumMode();
  applyRowNumMode();
}
/* Кнопка общего выключателя выделения (v0.974). Сам запрет держит selectionAllowed() в
   fold-1-core.js — она зовётся на входе КАЖДОГО выделяющего обработчика; здесь только
   переключатель и вид кнопки. Значок меняется 🔓/🔒, чтобы состояние читалось без наведения. */
function applySelectEnabled(){
  const b = document.getElementById("bToggleSelect");
  if (b) {
    // ДВА состояния (v1.112, запрос пользователя "надо 2 режима — обычный и замок"): 🔓 всё живое
    // → 🔒 не трогается ничего. Средний 🔏 «паттерны заморожены» (v1.057) убран, см. patsEditAllowed
    // в fold-1-core.js.
    b.textContent = selectEnabled ? "🔓" : "🔒";
    b.classList.toggle("overlay-on", !selectEnabled);
  }
  /* И сразу за ярлыком этой же кнопки в слотах (v1.021): СНЯТИЕ замка идёт без render() — только
     applySelectEnabled() + saveCache(), — поэтому одного вызова из render() тут не хватает, ярлык
     оставался бы с 🔒 до ближайшей перерисовки по другому поводу. */
  if (typeof refreshPinSlotIcons === "function") refreshPinSlotIcons();
}
const bToggleSelectEl = document.getElementById("bToggleSelect");
if (bToggleSelectEl) {
  /* ПЕРЕКЛЮЧАТЕЛЬ НА ДВА ПОЛОЖЕНИЯ (v1.112): 🔓 ↔ 🔒. */
  bToggleSelectEl.onclick = () => {
    selectEnabled = !selectEnabled;
    applySelectEnabled();
    // Включение замка (🔒) не только запрещает НОВОЕ выделение (см. selectionAllowed), но и
    // сразу гасит уже выбранное — запрос пользователя "в режиме Замка все выделения снимать".
    // Та же функция, что и у Escape (см. clearAllSelections в fold-1-core).
    if (!selectEnabled) { clearAllSelections(); render(); }
    saveCache();
    say(!selectEnabled
      ? "🔒 Замок: все выделения сняты, по полотну ничего не выделяется и биты не двигаются — ни мышью, ни Кругом ◄/►. Стрелки двигают картинку: ←/→ — границу поля, ↑/↓ — прокрутка. Наложение (📋) стрелкам по-прежнему подчиняется: кликнул по блоку — ведёшь его."
      : "🔓 Выделение включено — строки, паттерны и биты снова выделяются.");
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
  syncColTwins();   // v1.320: пикеры у оси показывают то же, что панельные #col1/#col0
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

/* ЦВЕТА «1» И «0» В КОЛОНКАХ ПАТТЕРНОВ (v1.031, запрос пользователя: "цвета для 1 и 0 П1 и П2 надо
   задавать"). Пара к applyColors() выше, только та красит биты ЦЕПОЧКИ (--c1/--c0), а эта — текст
   паттернов, своей парой на каждую колонку. Разными функциями и разными пикерами по той же причине,
   что и у фонов полей: слои разные, и крутят их независимо.
   Перерисовка не нужна вовсе — цвет живёт целиком в CSS-переменных, разметка от него не меняется ни
   на символ (сами обёртки .pb1/.pb0 ставит colorPatBits() в render). */
const colPat1L = document.getElementById("colPat1L");
const colPat0L = document.getElementById("colPat0L");
const colPat1R = document.getElementById("colPat1R");
const colPat0R = document.getElementById("colPat0R");
function applyPatBitColors(){
  const root = document.documentElement;
  if (colPat1L) root.style.setProperty("--pat-c1-l", colPat1L.value);
  if (colPat0L) root.style.setProperty("--pat-c0-l", colPat0L.value);
  if (colPat1R) root.style.setProperty("--pat-c1-r", colPat1R.value);
  if (colPat0R) root.style.setProperty("--pat-c0-r", colPat0R.value);
  syncColTwins();   // v1.320: квадратики в планках показывают то же, что панельные пикеры
}
for (const el of [colPat1L, colPat0L, colPat1R, colPat0R]) {
  if (el) el.oninput = () => { applyPatBitColors(); saveCacheSoon(); };
}

/* ═══ ТЕ ЖЕ ЦВЕТА, НО ПРЯМО НА ХОЛСТЕ (v1.320) ═══
   Запрос пользователя: «в планки П1 и П2 — справа П1 и слева П2 — добавь кнопки изменения цветов
   в паттернах, палитру», и следом «и слева от оси цепочек также для 0 и 1 цвета».
   Это ПИКЕРЫ-ДВОЙНИКИ. Значение по-прежнему живёт в панельных #colPat1L/#colPat0L/#colPat1R/
   #colPat0R и #col1/#col0 — они и есть источник правды: от них считают applyPatBitColors() и
   applyColors(), их пишет и читает кэш. Двойник в планке только переписывает значение в свой
   оригинал и дёргает ту же цепочку, что дёрнул бы сам оригинал.
   Так уже сделано с цветами наложений (v1.171) и по той же причине: панель видна не всегда, а
   планки над полями — всегда, и подобраться к цвету оттуда на два клика короче.
   Пары держим списком, а не восемью переменными: обеим сторонам нужен один и тот же обход — один
   при правке двойника, другой при обратной синхронизации из панели.
   СПИСОК ВОЗВРАЩАЕТ ФУНКЦИЯ, А НЕ const СНАРУЖИ — намеренно: syncColTwins() зовётся из
   applyColors(), а та объявлена ВЫШЕ по файлу и может быть вызвана раньше, чем исполнение дойдёт
   сюда; внешний const попал бы во временную мёртвую зону и уронил бы первый же такой вызов. */
function patColTwins(){
  return [["colPat1L", "colPat1LAx"], ["colPat0L", "colPat0LAx"],
          ["colPat1R", "colPat1RAx"], ["colPat0R", "colPat0RAx"]];
}
function chainColTwins(){
  return [["col1", "colC1Ax"], ["col0", "colC0Ax"]];
}
/* Обратный ход: цвет изменили в панели — или его положил кэш при загрузке, или пресет цветов, —
   и двойники обязаны показать то же самое. Иначе их квадратики врут о цвете, который сами же и
   правят: щёлкнешь по такому, а палитра откроется на позапрошлом значении. */
function syncColTwins(){
  for (const [srcId, dstId] of patColTwins().concat(chainColTwins())) {
    const src = document.getElementById(srcId), dst = document.getElementById(dstId);
    if (src && dst && dst.value !== src.value) dst.value = src.value;
  }
}
for (const [srcId, dstId] of patColTwins()) {
  const src = document.getElementById(srcId), dst = document.getElementById(dstId);
  if (!src || !dst) continue;
  dst.oninput = () => { src.value = dst.value; applyPatBitColors(); saveCacheSoon(); };
}
/* У цепочки цепочка вызовов длиннее: markCustomColor() не только применяет цвета, но и переводит
   пресет в «Свой» либо пишет правку прямо в активный слот «Своя 1..4» (v0.846). Двойник обязан
   вести себя ровно так же, иначе правка с холста разошлась бы с правкой из панели. */
for (const [srcId, dstId] of chainColTwins()) {
  const src = document.getElementById(srcId), dst = document.getElementById(dstId);
  if (!src || !dst) continue;
  dst.oninput = () => { src.value = dst.value; markCustomColor(); };
}

/* ЦВЕТА «1» И «0» В НАЛОЖЕНИИ (v1.111, запрос пользователя: "для наложения надо настройки цвета
   0 и 1"). Третья такая пара после цепочки (--c1/--c0) и колонок (--pat-c1-L|R и --pat-c0-L|R) — и по
   той же причине отдельная: блок лежит ПОВЕРХ чужих бит, и разводить его цифры по цвету надо
   независимо от того, как покрашен слой под ним.
   Перерисовка не нужна: обёртки .ps1/.ps0 ставит render() всегда (см. pasteBitsHtml в
   fold-2-render.js), а цвет берётся из CSS-переменной — смена пикера видна тем же кадром. */
const colPaste1 = document.getElementById("colPaste1");
const colPaste0 = document.getElementById("colPaste0");
/* ДВЕ ПАРЫ ПИКЕРОВ НА ОДНУ НАСТРОЙКУ (v1.171). Одна живёт в панели «Наложение», вторая — в полосе
   осей: полоса видна всегда, даже когда панели скрыты, и подобраться к цвету оттуда быстрее.
   Значение одно, поэтому любая правка тут же переписывается во вторую пару — иначе они разошлись бы
   и показывали разное при одном и том же цвете на холсте. */
const colPaste1Ax = document.getElementById("colPaste1Ax");
const colPaste0Ax = document.getElementById("colPaste0Ax");
function applyPasteBitColors(src){
  const root = document.documentElement;
  const v1 = (src === "ax" && colPaste1Ax) ? colPaste1Ax.value : (colPaste1 ? colPaste1.value : null);
  const v0 = (src === "ax" && colPaste0Ax) ? colPaste0Ax.value : (colPaste0 ? colPaste0.value : null);
  if (v1) {
    root.style.setProperty("--paste-c1", v1);
    if (colPaste1 && colPaste1.value !== v1) colPaste1.value = v1;
    if (colPaste1Ax && colPaste1Ax.value !== v1) colPaste1Ax.value = v1;
  }
  if (v0) {
    root.style.setProperty("--paste-c0", v0);
    if (colPaste0 && colPaste0.value !== v0) colPaste0.value = v0;
    if (colPaste0Ax && colPaste0Ax.value !== v0) colPaste0Ax.value = v0;
  }
}
for (const el of [colPaste1, colPaste0]) {
  if (el) el.oninput = () => { applyPasteBitColors(); saveCacheSoon(); };
}
/* Эта пара служит ДВУМ задачам (v1.178): пока у неё нет data-pi — она правит ОБЩИЙ цвет наложений
   (значение по умолчанию для новых блоков); как только кнопка на блоке позвала её через .click(),
   в data-pi лежит номер блока, и правка уходит ЕМУ ОДНОМУ.
   Признак снимается сразу после применения: следующий заход снова общий, пока блок не попросит. */
for (const el of [colPaste1Ax, colPaste0Ax]) {
  if (!el) continue;
  el.oninput = () => {
    const pi = el.dataset.pi;
    if (pi !== undefined && pi !== "") {
      const list = (typeof pasteList === "function") ? pasteList() : [];
      const blk = list[+pi];
      if (blk) {
        if (el.dataset.slot === "c0") blk.c0 = el.value; else blk.c1 = el.value;
        if (typeof render === "function") render();
        saveCacheSoon();
        return;
      }
    }
    applyPasteBitColors("ax");
    saveCacheSoon();
  };
  el.onchange = () => { delete el.dataset.pi; delete el.dataset.slot; };
}
applyPasteBitColors();

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
/* fieldKey ("L"/"C"/"R", v1.055, запрос пользователя: "вместе с границами полей двигай и
   принадлежащие биты") — какому полю принадлежит эта граница. Раньше протяжка меняла только ШИРИНУ
   коробки, а глифы внутри стояли на своих столбцах: поле «раскрывалось» вокруг неподвижных бит, и
   при левом выравнивании биты просто оставались у дальнего края. Теперь вместе с границей едет и
   содержимое — на столько же столбцов, на сколько сдвинулась сама граница, то есть биты сохраняют
   своё положение ОТНОСИТЕЛЬНО неё.
   Двигаем тем же сдвигом поля, что и протяжка за биты/Alt+стрелки (patOffL/patOffR у крайних,
   st.axisCenterOffset у цепочки) — отдельной величины не заводим, иначе два механизма разошлись бы.
   Шаг — целые СТОЛБЦЫ: сдвиг полей везде в этом приложении считается в столбцах, и дробный пиксель
   тут дал бы биты, не попадающие в сетку. */
function makeColResizer(el, varName, selectorOfCol, minPx, onManual, invert, fieldKey){
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
    // .drag / body.dragging переехали во взвод (armDrag, v1.344) — на один клик подсветка границы
    // больше не мигает.
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
    /* ═══ ОДИН КЛИК ПО ГРАНИЦЕ БОЛЬШЕ НИЧЕГО НЕ ДЕЛАЕТ (v1.344) ═══
       Запрос пользователя: «одиночный клик на границу — непонятно, что двигает; убери обработку
       клика».
       И правда двигал. Эти две строки выполнялись на mousedown, ДО первого движения мыши: ширина
       переписывалась замеренным числом, а onManual() навсегда выключал автоподбор колонки. То есть
       случайное касание границы молча замораживало её ширину — и дальше колонка переставала
       садиться по самому длинному паттерну, хотя человек ничего не тянул. Видимого сдвига при этом
       могло не быть вовсе, отсюда и «непонятно что».
       Теперь захват ВЗВОДИТСЯ только когда мышь реально ушла хотя бы на 2px (armDrag ниже, зовётся
       из move). Порядок внутри самого взвода прежний и важен: сперва ширина ставится на замеренное
       startW, потом onManual — разбор в комментарии v1.000 выше, там это спасало #vsplit2 от
       схлопывания при переключении flex:1 → flex:0.
       Класс .drag и body.dragging тоже переехали во взвод: без них клик не мигает подсветкой
       границы, а протяжка выглядит как раньше. */
    const armDrag = () => {
      el.classList.add("drag");
      document.body.classList.add("dragging");
      document.documentElement.style.setProperty(varName, Math.round(startW) + "px");
      if (onManual) onManual();
    };
    let dragArmed = false;
    /* Базовый сдвиг цепочки — на момент захвата (см. fieldKey у функции). lastDCols держим
       отдельно, чтобы не дёргать перерисовку на каждый пиксель: содержимое переставляется только
       когда граница реально перешла на следующий СТОЛБЕЦ. */
    const baseOffC = (st.axisCenterOffset || 0);
    let lastDCols = 0;
    const move = ev => {
      /* ПОКА МЫШЬ НЕ УШЛА — НИЧЕГО НЕ ТРОГАЕМ (v1.344). Два пикселя допуска: столько набегает от
         дрожи руки на щелчке, и принимать это за протяжку нельзя — она выключает автоподбор
         колонки навсегда. Ctrl-протяжка межстрочного (lhDrag) тоже ждёт взвода: она вертикальная,
         но начинается тем же захватом, и «клик по границе не делает ничего» должно быть верно
         целиком, а не наполовину. */
      if (!dragArmed) {
        if (Math.abs(ev.clientX - startX) < 2) return;
        dragArmed = true;
        armDrag();
      }
      /* Нижний упор поля цепочки — не 40px, а «чтобы влезла полоса выравниваний» (v1.285,
         запрос «ширина поля цепочек минимум… чтобы вмещалось всегда меню выравниваний»).
         Меряем на каждом движении, а не один раз при захвате: ширина полосы меняется от набора
         кнопок в ней, и застывшее при mousedown число к концу протяжки бывает уже неверным. */
      const minNow = (varName === "--bits-w") ? Math.max(minPx, minBitsWidthPx()) : minPx;
      /* Верхний упор — только у поля цепочки (v1.368): шире самой длинной строки его тянуть незачем,
         справа от бит открывалась бы пустота. Меряем на каждом движении, как и нижний: строки
         правятся прямо во время протяжки (стрелки, круг), и застывшее при захвате число к концу
         жеста бывает уже неверным. */
      const maxNow = (varName === "--bits-w" && typeof maxBitsWidthPx === "function")
        ? maxBitsWidthPx() : Infinity;
      const w = Math.min(maxNow, Math.max(minNow, Math.round(startW + sign * (ev.clientX - startX))));
      document.documentElement.style.setProperty(varName, w + "px");
      /* БИТЫ ЕДУТ ВМЕСТЕ С ГРАНИЦЕЙ (v1.055). Меряем в столбцах от РЕАЛЬНО применённой ширины
         (w - startW), а не от хода мыши: у ширины есть нижний упор minPx, и после упора мышь ещё
         идёт, а граница уже стоит — содержимое обязано стоять вместе с ней.
         Замок осей движения («=-=»/«#-#») жест не глушит целиком: ширину полю менять он не
         запрещает, а вот таскать за собой биты — как раз тот сдвиг поля, который он и держит. */
      // fieldKey остался только у ЦЕПОЧКИ ("C"): у крайних полей своего сдвига больше нет (v1.066),
      // их биты стоят на месте, а граница меняет только ширину коробки.
      /* «L» — правая граница П1 (v1.187, запрос: «граница П1 едет вправо, содержимое цепочки
         уезжает влево на то же число столбцов, чтобы его не накрывало»). Знак ОБРАТНЫЙ знаку
         цепочки: расширяя П1, мы толкаем цепочку вправо, и чтобы картинка стояла на месте, её
         содержимое надо увести влево ровно на столько же. Данные при этом не трогаются — едет
         только сдвиг оси, как и у самой цепочки. */
      if ((fieldKey === "C" || fieldKey === "L") && (typeof moveColsAllowed !== "function" || moveColsAllowed())) {
        const step = (typeof realColStepPx === "function" ? realColStepPx() : 0) || 8;
        const dCols = Math.round((w - startW) / step);
        if (dCols !== lastDCols) {
          lastDCols = dCols;
          // Сдвиг цепочки — это st.axisCenterOffset, а он входит в геометрию строки, поэтому нужен
          // полноценный render(). Он тут не на каждый пиксель, а на каждый перейденный столбец,
          // то есть заметно реже движений мыши.
          st.axisCenterOffset = baseOffC + (fieldKey === "L" ? -dCols : dCols);
          if (typeof render === "function") render();
        }
      }
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
/* Правая граница П1 (v1.187): fieldKey «L» — при её движении содержимое ЦЕПОЧКИ отъезжает на
   столько же столбцов в обратную сторону, чтобы расширяющаяся колонка его не накрывала (см.
   ветку fieldKey в makeColResizer). */
makeColResizer(document.getElementById("vsplit"), "--pat-w", ".pat", 40, () => {
  patWManual = true;
  /* Перестановка флагов прибавки (v1.303) отсюда УБРАНА в v1.389: разовой прибавки под номер
     больше не бывает — место под него вычитается из видимой ширины всегда, и помнить о ней нечего.
     Флаги обнуляются, чтобы от прежних сеансов (кэш, старая раскладка) не осталось «включённого»
     состояния, которое теперь никто не снимет. */
  patWNumReserved = false;
  patWNumReservedPx = 0;
}, false, "L");
/* vsplitL0 (внешняя левая граница П1) БОЛЬШЕ НЕ через makeColResizer — с v1.010 она не меняет
   ширину П1 вовсе (за это отвечает только #vsplit выше), а двигает все три поля разом. Свой
   отдельный обработчик — см. блок "vsplitL0 — СДВИГ ВСЕХ ТРЁХ ПОЛЕЙ" ниже. */
makeColResizer(document.getElementById("vsplit2"), "--bits-w", ".bits", 40, () => {
  // Ширину повели рукой — подгонка по оси больше не «применена», её двойной клик снимать нечего.
  axisFitOn = false;
  bitsWManual = true;
  document.body.classList.add("bits-w-manual");
}, false, "C");
/* ═══ ПРАВУЮ ГРАНИЦУ П2 БОЛЬШЕ НЕ ТЯНУТ (v1.386) ═══
   Запрос пользователя: «прижми и не двигай её, ширина П2 задаётся границей слева».
   Здесь на неё вешался обычный резайзер ширины (--pat-w2). Снимаем: ширину колонки теперь считает
   updateSplitPositions от кромки холста, и протяжка спорила бы с ней — рука тянет, а следующий же
   кадр возвращает. Ручка остаётся на месте как ВИДИМАЯ кромка полотна; курсор «перемещение» ей
   больше не к лицу, но и вреда от него нет — жеста за ним не стоит.
   Двойной клик у неё тоже был (v1.369, «до конца вправо» + подгонка ширины). Подгонка потеряла
   смысл вместе с ручной шириной, прокрутка к правому краю — нет, поэтому обработчик оставлен, а
   вызов fitPatColumnTo из него убран. */
// makeColResizer(#vsplit3) — удалён в v1.386, см. разбор выше.
/* ДВОЙНОЙ КЛИК ПО ГРАНИЦЕ КОЛОНКИ ПАТТЕРНОВ — посадить её ширину на самый длинный паттерн
   (запрос пользователя: "зафиксирую ширину П1 и П2 по самой широкой строке").
   ПЕРЕДЕЛАНО В v1.074, две правки по существу.
   1. ВОЗВРАЩАЕМ АВТОПОДБОР, а не считаем ширину разово. Раньше флаг "ширину тянули руками"
      (patWManual/patW2Manual) намеренно не трогался, и подогнанная ширина застывала: добавил
      паттерн длиннее — он уже не влезает, надо снова тыкать в границу. А «⌖ Всё на место» вообще
      поднимает оба флага и ставит колонкам по 20% холста, так что после неё двойной клик давал
      ровно один правильный кадр. Теперь флаг снимается — колонка садится по самому длинному
      паттерну и ДЕРЖИТСЯ на нём дальше сама (пересчёт в render(), см. fitPatW/fitPatW2).
      Это ровно та же логика, что у двойного клика по средней границе (#vsplit2 → axisFitReset):
      «вернуть автоматическую ширину». Тянуть границу мышью по-прежнему можно — это снова закрепит
      ширину руками, как и раньше.
   2. СЧИТАЕМ ТЕМИ ЖЕ fitPatW/fitPatW2, а не своей копией формулы. Копия отставала: она прибавляла
      к ширине только отступы ячейки (+36) и не знала про НОМЕР ВНУТРИ ячейки (--num-w, кнопки
      «{#}» у планок П1/П2). С включённым номером колонка выходила уже нужного ровно на его ширину
      и резала хвост самого длинного паттерна — то есть не делала того единственного, ради чего её
      зовут. */
function fitPatColumnTo(varName){
  let maxLen = 0;
  for (const p of (st.pats || [])) if (p && p.text && p.text.length > maxLen) maxLen = p.text.length;
  if (!maxLen) { say("Подгонка ширины: паттернов нет."); return; }
  const isL = varName === "--pat-w";
  if (isL) { patWManual = false; fitPatW(); } else { patW2Manual = false; fitPatW2(); }
  updateSplitPositions();
  saveCache();
  say(`${isL ? "П1" : "П2"}: ширина села на самый длинный паттерн (${maxLen} бит) и дальше считается автоматически — появится длиннее, колонка расширится сама. Потянуть границу мышью — ширина снова закрепится руками.`);
}
{
  const vL = document.getElementById("vsplit");
  if (vL) vL.addEventListener("dblclick", e => { e.preventDefault(); fitPatColumnTo("--pat-w"); });
  /* Прежний обработчик у #vsplit3 (только подгонка ширины, v1.074) убран в v1.369: ниже на ту же
     границу вешается общий, где к подгонке добавлена прокрутка «до конца вправо». Два слушателя на
     одно событие оставлять нельзя — подгонка отработала бы дважды, а искать потом, почему у правой
     границы двойной клик «делает что-то ещё», пришлось бы по всему файлу. */
  const vR = document.getElementById("vsplit3");
  /* ПУТЬ НАЗАД ДЛЯ СРЕДНЕГО СТОЛБЦА (v0.916). Его ширину задают руками (перетаскивание #vsplit2)
     и двойной клик по оси (axisCenterAndFitBits) — оба ставят bitsWManual, и render() перестаёт
     считать --bits-w по самой длинной строке. Флаг живёт в кэше, поэтому неудачная ширина
     переживала и перезагрузку: вернуть её было нечем (баг-репорт "двойной щелчок по оси всё
     сломал"). Двойной клик по этой же ручке снимает флаг — ближайший render() пересчитает
     ширину сам. Общий визуальный сдвиг тоже обнуляем: он мог остаться от подгонки. */
  const vM = document.getElementById("vsplit2");
  if (vM) vM.addEventListener("dblclick", e => { e.preventDefault(); axisFitReset(); });
  /* ═══ ДВОЙНОЙ КЛИК ПО ВНЕШНИМ ГРАНИЦАМ — ПОЛЕ К КРАЮ И ПОД СВОЙ ПАТТЕРН (v1.369) ═══
     Запрос пользователя: «2 клик по левой границе П1 — границу до конца влево, при этом правим
     ширину П1 по ширине самой широкой строки; также и П2, но вправо».
     У внутренних границ двойной клик был давно (v1.074) и сажал колонку на самый длинный паттерн.
     У внешних не было ничего, хотя именно они и отвечают за то, КУДА поле смотрит краем.
     Делаем оба действия разом, по одному на сторону.
     СЛЕВА (#vsplitL0). «До конца влево» — это chainShiftCols = 0: ручка двигает не ширину, а всю
     раскладку целиком (v1.011), и ноль у неё уже стоит стопором на протяжке. Плюс прокрутка холста
     в самое начало: сдвиг ставит раскладку к левому краю ПОЛОТНА, а видно её только если полотно
     не прокручено. Два действия, одна цель — «граница у левого края экрана».
     СПРАВА (#vsplit3). Сдвигать раскладку некуда: у неё нет правого стопора, и «до конца вправо»
     значит показать этот край — прокручиваем холст в самый конец. Ширина при этом садится на самый
     длинный паттерн, как и слева.
     Ширину обеим считает та же fitPatColumnTo, что и у внутренних границ: двух формул «по самому
     длинному паттерну» в файле быть не должно. Она же снимает флаг ручной ширины, то есть колонка
     дальше держится за паттерн сама. */
  const vL0 = document.getElementById("vsplitL0");
  if (vL0) vL0.addEventListener("dblclick", e => {
    e.preventDefault();
    chainShiftCols = 0;
    if (typeof applyPatOffsets === "function") applyPatOffsets();
    fitPatColumnTo("--pat-w");
    const sc = document.getElementById("screenCanvas") || document.querySelector(".canvas");
    if (sc) sc.scrollLeft = 0;
    saveCache();
  });
  if (vR) vR.addEventListener("dblclick", e => {
    e.preventDefault();
    /* Подгонка ширины отсюда убрана в v1.386: ширину П2 задаёт теперь граница Ц|П2 и кромка
       холста, а не самый длинный паттерн. Осталась прокрутка «до конца вправо» — она к этой
       границе и относится: она и есть правый край полотна. */
    const sc = document.getElementById("screenCanvas") || document.querySelector(".canvas");
    if (sc) sc.scrollLeft = Math.max(0, sc.scrollWidth - sc.clientWidth);
    saveCache();
  });
}

/* ═══ vsplitL0 — СДВИГ ВСЕЙ РАСКЛАДКИ (v1.011, запрос пользователя: "левая граница сейчас
   расширяет левое поле, измени чтоб её можно было двигать вправо — смещая все поля при этом, а
   слева открывается пустотка"; уточнение — "влево просто пустое место убирает до границы экрана
   и все поля обратно влево тянет"; "П1 шире — пусть только правая граница делает") ═══
   ПЕРЕДЕЛАНО в v1.011 (баг-репорт по первой версии: "всё уехало вправо, но самой границы и
   пустого поля нет, его другим фоном покажи — чёрным"): v1.010 двигала patOffL/patOffR/
   axisCenterOffset — те же переменные, что и обычная протяжка поля мышью, а это ЧИСТО ВИЗУАЛЬНЫЙ
   сдвиг ГЛИФОВ внутри НЕПОДВИЖНЫХ колонок (см. комментарий у applyPatOffsets/patOffL) — сами
   .vsplit-границы и коробки колонок никуда не ехали, слева проступал не единый пустой холст, а
   огрызки фоновых плашек ячеек. Теперь честный layout-сдвиг: chainShiftCols → margin-left у
   .chain (см. .chain{margin-left:var(--chain-shift-x)} в CSS и её же в applyPatOffsets()).
   .vsplit-границы, #colHeader, #axisSplit — все position:absolute ОТНОСИТЕЛЬНО .chain, поэтому
   едут вместе с ней бесплатно, никакого пересчёта их left не нужно. Слева проступает родной фон .canvas
   (--cbg, он уже #000) — отдельно красить в чёрный не пришлось.
   Стопор влево — до нуля (упор в левый край экрана), дальше нельзя: это ЗАКРЫВАЕТ пустоту, а не
   уводит раскладку в минус (там ей уже нечего делать — левее исходного положения нет смысла). */
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
    panL0 = { x0: e.clientX, moved: false, lhDrag: makeLhVDrag(e.clientY), base: chainShiftCols || 0 };
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
    if (panL0.base + d < 0) d = -panL0.base;   // стопор влево — не дальше нуля
    chainShiftCols = panL0.base + d;
    applyPatOffsets();
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

/* ═══ СЛОТЫ ЗАКРЕПЛЁННЫХ КНОПОК СЛЕВА/СПРАВА ОТ ПОЛОСЫ ВЫРАВНИВАНИЙ (v1.012, запрос пользователя:
   "поля справа и слева от выравниваний меню — для вставки значков кнопок, которые перетаскиванием
   закрепляются"; уточнение — "любая кнопка из любого места", "фиксированное число, хранится в
   кэше") ═══
   В слоте лежит НЕ клон логики, а маленький ПРОКСИ: клик по нему делает
   document.getElementById(id).click() — работает одинаково для ЛЮБОЙ кнопки приложения,
   независимо от того, как у неё устроен обработчик (onclick-атрибут, addEventListener,
   делегирование) — раз кликается сам оригинал, все его пути срабатывают как обычно.
   draggable="true" кнопкам в разметке не прописан (это тысячи кнопок по всему файлу) —
   выставляется ЛЕНИВО, при первом mousedown по любой кнопке с id (делегирование на document),
   один раз на кнопку. У прокси-кнопок В САМИХ СЛОТАХ id нет — поэтому они сами никогда не
   попадают под этот же селектор и не тащатся рекурсивно. */
var PIN_SLOTS_N = 5;   // столько пустых ячеек с каждой стороны — если мало/много, менять только тут
                       // (var, а не const — см. про TDZ у pinSlots ниже)
/* Стартовый набор (v1.015, запрос пользователя — прислал два скриншота с "эти закрепи"/"эти тоже
   перенеси"): "◐ Слои"/"⌖ Поля на место"/"⬇ Меню вниз" слева, ↩/↪/🔗/🧾/🔒/ℹ справа. Актуален
   только пока в кэше нет своего pinSlots — как только пользователь сам перетащит что-то (или уже
   перетаскивал раньше), applyUiSettings() перекроет этот набор сохранённым. */
/* var, А НЕ let (испр. v1.022, ошибка в консоли: "Cannot access 'PIN_SLOTS_N' before
   initialization"). С v1.021 ярлыки обновляет refreshPinSlotIcons(), и зовёт её в том числе
   render() из fold-2 — а тот успевает отработать РАНЬШЕ, чем выполнится эта строка в fold-5
   (файл грузится последним). Сама функция всплывает как объявление и вызывается нормально, но её
   тело читает pinSlots/PIN_SLOTS_N — у let/const это временная мёртвая зона, то есть исключение.
   Та же причина и то же лекарство, что у patW2Manual/numProbeEl и прочих глобалов, к которым
   render() дотягивается до их строки: объявляем var — оно всплывает вместе с функцией. */
var pinSlots = {
  // "bLayerFocus" убран из слотов в v1.066 вместе с самой кнопкой «◑ Слои».
  L: ["bResetFields", "bMenuBarBottom", "bUndo", "bRedo", null],
  R: ["bToggleResultBox", "bToggleStepLog", "bToggleSelect", "bToggleFieldInfo", null]
};
/* ТОЛЬКО ЗНАЧОК, БЕЗ ТЕКСТА (запрос пользователя: "в слотах надо значки без текста"). Раньше в
   слот копировался innerHTML оригинала целиком — вместе с подписью ("🔒 Выделение", "⌖ Поля на
   место"), и пять таких ярлыков растягивали полосу выравниваний на пол-экрана. Берём ПЕРВОЕ
   "слово" подписи — у кнопок приложения это как раз эмодзи-иконка ("🔗", "⧬+⨁", "↩"), — и режем
   до 4 символов. Подпись целиком остаётся в title, так что что это за кнопка, видно по наведению.
   Пусто (кнопка вообще без текста) — показываем id без служебной первой буквы b/c. */
function pinSlotIcon(src, id){
  const label = ((src && src.textContent) || "").replace(/\s+/g, " ").trim();
  const first = (label.split(" ")[0] || "").trim();
  return Array.from(first || id.replace(/^[bc]/, "")).slice(0, 4).join("");
}
function renderPinSlot(container, side, idx){
  if (!container) return;
  let cell = container.children[idx];
  if (!cell) {
    cell = document.createElement("div");
    cell.className = "align-pin-slot";
    container.appendChild(cell);
  }
  const pinnedId = pinSlots[side][idx];
  cell.innerHTML = "";
  cell.classList.toggle("filled", !!pinnedId);
  if (!pinnedId) { cell.title = "Перетащи сюда любую кнопку приложения — закрепится как ярлык"; return; }
  cell.removeAttribute("title");
  /* ═══ КНОПКИ НЕТ СЕЙЧАС — ЭТО НЕ ЗНАЧИТ, ЧТО ЕЁ НЕТ ВООБЩЕ (испр. v1.292) ═══
     Раньше отсутствие оригинала СТИРАЛО запись из слота («кнопка исчезла/переименована — молча
     снимаем»). Пока в слоты попадали только кнопки из статической разметки, это было безопасно:
     не нашлась — значит и правда удалена.
     С v1.292 закрепить можно и кнопки подвала списка вкладок (#bDdUiSave и соседи), а их
     renderTabs() пересоздаёт целиком — и в момент между стиранием старого innerHTML и вставкой
     нового getElementById честно возвращает null. Прежняя строка на таком кадре молча выбрасывала
     ярлык, и закрепление «само отваливалось» — причём тем вернее, чем чаще перерисовывается список.
     Теперь запись остаётся: рисуем пустую ячейку и ждём. Ближайший renderPinSlots/renderPinSlotIcons
     подхватит кнопку, как только та вернётся в DOM. Настоящее открепление осталось ровно одно и
     оно явное — вытащить значок из слота мышью (см. dragend ниже). */
  const src = document.getElementById(pinnedId);
  if (!src) { cell.classList.remove("filled"); return; }
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = pinSlotIcon(src, pinnedId);
  /* ОТКРЕПЛЯЮТ ПЕРЕТАСКИВАНИЕМ НАРУЖУ, А НЕ КРЕСТИКОМ (v1.018, запрос пользователя: "для кнопок
     закреп не надо крестик-красный, убрать — перемещением вне слота, и всё"). Красный "✕" в углу
     (.pin-remove) убран целиком: он висел поверх маленького значка, перехватывал у него часть
     кликов и в квадратном слоте без отступов (там же, v1.018) закрывал бы сам значок.
     draggable + dataset.pinFrom — за них берётся обработчик dragstart/drop ниже: бросили в другой
     слот — ярлык переехал, бросили мимо слотов — открепился. */
  btn.draggable = true;
  btn.dataset.pinFrom = side + ":" + idx;
  btn.title = "Закреплённая кнопка — " + (src.title || src.textContent || "").trim() +
              ". Перетащи в другой слот — переедет, вытащи наружу — открепится.";
  /* После клика по оригиналу его значок мог смениться (🔓→🔒 и т.п.) — подхватываем это тем же
     кадром, иначе ярлык показывал бы прежнее состояние до ближайшего render(). Многие кнопки
     меняют вид не синхронно, а через свои say()/saveCache(), поэтому ещё и на следующем тике. */
  /* ОРИГИНАЛ ИЩЕМ В МОМЕНТ КЛИКА, А НЕ ЗАПОМИНАЕМ (испр. v1.292). Здесь стояло src.click() — со
     ссылкой, снятой при отрисовке ярлыка. Для статических кнопок узел живёт вечно и разницы нет,
     но кнопки подвала (v1.292) renderTabs() пересоздаёт: захваченный src превращается в оторванный
     от документа узел, click() по нему честно срабатывает и никуда не всплывает — обработчик-то
     делегированный, висит на списке. Со стороны это «ярлык есть, а нажатие ничего не делает».
     Ищем по id заново: id как раз и заведён затем, чтобы кнопку можно было найти после пересоздания. */
  btn.addEventListener("click", e => {
    e.stopPropagation();
    const live = document.getElementById(pinnedId);
    if (!live) { say("Кнопка сейчас недоступна — открой панель, где она живёт, и попробуй снова."); return; }
    live.click();
    refreshPinSlotIcons();
    setTimeout(refreshPinSlotIcons, 0);
  });
  cell.appendChild(btn);
}
function renderPinSlots(){
  const l = document.getElementById("alignPinL"), r = document.getElementById("alignPinR");
  for (let i = 0; i < PIN_SLOTS_N; i++) { renderPinSlot(l, "L", i); renderPinSlot(r, "R", i); }
}
/* ЗНАЧОК ЯРЛЫКА ДОЛЖЕН ЖИТЬ ВМЕСТЕ С ОРИГИНАЛОМ (v1.021, баг-репорт пользователя: "значок замка не
   меняется"). renderPinSlot() снимает с кнопки СЛЕПОК — один раз, в момент закрепления, — а у
   кнопок-переключателей значок меняется по ходу дела: applySelectEnabled() перебивает 🔓 на 🔒,
   и копия в слоте оставалась с прежним. Тут мы обновляем ярлыки ПО МЕСТУ, не пересобирая DOM:
   пересборка (renderPinSlot) в середине перетаскивания уронила бы сам перетаскиваемый узел, а
   зовётся эта функция в том числе из render(), который идёт потоком.
   Заодно переносим на ярлык состояние оригинала (.mode-act/.act/.overlay-on) — тем кнопкам, у
   которых значок от состояния не меняется, иначе включённость по ярлыку не прочитать. */
function refreshPinSlotIcons(){
  // Ранний render() (до строки с pinSlots — см. про var/TDZ там же) застаёт набор ещё
  // необъявленным: var всплывает как undefined. Обновлять тогда нечего — слоты и сами ещё не
  // отрисованы, их наполнит renderPinSlots() чуть позже.
  if (!pinSlots || !PIN_SLOTS_N) return;
  for (const side of ["L", "R"]) {
    const c = document.getElementById(side === "L" ? "alignPinL" : "alignPinR");
    if (!c) continue;
    for (let i = 0; i < PIN_SLOTS_N; i++) {
      const cell = c.children[i];
      const btn = cell && cell.querySelector("button");
      const id = pinSlots[side][i];
      if (!btn || !id) continue;
      const src = document.getElementById(id);
      if (!src) continue;
      const icon = pinSlotIcon(src, id);
      if (btn.textContent !== icon) btn.textContent = icon;
      const on = ["mode-act", "act", "overlay-on"].some(cl => src.classList.contains(cl));
      btn.classList.toggle("pin-on", on);
    }
  }
}
{
  /* CAPTURE, А НЕ BUBBLE (испр. v1.015, баг-репорт "не работает вставка значков") — очень многие
     кнопки/поля приложения гасят mousedown через e.stopPropagation() (протяжки полей, границы,
     панели — весь этот файл ими полон), и делегирование НА BUBBLE до document тогда просто не
     доезжало: draggable вообще не выставлялся, поэтому браузер и не начинал перетаскивание.
     capture идёт СВЕРХУ ВНИЗ, ДО того как событие доберётся до самой кнопки и та успеет вызвать
     свой stopPropagation — не отменить. */
  document.addEventListener("mousedown", e => {
    const btn = e.target.closest("button[id]");
    if (btn && !btn.closest(".align-pin-slots") && btn.getAttribute("draggable") !== "true") {
      btn.setAttribute("draggable", "true");
    }
  }, true);
  /* ДВА ИСТОЧНИКА ПЕРЕТАСКИВАНИЯ (v1.018). Первый, как и раньше, — ЛЮБАЯ кнопка приложения с id:
     это КОПИРОВАНИЕ, оригинал остаётся на своём месте. Второй — сам УЖЕ ЗАКРЕПЛЁННЫЙ значок в
     слоте: это ПЕРЕМЕЩЕНИЕ, и оно же единственный способ открепить (крестик убран, см.
     renderPinSlot). У значков в слотах своего id нет, поэтому отличаем их по dataset.pinFrom
     ("сторона:индекс"), который им проставляет renderPinSlot. */
  let pinDrag = null;   // { id, from } — from: "L:2" или null, если тащат копию из приложения
  document.addEventListener("dragstart", e => {
    const slotBtn = e.target.closest(".align-pin-slots button[data-pin-from]");
    if (slotBtn) {
      const [side, idx] = slotBtn.dataset.pinFrom.split(":");
      pinDrag = { id: pinSlots[side][+idx], from: slotBtn.dataset.pinFrom };
      e.dataTransfer.setData("text/plain", pinDrag.id || "");
      e.dataTransfer.effectAllowed = "move";
      return;
    }
    const btn = e.target.closest("button[id]");
    if (!btn || btn.closest(".align-pin-slots")) return;
    pinDrag = { id: btn.id, from: null };
    e.dataTransfer.setData("text/plain", btn.id);
    e.dataTransfer.effectAllowed = "copy";
  }, true);
  /* БРОСИЛИ МИМО СЛОТОВ — ОТКРЕПИТЬ (v1.018, запрос пользователя: "убрать — перемещением вне слота,
     и всё"). dragend прилетает ВСЕГДА, чем бы перетаскивание ни кончилось, и всегда ПОСЛЕ drop —
     поэтому слот-приёмник успевает погасить pinDrag, и до этой ветки доходят только те броски, что
     ни в один слот не попали. Копию из приложения бросили мимо — просто ничего не произошло. */
  document.addEventListener("dragend", () => {
    if (pinDrag && pinDrag.from) {
      const [side, idx] = pinDrag.from.split(":");
      pinSlots[side][+idx] = null;
      renderPinSlot(document.getElementById(side === "L" ? "alignPinL" : "alignPinR"), side, +idx);
      saveCache();
      say("Значок откреплён — вытащили из слота.");
    }
    pinDrag = null;
    document.querySelectorAll(".align-pin-slot.drag-over").forEach(c => c.classList.remove("drag-over"));
  }, true);
  const wireSlotContainer = (container, side) => {
    if (!container) return;
    container.addEventListener("dragover", e => {
      const cell = e.target.closest(".align-pin-slot");
      if (!cell) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = (pinDrag && pinDrag.from) ? "move" : "copy";
      cell.classList.add("drag-over");
    });
    container.addEventListener("dragleave", e => {
      const cell = e.target.closest(".align-pin-slot");
      if (cell) cell.classList.remove("drag-over");
    });
    container.addEventListener("drop", e => {
      const cell = e.target.closest(".align-pin-slot");
      if (!cell) return;
      e.preventDefault();
      cell.classList.remove("drag-over");
      const id = (pinDrag && pinDrag.id) || e.dataTransfer.getData("text/plain");
      if (!id || !document.getElementById(id)) return;
      const idx = Array.from(container.children).indexOf(cell);
      if (idx < 0) return;
      // Тащили ИЗ слота — он должен опустеть (перемещение, а не размножение). Чистим ДО записи в
      // приёмник: бросок в тот же самый слот тогда просто вернёт значок на место, а не сотрёт его.
      if (pinDrag && pinDrag.from) {
        const [fSide, fIdx] = pinDrag.from.split(":");
        pinSlots[fSide][+fIdx] = null;
        renderPinSlot(document.getElementById(fSide === "L" ? "alignPinL" : "alignPinR"), fSide, +fIdx);
      }
      pinSlots[side][idx] = id;
      renderPinSlot(container, side, idx);
      saveCache();
      pinDrag = null;   // гасим до dragend — иначе тот счёл бы бросок промахом и открепил значок
    });
  };
  /* ═══ ПРИЁМНИК — ВСЯ НУЛЕВАЯ СТРОКА, А НЕ ПЯТЬ КВАДРАТИКОВ (v1.411) ═══
     Запрос пользователя: «убери разметку слотов, пусть приёмником кнопок будет вся 0 строка, и при
     закреплении сдвигает их к меню выравниваний».
     Пустые слоты с этой версии схлопнуты в ноль и невидимы (см. .align-pin-slot в стилях): ряд
     больше не расчерчен пятью рамками с каждой стороны, а закреплённые значки стоят вплотную друг к
     другу и прижаты к кнопкам выравниваний — «сдвигает их к меню» получается само собой, без
     отдельного расчёта.
     Но у схлопнутого слота нулевая ширина, попасть в него броском нельзя. Поэтому приёмником
     становится ВСЯ полоса: бросок мимо слотов кладёт значок в первую свободную ячейку.
     СТОРОНУ ВЫБИРАЕМ ПО КУРСОРУ: бросил в левой половине полосы — ищем слева, в правой — справа.
     Свободных с выбранной стороны нет — пробуем другую, чтобы бросок не пропал впустую.
     Слоты со своими обработчиками остаются: попасть в занятый слот по-прежнему можно, и это
     по-прежнему замена значка, а не добавление. Наш обработчик в такие броски не вмешивается —
     первым делом проверяет, не на слоте ли отпустили. */
  const wireBarAsPinTarget = () => {
    const grp = document.getElementById("alignGrp");
    if (!grp) return;
    const onSlot = (e) => !!(e.target && e.target.closest && e.target.closest(".align-pin-slot"));
    grp.addEventListener("dragover", e => {
      if (onSlot(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = (pinDrag && pinDrag.from) ? "move" : "copy";
      grp.classList.add("pin-drop-on");
    });
    grp.addEventListener("dragleave", e => {
      if (!grp.contains(e.relatedTarget)) grp.classList.remove("pin-drop-on");
    });
    grp.addEventListener("drop", e => {
      grp.classList.remove("pin-drop-on");
      if (onSlot(e)) return;
      e.preventDefault();
      const id = (pinDrag && pinDrag.id) || e.dataTransfer.getData("text/plain");
      if (!id || !document.getElementById(id)) return;
      const r = grp.getBoundingClientRect();
      const order = (e.clientX < r.left + r.width / 2) ? ["L", "R"] : ["R", "L"];
      for (const side of order) {
        const idx = pinSlots[side].indexOf(null);
        if (idx < 0) continue;
        // Тащили ИЗ слота — освобождаем его, как и в обработчике самих слотов: перемещение, а не
        // размножение.
        if (pinDrag && pinDrag.from) {
          const [fSide, fIdx] = pinDrag.from.split(":");
          pinSlots[fSide][+fIdx] = null;
          renderPinSlot(document.getElementById(fSide === "L" ? "alignPinL" : "alignPinR"), fSide, +fIdx);
        }
        pinSlots[side][idx] = id;
        renderPinSlot(document.getElementById(side === "L" ? "alignPinL" : "alignPinR"), side, idx);
        saveCache();
        break;
      }
      pinDrag = null;   // гасим до dragend — иначе тот счёл бы бросок промахом и открепил значок
    });
  };
  /* ═══ ПРИЁМНИК — ВСЁ ПОЛЕ Ц В НУЛЕВОЙ СТРОКЕ (v1.430) ═══
     Запрос пользователя: «закреп кнопки всё так же не по всей полосе можно, пусть по всему полю Ц
     в строке 0».
     В v1.425 цель уже расширяли до всего ряда, но опирались на заливку #bandBg и на её класс .act.
     А .act у заливки стоит, ТОЛЬКО пока активна черта горизонта: нет наложений — нет черты, нет
     заливки, и весь ряд перестаёт принимать броски. Оставалась одна полоса выравниваний шириной по
     своему содержимому — ровно то, на что пользователь и жалуется второй раз.
     Считаем прямоугольник сами и из двух независимых источников:
       ПО ВЕРТИКАЛИ — сама полоса (#alignGrp). Она и ЕСТЬ нулевая строка (ростом в строку с v1.402),
         стоит там всегда и от горизонта не зависит. Заливку берём, только если она уже посчитана
         (.act) и ВЫШЕ полосы — тогда цель заодно захватывает межстрочные просветы соседей, которые
         заливка себе забрала в v1.424.
       ПО ГОРИЗОНТАЛИ — заливка поля цепочки (#fieldBgC): «всё поле Ц», от границы с П1 до своей
         правой границы. Её нет — падаем на всю .chain, чтобы бросок не пропал совсем.
     Сторона слота выбирается по курсору относительно этого же прямоугольника: левее середины поля —
     ищем свободный слот слева, правее — справа; свободных с выбранной стороны нет, пробуем другую.
     Полоса остаётся отдельной целью (wireBarAsPinTarget) — она перехватывает броски прямо в себя,
     и наш обработчик в них не вмешивается. */
  const wireRowZeroAsPinTarget = () => {
    const chainEl = document.getElementById("chain");
    if (!chainEl) return;
    /* Прямоугольник нулевой строки в координатах экрана — или null, если полосы ещё нет. */
    const rowZeroRect = () => {
      const grp = document.getElementById("alignGrp");
      if (!grp || !grp.offsetHeight) return null;
      const g = grp.getBoundingClientRect();
      let top = g.top, bottom = g.bottom;
      const bandEl = document.getElementById("bandBg");
      if (bandEl && bandEl.classList.contains("act")) {
        const b = bandEl.getBoundingClientRect();
        if (b.height > 0) { top = Math.min(top, b.top); bottom = Math.max(bottom, b.bottom); }
      }
      const fldC = document.getElementById("fieldBgC");
      const h = (fldC && fldC.getBoundingClientRect().width > 0)
                  ? fldC.getBoundingClientRect() : chainEl.getBoundingClientRect();
      return { top, bottom, left: h.left, right: h.right };
    };
    const inRowZero = (e) => {
      const r = rowZeroRect();
      return !!r && e.clientY >= r.top && e.clientY <= r.bottom
                 && e.clientX >= r.left && e.clientX <= r.right;
    };
    chainEl.addEventListener("dragover", e => {
      if (e.target.closest && e.target.closest("#alignGrp")) return;   // полоса разбирается сама
      if (!inRowZero(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = (pinDrag && pinDrag.from) ? "move" : "copy";
      const grp = document.getElementById("alignGrp");
      if (grp) grp.classList.add("pin-drop-on");
    });
    chainEl.addEventListener("dragleave", e => {
      if (!chainEl.contains(e.relatedTarget)) {
        const grp = document.getElementById("alignGrp");
        if (grp) grp.classList.remove("pin-drop-on");
      }
    });
    chainEl.addEventListener("drop", e => {
      const grpEl = document.getElementById("alignGrp");
      if (grpEl) grpEl.classList.remove("pin-drop-on");
      if (e.target.closest && e.target.closest("#alignGrp")) return;
      if (!inRowZero(e)) return;
      e.preventDefault();
      const id = (pinDrag && pinDrag.id) || e.dataTransfer.getData("text/plain");
      if (!id || !document.getElementById(id)) return;
      const r = rowZeroRect();
      const mid = r ? (r.left + r.right) / 2 : e.clientX;
      const order = (e.clientX < mid) ? ["L", "R"] : ["R", "L"];
      for (const side of order) {
        const idx = pinSlots[side].indexOf(null);
        if (idx < 0) continue;
        if (pinDrag && pinDrag.from) {
          const [fSide, fIdx] = pinDrag.from.split(":");
          pinSlots[fSide][+fIdx] = null;
          renderPinSlot(document.getElementById(fSide === "L" ? "alignPinL" : "alignPinR"), fSide, +fIdx);
        }
        pinSlots[side][idx] = id;
        renderPinSlot(document.getElementById(side === "L" ? "alignPinL" : "alignPinR"), side, idx);
        saveCache();
        break;
      }
      pinDrag = null;
    });
  };
  renderPinSlots();
  wireSlotContainer(document.getElementById("alignPinL"), "L");
  wireSlotContainer(document.getElementById("alignPinR"), "R");
  wireBarAsPinTarget();
  wireRowZeroAsPinTarget();
}

/* Ширина ПРАВОЙ колонки паттернов — по самому длинному паттерну, чтобы он влезал целиком, а не
   обрезался многоточием (запрос пользователя). Считается тем же шагом столбца, что и биты
   (realColStepPx — ширина символа + letter-spacing), плюс собственные отступы .pat2
   (padding-left:4px + padding-right:28px под бейдж номера шага) и небольшой запас.
   Как только пользователь сам подвинул ручку .vsplit2 — автоподбор отключается (patW2Manual),
   иначе следующий же render() отменил бы ручную ширину. Флаг живёт вместе с самой шириной в
   настройках вида (см. saveCache/applyUiSettings). */
/* ═══ НИЖНИЙ УПОР ШИРИНЫ ПОЛЯ ЦЕПОЧКИ — ОДИН НА ВСЕ ТРИ ПУТИ (v1.285) ═══
   Запрос пользователя: «сделай, чтобы ширина поля цепочек минимум была задана, чтобы вмещалось
   всегда меню выравниваний».
   Такой упор уже был — но только у АВТОПОДБОРА (v1.238/v1.241, см. render() в fold-2-render.js):
   ширина считалась по самой длинной строке и поднималась до ширины полосы, если строка короче.
   Ручную ширину он не сторожил, а ставится она ещё двумя путями — протяжкой #vsplit2
   (makeColResizer, minPx там был 40) и стрелками ←/→ под замком (fold-4-tools.js, тоже 40). Оба
   позволяли ужать поле до 40px, и полоса выравниваний вылезала за него на колонки паттернов.
   Теперь формула одна и живёт здесь, а все три пути её зовут.
   ЧТО ВХОДИТ: сама полоса #alignGrp плюс планки, которые стоят ВНУТРИ поля и полосе места не
   оставляют, — «№» (#axisStrip) и «П1» (#patStripL, она внутри поля с v1.284). Плюс 24px, чтобы
   полоса не липла к планкам вплотную (v1.241).
   Полосы в DOM нет (ранний вызов до первой отрисовки) — отдаём прежние 40px, чтобы не запирать
   ширину нулём и не мешать стартовой раскладке. */
/* СТОРОНЫ ЕЩЁ РАЗ ПОМЕНЯЛИСЬ (v1.288): «П1» ушла ЛЕВЕЕ границы целиком (её кнопки правят колонку
   паттернов и стоят над ней), а «№ строк» вернулась в поле цепочки, над колонкой номеров, которой
   и управляет. Значит внутри поля снова ровно одна планка — «№», и беречь надо её ширину.
   Прежние версии этой строки: v1.285 считала обе, v1.287 — только «П1». Ходить за offsetWidth'ом
   каждой планки поимённо приходится потому, что нижний упор считается ДО раскладки: позиций планок
   на этот момент ещё нет, и мерить наложение, как это делает центровка полосы, тут нечем. */
/* ═══ ПЛАНКА «№» ИЗ УПОРА УБРАНА (испр. v1.416) ═══
   Баг-репорт: «также прыгает, когда вкл номера, а с 10-ных в 2-ные норм».
   Вот откуда прыжок. Сюда входила ширина планки «№», а с v1.415 кнопка в ней РАВНА просвету под
   номера — то есть меняется при каждом включении. Через этот упор она меняла нижнюю границу
   --bits-w, а когда поле стоит на минимуме (короткая цепочка), нижняя граница и есть его ширина:
   поле раздавалось вправо, и с ним уезжало всё, что правее. Между «10-ными» и «2-ными» разница в
   ширине меньше, и на глаз это не всегда заметно — отсюда «а с 10-ных в 2-ные норм».
   Планке тут и не место: она стоит НАД КОЛОНКОЙ НОМЕРОВ, а та лежит СНАРУЖИ .bits, левее его
   левого края. Место внутри поля ей не нужно и никогда не было нужно — в v1.288 её записали сюда
   заодно с «П1», которая тогда действительно стояла внутри.
   Остаётся полоса выравниваний: она и правда стоит над полем и ужимать поле уже её ширины нельзя. */
function minBitsWidthPx(){
  const g = document.getElementById("alignGrp");
  if (!g || !g.offsetWidth) return 40;
  return Math.round(g.offsetWidth + 24);
}
/* ═══ ВЕРХНИЙ УПОР ШИРИНЫ ПОЛЯ ЦЕПОЧКИ (v1.368) ═══
   Запрос пользователя: «ширину Ц не позволять делать шире, чем самая широкая строка» — и не менее
   средней части меню 2, то есть той же полосы выравниваний, что сторожит minBitsWidthPx() выше.
   Нижний упор был давно, верхнего не было вовсе: поле растягивалось сколько угодно, и справа от
   бит открывалось пустое место, которое ничем не занято и ни на что не влияет — только уводит ось
   и границу от самой картинки.
   Потолок — ровно ширина самой длинной строки в столбцах: дальше показывать нечего.
   ПОЛ ВАЖНЕЕ ПОТОЛКА. На короткой цепочке (две-три строки по паре бит) ширина по строкам выходит
   меньше полосы выравниваний, и один упор противоречил бы другому. Берём наибольшее из двух —
   тогда полоса всегда помещается, а «не шире строк» соблюдается везде, где эти два требования
   вообще совместимы.
   Считаем по ДАННЫМ (st.rows), а не по отрисованному DOM: при виртуализации в разметке лежит лишь
   окно видимости, и самая длинная строка может быть за его пределами. Та же причина и та же
   формула, что у автоподбора --bits-w в render(). */
/* ═══ ПОТОЛОК СНЯТ (v1.449) ═══
   Запрос пользователя: «макс ширина Ц — отключи ограничение».
   Правило «не шире самой длинной строки» (v1.368, разбор выше оставлен как история) мешало там,
   где пустое место справа от бит нужно намеренно: раздвинуть поле под будущие строки, отвести ось
   от картинки, подвести её к середине экрана. Нижний упор остаётся — под полосой меню 2 место
   обязано быть всегда, иначе она вылезает за своё поле.
   Функцию не удаляю, а обесточиваю: её зовут оба пути изменения ширины (протяжка ручки #vsplit2 в
   fold-5-ui.js и стрелки в fold-4-tools.js), и оба ждут число. Вернуть потолок — снять эту строку,
   тело под ней целое. */
function maxBitsWidthPx(){
  return Infinity;
  /* eslint-disable no-unreachable */
  let maxLen = 0;
  for (const s of (st.rows || [])) { const n = s ? s.length : 0; if (n > maxLen) maxLen = n; }
  const step = (typeof realColStepPx === "function" ? realColStepPx() : 0) || 8;
  return Math.max(minBitsWidthPx(), Math.round(maxLen * step));
}
/* Позиции вертикальных разделителей .vsplit/.vsplit2 — по РЕАЛЬНОЙ геометрии колонок, а не по
   CSS-формуле от краёв .chain. Формула работала, пока строка всегда была ровно шириной с полотно;
   теперь строка может быть ШИРЕ него (колонки паттернов раздвинуты ручками, включается
   горизонтальная прокрутка — см. .bits/--bits-w), и правый разделитель, отмеренный от правого
   края .chain, уезжал далеко от самой колонки паттернов (запрос пользователя "уехала верт.
   граница у правых паттернов"). Меряем по первой реальной строке: правый край .pat и левый край
   .pat2 — это и есть стыки, где линии должны стоять. */
/* ═══ ПРОСВЕТ ПОД КОЛОНКУ НОМЕРОВ — ОДНО ЧИСЛО, СЧИТАЕТСЯ ДО РАСКЛАДКИ СТРОК (v1.420) ═══
   Запрос пользователя: «при увеличении ширины номеров влево должна сдвигать биты и номера у П1,
   чтобы также было видно правую их часть».
   Сдвиг этот делает поправка на переполнение в render() (v1.352/1.361): она сравнивает содержимое
   ячейки с ВИДИМОЙ шириной П1, а та равна --pat-w минус просвет. Значит просвет обязан быть
   посчитан ДО того, как строки разложены, — иначе поправка берёт вчерашнее число и отстаёт на
   кадр: колонка номеров уже шире, а биты П1 ещё не сдвинуты.
   Раньше расчёт жил внутри updateSplitPositions, а та зовётся ПОСЛЕ отрисовки строк. Выносим его
   функцией и зовём из двух мест: из render() сразу за fitNumW (там уже известна ширина номера) и,
   как и прежде, из updateSplitPositions — на случай вызовов помимо render (протяжка границ,
   переключение окна «ℹ Поле»). Вызов идемпотентный: одни и те же входные данные дают то же число.
   СЧИТАЕМ ОДНО ЧИСЛО НА ВСЁ — wantSpace, просвет между стыком с П1 и началом бит:
     номера показаны — ширина самой колонки плюс зазор строки;
     скрыты окном «ℹ Поле» — ноль, поле цепочки забирает место себе.
   Из него следует --numl-slot (минус зазор): по нему .pat отдаёт ширину, то есть поле Ц растёт
   влево за счёт П1, а биты стоят.
   Нижний упор в два бита — на первый кадр, пока номер ещё не измерен: нулевая ширина колонки на
   кадр дала бы скачок раскладки.
   Петли нет: wantSpace считается от --numl-w (её меряет fitNumW по тексту номера) и от шага
   столбца; ни то, ни другое от --numl-slot не зависит. */
function syncNumSlot(){
  const rootSt = document.documentElement;
  const csRoot = getComputedStyle(rootSt);
  const gapNum = parseFloat(csRoot.getPropertyValue("--row-gap")) || 8;
  const stepNum = parseFloat(csRoot.getPropertyValue("--split-w")) || 8;
  const numlWNow = parseFloat(csRoot.getPropertyValue("--numl-w")) || 0;
  const numsOff = document.body.classList.contains("hide-rownums");
  const wantSpace = numsOff ? 0 : Math.max(stepNum * 2, numlWNow + gapNum);
  rootSt.style.setProperty("--numl-slot", Math.max(0, wantSpace - gapNum).toFixed(2) + "px");
  /* Кнопка «№» с v1.419 скрыта, но ширину ей по-прежнему ставим: правило display:none снимается
     одной строкой, и вернувшаяся кнопка должна сразу встать в свой просвет, а не в старое число. */
  const numBtnSlot = document.getElementById("bAxisRowNum");
  if (numBtnSlot) {
    numBtnSlot.style.width = wantSpace.toFixed(2) + "px";
    numBtnSlot.style.minWidth = wantSpace.toFixed(2) + "px";
  }
}
function updateSplitPositions(){
  const chainEl = document.getElementById("chain");
  if (!chainEl) return;
  const row = document.querySelector("#rows .ln") || document.querySelector(".chain-head");
  if (!row) return;
  /* ═══ ВСТАВКА СТОЛБЦА НОМЕРОВ — ЗА СЧЁТ ЛЕВОЙ СТОРОНЫ (v1.317) ═══
     Запрос пользователя: «вставка номеров цепочек — пусть сдвигает всё слева от себя, чтобы
     вставиться». Само правило — margin-left у .ln/.col-hdr-row/.chain-head, см. --rownum-ins в
     CSS; здесь считается только величина.
     СКОЛЬКО СТОЛБЕЦ ЗАНИМАЕТ. Не его ширина, а ширина ПЛЮС зазор строки: .ln — флексбокс с
     gap:8px, и вместе со скрытым столбцом (body.hide-rownums ставит ему display:none) из
     раскладки уходит и один зазор. Зазор не берём константой из CSS, а меряем как расстояние от
     правого края колонки точек до левого края столбца, — тот же приём и по той же причине, что в
     v1.316: складывать отступы и gap'ы формулой я уже пробовал, и каждый раз чего-нибудь не
     хватало.
     ПЕТЛИ ОБРАТНОЙ СВЯЗИ НЕТ. Отступ двигает точку и столбец ОДИНАКОВО, поэтому и ширина, и
     расстояние между ними от него не зависят: следующий замер даёт то же число, что и прошлый.
     СТОЛБЦА НЕТ (режим «№ —» или окно «ℹ Поле») — ширина нулевая, вставка нулевая, строка стоит
     ровно там же, где стояла до этой правки. Кэшировать прошлое значение, как для кнопки «№»,
     тут нельзя и не нужно: вставки в раскладке действительно нет.
     Считаем ДО первого getBoundingClientRect ниже: границы, заливки и планки меряются по живым
     коробкам, и им нужна уже сдвинутая строка. Чтение рект сразу после записи стиля само заставит
     браузер пересчитать раскладку.
     ═══ ЭТО ОПИСАНИЕ ИСТОРИЧЕСКОЕ (v1.342) ═══ Кода, который тут описан, больше нет: и сам замер,
     и переменная --rownum-ins удалены, место под номера теперь открыто постоянным слотом прямо в
     CSS. Текст оставлен затем, чтобы следующий читатель не завёл ту же вставку заново: подход
     рабочий, но величина в нём подвижная, и на этом он и сломался — разбор ниже. */
  /* ═══ ЗАМЕР ВСТАВКИ УДАЛЁН ЦЕЛИКОМ (v1.342) ═══
     Здесь с v1.317 жила величина --rownum-ins: сколько места занимает столбец номеров, чтобы
     ровно на столько отступить влево и удержать поле цепочки на месте. К ней с v1.333 добавился
     резерв под кнопку --num-btn-res, с v1.340 — вычет из ширины П1. Правило за правилом, и каждое
     верное само по себе; беда была в том, что ВЕЛИЧИНА оставалась подвижной — она мерилась по
     текущей подписи номеров, а та у каждого режима своя. Отсюда четыре подряд баг-репорта
     «двигается всё» с четырьмя разными адресатами.
     Теперь двигаться нечему по построению: колонка номеров всегда шириной в постоянный слот
     (--numl-slot, см. .num-l2 в стилях), П1 отдаёт ровно этот слот плюс зазор (см. .pat там же), а
     режим «№10 / №01 / №—» меняет только текст внутри уже открытого места. Ни одной величины,
     зависящей от режима, в раскладке не осталось — значит и считать здесь нечего.
     ЕДИНСТВЕННОЕ, ЧТО ОСТАЛОСЬ ОТ БЛОКА: слот не должен быть уже кнопки «№», которая стоит над
     колонкой и прижата правым краем к началу бит. Ширина у кнопки постоянная (min-width в CSS,
     v1.334), поэтому подпорка срабатывает разово и себя не раскачивает: слот от кнопки не зависит,
     кнопка от слота — тоже. */
  /* ═══ КНОПКА «№» И ПРОСВЕТ ПОД НОМЕРА — ОДНА ВЕЛИЧИНА (v1.415) ═══
     Запрос пользователя: «кнопка № должна стоять своей левой границей выровненной по левой Ц; при
     нажатии она увеличивает свою ширину и соответственно ширину поля Ц влево, не двигая свою
     правую границу — таким образом сместится только то, что левее правой границы кнопки».
     Это снимает всю прежнюю возню с постоянным слотом (v1.337/1.342). Там я держал просвет
     неподвижным, чтобы ничего не ездило; здесь сказано прямо: ездить МОЖНО и НУЖНО, но только
     влево от правого края кнопки. А правый край и так неподвижен — он прибит к началу бит (v1.333),
     и биты не двигаются ни от чего.
     СЧИТАЕМ ОДНО ЧИСЛО НА ВСЁ: wantSpace — просвет между стыком с П1 и началом бит.
       номера показаны — ширина самой колонки плюс зазор строки;
       выключены       — минимум под кнопку, чтобы «№» осталось видно и нажимаемо.
     Из него следуют обе величины:
       --numl-slot (минус зазор) — по нему .pat отдаёт ширину, то есть поле Ц растёт ВЛЕВО за счёт
                                   П1, а биты стоят;
       ширина кнопки            — ровно wantSpace, поэтому её левый край совпадает с левым краем
                                   поля, а правый остаётся на месте.
     Минимум — два бита, как у кнопок меню 2 (v1.410): величина от режима не зависит, значит в
     выключенном состоянии кнопка не дёргается.
     Петли нет: wantSpace считается от --numl-w (её меряет fitNumW по тексту номера) и от шага
     столбца; ни то, ни другое от ширины кнопки и от --numl-slot не зависит. */
  syncNumSlot();
  /* ═══ ШИРИНА ГРАНИЦЫ — РОВНО ОДИН БИТ (v1.354) ═══
     Запрос пользователя: «пусть границы будут шириною в один бит… ну то есть как шрифт чтоб».
     Пять пикселей (v1.349) были числом из воздуха: при крупном кегле граница выглядела ниткой, при
     мелком — жирной полосой. Шаг столбца — та самая величина, что задаёт ширину бита на экране, и
     считается он от кегля и межбуквенного (realColStepPx), то есть едет вместе с ползунками «A» и
     «интервал» сам.
     Отдаём его в CSS переменной: саму полосу рисует ::before у каждой ручки (см. --split-w в
     стилях), и ширину ей больше не приходится держать числом. Отсюда же ею пользуются отступы
     соседей — колонки номеров и П2, — чтобы глифы не залезали под полосу при любом кегле.
     Шага ещё нет (первый кадр до отрисовки бит) — переменную не трогаем, работает её запасное
     значение из :root. */
  {
    const stepForSplit = (typeof realColStepPx === "function") ? realColStepPx() : 0;
    if (stepForSplit > 0) {
      document.documentElement.style.setProperty("--split-w", stepForSplit.toFixed(2) + "px");
    }
  }
  const cr = chainEl.getBoundingClientRect();
  const v1 = document.getElementById("vsplit"), v2 = document.getElementById("vsplit2"), v3 = document.getElementById("vsplit3");
  const patEl = row.querySelector(".pat"), pat2El = row.querySelector(".pat2"), bitsEl = row.querySelector(".bits");
  /* ═══ ЛИНИЯ ИДЁТ ТОЧНО ПО СТЫКУ ПОЛЕЙ (v1.330) ═══
     Запрос пользователя: «границы полей — там отступы убери», «чтобы точки были прямо в границе
     толщины».
     Ручка .vsplit шириной 5px, а сама линия — её ::before на left:2px. Пока сюда писали
     «край + 1», линия приходилась на край + 3: между стыком заливок и линией оставались три
     пикселя, и точка, стоящая ровно на стыке, в границу не попадала.
     Пишем «край − 2»: ::before встаёт ровно на измеренный край, а пятипиксельная зона захвата
     садится на него симметрично — то есть ведёт себя так же, как #vsplitL0, про которую это было
     сказано в комментарии ниже ещё в v0.986.
     ТРИ ГРАНИЦЫ ПРАВЯТСЯ ОДИНАКОВО. Смещение у них общее (одна и та же CSS-разметка ручки), и
     оставить хоть одну на прежней формуле значило бы получить поля, у которых левая и правая
     границы стоят по разным правилам. */
  // П1 | Цепочки — граница по правому краю левой колонки паттернов.
  if (v1 && patEl && !document.body.classList.contains("hide-pat-l")) {
    v1.style.left = (patEl.getBoundingClientRect().right - cr.left - 2) + "px";
    v1.style.right = "auto";
  }
  // ВНЕШНИЙ край П1 (v0.986) — по ЛЕВОМУ краю той же колонки. Зона захвата 11px (см. CSS)
  // центрируется на самой границе, а не прижимается к ней одним краем, как у остальных трёх —
  // снаружи П1 больше нет соседнего поля, которое отъело бы половину места под руку.
  const v0 = document.getElementById("vsplitL0");
  if (v0 && patEl && !document.body.classList.contains("hide-pat-l")) {
    /* v1.330: было −5, то есть линия (::before на left:2px) приходилась на край поля минус 3 — от
       П1 она отстояла ровно так же, как остальные три от своих полей, и по той же причине.
       Теперь −2: линия ложится ровно на левый край колонки, а зона захвата — симметрично на него,
       как и обещал комментарий выше. */
    /* ═══ РУЧКА НЕ УХОДИТ ЗА ОБРЕЗ ХОЛСТА (испр. v1.339) ═══
       Баг-репорт: «граница не тянется мышью… левой, которая слева от П1, её нет вообще, пропала».
       Строка отступает влево на вставку (--rownum-ins), и вместе с ней уезжает левый край колонки
       П1 — а эта ручка стоит ровно на нём. Слева от холста прокрутки нет (.canvas обрезает всё, что
       левее, см. разбор у --rownum-ins в стилях), поэтому ушедшая туда ручка не просто не видна —
       её нечем и достать. Опасность была заведена ещё в v1.317 и там же названа, но пока вставка
       равнялась ширине столбца номеров, до края обычно не доставало. С v1.337 просвет держится
       постоянным и по САМОМУ ШИРОКОМУ, двоичному номеру — сдвиг стал заметно больше и постоянным,
       и ручка ушла под кромку насовсем.
       Прижимаем её к видимому краю холста, когда иначе она вышла бы за него. Ручка остаётся на
       своём месте, пока место есть (правило v1.330 в силе), и липнет к кромке, только когда
       альтернатива — исчезнуть. Схватив её там, раскладку можно вернуть вправо, как и задумано:
       именно эта ручка двигает всю картинку (chainShiftCols).
       Меряем сам холст, а не берём ноль: у .chain есть свой padding-left и ручка #vsplitL0 могла
       быть сдвинута вправо через --chain-shift-x — ноль в координатах .chain кромке холста не
       равен. */
    const canvasForV0 = chainEl.closest(".canvas") || document.querySelector(".canvas");
    const minLeftV0 = canvasForV0
      ? (canvasForV0.getBoundingClientRect().left - cr.left + 1) : 0;
    const wantLeftV0 = patEl.getBoundingClientRect().left - cr.left - 2;
    v0.style.left = Math.max(minLeftV0, wantLeftV0) + "px";
    v0.style.right = "auto";
  }
  // Цепочки | П2 — по правому краю поля битов (если правая колонка скрыта, всё равно показываем
  // границу: ею тянут ширину среднего столбца).
  if (v2 && bitsEl) {
    v2.style.left = (bitsEl.getBoundingClientRect().right - cr.left - 2) + "px";   // v1.330: см. #vsplit выше
    v2.style.right = "auto";
  }
  /* ═══ ПРАВАЯ ГРАНИЦА П2 ПРИБИТА К КРАЮ ХОЛСТА (v1.386) ═══
     Запрос пользователя: «граница П2 правая — прижми и не двигай её, ширина П2 задаётся границей
     слева».
     Раньше она стояла по правому краю самой колонки и ею же эту колонку и тянули. Теперь у неё
     одна роль — КРАЙ ПОЛОТНА: стоит у правой кромки холста и не двигается вовсе, а ширину П2 задаёт
     соседняя граница Ц|П2 — куда её поставили, оттуда П2 и начинается, и тянется до края.
     ШИРИНУ СЧИТАЕМ ЗДЕСЬ ЖЕ, а не оставляем автоподбору: --pat-w2 теперь не «под самый длинный
     паттерн», а «от стыка с цепочкой до кромки». Пишем её каждым проходом — тогда колонка сама
     держится за край при изменении размера окна, прокрутке и любой протяжке соседней границы.
     Петли нет: величина считается от края холста и от правого края БИТ, а ни то, ни другое от
     --pat-w2 не зависит (у .bits своя ширина и свой нижний упор).
     Кромку берём у холста, а не у окна: холст и есть видимая область раскладки, у него свои поля,
     и «правый край браузера» на глаз — это он.
     Колонка скрыта (hide-pat-r) — не трогаем ни ширину, ни ручку: показывать нечего. */
  if (v3 && pat2El && bitsEl && !document.body.classList.contains("hide-pat-r")) {
    /* ═══ КРОМКУ БЕРЁМ У .chain, А НЕ У ВИДИМОЙ ОБЛАСТИ (испр. v1.386 → v1.387) ═══
       Баг-репорт: «скролл даёт двигать эту границу, увеличивая ширину».
       Петля, и целиком моя. В v1.386 кромка считалась как «правый край холста НА ЭКРАНЕ минус
       левый край .chain на экране». Второе слагаемое при горизонтальной прокрутке уходит в минус,
       значит кромка росла вместе с прокруткой; от неё росла ширина П2, от ширины — прокручиваемая
       область, от неё снова прокрутка. Каждое движение мыши добавляло виток — на глаз «граница
       едет и колонка пухнет».
       Берём величину, которой прокрутка не касается: clientWidth самой .chain. Она равна ширине
       ВИДИМОЙ области раскладки (у .chain width:100%, то есть ровно содержимое холста) и от
       scrollLeft не зависит вовсе. Заодно исчезает подгонка «−14 на поля холста»: клиентская
       ширина их уже не включает.
       Координата сразу в системе .chain — в ней же считаются left у всех её абсолютных детей,
       переводить ничего не нужно. */
    /* ═══ КРОМКА — ПО ПРАВОМУ КРАЮ ОКНА, А НЕ ПО КРАЮ .chain (испр. v1.387 → v1.394) ═══
       Баг-репорт: «граница П2 правая неверная, ушла от права браузера».
       clientWidth у .chain (v1.387) прокрутке действительно не поддаётся, но кончается .chain НЕ у
       края окна: у холста своё правое поле, своя рамка, а справа ещё и вертикальный ползунок во всю
       высоту окна. На всю эту сумму граница и отставала от кромки.
       Считаем от ОКНА, но только по величинам, которых прокрутка не касается:
         • левый край .chain в раскладке — offsetLeft внутри холста плюс место самого холста на
           экране; offsetLeft отсчитывается от позиционированного предка и от scrollLeft не зависит,
           а холст сам не прокручивается — он и есть прокрутчик;
         • ширина окна;
         • ширина правого ползунка, когда он показан (иначе граница уйдёт под него).
       Разность даёт координату кромки прямо в системе .chain, где и живут все left у её абсолютных
       детей. Петли, из-за которой правилась v1.387, здесь нет: ни одно слагаемое не зависит ни от
       прокрутки, ни от ширины П2. */
    const canvasEdgeEl = chainEl.offsetParent || chainEl.closest(".canvas");
    const vScrollREl = document.getElementById("vScrollR");
    const vScrollRW = (vScrollREl && vScrollREl.classList.contains("on")) ? vScrollREl.offsetWidth : 0;
    const chainLeftInLayout = canvasEdgeEl
      ? (canvasEdgeEl.getBoundingClientRect().left + chainEl.offsetLeft)
      : 0;
    /* ═══ ГРАНИЦА ПРИБИТА К ОКНУ И НЕ ЕДЕТ ВОВСЕ (v1.397) ═══
       Ответ пользователя на прямой вопрос: «всегда у края окна, не едет совсем».
       Вот в чём была причина трёх промахов подряд. Ручка лежит ВНУТРИ .chain, а та прокручивается
       вместе с холстом: какую координату ей ни посчитай, при горизонтальной прокрутке она уедет
       вместе со всем остальным. «У края окна» и «внутри прокручиваемого» — несовместимы, и
       переставлять число было бесполезно.
       Вынимаем ручку из прокрутки: position:fixed по правому краю ОКНА (правило в стилях), а здесь
       ставим только отступ — на ширину правого ползунка, чтобы граница не ушла под него. Теперь она
       стоит как рамка окна и не двигается ни от прокрутки, ни от ширины полей.
       ШИРИНА П2 СЧИТАЕТСЯ ПО-ПРЕЖНЕМУ до этой же вертикали (edgeRX ниже): при непрокрученном холсте
       колонка ровно доходит до границы, а прокрутили — уезжает под неё, как и всё остальное. Это
       прямо и просили: «П2 при этом может уезжать под неё». */
    v3.style.left = "auto";
    v3.style.right = (vScrollRW + 2) + "px";
    const edgeRX = Math.max(0, window.innerWidth - chainLeftInLayout - vScrollRW - 2);
    const bitsRX = bitsEl.getBoundingClientRect().right - cr.left;
    const wantW2 = Math.max(40, edgeRX - bitsRX);
    document.documentElement.style.setProperty("--pat-w2", Math.round(wantW2) + "px");
    // Координата в системе .chain ручке больше не ставится (v1.397): она position:fixed и стоит
    // по правому краю окна, см. присваивание right выше.
  }
  /* ПЛАНКИ ПОЛЕЙ П1/П2 — ПРИБИТЫ К ГРАНИЦАМ (v1.081, запрос пользователя: "пусть кнопки будут
     фиксированы у границ П1 и П2"). Раньше их ставила updatePatFieldHandles() от ручек-осей
     крайних полей — тех ручек больше нет (см. комментарий в разметке), да и цеплялись они за
     ГЛИФЫ паттернов, то есть планка ездила вслед за длиной самого длинного паттерна.
     Теперь точка отсчёта — сама граница, та же, что только что выставлена выше: планка П1
     кончается ровно у своей границы (левый край = граница минус ширина планки), планка П2 с её
     границы начинается. Обе смотрят ВНУТРЬ, к цепочке, и стоят на одной высоте с планкой оси.
     Ширина планки известна только после отрисовки, поэтому offsetWidth, а не CSS. */
  /* ПО ВЕРТИКАЛИ — НАД ВЕРХНЕЙ ЧЕРТОЙ ПОЛЯ (v1.085, запрос пользователя: "кнопки подними выше за
     горизонт линию границу поля"). Раньше планки садились сразу под линейку столбцов и налезали на
     черту #hsplitTop, идущую по верху #rows. Ставим их так же, как планку оси: низ планки на 3px
     ВЫШЕ этой черты, откуда бы та ни пришлась. Высота планки известна только после отрисовки,
     поэтому offsetHeight, а не число в CSS. */
  const rowsTopForStrips = (() => {
    const r = document.getElementById("rows");
    return r ? (r.getBoundingClientRect().top - cr.top) : 0;
  })();
  /* ПЛАНКИ СТОЯТ НА СТРОКЕ ПОЛОСЫ ВЫРАВНИВАНИЙ (v1.265, запрос пользователя: «П1 и П2 — на одной
     полосе, что и меню выравниваний»). Раньше они считали своё место от строк и садились у самой
     первой из них, то есть этажом ниже полосы: та с v1.262 висит на черте горизонта, у верхней
     кромки ряда. Теперь берём верх у самой полосы — где бы она ни оказалась, планки на её линии.
     Полосы на экране нет (не отрисовалась) — прежний отсчёт от строк. */
  /* ═══ ПЛАНКИ СЧИТАЮТСЯ ОТ ЧЕРТЫ, А НЕ ОТ КОРОБКИ ПОЛОСЫ (испр. v1.274) ═══
     Баг-репорт: «прыгают кнопки при перемещении, отделяются от полоски выравниваний».
     В v1.265 планки брали верх У САМОЙ ПОЛОСЫ — читали её getBoundingClientRect(). Но полосу
     двигает другой проход (layoutOverlayBoxes, а с v1.244 ещё и следующим кадром), и в момент,
     когда считаются планки, её коробка нередко ещё на старом месте: планки садились по вчерашней
     позиции и на кадр отставали — на глаз это и есть «прыгают и отделяются».
     Теперь у них та же формула, что и у полосы (v1.262): черта горизонта плюс 3px. Черта одна на
     всех, стоит в разметке заранее, и её значение не зависит от того, чей проход успел первым, —
     планки и полоса совпадают по определению, даже если обе на кадр отстают.
     Черты нет (пустая цепочка) — прежний отсчёт от верха строк. */
  const hLineForStrips = document.getElementById("hsplitTop");
  const alignBarTop = (hLineForStrips && hLineForStrips.classList.contains("act"))
    ? ((parseFloat(hLineForStrips.style.top) || 0) + 0) : null;   /* v1.403: полоса и планки садятся РОВНО на черту — она же верх нулевой строки, которую меню 2 теперь и занимает. Прежние +3 были зазором под разрыв, его больше нет. */
  const placeStrip = (stripId, edgeEl, side, centerX) => {
    const strip = document.getElementById(stripId);
    if (!strip) return;
    /* Ранний выход «планка в полосе» (v1.357) отсюда УБРАН в v1.365 вместе с самим переездом:
       планки снова плавающие и снова считают себе место здесь. Проверка оставлена бы мёртвой —
       parentElement у них теперь .chain, — а мёртвая проверка на горячем пути только сбивает с
       толку следующего читателя. */
    if (!edgeEl) { strip.classList.remove("act"); return; }
    strip.classList.add("act");
    const edge = edgeEl.getBoundingClientRect().right - cr.left;
    strip.style.top = (alignBarTop !== null ? alignBarTop
                       : (rowsTopForStrips - (strip.offsetHeight || 22) - 3)) + "px";
    /* ОБЕ ПЛАНКИ — ОТ КРАЯ СВОЕЙ КОЛОНКИ, ВПРАВО (v1.272, запрос пользователя «поставь так же, как
       П2»). «П2» всегда так и стояла: начинается у границы поля цепочки и идёт вправо, вглубь
       своей колонки. «П1» же прижимали правым краем к той же границе — то есть выкладывали справа
       налево, — и на узкой колонке она уезжала за левый край холста: оставалась одна подпись, а
       кнопки обрезались (v1.268 их только придерживала у нуля, но совпадения с «П2» это не давало).
       Теперь «П1» начинается у ЛЕВОГО края своей колонки и тоже идёт вправо. Обе планки читаются
       одинаково — подпись, за ней кнопки, — и ни одна не зависит от ширины колонки. */
    /* ОБЕ ПЛАНКИ — У ГРАНИЦЫ С ЦЕПОЧКОЙ (v1.279, запрос пользователя «перемести на границу П1 и
       цепочек»). Граница одна и та же: правый край колонки П1 и левый край поля цепочки. «П2»
       стоит от своей границы вправо, «П1» — от этой же границы влево, то есть прижимается к ней
       правым краем: обе смотрят на цепочку, как и подписи полей.
       В v1.272 «П1» ставили от левого края её колонки — тогда она не обрезалась на узкой колонке,
       но и от границы отходила. Возврат к границе безопасен: ниже стоит зажим по нулю (v1.268),
       и на узкой колонке планка просто упирается в левый край холста, а не уезжает за него. */
    /* ═══ «П1» ПЕРЕЕХАЛА ЗА ГРАНИЦУ, НА МЕСТО «№» (v1.284) ═══
       Запрос пользователя: «смести вправо [№] и вставь в освободившееся место П1».
       В v1.279 «П1» прижимали к границе СЛЕВА (правым краем), и на бумаге они с «№» выходили
       соседями. На деле нет: своя колонка у «П1» бывает уже самой планки, и зажим по нулю ниже
       упирал её в левый край холста — до «№» оставалась дыра во всю колонку.
       Теперь обе планки выкладываются ОТ границы ВПРАВО, в поле цепочки, где места всегда хватает:
       «П1» садится ровно туда, где до сих пор начиналась «№» (patEl.right + 1, см. v1.282), а «№»
       отступает за неё на её же ширину — расчёт в updateAxisSplitPosition ниже. Ширина колонки
       больше ни на что не влияет, и планки соседи при любом её размере.
       Зажим по нулю оставлен, но теперь он мёртвый: правее границы отрицательных left не бывает. */
    /* ═══ ПОРЯДОК ПЛАНОК: СНАЧАЛА «№», ЗА НЕЙ «П1» (v1.285) ═══
       Запрос пользователя: «сдвинь [№] влево от П1».
       В v1.284 первой у границы стояла «П1», и «№» отступала на её ширину. Меняем их местами:
       у границы снова «№» (как в v1.282, где её левый край и просили посадить на эту линию), а
       «П1» уходит правее на ширину «№». Обе по-прежнему справа от линии и вплотную друг к другу —
       переехал только порядок.
       Ширину «№» берём offsetWidth'ом по той же причине, что и в v1.284 наоборот: планка оси
       ставится своим проходом (updateAxisSplitPosition), и её живая коробка на этом кадре может
       быть ещё не подвинута, а собственная ширина — величина сегодняшняя. */
    /* ═══ «П1» — НА САМОЙ ЛИНИИ, «№» УШЛА ЛЕВЕЕ (v1.287) ═══
       Запрос пользователя: «П1 должен быть на чёрной линии, границе, где проходит П1 и Ц, а „№ и ⇥“
       левее от П1, на поле паттернов».
       Отступ на ширину «№», заведённый в v1.285, снят: «П1» снова начинается ровно на границе
       (patEl.right + 1) и идёт вправо, в поле цепочки. Соседка теперь не справа, а слева от линии —
       её расчёт в updateAxisSplitPosition ниже.
       За три версии планки успели постоять во всех сочетаниях: «П1» слева от линии, «№» справа
       (v1.282), обе справа в порядке П1→№ (v1.284) и №→П1 (v1.285). Итог — по разные стороны
       линии: «П1» подписывает поле цепочки, «№» висит над колонкой паттернов, и ни одна не отнимает
       места у другой при любой ширине колонки. */
    /* ═══ «П1» СНОВА ПРИЖАТА К ЛИНИИ ПРАВЫМ КРАЕМ (v1.288) ═══
       Запрос пользователя: «слева от П1 № паттернов, и потом выравнивание левее ↔ — кнопки».
       Порядок внутри планки перевёрнут в разметке (⇤, № 10, П1), и чтобы подпись «П1» осталась НА
       линии, планку надо выкладывать справа налево — то есть прижимать к границе правым краем, как
       было до v1.284. Обе кнопки тогда уходят влево, вглубь колонки паттернов, ровно как просили.
       Зажим по нулю (ниже) тут снова рабочий, а не декоративный: колонка бывает уже планки. */
    /* ═══ ЗАЗОР ДО ЛИНИИ — ОДНО ЧИСЛО НА ОБЕ ПЛАНКИ (v1.289) ═══
       Запрос пользователя: «равняй».
       Сами линии стоят не на краях колонок, а на пиксель правее: #vsplit на patEl.right + 1,
       #vsplit2 на bitsEl.right + 1 (см. начало этой функции). Считаем зазор ОТ ЛИНИИ, а не от края
       колонки, — тогда «одинаково» видно прямо в формуле, а не выводится из двух разных констант.
       Прежние 2px слева и 4px справа как раз и давали по 3px от линии, то есть зеркало было верным
       и до этой правки; теперь оно ещё и читается как зеркало. */
    /* ═══ ОБЕ ПЛАНКИ МЕРЯЮТСЯ ОТ ПОЛЯ ЦЕПОЧКИ (испр. v1.290) ═══
       Баг-репорт: «надо сдвинуть все кнопки, чтобы П1 на чёрном фоне оказалась — смотри, как сейчас
       П2 на чёрном фоне уже».
       Вот она, причина всей возни последних версий. «П2» с самого начала привязана к bitsEl —
       к ПОЛЮ ЦЕПОЧКИ (см. вызов ниже), и её подпись садится сразу за его правым краем, на колонки
       точек и номеров строк. «П1» же привязывали к patEl, к КОЛОНКЕ ПАТТЕРНОВ, и её подпись
       оказывалась у другого края — на ширину этих же колонок левее, чем нужно для зеркала.
       Отсюда и «П1 не на чёрном фоне»: П2 стоит над колонками строки, П1 — над пустым паттерном.
       Теперь edgeEl у обеих один и тот же, поле цепочки, и стороны считаются от РАЗНЫХ его краёв:
       правая планка от правого, левая от левого. Зеркало получается по построению, а не подгонкой
       зазоров — тех самых 2px и 4px, которые я в v1.289 честно выровнял, не заметив, что мерятся
       они вообще от разных мест.
       Зазор LINE_GAP считается от ГРАНИЦЫ поля: линии стоят на краю плюс-минус пиксель (#vsplit на
       patEl.right + 1, #vsplit2 на bitsEl.right + 1 — см. начало этой функции). */
    /* ═══ КАЖДАЯ ПЛАНКА — НА СВОЕЙ ГРАНИЦЕ ПОЛЯ ЦЕПОЧКИ (испр. v1.294) ═══
       Запрос пользователя: «сдвинь так, чтобы П1 и П2 лежали на чёрном фоне точно — там проходят
       границы поля цепочек».
       Границы у поля СЧИТАЮТСЯ ОТ РАЗНЫХ КОРОБОК, и это не оплошность, а его устройство: #vsplit
       стоит на patEl.right + 1, #vsplit2 — на bitsEl.right + 1 (см. начало updateSplitPositions).
       Между patEl.right и bitsEl.left лежат ещё колонки точек и номеров строк — они внутри поля,
       но в bitsEl не входят. Поэтому «левый край поля» и «левый край бит» — разные вертикали.
       В v1.290 я привязал обе планки к bitsEl, приняв это за зеркало. Зеркало вышло по коробке, а
       не по границам: «П2» осталась на своей линии, «П1» уехала внутрь поля, на ширину тех самых
       колонок. Настоящей же причиной жалобы «П1 не на чёрном фоне» была невидимая подпись — у неё
       не было заливки, и правил я не то (заливка добавлена там же, в v1.294).
       Возвращаем каждой планке ЕЁ границу: левая от patEl, правая от bitsEl. Зазор общий, LINE_GAP,
       и отсчитывается от линии — тогда обе отстоят от своей вертикали одинаково. */
    /* ═══ ОБЕ ПЛАНКИ — В ЧЁРНЫХ ПОЛОСАХ ПО БОКАМ ОТ БИТ (v1.296, окончательно) ═══
       Запрос пользователя: «сдвинь так, чтобы П1 и П2 лежали на чёрном фоне точно», «тут не
       попадает в фон чёрный П1».
       Что за чёрный фон. Заливок полей три — по одной на П1, биты и П2 (putFieldBg ниже), и кроют
       они ровно свои коробки. Колонки точек (.pat-dot) и номеров строк (.num) не входят ни в одну:
       по обе стороны от бит остаются полосы БЕЗ заливки, сквозь которые виден холст (--cbg). Вот
       они и читаются как чёрные. Полосы эти симметричны относительно поля бит по построению —
       значит и планки должны отсчитываться от НЕГО, а не каждая от своей границы.
       Отсюда формула: левая прижата правым краем к bitsEl.left, правая левым к bitsEl.right, зазор
       общий. «П2» так стояла всегда, «П1» теперь тоже.
       ИСТОРИЯ, ЧТОБЫ НЕ ХОДИТЬ ПО КРУГУ ТРЕТИЙ РАЗ. Ровно это делала v1.290 — и была отменена в
       v1.295 по жалобе «П1 не на чёрном фоне». Жалоба была верной, а причина другой: у подписи не
       было заливки (исправлено в v1.294), и её просто не видели на холсте. Отмена лечила симптом
       уже вылеченной болезни. Привязка к patEl (v1.288/1.289, вернувшаяся в v1.295) ставит «П1» на
       ЛИНИЮ границы — а линия проходит по краю колонки паттернов, левее чёрной полосы. */
    /* ═══ ОБЕ СТОРОНЫ СЧИТАЮТСЯ ОТ ПРАВОГО КРАЯ СВОЕЙ КОРОБКИ (испр. v1.304) ═══
       Баг-репорт: «кнопки уехали так же, без изменений». Замер: планка П1 left = −1px, то есть
       упёрлась в зажим по краю окна.
       Причина — рассинхрон моих же двух правок. В v1.296 планка мерилась от bitsEl, и для левой
       брался box.LEFT (левый край поля бит). В v1.301 я вернул ей patEl — колонку паттернов, — но
       формулу не тронул. Получилось «левый край колонки П1 минус ширина планки», то есть глубокий
       минус на любой раскладке; зажим сажал планку к кромке окна, и она стояла там всегда, чем шире
       колонка, тем нелепее.
       Теперь обе стороны берут box.RIGHT своей коробки: левая — правый край колонки П1 (планка
       укладывается в колонку, растя влево), правая — правый край поля бит (растёт вправо). Разные
       коробки, одна формула, зазор общий. */
    /* ═══ ПОДПИСЬ ЦЕНТРУЕТСЯ НА ГРАНИЦЕ СВОЕГО ПОЛЯ (v1.306) ═══
       Запрос пользователя: «П1 должен находиться МЕЖДУ полями, на границе П1 и Ц, и также П2 — на
       границе, где чёрный фон».
       До сих пор планка отступала от линии на LINE_GAP, то есть целиком лежала по свою сторону.
       «Между полями» — это другое: подпись должна СИДЕТЬ НА линии, половиной с каждой стороны.
       Считаем не от края планки, а от центра её ПОДПИСИ, и правило выходит одно на обе стороны:
       центр .pat-strip-lab совпадает с линией границы. Дальше геометрия сама разводит их зеркально,
       потому что подпись стоит в разных концах: у «П1» она последняя (кнопки уходят влево, в
       колонку паттернов), у «П2» первая (кнопки уходят вправо, в свою). Требование v1.301 «кнопки
       всегда на поле паттернов» этим не нарушается — за линию заходит только половина подписи.
       LINE_GAP больше не нужен: зазора нет, есть совпадение центра с линией. */
    /* ═══ ПОДПИСЬ — ПО ЦЕНТРУ ЧЁРНОГО ПРОСВЕТА МЕЖДУ ПОЛЯМИ (испр. v1.306 → v1.307) ═══
       Уточнение пользователя: «неверная интерпретация „между полями“ — вся надпись П1 как раз
       умещается в чёрный фон между полями, расположи по центру ЕЁ ширины, которая между полями».
       Я понял «между полями» как «верхом на линии границы» и посадил центр подписи на неё. Речь же
       про ПРОСВЕТ: заливки полей (#fieldBgL/#fieldBgC/#fieldBgR) кроют ровно свои коробки, а колонки
       точек и номеров строк не входят ни в одну — между заливками остаются полосы голого холста.
       Подпись целиком помещается в такую полосу, и центрировать её надо по полосе, а не по линии.
       Центр просвета приходит готовым, параметром centerX: посчитать его внутри нельзя — нужны
       ОБЕ соседние коробки, а сюда передаётся одна (по ней же решается, показывать ли планку).
       Просвета нет (соседнее поле скрыто) — centerX не передан, и работает прежний отсчёт от линии.
       Подпись стоит в разных концах планки — у «П1» последняя, у «П2» первая, — поэтому смещение
       считается от её собственного места внутри планки, а не от края. */
    const box = edgeEl.getBoundingClientRect();
    const labEl = strip.querySelector(".pat-strip-lab");
    const labW = labEl ? labEl.offsetWidth : 0;
    const lineX = box.right - cr.left + 1;   // там же, где #vsplit / #vsplit2 (см. начало функции)
    const anchorX = (typeof centerX === "number" && isFinite(centerX)) ? centerX : lineX;
    /* ═══ ПЛАНКУ ВЕДЁТ ПОДПИСЬ, ГДЕ БЫ ВНУТРИ РЯДА ОНА НИ СТОЯЛА (v1.320) ═══
       Прежняя формула знала расстановку наизусть: у «П1» подпись ПОСЛЕДНЯЯ (потому вычиталась вся
       ширина планки), у «П2» — ПЕРВАЯ (потому не вычиталось ничего). Пока в планках были только
       подпись и две кнопки, это работало. С этой версии за подписью стоят ещё два пикера цвета
       (см. .pat-strip в разметке), подпись перестала быть крайней, и обе ветки соврали бы ровно на
       ширину хвоста за ней.
       Спрашиваем расстановку у DOM: offsetLeft подписи внутри планки. Планка position:absolute,
       то есть сама себе offsetParent, и число не зависит от того, куда её поставил прошлый кадр
       (тот же приём, что у offsetLeft кнопки «№» в updateAxisSplitPosition; там он до v1.329
       звался btnTailNum и мерил хвост планки за кнопкой).
       Ветвление по стороне уходит совсем: обе стороны говорят одно и то же — «левый край подписи
       на anchorX минус половина её ширины», просто у «П1» anchorX приходит от границы поля, а у
       «П2» от центра просвета (см. вызовы ниже). На прежней разметке числа выходят те же, что и
       давала старая формула, — это переписывание, а не смена правила. */
    const labOff = labEl ? labEl.offsetLeft : 0;
    const wantLeftStrip = anchorX - labW / 2 - labOff;
    /* ═══ «П1» НЕ ОТЛИПАЕТ ОТ ЛИНИИ НА УЗКОЙ КОЛОНКЕ (испр. v1.289) ═══
       Баг-репорт: «сейчас П1 не на чёрной полосе лежит».
       Планка выкладывается справа налево, и на узкой колонке её левый край уходит в минус. Зажим
       Math.max(0, …) (v1.268) сажал её на нуль — а раз левый край прибит, то правый оказывается на
       её же ширине от начала холста, ЛЕВЕЕ линии. Чем уже колонка, тем больше разрыв: подпись «П1»
       отставала от границы ровно настолько, насколько не хватило места. Никакой другой ошибки в
       расчёте не было — «зеркало» ломал именно зажим.
       Нижняя граница теперь не нуль холста, а левый край ОКНА (−cr.left + 2): планка держится на
       линии всегда, пока для неё есть место на экране, и съезжает только когда иначе ушла бы за
       кромку браузера — там от неё в любом случае не было бы пользы.
       Отрицательный left безопасен: .chain своё содержимое не обрезает (overflow снят, см. её CSS),
       а слева от неё лежит боковой док, то есть место обычно есть. У «П2» зажим не работает вовсе —
       она растёт вправо, — но формула общая, и лишним он ей не будет. */
    /* ═══ ЗАЖИМ ПО КРОМКЕ ОКНА СНЯТ (испр. v1.380) ═══
       Баг-репорт: «при скролле осталось починить съезд кнопок у П1 и П2».
       Вот он. Здесь стояло Math.max(-cr.left + 2, …) — «не уходить левее левого края ОКНА»
       (v1.289). Величина viewport-зависимая: cr.left это левый край .chain на экране, и при
       горизонтальной прокрутке он уходит в минус тем глубже, чем дальше уехал холст. Значит и порог
       рос вместе с прокруткой, и планку тянуло вправо ровно на прокрученное — на глаз «съезжает».
       Всё остальное в этом расчёте .chain-относительное и от прокрутки не зависит вовсе, потому
       остальные элементы и ехали правильно.
       Зажим стал не нужен: с v1.367 планку держит в её собственном поле другой упор, и он
       .chain-относительный. Задача «не дать планке уйти туда, откуда её не достать» решена там же
       и без привязки к экрану. */
    strip.style.left = wantLeftStrip + "px";
  };
  /* ОБЕИМ ПЛАНКАМ ПЕРЕДАЁМ bitsEl (v1.290) — поле цепочки, от его левого и правого краёв. Раньше
     левая получала patEl, колонку паттернов, и потому стояла не зеркально (см. разбор в placeStrip).
     ОТМЕНЕНО В v1.294: рассуждение было неверным — левая граница поля и считается от patEl, см.
     разбор там же. Левой планке возвращён patEl, правой оставлен bitsEl; каждая стоит на своей
     вертикали. Условие показа прежнее: нет колонки П1 — нет и её планки.
     СНОВА bitsEl (v1.296, окончательно): планки стоят не на линиях границ, а в чёрных полосах по
     бокам от бит, и полосы эти симметричны именно относительно bitsEl — весь разбор в placeStrip.
     Условие показа не трогаем: планка «П1» по-прежнему уходит вместе с колонкой П1.
     ═══ И ВСЁ ЖЕ patEl (v1.301) ═══
     Запрос пользователя: «кнопки всегда должны быть на поле паттернов».
     «Окончательно» в v1.296 оказалось преждевременным, но требование сменилось, а не уточнилось:
     до сих пор речь шла о том, где лежит ПОДПИСЬ, теперь — о том, где лежат КНОПКИ. От bitsEl
     планка растёт влево из чёрной полосы и кнопки попадают то в неё, то в колонку — как повезёт с
     шириной колонок точек и номеров. От patEl.right планка целиком укладывается в колонку П1:
     подпись прижата к её правому краю, обе кнопки левее, то есть всегда над паттернами.
     У «П2» ничего не меняется: она растёт от bitsEl вправо и точно так же ложится в свою колонку —
     ей отдельная привязка не нужна, направление уже верное. */
  /* Центр чёрного просвета между заливками соседних полей (v1.307). Просвет — это колонки точек и
     номеров: заливки кроют только .pat/.bits/.pat2, а всё, что между ними, остаётся холстом.
     Соседа нет (колонка скрыта) — просвета нет, отдаём undefined, и планка встаёт по линии, как
     в v1.306. */
  /* ═══ ЛЕВЫЙ ПРОСВЕТ ДЕЛИТСЯ С КНОПКОЙ «№» (v1.310) ═══
     Баг-репорт: «она сейчас прямо на П1 месте находится, и возможно поэтому я не вижу П1 надписи».
     Кнопка номеров строк стоит у линии П1|Ц и занимает НАЧАЛО просвета. Считая центр от самой
     границы, мы сажали подпись ровно под неё.
     Поэтому левая граница просвета для подписи — не край колонки паттернов, а правый край кнопки.
     Ширину кнопки берём offsetWidth'ом: её позицию ставит другой проход (updateAxisSplitPosition),
     и живая коробка тут может быть от прошлого кадра, а собственная ширина — сегодняшняя. Тот же
     приём, что и в v1.284/1.285, и по той же причине.
     Кнопка скрыта или планки оси нет — вычитать нечего, просвет считается от границы, как в v1.307.
     ВЕСЬ ЭТОТ РЕЗЕРВ СНЯТ В v1.311 вместе с центрированием «П1»: подпись теперь просто встаёт за
     линию, а кнопка ушла к началу бит, и делить просвет стало не с кем. Переменные numBtnGutterW /
     numStripForGutter / numBtnForGutter удалены как мёртвые, параметр reserveLeft — тоже. Текст
     оставлен: он объясняет, почему центрирование в узком просвете вообще не работало. */
  const gutterCenter = (leftEl, rightEl) => {
    if (!leftEl || !rightEl) return undefined;
    const a = leftEl.getBoundingClientRect().right - cr.left;
    const b = rightEl.getBoundingClientRect().left - cr.left;
    return b > a ? (a + b) / 2 : undefined;
  };
  const patLHidden = document.body.classList.contains("hide-pat-l");
  const patRHidden = document.body.classList.contains("hide-pat-r");
  /* ═══ «П1» — СРАЗУ ЗА ГРАНИЦЕЙ ПАТТЕРНОВ, БЕЗ ЦЕНТРИРОВАНИЯ (испр. v1.311) ═══
     Баг-репорт: «наложилось П1 на № — отодвинуть надо и П1 правее, за границу паттернов поля,
     а № ещё дальше, за границу цепочек».
     Почему центрирование (v1.307/1.310) не сработало: просвет между колонкой паттернов и битами —
     это ширина колонок точки и номера, около трёх десятков пикселей. Кнопка «№» с подписью
     «№ 10» занимает почти столько же. Вычтя её из просвета (v1.310), я получал отрицательный
     остаток, gutterCenter честно возвращала undefined, и обе — подпись и кнопка — падали на
     запасную позицию, на линию. Отсюда и наложение.
     Никакого центра больше не ищем. Подпись просто встаёт ЛЕВЫМ краем сразу за линию границы:
     место определено однозначно и не зависит от того, поместилось что-то в просвет или нет.
     Через centerX это выражается как «левый край + половина подписи» — параметр остался прежним,
     чтобы не плодить второй способ задавать место. */
  /* ═══ ПОДПИСИ ПРИЖАТЫ КАЖДАЯ К ГРАНИЦЕ СВОЕГО ПОЛЯ, ИЗНУТРИ (v1.343) ═══
     Запрос пользователя: «прижми краем к границам: П1 — к правой границе, соответственно П2 — к
     левой».
     «П2» так и стояла: её подпись первая в планке, и планка начинается на линии Ц|П2, то есть
     левым краем подписи ровно на границе. А «П1» с v1.311 вставала ЛЕВЫМ краем сразу ЗА линию —
     то есть заходила в поле цепочки, зеркальности не было. Теперь у неё к границе прижат ПРАВЫЙ
     край, и подпись целиком лежит в своей колонке: обе смотрят на цепочку с разных сторон и стоят
     симметрично.
     Обеим задаём место явной координатой, а не через gutterCenter: чёрного просвета между полями с
     v1.330 больше нет (заливки стыкуются), и центрировать в нём нечего — та функция теперь всегда
     отдаёт undefined, и работа шла на её запасном пути. Явный расчёт короче и честнее.
     Зазор в 2px с каждой стороны — чтобы подпись не садилась прямо на полосу границы (та шириной
     5px, см. --splitzone-bg). */
  /* ═══ «П1» СИДИТ НА САМОЙ ГРАНИЦЕ, В ДВЕ СТРОКИ (v1.370) ═══
     Запрос пользователя: «кнопку П1 расположи на границу с Ц, П и ниже её 1 — там как раз 2 строки
     занимает меню 2».
     В v1.343 подпись прижималась к линии ПРАВЫМ краем, то есть целиком лежала в колонке П1. Теперь
     она садится НА линию — центром, половиной с каждой стороны: место у неё то же самое при любой
     ширине колонки, и читается она как метка самой границы, а не как надпись в поле.
     Поперёк линии подпись поместиться не могла — «П1» вдвое шире полосы. Разворачиваем её в две
     строки, «П» над «1» (сам разворот делает разметка подписи, см. переезд в конце файла): по
     высоте место есть, меню 2 и так занимает там два ряда.
     Величина labLW теперь равна ширине ОДНОГО знака, поэтому заход в соседние поля — ползнака в
     каждое, вровень с самой полосой границы. */
  const labLEl = document.querySelector("#patStripL .pat-strip-lab");
  const labLW = labLEl ? labLEl.offsetWidth : 0;
  const labREl = document.querySelector("#patStripR .pat-strip-lab");
  const labRW = labREl ? labREl.offsetWidth : 0;
  const patLineX = patEl ? (patEl.getBoundingClientRect().right - cr.left) : 0;
  const bitsLineX = bitsEl ? (bitsEl.getBoundingClientRect().right - cr.left) : 0;
  /* Обе подписи — ЦЕНТРОМ НА СВОЮ ЛИНИЮ (v1.370, «ну и П2 также»). Прежние ±2/3px со сдвигом на
     полподписи уводили их каждая в своё поле; теперь anchorX это сама линия, а placeStrip уже
     ставит по нему ЦЕНТР подписи — добавлять к нему ничего не нужно. */
  placeStrip("patStripL", patLHidden ? null : patEl, "L",
             patLHidden ? undefined : patLineX);
  placeStrip("patStripR", bitsEl, "R",
             patRHidden ? undefined : bitsLineX);
  /* ═══ «№» ОБЕИХ КОЛОНОК — ИЗНУТРИ ПОЛЯ ЦЕПОЧКИ, ВПРИТЫК К ГРАНИЦЕ (v1.443) ═══
     Запрос пользователя: «кнопки № перемести в Ц, прижми к Г».
     Линии уже посчитаны выше: patLineX — стык П1|Ц, bitsLineX — стык Ц|П2, обе в координатах
     .chain. Полоса границы ложится на стык серединой, поэтому отступаем на её половину: кнопка
     встаёт там, где граница кончается, и на неё не наезжает — та же арифметика, что у заливок
     полей (v1.364) и у подсветки строк.
     Высота и верх — те же, что у планок (alignBarTop): все трое стоят в нулевой строке.
     Колонка спрятана — прячем и её кнопку: править нечего. */
  {
    const halfSplitNum = (parseFloat(getComputedStyle(document.documentElement)
                                       .getPropertyValue("--split-w")) || 5) / 2;
    const topNum = (alignBarTop !== null ? alignBarTop
                    : (rowsTopForStrips - 22 - 3));
    const putNumBtn = (bid, hidden, leftPx) => {
      const b = document.getElementById(bid);
      if (!b || b.parentElement !== chainEl) return;
      if (hidden) { b.style.display = "none"; return; }
      b.style.display = "";
      b.style.top = topNum + "px";
      b.style.left = Math.round(leftPx) + "px";
    };
    putNumBtn("bPatNumL", patLHidden || !patEl, patLineX + halfSplitNum);
    const bR = document.getElementById("bPatNumR");
    const wR = bR ? (bR.offsetWidth || 0) : 0;
    putNumBtn("bPatNumR", patRHidden || !bitsEl, bitsLineX - halfSplitNum - wR);
  }
  /* ═══ УСТУПАЕТ «П1», А НЕ КНОПКА «№» (v1.328) ═══
     Запрос пользователя: «кнопка не сдвигается никуда, двигаются влево П1, освобождая место».
     КАК БЫЛО. Упор стоял с другой стороны: в v1.320 отступала САМА КНОПКА — её левый край не
     пускали левее правого края планки «П1» (см. p1RightPx в updateAxisSplitPosition). Из-за этого
     кнопка ездила по холсту при каждой смене режима «№ 10 / № 01 / № —»: в двоичном номера длиннее,
     просвет шире, упор не срабатывал и кнопка стояла у бит; в десятичном и в «выключено» просвет
     сужался, упор включался и кнопка отпрыгивала вправо. Ровно то, чего быть не должно: кнопка
     убегает от того самого действия, которое сама и выполняет (тот же класс бага, что чинили в
     v1.314).
     КАК СТАЛО. Место кнопки объявлено неподвижным (правым краем к левому краю поля бит, v1.317 —
     а он не зависит от номеров благодаря --rownum-ins), и разъезжаться с ней теперь обязана
     соседка: правый край планки «П1» не заходит правее левого края кнопки. Планка съезжает влево,
     в свою колонку, и подпись остаётся видна при любом режиме номеров.
     СЧИТАЕМ КООРДИНАТУ КНОПКИ АРИФМЕТИКОЙ, А НЕ КОРОБКОЙ. Её позицию ставит другой проход
     (updateAxisSplitPosition), и он идёт ПОЗЖЕ этого — живая коробка тут была бы от прошлого кадра.
     Зато формула оттуда воспроизводится точно: strip.left = fieldLeft + btnTail − stripW, а
     btnLeft = strip.left + btn.offsetLeft, и всё, кроме fieldLeft, сокращается — остаётся
     «левый край поля бит минус собственная ширина кнопки». offsetWidth сегодняшний, он от
     позиции планки не зависит (тот же приём и та же причина, что в v1.284/1.285/1.320).
     Планки «№» на экране нет (строк нет вовсе — см. её ветку в updateAxisSplitPosition) — упирать
     не во что, и «П1» остаётся там, куда её поставила placeStrip. */
  {
    const stripLEl = document.getElementById("patStripL");
    const numStripEl = document.getElementById("axisStrip");
    const numBtnEl = document.getElementById("bAxisRowNum");
    if (stripLEl && stripLEl.classList.contains("act") && bitsEl &&
        numStripEl && numStripEl.classList.contains("act") && numBtnEl && numBtnEl.offsetWidth) {
      /* ЛЕВЫЙ КРАЙ КНОПКИ = ЛЕВЫЙ КРАЙ ПОЛЯ (v1.329). До этой версии кнопка была прижата ПРАВЫМ
         краем к битам и росла влево, поэтому её левый край считался как «биты минус её ширина».
         Теперь она садится левым краем на край поля и растёт вправо — та же формула, что у заливки
         #fieldBgC выше и у самой кнопки в updateAxisSplitPosition; ширина кнопки в расчёт больше
         не входит вовсе. */
      /* v1.331: со столбцом номеров кнопка прижата ПРАВЫМ краем к битам и накрывает колонку (её
         min-width равен ширине столбца), поэтому её левый край — «биты минус собственная ширина».
         Без столбца работает правило v1.329: левый край сам стоит на краю поля, а тот без номеров
         совпадает с краем бит. offsetWidth тут от прошлого кадра — этот проход идёт раньше
         updateAxisSplitPosition; для упора точности хватает (тот же приём и та же оговорка, что в
         v1.297/1.320). */
      /* v1.333: правило у кнопки одно — правым краем к левому краю поля бит (ветвление по наличию
         столбца снято, оно и дёргало кнопку). Значит её левый край всегда «биты минус собственная
         ширина». offsetWidth уже с min-width этого кадра: его проставили выше, в блоке резерва. */
      const bitsLeftX = bitsEl.getBoundingClientRect().left - cr.left;
      const btnLeftX = bitsLeftX - numBtnEl.offsetWidth;
      const maxLeftL = btnLeftX - 3 - stripLEl.offsetWidth;
      const curLeftL = parseFloat(stripLEl.style.left) || 0;
      if (curLeftL > maxLeftL) stripLEl.style.left = Math.max(-cr.left + 2, maxLeftL) + "px";
    }
  }
  /* ═══ КАЖДАЯ ПЛАНКА ДЕРЖИТСЯ В СВОЁМ ПОЛЕ (v1.367) ═══
     Запрос пользователя: «каждая в своём поле всегда; в П1 прижата вправо, П2 лево».
     Прижатие к границе placeStrip уже делает (v1.343): «П1» правым краем подписи к линии П1|Ц,
     «П2» левым — к линии Ц|П2. Не хватало второго упора — ВНЕШНЕГО: на узкой колонке планка
     выкладывалась за её дальний край и уходила либо под обрез холста слева, либо на пустое полотно
     справа. «Всегда в своём поле» значит, что дальний край тоже держит.
     «П1»: левый край не левее левого края колонки. Если планка шире самой колонки, она начнётся с
     её начала и вылезет за линию вправо — это лучше, чем уехать под обрез, откуда её не достать.
     «П2»: правый край не правее правого края колонки, но и левее линии Ц|П2 не заходит — упор
     ставится вторым, и на узкой колонке побеждает именно он, то есть планка снова остаётся у
     границы.
     Идёт ПОСЛЕ упора в кнопку «№» (v1.328, ниже по коду это тот же style.left): тот отжимает «П1»
     влево, этот возвращает её в колонку. Порядок такой намеренно — «в своём поле» правило более
     позднее и более сильное. */
  {
    const stripLFld = document.getElementById("patStripL");
    if (stripLFld && stripLFld.classList.contains("act") && patEl) {
      const fieldLX = patEl.getBoundingClientRect().left - cr.left;
      /* БЕЗ ОКРУГЛЕНИЯ (испр. v1.375) — см. разбор у упора «П2» ниже: подпись обязана стоять на той
         же дробной координате, что и полоса границы, иначе их края расходятся на пиксель. */
      if ((parseFloat(stripLFld.style.left) || 0) < fieldLX) {
        stripLFld.style.left = fieldLX + "px";
      }
    }
    const stripRFld = document.getElementById("patStripR");
    if (stripRFld && stripRFld.classList.contains("act") && pat2El && bitsEl) {
      const fieldRRight = pat2El.getBoundingClientRect().right - cr.left;
      /* ═══ ВНУТРЕННИЙ УПОР «П2» СДВИНУТ НА ПОЛПОДПИСИ (испр. v1.371) ═══
         Баг-репорт: «П2 вообще смещена на полширины примерно».
         Виноват был этот упор, а не расчёт места. С v1.370 подпись садится ЦЕНТРОМ на линию Ц|П2,
         то есть планка начинается на полподписи ЛЕВЕЕ линии. Упор же (v1.367) не пускал её левее
         самой линии — и каждый кадр возвращал планку вправо ровно на эту половину. Отсюда и
         «смещена примерно на полширины»: число совпадает с половиной подписи.
         Упор нужен и остаётся — он держит планку в своём поле на узкой колонке, — но его порог
         теперь тот же, что и правило посадки: линия минус половина подписи. Пока эти два числа
         считаются от одной величины, спорить им не о чем.
         Подпись меряем здесь же: её ширина задана переменной --split-w и на кегле меняется, так
         что запоминать её числом нельзя. */
      const labRFld = stripRFld.querySelector(".pat-strip-lab");
      const halfLabR = labRFld ? labRFld.offsetWidth / 2 : 0;
      const lineRX = (bitsEl.getBoundingClientRect().right - cr.left) - halfLabR;
      const wR = stripRFld.offsetWidth;
      let leftR = parseFloat(stripRFld.style.left) || 0;
      if (leftR + wR > fieldRRight) leftR = fieldRRight - wR;
      if (leftR < lineRX) leftR = lineRX;
      /* ═══ ОКРУГЛЕНИЕ УБРАНО (испр. v1.375) ═══
         Баг-репорт: «у П1 и П2 ширина фона не дотягивает 1 пиксель до ширины границы».
         Ширины у них равны по построению — обе задаются одной переменной --split-w (см.
         .pat-strip-lab-2row в стилях и ::before у ручек границы). Расходились не размеры, а
         КООРДИНАТЫ. Шаг столбца дробный, значит и --split-w дробная, и полоса границы стоит на
         дробной вертикали. Планку же мы округляли до целого — подпись съезжала относительно полосы
         на полпикселя, и две коробки одинаковой ширины растеризовались по разным пиксельным
         границам: у одной край попадал в пиксель, у другой нет. На глаз это и есть «не дотягивает
         один пиксель».
         Отдаём координату как есть, дробной: браузер разложит подпись и полосу одинаково, потому
         что считает их от одного и того же числа. */
      stripRFld.style.left = leftR + "px";
    }
  }
  /* ЗАЛИВКИ ПОЛЕЙ (v1.039) — три сплошные колонки во всю высоту вместо построчных коробок, см.
     .field-bg в CSS. Ширину берём у той же ячейки первой строки, по которой уже поставлена
     граница этого поля: тогда стык заливок и зона захвата совпадают по определению, а не «должны
     совпасть». Высоту — по реальному боксу #rows, а не по числу строк: при виртуализации в DOM
     лежит лишь окно видимости, но сам #rows держит полную высоту распорками (.vspacer). */
  const rowsEl = document.getElementById("rows");
  const rowsRect = rowsEl ? rowsEl.getBoundingClientRect() : null;
  /* ═══ ЗАЛИВКА ЦЕПОЧКИ НАКРЫВАЕТ И СТОЛБЕЦ НОМЕРОВ (v1.328) ═══
     Запрос пользователя: «пусть номера цепочек будут в поле цепочек слева».
     До сих пор заливок было ровно три и каждая кроет СВОЮ ячейку: #fieldBgC — только .bits.
     Столбец номеров (.num-l2) в .bits не входит, он стоит перед ним, в голом просвете между
     заливками, — то есть номера лежали НА ХОЛСТЕ, снаружи поля, хотя относятся к цепочке и
     правятся её же кнопкой «№».
     Теперь у putFieldBg есть необязательный leftEdgeEl: заливка начинается от его левого края,
     а ширина добирается на ту же разницу. Правый край и все прочие поля не трогаются.
     СТОЛБЦА НЕТ («№ —», body.hide-rownums, окно «ℹ Поле») — у скрытого элемента ширина нулевая,
     расширение не применяется, и заливка возвращается ровно к прежней коробке бит. Поле «дышит»
     влево ровно на столбец: биты при этом стоят на месте (за это отвечает --rownum-ins, v1.317),
     а влево уезжает всё, что левее, — колонка точек, граница и П1 со своей заливкой. Это и есть
     «П1 двигается влево, освобождая место» из запроса.
     Проверка lr.left < left нужна не для красоты: у .num-l2 отрицательный margin-left, и без неё
     любая будущая правка отступов могла бы дать отрицательную прибавку и УКОРОТИТЬ поле. */
  const putFieldBg = (id, cellEl, hidden, leftEdgeX) => {
    const bg = document.getElementById(id);
    if (!bg) return;
    if (!cellEl || !rowsRect || hidden) { bg.classList.remove("act"); return; }
    const r = cellEl.getBoundingClientRect();
    let bgLeft = r.left, bgW = r.width;
    if (typeof leftEdgeX === "number" && isFinite(leftEdgeX) && leftEdgeX < bgLeft) {
      bgW += bgLeft - leftEdgeX; bgLeft = leftEdgeX;
    }
    /* ═══ ЗАЛИВКА НЕ ЗАХОДИТ ПОД ПОЛОСУ ГРАНИЦЫ (v1.364) ═══
       Баг-репорт: «поля залезают на границу на полширины — граница это как бы тоже поле, не должно
       залезать».
       Полоса границы с v1.354 ложится на стык СЕРЕДИНОЙ: половина бита в одно поле, половина в
       другое. Заливки при этом по-прежнему кроют свои коробки целиком, край в край со стыком, —
       значит каждая заходит под свою половину полосы. Пока полоса была волоском, это ничего не
       значило; шириной в бит она стала третьим столбцом на экране, и поля обязаны ей это место
       уступить.
       Поджимаем каждую заливку на полполосы с ОБЕИХ сторон: у всех трёх полей граница есть и
       слева, и справа (у П1 внешняя #vsplitL0 и внутренняя #vsplit, у цепочки #vsplit и #vsplit2,
       у П2 #vsplit2 и #vsplit3), так что правило выходит одно на всех.
       Сами биты и паттерны при этом не двигаются: заливка — фон под ними, а не их коробка.
       Отступы, которые держат глифы в стороне от полосы, живут отдельно (padding-left у .num-l2 и
       .ln .pat2) и считаются от той же --split-w. */
    const splitHalf = (parseFloat(getComputedStyle(document.documentElement)
                                    .getPropertyValue("--split-w")) || 5) / 2;
    if (splitHalf > 0 && bgW > splitHalf * 2) { bgLeft += splitHalf; bgW -= splitHalf * 2; }
    bg.style.left = (bgLeft - cr.left) + "px";
    bg.style.width = bgW + "px";
    bg.style.top = (rowsRect.top - cr.top) + "px";
    bg.style.height = rowsRect.height + "px";
    bg.classList.add("act");
  };
  putFieldBg("fieldBgL", patEl, document.body.classList.contains("hide-pat-l"));
  /* ═══ ЗАЛИВКА ЦЕПОЧКИ НАЧИНАЕТСЯ НА САМОЙ ГРАНИЦЕ (v1.333) ═══
     В v1.328 её левый край брали у столбца номеров — тогда это и была левая кромка поля. С v1.330
     к ней добавился схлопнутый просвет, а с v1.333 ещё и резерв под кнопку «№», и по столбцу край
     считать больше нельзя: без номеров заливка обрывалась бы, оставляя резерв незакрашенным.
     Берём правый край ЛЕВОЙ точки: это и есть стык полей, по нему же идёт линия #vsplit. Поле
     теперь всегда занимает всё от границы с П1 до своей правой границы, что бы внутри ни стояло —
     номера, резерв под кнопку или ничего. */
  const dotEdgeEl = row.querySelector(".pat-dot");
  putFieldBg("fieldBgC", bitsEl, false,
             dotEdgeEl ? dotEdgeEl.getBoundingClientRect().right : undefined);
  putFieldBg("fieldBgR", pat2El, document.body.classList.contains("hide-pat-r"));
  /* ═══ ГРАНИЦЫ ПОЛЕЙ КОНЧАЮТСЯ ТАМ ЖЕ, ГДЕ ПОЛЕ (v1.437) ═══
     Баг-репорт: «граница сверху выступает за поле строки» — линии границ полей идут выше верхней
     кромки поля строк.
     Ручки живут абсолютом в .chain и стояли на top:0/bottom:0, то есть во всю её высоту. А .chain
     выше поля строк: над #rows в ней лежат служебная шапка, полоса меню 2 и место под наложения.
     Заливки полей давно считаются по #rows (см. putFieldBg выше), и линия, идущая выше заливки,
     висела в пустоте — граница есть, а полей, которые она разделяет, ещё нет.
     Даём ручкам ту же мерку, что и заливкам: верх и высота по #rows, ни пикселем выше. Заодно
     сокращается и зона захвата — тянуть границу можно там, где она видна.
     #vsplit3 не в счёт: с v1.397 это рамка ОКНА (position:fixed от низа меню 1 до низа экрана),
     а не стык полей, и мерить её полем строк нечем. */
  if (rowsRect) {
    const splitTopPx = rowsRect.top - cr.top;
    for (const idSplit of ["vsplitL0", "vsplit", "vsplit2"]) {
      const elSplit = document.getElementById(idSplit);
      if (!elSplit) continue;
      elSplit.style.top = splitTopPx + "px";
      elSplit.style.height = rowsRect.height + "px";
      elSplit.style.bottom = "auto";
    }
  }
  /* ═══ ЗАЛИВКА РЯДА МЕЖДУ ДВУМЯ НУЛЕВЫМИ СТРОКАМИ (v1.384) ═══
     Запрос пользователя: «всё, что между 0 и 0 — там и меню 2 — другим фоном залей».
     Ряд — это разрыв --align-band-h: снизу он упирается в нулевую строку цепочки, сверху, с этой
     версии, в пустую строку наложений, а внутри стоит меню 2 и проходит ось.
     ВЕРХ БЕРЁМ У ЧЕРТЫ ГОРИЗОНТА, а высоту — у самой переменной разрыва: оба числа уже посчитаны
     (updateTopHorizon и positionAlignGrpTop), и пересчитывать их тут значило бы завести второй
     источник правды — ровно та ошибка, которую в этом файле ловили не раз.
     ШИРИНА — по всей строке, от левого края П1 до правого края П2: ряд служебный и относится ко
     всей раскладке, а не к одному полю. Меряем живую строку, а не складываем ширины колонок:
     колонок может не быть вовсе (обе спрятаны), и тогда остаётся само поле бит.
     Черты нет (пустая цепочка) — заливку прячем: рисовать её не от чего. */
  {
    const bandEl = document.getElementById("bandBg");
    const hLineBand = document.getElementById("hsplitTop");
    if (bandEl) {
      /* ═══ ЗАЛИВКА — ПО НУЛЕВОЙ СТРОКЕ, А НЕ ПО РАЗРЫВУ (v1.404) ═══
         Запрос пользователя: «0 строка с меню — другим фоном».
         Заливка мерилась по --align-band-h, а с v1.403 разрыва нет вовсе (он ноль) — и полоса
         пропала вместе с ним. Меню 2 при этом никуда не делось: оно легло НА нулевую строку.
         Значит и красить надо её: высота — ровно высота полосы (--strip-h, её меряет
         positionAlignGrpTop), а верх — та же черта горизонта, что и раньше, она проходит по верхней
         кромке нулевой строки.
         Запасная величина — --row-h: полоса ростом в строку с v1.402, так что при первом кадре, пока
         --strip-h ещё не посчитана, число выйдет то же самое. */
      /* ═══ ВЫСОТА — ПО СТРОКЕ, А НЕ ПО ИЗМЕРЕННОЙ ПОЛОСЕ (испр. v1.418) ═══
         Запрос пользователя: «фон 0 строки при изменении междустрочного интервала должен меняться».
         Считалось по --strip-h — измеренной высоте меню 2. Величина верная, но ОТСТАЮЩАЯ: её
         ставит positionAlignGrpTop по offsetHeight, то есть по раскладке ПРОШЛОГО кадра, и сразу
         после сдвига ползунка междустрочного заливка оставалась прежней высоты.
         Берём --row-h — ту же переменную, которой живут сами строки и от которой считается высота
         полосы (см. #alignGrp в стилях). Она обновляется до отрисовки, поэтому заливка едет за
         интервалом в том же кадре, что и строки.
         Нижний упор 14px повторяет упор полосы: у той он стоит, чтобы значки не схлопнулись на
         мелком кегле, и заливка обязана совпадать с ней, а не быть тоньше. */
      /* ═══ ЗАЛИВКА ЗАБИРАЕТ МЕЖСТРОЧНЫЕ ПРОСВЕТЫ СОСЕДЕЙ (v1.424) ═══
         Запрос пользователя: «высоту фона 0 строки увеличь за счёт межинтервального −1 и 1 строк».
         Строка выше кегля: --row-h это кегль, умноженный на межстрочный, и разница между ними —
         пустой просвет, поровну сверху и снизу от самих знаков. У нулевой строки этот просвет
         оставался незакрашенным, и полоса читалась уже, чем ряд, в котором стоит.
         Прибавляем ПОЛОВИНУ просвета сверху и половину снизу: заливка вырастает ровно в пустоту
         соседних рядов и до их знаков не достаёт — те занимают только свою серединную часть.
         Просвет считаем как «высота строки минус кегль полотна»: обе величины уже есть, мерить
         глифы не нужно. Межстрочный сжали до кегля и меньше — просвет нулевой или отрицательный,
         и прибавки просто нет (зажим по нулю).
         Верх поднимаем на ту же половину, иначе полоса выросла бы только вниз. */
      const rowHBand = Math.max(14, parseFloat(getComputedStyle(document.documentElement)
                                                 .getPropertyValue("--row-h")) || 0);
      const fsBand = parseFloat(getComputedStyle(document.documentElement)
                                  .getPropertyValue("--chain-fs")) || 0;
      const leadBand = Math.max(0, rowHBand - fsBand);
      /* ═══ ПРОСВЕТ ПО 2px СВЕРХУ И СНИЗУ (v1.434) ═══
         Запрос пользователя: «сделай отступ от 0 строки вверх низ по 2px».
         В v1.424 заливка забрала себе межстрочные просветы соседей целиком и вплотную подошла к
         их знакам. Отдаём по два пикселя обратно с каждой стороны: ряд отделяется от соседних
         строк воздухом, а не линией.
         Нижний упор — высота самой строки: просвет отдаём только из того, что заливка ПРИБАВИЛА
         сверх строки. Межстрочный сжат до кегля (прибавки нет) — отступать не из чего, и заливка
         остаётся ровно в строку, иначе она стала бы ниже стоящей в ней полосы меню 2. */
      const bandGap = 2;
      const bandHFull = rowHBand + leadBand;
      const bandH = Math.max(rowHBand, bandHFull - bandGap * 2);
      const bandOn = hLineBand && hLineBand.classList.contains("act") && bandH > 0 && row;
      if (!bandOn) { bandEl.classList.remove("act"); }
      else {
        const rowRect = row.getBoundingClientRect();
        bandEl.style.top = ((parseFloat(hLineBand.style.top) || 0) - leadBand / 2 + (bandHFull - bandH) / 2) + "px";
        bandEl.style.height = bandH + "px";
        bandEl.style.left = (rowRect.left - cr.left) + "px";
        bandEl.style.width = rowRect.width + "px";
        bandEl.classList.add("act");
      }
    }
  }
}

/* Ширину ЛЕВОЙ колонки паттернов тоже подбираем автоматически (v0.862, запрос пользователя
   "убери отступы слева от паттернов левых"): раньше она держалась на фиксированных 12em из CSS, и
   при коротких паттернах (или совсем без них) слева от цепочки оставалась широкая пустая полоса.
   Флаг тот же по смыслу, что и patW2Manual: подвинул ручку #vsplit руками — автоподбор выключен,
   иначе следующий render() отменил бы ручную ширину. */
var patWManual = false;
/* Прибавка под номер в ручном режиме (v1.303, см. fitPatW): добавлена ли она сейчас и сколько
   именно. Хранить величину отдельно обязательно — --num-w меняется от кегля и от системы
   счисления («№ 01» шире «№ 10»), и снимать надо ровно то, что прибавили, иначе колонка поплывёт
   на разницу. var, а не let: fitPatW() может вызваться из render() раньше этой строки. */
var patWNumReserved = false;
var patWNumReservedPx = 0;
var patW2Manual = false; // var, а не let: и saveCache(), и render() могут дотянуться до флага
                         // раньше, чем выполнится эта строка (у let это была бы TDZ-ошибка)
// Ширину среднего столбца (поля цепочек) тянули руками — render() больше не пересчитывает
// --bits-w по длине самой длинной строки, ширина остаётся ровно той, что выставили.
var bitsWManual = false;
function fitPatW(){
  let maxLen = 0;
  for (const p of (st.pats || [])) if (p && p.text && p.text.length > maxLen) maxLen = p.text.length;
  const step = realColStepPx() || 8;
  // Паттернов нет вовсе — колонка сжимается до минимума, а не держит пустые 12em.
  // +32 — собственные отступы .pat (слева 0, справа 28px под бейдж «#N») плюс небольшой запас;
  // плюс ширина номера, если он включён внутри П1 (body.patnum-l).
  /* ═══ РЕЗЕРВ ПОД НОМЕР — БЕЗ ОГЛЯДКИ НА КНОПКУ (испр. v1.389) ═══
     Баг-репорт: «включить номера П1 — всё двигается».
     Было `st.patNumL ? --num-slot : 0`: ширина колонки зависела от того, показан номер или нет, а
     значит и стык с цепочкой ездил на каждое нажатие. Ровно та подвижная величина, от которой мы
     ушли у номеров цепочки в v1.337, — только здесь она пряталась в условии.
     Держим место под номер всегда. Кнопка «№» у П1 теперь меняет ровно одно: печатать в этом месте
     номер или оставить его пустым. Ни ширина колонки, ни положение поля цепочки от неё не зависят.
     Вычет в CSS сделан безусловным этой же версией — прибавка и вычет обязаны стоять на одном
     условии, иначе они снова разойдутся (что и случилось). */
  const numW = parseFloat(getComputedStyle(document.documentElement)
                            .getPropertyValue("--num-slot")) || 0;
  /* ═══ ПРИБАВЛЯЕМ ТО, ЧТО КОЛОНКА ОТДАЁТ ЦЕПОЧКЕ (v1.344) ═══
     Запрос пользователя: «двойной клик должен делать ширину П1 и П2 такой, чтобы все биты
     помещались — по самой широкой строке».
     С v1.342 ВИДИМАЯ ширина П1 не равна --pat-w: у неё вычтен постоянный слот колонки номеров
     цепочки и один зазор строки (см. .pat в стилях — это и есть «П1 отдаёт своё место»). Формула
     же считала место только под сам паттерн, поэтому и автоподбор, и двойной клик по границе
     сажали колонку на ширину, из которой ещё вычиталось столько же, — и самый длинный паттерн
     всё равно обрезался ровно на слот.
     Прибавляем ту же величину и теми же переменными, что вычитает CSS: разойтись им нельзя.
     Зазор прибавляем безусловно — в правиле .pat он тоже вычитается безусловно, слот там может
     быть нулевым, а зазор нет. */
  /* ═══ И НОМЕР ВНУТРИ П1 — ТОЖЕ ЗА СЧЁТ ШИРИНЫ КОЛОНКИ (v1.346) ═══
     Запрос пользователя: «двойной по границам — когда есть номера в паттернах, учитывая ширину
     для них».
     Тут две РАЗНЫЕ величины с одним именем --num-w, и обе надо прибавить.
     Первая (numW выше, ещё с v1.301) — само место под номер в ячейке: без неё автоширина резала
     бы хвост паттерна ровно на номер.
     Вторая — то, что колонка ОТДАЁТ по правилу body.patnum-l .pat (v1.342): её видимая ширина
     уменьшена на ту же --num-w, чтобы включение номера не толкало цепочку вправо. Не вернув эту
     величину сюда, мы получали бы ширину, из которой номер вычитается, но не прибавляется, —
     и двойной клик оставлял бы паттерн обрезанным, ровно как в баг-репорте.
     Читаем ту же переменную и по тому же условию (st.patNumL), что и CSS-правило: разойтись им
     нельзя. Номера в П1 выключены — оба слагаемых нулевые, формула прежняя. */
  const rootCS = getComputedStyle(document.documentElement);
  const giveAway = (parseFloat(rootCS.getPropertyValue("--numl-slot")) || 0)
                 + (parseFloat(rootCS.getPropertyValue("--row-gap")) || 8)
                 + numW;
  const w = Math.max(40, Math.min(1200, Math.round(maxLen * step) + 32 + numW + giveAway));
  /* ═══ РУЧНАЯ ШИРИНА — НЕ ПОВОД ПРЯТАТЬ НОМЕР (испр. v1.301, переделано в v1.303) ═══
     Баг-репорт: «если нажать № — номера ставятся правее и их не видно, надо ещё биты паттернов
     сдвигать влево».
     Ширина под номер прибавлялась и раньше (numW выше), но функция начиналась с
     `if (patWManual) return` — и стоило один раз потянуть границу #vsplit, как автоподбор
     выключался НАВСЕГДА. Дальше кнопка «№» дописывала номер в конец ячейки, ширина колонки не
     менялась, а у .pat стоит overflow:hidden — номер обрезался ровно на своей длине.
     ═══ ЧЕМ БЫЛА ПЛОХА ПЕРВАЯ ПОПЫТКА (v1.301) ═══
     Баг-репорт: «разъехались кнопки». Замер показал --pat-w: 913px при patWManual:true.
     Я поставил нижним упором ПОЛНУЮ автоширину w — а она считается под самый длинный паттерн
     целиком. У кого паттерн в сотню знаков, тому колонку и раздувало на всю сотню, затирая ручную
     ширину напрочь. Узкая колонка — осознанный выбор: .pat режет содержимое (overflow:hidden), и
     человек может намеренно показывать только хвост паттерна.
     ═══ КАК ПРАВИЛЬНО ═══
     В ручном режиме ширину паттерна не навязываем вовсе. Резервируем РОВНО номер: включили «№» —
     колонка разово подросла на numW, выключили — на столько же вернулась. Флаг patWNumReserved
     помнит, добавлена ли прибавка сейчас, поэтому повторные render() её не накапливают (без флага
     каждый кадр прибавлял бы ещё numW — тот самый храповик, что и раздул колонку).
     При новой протяжке границы флаг переставляется под текущее состояние кнопки: ширина, которую
     человек только что выставил глазами, уже включает номер, если тот показан. */
  /* ═══ РАЗОВАЯ ПРИБАВКА В РУЧНОМ РЕЖИМЕ БОЛЬШЕ НЕ НУЖНА (испр. v1.389) ═══
     Здесь колонка, ширину которой выставили мышью, разово подрастала на номер при включении кнопки
     «№» и на столько же возвращалась при выключении (v1.303). Весь этот учёт — флаги
     patWNumReserved/patWNumReservedPx — существовал ровно затем, чтобы прибавка не накапливалась
     от кадра к кадру.
     С v1.389 место под номер вычитается из видимой ширины ВСЕГДА (см. .pat в стилях), то есть
     резерв стоит и в ручной ширине тоже, и подгонять её на переключении нечем и незачем: кнопка на
     раскладку больше не влияет. Ручная ширина остаётся ровно той, какую выставили.
     Флаги оставлены объявленными — их читает makeColResizer при захвате границы, — но всегда
     ложны: прибавки, о которой они помнят, больше не бывает. */
  if (patWManual) { patWNumReserved = false; patWNumReservedPx = 0; return; }
  patWNumReserved = false;   // автоподбор считает номер сам (numW выше) — прибавке взяться неоткуда
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
    : (parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--num-slot")) || 0);
  /* ═══ ЗАПАС ПОД ОТСТУП ОТ ГРАНИЦЫ — ТОЖЕ ОТ ШАГА СТОЛБЦА (v1.354) ═══
     Отступ у .ln .pat2 больше не число, а «половина полосы границы плюс 4px», и полоса эта шириной
     в один бит (см. --split-w). Значит и запас в автоширине обязан считаться так же, иначе на
     крупном кегле двойной клик снова начнёт резать хвост самой длинной строки — ровно на разницу.
     36 — прежние собственные отступы ячейки; остальное повторяет формулу отступа один в один. */
  const padLeftPx = Math.round(step / 2) + 4;
  // Ниже — история числа, которое тут стояло до v1.354:
  // +44, а не +36 (v1.344, уточнено v1.349): отступ от границы у .pat2 поднят с 4px до 9px (v1.343, «биты залезают
  // на границу»), и на эти пять пикселей уменьшилось место под сам паттерн. Без поправки двойной
  // клик сажал бы колонку впритык и резал хвост самой длинной строки ровно на них.
  const w = Math.max(40, Math.min(1200, Math.round(maxLen * step) + 36 + padLeftPx + numW));
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
/* ═══ ТРЕТИЙ ЗАМЕР: ПОСТОЯННЫЙ СЛОТ КОЛОНКИ (--numl-slot, v1.337) ═══
   Баг-репорт, повторённый трижды: «всё сдвигается влево при нажатии „Номера“».
   Причина оказалась не в привязке кнопки и не в компенсации, а в том, что сама ВЕЛИЧИНА вставки
   разная в каждом режиме: «№10» — ширина десятичного номера, «№01» — двоичного (он втрое длиннее),
   «№—» — ноль. Строка отступает влево ровно на вставку (--rownum-ins), поэтому вместе с ней на
   каждое нажатие ездила вся левая сторона: колонка П1, граница, точка.
   Лечение — не двигать вставку вовсе. Меряем ширину, которой колонке хватит в САМОМ ШИРОКОМ из
   режимов (а это всегда двоичный), и держим просвет такой всегда. Дальше режим меняет только то,
   что В НЁМ напечатано: в «№01» номер занимает слот целиком, в «№10» упирается в его правый край
   и слева остаётся пусто, в «№—» пусто всё. Ни одна коробка при этом не двигается.
   slotPadW приходит из render(), где считается по тем же двум кандидатам, что и numPadW (самая
   нижняя строка и самая верхняя), но всегда в двоичном виде.
   Болванка баланса та же: она печатается в этом же боксе и входит в обе ширины одинаково. */
function fitNumW(numPadW, extraHtml, slotPadW){
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
  // Слот — тот же замер, но по самой широкой из возможных подписей (v1.337, см. выше).
  const slotPad = "0".repeat(Math.max(1, (slotPadW | 0) || (numPadW | 0)));
  numProbeEl.innerHTML = slotPad + (extraHtml || "");
  const wSlot = Math.ceil(numProbeEl.getBoundingClientRect().width) + 1;
  if (wSlot > 0) document.documentElement.style.setProperty("--numl-slot", Math.max(wSlot, wL) + "px");
  /* ═══ ЧЕТВЁРТЫЙ ЗАМЕР: ПОСТОЯННЫЙ СЛОТ НОМЕРА В ЯЧЕЙКЕ (--num-slot, v1.350) ═══
     Баг-репорт: «ещё с прошлой правки снова начали двигаться справа от кнопки „№ цепочек“ при
     включении».
     И это мой недосмотр из v1.346. --num-w меряется по numPadW, а тот считается ПЕЧАТАЕМЫМ текстом
     номера цепочки — то есть зависит от режима «№10 / №01». Величина подвижная, ровно та, от
     которой мы ушли в v1.337. Пока она входила в раскладку дважды с разными знаками (прибавка в
     fitPatW и вычет в CSS), это было незаметно — слагаемые сокращались. В v1.346 я добавил её
     третий раз, чтобы паттерн вмещался вместе с номером, и сокращение сломалось: видимая ширина
     П1 стала зависеть от режима номеров цепочки, а значит поехало и всё правее неё.
     Заводим второй постоянный слот — под номер ВНУТРИ ячейки паттерна. Замер тот же, что у --num-w
     (класс .num, кегль паттерна, без болванки баланса), но по самой широкой, двоичной подписи.
     Дальше все РЕЗЕРВЫ считаются по нему: fitPatW/fitPatW2, вычет у body.patnum-l .pat, сдвиги
     numColsL/numColsR в render(). --num-w остаётся тому, для чего и заводилась, — ширине самих
     боксов номеров; от неё раскладка полей больше не зависит.
     Своя переменная, а не переиспользованный --numl-slot: тот меряется в кегле поля цепочки (.85em)
     и с болванкой баланса, а номер в ячейке печатается кеглем паттерна. Числа разные, и путать их
     нельзя. */
  numProbeEl.className = "num num-probe";
  numProbeEl.textContent = slotPad;
  const wNumSlot = Math.ceil(numProbeEl.getBoundingClientRect().width) + 1;
  if (wNumSlot > 0) document.documentElement.style.setProperty("--num-slot", Math.max(wNumSlot, wNum) + "px");
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
/* HALF_ALIGNS остался без читателей (v1.358): единственным был полушаг линии оси, снятый по
   запросу «ось ровно над первым битом при всех выравниваниях». Набор не удаляю — он перечисляет
   «½»-выравнивания поимённо, и следующему, кому понадобится их отличить, искать заново незачем. */
const HALF_ALIGNS = new Set(["halfcenter", "halfstairs", "rhalfstairs", "axis12", "axisbit12"]);
/* ПОЛОЖЕНИЕ РУЧЕК КРАЙНИХ ПОЛЕЙ (v1.018, запрос пользователя: "такую же ручку для паттернов, как и
   основных битов, надо"). Отдельной функцией, а не куском updateAxisSplitPosition(), потому что её
   зовёт ещё и сама протяжка ручки: та обязана ехать вместе со своими глифами каждый кадр, а
   updateAxisSplitPosition() без maxLen просто спрятала бы ось (см. её первую же проверку).
   X берётся от РЕАЛЬНЫХ глифов (.pat-txt первой отрисованной строки), а не от коробки колонки:
   patOffL/patOffR двигают именно глифы, и ручка обязана стоять там, где они нарисованы СЕЙЧАС —
   иначе отставала бы от своего же поля ровно на текущий сдвиг.
   Высоту берём у оси цепочки, уже посчитанную ею: длина у всех трёх ручек одна и та же, и считать
   её второй раз (строка + линейка столбцов) незачем.
   Паттернов нет (пустая колонка — у неё и .pat-txt не печатается) — ручку прячем: двигать нечего,
   а висящая в пустоте линия только сбивала бы с толку. */
/* ═══ ГОРИЗОНТАЛЬНАЯ РУЧКА — ТЕПЕРЬ ПРОСТО СДВИГ ВСЕХ СТРОК ПО ВЕРТИКАЛИ (v1.043, запрос
   пользователя: "hsplit-top должна не границу перемещать, а сдвигать все строки; по
   функциональности только это, всё остальное удалить") ═══
   БЫЛО: «верхний край полей», он же горизонт (v1.026) — граница ходила по строкам, и всё, что
   оставалось выше неё, ВЫПАДАЛО из выравнивания и замирало снимком (alignHorizon + frozenAlign в
   fold-1-core.js). Весь этот механизм удалён целиком — снимки, их восстановление из кэша, ветки
   «за горизонтом» в обоих расчётах сдвига.
   СТАЛО: ручка тянет ВСЮ РАСКЛАДКУ вниз-вверх, шагом ровно в строку — chainShiftRows (см.
   fold-1-core.js), вертикальная пара к chainShiftCols у ручки #vsplitL0.
   ПОЧЕМУ НЕ ЧЕРЕЗ patOffLY/bitsOffY/patOffRY, как было в v1.043–v1.044: те двигают ТОЛЬКО ГЛИФЫ
   внутри неподвижных коробок. Заливки полей, колонка номеров, линейка столбцов и сами ручки
   оставались на месте, и вместо переезда картинки получалось, что биты уползают из своих полей
   (уточнение пользователя: "должна всё сдвигать, и поля тоже — это просто перемещение всего
   вверх-вниз вместе с номерами, как будто верхнее меню удлинили вниз"). chainShiftRows двигает
   САМУ .chain, а всё остальное позиционировано относительно неё и едет даром.
   Ручку отдельно двигать не надо и НЕЛЬЗЯ: она лежит внутри .chain, то есть уже едет вместе с ней.
   Её top так и остаётся верхом #rows — «пустота сверху» получается сама собой, потому что вниз
   уезжает весь блок целиком. */
/* ЛИНИЯ ГОРИЗОНТА (v1.131) — теперь она РЕЖЕТ цепочку по строке, а не стоит у её верхнего края.
   Раньше эта ручка тянула chainShiftRows (сдвиг всей КАРТИНКИ по вертикали), а сама линия всегда
   рисовалась по верхнему краю строк и ехала вместе с ними — резать ею было нечего.
   Теперь её положение — st.horizonRow, номер строки, ПЕРЕД которой проходит линия (см. horizonRow()
   в fold-1-core.js). Над линией — то, что идёт в расчёт; под линией не участвует ничто, включая
   наложения. 0 — линия у самого верха, правило спит, всё считается как раньше.
   chainShiftRows при этом никуда не делся: он по-прежнему живёт в кэше и в настройках и сдвигает
   картинку, просто эта ручка больше не он. Понадобится сдвиг картинки отдельной ручкой — заведём,
   но мешать два смысла в одном перетаскивании было и есть источник путаницы. */
/* СВОБОДНОЕ МЕСТО СЛЕВА ОТ П1 (v1.198) — сюда пускают биты длинного паттерна вместо обрезки
   по границе колонки (см. clip-path у .ln .pat в fold.html). Считаем от левого края колонки
   влево, придерживая тем, что там реально стоит: левой панелью настроек и полосой прокрутки,
   когда они открыты. Скрыты — места до самого края окна. Значение уходит в --pat-spill;
   ноль означает прежнее поведение, обрезку ровно по границе. */
function updatePatSpill(){
  const root = document.documentElement;
  const cell = document.querySelector("#rows .ln .pat");
  if (!cell) { root.style.setProperty("--pat-spill", "0px"); return; }
  let guard = 0;
  for (const id of ["leftPanel", "vScroll"]) {
    const el = document.getElementById(id);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    // Скрытая панель — коробка нулевая или уехавшая за край; такая не мешает.
    if (r.width > 0 && r.height > 0 && r.right > guard) guard = r.right;
  }
  const room = Math.floor(cell.getBoundingClientRect().left - guard - 2);
  root.style.setProperty("--pat-spill", (room > 0 ? room : 0) + "px");
}

/* Свободное место меняется и БЕЗ перерисовки: от размера окна и от того, скрыты ли панели
   (это просто класс на body, render за ним не идёт). Оба случая ловим сами и складываем
   пересчёт в кадр, чтобы частые переключения классов не дёргали раскладку. */
let patSpillQueued = 0;
function queuePatSpill(){
  if (patSpillQueued) return;
  patSpillQueued = requestAnimationFrame(() => { patSpillQueued = 0; updatePatSpill(); });
}
addEventListener("resize", queuePatSpill);
if (document.body) new MutationObserver(queuePatSpill)
  .observe(document.body, { attributes: true, attributeFilter: ["class"] });

/* Левая позиция оси цепочек в координатах #chain — её ставит updateAxisSplitPosition, а читает
   вырез горизонта ниже. null — оси на экране нет, вырезать не от чего. */
var lastAxisLeftPx = null;
/* ШИРИНА ВЫРЕЗА в горизонте по обе стороны от оси (v1.226, запрос пользователя: «обрежь горизонт-
   линию там, где ось цепочек, чтобы там не хваталась горизонт, влево-вправо от оси на сколько-то»).
   16px — чуть шире зоны захвата самой оси (13px), чтобы промахнуться мимо неё и попасть в горизонт
   было нельзя даже дрожащей рукой. */
const HORIZON_AXIS_GAP = 16;
function updateTopHorizon(){
  const el = document.getElementById("hsplitTop");
  if (!el) return;
  const chainEl = document.getElementById("chain");
  const rowsEl = document.getElementById("rows");
  if (!chainEl || !rowsEl || !(st.rows || []).length) { el.classList.remove("act"); return; }
  const rowH = Math.max(4, parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--row-h")) || 12);
  const h = (typeof horizonRow === "function") ? horizonRow() : 0;
  /* ЧЕРТА ВСЕГДА НАД ПОЛОСОЙ (v1.261, уточнение пользователя: «черта горизонта ВСЕГДА должна быть
     поднята над полосой»; в v1.260 она поднималась только в покое).
     Строки съехали вниз на целый ряд (--align-band-h): в нём стоят полоса выравниваний и просвет
     под ось. Черту поднимаем на этот же ряд при ЛЮБОМ положении горизонта — тогда полоса всегда
     висит прямо под ней, а не оказывается между чертой и битами.
     На СЧЁТ это не влияет: горизонт режет по номеру строки (horizonRow), а не по своей картинке;
     сдвинулась только линия на экране — ровно на тот ряд, на который сдвинулись сами строки. */
  const bandPxH = (() => {
    const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--align-band-h"));
    return isFinite(v) ? v : 0;
  })();
  /* ПОДНЯТЫЙ ГОРИЗОНТ — ПО НАСТОЯЩЕЙ ГРАНИЦЕ СТРОК (испр. v1.263, баг-репорт «паттерны над
     горизонтом зашли за горизонт»).
     В v1.261 черту поднимали на ряд полосы ВСЕГДА — чтобы полоса была под ней. Но при поднятом
     горизонте это враньё: линия оказывалась на ряд выше настоящей границы, и верхние строки поля
     вместе со своими паттернами оказывались «под» ней, хотя в расчёт идут как надстоящие.
     Ряд вычитаем только в ПОКОЕ (h = 0), где черта — просто ручка и ничего не отмечает; поднятый
     горизонт стоит ровно на границе строки h.
     «Полоса всегда под чертой» от этого не страдает: с v1.262 она не считает своё место сама, а
     висит на черте и едет вместе с ней. */
  /* Черта — по ВЕРХНЕЙ кромке разрыва (v1.266): разрыв открывает строка h (см. gapRowIdx в
     render), значит сама граница лежит там, где строка h стояла бы без него, — то есть ровно
     h высот строки от верха списка. Вычитать ряд полосы больше не нужно: он ниже черты, а не
     выше, и полоса в нём висит под ней (v1.262). */
  /* ═══ ЧЕРТА НЕ ПРИЖИМАЕТСЯ К МЕНЮ 1 (v1.454) ═══
     Уточнение пользователя: «толи там горизонт только попадает на меню 1 — отступи линию горизонт:
     пусть её начало, когда сверху ничего нет, отступ 2-3px от меню 1».
     В покое (горизонт выключен) черта стоит по верхней кромке строк, а та начинается сразу под
     зарезервированным отступом холста — то есть впритык к нижнему краю верхней полосы. Вплотную к
     ней ложится и меню 2: оно не считает своё место само, а висит на черте (v1.262). Отсюда и
     впечатление «наложились» — виноват был не расчёт полосы, а положение самой черты.
     Даём ей нижний упор: не выше низа меню 1 плюс три пикселя. Полосу это уводит вниз вместе с
     чертой, потому что она к черте и привязана.
     ТОЛЬКО В ПОКОЕ. Поднятый горизонт (h > 0) отмечает НАСТОЯЩУЮ границу строки, и двигать его
     ради красоты нельзя — это была бы ровно та ложь, которую чинили в v1.263: строки над чертой
     оказались бы визуально под ней.
     Меню внизу экрана (menubar-bottom) — упора нет: сверху ничего не висит.
     Полосу меряем живой, а не через --menubar-h: переменная ставится другим проходом и на кадр
     отстаёт (тот же разбор, что у потолка меню 2 в fold-3-ops.js, v1.450). */
  let horizonTopPx = rowsEl.getBoundingClientRect().top - chainEl.getBoundingClientRect().top
                     + h * rowH;
  if (h <= 0 && !document.body.classList.contains("menubar-bottom")) {
    const barLiveH = document.getElementById("menuBar");
    if (barLiveH && barLiveH.offsetHeight) {
      const minTopH = barLiveH.getBoundingClientRect().bottom
                    - chainEl.getBoundingClientRect().top + 3;
      if (horizonTopPx < minTopH) horizonTopPx = minTopH;
    }
  }
  el.style.top = horizonTopPx + "px";
  /* ШИРИНУ СТАВИМ ЧИСЛОМ (испр. v1.186, баг-репорт «обрезалась горизонт-линия, продли её вправо до
     конца браузера»). В CSS стояло width:max(100%,100vw), но 100% тут считается от #chain, а он
     заметно уже окна — линия и обрывалась на его правом краю. Считаем сами: берём наибольшее из
     ширины самой раскладки и ширины окна, плюс запас на отступ #chain от левого края экрана. */
  const chainLeft = chainEl.getBoundingClientRect().left;
  el.style.width = Math.max(chainEl.scrollWidth, window.innerWidth - chainLeft + 40) + "px";
  /* ВЫРЕЗ ПОД ОСЬ ЦЕПОЧЕК (v1.226). Горизонт — полоса на всю ширину раскладки с курсором
     row-resize, и у оси она проходила ровно под её чертой: тянешься за ось, а хватается горизонт.
     Вырезаем окно шириной 2×HORIZON_AXIS_GAP вокруг оси — clip-path режет не только картинку, но
     и попадание мыши, поэтому в этом окне полоса перестаёт ловить события вовсе, и ось (а заодно
     кнопки, что стоят рядом с ней) снова доступна.
     Полигон обходит ДВА прямоугольника — левее выреза и правее, — соединённые нулевой перемычкой
     по нижнему краю: две встречные стороны по одной прямой площади не дают, и окно остаётся
     пустым. Оси на экране нет — вырез снимаем, линия сплошная, как была. */
  const axisX = (typeof lastAxisLeftPx === "number" && isFinite(lastAxisLeftPx)) ? lastAxisLeftPx : null;
  if (axisX !== null) {
    const x1 = Math.max(0, axisX - HORIZON_AXIS_GAP).toFixed(1);
    const x2 = Math.max(0, axisX + HORIZON_AXIS_GAP).toFixed(1);
    el.style.clipPath = "polygon(0 0, " + x1 + "px 0, " + x1 + "px 100%, " + x2 + "px 100%, " +
                        x2 + "px 0, 100% 0, 100% 100%, 0 100%)";
  } else {
    el.style.clipPath = "";
  }
  el.classList.add("act");
  // .on — горизонт СЕЙЧАС режет (над ним есть строки). Это не «стоит на месте», а «работает».
  el.classList.toggle("on", h > 0);
  el.title = h > 0
    ? ("ГОРИЗОНТ режет цепочку перед строкой " + h + ": в расчёт идёт ТОЛЬКО то, что выше него — биты строк, их паттерны и лежащие там наложения. Всё ниже не участвует ни в склейках, ни в сквозной, ни в фон-поиске. Тяни линию, двойной клик — убрать горизонт")
    : "ГОРИЗОНТ выключен: считается вся цепочка. Потяни линию вниз — и в расчёт пойдёт только то, что окажется ВЫШЕ неё (включая наложения); всё ниже выпадет целиком";
}
{
  /* ПЕРЕТАСКИВАНИЕ. Шаг — ровно высота строки, чтобы «утащил на три» значило ровно три строки, а
     не «примерно». Сдвиг чисто визуальный (как и у вертикальной протяжки полей): данные, номера
     и расчёты столбцов его не видят, поэтому хватает applyPatOffsets() — render() не нужен. */
  const el = document.getElementById("hsplitTop");
  if (el) {
    const startHorizonDrag = (e) => {
      /* Восстановлено в v1.139: при правке 1.131 отсюда выпали проверка кнопки, preventDefault и
         сам y0 — точка отсчёта жеста. Без y0 смещение считалось как NaN, горизонт получал NaN,
         horizonRow() возвращала 0, и линия не двигалась ВООБЩЕ. Двигать её можно было только
         косвенно, утащив биты цепочки, — что пользователь и увидел. */
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      const y0 = e.clientY;
      const base = (typeof horizonRow === "function") ? horizonRow() : 0;
      const rowH = Math.max(4, parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--row-h")) || 12);
      el.classList.add("drag");
      document.body.classList.add("dragging");
      if (document.body.dataset.hov) document.body.dataset.hov = "";
      let applied = 0;   // сколько строк поля уже добавлено/снято за этот жест
      const move = (ev) => {
        /* ЛИНИЯ ОТКРЫВАЕТ МЕСТО, А НЕ ЕДЕТ ПО СТРОКАМ (v1.175, запрос: «отключи перетаскивание
           через строки цепочек, перетаскивание должно только открывать место сверху, не скакать
           по строкам»).
           Раньше жест двигал НОМЕР строки, перед которой режет линия, — то есть она проезжала
           сквозь цепочку, и под неё поочерёдно попадали настоящие строки. Теперь она меняет
           ВЫСОТУ ПОЛЯ: тянешь вниз — сверху добавляются пустые строки, тянешь вверх — снимаются.
           Цепочка при этом стоит на месте и в поле не втягивается никогда.
           Считаем от НАМЕРЕНИЯ жеста (applied), а не от текущей высоты: добавление строк сдвигает
           и сам горизонт, и точку отсчёта, и разница «сколько хотели минус сколько уже сделали»
           единственная величина, которая при этом не врёт.
           Снять можно только пустые строки без наложений — см. removeTopRows(); упёрлись в занятую,
           и поле дальше не сжимается, сколько ни тяни. */
        const want = Math.round((ev.clientY - y0) / rowH);
        const d = want - applied;
        if (!d) return;
        let done = 0;
        if (d > 0) done = addTopRows(d, true);
        else done = -removeTopRows(-d, true);
        if (!done) return;
        applied += done;
        /* Поля ещё не было — заводим его прямо жестом: горизонт выключен, и addTopRows его не
           двигает, потому что двигать нечего. Высота поля равна тому, сколько уже открыли. */
        if ((st.horizonRow | 0) <= 0 && applied > 0) st.horizonRow = applied;
        render();
        updateTopHorizon();
      };
      const up = () => {
        el.classList.remove("drag");
        document.body.classList.remove("dragging");
        window.removeEventListener("mousemove", move);
        window.removeEventListener("mouseup", up);
        /* Паттерны раскладываем по итогу жеста, а не на каждом кадре: их число зависит от высоты
           поля, а она меняется до самого отпускания кнопки (v1.175). */
        if (typeof syncFieldPatterns === "function") syncFieldPatterns();
        render();
        saveCache();
        const h = (typeof horizonRow === "function") ? horizonRow() : 0;
        say(h ? ("Поле наложений: " + h + " строк над цепочкой. Паттерны цепочки разложены в него по порядку, сколько поместилось. Тяни линию — поле открывается и закрывается; сама цепочка стоит на месте.")
              : "Поле наложений закрыто — считается вся цепочка.");
      };
      window.addEventListener("mousemove", move);
      window.addEventListener("mouseup", up);
    };
    el.addEventListener("mousedown", startHorizonDrag);
    /* ═══ ХВАТ — ВСЯ НУЛЕВАЯ СТРОКА ТАМ, ГДЕ НЕТ КНОПОК (v1.441) ═══
       Запрос пользователя: «сделай хват перетаскивания горизонт за всю 0 строку, где нет кнопок в
       местах».
       Сама черта — полоска в несколько пикселей: чтобы её взять, надо прицелиться. А ряд, по
       верхней кромке которого она идёт, — это вся нулевая строка во всю ширину раскладки, и в
       ней полно пустого места: слева и справа от меню 2, между планками П1/П2 и полосой.
       Ловим нажатие на .chain в ФАЗЕ ПЕРЕХВАТА и, если оно пришлось в нулевую строку и не на
       управляющий элемент, ведём тот же жест, что и от самой черты, — функция одна на оба входа,
       второй логики протяжки не заводим.
       Перехват (capture) обязателен: под рядом лежит настоящая нулевая строка цепочки со своим
       обработчиком клика, и в обычной фазе она забрала бы нажатие себе.
       СПИСОК ИСКЛЮЧЕНИЙ — всё, у чего в этом ряду свой жест: кнопки и поля ввода (меню 2, планки
       П1/П2, пикеры цвета, замок), слоты закреплённых значков, ручки границ полей и ось цепочки.
       По ним всё работает как работало.
       ВЕРТИКАЛЬНЫЙ ДИАПАЗОН считаем как у приёмника закреплённых кнопок (wireRowZeroAsPinTarget):
       по самой полосе меню 2 — она и есть нулевая строка и от горизонта не зависит, — а заливку
       ряда берём, только если она посчитана, и лишь чтобы захватить межстрочные просветы. */
    const chainForHorizon = document.getElementById("chain");
    if (chainForHorizon) {
      const CTRL_SEL = "button, input, select, textarea, .align-pin-slot, .align-pin-slots," +
                       " .pat-strip-lab, .axis-col-box, .axis-strip, .pat-strip, .stairs-axis," +
                       " .vsplit, .vsplit2, .vsplit3, #vsplitL0, .axis-split, .paste-bar, .hsplit-top";
      chainForHorizon.addEventListener("mousedown", (e) => {
        if (e.button !== 0) return;
        if (e.target && e.target.closest && e.target.closest(CTRL_SEL)) return;
        const grpH = document.getElementById("alignGrp");
        if (!grpH || !grpH.offsetHeight) return;
        const gR = grpH.getBoundingClientRect();
        let top = gR.top, bottom = gR.bottom;
        const bandH2 = document.getElementById("bandBg");
        if (bandH2 && bandH2.classList.contains("act")) {
          const bR = bandH2.getBoundingClientRect();
          if (bR.height > 0) { top = Math.min(top, bR.top); bottom = Math.max(bottom, bR.bottom); }
        }
        if (e.clientY < top || e.clientY > bottom) return;
        startHorizonDrag(e);
      }, true);
    }
    /* ═══ ДВОЙНОЙ КЛИК ВЕРНУЛСЯ, НО С ДРУГИМ ПРАВИЛОМ (v1.428) ═══
       Запрос пользователя: «пусть двойной клик по границе горизонта перемещает его в самый низ,
       если сейчас над ним нет ничего, и в самый верх, если что-то есть».
       В v1.152 двойной клик швырял линию в край наугад и был убран в v1.177 как спорящий со смыслом
       жеста. Здесь правило другое и однозначное: он ПЕРЕКЛЮЧАЕТ поле наложений между «закрыто» и
       «раскрыто во весь холст» — по тому, есть ли сейчас что-то наверху.
       ПОЛЕ ПУСТО (высота 0) — раскрываем на весь видимый холст: считаем, сколько строк туда влезет,
       и открываем столько. Больше и не нужно: то, что за нижней кромкой, всё равно не видно, а
       строки — это память и перерисовка.
       ПОЛЕ ОТКРЫТО — закрываем целиком. removeTopRows сама остановится на первой занятой строке
       (там, где лежат биты или наложение), так что «в самый верх» значит «до первой непустой»:
       содержимое жест не трогает никогда, ровно как и протяжка.
       Обе ветки идут теми же функциями, что и протяжка линии, — addTopRowsBulk/removeTopRows, — и
       заканчиваются тем же хвостом: паттерны по полю, перерисовка, сохранение. Второго способа
       открывать поле не заводим. */
    el.addEventListener("dblclick", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const openNow = (typeof horizonRow === "function") ? horizonRow() : 0;
      let done = 0;
      if (openNow > 0) {
        done = -(typeof removeTopRows === "function" ? removeTopRows(openNow, false) : 0);
      } else {
        const sc = document.getElementById("screenCanvas");
        const rowH = Math.max(4, parseFloat(getComputedStyle(document.documentElement)
                                              .getPropertyValue("--row-h")) || 12);
        const fit = sc ? Math.max(1, Math.floor(sc.clientHeight / rowH) - 1) : 20;
        done = (typeof addTopRowsBulk === "function") ? addTopRowsBulk(fit, false) : 0;
        if (done > 0 && (st.horizonRow | 0) <= 0) st.horizonRow = done;
      }
      if (!done) { say("Поле наложений: двигать нечего — выше линии стоят непустые строки."); return; }
      if (typeof syncFieldPatterns === "function") syncFieldPatterns();
      render(); updateTopHorizon(); saveCache();
      const h = (typeof horizonRow === "function") ? horizonRow() : 0;
      say(h ? ("Поле наложений раскрыто: " + h + " строк над цепочкой. Двойной клик по линии — закрыть.")
            : "Поле наложений закрыто. Двойной клик по линии — раскрыть его во весь холст.");
    });
    /* ДВОЙНОЙ КЛИК ПО ЛИНИИ УБРАН (v1.177, запрос: «убери двойной клик по нему»). В v1.152 он
       швырял горизонт в самый низ или в самый верх, и это спорило с новым смыслом линии: она
       больше не ездит по цепочке, а открывает и закрывает место сверху. Прыжок «в самый низ»
       означал бы разом втянуть в поле всю цепочку — ровно то, чего быть не должно.
       Закрыть поле теперь можно тем же перетаскиванием: тянешь линию вверх до упора.
       ═══ ЖЕСТ ВЕРНУЛСЯ В v1.428 ═══ но не прежним: там он бросал линию в край наугад, а теперь
       переключает поле между «закрыто» и «раскрыто во весь холст», и по содержимому решает, куда
       именно. Разбор — у самого обработчика выше. Прежний текст оставлен: он объясняет, почему
       «в самый низ» само по себе, без оглядки на содержимое, было неверным. */
  }
}
/* РУЧКИ ОСЕЙ П1/П2 — КОРОТКИЕ, ТОЛЬКО ШАПКА ПЛЮС ПЕРВАЯ СТРОКА (v1.038, баг-репорт пользователя:
   "0 строка уезжает, и захват только по ней идёт" — про то, что границу поля не поймать нигде,
   кроме самого верха).
   ПРИЧИНА БЫЛА ИМЕННО ЗДЕСЬ, а не у самих границ. Ручки стоят по СОДЕРЖИМОМУ ПЕРВОЙ СТРОКИ
   (.pat .pat-txt — глиф, а не коробка), то есть уезжают вместе с row 0 при любом выравнивании и
   любом сдвиге поля. Высоту они копировали у оси цепочки — та с v1.029 растянута на всё полотно, —
   и получалась полоса захвата 13px во всю высоту при z-index:16, поверх границ поля (10). Куда бы
   ни уехала нулевая строка, её ручка накрывала границу от шапки до низа, и мышь всюду доставалась
   оси. Хватать границу оставалось только там, где ручки нет.
   Полная высота нужна была ОСИ ЦЕПОЧКИ (v1.029, "тянуть только за верхнюю получается — надо по
   всей высоте чтоб") — про эти две речи не было, они просто унаследовали её число. Оставляем им
   ровно ту высоту, на которой нарисованы их собственные знаки «1 над 1» с подписями П1/П2: брать
   ручку за знак естественно, а ниже граница поля свободна по всей длине столбца.
   +8px — небольшой запас под подписи (они на top:11.5px, см. .axis-split-pat::after в CSS), чтобы
   зона захвата не обрывалась ровно по букве. */
/* updatePatFieldHandles() УДАЛЕНА в v1.081. Она ставила ручки-оси крайних полей
   (#axisSplitPatL/#axisSplitPatR) по глифам паттернов и подвешивала к ним планки «П1»/«П2».
   Ручек больше нет — двигать поля нечем с v1.066, и служили они только якорем, — а планки теперь
   прибиты к ГРАНИЦАМ своих полей прямо в updateSplitPositions(), там же, где считаются сами
   границы (см. placeStrip там). Вызовы этой функции убраны вместе с ней. */
/* ═══ СЧЁТЧИКИ ЛЕСЕНОК ПО ОБЕ СТОРОНЫ ОСИ (v1.281) ═══
   Запрос пользователя: «на уровне самой оси справа и слева от нее сделай».
   Обе коробки живут в .chain и позиционируются абсолютом в её координатах — ровно как сама ручка
   оси, поэтому им годится тот же leftPx, что только что посчитан для линии, без единого
   пересчёта. Вертикаль — середина отрезка оси: коробка ниже его не выйдет (отрезок ростом в
   просвет --axis-gap-h, а в ней один ряд полей), и на биты, значит, не наедет.
   ЛЕВАЯ ПРИЖАТА ПРАВЫМ КРАЕМ, ПРАВАЯ — ЛЕВЫМ: обе смотрят на ось, между ними остаётся её линия.
   Зазоры разные (6 слева, 8 справа) не по прихоти — линия рисуется ::before'ом со сдвигом left:5px
   внутри 13px-ручки, то есть стоит не по центру своей коробки, а ближе к левому краю.
   ПОКАЗЫВАЕМ ТОЛЬКО ПРИ ЛЕСЕНКАХ — на остальных выравниваниях stairsGroupFor()/alignShift() эти
   числа не читают вовсе (см. fold-1-core.js), и висеть им на холсте незачем.
   Зажим по нулю слева: на узком поле цепочки левая коробка иначе уехала бы за край холста. */
/* ═══ ПОКАЗЫВАЕМ ТОЛЬКО КОРОБКУ ДЕЙСТВУЮЩЕЙ ЛЕСЕНКИ (испр. v1.283) ═══
   Запрос пользователя: «только свои настройки показывать для левой и правой отдельно лесенки».
   С v1.281 при любой лесенке висели ОБЕ коробки, хотя пара полей всегда работает ровно одна:
   stairsGroupFor()/stairsStepFor() (fold-1-core.js:335,346) читают ...L только при ↙/↙½
   (rstairs/rhalfstairs) и ...R при ↘/↘½ (stairs/halfstairs). Вторая коробка была не просто
   лишней — она предлагала крутить числа, которые на текущем выравнивании ни на что не влияют.
   Сторону коробки НЕ меняем: ↙ остаётся слева от оси, ↘ справа — стрелка в заголовке смотрит
   туда же, куда уходит лесенка. */
/* Здесь жила lastNumColOffset — замеренное расстояние от правого края колонки точек до левого
   края столбца номеров (v1.316). Ею кнопка «№» восстанавливала ЛЕВЫЙ край столбца, когда номера
   выключены и мерить нечего. В v1.317 столбец стал вставляться влево, левый край у него подвижен,
   и кнопка перешла на правый — привязку к началу поля бит восстанавливать ничем не надо (см.
   updateAxisSplitPosition). Переменная удалена как мёртвая. */
const STAIRS_ALIGNS = new Set(["stairs", "halfstairs", "rstairs", "rhalfstairs"]);
const STAIRS_BOX_BY_ALIGN = { rstairs: "stairsAxisL", rhalfstairs: "stairsAxisL",
                              stairs: "stairsAxisR", halfstairs: "stairsAxisR" };
function hideStairsAxisBoxes(){
  ["stairsAxisL", "stairsAxisR"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove("act");
  });
}
/* ═══ КОРОБКИ У ОСИ НЕ ЛЕЗУТ НА ПОЛОСУ (испр. v1.324) ═══
   Баг-репорт: «наложение кнопок» — пикеры цвета и замок наехали на кнопки полосы
   выравниваний.
   Причина — в v1.322/1.323 убран просвет под полосой. Ось растёт ВВЕРХ от первой строки
   цепочки и короче 14px не бывает (нижний упор ниже), а все коробки у оси ставятся по
   СЕРЕДИНЕ этого отрезка. Раньше отрезок целиком лежал в двух строках просвета, теперь
   просвета нет и середина приходится НА ПОЛОСУ.
   Нижний упор по вертикали: выше нижней кромки разрыва коробка не поднимается никогда.
   Тогда она стоит на нулевой строке — там, куда ось доведена с v1.302 и где битов не бывает.
   УПОР ПЕРЕСТАВЛЕН НА ВЕРХ ОСИ (v1.326). В v1.324 им был НИЗ разрыва — и коробки,
   перестав лезть на полосу, стали лезть на паттерны (баг-репорт «чтобы кнопки не наезжали
   на паттерны»): места между полосой и строками не было вовсе, и любой упор выталкивал
   их на что-то одно. С v1.326 разрыв снова выше полосы на целый ряд коробок (см.
   layoutOverlayBoxes в fold-3-ops.js), и упором служит верх самой оси: коробка стоит в его
   ряду и выше не поднимается, даже если сама окажется выше отрезка. */
function positionStairsAxisBoxes(axisLeftPx, axisTopPx, axisH, minTopPx){
  const gL = document.getElementById("stairsAxisL");
  const gR = document.getElementById("stairsAxisR");
  if (!gL || !gR) return;
  // Гасим обе и зажигаем одну: так не нужно помнить, что было показано в прошлый заход.
  hideStairsAxisBoxes();
  if (!STAIRS_ALIGNS.has(st.align)) return;
  const box = document.getElementById(STAIRS_BOX_BY_ALIGN[st.align]);
  if (!box) return;
  // Класс вешаем ДО замера: у скрытой коробки display:none, и offsetWidth/offsetHeight были бы нули.
  box.classList.add("act");
  /* ═══ КОРОБКА УХОДИТ ПОД МЕНЮ 2 И В СТОРОНУ ОТ САМОЙ ЛЕСЕНКИ (v1.374) ═══
     Запрос пользователя: «меню у лесенок клади в другую сторону лесенки и спусти вниз под меню 2».
     ПО ВЕРТИКАЛИ. Коробка центровалась по середине отрезка оси и с v1.353, когда из разрыва убрали
     ряд под неё, оказалась ровно на полосе выравниваний. Ставим её ПОД полосой: верх — низ меню 2
     плюс пара пикселей. Черта горизонта и высота полосы уже посчитаны и лежат в DOM
     (#hsplitTop.style.top и --strip-h, см. positionAlignGrpTop в fold-3-ops.js) — берём готовое, а
     не считаем второй раз.
     ПО ГОРИЗОНТАЛИ — В ПРОТИВОХОД СТУПЕНЬКАМ. Раньше сторона выбиралась по имени коробки: «левая»
     слева от оси, «правая» справа. Но лесенка ↘ и уводит биты ВПРАВО — коробка ложилась ровно на
     них; у ↙ то же самое зеркально. Меняем правило на «в другую сторону»: у ↘ коробка слева от
     оси, у ↙ — справа. Ступеньки уходят от неё, а не под неё, при любой глубине.
     Прижатие к оси прежнее: та коробка, что слева, — правым краем, та, что справа, — левым, между
     ними остаётся сама линия. Зазоры 6 и 8 тоже прежние (линия рисуется не по центру своей ручки,
     разбор — в комментарии v1.281 у вызова). */
  const hLineForStairs = document.getElementById("hsplitTop");
  const stripHForStairs = parseFloat(getComputedStyle(document.documentElement)
                                       .getPropertyValue("--strip-h")) || 22;
  const underMenu2 = (hLineForStairs && hLineForStairs.classList.contains("act"))
    ? ((parseFloat(hLineForStairs.style.top) || 0) + 3 + stripHForStairs + 2)
    : (axisTopPx + axisH / 2 - box.offsetHeight / 2);
  box.style.top = Math.round(Math.max(minTopPx || 0, underMenu2)) + "px";
  const toLeftOfAxis = (box === gR);   // ↘ ведёт вправо — коробку налево, и наоборот
  const left = toLeftOfAxis ? (axisLeftPx - 6 - box.offsetWidth) : (axisLeftPx + 8);
  box.style.left = Math.round(Math.max(0, left)) + "px";
}
/* ═══ ЦВЕТА «1» И «0» ЦЕПОЧКИ — ПРЯМО У ОСИ, СЛЕВА ОТ НЕЁ (v1.320) ═══
   Запрос пользователя: «и слева от оси цепочек также для 0 и 1 цвета».
   Пара к тем, что этой же версией встали в планки «П1»/«П2» (см. .pat-strip в разметке): там
   цвета колонок паттернов, тут — самой цепочки, --c1/--c0. Оба пикера дублируют панельные #col1 и
   #col0, значение одно на всех (то же решение, что в v1.171 у наложений: панель видна не всегда,
   а холст — всегда).
   Место — зеркало правой коробки лесенки: прижата ПРАВЫМ краем к оси, вертикаль по середине её
   отрезка. Показана при любом выравнивании, в отличие от лесенок: цвет нужен всегда.
   ОТСТУПАЕТ ОТ ЛЕВОЙ ЛЕСЕНКИ. Коробка «Лесенка ↙» встаёт на то же место (v1.281/1.283) и видна
   при ↙/↙½ — на этих выравниваниях пикеры уходят ещё левее, за неё, а не под неё. Читаем её
   offsetWidth уже ПОСЛЕ positionStairsAxisBoxes: та вешает .act до замера, значит ширина к этому
   моменту настоящая, а не нулевая от display:none. */
/* ═══ ОБЕ КОРОБКИ ПЕРЕЕХАЛИ В ПОЛОСУ ВЫРАВНИВАНИЙ (v1.353) ═══
   Запрос пользователя: «кнопки у оси, которые сейчас, — сюда перемести» (в меню выравниваний), и
   там же «убери отступ от 0 строки и меню».
   Одно вытекает из другого: ряд под эти коробки и был тем отступом. Его завели в v1.326/v1.327 —
   целую строку между полосой и нулевой строкой, чтобы пикеры, замок и счётчики лесенок не легли ни
   на полосу, ни на биты. Коробки ушли в полосу — ряд стал не нужен, и разрыв убран (см.
   --align-band-h в fold-3-ops.js).
   Функцию не удаляю, а обнуляю: её зовёт updateAxisSplitPosition каждым кадром, и через неё же
   коробки получают .act — без класса они не показались бы вовсе (display:none у .axis-col-box).
   Заодно стираем left/top, оставшиеся от прежних кадров: в полосе коробки стоят в потоке, и
   старые координаты сдвинули бы их, если бы CSS не перебил position (см. #alignGrp .axis-col-box
   в стилях — там position:static). */
function positionAxisColBox(axisLeftPx, axisTopPx, axisH, minTopPx){
  const box = document.getElementById("axisColBox");
  if (box) { box.classList.add("act"); box.style.left = ""; box.style.top = ""; }
  const lockNow = document.getElementById("axisLockBox");
  if (lockNow) { lockNow.classList.add("act"); lockNow.style.left = ""; lockNow.style.top = ""; }
}
/* Прежнее тело positionAxisColBox (v1.320…v1.324) удалено в v1.353 как мёртвое: оно считало
   коробкам место у оси — отступ от лесенок, вертикаль по середине отрезка, зеркальную посадку
   замка. В полосе выравниваний всё это делает обычный поток, и восстанавливать расчёт незачем.
   Понадобится вернуть коробки к оси — история в archive\Zerkalius-fold\v1352\. */
/* v1.353: коробки живут в полосе выравниваний и от наличия строк больше не зависят — цвет «1»/«0»
   и замок нужны и на пустой цепочке, а полоса на экране есть всегда. Прятать их вместе с осью
   перестаём; функция оставлена, потому что её зовёт ветка «строк нет» в updateAxisSplitPosition. */
function hideAxisColBox(){}
/* ═══ ПЕРЕЕЗД: ПИКЕРЫ, ЗАМОК И СЛОТЫ — В ПОЛОСУ ВЫРАВНИВАНИЙ (v1.353) ═══
   Запрос пользователя: «все слоты сдвинь вправо» и «кнопки у оси, которые сейчас, — сюда
   перемести».
   Переносим узлы, а не переписываем разметку: и коробки, и слоты — сложные элементы со своими
   обработчиками (пикеры связаны с панельными #col1/#col0 через syncColTwins, замок держит
   selectEnabled, слоты принимают перетаскивание значков). Перенос узла всё это сохраняет как есть,
   тогда как копия в новом месте потребовала бы заново развесить каждый обработчик.
   ПОРЯДОК В ПОЛОСЕ: пикеры и замок встают в НАЧАЛО (там же, где стояла кнопка «⧉», — левый край
   полосы), слоты закреплённых значков уходят оба в КОНЕЦ, к правому краю.
   Делается один раз при загрузке: полоса и коробки объявлены в разметке выше по файлу, скрипты
   подключены в самом низу — к этому моменту оба узла уже есть. */
{
  const grpMove = document.getElementById("alignGrp");
  const colBoxMove = document.getElementById("axisColBox");
  const lockBoxMove = document.getElementById("axisLockBox");
  const pinLMove = document.getElementById("alignPinL");
  const pinRMove = document.getElementById("alignPinR");
  if (grpMove) {
    if (colBoxMove) grpMove.insertBefore(colBoxMove, grpMove.firstChild);
    if (lockBoxMove) grpMove.insertBefore(lockBoxMove, colBoxMove ? colBoxMove.nextSibling : grpMove.firstChild);
    // Левый слот — к правому: «все слоты вправо».
    if (pinLMove && pinRMove) grpMove.insertBefore(pinLMove, pinRMove);
    /* ═══ ПОДПИСИ ПОЛЕЙ — В ДВЕ СТРОКИ (v1.370) ═══
       Запрос пользователя: «П и ниже её 1 — там как раз 2 строки занимает меню 2», и следом «ну и
       П2 также».
       Подписи сели ЦЕНТРОМ на линии своих границ (см. placeStrip выше), а полоса границы шириной в
       один бит — «П1» поперёк неё не помещается вдвое. Разворачиваем в столбик: буква над цифрой.
       Ширина подписи становится в один знак, то есть в полосу она укладывается почти вровень, а по
       высоте место есть — меню 2 и так занимает там два ряда.
       Делаем разбор в JS, а не в разметке: подпись служит ещё и кнопкой (клик снимает точки
       найденных, см. fold-4-tools.js), и переписывать её текст руками в двух местах — лишний повод
       им разойтись. Текстовые узлы и <br>, а не innerHTML: строка тут известна поимённо, и
       разбирать разметку незачем.
       Порядок важен: этот блок идёт ПОСЛЕ того, как обработчик клика уже навешен, — он трогает
       только содержимое, а сам элемент остаётся тем же, так что слушатель на месте. */
    /* ═══ ПОДПИСЬ — ОДНА БУКВА (v1.413) ═══
       Запрос пользователя: «П1 и П2 на границе — оставь там только П и Л соответственно».
       В v1.370 подписи разворачивали в два этажа, чтобы «П1» уместилась поперёк полосы границы
       шириной в бит. С одной буквой этаж нужен один: она и так укладывается в полосу, а столбик из
       буквы и цифры был вынужденной мерой, а не задумкой.
       Класс .pat-strip-lab-2row больше не вешаем — правило под него в стилях остаётся на случай
       возврата двухэтажной подписи, но сейчас ни на ком не срабатывает.
       Буквы задаём здесь же, рядом с остальным переездом: в разметке они по-прежнему «П1»/«П2», и
       менять её ради одной буквы значило бы держать надпись в двух местах. */
    const STRIP_LAB_TEXT = { patStripL: "П", patStripR: "Л" };
    ["patStripL", "patStripR"].forEach(sid => {
      const stripEl = document.getElementById(sid);
      const labEl2 = stripEl ? stripEl.querySelector(".pat-strip-lab") : null;
      if (!labEl2) return;
      labEl2.textContent = STRIP_LAB_TEXT[sid];
    });
    /* ═══ КНОПКИ «№» ПЕРЕЕХАЛИ В ПОЛЕ ЦЕПОЧКИ, К ГРАНИЦАМ (v1.443) ═══
       Запрос пользователя: «кнопки № перемести в Ц, прижми к Г».
       Обе жили в своих планках и стояли по свою сторону границы, в поле паттернов: «№» П1 —
       левее линии П1|Ц, «№» П2 — правее линии Ц|П2. Планка при этом растёт от линии наружу и
       упирается в ширину колонки: на узкой колонке кнопка уезжала под кромку.
       Вынимаем обе из планок и вешаем прямо на .chain: каждая прижимается к СВОЕЙ границе изнутри
       поля цепочки — левая сразу за линией П1|Ц, правая вплотную перед линией Ц|П2. Место в поле
       цепочки есть всегда, и от ширины крайних колонок кнопки больше не зависят.
       Обработчики остаются на них: элемент тот же, переезд — только смена родителя (клики навешаны
       по id в fold-4-tools.js и переживают перенос). Место считает updateSplitPositions рядом с
       планками — там уже посчитаны обе линии и высота нулевой строки. */
    /* Переезд v1.444 (вместе с «№» уводили и кнопки выравнивания колонок) ОТМЕНЁН в v1.445:
       уточнение пользователя — речь шла не о кнопках, а о самих номерах в ячейках. Кнопки «⇤»
       остаются в своих планках, как и стояли. */
    ["bPatNumL", "bPatNumR"].forEach(bid => {
      const btnNum = document.getElementById(bid);
      const chainForNum = document.getElementById("chain");
      if (!btnNum || !chainForNum || btnNum.parentElement === chainForNum) return;
      btnNum.classList.add("num-btn-float");
      chainForNum.appendChild(btnNum);
    });
    /* ═══ ПЛАНКИ «П1»/«П2» СЮДА НЕ ПЕРЕЕЗЖАЮТ (v1.357 → отменено в v1.365) ═══
       Уточнение пользователя: «кнопки, которые были у П1 и П2, держи на своих полях, но на той же
       высоте, что и меню выравниваний».
       В v1.357 я понял «в эту же полосу меню» буквально и перенёс планки внутрь #alignGrp. Речь
       была про ОДНУ ЛИНИЮ, а не про один контейнер: каждая планка правит своё поле и стоять должна
       над ним, иначе кнопка «⇤» у «П2» оказывается в другом конце экрана от самой П2.
       Возвращаем их плавающими — место им, как и раньше, считает placeStrip в
       updateSplitPositions, и высоту она берёт у полосы выравниваний (alignBarTop, правило v1.265).
       То есть «на той же высоте» соблюдается тем же кодом, что и до переезда.
       Пикеры цепочки, замок и слоты закреплённых значков в полосе ОСТАЮТСЯ: они не привязаны ни к
       какому крайнему полю, и там им самое место. */
  }
}
function updateAxisSplitPosition(maxLen){
  const axisSplitEl = document.getElementById("axisSplit");
  if (!axisSplitEl) return;
  // Строк нет вовсе — прячем и ось, и обе ручки крайних полей, и текстовую полоску под осью:
  // ставить их не на что.
  if (!maxLen) {
    axisSplitEl.classList.remove("act");
    const s0 = document.getElementById("axisStrip");
    if (s0) s0.classList.remove("act");
    hideStairsAxisBoxes();   // v1.281: оси нет — не на что вешать и счётчики
    hideAxisColBox();        // v1.320: и пикеры цвета у оси — тоже
    return;
  }
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
  /* ═══ ПОЛУШАГ У «½»-ВЫРАВНИВАНИЙ СНЯТ (v1.358) ═══
     Запрос пользователя: «ось цепочек размести ровно над первым битом первой строки при всех
     выравниваниях».
     Именно этот блок и был единственным местом, где ось от первого бита отходила. У «½»-режимов
     строки сдвинуты на полсимвола, и в v0.856 линию двигали на те же полшага — чтобы она шла по
     ЦЕНТРУ знака, а не втыкалась в цифру сбоку. Тогда это читалось как аккуратность, но правило
     оказалось своим для половины выравниваний: на «↔½» ось стояла в одном месте относительно бита,
     на «↔» — в другом.
     Теперь правило одно на все: ось встаёт ровно на ЛЕВЫЙ КРАЙ первого настоящего бита первой
     строки — туда, где его и меряет axisScreenPx(). «Первая строка» здесь та же, что и была,
     firstRealRowIdx: у строки без бит первого бита нет, и мерить у неё нечего.
     Величина была чисто визуальной — ни st.axisCenterOffset, ни axisBaseCol() она не трогала, —
     поэтому снятие не задевает ни перетаскивание оси, ни арифметику столбцов.
     realBitCharPx() остаётся: её же зовут в других местах. */
  /* ═══ ОСЬ ПО ЦЕНТРУ ПЕРВОГО БИТА, А НЕ ПО ЕГО КРАЮ (v1.390) ═══
     Запрос пользователя: «ось Ц над битом 1 строки по центру, ровно над ним».
     В v1.358 я свёл все выравнивания к одному правилу и посадил ось на ЛЕВЫЙ КРАЙ первого бита —
     туда, где его меряет axisScreenPx(). Правило одно на всех, это осталось верным; уточняется
     только точка внутри самого бита: не край, а середина знака.
     Полшага берём по РЕАЛЬНОЙ ширине знака (realBitCharPx), а не по chPx: тот считан через
     canvas.measureText и с раскладкой браузера расходится на доли пикселя — на половине знака это
     видно глазом (в своё время так и жаловались: «как-то не совсем по центру символа»). Замера
     нет (строк ещё нет в DOM) — берём chPx, он тут запасной.
     Ручку не поправляем: у .axis-split margin-left:−6px при ширине 13px, то есть переданная
     координата и есть середина её линии. Прибавили полшага — середина линии села на середину
     знака.
     Сдвиг чисто визуальный, как и прежний: ни st.axisCenterOffset, ни axisBaseCol() он не трогает,
     значит перетаскивание оси и счёт столбцов прежние. */
  {
    const charPxAxis = realBitCharPx() || chPx;
    if (charPxAxis > 0) leftPx += charPxAxis / 2;
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
  // Где сейчас стоит ось — по ней горизонт делает вырез (v1.226, см. updateTopHorizon).
  lastAxisLeftPx = leftPx;

  /* ЗОНА ЗАХВАТА — НА ВСЮ ВЫСОТУ ПОЛЯ (v1.029, запрос пользователя: "тянуть только за верхнюю
     получается — надо по всей высоте чтоб"). Раньше ручка была ростом в линейку столбцов плюс ОДНУ
     строку (v0.856, "ручку-ось укороти, пусть только на строку, на бит ложится") — тогда она сама
     же и рисовала линию, и длинная линия резала картинку. Теперь линии нет вовсе: у оси цепочки
     знаки печатает планка (v1.027), у ручек паттернов — короткие «1 1» вверху, и они прибиты к
     top:0, то есть от высоты элемента не зависят. Значит высоту можно отдать целиком под захват:
     ось цепляется на любом ряду, а не только у самой шапки.
     Меряем РЕАЛЬНУЮ высоту #rows, а не считаем формулой из числа строк: при виртуализации в DOM
     лежит лишь окно видимости, и «строк × высота строки» дало бы совсем другое число. */
  /* ОСЬ КОНЧАЕТСЯ У ВЕРХА ПОЛЯ, НА БИТЫ НЕ ЗАХОДИТ (v1.086, запрос пользователя: "ось не нужна на
     битах, только вверху"). До v1.083 линии у оси не было вовсе — была невидимая зона захвата во
     всю высоту #rows, и её длина никому не мешала. Как только ось снова стала настоящей линией,
     эта высота начала резать картинку сверху донизу.
     Теперь и линия, и зона захвата идут от верха раскладки до ВЕРХНЕЙ ЧЕРТЫ ПОЛЯ — там же, где
     стоят планки. Хватать ось на битах больше нельзя, но там её и не видно; зато на самих битах
     снова свободно и для выделения, и для протяжки. */
  const rowsBoxEl = document.getElementById("rows");
  const rowsTop = rowsBoxEl ? (rowsBoxEl.getBoundingClientRect().top - chainRect.top) : 24;
  /* Высоту и верх ручки ставим ниже, по самой линии (v1.252) — прежняя «во всю шапку» ушла под
     полосу выравниваний и перестала ловить мышь. */
  /* ЛИНИЯ ДОХОДИТ ДО ПЕРВОГО БИТА ЦЕПОЧКИ (v1.210, запрос пользователя: «ось не отделяй от битов
     цепочек, когда вверху появляются строки для наложений»).
     Верхнее поле наложений — это пустые строки в НАЧАЛЕ списка (см. addTopRows/syncFieldPatterns):
     цепочка от них уезжает вниз на десяток строк, а линия кончалась у верхней черты поля — между
     ней и первым битом повисал провал, и ось читалась как деталь, висящая сама по себе.
     Низ линии теперь считается по firstRealRowIdx() — по ТОЙ ЖЕ строке, по которой выше меряется
     её левая позиция: и низ, и лево у оси говорят про одну строку, что и значит «не отделять».
     Правило v1.086 «ось не заходит на биты» не нарушено: пройденные строки бит цепочки не имеют.
     ЗОНА ЗАХВАТА РАВНА ЛИНИИ (v1.252): ручка ставится ровно по отрезку — где ось видно, там её и
     хватают. Прежняя «во всю шапку» ушла под полосу выравниваний (v1.239) и мышь ловить перестала,
     а над полем наложений её и не должно быть: блок, попавший под ось, надо чем-то хватать.
     Строку меряем в DOM; при виртуализации её в разметке может не быть — тогда считаем по шагу
     строки, тем же vrowsPitchPx(), которым считает прокрутка. */
  /* ═══ ОСЬ ПРИВЯЗАНА К ГОРИЗОНТУ, А НЕ К ПЕРВОЙ СТРОКЕ (v1.267) ═══
     Запрос пользователя: «ось цепочки не должна ехать вверх-вниз — только вместе с горизонтом».
     Низ линии считался по firstRealRowIdx() — первой строке с настоящими битами (v1.210). Она
     гуляет сама по себе: дописали строку сверху, открыли поле, стёрли верхние биты — и ось
     прыгает, хотя человек её не трогал.
     Теперь низ — у нижней кромки РАЗРЫВА под полосой (v1.266), то есть у первой строки цепочки
     сразу под горизонтом. Ось стоит в том же просвете, что и полоса, и едет только вместе с
     чертой — как и просили.
     Черту берём из DOM (её только что поставила updateTopHorizon), а высоту разрыва — из
     --align-band-h: обе величины уже посчитаны, пересчитывать их тут заново значило бы завести
     второй источник правды. Черты нет (пустая цепочка) — прежний отсчёт от верха строк. */
  const hLineForAxis = document.getElementById("hsplitTop");
  const bandForAxis = (() => {
    const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--align-band-h"));
    return isFinite(v) ? v : 0;
  })();
  let axisLineBottom = rowsTop;
  if (hLineForAxis && hLineForAxis.classList.contains("act")) {
    axisLineBottom = (parseFloat(hLineForAxis.style.top) || 0) + bandForAxis;
  }
  /* ДЛИНА — ПАРА СТРОК, НЕ БОЛЬШЕ (v1.211, запрос «уменьши длину оси цепочек, чтобы она не
     перекрывала наложения поле, у битов её оставь не высоко»). В v1.210 линия тянулась от верха
     раскладки до первой строки цепочки и проходила через всё поле наложений поверх блоков.
     Держим прежнее ГЛАВНОЕ: низ упирается в первую настоящую строку цепочки (ось не отрывается от
     битов). Меняется только верх — отрезок отсчитывается вверх от этого низа на две высоты строки,
     поэтому над полем наложений его просто нет. Меряем шагом строки, а не пикселями: при другом
     размере шрифта отрезок останется теми же двумя строками. */
  /* ДЛИНА — ЧЕТЫРЕ СТРОКИ (v1.238, запрос «ось цепочек вытяни вверх, чтобы было видно»). В v1.211
     отрезок укоротили до двух строк, чтобы он не лез в поле наложений; двух оказалось мало —
     на плотной картинке ось терялась. Четыре видно и сверху, а поле по-прежнему не перечёркивает:
     линия по-прежнему растёт ВВЕРХ от первой строки цепочки, а не вниз. */
  /* ДЛИНА — РОВНО ПРОСВЕТ МЕЖДУ ПОЛОСОЙ И БИТАМИ (v1.261). Ряд под полосой шире её на две строки
     (--axis-gap-h), и этот просвет заведён как раз под ось: длиннее — уйдёт полосе за спину,
     короче — останется незамеченной. */
  const axisLinePitch = (typeof vrowsPitchPx === "function") ? vrowsPitchPx() : 16;
  /* axisGapPx (высота просвета --axis-gap-h) удалена в v1.412 вместе с axisLineH: её единственным
     читателем был запасной путь той длины. Сама переменная --axis-gap-h из fold-3-ops.js пока
     ставится и никому не мешает — если понадобится, её уберут там же, где считают. */
  /* Короче просвета на несколько пикселей (v1.264): ровно в его высоту ось упиралась макушкой в
     полосу — на глаз линия прошивала её насквозь. */
  /* ═══ ОСЬ ДОХОДИТ ДО САМОГО ГОРИЗОНТА (v1.348) ═══
     Запрос пользователя: «ось продли до горизонта и убери там разрыв над осью; когда ось наезжает
     на меню выравниваний — скрывается за ним частью своей».
     Разрыв — это «−6» из v1.264. Тогда ось ровно в высоту просвета упиралась макушкой в полосу
     выравниваний и на глаз прошивала её насквозь, и я укоротил линию. Лечил я при этом не длину, а
     ПОРЯДОК СЛОЁВ: полоса рисуется поверх оси (у неё свой контекст, см. #alignGrp), так что
     заходящий на неё кусок просто уходит за полосу — ровно как в запросе. Значит и укорачивать
     нечего.
     Считаем высоту от самой черты горизонта: её низ — это низ оси (axisLineBottom выше), её верх —
     style.top той же черты. Разница и есть длина, при которой макушка оси садится точно на черту,
     без зазора и без выхода за неё. Черта одна на всех, ставится раньше по проходу
     (updateTopHorizon), и второго источника правды тут не заводится.
     Черты нет (пустая цепочка) — прежняя формула по просвету, вместе с её «−6»: там и полосы нет,
     и упираться не во что. */
  /* axisLineH (длина «до черты горизонта», v1.348) удалена в v1.412 как мёртвая: с этой версии и
     верх, и высота оси считаются шагом строки — ось занимает ряды −1, 0 и 1, см. ниже. Разрыва, в
     который она тянулась, с v1.403 нет вовсе, и величина потеряла смысл вместе с ним.
     hLineForAxis выше по-прежнему нужна: по ней считается axisLineBottom — сама черта. */
  /* СНОВА ВВЕРХ ОТ ПЕРВОЙ СТРОКИ (v1.261, запрос «вверх ось надо»). В v1.260 я развернул отрезок
     вниз, на биты, — иначе его накрывала полоса. Правильнее оказалось не разворачивать ось, а
     открыть ей место: ряд под полосой стал выше на две строки, и ось стоит в этом просвете —
     на биты не заходит (правило v1.086 цело) и полосой не закрыта. */
  /* ═══ ОСЬ ЗАХОДИТ НА НУЛЕВУЮ СТРОКУ (v1.302) ═══
     Запрос пользователя: «ось продолжи на 0 строку — там всё равно битов не бывает».
     До сих пор низ линии упирался в нижнюю кромку разрыва (v1.267), то есть обрывался ровно там,
     где начинается первая строка под горизонтом. Правило «ось не заходит на биты» (v1.086) при
     этом соблюдалось буквально — но первая строка под горизонтом битов не несёт, и обрыв был
     преждевременным: линия не доводилась до картинки, к которой относится.
     Продлеваем ВНИЗ ровно на один шаг строки. Верх не трогаем: он стоит в просвете под полосой
     (v1.261), и поднимать его выше нельзя — уйдёт полосе за спину. Растёт только высота, поэтому
     ни просвет, ни положение полосы не пересчитываются.
     Меряем шагом строки (vrowsPitchPx), а не пикселями: при другом кегле или межстрочном ось
     по-прежнему захватит ровно одну строку, а не «примерно столько же». */
  /* ═══ 2px ЗАЗОРА МЕЖДУ НИЗОМ ОСИ И ПЕРВОЙ СТРОКОЙ (v1.332) ═══
     Запрос пользователя: «сделай 2px отступ вниз от оси до первой строки».
     С v1.302 ось продлена вниз ровно на один шаг строки — она проходит по нулевой строке (битов
     там не бывает) и обрывается точно там, где начинается первая настоящая строка цепочки. Стык
     получался впритык: линия упиралась в биты без единого пикселя просвета.
     Укорачиваем низ на два пикселя. Именно низ: верх стоит в просвете под полосой выравниваний
     (v1.261) и трогать его нельзя — уйдёт полосе за спину.
     Вычитаем из ОБЩЕЙ высоты, а не только из style.height: этой же величиной центруются счётчики
     лесенок, пикеры цвета и замок (см. вызовы ниже) — считай мы их по прежнему числу, они
     разъехались бы с видимой линией на пиксель. */
  const AXIS_ROW_GAP_PX = 2;
  /* ═══ ОСЬ ЗАНИМАЕТ ТРИ СТРОКИ: −1, 0 И 1 (v1.412) ═══
     Запрос пользователя: «ось пусть залезает на −1, 0 и 1 строки».
     Черта горизонта проходит по верхней кромке НУЛЕВОЙ строки (той, что с v1.403 занимает меню 2).
     Значит «−1» — ряд НАД чертой, «0» — сама черта и ряд под ней, «1» — следующий за ним.
     Отсюда обе величины прямо: верх на шаг строки выше черты, высота — три шага. Ни просвет, ни
     прежняя длина «до горизонта» (v1.348) больше не участвуют: раньше ось тянулась ровно в разрыв,
     а разрыва с v1.403 нет вовсе, и мерить стало не от чего.
     Шаг берём тот же, которым живут сами строки (vrowsPitchPx), поэтому три строки остаются тремя
     строками при любом кегле и межстрочном.
     Двухпиксельный зазор снизу (v1.332) сохраняем: он теперь отделяет низ оси от ВТОРОЙ строки,
     а не от первой, — смысл прежний, ось не упирается в биты. */
  /* ═══ ОСЬ ОСТАЁТСЯ ВИДНОЙ НАВЕРХУ (v1.444) ═══
     Запрос пользователя: «при уходе вверх первых строк за браузер — ось оставлять видимой наверху,
     как и меню 2».
     Меню 2 так и держится: его верх зажат снизу стопкой баров (см. positionAlignGrpTop) и потому
     не уезжает выше видимой кромки, сколько ни прокручивай. У оси такого упора не было — она
     считается от черты горизонта, а та уходит вместе со строками, и ось пропадала за верхом окна
     первой, хотя относится ко всей картинке.
     Ставим ей тот же по смыслу упор: верх линии не выше верхней кромки холста. Кромку берём в
     координатах .chain, в которых и живёт сама линия. Пока ничего не прокручено, величина
     отрицательная (холст начинается выше .chain) и упор не действует вовсе — ось стоит там же, где
     стояла. Прокрутили — линия останавливается у кромки и дальше едет вместе с ней, как приклеенная,
     сохраняя свою длину.
     Коробки у оси (пикеры, замок, счётчики лесенок) считаются от этого же числа ниже по проходу —
     значит остаются при ней. */
  /* ═══ УПОР — НИЖЕ МЕНЮ 1, А НЕ ПО КРОМКЕ ХОЛСТА (испр. v1.444 → v1.455) ═══
     Баг-репорт: «нет, также наезд».
     В v1.444 ось прижималась к верхней кромке ХОЛСТА. Но холст начинается ПОД плавающей полосой
     меню 1 только на бумаге: полоса у него position:fixed и места в потоке не занимает, так что
     кромка холста приходится ровно за ней. Прокрутил строки вверх — ось вставала на эту кромку,
     то есть прямо на меню 1, и наезд, который жест должен был убрать, никуда не девался.
     Берём наибольшее из двух упоров: кромка холста и НИЗ МЕНЮ 1 плюс три пикселя — тот же зазор,
     что у черты горизонта (v1.454), чтобы верхний ряд читался одинаково у всего, что в нём стоит.
     Меню внизу экрана (menubar-bottom) — сверху ничего не висит, остаётся только кромка холста.
     Полосу меряем живой: --menubar-h ставится другим проходом и на кадр отстаёт. */
  const canvasForAxisTop = chainEl.closest(".canvas") || document.querySelector(".canvas");
  let axisMinTop = canvasForAxisTop
    ? (canvasForAxisTop.getBoundingClientRect().top - chainRect.top) : 0;
  if (!document.body.classList.contains("menubar-bottom")) {
    const barLiveAxis = document.getElementById("menuBar");
    if (barLiveAxis && barLiveAxis.offsetHeight) {
      const underBar = barLiveAxis.getBoundingClientRect().bottom - chainRect.top + 3;
      if (underBar > axisMinTop) axisMinTop = underBar;
    }
  }
  const axisTopPx = Math.round(Math.max(axisMinTop, 0, axisLineBottom - axisLinePitch));
  const axisLineHFull = Math.max(1, axisLinePitch * 3 - AXIS_ROW_GAP_PX);
  axisSplitEl.style.top = axisTopPx + "px";
  axisSplitEl.style.height = Math.round(axisLineHFull) + "px";
  axisSplitEl.classList.add("act");
  /* Счётчики лесенок стоят по обе стороны этой самой линии (v1.281) — той же координатой leftPx и
     тем же отрезком, что и она. Зовём здесь, а не отдельным проходом: любое место, где ось уже
     посчитана, — единственное, где числа гарантированно не разъедутся с ней. */
  /* Коробкам лесенок отдаём ИСХОДНУЮ высоту отрезка, без прибавки v1.302: они центруются по
     середине переданного отрезка, и от удлинённого съехали бы вниз, на строку под горизонтом.
     Их место — в просвете между полосой и битами, там для них и заведён --axis-gap-h. */
  /* ОТРЕЗОК ДЛЯ КОРОБОК — ОБЕ ПУСТЫЕ СТРОКИ, А НЕ ВЕРХНЯЯ (v1.327) — см. запрос
     «на уровне этих двух пустых расположи кнопки слева и справа от оси». Раньше сюда шла
     axisLineH — только верхняя часть линии, без прибавки v1.302, и коробки стояли по
     середине ОДНОЙ строки. Теперь обе строки пусты по построению (разрыв плюс нулевая
     строка), и середина их общей высоты — ровно тот уровень, который просили. */
  positionStairsAxisBoxes(leftPx, axisTopPx, axisLineHFull, axisTopPx);
  /* ПИКЕРЫ ЦВЕТА ЦЕПОЧКИ — ТУДА ЖЕ, СЛЕВА ОТ ОСИ (v1.320, запрос пользователя «и слева от оси
     цепочек также для 0 и 1 цвета»). Зовём сразу за счётчиками лесенок и по той же причине, что
     и их: ось только что посчитана, и коробка не разъедется с линией. Порядок важен — коробка
     смотрит, показана ли сейчас левая лесенка, и отступает от неё (см. positionAxisColBox). */
  positionAxisColBox(leftPx, axisTopPx, axisLineHFull, axisTopPx);
  /* ТЕКСТОВАЯ ПОЛОСКА ПОД ОСЬЮ (v1.024) — её средний знак «|» обязан прийтись РОВНО на ось, а
     кнопки расходятся от него в обе стороны. Ставим в два приёма: сначала обнуляем left, чтобы
     offsetLeft знака посчитался внутри самой полоски (она position:absolute, то есть сама себе
     offsetParent для детей), потом сдвигаем полоску влево ровно на это смещение. Одним действием
     не выйдет — надо сперва узнать, где знак стоит в ещё не сдвинутой полоске.
     top — сразу под ручкой оси, той же формулой, что и её высота. */
  {
    const strip = document.getElementById("axisStrip");
    if (strip) {
      strip.classList.add("act");
      /* ПЛАНКА СТОИТ НА САМОМ ВЕРХУ, НА МЕСТЕ ЗНАКОВ РУЧКИ (v1.027, уточнение пользователя: "это
         и есть ось, в ней 1 под 1 — это ось; перемести её наверх, вместо 11, которые над ней").
         Была под ручкой (top = высота ручки), и «1 1» получалось два комплекта: свои у #axisSplit и
         свои в планке. Теперь комплект один — планкин: она села ровно туда, где рисовались знаки
         ручки, а сама ручка их больше не печатает (см. #axisSplit::before{content:none} в CSS) и
         осталась только зоной захвата под планкой. */
      /* ОСЬ ПРОХОДИТ В ЗАЗОР МЕЖДУ КНОПКАМИ (v1.086, запрос пользователя: "пропусти ось между
         кнопок, кнопки расположи справа слева от оси"). В v1.081 планку ставили ЦЕНТРОМ на ось, и
         линия шла прямо по кнопке. Теперь в планке есть пустая вставка (.axis-strip-gap), и на ось
         наводится ОНА: слева от линии остаются подпись и номера, справа — пусто.
         В два приёма, как когда-то со знаком «1 над 1»: сперва обнуляем left, чтобы offsetLeft
         вставки посчитался внутри самой планки (она position:absolute, то есть сама себе
         offsetParent для детей), и только потом сдвигаем планку на это смещение. Одним действием
         не выйдет — надо сперва узнать, где вставка стоит в ещё не сдвинутой планке. */
      /* ПЛАНКА — СРАЗУ ЗА П1, С ОТСТУПОМ (v1.232, запрос пользователя: «расположи сразу с отступом
         от П1»).
         Её носило по холсту от версии к версии: центром зазора на оси (v1.086), потом вплотную
         вправо от оси (v1.212). Обе привязки были к ОСИ — а та ездит: её двигают ручкой, она
         прыгает при смене выравнивания и при подгонке поля. Планка ездила следом, и найти её
         глазами каждый раз приходилось заново.
         Теперь она стоит у ЛЕВОГО КРАЯ ПОЛЯ ЦЕПОЧКИ, то есть сразу за колонкой П1, с небольшим
         отступом. Это место неподвижно: край поля задаётся границей колонки, а не выравниванием
         строк, — планка всегда на одном и том же месте, и рядом с ней своя же соседка «П1».
         Вертикаль прежняя: низ планки — у первой строки цепочки (см. axisLineBottom ниже). */
      strip.style.top = "0px";
      /* ЛЕВЫЙ КРАЙ — РОВНО НАД КОЛОНКОЙ ТОЧЕК (v1.237, запрос пользователя: «пусть ровно над
         точками найденных паттернов по вертикали находится»).
         Колонка точек (.pat-dot, v1.220) стоит между паттерном и номером строки — то есть как раз
         там, где кончается П1 и начинается поле цепочки. Планку ставим её левым краем на ту же
         вертикаль: «№» в планке правит как раз колонку номеров, что идёт следом, и теперь видно,
         к чему кнопка относится.
         Мерим по точке в ШАПКЕ колонок (.chain-head .pat-dot): она в той же флекс-раскладке, что и
         точки строк, стоит на той же вертикали и есть всегда — даже когда ни одной строки не
         отрисовано. Нет шапки (старая разметка) — падаем на прежний отсчёт от края поля бит. */
      /* ЛЕВЫЙ КРАЙ — РОВНО НА ГРАНИЦЕ ПОЛЯ ЦЕПОЧКИ (v1.271, запрос пользователя «левую границу — на
         границу поля цепочек»). В v1.237 планку ставили над колонкой точек, а та отстоит от границы
         на ширину самой точки: планка висела чуть внутри поля и с границей не совпадала. Теперь
         край в край с полем — и она читается как его заголовок, а не как отдельная деталь. */
      /* ═══ ЛЕВЫЙ КРАЙ «№» — НА ГРАНИЦЕ П1|ЦЕПОЧКА, ВПЛОТНУЮ К ПЛАНКЕ «П1» (v1.282) ═══
         Запрос пользователя: «передвинь П1 к №, а № сдвинь, чтобы край левый кнопки номеров был на
         границе левой цепочек».
         Границ у поля цепочки на глаз две, и до сих пор планка стояла у ВНУТРЕННЕЙ: v1.271 посадила
         её на bitsRect.left — там начинается заливка поля (.field-bg, см. putFieldBg("fieldBgC")) и
         сами биты. Но человек видит не заливку, а ЛИНИЮ — ручку #vsplit, которая стоит на правом
         краю колонки П1 (см. её расчёт в начале updateSplitPositions). Между этой линией и битами
         лежат ещё две колонки — точек (.pat-dot) и номеров строк (.num), — и планка отстояла от
         линии ровно на их ширину, десятками пикселей.
         Теперь она встаёт на ту же координату, что и сама линия: patEl.right + 1. Кнопка «№» —
         первая в планке и без внутренних отступов (см. .axis-strip в стилях: gap есть, padding
         нет), значит её левый край и есть левый край планки, как и просили.
         ПОБОЧНО РЕШАЕТСЯ И ПЕРВАЯ ЧАСТЬ ЗАПРОСА: планка «П1» с v1.279 прижата к ЭТОЙ ЖЕ границе, но
         с другой стороны — своим правым краем (см. placeStrip выше). Двигать её отдельно не нужно:
         обе планки сходятся на одной линии и оказываются соседями сами собой.
         Заодно «№» теперь стоит ровно над колонками точек и номеров, которыми и правит, — то есть
         вернулась к смыслу v1.237 («ровно над точками найденных паттернов»), но уже по линии, а не
         по краю колонки точек.
         КОЛОНКИ П1 НЕТ (body.hide-pat-l или пустая разметка) — границе неоткуда взяться, и планка
         остаётся на прежнем месте, у края поля бит. */
      /* ═══ «№» ОТСТУПАЕТ ВПРАВО, ПРОПУСКАЯ ВПЕРЁД «П1» (v1.284) ═══
         Запрос пользователя: «смести вправо и вставь в освободившееся место П1».
         Место у границы, которое «№» занимала с v1.282, отдано планке «П1» (см. placeStrip выше);
         «№» встаёт следом за ней, через тот же зазор.
         Ширину соседки берём offsetWidth'ом, а НЕ её живой коробкой: offsetWidth — собственная
         ширина планки, она не зависит от того, успел ли этот кадр её подвинуть. Проходы разные —
         placeStrip живёт в updateSplitPositions(), и та вызывается сама по себе (протяжка границ
         мышью, см. makeDrag) без пересчёта оси. Читай мы getBoundingClientRect().right, «№» на
         таких кадрах садилась бы по вчерашней позиции соседки и подрагивала.
         «П1» скрыта (body.hide-pat-l) — сдвигать не от чего, и «№» остаётся на месте v1.282. */
      /* ═══ ОТСТУП ОТМЕНЁН, «№» СНОВА ПЕРВАЯ У ГРАНИЦЫ (v1.285) ═══
         Запрос пользователя: «сдвинь влево от П1». Планки поменялись местами, и теперь на ширину
         соседки отступает «П1» (см. placeStrip выше), а «№» вернулась ровно на координату v1.282 —
         patEl.right + 1, левым краем на линию границы. */
      /* ═══ «№» — ПО ДРУГУЮ СТОРОНУ ЛИНИИ, НАД КОЛОНКОЙ ПАТТЕРНОВ (v1.287) ═══
         Запрос пользователя: «П1 должен быть на чёрной линии… а „№ и ⇥“ левее от П1, на поле
         паттернов».
         С v1.282 «№» стояла ЛЕВЫМ краем на границе и уходила вправо, в поле цепочки; место на самой
         линии теперь занимает «П1» (см. placeStrip выше). Разворачиваем «№» зеркально: прижимаем
         ПРАВЫМ краем к той же линии, с тем же зазором в 2px, что был у «П1» до v1.284, — и вся
         планка оказывается над колонкой паттернов, ни на пиксель не заходя в цепочку.
         Зажим по нулю обязателен и не декоративен: колонка паттернов бывает уже планки (её ширина
         --pat-w тянется ручкой #vsplit от 40px), и без зажима планку унесло бы за левый край
         холста — ровно та беда, из-за которой «П1» в своё время и переехала (см. v1.272).
         Колонки П1 нет (body.hide-pat-l) — линии неоткуда взяться, и «№» остаётся у края поля бит,
         как было до v1.282. */
      /* ═══ «№ СТРОК» ВЕРНУЛАСЬ ВПРАВО ОТ ЛИНИИ (v1.288) ═══
         Место слева от границы целиком отдано планке «П1» — там теперь её кнопки «⇤» и «№ 10», обе
         про колонку паттернов. Этой планке слева делать нечего: её «№» правит колонку номеров
         строк, а та лежит СПРАВА от границы, в поле цепочки. Возвращаемся на координату v1.282 —
         левым краем на линию. Заодно каждая планка снова стоит над тем, чем управляет. */
      /* ═══ «№» — ЛЕВЫМ КРАЁМ НА НАЧАЛО ПОЛЯ ЦЕПОЧКИ (v1.289) ═══
         Запрос пользователя: «сдвинь № цепочек кнопку вправо, чтобы её начало совпадало с началом
         поля цепочек».
         С v1.282 планка вставала на ЛИНИЮ границы (patEl.right + 1), а между линией и самим полем
         лежат ещё две колонки — точек (.pat-dot) и номеров строк (.num). Поле начинается правее их,
         и «№» висела не над полем, а перед ним.
         Теперь отсчёт снова от bitsRect, как было в v1.271: левый край кнопки «№» совпадает с левым
         краем поля бит. Ветвление по наличию колонки П1 стало ненужным — bitsRect есть всегда, и
         запасной путь совпал с основным. */
      /* ═══ «№» ОТСТУПАЕТ, ЕСЛИ ИНАЧЕ НАЕДЕТ НА «П1» (испр. v1.297) ═══
         Баг-репорт: «номера строк подвинь вправо — наложились».
         Планка «№» ставилась ровно на bitsRect.left (v1.289, «начало кнопки — начало поля цепочек»),
         а «П1» прижимается правым краем к тому же краю бит (v1.296). На бумаге между ними LINE_GAP,
         на деле — ноль или минус: bitsRect тут берётся у #colHeader .bits, а placeStrip меряет
         .ln .bits в строке. Это РАЗНЫЕ элементы, и их левые края совпадают лишь пока линейка
         столбцов и строка одинаково разложены; стоит колонке номеров в одной из них оказаться
         другой ширины, и планки наезжают.
         Чинить сведением к одному элементу не стал: bitsRect здесь же считает и саму ось, а её
         привязка к линейке верна и трогать её ради планки незачем.
         Считаем упор арифметикой, без getBoundingClientRect: у «П1» уже проставлен style.left, а
         offsetWidth — её собственная ширина. Обе величины в координатах .chain, как и наша. Пока
         место есть, «№» стоит там же, где и стояла, — правило v1.289 в силе; наезд гасится только
         когда он реально возник. */
      /* ═══ КНОПКА СТОИТ В КОЛОНКЕ НОМЕРОВ И ШИРИНОЙ В НЕЁ ЖЕ (v1.305) ═══
         Запрос пользователя: «кнопка номера строк цепочки пусть будет всегда в столбце и шириной
         такой же, как поле для номеров; когда его нет — прижать к границе поля цепочек слева
         изнутри».
         Кнопка правит колонку .num-l2, а стояла просто «в начале поля бит» — рядом, но не над ней,
         и шириной по своей подписи («№ 10» / «№ 01» / «№ —»). Теперь встаёт РОВНО в колонку: левый
         край в её левый край, ширина — её ширина. Связь «кнопка ↔ то, чем она правит» становится
         видимой, а не подразумеваемой.
         Ширину ставим на КНОПКУ, а не на планку: в планке кроме кнопки живёт ещё пустая вставка
         .axis-strip-gap, и ширина планки колонке не равна. Заодно снимаем min-width:5.2ch из CSS —
         колонка номеров бывает уже подписи, и без этого кнопка её распёрла бы.
         КОЛОНКИ НЕТ (режим «№ —», body.hide-rownums, или включено «Инфо поля») — прижимаем кнопку
         к левой границе поля цепочек изнутри и возвращаем ей собственную ширину: вставать не во
         что, а у границы она остаётся на виду и не наезжает на паттерны.
         ЗАЩИТА ОТ НАЕЗДА НА «П1» (v1.297) ОТСЮДА УБРАНА: она брала максимум с правым краем planки
         «П1» и была нужна, пока та могла дотянуться сюда. С v1.304 «П1» кончается на patEl.right−3,
         то есть ЛЕВЕЕ колонки номеров при любой ширине, — упор стал недостижимым, а мешать
         выравниванию по колонке мог. */
      /* ═══ ВСЕГДА У ЛИНИИ П1|Ц, ИЗНУТРИ ПОЛЯ (v1.310) ═══
         Ответ пользователя на прямой вопрос — «вплотную к линии П1|Ц, изнутри поля», ширина
         собственная. И его же наблюдение, объяснившее всю путаницу: «она сейчас прямо на П1 месте
         находится, и возможно поэтому я не вижу П1 надписи».
         Так и было. В v1.305 кнопку сажали НАД СТОЛБЦОМ НОМЕРОВ, а тот лежит ВНУТРИ чёрного
         просвета — того самого, по центру которого с v1.307 стоит подпись «П1». Две разные правки,
         каждая сама по себе разумная, отправили два элемента в одно место: кнопка накрыла подпись,
         и «П1» пропала с экрана. Искал я её при этом в геометрии планки, а надо было — здесь.
         Выравнивание по столбцу снимаем совсем, вместе с навязанной шириной: кнопка встаёт на линию
         и дальше не двигается ни при смене режима «№ 10 / № 01 / № —», ни при изменении ширины
         столбца. Место у неё теперь одно на все случаи — прыгать между двумя привязками, как с
         v1.305, она перестаёт.
         Столкновение с «П1» разведено в updateSplitPositions: просвет для подписи считается уже не
         от границы, а от правого края этой кнопки (см. gutterCenter там). */
      const numBtn = document.getElementById("bAxisRowNum");
      if (numBtn) {
        numBtn.style.width = "";
        /* minWidth ОТСЮДА УБРАН СОВСЕМ (v1.334): из JS его больше никто не ставит — ширину кнопки
           держит постоянной правило #bAxisRowNum в CSS, одно на все три подписи. Сброс здесь был
           нужен, только пока ширину навязывали расчётом (v1.305…v1.333). */
        numBtn.style.paddingLeft = "";
        numBtn.style.paddingRight = "";
      }
      /* ═══ БЕЗ КОЛОНКИ — К ЛИНИИ ГРАНИЦЫ, А НЕ К КРАЮ БИТ (испр. v1.306) ═══
         Баг-репорт: «не прижался, вышел за границу».
         В v1.305 запасной позицией был bitsRect.left — левый край ПОЛЯ БИТ. Но «граница поля
         цепочек» — это линия #vsplit на patEl.right + 1, а между ней и битами лежит ещё колонка
         точек (.pat-dot). Кнопка садилась правее линии на её ширину, то есть от границы отходила,
         а не прижималась.
         Теперь встаём вплотную ЗА линию, изнутри поля: patEl.right + 2. Колонки П1 нет вовсе
         (hide-pat-l) — линии неоткуда взяться, и прежний отсчёт от края бит остаётся верным. */
      /* ═══ КООРДИНАТУ БЕРЁМ У САМОЙ ЛИНИИ (испр. v1.307 → v1.308) ═══
         Запрос пользователя: «левая граница кнопки — к левой границе цепочек вровень».
         В v1.306 линия пересчитывалась заново, по коробке #colHeader .pat, да ещё с отступом +2.
         Оба слагаемых врали. Отступ — просто лишний: «вровень» значит без него. А коробка не та:
         #vsplit ставится по .ln .pat, то есть по СТРОКЕ, а тут читался #colHeader — линейка
         столбцов. Совпадают они лишь пока обе разложены одинаково; разойдутся — и кнопка встанет
         мимо линии на разницу. Ровно этот же рассинхрон уже ловился в v1.297.
         Берём готовое значение у #vsplit: это и есть линия, один источник правды, пересчитывать
         нечего. Линии на экране нет (колонка П1 скрыта) — прежний отсчёт от края бит. */
      /* ═══ ДАЛЬШЕ ВПРАВО, К НАЧАЛУ БИТ (испр. v1.311) ═══
         Баг-репорт: «а № ещё дальше, за границу цепочек».
         В v1.310 кнопка стояла ровно на линии П1|Ц — и упиралась в подпись «П1», которая туда же и
         падала. Теперь уходит к левому краю ПОЛЯ БИТ: между линией и битами лежат колонки точки и
         номера, и этой ширины хватает, чтобы подпись с кнопкой разошлись.
         Здесь снова bitsRect (#colHeader .bits), и это осознанно: кнопка встаёт над началом самих
         бит, а линейка столбцов — ровно тот элемент, по которому биты и размечены. */
      /* ═══ МЕРИМ ПОЛЕ ПО СТРОКЕ, А НЕ ПО ЛИНЕЙКЕ (испр. v1.313) ═══
         Баг-репорт: «всё ещё залезает на П1, кнопка номеров должна начинаться на поле цепочек, а не
         раньше».
         bitsRect выше — это #colHeader .bits, коробка ЛИНЕЙКИ столбцов. А линейка собирается короче
         строки: в ней идут .pat, .num, .bits (см. renderColHeader), и колонки точек .pat-dot в ней
         НЕТ вовсе. Из-за этого её .bits начинается левее настоящего поля ровно на ширину точки —
         кнопка честно вставала «на bitsRect.left» и всё равно оказывалась раньше поля, наезжая на
         «П1».
         Берём коробку у СТРОКИ. По ней же ставится заливка поля (putFieldBg("fieldBgC", bitsEl) в
         updateSplitPositions), то есть кнопка теперь начинается ровно там, где начинается видимая
         заливка цепочки, — а это и есть «поле цепочек» на глаз.
         (С v1.328 заливка растянута ВЛЕВО, под столбец номеров, и с краем бит больше не совпадает.
         Привязка кнопки к .bits от этого не устарела, а наоборот: этот край неподвижен при любом
         режиме номеров, а левый край заливки — нет.)
         bitsRect для оси не трогаем: ось размечена по линейке, и это верно — засечки столбцов
         живут именно в ней.
         Третий случай того же рассинхрона за сессию (были v1.297 и v1.308); теперь причина названа
         поимённо — в линейке нет .pat-dot. */
      /* ═══ КНОПКА НЕ ЕДЕТ ПРИ ВКЛЮЧЕНИИ НОМЕРОВ (испр. v1.313 → v1.314) ═══
         Баг-репорт: «теперь, когда номера включены, поправь, чтобы на месте кнопка стояла, сейчас
         съехала вправо».
         Привязка к левому краю .bits (v1.313) верна, но НЕПОДВИЖНОЙ не является: между точкой и
         битами стоит сам столбец номеров (.num-l2), и он появляется и исчезает по этой же кнопке.
         Включили «№ 10» — столбец раздвинул биты вправо, кнопка уехала за ними; выключили — вернулась.
         Получалось, что кнопка убегает ровно от того действия, которое сама и выполняет.
         Берём координату, которую переключатель НЕ двигает: правый край колонки точек (.pat-dot).
         Ровно оттуда начинается область поля цепочки в обоих режимах — при включённых номерах там
         начинается их столбец, при выключенных сразу биты. Кнопка стоит на месте всегда.
         Точек в строке две (слева и справа от бит) — берём ПЕРВУЮ, querySelector отдаёт её же.
         Колонки точек нет (старая разметка) — прежний отсчёт по левому краю бит строки. */
      /* ═══ ЛЕВЫЙ КРАЙ ПРИБИТ К НАЧАЛУ СТОЛБЦА НОМЕРОВ, ШИРИНА РАСТЁТ ВПРАВО (v1.315) ═══
         Ответ пользователя: «расширяется вправо, а левая граница на месте».
         Правый край точки (v1.314) для этого не годится: у .num-l2 есть ОТРИЦАТЕЛЬНЫЙ левый отступ
         (margin-left:max(-10px,-0.6em), см. её CSS) — столбец номеров затянут назад и начинается
         ЛЕВЕЕ конца точки. Кнопка, стоящая по концу точки, оказывалась правее столбца, а её правая
         половина вылезала за него — это и есть «вылезает за границу на пол ширины».
         Считаем ровно левый край столбца. Он одинаков в обоих режимах: столбец скрывается через
         display:none (body.hide-rownums), но его margin-left из вычисленных стилей читается и у
         скрытого, а точка на месте всегда. Поэтому формула «конец точки плюс её отступ» даёт одну и
         ту же координату и с номерами, и без них — кнопка не шелохнётся при переключении.
         Ширину не задаём вовсе (её принудительное равнение снято ещё в v1.310): левый край прибит,
         подпись меняется — кнопка растёт вправо сама. */
      /* ═══ СМЕЩЕНИЕ СТОЛБЦА МЕРИМ, А НЕ ВЫЧИСЛЯЕМ (испр. v1.315 → v1.316) ═══
         Баг-репорт: «также сдвинута на пол».
         В v1.315 я складывал «правый край точки + margin-left столбца» и считал, что получил его
         левый край. Слагаемых оказалось мало: строка .ln — флексбокс со своим gap, и между точкой и
         столбцом лежит ещё этот зазор. Кнопка вставала левее столбца на разницу — снова мимо, и
         снова примерно на полкнопки.
         Восстанавливать координату формулой больше не пробуем: меряем РАЗНИЦУ между краем точки и
         краем столбца прямо в DOM, пока столбец виден. Отступы, зазоры и всё прочее входят в неё
         сами, сколько бы их ни было.
         Столбец скрыт (режим «№ —») — измерить нечего, и берём ПОСЛЕДНЮЮ измеренную разницу: тогда
         кнопка остаётся ровно там же, где стояла при видимых номерах. Это и есть «левая граница на
         месте» из запроса. До первого замера разница равна нулю — кнопка встаёт по краю точки, как
         в v1.314; после первого же показа номеров координата уточняется навсегда. */
      /* ═══ КНОПКА ПРИЖАТА ПРАВЫМ КРАЕМ К НАЧАЛУ ПОЛЯ ЦЕПОЧКИ (v1.317) ═══
         С этой версии столбец номеров вставляется ВЛЕВО, за счёт колонки П1 (см. --rownum-ins в
         CSS и его замер в updateSplitPositions): правый край столбца прибит к началу бит, а левый
         уезжает тем дальше, чем шире номера («-1011» много длиннее «10»).
         Значит прежняя привязка к ЛЕВОМУ краю столбца (v1.315/1.316) стала подвижной и вернула бы
         ровно ту беду, от которой уходили в v1.314: включаешь номера — кнопка убегает от того
         действия, которое сама и выполняет. Неподвижен теперь ДРУГОЙ край, и кнопка садится на
         него: правым краем к левому краю поля бит.
         Требование v1.315 «левая граница на месте, растёт вправо» этим не нарушено, а обращено:
         теперь на месте ПРАВАЯ, и подпись растёт влево — то есть в ту же сторону, куда растёт сам
         столбец, над которым кнопка стоит.
         Поле бит мерим по СТРОКЕ, а не по линейке столбцов: в линейке нет колонки точек, и её
         .bits начинается левее настоящего поля (весь разбор — в v1.313 выше).
         Хвост планки справа от самой кнопки — пустая вставка .axis-strip-gap, через которую
         проходила ось (v1.086). Берём его offsetLeft/offsetWidth'ом: планка сама себе offsetParent,
         и эти числа не зависят от того, куда её поставил прошлый кадр (тот же приём, что в
         v1.284/1.285). Кнопки в планке нет — хвост нулевой, к линии прижимается сама планка.
         Замер расстояния «точка → столбец» (v1.316) и переменная lastNumColOffset удалены как
         мёртвые: левый край столбца больше не восстанавливается, кнопке он не нужен. */
      /* ═══ ЛЕВЫМ КРАЁМ НА ЛЕВЫЙ КРАЙ ПОЛЯ, ВНУТРЬ НЕГО (v1.329) ═══
         Баг-репорт со скриншотом: «когда нет номеров, кнопка пусть будет НАД ПОЛЕМ ЦЕПОЧЕК, а не
         на границе».
         Так и было: с v1.317 кнопка прижата ПРАВЫМ краем к левому краю бит и растёт ВЛЕВО. Пока
         номера включены, влево от бит лежит их столбец — кнопка стоит над ним, всё честно. Стоит
         номера выключить, и слева от бит остаётся только просвет с границей П1|Ц: кнопка целиком
         повисает СНАРУЖИ поля, над чёрной полосой и линией. Ровно это на скриншоте.
         Разворачиваем привязку: левый край кнопки садится на левый край ПОЛЯ — того самого, что
         рисует заливка #fieldBgC, — и подпись растёт ВПРАВО, внутрь поля. Кнопка оказывается над
         полем в обоих режимах, а не только в одном.
         ЛЕВЫЙ КРАЙ ПОЛЯ БЕРЁМ ТОЙ ЖЕ ФОРМУЛОЙ, ЧТО И ЗАЛИВКА (putFieldBg в updateSplitPositions,
         v1.328): столбец номеров виден — его левый край, скрыт — левый край бит. Два места
         считают одно и то же число, и разъехаться им нельзя: иначе кнопка снова окажется «почти»
         над полем, а такой рассинхрон в этом файле ловился уже четырежды (v1.297, v1.308, v1.313,
         v1.315).
         ЧЕМ ПЛАТИМ. Кнопка теперь ЕЗДИТ при переключении «№ 10 / № 01 / № —» — ровно на ширину
         столбца, вместе с левым краем поля. Требование v1.328 «кнопка не сдвигается» этим
         отменяется сознательно: там речь шла о прыжках ОТ УПОРА в планку «П1» (кнопку отбрасывало
         вбок тем сильнее, чем уже просвет), а здесь она едет вместе с полем, над которым стоит, —
         то есть остаётся на своём месте относительно того, чем правит.
         btnTailNum/stripWNum (хвост планки справа от кнопки и её полная ширина) больше не нужны:
         они пересчитывали ПРАВЫЙ край в координату планки. Теперь достаточно offsetLeft самой
         кнопки внутри планки — обычно нуль (кнопка первая, padding у планки нет), но считаем
         честно, чтобы правка порядка кнопок ничего не сломала. */
      const bitsRowEl = document.querySelector("#rows .ln .bits") ||
                        document.querySelector(".chain-head .bits");
      const bitsLeftPx = bitsRowEl
        ? (bitsRowEl.getBoundingClientRect().left - chainRect.left)
        : (bitsRect.left - chainRect.left);
      /* ═══ КНОПКА НАКРЫВАЕТ СТОЛБЕЦ НОМЕРОВ ЦЕЛИКОМ, ПРИЖАТАЯ К ЕГО ПРАВОМУ КРАЮ (v1.331) ═══
         Запрос пользователя: «прижми кнопку номеров вправо, где будут находиться номера, и ширины
         авто до границы».
         В v1.329 кнопка садилась ЛЕВЫМ краем на левый край поля и росла вправо. Столбец номеров при
         этом шире подписи, а сами цифры в нём прижаты ВПРАВО (см. добивку пробелами в render() и
         padding-left у .num-l2) — кнопка оставалась у границы, а номера стояли заметно правее её.
         Ровно это на скриншоте: «№01» у пунктира, а «0 1 0» — правее.
         Теперь у кнопки два правила сразу, и оба из запроса. ПРИЖАТА ВПРАВО: её правый край — на
         правом краю столбца, то есть у самого поля бит, там же, где стоят цифры. ШИРИНА АВТО ДО
         ГРАНИЦЫ: min-width равен ширине столбца, а столбец с v1.330 начинается ровно на стыке полей
         — значит кнопка растягивается от границы до цифр и накрывает колонку целиком. Подпись
         длиннее столбца («№ 01» при узких номерах) — min-width не мешает, кнопка растёт влево сама,
         за границу; разойтись с планкой «П1» ей помогает встречный упор в updateSplitPositions.
         СТОЛБЦА НЕТ («№ —», body.hide-rownums, окно «ℹ Поле») — накрывать нечего, ширина своя, и
         работает правило v1.329: левый край на левом крае поля, подпись растёт вправо, внутрь. Это
         и был предыдущий запрос — «когда нет номеров, кнопка над полем цепочек, а не на границе».
         min-width, а не width: подпись меняется по кругу «№ 10 / № 01 / № —», и зажимать её жёсткой
         шириной значило бы обрезать текст на узкой колонке.
         ═══ ВЕТВЛЕНИЕ УБРАНО, ПРАВИЛО ОДНО (v1.333) ═══
         Баг-репорт: «так дёргается при включении». Двух привязок и не должно было быть: смена
         режима номеров переключала кнопку между ними, и та прыгала на собственную ширину. Осталась
         одна — правым краем к левому краю поля бит; место под неё в поле открывает резерв
         --num-btn-res (весь разбор — в updateSplitPositions, там же считается и резерв: от него
         зависит вставка --rownum-ins, а она считается ДО всей остальной геометрии).
         ═══ ШИРИНА БОЛЬШЕ НЕ НАВЯЗЫВАЕТСЯ (v1.334) ═══
         «Ширины авто до границы» из v1.331 отменено по следующему баг-репорту: растягиваясь до
         границы, кнопка меняла размер на каждое переключение, и её левый край дёргался. Ширина
         теперь постоянная и живёт в CSS (#bAxisRowNum, min-width на все три подписи), а до границы
         поле добирает резервом — двигается только то, что левее правого края кнопки. */
      /* ═══ «№» НЕ НАЕЗЖАЕТ НА ПЛАНКУ «П1» (испр. v1.320) ═══
         Баг-репорт: «П1 появилась только после нажатия на „Номера цепочек“».
         Планка «П1» кончается подписью на линии П1|Ц и с v1.320 несёт за ней ещё два пикера цвета;
         «№» же прижата ПРАВЫМ краем к началу поля бит и растёт ВЛЕВО (v1.317). Между линией и
         битами лежат колонки точки и номеров, и ширина их зависит от режима номеров: в «№ 01»
         числа длиннее, просвет шире, и всё помещается; в «№ 10» и «№ —» он сужается, и кнопка
         накрывает собой конец планки «П1» — подпись пропадает с экрана. Отсюда и «появилась только
         после нажатия»: переключение режима расширяло просвет.
         Ставим упор: левый край кнопки не заходит левее правого края планки «П1». Пока места
         хватает, координата прежняя (правило v1.317 в силе); как только просвет сузился — кнопка
         отступает вправо, к битам, вместо того чтобы лезть на соседку.
         Считаем арифметикой, без getBoundingClientRect: у «П1» уже проставлен style.left этим же
         кадром (placeStrip в updateSplitPositions, она идёт раньше по render), а offsetWidth — её
         собственная ширина. Тот же приём и та же причина, что были в v1.297.
         Планки «П1» нет (колонка скрыта, body.hide-pat-l) — упирать не во что, и кнопка остаётся
         там, где стояла. */
      /* ═══ УПОР В «П1» СНЯТ, ТЕПЕРЬ УСТУПАЕТ ОНА (v1.328) ═══
         Запрос пользователя: «когда номера отключены — кнопка есть и стоит на том же месте, когда
         включены — под ней номера, при этом сама кнопка не сдвигается никуда, двигаются влево П1,
         освобождая место».
         Отсюда убран Math.max(p1RightPx, …) из v1.320: он отжимал кнопку вправо, когда просвет
         сужался, — то есть кнопка прыгала при каждой смене режима номеров. Место кнопки объявлено
         НЕПОДВИЖНЫМ: правым краем к левому краю поля бит (правило v1.317), а тот от номеров не
         зависит — их вставка компенсируется отступом строки (--rownum-ins, v1.317). Наезд на «П1»
         разводится с ДРУГОЙ стороны, в updateSplitPositions: планка «П1» не заходит правее левого
         края этой кнопки (см. упор там же, сразу за placeStrip).
         Переменные p1StripEl/p1RightPx удалены как мёртвые — второго читателя у них не было.
         Упор так и остаётся снятым и в v1.329: кнопка ушла ВНУТРЬ поля и растёт вправо, то есть
         от «П1» она теперь удаляется, а не приближается к ней. Встречный упор в
         updateSplitPositions на месте — он и держит планку «П1» левее кнопки. */
      /* ПРАВЫЙ КРАЙ КНОПКИ — НА ЛЕВОМ КРАЮ ПОЛЯ БИТ, ВСЕГДА (v1.333). Ветвления по наличию столбца
         больше нет: именно оно и дёргало кнопку при переключении режима. offsetWidth читается уже
         с проставленным min-width (его ставит updateSplitPositions раньше по проходу), а чтение
         коробки форсит раскладку — число сегодняшнее, не от прошлого кадра. */
      strip.style.left = Math.round(
        bitsLeftPx - (numBtn ? (numBtn.offsetLeft + numBtn.offsetWidth) : 0)) + "px";
      /* ПЛАНКА ВЫШЕ ГОРИЗОНТАЛЬНОЙ РУЧКИ, БЕЗ НАЛОЖЕНИЯ (v1.052, запрос пользователя: "пусть это
         не залезает за ручку горизонтальную, подними чуть выше 1цы оси… hsplit-top act — не
         залезает на неё"). Планка стояла на top:0 (v1.027, "перемести её наверх"), а #hsplitTop —
         на верхнем крае #rows. Оба числа считаются независимо, и при плотной раскладке (шапка
         нулевой высоты, линейка столбцов тонкая, #alignGrp вообще absolute и места в потоке не
         занимает) верх строк оказывался ВЫШЕ низа планки — нижняя «1» оси ложилась прямо на черту
         ручки.
         Считаем от ручки, а не от нуля: низ планки ставим на 3px выше её линии, откуда бы та ни
         пришлась. Тогда наложения нет по построению, при любом кегле и межстрочном.
         Отрицательный top не зажимаем — планке можно уйти выше .chain, там пусто; зажим по нулю
         вернул бы ровно то наложение, от которого уходим. */
      const rowsTopPx = (() => {
        const r = document.getElementById("rows");
        return r ? (r.getBoundingClientRect().top - chainRect.top) : 0;
      })();
      /* НА СТРОКЕ ПОЛОСЫ ВЫРАВНИВАНИЙ (v1.265, запрос «П1 и П2 — на одной полосе, что и меню»):
         все три планки и полоса читаются одним рядом управления. Раньше низ планки считался от
         верха строк (v1.233), а полоса с v1.262 висит на черте горизонта — то есть этажом выше,
         и планки от неё отставали. Полосы на экране нет — прежний отсчёт от строк. */
      /* Та же формула, что у «П1»/«П2» и у самой полосы (v1.274): черта плюс 3px. Раньше здесь
         читалась коробка полосы, а она обновляется другим проходом — планка отставала на кадр. */
      const hLineForStrip2 = document.getElementById("hsplitTop");
      const alignBarTop2 = (hLineForStrip2 && hLineForStrip2.classList.contains("act"))
        ? ((parseFloat(hLineForStrip2.style.top) || 0) + 0) : null;   /* v1.403: см. ту же правку у планок полей выше. */
      strip.style.top = (alignBarTop2 !== null ? alignBarTop2
                         : (rowsTopPx - (strip.offsetHeight || 24) - 3)) + "px";
      /* Планки «⧉ Кнопки» здесь больше нет (v1.231): кнопка переехала в полосу выравниваний, к её
         правому краю, и позицию себе больше не считает — едет вместе с полосой. */
    }
  }
  updateTopHorizon();
  updatePatSpill();
  // Полоса выравниваний (#alignGrp) — не по центру экрана, а РОВНО НАД ОСЬЮ первой строки, и
  // едет вместе с ручкой оси/границами столбцов (запрос пользователя). Считаем в координатах
  // .main-layout — именно от неё отсчитывается её position:absolute; transform:translateX(-50%)
  // из CSS ставит на ось её ЦЕНТР. По краям придерживаем, чтобы полоса не уехала за экран.
  const alignGrpEl = document.getElementById("alignGrp");
  const mainEl = alignGrpEl && alignGrpEl.offsetParent;
  if (alignGrpEl && mainEl) {
    const mainRect = mainEl.getBoundingClientRect();
    /* ПОЛОСА ЗАКРЕПЛЕНА (v0.976, запрос пользователя: "пусть верхняя панель вообще будет всегда
       закреплена"). Раньше её зазор под ось (#alignAxisGap) садился РОВНО НА ОСЬ, и вся полоса ездила
       по горизонтали вместе с цепочкой: тянешь ось или поле — кнопки уползают следом, а крайние
       (◧ П1 / П2 ◨ / лесеночные счётчики) уходят за край экрана и становятся недоступны. Это
       стало окончательно неудобно, когда полоса превратилась в главный пульт полей: теперь ею
       переключают выравнивание не только цепочки, но и П1/П2, а с v0.976 поля
       ещё и таскают мышью — полоса дёргалась бы на каждое движение.
       Теперь она стоит НАМЕРТВО по центру .main-layout и не зависит ни от оси, ни от сдвигов
       полей; остатки той привязки — линия-продолжение оси (v1.016) и сам зазор под неё (v1.017) —
       из полосы убраны, на месте зазора теперь кнопка-приёмник #bAlignTargetInd.
       Вертикаль — в positionAlignGrpTop() ниже, она и так была привязана к стопке баров. */
    /* ЦЕНТР — ПО ПОЛЮ ЦЕПОЧКИ, А НЕ ПО ВСЕМУ ЭКРАНУ (v1.241, запрос пользователя: «чтобы не
       перекрывали другие кнопки»). Полоса стояла по центру .main-layout, а планки «П1»/«П2» — у
       границ своих колонок: стоило полю уехать от центра экрана, и полоса наползала на планку.
       Теперь она центруется по САМОМУ ПОЛЮ БИТ — тому же, что задаёт ширину --bits-w, — и между
       планками помещается по определению: минимальная ширина поля с v1.238 не меньше её ширины.
       Поля бит на экране нет (пустая цепочка) — центруем по экрану, как раньше. */
    const bitsBoxEl = document.querySelector("#colHeader .bits") || document.querySelector(".ln .bits");
    const bitsBox = bitsBoxEl ? bitsBoxEl.getBoundingClientRect() : null;
    /* МЕСТО ПОД ПЛАНКУ «№» (v1.244, запрос пользователя «не перекрывай им кнопку Номера
       паттернов»). Планка с номерами стоит у ЛЕВОГО края поля цепочки (v1.237) — то есть внутри
       той же полосы, по которой центруется меню, и его левый конец накрывал её.
       Считаем центр не по всему полю, а по его остатку СПРАВА от планки: меню съезжает ровно на её
       ширину и до неё больше не достаёт. Минимальная ширина поля с v1.244 учитывает и планку, так
       что места хватает по построению. */
    /* РЕЗЕРВИРУЕМ НЕ ВСЮ ПЛАНКУ, А ТОЛЬКО ЕЁ НАЛОЖЕНИЕ НА ПОЛЕ (испр. v1.282). Пока планка стояла
       левым краем ровно у поля бит (v1.271), «её ширина» и «сколько она занимает внутри поля» были
       одним числом. С v1.282 планка начинается ЛЕВЕЕ — на границе П1, — и часть её висит над
       колонками точек и номеров, то есть вне поля. Резервируя полную ширину, мы отжимали бы полосу
       выравниваний вправо на те пиксели, которые она и так не перекрывает.
       Считаем честно: сколько планки заходит за левый край поля бит, столько и бережём. Когда
       планка снова окажется у самого края поля (нет колонки П1 — см. запасной путь выше), формула
       даёт ровно прежнюю величину. */
    /* СЧИТАЕМ ОБЕ ПЛАНКИ, А НЕ ОДНУ «№» (v1.287). Формула v1.282 берегла место только под неё —
       тогда она и была единственной, кто залезал в поле слева. С v1.287 планки поменялись
       сторонами: «№» ушла за границу, к паттернам, а внутрь поля встала «П1». Прибивать расчёт к
       конкретному имени больше незачем — берём НАИБОЛЬШЕЕ наложение из двух, и формула переживёт
       любой следующий переезд планок, включая запасной путь без колонки П1, где «№» снова
       оказывается внутри. */
    const numStripW = (() => {
      if (!bitsBox) return 0;
      /* ═══ ПЛАНКА ИЗ САМОЙ ПОЛОСЫ В РЕЗЕРВ НЕ ИДЁТ (испр. v1.363) ═══
         Баг-репорт: «меню выравниваний двигается вправо при выделении строк».
         Петля, родная сестра той, что чинилась в v1.357. Здесь считается, сколько места занять
         СЛЕВА, чтобы полоса не накрыла планки, стоящие над началом поля. Планка «П1» с v1.357
         живёт ВНУТРИ полосы — и её живая коробка едет вместе с полосой. Полоса сдвинулась вправо,
         планка вместе с ней, её правый край стал больше, резерв вырос, полоса сдвинулась ещё
         правее. Каждый пересчёт — а он идёт на любую перерисовку, в том числе на выделение
         строк, — добавлял виток.
         Считаем только те планки, что стоят СНАРУЖИ полосы: с ними резерв и задумывался. Сейчас
         такая одна — «№» над колонкой номеров цепочки; проверку делаем не по имени, а по месту,
         чтобы следующий переезд не пришлось ловить тем же способом. */
      const over = id => {
        const el = document.getElementById(id);
        if (!el || !el.classList.contains("act")) return 0;
        if (el.parentElement && el.parentElement.id === "alignGrp") return 0;
        return Math.max(0, el.getBoundingClientRect().right - bitsBox.left);
      };
      const w = Math.max(over("axisStrip"), over("patStripL"));
      return w ? w + 8 : 0;
    })();
    /* ═══ ПОЛОСА ПРИЖАТА К ЛЕВОЙ ГРАНИЦЕ ПОЛЯ Ц, А НЕ ЦЕНТРУЕТСЯ В НЁМ (v1.341) ═══
       Запрос пользователя: «меню выравниваний прижми к левой границе поля Ц».
       Центрирование (v1.241) решало свою задачу — не наползать на планки «П1»/«П2» у краёв, — но
       место полосы от этого зависело от ШИРИНЫ поля: тянешь границу, меняешь длину строк, и весь
       ряд кнопок ползёт вбок. У левого края место постоянное, как у планок рядом.
       Слагаемое numStripW остаётся, и это не «почти прижато», а необходимое: планка «№» стоит на
       ЭТОЙ ЖЕ строке (v1.265 — планки и полоса читаются одним рядом управления) и занимает как раз
       начало поля. Начинаем сразу за ней — левее полосе не встать, там кнопка номеров.
       Поля бит на экране нет (пустая цепочка) — прижимаем к левому краю раскладки, как и всё
       остальное в этом случае. */
    /* ═══ СРЕДНЯЯ ЧАСТЬ МЕНЮ 2 — ПО ЦЕНТРУ ПОЛЯ Ц (v1.367) ═══
       Запрос пользователя: «меню 2 — там 3 части: П1, Ц, П2 — каждая в своём поле всегда; в Ц по
       центру, в П1 прижата вправо, П2 лево».
       То есть ряд управления читается как три отдельных пульта, по одному на поле, и у каждого своя
       привязка внутри своего поля. Прижатие к левому краю (v1.341) этому правилу противоречит:
       средняя часть — часть ЦЕПОЧКИ и стоять должна по её центру, как и сама ось по умолчанию.
       Центруем по полю бит, а не по экрану: поле может быть сдвинуто ручками куда угодно, и центр
       экрана к нему отношения не имеет.
       Упор слева остаётся: планка «№» стоит у начала поля, и наезжать на неё центру нельзя. При
       нормальной ширине поля он не срабатывает вовсе — минимальная ширина (minBitsWidthPx) заведена
       как раз с запасом под обе планки, — а на узком поле лучше сместить полосу вправо, чем закрыть
       ею кнопку номеров. */
    const wantLeft = bitsBox
      ? Math.max((bitsBox.left - mainRect.left) + numStripW,
                 (bitsBox.left - mainRect.left) + (bitsBox.width - alignGrpEl.offsetWidth) / 2)
      : 2;
    alignGrpEl.style.left = Math.max(2, Math.round(wantLeft)) + "px";
    // ВЫСОТА: полоса стоит не под верхним меню, а СРАЗУ НАД первой строкой цепочки (v0.839,
    // запрос пользователя). Сам расчёт — в positionAlignGrpTop() (fold-3): его же зовёт
    // layoutOverlayBoxes(), чтобы полоса ехала вместе со строками, пока тянут высоту
    // "Результата", а не догоняла их следующей перерисовкой.
    positionAlignGrpTop();
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
     ширины   — крайние поля по 20% ширины холста каждое, остальное цепочке (v1.019), чтобы обе
                границы стояли на виду и на равном отступе от краёв окна;
     подгонка — снята (axisFitOn), она тоже держала ширину среднего столбца;
     выравн.  — к предустановке "по фэншую": П1 вправо, цепочка по центру, П2 влево (v1.018).
   Строки, паттерны и групповые выравнивания выделенных строк НЕ трогаются: это возврат раскладки,
   а не сброс работы. */
/* «◑ Слои» (setLayerFocus, v0.982) УДАЛЁН в v1.066: он приглушал два поля из трёх, чтобы при
   НАЛОЖЕНИИ было видно, чьи биты чьи. Поля больше не двигаются и наложиться не могут — гасить
   нечего. Вместе с ним ушли класс body.layers-on, body.dataset.hov и кнопка #bLayerFocus. */
/* «⬇ Меню вниз» (v1.006, запрос пользователя: "в Вид кнопку расположить панель меню верхнее
   внизу экрана"). Класс на body, кнопка подсвечивается mode-act, состояние сохраняется через
   captureUiSettings/applyUiSettings. */
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
  /* Сдвиги ОТДЕЛЬНЫХ полей (patOffL/patOffR/patOffLY/patOffRY/bitsOffY) обнулялись здесь до
     v1.066 — теперь их нет вовсе, поля неподвижны by design. Кнопка осталась ради ширин, ручных
     флагов и выравниваний: до «фэншуя» их всё ещё можно увести руками. */
  /* СДВИГИ ВСЕЙ РАСКЛАДКИ (v1.064, запрос пользователя: "нужна одна кнопка, которая вернёт весь вид
     паттернов и цепочек как они были в старых версиях, когда не двигали биты из своих полей").
     Кнопка «Поля на место» существует с v1.018 и обнуляла сдвиги ПОЛЕЙ, но про эти две величины не
     знала: chainShiftCols завели в v1.011 (ручка #vsplitL0 двигает всю .chain вбок), chainShiftRows
     — в v1.045 (та же ручка по вертикали). Обе уводят картинку целиком, и без них «весь вид»
     возвращался не весь: поля вставали по местам ВНУТРИ раскладки, а сама раскладка оставалась
     увезённой. Теперь кнопка честно отвечает за всё, что двигается мышью. */
  chainShiftCols = 0;
  chainShiftRows = 0;
  st.axisCenterOffset = 0;
  axisPinCol = null;
  axisFitOn = false;
  patWManual = false;
  patW2Manual = false;
  bitsWManual = false;
  document.body.classList.remove("bits-w-manual");
  /* ШИРИНЫ — ДОЛЯМИ ЭКРАНА, А НЕ ПО СОДЕРЖИМОМУ (v1.019, запрос пользователя: "граница левого поля
     и центрального должны быть видны и от границ браузера выступать примерно на 20%"). Автоподбор
     (флаги выше) считает колонку паттернов по самому длинному паттерну — а когда паттерны короткие
     или их нет вовсе, П1 сжимается до своего минимума в 40px, и граница П1|цепочка оказывается
     вплотную к левому краю холста: не видно её и не ухватить. Ровно от этого кнопка и должна
     спасать, так что после неё ставим ЯВНЫЕ доли: по 20% холста каждому крайнему полю, остальное
     цепочке. Обе границы (#vsplit слева, #vsplit2 справа) тогда стоят на виду, на равном отступе
     от краёв окна, симметрично.
     Флаги при этом поднимаются обратно в true — иначе ближайший же render() отменил бы эти ширины
     автоподбором (ради чего флаги и заведены). Ширины и флаги живут в кэше (см. captureUiSettings),
     поэтому раскладка переживает перезагрузку.
     Считаем от clientWidth холста — это его ВНУТРЕННЯЯ ширина, без полосы прокрутки; если он ещё
     не разложен (нулевая ширина при самом первом вызове), долей не ставим и оставляем автоподбор,
     как было. */
  {
    const canvasEl = document.getElementById("screenCanvas");
    const availW = canvasEl ? canvasEl.clientWidth : 0;
    if (availW > 240) {
      const side = Math.round(availW * 0.20);
      // Между колонками есть свои зазоры и отступы (см. .vsplit: 3px + --pat-w + 8px), плюс две
      // колонки номеров — вычитаем их из середины, чтобы сумма не переполнила холст и не завела
      // горизонтальную прокрутку прямо после "возврата на место".
      const numW = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--num-w")) || 0;
      const mid = Math.max(80, availW - 2 * side - 2 * numW - 24);
      const root = document.documentElement;
      root.style.setProperty("--pat-w", side + "px");
      root.style.setProperty("--pat-w2", side + "px");
      root.style.setProperty("--bits-w", mid + "px");
      patWManual = true;
      patW2Manual = true;
      bitsWManual = true;
      document.body.classList.add("bits-w-manual");
    }
  }
  /* ВЫРАВНИВАНИЯ — ТОЖЕ НА МЕСТО (v1.018, запрос пользователя: "«Поля на место» должна и поля, и
     выравнивания все поправить: правое у паттернов, центр у основ, левое у П2"). Раньше кнопка их
     намеренно не трогала ("возврат раскладки, а не сброс работы") — но уехавшее выравнивание
     крайнего поля выглядит ровно тем же беспорядком, что и уехавший сдвиг, и возвращать его
     приходилось отдельно, по кнопке ⇤ каждого поля.
     Набор — тот же "по фэншую", что стоит в приложении по умолчанию (см. patAlign/pat2Align в
     fold-1-core.js): у П1 ПРАВОЕ, у цепочки ЦЕНТР, у П2 ЛЕВОЕ — оба треугола паттернов развёрнуты
     К ЦЕНТРУ, к цепочке между ними. Групповые выравнивания выделенных строк (applyGroupAlign) сюда
     НЕ входят: это про поля целиком, а группы — отдельная, осознанно заданная вещь. */
  patAlign = "right";
  pat2Align = "left";
  st.align = "center";
  if (typeof applyPatAligns === "function") applyPatAligns();
  // syncAlignBanned() заодно зовёт syncAlignActMarks() — иначе отметка "act" в полосе осталась бы
  // на прежней кнопке, хотя выравнивание уже другое.
  if (typeof syncAlignBanned === "function") syncAlignBanned();
  applyPatOffsets();
  render();
  /* И ПОСЛЕДНЕЕ — ЦЕПОЧКА РОВНО ПО ЦЕНТРУ ЭКРАНА (v1.023, запрос пользователя: "при выравнивании
     полей вот так должно быть, по центру цепочки"). Долей ширины (20/60/20 выше) для этого мало:
     колонки номеров по краям поля битов НЕ симметричны — у левой свой flex-basis (--numl-w, в неё
     печатается ещё и метка баланса), у правой обычный --num-w, — плюс зазоры между колонками. На
     сумме этих мелочей середина поля битов оказывается в стороне от середины холста, и вся картина
     стоит чуть боком, хотя ширины заданы поровну.
     Доводим ПРОКРУТКОЙ, а не сдвигом: centerFieldOnScreen() трогает только scrollLeft, поэтому
     раскладка, которую мы только что выставили, остаётся ровно такой, какой её задали, — двигается
     точка обзора. Через rAF, потому что мерить надо УЖЕ РАЗЛОЖЕННЫЙ кадр: render() выше только что
     переписал разметку и сменил три CSS-переменных ширины. */
  requestAnimationFrame(() => {
    if (typeof centerFieldOnScreen === "function") centerFieldOnScreen("C");
  });
  saveCache();
  say("Вид собран заново: обнулён сдвиг всей раскладки и оси цепочки; крайние поля разведены по 20% ширины холста (обе границы на виду, симметрично от краёв); выравнивания сведены к предустановке — П1 по правому краю, цепочка по центру, П2 по левому; экран доведён так, чтобы цепочка стояла ровно посередине. Сами строки, паттерны и группы не тронуты.");
}
{
  const b = document.getElementById("bResetFields");
  if (b) b.onclick = () => resetFieldsLayout();
  // Двойной клик по «⇤» возвращал на место ОДНО поле (сдвиг в ноль) — с v1.066 поля неподвижны,
  // возвращать нечего, обработчик убран. Одиночный клик по этим кнопкам по-прежнему гоняет
  // выравнивание колонки по кругу (см. cyclePatAlign выше).
}
function axisFitReset(quiet){
  axisFitOn = false;
  bitsWManual = false;          // ширину среднего столбца снова считает render() по строкам
  st.axisCenterOffset = 0;      // общий визуальный сдвиг картинки
  axisPinCol = null;            // и закреплённый за осью столбец (см. holdAxisOnMaxLenChange)
  render(); saveCache();
  if (!quiet) say("Подгонка снята: ширина поля цепочек снова автоматическая, сдвиг оси сброшен.");
}
/* ═══ ДВОЙНОЙ КЛИК ПО ОСИ: СЕРЕДИНА ПОЛЯ И СЕРЕДИНА ЭКРАНА (v1.429) ═══
   Запрос пользователя: «двойной клик по оси Ц пусть только ставит ось в середину ширины Ц, не меняя
   саму ширину, и одновременно ставит её в середину экрана браузера — прокруткой поля по горизонтали,
   как необходимо для этого».
   Прежний жест (axisCenterAndFitBits, v0.903) заодно РАЗДВИГАЛ поле под самую длинную строку. Это
   другое действие и другая цена: ширину человек выставляет руками и терять её на двойном клике по
   оси не должен. Оставляем ровно две вещи — центр и прокрутку.
   СЕРЕДИНА ПОЛЯ, А НЕ СТРОКИ. centerAxisOffset() рядом считает середину САМОЙ ДЛИННОЙ СТРОКИ, и это
   верно для своей задачи, но здесь спрошено про ширину Ц. Берём её из --bits-w и переводим в
   столбцы тем же шагом, которым размечено всё поле.
   ЗАКРЕПЛЯЕМ СТОЛБЕЦ (axisPinCol) — как это делает протяжка оси: без него ближайший же кадр вернёт
   линию на прежнее место (holdAxisOnMaxLenChange).
   ПРОКРУТКА — ПОСЛЕ render(): координата линии (lastAxisLeftPx) становится известна только когда
   ось переставлена, а переставляет её проход отрисовки. Считаем от неё до середины ОКНА и на
   разницу двигаем холст, зажимая в его же пределы: у края прокручивать некуда, и ось просто
   остановится ближе, чем в центре, — честнее, чем прыгать в пустоту. */
function axisCenterInFieldAndScreen(){
  const step = (typeof realColStepPx === "function" ? realColStepPx() : 0) || 8;
  const bitsW = parseFloat(getComputedStyle(document.documentElement)
                             .getPropertyValue("--bits-w")) || 0;
  const cols = step > 0 ? bitsW / step : 0;
  if (!cols) { say("Ось: поле цепочки ещё не размечено — центрировать не по чему."); return; }
  const base = (typeof axisBaseCol === "function") ? axisBaseCol() : 0;
  /* ═══ СЕРЕДИНУ ПОЛЯ БЕРЁМ ЗАМЕРОМ, А НЕ ФОРМУЛОЙ (испр. v1.439 → v1.440) ═══
     Баг-репорт: «не ставит в середину в итоге Ц ось».
     Формула «столбец = половина поля» промахивалась, и промах был не случайным: номер столбца
     отсчитывается от левого края поля, а САМА ЛИНИЯ стоит не по формуле, а по замеру первого
     настоящего бита первой строки (см. updateAxisSplitPosition — там это разобрано подробно).
     Между ними разница на весь сдвиг выравнивания: у «по центру» или у лесенки первая строка
     начинается далеко не с нулевого столбца, и ось уезжала ровно на этот сдвиг.
     Считаем по факту: смотрим, где линия оказалась после отрисовки, где середина заливки поля
     (#fieldBgC — она и есть поле от границы до границы), и двигаем ось на разницу, округлённую
     до целых столбцов — шаг у оси столбцовый, между столбцами ей не встать. Несколько проходов:
     каждый сдвиг пересчитывает раскладку, и остаток добирается следующим; выходим, как только
     промах меньше половины столбца.
     Стартовая прикидка формулой остаётся: с неё проходов нужно меньше. */
  st.axisCenterOffset = Math.round(cols / 2) - base;
  axisPinCol = base + st.axisCenterOffset;
  render();
  {
    const chainForMid = document.getElementById("chain");
    const fldCEl = document.getElementById("fieldBgC");
    for (let pass = 0; pass < 4 && chainForMid && fldCEl; pass++) {
      const fRect = fldCEl.getBoundingClientRect();
      if (!(fRect.width > 0)) break;
      const chRect = chainForMid.getBoundingClientRect();
      const midPx = (fRect.left + fRect.right) / 2 - chRect.left;
      const dCols = Math.round((midPx - (lastAxisLeftPx || 0)) / step);
      if (!dCols) break;
      st.axisCenterOffset = (st.axisCenterOffset || 0) + dCols;
      axisPinCol = ((typeof axisBaseCol === "function") ? axisBaseCol() : 0) + st.axisCenterOffset;
      render();
    }
  }
  /* ═══ НА СЕРЕДИНУ ОКНА — ШИРИНОЙ П1, А НЕ ОДНОЙ ПРОКРУТКОЙ (v1.439) ═══
     Запрос пользователя: «меняй ширину П1», «при этом если надо».
     Ось уже стоит посреди поля цепочки (выше), осталось подвести к ней экран. Прокрутка одна с
     этим справляется не всегда: пока слева от раскладки пусто, прокручивать нечего — упор в ноль,
     и ось так и остаётся левее середины окна.
     Двигаем саму раскладку: ширина П1 и есть то расстояние, на которое всё правее неё отступает от
     края холста. Прибавили — цепочка уехала вправо, убавили — влево, и ось идёт вместе с ней.
     «Если надо» — буквально: разница меньше пикселя, и колонку не трогаем вовсе.
     Что П1 отдать не смогла (упёрлись в нулевую ширину), добираем прокруткой — жест обязан
     доводить ось до середины и в этом случае тоже.
     patWManual — как у протяжки ручки #vsplit: ширину задали руками, и ближайший render() не
     должен вернуть автоподбор по самому длинному паттерну. Вернуть автоширину — двойной клик по
     самой ручке. */
  const sc = document.getElementById("screenCanvas");
  const chainEl = document.getElementById("chain");
  let patWMoved = 0;
  if (chainEl) {
    const axisXNow = () => chainEl.getBoundingClientRect().left + (lastAxisLeftPx || 0);
    const wantX = window.innerWidth / 2;
    const need = wantX - axisXNow();
    if (Math.abs(need) >= 1) {
      const rootEl = document.documentElement;
      const curPatW = parseFloat(getComputedStyle(rootEl).getPropertyValue("--pat-w")) || 0;
      const nextPatW = Math.max(0, curPatW + need);
      if (Math.abs(nextPatW - curPatW) >= 1) {
        rootEl.style.setProperty("--pat-w", nextPatW.toFixed(2) + "px");
        patWManual = true;
        patWMoved = nextPatW - curPatW;
        render();
      }
    }
    if (sc) {
      const rest = wantX - axisXNow();
      if (Math.abs(rest) >= 1) {
        const maxScroll = Math.max(0, sc.scrollWidth - sc.clientWidth);
        sc.scrollLeft = Math.max(0, Math.min(maxScroll, sc.scrollLeft - rest));
      }
    }
  }
  saveCache();
  say("Ось: поставлена в середину поля цепочки и выведена на середину экрана" +
      (Math.abs(patWMoved) >= 1
         ? ` — П1 ${patWMoved > 0 ? "шире" : "уже"} на ${Math.abs(Math.round(patWMoved))}px.`
         : ". Ширину П1 менять не пришлось.") +
      " Ширина поля цепочки не тронута.");
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
/* ═══ НА ЧЬИХ ГЛИФАХ СТОИТ КУРСОР ═══
   Отвечает на один вопрос: под курсором РЕАЛЬНО НАРИСОВАННЫЕ глифы какого поля — "C" (биты
   цепочки), "L"/"R" (текст паттернов П1/П2) или "" (мимо всего, пустое место).
   ЗАЧЕМ ЭТО ОСТАЛОСЬ (v1.066): раньше здесь проходила граница между двумя жестами — за глифы
   тянулось поле, мимо глифов мотался обзор (v1.018). Поля неподвижны, тянуть нечего, прокрутка
   работает откуда угодно; функция нужна ровно для одного — щелчок по глифам выбирает ПРИЁМНИК
   полосы выравниваний (см. блок сразу под ней).
   ПОЧЕМУ ГЕОМЕТРИЯ, А НЕ e.target: у .ln .bits стоит pointer-events:none (давняя основа разметки,
   см. CSS), поэтому e.target НИКОГДА не бывает глифом цепочки — спрашивать приходится координаты.
   Зовётся на mousedown, а не на каждом движении мыши. */
function fieldGlyphsHit(e){
  const hitRect = (els) => {
    if (!els || !els.length) return false;
    const r0 = els[0].getBoundingClientRect(), r1 = els[els.length - 1].getBoundingClientRect();
    return e.clientX >= Math.min(r0.left, r1.left) && e.clientX < Math.max(r0.right, r1.right) &&
           e.clientY >= Math.min(r0.top, r1.top) && e.clientY < Math.max(r0.bottom, r1.bottom);
  };
  /* ЦЕПОЧКА ПЕРВОЙ: её биты нарисованы НАД паттернами (z-index:2 у .bits>span против 1 у
     .pat-shift), значит при наложении хватать надо именно их — тот же порядок, что и в
     fieldAtEventEl ниже. Меряем по ПЕРВОМУ и ПОСЛЕДНЕМУ .b0/.b1 строки, а не по span'у целиком:
     в span входит ещё и отступ выравнивания неразрывными пробелами — невидимый, но занимающий
     реальную ширину, из-за чего "попадание" срабатывало там, где на экране бит нет. */
  /* Перебор ВСЕХ строк (нужен был при ненулевом bitsOffY: биты уезжали из своей .ln и даже за
     пределы #rows) убран в v1.066 вместе с вертикальными сдвигами полей — биты снова всегда внутри
     своей строки, хватает той .ln, что физически под курсором. */
  const bitsOf = ln => ln ? ln.querySelectorAll(".bits > span .b0, .bits > span .b1") : null;
  if (hitRect(bitsOf(e.target.closest(".ln")))) return "C";
  /* ПАТТЕРНЫ ловят мышь сами (pointer-events у .pat/.pat2 не снят, и с overflow:visible они ловят
     её даже там, куда уехали за свои границы), поэтому им геометрия не нужна — хватает e.target.
     .pat-txt — это РОВНО глифы паттерна: без отступа выравнивания и без номера строки, они в
     обёртку намеренно не входят (см. patTxtHtml в render()). У пустой ячейки .pat-txt нет вовсе —
     значит пустое место в колонке паттернов честно считается "мимо" и уходит скроллу. */
  const txt = e.target.closest && e.target.closest(".pat-txt");
  if (txt) return txt.closest(".pat2") ? "R" : "L";
  return "";
}
/* ═══ ЩЕЛЧОК ПО ГЛИФАМ ВЫБИРАЕТ ПРИЁМНИК ПОЛОСЫ ВЫРАВНИВАНИЙ (v1.003) ═══
   Всё, что этот блок делал КРОМЕ этого — протяжка поля за биты (v0.976–v0.987: сдвиг П1/цепочки/П2
   вбок и по вертикали) и подсветка «◑ Слои» под курсором, — удалено в v1.066 вместе с самой
   подвижностью полей. Осталось одно: последний щелчок над битами/паттерном говорит полосе
   выравниваний, чьё выравнивание она сейчас правит (П1 / цепочка / П2).
   quiet:true — тихо, без say(): иначе сообщение сыпалось бы на КАЖДЫЙ клик по полю, а это самое
   частое действие в приложении.
   ШРИФТОВЫЕ РУЧКИ (Ctrl — межстрочный, Shift — межсимвольный) жили здесь же и переехали в блок
   прокрутки ниже: он теперь ловит протяжку по ВСЕМУ холсту, а не только мимо глифов. */
{
  const el = document.getElementById("screenCanvas");
  if (el) el.addEventListener("mousedown", e => {
    if (e.button !== 0 || e.metaKey || e.altKey) return;
    if (cellSelMode || colPickMode) return;
    if (e.target.closest(".axis-split, .axis-strip, .hsplit-top, .vsplit, .vsplit2, .vsplit3, #alignGrp, #colHeader")) return;
    const field = fieldGlyphsHit(e);
    if (!field) return;
    /* setAlignTarget(field, true) отсюда убран (v1.213): приёмника выравниваний больше нет, и клик
       по битам поля ничего не «наводил» — полоса и так всегда про цепочку. */
    lastGrabWasBorder = false;   // под замком (🔒) без Alt стрелки пойдут в ось, а не в границу
  });
}

/* ═══ ПРОТЯЖКА ПО ХОЛСТУ — ГОРИЗОНТАЛЬНАЯ ПРОКРУТКА ПОЛОТНА (v1.018, запрос пользователя:
   "пусть перетаскивание за поле любое мимо битов если — как скролл горизонтальный действует";
   тем же запросом: "а общее передвижение битов когда вне полей — убери") ═══
   С v1.066 это ЕДИНСТВЕННЫЙ смысл протяжки по холсту: раньше жест делился надвое — за глифы тянулось
   поле, мимо глифов мотался обзор, — а теперь тянуть нечего, поля неподвижны, и мотается обзор
   ОТКУДА УГОДНО: и с пустого места, и прямо с бит.
   Мотает вбок ровно как если бы тянули ползунок горизонтальной прокрутки внизу (.canvas сама по
   себе overflow-x:auto, см. CSS). Прокрутка ничего не сдвигает и в кэш не пишется — это просто
   scrollLeft, поэтому тут нет ни saveCache(), ни render().
   Слушатель висит на #screenCanvas (не на #rows — под последней строкой это уже ПОЛОТНО: #rows
   высотой ровно в свои строки и заканчивается вместе с ними), с тем же списком исключений, что и
   у "клика мимо" для сброса выбора ячеек (см. её блок в fold-2-render.js): служебные элементы
   холста ведут свою протяжку сами. */
{
  const canvasPanEl = document.getElementById("screenCanvas");
  const PAN_SCROLL_DEAD_PX = 3;
  let panScroll = null;
  if (canvasPanEl) canvasPanEl.addEventListener("mousedown", e => {
    // Ctrl СЮДА ТЕПЕРЬ ПРОХОДИТ (v1.066): шрифтовые ручки переехали в этот блок из удалённой
    // протяжки поля, а они как раз на Ctrl и Shift. Сама прокрутка под модификатором не работает —
    // см. проверки в mousemove.
    if (e.button !== 0 || e.metaKey || e.altKey) return;
    if (cellSelMode || colPickMode) return;
    if (typeof wrapModeOn === "function" && wrapModeOn()) return;
    if (e.target.tagName === "INPUT" || e.target.closest(".edit-row-input")) return;
    /* ПРОТЯЖКА ВЫДЕЛЕНИЯ ГЛАВНЕЕ ЭТОГО ЖЕСТА (испр. v1.079, баг-репорт пользователя: "тяну
       выделение вниз с 1 строки… на 5 находится паттерн, дальше тяну на 6, 7 — выделение не идёт").
       К находке это отношения не имело, совпало по времени. Настоящая цепочка такая: mousedown по
       строке ставит якорь протяжки в fold-3-ops (её слушатель на #rows, а #rows — потомок холста,
       поэтому отрабатывает РАНЬШЕ этого), после чего тот же mousedown доходит сюда и взводит ещё и
       прокрутку обзора. Дальше жест ведут оба. И как только прокрутка проходит свою мёртвую зону,
       она ОБНУЛЯЕТ rowDragAnchor/patDragAnchor (ниже) — якорь исчезает, и выделение замирает на
       той строке, до которой успело дойти.
       Почему это случалось не сразу, а посреди протяжки: мёртвая зона у прокрутки считается ТОЛЬКО
       по горизонтали (dx). Ведут выделение вниз, dx около нуля — зона не пройдена, всё работает.
       Но рука неизбежно уводит курсор на три пикселя вбок, и ровно в этот момент якорь обнуляется.
       Оттого и «сломалось на пятой строке»: там пользователь задержался на находке.
       Правило теперь простое: якорь выделения уже стоит — этот жест не начинается вовсе. Ни
       прокрутки, ни шрифтовых ручек: выделение строк важнее и того, и другого. Пустой холст,
       границы и всё, где выделение не начинается, по-прежнему целиком за ними. */
    if (rowDragAnchor !== null || patDragAnchor !== null) return;
    if (e.target.closest("#alignGrp, #colHeader, .vsplit, .vsplit2, .vsplit3, .axis-split, .axis-strip, .hsplit-top, #colPickFloat, button, input, select, label")) return;
    lastGrabWasBorder = false;   // под замком (🔒) без Alt стрелки пойдут в ось, а не в границу
    /* НАД ГЛИФАМИ ПРОТЯЖКА ПРИНАДЛЕЖИТ ВЫДЕЛЕНИЮ СТРОК (испр. v1.071, баг-репорт пользователя:
       "выделение строк вообще пропало"). В v1.066, убирая протяжку поля, я снял отсюда проверку
       fieldGlyphsHit — казалось, раз двигать нечего, пусть обзор мотается откуда угодно. Но
       мёртвую зону этот жест проходит и над строками, а дальше по коду он ОБНУЛЯЕТ rowDragAnchor/
       patDragAnchor и поднимает fieldPanMoved — то есть ровно то, чем протяжка поля когда-то
       законно гасила выделение. В итоге протяжкой по строкам ничего не выделялось, а обзор
       уезжал вбок. Прокрутка снова только по ПУСТОМУ месту, как и было до v1.066.
       Сам жест при этом не бросаем: ШРИФТОВЫЕ РУЧКИ (Ctrl/Shift) обязаны работать и над битами —
       раньше они жили в протяжке поля, которая как раз над глифами и начиналась. Поэтому здесь не
       return, а флаг: над глифами жест умеет ТОЛЬКО шрифт, без прокрутки и без сноса якорей. */
    const overGlyphs = !!fieldGlyphsHit(e);
    panScroll = { x0: e.clientX, base: canvasPanEl.scrollLeft, moved: false, overGlyphs: overGlyphs,
                  lhDrag: makeLhVDrag(e.clientY), lsDrag: makeLsHDrag(e.clientX) };
  });
  window.addEventListener("mousemove", e => {
    if (!panScroll) return;
    if (!(e.buttons & 1)) { panScroll = null; return; }
    const dx = e.clientX - panScroll.x0;
    /* CTRL / SHIFT — ШРИФТ, НЕ ПРОКРУТКА. Ctrl — межстрочный (makeLhVDrag, вертикаль; так же и на
       границах полей, см. makeColResizer), Shift — межсимвольный (makeLsHDrag, горизонталь). Обе
       ручки зовём КАЖДЫЙ кадр, а не только пока клавиша зажата, — иначе "armed" внутри них не
       разоружается вовремя (держат Ctrl, держат и Shift, отпустили Ctrl — точка отсчёта Shift-ручки
       должна перевзвестись СЕЙЧАС). Ctrl главнее: пока он зажат, у Shift-ручки active=false. */
    panScroll.lhDrag(e.clientY, !!e.ctrlKey);
    panScroll.lsDrag(e.clientX, !!e.shiftKey && !e.ctrlKey);
    if (e.ctrlKey || e.shiftKey) {
      // Помечаем жест протяжкой, чтобы click после mouseup не выделил строку, на которой крутили
      // шрифт (тот же приём, что у строчной протяжки в fold-3-ops.js).
      if (!panScroll.moved) { panScroll.moved = true; fieldPanMoved = true;
                              rowDragAnchor = null; patDragAnchor = null;
                              document.body.classList.add("field-panning"); }
      return;
    }
    // Начали НАД ГЛИФАМИ и без модификатора — это выделение строк (fold-3-ops.js), не наше дело:
    // ни прокрутки, ни сноса якорей выделения (см. overGlyphs у mousedown выше).
    if (panScroll.overGlyphs) return;
    if (!panScroll.moved) {
      if (Math.abs(dx) < PAN_SCROLL_DEAD_PX) return;
      panScroll.moved = true;
      fieldPanMoved = true;
      rowDragAnchor = null;
      patDragAnchor = null;
      document.body.classList.add("field-panning");
    }
    // Минус: тянем полотно ВПРАВО — содержимое едет вправо, значит окно обзора уезжает ВЛЕВО.
    // Это "схватил лист и подвинул", а не "подвинул ползунок", — так же ведёт себя рука на тачпаде.
    canvasPanEl.scrollLeft = panScroll.base - dx;
  });
  window.addEventListener("mouseup", () => {
    if (!panScroll) return;
    const moved = panScroll.moved;
    panScroll = null;
    document.body.classList.remove("field-panning");
    if (!moved) return;
    // Сброс через setTimeout — click браузер шлёт ПОСЛЕ mouseup, и он должен успеть увидеть флаг.
    setTimeout(() => { fieldPanMoved = false; }, 0);
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
  /* Сколько сдвига УЖЕ скомпенсировано блокам (v1.257, см. pasteHoldOnAxisShift): считаем от
     НАМЕРЕНИЯ жеста, а не от текущего offset — тот по дороге правит clampAxisOffset, и его правки
     жест не заказывал; иначе блоки поехали бы сами собой. */
  let axisDragApplied = 0;
  const move = (ev) => {
    const deltaCols = Math.round((ev.clientX - startX) / chPx);
    st.axisCenterOffset = startOffset + deltaCols;
    // Ручка — единственный способ ПЕРЕДВИНУТЬ ось; закрепляем за ней новый столбец, иначе
    // ближайший же кадр вернул бы ось на прежнее место (см. holdAxisOnMaxLenChange).
    axisPinCol = axisBaseCol() + st.axisCenterOffset;
    if (deltaCols !== axisDragApplied) {
      pasteHoldOnAxisShift(deltaCols - axisDragApplied);
      axisDragApplied = deltaCols;
    }
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
  /* v1.429: двойной клик больше не раздвигает поле — он ставит ось в середину поля и подводит к ней
     экран, не трогая ширину.
     Прежняя axisCenterAndFitBits после этого осталась БЕЗ ЕДИНОГО ВЫЗОВА. Не удаляю: в ней собран
     весь расчёт «раздвинуть поле так, чтобы самая длинная строка поместилась целиком» вместе с
     откатом (axisFitOn/axisFitReset), и просили убрать не подгонку как таковую, а её приклеенность
     к этому жесту. Понадобится вернуть — вешать заново некуда, всё на месте. */
  if (axisSplitEl) axisSplitEl.addEventListener("dblclick", (e) => { e.preventDefault(); axisCenterInFieldAndScreen(); });
}
/* ═══ ПОД ЗАМКОМ ЦЕПОЧКУ ТЯНУТ ЗА ЛЮБОЙ БИТ, КАК ЗА ОСЬ (v1.345) ═══
   Запрос пользователя: «в режиме замка пусть не только за ось, но и за все биты цепочки
   передвигать можно, как за ось».
   Под 🔒 полотно и так не выделяется и биты не двигаются (см. selectionAllowed), то есть весь этот
   прямоугольник простаивает — а ось при этом ниточка в пару пикселей, и попадать в неё каждый раз
   мышью неудобно. Отдаём под ту же протяжку всё поле цепочки: жест ровно тот же, startAxisDrag,
   никакой второй логики. Значит и поведение то же — сдвиг считается целыми столбцами, наложения
   придерживаются (pasteHoldOnAxisShift), ось закрепляется за новым столбцом.
   ЗАМОК СНЯТ — не вмешиваемся вовсе: там по битам работает выделение строк и ячеек, и перехват
   ломал бы обычную работу.
   ФАЗА ЗАХВАТА (capture). Обработчики выделения висят ниже по дереву, на самих строках; в обычной
   фазе они получили бы событие первыми. Здесь же мы решаем судьбу жеста раньше всех и, если он
   наш, дальше его не пускаем.
   НАЛОЖЕНИЯ (📋) — ИСКЛЮЧЕНИЕ, и это прямо записано в подсказке замка: вставленный блок под 🔒
   остаётся живым, его берут мышью и ведут стрелками. Пропускаем и сам блок, и его панель с ручкой,
   и ярлык группы — они лежат внутри .bits и иначе попали бы под перехват.
   ТОЛЬКО ЛЕВАЯ КНОПКА: правой висит своё контекстное меню полотна. */
{
  const rowsHostLock = document.getElementById("rows");
  if (rowsHostLock) rowsHostLock.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    if (typeof selectionAllowed === "function" && selectionAllowed()) return;
    if (!e.target || !e.target.closest) return;
    if (e.target.closest(".paste-bits, .paste-bar, .paste-grip, .paste-axis, .grp-badge")) return;
    const bitsHit = e.target.closest(".bits");
    if (!bitsHit || !bitsHit.closest(".ln")) return;
    e.stopPropagation();
    startAxisDrag(e);
  }, true);
}
/* ПРОКРУТИТЬ ЭКРАН ТАК, ЧТОБЫ БИТЫ ПОЛЯ ОКАЗАЛИСЬ ПО ЦЕНТРУ (v1.020, уточнено в v1.021, запрос
   пользователя: "не перемещает биты за ось, а должен просто скролл экрана подвинуть так, как
   возможно, чтобы биты оказались в центре экрана, не перемещая их в полях").
   Висит на ДВОЙНОМ КЛИКЕ по кнопке-приёмнику #bAlignTargetInd (Ц/П1/П2) и работает с тем полем,
   которое там сейчас выбрано, — одиночный клик у неё занят переключением приёмника по кругу.
   ДВИГАЕМ ТОЧКУ ОБЗОРА, А НЕ САМУ РАСКЛАДКУ. В первой редакции (v1.020) функция прибавляла сдвиг
   полю — patOffL/patOffR у крайних, st.axisCenterOffset у цепочки, — то есть РЕАЛЬНО переставляла
   биты относительно других полей и ломала взаимное расположение, ради которого их и раскладывают.
   Теперь трогается только scrollLeft холста: биты остаются ровно там, где стояли, в кэш ничего не
   пишется (прокрутка не часть раскладки), render() и applyPatOffsets() не нужны вовсе.
   "КАК ВОЗМОЖНО" — про упор в края: браузер сам зажимает scrollLeft в [0, scrollWidth-clientWidth],
   поэтому у самого края поле встаёт настолько близко к центру, насколько холст позволяет прокрутке
   уехать, и ничего дополнительно считать не надо.
   СЧИТАЕМ ПО РЕАЛЬНЫМ ГЛИФАМ, а не по коробке колонки: коробка стоит на месте всегда, а в центр
   надо вывести то, что НАРИСОВАНО, — с учётом набранного сдвига и выравнивания. У крайних полей
   глифы это .pat-txt, у цепочки — пробег .b0/.b1 внутри .bits>span (первый и последний дают её
   реальный охват, без пустого отступа выравнивания по краям — та же мерка, что в fieldGlyphsHit). */
/* ВЕРХНИЙ БИТ ЦЕПОЧКИ — В ЦЕНТР ЭКРАНА (v1.030, запрос пользователя: "шифт и стрелка влево-право
   когда — надо держать в центре экрана биты так, чтобы самый верхний оставался на оси; ось не
   смещать при этом").
   Мерим ПЕРВЫЙ бит ПЕРВОЙ строки — он и есть "самый верхний", и именно через него проходит ось при
   выравнивании по центру. Доводим ПРОКРУТКОЙ: ось (st.axisCenterOffset/axisPinCol) не трогаем
   вовсе — она и биты лежат в одном прокручиваемом слое и едут вместе, так что их взаимное
   положение прокрутка не меняет; двигается только окно обзора. Это ровно то, что просили: "ось не
   смещать".
   Возвращает false, когда мерить нечего (пустая цепочка) — вызывающий тогда молчит. */
function centerTopBitOnScreen(){
  const canvasEl = document.getElementById("screenCanvas");
  const ln = document.querySelector("#rows .ln");
  if (!canvasEl || !ln) return false;
  const bits = ln.querySelectorAll(".bits > span .b0, .bits > span .b1");
  if (!bits.length) return false;
  const r = bits[0].getBoundingClientRect();
  const cr = canvasEl.getBoundingClientRect();
  if (!cr.width) return false;
  canvasEl.scrollLeft += (r.left + r.width / 2) - (cr.left + cr.width / 2);
  return true;
}
function centerFieldOnScreen(which){
  const canvasEl = document.getElementById("screenCanvas");
  if (!canvasEl) return false;
  const cr = canvasEl.getBoundingClientRect();
  if (!cr.width) return false;
  let left, right;
  if (which === "C") {
    const ln = document.querySelector("#rows .ln");
    const bits = ln ? ln.querySelectorAll(".bits > span .b0, .bits > span .b1") : null;
    if (!bits || !bits.length) return false;
    const r0 = bits[0].getBoundingClientRect(), r1 = bits[bits.length - 1].getBoundingClientRect();
    left = Math.min(r0.left, r1.left); right = Math.max(r0.right, r1.right);
  } else {
    const txt = document.querySelector("#rows .ln " + (which === "L" ? ".pat .pat-txt" : ".pat2 .pat-txt"));
    if (!txt) return false;
    const r = txt.getBoundingClientRect();
    left = r.left; right = r.right;
  }
  if (right <= left) return false;
  // Прокрутить ВПРАВО на X — значит увести содержимое ВЛЕВО на X. Значит к scrollLeft прибавляем
  // "насколько центр глифов сейчас правее центра холста".
  canvasEl.scrollLeft += ((left + right) / 2) - (cr.left + cr.width / 2);
  return true;
}
/* Ручки-оси крайних полей #axisSplitPatL/#axisSplitPatR удалены целиком в v1.081. Их обработчики
   (протяжка поля вбок + двойной клик «вернуть на место») ушли ещё в v1.066 вместе со сдвигами
   полей, после чего ручки остались только якорем для планок «П1»/«П2». Планки теперь стоят у
   границ своих полей (см. placeStrip в updateSplitPositions), и якорь им не нужен. */
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
/* ═══ ОТСЧЁТ С НУЛЯ, А НЕ С ЕДИНИЦЫ (v1.338) ═══
   Запрос пользователя: «пусть начинает с 0, сейчас с 1».
   Было 1, 10, 11, 100… — первая строка соответствовала числу 1, и нулевая строка цепочки несла
   единицу. Теперь ряд начинается с самого нуля: 0, 1, 10, 11, 100…, то есть строка i это ровно
   число i, как и обещает подпись кнопки.
   Верхняя граница остаётся ВКЛЮЧИТЕЛЬНОЙ и той же самой (N из поля рядом), поэтому строк на одну
   больше, чем было: раньше 1…N, теперь 0…N. Резать хвост ради прежнего КОЛИЧЕСТВА не стал —
   в поле пишут «до какого числа строить», а не «сколько строк». */
function generateBinaryNumbers(n) {
  const rows = [];
  for (let i = 0; i <= n; i++) rows.push(i.toString(2));
  return rows;
}

/* Снимок всех настроек-кнопок/галочек/ползунков — используется и обычным кэшем в localStorage,
   и кнопкой "💾 Сохран" (сохранение цепочки), чтобы не дублировать список полей дважды. */
/* ═══ КНОПКИ У ОСЕЙ НАЛОЖЕНИЙ: ПОКАЗАТЬ / СПРЯТАТЬ ВСЕ РАЗОМ (v1.212) ═══
   Запрос пользователя: «на их место поставь кнопку, которая вкл-выкл отображение у осей наложений
   всех кнопок». Прячется ТОЛЬКО вид — панель операции/шага/крестика и квадратики цвета у каждого
   блока (см. .paste-bar/.paste-colbtns в fold.html); оси-черты остаются, иначе блок стало бы не за
   что схватить, а его биты, операции и участие в расчёте не меняются вовсе.
   Классом на body, без перерисовки: render() тут не при чём, а блоков может быть три, и каждый
   рисует свою панель на каждой своей строке. */
function applyPasteBarsMode(){
  const on = st.pasteBarsOn !== false;
  document.body.classList.toggle("paste-bars-off", !on);
  const b = document.getElementById("bPasteBars");
  if (b) b.classList.toggle("mode-act", on);
}
function togglePasteBars(){
  st.pasteBarsOn = (st.pasteBarsOn === false);
  applyPasteBarsMode();
  say(st.pasteBarsOn
    ? "⧉ Кнопки наложений показаны: у каждого блока снова видна его панель (операция, шаг, ✕) и цвета."
    : "⧉ Кнопки наложений скрыты: остались только оси блоков — за них же их и таскают. Сами блоки и расчёт не изменились.");
  saveCache();
}
{
  const b = document.getElementById("bPasteBars");
  if (b) b.addEventListener("click", togglePasteBars);
  applyPasteBarsMode();
}

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
    pasteBarsOn: st.pasteBarsOn !== false,          // «⧉ Кнопки» (v1.212)
    mirrorFull: !!st.mirrorFull,                   // зеркало со всеми битами (v1.219)
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
    fullPassMode: !!st.fullPassMode,
    noPatsAbove: !!st.noPatsAbove,
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
    rowNumMode: st.rowNumMode || "dec",
    // Какой стороной сейчас приклеены номера к паттернам ("", "right", "left") — см. numGlueToggle():
    // по нему же они отрываются обратно, поэтому состояние обязано пережить перезагрузку.
    numGlue: st.numGlue || "",
    numGlueRows: st.numGlueRows || "",
    binBalance: st.binBalance || "",
    // Режимы номеров в ячейках паттернов (v1.082, три положения). Булевы patNumL/patNumR пишем
    // рядом ради СТАРЫХ сохранёнок: откатившаяся версия прочтёт их и не потеряет настройку.
    patNumModeL: (typeof patNumModeOf === "function" ? patNumModeOf("l") : (st.patNumModeL || "off")),
    patNumModeR: (typeof patNumModeOf === "function" ? patNumModeOf("r") : (st.patNumModeR || "dec")),
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
    /* alignHorizon + frozenAlign (v1.026) больше не пишутся: горизонт удалён целиком (v1.043,
       см. rowAlignCtx в fold-1-core.js). Вертикальный сдвиг, который теперь делает та же ручка, —
       это chainShiftRows ниже. */
    hideSide: document.body.classList.contains("hide-side"),
    // hidePatL/hidePatR больше не пишутся: скрытия колонок П1/П2 нет вовсе (v0.976).
    // patOffL/patOffR/patOffLY/patOffRY/bitsOffY — тоже: сдвигов отдельных полей нет с v1.066,
    // остались только сдвиги ВСЕЙ раскладки (chainShiftCols/chainShiftRows) и ось цепочки.
    chainShiftCols: chainShiftCols || 0,
    chainShiftRows: chainShiftRows || 0,   // вертикальный сдвиг всей раскладки, ручка #hsplitTop (v1.045)
    pinSlots: pinSlots,
    menuBarBottom: document.body.classList.contains("menubar-bottom"),
    msgPos: msgPos || "",
    c1: col1.value, c0: col0.value, cBg: colBg.value, preset: currentPreset,
    // Цвета «1»/«0» в колонках паттернов (v1.031) — своей парой на каждую колонку.
    patC1L: colPat1L ? colPat1L.value : "#8a94a6",
    patC0L: colPat0L ? colPat0L.value : "#4b5262",
    patC1R: colPat1R ? colPat1R.value : "#8a94a6",
    patC0R: colPat0R ? colPat0R.value : "#4b5262",
    // Цвета «1»/«0» в НАЛОЖЕНИИ (v1.111) и шаг, которым его двигают стрелки (⇥1/⇥½).
    pasteC1: colPaste1 ? colPaste1.value : "#22d3ee",
    pasteC0: colPaste0 ? colPaste0.value : "#22d3ee",
    pasteHalfStep: (typeof pasteHalfStep !== "undefined") ? !!pasteHalfStep : false,
    pasteOp: (typeof pasteOpMode !== "undefined") ? pasteOpMode : "over",   // операция «бит на бит» (v1.115)
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
  // "🔻 Полный проход" — кнопка, а не чекбокс: состояние показывается классом mode-act (applyFullPassBtn).
  if (u.fullPassMode !== undefined) { st.fullPassMode = u.fullPassMode; if (typeof applyFullPassBtn === "function") applyFullPassBtn(); }
  // "⛔ Паттерны выше выделенной" — точно так же кнопка с mode-act (applyNoPatsAboveBtn).
  if (u.noPatsAbove !== undefined) { st.noPatsAbove = u.noPatsAbove; if (typeof applyNoPatsAboveBtn === "function") applyNoPatsAboveBtn(); }
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
  if (u.rowNumMode !== undefined) {
    st.rowNumMode = ROW_NUM_ORDER.indexOf(u.rowNumMode) >= 0 ? u.rowNumMode : "dec";
    applyRowNumMode();
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
  if (u.patNumModeL !== undefined || u.patNumModeR !== undefined ||
      u.patNumL !== undefined || u.patNumR !== undefined) {
    // Режим главнее булевых флагов; старая сохранёнка знает только флаги — из них режим и выведет
    // patNumModeOf() (см. fold-4-tools.js), поэтому тут достаточно положить что пришло.
    if (u.patNumL !== undefined) st.patNumL = !!u.patNumL;
    if (u.patNumR !== undefined) st.patNumR = !!u.patNumR;
    if (u.patNumModeL !== undefined) st.patNumModeL = u.patNumModeL;
    if (u.patNumModeR !== undefined) st.patNumModeR = u.patNumModeR;
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
  if (u.pasteBarsOn !== undefined) { st.pasteBarsOn = !!u.pasteBarsOn; applyPasteBarsMode(); }
  if (u.mirrorFull !== undefined) st.mirrorFull = !!u.mirrorFull;
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
  /* u.patsLocked (средний режим кнопки-замка «🔏 паттерны заморожены», v1.057) больше НЕ читается:
     режим удалён в v1.112 (см. patsEditAllowed в fold-1-core.js). Старые кэши и 💾-сохранёнки этот
     ключ ещё содержат — он просто игнорируется, и полотно оттуда встаёт в обычном 🔓. */
  if (u.selectEnabled !== undefined) { selectEnabled = u.selectEnabled !== false; applySelectEnabled(); }
  /* u.moveLock (замок осей движения, v1.024) больше не читается: замок удалён целиком (v1.105).
     Старые кэши этот ключ ещё содержат — он просто игнорируется, чистить ничего не нужно. */
  /* Восстановление горизонта (u.alignHorizon / u.frozenAlign, v1.026) убрано вместе с самим
     горизонтом (v1.043). Старые кэши эти ключи ещё содержат — они просто игнорируются, ничего
     чистить не нужно: строки из них поднимутся в общее выравнивание, что теперь и правильно. */
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
  /* u.alignTarget из старых кэшей и 💾-сохранёнок НЕ ЧИТАЕТСЯ: приёмник полосы убран (v1.213,
     закреплён за цепочкой ещё с v1.143). Поле в старых записях просто игнорируется. */
  if (typeof u.chainShiftCols === "number") chainShiftCols = u.chainShiftCols;
  if (typeof u.chainShiftRows === "number") chainShiftRows = u.chainShiftRows;
  if (u.pinSlots && typeof u.pinSlots === "object") {
    ["L", "R"].forEach(side => {
      const arr = Array.isArray(u.pinSlots[side]) ? u.pinSlots[side].slice(0, PIN_SLOTS_N) : [];
      while (arr.length < PIN_SLOTS_N) arr.push(null);
      pinSlots[side] = arr;
    });
    if (typeof renderPinSlots === "function") renderPinSlots();
  }
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

  if (u.patC1L && colPat1L) colPat1L.value = u.patC1L;
  if (u.patC0L && colPat0L) colPat0L.value = u.patC0L;
  if (u.patC1R && colPat1R) colPat1R.value = u.patC1R;
  if (u.patC0R && colPat0R) colPat0R.value = u.patC0R;
  if (u.pasteC1 && colPaste1) colPaste1.value = u.pasteC1;
  if (u.pasteC0 && colPaste0) colPaste0.value = u.pasteC0;
  applyPasteBitColors();
  /* Шаг стрелки у наложения (v1.111). Кнопку обновляет pasteRenderBox() — зовём её, только если
     она уже объявлена: applyUiSettings может отработать раньше, чем инициализируется fold-4. */
  if (u.pasteHalfStep !== undefined && typeof pasteHalfStep !== "undefined") {
    pasteHalfStep = !!u.pasteHalfStep;
    if (typeof pasteRenderBox === "function") pasteRenderBox();
  }
  /* Операция «бит на бит» (v1.115) — там же и по той же причине. Значение проверяем по списку:
     в старом кэше ключа нет вовсе, а от мусора в нём наложение вело бы себя необъяснимо. */
  if (u.pasteOp !== undefined && typeof pasteOpMode !== "undefined" &&
      typeof PASTE_OPS !== "undefined" && PASTE_OPS.indexOf(u.pasteOp) >= 0) {
    pasteOpMode = u.pasteOp;
    if (typeof pasteRenderBox === "function") pasteRenderBox();
  }
  applyPatBitColors();
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
  chainShiftCols: 0, chainShiftRows: 0, msgPos: "", menuBarBottom: false,
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
  fullPassMode: false,
  noPatsAbove: false,
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
  rowNumMode: "dec",
  numGlue: "",
  numGlueRows: "",
  binBalance: "",
  patNumModeL: "off", patNumModeR: "dec",
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
/* ═══ КНОПКА СОХРАНЯЕТ И РАСКЛАДКУ ПАНЕЛЕЙ (v1.300) ═══
   Баг-репорт пользователя: «сохр. настроек сама функция не работает… после F5 панели не сохранили
   своих положений».
   Она и не сохраняла — не по ошибке, а потому что раскладка панелей никогда сюда не входила.
   Хранилищ два и они независимы: настройки вида (цвета, шрифт, галки) лежат в CACHE_KEY через
   captureUiSettings/saveCache, а положения панелей — в LAYOUT_KEY, и пишет их saveLayout()
   (fold-3-ops.js) сам, по отпусканию панели. Кнопка звала только первое.
   Раз она названа «Сохр. настройки», человек справедливо ждёт, что закреплена будет вся картина, —
   зовём и второе. Дублирования не боимся: saveLayout() просто перезаписывает ключ текущим
   состоянием DOM, вызывать её лишний раз безвредно.
   Если после этого панели ВСЁ РАВНО не встают на место, дело не в сохранении, а в восстановлении
   (loadLayout там же) — и искать надо там. */
function saveUiSettingsNow(){
  st.savedUiSettings = captureUiSettings();
  /* Снимок РАСКЛАДКИ (v1.452, ответ пользователя «да» на вопрос, возвращать ли её сбросом).
     LAYOUT_KEY снимком не был никогда: его перезаписывает каждое движение панели, так что к моменту
     сброса там лежит уже не то, что сохраняли. Кладём отдельную копию рядом с настройками — её,
     кроме этой кнопки, не трогает никто. */
  if (typeof captureLayout === "function") st.savedLayout = captureLayout();
  saveCache();
  if (typeof saveLayout === "function") saveLayout();
  say("✓ Настройки вида/поиска и раскладка панелей сохранены!");
}
/* ═══ СБРОС ВОЗВРАЩАЕТ СОХРАНЁННОЕ, А НЕ ЗАВОДСКОЕ (испр. v1.451) ═══
   Баг-репорт: «сброс возвращает другое, а не то, что сохраняю».
   И это настоящая дыра, а не недоразумение: снимок, который кладёт «💾 Сохр. настройки»
   (st.savedUiSettings), писался в кэш, читался из кэша при загрузке — и НИКЕМ не применялся.
   Единственный путь, ради которого он заводился, шёл мимо: «↺ Сброс настроек» всегда ставил
   DEFAULT_UI_SETTINGS, то есть заводские значения. Сохранить своё и вернуться к нему было нельзя
   вообще ничем.
   Теперь у кнопки два поведения по одному правилу: есть свой снимок — возвращаем ЕГО, снимка нет
   (ни разу не сохраняли, или кэш чистый) — заводские, как и раньше. Сообщение говорит, что именно
   произошло, чтобы «сброс» не выглядел одинаково в двух разных случаях.
   Раскладку панелей (что где закреплено и открыто) снимок не держит — она живёт своим ключом и
   применяется только при загрузке страницы, см. loadLayout в fold-3-ops.js. */
function resetUiSettingsNow(){
  const snap = st.savedUiSettings;
  const hasSnap = !!(snap && typeof snap === "object" && Object.keys(snap).length);
  applyUiSettings(hasSnap ? snap : DEFAULT_UI_SETTINGS);
  /* ═══ ПАНЕЛИ ВОЗВРАЩАЮТСЯ ВМЕСТЕ С НАСТРОЙКАМИ (v1.452) ═══
     Ответ пользователя «да» на вопрос, держать ли в снимке и раскладку.
     Кладём сохранённый снимок обратно тем же кодом, которым раскладка применяется при загрузке
     (applyLayout в fold-3-ops.js), — второго пути «разложить панели» не заводим.
     Видимость окон applyLayout только записывает в overlayHidden; чтобы она стала видна на экране,
     прогоняем каждое окно через setOverlayHidden — он же обновит кнопки, пересоберёт стопку баров
     и запишет LAYOUT_KEY, так что после сброса сохранённая раскладка становится и текущей. */
  const snapL = st.savedLayout;
  const hasSnapL = !!(snapL && typeof snapL === "object" && typeof applyLayout === "function");
  if (hasSnapL) {
    applyLayout(snapL);
    if (typeof overlayHidden === "object" && typeof setOverlayHidden === "function") {
      for (const oid in overlayHidden) setOverlayHidden(oid, !!overlayHidden[oid]);
    }
  }
  render();
  saveCache();
  say(hasSnap || hasSnapL
    ? ("✓ Возвращено сохранённое (кнопка «💾 Сохр. настройки»): "
       + (hasSnap ? "настройки вида/поиска" : "") + (hasSnap && hasSnapL ? " и " : "")
       + (hasSnapL ? "раскладка панелей" : "") + ".")
    : "✓ Настройки вида/поиска сброшены к умолчаниям — своего сохранённого снимка ещё нет.");
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
      // Снимок раскладки панелей — рядом со снимком настроек и по той же причине: возвращает его
      // только «↺ Сброс настроек» (v1.452).
      savedLayout: st.savedLayout || null,
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
  st.savedLayout = d.savedLayout || null;   // v1.452, см. saveUiSettingsNow/resetUiSettingsNow
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
  t14: "Для «⊙ Ось»: вкл — на оси только «1», «0» перепрыгивается; выкл — сдвиг на любой символ. Для «Ось 1.2»: вкл — зазор только между «1» и «0» (строки без такой пары заморожены); выкл — зазор между любыми соседними символами, заморозки нет. Для ВСЕХ остальных выравниваний: вкл — Круг/Круг Инв крутят строку, пока какая-нибудь её «1» не встанет ПОД «1» ближайшей непустой строки ВЫШЕ (какой это символ по счёту — неважно); если назначены свои столбцы-оси («⊙ Ось сюда»), целимся в них, а если выше нет ни одной строки — в первый бит строки (у «По правому краю»/«Лесенки правой» — последний). Выкл — обычный одиночный поворот",
  t15: "Дойдя до края, Круг не перескакивает через границу дальше по кругу, а разворачивается и идёт обратно до упора, потом снова вперёд. В «ОсьБит»/«ОсьБит ½» край — это предел допустимых положений относительно строки выше; в остальных выравниваниях — край собственного кольца поворотов строки (когда первый символ дошёл до другого конца)",
  t15b: "Круг/Круг Инв крутят строку (реальный поворот битов) в нажатую сторону, пока на первом И на последнем месте не встанут «1». Такого положения нет нигде по кругу — вместо остановки строка своими же битами встаёт на край, а какой край (левый/правый) — чередуется при каждом таком нажатии, а не зависит от кнопки. ВМЕСТЕ с «🔗 Не рвать «1»-группы» первая фаза («1» сразу на обоих краях) отключается — она и есть разрыв группы по шву; работает только чередование краёв, причём противоположный край обязан быть «0»",
  t15c: "Круг/Круг Инв не останавливаются на положении, где одна непрерывная группа «1» разорвана швом строки (первый И последний символ ОДНОВРЕМЕННО «1») — крутят дальше, пока группа не соберётся заново внутри строки. Пример: «11110000» может стать «01111000», но не «10000111» (там четвёрка единиц распалась на «1» слева и «111» справа). Имеет приоритет над «⇔ Крайние «1»»: та при обеих галках только чередует края, но разорвать группу больше не может",
  t16: "Спираль вверх: строки (все, либо выделенный диапазон) читаются одной лентой и сдвигаются по кругу на 1 символ в сторону, заданную переключателем ◄/► справа",
  t17: "Спираль вниз: строки (все, либо выделенный диапазон) читаются одной лентой и сдвигаются по кругу на 1 символ в сторону, противоположную переключателю ◄/► справа",
  t18: "Проекция XOR ПО ОДНОЙ ВЕРХНЕЙ СТРОКЕ ЗА НАЖАТИЕ: первое нажатие складывает выделенную строку с БЛИЖАЙШЕЙ строкой сверху, второе — со следующей выше, и так вверх по цепочке. Результат каждый раз перезаписывает саму выделенную строку. Берутся только те верхние строки, у которых есть БИТ НАД БИТОМ выделенной — то есть реально пересекающиеся с ней по столбцам; стоящие сбоку пропускаются, как и строки чужой подсетки на «½»-выравниваниях (их биты стоят в промежуточных полустолбцах и друг над другом не встают). Складывается по настоящим столбцам: выравнивание, полустолбцы «½», показанные зеркала. Сменили выделение — подъём начинается заново. Откатывается «↩ Отменой»",
  t19: "НЕЙТРАЛЬНОЕ ПОЛОЖЕНИЕ переключателя: клик по линейке столбцов над цепочкой не делает ничего. Выделение столбцов по этим меткам отключено (v1.048) — столбец выбирается кликом ПО САМОМУ БИТУ при включённом «🔢 Выбор столбца». Две соседние кнопки («обрезка» и «⊙ Ось сюда») — единственное, ради чего клик по линейке ещё нужен: у них другого способа указать столбец нет",
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
  // t99 — подсказка удалённой галки «🔽 Все ниже» (v1.090).
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

/* ═══ СВОЯ ПОДСКАЗКА ВМЕСТО НАТИВНОЙ, ПРИЖАТАЯ К ПРАВОМУ КРАЮ ОКНА (v1.385) ═══
   Запрос пользователя (со скриншотом обрезанной подсказки у границы П2): «пусть прижата к право
   браузера».
   Нативную подсказку браузер ставит у курсора и обрезает по краю окна сам — ни местом, ни шириной
   её из страницы не управляют. А подсказки здесь длинные, абзацами: у правого края холста половина
   текста уходила за экран.
   Поэтому показываем свою: одна коробка на всё приложение, position:fixed, прижата к правому краю
   окна. Ширина ограничена, текст переносится, по вертикали коробка идёт за курсором и зажимается,
   чтобы не вылезти сверху или снизу.
   ТЕКСТ БЕРЁМ ИЗ ТОГО ЖЕ title. Ни одну подсказку переписывать не нужно — их сотни, и все они уже
   лежат в разметке и в TIPS. На время показа атрибут СНИМАЕМ (иначе браузер нарисует поверх ещё и
   свою) и возвращаем, когда курсор ушёл: другой код читает title как обычное свойство, и терять
   его насовсем нельзя.
   textContent, а не innerHTML: в подсказках попадаются кавычки и угловые скобки, разбирать их как
   разметку незачем.
   capture у mousedown — чтобы коробка исчезала сразу по нажатию, до того как обработчик кнопки
   начнёт что-то делать: висящая подсказка поверх начатой протяжки только мешает. */
{
  const tipBox = document.createElement("div");
  tipBox.id = "tipBox";
  const attachTipBox = () => { if (document.body && !tipBox.parentNode) document.body.appendChild(tipBox); };
  attachTipBox();
  if (!tipBox.parentNode) document.addEventListener("DOMContentLoaded", attachTipBox);
  let tipEl = null, tipText = "";
  const hideTip = () => {
    if (tipEl && tipText) { try { tipEl.setAttribute("title", tipText); } catch (e) {} }
    tipEl = null; tipText = "";
    tipBox.classList.remove("on");
  };
  /* ═══ ПОДСКАЗКА У КУРСОРА, А К КРАЮ — ТОЛЬКО ЕСЛИ ИНАЧЕ ОБРЕЖЕТСЯ (испр. v1.385 → v1.388) ═══
     Баг-репорт: «теперь они все прижаты к правой границе браузера».
     И правда: в v1.385 я прибил коробку к правому краю окна насовсем, а просьба была уже: не дать
     ОБРЕЗАТЬСЯ той подсказке, что вылезает за кромку. Прижатыми оказались все — в том числе от
     кнопок в левой панели, за полэкрана от того, на что смотришь.
     Ставим как нативная — у курсора, — и только зажимаем в окно: правый край коробки не заходит за
     кромку, левый не уходит за нуль. Пока подсказка помещается, она стоит там, где ей и место;
     упор срабатывает ровно в том случае, с которого всё началось.
     Обе оси считаются одинаково: сперва желаемое место у курсора, потом зажим в окно. */
  /* ═══ ПОДСКАЗКА НЕ НАКРЫВАЕТ САМУ КНОПКУ (испр. v1.459) ═══
     Баг-репорт со скриншотом: «иногда подсказка закрывает саму кнопку». Так и было: место
     считалось ТОЛЬКО от курсора (clientY + 18), а потом зажималось в окно. Подсказки тут длинные,
     абзацами: у нижней половины экрана коробка в 300–400 пикселей высотой в остаток снизу не
     влезала, зажим тянул её вверх — и она ложилась ровно на ту кнопку, с которой её и вызвали.
     Читать текст можно, а вот куда целиться мышью — уже нет.
     Теперь место считается ОТ ЭЛЕМЕНТА, а не от курсора: сначала под ним, не влезло — над ним,
     не влезло ни там ни там (элемент выше окна или окно совсем низкое) — сбоку, с той стороны,
     где места больше. При любом из трёх исходов коробка стоит ВНЕ прямоугольника элемента, то
     есть накрыть его не может по построению. Курсор при этом не забыт: по свободной оси коробка
     по-прежнему идёт за ним (сверху/снизу — по горизонтали, сбоку — по вертикали), поэтому длинный
     ряд кнопок не заставляет глаза бегать через полэкрана.
     Зажим в окно остался прежним и стоит ПОСЛЕДНИМ: он лишь не даёт вылезти за кромку.
     Единственный случай, когда перекрытие всё же возможно, — элемент, вокруг которого свободного
     места нет ни с одной стороны; тогда деваться коробке некуда, и это уже не про кнопки. */
  const posTip = (clientX, clientY) => {
    const h = tipBox.offsetHeight || 0;
    const w = tipBox.offsetWidth || 0;
    const vw = window.innerWidth, vh = window.innerHeight;
    const M = 8;                       // зазор между коробкой и элементом
    const clampL = (x) => Math.min(Math.max(4, x), Math.max(4, vw - w - 8));
    const clampT = (y) => Math.min(Math.max(4, y), Math.max(4, vh - h - 6));
    const r = (tipEl && tipEl.getBoundingClientRect) ? tipEl.getBoundingClientRect() : null;
    if (!r) {                          // элемента нет (вызвали не от наведения) — как было, у курсора
      tipBox.style.top = clampT(clientY + 18) + "px";
      tipBox.style.left = clampL(clientX + 16) + "px";
      return;
    }
    if (h <= vh - r.bottom - M) {      // помещается ПОД элементом
      tipBox.style.top = (r.bottom + M) + "px";
      tipBox.style.left = clampL(clientX + 16) + "px";
    } else if (h <= r.top - M) {       // помещается НАД элементом
      tipBox.style.top = (r.top - h - M) + "px";
      tipBox.style.left = clampL(clientX + 16) + "px";
    } else {                           // ни под, ни над — уводим ВБОК, где просторнее
      const spaceR = vw - r.right - M, spaceL = r.left - M;
      const left = (spaceR >= spaceL) ? r.right + M : r.left - w - M;
      tipBox.style.left = clampL(left) + "px";
      tipBox.style.top = clampT(clientY - h / 2) + "px";
    }
  };
  document.addEventListener("mouseover", (e) => {
    const t = (e.target && e.target.closest) ? e.target.closest("[title]") : null;
    if (!t) { if (tipEl) hideTip(); return; }
    if (t === tipEl) return;
    hideTip();
    const txt = t.getAttribute("title");
    if (!txt) return;
    tipEl = t; tipText = txt;
    t.removeAttribute("title");
    tipBox.textContent = txt;
    tipBox.classList.add("on");
    posTip(e.clientX, e.clientY);
  });
  document.addEventListener("mousemove", (e) => { if (tipEl) posTip(e.clientX, e.clientY); }, { passive: true });
  document.addEventListener("mouseout", (e) => {
    if (!tipEl) return;
    const to = e.relatedTarget;
    if (to && tipEl.contains && tipEl.contains(to)) return;
    hideTip();
  });
  document.addEventListener("mousedown", hideTip, true);
  window.addEventListener("blur", hideTip);
}

/* ═══ ВЫСОКИЙ ВЕРТИКАЛЬНЫЙ ПОЛЗУНОК СЛЕВА (v1.154) ═══
   Запрос пользователя: «нужен вертикальный по всему браузеру, когда строк много, чтобы передвигать
   быстро». Родная полоса полотна короткая — она по высоте самого полотна, — и при тысячах строк её
   бегунок вырождается в точку, которой не прицелиться. Этот идёт во всю высоту ОКНА, поэтому ход у
   него длиннее и попадать проще.
   Полотно при этом не переопределяется ничем: ползунок только читает и пишет его scrollTop. Родная
   полоса остаётся на месте и работает как работала — это не замена, а второй способ.
   Прячется, когда прокручивать нечего (содержимое влезает целиком): полоса, которой некуда ехать,
   только занимает место и путает.
   Пересчёт по scroll полотна, по resize окна и по кадру после каждого render() — последнее важно:
   render() меняет число строк, а значит и высоту содержимого, и без этого бегунок остался бы с
   размером от прошлой картинки. */
{
  /* ОДНА ЛОГИКА НА ОБЕ ПОЛОСЫ (v1.188). Полос теперь две — у левого и правого краёв окна, — и
     каждая должна и показывать положение, и вести полотно. Заводим их списком и вешаем один и тот
     же набор обработчиков: расходиться в поведении им незачем, а дублировать код тем более. */
  const bars = [
    { bar: document.getElementById("vScroll"),  thumb: document.getElementById("vScrollThumb") },
    { bar: document.getElementById("vScrollR"), thumb: document.getElementById("vScrollThumbR") }
  ].filter(b => b.bar && b.thumb);
  const bar = bars.length ? bars[0].bar : null;
  const thumb = bars.length ? bars[0].thumb : null;
  const sc = document.getElementById("screenCanvas");
  if (bar && thumb && sc) {
    let drag = null;
    const sync = () => {
      const view = sc.clientHeight;
      const full = sc.scrollHeight;
      if (!(full > view + 1)) { for (const b of bars) b.bar.classList.remove("on"); return; }
      const maxScroll = full - view;
      for (const b of bars) {
        b.bar.classList.add("on");
        const track = b.bar.clientHeight;
        const h = Math.max(18, Math.round(track * view / full));
        const maxTop = track - h;
        const top = maxScroll > 0 ? Math.round(maxTop * (sc.scrollTop / maxScroll)) : 0;
        b.thumb.style.height = h + "px";
        b.thumb.style.top = Math.max(0, Math.min(maxTop, top)) + "px";
      }
    };
    /* Обратный пересчёт: из положения бегунка — в scrollTop полотна. Считаем от ЦЕНТРА бегунка,
       поэтому щелчок по дорожке уводит туда, куда человек показал, а не на полбегунка мимо. */
    const scrollToThumbTop = (topPx) => {
      const view = sc.clientHeight, full = sc.scrollHeight, track = bar.clientHeight;
      const h = Math.max(18, Math.round(track * view / full));
      const maxTop = Math.max(1, track - h);
      const t = Math.max(0, Math.min(maxTop, topPx));
      sc.scrollTop = (full - view) * (t / maxTop);
    };
    /* Обработчики вешаем на КАЖДУЮ полосу (v1.188): тянуть можно и левую, и правую, а положение
       бегунка после этого пересчитывается у обеих — они показывают одно и то же полотно. */
    for (const b of bars) {
      b.thumb.addEventListener("mousedown", e => {
        if (e.button !== 0) return;
        e.preventDefault(); e.stopPropagation();
        drag = { y0: e.clientY, top0: parseFloat(b.thumb.style.top) || 0, bar: b.bar, thumb: b.thumb };
        document.body.classList.add("vscroll-drag");
      });
      b.bar.addEventListener("mousedown", e => {
        if (e.button !== 0 || e.target === b.thumb) return;
        e.preventDefault();
        // Щелчок по дорожке — бегунок серединой под курсор.
        const rect = b.bar.getBoundingClientRect();
        const h = parseFloat(b.thumb.style.height) || 18;
        scrollToThumbTop(e.clientY - rect.top - h / 2);
        sync();
      });
    }
    window.addEventListener("mousemove", e => {
      if (!drag) return;
      if (!(e.buttons & 1)) { drag = null; document.body.classList.remove("vscroll-drag"); return; }
      scrollToThumbTop(drag.top0 + (e.clientY - drag.y0));
      sync();
    });
    window.addEventListener("mouseup", () => {
      if (!drag) return;
      drag = null;
      document.body.classList.remove("vscroll-drag");
    });
    sc.addEventListener("scroll", sync);
    window.addEventListener("resize", sync);
    /* render() перерисовывает строки и меняет высоту содержимого. Своего события у неё нет, а
       трогать её саму ради одной синхронизации не хочется — поэтому просто следим за размерами
       содержимого наблюдателем. Он же покрывает и загрузку вкладки, и ползунок числа строк. */
    if (typeof ResizeObserver === "function") {
      try { new ResizeObserver(sync).observe(sc); } catch (e) {}
      const rowsEl = document.getElementById("rows");
      if (rowsEl) { try { new ResizeObserver(sync).observe(rowsEl); } catch (e) {} }
    }
    sync();
  }
}

/* ═══ ПОЗИЦИЯ ПАРЫ ПИКЕРОВ У НАЛОЖЕНИЯ (v1.173) ═══
   Запрос пользователя: «это к оси битов наложения, а не у цепочек надо».
   Пара стоит НАД осью самого верхнего блока — там же, где его панель, — поэтому читается как его
   настройка, а не как настройка цепочки. Ось блока (.paste-axis) render рисует каждым кадром, у неё
   и спрашиваем координаты: считать их заново значило бы повторять всю арифметику выравниваний.
   Сам элемент при этом СТАТИЧЕСКИЙ и живёт вне #rows — если бы он перерисовывался вместе со
   строками, открытый системный диалог выбора цвета вырывало бы из-под курсора.
   Блоков нет — прячем: пустая плашка посреди холста только мешала бы. */
/* НЕ ВЫЗЫВАЕТСЯ С v1.179: плашка «Нал» убрана с глаз, ставить её больше некуда. Функцию оставляю —
   если пара пикеров когда-нибудь снова понадобится на холсте, вернуть её это одна строка в render().
   Внутри стоит ранний выход, чтобы случайный вызов ничего не двигал. */
function positionPasteColBar(){
  return;
  const bar = document.getElementById("pasteColBar");
  if (!bar) return;
  const ax = document.querySelector("#rows .paste-axis");
  if (!ax) { bar.classList.remove("on"); return; }
  const r = ax.getBoundingClientRect();
  const canvas = document.getElementById("screenCanvas");
  const cr = canvas ? canvas.getBoundingClientRect() : null;
  // За край полотна не выпускаем: у верхних блоков ось может уйти выше видимой части.
  const top = Math.max(cr ? cr.top + 2 : 2, r.top - 40);
  bar.style.left = Math.round(r.left) + "px";
  bar.style.top = Math.round(top) + "px";
  bar.classList.add("on");
}
