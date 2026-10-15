/* Маятник v0.030: page adapter for the shared ZerkGrozd rail.
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
    const e = $(id), node = e.closest('label');
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
      button('zOut', 'minus'), button('zIn', 'plus'), button('zFit', 'corners'), button('zSnap', 'grid4') ] },
    { id: 'mirrors', title: 'Зеркала', color: '#ff87cf', items: [
      check('sym', 'mirror'), check('symBits', 'colour'), button('bAxisPick', 'select'), button('bClearAxis', 'cross'), button('bKonus', 'ring'),
      { type: 'action', name: 'Зерк. маятник', icon: icon($('mirrorLink'), 'mirror'),
        tip: 'Открыть зеркальный маятник в Зазеркалиусе', click: () => $('mirrorLink').click() },
      control('symRowsMin'), control('symRowsMax'), control('symBitsMin'), control('symBitsMax') ] },
    { id: 'paint', title: 'Раскраска', color: '#ff9b50', items: [button('bFill','colour'),button('bAutoVertical','line'),check('fillMirror','mirror'),control('fillColour'),button('bFillUndo','undo'),button('bFillClear','cross'),button('bRegions','grid4'),button('bPaintRestore','undo'),button('bPng','image')] },
    { id: 'template', title: 'Шаблон', color: '#ffd35b', items: [button('bTemplateTake','colour'),button('bTemplateShow','eye'),button('bTemplateTaller','plus'),button('bTemplateShorter','minus'),button('bTemplateDown','down'),button('bTemplateUp','up'),button('bTemplateReset','reset'),button('bTemplateReturn','swap'),button('bTemplateMove','move'),button('bTemplatePaint','colour'),check('templateTrail','half'),button('bPng','image'),check('templateProportional','corners'),control('templateHeight'),control('templateDown'),control('templateAlpha')] },
    { id:'library',title:'Шаблоны',color:'#d9b9ff',items:[control('templateList'),button('bTemplateLoad','copy'),control('templateName'),button('bTemplateSave','save'),button('bTemplateExport','save'),button('bTemplateImport','folder')] },
    { id: 'export', title: 'Экспорт', color: '#ffd166', items: [
      button('bPng', 'image'), button('bTxt', 'save'), button('bDiag', 'steps') ] }
  ];
  const rail = ZerkGrozd.rail($('mayatnikRail'), { key: 'mayatnik', groups });
  const status = $('mayatnikStatus');
  for (const id of ['lg', 'stat', 'zoomV', 'konusInfo', 'symInfo', 'fillInfo','paintCacheInfo']) status.append($(id));
  const sidebar=document.createElement('aside');sidebar.id='mayatnikSidebar';$('mayatnikRail').before(sidebar);sidebar.append($('mayatnikRail'),$('templateInfo'));
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
  setInterval(() => rail.refresh(), 200);
  new ResizeObserver(() => dispatchEvent(new Event('resize'))).observe($('wrap'));
  dispatchEvent(new Event('resize'));
})();
