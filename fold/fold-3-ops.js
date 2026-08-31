/* Zerkalius Fold — часть 3/5: ОКНА И РЕЖИМЫ.
   Ползунок числа строк, попапы «Панели» и «Результат», перетаскивание и раскладка,
   меню, копирование, режимы шага, авто-прогон, фоновый поиск, спираль,
   удаление строк и разделители, осевые сдвиги.
   Подключается ПОСЛЕ fold-2-render.js. Порядок файлов менять нельзя. */

/* Ползунок "🔢 строк" НИЧЕГО не сбрасывает (запрос пользователя: "это не должно двигать ось
   цепочек"). Раньше он звал resetAll() — то есть полноценный Сброс: биты возвращались к шаблону,
   а вместе с ними обнулялись осевые сдвиги строк (axisOffsetMap/axisBitShiftMap), накрутка
   ◄/►Круг, инверсии — вся картинка прыгала на место. Теперь ползунок только ПРЯЧЕТ хвост строк
   снизу и возвращает их обратно: всё, что выше границы, остаётся ровно как было, включая
   положение строк относительно оси.
   Спрятанные строки лежат в стопке ниже и возвращаются такими же, какими ушли (флаги в
   axisOffsetMap/invFlagsMap и т.п. привязаны к НОМЕРУ строки, а номера у оставшихся не меняются —
   режем только с конца). Стопка обнуляется Сбросом и загрузкой нового шаблона: там строки
   пересобираются заново, и старый хвост к ним уже не относится. */
var rowCountStash = { rows: [], pats: [], used: [] };
var rowCountApplied = null;
function rowCountStashClear(){
  rowCountStash = { rows: [], pats: [], used: [] };
  const el = document.getElementById("rowCount");
  rowCountApplied = el ? +el.value : null;
}
function applyRowCountDelta(newVal){
  if (rowCountApplied === null) { rowCountApplied = newVal; return; }
  const delta = newVal - rowCountApplied;
  rowCountApplied = newVal;
  if (!delta) return;
  const built = st.topBuilt || 0;
  if (delta < 0) {
    // Прячем хвост. Нулевую строку и построения сверху не трогаем — под ползунок идёт только
    // цепочка, и хотя бы одна её строка обязана остаться.
    const cut = Math.min(-delta, Math.max(0, st.rows.length - built - 1));
    if (!cut) return;
    const at = st.rows.length - cut;
    rowCountStash.rows = st.rows.splice(at, cut).concat(rowCountStash.rows);
    rowCountStash.pats = st.pats.splice(at, cut).concat(rowCountStash.pats);
    rowCountStash.used = st.used.splice(at, cut).concat(rowCountStash.used);
    if (st.selectedRows && st.selectedRows.size) {
      st.selectedRows = new Set(Array.from(st.selectedRows).filter(r => r < at));
    }
    if (st.rowDividers && st.rowDividers.size) {
      st.rowDividers = new Set(Array.from(st.rowDividers).filter(d => d < at));
    }
  } else {
    let need = delta;
    const back = Math.min(need, rowCountStash.rows.length);
    if (back) {
      st.rows = st.rows.concat(rowCountStash.rows.splice(0, back));
      st.pats = st.pats.concat(rowCountStash.pats.splice(0, back));
      st.used = st.used.concat(rowCountStash.used.splice(0, back));
      need -= back;
    }
    // Стопка кончилась, а ползунок подняли ещё выше — недостающие строки берём из ШАБЛОНА, с той
    // же позиции, где кончается цепочка (то же правило, что и в resetAll при поднятом ползунке).
    if (need > 0) {
      const from = st.rows.length - built;
      const extraRows = (st.tplRows || []).slice(from, from + need);
      const extraPats = (st.tplPats || []).slice(from, from + need);
      if (extraRows.length) {
        const baseOrd = st.rows.length;
        st.rows = st.rows.concat(extraRows);
        st.used = st.used.concat(extraRows.map(() => false));
        st.pats = st.pats.concat(extraRows.map((_, k) => ({
          text: extraPats[k] || "", ord: baseOrd + k, found: false, kind: null, step: null
        })));
      }
    }
  }
}
if (rowCountEl) {
  rowCountEl.oninput = () => {
    document.getElementById("rowCountVal").textContent = rowCountEl.value;
    applyRowCountDelta(+rowCountEl.value);
    render();
    saveCache();
  };
}

/* Клик по шапке окошка сквозной строки/результата фон-поиска — свернуть/развернуть в одну строку */
const chainResultHeadEl = document.querySelector("#chainResultBox .chain-result-head");
if (chainResultHeadEl) {
  chainResultHeadEl.onclick = (e) => {
    if (e.target.closest("button") || e.target.closest(".overlay-drag") || e.target.closest(".overlay-close")) return;
    document.getElementById("chainResultBox").classList.toggle("collapsed");
  };
}

/* Клик по конкретной строке результата фон-поиска (#chainText .chain-result-line) —
   разворачивает именно эту строку целиком (снимает обрезку в одну линию) / сворачивает обратно.
   Не путать с кликом по шапке (chainResultHeadEl выше) — та сворачивает ВСЁ окошко целиком.
   ОТДЕЛЬНЫЙ СЛУЧАЙ — строки ОДНОЙ диагонали ("diagR#3" и т.п., см. diagSplitResults): клик по
   такой строке ВЫБИРАЕТ эту диагональ, и в самой таблице подсвечивается ТОЛЬКО она, а не все линии
   разом (запрос пользователя). Повторный клик снимает выбор. Выбранная строка заодно
   разворачивается, чтобы было видно её целиком. */
const chainTextEl2 = document.getElementById("chainText");
if (chainTextEl2) {
  chainTextEl2.addEventListener("click", (e) => {
    // Клик по НОМЕРУ найденного паттерна (режим "🌈 Все паттерны") — выделяем его строку в
    // таблице и подводим к глазам; саму строку результата при этом не сворачиваем/разворачиваем.
    const hitNum = e.target.closest && e.target.closest(".chain-hit-num");
    if (hitNum) {
      e.stopPropagation();
      const idx = +hitNum.dataset.patIdx;
      if (!isNaN(idx) && idx >= 0 && idx < st.rows.length) {
        st.selectedRows = new Set([idx]);
        st.captureGrown = false;
        st.manualShiftTurns = 0;
        render(); saveCache();
        scrollToRow(idx); // по номеру, а не по элементу — строки может не быть в DOM, см. scrollToRow
        say("Паттерн №" + (idx + 1) + ": выделена строка " + idx + ".");
      }
      return;
    }
    const line = e.target.closest(".chain-result-line");
    if (!line) return;
    const mode = line.dataset.mode;
    // Только НАСТОЯЩИЕ диагонали ("diagR#3"), а не фазы маски ("concatR#м2") — см. isDiagLine
    // в fold-2: у масочных строк своё действие, выбор показанной в цепочках находки (ниже).
    if (mode && (/#\d/.test(mode) || VERT_PICK_MODES.includes(mode))) {
      const picked = st.diagFoldPick === mode;
      st.diagFoldPick = picked ? null : mode;
      // Выбор диагонали сам включает подсветку — иначе клик по строке ничего бы не показал, пока
      // кнопка "⧅⧄" погашена. Выключается всё той же кнопкой.
      if (!picked && !st.highlightDiagFold) {
        st.highlightDiagFold = true;
        const hb = document.getElementById("bHighlightDiagFold");
        if (hb) hb.classList.add("mode-act");
      }
      // Выбор — чисто состояние этого окна (как bgResultExpanded), в кэш не сохраняется.
      if (picked) bgResultExpanded.delete(mode); else bgResultExpanded.add(mode);
      render();
      return;
    }
    /* КЛИК ПО СТРОКЕ РЕЗУЛЬТАТА ПЕРЕКЛЮЧАЕТ, ЧЬЯ НАХОДКА ПОКАЗАНА В ЦЕПОЧКАХ (v0.918, запрос
       пользователя). В строки кладётся находка ровно одного режима (см. st.bgHitPick в render) —
       кликом выбираем, какого именно. Повторный клик по уже выбранному снимает выбор: тогда снова
       показывается первый совпавший по порядку режимов.
       Разворачивание строки при этом осталось на своём месте — это то же нажатие, просто у него
       теперь два действия сразу: показать эту находку в цепочках и развернуть саму строку. */
    st.bgHitPick = (st.bgHitPick === mode) ? null : mode;
    if (bgResultExpanded.has(mode)) bgResultExpanded.delete(mode);
    else bgResultExpanded.add(mode);
    render();
  });
}

/* Стек overlay-баров (#chainResultBox/#stepLogBox) — раскладка и драг-обмен местами реализованы
   ниже, после loadLayout() (см. МАРКЕР 10.2b OVERLAY_STACK), т.к. используют overlayOrder,
   объявленную рядом с LAYOUT_KEY. */

/* === ГЕОМЕТРИЯ ОТДЕЛЬНЫХ ОКОН (запрос пользователя "запоминать расположение и ширину окон") ===
   Размер/положение каждого окна (🗗 Результат и 🗗 Панели), а заодно и координаты самих панелей
   внутри окна панелей, лежат в localStorage отдельным ключом — раскладка цепочек (LAYOUT_KEY) и
   настройки вида (CACHE_KEY) тут ни при чём. События "окно передвинули" в браузере нет, поэтому
   геометрию просто опрашиваем раз в секунду, пока окно открыто, и пишем только когда она реально
   изменилась; плюс снимок на resize и при закрытии. */
const WINPOS_KEY = "zerk_fold_winpos";
let winPos = {};
try { winPos = JSON.parse(localStorage.getItem(WINPOS_KEY)) || {}; } catch (e) { winPos = {}; }
function saveWinPos(){ try { localStorage.setItem(WINPOS_KEY, JSON.stringify(winPos)); } catch (e) {} }
/* Строка features для window.open — с прошлыми размерами/координатами, если они есть. */
function winFeatures(key, defW, defH){
  const p = winPos[key] || {};
  const parts = ["scrollbars=yes", "resizable=yes",
    "width=" + Math.max(200, p.w || defW), "height=" + Math.max(200, p.h || defH)];
  if (typeof p.x === "number") parts.push("left=" + Math.max(0, Math.round(p.x)));
  if (typeof p.y === "number") parts.push("top=" + Math.max(0, Math.round(p.y)));
  return parts.join(",");
}
/* Следим за геометрией окна w и (для окна панелей) за координатами панелей внутри него. */
function trackWindowGeometry(key, w, extraSnapshot){
  const snap = () => {
    if (!w || w.closed) return false;
    const cur = { x: w.screenX, y: w.screenY, w: w.outerWidth, h: w.outerHeight };
    const before = JSON.stringify(winPos[key] || null);
    winPos[key] = cur;
    if (extraSnapshot) extraSnapshot();
    return JSON.stringify(cur) !== before;
  };
  const timer = setInterval(() => {
    if (!w || w.closed) { clearInterval(timer); return; }
    if (snap()) saveWinPos();
  }, 1000);
  try {
    w.addEventListener("resize", () => { snap(); saveWinPos(); });
    w.addEventListener("pagehide", () => { snap(); saveWinPos(); });
  } catch (e) {}
}

/* === ВСЕ ВКЛАДКИ В ОТДЕЛЬНОМ ОКНЕ (кнопка "🗗 Панели в окно" в верхнем меню) ===
   Панели ПЕРЕЕЗЖАЮТ в другое окно живыми узлами (document.adoptNode), а не копиями: все
   обработчики висят на самих узлах и продолжают работать, а код основного окна находит элементы
   благодаря патчу поиска по DOM в начале скрипта. В окне каждая панель — свободно перемещаемый
   бокс: тянуть за ту же ручку ⋮⋮. Откуда пришла каждая панель, помним в panelsHome, чтобы
   вернуть на место кнопкой "Вернуть в основное окно" или при закрытии окна.
   var (не let) — на этот флаг смотрит патч поиска, объявленный ВЫШЕ по файлу. */
var panelsPopupWin = null;
const panelsHome = new Map(); // wrapper -> { parent, next, floating, left, top }
function panelsPopupAlive(){ return !!(panelsPopupWin && !panelsPopupWin.closed); }

/* Курсор (ЭКРАННЫЕ координаты) внутри рамки окна w? Так определяется, куда именно отпустили
   панель при перетаскивании между окнами — client-координаты тут не годятся, они у каждого окна
   свои. */
function pointInWindowRect(w, sx, sy){
  try {
    return sx >= w.screenX && sx <= w.screenX + w.outerWidth &&
           sy >= w.screenY && sy <= w.screenY + w.outerHeight;
  } catch (e) { return false; }
}
/* Экранная точка → координаты внутри содержимого окна w. Горизонтальные рамки считаем
   одинаковыми слева/справа, всю остальную "обвязку" (адресная строка и т.п.) — сверху: для выбора
   дока/места этой точности с запасом хватает. */
function screenToClientOf(w, sx, sy){
  const bw = Math.max(0, w.outerWidth - w.innerWidth);
  const bh = Math.max(0, w.outerHeight - w.innerHeight);
  return { x: sx - w.screenX - bw / 2, y: sy - w.screenY - (bh - bw / 2) };
}
/* Панель из окна панелей — обратно в ОСНОВНОЕ окно, в тот док (или на холст), над которым
   отпустили мышь. */
function sendPanelToMain(wrap, sx, sy){
  const c = screenToClientOf(window, sx, sy);
  try { document.adoptNode(wrap); } catch (e) {}
  wrap.style.position = ""; wrap.style.margin = ""; wrap.style.zIndex = "";
  delete wrap.dataset.hostLeft; delete wrap.dataset.hostTop;
  const mid = wrap.id.replace("panelWrap_", "");
  const pid = pidUnderCursor(c.x, c.y, true);
  if (pid) {
    wrap.classList.remove("floating-panel"); wrap.style.left = ""; wrap.style.top = "";
    document.getElementById(SLOT_OF[pid]).appendChild(wrap);
    if (MENUS[mid]) {
      MENUS[mid].zone = SLOT_OF[pid]; MENUS[mid].pin = true;
      const cb = document.getElementById(mid + "Pin"); if (cb) cb.checked = true;
    }
  } else {
    wrap.classList.add("floating-panel"); document.body.appendChild(wrap);
    wrap.style.left = Math.max(0, Math.min(window.innerWidth - 60, c.x)) + "px";
    wrap.style.top = Math.max(0, Math.min(window.innerHeight - 40, c.y)) + "px";
    if (MENUS[mid]) MENUS[mid].zone = "canvas";
  }
  panelsHome.delete(wrap); // она уже дома — при закрытии окна возвращать нечего
  updateDockVisibility(); updateToggleAllPinsBtn(); saveLayout(); render();
  try { window.focus(); } catch (e) {}
}
/* ...и наоборот: панель из основного окна — в окно панелей, на то место, где отпустили мышь. */
function sendPanelToPopup(wrap, sx, sy){
  if (!panelsPopupAlive()) return false;
  const doc = panelsPopupWin.document;
  const host = doc.getElementById("panelsHost");
  if (!host) return false;
  if (!panelsHome.has(wrap)) {
    panelsHome.set(wrap, {
      parent: wrap.parentNode, next: wrap.nextSibling,
      floating: wrap.classList.contains("floating-panel"),
      left: wrap.style.left, top: wrap.style.top
    });
  }
  wrap.classList.remove("floating-panel", "dragging");
  try { doc.adoptNode(wrap); } catch (e) {}
  host.appendChild(wrap);
  const c = screenToClientOf(panelsPopupWin, sx, sy);
  const hostRect = host.getBoundingClientRect();
  wrap.style.position = "absolute";
  wrap.style.margin = "0";
  wrap.style.left = Math.max(0, c.x - hostRect.left) + "px";
  wrap.style.top = Math.max(0, c.y - hostRect.top) + "px";
  wrap.style.zIndex = String(++panelsPopupTopZ);
  updateDockVisibility(); saveLayout(); render();
  try { panelsPopupWin.focus(); } catch (e) {}
  return true;
}
/* Панель сейчас живёт в окне панелей? Тогда кнопки вкладок не должны её никуда утаскивать. */
function panelInPopup(mid){
  const m = MENUS[mid];
  return !!(m && m.wrapper && panelsPopupAlive() && panelsHome.has(m.wrapper));
}
function focusPanelInPopup(mid){
  const m = MENUS[mid];
  if (!m || !panelsPopupAlive()) return;
  try {
    panelsPopupWin.focus();
    m.wrapper.style.zIndex = String(++panelsPopupTopZ);
    m.wrapper.scrollIntoView({ block: "nearest" });
  } catch (e) {}
}

/* ПРИМАГНИЧИВАНИЕ панелей в окне (запрос пользователя: "пусть не накладываются друг на друга, а
   примагничиваются ровно сверху/снизу и сбоку"). Кандидатное положение (x,y) — в координатах
   #panelsHost; проверяем расстояние до каждой ЧУЖОЙ панели и до краёв хоста, и если ближе
   PANEL_SNAP px — подтягиваем ровно встык. Отдельно по X и по Y: липнет и "боком к боку", и
   "сверху/снизу", и выравнивается по общей кромке (левые края в линию и т.п.). */
const PANEL_SNAP = 14;
function snapPanelPos(doc, panel, x, y){
  const host = doc.getElementById("panelsHost");
  if (!host) return { x, y };
  const hr = host.getBoundingClientRect();
  const w = panel.offsetWidth, h = panel.offsetHeight;
  let bestX = null, bestY = null, dX = PANEL_SNAP + 1, dY = PANEL_SNAP + 1;
  const tryX = (cand) => { const d = Math.abs(cand - x); if (d < dX) { dX = d; bestX = cand; } };
  const tryY = (cand) => { const d = Math.abs(cand - y); if (d < dY) { dY = d; bestY = cand; } };
  tryX(0); tryY(0); // края самого хоста
  Array.from(host.children).forEach(other => {
    if (other === panel || !other.classList || !other.classList.contains("menu-panel")) return;
    const r = other.getBoundingClientRect();
    const ox = r.left - hr.left, oy = r.top - hr.top, ow = r.width, oh = r.height;
    // Встык сбоку: наш правый край к их левому и наоборот; плюс выравнивание левых/правых кромок.
    tryX(ox + ow); tryX(ox - w); tryX(ox); tryX(ox + ow - w);
    // Встык сверху/снизу: наш низ к их верху и наоборот; плюс выравнивание верх/низ кромок.
    tryY(oy + oh); tryY(oy - h); tryY(oy); tryY(oy + oh - h);
  });
  return { x: Math.max(0, bestX != null ? bestX : x), y: Math.max(0, bestY != null ? bestY : y) };
}

/* Перетаскивание панели внутри окна — своё, простое: абсолютные координаты внутри хоста.
   Родной makeDraggable() тут не годится — он таскает между доками ОСНОВНОГО окна (ищет
   #leftPanel/#rightPanel по координатам мыши, которых в этом окне попросту нет), поэтому его
   mousedown мы гасим на фазе перехвата. */
function attachPanelsPopupDrag(win){
  const doc = win.document;
  let dragEl = null, offX = 0, offY = 0;
  // Тянуть можно за ВСЮ шапку панели (не только за ⋮⋮) — так привычнее и промахнуться нельзя.
  // Слушатели — на фазе ПЕРЕХВАТА и на самом окне: родной обработчик ⋮⋮ (makeDraggable) остался
  // висеть на узле после переезда и таскал бы панель по докам ОСНОВНОГО окна, которых тут нет —
  // гасим его stopPropagation'ом и на всякий случай обнуляем его состояние (draggedEl).
  const onDown = e => {
    if (e.button !== 0 || !e.target || !e.target.closest) return;
    if (e.target.closest(".panel-close")) return; // ✕ — не драг
    const head = e.target.closest(".panel-head");
    const panel = head && head.closest(".menu-panel");
    if (!panel || !panel.parentNode || panel.parentNode.id !== "panelsHost") return;
    e.preventDefault();
    e.stopPropagation();
    draggedEl = null; // сброс состояния родного междокового драга основного окна
    const hostRect = doc.getElementById("panelsHost").getBoundingClientRect();
    const r = panel.getBoundingClientRect();
    offX = e.clientX - r.left; offY = e.clientY - r.top;
    panel.style.position = "absolute";
    panel.style.zIndex = String(++panelsPopupTopZ);
    panel.dataset.hostLeft = String(hostRect.left);
    panel.dataset.hostTop = String(hostRect.top);
    dragEl = panel;
    doc.body.style.cursor = "grabbing";
  };
  const onMove = e => {
    if (!dragEl) return;
    e.preventDefault();
    // Координаты — относительно #panelsHost (он position:relative), поэтому вычитаем его угол.
    const hl = parseFloat(dragEl.dataset.hostLeft) || 0;
    const ht = parseFloat(dragEl.dataset.hostTop) || 0;
    let x = Math.max(0, e.clientX - offX - hl);
    let y = Math.max(0, e.clientY - offY - ht);
    const snapped = snapPanelPos(doc, dragEl, x, y);
    dragEl.style.left = snapped.x + "px";
    dragEl.style.top = snapped.y + "px";
  };
  const onUp = e => {
    if (!dragEl) return;
    const panel = dragEl;
    dragEl = null;
    doc.body.style.cursor = "";
    // ОТПУСТИЛИ НАД ОСНОВНЫМ ОКНОМ — панель переезжает туда (запрос пользователя "пусть
    // перетаскиваются с окна в окно"). Пока кнопка мыши зажата, события продолжают приходить
    // ЭТОМУ документу даже поверх чужого окна, поэтому экранные координаты курсора известны.
    if (e && !pointInWindowRect(win, e.screenX, e.screenY) && pointInWindowRect(window, e.screenX, e.screenY)) {
      sendPanelToMain(panel, e.screenX, e.screenY);
    }
  };
  doc.addEventListener("mousedown", onDown, true);
  win.addEventListener("mousemove", onMove, true);
  win.addEventListener("mouseup", onUp, true);
  win.addEventListener("blur", onUp);
}
let panelsPopupTopZ = 10;

function returnPanelsHome(){
  panelsHome.forEach((home, wrap) => {
    try {
      document.adoptNode(wrap);
      wrap.style.position = ""; wrap.style.left = home.left; wrap.style.top = home.top;
      wrap.style.width = ""; wrap.style.zIndex = ""; wrap.style.margin = "";
      delete wrap.dataset.hostLeft; delete wrap.dataset.hostTop;
      wrap.classList.toggle("floating-panel", !!home.floating);
      if (home.parent && home.parent.isConnected) {
        if (home.next && home.next.parentNode === home.parent) home.parent.insertBefore(wrap, home.next);
        else home.parent.appendChild(wrap);
      } else {
        document.getElementById("leftSlot").appendChild(wrap);
      }
    } catch (err) {}
  });
  panelsHome.clear();
  saveLayout();
  render();
}

function closePanelsPopup(){
  if (panelsPopupAlive()) { const w = panelsPopupWin; panelsPopupWin = null; returnPanelsHome(); w.close(); }
  else { panelsPopupWin = null; returnPanelsHome(); }
}

function openPanelsPopup(){
  if (panelsPopupAlive()) { panelsPopupWin.focus(); return; }
  const win = window.open("", "zerkaliusPanels", winFeatures("panels", 560, 920));
  if (!win) { say("Браузер заблокировал окно — разрешите всплывающие окна для этой страницы."); return; }
  const styles = Array.from(document.querySelectorAll("style")).map(s => s.innerHTML).join("\n");
  const doc = win.document;
  doc.open();
  doc.write('<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>Панели — Zerkalius Fold</title>' +
    '<style>' + styles + '</style>' +
    '<style>' +
      /* Тот же сброс, что и в окне результата: скопированные стили основной страницы делают body
         flex-колонкой с height:100vh/overflow:hidden — панели ниже сгиба окна становились
         недостижимы. */
      'html,body{background:var(--bg,#0b0e14);color:var(--fg,#dfe6f2);margin:0;padding:0;' +
        'font:12px/1.3 system-ui,sans-serif;width:100%;height:auto;min-height:100%;' +
        'max-height:none;overflow:visible;display:block}' +
      '#panelsBar{position:sticky;top:0;z-index:9999;display:flex;gap:8px;align-items:center;' +
        'padding:5px 8px;background:var(--panel,#11151c);border-bottom:1px solid var(--line,#232a36);' +
        'font-size:11px;color:var(--dim,#8b93a3)}' +
      '#panelsBar button{background:#1a2130;color:var(--fg,#dfe6f2);border:1px solid var(--line,#232a36);' +
        'border-radius:3px;padding:3px 8px;cursor:pointer;font:11px/1.2 system-ui,sans-serif}' +
      '#panelsBar button:hover{border-color:var(--acc,#4da3ff);color:var(--acc,#4da3ff)}' +
      '#panelsHost{position:relative;min-height:2000px;padding:8px}' +
      /* Панель в этом окне — свободно перемещаемый бокс со своей позицией, но ШИРИНА та же, что
         у бокового дока в основном окне (--side-w), а не отдельные 330px: панель, вынесенная в
         окно, должна выглядеть ровно так же, как в доке (запрос пользователя). Значение
         --side-w в это окно проставляется инлайном сразу после doc.close() — из копии стилей
         оно пришло бы дефолтным, без правки пользователя и мимо media-query узкого окна. */
      '#panelsHost .menu-panel{position:absolute;width:var(--side-w,300px);background:var(--panel,#11151c);' +
        'border:1px solid var(--line,#232a36);border-radius:5px;padding:4px 6px 6px;' +
        'box-shadow:0 6px 18px rgba(0,0,0,.5)}' +
      /* Длинные подписи кнопок (напр. "🔍 По подсветке") по глобальному правилу
         button{white-space:nowrap} не переносятся и ВЫЛЕЗАЛИ за правый край панели — в доке это
         было незаметно, а тут панель стоит на пустом фоне (запрос пользователя "вылезает кнопка
         в Окне"). Внутри панели разрешаем перенос и разрешаем блокам сжиматься (min-width:0 —
         без него flex/grid-элемент не сужается меньше своего содержимого). */
      '#panelsHost .menu-panel{overflow:hidden}' +
      '#panelsHost .menu-panel button, #panelsHost .menu-panel label.chk{white-space:normal;min-width:0}' +
      '#panelsHost .menu-panel .panel-head{cursor:grab;position:static}' +
      '#panelsHost .menu-panel .panel-head:active{cursor:grabbing}' +
    '</style></head><body>' +
    '<div id="panelsBar"><button id="panelsBack">↩ Вернуть в основное окно</button>' +
    '<span>Тяни панель за ЗАГОЛОВОК: панели примагничиваются друг к другу встык. Перетащи на основное окно — вернётся туда. Закрытие окна вернёт все назад.</span></div>' +
    '<div id="panelsHost"></div></body></html>');
  doc.close();
  panelsPopupWin = win;
  // Ширина панелей в окне = ширина бокового дока. Читаем ВЫЧИСЛЕННОЕ значение основного окна и
  // кладём инлайном на :root окна панелей — инлайн перебивает и копию :root из стилей, и
  // media-query "узкий экран" (у окна панелей своя ширина, и она обычно как раз узкая).
  try {
    const sideW = getComputedStyle(document.documentElement).getPropertyValue("--side-w").trim();
    if (sideW) doc.documentElement.style.setProperty("--side-w", sideW);
  } catch (e) {}

  // Драг вешаем ДО переезда панелей: если что-то в цикле ниже споткнётся, окно всё равно
  // останется управляемым.
  attachPanelsPopupDrag(win);
  const host = doc.getElementById("panelsHost");
  let x = 10, y = 10;
  for (const mid in MENUS) {
    const wrap = MENUS[mid].wrapper;
    if (!wrap) continue;
    panelsHome.set(wrap, {
      parent: wrap.parentNode,
      next: wrap.nextSibling,
      floating: wrap.classList.contains("floating-panel"),
      left: wrap.style.left, top: wrap.style.top
    });
    wrap.classList.remove("floating-panel");
    try { doc.adoptNode(wrap); } catch (err) {}
    host.appendChild(wrap);
    // Позицию задаём ИНЛАЙНОМ (а не только классом в CSS окна) — так панель заведомо
    // абсолютная и её можно двигать, что бы ни прилетело из скопированных стилей.
    wrap.style.position = "absolute";
    wrap.style.margin = "0";
    // Место панели в окне — из прошлого сеанса, если оно там сохранилось (см. winPos.panelSpots);
    // иначе раскладываем ВСТЫК по реальной высоте каждой панели: они сразу стоят плотно и не
    // налезают друг на друга; кончилась высота окна — следующая колонка правее.
    const spot = (winPos.panelSpots || {})[wrap.id];
    if (spot && typeof spot.x === "number" && typeof spot.y === "number") {
      wrap.style.left = Math.max(0, spot.x) + "px";
      wrap.style.top = Math.max(0, spot.y) + "px";
      continue;
    }
    wrap.style.left = x + "px";
    wrap.style.top = y + "px";
    const ph = wrap.offsetHeight || 260, pw = wrap.offsetWidth || 330;
    y += ph + 4;
    if (y > Math.max(420, win.innerHeight - 120)) { y = 10; x += pw + 6; }
  }
  const backBtn = doc.getElementById("panelsBack");
  if (backBtn) backBtn.onclick = () => closePanelsPopup();
  // Геометрия окна + места самих панелей внутри него запоминаются между сеансами.
  trackWindowGeometry("panels", win, () => {
    if (!panelsPopupAlive()) return;
    const spots = winPos.panelSpots || (winPos.panelSpots = {});
    const h = panelsPopupWin.document.getElementById("panelsHost");
    if (!h) return;
    Array.from(h.children).forEach(el => {
      if (!el.id || !el.classList || !el.classList.contains("menu-panel")) return;
      spots[el.id] = { x: parseInt(el.style.left, 10) || 0, y: parseInt(el.style.top, 10) || 0 };
    });
  });
  // Закрыли окно крестиком — панели не должны потеряться: возвращаем их домой. pagehide ловит
  // и закрытие, и перезагрузку; на всякий случай дублируем опросом (некоторые браузеры не шлют
  // событие закрытому окну вовремя).
  win.addEventListener("pagehide", () => { panelsPopupWin = null; returnPanelsHome(); });
  const watch = setInterval(() => {
    if (!win.closed) return;
    clearInterval(watch);
    if (panelsHome.size) { panelsPopupWin = null; returnPanelsHome(); }
  }, 700);
  render();
}
const bPanelsPopoutEl = document.getElementById("bPanelsPopout");
if (bPanelsPopoutEl) bPanelsPopoutEl.onclick = () => { panelsPopupAlive() ? closePanelsPopup() : openPanelsPopup(); };
// Закрыли/перезагрузили основную страницу — окно панелей без неё бессмысленно (и живые узлы в
// нём всё равно умрут вместе с исходным документом).
window.addEventListener("pagehide", () => { if (panelsPopupAlive()) panelsPopupWin.close(); });

/* === ОТДЕЛЬНОЕ ОКНО ВКЛАДКИ «МАСКИ» (кнопка 🗗 в самой вкладке, v0.937) ===
   Запрос пользователя: "сделай возможность в отдельном окне Маски, и там всё нормально показать".
   Кнопка "🗗 Панели в окно" в верхнем меню уносит СРАЗУ ВСЕ вкладки — а тут нужна одна: в доке
   ей 260px, и поле списка масок с находками в такой ширине не читается.
   Механика та же, что у окна панелей: узел #maskGroup переезжает в новое окно ЖИВЫМ (adoptNode),
   поэтому все обработчики, значения полей и подсветка продолжают работать без единой строчки
   синхронизации. Отличия только в оформлении: панель тянется на всю ширину окна, textarea
   списка выше, плашки находок переносятся по строкам.
   На месте вкладки в основном окне остаётся заглушка со ссылкой обратно — иначе вкладка
   выглядела бы просто пропавшей. */
let maskPopupWin = null, maskPopupHome = null;
function maskPopupAlive(){ return !!(maskPopupWin && !maskPopupWin.closed); }
function returnMaskHome(){
  const home = maskPopupHome;
  maskPopupHome = null;
  if (!home) return;
  try {
    const ph = document.getElementById("maskPopoutStub");
    if (ph) ph.remove();
    document.adoptNode(home.el);
    home.el.style.width = ""; home.el.style.maxWidth = "";
    if (home.parent && home.parent.isConnected) {
      if (home.next && home.next.parentNode === home.parent) home.parent.insertBefore(home.el, home.next);
      else home.parent.appendChild(home.el);
    } else {
      const slot = document.getElementById("leftSlot");
      if (slot) slot.appendChild(home.el);
    }
  } catch (err) {}
  render();
}
function closeMaskPopup(){
  if (maskPopupAlive()) { const w = maskPopupWin; maskPopupWin = null; returnMaskHome(); w.close(); }
  else { maskPopupWin = null; returnMaskHome(); }
}
function openMaskPopup(){
  if (maskPopupAlive()) { maskPopupWin.focus(); return; }
  const el = document.getElementById("maskGroup");
  if (!el) return;
  const win = window.open("", "zerkaliusMask", winFeatures("mask", 620, 900));
  if (!win) { say("Браузер заблокировал окно — разрешите всплывающие окна для этой страницы."); return; }
  const styles = Array.from(document.querySelectorAll("style")).map(s => s.innerHTML).join("\n");
  const doc = win.document;
  doc.open();
  doc.write('<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>Маски — Zerkalius Fold</title>' +
    '<style>' + styles + '</style>' +
    '<style>' +
      // Тот же сброс, что и у окна панелей: копия стилей основной страницы делает body flex-колонкой
      // высотой в экран с overflow:hidden, и всё ниже сгиба становится недостижимым.
      'html,body{background:var(--bg,#0b0e14);color:var(--fg,#dfe6f2);margin:0;padding:0;' +
        'font:12px/1.3 system-ui,sans-serif;width:100%;height:auto;min-height:100%;' +
        'max-height:none;overflow:auto;display:block}' +
      '#maskBar{position:sticky;top:0;z-index:9999;display:flex;gap:8px;align-items:center;' +
        'padding:5px 8px;background:var(--panel,#11151c);border-bottom:1px solid var(--line,#232a36);' +
        'font-size:11px;color:var(--dim,#8b93a3)}' +
      '#maskBar button{background:#1a2130;color:var(--fg,#dfe6f2);border:1px solid var(--line,#232a36);' +
        'border-radius:3px;padding:3px 8px;cursor:pointer;font:11px/1.2 system-ui,sans-serif}' +
      '#maskHost{padding:8px}' +
      // ШИРИНА — по окну, а не 260px дока: ради неё окно и открывали. Кнопкам разрешаем перенос
      // подписи (в доке они nowrap и тут вылезали бы), полю списка — расти вместе с окном.
      '#maskHost .control-group{width:auto;max-width:none;box-sizing:border-box}' +
      '#maskHost button, #maskHost label.chk{white-space:normal;min-width:0}' +
      '#maskHost #bgMaskScanList{min-height:160px}' +
      // Плашки находок в доке жались в узкую колонку — тут раскладываем по всей ширине.
      '#maskHost #bgMaskScanOut{flex-wrap:wrap;gap:3px}' +
    '</style></head><body>' +
    '<div id="maskBar"><button id="maskBack">↩ Вернуть в основное окно</button>' +
    '<span>Вкладка «Маски» работает здесь живьём — поля, перебор и подсветка те же самые. Закрытие окна вернёт её на место.</span></div>' +
    '<div id="maskHost"></div></body></html>');
  doc.close();
  maskPopupWin = win;
  maskPopupHome = { el, parent: el.parentNode, next: el.nextSibling };
  // Заглушка на месте вкладки — чтобы «Маски» не выглядели пропавшими.
  try {
    const stub = document.createElement("div");
    stub.id = "maskPopoutStub";
    stub.style.cssText = "padding:8px;font-size:11px;color:var(--dim);text-align:center;";
    stub.textContent = "🗗 Вкладка «Маски» открыта в отдельном окне.";
    if (maskPopupHome.parent) maskPopupHome.parent.insertBefore(stub, maskPopupHome.next || null);
  } catch (err) {}
  try { doc.adoptNode(el); } catch (err) {}
  doc.getElementById("maskHost").appendChild(el);
  const backBtn = doc.getElementById("maskBack");
  if (backBtn) backBtn.onclick = () => closeMaskPopup();
  trackWindowGeometry("mask", win);
  win.addEventListener("pagehide", () => { maskPopupWin = null; returnMaskHome(); });
  // Дубль опросом: закрытому окну событие приходит не во всех браузерах вовремя, а потерять
  // живой узел панели нельзя — он единственный.
  const watch = setInterval(() => {
    if (!win.closed) return;
    clearInterval(watch);
    if (maskPopupHome) { maskPopupWin = null; returnMaskHome(); }
  }, 700);
  render();
}
const bMaskPopoutEl = document.getElementById("bMaskPopout");
if (bMaskPopoutEl) bMaskPopoutEl.onclick = () => { maskPopupAlive() ? closeMaskPopup() : openMaskPopup(); };
window.addEventListener("pagehide", () => { if (maskPopupAlive()) maskPopupWin.close(); });

/* === ОТДЕЛЬНОЕ ОКНО РЕЗУЛЬТАТА (кнопка 🗗 в шапке панели) ===
   Зачем: в самой панели строки результата обрезаны — и по ширине (одна линия), и по числу
   нарисованных символов (renderCap, иначе десятки тысяч span'ов на каждый render вешают
   интерфейс). В отдельном окне ни того, ни другого не нужно: строки переносятся по ширине окна и
   рисуются целиком, поэтому видно КАЖДОЕ вхождение паттерна (запрос пользователя).
   Содержимое обновляется тем же render(), что и панель, — окно всегда живое, а не снимок.
   POPUP_RENDER_CAP — предохранитель на совсем безумные длины (кольцо ×4 от сквозной по сотне
   строк), чтобы окно не подвесило вкладку насмерть. */
const POPUP_RENDER_CAP = 200000;
// Размер шрифта в окне — свой, НЕ от таблицы: шрифт цепочки (--chain-fs) обычно крупный и с
// отрицательным letter-spacing (символы нарочно наезжают друг на друга), из-за чего в окне текст
// сливался в кашу. По умолчанию мельче панели, меняется кнопками −/+ прямо в окне (запрос
// пользователя), значение живёт в настройках вида.
let popupFontPx = 10;
let resultPopupWin = null;
/* ОФОРМЛЕНИЕ ОКНА РЕЗУЛЬТАТА — своё, отдельное от панели (запрос пользователя: "в отдельном окне
   результатов нужна большая настройка: цвет шрифта, сам шрифт, отступы между строк до 0.2
   ползунком, цвет фона, 1-ц и 0-лей отдельно"). Всё живёт в шапке самого окна и персистится в
   кэше вместе с остальными настройками вида.
     ff    — семейство шрифта (пусто = моноширинный по умолчанию, как было);
     fg/bg — цвет текста и фона окна (пусто = как в теме, var(--fg)/var(--cbg));
     lh    — межстрочный интервал, ползунок от 0.2 до 2 (1 = как было);
     bits  — красить «1» и «0» РАЗНЫМИ цветами (см. colorizePopupBits): по умолчанию выключено,
             потому что для этого приходится оборачивать биты в свои span'ы, а строки бывают
             длиной в сотни тысяч символов;
     one/zero — сами эти цвета. */
const POPUP_FONTS = [
  ["", "Моно (как в панели)"],
  ["Consolas, monospace", "Consolas"],
  ["'Courier New', monospace", "Courier New"],
  ["'Cascadia Mono', 'Fira Code', monospace", "Cascadia / Fira"],
  ["system-ui, sans-serif", "Системный"],
  ["Arial, Helvetica, sans-serif", "Arial"],
  ["Georgia, serif", "Georgia"],
];
/*   bare  — «только биты»: прячет подписи режимов, галочки находок, номера паттернов, двоеточие,
             строку-заголовок и разделительные полоски — остаётся чистое поле из 1 и 0 (запрос
             пользователя: "без всяких полосок строк, чисто биты 1 и 0, пусть поле с надписями
             скрывается");
     flow  — «сплошняком»: строки результата идут не блоками, а подряд, поэтому у длинных строк не
             остаётся пустых хвостов справа (запрос пользователя: "перенос строк разный бы, чтобы
             не было всяких промежутков без битов, когда много строк и длинных");
     maskCut — как показывать "🎭 Маску": false — затемнять пропущенные биты, true — вырезать их
             совсем (прежний вид, оставлен вариантом);
     pulse/pulseSec — мерцание бит: «1» и «0» пульсируют с разной скоростью (когда включена
             раскраска 1/0 — каждый своей, иначе пульсирует строка целиком). */
const POPUP_STYLE_DEFAULTS = { ff: "", fg: "", bg: "", lh: 1, bits: false, one: "#ffe08a", zero: "#5a6a85",
  bare: false, flow: false, maskCut: false, pulse: false, pulseSec: 1.6 };
let popupStyle = Object.assign({}, POPUP_STYLE_DEFAULTS);
function resultPopupAlive(){ return !!(resultPopupWin && !resultPopupWin.closed); }
function applyPopupFont(){
  if (!resultPopupAlive()) return;
  const d = resultPopupWin.document;
  d.documentElement.style.setProperty("--pop-fs", popupFontPx + "px");
  const v = d.getElementById("popFontVal");
  if (v) v.textContent = popupFontPx;
}
function setPopupFont(px){
  popupFontPx = Math.max(6, Math.min(28, px));
  applyPopupFont();
  saveCache();
}
/* Разложить popupStyle по CSS-переменным окна. Пустая строка у цвета/шрифта = НЕ задавать
   переменную вовсе, тогда в CSS отработает запасное значение из var(...) — то есть тема основной
   страницы, как было до этой настройки. */
function applyPopupStyle(){
  if (!resultPopupAlive()) return;
  const d = resultPopupWin.document;
  const rootStyle = d.documentElement.style;
  const setVar = (name, val) => { if (val) rootStyle.setProperty(name, val); else rootStyle.removeProperty(name); };
  setVar("--pop-ff", popupStyle.ff);
  setVar("--pop-fg", popupStyle.fg);
  setVar("--pop-bg", popupStyle.bg);
  rootStyle.setProperty("--pop-lh", String(popupStyle.lh || 1));
  setVar("--pop-one", popupStyle.bits ? popupStyle.one : "");
  setVar("--pop-zero", popupStyle.bits ? popupStyle.zero : "");
  rootStyle.setProperty("--pop-pulse", (popupStyle.pulseSec || 1.6) + "s");
  const lhVal = d.getElementById("popLhVal");
  if (lhVal) lhVal.textContent = (popupStyle.lh || 1).toFixed(2);
  // Режимы показа — классами на самом контейнере (см. CSS окна): так они действуют и на уже
  // нарисованное содержимое, без перерисовки.
  const box = d.getElementById("popResult");
  if (box) {
    box.classList.toggle("bare", !!popupStyle.bare);
    box.classList.toggle("flow", !!popupStyle.flow);
    box.classList.toggle("pulse", !!popupStyle.pulse);
  }
}
/* Раскраска «1»/«0» разными цветами. Биты в разметке результата — обычный ТЕКСТ (свои span'ы есть
   только у витков кольца и находок), поэтому красить их можно лишь обернув. Оборачиваем не каждый
   символ, а ПРОБЕГИ одинаковых (тот же приём, что в render() основной страницы), иначе на длинной
   строке получаются сотни тысяч узлов. Совсем огромное содержимое не трогаем вовсе — лучше без
   цвета, чем повесить окно. */
const POPUP_COLORIZE_CAP = 120000;
function colorizePopupBits(box, doc){
  if (!popupStyle.bits) return;
  if ((box.textContent || "").length > POPUP_COLORIZE_CAP) return;
  const lines = box.querySelectorAll(".chain-result-line-bits");
  for (const el of lines) {
    const walker = doc.createTreeWalker(el, 4 /* SHOW_TEXT */);
    const texts = [];
    let node;
    while ((node = walker.nextNode())) texts.push(node);
    for (const t of texts) {
      const s = t.nodeValue || "";
      if (!/[01]/.test(s)) continue;
      const frag = doc.createDocumentFragment();
      let i = 0;
      while (i < s.length) {
        const c = s[i];
        let j = i;
        if (c === "0" || c === "1") {
          while (j < s.length && s[j] === c) j++;
          const sp = doc.createElement("span");
          sp.className = c === "1" ? "pop1" : "pop0";
          sp.textContent = s.slice(i, j);
          frag.appendChild(sp);
        } else {
          while (j < s.length && s[j] !== "0" && s[j] !== "1") j++;
          frag.appendChild(doc.createTextNode(s.slice(i, j)));
        }
        i = j;
      }
      t.parentNode.replaceChild(frag, t);
    }
  }
}
function openResultPopup(){
  if (resultPopupAlive()) { resultPopupWin.focus(); render(); return; }
  resultPopupWin = window.open("", "zerkaliusResult", winFeatures("result", 1200, 760));
  if (!resultPopupWin) { say("Браузер заблокировал окно — разрешите всплывающие окна для этой страницы."); return; }
  // Стили копируем ЦЕЛИКОМ из основного документа (там же и :root-переменные с цветами) — так
  // подсветка находок, витков кольца и цвета паттернов выглядят в окне ровно как в панели.
  // ВАЖНО: содержимое кладём в .chain-result-text — тот же контейнер, что и в панели (свой
  // моноширинный шрифт и letter-spacing:normal). Без него разметка наследовала шрифт ТАБЛИЦЫ с
  // отрицательным межбуквенным интервалом, и подписи наезжали на биты.
  const styles = Array.from(document.querySelectorAll("style")).map(s => s.innerHTML).join("\n");
  const doc = resultPopupWin.document;
  doc.open();
  doc.write('<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>Результат — Zerkalius Fold</title>' +
    '<style>' + styles + '</style>' +
    '<style>' +
      /* Полос прокрутки в окне НЕ рисуем (запрос пользователя "убери скрол"): содержимое занимает
         всё окно по ширине и высоте, а прокрутка колёсиком/тачем работает как обычно — тот же
         приём, что и у холста в основном окне. */
      'html{scrollbar-width:none}' +
      'html::-webkit-scrollbar, body::-webkit-scrollbar{width:0;height:0;background:transparent}' +
      /* ВАЖНО: стили основной страницы копируются сюда целиком, а там body — flex-колонка с
         height:100vh и overflow:hidden. В окне из-за этого содержимое обрезалось по высоте и
         занимало лишь часть ширины. Сбрасываем в обычный блок с авто-высотой — строки идут во всю
         ширину окна, а лишнее просто прокручивается (полосы не рисуются, см. выше). */
      'html,body{background:var(--pop-bg,var(--cbg,#05070c));color:var(--pop-fg,var(--fg,#dfe6f2));margin:0;padding:0;' +
        'width:100%;height:auto;min-height:100%;max-height:none;overflow:visible;display:block}' +
      '#popBar{position:sticky;top:0;z-index:5;display:flex;gap:6px;align-items:center;padding:4px 8px;' +
        'background:var(--panel,#11151c);border-bottom:1px solid var(--line,#232a36);' +
        'font:11px/1.2 system-ui,sans-serif;color:var(--dim,#8b93a3)}' +
      '#popBar button{background:#1a2130;color:var(--fg,#dfe6f2);border:1px solid var(--line,#232a36);' +
        'border-radius:3px;min-width:22px;height:20px;cursor:pointer;font:12px/1 system-ui,sans-serif}' +
      '#popBar button:hover{border-color:var(--acc,#4da3ff);color:var(--acc,#4da3ff)}' +
      /* Выделение мышью отключено и здесь — как во всём интерфейсе (запрос пользователя):
         протяжка по длинным строкам бит заливала пол-окна синим. Копировать — кнопкой
         "📋 Копировать" в шапке панели «Результат». */
      /* Класс .chain-result-text тащит из основной страницы свою высоту/прокрутку (в панели она
         фиксируется кнопкой 📌), из-за чего содержимое в окне жалось в коробочку со своим
         скроллом вместо того, чтобы занять окно целиком — сбрасываем всё это (запрос
         пользователя "Результата окно браузера на всю длину"). */
      /* Шрифт/цвет/межстрочный — из настроек окна (см. applyPopupStyle). Переменная не задана —
         работает запасное значение, то есть ровно прежний вид. */
      '#popResult{padding:6px 8px;font-size:var(--pop-fs,10px);letter-spacing:normal;' +
        'font-family:var(--pop-ff, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);' +
        'color:var(--pop-fg,var(--fg,#dfe6f2));' +
        'user-select:none;-webkit-user-select:none;box-sizing:border-box;width:100%;' +
        'height:auto !important;max-height:none !important;min-height:calc(100vh - 30px);' +
        'overflow:visible !important;background:none;border:none;resize:none}' +
      /* Главное отличие от панели: НИКАКОЙ обрезки — строки переносятся и видны целиком. */
      '#popResult .chain-result-line{white-space:normal !important;overflow:visible !important;' +
        'cursor:default;line-height:var(--pop-lh,1);align-items:flex-start;margin:0;padding:0 3px;' +
        'border-bottom:1px solid var(--line,#232a36)}' +
      /* Цвета «1» и «0» — только когда включена галка (иначе переменные не заданы и биты берут
         обычный цвет текста), см. colorizePopupBits. */
      '#popResult .pop1{color:var(--pop-one,inherit)}' +
      '#popResult .pop0{color:var(--pop-zero,inherit)}' +
      /* "Только биты" — прочь всё, кроме самих бит: подписи режимов, галочки находок, номера
         паттернов, двоеточие, заголовок и полоски-разделители строк. */
      '#popResult.bare .chain-result-line-label,#popResult.bare .chain-result-line-check,' +
        '#popResult.bare .chain-result-line-hits,#popResult.bare .chain-result-line-colon,' +
        '#popResult.bare .chain-result-src-row{display:none !important}' +
      '#popResult.bare .chain-result-line{border-bottom:none !important;padding:0 !important}' +
      /* "Сплошняком" — строки идут подряд, а не блоками: у длинной строки не остаётся пустого
         хвоста до края окна, и биты заполняют всё поле без промежутков. */
      '#popResult.flow .chain-result-line{display:inline !important;border-bottom:none !important;padding:0 !important}' +
      '#popResult.flow .chain-result-line-bits{display:inline !important}' +
      /* Мерцание. Пульсируют либо «1» и «0» по отдельности (когда включена раскраска 1/0 — у них
         разная скорость, поэтому картинка "дышит"), либо строка целиком. */
      '@keyframes popPulse{0%,100%{opacity:1}50%{opacity:.28}}' +
      '#popResult.pulse .chain-result-line-bits{animation:popPulse var(--pop-pulse,1.6s) ease-in-out infinite}' +
      '#popResult.pulse .pop1{animation:popPulse var(--pop-pulse,1.6s) ease-in-out infinite}' +
      '#popResult.pulse .pop0{animation:popPulse calc(var(--pop-pulse,1.6s) * 1.7) ease-in-out infinite}' +
      '#popBar input[type=color]{width:22px;height:20px;padding:0;border:1px solid var(--line,#232a36);' +
        'background:#1a2130;border-radius:3px;cursor:pointer}' +
      '#popBar select{background:#1a2130;color:var(--fg,#dfe6f2);border:1px solid var(--line,#232a36);' +
        'border-radius:3px;height:20px;font:11px/1 system-ui,sans-serif;cursor:pointer}' +
      '#popBar input[type=range]{width:110px;height:20px;cursor:pointer}' +
      '#popBar label{display:flex;align-items:center;gap:3px;white-space:nowrap}' +
      '#popResult .chain-result-line-bits{flex:1 1 0;min-width:0;white-space:pre-wrap !important;' +
        'overflow:visible !important;overflow-wrap:anywhere;text-overflow:clip !important;max-width:none !important}' +
      '#popResult .chain-result-line.truncated::after{content:none !important}' +
    '</style></head><body>' +
    '<div id="popBar" style="flex-wrap:wrap">Шрифт: <button id="popFontMinus" title="Мельче">−</button>' +
    '<b id="popFontVal">10</b> px <button id="popFontPlus" title="Крупнее">+</button>' +
    '<select id="popFontFamily" title="Каким шрифтом рисовать результат">' +
      POPUP_FONTS.map(f => '<option value="' + esc(f[0]) + '">' + esc(f[1]) + '</option>').join("") +
    '</select>' +
    '<label title="Цвет текста в окне">Текст <input type="color" id="popFg"></label>' +
    '<label title="Цвет фона окна">Фон <input type="color" id="popBg"></label>' +
    '<label title="Межстрочный интервал: от 0.2 (строки почти вплотную) до 2">Строки ' +
      '<input type="range" id="popLh" min="0.2" max="2" step="0.05"><b id="popLhVal">1.00</b></label>' +
    '<label title="Красить «1» и «0» разными цветами. На очень длинных строках раскраска не делается — она требует своего элемента на каждый пробег бит">' +
      '<input type="checkbox" id="popBitsOn">1/0 цветом</label>' +
    '<label title="Цвет единиц">1 <input type="color" id="popOne"></label>' +
    '<label title="Цвет нулей">0 <input type="color" id="popZero"></label>' +
    '<label title="Только биты: спрятать подписи режимов, галочки находок, двоеточия, заголовок и полоски между строками — остаётся чистое поле из 1 и 0">' +
      '<input type="checkbox" id="popBare">Только биты</label>' +
    '<label title="Сплошняком: строки идут подряд, а не блоками — у длинных строк не остаётся пустого хвоста до края окна">' +
      '<input type="checkbox" id="popFlow">Сплошняком</label>' +
    '<label title="Как показывать биты, выброшенные «🎭 Маской» фон-поиска">Маска ' +
      '<select id="popMaskView"><option value="dim">затемнять</option><option value="cut">вырезать</option></select></label>' +
    '<label title="Мерцание бит. С включённой раскраской 1/0 единицы и нули пульсируют с разной скоростью">' +
      '<input type="checkbox" id="popPulse">Пульс</label>' +
    '<input type="range" id="popPulseSec" min="0.3" max="4" step="0.1" style="width:70px" title="Скорость мерцания, сек">' +
    '<button id="popStyleReset" style="min-width:auto;padding:0 6px" title="Вернуть оформление окна к исходному (шрифт, цвета, интервал, режимы показа)">↺</button>' +
    '<span style="opacity:.7">— окно живое: обновляется вместе с панелью</span></div>' +
    '<div class="chain-result-text" id="popResult"></div></body></html>');
  doc.close();
  // Обработчики вешаем ИЗ основного окна (документ свой, но тот же origin) — так не нужен
  // отдельный скрипт внутри попапа.
  const minus = doc.getElementById("popFontMinus"), plus = doc.getElementById("popFontPlus");
  if (minus) minus.onclick = () => setPopupFont(popupFontPx - 1);
  if (plus) plus.onclick = () => setPopupFont(popupFontPx + 1);
  // Настройки оформления: меняем popupStyle, раскладываем по CSS-переменным и перерисовываем
  // содержимое (перерисовка нужна только галке «1/0 цветом» — она меняет саму разметку).
  const bind = (id, ev, fn) => { const el = doc.getElementById(id); if (el) el[ev] = () => { fn(el); applyPopupStyle(); saveCache(); }; };
  const ffEl = doc.getElementById("popFontFamily");
  if (ffEl) {
    ffEl.value = popupStyle.ff;
    ffEl.onchange = () => { popupStyle.ff = ffEl.value; applyPopupStyle(); saveCache(); };
  }
  const fgEl = doc.getElementById("popFg"), bgEl = doc.getElementById("popBg");
  // У <input type="color"> нет "пустого" значения — показываем текущий цвет темы, а в popupStyle
  // пусто до первого выбора: так свежее окно остаётся ровно таким, каким было раньше.
  const cssVar = (n, fb) => (getComputedStyle(document.documentElement).getPropertyValue(n) || "").trim() || fb;
  if (fgEl) fgEl.value = popupStyle.fg || cssVar("--fg", "#dfe6f2");
  if (bgEl) bgEl.value = popupStyle.bg || cssVar("--cbg", "#05070c");
  bind("popFg", "oninput", el => { popupStyle.fg = el.value; });
  bind("popBg", "oninput", el => { popupStyle.bg = el.value; });
  const lhEl = doc.getElementById("popLh");
  if (lhEl) { lhEl.value = String(popupStyle.lh || 1); lhEl.oninput = () => { popupStyle.lh = +lhEl.value; applyPopupStyle(); saveCache(); }; }
  const oneEl = doc.getElementById("popOne"), zeroEl = doc.getElementById("popZero");
  if (oneEl) oneEl.value = popupStyle.one;
  if (zeroEl) zeroEl.value = popupStyle.zero;
  bind("popOne", "oninput", el => { popupStyle.one = el.value; });
  bind("popZero", "oninput", el => { popupStyle.zero = el.value; });
  const bitsEl = doc.getElementById("popBitsOn");
  if (bitsEl) {
    bitsEl.checked = !!popupStyle.bits;
    bitsEl.onchange = () => { popupStyle.bits = bitsEl.checked; applyPopupStyle(); saveCache(); render(); };
  }
  // Режимы показа: "Только биты" и "Сплошняком" — чистый CSS (перерисовка не нужна), а вот показ
  // маски меняет саму разметку, поэтому за ним идёт render().
  const bareEl = doc.getElementById("popBare"), flowEl = doc.getElementById("popFlow");
  if (bareEl) { bareEl.checked = !!popupStyle.bare; bareEl.onchange = () => { popupStyle.bare = bareEl.checked; applyPopupStyle(); saveCache(); }; }
  if (flowEl) { flowEl.checked = !!popupStyle.flow; flowEl.onchange = () => { popupStyle.flow = flowEl.checked; applyPopupStyle(); saveCache(); }; }
  const maskViewEl = doc.getElementById("popMaskView");
  if (maskViewEl) {
    maskViewEl.value = popupStyle.maskCut ? "cut" : "dim";
    maskViewEl.onchange = () => { popupStyle.maskCut = maskViewEl.value === "cut"; applyPopupStyle(); saveCache(); render(); };
  }
  const pulseEl = doc.getElementById("popPulse"), pulseSecEl = doc.getElementById("popPulseSec");
  if (pulseEl) { pulseEl.checked = !!popupStyle.pulse; pulseEl.onchange = () => { popupStyle.pulse = pulseEl.checked; applyPopupStyle(); saveCache(); }; }
  if (pulseSecEl) { pulseSecEl.value = String(popupStyle.pulseSec || 1.6); pulseSecEl.oninput = () => { popupStyle.pulseSec = +pulseSecEl.value; applyPopupStyle(); saveCache(); }; }
  const resetEl = doc.getElementById("popStyleReset");
  if (resetEl) resetEl.onclick = () => {
    popupStyle = Object.assign({}, POPUP_STYLE_DEFAULTS);
    if (ffEl) ffEl.value = "";
    if (fgEl) fgEl.value = cssVar("--fg", "#dfe6f2");
    if (bgEl) bgEl.value = cssVar("--cbg", "#05070c");
    if (lhEl) lhEl.value = "1";
    if (oneEl) oneEl.value = popupStyle.one;
    if (zeroEl) zeroEl.value = popupStyle.zero;
    if (bitsEl) bitsEl.checked = false;
    if (bareEl) bareEl.checked = false;
    if (flowEl) flowEl.checked = false;
    if (maskViewEl) maskViewEl.value = "dim";
    if (pulseEl) pulseEl.checked = false;
    if (pulseSecEl) pulseSecEl.value = String(popupStyle.pulseSec);
    applyPopupStyle(); saveCache(); render();
  };
  applyPopupFont();
  applyPopupStyle();
  trackWindowGeometry("result", resultPopupWin); // размер/положение окна помнятся между сеансами
  // Пока окно живо, панель "Результат" в основном документе не показывается (запрос пользователя),
  // а закрыли окно — возвращается на своё место в стопке.
  resultPopupWin.addEventListener("pagehide", () => setTimeout(syncPopoutBoxes, 60));
  syncPopoutBoxes();
  render(); // сразу наполняем содержимым
}
/* Вызывается в конце каждого render(): html — уже готовая разметка без потолка (строится только
   когда окно открыто), plainText — запасной вариант для режима без фон-поиска (обычная сквозная). */
function updateResultPopup(html, plainText){
  if (!resultPopupAlive()) return;
  const box = resultPopupWin.document.getElementById("popResult");
  if (!box) return;
  box.innerHTML = html != null
    ? html
    : (plainText ? '<div class="chain-result-line"><span class="chain-result-line-bits">' + esc(plainText) + '</span></div>'
                 : '<span class="empty">пусто</span>');
  // Те же два прохода по готовой разметке, что и в панели: гашение бит, выброшенных "🎭 Маской",
  // и своя раскраска «1»/«0» (только в окне, см. popupStyle.bits).
  dimMaskedBits(box, resultPopupWin.document, popupStyle.maskCut);
  colorizePopupBits(box, resultPopupWin.document);
  // Классы режимов показа держим на контейнере — после innerHTML сам элемент тот же, но вызов
  // дешёвый и страхует от рассинхрона, если окно только что открыли.
  applyPopupStyle();
  const title = document.getElementById("chainResultLabel");
  resultPopupWin.document.title = (title ? title.textContent : "Результат") + " — Zerkalius Fold";
}
/* ДВЕ ПОЛОВИНКИ ОБЩЕГО БАЛАНСА В ПОЛОСЕ ВЫРАВНИВАНИЙ КАК ПАРА КНОПОК (v0.864, запрос
   пользователя). Клик по половинке включает построчные балансы в её виде; клик по уже активной —
   выключает их совсем. Обработчик делегированный: содержимое #alignBalance перерисовывает
   renderColHeader() на каждый render(), вешать onclick на сами половинки было бы не на что. */
{
  const alignBalClickEl = document.getElementById("alignBalance");
  if (alignBalClickEl) alignBalClickEl.addEventListener("click", (e) => {
    const part = e.target.closest("[data-bal]");
    if (!part) return;
    const wantBin = part.dataset.bal === "bin";
    const activeNow = st.showBalances && (!!st.binBalance === wantBin);
    if (activeNow) {
      st.showBalances = false;              // повторный клик по активной — убрать балансы из строк
    } else {
      st.showBalances = true;
      // Вид держим тем же переключателем, что и кнопка "⚖ Баланс" во вкладке "Вид": пустая строка
      // — десятичный, "10" — оба числа двоичным (см. binBalanceToggle/formatBalanceTotals).
      // Уже выбранный двоичный подвид ("1"/"0"/"01") не перебиваем — он тоже двоичный.
      if (wantBin) { if (!st.binBalance) st.binBalance = "10"; }
      else st.binBalance = "";
    }
    const b = document.getElementById("bShowBalances");
    if (b) b.classList.toggle("mode-act", st.showBalances);
    if (typeof updateBinBalanceBtn === "function") updateBinBalanceBtn();
    render(); saveCache();
  });
}
const bPopoutResultEl = document.getElementById("bPopoutResult");
if (bPopoutResultEl) bPopoutResultEl.onclick = (e) => { e.stopPropagation(); openResultPopup(); };

/* === ЧЕРНОВИК ШАГА В ОТДЕЛЬНОМ ОКНЕ (v0.844, запрос пользователя) ===
   Проще "Результата": своих настроек оформления у черновика нет, поэтому содержимое #stepLogBody
   просто зеркалится innerHTML'ом при каждой его перерисовке. Стили копируются из основного
   документа целиком — разметка строк черновика та же самая.
   ПОКА ОКНО ЖИВО, панель в основном документе НЕ ПОКАЗЫВАЕТСЯ (то же и у "Результата" — запрос
   пользователя "когда в отдельном — тут окно не отображать"): иначе одно и то же висит в двух
   местах и зря ест высоту холста. Прячется классом .popped-out, а НЕ overlayHidden — состояние
   кнопок "показать/скрыть" в верхнем меню при этом не меняется, и после закрытия окна панель
   возвращается ровно такой, какой была. */
let stepLogPopupWin = null;
function stepLogPopupAlive(){ return !!(stepLogPopupWin && !stepLogPopupWin.closed); }
/* Панель прячется/возвращается по тому, живо ли её окно. Перекладку стопки дёргаем ТОЛЬКО при
   реальной смене состояния — функцию зовут и из render(), и по фокусу окна. */
function syncPopoutBoxes(){
  let changed = false;
  [["chainResultBox", resultPopupAlive()], ["stepLogBox", stepLogPopupAlive()]].forEach(pair => {
    const el = document.getElementById(pair[0]);
    if (!el) return;
    if (el.classList.contains("popped-out") !== pair[1]) {
      el.classList.toggle("popped-out", pair[1]);
      changed = true;
    }
  });
  if (changed) layoutOverlayBoxes();
}
// Окно могли закрыть крестиком — узнаём об этом, когда основное окно снова получает фокус.
window.addEventListener("focus", syncPopoutBoxes);
function openStepLogPopup(){
  if (stepLogPopupAlive()) { stepLogPopupWin.focus(); render(); return; }
  stepLogPopupWin = window.open("", "zerkaliusStepLog", winFeatures("steplog", 900, 700));
  if (!stepLogPopupWin) { say("Браузер заблокировал окно — разрешите всплывающие окна для этой страницы."); return; }
  const styles = Array.from(document.querySelectorAll("style")).map(s => s.innerHTML).join("\n");
  const doc = stepLogPopupWin.document;
  doc.open();
  doc.write('<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>Черновик шага — Zerkalius Fold</title>' +
    '<style>' + styles + '</style>' +
    '<style>' +
      // Те же сбросы, что и у окна "Результата": в основном документе body — flex-колонка на
      // 100vh с overflow:hidden, в отдельном окне из-за этого содержимое обрезалось бы.
      'html{scrollbar-width:none}' +
      'html::-webkit-scrollbar, body::-webkit-scrollbar{width:0;height:0;background:transparent}' +
      'html,body{background:var(--cbg,#05070c);color:var(--fg,#dfe6f2);margin:0;padding:0;' +
        'width:100%;height:auto;min-height:100%;max-height:none;overflow:visible;display:block}' +
      // Высота тела черновика в панели держится вручную (stepLogBodyHeight) — в окне она не нужна,
      // содержимое занимает окно целиком.
      '#popStepLog{padding:6px 8px;box-sizing:border-box;width:100%;height:auto !important;' +
        'max-height:none !important;overflow:visible !important;background:none;border:none}' +
      '#popStepLog .step-log-result{white-space:pre-wrap !important;overflow:visible !important;' +
        'text-overflow:clip !important;max-width:none !important}' +
      '#popStepLog .step-log-result-line.truncated::after{content:none !important}' +
    '</style></head><body><div class="step-log-body" id="popStepLog"></div></body></html>');
  doc.close();
  trackWindowGeometry("steplog", stepLogPopupWin);
  // Закрыли окно — панель тут же возвращается в стопку.
  stepLogPopupWin.addEventListener("pagehide", () => setTimeout(syncPopoutBoxes, 60));
  syncPopoutBoxes();
  render(); // сразу наполняем содержимым
}
/* Зовётся в конце renderStepLogBox() — что в панели, то и в окне. */
function updateStepLogPopup(){
  if (!stepLogPopupAlive()) return;
  const src = document.getElementById("stepLogBody");
  const box = stepLogPopupWin.document.getElementById("popStepLog");
  if (src && box) box.innerHTML = src.innerHTML;
  const no = document.getElementById("stepLogNo");
  stepLogPopupWin.document.title = "Черновик шага № " + (no ? no.textContent : "") + " — Zerkalius Fold";
}
const bPopoutStepLogEl = document.getElementById("bPopoutStepLog");
if (bPopoutStepLogEl) bPopoutStepLogEl.onclick = (e) => { e.stopPropagation(); openStepLogPopup(); };

/* === ОТДЕЛЬНОЕ ОКНО ЛОГА НАХОДОК (v0.953, запрос пользователя "лог находок также в отдельное
   окно надо") === Устроено как окно Черновика: содержимое КОПИРУЕТСЯ туда на каждой перерисовке
   (updateFindLogPopup зовёт renderFindLogPanel), а не переезжает живым узлом, как панели. Разница
   принципиальная: панель одна и её нельзя показывать в двух местах сразу, а лог — просто разметка,
   и держать её копию дешевле, чем таскать узел туда-обратно. Поэтому панель в основном окне
   остаётся на месте и продолжает работать.
   Копируем и сам список, и блок «🧮 Суммы длин» — он живёт в той же вкладке и в окне нужен так же. */
let findLogPopupWin = null;
function findLogPopupAlive(){ return !!(findLogPopupWin && !findLogPopupWin.closed); }
function updateFindLogPopup(){
  if (!findLogPopupAlive()) return;
  const doc = findLogPopupWin.document;
  const list = document.getElementById("findLogList");
  const sums = document.getElementById("lengthSumsContainer");
  const boxL = doc.getElementById("popFindLog");
  const boxS = doc.getElementById("popFindSums");
  if (list && boxL) boxL.innerHTML = list.innerHTML;
  if (boxS) boxS.innerHTML = sums ? sums.innerHTML : "";
}
function openFindLogPopup(){
  if (findLogPopupAlive()) { findLogPopupWin.focus(); render(); return; }
  findLogPopupWin = window.open("", "zerkaliusFindLog", winFeatures("findlog", 900, 700));
  if (!findLogPopupWin) { say("Браузер заблокировал окно — разрешите всплывающие окна для этой страницы."); return; }
  const styles = Array.from(document.querySelectorAll("style")).map(s => s.innerHTML).join("\n");
  const doc = findLogPopupWin.document;
  doc.open();
  doc.write('<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>Лог находок — Zerkalius Fold</title>' +
    '<style>' + styles + '</style>' +
    '<style>' +
      // Тот же сброс, что и у прочих окон: копия стилей делает body flex-колонкой в 100vh с
      // overflow:hidden, и всё ниже сгиба стало бы недостижимым.
      'html,body{background:var(--cbg,#05070c);color:var(--fg,#dfe6f2);margin:0;padding:0;' +
        'width:100%;height:auto;min-height:100%;max-height:none;overflow:auto;display:block}' +
      // В панели список тянут за угол и держат ручной размер (см. #findLogList) — в окне это
      // мешает: пусть занимает окно целиком и прокручивается вместе с ним.
      '#popFindLog{padding:6px 8px;box-sizing:border-box;width:100%;height:auto !important;' +
        'max-height:none !important;overflow:visible !important;resize:none !important}' +
      '#popFindSums{padding:0 8px 8px}' +
    '</style></head><body><div id="popFindLog"></div><div id="popFindSums"></div></body></html>');
  doc.close();
  trackWindowGeometry("findlog", findLogPopupWin);
  updateFindLogPopup();
  render();
}
const bPopoutFindLogEl = document.getElementById("bPopoutFindLog");
if (bPopoutFindLogEl) bPopoutFindLogEl.onclick = (e) => { e.stopPropagation(); openFindLogPopup(); };
window.addEventListener("pagehide", () => { if (findLogPopupAlive()) findLogPopupWin.close(); });

/* Кнопка копирования сквозной строки результата */
const bCopyChainEl = document.getElementById("bCopyChain");
if (bCopyChainEl) {
  bCopyChainEl.onclick = () => {
    if (!lastChainResultText) { say("Окно результата пусто"); return; }
    copyTextToClipboard(lastChainResultText, "Скопировано!");
  };
}

/* "📌 Закрепить" — фиксирует ВЫСОТУ панели "Результат" на текущем размере: дальше при смене
   содержимого (переключили режимы фон-поиска, включили "Суммы длин" и т.п.) панель НЕ растёт и
   не сжимается сама — просто скроллится внутри (у #chainText и так есть overflow-y:auto) —
   запрос пользователя. Выключил — снова "height:auto" по месту (как было всегда). ПО УМОЛЧАНИЮ
   включена, и состояние (последнее нажатие) переживает F5 — персистится как обычная UI-настройка
   (см. captureUiSettings/applyUiSettings/DEFAULT_UI_SETTINGS) — запрос пользователя ("сейчас
   при F5 сбрасывает"). resultHeightAppliedOnce — конкретный px ещё не персистится (незачем,
   он всё равно зависит от текущего содержимого) — при включении (в т.ч. свежей загрузке
   страницы) высота замеряется заново от РЕАЛЬНОГО контента, см. вызов в конце render(). */
let resultHeightLocked = true;
let resultHeightAppliedOnce = false;
function applyResultHeightLock(){
  const el = document.getElementById("chainText");
  const btn = document.getElementById("bLockResultHeight");
  if (btn) btn.classList.toggle("mode-act", resultHeightLocked);
  if (!el) return;
  if (!resultHeightLocked) { el.style.height = ""; resultHeightAppliedOnce = false; return; }
  if (!resultHeightAppliedOnce) {
    el.style.height = "";
    el.style.height = el.offsetHeight + "px";
    resultHeightAppliedOnce = true;
  }
}
const bLockResultHeightEl = document.getElementById("bLockResultHeight");
if (bLockResultHeightEl) {
  bLockResultHeightEl.onclick = () => {
    resultHeightLocked = !resultHeightLocked;
    applyResultHeightLock();
    saveCache();
    say(resultHeightLocked ? "Высота панели «Результат» закреплена." : "Высота панели «Результат» снова автоматическая.");
  };
}

/* Та же "📌", но для "Черновика шага" (v0.962, запрос пользователя "сделай фикс размера как в
   Результатах — кнопка"). Высоту черновика держит applyStepLogBodyHeight() (fold-2-render.js) —
   там же и читается stepLogHeightLocked; здесь только переключатель. Отдельная перерисовка не
   нужна: применяется на ближайшем render(), а чтобы кнопка сразу подсветилась, красим её тут. */
const bLockStepLogHeightEl = document.getElementById("bLockStepLogHeight");
if (bLockStepLogHeightEl) {
  bLockStepLogHeightEl.onclick = () => {
    stepLogHeightLocked = !stepLogHeightLocked;
    bLockStepLogHeightEl.classList.toggle("mode-act", stepLogHeightLocked);
    render(); saveCache();
    say(stepLogHeightLocked ? "Высота панели «Черновик шага» закреплена." : "Высота панели «Черновик шага» снова растёт под содержимое.");
  };
}

/* Общий помощник копирования в буфер — сначала через Clipboard API, при неудаче/отсутствии
   (напр. страница открыта не по https) — через скрытый textarea + execCommand("copy"). */
function copyTextToClipboard(text, successMsg) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      say(successMsg);
    }).catch(() => {
      copyFallback(text, successMsg);
    });
  } else {
    copyFallback(text, successMsg);
  }
}
function copyFallback(text, successMsg) {
  const ta = document.createElement("textarea");
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand("copy");
    say(successMsg || "Скопировано!");
  } catch(e) {
    say("Не удалось скопировать");
  }
  document.body.removeChild(ta);
}

/* Ctrl/Cmd+C — копирует ВЫДЕЛЕННЫЕ (кликом) строки как текст, каждая своя строка, с ведущими
   пробелами по текущему выравниванию (см. alignShift) — так же, как они стоят в таблице
   относительно самой длинной строки, чтобы при вставке в моноширинный текст биты остались
   визуально выровнены друг под другом. Срабатывает только если нет обычного текстового
   выделения (чтобы не перехватывать копирование текста, который пользователь выделил мышью
   вручную, например в окошке результата) и есть хотя бы одна выделенная строка. */
/* allRows=true (кнопка "📋 Скопировать строки-цепочки" во вкладке "Вид") — копировать ВСЮ цепочку,
   когда выделения нет; Ctrl+C зовёт эту же функцию без флага и без выделения просто ничего не
   делает, как и раньше. Пустые строки в "всю цепочку" не идут — копировать нечего. */
function copySelectedRows(allRows){
  const hasSel = st.selectedRows && st.selectedRows.size > 0;
  if (!hasSel && !allRows) return;
  let maxLen = 0;
  for (const s of st.rows) if (s.length > maxLen) maxLen = s.length;
  const idxs = hasSel
    ? Array.from(st.selectedRows).sort((a, b) => a - b)
    : st.rows.map((_, i) => i).filter(i => (st.rows[i] || "").length);
  if (!idxs.length) { say("Копировать нечего — строки пустые."); return; }
  const lines = idxs.map(i => {
    const s = getRowBits(st, i) || "";
    const shift = s.length ? alignShift(maxLen, s.length, st.align, i) : 0;
    return " ".repeat(Math.max(0, shift)) + s;
  });
  // Рядом с обычным текстом кладём в буфер HTML-таблицу с цветами — см. clipRowsHtml().
  copyRichToClipboard(lines.join("\n"), clipRowsHtml(idxs, lines), `Скопировано строк: ${idxs.length}`);
}

/* === КОПИРОВАНИЕ С ЦВЕТАМИ (v0.835, запрос пользователя: "чтобы при вставке в ексель цвета
   символов также были и по строкам") ===
   В буфер кладутся ДВА формата сразу: text/plain (как и раньше, ровно те же строки) и text/html.
   Excel при вставке предпочитает html и сохраняет цвет КАЖДОГО символа внутри ячейки, а раскладка
   при этом остаётся построчной: строка цепочки = одна ячейка (по выбору пользователя, не "бит =
   ячейка"). Куда html не понимают (блокнот, поле ввода) — приезжает обычный текст. */

/* Базовые цвета символов "1" и "0" — те, что выставлены сейчас в настройках вида (.b1/.b0 →
   var(--c1)/var(--c0)). Меряем настоящим элементом, а не читаем переменную: цвет приходит и от
   пресетов, и от ползунков, и вычисленное значение уже готово к подстановке в style. */
function clipBaseBitColors(){
  const probe = document.createElement("div");
  probe.style.cssText = "position:absolute;left:-9999px;top:0;visibility:hidden";
  probe.innerHTML = '<span class="b1">1</span><span class="b0">0</span>';
  document.body.appendChild(probe);
  const res = { "1": getComputedStyle(probe.firstChild).color,
                "0": getComputedStyle(probe.lastChild).color };
  probe.remove();
  return res;
}

/* Цвет КАЖДОГО символа строки i — снимаем с уже отрисованной строки таблицы, чтобы в Excel уехали
   не только базовые 0/1, но и подсветки находок (они живут в классах/инлайн-стилях render()).
   Строки вне экрана в DOM не существуют (виртуализация, см. vrowsRange) — для них возвращаем null
   и красим базовыми цветами. Зеркала (.lm-bit) в подсчёт не идут: их нет в самой строке.
   Ведущие/хвостовые пробелы-распорки (blankRun) обрезаем. Если после этого длина всё равно не
   совпала со строкой (разделители витков, "пробеги вместо битов" и прочие вставки) — тоже null:
   лучше базовые цвета, чем сдвинутая на символ раскраска. */
function clipRowCharColors(i, s){
  const host = document.querySelector('#rows .ln[data-idx="' + i + '"] .bits');
  if (!host) return null;
  const chars = [], colors = [];
  const walk = (node) => {
    for (const ch of node.childNodes) {
      if (ch.nodeType === 3) {
        const col = getComputedStyle(ch.parentElement).color;
        for (const c of ch.nodeValue) { chars.push(c); colors.push(col); }
      } else if (ch.nodeType === 1 && !ch.classList.contains("lm-bit")) {
        walk(ch);
      }
    }
  };
  walk(host);
  let a = 0, b = chars.length;
  while (a < b && chars[a] === " ") a++;
  while (b > a && chars[b - 1] === " ") b--;
  return (b - a === s.length) ? colors.slice(a, b) : null;
}

/* HTML для буфера: по одной ячейке на строку цепочки. Ведущие пробелы выравнивания — &nbsp;
   (обычные пробелы Excel по краям ячейки съедает), шрифт моноширинный, чтобы вставленное
   выглядело так же, как в таблице. */
function clipRowsHtml(idxs, lines){
  const base = clipBaseBitColors();
  const escChar = (c) => c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c;
  const rows = idxs.map((i, k) => {
    const s = getRowBits(st, i) || "";
    const lead = Math.max(0, (lines[k] || "").length - s.length);
    const cols = clipRowCharColors(i, s);
    let cell = "&nbsp;".repeat(lead);
    for (let p = 0; p < s.length; p++) {
      const col = (cols && cols[p]) || base[s[p]] || base["0"];
      cell += '<span style="color:' + col + '">' + escChar(s[p]) + "</span>";
    }
    return '<tr><td style="font-family:Consolas,\'Courier New\',monospace;white-space:pre">' + cell + "</td></tr>";
  }).join("");
  return '<table border="0" cellspacing="0" cellpadding="0">' + rows + "</table>";
}

/* Кладём в буфер оба формата разом. ClipboardItem есть только в secure context (https/localhost);
   где его нет — молча уходим на обычное текстовое копирование: данные те же, теряется только
   раскраска. */
function copyRichToClipboard(text, html, successMsg){
  if (navigator.clipboard && navigator.clipboard.write && window.ClipboardItem) {
    try {
      const item = new ClipboardItem({
        "text/plain": new Blob([text], { type: "text/plain" }),
        "text/html":  new Blob([html],  { type: "text/html"  })
      });
      navigator.clipboard.write([item])
        .then(() => say(successMsg))
        .catch(() => copyTextToClipboard(text, successMsg));
      return;
    } catch(e) { /* ClipboardItem есть, но формат не принят — уходим на текст */ }
  }
  copyTextToClipboard(text, successMsg);
}

/* Переключение режимов работы (выделение рамкой + перемещение кнопки "↩ Назад" слева от активной) */
function getModeParams(mode){
  switch(mode){
    case "step2":    return { pairOnly: true,  forceXor: false, isScan: false, isHorizXor: false, isXorProj: false, horizDir: "right" };
    case "xor1":     return { pairOnly: false, forceXor: true,  isScan: false, isHorizXor: false, isXorProj: false, horizDir: "right" };
    case "xor2":     return { pairOnly: true,  forceXor: true,  isScan: false, isHorizXor: false, isXorProj: false, horizDir: "right" };
    case "scan":     return { pairOnly: false, forceXor: false, isScan: true,  isHorizXor: false, isXorProj: false, horizDir: "right" };
    case "horiz_xor":return { pairOnly: false, forceXor: false, isScan: false, isHorizXor: true,  isXorProj: false, horizDir: "right" };
    case "horiz_xor_left": return { pairOnly: false, forceXor: false, isScan: false, isHorizXor: true, isXorProj: false, horizDir: "left" };
    case "xor_proj": return { pairOnly: false, forceXor: false, isScan: false, isHorizXor: false, isXorProj: true,  horizDir: "right" };
    default:         return { pairOnly: false, forceXor: false, isScan: false, isHorizXor: false, isXorProj: false, horizDir: "right" };
  }
}

/* Последняя нажатая из 4 кнопок направления (◄ ► ▲ ▼ Спираль, см. st.lastDirMode) — взаимно
   исключающая подсветка (.mode-act) среди этих четырёх, И с обычными режимами-кнопками
   (STEP_MODE_BTN_IDS ниже — Шаг/Шаг2/XOR/XOR2/Гориз.XOR/Проекц.XOR/Скан): "Авто" повторяет
   только ОДНО из двух семейств одновременно (см. autoRun()), поэтому включение любого из них
   должно гасить подсветку другого. Явный выбор обычного режима (setMode() ниже) гасит эту, и
   наоборот — эта гасит подсветку обычных режимов (но не трогает сам st.mode: если потом опять
   нажать Шаг/XOR/и т.п., они возьмут её как есть). */
const DIR_MODE_BTN = { shiftL: "bShiftL", shiftR: "bShiftR", shiftLInv: "bShiftLInv", shiftRInv: "bShiftRInv", spiralUp: "bSpiralUp", spiralDown: "bSpiralDown" };
const STEP_MODE_BTN_IDS = ["bStep", "bStep2", "bStepXor", "bStep2Xor", "bStepHorizXor", "bStepHorizXorLeft", "bStepXorProj", "bStepScan"];
// "⧬ Интерлив сквозной"/"⨁ XOR сквозной" — тоже полноценные "режимы для Авто" (см.
// st.interleaveSeqMode/st.xorSeqMode), гасятся/гасят наравне с остальными.
const SEQ_MODE_BTN_IDS = ["bInterleaveSeqSearch", "bXorSeqSearch"];
function setLastDirMode(val){
  st.lastDirMode = val || null;
  st.xorSelectedMode = false;
  st.interleaveMode = false;
  st.interleaveSeqMode = false;
  st.xorSeqMode = false;
  // invFlagsMap НЕ чистим тут — переключение между самими 4 кнопками (◄/►Круг/Круг Инв) не
  // должно сбрасывать историю "какой бит уже перевёрнут", только явный уход в другой режим
  // (setMode() ниже чистит явно).
  Object.entries(DIR_MODE_BTN).forEach(([k, id]) => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle("mode-act", k === val);
  });
  if (val) {
    STEP_MODE_BTN_IDS.concat(SEQ_MODE_BTN_IDS).forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove("mode-act");
    });
  }
}

function setMode(modeName){
  st.mode = modeName;
  // "XOR выдел" и "Интерливинг поиск" — одноразовые оверлей-режимы поверх обычного шага,
  // их флаги не сбрасываются автоматически по завершении. Если они остались висеть с
  // прошлого раза, autoRun() проверяет их РАНЬШЕ st.mode и уводит "Авто" в чужую логику
  // (например, ломая Гориз.XOR). При явном переключении режима — всегда гасим их (и заодно
  // "последнюю нажатую из 4 кнопок направления" — см. setLastDirMode()).
  st.xorSelectedMode = false;
  st.interleaveMode = false;
  st.interleaveSeqMode = false;
  st.xorSeqMode = false;
  SEQ_MODE_BTN_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove("mode-act");
  });
  if (st.lastDirMode) setLastDirMode(null);
  invFlagsMap.clear();
  st.shiftVariantTotal = null;
  st.shiftVariantRows = null;
  st.manualShiftTurns = 0;
  // Смена режима — то же самое, что и новый клик по строке: выделение снова "своё" (см.
  // captureFoundRow/st.captureGrown).
  st.captureGrown = false;
  updateVariantCounter();
  const modes = {
    "step1":     "bStep",
    "step2":     "bStep2",
    "xor1":      "bStepXor",
    "xor2":      "bStep2Xor",
    "horiz_xor": "bStepHorizXor",
    "horiz_xor_left": "bStepHorizXorLeft",
    "xor_proj":  "bStepXorProj",
    "scan":      "bStepScan"
  };

  const undoBtn = document.getElementById("bUndo");

  Object.entries(modes).forEach(([m, id]) => {
    const el = document.getElementById(id);
    if (el) {
      if (m === modeName) {
        el.classList.add("mode-act");
        if (undoBtn) {
          undoBtn.style.top = (el.offsetTop + el.offsetHeight + 2) + "px";
          undoBtn.style.left = el.offsetLeft + "px";
        }
      } else {
        el.classList.remove("mode-act");
      }
    }
  });
}

function doModeStep(modeName){
  setMode(modeName);
  const { pairOnly, forceXor, isScan, isHorizXor, isXorProj, horizDir } = getModeParams(modeName);
  step(pairOnly, forceXor, isScan, isHorizXor, isXorProj, horizDir);
}

/* === МАРКЕР 10.2: СИСТЕМА ВКЛАДОК/ПАНЕЛЕЙ (перенесено из Zerkalius-gpu.html) ===
   Каждая вкладка — обёртка .menu-panel (panelWrap_<mid>), которая гуляет между тремя
   местами: закреплённая в доке (#leftSlot/#rightSlot), свёрнутая в выпадающее окно
   (.menu-drop с тем же id, что и mid) или плавающая на холсте (.floating-panel в body).
   Раскладка (что где закреплено/висит) сохраняется в localStorage отдельным ключом
   LAYOUT_KEY — не путать с CACHE_KEY (состояние цепочек). */
const MENUS = {
  /* flowGroup (Назад/Авто/Стоп) перенесён сюда же, ПЕРВЫМ в ids — по перечню в ids элементы
     реально appendChild'ятся в этом порядке (см. цикл ниже), так что flowGroup оказывается
     над opsGroup. Раньше жил в отдельной вкладке "Управление" (menuFlow) — вкладку убрали.
     Порядок записей в MENUS (и раскладка по умолчанию для СВЕЖЕЙ сессии, без сохранённого
     layout) — Шаги+Поиск слева, Вид+Правка строк справа, все 4 закреплены: панели одной зоны
     appendChild'ятся в том порядке, в котором идут тут (см. цикл for..in MENUS ниже), поэтому
     порядок пар menuOps/menuSearch и menuView/menuEdit в объекте важен. */
  // topActionsGroup — "⧬ Интерлив" и "⨁ XOR выдел" в САМОМ ВЕРХУ, над "Авто" (запрос
  // пользователя). Порядок в ids — это и есть порядок отрисовки (см. цикл appendChild ниже),
  // поэтому группа стоит первой, раньше flowGroup.
  menuOps:    { title: 'Шаги',         zone: 'leftSlot',  pin: true, ids: ['topActionsGroup', 'flowGroup', 'opsGroup'], floatable: true },
  menuSearch: { title: 'Поиск',        zone: 'leftSlot',  pin: true, ids: ['searchGroup'], floatable: true },
  // МАСКИ — вынесены из "Поиска" в свою вкладку (запрос пользователя: "свое меню им"). pin:false —
  // по умолчанию живёт выпадающим окном, не занимая место в доке: маска нужна не в каждом сеансе.
  menuMask:   { title: 'Маски',        zone: 'leftSlot',  pin: false, ids: ['maskGroup'], floatable: true },
  menuFindLog:{ title: 'Лог находок',  zone: 'leftSlot',  pin: false, ids: ['findLogGroup'], floatable: true },
  menuView:   { title: 'Вид',          zone: 'rightSlot', pin: true, ids: ['viewGroup'],   floatable: true },
  menuEdit:   { title: 'Строки',       zone: 'rightSlot', pin: true, ids: ['editGroup'],   floatable: true },
  // Панель про ВЫДЕЛЕНИЕ целиком (запрос пользователя): столбцы-оси и «Выбор ячеек», который
  // переехал сюда из «Строк». id группы (colEditGroup) не трогаем — по нему живёт раскладка в кэше.
  menuColEdit:{ title: 'Выделить', zone: 'rightSlot', pin: true, ids: ['colEditGroup'], floatable: true },
  // "Построения" (бывш. "Зеркала", v0.885): к зеркалам сюда переехал генератор Серпинского из
  // "Строк" и добавлены "🔢 Номера" — всё, что СТРОИТ новые биты, в одной вкладке.
  menuTopBuild:{ title: 'Построения', zone: 'rightSlot', pin: true, ids: ['topBuildGroup'], floatable: true },
  menuSeq:    { title: 'Сквозная',     zone: 'rightSlot', pin: true, ids: ['seqGroup'],    floatable: true }
};
const LAYOUT_KEY = 'zerk_fold_layout';
/* Порядок стековых overlay-баров сверху вниз (см. МАРКЕР 10.2b OVERLAY_STACK ниже) —
   меняется только перетаскиванием за ручку ⋮⋮ в шапке, персистится вместе с остальной
   раскладкой (тот же LAYOUT_KEY). */
// «Черновик шага» ВВЕРХУ, «Результат фон-поиска» под ним — запрос пользователя. Это лишь порядок
// ПО УМОЛЧАНИЮ: если пользователь уже менял его перетаскиванием за «⋮⋮», сохранённый порядок из
// layout-кэша перекроет этот (см. loadLayout — там overlayOrder читается из L.overlayOrder).
let overlayOrder = ['stepLogBox', 'chainResultBox'];
/* Полностью скрытые крестиком ✕ overlay-бары (в отличие от collapsed — тот просто сворачивает
   в строку-заголовок, а не убирает бар из вида совсем). Вернуть — только кнопками
   #bToggleResultBox/#bToggleStepLog в верхнем меню, см. МАРКЕР 10.2b OVERLAY_STACK. */
let overlayHidden = { chainResultBox: false, stepLogBox: false };

for (let mid in MENUS) {
  let m = MENUS[mid];
  let wrap = document.createElement('div'); wrap.className = 'menu-panel'; wrap.id = 'panelWrap_' + mid;
  if (m.floatable) wrap.dataset.floatable = '1';
  let head = document.createElement('div'); head.className = 'panel-head';
  head.innerHTML = '<span class="panel-drag" title="Перетащить панель' + (m.floatable ? ' — можно и на холст' : '') + '">⋮⋮</span><span class="panel-title">' + m.title + '</span><span class="panel-close" title="Скрыть панель">✕</span>';
  let closeBtn = head.querySelector('.panel-close');
  closeBtn.addEventListener('mousedown', e => e.stopPropagation());
  closeBtn.addEventListener('click', e => { e.stopPropagation(); hideTab(mid); });
  wrap.appendChild(head);
  m.ids.forEach(id => { let el = document.getElementById(id); if (el) wrap.appendChild(el); });
  m.wrapper = wrap;
}

function saveLayout() {
  let g = {};
  ['leftSlot', 'rightSlot'].forEach(z => Array.from(document.getElementById(z).children).forEach((el, i) => { if (el.id) g[el.id] = { z: z, i: i }; }));
  document.querySelectorAll('body > .floating-panel').forEach(el => { if (el.id) g[el.id] = { z: 'canvas', x: parseInt(el.style.left, 10) || 0, y: parseInt(el.style.top, 10) || 0 }; });
  let pins = {}; for (let m in MENUS) pins[m] = MENUS[m].pin;
  // overlayOrderV2 — флаг разовой миграции порядка окон, см. loadLayout(). Пишется всегда, поэтому
  // после первого же сохранения текущий порядок снова становится главнее default'а.
  try { localStorage.setItem(LAYOUT_KEY, JSON.stringify({ pins: pins, groups: g, overlayOrder: overlayOrder, overlayOrderV2: true, overlayHidden: overlayHidden })); } catch (e) {}
}

/* КЛИК ПО НАЙДЕННОМУ ПАТТЕРНУ ведёт к его вхождению в самих строках цепочек, повторный клик по
   тому же паттерну — к следующему вхождению, по кругу (запрос пользователя). Где паттерн лежит,
   берём из той же карты, по которой он подсвечивается в строках (allPatRows режима "🌈 Все
   паттерны сразу", см. render) — значит переходы идут ровно по видимой подсветке, включая
   частичные находки "🧩 Макс. часть" и каждое вхождение при "🔁 Все вхождения".
   var, а не let: присваивание живёт внутри render(), которая по коду ВЫШЕ этого места. */
var lastAllPatRows = null;
var patNavPat = -1, patNavIdx = -1;
function patHitTargets(patIdx){
  const out = [];
  if (!lastAllPatRows) return out;
  const rows = Array.from(lastAllPatRows.keys()).sort((a, b) => a - b);
  for (const r of rows) {
    const arr = lastAllPatRows.get(r);
    if (!arr) continue;
    // Берём НАЧАЛА непрерывных кусков: подсветка лежит побитно, а переход нужен к вхождению.
    let prev = false;
    for (let p = 0; p < arr.length; p++) {
      const on = arr[p] === patIdx;
      if (on && !prev) out.push({ r, p });
      prev = on;
    }
  }
  return out;
}
/* Прокрутка полотна к конкретному биту: по вертикали — общим scrollToRow() (он умеет в
   виртуализацию), по горизонтали — ставим бит в середину видимой ширины. Колонку считаем формулой
   рендера (сдвиг строки по выравниванию + общий сдвиг оси + номер бита); полусимвольные довески
   (extraCh) тут сознательно не учитываем — это прокрутка "чтобы увидеть", а не отрисовка. */
function scrollToBit(r, p){
  scrollToRow(r);
  const sc = document.getElementById("screenCanvas");
  if (!sc) return;
  const rowEl = document.querySelector('#rows .ln[data-idx="' + r + '"]');
  const bitsEl = rowEl ? rowEl.querySelector(".bits") : null;
  if (!bitsEl) return;
  const chPx = realColStepPx();
  if (!(chPx > 0)) return;
  let maxLen = 0;
  for (const s of st.rows) if (s.length > maxLen) maxLen = s.length;
  const s = st.rows[r] || "";
  const col = rowShiftFor(maxLen, r, s, st.align) + (st.axisCenterOffset || 0) + p;
  const x = (bitsEl.getBoundingClientRect().left - sc.getBoundingClientRect().left) + sc.scrollLeft + col * chPx;
  const max = Math.max(0, sc.scrollWidth - sc.clientWidth);
  sc.scrollLeft = Math.max(0, Math.min(max, x - sc.clientWidth / 2));
}
/* Следующее вхождение кликнутого паттерна. Кликнули ДРУГОЙ паттерн — начинаем с первого. */
function patNavStep(patIdx){
  const targets = patHitTargets(patIdx);
  if (!targets.length) {
    patNavPat = -1; patNavIdx = -1;
    // Молчать тут нельзя (запрос пользователя): непонятно, поиск не нашёл или его вовсе нет.
    // Разбираем ПОЧЕМУ пусто: отсечки поиска (⛔, «⏭ Без 1-го», чужое выделение) снаружи никак
    // не видны, и молчаливое "не найдено" на них выглядит как поломка (запрос пользователя).
    const why = allPatSkipReason(patIdx);
    const pt = (st.pats[patIdx] && st.pats[patIdx].text) || "";
    say(why
      ? `Паттерн строки ${patIdx + 1} не искался: ${why}.`
      : `Паттерн строки ${patIdx + 1} («${pt}») в строках цепочек не встречается${st.bgAllPatsPartial ? "" : " — включите «🧩 Макс. часть», чтобы увидеть самый длинный совпавший кусок"}.`);
    return;
  }
  patNavIdx = (patNavPat === patIdx) ? (patNavIdx + 1) % targets.length : 0;
  patNavPat = patIdx;
  const t = targets[patNavIdx];
  scrollToBit(t.r, t.p);
  say(`Паттерн строки ${patIdx + 1}: вхождение ${patNavIdx + 1} из ${targets.length} — строка ${t.r + 1}, бит ${t.p + 1}. Клик по нему же — к следующему.`);
}

const SLOT_OF = { leftPanel: 'leftSlot', rightPanel: 'rightSlot' };
/* Доля высоты дока, которую занимает пунктирная подсказка — держать в паре с height у
   .controls.drop-zone-hint::after в CSS. */
const DOCK_HINT_FRAC = 0.20;
function pidUnderCursor(x, y, precise) {
  for (let pid in SLOT_OF) {
    const el = document.getElementById(pid);
    const r = el.getBoundingClientRect();
    if (x < r.left || x > r.right) continue;
    // Пока идёт перетаскивание внутри окна, у доков висит .drop-zone-hint и нарисована ПУНКТИРНАЯ
    // полоса сверху. Ловим только её (плюс сами уже закреплённые панели — иначе не переставить
    // панель ниже по стопке): раньше хватало попадания по X, и пустой низ колонки утягивал панель
    // к себе, хотя пунктира там нет (запрос пользователя).
    if (el.classList.contains('drop-zone-hint') || el.classList.contains('drag-target')) {
      /* Полоса-подсказка при нижнем меню нарисована у НИЖНЕГО края дока (v1.095, запрос
         пользователя "эти внизу должны быть, когда полоса внизу меню" — доки там прибиты к низу,
         см. body.menubar-bottom .controls в CSS). Зона поимки обязана ехать вместе с пунктиром:
         иначе рамка рисуется внизу, а ловит по-прежнему верх — панель не берётся там, где её
         зовут, и берётся там, где ничего не показано. */
      const atBottom = document.body.classList.contains('menubar-bottom');
      const band = r.height * DOCK_HINT_FRAC;
      if (atBottom ? (y <= r.bottom && y >= r.bottom - band)
                   : (y >= r.top && y <= r.top + band)) return pid;
      const slot = document.getElementById(SLOT_OF[pid]);
      let overPanel = false;
      for (const ch of slot.children) {
        if (ch === draggedEl) continue;
        const cr = ch.getBoundingClientRect();
        if (cr.height && y >= cr.top && y <= cr.bottom) { overPanel = true; break; }
      }
      if (overPanel) return pid;
      continue;
    }
    // Подсказки нет (возврат панели из отдельного окна панелей) — прежнее поведение по колонке.
    if (!precise || (y >= r.top && y <= r.bottom)) return pid;
  }
  return null;
}
function highlightDock(pid) {
  for (let p in SLOT_OF) document.getElementById(p).classList.toggle('drag-target', p === pid);
}
function placeInZone(zone, y) {
  let after = Array.from(zone.children).find(ch => { if (ch === draggedEl) return false; let r = ch.getBoundingClientRect(); return y < r.top + r.height / 2; });
  if (after) { if (after !== draggedEl.nextSibling) zone.insertBefore(draggedEl, after); }
  else if (zone.lastElementChild !== draggedEl) zone.appendChild(draggedEl);
}

let draggedEl = null, dragOffX = 0, dragOffY = 0;
function makeDraggable(handle, panel) {
  function start(clientX, clientY) {
    draggedEl = panel; panel.classList.add('dragging');
    let r = panel.getBoundingClientRect(); dragOffX = clientX - r.left; dragOffY = clientY - r.top;
    document.body.style.cursor = 'grabbing';
    for (let p in SLOT_OF) document.getElementById(p).classList.add('drop-zone-hint');
  }
  handle.addEventListener('mousedown', e => {
    if (e.button !== 0) return; e.preventDefault(); e.stopPropagation();
    start(e.clientX, e.clientY);
  });
  handle.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) return; e.preventDefault(); e.stopPropagation();
    start(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: false });
}
function dragMove(clientX, clientY) {
  if (!draggedEl) return;
  let floatable = draggedEl.dataset.floatable === '1';
  let pid = pidUnderCursor(clientX, clientY, floatable);
  highlightDock(pid);
  let zone = pid ? document.getElementById(SLOT_OF[pid]) : null;
  if (floatable && !zone) {
    if (!draggedEl.classList.contains('floating-panel')) { draggedEl.classList.add('floating-panel'); document.body.appendChild(draggedEl); }
    draggedEl.style.left = Math.round(clientX - dragOffX) + 'px';
    draggedEl.style.top = Math.round(clientY - dragOffY) + 'px';
    return;
  }
  if (draggedEl.classList.contains('floating-panel')) { draggedEl.classList.remove('floating-panel'); draggedEl.style.left = ''; draggedEl.style.top = ''; }
  if (zone) placeInZone(zone, clientY);
}
function dragEnd() {
  if (!draggedEl) return;
  // Отпустили ПОВЕРХ окна панелей — панель переезжает туда (перетаскивание из окна в окно).
  if (panelsPopupAlive() && pointInWindowRect(panelsPopupWin, lastMouseScreen.x, lastMouseScreen.y)
      && !pointInWindowRect(window, lastMouseScreen.x, lastMouseScreen.y)) {
    const el = draggedEl; draggedEl = null;
    el.classList.remove('dragging');
    document.body.style.cursor = '';
    highlightDock(null);
    for (let p in SLOT_OF) document.getElementById(p).classList.remove('drop-zone-hint');
    sendPanelToPopup(el, lastMouseScreen.x, lastMouseScreen.y);
    updateDockVisibility(); updateToggleAllPinsBtn();
    return;
  }
  let mid = draggedEl.id.replace('panelWrap_', '');
  let zoneId = draggedEl.classList.contains('floating-panel') ? 'canvas' : (draggedEl.parentElement && draggedEl.parentElement.id);
  if (MENUS[mid]) {
    MENUS[mid].zone = zoneId;
    if ((zoneId === 'leftSlot' || zoneId === 'rightSlot') && !MENUS[mid].pin) {
      MENUS[mid].pin = true;
      let cb = document.getElementById(mid + 'Pin'); if (cb) cb.checked = true;
      let btn = document.querySelector('.menu-btn[data-menu="' + mid + '"]');
      if (btn) btn.classList.add('pinned');
      closeMenus();
    }
  }
  draggedEl.classList.remove('dragging'); draggedEl = null; saveLayout();
  document.body.style.cursor = '';
  highlightDock(null);
  for (let p in SLOT_OF) document.getElementById(p).classList.remove('drop-zone-hint');
  // Раньше звали только при ПЕРВОМ закреплении (внутри условия выше) — перетаскивание УЖЕ
  // закреплённой вкладки между левым/правым доком меняло занятость доков, но dock-empty (и,
  // следовательно, отступы #chainResultBox от них) не пересчитывались. Зовём всегда.
  updateDockVisibility(); updateToggleAllPinsBtn();
}
// Экранные координаты последнего движения мыши — нужны dragEnd(), чтобы понять, не отпустили ли
// панель ПОВЕРХ окна панелей (client-координаты для этого не годятся, см. pointInWindowRect).
// Пока кнопка зажата, события идут этому документу даже когда курсор ушёл на чужое окно.
let lastMouseScreen = { x: 0, y: 0 };
window.addEventListener('mousemove', e => {
  lastMouseScreen = { x: e.screenX, y: e.screenY };
  dragMove(e.clientX, e.clientY);
});
window.addEventListener('mouseup', e => {
  if (e && typeof e.screenX === 'number') lastMouseScreen = { x: e.screenX, y: e.screenY };
  dragEnd();
});
window.addEventListener('touchmove', e => {
  if (!draggedEl || !e.touches.length) return;
  e.preventDefault();
  dragMove(e.touches[0].clientX, e.touches[0].clientY);
}, { passive: false });
window.addEventListener('touchend', dragEnd);
window.addEventListener('touchcancel', dragEnd);

for (let mid in MENUS) makeDraggable(MENUS[mid].wrapper.querySelector('.panel-head'), MENUS[mid].wrapper);

function applyMenu(mid) {
  let m = MENUS[mid], drop = document.getElementById(mid);
  // Панель сейчас живёт в ОТДЕЛЬНОМ окне панелей — не выдёргиваем её оттуда ни в док, ни в
  // выпадающее меню (запрос пользователя: "при нажатии на меню вкладок они теряются"). Кнопка
  // вкладки в этом случае просто поднимает панель в том окне на передний план.
  if (panelInPopup(mid)) { focusPanelInPopup(mid); return; }
  let floating = m.wrapper.classList.contains('floating-panel');
  if (m.pin) {
    if (!floating) (document.getElementById(m.zone) || document.getElementById('leftSlot')).appendChild(m.wrapper);
  } else {
    if (floating) { m.wrapper.classList.remove('floating-panel'); m.wrapper.style.left = ''; m.wrapper.style.top = ''; floating = false; }
    drop.appendChild(m.wrapper);
  }
  let btn = document.querySelector('.menu-btn[data-menu="' + mid + '"]');
  if (btn) btn.classList.toggle('pinned', m.pin || floating);
  updateDockVisibility();
}
function hideTab(mid) {
  let m = MENUS[mid]; if (!m) return;
  m.pin = false;
  let cb = document.getElementById(mid + 'Pin'); if (cb) cb.checked = false;
  applyMenu(mid); closeMenus(); saveLayout(); updateToggleAllPinsBtn();
}
function isTabVisible(mid) {
  let m = MENUS[mid];
  return !!(m && (m.pin || m.wrapper.classList.contains('floating-panel')));
}
function updateDockVisibility() {
  ['leftPanel', 'rightPanel'].forEach(pid => {
    let p = document.getElementById(pid);
    p.classList.toggle('dock-empty', !p.querySelector('.menu-panel'));
  });
  updateResultBoxInset();
}

/* Бар #chainResultBox раньше просто перекрывал закреплённые слева/справа вкладки меню
   (высокий z-index). Теперь вместо перекрытия — подвигается: если в доке реально есть
   закреплённая панель (не dock-empty), бар отступает от него на его ширину (--side-w), а не
   рисуется поверх её кнопок.
   +12px было рассчитано на СТАРОЕ положение панелей (left/right:6px от края экрана + 6px
   зазор до бара). После того как у панелей убрали внешний отступ (left/right:0 — панели
   вплотную к краю), формула не пересчиталась и зазор стал вдвое больше нужного — теперь
   просто ширина панели + 6px зазора. */
function updateResultBoxInset() {
  const leftPanel = document.getElementById('leftPanel');
  const rightPanel = document.getElementById('rightPanel');
  if (!leftPanel || !rightPanel) return;
  const left = leftPanel.classList.contains('dock-empty') ? '6px' : 'calc(var(--side-w) + 6px)';
  const right = rightPanel.classList.contains('dock-empty') ? '6px' : 'calc(var(--side-w) + 6px)';
  document.querySelectorAll('.overlay-box').forEach(box => { box.style.left = left; box.style.right = right; });
}

for (let mid in MENUS) {
  // Галки может и не быть (новая вкладка, у которой ещё не завели свой чекбокс) — без проверки
  // это падение прямо на инициализации, и вся страница остаётся пустой. Ровно так и случилось,
  // когда вкладку "Правка столбцов" добавили в MENUS без её разметки в шапке.
  let cb = document.getElementById(mid + 'Pin');
  if (!cb) continue;
  cb.checked = MENUS[mid].pin;
  cb.addEventListener('mousedown', e => e.stopPropagation());
  cb.addEventListener('click', e => e.stopPropagation());
  cb.addEventListener('change', () => { MENUS[mid].pin = cb.checked; applyMenu(mid); saveLayout(); updateToggleAllPinsBtn(); });
}

function updateToggleAllPinsBtn() {
  let anyOn = Object.keys(MENUS).some(mid => isTabVisible(mid));
  let bar = document.getElementById('toggleAllPinsBtn');
  bar.classList.toggle('all-on', anyOn);
  // Подсказка обязана совпадать с тем, что кнопка реально делает (v0.894, запрос пользователя
  // "должна все панели показать, а не те, которые были до скрытия — исправь подсказку"): снимок
  // раскладки перед скрытием не снимается уже давно, показываются ВСЕ вкладки без исключения.
  bar.title = anyOn
    ? 'Скрыть все панели разом'
    : 'Показать ВСЕ панели — каждая вкладка закрепится в своём доке (не только те, что были видны до скрытия)';
}
/* Вынесено в отдельную функцию — запрос пользователя: то же самое действие, что и у кнопки
   📌, должно срабатывать ещё и по клику колёсиком мыши (средняя кнопка) — см. её обработчик
   ниже. */
function toggleAllPins() {
  let anyVisible = Object.keys(MENUS).some(mid => isTabVisible(mid));
  /* ВЕРХНЕЕ МЕНЮ ТОЖЕ ПРЯЧЕТСЯ (v1.001, запрос пользователя: "также, всё, и меню тоже, чисто
     биты оставим"). Раньше 📌/клик колёсиком прятали только боковые доки-вкладки — #menuBar
     (Вид/Шаг/Строк/... и кнопки сверху, включая саму кнопку 📌) оставался на месте. Теперь тем же
     действием уходит и он — остаётся голое полотно с битами. #menuBar при этом уходит через
     display:none, то есть вместе с видом пропадает и сама кнопка 📌 — но вернуть всё равно есть
     чем: клик колёсиком мыши работает где угодно на странице (обработчик висит на document, не
     на самой кнопке, см. её ниже), меню не нужно даже видеть. */
  document.body.classList.toggle("all-hidden", anyVisible);
  if (anyVisible) {
    for (let mid in MENUS) {
      MENUS[mid].pin = false;
      let cb = document.getElementById(mid + 'Pin'); if (cb) cb.checked = false;
      applyMenu(mid);
    }
  } else {
    /* ПОКАЗЫВАЕМ ВСЕ, А НЕ ТО, ЧТО БЫЛО (запрос пользователя: "эта должна всё скрывать и
       показать ВСЁ, а не то что было"). Раньше кнопка возвращала снимок раскладки, снятый перед
       скрытием: если до этого часть вкладок была не закреплена или висела плавающими окнами,
       "показать все" возвращало ровно ту же картину — то есть показывало не все. Теперь она
       просто закрепляет КАЖДУЮ вкладку в её доке. Снимок не снимается и в раскладку не пишется
       (v0.894 — вычищен вместе с pinsBeforeHideAll/snapshotTabsState/L.hideAllSnap). */
    for (let mid in MENUS) {
      MENUS[mid].pin = true;
      let cb = document.getElementById(mid + 'Pin'); if (cb) cb.checked = true;
      applyMenu(mid);
    }
    updateDockVisibility();
  }
  saveLayout();
  updateToggleAllPinsBtn();
}
document.getElementById('toggleAllPinsBtn').addEventListener('click', toggleAllPins);
/* Клик колёсиком мыши (средняя кнопка, button===1) — то же скрыть/показать все панели разом, и
   обратно повторным кликом — запрос пользователя. preventDefault на mousedown (не click/auxclick)
   — иначе браузер успевает показать свою иконку автопрокрутки колёсиком.
   ЗАЖАТОЕ КОЛЁСИКО + ВВЕРХ-ВНИЗ — МЕЖСТРОЧНЫЙ ОТСТУП (v0.999, запрос пользователя: "по колесику
   щелчку одиночному мыши — скрытие всех панелей, а при зажатом верх-вниз — межстрочный
   интервал"). Тот же приём, что и везде в проекте для разведения клика и протяжки: пока мышь не
   ушла на ДЕД_ПОРОГ px по вертикали, ничего не происходит; ушла — это уже не клик, а протяжка,
   и вместо переключения панелей крутится --chain-lh (см. makeLhVDrag() в fold-5-ui.js — тот же
   генератор, что и у Ctrl-вертикали на границах полей/протяжке бит). Отпустили БЕЗ протяжки —
   как раньше, простой клик колёсиком переключает все панели. */
document.addEventListener('mousedown', (e) => {
  if (e.button !== 1) return;
  e.preventDefault();
  const DEAD_PX = 4;
  const y0 = e.clientY;
  const lhDrag = (typeof makeLhVDrag === "function") ? makeLhVDrag(y0) : null;
  let moved = false;
  const move = ev => {
    if (!(ev.buttons & 4)) { up(); return; }   // колёсико отпустили мимо окна
    if (!moved && Math.abs(ev.clientY - y0) < DEAD_PX) return;
    moved = true;
    if (lhDrag) lhDrag(ev.clientY, true);
  };
  const up = () => {
    window.removeEventListener('mousemove', move);
    window.removeEventListener('mouseup', up);
    if (moved) { if (typeof saveCache === "function") saveCache(); }
    else toggleAllPins();
  };
  window.addEventListener('mousemove', move);
  window.addEventListener('mouseup', up);
});

(function loadLayout() {
  let raw = null; try { raw = localStorage.getItem(LAYOUT_KEY); } catch (e) {}
  let L = null; if (raw) { try { L = JSON.parse(raw); } catch (e) {} }
  // Разовая миграция порядка окон: смена значения по умолчанию («Черновик» наверх) сама по себе
  // ничего не даёт тем, у кого в localStorage уже лежит СТАРЫЙ порядок — он читается ниже и
  // перекрывает default (запрос пользователя: "порядок не изменился"). Флаг overlayOrderV2
  // взводится один раз: пока его нет, сохранённый порядок игнорируется и берётся новый default,
  // а дальше всё как раньше — перетаскивание за «⋮⋮» сохраняется и уважается.
  const overlayOrderMigrated = !!(L && L.overlayOrderV2);
  if (overlayOrderMigrated && Array.isArray(L.overlayOrder) && L.overlayOrder.length === overlayOrder.length
      && overlayOrder.every(id => L.overlayOrder.includes(id))) {
    overlayOrder = L.overlayOrder;
  }
  if (L && L.overlayHidden) {
    for (let id in overlayHidden) if (L.overlayHidden[id] !== undefined) overlayHidden[id] = !!L.overlayHidden[id];
  }
  // L.hideAllSnap из раскладок старее v0.894 просто игнорируется: "показать все" больше ничего
  // не восстанавливает по снимку, оно закрепляет все вкладки без исключения.
  if (L && L.pins) for (let m in MENUS) if (L.pins[m] !== undefined) { MENUS[m].pin = !!L.pins[m]; let cb = document.getElementById(m + 'Pin'); if (cb) cb.checked = MENUS[m].pin; }
  if (L && L.groups) for (let m in MENUS) { let wid = 'panelWrap_' + m; if (MENUS[m].pin && L.groups[wid] && L.groups[wid].z !== 'canvas') MENUS[m].zone = L.groups[wid].z; }
  for (let m in MENUS) applyMenu(m);

  if (L && L.groups) {
    let list = Object.keys(L.groups).map(id => ({ id: id, z: L.groups[id].z, i: L.groups[id].i, x: L.groups[id].x, y: L.groups[id].y })).sort((a, b) => (a.i || 0) - (b.i || 0));
    list.forEach(it => {
      let el = document.getElementById(it.id); if (!el) return;
      if (it.z === 'canvas' && el.dataset.floatable === '1') {
        el.classList.add('floating-panel'); document.body.appendChild(el);
        el.style.left = Math.max(0, Math.min(window.innerWidth - 40, it.x || 20)) + 'px';
        el.style.top = Math.max(0, Math.min(window.innerHeight - 40, it.y || 20)) + 'px';
        return;
      }
      let z = document.getElementById(it.z);
      if (z && el.parentElement === z) z.appendChild(el);
    });
  }
  // "Чисто биты" (v1.001) — верхнее меню при загрузке должно совпадать с тем, что было при
  // сохранении: все вкладки открепили и ушли в "чисто биты" — значит и #menuBar открывается уже
  // скрытым, а не мелькает на кадр перед тем, как toggleAllPins() его спрячет по клику.
  document.body.classList.toggle("all-hidden", !Object.keys(MENUS).some(mid => isTabVisible(mid)));
  updateToggleAllPinsBtn();
})();

/* === МАРКЕР 10.2b: OVERLAY_STACK === */
/* Стек overlay-баров #chainResultBox/#stepLogBox: раскладывает их друг под другом по текущему
   overlayOrder (top в px, вычисляется от суммы высот предыдущих + зазор), держит --result-box-h
   в актуальном виде (сумма высот обеих + зазор между ними), чтобы .canvas резервировал верхний
   отступ (padding-top: calc(6px + var(--result-box-h))) и строки таблицы не уезжали под бары. */
const OVERLAY_GAP = 6;
/* ВИД ЗАПРЕЩЁННЫХ ЦЕНТРАЛЬНОМУ ПОЛЮ ВЫРАВНИВАНИЙ (v0.971). Гасит в полосе те кнопки, которые
   fieldAlignAllowed("C", ...) не пропускает, и — если сохранённое состояние пришло с запрещённым
   выравниванием (кэш от версии до запрета) — молча уводит поле на "по центру". Без этого запрет
   был бы только на новых кликах, а старая настройка так и висела бы. */
function syncAlignBanned(){
  const grp = document.getElementById("alignGrp");
  if (!grp) return;
  /* ЗАПРЕТ СЧИТАЕТСЯ ПО ПРИЁМНИКУ (v0.976). Пока полоса бьёт в центр — как было, ⇤/⇥ погашены.
     Переключили приёмник на П1/П2 — запрет их не касается, и обе кнопки оживают прямо в полосе.
     Осевые всегда адресованы центру, поэтому их состояние от приёмника не зависит. */
  const tgt = (typeof alignTarget === "string") ? alignTarget : "C";
  grp.querySelectorAll("button[data-val]").forEach(b => {
    const v = b.getAttribute("data-val");
    b.classList.toggle("align-banned", !fieldAlignAllowed(isAxisAlign(v) ? "C" : tgt, v));
  });
  if (!fieldAlignAllowed("C", st.align)) st.align = "center";
  // Отметку "act" ставит одно место на всю программу — она зависит от приёмника (см. fold-5-ui.js).
  if (typeof syncAlignActMarks === "function") syncAlignActMarks();
  // Кнопка-индикатор приёмника (v1.003) — текст и подсветка всегда отражают actual alignTarget,
  // откуда бы он ни поменялся (авто-следом за кликом по битам или ручным кругом по кнопке).
  const indEl = document.getElementById("bAlignTargetInd");
  if (indEl && typeof ALIGN_TARGET_LABEL === "object") {
    indEl.textContent = ALIGN_TARGET_LABEL[tgt] || "Ц";
    indEl.classList.toggle("align-target-on", tgt !== "C");
  }
  /* ПРИЁМНИК ПОКАЗЫВАЮТ ПОДПИСИ ПЛАНОК (v1.088). Кнопка-индикатор выше из полосы убрана (запрос
     пользователя), и «какое поле сейчас правит полоса» читается прямо у поля: подсвечена подпись
     «П1», «Ц» или «П2». Кнопки в разметке больше нет, но обращение к ней оставлено через if —
     сломать оно ничего не может, а вернуть её при желании можно одной строкой в HTML. */
  for (const [stripId, f] of [["patStripL", "L"], ["axisStrip", "C"], ["patStripR", "R"]]) {
    const el = document.getElementById(stripId);
    const lab = el ? el.querySelector(".pat-strip-lab") : null;
    if (lab) lab.classList.toggle("align-target-on", tgt === f);
  }
}

/* Перенос группы выравниваний (#alignGrp) из холста (.chain) в .main-layout — запрос
   пользователя: она должна висеть плавающей полосой ПОВЕРХ баров «Результат»/«Черновик», сразу
   под верхним меню. Перенос нужен именно в DOM, а не только в CSS: position:absolute считается от
   ближайшего позиционированного предка, и, останься элемент внутри холста, полоса уезжала бы
   вместе с содержимым при скролле — а .overlay-box'ы позиционируются как раз от .main-layout.
   Инлайновые margin/width из разметки снимаем — теперь положение задаёт CSS (top/left/transform),
   а прежний "margin:0 auto" центрировал его как блок в потоке, чего больше нет. */
{
  const alignGrpEl = document.getElementById("alignGrp");
  const mainLayoutEl = document.querySelector(".main-layout");
  if (alignGrpEl && mainLayoutEl) {
    alignGrpEl.style.margin = "";
    alignGrpEl.style.width = "";
    mainLayoutEl.appendChild(alignGrpEl);
  }
}
/* Кто реально стоит в стопке: не скрытые крестиком (overlayHidden) и не вынесенные в отдельное
   окно (.popped-out, см. syncPopoutBoxes) — у вынесенных ни места, ни зазора не занимается. */
function overlayStackIds(){
  return overlayOrder.filter(id => {
    if (overlayHidden[id]) return false;
    const el = document.getElementById(id);
    return !(el && el.classList.contains("popped-out"));
  });
}
/* Отступ, с которого начинается стопка overlay-баров и полоса выравниваний (v0.969). Раньше
   было просто 6 — полоса меню стояла В ПОТОКЕ и своё место занимала сама. Теперь она плавающая
   и прозрачная (position:fixed, см. блок "ПРОЗРАЧНАЯ ШАПКА" в конце стилей), полотно начинается
   от самого верха экрана — и всё, что не отодвинуть, ушло бы прямо под кнопки. Высоту берём из
   той же переменной --menubar-h, которой задана и сама полоса, чтобы два числа не разъезжались. */
/* Когда полоса меню внизу экрана (menubar-bottom, см. setMenuBarBottom в fold-5-ui.js), запас
   --menubar-h сверху больше не нужен — там никакой полосы нет, и стопка баров/#alignGrp могут
   встать с самого верха (запрос пользователя: "сместить на самый верх", когда меню внизу). */
function overlayTopBase(){
  if (document.body.classList.contains("menubar-bottom")) return 6;
  const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--menubar-h"));
  return 6 + (v > 0 ? v : 42);
}
function layoutOverlayBoxes(){
  const visible = overlayStackIds();
  let top = overlayTopBase(), stackH = 0;
  visible.forEach((id, i) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.top = top + 'px';
    const h = el.offsetHeight;
    top += h + OVERLAY_GAP;
    stackH += h + (i < visible.length - 1 ? OVERLAY_GAP : 0);
  });
  // Полоса выравниваний (#alignGrp) стоит ПОД стопкой баров и СРАЗУ НАД первой строкой цепочки,
  // то есть занимает своё собственное место сверху — раньше она висела ПОВЕРХ баров, и её нижний
  // край накрывал ручку изменения высоты "Результата", тянуть которую становилось нечем (запрос
  // пользователя: "окно результат немного выдвинь вниз за эти кнопки, чтоб можно было его там
  // тянуть вниз"). Поэтому отступ холста = низ полосы, а не max(стопка, полоса).
  const alignGrpEl = document.getElementById("alignGrp");
  const alignTop = positionAlignGrpTop();
  const alignH = alignGrpEl ? alignGrpEl.offsetHeight : 0;
  document.documentElement.style.setProperty('--result-box-h', Math.round(alignTop + alignH + 2) + 'px');
}

/* Высота полосы выравниваний (#alignGrp, v0.839): она идёт СЛЕДУЮЩЕЙ за стопкой баров, поэтому
   её top считается тем же счётом, что и top каждого бара, — сумма высот видимых баров плюс
   зазоры. Никаких getBoundingClientRect: функция вызывается в том числе из ResizeObserver, а
   принудительный замер там лишний. Возвращает свой top — его же берёт --result-box-h.
   Отдельной функцией — потому что двигать полосу нужно не только на render()
   (updateAxisSplitPosition() зовёт её же), но и на КАЖДОЕ изменение стопки: высоту "Результата"
   тянут мышью, и без этого вызова полоса догоняла бы строки только следующей перерисовкой
   (запрос пользователя: "тупит, пусть уезжает сразу вместе со строками"). */
function positionAlignGrpTop(){
  let top = overlayTopBase(); // тот же старт, что у стопки баров, — см. overlayTopBase()
  overlayStackIds().forEach(id => {
    const b = document.getElementById(id);
    if (b) top += b.offsetHeight + OVERLAY_GAP;
  });
  const el = document.getElementById("alignGrp");
  /* ПОЛОСА ПОДНЯТА НАД ПЛАНКАМИ ПОЛЕЙ (v1.087, запрос пользователя: "накладываются, подвинь вверх
     меню"). С v1.085 планки «П1»/«Ц»/«П2» стоят НАД верхней чертой поля, то есть в той же полосе,
     где кончается #alignGrp, — и налезали на её кнопки.
     Поднимаем полосу ровно на высоту планки. ВАЖНО: возвращаем при этом top НИЖНЕГО края полосы
     ПЛЮС подъём — по нему считается --result-box-h, то есть верхний отступ холста (см. вызывающую
     layoutOverlayBoxes). Не поднимай холст вслед за полосой: строки уехали бы вверх вместе с ней,
     планки — за строками, и наложение вернулось бы ровно туда же. А так между низом полосы и
     холстом открывается пустая полоса высотой в планку — в ней планки и стоят.
     ПОТОЛОК (v1.091, запрос пользователя "меню наложились"): подъём не должен загонять полосу под
     саму шапку меню. Когда стопка баров пуста, свой top у полосы всего 6+--menubar-h, и подъём на
     планку уносил её ВЫШЕ нижнего края шапки — кнопки выравниваний оказывались под ней. Ниже
     шапки полосу не пускаем; когда меню внизу экрана (menubar-bottom) потолок — просто 2px.
     Если подъём упёрся в потолок, холст всё равно отодвигаем на полную высоту планки — пустая
     полоса под кнопками сохраняется, планкам есть куда встать. */
  const strip = document.getElementById("axisStrip");
  const lift = (strip && strip.offsetHeight) ? (strip.offsetHeight + 4) : 0;
  const ceil = overlayTopBase() - 4; // низ шапки меню + 2px (или 2px, если меню внизу)
  if (el) el.style.top = Math.round(Math.max(ceil, top - lift)) + "px";
  return Math.max(ceil, top - lift) + lift;
}
// Подсветка mode-act — ПОКА ОКНО ВИДНО (!hidden), а не пока скрыто — запрос пользователя
// ("наоборот, когда выключены — не подсвечивать надо").
function setOverlayHidden(id, hidden){
  overlayHidden[id] = hidden;
  const el = document.getElementById(id);
  if (el) el.classList.toggle('hidden', hidden);
  const btnId = id === 'chainResultBox' ? 'bToggleResultBox' : 'bToggleStepLog';
  const btn = document.getElementById(btnId);
  if (btn) btn.classList.toggle('overlay-on', !hidden);
  layoutOverlayBoxes();
  saveLayout();
}
for (let id in overlayHidden) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle('hidden', overlayHidden[id]);
  const btnId = id === 'chainResultBox' ? 'bToggleResultBox' : 'bToggleStepLog';
  const btn = document.getElementById(btnId);
  if (btn) btn.classList.toggle('overlay-on', !overlayHidden[id]);
}
const bHideResultBoxEl = document.getElementById('bHideResultBox');
if (bHideResultBoxEl) bHideResultBoxEl.addEventListener('click', e => { e.stopPropagation(); setOverlayHidden('chainResultBox', true); });
const bHideStepLogEl = document.getElementById('bHideStepLog');
if (bHideStepLogEl) bHideStepLogEl.addEventListener('click', e => { e.stopPropagation(); setOverlayHidden('stepLogBox', true); });
const bToggleResultBoxEl = document.getElementById('bToggleResultBox');
if (bToggleResultBoxEl) bToggleResultBoxEl.onclick = () => setOverlayHidden('chainResultBox', !overlayHidden.chainResultBox);
const bToggleStepLogEl = document.getElementById('bToggleStepLog');
if (bToggleStepLogEl) bToggleStepLogEl.onclick = () => setOverlayHidden('stepLogBox', !overlayHidden.stepLogBox);

if (window.ResizeObserver) {
  const ro = new ResizeObserver(() => layoutOverlayBoxes());
  overlayOrder.forEach(id => { const el = document.getElementById(id); if (el) ro.observe(el); });
}
layoutOverlayBoxes();

/* Клик по шапке "Черновика" — свернуть/развернуть в одну строку (та же логика, что у шапки
   "Результата" выше — chainResultHeadEl), не путать с ✕ (то ПОЛНОСТЬЮ скрывает). */
const stepLogHeadEl = document.querySelector('#stepLogBox .step-log-head');
if (stepLogHeadEl) {
  stepLogHeadEl.onclick = (e) => {
    if (e.target.closest('button') || e.target.closest('.overlay-drag') || e.target.closest('.overlay-close')) return;
    document.getElementById('stepLogBox').classList.toggle('collapsed');
  };
}

/* Перетаскивание за ⋮⋮ — меняет местами #chainResultBox/#stepLogBox по вертикали (только
   порядок в overlayOrder, ширина/left/right остаются авто, никакого свободного позиционирования).
   Порог срабатывания — курсор пересёк вертикальную середину ДРУГОГО бара. */
let overlayDragId = null, overlayDragMoved = false;
document.querySelectorAll('.overlay-drag').forEach(handle => {
  handle.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    overlayDragId = handle.closest('.overlay-box').id;
    overlayDragMoved = false;
  });
});
window.addEventListener('mousemove', e => {
  if (!overlayDragId) return;
  overlayDragMoved = true;
  const otherId = overlayOrder.find(id => id !== overlayDragId);
  const otherEl = document.getElementById(otherId);
  if (!otherEl) return;
  const r = otherEl.getBoundingClientRect();
  const overOther = e.clientY >= r.top && e.clientY <= r.bottom;
  otherEl.classList.toggle('drag-target', overOther);
});
window.addEventListener('mouseup', e => {
  if (!overlayDragId) return;
  const draggedId = overlayDragId;
  overlayDragId = null;
  document.querySelectorAll('.overlay-box.drag-target').forEach(el => el.classList.remove('drag-target'));
  if (!overlayDragMoved) return;
  const otherId = overlayOrder.find(id => id !== draggedId);
  const otherEl = document.getElementById(otherId);
  if (!otherEl) return;
  const r = otherEl.getBoundingClientRect();
  if (e.clientY >= r.top && e.clientY <= r.bottom) {
    overlayOrder.reverse();
    layoutOverlayBoxes();
    saveLayout();
  }
});

document.querySelectorAll('.menu-btn').forEach(btn => {
  let mid = btn.dataset.menu;
  btn.addEventListener('click', e => {
    e.stopPropagation();
    if (e.detail > 1) return;
    let m = MENUS[mid];
    // Панель уехала в отдельное окно — клик по вкладке просто показывает её там (а не тащит
    // обратно в выпадающее меню, где она раньше "терялась").
    if (panelInPopup(mid)) { focusPanelInPopup(mid); return; }
    if (m && (m.pin || m.wrapper.classList.contains('floating-panel'))) {
      hideTab(mid);
      return;
    }
    let drop = document.getElementById(mid); let wasOpen = drop.classList.contains('open');
    document.querySelectorAll('.menu-drop').forEach(d => d.classList.remove('open'));
    document.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('open'));
    if (!wasOpen) { drop.style.left = Math.min(btn.offsetLeft, Math.max(0, window.innerWidth - 330)) + 'px'; drop.classList.add('open'); btn.classList.add('open'); }
  });
  btn.addEventListener('dblclick', e => {
    e.stopPropagation();
    let m = MENUS[mid]; if (!m) return;
    if (panelInPopup(mid)) { focusPanelInPopup(mid); return; }
    if (m.wrapper.classList.contains('floating-panel')) { m.wrapper.classList.remove('floating-panel'); m.wrapper.style.left = ''; m.wrapper.style.top = ''; }
    let leftH = document.getElementById('leftSlot').scrollHeight, rightH = document.getElementById('rightSlot').scrollHeight;
    m.zone = (leftH <= rightH) ? 'leftSlot' : 'rightSlot';
    m.pin = true;
    let cb = document.getElementById(mid + 'Pin'); if (cb) cb.checked = true;
    applyMenu(mid); closeMenus(); saveLayout(); updateToggleAllPinsBtn();
  });
});
document.querySelectorAll('.menu-drop').forEach(d => { d.addEventListener('mousedown', e => e.stopPropagation()); d.addEventListener('click', e => e.stopPropagation()); });
function closeMenus() { document.querySelectorAll('.menu-drop').forEach(d => d.classList.remove('open')); document.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('open')); }
window.addEventListener('mousedown', e => { if (!e.target.closest('.menu-drop') && !e.target.closest('.menu-btn')) closeMenus(); });

/* === МАРКЕР 10.3: ЛОГИКА СДВИГА И ХОТКЕИ === */
/* "⧬ Интерлив сквозной"/"⨁ XOR сквозной" не имели понятного способа "выйти" из поиска руками —
   нажатие ⏹ Стоп останавливает "Авто", но флаг режима (и подсветка кнопки) сами по себе не
   гаснут (см. запрос пользователя — "непонятно как сбрасывать при остановке"). Проще всего —
   считать ЛЮБОЕ ручное переключение выделения строки сигналом "я закончил с этим поиском":
   вызывается из .onclick/mousedown ниже. Заодно чистим st.lastOp (Черновик последнего шага) —
   у этих режимов он ЖИВОЙ (см. recomputeSeqStepDisplay()/op.seqStepInfo): пересчитывается на
   каждый render() по сохранённым idx/tryRow/offset НЕЗАВИСИМО от того, активен ли ещё сам режим,
   поэтому без явной чистки Черновик (и синяя подсветка бит строки в нём) продолжал бы жить и
   обновляться даже после остановки (см. запрос пользователя — "не сбрасывает черновик"). */
function resetSeqSearchModes(){
  if (st.interleaveSeqMode || st.xorSeqMode || (st.lastOp && st.lastOp.seqStepInfo)) {
    if (st.interleaveSeqMode) stopInterleaveSeq();
    if (st.xorSeqMode) stopXorSeq();
    st.lastOp = null;
  }
}

document.getElementById("rows").onclick = e => {
  // ВСТАВКА (v1.068) — по ней тянут, а не выделяют: клик, пришедший после её перетаскивания, не
  // должен заодно переставить выделение на строку, над которой её отпустили. И в режиме «▭ Выбор
  // ячеек» тоже: попасть по вставке — это попасть по вставке, а не по биту под ней.
  if (e.target.closest && e.target.closest(".paste-bits")) { e.stopPropagation(); return; }
  /* ЯРЛЫК ГРУППЫ (v1.062) — раньше всех проверок: это не выделение, а действие над самой группой,
     и работать оно должно даже там, где выделение выключено или занято другим режимом (🔒, выбор
     ячеек, «✂ Перенос строк»). Клик по нему до строки не доходит — иначе тот же клик заодно
     переставил бы выделение на рамку. */
  const badge = e.target.closest && e.target.closest(".grp-badge");
  if (badge) {
    e.stopPropagation();
    dissolveGroupAt(badge.dataset.grpFld, +badge.dataset.grpRow);
    return;
  }
  // "🔒 Выделение" выключено — полотно только двигают, ничего не выделяют (см. selectionAllowed).
  if (!selectionAllowed()) return;
  // Режим "▭ Выбор ячеек" — клики по полотну собирают ЯЧЕЙКИ и не должны трогать выделение СТРОК
  // (запрос пользователя: режим "автоматически снимает все выделения строк"). mousedown мы уже
  // перехватываем на фазе захвата, но следом браузер шлёт click — вот он и переключал строки.
  if (cellSelMode) return;
  // Игнорируем клики по текстовым полям редактирования
  if (e.target.tagName === "INPUT" || e.target.closest(".edit-row-input")) return;
  // Протяжка мышью (см. ниже) уже выставила диапазон выделения сама — обычный click,
  // который браузер шлёт следом за mouseup, не должен схлопывать его обратно к одной строке.
  if (rowDragMoved) return;
  // Тем же манером: строку ТАЩИЛИ, двигая поле (v0.976) — это перемещение картинки, а не выбор.
  if (fieldPanMoved) return;
  // Двойной клик (вход в ручную правку строки, см. dblclick ниже) технически шлёт ДВА click
  // подряд по той же строке — второй (e.detail===2) иначе попадал в ветку "повторный клик по
  // уже выделенной строке -> снять выделение" и стирал выделение ДО открытия поля правки, из-за
  // чего фоновый поиск (завязан на выделенную строку) переставал видеть контекст. Второй и
  // последующие клики серии игнорируем — выделение трогает только одиночный клик.
  if (e.detail > 1) return;

  const ln = e.target.closest(".ln");
  if (!ln) return;

  const idx = +ln.dataset.idx;
  if (isNaN(idx)) return;

  // КОЛОНКА ПАТТЕРНОВ — только своё выделение паттернов, строки цепочек ею НЕ выделяются вовсе
  // (запрос пользователя). Выход здесь БЕЗУСЛОВНЫЙ: даже клик по пустой ячейке паттерна не должен
  // проваливаться в выделение строки — иначе колонка ведёт себя по-разному в зависимости от того,
  // есть в этой строке паттерн или нет. Переключаем только там, где паттерн реально есть.
  // Этим выделением сужается список того, что ищет "🌈 Все паттерны": выделено хоть что-то —
  // ищутся только выделенные, пусто — все, как и раньше (см. findAllPatternsInResult).
  // Правило то же, что у выделения СТРОК (запрос пользователя): обычный клик выделяет РОВНО ОДИН
  // паттерн, сбрасывая прежний набор; повторный клик по единственному выделенному — снимает
  // выделение. Набрать несколько можно двумя способами — протяжкой (см. mousemove ниже) или
  // Ctrl/Cmd+кликом (точечно добавить/убрать). Раньше обычный клик просто переключал ячейку, и
  // набор молча накапливался.
  if (e.target.closest(".pat, .pat2")) {
    // 🔏 Паттерны заморожены (v1.057, третий режим кнопки-замка) — ячейки не выделяются вовсе,
    // хотя строки цепочки рядом продолжают работать. См. patsEditAllowed() в fold-1-core.js.
    if (!patsEditAllowed()) return;
    if (patDragMoved) return; // протяжка уже выставила набор — не схлопывать его обратно к одному
    // ПУСТЫЕ ЯЧЕЙКИ ТОЖЕ ВЫДЕЛЯЮТСЯ (запрос пользователя: "чтобы в паттернах тоже можно было
    // выбрать 0 строку"). Раньше условие было `st.pats[idx].text` — и нулевая строка (её паттерн
    // всегда пуст, см. ensureZeroRow) не выделялась вовсе, а значит её нельзя было и удалить
    // кнопкой "🗑 Паттерн". На поиск это не влияет: "🌈 Все паттерны" и подсказки смотрят на
    // НЕПУСТЫЕ выделенные (anyNonEmpty), пустая ячейка в наборе им не мешает.
    if (st.pats[idx]) {
      if (!st.selectedPats) st.selectedPats = new Set();
      if (e.ctrlKey || e.metaKey) {
        if (st.selectedPats.has(idx)) st.selectedPats.delete(idx);
        else st.selectedPats.add(idx);
      } else if (st.selectedPats.has(idx)) {
        /* КЛИК ПО УЖЕ ВЫДЕЛЕННОМУ ПАТТЕРНУ СНИМАЕТ ЕГО (v1.089, запрос пользователя: "одинарный
           клик по выделенному паттерну — пусть снимает его").
           С v0.95x повторный клик выделение НЕ снимал: за ним закрепили переход к СЛЕДУЮЩЕМУ
           вхождению этого паттерна в строках (patNavStep ниже), а снимать предлагалось Ctrl+кликом.
           Причина была не в удобстве, а в производительности: набор выделенных входит в ключ
           memo-кэша поиска, и мигание «выделил — снял» на каждый второй клик заново перелопачивало
           ВЕСЬ список паттернов (с «🧩 Макс. часть» это подвисало).
           Сейчас снятие важнее: выделение паттернов сужает область поиска («🌈 Все паттерны» ищет
           только выделенные), и выйти из этого сужения тем же кликом, которым в него вошёл, —
           единственное очевидное движение. Переход к следующему вхождению остаётся за повторным
           кликом по НЕвыделенному (то есть после снятия — следующий клик снова ведёт к находке).
           Снимаем именно ЭТОТ паттерн, а не весь набор: при нескольких выделенных (протяжкой) клик
           по одному из них убирает из набора его одного, остальные остаются. */
        st.selectedPats.delete(idx);
        render();
        saveCache();
        return;
      } else {
        st.selectedPats.clear();
        st.selectedPats.add(idx);
      }
      render();
      saveCache();
      // ...и сразу ведём к вхождению этого паттерна в строках; клик по нему же — к следующему
      // (см. patNavStep). render() выше уже пересчитал подсветку, по которой мы и переходим.
      // У пустой ячейки искать нечего — переход пропускаем, выделение при этом остаётся.
      if (st.pats[idx].text) patNavStep(idx);
    }
    return;
  }

  resetSeqSearchModes();
  // Новый клик по строке — новая "сессия" кругового сдвига, счётчик "Вар: N/M" начинается заново.
  st.manualShiftTurns = 0;
  st.shiftVariantTotal = null;
  st.shiftVariantRows = null;
  // ...и выделение снова считается набранным ВРУЧНУЮ: выросло оно до этого захватом или нет —
  // теперь неважно, дальше действует обычное правило окна (см. captureFoundRow/st.captureGrown).
  st.captureGrown = false;

  if (!st.selectedRows) st.selectedRows = new Set();

  if (e.ctrlKey || e.metaKey) {
    if (st.selectedRows.has(idx)) st.selectedRows.delete(idx);
    else st.selectedRows.add(idx);
  } else {
    if (st.selectedRows.size === 1 && st.selectedRows.has(idx)) {
      st.selectedRows.clear();
    } else {
      st.selectedRows.clear();
      st.selectedRows.add(idx);
    }
  }
  updateVariantCounter();
  // "🖱 По выделению: достраивать" — верх сразу приводится к новому выделению (запрос
  // пользователя: "если выделение переключить, то как бы всё убирает и снова строит по новому").
  // Выделение при этом не двигаем (keepSel), иначе клик уводил бы его на следующую строку.
  // buildTopMirror сама зовёт render()/saveCache(), поэтому дальше просто выходим.
  if (st.topBuildOnSelect && st.selectedRows && st.selectedRows.size) {
    buildTopMirror(st.topBuildMode || "rebuild", true);
    return;
  }
  render();
  saveCache();
};

/* Выделение НЕСКОЛЬКИХ строк протяжкой мыши (зажать и провести по строкам). Обычный клик
   без движения по-прежнему обрабатывается выше (.onclick) — сюда попадает только реальный
   драг: mousedown запоминает строку-якорь, mousemove по другим строкам красит диапазон
   [якорь..курсор] целиком, mouseup фиксирует. Ctrl/Cmd+клик оставлен как раньше — точечное
   добавление/снятие одной строки без протяжки. */
let rowDragAnchor = null, rowDragMoved = false;
/* Протяжка по КОЛОНКЕ ПАТТЕРНОВ — выделяет несколько паттернов подряд (запрос пользователя),
   ровно тем же жестом, каким протяжка по самой строке выделяет диапазон строк. Якорь и признак
   реального движения держатся отдельно от строчных: колонка паттернов к выделению строк не
   причастна совсем. */
let patDragAnchor = null, patDragMoved = false;
document.getElementById("rows").addEventListener("mousedown", e => {
  // Ярлык группы (v1.062) и вставка (v1.068) — по ним кликают/тянут ИХ, а не строки: якорь протяжки
  // не ставим, иначе то же нажатие заодно начало бы выделять строки. Обработчик вставки висит на
  // этом же #rows и зарегистрирован ПОЗЖЕ (fold-4 грузится после fold-3), поэтому его
  // stopPropagation сюда не успевает — проверку надо повторить здесь.
  if (e.target.closest && e.target.closest(".grp-badge, .paste-bits")) return;
  if (!selectionAllowed()) return; // "🔒 Выделение" выключено — протяжка по строкам не выделяет

  if (cellSelMode) return; // в режиме выбора ячеек протяжка выделяет ЯЧЕЙКИ, а не диапазон строк
  // В режиме "✂ Перенос строк" протяжка двигает линии раскроя (см. wrapDrag в fold-4), а не
  // выделяет строки — иначе одно движение мыши делало бы сразу два дела.
  if (typeof wrapModeOn === "function" && wrapModeOn()) return;
  if (e.target.tagName === "INPUT" || e.target.closest(".edit-row-input")) return;
  if (e.ctrlKey || e.metaKey || e.button !== 0) return;
  const ln = e.target.closest(".ln");
  if (!ln) return;
  const idx = +ln.dataset.idx;
  if (isNaN(idx)) return;
  // Начали в колонке паттернов — это протяжка ПАТТЕРНОВ. Строчный якорь при этом не ставим вовсе,
  // иначе то же движение мыши заодно красило бы диапазон строк.
  if (e.target.closest(".pat, .pat2")) {
    // 🔏 Паттерны заморожены — якорь не ставим, значит и протяжки по колонке не будет (v1.057).
    // return без якоря, а не проверка внутри mousemove: так жест просто не начинается.
    if (!patsEditAllowed()) return;
    patDragAnchor = idx;
    patDragMoved = false;
    dragOverRowsOn();
    return;
  }
  rowDragAnchor = idx;
  rowDragMoved = false;
  dragOverRowsOn();
});
/* ═══ ПЛАШКА УВЕДОМЛЕНИЙ НЕ ЛОВИТ МЫШЬ, ПОКА ТЯНУТ ВЫДЕЛЕНИЕ (испр. v1.075) ═══
   Баг-репорт пользователя: "при ручном выделении, последовательно увеличивая строки протяжкой
   вниз — если находится паттерн в нижней строке, то обрывается всё выделение, не даёт дальше
   выделять".
   Причина не в самом выделении и не в правиле окна (captureFoundRow): протяжка добирает строки по
   e.target.closest(".ln") — то есть по тому, что физически под курсором. А #msg стоит
   position:fixed внизу по центру и в показанном виде ловит мышь (#msg.show{pointer-events:auto} —
   по плашке кликают, чтобы гонять её по углам). Находка эту плашку и показывает. Тянут выделение
   ВНИЗ, ровно на неё: курсор уезжает на плашку, closest(".ln") отдаёт null, mousemove выходит по
   первой же проверке — и строки перестают добираться. Со стороны выглядит как «находка оборвала
   выделение», хотя выделение цело, просто до строк под плашкой не дотянуться.
   Гасим приём мыши НА ВРЕМЯ ПРОТЯЖКИ. Насовсем нельзя — плашку кликают намеренно. Класс на body, а
   не стиль на элементе: плашка живёт своей жизнью (say() зовут отовсюду, в том числе прямо во время
   протяжки), и перебивать ей inline-стиль значило бы гоняться за ней. */
function dragOverRowsOn(){ document.body.classList.add("row-dragging"); }
function dragOverRowsOff(){ document.body.classList.remove("row-dragging"); }
window.addEventListener("mouseup", dragOverRowsOff);
/* КАКАЯ СТРОКА ПОД КУРСОРОМ — НЕ ПО e.target, А ПО КООРДИНАТЕ (испр. v1.078, баг-репорт
   пользователя: "тяну выделение вниз с 1 строки, включаю 2,3,4… на 5 находится паттерн, дальше
   тяну вниз на 6, 7 — выделение не идёт").
   Оба обработчика протяжки висели на #rows и спрашивали e.target.closest(".ln"). Пока над строками
   пусто, это одно и то же; но стоит находке ПОКАЗАТЬ что-нибудь плавающее поверх полотна (плашка
   уведомления, окно «Результат», любая всплывшая панель) — и всё ломается сразу с двух сторон:
   e.target становится этим окном, а главное — mousemove над ним до #rows ВООБЩЕ НЕ ДОЛЕТАЕТ,
   потому что окно не потомок #rows и всплытию идти некуда. Протяжка молча замирала ровно на той
   строке, где случилась находка, и «дальше не шла».
   Гасить pointer-events у каждого такого окна по одному — бесконечная игра в догонялки (в v1.075
   так закрыли только #msg, а окон больше). Поэтому: слушаем window (событие доходит всегда) и
   строку ищем по СТОПКЕ элементов под курсором — elementsFromPoint отдаёт не только верхний
   элемент, но и всё, что под ним, так что .ln находится и сквозь накрывшее её окно.
   Дорогой путь (elementsFromPoint) идёт только когда дешёвый не сработал, то есть в норме его нет
   вовсе. */
function lnAtPoint(e){
  const direct = e.target && e.target.closest ? e.target.closest(".ln") : null;
  if (direct) return direct;
  if (!document.elementsFromPoint) return null;
  for (const el of document.elementsFromPoint(e.clientX, e.clientY)) {
    const ln = el.closest ? el.closest(".ln") : null;
    if (ln) return ln;
  }
  return null;
}
window.addEventListener("mousemove", e => {
  if (patDragAnchor === null || !(e.buttons & 1)) return;
  const ln = lnAtPoint(e);
  if (!ln) return;
  const idx = +ln.dataset.idx;
  if (isNaN(idx) || (idx === patDragAnchor && !patDragMoved)) return;
  patDragMoved = true;
  const lo = Math.min(patDragAnchor, idx), hi = Math.max(patDragAnchor, idx);
  // Протяжка ЗАДАЁТ набор заново (как и у строк), а не добавляет к прежнему. Пустые ячейки в
  // диапазон не попадают — выделять там нечего.
  st.selectedPats = new Set();
  for (let i = lo; i <= hi; i++) if (st.pats[i] && st.pats[i].text) st.selectedPats.add(i);
  render();
});
window.addEventListener("mouseup", () => {
  if (patDragAnchor === null) return;
  if (patDragMoved) saveCache();
  patDragAnchor = null;
  // Сброс через setTimeout — click браузер шлёт ПОСЛЕ mouseup, и он должен успеть увидеть флаг
  // (тот же приём, что и у строчной протяжки ниже).
  setTimeout(() => { patDragMoved = false; }, 0);
});
window.addEventListener("mousemove", e => {
  if (rowDragAnchor === null || !(e.buttons & 1)) return;
  const ln = lnAtPoint(e);   // см. lnAtPoint выше — строка ищется и сквозь накрывшее её окно
  if (!ln) return;
  const idx = +ln.dataset.idx;
  if (isNaN(idx) || (idx === rowDragAnchor && !rowDragMoved)) return;
  if (!rowDragMoved) resetSeqSearchModes();
  rowDragMoved = true;
  const lo = Math.min(rowDragAnchor, idx), hi = Math.max(rowDragAnchor, idx);
  st.selectedRows = new Set();
  for (let i = lo; i <= hi; i++) st.selectedRows.add(i);
  render();
});
window.addEventListener("mouseup", () => {
  if (rowDragAnchor === null) return;
  if (rowDragMoved) saveCache();
  rowDragAnchor = null;
  setTimeout(() => { rowDragMoved = false; }, 0);
});

/* Режим РУЧНОГО РЕДАКТИРОВАНИЯ строки — вызывается и по двойному клику, и по клавише F2,
   когда выделена ровно одна строка (см. глобальный обработчик хоткеев ниже). */
function startEditRow(idx){
  // Строка могла быть за пределами нарисованного окна (F2 при выделении, уехавшем за экран) —
  // сначала подводим её к виду, scrollToRow заодно пересобирает окно, и только потом ищем элемент.
  scrollToRow(idx);
  const ln = document.getElementById("rows").querySelector('.ln[data-idx="' + idx + '"]');
  if (!ln) return;
  if (ln.querySelector(".edit-row-input")) return;

  const bitsContainer = ln.querySelector(".bits");
  if (!bitsContainer) return;

  const currentText = st.rows[idx] || "";
  let alignCls = "center";
  if (st.align === "left") alignCls = "left";
  if (st.align === "right") alignCls = "right";

  // Создаем инпут
  const inp = document.createElement("input");
  inp.type = "text";
  inp.className = "edit-row-input";
  inp.style.textAlign = alignCls;
  inp.value = currentText;

  // Очищаем текущие биты и вставляем поле ввода
  bitsContainer.innerHTML = "";
  bitsContainer.appendChild(inp);

  // ПОЛНАЯ ИЗОЛЯЦИЯ: предотвращаем всплытие кликов по инпуту до контейнера rows
  const stopProp = ev => ev.stopPropagation();
  inp.addEventListener("click", stopProp);
  inp.addEventListener("mousedown", stopProp);
  inp.addEventListener("mouseup", stopProp);
  inp.addEventListener("dblclick", stopProp);

  let isFinished = false;
  const finishEdit = (save) => {
    if (isFinished) return;
    isFinished = true;
    if (save && inp.value !== currentText) {
      snapshot(); // Сохраняем историю для отката (Undo / Ctrl+Z)
      st.rows[idx] = inp.value.trim();
      // НАПИСАЛИ В НУЛЕВУЮ — ОНА СТАНОВИТСЯ ПЕРВОЙ, А НАД НЕЙ ПОЯВЛЯЕТСЯ НОВАЯ НУЛЕВАЯ (запрос
      // пользователя). Это ровно то, что делает ensureZeroRow(): пустая строка на месте
      // st.topBuilt должна быть всегда, и как только туда вписали биты, она перестаёт быть
      // границей — граница заводится заново выше. Раньше проверка стояла только в загрузке и
      // в удалении строк, поэтому правкой нулевую можно было "занять" насовсем.
      // keepPats=true (v0.897): вниз едет ТОЛЬКО цепочка. Раньше вместе с ней уезжала и колонка
      // паттернов — а она к росту цепочки отношения не имеет, у неё своя нулевая ячейка и свои
      // кнопки (см. patInsertCellHere/#bDelPats).
      ensureZeroRow(true);
    }
    render();
    saveCache();
  };

  // Потеря фокуса (клик мимо инпута) -> сохранение
  inp.addEventListener("blur", () => finishEdit(true));

  // Перехват Enter и Escape внутри инпута
  inp.addEventListener("keydown", ev => {
    ev.stopPropagation(); // Не пускаем Enter / Esc / Ctrl+Z в глобальные хоткеи!
    if (ev.key === "Enter") {
      ev.preventDefault();
      finishEdit(true);
    } else if (ev.key === "Escape") {
      ev.preventDefault();
      finishEdit(false);
    }
  });

  // Устанавливаем фокус и выделяем весь текст
  setTimeout(() => {
    inp.focus();
    inp.select();
  }, 20);
}

/* Двойной клик по строке — режим РУЧНОГО РЕДАКТИРОВАНИЯ */
document.getElementById("rows").addEventListener("dblclick", e => {
  /* ПОД ЗАМКОМ (🔒) ДВОЙНОЙ КЛИК ТОЖЕ МОЛЧИТ (v1.020, запрос пользователя: "отключи выделение в
     паттернах во время Замка включенного"). Единственный обработчик полотна, который эту проверку
     проглядел: одиночный клик (onclick выше) и обе протяжки (mousedown ниже) спрашивают
     selectionAllowed() с самого начала, а сюда её не поставили — и под замком двойной клик
     по-прежнему разбирал набор выделенных паттернов, а по самой строке ещё и открывал ручную
     правку, то есть менял СОДЕРЖИМОЕ. Ровно от этого замок и защищает. */
  if (!selectionAllowed()) return;
  // Игнорируем двойной клик, если мы уже кликаем внутри поля ввода
  if (e.target.tagName === "INPUT" || e.target.closest(".edit-row-input")) return;

  const ln = e.target.closest(".ln");
  if (!ln) return;
  const idx = +ln.dataset.idx;
  if (isNaN(idx)) return;

  // ДВОЙНОЙ КЛИК ПО КОЛОНКЕ ПАТТЕРНОВ — снять выделение со ВСЕХ паттернов разом (запрос
  // пользователя). Иначе набранное протяжкой приходилось бы разбирать по одному кликом.
  // В ручную правку строки отсюда не уходим: колонка паттернов строк вообще не касается
  // (см. одиночный клик выше) — правка открывается двойным кликом по самой строке.
  // Первый клик пары успел переключить свой паттерн, поэтому чистим набор целиком уже здесь.
  if (e.target.closest(".pat, .pat2")) {
    if (st.selectedPats && st.selectedPats.size) {
      st.selectedPats.clear();
      render();
      saveCache();
    }
    return;
  }

  startEditRow(idx);
});

/* ТОЛЬКО кнопки выравниваний — у них есть data-val (v0.867). Раньше селектор брал ВСЕ кнопки
   полосы, а после переезда сюда кнопок колонок и окон (◧П1/П2◨/Р//Ч//Панели, v0.866) им бы тоже
   повесили обработчик выравнивания и затёрли собственный. */
/* НАЗНАЧИТЬ / СНЯТЬ СВОЁ ВЫРАВНИВАНИЕ У ВЫДЕЛЕННЫХ СТРОК (v0.977).
   Группа — это выделенные строки плюс одно выравнивание на всех. НИЖНЯЯ строка группы работает
   рамкой: сама она стоит по общему выравниванию поля, а её левый и правый бит — границы, между
   которыми раскладываются остальные (прямое требование пользователя: "для верхних битов левый и
   правый бит нижней строки выделенных являются границами").
   ПОВТОРНЫЙ КЛИК ПО ТОМУ ЖЕ ЗНАЧЕНИЮ РАСПУСКАЕТ ГРУППУ — это единственный способ вернуть строки
   в общее выравнивание, отдельной кнопки "снять" в полосе нет и заводить её незачем: кнопка,
   которая сейчас горит, и есть выключатель.
   Строка живёт РОВНО В ОДНОЙ группе: выбранные вычищаются из всех прежних, а группы, в которых
   осталось меньше двух строк, распускаются сами — рамке не над кем быть рамкой. */
/* РАСПУСТИТЬ ГРУППУ ОДНИМ КЛИКОМ ПО ЕЁ ЯРЛЫКУ (v1.062, запрос пользователя: "это как-то надо
   попроще распускать и видеть, что тут какое выравнивание"). Прежний единственный способ —
   выделить ровно те же строки и повторно нажать ту же кнопку полосы (см. sameAgain в
   applyGroupAlign ниже) — требовал сперва вспомнить состав группы и её выравнивание.
   Здесь ни выделение, ни выравнивание не нужны: строка-рамка однозначно задаёт группу.
   snapshot() как и в applyGroupAlign — Undo возвращает роспуск. */
function dissolveGroupAt(field, rowIdx){
  const f = (field === "L" || field === "R") ? field : "C";
  const list = fieldGroupsList(f);
  const g = list.find(x => x && x.rows && x.rows.includes(rowIdx));
  if (!g) return;
  snapshot();
  const kept = list.filter(x => x !== g);
  if (f === "L") st.rowGroupsL = kept; else if (f === "R") st.rowGroupsR = kept; else st.rowGroups = kept;
  rowGroupsTouch();
  const fieldName = f === "L" ? "левого поля (П1)" : (f === "R" ? "правого поля (П2)" : "цепочки");
  const label = (typeof FIELD_ALIGN_ICON === "object" && FIELD_ALIGN_ICON[g.align]) || g.align;
  if (typeof syncAlignActMarks === "function") syncAlignActMarks();
  render();
  saveCache();
  say(`Группа распущена: ${g.rows.length} строк ${fieldName} (было «${label}») вернулись в общее выравнивание поля.`);
}
function applyGroupAlign(align, field){
  field = (field === "L" || field === "R") ? field : "C";
  const fieldName = field === "L" ? "левого поля (П1)" : (field === "R" ? "правого поля (П2)" : "цепочки");
  if (isAxisAlign(align)) {
    say("Осевые выравнивания (⊙ / ⊙½ / ↥ / ↥½) группе выделенных строк не даются: их сдвиг берётся из карт, привязанных ко всей цепочке, и внутри рамки группы опереться им не на что. Снимите выделение (Escape) — и осевые снова переключат поле целиком.");
    return;
  }
  const rowsMax = field === "C" ? st.rows.length : Math.max(st.rows.length, (st.pats || []).length);
  const rows = Array.from(st.selectedRows).filter(i => i >= 0 && i < rowsMax).sort((a, b) => a - b);
  // Страховка. С v1.070 полоса выравниваний сюда с одной строкой уже не заходит (там порог
  // size > 1, и одна выделенная строка переключает выравнивание ПОЛЯ, как будто выделения нет) —
  // но функция публичная, и остаться без проверки не может.
  if (rows.length < 2) {
    say("Своё выравнивание задаётся ГРУППЕ строк: выделите хотя бы две. Нижняя из них станет рамкой — её левый и правый бит и есть границы, по которым выровняются верхние.");
    return;
  }
  snapshot();
  const list = fieldGroupsList(field);
  const set = new Set(rows);
  // Та же группа с тем же выравниванием — значит по горящей кнопке кликнули второй раз: распускаем.
  const sameAgain = list.some(g => g.align === align && g.rows.length === rows.length && g.rows.every(r => set.has(r)));
  for (const g of list) g.rows = g.rows.filter(r => !set.has(r));
  const kept = list.filter(g => g.rows.length > 1);
  if (!sameAgain) kept.push({ rows: rows, align: align });
  if (field === "L") st.rowGroupsL = kept; else if (field === "R") st.rowGroupsR = kept; else st.rowGroups = kept;
  rowGroupsTouch();
  const label = (typeof FIELD_ALIGN_ICON === "object" && FIELD_ALIGN_ICON[align]) || align;
  say(sameAgain
      ? `Своё выравнивание снято — ${rows.length} строк ${fieldName} вернулись в общее выравнивание.`
      : `Строки ${rows[0] + 1}–${rows[rows.length - 1] + 1} (${rows.length} шт.) ${fieldName} выровнены «${label}» внутри своей рамки: нижняя строка группы — строка ${rows[rows.length - 1] + 1}, её левый и правый бит держат границы.`);
  if (typeof syncAlignActMarks === "function") syncAlignActMarks();
  render();
  saveCache();
}
const alignBtns = document.querySelectorAll("#alignGrp button[data-val]");
alignBtns.forEach(btn => {
  btn.onclick = () => {
    /* ПОЛОСА МОЖЕТ БИТЬ НЕ В ЦЕНТР (v0.976, запрос пользователя: "кнопки П1 и П2 сделай, что при
       активации они принимали на свою панель переключение всех выравниваний, кроме осей").
       Нажата «◧ П1» или «П2 ◨» — вся полоса правит выравнивание ТОГО поля (см. alignTarget в
       fold-1-core.js), и это ровно те же значения, что гоняет по кругу кнопка-половинка ⇤ рядом.
       Осевые (⊙/⊙½/↥/↥½) — исключение: их сдвиг берётся из карт, привязанных к строкам цепочки,
       и в колонке паттернов опереться им не на что, поэтому они ВСЕГДА уходят центральному полю
       (приёмник при этом не сбрасывается — просто одна эта кнопка адресована не ему). */
    const valNow = btn.getAttribute("data-val");
    /* СВОЁ ВЫРАВНИВАНИЕ ВЫДЕЛЕННЫМ СТРОКАМ (v0.977, запрос пользователя: "нужно выделенным задавать
       своё выравнивание"). Пока в цепочке что-то выделено, полоса правит НЕ всё поле, а именно эти
       строки — они становятся группой со своей геометрией (рамка — их нижняя строка, см.
       rowAlignCtx в fold-1-core.js). Снять выделение (Escape или клик по строке) — и полоса снова
       про поле целиком, как раньше. Приёмник П1/П2 разбирается ниже и выделения не касается: там
       речь про колонки паттернов, а группы — про строки цепочки. */
    /* ОДНА ВЫДЕЛЕННАЯ СТРОКА — ЭТО «НИЧЕГО НЕ ВЫДЕЛЕНО» (v1.070, запрос пользователя: "пусть если
       выделена одна строка, то даёт переключаться выравниваниям — не надо уведомлять, что выделена
       одна, а надо несколько; пусть выравнивает как будто ничего не выделено, если одна").
       Группе нужны минимум две строки (нижняя работает рамкой, см. applyGroupAlign), и раньше полоса
       всё равно уводила клик туда — только чтобы получить отказ. А выделена ровно одна строка почти
       всегда: приложение само держит выделение непустым (см. гарантию в resetAll/loadTabState), то
       есть в самом обычном состоянии полоса выравниваний просто не работала и ругалась.
       Теперь порог — size > 1 в ОБЕИХ ветках: одна строка проваливается дальше, к обычному
       переключению выравнивания поля. Отметка активной кнопки это уже понимала и раньше — у
       selectedRowsGroupAlign() тот же порог (fold-5-ui.js). */
    /* ГРУППЫ БЫВАЮТ ТОЛЬКО У ЦЕПОЧКИ (v1.090, запрос пользователя: "в паттернах выравнивание
       вообще не должно зависеть от выделенных строк — одно на все строки всегда").
       С v0.982 приёмник решал не только «какому полю», но и «полю целиком или выделенным строкам
       этого поля», и у П1/П2 заводились свои группы (st.rowGroupsL/rowGroupsR). Для колонки
       паттернов это оказалось вредно: выравнивание там — свойство всей колонки, а не отдельных
       ячеек, и выделение строк не должно на него влиять вообще.
       Теперь группу получает только цепочка. Полоса при приёмнике П1/П2 всегда правит ВСЮ колонку —
       ветка ниже, — сколько бы строк ни было выделено. */
    if (alignTarget === "C" && st.selectedRows && st.selectedRows.size > 1 && !isAxisAlign(valNow)) {
      applyGroupAlign(valNow, "C");
      return;
    }
    // Осевые (⊙/⊙½/↥/↥½) при выделенной ГРУППЕ: сюда они доходят только затем, чтобы applyGroupAlign
    // объяснила, почему группе они не даются. При одной выделенной строке — тоже мимо, как и выше.
    if (alignTarget === "C" && st.selectedRows && st.selectedRows.size > 1) {
      applyGroupAlign(valNow, "C");
      return;
    }
    if (alignTarget !== "C" && !isAxisAlign(valNow)) {
      const field = alignTarget;
      if (!fieldAlignAllowed(field, valNow)) return;
      if (field === "L") patAlign = valNow; else pat2Align = valNow;
      if (typeof applyPatAligns === "function") applyPatAligns();
      if (typeof syncAlignActMarks === "function") syncAlignActMarks();
      render();
      saveCache();
      return;
    }
    alignBtns.forEach(b => b.classList.remove("act"));
    btn.classList.add("act");
    // Ось при смене выравнивания ОСТАЁТСЯ НА МЕСТЕ (запрос пользователя) — раньше её сбрасывало
    // на середину видимой области, и картинка прыгала при каждом переключении. Просто сохранить
    // offset нельзя: у каждого выравнивания своя точка отсчёта (axisBaseCol()), и чужой offset
    // уводил бы цепочку за экран. Поэтому запоминаем СТОЛБЕЦ оси до переключения и пересчитываем
    // offset так, чтобы в новом режиме ось встала на тот же столбец.
    const prevAxisCol = axisBaseCol() + (st.axisCenterOffset || 0);
    // ...и ГДЕ ОНА СТОЯЛА НА ЭКРАНЕ. Одного столбца мало: счёт колонок идёт по measureText, а
    // браузер раскладывает текст по своей ширине символа, и расхождение копится пропорционально
    // сдвигу — у "По левому краю" его нет вовсе, у "По центру" с короткой первой строкой это
    // сотни колонок. Поэтому "тот же столбец" в новом выравнивании — это уже ДРУГОЕ место на
    // экране, и ось заметно дёргалась при переключении (запрос пользователя). Доводим по факту
    // ниже, после перерисовки.
    const prevPx = axisScreenPx();
    /* ...И ГДЕ ОНА СТОЯЛА НА САМОМ ЭКРАНЕ (v1.056, запрос пользователя: "устрани дёргание оси при
       переключении выравниваний, пусть ось стоит на месте, а прыгают биты"). prevPx выше — это
       координата ВНУТРИ .chain, и доводка по ней правит st.axisCenterOffset, то есть ЦЕЛЫЕ
       столбцы. Остаток меньше столбца ею не убирается в принципе (сдвиг — целое число колонок), и
       именно он читается как дёрганье: ось каждый раз садится на новое место в пределах символа.
       Клиентская координата нужна отдельно: доводка ниже двигает картинку, и «то же место внутри
       .chain» — не то же место на экране, если полотно прокручено. */
    const prevClientX = (() => {
      const ch = document.getElementById("chain");
      return (prevPx != null && ch) ? prevPx + ch.getBoundingClientRect().left : null;
    })();
    const nextAlign = btn.getAttribute("data-val");
    /* ЗАПРЕТ ЛЕВОГО/ПРАВОГО У ЦЕНТРАЛЬНОГО ПОЛЯ (v0.971) — СНЯТ в v1.041 (CENTER_FIELD_LR_BAN
       переведена в false, см. fold-1-core.js). Проверку НЕ удаляю: константа задумана как
       переключатель, и при возврате её в true запрет обязан снова держаться в логике, а не только
       гаснуть кнопками (.align-banned, см. syncAlignBanned) — иначе его обойдёт любой другой путь
       к st.align: горячие клавиши, восстановление настроек, применение к группе.
       Пока константа false, fieldAlignAllowed() всегда true и ветка просто не срабатывает.
       Крайних полей (П1/П2) запрет не касался никогда — им левое/правое как раз и нужно. */
    if (!fieldAlignAllowed("C", nextAlign)) {
      say("Центральному полю левое и правое выравнивание запрещены — только центр, лесенки и осевые. Крайним полям (П1/П2) они по-прежнему доступны.");
      return;
    }
    /* 🔏 ПАТТЕРНЫ ЗАМОРОЖЕНЫ (v1.057) — полоса, направленная на П1/П2, ничего им не делает. Это
       второй путь к их выравниванию помимо кнопок в планках осей (cyclePatAlign, там своя такая же
       проверка): полоса бьёт в поле, выбранное приёмником. Осевые сюда не попадают — они всегда
       адресованы цепочке, а её режим не запирает. */
    if (typeof alignTarget !== "undefined" && alignTarget !== "C" && !isAxisAlign(nextAlign)
        && typeof patsEditAllowed === "function" && !patsEditAllowed()) {
      say("🔏 Паттерны заморожены — полоса выравниваний сейчас направлена на " + (alignTarget === "L" ? "П1" : "П2") + ", а эти колонки заперты. Переключите приёмник на «Ц» или снимите замок.");
      return;
    }
    /* "ОсьБит"/"ОсьБит ½" (↥ / ↥½) — ПЕРВОЕ нажатие не двигает строки вовсе (v0.881, запрос
       пользователя: "пусть при переключении на эти выравнивания строки изначально будут как в том
       выравнивании, из которого клик делается, а при втором клике — как обычно"). Причина: у
       ОсьБита сдвиг строки берётся из axisBitShiftMap, а она пустая, пока не поработали сами
       ОсьБит-операции, — то есть переключение швыряло всю цепочку к левому краю. Запоминаем
       выравнивание, ИЗ которого пришли, и до второго нажатия рисуем строки по нему
       (см. st.axisBitSeedAlign в render()). Второе нажатие по той же кнопке снимает семя —
       дальше ОсьБит работает как всегда. Уход на любое другое выравнивание тоже его снимает. */
    /* СТРОКИ ГРУПП ПЕРЕХОДЯТ НА СВОИХ МЕСТАХ (v1.061, запрос пользователя: "при переключении
       оставляй выравнивания, как если бы так были подвинуты по умолчанию"). Семя выше держит это
       обещание для обычных строк, но считает их место голым alignShift() — без групп. Поэтому
       строки, стоявшие в группе, снимаем ПОИМЕННО, их реальным сдвигом, пока старое выравнивание
       ещё в силе (st.align меняется ниже). См. axisBitSeedGrpShift в fold-1-core.js. */
    if (nextAlign === "axisbit" || nextAlign === "axisbit12") {
      if (st.align === nextAlign) { st.axisBitSeedAlign = null; axisBitSeedGrpShift.clear(); }  // второе нажатие подряд
      else if (st.align !== "axisbit" && st.align !== "axisbit12") {
        st.axisBitSeedAlign = st.align;
        axisBitSeedGrpShift.clear();
        const mx = (st.rows || []).reduce((a, r) => Math.max(a, (r || "").length), 0);
        for (let i = 0; i < (st.rows || []).length; i++) {
          const s = st.rows[i] || "";
          if (!s.length || !rowGroupOf(i)) continue;
          axisBitSeedGrpShift.set(i, rowShiftFor(mx, i, s, st.align));
        }
      }
    } else {
      st.axisBitSeedAlign = null;
      axisBitSeedGrpShift.clear();
    }
    st.align = nextAlign;
    // Два render(): первый — чтобы axisBaseCol() считала уже по новому выравниванию (у "ОсьБит"
    // сдвиг берётся из axisBitShiftMap, а её наполняет именно render()), второй — применить
    // пересчитанный offset. clampAxisOffset внутри render() не даст уехать за колонки паттернов.
    render();
    st.axisCenterOffset = prevAxisCol - axisBaseCol();
    // ЗАКРЕПЛЯЕМ столбец явно (запрос пользователя: "при переключении выравниваний не двигай первую
    // строку и ось пусть будет на месте"). Без этой строки промежуточный render() выше успевал
    // переписать закреплённый столбец своим — он там синхронизируется после зажимов, а считался в
    // тот момент по НОВОМУ выравниванию со СТАРЫМ сдвигом, то есть по заведомо неверной паре.
    // Следующий кадр честно ставил ось по этому испорченному значению, и картинка прыгала.
    axisPinCol = prevAxisCol;
    // Подпись "⤡ Диагональ осей" показывает РЕАЛЬНУЮ стрелку, а она зависит от выравнивания
    // (у "Лесенки правой ½" наклон зеркальный, вне "½" диагонали нет вовсе) — обновляем молча.
    setAxisDiagCols(st.axisDiagCols, true);
    render();
    // ДОВОДКА ПО ЭКРАНУ: сколько линия реально проехала — на столько столбцов правим сдвиг назад.
    // Считается по уже отрисованному кадру, поэтому промах формулы сюда не попадает вовсе. Кадр
    // добавляется только когда есть что править (разница от столбца и больше) — при переключении
    // между выравниваниями с похожим сдвигом третьей перерисовки не будет. Остаток меньше столбца
    // не убрать: сдвиг — целое число колонок, дробный поехал бы в добивку строк пробелами.
    // ДОВОДКА ИТЕРАТИВНАЯ, а не в один проход (запрос пользователя: "съехало Ось при выравнивании,
    // пусть не двигается"). Один проход не сходился: поправка округляется до ЦЕЛЫХ столбцов, а
    // после её применения линию ещё раз двигает зажим по ширине поля бит (clampAxisOffset) — и
    // остаток мог оказаться больше столбца, то есть ось так и оставалась уехавшей. Теперь мерим
    // после каждой правки и повторяем, пока не сойдётся (или пока правка вообще что-то меняет).
    // Три прохода — потолок от зацикливания: если ось упёрлась в зажим и дальше не идёт, разница
    // перестанет уменьшаться, и мы просто выходим с тем, что есть.
    if (prevPx != null) {
      for (let pass = 0; pass < 3; pass++) {
        const chPx = realColStepPx();
        const nowPx = axisScreenPx();
        if (nowPx == null || !(chPx > 0)) break;
        const d = Math.round((nowPx - prevPx) / chPx);
        if (!d) break;                       // сошлось — ось стоит там же, где стояла
        const before = st.axisCenterOffset || 0;
        st.axisCenterOffset = before - d;
        axisPinCol = axisBaseCol() + st.axisCenterOffset;
        render();
        // Зажим мог не пустить ось дальше (упёрлась в край поля бит) — тогда следующий проход
        // считал бы ту же поправку снова и снова. Ничего не изменилось — выходим.
        if ((st.axisCenterOffset || 0) === before) break;
      }
    }
    /* ОСТАТОК МЕНЬШЕ СТОЛБЦА — ПРОКРУТКОЙ ПОЛОТНА (v1.056). Всё, что выше, работает целыми
       столбцами и до пикселя не доводит; здесь добираем разницу точно, сдвигая ТОЧКУ ОБЗОРА, а не
       раскладку. Ось остаётся ровно на том же месте экрана, а биты под ней смещаются на долю
       символа — то самое «ось стоит, прыгают биты».
       Почему прокрутка, а не ещё один сдвиг: st.axisCenterOffset входит в геометрию (нумерация
       столбцов, data-col, поколоночные режимы), и дробное значение там сломало бы все расчёты.
       scrollLeft же не меняет НИЧЕГО в данных и раскладке — это чистая точка обзора, ровно как
       обычная горизонтальная прокрутка мышью.
       Знак: ось уехала вправо на d — прокручиваем полотно вправо на столько же, и она возвращается
       под курсор. Порог в полпикселя — чтобы не трогать scrollLeft впустую на каждом клике. */
    if (prevClientX != null) {
      const sc = document.getElementById("screenCanvas");
      const chNow = document.getElementById("chain");
      const nowPx2 = axisScreenPx();
      if (sc && chNow && nowPx2 != null) {
        const d = (nowPx2 + chNow.getBoundingClientRect().left) - prevClientX;
        if (Math.abs(d) > 0.5) sc.scrollLeft += d;
      }
    }
    saveCache();
  };
});

/* Как "🧩 Паттерн-цепочка" укладывает паттерн по строкам (см. st.chainTileMode/patChainApplyOnce):
   по строкам / сквозной лентой → / сквозной лентой ← / змейкой →← / змейкой ←→. */
/* "🧩 Кладёт: паттерны / строки" — ЧТО берёт "Паттерн-цепочка" в качестве ленты (запрос
   пользователя). Порядок, круг, способ укладки и отсечки от этого не зависят вовсе: меняется
   только источник текста — колонка паттернов или биты самих строк с теми же номерами. */
function setChainSrcRows(on, quiet){
  st.chainSrcRows = !!on;
  const b = document.getElementById("bChainSrcRows");
  if (b) {
    b.classList.toggle("mode-act", st.chainSrcRows);
    b.textContent = st.chainSrcRows ? "🧩 Кладёт: строки" : "🧩 Кладёт: паттерны";
  }
  if (!quiet) {
    say(st.chainSrcRows
      ? "Паттерн-цепочка укладывает БИТЫ САМИХ СТРОК — по кругу, по номерам строк."
      : "Паттерн-цепочка укладывает тексты паттернов из колонки — как обычно.");
    render(); saveCache();
  }
}
const bChainSrcRowsEl = document.getElementById("bChainSrcRows");
if (bChainSrcRowsEl) bChainSrcRowsEl.onclick = () => setChainSrcRows(!st.chainSrcRows);

const chainTileBtns = document.querySelectorAll("#chainTileGrp button");
chainTileBtns.forEach(btn => {
  btn.onclick = () => {
    chainTileBtns.forEach(b => b.classList.remove("act"));
    btn.classList.add("act");
    st.chainTileMode = btn.getAttribute("data-val");
    saveCache();
  };
});
function applyChainTileMode(){
  const mode = st.chainTileMode || "none";
  document.querySelectorAll("#chainTileGrp button").forEach(b => {
    b.classList.toggle("act", b.getAttribute("data-val") === mode);
  });
}

const spiralDirBtns = document.querySelectorAll("#spiralDirGrp button");
spiralDirBtns.forEach(btn => {
  btn.onclick = () => {
    spiralDirBtns.forEach(b => b.classList.remove("act"));
    btn.classList.add("act");
    st.spiralUpDir = btn.getAttribute("data-val");
    saveCache();
  };
});

const seqGlueBtns = document.querySelectorAll("#seqGlueGrp button");
seqGlueBtns.forEach(btn => {
  btn.onclick = () => {
    seqGlueBtns.forEach(b => b.classList.remove("act"));
    btn.classList.add("act");
    st.seqGlueMode = btn.getAttribute("data-val");
    render();
    saveCache();
  };
});

/* "🎭 Маска" фон-поиска (см. maskSearchText/computeBgSearchTarget): пока в поле что-то есть,
   фон-поиск ищет в результатах ЕЁ, а не паттерн строки под выделенной. Пересчёт — на каждый ввод
   символа (render сам зовёт фон-поиск), поэтому маску видно "на лету". */
const bgMaskTextEl = document.getElementById("bgMaskText");
if (bgMaskTextEl) {
  bgMaskTextEl.value = st.bgMaskText || "";
  bgMaskTextEl.oninput = () => {
    st.bgMaskText = bgMaskTextEl.value;
    st.bgSearchLastHit = -1; // новая цель поиска — прежняя находка к ней не относится
    // Поле теперь общее на всё (поиск, "⇄ Сдвиг по маске", подсветка), а у подсветки нет своего
    // "выкл" — её кнопка гаснет и оживает вместе с полем (см. updateBgMaskPaintBtn в fold-4).
    if (typeof updateBgMaskPaintBtn === "function") updateBgMaskPaintBtn();
    render();
    saveCache();
  };
}
/* "🎭 Маска заново каждый виток" — см. mkResult/dimMaskedBits: включена (по умолчанию) — маска
   начинается заново в каждом витке кольца, снята — идёт сквозь витки. */
const cBgMaskRingRestartEl = document.getElementById("cBgMaskRingRestart");
if (cBgMaskRingRestartEl) {
  cBgMaskRingRestartEl.checked = st.bgMaskRingRestart !== false;
  cBgMaskRingRestartEl.onchange = () => {
    st.bgMaskRingRestart = cBgMaskRingRestartEl.checked;
    st.bgSearchLastHit = -1;
    render();
    saveCache();
  };
}
/* ПЕРЕБОР МАСОК (кнопка "🎭 Перебор масок") — прогнать по включённым режимам фон-поиска ВСЕ
   осмысленно различные маски до заданного периода и показать те, что дают находку.
   ЧТО ЗНАЧИТ "различные". Маска — это периодический выбор бит, поэтому:
     • сплошная и пустая маски не прореживают ничего — их пропускаем;
     • маска, которая сама есть повтор более короткой ("1010" = "10", "110110" = "110"), выбирает
       ровно те же биты, что короткая, — тоже пропускаем (она уже была в переборе);
     • а вот ПОВОРОТЫ маски пропускать НЕЛЬЗЯ: "10" и "01" на одной и той же строке дают разные
       наборы бит (это и есть фазы #м1/#м2), и одна может находить там, где другая нет.
   Остаются все НЕПЕРИОДИЧЕСКИЕ строки длины 2..N — их Σ по d|n μ(d)·2^(n/d) штук: 2, 6, 12, 30,
   54, 126, 240, 504, 990, 2046, 4020 для длин 2..12. До периода 8 это 470 масок, до 10 — 1964,
   до 12 — 8030; перебор синхронный, поэтому на 12+ интерфейс заметно подвиснет. */
/* minLen/maxLen — ДИАПАЗОН длин (v0.828, запрос пользователя: "можно задать от 10 до 11
   например"). Раньше перебор всегда начинался с 2, и чтобы посмотреть только длинные маски,
   приходилось ждать все короткие: до периода 11 это 4000+ лишних масок против 2046 нужных. */
function primitiveMasks(minLen, maxLen){
  const out = [];
  for (let n = Math.max(2, minLen); n <= maxLen; n++){
    const total = 1 << n;
    // v=0 — все нули (брать нечего), v=total-1 — все единицы (не выбрасывается ничего).
    for (let v = 1; v < total - 1; v++){
      let s = "";
      for (let i = n - 1; i >= 0; i--) s += ((v >> i) & 1) ? "1" : "0";
      let periodic = false;
      for (let d = 1; d < n && !periodic; d++){
        if (n % d) continue;
        let same = true;
        for (let i = d; i < n; i++) if (s[i] !== s[i - d]) { same = false; break; }
        if (same) periodic = true;
      }
      if (!periodic) out.push(s);
    }
  }
  return out;
}
/* СВОЙ СПИСОК МАСОК (v0.926, запрос пользователя: "сюда бы окно для текстового ввода масок
   строчками для перебора"). Диапазон "период от/до" перебирает ВСЕ непериодические маски этих
   длин — но руками собранный список бывает нужнее: проверить свой десяток любой длины, в том
   числе длиннее 14 (потолок полей диапазона) и периодических, которые primitiveMasks нарочно
   выбрасывает. Непустой список ОТМЕНЯЕТ диапазон целиком, а не дополняет его: подмешать десять
   своих к восьми тысячам сгенерированных — значит потерять их в списке находок.
   Разбор построчный, из каждой строки берутся только 0/1 (рядом можно писать пометки), пустые и
   без единой «1» отбрасываются (прореживание, которое не берёт ничего, ничего и не найдёт),
   повторы снимаются — иначе одна и та же маска проверится дважды. */
function maskScanListMasks(){
  const seen = new Set(), out = [];
  for (const line of (st.bgMaskScanList || "").split("\n")){
    /* ПОМЕТКА ОТРЕЗАЕТСЯ ПО ПЕРВОМУ РАЗДЕЛИТЕЛЮ (v0.937). Раньше из всей строки просто
       выбрасывалось всё, кроме 0/1, — и подпись вроде "№ 13" молча дописывала к маске "1",
       а "1101 строка 10" превращалась в "1101110". Подпись нужна (кнопки-заполнители теперь
       пишут, из какой строки маска), поэтому маской считается только ПЕРВОЕ СЛОВО, а всё
       после пробела/«#»/«;» — комментарий. Строка, начинающаяся с комментария, пропускается. */
    const head = (line.split(/[\s#;]/)[0] || "");
    const m = head.replace(/[^01]/g, "");
    if (!m || m.indexOf("1") < 0 || seen.has(m)) continue;
    seen.add(m); out.push(m);
  }
  return out;
}
/* Подпись маски из своего списка (v0.937): «патт. №5», «строка №3», «сквозная строк 1–7» — то,
   что дописали кнопки-заполнители. Нужна в плашке находки: без неё в списке результатов видны
   одни биты, и чья это была строка, уже не вспомнить. */
function maskScanNoteFor(mask){
  for (const line of (st.bgMaskScanList || "").split("\n")){
    const parts = line.trim().split(/\s+/);
    if (!parts.length) continue;
    if ((parts[0] || "").replace(/[^01]/g, "") !== mask) continue;
    const note = parts.slice(1).join(" ").replace(/^[#;]+\s*/, "");
    if (note) return note;
  }
  return "";
}
function bgMaskScan(){
  // elById, а не document.getElementById: вкладка «Маски» может жить в своём окне (см. openMaskPopup).
  const outEl = elById("bgMaskScanOut");
  const minEl = elById("bgMaskScanMin");
  const maxEl = elById("bgMaskScanMax");
  let minLen = Math.max(2, Math.min(14, minEl ? (+minEl.value || 2) : 2));
  let maxLen = Math.max(2, Math.min(14, maxEl ? (+maxEl.value || 8) : 8));
  // Поля перепутаны местами — молча меняем их обратно, а не отдаём пустой перебор.
  if (minLen > maxLen) { const t = minLen; minLen = maxLen; maxLen = t; }
  // Свой список (см. maskScanListMasks) ОТМЕНЯЕТ диапазон: перебираем ровно то, что вписано.
  const listMasks = maskScanListMasks();
  // Подпись: свой список или диапазон длин (одна длина — так и пишем, без "от ... до ...").
  const lenNote = listMasks.length
    ? ("свой список, " + listMasks.length + " шт.")
    : ((minLen === maxLen) ? ("период " + minLen) : ("период " + minLen + "–" + maxLen));
  // Сырые результаты режимов берём БЕЗ маски: сама она тут перебирается, а с ней в поле
  // computeBgSearchTarget отдала бы уже фазы одной-единственной маски.
  const savedMask = st.bgMaskText;
  st.bgMaskText = "";
  const info = computeBgSearchTarget();
  st.bgMaskText = savedMask;
  if (!info || !info.results || !info.results.length) {
    say("Перебор масок: фон-поиск сейчас ничего не считает — включите режимы и выделите строку.");
    return;
  }
  const pat = info.targetIdx < st.pats.length ? st.pats[info.targetIdx] : null;
  const patText = pat && pat.text ? pat.text : "";
  if (!patText) { say("Перебор масок: у строки ниже выделенной нет паттерна — искать нечего."); return; }
  /* ВИТКИ КОЛЬЦА — ОДНОЙ И ТОЙ ЖЕ ГАЛКОЙ, что и обычный поиск (v0.928, запрос пользователя
     "вообще в одну кнопку это надо"). Раньше у перебора был свой чекбокс "сквозной" с ОБРАТНОЙ
     логикой: включённый "сквозной" = снятая "🎭 Маска заново каждый виток". Их легко было
     развести — и тогда маска, найденная перебором, вставала по клику в поле и не находилась,
     потому что поиск считал её по другому правилу. Теперь выражение буквально то же, что в
     mkResult (включая "🚫 Без кольца": без кольца удваивать нечего). */
  const thru = (st.bgMaskRingRestart === false && !st.ringOff);
  const masks = listMasks.length ? listMasks : primitiveMasks(minLen, maxLen);
  if (!masks.length) { say("Перебор масок: в этом диапазоне длин непериодических масок нет."); return; }
  /* ФАЗЫ У СВОЕГО СПИСКА (v0.935, вопрос пользователя: "перебор все фазы делает? скорость
     моментальная"). Раньше КАЖДАЯ маска проверялась только в фазе 0 — и это было правильно
     ровно для перебора по ДИАПАЗОНУ: primitiveMasks перечисляет все непериодические строки
     длины n, то есть все повороты каждой маски уже лежат в списке отдельными записями, а
     applyPickMask(s, M, p) — это буквально applyPickMask(s, поворот(M,p), 0). Крутить там ещё и
     фазы значит делать ту же работу n раз впустую.
     А вот в СВОЁМ списке (и в том, что кладут туда кнопки «🧩 Паттерны»/«⛓ Строки»/«➡ Сквозные»)
     поворотов никто не генерирует — там фаза 0 честно теряла находки. Крутим фазы только для него.
     ПОТОЛОК — ПО РАБОТЕ, А НЕ ПО ДЛИНЕ МАСКИ. Стоимость шага ≈ длина строки (прореживание + кольцо),
     шагов = сумма длин масок × число режимов. Маска 70 бит на строке 2200 — это пара миллионов
     операций, миллисекунды; а маска из «➡ Сквозные» длиной со саму строку даёт квадрат и вешает
     интерфейс на секунды и минуты. Поэтому считаем работу заранее и при перерасходе честно
     откатываемся на одну фазу, написав об этом в шапке результатов. */
  const PHASE_WORK_BUDGET = 40e6;
  const lenSum = info.results.reduce((a, r) => a + (r.result ? (thru ? r.result.length * 2 : r.result.length) : 0), 0);
  const phaseSum = masks.reduce((a, m) => a + m.length, 0);
  const allPhases = listMasks.length > 0 && lenSum > 0 && phaseSum * lenSum <= PHASE_WORK_BUDGET;
  const phaseNote = listMasks.length
    ? (allPhases ? ", все фазы" : ", только 1-я фаза (перебор всех фаз тут слишком долгий)")
    : ", все фазы (повороты в списке)";
  const hits = [];
  for (const mask of masks){
    const phN = allPhases ? mask.length : 1;
    let done = false;
    for (let ph = 0; ph < phN && !done; ph++){
      for (const r of info.results){
        if (!r.result) continue;
        const thin = applyPickMask(thru ? r.result + r.result : r.result, mask, ph);
        if (thin.length < patText.length) continue;
        const kinds = findPatternKinds(thin, patText);
        // Одна запись на маску: какая фаза и какой режим первыми дали находку, теми и подписываем —
        // иначе список разрастается в десятки строк на одну и ту же маску.
        if (kinds.length) { hits.push({ mask, phase: ph, mode: r.mode, kind: kinds[0].kind, skip: !!kinds[0].skip }); done = true; break; }
      }
    }
  }
  if (outEl) {
    outEl.style.display = hits.length ? "flex" : "none";
    const shown = hits.slice(0, 300);
    outEl.innerHTML =
      '<span class="mask-note">Найдено масок: ' + hits.length + ' из ' + masks.length +
        ' (' + lenNote + (thru ? ', сквозной' : '') + phaseNote + '). Клик — поставить маску в поле.' +
        (hits.length > shown.length ? ' Показаны первые ' + shown.length + '.' : '') + '</span>' +
      // В поле кладём маску КАК ЕСТЬ, без поворота к найденной фазе: обычный поиск и так считает
      // все её фазы (см. mkResults), так что находка воспроизведётся. Номер фазы — в подписи.
      shown.map(h => {
        const note = listMasks.length ? maskScanNoteFor(h.mask) : "";
        return '<span class="mask-hit' + (h.mask === maskBits() ? " cur" : "") + '" data-mask="' + h.mask +
          '" title="' + (note ? note + ' · ' : '') + bgModeLabel(h.mode) + ' — ' + KIND_LABELS_RU[h.kind] +
          (h.skip ? " (без 1-го символа)" : "") + ', фаза ' + (h.phase + 1) + ' из ' + h.mask.length +
          '">' + h.mask + (h.phase ? '<sub>ф' + (h.phase + 1) + '</sub>' : '') +
          (note ? '<i style="font-style:normal;color:var(--dim);"> ' + esc(note) + '</i>' : '') + '</span>';
      }).join("");
  }
  say(hits.length
    ? `🎭 Перебор масок: находку дают ${hits.length} маск(и) из ${masks.length} (${lenNote}${thru ? ", сквозной" : ""}${phaseNote}) — список под кнопкой, клик ставит маску в поле.`
    : `🎭 Перебор масок: ни одна из ${masks.length} масок (${lenNote}${phaseNote}) не даёт находки — паттерн строки №${info.targetIdx + 1} не собирается ни одним из этих прореживаний.`);
}
const bBgMaskScanEl = document.getElementById("bBgMaskScan");
if (bBgMaskScanEl) bBgMaskScanEl.onclick = bgMaskScan;
/* Поле своего списка. Пересчёта не требует — перебор читает его в момент клика по кнопке, а на
   обычный фон-поиск (маска из #bgMaskText) список не влияет вообще. Пока он непуст, поля
   "период от/до" приглушаем классом mode-na (тот же приём, что у "заново каждый виток"), чтобы
   не гадать, что из двух сейчас в деле; title у метки не трогаем — он приходит из data-tip. */
const bgMaskScanListEl = document.getElementById("bgMaskScanList");
function updateMaskScanRangeNA(){
  const lbl = elById("bgMaskScanRangeLbl");
  if (lbl) lbl.classList.toggle("mode-na", maskScanListMasks().length > 0);
}
if (bgMaskScanListEl) {
  bgMaskScanListEl.value = st.bgMaskScanList || "";
  bgMaskScanListEl.oninput = () => {
    st.bgMaskScanList = bgMaskScanListEl.value;
    updateMaskScanRangeNA();
    saveCache();
  };
  /* ВСТАВКА (Ctrl+V) В ЭТО ПОЛЕ ОТКЛЮЧЕНА (v0.997, запрос пользователя: "Ctrl+V в браузере
     вставляет текст в поля паттернов" + "вообще убери контроль V"). Список масок — не обычное
     текстовое поле: Undo на него в этом приложении принципиально не распространяется (см.
     комментарий у bgMaskScanListClearEl выше), а обычная браузерная вставка сюда никак не
     проверяет содержимое буфера обмена — вставленный мусор (не 0/1) тихо ломает список и
     откатить это нечем. Дописывать в список положено кнопками "🎭 Сами паттерны"/"⛓ Строк"/
     "➡ Сквозных" (см. maskScanAddLines выше) — они и фильтруют вставляемое, и не боятся Undo,
     потому что список — их собственные данные, а не чужой буфер обмена. Ручной ввод/правка
     руками (не вставкой) по-прежнему работают — блокируется только paste. */
  bgMaskScanListEl.addEventListener("paste", e => {
    e.preventDefault();
    say("🎭 Вставка (Ctrl+V) в список масок отключена — список не отслеживается Undo, а вставка вслепую может занести туда что угодно. Добавляйте кнопками «Сами паттерны» / «⛓ Строк» / «➡ Сквозных» ниже, или впишите руками.");
  });
}
updateMaskScanRangeNA();
/* ГОТОВЫЕ МАСКИ ИЗ САМИХ ДАННЫХ (v0.927, запрос пользователя: "вставка строк-паттернов, и
   вставка строк Цепочек, и их сквозных до искомого паттерна"). Три кнопки над полем списка
   набивают его тем, что уже лежит в цепочке, — руками переписывать те же строки незачем.
   ГРАНИЦА «до искомого паттерна» — ровно та же, по которой считает фон-поиск: искомый паттерн
   лежит в строке ПОД выделенной (targetIdx = selIdx+1, см. computeBgSearchTarget), значит в
   список идёт всё ПО ВЫДЕЛЕННУЮ СТРОКУ включительно. Ничего не выделено — берём всю цепочку до
   последней непустой строки, чтобы кнопки работали и без выделения. */
function maskScanBoundIdx(){
  if (st.selectedRows && st.selectedRows.size) return Math.max(...st.selectedRows);
  let last = -1;
  for (let i = 0; i < st.rows.length; i++) if (st.rows[i] && st.rows[i].length) last = i;
  return last;
}
/* Дописываем в КОНЕЦ списка, а не затираем его: список собирают по кускам (свои маски + паттерны
   + сквозная), и затирание съедало бы набранное вручную. Фильтр тут тот же, что в разборе
   (только 0/1, без пустых и без «одни нули»), — иначе кнопка отчиталась бы о добавленных
   строках, которые перебор потом молча выбросит. Повторы не проверяем: их снимет maskScanListMasks. */
/* items — строка ИЛИ {bits, note} (v0.937, запрос пользователя "если по паттернам, то номер
   строки тоже показать"). Подпись дописывается после маски через пробелы и в саму маску не
   идёт: разбор берёт только первое слово (см. maskScanListMasks). Колонку подписей выравниваем
   по самой длинной маске пачки — иначе номера скачут. */
function maskScanAddLines(items, what){
  const add = (items || [])
    .map(it => (typeof it === "string") ? { bits: it, note: "" } : (it || { bits: "", note: "" }))
    .map(it => ({ bits: (it.bits || "").replace(/[^01]/g, ""), note: it.note || "" }))
    .filter(it => it.bits && it.bits.indexOf("1") >= 0);
  if (!add.length) { say("🎭 Вставлять нечего: " + what + " — пусто или без единиц (маска из одних нулей не берёт ни одного бита)."); return; }
  const w = Math.min(40, add.reduce((a, it) => Math.max(a, it.bits.length), 0));
  const cur = (st.bgMaskScanList || "").replace(/\s+$/, "");
  st.bgMaskScanList = (cur ? cur + "\n" : "") +
    add.map(it => it.note ? (it.bits.padEnd(w, " ") + "  " + it.note) : it.bits).join("\n");
  if (bgMaskScanListEl) bgMaskScanListEl.value = st.bgMaskScanList;
  updateMaskScanRangeNA();
  saveCache();
  say(`🎭 В список масок добавлено ${add.length} — ${what}. Всего в списке: ${maskScanListMasks().length}. Перебор пойдёт по нему, диапазон длин не используется.`);
}
// Сами паттерны как маски: их «1» решают, какие биты результата брать.
const bgMaskScanFromPatsEl = document.getElementById("bgMaskScanFromPats");
if (bgMaskScanFromPatsEl) bgMaskScanFromPatsEl.onclick = () => {
  /* ВСЕ ПАТТЕРНЫ, БЕЗ ГРАНИЦЫ ПО ВЫДЕЛЕНИЮ (v0.947, запрос пользователя "кнопки Паттерны — пусть
     все вставляет, а не до выделенной туда"). У «⛓ Строк» и «➡ Сквозных» граница осталась: они
     про то, что уже разобрано выше искомого паттерна. А паттерны — это список задач на всю
     цепочку целиком, и обрезать его выделением смысла нет.
     Номер строки в подписи (v0.937): паттерны у строк разные, и без номера потом не понять, чей
     именно дал находку. */
  const out = [];
  for (let i = 0; i < st.pats.length; i++){ const p = st.pats[i]; if (p && p.text) out.push({ bits: p.text, note: "патт. №" + (i + 1) }); }
  maskScanAddLines(out, `все паттерны цепочки (${out.length})`);
};
// Сами строки цепочки. stripDots — точки-пустоты в маске означали бы «пропустить», а это уже
// решает «0»; берём голые биты, ровно как concatRowsDownTo.
const bgMaskScanFromRowsEl = document.getElementById("bgMaskScanFromRows");
if (bgMaskScanFromRowsEl) bgMaskScanFromRowsEl.onclick = () => {
  const bound = maskScanBoundIdx();
  const out = [];
  for (let i = 0; i <= bound; i++){ const b = stripDots(getRowBits(st, i)); if (b) out.push({ bits: b, note: "строка №" + (i + 1) }); }
  maskScanAddLines(out, `строки цепочки 1–${bound + 1}`);
};
/* Очистка списка (v0.933). Кнопки-заполнители только дописывают, и накопленное иначе пришлось бы
   выделять мышью. Отдельного подтверждения нет: список набирается в два клика, а Undo на поля
   ввода в приложении и так не распространяется. */
const bgMaskScanListClearEl = document.getElementById("bgMaskScanListClear");
if (bgMaskScanListClearEl) bgMaskScanListClearEl.onclick = () => {
  if (!(st.bgMaskScanList || "").trim()) { say("🎭 Список масок и так пуст."); return; }
  const was = maskScanListMasks().length;
  st.bgMaskScanList = "";
  if (bgMaskScanListEl) bgMaskScanListEl.value = "";
  updateMaskScanRangeNA();
  saveCache();
  say(`🎭 Список масок очищен (было ${was}). Перебор снова пойдёт по диапазону длин.`);
};
// Две сквозные склейки: строк (той же функцией, что и режим "Сквозная →" фон-поиска, чтобы
// маска совпадала с тем, что человек видит в "Результате") и паттернов.
const bgMaskScanFromSeqEl = document.getElementById("bgMaskScanFromSeq");
if (bgMaskScanFromSeqEl) bgMaskScanFromSeqEl.onclick = () => {
  const bound = maskScanBoundIdx();
  if (bound < 0) { maskScanAddLines([], "сквозные"); return; }
  let pats = "";
  for (let i = 0; i <= bound; i++){ const p = st.pats[i]; if (p && p.text) pats += p.text; }
  maskScanAddLines([
    { bits: concatRowsDownTo(st, bound), note: "сквозная строк 1–" + (bound + 1) },
    { bits: pats, note: "сквозная патт. 1–" + (bound + 1) }
  ], `сквозные до строки ${bound + 1} (строки + паттерны)`);
};
const bgMaskScanOutEl = document.getElementById("bgMaskScanOut");
if (bgMaskScanOutEl) bgMaskScanOutEl.onclick = (e) => {
  const chip = e.target.closest(".mask-hit");
  if (!chip) return;
  const el = elById("bgMaskText");
  st.bgMaskText = chip.dataset.mask;
  if (el) el.value = st.bgMaskText;
  bgMaskScanOutEl.querySelectorAll(".mask-hit").forEach(c => c.classList.toggle("cur", c === chip));
  st.bgSearchLastHit = -1;
  render(); saveCache();
  say(`🎭 Маска «${st.bgMaskText}» поставлена в поле — результаты пересчитаны по её фазам.`);
};
const cBgSubPatternsEl = document.getElementById("cBgSubPatterns");
if (cBgSubPatternsEl) {
  cBgSubPatternsEl.onchange = () => {
    st.bgSubPatterns = cBgSubPatternsEl.checked;
    st.bgSearchLastHit = -1;
    render();
    saveCache();
  };
}
const cBgAllPatsEl = document.getElementById("cBgAllPats");
if (cBgAllPatsEl) {
  cBgAllPatsEl.onchange = () => {
    st.bgAllPats = cBgAllPatsEl.checked;
    st.bgSearchLastHit = -1;
    render();
    saveCache();
  };
}
const cBgAllPatsEveryEl = document.getElementById("cBgAllPatsEvery");
if (cBgAllPatsEveryEl) {
  cBgAllPatsEveryEl.onchange = () => {
    st.bgAllPatsEvery = cBgAllPatsEveryEl.checked;
    st.bgSearchLastHit = -1;
    render();
    saveCache();
  };
}
/* "🧩 кусок: любой / с начала / с конца" — что именно ищет "🧩 Макс. часть", когда паттерн целиком
   не нашёлся (см. findLongestPartialHit). Переключатель на три положения, активно всегда одно. */
function setPartialPick(m, quiet){
  st.partialPick = m;
  const map = { any: "bPartAny", head: "bPartHead", tail: "bPartTail" };
  for (const k in map) {
    const el = document.getElementById(map[k]);
    if (el) el.classList.toggle("mode-act", k === m);
  }
  if (!quiet) {
    say(m === "head" ? "🧩 Макс. часть: ищем только кусок ОТ НАЧАЛА паттерна."
      : m === "tail" ? "🧩 Макс. часть: ищем только кусок С КОНЦА паттерна."
      : "🧩 Макс. часть: ищем любой непрерывный кусок паттерна.");
    render(); saveCache();
  }
}
/* "🔎 где: вся цепочка / до паттерна" — ОБЛАСТЬ поиска режима "🌈 Все паттерны" (запрос
   пользователя). Меняет только то, в каких строках вхождение засчитывается: "до паттерна" — у
   каждого паттерна своя граница, строки ВЫШЕ его собственной. Список искомых паттернов и все
   прочие настройки от этого не зависят. */
function setAllPatScope(sel, quiet){
  st.allPatScopeSel = !!sel;
  const a = document.getElementById("bScopeAll"), b = document.getElementById("bScopeSel");
  if (a) a.classList.toggle("mode-act", !st.allPatScopeSel);
  if (b) b.classList.toggle("mode-act", st.allPatScopeSel);
  if (!quiet) {
    say(st.allPatScopeSel
      ? "🌈 Все паттерны: каждый паттерн ищем только в строках ВЫШЕ него самого."
      : "🌈 Все паттерны: ищем по всей цепочке.");
    render(); saveCache();
  }
}
const bScopeAllEl = document.getElementById("bScopeAll");
if (bScopeAllEl) bScopeAllEl.onclick = () => setAllPatScope(false);
const bScopeSelEl = document.getElementById("bScopeSel");
if (bScopeSelEl) bScopeSelEl.onclick = () => setAllPatScope(true);

const bPartAnyEl = document.getElementById("bPartAny");
if (bPartAnyEl) bPartAnyEl.onclick = () => setPartialPick("any");
const bPartHeadEl = document.getElementById("bPartHead");
if (bPartHeadEl) bPartHeadEl.onclick = () => setPartialPick("head");
const bPartTailEl = document.getElementById("bPartTail");
if (bPartTailEl) bPartTailEl.onclick = () => setPartialPick("tail");

const cBgAllPatsPartialEl = document.getElementById("cBgAllPatsPartial");
if (cBgAllPatsPartialEl) {
  cBgAllPatsPartialEl.onchange = () => {
    st.bgAllPatsPartial = cBgAllPatsPartialEl.checked;
    st.bgSearchLastHit = -1;
    render();
    saveCache();
  };
}
/* Галка «🔽 Все ниже» (#cBgAllBelow, st.bgSearchAllBelow) УДАЛЕНА в v1.090 — по запросу
   пользователя вместе с приходом «ищем выделенный паттерн» (см. patSelMode в
   computeBgSearchTarget). Делала она ровно то же, только вслепую: сверяла результат со ВСЕМИ
   паттернами ниже выделения и метила совпавшие зелёным. Теперь нужный паттерн выделяется руками, и
   гадать, который из нижних имелся в виду, не приходится.
   Сам сбор belowHits ниже остался — им пользуется «🔻 Полный проход» (st.fullPassMode). */
/* "🔻 Полный проход" — ОДНА кнопка на весь режим (v0.963, запрос пользователя). Что она делает,
   расписано в computeBgSearchTarget() (поиск в своей строке и во всех нижних) и в autoRun()
   (захват — только когда пройдены все варианты текущей строки). Тут только переключатель:
   подсветка кнопки, сброс прошлой находки (цель поиска сменилась) и перерисовка. */
const bFullPassEl = document.getElementById("bFullPass");
function applyFullPassBtn(){
  if (bFullPassEl) bFullPassEl.classList.toggle("mode-act", !!st.fullPassMode);
}
if (bFullPassEl) {
  bFullPassEl.onclick = () => {
    st.fullPassMode = !st.fullPassMode;
    applyFullPassBtn();
    st.bgSearchLastHit = -1;
    render(); saveCache();
    say(st.fullPassMode
      ? "🔻 Полный проход включён: разом ищутся ВСЕ ещё не найденные паттерны — и выше выделенной, и в ней самой, и ниже; совпавшие держат зелёную метку до Сброса. В «Авто» новая строка захватывается только когда пройдены ВСЕ варианты текущей."
      : "🔻 Полный проход выключен: обычный поиск по паттерну строки под выделенной, захват сразу на находке.");
  };
}

/* "⛔ Паттерны выше выделенной — не искать" (v1.100) — переключатель к patSearchFloorIdx() выше.
   Устроен ровно как "🔻 Полный проход" рядом: подсветка кнопки, сброс прошлой находки (область
   поиска изменилась — старая находка могла быть как раз из отсечённой части) и перерисовка. */
const bNoPatsAboveEl = document.getElementById("bNoPatsAbove");
function applyNoPatsAboveBtn(){
  if (bNoPatsAboveEl) bNoPatsAboveEl.classList.toggle("mode-act", !!st.noPatsAbove);
}
if (bNoPatsAboveEl) {
  bNoPatsAboveEl.onclick = () => {
    st.noPatsAbove = !st.noPatsAbove;
    applyNoPatsAboveBtn();
    st.bgSearchLastHit = -1;
    render(); saveCache();
    say(st.noPatsAbove
      ? "⛔ Паттерны выше выделенной строки И ЕЁ СОБСТВЕННЫЙ больше не ищутся — ни «🌈 Все паттерны», ни «🔻 Полный проход», ни выделенные ячейки. Остаются только те, что строго ниже выделения."
      : "⛔ Отсечка снята: паттерны выше выделенной снова участвуют в поиске.");
  };
}

const bgSearchModeBtns = document.querySelectorAll("#bgSearchModeGrp button");
bgSearchModeBtns.forEach(btn => {
  btn.onclick = () => {
    const val = btn.getAttribute("data-val");
    const idx = st.bgSearchModes.indexOf(val);
    if (idx >= 0) {
      /* Снимается ЛЮБОЙ режим, в том числе последний (запрос пользователя: "если второй раз
         нажать — должна потухнуть, даже если нет других"). Раньше тут стоял запрет на снятие
         последнего: выключить фон-поиск было больше нечем, и пустой набор оставлял его в
         подвешенном состоянии. Теперь для этого есть отдельный выключатель — клик по заголовку
         "🔍 Фон-поиск" (toggleBgSearch), который к тому же сохраняет выбранный набор. */
      st.bgSearchModes.splice(idx, 1);
    } else {
      st.bgSearchModes.push(val);
    }
    btn.classList.toggle("act", st.bgSearchModes.includes(val));
    st.bgSearchLastHit = -1;
    render();
    saveCache();
  };
});
// Тоггл "Всё / Выкл" рядом с группой режимов фон-поиска: выделить ВСЕ кнопки-режимы (включая
// 🧮 Суммы длин) или снять все. Это ТОЛЬКО про набор режимов; выключить сам фон-поиск, сохранив
// набор, — клик по заголовку "🔍 Фон-поиск" (toggleBgSearch).
const bBgModeAllNoneEl = document.getElementById("bBgModeAllNone");
if (bBgModeAllNoneEl) {
  bBgModeAllNoneEl.onclick = () => {
    // Просто "выделить всё / снять всё" (запрос пользователя) — промежуточного состояния
    // "только XOR-Все" больше нет. Выключение самого фон-поиска — клик по заголовку, см.
    // toggleBgSearch(): набор режимов там сохраняется.
    const allVals = Array.from(bgSearchModeBtns).map(b => b.getAttribute("data-val"));
    const allOn = allVals.every(v => st.bgSearchModes.includes(v));
    st.bgSearchModes = allOn ? [] : allVals.slice();
    bgSearchModeBtns.forEach(b => b.classList.toggle("act", st.bgSearchModes.includes(b.getAttribute("data-val"))));
    st.bgSearchLastHit = -1;
    render();
    saveCache();
  };
}

/* "lengthSums" (🧮 Суммы длин) не даёт ОДИН результат-строку, как остальные режимы (у неё
   МНОЖЕСТВО комбинаций сразу, см. findLengthSumCombos/renderLengthSumsHtml) — поэтому её
   "нашлось ли хоть что-то" считается отдельно, тем же кольцевым поиском (findPatternKinds),
   что и её собственная подсветка. Используется, чтобы находка через Суммы длин ТОЖЕ считалась
   находкой фон-поиска (см. computeBgSearchTarget → matched ниже) — запрос пользователя: "при
   круговой сдвиг должен также включать новую строку [в выделение], если было выделено
   несколько" — раньше это работало только для обычных режимов (interleave/xor2/...), Суммы
   длин в bgInfo.matched не участвовали вообще. */
function lengthSumsHasMatch(st, selIdx){
  if (!(st.bgSearchModes && st.bgSearchModes.includes("lengthSums"))) return false;
  const nextPat = st.pats[selIdx + 1];
  const patText = nextPat && nextPat.text ? nextPat.text : "";
  if (!patText) return false;
  const combos = findLengthSumCombos(st, selIdx, LENGTH_SUM_MAX_COMBOS);
  for (const combo of combos) {
    let plain = "";
    combo.forEach(idx => { plain += getRowBits(st, idx); });
    if (findPatternKinds(plain, patText).length > 0) return true;
  }
  return false;
}
/* Полный список НАЙДЕННЫХ (совпавших) комбинаций "Суммы длин" — в отличие от lengthSumsHasMatch()
   (тот просто останавливается на первой же находке, для быстрой проверки "нашлось ли вообще")
   тут собираются ВСЕ совпавшие варианты сумм, чтобы записать их в "Лог находок" целиком — запрос
   пользователя "в лог записать Суммы длин всех найденные варианты сумм" (не просто отметку
   "нашлось", а САМИ варианты). Каждая запись — {label, kind, skip}, тот же kind/skip, что и у
   обычных findPatternKinds (берётся ПЕРВЫЙ найденный вариант данной комбинации), label — подпись
   вида "1+2+9" (см. renderLengthSumsHtml). Вызывается только при записи НОВОЙ находки в лог
   (не на каждый render), поэтому полный (не ранне-обрывающийся) перебор тут не проблема
   производительности. */
function lengthSumsMatchedCombos(st, selIdx){
  const nextPat = st.pats[selIdx + 1];
  const patText = nextPat && nextPat.text ? nextPat.text : "";
  if (!patText) return [];
  const combos = findLengthSumCombos(st, selIdx, LENGTH_SUM_MAX_COMBOS);
  const out = [];
  for (const combo of combos) {
    let plain = "";
    combo.forEach(idx => { plain += getRowBits(st, idx); });
    const kinds = findPatternKinds(plain, patText);
    if (kinds.length > 0) out.push({ label: combo.join("+"), kind: kinds[0].kind, skip: kinds[0].skip });
  }
  return out;
}

/* Цвет конкретного ПАТТЕРНА для режима "🌈 Все паттерны" — по его номеру в списке, чтобы
   один и тот же паттерн был одного цвета и в строке результата, и в колонке паттернов. Шаг по
   кругу цветов взят простым числом (137°, "золотой угол"), поэтому соседние номера получают
   заметно разные оттенки, а не плавный градиент. */
function allPatColor(idx){
  return "hsl(" + ((idx * 137) % 360) + ", 85%, 62%)";
}

/* "🌈 Все паттерны" (st.bgAllPats): ищем в готовой строке результата НЕ один искомый
   паттерн, а ВСЕ паттерны списка — сверху вниз. Каждый паттерн засчитывается ОДИН раз, по самой
   ранней позиции, и дальше не ищется (запрос пользователя: "поиск идёт с верхней строки вниз,
   если находится — больше не ищется"). Кольцо/⏭ Без 1-го/⇌ Инв-Рев учитываются ровно так же, как
   в findPatternKinds() — просто кольцевой буфер строится ОДИН раз на весь список паттернов, а не
   заново на каждый (иначе на длинных результатах это десятки лишних мегабайт строк за render).
   Возвращает [{patIdx, kind, skip, start, len}] в порядке следования паттернов. */
/* ВЫДЕЛЕНИЕ ПАТТЕРНА САМО ВКЛЮЧАЕТ ПОИСК (запрос пользователя: "выделил паттерн, вхождение в
   цепочках точно есть, а он ничего не находит"). Выделение паттернов и раньше сужало список
   искомого до выделенных (см. onlySel в findAllPatternsInResult), но ВСЯ ветка поиска висела на
   одной галке "🌈 Все паттерны": с выключенной галкой выделенный паттерн не искался нигде — ни в
   строках, ни в результатах фон-поиска, — а клик по нему молча никуда не вёл, потому что карта
   подсветки (lastAllPatRows) вообще не строилась. Теперь достаточно любого из двух: галка ищет
   ВСЕ паттерны, выделение — только выделенные. */
function allPatsShown(){ return !!(st.bgAllPats || (st.selectedPats && st.selectedPats.size)); }
/* Минимальная длина паттерна, участвующего в "🌈 Все паттерны" (см. findAllPatternsInResult).
   Ниже этого порога паттерн в этом режиме не ищется и не подсвечивается вовсе. */
const ALL_PATS_MIN_LEN = 2;
/* Список находок, свёрнутый ДО ОДНОЙ НА ПАТТЕРН (самой ранней). Нужен там, где показывается
   перечень НОМЕРОВ найденных паттернов: сама подсветка при "🔁 Все вхождения" рисует каждое
   вхождение, а вот в списке номеров один и тот же паттерн повторяться не должен. */
function allHitsByPat(hits){
  if (!hits || !hits.length) return [];
  const seen = new Set(), out = [];
  for (const h of hits) {
    if (seen.has(h.patIdx)) continue;
    seen.add(h.patIdx);
    out.push(h);
  }
  return out;
}
/* "🧩 Макс. часть" (st.bgAllPatsPartial): паттерн целиком в результате не нашёлся — ищем
   САМЫЙ ДЛИННЫЙ его непрерывный кусок, который там есть. Длины перебираются СВЕРХУ ВНИЗ, поэтому
   первая же находка и есть самая длинная; внутри длины порядок тот же, что у обычной находки —
   сначала сам паттерн, потом инверсия/реверс (variants уже в этом порядке), а внутри варианта
   куски слева направо. Короче minLen не опускаемся: на 1 бите совпадает вообще всё.
   Длину сверху ограничиваем периодом кольца — кусок длиннее самого результата не встретится. */
function findLongestPartialHit(ring, period, variants, minLen){
  // Проверка "есть ли кусок ДЛИНЫ L": варианты в их обычном порядке (сам паттерн раньше
  // инверсии/реверса), внутри варианта куски слева направо. Одинаковые куски (у самоподобных
  // паттернов вроде "0000" их много) прогоняем через ring один раз.
  const tryLen = (L) => {
    const seen = new Set();
    for (const [kind, cand] of variants) {
      if (cand.length < L) continue;
      // "🧩 кусок: с начала / с конца" (st.partialPick) — вместо всех кусков подряд берём ровно
      // один: тот, что начинается с НАЧАЛА самого паттерна, или тот, что упирается в его КОНЕЦ.
      // Считаем от ИСХОДНОГО паттерна, поэтому у реверс-вариантов (kind 2/3) начало и конец
      // меняются местами — иначе "с начала" на реверсе означало бы конец, чего никто не просил.
      const pick = st.partialPick || "any";
      let sFrom = 0, sTo = cand.length - L;
      if (pick !== "any") {
        const rev = (kind === 2 || kind === 3);
        sFrom = sTo = ((pick === "head") !== rev) ? 0 : cand.length - L;
      }
      for (let s = sFrom; s <= sTo; s++) {

        const sub = cand.slice(s, s + L);
        if (seen.has(sub)) continue;
        seen.add(sub);
        const idx = ring.indexOf(sub);
        // off — смещение куска ВНУТРИ варианта: по нему потом считается, какую часть самого
        // паттерна подсветить в колонке (см. patStart в findAllPatternsInResult).
        if (idx >= 0 && idx < period) return { kind, cand: sub, start: idx, off: s, partial: true };
      }
    }
    return null;
  };
  let maxLen = 0;
  for (const [, cand] of variants) if (cand.length > maxLen) maxLen = cand.length;
  let lo = minLen, hi = Math.min(maxLen, period), best = null;
  // ДВОИЧНЫЙ поиск по длине, а не перебор всех длин подряд: свойство "кусок длины L найдётся"
  // монотонно — раз нашёлся кусок длины L, то его собственное начало длины L−1 тоже кусок этого
  // же паттерна и тоже в ring. Перебор сверху вниз делал до (длина_паттерна²/2) вызовов indexOf
  // НА КАЖДЫЙ ненайденный паттерн, а их обычно почти весь список — на длинной цепочке это
  // намертво вешало рендер (о чём и сообщил пользователь).
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const hit = tryLen(mid);
    if (hit) { best = hit; lo = mid + 1; }
    else hi = mid - 1;
  }
  return best;
}
/* ПОЧЕМУ паттерн не нашёлся — разбор ровно тех отсечек, что стоят в findAllPatternsInResult выше.
   Нужен, чтобы сообщение "вхождений не найдено" не было загадкой (запрос пользователя: паттерн
   в строках виден глазами, а поиск молчит): чаще всего дело не в самом поиске, а в том, что этот
   паттерн до поиска вообще не дошёл — отсечён "⛔", короче порога после "⏭ Без 1-го" или не входит
   в выделенный набор. null — значит паттерн честно искали и правда не нашли. */
function allPatSkipReason(i){
  const p = st.pats[i];
  if (!p || !p.text) return "у этой строки нет паттерна";
  if (st.selectedPats && st.selectedPats.size) {
    let anyNonEmpty = false;
    for (const si of st.selectedPats) if (st.pats[si] && st.pats[si].text) { anyNonEmpty = true; break; }
    if (anyNonEmpty && !st.selectedPats.has(i)) return "выделены другие паттерны — ищутся только они";
  }
  const base = patBase(p.text);
  if (base.length < ALL_PATS_MIN_LEN) {
    return `искать нечего: «${base}»${st.skipFirst && p.text.length > 1 ? " (после «⏭ Без 1-го»)" : ""} короче ${ALL_PATS_MIN_LEN} бит`;
  }
  return null;
}
/* ⛔ «Паттерны выше выделенной — не искать» (st.noPatsAbove, v1.100, запрос пользователя).
   Отдаёт номер строки, НИЖЕ которой (включительно) паттерны ещё участвуют в поиске; −1 — отсечки
   нет. Ориентир — самая нижняя выделенная строка, тот же, что и у всего остального в фон-поиске
   (см. selIdx в computeBgSearchTarget), а граница — СЛЕДУЮЩАЯ за ней: паттерн САМОЙ выделенной
   строки тоже не ищется (v1.101, уточнение пользователя: "включая саму выделенную — тут тоже
   паттерн не искать"). То есть остаются ровно те паттерны, что строго НИЖЕ выделения, начиная с
   обычной цели фон-поиска (targetIdx = selIdx + 1).
   Отсечка СИЛЬНЕЕ выделения ячеек — в этом её смысл ("даже если они выделены"). Это прямо
   противоположно правилу порога "⛔", где явное выделение паттерна всегда побеждало (см. коммент
   в цикле findAllPatternsInResult): там отсечка была побочной, здесь — единственное назначение
   кнопки, и «выделил, а не ищет» тут не сюрприз, а то, что просили.
   Ничего не выделено — границу считать не от чего, отсечки нет. */
function patSearchFloorIdx(){
  if (!st.noPatsAbove) return -1;
  if (!st.selectedRows || !st.selectedRows.size) return -1;
  return Math.max(...st.selectedRows) + 1;
}
function findAllPatternsInResult(text){
  const out = [];
  if (!text || !st.pats || !st.pats.length) return out;
  const cycle = ringCycle(text);
  const period = cycle.length;
  const ring = st.ringOff ? cycle : (period > 1 ? cycle + cycle.slice(0, period - 1) : cycle);
  // ОТСЕЧКИ ЗДЕСЬ НЕТ ВООБЩЕ (запрос пользователя: "должен искать ВСЕ паттерны, а не те, которые
  // выше выделения строки"). Галки "⛔" и положение выделения — это про фон-поиск и Паттерн-цепочку:
  // докуда собирается результат и докуда укладываются биты. К режиму "🌈 Все паттерны" они отношения
  // не имеют — он справочный, показывает, что из списка вообще где-то нашлось, и обрезать список по
  // выделению значило бы прятать находки без всякой причины.
  // ОТДЕЛЬНОЕ ВЫДЕЛЕНИЕ ПАТТЕРНОВ (запрос пользователя): выделен хоть один — ищем ТОЛЬКО выделенные,
  // не выделено ничего — ищем все, как и раньше. Действует только здесь, то есть только в режиме
  // "🌈 Все паттерны" (других вызовов у этой функции нет); обычный фон-поиск и Паттерн-цепочка
  // этого выделения не видят вовсе.
  // В набор берём ТОЛЬКО непустые паттерны. Строки могут уехать относительно колонки паттернов
  // (⬔ До квадрата и ◺ 90° вставляют строки, а паттерны сознательно остаются на своих номерах), и
  // выделенный номер оказывается на пустой ячейке. Раньше такой набор глушил поиск ЦЕЛИКОМ: режим
  // честно искал "только выделенные", а выделенный был пуст — и не находилось вообще ничего
  // (запрос пользователя: "после До квадрата вообще не ищет"). Пусто после отсева — ищем все.
  let onlySel = null;
  if (st.selectedPats && st.selectedPats.size) {
    for (const si of st.selectedPats) {
      if (st.pats[si] && st.pats[si].text) { if (!onlySel) onlySel = new Set(); onlySel.add(si); }
    }
  }

  const patFloor = patSearchFloorIdx();

  for (let i = 0; i < st.pats.length; i++) {
    // ⛔ «Паттерны выше выделенной — не искать» (v1.100) — ПЕРЕД проверкой выделения: эта отсечка
    // бьёт и по выделенным ячейкам тоже (см. patSearchFloorIdx). Выключена — patFloor = −1.
    if (patFloor >= 0 && i < patFloor) continue;
    // ЯВНОЕ ВЫДЕЛЕНИЕ СИЛЬНЕЕ ОТСЕЧКИ "⛔ до паттерна" (запрос пользователя: выделил паттерн 4-й
    // строки, а в ответ "строка отсечена, паттерны ищутся только по строку 2"). Тот порог про то,
    // докуда идёт АВТОМАТИЧЕСКИЙ перебор всего списка; паттерн, ткнутый пальцем, ищется всегда —
    // иначе выделение просто не работает и непонятно почему.
    if (onlySel && !onlySel.has(i)) continue;
    // Уже защёлкнут "Авто" (см. allPatLatch) — второй раз не ищем вовсе.
    if (allPatLatch.size && allPatLatch.has(i)) continue;


    const p = st.pats[i];
    if (!p || !p.text) continue;
    const skipApplied = st.skipFirst && p.text.length > 1;
    const base = patBase(p.text);
    // Паттерн длиннее самого результата целиком не влезет — но при "🧩 Макс. часть" его
    // КУСОК влезть может, поэтому там такой паттерн не отбрасываем.
    if (!base) continue;
    if (base.length > period && !st.bgAllPatsPartial) continue;
    // Нижняя граница длины паттерна для этого режима. Меряем по base, т.е. по РЕАЛЬНО искомому
    // куску (уже с учётом "⏭ Без 1-го") — ровно он потом и подсвечивается. Было 5 (">4 бит"),
    // теперь минимум 2 — запрос пользователя. Одиночный бит отсекается всегда: он есть буквально
    // везде, и подсветка от него превращается в сплошную заливку.
    if (base.length < ALL_PATS_MIN_LEN) continue;
    const variants = [[0, base]];
    {
      // По отдельному тумблеру на версию (см. KINDS_MODES); kind 3 — наложение обеих.
      const inv = invertBits(base);
      if (kindsInvOn()) variants.push([1, inv]);
      if (kindsRevOn()) variants.push([2, reverseStr(base)]);
      if (kindsInvOn() && kindsRevOn()) variants.push([3, reverseStr(inv)]);
    }
    let best = null;
    for (const [kind, cand] of variants) {
      const idx = ring.indexOf(cand);
      if (idx < 0 || idx >= period) continue;
      // ПРИОРИТЕТ ОСНОВНОГО ВАРИАНТА (запрос пользователя): нашёлся сам паттерн — показываем только
      // его, а инверсию/реверс/реверс-инверсию не показываем вовсе, даже если какая-то из них легла
      // РАНЬШЕ по позиции. Раньше побеждал просто самый ранний вариант, и на месте обычной находки
      // мог оказаться инвертированный кусок. variants[0] — всегда основной, поэтому проверка первая.
      if (kind === 0) { best = { kind, cand, start: idx }; break; }
      if (!best || idx < best.start) best = { kind, cand, start: idx };
    }
    // Целиком не нашёлся — при "🧩 Макс. часть" берём самый длинный подходящий кусок.
    if (!best && st.bgAllPatsPartial) best = findLongestPartialHit(ring, period, variants, ALL_PATS_MIN_LEN);
    if (!best) continue;
    // Какую часть САМОГО паттерна подсветить в колонке (запрос пользователя: "подсветить только
    // часть, которую нашли"). Инверсия позиций не двигает, а реверс (kind 2/3) переворачивает —
    // там смещение считается с другого конца. Плюс первый символ, если он отрезан "⏭ Без 1-го".
    let patStart = -1, patLen = 0;
    if (best.partial) {
      patLen = best.cand.length;
      const inBase = (best.kind === 2 || best.kind === 3)
        ? (base.length - best.off - patLen)
        : best.off;
      patStart = inBase + (skipApplied ? 1 : 0);
    }
    if (!st.bgAllPatsEvery) {
      // Как было всегда: одна находка на паттерн, самая ранняя позиция.
      out.push({ patIdx: i, kind: best.kind, start: best.start, len: best.cand.length, skip: skipApplied, partial: !!best.partial, patStart: patStart, patLen: patLen });
    } else {
      // "🔁 Все вхождения" (запрос пользователя): подсвечиваем паттерн ВЕЗДЕ, где он встретился, а не
      // только в первом месте. Вариант при этом уже выбран выше по обычному правилу (приоритет у
      // основного) — перебираем вхождения ИМЕННО ЕГО, иначе на одной картинке смешались бы сам
      // паттерн и его инверсия, а это ровно то, чего просили не показывать.
      // Шаг from = idx + 1, а не + длину: перекрывающиеся вхождения (у самоподобных паттернов вроде
      // "10101" их полно) — тоже вхождения и тоже должны светиться.
      const cand = best.cand;
      for (let from = 0;;) {
        const idx = ring.indexOf(cand, from);
        if (idx < 0 || idx >= period) break;
        out.push({ patIdx: i, kind: best.kind, start: idx, len: cand.length, skip: skipApplied, partial: !!best.partial, patStart: patStart, patLen: patLen });
        from = idx + 1;
      }
    }
  }
  // Период кольца — тем, кто раскладывает эти позиции обратно на строки (см. allPatRows в render()).
  out.period = period;
  return out;
}

/* Карта "позиция в результате СКВОЗНОГО режима → {r, p}" (номер строки и индекс бита в ней) —
   строится ровно тем же обходом, что и сама склейка (concatRowsDownTo / concatSnakeGlueDownTo),
   поэтому позиции совпадают один в один. Нужна, чтобы найденный паттерн подсветить в САМИХ
   строках, даже когда он лежит НА СТЫКЕ: часть в одной строке, часть в следующей (запрос
   пользователя "показать частичное выделение паттерна"). Возвращает null для режимов, у которых
   такого прямого соответствия нет (XOR, интерлив, поколоночные, диагонали) — там один бит
   результата собран из нескольких строк сразу, показывать его "в строке" нечем.
   "…Inv"-варианты только инвертируют биты — порядок тот же; "…RevInv" реверсят ВСЮ склейку
   целиком, поэтому карта разворачивается. */
function bgConcatCellMap(mode, stopIdx){
  if (typeof mode !== "string" || stopIdx == null || stopIdx < 0) return null;
  const cells = [];
  // Карта обязана повторять склейку ОДИН В ОДИН, поэтому знает и про "0 вместо пустот": на местах
  // подставленных нулей в карте стоит null — настоящего бита там нет, и подсвечивать нечего
  // (потребитель null уже умеет пропускать).
  const g = st.padZero ? concatGridBounds(st, stopIdx) : null;
  const pushRow = (r, rev) => {
    const s = getRowBits(st, r);
    if (!s.length) return;
    if (g) {
      const sh = rowShiftFor(g.maxLen, r, s, st.align);
      const cols = [];
      for (let c = g.lo; c <= g.hi; c++) {
        const j = c - sh;
        cols.push((j >= 0 && j < s.length) ? { r, p: j } : null);
      }
      if (rev) cols.reverse();
      for (const cell of cols) cells.push(cell);
      return;
    }
    if (rev) for (let p = s.length - 1; p >= 0; p--) cells.push({ r, p });
    else     for (let p = 0; p < s.length; p++) cells.push({ r, p });
  };
  if (mode.indexOf("concatSnake") === 0) {
    // Змейка-склейка: у каждой ВТОРОЙ строки биты идут задом наперёд (см. concatSnakeGlueDownTo).
    // Правая змейка (concatSnakeFromR*) начинает с ПРАВОГО края первой строки — разворот
    // достаётся чётным строкам, а не нечётным.
    const snakeStartRev = mode.indexOf("concatSnakeFromR") === 0;
    for (let i = 0; i <= stopIdx; i++) pushRow(i, (i % 2 === 1) !== snakeStartRev);
  } else if (mode.indexOf("concatL") === 0) {
    for (let i = stopIdx; i >= 0; i--) pushRow(i, false);
  } else if (mode.indexOf("concatR") === 0) {
    for (let i = 0; i <= stopIdx; i++) pushRow(i, false);
  } else {
    return null;
  }
  if (mode.indexOf("RevInv") >= 0) cells.reverse();
  return cells;
}

/* "Фон-поиск" больше не отдельная галка (запрос пользователя) — активен, ПОКА включён хотя бы
   один режим в st.bgSearchModes; полностью выключить можно только кнопкой "Всё/XOR-Чёт/Выкл"
   (сбрасывает bgSearchModes до пустого массива). */
function bgSearchActive(){ return st.bgSearchOn !== false && !!(st.bgSearchModes && st.bgSearchModes.length); }
/* Общий выключатель фон-поиска (клик по заголовку "🔍 Фон-поиск"). ОТДЕЛЬНО от списка режимов:
   раньше выключить можно было только сняв все режимы разом, и выбранный набор при этом терялся —
   теперь он остаётся, а поиск просто не работает, пока выключен (запрос пользователя). */
function toggleBgSearch(){
  st.bgSearchOn = st.bgSearchOn === false;
  st.bgSearchLastHit = -1;
  render();
  saveCache();
}
/* Фоновый поиск: выделенная строка ФИКСИРОВАНА (не двигается сама, в отличие от doInterleaveStep/
   doXorSelectedStep) — при каждом render() пересчитывает результат (интерлив / XOR пары / XOR
   всех выше+выделенной, где пара всегда — строка над выделенной + сама выделенная) и сверяет
   его с паттерном строки НИЖЕ выделенной. Возвращает { targetIdx, matched } — targetIdx нужен,
   чтобы подсветить ЧТО ищем, ещё до совпадения; matched — найдено ли оно уже. null — если фон
   выключен или выделения/цели нет. Ничего не останавливает и не переключает, только подсветка. */
/* "🎭 Маска" фон-поиска (поле #bgMaskText) — ПРОРЕЖИВАНИЕ СТРОКИ РЕЗУЛЬТАТА, а не то, что в ней
   ищут (запрос пользователя: «в Результатах, например Xor и Сквозная, там 10000000111010110,
   маска 10 — берём первый бит, второй пропускаем, потом снова первый и т.д. по всей
   результирующей, со сдвигом»). Маска прикладывается к результату по кругу: её «1» — бит взять,
   «0» — пропустить; из взятых складывается НОВАЯ строка результата, и уже в ней фон-поиск ищет
   всё то же самое — паттерн строки под выделенной, всеми обычными видами совпадения.
   СО СДВИГОМ: маску прикладываем не только с начала, но и с каждого её следующего символа — маска
   длины N даёт N строк результата (фазы), и совпадение ищется в каждой. Маска "10" — это чётные
   биты и нечётные, "110" — три разные выборки по две трети бит.
   Маска пустая (или без единиц — из неё нечего брать) — ничего не меняется, режимы отдают свои
   результаты как всегда. Всё, кроме 0/1, из маски выбрасывается, так что писать можно с пробелами. */
/* Разбор ПОЛЯ маски, без оглядки на выключатель: нужен и самой maskBits(), и кнопке
   "🎭 По маске" — ей надо знать, есть ли вообще годная маска, чтобы гасить себя при пустом поле. */
function maskBitsRaw(){
  const raw = (st.bgMaskText || "").replace(/[^01]/g, "");
  // Ни одной "1" — брать нечего; ни одного "0" — не выбрасывается ничего. И то, и другое означает
  // "маски нет": иначе маска вида "11" честно плодила бы N одинаковых фаз результата и множила
  // работу фон-поиска на ровном месте. ВАЖНО: маска УМНОЖАЕТ работу — каждый включённый режим
  // считается и ищется столько раз, какова её длина.
  if (raw.indexOf("1") < 0 || raw.indexOf("0") < 0) return "";
  return raw;
}
/* ВЫКЛЮЧАТЕЛЬ МАСКИ (v0.826, запрос пользователя: "кнопку По Маске — включает поиск по маске и
   выкл"). Раньше маска работала всегда, пока в поле что-то есть, и чтобы её отключить, поле
   приходилось чистить — а вместе с ним терялась и сама маска. Теперь поле маску хранит, а
   кнопка решает, применять её или нет. Гасится ЗДЕСЬ, в одной точке: маску тянут через
   maskBits() и фон-поиск, и подсветка, и перебор — значит и выключаться им всем разом. */
function maskBits(){
  if (st.bgMaskOn === false) return "";
  return maskBitsRaw();
}
/* Одна фаза прореживания: маска прикладывается к строке начиная со своего символа phase. */
function applyPickMask(s, mask, phase){
  if (!s || !mask) return s;
  const n = mask.length;
  let out = "";
  for (let i = 0; i < s.length; i++) if (mask[(i + phase) % n] === "1") out += s[i];
  return out;
}
function computeBgSearchTarget(){
  if (!bgSearchActive()) return null;
  if (!st.selectedRows || st.selectedRows.size === 0) return null;
  // Если выделено несколько строк — ориентир самая НИЖНЯЯ (largest index), а не верхняя.
  const selIdx = Math.max(...st.selectedRows);
  if (selIdx <= 0) return null;
  // Сверяемся ВСЕГДА с паттерном строки СРАЗУ НИЖЕ выделенной — в том числе пока работает
  // "🧩 Паттерн-цепочка" (запрос пользователя: "пусть как всегда, с паттерном ниже"). Счётчик
  // уложенных паттернов на цель поиска не влияет, он только про саму кнопку.
  const targetIdx = selIdx + 1;
  // РЕЗУЛЬТАТ СЧИТАЕТСЯ ДАЖЕ БЕЗ ИСКОМОГО ПАТТЕРНА (запрос пользователя): раньше при пустом
  // паттерне строки под выделенной (или когда выделена самая нижняя строка и такой строки вообще
  // нет) функция возвращала null, и окно показывало "нет цели" вместо результата. Теперь режимы
  // считаются как обычно, просто сверять не с чем — findPatternKinds("") даёт пустой список,
  // значит kinds=[] и matched=false у всех строк.
  /* ═══ ВЫДЕЛЕННЫЕ ПАТТЕРНЫ ЗАМЕНЯЮТ ЦЕЛЬ (v1.090) ═══
     Запрос пользователя: "если выделен паттерн, то целевой паттерн для поиска от выделения цепочек
     не учитываем и не показываем, ищем только выделенный (или несколько)".
     По умолчанию фон-поиск сверяет результат с паттерном строки СРАЗУ ПОД выделением (targetIdx =
     selIdx + 1) — это и есть «цель». Выделение паттернов до сих пор сужало только «🌈 Все паттерны»
     (см. allPatsShown), а цель жила своей жизнью: её и подсвечивало, и по ней считалось «найдено».
     Получалось два искомых сразу, и выделить паттерн ради «ищи вот это» было нельзя.
     Теперь выделение паттернов ПЕРЕБИВАЕТ цель: искомым становится оно, targetIdx переезжает на
     первый выделенный паттерн (значит и подсветка «что ищем»/«найдено» встаёт на него, а не на
     строку под выделением). Пустые ячейки в счёт не идут: искать в них нечего.
     ВСЕ ВЫДЕЛЕННЫЕ РАВНОПРАВНЫ (v1.099, запрос пользователя: "когда выделено несколько паттернов —
     искать все выделенные"). В v1.090 по-настоящему искался только ПЕРВЫЙ: по нему считались kinds
     (а значит и подсветка совпадения в «Результате», и разбор в «Черновике»), остальные же лишь
     задним числом поднимали флаг «найдено», ничего не подсвечивая. Теперь findPatternKinds
     прогоняется по КАЖДОМУ выделенному, а находки складываются в один список — см. searchKinds()
     ниже. Каждая находка помечена своим patIdx, поэтому видно не только «нашлось что-то», но и
     КАКОЙ именно паттерн нашёлся: targetIdxs/hitPatIdxs едут наружу, и подсветка ячеек красит
     найденные жёлтым, а ещё не найденные — белым «ищем» (см. bgHitSuffix в render()).
     Флаг patSelMode едет наружу — по нему прогоны глушат ЗАХВАТ НАХОДКИ: захват двигает выделение
     СТРОК к цели, а тут цель не строка под выделением, а выбранный руками паттерн, и утаскивать за
     ним выделение было бы самоуправством. */
  /* ⛔ «Паттерны выше выделенной — не искать» (v1.100) режет и этот список — именно про него
     сказано «даже если они выделены». Отсекло ВСЁ выделение (все выбранные ячейки оказались выше
     границы) — patSelMode гаснет сам собой, и цель возвращается к обычной строке под выделением:
     она по определению ниже границы, так что отсечке не противоречит. */
  const patFloor = patSearchFloorIdx();
  const selPatIdxs = (st.selectedPats && st.selectedPats.size)
    ? Array.from(st.selectedPats)
        .filter(r => st.pats[r] && st.pats[r].text && (patFloor < 0 || r >= patFloor))
        .sort((a, b) => a - b)
    : [];
  const patSelMode = selPatIdxs.length > 0;
  const patTargetIdx = patSelMode ? selPatIdxs[0] : targetIdx;
  const pat = patSelMode ? st.pats[patTargetIdx]
                         : (targetIdx < st.rows.length ? st.pats[targetIdx] : null);
  const patText = pat && pat.text ? pat.text : "";
  /* Что именно ищем: при выделенных паттернах — ВСЕ они, иначе один паттерн строки под выделением.
     Пары [индекс ячейки, текст] — индекс нужен, чтобы пометить им находку (см. searchKinds). */
  const searchPats = patSelMode
    ? selPatIdxs.map(r => ({ idx: r, text: st.pats[r].text }))
    : [{ idx: targetIdx, text: patText }];
  /* Находки по ВСЕМ искомым паттернам в одном списке — той же формы, что отдаёт findPatternKinds
     (массив + свойство .tried), поэтому всё, что ниже читает kinds/tried, менять не пришлось.
     Один паттерн — старый путь без изменений: ни лишнего копирования, ни поля patIdx там, где
     оно всё равно одно и то же. */
  const searchKinds = (matchOn) => {
    if (searchPats.length === 1) return findPatternKinds(matchOn, searchPats[0].text);
    const out = [];
    const tried = [];
    for (const sp of searchPats) {
      const k = findPatternKinds(matchOn, sp.text);
      for (const it of k) { it.patIdx = sp.idx; out.push(it); }
      if (k.tried) for (const tr of k.tried) { tr.patIdx = sp.idx; tried.push(tr); }
    }
    out.tried = tried;
    return out;
  };

  // ВКЛЮЧЕНИЕ ИСКОМОЙ СТРОКИ В РАСЧЁТ — ТОЛЬКО ПОКА РАБОТАЕТ "🧩 Паттерн-цепочка" (запрос
  // пользователя: "для остальных ничего не меняем"). Без неё всё как было всегда: парные режимы
  // берут пару "та, что над выделенной + выделенная", а режимы-цепочки идут до выделенной.
  // Искомая строка идёт в расчёт ТОЛЬКО если её только что обнулила и залила своими битами
  // "🧩 Паттерн-цепочка" — то есть когда её содержимое сделано инструментом, а не найдено поиском.
  // Раньше признаком был сам счётчик уложенных паттернов, а он остаётся включённым и после того,
  // как ориентир уехал вниз — и в результат попадала строка, чей паттерн ещё не найден
  // (запрос пользователя: "нельзя включать строку, паттерн которой не был найден").
  const patChainOn = st.patChainFilledTo === targetIdx;
  // ПАРНЫЕ РЕЖИМЫ (Интерлив, Xor 2): пока работает "🧩 Паттерн-цепочка" и строка под выделенной
  // РЕАЛЬНО ею залита — пара едет вниз (выделенная + искомая), как и задумывалось. А вот при
  // "⛔ Ниже выделенной — выкл" цепочка до этой строки не доходит, patChainFilledTo остаётся -1
  // (см. patChainApplyOnce), и пара сама собой возвращается к обычной "строка НАД выделенной +
  // сама выделенная" — ровно то, чего не хватало (запрос пользователя).
  const pairTop = patChainOn ? selIdx : selIdx - 1;
  const pairBottom = patChainOn ? Math.min(selIdx + 1, st.rows.length - 1) : selIdx;
  const rowAbove = getRowBits(st, pairTop);
  const rowSel = getRowBits(st, pairBottom);
  // Выделено НЕСКОЛЬКО строк — XOR 2/XOR-Чёт ХОР-ят ТОЛЬКО их (по явному списку индексов), а не
  // "всё от 0 до самой нижней выделенной" — запрос пользователя ("если выделено несколько строк
  // то только они участвуют, а не все что выше"). null — как раньше, обычное поведение (одна
  // выделенная строка или полагаемся на диапазон 0..selIdx).
  const multiSelIdxs = (st.selectedRows && st.selectedRows.size > 1) ? Array.from(st.selectedRows).sort((a, b) => a - b) : null;
  // РЕЖИМЫ-ЦЕПОЧКИ (XOR-Все, все Сквозные, поколоночные и Диагонали): обычно считаются по строкам
  // ДО ВЫДЕЛЕННОЙ, а пока работает "🧩 Паттерн-цепочка" — по всей таблице (запрос пользователя:
  // "пусть фоновый поиск в этом случае ищет по всем строкам"), ровно по тем же строкам, в которые
  // цепочка кладёт биты: отключалка ниже выделения (patChainLastIdx) обрезает и то, и другое
  // одинаково. Парные режимы (Интерлив, Xor 2) свою пару не меняют; при мультивыделении список
  // строк задан явно и сюда не относится.
  const chainIdx = patChainOn ? patChainLastIdx(selIdx) : selIdx;
  // "lengthSums" (🧮 Суммы длин) сидит в той же группе кнопок/том же st.bgSearchModes, что и
  // остальные режимы, но не даёт ОДИН результат для сверки с паттерном — у неё своя отдельная
  // отрисовка (renderLengthSumsHtml, вкладка «Лог находок») — исключаем из этого расчёта.
  const modesAll = (st.bgSearchModes && st.bgSearchModes.length) ? st.bgSearchModes : ["interleave"];
  // "diagSplit" — легаси-ключ бывшей кнопки-модификатора "Каждая диаг. отдельно" (теперь разбивка
  // безусловная, кнопки нет). Отсеиваем, чтобы он, застряв в чьём-то сохранённом наборе, не упал
  // в ветку "иначе" и не дорисовал лишнюю строку-интерлив под чужим именем.
  const modes = modesAll.filter(m => m !== "lengthSums" && m !== "diagSplit");
  // flatMap, а не map — один режим может дать НЕСКОЛЬКО отдельных строк результата (см. "Xor 2"
  // при мультивыделении ниже: три самостоятельные строки вместо одной склейки через пробел —
  // запрос пользователя, чтобы фон-поиск сверял паттерн с КАЖДЫМ набором отдельно; в одной
  // строке-склейке совпадение через границу наборов было бы невозможно, а сам разделитель-пробел
  // мешал бы поиску).
  const mkResult = (m, result, maskPhase) => {
    // "0️⃣→ Хвост нулей по искомой строке" (st.tailZerosByTarget) — дописываем в конец столько
    // нулей, какова длина ИСКОМОЙ строки (той, что сразу под выделением, targetIdx): как будто
    // она тоже участвовала в склейке, но целиком из нулей (запрос пользователя). Сами строки не
    // трогаются — хвост живёт только в результате.
    if (st.tailZerosByTarget) {
      const tailLen = (targetIdx < st.rows.length ? (st.rows[targetIdx] || "") : "").length;
      // Первый бит хвоста — "1", остальные "0" (запрос пользователя: "не 0000, а 1000").
      if (tailLen) result = result + "1" + "0".repeat(tailLen - 1);
    }
    // "🎭 Маска" (см. maskBits/applyPickMask): ИЩЕМ по прорежённой строке, а ПОКАЗЫВАЕМ полную —
    // пропущенные биты не вырезаются из картинки, а гасятся (запрос пользователя: "маску показать
    // затемнением бит в результатах, а не вырезанием"). Само затемнение вешается уже на готовую
    // разметку, по номеру фазы из имени режима (см. dimMaskedBits в fold-2) — здесь достаточно
    // считать совпадение по правильной строке.
    const mask = maskBits();
    // "🎭 Маска заново каждый виток" (st.bgMaskRingRestart, по умолчанию включена): маска ложится
    // на САМУ строку результата, а findPatternKinds уже потом повторяет получившееся кольцом —
    // значит в каждом витке маска начинается со своей фазы. Выключено — маска идёт СКВОЗЬ витки:
    // кладём её на удвоенную строку, и на границе витка счёт не сбрасывается (запрос пользователя
    // "это надо в настройку"). Показ гасит биты ровно по тому же правилу (см. dimMaskedBits).
    const matchOn = (mask && maskPhase >= 0)
      ? applyPickMask((st.bgMaskRingRestart === false && !st.ringOff) ? result + result : result, mask, maskPhase)
      : result;
    const kinds = searchKinds(matchOn);
    // "🌈 Все паттерны" — вдобавок к обычной сверке ищем в этом же результате ВЕСЬ список
    // паттернов (см. findAllPatternsInResult). Это ТОЛЬКО подсветка: в matched такие находки НЕ
    // идут (запрос пользователя — иначе "паттерн строки N найден" писалось на каждой строке, хотя
    // сам искомый паттерн не находился и даже мог отсутствовать). matched, как и раньше, значит
    // ровно одно: совпал ИСКОМЫЙ паттерн строки под выделенной — на нём и завязаны сообщение о
    // находке, подсветка ячейки паттерна, лог, захват находки и "🛑 Стоп на находке".
    const allHits = allPatsShown() ? findAllPatternsInResult(matchOn) : null;
    /* ДЕТАЛИ МАСКИ едут ВМЕСТЕ с результатом (запрос пользователя: "в черновик или Логи надо
       расписать чёткие находки от Масок"). Панель "Результат" показывает маску только затемнением
       бит в ПОЛНОЙ строке — по ней не видно ни того, какая именно фаза что дала, ни самой
       прорежённой строки, по которой РЕАЛЬНО считалось совпадение. Кладём её сюда готовой:
       пересчитывать заново в отрисовке нельзя — арифметика витков ("🎭 Маска заново каждый виток",
       см. выше) разъехалась бы с той, по которой искали.
         phase   — номер фазы (0-based, в подписях +1, тем же счётом, что и "#мN" в имени режима);
         view    — сама маска, ПОВЁРНУТАЯ к этой фазе: ровно так она ложится на первый бит строки;
         picked  — прорежённая строка (то, что ушло в findPatternKinds);
         through — маска шла СКВОЗЬ витки кольца (галка снята), а не начиналась заново в каждом. */
    const maskInfo = (mask && maskPhase >= 0)
      ? { phase: maskPhase, mask, view: mask.slice(maskPhase) + mask.slice(0, maskPhase),
          picked: matchOn, through: (st.bgMaskRingRestart === false && !st.ringOff) }
      : null;
    // matchOn едет наружу (v0.965): по ЭТОЙ строке реально считается совпадение — с наложенной
    // "🎭 Маской" и с хвостом нулей, — и по ней же обязан искать "🔻 Полный проход". Раньше он
    // сверял чужие паттерны с полем result (полной, НЕмаскированной строкой) и при включённой
    // маске отчитывался о находках, которых на экране не было вовсе — панель-то показывает
    // совпадения по matchOn (жалоба пользователя: "ложные срабатывания, типа нашёл, но в
    // результатах не подсветил ничего").
    return { mode: m, result, matchOn, kinds, tried: kinds.tried, allHits, matched: kinds.length > 0, maskInfo };
  };
  /* Результаты ОДНОГО режима с учётом "🎭 Маски" (см. maskBits/applyPickMask выше): маски нет —
     ровно одна строка, как было всегда; маска есть — вместо неё N строк-фаз, по одной на каждый
     сдвиг маски. Строка результата у всех фаз ОДНА И ТА ЖЕ, полная — отличаются они только тем,
     какие биты в ней погашены и, соответственно, по чему считается совпадение. Имя фазы — через
     "#", тем же приёмом, что и у отдельных диагоналей ("Диаг. #3"), поэтому подписи собираются
     сами (см. bgModeLabel), а затемнение по имени и находит свою фазу (см. dimMaskedBits). */
  const mkResults = (m, result) => {
    const mask = maskBits();
    if (!mask) return [mkResult(m, result, -1)];
    return Array.from({ length: mask.length }, (_, ph) => mkResult(m + "#м" + (ph + 1), result, ph));
  };
  const results = modes.flatMap(mode => {
    let result;
    if (mode === "xor2") {
      if (multiSelIdxs) {
        // Выделено НЕСКОЛЬКО строк — запрос пользователя: считать НЕ один общий ХОР по всем (это
        // делало режим неотличимым от "XOR-Все"), а ТРИ ОТДЕЛЬНЫЕ строки результата:
        //   1) ХОР строк на НЕЧЁТНЫХ местах, считая ОТ САМОЙ ВЫДЕЛЕННОЙ вверх (сама она — место
        //      №1, значит нечётное), т.е. через одну;
        //   2) ХОР строк на ЧЁТНЫХ местах — оставшаяся половина, отдельно;
        //   3) интерливинг первых двух наборов между собой.
        // Именно тремя записями (см. flatMap/mkResult выше), а не одной склейкой через пробел —
        // так фон-поиск сверяет паттерн с каждым набором независимо.
        // Счёт мест идёт СНИЗУ ВВЕРХ (от выделенной), поэтому список выделенных индексов
        // (multiSelIdxs отсортирован по возрастанию) разворачиваем.
        const fromBottom = multiSelIdxs.slice().reverse();
        const oddIdxs = fromBottom.filter((_, k) => k % 2 === 0).sort((a, b) => a - b);
        const evenIdxs = fromBottom.filter((_, k) => k % 2 === 1).sort((a, b) => a - b);
        const oddXor = oddIdxs.length ? xorRowsFiltered(st.rows, selIdx, st.align, st, null, oddIdxs) : "";
        const evenXor = evenIdxs.length ? xorRowsFiltered(st.rows, selIdx, st.align, st, null, evenIdxs) : "";
        return mkResults("xor2odd", oddXor)
          .concat(mkResults("xor2even", evenXor),
                  mkResults("xor2mix", interleavePair(oddXor, evenXor, st.align)));
      } else {
        // "Xor 2" — ВСЕГДА ровно ДВЕ строки: выделенная и та, что прямо над ней (запрос
        // пользователя). Раньше при "½"-выравниваниях сюда подмешивались ВСЕ строки 0..selIdx из
        // той же под-сетки — это делало режим неотличимым от "XOR-Все" и противоречило самому его
        // смыслу. Никакой особой обработки полусдвига не нужно: xorRowsFiltered() складывает
        // строки ПО СТОЛБЦАМ с учётом их реального сдвига (см. rowShiftFor), поэтому полусимвольное
        // смещение соседних строк само собой даёт переплетение бит (интерлив), а совпадение
        // столбец-в-столбец — обычный XOR, ровно как и просили.
        // Все ЛЕСЕНКИ тоже сюда: их сдвиг зависит от НОМЕРА строки (см. alignShift), а xorPair()
        // видит только сами строки, без номеров — она годится лишь там, где сдвиг определяется
        // одними длинами (⇤ / ↔ / ⇥).
        const needsColumnAware = st.align === "halfcenter" ||
          st.align === "stairs" || st.align === "halfstairs" ||
          st.align === "rstairs" || st.align === "rhalfstairs" ||
          st.align === "axis" || st.align === "axis12" || st.align === "axisbit" || st.align === "axisbit12";
        if (needsColumnAware) {
          // xorPair() не знает индексов строк и потому не видит ни полусдвига, ни текущего
          // кругового/осевого сдвига (axisOffsetMap/axisBitShiftMap) — тут только xorRowsFiltered.
          result = xorRowsFiltered(st.rows, chainIdx, st.align, st, null, [pairTop, pairBottom]);
        } else {
          result = xorPair(rowAbove, rowSel, st.align);
        }
      }
    } else if (mode === "xorAll") {
      result = multiSelIdxs
        ? xorRowsFiltered(st.rows, selIdx, st.align, st, null, multiSelIdxs)
        : xorRowsDownTo(st.rows, chainIdx, st.align, st);
    } else if (mode === "concatR") {
      result = concatRowsDownTo(st, chainIdx, "right");
    } else if (mode === "concatRInv") {
      result = invertBits(concatRowsDownTo(st, chainIdx, "right"));
    } else if (mode === "concatRRevInv") {
      result = reverseStr(invertBits(concatRowsDownTo(st, chainIdx, "right")));
    } else if (mode === "concatL") {
      result = concatRowsDownTo(st, chainIdx, "left");
    } else if (mode === "concatLInv") {
      result = invertBits(concatRowsDownTo(st, chainIdx, "left"));
    } else if (mode === "concatLRevInv") {
      result = reverseStr(invertBits(concatRowsDownTo(st, chainIdx, "left")));
    } else if (mode === "concatSnake") {
      result = concatSnakeGlueDownTo(st, chainIdx);
    } else if (mode === "concatSnakeInv") {
      result = invertBits(concatSnakeGlueDownTo(st, chainIdx));
    } else if (mode === "concatSnakeRevInv") {
      result = reverseStr(invertBits(concatSnakeGlueDownTo(st, chainIdx)));
    } else if (mode === "concatSnakeFromR") {
      result = concatSnakeGlueDownTo(st, chainIdx, true);
    } else if (mode === "concatSnakeFromRInv") {
      result = invertBits(concatSnakeGlueDownTo(st, chainIdx, true));
    } else if (mode === "concatSnakeFromRRevInv") {
      result = reverseStr(invertBits(concatSnakeGlueDownTo(st, chainIdx, true)));
    } else if (mode === "vertR") {
      result = concatVerticalDownTo(st, chainIdx, "right");
    } else if (mode === "vertL") {
      result = concatVerticalDownTo(st, chainIdx, "left");
    } else if (mode === "snakeR") {
      result = concatSnakeDownTo(st, chainIdx, "right");
    } else if (mode === "snakeL") {
      result = concatSnakeDownTo(st, chainIdx, "left");
    } else if (mode === "vertZigR") {
      result = concatVertZigzagDownTo(st, chainIdx, "right");
    } else if (mode === "vertZigL") {
      result = concatVertZigzagDownTo(st, chainIdx, "left");
    } else if (mode === "diagR" || mode === "diagL") {
      // Диагонали: ↘ с перебором слева направо / ↙ справа налево. Не на "Центр ½" — пустая строка
      // (см. diagAlignOk). С включённой кнопкой "⧅ Каждая диаг. отдельно" к общей склейке
      // добавляются ещё и строки по одной диагонали — каждая со своим собственным поиском.
      const slant = mode === "diagR" ? 1 : -1;
      const ddir = mode === "diagR" ? "right" : "left";
      result = concatDiagDownTo(st, chainIdx, slant, ddir);
      // Разбивка по отдельным диагоналям — БЕЗУСЛОВНО, без отдельной кнопки-модификатора: она
      // требовала второго клика и на уже сохранённом наборе режимов молча ничего не показывала
      // (в кэше её ключа нет, а дефолтный список применяется только к чистому состоянию) —
      // запрос пользователя "не показывает". Выключается вместе с самим режимом "Диаг.".
      return mkResults(mode, result).concat(
        diagSplitResults(st, chainIdx, slant, ddir, mode).flatMap(d => mkResults(d.mode, d.result))
      );
    } else {
      // "½"-выравнивания переплетают пару по настоящим полустолбцам (см. interleavePairRows),
      // на прочих — прежний побитовый интерлив.
      result = interleavePairRows(st, pairTop, pairBottom, st.align);
    }
    return mkResults(mode, result);
  });
  const lengthSumsMatched = lengthSumsHasMatch(st, selIdx);
  /* "🔽 Все ниже" (#cBgAllBelow): результат сверяется не только с паттерном строки СРАЗУ НИЖЕ
     выделенной, а со ВСЕМИ паттернами от неё и до конца списка. Обходится дёшево: сами результаты
     режимов от искомого паттерна не зависят вовсе — они уже посчитаны выше, здесь идёт только
     сверка очередного текста с готовой строкой результата.
     Собираем ВСЕ совпавшие строки, а не только первую: их подсветку render() копит и держит до
     Сброса/Escape (запрос пользователя: "если находит — подсветить и не сбрасывать цвет, только
     отличить цветом от текущих находок").
     До этой правки галка была мёртвой: st.bgSearchAllBelow писался обработчиком и сохранялся в
     кэш, но не читался НИГДЕ — то есть "Все ниже" не делала ровным счётом ничего. */
  /* "🔻 Полный проход" (v0.963, #bFullPass, запрос пользователя: "нужен режим для фонового и
     любых автопоисков — одна кнопка — которая позволяет искать паттерны в нижних строчках и
     текущей, и захват новой строки там только по завершению всех вариантов текущей строки").
     ПЕРВАЯ половина режима — здесь: сверяемся не с одним паттерном строки СРАЗУ НИЖЕ выделенной,
     а СО ВСЕМИ ЕЩЁ НЕ НАЙДЕННЫМИ ПАТТЕРНАМИ СПИСКА СРАЗУ — и ниже выделенной, и в самой
     выделенной, и ВЫШЕ неё (уточнение пользователя: "надо искать паттерн и выше выделения, если
     он ещё не найден, и ниже"). Поэтому цикл идёт от нулевой строки, а не от targetIdx.
     ВЫШЕ выделенной берутся только НЕнайденные паттерны (p.found): найденный своё место в
     цепочке уже занял, искать его заново незачем — и он бы иначе «совпадал» каждый кадр, забивая
     подсветку и сообщения. Ниже выделенной берутся все подряд: там ещё ничего не отработано.
     Обходится дёшево: сами результаты режимов от искомого паттерна не зависят вовсе — они уже
     посчитаны выше, здесь идёт только сверка очередного текста с готовой строкой результата.
     Порог "🔎 до паттерна" при "Полном проходе" НЕ применяем намеренно: он для того и стоит,
     чтобы строка не находила себя в склейке из собственных бит, а тут пользователь просит
     искать в том числе и в своей строке.
     Всё найденное копится в bgBelowHits (см. render) и держится подсвеченным до Сброса/Escape —
     в том числе при обычном РУЧНОМ выделении строки, без всякого "Авто" (запрос пользователя).
     ВТОРАЯ половина режима (отложенный до конца цикла вариантов захват) — в autoRun(). */
  const belowHits = [];
  const belowOn = st.fullPassMode;   // «🔽 Все ниже» удалена в v1.090, остался только Полный проход
  // ⛔ «Паттерны выше выделенной — не искать» (v1.100) обрезает и "Полный проход": без неё он берёт
  // список от самого верха (0), в этом его смысл. Отсечка выключена — patSearchFloorIdx() даёт −1,
  // и старт остаётся прежним нулём.
  const belowFrom = st.fullPassMode ? Math.max(0, patSearchFloorIdx()) : targetIdx;
  if (belowOn) {
    const lastBelow = Math.max(st.rows.length, st.pats.length);
    for (let r = belowFrom; r < lastBelow; r++) {
      const pr = st.pats[r];
      const t = pr && pr.text ? pr.text : "";
      if (!t) continue;
      // Выше выделенной — только то, что ещё не найдено (см. шапку блока).
      if (st.fullPassMode && r < selIdx && pr.found) continue;
      // Та же оговорка, что и у "🌈 Все паттерны" (см. bgDeepRow в render): при "🔎 до паттерна"
      // строка, чьи собственные биты вошли в цепочку, себя же в ней находить не должна. Обычно
      // сюда не попадает никто — цикл и так идёт ниже выделенной, — но "🧩 Паттерн-цепочка"
      // уводит chainIdx ниже, и вот тогда порог начинает работать.
      if (!st.fullPassMode && st.allPatScopeSel && r <= Math.max(chainIdx, pairBottom)) continue;
      for (const res of results) {
        // Ищем ровно в той строке, по которой судит панель (см. matchOn в mkResult).
        const hay = res.matchOn || res.result;
        if (!hay) continue;
        const kk = findPatternKinds(hay, t);
        if (!kk.length) continue;
        belowHits.push(r);
        /* ПОДСВЕТКА ЧУЖОЙ НАХОДКИ (v0.965). Обычный фон-поиск красит в результате только kinds —
           а это совпадения ИСКОМОГО паттерна (строки targetIdx). Находка любого другого паттерна
           не рисовалась ничем, и режим выглядел как враньё: "паттерн строки N найден", а в
           "Результате" пусто. Кладём её в allHits того же результата — дальше её рисует уже
           готовый механизм "🌈 Все паттерны" (свой цвет по номеру паттерна, те же mapPos для
           прорежённой маской строки, см. allPatAt в render). Сам targetIdx сюда не берём: его
           kinds уже подсветили, второй слой поверх только сменил бы цвет привычной находки. */
        if (st.fullPassMode && r !== targetIdx) {
          if (!res.allHits) res.allHits = [];
          for (const kd of kk) res.allHits.push({ patIdx: r, start: kd.start, len: kd.len, kind: kd.kind });
        }
        break;
      }
    }
  }
  // primaryMatched — совпал паттерн ИМЕННО строки targetIdx (обычная находка фон-поиска, ровно то,
  // что раньше и называлось matched). При "🔻 Полном проходе" находкой считается ещё и совпадение
  // любого паттерна из belowHits — иначе режим искал бы в своей/нижних строках, но прогон об этом
  // не узнавал бы (matched читают и "🛑 Стоп на находке", и захват, и все автопоиски).
  const primaryMatched = results.some(r => r.matched) || lengthSumsMatched;
  /* КАКИЕ ИМЕННО из искомых паттернов нашлись (v1.099). Отдельный второй проход по остальным
     выделенным (v1.090) больше не нужен: searchKinds уже прогнала их ВСЕ, и находка любого сама
     попала в kinds — значит и в r.matched, и в primaryMatched выше. Остаётся собрать индексы:
     ими подсветка отличает найденные ячейки от ещё не найденных. patIdx проставлен только при
     нескольких искомых (см. searchKinds) — при одном находка может относиться лишь к нему. */
  const hitPatIdxs = new Set();
  for (const res of results) {
    if (!res.kinds || !res.kinds.length) continue;
    for (const k of res.kinds) hitPatIdxs.add(k.patIdx !== undefined ? k.patIdx : patTargetIdx);
  }
  return {
    targetIdx: patTargetIdx, patSelMode, results, belowHits, primaryMatched,
    // Все ячейки-цели (при выделенных паттернах их несколько) и те из них, что реально нашлись.
    targetIdxs: searchPats.map(sp => sp.idx), hitPatIdxs,
    matched: primaryMatched || (st.fullPassMode && belowHits.length > 0),
    aboveIdx: pairTop, selIdx: pairBottom, anchorIdx: selIdx, rowAbove, rowSel, lengthSumsMatched,
    // По какую строку включительно собирались режимы-цепочки — нужен подсветке находки в самих
    // строках (см. bgConcatCellMap в render()), чтобы разложить совпадение обратно по строкам.
    chainIdx
  };
}

/* === "Спираль": строки в диапазоне (см. colSelectRowRange — весь список, либо от начала до
   выделенной строки, либо между двумя крайними выделенными) читаются ОДНОЙ непрерывной лентой
   символов сверху вниз, сдвигаются по кругу на 1 символ (перенос с одного конца ленты на
   другой), затем нарезаются обратно по ИСХОДНЫМ длинам строк — портировано 1:1 из
   manualElkaShift() в Zerkalius-genezis.html (dir=-1 — влево по ленте: первый символ уходит в
   конец; dir=1 — вправо: последний символ встаёт в начало). */
/* silent=true (см. autoRun()/st.lastDirMode) — пропускает свои snapshot()/render()/saveCache(),
   вызывающий код сам берёт snapshot один раз ДО цикла и render/saveCache раз в кадр, а не на
   каждый отдельный шаг. Возвращает true/false — сделан ли реально шаг (буфер меньше 2 символов/
   нет строк — false, стоп). */
function spiralStep(dir, silent){
  const n = st.rows.length;
  if (!n) return false;
  const range = colSelectRowRange();
  const lo = Math.max(0, range.lo);
  const hi = Math.min(n - 1, range.hi === Infinity ? n - 1 : range.hi);
  if (hi < lo) return false;

  const rowLengths = [];
  let buffer = [];
  for (let i = lo; i <= hi; i++) {
    const s = st.rows[i] || "";
    rowLengths.push(s.length);
    buffer = buffer.concat(s.split(""));
  }
  if (buffer.length <= 1) return false;

  if (!silent) snapshot();
  if (dir === 1) {
    const last = buffer.pop();
    buffer.unshift(last);
  } else {
    const first = buffer.shift();
    buffer.push(first);
  }

  let ptr = 0;
  for (let k = 0; k < rowLengths.length; k++) {
    const len = rowLengths[k];
    st.rows[lo + k] = buffer.slice(ptr, ptr + len).join("");
    ptr += len;
  }
  if (!silent) { render(); saveCache(); }
  return true;
}
function spiralMove(vDir, silent){
  // "право" по ленте — это "вверх", если переключатель на "right"; иначе — наоборот.
  const rightIsUp = st.spiralUpDir === "right";
  const dir = (vDir === "up") === rightIsUp ? 1 : -1;
  return spiralStep(dir, silent);
}
const bSpiralUpEl = document.getElementById("bSpiralUp");
if (bSpiralUpEl) bSpiralUpEl.onclick = () => { setLastDirMode("spiralUp"); spiralMove("up"); };
const bSpiralDownEl = document.getElementById("bSpiralDown");
if (bSpiralDownEl) bSpiralDownEl.onclick = () => { setLastDirMode("spiralDown"); spiralMove("down"); };

function step(pairOnly, forceXor = false, isScan = false, isHorizXor = false, isXorProj = false, horizDir = "right"){
  readToggles();
  if (!doStep(pairOnly, forceXor, isScan, isHorizXor, isXorProj, horizDir)) say("Шаг не выполнен: двигаться некуда.");
  else say("");
  render();
  saveCache();
}

function autoRun(){
  readToggles();
  st.running = true;
  setAutoBtnState(true);

  // Последняя нажатая из 4 кнопок направления (◄ ► ▲ ▼ Спираль, см. st.lastDirMode/
  // setLastDirMode()) — "Авто" повторяет именно её, пока не найдётся стоп-условие (нечего
  // больше сдвигать, ИЛИ фон-поиск нашёл совпадение при включённом "Стоп на находке") или
  // пользователь не нажмёт ⏹ Стоп. snapshot() один раз ДО цикла — Undo одним кликом откатывает
  // весь прогон целиком, а не по шагу.
  if (st.lastDirMode) {
    const isShift = st.lastDirMode === "shiftL" || st.lastDirMode === "shiftR" || st.lastDirMode === "shiftLInv" || st.lastDirMode === "shiftRInv";
    const isShiftInv = st.lastDirMode === "shiftLInv" || st.lastDirMode === "shiftRInv";
    const dirLabel = { shiftL: "◄", shiftR: "►", shiftLInv: "◄ Инв", shiftRInv: "► Инв", spiralUp: "▲ Спираль", spiralDown: "▼ Спираль" }[st.lastDirMode];
    snapshot();

    // Общее число вариантов ДО старта: круговой сдвиг строки длины L возвращает её к исходному
    // виду ровно через L сдвигов; у спирали — через buffer.length шагов (вся лента диапазона
    // целиком). РАНЬШЕ тут вообще не считалось — ◄/►/▲/▼ крутились БЕСКОНЕЧНО, пока не нажмёшь
    // Стоп, даже если весь цикл вариантов давно пройден без находки.
    // Если выделено НЕСКОЛЬКО строк РАЗНОЙ длины — они крутятся все разом на 1 позицию за ход,
    // поэтому комбинация "какая строка в каком повороте" целиком повторяется не через max(длин)
    // (было раньше — занижало счётчик, останавливало раньше времени, теряя реальные варианты),
    // а через НОК(длин) — общее наименьшее число ходов, кратное длине каждой строки одновременно
    // (было раньше просто max — тем самым часть комбинаций до НОК просто не перебиралась).
    // У "Круг Инв" период В ДВА РАЗА длиннее (2×НОК) — см. rotateStrRightInv()/rotateStrLeftInv():
    // каждый бит переворачивается ровно раз за L шагов, к исходному ЗНАЧЕНИЮ (не только позиции)
    // он возвращается только после ВТОРОГО полного круга.
    let totalTurns = 0;
    // Строки, которые реально крутятся — начинаем с ТЕКУЩЕГО выделения (не пересчитываем из
    // st.selectedRows на каждой итерации, т.к. там ЕЩЁ и найденные строки от фон-поиска — их
    // подмешиваем сюда же ОТДЕЛЬНО, см. ниже). rotIdxs — Set, а не застывший массив: когда
    // находка добавляет строку в выделение, она ТУТ ЖЕ добавляется и в rotIdxs — со следующего
    // же хода крутится вместе с остальными (не с нуля, просто вливается в текущий прогон),
    // никакого сброса накрутки уже идущих строк при этом не происходит — запрос пользователя
    // ("иногда не крутит новые — надо крутить вместе с новыми, не сбрасывая предыдущую накрутку").
    const rotIdxs = isShift
      ? new Set((st.selectedRows && st.selectedRows.size > 0) ? Array.from(st.selectedRows) : st.rows.map((_, i) => i))
      : null;
    if (isShift) {
      // Тот же принцип, что и у ручного сдвига: прогон крутит всё, что видно.
      mirrorsBeforeShift();
      totalTurns = computeShiftTotalTurns(rotIdxs, isShiftInv);
    } else {
      const range = colSelectRowRange();
      const lo = Math.max(0, range.lo);
      const hi = Math.min(st.rows.length - 1, range.hi === Infinity ? st.rows.length - 1 : range.hi);
      for (let i = lo; i <= hi; i++) totalTurns += (st.rows[i] || "").length;
    }
    let turns = 0;
    /* "🔻 Полный проход" (v0.963): находки за текущий цикл вариантов КОПЯТСЯ здесь, а захват
       строк делается один раз — когда цикл пройден целиком (запрос пользователя: "захват новой
       строки там только по завершению всех вариантов текущей строки"). Обычный режим захватывает
       сразу на находке и тем самым обрывает перебор оставшихся вариантов текущей строки. */
    const pendingHits = new Set();
    st.shiftVariantTotal = isShift ? totalTurns : null;
    // Номера строк (те же 0-based номера, что и в самой таблице — см. .num), которые реально
    // крутятся сейчас — запрос пользователя: показывать в счётчике не только N/M, но и КАКИЕ
    // строки участвуют.
    st.shiftVariantRows = isShift ? Array.from(rotIdxs) : null;
    st.shiftVariantTurns = 0;
    st.stepStale = false; // прогон пошёл — номер шага снова живой (см. finishAuto)
    updateVariantCounter();

    // Через сколько шагов оживлять счётчик в режиме "⏩ Турбо" (см. ниже). 100 — потому что
    // реальная частота всё равно упирается в кадр: за один tick делается целая пачка шагов, и
    // чаще одного обновления за кадр этого не случится при любом пороге. Больший порог (1000) на
    // медленном переборе — это уже секунды тишины, меньший ничего не ускоряет.
    const TURBO_REPORT_STEP = 100;
    let lastTurboReport = 0;

    const tick = () => {
      if (!st.running) return finishAuto();

      const t0 = performance.now();
      let moved = true;
      let bgHit = null;
      let balanceHit = false;
      let cycleDone = false;
      // Была ли находка в ЭТОЙ пачке — не то же самое, что bgHit: тот выставляется только при
      // включённом "🛑 Стоп на находке". В режиме "⏩ Турбо" именно по этому флагу решается,
      // показывать кадр или нет.
      let hadHit = false;
      while (autoBatch(t0)) {
        if (totalTurns > 0 && turns >= totalTurns) { cycleDone = true; break; }
        if (isShift) {
          if (rotIdxs.size === 0 || ![...rotIdxs].some(i => st.rows[i])) { moved = false; break; }
          for (const i of rotIdxs) if (st.rows[i]) {
            // "⊙ Ось" — см. shiftOneRowAxisAware(): под Авто крутит только картинку, не данные.
            if (st.lastDirMode === "shiftL") shiftOneRowAxisAware(i, 1, rotateStrLeft, rotateInvFlagsLeft);
            else if (st.lastDirMode === "shiftR") shiftOneRowAxisAware(i, -1, rotateStrRight, rotateInvFlagsRight);
            else if (st.lastDirMode === "shiftLInv") shiftOneRowAxisAware(i, 1, rotateStrLeftInv, rotateInvFlagsLeftInv);
            else shiftOneRowAxisAware(i, -1, rotateStrRightInv, rotateInvFlagsRightInv);
          }
        } else {
          moved = spiralMove(st.lastDirMode === "spiralUp" ? "up" : "down", true);
          if (!moved) break;
        }
        // Зеркала сверху следуют за своими строками на КАЖДОМ провороте — они участвуют в поиске,
        // поэтому обновить их нужно до computeBgSearchTarget() ниже (см. refreshTopMirrors).
        refreshTopMirrors();
        turns++;
        // Счётчик обновляем ПРЯМО ТУТ, а не в конце пачки: за один tick делается много шагов, и
        // находка внутри пачки должна попасть в лог со СВОИМ номером шага, а не с номером
        // последнего шага пачки.
        st.shiftVariantTurns = turns;

        const bgInfo = computeBgSearchTarget();
        if (bgInfo && bgInfo.matched) {
          hadHit = true;
          // Находка СРАЗУ добавляется к выделению (не заменяет его — запрос пользователя), если
          // включена "🧲 Захват находки" (st.captureOnFind) — работает для ЛЮБОГО выделения, в
          // т.ч. одной строки (раньше — только если исходно было выделено несколько). Найденная
          // строка ТУТ ЖЕ добавляется и в rotIdxs — со СЛЕДУЮЩЕГО хода крутится вместе с
          // остальными как ни в чём не бывало, накрутка уже идущих строк при этом не сбрасывается
          // (запрос пользователя — раньше найденные строки вообще никогда не крутились дальше,
          // что выглядело как баг). Останавливаемся только если включено "Стоп на находке".
          // "⬇ Расширять вниз" (st.growDownOnFind) работает и сам по себе, без "🧲 Захвата", и
          // сильнее его: окно не едет, выделение только растёт вниз (см. captureFoundRow).
          if (st.fullPassMode) {
            // "🔻 Полный проход": НИЧЕГО не захватываем прямо сейчас — только запоминаем, что
            // именно совпало, и крутим дальше. Захват будет на cycleDone, когда все варианты
            // текущей строки перебраны. Свою строку (selIdx) в копилку не берём — она и так
            // выделена, захватывать нечего.
            if (bgInfo.primaryMatched) pendingHits.add(bgInfo.targetIdx);
            if (bgInfo.belowHits) for (const r of bgInfo.belowHits) if (r > bgInfo.anchorIdx) pendingHits.add(r);
          } else if ((st.captureOnFind || st.growDownOnFind) && !bgInfo.patSelMode) {
            // patSelMode — ищем ВЫДЕЛЕННЫЙ ПАТТЕРН (v1.090): цель не строка под выделением, тянуть
            // за ней выделение строк нечего. См. тот же запрет в afterShiftBgCheck().
            // При МУЛЬТИвыделении окно едет с постоянным размером — выброшенную сверху строку
            // убираем и из набора вращаемых, иначе она продолжала бы крутиться, уже не будучи
            // выделенной (см. captureFoundRow).
            const dropped = captureFoundRow(bgInfo.targetIdx, st.growDownOnFind);
            rotIdxs.add(bgInfo.targetIdx);
            if (dropped >= 0) rotIdxs.delete(dropped);
            // ...и дальше по подряд идущим строкам, помеченным "🔽 Все ниже" (см. captureBelowRun).
            for (const [idx, dr] of captureBelowRun(st.growDownOnFind)) {
              rotIdxs.add(idx);
              if (dr >= 0) rotIdxs.delete(dr);
            }
          }
          // "🎯 При находке: достраивать" — верх достраивается сам, ровно как по кнопке. Строки при
          // этом вставляются СВЕРХУ, значит все индексы, которые держит прогон, съезжают вниз —
          // пересобираем набор вращаемых строк на ту же величину, иначе прогон продолжил бы крутить
          // не те строки.
          {
            mirrorsAutoStep();
            const delta = topBuildOnHitStep();
            if (delta && rotIdxs) {
              const moved = Array.from(rotIdxs).map(r => r + delta);
              rotIdxs.clear();
              for (const r of moved) rotIdxs.add(r);
            }
          }
          // При "🔻 Полном проходе" "🛑 Стоп на находке" НЕ рвёт перебор: смысл режима как раз в
          // том, чтобы досмотреть все варианты текущей строки. Остановка (если она включена)
          // случится на cycleDone, уже после захвата.
          if (st.stopOnHit && !st.fullPassMode) { bgHit = bgInfo; break; }
        }

        // "🛑 Стоп при балансе" — суммарно по ВСЕМ выделенным строкам единиц и нулей стало
        // поровну. У обычного Круга (без Инв) сумма 1/0 внутри строки не меняется вращением
        // вообще (только порядок бит) — эта остановка реально полезна для Круг Инв, где каждый
        // ход переворачивает ровно один бит и баланс сдвигается — запрос пользователя.
        if (isShift && st.stopOnBalance) {
          const { total1, total0 } = computeSelBalance();
          if (total1 === total0) { balanceHit = true; break; }
        }
      }

      st.shiftVariantTurns = turns;
      if (isShift) st.shiftVariantRows = Array.from(rotIdxs); // могло вырасти находками
      // "⏩ Турбо": во время прокрутки не рисуем и не сохраняем вообще — картинка обновляется
      // только когда что-то реально произошло (находка, баланс, конец цикла, нечего двигать) и
      // ещё раз в finishAuto() на выходе. Именно перерисовка таблицы и запись кэша в localStorage
      // на КАЖДОМ кадре съедали основное время, а промежуточные варианты на такой скорости всё
      // равно не читаются глазами (запрос пользователя — "чтобы вообще не крутила, а меняла
      // строки только во время находки"). Сам перебор идёт с прежней плотностью.
      // Замедление сильнее Турбо: смысл замедления в том, чтобы КАЖДЫЙ шаг был виден.
      const showFrame = st.slowAuto || !st.turboAuto || hadHit || balanceHit || cycleDone || !moved;
      if (showFrame) {
        say(`Авто (${dirLabel}): вариант ${turns}` + (totalTurns ? ` из ${totalTurns}` : ""));
        updateVariantCounter();
        render(); saveCache();
        lastTurboReport = turns;
      } else if (turns - lastTurboReport >= TURBO_REPORT_STEP) {
        // Турбо идёт вслепую, и без единой цифры на экране непонятно, работает ли он вообще
        // (запрос пользователя). Показываем ТОЛЬКО номер шага: это две записи текста в готовые
        // элементы, без render() и без saveCache() — то есть без всего, ради чего Турбо и нужен.
        // Чаще, чем раз в кадр, оно всё равно не случится: пачка шагов делается за один tick.
        lastTurboReport = turns;
        say(`⏩ Турбо (${dirLabel}): шаг ${turns}` + (totalTurns ? ` из ${totalTurns}` : "") + " — идёт поиск…");
        updateVariantCounter();
      }
      if (bgHit) {
        return finishAuto(`🎯 Авто (${dirLabel}): найдено совпадение на строке ${bgHit.targetIdx + 1}!`);
      }
      if (balanceHit) {
        return finishAuto(`⚖ Авто (${dirLabel}) остановлен: баланс единиц и нулей по выделенным строкам сравнялся.`);
      }
      if (cycleDone && st.fullPassMode && pendingHits.size) {
        /* ВЕСЬ ЦИКЛ ВАРИАНТОВ ТЕКУЩЕЙ СТРОКИ ПРОЙДЕН — вот теперь захватываем. Строки берём ПО
           ПОРЯДКУ сверху вниз (тот же принцип, что у captureBelowRun: перескакивать через
           неотработанный участок нельзя), захват — обычный captureFoundRow, то есть с учётом
           "⬇ Расширять вниз", разделителей и нулевой строки.
           Дальше начинается НОВЫЙ круг: набор вращаемых строк вырос, значит и предел вариантов
           у него другой — пересчитываем totalTurns и обнуляем turns, иначе прогон тут же снова
           упёрся бы в старый предел. */
        const list = Array.from(pendingHits).sort((a, b) => a - b);
        const taken = [];
        for (const idx of list) {
          const dropped = captureFoundRow(idx, st.growDownOnFind);
          if (idx >= 0 && idx < st.rows.length) taken.push(idx);
          rotIdxs.add(idx);
          if (dropped >= 0) rotIdxs.delete(dropped);
        }
        pendingHits.clear();
        turns = 0;
        if (isShift) {
          mirrorsBeforeShift();
          totalTurns = computeShiftTotalTurns(rotIdxs, isShiftInv);
          st.shiftVariantTotal = totalTurns;
          st.shiftVariantRows = Array.from(rotIdxs);
        }
        st.shiftVariantTurns = 0;
        updateVariantCounter();
        render(); saveCache();
        const takenTxt = taken.length ? taken.map(r => rowLabel(r)).join(", ") : "—";
        if (st.stopOnHit) {
          return finishAuto(`🔻 Полный проход (${dirLabel}): цикл вариантов пройден, захвачены строки ${takenTxt}. Остановлено по «🛑 Стоп на находке».`);
        }
        say(`🔻 Полный проход (${dirLabel}): цикл вариантов пройден, захвачены строки ${takenTxt} — пошёл новый круг.`);
        autoFrame(tick);
        return;
      }
      if (cycleDone) return finishAuto(`Авто (${dirLabel}) остановлен: полный цикл вариантов (${turns} из ${totalTurns}) пройден, совпадений не найдено.`);
      if (!moved) return finishAuto(`Авто (${dirLabel}) остановлен: больше нечего сдвигать.`);
      autoFrame(tick);
    };
    autoFrame(tick);
    return;
  }

  if (st.xorSelectedMode) {
    const tick = () => {
      if (!st.running) return finishAuto();

      const t0 = performance.now();
      let stepsCount = 0;
      while (autoBatch(t0)) {
        if (!doXorSelectedStep()) {
          return finishAuto(`Режим XOR выдел завершен (выполнено ${stepsCount} сдвигов).`);
        }
        stepsCount++;
      }

      render();
      autoFrame(tick);
    };
    autoFrame(tick);
    return;
  }

  if (st.interleaveMode) {
    const tick = () => {
      if (!st.running) return finishAuto();

      const t0 = performance.now();
      let stepsCount = 0;
      while (autoBatch(t0)) {
        if (!doInterleaveStep()) {
          return finishAuto(`Режим Интерливинг завершен (выполнено ${stepsCount} шагов).`);
        }
        stepsCount++;
      }

      render();
      autoFrame(tick);
    };
    autoFrame(tick);
    return;
  }

  if (st.interleaveSeqMode) {
    // Один тик = один ВЫЗОВ doInterleaveSeqStep() = один сдвиг сквозной (не пакет за 12мс, как у
    // остальных режимов) — см. запрос пользователя: нужно видеть каждый сдвиг в Черновике
    // последнего шага, а не только финальный результат перебора.
    const tick = () => {
      if (!st.running) return finishAuto();
      if (!doInterleaveSeqStep()) {
        return finishAuto(`Режим Интерлив сквозной завершен.`);
      }
      autoFrame(tick);
    };
    autoFrame(tick);
    return;
  }

  if (st.xorSeqMode) {
    // Та же логика, что и у st.interleaveSeqMode выше — один тик = один сдвиг.
    const tick = () => {
      if (!st.running) return finishAuto();
      if (!doXorSeqStep()) {
        return finishAuto(`Режим XOR сквозной завершен.`);
      }
      autoFrame(tick);
    };
    autoFrame(tick);
    return;
  }

  const { pairOnly, forceXor, isScan, isHorizXor, isXorProj, horizDir } = getModeParams(st.mode || "step1");

  const tick = () => {
    if (!st.running) return finishAuto();

    // Оптимизация 4: Time-based батчинг
    const t0 = performance.now();
    let stepsCount = 0;
    while (autoBatch(t0)) {
      if (!doStep(pairOnly, forceXor, isScan, isHorizXor, isXorProj, horizDir)) {
        return finishAuto(`Прогон завершен: двигаться некуда (выполнено ${stepsCount} ш. в посл. кадре).`);
      }

      // Авто-остановка на находке (не применяется к Гориз.XOR — там находка не прерывает
      // проход, доходить до конца строки/цепочки решает сам doStep)
      if (st.stopOnHit && st.hit && !isHorizXor) {
        return finishAuto(`🎯 Найдено совпадение! Авто-прогон остановлен.`);
      }

      stepsCount++;
    }

    render();
    autoFrame(tick);
  };
  autoFrame(tick);
}

/* === "🐢 ЗАМЕДЛЕНИЕ" ===
   Прогон Авто во всех режимах устроен одинаково: тик rAF, а внутри — пачка шагов, сколько влезет
   в 12 мс. Замедление ломает обе половины этой схемы, не трогая сами режимы:
   autoBatch() — условие пакетного цикла: с замедлением пропускает РОВНО ОДИН шаг за тик
     (второй вызов на том же t0 возвращает false). Если цикл вышел раньше по break/return, флаг
     останется от прежнего t0 — а он у следующего тика уже другой, так что сбой не накапливается.
   autoFrame() — планировщик следующего тика: держит кадр st.slowFrames кадров экрана.
   Турбо и Замедление противоречат друг другу (один прячет кадры, другой их показывает) — при
   включённом замедлении кадр рисуется всегда, см. showFrame в autoRun(). */
var autoSlowT0 = -1;
function autoBatch(t0){
  if (!st.slowAuto) return performance.now() - t0 < 12;
  if (autoSlowT0 === t0) { autoSlowT0 = -1; return false; }
  autoSlowT0 = t0;
  return true;
}
function autoFrame(fn){
  const n = st.slowAuto ? Math.max(1, st.slowFrames | 0) : 1;
  if (n <= 1) return requestAnimationFrame(fn);
  let left = n;
  const hop = () => { if (--left <= 0) fn(); else requestAnimationFrame(hop); };
  return requestAnimationFrame(hop);
}
function slowAutoSync(){
  const b = document.getElementById("bSlowAuto");
  if (b) b.classList.toggle("mode-act", !!st.slowAuto);
  const r = document.getElementById("slowFrames");
  if (r) r.value = st.slowFrames || 10;
  const v = document.getElementById("slowFramesVal");
  if (v) v.textContent = String(st.slowFrames || 10);
}
{
  const b = document.getElementById("bSlowAuto");
  if (b) b.onclick = () => {
    st.slowAuto = !st.slowAuto;
    slowAutoSync();
    say(st.slowAuto
      ? `🐢 Замедление включено: один шаг за раз, ${st.slowFrames || 10} кадр(ов) на шаг.`
      : "🐢 Замедление выключено — Авто снова идёт пачками.");
    saveCache();
  };
  slowAutoSync(); // стартовое состояние кнопки/ползунка из st (дальше — из кэша, см. loadCache)
  const r = document.getElementById("slowFrames");
  if (r) r.oninput = () => {
    st.slowFrames = Math.max(1, Math.min(60, +r.value || 1));
    slowAutoSync();
    saveCache();
  };
}

function finishAuto(m){
  st.running = false;
  setAutoBtnState(false);
  // Прогон кончился — счётчик шагов больше не живой. Дальше находки могут появляться от чего
  // угодно (клик по строке, правка, смена режима), и штамповать их последним номером прогона
  // нельзя: в логе получался столбик из одного и того же числа (запрос пользователя "не пишет
  // все шаги, стопорится на каком-то"). Такие находки идут БЕЗ номера.
  st.stepStale = true;
  render();
  saveCache();
  if (m) say(m);
}

document.getElementById("bStep").onclick     = () => doModeStep("step1");
document.getElementById("bStep2").onclick    = () => doModeStep("step2");
document.getElementById("bStepXor").onclick  = () => doModeStep("xor1");
document.getElementById("bStep2Xor").onclick = () => doModeStep("xor2");
// ◄/►Гориз.XOR: если есть выделенная строка — старт СРАЗУ с неё (st.bIdx), а не с того, что
// осталось от прошлого режима (st.aIdx/bIdx общие на всё приложение, по умолчанию 0/1) —
// запрос пользователя.
function startHorizXor(modeName){
  if (st.selectedRows && st.selectedRows.size > 0) {
    const idx = Math.max(...st.selectedRows);
    st.bIdx = idx;
    st.aIdx = Math.max(0, idx - 1);
  }
  doModeStep(modeName);
}
document.getElementById("bStepHorizXor").onclick = () => startHorizXor("horiz_xor");
document.getElementById("bStepHorizXorLeft").onclick = () => startHorizXor("horiz_xor_left");
/* "⏬ Проекц.XOR" — XOR ВЫДЕЛЕННОЙ СТРОКИ С ОДНОЙ ВЕРХНЕЙ ЗА НАЖАТИЕ (запрос пользователя):
   первое нажатие складывает её с БЛИЖАЙШЕЙ строкой сверху, второе — со следующей выше, и так
   вверх по цепочке. Результат каждый раз ложится в саму выделенную строку.
   БЕРУТСЯ ТОЛЬКО ТЕ ВЕРХНИЕ СТРОКИ, У КОТОРЫХ ЕСТЬ БИТ НАД БИТОМ выделенной — то есть строки,
   реально пересекающиеся с ней по столбцам (см. rowsOverlapCols). Строка, стоящая совсем сбоку,
   в XOR ничего бы не изменила по существу, только растянула бы результат, — такие пропускаются.
   На "½"-выравниваниях строка ЧУЖОЙ подсетки тоже пропускается: её биты стоят в полустолбцах
   между битами выделенной, друг над другом они не стоят никогда.
   Складывает xorRowsFiltered — по настоящим столбцам, с учётом выравнивания, полустолбцов и
   показанных зеркал. Счётчик "докуда дошли" привязан к строке: сменили выделение — счёт с нуля. */
var xorProjStep = { target: -1, upto: -1 };
/* Половина столбца, с которой начинается строка на экране, — тот же расчёт, что в
   xorRowsFiltered (сдвиг по СОБСТВЕННОЙ длине, левое зеркало отодвигает начало влево). */
function rowColStart2x(st, i, s, m, maxLen, align){
  const own = (m.l || m.r) ? s.slice(m.l, s.length - m.r) : s;
  return 2 * (rowShiftFor(maxLen, i, own, align) - m.l) + rowHalf2x(i, own, align, maxLen);
}
/* Есть ли у двух строк хоть один ОБЩИЙ столбец — "бит над битом". Разная подсетка ("½") — нет
   никогда: биты стоят через полсимвола и друг над другом не встают. */
function rowsOverlapCols(st, i, j, align){
  const si = getRowBits(st, i), sj = getRowBits(st, j);
  if (!si.length || !sj.length) return false;
  const mi = mirrorPadsOf(st, i), mj = mirrorPadsOf(st, j);
  const maxLen = Math.max(si.length - mi.l - mi.r, sj.length - mj.l - mj.r);
  const ai = rowColStart2x(st, i, si, mi, maxLen, align);
  const aj = rowColStart2x(st, j, sj, mj, maxLen, align);
  if ((ai ^ aj) & 1) return false;
  return Math.max(ai, aj) <= Math.min(ai + 2 * (si.length - 1), aj + 2 * (sj.length - 1));
}
document.getElementById("bStepXorProj").onclick = () => {
  if (!st.selectedRows || !st.selectedRows.size) { say("⏬ Проекц.XOR: выделите строку кликом."); return; }
  const target = Math.max(...st.selectedRows);
  if (!getRowBits(st, target).length) { say("⏬ Проекц.XOR: выделенная строка пуста."); return; }
  // Продолжаем подъём по той же строке или начинаем заново, если выделение сменилось.
  const from = (xorProjStep.target === target && xorProjStep.upto > 0) ? xorProjStep.upto - 1 : target - 1;
  let src = -1;
  for (let r = from; r >= 0; r--) {
    if (!getRowBits(st, r).length) continue;
    if (!rowsOverlapCols(st, r, target, st.align)) continue;
    src = r; break;
  }
  if (src < 0) {
    xorProjStep = { target: -1, upto: -1 };
    say(`⏬ Проекц.XOR: выше строки ${rowLabel(target)} подходящих строк больше нет (нужен бит над битом) — счёт начат заново.`);
    return;
  }
  const res = xorRowsFiltered(st.rows, target, st.align, st, null, [src, target]);
  if (!res.length) { say("⏬ Проекц.XOR: складывать нечего."); return; }
  snapshot();
  const before = st.rows[target];
  st.rows[target] = res;
  // Строка переписана целиком — позиционные флаги к ней больше не относятся.
  insertedFlagsMap.delete(target);
  invFlagsMap.delete(target);
  maskChangedMap.clear(); maskBaseRows = null;
  st.hit = null;
  xorProjStep = { target: target, upto: src };
  logStep("Проекция XOR", `${rowLabel(src)}+${rowLabel(target)}`, res,
    `XOR со строкой ${rowLabel(src)} записан в строку ${rowLabel(target)}`,
    [{ row: target + 1, before, after: res }],
    [{ name: `№${rowLabel(src)}`, text: getRowBits(st, src) }, { name: `№${rowLabel(target)}`, text: before }]);
  say(`⏬ Проекц.XOR: строка ${rowLabel(target)} сложена со строкой ${rowLabel(src)} — ${res.length} бит. Следующее нажатие возьмёт строку выше.`);
  // ВЫДЕЛЕНИЕ НЕ ТРОГАЕМ ВООБЩЕ (запрос пользователя): захвата находки тут нет, выделение остаётся
  // на той же строке — иначе подъём вверх сбивался бы, ему нужна одна и та же цель.
  render(); saveCache();
};document.getElementById("bStepScan").onclick = () => doModeStep("scan");
/* "🔎 Проверка (без сдвигов)" — см. doPlainCheck() в fold-4. НЕ через doModeStep/setMode: это не
   режим для "Авто" (гонять его в цикле бессмысленно — строки не меняются, ответ был бы один и тот
   же каждый кадр), а разовая проверка текущего положения. Поэтому и в STEP_MODE_BTN_IDS её нет:
   взаимоисключающую подсветку .mode-act она не занимает и чужой выбранный режим не сбивает. */
const bPlainCheckEl = document.getElementById("bPlainCheck");
if (bPlainCheckEl) bPlainCheckEl.onclick = () => doPlainCheck();

document.getElementById("bAuto").onclick  = () => { if (st.running) st.running = false; else autoRun(); };
document.getElementById("bUndo").onclick  = () => {
  if (!restore()) say("Откатывать нечего.");
  render(); saveCache();
};
const bRedoEl = document.getElementById("bRedo");
if (bRedoEl) bRedoEl.onclick = () => {
  if (!redoRestore()) say("Повторять нечего.");
  render(); saveCache();
};
document.getElementById("bReset").onclick = () => { resetAll(); say("Сброшено к шаблону."); saveCache(); };
// Копия "↺ Сброс" в блоке "Авто" — своей логики не имеет, кликает по оригиналу выше.
const bResetFlowEl = document.getElementById("bResetFlow");
if (bResetFlowEl) bResetFlowEl.onclick = () => document.getElementById("bReset").click();
// Клик по заголовку в шапке — перезагрузка страницы (запрос пользователя). saveCache()
// вызывается на каждое действие, так что терять нечего; специально НЕ сохраняем тут повторно —
// иначе в аварийном режиме (#safe) клик записал бы пустую сессию поверх сохранённых цепочек.
// Клик по заголовку в шапке — просто перезагрузка страницы (запрос пользователя). saveCache()
// вызывается на каждое действие, так что терять нечего; специально НЕ сохраняем тут повторно —
// иначе в аварийном режиме (#safe) клик записал бы пустую сессию поверх сохранённых цепочек.
// (v1.005 пробовала анимацию "полоса уезжает вниз, потом перезагрузка" — отменено по запросу
// пользователя, "не так, отмени": имелось в виду совсем другое, см. #bMenuBarBottom в "Виде".)
const appTitleEl = document.getElementById("appTitle");
if (appTitleEl) appTitleEl.onclick = () => location.reload();
/* "🎭 По маске" — выключатель прореживающей маски, рядом с общим выключателем поиска.
   Без годной маски в поле (нужны И «1», И «0» — см. maskBitsRaw) кнопка неактивна: включать
   нечего. Подпись и состояние обновляет updateBgMaskOnBtn(), её зовёт render() — так кнопка
   оживает прямо по ходу набора маски в поле. */
/* Кнопка ДВЕ: своя в "Поиске" (рядом с "🔍 Фон-поиск") и её дубль наверху вкладки "Маски" —
   маску набирают там же, в поле под ней (v0.836, запрос пользователя). Состояние одно на обе,
   поэтому и подпись, и обработчик общие. */
const BG_MASK_ON_BTN_IDS = ["bBgMaskOn", "bBgMaskOn2"];
function updateBgMaskOnBtn(){
  const has = !!maskBitsRaw();
  const on = has && st.bgMaskOn !== false;
  /* Значок ОДИН И ТОТ ЖЕ во всех состояниях (v0.832 — в v0.831 он менялся на 🚫/➖, пользователь
     попросил вернуть): "🎭" это имя контрола, а не индикатор. Включённость видно по рамке
     .mode-act на самой кнопке. */
  const label = "🎭 По маске: " + (!has ? "нет маски" : (on ? "ВКЛ" : "ВЫКЛ"));
  const title = has
    ? (on ? `Маска «${maskBitsRaw()}» применяется: поиск идёт по прорежённым ею результатам. Клик — выключить, поле при этом не чистится`
          : `Маска «${maskBitsRaw()}» в поле есть, но не применяется. Клик — включить`)
    : "Впиши маску в поле «🎭 Маска (прореж.)» во вкладке «Маски» — нужны и «1», и «0»";
  for (const id of BG_MASK_ON_BTN_IDS) {
    const b = elById(id);   // одна из двух кнопок может жить в окне вкладки «Маски»
    if (!b) continue;
    b.disabled = !has;
    b.textContent = label;
    b.classList.toggle("mode-act", on);
    b.title = title;
  }
}
/* "🎭 Фаза маски" (#bBgMaskPhase во вкладке "Маски", v0.847) — показывает ТЕКУЩУЮ и ОБЩЕЕ число
   фаз (общее = длина маски: её можно приложить с любого своего символа) и по клику переключает
   фазу по кругу. Значение общее с Черновиком (st.maskDraftPhase): клик по строке фазы в блоке
   "🎭 Находки по маскам" и эта кнопка — один переключатель. Подсветка маски в строках рисуется
   этой же фазой (см. mpBgPhase в render), поэтому результат виден сразу. Подпись обновляет
   render() вместе с updateBgMaskOnBtn(). */
function updateBgMaskPhaseBtn(){
  const b = elById("bBgMaskPhase");
  if (!b) return;
  const m = maskBits();
  const N = m.length;
  b.disabled = !N;
  if (!N) { b.textContent = "🎭 Фаза маски: —"; b.classList.remove("mode-act"); return; }
  const ph = ((st.maskDraftPhase | 0) % N + N) % N;
  // Как выглядит маска в этой фазе — то же, что показано в Черновике: маска, прокрученная на ph.
  const view = m.slice(ph) + m.slice(0, ph);
  b.textContent = "🎭 Фаза маски: " + (ph + 1) + "/" + N + " · " + view;
  b.classList.toggle("mode-act", ph > 0);
}
function toggleBgMaskPhase(){
  const N = maskBits().length;
  if (!N) return;
  st.maskDraftPhase = (((st.maskDraftPhase | 0) + 1) % N + N) % N;
  render(); saveCache();
}
const bBgMaskPhaseEl = document.getElementById("bBgMaskPhase");
if (bBgMaskPhaseEl) bBgMaskPhaseEl.onclick = toggleBgMaskPhase;

function toggleBgMaskOn(){
  if (!maskBitsRaw()) return;
  st.bgMaskOn = st.bgMaskOn === false;
  st.bgSearchLastHit = -1; // цель поиска сменилась — прежняя находка к ней не относится
  render(); saveCache();
}
for (const id of BG_MASK_ON_BTN_IDS) {
  const el = document.getElementById(id);
  if (el) el.onclick = toggleBgMaskOn;
}
// Клик по "🔍 Фон-поиск" — общий выключатель, см. toggleBgSearch().
const bgSearchTitleClickEl = document.getElementById("bgSearchTitle");
if (bgSearchTitleClickEl) bgSearchTitleClickEl.onclick = () => toggleBgSearch();

/* Удаление выделенных (кликом) строк — отдельная операция, НЕ связанная с откатом шага.
   Вызывается клавишей Delete (см. глобальные хоткеи ниже). Шаблон (tplRows/tplPats — то,
   что было закинуто дропом изначально) НЕ трогаем: удаление затрагивает только текущую
   рабочую копию, чтобы "Сброс" всегда мог вернуть исходные строки как они были при первой
   загрузке, независимо от последующих ручных удалений/сдвигов/правок. */
/* КАЖДАЯ КОЛОНКА УДАЛЯЕТСЯ СВОИМ ВЫДЕЛЕНИЕМ (запрос пользователя: "удалять цепочки строки и
   паттерны отдельно надо, и вместе если выделить и там и там"):
     выделены только строки  → уходят строки, паттерны остаются на своих номерах;
     выделены только паттерны → уходят паттерны, строки не двигаются;
     выделено и там, и там    → уходит и то, и другое (при совпадающих номерах это ровно прежнее
                                поведение — строка вместе со своим паттерном).
   Длины st.rows и st.pats при раздельном удалении расходятся — это нормально: render() считает
   число строк как Math.max(st.rows.length, st.pats.length), то есть хвост более длинной колонки
   виден и не теряется. Ничего внизу не дописывается (прямой запрос пользователя). */
function deleteSelectedRows(){
  const rowSel = (st.selectedRows && st.selectedRows.size) ? Array.from(st.selectedRows).sort((a, b) => b - a) : [];
  const patSel = (st.selectedPats && st.selectedPats.size) ? Array.from(st.selectedPats).sort((a, b) => b - a) : [];
  if (!rowSel.length && !patSel.length) { say("Выделите строку кликом (или ячейку в колонке паттернов)."); return; }
  snapshot();
  const topBefore = st.topBuilt || 0;
  // ПАТТЕРНЫ — своим списком и ДО строк: массивы независимые, порядок на индексы не влияет.
  // Нулевая строка и тут не вырезается, а стирается на месте (см. ниже про st.topBuilt).
  let patsCleared = 0, patsRemoved = 0;
  for (const idx of patSel) {
    if (idx < 0 || idx >= st.pats.length) continue;
    if (idx === (st.topBuilt || 0)) {
      const p = st.pats[idx];
      if (p) { p.text = ""; p.found = false; p.kind = null; p.step = null; }
      patsCleared++;
      continue;
    }
    st.pats.splice(idx, 1);
    patsRemoved++;
  }
  const selected = rowSel;
  for (const idx of selected) {
    // НУЛЕВАЯ СТРОКА НЕ УДАЛЯЕТСЯ, А ОЧИЩАЕТСЯ НА МЕСТЕ (запрос пользователя: "чисто стирать —
    // место не двигать"). Она граница между построениями сверху (номера отрицательные) и
    // настоящими данными, и должна быть всегда ровно одна: вырезать её со сдвигом бессмысленно —
    // ensureZeroRow() тут же завела бы новую, а вся цепочка под ней съехала бы на строку.
    // Стираем только БИТЫ: ячейка паттерна — дело выделения паттернов, у неё свой список выше.
    // Индекс берём каждый раз заново: удаление построений выше уменьшает st.topBuilt.
    if (idx === (st.topBuilt || 0)) {
      st.rows[idx] = "";
      continue;
    }
    st.rows.splice(idx, 1);
    st.used.splice(idx, 1);
    // st.pats тут НЕ трогаем — колонка паттернов удаляется своим выделением (см. patSel выше).
    // Выделено и там, и там — паттерн этой же строки уже ушёл в том цикле.
    // УДАЛИЛИ ПОСТРОЕННУЮ СВЕРХУ СТРОКУ — построений стало на одну меньше (запрос пользователя:
    // "при достройке вверх и ручном удалении неверно потом считает реальные строки — с минусом их
    // пишет"). Номер строки считается как i − st.topBuilt (см. rowLabel): всё, что ниже удалённой,
    // съехало вверх на единицу, а st.topBuilt оставался прежним — и настоящие строки начинали
    // нумероваться с 0 и уходить в минус, то есть выглядеть как построения.
    if (idx < (st.topBuilt || 0)) st.topBuilt--;
    // Карты, ключ которых — НОМЕР строки, тоже съезжают: у строки ниже удалённой ключ стал на
    // единицу меньше, а сама удалённая из карт выпадает. Без этого подсветка перевёрнутых бит,
    // осевые сдвиги и счётчик вписанных зеркал оставались на прежних номерах, то есть на чужих
    // строках (тот же класс бага, что чинит shiftRowMaps при построении/снятии верха — но там
    // сдвиг общий, а тут дыра в одном месте).
    for (const m of [insertedFlagsMap, invFlagsMap, newBitsMap, maskChangedMap, axisOffsetMap, axisBitShiftMap, axisBitDirMap, rowRotOffMap, mirrorsRowDone]) {
      if (!m || !m.size) continue;
      const moved = [];
      for (const [k, v] of m) { if (k === idx) continue; moved.push([k > idx ? k - 1 : k, v]); }
      m.clear();
      for (const kv of moved) m.set(kv[0], kv[1]);
    }
    // Разделители (rowDividers) хранят "сырые" индексы строк — при удалении строки нужно и
    // снять разделитель с неё (если был), и сдвинуть вниз индексы всех разделителей НИЖЕ неё,
    // иначе после удаления они окажутся не на тех строках.
    if (st.rowDividers && st.rowDividers.size) {
      const shifted = new Set();
      for (const d of st.rowDividers) {
        if (d === idx) continue;
        shifted.add(d > idx ? d - 1 : d);
      }
      st.rowDividers = shifted;
    }
  }
  // Нулевая строка — граница между построениями (номера отрицательные) и настоящими данными
  // (1, 2, 3…), см. ensureZeroRow(). Если удалили именно её, вернуть её на место обязательно:
  // иначе настоящие строки поедут в нумерации на единицу вверх и первая станет нулевой.
  // "none" — вернуть строку, но КОЛОНКУ ПАТТЕРНОВ НЕ ТРОГАТЬ (v0.958, запрос пользователя: "при
  // удалении из строк цепочек не надо ничего удалять и менять в паттернах"). Раньше шло без
  // флага, и ensureZeroRow вставлял ещё и пустую ячейку паттернов на то же место — после удаления
  // строк (например, построенных сверху, из-за чего st.topBuilt уменьшался и на его месте
  // оказывалась непустая строка) вся колонка паттернов молча съезжала на строку вниз.
  ensureZeroRow("none");
  if (st.selectedRows) st.selectedRows.clear();
  // Выделение в колонке паттернов после удаления тоже недействительно: номера съехали.
  if (st.selectedPats) st.selectedPats.clear();
  // Построений стало меньше — слепок для Сброса снимаем заново, иначе он остался бы снят под
  // прежнее их число и Сброс просто ничего бы не восстановил (см. topBaseRestore).
  if ((st.topBuilt || 0) !== topBefore) topBaseCapture();
  render(); saveCache();
  // Нулевая в счёт удалённых не идёт — она очищена на месте, а не вырезана (см. выше).
  const zeroCleared = selected.includes(topBefore) ? 1 : 0;
  const rowsRemoved = selected.length - zeroCleared;
  const parts = [];
  if (rowsRemoved) parts.push(`строк — ${rowsRemoved}` +
    ((st.topBuilt || 0) !== topBefore ? ` (построений сверху ${topBefore - (st.topBuilt || 0)})` : ""));
  if (patsRemoved) parts.push(`паттернов — ${patsRemoved}`);
  if (zeroCleared || patsCleared) parts.push("нулевая очищена на месте, не сдвинута");
  say(parts.length ? "Удалено: " + parts.join(", ") + "." : "Удалять было нечего.");
}

/* Разделитель-граница снизу выделенной строки (Numpad0 / кнопка) — переключатель (повторный
   вызов на той же строке снимает). Несколько выделенных строк — переключает у КАЖДОЙ разом. */
function toggleRowDivider(){
  if (!st.selectedRows || st.selectedRows.size === 0) { say("Выделите строку кликом."); return; }
  if (!st.rowDividers) st.rowDividers = new Set();
  const idxs = Array.from(st.selectedRows);
  const allSet = idxs.every(i => st.rowDividers.has(i));
  for (const i of idxs) { if (allSet) st.rowDividers.delete(i); else st.rowDividers.add(i); }
  render(); saveCache();
  say(allSet ? "Разделитель снят." : "Разделитель поставлен.");
}
const bToggleRowDividerEl = document.getElementById("bToggleRowDivider");
if (bToggleRowDividerEl) bToggleRowDividerEl.onclick = toggleRowDivider;

/* ПОСТРОЕНИЯ ФИГУР (вкладка "Построения", бывш. "Зеркала"): "🔺 Серпинский" (тот же
   generateSierpinski90, что и при пустом кэше на первом запуске) и "🔢 Номера"
   (generateBinaryNumbers). Обе кнопки идут через один applyGeneratedRows() — разница только в
   том, какой массив строк они ему передают.

   ЧТО ДЕЛАЕТСЯ С ТЕКУЩЕЙ ЦЕПОЧКОЙ ПЕРЕД ПОСТРОЕНИЕМ (v0.885, запрос пользователя) — кнопка
   "⟳ Текущие" (#bBuildPlace), перебор по кругу:
     clear  — прежнее поведение: цепочка и паттерны заменяются построением целиком;
     right  — строка построения ПРИПИСЫВАЕТСЯ справа к каждой строке цепочки;
     left   — то же самое слева;
     center — и справа, и слева сразу, то есть текущая цепочка остаётся в середине.
   Во всех трёх режимах приписки паттерны НЕ трогаются (это правка бит, а не загрузка шаблона),
   а всё дописанное помечается «новыми битами» — см. newBitsWrap/newBitsWhole. */
const BUILD_PLACE_MODES = ["clear", "right", "left", "center"];
const BUILD_PLACE_LABELS = { clear: "стереть", right: "вправо", left: "влево", center: "по центру" };
function updateBuildPlaceBtn(){
  const b = document.getElementById("bBuildPlace");
  if (b) b.textContent = "⟳ Текущие: " + (BUILD_PLACE_LABELS[st.buildPlace] || BUILD_PLACE_LABELS.clear);
}
const bBuildPlaceEl = document.getElementById("bBuildPlace");
if (bBuildPlaceEl) {
  bBuildPlaceEl.onclick = () => {
    const cur = BUILD_PLACE_MODES.indexOf(st.buildPlace || "clear");
    st.buildPlace = BUILD_PLACE_MODES[(cur + 1) % BUILD_PLACE_MODES.length];
    updateBuildPlaceBtn();
    saveCache();
    say("Построения: текущая цепочка — " + BUILD_PLACE_LABELS[st.buildPlace] + ".");
  };
}
updateBuildPlaceBtn();

function applyGeneratedRows(gen, title){
  const mode = st.buildPlace || "clear";
  snapshot();
  /* «СТЕРЕТЬ» ПО ПУСТОМУ ХОЛСТУ — СТИРАЕТ, ПО НАБРАННОЙ ЦЕПОЧКЕ — ТОЛЬКО ПЕРЕЗАПИСЫВАЕТ СВОИ
     СТРОКИ (v1.103, запрос пользователя: "если вставка в уже существующие биты в цепочках, то не
     всё очищает, а только те строки, куда вставляет, а другие оставит как есть").
     Полная замена (ветка ниже) обнуляет ВСЁ разом: строки, шаблон, счётчики, пометки, построения
     вверх. Это правильно на чистом холсте — там и терять нечего, — но по набранной цепочке
     означало, что фигура на 16 строк сносит остальные 200. Теперь при непустой цепочке
     построение идёт общим циклом приписки (он же обслуживает «вправо/влево/по центру»), только
     с заменой строки вместо обрамления: строка, куда фигура пишет, берёт её текст целиком,
     остальные не трогаются вовсе.
     Меряем по наличию БИТ, а не по длине массива: у цепочки всегда есть служебная пустая нулевая
     строка (см. ensureZeroRow), поэтому st.rows.length никогда не ноль и признаком «холст пуст»
     служить не может. */
  const chainHasBits = st.rows.some(r => r && r.length);
  if (mode === "clear" && !chainHasBits) {
    /* «СТЕРЕТЬ» СТИРАЕТ ТОЛЬКО ЦЕПОЧКУ, ЕСЛИ ПАТТЕРНЫ НЕ ПУСТЫ (v1.102, запрос пользователя: "тут
       только цепочку переписывать, если паттерны не пусты"). Раньше режим всегда клал построение
       И в строки, И в колонку паттернов (tplPats = те же gen) — то есть набранные вручную паттерны
       молча заменялись копией фигуры, и вернуть их можно было только через Undo. Копирование в
       паттерны имеет смысл ровно в одном случае — когда колонка ПУСТА (первый запуск, чистый холст):
       тогда фигура заодно становится и шаблоном для поиска. Есть хоть один непустой паттерн — это
       чужая работа, и построение к ней отношения не имеет.
       Снимаем только отметки «найден/вид/шаг»: они указывали на строки прежней цепочки, которой
       больше нет, и переносить их на новую нельзя. Сами тексты и порядок остаются нетронутыми. */
    const keepPats = (st.pats || []).some(p => p && p.text);
    st.tplRows = gen.slice();
    st.rows = gen.slice();
    st.used = st.rows.map(() => false);
    if (keepPats) {
      for (const p of st.pats) if (p) { p.found = false; p.kind = null; p.step = null; }
    } else {
      st.tplPats = gen.slice();
      st.pats = st.tplPats.map((t, i) => ({ text: t, ord: i, found: false, kind: null, step: null }));
    }
    st.selectedRows = new Set();
    // Прежних строк больше нет — значит нет и построений вверх над ними (раньше st.topBuilt
    // оставался от стёртой цепочки, и первые строки новой фигуры считались «зеркалами»).
    st.topBuilt = 0;
    if (typeof topBaseCapture === "function") topBaseCapture();
    // Цепочки, к которой относилась пометка, больше нет — снимаем её вместе со старыми битами.
    newBitsClearAll();
    insertedFlagsMap.clear(); invFlagsMap.clear();
    maskChangedMap.clear(); maskBaseRows = null;
    // Пустая нулевая строка — граница нумерации (см. ensureZeroRow). Без неё первая строка фигуры
    // считалась бы нулевой, и приписка следующим построением легла бы не с той строки.
    /* "none" при сохранённых паттернах (v1.102): обычный вызов ВСТАВЛЯЕТ пустую ячейку в начало
       колонки, чтобы паттерн N встал напротив строки N нового шаблона. Здесь колонка не наша —
       она уже стоит там, где её оставил пользователь, и сдвиг всей колонки вниз на одну как раз и
       был бы тем «троганьем паттернов», которого просили избежать. */
    ensureZeroRow(keepPats ? "none" : undefined);
    st.step = 0; st.passCount = 0; st.tailBuffer = "";
    st.aIdx = 0; st.bIdx = 1; st.goingUp = false; st.hit = null;
    const rowCountEl = document.getElementById("rowCount");
    if (rowCountEl) {
      rowCountEl.max = gen.length;
      rowCountEl.value = gen.length;
      const rcVal = document.getElementById("rowCountVal");
      if (rcVal) rcVal.textContent = gen.length;
    }
    render(); saveCache();
    say(`${title}: построено ${gen.length} строк, прежняя цепочка стёрта.` +
        (keepPats ? " Колонка паттернов не тронута — она не пуста (сняты только отметки «найден»)."
                  : " Паттерны заполнены той же фигурой — колонка была пуста."));
    logStep(title, "", "", `${gen.length} строк, со стиранием${keepPats ? ", паттерны сохранены" : ""}`);
    return;
  }
  // Первая НАСТОЯЩАЯ строка цепочки: индекс st.topBuilt — всегда пустая нулевая строка
  // (см. ensureZeroRow), выше неё только построения вверх. Строку построения №1 приписываем
  // к ней, №2 — к следующей и так далее.
  const base = (st.topBuilt || 0) + 1;
  let addedBits = 0, addedRows = 0, touched = 0;
  for (let g = 0; g < gen.length; g++) {
    const idx = base + g;
    const add = gen[g] || "";
    if (!add) continue;
    if (idx >= st.rows.length) {
      // Построение длиннее цепочки — недостающие строки заводим: они новые целиком.
      st.rows.push(add);
      st.used.push(false);
      st.pats.push({ text: "", ord: st.pats.length, found: false, kind: null, step: null });
      newBitsWhole(idx, add.length);
      addedRows++; addedBits += add.length;
      continue;
    }
    const cur = st.rows[idx] || "";
    if (mode === "clear") {
      /* «Стереть» по набранной цепочке (v1.103, см. шапку функции): строка ЗАМЕНЯЕТСЯ целиком,
         без обрамления. Прежних бит в ней не остаётся, поэтому и переносить нечего — вся строка
         помечается новой (newBitsWhole), а не сдвигается вместе со старыми (newBitsWrap).
         Строки, до которых фигура не дотянулась, этот цикл не перебирает вовсе — они и остаются
         как были, в этом весь смысл правки. */
      st.rows[idx] = add;
      newBitsWhole(idx, add.length);
      insertedFlagsMap.delete(idx);
      invFlagsMap.delete(idx);
      addedBits += add.length;
      touched++;
      continue;
    }
    const left = (mode === "left" || mode === "center") ? add : "";
    const right = (mode === "right" || mode === "center") ? add : "";
    st.rows[idx] = left + cur + right;
    // Длина строки изменилась — позиционные подсветки к ней больше не относятся, а вот пометка
    // «новый» ПЕРЕЕЗЖАЕТ вместе со старыми битами (см. newBitsWrap).
    newBitsWrap(idx, cur.length, left.length, right.length);
    insertedFlagsMap.delete(idx);
    invFlagsMap.delete(idx);
    addedBits += left.length + right.length;
    touched++;
  }
  maskChangedMap.clear(); maskBaseRows = null;
  st.hit = null;
  render(); saveCache();
  say(mode === "clear"
    ? `${title}: переписано строк ${touched}` +
      (addedRows ? `, заведено новых ${addedRows}` : "") +
      `, всего бит ${addedBits}. Остальные строки цепочки и паттерны не тронуты.`
    : `${title}: приписано ${BUILD_PLACE_LABELS[mode]} к ${touched} стр.` +
      (addedRows ? `, заведено новых строк ${addedRows}` : "") +
      `, всего новых бит ${addedBits}.`);
  logStep(title, `${rowLabel(base)}…`, "",
    (mode === "clear" ? "перезапись строк" : BUILD_PLACE_LABELS[mode]) + `, +${addedBits} бит`);
}

const bGenSierpinskiEl = document.getElementById("bGenSierpinski");
const sierpinskiNEl = document.getElementById("sierpinskiN");
if (bGenSierpinskiEl) {
  bGenSierpinskiEl.onclick = () => {
    const n = Math.max(2, Math.min(2048, +(sierpinskiNEl ? sierpinskiNEl.value : 128) || 128));
    applyGeneratedRows(generateSierpinski90(n), "Серпинский");
  };
}
const bGenNumbersEl = document.getElementById("bGenNumbers");
const numbersNEl = document.getElementById("numbersN");
if (bGenNumbersEl) {
  bGenNumbersEl.onclick = () => {
    const n = Math.max(2, Math.min(4096, +(numbersNEl ? numbersNEl.value : 128) || 128));
    applyGeneratedRows(generateBinaryNumbers(n), "Номера");
  };
}

/* Пара кнопок "что делает клик по номеру столбца" — переключатель на два положения, активна
   всегда ровно одна (см. colClickMode). Данные ни одна из них сама по себе не трогает. */
function setColClickMode(m){
  colClickMode = m;
  const map = { shift: "bColModeShift", trim: "bColModeTrim", axis: "bColModeAxis" };
  for (const k in map) {
    const el = document.getElementById(map[k]);
    if (el) el.classList.toggle("mode-act", k === m);
  }
  // Столбец уже выделен (жёлтым) — само нажатие "⊙ Ось сюда" сразу НАЗНАЧАЕТ его: не надо
  // отдельно тыкать в номер, синяя подсветка появляется тут же (запрос пользователя).
  if (m === "axis" && st.selectedCol >= 0 && !(st.axisSnapCols || []).includes(st.selectedCol)) {
    axisToColumn(st.selectedCol);
    return;
  }
  say(m === "trim" ? "Клик по номеру столбца теперь ОБРЕЗАЕТ строки по этому столбцу."
    : m === "axis" ? "Клик по номеру столбца теперь НАЗНАЧАЕТ его осью для Круга — ничего не двигается, но дальше ◄/► ставят на него «1»."
    : "Клик по номеру столбца снова сдвигает строки к «1» на нём.");
}
const bColModeShiftEl = document.getElementById("bColModeShift");
if (bColModeShiftEl) bColModeShiftEl.onclick = () => setColClickMode("shift");
const bColModeTrimEl = document.getElementById("bColModeTrim");
if (bColModeTrimEl) bColModeTrimEl.onclick = () => setColClickMode("trim");
/* ОДНА КНОПКА НА ДВА ДЕЙСТВИЯ (v0.830, запрос пользователя: "если выделен столбец — по столбцу,
   а если строка — по строке, одна кнопка вместо двух"). Прежние "⊙ Ось сюда" и "⊙ Оси по «1»
   строки" делали одно и то же — назначали оси Кругу, — просто брали их из разных мест. Теперь
   кнопка одна и смотрит на выделение:
     выделен СТОЛБЕЦ (жёлтый) → он и становится осью (это делает сам setColClickMode);
     иначе выделена СТРОКА    → осями становятся все её единицы, группой (axisFromSelectedRow);
     не выделено ничего       → просто включается режим "клик по номеру столбца назначает ось".
   Столбец идёт первым: он выбирается прицельно, а строка почти всегда выделена под что-то ещё. */
const bColModeAxisEl = document.getElementById("bColModeAxis");
if (bColModeAxisEl) bColModeAxisEl.onclick = () => {
  const hadCol = st.selectedCol >= 0;
  setColClickMode("axis");
  if (!hadCol && st.selectedRows && st.selectedRows.size) axisFromSelectedRow();
};
/* "✕ Снять столбец" — убрать НАЗНАЧЕННЫЙ "⊙ Ось сюда" столбец (синяя подсветка + цель Круга).
   Обычное жёлтое выделение столбца при этом не трогается: это разные вещи. */
const bColAxisClearEl = document.getElementById("bColAxisClear");
if (bColAxisClearEl) bColAxisClearEl.onclick = () => {
  const cols = syncAxisSnapCols();
  if (!cols.length) { say("Столбцы для Круга и так не назначены."); return; }
  // ПО ОДНОМУ СТОЛБЦУ ЗА НАЖАТИЕ: убираем тот, что сейчас выделен жёлтым (если он среди осей),
  // иначе последний назначенный. Столбец вынимается ИЗ СВОЕЙ ГРУППЫ (см. axisGroups), опустевшая
  // группа исчезает; целую группу разом снимает соседняя кнопка "✕ Снять выбор".
  const removed = (st.selectedCol >= 0 && cols.includes(st.selectedCol)) ? st.selectedCol : cols[cols.length - 1];
  const groups = axisGroups();
  for (let i = groups.length - 1; i >= 0; i--) {
    const k = groups[i].cols.indexOf(removed);
    if (k >= 0) { groups[i].cols.splice(k, 1); if (!groups[i].cols.length) groups.splice(i, 1); }
  }
  const left = syncAxisSnapCols().slice().sort((a, b) => a - b).map(c => c + 1).join(", ");
  say(st.axisSnapCols.length
    ? `Ось на столбце ${removed + 1} снята. Остались: ${left}.`
    : `Ось на столбце ${removed + 1} снята — осей больше нет, круговые сдвиги ◄/► снова обычные.`);
  render(); saveCache();
};

/* "⊙ Оси по «1» строки" — назначить осями СРАЗУ ВСЕ столбцы, где у выделенной строки стоит «1»
   (запрос пользователя: "делает все 1цы выделенной строки осями, до низу или до следующей
   выделенной"). Источник — ВЕРХНЯЯ выделенная строка; выделение после этого переносится на
   строки под ней — до СЛЕДУЮЩЕЙ выделенной, а если такой нет, до конца цепочки. Сама строка-
   источник из выделения выходит: её единицы и задают оси, крутить её незачем.
   Данные не трогаются вовсе — двигает строки только сам Круг ◄/►. */
function axisFromSelectedRow(){
  if (!st.selectedRows || !st.selectedRows.size) { say("⊙ Оси по «1»: выделите строку кликом."); return; }
  const sel = Array.from(st.selectedRows).sort((a, b) => a - b);
  const src = sel[0];
  const s = st.rows[src] || "";
  if (!s.length) { say("⊙ Оси по «1»: выделенная строка пустая — единиц в ней нет."); return; }
  let maxLen = 0;
  for (const t of st.rows) if (t.length > maxLen) maxLen = t.length;
  // cols — номера столбцов как раньше (жёлтая/синяя подсветка и текст сообщения); p2 — те же оси в
  // ПОЛУстолбцах, по ним работает диагональный режим (см. axisLocalIdxMapForRow). Якорь диагонали —
  // сама строка-источник: линия обязана проходить через её собственные единицы.
  const sh = rowShiftFor(maxLen, src, s, st.align);
  const h2 = axisColShift2x(src, s, st.align, maxLen);
  const cols = [], p2 = [];
  for (let k = 0; k < s.length; k++) if (s[k] === "1") { cols.push(sh + k); p2.push(h2 + 2 * k); }
  if (!cols.length) { say(`⊙ Оси по «1»: в строке ${rowLabel(src)} нет ни одной единицы.`); return; }
  // Как и "⊙ Ось сюда": столбцовые оси гасят режим "⊙ Оси по битам" вместе с его группами.
  if (typeof bitAxisMode !== "undefined" && bitAxisMode) setBitAxisMode(false, true);
  // ГРУППОЙ (запрос пользователя): единицы одной строки — одна группа, своим цветом, и
  // снимается она целиком одним нажатием "✕ Снять выбор". Прежние группы остаются.
  addAxisGroup(cols, src, p2, src);
  // Нижняя граница участка: следующая выделенная строка, иначе — низ цепочки.
  const next = sel.find(r => r > src);
  const hi = (next != null) ? next : st.rows.length - 1;
  const rows = new Set();
  for (let r = src + 1; r <= hi; r++) if ((st.rows[r] || "").length) rows.add(r);
  if (rows.size) { st.selectedRows = rows; st.captureGrown = true; }
  // "Снять выбор" сразу же (запрос пользователя): жёлтое выделение столбца после этого не нужно,
  // а режим выбора столбцов кликом отжимаем — оси уже назначены.
  st.selectedCol = -1;
  if (typeof colPickMode !== "undefined" && colPickMode) setColPickMode(false);
  say(`⊙ Оси по «1» строки ${rowLabel(src)}: осей ${cols.length} (столбцы ${cols.map(c => c + 1).join(", ")}). ` +
      (rows.size
        ? `Выделены строки ниже — по ${rowLabel(hi)} включительно; ◄/►Круг поставит их на эти оси.`
        : "Строк ниже нет — выделение оставлено как было."));
  render(); saveCache();
}

const colHeaderEl = document.getElementById("colHeader");
if (colHeaderEl) {
  /* ВЫДЕЛЕНИЕ СТОЛБЦА ЛИНЕЙКОЙ УБРАНО ПОЛНОСТЬЮ (v1.048, запрос пользователя: "отключи выделение
     столбцов по старым меткам над 0-вой строкой").
     Убиралось в два приёма. Сперва (по запросу "убери активацию столбцов по этим элементам — это
     от старого кода осталось") сняли "клик = выделить столбец" и "клик по выделенному = снять", но
     ветку режима "⇅ Сдвиг к «1»" оставили: считалось, что это не выделение, а сама операция. На
     деле она звала ровно ту же selectColumn(), то есть выделение столбца линейкой никуда не
     делось — просто требовало включённого режима. Теперь и её нет.
     Столбец выбирается кликом ПО САМОМУ БИТУ при включённом "🔢 Выбор столбца" (см. colPickMode в
     fold-4) — линейка для этого не нужна.
     ЛИНЕЙКА ОСТАЁТСЯ, и обработчик тоже: у двух ЯВНЫХ режимов-кнопок другого способа указать
     столбец нет — "обрезка" (trimAtColumn) и "⊙ Ось сюда" (axisToColumn). Оба включаются
     отдельной кнопкой (см. setColClickMode), сами по себе не срабатывают, и выделением не
     являются. В обычном режиме клик по линейке теперь не делает НИЧЕГО. */
  colHeaderEl.addEventListener("click", e => {
    const cell = e.target.closest(".col-cell");
    if (!cell) return;
    const col = +cell.dataset.col;
    if (colClickMode === "trim") { trimAtColumn(col); return; }
    if (colClickMode === "axis") { axisToColumn(col); return; }
  });
}

// ВНИМАНИЕ: сам захват теперь в captureFoundRow() ниже — при МУЛЬТИвыделении он не наращивает
// выделение, а двигает его окном постоянного размера (см. её комментарий).
// Общий хвост ручных ◄/►Круг/Круг Инв: после сдвига проверяем фон-поиск и, если что-то нашлось
// И включена "🧲 Захват находки" (st.captureOnFind), ДОБАВЛЯЕМ найденную строку к текущему
// выделению (не заменяя его) — запрос пользователя. Раньше это работало ТОЛЬКО если исходно
// было выделено несколько строк — теперь настраиваемый переключатель, по умолчанию включён и
// работает для ЛЮБОГО выделения, в т.ч. одной строки (запрос пользователя "работает для всяких
// выделений и одной строки тоже"). Сама найденная строка при этом уже НЕ крутилась (цикл выше
// прошёл по r ИЗ ИСХОДНОГО st.selectedRows, до добавления) — её биты не трогаются.
// Дальше — тот же счётчик "Вар: N/M (стр. ...)", что и в "Авто" (см. autoRun()), только тут
// накапливается по кликам подряд, а не по тикам — запрос пользователя ("при ручном тоже надо
// это показывать"). st.manualShiftTurns копится, пока не сменится выделение кликом по строке
// или режим (см. reset в rows.onclick / setMode()).
/* Захват найденной строки в выделение — общий и для "Авто", и для ручных ◄/►Круг.
   Выделена ОДНА строка — просто добавляем найденную, выделение растёт: прежнее поведение,
   оставлено как есть (запрос пользователя).
   Выделено НЕСКОЛЬКО — выделение едет ОКНОМ постоянного размера: добавляем найденную и
   выбрасываем САМУЮ ВЕРХНЮЮ, чтобы число выделенных строк всегда оставалось одним и тем же
   (запрос пользователя). Возвращает индекс выброшенной строки (или -1) — вызывающему коду в
   autoRun() он нужен, чтобы убрать её ещё и из набора вращаемых строк.
   ВАЖНО (запрос пользователя "если выделена одна и она захватывает вторую — потом тоже не снимать
   выделение с верхней"): "выделено несколько" считается по тому, как выделение ПОЯВИЛОСЬ, а не по
   его размеру прямо сейчас. Выделение, ВЫРОСШЕЕ из одной строки захватом (st.captureGrown), растёт
   и дальше — вторая, третья, четвёртая находка просто добавляются, верхняя строка остаётся
   выделенной. Окном постоянного размера едет только то выделение, которое пользователь набрал сам
   (Ctrl/Shift-кликом). Флаг снимается при любой ручной смене выделения — см. рядом с
   st.manualShiftTurns = 0 в rows.onclick/setMode()/Сбросе.
   ИНВАРИАНТ: targetIdx ВСЕГДА строго ниже всего выделения — см. computeBgSearchTarget():
   selIdx = Math.max(...st.selectedRows), targetIdx = selIdx + 1. Поэтому найденная строка не
   может ни уже быть в выделении, ни оказаться самой верхней, и проверок на это тут нет. */
function captureFoundRow(targetIdx, forceGrow){
  // Строки с таким номером может не быть вовсе: с "🎭 Маской" (см. maskSearchText) находка бывает
  // и тогда, когда выделена САМАЯ НИЖНЯЯ строка — искомое больше не берётся из паттерна строки
  // ниже, и её отсутствие поиску не мешает. Захватывать в этом случае нечего.
  // −1 — то же самое, что "ничего сверху не выброшено" (см. возвраты ниже).
  if (targetIdx < 0 || targetIdx >= st.rows.length) return -1;
  if (!st.selectedRows) st.selectedRows = new Set();
  // "⬇ Расширять вниз" (forceGrow, см. #bGrowDownOnFind) — окно НЕ едет никогда: строка снизу
  // добавляется, верхняя остаётся выделенной, сколько бы находок ни случилось.
  // НУЛЕВАЯ СТРОКА В ВЫДЕЛЕНИИ (та, что стоит под номером 0 — см. ensureZeroRow) — окно тоже
  // НЕ едет: находка просто ДОБАВЛЯЕТСЯ к выделению, верхняя строка не вычитается (запрос
  // пользователя). Смысл тот же, что у "⬇ Расширять вниз", только включается самим выделением:
  // раз нулевая строка выделена намеренно, съезжающее окно её бы сразу и потеряло.
  const zeroRowIdx = st.topBuilt || 0;
  const hasZeroRow = st.selectedRows.has(zeroRowIdx);
  // ВЫДЕЛЕНИЕ НАЧИНАЕТСЯ СРАЗУ ПОСЛЕ РАЗДЕЛИТЕЛЯ (см. rowDividers/toggleRowDivider: граница
  // рисуется СНИЗУ строки, значит разделитель стоит у строки НАД верхней выделенной) — тоже не
  // вычитаем верхнюю (запрос пользователя): разделитель и есть заданная руками верхняя граница
  // участка, съезжающее окно её бы перешагнуло.
  const topSelIdx = st.selectedRows.size ? Math.min(...st.selectedRows) : -1;
  const startsAfterDivider = topSelIdx > 0 && !!(st.rowDividers && st.rowDividers.has(topSelIdx - 1));
  const wasMulti = !forceGrow && !hasZeroRow && !startsAfterDivider && st.selectedRows.size > 1 && !st.captureGrown;
  if (st.selectedRows.size <= 1) st.captureGrown = true;
  const grew = !st.selectedRows.has(targetIdx);
  st.selectedRows.add(targetIdx);
  // ЗЕРКАЛО НОВОЙ СТРОКЕ — СРАЗУ, ещё до всего остального (достройки вверх, поиска, пересборки
  // индексов): захват — это и есть тот момент, когда "выделение расширилось", ради которого
  // "⇔ Авто-зеркала" и делались. Раньше вызов стоял только в самих прогонах ПОСЛЕ захвата, и на
  // части путей (в т.ч. на ручном Круге) до него дело не доходило — запрос пользователя "не
  // строит не всегда: при ручном сдвиге Круг, когда захватывает новую строку, сразу зеркало, а
  // потом остальное". Зовём только на РЕАЛЬНОМ расширении: строка уже выделена — вписывать
  // нечего. Предел по строке внутри applyMirrorsToRows() не даёт вписать зеркало дважды, поэтому
  // прежние вызовы mirrorsAutoStep() в прогонах остаются безвредными.
  if (grew) mirrorsAutoStep();
  if (!wasMulti) return -1;
  const top = Math.min(...st.selectedRows);
  st.selectedRows.delete(top);
  return top;
}

/* ПРОХОД ПО УЖЕ НАЙДЕННЫМ СТРОКАМ "🔽 Все ниже" (запрос пользователя: "если нашлось ниже, не в
   первой нижней, то при автозахвате переходить на такие строки только после находки всех до неё").
   "Все ниже" помечает зелёным любую строку ниже выделенной, чей паттерн совпал с результатом, —
   в том числе далёкую, через десяток строк. Прыгать захватом сразу туда нельзя: строки между ними
   ещё не найдены, и окно перескочило бы через неработанный участок.
   Поэтому захват идёт СТРОГО ПО ПОРЯДКУ. Обычная находка захватила очередную строку — и если
   СЛЕДУЮЩАЯ за ней уже помечена зелёным, значит её паттерн когда-то совпал, ждать нечего: проходим
   и её, и так дальше, пока идут подряд помеченные. Разрыв — останавливаемся и ждём обычной находки.
   Возвращает пары [захваченная строка, выброшенная сверху] — вызывающий поправит по ним свой набор
   вращаемых строк (rotIdxs в прогоне). */
function captureBelowRun(forceGrow){
  const done = [];
  if (!st.fullPassMode || typeof bgBelowHits === "undefined" || !bgBelowHits.size) return done;
  const lastRow = Math.max(st.rows.length, st.pats.length);
  for (;;) {
    const sel = (st.selectedRows && st.selectedRows.size) ? Math.max(...st.selectedRows) : -1;
    const next = sel + 1;
    if (next <= 0 || next >= lastRow || !bgBelowHits.has(next)) break;
    done.push([next, captureFoundRow(next, forceGrow)]);
    if (done.length > 500) break; // предохранитель от бесконечного прохода
  }
  if (done.length) say("🔽 Все ниже: захват прошёл по уже найденным строкам № " +
    done.map(d => d[0] + 1).join(", ") + " — они были помечены раньше, очередь дошла.");
  return done;
}
function afterShiftBgCheck(isShiftInv){
  // Находку считаем ОДИН раз на весь этот шаг. Раньше тут было два отдельных вызова
  // computeBgSearchTarget(): сначала для захвата находки, потом для автодостройки. Но захват
  // РАСШИРЯЕТ выделение, а от выделения зависит, какой паттерн вообще ищется, — второй вызов уже
  // отвечал "не найдено", и автодостройка на ручных сдвигах не срабатывала никогда (запрос
  // пользователя: "при ручных сдвигах тоже должно работать, когда выделение расширяется — всегда
  // достраивать"). Запомненных индексов у ручного сдвига нет, поправлять после вставки строк нечего.
  // Строки только что провернулись — зеркала сверху обновляем ДО поиска, иначе он считал бы верх по
  // прежнему состоянию (см. refreshTopMirrors).
  refreshTopMirrors();
  const bgInfo = computeBgSearchTarget();
  const hit = !!(bgInfo && bgInfo.matched);
  /* ЗАХВАТ НЕ РАБОТАЕТ, ПОКА ИЩЕМ ВЫДЕЛЕННЫЙ ПАТТЕРН (v1.090, см. patSelMode в
     computeBgSearchTarget): захват тянет выделение СТРОК к цели, а цель сейчас — паттерн, выбранный
     руками, а не строка под выделением. Утаскивать за ним выделение строк было бы самоуправством. */
  if ((st.captureOnFind || st.growDownOnFind) && hit && !bgInfo.patSelMode) {
    captureFoundRow(bgInfo.targetIdx, st.growDownOnFind);
    captureBelowRun(st.growDownOnFind);
  }
  if (hit) { mirrorsAutoStep(); topBuildOnHitStep(); }
  st.manualShiftTurns = (st.manualShiftTurns || 0) + 1;
  st.stepStale = false; // ручной ◄/► — это тоже настоящий шаг, номер живой (см. finishAuto)
  const idxs = st.selectedRows ? Array.from(st.selectedRows) : [];
  st.shiftVariantTotal = computeShiftTotalTurns(idxs, isShiftInv);
  st.shiftVariantTurns = st.manualShiftTurns;
  st.shiftVariantRows = idxs;
  updateVariantCounter();
}
// Локальный индекс символа строки, который для НЕ-⊙-выравниваний считается "осью" при
// «Сдвиг только на 1» (см. shiftOneRowAxisAware ниже) — запрос пользователя: "ось — граница
// выравнивания строк". Для "По левому краю"/Центр/Центр½/Лесенка/Лесенка½ — это ПЕРВЫЙ бит
// строки (индекс 0), для "По правому краю" и новой "Лесенки правой" — ПОСЛЕДНИЙ бит (по
// смыслу самого выравнивания). НЕ путать с axisCharIdxOf() — та же идея, но для отдельной
// фичи "Тетрис-Ось" (там ось всегда индекс 0, кроме "⊙ Ось"), её не трогаем.
/* Локальный индекс символа, который для НЕ-⊙-выравниваний считается "осью" при «Сдвиг только
   на 1», когда СВОИХ столбцов-осей не назначено: первый бит строки, у правых выравниваний
   последний (см. shiftOneRowAxisAware). */
function nonAxisSnapCharIdx(align, len){
  return (align === "right" || align === "rstairs") ? len - 1 : 0;
}
/* "ДИАГОНАЛЬНЫЕ СТОЛБЦЫ" для осей Круга (запрос пользователя): на "½"-выравниваниях
   (halfcenter/halfstairs/rhalfstairs) половина строк рисуется со сдвигом ещё на пол-символа
   (см. hasHalfNudge/extraCh в render()) — целочисленный rowShiftFor() этого не знает, поэтому
   назначенный "⊙ Ось сюда" столбец у таких строк систематически промахивался мимо реального
   бита (та же причина, по которой render() раньше просто ГАСИЛ подсветку оси на этих строках,
   см. skipColHighlight). Здесь — та же "единая точка правды", что уже применяется для XOR/
   интерлива (см. rowHalf2x() выше): считаем в ПОЛУстолбцах (×2), чтобы получечный нудж вошёл в
   расчёт, и берём столбец/индекс СИММЕТРИЧНОЙ парой функций (col→idx и idx→col), поэтому
   столбец, назначенный по биту одной строки, у соседней строки с ПРОТИВОПОЛОЖНОЙ чётностью
   нуджа отображается не в тот же номер столбца, а в соседний — картинка "едет" по диагонали, а
   не рвётся, и обе чётности получают свой реальный бит. На обычных выравниваниях (rowHalf2x=0
   всегда) эти функции — точный эквивалент старого "col − sh", поведение не меняется. */
function axisColShift2x(r, s, align, maxLen){
  return 2 * rowShiftFor(maxLen, r, s, align) + rowHalf2x(r, s, align, maxLen);
}
/* НАКЛОН диагональной оси в ПОЛУстолбцах на строку. 0 — обычная вертикаль (галка выключена или
   выравнивание не "½"), и тогда вся арифметика ниже вырождается в прежнюю "столбец − сдвиг".
   ±1 полустолбца = ПОЛОВИНА реального столбца за строку — ровно тот шаг, с которым едут сами
   строки в "½"-выравниваниях, поэтому такая линия попадает в РЕАЛЬНЫЙ бит строки ЛЮБОЙ чётности
   (запрос пользователя), тогда как вертикаль попадала только в половину строк.
   Знак — по направлению самой лестницы: "Лесенка правая ½" наклонена ВЛЕВО-ВНИЗ, остальные две —
   ВПРАВО-ВНИЗ. */
function axisDiagSlope2x(align){
  const m = st.axisDiagCols | 0;      // 0 — выкл, 1 — «своё» направление, −1 — зеркальное
  if (!m) return 0;
  // Направление ПО УМОЛЧАНИЮ (первое нажатие) — по наклону самой лестницы: "Лесенка правая ½"
  // наклонена влево-вниз, "Центр ½"/"Лесенка ½" — вправо-вниз. Второе нажатие (m = −1) переворачивает
  // линию: наклон остаётся тем же по величине (½ столбца на строку — иначе линия перестала бы
  // попадать в биты), но идёт в другую сторону.
  const nat = (align === "rhalfstairs") ? -1
    : ((align === "halfcenter" || align === "halfstairs") ? 1 : 0);
  if (!nat) return 0;                 // выравнивание не "½" — диагонали тут нет вовсе
  return m > 0 ? nat : -nat;
}
/* Map(ЛОКАЛЬНЫЙ индекс символа строки r → индекс группы осей) для ДИАГОНАЛЬНОГО режима.
   Ось группы живёт как точка (p2 — полустолбец на строке-якоре anch) + наклон d: на строке r она
   стоит в полустолбце p2 + d×(r − anch). Вычитаем начало самой строки (тоже в полустолбцах) — и
   если разность ЧЁТНАЯ, на оси действительно стоит бит строки, а его локальный индекс = разность/2.
   Нечётная разность — строка сидит в чужой полусетке, бита на этой линии у неё нет (то же правило,
   что у диагональных режимов фон-поиска, см. computeDiagOnesMask). */
function axisLocalIdxMapForRow(r, len, align){
  const gis = axisGroupIdxsForRow(r);
  if (!gis.length) return null;
  const groups = axisGroups();
  const d = axisDiagSlope2x(align);
  let maxLen = 0;
  for (const s of st.rows) if (s.length > maxLen) maxLen = s.length;
  const h = axisColShift2x(r, st.rows[r] || "", align, maxLen);
  const map = new Map();
  for (const gi of gis) {
    const g = groups[gi];
    for (let j = 0; j < g.p2.length; j++) {
      const rel = g.p2[j] + d * (r - g.anch) - h;
      if (rel % 2 !== 0) continue;
      const k = rel / 2;
      if (k >= 0 && k < len && !map.has(k)) map.set(k, gi);
    }
  }
  return map;
}
/* ЛОКАЛЬНЫЕ индексы строки r, отвечающие НАЗНАЧЕННЫМ столбцам-осям (st.axisSnapCols, кнопка
   "⊙ Ось сюда"): номер столбца минус собственный сдвиг строки. С галкой "⤡ Диагональные столбцы
   на «½»" (st.axisDiagCols) вместо этого работает НАКЛОННАЯ линия — axisLocalIdxMapForRow() отдаёт
   локальные индексы напрямую (запрос пользователя ДОПОЛНИТЕЛЬНОЙ опцией, старое поведение
   по умолчанию не трогаем). Столбцы, до которых строка не достаёт, отбрасываются. null — осей не
   назначено вовсе (работает прежнее правило по краю), пустой массив — строка не достаёт ни до
   одной оси, крутить её незачем. */
/* ПОД-СЕТКА строки против под-сетки ЯКОРЯ группы осей (только "½"-выравнивания, только
   ВЕРТИКАЛЬНЫЕ оси — у диагональных линия сама проходит через биты обеих чётностей).
   Ровно то же правило, по которому render() решает, светить ли ось на строке (см. axisGroupNudge
   там): совпали под-сетки — на строке реально есть бит этой оси, не совпали — оси у неё нет. */
function axisRowSubgridOk(r, gi, align, maxLen){
  if (axisDiagSlope2x(align) !== 0) return true;
  if (!(align === "halfcenter" || align === "halfstairs" || align === "rhalfstairs")) return true;
  const g = axisGroups()[gi];
  if (!g) return true;
  const a = (g.anch != null) ? g.anch : (g.row != null ? g.row : 0);
  return hasHalfNudge(st.rows[r] || "", maxLen, align, r) ===
         hasHalfNudge(st.rows[a] || "", maxLen, align, a);
}
/* Строка ЧУЖОЙ под-сетки: оси на неё формально распространяются (она в зоне группы), но
   подсвеченного бита у неё нет — значит и ДЕРЖАТЬ её оси не должны (запрос пользователя: "те
   строки, которые не выделены, не должны придерживать «1»-цы, у них нет выделенного бита").
   Такая строка при ◄/►Круг просто крутится на один шаг, без привязки к «1» на оси. */
function axisRowOffSubgrid(r, align){
  if (axisDiagSlope2x(align) !== 0) return false;
  if (!(align === "halfcenter" || align === "halfstairs" || align === "rhalfstairs")) return false;
  const map = axisColorMapForRow(r);
  if (!map || !map.size) return false;
  for (const gi of map.values()) if (axisRowSubgridOk(r, gi, align, nudgeRefMaxLen(st))) return false;
  return true;
}
function axisSnapLocalIdxs(r, len, align){
  // ДИАГОНАЛЬНЫЙ режим — своя геометрия целиком (см. axisLocalIdxMapForRow): она сразу отдаёт
  // локальные индексы, переводить столбцы не нужно.
  if (axisDiagSlope2x(align) !== 0) {
    const dm = axisLocalIdxMapForRow(r, len, align);
    if (!dm) return (st.axisSnapCols && st.axisSnapCols.length) ? [] : null;
    return Array.from(dm.keys());
  }
  // Оси берём НЕ все подряд, а только действующие на ЭТУ строку (см. axisColorMapForRow):
  // строчная группа накрывает строки от своей строки-источника вниз до следующей такой группы,
  // зоны не перекрываются, а группы от ручных кликов работают там, где строчной нет.
  const map = axisColorMapForRow(r);
  if (!map || !map.size) return (st.axisSnapCols && st.axisSnapCols.length) ? [] : null;
  let maxLen = 0;
  for (const s of st.rows) if (s.length > maxLen) maxLen = s.length;
  const rowStr = st.rows[r] || "";
  const sh = rowShiftFor(maxLen, r, rowStr, align);
  const out = [];
  for (const [c, gi] of map) {
    // Оси чужой под-сетки на эту строку не действуют (см. axisRowSubgridOk): бита у неё там нет,
    // целиться незачем. Если ВСЕ оси строки такие — см. axisRowOffSubgrid в shiftOneRowAxisAware:
    // строка крутится обычным шагом, а не замирает.
    if (!axisRowSubgridOk(r, gi, align, maxLen)) continue;
    const k = Math.round(c - sh);
    if (k >= 0 && k < len) out.push(k);
  }
  return out;
}
// "⊙ Ось"/"Ось 1.2" — ◄/►Круг(Инв) в этих режимах двигают ТОЛЬКО картинку (axisOffsetMap), не
// сами данные (st.rows/invFlagsMap не трогаем вообще — инверсия у "Инв"-кнопок тоже не имеет
// смысла без реального изменения бита, поэтому все 4 кнопки ведут себя одинаково, просто двигая
// offset) — запрос пользователя ("строки не меняются, только положение относительно оси").
// axisDelta: ◄ = +1, ► = -1 — шаг индекса символа строки (в её ЕСТЕСТВЕННОМ, НЕ переставленном
// порядке — см. axisRowShift() выше), который сейчас стоит на оси. Галка "⊙ Ось: сдвиг только на
// «1»/между «1-0»" (st.axisSnap) — запрос пользователя: теперь общая НЕ ТОЛЬКО для "⊙ Ось"/
// "Ось 1.2", а для ЛЮБОГО выравнивания (см. ветку else/nonAxisSnapCharIdx ниже):
//  "axis", галка ВКЛ  — на оси может стоять только «1»: шаг повторяется в ту же сторону ПО КРУГУ
//                       (через край строки), пока на оси (off) не окажется «1», либо пока не
//                       пройден полный круг (все нули — на месте).
//  "axis", галка ВЫКЛ — обычный одиночный шаг без поиска, на любой символ (в т.ч. «0»).
//  "axis12", галка ВКЛ  — ось попадает В ЗАЗОР между off и следующим символом (off+1) — это
//                         должна быть пара «1»→«0» (полсимвольный сдвиг, см. halfShiftAttr в
//                         render()), шаг ищет ближайшую такую пару БЕЗ зацикливания через край
//                         строки (см. rowHasOneZeroPair) — упёршись в край, дальше не идёт.
//                         У строк совсем без пары «1»→«0» — заморожено, шаг не делает ничего.
//  "axis12", галка ВЫКЛ — зазор между ЛЮБЫМИ соседними символами, ограничения «1»→«0» нет,
//                         заморозки тоже нет — обычный одиночный шаг индекса зазора (по кругу).
//  ЛЮБОЕ ДРУГОЕ выравнивание, галка ВКЛ — сама строка крутится (realRotateFn), пока её «1» не
//                         встанет под «1» БЛИЖАЙШЕЙ НЕПУСТОЙ СТРОКИ ВЫШЕ (v1.096; назначены свои
//                         столбцы-оси — целимся в них, а не в соседнюю строку; выше вообще ничего
//                         нет — запасное правило по nonAxisSnapCharIdx), либо пока не пройден
//                         полный круг.
//  ЛЮБОЕ ДРУГОЕ выравнивание, галка ВЫКЛ — обычный одиночный поворот, как раньше.
/* Обратная пара к каждой из четырёх функций поворота — нужна режиму "↩ От края назад" в ОБЫЧНЫХ
   выравниваниях: отразившись от края, строку надо крутить в СТОРОНУ, ПРОТИВОПОЛОЖНУЮ нажатой
   кнопке, а сюда приходит только пара для нажатого направления. Через таблицу, чтобы не менять
   сигнатуру и все четыре места вызова. */
const OPPOSITE_ROT = new Map([
  [rotateStrLeft,     [rotateStrRight,    rotateInvFlagsRight]],
  [rotateStrRight,    [rotateStrLeft,     rotateInvFlagsLeft]],
  [rotateStrLeftInv,  [rotateStrRightInv, rotateInvFlagsRightInv]],
  [rotateStrRightInv, [rotateStrLeftInv,  rotateInvFlagsLeftInv]]
]);
/* Позиция строки внутри её собственного кольца поворотов (0..len-1) для режима "↩ От края назад".
   В обычном режиме не нужна вообще — там поворот и так циклический.
   Это лишь ЗАПАСНОЙ счётчик: основной отсчёт берётся ИЗ ДАННЫХ, см. rotationOffsetFromBase(). */
let rowRotOffMap = new Map();
/* "⇔ Крайние «1»" — какой край строка r должна занять СЛЕДУЮЩИМ разом в фолбэке (когда положения
   с «1» СРАЗУ на обоих краях не нашлось): true — правый, false/нет записи — левый. Флип при
   КАЖДОМ фолбэк-нажатии (независимо от того, ◄ или ► жали) — запрос пользователя: "крутить по
   кругу, перемещая 1цу то в левый то в правый край, а не стопорить при одном и том же движении".
   Без этого чередования повторное нажатие той же кнопки могло попасть на позицию, где нужный край
   уже «1» — и вставало без единого поворота, что выглядело как остановка. */
let edgeOnesSideMap = new Map();
/* На сколько строка r повёрнута вправо ОТНОСИТЕЛЬНО ИСХОДНОЙ — той, к которой возвращает
   "↺ Сброс" (savedChain.rows у сохранённой вкладки, иначе шаблон tplRows; тот же ориентир, что
   у подсветки "номер изменён" в render()). Считается ПО ДАННЫМ перебором поворотов, а не
   накапливается по нажатиям: сколько раз и в какую сторону строку крутили до этого, знать не
   нужно, а Сброс сам собой возвращает отсчёт в ноль — запрос пользователя ("надо запоминать
   строку и первое её положение при сбросах"). null — сопоставить не удалось: строку правили
   вручную, меняли длину, или биты перевёрнуты "Круг Инв" (тогда чистым поворотом исходную не
   получить) — в этом случае вызывающий код падает на запасной rowRotOffMap.
   У строк с повторяющимся узором ("1010") подходящих k несколько — берём наименьший, чтобы
   отсчёт был однозначным. */
function rotationOffsetFromBase(r, s){
  const tabObj = st.tabs && st.tabs[st.activeTab];
  const baseArr = (tabObj && tabObj.savedChain) ? tabObj.savedChain.rows : st.tplRows;
  const b = (baseArr && baseArr[r]) || "";
  if (!b || !s || b.length !== s.length) return null;
  for (let k = 0; k < s.length; k++) if (rotateRightBy(b, k) === s) return k;
  return null;
}
function shiftOneRowAxisAware(r, axisDelta, realRotateFn, invFlagsRotateFn){
  // "⇔ Крайние «1»" — запрос пользователя: КРУТИТЬ строку (реальный поворот битов, как обычный
  // Круг/Круг Инв, независимо от выравнивания) в нажатую сторону, пока на первом И последнем
  // месте не окажутся «1». Не нашлось такого положения нигде по кругу (len поворотов = полный
  // оборот, строка вернулась к исходному виду) — ФОЛБЭК: крутим ЕЩЁ РАЗ, теперь ищем «1» на ОДНОМ
  // краю, но какой край — определяет НЕ нажатая кнопка, а edgeOnesSideMap, флипаясь при КАЖДОМ
  // фолбэке: строка своими же битами встаёт то в левый, то в правый край. Обязательно делаем ХОТЯ
  // БЫ ОДИН поворот в этом фолбэке (проверка ПОСЛЕ поворота, не до) — иначе, если нужный край
  // случайно уже «1», повтор той же кнопки не сдвигал бы строку вовсе (выглядело как остановка,
  // запрос пользователя "не стопорить при одном и том же движении").
  // ВМЕСТЕ С "🔗 Не рвать «1»-группы по краю" (st.noSplitOnes) фаза "оба края" ОТКЛЮЧАЕТСЯ: «1»
  // сразу на первом И последнем месте — это ровно то самое разорванное швом положение, которое
  // "Не рвать" запрещает (на кольце крайние биты соседние, значит группа идёт через шов). Две
  // галки в этой части прямо противоречат друг другу, и раньше "Крайние «1»" побеждала: строка
  // «111010011» вставала в «111101001», разрывая хвостовую «11» (баг-репорт пользователя).
  // Поэтому при обеих галках сразу работает только фолбэк-фаза (то левый край, то правый), и в
  // ней дополнительно требуется, чтобы ПРОТИВОПОЛОЖНЫЙ край был «0» — тогда «1» честно стоит с
  // краю, но ни одна группа через шов не рвётся, и обе галки уживаются.
  if (st.edgeOnes) {
    const len = st.rows[r] ? st.rows[r].length : 0;
    if (len < 2) return;
    const rotOnce = () => rotateRowWithFlags(r, realRotateFn, invFlagsRotateFn);
    if (!st.noSplitOnes) {
      let found = false;
      for (let i = 0; i < len; i++) {
        rotOnce();
        const s = st.rows[r];
        if (s[0] === "1" && s[s.length - 1] === "1") { found = true; break; }
      }
      if (found) return;
    }
    const wantRight = !!edgeOnesSideMap.get(r);
    edgeOnesSideMap.set(r, !wantRight);
    const edgeIdx = wantRight ? len - 1 : 0;
    const otherIdx = wantRight ? 0 : len - 1;
    for (let i = 0; i < len; i++) {
      rotOnce();
      const s = st.rows[r];
      if (s[edgeIdx] === "1" && (!st.noSplitOnes || s[otherIdx] === "0")) break;
    }
    return;
  }
  // "🔗 Не рвать «1»-группы по краю" — запрос пользователя: круговой сдвиг (реальный поворот
  // битов, независимо от выравнивания, как и "⇔ Крайние «1»" выше) не должен останавливаться на
  // положении, где ОДНА непрерывная группа «1» оказалась разорвана швом строки — то есть где
  // ОДНОВРЕМЕННО первый И последний символ строки «1» (пример: «11110000» может стать «01111000»,
  // но НЕ «10000111» — там четвёрка единиц разъехалась на «1» у левого края и «111» у правого).
  // Крутим, пока такое положение не исчезнет; полный оборот без такого положения означает, что
  // избежать его нельзя (напр. строка из одних «1») — тогда строка возвращается к исходному виду.
  if (st.noSplitOnes) {
    const len = st.rows[r] ? st.rows[r].length : 0;
    if (len < 2) return;
    for (let i = 0; i < len; i++) {
      rotateRowWithFlags(r, realRotateFn, invFlagsRotateFn);
      const s = st.rows[r];
      if (!(s[0] === "1" && s[s.length - 1] === "1")) break;
    }
    return;
  }
  if (st.align === "axis") {
    const s = st.rows[r];
    const len = s.length;
    if (!len) return;
    let off = getAxisOffset(r, len);
    if (st.axisSnap) {
      for (let i = 0; i < len; i++) {
        off = ((off + axisDelta) % len + len) % len;
        if (s[off] === "1") break;
      }
    } else {
      off = ((off + axisDelta) % len + len) % len;
    }
    axisOffsetMap.set(r, off);
  } else if (st.align === "axis12") {
    const s = st.rows[r];
    const len = s.length;
    if (len < 2) return; // нет ни одного возможного зазора
    if (st.axisSnap) {
      if (!rowHasOneZeroPair(s)) return; // заморожена — пары «1»→«0» нет вообще
      let off = getAxisOffset(r, len);
      let next = off;
      for (let i = 0; i < len; i++) {
        next += axisDelta;
        if (next < 0 || next > len - 2) break; // край строки — без зацикливания
        if (s[next] === "1" && s[next + 1] === "0") { off = next; break; }
      }
      axisOffsetMap.set(r, off);
    } else {
      const gaps = len - 1;
      const off = getAxisOffset(r, len);
      axisOffsetMap.set(r, ((off + axisDelta) % gaps + gaps) % gaps);
    }
  } else if (st.align === "axisbit" || st.align === "axisbit12") {
    const s = st.rows[r];
    const len = s ? s.length : 0;
    if (!len) return;
    const aboveIdx = r - 1;
    const above = aboveIdx >= 0 ? st.rows[aboveIdx] : "";
    if (!above || !above.length) return; // нет строки выше — двигать не на что
    const aboveShift = resolveAxisBitShift(aboveIdx);
    let sh = resolveAxisBitShift(r);
    const shBefore = sh; // нужен ниже, чтобы утащить за собой все строки НИЖЕ на ту же величину
    // ЗНАК ОБРАТНЫЙ axisDelta (запрос пользователя — "жму влево, а реально уходят вправо"):
    // в "⊙ Ось"/"Ось 1.2" axisDelta — шаг ИНДЕКСА символа, стоящего на оси (больше индекс —
    // строка стоит ЛЕВЕЕ, т.к. shift = axisCol − off), поэтому там ◄ = +1. Здесь же sh — это
    // сам СТОЛБЕЦ сдвига строки, где больше = ПРАВЕЕ, то есть та же +1 уводила строку в
    // противоположную нажатой сторону.
    const shStep = -axisDelta;
    // Предел расхождения строк (запрос пользователя: «111» и «0000» вместе дают максимум
    // «1110000» — семь символов, не больше; дальше застопорить). Крайние допустимые положения —
    // те, где строки СТЫКУЮТСЯ без нахлёста и без дыры: sh = aboveShift − len (эта строка
    // кончается ровно там, где начинается верхняя) и sh = aboveShift + above.length (начинается
    // ровно там, где верхняя кончилась). В обоих случаях общая ширина = len + above.length; уйди
    // строка дальше — между ними появится пустой зазор, и суммарная ширина станет БОЛЬШЕ суммы
    // длин, чего и просили не допускать.
    // "ОсьБит ½" — граница та же по смыслу, но считать её надо по ВИДИМОМУ положению строк, а не
    // по целому sh: в этом режиме строка с НЕЧЁТНЫМ числом полушаговых звеньев рисуется на
    // полсимвола левее своего sh (см. isAxisBitBetween/extraCh в render()). У соседних строк эта
    // полушаговая поправка разная, поэтому вещественная граница уезжает на ±0.5 (запрос
    // пользователя — "там не на 1, а на 0,5 надо максимальное расхождение"). Приводим обратно к
    // целому sh через ceil/floor — так стоп срабатывает ровно на полсимвола раньше или позже, но
    // сама строка по-прежнему встаёт на целую позицию. У обычной "ОсьБит" обе поправки нулевые,
    // и формула вырождается в прежнюю.
    const halfOf = (idx) => (st.align === "axisbit12" && axisBitHalfSteps(idx) % 2 === 1) ? 0.5 : 0;
    const halfCorr = halfOf(r) - halfOf(aboveIdx);
    const minSh = Math.ceil(aboveShift + halfCorr - len);
    const maxSh = Math.floor(aboveShift + halfCorr + above.length);
    if (st.axisSnap) {
      // Перебор здесь ЦИКЛИЧЕСКИЙ, как и у "⊙ Ось"/"Ось 1.2", только кольцо не по модулю длины
      // строки, а по допустимому диапазону положений [minSh..maxSh] (см. ниже). Если совпадения
      // нет НИ НА ОДНОМ положении, строка не трогается вовсе — тот же принцип, что у Тетриса при
      // провале перебора (см. axisBitShiftMap.set ниже — не вызывается при found=false), чтобы
      // она не улетала на позицию без совпадения (запрос пользователя "биты ушли за пределы
      // своих осей").
      const requirePair = st.align === "axisbit12";
      const adj = requirePair && (axisBitHalfSteps(r) % 2 === 1) ? 1 : 0;
      // Перебор идёт ПО КОЛЬЦУ внутри допустимого диапазона [minSh..maxSh]: дойдя до края,
      // продолжаем с противоположного, а не останавливаемся (запрос пользователя — "когда Круг
      // сдвиг доходит до конца, надо заново по кольцу крутить, а сейчас останавливается").
      // Раньше тут стоял break по границе, и строка упиралась в край: чтобы добраться до
      // положения, лежащего позади, приходилось жать противоположную кнопку.
      // Сам диапазон при этом НЕ расширен — заворачиваем строго внутри него, и позиция всё так же
      // принимается только по axisBitHasMatch, поэтому "за пределы своих осей" строка уехать
      // по-прежнему не может. Длина цикла = размер диапазона: каждое допустимое положение
      // проверяется ровно один раз, повторов нет.
      const span = maxSh - minSh + 1;
      let found = false;
      let sh2 = sh;
      for (let i = 0; i < span; i++) {
        sh2 = axisBitNextSh(r, sh2, shStep, minSh, maxSh);
        if (axisBitHasMatch(s, sh2, above, aboveShift, requirePair, adj)) { found = true; sh = sh2; break; }
      }
      if (!found) { say("ОсьБит: подходящего положения нет ни на одном сдвиге — строка оставлена на месте."); return; }
    } else {
      // Раньше тут стоял ЗАЖИМ в диапазон (Math.max/Math.min) — упёршись в край, строка вставала
      // намертво и следующие нажатия не меняли ничего вообще (запрос пользователя: "следующее
      // нажатие ничего не меняет"). Теперь край обрабатывается так же, как в ветке со снапом:
      // по умолчанию кольцо, а с "↩ От края назад" — отражение (см. axisBitNextSh).
      sh = axisBitNextSh(r, sh, shStep, minSh, maxSh);
    }
    axisBitShiftMap.set(r, sh);
    // Запрос пользователя: в "ОсьБит"/"ОсьБит ½" вся часть таблицы НИЖЕ сдвигаемой строки едет
    // за ней "монолитом". Строки без собственной записи в axisBitShiftMap и так наследуют сдвиг
    // сверху (см. resolveAxisBitShift) — они последуют сами; а вот те, что когда-то двигали
    // отдельно, имеют свою запись и раньше оставались на месте, разрывая картину. Добавляем им
    // ровно ту же дельту, на которую реально уехала эта строка (не axisDelta: при включённой
    // галке "⊙ На оси только «1»" перебор мог перескочить сразу несколько позиций).
    const shDelta = sh - shBefore;
    if (shDelta) {
      for (let k = r + 1; k < st.rows.length; k++) {
        if (axisBitShiftMap.has(k)) axisBitShiftMap.set(k, axisBitShiftMap.get(k) + shDelta);
      }
    }
  } else if (st.axisSnap || (st.axisSnapCols && st.axisSnapCols.length)) {
    const len = st.rows[r] ? st.rows[r].length : 0;
    if (!len) return;
    // Назначены столбцы-оси — целимся сразу во ВСЕ (запрос пользователя): подходит только то
    // положение, где «1» стоит на КАЖДОЙ из осей, до которых строка достаёт. Ни одной такой оси
    // нет (строка целиком в стороне) — не трогаем строку вовсе.
    // Чужая под-сетка "½"-выравнивания — ось эту строку не держит: обычный поворот на шаг
    // (см. axisRowOffSubgrid). Проверяем ДО axisSnapLocalIdxs: там такая строка отдала бы пустой
    // список, а пустой список означает "стоять на месте".
    if (axisRowOffSubgrid(r, st.align)) {
      rotateRowWithFlags(r, realRotateFn, invFlagsRotateFn);
      return;
    }
    const multi = axisSnapLocalIdxs(r, len, st.align);
    if (multi && !multi.length) {
      // Строка целиком в стороне от всех назначенных осей — двигать её некуда. РАНЬШЕ ЗДЕСЬ БЫЛ
      // МОЛЧАЛИВЫЙ return, и Круг выглядел сломанным: жмёшь — не двигается, и ни слова почему
      // (запрос пользователя после вписывания зеркал: "не Круг — сдвига нет").
      say(`Круг: строка ${rowLabel(r)} не достаёт ни до одной назначенной оси («⊙ Ось сюда»/«⊙ Оси по «1» строки») — двигать её не по чему. Снимите оси кнопкой сброса осей или назначьте их в столбцах этой строки.`);
      return;
    }
    /* БЕЗ НАЗНАЧЕННЫХ ОСЕЙ ЦЕЛИМСЯ В «1» СТРОКИ ВЫШЕ (v1.096, баг-репорт пользователя: "не верно
       работает, надо смотреть по верхней строке 1цы и делать сдвиги так, когда 1ца падает на 1цу,
       независимо от первого символа").
       Раньше запасной целью был ОДИН фиксированный символ самой строки — nonAxisSnapCharIdx():
       первый бит (у правых выравниваний последний). То есть галка означала не "1 на 1", а "первый
       символ строки — «1»", и до соседней строки ей не было никакого дела: строка вставала в
       положение, где её начало единица, хоть бы над ней в этом столбце был ноль.
       Теперь условие то же, что у "ОсьБит" (axisBitHasMatch): подходит любое положение, где ХОТЬ
       ОДНА «1» этой строки стоит в ТОМ ЖЕ ЭКРАННОМ СТОЛБЦЕ, что «1» строки выше. Какой там символ
       по счёту — неважно.
       Экранный столбец = rowShiftFor() + индекс в строке. Сдвиг считаем ОДИН РАЗ до перебора:
       поворот длину строки не меняет, а вся геометрия выравнивания (группы, лесенки, ½) висит
       именно на длине и номере строки — значит, за время перебора сдвиг постоянен. Режимы "⊙ Ось"/
       "Ось 1.2"/"ОсьБит" сюда не попадают вовсе, у них свои ветки выше.
       Строка выше — БЛИЖАЙШАЯ НЕПУСТАЯ (пустые пропускаем: под ними целиться не по чему). Если
       выше нет ни одной — снапить не на что, и остаётся прежнее правило по первому символу, иначе
       самая верхняя строка перестала бы двигаться вообще. */
    const fallbackIdx = nonAxisSnapCharIdx(st.align, len);
    const targets = multi || null;
    let snapMaxLen = 0;
    for (const q of st.rows) if (q && q.length > snapMaxLen) snapMaxLen = q.length;
    let aboveIdx = -1;
    if (!targets) for (let k = r - 1; k >= 0; k--) { if (st.rows[k] && st.rows[k].length) { aboveIdx = k; break; } }
    const aboveRow = aboveIdx >= 0 ? st.rows[aboveIdx] : "";
    const aboveShift = aboveIdx >= 0 ? rowShiftFor(snapMaxLen, aboveIdx, aboveRow, st.align) : 0;
    const curShift = rowShiftFor(snapMaxLen, r, st.rows[r], st.align);
    // ОТКАТ ПРИ ПРОВАЛЕ ПЕРЕБОРА. Раньше тут стояло "len поворотов = оборот, строка вернётся к
    // исходному виду сама, откат не нужен" — и это ВЕРНО ТОЛЬКО ДЛЯ ОБЫЧНОГО Круга. У "Круг Инв"
    // поворот вдобавок переворачивает биты, и полный оборот по позициям (len) оставляет ВСЕ БИТЫ
    // ПЕРЕВЁРНУТЫМИ — строка молча портилась (ровно тот же случай, что уже чинили в Тетрисе:
    // "почему для 111 сделал 001"). Поэтому запоминаем исходные биты и флаги и возвращаем их,
    // если подходящего положения не нашлось ни на одном повороте.
    const origRow = st.rows[r];
    const origFlags = getInvFlags(r, len).slice();
    // Пометку «новых бит» откатываем вместе с ними (см. rotateRowWithFlags): иначе провалившийся
    // перебор возвращал биты на место, а цвет оставался повёрнутым.
    const origNew = newBitsMap.has(r) ? newBitsMap.get(r).slice() : null;
    let found = false;
    for (let i = 0; i < len; i++) {
      rotateRowWithFlags(r, realRotateFn, invFlagsRotateFn);
      let ok;
      if (!targets) {
        // Назначенных осей нет — совпадение «1» под «1» со строкой выше (см. комментарий выше).
        ok = aboveRow
          ? axisBitHasMatch(st.rows[r], curShift, aboveRow, aboveShift, false, 0)
          : st.rows[r][fallbackIdx] === "1";
      } else {
        // "⊙ Хватит любой из осей" (st.axisSnapAny) — принимаем положение, где «1» стоит хотя бы
        // на ОДНОЙ оси; без галки нужны единицы на ВСЕХ сразу.
        ok = !(st.axisSnapAny && targets.length > 1);
        if (ok) { for (const t of targets) if (st.rows[r][t] !== "1") { ok = false; break; } }
        else { for (const t of targets) if (st.rows[r][t] === "1") { ok = true; break; } }
      }
      if (ok) { found = true; break; }
    }
    if (!found) {
      st.rows[r] = origRow;
      invFlagsMap.set(r, origFlags);
      if (origNew) newBitsMap.set(r, origNew); else newBitsMap.delete(r);
      if (!targets) {
        say(aboveRow
          ? `Круг: строка ${rowLabel(r)} — ни на одном повороте её «1» не встаёт под «1» строки ${rowLabel(aboveIdx)}, строка оставлена как была. Снимите «⊙ Сдвиг только на «1»», чтобы крутить обычным шагом.`
          : `Круг: строка ${rowLabel(r)} — «1» в ней нет, крутить нечего.`);
      } else {
        say(`Круг: строка ${rowLabel(r)} — ни на одном повороте «1» не встаёт на ${targets.length > 1 ? (st.axisSnapAny ? "хотя бы одну из осей" : "ВСЕ оси сразу") : "ось"}, строка оставлена как была. ` +
            (targets.length > 1 && !st.axisSnapAny ? "Помогает галка «⊙ Хватит любой из осей»." : "Снимите «⊙ Ось: сдвиг только на «1»», чтобы крутить обычным шагом."));
      }
    }
  } else {
    const len = st.rows[r] ? st.rows[r].length : 0;
    if (!len) return;
    // "↩ От края назад" работает и тут: как только первый символ доходит до другого края кольца,
    // строка не перескакивает через границу дальше по кругу, а разворачивается и идёт обратно до
    // упора, потом снова вперёд (запрос пользователя). Положение внутри кольца считаем сами
    // (rowRotOffMap) — по самим данным этого не видно, поворот всегда циклический.
    if (st.axisBitBounce && len > 1) {
      // ЗНАК: axisDelta — это шаг индекса символа, стоящего на оси (◄ = +1, ► = −1), а off здесь
      // считает положение ПЕРВОГО СИМВОЛА строки внутри кольца поворотов, и оно движется в
      // ПРОТИВОПОЛОЖНУЮ сторону: ► сдвигает содержимое вправо, то есть первый символ уезжает на
      // бо́льший индекс. Ровно та же инверсия, что и у shStep = −axisDelta в ветке "ОсьБит" выше.
      // Без неё ► от стартового off = 0 сразу упирался в нижний край и отражался, из-за чего
      // "10000" по ► давало "00001" (поворот ВЛЕВО) вместо "01000" — баг-репорт пользователя.
      const step = -axisDelta;
      // Отсчёт — от ИСХОДНОГО положения строки (то, к которому вернёт "↺ Сброс"), вычисленный по
      // самим данным; запомненное значение нужно только когда сопоставить не вышло (ручная
      // правка/"Круг Инв", см. rotationOffsetFromBase).
      const fromBase = rotationOffsetFromBase(r, st.rows[r]);
      const off = (fromBase != null) ? fromBase : (rowRotOffMap.get(r) || 0);
      const next = axisBitNextSh(r, off, step, 0, len - 1);
      const applied = next - off;
      if (!applied) return;
      rowRotOffMap.set(r, next);
      const pair = (applied === step) ? null : OPPOSITE_ROT.get(realRotateFn);
      const rotFn = pair ? pair[0] : realRotateFn;
      const flagFn = pair ? pair[1] : invFlagsRotateFn;
      rotateRowWithFlags(r, rotFn, flagFn);
      return;
    }
    rotateRowWithFlags(r, realRotateFn, invFlagsRotateFn);
  }
}
const bShiftLEl = document.getElementById("bShiftL");
if (bShiftLEl) {
  bShiftLEl.onclick = () => {
    if (!shiftAllowed()) return; // 🔒 замок — Круг бит не двигает (см. shiftAllowed в fold-1-core)
    if (!st.selectedRows || st.selectedRows.size === 0) { say("Выделите строку кликом."); return; }
    setLastDirMode("shiftL");
    mirrorsBeforeShift();
    snapshot();
    for (const r of st.selectedRows) if (st.rows[r]) {
      shiftOneRowAxisAware(r, 1, rotateStrLeft, rotateInvFlagsLeft);
    }
    afterShiftBgCheck(false);
    render(); saveCache();
  };
}
const bShiftREl = document.getElementById("bShiftR");
if (bShiftREl) {
  bShiftREl.onclick = () => {
    if (!shiftAllowed()) return; // 🔒 замок — Круг бит не двигает (см. shiftAllowed в fold-1-core)
    if (!st.selectedRows || st.selectedRows.size === 0) { say("Выделите строку кликом."); return; }
    setLastDirMode("shiftR");
    mirrorsBeforeShift();
    snapshot();
    for (const r of st.selectedRows) if (st.rows[r]) {
      shiftOneRowAxisAware(r, -1, rotateStrRight, rotateInvFlagsRight);
    }
    afterShiftBgCheck(false);
    render(); saveCache();
  };
}
const bShiftLInvEl = document.getElementById("bShiftLInv");
if (bShiftLInvEl) {
  bShiftLInvEl.onclick = () => {
    if (!shiftAllowed()) return; // 🔒 замок — Круг бит не двигает (см. shiftAllowed в fold-1-core)
    if (!st.selectedRows || st.selectedRows.size === 0) { say("Выделите строку кликом."); return; }
    setLastDirMode("shiftLInv");
    mirrorsBeforeShift();
    snapshot();
    for (const r of st.selectedRows) if (st.rows[r]) {
      shiftOneRowAxisAware(r, 1, rotateStrLeftInv, rotateInvFlagsLeftInv);
    }
    afterShiftBgCheck(true);
    render(); saveCache();
  };
}
const bShiftRInvEl = document.getElementById("bShiftRInv");
if (bShiftRInvEl) {
  bShiftRInvEl.onclick = () => {
    if (!shiftAllowed()) return; // 🔒 замок — Круг бит не двигает (см. shiftAllowed в fold-1-core)
    if (!st.selectedRows || st.selectedRows.size === 0) { say("Выделите строку кликом."); return; }
    setLastDirMode("shiftRInv");
    mirrorsBeforeShift();
    snapshot();
    for (const r of st.selectedRows) if (st.rows[r]) {
      shiftOneRowAxisAware(r, -1, rotateStrRightInv, rotateInvFlagsRightInv);
    }
    afterShiftBgCheck(true);
    render(); saveCache();
  };
}

/* "🎭 Маска" — накладывает ПАТТЕРН КАЖДОЙ СТРОКИ на саму эту строку (XOR), столбец в столбец по
   ТЕКУЩЕМУ выравниванию цепочек: и строка, и паттерн получают свой alignShift() по общей ширине,
   как если бы паттерн был обычной строкой такой длины, — поэтому при равных длинах 111 на 111
   всегда даёт 000, а при разных совпадение идёт по реальным столбцам, а не "с начала".
   Изменённые биты запоминаются в maskChangedMap и красятся красным (.bit-chg) — держатся, пока
   не изменится ЛЮБОЙ бит в ЛЮБОЙ строке (проверка в render(), см. maskBaseRows). */
// var, а не const/let: render() читает эти переменные и может вызваться РАНЬШЕ, чем выполнится
// эта строка (у let/const это была бы ошибка временной мёртвой зоны, и рендер падал бы целиком).
var maskChangedMap = new Map();
var maskBaseRows = null;
// Снимок строк, при котором кнопкой 🎨 погашена ВСЯ красная окраска изменённых бит — не только
// своя, масочная, но и штатная "изменён последним шагом" (.bit-chg по стеку отката): маска
// меняет ровно те же биты, поэтому без этого красное оставалось на месте и выглядело как
// "маска не снимается" (запрос пользователя). Снимок сбрасывается сам, как только строки
// изменятся — дальше подсветка последнего шага работает как обычно.
var chgColorOffRows = null;
// ОБЩИЙ выключатель красной подсветки изменённых бит (кнопка "🔴 Изм. биты" во вкладке "Вид") —
// в отличие от снимка выше действует постоянно, пока его не вернут, и переживает перезагрузку
// (лежит в настройках вида). Гасит и штатную "изменён последним шагом", и масочную.
var chgBitsOn = true;
// Показывать ли красную окраску изменённых Маской бит: кнопка 🎨 переключает её туда-обратно
// (запрос пользователя "второе нажатие убирает цвет, следующее опять делает"). Сами данные и
// список изменённых бит при этом не трогаются — только показ.
var maskColorOn = true;
function maskApply(){
  const idxs = (st.selectedRows && st.selectedRows.size)
    ? Array.from(st.selectedRows).sort((a, b) => a - b)
    : st.rows.map((_, i) => i);
  let maxLen = 0;
  for (const s of st.rows) if (s && s.length > maxLen) maxLen = s.length;
  for (const p of st.pats) if (p && p.text && p.text.length > maxLen) maxLen = p.text.length;
  snapshot();
  maskChangedMap.clear();
  let touched = 0, changed = 0;
  let beforeAll = "", afterAll = "";
  for (const r of idxs) {
    const row = st.rows[r] || "";
    const pat = (st.pats[r] && st.pats[r].text) ? st.pats[r].text : "";
    if (!row.length || !pat.length) continue;
    const rowShift = alignShift(maxLen, row.length, st.align, r);
    const patShift = alignShift(maxLen, pat.length, st.align, r);
    let out = "";
    const flags = new Array(row.length).fill(false);
    for (let k = 0; k < row.length; k++) {
      const j = (rowShift + k) - patShift; // тот же столбец, но в координатах паттерна
      const a = row[k];
      const b = (j >= 0 && j < pat.length) ? pat[j] : null;
      if (b !== null && (a === "0" || a === "1") && (b === "0" || b === "1")) {
        const v = (a === b) ? "0" : "1";
        out += v;
        if (v !== a) { flags[k] = true; changed++; }
      } else {
        out += a; // столбец, куда паттерн не достаёт, остаётся как был
      }
    }
    beforeAll += row; afterAll += out;
    st.rows[r] = out;
    maskChangedMap.set(r, flags);
    insertedFlagsMap.delete(r);
    invFlagsMap.delete(r);
    touched++;
  }
  if (!touched) { say("Маска: нет строк с паттерном — накладывать нечего."); return; }
  maskBaseRows = st.rows.slice(); // с чем сравнивать, чтобы понять "бит изменился" (см. render)
  say(`Маска: наложено на ${touched} стр., изменено бит — ${changed}.`);
  logStep("Маска", idxs.map(r => r + 1), afterAll, "XOR строки с её паттерном по столбцам", [],
    [{ name: "Было", text: beforeAll }]);
  render(); saveCache();
}
const bMaskEl = document.getElementById("bMask");
if (bMaskEl) bMaskEl.onclick = maskApply;
const bMaskColorEl = document.getElementById("bMaskColor");
if (bMaskColorEl) bMaskColorEl.onclick = () => {
  maskColorOn = !maskColorOn;
  bMaskColorEl.classList.toggle("mode-act", maskColorOn);
  // Выключили окраску — СБРАСЫВАЕМ и сам список изменённых бит (запрос пользователя "маска не
  // снимается"): иначе он продолжал жить и при следующем включении подсвечивал старые биты.
  if (!maskColorOn) {
    maskChangedMap.clear(); maskBaseRows = null;
    chgColorOffRows = st.rows.slice(); // гасим и штатную "изменён последним шагом" на этих же битах
  } else {
    chgColorOffRows = null;
  }
  say(maskColorOn ? "Маска: подсветка изменённых бит включена." : "Маска: подсветка снята.");
  render();
};

/* "0→1 Заливка" — по очереди: сначала ВСЕ биты в 0, следующим нажатием ВСЕ в 1, дальше снова 0
   (запрос пользователя "заменяет все 1 на 0, а потом все 0 на 1"). Не инверсия: там 0 и 1 меняются
   местами, а тут строка становится однородной. Длины строк не трогаем — заменяем посимвольно,
   не-битовые символы (если попадутся) остаются как есть. */
let fillZeroOneNext = "0";
const bFillZeroOneEl = document.getElementById("bFillZeroOne");
if (bFillZeroOneEl) {
  bFillZeroOneEl.onclick = () => {
    const idxs = (st.selectedRows && st.selectedRows.size)
      ? Array.from(st.selectedRows).sort((a, b) => a - b)
      : st.rows.map((_, i) => i);
    const v = fillZeroOneNext;
    snapshot();
    let touched = 0;
    for (const r of idxs) {
      const s = st.rows[r];
      if (!s || !s.length) continue;
      let out = "";
      for (const ch of s) out += (ch === "0" || ch === "1") ? v : ch;
      if (out !== s) { st.rows[r] = out; insertedFlagsMap.delete(r); invFlagsMap.delete(r); }
      touched++;
    }
    if (!touched) { say("Заливка: нет непустых строк."); return; }
    fillZeroOneNext = v === "0" ? "1" : "0";
    say(`Заливка: все биты в «${v}» — ${touched} стр. Следующим нажатием будет «${fillZeroOneNext}».`);
    render(); saveCache();
  };
}

/* "✂ Вырезать найденные" — выкинуть из строк цепочек биты, подсвеченные как найденные паттерны
   (запрос пользователя). Берём РОВНО ту карту, по которой подсветка сейчас и нарисована
   (lastAllPatRows — по ней же ходит клик по паттерну), поэтому вырезается именно видимое:
   частичные находки "🧩 Макс. часть" и каждое вхождение при "🔁 Все вхождения" в том числе.
   Оставшиеся биты просто смыкаются — строка становится короче, а на место её ставит обычное
   выравнивание при отрисовке, отдельно двигать ничего не нужно. */
const bCutFoundPatsEl = document.getElementById("bCutFoundPats");
if (bCutFoundPatsEl) {
  bCutFoundPatsEl.onclick = () => {
    const map = lastAllPatRows;
    if (!map || !map.size) {
      say("Вырезать нечего: в строках сейчас не подсвечено ни одной находки — включите «🌈 Все паттерны» или выделите паттерн в колонке.");
      return;
    }
    const onlyRows = (st.selectedRows && st.selectedRows.size) ? st.selectedRows : null;
    // Сначала считаем результат и только потом трогаем данные: snapshot() на правку, которая
    // ничего не меняет, засорял бы Undo.
    const plan = [];
    let cutBits = 0;
    for (const [r, arr] of map) {
      if (onlyRows && !onlyRows.has(r)) continue;
      const s = st.rows[r];
      if (!s || !s.length) continue;
      let out = "", n = 0;
      for (let p = 0; p < s.length; p++) {
        if (arr[p] !== undefined) { n++; continue; }
        out += s[p];
      }
      if (!n) continue;
      plan.push([r, out]);
      cutBits += n;
    }
    if (!cutBits) {
      say(onlyRows ? "Вырезать нечего: в выделенных строках находок нет." : "Вырезать нечего: находок в строках нет.");
      return;
    }
    snapshot();
    for (const pr of plan) {
      st.rows[pr[0]] = pr[1];
      // Длина строки изменилась — позиционные флаги (вставленные символы, инверсия между
      // символами, маска) к ней больше не относятся, как и у остальных правок длины.
      insertedFlagsMap.delete(pr[0]);
      invFlagsMap.delete(pr[0]);
    }
    maskChangedMap.clear(); maskBaseRows = null;
    st.hit = null;
    say(`Вырезано ${cutBits} бит найденных паттернов в ${plan.length} стр. Оставшиеся биты сомкнулись и стоят по текущему выравниванию.`);
    logStep("Вырезать найденные", plan.map(pr => pr[0] + 1).join(","), "", `${cutBits} бит в ${plan.length} стр.`);
    render(); saveCache();
  };
}

