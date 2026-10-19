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
  const tipOf = n => txt((n.dataset.hubTip ?? n.getAttribute('title') ?? n.getAttribute('aria-label') ?? '').split(' · ПКМ')[0].split(' · Наведение')[0]);
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
  const GROUPS = [['sound', 'Звук', '#4fe3c4'], ['bits', 'Биты', '#8fd3ff'], ['symmetry', 'Симметрия', '#ffd35b'], ['axis', 'Ось', '#ff87cf'],
    ['space', 'Объём', '#a98bff'], ['motion', 'Вращение', '#ffb36b'], ['flow', 'Поток', '#5ad1ff'], ['file', 'Файл', '#7fe0a0'], ['locks', 'Замок', '#c0c8d8']];
  const HEAD = { symmetry: 'Симметрия', axis: 'Ось', space: '3D', flow: 'Пуск', locks: 'Все', 'flow|branch:light': 'Свет', 'flow|branch:snow': 'Снег', 'flow|branch:water': 'Вода' };
  const SOUND = /Семь световых|Скорость битов|Остановить биты/;
  function collect(T) {
    const out = new Map(GROUPS.map(([k]) => [k, []]));
    const add = (k, it, id) => { it.key = id; out.get(k)?.push(it); };
    const toBits = {};   // кнопки, собираемые в пары (ключ — подпись без группы)
    for (const g of T.groups) {
      if ((!out.has(g.key) && g.key !== 'colour') || !g.root) continue;   // «Цвета» в рейке нет, но из него берутся «Палитра» и пары 0 | 1
      let pat = null, glyph = null;
      const walk = (r, vis, br) => {   // br — внутри ветки Поток (Свет / Снег / Вода)
        const fc = it => (g.key === 'flow' && (it.col = br ? 2 : 0), it);
        const fa = it => (g.key === 'axis' && it.type !== 'value' && it.type !== 'list' && (it.col = 1), it);   // v0.274: «Ось» — кнопка «Ось» первым столбцом, «Завор.» и «Центр» вторым, одна под другой   // 19.10: «свет и вода во 2 столб… от каждой её список 3 столбцом при включении»
        for (const c of r.children || []) {
          if (c.children) {
            const isBr = g.key === 'flow' && /^flow\|branch:/.test(c.id);
            if (c.action) add(g.key, isBr ? { ...headItem(c, '', HEAD[c.id] || txt(c.node.querySelector('small')?.textContent)), col: 1 } : fc(headItem(c, '', HEAD[c.id] || txt(c.node.querySelector('small')?.textContent))), c.id);
            walk(c, vis && (!c.gate || !!gateOn(c)), br || isBr);
            continue;
          }
          if ((!vis && !c.free) || c.node.hidden || (c.dep && !gateOn(c.dep))) continue;
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
          if (TO_BITS.test(c.id) || IN_PAIR.test(c.id)) { toBits[c.id.replace(/^[^|]*\|/, '')] = c; continue; }
          add(SOUND.test(c.id) ? 'sound' : g.key, fa(fc(leafItem(c))), c.id);
        }
      };
      const root = g.root;
      if (root.action && g.key === 'bits') add('sound', { ...headItem(root, 'M9 6l9 6-9 6z', 'Пуск'), name: 'Пуск' }, 'bits');   // пуск / пауза битов — это звук
      else if (g.key === 'file') { const b = document.getElementById('hubPresetList');
        if (b) add('file', { type: 'toggle', icon: '▤', name: 'Шаблоны', tip: 'Открыть список шаблонов', on: () => b.getAttribute('aria-expanded') === 'true', click: () => b.click() }, 'file'); }
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
      const r = toBits['Ромбы с цифрами'], p = toBits['hubBitPacking'];
      const half = (c, d) => { const it = leafItem(c); return { label: d, tip: it.tip, on: it.on, click: it.click }; };
      if (r && p) out.get('bits').push({ type: 'pair', cls: 'gz-split gz-bs', name: 'Ромбы · встык', mid: '', tip: 'Ромбы · встык', parts: [half(r, '◇ Ромб.'), half(p, 'Встык ↔')], key: 'bits|rhombPack' });
      else for (const c of [r, p]) if (c) out.get('bits').push({ ...leafItem(c), key: c.id });
    }
    // «цвет убери, а палитру поставь самой верхней»: группы «Цвет» нет, палитра — первой в «Битах»
    const bl = out.get('bits'), pi = bl.findIndex(i => i.key === 'colour|palette'); if (pi > 0) bl.unshift(...bl.splice(pi, 1));
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
