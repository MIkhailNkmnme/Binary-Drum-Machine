/* ═══════════════════════════════════════════════════════════════════════════════════════════
   ZAZERKALIUS — ИНТЕРФЕЙС
   Всё состояние — в объекте Z; сохраняется в localStorage (обёрнуто в try: в приватном окне
   хранилища может не быть, и страница обязана работать без него). Математика — в zz-core.js.
   ═══════════════════════════════════════════════════════════════════════════════════════════ */
const ZZ_KEY = "zazerkalius_v1";
const $ = (id) => document.getElementById(id);

const Z = {
  rows: ["1", "11", "101", "1111", "10001", "110011", "1010101", "11111111", "100000001"],
  cur: 4,
  fixShow: true,
  ff: '"Roboto Mono", Consolas, monospace',
  fs: 18,
  descentAlign: "center",
  cycOp: "rotLI", cycHeat: true,
  gf2Op: "rotLI", gf2T: 1,
  linSrc: "cur", thruMode: "concatR",
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
  try { localStorage.setItem(ZZ_KEY, JSON.stringify(Z)); } catch (e) { /* нет хранилища — не беда */ }
}
let msgTimer = 0;
function say(t){
  const m = $("msg");
  m.textContent = t; m.classList.add("show");
  clearTimeout(msgTimer); msgTimer = setTimeout(() => m.classList.remove("show"), Math.min(12000, 2500 + t.length * 45));
}
function cur(){ return Z.rows[Z.cur] || ""; }
function snapshot(){ undoStack.push({ rows: Z.rows.slice(), cur: Z.cur }); if (undoStack.length > 200) undoStack.shift(); }
function undo(){
  const u = undoStack.pop();
  if (!u) { say("↩ Отменять нечего."); return; }
  Z.rows = u.rows; Z.cur = u.cur; renderAll(); save(); say("↩ Отменено.");
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
  const probe = document.querySelector("#ptrBits .bit");
  if (probe) { const w = probe.getBoundingClientRect().width; if (w > 0) return w; }
  return Z.fs * 0.62;
}

/* ─── Столбик строк ──────────────────────────────────────────────────────────────────────── */
function renderRows(){
  const L = $("rowList");
  let h = "";
  Z.rows.forEach((s, i) => {
    const shown = s.length > 160 ? s.slice(0, 160) + "…" : s;
    h += '<div class="rw' + (i === Z.cur ? " cur" : "") + '" data-r="' + i + '" title="' + s.length + ' бит">' +
         '<span class="no">' + i + '</span><span class="bits">' + bitsPlain(shown) + "</span></div>";
  });
  L.innerHTML = h;
  const c = L.querySelector(".rw.cur");
  if (c) c.scrollIntoView({ block: "nearest" });
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
    const where = (a.pos2 % 2 === 0) ? `по биту ${a.pos2 / 2}` : `в шве между битами ${(a.pos2 - 1) / 2} и ${(a.pos2 + 1) / 2}`;
    h += '<div class="ptr' + (a.kind === "anti" ? " anti" : "") + '" data-k="' + idx + '" style="left:' + left + "px;width:" + width +
         "px;top:" + (4 + k * 10) + "px;--ax:" + ax + 'px" title="' + kindTxt + ", " + a.len + " бит (" + a.lo + "…" + a.hi + "), ось " + where + '"></div>';
  });
  const lanesEl = $("ptrLanes");
  lanesEl.innerHTML = h;
  lanesEl.style.height = (lanes.length ? 8 + lanes.length * 10 : 0) + "px";
  lanesEl.style.width = (s.length * cw) + "px";
  lanesEl.onmouseover = (e) => {
    const p = e.target.closest(".ptr"); if (!p) return;
    const a = axes[+p.dataset.k]; if (!a) return;
    document.querySelectorAll("#ptrBits .bit").forEach((b, i) => {
      b.classList.toggle(a.kind === "pal" ? "hl" : "hla", i >= a.lo && i <= a.hi);
    });
  };
  lanesEl.onmouseout = () => document.querySelectorAll("#ptrBits .bit").forEach(b => b.classList.remove("hl", "hla"));
  const np = all.filter(a => a.kind === "pal").length, na = all.length - np;
  const longest = all.length ? all[0] : null;
  $("ptrLegend").innerHTML = all.length
    ? `<span class="p">▔│▔ палиндромов ${np}</span> · <span class="a">▔│▔ антипалиндромов ${na}</span> · самая длинная ось — ${longest.len} бит` +
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

/* ─── Окна ───────────────────────────────────────────────────────────────────────────────── */
/* Раскладка по умолчанию — от ширины стола: зеркало слева широким, справа столбец из спуска и
   цикла, под зеркалом GF(2) и лин. сложность, ниже лента и подсказки. */
