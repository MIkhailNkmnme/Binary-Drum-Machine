/* Solaris v0.944: phone solo view, controls below the canvas. */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const small = matchMedia("(max-width:760px)"), landscape = matchMedia("(pointer:coarse) and (max-width:1100px)");
  const mobile = () => ZZ_SOLO === "w-cone" && !ZZ_BG && (small.matches || landscape.matches);
  function caseState() {
    Object.assign(Z, { rows: ["1", "11"], cur: 0, cone3d: false, conePoly: false,
      coneClock: true, coneSun: true, coneSlits: "cutS", cutPrev: "", cutFree: false,
      coneClean: true, sunHalf: true, row1Parts: 2, laserQuad: false, cutRow1Slit: false,
      coneBallOn: true, coneBallBatch: true, coneBallRoute: "cross", coneBallStart: "center", coneBallMult: "1", coneBitStep: false, coneSpinMode: "obit", coneAutoSp: 4.7,
      coneOnlySel: false, coneNoPick: true, coneVoid: false, coneLast2: false,
      fillStill: false, coneRot: [0, 0], coneSpin: 0, coneSpinPh: 0, coneAimRot: 0 });
    delete Z.coneFree; delete Z.fillFree; delete Z.coneHold; delete Z.coneHoldOff;
    delete Z.ringPhOff; delete Z.voidHits; Z.coneFillTurn = 0;
    syncLane();
    if (Array.isArray(Z.lanesHid)) Z.lanesHid[Z.lane | 0] = [];
  }
  window.zzSolMobileDefaults = () => {
    if (!mobile()) return;
    document.body.classList.add("sol-mobile");
    if (Z.solMobileDefaults || ZZ_PRESET || window.ZZ_LINK_DECODE) return;
    Z.solMobileDefaults = 1;
    if (Z.rows.length === 1 && Z.rows[0] === "1") caseState();
    Z.cgrpMin = { ...(Z.cgrpMin || {}) };
    for (const name of ["вид", "кольца", "кручение", "лазер", "строка 1", "щели", "за чертой", "алгоритм", "☀ · ☾", "шарики", "алг. · подск.", "звук", "аниматрица", "3d", "дзен"]) Z.cgrpMin[name] = true;
    Z.ringTblMin = true;
  };
  function init() {
    if (ZZ_SOLO !== "w-cone" || ZZ_BG) return;
    const wb = $("w-cone").querySelector(":scope > .wbody"), tools = wb.querySelector(":scope > .tools"); if (!tools) return;
    const bar = document.createElement("div"); bar.id = "solMobileBar";
    const button = (label, title, action) => { const b = document.createElement("button"); b.type = "button"; b.textContent = label; b.title = title; b.onclick = action; bar.appendChild(b); return b; };
    /* Синхрофазотрон v0.027, «в телефоне какие-то кнопки непонятные» → «да, всё делай»: «▶ крутить» снята (то же, что ▶ на холсте), «2 кольца» снята
       (одним касанием заменяла все строки на 1 и 11 и перезагружала страницу); направление и возврат шариков подписаны словами */
    const dir = button("↻ направление", "Изменить направление вращения и сторону старта шарика", () => $("bConeDir").click());
    button("● шарики на старт", "Вернуть шарики в выбранную стартовую точку", () => $("bConeBallReset").click());
    const ballStatus = document.createElement("div"); ballStatus.id = "solMobileStatus";
    ballStatus.setAttribute("role", "status"); ballStatus.setAttribute("aria-live", "polite"); bar.appendChild(ballStatus);
    const statusSource = $("coneBallStatus"), syncStatus = () => { ballStatus.textContent = statusSource.textContent; };
    new MutationObserver(syncStatus).observe(statusSource, { childList: true, characterData: true, subtree: true }); syncStatus();
    const menu = document.createElement("button"); menu.id = "solMobileMenu"; menu.type = "button"; menu.textContent = "☰ Настройки";
    tools.id = tools.id || "solMobileTools";
    menu.setAttribute("aria-expanded", "false"); menu.setAttribute("aria-controls", tools.id + " sunMoonTbl ringTbl");
    menu.onclick = () => {
      const open = document.body.classList.toggle("sol-mobile-menus"); menu.textContent = open ? "✕ Свернуть настройки" : "☰ Настройки"; menu.setAttribute("aria-expanded", String(open));
      if (open) { cgrpCols(); requestAnimationFrame(() => tools.scrollIntoView({ block: "nearest", behavior: "smooth" })); }
    };
    wb.insertBefore(bar, tools); wb.insertBefore(menu, tools);
    const sync = () => {
      const text = ((Z.coneAutoSp ?? 30) < 0 ? "↺" : "↻") + " направление"; if (dir.textContent !== text) dir.textContent = text;
    };
    for (const id of ["bConeAuto", "bConeDir"]) new MutationObserver(sync).observe($(id), { childList: true, characterData: true, subtree: true });
    wb.addEventListener("pointerdown", e => {
      if (!mobile() || e.target.closest("button, input, select, textarea, label, a")) return;
      if (e.target.closest(".glab, .smh, .rth, .cgsz")) e.stopPropagation();
    }, true);
    let was = false;
    const layout = () => {
      const on = mobile(); document.body.classList.toggle("sol-mobile", on);
      const ballLab = $("solBallLab"); if (on && !was && ballLab && ballLab._solFold) ballLab._solFold(false);
      if (on && !was) { document.body.classList.remove("sol-mobile-menus"); menu.textContent = "☰ Настройки"; menu.setAttribute("aria-expanded", "false"); coneZoom = 1; conePan = [0, 0]; coneDen = 0; }
      was = on; sync(); requestAnimationFrame(() => { cgrpCols(); tzcAll(); renderCone(); });
    };
    small.addEventListener("change", layout); landscape.addEventListener("change", layout); layout();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (mobile()) cgrpCols(); });
  }
  /* v0.027: подсказка по долгому нажатию пальцем. Наведения на телефоне нет, и значки (⚖ ◇ ⏸ ⟳ ≋ ⊙, ч/н ▥ ◧ ◨, T N 2T…, ◀ ▶ ⌖✕, ВСЁ ПО1 ВС ВБ) было не понять.
     Держишь кнопку ~0,45 с — над ней всплывает её подсказка (title / data-zz-tip, первый абзац); отпустил — нажатия не будет. Кнопки с повтором при удержании
     (− + масштаба, стрелки ползунков) не участвуют: у них удержание — действие */
  function touchTips() {
    const SKIP = ".c3zoom, .zerk-arrow, .sar", HOLD = 450;
    let timer = 0, start = null, tipFor = null, suppress = 0, lastTouch = 0, tip = null;
    const textOf = el => { const t = el.getAttribute("title") || (el.dataset && el.dataset.zzTip) || el.getAttribute("aria-label") || ""; return t.split(/\n\s*\n/)[0].trim(); };
    const hide = () => { if (tip) tip.hidden = true; tipFor = null; };
    const show = (el) => {
      const t = textOf(el); if (!t) return false;
      if (!tip) { tip = document.createElement("div"); tip.id = "solTouchTip"; tip.setAttribute("role", "tooltip"); document.body.appendChild(tip); }
      tip.textContent = t; tip.hidden = false;
      const r = el.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight, m = 8;
      const x = Math.max(m, Math.min(innerWidth - w - m, r.left + r.width / 2 - w / 2)), y = r.top - h - m >= m ? r.top - h - m : Math.min(innerHeight - h - m, r.bottom + m);
      tip.style.left = x + "px"; tip.style.top = y + "px"; tipFor = el; return true;
    };
    window.addEventListener("pointerdown", e => {
      hide(); clearTimeout(timer); start = null;
      if (e.pointerType !== "touch") return; lastTouch = performance.now();
      const el = e.target.closest && e.target.closest("#w-cone .wbody button, #w-cone .wbody [role=button]");
      if (!el || el.closest(SKIP) || !textOf(el)) return;
      start = { el, x: e.clientX, y: e.clientY, id: e.pointerId };
      timer = setTimeout(() => { if (start && show(start.el)) { suppress = performance.now() + 1500; if (navigator.vibrate) try { navigator.vibrate(10); } catch (_) {} } }, HOLD);
    }, true);
    window.addEventListener("pointermove", e => { if (start && e.pointerId === start.id && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 8) { clearTimeout(timer); start = null; hide(); } }, true);
    const up = e => { if (start && e.pointerId === start.id) { clearTimeout(timer); start = null; if (tipFor) setTimeout(hide, 2500); } };
    window.addEventListener("pointerup", up, true); window.addEventListener("pointercancel", up, true);
    window.addEventListener("click", e => { if (performance.now() < suppress) { suppress = 0; e.preventDefault(); e.stopImmediatePropagation(); } }, true);
    window.addEventListener("contextmenu", e => { if (performance.now() - lastTouch < 1500 && e.target.closest && e.target.closest("#w-cone .wbody button, #w-cone .wbody [role=button]")) { e.preventDefault(); e.stopImmediatePropagation(); } }, true);
    window.addEventListener("scroll", hide, true);
  }
  touchTips();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true }); else init();
})();
