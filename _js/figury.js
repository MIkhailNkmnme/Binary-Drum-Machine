/* Zerkalius — ОБЩИЙ ФОРМАТ ФИГУР (▲ ▼ ◇ ⧗ ◆) для сравнения между страницами. Формат v1, 2026-09-25.
   Запрос пользователя: «нужно потом сравнить и найти одинаковые с найденными в Аниматрице, форматы надо
   подготовить». Фигуры пишут Layers (◇ Ромбы: сетка / все внахлёст — вывод «таблица .tsv») и Треугольник
   (◇ Сводка — «📐 .tsv»: текущий кадр или все формы прогнанного цикла). Обе пишут через этот модуль, поэтому
   строки у них одного вида и сравниваются простым совпадением столбцов.

   ФАЙЛ — текст UTF-8, строки с «#» — пояснения, первая из них — «# ZERKALIUS-ФИГУРЫ v1». Дальше одна фигура на
   строку, столбцы через табуляцию:
     вид      ▲ (вершина сверху) · ▼ (вершина снизу) · ◇ ромб · ⧗ часы · ◆ пирамида
     шаг      1 — решётка Паскаля: строка фигуры на бит шире предыдущей, биты следующей строки стоят через
                  полсимвола («½»-выравнивания Layers);
              2 — полная сетка: строка на ДВА символа шире, столбцы стоят друг под другом (Треугольник,
                  обычные выравнивания Layers)
     строк    высота фигуры
     клеток   сколько клеток в фигуре
     рисунок  строки фигуры сверху вниз через «/», в строке — клетки слева направо: 0, 1 или «.» — пусто
              (пробел Треугольника)
     ключ     рисунок без учёта зеркала: меньший (по строке) из рисунка и его отражения слева направо —
              по нему фигура и её зеркальный близнец считаются одной
     чёт      у шага 2 — подрешётка, где лежит вершина фигуры (клетки с той же чётностью «строка + столбец»,
              что у вершины), записанная как фигура шага 1; у шага 1 — «-»
     нечёт    у шага 2 — вторая подрешётка, тоже шагом 1 (у ▲ она на строку ниже и на бит уже); у шага 1 — «-»
     сколько  сколько раз фигура с этим рисунком встретилась
     где      где впервые (текстом, для человека)
   ЗАЧЕМ ПОДРЕШЁТКИ. Треугольник рисует правило 90 на полной сетке: треугольник Паскаля лежит в клетках одной
   чётности, клетки между ними — «0» или пусто, а волна Аниматрицы перемешивает обе. Layers на «½» хранит
   только клетки Паскаля. Поэтому фигура Layers шага 1 сравнивается со столбцами «чёт»/«нечёт» Треугольника,
   а фигура шага 2 — с его рисунком напрямую. Размеры при этом сходятся так: ◇ и ▲ Треугольника высотой S
   (S + 1 строк у ромба, S/2 + 1 у ▲▼) — это в Layers ◇ и ▲ размера S/2 + 1 (для S = 32 — 17).
   Вершина фигуры: у ▲ ◇ — верхняя клетка, у ▼ — нижняя, у ⧗ ◆ — середина. */
