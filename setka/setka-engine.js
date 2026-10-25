/* Сетки v0.001: independent field engine extracted from Zazerkalius. */
let rmbCur = null, rmbVals = [], rmbHeat = [], rmbAge = [], rmbFrame = 0, rmbKey = "", rmbClock = 0, rmbLastA = null;   // v0.794: rmbAge — когда клетка менялась, в проходах волны (rmbClock)
/* v0.794, по снимку поля «■ квадраты» — «вот эти бы тоже в ромбоиды из строк»: «◇ бит» — каждый бит строки — ромб из двух треугольников
   (▼▲ — ромб наклонён «\», ▲▼ при «← вбок» — «/»), ряды стоят, как строки в поле (◫ по центру / ◧ влево / ◨ вправо): квадратная сетка поля,
   скошенная в треугольную. Где строка не встаёт на сетку ряда выше, она сдвигается на полклетки — по ёлочке или вбок, как в режиме «▲ бит».
   v0.794, «да, особенно 3»: «👓 возраст» — клетка цветом по тому, сколько проходов волны она не менялась: красная — только что, дальше оранжевая,
   жёлтая, зелёная, голубая, синяя; застывшая (16 проходов и дольше или не менялась с открытия окна) — своим обычным цветом. Нули — тем же цветом
   бледнее. Цифры — только при крупном наезде (на общем плане они превращались в зернистость); «⇣ за волной» — вид сам едет за строкой волны */
const RMB_AGE = [[0.5, "#ff3b3b"], [1, "#ff8a3d"], [2, "#ffd166"], [4, "#9be564"], [8, "#22d3ee"], [16, "#5b7cfa"]];
function rmbSt(){ if (!Z.rmb || typeof Z.rmb !== "object") Z.rmb = {}; const r = Z.rmb;
  if (!["c", "zz", "l", "r"].includes(r.al)) r.al = "zz"; if (!["each", "rmb", "grp", "none"].includes(r.ln)) r.ln = "each";
  if (!["", "chg", "age", "pair"].includes(r.gl)) r.gl = ""; if (!["tri","rmb","square","ring"].includes(r.cell)) r.cell = "tri"; r.wave = "mir"; if (!["l", "d", "r"].includes(r.cpri)) r.cpri = "l"; return r; }
function rmbLayout(R, M, al, cell){   /* → hs — начало каждого ряда в полуклетках, ok — лежит ли ряд на сетке ряда выше, u0 — первый треугольник ряда ▼ (1)
   или ▲ (0), base — как стоят ряды. «▲ бит»: ряд i — ▲ j на hs[i] + 2j, ряды по центру. «◇ бит» (v0.794): бит j — треугольники 2j и 2j + 1, ряды — как в поле */
  if(cell==="square"||cell==="ring"){
    const max=Math.max(1,...R.slice(0,M).map(row=>row.length)),base=gridsState().align||"center",hs=Int32Array.from(R.slice(0,M),(row)=>cell==="ring"?0:-max+2*(base==="left"?0:base==="right"?max-row.length:Math.floor((max-row.length)/2)));
    return {hs,ok:new Uint8Array(M).fill(1),u0:0,base};
  }
  const rm = cell === "rmb", base = rm ? (gridsState().align || "center") : "center", u0 = rm && al !== "l" ? 1 : 0;
  const hs = new Int32Array(M), ok = new Uint8Array(M); let z = -1;
  for (let i = 0; i < M; i++) {
    const n = (R[i] || "").length;
    if (!i) { hs[0] = -n; ok[0] = 1; continue; }
    const dn = (R[i - 1] || "").length - n, d = base === "left" ? 0 : base === "right" ? 2 * dn : dn;   // ряд съезжает на d полуклеток
    if (al === "c" || (d & 1)) { hs[i] = hs[i - 1] + d; ok[i] = d & 1 ? 1 : 0; continue; }
    const sg = al === "l" ? -1 : al === "r" ? 1 : rm && al !== "zz" ? 1 : (z = -z);
    hs[i] = hs[i - 1] + d + sg; ok[i] = 1;
  }
  return { hs, ok, u0, base };
}
/* v0.795, по снимку «▲▼» — «Аниматрица изначально строилась так, можно её тут: волна — зеркало по горизонтали на каждую строку до 1 строки и так
   по циклу; вариации — зеркало с инверсией, горизонт через 1, 2, 4, 8… строки вместо каждой, только чётные биты, только чётные группы по 2-4-8…».
   «⇕ зеркало» в «◇ Ромбоидах» — своя волна. Шаг: горизонт — нижний край строки a; всё, что над ним (строки a, a − 1, … до строки 1), отражается
   вниз: строка a + k получает отражение строки a + 1 − k. Отражение в треугольной сетке переворачивает треугольники: ▼ верхней строки ложится на ▲
   нижней ровно под ним (▼ — инверсия ▲ над ним, как везде в «▲▼»); ▲ верхних ложатся на ▼ нижних, а ▼ сами — инверсия ▲ над ними, поэтому пишутся
   только биты строк (▲). Горизонт идёт вниз на 1 (или 2, 4, 8, 16) строк за шаг; дошёл до низа — проход, и снова сверху. Читается только то, что
   над горизонтом, пишется только под ним — порядок внутри шага не важен. Варианты: «¬» — зеркало с инверсией; биты — все, чётные (2-й, 4-й, …),
   чётные группы по 2, 4, 8, 16 (вторая, четвёртая…); «⊕» — не заменять бит, а XOR со старым. Повтор картины — цикл (сообщение), как в Аниматрице */
const rmbW = { on: 0, raf: 0, h: 0, pass: 0, start: null, last: "", seen: new Map(), t: 0, acc: 0, used: false, sv: 0 };
function rmbWHash(R){ let h1 = 0x811c9dc5, h2 = 0x1b873593; for (const s of R) { for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 16777619); h2 = Math.imul(h2 ^ c, 2246822519); } h1 = Math.imul(h1 ^ 44, 16777619); }
  return (h1 >>> 0).toString(36) + ":" + (h2 >>> 0).toString(36) + ":" + R.length; }
function rmbWStep(){
  const R = gridsState().rows, N = R.length, r = rmbSt(); if (N < 2) return false;
  const key = R.join(",");
  if (key !== rmbW.last) { rmbW.h = 0; rmbW.pass = 0; rmbW.start = R.slice(); rmbW.startState=gridsSnap(); rmbW.seen = new Map([[rmbWHash(R), 0]]); gridsSnapshot(); }   // строки правили не этой волной — счёт заново, ↩ вернёт
  rmbW.used = true;
  const M=Math.min(N,4096),a=Math.min(rmbW.h,M-2),{hs,u0}=rmbLayout(R,M,r.al,r.cell),g={hs,u0,rm:r.cell==="rmb",cell:r.cell,rows:R,tw:1,ox:0,oy:0};
  const y=(a+1)*(r.cell==="square"?1:Math.sqrt(3)/2),axis={a:[0,y],b:[1,y]},mask=+r.wmask||0;
  let result;
  if(r.cell==="ring"){
    const next=R.slice(),copies=[];for(let row=a+1;row<Math.min(M,2*a+2);row++){const from=2*a+1-row;next[row]=[...R[row]].map((_,col)=>{const source=[from,Math.min(R[from].length-1,Math.floor((col+.5)*R[from].length/R[row].length))];copies.push([source,[row,col]]);return R[source[0]][source[1]];}).join("");}result={rows:next,copies};
  }else result=window.ZZRmbAxis.reflectRows(R,g,axis,"negative");
  const rows=result.rows.map((row,i)=>row.split("").map((bit,j)=>{if(i<=a||i>a+a+1||(mask&&Math.floor(j/mask)%2!==1))return R[i][j];let value=+bit;if(r.winv)value=1-value;if(r.wxor)value^=+R[i][j];return String(value);}).join(""));
  const copies=result.copies.filter(([,to])=>to[0]>a&&to[0]<=a+a+1&&(!mask||Math.floor(to[1]/mask)%2===1));
  window.ZZGrids.reconcile(gridsState(),rows,{copies});
  rmbW.h += Math.max(1, +r.whz || 1);
  if (rmbW.h >= M - 1) { rmbW.h = 0; rmbW.pass++;
    const hh = rmbWHash(R);
    if (rmbW.seen.has(hh)) { if (!rmbW.per) { rmbW.per0 = rmbW.seen.get(hh); rmbW.per = rmbW.pass - rmbW.per0; say(`🔁 Зеркальная волна: проход ${rmbW.pass} повторяет проход ${rmbW.per0} — цикл ${rmbW.per}.`); } }
    else if (rmbW.seen.size < 200000) rmbW.seen.set(hh, rmbW.pass); }
  rmbW.last = R.join(",");
  return true;
}
function rmbWReset(){ rmbW.per = 0; rmbW.per0 = 0; }
function rmbWStop(){ if (rmbW.raf) cancelAnimationFrame(rmbW.raf); rmbW.raf = 0; rmbW.on = 0; save(); rmbUi(); }
function rmbWPlay(){
  if (rmbW.on) { rmbWStop(); return; }
  if (gridsLocked()) return;
  if (gridsState().rows.join(",") !== rmbW.last) rmbWReset();
  rmbW.on = 1; rmbW.t = performance.now(); rmbW.acc = 0; rmbW.sv = rmbW.t;
  const tick = (now) => {
    if (!rmbW.on) return;
    const sp = 0.5 * Math.pow(10000, (+rmbSt().wsp >= 0 ? +rmbSt().wsp : 40) / 100);   // шагов горизонта в секунду, 0,5…5000
    rmbW.acc = Math.min(rmbW.acc + (now - rmbW.t) / 1000 * sp, 4000); rmbW.t = now;
    let n = 0; const t0 = performance.now();
    while (rmbW.acc >= 1 && performance.now() - t0 < 30) { rmbW.acc--; if (!rmbWStep()) { rmbWStop(); return; } n++; }
    if (n) { renderRmb(); if (now - rmbW.sv > 3000) { rmbW.sv = now; save(); } }
    rmbW.raf = requestAnimationFrame(tick);
  };
  rmbW.raf = requestAnimationFrame(tick); rmbUi();
  const r = rmbSt(); say(`⇕ Зеркальная волна${r.winv ? " с инверсией" : ""}: горизонт через ${+r.whz || 1}, ${RMB_WMASK[+r.wmask || 0]}${r.wxor ? ", ⊕ со старым" : ""}. ↩ вернёт строки.`);
}
function rmbWHome(){
  rmbWStop();
  if (!rmbW.start) { say("⇕ Зеркальная волна ещё не шла."); return; }
  if (gridsLocked()) return;
  gridsSnapshot(); if(rmbW.startState)gridsApply(rmbW.startState);else gridsState().rows.splice(0, gridsState().rows.length, ...rmbW.start); rmbW.h = 0; rmbW.pass = 0; rmbW.last = gridsState().rows.join(","); rmbWReset();
  rmbW.seen = new Map([[rmbWHash(gridsState().rows), 0]]); gridsState().cur = Math.min(gridsState().cur, gridsState().rows.length - 1); renderRmb(); save(); say("⤺ Строки — какими были до зеркальной волны.");
}
const RMB_WMASK = { 0: "все биты", 1: "чётные биты", 2: "чётные пары", 4: "чётные четвёрки", 8: "чётные восьмёрки", 16: "чётные по 16" };
/* v0.809, по снимку ковра Ромбоидов — «Zazerkalius — можно этим набрать?», выбрано «строками в поле, ёлочкой»: «Аа» в «◇ Ромбоидах» — текст ложится
   в поле строками пиксельного шрифта 5 × 7 (латиница, кириллица, цифры; строчные — как заглавные), буква от буквы — через столбец, по краям — поле в
   столбец и строку нулей. Окно переходит в «◇ бит» и «ёлочку»: каждый бит — ромб, ряды через один сдвинуты на полклетки — буквы прямые. Это обычные
   строки: Аниматрица, ⇕ зеркало, 🧊 кубы, возраст — всё по ним. ↩ вернёт прежние строки */
