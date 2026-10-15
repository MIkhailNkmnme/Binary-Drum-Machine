/* Маятник v0.071: page adapter for the shared ZerkGrozd rail.
   Original controls/listeners remain the source of truth. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id), source = document.querySelector('.bar');
  if (!source || !window.ZerkGrozd || !window.ZerkMenuIcons) return;
  const tip = e => e.title || e.closest('label')?.title || e.getAttribute('aria-label') || e.textContent.trim();
  const icon = (e, kind) => { e.dataset.miIcon = kind; return ZerkMenuIcons.iconFor(e); };
  const name = e => ZerkMenuIcons.shortOf(e);
  const button = (id, kind) => {
    const e = $(id);
    return { type: 'toggle', name: name(e), icon: icon(e, kind), tip: tip(e),
      nameNow: () => id === 'bPlay' ? (e.getAttribute('aria-pressed') === 'true' ? 'Пауза' : 'Анимация')
        : id === 'bAutoVertical'||id === 'bTemplatePaint' ? e.textContent : id === 'bStep' ? e.textContent.trim() : name(e),
      on: () => e.matches('[aria-pressed="true"],.on'), disabled: () => e.disabled,
      click: () => e.click() };
  };
  const check = (id, kind) => {
    const e = $(id);
    return { type: 'toggle', name: name(e), icon: icon(e, kind), tip: tip(e),
      nameNow: () => id === 'sym' ? (e.checked ? 'Скрыть оси' : 'Показать оси') : name(e),
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
  const groups = [
    { id: 'build', title: 'Поле', color: '#73e4a5', open: true, items: [
      button('bBuild', 'field'), button('bReset', 'reset'), button('bThird', 'tri'), button('bFour', 'plusRing'),
      control('rows'), control('steps'), select('mode', 'swap', {pend:'Лево-право',right:'Вправо',left:'Влево',one:'Одна вершина'}),
      select('bg', 'square', {empty:'Пустое','1':'Все 1','0':'Все 0'}) ] },
    { id: 'presets', title: 'Хорр', color: '#79b9ff', items: [
      ...[...source.querySelectorAll('button.pre')].map(e => ({ type: 'action', name: e.textContent,
        icon: icon(e, 'field'), tip: e.title || `Построить ${e.dataset.n} строк и вершин (или до N/3)`, click: () => e.click() })),
      check('third', 'tri') ] },
    { id: 'animation', title: 'Анимация', color: '#b9a2ff', items: [
      button('bPlay', 'play'), button('bStep', 'forward'), button('bSeq', 'line'), button('bPair', 'copy'),
      control('speed'), control('frame') ] },
    { id: 'view', title: 'Вид', color: '#80aee8', items: [
      check('noband', 'half'), check('outline', 'corners'),
      select('view', 'eye', {col:'Перекрытия',bits:'Биты',digits:'Цифры 0/1',romb0:'Ромбы чёт.',romb1:'Ромбы нечёт.',romb2:'Ромбы обе'}),
      control('vrows') ] },
    { id: 'ochki', title: 'Очки', color: '#ffb347', items: [
      button('bOchki', 'eye'), check('ochkiInv', 'half'), check('ochkiRev', 'swap'),
      select('ochkiMode', 'line', {diag:'Диагонали',row:'Ряды'}),select('ochkiPattern','steps'),control('ochkiLength') ] },
    { id: 'zoom', title: 'Масштаб', color: '#7cbcff', items: [
      button('zOut', 'minus'), button('zIn', 'plus'), button('zFit', 'corners'), button('zTop', 'pin'), button('zSnap', 'grid4') ] },
    { id: 'mirrors', title: 'Зеркала', color: '#ff87cf', items: [
      button('bAxisLine', 'line'), button('bAxisMirror', 'down'), button('bAxisXor', 'half'), button('bAxisLinesClear', 'cross') ] },
    { id: 'paint', title: 'Раскраска', color: '#ff9b50', items: [button('bPaintSave','save'),button('bPaintNew','reset'),button('bPaintOpen','load'),button('bPng','image'),button('bFill','colour'),button('bAutoVertical','line'),button('bAutoAll','steps'),check('fillMirror','mirror'),control('fillColour'),button('bFillUndo','undo'),button('bFillRedo','forward'),button('bFillClear','cross'),button('bRegions','grid4'),button('bPaintRestore','undo')] },
    { id: 'template', title: 'Шаблон', color: '#ffd35b', items: [button('bTemplateTake','colour'),button('bTemplateShow','eye'),button('bTemplateClone','copy'),button('bTemplateRemove','cross'),button('bTemplateFlipH','mirror'),button('bTemplateFlipV','mirror'),button('bMirrorLine','line'),button('bMirrorByLine','mirror'),button('bXor2','down'),button('bFillUndo','undo'),button('bFillRedo','forward'),button('bTemplateTaller','plus'),button('bTemplateShorter','minus'),button('bTemplateReturn','swap'),button('bTemplateReset','reset'),button('bTemplateTransfer','move'),button('bTemplatePaint','colour'),check('templateTrail','half'),check('templateProportional','corners'),control('xorStep'),control('templateHeight'),control('templateDown'),control('templateAlpha')] },
    { id:'library',title:'Шаблоны',color:'#d9b9ff',items:[control('templateLibraryChoices'),button('bTemplateImport','folder'),button('bTemplateExport','save')] },
    { id: 'export', title: 'Экспорт', color: '#ffd166', items: [
      button('bPng', 'image'), button('bRec', 'record'), button('bTxt', 'save'), button('bDiag', 'steps') ] }
  ];
  const rail = ZerkGrozd.rail($('mayatnikRail'), { key: 'mayatnik', groups });
  const status = $('mayatnikStatus');
  // v0.051: строки «Картинка…» и «Кадр…» — в подвал, к остальным надписям.
  status.append($('imageStats'));
  for (const id of ['lg', 'stat', 'zoomV', 'konusInfo', 'symInfo', 'fillInfo','paintCacheInfo','templateInfo','templateActions']) status.append($(id));
  for(const [id,kind]of [['bTemplateQuickSave','save'],['bTemplateColour','colour']]){
    const e=$(id),mark=document.createElement('i');mark.className='gz-ic';mark.style.backgroundImage=icon(e,kind);mark.style.backgroundSize='contain';mark.style.backgroundRepeat='no-repeat';e.querySelector('span').prepend(mark);
  }
  // v0.071: «Шаблоны» — справа, у правого края поля.
  const railR=document.createElement('div');railR.id='mayatnikRailR';$('mayatnikRail').after(railR);const railRIn=document.createElement('div');railRIn.className='gz-rail';railR.append(railRIn);
  { const g=[...rail.el.querySelectorAll('.gz-group')].find(g=>g.querySelector('.gz-head .gz-nm')?.textContent.trim()==='Шаблоны'); if(g) railRIn.append(g); }
  const sidebar=document.createElement('aside');sidebar.id='mayatnikSidebar';$('mayatnikRail').before(sidebar);sidebar.append($('mayatnikRail'));
  source.hidden = true;
  document.body.classList.add('mayatnik-menu-ready');
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
    shown.forEach((b, k) => { const col = k % 2, row = k >> 1; b.style.left = (col * 112) + 'px'; b.style.top = (row * 27 + col * 13.5) + 'px'; });
    soty.style.height = shown.length ? (Math.ceil(shown.length / 2) * 27 + (shown.length > 1 ? 13.5 : 0) - 3) + 'px' : '0';
    soty.style.display = shown.length ? '' : 'none'; } };
  // v0.042: значки раскраски прямо на холсте, в левом верхнем углу; сдвиг и масштаб поля их не двигают.
  const tools = document.createElement('div'); tools.id = 'paintTools'; tools.setAttribute('aria-label', 'Раскраска на холсте');
  const toolSync = [];
  // v0.054: значки разбиты на группы с промежутками, над каждой группой — короткая подпись.
  const groupOf = {}; const ptGroup = name => { const g = document.createElement('div'); g.className = 'pt-g';
    const l = document.createElement('span'); l.className = 'pt-l'; l.textContent = name; const row = document.createElement('div'); row.className = 'pt-r';
    g.append(l, row); tools.append(g); return row; };
  const gPaint = ptGroup('Краска'), gEdit = ptGroup('Правка'), gAxis = ptGroup('Оси');
  for (const id of ['bFill','bAutoVertical','bAutoAll','fillMirror']) groupOf[id] = gPaint;
  for (const id of ['bFillUndo','bFillRedo','bFillClear','bPaintNew']) groupOf[id] = gEdit;
  for (const id of ['bAxisLine','bAxisMirror','bAxisXor','bAxisLinesClear']) groupOf[id] = gAxis;
  for (const [id, kind] of [['bFill','colour'],['bAutoVertical','line'],['bAutoAll','steps'],['fillMirror','mirror'],['bFillUndo','undo'],['bFillRedo','forward'],['bFillClear','cross'],['bPaintNew','reset'],['bAxisLine','select'],['bAxisMirror','down'],['bAxisXor','half'],['bAxisLinesClear','cross']]) {
    const e = $(id), b = document.createElement('button'); b.type = 'button'; b.className = 'pt-b'; b.dataset.n = id;
    const mark = document.createElement('i'); mark.style.backgroundImage = icon(e, kind); b.append(mark);
    b.onclick = () => e.click();
    // v0.050: правый клик по нажатому значку — выключить его режим.
    b.oncontextmenu = ev => { ev.preventDefault(); if (e.matches('[aria-pressed="true"]') || (e.type === 'checkbox' && e.checked)) e.click(); };
    toolSync.push(() => { b.title = tip(e) + (id === 'bAutoVertical' ? ' · сейчас: ' + e.textContent : ''); b.disabled = e.disabled;
      b.classList.toggle('on', e.type === 'checkbox' ? e.checked : e.matches('[aria-pressed="true"]')); });
    groupOf[id].append(b);
  }
  const colour = document.createElement('input'); colour.type = 'color'; colour.className = 'pt-c'; colour.title = 'Цвет заливки';
  colour.oninput = () => { $('fillColour').value = colour.value; $('fillColour').dispatchEvent(new Event('input', { bubbles: true })); $('fillColour').dispatchEvent(new Event('change', { bubbles: true })); };
  toolSync.push(() => { if (document.activeElement !== colour) colour.value = $('fillColour').value; });
  const colourBox = document.createElement('span'); colourBox.className = 'pt-cw'; colourBox.append(colour); gPaint.append(colourBox);
  // v0.044: виды поля — значками на холсте, рядом с раскраской.
  const gView = ptGroup('Вид');
  const viewIcons = { col: ['colour', 'Цвета перекрытий'], bits: ['grid4', 'Только биты'], digits: ['steps', 'Цифры 0/1'], romb0: ['square', 'Ромбы · чётная'], romb1: ['square', 'Ромбы · нечётная'], romb2: ['copy', 'Ромбы · обе рядом'] };
  for (const o of $('view').options) {
    const [kind, title] = viewIcons[o.value] || ['eye', o.textContent], b = document.createElement('button'); b.type = 'button'; b.className = 'pt-b'; b.dataset.n = o.value;
    const probe = document.createElement('button'); probe.title = title; probe.textContent = title;
    const mark = document.createElement('i'); mark.style.backgroundImage = icon(probe, kind); b.append(mark);
    if (o.value === 'romb1') { const n = document.createElement('small'); n.textContent = '1'; b.append(n); }
    if (o.value === 'romb0') { const n = document.createElement('small'); n.textContent = '0'; b.append(n); }
    b.title = 'Вид: ' + title; b.onclick = () => { $('view').value = o.value; $('view').dispatchEvent(new Event('change', { bubbles: true })); };
    toolSync.push(() => b.classList.toggle('on', $('view').value === o.value)); gView.append(b);
  }
  // v0.059: «Верх» — закрепить первую строку у верха при масштабе; на холсте в группе «Вид».
  { const e = $('zTop'), b = document.createElement('button'); b.type = 'button'; b.className = 'pt-b'; b.dataset.n = 'zTop';
    const mark = document.createElement('i'); mark.style.backgroundImage = icon(e, 'pin'); b.append(mark); b.onclick = () => e.click();
    toolSync.push(() => { b.title = tip(e); b.classList.toggle('on', e.matches('[aria-pressed="true"]')); }); gView.append(b); }
  // v0.062: запись видео — на холсте отдельной группой.
  { const gRec = ptGroup('Видео'), e = $('bRec'), b = document.createElement('button'); b.type = 'button'; b.className = 'pt-b'; b.dataset.n = 'bRec';
    const mark = document.createElement('i'); mark.style.backgroundImage = icon(e, 'record'); b.append(mark); b.onclick = () => e.click();
    toolSync.push(() => { b.title = tip(e); b.classList.toggle('on', e.matches('[aria-pressed="true"]')); }); gRec.append(b); }
  // v0.056: каждая группа в своей рамке; значки подписаны через один — сверху и снизу.
  const ptNames = { bFill:'Заливка', bAutoVertical:'Столбы', bAutoAll:'Авто', fillMirror:'Зеркало', bFillUndo:'Назад', bFillRedo:'Вперёд', bFillClear:'Стереть', bPaintNew:'С нуля', bAxisLine:'Ось', bAxisMirror:'Вниз', bAxisXor:'Хор', bAxisLinesClear:'Убрать', col:'Цвета', bits:'Биты', digits:'Цифры', romb0:'Ромб 0', romb1:'Ромб 1', romb2:'Обе', zTop:'Верх', bRec:'Запись' };
  for (const row of tools.querySelectorAll('.pt-r')) [...row.children].forEach((b, k) => {
    const t = document.createElement('b'); t.className = 'pt-t ' + (k % 2 ? 'dn' : 'up'); t.textContent = b.dataset.n ? (ptNames[b.dataset.n] || '') : 'Цвет'; b.append(t); });
  // v0.063: панель значков — в шапке, рядом с «Что это такое?», а не поверх холста.
  $('mayAbout').after(tools);
  // v0.051: «Сохранить» и «Цвет» выбранной фигуры — на холсте внизу слева, тоже неподвижно.
  const acts = document.createElement('div'); acts.id = 'canvasActs'; acts.append($('templateActions')); document.body.append(acts);
  const placeTools = () => { const r = $('wrap').getBoundingClientRect(); 
    acts.style.left = (r.left + 8) + 'px'; acts.style.top = (r.bottom - 8) + 'px'; acts.hidden = r.width < 60;
    for (const f of toolSync) f(); };
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
