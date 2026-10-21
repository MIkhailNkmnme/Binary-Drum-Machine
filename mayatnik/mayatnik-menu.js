/* Маятник v0.120 (меню полосой — v0.158; нижняя полоса — v0.327): page adapter for the shared ZerkGrozd rail.
   Original controls/listeners remain the source of truth. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id), source = document.querySelector('.bar');
  if (!source || !window.ZerkGrozd || !window.ZerkMenuIcons) return;
  const tip = e => e.title || e.closest('label')?.title || e.getAttribute('aria-label') || e.textContent.trim();
  const icon = (e, kind) => { e.dataset.miIcon = kind; return ZerkMenuIcons.iconFor(e); };
  const name = e => ({bPaintSave:'Сохранить',bPaintOpen:'Открыть',bRowRun:'Построчно',bFrameWindow:'Кадр',bPaintMid:'Центр',bAutoVertical:'Столбы',bDiag:'Диаг. .txt'}[e.id] || ZerkMenuIcons.shortOf(e));   // v0.174: короткие — длинные обрезались
  const button = (id, kind) => {
    const e = $(id);
    return { type: 'toggle', name: name(e), icon: icon(e, kind), tip: tip(e),
      nameNow: () => id === 'bPlay' ? (e.getAttribute('aria-pressed') === 'true' ? 'Пауза' : 'Анимация')
        : id === 'bTemplatePaint' ? e.textContent : id === 'bAnimHl'||id === 'bBlackMirror' ? e.textContent.replace(/^Зеркало:\s*/, 'Зерк. ').replace(/^Аниматрица:\s*/, 'Аним. ') : id === 'bStep' ? e.textContent.trim() : id === 'zSnap' ? 'Кратный ×' + (e.dataset.base || 2) : name(e),
      on: () => e.matches('[aria-pressed="true"],.on'), disabled: () => e.disabled,
      click: () => e.click(), src: id };
  };
  const check = (id, kind) => {
    const e = $(id);
    return { type: 'toggle', name: name(e), icon: icon(e, kind), tip: tip(e),
      nameNow: () => id === 'sym' ? (e.checked ? 'Скрыть оси' : 'Показать оси') : id === 'noband' ? ['С полосами', 'Без полос', 'До треугольника'][+e.dataset.mode || 0] : name(e),
      on: () => e.checked, disabled: () => e.disabled, click: () => e.click() };
  };
  const select = (id, kind, names) => {
    const e = $(id);
    return { type: 'list', name: name(e), icon: icon(e, kind), tip: tip(e), get: () => e.value,
      options: [...e.options].map(o => ({ v: o.value, name: names?.[o.value] || o.textContent })),
      set: v => { e.value = v; e.dispatchEvent(new Event('change', { bubbles: true })); } };
  };
  const control = id => {
    const e = $(id), node = e.closest('label') || e;
    if (id === 'speed') {
      const out = document.createElement('output'); out.htmlFor = id;
      const sync = () => { out.textContent = '×' + e.value; };
      e.addEventListener('input', sync); sync(); node.append(out);
    }
    return { type: 'control', node, tip: tip(e) };
  };
  // v0.174: «проверь кнопки, чтобы всё соответствовало логике как в хабе»: числа — ползунками (значение на дорожке),
  // связанные пары — одной кнопкой пополам, включатель с цветом — «кнопка | ●», включатель со своей скоростью — внутри ползунка
  const fire = e => { e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); };
  const num = (id, o = {}) => { const e = $(id), lo = () => +e.min || 0, hi = () => o.max ? o.max() : +e.max, inf = o.inf;
    const cur = () => e.value === '' ? null : +e.value, put = v => { if (e.disabled) return; e.value = v == null ? '' : String(Math.round(v)); fire(e); };
    const lg = o.log, a = () => Math.max(1, lo()), F = v => lg ? Math.log(v / a()) / Math.log(hi() / a()) : (v - lo()) / ((hi() - lo()) || 1);
    return { type: 'value', name: o.name, tip: o.tip || tip(e), disabled: () => e.disabled, get: () => cur() == null || (inf && cur() === 0) ? (o.all || '∞') : (o.fmt ? o.fmt(cur()) : String(cur())),
      step: d => { const v = cur(), s = Math.abs(d) === 2 ? Math.max(1, Math.round((hi() - lo()) / 20)) : 1;
        if (v == null || (inf && v === 0)) { if (d < 0) put(o.fromInf ? o.fromInf() : hi()); return; }
        const n = v + Math.sign(d) * s; if (inf && (n < lo() || (o.allAtMax && n > hi()))) return put(null); put(Math.max(lo(), Math.min(hi(), n))); },
      zero: () => put(o.zero != null ? o.zero : lo()),
      ...(o.slider === false ? {} : { frac: () => { const v = cur(); return v == null || (inf && v === 0) ? 1 : Math.max(0, Math.min(1, F(v))); },
        setFrac: f => { if (o.allAtMax && f >= .999) return put(null); put(lg ? a() * Math.pow(hi() / a(), f) : lo() + f * (hi() - lo())); } }) }; };
  const picker = src => { const c = document.createElement('input'); c.type = 'color'; c.tabIndex = -1; c.setAttribute('aria-hidden', 'true');
    Object.assign(c.style, { position: 'fixed', width: '1px', height: '1px', opacity: '0', pointerEvents: 'none', left: '0', top: '0' }); document.body.append(c);
    c.addEventListener('input', () => { src.value = c.value; fire(src); });
    return a => { const r = a.getBoundingClientRect(); c.style.left = Math.round(r.right) + 'px'; c.style.top = Math.round(r.top) + 'px'; c.value = src.value; try { c.showPicker(); } catch (_) { c.click(); } }; };
  const tgl = id => { const e = $(id); return { tip: tip(e), on: () => e.type === 'checkbox' ? e.checked : e.matches('[aria-pressed="true"],.on'), click: () => e.click(), dis: () => e.disabled }; };
  const pair = (a, b, la, lb, o = {}) => ({ type: 'pair', cls: 'gz-split gz-bs' + (o.cls ? ' ' + o.cls : ''), name: o.name || la + ' · ' + lb, mid: '', tip: o.tip || (a.tip + ' · ' + b.tip),
    ...(o.dis ? { disabled: o.dis } : {}), parts: [{ label: la, tip: a.tip, on: a.on, click: a.click, ...(a.open ? { open: a.open, ink: a.ink } : {}) }, { label: lb, tip: b.tip, on: b.on, click: b.click, ...(b.open ? { open: b.open, ink: b.ink } : {}) }] });
  const withColour = (id, colId, label) => { const t = tgl(id), src = $(colId), open = picker(src);
    return pair(t, { tip: 'Цвет', on: t.on, open, ink: () => src.value }, label, '●', { cls: 'gz-wl', name: label, tip: t.tip + ' · справа — цвет' }); };
  const both = (x, y) => () => x.dis() && y.dis();
  const rowsMax = () => Math.max(8, +$('rows').value || 512);
  const groups = [
    { id: 'build', title: 'Поле', color: '#73e4a5', open: true, items: [
      button('bBuild', 'field'), button('bThird', 'tri'), button('bFour', 'plusRing'),
      num('rows', { name: 'Строк', tip: 'Строк в поле (построение — кнопкой «Построить») · двойной щелчок — наименьшее', log: true, fmt: v => v + ' строк' }),
      num('steps', { name: 'Вершин', tip: 'Вершин (шагов маятника) · двойной щелчок — наименьшее', log: true, fmt: v => v + ' вершин' }),
      num('vrows', { name: 'Показ', tip: 'Сколько строк показывать (только показ, поле не пересчитывается) · справа до упора — все', max: rowsMax, inf: true, all: 'все строки', allAtMax: true, fromInf: rowsMax, fmt: v => 'показ ' + v, zero: 0 }),
    // v0.114: «объедини группы» — кнопки «Хорр» в «Анимации», отдельной группы «Хорр» нет; «Пара сразу» убрана («оставь только по очереди»).
    // v0.115: и «По очереди» убрана — «не нужна теперь, и так автоматом по очереди»
    // v0.247: «это объедини в одно меню» — «Поле» и «Анимация» одной группой «Поле» (кнопки анимации — после настроек поля)
      button('bRowRun', 'down'), check('third', 'tri'),   // «До N/3 — в правую рейку вверх»: вторая по счёту — правый столбец, первая строка   // «+1 / −1 вершина — объедини стрелки»: отдельной «+1 вершина» нет — это стрелки ползунка кадра
      // v0.248: «объедини 2 кнопки в одну, все»: размеры хорра (256 … 4096) — одной кнопкой-списком: выбор — построить N строк и вершин (или до N/3)
      { type: 'list', icon: icon(source.querySelector('button.pre'), 'field'), name: 'Хорр', tip: 'Сразу построить маятник: строк = N, вершин = N (или N/3 при «До N/3») · наведение — список размеров',
        options: [...source.querySelectorAll('button.pre')].map(e => ({ v: e.dataset.n, name: e.textContent })),
        get: () => { const n = String(+$('rows').value || ''); return [...source.querySelectorAll('button.pre')].some(e => e.dataset.n === n) ? n : ''; },
        set: v => source.querySelector('button.pre[data-n="' + v + '"]')?.click() },
      { ...num('speed', { name: 'Анимация', tip: 'Скорость анимации', fmt: v => '×' + v, zero: 1 }), name: 'Анимация',   // «Анимация» — включатель внутри своего ползунка скорости
        head: { label: '▶ Анимация', on: () => $('bPlay').getAttribute('aria-pressed') === 'true', click: () => $('bPlay').click() } },
      num('frameT', { name: 'Кадр, с', tip: 'Сколько длится каждый кадр анимации · шаг 0,05 с · двойной щелчок — 0 (как успевает экран)', fmt: v => v ? String(+(v * .05).toFixed(2)).replace('.', ',') + ' с / кадр' : 'кадр — без паузы', zero: 0 }),   // v0.263
      { ...num('frame', { name: 'Кадр', fmt: v => String(v), zero: 0 }), tip: 'Кадр = вершина · −N / +N — на столько вершин, какая скорость анимации (×N; в паре — пар) · бегунок: щелчок — ▶ пуск / ❚❚ пауза, тянуть — к любой · двойной щелчок — 0',
        // v0.317: «если ставлю ×2 — в стрелках кадра также пиши +2»: стрелки шагают на скорость анимации (подписи −N / +N обновляет toolSync ниже)
        step: d => { if (window.mayThirds?.on() && Math.abs(d) !== 2) { window.mayThirds.step(Math.sign(d)); return; }   // v0.318: «Трети»
          const e = $('frame'), N = Math.abs(d) === 2 ? Math.max(1, Math.round(((+e.max || 0) - (+e.min || 0)) / 20)) : Math.max(1, +$('speed').value || 1), v = Math.max(+e.min || 0, Math.min(+e.max, +e.value + Math.sign(d) * N)); if (String(v) !== e.value) { e.value = String(v); fire(e); } },
        arrows: ['−1', '+1'], thumb: { label: () => $('bPlay').getAttribute('aria-pressed') === 'true' ? '❚❚' : '▶', click: () => $('bPlay').click() } } ] },
    // v0.103: группа «Вид» целиком переехала в шапку («перемести всё в Вид сверху») — в рейке её нет
    { id: 'ochki', title: 'Очки', color: '#ffb347', items: [
      button('bOchki', 'eye'), check('ochkiInv', 'half'), check('ochkiRev', 'swap'), check('frozen', 'pin'), button('bBlackMirror', 'mirror'), button('bAnimHl', 'eye'),
      select('ochkiMode', 'line', {diag:'Диагонали',row:'Ряды'}),select('ochkiPattern','steps'),num('ochkiLength',{name:'От бит',slider:false}) ] },
    { id: 'zoom', title: 'Масштаб', color: '#7cbcff', items: [
      pair(tgl('zOut'), tgl('zIn'), '− Дальше', '+ Ближе', { name: 'Масштаб', tip: 'Отдалить · приблизить' }), button('zFit', 'corners'), button('zFitH', 'down'), button('zLock', 'pin'), button('zLines', 'line'), button('zVert', 'line'), button('zDiag', 'line'), button('zTop', 'pin'), button('zSnap', 'grid4') ] },
    { id: 'mirrors', title: 'Зеркала', color: '#ff87cf', items: [
      { type: 'toggle', icon: '⋈', name: 'Зерк. ось', tip: 'Зеркальная ось: один конец на нижней границе последней строки (тянется вдоль низа), второй — поворот · отражение поля под полем',   // v0.177
        on: () => !!window.MayMirAxis?.on, click: () => window.MayMirAxis?.toggle() },
      { type: 'toggle', icon: '▱', name: 'Контур', tip: 'Контур: внешняя граница фигуры маятника линиями в 1 px · наведи на линию — она продолжится пунктиром в обе стороны',   // v0.186
        on: () => !!window.MayContour?.on, click: () => window.MayContour?.toggle() },
      check('sym', 'axes'), check('symV', 'axes'), check('symH', 'axes'), check('symD', 'axes'), check('symBits', 'grid4'),   // v0.133: какие оси и их длина / ширина
      check('symTriangles','tri'),button('bTriangleAxes','tri'),num('symTriangleRows',{name:'Высота ≥',tip:'Высота тотемов: строк от',slider:false}),
      { type: 'vpair', name: 'Строк', tip: 'Длина оси: строк от · до', parts: [{ ...num('symRowsMin', { slider: false }), name: 'строк ≥' }, { ...num('symRowsMax', { slider: false, inf: true, fromInf: () => +$('symRowsMin').value || 2 }), name: '≤' }] },
      { type: 'vpair', name: 'Бит', tip: 'Ширина оси: бит от · до', parts: [{ ...num('symBitsMin', { slider: false }), name: 'бит ≥' }, { ...num('symBitsMax', { slider: false, inf: true, fromInf: () => +$('symBitsMin').value || 2 }), name: '≤' }] }, button('bAxisLine', 'line'), button('bAxisMirror', 'down'), button('bAxisXor', 'half'), button('bAxisLinesClear', 'cross') ] },
    { id: 'paint', title: 'Раскраска', color: '#ff9b50', items: [button('bPaintNew','reset'),withColour('bFill','fillColour','Заливка'),button('bAutoVertical','line'),button('bStolb','swap'),button('bPaintMid','line'),withColour('midOneOn','midOneColour','Центр 1'),withColour('midZeroOn','midZeroColour','Центр 0'),check('midWide','line'),button('bAutoAll','steps'),button('bFillGrow','plus'),check('fillMirror','mirror'),select('fillArea','grid4'),(()=>{const u=tgl('bFillUndo'),r=tgl('bFillRedo');return pair(u,r,'↶ Отмена','↷ Повтор',{dis:both(u,r)});})(),button('bFillClear','cross'),button('bRegions','grid4'),button('bPaintRestore','undo')] },
    { id: 'template', title: 'Шаблон', color: '#ffd35b', items: [button('bAutoTpl','grid4'),button('bTemplateTake','colour'),button('bTemplateShow','eye'),button('bTemplateClone','copy'),button('bTemplateRemove','cross'),(()=>{const a=tgl('bTemplateFlipH'),b=tgl('bTemplateFlipV');return pair(a,b,'⇆ Отраз.','⇅ Отраз.',{dis:both(a,b),tip:'Отразить шаблон ↔ · ↕'});})(),button('bMirrorLine','line'),button('bMirrorByLine','mirror'),button('bXor2','down'),(()=>{const u=tgl('bFillUndo'),r=tgl('bFillRedo');return pair(u,r,'↶ Отмена','↷ Повтор',{dis:both(u,r)});})(),(()=>{const a=tgl('bTemplateTaller'),b=tgl('bTemplateShorter');return pair(a,b,'+ Выше','− Ниже',{dis:both(a,b),tip:'Шаблон выше · ниже'});})(),button('bTemplateReturn','swap'),button('bTemplateReset','reset'),button('bTemplateTransfer','move'),button('bTemplateFall','down'),button('bTemplatePaint','colour'),check('templateTrail','half'),check('templateProportional','corners'),check('templateLock','pin'),check('templateMask','corners'),num('xorStep',{name:'Шаг k',fmt:v=>'шаг k '+v}),num('templateHeight',{name:'Высота %',log:true,fmt:v=>'высота '+v+' %',zero:100}),num('templateDown',{name:'Вниз, строк',slider:false,zero:0}),num('templateAlpha',{name:'Видимость %',fmt:v=>'видимость '+v+' %',zero:50})] },
    { id:'library',title:'Шаблоны',color:'#d9b9ff',items:[control('templateLibraryChoices'),button('bLibPage','grid4'),button('bTemplateImport','folder'),button('bTemplateExport','save')] },
    { id: 'export', title: 'Экспорт', color: '#ffd166', items: [
      button('bPaintSave','save'),button('bPaintOpen','load'),button('bFrameWindow','corners'),
      button('bPng', 'image'), button('bRec', 'record'), button('bGif','record'), button('bTxt', 'save'), button('bDiag', 'steps') ] }
  ];
  { const g0 = groups.find(x => x.id === 'build'); g0.items = g0.items.filter(it => it.name !== 'Хорр' && it.name !== 'Анимация' && it.name !== 'Кадр, с'); const fr = g0.items.find(it => it.name === 'Кадр'); if (fr) delete fr.thumb; }   // v0.339: бегунок кадра — линия, плей — своей кнопкой в середине   // v0.332: «Хорр» — в нижней полосе   // v0.395: «удали дубли» — «Анимация» и «Кадр, с» есть в нижней полосе (×N | время)
  const rail = ZerkGrozd.rail($('mayatnikRail'), { key: 'mayatnik', groups });
  // v0.255: «тут тоже — если правой, то в ромб»: правый щелчок по шапке группы рейки — она сворачивается в ромб со значком, ещё раз — обратно
  // (щелчок по ромбу открывает группу, как шапка); свёрнутые — в памяти браузера (mayatnik-rail-mini)
  { const MINI = 'mayatnik-rail-mini', ICO = { 'Поле': '▦', 'Очки': '◎', 'Масштаб': '⤢', 'Зеркала': '⋈', 'Раскраска': '✎', 'Шаблон': '▣', 'Шаблоны': '▤', 'Экспорт': '⇩' };
    let minis = new Set(); try { minis = new Set(JSON.parse(localStorage.getItem(MINI) || '[]')); } catch (_) {}
    for (const box of rail.el.querySelectorAll('.gz-group')) { const head = box.querySelector(':scope > .gz-head'), nm = head?.querySelector('.gz-nm'); if (!nm) continue;
      const k = nm.textContent.trim(), ic = document.createElement('span'); ic.className = 'gz-mico'; ic.textContent = ICO[k] || [...k][0] || '◆'; head.prepend(ic);
      const sync = () => { box.classList.toggle('gz-mini', minis.has(k)); head.setAttribute('aria-label', k); };
      sync(); head.addEventListener('contextmenu', e => { e.preventDefault(); e.stopPropagation(); if (minis.has(k)) minis.delete(k); else minis.add(k);
        try { localStorage.setItem(MINI, JSON.stringify([...minis])); } catch (_) {} sync(); }); } }
  // v0.167: подсказки кнопок рейки — в title (их показывает mayatnik-tips.js рядом с кнопкой через 4 с)
  for (const g of groups) { const box = rail.el.querySelector('.gz-group[data-id="' + g.id + '"]'); if (!box) continue;
    const wide = t => ['value', 'list', 'control', 'vpair'].includes(t), a = g.items.filter(i => !wide(i.type)), b = g.items.filter(i => wide(i.type));
    const ca = box.querySelectorAll('.gz-soty > .gz-hx'), cb = box.querySelectorAll('.gz-wide > .gz-hx');
    a.forEach((it, i) => { if (ca[i] && (it.tip || it.name)) ca[i].title = it.tip || it.name; }); b.forEach((it, i) => { if (cb[i] && it.type !== 'control' && it.type !== 'vpair' && (it.tip || it.name)) cb[i].title = it.tip || it.name; }); }
  // v0.327: «внизу сделай полосу для меню и в центр перемести» — полоса во всю ширину под полем, в её центре — ползунок «кадр» из «Поля»
  const bbCells = {};   // v0.355: ползунки «Поля», что уходят в список «Хорр»
  { const bar = document.createElement('div'); bar.id = 'mayBottomBar'; document.body.append(bar);
    const g = groups.find(x => x.id === 'build'), box = rail.el.querySelector('.gz-group[data-id="build"]'), i = g.items.filter(it => ['value', 'list', 'control', 'vpair'].includes(it.type)).findIndex(it => it.name === 'Кадр');
    { const wc = [...(box?.querySelectorAll('.gz-wide > .gz-hx') || [])], wi = g.items.filter(it => ['value', 'list', 'control', 'vpair'].includes(it.type)); for (const nm of ['Строк', 'Вершин', 'Показ']) { const j = wi.findIndex(it => it.name === nm); if (wc[j]) bbCells[nm] = wc[j]; } }   // v0.355
    // v0.358: «эти тоже» — кнопки «Поля» (Построить, N/3, 4N, Построчно, До N/3) — в список «Хорр»
    bbCells.btns = [...(box?.querySelectorAll('.gz-soty > .gz-hx') || [])].filter(c => ['Построить', 'N/3', '4N', 'Построчно', 'До N/3'].includes(c.querySelector('.gz-nm')?.textContent.trim()));
    const cell = box?.querySelectorAll('.gz-wide > .gz-hx')[i]; if (cell) { bar.style.setProperty('--c', g.color); bar.append(cell); } }
  // v0.330: «помести туда Сброс — в 0 с очисткой от всего»: свёртки, окраска, зеркала, выделение шаблонов — выкл, затем «Очистить» (поле с кадра 0)
  { const b = document.createElement('button'); b.type = 'button'; b.id = 'mayBbReset'; b.className = 'gz-hx'; b.innerHTML = '<span>✖ Сброс</span>';
    b.title = 'Сброс: кадр 0 и очистка от всего — свёртки, вся краска и живая окраска, все зеркала, выделение шаблонов, поле заново';
    b.onclick = () => { const C = window.mayClear; if (C) { C.paintOff(); C.mirrorsOff(); C.selOff(); } $('bReset').click(); rail.refresh(); placeTools(); };
    // v0.335: «Сброс прямо в ползунке рядом с плеем». v0.339: «ширину в 2 раза меньше, плей всегда по центру, бегунок текущего кадра — вертикальная линия
    // в 2 px, за неё перемещать, и поверх всех»: ▶ / ❚❚ и «✖» стоят в середине дорожки, линия-бегунок (grozd .gz-th без thumb) — над ними
    const cell = $('mayBottomBar').querySelector('.gz-sl'), mid = cell?.querySelector('.gz-mid'), th = mid?.querySelector('.gz-th');
    if (mid) { b.className = 'may-bb-rs'; b.removeAttribute('id'); b.textContent = '✖'; b.addEventListener('pointerdown', e => e.stopPropagation()); mid.append(b);
      const pl = document.createElement('button'); pl.type = 'button'; pl.className = 'may-bb-play'; pl.addEventListener('pointerdown', e => e.stopPropagation());
      const P = $('bPlay'), plSync = () => { const on = P.getAttribute('aria-pressed') === 'true'; pl.textContent = on ? '❚❚' : '▶'; pl.title = on ? 'Пауза' : 'Анимация: пуск'; };
      pl.onclick = () => { P.click(); plSync(); rail.refresh(); }; new MutationObserver(plSync).observe(P, { attributes: true, attributeFilter: ['aria-pressed'] }); plSync(); mid.append(pl);
      // подпись «кадр N» — в 6 px от линии (слева, нет места — справа)
      // v0.348: «не видно номера кадра» — подпись обходит середину (▶ и «✖»): слева от линии, нет места или налезает — справа, иначе — сразу за краем ▶ / ✖ со стороны линии
      // v0.395: «плей по центру оси»: ▶ и «✖» — на оси якоря (window.mayAxisX), прижаты к краям дорожки; страница зовёт при прокрутке и масштабе (window.mayPlayPlace)
      // v0.399: «плей по середине ползунка, и ползунок по середине — на оси»: ▶ / ✖ — снова в середине дорожки; на ось ставится середина ползунка —
      // сдвигом всей связки «×N | ползунок | время | Хорр» (--axdx у полосы), не дальше краёв полосы
      const pcx = () => mid.clientWidth / 2, playPlace = () => { const bar = $('mayBottomBar'), ax = window.mayAxisX?.(); if (!bar) return;
        const cur = parseFloat(bar.style.getPropertyValue('--axdx')) || 0, C = cell.getBoundingClientRect(), BR = bar.getBoundingClientRect(), c0 = C.left + C.width / 2 - cur;
        const grp = [...bar.children].filter(e => e.matches('.may-bb-half, .gz-sl, #mayBbHorr')).map(e => e.getBoundingClientRect()), L0 = Math.min(...grp.map(r => r.left)) - cur, R0 = Math.max(...grp.map(r => r.right)) - cur;
        let dx = Number.isFinite(ax) ? ax - c0 : 0; dx = Math.max(BR.left + 4 - L0, Math.min(BR.right - 4 - R0, dx)); const v = Math.round(dx) + 'px'; if (bar.style.getPropertyValue('--axdx') !== v) bar.style.setProperty('--axdx', v); };
      window.mayPlayPlace = playPlace;
      const vl = mid.querySelector('.gz-vl'), side = () => { if (!vl) return; const x = th.offsetLeft, W = mid.clientWidth, lw = vl.offsetWidth, c0 = pcx(), zL = c0 - 21, zR = c0 + 47;
        const ok = p => p >= 0 && p + lw <= W && (p + lw <= zL || p >= zR); let p = x - 6 - lw;
        if (!ok(p)) p = x + 6; if (!ok(p)) p = x < c0 ? zL - 4 - lw : zR + 4; if (!ok(p)) p = x < c0 ? zR + 4 : zL - 4 - lw;
        const v = Math.round(Math.max(0, Math.min(W - lw, p))) + 'px'; if (vl.style.left !== v) vl.style.left = v; };
      new MutationObserver(side).observe(mid, { attributes: true, attributeFilter: ['style'] }); addEventListener('resize', () => { playPlace(); side(); }); playPlace(); side(); } }
  // v0.332: «это в нижнюю полоску также, выпадающим наверх списком, но объедини по 2 в кнопку»: «Хорр N» справа в полосе; щелчок — над ней
  // столбец кнопок по два размера (256 | 512, 1024 | 2024, 4096); щелчок по половине — построить этот размер (как кнопки «хорр» панели)
  { const pres = [...source.querySelectorAll('button.pre')], wrapH = document.createElement('div'); wrapH.id = 'mayBbHorr';
    const b = document.createElement('button'); b.type = 'button'; b.className = 'gz-hx'; b.innerHTML = '<span>▦ Хорр <b></b> ▴</span>';
    b.title = 'Сразу построить маятник: строк = N, вершин = N (или N/3 при «До N/3») · щелчок — список размеров';
    const pop = document.createElement('div'); pop.className = 'may-hp-pop'; pop.hidden = true;
    const cur = () => String(+$('rows').value || '');
    // v0.380: «один стандарт кнопок» — пары размеров и «N/3 | 4N» — стандартная пара grozd (gz-pair gz-split, как «✛ 2 ось | ∆3» в Хабе):
    // одна кнопка, косая черта посередине, у каждой половины своя кайма; включённая половина — кайма цветом (--gz-rI), прочая — 30 %
    const gzPair = (parts) => { const row = document.createElement('div'); row.className = 'gz-hx gz-pair gz-split';
      const hs = parts.map((pt, j) => { const h = document.createElement('span'); h.className = 'gz-half gz-h' + j; h.textContent = pt.label; h.title = pt.tip || ''; Object.assign(h.dataset, pt.data || {});
        h.onclick = ev => { ev.stopPropagation(); pt.click(); }; return h; });
      const pm = document.createElement('span'); pm.className = 'gz-pm'; row.append(hs[0], pm, ...hs.slice(1));
      row.gzSync = () => parts.forEach((pt, j) => { const on = !!pt.on(); hs[j].classList.toggle('gz-on', on); row.style.setProperty('--gz-r' + j, on ? 'var(--c)' : 'color-mix(in srgb,var(--c) 30%,#000)'); });
      return row; };
    const sizeRows = [];
    for (let i = 0; i < pres.length; i += 2) { const row = gzPair(pres.slice(i, i + 2).map(e => ({ label: e.textContent, tip: e.title || ('Построить ' + e.textContent), data: { n: e.dataset.n },
        on: () => cur() === e.dataset.n, click: () => { pop.hidden = true; e.click(); sync(); } }))); sizeRows.push(row); pop.append(row); }
    const sync = () => { const n = cur(); b.querySelector('b').textContent = n;   // v0.374: число строк — всегда, и выставленное ползунком «Строк»
      b.classList.toggle('on', !pop.hidden);
      for (const r of sizeRows) r.gzSync();   // v0.380
      };   // v0.379: «или-или — обводка одной кнопки, а не двух сразу»: каймой — только выбранная половина (CSS .may-hp-h.on), не вся кнопка   // v0.374: только кнопки размеров (не «N/3 | 4N»)
    // v0.334: «фон и обводка как у кнопок, зубцами»: рамка списка — шестиугольники в столбик (шаг = кнопка + зазор); v0.335: «фон не шире кнопок, без границ» — без каймы, по ширине кнопок
    const hpFrame = () => { if (pop.hidden) return; pop.style.height = ''; const w = pop.offsetWidth, row = pop.querySelector('.gz-pair, .may-hp-sl, .may-hp-2'), P = row ? row.offsetHeight + 4 : 28, n = Math.max(1, Math.round(pop.offsetHeight / P)), h = n * P, D = 12;
      pop.style.height = h + 'px'; const pt = [[D, 0], [w - D, 0]]; for (let k = 0; k < n; k++) pt.push([w, k * P + P / 2], [w - D, (k + 1) * P]);
      pt.push([D, h]); for (let k = n - 1; k >= 0; k--) pt.push([0, k * P + P / 2], [D, k * P]);
      const d = pt.map(q => q.join(',')).join(' ');
      pop.style.clipPath = 'polygon(' + pt.map(q => q[0] + 'px ' + q[1] + 'px').join(',') + ')';
      pop.style.backgroundImage = 'url("data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><polygon points="${d}" fill="#0d1119" fill-opacity=".97" stroke="none"/></svg>`) + '")'; };
    b.onclick = ev => { ev.stopPropagation(); pop.hidden = !pop.hidden; sync(); hpFrame(); };
    document.addEventListener('pointerdown', ev => { if (!pop.hidden && !wrapH.contains(ev.target)) { pop.hidden = true; sync(); } });
    addEventListener('keydown', ev => { if (ev.key === 'Escape' && !pop.hidden) { pop.hidden = true; sync(); } });
    $('rows').addEventListener('change', sync); $('rows').addEventListener('input', sync); for (const e of pres) e.addEventListener('click', () => setTimeout(sync));
    // v0.355: «эти сюда сверху» — «Строк», «Вершин», «Показ» из рейки «Поле» — наверху списка «Хорр»
    // v0.372: «ползунок с вершинами удали» — вершин ставит выбор «N/3 | 4N» (или N)
    bbCells['Вершин']?.remove();
    const top = ['Строк', 'Показ'].map(n => bbCells[n]).filter(Boolean); if (top.length) { for (const c of top) c.classList.add('may-hp-sl'); pop.prepend(...top); }
    // v0.372: «убери До N/3 — там дубль; 2 кнопки в одну N/3 и 4N, какая выбрана — по той и строй»: «До N/3», «N/3», «4N» из сот убраны,
    // вместо них — одна кнопка из двух половин; выбранная горит, щелчок по горящей — снова N вершин; выбор — для кнопок размеров и «Построить»
    const nm = c => c.querySelector('.gz-nm')?.textContent.trim(); for (const c of (bbCells.btns || [])) if (['N/3', '4N', 'До N/3'].includes(nm(c))) c.remove();
    bbCells.btns = (bbCells.btns || []).filter(c => c.isConnected);
    { const V = () => window.mayVMode, pickV = v => { V()?.pick(v); vsync(); rail.refresh(); placeTools(); };
      const vm = gzPair([{ label: 'N/3', data: { v: 'n3' }, on: () => (V()?.get() || '') === 'n3', click: () => pickV('n3') }, { label: '4N', data: { v: '4n' }, on: () => (V()?.get() || '') === '4n', click: () => pickV('4n') }]);
      vm.classList.add('may-hp-vm');
      function vsync() { vm.gzSync(); const m = V()?.get() || ''; for (const h of vm.querySelectorAll('.gz-half')) {
        h.title = (h.dataset.v === 'n3' ? 'Вершин = N/3 с запасом — до гибели последней дыры' : 'Вершин = 4N — дальше новые конусы не достают до треугольника якоря') + ' · кнопки размеров строят так · щелчок — выбрать и построить, по горящей — снова N вершин'; } };
      queueMicrotask(() => toolSync.push(vsync)); vsync(); pop.prepend(vm); }   // v0.375: toolSync объявлен ниже — при загрузке TDZ ронял всё меню (v0.372–v0.374)
    // v0.391: «по 2 в одну кнопку шириной по стандарту»: «Построить | Построчно» — одна пара (как «N/3 | 4N»); ячейки сот из рейки убраны
    { const bt = bbCells.btns || [], sot = bt[0]?.parentElement; for (const c of bt) c.remove(); if (sot && !sot.querySelector('.gz-hx')) sot.style.height = '0';
      const bB = $('bBuild'), bR = $('bRowRun');
      const bp = gzPair([{ label: 'Постро.', tip: bB?.title || 'Построить', on: () => false, click: () => { bB?.click(); rail.refresh(); } },
        { label: 'По стрк.', tip: bR?.title || 'Построчно', on: () => bR?.getAttribute('aria-pressed') === 'true', click: () => { bR?.click(); bp.gzSync(); rail.refresh(); } }]);
      bp.gzSync(); if (bR) new MutationObserver(() => bp.gzSync()).observe(bR, { attributes: true, attributeFilter: ['aria-pressed'] }); pop.prepend(bp); }
    // v0.397: «оставь две кнопки — ЛевПрав, ПравЛев — и в нижнее меню, в группу Хорр»: ход одной парой; выбор — и сразу построить
    { const M = $('mode'), go = m => { if (!M) return; M.value = m; M.dispatchEvent(new Event('change', { bubbles: true })); $('bBuild')?.click(); mp.gzSync(); rail.refresh(); };
      const mp = gzPair([{ label: 'ЛевПрав', tip: 'Ход лево-право: якорь, −1, +1, −2, +2… · щелчок — выбрать и построить', on: () => M?.value !== 'pendR', click: () => go('pend') },
        { label: 'ПравЛев', tip: 'Ход право-лево: якорь, +1, −1, +2, −2… · щелчок — выбрать и построить', on: () => M?.value === 'pendR', click: () => go('pendR') }]);
      mp.gzSync(); b.addEventListener('click', () => mp.gzSync()); pop.prepend(mp); }
    wrapH.append(pop, b); $('mayBottomBar').append(wrapH); sync(); }
  // v0.337: «Анимацию вниз копируй, но только число ×1…×10 — по нажатию меняется, пол-кнопки; вторая половина — время 0 … 1/20 … до 1 с, тоже по нажатию»:
  // слева в полосе одна кнопка из двух половин: скорость (щелчок +1, после ×10 — ×1; правый — назад) | длительность кадра (0, 1/20, 1/10, 1/5, 1/2, 1 с по кругу)
  { const sp = $('speed'), ft = $('frameT'), T = [0, 1, 2, 4, 10, 20], TN = ['0 с', '1/20 с', '1/10 с', '1/5 с', '1/2 с', '1 с'];
    // v0.340: «по обе стороны от бегунка раздели»: ×N — полкнопкой слева от ползунка кадра, время — справа
    const half = k => { const e = document.createElement('button'); e.type = 'button'; e.className = 'gz-hx may-bb-half'; e.dataset.k = k; e.innerHTML = '<span class="may-hp-h"></span>'; return e; };
    const bs = half('sp'), bf = half('ft'), hs = bs.firstChild, hf = bf.firstChild;
    hs.title = 'Скорость анимации: вершин за кадр · щелчок — +1 (после ×10 — ×1), правый — −1'; hf.title = 'Сколько длится кадр анимации · щелчок — следующее (0 · 1/20 · 1/10 · 1/5 · 1/2 · 1 с), правый — предыдущее';
    const sync = () => { hs.textContent = '×' + (+sp.value || 1); const v = +ft.value || 0, i = T.indexOf(v); hf.textContent = i >= 0 ? TN[i] : String(+(v * .05).toFixed(2)).replace('.', ',') + ' с'; };
    const spSet = d => { const v = +sp.value || 1; sp.value = String(d > 0 ? (v >= 10 ? 1 : v + 1) : (v <= 1 ? 10 : Math.min(10, v - 1))); fire(sp); sync(); rail.refresh(); };
    const ftSet = d => { const v = +ft.value || 0; let i; if (d > 0) { i = T.findIndex(t => t > v); if (i < 0) i = 0; } else { i = T.length - 1; while (i >= 0 && T[i] >= v) i--; if (i < 0) i = T.length - 1; }
      ft.value = String(T[i]); fire(ft); sync(); rail.refresh(); };
    bs.onclick = () => spSet(1); bs.oncontextmenu = e => { e.preventDefault(); spSet(-1); };
    bf.onclick = () => ftSet(1); bf.oncontextmenu = e => { e.preventDefault(); ftSet(-1); };
    sp.addEventListener('input', sync); ft.addEventListener('input', sync); const sl = $('mayBottomBar').querySelector(':scope > .gz-sl');
    if (sl) { sl.before(bs); sl.after(bf); } else $('mayBottomBar').append(bs, bf); sync();
    const hr = $('mayBbHorr'); if (hr) bf.after(hr); }   // v0.350: «Хорр» — сразу справа от ползунка (за временем кадра)
  const status = $('mayatnikStatus');
  // v0.051: строки «Картинка…» и «Кадр…» — в подвал, к остальным надписям.
  status.append($('imageStats'));
  for (const id of ['stat', 'zoomV', 'konusInfo', 'symInfo', 'triangleInfo', 'fillInfo','paintCacheInfo','templateInfo','templateActions']) status.append($(id));
  for(const [id,kind]of [['bTemplateQuickSave','save'],['bTemplateColour','colour']]){
    const e=$(id),mark=document.createElement('i');mark.className='gz-ic';mark.style.backgroundImage=icon(e,kind);mark.style.backgroundSize='contain';mark.style.backgroundRepeat='no-repeat';e.querySelector('span').prepend(mark);
  }
  // v0.071: «Шаблоны» — справа, у правого края поля.
  const railR=document.createElement('div');railR.id='mayatnikRailR';$('mayatnikRail').after(railR);const railRIn=document.createElement('div');railRIn.className='gz-rail';railR.append(railRIn);
  { const g=[...rail.el.querySelectorAll('.gz-group')].find(g=>g.querySelector('.gz-head .gz-nm')?.textContent.trim()==='Шаблоны'); if(g) railRIn.append(g); }
  // v0.074: шапку «Шаблонов» не тянуть — перетаскивание шапки переставляет группы в левой рейке и уносило группу туда.
  railR.addEventListener('pointerdown',e=>{if(e.target.closest('.gz-head'))e.stopPropagation();},true);
  railR.addEventListener('click',e=>{if(e.target.closest('.gz-head')){e.preventDefault();e.stopImmediatePropagation();}},true);
  for(const head of railR.querySelectorAll('.gz-head')){head.tabIndex=-1;head.setAttribute('aria-expanded','true');head.title='Шаблоны — список всегда открыт';}
  const sidebar=document.createElement('aside');sidebar.id='mayatnikSidebar';$('mayatnikRail').before(sidebar);sidebar.append($('mayatnikRail'));
  source.hidden = true;
  document.body.classList.add('mayatnik-menu-ready');
  document.documentElement.classList.remove('may-boot');   // v0.162: меню собрано — показать
  const help = $('mayHelp'), menu = $('mayMenu');
  const about = $('mayAboutDialog');
  $('mayAbout').onclick = () => about.showModal();
  about.addEventListener('click', e => { if (e.target === about) {
    const r = about.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) about.close();
  } });
  help.onclick = () => {
    const on = help.getAttribute('aria-pressed') !== 'true';
    help.setAttribute('aria-pressed', String(on)); document.documentElement.classList.toggle('gz-help', on);
    if (!on) $('tip').style.display = 'none';
  };
  menu.onclick = () => {
    const closed = document.body.classList.toggle('mayatnik-menu-closed');
    menu.setAttribute('aria-expanded', String(!closed)); dispatchEvent(new Event('resize'));
  };
  // v0.037: неактивные кнопки в рейке не показываются (как на других страницах); соты пересобираются без них.
  const relayout = () => { for (const soty of [...rail.el.querySelectorAll('.gz-soty'), ...railR.querySelectorAll('.gz-soty'), ...tools.querySelectorAll(':scope > .gz-group .gz-soty')]) {   // v0.232: и группы рейки, поднятые в шапку
    const cells = [...soty.children], shown = cells.filter(b => !b.classList.contains('gz-off-dis'));
    const top = tools.contains(soty), key = (top ? 'u' : '') + shown.length + ':' + cells.map(b => +shown.includes(b)).join(''); if (soty.dataset.k === key) continue; soty.dataset.k = key;   // top — в шапке (v0.232)
    cells.forEach(b => { b.style.display = shown.includes(b) ? '' : 'none'; });
    // v0.072: справа («Шаблоны») кнопки в одну строку, без сдвига сот.
    const flat = railR.contains(soty), st = flat || top ? 0 : 13.5;   // v0.232: в шапке — столбцы ровные, правый не лезет вверх на соседей полосы
    if (flat) { cells.forEach(b => { b.style.left = b.style.top = ''; }); soty.style.height = ''; soty.style.display = shown.length ? '' : 'none'; continue; }   // v0.075: справа — в строку с шапкой
    shown.forEach((b, k) => { const col = k % 2, row = k >> 1; b.style.left = (col * 112) + 'px'; b.style.top = (row * 27 - col * st) + 'px'; });   // v0.181: «не оставляй пустоты справа вверху» — правый столбец на полкнопки ВЫШЕ (в выемку у заголовка), как в хабе
    soty.style.height = shown.length ? (Math.ceil(shown.length / 2) * 27 - 3) + 'px' : '0';
    soty.style.display = shown.length ? '' : 'none'; } };
  // v0.042: значки раскраски прямо на холсте, в левом верхнем углу; сдвиг и масштаб поля их не двигают.
  const tools = document.createElement('div'); tools.id = 'paintTools'; tools.setAttribute('aria-label', 'Раскраска на холсте');
  const toolSync = [];
  // v0.054: значки разбиты на группы с промежутками, над каждой группой — короткая подпись.
  const groupOf = {}; const ptGroup = name => { const g = document.createElement('div'); g.className = 'pt-g';
    const l = document.createElement('span'); l.className = 'pt-l'; l.textContent = name; const row = document.createElement('div'); row.className = 'pt-r';
    g.append(l, row); tools.append(g); return row; };
  const gPaint = ptGroup('Краска'), gEdit = ptGroup('Очистка'), gAxis = ptGroup('Оси'),gHistory=ptGroup('Правка'), gMeet = ptGroup('Точка Ось');   // v0.318: «отдельная кнопка Точка Ось меню — туда все её кнопки и заливки»
  gHistory.parentElement.classList.add('pt-history');
  for (const id of ['bFill','bAutoVertical','bStolb','bPaintMid','bAutoAll','bFillGrow','fillMirror']) groupOf[id] = gPaint;
  for (const id of ['bPaintMeet','bPaintAxis','bThirds','bTriTop']) groupOf[id] = gMeet;
  for (const id of ['bFillUndo','bFillRedo']) groupOf[id] = gHistory;
  for (const id of ['bFillClear','bPaintNew','bReset']) groupOf[id] = gEdit;   // v0.168: «Очистить всё поле» — из рейки «Поле» сюда
  for (const id of ['sym','symV','symH','symD','symTriangles','bTriangleAxes','bFrameWindow','bAxisLine','bAxisMirror','bAxisXor','bAxisLinesClear','bRuler']) groupOf[id] = gAxis;
  for (const [id, kind] of [['bFill','colour'],['bAutoVertical','line'],['bStolb','swap'],['bPaintMid','line'],['bAutoAll','steps'],['bPaintMeet','axes'],['bPaintAxis','axes'],['bThirds','steps'],['bTriTop','tri'],['bFillGrow','plus'],['fillMirror','mirror'],['bFillUndo','undo'],['bFillRedo','forward'],['bFillClear','cross'],['bPaintNew','reset'],['bReset','cross'],['sym','axes'],['symV','axes'],['symH','axes'],['symD','axes'],['symTriangles','tri'],['bTriangleAxes','tri'],['bFrameWindow','corners'],['bAxisLine','select'],['bAxisMirror','down'],['bAxisXor','half'],['bAxisLinesClear','cross'],['bRuler','line']]) {
    const e = $(id), b = document.createElement('button'); b.type = 'button'; b.className = 'pt-b'; b.dataset.n = id;
    const mark = document.createElement('i'); mark.style.backgroundImage = icon(e, kind); b.append(mark);
    b.onclick = () => e.click();
    // v0.050: правый клик по нажатому значку — выключить его режим.
    b.oncontextmenu = ev => { ev.preventDefault(); if (e.matches('[aria-pressed="true"]') || (e.type === 'checkbox' && e.checked)) e.click(); };
    toolSync.push(() => { b.title = tip(e) + (id === 'bAutoVertical' || id === 'bPaintMeet' || id === 'bPaintAxis' || id === 'bTriTop' ? ' · сейчас: ' + e.textContent : ''); b.disabled = e.disabled;
      if (id === 'bPaintMeet' || id === 'bPaintAxis' || id === 'bTriTop') { const nm = b.querySelector('.gz-nm'); if (nm && nm.textContent !== e.dataset.miShort) nm.textContent = e.dataset.miShort; }   // v0.315: «Точка 1 / 0»
      b.classList.toggle('on', e.type === 'checkbox' ? e.checked : e.matches('[aria-pressed="true"]')); });
    // v0.121: «Симметрия» — включить и выключить оси симметрии (выключает и выбор оси с конусом, как «Скрыть оси»).
    if (id === 'sym') { const hide = $('mayHideAxes'); b.onclick = b.oncontextmenu = ev => { ev?.preventDefault?.(); if (!hide.hidden || e.checked) hide.click(); else if (ev.type === 'click') e.click(); };
      toolSync.push(() => { b.title = !hide.hidden || e.checked ? 'Оси симметрии видны · щелчок — скрыть' : 'Показать оси симметрии'; b.classList.toggle('on', !hide.hidden || e.checked); }); }
    groupOf[id].append(b);
  }
  // v0.176: «верхняя полоса — по логике хаба»: цвет — ● внутри своей кнопки (щелчок по ● — палитра), сырых полей нет
  const dotIn = (b, srcId, title) => { const src = $(srcId), open = picker(src), d = document.createElement('span'); d.className = 'pt-dot'; d.title = title || tip(src) || 'Цвет';
    d.addEventListener('click', ev => { ev.stopPropagation(); open(d); }); toolSync.push(() => { d.style.background = src.value; }); b.append(d); return d; };
  const ptBtn = (n, kind, src, onclick) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'pt-b'; b.dataset.n = n;
    const mark = document.createElement('i'); mark.style.backgroundImage = icon(src, kind); b.append(mark); b.onclick = onclick; return b; };
  { const G = $('bFillGrow'), bg = ptBtn('meetGrow', 'plus', G, () => G.click());   // v0.318: в «Точке Оси» — свои «Рост» (та же кнопка) и цвет заливки
    toolSync.push(() => { bg.title = tip(G); bg.classList.toggle('on', G.getAttribute('aria-pressed') === 'true'); }); gMeet.append(bg);
    const bc = ptBtn('meetCol', 'colour', $('fillColour'), null), dc = dotIn(bc, 'fillColour', 'Цвет заливки «Точки» · щелчок — палитра'); bc.onclick = () => dc.click(); bc.title = 'Цвет заливки · щелчок — палитра'; gMeet.append(bc); }
  dotIn(gPaint.querySelector('[data-n="bFill"]'), 'fillColour', 'Цвет заливки · щелчок — палитра');
  const colour = document.createElement('input'); colour.type = 'color'; colour.className = 'pt-c'; colour.title = 'Цвет заливки';
  colour.oninput = () => { $('fillColour').value = colour.value; $('fillColour').dispatchEvent(new Event('input', { bubbles: true })); $('fillColour').dispatchEvent(new Event('change', { bubbles: true })); };
  toolSync.push(() => { if (document.activeElement !== colour) colour.value = $('fillColour').value; });
  // отдельного поля «Цвет» больше нет — ● в «Заливке»
  // v0.135: настройки «Центра» — 1 и 0 со своими цветами (оба — красит оба), ⇔ — 2-й уровень (расширенная ось)
  for (const [id, col, title] of [['midOneOn', 'midOneColour', 'Центр: заливать области 1'], ['midZeroOn', 'midZeroColour', 'Центр: заливать области 0 (вместе с 1 — оба)'], ['midWide', null, '2-й уровень — расширенная ось: пары равных битов слева и справа от центра, прозрачнее']]) {
    const e = $(id), b = ptBtn(id, col ? 'line' : 'swap', e, () => e.click()); b.title = title + (col ? ' · ● — цвет' : '');
    if (col) dotIn(b, col); toolSync.push(() => b.classList.toggle('on', e.checked)); gPaint.append(b); }
  {const source=$('fillArea'),b=document.createElement('button');b.type='button';b.className='pt-b';b.dataset.n='fillArea';
    const mark=document.createElement('i');mark.style.backgroundImage=icon(source,'grid4');b.append(mark);gPaint.append(b);
    b.onclick=()=>{source.selectedIndex=(source.selectedIndex+1)%source.options.length;source.dispatchEvent(new Event('change',{bubbles:true}));};
    toolSync.push(()=>{b.title='Область заливки: '+source.selectedOptions[0].textContent+' · щелчок — следующий режим';const label=b.querySelector('.gz-nm');if(label)label.textContent=source.selectedOptions[0].textContent;});}
  // v0.044: виды поля — значками на холсте, рядом с раскраской.
  const gView = ptGroup('Вид'), gMir = ptGroup('Зеркала');   // v0.238: «раздели на 2 вкладки — Вид и Зеркала»: правый столбец «Вида» — своей группой
  {const e=$('bFoldCompare'),b=document.createElement('button');b.type='button';b.className='pt-b';b.dataset.n='bFoldCompare';b.title=e.title;
    const mark=document.createElement('i');mark.style.backgroundImage=icon(e,'swap');b.append(mark);b.onclick=()=>e.click();gView.append(b);
    toolSync.push(()=>b.classList.toggle('on',e.getAttribute('aria-pressed')==='true'));}
  {const e=$('bFoldHorizontal'),b=document.createElement('button');b.type='button';b.className='pt-b';b.dataset.n='bFoldHorizontal';b.title=e.title;
    const mark=document.createElement('i');mark.style.backgroundImage=icon(e,'swap');b.append(mark);b.onclick=()=>e.click();gView.append(b);
    toolSync.push(()=>b.classList.toggle('on',e.getAttribute('aria-pressed')==='true'));}
  // v0.125: «СвёрткаВерт» — рядом с горизонтальной
  {const e=$('bFoldVertical'),b=document.createElement('button');b.type='button';b.className='pt-b';b.dataset.n='bFoldVertical';b.title=e.title;
    const mark=document.createElement('i');mark.style.backgroundImage=icon(e,'down');b.append(mark);b.onclick=()=>e.click();gView.append(b);
    toolSync.push(()=>b.classList.toggle('on',e.getAttribute('aria-pressed')==='true'));}
  const VIEW_SHORT = { col: 'Перекрытия', bits: 'Биты', digitsOnly: 'Цифры', romb0: 'Ромбы чёт', romb1: 'Ромбы нечёт', romb2: 'Ромбы оба' };   // v0.329: на кнопке — коротко, в подсказке и списке — полностью
  const viewIcons = { col: ['colour', 'Цвета перекрытий'], bits: ['grid4', 'Только биты'], digits: ['steps', 'Цифры 0/1'], digitsOnly: ['steps', 'Только цифры'], romb0: ['square', 'Ромбы · чётная'], romb1: ['square', 'Ромбы · нечётная'], romb2: ['copy', 'Ромбы · обе рядом'] };
  { const sel = $('view'), nameOf = o => (viewIcons[o.value] || [, o.textContent])[1];   // v0.176: семь видов «или — или» — одной кнопкой, как список в хабе
    const go = d => { const n = sel.options.length; sel.selectedIndex = (sel.selectedIndex + d + n) % n; sel.dispatchEvent(new Event('change', { bubbles: true })); };
    const probe = document.createElement('button'); probe.title = 'Цвета'; const b = ptBtn('viewCycle', 'eye', probe, () => go(1));
    b.oncontextmenu = ev => { ev.preventDefault(); go(-1); }; b.addEventListener('wheel', ev => { ev.preventDefault(); go(ev.deltaY > 0 ? 1 : -1); }, { passive: false });
    toolSync.push(() => { const t = nameOf(sel.selectedOptions[0] || sel.options[0]); b.title = 'Вид: ' + t + ' · щелчок — следующий, правый — предыдущий, колесо — листать · ' + [...sel.options].map(nameOf).join(' · ');
      const nm = b.querySelector('.gz-nm'), sh = VIEW_SHORT[(sel.selectedOptions[0] || sel.options[0])?.value] || t; if (nm && nm.textContent !== sh) nm.textContent = sh; });
    gView.append(b); }
  // v0.059: «Верх» — закрепить первую строку у верха при масштабе; на холсте в группе «Вид».
  { const e = $('zTop'), b = document.createElement('button'); b.type = 'button'; b.className = 'pt-b'; b.dataset.n = 'zTop';
    const mark = document.createElement('i'); mark.style.backgroundImage = icon(e, 'pin'); b.append(mark); b.onclick = () => e.click();
    toolSync.push(() => { b.title = tip(e); b.classList.toggle('on', e.matches('[aria-pressed="true"]')); }); gView.append(b);
    // v0.208: вторая половина кнопки — «Гориз»: центр «Зеркала ↑» (точка встречи «Застыло») тянется по горизонтали, а не вверх-вниз
    const h = document.createElement('span'); h.className = 'pt-half'; h.textContent = 'Гориз';
    h.addEventListener('click', ev => { ev.stopPropagation(); window.mayFixHor?.set(!window.mayFixHor.get()); placeTools(); });
    toolSync.push(() => { const on = !!window.mayFixHor?.get(); h.classList.toggle('on', on); h.title = 'Гориз: прижать по горизонтали — масштаб не меняется (из «по ширине» замирает числом), поле не сдвигается вбок при смене кадров; «по ширине» — снять · сейчас ' + (on ? 'вкл' : 'выкл'); });
    b.append(h); }
  // v0.103: «Без полос» (по кругу: полосы / без полос / до треугольника) и «Обводка» — из рейки «Вид» сюда; «Свёртка» — последней
  for (const [id, kind] of [['noband', 'half'], ['outline', 'corners'], ['fixLines', 'corners'], ['geomCenter', 'axes'], ['cellInk', 'grid4']]) {   // v0.132: «Центр» (подсветка столба) снят
    const e = $(id), b = document.createElement('button'); b.type = 'button'; b.className = 'pt-b'; b.dataset.n = id;
    const mark = document.createElement('i'); mark.style.backgroundImage = icon(e, kind); b.append(mark); b.onclick = () => e.click();
    toolSync.push(() => { b.title = tip(e); b.classList.toggle('on', e.checked);
      if (id === 'noband') { const nm = b.querySelector('.gz-nm'); if (nm) nm.textContent = ['Полосы', 'Без полос', 'До треуг.'][+e.dataset.mode || 0]; } });
    gView.append(b); }
  // v0.205: «Зеркало ↑» — нижний треугольник между линиями «Застыло» вверх от точки встречи; по кругу: выкл / все / шахм. 1 / шахм. 2 / XOR / AND
  { const names = ['Зеркало ↑', 'Зерк. ↑ все', 'Зерк. ↑ шахм. 1', 'Зерк. ↑ шахм. 2', 'Зерк. ↑ XOR', 'Зерк. ↑ AND', 'Зерк. ↑ шахм. ход', 'Зерк. ↑ шахм. антиход', 'Зерк. ↑ ход | антиход', 'Зерк. ↑ антиход | ход'], Z = () => window.mayFixMirror, probe = document.createElement('button'); probe.title = 'Зеркало';
    const b = ptBtn('fixMirror', 'mirror', probe, () => { Z()?.set(((Z().get()) + 1) % 10); placeTools(); });
    b.oncontextmenu = ev => { ev.preventDefault(); Z()?.set((Z().get() + 9) % 10); placeTools(); };
    toolSync.push(() => { const m = Z()?.get() || 0; b.classList.toggle('on', m > 0); const nm = b.querySelector('.gz-nm'); if (nm && nm.textContent !== names[m]) nm.textContent = names[m];
      b.title = 'Зеркало вверх от точки встречи линий «Застыло»: нижний треугольник между диагоналями ложится на верхний, на каждом кадре · сейчас: ' + ['выкл', 'все биты', 'шахматка 1', 'шахматка 2', 'XOR верх ⊕ низ', 'AND верх ∧ низ', 'шахматка по ходу оси (на бите — 1, между — 2)', 'шахматка по антиходу оси'][m] + ' · щелчок — следующий, правый — предыдущий'; });
    gView.querySelector('[data-n="fixLines"]').after(b); }
  // v0.210: общие настройки всех зеркал — какой цвет отражать (только его) и как ложится отражение (копия / XOR / AND)
  { const M = () => window.mayMir, COL = [['', 'все цвета'], ['b', 'синие'], ['r', 'красные'], ['y', 'жёлтые'], ['k', 'чёрные'], ['w', 'белые']], OP = [['', 'копия'], ['xor', 'XOR'], ['and', 'AND']];
    const mk = (n, list, key, tipHead) => { const probe = document.createElement('button'); probe.title = 'Зеркало';
      const at = () => Math.max(0, list.findIndex(x => x[0] === (key === 'col' ? M()?.col() : M()?.op())));
      const b = ptBtn(n, 'mirror', probe, () => { M()?.set(key, list[(at() + 1) % list.length][0]); placeTools(); });
      b.oncontextmenu = ev => { ev.preventDefault(); M()?.set(key, list[(at() + list.length - 1) % list.length][0]); placeTools(); };
      toolSync.push(() => { const i = at(), nm = b.querySelector('.gz-nm'), t = 'Зерк. ' + list[i][1]; b.classList.toggle('on', i > 0); if (nm && nm.textContent !== t) nm.textContent = t;
        b.title = tipHead + ' · сейчас: ' + list[i][1] + ' · щелчок — следующий, правый — предыдущий'; });
      return b; };
    const bc = mk('mirCol', COL, 'col', 'Все зеркала (Зерк. краска / всё, Зеркало ↑, Зеркало вниз, Зерк. ось): отражается только пиксель выбранного цвета');
    const bo = mk('mirOp', OP, 'op', 'Все зеркала: копия — отражение поверх; XOR / AND — бит отражённого с битом под ним (белый и синий — 1, чёрный и красный — 0), результат чёрно-белый');
    // v0.211: «Загиб» — сразу под «Зеркалом ↑»: вышедшее за стороны поля отражается ещё раз внутрь
    // v0.212: «ЗагибВерт» — рядом, либо-либо с «Загибом»: через вертикали в точках встречи диагоналей зеркала со сторонами поля
    const fold = (n, k, tipT) => { const fp = document.createElement('button'); fp.title = n; const bf = ptBtn(n === 'Загиб' ? 'fixFold' : 'fixFoldV', 'mirror', fp, () => { const Z = window.mayFixMirror; Z?.setFold(Z.fold() === k ? 0 : k); placeTools(); });
      toolSync.push(() => { const on = window.mayFixMirror?.fold() === k; bf.classList.toggle('on', on); bf.title = tipT + ' · ' + (on ? 'вкл' : 'выкл'); }); return bf; };
    const bf = fold('Загиб', 1, 'Загиб: то, что «Зеркало ↑» вынесло за стороны поля, отражается ещё раз — через левую или правую сторону — внутрь');
    const bv = fold('ЗагибВерт', 2, 'ЗагибВерт: то, что «Зеркало ↑» вынесло за поле, отражается внутрь через вертикали — в точках, где диагонали зеркала встречают стороны поля');
    // v0.214: «Сдвиг кадром» — тянуть центр вверх-вниз значит листать кадры
    const kp = document.createElement('button'); kp.title = 'Кадр'; const bk = ptBtn('fixDragK', 'steps', kp, () => { const K = window.mayFixDragK; K?.set(!K.get()); placeTools(); });
    toolSync.push(() => { const on = !!window.mayFixDragK?.get(); bk.classList.toggle('on', on); bk.title = 'Сдвиг кадром: тянешь зелёную горизонталь вверх-вниз — меняется кадр, точка встречи «Застыло» идёт за мышью (выкл — сдвиг центра на том же кадре) · ' + (on ? 'вкл' : 'выкл'); });
    // v0.216: ось зеркала — ход (дрожит вслед маятнику) / стоит / антиход
    const AX = ['Ось: ход', 'Ось: стоит', 'Ось: антиход'], ap = document.createElement('button'); ap.title = 'Ось';
    const ba = ptBtn('fixAxis', 'swap', ap, () => { const A = window.mayFixAxis; A?.set((A.get() + 1) % 3); placeTools(); });
    ba.oncontextmenu = ev => { ev.preventDefault(); const A = window.mayFixAxis; A?.set((A.get() + 2) % 3); placeTools(); };
    toolSync.push(() => { const i = window.mayFixAxis?.get() || 0, nm = ba.querySelector('.gz-nm'); ba.classList.toggle('on', i > 0); if (nm && nm.textContent !== AX[i]) nm.textContent = AX[i];
      ba.title = 'Ось «Зеркала ↑»: ход — за точкой встречи: при равном числе битов слева и справа — на границе между битами (2 пикселя), иначе на бите слева или справа от неё; стоит — на границе, толщиной 2 пикселя; антиход — 1 пиксель навстречу маятнику · сейчас: ' + AX[i].slice(5) + ' · щелчок — следующий, правый — предыдущий'; });
    // v0.291: «Пила» — красная пила в боковых секторах, отдельно от осей «Точки встречи»
    // v0.400: «Пила полная» — пила продолжается внутрь, голубым, до низа поля
    const sfp = document.createElement('button'); sfp.title = 'Пила полная'; const bSf = ptBtn('sawFull', 'zigzag', sfp, () => { const P = window.maySawFull; P?.set(!P.get()); placeTools(); });
    toolSync.push(() => { const on = !!window.maySawFull?.get(); bSf.classList.toggle('on', on); bSf.title = 'Пила полная: та же пила, отражённая через главную диагональ — голубые зубцы внутри нижнего сектора, до низа поля · ' + (on ? 'вкл' : 'выкл'); });
    const swp = document.createElement('button'); swp.title = 'Пила'; const bSw = ptBtn('saw', 'zigzag', swp, () => { const P = window.maySaw; P?.set(!P.get()); placeTools(); });
    toolSync.push(() => { const on = !!window.maySaw?.get(); bSw.classList.toggle('on', on); bSw.title = 'Пила: красные зубцы в боковых секторах — от края поля вниз до главной диагонали и обратно (рисуется при «Точке встречи») · ' + (on ? 'вкл' : 'выкл'); });
    // v0.281: «Площади» — треугольник ▼, секторы, зубец пилы — в клетках, совпадения
    const arp = document.createElement('button'); arp.title = 'Площади'; const bAr = ptBtn('areas', 'square', arp, () => { const A = window.mayAreas; A?.set(!A.get()); placeTools(); });
    toolSync.push(() => { const on = !!window.mayAreas?.get(); bAr.classList.toggle('on', on); bAr.title = 'Площади в клетках: ▼ — самая большая сплошная область в нижнем секторе, секторы верх / низ / лево / право, зубец пилы; совпавшие — одним цветом и строкой «… = …» внизу слева · ' + (on ? 'вкл' : 'выкл'); });
    // v0.270: «Секторы» — фон четырёх секторов вокруг точки встречи
    const scp = document.createElement('button'); scp.title = 'Секторы'; const bSc = ptBtn('sectors', 'grid4', scp, () => { const S = window.maySectors; S?.set(!S.get()); placeTools(); });
    toolSync.push(() => { const on = !!window.maySectors?.get(); bSc.classList.toggle('on', on); bSc.title = 'Секторы вокруг точки встречи «Застыло»: верхний — застыл, больше не меняется (синий); нижний — меняется на каждом шаге (красный); левый / правый — только когда маятник на своей стороне, через шаг (жёлтые; когда вершин по сторонам не поровну — правый зелёный) · ' + (on ? 'вкл' : 'выкл'); });
    // v0.261: «Карта тепла» — серии изменений подряд и остывание
    const htp = document.createElement('button'); htp.title = 'Тепло'; const bHt = ptBtn('heat', 'drop', htp, () => { const T = window.mayHeat; T?.set(!T.get()); placeTools(); });
    toolSync.push(() => { const on = !!window.mayHeat?.get(); bHt.classList.toggle('on', on); bHt.title = 'Карта тепла: клетка меняет бит кадр за кадром подряд — 1 раз жёлтая, 2 оранжевая, 3 красная, 4 малиновая, 5 и больше белая; перестала меняться — остывает голубым за 8 кадров · ' + (on ? 'вкл' : 'выкл'); });
    // v0.259: «Вспышка вершины» — на каждом шаге конус новой вершины золотом на секунду
    const vfp = document.createElement('button'); vfp.title = 'Вспышка'; const bVf = ptBtn('vtxFlash', 'bolt', vfp, () => { const V = window.mayVtxFlash; V?.set(!V.get()); placeTools(); });
    toolSync.push(() => { const on = !!window.mayVtxFlash?.get(); bVf.classList.toggle('on', on); bVf.title = 'Вспышка вершины: на каждом шаге все биты, пришедшие с новой вершины (её конус), подсвечиваются золотом и гаснут за секунду · ' + (on ? 'вкл' : 'выкл'); });
    // v0.254: «Подписи строк» — у каждой строки справа номер, битов, сколько 1 и 0
    const rlp = document.createElement('button'); rlp.title = 'Строки'; const bRl = ptBtn('rowLab', 'bars', rlp, () => { const R = window.mayRowLab; R?.set(R.get() ? 0 : 2); placeTools(); });   // v0.371: «только таблица» — вкл / выкл
    toolSync.push(() => { const m = window.mayRowLab?.get() ? 2 : 0, on = m > 0; bRl.classList.toggle('on', on); bRl.title = 'Таблица строк: правая половина маятника спрятана, от оси — номер, сколько видно бит (нарастающим итогом), сколько 1 и 0 · ' + (on ? 'вкл' : 'выкл');
      const nm = bRl.querySelector('.gz-nm'), t = 'Таблица'; if (nm && nm.textContent !== t) nm.textContent = t; });
    // v0.252: «Точка встречи» — вертикаль, горизонталь и пунктир через точку встречи, отдельно от «Застыло» (при нём — на настоящей точке, без него — тянется руками)
    // v0.306: «очистка от зеркал от выделения шаблонов» — в «Очистке» ещё «Зеркала» (выключить все зеркала) и «Выделение» (снять выделение шаблона, как Esc)
    // v0.308: и «Окраска» (выключить живую окраску «Краски»); «Выделение» — у всех шаблонов: выбор и обводка
    for (const [n, kind, has, off, t] of [['clrPaint', 'colour', 'paint', 'paintOff', 'Снять все цвета: заливку кадра и застывшую краску, и выключить живую окраску — заливку и столбы, проход, центр краской, живые шахматки и автопокраску, повтор столбов; изменённые биты остаются'],
      ['clrMirrors', 'mirror', 'mirrors', 'mirrorsOff', 'Выключить все зеркала: Зеркало ↑ (с загибом), Зеркало ↓, «Зерк. ось», зеркало по своей оси и «Зерк. краска / всё»'],
      ['clrSel', 'select', 'sel', 'selOff', 'Снять выделение всех шаблонов на поле: выбор и обводку; сами шаблоны остаются']]) {
      const p = document.createElement('button'); p.title = t; const b = ptBtn(n, kind, p, () => { window.mayClear?.[off](); placeTools(); });
      toolSync.push(() => { b.title = t; b.disabled = !window.mayClear?.[has](); }); gEdit.append(b); }
    const tcp = document.createElement('button'); tcp.title = 'Точка'; const bTc = ptBtn('fixCross', 'axes', tcp, () => { const T = window.mayFixCross; T?.set(!T.get()); placeTools(); });
    toolSync.push(() => { const on = !!window.mayFixCross?.get(); bTc.classList.toggle('on', on); bTc.title = 'Точка встречи: голубая вертикаль, зелёная горизонталь и пунктир диагоналей через точку встречи. При «Застыло» — на настоящей точке застывания; без него — тянется мышью в любую сторону · ' + (on ? 'вкл' : 'выкл'); });
    // v0.236: «Замок ↔» — ось «Застыло» не ходит по сторонам: стоит на столбце, где была при включении
    const lkp = document.createElement('button'); lkp.title = 'Замок'; const bLk = ptBtn('fixLock', 'pin', lkp, () => { const L = window.mayFixLock; L?.set(!L.get()); placeTools(); });
    toolSync.push(() => { const on = !!window.mayFixLock?.get(); bLk.classList.toggle('on', on); bLk.title = 'Замок ↔: ось «Застыло» (и центр зеркал) стоит на своём столбце — не ходит влево-вправо ни со сменой кадров, ни при «Сдвиге кадром», ни при «Гориз» · ' + (on ? 'вкл' : 'выкл'); });
    // v0.235: «Биты в строках» — таблица строк 1…15 текущего кадра (window.mayRowCount) под кнопкой; ещё щелчок, Esc или щелчок мимо — закрыть. Кадр сменился — таблица пересчитывается
    const rcp = document.createElement('button'); rcp.title = 'Счёт'; let rcBox = null;
    const rcFmt = v => v === null ? '—' : (v > 0 ? '+' : v < 0 ? '−' : '') + String(Math.abs(v)).replace('.5', '½').replace(/^0½/, '½');
    const rcFill = () => { const d = window.mayRowCount?.(15); if (!rcBox || !d) return;
      const AXN = ['ход', 'стоит', 'антиход'], h = 'Кадр ' + d.k + ' · вершин ' + d.n + (d.n ? ' (от ' + rcFmt(d.vLo) + ' до ' + rcFmt(d.vHi) + ')' : '') +
        (d.axis === null ? ' · линий «Застыло» нет' : ' · точка встречи: столбец ' + rcFmt(d.meet) + ', строка ' + rcFmt(d.meetY) + ' · ось (' + AXN[d.am] + '): ' + rcFmt(d.axis));
      rcBox.querySelector('.rc-h').textContent = h;
      rcBox.querySelector('tbody').innerHTML = d.rows.map(o => '<tr><td>' + o.r + '</td><td><b>' + o.all + '</b></td><td>' + (o.all % 2 ? 'нечёт' : 'чёт') + '</td><td>' + o.one + '</td><td>' + o.zero + '</td><td>' + rcFmt(o.lo) + ' … ' + rcFmt(o.hi) +
        '</td><td>' + rcFmt(o.mid) + '</td><td>' + (d.axis === null ? '—' : o.L + ' | ' + o.M + ' | ' + o.R + (o.L === o.R ? ' ✓' : '')) + '</td></tr>').join(''); };
    const rcClose = () => { rcBox?.remove(); rcBox = null; bRc.classList.remove('on'); };
    const bRc = ptBtn('rowCount', 'bars', rcp, () => { if (rcBox) { rcClose(); return; }
      rcBox = document.createElement('div'); rcBox.className = 'may-rc';
      rcBox.innerHTML = '<div class="rc-h"></div><table><thead><tr><th>строка</th><th>битов</th><th></th><th>1</th><th>0</th><th>столбцы от якоря</th><th>середина</th><th>слева | на оси | справа</th></tr></thead><tbody></tbody></table>' +
        '<div class="rc-n">Столбец 0 — якорь, ½ — граница между битами. Ширина строки r = вершин + 2·(r − 1): чётность у всех строк кадра одна.</div>';
      document.body.append(rcBox); const b = bRc.getBoundingClientRect(); rcBox.style.left = Math.max(4, Math.min(innerWidth - rcBox.offsetWidth - 4, b.left)) + 'px'; rcBox.style.top = Math.round(b.bottom + 6) + 'px';
      bRc.classList.add('on'); rcFill(); });
    bRc.title = 'Биты в строках: сколько битов в каждой строке 1…15 текущего кадра, из них 1 и 0, крайние столбцы, середина, слева / справа от оси «Застыло»';
    toolSync.push(rcFill);
    addEventListener('keydown', e => { if (e.key === 'Escape' && rcBox) rcClose(); });
    addEventListener('pointerdown', e => { if (rcBox && !rcBox.contains(e.target) && !bRc.contains(e.target)) rcClose(); }, true);
    // v0.220: «Во всю ширину» — вверх отражается вся строка, как если бы треугольник прошёл по горизонтали всё поле
    const wp = document.createElement('button'); wp.title = 'Ширина'; const bw = ptBtn('fixWide', 'corners', wp, () => { const W = window.mayFixWide; W?.set(!W.get()); placeTools(); });
    toolSync.push(() => { const on = !!window.mayFixWide?.get(); bw.classList.toggle('on', on); bw.title = 'Во всю ширину: «Зеркало ↑» отражает вверх от горизонтали всю строку поля, а не только треугольник между диагоналями · ' + (on ? 'вкл' : 'выкл'); });
    // v0.221: «Вывернутое» — отражение через центр (точку встречи): правый низ — в левый верх, левый низ — в правый верх
    const rp = document.createElement('button'); rp.title = 'Вывернутое'; const br = ptBtn('fixRot', 'swap', rp, () => { const R = window.mayFixRot; R?.set(!R.get()); placeTools(); });
    toolSync.push(() => { const on = !!window.mayFixRot?.get(); br.classList.toggle('on', on); br.title = 'Вывернутое зеркало: «Зеркало ↑» отражает через точку встречи — правый низ ложится в левый верх, левый низ — в правый верх · ' + (on ? 'вкл' : 'выкл'); });
    // v0.222: «Зеркало ↓» — нижние зеркала от точки встречи: боковые клинья через диагонали внутрь (по кругу: выкл / левая / правая / обе)
    const LOW = ['Зеркало ↓', 'Зерк. ↓ левая', 'Зерк. ↓ правая', 'Зерк. ↓ обе'], lp = document.createElement('button'); lp.title = 'Зеркало';
    const bl = ptBtn('fixLow', 'mirror', lp, () => { const Lw = window.mayFixLow; Lw?.set((Lw.get() + 1) % 4); placeTools(); });
    bl.oncontextmenu = ev => { ev.preventDefault(); const Lw = window.mayFixLow; Lw?.set((Lw.get() + 3) % 4); placeTools(); };
    toolSync.push(() => { const i = window.mayFixLow?.get() || 0, nm = bl.querySelector('.gz-nm'); bl.classList.toggle('on', i > 0); if (nm && nm.textContent !== LOW[i]) nm.textContent = LOW[i];
      bl.title = 'Зеркало ↓: ниже точки встречи «Застыло» боковые клинья отражаются через диагонали внутрь нижнего треугольника · сейчас: ' + ['выкл', 'левая диагональ', 'правая диагональ', 'обе'][i] + ' · щелчок — следующий, правый — предыдущий'; });
    window.mayFixLowNames = ['Выкл', 'Левая', 'Правая', 'Обе'];
    // v0.223: «Сверху вниз» — «Зеркало ↑» наоборот: верхний треугольник ложится в нижний
    const dp = document.createElement('button'); dp.title = 'Вниз'; const bd = ptBtn('fixDown', 'swap', dp, () => { const D = window.mayFixDown; D?.set(!D.get()); placeTools(); });
    toolSync.push(() => { const on = !!window.mayFixDown?.get(); bd.classList.toggle('on', on); bd.title = 'Сверху вниз: «Зеркало ↑» наоборот — верхний треугольник (и вся строка при «Во всю ширину») отражается вниз от точки встречи · ' + (on ? 'вкл' : 'выкл'); });
    // v0.224: «Наружу» — «Зеркало ↓» наоборот: нижний треугольник через диагонали в боковые клинья
    const op = document.createElement('button'); op.title = 'Наружу'; const bn = ptBtn('fixLowOut', 'swap', op, () => { const Lw = window.mayFixLow; Lw?.setOut(!Lw.out()); placeTools(); });
    toolSync.push(() => { const on = !!window.mayFixLow?.out(); bn.classList.toggle('on', on); bn.title = 'Наружу: «Зеркало ↓» наоборот — нижний треугольник отражается через диагонали в боковые клинья · ' + (on ? 'вкл' : 'выкл'); });
    gView.querySelector('[data-n="fixMirror"]').after(bTc, bSw, bSf, bSc, bAr, bRl, bVf, bHt, bd, bf, bv, ba, bLk, bRc, bw, br, bk, bl, bn, bc, bo);
    window.mayFixAxisNames = AX;
    window.mayMirLists = { col: COL, op: OP }; }
  // v0.194: показ пикселей по цвету — пять кнопок: горит — пиксели этого цвета видны, погашена — скрыты (цветом пустоты)
  for (const [c, col, t] of [['b', '#4f9bff', 'синие (стал 1)'], ['r', '#ff5a4f', 'красные (стал 0)'], ['y', '#ffd35b', 'жёлтые'], ['k', '#5b6475', 'чёрные (0)'], ['w', '#e8edf5', 'белые (1)']]) {
    const probe = document.createElement('button'); probe.title = t; const b = ptBtn('px_' + c, 'eye', probe, () => { window.mayPx?.toggle(c); placeTools(); });
    const d = document.createElement('span'); d.className = 'pt-dot'; d.style.background = col; b.append(d);
    toolSync.push(() => { const on = !window.mayPx?.has(c); b.classList.toggle('on', on); b.title = 'Пиксели: ' + t + (on ? ' — видны, щелчок — скрыть' : ' — скрыты, щелчок — показать'); });
    gView.append(b); }
  gView.append(gView.querySelector('[data-n="bFoldHorizontal"]'),gView.querySelector('[data-n="bFoldVertical"]'));
  // v0.200: «из сведений переключение подсветки перенеси в вид» — легенда 1 · 0 · стал 1 · стал 0 (щелчок — цвета перекрытий вкл / выкл) — в «Вид», первой
  gView.prepend($('lg'));
  // v0.075: Xor-Next — в верхней панели, виден всегда; без шаблона бледный.
  { const g = ptGroup('Шаблон'), e = $('bXor2'), b = document.createElement('button'); b.type = 'button'; b.className = 'pt-b'; b.dataset.n = 'bXor2';
    const mark = document.createElement('i'); mark.style.backgroundImage = icon(e, 'steps'); b.append(mark); b.onclick = () => e.click();
    toolSync.push(() => { b.title = tip(e) + (e.disabled ? ' · сначала выбери шаблон' : ''); b.disabled = e.disabled; }); g.append(b);
    // v0.091: «Сохранить» и «Цвет» выбранной фигуры — из «Сведений» сюда же, рядом с Xor-Next; без шаблона бледные.
    for (const [id, kind] of [['bTemplateQuickSave', 'save'], ['bTemplateColour', 'colour']]) {
      const e = $(id), b = document.createElement('button'); b.type = 'button'; b.className = 'pt-b'; b.dataset.n = id;
      const mark = document.createElement('i'); mark.style.backgroundImage = icon(e, kind); b.append(mark); b.onclick = () => e.click();
      toolSync.push(() => { b.title = tip(e) + (e.disabled ? ' · сначала выбери шаблон' : ''); b.disabled = e.disabled; }); g.append(b); } }
  // v0.062: запись видео — на холсте отдельной группой.
  { const gRec = ptGroup('Видео'), e = $('bRec'), b = document.createElement('button'); b.type = 'button'; b.className = 'pt-b'; b.dataset.n = 'bRec';
    const mark = document.createElement('i'); mark.style.backgroundImage = icon(e, 'record'); b.append(mark); b.onclick = () => e.click();
    toolSync.push(() => { b.title = tip(e); b.classList.toggle('on', e.matches('[aria-pressed="true"]')); }); gRec.append(b); }
  // v0.056: каждая группа в своей рамке; значки подписаны через один — сверху и снизу.
  {const e=$('bGif'),b=document.createElement('button');b.type='button';b.className='pt-b';b.dataset.n='bGif';const mark=document.createElement('i');mark.style.backgroundImage=icon(e,'record');b.append(mark);b.onclick=()=>e.click();toolSync.push(()=>{b.title=tip(e);b.disabled=e.disabled;b.classList.toggle('on',e.getAttribute('aria-pressed')==='true');});tools.querySelector('[data-n="bRec"]').parentElement.append(b);}
  const ptNames = { fixMirror:'Зеркало ↑', fixFold:'Загиб', fixFoldV:'ЗагибВерт', fixDragK:'Сдвиг кадром', fixAxis:'Ось: ход', rowCount:'Биты в строках', fixCross:'Точка встречи', sawFull:'Пила полная', rowLab:'Подписи', vtxFlash:'Вспышка', heat:'Тепло',   // v0.329: «Вид» — стандартной ширины, названия короче
    sectors:'Секторы', areas:'Площади', saw:'Пила', fixLock:'Замок ↔', fixWide:'Во всю ширину', fixRot:'Вывернутое', fixLow:'Зеркало ↓', fixDown:'Сверху вниз', fixLowOut:'Наружу', mirCol:'Зерк. все цвета', mirOp:'Зерк. копия', px_b:'Синие', px_r:'Красные', px_y:'Жёлтые', px_k:'Чёрные', px_w:'Белые', bReset:'Всё поле', clrPaint:'Окраска', clrMirrors:'Зеркала', clrSel:'Выделение', bFill:'Заливка', bAutoVertical:'Столбы', bStolb:'Проход', bPaintMid:'Центр', midBox:'1 · 0 · ⇔', bAutoAll:'Авто', bPaintMeet:'Точка', bPaintAxis:'ТочкаОсь', bThirds:'Трети', bTriTop:'▼ ← верх', meetGrow:'Рост', meetCol:'Цвет', bFillGrow:'Рост', fillMirror:'Зеркало', bFillUndo:'Отмена', bFillRedo:'Повтор', bFillClear:'Стереть', bPaintNew:'С нуля', sym:'Симметрия', symTriangles:'Тотемы', bTriangleAxes:'Оси пустот', bFrameWindow:'Кадр отдельно', symV:'Оси ↕', symH:'Оси ↔', symD:'Оси ╲╱', bAxisLine:'Ось', bAxisMirror:'Вниз', bAxisXor:'Хор', bAxisLinesClear:'Убрать', bRuler:'Линейка', col:'Цвета', bits:'Биты', digits:'Цифры', digitsOnly:'Только цифры', cellInk:'Грани', geomCenter:'Геоцентр', fixLines:'Застыло', bFoldCompare:'Сгиб', bFoldHorizontal:'Свёртка ↔', bFoldVertical:'Свёртка ↕', noband:'Без полос', outline:'Обводка', midCol:'Центр', romb0:'Ромб 0', romb1:'Ромб 1', romb2:'Обе', zTop:'Верх', bRec:'Запись', bGif:'GIF', bXor2:'Xor-Next', bTemplateQuickSave:'Сохранить', bTemplateColour:'Перекрасить', viewCycle:'Вид', c_digitOneColour:'Цифра 1', c_digitZeroColour:'Цифра 0', c_bitOneColour:'Клетка 1', c_bitZeroColour:'Клетка 0', fontCycle:'Шрифт', sizeCtl:'Размер', midOneOn:'Центр 1', midZeroOn:'Центр 0', midWide:'⇔ 2-й уровень' };
  // v0.073: значки заменены обычными длинными кнопками, как в меню: значок + название, по две строки в группе.
  // «Запись» и «Цвет» остаются маленькими, с подписью сверху.
  const ptColour = { 'Точка Ось':'#b48cff', 'Краска':'#ff9b50', 'Правка':'#ffd35b', 'Очистка':'#ffd35b', 'Оси':'#ff87cf', 'Вид':'#7cbcff', 'Зеркала':'#b48cff', 'Шаблон':'#ffd35b' };
  for (const g of tools.querySelectorAll('.pt-g')) { const c = ptColour[g.querySelector('.pt-l').textContent]; if (c) { g.style.setProperty('--c', c); g.classList.add('pt-long'); } }
  for (const row of tools.querySelectorAll('.pt-r')) [...row.children].forEach((b, k) => {
    if (b.classList.contains('pt-b') && b.dataset.n !== 'bRec') {
      b.classList.add('gz-hx'); b.querySelector('i').classList.add('gz-ic');
      const nm = document.createElement('span'); nm.className = 'gz-nm'; nm.textContent = ptNames[b.dataset.n] || ''; b.append(nm); return; }
    const t = document.createElement('b'); t.className = 'pt-t up'; t.textContent = b.dataset.n ? (ptNames[b.dataset.n] || '') : 'Цвет'; b.append(t); });
  // v0.063: панель значков — в шапке, рядом с «Что это такое?», а не поверх холста.
  tools.insertBefore(gHistory.parentElement,gView.parentElement);
  // v0.103: «Вид» в шапке — компактно, в три ряда; цвета цифр и «показ строк» — сами поля, столбиком в конце группы
  gView.parentElement.classList.add('pt-view'); gMir.parentElement.classList.add('pt-view');
  { const done = b => { b.classList.add('gz-hx'); b.querySelector('i')?.classList.add('gz-ic'); const nm = document.createElement('span'); nm.className = 'gz-nm'; nm.textContent = ptNames[b.dataset.n] || ''; b.append(nm); return b; };   // эти встают после общей раздачи надписей
    for (const [id, title] of [['digitOneColour', 'Цвет цифры 1'], ['digitZeroColour', 'Цвет цифры 0'], ['bitOneColour', 'Цвет клетки 1'], ['bitZeroColour', 'Цвет клетки 0']]) {
      const b = ptBtn('c_' + id, 'colour', $(id), null), d = dotIn(b, id, title); b.onclick = () => d.click(); b.title = title + ' · щелчок — палитра'; gView.append(done(b)); }
    const fnt = $('digitFont'), fb = ptBtn('fontCycle', 'steps', fnt, () => { fnt.selectedIndex = (fnt.selectedIndex + 1) % fnt.options.length; fnt.dispatchEvent(new Event('change', { bubbles: true })); });
    fb.oncontextmenu = ev => { ev.preventDefault(); const n = fnt.options.length; fnt.selectedIndex = (fnt.selectedIndex - 1 + n) % n; fnt.dispatchEvent(new Event('change', { bubbles: true })); };
    toolSync.push(() => { const t = fnt.selectedOptions[0]?.textContent || '', sh = { mono: 'Моно', sans: 'Без засечек', serif: 'С засечками' }[fnt.value] || t; fb.title = 'Шрифт цифр: ' + t + ' · щелчок — следующий, правый — предыдущий'; const nm = fb.querySelector('.gz-nm'); if (nm && nm.textContent !== sh) nm.textContent = sh; }); gView.append(done(fb));
    const sz = $('digitSize'), szSet = d => { const v = Math.max(+sz.min, Math.min(+sz.max, (+sz.value || 80) + d * (+sz.step || 5))); if (v === +sz.value) return; sz.value = v; fire(sz); };
    const sb = ptBtn('sizeCtl', 'plus', sz, () => szSet(1)); sb.oncontextmenu = ev => { ev.preventDefault(); szSet(-1); }; sb.addEventListener('wheel', ev => { ev.preventDefault(); szSet(ev.deltaY < 0 ? 1 : -1); }, { passive: false });
    toolSync.push(() => { const t = 'Цифры ' + sz.value + ' %'; sb.title = 'Размер цифр в клетке · щелчок — больше, правый — меньше, колесо'; const nm = sb.querySelector('.gz-nm'); if (nm && nm.textContent !== t) nm.textContent = t; }); gView.append(done(sb));
    const box = document.createElement('span'); box.className = 'pt-vx'; const v = $('vrows'); v.title = tip(v); v.placeholder = 'строк'; v.classList.add('pt-vrows'); box.append(v); gView.append(box); }
  // v0.226: «и эту раздели в 2, отдели фоном или вложенностью, сделай по темам» — список «Вида» в два столбца (.pt-col), в них блоки по темам
  // своим фоном (.pt-sec, тема — в подсказке блока): слева — как выглядит поле, справа — «Застыло», зеркала и пиксели по цвету.
  // У блока поля 2 px сверху и снизу и нет зазора между блоками — шаг рядов (кнопка + зазор 4 px) тот же, зубцы рамки (zig) — против остриёв кнопок.
  { const VIEW_COLS = [
      [['Показ поля', '#7cbcff', ['lg', 'viewCycle', 'noband', 'outline', 'geomCenter', 'cellInk', 'rowLab', 'vtxFlash', 'heat', 'zTop', 'vx']],
       ['Сгиб и свёртки', '#73e4a5', ['bFoldCompare', 'bFoldHorizontal', 'bFoldVertical']],
       ['Цифры и клетки', '#ffd35b', ['c_digitOneColour', 'c_digitZeroColour', 'c_bitOneColour', 'c_bitZeroColour', 'fontCycle', 'sizeCtl']]],
      [['«Застыло» и Зеркало ↑', '#b48cff', ['fixLines', 'fixCross', 'saw', 'sawFull', 'sectors', 'areas', 'fixMirror', 'fixDown', 'fixFold', 'fixFoldV', 'fixAxis', 'fixLock', 'rowCount', 'fixWide', 'fixRot', 'fixDragK']],
       ['Зеркало ↓', '#ff87cf', ['fixLow', 'fixLowOut']],
       ['Все зеркала: цвет и наложение', '#ff9b50', ['mirCol', 'mirOp']],
       ['Пиксели по цвету: видны / скрыты', '#e8edf5', ['px_b', 'px_r', 'px_y', 'px_k', 'px_w']]] ];
    const pick = n => n === 'lg' ? $('lg') : n === 'vx' ? gView.querySelector(':scope > .pt-vx') : gView.querySelector(':scope > [data-n="' + n + '"]');
    const cols = VIEW_COLS.map(secs => { const col = document.createElement('div'); col.className = 'pt-col';
      for (const [t, c, ns] of secs) { const s = document.createElement('div'); s.className = 'pt-sec'; s.dataset.t = t; s.style.setProperty('--s', c);   // v0.392: «лишняя подсказка» — название блока не всплывает (было title)
        for (const n of ns) { const e = pick(n); if (e) s.append(e); } if (s.children.length) col.append(s); } return col; });
    const rest = [...gView.children]; if (rest.length) { const s = document.createElement('div'); s.className = 'pt-sec'; s.style.setProperty('--s', '#7cbcff'); s.append(...rest); cols[0].append(s); }   // новая кнопка без темы — в конец «Вида»
    cols[0].classList.add('pt-colv'); gView.append(cols[0]); gMir.append(cols[1]); gView.classList.add('pt-cols'); gMir.classList.add('pt-cols'); }   // v0.238: левый столбец — «Вид», правый — «Зеркала»
  // v0.356: «точка встречи пусть включена по умолчанию и привязана к Сдвигу кадром и Застыло — все 3 кнопки объедини в одну, как в Хабе, только 3 части»:
  // одна кнопка «Точка | Сдвиг | Застыло» на месте «Застыло»; каждая часть — своя прежняя кнопка (они спрятаны и работают), горит — включена
  { const parts = [['fixCross', 'Точка', 'Точка встречи'], ['fixDragK', 'Сдвиг', 'Сдвиг кадром'], ['fixLines', 'Застыло', 'Застыло']].map(([n, l, t]) => [tools.querySelector('[data-n="' + n + '"]'), l, t]).filter(p => p[0]);
    // v0.381: «на стандартную кнопку из частей, как в Хабе»: пара grozd gz-pair gz-split с третьей частью (gz-split3) — части через косую черту,
    // у каждой своя кайма (--gz-rI): включённая — цветом группы, прочие — 30 %; фон свой, без свечения текста
    if (parts.length === 3) { const b = document.createElement('button'); b.type = 'button'; b.className = 'pt-b gz-hx gz-pair gz-split gz-split3'; b.dataset.n = 'fixTri';
      parts.forEach(([src, l, t], j) => { const sp = document.createElement('span'); sp.className = 'gz-half gz-h' + j; sp.textContent = l;
        sp.onclick = e => { e.stopPropagation(); src.click(); placeTools(); };
        toolSync.push(() => { const on = src.classList.contains('on'); sp.classList.toggle('gz-on', on); b.style.setProperty('--gz-r' + j, on ? 'var(--c)' : 'color-mix(in srgb,var(--c) 30%,#000)'); sp.title = t + ': ' + (src.title || ''); });
        b.append(sp); if (!j) { const pm = document.createElement('span'); pm.className = 'gz-pm'; b.append(pm); } });
      parts[2][0].before(b); for (const p of parts) p[0].style.display = 'none'; } }
  // v0.085: «Отмена» и «Повтор» в одну строку, между ними вертикальная черта.
  { const sep = document.createElement('span'); sep.className = 'pt-sep'; gHistory.firstElementChild.after(sep); }
  $('mayAbout').after(tools);
  // v0.124: «Дзен» и «?» — столбиком, одна над другой, у правого края шапки.
  // v0.125: столбик «Дзен» / «?» — в той же верхней полосе меню, последним.
  // v0.165: «шаблоны туда же» — список шаблонов (правая панель «Шаблоны») — выпадающей группой в полоске меню, с закрепом.
  // Кнопки рейки переносятся как есть (их обновление и щелчки остаются), правая панель больше не показывается.
  { const row = ptGroup('Шаблоны'), lib = railRIn.querySelector('.gz-group'); row.parentElement.classList.add('pt-lib'); row.parentElement.style.setProperty('--c', '#d9b9ff');
    if (lib) { row.append(...lib.querySelectorAll('.gz-soty > .gz-hx'), ...lib.querySelectorAll('.gz-wide > *')); lib.remove(); }
    railR.style.setProperty('display', 'none', 'important'); }
  // v0.180: «это в верхнее меню, открытие кнопкой и скрытие, как выпадающее меню, только полем»: сводка «Очков» — не полосой под шапкой,
  // а выпадающей группой «👓 Очки» в полосе (наведение / щелчок / закреп — как у остальных); группа видна, только пока «Очки» что-то показывают
  { const row = ptGroup('👓 Очки'), g = row.parentElement, box = $('ochkiBox'); g.classList.add('pt-ochki'); g.style.setProperty('--c', '#ffb347'); row.append(box); box.open = true;
    const top = () => { const l = $('ochkiList'); if (l?.getClientRects().length) g.style.setProperty('--ochki-top', Math.round(l.getBoundingClientRect().top) + 'px'); };   // v0.181: верх списка — чтобы дотянуть его ровно до низа окна
    g.querySelector('.pt-l').addEventListener('pointerenter', () => requestAnimationFrame(top)); g.querySelector('.pt-l').addEventListener('click', () => requestAnimationFrame(top)); addEventListener('resize', top);
    toolSync.push(() => { const hide = box.hidden; if ((g.style.display === 'none') !== hide) g.style.display = hide ? 'none' : ''; }); }
  // v0.182: «Сведения — тоже кнопкой, как Очки»: выпадающая группа «ⓘ Сведения» в полосе; панель (#mayatnikInfoPanel) кладётся в неё ниже
  const infoRow = ptGroup('ⓘ Сведения'); infoRow.parentElement.classList.add('pt-info'); infoRow.parentElement.style.setProperty('--c', '#9fb4d8');
  { const col = document.createElement('div'); col.id = 'mayCorner'; tools.append(col); col.append($('mayZen'), $('mayHelp')); }
  // v0.179: «Видео (Запись, GIF) — ромбами как в хабе, справа по середине высоты, и Дзен также»: столбик ромбов у правого края,
  // виден и в дзене (там «Дзен» — «Меню»); группы «Видео» в полосе и «Дзен» в углу шапки больше нет — ромбы жмут прежние кнопки
  { const col = document.createElement('div'); col.id = 'mayRhombs'; document.body.append(col);
    const mk = (id, src, label) => { const b = document.createElement('button'); b.type = 'button'; b.id = id; b.className = 'may-rh'; b.textContent = label;
      b.addEventListener('click', () => $(src)?.click()); col.append(b); return b; };
    const zen = mk('mayRhZen', 'mayZen', '◎\nДзен'), rec = mk('mayRhRec', 'bRec', '⏺\nВидео'), gif = mk('mayRhGif', 'bGif', 'GIF');
    const sync = () => { const z = document.body.classList.contains('may-zen'), t = z ? '◎\nМеню' : '◎\nДзен'; if (zen.textContent !== t) zen.textContent = t;
      zen.title = z ? 'Вернуть меню (Esc, щелчок колёсиком по полю)' : tip($('mayZen')); zen.setAttribute('aria-pressed', String(z));
      const r = $('bRec'), on = !!r && r.matches('[aria-pressed="true"],.on'); rec.classList.toggle('on', on); rec.title = r ? tip(r) : '';
      const g = $('bGif'); gif.disabled = !!g?.disabled; gif.classList.toggle('on', g?.getAttribute('aria-pressed') === 'true'); gif.title = g ? tip(g) : ''; };
    const mo = new MutationObserver(sync); mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    for (const id of ['bRec', 'bGif']) if ($(id)) mo.observe($(id), { attributes: true, attributeFilter: ['aria-pressed', 'class', 'disabled', 'title'] });
    sync();
    const vg = [...tools.querySelectorAll('.pt-g')].find(g => g.querySelector('.pt-l')?.firstChild?.textContent.trim() === 'Видео'); if (vg) vg.remove(); }
  // v0.158: «меню в одну полоску, с выпадающими списками для каждой группы» — в шапке видны только названия групп;
  // щелчок по названию раскрывает её кнопки списком под ним (открыт один), щелчок мимо или Esc — закрыть.
  // Пока какой-то список открыт, наведение на соседнее название переключает на него. Точка у названия — в группе что-то включено.
  { tools.classList.add('pt-dd'); let open = null, grid = null; const narrow = matchMedia('(max-width:600px)');   // grid — раскладка по сетке (v0.225)
    // v0.159: на телефоне «Что это такое?» — в конец полоски меню, чтобы шапка была в одну строку
    const aboutHome = $('mayAbout').previousElementSibling, aboutPlace = () => { if (narrow.matches) $('mayCorner').append($('mayAbout')); else aboutHome.after($('mayAbout')); };
    narrow.addEventListener('change', () => { shut(); aboutPlace(); }); aboutPlace();
    // v0.163: (getClientRects, а не offsetParent: у fixed-списка на телефоне он null) рамка списка — зубцами по бокам (ряд 24 px, как кнопки), высота — целым числом рядов; рисунок — SVG фоном, тот же контур — clip-path
    const zig = r => { if (!r.getClientRects().length) return; r.style.height = '';
      // v0.164: «стык в стык» — зубцы рамки той же высоты и скоса, что кнопки: острия кнопок входят в выемки рамки, прочее — целым числом рядов
      const b0 = r.querySelector(':scope > .gz-hx, :scope > .pt-col .gz-hx'), GAP = parseFloat(getComputedStyle(r).rowGap) || 0, P = b0 ? b0.offsetHeight + GAP : 24, D = b0 ? parseFloat(getComputedStyle(b0).getPropertyValue('--gz-n')) || 9 : 9;   // v0.184: шаг зубцов — кнопка + зазор
      for (const c of r.children) if (!c.matches('.gz-hx')) { c.style.minHeight = ''; const ch = c.offsetHeight; if (ch) c.style.minHeight = Math.ceil(ch / P) * P + 'px'; }
      const w = r.offsetWidth, n = Math.max(1, Math.ceil(r.offsetHeight / P)), h = n * P;
      r.style.height = h + 'px'; const pt = [[D, 0], [w - D, 0]];
      for (let k = 0; k < n; k++) pt.push([w, k * P + P / 2], [w - D, (k + 1) * P]);
      pt.push([D, h]); for (let k = n - 1; k >= 0; k--) pt.push([0, k * P + P / 2], [D, k * P]);
      const c = getComputedStyle(r).getPropertyValue('--c').trim() || '#7cbcff', d = pt.map(q => q.join(',')).join(' ');
      r.style.clipPath = 'polygon(' + pt.map(q => q[0] + 'px ' + q[1] + 'px').join(',') + ')';
      r.style.backgroundImage = 'url("data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><polygon points="${d}" fill="#0d1119" fill-opacity=".96" stroke="none" stroke-linejoin="round"/></svg>`) + '")'; };
    // v0.165: «у этих кнопок тоже закреп» — значок закрепа у названия группы, как в рейке: закреплённый список не закрывается
    // (щелчок мимо, Esc, открытие другой группы). На телефоне закреп не действует — там список один, на всю ширину.
    const PIN_DD = 'mayatnik-dd-pins', keyOf = g => g.dataset.k || g.querySelector('.pt-l').firstChild.textContent.trim();   // data-k — у «Правки»-кнопки (v0.229)
    let pins = new Set(); try { pins = new Set(JSON.parse(localStorage.getItem(PIN_DD) || '[]')); } catch (_) {}
    // v0.166: «если закреп сверну, то не убирай закреп-галку… только если закреп уберу» — щелчок по названию закреплённой группы
    // только сворачивает её (закреп горит), развернул снова — опять не закрывается; снимается закреп только значком
    const FOLD_DD = 'mayatnik-dd-fold'; let folds = new Set(); try { folds = new Set(JSON.parse(localStorage.getItem(FOLD_DD) || '[]')); } catch (_) {}
    const saveDd = () => { try { localStorage.setItem(PIN_DD, JSON.stringify([...pins])); localStorage.setItem(FOLD_DD, JSON.stringify([...folds])); } catch (_) {} };
    const pinned = g => !narrow.matches && pins.has(keyOf(g)) && !g.classList.contains('pt-btn'), stay = g => pinned(g) && !folds.has(keyOf(g)), groupsAll = () => [...tools.querySelectorAll('.pt-g')];
    const place = g => { const r = g.querySelector('.pt-r'); r.style.left = r.style.top = '';
      // v0.172: «ширину, где можно, сделай как у заголовка» — список не уже названия группы и не шире своих кнопок (CSS: width max-content)
      r.style.minWidth = narrow.matches ? '' : g.querySelector('.pt-l').offsetWidth + 'px'; requestAnimationFrame(() => zig(r));
      // v0.159: на телефоне список — под полоской на всю ширину экрана (position: fixed, полоска листается вбок и обрезала бы его)
      if (narrow.matches) { r.style.top = Math.round(g.querySelector('.pt-l').getBoundingClientRect().bottom + 4) + 'px'; return; }
      const b = r.getBoundingClientRect(); if (b.right > innerWidth - 4) r.style.left = Math.min(0, innerWidth - 4 - b.right) + 'px'; };
    // v0.184: «исправь наложение» — открытые (закреплённые) списки не наезжают друг на друга: слева направо, следующий — не левее правого края предыдущего
    const noOverlap = () => { if (narrow.matches) return; let edge = -Infinity;
      for (const g of groupsAll().filter(x => x.classList.contains('pt-open')).sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left)) {
        const r = g.querySelector('.pt-r'), b = r.getBoundingClientRect(); if (!b.width) continue;
        if (b.left < edge + 4) { r.style.left = ((parseFloat(r.style.left) || 0) + edge + 4 - b.left) + 'px'; edge = edge + 4 + b.width; } else edge = b.right; } };
    const setOpen = (g, on) => { g.classList.toggle('pt-open', on); g.classList.toggle('pt-pinned', pinned(g)); g.querySelector('.pt-l').setAttribute('aria-expanded', String(on)); if (on) place(g); requestAnimationFrame(() => requestAnimationFrame(noOverlap)); };
    const pinsSync = () => { for (const g of groupsAll()) { const on = stay(g) || g === open; if (g.classList.contains('pt-open') !== on) setOpen(g, on); else g.classList.toggle('pt-pinned', pinned(g)); } };
    addEventListener('resize', () => { grid?.relayout(); for (const g of groupsAll()) if (g.classList.contains('pt-open')) { place(g); zig(g.querySelector('.pt-r')); } requestAnimationFrame(noOverlap); });
    const shut = () => { if (!open) return; const g = open; open = null; if (!stay(g)) setOpen(g, false); };
    const show = g => { if (open === g) return; shut(); open = g; if (!g.classList.contains('pt-open')) setOpen(g, true); };
    // v0.229: «отм. и повт. сделай одной кнопкой пополам, и это кнопка в меню» — «Правка» не раскрывается списком: само название — кнопка пополам
    // «↶ Отм. | ↷ Повт.» (жмёт прежние «Отмена» / «Повтор»); тянется по сетке и сворачивается в ромб ↶ ↷, как остальные; ключ раскладки — прежний («Правка»)
    const ud = gHistory.parentElement, udL = ud.querySelector('.pt-l');
    { ud.classList.add('pt-btn'); ud.dataset.k = 'Правка'; udL.textContent = '';
      const half = (src, glyph, name) => { const e = $(src), s = document.createElement('span'), a = document.createElement('span'), n = document.createElement('span');
        s.className = 'pt-ud'; s.setAttribute('role', 'button'); s.tabIndex = 0; a.className = 'pt-ud-g'; a.textContent = glyph; n.className = 'pt-ud-n'; n.textContent = name; s.append(a, n);
        const go = () => { if (!e.disabled) { e.click(); placeTools(); } };
        s.addEventListener('click', go); s.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); go(); } });
        toolSync.push(() => { const off = !!e.disabled; s.classList.toggle('dis', off); s.title = tip(e) + (off ? ' — пока нечего' : ''); }); return s; };
      const sep = document.createElement('span'); sep.className = 'pt-ud-sep';
      // v0.368: «эти кнопки такие же скопируй (↶ ◆ ↷ Синхрофазотрона), но ось здесь не сдвигается и ромб оси на месте; клик по нему — замораживает масштаб,
      // то есть ставит «Верх» и «Вниз»»: ромб посередине «Правки» (она стоит над осью), горит — оба края держатся; ещё щелчок — оба снять
      const ax = document.createElement('span'); ax.className = 'pt-ud-ax'; ax.setAttribute('role', 'button'); ax.tabIndex = 0;
      const pz = id => $(id)?.getAttribute('aria-pressed') === 'true', axGo = ev => { ev?.stopPropagation(); const on = pz('zTop') && pz('zFitH');
        for (const id of ['zTop', 'zFitH']) if (pz(id) === on) $(id).click(); placeTools(); };
      ax.addEventListener('click', axGo); ax.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); axGo(ev); } });
      toolSync.push(() => { const on = pz('zTop') && pz('zFitH'); ax.classList.toggle('on', on); ax.title = on ? 'Масштаб заморожен: держатся «Верх» и «Вниз» · щелчок — снять оба' : 'Заморозить масштаб: включить «Верх» и «Вниз» (верх и низ поля держатся, масштаб не меняется)'; });
      udL.append(half('bFillUndo', '↶', 'Отм.'), sep, ax, half('bFillRedo', '↷', 'Повт.')); }
    for (const g of groupsAll()) { const l = g.querySelector('.pt-l'), row = g.querySelector('.pt-r');
      l.tabIndex = 0; l.setAttribute('role', 'button'); l.setAttribute('aria-haspopup', 'true'); l.setAttribute('aria-expanded', 'false');
      const pin = document.createElement('span'); pin.className = 'pt-pin'; pin.title = 'Закрепить: список не закрывается';
      pin.innerHTML = '<svg viewBox="0 0 16 16" width="11" height="11"><path d="M10.5 1.5l4 4-1.6.4-2.6 2.6.3 3.2-1.4 1.4-2.5-2.5-4 4-.7-.7 4-4L3.5 7.4l1.4-1.4 3.2.3 2.6-2.6z" fill="currentColor"/></svg>';
      pin.addEventListener('pointerdown', e => e.stopPropagation());
      pin.addEventListener('click', e => { e.stopPropagation(); const k = keyOf(g); folds.delete(k); if (pins.has(k)) pins.delete(k); else pins.add(k);
        saveDd(); if (!pins.has(k) && open !== g) setOpen(g, false); pinsSync(); });
      l.append(pin);
      l.onclick = () => { if (pinned(g)) { const k = keyOf(g); if (stay(g)) { folds.add(k); if (open === g) open = null; setOpen(g, false); } else { folds.delete(k); setOpen(g, true); } saveDd(); return; }
        if (open === g && Date.now() - (g._hoverAt || 0) < 900) return;   // только что раскрылся наведением — щелчок его не захлопывает
        open === g ? shut() : show(g); };
      l.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); l.click(); } };
      l.onpointerenter = e => { if (e.pointerType === 'mouse' && !tools.classList.contains('pt-dragging') && open !== g && !g.classList.contains('pt-open')) { g._hoverAt = Date.now(); show(g); } };   // v0.170: «раскрывай сразу при наведении» — мышью без щелчка
      // v0.169: «не скрывается при уходе» — мышь ушла с названия и списка: незакреплённый список закрывается (с запасом 350 мс на переход)
      g.addEventListener('pointerleave', e => { if (e.pointerType !== 'mouse') return; clearTimeout(g._leave);
        g._leave = setTimeout(() => { if (open === g && !stay(g) && !g.matches(':hover')) shut(); }, 350); });
      g.addEventListener('pointerenter', () => clearTimeout(g._leave));   // v0.159: на касании enter приходит перед щелчком и закрывал список
      toolSync.push(() => g.classList.toggle('pt-has-on', !!row.querySelector('.on'))); }
    udL.onclick = udL.onkeydown = udL.onpointerenter = null; udL.tabIndex = -1; udL.removeAttribute('role'); udL.removeAttribute('aria-haspopup'); udL.removeAttribute('aria-expanded');   // v0.229: списка нет — жмут половинки
    // v0.193: «дай менять местами» — группу полосы тянут за название вбок, она встаёт между соседями; порядок — в памяти браузера (mayatnik-dd-order)
    // v0.225: «дай двигать кнопки маятника вверху в любое место в сетке, но чтоб не перекрывались» — названия групп, ромбы и «?» тянут куда угодно
    // по невидимой сетке шапки: шаг вбок — t = 12/√3 ≈ 6,93 px (сетка треугольников), ряд — 28 px, рядов до MAXR; первый ряд — правее заголовка,
    // ниже — во всю ширину шапки. Место занято — встаёт в ближайшее свободное (пока тянут, оно обведено пунктиром, ряды сетки видны).
    // Шапка растёт рядами вниз, поле — под ней: на холст не налезает. Память — mayatnik-dd-grid { имя: [столбец, ряд, очерёдность] } — куда поставили;
    // не влезло по ширине окна — место считается заново при раскладке (позже поставленное главнее), память при этом не трогается.
    // Двойной щелчок по пустому месту шапки — всё по умолчанию (прежнее — копией в mayatnik-dd-grid_pered_sbrosom), ещё раз — вернуть.
    // На телефоне сетки нет: полоса листается вбок, как была, порядок — по рядам сетки.
    // v0.232: на компьютере полоса всегда по сетке (без своей раскладки — подряд, как текст); «Правка» («↶ Отм. | ↷ Повт.») закреплена по середине
    // шапки, не тянется, остальные её обходят. «это тоже чтобы можно вверх» — группу левой рейки тянут за шапку в шапку страницы: там она
    // в сетке, кнопки — выпадающим списком под шапкой группы (mayatnik-dd-up — их id, место — в mayatnik-dd-grid как «gz:id»); оттуда — ниже шапки —
    // обратно в рейку. На телефоне такие группы — в рейке.
    { const ORDER = 'mayatnik-dd-order', GRID = 'mayatnik-dd-grid', BAK = 'mayatnik-dd-grid_pered_sbrosom', UPK = 'mayatnik-dd-up', head = tools.closest('header');
      const SX = 12 / Math.sqrt(3), SY = 28, GAP = 4, MAXR = 6, factory = groupsAll().map(keyOf);
      const ups = () => [...tools.querySelectorAll(':scope > .gz-group')], items = () => [...groupsAll(), $('mayCorner'), ...ups()].filter(Boolean);
      const idOf = el => el.id === 'mayCorner' ? '?' : el.classList.contains('gz-group') ? 'gz:' + el.dataset.id : keyOf(el);
      const arrange = keys => { const gs = groupsAll(), at = k => { const i = keys.indexOf(keyOf(k)); return i < 0 ? keys.length + gs.indexOf(k) : i; }, end = gs[gs.length - 1].nextSibling;
        for (const g of [...gs].sort((a, b) => at(a) - at(b))) tools.insertBefore(g, end); };
      try { const k = JSON.parse(localStorage.getItem(ORDER) || 'null'); if (Array.isArray(k)) arrange(k); } catch (_) {}
      let gw = null; try { const v = JSON.parse(localStorage.getItem(GRID) || 'null'); if (v && typeof v === 'object' && !Array.isArray(v)) gw = v; } catch (_) {}
      const saveGrid = () => { if (gw && !Object.keys(gw).length) gw = null; try { if (gw) localStorage.setItem(GRID, JSON.stringify(gw)); else localStorage.removeItem(GRID); } catch (_) {} };
      const ok = p => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]), topT = () => Math.max(0, ...Object.values(gw || {}).map(p => +(p && p[2]) || 0));
      let up = []; try { const a = JSON.parse(localStorage.getItem(UPK) || '[]'); if (Array.isArray(a)) up = a.filter(x => typeof x === 'string'); } catch (_) {}
      const saveUp = () => { try { if (up.length) localStorage.setItem(UPK, JSON.stringify(up)); else localStorage.removeItem(UPK); } catch (_) {} };
      // v0.390: «все группы кнопок перемещать — верх, нижняя полоска и левый бок»: группы «внизу» (bot) — в нижней полосе у левого края, список — вверх.
      // Живут в шапке (её стили), стоят position: fixed над полосой; рейки — ещё и в up. Тянуть — как в шапке; отпустили над полосой — вниз, выше — наверх / в рейку
      let bot = []; try { const a = JSON.parse(localStorage.getItem('mayatnik-bot') || '[]'); if (Array.isArray(a)) bot = a.filter(x => typeof x === 'string'); } catch (_) {}
      const saveBot = () => { try { if (bot.length) localStorage.setItem('mayatnik-bot', JSON.stringify(bot)); else localStorage.removeItem('mayatnik-bot'); } catch (_) {} };
      const isBot = el => bot.includes(idOf(el)), barTop = () => { const b = $('mayBottomBar'); return b && b.getClientRects().length ? b.getBoundingClientRect().top : Infinity; };
      // v0.406: «в любое место нижней полосы группу поставить без наездов»: своё место — botX[id] (x на экране, куда отпустили); по порядку слева направо,
      // не налезая на соседние группы и на связку «×N | ползунок | время | Хорр», в пределах полосы
      let botX = {}; try { const o = JSON.parse(localStorage.getItem('mayatnik-botx') || '{}'); if (o && typeof o === 'object') botX = o; } catch (_) {}
      const saveBotX = () => { try { localStorage.setItem('mayatnik-botx', JSON.stringify(botX)); } catch (_) {} };
      const placeBot = () => { const bar = $('mayBottomBar'), R = bar && bar.getClientRects().length ? bar.getBoundingClientRect() : null;
        const list = []; for (const el of items()) { if (!isBot(el) || narrow.matches || !R) { if (el.classList.contains('pt-bot')) { el.classList.remove('pt-bot'); el.style.bottom = ''; } continue; } list.push(el); }
        if (!R || !list.length) return;
        const busyX = [...bar.children].filter(e => e.matches('.may-bb-half, .gz-sl, #mayBbHorr')).map(e => e.getBoundingClientRect()).filter(r => r.width).map(r => [r.left - 6, r.right + 6]);
        let def = R.left + 8; const want = el => { const v = +botX[idOf(el)]; return Number.isFinite(v) ? v : def; };
        const occ = busyX.slice();
        for (const el of list.sort((p, q) => want(p) - want(q))) { el.classList.add('pt-bot'); const hd = el.querySelector(':scope > .pt-l, :scope > .gz-head') || el, h = hd.offsetHeight || 24, w = hd.offsetWidth || el.offsetWidth;
          let x = Math.max(R.left + 4, Math.min(R.right - w - 4, want(el))), guard = 0;
          for (let hit = occ.find(([a, b]) => x < b && x + w > a); hit && guard < 40; hit = occ.find(([a, b]) => x < b && x + w > a), guard++) x = hit[1] + 6 + w > R.right - 4 ? Math.max(R.left + 4, hit[0] - w - 6) : hit[1] + 6;
          occ.push([x - 6, x + w + 6]); def = x + w + 6;
          el.style.top = ''; el.style.left = Math.round(x) + 'px'; el.style.bottom = Math.round(innerHeight - R.bottom + (R.height - h) / 2) + 'px'; } };
      const railOrder = [...rail.el.querySelectorAll(':scope > .gz-group')].map(b => b.dataset.id);
      const boxOf = id => [...rail.el.children, ...tools.children].find(b => b.classList.contains('gz-group') && b.dataset.id === id);
      // обратно в рейку: по месту курсора (y) или на своё место по порядку рейки
      const toRail = (box, y) => { const kids = [...rail.el.querySelectorAll(':scope > .gz-group')], ri = railOrder.indexOf(box.dataset.id);
        const at = y == null ? kids.find(k => railOrder.indexOf(k.dataset.id) > ri) : kids.find(k => y < k.getBoundingClientRect().top + 12);
        rail.el.insertBefore(box, at || null); box.style.left = box.style.top = ''; box.style.removeProperty('--gdx'); box.classList.remove('pt-drag'); };
      const placeUps = () => { for (const id of up) { const b = boxOf(id); if (!b) continue; if (narrow.matches) { if (b.parentElement !== rail.el) toRail(b); } else if (b.parentElement !== tools) tools.append(b); } };
      // порядок в DOM (телефон, Tab) — по рядам сетки
      const domSort = () => { if (!gw) return; const at = el => gw[idOf(el)], all = items(), a = all.filter(el => ok(at(el))).sort((x, y) => at(x)[1] - at(y)[1] || at(x)[0] - at(y)[0]);
        for (const el of [...a, ...all.filter(el => !ok(at(el)))]) tools.append(el); };
      const room = () => { const T = tools.getBoundingClientRect(), H = head.getBoundingClientRect(), pl = parseFloat(getComputedStyle(head).paddingLeft) || 0;
        return { W: tools.clientWidth, neg: Math.floor(Math.max(0, T.left - H.left - pl) / SX) }; };
      const busy = (row, x, w) => (row || []).some(([a, b]) => x < b + GAP && x + w + GAP > a);
      // ближайшее к (c0, r0) свободное место шириной w — не ближе GAP к занятым; ряд «дороже» столбца, чтобы сперва искать вбок в том же ряду
      const fit = (occ, w, c0, r0, B) => { let best = null, bd = Infinity;
        for (let r = 0; r < MAXR; r++) { const lo = r ? -B.neg : 0, hi = Math.max(lo, Math.floor((B.W - w) / SX));
          for (let c = lo; c <= hi; c++) { if (busy(occ[r], c * SX, w)) continue;
            const dd = Math.hypot((c - c0) * SX, (r - r0) * SY * 4); if (dd < bd) { bd = dd; best = [c, r]; } } }
        if (best) return best; let r = MAXR; while (occ[r]?.length) r++; return [-B.neg, r]; };   // окно слишком узкое — ряд ниже всех
      // подряд, как текст: первое свободное место не раньше курсора (раскладка по умолчанию и кнопки без своего места)
      const seq = (occ, w, B, [c0, r0]) => { const hi = Math.max(0, Math.floor((B.W - w) / SX));
        for (let r = r0; ; r++) for (let c = r === r0 ? c0 : 0; c <= hi; c++) if (!busy(occ[r], c * SX, w)) return [c, r]; };
      let shown = new Map(), sig = '', d = null, rd = null, rdown = null, swallow = false;
      const sigOf = () => tools.clientWidth + ':' + items().map(el => el.getClientRects().length ? el.offsetWidth : 0).join(',');
      const snap = () => { gw = {}; let i = 0; for (const [it, [c, r]] of shown) if (it !== ud) gw[idOf(it)] = [c, r, i++]; };   // своей раскладки ещё нет — снять с того, как стоит сейчас
      // v0.389: «по середине на ось, чтоб ромб встал»: центр ромба «Правки» — на оси якоря (window.mayAxisX, экранный x); нет оси — середина плея / шапки.
      // Зовёт и страница (прокрутка, масштаб) — window.mayUdPlace
      const udPlace = () => { if (narrow.matches || !ud.getClientRects().length) return; const T = tools.getBoundingClientRect(), H = head.getBoundingClientRect(), w = ud.offsetWidth, axEl = ud.querySelector('.pt-ud-ax');
        const pl = document.querySelector('#mayBottomBar .may-bb-play'), pr = pl && pl.getClientRects().length ? pl.getBoundingClientRect() : null, axX = window.mayAxisX?.();
        const cx = Number.isFinite(axX) ? axX : pr ? pr.left + pr.width / 2 : H.left + H.width / 2, U = ud.getBoundingClientRect(), A = axEl?.getBoundingClientRect(), off = A && A.width ? A.left + A.width / 2 - U.left : w / 2;
        const v = Math.round(Math.max(0, Math.min(tools.clientWidth - w, cx - T.left - off))) + 'px'; if (ud.style.left !== v) ud.style.left = v; };
      window.mayUdPlace = udPlace;
      const relayout = () => { const all = items();
        if (narrow.matches) { if (tools.classList.contains('pt-grid')) { tools.classList.remove('pt-grid'); head.classList.remove('may-grid'); tools.style.height = ''; for (const el of all) el.style.left = el.style.top = ''; } shown = new Map(); sig = ''; return; }
        tools.classList.add('pt-grid'); head.classList.add('may-grid'); if (!tools.getClientRects().length) return;   // дзен — шапки нет
        const B = room(), occ = [], at = el => gw?.[idOf(el)], held = d?.on && d.el, vis = all.filter(el => el.getClientRects().length && el !== held && !isBot(el));
        shown = new Map(); let rows = 1;
        const put = (el, [c, r], w) => { (occ[r] ||= []).push([c * SX, c * SX + w]); shown.set(el, [c, r, w]); rows = Math.max(rows, r + 1); el.style.left = Math.round(c * SX) + 'px'; el.style.top = r * SY + 'px'; };
        if (vis.includes(ud)) { const w = ud.offsetWidth, H = head.getBoundingClientRect(), T = tools.getBoundingClientRect();   // «Правка» — по середине шапки, первой
          put(ud, [Math.max(0, Math.min(Math.floor((B.W - w) / SX), Math.round((H.left + H.width / 2 - T.left - w / 2) / SX))), 0], w);
          // v0.344: «поставь по центру над осью, как плей внизу» — ровно над серединой плея нижней полосы (без шага сетки), нет плея — середина шапки
          udPlace(); }
        // v0.368: «верхнее меню сделай полосой одной»: все группы — в одну строку, порядок — как стояли (ряд, затем столбец), «Правку» над осью обходят
        const rest = vis.filter(el => el !== ud), key = el => ok(at(el)) ? at(el)[0] + at(el)[1] * 1e-3 : 1e9 + rest.indexOf(el);   // v0.386: в одну строку — порядок по столбцу
        let c1 = 0; for (const el of rest.slice().sort((x, y) => key(x) - key(y))) { const w = el.offsetWidth, hiC = Math.max(c1, Math.floor((B.W - w) / SX)); let c = Math.min(hiC, Math.max(c1, ok(at(el)) ? at(el)[0] : c1)); while (busy(occ[0], c * SX, w)) c++; put(el, [c, 0], w); c1 = c + Math.ceil((w + GAP) / SX); }   // v0.386: «не даёт разместить вправо» — свой столбец (куда перетащили), до правого края; друг на друга не налезают
        const T = tools.getBoundingClientRect(); for (const el of ups()) { const s = shown.get(el); if (!s) continue;   // список группы рейки — не за правый край окна
          const over = T.left + s[0] * SX + 244 - (innerWidth - 6); el.style.setProperty('--gdx', over > 0 ? -Math.ceil(over) + 'px' : '0px'); }
        tools.style.height = rows * SY - GAP + 'px'; sig = sigOf(); placeBot(); };
      const reopen = () => { for (const o of groupsAll()) if (o.classList.contains('pt-open')) place(o); requestAnimationFrame(noOverlap); };
      addEventListener('click', e => { if (swallow) { e.stopPropagation(); e.preventDefault(); swallow = false; } }, true);
      const ghost = document.createElement('div'), bg0 = document.createElement('div'), bg1 = document.createElement('div'); ghost.className = 'pt-ghost'; bg0.className = bg1.className = 'pt-gridbg';
      const showGrid = (B, w, c) => { const { W, neg } = B; bg0.style.cssText = `left:0;top:0;width:${W}px;height:${SY - GAP}px`;
        bg1.style.cssText = `left:${(-neg * SX).toFixed(2)}px;top:${SY}px;width:${(W + neg * SX).toFixed(2)}px;height:${(MAXR - 1) * SY - GAP}px`;
        ghost.style.width = w + 'px'; ghost.style.display = ''; ghost.style.setProperty('--c', c || '#7cbcff'); tools.prepend(bg0, bg1); tools.append(ghost); };
      const hideGrid = () => { ghost.remove(); bg0.remove(); bg1.remove(); $('mayatnikRail').classList.remove('may-drop'); document.body.classList.remove('may-raildrag'); };
      const occOf = skip => { const o = []; for (const [it, [c, r, w]] of shown) if (it !== skip) (o[r] ||= []).push([c * SX, c * SX + w]); return o; };
      const ghostAt = p => { ghost.style.left = Math.round(p[0] * SX) + 'px'; ghost.style.top = p[1] * SY + 'px'; };
      // движение и отпускание слушаются на окне: элемент едет за мышью поверх всего
      addEventListener('pointermove', e => { if (!d || d.dead || e.pointerId !== d.id) return; const el = d.el;
        if (!d.on) { if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < 6) return; shut(); if (!gw) { d.fresh = true; snap(); } if (el.classList.contains('pt-bot')) { el.classList.remove('pt-bot'); el.style.bottom = ''; }
          const r = el.getBoundingClientRect(); Object.assign(d, { on: true, ox: d.x - r.left, oy: d.y - r.top, w: el.offsetWidth, B: room(), occ: occOf(el) });
          tools.classList.add('pt-dragging'); el.classList.add('pt-drag'); showGrid(d.B, d.w, getComputedStyle(el).getPropertyValue('--c').trim()); }
        e.preventDefault(); const T = tools.getBoundingClientRect(), x = e.clientX - d.ox - T.left, y = e.clientY - d.oy - T.top;
        el.style.left = x + 'px'; el.style.top = y + 'px';
        d.bot = e.clientY > barTop() - 6;   // v0.390: над нижней полосой — вниз
        d.down = !d.bot && el.classList.contains('gz-group') && e.clientY > head.getBoundingClientRect().bottom + 24;   // группу рейки опустили ниже шапки — обратно в рейку
        $('mayatnikRail').classList.toggle('may-drop', d.down); $('mayBottomBar')?.classList.toggle('may-bbdrop', d.bot); ghost.style.display = d.down || d.bot ? 'none' : '';
        d.at = fit(d.occ, d.w, Math.round(x / SX), Math.round(y / SY), d.B); ghostAt(d.at); });
      const end = e => { if (!d || e.pointerId !== d.id) return; const { el, on: moved, at, dead, fresh, down, bot: toBot } = d; $('mayBottomBar')?.classList.remove('may-bbdrop');
        d = e.type === 'esc' ? { id: d.id, dead: true } : null;   // Esc — отмена; щелчок от отпускания потом проглотить
        if (dead) { swallow = e.type === 'pointerup'; setTimeout(() => { swallow = false; }, 0); return; }
        if (!moved) return; if (e.type === 'pointerup') { swallow = true; setTimeout(() => { swallow = false; }, 0); }
        tools.classList.remove('pt-dragging'); el.classList.remove('pt-drag'); hideGrid();
        if (e.type === 'pointerup') { const id = idOf(el); bot = bot.filter(x => x !== id); if (toBot) { bot.push(id); botX[id] = Math.round(el.getBoundingClientRect().left); saveBotX(); if (el.classList.contains('gz-group') && !up.includes(el.dataset.id)) { up.push(el.dataset.id); saveUp(); } } saveBot(); }   // v0.390
        if (e.type === 'pointerup' && toBot) { if (fresh) gw = null; }
        else if (e.type === 'pointerup' && down) { if (fresh) gw = null; else if (gw) delete gw[idOf(el)]; up = up.filter(x => x !== el.dataset.id); saveUp(); saveGrid(); toRail(el, e.clientY); }
        else if (e.type === 'pointerup' && at) { gw[idOf(el)] = [at[0], at[1], topT() + 1]; saveGrid(); domSort(); } else if (fresh) gw = null;
        relayout(); reopen(); };
      addEventListener('pointerup', end, true); addEventListener('pointercancel', end, true);
      addEventListener('keydown', e => { if (e.key === 'Escape' && d?.on) end({ pointerId: d.id, type: 'esc' }); }, true);
      const start = (el, e) => { if (e.button !== 0 || narrow.matches || el === ud) return; d = { el, x: e.clientX, y: e.clientY, id: e.pointerId, on: false }; };
      for (const g of groupsAll()) g.querySelector('.pt-l').addEventListener('pointerdown', e => start(g, e));
      { const c = $('mayCorner'); c.addEventListener('pointerdown', e => start(c, e)); const h = $('mayHelp'); if (h) h.title += ' · тянуть — переставить'; }
      // группа рейки в шапке: шапку группы тянет сетка (перестановку в рейке grozd тут не начинает); щелчок мимо — незакреплённая сворачивается
      tools.addEventListener('pointerdown', e => { const h = e.target.closest('.gz-head'), box = h?.parentElement; if (!h || box?.parentElement !== tools) return;
        e.stopPropagation(); if (!e.target.closest('.gz-pin')) start(box, e); }, true);
      addEventListener('pointerdown', e => { for (const b of ups()) if (b.classList.contains('gz-open') && !b.classList.contains('gz-pinned') && !b.contains(e.target) && !e.target.closest?.('.gz-ladder')) rail.close(); }, true);
      // группа рейки едет за мышью (grozd, .gz-drag): над шапкой — пунктиром место в сетке; отпустили там — группа наверх
      rail.el.addEventListener('pointerdown', e => { const h = e.target.closest('.gz-head'); rdown = null; if (h && e.button === 0 && !narrow.matches) { const r = h.getBoundingClientRect(); rdown = { ox: e.clientX - r.left, oy: e.clientY - r.top }; } }, true);
      addEventListener('pointermove', e => { if (!rdown) return; const box = rail.el.querySelector(':scope > .gz-group.gz-drag'); if (!box) return;
        if (!rd) { rd = { box, w: box.querySelector('.gz-head').offsetWidth, B: room(), occ: occOf(null) }; document.body.classList.add('may-raildrag'); showGrid(rd.B, rd.w, getComputedStyle(box).getPropertyValue('--c').trim()); }
        box.style.left = (e.clientX - rdown.ox) + 'px';   // grozd в столбце тянет только вверх-вниз — вбок ведём сами
        const T = tools.getBoundingClientRect(), over = e.clientY < head.getBoundingClientRect().bottom + 6;
        rd.at = over ? fit(rd.occ, rd.w, Math.round((e.clientX - rdown.ox - T.left) / SX), Math.round((e.clientY - rdown.oy - T.top) / SY), rd.B) : null;
        rd.bot = e.clientY > barTop() - 6; $('mayBottomBar')?.classList.toggle('may-bbdrop', rd.bot); if (rd.bot) rd.at = null;   // v0.390: группу рейки — вниз
        ghost.style.display = over && !rd.bot ? '' : 'none'; if (over && !rd.bot) ghostAt(rd.at); }, true);
      addEventListener('pointerup', ev => { const rox = rdown?.ox || 0; rdown = null; if (!rd) return; const { box, at, bot: toBot } = rd; rd = null; hideGrid(); $('mayBottomBar')?.classList.remove('may-bbdrop');
        if (toBot) { const dropX = Math.round(ev.clientX - rox); setTimeout(() => { const id = 'gz:' + box.dataset.id; botX[id] = dropX; saveBotX(); if (!up.includes(box.dataset.id)) up.push(box.dataset.id); if (!bot.includes(id)) bot.push(id); saveUp(); saveBot(); tools.append(box); domSort(); relayout(); }, 0); return; }   // v0.390
        if (!at) return;
        setTimeout(() => { if (!gw) snap(); gw['gz:' + box.dataset.id] = [at[0], at[1], topT() + 1]; if (!up.includes(box.dataset.id)) up.push(box.dataset.id);   // grozd уже вернул её в рейку — переносим
          saveUp(); saveGrid(); tools.append(box); domSort(); relayout(); }, 0); }, true);
      // двойной щелчок по пустому месту шапки: своя раскладка есть — по умолчанию (копия остаётся), нет — вернуть копию
      head.addEventListener('dblclick', e => { if (e.target !== head && e.target !== tools) return; let ord = null; try { ord = localStorage.getItem(ORDER); } catch (_) {}
        if (gw || ord || up.length) { try { localStorage.setItem(BAK, JSON.stringify({ grid: gw, order: ord, up })); localStorage.removeItem(ORDER); } catch (_) {}
          for (const b of ups()) toRail(b); gw = null; up = []; saveUp(); saveGrid(); arrange(factory); tools.append($('mayCorner')); }
        else { let b = null; try { b = JSON.parse(localStorage.getItem(BAK) || 'null'); } catch (_) {} if (!b) return;
          gw = b.grid && typeof b.grid === 'object' && !Array.isArray(b.grid) ? b.grid : null; up = Array.isArray(b.up) ? b.up : []; saveGrid(); saveUp();
          try { if (b.order) { localStorage.setItem(ORDER, b.order); const k = JSON.parse(b.order); if (Array.isArray(k)) arrange(k); } localStorage.removeItem(BAK); } catch (_) {} placeUps(); domSort(); }
        shut(); relayout(); reopen(); });
      grid = { relayout, tick: () => { if (!narrow.matches && !d?.on && !rd && sigOf() !== sig) relayout(); },
        touch: k => { if (gw && ok(gw[k])) { gw[k][2] = topT() + 1; saveGrid(); } relayout(); } };   // правый щелчок (ромб ↔ название): тот, кого меняли, остаётся на месте, соседи уступают
      narrow.addEventListener('change', () => { placeUps(); relayout(); }); placeUps(); domSort(); relayout(); toolSync.push(grid.tick); }
    // v0.209: «правой кнопкой по кнопке — свернуть кнопку в ромб со значком и сдвинуть все остальные на освободившееся место»:
    // правый щелчок по названию группы полосы — оно сворачивается в ромб со значком (соседи встают вплотную), ещё раз — разворачивается.
    // Список при этом открывается как прежде; свёрнутые — в памяти браузера (mayatnik-dd-mini).
    { const MINI = 'mayatnik-dd-mini', ICO = { 'Точка Ось': '⊹', 'Краска': '✎', 'Очистка': '⌫', 'Оси': '✛', 'Правка': '↶', 'Вид': '◉', 'Зеркала': '⋈', 'Шаблон': '▣', 'Шаблоны': '▤', 'Видео': '⏺' };
      let minis = new Set(); try { minis = new Set(JSON.parse(localStorage.getItem(MINI) || '[]')); } catch (_) {}
      const glyph = k => ICO[k] || ([...k][0] && /[^\p{L}\p{N}]/u.test([...k][0]) ? [...k][0] : k.slice(0, 1));
      for (const g of groupsAll()) { const l = g.querySelector('.pt-l'), k = keyOf(g), ic = document.createElement('span'); ic.className = 'pt-ico'; ic.textContent = glyph(k); l.append(ic);
        const sync = () => { const on = minis.has(k); g.classList.toggle('pt-mini', on); l.title = g.classList.contains('pt-btn') ? 'Правка: ↶ отмена · ↷ повтор · стоит по середине шапки · правый щелчок — ' + (on ? 'развернуть' : 'свернуть в ромб') : on ?k + ' · правый щелчок — развернуть · тянуть — переставить' : 'Щелчок — открыть · тянуть — поставить в любое место шапки (по сетке) · правый щелчок — свернуть в ромб · двойной щелчок по пустому месту шапки — раскладка по умолчанию'; };
        sync(); l.addEventListener('contextmenu', e => { e.preventDefault(); e.stopPropagation(); if (minis.has(k)) minis.delete(k); else minis.add(k);
          try { localStorage.setItem(MINI, JSON.stringify([...minis])); } catch (_) {} sync(); grid?.touch(k); for (const o of groupsAll()) if (o.classList.contains('pt-open')) place(o); requestAnimationFrame(noOverlap); }); }
      // v0.227: «это тоже в ромб сворачивать» — «Что это такое?» правым щелчком — ромб «ℹ», ещё раз — обратно (та же память, ключ — надпись кнопки)
      { const a = $('mayAbout'), k = 'Что это такое?', ic = document.createElement('span'); ic.className = 'pt-ico'; ic.textContent = 'ℹ︎'; a.append(ic); a.setAttribute('aria-label', k);
        const sync = () => { const on = minis.has(k); a.classList.toggle('pt-mini', on); a.title = on ? k + ' · правый щелчок — развернуть' : 'Что такое маятник · правый щелчок — свернуть в ромб'; };
        sync(); a.addEventListener('contextmenu', e => { e.preventDefault(); e.stopPropagation(); if (minis.has(k)) minis.delete(k); else minis.add(k);
          try { localStorage.setItem(MINI, JSON.stringify([...minis])); } catch (_) {} sync(); grid?.relayout(); requestAnimationFrame(noOverlap); }); } }
    grid.relayout();   // v0.225: ромбы v0.209 уже свёрнуты — ширины верные
    narrow.addEventListener('change', pinsSync); requestAnimationFrame(pinsSync);
    addEventListener('pointerdown', e => { if (open && !open.contains(e.target)) shut(); }, true);
    addEventListener('keydown', e => { if (e.key === 'Escape') shut(); });
    tools.addEventListener('scroll', shut, { passive: true }); }
  // v0.190: «те кнопки, в которых список, — покажи выводом всех в соседний столбец при наведении, и у таких кнопок стрелки обводкой справа».
  // Наведение на кнопку-список — столбец всех вариантов справа от столбца, где она (список группы полосы или рейка); нынешний — обводкой,
  // щелчок — выбрать. Щелчок, правый и колесо по самой кнопке — как прежде. В полосе столбец лежит в группе: пока мышь на нём, список не закрывается.
  // v0.191: столбец — общий из grozd (ZerkGrozd.listHover; им же — списки рейки «Ход», «Поле», «Поиск», «Серии», «Область» и хаба);
  // здесь — кнопки полосы и кнопки рейки «по кругу» (Зеркало, Аниматрица).
  { const after = () => { rail.refresh(); placeTools(); };
    const reg = (b, options) => { if (b) ZerkGrozd.listHover(b, { options, after, color: () => getComputedStyle(b).getPropertyValue('--c').trim() || '#7cbcff',
      host: () => b.closest('.pt-g') || document.body, col: () => b.closest('.pt-col, .pt-r, .gz-rail, .gz-soty, .gz-wide') }); };   // v0.226: в «Виде» — правее своего столбца; v0.232: в группе рейки, поднятой в шапку, — правее её списка
    const fromSelect = (sel, nameOf = o => o.textContent, iconOf = null) => () => [...sel.options].map(o => ({ name: nameOf(o), icon: iconOf?.(o), on: o.value === sel.value,
      pick: () => { if (sel.value === o.value) return; sel.value = o.value; sel.dispatchEvent(new Event('change', { bubbles: true })); } }));
    const viewIcon = new Map(Object.entries(viewIcons).map(([v, [kind, t]]) => { const p = document.createElement('button'); p.title = t; return [v, icon(p, kind)]; }));
    reg(tools.querySelector('[data-n="viewCycle"]'), fromSelect($('view'), o => (viewIcons[o.value] || [, o.textContent])[1], o => viewIcon.get(o.value)));
    reg(tools.querySelector('[data-n="fontCycle"]'), fromSelect($('digitFont')));
    reg(tools.querySelector('[data-n="fillArea"]'), fromSelect($('fillArea')));
    reg(tools.querySelector('[data-n="fixLow"]'), () => window.mayFixLowNames.map((name, i) => ({ name, on: (window.mayFixLow?.get() || 0) === i, pick: () => window.mayFixLow?.set(i) })));   // v0.222
    reg(tools.querySelector('[data-n="fixAxis"]'), () => window.mayFixAxisNames.map((name, i) => ({ name: name.slice(5), on: (window.mayFixAxis?.get() || 0) === i, pick: () => window.mayFixAxis?.set(i) })));   // v0.216
    { const M = () => window.mayMir, L = () => window.mayMirLists;   // v0.210
      reg(tools.querySelector('[data-n="mirCol"]'), () => L().col.map(([v, name]) => ({ name, on: M()?.col() === v, pick: () => M()?.set('col', v) })));
      reg(tools.querySelector('[data-n="mirOp"]'), () => L().op.map(([v, name]) => ({ name, on: M()?.op() === v, pick: () => M()?.set('op', v) }))); }
    { const Z = () => window.mayFixMirror; reg(tools.querySelector('[data-n="fixMirror"]'), () => ['Выкл', 'Все биты', 'Шахматка 1', 'Шахматка 2', 'XOR', 'AND', 'Шахм. ход', 'Шахм. антиход', 'Ход | антиход', 'Антиход | ход'].map((name, i) => ({ name, on: (Z()?.get() || 0) === i, pick: () => Z()?.set(i) }))); }
    { const e = $('noband'), mode = () => +e.dataset.mode || 0;   // три положения по кругу: каждое change — следующее
      reg(tools.querySelector('[data-n="noband"]'), () => ['Полосы', 'Без полос', 'До треуг.'].map((name, i) => ({ name, on: mode() === i,
        pick: () => { for (let n = 0; n < 3 && mode() !== i; n++) e.dispatchEvent(new Event('change')); } }))); }
    // рейка: кнопки «по кругу» — кнопка находится по месту пункта в группе, как подсказки выше
    const ring = { bBlackMirror: ['выкл', 'краска', 'всё'], bAnimHl: ['выкл', 'столб', 'всё'] };
    for (const g of groups) { const box = rail.el.querySelector('.gz-group[data-id="' + g.id + '"]'); if (!box) continue;
      const wide = t => ['value', 'list', 'control', 'vpair'].includes(t), a = g.items.filter(i => !wide(i.type)), ca = box.querySelectorAll('.gz-soty > .gz-hx');
      a.forEach((it, i) => { if (it.src === 'zSnap' && ca[i] && window.mayZSnap) { const Z = window.mayZSnap;   // v0.201: кратный ×2…×10 — столбцом
          reg(ca[i], () => [{ name: 'Плавно', on: !Z.on(), pick: () => Z.set(0) }, ...[2, 3, 4, 5, 6, 7, 8, 9, 10].map(b => ({ name: 'Кратный ×' + b, on: Z.on() && Z.base() === b, pick: () => Z.set(b) }))]); } });
      a.forEach((it, i) => { const names = ring[it.src], e = $(it.src); if (!names || !ca[i] || !e) return; const now = () => e.textContent.split(': ')[1];
        reg(ca[i], () => names.map(name => ({ name, on: now() === name, pick: () => { for (let n = 0; n < names.length && now() !== name; n++) e.click(); } }))); }); } }
  // Сведения и действия выбранной фигуры — сворачиваемая панель справа внизу.
  const infoPanel=document.createElement('details');infoPanel.id='mayatnikInfoPanel';infoPanel.open=true;
  const infoTitle=document.createElement('summary');infoTitle.textContent='Сведения';
  // v0.091: скрытые исходные «Сохранить»/«Цвет» с полем цвета — в группу «Шаблон» шапки, чтобы окно цвета открывалось там.
  tools.querySelector('[data-n="bTemplateColour"]')?.parentElement.parentElement.append($('templateActions'));
  infoPanel.append(infoTitle,status);infoRow.append(infoPanel);infoPanel.open=true;   // v0.182: не в углу, а в выпадающей «Сведения» (всегда раскрыта внутри)
  infoPanel.addEventListener('toggle',()=>{try{localStorage.setItem('mayatnik-info-closed',infoPanel.open?'0':'1');}catch(_){}});
  // v0.116: «сдвинь ширину под шаблоны ровно» — «Сведения» той же ширины и с тем же правым краем, что и панель «Шаблоны» (она по содержимому)
  if(0)toolSync.push(()=>{const r=railRIn.getBoundingClientRect();if(!r.width||innerWidth<=600){infoPanel.style.width=infoPanel.style.right='';return;}   // v0.182: панель в выпадающей группе — ширину не подгонять
    const w=Math.max(260,Math.round(r.width))+'px',right=Math.max(0,Math.round(innerWidth-r.right))+'px';if(infoPanel.style.width!==w)infoPanel.style.width=w;if(infoPanel.style.right!==right)infoPanel.style.right=right;});
  // v0.100 (правило кнопок): ползунок без подписи — значение на самой дорожке по центру, по краям шевроны «<» «>»
  // (щелчок — шаг, удержание — подряд), бегунок — ромб цветом группы, дорожка — тонкий пунктир. Как ползунки групп Zazerkalius.
  for (const id of ['frame', 'speed']) {
    const el = $(id), label = el?.closest('label'); if (!label) continue;
    const name = [...label.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join(' ').trim();
    for (const n of [...label.childNodes]) if (n.nodeType === 3) n.remove();   // подпись — только в подсказке
    if (!label.title) label.title = name; label.classList.add('may-slide');
    const out = label.querySelector('output'); if (out) out.classList.add('may-slide-v');
    const step = d => { const v = Math.max(+el.min, Math.min(+el.max, +el.value + d)); if (v === +el.value) return;
      el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
    const chev = (side, d) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'may-chev ' + side; b.tabIndex = -1;
      b.setAttribute('aria-label', d < 0 ? 'Назад на 1' : 'Вперёд на 1'); b.title = (d < 0 ? 'Назад' : 'Вперёд') + ' на 1 · удержание — подряд'; let hold = 0, rep = 0;
      const end = () => { clearTimeout(hold); clearInterval(rep); hold = rep = 0; };
      b.addEventListener('pointerdown', e => { if (e.button !== 0) return; e.preventDefault(); step(d); hold = setTimeout(() => { rep = setInterval(() => step(d), 60); }, 350); });
      for (const t of ['pointerup', 'pointerleave', 'pointercancel', 'blur']) b.addEventListener(t, end);
      b.addEventListener('click', e => e.preventDefault());   // щелчок по кнопке внутри label не должен уводить фокус в ползунок
      return b; };
    label.prepend(chev('l', -1)); label.append(chev('r', 1));
  }
  // v0.173: «везде двойной клик по ползункам — в 0»: двойной щелчок по ползунку (дорожке, его подписи со стрелками, значению рейки)
  // ставит 0, а если 0 меньше наименьшего — наименьшее (скорость — 1). У значений рейки — их кнопка «0».
  document.addEventListener('dblclick', e => {
    const t = e.target; if (!t.closest) return;
    const val = t.closest('.gz-val'); if (val) { const z = val.querySelector('.gz-z'); if (z) { e.preventDefault(); z.click(); } return; }
    const host = t.closest('label.may-slide, .zerk-range-wrap') || t, r = host.matches?.('input[type=range]') ? host : host.querySelector?.('input[type=range]');
    if (!r || r.disabled) return; e.preventDefault();
    const lo = r.min === '' ? 0 : +r.min, hi = r.max === '' ? 100 : +r.max, v = String(Math.max(lo, Math.min(hi, 0)));
    if (r.value === v) return; r.value = v; r.dispatchEvent(new Event('input', { bubbles: true })); r.dispatchEvent(new Event('change', { bubbles: true }));
  }, true);
  { const fb = rail.el.querySelector('.gz-al'); if (fb) toolSync.push(() => { const N = window.mayThirds?.on() ? '⅓' : Math.max(1, +$('speed').value || 1), as = fb.querySelectorAll(':scope > .gz-a:not(.gz-a2)');   // v0.317: подписи стрелок кадра — −N / +N; v0.318 — при «Третях» ±⅓
    if (as[0] && as[0].textContent !== '−' + N) as[0].textContent = '−' + N; if (as[1] && as[1].textContent !== '+' + N) as[1].textContent = '+' + N; }); }
  const placeTools = () => { for (const f of toolSync) f(); };
  addEventListener('resize', placeTools); placeTools();
  // v0.048: любую кнопку рейки — Ctrl + тянуть на холст: там встаёт её копия и держится на месте при сдвиге и масштабе.
  // Копия нажимает настоящую кнопку; тянуть копию — переставить, правая кнопка — убрать.
  const PIN_KEY = 'mayatnik-pins';
  let pins = []; try { pins = JSON.parse(localStorage.getItem(PIN_KEY) || '[]'); } catch (_) {}
  const savePins = () => { try { localStorage.setItem(PIN_KEY, JSON.stringify(pins.map(({ g, i, x, y }) => ({ g, i, x, y })))); } catch (_) {} };
  const cellOf = (g, i) => document.querySelectorAll(`#mayatnikRail .gz-group[data-id="${g}"] .gz-soty > .gz-hx, #paintTools > .gz-group[data-id="${g}"] .gz-soty > .gz-hx`)[i] || null;   // v0.232: группа может быть и в шапке
  function makePin(pin) {
    const src = cellOf(pin.g, pin.i); if (!src) return null;
    const el = src.cloneNode(true); el.classList.add('may-pin'); el.style.display = ''; el.removeAttribute('tabindex'); el.title = (src.title || '') + ' · тянуть — переставить, правая кнопка — убрать';
    document.body.append(el); pin.el = el; pin.src = src;
    el.addEventListener('pointerdown', e => {
      if (e.button !== 0) return; e.preventDefault(); el.setPointerCapture(e.pointerId);
      const x0 = e.clientX, y0 = e.clientY, px = pin.x, py = pin.y; let moved = false;
      const mv = ev => { if (Math.hypot(ev.clientX - x0, ev.clientY - y0) > 3) moved = true; if (moved) { pin.x = px + ev.clientX - x0; pin.y = py + ev.clientY - y0; placePins(); } };
      const upv = () => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', upv); if (moved) savePins(); else src.click(); };
      el.addEventListener('pointermove', mv); el.addEventListener('pointerup', upv);
    });
    el.addEventListener('contextmenu', e => { e.preventDefault(); el.remove(); pins = pins.filter(p => p !== pin); savePins(); });
    return el;
  }
  function placePins() { const r = $('wrap').getBoundingClientRect();
    for (const p of pins) { if (!p.el) continue; p.el.style.left = (r.left + p.x) + 'px'; p.el.style.top = (r.top + p.y) + 'px';
      if (p.src) { p.el.classList.toggle('gz-on', p.src.classList.contains('gz-on')); p.el.classList.toggle('gz-off-dis', p.src.classList.contains('gz-off-dis'));
        const n = p.src.querySelector('.gz-nm'), m = p.el.querySelector('.gz-nm'); if (n && m && m.textContent !== n.textContent) m.textContent = n.textContent; } } }
  pins = pins.filter(p => makePin(p)); placePins();
  let suppressClick = false;
  for (const host of [rail.el, tools]) host.addEventListener('click', e => { if (suppressClick) { suppressClick = false; e.stopPropagation(); e.preventDefault(); } }, true);
  const ctrlPin = e => {
    const cell = e.target.closest('.gz-soty > .gz-hx'); if (!cell || !(e.ctrlKey || e.metaKey) || e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    const g = cell.closest('.gz-group').dataset.id, i = [...cell.parentElement.children].indexOf(cell), r0 = cell.getBoundingClientRect();
    const ghost = cell.cloneNode(true); ghost.classList.add('may-pin', 'may-pin-ghost'); document.body.append(ghost);
    const dx = e.clientX - r0.left, dy = e.clientY - r0.top;
    const mv = ev => { ghost.style.left = (ev.clientX - dx) + 'px'; ghost.style.top = (ev.clientY - dy) + 'px'; }; mv(e);
    const upv = ev => { removeEventListener('pointermove', mv); removeEventListener('pointerup', upv); ghost.remove(); suppressClick = true; setTimeout(() => { suppressClick = false; }, 0);
      const r = $('wrap').getBoundingClientRect();
      if (ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom) {
        const pin = { g, i, x: ev.clientX - dx - r.left, y: ev.clientY - dy - r.top }; if (makePin(pin)) { pins.push(pin); savePins(); placePins(); } } };
    addEventListener('pointermove', mv); addEventListener('pointerup', upv);
  };
  rail.el.addEventListener('pointerdown', ctrlPin, true); tools.addEventListener('pointerdown', ctrlPin, true);   // v0.232: и из групп рейки в шапке
  setInterval(() => { rail.refresh(); relayout(); placeTools(); placePins(); }, 200);
  new ResizeObserver(() => dispatchEvent(new Event('resize'))).observe($('wrap'));
  dispatchEvent(new Event('resize'));
})();
