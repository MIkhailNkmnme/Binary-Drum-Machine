/* Матрёшки v0.003. Отображение, общий пульт, слои и адреса исходных битов. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id), KEY = 'matryoshki_v1';
  let saved = {}; try { saved = JSON.parse(localStorage.getItem(KEY)) || {}; } catch {}
  const validRows = [32, 64, 128, 256, 512, 1024, 2048];
  const state = { rows: validRows.includes(saved.rows) ? saved.rows : 64, frame: Number.isSafeInteger(saved.frame) && saved.frame > 0 ? Math.min(saved.frame, 1000000) : 64,
    grow: saved.grow !== false, spread: !!saved.spread, cooling: !!saved.cooling, digits: !!saved.digits, speed: Number.isFinite(saved.speed) ? Math.max(0, Math.min(100, saved.speed)) : 45 };
  let source = null, projected = [], caps = [], selected = -1, rail, busy = false, id = 0, playing = false, direction = 1, lastTime = 0, credit = 0;
  let zoom = 1, panX = 0, panY = 0, hitRegions = [], picked = null, worker;
  const canvas = $('field'), ctx = canvas.getContext('2d'), view = $('view'), pult = $('pult');
  const colors = ['#80aee8', '#68d6bc', '#e8bf6b', '#b4a0ed'];
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} }
  function rate() { return Math.pow(2, state.speed / 15) / 2; }
  function refresh() {
    $('play').textContent = playing ? 'Ⅱ' : '▶'; $('play').setAttribute('aria-label', playing ? 'Пауза' : 'Пуск'); $('play').setAttribute('aria-pressed', String(playing));
    $('reverse').classList.toggle('on', direction < 0); $('forward').classList.toggle('on', direction > 0);
    $('speed').value = state.speed; $('speedValue').textContent = ZerkPult.label(rate()); $('speedValue').title = `${rate().toFixed(1)} тактов в секунду`;
    $('stepBack').disabled = busy || state.frame <= 1; $('stepNext').disabled = busy;
    if (source) {
      $('frameValue').textContent = source.frame; $('timeline').max = Math.max(source.rows * 4, source.frame); $('timeline').value = source.frame;
      const a = MAYATNIK.offset('pend', source.frame - 1);
      $('summary').textContent = `${source.rows} строк · вершина ${a > 0 ? '+' : ''}${a} · ${a < 0 ? 'левый' : a > 0 ? 'правый' : 'первый'} ход`;
    }
    ZerkPult.sync(pult, state.speed / 100); rail?.refresh();
  }
  function pause() { playing = false; credit = 0; refresh(); }
  function request(frame, rows = state.rows) {
    frame = Math.max(1, Math.floor(frame));
    if (!Number.isSafeInteger(frame)) { pause(); return; }
    try { Matryoshki.dimensions(rows); } catch (error) { pause(); $('activity').textContent = error.message; return; }
    if (!worker) return;
    busy = true; $('activity').textContent = rows !== source?.rows ? `Строю ${rows} строк…` : '';
    worker.postMessage({ id: ++id, rows, frame }); refresh();
  }
  function next(delta) {
    if (busy) return;
    const frame = Math.max(1, state.frame + delta); let rows = state.rows;
    if (delta > 0 && state.grow && frame > rows * 2) rows *= 2;
    request(frame, rows);
  }
  worker = MatryoshkiRuntime.createClient({
    onmessage: ({ data }) => {
      if (data.id !== id) return;
      if (data.error) { busy = false; pause(); $('activity').textContent = data.error; return; }
      if (data.progress != null) { $('activity').textContent = `Построение: ${data.progress} / ${data.target}`; return; }
      const priorRows = source?.rows; source = data.snapshot; state.rows = source.rows; state.frame = source.frame; busy = false;
      $('activity').textContent = ''; if (priorRows && priorRows !== source.rows) { zoom = 1; panX = panY = 0; }
      picked = null; $('inspection').textContent = 'Нажмите на бит — покажу исходный адрес. Свёрнутые строки находятся внутри цветного контура.';
      rebuild(); save(); refresh();
    }
  });
  const toggle = (key, icon, name, tip) => ({ type: 'toggle', icon, name, tip, on: () => state[key], click() { state[key] = !state[key]; save(); draw(); } });
  rail = ZerkGrozd.rail($('rail'), { key: 'matryoshki_v1', groups: [
    { id: 'build', title: 'Построение', color: '#80aee8', open: true, items: [
      { type: 'action', icon: '↤', name: 'К вершине', tip: 'Вернуться к первой вершине; поле можно снова построить вперёд.', click() { pause(); request(1); } },
      toggle('grow', '↧', 'Рост', 'Автоматически увеличивать глубину участка после двух тактов на строку.'),
      { type: 'list', icon: '≡', name: 'Строки', tip: 'Глубина загруженного участка; одинаковые верхние строки сохраняются.', options: validRows.map(v => ({ v, name: String(v) })), get: () => state.rows, set(v) { pause(); request(state.frame, v); } },
      { type: 'action', icon: '+', name: 'Ещё строки', tip: 'Удвоить глубину и восстановить тот же такт в большем поле.', click() { pause(); request(state.frame, state.rows * 2); } }
    ] },
    { id: 'view', title: 'Слои и вид', color: '#68d6bc', items: [
      toggle('spread', '▥', 'Рядом', 'Разнести уровни для сравнения; выключено — показать выбранную матрёшку с содержимым внутри.'),
      toggle('cooling', '◈', 'Остывание', 'Зелёные биты уже недостижимы для будущих конусов, золотые ещё могут измениться.'),
      toggle('digits', '01', 'Цифры', 'Показывать значения битов при достаточном масштабе.'),
      { type: 'action', icon: '⤢', name: 'Вписать', tip: 'Вместить все показанные слои в окно.', click() { zoom = 1; panX = panY = 0; draw(); } }
    ] }
  ] });
  function rebuild() {
    const followReady = selected < 0 || selected === caps.length - 1;
    caps = [0]; for (let d = 1; d < source.rows; d *= 2) caps.push(d); caps.push(Infinity);
    if (followReady || selected >= caps.length) selected = caps.length - 1;
    const host = $('layers'); host.replaceChildren();
    caps.forEach((cap, index) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'hex'; b.textContent = cap === 0 ? '△ Исходный' : cap === Infinity ? '◈ Вся готовая' : `◇ До ${cap}`;
      b.setAttribute('aria-pressed', String(index === selected)); b.addEventListener('click', () => { selected = index; picked = null; rebuild(); }); host.append(b);
    });
    const indices = [...new Set([0, Math.max(0, selected - 2), Math.max(0, selected - 1), selected])];
    projected = indices.map(i => ({ index: i, node: MatryoshkiPacking.pack(Matryoshki.project(source, caps[i])) })); draw();
  }
  function draw() {
    if (!source) return;
    const width = view.clientWidth, height = view.clientHeight, dpr = Math.min(2, devicePixelRatio || 1);
    if (!width || !height) return;
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, width, height); ctx.imageSmoothingEnabled = false;
    hitRegions = [];
    const shown = state.spread ? projected : projected.filter(p => p.index === selected);
    const count = shown.length, columns = state.spread ? Math.min(count, width < 650 ? 1 : 2) : 1, lines = Math.ceil(count / columns);
    for (let p = 0; p < count; p++) {
      const { node, index } = shown[p], col = p % columns, line = Math.floor(p / columns);
      const cell = Math.max(.05, Math.min((width / columns - 28) / source.width, (height / lines - 46) / node.height)) * zoom;
      const x0 = (col + .5) * width / columns + panX, y0 = line * height / lines + 30 + panY;
      ctx.fillStyle = colors[0]; ctx.font = '12px Segoe UI'; ctx.textAlign = 'center';
      ctx.fillText(caps[index] === 0 ? 'Исходный' : caps[index] === Infinity ? 'Вся готовая свёртка' : `Глубина до ${caps[index]}`, x0, y0 - 12);
      drawNode(node, x0, y0, cell, index, 0);
    }
    if (picked) {
      const h = hitRegions.find(h => h.key === picked.key);
      if (h) { ctx.strokeStyle = '#ff87cf'; ctx.lineWidth = 2; ctx.strokeRect(h.x0+(picked.c-.5)*h.cell,h.y0+picked.y*h.cell,h.cell,h.cell); }
    }
    rail?.refresh();
  }
  function drawNode(node, x0, y0, cell, index, depth) {
    const { layer } = node, tint = colors[depth % colors.length];
    // Сначала непрозрачная оболочка: за внутренним узором не просвечивают биты внешнего.
    ctx.beginPath();
    for (let y = 0; y < node.height; y++) {
      const x = x0+(node.left[y]-.5)*cell, top = y0+y*cell;
      if (y === 0) ctx.moveTo(x,top); else ctx.lineTo(x,top);
      ctx.lineTo(x,top+cell);
    }
    for (let y = node.height-1; y >= 0; y--) {
      const x = x0+(node.right[y]+.5)*cell, top = y0+y*cell;
      ctx.lineTo(x,top+cell); ctx.lineTo(x,top);
    }
    ctx.closePath(); ctx.fillStyle = '#0d1119'; ctx.fill();
    ctx.save(); ctx.clip();
    for (let y = 0; y < node.height; y++) {
      const r = node.rows[y], py = y0+y*cell;
      if (py > view.clientHeight || py+cell < 0) continue;
      for (let c = node.left[y]; c <= node.right[y]; c++) {
        const i = r*layer.width+layer.center+c, bit = layer.bits[i]; if (bit < 0) continue;
        const x = x0+(c-.5)*cell; if (x > view.clientWidth || x+cell < 0) continue;
        ctx.fillStyle = state.cooling ? (layer.frozen[i] ? (bit ? '#80e2b0' : '#245b49') : (bit ? '#ffd166' : '#765629')) : (bit ? '#e8edf5' : '#46546c');
        ctx.fillRect(x,py,cell,cell);
        if (state.digits && cell >= 10) { ctx.fillStyle = bit ? '#0d1119' : '#fff'; ctx.font = `${Math.min(18,cell*.7)}px Consolas`; ctx.textAlign = 'center'; ctx.fillText(String(bit),x+cell/2,py+cell*.77); }
      }
    }
    ctx.restore(); ctx.strokeStyle = tint; ctx.lineWidth = depth ? 2 : 1; ctx.stroke();
    hitRegions.push({ x0, y0, cell, node, index, depth, key: `${index}:${depth}` });
    if (node.child) {
      const f = node.placement;
      drawNode(node.child,x0+f.x*cell,y0+f.y*cell,cell*f.scale,index,depth+1);
    }
  }
  function inspect(x, y) {
    for (const h of [...hitRegions].reverse()) {
      const row = Math.floor((y-h.y0)/h.cell), c = Math.floor((x-h.x0)/h.cell+.5), origin = MatryoshkiPacking.origin(h.node,row,c); if (!origin) continue;
      const r = origin.row, layer = h.node.layer;
      picked = { key:h.key,y:row,c }; const bit = layer.bits[r*layer.width+layer.center+c];
      const coordinates = origin.folded && origin.from !== origin.to ? `XOR исходных столбцов ${origin.from}…${origin.to}` : `исходный столбец ${origin.from}`;
      $('inspection').textContent = `Такт ${source.frame} · ${h.depth ? `внутри, уровень ${h.depth}` : 'внешний уровень'} · исходная строка ${r} · бит ${bit} · ${coordinates}. Свёрнуто: слева ${layer.left[r]}, справа ${layer.right[r]}.`;
      draw(); return;
    }
  }
  let drag = null;
  canvas.addEventListener('pointerdown', e => { if(e.button !== 0)return; canvas.setPointerCapture(e.pointerId); drag={id:e.pointerId,x:e.clientX,y:e.clientY,px:panX,py:panY,moved:false}; });
  canvas.addEventListener('pointermove', e => { if(!drag||drag.id!==e.pointerId)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(dx,dy)>3)drag.moved=true;if(drag.moved){panX=drag.px+dx;panY=drag.py+dy;draw();} });
  canvas.addEventListener('pointerup', e => { if(!drag||drag.id!==e.pointerId)return;const moved=drag.moved;drag=null;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);if(!moved){const b=canvas.getBoundingClientRect();inspect(e.clientX-b.left,e.clientY-b.top);} });
  canvas.addEventListener('pointercancel', () => {drag=null;});
  canvas.addEventListener('wheel', e => {e.preventDefault();zoom=Math.max(.25,Math.min(32,zoom*Math.exp(-e.deltaY*.0015)));draw();},{passive:false});
  $('play').onclick = () => {playing=!playing;credit=0;lastTime=0;refresh();};
  $('reverse').onclick = () => {direction=-1;refresh();}; $('forward').onclick = () => {direction=1;refresh();};
  $('stepNext').onclick = () => {pause();next(1);}; $('stepBack').onclick = () => {pause();next(-1);};
  $('speed').oninput = () => {state.speed=Number($('speed').value);save();refresh();}; $('speedValue').ondblclick = () => {state.speed=15;save();refresh();};
  $('timeline').oninput = () => {pause();request(Number($('timeline').value));};
  $('help').onclick = () => $('about').showModal();
  document.addEventListener('keydown', e => {if(e.target.closest('input,select,button,dialog,[role=button]'))return;if(e.code==='Space'){e.preventDefault();$('play').click();}if(e.code==='ArrowRight'){e.preventDefault();pause();next(1);}if(e.code==='ArrowLeft'){e.preventDefault();pause();next(-1);}});
  new ResizeObserver(() => {draw();refresh();}).observe(view);
  function tick(time) {if(playing&&!busy){if(lastTime)credit+=Math.min(.1,(time-lastTime)/1000)*rate();if(credit>=1){credit-=1;if(direction<0&&state.frame<=1)pause();else next(direction);}}lastTime=time;requestAnimationFrame(tick);}
  requestAnimationFrame(tick);refresh();request(state.frame);
})();