const RMB_FONT = (() => {
  const F = {
    A: ".###.|#...#|#...#|#####|#...#|#...#|#...#", B: "####.|#...#|#...#|####.|#...#|#...#|####.", C: ".###.|#...#|#....|#....|#....|#...#|.###.",
    D: "####.|#...#|#...#|#...#|#...#|#...#|####.", E: "#####|#....|#....|####.|#....|#....|#####", F: "#####|#....|#....|####.|#....|#....|#....",
    G: ".###.|#...#|#....|#.###|#...#|#...#|.###.", H: "#...#|#...#|#...#|#####|#...#|#...#|#...#", I: ".###.|..#..|..#..|..#..|..#..|..#..|.###.",
    J: "..###|...#.|...#.|...#.|...#.|#..#.|.##..", K: "#...#|#..#.|#.#..|##...|#.#..|#..#.|#...#", L: "#....|#....|#....|#....|#....|#....|#####",
    M: "#...#|##.##|#.#.#|#.#.#|#...#|#...#|#...#", N: "#...#|#...#|##..#|#.#.#|#..##|#...#|#...#", O: ".###.|#...#|#...#|#...#|#...#|#...#|.###.",
    P: "####.|#...#|#...#|####.|#....|#....|#....", Q: ".###.|#...#|#...#|#...#|#.#.#|#..#.|.##.#", R: "####.|#...#|#...#|####.|#.#..|#..#.|#...#",
    S: ".####|#....|#....|.###.|....#|....#|####.", T: "#####|..#..|..#..|..#..|..#..|..#..|..#..", U: "#...#|#...#|#...#|#...#|#...#|#...#|.###.",
    V: "#...#|#...#|#...#|#...#|#...#|.#.#.|..#..", W: "#...#|#...#|#...#|#.#.#|#.#.#|#.#.#|.#.#.", X: "#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#",
    Y: "#...#|#...#|.#.#.|..#..|..#..|..#..|..#..", Z: "#####|....#|...#.|..#..|.#...|#....|#####",
    0: ".###.|#...#|#..##|#.#.#|##..#|#...#|.###.", 1: "..#..|.##..|..#..|..#..|..#..|..#..|.###.", 2: ".###.|#...#|....#|...#.|..#..|.#...|#####",
    3: "#####|...#.|..#..|...#.|....#|#...#|.###.", 4: "...#.|..##.|.#.#.|#..#.|#####|...#.|...#.", 5: "#####|#....|####.|....#|....#|#...#|.###.",
    6: "..##.|.#...|#....|####.|#...#|#...#|.###.", 7: "#####|....#|...#.|..#..|.#...|.#...|.#...", 8: ".###.|#...#|#...#|.###.|#...#|#...#|.###.",
    9: ".###.|#...#|#...#|.####|....#|...#.|.##..",
    "Б": "#####|#....|#....|####.|#...#|#...#|####.", "Г": "#####|#....|#....|#....|#....|#....|#....", "Д": "..##.|.#.#.|.#.#.|.#.#.|.#.#.|#####|#...#",
    "Ж": "#.#.#|#.#.#|.###.|..#..|.###.|#.#.#|#.#.#", "З": ".###.|#...#|....#|..##.|....#|#...#|.###.", "И": "#...#|#...#|#..##|#.#.#|##..#|#...#|#...#",
    "Й": ".#.#.|..#..|#...#|#..##|#.#.#|##..#|#...#", "Л": "..###|.#..#|.#..#|.#..#|.#..#|.#..#|#...#", "П": "#####|#...#|#...#|#...#|#...#|#...#|#...#",
    "У": "#...#|#...#|#...#|.####|....#|#...#|.###.", "Ф": "..#..|.###.|#.#.#|#.#.#|.###.|..#..|..#..", "Ц": "#..#.|#..#.|#..#.|#..#.|#..#.|#####|....#",
    "Ч": "#...#|#...#|#...#|.####|....#|....#|....#", "Ш": "#.#.#|#.#.#|#.#.#|#.#.#|#.#.#|#.#.#|#####", "Ъ": "##...|.#...|.#...|.###.|.#..#|.#..#|.###.",
    "Ы": "#...#|#...#|#...#|##..#|#.#.#|#.#.#|##..#", "Ь": "#....|#....|#....|####.|#...#|#...#|####.", "Э": ".###.|#...#|....#|..###|....#|#...#|.###.",
    "Ю": "#..#.|#.#.#|#.#.#|###.#|#.#.#|#.#.#|#..#.", "Я": ".####|#...#|#...#|.####|..#.#|.#..#|#...#",
    ".": ".....|.....|.....|.....|.....|.##..|.##..", "-": ".....|.....|.....|#####|.....|.....|.....", "!": "..#..|..#..|..#..|..#..|..#..|.....|..#..",
    "?": ".###.|#...#|....#|...#.|..#..|.....|..#..", ",": ".....|.....|.....|.....|.##..|..#..|.#...", ":": ".....|.##..|.##..|.....|.##..|.##..|.....",
    "+": ".....|..#..|..#..|#####|..#..|..#..|.....", "=": ".....|.....|#####|.....|#####|.....|.....", "/": "....#|...#.|...#.|..#..|.#...|.#...|#....",
    "(": "...#.|..#..|.#...|.#...|.#...|..#..|...#.", ")": ".#...|..#..|...#.|...#.|...#.|..#..|.#...", " ": "...|...|...|...|...|...|...",
    /* v0.848, «там поправь, чтобы и строчные буквы делал»: строчные — свои, высотой в 5 рядов (ряды 3–7), у b d f h k l t б й ё — выносной элемент вверх,
       у g j p q y д ф ц щ — хвост ниже строки (ряды 8–9; нет таких букв в тексте — рядов 7, как прежде) */
    "a": ".....|.....|.###.|....#|.####|#...#|.####", "b": "#....|#....|####.|#...#|#...#|#...#|####.", "c": ".....|.....|.###.|#....|#....|#...#|.###.",
    "d": "....#|....#|.####|#...#|#...#|#...#|.####", "e": ".....|.....|.###.|#...#|#####|#....|.###.", "f": "..##.|.#..#|.#...|###..|.#...|.#...|.#...",
    "g": ".....|.....|.####|#...#|#...#|#...#|.####|....#|.###.", "h": "#....|#....|#.##.|##..#|#...#|#...#|#...#", "i": "..#..|.....|.##..|..#..|..#..|..#..|.###.",
    "j": "...#.|.....|..##.|...#.|...#.|...#.|...#.|#..#.|.##..", "k": "#....|#....|#..#.|#.#..|##...|#.#..|#..#.", "l": ".##..|..#..|..#..|..#..|..#..|..#..|.###.",
    "m": ".....|.....|##.#.|#.#.#|#.#.#|#.#.#|#.#.#", "n": ".....|.....|#.##.|##..#|#...#|#...#|#...#", "o": ".....|.....|.###.|#...#|#...#|#...#|.###.",
    "p": ".....|.....|####.|#...#|#...#|#...#|####.|#....|#....", "q": ".....|.....|.####|#...#|#...#|#...#|.####|....#|....#", "r": ".....|.....|#.##.|##..#|#....|#....|#....",
    "s": ".....|.....|.####|#....|.###.|....#|####.", "t": ".#...|.#...|###..|.#...|.#...|.#..#|..##.", "u": ".....|.....|#...#|#...#|#...#|#..##|.##.#",
    "v": ".....|.....|#...#|#...#|#...#|.#.#.|..#..", "w": ".....|.....|#...#|#...#|#.#.#|#.#.#|.#.#.", "x": ".....|.....|#...#|.#.#.|..#..|.#.#.|#...#",
    "y": ".....|.....|#...#|#...#|#...#|#...#|.####|....#|.###.", "z": ".....|.....|#####|...#.|..#..|.#...|#####", "б": "...#.|.##..|#....|####.|#...#|#...#|.###.",
    "в": ".....|.....|####.|#...#|####.|#...#|####.", "г": ".....|.....|#####|#....|#....|#....|#....", "д": ".....|.....|..##.|.#.#.|.#.#.|.#.#.|#####|#...#",
    "ё": ".#.#.|.....|.###.|#...#|#####|#....|.###.", "ж": ".....|.....|#.#.#|#.#.#|.###.|#.#.#|#.#.#", "з": ".....|.....|.###.|#...#|..##.|#...#|.###.",
    "и": ".....|.....|#...#|#..##|#.#.#|##..#|#...#", "й": ".#.#.|..#..|#...#|#..##|#.#.#|##..#|#...#", "к": ".....|.....|#..#.|#.#..|##...|#.#..|#..#.",
    "л": ".....|.....|..###|.#..#|.#..#|.#..#|#...#", "м": ".....|.....|#...#|##.##|#.#.#|#...#|#...#", "н": ".....|.....|#...#|#...#|#####|#...#|#...#",
    "п": ".....|.....|#####|#...#|#...#|#...#|#...#", "т": ".....|.....|#####|..#..|..#..|..#..|..#..", "ф": ".....|..#..|.###.|#.#.#|#.#.#|#.#.#|.###.|..#..|..#..",
    "ц": ".....|.....|#..#.|#..#.|#..#.|#..#.|#####|....#", "ч": ".....|.....|#...#|#...#|.####|....#|....#", "ш": ".....|.....|#.#.#|#.#.#|#.#.#|#.#.#|#####",
    "щ": ".....|.....|#.#.#|#.#.#|#.#.#|#.#.#|#####|....#", "ъ": ".....|.....|##...|.#...|.###.|.#..#|.###.", "ы": ".....|.....|#...#|#...#|##..#|#.#.#|##..#",
    "ь": ".....|.....|#....|#....|####.|#...#|####.", "э": ".....|.....|.###.|#...#|..###|#...#|.###.", "ю": ".....|.....|#..#.|#.#.#|###.#|#.#.#|#..#.",
    "я": ".....|.....|.####|#...#|.####|.#..#|#...#",
  };
  const same = { "А": "A", "В": "B", "Е": "E", "Ё": "E", "К": "K", "М": "M", "Н": "H", "О": "O", "Р": "P", "С": "C", "Т": "T", "Х": "X", "Щ": "Ш",
    "а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "у": "y", "х": "x" };   // v0.848: строчные, совпадающие с латиницей
  for (const k in same) F[k] = F[same[k]];
  return F;
})();
function rmbTextLayout(txt){   // → строки поля: 7 рядов букв + по строке нулей сверху и снизу, по столбцу нулей по краям
  /* v0.810, по снимку «ZAZERKALIUS» — «между I лишние пробелы справа, слева»: шрифт пропорциональный — у буквы срезаются пустые крайние столбцы
     (у «I», «1», знаков), между буквами — ровно один столбец; пробел (вся клетка пустая) остаётся пробелом */
  const trim = (g) => { const w = g[0].length, empty = (x) => g.every(r => r[x] === "."); let a = 0, b = w - 1;
    if (g.every(r => !r.includes("#"))) return g; while (a < b && empty(a)) a++; while (b > a && empty(b)) b--; return g.map(r => r.slice(a, b + 1)); };
  /* v0.848: строчные — своими знаками (нет строчного — заглавный); знак до 9 рядов: 7 — сама буква, 8–9 — хвосты ниже строки */
  const gl = [...String(txt)].map(c => { const g = trim((RMB_FONT[c] || RMB_FONT[c.toUpperCase()] || RMB_FONT["?"]).split("|")), w = g[0].length;
    while (g.length < 9) g.push(".".repeat(w)); return g; });
  const H = gl.some(g => g[7].includes("#") || g[8].includes("#")) ? 9 : 7, rows = [];
  for (let r = 0; r < H; r++) rows.push("0" + gl.map(g => g[r].replace(/#/g, "1").replace(/\./g, "0")).join("0") + "0");
  const z = "0".repeat(rows[0].length); let start = 1;
  const letters = [...String(txt)].map((label, i) => { const width = gl[i][0].length, entry = {label, start, end:start + width}; start += width + 1; return entry; });
  return {rows:[z, ...rows, z], letters};
}
function rmbTextRows(txt){ return rmbTextLayout(txt).rows; }
function rmbTextBlocks(){
  const blocks=Array.isArray(gridsState().textBlocks)?gridsState().textBlocks.filter(b=>typeof b.text==="string"&&Number.isInteger(b.row)&&b.row>=0&&Number.isInteger(b.col)&&b.col>=0):[];
  return blocks.length?blocks:(gridsState().text?[{text:String(gridsState().text),row:0,col:0}]:[]);
}
function rmbDocumentLayout(blocks,width,rowCount){
  const letters=[];
  for(let i=0;i<blocks.length;i++){
    const block=blocks[i],font=rmbTextLayout(block.text),next=blocks.slice(i+1).find(b=>b.row>block.row);
    for(const [letterIndex,letter] of font.letters.entries()){if(block.deleted?.includes(letterIndex))continue;letters.push({...letter,blockIndex:i,letterIndex,letterKey:i+"/"+letterIndex,start:letter.start+block.col,end:letter.end+block.col,rowStart:block.row,rowEnd:next?next.row:rowCount});}
  }
  return {width,letters};
}
function rmbAppendText(rows,blocks,text){
  const font=rmbTextRows(text),width=Math.max(font[0].length,...rows.map(row=>row.length)),row=rows.length?rows.length+1:0;
  const result=rows.map(s=>s.padEnd(width,"0"));if(rows.length)result.push("0".repeat(width));result.push(...font.map(s=>s.padEnd(width,"0")));
  return {rows:result,width,blocks:[...blocks.map(b=>({...b})),{text,row,col:0}]};
}
// Count source bit cells inside each letter's tight bounding rectangle.
function rmbLetterCounts(rows, layout){
  const width = layout.width ?? layout.rows[0].length;
  if (!rows.length || rows.some(row => row.length !== width)) return null;
  const entries = layout.letters.map((letter, index) => {
    let left=letter.end,right=-1,top=rows.length,bottom=-1,ones=0;
    for(let row=letter.rowStart||0;row<Math.min(rows.length,letter.rowEnd??rows.length);row++) for(let col=letter.start;col<letter.end;col++) if(rows[row][col]==="1"){
      ones++;left=Math.min(left,col);right=Math.max(right,col);top=Math.min(top,row);bottom=Math.max(bottom,row);
    }
    const w=ones?right-left+1:0,h=ones?bottom-top+1:0,rhombi=w*h;
    return {...letter,index:index+1,ones,zeros:rhombi-ones,rhombi,width:w,height:h,left,right,top,bottom};
  });
  const total=entries.reduce((sum,e)=>{sum.ones+=e.ones;sum.zeros+=e.zeros;sum.rhombi+=e.rhombi;return sum;},{label:"Итого",ones:0,zeros:0,rhombi:0});
  return {entries,total};
}
function rmbHighlightCells(rows, counts, selection){
  if(!counts || !selection)return [];
  const cells=[];
  for(const entry of counts.entries){
    if(selection.index && entry.index!==selection.index)continue;
    if(!entry.ones)continue;
    for(let row=entry.top;row<=entry.bottom;row++)for(let col=entry.left;col<=entry.right;col++){
      const one=rows[row]?.[col]==="1";
      if(selection.kind==="ones"&&!one || selection.kind==="zeros"&&one)continue;
      cells.push([row,col]);
    }
  }
  return cells;
}
function rmbHighlightPolygon(row,col,geometry){
  if(geometry.cell==="square"||geometry.cell==="ring")return window.ZZGridShapes.polygon(row,col,geometry);
  const {hs,u0,rm,tw,ox,oy}=geometry;
  const h=tw*Math.sqrt(3)/2,x=ox+(hs[row]+(rm?2*col:col))*tw/2,y=oy+row*h;
  if(!rm)return ((col+u0)&1)?[[x,y],[x+tw,y],[x+tw/2,y+h]]:[[x,y+h],[x+tw,y+h],[x+tw/2,y]];
  return (u0&1)?[[x,y],[x+tw,y],[x+tw*1.5,y+h],[x+tw/2,y+h]]:[[x+tw/2,y],[x+tw*1.5,y],[x+tw,y+h],[x,y+h]];
}

let rmbStatsCache = null, rmbCountHighlight = null;
const rmbSelectedLetters=new Set();let rmbLetterSelectionState=null;
function rmbActiveText(blocks){return blocks.map(b=>[...b.text].filter((_,i)=>!b.deleted?.includes(i)).join("")).filter(Boolean).join(" · ");}
function rmbLetterPick(entry){
  if(rmbSelectedLetters.has(entry.letterKey))rmbSelectedLetters.delete(entry.letterKey);else rmbSelectedLetters.add(entry.letterKey);
  rmbStatsCache=null;rmbCountHighlight=null;renderRmb();$("rmbTextStats")?.focus?.({preventScroll:true});
}
function rmbLetterDelete(all=false){
  const counts=rmbStatsCache?.counts,entries=counts?.entries.filter(e=>all||rmbSelectedLetters.has(e.letterKey));
  if(!entries?.length||gridsLocked())return;
  rmbWStop();gridsSnapshot();
  const state=gridsState(),rows=state.rows.slice(),blocks=rmbTextBlocks().map(b=>({...b,deleted:[...(b.deleted||[])]}));
  for(const entry of entries){
    const block=blocks[entry.blockIndex];if(!block.deleted.includes(entry.letterIndex))block.deleted.push(entry.letterIndex);
    for(let row=entry.rowStart;row<Math.min(rows.length,entry.rowEnd);row++){
      const start=Math.max(0,entry.start),end=Math.min(rows[row].length,entry.end);
      if(end>start)rows[row]=rows[row].slice(0,start)+"0".repeat(end-start)+rows[row].slice(end);
    }
  }
  window.ZZGrids.reconcile(state,rows);state.textBlocks=blocks;state.text=rmbActiveText(blocks);
  rmbSelectedLetters.clear();rmbCountHighlight=null;rmbStatsCache=null;rmbEditor?.clear();renderRmb();save();
  const box=$("rmbTextStats");(box?.hidden?$("rmbCv"):box)?.focus?.({preventScroll:true});
}

function rmbCountHighlightSet(selection){
  if(rmbCountHighlight?.index===selection?.index && rmbCountHighlight?.kind===selection?.kind)return;
  rmbCountHighlight=selection;
  document.querySelectorAll?.("#rmbTextStats .rmb-count-value").forEach(node=>node.classList.toggle("rmb-count-selected",!!selection&&node._rmbSelection?.index===selection.index&&node._rmbSelection?.kind===selection.kind));
  renderRmb();
}
function rmbCountCell(node,entry,kind){
  node.className=(node.className||"")+" rmb-count-value";node.tabIndex=0;node._rmbSelection={index:entry.index||0,kind};
  node.onpointerdown=e=>{node._rmbTouch=e.pointerType==="touch";};
  node.onpointerenter=e=>{if(e?.pointerType!=="touch")rmbCountHighlightSet(node._rmbSelection);};
  node.onpointerleave=e=>{if(e?.pointerType!=="touch")rmbCountHighlightSet(null);};
  node.onfocus=()=>{if(!node._rmbTouch)rmbCountHighlightSet(node._rmbSelection);};
  node.onblur=()=>{if(!node._rmbTouch)rmbCountHighlightSet(null);node._rmbTouch=false;};
  node.onclick=e=>{if(e.pointerType!=="touch"&&!node._rmbTouch)return;const same=rmbCountHighlight?.index===node._rmbSelection.index&&rmbCountHighlight?.kind===kind;rmbCountHighlightSet(same?null:node._rmbSelection);};
}
function rmbTextStats(){
  const box = $("rmbTextStats"); if (!box) return;
  const state=gridsState();if(rmbLetterSelectionState!==state){rmbSelectedLetters.clear();rmbLetterSelectionState=state;}
  const blocks=rmbTextBlocks(),text=rmbActiveText(blocks),identity=JSON.stringify(blocks)+"/"+gridsState().rows.length+"/"+(gridsState().textWidth||"")+"/"+rmbSt().cell;
  if (!text) { box.hidden=true; rmbStatsCache=null;rmbCountHighlight=null;rmbSelectedLetters.clear();return; }
  if (rmbStatsCache?.identity === identity && rmbStatsCache.values === rmbVals) { box.hidden=!!rmbStatsCache.counts&&!rmbStatsCache.counts.total.ones; return; }
  const width=gridsState().textWidth||rmbTextRows(blocks[0].text)[0].length;
  const layout=rmbStatsCache?.identity===identity?rmbStatsCache.layout:rmbDocumentLayout(blocks,width,gridsState().rows.length);
  const counts = rmbLetterCounts(gridsState().rows,layout);
  rmbStatsCache = {text,identity,values:rmbVals,layout,counts};rmbCountHighlight=null;box.hidden=false;box.replaceChildren();
  if(counts&&!counts.total.ones){box.hidden=true;rmbSelectedLetters.clear();return;}
  box.tabIndex=0;
  box.onkeydown=e=>{if(e.isComposing)return;if(e.key==="Delete"){e.preventDefault();e.stopPropagation();if(!e.repeat)rmbLetterDelete();}else if(e.key==="Escape"){e.preventDefault();e.stopPropagation();rmbSelectedLetters.clear();rmbStatsCache=null;renderRmb();}};
  const note = document.createElement("div"); note.className="rmb-count-note";
  note.textContent = counts ? "Буквы «"+text+"» · ◇ = 1 + 0 = ширина × высота · без промежутков" : "Ширина строк изменилась: прежняя разметка букв не соответствует полю.";
  box.append(note); if (!counts) return;
  const table=document.createElement("table"), head=document.createElement("thead"), body=document.createElement("tbody");
  const entries=[...counts.entries,counts.total],shape={tri:"△",rmb:"◇",square:"□",ring:"◎"}[rmbSt().cell]||"◇";
  const numbers=document.createElement("tr"), header=document.createElement("tr"), numberLabel=document.createElement("th");
  numberLabel.textContent="№";numberLabel.scope="row";numbers.append(numberLabel);
  for(const entry of entries){const th=document.createElement("th");th.textContent=String(entry.index||"");th.scope="col";if(entry.index)rmbCountCell(th,entry,"rhombi");numbers.append(th);}
  const name=document.createElement("th");name.textContent="Буква";name.scope="row";header.append(name);
  for(const entry of entries){const th=document.createElement("th");th.textContent=entry.label===" "?"␣":entry.label;th.scope="col";
    if(entry.index){
      const picked=rmbSelectedLetters.has(entry.letterKey);th.className="rmb-count-letter"+(picked?" rmb-letter-picked":"");th.tabIndex=0;th.setAttribute("role","button");th.setAttribute("aria-pressed",String(picked));
      th.title="Буква «"+entry.label+"»: щелчок — выбрать или снять; Delete — удалить выбранные буквы с поля";
      th.onclick=()=>rmbLetterPick(entry);th.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();e.stopPropagation();rmbLetterPick(entry);}};
    }header.append(th);}
  head.append(numbers,header);
  for (const [label,key] of [["1","ones"],["0","zeros"],["Всего "+shape,"rhombi"]]) { const row=document.createElement("tr"), th=document.createElement("th");th.textContent=label;th.scope="row";row.append(th);
    for(const entry of entries){const td=document.createElement("td");td.textContent=String(entry[key]);
      td.title=entry.index?entry.width+" × "+entry.height+" = "+entry.rhombi+" ромбов; наведите для подсветки":"Сумма по буквам, без межбуквенных промежутков; наведите для подсветки";
      rmbCountCell(td,entry,key);row.append(td);}body.append(row); }
  table.append(head,body);box.append(table);
  const actions=document.createElement("div");actions.className="tools lpw rmb-letter-actions";
  for(const [label,all,title] of [["×",false,"Удалить выбранные буквы с поля (Delete)"],["× Все",true,"Удалить все буквы с поля; отмена вернёт их"]]){
    const button=document.createElement("button");button.textContent=label;button.title=title;button.setAttribute("aria-label",title);button.disabled=!!state.locked||(!all&&!rmbSelectedLetters.size);button.onclick=()=>rmbLetterDelete(all);actions.append(button);
  }
  box.append(actions);
}
function rmbLetterBorderEdges(entries,hs,u0){
  const result=[];
  for(const entry of entries){
    if(!entry.ones)continue;
    const edges=new Map(),add=(a,b)=>{const ka=a.join(","),kb=b.join(","),key=ka<kb?ka+"/"+kb:kb+"/"+ka;if(edges.has(key))edges.delete(key);else edges.set(key,[a,b]);};
    for(let row=entry.top;row<=entry.bottom&&row<hs.length;row++){
      const x=hs[row]+2*entry.left,top=x+((u0&1)?0:1),bottom=x+((u0&1)?1:0),span=2*entry.width;
      for(let j=0;j<span;j++){add([top+j,row],[top+j+1,row]);add([bottom+j,row+1],[bottom+j+1,row+1]);}
      add([top,row],[bottom,row+1]);add([top+span,row],[bottom+span,row+1]);
    }
    result.push(...edges.values());
  }
  return result;
}
function rmbDrawLetterBorders(g,geometry){
  const {hs,u0,rm,tw,ox,oy}=geometry;
  if((geometry.cell==="square"||geometry.cell==="ring")&&rmbStatsCache?.counts){
    const edges=new Map(),key=p=>p.map(x=>Math.round(x*1e5)).join(',');
    for(const entry of rmbStatsCache.counts.entries){
      const local=new Map();for(let row=entry.top;entry.ones&&row<=entry.bottom;row++)for(let col=entry.left;col<=entry.right;col++){
        const p=rmbHighlightPolygon(row,col,geometry);p.forEach((a,i)=>{const b=p[(i+1)%p.length],x=key(a),y=key(b),k=x<y?x+'/'+y:y+'/'+x;if(local.has(k))local.delete(k);else local.set(k,[a,b]);});
      }
      for(const [k,v] of local)edges.set(k,v);
    }
    const path=new Path2D();for(const [a,b] of edges.values()){path.moveTo(...a);path.lineTo(...b);}g.save();g.strokeStyle="#000";g.lineWidth=2;g.stroke(path);g.restore();return;
  }
  if(!rm||!rmbStatsCache?.counts)return;
  const edges=rmbLetterBorderEdges(rmbStatsCache.counts.entries,hs,u0);if(!edges.length)return;
  const path=new Path2D(),h=tw*Math.sqrt(3)/2;
  for(const [a,b] of edges){path.moveTo(ox+a[0]*tw/2,oy+a[1]*h);path.lineTo(ox+b[0]*tw/2,oy+b[1]*h);}
  g.save();g.globalAlpha=1;g.lineWidth=2;g.strokeStyle="#000000";g.lineJoin="miter";g.stroke(path);g.restore();
}
let rmbEditor = null, rmbAxisTool = null, rmbTouch = null;
function gridsState(){
  if(!Z.grids){Z.grids={rows:["0"],cur:0,align:"center",text:"",textBlocks:[],textWidth:null,colors:{},dots:{},lines:{},groups:{},scenes:[],tool:"",version:1};}
  return Z.grids;
}
function gridsLocked(){if(!gridsState().locked)return false;say("Строки сетки заперты — откройте их замок.");return true;}
function gridsSnap(){return {data:JSON.parse(JSON.stringify(gridsState())),axes:JSON.parse(JSON.stringify(rmbSt().axes||[])),view:JSON.parse(JSON.stringify(rmbSt()))};}
function gridsSnapshot(data){const snap=gridsSnap();if(data)snap.data=JSON.parse(JSON.stringify(data));undoPush({grids:snap});}
function gridsApply(value){rmbWStop();Z.grids=JSON.parse(JSON.stringify(value.data));if(value.view)Z.rmb=JSON.parse(JSON.stringify(value.view));rmbSt().axes=JSON.parse(JSON.stringify(value.axes));rmbEditor?.clear();renderRmb();save();}

const rmbIsMobile=()=>!!window.matchMedia?.("(max-width:760px), (pointer:coarse) and (max-width:1100px)").matches;
function rmbEditorWire(cv){
  if(rmbEditor||!window.ZZRmbEditor)return;
  const common={rows:()=>gridsState().rows,locked:gridsLocked,message:say,
    geometry:()=>{const r=rmbSt();if(!r.s)rmbFit();const {hs,u0}=rmbLayout(gridsState().rows,Math.min(gridsState().rows.length,4096),r.al,r.cell);return {hs,u0,rm:r.cell==="rmb",cell:r.cell,rows:gridsState().rows,tw:r.s,ox:r.ox,oy:r.oy};},
    polygon:rmbHighlightPolygon,redraw:renderRmb,save,
    pan:(x,y)=>{const r=rmbSt();r.ox=x;r.oy=y;renderRmb();},
    commit:(rows,operation)=>{gridsSnapshot();window.ZZGrids.reconcile(gridsState(),rows,operation);renderRmb();save();}
  };
  if(window.ZZRmbTouch)rmbTouch=window.ZZRmbTouch.mount(cv,{
    view:()=>{const r=rmbSt();if(!r.s)rmbFit();return {s:r.s,ox:r.ox,oy:r.oy};},
    setView:v=>{Object.assign(rmbSt(),v);renderRmb();},save,
    cancel:()=>{rmbEditor?.cancelGesture();rmbAxisTool?.cancel();cv._rmbCancelPan?.();window.ZZGrids?.cancel();}
  });
  window.ZZGrids?.mount(cv,{state:gridsState,geometry:common.geometry,polygon:rmbHighlightPolygon,hit:window.ZZRmbEditor.hit,
    snapshot:gridsSnapshot,locked:gridsLocked,redraw:renderRmb,save,message:say,view:rmbSt,fit:rmbFit,stop:rmbWStop,
    neighbors:(row,col)=>{const g=common.geometry();return window.ZZGridShapes?.supported(g)?window.ZZGridShapes.neighbors(gridsState().rows,g,row,col):null;},importRows:()=>setkaSourceRows(),editor:()=>rmbEditor,axis:()=>rmbAxisTool,legacy:()=>({scenes:Z.triScenes||[],cells:Z.triCells||{},dots:Z.triDots||{},lines:Z.triLines||{}})});
  if(window.ZZRmbAxis)rmbAxisTool=window.ZZRmbAxis.mount(cv,{...common,
    enabled:()=>!!rmbSt().axisMode,
    color:(source,bit)=>bit==="1"?(source&&gridsState().colors[source.join(",")]||rmbSt().c1||coneCss("--b1","#22d3ee")):(rmbSt().c0||coneCss("--b0","#7d8699")),
    axes:()=>Array.isArray(rmbSt().axes)?rmbSt().axes.filter(a=>window.ZZRmbAxis.basis(a)):[],
    setAxes:axes=>{rmbSt().axes=axes;}
  });
  rmbEditor=window.ZZRmbEditor.mount(cv,{...common,options:()=>({multi:!!rmbSt().touchMulti,copy:!!rmbSt().touchCopy,panUnselected:true}),enabled:()=>!!(rmbSt().edit||rmbSt().axisMode)});
}
function rmbDrawCountHighlight(g,geometry){
  const rows=gridsState().rows,counts=rmbStatsCache?.counts,cells=rmbHighlightCells(rows,counts,rmbCountHighlight),seen=new Set(cells.map(p=>p.join(",")));
  for(const entry of counts?.entries||[])if(rmbSelectedLetters.has(entry.letterKey))for(const cell of rmbHighlightCells(rows,counts,{index:entry.index,kind:"rhombi"})){const key=cell.join(",");if(!seen.has(key)){seen.add(key);cells.push(cell);}}
  if(!cells.length)return;
  const path=new Path2D();
  for(const [row,col] of cells){
    if(row>=geometry.M)continue;
    const points=rmbHighlightPolygon(row,col,geometry);
    if(points.every(p=>p[0]<0)||points.every(p=>p[0]>geometry.Wc)||points.every(p=>p[1]<0)||points.every(p=>p[1]>geometry.Hc))continue;
    path.moveTo(...points[0]);for(const point of points.slice(1))path.lineTo(...point);path.closePath();
  }
  g.save();g.globalAlpha=1;g.fillStyle="rgba(255,230,102,.3)";g.strokeStyle="#fff4a3";g.lineWidth=1.5;g.lineJoin="miter";g.fill(path);g.stroke(path);g.restore();
}
function rmbType(){
  if (gridsLocked()) return;
  const t=prompt("Аа — добавить текст ниже существующего поля (латиница, кириллица, цифры). Старые ромбы останутся; выделяйте и удаляйте их в Правке:",gridsState().text||"Zazerkalius");
  if(t===null||!t.trim())return;
  let blocks=rmbTextBlocks();
  if(!gridsState().textBlocks?.length&&blocks.length){const width=rmbTextRows(blocks[0].text)[0].length;if(gridsState().rows.some(row=>row.length!==width))blocks=[];}
  const added=rmbAppendText(gridsState().rows,blocks,t.trim());if(added.rows.length>4096){say("Текст не добавлен: поле Ромбоидов показывает не более 4096 строк.");return;}
  const oldWidth=Math.max(0,...gridsState().rows.map(row=>row.length));
  gridsSnapshot();gridsState().text=t.trim();gridsState().textBlocks=added.blocks;gridsState().textWidth=added.width;
  if(added.width!==oldWidth&&Array.isArray(rmbSt().axes)){const dx=(oldWidth-added.width)/2;rmbSt().axes=rmbSt().axes.map(a=>({...a,a:[a.a[0]+dx,a.a[1]],b:[a.b[0]+dx,a.b[1]]}));}
  gridsState().rows.splice(0,gridsState().rows.length,...added.rows);gridsState().cur=added.blocks.at(-1).row;
  const r=rmbSt();if(r.cell!=="square"&&r.cell!=="ring")r.cell="rmb";rmbFit();
  renderRmb();save();say(`Добавлено «${gridsState().text}». Старое поле сохранено; Правка: рамка / Shift — выделить, Ctrl+A — всё, Delete — стереть. ↩ отменит добавление.`);
}
function rmbFit(){
  const cv = $("rmbCv"); if (!cv) return; const r = rmbSt(), R = gridsState().rows, M = Math.min(R.length, 4096); if (!M) return;
  const { hs } = rmbLayout(R, M, r.al, r.cell);
  if(r.cell==="square"||r.cell==="ring"){
    const bounds=window.ZZGridShapes.bounds(R,{hs,cell:r.cell}),W=cv.clientWidth||300,H=cv.clientHeight||200,pad=12;
    r.s=Math.max(2,Math.min(80,(W-2*pad)/Math.max(1,bounds.maxX-bounds.minX),(H-2*pad)/Math.max(1,bounds.maxY-bounds.minY)));
    r.ox=W/2-(bounds.minX+bounds.maxX)*r.s/2;r.oy=H/2-(bounds.minY+bounds.maxY)*r.s/2;return;
  }
  const rm = r.cell === "rmb"; let a = Infinity, b = -Infinity;
  for (let i = 0; i < M; i++) { const n = (R[i] || "").length; if (!n) continue; a = Math.min(a, hs[i]); b = Math.max(b, hs[i] + (rm ? 2 * n + 1 : n + 1)); }
  if (!isFinite(a)) return;
  const W = cv.clientWidth || 300, H = cv.clientHeight || 200, pd = 10, pl = r.num ? 34 : pd;   // v0.794: с «№» слева место под номера строк
  const tw = Math.max(2, Math.min(80, (W - pl - pd) / Math.max(1, (b - a) / 2), (H - 2 * pd) / (M * 0.8660254)));
  r.s = tw; r.ox = pl + (W - pl - pd - (b - a) * tw / 2) / 2 - a * tw / 2; r.oy = pd;
}
function rmbUi(){
  const r = rmbSt(), q = (s) => document.querySelectorAll("#w-rmb " + s);
  {rmbEditor?.sync();const edit=!!r.edit,axis=!!r.axisMode,hint=$("rmbEditHint");
    for(const [id,on] of [["bRmbEdit",edit],["bRmbAxis",axis]]){const b=$(id);if(b){b.classList.toggle("on",on);b.setAttribute("aria-pressed",String(on));}}
    if(hint){hint.hidden=!edit&&!axis;hint.textContent=rmbIsMobile()?(axis?"Ось — предпросмотр · Применить зеркала — записать биты · два пальца — вид":"Касание — выбрать / создать · тянуть поле — сдвиг · выбранное — перенос · два пальца — масштаб"):axis?"Shift + протяжка — ось и её правка · обычная протяжка — всё поле · направление — предпросмотр · Применить зеркала — записать биты · пробел — вид":"Тянуть — всё поле · Shift — инструмент / выделение · Ctrl — копия · щелчок 0 → 1 · Delete — стереть";}
    $("rmbCv")?.classList.toggle("rmb-editing",edit||axis);const tools=$("rmbAxisTools");if(tools)tools.hidden=!axis;
    const selected=rmbAxisTool?.selected(),basis=selected&&window.ZZRmbAxis?.basis(selected);
    for(const [id,from,to] of [["bRmbAxisPos",basis?.positive||"Право",basis?.negative||"Лево"],["bRmbAxisNeg",basis?.negative||"Лево",basis?.positive||"Право"]]){const b=$(id);if(b){b.textContent=({Право:"Прво",Лево:"Лво",Верх:"Верхъ",Низ:"Низъ"}[from]||from)+"→"+({Право:"Прво",Лево:"Лво",Верх:"Верхъ",Низ:"Низъ"}[to]||to);b.disabled=!selected;b.classList.toggle("on",!!selected&&selected.preview!==false&&(selected.side||"positive")===(id==="bRmbAxisPos"?"positive":"negative"));b.title="Предпросмотр "+from.toLowerCase()+" → "+to.toLowerCase()+"; биты изменятся только кнопкой «Применить зеркала».";b.setAttribute("aria-label",b.title);}}
    const apply=$("bRmbAxisApply");if(apply)apply.disabled=!rmbAxisTool?.pending();
    const limit=$("bRmbAxisLimit"),del=$("bRmbAxisDel");if(limit){limit.textContent=selected?.segment?"Отрзокъ":"Вся ось";limit.disabled=!selected;}if(del)del.disabled=!selected;
    const actionBox=$("rmbTouchEdit");if(actionBox)actionBox.hidden=!edit;
    for(const [id,on] of [["bRmbMulti",!!r.touchMulti],["bRmbCopy",!!r.touchCopy]]){const button=$(id);if(button){button.classList.toggle("on",on);button.setAttribute("aria-pressed",String(on));}}
    const count=rmbEditor?.selection().length||0;for(const id of ["bRmbErase","bRmbNone"]){const button=$(id);if(button)button.disabled=!count;}
    if($("bRmbUndo"))$("bRmbUndo").disabled=!undoStack.length;if($("bRmbRedo"))$("bRmbRedo").disabled=!redoStack.length;
  }
  q("button[data-ral]").forEach(b => {b.classList.toggle("on",b.dataset.ral===r.al);b.disabled=r.cell==="square"||r.cell==="ring";});
  const L = { each: "▵ кждыйъ", rmb: "◇ рмбы", grp: "⬡ грппы", none: "безъ грницъ" }, G = { "": "👓", chg: "👓 измъ.", age: "👓 взрастъ", pair: "👓 пры" };
  { const b = $("bRmbCube"), c = $("bRmbCPri"); if (b) { b.disabled=r.cell==="square"||r.cell==="ring";b.classList.toggle("on", !!r.cube&&!b.disabled); b.title = "🧊 Кубы: треугольники склеиваются в ромбы с равным соседом — три направления ромба = три грани кубика (светлая «/», средняя «◆», тёмная «\\»); без пары — бледный с красной обводкой" + (r.cube ? `\nСейчас: ромбов ${rmbPairStat.n}, без пары ${rmbPairStat.bad} (из них ${rmbPairStat.ex} неизбежно — ▲ и ▼ не поровну)` : ""); }
    if (c) { c.hidden = !r.cube||r.cell==="square"||r.cell==="ring"; const t = { l: "спрва \\", d: "спрва ◆", r: "спрва /" }[r.cpri]; if (c.textContent !== t) c.textContent = t; } }
  { const b = $("bRmbCell"); if (b) { const t = {tri:"△",rmb:"◇",square:"□",ring:"◎"}[r.cell]; if (b.textContent !== t) b.textContent = t; b.classList.toggle("on", r.cell === "rmb"); } }
  const bl = $("bRmbLn"); if (bl && bl.textContent !== L[r.ln]) bl.textContent = L[r.ln];
  const bg = $("bRmbGl"); if (bg) { if (bg.textContent !== G[r.gl]) bg.textContent = G[r.gl]; bg.classList.toggle("on", !!r.gl); }
  [["bRmbNum", r.num], ["bRmbSh", r.sh], ["bRmbOut", r.out], ["bRmbFol", r.fol]].forEach(([id, v]) => { const b = $(id); if (b) b.classList.toggle("on", !!v); });
  const p = $("bRmbPlay"); if (p) { const on = !!rmbW.on; p.classList.toggle("on", on); const t = on ? "⏸" : "▶"; if (p.textContent !== t) p.textContent = t; }
  { const mw = r.wave === "mir"; const el = $("rmbWOpt"); if (el && el.hidden === mw) el.hidden = !mw;   // v0.795: варианты зеркальной волны — только при ней
    const ws = $("rmbWave"); if (ws && document.activeElement !== ws && ws.value !== r.wave) ws.value = r.wave;
    [["rmbWHz", String(+r.whz || 1)], ["rmbWMask", String(+r.wmask || 0)], ["rmbWSp", String(+r.wsp >= 0 ? +r.wsp : 40)]].forEach(([id, v]) => { const el = $(id); if (el && document.activeElement !== el && el.value !== v) el.value = v; });
    [["bRmbWInv", r.winv], ["bRmbWXor", r.wxor]].forEach(([id, v]) => { const b = $(id); if (b) b.classList.toggle("on", !!v); }); }
  [["rmbBg", r.bg, "--panel2", "#141a24"], ["rmbC1", r.c1, "--b1", "#22d3ee"], ["rmbC0", r.c0, "--b0", "#7d8699"], ["rmbLnC", r.lc, "", "#e6e9ef"]].forEach(([id, v, css, d]) => {
    const el = $(id); if (!el || document.activeElement === el) return; let c = v || (css ? coneCss(css, d) : d); if (!/^#[0-9a-f]{6}$/i.test(c)) c = d; if (el.value !== c) el.value = c; });
}
function rmbWire(){
  const W = $("w-rmb"), cv = $("rmbCv"); if (!W || !cv || cv._wired) return; cv._wired = 1;
  cv.tabIndex=0;cv.addEventListener("pointerdown",()=>cv.focus({preventScroll:true}),true);
  window.setkaPanMount?.(cv,{view:()=>{if(!rmbSt().s)rmbFit();return rmbSt();},
    cancelTools:()=>{window.ZZGrids?.cancel();rmbEditor?.cancelGesture();rmbAxisTool?.cancel();cv._rmbCancelPan?.();},
    pan:(x,y)=>{Object.assign(rmbSt(),{ox:x,oy:y,fol:false});renderRmb();},save});
  rmbEditorWire(cv);
  const re = () => { rmbUi(); save(); renderRmb(); };
  $("bRmbEdit").onclick=()=>{const r=rmbSt();gridsState().tool="";r.edit=!r.edit;r.axisMode=false;rmbAxisTool?.cancel();rmbEditor?.clear();if(r.edit){if(rmbW.on)rmbWStop();rmbFit();cv.focus({preventScroll:true});}re();};
  $("bRmbAxis").onclick=()=>{const r=rmbSt();gridsState().tool="";r.axisMode=!r.axisMode;r.edit=false;rmbEditor?.clear();rmbAxisTool?.cancel();if(r.axisMode){if(rmbW.on)rmbWStop();cv.focus({preventScroll:true});}re();};
  $("bRmbAxisPos").onclick=()=>rmbAxisTool?.preview("positive");$("bRmbAxisNeg").onclick=()=>rmbAxisTool?.preview("negative");
  $("bRmbAxisApply").onclick=()=>rmbAxisTool?.apply();
  $("bRmbAxisLimit").onclick=()=>rmbAxisTool?.toggleSegment();$("bRmbAxisDel").onclick=()=>rmbAxisTool?.remove();
  $("bRmbSettings").onclick=()=>{const open=W.classList.toggle("rmb-settings-open");$("bRmbSettings").setAttribute("aria-expanded",String(open));};
  $("bRmbMulti").onclick=()=>{rmbSt().touchMulti=!rmbSt().touchMulti;re();};$("bRmbCopy").onclick=()=>{rmbSt().touchCopy=!rmbSt().touchCopy;re();};
  $("bRmbErase").onclick=()=>rmbEditor?.erase();$("bRmbAll").onclick=()=>rmbEditor?.selectAll();$("bRmbNone").onclick=()=>{rmbEditor?.clear();renderRmb();};
  $("bRmbUndo").onclick=()=>undo();$("bRmbRedo").onclick=()=>redo();
  W.querySelectorAll("button[data-ral]").forEach(b => b.onclick = () => { rmbSt().al = b.dataset.ral; re(); });
  $("bRmbLn").onclick = () => { const r = rmbSt(), o = ["each", "rmb", "grp", "none"]; r.ln = o[(o.indexOf(r.ln) + 1) % o.length]; re(); };
  $("bRmbGl").onclick = () => { const r = rmbSt(), o = ["", "chg", "age", "pair"]; r.gl = o[(o.indexOf(r.gl) + 1) % o.length]; re(); };
  $("bRmbCell").onclick = () => { const r = rmbSt(); const modes=["tri","rmb","square","ring"];rmbWStop();r.cell=modes[(modes.indexOf(r.cell)+1)%modes.length];rmbEditor?.clear();rmbAxisTool?.cancel();rmbFit();re(); };
  $("bRmbFol").onclick = () => { const r = rmbSt(); r.fol = !r.fol; re(); };
  $("bRmbType").onclick = () => rmbType();   // v0.809: Аа — текст в строки
  $("bRmbCube").onclick = () => { const r = rmbSt(); r.cube = !r.cube; re(); if (r.cube) { const st = rmbPairStat, x = st.bad - st.ex; say(`🧊 Кубы: ромбов ${st.n}, без пары ${st.bad}` + (st.ex ? ` (${st.ex} неизбежно: ▲ и ▼ не поровну)` : "") + (x > 0 ? ` — лишних разрывов ${x}, они красные.` : " — сверх неизбежного всё сложилось в кубики.")); } };
  $("bRmbCPri").onclick = () => { const r = rmbSt(), o = ["l", "d", "r"]; r.cpri = o[(o.indexOf(r.cpri) + 1) % 3]; re(); say(`🧊 Кубы, ${$("bRmbCPri").textContent}: ромбов ${rmbPairStat.n}, без пары ${rmbPairStat.bad} (неизбежно ${rmbPairStat.ex}).`); };
  $("bRmbNum").onclick = () => { const r = rmbSt(); r.num = !r.num; re(); };
  $("bRmbSh").onclick = () => { const r = rmbSt(); r.sh = !r.sh; re(); };
  $("bRmbOut").onclick = () => { const r = rmbSt(); r.out = !r.out; re(); };
  $("bRmbFit").onclick = () => { rmbFit(); re(); };
  $("bRmbDef").onclick = () => { const r = rmbSt(); delete r.bg; delete r.c1; delete r.c0; delete r.lc; re(); };
  [["rmbBg", "bg"], ["rmbC1", "c1"], ["rmbC0", "c0"], ["rmbLnC", "lc"]].forEach(([id, k]) => { const el = $(id); el.oninput = () => { rmbSt()[k] = el.value; renderRmb(); }; el.onchange = () => save(); });
  const mir = () => rmbSt().wave === "mir";
  $("bRmbPlay").onclick = rmbWPlay;
  $("bRmbStep").onclick = () => { if (gridsLocked()) return; if (gridsState().rows.join(",") !== rmbW.last) rmbWReset(); rmbWStep(); renderRmb(); save(); };
  $("bRmbHome").onclick = rmbWHome;
  $("rmbWave").onchange = (e) => { if (rmbW.on) rmbWStop(); rmbSt().wave = e.target.value; re(); };
  $("rmbWHz").onchange = (e) => { rmbSt().whz = +e.target.value; re(); };
  $("rmbWMask").onchange = (e) => { rmbSt().wmask = +e.target.value; re(); };
  $("rmbWSp").oninput = (e) => { rmbSt().wsp = +e.target.value; }; $("rmbWSp").onchange = () => save();
  $("bRmbWInv").onclick = () => { const r = rmbSt(); r.winv = !r.winv; re(); };
  $("bRmbWXor").onclick = () => { const r = rmbSt(); r.wxor = !r.wxor; re(); };
  if (window.ResizeObserver) new ResizeObserver(() => { if (winOpen("w-rmb")) renderRmb(); }).observe(cv);
  // колесо — наезд к мыши, тянешь — сдвиг, щелчок — текущая строка, двойной — вписать
  cv.addEventListener("wheel", (e) => { e.preventDefault(); const r = rmbSt(); if (!r.s) rmbFit();
    const k = Math.pow(1.0015, -e.deltaY), s = Math.max(2, Math.min(160, r.s * k)), f = s / r.s, mx = e.offsetX, my = e.offsetY;
    r.ox = mx - (mx - r.ox) * f; r.oy = my - (my - r.oy) * f; r.s = s; renderRmb(); clearTimeout(cv._sv); cv._sv = setTimeout(save, 400); }, { passive: false });
  let dr = null;cv._rmbCancelPan=()=>{dr=null;cv.style.cursor="";};
  cv.addEventListener("pointerdown", (e) => { if (e.button) return; const r = rmbSt(); if (!r.s) rmbFit(); dr = { x: e.clientX, y: e.clientY, ox: r.ox, oy: r.oy, mv: false }; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener("pointermove", (e) => { if (!dr) return; const dx = e.clientX - dr.x, dy = e.clientY - dr.y; if (Math.abs(dx) + Math.abs(dy) > 3) dr.mv = true;
    if (dr.mv) { const r = rmbSt(); r.ox = dr.ox + dx; r.oy = dr.oy + dy; cv.style.cursor = "grabbing"; renderRmb(); } });
  const up = (e) => { if (!dr) return; const was = dr; dr = null; cv.style.cursor = "";
    if (was.mv) { save(); return; }
    const r = rmbSt(), h = r.s * (r.cell==="square"||r.cell==="ring"?1:0.8660254), i = Math.floor(r.cell==="ring"?Math.hypot(e.offsetX-r.ox,e.offsetY-r.oy)/h:(e.offsetY-r.oy)/h);
    if (i >= 0 && i < gridsState().rows.length && i !== gridsState().cur) { gridsState().cur = i; renderRmb(); save(); } };
  cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", () => { dr = null; cv.style.cursor = ""; });
  cv.addEventListener("dblclick", () => { rmbFit(); save(); renderRmb(); });
  rmbUi();
}
/* v0.796, «да, делай кубы» (по разбору: ромб из двух треугольников бывает трёх направлений — «\» ▼ + ▲ справа, «/» ▲ + ▼ справа, «◆» ▲ над ▼, —
   и это три видимые грани кубика): «🧊 кубы» в «◇ Ромбоидах». Каждый ▲ берёт себе в пару равный по биту свободный ▼ из трёх соседей: слева («\»),
   снизу («◆»), справа («/»); кто первым — выбирает «сперва \ / ◆ / /» (жадно, сверху вниз и слева направо, поэтому от порядка зависит, какие ромбы
   выйдут). Ромб красится как грань: «/» — светлая, «◆» — средняя, «\» — тёмная, тем же цветом бита; треугольник без пары — бледный с красной
   обводкой: там картина в кубики не складывается. У «◇ бит» пары — сами биты. Счёт — rmbPairStat (ромбов, без пары) */
let rmbPair = null, rmbPairOf = null, rmbPairKey = "", rmbPairStat = { n: 0, bad: 0 };
function rmbPairs(M, hs, upK, rm, pri){
  const PR = []; for (let i = 0; i < M; i++) PR.push(new Int8Array((rmbVals[i] || []).length));
  let n = 0, bad = 0;
  const ord = pri === "d" ? "DLR" : pri === "r" ? "RDL" : "LDR";
  for (let i = 0; i < M; i++) { const v = rmbVals[i]; if (!v) continue;
    for (let k = 0; k < v.length; k++) {
      const a = v[k]; if (a === 9 || PR[i][k]) continue;
      if (rm) { if (!(k & 1) && k + 1 < v.length && v[k + 1] !== 9) { PR[i][k] = 2; PR[i][k + 1] = 1; n++; } continue; }
      if (!upK(k)) continue;
      for (const c of ord) {
        if (c === "L") { if (k > 0 && !PR[i][k - 1] && v[k - 1] === a) { PR[i][k] = 1; PR[i][k - 1] = 2; n++; break; } }
        else if (c === "R") { if (k + 1 < v.length && !PR[i][k + 1] && v[k + 1] === a) { PR[i][k] = 2; PR[i][k + 1] = 1; n++; break; } }
        else if (i + 1 < M) { const w = rmbVals[i + 1], kk = hs[i] + k - hs[i + 1];
          if (w && kk >= 0 && kk < w.length && !upK(kk) && !PR[i + 1][kk] && w[kk] === a) { PR[i][k] = 4; PR[i + 1][kk] = 3; n++; break; } }
      }
    }
  }
  let nu = 0, nd = 0;
  for (let i = 0; i < M; i++) { const v = rmbVals[i]; if (v) for (let k = 0; k < v.length; k++) if (v[k] !== 9) { if (upK(k)) nu++; else nd++; if (!PR[i][k]) bad++; } }
  rmbPairStat = { n, bad, ex: Math.abs(nu - nd) };   // ex — без пары неизбежно: ▲ и ▼ поровну не бывает (в треугольнике из n строк ▲ на n больше)
  return PR;
}
const rmbFace = (up, c) => !c ? 3 : up ? (c === 1 ? 2 : c === 2 ? 0 : 1) : (c === 2 ? 2 : c === 1 ? 0 : 1);   // 0 «/», 1 «◆», 2 «\», 3 без пары
function rmbRenderShapes(g,geo,r,c0,c1){
  const {rows,tw,ox,oy,Wc,Hc,M,cell,hs}=geo,shapes=window.ZZGridShapes;
  const append=(path,p)=>{path.moveTo(...p[0]);for(let i=1;i<p.length;i++)path.lineTo(...p[i]);path.closePath();};
  // Background uses the same origin and spacing as editable cells.
  if(r.out){const grid=new Path2D();
    if(cell==="square"){
      const x0=ox+(hs[0]||0)*tw/2;
      for(let i=Math.floor(-x0/tw);i<=Math.ceil((Wc-x0)/tw);i++){grid.moveTo(x0+i*tw,0);grid.lineTo(x0+i*tw,Hc);}
      for(let i=Math.floor(-oy/tw);i<=Math.ceil((Hc-oy)/tw);i++){grid.moveTo(0,oy+i*tw);grid.lineTo(Wc,oy+i*tw);}
    }else{
      const far=Math.max(Math.hypot(ox,oy),Math.hypot(Wc-ox,oy),Math.hypot(ox,Hc-oy),Math.hypot(Wc-ox,Hc-oy));
      const near=Math.hypot(Math.max(0,-ox,ox-Wc),Math.max(0,-oy,oy-Hc));
      for(let i=Math.max(1,Math.floor(near/tw));i<=Math.ceil(far/tw);i++){grid.moveTo(ox+i*tw,oy);grid.arc(ox,oy,i*tw,0,Math.PI*2);}
    }
    g.strokeStyle="rgba(160,170,190,.16)";g.lineWidth=1;g.stroke(grid);
  }
  const fills=new Map(),edges=new Map(),digits=[],current=new Path2D();
  const near=Math.hypot(Math.max(0,-ox,ox-Wc),Math.max(0,-oy,oy-Hc))/tw,far=Math.max(Math.hypot(ox,oy),Math.hypot(Wc-ox,oy),Math.hypot(ox,Hc-oy),Math.hypot(Wc-ox,Hc-oy))/tw;
  const first=Math.max(0,Math.floor(cell==="ring"?near:-oy/tw)),last=Math.min(M-1,Math.ceil(cell==="ring"?far:(Hc-oy)/tw));
  const edgeKey=(a,b)=>{const x=a.map(v=>Math.round(v*1e5)).join(','),y=b.map(v=>Math.round(v*1e5)).join(',');return x<y?x+'/'+y:y+'/'+x;};
  for(let row=first;row<=last;row++){
    const value=rows[row],start=cell==="square"?Math.max(0,Math.floor(-ox/tw-hs[row]/2)):0,end=cell==="square"?Math.min(value.length,Math.ceil((Wc-ox)/tw-hs[row]/2)):value.length;
    for(let col=start;col<end;col++){
      const p=shapes.polygon(row,col,geo);if(!p.length||p.every(v=>v[0]<0)||p.every(v=>v[0]>Wc)||p.every(v=>v[1]<0)||p.every(v=>v[1]>Hc))continue;
      const one=value[col]==='1';let color=one?c1:c0;
      if(r.gl==="chg"){const age=rmbFrame-(rmbHeat[row]?.[col]??-1e9);if(age<Math.max(1,M))color=one?"#ffd166":"#b8860b";}
      if(r.gl==="age"){const age=rmbClock-(rmbAge[row]?.[col]??-1e9),band=RMB_AGE.find(e=>age<e[0]);if(band)color=band[1];}
      if(r.gl==="pair"&&col>0&&value[col]!==value[col-1])color=one?"#ffd166":"#b8860b";
      const k=(one?'1:':'0:')+color;if(!fills.has(k))fills.set(k,{path:new Path2D(),color,one});append(fills.get(k).path,p);
      if(row===gridsState().cur)append(current,p);
      if(r.ln!=="none")p.forEach((a,i)=>{const b=p[(i+1)%p.length],k=edgeKey(a,b),old=edges.get(k);if(old&&r.ln==="grp"&&old.one===one)edges.delete(k);else if(!old)edges.set(k,{a,b,one});});
      if(r.num&&tw>=20&&(cell!=="ring"||2*Math.PI*(row+.5)*tw/value.length>=9)){const [x,y]=shapes.center(row,col,geo);digits.push([ox+x*tw,oy+y*tw,value[col]]);}
    }
  }
  for(const item of fills.values()){g.save();g.fillStyle=item.color;if(r.sh&&item.one){g.shadowColor="rgba(0,0,0,.6)";g.shadowBlur=tw*.25;g.shadowOffsetX=tw*.1;g.shadowOffsetY=tw*.1;}g.fill(item.path);g.restore();}
  g.save();g.globalAlpha=.10;g.fillStyle=coneCss("--acc","#b98cf0");g.fill(current);g.restore();
  if(edges.size){const path=new Path2D();for(const {a,b} of edges.values()){path.moveTo(...a);path.lineTo(...b);}g.strokeStyle=r.lc||"rgba(5,7,11,.55)";g.lineWidth=Math.max(.6,tw*.035);g.stroke(path);}
  if(digits.length){g.save();g.font=`700 ${Math.round(tw*.4)}px ${coneCss("--ff","monospace")}`;g.textAlign="center";g.textBaseline="middle";g.fillStyle="#05070b";for(const [x,y,value] of digits)g.fillText(value,x,y);g.restore();}
}
function renderRmb(){
  rmbWire();
  if (!winOpen("w-rmb")) { rmbCur = null;rmbCountHighlight=null;return; }   // свёрнуто — не считаем; след начнётся заново, когда окно откроют
  const R = gridsState().rows, r = rmbSt(), M = Math.min(R.length, 4096);
  let fresh = false, rowsChanged = false;
  const AN = r.wave === "mir" && rmbW.used ? { on: !!rmbW.on, row: rmbW.h, pass: rmbW.pass } : null;   // v0.795: часы возраста и ⇣ — от той волны, что идёт
  if (!rmbCur || rmbCur.length !== R.length || rmbCur.some((s, i) => s !== R[i])) { rowsChanged = true; fresh = !!rmbCur; rmbCur = R.slice(); rmbFrame++;
    const t = AN ? AN.pass + AN.row / Math.max(1, M) : null;   // часы в проходах волны: идут вперёд всегда (⤺ и правки руками — на шаг)
    rmbClock += t !== null && rmbLastA !== null && t > rmbLastA ? t - rmbLastA : 1 / Math.max(1, M); rmbLastA = t; }
  const rm = r.cell === "rmb", { hs, ok, u0, base } = rmbLayout(R, M, r.al, r.cell), key = r.al + r.cell + base;
  /* значения клеток: 1 / 0, 9 — ▼ без ▲ над ним; ▼ — инверсия ▲ над ним по месту в сетке (ряд не на сетке ряда выше — по номеру, как в «▲▼») */
  if (rowsChanged || rmbKey !== key || rmbVals.length !== M) {
    const NV = [];
    for (let i = 0; i < M; i++) {
      const s = R[i] || "", n = s.length, v = new Uint8Array(Math.max(0, rm ? 2 * n : n)), ps = i ? R[i - 1] || "" : "";
      for (let k = 0; k < v.length; k++) {
        v[k] = s[rm ? k >> 1 : k] === "1" ? 1 : 0;
      }
      if (fresh && rmbKey === key) { const o = rmbVals[i]; let H = rmbHeat[i], A = rmbAge[i];
        if (!H || H.length !== v.length) H = rmbHeat[i] = new Float64Array(v.length).fill(-1e9);
        if (!A || A.length !== v.length) A = rmbAge[i] = new Float64Array(v.length).fill(-1e9);
        for (let k = 0; k < v.length; k++) if (!o || o.length !== v.length || o[k] !== v[k]) { H[k] = rmbFrame; A[k] = rmbClock; } }
      NV.push(v);
    }
    if (rmbKey !== key) { rmbHeat = []; rmbAge = []; }
    rmbVals = NV; rmbKey = key; if (rmbHeat.length > M) rmbHeat.length = M; if (rmbAge.length > M) rmbAge.length = M;
  }
  const upK = (k) => ((k + u0) & 1) === 0, cube = !!r.cube&&r.cell!=="square"&&r.cell!=="ring";
  if (cube && (rmbPairOf !== rmbVals || rmbPairKey !== key + r.cpri)) { rmbPair = rmbPairs(M, hs, upK, rm, r.cpri); rmbPairOf = rmbVals; rmbPairKey = key + r.cpri; }
  rmbUi(); rmbTextStats(); window.ZZGrids?.sync();
  const cv = $("rmbCv"); if (!cv) return;
  const dpr = window.devicePixelRatio || 1, Wc = cv.clientWidth, Hc = cv.clientHeight; if (Wc < 10 || Hc < 10) return;
  if (cv.width !== Math.round(Wc * dpr) || cv.height !== Math.round(Hc * dpr)) { cv.width = Math.round(Wc * dpr); cv.height = Math.round(Hc * dpr); }
  const mobileSize=rmbIsMobile()?Wc+"x"+Hc:null;if(mobileSize&&cv._rmbMobileSize!==mobileSize)rmbFit();cv._rmbMobileSize=mobileSize;
  if (!r.s) rmbFit();
  if (r.fol && AN && AN.on && r.cell!=="ring") r.oy = Hc * 0.4 - Math.min(AN.row, M - 1) * r.s * (r.cell==="square"?1:0.8660254);   // ⇣ за волной: строка волны — на 2/5 высоты окна
  const g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const tw = r.s, hw = tw / 2, h = tw * 0.8660254, X = (p) => r.ox + p * hw, Y = (i) => r.oy + i * h;
  const c1 = r.c1 || coneCss("--b1", "#22d3ee"), c0 = r.c0 || coneCss("--b0", "#7d8699");
  const background = r.bg || coneCss("--panel2", "#141a24");
  if(document.documentElement.style.getPropertyValue("--bg")!==background)document.documentElement.style.setProperty("--bg",background);
  g.fillStyle = background; g.fillRect(0, 0, Wc, Hc);
  if(r.cell==="square"||r.cell==="ring"){
    const geometry={hs,u0,rm:false,cell:r.cell,rows:R,tw,ox:r.ox,oy:r.oy,M,Wc,Hc};
    rmbRenderShapes(g,geometry,r,c0,c1);
    window.ZZGrids?.paint(g,geometry);rmbAxisTool?.paintPreview(g,geometry);rmbDrawLetterBorders(g,geometry);rmbDrawCountHighlight(g,geometry);rmbEditor?.paint(g,geometry);rmbAxisTool?.paint(g,geometry);return;
  }
  // Grid follows the very same hs/u0 coordinates as the cells in every inclination.
  if(r.out&&M&&window.ZZRmbGrid){const grid=new Path2D();
    const segments=window.ZZRmbGrid.segments({hs,u0,alignment:r.al,tw,ox:r.ox,oy:r.oy,width:Wc,height:Hc});
    for(const [x0,y0,x1,y1] of segments){grid.moveTo(x0,y0);grid.lineTo(x1,y1);}
    g.strokeStyle="rgba(160,170,190,.16)";g.lineWidth=1;g.stroke(grid);
  }
  const i0 = Math.max(0, Math.floor(-r.oy / h) - 1), i1 = Math.min(M - 1, Math.ceil((Hc - r.oy) / h) + 1);
  if (gridsState().cur >= i0 && gridsState().cur <= i1) { g.fillStyle = coneCss("--acc", "#b98cf0"); g.globalAlpha = 0.12; g.fillRect(0, Y(gridsState().cur), Wc, h); g.globalAlpha = 1; }
  const P = { u1: new Path2D(), u0: new Path2D(), d1: new Path2D(), d0: new Path2D(), e: new Path2D() }, HT = [0, 1, 2, 3].map(() => [new Path2D(), new Path2D()]);
  const L = new Path2D(), TL = Math.max(1, M), gm = r.gl, lm = r.ln, digs = r.num && tw >= (rm ? 18 : 22) ? [] : null;   // v0.794: цифры — только крупно
  const AG = gm === "age" ? RMB_AGE.map(() => [new Path2D(), new Path2D()]) : null;
  const CB = cube ? [0, 1, 2, 3].map(() => [new Path2D(), new Path2D()]) : null, UL = cube ? new Path2D() : null;
  const val = (i, p) => { if (i < 0 || i >= M) return -1; const v = rmbVals[i], k = p - hs[i]; return v && k >= 0 && k < v.length ? (v[k] === 9 ? -1 : v[k]) : -1; };
  const isDn = (i, p) => i >= 0 && i < M && !upK(p - hs[i]);
  const rid = (i, p) => { const k = p - hs[i]; return i * 1e7 + (rm ? k >> 1 : upK(k) ? p : p + 1); };   // ромб: «◇ бит» — бит, «▲ бит» — ▼ с ▲ справа
  const ln = (x1, y1, x2, y2) => { L.moveTo(x1, y1); L.lineTo(x2, y2); };
  const edge = (a, b, idA, idB) => lm === "each" ? true : lm === "grp" ? b < 0 || a !== b : lm === "rmb" ? b < 0 || idA !== idB : false;
  for (let i = i0; i <= i1; i++) {
    const v = rmbVals[i]; if (!v || !v.length) continue;
    const kA = Math.max(0, Math.floor(-r.ox / hw - hs[i]) - 2), kB = Math.min(v.length - 1, Math.ceil((Wc - r.ox) / hw - hs[i]) + 1), yt = Y(i), yb = yt + h;
    const H = rmbHeat[i], AA = rmbAge[i], PC = cube && rmbPair ? rmbPair[i] : null;
    for (let k = kA; k <= kB; k++) {
      const p = hs[i] + k, up = upK(k), x = X(p), a = v[k];
      if (a === 9) { P.e.moveTo(x, yt); P.e.lineTo(x + tw, yt); P.e.lineTo(x + hw, yb); P.e.closePath(); continue; }
      let ab = -1; if (AG && AA && AA[k] > -1e8) { const ag = rmbClock - AA[k]; ab = RMB_AGE.findIndex(e => ag < e[0]); }
      const pc = PC ? PC[k] : 0, fc = PC ? rmbFace(up, pc) : -1;
      const q = ab >= 0 ? AG[ab][a ? 0 : 1] : fc >= 0 ? CB[fc][a ? 0 : 1] : up ? (a ? P.u1 : P.u0) : (a ? P.d1 : P.d0);
      if (fc === 3) { if (up) { UL.moveTo(x, yb); UL.lineTo(x + tw, yb); UL.lineTo(x + hw, yt); } else { UL.moveTo(x, yt); UL.lineTo(x + tw, yt); UL.lineTo(x + hw, yb); } UL.closePath(); }
      if (up) { q.moveTo(x, yb); q.lineTo(x + tw, yb); q.lineTo(x + hw, yt); } else { q.moveTo(x, yt); q.lineTo(x + tw, yt); q.lineTo(x + hw, yb); }
      q.closePath();
      let b = -1;
      if (gm === "chg" && H) { const age = rmbFrame - H[k]; if (age < TL) b = Math.min(3, Math.floor(age / TL * 4)); }
      else if (gm === "pair" && up && k > 0 && v[k - 1] !== 9 && v[k - 1] !== a) b = 0;
      if (b >= 0) { const t = HT[b][a ? 0 : 1]; if (up) { t.moveTo(x, yb); t.lineTo(x + tw, yb); t.lineTo(x + hw, yt); } else { t.moveTo(x, yt); t.lineTo(x + tw, yt); t.lineTo(x + hw, yb); } t.closePath(); }
      if (lm !== "none") {
        if (up) {   // ▲ — левое, правое, нижнее ребро; у ▼ — только края, где ▲ рядом нет
          const id = rid(i, p), l = val(i, p - 1), rr = val(i, p + 1), dn = isDn(i + 1, p) ? val(i + 1, p) : -1;
          if (PC) { if (pc !== 1) ln(x, yb, x + hw, yt); if (pc !== 2) ln(x + hw, yt, x + tw, yb); if (pc !== 4) ln(x, yb, x + tw, yb); }   // 🧊: граница — всюду, кроме стыка с парой
          else {
          if (edge(a, l, id, l < 0 ? -1 : rid(i, p - 1))) ln(x, yb, x + hw, yt);
          if (edge(a, rr, id, rr < 0 ? -1 : rid(i, p + 1))) ln(x + hw, yt, x + tw, yb);
          if (edge(a, dn, 0, 1)) ln(x, yb, x + tw, yb); }
        } else { const upn = i > 0 && !isDn(i - 1, p) ? val(i - 1, p) : -1; if (upn < 0) ln(x, yt, x + tw, yt);
          if (val(i, p - 1) < 0) ln(x, yt, x + hw, yb); if (val(i, p + 1) < 0) ln(x + hw, yb, x + tw, yt); }   // v0.794: у «◇ бит» ряд может начаться и кончиться ▼
      }
      if (digs) { if (!rm) digs.push(x + hw, up ? yb - h * 0.3 : yt + h * 0.32, a, b >= 0); else if (!(k & 1)) digs.push(x + tw * 0.75, yt + h / 2, a, b >= 0); }
    }
    if (r.num && h >= 8) { g.fillStyle = c0; g.font = `${Math.min(12, Math.max(7, h * 0.6))}px ${coneCss("--ff", "monospace")}`; g.textAlign = "right"; g.textBaseline = "middle"; g.fillText(String(i + 1), X(hs[i]) - 3, yt + h / 2); g.textAlign = "left"; }
  }
  const fill = (p, col, al) => { g.globalAlpha = al; g.fillStyle = col; g.fill(p); };
  const dA = rm ? 0.8 : 0.62;   // ▼ бледнее ▲ (у «◇ бит» — чуть: половинки одного бита)
  fill(P.u0, c0, 1); fill(P.d0, c0, dA);
  if (CB) {   // 🧊 грани: тот же цвет бита, светлее / темнее по направлению ромба
    const rgb = (c) => { g.fillStyle = "#000"; g.fillStyle = c; const t = String(g.fillStyle); if (t[0] === "#") return [1, 3, 5].map(j => parseInt(t.slice(j, j + 2), 16)); const m = t.match(/[\d.]+/g) || [0, 0, 0]; return m.slice(0, 3).map(Number); };
    const sh = (c, f) => { const [R0, G0, B0] = rgb(c); return `rgb(${Math.round(R0 * f)},${Math.round(G0 * f)},${Math.round(B0 * f)})`; };
    [1, 0.7, 0.45].forEach((f, j) => { fill(CB[j][0], sh(c1, f), 1); fill(CB[j][1], sh(c0, f), 1); });
    fill(CB[3][0], c1, 0.3); fill(CB[3][1], c0, 0.3); }
  if (AG) AG.forEach((q, b) => fill(q[1], RMB_AGE[b][1], 0.38));   // возраст: нули — цветом возраста, бледно
  if (r.sh) { g.save(); g.shadowColor = "rgba(0,0,0,.6)"; g.shadowBlur = Math.max(2, tw * 0.35); g.shadowOffsetX = tw * 0.1; g.shadowOffsetY = tw * 0.14; }
  fill(P.u1, c1, 1); fill(P.d1, c1, dA);
  if (AG) AG.forEach((q, b) => fill(q[0], RMB_AGE[b][1], 1));
  if (r.sh) g.restore();
  [1, 0.8, 0.6, 0.42].forEach((al, b) => { fill(HT[b][0], "#ffd166", al); fill(HT[b][1], "#b8860b", al); });
  g.globalAlpha = 1;
  g.strokeStyle = "rgba(160,170,190,.25)"; g.lineWidth = 0.6; g.stroke(P.e);
  if (lm !== "none") { g.lineJoin = "round"; g.lineCap = "round";
    g.strokeStyle = r.lc || (cube ? "rgba(5,7,11,.6)" : lm === "each" ? "rgba(5,7,11,.45)" : "#e6e9ef"); g.lineWidth = cube || lm === "each" ? Math.max(0.5, tw * 0.035) : Math.max(1, tw * 0.07); g.stroke(L); }
  if (UL) { g.strokeStyle = "#ff4d4d"; g.lineWidth = Math.max(0.8, tw * 0.05); g.stroke(UL); }
  if (digs) { g.font = `700 ${Math.round(tw * 0.42)}px ${coneCss("--ff", "monospace")}`; g.textAlign = "center"; g.textBaseline = "middle";
    for (let q = 0; q < digs.length; q += 4) { g.fillStyle = digs[q + 3] && !digs[q + 2] ? "#fff7d6" : "#05070b"; g.fillText(String(digs[q + 2]), digs[q], digs[q + 1]); } g.textAlign = "left"; }
  const editGeometry={hs,u0,rm,tw,ox:r.ox,oy:r.oy,M,Wc,Hc};
  window.ZZGrids?.paint(g,editGeometry);rmbAxisTool?.paintPreview(g,editGeometry);rmbDrawLetterBorders(g,editGeometry);rmbDrawCountHighlight(g,editGeometry);rmbEditor?.paint(g,editGeometry);rmbAxisTool?.paint(g,editGeometry);
}