function defaultLayout(){
  const W = Math.max(900, $("desk").clientWidth);
  const g = 12;
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
function layoutAll(reset){
  const def = defaultLayout();
  document.querySelectorAll(".win").forEach(el => {
    if (reset || !Z.win[el.id]) Z.win[el.id] = Object.assign({ collapsed: false, hint: false }, def[el.id] || { x: 20, y: 20, w: 320, h: 240 });
    applyWin(el);
  });
  $("w-help").style.display = Z.helpOn ? "" : "none";
  $("bHelp").classList.toggle("on", Z.helpOn);
}
function setupWin(el){
  const head = document.createElement("div");
  head.className = "whead";
  head.innerHTML = '<span class="wt">' + esc(el.dataset.title || el.id) + "</span>" +
    (el.querySelector(".whint") ? '<button class="bh" title="Подсказка: что это и почему">?</button>' : "") +
    '<button class="bc" title="Свернуть / развернуть">–</button>';
  el.insertBefore(head, el.firstChild);
  const st = () => (Z.win[el.id] = Z.win[el.id] || { x: 20, y: 20, w: 320, h: 240 });
  const bh = head.querySelector(".bh");
  if (bh) bh.onclick = () => { const w = st(); w.hint = !w.hint; el.classList.toggle("hint", w.hint); bh.classList.toggle("on", w.hint); save(); };
  if (bh && Z.win[el.id] && Z.win[el.id].hint) bh.classList.add("on");
  head.querySelector(".bc").onclick = () => {
    const w = st(); w.collapsed = !w.collapsed;
    el.classList.toggle("collapsed", w.collapsed);
    if (!w.collapsed) el.style.height = w.h + "px";
    save();
  };
  const front = () => { Z.z++; el.style.zIndex = Z.z; };
  el.addEventListener("pointerdown", front);
  head.addEventListener("pointerdown", (e) => {
    if (e.target.closest("button") || e.button !== 0) return;
    if (getComputedStyle(el).position !== "absolute") return;   // узкий экран: окна стоят стопкой
    e.preventDefault();
    const w = st();
    const sx = e.clientX, sy = e.clientY, ox = w.x, oy = w.y;
    head.setPointerCapture(e.pointerId);
    const move = (ev) => {
      w.x = Math.max(0, ox + ev.clientX - sx); w.y = Math.max(0, oy + ev.clientY - sy);
      el.style.left = w.x + "px"; el.style.top = w.y + "px";
    };
    const up = () => { head.removeEventListener("pointermove", move); head.removeEventListener("pointerup", up); save(); };
    head.addEventListener("pointermove", move);
    head.addEventListener("pointerup", up);
  });
  // Размер, растянутый за угол, запоминается.
  if (window.ResizeObserver) {
    let t = 0;
    new ResizeObserver(() => {
      const w = Z.win[el.id]; if (!w || w.collapsed || getComputedStyle(el).position !== "absolute") return;
      w.w = Math.round(el.offsetWidth); w.h = Math.round(el.offsetHeight);
      clearTimeout(t); t = setTimeout(save, 300);
      if (el.id === "w-mirror") renderPointers();
    }).observe(el);
  }
}

/* ─── Всё разом ──────────────────────────────────────────────────────────────────────────── */
function applyView(){
  document.documentElement.style.setProperty("--ff", Z.ff);
  document.documentElement.style.setProperty("--fs", Z.fs + "px");
  $("bFixShow").classList.toggle("on", Z.fixShow);
}
function renderAll(){
  applyView();
  renderRows();
  renderCross();
  renderPointers();
  renderDescent();
}

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
  document.querySelectorAll(".win").forEach(setupWin);
  layoutAll(false);

  const opEntries = Object.entries(ZZ_OPS).map(([k, o]) => [k, o.lab]);
  fillSelect("cycOp", opEntries, Z.cycOp);
  fillSelect("gf2Op", opEntries, Z.gf2Op);
  fillSelect("thruMode", Object.entries(ZZ_THRU_MODES), Z.thruMode);
  $("fontSel").value = Z.ff; $("fsRange").value = Z.fs;
  $("descentAlign").value = Z.descentAlign;
  $("cycHeat").checked = Z.cycHeat;
  $("gf2T").value = Z.gf2T;
  $("linSrc").value = Z.linSrc;
  $("ptrMin").value = Z.ptrMin; $("ptrPal").checked = Z.ptrPal; $("ptrAnti").checked = Z.ptrAnti;

  // Строки
  $("rowList").onclick = (e) => { const r = e.target.closest(".rw"); if (!r) return; Z.cur = +r.dataset.r; renderAll(); save(); };
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
  $("linSrc").onchange = (e) => { Z.linSrc = e.target.value; save(); };
  $("bLin").onclick = runLin;
  $("thruMode").onchange = (e) => { Z.thruMode = e.target.value; save(); };
  $("bThru").onclick = runThru;
  $("bDecim").onclick = runDecim;

  // Шапка
  $("fontSel").onchange = (e) => { Z.ff = e.target.value; renderAll(); save(); };
  $("fsRange").oninput = (e) => { Z.fs = +e.target.value; renderAll(); save(); };
  $("bLayout").onclick = () => { layoutAll(true); save(); renderPointers(); };
  $("bUndo").onclick = undo;
  $("bHelp").onclick = () => { Z.helpOn = !Z.helpOn; layoutAll(false); save(); };

  // Клавиши: ↑/↓ — по строкам, Ctrl+Z — отмена (не в полях ввода).
  document.addEventListener("keydown", (e) => {
    const t = e.target;
    if (t && t.closest && t.closest("input, select, textarea")) return;
    if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "я")) { e.preventDefault(); undo(); return; }
    if (e.key === "ArrowUp" && Z.cur > 0) { e.preventDefault(); Z.cur--; renderAll(); save(); }
    else if (e.key === "ArrowDown" && Z.cur < Z.rows.length - 1) { e.preventDefault(); Z.cur++; renderAll(); save(); }
  });

  renderAll();
  // Шрифт мог догрузиться позже — ширина ячейки бита изменится, скобки надо переложить.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => renderPointers());
}
init();
