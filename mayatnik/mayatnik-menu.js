/* Маятник v0.120 (меню полосой — v0.158): page adapter for the shared ZerkGrozd rail.
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
      select('mode', 'swap', {pend:'Лево-право',right:'Вправо',left:'Влево',one:'Одна вершина'}),
      select('bg', 'square', {empty:'Пустое','1':'Все 1','0':'Все 0',chess:'1 шахматкой'}) ] },
    // v0.114: «объедини группы» — кнопки «Хорр» в «Анимации», отдельной группы «Хорр» нет; «Пара сразу» убрана («оставь только по очереди»).
    // v0.115: и «По очереди» убрана — «не нужна теперь, и так автоматом по очереди»
    { id: 'animation', title: 'Анимация', color: '#b9a2ff', items: [
      button('bRowRun', 'down'), check('third', 'tri'),   // «До N/3 — в правую рейку вверх»: вторая по счёту — правый столбец, первая строка   // «+1 / −1 вершина — объедини стрелки»: отдельной «+1 вершина» нет — это стрелки ползунка кадра
      ...[...source.querySelectorAll('button.pre')].map(e => ({ type: 'action', name: e.textContent,
        icon: icon(e, 'field'), tip: e.title || `Построить ${e.dataset.n} строк и вершин (или до N/3)`, click: () => e.click() })),
      { ...num('speed', { name: 'Анимация', tip: 'Скорость анимации', fmt: v => '×' + v, zero: 1 }), name: 'Анимация',   // «Анимация» — включатель внутри своего ползунка скорости
        head: { label: '▶ Анимация', on: () => $('bPlay').getAttribute('aria-pressed') === 'true', click: () => $('bPlay').click() } },
      { ...num('frame', { name: 'Кадр', fmt: v => 'кадр ' + v, zero: 0 }), tip: 'Кадр = вершина · −1 / +1 — на вершину (в паре — пара) · бегунок: щелчок — ▶ пуск / ❚❚ пауза, тянуть — к любой · двойной щелчок — 0',
        arrows: ['−1', '+1'], thumb: { label: () => $('bPlay').getAttribute('aria-pressed') === 'true' ? '❚❚' : '▶', click: () => $('bPlay').click() } } ] },
    // v0.103: группа «Вид» целиком переехала в шапку («перемести всё в Вид сверху») — в рейке её нет
    { id: 'ochki', title: 'Очки', color: '#ffb347', items: [
      button('bOchki', 'eye'), check('ochkiInv', 'half'), check('ochkiRev', 'swap'), check('frozen', 'pin'), button('bBlackMirror', 'mirror'), button('bAnimHl', 'eye'),
      select('ochkiMode', 'line', {diag:'Диагонали',row:'Ряды'}),select('ochkiPattern','steps'),num('ochkiLength',{name:'От бит',slider:false}) ] },
    { id: 'zoom', title: 'Масштаб', color: '#7cbcff', items: [
      pair(tgl('zOut'), tgl('zIn'), '− Дальше', '+ Ближе', { name: 'Масштаб', tip: 'Отдалить · приблизить' }), button('zFit', 'corners'), button('zTop', 'pin'), button('zSnap', 'grid4') ] },
    { id: 'mirrors', title: 'Зеркала', color: '#ff87cf', items: [
      { type: 'toggle', icon: '⋈', name: 'Зерк. ось', tip: 'Зеркальная ось: один конец на нижней границе последней строки (тянется вдоль низа), второй — поворот · отражение поля под полем',   // v0.177
        on: () => !!window.MayMirAxis?.on, click: () => window.MayMirAxis?.toggle() },
      { type: 'toggle', icon: '▱', name: 'Контур', tip: 'Контур: внешняя граница фигуры маятника линиями в 1 px · наведи на линию — она продолжится пунктиром в обе стороны',   // v0.186
        on: () => !!window.MayContour?.on, click: () => window.MayContour?.toggle() },
      check('sym', 'axes'), check('symV', 'axes'), check('symH', 'axes'), check('symD', 'axes'), check('symBits', 'grid4'),   // v0.133: какие оси и их длина / ширина
      check('symTriangles','tri'),button('bTriangleAxes','tri'),num('symTriangleRows',{name:'Высота ≥',tip:'Высота тотемов: строк от',slider:false}),
      { type: 'vpair', name: 'Строк', tip: 'Длина оси: строк от · до', parts: [{ ...num('symRowsMin', { slider: false }), name: 'строк ≥' }, { ...num('symRowsMax', { slider: false, inf: true, fromInf: () => +$('symRowsMin').value || 2 }), name: '≤' }] },
      { type: 'vpair', name: 'Бит', tip: 'Ширина оси: бит от · до', parts: [{ ...num('symBitsMin', { slider: false }), name: 'бит ≥' }, { ...num('symBitsMax', { slider: false, inf: true, fromInf: () => +$('symBitsMin').value || 2 }), name: '≤' }] }, button('bAxisLine', 'line'), button('bAxisMirror', 'down'), button('bAxisXor', 'half'), button('bAxisLinesClear', 'cross') ] },
    { id: 'paint', title: 'Раскраска', color: '#ff9b50', items: [button('bPaintNew','reset'),withColour('bFill','fillColour','Заливка'),button('bAutoVertical','line'),button('bStolb','swap'),button('bPaintMid','line'),withColour('midOneOn','midOneColour','Центр 1'),withColour('midZeroOn','midZeroColour','Центр 0'),check('midWide','line'),button('bAutoAll','steps'),check('fillMirror','mirror'),select('fillArea','grid4'),(()=>{const u=tgl('bFillUndo'),r=tgl('bFillRedo');return pair(u,r,'↶ Отмена','↷ Повтор',{dis:both(u,r)});})(),button('bFillClear','cross'),button('bRegions','grid4'),button('bPaintRestore','undo')] },
    { id: 'template', title: 'Шаблон', color: '#ffd35b', items: [button('bTemplateTake','colour'),button('bTemplateShow','eye'),button('bTemplateClone','copy'),button('bTemplateRemove','cross'),(()=>{const a=tgl('bTemplateFlipH'),b=tgl('bTemplateFlipV');return pair(a,b,'⇆ Отраз.','⇅ Отраз.',{dis:both(a,b),tip:'Отразить шаблон ↔ · ↕'});})(),button('bMirrorLine','line'),button('bMirrorByLine','mirror'),button('bXor2','down'),(()=>{const u=tgl('bFillUndo'),r=tgl('bFillRedo');return pair(u,r,'↶ Отмена','↷ Повтор',{dis:both(u,r)});})(),(()=>{const a=tgl('bTemplateTaller'),b=tgl('bTemplateShorter');return pair(a,b,'+ Выше','− Ниже',{dis:both(a,b),tip:'Шаблон выше · ниже'});})(),button('bTemplateReturn','swap'),button('bTemplateReset','reset'),button('bTemplateTransfer','move'),button('bTemplateFall','down'),button('bTemplatePaint','colour'),check('templateTrail','half'),check('templateProportional','corners'),check('templateLock','pin'),check('templateMask','corners'),num('xorStep',{name:'Шаг k',fmt:v=>'шаг k '+v}),num('templateHeight',{name:'Высота %',log:true,fmt:v=>'высота '+v+' %',zero:100}),num('templateDown',{name:'Вниз, строк',slider:false,zero:0}),num('templateAlpha',{name:'Видимость %',fmt:v=>'видимость '+v+' %',zero:50})] },
    { id:'library',title:'Шаблоны',color:'#d9b9ff',items:[control('templateLibraryChoices'),button('bTemplateImport','folder'),button('bTemplateExport','save')] },
    { id: 'export', title: 'Экспорт', color: '#ffd166', items: [
      button('bPaintSave','save'),button('bPaintOpen','load'),button('bFrameWindow','corners'),
      button('bPng', 'image'), button('bRec', 'record'), button('bGif','record'), button('bTxt', 'save'), button('bDiag', 'steps') ] }
  ];
  const rail = ZerkGrozd.rail($('mayatnikRail'), { key: 'mayatnik', groups });
  // v0.167: подсказки кнопок рейки — в title (их показывает mayatnik-tips.js рядом с кнопкой через 4 с)
  for (const g of groups) { const box = rail.el.querySelector('.gz-group[data-id="' + g.id + '"]'); if (!box) continue;
    const wide = t => ['value', 'list', 'control', 'vpair'].includes(t), a = g.items.filter(i => !wide(i.type)), b = g.items.filter(i => wide(i.type));
    const ca = box.querySelectorAll('.gz-soty > .gz-hx'), cb = box.querySelectorAll('.gz-wide > .gz-hx');
    a.forEach((it, i) => { if (ca[i] && (it.tip || it.name)) ca[i].title = it.tip || it.name; }); b.forEach((it, i) => { if (cb[i] && it.type !== 'control' && it.type !== 'vpair' && (it.tip || it.name)) cb[i].title = it.tip || it.name; }); }
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
  const relayout = () => { for (const soty of [...rail.el.querySelectorAll('.gz-soty'), ...railR.querySelectorAll('.gz-soty')]) {
    const cells = [...soty.children], shown = cells.filter(b => !b.classList.contains('gz-off-dis'));
    const key = shown.length + ':' + cells.map(b => +shown.includes(b)).join(''); if (soty.dataset.k === key) continue; soty.dataset.k = key;
    cells.forEach(b => { b.style.display = shown.includes(b) ? '' : 'none'; });
    // v0.072: справа («Шаблоны») кнопки в одну строку, без сдвига сот.
    const flat = railR.contains(soty), st = flat ? 0 : 13.5;
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
  const gPaint = ptGroup('Краска'), gEdit = ptGroup('Очистка'), gAxis = ptGroup('Оси'),gHistory=ptGroup('Правка');
  gHistory.parentElement.classList.add('pt-history');
  for (const id of ['bFill','bAutoVertical','bStolb','bPaintMid','bAutoAll','fillMirror']) groupOf[id] = gPaint;
  for (const id of ['bFillUndo','bFillRedo']) groupOf[id] = gHistory;
  for (const id of ['bFillClear','bPaintNew','bReset']) groupOf[id] = gEdit;   // v0.168: «Очистить всё поле» — из рейки «Поле» сюда
  for (const id of ['sym','symV','symH','symD','symTriangles','bTriangleAxes','bFrameWindow','bAxisLine','bAxisMirror','bAxisXor','bAxisLinesClear','bRuler']) groupOf[id] = gAxis;
  for (const [id, kind] of [['bFill','colour'],['bAutoVertical','line'],['bStolb','swap'],['bPaintMid','line'],['bAutoAll','steps'],['fillMirror','mirror'],['bFillUndo','undo'],['bFillRedo','forward'],['bFillClear','cross'],['bPaintNew','reset'],['bReset','cross'],['sym','axes'],['symV','axes'],['symH','axes'],['symD','axes'],['symTriangles','tri'],['bTriangleAxes','tri'],['bFrameWindow','corners'],['bAxisLine','select'],['bAxisMirror','down'],['bAxisXor','half'],['bAxisLinesClear','cross'],['bRuler','line']]) {
    const e = $(id), b = document.createElement('button'); b.type = 'button'; b.className = 'pt-b'; b.dataset.n = id;
    const mark = document.createElement('i'); mark.style.backgroundImage = icon(e, kind); b.append(mark);
    b.onclick = () => e.click();
    // v0.050: правый клик по нажатому значку — выключить его режим.
    b.oncontextmenu = ev => { ev.preventDefault(); if (e.matches('[aria-pressed="true"]') || (e.type === 'checkbox' && e.checked)) e.click(); };
    toolSync.push(() => { b.title = tip(e) + (id === 'bAutoVertical' ? ' · сейчас: ' + e.textContent : ''); b.disabled = e.disabled;
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
  const gView = ptGroup('Вид');
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
  const viewIcons = { col: ['colour', 'Цвета перекрытий'], bits: ['grid4', 'Только биты'], digits: ['steps', 'Цифры 0/1'], digitsOnly: ['steps', 'Только цифры'], romb0: ['square', 'Ромбы · чётная'], romb1: ['square', 'Ромбы · нечётная'], romb2: ['copy', 'Ромбы · обе рядом'] };
  { const sel = $('view'), nameOf = o => (viewIcons[o.value] || [, o.textContent])[1];   // v0.176: семь видов «или — или» — одной кнопкой, как список в хабе
    const go = d => { const n = sel.options.length; sel.selectedIndex = (sel.selectedIndex + d + n) % n; sel.dispatchEvent(new Event('change', { bubbles: true })); };
    const probe = document.createElement('button'); probe.title = 'Цвета'; const b = ptBtn('viewCycle', 'eye', probe, () => go(1));
    b.oncontextmenu = ev => { ev.preventDefault(); go(-1); }; b.addEventListener('wheel', ev => { ev.preventDefault(); go(ev.deltaY > 0 ? 1 : -1); }, { passive: false });
    toolSync.push(() => { const t = nameOf(sel.selectedOptions[0] || sel.options[0]); b.title = 'Вид: ' + t + ' · щелчок — следующий, правый — предыдущий, колесо — листать · ' + [...sel.options].map(nameOf).join(' · ');
      const nm = b.querySelector('.gz-nm'); if (nm && nm.textContent !== t) nm.textContent = t; });
    gView.append(b); }
  // v0.059: «Верх» — закрепить первую строку у верха при масштабе; на холсте в группе «Вид».
  { const e = $('zTop'), b = document.createElement('button'); b.type = 'button'; b.className = 'pt-b'; b.dataset.n = 'zTop';
    const mark = document.createElement('i'); mark.style.backgroundImage = icon(e, 'pin'); b.append(mark); b.onclick = () => e.click();
    toolSync.push(() => { b.title = tip(e); b.classList.toggle('on', e.matches('[aria-pressed="true"]')); }); gView.append(b);
    // v0.208: вторая половина кнопки — «Гориз»: центр «Зеркала ↑» (точка встречи «Застыло») тянется по горизонтали, а не вверх-вниз
    const h = document.createElement('span'); h.className = 'pt-half'; h.textContent = 'Гориз';
    h.addEventListener('click', ev => { ev.stopPropagation(); window.mayFixHor?.set(!window.mayFixHor.get()); placeTools(); });
    toolSync.push(() => { const on = !!window.mayFixHor?.get(); h.classList.toggle('on', on); h.title = 'Гориз: центр «Зеркала ↑» тянуть за голубую вертикаль влево-вправо (выкл — за зелёную горизонталь вверх-вниз) · сейчас ' + (on ? 'вкл' : 'выкл') + ' · двойной щелчок по линии — сдвиг снять'; });
    b.append(h); }
  // v0.103: «Без полос» (по кругу: полосы / без полос / до треугольника) и «Обводка» — из рейки «Вид» сюда; «Свёртка» — последней
  for (const [id, kind] of [['noband', 'half'], ['outline', 'corners'], ['fixLines', 'corners'], ['geomCenter', 'axes'], ['cellInk', 'grid4']]) {   // v0.132: «Центр» (подсветка столба) снят
    const e = $(id), b = document.createElement('button'); b.type = 'button'; b.className = 'pt-b'; b.dataset.n = id;
    const mark = document.createElement('i'); mark.style.backgroundImage = icon(e, kind); b.append(mark); b.onclick = () => e.click();
    toolSync.push(() => { b.title = tip(e); b.classList.toggle('on', e.checked);
      if (id === 'noband') { const nm = b.querySelector('.gz-nm'); if (nm) nm.textContent = ['Полосы', 'Без полос', 'До треуг.'][+e.dataset.mode || 0]; } });
    gView.append(b); }
  // v0.205: «Зеркало ↑» — нижний треугольник между линиями «Застыло» вверх от точки встречи; по кругу: выкл / все / шахм. 1 / шахм. 2 / XOR / AND
  { const names = ['Зеркало ↑', 'Зерк. ↑ все', 'Зерк. ↑ шахм. 1', 'Зерк. ↑ шахм. 2', 'Зерк. ↑ XOR', 'Зерк. ↑ AND'], Z = () => window.mayFixMirror, probe = document.createElement('button'); probe.title = 'Зеркало';
    const b = ptBtn('fixMirror', 'mirror', probe, () => { Z()?.set(((Z().get()) + 1) % 6); placeTools(); });
    b.oncontextmenu = ev => { ev.preventDefault(); Z()?.set((Z().get() + 5) % 6); placeTools(); };
    toolSync.push(() => { const m = Z()?.get() || 0; b.classList.toggle('on', m > 0); const nm = b.querySelector('.gz-nm'); if (nm && nm.textContent !== names[m]) nm.textContent = names[m];
      b.title = 'Зеркало вверх от точки встречи линий «Застыло»: нижний треугольник между диагоналями ложится на верхний, на каждом кадре · сейчас: ' + ['выкл', 'все биты', 'шахматка 1', 'шахматка 2', 'XOR верх ⊕ низ', 'AND верх ∧ низ'][m] + ' · щелчок — следующий, правый — предыдущий'; });
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
      ba.title = 'Ось «Зеркала ↑»: ход — дрожит вслед маятнику (кадр за кадром на ½ бита: на бите / между битами), стоит — всегда на бите, антиход — шагает навстречу маятнику · сейчас: ' + AX[i].slice(5) + ' · щелчок — следующий, правый — предыдущий'; });
    gView.querySelector('[data-n="fixMirror"]').after(bf, bv, ba, bk, bc, bo);
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
  const ptNames = { fixMirror:'Зеркало ↑', fixFold:'Загиб', fixFoldV:'ЗагибВерт', fixDragK:'Сдвиг кадром', fixAxis:'Ось: ход', mirCol:'Зерк. все цвета', mirOp:'Зерк. копия', px_b:'Синие', px_r:'Красные', px_y:'Жёлтые', px_k:'Чёрные', px_w:'Белые', bReset:'Всё поле', bFill:'Заливка', bAutoVertical:'Столбы', bStolb:'Проход', bPaintMid:'Центр', midBox:'1 · 0 · ⇔', bAutoAll:'Авто', fillMirror:'Зеркало', bFillUndo:'Отмена', bFillRedo:'Повтор', bFillClear:'Стереть', bPaintNew:'С нуля', sym:'Симметрия', symTriangles:'Тотемы', bTriangleAxes:'Оси пустот', bFrameWindow:'Кадр отдельно', symV:'Оси ↕', symH:'Оси ↔', symD:'Оси ╲╱', bAxisLine:'Ось', bAxisMirror:'Вниз', bAxisXor:'Хор', bAxisLinesClear:'Убрать', bRuler:'Линейка', col:'Цвета', bits:'Биты', digits:'Цифры', digitsOnly:'Только цифры', cellInk:'Грани', geomCenter:'Геоцентр', fixLines:'Застыло', bFoldCompare:'Сгиб', bFoldHorizontal:'Свёртка ↔', bFoldVertical:'Свёртка ↕', noband:'Без полос', outline:'Обводка', midCol:'Центр', romb0:'Ромб 0', romb1:'Ромб 1', romb2:'Обе', zTop:'Верх', bRec:'Запись', bGif:'GIF', bXor2:'Xor-Next', bTemplateQuickSave:'Сохранить', bTemplateColour:'Перекрасить', viewCycle:'Вид', c_digitOneColour:'Цифра 1', c_digitZeroColour:'Цифра 0', c_bitOneColour:'Клетка 1', c_bitZeroColour:'Клетка 0', fontCycle:'Шрифт', sizeCtl:'Размер', midOneOn:'Центр 1', midZeroOn:'Центр 0', midWide:'⇔ 2-й уровень' };
  // v0.073: значки заменены обычными длинными кнопками, как в меню: значок + название, по две строки в группе.
  // «Запись» и «Цвет» остаются маленькими, с подписью сверху.
  const ptColour = { 'Краска':'#ff9b50', 'Правка':'#ffd35b', 'Очистка':'#ffd35b', 'Оси':'#ff87cf', 'Вид':'#7cbcff', 'Шаблон':'#ffd35b' };
  for (const g of tools.querySelectorAll('.pt-g')) { const c = ptColour[g.querySelector('.pt-l').textContent]; if (c) { g.style.setProperty('--c', c); g.classList.add('pt-long'); } }
  for (const row of tools.querySelectorAll('.pt-r')) [...row.children].forEach((b, k) => {
    if (b.classList.contains('pt-b') && b.dataset.n !== 'bRec') {
      b.classList.add('gz-hx'); b.querySelector('i').classList.add('gz-ic');
      const nm = document.createElement('span'); nm.className = 'gz-nm'; nm.textContent = ptNames[b.dataset.n] || ''; b.append(nm); return; }
    const t = document.createElement('b'); t.className = 'pt-t up'; t.textContent = b.dataset.n ? (ptNames[b.dataset.n] || '') : 'Цвет'; b.append(t); });
  // v0.063: панель значков — в шапке, рядом с «Что это такое?», а не поверх холста.
  tools.insertBefore(gHistory.parentElement,gView.parentElement);
  // v0.103: «Вид» в шапке — компактно, в три ряда; цвета цифр и «показ строк» — сами поля, столбиком в конце группы
  gView.parentElement.classList.add('pt-view');
  { const done = b => { b.classList.add('gz-hx'); b.querySelector('i')?.classList.add('gz-ic'); const nm = document.createElement('span'); nm.className = 'gz-nm'; nm.textContent = ptNames[b.dataset.n] || ''; b.append(nm); return b; };   // эти встают после общей раздачи надписей
    for (const [id, title] of [['digitOneColour', 'Цвет цифры 1'], ['digitZeroColour', 'Цвет цифры 0'], ['bitOneColour', 'Цвет клетки 1'], ['bitZeroColour', 'Цвет клетки 0']]) {
      const b = ptBtn('c_' + id, 'colour', $(id), null), d = dotIn(b, id, title); b.onclick = () => d.click(); b.title = title + ' · щелчок — палитра'; gView.append(done(b)); }
    const fnt = $('digitFont'), fb = ptBtn('fontCycle', 'steps', fnt, () => { fnt.selectedIndex = (fnt.selectedIndex + 1) % fnt.options.length; fnt.dispatchEvent(new Event('change', { bubbles: true })); });
    fb.oncontextmenu = ev => { ev.preventDefault(); const n = fnt.options.length; fnt.selectedIndex = (fnt.selectedIndex - 1 + n) % n; fnt.dispatchEvent(new Event('change', { bubbles: true })); };
    toolSync.push(() => { const t = fnt.selectedOptions[0]?.textContent || ''; fb.title = 'Шрифт цифр: ' + t + ' · щелчок — следующий, правый — предыдущий'; const nm = fb.querySelector('.gz-nm'); if (nm && nm.textContent !== t) nm.textContent = t; }); gView.append(done(fb));
    const sz = $('digitSize'), szSet = d => { const v = Math.max(+sz.min, Math.min(+sz.max, (+sz.value || 80) + d * (+sz.step || 5))); if (v === +sz.value) return; sz.value = v; fire(sz); };
    const sb = ptBtn('sizeCtl', 'plus', sz, () => szSet(1)); sb.oncontextmenu = ev => { ev.preventDefault(); szSet(-1); }; sb.addEventListener('wheel', ev => { ev.preventDefault(); szSet(ev.deltaY < 0 ? 1 : -1); }, { passive: false });
    toolSync.push(() => { const t = 'Цифры ' + sz.value + ' %'; sb.title = 'Размер цифр в клетке · щелчок — больше, правый — меньше, колесо'; const nm = sb.querySelector('.gz-nm'); if (nm && nm.textContent !== t) nm.textContent = t; }); gView.append(done(sb));
    const box = document.createElement('span'); box.className = 'pt-vx'; const v = $('vrows'); v.title = tip(v); v.placeholder = 'строк'; v.classList.add('pt-vrows'); box.append(v); gView.append(box); }
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
  { tools.classList.add('pt-dd'); let open = null; const narrow = matchMedia('(max-width:600px)');
    // v0.159: на телефоне «Что это такое?» — в конец полоски меню, чтобы шапка была в одну строку
    const aboutHome = $('mayAbout').previousElementSibling, aboutPlace = () => { if (narrow.matches) $('mayCorner').append($('mayAbout')); else aboutHome.after($('mayAbout')); };
    narrow.addEventListener('change', () => { shut(); aboutPlace(); }); aboutPlace();
    // v0.163: (getClientRects, а не offsetParent: у fixed-списка на телефоне он null) рамка списка — зубцами по бокам (ряд 24 px, как кнопки), высота — целым числом рядов; рисунок — SVG фоном, тот же контур — clip-path
    const zig = r => { if (!r.getClientRects().length) return; r.style.height = '';
      // v0.164: «стык в стык» — зубцы рамки той же высоты и скоса, что кнопки: острия кнопок входят в выемки рамки, прочее — целым числом рядов
      const b0 = r.querySelector(':scope > .gz-hx'), GAP = parseFloat(getComputedStyle(r).rowGap) || 0, P = b0 ? b0.offsetHeight + GAP : 24, D = b0 ? parseFloat(getComputedStyle(b0).getPropertyValue('--gz-n')) || 9 : 9;   // v0.184: шаг зубцов — кнопка + зазор
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
    const PIN_DD = 'mayatnik-dd-pins', keyOf = g => g.querySelector('.pt-l').firstChild.textContent.trim();
    let pins = new Set(); try { pins = new Set(JSON.parse(localStorage.getItem(PIN_DD) || '[]')); } catch (_) {}
    // v0.166: «если закреп сверну, то не убирай закреп-галку… только если закреп уберу» — щелчок по названию закреплённой группы
    // только сворачивает её (закреп горит), развернул снова — опять не закрывается; снимается закреп только значком
    const FOLD_DD = 'mayatnik-dd-fold'; let folds = new Set(); try { folds = new Set(JSON.parse(localStorage.getItem(FOLD_DD) || '[]')); } catch (_) {}
    const saveDd = () => { try { localStorage.setItem(PIN_DD, JSON.stringify([...pins])); localStorage.setItem(FOLD_DD, JSON.stringify([...folds])); } catch (_) {} };
    const pinned = g => !narrow.matches && pins.has(keyOf(g)), stay = g => pinned(g) && !folds.has(keyOf(g)), groupsAll = () => [...tools.querySelectorAll('.pt-g')];
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
    addEventListener('resize', () => { for (const g of groupsAll()) if (g.classList.contains('pt-open')) { place(g); zig(g.querySelector('.pt-r')); } requestAnimationFrame(noOverlap); });
    const shut = () => { if (!open) return; const g = open; open = null; if (!stay(g)) setOpen(g, false); };
    const show = g => { if (open === g) return; shut(); open = g; if (!g.classList.contains('pt-open')) setOpen(g, true); };
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
    // v0.193: «дай менять местами» — группу полосы тянут за название вбок, она встаёт между соседями; порядок — в памяти браузера (mayatnik-dd-order)
    { const ORDER = 'mayatnik-dd-order', save = () => { try { localStorage.setItem(ORDER, JSON.stringify(groupsAll().map(keyOf))); } catch (_) {} };
      const arrange = keys => { const gs = groupsAll(), at = k => { const i = keys.indexOf(keyOf(k)); return i < 0 ? keys.length + gs.indexOf(k) : i; }, end = gs[gs.length - 1].nextSibling;
        for (const g of [...gs].sort((a, b) => at(a) - at(b))) tools.insertBefore(g, end); };
      try { const k = JSON.parse(localStorage.getItem(ORDER) || 'null'); if (Array.isArray(k)) arrange(k); } catch (_) {}
      let d = null, swallow = false;
      addEventListener('click', e => { if (swallow) { e.stopPropagation(); e.preventDefault(); swallow = false; } }, true);
      // перенос группы в DOM снимает захват указателя, поэтому движение и отпускание слушаются на окне
      addEventListener('pointermove', e => { if (!d || e.pointerId !== d.id) return; const g = d.g;
        if (!d.on) { if (Math.abs(e.clientX - d.x) < 6) return; d.on = true; shut(); tools.classList.add('pt-dragging'); g.classList.add('pt-drag'); }
        e.preventDefault(); const x = e.clientX, others = groupsAll().filter(o => o !== g && o.offsetParent !== null);
        const next = others.find(o => { const r = o.querySelector('.pt-l').getBoundingClientRect(); return x < r.left + r.width / 2; });
        const ref = next || others[others.length - 1].nextSibling; if (ref !== g && g.nextSibling !== ref) tools.insertBefore(g, ref);
        for (const o of groupsAll()) if (o.classList.contains('pt-open')) place(o); });
      const end = e => { if (!d || e.pointerId !== d.id) return; const { g, on } = d; d = null; if (!on) return;
        swallow = e.type === 'pointerup'; setTimeout(() => { swallow = false; }, 0); tools.classList.remove('pt-dragging'); g.classList.remove('pt-drag'); save(); requestAnimationFrame(noOverlap); };
      addEventListener('pointerup', end, true); addEventListener('pointercancel', end, true);
      for (const g of groupsAll()) { const l = g.querySelector('.pt-l');
        l.addEventListener('pointerdown', e => { if (e.button !== 0 || narrow.matches) return; d = { g, x: e.clientX, id: e.pointerId, on: false }; });
        if (!l.title) l.title = 'Щелчок — открыть · тянуть вбок — переставить группу'; } }
    // v0.209: «правой кнопкой по кнопке — свернуть кнопку в ромб со значком и сдвинуть все остальные на освободившееся место»:
    // правый щелчок по названию группы полосы — оно сворачивается в ромб со значком (соседи встают вплотную), ещё раз — разворачивается.
    // Список при этом открывается как прежде; свёрнутые — в памяти браузера (mayatnik-dd-mini).
    { const MINI = 'mayatnik-dd-mini', ICO = { 'Краска': '✎', 'Очистка': '⌫', 'Оси': '✛', 'Правка': '↶', 'Вид': '◉', 'Шаблон': '▣', 'Шаблоны': '▤', 'Видео': '⏺' };
      let minis = new Set(); try { minis = new Set(JSON.parse(localStorage.getItem(MINI) || '[]')); } catch (_) {}
      const glyph = k => ICO[k] || ([...k][0] && /[^\p{L}\p{N}]/u.test([...k][0]) ? [...k][0] : k.slice(0, 1));
      for (const g of groupsAll()) { const l = g.querySelector('.pt-l'), k = keyOf(g), ic = document.createElement('span'); ic.className = 'pt-ico'; ic.textContent = glyph(k); l.append(ic);
        const sync = () => { const on = minis.has(k); g.classList.toggle('pt-mini', on); l.title = on ? k + ' · правый щелчок — развернуть' : 'Щелчок — открыть · тянуть вбок — переставить группу · правый щелчок — свернуть в ромб'; };
        sync(); l.addEventListener('contextmenu', e => { e.preventDefault(); e.stopPropagation(); if (minis.has(k)) minis.delete(k); else minis.add(k);
          try { localStorage.setItem(MINI, JSON.stringify([...minis])); } catch (_) {} sync(); for (const o of groupsAll()) if (o.classList.contains('pt-open')) place(o); requestAnimationFrame(noOverlap); }); } }
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
      host: () => b.closest('.pt-g') || document.body, col: () => b.closest('.pt-r, .gz-rail') }); };
    const fromSelect = (sel, nameOf = o => o.textContent, iconOf = null) => () => [...sel.options].map(o => ({ name: nameOf(o), icon: iconOf?.(o), on: o.value === sel.value,
      pick: () => { if (sel.value === o.value) return; sel.value = o.value; sel.dispatchEvent(new Event('change', { bubbles: true })); } }));
    const viewIcon = new Map(Object.entries(viewIcons).map(([v, [kind, t]]) => { const p = document.createElement('button'); p.title = t; return [v, icon(p, kind)]; }));
    reg(tools.querySelector('[data-n="viewCycle"]'), fromSelect($('view'), o => (viewIcons[o.value] || [, o.textContent])[1], o => viewIcon.get(o.value)));
    reg(tools.querySelector('[data-n="fontCycle"]'), fromSelect($('digitFont')));
    reg(tools.querySelector('[data-n="fillArea"]'), fromSelect($('fillArea')));
    reg(tools.querySelector('[data-n="fixAxis"]'), () => window.mayFixAxisNames.map((name, i) => ({ name: name.slice(5), on: (window.mayFixAxis?.get() || 0) === i, pick: () => window.mayFixAxis?.set(i) })));   // v0.216
    { const M = () => window.mayMir, L = () => window.mayMirLists;   // v0.210
      reg(tools.querySelector('[data-n="mirCol"]'), () => L().col.map(([v, name]) => ({ name, on: M()?.col() === v, pick: () => M()?.set('col', v) })));
      reg(tools.querySelector('[data-n="mirOp"]'), () => L().op.map(([v, name]) => ({ name, on: M()?.op() === v, pick: () => M()?.set('op', v) }))); }
    { const Z = () => window.mayFixMirror; reg(tools.querySelector('[data-n="fixMirror"]'), () => ['Выкл', 'Все биты', 'Шахматка 1', 'Шахматка 2', 'XOR', 'AND'].map((name, i) => ({ name, on: (Z()?.get() || 0) === i, pick: () => Z()?.set(i) }))); }
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
  const placeTools = () => { for (const f of toolSync) f(); };
  addEventListener('resize', placeTools); placeTools();
  // v0.048: любую кнопку рейки — Ctrl + тянуть на холст: там встаёт её копия и держится на месте при сдвиге и масштабе.
  // Копия нажимает настоящую кнопку; тянуть копию — переставить, правая кнопка — убрать.
  const PIN_KEY = 'mayatnik-pins';
  let pins = []; try { pins = JSON.parse(localStorage.getItem(PIN_KEY) || '[]'); } catch (_) {}
  const savePins = () => { try { localStorage.setItem(PIN_KEY, JSON.stringify(pins.map(({ g, i, x, y }) => ({ g, i, x, y })))); } catch (_) {} };
  const cellOf = (g, i) => rail.el.querySelectorAll(`.gz-group[data-id="${g}"] .gz-soty > .gz-hx`)[i] || null;
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
  rail.el.addEventListener('click', e => { if (suppressClick) { suppressClick = false; e.stopPropagation(); e.preventDefault(); } }, true);
  rail.el.addEventListener('pointerdown', e => {
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
  }, true);
  setInterval(() => { rail.refresh(); relayout(); placeTools(); placePins(); }, 200);
  new ResizeObserver(() => dispatchEvent(new Event('resize'))).observe($('wrap'));
  dispatchEvent(new Event('resize'));
})();