(function(){
  if (window.ZFIG) return;
  const Z = window.ZFIG = {
    FORMAT: "ZERKALIUS-ФИГУРЫ v1",
    COLS: ["вид", "шаг", "строк", "клеток", "рисунок", "ключ", "чёт", "нечёт", "сколько", "где"],
    mirror: function(pat){ return pat.split("/").map(r => r.split("").reverse().join("")).join("/"); },
    key: function(pat){ const m = Z.mirror(pat); return m < pat ? m : pat; },
    cellCount: function(pat){ return pat.length - (pat.split("/").length - 1); },
    vertexRow: function(kind, T){ return kind === "▼" ? T - 1 : (kind === "⧗" || kind === "◆") ? (T - 1) >> 1 : 0; },
    /* Подрешётки фигуры шага 2. Строка t — клетки по оси симметрии: x = i − (ширина − 1)/2. Клетка идёт в «чёт»,
       если (t + x) той же чётности, что у вершины (vertexRow, x = 0). Пустые строки подрешётки выпадают. */
    sub: function(kind, pat){
      const rows = pat.split("/"), vr = Z.vertexRow(kind, rows.length) & 1, ev = [], od = [];
      rows.forEach((r, t) => {
        const hw = (r.length - 1) / 2; let e = "", o = "";
        for (let i = 0; i < r.length; i++) { const x = i - hw; if ((((t + x) % 2) + 2) % 2 === vr) e += r[i]; else o += r[i]; }
        if (e) ev.push(e); if (o) od.push(o);
      });
      return { even: ev.join("/") || "-", odd: od.join("/") || "-" };
    },
    /* Одна строка таблицы. o = { kind, step, pat, count, where } */
    line: function(o){
      const rows = o.pat.split("/").length, sb = o.step === 2 ? Z.sub(o.kind, o.pat) : { even: "-", odd: "-" };
      const where = String(o.where || "").replace(/[\t\r\n]+/g, " ");
      return [o.kind, o.step, rows, Z.cellCount(o.pat), o.pat, Z.key(o.pat), sb.even, sb.odd, o.count || 1, where].join("\t");
    },
    header: function(source, notes){
      const L = ["# " + Z.FORMAT, "# откуда: " + source, "# записано: " + new Date().toLocaleString("ru-RU")];
      (notes || []).forEach(n => L.push("# " + n));
      L.push("# " + Z.COLS.join("\t"));
      return L;
    },
    /* КАРТИНА (2026-09-25, запрос «показать целый и его части, только если статика»). Необязательный блок в
       шапке: «# картина: шаг d, строк N, первая F» и по строке «#| a биты» на каждую строку источника, где
       a — где строка начинается, в полустолбцах (соседние биты строки — через 2), биты — как есть, пробел
       записан точкой. Пишется только для статики — один кадр, одна цепочка; у цикла Аниматрицы картины нет.
       Старое чтение строки с «#» пропускает, так что формат остаётся v1. */
    picture: function(step, rows, first){
      const L = ["# картина: шаг " + step + ", строк " + rows.length + (first !== undefined && first !== null ? ", первая " + first : "")];
      rows.forEach(r => L.push("#| " + (r.a | 0) + " " + String(r.s || "").replace(/ /g, ".")));
      return L;
    },
    /* Чтение таблицы. Возвращает { source, rows: [{ kind, step, rowsN, cells, pat, key, even, odd, count, where }],
       pic: { step, first, rows: [{ a, s }] } или null }. */
    parse: function(text){
      const out = { source: "", rows: [], pic: null };
      String(text || "").split(/\r?\n/).forEach(l => {
        if (!l) return;
        if (l[0] === "#") {
          const m = l.match(/^# откуда: (.*)$/); if (m) { out.source = m[1]; return; }
          const p = l.match(/^# картина: шаг (\d+)(?:.*первая (-?\d+))?/);
          if (p) { out.pic = { step: +p[1], first: p[2] !== undefined ? +p[2] : 0, rows: [] }; return; }
          if (l.startsWith("#| ") && out.pic) { const sp = l.indexOf(" ", 3); out.pic.rows.push({ a: +l.slice(3, sp), s: l.slice(sp + 1) }); }
          return;
        }
        const c = l.split("\t"); if (c.length < 9) return;
        out.rows.push({ kind: c[0], step: +c[1], rowsN: +c[2], cells: +c[3], pat: c[4], key: c[5], even: c[6], odd: c[7], count: +c[8], where: c[9] || "" });
      });
      return out;
    },
    save: function(name, lines){
      const text = lines.join("\n") + "\n";
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([text], { type: "text/tab-separated-values;charset=utf-8" }));
      a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      if (Z.viewOn) Z.showInViewer(name, text);
    },
    /* ОТКРЫТЬ «СРАВНЕНИЕ» ПОТОМ, КОГДА ТАБЛИЦА ГОТОВА (уточнение пользователя: «пусть страницу потом откроет» — окно,
       открытое сразу по щелчку, стояло пустым всё время прогона). Уже открытое окно получает таблицу сразу. Иначе —
       пробуем открыть; браузер пускает окно только сразу после щелчка, и после долгого прогона обычно его блокирует —
       тогда в углу страницы плашка «Готово — 👁 Открыть в «Сравнении»»: щелчок по ней — уже настоящий щелчок. */
    showInViewer: function(name, text){
      if (Z.viewer && !Z.viewer.closed) { Z.sendToViewer(name, text); return; }
      if (Z.openViewer()) { Z.sendToViewer(name, text); return; }
      let el = document.getElementById("zfigViewToast");
      if (!el) {
        el = document.createElement("div"); el.id = "zfigViewToast";
        el.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:99999;display:flex;gap:8px;align-items:center;" +
          "background:#1a1d26;color:#d8dce6;border:1px solid #ffcc00;border-radius:6px;padding:8px 10px;" +
          "font:13px 'Segoe UI',system-ui,sans-serif;box-shadow:0 4px 18px rgba(0,0,0,.55)";
        document.body.appendChild(el);
      }
      el.innerHTML = "";
      const lab = document.createElement("span"); lab.textContent = "Готово: " + name;
      const go = document.createElement("button"); go.textContent = "👁 Открыть в «Сравнении»";
      go.style.cssText = "background:#2a2412;color:#ffcc00;border:1px solid #ffcc00;border-radius:4px;padding:3px 10px;cursor:pointer;font:inherit";
      const x = document.createElement("button"); x.textContent = "✕"; x.title = "Закрыть — файл и так скачан";
      x.style.cssText = "background:none;color:#7d8598;border:none;cursor:pointer;font:inherit";
      go.onclick = () => { if (Z.openViewer()) Z.sendToViewer(name, text); el.remove(); };
      x.onclick = () => el.remove();
      el.append(lab, go, x);
    },
    /* СРАЗУ В «СРАВНЕНИЕ» (запрос: «ещё надо открывать сразу в окне для просмотра»). Страница-зритель — окно с
       именем zerkSravnenie: уже открытое переиспользуется. Открывает его showInViewer, когда таблица готова (см. ниже).
       Таблица
       уходит туда postMessage-ем, когда готова: шлём раз в 0,3 с, пока страница не ответит «zfig-ack» с тем же id
       (она могла ещё грузиться) — до 30 с. Сравнение кладёт её в набор А, а если там уже что-то есть — в Б.
       viewOn выставляет страница-источник по своей галке «👁». */
    VIEW_URL: (function(){ try { const c = document.currentScript && document.currentScript.src; return c ? new URL("../sravnenie/Zerkalius-sravnenie.html", c).href : "sravnenie/Zerkalius-sravnenie.html"; } catch (e) { return "sravnenie/Zerkalius-sravnenie.html"; } })(),
    viewOn: false, viewer: null,
    openViewer: function(){
      try { Z.viewer = window.open(Z.VIEW_URL, "zerkSravnenie"); } catch (e) { Z.viewer = null; }
      return Z.viewer;
    },
    sendToViewer: function(name, text){
      const w = Z.viewer; if (!w || w.closed) return false;
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
      let tries = 0, t = 0;
      const onAck = e => { if (e.data && e.data.type === "zfig-ack" && e.data.id === id) { clearInterval(t); window.removeEventListener("message", onAck); } };
      window.addEventListener("message", onAck);
      const send = () => {
        if (++tries > 100 || w.closed) { clearInterval(t); window.removeEventListener("message", onAck); return; }
        try { w.postMessage({ type: "zfig-file", id: id, name: name, text: text }, "*"); } catch (e) {}
      };
      t = setInterval(send, 300); send();
      try { w.focus(); } catch (e) {}
      return true;
    }
  };
})();
