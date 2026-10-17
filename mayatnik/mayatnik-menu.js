/* Маятник v0.120 (меню полосой — v0.158): page adapter for the shared ZerkGrozd rail.
   Original controls/listeners remain the source of truth. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id), source = document.querySelector('.bar');
  if (!source || !window.ZerkGrozd || !window.ZerkMenuIcons) return;
  const tip = e => e.title || e.closest('label')?.title || e.getAttribute('aria-label') || e.textContent.trim();
  const icon = (e, kind) => { e.dataset.miIcon = kind; return ZerkMenuIcons.iconFor(e); };
  const name = e => ({bPaintSave:'Сохранить всё',bPaintOpen:'Открыть работу'}[e.id] || ZerkMenuIcons.shortOf(e));
  const button = (id, kind) => {
    const e = $(id);
    return { type: 'toggle', name: name(e), icon: icon(e, kind), tip: tip(e),
      nameNow: () => id === 'bPlay' ? (e.getAttribute('aria-pressed') === 'true' ? 'Пауза' : 'Анимация')
        : id === 'bAutoVertical'||id === 'bTemplatePaint'||id === 'bPaintMid'||id === 'bAnimHl'||id === 'bBlackMirror' ? e.textContent : id === 'bStep' ? e.textContent.trim() : name(e),
      on: () => e.matches('[aria-pressed="true"],.on'), disabled: () => e.disabled,
      click: () => e.click() };
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
  const groups = [
    { id: 'build', title: 'Поле', color: '#73e4a5', open: true, items: [
      button('bBuild', 'field'), button('bReset', 'reset'), button('bThird', 'tri'), button('bFour', 'plusRing'),
      control('rows'), control('steps'), select('mode', 'swap', {pend:'Лево-право',right:'Вправо',left:'Влево',one:'Одна вершина'}),
      select('bg', 'square', {empty:'Пустое','1':'Все 1','0':'Все 0',chess:'1 шахматкой'}) ] },
    // v0.114: «объедини группы» — кнопки «Хорр» в «Анимации», отдельной группы «Хорр» нет; «Пара сразу» убрана («оставь только по очереди»).
    // v0.115: и «По очереди» убрана — «не нужна теперь, и так автоматом по очереди»
    { id: 'animation', title: 'Анимация', color: '#b9a2ff', items: [
      button('bPlay', 'play'), button('bStep', 'forward'), button('bRowRun', 'down'),
      ...[...source.querySelectorAll('button.pre')].map(e => ({ type: 'action', name: e.textContent,
        icon: icon(e, 'field'), tip: e.title || `Построить ${e.dataset.n} строк и вершин (или до N/3)`, click: () => e.click() })),
      check('third', 'tri'), control('speed'), control('frame') ] },
    // v0.103: группа «Вид» целиком переехала в шапку («перемести всё в Вид сверху») — в рейке её нет
    { id: 'ochki', title: 'Очки', color: '#ffb347', items: [
      button('bOchki', 'eye'), check('ochkiInv', 'half'), check('ochkiRev', 'swap'), check('frozen', 'pin'), button('bBlackMirror', 'mirror'), button('bAnimHl', 'eye'),
      select('ochkiMode', 'line', {diag:'Диагонали',row:'Ряды'}),select('ochkiPattern','steps'),control('ochkiLength') ] },
    { id: 'zoom', title: 'Масштаб', color: '#7cbcff', items: [
      button('zOut', 'minus'), button('zIn', 'plus'), button('zFit', 'corners'), button('zTop', 'pin'), button('zSnap', 'grid4') ] },
    { id: 'mirrors', title: 'Зеркала', color: '#ff87cf', items: [
      check('sym', 'axes'), check('symV', 'axes'), check('symH', 'axes'), check('symD', 'axes'), check('symBits', 'grid4'),   // v0.133: какие оси и их длина / ширина
      check('symTriangles','tri'),button('bTriangleAxes','tri'),button('bFrameWindow','corners'),control('symTriangleRows'),
      control('symRowsMin'), control('symRowsMax'), control('symBitsMin'), control('symBitsMax'), button('bAxisLine', 'line'), button('bAxisMirror', 'down'), button('bAxisXor', 'half'), button('bAxisLinesClear', 'cross') ] },
    { id: 'paint', title: 'Раскраска', color: '#ff9b50', items: [button('bPaintSave','save'),button('bPaintNew','reset'),button('bPaintOpen','load'),button('bPng','image'),button('bFill','colour'),button('bAutoVertical','line'),button('bStolb','swap'),button('bPaintMid','line'),control('midOneOn'),control('midZeroOn'),check('midWide','line'),button('bAutoAll','steps'),check('fillMirror','mirror'),control('fillColour'),select('fillArea','grid4'),button('bFillUndo','undo'),button('bFillRedo','forward'),button('bFillClear','cross'),button('bRegions','grid4'),button('bPaintRestore','undo')] },
    { id: 'template', title: 'Шаблон', color: '#ffd35b', items: [button('bTemplateTake','colour'),button('bTemplateShow','eye'),button('bTemplateClone','copy'),button('bTemplateRemove','cross'),button('bTemplateFlipH','mirror'),button('bTemplateFlipV','mirror'),button('bMirrorLine','line'),button('bMirrorByLine','mirror'),button('bXor2','down'),button('bFillUndo','undo'),button('bFillRedo','forward'),button('bTemplateTaller','plus'),button('bTemplateShorter','minus'),button('bTemplateReturn','swap'),button('bTemplateReset','reset'),button('bTemplateTransfer','move'),button('bTemplateFall','down'),button('bTemplatePaint','colour'),check('templateTrail','half'),check('templateProportional','corners'),check('templateLock','pin'),check('templateMask','corners'),control('xorStep'),control('templateHeight'),control('templateDown'),control('templateAlpha')] },
    { id:'library',title:'Шаблоны',color:'#d9b9ff',items:[control('templateLibraryChoices'),button('bTemplateImport','folder'),button('bTemplateExport','save')] },
    { id: 'export', title: 'Экспорт', color: '#ffd166', items: [
      button('bPaintSave','save'),button('bPaintOpen','load'),button('bFrameWindow','corners'),
      button('bPng', 'image'), button('bRec', 'record'), button('bGif','record'), button('bTxt', 'save'), button('bDiag', 'steps') ] }
  ];
  const rail = ZerkGrozd.rail($('mayatnikRail'), { key: 'mayatnik', groups });
  const status = $('mayatnikStatus');
  // v0.051: строки «Картинка…» и «Кадр…» — в подвал, к остальным надписям.
  status.append($('imageStats'));
  for (const id of ['lg', 'stat', 'zoomV', 'konusInfo', 'symInfo', 'triangleInfo', 'fillInfo','paintCacheInfo','templateInfo','templateActions']) status.append($(id));
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
    shown.forEach((b, k) => { const col = k % 2, row = k >> 1; b.style.left = (col * 112) + 'px'; b.style.top = (row * 27 + col * st) + 'px'; });
    soty.style.height = shown.length ? (Math.ceil(shown.length / 2) * 27 + (shown.length > 1 ? st : 0) - 3) + 'px' : '0';
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
  for (const id of ['bFillClear','bPaintNew']) groupOf[id] = gEdit;
  for (const id of ['sym','symV','symH','symD','symTriangles','bTriangleAxes','bFrameWindow','bAxisLine','bAxisMirror','bAxisXor','bAxisLinesClear']) groupOf[id] = gAxis;
  for (const [id, kind] of [['bFill','colour'],['bAutoVertical','line'],['bStolb','swap'],['bPaintMid','line'],['bAutoAll','steps'],['fillMirror','mirror'],['bFillUndo','undo'],['bFillRedo','forward'],['bFillClear','cross'],['bPaintNew','reset'],['sym','axes'],['symV','axes'],['symH','axes'],['symD','axes'],['symTriangles','tri'],['bTriangleAxes','tri'],['bFrameWindow','corners'],['bAxisLine','select'],['bAxisMirror','down'],['bAxisXor','half'],['bAxisLinesClear','cross']]) {
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
  const colour = document.createElement('input'); colour.type = 'color'; colour.className = 'pt-c'; colour.title = 'Цвет заливки';
  colour.oninput = () => { $('fillColour').value = colour.value; $('fillColour').dispatchEvent(new Event('input', { bubbles: true })); $('fillColour').dispatchEvent(new Event('change', { bubbles: true })); };
  toolSync.push(() => { if (document.activeElement !== colour) colour.value = $('fillColour').value; });
  const colourBox = document.createElement('span'); colourBox.className = 'pt-cw'; colourBox.append(colour); gPaint.append(colourBox);
  // v0.135: настройки «Центра» — 1 и 0 со своими цветами (оба — красит оба), ⇔ — 2-й уровень (расширенная ось)
  { const box = document.createElement('span'); box.className = 'pt-mid'; box.dataset.n = 'midBox';
    const tog = (id, text, title) => { const e = $(id), b = document.createElement('button'); b.type = 'button'; b.className = 'pt-mt'; b.textContent = text; b.title = title;
      b.onclick = () => e.click(); toolSync.push(() => b.classList.toggle('on', e.checked)); return b; };
    const col = id => { const e = $(id), c = document.createElement('input'); c.type = 'color'; c.className = 'pt-mc'; c.title = 'Цвет';
      c.oninput = () => { e.value = c.value; e.dispatchEvent(new Event('input', { bubbles: true })); }; toolSync.push(() => { if (document.activeElement !== c) c.value = e.value; }); return c; };
    box.append(tog('midOneOn', '1', 'Центр: заливать области 1'), col('midOneColour'), tog('midZeroOn', '0', 'Центр: заливать области 0 (вместе с 1 — оба)'), col('midZeroColour'),
      tog('midWide', '⇔', '2-й уровень — расширенная ось: пары равных битов слева и справа от центра, прозрачнее'));
    gPaint.append(box); }
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
  // v0.103: «Без полос» (по кругу: полосы / без полос / до треугольника) и «Обводка» — из рейки «Вид» сюда; «Свёртка» — последней
  for (const [id, kind] of [['noband', 'half'], ['outline', 'corners'], ['fixLines', 'corners'], ['geomCenter', 'axes'], ['cellInk', 'grid4']]) {   // v0.132: «Центр» (подсветка столба) снят
    const e = $(id), b = document.createElement('button'); b.type = 'button'; b.className = 'pt-b'; b.dataset.n = id;
    const mark = document.createElement('i'); mark.style.backgroundImage = icon(e, kind); b.append(mark); b.onclick = () => e.click();
    toolSync.push(() => { b.title = tip(e); b.classList.toggle('on', e.checked);
      if (id === 'noband') { const nm = b.querySelector('.gz-nm'); if (nm) nm.textContent = ['Полосы', 'Без полос', 'До треуг.'][+e.dataset.mode || 0]; } });
    gView.append(b); }
  gView.append(gView.querySelector('[data-n="bFoldHorizontal"]'),gView.querySelector('[data-n="bFoldVertical"]'));
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
  const ptNames = { bFill:'Заливка', bAutoVertical:'Столбы', bStolb:'Проход', bPaintMid:'Центр', midBox:'1 · 0 · ⇔', bAutoAll:'Авто', fillMirror:'Зеркало', bFillUndo:'Отмена', bFillRedo:'Повтор', bFillClear:'Стереть', bPaintNew:'С нуля', sym:'Симметрия', symTriangles:'Тотемы', bTriangleAxes:'Оси пустот', bFrameWindow:'Кадр отдельно', symV:'Оси ↕', symH:'Оси ↔', symD:'Оси ╲╱', bAxisLine:'Ось', bAxisMirror:'Вниз', bAxisXor:'Хор', bAxisLinesClear:'Убрать', col:'Цвета', bits:'Биты', digits:'Цифры', digitsOnly:'Только цифры', cellInk:'Грани', geomCenter:'Геоцентр', fixLines:'Застыло', bFoldCompare:'Сгиб', bFoldHorizontal:'Свёртка ↔', bFoldVertical:'Свёртка ↕', noband:'Без полос', outline:'Обводка', midCol:'Центр', romb0:'Ромб 0', romb1:'Ромб 1', romb2:'Обе', zTop:'Верх', bRec:'Запись', bGif:'GIF', bXor2:'Xor-Next', bTemplateQuickSave:'Сохранить', bTemplateColour:'Перекрасить' };
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
  { const box = document.createElement('span'); box.className = 'pt-vx';
    for (const id of ['digitOneColour', 'digitZeroColour']) { const e = $(id); e.title = tip(e); box.append(e); }
    const v = $('vrows'); v.title = tip(v); v.placeholder = 'строк'; v.classList.add('pt-vrows'); box.append(v);
    gView.append(box);
    // v0.111: цвета клеток 1 / 0, шрифт и размер цифр — вторым столбиком
    const box2 = document.createElement('span'); box2.className = 'pt-vx'; const pair = document.createElement('span'); pair.className = 'pt-vx-row';
    for (const id of ['bitOneColour', 'bitZeroColour']) { const e = $(id); e.title = tip(e); pair.append(e); }
    const fnt = $('digitFont'), sz = $('digitSize'); fnt.title = tip(fnt); sz.title = tip(sz); sz.classList.add('pt-vrows');
    box2.append(pair, fnt, sz); gView.append(box2); }
  // v0.085: «Отмена» и «Повтор» в одну строку, между ними вертикальная черта.
  { const sep = document.createElement('span'); sep.className = 'pt-sep'; gHistory.firstElementChild.after(sep); }
  $('mayAbout').after(tools);
  // v0.124: «Дзен» и «?» — столбиком, одна над другой, у правого края шапки.
  // v0.125: столбик «Дзен» / «?» — в той же верхней полосе меню, последним.
  { const col = document.createElement('div'); col.id = 'mayCorner'; tools.append(col); col.append($('mayZen'), $('mayHelp')); }
  // v0.158: «меню в одну полоску, с выпадающими списками для каждой группы» — в шапке видны только названия групп;
  // щелчок по названию раскрывает её кнопки списком под ним (открыт один), щелчок мимо или Esc — закрыть.
  // Пока какой-то список открыт, наведение на соседнее название переключает на него. Точка у названия — в группе что-то включено.
  { tools.classList.add('pt-dd'); let open = null;
    const shut = () => { if (!open) return; open.classList.remove('pt-open'); open.querySelector('.pt-l').setAttribute('aria-expanded', 'false'); open = null; };
    const show = g => { if (open === g) return; shut(); open = g; g.classList.add('pt-open'); g.querySelector('.pt-l').setAttribute('aria-expanded', 'true');
      const r = g.querySelector('.pt-r'); r.style.left = ''; const b = r.getBoundingClientRect(); if (b.right > innerWidth - 4) r.style.left = Math.min(0, innerWidth - 4 - b.right) + 'px'; };
    for (const g of tools.querySelectorAll('.pt-g')) { const l = g.querySelector('.pt-l'), row = g.querySelector('.pt-r');
      l.tabIndex = 0; l.setAttribute('role', 'button'); l.setAttribute('aria-haspopup', 'true'); l.setAttribute('aria-expanded', 'false');
      l.onclick = () => open === g ? shut() : show(g);
      l.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); l.click(); } };
      l.onpointerenter = () => { if (open && open !== g) show(g); };
      toolSync.push(() => g.classList.toggle('pt-has-on', !!row.querySelector('.on'))); }
    addEventListener('pointerdown', e => { if (open && !open.contains(e.target)) shut(); }, true);
    addEventListener('keydown', e => { if (e.key === 'Escape') shut(); }); }
  // Сведения и действия выбранной фигуры — сворачиваемая панель справа внизу.
  const infoPanel=document.createElement('details');infoPanel.id='mayatnikInfoPanel';infoPanel.open=true;
  const infoTitle=document.createElement('summary');infoTitle.textContent='Сведения';
  // v0.091: скрытые исходные «Сохранить»/«Цвет» с полем цвета — в группу «Шаблон» шапки, чтобы окно цвета открывалось там.
  tools.querySelector('[data-n="bTemplateColour"]')?.parentElement.parentElement.append($('templateActions'));
  infoPanel.append(infoTitle,status);document.body.append(infoPanel);
  try{infoPanel.open=localStorage.getItem('mayatnik-info-closed')!=='1';}catch(_){}
  infoPanel.addEventListener('toggle',()=>{try{localStorage.setItem('mayatnik-info-closed',infoPanel.open?'0':'1');}catch(_){}});
  // v0.116: «сдвинь ширину под шаблоны ровно» — «Сведения» той же ширины и с тем же правым краем, что и панель «Шаблоны» (она по содержимому)
  toolSync.push(()=>{const r=railRIn.getBoundingClientRect();if(!r.width||innerWidth<=600){infoPanel.style.width=infoPanel.style.right='';return;}
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
