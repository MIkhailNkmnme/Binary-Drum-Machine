/* Zerkalius Fold — часть 2/5: ОТРИСОВКА.
   Шаблоны и сброс, балансы, вкладки, шапка колонок, панели логов, суммы длин,
   кэш масок подсветки, виртуализация строк, render(), лог шагов, экспорт/импорт вкладок.
   Подключается ПОСЛЕ fold-1-core.js. Порядок файлов менять нельзя. */

function pullFoundUp(idx){
  const p = st.pats[idx];
  if (!p) return;
  let target = -1;
  for (let i = 0; i < idx; i++){
    const q = st.pats[i];
    if (!q || !q.text) continue;
    if (!q.found){ if (target < 0) target = i; continue; }
    if (st.keepOrder && q.ord > p.ord){ target = i; break; }
  }
  if (target < 0 || target >= idx) return;
  st.pats.splice(idx, 1);
  st.pats.splice(target, 0, p);
}

/* pullFoundUp() двигает элементы st.pats по позиции в массиве (для визуального "подтягивания"
   наверх), поэтому st.pats[i] после этого больше НЕ обязательно принадлежит строке i.
   Настоящую привязку "паттерн ↔ исходная строка" хранит p.ord — им и нужно искать. */
function findPatByOrd(ord){
  if (!st.pats) return null;
  for (const p of st.pats) if (p && p.ord === ord) return p;
  return null;
}
/* === МАРКЕР 08: LOAD_RESET === */
function parseLines(s){ return s.split(/\r?\n/).map(x => x.trim()); }

/* Ползунок rowCount ограничивает resetAll() числом активных строк — при любой загрузке нового
   набора tplRows (текстом, файлом, вставкой) его нужно подтянуть под новую длину, иначе
   resetAll() обрежет вставленное по СТАРОМУ значению ползунка (например, до 1 строки). */
function syncRowCountToTpl(){
  const rowCountEl = document.getElementById("rowCount");
  if (!rowCountEl) return;
  const total = Math.max(2, st.tplRows.length);
  rowCountEl.max = total;
  if (+rowCountEl.value !== total) {
    rowCountEl.value = total;
  }
  document.getElementById("rowCountVal").textContent = rowCountEl.value;
  if (typeof rowCountStashClear === "function") rowCountStashClear();
}

function loadTemplate(){
  // Сброс savedChain — если у вкладки уже есть сохранёнка (в т.ч. авто-созданная при 🧹 Очистить,
  // см. clearActiveTab()), resetAll() ниже ВОССТАНОВИТ ИМЕННО ЕЁ, полностью проигнорировав только
  // что заданные tplRows/tplPats (см. её код: ветка "if (savedChain)" не смотрит на tplRows
  // вообще) — новый явно загруженный шаблон должен побеждать старый "снимок для отката", а не
  // молча перекрываться им (см. запрос пользователя — "нет ничего, или серпинский"). Тот же
  // сброс нужен и в drag&drop/paste-загрузке файла ниже — тут не дублируем, там свой.
  if (st.tabs && st.tabs[st.activeTab]) st.tabs[st.activeTab].savedChain = null;
  st.tplRows = parseLines(document.getElementById("taRows").value);
  st.tplPats = parseLines(document.getElementById("taPats").value);
  syncRowCountToTpl();
  resetAll();
  say("Шаблон загружен: активных строк " + st.rows.filter(Boolean).length +
      " (из " + st.tplRows.filter(Boolean).length + ").");
}

/* Единственная кнопка #bAuto переключает подпись/цвет вместо пары "Авто"/"Стоп" (см. HTML) —
   used всеми источниками "Авто"-прогона (autoRun/resetAll/finishAuto), т.к. флаг st.running
   у них общий. */
function setAutoBtnState(running){
  const b = document.getElementById("bAuto");
  if (!b) return;
  b.classList.toggle("stop", running);
  b.textContent = running ? "⏹ Стоп" : "🚀 Авто";
  b.title = running ? "Остановить" : "Автоматический прогон по выбранному режиму (Enter) / повторный клик — остановить";
}

/* Счётчик "Вар: N/M (строки ...)" в шапке — текущий вариант / общее число вариантов кругового
   сдвига (см. totalTurns в autoRun()) и номера строк, которые реально крутятся — виден только
   пока актуален (◄/►Круг/Круг Инв, известен НОК). st.shiftVariantTotal: null — не круговой
   сдвиг (скрыть), 0 — предел неизвестен/НОК слишком большой (см. lcmSafe), число — сам предел. */
function updateVariantCounter(){
  const wrap = document.getElementById("variantCounterWrap");
  if (!wrap) return;
  if (!st.shiftVariantTotal) { wrap.style.display = "none"; return; }
  wrap.style.display = "";
  const noEl = document.getElementById("variantNo");
  const totalEl = document.getElementById("variantTotal");
  const rowsEl = document.getElementById("variantRows");
  if (noEl) noEl.textContent = st.shiftVariantTurns || 0;
  if (totalEl) totalEl.textContent = st.shiftVariantTotal;
  if (rowsEl) rowsEl.textContent = (st.shiftVariantRows && st.shiftVariantRows.length) ? st.shiftVariantRows.join(",") : "";
}

/* Escape зовёт тот же Сброс, что и кнопка, но выделять первую строку при пустом выделении он не
   должен (запрос пользователя). Флаг живёт ровно один вызов resetAll(). */
var resetNoAutoSelect = false;
/* Накопленные находки "🔽 Все ниже" — номера строк, чьи паттерны уже совпадали с результатом.
   Живут до Сброса/Escape и только красят паттерн, в данные не входят. var — набор читает render(),
   который может вызваться раньше этой строки. */
var bgBelowHits = new Set();
function resetAll(){
  /* СБРОС ТЕПЕРЬ ОТМЕНЯЕМ (v0.860, запрос пользователя: "Escape что делает — Повтор кнопка пусть
     повторит обратное"). Раньше resetAll() не клал состояние в стек отмены вообще: Escape (и та же
     кнопка "↺ Сброс", и загрузка файла поверх работы) стирал набранное безвозвратно. Теперь перед
     сбросом идёт обычный snapshot() — значит "↩ Отмена" возвращает то, что было ДО сброса, а
     "↪ Повтор" после неё повторяет сам сброс, как с любым другим действием. */
  snapshot();
  st.running = false;
  setAutoBtnState(false);
  // Выделение Сброс/Escape не трогает ВООБЩЕ (запрос пользователя). Мало не сбрасывать сам набор
  // строк — по дороге его молча СДВИГАЛ ensureZeroRow(): вставляя пустую нулевую строку, он
  // пересчитывал индексы (r+1), и выделение уезжало на строку ниже. Запоминаем набор как есть и
  // возвращаем его в конце — номера строк остаются теми же, что были до Сброса.
  const keepSel = st.selectedRows ? new Set(st.selectedRows) : null;
  // Сброс снимает и защёлку находок "Авто" (см. allPatLatch).
  allPatLatch.clear();
  // Оранжевая подсветка "перевёрнутых" битов (см. .bit-inv/invFlagsMap, "◄/►Круг Инв") и счётчик
  // "Вар: N/M" — тоже часть текущей сессии кругового сдвига, Сброс должен убирать и их, а не
  // только сами строки (запрос пользователя — краска битов оставалась после Сброса/Escape).
  invFlagsMap.clear();
  insertedFlagsMap.clear();
  axisOffsetMap.clear();
  axisBitShiftMap.clear();
  // Направление обхода и запасной счётчик поворотов для "↩ От края назад" — тоже часть текущей
  // сессии сдвига: после Сброса строка стоит в исходном положении, и идти она должна снова
  // ВПЕРЁД, а не доигрывать разворот, случившийся до сброса.
  axisBitDirMap.clear();
  rowRotOffMap.clear();
  edgeOnesSideMap.clear();
  st.shiftVariantTotal = null;
  st.shiftVariantRows = null;
  st.manualShiftTurns = 0;
  // Сброс — выделение снова считается набранным вручную, а не выросшим захватом (см.
  // captureFoundRow/st.captureGrown).
  st.captureGrown = false;
  // "🧩 Паттерн-цепочка" начинается заново — вместе со списком уже задействованных ею строк.
  st.patChainStep = 0; st.patChainFilledTo = -1; st.patChainPendingMove = -1;
  if (typeof xorProjStep !== "undefined") xorProjStep = { target: -1, upto: -1 };
  st.patChainCycleBase = 0;
  patChainSeenRows.clear();
  // У "⇔ Зеркало шагами" состояния между нажатиями больше нет: одно нажатие кладёт все биты
  // зеркала строки разом, сбрасывать нечего (см. mirrorStepUp).
  // У обычного Тетриса состояния поворотов больше нет — он не крутит, только кладёт (см.
  // tetrisDrop()/tetrisLayPlan()), сбрасывать у него нечего, кроме "ждём перехода вниз".
  tetrisPendingAdvance = -1;
  tetris2RotKey = null;
  tetris2FloorAttempt = 0;
  tetris2FloorOriginal = null;
  tetris2FloorOriginalFlags = null;
  tetris2BelowAttempt = 0;
  tetris2BelowOriginal = null;
  tetris2BelowOriginalFlags = null;
  tetris2PendingAdvance = -1;
  tetrisAxisRotKey = null;
  tetrisAxisAttempt = 0;
  tetrisAxisOriginal = null;
  tetrisAxisOriginalFlags = null;
  tetrisAxisPendingAdvance = -1;

  // Ползунок rowCount должен резать ОБЕ ветки одинаково — раньше limit считался ТОЛЬКО в ветке
  // "нет сохранёнки", и для вкладок с 💾-сохранением (обычное дело) двигать ползунок вообще ничего
  // не давало (resetAll() восстанавливал savedChain целиком, лимит просто не применялся).
  const rowCountEl = document.getElementById("rowCount");
  const limit = rowCountEl ? +rowCountEl.value : st.tplRows.length;
  // Строки собираются заново из шаблона/сохранёнки — спрятанный ползунком хвост к ним уже не
  // относится (см. rowCountStash).
  if (typeof rowCountStashClear === "function") rowCountStashClear();
  // ПОСТРОЕНИЯ СВЕРХУ СБРОС НЕ УДАЛЯЕТ (запрос пользователя: "Escape пусть не удаляет верхние
  // построения, только сбрасывает биты в нижних и соответственно в верхних"). Запоминаем их до
  // восстановления данных и возвращаем на место после — а содержимое зеркал обновится под новые
  // (шаблонные) строки, см. refreshTopMirrors ниже.
  const keepTop = st.topBuilt || 0;
  const topRows = keepTop ? st.rows.slice(0, keepTop) : null;
  const topPats = keepTop ? st.pats.slice(0, keepTop) : null;

  // Если у ЭТОЙ вкладки есть своя сохранёнка — восстановить данные из неё (настройки вида/
  // поиска сюда больше не входят, они отдельно — см. DEFAULT_UI_SETTINGS/bResetUiSettings)
  const savedChain = st.tabs && st.tabs[st.activeTab] ? st.tabs[st.activeTab].savedChain : null;
  if (savedChain) {
    st.rows = savedChain.rows.slice(0, limit);
    st.pats = savedChain.pats.slice(0, limit).map(p => p ? { ...p } : null);
    st.used = savedChain.used.slice(0, limit);
    // Ползунок подняли ВЫШЕ, чем было строк в самой сохранёнке (rowCount увеличили ПОСЛЕ
    // 💾-сохранения) — savedChain.rows короче limit, "нарастить" их слайсом неоткуда. Донабираем
    // недостающий хвост из savedChain.tplRows/tplPats — это ПОЛНЫЙ шаблон, сохранённый рядом
    // (см. tabSaveChainData()/clearActiveTab()), а не то, что реально было в работе — иначе
    // ползунок молча ничего не восстанавливал (см. запрос пользователя).
    if (st.rows.length < limit) {
      const extraRows = (savedChain.tplRows || []).slice(st.rows.length, limit);
      const extraPats = (savedChain.tplPats || []).slice(st.rows.length, limit);
      const baseOrd = st.rows.length;
      st.rows = st.rows.concat(extraRows);
      st.used = st.used.concat(extraRows.map(() => false));
      st.pats = st.pats.concat(extraPats.map((t, i) => ({ text: t, ord: baseOrd + i, found: false, kind: null, step: null })));
    }
  } else {
    st.rows = st.tplRows.slice(0, limit);
    st.used = st.rows.map(() => false);
    st.pats = st.tplPats.slice(0, limit).map((t, i) => ({ text: t, ord: i, found: false, kind: null, step: null }));
  }

  // Верх возвращаем на место (см. keepTop выше) и обновляем зеркала под свежие строки.
  if (keepTop && topRows) {
    st.rows.splice(0, 0, ...topRows);
    st.used.splice(0, 0, ...topRows.map(() => false));
    st.pats.splice(0, 0, ...topPats);
    st.topBuilt = keepTop;
    // САМИ строки построений Сброс не удаляет, а вот всё, что в них дописали ПОСЛЕ постройки
    // (Тетрис, "⇔ Зеркало шагами", вписанные зеркала, сдвиги), — сбрасывается вместе с битами
    // настоящих строк: возвращаем построенным строкам их вид на момент постройки (запрос
    // пользователя: "все построения в реальных строках должны сбрасываться Ресетом, Ескейпом,
    // если их не сохранить специально"). См. topBaseCapture/topBaseRestore.
    topBaseRestore();
  } else {
    st.topBuilt = 0;
  }
  // Данные только что загружены — следим, что строка с номером 0 пустая (см. ensureZeroRow).
  ensureZeroRow();
  // Зеркала сверху пересчитываем под восстановленные строки: биты внизу сброшены, значит и вверху
  // должны быть их отражения, а не прежние (в режиме "дописывать" верх намеренно не трогается).
  refreshTopMirrors();
  // Пометка «новые биты» — часть 💾-сохранёнки (запрос пользователя: цвет новых бит держится и
  // после сохранения). Есть сохранёнка — возвращаем её пометку; нет — снимаем вместе с битами,
  // которые Сброс и так пересобрал из шаблона.
  if (savedChain && savedChain.newBits) newBitsLoad(savedChain.newBits);
  else newBitsClearAll();
  bgBelowHits.clear();    // Сброс/Escape — накопленная подсветка "🔽 Все ниже" гаснет
  mirrorsRowDone.clear(); // Сброс — автоматические зеркала можно вписывать заново
  st.step = 0; st.passCount = 0; st.tailBuffer = "";
  // Выделение строк (st.selectedRows) НЕ сбрасываем — Сброс возвращает данные к шаблону, но
  // пользователь может специально держать выделение (например, чтобы сразу опробовать Тетрис/
  // сдвиги на тех же строках после отката).
  st.hit = null; st.undo = []; st.redo = [];
  st.horizBitIdx = 0; st.horizXoredLength = 0; st.lastHorizRow = null; st.lastHorizDir = null; st.horizFoundInPass = false; st.horizChainLen = 0;
  st.horizBigChain = ""; st.horizBigOrig = ""; st.horizBigRow = ""; st.horizChainRow = -1; st.horizBigTargetIdx = -1; st.horizRotations = 0; st.horizNeedRebuild = false;
  st.horizCurrentDir = "right";
  st.lastOp = null;
  const f = firstDataIdx(), s2 = nextDataIdx(f + 1);
  st.aIdx = f < 0 ? 0 : f; st.bIdx = s2 < 0 ? 1 : s2; st.goingUp = false;
  // Если выделения нет вообще (не только что сброшенное — просто ПУСТОЕ, напр. самый первый
  // запуск/загрузка нового шаблона) — выделяем первую строку с данными сами. Многие функции
  // (Круг/Спираль без выделения крутят ВСЕ строки — молча, без явной ошибки; "⧬ Интерлив
  // сквозной"/"⨁ XOR сквозной" вообще отказываются стартовать без выделения) ведут себя
  // неочевидно на пустом выделении — пусть оно по умолчанию никогда не бывает пустым (см. запрос
  // пользователя — "пусть всегда одна выделена").
  // Возвращаем выделение ровно тем, каким оно было до Сброса (см. keepSel выше). Отсеиваем только
  // номера, которых после Сброса физически нет (ползунок rowCount мог обрезать цепочку короче).
  if (keepSel) st.selectedRows = new Set(Array.from(keepSel).filter(r => r < st.rows.length));
  if (!resetNoAutoSelect && (!st.selectedRows || st.selectedRows.size === 0) && f >= 0) {
    st.selectedRows = new Set([f]);
  }
  resetNoAutoSelect = false;
  // РЕЖИМЫ ВЫДЕЛЕНИЯ ЯЧЕЕК/СТОЛБЦОВ Сброс и Escape ВЫКЛЮЧАЮТ (запрос пользователя: "пусть по
  // умолчанию, и при Escape отключать выделение ячеек или столбцов, если включены"). Раньше оба
  // переживали Сброс: плавающая панель "⊙ Ось сюда / ✕ Снять столбец" продолжала висеть над
  // полотном, а клики по битам — выбирать столбцы вместо обычного выделения строк.
  // Гасим ТОЛЬКО режимы и жёлтый выбранный столбец. Сам набор ячеек (cellSel) и группы осей не
  // трогаем: они не про режим, живут своей жизнью (на них завязаны "⊙ Оси по битам"), и у них
  // свои кнопки — "✕ Очистить биты" и "✕ Снять выбор".
  // Выключаем молча, как это делает clearAxisGroupOnce(), а не через setColPickMode(false):
  // у того свой say() и render(), которые перебили бы сообщение самого Сброса.
  if (typeof colPickMode !== "undefined" && colPickMode) {
    colPickMode = false;
    document.body.classList.remove("col-pick");
    const bColMode = document.getElementById("bColPickMode");
    if (bColMode) bColMode.classList.remove("mode-act");
  }
  if (typeof cellSelMode !== "undefined" && cellSelMode) {
    cellSelMode = false;
    if (typeof cellSelUpdateBtns === "function") cellSelUpdateBtns();
  }
  st.selectedCol = -1;
  updateVariantCounter();
  render();
}
/* === МАРКЕР 09: RENDER === */
const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const KIND_CLS = ["", "inv", "rev", "invrev"];
const KIND_LABELS_RU = ["прямая", "инверсия", "реверс", "инверсия+реверс"];
const KIND_LABELS_SHORT = ["пр", "инв", "рев", "инв+рев"];
const ALIGN_LABELS = { left: "По левому краю", center: "По центру", right: "По правому краю", halfcenter: "Центр ½", stairs: "Лесенка", halfstairs: "Лесенка ½", rstairs: "Лесенка правая", rhalfstairs: "Лесенка правая ½", axisbit: "ОсьБит", axisbit12: "ОсьБит ½" };

/* Компактная запись номеров строк для шапки "Черновика шага": подряд идущие номера — диапазоном
   ("2-3"), остальные через запятую ("2-3, 7"). op.rows бывает и готовой строкой (напр. "1–5" из
   logStep для диапазонных операций) — тогда просто нормализуем тире и возвращаем как есть. */
function formatOpRows(rows){
  if (!rows) return "";
  if (typeof rows === "string") return rows.replace(/–/g, "-");
  if (!Array.isArray(rows) || !rows.length) return "";
  const sorted = [...new Set(rows)].sort((a, b) => a - b);
  const parts = [];
  let start = sorted[0], prev = sorted[0];
  for (let i = 1; i <= sorted.length; i++) {
    const cur = sorted[i];
    if (cur === prev + 1) { prev = cur; continue; }
    parts.push(start === prev ? String(start) : (start + "-" + prev));
    if (i < sorted.length) { start = cur; prev = cur; }
  }
  return parts.join(", ");
}

/* Особая подсветка "01" (см. #bHighlight01 в "Виде"): для каждого пробега нулей, за которым
   сразу идёт "1" — красит ВЕСЬ пробег целиком плюс саму эту "1". "1", перед которой нет ни
   одного "0" (пробег нулей нулевой длины), не красится. Один проход по строке, без вложенных
   циклов на каждый символ. Примеры: "0001" -> все 4 символа; "00110001" -> "001" и "0001"
   (символ "1" на позиции 3, после другой "1", не красится). */
function compute01HighlightMask(s){
  const n = s.length;
  const mask = new Array(n).fill(false);
  let k = 0;
  while (k < n) {
    if (s[k] === '0') {
      let j = k;
      while (j < n && s[j] === '0') j++;
      if (j < n && s[j] === '1') {
        for (let m = k; m <= j; m++) mask[m] = true;
      }
      k = j;
    } else {
      k++;
    }
  }
  return mask;
}

/* Общие данные для двух отдельных фич ("⚖ Показать балансы" и "Пробеги вместо битов", см.
   #bShowBalances/#bRunsAsBits в "Виде"): раскладывает строку на пробеги подряд идущих "1"/"0"
   со знаком — пробег единиц "+N", пробег нулей "-N", по порядку слева направо (напр. "111001"
   -> пробеги +3,-2,+1), плюс итоговые суммы всех единиц/нулей строки целиком (НЕ зависящие от
   порядка пробегов). */
function computeRowBalance(s){
  const runs = [];
  let total1 = 0, total0 = 0;
  if (!s) return { runs, total1, total0 };
  let k = 0;
  while (k < s.length) {
    const ch = s[k];
    let j = k;
    while (j < s.length && s[j] === ch) j++;
    const runLen = j - k;
    if (ch === '1') { runs.push({ sign: '+', n: runLen, isOne: true }); total1 += runLen; }
    else if (ch === '0') { runs.push({ sign: '-', n: runLen, isOne: false }); total0 += runLen; }
    k = j;
  }
  return { runs, total1, total0 };
}

/* "⚖ Показать балансы" — только итоговые суммы, БЕЗ пробегов и скобок: "N-M", "1" — белым,
   "0" — серым. w1/w0 — ширина (в цифрах) под каждое число, ОДНА для ВСЕХ строк (макс. среди них,
   см. вызов в render()) — без паддинга ширина метки "гуляла" от строки к строке (короткие числа
   короче длинных), и из-за этого сама цепочка правее нее уезжала влево-вправо по X у разных
   строк вместо ровной колонки (см. запрос пользователя — "выравнивание съехало"). Если единиц
   и нулей ровно поровну — вместо двух цветов один акцентный цвет с подсветкой (.row-balance-eq
   в CSS), чтобы такая "сбалансированная" строка сразу бросалась в глаза. */
/* ДВОИЧНЫЕ БАЛАНСЫ (v0.863, запрос пользователя "балансы в двоичном показать, 4 варианта одной
   кнопки: 0-лей, 1-ц, вместе справа 0 слева 1 и наоборот"). Кнопка "⚖ Баланс: 10-й" во вкладке
   "Вид" (см. #bBinBalance/binBalanceToggle) ходит по кругу:
     ""    — как было, десятичный "1-0";
     "1"   — только единицы, в двоичном;
     "0"   — только нули, в двоичном;
     "10"  — оба, слева единицы, справа нули;
     "01"  — оба, слева нули, справа единицы.
   Само число — обычный toString(2). Выравнивание пробелами (w1/w0) в двоичных режимах не
   используется: ширины там свои, а колонка балансов и так flex:0 0 auto. */
function balanceNumText(n){ return (st.binBalance ? Number(n).toString(2) : String(n)); }
/* СЛИТНО И РАЗНЫМ ЦВЕТОМ (v0.889, запрос пользователя "балансы показывать слитно 0 и 1, но также
   разным цветом"): в двоичных режимах дефис между числами убран совсем — разделяет их только цвет
   (белый у единиц, серый у нулей). В ДЕСЯТИЧНОМ виде слитно нельзя (5 и 3 слиплись бы в "53"),
   поэтому там наоборот — явные знаки "1+0=сумма" (сумма и есть длина строки).
   Когда единиц и нулей поровну, вся метка идёт одним акцентным цветом (.row-balance-eq) —
   инлайновые цвета в этом случае не ставим, иначе они перебьют подсветку. */
/* ЗНАК СВЕРКИ С НОМЕРОМ СТРОКИ (v0.891, запрос пользователя "если равно то так 3+2=5, если нет то
   3+1 /= 5 — 5 это номер строки"). Метка баланса стоит ПЕРЕД номером, и знак между ними говорит,
   сходится ли сумма единиц и нулей (то есть длина строки) с её номером: "=" — сходится, "≠" — нет.
   ОДНИМ символом (v0.895, запрос пользователя "не равно — это перечёркнутое равно, сделай одним
   символом"): двухсимвольное "/=" читалось как деление и вдобавок требовало добивать "=" пробелом,
   чтобы номер не гулял по строкам. У "≠" и "=" ширина одна и та же сама собой. */
function balanceEqSign(total1, total0, rowNum){ return (total1 + total0) === rowNum ? "=" : "≠"; }
function formatBalanceTotals(total1, total0, w1, w0, bw1, bw0, rowNum){
  const mode = st.binBalance || "";
  const isEq = total1 === total0;
  const eq = isEq ? " row-balance-eq" : "";
  // Цвета чисел ставим ВСЕГДА, в том числе при "баланс поровну" (v0.899): та подсветка теперь
  // только фоновая (.row-balance-eq), текст она не перекрашивает — значит гасить деление на
  // белые единицы и серые нули больше незачем.
  const paint = (txt, color) => '<span style="color:' + color + '">' + txt + "</span>";
  const sign = balanceEqSign(total1, total0, rowNum);
  if (mode) {
    const s1 = balanceNumText(total1), s0 = balanceNumText(total0);
    const b1 = paint(s1, "#fff"), b0 = paint(s0, "#888");
    const body = mode === "1" ? b1
               : mode === "0" ? b0
               : mode === "10" ? (b1 + b0)
               : (b0 + b1);
    // Ширина метки одна на все строки — иначе номер слева от неё гулял бы по строкам и цепочка
    // ехала бы вбок (та же причина, что у padStart в десятичной ветке ниже). Добиваем пробелами
    // ВСЮ метку целиком, а не каждое число по отдельности: между числами разделителя быть не
    // должно — они идут слитно, различаются только цветом.
    const have = mode === "1" ? s1.length : mode === "0" ? s0.length : s1.length + s0.length;
    const want = mode === "1" ? (bw1 || 1) : mode === "0" ? (bw0 || 1) : ((bw1 || 1) + (bw0 || 1));
    return '<span class="row-balance' + eq + '">' + " ".repeat(Math.max(0, want - have)) + body + sign + "</span>";
  }
  // Суммы после "=" больше нет: её место занял САМ НОМЕР СТРОКИ, который печатается сразу за
  // меткой (см. render()). Знак и говорит, сходятся ли они — "3+2=5" против "3+1≠5".
  const t1 = String(total1).padStart(w1 || 0, " ");
  const t0 = String(total0).padStart(w0 || 0, " ");
  return '<span class="row-balance' + eq + '">' +
    paint(t1, "#fff") + "+" + paint(t0, "#888") + sign + "</span>";
}
/* Самая ШИРОКАЯ метка баланса в текущем режиме — «болванка» из девяток/единиц той же разметки,
   что и настоящая метка. По ней fitNumW() меряет, сколько места занять колонке номеров: с v0.889
   баланс печатается ВНУТРИ неё, а не отдельной колонкой. Знак сверки — один символ, что "=",
   что "≠", поэтому в болванке годится любой. */
function balanceSampleHtml(w1, w0, b1, b0){
  if (!st.showBalances) return "";
  const mode = st.binBalance || "";
  const body = mode === "1" ? "1".repeat(b1)
             : mode === "0" ? "1".repeat(b0)
             : mode ? "1".repeat(b1 + b0)
             : ("9".repeat(w1) + "+" + "9".repeat(w0));
  return '<span class="row-balance">' + body + "≠" + "</span>";
}

/* Суммарный баланс единиц/нулей по ВСЕМ выделенным строкам вместе (Σ в шапке "Результата") —
   запрос пользователя: при выделении нескольких строк видеть общий счёт, не складывая построчные
   в уме, и подсветку, если единиц и нулей поровну (та же .row-balance-eq, что и у построчного). */
function computeSelBalance(){
  let total1 = 0, total0 = 0;
  if (st.selectedRows) for (const i of st.selectedRows) {
    const rb = computeRowBalance(st.rows[i] || "");
    total1 += rb.total1; total0 += rb.total0;
  }
  return { total1, total0 };
}
function updateSelBalance(){
  const wrap = document.getElementById("selBalanceWrap");
  if (!wrap) return;
  if (!st.showBalances || !st.selectedRows || st.selectedRows.size === 0) { wrap.style.display = "none"; return; }
  wrap.style.display = "";
  const { total1, total0 } = computeSelBalance();
  wrap.classList.toggle("row-balance-eq", total1 === total0);
  const el1 = document.getElementById("selBalance1");
  const el0 = document.getElementById("selBalance0");
  if (el1) el1.textContent = total1;
  if (el0) el0.textContent = total0;
}

/* Общий баланс для шапки над колонкой построчных балансов (см. renderColHeader()): считается по
   ВЫДЕЛЕННЫМ строкам, а если не выделено ни одной — по ВСЕЙ таблице (запрос пользователя). Этим
   отличается от computeSelBalance() выше: та всегда только по выделенным (её Σ в шапке
   "Результата" при пустом выделении просто прячется). */
function computeHeaderBalance(){
  let total1 = 0, total0 = 0;
  const hasSel = !!(st.selectedRows && st.selectedRows.size);
  const idxs = hasSel ? Array.from(st.selectedRows) : st.rows.map((_, i) => i);
  for (const i of idxs) {
    const rb = computeRowBalance(st.rows[i] || "");
    total1 += rb.total1; total0 += rb.total0;
  }
  return { total1, total0, hasSel };
}

/* "Пробеги вместо битов" (#bRunsAsBits) — сама строка "0"/"1" ПОЛНОСТЬЮ заменяется её пробегами
   (см. computeRowBalance() выше), каждый своим цветом (var(--c1)/var(--c0), как у обычных
   битов), НАЧИНАЯ с той же позиции (сдвиг alignShift), что и настоящие биты — только визуально,
   без скобок/итогов (те — отдельно, через "⚖ Показать балансы"). Посимвольные подсветки
   (01/1↕1/1⤡1, выбор столбца, находки и т.п.) в этом режиме не применяются — пробег это уже не
   один символ, а условное обозначение целого куска строки. */
function formatRunsHtml(runs){
  return runs.map(r => '<span style="color:' + (r.isOne ? "var(--c1)" : "var(--c0)") + '">' + r.sign + r.n + "</span>").join("");
}

/* Особая подсветка "1 под 1" (см. #bHighlightVert1 в "Виде"): красит колонку только у МАКСИМАЛЬНОГО
   непрерывного участка из БОЛЕЕ ЧЕМ 2 строк подряд (3+, с учётом выравнивания/сдвига — та же
   alignShift(), что и в самом рендере), где в ЭТОЙ ЖЕ абсолютной колонке стоит "1", И у которого
   на ПЕРВОЙ строке участка "1" стоит строго крайним левым символом (локальный индекс 0 в этой
   строке) — участки, начинающиеся не с начала строки, не подсвечиваются вообще (та же логика
   старта, что у "1 по диагонали", см. computeDiagOnesMask()). ИСКЛЮЧЕНИЕ — выравнивание ⇤ (влево):
   там колонка 0 общая для ВСЕХ строк (все начинаются вплотную к левому краю), поэтому она почти
   всегда тривиально "занята" и неинтересна — вместо неё старт участка проверяется по КРАЙНЕМУ
   ПРАВОМУ символу первой строки участка (последний индекс её длины), т.к. именно правый край
   отличается от строки к строке при левом выравнивании. Строка, у которой в этой колонке
   реально стоит "0", обрывает участок (разрыв). А строка, которая КОРОЧЕ и физически не доходит до
   этой колонки (например справа выровненная короткая строка) — НЕ разрыв, участок просто на ней
   естественно заканчивается (см. пример пользователя: 0 / 10 / 001 при выравнивании вправо — "1" в
   "10" и "1" в "001" по диагонали стоят подряд, а укороченная "0" в 1-й строке эту колонку вообще не
   занимает). НЕ требует, чтобы участок покрывал буквально ВСЕ строки цепочки — только чтобы сам
   участок был целым. Считается ОДИН РАЗ на весь render() (не на отдельную строку, как
   compute01HighlightMask). Возвращает массив по индексу строки — Set<локальный индекс символа
   ВНУТРИ этой строки> (не абсолютная колонка), какие позиции подсвечивать; null у строк без хитов. */
function computeVertOnesMask(rows, align){
  const n = rows.length;
  const masks = new Array(n).fill(null);
  if (n < 2) return masks;
  let maxLen = 0;
  for (const s of rows) if (s.length > maxLen) maxLen = s.length;
  const shifts = rows.map((s, i) => s.length ? alignShift(maxLen, s.length, align, i) : 0);
  const addHit = (idx, k) => {
    if (!masks[idx]) masks[idx] = new Set();
    masks[idx].add(k);
  };
  for (let absCol = 0; absCol < maxLen; absCol++) {
    let runStart = -1;
    for (let i = 0; i <= n; i++) {
      let hit = false;
      if (i < n) {
        const s = rows[i];
        const k = absCol - shifts[i];
        hit = !!(s && s.length && k >= 0 && k < s.length && s[k] === '1');
      }
      if (hit) {
        if (runStart === -1) runStart = i;
      } else {
        if (runStart !== -1 && i - runStart > 2) {
          const k0 = absCol - shifts[runStart];
          const startsOk = align === 'left'
            ? (k0 === rows[runStart].length - 1)
            : (k0 === 0);
          if (startsOk) {
            for (let j = runStart; j < i; j++) addHit(j, absCol - shifts[j]);
          }
        }
        runStart = -1;
      }
    }
  }
  return masks;
}

/* Особая подсветка "1 по диагонали" (см. #bHighlightDiag1) — та же идея максимального
   непрерывного участка из 2+ строк, что и computeVertOnesMask(), но колонка сдвигается на ±1 с
   каждой строкой (проверяются обе диагонали — влево и вправо) вместо постоянной колонки. В отличие
   от "1 под 1" здесь считаются ТОЛЬКО участки, у которых ОБА конца — краевые: на первой строке
   участка "1" должна стоять либо самым первым, либо вторым символом строки (локальный индекс 0
   или 1 — диагональ может "выезжать" и от второго символа, не только от самого края), а
   заканчиваться участок должен ТОЛЬКО из-за того, что следующая строка физически коротка для
   продолжения диагонали (не хватает символов при её выравнивании) — если участок обрывается
   встреченным "0" (строка достаточно длинная, но в этой позиции стоит "0"), такой участок вообще
   не подсвечивается (а не подсвечивается частично до "0"). ИСКЛЮЧЕНИЕ — выравнивание ⇤ (влево):
   там левый край (локальный индекс 0) общий у всех строк и тривиален (см. тот же довод у
   computeVertOnesMask() выше), поэтому старт участка проверяется по ПРАВОМУ краю первой строки
   (последний или предпоследний её символ), а концом участка считается ТОЛЬКО тот случай, когда
   последняя строка участка дошла ровно до локального индекса 0 (упёрлась в левый край) — а не
   любое "не хватило длины". На "Центр ½"/"Лесенка ½" — диагональ идёт с шагом ПОЛсимвола за
   строку, а не целого (см. shift2x/dirStep ниже — учитывает +0.5ch нудж, которого целочисленный
   alignShift() не знает, запрос пользователя). В остальных режимах — как раньше. */
function computeDiagOnesMask(rows, align){
  const n = rows.length;
  const masks = new Array(n).fill(null);
  if (n < 2) return masks;
  let maxLen = 0;
  for (const s of rows) if (s.length > maxLen) maxLen = s.length;
  const isHalfAlign = align === "halfcenter" || align === "halfstairs" || align === "rhalfstairs";
  const shifts = rows.map((s, i) => s.length ? alignShift(maxLen, s.length, align, i) : 0);
  // Всё считается в ПОЛУсимвольных единицах (×2) — на "½"-выравниваниях часть строк имеет ещё
  // +0.5ch визуальный сдвиг (см. hasHalfNudge/halfShiftAttr в render()), которого целочисленный
  // alignShift() не знает. На этих режимах диагональ идёт с шагом ПОЛсимвола за строку (запрос
  // пользователя — "диагональ должна идти по сдвигу ½"), т.е. dirStep=1 в ×2-единицах = 0.5
  // реального столбца; на обычных выравниваниях dirStep=2×0.5=1 целый столбец/строку — то же
  // самое поведение, что было раньше (rel2x всегда чётный, k=rel2x/2 совпадает со старым k).
  const shift2x = rows.map((s, i) => s.length ? (2 * shifts[i] + (isHalfAlign && hasHalfNudge(s, maxLen, align, i) ? 1 : 0)) : 0);
  const dirStep = isHalfAlign ? 1 : 2;
  const addHit = (idx, k) => {
    if (!masks[idx]) masks[idx] = new Set();
    masks[idx].add(k);
  };
  for (const dir of [-1, 1]) {
    for (let offset2x = -(n - 1) * dirStep; offset2x < 2 * maxLen + (n - 1) * dirStep; offset2x++) {
      let runStart = -1;
      for (let i = 0; i <= n; i++) {
        let hit = false;
        let boundaryStop = true; // строка кончилась / бита тут структурно нет (не тот полу-такт) — не разрыв; false = встретили именно "0"
        if (i < n) {
          const s = rows[i];
          const absCol2x = offset2x + dir * dirStep * i;
          const rel2x = absCol2x - shift2x[i];
          if (s && s.length && rel2x % 2 === 0) {
            const k = rel2x / 2;
            const inBounds = k >= 0 && k < s.length;
            hit = inBounds && s[k] === '1';
            if (inBounds && !hit) boundaryStop = false;
          }
        }
        if (hit) {
          if (runStart === -1) runStart = i;
        } else {
          if (runStart !== -1 && i - runStart >= 2) {
            const k0 = ((offset2x + dir * dirStep * runStart) - shift2x[runStart]) / 2;
            const lastRow = i - 1;
            const kEnd = ((offset2x + dir * dirStep * lastRow) - shift2x[lastRow]) / 2;
            const startsOk = align === 'left'
              ? (k0 === rows[runStart].length - 1 || k0 === rows[runStart].length - 2)
              : (k0 === 0 || k0 === 1);
            const endsOk = align === 'left' ? (kEnd === 0) : boundaryStop;
            if (startsOk && endsOk) {
              for (let j = runStart; j < i; j++) {
                const absColJ2x = offset2x + dir * dirStep * j;
                addHit(j, (absColJ2x - shift2x[j]) / 2);
              }
            }
          }
          runStart = -1;
        }
      }
    }
  }
  return masks;
}

/* "1 по диагонали" с учётом разделителей (см. rowDividers/toggleRowDivider) — если разделители
   есть, диагональ считается ОТДЕЛЬНО по каждой секции между ними (как будто других строк не
   существует): 0 разделителей — как обычно, computeDiagOnesMask() по всей таблице разом; 1 —
   две секции (верх..разделитель, разделитель+1..низ); несколько — по каждой паре соседних
   (плюс верхняя и нижняя крайние секции) — запрос пользователя. Разделитель СНИЗУ строки b —
   b последняя в своей секции, следующая начинается со строки b+1. */
function computeDiagOnesMaskSectioned(rows, align, dividers){
  if (!dividers || dividers.size === 0) return computeDiagOnesMask(rows, align);
  const n = rows.length;
  const merged = new Array(n).fill(null);
  const boundaries = Array.from(dividers).filter(i => i >= 0 && i < n - 1).sort((a, b) => a - b);
  if (!boundaries.length) return computeDiagOnesMask(rows, align);
  let start = 0;
  const sections = [];
  for (const b of boundaries) { sections.push([start, b]); start = b + 1; }
  sections.push([start, n - 1]);
  for (const [lo, hi] of sections) {
    if (hi < lo) continue;
    const subMask = computeDiagOnesMask(rows.slice(lo, hi + 1), align);
    for (let i = 0; i < subMask.length; i++) if (subMask[i]) merged[lo + i] = subMask[i];
  }
  return merged;
}

/* Раскрашивает биты 0/1 в HTML — используется и основной таблицей, и Черновиком последнего шага.
   highlightRange {start,end} (включительно, по индексу символа) — подсветка "под окном
   въезжающей цепочки сейчас", как в оверлее Гориз.XOR. */
function bitsHtml(s, highlightRange){
  let h = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const covered = highlightRange && i >= highlightRange.start && i <= highlightRange.end;
    if (covered && (ch === "0" || ch === "1")) h += '<span class="xored-bit" title="Под въезжающей цепочкой сейчас">' + ch + '</span>';
    else if (ch === "0" || ch === "1") h += '<span class="b' + ch + '">' + ch + '</span>';
    else h += esc(ch);
  }
  return h;
}

/* Список вкладок-цепочек — свой выпадающий список в верхнем меню (см. #chainDd/#chainDdList),
   не нативный <select> — нужно было по кнопке "✕" у КАЖДОЙ вкладки отдельно (не только у
   текущей). Кнопки Сохран/Восстан/+/Очистить — статические элементы там же, эта функция
   только перерисовывает список и подпись текущей вкладки на кнопке-тоггле. */
function renderTabs() {
  const toggleEl = document.getElementById("chainDdToggle");
  const listEl = document.getElementById("chainDdList");
  if (!toggleEl || !listEl) return;
  if (!st.tabs || st.tabs.length === 0) {
    st.tabs = [createDefaultTabState("Цепочка 1")];
    st.activeTab = 0;
  }

  const active = st.tabs[st.activeTab];
  const patBankCount = (st.patBank && st.patBank.length) || 0;
  toggleEl.innerHTML = esc(active ? active.name : "Цепочка") + ' <span class="chain-dd-arrow">⌄</span>';

  listEl.innerHTML = st.tabs.map((tab, i) =>
    '<div class="chain-dd-item' + (i === st.activeTab ? " act" : "") + '" data-idx="' + i + '">' +
      '<span class="chain-dd-name" title="Двойной клик — переименовать">' + esc(tab.name) + '</span>' +
      '<button type="button" class="chain-dd-mini" data-act="save" data-idx="' + i + '" title="Сохранить эту цепочку (без переключения)">💾</button>' +
      '<button type="button" class="chain-dd-mini" data-act="reset" data-idx="' + i + '" title="Сбросить эту цепочку к сохранению/шаблону">↺</button>' +
      '<button type="button" class="chain-dd-close" data-idx="' + i + '" title="Закрыть эту вкладку"' +
        (st.tabs.length <= 1 ? " disabled" : "") + '>✕</button>' +
    '</div>'
  ).join("") +
  // Экспорт/импорт ВСЕХ вкладок — подвалом этого же списка (запрос пользователя: перенести сюда
  // из верхней панели). Рисуется ВНУТРИ innerHTML, а не отдельным статическим элементом, потому
  // что renderTabs() перезаписывает список целиком и статику отсюда просто стёрло бы. Клик
  // ловится тем же делегированным обработчиком, что и остальные кнопки списка.
  '<div class="chain-dd-footer">' +
    '<div class="chain-dd-frow">' +
    '<button type="button" class="chain-dd-file" data-act="export" title="Сохранить ВСЕ вкладки-цепочки (со всеми их строками/паттернами/настройками) в файл .json">⬇ Файл</button>' +
    '<button type="button" class="chain-dd-file" data-act="import" title="Загрузить вкладки-цепочки из файла .json (заменит текущие все)">⬆ Файл</button>' +
    '<button type="button" class="chain-dd-file chain-dd-wipe" data-act="wipe" title="ПОЛНОСТЬЮ очистить кэш приложения в браузере: все вкладки-цепочки, настройки и раскладку панелей. Нужно, когда сохранённое состояние само вешает вкладку. Сначала выгрузи нужное кнопкой «⬇ Файл»">🗑 Кэш</button>' +
    '</div>' +
  // ВТОРОЙ РЯД — КЭШ ПАТТЕРНОВ (v0.822, упрощён в v0.825 по просьбе пользователя: "просто
  // текущие паттерны текущей цепочки туда в кэш отдельно, чтобы там не менялись они").
  // Кладём СНИМОК колонки паттернов в st.patBank — он лежит в кэше браузера отдельно от вкладок,
  // общий на все, и сам собой не меняется. Дальше двумя кнопками раскладывается обратно: либо в
  // колонку паттернов, либо прямо в цепочку.
  // Счётчик в подписи — сколько записей сейчас в кэше; пустой кэш обе кнопки отключает.
    '<div class="chain-dd-frow">' +
    '<button type="button" class="chain-dd-file chain-dd-bank" data-act="banksave" title="Отложить в кэш ТЕКУЩИЕ паттерны этой цепочки — отдельной копией. Дальше их можно как угодно править, переключать цепочки и сбрасывать: отложенное в кэше не меняется, пока не отложишь заново. Лежит в браузере, переживает перезагрузку">💾 Паттерны в кэш' + (patBankCount ? ' (' + patBankCount + ')' : '') + '</button>' +
    '</div>' +
    '<div class="chain-dd-frow">' +
    '<button type="button" class="chain-dd-file chain-dd-bank" data-act="bankpats"' + (patBankCount ? '' : ' disabled') + ' title="Разложить паттерны ИЗ КЭША в колонку паттернов: паттерн №N = строка файла №N. Прежние паттерны заменяются целиком, строки цепочки не трогаются. Отменяется через Undo">🧩→ В паттерны</button>' +
    '<button type="button" class="chain-dd-file chain-dd-bank" data-act="bankrows"' + (patBankCount ? '' : ' disabled') + ' title="Разложить паттерны ИЗ КЭША в саму цепочку: строка №N = строка файла №N. Прежние строки цепочки стираются целиком (как у «🧩⬇ Паттерны в цепочку»). Отменяется через Undo">🧩⬇ В цепочку</button>' +
    '</div>' +
  // ПОСЛЕДНИЙ РЯД — НАСТРОЙКИ ВИДА (v0.834): переехали сюда из вкладки "Вид" по запросу
  // пользователя. Данных цепочек не трогают вообще — сохраняют/сбрасывают только вид и поиск
  // (цвета, шрифт, галки), поэтому и стоят отдельным рядом своим цветом (.chain-dd-ui).
  // По id их обработчик вешать нельзя: renderTabs() перерисовывает список целиком — клик ловит
  // тот же делегированный обработчик (см. data-act="uisave"/"uireset").
  // Копирование самих строк цепочки — сюда же (v0.835). В буфер кладутся ДВА формата: обычный
  // текст и HTML с посимвольными цветами, чтобы вставка в Excel приезжала раскрашенной
  // (см. copySelectedRows/clipRowsHtml).
    '<div class="chain-dd-frow">' +
    '<button type="button" class="chain-dd-file chain-dd-ui" data-act="copychain" title="Скопировать строки цепочки в буфер обмена — каждая своей строкой, с ведущими пробелами по текущему выравниванию. Выделены строки — копируются только они, ничего не выделено — вся цепочка. В Excel вставляется с цветами символов (строка = одна ячейка). То же самое делает Ctrl+C по выделенным строкам">📋 Скопировать строки-цепочки</button>' +
    '</div>' +
    '<div class="chain-dd-frow">' +
    '<button type="button" class="chain-dd-file chain-dd-ui" data-act="uisave" title="Сохранить текущие настройки вида/поиска (цвета, шрифт, галки и т.п.) — данные цепочек не трогает">💾 Сохр. настройки</button>' +
    '<button type="button" class="chain-dd-file chain-dd-ui" data-act="uireset" title="Сбросить настройки вида/поиска к значениям по умолчанию — данные цепочек не трогает">↺ Сброс настроек</button>' +
    '</div>' +
  '</div>';
}

/* Линейка номеров столбцов — всегда видна над строками, выровнена под сетку битов той же
   .num/.pat/.bits/.pat2 разметкой, что и обычные строки, чтобы клик по метке N сдвигал именно
   N-й символ каждой строки. Прилипает к верху (position:sticky, см. CSS) сразу под .chain-head,
   так что не уезжает при скролле строк вниз.
   Снять выделение — клик по метке ВЫБРАННОГО столбца: её палочка "|" заменяется на "✕" прямо
   на месте (col-cell-clear-glyph) — крестик всегда там же, где сама подсветка, а не отдельно
   сбоку. Ни палочек, ни крестиков в линейке сейчас НЕТ — ячейка содержит один пробел, которым и
   задана её ширина (ровно символ, чтобы совпадать с сеткой битов); обёртка .col-cell-tick со
   scaleX для старой палочки удалена в v0.853. */
function renderColHeader(maxLen, mirrorPadL){
  const el = document.getElementById("colHeader");
  if (!el) return;
  if (maxLen <= 0) {
    el.classList.remove("act");
    el.innerHTML = "";
    return;
  }
  el.classList.add("act");

  const alignCls = "al-" + st.align;
  let ticks = "";
  // МЕСТО ПОД ЗЕРКАЛА СЧИТАЕТСЯ ЗАСЕЧКАМИ, А НЕ СДВИГОМ ВСЕЙ ЛИНЕЙКИ (запрос пользователя:
  // "когда включены зеркала засечки рушатся, надо учитывать биты от зеркал"). Раньше линейка
  // печатала maxLen засечек ОТ СТОЛБЦА 0 и целиком уезжала вправо на mirrorPadL — из-за этого
  // левые mirrorPadL экранных колонок (там как раз и стоят левые зеркала) оставались БЕЗ засечек
  // вовсе, а справа линейка ровно на столько же торчала за полотно. Теперь засечек столько же,
  // сколько экранных колонок, но нумерация начинается с −mirrorPadL: над зеркальными битами тоже
  // стоят засечки, а над настоящим столбцом N по-прежнему стоит засечка N.
  const colLo = -(mirrorPadL || 0);
  for (let c = colLo; c < colLo + maxLen; c++) {
    const num = c + 1;
    const isSel = st.selectedCol === c;
    const selCls = isSel ? " sel" : "";
    // Ни палочек, ни крестиков (запрос пользователя "убери засечки те для столбцов и
    // крестики"): линейка осталась чистой полосой — ячейки на месте и кликабельны, но ничего не
    // рисуют. Выбранный столбец видно по битам в самих строках (.col-sel-bit/.axis-col-bit).
    // Обёртки .col-cell-tick больше нет (v0.853, запрос пользователя "col-cell-tick нужен? убери,
    // перекрывает он биты"): она осталась от старых засечек и держала только scaleX(1.6) для
    // палочки "|", которой уже нет. Сам "&nbsp;" ОБЯЗАН остаться — им и задана ширина ячейки
    // ровно в один символ, без него линейка схлопнется и клик по столбцу попадать будет мимо.
    const glyph = '&nbsp;';
    // Столбцы левее первого — место под зеркала: настоящих бит строк там нет, есть только серые
    // зеркальные, поэтому и подпись у них своя.
    // Подсказка без "клик снимет выделение": выделять/снимать столбец линейкой больше нельзя,
    // это делается кликом по самому биту при "🔢 Выбор столбца" (см. обработчик #colHeader в
    // fold-3 — там остались только режимы "обрезка" и "⊙ Ось сюда").
    const tTitle = c < 0 ? ("Зеркальный столбец (место под зеркала, " + (-c) + " слева от 1-го)")
                         : ("Столбец " + num);
    ticks += '<span class="col-cell' + selCls + '" data-col="' + c + '" title="' + tTitle + '">' + glyph + '</span>';
  }
  // Дополнительный пустой <span class="num"> перед .bits — держит линейку в той же разметке,
  // что и строки (см. render(): теперь номер строки есть и у ЛЕВОГО края .bits), иначе тики
  // снова разъедутся с битами (тот же класс бага, что уже правили раньше в этом файле).
  // ОТДЕЛЬНОЙ ЗАГЛУШКИ ПОД БАЛАНС ТУТ БОЛЬШЕ НЕТ (v0.889): с этой версии построчный баланс
  // печатается ВНУТРИ поля номера (см. render()), своей колонки у него не осталось, а ширину
  // .num-l2 и в строках, и в этой линейке задаёт одна и та же --num-w — значит линейка и биты
  // расходиться не могут в принципе (раньше заглушку приходилось подгонять по ширине вручную,
  // и она разъезжалась, если самые длинные total1 и total0 встречались в РАЗНЫХ строках).
  const alignBalEl = document.getElementById("alignBalance");
  /* ОБЩИЙ БАЛАНС В ПОЛОСЕ — ВСЕГДА НА ЭКРАНЕ, И СРАЗУ В ДВУХ ВИДАХ (v0.864, запрос пользователя
     "тут всегда отображать балансы и рядом их же битами, это как бы кнопки тоже будут — вкл/выкл
     балансов в строках"). Показывается независимо от того, включены ли построчные балансы: он же
     служит их выключателем. Две половинки — обычные числа и они же в двоичном — работают как пара
     кнопок: клик по половинке включает построчные балансы В ЭТОМ ВИДЕ, повторный клик по уже
     активной — выключает (см. обработчик #alignBalance в fold-3). */
  if (alignBalEl) {
    const hb = computeHeaderBalance();
    const eqCls = hb.total1 === hb.total0 ? " row-balance-eq" : "";
    const pair = (t1, t0) => hb.total1 === hb.total0
      ? (t1 + "-" + t0)
      : ('<span style="color:#fff">' + t1 + '</span>-<span style="color:#888">' + t0 + '</span>');
    const decHtml = pair(String(hb.total1), String(hb.total0));
    const binHtml = pair(hb.total1.toString(2), hb.total0.toString(2));
    const where = hb.hasSel ? "ВЫДЕЛЕННЫМ строкам" : "ВСЕМ строкам (ничего не выделено)";
    // Активна та половинка, в чьём виде сейчас показаны построчные балансы.
    const decAct = st.showBalances && !st.binBalance ? " act" : "";
    const binAct = st.showBalances && st.binBalance ? " act" : "";
    alignBalEl.innerHTML =
      '<span class="align-bal-part' + decAct + eqCls + '" data-bal="dec" title="Общий баланс по ' + where +
        ' — единиц и нулей. Клик — показать/убрать балансы в самих строках (десятичным)">' + decHtml + '</span>' +
      '<span class="align-bal-part' + binAct + eqCls + '" data-bal="bin" title="То же самое в двоичном виде. Клик — показать/убрать балансы в строках двоичным">' + binHtml + '</span>';
    alignBalEl.style.display = "";
  }
  // Тот же общий визуальный сдвиг ручки #axisSplit, что и у строк (см. extraCh в render()) —
  // линейка обязана ехать ВМЕСТЕ со строками, иначе тик N перестаёт стоять над столбцом N
  // (запрос пользователя — "линии для выделения столбцов уехали от реальных").
  // mirrorPadL сюда БОЛЬШЕ НЕ ВХОДИТ — место под зеркала учтено самими засечками (см. colLo выше).
  const off = (st.axisCenterOffset || 0);
  const offAttr = off ? ' style="transform:translateX(' + (off * realColStepPx()).toFixed(2) + 'px)"' : '';
  el.innerHTML =
    '<div class="col-hdr-row"><span class="pat"></span><span class="num num-l2"></span>' +
    '<span class="bits ' + alignCls + '"><span' + offAttr + '>' + ticks + '</span></span><span class="pat2"></span></div>';
}

/* Сколько столбцов реально ЗАНИМАЕТ картинка на экране — НЕ то же самое, что maxLen (длина
   самой длинной строки). У "Лесенки"/"Лесенки ½"/"Ось"/"ОсьБит" сдвиг строки зависит от её
   НОМЕРА (у stairs shift = ri, см. alignShift()), поэтому нижние строки стоят правее maxLen:
   инвариант "shift+len <= maxLen" там намеренно не соблюдается. Линейка столбцов рисовалась
   ровно на maxLen засечек, и над уехавшим вправо хвостом лесенки засечек просто не было —
   кликнуть по такому столбцу было нечем (запрос пользователя "правее нет засечек для
   столбцов"). Берём максимум правого края (shift+len) по всем строкам, не меньше maxLen. */
function visibleColCount(maxLen){
  let w = maxLen;
  for (let i = 0; i < st.rows.length; i++){
    const s = st.rows[i] || "";
    if (!s.length) continue;
    const end = rowShiftFor(maxLen, i, s, st.align) + s.length;
    if (end > w) w = end;
  }
  return w;
}

/* Границы строк для режима "🔢 Выбор столбца":
   - без выделения — все строки (как раньше);
   - выделена ОДНА строка — от начала таблицы до неё включительно (строки выше и она сама);
   - выделены ДВЕ И БОЛЕЕ строк — только диапазон МЕЖДУ крайними из выделенных (включительно),
     а не от начала таблицы — верхняя выделенная строка сама становится верхней границей. */
function colSelectRowRange(){
  if (!st.selectedRows || st.selectedRows.size === 0) return { lo: 0, hi: Infinity };
  const arr = Array.from(st.selectedRows);
  if (arr.length === 1) return { lo: 0, hi: arr[0] };
  return { lo: Math.min(...arr), hi: Math.max(...arr) };
}

/* Клик по номеру столбца (режим "🔢 Выбор столбца"): КАЖДУЮ строку, которая своими
   символами реально достаёт до этого столбца (с учётом выравнивания), циклически сдвигает
   так, чтобы на этом столбце оказалась '1' — с минимумом единиц слева от неё (bestColumnShift).
   Строки без единиц или не достающие до столбца — не трогаются. */
/* ЧТО ДЕЛАЕТ КЛИК ПО НОМЕРУ СТОЛБЦА: "shift" — прежний сдвиг строк к «1» (selectColumn),
   "trim" — обрезка строк по этому столбцу (trimAtColumn). Переключается парой кнопок
   #bColModeShift/#bColModeTrim. */
var colClickMode = "shift";
/* С какой стороны режет "✂ Обрезать" — со стороны, ПРОТИВОПОЛОЖНОЙ выравниванию (запрос
   пользователя: "наоборот, с другой стороны обрезать"). У прижатых влево (включая лесенки от левого
   края) прижатый левый край и есть точка отсчёта картинки — его и оставляем, а режем справа; у
   прижатых вправо наоборот. У центра/оси/осевых прижатой стороны нет вовсе, поэтому режем ту
   половину, что ДАЛЬШЕ от кликнутого столбца: клик слева от середины отрезает справа, и наоборот. */
function colTrimSide(col, maxLen){
  if (st.align === "right" || st.align === "rstairs") return "left";
  if (st.align === "left" || st.align === "stairs" || st.align === "halfstairs") return "right";
  return col < Math.floor(maxLen / 2) ? "right" : "left";
}
/* ГРУППЫ ОСЕЙ. Оси назначаются не по одной, а ПАЧКАМИ: кнопка "⊙ Оси по «1» строки" делает
   группой все единицы одной строки, а ручной клик по столбцу — группу из одного столбца.
   Каждая группа рисуется СВОИМ цветом (см. AXIS_GROUP_CLS/.ax-g* в CSS), и "✕ Снять выбор"
   снимает их ПО ОДНОЙ ГРУППЕ за нажатие.
   У группы, сделанной ИЗ СТРОКИ, есть своя ЗОНА ДЕЙСТВИЯ (запрос пользователя: "если оси по
   строке, то они начинаются с неё и вниз до конца или до следующей строки, где начинаются оси,
   не накладывать их друг на друга"): group.row — номер строки-источника, и группа действует на
   строки от неё и вниз, пока не начнётся следующая строчная группа. Зоны не перекрываются:
   на каждую строку действует РОВНО ОДНА строчная группа — ближайшая сверху.
   Группы от ручных кликов (group.row === null) зоны не имеют и действуют там, где строчной
   группы нет вовсе.
   st.axisSnapGroups — сами группы, st.axisSnapCols — плоский список всех их столбцов (нужен для
   быстрых проверок "есть ли оси вообще"); он ВСЕГДА пересобирается из групп. */
const AXIS_GROUP_CLS = ["ax-g0", "ax-g1", "ax-g2", "ax-g3", "ax-g4", "ax-g5"];
function axisGroups(){
  if (!Array.isArray(st.axisSnapGroups)) st.axisSnapGroups = (st.axisSnapCols || []).map(c => [c]);
  // Старый формат группы — просто массив столбцов; нормализуем в объект без зоны.
  for (let i = 0; i < st.axisSnapGroups.length; i++) {
    const g = st.axisSnapGroups[i];
    if (Array.isArray(g)) st.axisSnapGroups[i] = { cols: g.slice(), row: null };
    else if (!g || !Array.isArray(g.cols)) st.axisSnapGroups[i] = { cols: [], row: null };
    // ДИАГОНАЛЬНЫЕ ПОЛЯ (см. "⤡ Диагональные столбцы на «½»"): p2 — позиции осей в ПОЛУстолбцах
    // (×2) на строке-ЯКОРЕ anch. Обычной вертикальной оси соответствует p2 = 2×столбец, и тогда
    // наклон 0 возвращает ровно прежнюю арифметику "столбец − сдвиг строки". У старых сохранёнок
    // этих полей нет — достраиваем их из cols/row, поведение при выключенной галке не меняется.
    const gg = st.axisSnapGroups[i];
    if (!Array.isArray(gg.p2) || gg.p2.length !== gg.cols.length) gg.p2 = gg.cols.map(c => 2 * c);
    if (gg.anch == null) gg.anch = (gg.row != null) ? gg.row : 0;
  }
  return st.axisSnapGroups;
}
function syncAxisSnapCols(){
  const seen = new Set(), out = [];
  for (const g of axisGroups()) for (const c of g.cols) if (!seen.has(c)) { seen.add(c); out.push(c); }
  st.axisSnapCols = out;
  return out;
}
/* Добавить группу столбцов. row — строка-источник (null у ручного клика по столбцу).
   Пустая группа не добавляется; столбцы внутри группы дедуплицируются. */
/* p2/anch — необязательные диагональные поля (см. axisGroups): позиции осей в ПОЛУстолбцах и
   строка-якорь, через которую проходит диагональ. Не переданы — считаются из cols/row, то есть
   ось остаётся обычной вертикалью. Дедуп идёт по p2 (это истинная позиция), cols едет параллельно. */
function addAxisGroup(cols, row, p2, anch){
  const src2 = (Array.isArray(p2) && p2.length === cols.length) ? p2 : cols.map(c => 2 * c);
  const uniq = [], uniq2 = [];
  const seen = new Set();
  for (let i = 0; i < cols.length; i++) {
    if (seen.has(src2[i])) continue;
    seen.add(src2[i]); uniq.push(cols[i]); uniq2.push(src2[i]);
  }
  if (!uniq.length) return false;
  const groups = axisGroups();
  // Одна строка — одна группа: повторное "⊙ Оси по «1»" на той же строке заменяет прежнюю,
  // иначе на одной зоне оказалось бы две группы сразу.
  if (row != null) {
    const old = groups.findIndex(g => g.row === row);
    if (old >= 0) groups.splice(old, 1);
  }
  groups.push({
    cols: uniq, p2: uniq2, row: (row == null ? null : row),
    anch: (anch == null ? (row == null ? 0 : row) : anch)
  });
  syncAxisSnapCols();
  return true;
}
/* Индекс СТРОЧНОЙ группы, действующей на строку r: ближайшая строка-источник СВЕРХУ (включая
   саму строку-источник). −1 — строчной группы над этой строкой нет. */
function axisGroupIdxForRow(r){
  const groups = axisGroups();
  let best = -1, bestRow = -Infinity;
  for (let i = 0; i < groups.length; i++) {
    const gr = groups[i].row;
    if (gr == null) continue;
    if (gr <= r && gr > bestRow) { best = i; bestRow = gr; }
  }
  return best;
}
/* Столбец -> индекс группы (цвет) ДЛЯ КОНКРЕТНОЙ СТРОКИ. Есть строчная группа — только её
   столбцы; нет — все "безадресные" группы от ручных кликов. */
function axisColorMapForRow(r){
  const groups = axisGroups();
  const gis = axisGroupIdxsForRow(r);
  if (!gis.length) return null;
  const map = new Map();
  for (const gi of gis) for (const c of groups[gi].cols) if (!map.has(c)) map.set(c, gi);
  return map.size ? map : null;
}
/* Индексы групп, действующих на строку r — общая развилка для axisColorMapForRow (вертикальные
   оси, по номерам столбцов) и axisLocalIdxMapForRow (диагональные, по полустолбцам): есть
   строчная группа — работает ТОЛЬКО она, нет — все «безадресные» группы от ручных кликов. */
function axisGroupIdxsForRow(r){
  const groups = axisGroups();
  if (!groups.length) return [];
  const gi = axisGroupIdxForRow(r);
  if (gi >= 0) return [gi];
  const out = [];
  for (let i = 0; i < groups.length; i++) if (groups[i].row == null) out.push(i);
  return out;
}
/* "⊙ Ось сюда" — клик по номеру столбца НАЗНАЧАЕТ его столбцом-целью для круговых сдвигов
   (st.axisSnapCols — их может быть несколько). Ни картинка, ни строки при этом НЕ ДВИГАЮТСЯ (запрос пользователя:
   "строки не должны ехать — просто при сдвиге в этом столбце должна быть «1», выпал ноль,
   значит пропуск и дальше до ближайшей единицы"). Двигает строки только сам Круг ◄/►, и каждая
   крутится ровно до положения, в котором на этом столбце стоит «1» (см. nonAxisSnapCharIdx).
   Снимает назначение только кнопка "✕ Снять столбец" — она убирает СРАЗУ ВСЕ оси. */
function axisToColumn(col){
  // ОСЕЙ МОЖЕТ БЫТЬ НЕСКОЛЬКО (запрос пользователя): каждое назначение ДОБАВЛЯЕТ столбец к
  // набору, а не заменяет прежний. Круг после этого крутит строку до положения, где «1» стоит
  // на ВСЕХ назначенных столбцах сразу (см. shiftOneRowAxisAware/axisSnapLocalIdxs).
  // Переключателя тут нет: клик по номеру (в том числе тот, которым снимают жёлтое выделение)
  // назначение не сбрасывает — снимает его только "✕ Снять столбец".
  // Режим "🔢 Выбор столбца" после назначения отжимается сам: столбец выбран, ось на нём.
  if (typeof colPickMode !== "undefined" && colPickMode) setColPickMode(false);
  // СТОЛБЦЫ И БИТЫ — ВЗАИМОИСКЛЮЧИМЫ (запрос пользователя): назначение столбца-оси выключает
  // режим "⊙ Оси по битам" и убирает поставленные им группы, чтобы оси не смешивались.
  if (typeof bitAxisMode !== "undefined" && bitAxisMode) setBitAxisMode(false, true);
  // Ручной клик — ГРУППА ИЗ ОДНОГО СТОЛБЦА (см. addAxisGroup): снимается она так же, как
  // группа от строки, одним нажатием "✕ Снять выбор".
  const had = syncAxisSnapCols().includes(col);
  // Якорь диагонали для ручного клика — верхняя выделенная строка (через неё линия и пройдёт по
  // кликнутому столбцу), нет выделения — первая строка. При выключенной галке якорь не участвует.
  if (!had) addAxisGroup([col], null, [2 * col],
    (st.selectedRows && st.selectedRows.size) ? Math.min(...st.selectedRows) : 0);
  st.selectedCol = col; // жёлтое выделение — просто чтобы столбец был виден и в линейке
  const list = st.axisSnapCols.slice().sort((a, b) => a - b).map(c => c + 1).join(", ");
  say(had
    ? `Столбец ${col + 1} и так среди осей (${list}). Снять все — кнопкой «✕ Снять столбец».`
    : (st.axisSnapCols.length > 1
        ? `Оси для Круга: столбцы ${list}. Сдвиги ◄/► ставят «1» СРАЗУ НА ВСЕ; нет такого положения — строка стоит на месте.`
        : `Столбец ${col + 1} назначен осью для Круга: сдвиги ◄/► ставят на него «1», нули пропускаются. Сейчас ничего не сдвинуто.`));
  render(); saveCache();
}
/* Обрезка по столбцу: у каждой строки отрезается всё, что лежит от стороны выравнивания ДО
   кликнутого столбца ВКЛЮЧИТЕЛЬНО (сам столбец тоже уходит — иначе клик по самому краю не делал
   бы ничего). Считаем в КОЛОНКАХ ПОЛОТНА, то есть с учётом сдвига строки по выравниванию — те же
   номера, что показывает линейка и что лежат в data-col у битов. Строки, которые до столбца не
   достают, остаются как были; строка, целиком попавшая под нож, становится пустой.
   Остаток никуда двигать не нужно: на место его ставит обычное выравнивание при отрисовке. */
function trimAtColumn(col){
  // Границы строк — РОВНО те же, что у "⇅ Сдвиг к «1»" (colSelectRowRange): выделена одна строка —
  // работаем по всем строкам ДО НЕЁ ВКЛЮЧИТЕЛЬНО, выделено несколько — по всему их диапазону,
  // не выделено ничего — по всей цепочке. Раньше обрезка брала буквально выделенный набор, и одна
  // выделенная строка означала одну обрезанную (запрос пользователя: "как при сдвиге к 1").
  const range = colSelectRowRange();
  const lo = Math.max(0, range.lo);
  const hi = Math.min(st.rows.length - 1, range.hi === Infinity ? st.rows.length - 1 : range.hi);
  const idxs = [];
  for (let i = lo; i <= hi; i++) idxs.push(i);
  let maxLen = 0;
  for (const s of st.rows) if (s && s.length > maxLen) maxLen = s.length;
  const side = colTrimSide(col, maxLen);
  // Сначала считаем результат и только потом трогаем данные — snapshot() на пустую правку
  // засорял бы Undo (то же правило, что у "✂ Вырезать найденные").
  const plan = [];
  let cut = 0;
  for (const r of idxs) {
    const s = st.rows[r];
    if (!s || !s.length) continue;
    const shift = rowShiftFor(maxLen, r, s, st.align);
    const j = col - shift; // индекс кликнутого столбца ВНУТРИ строки
    const out = (side === "left")
      ? s.slice(Math.min(s.length, Math.max(0, j + 1)))
      : s.slice(0, Math.max(0, Math.min(s.length, j)));
    if (out === s) continue;
    plan.push([r, out]);
    cut += s.length - out.length;
  }
  if (!cut) {
    say(`Обрезка по столбцу ${col + 1}: резать нечего — строки до него не достают.`);
    return;
  }
  snapshot();
  for (const pr of plan) {
    st.rows[pr[0]] = pr[1];
    insertedFlagsMap.delete(pr[0]);
    invFlagsMap.delete(pr[0]);
  }
  maskChangedMap.clear(); maskBaseRows = null;
  st.hit = null;
  say(`Обрезка по столбцу ${col + 1} (${side === "left" ? "слева" : "справа"}): убрано ${cut} бит в ${plan.length} стр.`);
  logStep("Обрезка по столбцу", plan.map(pr => pr[0] + 1).join(","), "", `Столбец ${col + 1}, ${cut} бит`);
  render(); saveCache();
}
/* ПРОСТО перевести выделение столбца на другой номер — БЕЗ какого-либо сдвига строк.
   Нужна стрелкам ◄►: там выделение только ездит по линейке, а биты трогать нельзя. Раньше эта
   ветка звала selectColumn(), а та (режим "⇅ Сдвиг к «1»") заодно КРУТИТ строки — из-за этого
   стрелки двигали биты, даже когда режим сдвига не включён вовсе (баг-репорт пользователя). */
function setSelectedColOnly(col){
  let maxLen = 0;
  for (const s of st.rows) if (s.length > maxLen) maxLen = s.length;
  if (col < 0 || col >= visibleColCount(maxLen)) return;
  st.selectedCol = col;
  render();
  saveCache();
}
function selectColumn(col){
  let maxLen = 0;
  for (const s of st.rows) if (s.length > maxLen) maxLen = s.length;
  // Граница — по ВИДИМОЙ ширине (см. visibleColCount()), а не по maxLen: у "Лесенки"/"Оси"
  // столбцы правее maxLen реально существуют на экране, и клик по ним раньше молча отсекался.
  if (col < 0 || col >= visibleColCount(maxLen)) return;

  const range = colSelectRowRange();
  snapshot();
  for (let i = range.lo; i < st.rows.length && i <= range.hi; i++) {
    const rowStr = st.rows[i];
    if (!rowStr || !rowStr.length) continue;
    // rowShiftFor (не голый alignShift) — ровно та же геометрия, по которой render() проставляет
    // data-col: у "⊙ Ось"/"ОсьБит" alignShift даёт совсем другой сдвиг, и клик по столбцу попадал
    // не в тот бит.
    const shift = rowShiftFor(maxLen, i, rowStr, st.align);
    const localCol = col - shift;
    if (localCol < 0 || localCol >= rowStr.length) continue;
    const d = bestColumnShift(rowStr, localCol);
    if (d == null) continue;
    st.rows[i] = rotateRightBy(rowStr, d);
  }
  st.selectedCol = col;
  render();
  saveCache();
}

/* ЗАТЕМНЕНИЕ БИТ, ВЫБРОШЕННЫХ "🎭 МАСКОЙ" (запрос пользователя: "маску показать затемнением бит в
   результатах, а не вырезанием"). Строка результата у всех фаз маски одна и та же, ПОЛНАЯ (см.
   mkResults в fold-3) — гасим в ней те биты, которые в поиск не пошли. Номер фазы берём из имени
   режима строки (data-mode вида "xorAll#м2"), маску — из поля фон-поиска.
   Работаем ПО ГОТОВОЙ РАЗМЕТКЕ, а не при её сборке: биты в результате — обычный текст (свои
   span'ы есть только у витков кольца и служебных пометок), и вклиниваться в сборку значило бы
   тащить смещение через весь конвейер. Оборачиваем ПРОБЕГИ подряд идущих гасимых бит, а не каждый
   символ, — иначе на длинной строке вырастают сотни тысяч узлов; на совсем огромном содержимом не
   трогаем вовсе (лучше без затемнения, чем повесить окно).
   Считаем только символы "0"/"1": разделители витков ("│"), многоточие обрезки и подписи в
   нумерацию бит не входят. */
/* cut=true — не гасить, а ВЫРЕЗАТЬ пропущенные биты: прежний вид маски, оставленный как вариант
   (запрос пользователя "верни как вариант обрезку маску показ"). Панель всегда гасит, режим показа
   переключается в шапке отдельного окна результата (см. popupStyle.maskCut в fold-3). */
const MASK_DIM_CAP = 300000;
function dimMaskedBits(root, doc, cut){
  if (!root) return;
  const mask = (typeof maskBits === "function") ? maskBits() : "";
  if (!mask) return;
  if ((root.textContent || "").length > MASK_DIM_CAP) return;
  const lines = root.querySelectorAll(".chain-result-line[data-mode]");
  for (const line of lines) {
    const m = /#м(\d+)$/.exec(line.getAttribute("data-mode") || "");
    if (!m) continue;
    const phase = (+m[1] - 1) % mask.length;
    const box = line.querySelector(".chain-result-line-bits");
    if (!box) continue;
    const walker = doc.createTreeWalker(box, 4 /* SHOW_TEXT */);
    const texts = [];
    let node;
    while ((node = walker.nextNode())) texts.push(node);
    let bitIdx = 0;
    // ВИТКИ КОЛЬЦА. По умолчанию ("🎭 Маска заново каждый виток", st.bgMaskRingRestart) счёт бит
    // сбрасывается на границе витка: поиск прикладывает маску к САМОЙ строке результата, и только
    // потом повторяет получившееся кольцом, то есть в каждом витке маска начинается со своей фазы.
    // Вести номер сквозняком в этом режиме нельзя — во втором витке погасли бы не те биты, что
    // реально выпали из поиска (когда длина результата не делится на длину маски). Галка снята —
    // маска идёт сквозь витки, и счёт как раз НЕ сбрасывается (там и поиск кладёт её на удвоенную
    // строку, см. mkResult). Виток — это span с классом ring-lap-N (см. buildResultLine), первый
    // виток обёртки не имеет: смена обёртки и есть граница витка.
    const lapRestart = st.bgMaskRingRestart !== false;
    let lapEl = null, lapSeen = false;
    for (const t of texts) {
      if (lapRestart) {
        const parent = t.parentElement;
        const nowLap = (parent && parent.closest) ? parent.closest("span[class*='ring-lap-']") : null;
        if (!lapSeen || nowLap !== lapEl) { bitIdx = 0; lapEl = nowLap; lapSeen = true; }
      }
      const s = t.nodeValue || "";
      const frag = doc.createDocumentFragment();
      let i = 0, changed = false;
      while (i < s.length) {
        const isBit = s[i] === "0" || s[i] === "1";
        // Бит идёт в поиск, если маска на его месте — "1"; служебные символы не считаем и не гасим.
        const off = isBit && mask[(bitIdx + phase) % mask.length] !== "1";
        let j = i, chunk = "";
        while (j < s.length) {
          const bit2 = s[j] === "0" || s[j] === "1";
          const off2 = bit2 && mask[(bitIdx + (j - i) + phase) % mask.length] !== "1";
          if (bit2 !== isBit || off2 !== off) break;
          chunk += s[j];
          j++;
        }
        if (off) {
          // "вырезать" — просто не переносим этот пробег в результат; "затемнить" — оборачиваем.
          if (!cut) {
            const sp = doc.createElement("span");
            sp.className = "mask-off";
            sp.textContent = chunk;
            frag.appendChild(sp);
          }
          changed = true;
        } else {
          frag.appendChild(doc.createTextNode(chunk));
        }
        if (isBit) bitIdx += (j - i);
        i = j;
      }
      if (changed) t.parentNode.replaceChild(frag, t);
    }
  }
}

/* Подсветка столбца ПО НАВЕДЕНИЮ на ячейку линейки (highlightColumn/clearColumnHighlight,
   .col-hover/.col-hover-bit) убрана вместе с выделением столбца кликом по линейке — запрос
   пользователя "убери активацию столбцов по этим элементам, это от старого кода осталось".
   Столбец выбирается кликом по самому биту при "🔢 Выбор столбца" (см. colPickMode), и подсветка
   у него своя — .col-sel-bit по данным, а не по наведению мыши. */

/* Лог находок фон-поиска (см. bgFindLog выше) — своя отдельная вкладка "Лог находок" (см. MENUS),
   а не часть панели "Результат фон-поиска" — запрос пользователя. Пишет прямо в #findLogList,
   последняя находка сверху. Таблица: строка — номер найденной строки, дальше один СТОЛБЕЦ НА
   КАЖДЫЙ РЕЖИМ, который хоть раз встретился в логе (не все 16 возможных сразу — не разрастаться
   вширь без нужды) — "+" (с подсказкой kind'ов) там, где этот режим реально совпал в этой
   находке, иначе пусто — запрос пользователя "распредели по столбцам, где нашлось ставь +,
   где нет — ничего не ставь". */
/* Сортировка "Лога находок" (см. renderFindLogPanel): key — "row" (номер строки), "step" (номер
   шага) или ключ режима (столбец с "+"); dir 1/-1. key=null — исходный порядок, новые сверху.
   Состояние окна, в кэш не пишется — как и сам лог. */
let findLogSort = { key: null, dir: 1 };

function renderFindLogPanel(){
  // Отдельное окно лога (v0.953) наполняется тем же содержимым — вызов в самом начале, чтобы не
  // зависеть от ранних return ниже: окно обновится следующей же перерисовкой.
  setTimeout(() => { if (typeof updateFindLogPopup === "function") updateFindLogPopup(); }, 0);
  // "🧮 Суммы длин" — перенесено сюда из панели "Результат фон-поиска" (запрос пользователя),
  // считается независимо от самого лога находок (не завязано на bgFindLog), поэтому обновляем
  // его ДО ранних return ниже — иначе при пустом логе блок сумм длин молча пропадал бы тоже.
  const lsumEl = document.getElementById("lengthSumsContainer");
  if (lsumEl) {
    // Несколько строк выделено — ориентир самая НИЖНЯЯ (см. seqAnchorIdx(), тот же принцип
    // "самая нижняя выделенная", что и везде в приложении) — запрос пользователя.
    const selIdx = seqAnchorIdx();
    const lengthSumsOn = st.bgSearchModes && st.bgSearchModes.includes("lengthSums");
    lsumEl.innerHTML = (lengthSumsOn && selIdx > 0) ? renderLengthSumsHtml(st, selIdx) : "";
  }

  const el = document.getElementById("findLogList");
  if (!el) return;
  if (!bgFindLog.length) { el.innerHTML = '<span class="empty">находок пока нет</span>'; return; }

  const modesUsed = [];
  for (const e of bgFindLog) for (const mode in e.matches) if (!modesUsed.includes(mode)) modesUsed.push(mode);

  // Сортировка по любому столбцу (см. findLogSort и обработчик клика по шапке): клик — по
  // возрастанию, второй — по убыванию, третий — обратно в исходный порядок (новые находки сверху).
  const sortMark = k => findLogSort.key === k ? (findLogSort.dir > 0 ? " ▲" : " ▼") : "";
  /* КОМПАКТНАЯ ШАПКА ДЛЯ ФАЗ МАСКИ (v0.955, запрос пользователя: "имена столбцов как-то в ширину
     одного символа надо, там же + только, а названия можно общие и номера разные"). С маской
     каждый режим даёт СТОЛЬКО столбцов, сколько в ней бит, и подпись «Скв→#м12» в каждом — это
     метры ширины при одном плюсике в ячейке. Разбираем подпись на общую часть и номер фазы:
     общая уходит в ВЕРХНИЙ ярус шапки одной ячейкой на всю группу, в нижнем остаются номера, а
     столбец сужается до пары символов. Режимы без фаз (маски нет) остаются как были — там общей
     части нет и сжимать нечего. */
  const parsed = modesUsed.map(m => {
    const lbl = bgModeShortLabel(m);
    const p = lbl.indexOf("#м");
    return p >= 0 ? { m, base: lbl.slice(0, p), num: lbl.slice(p + 2) } : { m, base: lbl, num: "" };
  });
  const compact = parsed.some(x => x.num);
  const nw = compact ? " nw" : "";
  let head = "";
  if (compact) {
    // Верхний ярус: подряд идущие столбцы одного режима сливаются в одну ячейку. Ширину задаём
    // инлайном через ту же переменную --flw, что и ширину узкого столбца, — иначе ярусы разъедутся.
    let grp = '<div class="find-log-row find-log-head find-log-grp-row">' +
      '<span class="find-log-cell find-log-row-no"></span><span class="find-log-cell find-log-step"></span>';
    for (let i = 0; i < parsed.length; ) {
      let n = 1;
      while (i + n < parsed.length && parsed[i + n].base === parsed[i].base) n++;
      grp += '<span class="find-log-grp" style="width:calc(var(--flw,1.9em) * ' + n + ')" title="' +
        esc(bgModeLabel(parsed[i].m)) + '">' + esc(parsed[i].base) + '</span>';
      i += n;
    }
    head = grp + '</div>';
  }
  head += '<div class="find-log-row find-log-head">' +
    '<span class="find-log-cell find-log-row-no" data-sort="row" title="Сортировать по номеру строки">стр.' + sortMark("row") + '</span>' +
    '<span class="find-log-cell find-log-step" data-sort="step" title="Номер шага (варианта прокрутки), на котором нашлось. Под «Авто» это тот же счётчик «Вар: N/M», при ручных ◄/► — сколько кликов подряд сделано с момента смены выделения; пусто — находка появилась вне прокрутки. Клик — сортировать по шагу">шаг' + sortMark("step") + '</span>' +
    parsed.map(x => '<span class="find-log-cell find-log-mode' + nw + '" data-sort="' + esc(x.m) + '" title="' +
      esc(bgModeLabel(x.m)) + ' — клик: сначала находки этого режима">' +
      esc(x.num || x.base) + sortMark(x.m) + '</span>').join("") +
  '</div>';

  const entries = bgFindLog.slice();
  if (findLogSort.key) {
    const k = findLogSort.key, d = findLogSort.dir;
    // sort в JS стабильна — записи с одинаковым значением сохраняют исходный порядок (новые сверху).
    entries.sort((a, b) => {
      let va, vb;
      if (k === "row") { va = a.row; vb = b.row; }
      else if (k === "step") { va = a.step || 0; vb = b.step || 0; }
      else { va = a.matches[k] ? 1 : 0; vb = b.matches[k] ? 1 : 0; } // столбец режима: есть "+" или нет
      return va === vb ? 0 : (va - vb) * d;
    });
  }

  const rows = entries.map(e => {
    const cells = modesUsed.map(m => {
      const kinds = e.matches[m];
      // ВАЖНО: тот же класс ширины find-log-mode, что и у заголовка столбца — иначе ячейки данных
      // (3.2em по умолчанию) не совпадают с шапкой (6.2em) и вся таблица разъезжается по столбцам
      // (запрос пользователя "чтоб столбцы были чётко").
      if (!kinds) return '<span class="find-log-cell find-log-mode' + nw + '"></span>';
      // "lengthSums" — записи с label (см. lengthSumsMatchedCombos): показываем САМИ найденные
      // варианты сумм ("1+2+9[Прям],3+8+1[Рев]"), не только kind — запрос пользователя "в лог
      // записать Суммы длин всех найденные варианты сумм".
      const tip = kinds.map(k =>
        (k.label ? k.label + ":" : "") + KIND_LABELS_SHORT[k.kind] + (k.skip ? "⏭" : "")
      ).join(", ");
      return '<span class="find-log-cell find-log-mode find-log-plus' + nw + '" title="' + esc(tip) + '">+</span>';
    }).join("");
    return '<div class="find-log-row"><span class="find-log-cell find-log-row-no">Стр. ' + (e.row + 1) + '</span>' +
      '<span class="find-log-cell find-log-step">' + (e.step ? "№" + e.step : "") + '</span>' + cells + '</div>';
  }).join("");

  el.innerHTML = head + rows;
}

/* "🧮 Суммы длин" — новый инструмент фон-поиска: из каких комбинаций строк можно собрать ДЛИНУ
   ИСКОМОЙ строки (той, чей паттерн ищем — строка СРАЗУ ПОД выделенной, selIdx+1, тот же
   ориентир, что и у остального фон-поиска), напр. длина искомой = 6 → строки "1+6", "2+5",
   "3+4", "1+2+4"... В комбинацию берутся ВСЕ строки ВЫШЕ выделенной И САМА выделенная (не
   только выше, как раньше) — запрос пользователя "сумму делаем для искомой строки для её
   длины, и берем все что выше выделенной и саму выделенную". Перебор подмножеств в худшем
   случае экспоненциальный — останавливаемся, как только набрали LENGTH_SUM_MAX_SETS штук (для
   реальных размеров таблицы этого достаточно, искать AБСОЛЮТНО все подмножества незачем — их и
   так может быть очень много). */
const LENGTH_SUM_MAX_SETS = 30;
const LENGTH_SUM_MAX_COMBOS = 60;
function findLengthSumSubsets(st, selIdx, maxSets){
  // Искомая строка — СЛЕДУЮЩАЯ за выделенной (selIdx+1), её паттерн и пытаемся собрать —
  // см. renderLengthSumsHtml() ниже, тот же ориентир (computeBgSearchTarget: targetIdx=selIdx+1).
  const targetLen = getRowBits(st, selIdx + 1).length;
  if (!targetLen || selIdx <= 0) return [];
  const candidates = [];
  // Строка 0 в комбинации НЕ участвует вообще (запрос пользователя) — начинаем с i=1, не с i=0.
  // Но САМА выделенная (selIdx) теперь ТОЖЕ кандидат (запрос пользователя), поэтому i<=selIdx,
  // не i<selIdx. Длины — реальные (getRowBits().length, а не что-то кэшированное/из паттерна).
  for (let i = 1; i <= selIdx; i++) {
    const l = getRowBits(st, i).length;
    if (l > 0 && l <= targetLen) candidates.push(i);
  }
  // Длины кандидатов считаем ОДИН раз: getRowBits() вызывался внутри DFS на КАЖДОМ узле перебора.
  const candLen = candidates.map(idx => getRowBits(st, idx).length);
  const results = [];
  /* ЗАЩИТА ОТ ЗАВИСАНИЯ. Раньше перебор ограничивался ТОЛЬКО числом НАЙДЕННЫХ комбинаций
     (maxSets). Но если нужная сумма не набирается вовсе (или набирается редко), выход по этому
     условию не срабатывает никогда, и DFS честно обходит всё дерево подмножеств — 2^N ветвей по
     числу строк-кандидатов. При нескольких десятках строк это миллиарды узлов, а
     renderLengthSumsHtml() зовётся из КАЖДОГО render() — вкладка вставала намертво, кнопки
     переставали нажиматься. Потолок на число посещённых узлов делает перебор конечным при любых
     данных: в худшем случае список комбинаций окажется неполным, но интерфейс жив. */
  let nodes = 0;
  const NODE_BUDGET = 200000;
  // Одна и та же ДЛИНА в комбинации дважды не допускается (даже если это две РАЗНЫЕ строки
  // одинаковой длины) — напр. "3+3+1" не считается вариантом суммы — запрос пользователя.
  function dfs(pos, remaining, chosen, usedLens){
    if (results.length >= maxSets || nodes >= NODE_BUDGET) return;
    nodes++;
    if (remaining === 0 && chosen.length > 0) { results.push(chosen.slice()); return; }
    for (let p = pos; p < candidates.length; p++){
      const l = candLen[p];
      if (l > remaining || usedLens.has(l)) continue;
      chosen.push(candidates[p]);
      usedLens.add(l);
      dfs(p + 1, remaining - l, chosen, usedLens);
      usedLens.delete(l);
      chosen.pop();
      if (results.length >= maxSets || nodes >= NODE_BUDGET) return;
    }
  }
  dfs(0, targetLen, [], new Set());
  // "Простые" (короткие, из МЕНЬШЕГО числа слагаемых) суммы — наверх списка, длинные комбинации
  // ниже — запрос пользователя. DFS выше находит их вперемешку (сначала уходит вглубь, т.е.
  // длинные комбинации раньше коротких), поэтому досортировываем уже готовый список по числу
  // слагаемых (stable sort — порядок ВНУТРИ одинаковой длины, как нашёл DFS, не трогаем).
  results.sort((a, b) => a.length - b.length);
  return results;
}
/* Перебирает ВСЕ перестановки arr (не только "по возрастанию номера"), вызывая cb(perm) на
   каждой — cb возвращает false, чтобы остановить перебор раньше. Порядок строк в сумме МЕНЯЕТ
   итоговую склеенную строку (row1+row3 ≠ row3+row1), а паттерн может совпасть только в одном
   конкретном порядке — запрос пользователя ("показать все варианты перестановки слагаемых и
   искать в них"), одного возрастающего порядка недостаточно. */
function permuteEach(arr, cb){
  const n = arr.length;
  const used = new Array(n).fill(false);
  const perm = [];
  let stop = false;
  function go(){
    if (stop) return;
    if (perm.length === n) { if (cb(perm.slice()) === false) stop = true; return; }
    for (let i = 0; i < n; i++){
      if (used[i]) continue;
      used[i] = true; perm.push(arr[i]);
      go();
      perm.pop(); used[i] = false;
      if (stop) return;
    }
  }
  go();
}
/* Сами КОМБИНАЦИИ для показа — сначала находим подмножества (см. findLengthSumSubsets, либо
   переиспользуем уже готовые — необязательный 4-й параметр subsets, см. renderLengthSumsHtml,
   чтобы не гонять DFS дважды за один рендер), потом разворачиваем КАЖДОЕ в ВСЕ его перестановки,
   пока не наберём maxCombos штук суммарно по всем подмножествам разом (перестановок у одного
   подмножества размера k может быть k! — на 7+ строках в комбинации это уже тысячи, поэтому
   общий потолок один на всех, а не на каждое подмножество отдельно). */
function findLengthSumCombos(st, selIdx, maxCombos, subsets){
  subsets = subsets || findLengthSumSubsets(st, selIdx, LENGTH_SUM_MAX_SETS);
  const results = [];
  for (const subset of subsets) {
    if (results.length >= maxCombos) break;
    permuteEach(subset, (perm) => {
      results.push(perm);
      return results.length < maxCombos;
    });
  }
  return results;
}
function factorial(n){ let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; }
/* Точное число ВСЕХ возможных вариантов сумм (каждое подмножество × все его перестановки), а не
   только тех, что реально показаны (см. LENGTH_SUM_MAX_COMBOS) — запрос пользователя "показать
   число всех возможных вариантов". Самих ПОДМНОЖЕСТВ обычно немного даже без потолка (в отличие
   от их перестановок — там k! на каждое, вот ЭТО могло бы взорваться), поэтому считаем БЕЗ
   LENGTH_SUM_MAX_SETS (только защитный LENGTH_SUM_COUNT_CAP на случай патологии), а сами
   перестановки не генерируем — суммируем только их КОЛИЧЕСТВО (k!) на подмножество. Необязательный
   4-й параметр subsets — то же переиспользование, что и у findLengthSumCombos выше. */
const LENGTH_SUM_COUNT_CAP = 2000;
function countLengthSumTotalVariants(st, selIdx, subsets){
  subsets = subsets || findLengthSumSubsets(st, selIdx, LENGTH_SUM_COUNT_CAP);
  let total = 0;
  for (const s of subsets) total += factorial(s.length);
  return { total, cappedSubsets: subsets.length >= LENGTH_SUM_COUNT_CAP };
}
/* Палитра для подсветки "какой кусок из какой строки" в комбинации — циклится, если строк в
   комбинации больше, чем цветов (запрос пользователя — "отделить символы только цветом", без
   скобок/разделителей). */
const LSUM_COLORS = ["lsum-c0", "lsum-c1", "lsum-c2", "lsum-c3", "lsum-c4", "lsum-c5"];
function renderLengthSumsHtml(st, selIdx){
  // Подмножества считаем ОДИН раз (с бо́льшим, "счётным" потолком) и переиспользуем и для показа
  // комбинаций, и для точного числа всех вариантов — иначе DFS гонялась бы дважды за рендер.
  const subsets = findLengthSumSubsets(st, selIdx, LENGTH_SUM_COUNT_CAP);
  if (!subsets.length) return "";
  const combos = findLengthSumCombos(st, selIdx, LENGTH_SUM_MAX_COMBOS, subsets);
  if (!combos.length) return "";
  // Искомый паттерн — тот же, что и у остального фон-поиска: строка СРАЗУ ПОД выделенной (см.
  // computeBgSearchTarget: targetIdx = selIdx+1). Поиск КОЛЬЦЕВОЙ (findPatternKinds — как и
  // основной findMatch()), не обычный indexOf — запрос пользователя "ищем кольцевым поиском":
  // паттерн, "переезжающий" через конец собранной строки обратно в начало, тоже засчитывается.
  // buildHitMap раскладывает найденные kind'ы по позициям, чтобы подсветить САМ найденный
  // паттерн внутри собранных бит (.chain-hit-bits), а не только обвести всю строку рамкой.
  const nextPat = st.pats[selIdx + 1];
  const patText = nextPat && nextPat.text ? nextPat.text : "";
  // Ширина колонки label — под САМУЮ ДЛИННУЮ подпись из ТЕКУЩЕГО списка (не жёсткий CSS
  // min-width, который был мал для длинных "5+4+1+2" и слишком широк для коротких "1+9" —
  // из-за этого биты у разных строк начинались в разных местах, "рваным" левым краем) —
  // запрос пользователя "выровняй биты". "ch" — ширина символа "0" в текущем шрифте label'а.
  const maxLabelLen = Math.max(...combos.map(combo => combo.join("+").length));
  const labelStyle = 'style="min-width:' + (maxLabelLen + 0.5) + 'ch"';
  const lines = combos.map(combo => {
    const label = combo.join("+");
    let plain = "";
    combo.forEach(idx => { plain += getRowBits(st, idx); });
    const kinds = patText ? findPatternKinds(plain, patText) : [];
    const matched = kinds.length > 0;
    const hitAt = buildHitMap(plain.length, kinds);
    let bits = "";
    let pos = 0;
    combo.forEach((idx, ci) => {
      const s = getRowBits(st, idx);
      const cls = LSUM_COLORS[ci % LSUM_COLORS.length];
      for (const ch of s) {
        const clsList = [cls];
        const hit = hitAt[pos++];
        if (hit) { clsList.push('chain-hit-bits'); if (KIND_CLS[hit.kind]) clsList.push(KIND_CLS[hit.kind]); if (hit.skip) clsList.push('skip1'); }
        bits += '<span class="' + clsList.join(" ") + '">' + esc(ch) + '</span>';
      }
    });
    return '<div class="lsum-row' + (matched ? ' lsum-matched' : '') + '" title="Строки ' + esc(label) + (matched ? ' — совпадает с искомым паттерном (кольцевой поиск)' : '') + '">' +
      '<span class="lsum-label" ' + labelStyle + '>' + esc(label) + '</span>' +
      '<span class="lsum-bits">' + bits + '</span>' +
    '</div>';
  }).join("");
  // Паттерн — ПЕРВОЙ строкой над самими суммами, БИТ В БИТ выровненный с ними (та же разметка
  // .lsum-row/.lsum-label/.lsum-bits, что и у строк-комбинаций — label пустой, но той же ширины
  // labelStyle, чтобы битовая колонка паттерна начиналась РОВНО там же, где начинаются биты
  // сумм ниже) — запрос пользователя "искомый паттерн прямо над суммами бит в бит" (раньше был
  // отдельной строкой без выравнивания с колонкой бит). Плюс число ВСЕХ возможных вариантов —
  // запрос пользователя "показать число всех возможных вариантов".
  const totalInfo = countLengthSumTotalVariants(st, selIdx, subsets);
  const totalLabel = totalInfo.total + (totalInfo.cappedSubsets ? "+" : "");
  const shownLabel = combos.length < totalInfo.total ? ("показано " + combos.length + " из " + totalLabel) : ("" + totalLabel);
  // Заголовок ("🧮 Сумма длин — вариантов: N") — ПЕРЕД паттерном, а не МЕЖДУ паттерном и суммами:
  // паттерн должен идти вплотную к суммам ниже (та же разметка/шрифт, бит в бит), чтобы сразу
  // сравнивать глазами — запрос пользователя "прям первой строкой [перед суммами] запиши
  // паттерн, тем же шрифтом биты над битами".
  const patternRow = '<div class="lsum-row lsum-pattern-row" title="Искомый паттерн">' +
    '<span class="lsum-label" ' + labelStyle + '></span>' +
    '<span class="lsum-bits lsum-pattern-bits">' + esc(patText) + '</span>' +
  '</div>';
  return '<div class="lsum-block">' +
    '<div class="lsum-title">🧮 Сумма длин — вариантов: ' + shownLabel + '</div>' +
    patternRow +
    lines +
  '</div>';
}

/* ── КЭШ ДОРОГИХ МАСОК ПОДСВЕТКИ ──────────────────────────────────────────────────────────
   render() зовётся на ЛЮБОЕ действие — в том числе на те, что данных не меняют вовсе: клик по
   строке, смена выравнивания, переключение вкладки настроек, наведение мыши. А маски подсветки
   пересчитывались каждый раз с нуля: "1 под 1" и "1 по диагонали" — по всей картинке, маска "01" —
   по каждой строке, а построчный поиск Паттерн-цепочки гонял findPatternKinds() по КАЖДОЙ строке.
   На 1000 строк это самая тяжёлая часть кадра — и почти всегда ради ровно того же результата, что
   и в прошлый раз.
   Сравниваем ВХОДЫ и, если они не разошлись, отдаём прошлый результат. Именно входы, а не "флаг,
   что что-то поменялось": так кэш не может разъехаться с данными — разошлось хоть что-то, и он
   просто не сработает, а не покажет старое.
   ЧЕМ ЭТО ОБОСНОВАНО: computeVertOnesMask/computeDiagOnesMask/computeDiagOnesMaskSectioned не
   читают st ВООБЩЕ — это чистые функции своих аргументов, поэтому их входы и есть их аргументы.
   compute01HighlightMask — чистая функция одной строки. А findPatternKinds() лезет в st за
   настройками поиска (allKinds/bgSubPatterns/ringOff/skipFirst, и через ringCycle → ringNextLap
   ещё ringInvert/ringReverse) — все они перечислены в зависимостях ЯВНО там, где вызываются.
   ЕСЛИ ПОЯВИТСЯ НОВАЯ НАСТРОЙКА ПОИСКА — её нужно дописать в тот список, иначе подсветка
   Паттерн-цепочки залипнет на старой. Сам поиск (computeBgSearchTarget и всё, что он зовёт) тут
   не кэшируется вообще и работает как работал. */
/* ЗАЩЁЛКА НАХОДОК НА ВРЕМЯ "🚀 Авто" (запрос пользователя): паттерн, найденный за прогон, остаётся
   отмеченным в КОЛОНКЕ ПАТТЕРНОВ до ⏹ Стопа или Сброса и больше не ищется — ни в строках, ни в
   результатах фон-поиска. Иначе метка гасла на следующем же шаге: сдвиг уводил биты, паттерна в
   новом состоянии уже не было, и увидеть, что он вообще находился, было нечем.
   Подсветка самих БИТ не защёлкивается — они на каждом шаге другие, и держать на них старую
   раскраску было бы враньём: остаётся только отметка в колонке. Ключ — номер паттерна. */
var allPatLatch = new Map();
var maskMemo = new Map(); // имя → {deps, val}
function memoDepsSame(a, b){
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i], y = b[i];
    if (Array.isArray(x)) {
      if (!Array.isArray(y) || x.length !== y.length) return false;
      // Строки в st.rows между рендерами — обычно ТЕ ЖЕ САМЫЕ объекты, поэтому сравнение тысячи
      // элементов упирается в сравнение указателей и почти ничего не стоит.
      for (let j = 0; j < x.length; j++) if (x[j] !== y[j]) return false;
    } else if (x !== y) return false;
  }
  return true;
}
function memoMask(name, deps, compute){
  const prev = maskMemo.get(name);
  if (prev && memoDepsSame(prev.deps, deps)) return prev.val;
  const val = compute();
  // Массивы-зависимости кладём КОПИЕЙ. Иначе сюда попала бы ссылка на тот же самый st.rows,
  // который меняют НА МЕСТЕ — и в следующий раз мы сравнивали бы массив сам с собой, всегда
  // получали "не изменилось" и отдавали протухшую маску.
  maskMemo.set(name, { deps: deps.map(d => Array.isArray(d) ? d.slice() : d), val });
  return val;
}
/* Маска "01" — своя на КАЖДУЮ строку, поэтому и кэш построчный: пересчитывается только та строка,
   которая реально изменилась, остальные берутся готовыми. Ключ — сама строка (она неизменяемая,
   так что сравнение по значению тут безопасно). */
var hl01Cache = { src: [], masks: [] };
function hl01MaskFor(i, s){
  if (hl01Cache.src[i] === s) return hl01Cache.masks[i];
  const m = compute01HighlightMask(s);
  hl01Cache.src[i] = s;
  hl01Cache.masks[i] = m;
  return m;
}

/* ── ВИРТУАЛИЗАЦИЯ СТРОК ──────────────────────────────────────────────────────────────────
   Держим в DOM только те строки, которые сейчас видно, плюс запас сверху и снизу; всё остальное
   заменяют две распорки (.vspacer) нужной высоты. Полоса прокрутки и позиция каждой строки при
   этом ровно те же, что при полной отрисовке, — а узлов в DOM вместо тысячи строк остаётся
   несколько десятков.
   ПОЧЕМУ ЭТО ЗАКОННО, два условия, оба проверены по коду:
   1) Высота строки ФИКСИРОВАНА: .ln{height:var(--row-h)}, а глобальный *{box-sizing:border-box}
      прячет внутрь неё и рамку "разделителя строк" (.ln.row-divider). Значит шаг строки — ровно
      --row-h, и позиция строки это idx * шаг, безо всяких замеров.
   2) В цикле рендера строк НЕТ накопителей: каждая строка считается только из себя, своего номера
      и данных, общих на весь рендер (hxChainLenAll и прочее посчитаны ДО цикла как const). Поэтому
      любой поддиапазон строк рисуется ровно так же, как рисовался бы в полном проходе.
   Прокручиваемый контейнер — .canvas (#screenCanvas), а НЕ .chain: у .chain overflow:visible. */
var VROWS_OVERSCAN = 16; // запас строк сверху/снизу: при обычной прокрутке колесом строка успевает
                         // быть нарисованной до того, как её станет видно
var VROWS_MIN = 300;     // меньше этого числа строк не виртуализируем вовсе — выигрыша нет, а
                         // лишняя ветка в пути рендера это лишний источник расхождений
var vrowsWindow = { lo: 0, hi: -1 }; // что сейчас реально лежит в DOM
function vrowsPitchPx(){
  const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--row-h"));
  return v > 0 ? v : 12;
}
/* Диапазон строк, который должен сейчас быть в DOM. pad — запас с каждой стороны. */
function vrowsRange(total, pad){
  const pitch = vrowsPitchPx();
  if (total < VROWS_MIN) return { lo: 0, hi: total - 1, pitch, on: false };
  const host = document.getElementById("rows");
  const sc = document.getElementById("screenCanvas");
  if (!host || !sc || !sc.clientHeight) return { lo: 0, hi: total - 1, pitch, on: false };
  // Верх поля строк в системе координат ПРОКРУЧИВАЕМОГО СОДЕРЖИМОГО. Через rect, а не offsetTop:
  // offsetTop считается от ближайшего позиционированного предка, а между #rows и .canvas стоит
  // .chain со своим position:relative — цепочку пришлось бы складывать руками.
  const rowsTop = host.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop;
  const viewTop = sc.scrollTop - rowsTop;
  let lo = Math.floor(viewTop / pitch) - pad;
  let hi = Math.ceil((viewTop + sc.clientHeight) / pitch) + pad;
  if (lo < 0) lo = 0;
  if (lo > total - 1) lo = Math.max(0, total - 1); // прокрутили ниже последней строки
  if (hi > total - 1) hi = total - 1;
  if (hi < lo) hi = lo;
  return { lo, hi, pitch, on: true };
}
/* Прокрутка к строке по НОМЕРУ, без обращения к её элементу. При виртуализации нужной строки в DOM
   может не быть вовсе, и прежний querySelector('.ln[data-idx=...]') + scrollIntoView просто тихо
   не сработал бы — то есть "нашлось, но не перепрыгнуло". Считаем позицию арифметикой; это ещё и
   надёжнее прежнего варианта. Поведение block:"nearest" повторяем вручную: строка видна целиком —
   не двигаем ничего. */
function scrollToRow(idx){
  const sc = document.getElementById("screenCanvas");
  const host = document.getElementById("rows");
  if (!sc || !host || !(idx >= 0)) return;
  const pitch = vrowsPitchPx();
  const rowsTop = host.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop;
  const top = rowsTop + idx * pitch, bottom = top + pitch;
  // Верхняя полоса полотна закрыта закреплёнными оверлеями ("Результат" + "Черновик шага", их
  // суммарная высота лежит в --result-box-h, см. OVERLAY_STACK). Считаем её занятой: иначе переход
  // к найденной строке аккуратно подводил бы её ровно ПОД эти окна, и на экране её не было бы.
  const overlayPx = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--result-box-h")) || 0;
  const viewTop = sc.scrollTop + overlayPx, viewBottom = sc.scrollTop + sc.clientHeight;
  let next = null;
  if (top < viewTop) next = top - overlayPx;
  else if (bottom > viewBottom) next = bottom - sc.clientHeight;
  if (next === null) return;
  sc.scrollTop = Math.max(0, next);
  // Окно строк переехало — пересобираем сразу, чтобы строка уже лежала в DOM для того, кто её
  // сейчас будет искать (например, для перехода в ручное редактирование).
  vrowsScrollOnly = true;
  try { render(); } finally { vrowsScrollOnly = false; }
}
/* Перерисовка при прокрутке. Не на каждое событие, а раз на кадр, и только когда видимая область
   реально подошла к краю уже нарисованного запаса — иначе колесо гоняло бы render() на каждый
   кадр впустую.
   vrowsScrollOnly — признак "этот render() вызван ТОЛЬКО прокруткой". Прокрутка не меняет в st
   ничего, поэтому при ней можно переиспользовать результат фон-поиска с прошлого полного рендера
   (см. bgInfo в render()) вместо того, чтобы гонять его заново на каждый кадр прокрутки. Любое
   настоящее изменение идёт через обычный render(), где флаг снят и поиск считается как всегда. */
var vrowsScrollOnly = false;
var vrowsPending = false;
var bgInfoLast;  // результат фон-поиска с последнего ПОЛНОГО рендера (см. bgInfo в render())
function vrowsOnScroll(){
  if (vrowsPending) return;
  vrowsPending = true;
  requestAnimationFrame(() => {
    vrowsPending = false;
    const total = Math.max(st.rows.length, st.pats.length);
    const vis = vrowsRange(total, 2); // без запаса: только то, что вот-вот покажется
    if (!vis.on) return;
    if (vis.lo >= vrowsWindow.lo && vis.hi <= vrowsWindow.hi) return; // всё ещё внутри запаса
    vrowsScrollOnly = true;
    try { render(); } finally { vrowsScrollOnly = false; }
  });
}
(function bindVrowsScroll(){
  const sc = document.getElementById("screenCanvas");
  if (sc) sc.addEventListener("scroll", vrowsOnScroll, { passive: true });
})();

function render(){
  renderTabs(); // <-- ЭТО ТА САМАЯ СТРОКА, КОТОРУЮ Я ЗАБЫЛ В ПРОШЛЫЙ РАЗ!
  // Показ диагонали "Конверта" живёт только пока не тронули выделение/выравнивание/длины строк.
  if (envPreview && envPreview.key !== envPreviewKey()) envPreview = null;
  document.getElementById("stepNo").textContent = st.step;

  // ПУСТОЕ выделение здесь БОЛЬШЕ НЕ ЧИНИТСЯ. Раньше тут стояла гарантия "выделение никогда не
  // пусто" (добавляла первую строку с данными) — из-за неё повторный клик по уже выделенной
  // строке визуально не снимал выделение, а ПЕРЕПРЫГИВАЛ на первую строку: обработчик клика
  // честно очищал набор, а следующий же render() тут же клал туда firstDataIdx(). Запрос
  // пользователя — "пусть просто снимает выделение". Та же гарантия при СТАРТЕ/переключении
  // вкладки осталась на месте (см. resetAll()/loadTabState) — там пустое выделение и правда
  // выглядело бы как потерянное состояние, в отличие от явного клика пользователя.
  if (!st.selectedRows) st.selectedRows = new Set();

  let maxLen = 0;
  for (const s of st.rows) if (s.length > maxLen) maxLen = s.length;
  // "⊙ Оси по битам" — пересобрать группы осей, если набор выбранных ячеек (или выравнивание)
  // изменился с прошлого кадра (см. bitAxesRefresh). Дешёвая проверка по сигнатуре набора.
  if (typeof bitAxesRefresh === "function") bitAxesRefresh();
  // ВАЖНО: maxLen (длина самой длинной строки) остаётся точкой отсчёта для alignShift/rowShiftFor —
  // менять его нельзя, иначе поедет вся геометрия выравниваний. Ширина КАРТИНКИ (линейка столбцов
  // + добивка пробелами справа) считается отдельно — см. visibleColCount().

  // Ось цепочек не выпускаем за колонки паттернов (см. clampAxisOffset). Зажим стоит ЗДЕСЬ, до
  // renderColHeader и до цикла строк: и линейка столбцов, и сам сдвиг строк (extraCh) читают
  // st.axisCenterOffset ниже, и поправить его после них значило бы кадр рассинхрона. Заодно это
  // чинит уже сохранённое в кэше значение вне границ и случай, когда поле битов сузили руками.
  // Строки стали длиннее/короче — ось остаётся на своём столбце, а не едет вместе с серединой
  // картинки (см. holdAxisOnMaxLenChange). Обязательно ДО зажима: держим сначала, придерживаем потом.
  holdAxisOnMaxLenChange(maxLen);
  st.axisCenterOffset = clampAxisOffset(st.axisCenterOffset || 0, maxLen);
  // Зажим мог подвинуть сдвиг — закрепляем за осью уже НОВЫЙ столбец, иначе следующий кадр
  // вернул бы её обратно за край и они бы так и дёргали друг друга.
  if (axisPinCol != null && st.align !== "axisbit" && st.align !== "axisbit12") {
    axisPinCol = axisBaseCol() + (st.axisCenterOffset || 0);
  }

  // ...и НИКОГДА не даём самой картинке уехать левее нулевого столбца, под колонки паттернов
  // (запрос пользователя: "ось на месте, но реально биты уехали влево за паттерны"). Причина
  // ровно в удержании: ось стоит на своём столбце, строки растут — и растут они В ОБЕ стороны от
  // оси, так что левый край рано или поздно уходит за край полотна. Тут удержание УСТУПАЕТ:
  // лучше пусть ось сдвинется вправо, чем биты спрячутся под паттернами. Считается по самому
  // левому краю среди всех строк, то есть по реальной геометрии текущего выравнивания.
  // Считается для ЛЮБОГО выравнивания, а не только для осевой пары: влево строка уезжает и в
  // "ОсьБит" (там сдвиг строки живёт в своей карте и спокойно уходит в минус), и в "Лесенке
  // правой" (у неё сдвиг отрицателен уже по формуле). Раньше зажим стоял только на "⊙ Ось"/
  // "Ось 1.2", и в остальных режимах биты по-прежнему уползали за левый край, пока ось стояла на
  // месте (запрос пользователя). Относительная геометрия при этом не трогается вовсе — вся
  // картинка целиком подаётся вправо ровно настолько, чтобы её левый край сел на нулевой столбец.
  // Предел — ПЕРВЫЙ БИТ ПЕРВОЙ СТРОКИ (запрос пользователя: "пусть уходят, но до первого бита
  // первой строки максимум"). Остальные строки левее него уходить МОГУТ и прячутся под колонками
  // паттернов — это разрешено; держим только первую, чтобы у картинки всегда оставалась видимая
  // точка отсчёта. По ней же стоит и линия оси в неосевых выравниваниях, так что предел и ось
  // читаются как одно и то же место. Считается по одной строке — прохода по всей цепочке нет.
  {
    const fd0 = firstRealRowIdx();
    if (fd0 >= 0) {
      const base0 = rowShiftFor(maxLen, fd0, st.rows[fd0] || "", st.align);
      // Предел считаем с той же поправкой на промах формулы, что и clampAxisOffset (см.
      // axisDrawFixCols): без неё этот зажим тут же возвращал бы ось обратно и съедал весь
      // выигрыш — ручка снова останавливалась бы, не дойдя до колонки паттернов.
      const lim0 = Math.floor(-base0 - axisDrawFixCols());
      if ((st.axisCenterOffset || 0) < lim0) {
        st.axisCenterOffset = lim0;
        axisPinCol = axisBaseCol() + st.axisCenterOffset;
      }
    }
  }



  // МЕСТО ПОД ЗЕРКАЛА (запрос пользователя: "обрезает по длине широкой строки — надо расширить
  // запись"). Полотно расширяется на самое длинное зеркало слева и справа, и ровно на столько же
  // растёт левый отступ КАЖДОЙ строки. Прибавка одинаковая для всех, поэтому выравнивание не
  // меняется вовсе — картинка просто целиком встаёт правее, а линейка столбцов едет вместе с ней
  // тем же сдвигом (см. renderColHeader ниже). Именно попытка двигать строки ПООТДЕЛЬНОСТИ и ломала
  // центр в прошлой версии.
  const mirrorToRow = mirrorBoundRow();
  let mirrorPadL = 0, mirrorPadR = 0;
  if (st.mirrorShiftAsIf && mirrorToRow >= 0 && (st.leftMirror || st.rightMirror)) {
    for (let r = mirrorTopRow(); r <= mirrorToRow && r < st.rows.length; r++) {
      const L = (st.rows[r] || "").length;
      if (L < 2) continue;
      if (st.leftMirror && L - 1 > mirrorPadL) mirrorPadL = L - 1;
      if (st.rightMirror && L - 1 > mirrorPadR) mirrorPadR = L - 1;
    }
  }
  const renderWidth = visibleColCount(maxLen) + mirrorPadL + mirrorPadR;
  renderColHeader(renderWidth, mirrorPadL);

  // Реальный шаг столбца в px — запрос пользователя "ручка #axisSplit должна двигать ВСЁ, кроме
  // паттернов, а то что наезжает на паттерны — просто прячется за ними, БЕЗ перекоса". Раньше
  // "довесок" за пределы обычного посимвольного паддинга (extraCh, см. halfShiftAttr ниже —
  // отрицательный shift/половинки символа у halfcenter и т.п.) рисовался через CSS-юнит "ch" —
  // ширину ТОЛЬКО глифа "0", БЕЗ letter-spacing. А сам текст строки — обычные inline-span'ы
  // внутри одного span'а (не flex-items), поэтому letter-spacing МЕЖДУ ними реально участвует в
  // раскладке. При --chain-ls != 0 (запрос пользователя, скрин: chPx=3.2, letter-spacing=-4px)
  // "ch"-transform и посимвольный паддинг расходились на letter-spacing НА КАЖДЫЙ символ
  // довеска — расхождение росло с величиной сдвига и на глаз выглядело как диагональ. Меряем тем
  // же приёмом, что и applySquareCellLs() (canvas.measureText того же шрифта/размера) + сам
  // letter-spacing — это и есть настоящий шаг столбца внутри .bits. axisCharWidthPx() (ширина
  // .col-cell) для этого не годится: линейка столбцов — display:flex, а letter-spacing на
  // flex-item'ы не действует (он только для inline-текста), поэтому её ширина систематически не
  // совпадает с реальным шагом столбца в строках, когда letter-spacing != 0.
  const colStepPx = realColStepPx();

  // "🎭 Маска": красная подсветка изменённых ею бит держится, ПОКА не изменится любой бит в любой
  // строке (запрос пользователя). Сравниваем текущие строки со снимком, сделанным сразу после
  // наложения маски: разошлись — подсветку снимаем целиком.
  if (maskChangedMap.size && maskBaseRows) {
    let same = maskBaseRows.length === st.rows.length;
    if (same) for (let r = 0; r < st.rows.length; r++) {
      if ((st.rows[r] || "") !== (maskBaseRows[r] || "")) { same = false; break; }
    }
    if (!same) { maskChangedMap.clear(); maskBaseRows = null; }
  }
  // Кнопкой 🎨 погашена и штатная подсветка "изменён последним шагом" (см. chgColorOffRows):
  // действует, пока строки не изменятся, дальше сама снимается.
  let showChgBits = chgBitsOn; // общий выключатель "🔴 Изм. биты" (вкладка "Вид")
  if (showChgBits && chgColorOffRows) {
    let same = chgColorOffRows.length === st.rows.length;
    if (same) for (let r = 0; r < st.rows.length; r++) {
      if ((st.rows[r] || "") !== (chgColorOffRows[r] || "")) { same = false; break; }
    }
    if (same) showChgBits = false; else chgColorOffRows = null;
  }

  const hl = new Map();
  if (st.hit) for (const c of st.hit.cells){
    if (!hl.has(c.r)) hl.set(c.r, new Set());
    hl.get(c.r).add(c.p);
  }
  const hitCls = st.hit ? ("hit " + KIND_CLS[st.hit.kind]) : "hit";

  // Фон-поиск считается как считался — КРОМЕ одного случая: когда render() вызван исключительно
  // прокруткой (vrowsScrollOnly, см. vrowsOnScroll). Прокрутка не меняет в st ровно ничего, так что
  // результат прошлого раза там заведомо тот же самый; а гонять поиск по всей склейке строк на
  // каждый кадр прокрутки — самое дорогое, что тут можно сделать. Любое настоящее изменение идёт
  // обычным render(), где флаг снят и поиск выполняется полностью, как всегда.
  const bgInfo = (vrowsScrollOnly && bgInfoLast !== undefined) ? bgInfoLast : computeBgSearchTarget();
  bgInfoLast = bgInfo;
  const bgTargetIdx = bgInfo ? bgInfo.targetIdx : null;
  const bgMatched = !!(bgInfo && bgInfo.matched);

  // "🌈 Все паттерны": какие паттерны нашлись в этом рендере (по всем включённым режимам
  // сразу) — их ячейки в колонке паттернов красятся тем же цветом, что и сама находка в строке
  // результата (запрос пользователя "подсветить все найденные разным цветом и там, и там").
  let allPatHits = null;
  if (allPatsShown() && bgInfo && bgInfo.results) {
    // Подсветка НЕ ЗАВИСИТ от того, где стоит выделение (запрос пользователя). Раньше тут стояла
    // отсечка "h.patIdx > lastActive — пропустить", из-за которой найденное переставало светиться,
    // стоило выделению уехать выше. Отключённые галками "⛔" строки по-прежнему не подсвечиваются:
    // их паттерны и не ищутся — см. lastRow в findAllPatternsInResult.
    /* ОБЛАСТЬ ПОИСКА "🔎 до паттерна" (st.allPatScopeSel) действует и ЗДЕСЬ — запрос пользователя:
       "паттерн не должен находиться в сквозной и других фон-поисках, если она составлена из его
       строки или ниже, если только не включена «вся цепочка»".
       Раньше этот фильтр стоял только на находках ПРЯМО В СТРОКАХ цепочки (allPatSelfHits ниже),
       а результаты режимов шли без него. Между тем склейки, XOR и интерлив строятся из строк ДО
       chainIdx включительно — значит паттерн любой строки внутри этого диапазона лежит в
       результате просто потому, что там лежат её собственные биты. Паттерн находил сам себя, и
       такая находка ничего не значит.
       Порог — САМАЯ НИЖНЯЯ строка, попавшая в расчёт: у режимов-цепочек это chainIdx, у парных
       (Интерлив, Xor 2) — нижняя строка пары. Берём больший из двух, чтобы не разбирать режимы
       поимённо: лишнего не отбросим, потому что обычно они совпадают.
       На ОБЫЧНЫЙ фон-поиск это не влияет вовсе: его цель — строка ПОД выделенной, она и так ниже
       порога. Режется ровно то, что просили, — самонаходки внутри цепочки. */
    const bgDeepRow = Math.max(bgInfo.chainIdx | 0, bgInfo.selIdx | 0);
    for (const r of bgInfo.results) {
      if (!r.allHits) continue;
      for (const h of r.allHits) {
        if (st.allPatScopeSel && h.patIdx <= bgDeepRow) continue;
        if (!allPatHits) allPatHits = new Map();
        if (!allPatHits.has(h.patIdx)) allPatHits.set(h.patIdx, { kind: h.kind, mode: r.mode, patStart: h.patStart, patLen: h.patLen });
      }
    }
  }

  // "🌈 Все паттерны" — найденные паттерны подсвечиваются ПРЯМО В СТРОКАХ, и делается это
  // НЕЗАВИСИМО ОТ ФОН-ПОИСКА (запрос пользователя: "по умолчанию, даже если фон-поиск отключён").
  // Раньше подсветка бралась из bgInfo.results, а значит требовала и включённых режимов фон-поиска,
  // и выделенной строки: выключил поиск — пропала и подсветка. Теперь это отдельный, ни от чего не
  // зависящий путь: ищем в СКВОЗНОЙ склейке всех строк сверху вниз и раскладываем позиции обратно
  // на строки. Отсюда и разрыв: паттерн, лежащий НА СТЫКЕ (хвост одной строки + начало следующей),
  // подсвечивается в обеих — целиком его нет ни в одной, и построчный поиск такого не нашёл бы.
  // Через кэш (см. memoMask) — склейка тут строится по всем данным сразу, гонять её на каждый
  // рендер незачем. В зависимостях перечислено всё, что читает findAllPatternsInResult: тексты
  // паттернов (сами объекты st.pats меняют на месте, поэтому именно тексты), настройки кольца и
  // разбора, "🔁 Все вхождения", выделение паттернов и отсечка "⛔" нижних строк.
  // Прогон кончился (⏹ Стоп, Сброс, обычная остановка) — защёлка находок снимается, и всё снова
  // ищется как обычно. Стоит ДО поиска: иначе этот же кадр отрисовался бы ещё со старыми метками.
  if (!st.running && allPatLatch.size) allPatLatch.clear();
  let allPatRows = null, allPatSelfHits = null;

  if (allPatsShown()) {
    const self = memoMask("allPatSelf",
      [st.rows, st.pats.map(p => (p && p.text) || ""), st.skipFirst, st.skipLast, st.allKinds, st.kindsMode || "", st.ringOff,
       st.ringInvert, st.ringReverse, st.bgAllPatsEvery, st.bgAllPatsPartial, st.partialPick, allPatLatch.size,
       Array.from(st.selectedPats || []).sort((a, b) => a - b),
       st.allPatScopeSel],
      () => {
        // Склейка + карта "позиция → строка/бит". Длину считаем заранее и берём типизированные
        // массивы: на картинке в миллион бит массив объектов {r,p} съел бы куда больше памяти.
        // Склейка ВСЕГДА по всей цепочке — область поиска "🔎 до паттерна" режет не её, а сами
        // НАХОДКИ (см. ниже): у каждого паттерна своя граница, общей склейкой её не выразить.
        const lastSearchRow = st.rows.length - 1;
        let total = 0;
        for (let r = 0; r <= lastSearchRow; r++) total += (st.rows[r] || "").length;
        if (!total) return null;
        const cellR = new Int32Array(total), cellP = new Int32Array(total);
        let text = "", n = 0;
        for (let r = 0; r <= lastSearchRow; r++) {
          const s = st.rows[r] || "";
          if (!s.length) continue;
          text += s;
          for (let p = 0; p < s.length; p++, n++) { cellR[n] = r; cellP[n] = p; }
        }
        const hits0 = findAllPatternsInResult(text);
        if (!hits0.length) return null;
        const period = hits0.period || total;
        // ОБЛАСТЬ ПОИСКА (см. #allPatScopeGrp): "вся цепочка" — берём всё как нашлось; "до
        // паттерна" — КАЖДЫЙ паттерн засчитывается только в строках ВЫШЕ САМОГО СЕБЯ (запрос
        // пользователя). Граница у каждого своя — номер его собственной строки (st.pats идёт
        // параллельно st.rows), поэтому режется не склейка, а находки: вхождение целиком должно
        // лежать в строках с номером МЕНЬШЕ patIdx, иначе оно выбрасывается вместе с подсветкой и
        // с меткой в колонке паттернов. Вхождение "через кольцо" (хвост склейки + её начало)
        // всегда задевает нижние строки — значит тут не годится и оно.
        // Отбрасывать одни вхождения и оставлять другие безопасно и при выключенном "🔁 Все
        // вхождения": там на паттерн приходит САМОЕ РАННЕЕ вхождение, и если уж оно оказалось не
        // выше своей строки, то и остальные (позже по позиции) — тем более.
        let hits = hits0;
        if (st.allPatScopeSel) {
          hits = [];
          for (const h of hits0) {
            let ok = true;
            for (let q = 0; q < h.len; q++) {
              const pos = period ? (h.start + q) % period : (h.start + q);
              if (pos >= total) continue;
              if (cellR[pos] >= h.patIdx) { ok = false; break; }
            }
            if (ok) hits.push(h);
          }
          if (!hits.length) return null;
          hits.period = period;
        }
        const rows = new Map();
        for (const h of hits) for (let q = 0; q < h.len; q++) {
          const pos = period ? (h.start + q) % period : (h.start + q);
          if (pos >= total) continue;
          const r = cellR[pos];
          let arr = rows.get(r);
          if (!arr) { arr = []; rows.set(r, arr); }
          // Первый занявший бит и остаётся: список паттернов идёт сверху вниз, верхний приоритетнее.
          if (arr[cellP[pos]] === undefined) arr[cellP[pos]] = h.patIdx;
        }
        return { rows, hits };
      });
    if (self) { allPatRows = self.rows; allPatSelfHits = self.hits; }
  }
  // Та же карта нужна КЛИКУ по найденному паттерну — он ведёт к вхождению этого паттерна в строках
  // (см. patHitTargets/scrollToBit). Держим последнюю посчитанную здесь, чтобы не гонять поиск
  // второй раз: переходы обязаны идти ровно по той подсветке, которая сейчас на экране.
  lastAllPatRows = allPatRows;
  // Колонка паттернов: пока фон-поиск работает, метки берутся из его результатов (там известен и
  // режим, которым нашлось, — он показывается в подсказке). Когда он выключен, красим по находкам
  // из самих строк, иначе колонка молчала бы, хотя в строках подсветка есть.
  if (allPatsShown() && !allPatHits && allPatSelfHits) {
    for (const h of allPatSelfHits) {
      if (!allPatHits) allPatHits = new Map();
      if (!allPatHits.has(h.patIdx)) allPatHits.set(h.patIdx, { kind: h.kind, mode: null, patStart: h.patStart, patLen: h.patLen });
    }
  }

  // "🚀 Авто": всё, что нашлось на этом шаге, защёлкиваем, а всё защёлканное ранее — доливаем
  // обратно в метки колонки. Так за прогон метки только НАКАПЛИВАЮТСЯ и ни одна не гаснет
  // (запрос пользователя), а сами защёлкнутые паттерны на следующих шагах уже не ищутся.
  if (allPatsShown() && st.running && allPatHits) {
    for (const [pi, info] of allPatHits) if (!allPatLatch.has(pi)) allPatLatch.set(pi, info);
  }
  if (allPatsShown() && allPatLatch.size) {
    if (!allPatHits) allPatHits = new Map();
    for (const [pi, info] of allPatLatch) if (!allPatHits.has(pi)) allPatHits.set(pi, info);
  }
  // "🧩 Паттерн-цепочка" нашла паттерн — подсвечиваем его ВО ВСЕХ строках, где он реально лежит,
  // включая нижние (запрос пользователя: "найденное сначала подсветить везде где нашлось даже в
  // нижних строках, и потом только переместить выделение"). Ищем в КАЖДОЙ строке тем же
  // findPatternKinds(), что и сам фон-поиск — значит с теми же настройками (⏭ Без 1-го,
  // ⇌ Инв/Рев, 🔀 Подпаттерны, 🔁 Инв. кольцо), и раскладываем находки по позициям тем же
  // buildHitMap(). Работает ТОЛЬКО пока цепочка активна и совпадение уже есть — вне её ничего не
  // меняется. Map: индекс строки → (позиция бита → {kind, skip}).
  let patChainHitRows = null;
  if (bgInfo && bgInfo.matched) {
    const seekPat = st.pats[bgInfo.targetIdx];
    const seekText = seekPat && seekPat.text ? seekPat.text : "";
    // Построчный поиск того же паттерна В КАЖДОЙ СТРОКЕ — только пока работает Паттерн-цепочка
    // (это её история). А вот разбор находки СКВОЗНЫХ режимов по строкам (ниже) работает ВСЕГДА:
    // нашлось в сквозной верхних строк — сразу видно, какие именно биты совпали (запрос
    // пользователя).
    const chainOn = st.patChainFilledTo === bgInfo.targetIdx;
    // Строки, отключённые галками "⛔" (см. patChainLastIdx), не подсвечиваем вовсе — в них
    // паттерн не ищется и подсвечивать там нечего (запрос пользователя).
    const lastActiveRow = patChainLastIdx(seqAnchorIdx());
    // Через кэш (см. memoMask выше) — это самое дорогое место рендера: findPatternKinds() строит
    // кольцо строки и ищет в нём, и так по КАЖДОЙ строке, а зовётся всё это на каждый рендер, в том
    // числе когда ни строки, ни настройки поиска не менялись. Зависимости перечислены ПОЛНОСТЬЮ:
    // аргументы (строки, искомый паттерн, граница активных строк) плюс те поля st, в которые
    // findPatternKinds лезет сама (allKinds/bgSubPatterns/ringOff/skipFirst) и через
    // ringCycle→ringNextLap (ringInvert/ringReverse). buildHitMap чистая. Появится новая настройка
    // поиска — дописать сюда, иначе подсветка залипнет.
    const chainRowHits = (seekText && chainOn)
      ? memoMask("patChainRows",
          [st.rows, seekText, lastActiveRow, st.allKinds, st.kindsMode || "", st.bgSubPatterns, st.ringOff,
           st.skipFirst, st.skipLast, st.ringInvert, st.ringReverse],
          () => {
            const m = new Map();
            for (let r = 0; r < st.rows.length && r <= lastActiveRow; r++) {
              const rs = st.rows[r] || "";
              if (!rs.length) continue;
              const kinds = findPatternKinds(rs, seekText);
              if (!kinds.length) continue;
              m.set(r, buildHitMap(rs.length, kinds));
            }
            return m;
          })
      : null;
    // Массивы из кэша НЕЛЬЗЯ менять на месте: разбор сквозных режимов ниже дописывает в них свои
    // биты, и кэш копился бы находками прошлых шагов. Отвязываем строку от кэша ровно в тот момент,
    // когда в неё правда пишут (см. chainRowsOwn ниже) — на большинстве строк копии не будет вовсе.
    patChainHitRows = chainRowHits ? new Map(chainRowHits) : new Map();
    const chainRowsOwn = new Set();
    // НАХОДКА В СКВОЗНОЙ — ПО САМИМ СТРОКАМ: раскладываем совпадение сквозного режима обратно на
    // строки через bgConcatCellMap(), поэтому видно, какие именно биты совпали, даже когда паттерн
    // лежит НА СТЫКЕ (часть в одной строке, часть в следующей — целиком его в строках нет, и
    // построчный поиск выше такого не найдёт). Позиции сворачиваем по периоду кольца, как
    // buildHitMap().
    /* В СТРОКИ КЛАДЁМ НАХОДКУ ТОЛЬКО ОДНОГО РЕЖИМА (v0.918, запрос пользователя: "в цепочках
       подсветить только самую первую находку, не надо все накладывать, если её биты
       пересекаются; по нажатию только переключать").
       Совпасть может сразу несколько режимов (а с "🎭 Маской" — ещё и каждая её фаза), и раньше
       все они красили одни и те же строки поверх друг друга: позицию занимал тот, кто добрался
       до неё первым, и по картинке было не понять, чья это находка. Теперь берём ОДИН результат —
       выбранный кликом по его строке в окне "Результат" (st.bgHitPick), а если ничего не выбрано
       или выбранное больше не совпадает, то первый совпавший по порядку режимов. */
    const matchedResults = bgInfo.results.filter(r => r.matched && r.kinds && r.kinds.length);
    const hitRes = matchedResults.find(r => r.mode === st.bgHitPick) || matchedResults[0];
    for (const res of (hitRes ? [hitRes] : [])) {
      const cellMap = bgConcatCellMap(res.mode, bgInfo.chainIdx);
      if (!cellMap) continue;
      /* ПЕРЕВОД КООРДИНАТ ПОД "🎭 МАСКУ". kd.start/kd.len — позиции в той строке, ПО КОТОРОЙ
         реально искали, а с маской это ПРОРЕЖЁННАЯ строка (maskInfo.picked), тогда как cellMap
         проиндексирован по ПОЛНОЙ склейке. Без перевода подсветка в строках уезжала: находка на
         позициях 5–8 прорежённой строки красила cellMap[4..7], то есть совсем другие биты совсем
         другой строки (баг-репорт пользователя — "а почему в строках выделило это"). pickMap[j] —
         какой индекс полной строки дал j-й взятый бит: тот же обход, что в applyPickMask. */
      const mi = res.maskInfo;
      const resLen = res.result.length;
      let pickMap = null;
      if (mi && mi.mask) {
        pickMap = [];
        const n = mi.mask.length;
        // through — маску клали на удвоенную строку (галка "заново каждый виток" снята).
        const srcLen = mi.through ? resLen * 2 : resLen;
        for (let i = 0; i < srcLen; i++) if (mi.mask[(i + mi.phase) % n] === "1") pickMap.push(i);
      }
      const pickedLen = mi ? mi.picked.length : resLen;
      const period = res.kinds.period || pickedLen;
      for (const kd of res.kinds) for (let q = 0; q < kd.len; q++) {
        const pos = period ? (kd.start + q) % period : (kd.start + q);
        // Позиции второго витка кольца (🔁 Инв./реверс — там период вдвое длиннее) в строках не
        // существуют: это инвертированные биты, а не сами данные. Раньше их отсекала проверка
        // pos < cellMap.length, теперь — явно, до перевода координат.
        if (pos >= pickedLen) continue;
        let full = pickMap ? pickMap[pos] : pos;
        if (full == null) continue;
        // Маска шла сквозь витки — второй виток это та же самая склейка, сворачиваем обратно.
        if (full >= resLen) full -= resLen;
        const cell = full < cellMap.length ? cellMap[full] : null;
        if (!cell || cell.r > lastActiveRow) continue; // отключённые строки не подсвечиваем
        let arr = patChainHitRows.get(cell.r);
        if (!arr) {
          arr = [];
          patChainHitRows.set(cell.r, arr);
          chainRowsOwn.add(cell.r);
        } else if (!chainRowsOwn.has(cell.r)) {
          // Первая запись в строку, пришедшую из кэша — берём её копию, оригинал в кэше не трогаем.
          arr = arr.slice();
          patChainHitRows.set(cell.r, arr);
          chainRowsOwn.add(cell.r);
        }
        if (!arr[cell.p]) arr[cell.p] = { kind: kd.kind, skip: kd.skip };
      }
    }
    if (!patChainHitRows.size) patChainHitRows = null;
  }
  const bgSearchTitleEl = document.getElementById("bgSearchTitle");
  if (bgSearchTitleEl) {
    bgSearchTitleEl.classList.toggle("bg-search-active", bgSearchActive());
    // Явная подпись состояния: свечения рамки мало — оно гаснет и когда поиск выключен целиком,
    // и когда просто не выбрано ни одного режима, а это разные вещи.
    // Подпись с явным "нажми, чтобы переключить" — так кнопочная природа читается даже без
    // наведения. Состояние идёт первым символом-индикатором.
    // Подпись КОРОТКАЯ, в одну строку (запрос пользователя: "одна высота у всех кнопок"). Полный
    // вариант ("ВЫКЛ — включить") переносился на вторую строку и делал ряд выше соседней кнопки
    // "Всё / Выкл". Что клик переключает — сказано в подсказке при наведении.
    // Подпись без слова "фон" (v0.826, запрос пользователя "сократить фон"): в ряду теперь три
    // кнопки, и лишние символы заголовка съедали место у соседней "🎭 По маске".
    bgSearchTitleEl.textContent = st.bgSearchOn === false
      ? "🔍 Поиск: ВЫКЛ"
      : (bgSearchActive() ? "🔍 Поиск: ВКЛ" : "🔍 Поиск: нет реж.");
    bgSearchTitleEl.title = (st.bgSearchOn === false ? "Фон-поиск выключен. " : "Фон-поиск включён. ") +
      "Клик — переключить";
  }
  // Соседняя "🎭 По маске" — там же и по тому же поводу: её подпись зависит от поля маски.
  if (typeof updateBgMaskOnBtn === "function") updateBgMaskOnBtn();
  if (typeof updateBgMaskPhaseBtn === "function") updateBgMaskPhaseBtn();
  // Выключен целиком — гасим подсветку выбранных режимов в серый (см. #bgSearchModeGrp.bg-off).
  const bgModeGrpEl = document.getElementById("bgSearchModeGrp");
  if (bgModeGrpEl) bgModeGrpEl.classList.toggle("bg-off", st.bgSearchOn === false);
  // "Диагонали" считаются только на ½-выравниваниях (diagAlignOk) — на остальных гасим их кнопки
  // (.mode-na), чтобы пустой результат не выглядел поломкой. На ЛЕСЕНКАХ вдобавок гаснет
  // зеркальный наклон: у "Лесенка ½" осмыслен только ↘, у "Лесенка правая ½" только ↙
  // (см. diagLinesFor).
  if (bgModeGrpEl) {
    const diagOk = diagAlignOk(st);
    const deadDiag = (st.align === "halfstairs" || st.align === "stairs") ? "diagL"
      : ((st.align === "rhalfstairs" || st.align === "rstairs") ? "diagR" : null);
    bgModeGrpEl.querySelectorAll('button[data-diag="1"]').forEach(b => {
      b.classList.toggle("mode-na", !diagOk || b.getAttribute("data-val") === deadDiag);
    });
  }
  // "🔽 Все ниже": КОПИМ совпавшие строки в набор, живущий до Сброса/Escape (чистится в
  // resetAll). Именно копим, а не перезаписываем каждым кадром: иначе подсветка гасла бы на
  // следующем же шаге прокрутки — запрос пользователя был ровно про то, чтобы цвет не сбрасывался.
  const bgBelowNow = bgInfo && bgInfo.belowHits ? bgInfo.belowHits : null;
  // Считаем ИМЕННО НОВЫЕ строки: про каждую находку говорим один раз, в момент появления, а не
  // каждым кадром (запрос пользователя — до этого набор пополнялся молча, и было не понять,
  // сработала галка или нет).
  if (bgBelowNow) {
    const fresh = [];
    for (const r of bgBelowNow) if (!bgBelowHits.has(r)) { bgBelowHits.add(r); fresh.push(r); }
    if (fresh.length) say("🔽 Все ниже: совпал паттерн " + (fresh.length > 1 ? "строк" : "строки") +
      " № " + fresh.map(r => r + 1).join(", ") + " — помечены зелёным до Сброса.");
  }
  if (bgSearchActive()) {
    // Прямая цель не совпала, а кто-то ниже совпал — в сообщение и в лог идёт ПЕРВАЯ такая строка
    // (подсказка галки: "находка засчитывается по первой совпавшей строке").
    const hitNow = bgMatched ? bgTargetIdx : ((bgBelowNow && bgBelowNow.length) ? bgBelowNow[0] : null);
    if (hitNow !== st.bgSearchLastHit) {
      if (hitNow != null) {
        // 🧮 Суммы длин не даёт kind'ов на весь результат (у неё МНОЖЕСТВО комбинаций сразу) —
        // записываем в лог ВСЕ совпавшие варианты сумм целиком (не просто отметку "нашлось") —
        // запрос пользователя "в лог записать Суммы длин всех найденные варианты сумм".
        const lengthSumsHits = bgInfo.lengthSumsMatched ? lengthSumsMatchedCombos(st, bgInfo.anchorIdx) : [];
        // Сообщение — КОРОТКОЕ (запрос пользователя): перечисление режимов и kind'ов разрасталось
        // на пол-экрана и всё равно целиком лежит в "Логе находок" (см. bgFindLog ниже) и в самой
        // панели результата, где у каждой строки свои галочки.
        say(`🔍 Фон-поиск: паттерн строки ${hitNow + 1} найден!`);
        // Фон-поиск — чисто отображение (подсветка найденной строки), без действий: выделение
        // строк НЕ переключаем, якорь для computeBgSearchTarget() остаётся тем, что выбрал
        // пользователь/другой режим — см. запрос пользователя.
        // Лог находок (см. bgFindLog выше) — не плоская строка-текст, а по режиму отдельно
        // (mode -> kinds), чтобы таблица в своей вкладке могла разложить их по столбцам —
        // запрос пользователя "распредели по столбцам, где нашлось ставь +".
        const matches = {};
        for (const r of bgInfo.results) if (r.matched) matches[r.mode] = r.kinds;
        if (lengthSumsHits.length) matches.lengthSums = lengthSumsHits;
        // step — номер шага (варианта прокрутки), на котором нашлось: под "Авто" это turns из
        // autoRun(), при ручных ◄/► — счётчик кликов подряд (afterShiftBgCheck кладёт его в то же
        // поле). Раньше в логе был только номер строки, и было не понять, на каком шаге это было.
        // 0 (пустая клетка в логе) — находка появилась ВНЕ прокрутки: прогон уже кончился, а
        // строки изменились кликом/правкой/сменой режима. Иначе такие записи получали последний
        // номер прогона, и колонка вырождалась в столбик одинаковых чисел.
        bgFindLog.unshift({ row: hitNow, step: st.stepStale ? 0 : (st.shiftVariantTurns || 0), matches });
        if (bgFindLog.length > BG_FIND_LOG_MAX) bgFindLog.length = BG_FIND_LOG_MAX;
      }
      st.bgSearchLastHit = hitNow;
    }
  }

  const out = [];
  const n = Math.max(st.rows.length, st.pats.length);
  const alignCls = "al-" + st.align;

  // Гориз.XOR: сквозная цепочка ВСЕГДА равна самой целевой строке (см. horizSelfChain()) —
  // подсветка "синим" (xored-bit) идёт ТОЛЬКО по целевой строке, строки выше больше не часть
  // цепочки и в поиске никак не участвуют.
  const hxActive = st.mode === "horiz_xor" || st.mode === "horiz_xor_left";
  const hxDir = st.horizCurrentDir || (st.mode === "horiz_xor_left" ? "left" : "right");
  const hxChainLenAll = hxActive ? (st.horizBigChain || "").length : 0;
  const hxFullLenAll = hxActive ? (st.horizBigOrig || "").length : 0;
  const hxTarget = hxActive ? st.horizBigTargetIdx : -1;
  const hxS = hxActive ? (st.horizXoredLength || 0) : 0;
  const hxExhausted = hxActive && (st.horizChainLen || 0) > 0 && hxS >= (st.horizChainLen || 0);
  const hxWin = (hxActive && !hxExhausted) ? horizWindowRange(hxChainLenAll, hxFullLenAll, hxS, "right") : null;

  // Режим "🔢 Выбор столбца": границы строк — см. colSelectRowRange() (1 выделенная строка —
  // от начала до неё, 2+ — только между крайними); и подсветка колонки, и сам клик по номеру
  // столбца (см. selectColumn()) это учитывают.
  const colSelRange = colSelectRowRange();
  // ПОД-СЕТКА "½"-выравниваний: вертикальная подсветка (жёлтый столбец и синие оси) проходит
  // только через строки той же под-сетки, что и ЯКОРНАЯ строка — см. skipColHighlight в цикле.
  // selAnchorNudge — якорь жёлтого столбца (верхняя выделенная строка, иначе верх диапазона);
  // axisGroupNudge — по якорю каждой ГРУППЫ осей (у "⊙ Оси по «1»" это строка-источник).
  const isHalfNudgeAlign = st.align === "halfcenter" || st.align === "halfstairs" || st.align === "rhalfstairs";
  const selAnchorRow = (st.selectedRows && st.selectedRows.size) ? Math.min(...st.selectedRows) : colSelRange.lo;
  const selAnchorNudge = isHalfNudgeAlign &&
    hasHalfNudge(st.rows[selAnchorRow] || "", maxLen, st.align, selAnchorRow);
  const axisGroupNudge = isHalfNudgeAlign
    ? axisGroups().map(g => {
        const a = (g.anch != null) ? g.anch : (g.row != null ? g.row : 0);
        return hasHalfNudge(st.rows[a] || "", maxLen, st.align, a);
      })
    : null;
  // Назначенные "⊙ Ось сюда" столбцы (их может быть несколько) — в Set один раз на кадр, а не
  // перебором массива на каждый бит.



  // "0 вместо пустот" (st.padZero): ghost-нули рисуются НЕ по всей ширине полотна, а только в тех
  // столбцах, которые реально заняты УЧАСТВУЮЩИМИ строками, и только в самих этих строках —
  // запрос пользователя ("только по столбцам, которые входят в включённые строки над выделенной
  // или всех выделенных"). Набор участников берём ровно тот же, что и фон-поиск (см.
  // computeBgSearchTarget/multiSelIdxs): выделено НЕСКОЛЬКО строк — участвуют ровно они, иначе —
  // всё от 0 до самой нижней выделенной включительно (seqAnchorIdx). Сдвиг считаем через
  // rowShiftFor() — той же геометрией, что и сами склейки/XOR.
  let padRowSet = null, padCols = null;
  if (st.padZero) {
    const anchor = seqAnchorIdx();
    const padIdxs = (st.selectedRows && st.selectedRows.size > 1)
      ? Array.from(st.selectedRows).sort((a, b) => a - b)
      : Array.from({ length: Math.max(0, anchor + 1) }, (_, k) => k);
    padRowSet = new Set(padIdxs);
    padCols = new Set();
    for (const ri of padIdxs) {
      const rs = st.rows[ri] || "";
      if (!rs.length) continue;
      const rsh = rowShiftFor(maxLen, ri, rs, st.align);
      for (let k = 0; k < rs.length; k++) padCols.add(rsh + k);
    }
  }

  // База для подсветки "номер изменился" (.num.changed) — то, к чему реально вернёт "↺ Сброс":
  // если вкладка уже сохранена (💾), это savedChain.rows, а не исходный шаблон tplRows — иначе
  // после сохранения новой цепочки как базовой номера продолжали бы висеть "изменены" вечно,
  // хотя сравнивать их больше не с чем (шаблон-то остался старым).
  const activeTabObj = st.tabs && st.tabs[st.activeTab];
  const changedBase = (activeTabObj && activeTabObj.savedChain) ? activeTabObj.savedChain.rows : st.tplRows;
  // Строки ДО последнего шага (верхушка стека отката) — по ним красим биты, которые этот шаг
  // реально перевернул: 0→1 или 1→0. Длина должна совпадать, иначе позиции не сопоставимы.
  const prevRows = (st.undo && st.undo.length) ? (st.undo[st.undo.length - 1].rows || null) : null;

  // Подсветка "1 под 1" (см. #bHighlightVert1) — считается ОДИН РАЗ на весь рендер (сравнивает
  // соседние строки между собой), не на отдельную строку, как compute01HighlightMask.
  // Обе — через кэш (см. memoMask выше): функции чистые, входы = их аргументы. st.rowDividers это
  // Set, который меняют НА МЕСТЕ, поэтому в зависимости он идёт развёрнутым в отсортированный
  // массив — иначе изменение внутри Set'а осталось бы незамеченным.
  const vertOnesMask = st.highlightVert1
    ? memoMask("vertOnes", [st.rows, st.align], () => computeVertOnesMask(st.rows, st.align))
    : null;
  const diagOnesMask = st.highlightDiag1
    ? memoMask("diagOnes", [st.rows, st.align, Array.from(st.rowDividers || []).sort((a, b) => a - b)],
               () => computeDiagOnesMaskSectioned(st.rows, st.align, st.rowDividers))
    : null;
  // "⧅⧄ Диагонали склейки" — линии обхода режимов "Диаг. ↘/↙" (см. computeDiagFoldMask).
  // Кнопка — ГЛАВНЫЙ выключатель: погашена — не рисуем ничего, даже если какая-то диагональ
  // выбрана кликом в "Результате" (раньше выбор рисовался в обход кнопки, и выключить подсветку
  // было нечем — запрос пользователя "кнопка выключения не работает, всегда подсвечиваются").
  // Сам выбор при этом никуда не девается: включили кнопку обратно — снова горит именно он.
  // Выбран поколоночный режим (Верт./Змейка/зигзаг) — рисуем его линию захвата, иначе обычные
  // диагонали. Кнопка "⧅⧄" остаётся главным выключателем и здесь.
  const diagFoldMask = !st.highlightDiagFold ? null
    : (VERT_PICK_MODES.includes(st.diagFoldPick) ? computeVertPickMask(st, st.diagFoldPick)
                                                 : computeDiagFoldMask(st));
  const foldBgStyle = !!(diagFoldMask && diagFoldMask.bgStyle);

  // "⚖ Показать балансы" — ширина под каждое число ОДНА для ВСЕХ строк (см. formatBalanceTotals()
  // выше) — без этого метка "гуляла" по ширине от строки к строке и уводила саму цепочку правее
  // неё вбок (см. запрос пользователя — "выравнивание съехало").
  let balW1 = 1, balW0 = 1, balB1 = 1, balB0 = 1;
  if (st.showBalances) {
    // Через кэш (см. memoMask): проход считает баланс КАЖДОЙ строки, т.е. обходит все данные
    // целиком, а нужны из него только ширины. computeRowBalance чистая — проверено.
    // b1/b0 — те же максимумы, но в ДВОИЧНОМ виде: в двоичных режимах метка совсем другой ширины,
    // а её ширину теперь обязана знать колонка номеров (баланс печатается внутри неё).
    const bw = memoMask("balW", [st.rows], () => {
      let w1 = 1, w0 = 1, b1 = 1, b0 = 1;
      for (const s of st.rows) {
        if (!s) continue;
        const rb = computeRowBalance(s);
        if (String(rb.total1).length > w1) w1 = String(rb.total1).length;
        if (String(rb.total0).length > w0) w0 = String(rb.total0).length;
        if (rb.total1.toString(2).length > b1) b1 = rb.total1.toString(2).length;
        if (rb.total0.toString(2).length > b0) b0 = rb.total0.toString(2).length;
      }
      return { w1, w0, b1, b0 };
    });
    balW1 = bw.w1; balW0 = bw.w0; balB1 = bw.b1 || 1; balB0 = bw.b0 || 1;
    updateSelBalance();
  } else {
    const wrap = document.getElementById("selBalanceWrap");
    if (wrap) wrap.style.display = "none";
  }
  /* "🔎 Показать выделенное" (v0.912, запрос пользователя) — образец из выбранных ячеек (▭)
     ищется во ВСЕХ строках цепочки и подсвечивается прямо в них, теми же цветами, что и находки
     фон-поиска (.chain-hit-bits + KIND_CLS). Версии образца — по тому же переключателю
     "⇌ Инв/Рев", что и весь поиск (см. KINDS_MODES): прямой всегда, остальные по режиму.
     Строка → массив по позициям: kind совпадения или -1. Первый найденный вариант позицию не
     отдаёт (marks[k] < 0), поэтому прямое совпадение всегда важнее инверсии/реверса — тот же
     приоритет, что и в "🌈 Все паттерны".
     Образец короче двух бит не ищем: одиночный бит есть буквально везде, подсветка от него
     превращается в сплошную заливку. */
  let cellSampleRows = null;
  /* Зафиксированное — своей картой Map(строка → Set(индексы бит)): в наборе может быть полстроки,
     и дёргать cellPin.has() на каждый бит означало бы разбор строкового ключа полмиллиона раз за
     кадр (та же причина, по которой sampleRow достаётся один раз на строку, а не на символ). */
  const cellPinRows = cellPin.size ? (() => {
    const m = new Map();
    for (const key of cellPin) {
      const p = key.split("|"), r = +p[0], k = +p[1];
      if (!m.has(r)) m.set(r, new Set());
      m.get(r).add(k);
    }
    return m;
  })() : null;
  // Образец собирается и из ячеек строк, и из выбранных бит паттерна (v0.950) — хватит любого.
  if (st.cellSampleOn && (cellSel.size || patCellSel.size) && typeof cellSelSampleText === "function") {
    const sample = cellSelSampleText();
    if (sample.length >= 2) {
      /* ОДНА ВЫДЕЛЕННАЯ СТРОКА — ИЩЕМ ТОЛЬКО В НЕЙ (v0.943, запрос пользователя "если выделена
         одна строка, то выделения ячеек искать только в ней"). Это способ сузить показ: пока
         выделения нет (а «🔎 Показать» его при включении как раз снимает) — ищем по всей цепочке,
         как раньше. Несколько выделенных строк ограничением НЕ считаются: там выделение обычно
         про другое действие (склейки, XOR), и глушить показ было бы неожиданно. */
      const onlyRow = (st.selectedRows && st.selectedRows.size === 1) ? Math.max(...st.selectedRows) : -1;
      // bgSearchModes в ключе — от него зависит НАБОР склеек сквозного поиска (см. ниже).
      cellSampleRows = memoMask("cellSample",
        [st.rows, sample, st.kindsMode || "", st.align, !!st.cellSampleSeq, onlyRow,
         (st.bgSearchModes || []).join(",")], () => {
        const inv = invertBits(sample);
        const variants = [[0, sample]];
        if (kindsInvOn()) variants.push([1, inv]);
        if (kindsRevOn()) variants.push([2, reverseStr(sample)]);
        if (kindsInvOn() && kindsRevOn()) variants.push([3, reverseStr(inv)]);
        const out = new Map();
        const markAt = (row, k, kind) => {
          const len = (st.rows[row] || "").length;
          if (k < 0 || k >= len) return;
          let marks = out.get(row);
          if (!marks) { marks = new Array(len).fill(-1); out.set(row, marks); }
          if (marks[k] < 0) marks[k] = kind;
        };
        for (let i = 0; i < st.rows.length; i++) {
          if (onlyRow >= 0 && i !== onlyRow) continue;
          const s = st.rows[i] || "";
          if (s.length < sample.length) continue;
          for (const [kind, v] of variants) {
            let from = 0, idx;
            while ((idx = s.indexOf(v, from)) >= 0) {
              for (let k = idx; k < idx + v.length; k++) markAt(i, k, kind);
              from = idx + 1;
            }
          }
        }
        /* "⛓ сквозно" (v0.942): тот же образец ищется в СКЛЕЙКЕ строк, а найденное раскладывается
           обратно по строкам через карту позиция→(строка, бит). Так засчитывается совпадение,
           которое начинается в конце одной строки и кончается в начале следующей, — построчный
           indexOf такое не видит в принципе. Идёт ВДОБАВОК к построчному поиску, приоритет вида
           (прямой важнее инверсии/реверса) держится тем же правилом marks[k] < 0.
           ПОРЯДОК СКЛЕЙКИ — ПО ФОН-ПОИСКУ (v0.944, запрос пользователя "пусть берёт все склейки,
           включённые в поиске фоновом"): сколько разных склеек отмечено в «🔍 Фон-поиске», по
           стольким и ищем. Порядков ровно четыре, всё остальное к ним сводится:
             concatR*          — сверху вниз, строки как есть;
             concatL*          — снизу вверх (порядок СТРОК обратный, биты внутри строки прямые);
             concatSnake*      — змейка от левого края: у каждой второй строки биты задом наперёд;
             concatSnakeFromR* — та же змейка, но первая строка читается справа.
           Вариантов "Инв"/"Рев+Инв" тут НЕТ намеренно, и это не упрощение: искать образец в
           инвертированной склейке — то же самое, что искать инвертированный образец в обычной, а
           инверсию/реверс самого образца уже даёт переключатель «⇌ Инв/Рев» (см. variants выше).
           Разными они делают только порядок обхода, поэтому по нему и группируем.
           Ни одной склейки в фон-поиске не отмечено — берём обычную сверху вниз, чтобы кнопка не
           оказалась немой. */
        // При одной выделенной строке сквозной поиск смысла не имеет: склеивать нечего, а сама
        // строка уже прочёсана выше — ровно тем же образцом и теми же вариантами.
        if (st.cellSampleSeq && onlyRow < 0) {
          const modes = st.bgSearchModes || [];
          const hasL = modes.some(m => m.indexOf("concatL") === 0);
          const hasSnakeR = modes.some(m => m.indexOf("concatSnakeFromR") === 0);
          const hasSnake = modes.some(m => m.indexOf("concatSnake") === 0 && m.indexOf("concatSnakeFromR") !== 0);
          let hasR = modes.some(m => m.indexOf("concatR") === 0);
          if (!hasR && !hasL && !hasSnake && !hasSnakeR) hasR = true;
          /* order: "down"/"up" — в каком порядке идут СТРОКИ; snakeStart: null — биты всегда слева
             направо, false/true — змейка (чётность берём по НОМЕРУ СТРОКИ, ровно как
             concatSnakeGlueDownTo в fold-1, иначе пропуск пустых строк сдвигал бы чередование). */
          const buildSeq = (order, snakeStart) => {
            let text = ""; const map = [];
            const idxs = [];
            for (let i = 0; i < st.rows.length; i++) if ((st.rows[i] || "").length) idxs.push(i);
            if (order === "up") idxs.reverse();
            for (const i of idxs) {
              const s = st.rows[i];
              const rev = (snakeStart !== null) && ((i % 2 === 1) !== !!snakeStart);
              if (rev) for (let k = s.length - 1; k >= 0; k--) { text += s[k]; map.push([i, k]); }
              else     for (let k = 0; k < s.length; k++)      { text += s[k]; map.push([i, k]); }
            }
            return { text, map };
          };
          const seqs = [];
          if (hasR)      seqs.push(buildSeq("down", null));
          if (hasL)      seqs.push(buildSeq("up", null));
          if (hasSnake)  seqs.push(buildSeq("down", false));
          if (hasSnakeR) seqs.push(buildSeq("down", true));
          for (const sq of seqs) {
            for (const [kind, v] of variants) {
              let from = 0, idx;
              while ((idx = sq.text.indexOf(v, from)) >= 0) {
                for (let p = idx; p < idx + v.length; p++) {
                  const m = sq.map[p];
                  if (m) markAt(m[0], m[1], kind);
                }
                from = idx + 1;
              }
            }
          }
        }
        return out;
      });
    }
  }
  // Кнопке "📌 Зафиксировать" нужен ТОТ ЖЕ разбор, что сейчас нарисован (см. bCellSampleFix): сама
  // она ничего не ищет, а перекладывает готовые находки в накопитель.
  lastCellSampleRows = cellSampleRows;
  /* ТОТ ЖЕ ОБРАЗЕЦ — И В КОЛОНКЕ ПАТТЕРНОВ (v0.948, запрос пользователя "в паттернах надо и туда
     выделять находки части, а не в строках"). Раньше «🔎 Показать» искал только в самих строках,
     и совпадение куска паттерна с выбранными ячейками нигде не было видно — а именно оно и
     интересно: паттерн собирается по частям, и хочется видеть, какая его часть уже нашлась.
     Ищем в ТЕКСТЕ паттерна теми же вариантами (⇌ Инв/Рев) и с тем же приоритетом (прямой важнее),
     подсветка — теми же классами, что и в строках. Ограничение "выделена одна строка" (v0.943)
     действует и тут: тогда смотрим только её паттерн.
     Считаем ОТДЕЛЬНО от строк: у паттернов свои тексты и своя длина, мешать их в одну карту
     нельзя. Зависимость — склейка текстов паттернов, а не сам массив: объекты паттернов меняют
     на месте, и сравнение по ссылке отдавало бы протухшую подсветку. */
  let cellSamplePats = null;
  // Образец собирается и из ячеек строк, и из выбранных бит паттерна (v0.950) — хватит любого.
  if (st.cellSampleOn && (cellSel.size || patCellSel.size) && typeof cellSelSampleText === "function") {
    const sample = cellSelSampleText();
    if (sample.length >= 2) {
      const onlyRowP = (st.selectedRows && st.selectedRows.size === 1) ? Math.max(...st.selectedRows) : -1;
      const patsKey = st.pats.map(p => (p && p.text) || "").join("|");
      cellSamplePats = memoMask("cellSamplePats", [patsKey, sample, st.kindsMode || "", onlyRowP], () => {
        const inv = invertBits(sample);
        const variants = [[0, sample]];
        if (kindsInvOn()) variants.push([1, inv]);
        if (kindsRevOn()) variants.push([2, reverseStr(sample)]);
        if (kindsInvOn() && kindsRevOn()) variants.push([3, reverseStr(inv)]);
        const out = new Map();
        for (let i = 0; i < st.pats.length; i++) {
          if (onlyRowP >= 0 && i !== onlyRowP) continue;
          const t = (st.pats[i] && st.pats[i].text) || "";
          if (t.length < sample.length) continue;
          let marks = null;
          for (const [kind, v] of variants) {
            let from = 0, idx;
            while ((idx = t.indexOf(v, from)) >= 0) {
              if (!marks) marks = new Array(t.length).fill(-1);
              for (let k = idx; k < idx + v.length; k++) if (marks[k] < 0) marks[k] = kind;
              from = idx + 1;
            }
          }
          if (marks) out.set(i, marks);
        }
        return out;
      });
    }
  }
  // При включённых балансах у .num-l2 снимается отрицательный margin-left (см. CSS body.has-balances):
  // та оттяжка была заведена, когда в боксе стоял ОДИН номер и его подтягивали ближе к колонке
  // паттернов. Теперь слева в боксе стоит метка баланса, и оттяжка вдвигала её прямо на линию
  // разделителя (запрос пользователя: "небольшой отступ от границы для балансов надо оставить").
  document.body.classList.toggle("has-balances", !!st.showBalances);
  // Ширина номера строки — ОДНА на все строки (см. numTxtL ниже). Кандидатов ровно два: самый
  // нижний номер (самый длинный положительный) и самый верхний (у построений он отрицательный,
  // и минус добавляет символ).
  const numPadW = Math.max(
    String(rowLabel(Math.max(0, st.rows.length - 1))).length,
    String(rowLabel(0)).length
  );

  // Окно строк, которые реально рисуем (см. vrowsRange). Пока строк мало — это по-прежнему ВСЕ
  // строки, и рендер идёт ровно как раньше.
  const vr = vrowsRange(n, VROWS_OVERSCAN);
  vrowsWindow = { lo: vr.lo, hi: vr.hi };

  const topActiveFrom = firstActiveRow();
  // ЗЕРКАЛА (серые, слева/справа) рисуются ТОЛЬКО когда есть выделение, и только по строки до
  // выделенной включительно, считая сверху (запрос пользователя). Ниже неё отражать нечего — это
  // ещё не разобранная часть цепочки. Нет выделения — зеркал нет вовсе.
  const mirrorTo = (st.selectedRows && st.selectedRows.size) ? Math.max(...st.selectedRows) : -1;
  // Выделена ровно одна строка — зеркало только у неё (см. mirrorTopRow в ядре).
  const mirrorFrom = mirrorTopRow();
  /* ПОДСВЕТКА ГРУПП МАСКИ — ОДИН источник на оба смысла (v0.929: маска общая, см. mpBgMask ниже;
     раньше рядом жил отдельный mpShift для "⇄ Сдвига по маске" и всегда перебивал этот).
     Красится САМА ЦИФРА, не фон (запрос пользователя "разными цифрами лучше чем фон, выбор цвета"):
       под «1» — маска БЕРЁТ бит в поиск, он же едет кольцом единиц "⇄ Сдвига по маске";
       под «0» — выбрасывает, и это кольцо нулей.
     Диапазон — colSelectRowRange (одна строка выделена → от верха до неё, несколько → только
     они, ничего не выделено → вся цепочка) — запрос пользователя.
     Режим "seq" — фаза маски идёт СКВОЗЬ строки (нужна нарастающая сумма длин, считаем раз на
     кадр), "row" — маска начинается заново в каждой строке. */
  const cumLenFrom = (from) => {
    const a = []; let acc = 0;
    for (let r = from; r < st.rows.length; r++) { a[r] = acc; acc += (st.rows[r] || "").length; }
    return a;
  };
  /* ОДНА подсветка на одну маску (v0.929): отдельной ветки "⇄ Сдвига по маске" (mpShift,
     st.maskPaintMode) больше нет — маска у сдвига и у прореживания общая, красили они одно и то
     же, а ветка сдвига к тому же всегда перебивала вторую. Своего «выкл» у подсветки тоже нет:
     маска пуста (или в ней нет «1» и «0» разом) — mpBgMask пустая, и подсветка гаснет сама.
     Берём maskBitsRaw(), а не maskBits(): выключатель «🎭 По маске» гасит ПОИСК, а не картинку. */
  // st.bgMaskPaintOn (v0.936) — отдельный выключатель подсветки: маска в поле остаётся, красить
  // перестаём. Пустое поле по-прежнему гасит подсветку само, независимо от этого флага.
  const mpBgMask = (st.bgMaskPaintOn !== false && typeof maskBitsRaw === "function") ? maskBitsRaw() : "";
  const mpBgRange = mpBgMask ? colSelectRowRange() : null;
  const mpBgOff = (mpBgMask && st.bgMaskPaintMode !== "row") ? cumLenFrom(Math.max(0, mpBgRange.lo)) : null;
  const mpColor = [st.maskPaintColor0 || "#22d3ee", st.maskPaintColor1 || "#b060ff"];
  // Выбранная фаза прореживающей маски (кнопка "🎭 Фаза маски" во вкладке "Маски" и клик по фазе
  // в Черновике — одно и то же значение). На маску "⇄ Сдвига" не влияет: у той своей фазы нет.
  const mpBgPhase = mpBgMask ? (((st.maskDraftPhase | 0) % mpBgMask.length) + mpBgMask.length) % mpBgMask.length : 0;
  for (let i = vr.lo; i <= vr.hi; i++){
    // "👁 XOR на строке" (st.horizShowLiveXor) теперь РЕАЛЬНО пишет промежуточный XOR в
    // st.rows[b] по ходу поиска (см. doStep()), поэтому тут достаточно простого чтения —
    // никакого отдельного вычисления/подмены значения для отображения не нужно.
    // "⋮ Биты: чёт/нечёт" — выключенные биты рисуются точками (см. applyParityMask). Длина
    // строки от этого не меняется, поэтому геометрия, флаги и подсветки считаются как обычно.
    const sRaw = st.rows[i] || "";
    const s = st.parityView ? applyParityMask(sRaw, i, 0, 0) : sRaw;
    const p = st.pats[i];
    const cls = ["ln"];
    // Построения выше границы участия — затемняем (см. firstActiveRow): видно, что эти строки
    // сейчас в расчётах не участвуют.
    if (i < topActiveFrom) cls.push("top-inactive");
    if (st.used[i]) cls.push("used");
    /* СИНЯЯ ПАРА (.cur = st.aIdx/st.bIdx) — только когда шаги реально идут (запрос пользователя:
       "выделение первых 2 строк синим — может их отключить? код похоже на них смотрит, а не на
       то, что руками выделяю"). Это указатели пошагового движка, а НЕ выделение мышью, но
       выглядят они похоже, и сразу после загрузки/Сброса resetAll() ставит их на первые две
       строки с данными — из-за чего пустое выделение читалось как "строка выделена", а фон-поиск
       при этом честно отвечал "нет цели". До первого шага пары на экране больше нет; сам
       механизм не тронут — шаги, автопоиск и Гориз.XOR по-прежнему держатся на aIdx/bIdx. */
    if ((st.step > 0 || st.running) && (i === st.aIdx || i === st.bIdx)) cls.push("cur");
    if (st.selectedRows && st.selectedRows.has(i)) cls.push("selected");
    // Гориз.XOR активен — сквозная цепочка теперь всегда = сама целевая строка (см.
    // horizSelfChain()), поэтому ВСЕ остальные строки (и выше, и ниже цели) сейчас никак не
    // участвуют в поиске — сильно затемняем, чтобы не отвлекали (запрос пользователя).
    if (hxActive && hxTarget >= 0 && i !== hxTarget) cls.push("horiz-dim");
    if (st.rowDividers && st.rowDividers.has(i)) cls.push("row-divider");

    const rowBal = (st.showBalances || st.runsAsBits) ? computeRowBalance(s) : null;
    const balanceHtml = st.showBalances ? formatBalanceTotals(rowBal.total1, rowBal.total0, balW1, balW0, balB1, balB0, rowLabel(i)) : "";

    // Номер строки (текст + класс "изменённой") считается ЗДЕСЬ, а не ниже у out.push: правый
    // номер теперь печатается ВНУТРИ ячейки П2 (запрос пользователя — "убери правые номера
    // цепочек в правые паттерны, слева от них"), а она собирается прямо в этом блоке.
    const numCls = "num" + (s !== (changedBase[i] || "") ? " changed" : "");
    // Номер для показа — через rowLabelText(): у достроенных сверху строк он отрицательный, а при
    // включённых "🔢 Двоичных номерах" ещё и в двоичном виде.
    const numTxt = rowLabelText(i);
    // НОМЕР В ПОЛЕ ЦЕПОЧКИ — ВСЕГДА ДЕСЯТИЧНЫЙ (v0.884, запрос пользователя "номера в цепочках —
    // только 10-ные пусть"). Двоичный вид (кнопка "🔢 Двоичные номера") остаётся у номеров ВНУТРИ
    // паттернов: там он к месту — паттерн сам из 0/1, и номер читается как его продолжение. А в
    // поле цепочки нужен обычный счёт строк, тот же, что в логе и сообщениях.
    // Номер добит пробелами до ОДНОЙ ширины на все строки (v0.891). Бокс .num-l2 выровнен по
    // правому краю, и без этого номер разной длины сдвигал бы стоящую ПЕРЕД ним метку баланса —
    // "+" и "=" гуляли бы по строкам (запрос пользователя "= под =, + под +"). Пробелы держатся
    // за счёт white-space:pre у .num.
    const numTxtL = String(rowLabel(i)).padStart(numPadW, " ");
    /* Номера ВНУТРИ ячеек паттернов — по кнопке у каждой колонки отдельно (v0.873, запрос
       пользователя "отображение вообще номеров в паттернах, лево право поля отдельные кнопки").
       Правый (в П2) теперь стоит СПРАВА от текста паттерна, а не слева, как было с v0.833
       ("справа номера от паттернов"); левый (в П1) — зеркально, у левого края своей ячейки.
       Место под них резервируют body.patnum-r/.patnum-l в CSS, сами номера позиционируются
       абсолютом. */
    const numRightHtml = st.patNumR === false ? ""
      : '<span class="' + numCls + ' num-r2">' + numTxt + "</span>";
    const numLeftHtml = st.patNumL
      ? '<span class="' + numCls + ' num-p1">' + numTxt + "</span>" : "";

    let pat = "";
    let patRight = "";
    if (p && p.text){
      // Текущая цель — своим жёлтым, как и раньше. Строка, чей паттерн когда-либо совпал при
      // "🔽 Все ниже", — СВОИМ цветом (.bg-below-hit) и остаётся помеченной до Сброса/Escape.
      const bgHitSuffix = i === bgTargetIdx ? (bgMatched ? " bg-search-hit" : " bg-search-target")
        : (bgBelowHits.has(i) ? " bg-below-hit" : "");
      // ОТДЕЛЬНОЕ выделение паттернов (st.selectedPats) — своё, не связанное с выделением строк:
      // им сужается список того, что ищет "🌈 Все паттерны" (см. findAllPatternsInResult).
      const patSel = (st.selectedPats && st.selectedPats.has(i)) ? " pat-sel" : "";
      const c = (p.found ? ("pat found " + KIND_CLS[p.kind || 0]) : "pat") + bgHitSuffix + patSel;
      const c2 = (p.found ? ("pat2 found " + KIND_CLS[p.kind || 0]) : "pat2") + bgHitSuffix + patSel;
      
      const stepHtml = p.found ? '<span class="st">#' + p.step + "</span>" : "";
      
      const allHit = allPatHits ? allPatHits.get(i) : null;
      // "🧩 Макс. часть": паттерн нашёлся НЕ целиком — в колонке красим ТОЛЬКО найденный кусок
      // (запрос пользователя), остальное остаётся обычным приглушённым текстом паттерна.
      const partStart = (allHit && allHit.patLen > 0 && allHit.patStart >= 0)
        ? Math.min(allHit.patStart, p.text.length) : -1;
      const partEnd = partStart >= 0 ? Math.min(p.text.length, partStart + allHit.patLen) : -1;

      let textHtml = esc(p.text);
      // Фоновый поиск сверяется через textMatchesPattern(), который сам учитывает живую
      // st.skipFirst (а не "замороженный" p.skip1, записанный только при обычной находке) —
      // подсветка первого символа для target/hit-строки идёт по тому же живому флагу.
      // "🌈 Все паттерны" и ВЫДЕЛЕННЫЕ паттерны — тоже показываем первый символ отрезанным,
      // когда включено "⏭ Без 1-го" (запрос пользователя). Искалось-то уже без него всегда:
      // findAllPatternsInResult режет base = text.slice(1) по той же живой st.skipFirst. А в колонке
      // паттерн при этом рисовался целиком — и выходило, что подсвечен один кусок, а ищется другой.
      // Условие то же живое, что и у target-строки, а не "замороженный" p.skip1 (он пишется только
      // при обычной находке).
      // ВКЛЮЧЕНО "⏭ Без 1-го" — первый символ приглушён У ВСЕХ ПАТТЕРНОВ без разбора (v0.906,
      // запрос пользователя "и у паттернов первый символ затемнить"). Раньше тут стоял список
      // исключений (текущая цель, строки из "🔽 Все ниже", находки "🌈 Все паттерны", выделенные
      // ячейки) — но флаг-то глобальный: поиск отбрасывает первый символ У ЛЮБОГО паттерна, а в
      // колонке это было видно лишь у нескольких, и остальные читались так, будто ищутся целиком.
      const skipShown = st.skipFirst && p.text.length > 1;
      const skipDim = ((p.found && p.skip1 && p.text.length > 1) || skipShown);
      // Отрезанный первый символ ВЫНЕСЕН ЗА .pat-txt (v0.905): заливка находки лежит на .pat-txt
      // (см. её сборку ниже), поэтому всё, что попадает внутрь, ею и красится. Символ, которого в
      // совпадении не было, снаружи — и остаётся просто приглушённым.
      const skipHead = skipDim ? '<span class="pat-skip">' + esc(p.text[0]) + '</span>' : "";
      const from = skipDim ? 1 : 0;
      // Совпадения с образцом из выбранных ячеек ВНУТРИ паттерна (v0.948, см. cellSamplePats).
      // Идут первыми: пока идёт разбор «🔎 Показать», важнее видеть найденный кусок образца, чем
      // цвет «🧩 Макс. части» — тот вернётся, как только показ выключат.
      const patSampleMarks = cellSamplePats ? cellSamplePats.get(i) : null;
      /* ВЫБОР БИТ ПРЯМО В ПАТТЕРНЕ (v0.950): пока включён режим "▭ Выбор ячеек", каждый символ
         паттерна печатается своим span'ом с data-pcol — по нему и ловится клик (см. patCellAtEvent
         в fold-4). Вне режима спанов не плодим: паттернов сотни, и лишние узлы на каждый кадр тут
         ни к чему — ровно та же логика, что у data-col у бит строки. */
      const patCellRow = (patCellSel.size && patCellSelRow() === i) ? patCellSel : null;
      if ((patSampleMarks && patSampleMarks.length === p.text.length) || cellSelMode) {
        let t = "";
        for (let k = from; k < p.text.length; k++) {
          const kd = (patSampleMarks && patSampleMarks.length === p.text.length) ? patSampleMarks[k] : -1;
          const sel = patCellRow && patCellRow.has(i + "|" + k);
          const ch = esc(p.text[k]);
          let cls = "";
          if (sel) cls = "cell-sel";
          else if (kd >= 0) cls = "chain-hit-bits" + (KIND_CLS[kd] ? " " + KIND_CLS[kd] : "");
          const attr = cellSelMode ? ' data-pcol="' + k + '"' : "";
          t += (cls || attr)
            ? ('<span' + (cls ? ' class="' + cls + '"' : "") + attr +
               (sel ? ' title="Выбранный бит паттерна"' : (kd >= 0 ? ' title="Совпало с выбранными ячейками"' : "")) +
               '>' + ch + '</span>')
            : ch;
        }
        textHtml = t;
      } else if (partStart >= 0 && partEnd > partStart) {
        // Кусок ищется уже по base (со второго символа), поэтому в отрезанный первый попасть не
        // может — но зажимаем на всякий случай, чтобы срез не ушёл левее начала .pat-txt.
        const ps = Math.max(from, partStart), pe = Math.max(ps, partEnd);
        textHtml = esc(p.text.slice(from, ps)) +
          '<span style="color:' + allPatColor(i) + ' !important;font-weight:700">' +
          esc(p.text.slice(ps, pe)) + '</span>' +
          esc(p.text.slice(pe));
      } else {
        textHtml = esc(p.text.slice(from));
      }

      // "🌈 Все паттерны" — нашедшийся паттерн красится СВОИМ цветом (тем же, что и его
      // биты в строке результата, см. allPatColor) прямо в колонке паттернов: сразу видно, какие
      // из них уже найдены и где именно. При ЧАСТИЧНОЙ находке цвет уже висит на самом куске
      // (см. textHtml выше), и всю ячейку им красить нельзя — иначе непонятно, что нашлась часть.
      // mode === null — находка НЕ из фон-поиска, а прямо из сквозной склейки строк (так работает
      // "🌈 Все паттерны" при выключенном фон-поиске, см. allPatSelfHits). Режима там нет и
      // называть в подсказке нечего.
      const allHitStyle = allHit
        ? (partStart >= 0 ? '' : ' style="color:' + allPatColor(i) + ' !important;font-weight:700"') +
          ' title="' +
          (allHit.mode ? ('Найден режимом «' + esc(bgModeLabel(allHit.mode)) + '»')
                       : 'Найден в строках цепочки') +
          (partStart >= 0 ? (' — только часть, ' + (partEnd - partStart) + ' из ' + p.text.length + ' бит') : '') +
          ' (' + KIND_LABELS_RU[allHit.kind] + ')"'
        : '';
      // У ЛЕВОЙ колонки номер идёт ПОСЛЕ текста (то есть справа от паттерна), у правой — ДО него
      // (слева), см. body.patnum-* в CSS: сторона фиксированная, запрос пользователя.
      // Сам текст паттерна — в своей обёртке .pat-txt (v0.902, запрос пользователя "найденные
      // паттерны фон только на битах паттернов, не вся строка"). Заливки находки/выделения висят
      // теперь на ней, а не на ячейке .pat: ячейка — колонка фиксированной ширины, и фон на ней
      // растягивался на всю её длину, читаясь как подсветка целой строки. Номер строки и метка
      // шага (#N) в обёртку не входят намеренно — они не часть паттерна.
      // skipHead — отрезанный "⏭ Без 1-го" первый символ, СНАРУЖИ заливки (см. выше).
      const patTxtHtml = skipHead + '<span class="pat-txt">' + textHtml + '</span>';
      pat = '<span class="' + c + '"' + allHitStyle + '>' + patTxtHtml + numLeftHtml + stepHtml + '</span>';
      patRight = '<span class="' + c2 + '"' + allHitStyle + '>' + numRightHtml + patTxtHtml + stepHtml + '</span>';
    } else {
      pat = '<span class="pat">' + numLeftHtml + '</span>';
      patRight = '<span class="pat2">' + numRightHtml + '</span>';
    }

    // "Ось 1.2" (st.align==="axis12") — по галке "⊙ Ось: сдвиг только на «1»/между «1-0»"
    // (st.axisSnap): включена — строки БЕЗ пары «1»→«0» вообще (см. rowHasOneZeroPair) двигать
    // некуда и не на что вставать осью — запрос пользователя ("заморозь, такие строки где нет
    // 11"): просто "По центру", без осевой геометрии. Выключена — ограничения «1»→«0» нет вообще
    // (зазор между ЛЮБЫМИ соседними символами), замораживать нечего. Строки с парой «1»→«0» (или
    // любые, если галка выкл) — та же геометрия оси, что у "⊙ Ось" (axisRowShift), просто зазор
    // между off/off+1, а не сам бит.
    const axis12Frozen = st.align === "axis12" && st.axisSnap && !rowHasOneZeroPair(s);
    // Длина для расчёта — СОБСТВЕННАЯ длина строки. Считать её вместе с зеркалами (чтобы строка
    // встала как после вписывания) я пробовал — выравнивание от этого разъезжается: у строк разной
    // длины прибавка разная, и центр перестаёт быть центром. Место под зеркала даётся иначе —
    // ОДИНАКОВОЙ прибавкой ко всем строкам сразу, см. mirrorPadL/mirrorPadR в начале render().
    const geomLen = s.length;
    const shift = s.length ? (
      st.align === "axis" ? axisRowShift(maxLen, i, geomLen) :
      st.align === "axis12" ? (axis12Frozen ? alignShift(maxLen, geomLen, "center") : axisRowShift(maxLen, i, s.length)) :
      /* ОсьБит с "семенем" (первое нажатие ↥/↥½, см. st.axisBitSeedAlign в обработчике кнопок):
         сдвиг ОсьБита прибавляется К ПОЗИЦИИ В ПРЕЖНЕМ ВЫРАВНИВАНИИ, а не заменяет её. Пока
         ОсьБит строку не двигал, его сдвиг равен нулю — строка стоит ровно там, где стояла. А
         когда двинули, она едет ОТ ЭТОГО ЖЕ МЕСТА на столько, на сколько её сдвинул ОсьБит
         (v0.883, запрос пользователя: "когда сдвигаю, надо чтобы с того же места двигались,
         сейчас скачут куда-то"). Раньше строка с записью в axisBitShiftMap разом переходила на
         АБСОЛЮТНЫЙ сдвиг ОсьБита — отсчёт у него от левого края, отсюда и прыжок. */
      (st.align === "axisbit" || st.align === "axisbit12")
        ? (st.axisBitSeedAlign
            ? alignShift(maxLen, geomLen, st.axisBitSeedAlign, i) + resolveAxisBitShift(i)
            : resolveAxisBitShift(i)) :
      alignShift(maxLen, geomLen, st.align, i)
    ) : 0;
    // Левый отступ строки растёт на место под зеркала, правый считается уже от него.
    const shiftPad = shift + mirrorPadL;
    const padRight = s.length ? (renderWidth - s.length - shiftPad) : renderWidth;
    const marks = hl.get(i);
    // Оси, действующие НА ЭТУ строку (см. axisColorMapForRow): зоны строчных групп не
    // перекрываются, поэтому у каждой строки максимум одна группа — её цветом и красим.
    const axisRowColorMap = axisColorMapForRow(i);
    // ДИАГОНАЛЬНЫЕ оси ("⤡ Диагональные столбцы на «½»") — сразу картой ЛОКАЛЬНЫХ индексов этой
    // строки, без пересчёта столбцов в цикле по битам (см. axisLocalIdxMapForRow). null — режим
    // выключен или выравнивание не "½": работает прежняя вертикальная ветка ниже.
    const axisDiagLocalMap = axisDiagSlope2x(st.align) !== 0 ? axisLocalIdxMapForRow(i, s.length, st.align) : null;

    // Выравнивание "по полубитам" (см. #alignGrp data-val="halfcenter"/"halfstairs") — чисто
    // визуальная поправка поверх целочисленного сдвига: alignShift() уже даёт его округлённым
    // вниз (diff >> 1 у halfcenter, (len-1) >> 1 у halfstairs), но при НЕЧЁТНОМ остатке это на
    // полсимвола левее истинного положения (напр. "1" против "11" — целочисленный центр ставит
    // "1" вплотную к первой "1", а не строго между ними). Тут же довешиваем ровно эти
    // недостающие 0.5ch трансформом — сами данные/расчёты столбцов (alignShift, Тетрис,
    // фон-поиск, клик по линейке и т.п.) не трогаем и не знают об этом сдвиге, только
    // визуальный рендер этой строки. У halfcenter "нечётность" — от (maxLen - len), у
    // halfstairs — от (len - 1), т.к. сам сдвиг считается по-разному.
    // "Ось 1.2" — у строк С парой «1»→«0» (не заморожена) ось стоит В ЗАЗОРЕ между двумя символами
    // (см. shiftOneRowAxisAware ниже), а не НА символе — та же техника 0.5ch, что и у
    // halfcenter/halfstairs, но сдвиг ВСЕГДА (не по чётности) и в МИНУС (строка целиком на пол
    // символа ЛЕВЕЕ обычного, чтобы граница между off и off+1 пришлась ровно на ось).
    const isAxisBetween = st.align === "axis12" && !axis12Frozen;
    // "ОсьБит ½" — та же идея, что "Ось 1.2"/isAxisBetween выше, но ось не фиксированный столбец,
    // а зазор «1»→«0» СТРОКИ ВЫШЕ. Поправка нужна не у КАЖДОЙ строки подряд, а по ЧЁТНОСТИ
    // axisBitHalfSteps (см. её комментарий) — иначе два "минус пол-символа" подряд гасят друг
    // друга и полушаговая связь ломается на целый бит через одну строку.
    const isAxisBitBetween = st.align === "axisbit12" && (axisBitHalfSteps(i) % 2 === 1);
    // "⊙ Ось"/"Ось 1.2" — при ОТРИЦАТЕЛЬНОМ shift строка должна свободно уезжать ЛЕВЕЕ .bits
    // (запрос пользователя "не тормозятся, а уходят свободно, скрываясь за паттернами") —
    // blankRun() не может напечатать отрицательный отступ, поэтому недостающую часть (shift
    // символов) довешиваем этим же 0.5ch-трансформом, просто целым числом символов, а не долей.
    let extraCh = 0;
    if (st.align === "halfcenter" && (maxLen - s.length) % 2 !== 0) extraCh += 0.5;
    // "Лесенка ½"/"Лесенка правая ½" — от чётности НОМЕРА строки (их сдвиг тоже считается от
    // номера, см. alignShift()), а не от длины, как у "Центр ½" выше. См. hasHalfNudge().
    // Полшага у "½"-лесенок — по чётности СТУПЕНИ, а не строки (см. stairsStepIdx): при
    // группировке строки внутри одной ступени обязаны стоять ровно друг под другом.
    if ((st.align === "halfstairs" || st.align === "rhalfstairs") &&
        stairsUnits(st.align, i) % 2 !== 0) extraCh += 0.5;
    if (isAxisBetween) extraCh -= 0.5;
    if (isAxisBitBetween) extraCh -= 0.5;
    if (shift < 0) extraCh += shift;
    // Сдвиг ручки #axisSplit — ОДИНАКОВЫЙ довесок ко ВСЕМ строкам разом (и к линейке столбцов,
    // см. renderColHeader()). Именно потому, что он одинаковый, он не может ничего перекосить:
    // вся картинка едет как одно целое. Раньше он прибавлялся к shift КАЖДОЙ строки по
    // отдельности (внутри alignShift) — и строки с положительным shift печатались пробелами, а
    // ушедшие в минус — трансформом, из-за чего два разных механизма расходились по субпикселям
    // и пирамида кривела тем сильнее, чем дальше утащили ручку (запрос пользователя — "при
    // центр. выравнивании кривая пирамида, по мере перемещения за линию центра изменяется").
    extraCh += (st.axisCenterOffset || 0);
    // "◀ Зеркало влево" — рисуется ВНУТРИ левого отступа строки и НИЧЕГО не двигает. Пробовал
    // печатать его целиком, вынося левее отступа и возвращая строку трансформом (чтобы не обрезалось)
    // — от этого разъезжалось выравнивание, поэтому вернул как было: что влезло в отступ, то и видно
    // (запрос пользователя "зеркала стали рушить выравнивание, сделай как до этого было").
    const lmSrc = (st.leftMirror && i >= mirrorFrom && i <= mirrorTo && s.length > 1) ? mirrorSideBits(sRaw.slice(1), "l") : "";
    // "⊘ Ось ◀/▶" (см. mirrorCutOf в ядре): опорный бит зеркала — первый бит строки у левого,
    // последний у правого — просто НЕ ПЕЧАТАЕТСЯ. Ничего пересчитывать не надо: соседние символы
    // сами сдвигаются на его место, и зеркало смыкается с остатком строки вплотную (левый отступ
    // строки и её сдвиг выравнивания при этом не трогаются — строка становится на бит короче,
    // и хвост пустого места справа тоже).
    const mirRowHere = i >= mirrorFrom && i <= mirrorTo && s.length > 1;
    const cutHead = mirRowHere && mirrorCutOf("l");
    const cutTail = mirRowHere && mirrorCutOf("r");
    const shownRowLen = s.length - (cutHead ? 1 : 0) - (cutTail ? 1 : 0);
    // px, не CSS "ch" — colStepPx (см. её комментарий в начале render()) учитывает letter-spacing,
    // как и реальный текст строки; чистый "ch" его игнорирует и на большом сдвиге накапливал
    // видимый диагональный перекос столбцов относительно печатных (не-transform) строк.
    const halfShiftAttr = s.length && extraCh !== 0 ? ' style="transform:translateX(' + (extraCh * colStepPx).toFixed(2) + 'px)"' : '';

    // Эта строка — сама целевая строка? (сквозная цепочка Гориз.XOR теперь всегда = эта же
    // строка, "чужих" строк-цепочки выше больше нет — см. horizSelfChain())
    const isHxTargetRow = hxActive && !hxExhausted && i === hxTarget;

    const isColSel = st.selectedCol >= 0 && i >= colSelRange.lo && i <= colSelRange.hi;
    // В "½"-выравниваниях (Центр ½/Лесенка ½/Лесенка правая ½) половина строк стоит на полсимвола
    // в сторону (см. hasHalfNudge/extraCh выше) — вертикальный столбец физически проходит только
    // через строки ОДНОЙ под-сетки, вторая половина строк пропускается. ВАЖНО: пропускать надо не
    // "все сдвинутые строки", а те, чья под-сетка НЕ СОВПАДАЕТ С ЯКОРНОЙ строкой (с той, по
    // которой столбец/ось и назначали). Раньше сравнения с якорем не было, и если сама якорная
    // строка стояла на полусетке (запрос пользователя: 1-я строка "1", 2-я "11"), подсветка
    // выпадала именно из неё, а появлялась на соседней. Теперь: якорь без нуджа — светятся строки
    // без нуджа (1-я и 3-я в примере "1"/"11"/"111"), якорь с нуджем — светятся строки с нуджем.
    const rowHalfNudge = isHalfNudgeAlign && hasHalfNudge(s, maxLen, st.align, i);
    const skipColHighlight = isHalfNudgeAlign && rowHalfNudge !== selAnchorNudge;

    // Пустой участок строки (до сдвига выравнивания или после конца короткой/пустой строки) —
    // если выбранный столбец попадает именно сюда (в этой строке для него просто нет бита),
    // всё равно подсвечиваем один "пустой" символ на его месте, чтобы подсветка столбца шла
    // сплошной линией по всем строкам диапазона, а не пропускала короткие/пустые строки.
    // При включённой "0 вместо пустот" (st.padZero) пустоты рисуются не пробелами, а теми самыми
    // приглушёнными нулями, которые склейки/XOR реально подставляют на этих местах — ТОЛЬКО
    // видимость, в st.rows ничего не пишется (запрос пользователя: "эти 0 добавить в строки как
    // видимость только"). Ограничено участвующими строками и занятыми ими столбцами — см.
    // padRowSet/padCols выше. Пустые строки исключены и там, и тут: алгоритмы их вообще
    // пропускают (см. vertColumnPlan/xorRowsFiltered — там `if (!s.length) continue`).
    const ghostZero = st.padZero && s.length > 0 && padRowSet && padRowSet.has(i);
    const blankRun = (startCol, len) => {
      if (len <= 0) return "";
      // БЫСТРЫЙ ПУТЬ: ни ghost-нулей, ни выбранного столбца в этом отрезке — отдаём одной
      // строкой, как было до появления "0 вместо пустот". Иначе на каждую строку шёл посимвольный
      // цикл по ВСЕЙ ширине полотна (а у "Лесенки" ширина растёт с числом строк), и при сотне
      // строк это десятки тысяч итераций со склейкой строк на КАЖДЫЙ render — из-за чего
      // интерфейс и начал тормозить.
      // Подсветка выбранного столбца (.col-sel-bit) НЕ ставится на пустых/паддинговых местах —
      // там нет настоящего бита строки, подсвечивать нечего (запрос пользователя: "эта [метка]
      // над строками/в 0 строке не нужна"). Пустой участок теперь просто пустой участок, с
      // ghost-нулём или без.
      if (!ghostZero) return "&nbsp;".repeat(len);
      let outRun = "";
      for (let t = 0; t < len; t++) {
        const c = startCol + t;
        // Ноль ставим, только если этот столбец реально занят кем-то из участвующих строк —
        // за их пределами (слева/справа от общей занятой области) остаётся пустое место.
        const ghost = padCols.has(c);
        outRun += ghost ? '<span class="pad-zero-bit">0</span>' : "&nbsp;";
      }
      return outRun;
    };
    // "◀ Зеркало влево" (st.leftMirror, спец-кнопка в панели "Вверх"): слева от строки печатается ЕЁ
    // ЖЕ зеркало от первого бита — сам первый бит в зеркало НЕ входит, — с инвертированными битами
    // и серым цветом. Это ТОЛЬКО ПОКАЗ: данные не меняются, в склейки/поиск эти биты не идут и на
    // лестничное выравнивание не влияют (запрос пользователя) — сдвиг строки считается как всегда,
    // зеркало просто занимает место в её левом отступе. Не хватило отступа — печатаем ту часть
    // зеркала, что влезла (левее полотна печатать некуда).
    let bits;
    if (lmSrc) {
      const room = Math.max(0, shiftPad);
      const shown = lmSrc.length <= room ? lmSrc : lmSrc.slice(lmSrc.length - room);
      bits = blankRun(0, room - shown.length) + '<span class="lm-bit">' + esc(shown) + '</span>';
    } else {
      bits = blankRun(0, Math.max(0, shiftPad));
    }
    if (st.runsAsBits) {
      // "Пробеги вместо битов" — см. formatRunsHtml()/computeRowBalance() выше: сама строка
      // "0"/"1" заменена её пробегами, посимвольные подсветки в этом режиме не считаем (не имеют
      // смысла — пробег уже не один символ).
      bits += formatRunsHtml(rowBal.runs);
    } else {
    // Особая подсветка "01" (см. #bHighlight01) — считается один раз на строку (не на символ):
    // красит ВЕСЬ пробег нулей перед единицей целиком (напр. "0001" — все 4 символа), а не
    // только последний "0" рядом с "1". Единица, перед которой нет ни одного "0" (например,
    // сразу после другой единицы), не красится.
    const hl01Mask = st.highlight01 ? hl01MaskFor(i, s) : null; // построчный кэш, см. hl01MaskFor
    // Позиции найденного паттерна в ЭТОЙ строке (см. patChainHitRows выше) — null, если цепочка
    // не активна, находки ещё нет или в этой строке паттерн не лежит.
    const patChainHitMap = patChainHitRows ? patChainHitRows.get(i) : null;

    // Биты, изменённые "🎭 Маской" (см. maskApply) — красные, пока не тронут любой бит, пока
    // окраска не выключена кнопкой 🎨 (maskColorOn) и пока включён общий выключатель "🔴 Изм. биты".
    const maskFlagsRow = (maskColorOn && chgBitsOn) ? maskChangedMap.get(i) : null;

    // СКЛЕЙКА СОСЕДНИХ БИТОВ. Раньше на КАЖДЫЙ символ строки выпускался свой <span> — на картинке
    // 1000 строк по 1000 символов это до полумиллиона узлов DOM (десятки мегабайт HTML на один
    // innerHTML и сотни мегабайт памяти под сами элементы). Но подряд идущие биты сплошь и рядом
    // оформлены ОДИНАКОВО (два нуля подряд, кусок найденного паттерна, отрезок диагонали), а для
    // раскладки безразлично, лежат они в одном span'е или в десяти: letter-spacing добавляется
    // ПОСЛЕ каждого символа независимо от границ inline-элементов, поэтому геометрия не меняется
    // ни на пиксель. Копим подряд идущие биты с ОДНИМ И ТЕМ ЖЕ открывающим тегом и выпускаем их
    // одним span'ом.
    // Исключение — биты с data-col (режимы "🔢 Выбор столбца"/выбора ячеек): их номер столбца свой
    // у каждого, по нему мышь и собирает набор (см. colAttr ниже, highlightColumn и обработчик
    // mousedown), поэтому такие идут отдельными span'ами, как и раньше.
    let runOpen = null, runText = "";
    const flushRun = () => {
      if (runOpen === null) return;
      bits += runOpen ? (runOpen + runText + "</span>") : runText;
      runOpen = null; runText = "";
    };
    // open — открывающий тег целиком ("" = голый текст без span'а); mergeable=false выпускает бит
    // отдельным элементом (у него собственный data-col, склеивать нельзя).
    const emit = (open, ch, mergeable) => {
      if (mergeable && runOpen === open) { runText += ch; return; }
      flushRun();
      if (!mergeable) { bits += open ? (open + ch + "</span>") : ch; return; }
      runOpen = open; runText = ch;
    };

    // Всё это — свойства СТРОКИ, а не символа: раньше они доставались из Map заново на каждый бит
    // (полмиллиона лишних Map.get на кадр), хотя внутри строки не меняются.
    const invFlagsRow = invFlagsMap.get(i);
    const insFlagsRow = insertedFlagsMap.get(i);
    // Совпадения с образцом из выбранных ячеек — см. cellSampleRows выше.
    const sampleRow = cellSampleRows ? cellSampleRows.get(i) : null;
    const pinRow = cellPinRows ? cellPinRows.get(i) : null;   // зафиксированные биты этой строки
    // «Новые» биты этой строки (дописанные построением/зеркалом) — см. newBitsMap.
    const newFlagsRow = newBitsMap.get(i);
    const envRow = envPreview ? envPreview.cells.get(i) : null;
    const prevRow = prevRows ? prevRows[i] : null;
    const allPatRow = allPatRows ? allPatRows.get(i) : null; // "🌈 Все паттерны", см. выше

    for (let k = 0; k < s.length; k++) {
      // Срезанный опорный бит зеркала (см. cutHead/cutTail выше) — не печатаем вовсе.
      if ((cutHead && k === 0) || (cutTail && k === s.length - 1)) continue;
      const bit = s[k];
      const patChainHit = patChainHitMap ? patChainHitMap[k] : null;
      const isMaskBit = !!(maskFlagsRow && maskFlagsRow.length === s.length && maskFlagsRow[k]);
      let isXoredBit = false;
      if (isHxTargetRow && hxWin) {
        const globalIdx = hxChainLenAll + k;
        isXoredBit = globalIdx >= hxWin.start && globalIdx <= hxWin.end;
      }
      // Раньше строки, стоящие на "полусетке" ½-выравниваний, из подсветки выбранного столбца
      // ВЫПАДАЛИ (skipColHighlight) — линия шла через строку. Запрос пользователя: "не выделяются
      // нечётные строки, они также должны выделяться". Теперь подсвечиваем биты и там: у сдвинутой
      // на полсимвола строки берём бит с тем же индексом столбца (он стоит на полстолбца правее),
      // так что подсветка идёт по ВСЕМ строкам диапазона, чуть зигзагом. Ось (isAxisColBit ниже)
      // по-прежнему живёт по своим правилам — у неё есть отдельная галка "диагональные столбцы".
      const isColSelBit = isColSel && !skipColHighlight && (shift + k) === st.selectedCol;
      // Назначенный "⊙ Ось сюда" столбец красим во ВСЕХ строках, а не только в диапазоне
      // выделения: это не выделение, а постоянная метка "сюда целится Круг". С галкой
      // "⤡ Диагональные столбцы на «½»" ось — НАКЛОННАЯ линия, и попадание считается по локальному
      // индексу бита (axisDiagLocalMap), поэтому skipColHighlight тут не нужен: линия сама проходит
      // через реальные биты строк ОБЕИХ чётностей. Без галки — тот же наивный "shift + k", но
      // строки с полусеточным нуджем БОЛЬШЕ НЕ гасятся (запрос пользователя: строка-источник с
      // нечётным остатком сама выпадала из подсветки, и ось было видно только на соседней строке).
      let axisGroupIdx = axisDiagLocalMap
        ? axisDiagLocalMap.get(k)
        : (axisRowColorMap ? axisRowColorMap.get(shift + k) : undefined);
      // У ВЕРТИКАЛЬНОЙ оси под-сетка сверяется с якорем ИМЕННО ЭТОЙ группы (axisGroupNudge), а не
      // с выделенной строкой: групп может быть несколько, у каждой свой источник ("⊙ Оси по «1»"
      // ставит якорем строку-источник, ручной клик — верхнюю выделенную).
      if (!axisDiagLocalMap && axisGroupIdx !== undefined && axisGroupNudge &&
          axisGroupNudge[axisGroupIdx] !== rowHalfNudge) axisGroupIdx = undefined;
      const isAxisColBit = axisGroupIdx !== undefined;

      // В режиме выбора ячеек номер столбца нужен КАЖДОМУ биту (по нему мышь и собирает набор),
      // а не только строкам из colSelectRowRange().
      // colPickMode — тоже всем битам: в этом режиме столбец выбирают кликом по любому символу,
      // в том числе ниже выделенной строки (подсветка при этом остаётся в своём диапазоне).
      const colAttr = (cellSelMode || colPickMode || (i >= colSelRange.lo && i <= colSelRange.hi))
        ? (' data-col="' + (shift + k) + '"') : "";
      // Подсветка выбранных ячеек видна и с выключенным режимом добавления, если по ним включены
      // "⊙ Оси по битам": такие ячейки активны сами по себе — по ним стоят оси.
      const isCellSel = (cellSelMode || (typeof bitAxisMode !== "undefined" && bitAxisMode)) &&
        cellSel.size && cellSel.has(i + "|" + (shift + k));

      const is01Pair = hl01Mask ? hl01Mask[k] : false;
      // "1 правее 1" — соседа ищем в САМОЙ строке (без масок и предрасчёта): единица, слева от
      // которой стоит другая единица.
      const is1Right = st.highlight1Right && bit === '1' && k > 0 && s[k - 1] === '1';
      // "1 под 1"/"1 по диагонали" — только для "1" (не для "0"), см. computeVertOnesMask()/
      // computeDiagOnesMask() выше.
      const isVert1 = !!(vertOnesMask && vertOnesMask[i] && bit === '1' && vertOnesMask[i].has(k));
      const isDiag1 = !!(diagOnesMask && diagOnesMask[i] && bit === '1' && diagOnesMask[i].has(k));
      // "Диагонали склейки" — в отличие от подсветок выше красит и "0" тоже: это сама линия
      // обхода, а не найденная единица. Значение маски (0/1) — чётность номера диагонали, ею
      // чередуется яркость соседних линий (.hldf-alt).
      const diagFoldOrd = (diagFoldMask && diagFoldMask[i] && (bit === '0' || bit === '1')) ? diagFoldMask[i].get(k) : undefined;
      const isDiagFold = diagFoldOrd !== undefined;
      // Бит, сейчас находящийся в перевёрнутом состоянии (нечётное число переходов границы) —
      // см. invFlagsMap выше (сама строка флагов взята до цикла).
      const isInvBit = !!(invFlagsRow && invFlagsRow.length === s.length && invFlagsRow[k]);
      // Вставленный символ (см. insertedFlagsMap/"🔴 Инверсия между символами").
      const isInsBit = !!(insFlagsRow && insFlagsRow.length === s.length && insFlagsRow[k]);
      // Дописанный построением/зеркалом бит (см. newBitsMap/.bit-new). Пометка держится, пока её
      // не снимут кнопкой "✕" рядом с цветом «Нов» в "Виде", — переживает сохранение и Сброс.
      const isNewBit = !!(newFlagsRow && newFlagsRow.length === s.length && newFlagsRow[k]);
      // Показанная (ещё не выполненная) линия сгиба "✉ Конверт" — см. envPreview.
      const isEnvDiag = !!(envRow && envRow.has(k) && (bit === '0' || bit === '1'));
      // Номер паттерна, накрывшего этот бит в режиме "🌈 Все паттерны" (см. allPatRows).
      const allPatBit = allPatRow ? allPatRow[k] : undefined;
      // Бит, перевёрнутый ПОСЛЕДНИМ шагом (см. prevRows). Только настоящая смена значения:
      // 1→1 и 0→0 не считаются.
      const isChgBit = showChgBits && !!(prevRow && prevRow.length === s.length && (bit === '0' || bit === '1') &&
        (prevRow[k] === '0' || prevRow[k] === '1') && prevRow[k] !== bit);

      // mrg — можно ли приклеить этот бит к предыдущему (см. emit/flushRun выше): нельзя, когда у
      // бита свой data-col.
      const mrg = !colAttr;

      // К какой группе маски относится этот бит (см. mpBgMask выше): 1 — под «1» маски,
      // 0 — под «0», null — подсветка не про этот бит. Это же деление показывает, какие биты
      // поедут одним кольцом «⇄ Сдвига по маске», а какие другим — маска общая.
      let mpGrp = null;
      if (mpBgMask && i >= mpBgRange.lo && i <= mpBgRange.hi) {
        // + mpBgPhase — та же арифметика, что в applyPickMask(): фаза сдвигает маску по её же
        // символам. Так подсветка в строках показывает ровно ту фазу, что выбрана кнопкой
        // "🎭 Фаза маски" / кликом по фазе в Черновике.
        const gi = (mpBgOff ? mpBgOff[i] : 0) + k + mpBgPhase;
        mpGrp = mpBgMask[gi % mpBgMask.length] === "1" ? 1 : 0;
      }

      const sampleKind = (sampleRow && sampleRow.length === s.length) ? sampleRow[k] : -1;
      if (isCellSel && (bit === '0' || bit === '1')) {
        // Выбранная курсором ячейка — поверх любых других подсветок: это то, с чем сейчас работают
        // кнопки «Инв. ячеек»/«90° ячеек»/«Сдвиг».
        emit('<span class="b' + bit + ' cell-sel"' + colAttr + '>', bit, mrg);
      } else if (pinRow && pinRow.has(k) && (bit === '0' || bit === '1')) {
        // Накопитель "📌 Зафиксировать" — ВЫШЕ свежей находки: смысл набора в том, что он держится,
        // когда образец сменили и подсветка находки уже про другое место.
        emit('<span class="b' + bit + ' cell-pin" title="Зафиксированный бит (📌). Escape или выключение «🔎 Показать» — сбросить набор"' + colAttr + '>', bit, mrg);
      } else if (sampleKind >= 0 && (bit === '0' || bit === '1')) {
        // Совпадение с образцом из выбранных ячеек ("🔎 Показать выделенное") — теми же цветами,
        // что и находки фон-поиска, чтобы читалось как одно и то же "нашлось".
        emit('<span class="b' + bit + ' chain-hit-bits' + (KIND_CLS[sampleKind] ? ' ' + KIND_CLS[sampleKind] : '') +
          '" title="Совпало с выбранными ячейками"' + colAttr + '>', bit, mrg);
      } else if (isEnvDiag) {
        // Линия сгиба показывается ПОВЕРХ прочих подсветок: сейчас важно только одно — где пойдёт
        // сгиб, если нажать "Конверт" второй раз.
        emit('<span class="env-diag" title="Линия сгиба «Конверта» — нажмите кнопку ещё раз, чтобы сложить"' + colAttr + '>', bit, mrg);
      } else if (marks && marks.has(k)) {
        emit('<span class="' + hitCls + '"' + colAttr + '>', bit, mrg);
      } else if (isMaskBit && (bit === '0' || bit === '1')) {
        emit('<span class="b' + bit + ' bit-chg" title="Изменён «Маской»"' + colAttr + '>', bit, mrg);
      } else if (patChainHit && (bit === '0' || bit === '1')) {
        // Найденный "🧩 Паттерн-цепочкой" паттерн — теми же цветами, что и в окне "Результат"
        // (.chain-hit-bits + kind/skip1), чтобы подсветка в строках и в результате читались как
        // одно и то же совпадение.
        const hitClsRow = 'b' + bit + ' chain-hit-bits' +
          (KIND_CLS[patChainHit.kind] ? ' ' + KIND_CLS[patChainHit.kind] : '') +
          (patChainHit.skip ? ' skip1' : '');
        emit('<span class="' + hitClsRow + '" title="Найденный паттерн"' + colAttr + '>', bit, mrg);
      } else if (isInvBit && (bit === '0' || bit === '1')) {
        emit('<span class="b' + bit + ' bit-inv" title="Перевёрнут переходом границы строки"' + colAttr + '>', bit, mrg);
      } else if (isInsBit && (bit === '0' || bit === '1')) {
        emit('<span class="b' + bit + ' bit-ins" title="Вставлен кнопкой «Инверсия между символами»"' + colAttr + '>', bit, mrg);
      } else if (isNewBit && (bit === '0' || bit === '1')) {
        emit('<span class="b' + bit + ' bit-new" title="Новый бит — дописан построением или зеркалом"' + colAttr + '>', bit, mrg);
      } else if (isChgBit) {
        emit('<span class="b' + bit + ' bit-chg" title="Изменён последним шагом"' + colAttr + '>', bit, mrg);
      } else if (isAxisColBit && (bit === '0' || bit === '1')) {
        emit('<span class="axis-col-bit ' + (AXIS_GROUP_CLS[axisGroupIdx % AXIS_GROUP_CLS.length]) + ' b' + bit + '" title="Ось для Круга, группа №' + (axisGroupIdx + 1) + ' («⊙ Ось сюда» / «⊙ Оси по «1» строки»)"' + colAttr + '>', bit, mrg);
      } else if (isColSelBit && (bit === '0' || bit === '1')) {
        emit('<span class="col-sel-bit b' + bit + '"' + colAttr + '>', bit, mrg);
      } else if (isXoredBit && (bit === '0' || bit === '1')) {
        emit('<span class="xored-bit"' + colAttr + '>', bit, mrg);
      } else if (is01Pair || is1Right || isVert1 || isDiag1 || isDiagFold) {
        // Несколько подсветок могут совпасть на одном символе — вешаем все подходящие классы;
        // порядок объявления в CSS (.hl01 → .hlv1 → .hld1 → .hldf) решает, чей цвет визуально победит.
        const hlCls = 'b' + bit + (is01Pair ? ' hl01' : '') + (is1Right ? ' hl11r' : '') + (isVert1 ? ' hlv1' : '') + (isDiag1 ? ' hld1' : '') +
          (isDiagFold ? (' hldf' + (foldBgStyle ? ' hldf-bg' : '')) : '');
        // Цвет — по порядку сбора (foldOrderColor): у поколоночных режимов красим фон, у
        // диагоналей сам символ.
        const foldStyle = isDiagFold
          ? ' style="' + (foldBgStyle ? 'background:' : 'color:') + foldOrderColor(diagFoldOrd, diagFoldMask.total || 1) + '"'
          : '';
        emit('<span class="' + hlCls + '"' + foldStyle + colAttr + '>', bit, mrg);
      } else if (allPatBit !== undefined && (bit === '0' || bit === '1')) {
        // "🌈 Все паттерны" — фон цветом САМОГО ПАТТЕРНА (тем же, что в колонке паттернов и в
        // окне "Результат"). Стоит последней из подсветок: это самая общая, справочная — любая
        // адресная (находка цепочки, изменённые биты, выбранная ячейка) должна её перебивать.
        emit('<span class="b' + bit + ' allpat-bit" style="background:' + allPatColor(allPatBit) +
             '" title="Найденный паттерн №' + (allPatBit + 1) + '"' + colAttr + '>', bit, mrg);
      } else if (mpGrp !== null && (bit === '0' || bit === '1')) {
        // Подсветка групп маски — самая нижняя по приоритету: краска справочная, любая адресная
        // подсветка (находка, изменённые биты, выбранная ячейка) должна её перебивать. Цвет —
        // инлайном, чтобы перекрыть обычные .b0/.b1 (у тех !important нет).
        // Подсказка сразу про оба смысла общей маски (v0.929): «1» — бит идёт в поиск и едет
        // кольцом единиц «⇄ Сдвига», «0» — выбрасывается из поиска и едет кольцом нулей.
        emit('<span class="b' + bit + '" style="color:' + mpColor[mpGrp] + '" title="' +
             (mpGrp ? 'Маска БЕРЁТ этот бит в поиск · кольцо «1» сдвига по маске'
                    : 'Маска выбрасывает этот бит · кольцо «0» сдвига по маске') +
             '"' + colAttr + '>', bit, mrg);
      } else if (bit === '0' || bit === '1') {
        // Самая массовая ветка — обычный неподсвеченный бит. Именно её склейка и убирает
        // основную массу узлов: подряд идущие одинаковые биты уходят одним span'ом.
        emit('<span class="b' + bit + '"' + colAttr + '>', bit, mrg);
      } else if (colAttr) {
        emit('<span' + colAttr + '>', esc(bit), false);
      } else {
        emit("", esc(bit), true);
      }
    }
    flushRun(); // хвост последнего пробега
    }

    // "▶ Зеркало вправо" (st.rightMirror) — пара к зеркалу влево: справа от строки её же отражение от
    // ПОСЛЕДНЕГО бита (сам последний бит в отражение не входит), биты инвертированы, цвет серый.
    // Тоже только показ: данных не меняет, в склейки и поиск не идёт, на выравнивание не влияет.
    // Не хватило правого отступа — печатаем ту часть, что влезла.
    const rmSrc = (st.rightMirror && i >= mirrorFrom && i <= mirrorTo && s.length > 1) ? mirrorSideBits(sRaw.slice(0, -1), "r") : "";
    if (rmSrc) {
      // В пределах правого отступа — как и слева, ширину полотна не расширяем.
      const shownR = rmSrc.length <= padRight ? rmSrc : rmSrc.slice(0, padRight);
      bits += '<span class="lm-bit">' + esc(shownR) + '</span>';
      // Начало хвоста считаем по НАПЕЧАТАННОЙ длине строки (shownRowLen): при срезанном опорном
      // бите она на бит короче самой строки, иначе "0 вместо пустот" ставила бы свои нули на
      // столбец правее, чем реально свободно.
      bits += blankRun(shiftPad + shownRowLen + shownR.length, padRight - shownR.length);
    } else {
      bits += blankRun(shiftPad + shownRowLen, padRight);
    }

    // Пока работает "🧩 Паттерн-цепочка" — ниже выделенной ярко светится только ПЕРВАЯ строка под
    // ней (та, чей паттерн сейчас ищется), все остальные идут тусклым (запрос пользователя).
    // Паттерн ложится и в них тоже, но по смыслу это уже хвост ниже искомой строки.
    // Отсчёт — от ТЕКУЩЕГО выделения (seqAnchorIdx), а не от st.patChainFilledTo: как только
    // выделение перепрыгнуло на найденную строку, следующая под ней должна загораться нормальным
    // цветом СРАЗУ (запрос пользователя), не дожидаясь очередной укладки паттерна.
    // При "⛔ Ниже выделенной — выкл" отключена и первая строка под выделенной — тускнеет и она.
    if ((st.patChainStep || 0) > 0 && i >= seqAnchorIdx() + (st.chainCutBelow ? 1 : 2)) {
      cls.push("pat-chain-dim");
    }
    // Номер строки — теперь ещё и вплотную к ЛЕВОМУ краю самого поля битов (не только снаружи
    // колонки паттерна слева). ПРАВЫЙ номер своей колонки больше не занимает — он ушёл ВНУТРЬ
    // ячейки П2 (см. numRightHtml выше), поэтому поле битов доходит до самой колонки паттернов.
    // Нумерация с 0 (не с 1) — см. запрос пользователя: первая строка получает номер "0".
    // КРАЙНЕГО ЛЕВОГО НОМЕРА (снаружи от П1) БОЛЬШЕ НЕТ — v0.858, запрос пользователя "номера из
    // левых паттернов удали". Слева остался только номер у самого поля бит (.num-l2), справа —
    // тот, что внутри ячейки П2. Строка теперь начинается прямо с колонки паттернов.
    // БАЛАНС ЖИВЁТ ВНУТРИ ПОЛЯ НОМЕРА (v0.889): отдельной колонки .row-balance между номером и
    // битами больше нет — метка и номер сидят в одном боксе, место под них обоих держит --num-w
    // (см. fitNumW/balanceSampleHtml). Заглушка в линейке столбцов тоже не нужна: ширина колонки
    // одна и та же и там, и тут.
    // ПОРЯДОК: сперва баланс, потом номер (v0.891, запрос пользователя "баланс перед номерами").
    // Метка кончается знаком "=" или "≠", и номер читается как правая часть равенства: "3+2=5"
    // — сумма единиц и нулей сошлась с номером строки, "3+1≠5" — не сошлась.
    out.push('<div class="' + cls.join(" ") + '" data-idx="' + i + '">' +
             pat + '<span class="' + numCls + ' num-l2">' + balanceHtml + numTxtL + "</span>" +
             '<span class="bits ' + alignCls + '"><span' + halfShiftAttr + '>' + bits + "</span></span>" +
             patRight + "</div>");
  }
  // Распорки вместо не нарисованных строк (см. vrowsRange) — держат высоту, поэтому полоса
  // прокрутки и позиция каждой строки такие же, как при полной отрисовке.
  const vTopPad = vr.lo * vr.pitch;
  const vBotPad = (n - 1 - vr.hi) * vr.pitch;
  document.getElementById("rows").innerHTML =
    (vTopPad > 0 ? '<div class="vspacer" style="height:' + vTopPad + 'px"></div>' : "") +
    out.join("") +
    (vBotPad > 0 ? '<div class="vspacer" style="height:' + vBotPad + 'px"></div>' : "");
  // Ширина колонки номеров (--num-w) — по самому длинному номеру, ОДНА на все строки, иначе
  // трёхзначные номера раздвигают свою строку и та едет вправо (см. fitNumW/.num в CSS).
  fitNumW(numPadW, balanceSampleHtml(balW1, balW0, balB1, balB0));
  // Ширина колонок паттернов — под самый длинный паттерн (см. fitPatW/fitPatW2): считается ПОСЛЕ
  // отрисовки строк, потому что шаг столбца меряется по реальным битам в DOM.
  fitPatW();
  fitPatW2();
  // Базовая ширина поля битов (--bits-w, см. .bits в CSS) — от длины САМОЙ ДЛИННОЙ СТРОКИ, а НЕ
  // от renderWidth: тот растёт от выравнивания (Лесенка сдвигает каждую строку), и раскладка
  // прыгала бы при каждом переключении ⇤/↔/⇥/↘ (запрос пользователя). Содержимое, вылезающее за
  // эту ширину (те же Лесенки), как и раньше просто рисуется поверх — ничего не обрезается.
  if (!bitsWManual) {
    const stepPx = realColStepPx();
    if (stepPx > 0 && maxLen > 0) {
      document.documentElement.style.setProperty("--bits-w", Math.round(maxLen * stepPx) + "px");
    }
  }
  // Разделители колонок — по реальной геометрии строки (строка может быть шире полотна).
  updateSplitPositions();

  let fullChainText = "";
  if (st.mode === "step1" || st.mode === "step2") {
    const aRow = st.rows[st.aIdx] || "";
    const bRow = st.rows[st.bIdx] || "";
    fullChainText = (st.tailBuffer || "") + aRow + bRow;
  } else if (st.mode === "horiz_xor" || st.mode === "horiz_xor_left") {
    // Та же скользящая цепочка, что реально используется в doStep — теперь всегда сама строка
    // bIdx (см. horizSelfChain()), не строки выше.
    fullChainText = st.horizBigChain || horizChainText(st.bIdx);
  } else {
    // Все строки от первой до "якорной" (seqAnchorIdx() — самая нижняя ВЫДЕЛЕННАЯ строка, а не
    // st.bIdx: та двигается только автопоиском/шагами, а этот блок должен живо реагировать на
    // ЛЮБОЙ ручной клик по строке — см. запрос пользователя "сквозная в результатах... сразу при
    // выделении строки отображается"), сама якорная строка НЕ входит. Не зависит от st.used[]
    // (тот не всегда надёжно заполнен). Это только для ПОКАЗА — реальный поиск паттернов
    // (buildChain) не трогаем. horizChainText() — та же самая функция, что и у Гориз.XOR/
    // "⧬ Интерлив сквозной".
    fullChainText = (st.tailBuffer || "") + horizChainText(seqAnchorIdx());
  }

  // Фоновый поиск (cBgSearch): показываем в этом же окне РЕАЛЬНО вычисленный результат
  // (интерлив / XOR пары / XOR всех выше+выделенной), который сравнивается с паттерном строки
  // ниже выделенной — вместо обычной сквозной строки, которая с этими режимами не связана и
  // не отражала бы, что именно проверяется на совпадение.
  const chainResultLabelEl = document.getElementById("chainResultLabel");
  let bgResultHtml = null;
  // HTML для отдельного окна результата (см. openResultPopup) — считается ТОЛЬКО когда окно
  // реально открыто, потому что там строки рисуются без потолка и это заметно дороже.
  let popupResultHtml = null;
  if (bgInfo) {
    /* Несколько включённых режимов сразу — каждый в своей строке-flex-ряду (label | check |
       bits), с пометкой найденного. Ширина колонки label — одна на все строки (bgLabelW, в ch,
       шрифт моноширинный), поэтому биты ВСЕХ строк начинаются строго в одном столбце
       независимо от того, какие именно режимы сейчас включены.
       ВАЖНО: галочки — в ОТДЕЛЬНОМ span'е (.chain-result-line-check), а не приклеены к тексту
       label — если их включать в bgLabelW/label-текст, у найденных строк label оказывался
       шире остальных, и колонка с битами у них уезжала вправо относительно ненайденных строк.
       Каждая строка по умолчанию обрезана в одну линию (long bit-строки иначе распирают окно)
       — клик по строке разворачивает её целиком (см. bgResultExpanded + обработчик клика на
       #chainText). Найденные участки (bgInfo.results[i].kinds) подсвечиваются по КАЖДОЙ
       найденной версии паттерна отдельно — прямая тем же жёлтым, что и .pat.bg-search-hit в
       самой таблице, инверсия фиолетовым, реверс зелёным, инверсия+реверс сразу розовым (те же
       цвета, что и везде в приложении для kind 0/1/2, см. KIND_CLS, плюс свой для 4-го варианта)
       — и в галочке-колонке ставится СВОЯ галочка на каждую найденную версию (может быть сразу
       несколько, если паттерн нашёлся и прямо, и инверсией/реверсом одновременно), тоже в цвет
       своей версии. Если версия нашлась именно через "⏭ Без 1-го" (без первого символа
       паттерна) — и подсветка бит, и галочка дополнительно приглушаются (класс .skip1, как
       .pat-skip у самого паттерна), чтобы было видно, что совпал укороченный вариант.
       После реальных бит строки дополнительно дорисовывается ПРОДОЛЖЕНИЕ КОЛЬЦА — ПОЛНЫЙ
       следующий виток ringNextLap(text) (весь, а не text.length-1 символов). В самом поиске
       (findPatternKinds) кольцо укорочено на 1 символ ЧИСТО ради экономии буфера — паттерн не
       длиннее строки, поэтому самому дальнему переезду через границу не нужен последний символ
       второго витка (тот же приём, что и в основном findMatch() выше по файлу, см. его пометку
       "Оптимизация 1"), на РЕЗУЛЬТАТ поиска это не влияет, полный виток дал бы то же самое.
       А вот для ПОКАЗА урезание было лишним и давало на глаз "усечённое" кольцо — 11111 с
       🔁 Инв. кольцо рисовало 111110000 (9 символов) вместо полного 1111100000 (10 символов),
       т.е. последний бит витка визуально терялся, хотя поиск его прекрасно учитывал) — класс
       .chain-ring-ext (opacity:.5, серым) вешается на ВЕСЬ второй виток ВСЕГДА (не только при
       включённой 🔁 Инв. кольцо), чтобы визуально отличать повторные/продолженные биты кольца
       от настоящих бит строки — независимо от того, инвертированы они или это точная копия.
       Индексы находок (kd.start/kd.len) по-прежнему укладываются в это продолжение без
       остатка (оно шире, чем то, что реально проверял поиск) — подсветка накладывается БЕЗ
       округления по модулю, "заехавшая" в кольцо находка рисуется как единый непрерывный
       подсвеченный кусок, переходящий из реальных бит в продолжение кольца. */
    const bgLabels = bgInfo.results.map(r => bgModeLabel(r.mode));
    const bgLabelW = Math.max(...bgLabels.map(l => l.length));
    const kindTag = k => KIND_LABELS_SHORT[k.kind] + (k.skip ? "⏭" : "");
    // Из каких именно строк (номер+содержимое) и с каким выравниванием считаются режимы
    // ниже — сама пара rowAbove/rowSel одна и та же для ВСЕХ режимов (xorAll/concat*/vert*/
    // snake* тоже отталкиваются от неё же, просто цепляют дополнительные строки выше) —
    // запрос пользователя: видеть "Строки 3+4 (Лесенка ½): 111+10000" прямо над списком,
    // а не гадать по вкладке "Строки" и панели выравнивания.
    const alignLabel = ALIGN_LABELS[st.align] || st.align;
    const srcLine = "Строки " + bgInfo.aboveIdx + "+" + bgInfo.selIdx + " (" + alignLabel + "): " + bgInfo.rowAbove + "+" + bgInfo.rowSel;
    fullChainText = srcLine + "\n" + bgInfo.results
      .map((r, i) => bgLabels[i].padEnd(bgLabelW, " ") + (r.matched ? " ✓[" + r.kinds.map(kindTag).join(",") + "]" : "") +
        // "🌈 Все паттерны" — какие именно паттерны нашлись в этой строке (для копирования)
        ((r.allHits && r.allHits.length) ? " 🌈[" + allHitsByPat(r.allHits).map(h => "№" + (h.patIdx + 1)).join(",") + "]" : "") +
        ": " + r.result)
      .join("\n");
    // Одна строка результата — вынесена в функцию, потому что рисуется ДВАЖДЫ: в самой панели
    // (с потолком отрисовки) и, если открыто отдельное окно результата, там же без потолка —
    // capOverride (см. openResultPopup/POPUP_RENDER_CAP).
    // Текущая "🎭 Маска" — нужна подсказкам строк (арифметика витков, см. maskNote ниже) и
    // приглушению галки "заново каждый виток" под таблицей результатов.
    const maskNow = (typeof maskBits === "function") ? maskBits() : "";
    const buildResultLine = (r, i, capOverride) => {
      const len = r.result.length;
      // Строка ОДНОЙ диагонали ("diagR#3") или поколоночного режима — её можно выбрать кликом,
      // и тогда её линия горит в таблице (см. st.diagFoldPick/computeDiagFoldMask).
      // "#" в имени режима бывает ДВУХ видов: у диагоналей это её номер ("diagR#3"), у фаз
      // "🎭 Маски" — "#мN" ("concatR#м2"). Диагональ — только первый: /#\d/ (v0.922). Раньше сюда
      // попадали и масочные строки, и клик по ним уходил в ветку выбора диагонали — то есть
      // включал радугу порядка обхода и не доходил до выбора находки (st.bgHitPick).
      const isDiagLine = /#\d/.test(r.mode) || VERT_PICK_MODES.includes(r.mode);
      const isPickedLine = isDiagLine && st.diagFoldPick === r.mode && st.highlightDiagFold;
      // Показываем РОВНО тот буфер, в котором искали (см. ringCycle/findPatternKinds): период
      // кольца, повторённый дважды. Без инверсии/реверса период = сама строка, и это прежнее
      // "строка + её копия". С 🔁 Инв. кольцо период уже двойной (прямой виток + инвертированный),
      // поэтому строка результата становится вчетверо длиннее исходной — иначе находку, начавшуюся
      // во втором витке и ушедшую за его край, просто нечем было бы показать.
      const cycle = ringCycle(r.result);
      // "🚫 Без кольца" — показываем ровно то, в чём искали: саму строку результата, без
      // продолжения кольца (запрос пользователя).
      const full = st.ringOff ? cycle : cycle + cycle;
      // Карта "какой kind (и его skip-флаг) покрывает этот символ" — приоритет у более раннего
      // kind (прямая версия перекрывает инверсию/реверс, если их диапазоны совпадают по позиции).
      // Индексы идут БЕЗ модуля — kd.start/kd.len уже посчитаны в раскладке text+ringExt.
      /* ПОТОЛОК ОТРИСОВКИ. Строка результата клипается CSS в одну линию
         (.chain-result-line-bits — overflow:hidden;white-space:nowrap), развернуть её можно
         кликом. При этом режимов включено до 18 сразу, у "Сквозной" длина результата равна сумме
         ВСЕХ строк цепочки, а с удвоением кольца это ещё ×2..×4 — итого десятки тысяч <span> на
         КАЖДЫЙ render(), которые всё равно не видны. Именно это и подвесило интерфейс.
         Рисуем только то, что реально может быть на виду; развёрнутая строка получает потолок
         побольше. На сам ПОИСК потолок не влияет — он уже отработал по полному кольцу. */
      const renderCap = capOverride || (bgResultExpanded.has(r.mode) ? 4000 : 400);
      const shown = Math.min(full.length, renderCap);
      /* ПЕРЕВОД ПОЗИЦИЙ ИЗ ПРОРЕЖЁННОЙ СТРОКИ В ПОЛНУЮ (v0.915, баг-репорт пользователя: "ищем
         10001, в цепочках подсветка норм, а в результатах подсвечены 1 и 0").
         С "🎭 Маской" поиск идёт по ПРОРЕЖЁННОЙ строке (matchOn/maskInfo.picked, см. mkResult), и
         r.kinds/r.allHits хранят позиции ИМЕННО В НЕЙ. Рисуем же мы строку ПОЛНУЮ — выброшенные
         маской биты не вырезаются, а гасятся (см. dimMaskedBits). Индексы поэтому означали разные
         биты: находка из 5 бит подсвечивала 5 подряд идущих позиций полной строки, то есть чужие
         биты, да ещё и не все свои.
         pickMap[j] — какой бит ПОЛНОЙ строки дал j-й бит прорежённой; строится тем же правилом,
         что и applyPickMask. За пределами первого периода добавляем целые периоды: находка могла
         начаться на витке кольца. Без маски карты нет и позиции идут как раньше, один в один. */
      const mi = r.maskInfo;
      let pickMap = null, pickBaseLen = len;
      if (mi && mi.mask && mi.mask.length) {
        pickBaseLen = mi.through ? len * 2 : len;
        pickMap = [];
        for (let j = 0; j < pickBaseLen; j++) if (mi.mask[(j + mi.phase) % mi.mask.length] === "1") pickMap.push(j);
      }
      const mapPos = (p) => {
        if (!pickMap || !pickMap.length) return p;
        const period = pickMap.length;
        const lap = Math.floor(p / period);
        return pickMap[p - lap * period] + lap * pickBaseLen;
      };
      const kindAt = new Array(shown).fill(-1);
      const skipAt = new Array(shown).fill(false);
      for (const kd of r.kinds) for (let i = 0; i < kd.len; i++) {
        const p = mapPos(kd.start + i);
        if (p < shown && kindAt[p] < 0) { kindAt[p] = kd.kind; skipAt[p] = kd.skip; }
      }
      // "🌈 Все паттерны": позиции найденных паттернов — каждый своим цветом (allPatColor по
      // номеру паттерна, тот же цвет получает и его ячейка в колонке паттернов). Перебор идёт
      // сверху вниз, и позиция достаётся ПЕРВОМУ, кто её занял — то есть паттерну выше по списку.
      const allPatAt = r.allHits && r.allHits.length ? new Array(shown).fill(-1) : null;
      // Те же позиции из прорежённой строки — findAllPatternsInResult() тоже искал в matchOn.
      if (allPatAt) for (const h of r.allHits) for (let i = 0; i < h.len; i++) {
        const p = mapPos(h.start + i);
        if (p < shown && allPatAt[p] < 0) allPatAt[p] = h.patIdx;
      }
      // Сколько витков реально показано: без инверсии/реверса период = самой строке и витков
      // два (строка + копия), с 🔁 Инв. кольцо период двойной и витков ЧЕТЫРЕ
      // (прямой, инвертированный, снова прямой, снова инвертированный).
      const lapCount = len ? Math.round(full.length / len) : 0;
      const lapTitle = (lap) => "Виток " + (lap + 1) + " из " + lapCount +
        (lap === 0 ? " — настоящие биты строки" : (lap % 2 === 0 ? " — повтор прямого витка" : " — следующий виток кольца"));
      // Виток оборачивается в ОДИН span целиком, а не помечается посимвольно: пунктир на
      // элементе шириной в один знак — это один-два штриха, которые на 100% масштаба браузера
      // округляются в ничто и проявляются только к 175% (запрос пользователя "не вижу
      // подчёркивания"). На обёртке во весь виток линия идёт непрерывно и видна при любом
      // масштабе. Посимвольные span'ы (подсветка находки/приглушение кольца) остаются внутри.
      let bits = "";
      for (let lap = 0; lap < lapCount; lap++) {
        const from = lap * len;
        if (from >= shown) break; // дальше потолка не рисуем — см. renderCap выше
        const to = Math.min(shown, from + len);
        let inner = "";
        for (let k = from; k < to; k++) {
          const ch = esc(full[k]);
          const kd = kindAt[k];
          const cls = [];
          if (kd >= 0) { cls.push("chain-hit-bits"); if (KIND_CLS[kd]) cls.push(KIND_CLS[kd]); if (skipAt[k]) cls.push("skip1"); }
          if (k >= len) cls.push("chain-ring-ext");
          // РАДУГИ ПОРЯДКА ОБХОДА В РЕЗУЛЬТАТАХ БОЛЬШЕ НЕТ (v0.922, запрос пользователя "в
          // результатах убери радужную подсветку вообще"). У выбранной строки-диагонали каждый бит
          // первого витка красился своим цветом по порядку сбора — вместе с находкой, галочками и
          // цветами «🌈 Все паттерны» строка превращалась в мешанину, в которой само совпадение
          // терялось. В самой таблице радуга остаётся (там она и нужна — показать порядок обхода),
          // выбранная строка по-прежнему помечена классом .picked.
          // Найденный паттерн из режима "🌈 Все паттерны" — своим цветом (перебивает
          // радугу порядка обхода, но не обычную подсветку искомого паттерна: та со своим
          // классом и приоритетом выше, см. kd).
          const allPatIdx = allPatAt ? allPatAt[k] : -1;
          const styleAttr = (allPatIdx >= 0 && kd < 0)
            ? ' style="color:' + allPatColor(allPatIdx) + '" title="Паттерн №' + (allPatIdx + 1) + ' (стр. ' + allPatIdx + ')"'
            : '';
          inner += (cls.length || styleAttr)
            ? ('<span' + (cls.length ? ' class="' + cls.join(" ") + '"' : '') + styleAttr + '>' + ch + '</span>')
            : ch;
        }
        // Фоном помечаем ВСЕ витки, кроме нулевого: он — настоящие биты строки, всё остальное
        // (повтор/инверсия кольца) должно быть видно как отдельные полосы (запрос пользователя
        // "фоном дубль кольца"). Классы .ring-lap-1/2/3 — см. CSS.
        // ...и ЯВНАЯ ВЕРТИКАЛЬНАЯ ЧЁРТОЧКА на стыке витков (запрос пользователя "сделай между ними
        // верт. чёрточки"): фон сам по себе на тёмном полотне читался плохо, а разделитель виден
        // всегда и сразу показывает, где кончились настоящие биты строки.
        bits += (lap > 0)
          ? ('<span class="ring-lap-sep" title="' + lapTitle(lap) + '">│</span>' +
             '<span class="ring-lap-' + (lap % 4) + '" title="' + lapTitle(lap) + '">' + inner + '</span>')
          : inner;
      }
      // Явная отметка, что строка урезана ради скорости — чтобы обрыв не выглядел как баг данных.
      if (shown < full.length) {
        bits += '<span class="chain-ring-ext" title="Показано ' + shown + ' символов из ' + full.length +
          ' — остальное не рисуется ради скорости. Клик по строке разворачивает её (потолок выше)">…</span>';
      }
      const checkHtml = r.kinds.map(kd =>
        '<span class="chain-result-line-check-mark' + (KIND_CLS[kd.kind] ? " " + KIND_CLS[kd.kind] : "") + (kd.skip ? " skip1" : "") + '" title="Найдено: ' + KIND_LABELS_RU[kd.kind] + (kd.skip ? " (без 1-го символа)" : "") + '">✓</span>'
      ).join("");
      // "🌈 Все паттерны" — СВОЙ столбец с номерами всех найденных в этой строке паттернов,
      // каждый своим цветом (тем же, что у его бит) и кликабельный: клик выделяет строку этого
      // паттерна в таблице.
      // По ОДНОМУ номеру на паттерн: при "🔁 Все вхождения" находок у одного паттерна много, и
      // список номеров иначе повторял бы его столько же раз.
      const hitsHtml = allHitsByPat(r.allHits).map(h =>
        '<span class="chain-hit-num" data-pat-idx="' + h.patIdx + '" style="color:' + allPatColor(h.patIdx) +
        '" title="Паттерн №' + (h.patIdx + 1) + ' (строка ' + h.patIdx + '), ' + KIND_LABELS_RU[h.kind] +
        (h.skip ? " (без 1-го символа)" : "") + ' — клик: выделить эту строку">' + (h.patIdx + 1) + '</span>'
      ).join("");
      const expanded = bgResultExpanded.has(r.mode) ? " expanded" : "";
      // hit-pick — чья находка сейчас разложена по строкам цепочки (см. st.bgHitPick/hitRes выше).
      // Отдельный класс, а не .picked: тот про выбранную диагональ и красит совсем другое.
      const pickedCls = (isPickedLine ? " picked" : "") +
        (r.matched && r.kinds && r.kinds.length && r.mode === st.bgHitPick ? " hit-pick" : "");
      /* АРИФМЕТИКА МАСКИ НА КОЛЬЦЕ — прямо в подсказке строки (запрос пользователя). Виток k
         сквозной маски начинается с фазы (k·длина) mod (длина маски), поэтому всё определяется
         НОД: он делит длину маски — значит различных положений N/НОД, а вся картина повторяется
         через НОК(длина, маска) бит. НОД равен длине маски (то есть маска делит строку) — витки
         одинаковы, и галка "заново каждый виток" ничего не меняет. */
      let maskNote = "";
      if (maskNow && /#м\d+$/.test(r.mode) && len) {
        const N = maskNow.length;
        const g = gcdInt(len, N);
        const per = lcmSafe(len, N);
        maskNote = " · маска " + N + ", длина " + len + ", НОД " + g + " → " +
          (per ? ("период " + per + " бит = " + (N / g) + " витк.") : "период больше предела счёта") +
          (len % N === 0 ? " (маска делит строку — витки одинаковы)" : "");
      }
      const lineTitle = (!isDiagLine
        ? "Клик — показать целиком / свернуть обратно"
        : (VERT_PICK_MODES.includes(r.mode)
            ? "Клик — показать в таблице ЛИНИЮ ЗАХВАТА этого режима: биты подсвечиваются фоном, соседние колонки чередуются яркостью (видно порядок обхода). Повторный клик снимает выбор"
            : "Клик — подсветить в таблице ИМЕННО этот зигзаг (повторный клик снимает выбор). Пока он выбран, ▲▼ переключают на соседний")) + maskNote;
      return '<div class="chain-result-line' + expanded + pickedCls + '" data-mode="' + esc(r.mode) + '" title="' + esc(lineTitle) + '">' +
        '<span class="chain-result-line-label" style="min-width:' + bgLabelW + 'ch">' + esc(bgLabels[i]) + '</span>' +
        '<span class="chain-result-line-check">' + checkHtml + '</span>' +
        (allPatsShown() ? '<span class="chain-result-line-hits">' + hitsHtml + '</span>' : '') +
        '<span class="chain-result-line-colon">:</span>' +
        '<span class="chain-result-line-bits">' + bits + '</span>' +
      '</div>';
    };
    const srcRowHtml = '<div class="chain-result-src-row" title="Из каких строк считается (номер строки над выделенной + номер выделенной), в скобках — текущее выравнивание">' +
      'Строки ' + bgInfo.aboveIdx + '+' + bgInfo.selIdx + ' (' + esc(alignLabel) + '): ' + esc(bgInfo.rowAbove) + '+' + esc(bgInfo.rowSel) +
    '</div>';
    bgResultHtml = srcRowHtml + bgInfo.results.map((r, i) => buildResultLine(r, i)).join("");
    /* Галка "🎭 Маска заново каждый виток" решает что-то ТОЛЬКО когда длина маски не делит длину
       результата хотя бы у одного режима: иначе каждый виток и так начинается с фазы 0, и оба
       положения галки дают одно и то же. Приглушаем её (label.chk.mode-na) и пишем в подсказке,
       почему она сейчас ничего не меняет. Не блокируем: выставить её заранее, до ввода маски,
       никто не мешает. */
    const maskChkEl = document.getElementById("cBgMaskRingRestart");
    if (maskChkEl && maskChkEl.parentElement) {
      const matters = !!maskNow && bgInfo.results.some(r => r.result.length && (r.result.length % maskNow.length !== 0));
      maskChkEl.parentElement.classList.toggle("mode-na", !matters);
      /* TIPS БЕРЁМ ЧЕРЕЗ try/catch, а не через typeof (v0.932). TIPS объявлен `const` в fold-5, и
         до этой строки исполнение доходит РАНЬШЕ: loadCache() зовёт render() из середины fold-5,
         когда объявление TIPS ещё впереди. Для let/const это временная мёртвая зона, а `typeof`
         от неё НЕ защищает — он сам бросает ReferenceError (стояла именно такая "защита", и она
         роняла всю загрузку: Cannot access 'TIPS' before initialization). До инициализации просто
         оставляем подсказку пустой — на следующем render() она встанет на место. */
      let t141 = "";
      try { t141 = (TIPS && TIPS.t141) || ""; } catch (e) { t141 = ""; }
      maskChkEl.parentElement.title = matters
        ? t141 // обратно обычная подсказка
        : (maskNow
            ? "Сейчас ничего не меняет: длина маски (" + maskNow.length + ") делит длину результата у всех включённых режимов — каждый виток и так начинается с начала маски."
            : "Сейчас ничего не меняет: маска не задана.");
    }
    // Отдельное окно результата (🗗) — там строки рисуются БЕЗ обычного потолка и переносятся по
    // ширине окна, чтобы было видно КАЖДОЕ вхождение паттерна целиком (запрос пользователя).
    if (resultPopupAlive()) {
      popupResultHtml = srcRowHtml + bgInfo.results.map((r, i) => buildResultLine(r, i, POPUP_RENDER_CAP)).join("");
    }
    if (chainResultLabelEl) {
      // В заголовке — только слово "Результат" (запрос пользователя): перечисление режимов
      // разрасталось на две строки и всё равно дублирует подписи слева в каждой строке панели.
      // Полный список остаётся в подсказке при наведении, чтобы информация не потерялась.
      const modeLabels = bgInfo.results.map(r => bgModeLabel(r.mode)).join(" + ");
      // ...а вот САМ ИСКОМЫЙ ПАТТЕРН в заголовке нужен (запрос пользователя): по номеру строки
      // его каждый раз искать глазами в колонке паттернов. Показываем текст и номер строки,
      // чей это паттерн (та, что сразу под выделенной).
      const seekPat = st.pats[bgInfo.targetIdx];
      const seekText = seekPat && seekPat.text ? seekPat.text : "";
      chainResultLabelEl.textContent = "🔍 Результат" +
        (seekText ? ` · ищем ${seekText} (стр. ${bgInfo.targetIdx})` : "");
      chainResultLabelEl.title = (seekText ? `Искомый паттерн: ${seekText} — из строки ${bgInfo.targetIdx} (сразу под выделенной) | ` : "") +
        "Включённые режимы фон-поиска: " + modeLabels;
    }
  } else if (bgSearchActive()) {
    // Нет валидной цели для фон-поиска (нет выделения, или выделена 1-я/последняя строка) —
    // всё равно показываем список ВКЛЮЧЁННЫХ режимов (без чек-марок и битов), чтобы окно не
    // "пустело"/не подменялось сквозной строкой, а всегда отражало текущие настройки поиска.
    const modes = (st.bgSearchModes && st.bgSearchModes.length) ? st.bgSearchModes : ["interleave"];
    const bgLabels = modes.map(m => bgModeLabel(m));
    const bgLabelW = Math.max(...bgLabels.map(l => l.length));
    fullChainText = bgLabels.map(l => l.padEnd(bgLabelW, " ") + "   : ").join("\n");
    bgResultHtml = modes.map((m, i) =>
      '<div class="chain-result-line" data-mode="' + esc(m) + '">' +
        '<span class="chain-result-line-label" style="min-width:' + bgLabelW + 'ch">' + esc(bgLabels[i]) + '</span>' +
        '<span class="chain-result-line-check"></span>' +
        '<span class="chain-result-line-colon">:</span>' +
        '<span class="chain-result-line-bits"><span class="empty">нет цели</span></span>' +
      '</div>'
    ).join("");
    if (chainResultLabelEl) {
      chainResultLabelEl.textContent = "🔍 Результат";
      chainResultLabelEl.title = "Включённые режимы фон-поиска: " + bgLabels.join(" + ");
    }
  } else if (chainResultLabelEl) {
    // Фон-поиск выключен — тут окно показывает не находки, а обычную сквозную строку, поэтому
    // заголовок остаётся своим (иначе непонятно, что именно в окне).
    chainResultLabelEl.textContent = "🔗 Сквозная строка результата";
    chainResultLabelEl.title = "";
  }
  // Номер паттерна, который ляжет СЛЕДУЮЩИМ нажатием "🧩 Паттерн-цепочка" — прямо в заголовке
   // окна результата (запрос пользователя), чтобы не гадать, на каком месте цепочка. Список
   // кольцевой: кончились — снова с первого.
  if (chainResultLabelEl) {
    const nextIdx = patChainNextIdx();
    if (nextIdx >= 0 && (st.patChainStep || 0) > 0) {
      // ...и сколько укладок осталось до полного круга (см. patChainCycleLen): после него биты
      // начинают точно повторяться, крутить дальше бессмысленно — "Авто" на этом и останавливается.
      const cyc = patChainCycleLen();
      const pos = patChainCyclePos();
      chainResultLabelEl.textContent += ` · паттерн №${nextIdx + 1}` +
        (cyc ? ` · круг ${Math.min(pos, cyc)}/${cyc}` : "");
      chainResultLabelEl.title = (chainResultLabelEl.title ? chainResultLabelEl.title + " | " : "") +
        `Паттерн-цепочка: уложено ${st.patChainStep}, следующим ляжет паттерн №${nextIdx + 1}` +
        (cyc ? `. Полный круг — ${cyc} укладок (${cyc / 2} паттернов × 2 прохода): после него биты повторяются, дальше крутить бессмысленно. Отсчёт круга начинается заново после каждого переезда выделения на находку` : "");
    }
  }
  // СЧЁТЧИК ШАГОВ — В ЗАГОЛОВКЕ ОКНА "Результат" (запрос пользователя: "это пиши в Результатах,
  // заголовке окна"). В шапке приложения он тоже остаётся (#stepNo), но там его легко потерять
  // среди кнопок, а тут он рядом с тем, на что и влияет. Дописываем ПОСЛЕ всех веток, каким бы
  // ни оказался заголовок — обычным, сквозной строкой или с довеском Паттерн-цепочки.
  if (chainResultLabelEl) chainResultLabelEl.textContent += " · Ш: " + st.step;
  lastChainResultText = fullChainText;
  renderFindLogPanel();

  const chainLenEl = document.getElementById("chainLen");
  const chainTextEl = document.getElementById("chainText");
  if (chainLenEl && chainTextEl) {
    /* В режиме фон-поиска fullChainText — это несколько подписанных строк сразу, а не чистая
       битовая строка, так что счётчик битов показывает длину результата первого режима */
    chainLenEl.textContent = bgInfo ? (bgInfo.results[0] ? bgInfo.results[0].result.length : 0) : (bgSearchActive() ? 0 : fullChainText.length);
    // Строки результата фон-поиска — всегда по левому краю, независимо от кнопок выравнивания
    // ⇤↔⇥ (те управляют только выравниванием строк/паттернов в самой таблице, не тут)
    chainTextEl.style.textAlign = (bgInfo || bgSearchActive()) ? "left" : st.align;
    
    // Раньше тут же (поверх сквозной строки) рисовался блок Гориз.XOR (прогресс + Сквозная/
    // Цель/Результат) — перенесён в "Черновик шага" (см. computeHorizXorInfo()/renderStepLogBox()
    // ниже), тут в режиме horiz_xor теперь просто обычная сквозная строка, как у любого другого режима.
    if (!fullChainText) {
      chainTextEl.innerHTML = '<span class="empty">пусто</span>';
    } else if (bgResultHtml != null) {
      chainTextEl.innerHTML = bgResultHtml;
      // Биты, выброшенные "🎭 Маской", гасим прямо в готовой разметке (см. dimMaskedBits выше).
      dimMaskedBits(chainTextEl, document);
      // text-overflow:ellipsis сама рисует "…", но на мелком шрифте среди битов её легко не
      // заметить — меряем по факту (scrollWidth > clientWidth) и вешаем свою явную метку
      // (см. .chain-result-line.truncated в CSS) только на реально обрезанные строки.
      chainTextEl.querySelectorAll(".chain-result-line:not(.expanded) .chain-result-line-bits").forEach(el => {
        if (el.scrollWidth > el.clientWidth) el.parentElement.classList.add("truncated");
      });
    } else {
      let html = "";
      for (let k = 0; k < fullChainText.length; k++) {
        const bit = fullChainText[k];
        html += esc(bit);
      }
      chainTextEl.innerHTML = html || '<span class="empty">пусто</span>';
    }
    applyResultHeightLock();
  }
  // Отдельное окно результата живёт своей жизнью, но содержимое обновляется тем же render()
  // (см. openResultPopup): что в панели, то и в окне — только без потолка и с переносом строк.
  updateResultPopup(popupResultHtml, fullChainText);

  renderStepLogBox(bgInfo);
  // Значки включённых режимов в углах поля цепочек (см. renderStateBadges в fold-4). Живут тем же
  // кадром, что и всё остальное: любое переключение в панелях зовёт render(), значит полоска
  // всегда отражает текущее состояние.
  if (typeof renderStateBadges === "function") renderStateBadges();
  updateAxisSplitPosition(maxLen);
  updateUndoRedoBtns();
}

/* Рамка у "↩ Отмена"/"↪ Повтор" — только когда стек не пуст (запрос пользователя). Сами кнопки
   остаются кликабельными: нажатие на пустой стек честно скажет "откатывать/повторять нечего". */
function updateUndoRedoBtns(){
  const u = document.getElementById("bUndo");
  if (u) u.classList.toggle("nothing-to-do", !(st.undo && st.undo.length));
  const r = document.getElementById("bRedo");
  if (r) r.classList.toggle("nothing-to-do", !(st.redo && st.redo.length));
}

/* Обновляет визуальный блок "Черновик последнего шага": операция, задействованные строки, результат, найденный паттерн.
   ВТОРАЯ, независимая от st.lastOp секция (см. subHtml ниже) — разбор "Подпаттернов сдвига"
   (st.bgSubPatterns) для ТЕКУЩЕГО фон-поиска: живая, обновляется каждый render(), даже если
   реального шага ещё не было — потому что фон-поиск сам по себе не "шаг", а постоянная проверка. */
/* "⧬ Интерлив сквозной"/"⨁ XOR сквозной" — их запись в Черновике НЕ статична: сквозная и её
   "довесок кольца" зависят от st.seqGlueMode/st.ringInvert/st.ringReverse, которые можно переключить уже ПОСЛЕ
   того, как шаг записан (в отличие от остальных шагов — это не застывшая история, а живой
   пересчёт по сохранённым idx/tryRow/offset). Раньше HTML строился ОДИН РАЗ в момент самого шага
   и переключатели на уже показанную запись не влияли (см. запрос пользователя — "не
   инвертирует.../не меняют ничего в черновике"). */
function recomputeSeqStepDisplay(info){
  const { idx, tryRow, offset, mode } = info;
  // Размер блока интерлива (см. st.interleaveSeqBlockN/doInterleaveSeqStep()) — только у
  // Интерлив сквозной, XOR сквозной блоков не знает (xorPair игнорирует лишний аргумент).
  const blockN = mode === 'interleave' ? (info.blockN || 1) : 1;
  // Та же сквозная (с ВЫДЕЛЕННОЙ строкой idx включительно), что и в doInterleaveSeqStep()/
  // doXorSeqStep() — живой пересчёт должен показывать ровно то же самое, что реально искалось.
  const seq = horizChainText(idx) + getRowBits(st, idx);
  // Живой пересчёт учитывает и ТЕКУЩЕЕ состояние 🪞 "Сквозная сама с собой" (st.seqSelfMode) —
  // тот же принцип, что у st.ringInvert/st.ringReverse/st.seqGlueMode выше по файлу.
  const row = st.seqSelfMode ? seq : getRowBits(st, tryRow);
  // Тот же "довесок кольца" в переборе, что и в doInterleaveSeqStep()/doXorSeqStep() — иначе
  // живой пересчёт разошёлся бы с реально сохранённым offset при большом offset (> seq.length).
  const ringSeq = seq + ringNextLap(seq);
  const rotations = row.length ? rotationsOf(ringSeq) : [];
  const seqRot = rotations[offset];
  if (seqRot === undefined) return null;
  const combine = mode === 'xor' ? xorPair : interleavePair;
  const combineMarked = mode === 'xor' ? xorPairMarked : interleavePairMarked;
  const seqExtHtml = bitsHtml(seq) + '<span class="chain-ring-ext">' + bitsHtml(ringNextLap(seq)) + '</span>';
  const result = combine(seqRot, row, "left", blockN);
  // Тот же паттерн-цель (строка idx+1), что и в doInterleaveSeqStep()/doXorSeqStep() — нужен
  // для живой подсветки находки поверх "Итога" (см. interleavePairMarked()/buildHitMap()).
  const patFull = (st.pats[idx + 1] || {}).text;
  const kinds = patFull ? findPatternKinds(result, patFull) : [];
  return {
    result: result,
    resultHtml: combineMarked(seqRot, row, "left", kinds, blockN),
    seqExtHtml: seqExtHtml,
    row: row,
    rowLabel: st.seqSelfMode ? "Сквозная" : ("№" + (tryRow + 1))
  };
}

/* "🎭 НАХОДКИ ПО МАСКАМ" — отдельный блок Черновика (запрос пользователя: "в черновик или Логи
   надо расписать чёткие находки от Масок"). В панели "Результат" маска видна только затемнением
   бит в ПОЛНОЙ строке: не понять ни какая фаза что дала, ни как выглядит та прорежённая строка,
   по которой на самом деле считалось совпадение. Тут — по ФАЗАМ (маска длины N даёт N фаз, см.
   mkResults в fold-3): сама маска в этой фазе, сколько бит из скольких она оставила, и по каждому
   включённому режиму — нашлось или нет, каким видом (kind) и на какой позиции ПРОРЕЖЁННОЙ строки.
   Всё берётся ГОТОВЫМ из bgInfo (r.maskInfo, см. mkResult) — ничего не пересчитываем: арифметика
   витков ("🎭 Маска заново каждый виток") иначе разъехалась бы с той, по которой искали.
   Подсветка найденного куска — теми же классами, что и везде (buildHitMap/KIND_CLS), чтобы цвет
   вида совпадения был один и тот же в Черновике, в "Результате" и в таблице. */
const MASK_FIND_BITS_CAP = 200;
/* ВСЯ СКВОЗНАЯ ВЫБРАННОЙ ФАЗОЙ (v0.845, запрос пользователя: "покажи всю сквозную и маску —
   текущую фазу цветом, при клике на фазу меняет показ в сквозной"). Раньше в блоке были видны
   только прорежённые куски по 200 бит — по ним не понять, ЧТО именно маска выкинула. Тут строка
   показана ЦЕЛИКОМ (до предела ниже), а маска наложена цветом: что она берёт — цветом «1»
   подсветки маски и пожирнее, что выбрасывает — цветом «0» и приглушённо. Цвета те же самые, что
   у "🎨 Подсветки маски" в таблице (st.maskPaintColor1/0), чтобы одно и то же значило одно и то же.
   Красим ПРОБЕГАМИ одинаковых (взял/выкинул), а не посимвольно: у маски вроде "10" пробег равен
   одному символу, и на длинной сквозной это тысячи узлов на каждый render(). */
const MASK_THROUGH_CAP = 600;
function maskThroughHtml(list, mask, ph, N){
  if (!list || !list.length) return "";
  // Строка берётся у НАЙДЕННОГО режима этой фазы, а если находок нет — у первого: у разных
  // режимов результаты разной длины, и смешивать их в одной полосе нельзя.
  const r = list.find(x => x.matched) || list[0];
  const mi = r && r.maskInfo;
  if (!mi) return "";
  // through — маску клали на УДВОЕННУЮ строку (см. mkResult), показываем ровно то же, по чему
  // считалось, иначе вторая половина картинки соврёт.
  const src = mi.through ? (r.result + r.result) : r.result;
  if (!src) return "";
  const cTake = st.maskPaintColor1 || "#b060ff", cDrop = st.maskPaintColor0 || "#22d3ee";
  /* САМА НАХОДКА — ПОВЕРХ МАСКИ (v0.920, запрос пользователя "тут тоже как-то выделить находку").
     Полоса показывала только ЧТО маска берёт, а что выбрасывает, — а где в этой строке легло
     совпадение, видно не было. Позиции у kinds считаны в ПРОРЕЖЁННОЙ строке, поэтому переводим их
     в полную тем же обходом, что и applyPickMask (pickMap[j] — какой бит src дал j-й взятый бит).
     Кольцо сворачиваем по модулю: за пределами первого периода повторяются те же самые биты src,
     и подсветить их надо на тех же местах. Найденные биты всегда из «взятых» — выброшенные в
     pickMap не попадают вовсе. */
  const hits = [];
  if (r.matched && r.kinds && r.kinds.length) {
    const pickMap = [];
    for (let i = 0; i < src.length; i++) if (mask[(i + ph) % N] === "1") pickMap.push(i);
    const period = pickMap.length;
    if (period) for (const kd of r.kinds) for (let q = 0; q < kd.len; q++) {
      hits.push([pickMap[(kd.start + q) % period], kd.kind]);
    }
  }
  let firstHit = -1;
  for (const h of hits) if (firstHit < 0 || h[0] < firstHit) firstHit = h[0];
  /* ОБРЕЗКА НЕ ДОЛЖНА ПРЯТАТЬ САМУ НАХОДКУ (v0.921, запрос пользователя "если сквозная не
     помещается — должна крутиться вправо и по щелчку передвинуться туда, где находка"). Полоса
     режется по MASK_THROUGH_CAP ради скорости, а совпадение вполне может лежать дальше — тогда
     показывать было нечего и прокручивать не к чему. Растягиваем предел ровно до находки плюс
     небольшой хвост, чтобы она была не у самого края. */
  const cap = Math.min(src.length, firstHit >= 0 ? Math.max(MASK_THROUGH_CAP, firstHit + 200) : MASK_THROUGH_CAP);
  const hitAt = new Array(cap).fill(-1);
  for (const h of hits) if (h[0] < cap && hitAt[h[0]] < 0) hitAt[h[0]] = h[1];
  let bits = "", i = 0;
  while (i < cap) {
    const take = mask[(i + ph) % N] === "1";
    const h = hitAt[i];
    let j = i;
    // Пробег рвём и на границе находки — иначе её биты слились бы с соседними «взятыми».
    while (j < cap && (mask[(j + ph) % N] === "1") === take && hitAt[j] === h) j++;
    const chunk = esc(src.slice(i, j));
    bits += h >= 0
      ? ('<span class="chain-hit-bits' + (KIND_CLS[h] ? " " + KIND_CLS[h] : "") + '" title="Здесь нашёлся паттерн">' + chunk + '</span>')
      : ('<span style="color:' + (take ? cTake + ';font-weight:700' : cDrop + ';opacity:.5') + '">' + chunk + '</span>');
    i = j;
  }
  if (cap < src.length) bits += '<span class="chain-ring-ext">… ещё ' + (src.length - cap) + '</span>';
  return '<div class="step-log-mask-through" title="Сквозная строка режима «' + esc(bgModeLabel(r.mode)) +
    '» целиком, с наложенной маской ' + esc(mask) + ' в фазе ' + (ph + 1) + ' из ' + N +
    '. Ярким — биты, которые маска БЕРЁТ в поиск, приглушённым — выброшенные, цветом находки — где именно лёг найденный паттерн. Клик по любой фазе ниже покажет строку её фазой">' +
    '<span class="step-log-mask-name">сквозная · фаза ' + (ph + 1) + '/' + N + '</span>' +
    // data-hit-at/data-bits-len — для прокрутки к находке по клику (см. обработчик #stepLogBody):
    // сколько символов реально нарисовано и на каком из них начинается совпадение.
    '<span class="step-log-mask-bits" data-hit-at="' + firstHit + '" data-bits-len="' + cap + '">' + bits + '</span>' +
  '</div>';
}
function renderMaskFindingsHtml(bgInfo){
  const mask = (typeof maskBits === "function") ? maskBits() : "";
  if (!mask || !bgInfo || !bgInfo.results) return "";
  // Раскладываем строки результата по номеру фазы — у каждой фазы свой набор режимов.
  const phases = new Map();
  for (const r of bgInfo.results) {
    if (!r.maskInfo) continue;
    if (!phases.has(r.maskInfo.phase)) phases.set(r.maskInfo.phase, []);
    phases.get(r.maskInfo.phase).push(r);
  }
  if (!phases.size) return "";
  const N = mask.length;
  const through = phases.values().next().value[0].maskInfo.through;
  // ВЫБРАННАЯ ФАЗА (v0.845, запрос пользователя "сделай интерактивным … при клике на фазу меняет
  // показ в сквозной"): по ней рисуется полоса сквозной над списком фаз. Клик по строке фазы
  // кладёт её номер в st.maskDraftPhase (см. обработчик на #stepLogBody). Фаз столько же, сколько
  // бит в маске, но набор ключей зависит от режима — если сохранённой фазы в нём нет (маску
  // сменили), берём первую имеющуюся.
  const phaseKeys = Array.from(phases.keys()).sort((a, b) => a - b);
  const selPh = phases.has(st.maskDraftPhase) ? st.maskDraftPhase : phaseKeys[0];
  let hitTotal = 0, allTotal = 0;
  const phasesHtml = phaseKeys.map(ph => {
    const list = phases.get(ph);
    const view = list[0].maskInfo.view;
    const hits = list.filter(r => r.matched);
    hitTotal += hits.length; allTotal += list.length;
    // Одна строка на режим: подпись, "взято из скольки", виды совпадения с позицией, сами биты.
    const modesHtml = list.map(r => {
      const mi = r.maskInfo;
      // len — длина ОДНОГО витка (самой строки результата), на нём и держится вся арифметика
      // НОД/НОК. from — длина того, на что маску реально клали: со снятой галкой "заново каждый
      // виток" это строка, УДВОЕННАЯ заранее (см. mkResult), и делить kept на длину одного витка
      // было бы враньём.
      const len = r.result.length;
      const from = mi.through ? len * 2 : len;
      const kept = mi.picked.length;
      // Где именно нашлось: вид совпадения + позиция НАЧАЛА в прорежённой строке (счёт от 1,
      // как и в остальных подсказках приложения), плюс длина найденного куска.
      const kindsTxt = r.kinds.map(kd =>
        KIND_LABELS_SHORT[kd.kind] + (kd.skip ? "⏭" : "") + (kd.sub ? "↻" : "") +
        " @" + (kd.start + 1) + "·" + kd.len
      ).join(", ");
      // Карта подсветки — ТОЛЬКО по показанному куску, а не buildHitMap() на всю строку: у
      // "Сквозной" результат бывает в десятки тысяч бит, и массив такой длины на КАЖДЫЙ режим ×
      // КАЖДУЮ фазу — на каждый render() — это ровно тот расход, из-за которого окно и подвисает.
      const cap = Math.min(kept, MASK_FIND_BITS_CAP);
      const map = new Array(cap).fill(null);
      const P = (r.kinds && r.kinds.period) || kept || 1;
      for (const kd of r.kinds) for (let i = 0; i < kd.len; i++) {
        const q = (kd.start + i) % P;
        if (q < cap && !map[q]) map[q] = { kind: kd.kind, skip: kd.skip };
      }
      let bits = "";
      for (let i = 0; i < cap; i++) {
        const h = map[i], ch = esc(mi.picked[i]);
        bits += h
          ? ('<span class="chain-hit-bits' + (KIND_CLS[h.kind] ? " " + KIND_CLS[h.kind] : "") + (h.skip ? " skip1" : "") + '">' + ch + '</span>')
          : ch;
      }
      if (cap < kept) bits += '<span class="chain-ring-ext">…</span>';
      // Арифметика витков — своя у КАЖДОГО режима: длины результата у них разные (см. maskNote
      // в render(), та же формула НОД/НОК).
      const g = len ? gcdInt(len, N) : 0;
      const per = len ? lcmSafe(len, N) : 0;
      const tip = "Режим " + bgModeLabel(r.mode) + " · фаза " + (ph + 1) + " из " + N +
        " · маска " + view + " (исходная " + mask + ")" +
        " · взято " + kept + " бит из " + from + (mi.through ? " (строка " + len + " × 2 витка)" : "") +
        (len ? (" · НОД(" + len + "," + N + ")=" + g + (per ? ", период " + per + " бит = " + (N / g) + " витк." : ", период больше предела счёта")) : "") +
        (len && len % N === 0 ? " · маска делит строку — витки одинаковы" : "") +
        (r.matched ? " · НАЙДЕНО: " + r.kinds.map(kd => KIND_LABELS_RU[kd.kind] + (kd.skip ? " (без 1-го)" : "") + ", позиция " + (kd.start + 1)).join("; ") : " · не найдено");
      // data-hit-mode + класс hit-pick (v0.919, запрос пользователя "клик на любом из найденных
      // должен только его показать в цепочках"): клик по строке режима кладёт её в st.bgHitPick,
      // и в строках цепочки остаётся ТОЛЬКО эта находка (см. hitRes в render). Атрибут вешаем
      // всем строкам, включая ненайденные, — по клику будет видно, что показывать нечего.
      return '<div class="step-log-mask-mode' + (r.matched ? " found" : "") +
        (r.matched && r.mode === st.bgHitPick ? " hit-pick" : "") +
        '" data-hit-mode="' + esc(r.mode) + '" title="' + esc(tip) +
        (r.matched ? " · КЛИК — показать именно эту находку в самих цепочках" : "") + '">' +
        '<span class="step-log-mask-name">' + esc(bgModeShortLabel(r.mode)) + '</span>' +
        '<span class="step-log-mask-cnt">' + kept + '/' + from + '</span>' +
        '<span class="step-log-mask-kinds">' + (r.matched ? esc(kindsTxt) : "—") + '</span>' +
        '<span class="step-log-mask-bits">' + bits + '</span>' +
      '</div>';
    }).join("");
    return '<div class="step-log-mask-phase' + (hits.length ? " found" : "") + (ph === selPh ? " sel" : "") +
      '" data-mask-phase="' + ph + '" title="Фаза ' + (ph + 1) +
      ': маска приложена начиная со своего ' + (ph + 1) + '-го символа — на первый бит строки ложится ' + esc(view) +
      '. Клик — показать сквозную именно этой фазой">' +
      '<span class="step-log-mask-ph">фаза ' + (ph + 1) + '/' + N + '</span>' +
      '<span class="step-log-mask-view">' + esc(view) + '</span>' +
      '<span class="step-log-mask-sum">' + (hits.length ? "✅ " + hits.length + " из " + list.length : "нет находок (" + list.length + ")") + '</span>' +
    '</div>' + modesHtml;
  }).join("");
  return '<div class="step-log-row" style="display:block;border-top:1px dashed var(--line);margin-top:6px;padding-top:6px">' +
    '<span class="step-log-label" style="display:block;margin-bottom:4px" title="Маска прореживает СТРОКУ РЕЗУЛЬТАТА: её «1» — бит взять, «0» — пропустить. Маска длины N прикладывается со всех своих N начал (фаз), и в каждой прорежённой строке паттерн ищется отдельно">' +
      '🎭 Находки по маскам · маска ' + esc(mask) + ' (' + N + ' бит) · ' +
      (through ? "сквозь витки кольца" : "заново каждый виток") + ' · совпало ' + hitTotal + ' из ' + allTotal +
    '</span>' +
    maskThroughHtml(phases.get(selPh), mask, selPh, N) +
    '<div class="step-log-sub-container">' + phasesHtml + '</div>' +
    '</div>';
}

/* "🔗 РАЗБОР КОЛЬЦА" — отдельный блок Черновика (запрос пользователя: "паттерн 1000 нашёлся в
   11111 при проходе маской 2 круга?? или сколько — это бы разложить и показать наглядно").
   По сухому "@5·4" в логе не видно ГЛАВНОГО: находка длиннее самой строки не потому, что маска
   прокручена несколько раз, а потому что findPatternKinds ищет не в строке, а в КОЛЬЦЕ —
   строка + ещё один виток без последнего символа (см. fold-1: cycle + cycle.slice(0, period-1)).
   Тут это разложено буквально теми же символами, по которым реально шёл indexOf:
     [виток 1] | [виток 2] ¦ [хвост-довесок]
   Виток 2 существует отдельным куском только при 🔁 Инв.кольцо/реверс (там это ДРУГИЕ биты, и
   период вдвое длиннее строки); без неё период равен строке, и сразу за ней идёт хвост.
   Жёлтым — найденный кусок, ровно тот же, что подсвечен в "Результате": по границе витка и
   видно, на сколько бит находка заехала за край. Предел заезда — period-1: паттерн длиннее
   2·период−1 не найдётся никогда, сколько кругов ни рисуй.
   Строку берём ТУ САМУЮ, по которой считалось совпадение: с маской — прорежённую
   (r.maskInfo.picked), без маски — сам результат. Пересчитывать нечего, всё уже посчитано в
   computeBgSearchTarget — здесь только раскладка. */
const RING_BREAK_BITS_CAP = 400;  // сколько символов кольца показываем (длинные "Сквозные" рвут раскладку)
const RING_BREAK_ROWS_CAP = 12;   // сколько строк-находок максимум — иначе блок на пол-экрана
function renderRingBreakdownHtml(bgInfo){
  /* Блок живёт на данных ФОН-ПОИСКА (bgInfo) — своего поиска не ведёт, но рисуется БЕЗУСЛОВНО:
     ни одного немого return "" тут больше нет, при любом раскладе он показывает строку с
     причиной. Так задумано после того, как блок "не появлялся" и разобрать, которое из условий
     не сошлось, было нельзя (запрос пользователя: "включён, но не считает черновик всё равно").
     Раз блок виден ВСЕГДА — его отсутствие на экране означает ровно одно: исполняется старый код
     (браузер держит прежние fold-*.js в кеше либо открыт до-разрезной Zerkalius-fold.html).
     Номер версии в заголовке блока для того и стоит — берётся из <title> прямо в момент
     отрисовки, поэтому соврать не может и руками его поддерживать не нужно. */
  const ver = (document.title.match(/v0\.\d+/) || [""])[0];
  const wrap = inner =>
    '<div class="step-log-row" style="display:block;border-top:1px dashed var(--line);margin-top:6px;padding-top:6px">' +
      '<span class="step-log-label" style="display:block;margin-bottom:4px" title="Поиск идёт не по строке, а по кольцу: строка + ещё один виток без последнего символа. Поэтому паттерн бывает ДЛИННЕЕ строки — он заезжает за её край и продолжается с начала. Предел — 2·период−1 символов">' +
        '🔗 Разбор кольца <span style="color:var(--dim);font-weight:normal;font-size:10px">' + esc(ver) + '</span></span>' + inner + '</div>';
  if (typeof bgSearchActive === "function" && !bgSearchActive()) {
    return wrap('<span class="empty">фон-поиск выключен — включите его во вкладке «Поиск» (заголовок 🔍 Фон-поиск) и выберите хотя бы один режим</span>');
  }
  if (!bgInfo || !bgInfo.results || !bgInfo.results.length) {
    /* РАЗВОДИМ ПРИЧИНЫ. computeBgSearchTarget() отдаёт null в трёх разных случаях, и одно общее
       сообщение на всех оставляло гадать, в каком именно (запрос пользователя: "включён, но не
       считает всё равно — выделена строка, паттерн внизу"). Условия тут — те же самые, что в
       начале computeBgSearchTarget, просто названные вслух. */
    const selN = st.selectedRows ? st.selectedRows.size : 0;
    const selMax = selN ? Math.max(...st.selectedRows) : -1;
    let why;
    if (!selN) {
      why = 'не выделена НИ ОДНА строка (st.selectedRows пуст) — кликните по строке в полотне. ' +
            'Предпросмотр «Скв×2» выше этим не мешает: он берёт запасной ориентир st.bIdx и рисуется даже без выделения';
    } else if (selMax <= 0) {
      why = 'выделена самая первая строка (№1) — над ней строк нет, а фон-поиску нужна пара «строка выше + выделенная». Выделите любую строку ниже';
    } else if (!bgInfo) {
      why = 'выделена строка ' + (selMax + 1) + ', но фон-поиск не отдал цель — режимы: ' +
            ((st.bgSearchModes || []).join(", ") || "нет");
    } else {
      why = 'ни один включённый режим не дал результата (режимов в наборе: ' +
            ((st.bgSearchModes || []).length) + ') — проверьте, что выбран хоть один режим, кроме «🧮 Суммы длин»';
    }
    return wrap('<span class="empty">' + esc(why) + '</span>');
  }
  const pat = bgInfo.targetIdx < st.pats.length ? st.pats[bgInfo.targetIdx] : null;
  const patText = pat && pat.text ? pat.text : "";
  if (!patText) {
    return wrap('<span class="empty">у строки ' + (bgInfo.targetIdx + 1) + ' (под выделенной) нет паттерна — сверять не с чем</span>');
  }
  const base = patBase(patText);
  const rows = [];
  let anyInvRing = false;
  for (const r of bgInfo.results) {
    if (rows.length >= RING_BREAK_ROWS_CAP) break;
    if (!r.matched || !r.kinds || !r.kinds.length) continue;
    const searched = r.maskInfo ? r.maskInfo.picked : r.result;
    if (!searched) continue;
    // Один в один арифметика findPatternKinds — иначе картинка разъедется с тем, где реально нашлось.
    const cycle = ringCycle(searched);
    const period = cycle.length;
    const ring = st.ringOff ? cycle : (period > 1 ? cycle + cycle.slice(0, period - 1) : cycle);
    const len = searched.length;
    if (period > len) anyInvRing = true;
    for (const kd of r.kinds) {
      if (rows.length >= RING_BREAK_ROWS_CAP) break;
      const hitLo = kd.start, hitHi = kd.start + kd.len;
      // Показываем не меньше, чем нужно, чтобы находка влезла целиком: обрезать ровно по ней —
      // ради чего блок и затевался.
      const cap = Math.min(ring.length, Math.max(RING_BREAK_BITS_CAP, hitHi));
      let bits = "";
      for (let i = 0; i < cap; i++) {
        if (i === len && period > len) {
          bits += '<span class="step-log-ring-sep" title="граница витка: дальше второй виток кольца — при 🔁 Инв./реверс это уже ДРУГИЕ биты">|</span>';
        } else if (i === period && ring.length > period) {
          bits += '<span class="step-log-ring-sep" title="дальше хвост-довесок: повтор начала кольца длиной period−1. Дальше него поиск не заходит — это и есть предел находки">¦</span>';
        }
        let cls = i >= period ? "step-log-ring-tail" : (i >= len ? "step-log-ring-lap2" : "");
        if (i >= hitLo && i < hitHi) {
          cls += " chain-hit-bits" + (KIND_CLS[kd.kind] ? " " + KIND_CLS[kd.kind] : "") + (kd.skip ? " skip1" : "");
        }
        const ch = esc(ring[i]);
        bits += cls ? '<span class="' + cls.trim() + '">' + ch + '</span>' : ch;
      }
      if (cap < ring.length) bits += '<span class="chain-ring-ext">…</span>';
      // Сколько находка забрала сверх самой строки — то самое "сколько кругов" из вопроса.
      const over = hitHi - len;
      const noteTxt = over > 0
        ? "за край на " + over + " бит (из " + len + ")"
        : "целиком внутри строки";
      const tip = "Режим " + bgModeLabel(r.mode) + " · " + (KIND_LABELS_RU[kd.kind] || "прямая") +
        (kd.skip ? " (⏭ без 1-го)" : "") + (kd.sub ? " · подпаттерн сдвига " + kd.sub : "") +
        " · строка " + len + " бит" + (r.maskInfo ? " (прорежена маской, фаза " + (r.maskInfo.phase + 1) + ")" : "") +
        " · период кольца " + period + " · всего в поиске " + ring.length + " символов (период + хвост " +
        Math.max(0, ring.length - period) + ")" +
        " · находка с позиции " + (hitLo + 1) + ", длина " + kd.len +
        (over > 0 ? " → уходит за край строки на " + over + " бит и продолжается с её начала"
                  : " → укладывается внутри строки, край не задет") +
        ". Длиннее " + Math.max(0, 2 * period - 1) + " символов тут не найдётся ничего.";
      rows.push(
        '<div class="step-log-ring-row" title="' + esc(tip) + '">' +
          '<span class="step-log-ring-name">' + esc(bgModeShortLabel(r.mode)) + '</span>' +
          '<span class="step-log-ring-note">' + esc(KIND_LABELS_SHORT[kd.kind] + " " + len + "→" + period + " · " + noteTxt) + '</span>' +
          '<span class="step-log-ring-bits">' + bits + '</span>' +
        '</div>'
      );
    }
  }
  if (!rows.length) {
    // Режимы посчитались, паттерн есть — просто ни один не совпал. Раскладывать нечего, но
    // сказать об этом надо: иначе блок выглядит сломанным.
    return wrap('<span class="empty">паттерн ' + esc(base) + ' (' + base.length + ' бит) не совпал ни в одном из ' +
      bgInfo.results.length + ' режимов — раскладывать нечего</span>');
  }
  return '<div class="step-log-row" style="display:block;border-top:1px dashed var(--line);margin-top:6px;padding-top:6px">' +
    '<span class="step-log-label" style="display:block;margin-bottom:4px" title="Поиск идёт не по строке, а по кольцу: строка + ещё один виток без последнего символа. Поэтому паттерн бывает ДЛИННЕЕ строки — он заезжает за её край и продолжается с начала. Предел — 2·период−1 символов">' +
      '🔗 Разбор кольца <span style="color:var(--dim);font-weight:normal;font-size:10px">' + esc(ver) + '</span> · паттерн ' + esc(base) + ' (' + base.length + ' бит) · ' +
      (st.ringOff ? '🚫 без кольца — ищем только внутри строки'
                  : (anyInvRing ? '🔁 инв./реверс кольца: период вдвое длиннее строки'
                                : 'период = длине строки, дальше хвост-довесок')) +
    '</span>' +
    '<div class="step-log-sub-container">' + rows.join("") + '</div>' +
    '</div>';
}

/* ОБЁРТКА-СТРАХОВКА (v0.782). Всё тело Черновика собирается в renderStepLogBoxInner(), и любое
   исключение по дороге раньше означало НЕВИДИМУЮ поломку: bodyEl.innerHTML просто не доходил до
   присвоения, тело оставалось от прошлого рендера — на экране "шагов ещё не было" и никаких
   блоков, будто их и не добавляли. Именно так это и выглядело у пользователя ("блок пропал
   совсем"), и отличить зависший Черновик от "блок не отрисовался" было невозможно.
   Теперь при падении в тело пишется сама ошибка: сообщение + первая строка стека (там видно
   функцию и место). Остальной render() при этом не страдает — он и раньше шёл дальше. */
function renderStepLogBox(bgInfo){
  try {
    renderStepLogBoxInner(bgInfo);
  } catch (err) {
    const bodyEl = document.getElementById("stepLogBody");
    if (!bodyEl) return;
    const stack = String((err && err.stack) || "").split("\n").slice(0, 2).join(" | ");
    bodyEl.innerHTML = '<div class="step-log-row" style="display:block">' +
      '<span class="step-log-label" style="color:var(--red)">⚠ Черновик: ошибка отрисовки</span>' +
      '<div class="empty" style="white-space:pre-wrap">' + esc(String((err && err.message) || err)) + '</div>' +
      '<div class="empty" style="white-space:pre-wrap;font-size:10px;opacity:.7">' + esc(stack) + '</div>' +
      '</div>';
  }
  // Черновик может быть вынесен в отдельное окно — зеркалим туда то же содержимое (см.
  // openStepLogPopup в fold-3). Ошибка отрисовки выше тоже уедет в окно, и это правильно.
  // typeof-проверка: fold-3 грузится ПОСЛЕ этого файла, а render() местами дёргается ещё по ходу
  // загрузки — до объявления функции.
  if (typeof updateStepLogPopup === "function") updateStepLogPopup();
}
function renderStepLogBoxInner(bgInfo){
  const noEl = document.getElementById("stepLogNo");
  const bodyEl = document.getElementById("stepLogBody");
  if (!bodyEl) return;

  const op = st.lastOp;
  // Живой пересчёт "Интерлив сквозной"/"XOR сквозной" — см. recomputeSeqStepDisplay() выше.
  if (op && op.seqStepInfo) {
    const live = recomputeSeqStepDisplay(op.seqStepInfo);
    if (live) {
      op.result = live.result;
      op.resultHtml = live.resultHtml;
      if (op.inputs && op.inputs[0]) op.inputs[0].html = live.seqExtHtml;
      if (op.inputs && op.inputs[1]) {
        op.inputs[1].text = " ".repeat(op.seqStepInfo.offset) + live.row;
        op.inputs[1].name = live.rowLabel;
      }
    }
  }

  let subHtml = "";
  if (st.bgSubPatterns && bgInfo) {
    const subRowsHtml = bgInfo.results.map(r => {
      const k0 = (r.tried || []).find(t => t.kind === 0);
      if (!k0) return "";
      const modeLabel = bgModeLabel(r.mode);
      const variantsHtml = k0.variants.map(v =>
        '<span class="step-log-sub-variant' + (v.found ? ' found' : '') + '">' + esc(v.text) + (v.found ? ' ✓' : '') + '</span>'
      ).join(" ");
      return '<div class="step-log-sub-row"><span class="step-log-sub-mode' + (k0.matched ? ' found' : '') + '">' + esc(modeLabel) + (k0.matched ? ' ✅' : '') + '</span>' + variantsHtml + '</div>';
    }).join("");
    // Своя прокрутка (см. .step-log-sub-container) — иначе при многих режимах/поворотах этот
    // блок один разрастался на пол-экрана и тянул за собой всю высоту stepLogBody (см. также
    // cap в applyStepLogBodyHeight()).
    subHtml = '<div class="step-log-row" style="display:block;border-top:1px dashed var(--line);margin-top:6px;padding-top:6px">' +
      '<span class="step-log-label" style="display:block;margin-bottom:4px">🔀 Подпаттерны сдвига</span>' +
      '<div class="step-log-sub-container">' + (subRowsHtml || '<span class="empty">нет данных</span>') + '</div>' +
      '</div>';
  }

  // "🎭 Находки по маскам" — сразу после подпаттернов, тем же приёмом (см. renderMaskFindingsHtml).
  // Живой блок, как и подпаттерны: не история шага, а разбор ТЕКУЩЕГО состояния маски, поэтому
  // показывается и до первого реального шага.
  subHtml += renderMaskFindingsHtml(bgInfo);

  // "🔗 Разбор кольца" — следом за находками по маскам, тем же приёмом. Тоже живой блок: это не
  // история шага, а раскладка ТЕКУЩЕЙ находки по виткам кольца (см. renderRingBreakdownHtml).
  // try/catch — не перестраховка: этот блок лезет в kinds/maskInfo/период кольца, и любая
  // неожиданность там уронила бы ВЕСЬ renderStepLogBox, а значит bodyEl.innerHTML не обновился
  // бы вовсе — Черновик замер бы на прошлом содержимом ("шагов ещё не было"), и выглядело бы
  // это не как ошибка, а как "блок не появляется". Лучше показать строку с текстом ошибки.
  try {
    subHtml += renderRingBreakdownHtml(bgInfo);
  } catch (err) {
    subHtml += '<div class="step-log-row" style="display:block;border-top:1px dashed var(--line);margin-top:6px;padding-top:6px">' +
      '<span class="step-log-label" style="display:block;margin-bottom:4px">🔗 Разбор кольца</span>' +
      '<span class="empty">ошибка разбора: ' + esc(String(err && err.message || err)) + '</span></div>';
  }

  const rowsHeadEl = document.getElementById("stepLogRowsHead");

  // Гориз.XOR: прогресс + Сквозная/Цель/Результат — раньше рисовалось поверх окна "Результат",
  // теперь тут; показывается независимо от того, был ли уже реальный шаг (op), т.к. это живое
  // состояние поиска, не история последнего шага. Сам прогресс ("Поиск · шаг X/Y") — в шапке
  // окна (rowsHeadEl ниже), а не отдельной строкой в теле — та же логика, что и у "Операции".
  const horizInfo = computeHorizXorInfo();
  let horizHtml = "";
  if (horizInfo) {
    // "Результат" тут НЕ рендерим — тот же самый текст (op.result === horizInfo.res)
    // показывается ниже, в общем блоке результата (см. html += ... дальше), раньше дублировался.
    // "Паттерн" — НЕ тут, а САМЫМ ПОСЛЕДНИМ, ПОСЛЕ "Результата" (см. html += ... дальше) —
    // запрос пользователя ("в результатах Паттерн покажи в самом низу").
    const rows = [
      // В подписи — НОМЕР строки, которая сейчас скользит: после провала прохода цепочкой
      // становится строка выше (см. st.horizChainRow), и без номера это не видно.
      { tag: "chain", label: "Сквозная" + (horizInfo.chainRow >= 0 ? " (стр. " + (horizInfo.chainRow + 1) + ")" : ""), html: horizInfo.chainHtml },
      { tag: "full", label: "Цель", html: horizInfo.origHtml }
    ];
    horizHtml = '<div class="horiz-info">' +
      rows.map(r => {
        const exp = horizRowExpanded.has(r.tag) ? " expanded" : "";
        return '<div class="horiz-ride-row' + exp + '" data-tag="' + r.tag + '" title="Клик — показать целиком / свернуть обратно">' +
          '<span class="horiz-ride-tag">' + r.label + '</span><span class="horiz-ride-text">' + r.html + '</span></div>';
      }).join("") +
      '</div>';
  }
  const horizHeadExtra = horizInfo ? (' 🔎 Поиск · шаг ' + horizInfo.step + '/' + horizInfo.totalSteps + ' · ' + horizInfo.stateLabel) : "";

  if (!op) {
    if (noEl) noEl.textContent = "0";
    if (rowsHeadEl) rowsHeadEl.innerHTML = horizHeadExtra;
    // Живой предпросмотр сквозной для выделенной строки, ДО первого реального шага (см. запрос
    // пользователя — "в черновике пусть сразу при выделении строки отображается") — не заменяет
    // "шагов ещё не было", а показывается ПЕРЕД ним, только если есть хоть одна строка выше
    // якорной (иначе сквозная пуста и показывать нечего).
    let previewHtml = "";
    // ТОЛЬКО ПРИ НЕПУСТОМ ВЫДЕЛЕНИИ (запрос пользователя, та же путаница, что и с синей парой):
    // seqAnchorIdx() при пустом выделении падает на запасной st.bIdx, и предпросмотр рисовался
    // даже тогда, когда выделять было нечего — выглядело это как "строка выделена, а поиск не
    // работает". Нет выделения — нет и предпросмотра.
    if (!horizInfo && st.selectedRows && st.selectedRows.size) {
      const anchorIdx = seqAnchorIdx();
      if (anchorIdx > 0) {
        const seq = horizChainText(anchorIdx);
        if (seq) {
          const seqExtHtml = bitsHtml(seq) + '<span class="chain-ring-ext">' + bitsHtml(ringNextLap(seq)) + '</span>';
          previewHtml = '<div class="step-log-inputs-container">' +
            '<div class="step-log-input-row"><span class="step-log-input-name">Скв×2</span><span class="step-log-input-text">' + seqExtHtml + '</span></div>' +
            '</div>';
        }
      }
    }
    bodyEl.innerHTML = horizHtml + previewHtml + '<span class="step-log-empty">шагов ещё не было</span>' + subHtml;
    markHorizTruncated(bodyEl);
    applyStepLogBodyHeight(bodyEl);
    return;
  }

  if (noEl) noEl.textContent = op.step;

  // Шапка: № шага (уже в HTML) + "(Строки N-M)" + сама операция + прогресс Гориз.XOR — вместо
  // отдельных строк в теле (та "Операция" ниже всё же оставлена в теле — "также в заголовке").
  if (rowsHeadEl) {
    const rowsStr = formatOpRows(op.rows);
    let extra = "";
    if (rowsStr) extra += ' (Строки ' + esc(rowsStr) + ')';
    if (op.opName) extra += ' ' + esc(op.opName);
    extra += horizHeadExtra;
    rowsHeadEl.innerHTML = extra;
  }

  // "Операция" убрана из тела — уже есть в заголовке (rowsHeadEl выше).
  let html = horizHtml;
  // Из каких строк получен результат (Шаг/Шаг 2/XOR/Интерлив и т.п.) — op.inputs уже собирался
  // в logStep() (см. inputsForLog в doStep()), просто не рендерился нигде. В режиме Гориз.XOR
  // не показываем — там источники это и есть "Сквозная"/"Цель" выше (не дублируем).
  if (!horizInfo && op.inputs && op.inputs.length) {
    // inp.html — необязательный ГОТОВЫЙ HTML вместо обычной раскраски bitsHtml() по значению
    // бита (см. "Скв×2" в doInterleaveSeqStep() — там нужно ещё и приглушить "довесок" кольца).
    html += '<div class="step-log-inputs-container">' +
      op.inputs.map(inp =>
        '<div class="step-log-input-row"><span class="step-log-input-name">' + esc(inp.name) + '</span><span class="step-log-input-text">' + (inp.html || bitsHtml(inp.text || "")) + '</span></div>'
      ).join("") +
      '</div>';
  }
  if (horizInfo) {
    // В режиме Гориз.XOR результат — та же строка horizInfo.resHtml (с той же подсветкой
    // "под въезжающей цепочкой"), выровненная тем же рядом-тегом, что и Сквозная/Цель выше
    // (а не отдельным центрированным блоком — раньше это было ДВА одинаковых текста подряд).
    const exp = horizRowExpanded.has("res") ? " expanded" : "";
    html += '<div class="horiz-ride-row' + exp + '" data-tag="res" title="Клик — показать целиком / свернуть обратно">' +
      '<span class="horiz-ride-tag">Результат</span><span class="horiz-ride-text">' + horizInfo.resHtml + '</span></div>';
    // Собственный паттерн строки b — САМЫМ ПОСЛЕДНИМ, после "Результата" (запрос пользователя).
    // Подсветка совпадения — уже отрисована выше, в "Результате" (см. hitAt в computeHorizXorInfo()).
    const expPat = horizRowExpanded.has("pat") ? " expanded" : "";
    html += '<div class="horiz-ride-row' + expPat + '" data-tag="pat" title="Клик — показать целиком / свернуть обратно">' +
      '<span class="horiz-ride-tag">Паттерн</span><span class="horiz-ride-text">' + horizInfo.patHtml + '</span></div>';
  } else {
    // Результат — с тем же рядом-лейблом ("Итог"), что и строки-источники выше (см.
    // .step-log-input-name), чтобы биты у всех начинались в одном столбце. Полный текст
    // (без ручной обрезки RESULT_LIMIT): визуально обрезается CSS (.step-log-result, одна
    // строка), клик разворачивает целиком — тот же приём, что у .chain-result-line в "Результате".
    const resultRaw = op.result || "";
    // op.resultHtml — готовый HTML с раскраской по ИСТОЧНИКУ символа (не только по значению
    // бита), см. logStep()/doInterleaveSeqStep().
    const resultHtml = op.resultHtml ? op.resultHtml :
      (resultRaw.length ? bitsHtml(resultRaw, op.highlightRange) : '<span class="empty">пусто</span>');
    html += '<div class="step-log-result-row">' +
      '<span class="step-log-input-name">Итог</span>' +
      '<div class="step-log-result' + (stepLogResultExpanded ? ' expanded' : '') + '" title="Клик — показать целиком / свернуть обратно">' + resultHtml + '</div>' +
      '</div>';
  }
  // Находка паттерна (op.pattern) больше не дублируется тут текстом — см. say() в doStep()
  // (уведомление снизу экрана), сработавший ровно в момент реальной находки.

  bodyEl.innerHTML = html + subHtml;

  const resultEl = bodyEl.querySelector(".step-log-result:not(.expanded)");
  if (resultEl && resultEl.scrollWidth > resultEl.clientWidth) resultEl.classList.add("truncated");
  markHorizTruncated(bodyEl);
  applyStepLogBodyHeight(bodyEl);
}

/* Явная метка "▸ ещё" (см. .horiz-ride-row.truncated в CSS) только на реально обрезанные
   строки Гориз.XOR-блока — тот же приём, что у .chain-result-line/.step-log-result. */
function markHorizTruncated(bodyEl){
  bodyEl.querySelectorAll(".horiz-ride-row:not(.expanded) .horiz-ride-text").forEach(el => {
    if (el.scrollWidth > el.clientWidth) el.parentElement.classList.add("truncated");
  });
}

/* Высота #stepLogBody держится вручную (stepLogBodyHeight), а не auto — растёт, если новому
   содержимому нужно больше места, но никогда не уменьшается сама по себе (см. объявление
   stepLogBodyHeight выше). Снимаем inline-height на момент замера, иначе scrollHeight мерил бы
   старую (уже применённую) высоту, а не то, сколько РЕАЛЬНО нужно новому содержимому.
   АВТОМАТИЧЕСКИЙ рост ограничен половиной высоты окна — дальше только скролл внутри (и своя
   прокрутка у длинных вложенных списков вроде .step-log-sub-container); вручную (за ручку
   .step-log-resize-handle) растянуть можно и больше — тот предел не трогаем. */
function applyStepLogBodyHeight(bodyEl){
  bodyEl.style.height = "";
  const natural = Math.min(bodyEl.scrollHeight, window.innerHeight * 0.5);
  if (stepLogBodyHeight === null || natural > stepLogBodyHeight) stepLogBodyHeight = natural;
  bodyEl.style.height = stepLogBodyHeight + "px";
}

let msgTimer = null;
/* kind (v0.951) — необязательная пометка вида сообщения: "hit" красит плашку в зелёный (см.
   #msg.hit в CSS). Всё, что зовёт say() одним аргументом, ведёт себя как раньше — класс каждый
   раз снимается заново, чтобы зелёный не «залипал» на следующем обычном сообщении. */
function say(t, kind){
  const el = document.getElementById("msg");
  if (!el) return;
  if (!t) {
    el.classList.remove("show");
    return;
  }
  el.textContent = t;
  el.classList.toggle("hit", kind === "hit");
  el.classList.add("show");
  if (msgTimer) clearTimeout(msgTimer);
  msgTimer = setTimeout(() => {
    el.classList.remove("show");
  }, 2500);
}

const bClearStepLogEl = document.getElementById("bClearStepLog");
if (bClearStepLogEl) {
  bClearStepLogEl.onclick = () => {
    st.lastOp = null;
    // "Подпаттерны сдвига" — живой блок (пересчитывается каждый render() из текущего
    // выделения/фон-поиска, не из st.lastOp), поэтому просто обнулить lastOp для него
    // недостаточно — он тут же появился бы заново на этом же клике. Выключаем галку явно.
    if (st.bgSubPatterns) {
      st.bgSubPatterns = false;
      const cBgSubPatternsEl = document.getElementById("cBgSubPatterns");
      if (cBgSubPatternsEl) cBgSubPatternsEl.checked = false;
    }
    render(); saveCache();
  };
}
const bClearFindLogEl = document.getElementById("bClearFindLog");
if (bClearFindLogEl) {
  bClearFindLogEl.onclick = () => {
    bgFindLog = [];
    renderFindLogPanel();
  };
}
/* Клик по шапке "Лога находок" — сортировка по этому столбцу (см. findLogSort/renderFindLogPanel).
   Слушатель вешается ОДИН раз на сам контейнер: его innerHTML переписывается на каждой отрисовке,
   а элемент остаётся тот же. Цикл кликов: ▲ по возрастанию → ▼ по убыванию → исходный порядок. */
const findLogListEl = document.getElementById("findLogList");
if (findLogListEl) {
  findLogListEl.addEventListener("click", (e) => {
    const cell = e.target.closest("[data-sort]");
    if (!cell || !findLogListEl.contains(cell)) return;
    const key = cell.getAttribute("data-sort");
    if (findLogSort.key !== key) findLogSort = { key, dir: 1 };
    else if (findLogSort.dir === 1) findLogSort = { key, dir: -1 };
    else findLogSort = { key: null, dir: 1 };
    renderFindLogPanel();
  });
}
// "🧮 Найти суммы" — ручной разовый прогон "Суммы длин" по кнопке, независимо от того, менялись
// строки или нет: обычный автопоиск (см. render() → bgFindLog.unshift) пишет в лог только когда
// МЕНЯЕТСЯ сам факт находки (hitNow !== st.bgSearchLastHit) — если строки стоят на месте, то же
// самое совпадение повторно не запишется. Эта кнопка просто берёт ТЕКУЩЕЕ состояние как есть и
// перебирает ВСЕ варианты сумм для паттерна текущей выделенной строки (не только первый
// найденный — см. lengthSumsMatchedCombos), пишет всё найденное в лог — запрос пользователя.
const bScanLengthSumsLogEl = document.getElementById("bScanLengthSumsLog");
if (bScanLengthSumsLogEl) {
  bScanLengthSumsLogEl.onclick = () => {
    const selIdx = seqAnchorIdx();
    if (selIdx == null || selIdx <= 0) { say("Выделите строку — не от чего искать суммы."); return; }
    const targetIdx = selIdx + 1;
    if (targetIdx >= st.rows.length) { say("Под выделенной строкой нет строки — искомого паттерна нет."); return; }
    const hits = lengthSumsMatchedCombos(st, selIdx);
    if (!hits.length) { say("🧮 Суммы длин: совпадений с паттерном строки " + (targetIdx + 1) + " не найдено."); return; }
    bgFindLog.unshift({ row: targetIdx, matches: { lengthSums: hits } });
    if (bgFindLog.length > BG_FIND_LOG_MAX) bgFindLog.length = BG_FIND_LOG_MAX;
    renderFindLogPanel();
    saveCache();
    say(`🧮 Суммы длин: записано в лог ${hits.length} найденных вариантов (строка ${targetIdx + 1}).`);
  };
}

/* Клик по результату в "Черновике последнего шага" — развернуть целиком / свернуть обратно
   (тот же приём, что у .chain-result-line в окне "Результат"). Строки Гориз.XOR (Сквозная/
   Цель/Результат) — та же логика, но по отдельности (horizRowExpanded, ключ = data-tag). */
const stepLogBodyEl = document.getElementById("stepLogBody");
if (stepLogBodyEl) {
  stepLogBodyEl.addEventListener("click", (e) => {
    // Клик по строке фазы в "🎭 Находках по маскам" — показать сквозную ЭТОЙ фазой (см.
    // maskThroughHtml). Проверяем раньше остальных веток: строка фазы лежит внутри того же блока.
    /* Клик по строке РЕЖИМА в "🎭 Находках по маскам" — показать в самих цепочках ТОЛЬКО эту
       находку (v0.919, запрос пользователя). То же, что клик по строке в окне "Результат", но
       оттуда фазы маски не выбрать: там на каждый режим+фазу своя строка, а тут они разложены по
       фазам. Проверяем ПЕРЕД строкой фазы: строка режима лежит внутри того же блока, а у самой
       фазы своё действие (показать сквозную этой фазой). Повторный клик снимает выбор — снова
       показывается первая совпавшая находка. */
    /* Клик по полосе «сквозная · фаза» — ПЕРЕМОТАТЬ ЕЁ К НАХОДКЕ (v0.921, запрос пользователя).
       Полоса длиннее своей ширины и прокручивается, но скроллбар у неё скрыт, и добраться до
       совпадения вручную было почти нельзя. Шаг символа берём из реальной геометрии
       (scrollWidth / число нарисованных символов) — шрифт моноширинный, так что этого достаточно
       и мерить отдельный бит не нужно. Ставим находку по центру видимой части; повторный клик,
       когда она уже видна, отматывает полосу в начало. */
    const thr = e.target.closest(".step-log-mask-through");
    if (thr) {
      const box = thr.querySelector(".step-log-mask-bits");
      const at = box ? +box.dataset.hitAt : -1;
      const total = box ? +box.dataset.bitsLen : 0;
      if (box && at >= 0 && total > 0 && box.scrollWidth > box.clientWidth) {
        const step = box.scrollWidth / total;
        const want = Math.max(0, at * step - box.clientWidth / 2);
        const seen = box.scrollLeft <= at * step && at * step <= box.scrollLeft + box.clientWidth;
        box.scrollLeft = seen ? 0 : want;
      }
      return;
    }
    const hitEl = e.target.closest("[data-hit-mode]");
    if (hitEl) {
      const m = hitEl.dataset.hitMode;
      st.bgHitPick = (st.bgHitPick === m) ? null : m;
      render();
      say(st.bgHitPick
        ? "В цепочках показана находка режима «" + bgModeLabel(m) + "»."
        : "Выбор снят — в цепочках снова первая совпавшая находка.");
      return;
    }
    const phEl = e.target.closest("[data-mask-phase]");
    if (phEl) {
      st.maskDraftPhase = +phEl.dataset.maskPhase;
      render();
      return;
    }
    const horizRow = e.target.closest(".horiz-ride-row");
    if (horizRow) {
      const tag = horizRow.dataset.tag;
      if (horizRowExpanded.has(tag)) horizRowExpanded.delete(tag); else horizRowExpanded.add(tag);
      render();
      return;
    }
    if (!e.target.closest(".step-log-result")) return;
    stepLogResultExpanded = !stepLogResultExpanded;
    render();
  });
}

/* Ручной драг высоты "Черновика шага" за .step-log-resize-handle — прямо задаёт
   stepLogBodyHeight (px), applyStepLogBodyHeight() в следующих render() будет держать именно
   её (расти может, сжаться сама — нет). */
const stepLogResizeHandleEl = document.getElementById("stepLogResizeHandle");
if (stepLogResizeHandleEl) {
  let dragStartY = 0, dragStartH = 0, dragging = false;
  stepLogResizeHandleEl.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    dragging = true;
    dragStartY = e.clientY;
    dragStartH = stepLogBodyEl.offsetHeight;
    stepLogResizeHandleEl.classList.add("dragging");
  });
  window.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    const h = Math.max(24, dragStartH + (e.clientY - dragStartY));
    stepLogBodyHeight = h;
    stepLogBodyEl.style.height = h + "px";
  });
  window.addEventListener("mouseup", () => {
    if (!dragging) return;
    dragging = false;
    stepLogResizeHandleEl.classList.remove("dragging");
    saveCache();
  });
}
/* Такая же ручка высоты у панели «Результат» (запрос пользователя — "сделай такую же ручку
   перетаскивания границы у Результатов, как и у Черновика"). Класс ручки переиспользован тот же
   (.step-log-resize-handle), чтобы вид/поведение совпадали один в один. Отличие от Черновика — тут
   высоту храним прямо в inline-стиле #chainText, отдельной переменной не нужно: у этой панели нет
   аналога applyStepLogBodyHeight(), которая пересчитывала бы высоту на каждом render(). Заодно
   снимаем max-height (по умолчанию 40vh) — иначе перетаскивание ВЫШЕ этого потолка визуально
   ничего бы не давало. */
const chainResultResizeHandleEl = document.getElementById("chainResultResizeHandle");
const chainTextResizeEl = document.getElementById("chainText");
if (chainResultResizeHandleEl && chainTextResizeEl) {
  let dragStartY = 0, dragStartH = 0, dragging = false;
  chainResultResizeHandleEl.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    dragging = true;
    dragStartY = e.clientY;
    dragStartH = chainTextResizeEl.offsetHeight;
    chainResultResizeHandleEl.classList.add("dragging");
  });
  window.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    const h = Math.max(24, dragStartH + (e.clientY - dragStartY));
    chainTextResizeEl.style.maxHeight = "none";
    chainTextResizeEl.style.height = h + "px";
  });
  window.addEventListener("mouseup", () => {
    if (!dragging) return;
    dragging = false;
    chainResultResizeHandleEl.classList.remove("dragging");
    saveCache();
  });
}
/* === МАРКЕР 10: СОБЫТИЯ === */
const cPullEl      = document.getElementById("cPull");
const cOrderEl     = document.getElementById("cOrder");
const cNextOnlyEl  = document.getElementById("cNextOnly");
const cStageXorEl  = document.getElementById("cStageXor");
const cInvPassEl   = document.getElementById("cInvPass");
const cAutoShiftEl = document.getElementById("cAutoShift");
const cStopOnHitEl = document.getElementById("cStopOnHit");
const cStopOnBalanceEl = document.getElementById("cStopOnBalance");
const cTurboAutoEl = document.getElementById("cTurboAuto");
const cCaptureOnFindEl = document.getElementById("cCaptureOnFind");
const cVertEl      = document.getElementById("cVert");
const cPadEl       = document.getElementById("cPad");
const cPadRealEl   = document.getElementById("cPadReal");
const cTailZerosEl = document.getElementById("cTailZeros");
// #cKinds стал кнопкой на 4 положения (v0.912) — состояние живёт в st.kindsMode (см. KINDS_MODES
// в fold-1). st.allKinds держится ПРОИЗВОДНЫМ: на него завязаны ключи мемо-кэшей и ветвления, где
// важен только сам факт "ищем не только прямой".
const bKindsEl     = document.getElementById("bKinds");
function setKindsMode(m, quiet){
  st.kindsMode = KINDS_MODES.indexOf(m) >= 0 ? m : "";
  st.allKinds = kindsInvOn() || kindsRevOn();
  if (bKindsEl) {
    bKindsEl.textContent = KINDS_MODE_LABELS[st.kindsMode];
    bKindsEl.classList.toggle("mode-act", !!st.kindsMode);
  }
  if (!quiet) { render(); saveCache(); }
}
if (bKindsEl) bKindsEl.onclick = () => {
  const cur = KINDS_MODES.indexOf(st.kindsMode || "");
  setKindsMode(KINDS_MODES[(cur + 1) % KINDS_MODES.length]);
  say("Версии паттерна: " + KINDS_MODE_LABELS[st.kindsMode].replace("⇌ ", "") +
      " (прямой ищется всегда).");
};
setKindsMode(st.kindsMode || "", true);
/* "🔎 Показать выделенное" — тумблер подсветки совпадений с образцом из выбранных ячеек
   (см. cellSampleRows в render()). Данные не трогает вообще, только показ. */
const bCellSampleEl = document.getElementById("bCellSample");
/* ВЫДЕЛЕНИЕ СТРОК НА ВРЕМЯ РЕЖИМА СНИМАЕТСЯ И ВОЗВРАЩАЕТСЯ (v0.913, запрос пользователя "в этом
   режиме убирать выделения всех строк, потом возвращать"): жёлтый фон выделенной строки лежит под
   битами всей строки целиком и спорит с подсветкой найденных кусков — на выделенной строке
   совпадение просто не разглядеть. Набор запоминается тут (в памяти сессии, в кэш не пишется) и
   возвращается при выключении режима — но только если за это время выделение никто не менял сам:
   иначе мы затёрли бы его свежий выбор. */
var selRowsBeforeCellSample = null;
function setCellSampleOn(on, quiet){
  const was = !!st.cellSampleOn;
  st.cellSampleOn = !!on;
  if (st.cellSampleOn && !was) {
    selRowsBeforeCellSample = new Set(st.selectedRows || []);
    st.selectedRows = new Set();
  } else if (!st.cellSampleOn && was && selRowsBeforeCellSample) {
    // Пока режим работал, выделения быть не должно было — если оно появилось, значит его сделал
    // пользователь уже внутри режима, и оно важнее старого.
    if (!st.selectedRows || !st.selectedRows.size) st.selectedRows = new Set(selRowsBeforeCellSample);
    selRowsBeforeCellSample = null;
  }
  // Выход из режима показа очищает накопитель "📌" — так и задумано (v0.945): набор собирают под
  // конкретную задачу, и тащить его в следующий сеанс показа незачем.
  if (!st.cellSampleOn && typeof cellPin !== "undefined" && cellPin.size) {
    cellPin.clear();
    if (typeof updateCellSampleFixBtn === "function") updateCellSampleFixBtn();
  }
  if (bCellSampleEl) bCellSampleEl.classList.toggle("mode-act", st.cellSampleOn);
  if (!quiet) { render(); saveCache(); }
}
if (bCellSampleEl) bCellSampleEl.onclick = () => {
  setCellSampleOn(!st.cellSampleOn);
  if (!st.cellSampleOn) { say("Показ совпадений с выбранными ячейками выключен."); return; }
  const sample = (typeof cellSelSampleText === "function") ? cellSelSampleText() : "";
  say(!cellSel.size
    ? "Показать выделенное: сначала выберите ячейки («▭ Выбор ячеек» во вкладке «Выделить»)."
    : sample.length < 2
      ? `Показать выделенное: образец «${sample}» короче двух бит — такой есть в каждой строке, искать нечего.`
      : `Показать выделенное: ищу «${sample}» во всех строках (${KINDS_MODE_LABELS[st.kindsMode || ""].replace("⇌ ", "")}).`);
};
setCellSampleOn(st.cellSampleOn, true);
/* "📌 ЗАФИКСИРОВАТЬ" (v0.945, запрос пользователя: "кнопку зафиксить найденное в этой строке, пока
   не выйти из режима или по Escape... потом другие выделенные ячейки ищут и может найдут
   оставшиеся биты, ещё раз нажму — и они тоже отметятся, так могу всю строку склеить").
   Найденное образцом живёт ровно до следующего выбора ячеек. Кнопка перекладывает то, что сейчас
   подсвечено, в отдельный набор cellPin — он копится от нажатия к нажатию и рисуется своим цветом
   ПОВЕРХ свежих находок (см. .cell-pin в render). Так строка собирается по кускам: выбрал ячейки —
   нашлось — зафиксировал — выбрал другие — нашлось ещё — зафиксировал.
   Своего поиска у кнопки нет: берёт lastCellSampleRows, тот самый разбор, что нарисован на экране.
   Значит и ограничение "выделена одна строка → только она" (v0.943) действует само собой. */
function updateCellSampleFixBtn(){
  const b = elById("bCellSampleFix");
  if (!b) return;
  b.textContent = "📌 Зафиксировать: " + cellPin.size;
  b.classList.toggle("mode-act", cellPin.size > 0);
}
function clearCellPin(quiet){
  if (!cellPin.size) return false;
  cellPin.clear();
  updateCellSampleFixBtn();
  if (!quiet) say("Накопитель зафиксированных бит очищен.");
  render();
  return true;
}
const bCellSampleFixEl = document.getElementById("bCellSampleFix");
if (bCellSampleFixEl) bCellSampleFixEl.onclick = () => {
  if (!st.cellSampleOn) { say("📌 Фиксировать нечего: включите «🔎 Показать» — фиксируются именно его находки."); return; }
  const rowsMap = lastCellSampleRows;
  if (!rowsMap || !rowsMap.size) { say("📌 Фиксировать нечего: сейчас ни одного совпадения с образцом не подсвечено."); return; }
  let added = 0;
  rowsMap.forEach((marks, r) => {
    for (let k = 0; k < marks.length; k++) {
      if (marks[k] < 0) continue;
      const key = r + "|" + k;
      if (cellPin.has(key)) continue;
      cellPin.add(key); added++;
    }
  });
  updateCellSampleFixBtn();
  say(added
    ? `📌 Зафиксировано бит: +${added} (всего ${cellPin.size}). Выберите другие ячейки — найденное ими можно дофиксировать сюда же. Сброс — Escape.`
    : `📌 Все подсвеченные биты уже в накопителе (всего ${cellPin.size}).`);
  render();
};
updateCellSampleFixBtn();
/* Escape — сброс накопителя. Слушаем на документе: у полей ввода строк свои обработчики Escape,
   и они гасят событие stopPropagation'ом, так что правку строки эта кнопка не заденет. */
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape" || !cellPin.size) return;
  const t = e.target;
  if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
  clearCellPin();
});
/* "⛓ сквозно" — вторая кнопка рядом с "🔎 Показать" (v0.942). Своего поиска не ведёт: просто
   флаг, который читает cellSampleRows выше. Подпись держим в одном месте, чтобы состояние было
   видно и после перезагрузки/переключения вкладки (applyUiSettings зовёт ту же функцию). */
const bCellSampleSeqEl = document.getElementById("bCellSampleSeq");
function updateCellSampleSeqBtn(){
  const b = elById("bCellSampleSeq");
  if (!b) return;
  b.textContent = "⛓ сквозно: " + (st.cellSampleSeq ? "вкл" : "выкл");
  b.classList.toggle("mode-act", !!st.cellSampleSeq);
}
if (bCellSampleSeqEl) bCellSampleSeqEl.onclick = () => {
  st.cellSampleSeq = !st.cellSampleSeq;
  updateCellSampleSeqBtn();
  say(st.cellSampleSeq
    ? "Образец из ячеек ищется ТАКЖЕ сквозь строки — по всем склейкам, отмеченным в «🔍 Фон-поиске» (→ / ← / 🐍 / 🐍 справа). Совпадение на стыке засчитывается и подсвечивается в обеих строках."
    : "Сквозной поиск образца выключен — только внутри каждой строки."
  );
  render(); saveCache();
};
updateCellSampleSeqBtn();
/* КЛИК ПО ХОЛСТУ МИМО БИТОВ — СНЯТЬ НАБОР ЯЧЕЕК (v0.913, запрос пользователя "клик вне битов
   цепочек — снять все выделенные биты"). Раньше единственным способом очистить набор была кнопка
   "✕ Очистить биты": выключение режима "▭ Выбор ячеек" его только прячет.
   СНИМАЮТСЯ ТОЛЬКО ЯЧЕЙКИ (подтверждено пользователем в v0.939): выделение строк и выбранный
   столбец этот клик не трогает — в v0.938 я их тоже сбрасывал, и это откачено, потому что вместе
   со строкой уходила цель фон-поиска.
   ЧТО СЧИТАТЬ "МИМО БИТОВ" (правка v0.939): раньше стояла проверка e.target.closest(".bits") —
   а .bits это ВСЯ полоса поля во всю ширину, включая пустое место слева и справа от самой
   строки. Клик по пустоте внутри строки в неё попадал, и набор не снимался — работало только
   ниже последней строки (жалоба пользователя "а их не снимает"). Теперь выходим, только если
   попали в НАСТОЯЩИЙ бит (.b0/.b1): по ним идёт выбор ячеек, и снимать набор при клике по ним
   нельзя, а всё остальное поле — это "мимо".
   Ловим на самом холсте, а не на документе: клики по кнопкам панелей набор трогать не должны —
   иначе первое же нажатие "🔎 Показать выделенное" стирало бы то, что собирались показать.
   Исключены и служебные элементы ВНУТРИ холста: полоса выравниваний, линейка столбцов и все
   перетаскиваемые границы — там идёт своя работа мышью, и снимать набор посреди неё нельзя.
   mousedown, а не click: протяжка по битам заканчивается mouseup вне .bits, и click от неё
   пришёл бы уже на холст, стирая только что набранное. */
{
  const canvasEl = document.getElementById("screenCanvas");
  if (canvasEl) canvasEl.addEventListener("mousedown", (e) => {
    if (e.button !== 0 || !(cellSel.size || patCellSel.size)) return;
    if (e.target.closest(".b0, .b1, [data-pcol]")) return;
    if (e.target.closest("#alignGrp, #colHeader, .vsplit, .vsplit2, .vsplit3, .axis-split, #colPickFloat, .state-badges, button, input, select, label")) return;
    cellSel.clear();
    patCellSel.clear();
    render(); saveCache();
    say("Выделения битов сняты (клик мимо битов).");
  });
}
const cSkipEl      = document.getElementById("cSkip1");
const cSkipLastEl  = document.getElementById("cSkipLast");
const cRingInvertEl = document.getElementById("cRingInvert");
const cRingReverseEl = document.getElementById("cRingReverse");
const cRingOffEl = document.getElementById("cRingOff");
const cChainCutBelowEl = document.getElementById("cChainCutBelow");
const cChainCutTailEl = document.getElementById("cChainCutTail");
const cSeqSelfEl = document.getElementById("cSeqSelf");
const cHorizRotateOnFailEl = document.getElementById("cHorizRotateOnFail");
const cHorizAlternateSideEl = document.getElementById("cHorizAlternateSide");
const cHorizReverseChainEl = document.getElementById("cHorizReverseChain");
const cHorizShowLiveXorEl = document.getElementById("cHorizShowLiveXor");
const cAxisSnapEl = document.getElementById("cAxisSnap");
const cAxisBitBounceEl = document.getElementById("cAxisBitBounce");
const cEdgeOnesEl = document.getElementById("cEdgeOnes");
const cNoSplitOnesEl = document.getElementById("cNoSplitOnes");
const cInterleavePadEvenEl = document.getElementById("cInterleavePadEven");
const cAxisSnapAnyEl = document.getElementById("cAxisSnapAny");
const rowCountEl   = document.getElementById("rowCount");

function readToggles(){
  st.pull      = cPullEl.checked;
  st.keepOrder = cOrderEl.checked;
  st.nextOnly  = cNextOnlyEl ? cNextOnlyEl.checked : false;
  st.stageXor  = cStageXorEl ? cStageXorEl.checked : false;
  st.invPass   = cInvPassEl ? cInvPassEl.checked : false;
  st.autoShift = cAutoShiftEl ? cAutoShiftEl.checked : false;
  st.stopOnHit = cStopOnHitEl ? cStopOnHitEl.checked : true;
  st.stopOnBalance = cStopOnBalanceEl ? cStopOnBalanceEl.checked : false;
  st.turboAuto = cTurboAutoEl ? cTurboAutoEl.checked : false;
  st.captureOnFind = cCaptureOnFindEl ? cCaptureOnFindEl.checked : true;
  st.horizRotateOnFail = cHorizRotateOnFailEl ? cHorizRotateOnFailEl.checked : true;
  st.horizAlternateSide = cHorizAlternateSideEl ? cHorizAlternateSideEl.checked : false;
  st.horizReverseChain = cHorizReverseChainEl ? cHorizReverseChainEl.checked : false;
  st.horizShowLiveXor = cHorizShowLiveXorEl ? cHorizShowLiveXorEl.checked : true;
  st.vertical  = cVertEl.checked;
  st.padZero   = cPadEl.checked;
  st.padZeroReal = cPadRealEl ? cPadRealEl.checked : false;
  st.tailZerosByTarget = cTailZerosEl ? cTailZerosEl.checked : false;
  // st.allKinds теперь ПРОИЗВОДНОЕ от st.kindsMode (см. setKindsMode) — readToggles его не трогает.
  st.skipFirst = cSkipEl.checked;
  st.skipLast  = cSkipLastEl ? cSkipLastEl.checked : false;
  st.ringInvert = cRingInvertEl ? cRingInvertEl.checked : false;
  st.ringReverse = cRingReverseEl ? cRingReverseEl.checked : false;
  st.ringOff = cRingOffEl ? cRingOffEl.checked : false;
  st.chainCutBelow = cChainCutBelowEl ? cChainCutBelowEl.checked : false;
  st.chainCutTail = cChainCutTailEl ? cChainCutTailEl.checked : false;
  st.seqSelfMode = cSeqSelfEl ? cSeqSelfEl.checked : false;
  st.axisSnap = cAxisSnapEl ? cAxisSnapEl.checked : true;
  st.axisBitBounce = cAxisBitBounceEl ? cAxisBitBounceEl.checked : false;
  st.edgeOnes = cEdgeOnesEl ? cEdgeOnesEl.checked : false;
  st.noSplitOnes = cNoSplitOnesEl ? cNoSplitOnesEl.checked : false;
  // st.axisDiagCols тут НЕ читаем — это трёхпозиционная кнопка (см. setAxisDiagCols), а не галка.
  st.interleavePadEven = cInterleavePadEvenEl ? cInterleavePadEvenEl.checked : false;
  st.axisSnapAny = cAxisSnapAnyEl ? cAxisSnapAnyEl.checked : false;
}

/* Функция полной очистки данных текущего активного слота (цепочки).
   Если у вкладки ещё НЕТ своей сохранёнки (пользователь ни разу не жал "Сохранить" вручную) —
   перед стиранием авто-сохраняем состояние КАК ОНО БЫЛО, чтобы "Сброс" потом мог его вернуть.
   Если сохранёнка уже есть — её не трогаем (не затираем осознанное ручное сохранение). */
function clearActiveTab() {
  snapshot();
  if (st.tabs && st.tabs[st.activeTab] && !st.tabs[st.activeTab].savedChain) {
    st.tabs[st.activeTab].savedChain = {
      rows: st.rows.slice(),
      pats: st.pats.map(p => p ? { ...p } : null),
      used: st.used.slice(),
      tplRows: st.tplRows.slice(),
      tplPats: st.tplPats.slice()
    };
  }
  st.tplRows = [];
  st.tplPats = [];
  st.rows = [];
  st.used = [];
  st.pats = [];
  st.step = 0;
  st.passCount = 0;
  st.horizBitIdx = 0;
  st.lastXorBitA = null;
  st.tailText = "";
  st.tailFlags = [];
  st.hit = null;
  st.selectedRows = new Set();
  
  const taR = document.getElementById("taRows");
  const taP = document.getElementById("taPats");
  if (taR) taR.value = "";
  if (taP) taP.value = "";
  
  render();
  saveCache();
  say("Текущая вкладка полностью очищена!");
}

/* Сохранить/очистить/сбросить данные ЛЮБОЙ вкладки по индексу, не обязательно активной (кнопки
   в выпадающем списке цепочек — см. renderTabs()/chainDdListEl). Единственное место, где живёт
   "сохранёнка" цепочки — st.tabs[idx].savedChain (никакого общего на всё приложение поля
   больше нет); настройки вида/поиска сюда не входят — они отдельно, см. captureUiSettings/
   DEFAULT_UI_SETTINGS и кнопки в "Вид".
   Если idx — активная вкладка, читаем/пишем живые st.rows/st.pats и т.д. (полноценно, с
   рендером холста); если нет — работаем НАПРЯМУЮ с объектом st.tabs[idx], не переключаясь на
   неё (без мерцания холста, без временной подмены активной вкладки). */
function tabSaveChainData(idx) {
  if (!st.tabs || !st.tabs[idx]) return;
  const isActive = idx === st.activeTab;
  // ВПИСЫВАНИЕ ЗЕРКАЛ — теперь часть сохранения (v0.886, запрос пользователя: отдельную кнопку
  // "⇔ Вписать зеркала в строки" убрали). Что видно зеркалами, то и уходит в сохранёнку живыми
  // битами: дальше они участвуют в поиске и склейках наравне с остальными. Показ ◀/▶ при этом
  // гаснет — иначе следующее сохранение вписало бы зеркало на зеркале. Только для АКТИВНОЙ
  // вкладки: у неактивной показа зеркал нет вовсе, там сохранять нечего.
  if (isActive && (st.leftMirror || st.rightMirror) && typeof applyMirrorsToRows === "function") {
    applyMirrorsToRows(false, null, true);
  }
  const src = isActive ? st : st.tabs[idx];
  st.tabs[idx].savedChain = {
    rows: (src.rows || []).slice(),
    pats: (src.pats || []).map(p => p ? { ...p } : null),
    used: (src.used || []).slice(),
    tplRows: (src.tplRows || []).slice(),
    tplPats: (src.tplPats || []).slice(),
    // Пометка «новые биты» сохраняется ВМЕСТЕ с цепочкой: после Сброса/Escape новые биты
    // возвращаются такими же новыми (см. newBitsMap и ветку savedChain в resetAll).
    newBits: isActive ? newBitsSerialize() : ((st.tabs[idx].newBits) || [])
  };
  // Сохранённое состояние стало новой базой для подсветки "номер изменился" (см. changedBase
  // в render()) — перерисовываем строки сразу, иначе оранжевые номера висят до следующего
  // не связанного действия.
  if (isActive) render();
  renderTabs();
  saveCache();
  say(`✓ «${st.tabs[idx].name}» сохранена!`);
}

function tabClearChainData(idx) {
  if (!st.tabs || !st.tabs[idx]) return;
  if (idx === st.activeTab) { clearActiveTab(); return; }
  const t = st.tabs[idx];
  if (!confirm(`Полностью очистить «${t.name}»? Строки, паттерны и история будут потеряны.`)) return;
  // Та же логика авто-сохранения перед очисткой, что и в clearActiveTab() — если своей
  // сохранёнки у вкладки ещё нет, "Сброс" потом сможет вернуть то, что было.
  if (!t.savedChain) {
    t.savedChain = {
      rows: (t.rows || []).slice(),
      pats: (t.pats || []).map(p => p ? { ...p } : null),
      used: (t.used || []).slice(),
      tplRows: (t.tplRows || []).slice(),
      tplPats: (t.tplPats || []).slice()
    };
  }
  t.tplRows = []; t.tplPats = []; t.rows = []; t.used = []; t.pats = [];
  t.step = 0; t.passCount = 0; t.tailBuffer = ""; t.selectedRows = []; t.undo = [];
  renderTabs();
  saveCache();
  say(`✓ «${t.name}» полностью очищена!`);
}

/* Очистка ТОЛЬКО поля цепочки — строк битов ("🧹1" в выпадающем списке цепочек). Прямой аналог
   tabClearChainData(), но паттерны (st.pats и шаблон st.tplPats) НЕ трогаются вообще: колонки
   "Паттерн"/"П2" остаются как были, стираются только сами строки и всё, что к ним привязано —
   шаблон строк, отметки "участвует" (used), счётчики шага/прохода, хвост и находка.
   Авто-сохранение перед стиранием — то же, что и у полной очистки: если своей сохранёнки у
   вкладки ещё нет, "↺" потом сможет вернуть то, что было (сохраняем состояние ЦЕЛИКОМ, вместе с
   паттернами — они и так не меняются). */
function tabClearRowsOnly(idx) {
  if (!st.tabs || !st.tabs[idx]) return;
  const isActive = idx === st.activeTab;
  const t = st.tabs[idx];
  if (!isActive && !confirm(`Очистить строки битов у «${t.name}»? Паттерны останутся.`)) return;
  const src = isActive ? st : t;
  if (!t.savedChain) {
    t.savedChain = {
      rows: (src.rows || []).slice(),
      pats: (src.pats || []).map(p => p ? { ...p } : null),
      used: (src.used || []).slice(),
      tplRows: (src.tplRows || []).slice(),
      tplPats: (src.tplPats || []).slice()
    };
  }
  if (isActive) {
    snapshot();
    st.tplRows = [];
    st.rows = [];
    st.used = [];
    st.step = 0;
    st.passCount = 0;
    st.horizBitIdx = 0;
    st.lastXorBitA = null;
    st.tailText = "";
    st.tailFlags = [];
    st.hit = null;
    st.selectedRows = new Set();
    const taR = document.getElementById("taRows");
    if (taR) taR.value = "";
    render();
  } else {
    t.tplRows = []; t.rows = []; t.used = [];
    t.step = 0; t.passCount = 0; t.tailBuffer = ""; t.selectedRows = []; t.undo = [];
  }
  renderTabs();
  saveCache();
  say(`✓ «${t.name}»: строки битов очищены, паттерны оставлены.`);
}

function tabResetChainData(idx) {
  if (!st.tabs || !st.tabs[idx]) return;
  if (idx === st.activeTab) { resetAll(); saveCache(); say("✓ Сброшена текущая вкладка."); return; }
  const t = st.tabs[idx];
  if (t.savedChain) {
    t.rows = t.savedChain.rows.slice();
    t.pats = t.savedChain.pats.map(p => p ? { ...p } : null);
    t.used = t.savedChain.used.slice();
  } else {
    const limit = (t.tplRows || []).length;
    t.rows = (t.tplRows || []).slice(0, limit);
    t.used = t.rows.map(() => false);
    t.pats = (t.tplPats || []).slice(0, limit).map((text, i) => ({ text, ord: i, found: false, kind: null, step: null }));
  }
  t.step = 0; t.selectedRows = [];
  renderTabs();
  saveCache();
  say(`✓ «${t.name}» сброшена.`);
}
/* === МАРКЕР 10.1: DRAG AND DROP === */
/* Вспомогательная функция для определения зоны броска */
function isOverPatternColumn(e) {
  // На ПУСТОЙ вкладке (после 🧹 Очистить/до первой загрузки) строк ещё нет — ни .pat/.pat2
  // (они per-row, рендерятся только когда есть данные), ни координатный разбор ниже не работают
  // осмысленно (нечего визуально делить на "зону паттернов"/"зону строк"). Без этой проверки
  // дроп на пустой вкладке ВСЕГДА попадал в паттерны (см. запрос пользователя — "не вставляет
  // строки"), а не туда, куда реально целился курсор — тут просто нечего мерить. Раз ветку
  // (строки/паттерны) в этот момент всё равно не разглядеть на глаз, по умолчанию считаем
  // "строки" — это и есть обычный первый шаг работы с пустой вкладкой.
  if (!st.rows || !st.rows.length) return false;

  // Прямое попадание по боковым колонкам или разделителям
  if (e.target.closest('.pat') || e.target.closest('.pat2')) return true;
  if (e.target.closest('.vsplit') || e.target.closest('.vsplit2')) return true;

  // Координатный поиск: если мышь левее или правее центральной колонки битсов
  const bitsHead = document.querySelector('.h-bits');
  if (bitsHead) {
    const rect = bitsHead.getBoundingClientRect();
    if (e.clientX < rect.left || e.clientX > rect.right) {
      return true; // Бросок в зону паттернов (левую или правую)
    }
  }
  return false; // Бросок в зону строк
}

/* Умный Drag & Drop файлов с подсветкой целевой колонки */
const canvasEl = document.querySelector(".canvas");
if (canvasEl) {
  canvasEl.addEventListener("dragover", e => {
    e.preventDefault();
    if (isOverPatternColumn(e)) {
      canvasEl.classList.add("drop-pats");
      canvasEl.classList.remove("drop-rows");
    } else {
      canvasEl.classList.add("drop-rows");
      canvasEl.classList.remove("drop-pats");
    }
  });

  canvasEl.addEventListener("dragleave", e => {
    e.preventDefault();
    canvasEl.classList.remove("drop-rows", "drop-pats");
  });

  canvasEl.addEventListener("drop", e => {
    e.preventDefault();
    const isPats = isOverPatternColumn(e);
    canvasEl.classList.remove("drop-rows", "drop-pats");
    
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const reader = new FileReader();
      reader.onload = ev => {
        const lines = parseLines(ev.target.result);
        // Сброс savedChain — см. комментарий у loadTemplate(), та же ловушка: resetAll() ниже
        // при наличии сохранёнки (в т.ч. авто-созданной при 🧹 Очистить) восстановил бы её вместо
        // только что загруженного файла (см. запрос пользователя — "нет ничего, или серпинский").
        if (st.tabs && st.tabs[st.activeTab]) st.tabs[st.activeTab].savedChain = null;
        if (isPats) {
          st.tplPats = lines;
          say(`Паттерны из файла "${file.name}" загружены в текущую вкладку!`);
        } else {
          st.tplRows = lines;
          syncRowCountToTpl();
          say(`Строки из файла "${file.name}" загружены в текущую вкладку!`);
        }
        resetAll();
        saveCache();
      };
      reader.readAsText(file, "UTF-8");
    }
  });

  /* Ctrl+V над канвасом — тот же приём, что drag&drop файла выше, но из буфера обмена:
     целевая зона (строки в центре / паттерны слева-справа) определяется ПОСЛЕДНЕЙ известной
     позицией мыши над канвасом (у paste-события своих координат нет). Полная замена
     tplRows/tplPats, как при дропе — не точечная вставка по курсору внутри поля. */
  let lastCanvasMouseEvt = null;
  canvasEl.addEventListener("mousemove", e => { lastCanvasMouseEvt = e; });
  canvasEl.addEventListener("mouseleave", () => { lastCanvasMouseEvt = null; });

  document.addEventListener("paste", e => {
    const at = document.activeElement;
    if (at && (at.tagName === "INPUT" || at.tagName === "TEXTAREA" || at.isContentEditable)) return;
    if (!lastCanvasMouseEvt) return;
    const text = e.clipboardData && e.clipboardData.getData("text");
    if (!text) return;
    e.preventDefault();
    const isPats = isOverPatternColumn(lastCanvasMouseEvt);
    const lines = parseLines(text);
    // Сброс savedChain — та же ловушка, что и у loadTemplate()/drop файла (см. их комментарии).
    if (st.tabs && st.tabs[st.activeTab]) st.tabs[st.activeTab].savedChain = null;
    if (isPats) {
      st.tplPats = lines;
      say("Паттерны вставлены из буфера обмена в текущую вкладку!");
    } else {
      st.tplRows = lines;
      syncRowCountToTpl();
      say("Строки вставлены из буфера обмена в текущую вкладку!");
    }
    resetAll();
    saveCache();
  });
}

/* === МАРКЕР 10.2: ВКЛАДКИ === */
/* Управление вкладками-цепочками — свой выпадающий список #chainDd/#chainDdList (см.
   renderTabs()). Тоггл открывает/закрывает список; клик по строке переключает вкладку; клик по
   "✕" в строке закрывает ИМЕННО эту вкладку (не обязательно текущую) — если закрывается НЕ
   активная, живые st.rows/st.pats текущей вкладки не трогаем, просто убираем запись из
   st.tabs и поправляем индекс активной, если она сдвинулась. Если закрывается активная —
   тот же путь, что раньше был у bCloseTab (splice + переход на соседнюю), но с
   loadTabState(idx, true): пропускаем saveActiveTabState(), иначе он попытался бы сохранить
   ЖИВЫЕ (ещё от закрываемой вкладки) st.rows поверх новой активной, испортив её данные. */
const chainDdToggleEl = document.getElementById("chainDdToggle");
const chainDdListEl = document.getElementById("chainDdList");
// Таймер отложенного переключения вкладки по клику на .chain-dd-item (см. ниже) — общий для
// click/dblclick обработчиков.
let chainDdItemClickTimer = null;
if (chainDdToggleEl && chainDdListEl) {
  chainDdToggleEl.onclick = (e) => {
    e.stopPropagation();
    chainDdListEl.classList.toggle("open");
  };
  chainDdListEl.addEventListener("click", e => {
    // Подвал списка — экспорт/импорт ВСЕХ вкладок (см. .chain-dd-footer в renderTabs()).
    // Проверяем ПЕРВЫМ: эти кнопки не относятся ни к какой конкретной вкладке, у них нет
    // data-idx, и ниже они не должны попасть в ветку "клик по строке списка".
    const fileBtn = e.target.closest(".chain-dd-file");
    if (fileBtn) {
      e.stopPropagation();
      const act = fileBtn.dataset.act;
      if (act === "export") exportAllTabs();
      else if (act === "wipe") clearAllCache();
      else if (act === "banksave") patsToPatBank();
      else if (act === "bankpats") patBankToPats();
      else if (act === "bankrows") patBankToRows();
      // Настройки вида — см. последний ряд подвала в renderTabs(). Сами функции объявлены в
      // fold-5-ui.js (он грузится позже, но к моменту клика уже выполнен).
      else if (act === "uisave") saveUiSettingsNow();
      else if (act === "uireset") resetUiSettingsNow();
      else if (act === "copychain") copySelectedRows(true);
      // Явная ветка вместо прежнего "else importAllTabs()": с ростом числа кнопок молчаливый
      // fallback означал бы, что любая новая кнопка без своей ветки внезапно грузит файл.
      else if (act === "import") importAllTabs();
      return;
    }
    const miniBtn = e.target.closest(".chain-dd-mini");
    if (miniBtn) {
      e.stopPropagation();
      const idx = +miniBtn.dataset.idx;
      const act = miniBtn.dataset.act;
      // "clear"/"clearrows" из этого списка убраны (v0.890, запрос пользователя "перемести в
      // Построения") — теперь это две кнопки во вкладке "Построения" и работают они по АКТИВНОЙ
      // цепочке. Сами tabClearChainData()/tabClearRowsOnly() на месте, вызываются оттуда.
      if (act === "save") tabSaveChainData(idx);
      else if (act === "reset") tabResetChainData(idx);
      return;
    }
    const closeBtn = e.target.closest(".chain-dd-close");
    if (closeBtn) {
      e.stopPropagation();
      if (!st.tabs || st.tabs.length <= 1) return;
      const idx = +closeBtn.dataset.idx;
      const tabName = (st.tabs[idx] && st.tabs[idx].name) || "эту вкладку";
      if (!confirm(`Закрыть «${tabName}»? Все её строки и история шагов будут потеряны.`)) return;

      if (idx === st.activeTab) {
        st.tabs.splice(idx, 1);
        const newActive = Math.min(idx, st.tabs.length - 1);
        loadTabState(newActive, true);
      } else {
        st.tabs.splice(idx, 1);
        if (idx < st.activeTab) st.activeTab -= 1;
        renderTabs();
        saveCache();
      }
      return;
    }
    const item = e.target.closest(".chain-dd-item");
    if (!item) return;
    const idx = +item.dataset.idx;
    // Отложенное переключение (не сразу по click) — иначе ПЕРВЫЙ клик двойного клика (по имени,
    // см. dblclick ниже — переименование) уже успевал закрыть панель и переключить вкладку
    // раньше, чем вообще срабатывал dblclick — запрос пользователя "двойной клик перехватывается
    // одним кликом - панель пропадает". Если dblclick всё же случится — он сам отменяет этот
    // таймер (см. ниже), и переключения вкладки не происходит вовсе.
    if (chainDdItemClickTimer) clearTimeout(chainDdItemClickTimer);
    chainDdItemClickTimer = setTimeout(() => {
      chainDdItemClickTimer = null;
      chainDdListEl.classList.remove("open");
      if (idx !== st.activeTab) loadTabState(idx);
    }, 280);
  });
  document.addEventListener("click", e => {
    if (!chainDdListEl.classList.contains("open")) return;
    if (e.target.closest("#chainDd")) return;
    chainDdListEl.classList.remove("open");
  });
  // Переименование вкладки — двойной клик по её названию превращает <span> в <input> ПРЯМО НА
  // МЕСТЕ (тот же приём, что и startEditRow() для строк) — запрос пользователя "менять название
  // цепочкам". Enter/blur — сохранить, Escape — отменить. stopPropagation, чтобы двойной клик
  // не переключал вкладку и не закрывал список раньше времени.
  chainDdListEl.addEventListener("dblclick", e => {
    const nameEl = e.target.closest(".chain-dd-name");
    if (!nameEl) return;
    e.stopPropagation();
    if (chainDdItemClickTimer) { clearTimeout(chainDdItemClickTimer); chainDdItemClickTimer = null; }
    const item = nameEl.closest(".chain-dd-item");
    if (!item) return;
    const idx = +item.dataset.idx;
    const tab = st.tabs[idx];
    if (!tab) return;
    const inp = document.createElement("input");
    inp.type = "text";
    inp.className = "chain-dd-name-input";
    inp.value = tab.name;
    nameEl.replaceWith(inp);
    inp.focus();
    inp.select();
    const commit = () => {
      const newName = inp.value.trim();
      if (newName) tab.name = newName;
      renderTabs();
      saveCache();
    };
    inp.addEventListener("keydown", ev => {
      ev.stopPropagation();
      if (ev.key === "Enter") { ev.preventDefault(); commit(); }
      else if (ev.key === "Escape") { ev.preventDefault(); renderTabs(); }
    });
    inp.addEventListener("blur", commit);
    inp.addEventListener("click", ev => ev.stopPropagation());
  });
}

/* Глобальная 💾 в шапке — действует на ТЕКУЩУЮ активную вкладку, через ту же tabSaveChainData(),
   что и мини-кнопки в списке цепочек (единый источник правды — st.tabs[idx].savedChain,
   настройки вида/поиска сюда больше не входят).
   Отдельной кнопки "↩ Восстановить" больше нет — "↺ Сброс" (resetAll) и так уже сначала
   проверяет savedChain активной вкладки и восстанавливает из неё (см. resetAll()), так что
   "Восстановить" был точным дублем части поведения "Сброса", просто без отката к шаблону. */
const bSaveChainEl = document.getElementById("bSaveChain");
if (bSaveChainEl) {
  bSaveChainEl.onclick = () => tabSaveChainData(st.activeTab);
}

/* Экспорт/импорт ВСЕХ вкладок-цепочек в файл .json — запрос пользователя "сохранить все
   настройки с цепочками в файл, и загрузить все из файла". Формат — тот же st.tabs (массив
   объектов вкладок, включая rows/pats/used/uiSettings у каждой), что уже хранится в
   localStorage — просто дамп/восстановление ЦЕЛИКОМ, никакой отдельной схемы придумывать не
   нужно. */
// Кнопки живут в подвале выпадающего списка вкладок и пересоздаются на каждый renderTabs(),
// поэтому логика — в обычных функциях, а клик по ним ловится делегированием (см. chainDdListEl).
function exportAllTabs(){
  saveActiveTabState(); // флашим живые правки текущей вкладки в st.tabs перед дампом
  const payload = { app: "Zerkalius Fold", exportedAt: new Date().toISOString(), tabs: st.tabs, activeTab: st.activeTab };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "zerkalius-fold-tabs-" + new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-") + ".json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  say(`Сохранено в файл: ${st.tabs.length} вкладок.`);
}
const importTabsInputEl = document.getElementById("importTabsInput");
function importAllTabs(){
  if (importTabsInputEl) importTabsInputEl.click();
}

/* ПОЛНАЯ очистка кэша этого приложения в браузере: и состояние цепочек (CACHE_KEY), и раскладка
   панелей (LAYOUT_KEY). Нужна, когда именно сохранённое состояние вешает вкладку — в другом
   браузере тот же файл открывается нормально просто потому, что там localStorage пуст.
   Работает и в аварийном режиме (#safe): ключи стираются напрямую, загруженное состояние для
   этого не требуется. Перед reload взводим cacheWiped, иначе любой saveCache(), случившийся до
   перезагрузки, запишет всё обратно. */
function clearAllCache(){
  const msg = "Полностью очистить кэш?\n\n" +
    "Будут стёрты ВСЕ вкладки-цепочки со строками и паттернами, все настройки и раскладка панелей — " +
    "всё, что это приложение хранит в браузере. Отменить нельзя.\n\n" +
    "Если цепочки нужны — сначала выгрузи их кнопкой «⬇ Файл».\n\nПродолжить?";
  if (!confirm(msg)) return;
  cacheWiped = true;
  try { localStorage.removeItem(CACHE_KEY); } catch (e) {}
  try { localStorage.removeItem(LAYOUT_KEY); } catch (e) {}
  location.reload();
}
if (importTabsInputEl) {
  importTabsInputEl.onchange = () => {
    const file = importTabsInputEl.files && importTabsInputEl.files[0];
    importTabsInputEl.value = ""; // сброс — чтобы повторный выбор ТОГО ЖЕ файла тоже сработал
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      let data;
      try { data = JSON.parse(reader.result); }
      catch (e) { say("Файл повреждён или не JSON — не удалось загрузить."); return; }
      const tabs = Array.isArray(data) ? data : data.tabs; // поддержка и "голого" массива, и {tabs:[...]}
      if (!Array.isArray(tabs) || !tabs.length) { say("В файле нет ни одной вкладки-цепочки."); return; }
      if (!confirm(`Заменить ВСЕ текущие вкладки (${st.tabs.length}) на ${tabs.length} из файла? Текущие несохранённые данные будут потеряны.`)) return;
      st.tabs = tabs;
      const activeTab = (!Array.isArray(data) && Number.isInteger(data.activeTab) && data.activeTab >= 0 && data.activeTab < tabs.length) ? data.activeTab : 0;
      st.activeTab = activeTab;
      loadTabState(activeTab, true);
      saveCache();
      say(`Загружено из файла: ${tabs.length} вкладок.`);
    };
    reader.readAsText(file);
  };
}

/* КЭШ ПАТТЕРНОВ (v0.822, упрощён в v0.825). Три кнопки во втором ряду подвала списка цепочек:
   отложить текущие паттерны в кэш → вернуть кэш в колонку паттернов → разложить кэш в цепочку.
   Смысл — "отдельная полка": паттерны цепочки живут своей жизнью (правятся, стираются, уезжают
   вместе с переключением вкладки), а снятая с них копия лежит нетронутой, пока её не переснимут.
   Кэш (st.patBank) хранится в localStorage РЯДОМ с вкладками (см. saveCache), поэтому он один
   на все цепочки и переживает перезагрузку; стирается только общей "🗑 Кэш".
   Загрузку паттернов из текстового файла тут не делаем — оказалась не нужна (v0.825). */
function patsToPatBank(){
  const texts = (st.pats || []).map(p => (p && p.text) ? p.text : "");
  // Хвост пустых ячеек в кэш не кладём — он ничего не значит и только раздувает счётчик.
  while (texts.length && !texts[texts.length - 1]) texts.pop();
  const list = texts.filter(t => t);
  if (!list.length) { say("Отложить в кэш нечего: в этой цепочке нет ни одного паттерна."); return; }
  const had = (st.patBank && st.patBank.length) || 0;
  if (had && !confirm(`В кэше уже лежит ${had} паттернов. Заменить их текущими (${list.length})? Прежние пропадут.`)) return;
  st.patBank = list;
  renderTabs(); saveCache();
  say(`Отложено в кэш: ${list.length} паттернов. Правь их в цепочке как угодно — в кэше они останутся такими.`);
}
/* Кэш → КОЛОНКА ПАТТЕРНОВ. Строки цепочки не трогаем вообще: колонки живут независимо, их общая
   длина считается как Math.max(rows.length, pats.length), так что паттернов может быть и больше,
   чем строк. Отметки "найден"/kind/step у новых паттернов пустые — прежние находки не про них. */
function patBankToPats(){
  const bank = (st.patBank || []).filter(t => t);
  if (!bank.length) { say("Кэш паттернов пуст — сначала отложи туда текущие кнопкой «💾 Паттерны в кэш»."); return; }
  snapshot();
  /* НАЧИНАЕМ НЕ С НУЛЕВОГО ИНДЕКСА (исправлено в v0.829, жалоба "паттерны уходят вниз, если
     цепочку из кэша вставлять"). Сверху цепочки всегда стоит пустая нулевая строка (см.
     ensureZeroRow), а под ней может быть достроенный зеркальный верх — данных там нет, и
     паттернов у этих строк тоже быть не должно. Раньше кэш ложился с индекса 0, то есть первый
     паттерн вставал напротив нулевой строки, вся колонка оказывалась на строку выше цепочки, а
     следующая вставка "🧩⬇ В цепочку" (она зовёт ensureZeroRow и сдвигает всё вниз) добавляла
     ещё одну ступеньку — колонки расползались всё дальше. Теперь кэш кладётся ровно с первой
     строки С ДАННЫМИ, а если цепочка пуста — сразу под нулевую строку. */
  const firstData = firstDataIdx();
  const lead = firstData >= 0 ? firstData : (st.topBuilt || 0) + 1;
  const out = [];
  for (let i = 0; i < lead; i++) out.push({ text: "", ord: i, found: false, kind: null, step: null });
  bank.forEach((t, j) => out.push({ text: t, ord: lead + j, found: false, kind: null, step: null }));
  st.pats = out;
  st.selectedPats = new Set();
  render(); saveCache();
  say(`Паттерны из кэша разложены в колонку паттернов: ${bank.length} шт., начиная со строки №${lead + 1}. Прежние заменены — вернуть можно Undo.`);
  logStep("Кэш в паттерны", "", "", `${bank.length} шт.`);
}
/* Кэш → ЦЕПОЧКА. Та же самая работа, что у "🧩⬇ Паттерны в цепочку" — общая textsToChainRows()
   (см. fold-4-tools.js), только тексты берутся не из колонки паттернов, а из кэша. */
function patBankToRows(){
  const bank = (st.patBank || []).filter(t => t);
  if (!bank.length) { say("Кэш паттернов пуст — сначала отложи туда текущие кнопкой «💾 Паттерны в кэш»."); return; }
  textsToChainRows(bank, "Паттерны из кэша");
}

const bAddTabEl = document.getElementById("bAddTab");
if (bAddTabEl) {
  bAddTabEl.onclick = () => {
    saveActiveTabState();
    const newIdx = st.tabs.length;
    const newTab = createDefaultTabState("Цепочка " + (newIdx + 1));
    st.tabs.push(newTab);
    loadTabState(newIdx);
  };
}

// Кнопки #bClearTab в верхнем меню нет, и из выпадающего списка цепочек очистка тоже убрана
// (v0.890) — она переехала во вкладку "Построения": #bClearChainAll (строки + паттерны) и
// #bClearChainRows (только строки), обе по АКТИВНОЙ цепочке, см. их обработчики в fold-3.
// clearActiveTab() на месте — её зовёт tabClearChainData(), когда чистят активную вкладку.
const bClearChainAllEl = document.getElementById("bClearChainAll");
if (bClearChainAllEl) bClearChainAllEl.onclick = () => tabClearChainData(st.activeTab);
const bClearChainRowsOnlyEl = document.getElementById("bClearChainRows");
if (bClearChainRowsOnlyEl) bClearChainRowsOnlyEl.onclick = () => tabClearRowsOnly(st.activeTab);

