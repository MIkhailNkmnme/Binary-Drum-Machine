/* Маятник v0.517 (меню полосой — v0.158; нижняя полоса — v0.327): page adapter for the shared ZerkGrozd rail.
   Original controls/listeners remain the source of truth. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id), source = document.querySelector('.bar');
  if (!source || !window.ZerkGrozd || !window.ZerkMenuIcons) return;
  const popupRight=()=>{const panel=$('mayatnikTemplatePanel');if(window.MayatnikTemplatePanel?.isOpen()&&panel){const left=panel.getBoundingClientRect().left;if(left>0)return left;}return innerWidth;};
  const tip = e => e.title || e.closest('label')?.title || e.getAttribute('aria-label') || e.textContent.trim();
  const icon = (e, kind) => { e.dataset.miIcon = kind; return ZerkMenuIcons.iconFor(e); };
  const name = e => ({zFit:'Шрна по Оси',bPaintSave:'Сохранить',bPaintOpen:'Открыть',bRowRun:'Построчно',bFrameWindow:'Кадр',bPaintMid:'Центр',bAutoVertical:'Столбы',bDiag:'Диаг. .txt'}[e.id] || ZerkMenuIcons.shortOf(e));   // v0.174: короткие — длинные обрезались
  const button = (id, kind) => {
    const e = $(id);
    return { type: 'toggle', name: name(e), icon: icon(e, kind), tip: tip(e),
      nameNow: () => id === 'bPlay' ? (e.getAttribute('aria-pressed') === 'true' ? 'Пауза' : 'Анимация')
        : id === 'bTemplatePaint'||id === 'bGifScale' ? e.textContent : id === 'bAnimHl'||id === 'bBlackMirror' ? e.textContent.replace(/^Зеркало:\s*/, 'Зерк. ').replace(/^Аниматрица:\s*/, 'Аним. ') : id === 'bStep' ? e.textContent.trim() : id === 'zSnap' ? 'Кратный ×' + (e.dataset.base || 2) : name(e),
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
  const segments = (title, options) => ({type:'pair',cls:'may-segments',name:title,tip:title,mid:'',parts:options.map(o=>({label:o.name,tip:title+' — '+o.name,on:o.on,click:o.pick}))});
  const selectSegments = (id,names) => {const e=$(id);return segments(tip(e),[...e.options].map(o=>({name:names?.[o.value]||o.textContent,on:()=>e.value===o.value,pick:()=>{e.value=o.value;e.dispatchEvent(new Event('change',{bubbles:true}));}})));};
  const ringSegments = (id,names) => {const e=$(id),now=()=>e.textContent.split(': ')[1];return {...segments(tip(e),names.map(name=>({name,on:()=>now()===name,pick:()=>{for(let n=0;n<names.length&&now()!==name;n++)e.click();}}))),src:id};};
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
    return {...pair(t, { tip: 'Цвет', on: t.on, open, ink: () => src.value }, label, '●', { cls: 'gz-wl', name: label, tip: t.tip + ' · справа — цвет' }),src:id,colourSource:colId}; };
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
      { ...num('frame', { name: 'Кадр', fmt: v => v+' \\ '+($('frame').dataset.rows||$('rows').value), zero: 0 }), tip: 'Кадр = вершина · −N / +N — на столько вершин, какая скорость анимации (×N; в паре — пар) · бегунок: щелчок — ▶ пуск / ❚❚ пауза, тянуть — к любой · двойной щелчок — 0',
        // v0.317: «если ставлю ×2 — в стрелках кадра также пиши +2»: стрелки шагают на скорость анимации (подписи −N / +N обновляет toolSync ниже)
        step: d => { if (window.mayThirds?.on() && Math.abs(d) !== 2) { window.mayThirds.step(Math.sign(d)); return; }   // v0.318: «Трети»
          const e = $('frame'), N = Math.abs(d) === 2 ? Math.max(1, Math.round(((+e.max || 0) - (+e.min || 0)) / 20)) : Math.max(1, +$('speed').value || 1), v = Math.max(+e.min || 0, Math.min(+e.max, +e.value + Math.sign(d) * N)); if (String(v) !== e.value) { e.value = String(v); fire(e); } },
        arrows: ['−1', '+1'], thumb: { label: () => $('bPlay').getAttribute('aria-pressed') === 'true' ? '❚❚' : '▶', click: () => $('bPlay').click() } } ] },
    // v0.103: группа «Вид» целиком переехала в шапку («перемести всё в Вид сверху») — в рейке её нет
    { id: 'ochki', title: 'Очки', color: '#ffb347', items: [
      button('bOchki', 'eye'), check('ochkiInv', 'half'), check('ochkiRev', 'swap'), check('frozen', 'pin'), ringSegments('bBlackMirror',['выкл','краска','всё']), ringSegments('bAnimHl',['выкл','столб','всё']),
      selectSegments('ochkiMode',{diag:'Диаг.',row:'Ряды'}),selectSegments('ochkiPattern',{initial:'Нач.',ones:'111',zeros:'000',alternating:'1010'}),num('ochkiLength',{name:'От бит',slider:false}) ] },
    { id: 'zoom', title: 'Масштаб', color: '#7cbcff', items: [
      button('zFit', 'corners'), pair(tgl('zTop'),tgl('zFitH'),'Верх','Вниз',{name:'Верх · Вниз',cls:'may-zoom-edges'}),
      button('zLock', 'pin'), button('zLines', 'line'), button('zVert', 'line'), button('zDiag', 'line'), button('zSnap', 'grid4') ] },
    { id: 'mirrors', title: 'Зеркала', color: '#ff87cf', items: [
      { type: 'toggle', icon: '⋈', name: 'Зерк. ось', tip: 'Зеркальная ось: один конец на нижней границе последней строки (тянется вдоль низа), второй — поворот · отражение поля под полем',   // v0.177
        on: () => !!window.MayMirAxis?.on, click: () => window.MayMirAxis?.toggle() },
      { type: 'toggle', icon: '▱', name: 'Контур', tip: 'Контур: внешняя граница фигуры маятника линиями в 1 px · наведи на линию — она продолжится пунктиром в обе стороны',   // v0.186
        on: () => !!window.MayContour?.on, click: () => window.MayContour?.toggle() },
      check('sym', 'axes'), check('symV', 'axes'), check('symH', 'axes'), check('symD', 'axes'), check('symBits', 'grid4'),   // v0.133: какие оси и их длина / ширина
      check('symTriangles','tri'),button('bTriangleAxes','tri'),num('symTriangleRows',{name:'Высота ≥',tip:'Высота тотемов: строк от',slider:false}),
      { type: 'vpair', name: 'Строк', tip: 'Длина оси: строк от · до', parts: [{ ...num('symRowsMin', { slider: false }), name: 'строк ≥' }, { ...num('symRowsMax', { slider: false, inf: true, fromInf: () => +$('symRowsMin').value || 2 }), name: '≤' }] },
      { type: 'vpair', name: 'Бит', tip: 'Ширина оси: бит от · до', parts: [{ ...num('symBitsMin', { slider: false }), name: 'бит ≥' }, { ...num('symBitsMax', { slider: false, inf: true, fromInf: () => +$('symBitsMin').value || 2 }), name: '≤' }] }, button('bAxisLine', 'line'), button('bAxisMirror', 'down'), button('bAxisXor', 'half'), button('bAxisLinesClear', 'cross') ] },
    { id: 'paint', title: 'Раскраска', color: '#ff9b50', items: [button('bPaintNew','reset'),withColour('bFill','fillColour','Заливка'),withColour('bAutoVertical','verticalFillColour','Столбы'),withColour('bStolb','stolbFillColour','Проход'),button('bPaintMid','line'),withColour('midOneOn','midOneColour','Центр 1'),withColour('midZeroOn','midZeroColour','Центр 0'),check('midWide','line'),button('bAutoAll','steps'),button('bFillGrow','plus'),check('fillMirror','mirror'),select('fillArea','grid4'),(()=>{const u=tgl('bFillUndo'),r=tgl('bFillRedo');return pair(u,r,'↶ Отмена','↷ Повтор',{dis:both(u,r)});})(),button('bFillClear','cross'),button('bRegions','grid4'),button('bPaintRestore','undo')] },
    { id: 'template', title: 'Шаблон', color: '#ffd35b', items: [button('bAutoTpl','grid4'),button('bTemplateTake','colour'),button('bTemplateShow','eye'),button('bTemplateClone','copy'),button('bTemplateRemove','cross'),(()=>{const a=tgl('bTemplateFlipH'),b=tgl('bTemplateFlipV');return pair(a,b,'⇆ Отраз.','⇅ Отраз.',{dis:both(a,b),tip:'Отразить шаблон ↔ · ↕'});})(),button('bMirrorLine','line'),button('bMirrorByLine','mirror'),button('bXor2','down'),(()=>{const u=tgl('bFillUndo'),r=tgl('bFillRedo');return pair(u,r,'↶ Отмена','↷ Повтор',{dis:both(u,r)});})(),(()=>{const a=tgl('bTemplateTaller'),b=tgl('bTemplateShorter');return pair(a,b,'+ Выше','− Ниже',{dis:both(a,b),tip:'Шаблон выше · ниже'});})(),button('bTemplateReturn','swap'),button('bTemplateReset','reset'),button('bTemplateTransfer','move'),button('bTemplateFall','down'),button('bTemplatePaint','colour'),check('templateTrail','half'),check('templateProportional','corners'),/* v0.472: «Застыло — цвет» (templateLock) снята — замки выключены (LOCK_OFF в странице) */check('templateMask','corners'),num('xorStep',{name:'Шаг k',fmt:v=>'шаг k '+v}),num('templateHeight',{name:'Высота %',log:true,fmt:v=>'высота '+v+' %',zero:100}),num('templateDown',{name:'Вниз, строк',slider:false,zero:0}),num('templateAlpha',{name:'Видимость %',fmt:v=>'видимость '+v+' %',zero:50}),button('bTemplatePick','corners'),{...selectSegments('templatePickMode'),src:'templatePickMode'}] },
    {id:'gifscale',title:'Гиф-Масштаб',color:'#73e4a5',items:[button('bGifScale','record'),select('gifScaleSequence','steps'),select('gifScaleMethod','grid4'),num('gifScaleDelay',{name:'Пауза, мс',fmt:v=>v+' мс',zero:200}),button('bGifScaleInfo','help')]},
    { id:'library',title:'Шаблоны',color:'#d9b9ff',items:[control('templateLibraryChoices'),button('bLibPage','grid4'),button('bTemplateImport','folder'),button('bTemplateExport','save')] },
    { id: 'export', title: 'Экспорт', color: '#ffd166', items: [
      button('bPaintSave','save'),button('bPaintOpen','load'),button('bFrameWindow','corners'),
      button('bPng', 'image'), button('bRec', 'record'), button('bGif','record'), button('bTxt', 'save'), button('bDiag', 'steps') ] }
  ];
  { const g0 = groups.find(x => x.id === 'build'); g0.items = g0.items.filter(it => it.name !== 'Хорр' && it.name !== 'Анимация' && it.name !== 'Кадр, с'); const fr = g0.items.find(it => it.name === 'Кадр'); if (fr) delete fr.thumb; }   // v0.339: бегунок кадра — линия, плей — своей кнопкой в середине   // v0.332: «Хорр» — в нижней полосе   // v0.395: «удали дубли» — «Анимация» и «Кадр, с» есть в нижней полосе (×N | время)
  groups.push({id:'horr',title:'Хорр',color:'#73e4a5',items:[]});
  const rail = ZerkGrozd.rail($('mayatnikRail'), { key: 'mayatnik', groups, headerFactory:g=>ZerkGroupHeader.create({title:g.title,className:'gz-hx gz-head',titleClass:'gz-nm',pinClass:'gz-pin',iconClass:'gz-mico',arrowClass:'gz-ar'}) });
  const railSourceButtons=new Map(),manualLegacyCells=new Map();
  {const group=rail.el.querySelector('.gz-group[data-id="mirrors"]');if(group)manualLegacyCells.set('mirrors',[...group.querySelectorAll('.gz-soty > .gz-hx')]);}
  // v0.439: «Верх / Вниз» — одна стандартная кнопка, два независимых включателя.
  for(const [index,id] of ['zTop','zFitH'].entries()){
    const half=rail.el.querySelector('.may-zoom-edges .gz-h'+index),src=$(id);
    half.dataset.source=id;half.title=tip(src);half.tabIndex=0;half.setAttribute('role','button');half.setAttribute('aria-label',index?'Вниз':'Верх');
    const sync=()=>half.setAttribute('aria-pressed',src.getAttribute('aria-pressed')||'false');
    new MutationObserver(sync).observe(src,{attributes:true,attributeFilter:['aria-pressed']});sync();
    half.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();half.click();}});
  }
  // A closed diamond joins Верх/Вниз; it toggles both existing controls together.
  {
    const host=rail.el.querySelector('.may-zoom-edges'),ids=['zTop','zFitH'];
    const read=()=>ids.map(id=>$(id).getAttribute('aria-pressed')==='true');
    const joint=ZerkControlFrame.pairSwitch(host,{read,onToggle:target=>{for(const id of ids)if(($(id).getAttribute('aria-pressed')==='true')!==target)$(id).click();rail.refresh();}});
    const observer=new MutationObserver(joint.sync);for(const id of ids)observer.observe($(id),{attributes:true,attributeFilter:['aria-pressed']});
  }
  // v0.255: «тут тоже — если правой, то в ромб»: правый щелчок по шапке группы рейки — она сворачивается в ромб со значком, ещё раз — обратно
  // (щелчок по ромбу открывает группу, как шапка); свёрнутые — в памяти браузера (mayatnik-rail-mini)
  { const MINI = 'mayatnik-rail-mini', ICO = { 'Поле': '▦', 'Очки': '◎', 'Масштаб': '⤢', 'Зеркала': '⋈', 'Раскраска': '✎', 'Шаблон': '▣', 'Шаблоны': '▤', 'Экспорт': '⇩' };
    let minis = new Set(); try { minis = new Set(JSON.parse(localStorage.getItem(MINI) || '[]')); } catch (_) {}
    for (const box of rail.el.querySelectorAll('.gz-group')) { const head = box.querySelector(':scope > .gz-head'), nm = head?.querySelector('.gz-nm'); if (!nm) continue;
      const k = nm.textContent.trim(), ic = ZerkGroupHeader.parts(head).icon;ic.textContent = ICO[k] || [...k][0] || '◆';
      const sync = () => { box.classList.toggle('gz-mini', minis.has(k));ZerkGroupHeader.sync(head,{mini:minis.has(k)}); head.setAttribute('aria-label', k); };
      sync(); head.addEventListener('contextmenu', e => { e.preventDefault(); e.stopPropagation(); if (minis.has(k)) minis.delete(k); else minis.add(k);
        try { localStorage.setItem(MINI, JSON.stringify([...minis])); } catch (_) {} sync(); }); } }
  // v0.167: подсказки кнопок рейки — в title (их показывает mayatnik-tips.js рядом с кнопкой через 4 с)
  for (const g of groups) { const box = rail.el.querySelector('.gz-group[data-id="' + g.id + '"]'); if (!box) continue;
    const wide = t => ['value', 'list', 'control', 'vpair'].includes(t), a = g.items.filter(i => !wide(i.type)), b = g.items.filter(i => wide(i.type));
    const ca = box.querySelectorAll('.gz-soty > .gz-hx'), cb = box.querySelectorAll('.gz-wide > .gz-hx');
    a.forEach((it, i) => { if(ca[i]&&it.src)railSourceButtons.set(it.src,ca[i]);if(ca[i]&&it.colourSource&&['fillColour','verticalFillColour','stolbFillColour','midZeroColour','midOneColour'].includes(it.colourSource)){const dot=ca[i].querySelector('.gz-h1');if(dot){dot.classList.add('may-auto-ink');window.MayatnikColourAuto?.adaptPalette(dot,it.colourSource,()=>$(it.colourSource).value,null,{paint:false});}}if (ca[i] && (it.tip || it.name)) ca[i].title = it.tip || it.name; }); b.forEach((it, i) => { if(cb[i]&&it.type==='list')cb[i].dataset.listTitle=it.name; if (cb[i] && it.type !== 'control' && it.type !== 'vpair' && (it.tip || it.name)) cb[i].title = it.tip || it.name; }); }
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
      const pcx = () => mid.clientWidth / 2, playPlace = () => { if(window.mayFramePlace){window.mayFramePlace();return;}const bar = $('mayBottomBar'), ax = window.mayAxisX?.(); if (!bar) return;
        const cur = parseFloat(bar.style.getPropertyValue('--axdx')) || 0, C = cell.getBoundingClientRect(), BR = bar.getBoundingClientRect(), c0 = C.left + C.width / 2 - cur;
        const grp = [...bar.children].filter(e => e.matches('.may-bb-half, .gz-sl, #mayBbHorr')).map(e => e.getBoundingClientRect()), L0 = Math.min(...grp.map(r => r.left)) - cur, R0 = Math.max(...grp.map(r => r.right)) - cur;
        let dx = Number.isFinite(ax) ? ax - c0 : 0; dx = Math.max(BR.left + 4 - L0, Math.min(BR.right - 4 - R0, dx)); const v = Math.round(dx) + 'px'; if (bar.style.getPropertyValue('--axdx') !== v) { bar.style.setProperty('--axdx', v); window.mayBotPlace?.(); } };   // v0.406: связка сдвинулась — группы внизу обходят её заново
      window.mayPlayPlace = playPlace;
      // v0.442: число сразу под линией бегунка; вне шестиугольника, чтобы его не обрезало.
      const vl = mid.querySelector('.gz-vl');if(vl){vl.classList.add('may-frame-value');cell.after(vl);}
      const side = () => {if(!vl)return;const bar=cell.parentElement,t=th.getBoundingClientRect(),b=bar.getBoundingClientRect();
        const x=(t.left+t.width/2-b.left-bar.clientLeft)+'px',y=(t.bottom-b.top-bar.clientTop)+'px';if(vl.style.left!==x)vl.style.left=x;if(vl.style.top!==y)vl.style.top=y;};
      const valueObserver=new MutationObserver(side);valueObserver.observe(mid,{attributes:true,attributeFilter:['style']});if(vl)valueObserver.observe(vl,{attributes:true,attributeFilter:['style']});
      new ResizeObserver(side).observe(cell);addEventListener('resize',()=>{playPlace();side();});playPlace();side(); } }
  // v0.332: «это в нижнюю полоску также, выпадающим наверх списком, но объедини по 2 в кнопку»: «Хорр N» справа в полосе; щелчок — над ней
  // столбец кнопок по два размера (256 | 512, 1024 | 2024, 4096); щелчок по половине — построить этот размер (как кнопки «хорр» панели)
  { const pres = [...source.querySelectorAll('button.pre')], wrapH = rail.el.querySelector('.gz-group[data-id="horr"]');
    const b = wrapH.querySelector('.gz-head');b.querySelector('.gz-nm').append(' ',document.createElement('b'));
    b.title = 'Сразу построить маятник: строк = N, вершин = N (или N/3 при «До N/3») · щелчок — список размеров';
    const pop = document.createElement('div'); pop.className = 'gz-wide';
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
        on: () => cur() === e.dataset.n, click: () => { e.click(); sync(); } }))); sizeRows.push(row); pop.append(row); }
    const sync = () => { const n = cur(); b.querySelector('b').textContent = n;   // v0.374: число строк — всегда, и выставленное ползунком «Строк»
      for (const r of sizeRows) r.gzSync();   // v0.380
      };   // v0.379: «или-или — обводка одной кнопки, а не двух сразу»: каймой — только выбранная половина (CSS .may-hp-h.on), не вся кнопка   // v0.374: только кнопки размеров (не «N/3 | 4N»)
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
    wrapH.append(pop);sync(); }
  // v0.337: «Анимацию вниз копируй, но только число ×1…×10 — по нажатию меняется, пол-кнопки; вторая половина — время 0 … 1/20 … до 1 с, тоже по нажатию»:
  // слева в полосе одна кнопка из двух половин: скорость (щелчок +1, после ×10 — ×1; правый — назад) | длительность кадра (0, 1/20, 1/10, 1/5, 1/2, 1 с по кругу)
  { const sp = $('speed'), ft = $('frameT'), T = [0, 1, 2, 4, 10, 20], TN = ['0с', '1/20с', '1/10с', '1/5с', '1/2с', '1с'];   // v0.473: без пробела — помещается между стрелками
    // v0.340: «по обе стороны от бегунка раздели»: ×N — полкнопкой слева от ползунка кадра, время — справа
    // v0.473: «эти две крайние от ползунка — со стрелками, чтобы уменьшать и увеличивать»: ◂ ▸ по краям, без перескока по кругу, удержание повторяет
    const half = k => { const e = document.createElement('button'); e.type = 'button'; e.className = 'gz-hx may-bb-half'; e.dataset.k = k;
      e.innerHTML = '<i class="may-bb-ar" data-d="-1" aria-hidden="true">◂</i><span class="may-hp-h"></span><i class="may-bb-ar" data-d="1" aria-hidden="true">▸</i>'; return e; };
    const bs = half('sp'), bf = half('ft'), hs = bs.querySelector('.may-hp-h'), hf = bf.querySelector('.may-hp-h');
    hs.title = 'Скорость анимации: вершин за кадр · щелчок — +1 (после ×10 — ×1), правый — −1'; hf.title = 'Сколько длится кадр анимации · щелчок — следующее (0 · 1/20 · 1/10 · 1/5 · 1/2 · 1 с), правый — предыдущее';
    const sync = () => { hs.textContent = '×' + (+sp.value || 1); const v = +ft.value || 0, i = T.indexOf(v); hf.textContent = i >= 0 ? TN[i] : String(+(v * .05).toFixed(2)).replace('.', ',') + 'с'; };
    const spSet = d => { const v = +sp.value || 1; sp.value = String(d > 0 ? (v >= 10 ? 1 : v + 1) : (v <= 1 ? 10 : Math.min(10, v - 1))); fire(sp); sync(); rail.refresh(); };
    const ftSet = d => { const v = +ft.value || 0; let i; if (d > 0) { i = T.findIndex(t => t > v); if (i < 0) i = 0; } else { i = T.length - 1; while (i >= 0 && T[i] >= v) i--; if (i < 0) i = T.length - 1; }
      ft.value = String(T[i]); fire(ft); sync(); rail.refresh(); };
    bs.onclick = e => { if (bs.arDown) { bs.arDown = false; return; } if (!e.target.closest('.may-bb-ar')) spSet(1); }; bs.oncontextmenu = e => { e.preventDefault(); spSet(-1); };
    bf.onclick = e => { if (bf.arDown) { bf.arDown = false; return; } if (!e.target.closest('.may-bb-ar')) ftSet(1); };   // arDown: нажали на стрелку — подпись могла сменить ширину и увести стрелку из-под мыши bf.oncontextmenu = e => { e.preventDefault(); ftSet(-1); };
    const spStep = d => { const v = Math.max(1, Math.min(32, (+sp.value || 1) + d)); if (String(v) === sp.value) return; sp.value = String(v); fire(sp); sync(); rail.refresh(); };
    const ftStep = d => { const v = +ft.value || 0; let i = T.indexOf(v); if (i < 0) i = d > 0 ? T.findIndex(t => t > v) - 1 : T.findIndex(t => t >= v); i = Math.max(0, Math.min(T.length - 1, (i < 0 ? T.length - 1 : i) + d));
      if (T[i] === v) return; ft.value = String(T[i]); fire(ft); sync(); rail.refresh(); };
    for (const [b, step, what] of [[bs, spStep, 'скорость'], [bf, ftStep, 'длительность кадра']]) for (const ar of b.querySelectorAll('.may-bb-ar')) {
      const d = +ar.dataset.d; ar.title = (d < 0 ? 'Меньше' : 'Больше') + ' — ' + what + ' · удержание — подряд';
      let hold = 0, rep = 0; const end = () => { clearTimeout(hold); clearInterval(rep); hold = rep = 0; };
      ar.addEventListener('pointerdown', e => { if (e.button !== 0) return; e.preventDefault(); e.stopPropagation(); b.arDown = true; step(d); hold = setTimeout(() => { rep = setInterval(() => step(d), 90); }, 350); });
      for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) ar.addEventListener(ev, end);
      ar.addEventListener('click', e => { e.stopPropagation(); b.arDown = false; }); }
    sp.addEventListener('input', sync); ft.addEventListener('input', sync); const sl = $('mayBottomBar').querySelector(':scope > .gz-sl');
    if (sl) { sl.before(bs); sl.after(bf); } else $('mayBottomBar').append(bs, bf); sync();
    const hr = $('mayBbHorr'); if (hr) bf.after(hr); }   // v0.350: «Хорр» — сразу справа от ползунка (за временем кадра)
  rail.el.querySelector('.gz-group[data-id="build"]')?.remove(); // Управление полем уже перенесено в нижний пульт.
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
    const cells = [...soty.children], shown = cells.filter(b => !b.classList.contains('gz-off-dis')&&!b.classList.contains('may-merged-source'));
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
    const l = ZerkGroupHeader.create({title:name,className:'pt-l',titleClass:'may-group-title',pinClass:'pt-pin',iconClass:'pt-ico'}).head; const row = document.createElement('div'); row.className = 'pt-r';
    g.append(l, row); tools.append(g); return row; };
  // v0.478: одна «Раскраска» — группа paint в общей рейке; её исходные контролы и обработчики сохранены.
  const gEdit = ptGroup('Очистка'), gAxis = ptGroup('Оси'),gHistory=ptGroup('Правка'), gMeet = ptGroup('Точка Ось');   // v0.318: «отдельная кнопка Точка Ось меню — туда все её кнопки и заливки»
  gHistory.parentElement.classList.add('pt-history');
  for (const id of ['bPaintMeet','bPaintAxis','bThirds','bTriTop']) groupOf[id] = gMeet;
  for (const id of ['bFillUndo','bFillRedo']) groupOf[id] = gHistory;
  for (const id of ['bFillClear','bPaintNew','bReset']) groupOf[id] = gEdit;   // v0.168: «Очистить всё поле» — из рейки «Поле» сюда
  for (const id of ['sym','symV','symH','symD','symTriangles','bTriangleAxes','bFrameWindow','bAxisLine','bAxisMirror','bAxisXor','bAxisLinesClear','bRuler']) groupOf[id] = gAxis;
  for (const [id, kind] of [['bPaintMeet','axes'],['bPaintAxis','axes'],['bThirds','steps'],['bTriTop','tri'],['bFillUndo','undo'],['bFillRedo','forward'],['bFillClear','cross'],['bPaintNew','reset'],['bReset','cross'],['sym','axes'],['symV','axes'],['symH','axes'],['symD','axes'],['symTriangles','tri'],['bTriangleAxes','tri'],['bFrameWindow','corners'],['bAxisLine','select'],['bAxisMirror','down'],['bAxisXor','half'],['bAxisLinesClear','cross'],['bRuler','line']]) {
    const e = $(id), b = document.createElement('button'); b.type = 'button'; b.className = 'pt-b'; b.dataset.n = id;
    const mark = document.createElement('i'); mark.style.backgroundImage = icon(e, kind); b.append(mark);
    b.onclick = () => e.click();
    // v0.050: правый клик по нажатому значку — выключить его режим.
    b.oncontextmenu = ev => { ev.preventDefault(); if (e.matches('[aria-pressed="true"]') || (e.type === 'checkbox' && e.checked)) e.click(); };
    toolSync.push(() => { b.title = tip(e) + (id === 'bAutoVertical' ? ' · сейчас: ' + e.textContent : ''); if (['bPaintMeet','bPaintAxis','bThirds','bTriTop'].includes(id)) b.setAttribute('aria-label', b.title); b.disabled = e.disabled;
      if (id === 'bPaintMeet' || id === 'bPaintAxis' || id === 'bTriTop') { const nm = b.querySelector('.gz-nm'); if (nm && nm.textContent !== e.dataset.miShort) nm.textContent = e.dataset.miShort; }   // v0.315: «Точка 1 / 0»
      const on=e.type === 'checkbox' ? e.checked : e.matches('[aria-pressed="true"]');b.classList.toggle('on',on);b.setAttribute('aria-pressed',String(on)); });
    // v0.121: «Симметрия» — включить и выключить оси симметрии (выключает и выбор оси с конусом, как «Скрыть оси»).
    if (id === 'sym') { const hide = $('mayHideAxes'); b.onclick = b.oncontextmenu = ev => { ev?.preventDefault?.(); if (!hide.hidden || e.checked) hide.click(); else if (ev.type === 'click') e.click(); };
      toolSync.push(() => { const on=!hide.hidden||e.checked;b.title = on ? 'Оси симметрии видны · щелчок — скрыть' : 'Показать оси симметрии'; b.classList.toggle('on',on);b.setAttribute('aria-pressed',String(on)); }); }
    groupOf[id].append(b);
  }
  // v0.176: «верхняя полоса — по логике хаба»: цвет — ● внутри своей кнопки (щелчок по ● — палитра), сырых полей нет
  const dotIn = (b, srcId, title) => { const src = $(srcId), open = picker(src), d = document.createElement('span'); d.className = 'pt-dot'; d.title = title || tip(src) || 'Цвет';
    d.addEventListener('click', ev => { ev.stopPropagation(); open(d); }); toolSync.push(() => { d.style.background = src.value; }); b.append(d); return d; };
  const ptBtn = (n, kind, src, onclick) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'pt-b'; b.dataset.n = n;
    const mark = document.createElement('i'); mark.style.backgroundImage = icon(src, kind); b.append(mark); b.onclick = onclick; return b; };
  { const G = $('bFillGrow'), bg = ptBtn('meetGrow', 'plus', G, () => G.click());   // v0.318: в «Точке Оси» — свои «Рост» (та же кнопка) и цвет заливки
    toolSync.push(() => { bg.title = tip(G); bg.setAttribute('aria-label', bg.title); bg.classList.toggle('on', G.getAttribute('aria-pressed') === 'true'); }); gMeet.append(bg);
  } // Shared fill colour remains inside the Fill control.

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
    const bv = fold('Загиб Верт', 2, 'Загиб вертикальный: то, что «Зеркало ↑» вынесло за поле, отражается внутрь через вертикали — в точках, где диагонали зеркала встречают стороны поля');
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
    // v0.281: «Площади» — треугольник ▼, секторы, зубец пилы — в клетках, совпадения
    const arp = document.createElement('button'); arp.title = 'Площади'; const bAr = ptBtn('areas', 'square', arp, () => { const A = window.mayAreas; A?.set(!A.get()); placeTools(); });
    toolSync.push(() => { const on = !!window.mayAreas?.get(); bAr.classList.toggle('on', on); bAr.title = 'Площади в клетках: ▼ — самая большая сплошная область в нижнем секторе, секторы верх / низ / лево / право, зубец пилы; совпавшие — одним цветом и строкой «… = …» внизу слева · ' + (on ? 'вкл' : 'выкл'); });
    // v0.477: «Заморозка» — снимок ▼ площадей текущего кадра, контуры стоят на месте, пока маятник растёт; ещё раз — снять
    // v0.478: щелчок — добавить ▼ этого кадра к замороженным; снять все — «Очистить» в «Очистке» («снятие через очистить»)
    const afp = document.createElement('button'); afp.title = 'Заморозка'; const bAf = ptBtn('areaFreeze', 'pin', afp, () => { window.mayAreaFreeze?.add(); placeTools(); });
    toolSync.push(() => { const Z = window.mayAreaFreeze?.get(); bAf.classList.toggle('on', !!Z); bAf.title = Z ? 'Заморожено ▼: ' + Z.tris.length + ' (кадры ' + Z.ks.join(', ') + ') — контуры и площади стоят на месте, маятник растёт · щелчок — добавить ▼ этого кадра; снять — «Очистить»' : 'Заморозка: щелчок — запомнить ▼ площади этого кадра (контуры и h² останутся на месте, пока маятник растёт; следующие щелчки добавляют ▼ других кадров); снять — «Очистить» · нужна точка встречи'; });
    // v0.486: чистое построение от вершины, отдельный сброс; ×2, затем ×3/2, ×4/3 — итог ×2, ×3, ×4 от снимка.
    const ovp = document.createElement('button'); ovp.title = 'Наложение'; const bOv = ptBtn('ovlStep', 'plus', ovp, () => { window.mayOvl?.step(); placeTools(); });
    const opp = document.createElement('button'); opp.title = 'Сдвиг'; const bOp = ptBtn('ovlPos', 'swap', opp, () => { window.mayOvl?.pos(); placeTools(); });
    const ohp = document.createElement('button'); ohp.title = 'Шаг'; const bOh = ptBtn('ovlH0', 'grid4', ohp, () => { window.mayOvl?.h0(); placeTools(); });
    const orp = document.createElement('button'); orp.title = 'Сброс наложения'; const bOr = ptBtn('ovlReset', 'reset', orp, () => { window.mayOvl?.reset(); placeTools(); });
    const ofp = document.createElement('button'); ofp.title = 'Фиксировать наложение'; const bOf = ptBtn('ovlFreeze', 'pin', ofp, () => { window.mayOvl?.freeze(); placeTools(); });
    const oap = document.createElement('button'); oap.title = 'Видимость наложения'; const bOa = ptBtn('ovlAlpha', 'half', oap, () => { window.mayOvl?.opacity(); placeTools(); });
    const oop = document.createElement('button'); oop.title = 'Оригинал под наложение'; const bOo = ptBtn('ovlOriginal', 'target', oop, () => { window.mayOvl?.original(); placeTools(); });
    const ocp = document.createElement('button'); ocp.title = 'По вертикальной оси оригинала: центрировать наложение только по X. Y и масштаб сохраняются.'; const bOc = ptBtn('ovlCenter', 'axes', ocp, () => { if(!bOc.disabled)window.mayOvl?.center(); placeTools(); });bOc.title=ocp.title;bOc.setAttribute('aria-label',ocp.title);
    bOr.dataset.miShort = 'Сброс налож.'; bOr.title = 'Сброс наложения: убрать увеличенную копию и забыть её снимок. Поле, кадр, масштаб, краска и шаблоны сохраняются. Следующее включение возьмёт новый исходник.'; bOr.setAttribute('aria-label', bOr.title);
    toolSync.push(() => { const O = window.mayOvl?.get(); if (!O) return; const total = O.n+1, ratio = O.n ? total/O.n : 2;
      bOv.disabled = bOp.disabled = bOh.disabled = O.fixed; bOf.disabled = !O.n; bOo.disabled = !O.fixed;
      bOc.disabled=!O.centerable;
      bOf.classList.toggle('on',O.fixed); bOf.setAttribute('aria-pressed',String(O.fixed));
      bOf.title = O.fixed ? 'Увеличенная копия закреплена на экране. Кадры, построение и масштаб оригинала её не меняют. Ещё раз — снять фиксацию и привязку оригинала; снимок остаётся. После F5 экранная фиксация не восстанавливается.' : 'Зафиксировать именно текущее увеличенное наложение на экране с сохранением выбранной видимости (по умолчанию 50%). Вершина сразу привязана; колесо, ± и жест притягивают масштаб к копии бит в бит. «Оригинал» совмещает сразу. После F5 фиксированный снимок не восстанавливается.';
      bOf.setAttribute('aria-label',bOf.title);
      const na=bOa.querySelector('.gz-nm');if(na){const t='Видимость '+O.alpha+'%';if(na.textContent!==t)na.textContent=t;}
      bOa.title='Видимость всего наложения до и после фиксации: '+O.alpha+'%. Щелчок — 0 → 25 → 50 → 75 → 100%. При 0% копия скрыта, фиксация и магнит сохраняются; при 50% оригинал виден сквозь копию; при 100% полная видимость. Пиксели снимка не меняются.';bOa.setAttribute('aria-label',bOa.title);
      bOo.classList.toggle('on',O.matched);bOo.setAttribute('aria-pressed',String(O.matched));bOo.title=(O.matched?'Сетка совмещена. ':'Магнит масштаба включается при фиксации. ')+'Бит в бит: совместить размер, центры и границы клеток оригинала с закреплённой копией и привязать последующее масштабирование колесом, ± и жестом к общей вершине. Кадр и значения битов не меняются. Другой кадр или мелкий исходный масштаб не обещают одинаковых цветов снимка и поля. Для RGB опора — центральная копия G. Предел масштаба 40; «Блок» сохраняется. '+(O.message||'');bOo.setAttribute('aria-label',bOo.title);
      bOv.classList.toggle('on', O.n > 0); bOv.title = (O.n ? 'Наложение: итог ×' + total + ' от снимка; переход ×' + O.n + ' → ×' + total + ' (ещё ×' + (+ratio.toFixed(4)).toString().replace('.', ',') + '). ' : 'Наложение: запомнить чистое построение в текущем масштабе и увеличить ×2 от вершины. ') + 'Один исходник с цветами и правками, без новых битов, осей, подписей и сглаживания. Вершина на оси остаётся на месте; сдвиги R/B действуют отдельно. В большом режиме в исходник входит видимая область. Следующие щелчки: ×3, ×4 и далее, без предела. «Сброс наложения» убирает копию; новое включение берёт свежий исходник; после F5 снимок берётся заново.';
      bOv.setAttribute('aria-label', bOv.title);
      const nb = bOv.querySelector('.gz-nm'); if (nb) { const t = O.n ? 'Налож. ×' + total : 'Наложение'; if (nb.textContent !== t) nb.textContent = t; }
      const np = bOp.querySelector('.gz-nm'); if (np) { const t = 'Сдвиг ' + O.pos; if (np.textContent !== t) np.textContent = t; } bOp.title = 'Сдвиг копии снимка: R — вправо на (k − 1)/2 клетки предыдущего размера, G — по центру, B — влево, RGB — копии по очереди R, G, B (непрозрачные участки верхней B закрывают нижние). k — отношение текущего шага; исходные цвета не меняются · сейчас ' + O.pos; bOp.setAttribute('aria-label', bOp.title);
      const nh = bOh.querySelector('.gz-nm'); if (nh) { const t = 'Шаг ' + O.h0; if (nh.textContent !== t) nh.textContent = t; } bOh.title = 'Шаг h0: 8 → 16 → 32 → 64 → 128. Задаёт длину цикла до выключения по числу строк в момент снимка; не обрезает снимок. Смена шага выключает наложение; следующее включение возьмёт новый снимок · сейчас ' + O.h0; bOh.setAttribute('aria-label', bOh.title); });
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
    const mp = document.createElement('button'); mp.title = 'Размеры';
    const bMs = ptBtn('lineMeasures', 'ruler', mp, () => { const M=window.mayLineMeasures; M?.set(!M.get()); placeTools(); });
    gView.append(bMs);
    bMs.setAttribute('aria-label','Размеры линий в битах');
    toolSync.push(() => { const on=!!window.mayLineMeasures?.get(); bMs.classList.toggle('on',on); bMs.setAttribute('aria-pressed',String(on)); bMs.title='Размеры линий в битах: числа и все линии поверх битов · '+(on?'вкл':'выкл'); });
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
      bl.title = 'Зеркало ↓: ниже точки встречи «Застыло» боковые клинья отражаются через диагонали внутрь нижнего треугольника · сейчас: ' + ['выкл', 'левая диагональ', 'правая диагональ', 'обе'][i] + ' · Левая / Обе / Правая — выбрать отражение; повторный щелчок по выбранной части — выключить'; });
    window.mayFixLowNames = ['Выкл', 'Левая', 'Правая', 'Обе'];
    // v0.223: «Сверху вниз» — «Зеркало ↑» наоборот: верхний треугольник ложится в нижний
    const dp = document.createElement('button'); dp.title = 'Вниз'; const bd = ptBtn('fixDown', 'swap', dp, () => { const D = window.mayFixDown; D?.set(!D.get()); placeTools(); });
    toolSync.push(() => { const on = !!window.mayFixDown?.get(); bd.classList.toggle('on', on); bd.title = 'Сверху вниз: «Зеркало ↑» наоборот — верхний треугольник (и вся строка при «Во всю ширину») отражается вниз от точки встречи · ' + (on ? 'вкл' : 'выкл'); });
    // v0.224: «Наружу» — «Зеркало ↓» наоборот: нижний треугольник через диагонали в боковые клинья
    const op = document.createElement('button'); op.title = 'Наружу'; const bn = ptBtn('fixLowOut', 'swap', op, () => { const Lw = window.mayFixLow; Lw?.setOut(!Lw.out()); placeTools(); });
    toolSync.push(() => { const on = !!window.mayFixLow?.out(); bn.classList.toggle('on', on); bn.title = 'Наружу: «Зеркало ↓» наоборот — нижний треугольник отражается через диагонали в боковые клинья · ' + (on ? 'вкл' : 'выкл'); });
    gView.querySelector('[data-n="fixMirror"]').after(bTc, bSf, bSc, bAr, bAf, bOv, bOp, bOh, bOf, bOa, bOo, bOc, bOr, bRl, bVf, bHt, bd, bf, bv, ba, bLk, bRc, bw, br, bk, bl, bn, bc, bo);
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
  const ptNames = { lineMeasures:'Размеры', fixMirror:'Зеркало ↑', fixFold:'Загиб', fixFoldV:'Загиб Верт', fixDragK:'Сдвиг кадром', fixAxis:'Ось: ход', rowCount:'Биты в строках', fixCross:'Точка встречи', sawFull:'Пила полная', rowLab:'Подписи', vtxFlash:'Вспышка', heat:'Тепло',   // v0.329: «Вид» — стандартной ширины, названия короче
    sectors:'Секторы', areas:'Площади', areaFreeze:'Заморозка', ovlStep:'Наложение', ovlPos:'Сдвиг G', ovlH0:'Шаг 8', ovlReset:'Сброс налож.', ovlFreeze:'Фиксировать', ovlAlpha:'Видимость 50%', ovlOriginal:'Оригинал', ovlCenter:'По оси', saw:'Пила', fixLock:'Замок ↔', fixWide:'Во всю ширину', fixRot:'Вывернутое', fixLow:'Зеркало ↓', fixDown:'Сверху вниз', fixLowOut:'Наружу', mirCol:'Зерк. все цвета', mirOp:'Зерк. копия', px_b:'Синие', px_r:'Красные', px_y:'Жёлтые', px_k:'Чёрные', px_w:'Белые', bReset:'Всё поле', clrPaint:'Окраска', clrMirrors:'Зеркала', clrSel:'Выделение', bFill:'Заливка', bAutoVertical:'Столбы', bStolb:'Проход', bPaintMid:'Центр', midBox:'1 · 0 · ⇔', bAutoAll:'Авто', bPaintMeet:'Точка', bPaintAxis:'ТочкаОсь', bThirds:'Трети', bTriTop:'▼ ← верх', meetGrow:'Рост', meetCol:'Цвет', bFillGrow:'Рост', fillMirror:'Зеркало', bFillUndo:'Отмена', bFillRedo:'Повтор', bFillClear:'Стереть', bPaintNew:'С нуля', sym:'Симметрия', symTriangles:'Тотемы', bTriangleAxes:'Оси пустот', bFrameWindow:'Кадр отдельно', symV:'Оси ↕', symH:'Оси ↔', symD:'Оси ╲╱', bAxisLine:'Своя ось', bAxisMirror:'Вниз', bAxisXor:'Хор', bAxisLinesClear:'Убрать', bRuler:'Линейка', col:'Цвета', bits:'Биты', digits:'Цифры', digitsOnly:'Только цифры', cellInk:'Грани', geomCenter:'Геоцентр', fixLines:'Застыло', bFoldCompare:'Сгиб', bFoldHorizontal:'Свёртка ↔', bFoldVertical:'Свёртка ↕', noband:'Без полос', outline:'Обводка', midCol:'Центр', romb0:'Ромб 0', romb1:'Ромб 1', romb2:'Обе', zTop:'Верх', bRec:'Запись', bGif:'GIF', bXor2:'Xor-Next', bTemplateQuickSave:'Сохранить', bTemplateColour:'Перекрасить', viewCycle:'Вид', c_digitOneColour:'Цифра 1', c_digitZeroColour:'Цифра 0', c_bitOneColour:'Клетка 1', c_bitZeroColour:'Клетка 0', fontCycle:'Шрифт', sizeCtl:'Размер', midOneOn:'Центр 1', midZeroOn:'Центр 0', midWide:'⇔ 2-й уровень' };
  // v0.073: значки заменены обычными длинными кнопками, как в меню: значок + название, по две строки в группе.
  // «Запись» и «Цвет» остаются маленькими, с подписью сверху.
  const ptColour = { 'Точка Ось':'#b48cff', 'Правка':'#ffd35b', 'Очистка':'#ffd35b', 'Оси':'#ff87cf', 'Вид':'#7cbcff', 'Зеркала':'#b48cff', 'Шаблон':'#ffd35b' };
  for (const g of tools.querySelectorAll('.pt-g')) { const c = ptColour[g.querySelector('.pt-l').textContent]; if (c) { g.style.setProperty('--c', c); g.classList.add('pt-long'); } }
  for (const row of tools.querySelectorAll('.pt-r')) [...row.children].forEach((b, k) => {
    if (b.id === 'lg') return;
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
  }
  // Independent view switches: neither half turns its neighbour off.
  for(const [id,title,prefix,keys]of [['parityCells','Клетки','Кл',['cellsEven','cellsOdd']],['parityRows','Строки','Стр',['rowsEven','rowsOdd']]]){
    const row=document.createElement('div');row.className='gz-hx gz-pair gz-split may-segments may-independent-selector';row.dataset.n=id;row.setAttribute('role','group');row.setAttribute('aria-label',title+' — чётные и нечётные');row.title=title+' — видимость чётных и нечётных независимо; исходные биты сохраняются';
    const parts=keys.map((key,i)=>{const part=document.createElement('span');part.className='gz-half gz-h'+i;part.textContent=prefix+' '+['Чёт','Нечёт'][i];part.title=title+' — '+['чётные','нечётные'][i]+'. Показать или скрыть независимо.';part.setAttribute('role','button');part.tabIndex=0;part.setAttribute('aria-label',part.title);
      part.addEventListener('click',e=>{e.stopPropagation();const api=window.mayParity;if(api)api.set(key,api.get()[key]===false);rail.refresh();placeTools();});part.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();part.click();}});row.append(part);return part;});
    toolSync.push(()=>{const value=window.mayParity?.get()||{};parts.forEach((part,i)=>{const on=value[keys[i]]!==false;part.classList.toggle('gz-on',on);part.setAttribute('aria-pressed',String(on));});});gView.append(row);
  }
  // v0.226: «и эту раздели в 2, отдели фоном или вложенностью, сделай по темам» — список «Вида» в два столбца (.pt-col), в них блоки по темам
  // своим фоном (.pt-sec, тема — в подсказке блока): слева — как выглядит поле, справа — «Застыло», зеркала и пиксели по цвету.
  // У блока поля 2 px сверху и снизу и нет зазора между блоками — шаг рядов (кнопка + зазор 4 px) тот же, зубцы рамки (zig) — против остриёв кнопок.
  { const VIEW_COLS = [
      [['Показ поля', '#7cbcff', ['lg', 'viewCycle', 'parityCells', 'parityRows', 'noband', 'outline', 'geomCenter', 'cellInk', 'rowLab', 'vtxFlash', 'heat']],
       ['Сгиб и свёртки', '#73e4a5', ['bFoldCompare', 'bFoldHorizontal', 'bFoldVertical']],
       ['Цифры и клетки', '#ffd35b', ['c_digitOneColour', 'c_digitZeroColour', 'c_bitOneColour', 'c_bitZeroColour', 'fontCycle', 'sizeCtl']]],
      [['«Застыло» и Зеркало ↑', '#b48cff', ['fixLines', 'fixCross', 'lineMeasures', 'sawFull', 'sectors', 'areas', 'fixMirror', 'fixDown', 'fixFold', 'fixFoldV', 'fixAxis', 'fixLock', 'rowCount', 'fixWide', 'fixRot', 'fixDragK']],
       ['Зеркало ↓', '#ff87cf', ['fixLow', 'fixLowOut']],
       ['Все зеркала: цвет и наложение', '#ff9b50', ['mirCol', 'mirOp']],
       ['Пиксели по цвету: видны / скрыты', '#e8edf5', ['px_b', 'px_r', 'px_y', 'px_k', 'px_w']]] ];
    const pick = n => n === 'lg' ? $('lg') : n === 'vx' ? gView.querySelector(':scope > .pt-vx') : gView.querySelector(':scope > [data-n="' + n + '"]');
    const cols = VIEW_COLS.map(secs => { const col = document.createElement('div'); col.className = 'pt-col';
      for (const [t, c, ns] of secs) { const s = document.createElement('div'); s.className = 'pt-sec'; s.dataset.t = t; s.style.setProperty('--s', c);   // v0.392: «лишняя подсказка» — название блока не всплывает (было title)
        for (const n of ns) { const e = pick(n); if (e) s.append(e); } if (s.children.length) col.append(s); } return col; });
    const rest = [...gView.children]; if (rest.length) { const s = document.createElement('div'); s.className = 'pt-sec'; s.style.setProperty('--s', '#7cbcff'); s.append(...rest); cols[0].append(s); }   // новая кнопка без темы — в конец «Вида»
    cols[0].classList.add('pt-colv'); gView.append(cols[0]); gMir.append(cols[1]); gView.classList.add('pt-cols'); gMir.classList.add('pt-cols'); }   // v0.238: левый столбец — «Вид», правый — «Зеркала»
  const gAreas = ptGroup('Площади');
  gAreas.parentElement.dataset.k='Площади';gAreas.parentElement.classList.add('may-measure-group');gAreas.parentElement.querySelector('.may-group-title').textContent='МЕРИТЬ';
  gAreas.parentElement.style.setProperty('--c', '#b48cff');
  for (const n of ['sawFull', 'sectors', 'areas', 'areaFreeze', 'ovlStep', 'ovlPos', 'ovlH0', 'ovlFreeze', 'ovlAlpha', 'ovlOriginal', 'ovlCenter', 'ovlReset', 'lineMeasures']) { const b = tools.querySelector('[data-n=' + n + ']'); if (b) gAreas.append(b); }
  // v0.490 (МАЯ-019): группа — только клиент реестра; настройки не пересчитывают поле и не меняют исходные пиксели.
  function installLayersMenu(api) {
    if(!api)return;
    Object.assign(ptNames,{layerSelect:'Слой',layerVisible:'Виден',layerTint:'Цвет',layerNative:'Родные',layerBack:'Назад',layerFront:'Вперёд',layerCapture:'Копия',layerRemove:'Удалить',layerReset:'Сброс слоя',layerCenter:'По оси'});
    const row=ptGroup('Слои'),group=row.parentElement;group.classList.add('pt-layers');group.style.setProperty('--c','#73e4a5');group.dataset.k='Слои';
    const current=()=>api.get(),change=patch=>{const layer=current();if(layer)api.set(layer.id,patch);};
    const caption=(b,text)=>{const label=b.querySelector('.gz-nm');if(label&&label.textContent!==text)label.textContent=text;};
    const describe=(b,text)=>{b.title=text;b.setAttribute('aria-label',text);};
    const command=(id,kind,help,run)=>{const source=document.createElement('button');source.title=help;const b=ptBtn(id,kind,source,()=>{if(!b.disabled)run();});
      b.classList.add('gz-hx');b.querySelector('i')?.classList.add('gz-ic');const label=document.createElement('span');label.className='gz-nm';label.textContent=ptNames[id];b.append(label);describe(b,help);return b;};
    const pair=(left,right)=>{const p=document.createElement('div');p.className='gz-hx gz-pair gz-split may-layer-pair';p.dataset.n=left.dataset.n+'-'+right.dataset.n;
      for(const [i,b]of [left,right].entries()){b.className='gz-half gz-h'+i;p.append(b);}return p;};
    const choose=command('layerSelect','grid4','Выбрать содержательный слой: оригинал, наложение, фиксацию или шаблон.',()=>{});
    choose.onclick=null;choose.setAttribute('aria-haspopup','true');choose.setAttribute('aria-expanded','false');row.append(choose);
    const visible=command('layerVisible','eye','Показать или скрыть выбранный слой без изменения его исходника.',()=>{const layer=current();if(layer)change({visible:!layer.visible});});row.append(visible);
    const colour=document.createElement('input');colour.type='color';colour.className='may-layer-colour';colour.tabIndex=-1;colour.setAttribute('aria-label','Цвет выбранного слоя');
    colour.addEventListener('input',()=>change({tint:colour.value}));
    const tint=command('layerTint','colour','Оттенки выбранного цвета для слоя. Исходные пиксели и родные цвета не переписываются.',()=>{const layer=current();if(!layer)return;colour.value=layer.tint||'#73e4a5';try{colour.showPicker();}catch(_){colour.click();}});
    const native=command('layerNative','reset','Родные цвета выбранного слоя: снять цветовой оттенок.',()=>change({tint:null}));row.append(pair(tint,native));group.append(colour);
    const valueControl=(key,label,type)=>{
      const box=document.createElement('div');box.className='gz-hx gz-control gz-val may-layer-value may-standard';box.dataset.n='layer-'+key;describe(box,label);
      const input=document.createElement('input');input.type=type;input.id='mayLayer-'+key;input.setAttribute('aria-label',label);input.step=type==='range'?'1':'any';
      if(type==='range'){input.min='0';input.max='100';box.classList.add('may-layer-opacity');}
      const mid=document.createElement('label');mid.className='gz-mid';mid.htmlFor=input.id;
      const tag=document.createElement('span');tag.className='may-layer-axis';tag.textContent=type==='range'?'':key.toUpperCase();mid.append(tag,input);
      let output=null;if(type==='range'){output=document.createElement('output');output.htmlFor=input.id;mid.append(output);}
      input.addEventListener(type==='range'?'input':'change',()=>{if(input.disabled||input.value.trim()==='')return;const n=Number(input.value);if(Number.isFinite(n))change({[key]:type==='range'?Math.max(0,Math.min(100,n)):n});});
      const arrows=[-1,1].map(delta=>{const b=document.createElement('button');b.type='button';b.className='gz-a';b.textContent=delta<0?'‹':'›';describe(b,label+(delta<0?' — уменьшить на 1':' — увеличить на 1'));
        const step=()=>{const layer=current();if(!layer||b.disabled)return;const n=Number(layer[key])+delta;change({[key]:type==='range'?Math.max(0,Math.min(100,n)):n});};
        let repeated=false,timer=0;b.onclick=event=>{if(!repeated||!event?.detail)step();repeated=false;};
        b.addEventListener('pointerdown',event=>{if(event.button!==0||b.disabled)return;repeated=false;clearTimeout(timer);const again=()=>{repeated=true;step();timer=setTimeout(again,80);};timer=setTimeout(again,350);
          const stop=()=>clearTimeout(timer);addEventListener('pointerup',stop,{once:true});addEventListener('pointercancel',stop,{once:true});});return b;});
      box.append(arrows[0],mid,arrows[1]);const frame=ZerkControlFrame.attach(box,arrows[0],mid,arrows[1],{input,output});row.append(box);return {box,input,arrows,output,frame};
    };
    const opacity=valueControl('opacity','Видимость выбранного слоя, от 0 до 100 процентов','range'),x=valueControl('x','Сдвиг выбранного слоя X, CSS px','number'),y=valueControl('y','Сдвиг выбранного слоя Y, CSS px','number');
    const center=command('layerCenter','axes','По вертикальной оси оригинала: центрировать выбранное наложение или фиксацию только по X. Y и масштаб сохраняются.',()=>{const layer=current();if(layer?.centerable)api.center(layer.id);});row.append(center);
    const back=command('layerBack','back','Назад: переместить выбранный слой на один уровень ниже.',()=>{const layer=current();if(layer)api.move(layer.id,-1);});
    const front=command('layerFront','forward','Вперёд: переместить выбранный слой на один уровень выше.',()=>{const layer=current();if(layer)api.move(layer.id,1);});row.append(pair(back,front));
    const capture=command('layerCapture','copy','Снимок-копия выбранного слоя: новая самостоятельная фиксация в текущем сеансе.',()=>{const layer=current();if(layer)api.capture(layer.id);});
    const remove=command('layerRemove','cross','Удалить выбранную допустимую копию. Оригинал, наложение и шаблоны не удаляются.',()=>{const layer=current();if(layer?.removable)api.remove(layer.id);});row.append(pair(capture,remove));
    const reset=command('layerReset','reset','Сброс выбранного слоя: родные цвета, видимость 100%, X=0, Y=0 и показать. Остальные слои не меняются.',()=>{const layer=current();if(layer)api.reset(layer.id);});row.append(reset);
    let openList=null,listSignature='';
    const fillList=list=>{
      const layers=api.list(),signature=JSON.stringify(layers.map(layer=>[layer.id,layer.name,layer.kind]));
      if(signature!==listSignature||!list.children.length){listSignature=signature;list.replaceChildren();
        for(const layer of layers){const b=command('layerSelect','grid4','Выбрать слой: '+layer.name,()=>api.select(layer.id));b.dataset.layerId=layer.id;caption(b,layer.name);
          if(layer.kind==='template')b.querySelector('.gz-nm').setAttribute('data-user-label','');list.append(b);}
      }
      for(const b of list.querySelectorAll(':scope > .gz-hx')){const on=b.dataset.layerId===api.selected();b.classList.toggle('gz-on',on);b.setAttribute('aria-pressed',String(on));}
      decorateListHeading(list,choose);
    };
    ZerkGrozd.listHover(choose,{options:()=>api.list().map(layer=>({name:layer.name,on:layer.id===api.selected(),pick:()=>api.select(layer.id)})),color:()=>'#73e4a5',host:()=>group,
      placement:'below',placed(list,owner){openList=list;choose.setAttribute('aria-expanded','true');list.classList.add('may-layer-options');fillList(list);hideListUnder(list,owner);
},closed(){openList=null;listSignature='';choose.setAttribute('aria-expanded','false');}});
    const sync=()=>{
      const layer=current(),layers=api.list(),index=layer?layers.findIndex(item=>item.id===layer.id):-1;
      choose.disabled=!layers.length;for(const b of [visible,tint,native,capture,reset])b.disabled=!layer;
      back.disabled=!layer||index<=0;front.disabled=!layer||index>=layers.length-1;remove.disabled=!layer?.removable;capture.disabled=!layer||layer.capturable===false;colour.disabled=!layer;
      center.disabled=!layer?.centerable;
      const selectedName=layer?.name||'Нет слоёв',label=choose.querySelector('.gz-nm');label.toggleAttribute('data-user-label',layer?.kind==='template');caption(choose,selectedName);describe(choose,'Выбранный слой: '+selectedName+'. Открыть список слоёв.');
      visible.classList.toggle('gz-on',!!layer?.visible);visible.setAttribute('aria-pressed',String(!!layer?.visible));caption(visible,layer?.visible?'Виден':'Скрыт');
      tint.classList.toggle('gz-on',!!layer?.tint);native.classList.toggle('gz-on',!!layer&&!layer.tint);tint.setAttribute('aria-pressed',String(!!layer?.tint));native.setAttribute('aria-pressed',String(!!layer&&!layer.tint));
      for(const [key,control]of [['opacity',opacity],['x',x],['y',y]]){control.input.disabled=!layer;for(const arrow of control.arrows)arrow.disabled=!layer;
        if(document.activeElement!==control.input)control.input.value=String(layer?.[key]??(key==='opacity'?100:0));if(control.output)control.output.textContent=(layer?.opacity??100)+'%';control.frame.sync();}
      if(openList?.isConnected)fillList(openList);
    };
    const unsubscribe=api.subscribe(sync);addEventListener('pagehide',()=>unsubscribe?.(),{once:true});sync();
  }
  installLayersMenu(window.mayLayers);
  // v0.491 (МАЯ-021): собираем существующие входы ручных инструментов, оставляя экранные ручки и окно Сгиба на прежних местах.
  function installManualAxesMenu(railButtons) {
    const row=ptGroup('Ручные оси');row.parentElement.dataset.k='Ручные оси';row.parentElement.style.setProperty('--c','#ffcf73');
    const ids=['zLines','zVert','zDiag','bAxisLine','bAxisMirror','bAxisXor','bAxisLinesClear','bRuler','bFoldCompare'];
    const nodes=new Map(ids.map(id=>[id,railButtons.get(id)||tools.querySelector('[data-n="'+id+'"]')]).filter(([,node])=>node));
    const zoom=railButtons.get('zLines')?.closest('.gz-group');if(zoom)manualLegacyCells.set(zoom.dataset.id,[...zoom.querySelectorAll('.gz-soty > .gz-hx')]);
    const moves=[];
    // zSnap остаётся в Масштабе: его прежний номер ячейки меняется, поэтому тоже получает стабильный ключ.
    for(const [id,node]of [...nodes,...(railButtons.has('zSnap')?[['zSnap',railButtons.get('zSnap')]]:[])]){
      const owner=node.closest('[data-id],.pt-g'),group=owner?.dataset.id||owner?.dataset.k||owner?.querySelector(':scope > .pt-l')?.firstChild?.textContent.trim()||'';
      const parent=node.parentElement,peers=manualLegacyCells.get(group)||[...parent.children].filter(n=>n.matches('button,.gz-hx,[role="button"]'));
      const before=node.dataset.n?'group:'+group+':data:'+node.dataset.n:'group:'+group+':parent:'+(parent.id||parent.className)+':slot:'+peers.indexOf(node);
      const after='group:'+(id==='zSnap'?group:'Ручные оси')+':data:'+id;moves.push([before,after]);node.dataset.n=id;
      if(id==='zSnap')continue;
      if(group==='zoom'){node.dataset.mayPinGroup=group;node.dataset.mayPinIndex=String(manualLegacyCells.get(group).indexOf(node));}
      row.append(node);node.style.left=node.style.top='';
    }
    // Сохраняем прежние данные перед переносом мини-состояний; настройки и места исходных групп не переименовываются.
    try{const key='mayatnik-control-mini-v464',raw=localStorage.getItem(key),saved=JSON.parse(raw||'[]');if(Array.isArray(saved)){
      const merged=new Set(saved);for(const [from,to]of moves)if(merged.has(from))merged.add(to);
      if(merged.size!==saved.length){if(!localStorage.getItem('mayatnik-manual-axes-mini-before-v491'))localStorage.setItem('mayatnik-manual-axes-mini-before-v491',raw);localStorage.setItem(key,JSON.stringify([...merged]));}
    }}catch(_){}
    return row;
  }
  function installNAxesMenu(row,api){
    if(!row||!api||row.querySelector('[data-n="nAxesToggle"]'))return;
    Object.assign(ptNames,{nAxesToggle:'N-ось',nAxesRemove:'Удалить N-оси'});
    const describe=(node,text)=>{node.title=text;node.setAttribute('aria-label',text);};
    const command=(id,kind,help,run)=>{const source=document.createElement('button');source.title=help;
      const b=ptBtn(id,kind,source,()=>{if(!b.disabled){run();sync();}});b.classList.add('gz-hx');b.querySelector('i')?.classList.add('gz-ic');
      const label=document.createElement('span');label.className='gz-nm';label.textContent=ptNames[id];b.append(label);describe(b,help);return b;};
    const toggle=command('nAxesToggle','axes','N-ось: щелчок по биту добавляет центральную ось и по N осей с каждой стороны до концов выбранной строки. Прежние наборы сохраняются.',()=>api.toggle());
    const box=document.createElement('div');box.className='gz-hx gz-control gz-val may-layer-value may-standard';box.dataset.n='nAxesCount';
    describe(box,'Число осей N с каждой стороны центральной: от 1 до 64, включая концы строки. Меняет выбранный набор и число осей для следующего набора.');
    const input=document.createElement('input');input.type='number';input.min='1';input.max='64';input.step='1';input.id='mayNAxesCount';input.value='3';input.setAttribute('aria-label',box.title);
    const mid=document.createElement('label');mid.className='gz-mid';mid.htmlFor=input.id;const tag=document.createElement('span');tag.className='may-layer-axis';tag.textContent='N';mid.append(tag,input);
    const change=value=>{const n=Number(value);if(!Number.isFinite(n))return;api.setN(Math.max(1,Math.min(64,Math.round(n))));sync();};
    input.addEventListener('change',()=>{if(input.value.trim())change(input.value);else sync();});
    const arrows=[-1,1].map(delta=>{const b=document.createElement('button');b.type='button';b.className='gz-a';b.textContent=delta<0?'‹':'›';describe(b,delta<0?'Уменьшить число осей на 1':'Увеличить число осей на 1');b.onclick=()=>change((Number(api.get().n)||3)+delta);return b;});
    box.append(arrows[0],mid,arrows[1]);ZerkControlFrame.attach(box,arrows[0],mid,arrows[1],{input});
    const remove=command('nAxesRemove','cross','Удалить выбранный набор N-осей. Остальные наборы сохраняются.',()=>api.removeSelected());
    row.append(toggle,box,remove);
    function sync(){const state=api.get()||{},on=!!state.enabled;toggle.classList.toggle('on',on);toggle.classList.toggle('gz-on',on);toggle.setAttribute('aria-pressed',String(on));
      input.value=String(Math.max(1,Math.min(64,Math.round(Number(state.n)||3))));remove.disabled=state.selectedId==null;
      remove.classList.toggle('gz-off-dis',remove.disabled);remove.setAttribute('aria-disabled',String(remove.disabled));}
    const unsubscribe=api.subscribe?.(sync);addEventListener('pagehide',()=>unsubscribe?.(),{once:true});toolSync.push(sync);sync();
  }
  const manualAxesRow=installManualAxesMenu(railSourceButtons);
  installNAxesMenu(manualAxesRow,window.mayNAxes);
  function reconcileAxisMenus(rail,definitions,axisRow,manualRow){
    const box=rail.el.querySelector('.gz-group[data-id="mirrors"]'),definition=definitions.find(g=>g.id==='mirrors');if(!box||!definition)return;
    const narrow=manualLegacyCells.get('mirrors')||[...box.querySelectorAll('.gz-soty > .gz-hx')],wide=[...box.querySelectorAll('.gz-wide > .gz-hx')];
    const keys=['mayMirAxis','mayContour','sym','symV','symH','symD','symBits','symTriangles','bTriangleAxes','symTriangleRows','symRowsRange','symBitsRange','bAxisLine','bAxisMirror','bAxisXor','bAxisLinesClear'];
    const manual=new Set(['bAxisLine','bAxisMirror','bAxisXor','bAxisLinesClear']),moves=[];let ni=0,wi=0;
    definition.items.forEach((item,index)=>{const isWide=['value','list','control','vpair'].includes(item.type),slot=isWide?wi++:ni++,original=(isWide?wide:narrow)[slot],id=keys[index];
      if(!original||index<2)return;const row=manual.has(id)?manualRow:axisRow;if(!row)return;
      const target=row.querySelector('[data-n="'+id+'"]')||original,group=manual.has(id)?'Ручные оси':'Оси';
      const before=original.dataset.n?'group:mirrors:data:'+original.dataset.n:'group:mirrors:parent:'+(original.parentElement?.id||original.parentElement?.className|| (isWide?'gz-wide':'gz-soty'))+':slot:'+slot;
      target.dataset.n=id;
      if(target===original){row.append(target);target.style.left=target.style.top='';}else original.remove();
      if(!isWide){narrow[slot]=target;target.dataset.mayPinGroup='mirrors';target.dataset.mayPinIndex=String(slot);}
      moves.push([before,'group:'+group+':data:'+id]);
      moves.push(['group:mirrors:parent:'+(isWide?'gz-wide':'gz-soty')+':slot:'+slot,'group:'+group+':data:'+id]);
      if(manual.has(id))moves.push(['group:Оси:data:'+id,'group:Ручные оси:data:'+id]);
      // Manual commands may also have an older second proxy in the Оси row.
      if(manual.has(id))for(const duplicate of axisRow.querySelectorAll('[data-n="'+id+'"]'))if(duplicate!==target)duplicate.remove();
    });
    manualLegacyCells.set('mirrors',narrow);
    try{const key='mayatnik-control-mini-v464',raw=localStorage.getItem(key),saved=JSON.parse(raw||'[]');if(Array.isArray(saved)){const merged=new Set(saved);for(const [from,to]of moves)if(merged.has(from))merged.add(to);
      if(merged.size!==saved.length){if(!localStorage.getItem('mayatnik-axes-mini-before-v042'))localStorage.setItem('mayatnik-axes-mini-before-v042',raw);localStorage.setItem(key,JSON.stringify([...merged]));}}}catch(_){}
  }
  reconcileAxisMenus(rail,groups,gAxis,manualAxesRow);
  // v0.496: очистка доступна только в «Очистке»; прежние номера закрепов Раскраски остаются адресами тех же команд.
  function removePaintClearDuplicates(railButtons) {
    const box=railButtons.get('bPaintNew')?.closest('.gz-group');if(!box)return;
    const original=[...box.querySelectorAll('.gz-soty > .gz-hx')],legacy=[...original],moves=[];
    for(const [i,node]of original.entries()){
      const parent=node.parentElement,from=node.dataset.n?'group:paint:data:'+node.dataset.n:'group:paint:parent:'+(parent.id||parent.className)+':slot:'+i;
      if(!node.dataset.n)node.dataset.n='paint-slot:'+i;
      node.dataset.mayPinGroup='paint';node.dataset.mayPinIndex=String(i);
      let to='group:paint:data:'+node.dataset.n;
      for(const id of ['bPaintNew','bFillClear'])if(node===railButtons.get(id)){
        const proxy=gEdit.querySelector('[data-n="'+id+'"]');if(!proxy)continue;
        proxy.dataset.mayPinGroup='paint';proxy.dataset.mayPinIndex=String(i);
        legacy[i]=proxy;railButtons.set(id,proxy);to='group:Очистка:data:'+id;node.remove();
      }
      moves.push([from,to]);
    }
    manualLegacyCells.set('paint',legacy);
    try{const key='mayatnik-control-mini-v464',raw=localStorage.getItem(key),saved=JSON.parse(raw||'[]');if(Array.isArray(saved)){
      const merged=new Set(saved);for(const [from,to]of moves)if(merged.has(from))merged.add(to);
      if(merged.size!==saved.length){const backup='mayatnik-paint-clear-mini-before-v496';if(!localStorage.getItem(backup))localStorage.setItem(backup,raw);localStorage.setItem(key,JSON.stringify([...merged]));}
    }}catch(_){}
  }
  removePaintClearDuplicates(railSourceButtons);

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
  // v0.499: «Ось: 0, 1, −1 — как Стык, между ними ромб текущей»: [Ось | 0 | 1 | −1] — gz-tri, как в Хабе; 0 — стоит, 1 — ход, −1 — антиход.
  // Прежняя кнопка «Ось» спрятана и по-прежнему хранит режим (mayFixAxis: 0 — ход, 1 — стоит, 2 — антиход).
  { const src = tools.querySelector('[data-n="fixAxis"]');
    if (src) { const b = document.createElement('button'); b.type = 'button'; b.className = 'pt-b gz-hx gz-pair gz-tri'; b.dataset.n = 'fixAxis3';
      const pm = document.createElement('span'); pm.className = 'gz-pm'; pm.textContent = 'Ось'; b.append(pm);
      [['0', 1, 'стоит — на границе, толщиной 2 пикселя'], ['1', 0, 'ход — за точкой встречи: при равном числе битов слева и справа — на границе между битами (2 пикселя), иначе на бите слева или справа от неё'], ['−1', 2, 'антиход — 1 пиксель навстречу маятнику']].forEach(([l, v, t], j) => {
        const sp = document.createElement('span'); sp.className = 'gz-half gz-h' + j; sp.textContent = l; b.append(sp);
        sp.onclick = e => { e.stopPropagation(); window.mayFixAxis?.set(v); placeTools(); };
        toolSync.push(() => { const on = (window.mayFixAxis?.get() || 0) === v; sp.classList.toggle('gz-on', on); b.style.setProperty('--gz-r' + j, on ? 'var(--c)' : 'color-mix(in srgb,var(--c) 30%,#000)'); sp.title = 'Ось «Зеркала ↑»: ' + l + ' — ' + t; }); });
      b.classList.add('gz-any'); b.title = 'Ось «Зеркала ↑»: 0 — стоит, 1 — ход, −1 — антиход';
      // v0.500: «в Оси» — переключатель живёт в группе «Оси», после «Своей оси»
      const after = gAxis.querySelector('[data-n="bAxisLine"]'); if (after) after.after(b); else gAxis.append(b); src.style.display = 'none'; } }
  // v0.501: «в одну кнопку Полосы, Треуг, Обвод» — [Полосы | Треуг | Обвод]: Полосы — режим 0 (щелчок — без полос / обратно),
  // Треуг — режим 2 «до треугольника» (щелчок — к нему / к «без полос»); не горят обе — «без полос». Обвод — обводка, вкл / выкл.
  { const nb = $('noband'), ol = $('outline'), sNb = tools.querySelector('[data-n="noband"]'), sOl = tools.querySelector('[data-n="outline"]');
    if (nb && ol && sNb && sOl) { const mode = () => +nb.dataset.mode || 0, go = i => { for (let n = 0; n < 3 && mode() !== i; n++) nb.dispatchEvent(new Event('change')); };
      const b = document.createElement('button'); b.type = 'button'; b.className = 'pt-b gz-hx gz-pair gz-split gz-split3'; b.dataset.n = 'bandTri';
      [['Полосы', () => mode() === 0, () => go(mode() === 0 ? 1 : 0), 'Полосы: показаны — щелчок убирает (без полос); убраны — щелчок возвращает'],
       ['Треуг', () => mode() === 2, () => go(mode() === 2 ? 1 : 2), 'До треугольника: без полос, стороны треугольника и в обычных видах · щелчок — вкл / выкл'],
       ['Обвод', () => ol.checked, () => ol.click(), 'Обводка: жёлтая ступенчатая линия по краю «шумной» зоны · щелчок — вкл / выкл']].forEach(([l, on, click, t], j) => {
        const sp = document.createElement('span'); sp.className = 'gz-half gz-h' + j; sp.textContent = l; sp.title = t; b.append(sp);
        sp.onclick = e => { e.stopPropagation(); click(); placeTools(); };
        toolSync.push(() => { const v = on(); sp.classList.toggle('gz-on', v); b.style.setProperty('--gz-r' + j, v ? 'var(--c)' : 'color-mix(in srgb,var(--c) 30%,#000)'); });
        if (!j) { const pm = document.createElement('span'); pm.className = 'gz-pm'; b.append(pm); } });
      sNb.before(b); sNb.style.display = sOl.style.display = 'none'; } }
  // v0.500: «в одну кнопку 5 цветов» — пиксели по цвету одной кнопкой из пяти частей; часть горит — пиксели этого цвета видны.
  { const parts = ['b', 'r', 'y', 'k', 'w'].map(c => tools.querySelector('[data-n="px_' + c + '"]')).filter(Boolean);
    if (parts.length === 5) { const b = document.createElement('button'); b.type = 'button'; b.className = 'pt-b gz-hx gz-pair gz-split gz-split5'; b.dataset.n = 'pxAll'; b.title = 'Пиксели по цвету: горит — видны, погашена — скрыты';
      parts.forEach((src, j) => { const sp = document.createElement('span'); sp.className = 'gz-half gz-h' + j; const d = src.querySelector('.pt-dot').cloneNode(); sp.append(d); b.append(sp);
        sp.onclick = e => { e.stopPropagation(); src.click(); placeTools(); };
        toolSync.push(() => { const on = src.classList.contains('on'); sp.classList.toggle('gz-on', on); b.style.setProperty('--gz-r' + j, on ? 'var(--c)' : 'color-mix(in srgb,var(--c) 30%,#000)'); sp.title = src.title; }); });
      parts[0].before(b); for (const p of parts) p.style.display = 'none'; } }
  // v0.500: «эти в 2 кнопки» — «Цифра 1 | 0» и «Клетка 1 | 0»: название по центру, по краям кружки цвета единиц и нулей (щелчок — палитра).
  // v0.502: «Клетка 1 | 0» снята — те же цвета, что левая половина палитры поля (#lg); прежние кнопки спрятаны.
  for (const n of ['c_bitOneColour', 'c_bitZeroColour']) { const e = tools.querySelector('[data-n="' + n + '"]'); if (e) e.style.display = 'none'; }
  for (const [nm, one, zero] of [['Цифра', 'digitOneColour', 'digitZeroColour']]) {
    const s1 = tools.querySelector('[data-n="c_' + one + '"]'), s0 = tools.querySelector('[data-n="c_' + zero + '"]'); if (!s1 || !s0) continue;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'pt-b gz-hx gz-pair gz-split gz-mid gz-cpair'; b.dataset.n = 'c2_' + one;
    const pm = document.createElement('span'); pm.className = 'gz-pm'; pm.textContent = nm; b.append(pm);
    [[s1, nm + ' 1'], [s0, nm + ' 0']].forEach(([src, t], j) => { const sp = document.createElement('span'); sp.className = 'gz-half gz-h' + j; sp.title = 'Цвет: ' + t.toLowerCase() + ' · щелчок — палитра';
      const d = src.querySelector('.pt-dot'); sp.append(d); sp.onclick = e => { e.stopPropagation(); d.click(); }; b.append(sp); });
    s1.before(b); s1.style.display = s0.style.display = 'none'; }
  // v0.085: «Отмена» и «Повтор» в одну строку, между ними вертикальная черта.
  { const sep = document.createElement('span'); sep.className = 'pt-sep'; gHistory.firstElementChild.after(sep); }
  $('mayAbout').after(tools);
  // v0.441: кадр — наверху, «Отмена / ось / Повтор» — в нижней полосе.
  const frameBar=$('mayBottomBar'),footerBar=document.createElement('div');footerBar.id='mayFooterBar';document.body.append(footerBar);tools.append(frameBar);
  frameBar.style.setProperty('--axdx','0px');frameBar.setAttribute('aria-label','Управление кадром');
  // v0.496: оставшаяся рейка шаблона входит в ту же библиотеку; пары и ползунки переносятся целиком.
  function mergeTemplateRail(row,railButtons) {
    const box=railButtons.get('bAutoTpl')?.closest('.gz-group');if(!box)return;
    const cells=[...box.querySelectorAll('.gz-soty > .gz-hx')],wide=[...box.querySelectorAll('.gz-wide > .gz-hx')],legacy=[...cells],moves=[];
    const before=row.querySelector('.gz-control:has(#templateLibraryChoices)');
    for(const [i,node]of [...cells,...wide].entries()){
      const peers=i<cells.length?cells:wide,slot=peers.indexOf(node),parent=node.parentElement;
      const from=node.dataset.n?'group:template:data:'+node.dataset.n:'group:template:parent:'+(parent.id||parent.className)+':slot:'+slot;
      const source=[...railButtons].find(([id,el])=>el===node)?.[0],existing=source?row.querySelector('[data-n="'+source+'"]'):null;
      const target=existing||node;
      if(!target.dataset.n)target.dataset.n=source||'template-'+(i<cells.length?'cell:':'wide:')+slot;
      if(i<cells.length){target.dataset.mayPinGroup='template';target.dataset.mayPinIndex=String(slot);legacy[slot]=target;}
      moves.push([from,'group:Шаблоны:data:'+target.dataset.n]);
      if(existing){node.remove();railButtons.set(source,target);}else{row.insertBefore(node,before);node.style.left=node.style.top='';}
    }
    manualLegacyCells.set('template',legacy);box.remove();
    try{
      const mark='mayatnik-template-rail-merge-v496',keys=['mayatnik-control-mini-v464','mayatnik-dd-grid','mayatnik-dd-order','mayatnik-dd-pins','mayatnik-dd-fold','mayatnik-dd-mini','mayatnik-dd-open','mayatnik-bot','mayatnik-botx','mayatnik-dd-up','grozd:mayatnik','mayatnik-rail-mini'];
      const raw=Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)]));
      const read=(k,def)=>{try{const v=JSON.parse(raw[k]);return v&&typeof v===typeof def&&Array.isArray(v)===Array.isArray(def)?v:def;}catch(_){return def;}};
      const write=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
      if(!localStorage.getItem(mark+'-before'))localStorage.setItem(mark+'-before',JSON.stringify(raw));
      const minis=new Set(read(keys[0],[]));for(const [from,to]of moves)if(minis.has(from))minis.add(to);write(keys[0],[...minis]);
      if(!localStorage.getItem(mark)){
        const name='Шаблоны',old='gz:template',grid=read('mayatnik-dd-grid',{}),order=read('mayatnik-dd-order',[]),bot=read('mayatnik-bot',[]),bx=read('mayatnik-botx',{});
        const placed=Object.hasOwn(grid,name)||order.includes(name)||bot.includes(name)||Object.hasOwn(bx,name);
        for(const [key,data]of [['mayatnik-dd-grid',grid],['mayatnik-botx',bx]]){if(!placed&&Object.hasOwn(data,old)&&!Object.hasOwn(data,name))data[name]=data[old];delete data[old];write(key,data);}
        for(const key of ['mayatnik-dd-order','mayatnik-bot']){const list=read(key,[]);write(key,[...new Set(list.flatMap(k=>k===old?placed?[]:[name]:[k]))]);}
        const grozd=read('grozd:mayatnik',{}),pinned=grozd.pin?.includes('template');
        for(const key of ['mayatnik-dd-pins','mayatnik-dd-fold','mayatnik-dd-mini']){const list=read(key,[]),inherit=key==='mayatnik-dd-pins'?pinned:key==='mayatnik-dd-fold'?pinned&&grozd.shut?.includes('template'):read('mayatnik-rail-mini',[]).includes('Шаблон');write(key,[...new Set([...list.filter(k=>k!==old),...(list.includes(old)||inherit?[name]:[])])]);}
        if(raw['mayatnik-dd-open']===old||grozd.open==='template'&&!raw['mayatnik-dd-open'])localStorage.setItem('mayatnik-dd-open',name);
        write('mayatnik-dd-up',read('mayatnik-dd-up',[]).filter(id=>id!=='template'));
        localStorage.setItem(mark,'1');
      }
    }catch(_){}
  }
  // v0.124: «Дзен» и «?» — столбиком, одна над другой, у правого края шапки.
  // v0.125: столбик «Дзен» / «?» — в той же верхней полосе меню, последним.
  // v0.165: «шаблоны туда же» — список шаблонов (правая панель «Шаблоны») — выпадающей группой в полоске меню, с закрепом.
  // Кнопки рейки переносятся как есть (их обновление и щелчки остаются), правая панель больше не показывается.
  { const row = ptGroup('Шаблоны'), lib = railRIn.querySelector('.gz-group'); row.parentElement.classList.add('pt-lib'); row.parentElement.style.setProperty('--c', '#d9b9ff');
    if (lib) { row.append(...lib.querySelectorAll('.gz-soty > .gz-hx'), ...lib.querySelectorAll('.gz-wide > *')); lib.remove(); }
    // v0.485: команды выбранного шаблона и библиотека — одна группа; переносим живые узлы с прежними обработчиками.
    const selected = [...tools.querySelectorAll('.pt-g')].find(g => g.querySelector('.pt-l')?.textContent === 'Шаблон');
    if (selected) { row.prepend(...selected.querySelector('.pt-r').children); selected.remove(); }
    row.parentElement.dataset.k = 'Шаблоны';
    mergeTemplateRail(row,railSourceButtons);
    row.prepend(...['bTemplatePick','templatePickMode'].map(id=>railSourceButtons.get(id)).filter(Boolean));
    railR.style.setProperty('display', 'none', 'important'); }
  // v0.485: библиотека сохраняет своё место. Если сохранён только старый «Шаблон», наследуем его раскладку; исходные ключи остаются в резервной копии.
  try {
    const mark = 'mayatnik-template-merge-v485', old = 'Шаблон', name = 'Шаблоны';
    if (!localStorage.getItem(mark)) {
      const keys = ['mayatnik-dd-grid','mayatnik-dd-order','mayatnik-dd-pins','mayatnik-dd-fold','mayatnik-dd-mini','mayatnik-dd-open','mayatnik-bot','mayatnik-botx','mayatnik-control-mini-v464'];
      const saved = Object.fromEntries(keys.map(k => [k, localStorage.getItem(k)])), writes = [];
      const read = (k, fallback) => { try { const value = JSON.parse(saved[k]); return Array.isArray(fallback) ? Array.isArray(value) ? value : fallback : value && typeof value === 'object' && !Array.isArray(value) ? value : fallback; } catch (_) { return fallback; } };
      const grid = read(keys[0], {}), order = read(keys[1], []), bot = read('mayatnik-bot', []), bx = read('mayatnik-botx', {});
      const hasLibraryPlace = Object.hasOwn(grid, name) || order.includes(name) || bot.includes(name) || Object.hasOwn(bx, name);
      const inheritsPin = !read('mayatnik-dd-pins', []).includes(name) && read('mayatnik-dd-pins', []).includes(old);
      for (const k of ['mayatnik-dd-grid','mayatnik-botx']) { const data = read(k, {}); if (!hasLibraryPlace && Object.hasOwn(data, old) && !Object.hasOwn(data, name)) { data[name] = data[old]; writes.push([k, JSON.stringify(data)]); } }
      for (const k of ['mayatnik-dd-order','mayatnik-dd-pins','mayatnik-dd-fold','mayatnik-dd-mini','mayatnik-bot']) {
        const data = read(k, []); if (Array.isArray(data) && data.includes(old) && !data.includes(name) && (k === 'mayatnik-dd-pins' || k === 'mayatnik-dd-fold' && inheritsPin || !hasLibraryPlace)) { data.splice(data.indexOf(old) + 1, 0, name); writes.push([k, JSON.stringify(data)]); }
      }
      if (saved['mayatnik-dd-open'] === old) writes.push(['mayatnik-dd-open', name]);
      const miniKey = 'mayatnik-control-mini-v464', minis = read(miniKey, []);
      if (Array.isArray(minis)) { const merged = [...new Set([...minis, ...minis.filter(k => typeof k === 'string' && k.startsWith('group:' + old + ':')).map(k => 'group:' + name + ':' + k.slice(('group:' + old + ':').length))])]; if (merged.length !== minis.length) writes.push([miniKey, JSON.stringify(merged)]); }
      if (writes.length) { localStorage.setItem(mark + '-before', JSON.stringify(saved)); for (const [k,v] of writes) localStorage.setItem(k,v); }
      localStorage.setItem(mark, '1');
    }
  } catch (_) {}
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
    // v0.417: + и − — отдельные ромбы над Дзеном.
    const zoomIn = mk('mayRhZoomIn', 'zIn', '+'), zoomOut = mk('mayRhZoomOut', 'zOut', '−');
    for (const b of [zoomIn, zoomOut]) b.classList.add('may-rh-zoom');
    const zen = mk('mayRhZen', 'mayZen', '◎\nДзен'), rec = mk('mayRhRec', 'bRec', '⏺\nВидео'), gif = mk('mayRhGif', 'bGif', 'GIF');
    const sync = () => { const z = document.body.classList.contains('may-zen'), t = z ? '◎\nМеню' : '◎\nДзен'; if (zen.textContent !== t) zen.textContent = t;
      zen.title = z ? 'Вернуть меню (Esc, щелчок колёсиком по полю)' : tip($('mayZen')); zen.setAttribute('aria-pressed', String(z));
      for (const [b, id] of [[zoomIn, 'zIn'], [zoomOut, 'zOut']]) { const e = $(id); b.disabled = !e || e.disabled; b.title = e ? tip(e) : ''; b.setAttribute('aria-label', b.title); }
      const r = $('bRec'), on = !!r && r.matches('[aria-pressed="true"],.on'); rec.classList.toggle('on', on); rec.title = r ? tip(r) : '';
      const g = $('bGif'); gif.disabled = !!g?.disabled; gif.classList.toggle('on', g?.getAttribute('aria-pressed') === 'true'); gif.title = g ? tip(g) : ''; };
    const mo = new MutationObserver(sync); mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    for (const id of ['bRec', 'bGif', 'zIn', 'zOut']) if ($(id)) mo.observe($(id), { attributes: true, attributeFilter: ['aria-pressed', 'class', 'disabled', 'title'] });
    sync();
    const vg = [...tools.querySelectorAll('.pt-g')].find(g => g.querySelector('.pt-l')?.firstChild?.textContent.trim() === 'Видео'); if (vg) vg.remove(); }
  // v0.158: «меню в одну полоску, с выпадающими списками для каждой группы» — в шапке видны только названия групп;
  // щелчок по названию раскрывает её кнопки списком под ним (открыт один), щелчок мимо или Esc — закрыть.
  // Пока какой-то список открыт, наведение на соседнее название переключает на него. Точка у названия — в группе что-то включено.
  { tools.classList.add('pt-dd'); let open = null, grid = null; const narrow = matchMedia('(max-width:600px)');   // grid — раскладка по сетке (v0.225)
    // v0.506: both original actions share one split diamond at every viewport width.
    const infoDiamond=document.createElement('div');infoDiamond.id='mayInfoDiamond';infoDiamond.dataset.noMini='';$('mayCorner').append(infoDiamond);
    infoDiamond.append($('mayAbout'),$('mayHelp'));
    for(const [id,label,title,points] of [['mayAbout','i','Что такое маятник','1,1 23,1 23,23'],['mayHelp','?','Подсказки к кнопкам и координаты','1,1 23,1 1,23']]){const b=$(id);b.className='gz-hx';b.title=title;b.setAttribute('aria-label',title);b.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="'+points+'"/></svg><span>'+label+'</span>';}
    narrow.addEventListener('change', () => shut());
    // v0.163: (getClientRects, а не offsetParent: у fixed-списка на телефоне он null) рамка списка — зубцами по бокам (ряд 24 px, как кнопки), высота — целым числом рядов; рисунок — SVG фоном, тот же контур — clip-path
    // v0.447: the scoped SVG adapter draws the silhouette from real control bounds.
    const zig = r => { r.style.height = ''; r.style.clipPath = 'none'; r.style.backgroundImage = 'none'; };
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
      r.style.minWidth = narrow.matches ? '' : (g.querySelector('.pt-l').offsetWidth + 4) + 'px'; requestAnimationFrame(() => zig(r));
      // v0.460: фиксированный мобильный список привязан к своему заголовку, а не к левому краю окна.
      if (narrow.matches || !g.classList.contains('pt-bot')) { const h = g.querySelector('.pt-l').getBoundingClientRect(); r.style.left = Math.max(4, Math.min(h.left, popupRight() - r.offsetWidth - 4)) + 'px'; r.style.top = (h.bottom + 2) + 'px'; return; }
      const b = r.getBoundingClientRect(); if (b.right > popupRight() - 4) r.style.left = Math.min(0, popupRight() - 4 - b.right) + 'px'; };
    // Списки стоят под своей шапкой; соседние раскрытые группы не сдвигают их вбок.
    const alignOpen = () => { for (const g of groupsAll()) if (g.classList.contains('pt-open')) place(g); };
    const setOpen = (g, on) => { g.classList.toggle('pt-open', on); g.classList.toggle('pt-pinned', pinned(g)); ZerkGroupHeader.sync(g.querySelector('.pt-l'),{open:on,pinned:pinned(g)}); if (on) place(g); requestAnimationFrame(() => requestAnimationFrame(alignOpen)); };
    const pinsSync = () => { for (const g of groupsAll()) { const on = stay(g) || g === open; if (g.classList.contains('pt-open') !== on) setOpen(g, on); else {g.classList.toggle('pt-pinned', pinned(g));ZerkGroupHeader.sync(g.querySelector('.pt-l'),{pinned:pinned(g)});} } };
    addEventListener('resize', () => { grid?.relayout(); for (const g of groupsAll()) if (g.classList.contains('pt-open')) { place(g); zig(g.querySelector('.pt-r')); } requestAnimationFrame(alignOpen); });
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
      if(g.classList.contains('pt-lib')&&window.MayatnikTemplatePanel){
        // Keep live commands in the standard movable group; the library has a separate launcher.
        for(const b of row.querySelectorAll('[data-n="bFillUndo"],[data-n="bFillRedo"],[data-may-source="bFillUndo"],[data-may-source="bFillRedo"]'))(b.closest('.gz-pair')||b).remove();
        for(const b of row.querySelectorAll('.gz-pair'))if(/Отм/.test(b.textContent)&&/Повт/.test(b.textContent))b.remove();
        row.querySelector('#templateLibraryChoices')?.closest('.gz-control')?.style.setProperty('display','none','important');
        const launcher=document.createElement('div'), launch=document.createElement('button');
        launcher.id='mayTemplateLauncher';launcher.setAttribute('data-no-mini','');
        launch.type='button';launch.id='bTemplatePanel';launch.setAttribute('aria-controls','mayatnikTemplatePanel');
        launcher.append(launch);document.body.append(launcher);
        launch.className='pt-l';launch.title='Библиотека';launch.setAttribute('aria-label','Библиотека');
        launch.innerHTML='<svg class="may-template-diamond" viewBox="0 0 48 48" aria-hidden="true"><path d="M24 1L47 24 24 47 1 24Z"/></svg><svg class="may-template-puzzle" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h5V4a3 3 0 0 1 6 0v1h5v5h-1a3 3 0 0 0 0 6h1v5h-5v-1a3 3 0 0 0-6 0v1H4v-5H3a3 3 0 0 1 0-6h1Z"/></svg>';

        const sync=()=>{const on=String(window.MayatnikTemplatePanel.isOpen());launch.setAttribute('aria-expanded',on);launch.setAttribute('aria-pressed',on);};
        launch.onclick=()=>{window.MayatnikTemplatePanel.toggle();sync();};
        addEventListener('mayatnik-template-panel-change',sync);sync();
      }
      const pin = ZerkGroupHeader.parts(l).pin;
      pin.addEventListener('click', e => { e.stopPropagation(); const k = keyOf(g); folds.delete(k); if (pins.has(k)) pins.delete(k); else pins.add(k);
        saveDd(); if (!pins.has(k) && open !== g) setOpen(g, false); pinsSync(); });
      l.onclick = () => { if (pinned(g)) { const k = keyOf(g); if (stay(g)) { folds.add(k); if (open === g) open = null; setOpen(g, false); } else { folds.delete(k); setOpen(g, true); } saveDd(); return; }
        if (open === g && Date.now() - (g._hoverAt || 0) < 900) return;   // только что раскрылся наведением — щелчок его не захлопывает
        open === g ? shut() : show(g); };
      // Header and pin keyboard actions are provided by the shared view.
      l.onpointerenter = e => { if (e.pointerType === 'mouse' && !tools.classList.contains('pt-dragging') && open !== g && !g.classList.contains('pt-open')) { g._hoverAt = Date.now(); show(g); } };   // v0.170: «раскрывай сразу при наведении» — мышью без щелчка
      // v0.169: «не скрывается при уходе» — мышь ушла с названия и списка: незакреплённый список закрывается (с запасом 350 мс на переход)
      g._popupLeave = () => { clearTimeout(g._leave);
        g._leave = setTimeout(() => { if (open === g && !stay(g) && !g.matches(':hover') && !popupContains(g)) shut(); }, 350); };
      g.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') g._popupLeave(); });
      g.addEventListener('pointerenter', () => clearTimeout(g._leave));   // v0.159: на касании enter приходит перед щелчком и закрывал список
      toolSync.push(() => g.classList.toggle('pt-has-on', !!row.querySelector('.on'))); }
    udL.onclick = udL.onkeydown = udL.onpointerenter = null; udL.tabIndex = -1; udL.removeAttribute('role'); udL.removeAttribute('aria-haspopup'); udL.removeAttribute('aria-expanded');   // v0.229: списка нет — жмут половинки
    // v0.193: «дай менять местами» — группу полосы тянут за название вбок, она встаёт между соседями; порядок — в памяти браузера (mayatnik-dd-order)
    // v0.225: «дай двигать кнопки маятника вверху в любое место в сетке, но чтоб не перекрывались» — названия групп, ромбы и «?» тянут куда угодно
    // v0.461: единственная полоса приёма под заголовки, шаг вбок t = 12/√3 ≈ 6,93 px. Второго ряда нет.
    // Место занято — ближайшее свободное в том же ряду; продолжение доступно горизонтальной прокруткой.
    // Память — mayatnik-dd-grid { имя: [столбец, 0, очерёдность] }; старые ряды сохраняются отдельно перед уплотнением.
    // не влезло по ширине окна — место считается заново при раскладке (позже поставленное главнее), память при этом не трогается.
    // Двойной щелчок по пустому месту шапки — всё по умолчанию (прежнее — копией в mayatnik-dd-grid_pered_sbrosom), ещё раз — вернуть.
    // На телефоне сетки нет: полоса листается вбок, как была, порядок — по рядам сетки.
    // v0.232: на компьютере полоса всегда по сетке (без своей раскладки — подряд, как текст); «Правка» («↶ Отм. | ↷ Повт.») закреплена по середине
    // шапки, не тянется, остальные её обходят. «это тоже чтобы можно вверх» — группу левой рейки тянут за шапку в шапку страницы: там она
    // в сетке, кнопки — выпадающим списком под шапкой группы (mayatnik-dd-up — их id, место — в mayatnik-dd-grid как «gz:id»); оттуда — ниже шапки —
    // обратно в рейку. На телефоне такие группы — в рейке.
    { const ORDER = 'mayatnik-dd-order', GRID = 'mayatnik-dd-grid', BAK = 'mayatnik-dd-grid_pered_sbrosom', UPK = 'mayatnik-dd-up', head = tools.closest('header');
      const SX = 12 / Math.sqrt(3), SY = 28, GAP = 4, factory = groupsAll().map(keyOf);
      const ups = () => [...tools.querySelectorAll(':scope > .gz-group')], items = () => [...groupsAll(), frameBar, $('mayCorner'), ...ups()].filter(Boolean);
      const idOf = el => el===frameBar?'@frame':el.id === 'mayCorner' ? '?' : el.classList.contains('gz-group') ? 'gz:' + el.dataset.id : keyOf(el);
      const arrange = keys => { const gs = groupsAll(), at = k => { const i = keys.indexOf(keyOf(k)); return i < 0 ? keys.length + gs.indexOf(k) : i; }, end = gs[gs.length - 1].nextSibling;
        for (const g of [...gs].sort((a, b) => at(a) - at(b))) tools.insertBefore(g, end); };
      try { const k = JSON.parse(localStorage.getItem(ORDER) || 'null'); if (Array.isArray(k)) arrange(k); } catch (_) {}
      let gw = null; try { const v = JSON.parse(localStorage.getItem(GRID) || 'null'); if (v && typeof v === 'object' && !Array.isArray(v)) gw = v; } catch (_) {}
      let repairPending = true; try { repairPending = !localStorage.getItem('mayatnik-dd-single-row-v461'); } catch (_) {}
      const saveGrid = () => { if (gw && !Object.keys(gw).length) gw = null; try { if (gw) localStorage.setItem(GRID, JSON.stringify(gw)); else localStorage.removeItem(GRID); } catch (_) {} };
      const ok = p => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]), topT = () => Math.max(0, ...Object.values(gw || {}).map(p => +(p && p[2]) || 0));
      let up = []; try { const a = JSON.parse(localStorage.getItem(UPK) || '[]'); if (Array.isArray(a)) up = a.filter(x => typeof x === 'string'); } catch (_) {}
      const saveUp = () => { try { if (up.length) localStorage.setItem(UPK, JSON.stringify(up)); else localStorage.removeItem(UPK); } catch (_) {} };
      // v0.390: «все группы кнопок перемещать — верх, нижняя полоска и левый бок»: группы «внизу» (bot) — в нижней полосе у левого края, список — вверх.
      // Живут в шапке (её стили), стоят position: fixed над полосой; рейки — ещё и в up. Тянуть — как в шапке; отпустили над полосой — вниз, выше — наверх / в рейку
      let bot = []; try { const a = JSON.parse(localStorage.getItem('mayatnik-bot') || '[]'); if (Array.isArray(a)) bot = a.filter(x => typeof x === 'string'); } catch (_) {}
      const saveBot = () => { try { if (bot.length) localStorage.setItem('mayatnik-bot', JSON.stringify(bot)); else localStorage.removeItem('mayatnik-bot'); } catch (_) {} };
      try{if(!localStorage.getItem('mayatnik-horr-group-v441')){if(!up.includes('horr'))up.push('horr');if(!bot.includes('gz:horr'))bot.push('gz:horr');saveUp();saveBot();localStorage.setItem('mayatnik-horr-group-v441','1');}}catch(_){}
      try { if (!localStorage.getItem('mayatnik-areas-bottom-v427')) { if (!bot.includes('Площади')) bot.push('Площади'); saveBot(); localStorage.setItem('mayatnik-areas-bottom-v427', '1'); } } catch (_) { if (!bot.includes('Площади')) bot.push('Площади'); }
      const isBot = el => el===ud||el!==frameBar&&bot.includes(idOf(el)), barTop = () => footerBar.getBoundingClientRect().top;
      // v0.406: «в любое место нижней полосы группу поставить без наездов»: своё место — botX[id] (x на экране, куда отпустили); по порядку слева направо,
      // не налезая на соседние группы и на связку «×N | ползунок | время | Хорр», в пределах полосы
      let botX = {}; try { const o = JSON.parse(localStorage.getItem('mayatnik-botx') || '{}'); if (o && typeof o === 'object') botX = o; } catch (_) {}
      queueMicrotask(() => { window.mayBotPlace = placeBot; });   // v0.406: зовёт сдвиг связки нижней полосы (playPlace)
      const saveBotX = () => { try { localStorage.setItem('mayatnik-botx', JSON.stringify(botX)); } catch (_) {} };
      const placeBot = () => { const bar = footerBar, R = bar.getClientRects().length ? bar.getBoundingClientRect() : null;udPlace();
        const list = []; for (const el of items()) { if(el===ud||el.classList.contains('may-docked'))continue;if (d?.on && d.el === el) continue; if (!isBot(el) || narrow.matches || !R) { if (el.classList.contains('pt-bot')) { el.classList.remove('pt-bot'); el.style.bottom = ''; } continue; } list.push(el); }
        if (!R || !list.length) return;
        const busyX = [ud.getBoundingClientRect()].filter(r=>r.width).map(r => [r.left - 6, r.right + 6]);
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
      // Ближайшее к c0 свободное место шириной w в единственном ряду, не ближе GAP к занятым.
      const fit = (occ, w, c0, r0, B) => { let best = null, bd = Infinity;
        const end = Math.max(B.W, ...((occ[0] || []).map(p => p[1])), Math.max(0, c0) * SX) + w + GAP;
        for (let c = 0; c <= Math.ceil(end / SX); c++) { if (busy(occ[0], c * SX, w)) continue;
          const dd = Math.abs(c - c0); if (dd < bd) { bd = dd; best = [c, 0]; } }
        return best; };   // v0.461: верх принимает кнопки только в один ряд, продолжение — вправо.
      // подряд, как текст: первое свободное место не раньше курсора (раскладка по умолчанию и кнопки без своего места)
      const seq = (occ, w, B, [c0]) => { for (let c = Math.max(0, c0); ; c++) if (!busy(occ[0], c * SX, w)) return [c, 0]; };
      let shown = new Map(), sig = '', d = null, rd = null, rdown = null, swallow = false;
      const sigOf = () => tools.clientWidth + ':' + items().map(el => el.getClientRects().length ? el.offsetWidth : 0).join(',');
      const snap = () => { gw = {}; let i = 0; for (const [it, [c, r]] of shown) if (it !== ud) gw[idOf(it)] = [c, r, i++]; };   // своей раскладки ещё нет — снять с того, как стоит сейчас
      // v0.389: «по середине на ось, чтоб ромб встал»: центр ромба «Правки» — на оси якоря (window.mayAxisX, экранный x); нет оси — середина плея / шапки.
      // Зовёт и страница (прокрутка, масштаб) — window.mayUdPlace
      const udPlace = () => { if (!ud.getClientRects().length) return;ud.classList.add('pt-bot');const R=footerBar.getBoundingClientRect(),w=ud.offsetWidth,axEl=ud.querySelector('.pt-ud-ax');
        const controlWidth=udL.getBoundingClientRect().width+'px';if(frameBar.style.getPropertyValue('--may-frame-width')!==controlWidth)frameBar.style.setProperty('--may-frame-width',controlWidth);
        const pl = document.querySelector('#mayBottomBar .may-bb-play'), pr = pl && pl.getClientRects().length ? pl.getBoundingClientRect() : null, axX = window.mayAxisX?.();
        const cx = Number.isFinite(axX) ? axX : pr ? pr.left + pr.width / 2 : R.left+R.width/2, U = ud.getBoundingClientRect(), A = axEl?.getBoundingClientRect(), off = A && A.width ? A.left + A.width / 2 - U.left : w / 2;
        const v=Math.round(Math.max(R.left+4,Math.min(R.right-w-4,cx-off)))+'px';if(ud.style.left!==v)ud.style.left=v;ud.style.top='';ud.style.bottom=Math.round(innerHeight-R.bottom+(R.height-ud.offsetHeight)/2)+'px'; };
      window.mayUdPlace = udPlace;
      let framePlaceRaf=0;
      const framePlace=(refresh=true)=>{if(narrow.matches)return;const T=tools.getBoundingClientRect(),w=frameBar.offsetWidth,cx=window.mayAxisX?.(),x=Math.round(tools.scrollLeft+Math.max(0,Math.min(tools.clientWidth-w,(Number.isFinite(cx)?cx:innerWidth/2)-T.left-w/2)))+'px';
        if(frameBar.style.left!==x){frameBar.style.left=x;if(refresh&&!framePlaceRaf)framePlaceRaf=requestAnimationFrame(()=>{framePlaceRaf=0;relayout();});}};
      window.mayFramePlace=framePlace;
      const relayout = (compact = false) => { const all = items();
        if (narrow.matches) { if (tools.classList.contains('pt-grid')) { tools.classList.remove('pt-grid'); head.classList.remove('may-grid'); tools.style.height = ''; for (const el of all) el.style.left = el.style.top = ''; }if(frameBar.parentElement!==head)head.append(frameBar);shown = new Map(); sig = '';placeBot(); alignOpen(); syncRailFlyouts(); window.mayButtonStandardRefresh?.(); return; }
        if(frameBar.parentElement!==tools)tools.append(frameBar);
        tools.classList.add('pt-grid'); head.classList.add('may-grid'); if (!tools.getClientRects().length) return;   // дзен — шапки нет
        const B = room(), occ = [], at = el => gw?.[idOf(el)], held = d?.on && d.el, vis = all.filter(el => el.getClientRects().length && el !== held && !isBot(el) && !el.classList.contains('may-docked'));
        shown = new Map();
        const put = (el, [c], w) => { (occ[0] ||= []).push([c * SX, c * SX + w]); shown.set(el, [c, 0, w]); el.style.left = Math.round(c * SX) + 'px'; el.style.top = '0px'; };
        if(vis.includes(frameBar)){framePlace(false);put(frameBar,[parseFloat(frameBar.style.left)/SX,0],frameBar.offsetWidth);}
        // v0.368: «верхнее меню сделай полосой одной»: все группы — в одну строку, порядок — как стояли (ряд, затем столбец), «Правку» над осью обходят
        const rest = vis.filter(el => el !== ud&&el!==frameBar), key = el => ok(at(el)) ? at(el)[0] + at(el)[1] * 1e-3 : 1e9 + rest.indexOf(el);   // v0.386: в одну строку — порядок по столбцу
        let c1 = 0; for (const el of rest.slice().sort((x, y) => key(x) - key(y))) { const w = el.offsetWidth, pos = !compact && ok(at(el)) ? fit(occ, w, at(el)[0], 0, B) : seq(occ, w, B, [c1]); put(el, pos, w); c1 = pos[0] + Math.ceil((w + GAP) / SX); }
        const T = tools.getBoundingClientRect(); for (const el of ups()) { const s = shown.get(el); if (!s) continue;   // список группы рейки — не за правый край окна
          const over = T.left + s[0] * SX + 244 - (innerWidth - 6); el.style.setProperty('--gdx', over > 0 ? -Math.ceil(over) + 'px' : '0px'); }
        tools.style.height = '42px'; sig = sigOf(); placeBot();
        // v0.462: после сдвига заголовков fixed-списки следуют за ними до следующей отрисовки контура.
        alignOpen(); syncRailFlyouts(); window.mayButtonStandardRefresh?.(); };
      tools.addEventListener('scroll', () => { framePlace(false); if (shown.has(frameBar)) shown.set(frameBar, [parseFloat(frameBar.style.left) / SX, 0, frameBar.offsetWidth]); reopen(); syncRailFlyouts(); window.mayButtonStandardRefresh?.(); }, { passive: true });
      tools.addEventListener('wheel', e => { if (narrow.matches || e.target.closest('.pt-r,.may-rail-list') || tools.scrollWidth <= tools.clientWidth) return; e.preventDefault(); e.stopPropagation(); tools.scrollLeft += Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY; }, { passive: false });
      const reopen = () => { for (const o of groupsAll()) if (o.classList.contains('pt-open')) place(o); requestAnimationFrame(alignOpen); };
      addEventListener('click', e => { if (swallow) { e.stopPropagation(); e.preventDefault(); swallow = false; } }, true);
      const ghost = document.createElement('div'), bg0 = document.createElement('div'), bg1 = document.createElement('div'); ghost.className = 'pt-ghost'; bg0.className = bg1.className = 'pt-gridbg';
      const showGrid = (B, w, c) => { const { W } = B; bg0.style.cssText = `left:0;top:0;width:${W}px;height:24px`;
        bg1.style.cssText = 'left:0;top:0;width:100%;height:100%';
        ghost.style.width = w + 'px'; ghost.style.display = ''; ghost.style.setProperty('--c', c || '#7cbcff'); tools.prepend(bg0); footerBar.prepend(bg1); tools.append(ghost); };
      const hideGrid = () => { ghost.remove(); bg0.remove(); bg1.remove(); $('mayatnikRail').classList.remove('may-drop'); document.body.classList.remove('may-raildrag'); };
      const occOf = skip => { const o = []; for (const [it, [c, r, w]] of shown) if (it !== skip) (o[r] ||= []).push([c * SX, c * SX + w]); return o; };
      const ghostAt = p => { ghost.style.left = Math.round(p[0] * SX) + 'px'; ghost.style.top = p[1] * SY + 'px'; };
      // движение и отпускание слушаются на окне: элемент едет за мышью поверх всего
      addEventListener('pointermove', e => { if (!d || d.dead || e.pointerId !== d.id) return; const el = d.el;
        if (!d.on) { if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < 6) return; shut(); if (!gw) { d.fresh = true; snap(); } const r = el.getBoundingClientRect(); if (el.classList.contains('pt-bot')) { el.classList.remove('pt-bot'); el.style.bottom = ''; }
          Object.assign(d, { on: true, ox: d.x - r.left, oy: d.y - r.top, w: el.offsetWidth, B: room(), occ: occOf(el) });
          tools.classList.add('pt-dragging'); el.classList.add('pt-drag'); showGrid(d.B, d.w, getComputedStyle(el).getPropertyValue('--c').trim()); }
        e.preventDefault(); const T = tools.getBoundingClientRect(), x = e.clientX - d.ox - T.left + tools.scrollLeft, y = e.clientY - d.oy - T.top;
        el.style.left = (e.clientX - d.ox) + 'px'; el.style.top = (e.clientY - d.oy) + 'px';
        d.bot = e.clientY > barTop() - 6;   // v0.390: над нижней полосой — вниз
        d.down = !d.bot && el.classList.contains('gz-group') && e.clientY > head.getBoundingClientRect().bottom + 24;   // группу рейки опустили ниже шапки — обратно в рейку
        $('mayatnikRail').classList.toggle('may-drop', d.down); $('mayFooterBar')?.classList.toggle('may-bbdrop', d.bot); ghost.style.display = d.down || d.bot ? 'none' : '';
        d.acceptTop = e.clientY >= T.top - 6 && e.clientY <= T.top + 30;
        d.at = d.acceptTop ? fit(d.occ, d.w, Math.round(x / SX), 0, d.B) : null;
        ghost.style.display = d.acceptTop && !d.bot ? '' : 'none'; if (d.at) ghostAt(d.at); });
      const end = e => { if (!d || e.pointerId !== d.id) return; const { el, on: moved, at, dead, fresh, down, bot: toBot } = d; $('mayFooterBar')?.classList.remove('may-bbdrop');
        d = e.type === 'esc' ? { id: d.id, dead: true } : null;   // Esc — отмена; щелчок от отпускания потом проглотить
        if (dead) { swallow = e.type === 'pointerup'; setTimeout(() => { swallow = false; }, 0); return; }
        if (!moved) return; const dropLeft = el.getBoundingClientRect().left; if (e.type === 'pointerup') { swallow = true; setTimeout(() => { swallow = false; }, 0); }
        tools.classList.remove('pt-dragging'); el.classList.remove('pt-drag'); hideGrid();
        if (e.type === 'pointerup' && (toBot || down || at)) { const id = idOf(el); bot = bot.filter(x => x !== id); if (toBot) { bot.push(id); botX[id] = Math.round(dropLeft); saveBotX(); if (el.classList.contains('gz-group') && !up.includes(el.dataset.id)) { up.push(el.dataset.id); saveUp(); } } saveBot(); }   // v0.390
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
        const T = tools.getBoundingClientRect(), over = e.clientY >= T.top - 6 && e.clientY <= T.top + 30;
        rd.at = over ? fit(rd.occ, rd.w, Math.round((e.clientX - rdown.ox - T.left + tools.scrollLeft) / SX), 0, rd.B) : null;
        rd.bot = e.clientY > barTop() - 6; $('mayFooterBar')?.classList.toggle('may-bbdrop', rd.bot); if (rd.bot) rd.at = null;   // v0.390: группу рейки — вниз
        ghost.style.display = over && !rd.bot ? '' : 'none'; if (over && !rd.bot) ghostAt(rd.at); }, true);
      addEventListener('pointerup', ev => { const rox = rdown?.ox || 0; rdown = null; if (!rd) return; const { box, at, bot: toBot } = rd; rd = null; hideGrid(); $('mayFooterBar')?.classList.remove('may-bbdrop');
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
      const repairSavedRows = () => {
        if (!repairPending || narrow.matches || !tools.querySelector('.may-standard')) return;
        repairPending = false;
        try {
          if (gw) localStorage.setItem('mayatnik-dd-grid-before-v461', JSON.stringify(gw));
          relayout(true);
          if (gw) { for (const [el, [c]] of shown) if (el !== frameBar && el !== ud) gw[idOf(el)] = [c, 0, gw[idOf(el)]?.[2] || 0]; saveGrid(); }
          localStorage.setItem('mayatnik-dd-single-row-v461', '1');
        } catch (_) {}
      };
      let dock=null;
      grid = { relayout, tick: () => { dock?.refresh(); if (!narrow.matches && !d?.on && !rd) { repairSavedRows(); if (sigOf() !== sig) relayout(); } },
        touch: k => { if (gw && ok(gw[k])) { gw[k][2] = topT() + 1; saveGrid(); } relayout(); } };   // правый щелчок (ромб ↔ название): тот, кого меняли, остаётся на месте, соседи уступают
      narrow.addEventListener('change', () => { placeUps(); relayout(); }); placeUps(); domSort(); relayout(); toolSync.push(grid.tick);
      // v0.509: capture group dragging before the legacy rail/free-bottom handlers.
      dock=window.MayatnikMenuDock?.mount({groups:()=>[...items().filter(g=>g!==ud&&g!==frameBar),...rail.el.querySelectorAll(':scope > .gz-group')],idOf,header:head,tools,footer:footerBar,rail:rail.el,rightEdge:popupRight,
        excluded:[ud,frameBar,$('mayTemplateLauncher')],moveToTools:g=>{if(g.classList.contains('gz-group')&&!up.includes(g.dataset.id)){up.push(g.dataset.id);saveUp();}if(g.parentElement!==tools)tools.append(g);g.style.removeProperty('--gdx');},onLayout:()=>{relayout();reopen();}}); }
    // v0.209: «правой кнопкой по кнопке — свернуть кнопку в ромб со значком и сдвинуть все остальные на освободившееся место»:
    // правый щелчок по названию группы полосы — оно сворачивается в ромб со значком (соседи встают вплотную), ещё раз — разворачивается.
    // Список при этом открывается как прежде; свёрнутые — в памяти браузера (mayatnik-dd-mini).
    { const MINI = 'mayatnik-dd-mini', ICO = { 'Точка Ось': '⊹', 'Очистка': '⌫', 'Оси': '✛', 'Правка': '↶', 'Вид': '◉', 'Зеркала': '⋈', 'Шаблон': '▣', 'Шаблоны': '▤', 'Видео': '⏺' };
      let minis = new Set(); try { minis = new Set(JSON.parse(localStorage.getItem(MINI) || '[]')); } catch (_) {}
      const glyph = k => ICO[k] || ([...k][0] && /[^\p{L}\p{N}]/u.test([...k][0]) ? [...k][0] : k.slice(0, 1));
      for (const g of groupsAll()) { const l = g.querySelector('.pt-l'), k = keyOf(g), ic = ZerkGroupHeader.parts(l).icon;ic.textContent = glyph(k);if(!ic.parentNode)l.append(ic);
        const sync = () => { const on = minis.has(k); g.classList.toggle('pt-mini', on);ZerkGroupHeader.sync(l,{mini:on}); l.title = g.classList.contains('pt-btn') ? 'Правка: ↶ отмена · ↷ повтор · стоит по середине шапки · правый щелчок — ' + (on ? 'развернуть' : 'свернуть в ромб') : on ?k + ' · правый щелчок — развернуть · тянуть — переставить' : 'Щелчок — открыть · тянуть — поставить в любое место шапки (по сетке) · правый щелчок — свернуть в ромб · двойной щелчок по пустому месту шапки — раскладка по умолчанию'; };
        sync(); l.addEventListener('contextmenu', e => { e.preventDefault(); e.stopPropagation(); if (minis.has(k)) minis.delete(k); else minis.add(k);
          try { localStorage.setItem(MINI, JSON.stringify([...minis])); } catch (_) {} sync(); grid?.touch(k); for (const o of groupsAll()) if (o.classList.contains('pt-open')) place(o); requestAnimationFrame(alignOpen); }); }
    }
    grid.relayout();   // v0.225: ромбы v0.209 уже свёрнуты — ширины верные
    narrow.addEventListener('change', pinsSync); requestAnimationFrame(() => {
      pinsSync();
      try { const key = localStorage.getItem('mayatnik-dd-open'); const g = groupsAll().find(g => keyOf(g) === key && !g.classList.contains('pt-btn')); if (g && !stay(g)) show(g); } catch (_) {}
    });
    addEventListener('pagehide', () => { try { localStorage.setItem('mayatnik-dd-open', open ? keyOf(open) : ''); } catch (_) {} });
    addEventListener('pointerdown', e => { if (open && !open.contains(e.target) && !popupContains(open, e.target)) shut(); }, true);
    addEventListener('keydown', e => { if (e.key === 'Escape') shut(); });
    tools.addEventListener('scroll', shut, { passive: true }); }
  // v0.190: «те кнопки, в которых список, — покажи выводом всех в соседний столбец при наведении, и у таких кнопок стрелки обводкой справа».
  // Наведение на кнопку-список — столбец всех вариантов справа от столбца, где она (список группы полосы или рейка); нынешний — обводкой,
  // щелчок — выбрать. Щелчок, правый и колесо по самой кнопке — как прежде. В полосе столбец лежит в группе: пока мышь на нём, список не закрывается.
  // v0.191: столбец — общий из grozd (ZerkGrozd.listHover; им же — списки рейки «Ход», «Поле», «Поиск», «Серии», «Область» и хаба);
  // здесь — кнопки полосы и кнопки рейки «по кругу» (Зеркало, Аниматрица).
  { const after = () => { rail.refresh(); placeTools(); };
    const mountSegments=(b,options)=>{b.classList.add('may-segments','gz-pair');if(b.dataset.n==='fixLow')b.classList.add('may-independent-selector');b.replaceChildren();const nodes=options().map((o,i)=>{const part=document.createElement('span');part.className='gz-half';part.textContent=b.dataset.n==='mirOp'?['Zrk','Xr','And'][i]:({Левая:'Лев',Правая:'Прав',копия:'Коп.'})[o.name]||o.name;part.title=b.dataset.n==='fixLow'?'Зеркало ↓ — '+o.name+'. Включить или выключить эту сторону независимо от другой; две включённые части — обе стороны.':b.title+' — '+o.name;b.append(part);return part;});
      b.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();const i=nodes.indexOf(e.target.closest('.gz-half'));if(i>=0)options()[i].pick();after();},true);
      toolSync.push(()=>options().forEach((o,i)=>{nodes[i].classList.toggle('gz-on',!!o.on);nodes[i].setAttribute('aria-pressed',String(!!o.on));}));};
    const reg = (b, options) => { if(b&&['fixLow','mirOp'].includes(b.dataset.n)){mountSegments(b,options);return;} if (b) ZerkGrozd.listHover(b, { options, after, color: () => getComputedStyle(b).getPropertyValue('--c').trim() || '#7cbcff',
      host: () => b.closest('.pt-g') || document.body, col: () => b.closest('.pt-col, .pt-r, .gz-rail, .gz-soty, .gz-wide') }); };   // v0.226: в «Виде» — правее своего столбца; v0.232: в группе рейки, поднятой в шапку, — правее её списка
    const fromSelect = (sel, nameOf = o => o.textContent, iconOf = null) => () => [...sel.options].map(o => ({ name: nameOf(o), icon: iconOf?.(o), on: o.value === sel.value,
      pick: () => { if (sel.value === o.value) return; sel.value = o.value; sel.dispatchEvent(new Event('change', { bubbles: true })); } }));
    const viewIcon = new Map(Object.entries(viewIcons).map(([v, [kind, t]]) => { const p = document.createElement('button'); p.title = t; return [v, icon(p, kind)]; }));
    reg(tools.querySelector('[data-n="viewCycle"]'), fromSelect($('view'), o => (viewIcons[o.value] || [, o.textContent])[1], o => viewIcon.get(o.value)));
    reg(tools.querySelector('[data-n="fontCycle"]'), fromSelect($('digitFont')));
    reg(tools.querySelector('[data-n="fixLow"]'), () => [1,2].map(i => ({ name:window.mayFixLowNames[i], on: !!((window.mayFixLow?.get() || 0) & i), pick: () => window.mayFixLow?.set((window.mayFixLow.get() || 0) ^ i) })));   // v0.222
    reg(tools.querySelector('[data-n="fixAxis"]'), () => window.mayFixAxisNames.map((name, i) => ({ name: name.slice(5), on: (window.mayFixAxis?.get() || 0) === i, pick: () => window.mayFixAxis?.set(i) })));   // v0.216
    { const M = () => window.mayMir, L = () => window.mayMirLists;   // v0.210
      reg(tools.querySelector('[data-n="mirCol"]'), () => L().col.map(([v, name]) => ({ name, on: M()?.col() === v, pick: () => M()?.set('col', v) })));
      reg(tools.querySelector('[data-n="mirOp"]'), () => L().op.map(([v, name]) => ({ name, on: M()?.op() === v, pick: () => M()?.set('op', v) }))); }
    { const Z = () => window.mayFixMirror; reg(tools.querySelector('[data-n="fixMirror"]'), () => ['Выкл', 'Все биты', 'Шахматка 1', 'Шахматка 2', 'XOR', 'AND', 'Шахм. ход', 'Шахм. антиход', 'Ход | антиход', 'Антиход | ход'].map((name, i) => ({ name, on: (Z()?.get() || 0) === i, pick: () => Z()?.set(i) }))); }
    { const e = $('noband'), mode = () => +e.dataset.mode || 0;   // три положения по кругу: каждое change — следующее
      reg(tools.querySelector('[data-n="noband"]'), () => ['Полосы', 'Без полос', 'До треуг.'].map((name, i) => ({ name, on: mode() === i,
        pick: () => { for (let n = 0; n < 3 && mode() !== i; n++) e.dispatchEvent(new Event('change')); } }))); }
    // рейка: кнопки «по кругу» — кнопка находится по месту пункта в группе, как подсказки выше
    const ring = {}; // These modes are now segmented controls, without hover lists.
    for (const g of groups) { const box = rail.el.querySelector('.gz-group[data-id="' + g.id + '"]'); if (!box) continue;
      const wide = t => ['value', 'list', 'control', 'vpair'].includes(t), a = g.items.filter(i => !wide(i.type)), ca = box.querySelectorAll('.gz-soty > .gz-hx');
      a.forEach((it, i) => { const cell=railSourceButtons.get(it.src)||ca[i];if (it.src === 'zSnap' && cell && window.mayZSnap) {
          const Z=window.mayZSnap,current=()=>Z.on()?Z.base():1;
          cell.classList.add('may-snap-control');cell.replaceChildren();
          const label=document.createElement('span');label.className='gz-nm';label.textContent='Кратность';cell.append(label);
          const parts=[['1','Плавный масштаб',()=>Z.set(0)],['◀','Уменьшить кратность на 1',()=>Z.set(Math.max(1,current()-1))],['','Текущая кратность',null],['▶','Увеличить кратность на 1',()=>Z.set(Math.min(10,current()+1))]];
          const nodes=parts.map(([text,title,act])=>{const p=document.createElement('span');p.className='may-snap-part';p.textContent=text;p.title=title;if(act){p.tabIndex=0;p.setAttribute('role','button');p.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();act();rail.refresh();placeTools();}});}cell.append(p);return p;});
          cell.prepend(nodes[1]);
          // Stop the old whole-button toggle; the live source is retained for state and pins.
          cell.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();const i=nodes.indexOf(e.target.closest('.may-snap-part'));parts[i]?.[2]?.();rail.refresh();placeTools();},true);
          toolSync.push(()=>{const value=String(current());if(nodes[2].textContent!==value)nodes[2].textContent=value;nodes[0].classList.toggle('gz-on',current()===1);nodes[2].classList.toggle('gz-on',current()>1);cell.title='Кратность масштаба: '+value+' · 1 — плавно; 2–10 — степени основания · стрелки меняют на 1';});
        } });
      a.forEach((it, i) => { const cell=railSourceButtons.get(it.src)||ca[i],names = ring[it.src], e = $(it.src); if (!names || !cell || !e) return; const now = () => e.textContent.split(': ')[1];
        reg(cell, () => names.map(name => ({ name, on: now() === name, pick: () => { for (let n = 0; n < names.length && now() !== name; n++) e.click(); } }))); }); } }
  // One centre control; keep the retained source inputs and their handlers.
  { const one=railSourceButtons.get('midOneOn'),zero=railSourceButtons.get('midZeroOn');if(one&&zero){
    zero.classList.add('may-merged-source');zero.style.setProperty('display','none','important');one.classList.remove('gz-pair','gz-split','gz-bs','gz-wl');one.classList.add('may-center-control');one.replaceChildren();one.title='Центр: 0 и 1 включаются независимо; цветные круги меняют их цвета; Центр включает или выключает оба';
    const part=(cls,text,title,run)=>{const n=document.createElement('span');n.className=cls;n.dataset.noMini='';n.textContent=text;n.title=title;n.tabIndex=0;n.setAttribute('role','button');n.setAttribute('aria-label',title);n.addEventListener('click',e=>{e.stopPropagation();run(n);rail.refresh();placeTools();});n.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();n.click();}});one.append(n);return n;};
    const c0=picker($('midZeroColour')),c1=picker($('midOneColour'));
    const sw0=part('may-center-swatch','','Цвет центра 0',c0),bit0=part('may-center-bit','0','Включить или выключить центр 0',()=>$('midZeroOn').click());
    const label=part('may-center-label','Центр','Включить или выключить оба бита центра',()=>{const on=!($('midZeroOn').checked&&$('midOneOn').checked);for(const id of ['midZeroOn','midOneOn'])if($(id).checked!==on)$(id).click();});
    const bit1=part('may-center-bit','1','Включить или выключить центр 1',()=>$('midOneOn').click()),sw1=part('may-center-swatch','','Цвет центра 1',c1);
    for(const [dot,id]of [[sw0,'midZeroColour'],[sw1,'midOneColour']])window.MayatnikColourAuto?.adaptPalette(dot,id,()=>$(id).value);
    one.addEventListener('click',e=>{if(e.target===one)label.click();});
    toolSync.push(()=>{for(const [n,id]of [[bit0,'midZeroOn'],[bit1,'midOneOn']]){n.classList.toggle('gz-on',$(id).checked);n.setAttribute('aria-pressed',String($(id).checked));}for(const [n,id]of [[sw0,'midZeroColour'],[sw1,'midOneColour']])if(n.dataset.colour!==$(id).value){n.dataset.colour=$(id).value;n.style.backgroundColor=$(id).value;}one.classList.toggle('gz-on',$('midZeroOn').checked||$('midOneOn').checked);});
  }}
  // v0.441: варианты сбоку от столбца; перекрытые элементы чужой группы скрываются по одному (v0.452).
  const viewPaletteSources={col:['lgOverOne','lgOverZero'],bits:['lgBitZero','lgBitOne'],digits:['digitZeroColour','digitOneColour'],digitsOnly:['digitZeroColour','digitOneColour']},viewPalettePickers=new Map();
  $('lg').style.setProperty('display','none','important');
  tools.querySelector('[data-n="c2_digitOneColour"]')?.style.setProperty('display','none','important');
  function decorateViewPalette(list,owner){
    if(owner.dataset.n!=='viewCycle')return;
    const options=[...$('view').options];
    list.querySelectorAll(':scope > .gz-hx').forEach((row,i)=>{
      const mode=options[i]?.value,ids=viewPaletteSources[mode];if(!ids)return;
      if(!row.classList.contains('may-view-palette')){
        row.classList.add('may-view-palette');row.querySelector('.gz-ic')?.style.setProperty('display','none','important');
        ids.forEach((id,j)=>{const src=$(id),dot=document.createElement('button');dot.type='button';dot.className='may-view-swatch';dot.dataset.noMini='';dot.dataset.source=id;dot.title=src.title||src.getAttribute('aria-label');dot.setAttribute('aria-label',dot.title);
          if(!viewPalettePickers.has(id))viewPalettePickers.set(id,picker(src));
          dot.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')e.stopPropagation();});
          dot.addEventListener('click',e=>{e.stopPropagation();if($('view').value!==mode){$('view').value=mode;$('view').dispatchEvent(new Event('change',{bubbles:true}));rail.refresh();placeTools();return;}viewPalettePickers.get(id)(dot);});
          if(j)row.append(dot);else row.prepend(dot);
        });
      }
      for(const dot of row.querySelectorAll('.may-view-swatch')){const colour=$(dot.dataset.source).value;if(dot.dataset.colour!==colour){dot.dataset.colour=colour;dot.style.backgroundColor=colour;}}
    });
  }
  function nameListButton(b){
    const names={viewCycle:'Вид',fontCycle:'Шрифт',fixMirror:'Зеркало ↑',fixAxis:'Ось',mirCol:'Цвет зеркал',noband:'Полосы',layerSelect:'Слои'};
    const title=b.dataset.listTitle||names[b.dataset.n]||b.querySelector('.gz-nm')?.textContent.trim()||b.title||'Варианты';b.dataset.listTitle=title;b.classList.add('may-named-list');b.setAttribute('aria-label',title);
    let label=b.querySelector(':scope > .may-list-label');if(!label){label=document.createElement('span');label.className='may-list-label';label.textContent=title;b.append(label);}return title;
  }
  function decorateListHeading(list,owner){
    const title=owner.dataset.listTitle||nameListButton(owner);let heading=list.querySelector(':scope > .may-list-heading');
    if(!heading){heading=document.createElement('div');heading.className='may-list-heading';heading.setAttribute('role','heading');heading.setAttribute('aria-level','3');list.append(heading);}
    if(heading.textContent!==title)heading.textContent=title;list.classList.add('may-titled-list');list.setAttribute('aria-label',title);
  }
  function listLayout(owner,count){
    const column=owner.closest('.pt-r, .may-rail-list')||owner.closest('.gz-soty, .gz-wide')||owner;
    const r=owner.getBoundingClientRect(),c=column.getBoundingClientRect();
    return window.MayatnikMenuOptions.layout(count??owner.gzList.options().length,r,c.width?c:r,popupRight(),innerHeight);
  }
  function setListSide(owner,side){if(owner.dataset.listSide!==side){owner.dataset.listSide=side;owner.classList.toggle('may-list-left',side==='left');}}
  function syncListButton(owner){
    if(!window.MayatnikMenuOptions)return;
    window.MayatnikMenuOptions.syncOwner(owner);
    if(owner.getClientRects().length)setListSide(owner,listLayout(owner).side);
  }
  let activeList=null;
  // v0.497: only the popup escapes group stacking contexts; its owner stays in place.
  function popupContains(group, target) {
    if(window.MayatnikColourAuto?.contains(group,target))return true;
    const list=activeList?.group===group && activeList.list;
    return !!(list?.isConnected && (target ? list.contains(target) : list.matches(':hover')));
  }
  const clearListUnder = () => {window.MayatnikMenuOptions?.restore(activeList?.owner);const group=activeList?.group;activeList=null;group?._popupLeave?.();document.querySelectorAll('.may-list-hidden, .may-list-dim').forEach(el => el.classList.remove('may-list-hidden', 'may-list-dim'));scheduleGroups();};
  // v0.482: «дрожание всех списков»: grozd пристраивает открытый список каждые 400 мс и зовёт эту функцию; прежде она снимала затемнение со всех,
  // мерила колонку (браузер успевал применить снятие) и ставила заново — переход opacity .12s заставлял кнопки под списком вспыхивать на каждом такте.
  // Теперь затемнение меняется только у тех, кому его надо снять или добавить.
  const hideListUnder = (list, owner) => {
    decorateViewPalette(list,owner);decorateListHeading(list,owner);window.MayatnikMenuOptions?.decorate(list,owner);
    const group = owner.closest('.pt-g, .gz-group, .may-hp-pop');
    if(list.parentNode!==document.body){
      // Shared grozd has already copied owner font/variables and installed option handlers.
      document.body.append(list);
    }
    if(!list.classList.contains('may-popup-portal')){
      list.classList.add('may-popup-portal');
      list.addEventListener('pointerleave',()=>group?._popupLeave?.());
    }
    const column=owner.closest('.pt-r, .may-rail-list')||owner.closest('.gz-soty, .gz-wide')||owner;
    const bounds=column.getBoundingClientRect(),c=bounds.width?bounds:owner.getBoundingClientRect();
    if(window.MayatnikMenuOptions){
      const g=listLayout(owner,list.querySelectorAll(':scope > .gz-hx').length);setListSide(owner,g.side);
      Object.assign(list.style,{width:g.width+'px',gridTemplateRows:`repeat(${g.rows},48px)`,gridAutoColumns:'48px',top:g.top+'px',left:g.left+'px',maxHeight:g.maxHeight+'px',maxWidth:Math.max(48,Math.min(g.width,popupRight()-g.left-4))+'px'});
      list.style.setProperty('width',g.width+'px','important');list.style.setProperty('max-width',Math.max(48,Math.min(g.width,popupRight()-g.left-4))+'px','important');
      list.style.setProperty('overflow-y',g.scroll?'auto':'visible','important');list.style.setProperty('overflow-x',g.scroll?'hidden':'visible','important');
    }else{
    // v0.481: окончательная геометрия списка задаётся здесь; адаптер контура её больше не сдвигает своим таймером.
    const count=list.querySelectorAll(':scope > .gz-hx').length,maxRows=Math.max(1,Math.floor((innerHeight-54)/26)),space=Math.max(innerWidth-c.right-6,c.left-6),maxCols=Math.max(1,Math.floor((space+6)/126)),cols=Math.min(maxCols,Math.ceil(count/Math.min(7,maxRows))),rows=Math.ceil(count/cols),width=cols*126-6;
    Object.assign(list.style,{width:width+'px',gridTemplateRows:`repeat(${rows},24px)`,gridAutoColumns:'120px',top:Math.max(14,Math.min(owner.getBoundingClientRect().top,innerHeight-Math.min(rows,maxRows)*26-38))+'px',maxHeight:(maxRows*26+24)+'px'});
    list.style.setProperty('overflow-y',rows>maxRows?'auto':'visible','important');
    list.style.setProperty('overflow-x',rows>maxRows?'hidden':'visible','important');
    const right=c.right+6,left=c.left-width-6;
    const x=right+width<=innerWidth-4?right:left>=4?left:Math.max(4,Math.min(right,innerWidth-width-4));
    list.style.left=x+'px';list.style.maxWidth=Math.min(width,Math.max(24,innerWidth-x-4))+'px';
    }
    activeList={list,group,owner};scheduleGroups();
  };
  for (const b of document.querySelectorAll('.gz-lst')) if (b.gzList) {
    nameListButton(b);syncListButton(b);
    b.addEventListener('pointerenter',()=>syncListButton(b),true);
    if(b.dataset.n==='layerSelect'){const closed=b.gzList.closed;b.gzList.closed=(...args)=>{closed?.(...args);clearListUnder();};}
    else Object.assign(b.gzList, {placement:'right', placed:hideListUnder, closed:clearListUnder});
    // v0.446: an inset, shorter chevron complements the existing right edge.
    if(!b.querySelector(':scope > .may-list-inner-arrow')){
      const arrow=document.createElementNS('http://www.w3.org/2000/svg','svg');arrow.classList.add('may-list-inner-arrow');
      arrow.setAttribute('viewBox','0 0 8 16');arrow.setAttribute('aria-hidden','true');arrow.setAttribute('focusable','false');
      const line=document.createElementNS(arrow.namespaceURI,'path');line.setAttribute('d','M1 1L7 8L1 15');arrow.append(line);b.append(arrow);
    }
  }
  const syncLists=()=>{for(const b of document.querySelectorAll('.gz-lst'))if(b.gzList)syncListButton(b);};
  toolSync.push(syncLists);addEventListener('resize',syncLists);
  // Сведения и действия выбранной фигуры — сворачиваемая панель справа внизу.
  const infoPanel=document.createElement('details');infoPanel.id='mayatnikInfoPanel';infoPanel.open=true;
  const infoTitle=document.createElement('summary');infoTitle.textContent='Сведения';
  // v0.091: скрытые исходные «Сохранить»/«Цвет» с полем цвета — в группу «Шаблон» шапки, чтобы окно цвета открывалось там.
  tools.querySelector('[data-n="bTemplateColour"]')?.parentElement.parentElement.append($('templateActions'));
  infoPanel.append(infoTitle,status);infoRow.append(infoPanel);
  try { infoPanel.open=localStorage.getItem('mayatnik-info-closed')!=='1'; } catch (_) {}   // v0.437: помнить свёрнутые «Сведения».
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
    // v0.451 (ПЛ01/ПЛ02/ПЛ04): дорожка, ромб-бегунок, число между половинами; у кадра — число под бегунком
    const track = document.createElement('span'); track.className = 'may-track';
    const dia = document.createElement('i'); dia.className = 'may-dia'; const tv = document.createElement('b'); tv.className = 'may-tv'; dia.append(tv);
    const val = out || Object.assign(document.createElement('span'), { className: 'may-slide-v' });
    if (id === 'frame') val.classList.add('may-frame-v');
    el.before(track); track.append(dia, val, el);
    let last = '';
    const sync = () => { const lo = +el.min || 0, hi = +el.max || 1, w = track.clientWidth, k = el.value + '|' + w + '|' + hi; if (k === last) return; last = k;
      const x = w * (+el.value - lo) / ((hi - lo) || 1); dia.style.left = x + 'px'; track.style.setProperty('--tx', x + 'px'); label.style.setProperty('--tx', x + 'px');
      tv.textContent = el.value; if (!out) val.textContent = el.value; };
    el.addEventListener('input', sync); el.addEventListener('change', sync); setInterval(sync, 120);
    if (window.ResizeObserver) new ResizeObserver(sync).observe(track); sync();
  }
  // v0.451 (КНП-016): раскрытый бегунок (±4 px) ловит нажатие раньше шеврона и скрытого ползунка — тянется от места захвата, без прыжка
  document.addEventListener('pointerdown', e => {
    if (e.button !== 0) return; const sl = e.target.closest?.('label.may-slide'); if (!sl) return;
    const d = sl.querySelector('.may-dia'), input = sl.querySelector('input[type=range]'); if (!d || !input) return;
    const r = d.getBoundingClientRect(); if (e.clientX < r.left - 4 || e.clientX > r.right + 4 || e.clientY < r.top || e.clientY > r.bottom) return;
    e.preventDefault(); e.stopPropagation();
    const track = input.parentElement, lo = +input.min || 0, hi = +input.max || 1, x0 = e.clientX, v0 = +input.value, px = track.clientWidth / ((hi - lo) || 1);
    const move = ev => { const v = Math.max(lo, Math.min(hi, Math.round(v0 + (ev.clientX - x0) / px))); if (v !== +input.value) { input.value = String(v); input.dispatchEvent(new Event('input', { bubbles: true })); } };
    const up = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up); input.dispatchEvent(new Event('change', { bubbles: true })); };
    addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', up); input.focus({ preventScroll: true });
  }, true);
  // v0.451: тающий контур шеврона наружу при нажатии
  document.addEventListener('pointerdown', e => { const b = e.target.closest?.('label.may-slide > .may-chev'); if (!b) return; b.classList.remove('echo'); void b.offsetWidth; b.classList.add('echo'); });
  document.addEventListener('animationend', e => { if (e.animationName === 'mayStepEcho') e.target.classList.remove('echo'); });
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
  // v0.454 (Р02): слева заголовки остаются на месте, кнопки группы — одним столбцом вниз под шапкой, остальное сдвигается.
  function syncRailFlyouts() {
    for (const box of document.querySelectorAll('#mayatnikRail .gz-group, #paintTools > .gz-group')) {
      const left = !!box.closest('#mayatnikRail'); let list = box.querySelector(':scope > .may-rail-list');
      if (!list) { list = document.createElement('div'); list.className = 'may-rail-list';
        list.append(...box.querySelectorAll(':scope > .gz-soty, :scope > .gz-wide')); box.append(list); }
      if (!list) continue;
      if (!left) {
        list.removeAttribute('style');
        if (box.classList.contains('gz-open')) {
          const h = box.querySelector(':scope > .gz-head').getBoundingClientRect(), up = box.classList.contains('pt-bot');
          const max = Math.max(24, up ? h.top - 14 : innerHeight - h.bottom - 16);
          if (!up) Object.assign(list.style, { left: Math.max(4, Math.min(h.left, innerWidth - 124)) + 'px', top: (h.bottom + 2) + 'px' });
          list.style.maxHeight = max + 'px';
          // v0.464: внешняя скобка не обрезается overflow:auto у короткого списка;
          // у длинного списка для неё есть место внутри прокручиваемого содержимого.
          const scroll = list.scrollHeight > max + 1;
          list.style.overflowY = scroll ? 'auto' : 'visible';
          list.style.overflowX = scroll ? 'hidden' : 'visible';
          if (scroll) list.style.setProperty(up ? 'padding-top' : 'padding-bottom', '14px', 'important');
        }
        continue;
      }
      const head = box.querySelector(':scope > .gz-head'); head.setAttribute('aria-expanded', String(box.classList.contains('gz-open')));
      if (!box.classList.contains('gz-open')) continue;
      // v0.454 (Р02): список — столбец в потоке под шапкой, вбок не раскрывается; сдвиг остального даёт сама рейка, высоту ограничивает прокрутка рейки
      for (const key of ['left', 'top', 'width', 'maxWidth', 'gridTemplateRows', 'gridAutoColumns']) if (list.style[key]) list.style[key] = '';
    }
    pushStrip();
  }
  // v0.454 (Р02): в верхней полосе раскрытая группа раскрывается вниз и отодвигает вниз группы, стоящие под ней в той же полосе; при закрытии они возвращаются
  function pushStrip() {
    const tools = $('paintTools'); if (!tools) return;
    const els = [...tools.querySelectorAll(':scope > .gz-group, :scope > .pt-g')].filter(g => !g.classList.contains('pt-bot') && !g.classList.contains('pt-btn') && !g.classList.contains('pt-drag'));
    const want = new Map(els.map(g => [g, 0])), cur = g => parseFloat(g.dataset.pushY) || 0;
    // v0.458: в верхней полосе группы под раскрытой не сдвигаем — уезжали вниз за список («слетело»); список ложится поверх (Р06)
    if (false && innerWidth > 600) for (const o of els) {
      if (!o.matches('.pt-open, .gz-open')) continue;
      const head = o.querySelector(':scope > .pt-l, :scope > .gz-head'), parts = [...o.querySelectorAll(':scope > .pt-r, :scope > .may-rail-list, :scope > .gz-soty, :scope > .gz-wide')].map(e => e.getBoundingClientRect()).filter(r => r.width && r.height);
      if (!head || !parts.length) continue;
      const hr = head.getBoundingClientRect(), L = Math.min(...parts.map(r => r.left)) - 4, R = Math.max(...parts.map(r => r.right)) + 4, H = Math.round(Math.max(...parts.map(r => r.bottom)) - hr.bottom + 4), nat = hr.bottom - cur(o);
      for (const g of els) { if (g === o) continue; const r = g.getBoundingClientRect(), top = r.top - cur(g);
        if (top >= nat - 1 && r.left < R && r.right > L) want.set(g, Math.max(want.get(g), H)); }
    }
    for (const [g, dy] of want) if (cur(g) !== dy) { g.dataset.pushY = dy; g.style.translate = dy ? '0 ' + dy + 'px' : ''; }
  }
  // v0.437: цельная зубчатая подложка включает и нижние ползунки; скрытие не меняет раскладку и закрепы.
  const groupSelector = '#paintTools > .pt-g, #paintTools > .gz-group, #mayatnikRail .gz-group';
  const groupRanks = new WeakMap(), groupOpen = new WeakMap(); let groupRank = 0, groupFrame = 0;
  const overlaps = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
  function groupBackdrop(group, open) {
    const host = group.closest('#mayatnikRail') ? group.querySelector(':scope > .may-rail-list') : group;
    if (!host) return;
    let svg = host.querySelector(':scope > .may-group-backdrop');
    if (!open) { svg?.remove(); return; }
    const cells = [...host.querySelectorAll('.gz-hx')].filter(el => el.getClientRects().length && !el.parentElement.closest('.gz-hx'));
    const base = host.getBoundingClientRect(), columns = new Map();
    for (const cell of cells) {
      const r = cell.getBoundingClientRect(), x = Math.round(r.left - base.left + host.scrollLeft);
      if (!columns.has(x)) columns.set(x, []);
      columns.get(x).push({x, y:r.top - base.top + host.scrollTop, w:r.width, h:r.height, n:parseFloat(getComputedStyle(cell).getPropertyValue('--gz-n')) || 9});
    }
    const polygons = []; let width = 0, height = 0;
    for (const rows of columns.values()) {
      rows.sort((a,b) => a.y - b.y); const first = rows[0], last = rows[rows.length-1], points = [[first.x+first.n,first.y]];
      for (const r of rows) points.push([r.x+r.w-r.n,r.y], [r.x+r.w,r.y+r.h/2], [r.x+r.w-r.n,r.y+r.h]);
      points.push([last.x+last.n,last.y+last.h]);
      for (const r of [...rows].reverse()) points.push([r.x+r.n,r.y+r.h], [r.x,r.y+r.h/2], [r.x+r.n,r.y]);
      polygons.push('<polygon points="' + points.map(p=>p.join(',')).join(' ') + '"/>');
      for (const r of rows) { width=Math.max(width,r.x+r.w);height=Math.max(height,r.y+r.h); }
    }
    if (!svg) { svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.classList.add('may-group-backdrop');svg.setAttribute('aria-hidden','true');host.prepend(svg); }
    const content=polygons.join('');if(svg._shape!==content){svg.innerHTML=content;svg._shape=content;}
    svg.setAttribute('width',String(Math.ceil(width)));svg.setAttribute('height',String(Math.ceil(height)));
  }
  function overlapRegions(lower,upper){const regions=[];for(const a of lower)for(const b of upper){const left=Math.max(a.left,b.left),top=Math.max(a.top,b.top),right=Math.min(a.right,b.right),bottom=Math.min(a.bottom,b.bottom);if(right>left&&bottom>top)regions.push({left,top,width:right-left,height:bottom-top});}return regions;}
  function syncGroupOverlap() {
    groupFrame=0;
    const entries=[];
    for(const group of document.querySelectorAll(groupSelector)){
      const open=group.matches('.pt-open,.gz-open');if(open&&groupOpen.get(group)===false)groupRanks.set(group,++groupRank);groupOpen.set(group,open);
      const cells=[...group.querySelectorAll('.pt-l,.gz-head,.pt-b,.gz-hx,.gz-control')].filter(e=>e.getClientRects().length&&!e.parentElement.closest('.pt-b,.gz-hx'));
      const rects=cells.map(e=>e.getBoundingClientRect());if(activeList?.group===group&&activeList.list.isConnected)rects.push(activeList.list.getBoundingClientRect());
      entries.push({group,open,rects,rank:groupRanks.get(group)||0,listOwner:activeList?.group===group});
    }
    entries.sort((a,b)=>Number(!!b.listOwner)-Number(!!a.listOwner)||Number(b.open)-Number(a.open)||b.rank-a.rank);
    const above=[];
    for(const entry of entries){
      const group=entry.group,base=group.getBoundingClientRect(),regions=overlapRegions(entry.rects,above),content=regions.map(r=>'<rect x="'+(r.left-base.left)+'" y="'+(r.top-base.top)+'" width="'+r.width+'" height="'+r.height+'"/>').join('');
      let shade=group.querySelector(':scope > .may-overlap-shade');
      if(!content)shade?.remove();else{if(!shade){shade=document.createElementNS('http://www.w3.org/2000/svg','svg');shade.classList.add('may-overlap-shade');shade.setAttribute('aria-hidden','true');group.append(shade);}if(shade._shape!==content){shade.innerHTML=content;shade._shape=content;}}
      if(entry.open)above.push(...entry.rects);
    }
  }
  const scheduleGroups = () => { if(!groupFrame)groupFrame=requestAnimationFrame(syncGroupOverlap); };
  for (const host of [tools,rail.el]) {
    for(const event of ['pointerdown','focusin'])host.addEventListener(event,e=>{const group=e.target.closest('.pt-g, .gz-group');if(group){groupRanks.set(group,++groupRank);scheduleGroups();}},true);
    new MutationObserver(records=>{if(records.some(r=>r.target.matches?.('.pt-g, .gz-group') && /\b(?:pt-open|gz-open)\b/.test(r.oldValue||'')!==r.target.matches('.pt-open, .gz-open')))scheduleGroups();}).observe(host,{subtree:true,attributes:true,attributeOldValue:true,attributeFilter:['class']});
  }
  const placeTools = () => { for (const f of toolSync) f(); syncRailFlyouts(); scheduleGroups(); };
  rail.el.addEventListener('click', () => requestAnimationFrame(syncRailFlyouts));
  $('mayatnikRail').addEventListener('scroll', () => requestAnimationFrame(syncRailFlyouts), {passive:true});
  addEventListener('resize', placeTools); placeTools();
  // v0.048: любую кнопку рейки — Ctrl + тянуть на холст: там встаёт её копия и держится на месте при сдвиге и масштабе.
  // Копия нажимает настоящую кнопку; тянуть копию — переставить, правая кнопка — убрать.
  const PIN_KEY = 'mayatnik-pins';
  let pins = []; try { pins = JSON.parse(localStorage.getItem(PIN_KEY) || '[]'); } catch (_) {}
  const savePins = () => { try { localStorage.setItem(PIN_KEY, JSON.stringify(pins.map(({ g, i, x, y }) => ({ g, i, x, y })))); } catch (_) {} };
  const cellOf = (g, i) => manualLegacyCells.get(g)?.[i] || document.querySelectorAll(`#mayatnikRail .gz-group[data-id="${g}"] .gz-soty > .gz-hx, #paintTools > .gz-group[data-id="${g}"] .gz-soty > .gz-hx`)[i] || null;   // v0.491: прежние номера zoom сохраняют свои живые узлы после переноса
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
      if (p.src) { const on=p.src.matches('.on,.gz-on,[aria-pressed="true"]'),off=p.src.disabled||p.src.matches('.gz-off-dis,[aria-disabled="true"]');
        p.el.classList.toggle('gz-on',on);p.el.classList.toggle('on',on);p.el.classList.toggle('gz-off-dis',off);p.el.disabled=!!off;p.el.setAttribute('aria-pressed',String(on));p.el.setAttribute('aria-disabled',String(!!off));
        const n = p.src.querySelector('.gz-nm'), m = p.el.querySelector('.gz-nm'); if (n && m && m.textContent !== n.textContent) m.textContent = n.textContent; } } }
  pins = pins.filter(p => makePin(p)); placePins();
  let suppressClick = false;
  for (const host of [rail.el, tools]) host.addEventListener('click', e => { if (suppressClick) { suppressClick = false; e.stopPropagation(); e.preventDefault(); } }, true);
  const ctrlPin = e => {
    const cell = e.target.closest('.gz-soty > .gz-hx,[data-may-pin-group]'); if (!cell || !(e.ctrlKey || e.metaKey) || e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    const g = cell.dataset.mayPinGroup||cell.closest('.gz-group').dataset.id, i = cell.dataset.mayPinIndex!=null?Number(cell.dataset.mayPinIndex):(manualLegacyCells.get(g)||[...cell.parentElement.children]).indexOf(cell), r0 = cell.getBoundingClientRect();
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
  // v0.438: сокращаем только отображение; ключи раскладки, исходные элементы и данные не меняются.
  for(const group of tools.querySelectorAll('.pt-g'))if(!group.dataset.k)group.dataset.k=group.querySelector('.pt-l')?.firstChild?.textContent.trim()||'';
  const shortCaption = text => text.replace(/[а-яё]+/giu, word => {
    if(word==='Верт')return word; // Explicit caption approved by the user: «Згибъ Верт».
    let vowels=(word.match(/[аеёиоуыэюя]/giu)||[]).length;
    const compact=word.replace(/(?<=[бвгджзйклмнпрстфхцчшщ])[аеёиоуыэюя](?=[бвгджзйклмнпрстфхцчшщ])/giu,v=>vowels>1?(vowels--,''):v);
    return /[бвгджзйклмнпрстфхцчшщ]$/iu.test(compact) ? compact+(word!=='С'&&word===word.toLocaleUpperCase('ru')?'Ъ':'ъ') : compact;
  });
  const captionSources=new WeakMap(),captionAria=new WeakSet();
  const captionOwner=node=>{
    const parent=node.parentElement;
    if(!parent||parent.closest('.bar,script,style,textarea,select,input,.template-entry>.gz-nm,.may-option-symbol,[data-user-label]'))return null;
    return parent.closest('button,[role="button"],.gz-hx,.pt-l,.may-hp-h,.pt-t3,.pt-half');
  };
  const captionsIn=root=>{
    const owners=new Set();
    const visit=node=>{
      const owner=captionOwner(node);if(!owner)return;
      const old=captionSources.get(node),full=old&&node.data===old.short?old.full:node.data,short=shortCaption(full);
      captionSources.set(node,{full,short});if(node.data!==short)node.data=short;owners.add(owner);
    };
    if(root.nodeType===Node.TEXT_NODE)visit(root);
    else {const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);while(walker.nextNode())visit(walker.currentNode);}
    for(const owner of owners){
      if(owner.hasAttribute('aria-label')&&!captionAria.has(owner))continue;
      const walker=document.createTreeWalker(owner,NodeFilter.SHOW_TEXT),parts=[];
      while(walker.nextNode())parts.push(captionSources.get(walker.currentNode)?.full||walker.currentNode.data);
      const full=parts.join('').trim();if(full){owner.setAttribute('aria-label',full);captionAria.add(owner);if(!owner.title)owner.title=full;}
    }
  };
  captionsIn(document.body);
  new MutationObserver(records=>{
    for(const record of records)if(record.type==='characterData')captionsIn(record.target);else for(const node of record.addedNodes)captionsIn(node);
  }).observe(document.body,{subtree:true,childList:true,characterData:true});
  new ResizeObserver(() => dispatchEvent(new Event('resize'))).observe($('wrap'));
  dispatchEvent(new Event('resize'));
})();

