/* Hub v0.262: «все кнопки переделай в такой вид в хабе» — группы поля рейкой «Вариант А» (ZerkGrozd, как в Маятнике):
   шапки групп одна под другой справа от меню страниц, открыта одна, кнопки — шестигранники сотами в 2 столбца.
   Рейка рисует свои кнопки, а щелчок передаёт настоящей кнопке поля (hub-nested-groups.js), поэтому вся логика хаба прежняя.
   «по всему звуку - нотам, отдельное меню» — пуск / пауза битов, ноты, скорость и стоп собраны в группу «Звук».
   Пульт движений у креста и сам крест остаются как были.
   v0.266: «это осталось — тоже в меню» — пульт движений («Вращ.») — группой «Вращение» в рейке, у креста его больше нет. */
(() => {
  'use strict';
  const txt = s => String(s || '').replace(/\s+/g, ' ').trim();
  const cut = s => s.length > 16 ? s.slice(0, 15) + '…' : s;
  // «подсказки проверь»: служебный хвост старого меню («ПКМ — поднять…», «Наведение…») вырезается и тогда, когда он — вся подсказка; пусто — берётся aria-label
const tipCut = t => txt((t || '').split(/(?: · )?ПКМ —/)[0].split(/(?: · )?Наведение /)[0]);
const tipOf = n => tipCut(n.dataset.hubTip ?? n.getAttribute('title')) || tipCut(n.getAttribute('aria-label')) || tipCut(n.closest?.('details')?.getAttribute('aria-label'));
  const fire = inp => { inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true })); };
  // короткие названия там, где у кнопки поля нет своей подписи
  const NAMES = [[/Узор: Хоррориус/, 'Х', 'Хоррориус'], [/Узор: исходный/, 'П', 'Исходный'], [/Узор: Серпинский/, 'С', 'Серпинский'],
    [/Ромбы с цифрами/, '◇', 'Ромбы'], [/Только цифры/, '1', 'Цифры'], [/Скобки: 1 = \), 0 = \(\)/, ')', 'Скобки ()'], [/Скобки: 1 = \), 0 = \($/, ')(', 'Скобки )('],
    [/Черты/, '\\/', 'Черты'], [/Уголки/, '<>', 'Уголки'], [/Звезда/, '*', 'Звезда'], [/Без знака/, '–', 'Нет'], [/hubPNG$/, '▧', 'PNG'], [/hubRec$/, '⏺', 'Видео'],
    [/Цвет битов оригинала/, '1', 'Цвет 1'], [/Цвет нулей оригинала/, '0', 'Цвет 0'], [/Прозрачные цифры 0/, '0', 'Прозр. 0'], [/Прозрачные цифры 1/, '1', 'Прозр. 1'],
    [/Цвет отражённых/, '◇', 'Отражение'], [/Цвет заворота/, '⤵', 'Заворот'], [/Цвет подсветки симметрии/, '✦', 'Подсветка'], [/Золото:/, '✦', 'Золото'],
    [/Скорость битов/, '♪', 'Скорость'], [/Семь световых/, null, 'Ноты'], [/Остановить биты/, null, 'Стоп']];
  const VALS = [[/hubRowCount/, 'Строки'], [/hubFlipSpeed/, 'Скор. 3D'], [/Скорость света/, 'Свет'], [/Скорость снега/, 'Снег'], [/Скорость воды/, 'Вода'],
    [/Размер битов света/, 'Размер'], [/Наклон ромбов 0/, 'Наклон 0'], [/Наклон ромбов 1/, 'Наклон 1'], [/hubAxisSpeed/, 'Скор. оси'], [/автозума/, 'Ход зума'], [/Радиус солнца/, 'Солнце'], [/Минимум строк/, 'Мин. строк'], [/Минимум пар/, 'Мин. пар']];
  const ic = n => { const p = n.querySelector(':scope > .hubIc path, :scope > summary > .hubIc path'); return p ? p.getAttribute('d') : ''; };
  const icName = n => txt(n.querySelector(':scope > .hubIc > span, :scope > summary > .hubIc > span')?.textContent);
  function leafItem(r) {
    const n = r.node, tip = tipOf(n.matches('details') ? n.querySelector('summary') : n) || tipOf(n), m = NAMES.find(([re]) => re.test(r.id));
    const own = txt([...n.childNodes].filter(c => c.nodeType === 3).map(c => c.textContent).join(' '));
    const icon = ic(n) || (m && m[1]) || own.split(' ')[0].slice(0, 3), name = cut((m && m[2]) || icName(n) || txt(n.querySelector('small')?.textContent) || (own.includes(' ') ? own.slice(own.indexOf(' ') + 1) : '') || tip);
    if (n.matches('details')) {
      const inp = n.querySelector('input'), out = n.querySelector('summary output'), v = VALS.find(([re]) => re.test(r.id));
      const lo = () => inp.min === '' ? -Infinity : +inp.min, hi = () => inp.max === '' ? Infinity : +inp.max, st = () => parseFloat(inp.step) || 1;
      const put = x => { x = Math.max(lo(), Math.min(hi(), x)); const d = (String(inp.step).split('.')[1] || '').length; inp.value = d ? x.toFixed(d) : String(Math.round(x)); fire(inp); };
      return { type: 'value', name: v ? v[1] : cut(icName(n) || tip), tip, zero: () => put(0),   // v0.280: двойной щелчок по ползунку — 0 (или ближайшее разрешённое)
        get: () => /Наклон ромбов/.test(r.id) ? txt(n.querySelector('summary')?.textContent) : txt(out?.textContent || n.querySelector('.hubSlV')?.textContent || inp.value),   // v0.266: наклон — с номером бита («0 · 0°»)
        step: d => { let s = st(); if (Math.abs(d) === 2) { const span = hi() - lo(); s = Number.isFinite(span) ? Math.max(s, Math.round(span * .1 / s) * s) : s * 5; } put(+inp.value + Math.sign(d) * s); },
        // v0.263: «ползунком» — значение тянут по дорожке (grozd.js рисует бегунок), стрелки и колесо — шаг
        ...(inp.type === 'range' ? { frac: () => (+inp.value - lo()) / ((hi() - lo()) || 1), setFrac: f => { const s = st(); put(lo() + Math.round(f * (hi() - lo()) / s) * s); } } : {}) };
    }
    const sel = n.querySelector('select');
    if (sel) return { type: 'list', icon: '▤', name: cut(tip.split(/[:·]/)[0]), tip, get: () => sel.value, set: x => { sel.value = x; fire(sel); }, options: [...sel.options].map(o => ({ v: o.value, name: txt(o.textContent) })) };
    const inp = n.querySelector('input');
    if (inp && inp.type === 'color') return { type: 'color', icon, name, tip, get: () => inp.value, set: x => { inp.value = x; fire(inp); }, open: a => { window.HubColorPicker?.anchor?.(a); inp.click(); } };   // «повторный клик по кнопке — сверни палитру»: своя палитра хаба вместо системной, второе нажатие её сворачивает
    if (inp && inp.type === 'checkbox') return { type: 'toggle', icon, name, tip, on: () => inp.checked, click: () => inp.click() };
    if (n.hasAttribute('aria-pressed')) return { type: 'toggle', icon, name, tip, on: () => n.getAttribute('aria-pressed') === 'true', click: () => n.click() };
    const live = /Скорость битов|Режим автозума/.test(r.id);   // кнопки, чья надпись — текущее значение
    return { type: 'action', icon, name, tip, nameNow: live ? () => cut(txt(n.textContent)) : null, click: () => n.click() };
  }
  // голова со своим действием (Симметрия, Ось, 3D, Свет…) — первой кнопкой
  function headItem(r, icon, name) {
    const s = r.node.querySelector(':scope > summary'), tip = tipOf(s);
    return { type: 'toggle', icon: ic(r.node) || icon, name, tip, on: () => { const v = r.on ? r.on() : r.active?.(); return v === true || v === 'mixed'; }, click: () => { r.action(); } };
  }
  const gateOn = r => r.on ? r.on() : r.active?.();
  // «эти все в Биты»: Прозр. 0 / 1 и Цвет 0 / 1 — из «Цвета» в «Биты» (остальное «Цвета» — образцы — только списком «Палитра»)
  const IN_PAIR = /\|(Ромбы с цифрами|hubBitPacking)$/;
  const TO_BITS = /^colour\|(Прозрачные цифры [01]|Цвет битов оригинала|Цвет нулей оригинала)/;
  const GROUPS = [['sound', 'Звук', '#4fe3c4'], ['bits', 'Биты', '#8fd3ff'], ['symmetry', 'Зеркала', '#ffd35b'], ['axis', 'Ось', '#ff87cf'],
    ['space', '3D объём', '#a98bff'], ['motion', 'Вращение', '#ffb36b'], ['flow', 'Поток', '#5ad1ff'], ['file', 'Файл', '#7fe0a0'], ['locks', 'Замок', '#c0c8d8']];
  const HEAD = { symmetry: 'Поиск осей', axis: 'Ось', space: '3D вращ.', flow: 'Пуск', locks: 'Все', 'flow|branch:light': 'Свет', 'flow|branch:snow': 'Снег', 'flow|branch:water': 'Вода' };
  const FLOW_COMMON = /^flow\|(hubLightRule-|hubLightLoss$)/;   // «это общие — их всегда показывать, не скрывать»: правила прохода / отражения и потеря
  const FLOW_C = { 'flow|branch:light': '#ffe46b', 'flow|branch:snow': '#e6eeff', 'flow|branch:water': '#3f8cff' };
  const FLOW_SPEED = /^flow\|Скорость (света|снега|воды)$/;
  const SOUND = /Семь световых|Скорость битов|Остановить биты/;
  function collect(T) {
    const out = new Map(GROUPS.map(([k]) => [k, []]));
    const add = (k, it, id) => { it.key = id; out.get(k)?.push(it); };
    const toBits = {};
    const flowG = T.groups.find(x => x.key === 'flow'), flowOff = () => !(flowG?.root?.children || []).some(x => /^flow\|branch:/.test(x.id) && gateOn(x));   // все потоки выключены   // кнопки, собираемые в пары (ключ — подпись без группы)
    for (const g of T.groups) {
      if ((!out.has(g.key) && g.key !== 'colour') || !g.root) continue;   // «Цвета» в рейке нет, но из него берутся «Палитра» и пары 0 | 1
      let pat = null, glyph = null;
      const walk = (r, vis, br) => {   // br — внутри ветки Поток (Свет / Снег / Вода)
        let cur = '';   // id текущего листа (для fc)
        const fc = it => { if (g.key === 'flow') { delete it.col; if (br && !FLOW_COMMON.test(cur)) { it.sec = br; it.secColor = FLOW_C[br]; }
          if (FLOW_COMMON.test(cur)) it.disabled = flowOff; } return it; };   // «настройки каждого потока — под ним, своим цветом»; общие правила — в общей части, «неактивны, когда выкл. потоки»   // Свет / Снег / Вода — в ползунках, их кнопки — вторым столбцом, без пустоты
        const fa = it => (g.key === 'axis' && it.type !== 'value' && it.type !== 'list' && (it.col = /^Завор/.test(it.name || '') ? 0 : 1), it);   // «тут слева пустота»: «Завор.» — под «Ось», «Центр ◇» и «Центр △» — справа
        const fs = it => (g.key === 'space' && it.type !== 'value' && it.type !== 'list' && (it.col = 1), it);   // «замор. — в правую рейку, не оставляй пустоты»: «3D объём» — 3D вращ. слева, остальное столбиком справа   // v0.274: «Ось» — кнопка «Ось» первым столбцом, «Завор.» и «Центр» вторым, одна под другой   // 19.10: «свет и вода во 2 столб… от каждой её список 3 столбцом при включении»
        for (const c of r.children || []) {
          if (c.children) {
            const isBr = g.key === 'flow' && /^flow\|branch:/.test(c.id);
            const spd = isBr && (c.children || []).find(x => FLOW_SPEED.test(x.id));
            if (c.action && spd) { const h = headItem(c, '', HEAD[c.id] || txt(c.node.querySelector('small')?.textContent));   // «Свет / Снег / Вода — каждую со своим ползунком скорости»: слева вкл / выкл, справа скорость (видна всегда)
              add(g.key, toBits['head:' + c.id] = { ...leafItem(spd), sec: c.id, secColor: FLOW_C[c.id], secHead: true, name: h.name, tip: h.tip + ' · ползунок — скорость', head: { label: h.name, on: h.on, click: h.click } }, c.id); }
            else if (c.action) add(g.key, isBr ? { ...headItem(c, '', HEAD[c.id] || txt(c.node.querySelector('small')?.textContent)), col: 1 } : fc(headItem(c, '', HEAD[c.id] || txt(c.node.querySelector('small')?.textContent))), c.id);
            walk(c, vis && (!c.gate || !!gateOn(c)), br || (isBr ? c.id : ''));
            continue;
          }
          cur = c.id;
          if (/\|(hubPNG|hubRec)$/.test(c.id)) continue;   // PNG и видео — ромбами под «Дзен»
          if (FLOW_SPEED.test(c.id) || /^flow\|Очистить свет/.test(c.id)) continue;   // сброс потоков — правой половиной «Пуск»   // скорость потока — в кнопке своей ветки
          if ((!vis && !c.free && !FLOW_COMMON.test(c.id)) || c.node.hidden || (c.dep && !gateOn(c.dep))) continue;
          if (g.key === 'colour' && c.node.matches('.hubSwatch')) continue;
          if (c.node.dataset?.view && c.node.dataset.view !== 'rhombs') {   // v0.279: «это всё в одну кнопку-список»: знак бита (цифры, скобки, черты, уголки, звезда) — списком; «Ромбы» — отдельной кнопкой
            if (!glyph) { glyph = (r.children || []).filter(x => !x.children && x.node.dataset?.view && x.node.dataset.view !== 'rhombs').map(x => [x.node, leafItem(x)]);
              add(g.key, { type: 'list', compact: true, icon: '1', name: 'Знак', tip: 'Знак бита: цифры, скобки, черты, уголки, звезда · при включённых «Ромбах» — внутри ромба',
                get: () => glyph.findIndex(([b]) => b.getAttribute('aria-pressed') === 'true'), set: i => glyph[i]?.[0].click(),
                options: glyph.map(([, it], i) => ({ v: i, name: it.name, icon: it.icon })) }, 'bits|glyph'); }
            continue;
          }
          if (/\|Узор: /.test(c.id)) {   // v0.270: «как палитру — выпадающим из 3 списком»: Х / П / С — одной кнопкой со списком
            if (!pat) { pat = (r.children || []).filter(x => !x.children && /\|Узор: /.test(x.id)).map(x => x.node);
              add('bits', { type: 'list', compact: true, icon: '△', name: 'Узор', tip: 'Узор треугольника', get: () => pat.findIndex(b => b.getAttribute('aria-pressed') === 'true'),
                set: i => pat[i]?.click(), options: pat.map((b, i) => ({ v: i, name: (NAMES.find(([re]) => re.test(b.getAttribute('aria-label'))) || [])[2] || txt(b.getAttribute('aria-label')).replace(/^Узор: /, ''), icon: txt(b.textContent) })) }, 'bits|pattern'); }
            continue;
          }
          if (/\|Автозум от центра/.test(c.id)) {   // «автозум и маятник / сброс — также»: при включённом автозуме — «Автозум / Маятник» (или «Сброс»)
            const it = fs(fa(fc(leafItem(c)))), md = () => document.querySelector('button[aria-label^="Режим автозума"]'), on = () => c.node.getAttribute('aria-pressed') === 'true';
            add(g.key, toBits.zoom = { type: 'pair', col: it.col, cls: 'gz-split gz-bs', name: 'Автозум', mid: '', tip: it.tip, one: () => !on(),
              parts: [{ label: 'Автозум', tip: it.tip, on, click: () => c.node.click() }, { label: 'Маятник', labelNow: () => /Сброс/.test(md()?.textContent || '') ? 'Сброс' : 'Маятник', tip: 'Режим автозума: маятник или сброс к минимуму', click: () => md()?.click() }] }, c.id); continue; }
          if (/\|Режим автозума/.test(c.id)) continue;
          if (/\|Минимум (строк|пар)/.test(c.id) && c.node.matches('details')) { toBits[/строк/.test(c.id) ? 'minR' : 'minP'] = c; continue; }   // «Мин. строк | Мин. пар» — одной кнопкой (после обхода)
          if (/\|hubAxisSpeed$/.test(c.id)) { toBits.spinVal = c; continue; }   // «Крут. — объедини с его ползунком» (после обхода)
          if (/автозума/.test(c.id) && c.node.matches('details')) { toBits.zoomVal = c; continue; }   // «Автозум — объедини с его ползунком»: ползунок — в кнопку «Автозум» (после обхода)
          if (/\|Наклон ромбов [01]$/.test(c.id)) continue;
          if (/^[^|]*\|Зеркало$/.test(c.id) || /\|Цвет отражённых/.test(c.id)) { toBits[/Зеркало$/.test(c.id) ? 'mirror' : 'mirrorColor'] = c; continue; }   // «Зерк. — и сюда же её цвет, дубль цвета удали»
          { const m = /^flow\|hubLightRule-([01])-(pass|reflect)$/.exec(c.id);   // «0 Проп. 1» и «0 Отр. 1» — по типу «0 Прозр. 1»: бит 0 слева, бит 1 справа
            if (m) { const k = 'rule:' + m[2], n = c.node, mk = () => txt(n.textContent).split(' ')[0];
              const part = { label: '', labelNow: m[1] === '0' ? () => '0 ' + mk() : () => mk() + ' 1', tip: tipOf(n), on: () => n.getAttribute('aria-pressed') === 'true', click: () => n.click() };
              if (!toBits[k]) { toBits[k] = { type: 'pair', cls: 'gz-split gz-mid', name: m[2] === 'pass' ? 'Проп.' : 'Отр.', mid: m[2] === 'pass' ? 'Проп.' : 'Отр.',
                tip: 'Свет — ' + (m[2] === 'pass' ? 'пропускание' : 'отражение') + ': бит 0 · бит 1 · клик: нет → сверху → снизу → обе', disabled: flowOff, parts: [null, null] }; add(g.key, toBits[k], 'flow|' + k); }
              toBits[k].parts[+m[1]] = part; continue; } }
          if (/^flow\|(Свет из солнца|Радиус солнца)/.test(c.id)) {   // «Солнце — в свой ползунок радиуса»: слева вкл / выкл, справа радиус
            const it = fc(leafItem(c)); toBits[/Радиус/.test(c.id) ? 'sunR' : 'sunOn'] = it;
            if (!toBits.sun) { toBits.sun = { ...it, key: 'flow|sun' }; add(g.key, toBits.sun, 'flow|sun'); }
            continue; }
          if (/^space\|(Оригинал и зеркало под прямым углом|Заморозить 3D-наклон)/.test(c.id)) {   // «90° и Замор. — в одну кнопку, или — или»
            toBits[/прямым/.test(c.id) ? 'sp90' : 'spFrz'] = leafItem(c);
            if (!toBits.spPair) { toBits.spPair = { ...fs(leafItem(c)), key: 'space|90-freeze' }; add(g.key, toBits.spPair, 'space|90-freeze'); }
            continue; }
          if (/^flow\|(Свет в виде выбранных битов|Размер битов света)/.test(c.id)) {   // «Биты — объедини со своим ползунком»: слева вкл / выкл, справа размер
            const it = fc(leafItem(c)); toBits[/Размер/.test(c.id) ? 'lbSize' : 'lbOn'] = it;
            if (!toBits.lbits) { toBits.lbits = { ...it, key: 'flow|lightBits' }; add(g.key, toBits.lbits, 'flow|lightBits'); }
            continue; }
          if (/^flow\|(Сплошной поток|hubFlowAxis$)/.test(c.id)) {   // «Плотно и От оси — объедини»: одна кнопка пополам, место держит первая
            toBits[/Сплошной/.test(c.id) ? 'fDense' : 'fAxis'] = leafItem(c);
            if (!toBits.flowPair) { toBits.flowPair = { ...fc(leafItem(c)), key: 'flow|dense-axis' }; add(g.key, toBits.flowPair, 'flow|dense-axis'); }
            continue; }
          if (/\|Закрепить центр (ромбов|контура)/.test(c.id)) {   // «Центр ◇ и Центр △ — как „Ромб. | Квадр.“»: одна кнопка пополам, место держит первая
            const k = /ромбов/.test(c.id) ? 'cMass' : 'cTri'; toBits[k] = leafItem(c);
            if (!toBits.center) { toBits.center = { ...fa(leafItem(c)), key: 'axis|center' }; add(g.key, toBits.center, 'axis|center'); }
            continue; }
          if (/\|Цвет заворота/.test(c.id)) { toBits.foldColor = c; continue; }   // «Завор. — сюда цвет, отдельную кнопку-дубль цвета удали»: правой половиной «∿ Завор. | ●»
          if (/\|Заворот:/.test(c.id)) { const it = leafItem(c); toBits.fold = it; add('symmetry', it, c.id); continue; }   // «Завор. — перемести в Зеркала»   // место в «Оси» держит сама кнопка, цвет к ней — после обхода
          if (/\|(Золото:|Цвет подсветки симметрии)/.test(c.id)) { toBits[/Золото:/.test(c.id) ? 'gold' : 'goldColor'] = c; continue; }   // собираются в пару «✦ Подсветка | ●»
          if (/\|Вращать ось: зеркало/.test(c.id)) { add(g.key, toBits.spin = { ...fs(fa(fc(leafItem(c)))), disabled: () => !window.HubMirror?.state?.on }, c.id); continue; }   // «Крут.» без зеркала — дубль пуска: притушена и не жмётся   // «убери дубли»: наклоны 0 / 1 — на нижнем пульте рядом с пуском
          if (/^symmetry\|.*Симметрия параллельно/.test(c.id) || /\|Сбросить только 3D/.test(c.id) || /^bits\|Сброс наклона/.test(c.id)) continue;   // сброс наклона битов — дубль ↺ на пульте   // сброс 3D — правой половиной кнопки «3D вращ.»
          if (/\|hubBitFreeRotation$/.test(c.id)) continue;   // «360 вращ.» — на нижнем пульте, на месте ↺   // «в Биты, „360 вращ.“» (из «Вращения»)
          if (TO_BITS.test(c.id) || IN_PAIR.test(c.id)) { toBits[c.id.replace(/^[^|]*\|/, '')] = c; continue; }
          add(SOUND.test(c.id) ? 'sound' : g.key, fs(fa(fc(leafItem(c)))), c.id);
        }
      };
      const root = g.root;
      if (root.action && g.key === 'bits') add('sound', { ...headItem(root, 'M9 6l9 6-9 6z', 'Пуск'), name: 'Пуск' }, 'bits');   // пуск / пауза битов — это звук
      else if (g.key === 'file') { const b = document.getElementById('hubPresetList');
        if (b) add('file', { type: 'toggle', icon: '▤', name: 'Шаблоны', tip: 'Открыть список шаблонов', on: () => b.getAttribute('aria-expanded') === 'true', click: () => b.click() }, 'file'); }
      else if (root.action && g.key === 'symmetry') {   // «поиск и парал. — в одну кнопку пополам, когда включён поиск»
        const h = headItem(root, '', HEAD.symmetry), par = () => document.querySelector('#hubFieldTools [aria-label*="Симметрия параллельно"], [aria-label*="Симметрия параллельно"]');
        const pon = () => { const n = par(); if (!n) return false; const i = n.matches('input') ? n : n.querySelector('input[type=checkbox]'); return i ? i.checked : n.getAttribute('aria-pressed') === 'true'; };
        add('symmetry', { type: 'pair', cls: 'gz-split gz-bs', name: HEAD.symmetry,   /* «эту кнопку — в одну шириной» */ mid: '', tip: h.tip, one: () => !h.on(),
          parts: [{ label: HEAD.symmetry, labelNow: () => h.on() ? 'Поиск' : HEAD.symmetry, tip: h.tip, on: h.on, click: h.click }, { label: 'Парал.', tip: 'Симметрия параллельно: искать оси, параллельные главной', on: pon, click: () => { const n = par(); (n?.matches('input') ? n : n?.querySelector('input[type=checkbox]') || n)?.click(); } }] }, 'symmetry'); }
      else if (root.action && g.key === 'space') {   // «при включении — на полкнопки 3D вращ. / Сброс», «а тот сброс убери»: пока 3D не в покое — пара, иначе одна кнопка
        const h = headItem(root, '', HEAD.space), r3 = () => document.querySelector('button[aria-label^="Сбросить только 3D"]');
        add('space', { type: 'pair', col: 0, cls: 'gz-split gz-bs', name: HEAD.space, mid: '', tip: h.tip, one: () => !window.HubView?.flipOn,
          parts: [{ label: HEAD.space, tip: h.tip, on: h.on, click: h.click }, { label: 'Сброс', tip: 'Сбросить 3D: остановить, снять заморозку, вернуть обе плоскости', click: () => r3()?.click() }] }, 'space'); }
      else if (root.action && g.key === 'flow') {   // «объедини, покажи Сброс — когда запущен Пуск»: пока пуск не идёт — одна кнопка «Пуск»
        const h = headItem(root, '', HEAD.flow), clr = () => document.querySelector('button[aria-label^="Очистить свет, снег и воду"]');
        add('flow', { type: 'pair', cls: 'gz-split gz-bs', name: HEAD.flow, mid: '', tip: h.tip, one: () => !h.on() && !window.HubFlow?.traces,   // «Сброс — когда есть остатки потоков на холсте»
          parts: [{ label: HEAD.flow, tip: h.tip, on: h.on, click: h.click }, { label: 'Сброс', tip: 'Очистить свет, снег и воду, остановить потоки', click: () => clr()?.click() }] }, 'flow'); }
      else if (root.action && g.key === 'axis' && window.HubMirror?.setAxisColor) {   // «Ось — добавь цвет»: слева показать / спрятать ось, справа её цвет
        const h = headItem(root, '', HEAD.axis), M = window.HubMirror, trig = document.createElement('span');
        add('axis', { type: 'pair', col: 0, cls: 'gz-split gz-bs gz-wl', name: HEAD.axis, mid: '', tip: h.tip + ' · справа — цвет оси',
          parts: [{ label: '✣ Ось', tip: h.tip, on: h.on, click: h.click }, { label: '●', tip: 'Цвет оси', on: h.on, ink: () => M.axisColor(),
            open: a => window.HubColorPicker?.open({ trigger: trig, anchor: a, title: 'Цвет оси', color: M.axisColor(), opacity: 1, maxOpacity: 1, onChange: c => M.setAxisColor(c) }) }] }, 'axis'); }
      else if (root.action) add(g.key, g.key === 'flow' || g.key === 'axis' ? { ...headItem(root, '', HEAD[g.key] || g.name), col: 0 } : headItem(root, '', HEAD[g.key] || g.name), g.key);
      walk(root, !root.gate || !!gateOn(root));
      if (g.key === 'colour') {   // «прозрачности объедини в одну кнопку, обводку пополам, и цвета 1 и 0 так же; прозрачности — в цвет битов, слово „Прозр.“ убери, и „Цвет“ — но там обводка радугой»
        const pc = () => { const c = window.HubMirror?.colors?.() || {}, a = window.HubMirror?.state?.zeroAlpha ?? .18, z = c.zero || c.bit || '#8fd3ff';
          return { f0: 'color-mix(in srgb,' + z + ' ' + Math.round(a * 100) + '%,#060a12)', k0: z, f1: c.bit || '#8fd3ff', k1: '#1c1c22' }; };
        const part = (key, d) => { const c = toBits[key]; if (!c) return null; const it = leafItem(c);
          return { label: d, tip: it.tip, on: it.on, click: it.click, open: it.open, fill: () => pc()['f' + d], ink: () => pc()['k' + d] }; };
        const t0 = part('Прозрачные цифры 0', '0'), t1 = part('Прозрачные цифры 1', '1'), c0 = part('Цвет нулей оригинала', '0'), c1 = part('Цвет битов оригинала', '1');
        if (t0 && t1) add('bits', { type: 'pair', cls: 'gz-cut gz-split gz-mid', name: 'Прозр.', tip: 'Прозрачный вырез знака в ромбах: 0 · 1', parts: [t0, t1] }, 'bits|cutout');
        if (c0 && c1) add('bits', { type: 'pair', cls: 'gz-rainbow gz-split gz-mid', name: 'Цвет', tip: 'Цвет битов: 0 · 1', parts: [c0, c1] }, 'bits|colors');
      }
      if (g.key === 'colour') {   // образцы палитры — одним списком
        const sw = (root.children || []).filter(c => !c.children && c.node.matches('.hubSwatch')).map(c => c.node);
        if (sw.length) add('bits', { type: 'list', compact: true, icon: '🎨', name: 'Палитра', tip: 'Готовые пары цветов', get: () => sw.findIndex(b => b.getAttribute('aria-pressed') === 'true'),
          set: i => sw[i]?.click(), options: sw.map((b, i) => ({ v: i, name: cut(txt(b.getAttribute('aria-label')).replace(/^Цвета: /, '')), icon: '●' })) }, 'colour|palette');
      }
    }
    // звук — в своём порядке: пуск, ноты, скорость, стоп
    const at = k => k === 'bits' ? 0 : /Семь/.test(k) ? 1 : /Скорость битов/.test(k) ? 2 : 3;
    out.get('sound').sort((a, b) => at(a.key) - at(b.key));
    // 19.10: «кнопка, открывающая список, — по возможности в правую рейку»: в сотах правый столбец — нечётные места
    for (const [k, a] of out) {
      const cell = i => !(['value', 'control'].includes(i.type) || (i.type === 'list' && !i.compact)), cells = a.filter(cell);
      if (cells.some(i => i.col != null)) continue;
      const ls = cells.filter(i => i.type === 'list'), rest = cells.filter(i => i.type !== 'list'), seq = [];
      while (ls.length || rest.length) seq.push(((seq.length % 2) ? ls.shift() : rest.shift()) || ls.shift() || rest.shift());
      out.set(k, [...seq, ...a.filter(i => !cell(i))]);
    }
    {   // «Ромбы» и «Встык» — «также в одну»: одна кнопка пополам
      // «добавь квадраты, встык — вынеси в отдельную»: «◇ Ромб. \ □ Квадр.» — форма бита, «Встык» — своей кнопкой
      const r = toBits['Ромбы с цифрами'], p = toBits['hubBitPacking'], M = window.HubMirror;
      const shape = (m, d, tip) => ({ label: d, tip, on: () => M?.bitShape?.() === m, click: () => M?.setBitShape?.(M.bitShape() === m ? null : m) });
      if (r && M?.setBitShape) out.get('bits').push({ type: 'pair', cls: 'gz-split gz-bs', name: 'Ромбы · квадраты', mid: '', tip: 'Форма бита: ромбы · квадраты', parts: [shape('rhomb', '◇ Ромб.', 'Ромбы'), shape('square', '□ Квадр.', 'Квадраты')], key: 'bits|shape' });
      else if (r) out.get('bits').push({ ...leafItem(r), key: r.id });
      if (p) out.get('bits').push({ ...leafItem(p), key: p.id });
      if (M?.setPackMode) for (const [m, icon, name, tip] of [['styk1', '⇹', 'Стык1', 'Знаки целиком крупнее, без растяжки: каждый касается знака через одного'], ['styk2', '↔', 'Стык2', 'Знаки целиком крупнее, без растяжки: до касания с соседом, ни один не перекрывает другой']])
        out.get('bits').push({ type: 'toggle', icon, name, tip, on: () => M.packMode() === m, click: () => M.setPackMode(m), key: 'bits|' + m });
      if (M?.setSquareGrid) out.get('bits').push({ type: 'toggle', icon: '▦', name: 'Сетка', tip: 'Квадраты ровной сеткой: шаг строк = шагу битов, отступы одинаковые (треугольник выше). Только при квадратах',
        on: () => M.squareGrid(), click: () => { if (M.bitShape() !== 'square') M.setBitShape('square'); M.setSquareGrid(!M.squareGrid()); }, key: 'bits|squareGrid' });
    }
    {   // «▣ кадр — перемести во «Вращение»» (был на нижнем пульте)
      const fl = () => document.querySelector('.hub-frame-lock');
      if (fl()) out.get('motion')?.push({ type: 'toggle', icon: '▣', name: 'Кадр', tip: 'Точный шаг вращения на каждый кадр', on: () => fl()?.getAttribute('aria-pressed') === 'true', click: () => fl()?.click(), key: 'motion|frame' });
    }
    if (toBits.mirror) {   // «Зерк. | ●»: слева зеркало вкл / выкл, справа цвет отражённых битов (отдельной «Отражение» больше нет)
      const mi = leafItem(toBits.mirror), mc = toBits.mirrorColor && leafItem(toBits.mirrorColor);
      const it = mc ? { type: 'pair', cls: 'gz-split gz-bs gz-wl', name: 'Зерк.', mid: '', tip: 'Зеркало: отражение от оси · справа — цвет отражённых битов',
        parts: [{ label: '⋈ Зерк.', tip: mi.tip, on: mi.on, click: mi.click }, { label: '●', tip: 'Цвет отражённых битов', on: mi.on, open: mc.open, ink: () => mc.get() }], key: 'symmetry|mirror' } : { ...mi, name: 'Зерк.', key: toBits.mirror.id };
      const sl = out.get('symmetry'); if (sl) { const k = sl.findIndex(i => i.key === 'symmetry'); sl.splice(k >= 0 ? k + 1 : 0, 0, it); }
    }
    if (toBits.sun && toBits.sunOn && toBits.sunR) {
      const t = toBits.sunOn, z = toBits.sun;
      for (const k of Object.keys(z)) if (!['key', 'sec', 'secColor'].includes(k)) delete z[k];
      Object.assign(z, toBits.sunR, { key: 'flow|sun', name: 'Солнце', tip: t.tip + ' · ползунок — радиус солнца', head: { label: '☀ Солнце', on: t.on, click: t.click } });
    } else if (toBits.sun) Object.assign(toBits.sun, toBits.sunOn || toBits.sunR, { key: 'flow|sun' });
    if (toBits.lbits && toBits.lbOn && toBits.lbSize) {
      const t = toBits.lbOn, z = toBits.lbits;
      for (const k of Object.keys(z)) if (!['key', 'sec', 'secColor'].includes(k)) delete z[k];
      Object.assign(z, toBits.lbSize, { key: 'flow|lightBits', name: 'Биты', tip: t.tip + ' · ползунок — размер битов света', head: { label: '01 Биты', on: t.on, click: t.click } });
    } else if (toBits.lbits) Object.assign(toBits.lbits, toBits.lbOn || toBits.lbSize, { key: 'flow|lightBits' });
    if (toBits.spPair && toBits.sp90 && toBits.spFrz) {
      const a = toBits.sp90, b = toBits.spFrz, only = (x, y) => () => { if (!x.on() && y.on()) y.click(); x.click(); };   // включил одну — другая выключается
      Object.assign(toBits.spPair, { type: 'pair', cls: 'gz-split gz-bs', name: '90° · замор.', mid: '', tip: 'Или — или: 90° — оригинал и зеркало под прямым углом · Замор. — заморозить 3D-наклон оригинала',
        parts: [{ label: '⛶ 90°', tip: a.tip, on: a.on, click: only(a, b) }, { label: '❄ Замор', tip: b.tip, on: b.on, click: only(b, a) }] });
    } else if (toBits.spPair) Object.assign(toBits.spPair, toBits.sp90 || toBits.spFrz, { key: 'space|90-freeze' });
    if (toBits.flowPair && toBits.fDense && toBits.fAxis) {
      const d = toBits.fDense, a = toBits.fAxis;
      Object.assign(toBits.flowPair, { type: 'pair', cls: 'gz-split gz-bs', name: 'Плотно · от оси', mid: '', tip: 'Плотно — сплошной поток света и воды сверху · От оси — поток от оси',
        parts: [{ label: '▦ Плотно', tip: d.tip, on: d.on, click: d.click }, { label: '✣ От оси', tip: a.tip, on: a.on, click: a.click }] });
    }
    if (toBits.center && toBits.cMass && toBits.cTri) {
      const m = toBits.cMass, t = toBits.cTri;
      Object.assign(toBits.center, { type: 'pair', cls: 'gz-split gz-bs', name: 'Центр', mid: '', tip: 'Закрепить центр в центре оси: ◇ — центр масс ромбов · △ — центр контура треугольника',
        parts: [{ label: 'Центр ◇', tip: m.tip, on: m.on, click: m.click }, { label: 'Центр △', tip: t.tip, on: t.on, click: t.click }] });
    }
    if (toBits.spin && toBits.spinVal) {   // «Крут. | ползунок скорости оси»: слева пуск / пауза кручения оси (без зеркала — притушен), справа скорость
      const z = toBits.spin, { on, click, disabled: off, tip } = z, t = { label: 'ВращЗерк.', on, click: () => { if (!off()) click(); } };
      for (const k of ['col', 'icon', 'nameNow', 'modes', 'disabled']) delete z[k];
      Object.assign(z, leafItem(toBits.spinVal), { name: 'ВращЗерк.', tip: tip + ' · ползунок — скорость', head: t });
    }
    if (toBits.zoom && toBits.zoomVal) {   // «Автозум | ползунок хода зума | Маятник»: слева вкл / выкл, справа режим (при включённом)
      const z = toBits.zoom, [p0, p1] = z.parts, v = leafItem(toBits.zoomVal);
      for (const k of ['parts', 'cls', 'one', 'mid', 'col']) delete z[k];
      Object.assign(z, v, { name: 'Автозум', tip: p0.tip + ' · ползунок — ход зума', head: { label: 'Автозум', on: p0.on, click: p0.click },
        tail: { label: p1.label, labelNow: p1.labelNow, show: p0.on, click: p1.click } });
    }
    if (toBits.fold && toBits.foldColor) {   // «∿ Завор. | ●»: слева заворот вкл / выкл, справа цвет заворота (отдельной «Заворот» в цветах больше нет)
      const fi = toBits.fold, fc = leafItem(toBits.foldColor);
      Object.assign(fi, { type: 'pair', cls: 'gz-split gz-bs gz-wl', name: 'Завор.', mid: '', tip: 'Заворот: части отражения вне треугольника — ещё и внутрь · справа — цвет заворота',
        parts: [{ label: '∿ Завор.', tip: fi.tip, on: fi.on, click: fi.click }, { label: '●', tip: 'Цвет заворота', on: fi.on, open: fc.open, ink: () => fc.get() }] });
    }
    if (toBits.gold) {   // «подсветка — цвет Золота? выбор цвета — в Золото, и переименуй»: одна кнопка — слева вкл / выкл подсветки симметричных областей, справа её цвет
      const gi = leafItem(toBits.gold), ci = toBits.goldColor && leafItem(toBits.goldColor);
    { const M = window.HubMirror, al2 = out.get('axis');   // «добавить 2 ось, и кнопку 90-30-60 градусов от первой»: слева 2-я ось вкл / выкл, справа угол к первой
      if (M?.setAxis2 && al2) { const i2 = al2.findIndex(i => i.key === 'axis') + 1;
        al2.splice(i2, 0, { type: 'pair', col: 0, cls: 'gz-split gz-bs', name: '2 ось', mid: '', tip: 'Вторая ось зеркала через тот же центр — калейдоскоп · справа — угол к первой: 90° → 30° → 60° → свободный',
          parts: [{ label: '✣ 2 ось', tip: 'Вторая ось: вкл / выкл (нужно включённое зеркало)', on: () => !!M.state.axis2, click: () => M.setAxis2(!M.state.axis2) },
            { label: '90°', labelNow: () => M.state.axis2Deg === -2 ? '✳3' : M.state.axis2Deg === -1 ? '△3' : M.state.axis2Deg ? M.state.axis2Deg + '°' : '⟳' + Math.round(M.state.axis2Free) + '°', tip: 'Угол второй оси к первой: 90° → 30° → 60° → свободный (⟳: колесо — на 1°, Shift — на 10°, или тяни линию 2-й оси) → △3: три оси треугольником, параллельно сторонам (размер — круглая ручка оси) → ✳3: три оси через центр, параллельно сторонам', on: () => !!M.state.axis2, click: () => M.cycleAxis2Deg(),
              wheel: d => { if (M.state.axis2Deg !== 0) return false; M.setAxis2Free(M.state.axis2Free + d); return true; } }], key: 'axis|axis2' }); } }
      const al = out.get('axis'), ai = al ? al.findIndex(i => i.key === 'axis') + 1 : 0;   // «когда появляются кнопки — не меняй расположение старых»: Подсве.ось (есть всегда) — выше «Центр» (появляется с осью)
      al?.splice(ai, 0, { type: 'pair', col: 1,   /* «не оставляй пустот — в правую рейку»: под «Центр» */ cls: 'gz-split gz-bs gz-wl', name: 'Подсве.ось',   // «Подсве.ось — в Ось»: под «Ось | ●»
 mid: '', tip: 'Подсветка оси: области, симметричные относительно главной оси зеркала · справа — её цвет',
        parts: [{ label: '✦ Подсве.ось', tip: gi.tip, on: gi.on, click: gi.click }, ci ? { label: '●', tip: 'Цвет подсветки', on: gi.on, open: ci.open, ink: () => ci.get() } : { label: '' }], key: 'symmetry|gold' });
    }
    if (toBits.minR && toBits.minP) {   // «эти объедини в одну пополам и помести над ними Поиск осей»: «Поиск осей» — широкой кнопкой прямо над «Мин. строк | Мин. пар»
      const r = leafItem(toBits.minR), p = leafItem(toBits.minP);
      out.get('symmetry')?.push({ type: 'vpair', name: 'Минимумы', tip: 'Минимумы поиска осей: строк · пар', parts: [{ ...r, name: 'Строк', tip: 'Минимум строк в найденной фигуре' }, { ...p, name: 'Пар', tip: 'Минимум пар битов в найденной фигуре' }], key: 'symmetry|mins' });
    } else for (const c of [toBits.minR, toBits.minP]) if (c) out.get('symmetry')?.push({ ...leafItem(c), key: c.id });
    {   // «не меняй местами их»: блоки потоков всегда Свет · Снег · Вода, как бы ни включали (порядок в дереве меняется — включённые первыми)
      const fl = out.get('flow'), rank = it => it.sec ? 1 + Object.keys(FLOW_C).indexOf(it.sec) : 0;
      if (fl) { let k = 0; for (const it of fl) if (!it.sec && !it.wide && !['value', 'vpair'].includes(it.type)) it.col = it.key === 'flow|dense-axis' ? 1 : k++ % 2; }   // «пустое место справа — просто перемести её вправо»: «Плотно | От оси» — правым столбцом
      if (fl) { const s2 = fl.map((it, i) => [it, i]).sort((x, y) => rank(x[0]) - rank(y[0]) || x[1] - y[1]).map(x => x[0]); fl.splice(0, fl.length, ...s2); }
    }
    { const M = window.HubMirror, bl0 = out.get('bits');   // «кнопка авто изменения цвета каждые сколько-то секунд — ползунком»: слева вкл / выкл, ползунок — секунды (1–60)
      if (M?.setAutoPal && bl0) bl0.push({ type: 'value', name: 'Смена цвета', tip: 'Автосмена цвета · Палитры — перетекают одна в другую (ползунок — секунды на переход) · 🌈 Радуга — оригинал по радуге, отражение навстречу (полный круг — 12 × ползунок секунд)', key: 'bits|autoPal',
        head: { label: '⟳ Цвет', on: () => !!M.state.autoPal, click: () => M.setAutoPal(!M.state.autoPal) },
        tail: { label: 'Палитры', labelNow: () => M.state.autoPalMode === 'rainbow' ? '🌈 Радуга' : 'Палитры', on: () => M.state.autoPalMode === 'rainbow', click: () => M.setAutoPalMode(M.state.autoPalMode === 'rainbow' ? 'pal' : 'rainbow') },   // «чисто радугу — антирадуга и радуга»
        get: () => M.state.autoPalSec + ' с', step: d => M.setAutoPalSec(M.state.autoPalSec + Math.sign(d) * (Math.abs(d) === 2 ? 5 : 1)), zero: () => M.setAutoPalSec(10),
        frac: () => (M.state.autoPalSec - 1) / 59, setFrac: f => M.setAutoPalSec(1 + f * 59) }); }
    {   // «сюда Сброс на начальные настройки, и не оставляй пустоты в рейках»: ↺ Сброс в «Файле» (четвёртая — соты 2 × 2)
      const fl = out.get('file'), KEYS = ['zerk_hub_view', 'zerk_hub_flow', 'zerk_hub_mirror', 'zerk_hub_visible_rows', 'zerk_hub_locks', 'zerk_hub_fast_move', 'zerk_hub_exact_tilt', 'zerk_hub_all7', 'zerk_hub_bitspin'];
      if (fl) fl.push({ type: 'action', icon: '↺', name: 'Сброс', key: 'file|reset', tip: 'Сброс на начальные настройки: ось, биты, цвета, потоки, вращения, замки. Раскладка рейки и закрепы остаются. Прежние настройки сохраняются копией (zerk_hub_pered_sbrosom)',
        click: () => { if (!confirm('Сбросить хаб на начальные настройки?\n(ось, биты, цвета, потоки, вращения, замки; раскладка рейки останется; прежние — копией)')) return;
          try { const bak = {}; for (const k of KEYS) { const v = localStorage.getItem(k); if (v != null) bak[k] = v; } localStorage.setItem('zerk_hub_pered_sbrosom', JSON.stringify({ at: new Date().toISOString(), keys: bak }));
            sessionStorage.setItem('zerk_hub_reset', JSON.stringify(KEYS)); for (const k of KEYS) localStorage.removeItem(k); } catch (_) {}
          location.reload(); } });   // «Сброс не возвратил»: при уходе со страницы модули записывали настройки обратно — стирает ещё раз первый скрипт <head> по отметке
    }
    // «цвет убери, а палитру поставь самой верхней»: группы «Цвет» нет, палитра — первой в «Битах»
    const bl = out.get('bits'), pi = bl.findIndex(i => i.key === 'colour|palette'); if (pi > 0) bl.unshift(...bl.splice(pi, 1));
    {   // «Сетка — в правую рейку под Встык»: соты «Битов» — прежний порядок слева-справа, «Сетка» — правым столбцом
      const soty = it => !['value', 'vpair', 'control'].includes(it.type) && !(it.type === 'list' && !it.compact) && !it.wide;
      if (bl.some(i => i.key === 'bits|squareGrid')) { let k = 0; for (const it of bl) if (soty(it)) it.col = it.key === 'bits|squareGrid' ? 1 : k++ % 2; }
    }
    return out;
  }
  // v0.267: «из рейки тоже тянуть в ромбосетку» — ключ настоящей кнопки поля для hub-romb-grid.js (pin: — кнопка, branch: — голова ветки)
  const esc = v => window.CSS?.escape ? CSS.escape(v) : v.replace(/["\\]/g, '\\$&');
  const rgKey = it => { const k = it.key; if (!k || ['value', 'list', 'control', 'color'].includes(it.type)) return null;
    if (k === 'file') return 'id:hubPresetList';
    if (document.querySelector('[data-pin-control="' + esc(k) + '"]')) return 'pin:' + k;
    if (document.querySelector('details[data-branch="' + esc(k) + '"]')) return 'branch:' + k;
    return null; };
  function init() {
    const T = window.HubNestedGroups?.tree; if (!T || !window.ZerkGrozd) return;
    const host = document.createElement('div'); host.id = 'hubRail'; document.body.append(host);
    for (const t of ['pointerdown', 'dblclick', 'wheel', 'contextmenu']) host.addEventListener(t, e => e.stopPropagation());
    document.body.classList.add('hubRailOn');
    let rail = null, sig = '';
    function build() {
      const m = collect(T), now = [...m].map(([k, a]) => k + ':' + a.map(i => i.key + (i.type === 'list' ? i.options.length : '')).join(',')).join('|');
      if (now === sig) return false; sig = now;
      if (rail) rail.destroy();
      const gs = GROUPS.filter(([k]) => m.get(k).length).map(([id, title, color]) => ({ id, title, color, items: m.get(id) }));
      rail = window.ZerkGrozd.rail(host, { key: 'hub', groups: gs });
      // подсказка — плашкой хаба (hub-tips.js читает title)
      for (const g of gs) { const box = host.querySelector('.gz-group[data-id="' + g.id + '"]'); if (!box) continue;
        const cells = [...box.querySelectorAll('.gz-soty > .gz-hx')], wide = [...box.querySelectorAll('.gz-wide > .gz-hx')];
        const wideOf = i => ['value', 'list', 'control'].includes(i.type) && !i.compact, a = g.items.filter(i => !wideOf(i)), b = g.items.filter(wideOf);
        a.forEach((it, i) => { if (cells[i] && it.tip) cells[i].title = it.tip; const k = rgKey(it); if (cells[i] && k) cells[i].dataset.rgKey = k; }); b.forEach((it, i) => { if (wide[i] && it.tip) wide[i].title = it.tip;
          if (wide[i] && it.zero) (wide[i].querySelector('.gz-mid') || wide[i]).addEventListener('dblclick', e => { e.stopPropagation(); it.zero(); rail.refresh(); }); }); }   // «везде двойной клик по ползункам — в 0»
      return true;
    }
    const place = () => {
      const desk = matchMedia('(min-width:1101px)').matches;
      const left = desk ? Math.max(8, ...['.hub', '#hubSidebarToggle'].map(q => { const r = document.querySelector(q)?.getBoundingClientRect(); return r && r.width ? r.right : 0; })) + 10 : null;
      host.style.left = desk ? Math.round(left) + 'px' : '';
    };
    let q = 0; const tick = () => { q = 0; if (!build() && rail) rail.refresh(); place(); };
    const soon = () => { if (!q) q = requestAnimationFrame(tick); };
    new MutationObserver(soon).observe(document.getElementById('hubFieldTools'), { subtree: true, attributes: true, attributeFilter: ['aria-pressed', 'hidden', 'aria-expanded'] });
    document.addEventListener('click', () => requestAnimationFrame(soon), true);
    for (const ev of ['hubmirror', 'hubimage', 'hubmusic', 'hubflowstate', 'hublocks', 'resize']) addEventListener(ev, soon);
    // «проверь на тормоза»: hubview приходит на каждый кадр поворота / масштаба — рейку по нему обновлять не чаще 4 раз в секунду (было — каждый кадр, 14 мс)
    let viewT = 0; addEventListener('hubview', () => { if (viewT) return; viewT = setTimeout(() => { viewT = 0; soon(); }, 250); });
    setInterval(tick, 500); tick();
    requestAnimationFrame(() => document.documentElement.classList.remove('hubBoot'));   // v0.274: рейка готова — показать кнопки поля (index.html прячет их до этого)
  }
  const start = () => setTimeout(() => { if (window.HubNestedGroups?.tree) init(); else setTimeout(start, 200); }, 0);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
})();
