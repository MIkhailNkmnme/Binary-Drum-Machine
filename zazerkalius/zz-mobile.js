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
      coneBallOn: true, coneBallRoute: "eight", coneBallStart: "center", coneBallMult: "1", coneBitStep: false, coneSpinMode: "obit", coneAutoSp: 4.7,
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
    for (const name of ["вид", "кольца", "кручение", "лазер", "строка 1", "щели", "за чертой", "алгоритм", "звук", "аниматрица", "3d", "дзен"]) Z.cgrpMin[name] = true;
    Z.sunTblMin = true; Z.ringTblMin = true;
  };
  function init() {
    if (ZZ_SOLO !== "w-cone" || ZZ_BG) return;
    const wb = $("w-cone").querySelector(":scope > .wbody"), tools = wb.querySelector(":scope > .tools"); if (!tools) return;
    const bar = document.createElement("div"); bar.id = "solMobileBar";
    const button = (label, title, action) => { const b = document.createElement("button"); b.type = "button"; b.textContent = label; b.title = title; b.onclick = action; bar.appendChild(b); return b; };
    const play = button("▶ крутить", "Шарик и кольца запускаются и останавливаются вместе", () => $("bConeAuto").click());
    const dir = button("↻ вправо", "Изменить направление вращения и сторону старта шарика", () => $("bConeDir").click());
    button("● ↩", "Вернуть шарик в выбранную стартовую точку", () => $("bConeBallReset").click());
    button("2 кольца", "Настроить восьмёрку: полукольцо и два противоположных бита. Заменяет строки на 1 и 11.", () => {
      if (rowsLocked()) return;
      if (coneSpinning) $("bConeAuto").click();
      snapshot(); caseState(); save(); location.reload();
    });
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
      const running = coneSpinning, text = running ? "⏸ стоп" : "▶ крутить";
      if (play.textContent !== text) play.textContent = text;
      play.setAttribute("aria-pressed", String(running)); dir.textContent = (Z.coneAutoSp ?? 30) < 0 ? "↺ влево" : "↻ вправо";
    };
    for (const id of ["bConeAuto", "bConeDir"]) new MutationObserver(sync).observe($(id), { childList: true, characterData: true, subtree: true });
    wb.addEventListener("pointerdown", e => {
      if (!mobile() || e.target.closest("button, input, select, textarea, label, a")) return;
      if (e.target.closest(".glab, .smh, .rth, .cgsz")) e.stopPropagation();
    }, true);
    let was = false;
    const layout = () => {
      const on = mobile(); document.body.classList.toggle("sol-mobile", on);
      const ballLab = $("solBallLab"); if (on && !was && ballLab) ballLab.open = true;
      if (on && !was) { document.body.classList.remove("sol-mobile-menus"); menu.textContent = "☰ Настройки"; menu.setAttribute("aria-expanded", "false"); coneZoom = 1; conePan = [0, 0]; coneDen = 0; }
      was = on; sync(); requestAnimationFrame(() => { cgrpCols(); tzcAll(); renderCone(); });
    };
    small.addEventListener("change", layout); landscape.addEventListener("change", layout); layout();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (mobile()) cgrpCols(); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true }); else init();
})();
