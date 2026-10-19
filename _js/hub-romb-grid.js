/* Hub v0.206: ромбосетка-треугольник на поле. Любую кнопку хаба тянут мышью в ромб — там встаёт копия, щелчок по ней жмёт оригинал.
   Сетку двигают за пустой ромб, копию — в другой ромб; правый клик по копии убирает её.
   Hub v0.266: «такие же слева перевернув, и сверху, и внизу — по 2; сворачивай до треугольника, если внутри пусто; убери крайние 2» —
   шесть сеток: по две у нижнего, правого (v0.268; в v0.266 — у левого) и верхнего края. Каждая — треугольник рядами 1 · 2 · 3 · 4 (два верхних ромба сняты),
   основание срезано краем экрана пополам, вершина смотрит внутрь. Пустая сетка свёрнута в один ромб у края (видна половина) —
   раскрывается наведением и пока тянут кнопку; с кнопками в покое видны только занятые ромбы. Двигается только вдоль своего края. */
(() => {
  'use strict';
  // Hub v0.243: «наращивать сетку» — заняты все ромбы, у края добавляется ряд на ромб длиннее (st.extra — сколько добавлено).
  const BASE = [1, 2, 3, 4], S = 48, H = S / 2;
  const SRC = 'button,summary,label.hubRhomb';
  const DEFS = [   // id · край · ключ памяти · место по умолчанию (доля вдоль края)
    ['b1', 'b', 'zerk_hub_romb_grid', null], ['b2', 'b', 'zerk_hub_romb_grid_b2', .68],
    ['r1', 'r', 'zerk_hub_romb_grid_r1', .16], ['r2', 'r', 'zerk_hub_romb_grid_r2', .82],   // v0.268: «не слева, а справа — перепутал»; над и под крестом масштаба
    ['t1', 't', 'zerk_hub_romb_grid_t1', .5], ['t2', 't', 'zerk_hub_romb_grid_t2', .78]];

  // Ключ оригинала: id, путь в меню групп, иначе подпись.
  function keyOf(el) {
    if (el.matches('summary')) {
      const d = el.parentElement;
      if (d?.dataset.branch) return 'branch:' + d.dataset.branch;
      if (d?.id) return 'sum:' + d.id;
    }
    if (el.id) return 'id:' + el.id;
    if (el.dataset.pinControl) return 'pin:' + el.dataset.pinControl;
    const a = el.getAttribute('aria-label') || el.title;
    return a ? 'aria:' + a : null;
  }
  const esc = s => (window.CSS?.escape ? CSS.escape(s) : s.replace(/["\\]/g, '\\$&'));
  function find(key) {
    if (!key) return null;
    const i = key.indexOf(':'), k = key.slice(0, i), v = key.slice(i + 1);
    if (k === 'branch') return document.querySelector('details[data-branch="' + esc(v) + '"] > summary');
    if (k === 'sum') return document.getElementById(v)?.querySelector(':scope > summary') || null;
    if (k === 'id') return document.getElementById(v);
    if (k === 'pin') return document.querySelector('[data-pin-control="' + esc(v) + '"]');
    return [...document.querySelectorAll(SRC)].find(n => !n.closest('.hubRombGrid') && (n.getAttribute('aria-label') || n.title) === v) || null;
  }
  const textOf = el => {
    const b = el.querySelector(':scope > b'), s = el.querySelector(':scope > small');
    const t = b ? b.textContent + '\n' + (s?.textContent || '') : el.textContent;
    return t.trim().split('\n').map(x => x.trim()).filter(Boolean).slice(0, 2).join('\n').slice(0, 24);
  };
  const pressedOf = el => {
    const c = el.querySelector?.('input[type=checkbox]');
    if (c) return c.checked;
    const p = el.getAttribute('aria-pressed');
    return p === 'true' ? true : p === 'mixed' ? 'mixed' : false;
  };
  const cellAt = (x, y) => document.elementsFromPoint(x, y).find(n => n.classList?.contains('hubRgCell')) || null;

  let ghost = null;
  const showGhost = (text, x, y) => {
    if (!ghost) { ghost = document.createElement('div'); ghost.id = 'hubRgGhost'; document.body.append(ghost); }
    ghost.textContent = text; ghost.style.left = x + 'px'; ghost.style.top = y + 'px'; ghost.hidden = false;
  };
  const grids = [];
  const fieldLeft = () => matchMedia('(min-width:1101px)').matches && !document.body.classList.contains('hubZen')
    ? Math.max(0, ...['.hub', '#hubSidebarToggle'].map(q => { const r = document.querySelector(q)?.getBoundingClientRect(); return r && r.width ? r.right : 0; })) : 0;
  const hideGhost = () => { if (ghost) ghost.hidden = true; grids.forEach(g => g.cells.forEach(c => c.classList.remove('over'))); };
  const swallowClick = () => {
    const sw = ev => { ev.preventDefault(); ev.stopImmediatePropagation(); };
    document.addEventListener('click', sw, { capture: true, once: true });
    setTimeout(() => document.removeEventListener('click', sw, true), 400);
  };
  function track(e, onMove, onDrop) {
    const x0 = e.clientX, y0 = e.clientY; let moved = false;
    const mv = ev => {
      if (ev.pointerId !== e.pointerId) return;
      if (!moved && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 8) return;
      if (!moved) { moved = true; document.body.classList.add('hubRgDragging'); }
      ev.preventDefault(); onMove(ev, ev.clientX - x0, ev.clientY - y0);
    };
    const up = ev => {
      if (ev.pointerId !== e.pointerId) return;
      document.removeEventListener('pointermove', mv, true); document.removeEventListener('pointerup', up, true); document.removeEventListener('pointercancel', up, true);
      document.body.classList.remove('hubRgDragging'); hideGhost();
      if (moved) { swallowClick(); if (ev.type === 'pointerup') onDrop(ev); }
    };
    document.addEventListener('pointermove', mv, true); document.addEventListener('pointerup', up, true); document.addEventListener('pointercancel', up, true);
  }
  const hover = ev => { const c = cellAt(ev.clientX, ev.clientY); grids.forEach(g => g.cells.forEach(n => n.classList.toggle('over', n === c))); return c; };

  function makeGrid([id, edge, KEY, frac]) {
    let ROWS, CELLS, W, HT;
    const shape = extra => { ROWS = [...BASE]; for (let k = 0; k < extra; k++) ROWS.push(ROWS[ROWS.length - 1] + 1);
      CELLS = ROWS.flatMap((n, r) => Array.from({ length: n }, (_, i) => [(i - (n - 1) / 2) * S, r * H]));
      W = Math.max(...ROWS) * S; HT = (ROWS.length - 1) * H + S; };
    let st = { x: null, y: null, a: null, slots: [], extra: 0 };
    try { const own = localStorage.getItem(KEY), old = !own && edge === 'r' ? localStorage.getItem(KEY.replace(/_r(\d)$/, '_l$1')) : null;
      st = Object.assign(st, JSON.parse(own || old || '{}')); if (old) st.a = null; } catch (_) {}   // v0.268: левые сетки v0.266 переехали направо со своими кнопками
    // v0.266: прежняя сетка (ряды 2 · 1 · 2 · 3 · 4) — два верхних ромба сняты; их копии — в первые пустые ромбы
    if (id === 'b1' && Array.isArray(st.slots) && st.slots.length && !st.v) {
      const ears = st.slots.slice(0, 2).filter(Boolean); st.slots = st.slots.slice(2);
      for (const k of ears) { const j = st.slots.findIndex(x => !x); if (j >= 0) st.slots[j] = k; else st.slots.push(k); }
    }
    st.v = 2; st.extra = Math.max(0, Math.min(8, st.extra | 0)); shape(st.extra);
    while (st.extra < 8 && st.slots.filter(Boolean).length > CELLS.length) shape(++st.extra);
    st.slots = CELLS.map((_, i) => st.slots?.[i] || null);
    const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (_) {} };

    const grid = document.createElement('div');
    if (id === 'b1') grid.id = 'hubRombGrid';
    grid.className = 'hubRombGrid'; grid.dataset.edge = edge; grid.dataset.grid = id;
    grid.setAttribute('role', 'group'); grid.setAttribute('aria-label', 'Ромбосетка для своих кнопок');
    const stub = document.createElement('button');
    stub.type = 'button'; stub.className = 'hubRgStub'; stub.title = 'Пустая ромбосетка: наведите — раскроется · перетащите сюда любую кнопку · тяните — двигать вдоль края';
    const G = { grid, cells: [], get st() { return st; } };
    // место ромба в своей сетке: x — поперёк вершины, y — от вершины к краю (как у нижней); для верхней и левой — отражение / поворот
    const put = (n, x, y) => {
      const a = W / 2 + x - H, d = HT - S - y;   // a — вдоль края, d — от края внутрь
      if (edge === 'b') { n.style.left = a + 'px'; n.style.top = y + 'px'; }
      else if (edge === 't') { n.style.left = a + 'px'; n.style.top = d + 'px'; }
      else if (edge === 'r') { n.style.left = y + 'px'; n.style.top = a + 'px'; }
      else { n.style.left = d + 'px'; n.style.top = a + 'px'; }
    };
    function build() {
      const across = edge === 'l' || edge === 'r';
      grid.style.width = (across ? HT : W) + 'px'; grid.style.height = (across ? W : HT) + 'px';
      G.cells.forEach(c => c.remove());
      G.cells = CELLS.map(([x, y], i) => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'hubRgCell'; b.dataset.i = i;
        put(b, x, y); grid.append(b); return b;
      });
      put(stub, 0, HT - S); grid.append(stub);
    }
    build();
    const grow = () => { if (st.slots.some(k => !k) || st.extra >= 8) return; st.extra++; shape(st.extra); st.slots = CELLS.map((_, i) => st.slots[i] || null); build(); place(); };
    G.grow = grow;

    function place() {
      // Hub v0.243: сетка прилипает к своему краю, ряд у края срезан пополам; двигается только вдоль края.
      if (edge === 'l' || edge === 'r') {
        const y = st.a ?? (innerHeight * frac - W / 2);
        grid.style.top = Math.max(0, Math.min(innerHeight - W, y)) + 'px'; grid.style.left = (edge === 'r' ? innerWidth - HT + H : fieldLeft() - H) + 'px';   // левая — у края поля, не под меню страниц
      } else {
        const x = edge === 'b' && frac == null ? (st.x ?? 330) : (st.a ?? (innerWidth * frac - W / 2));
        grid.style.left = Math.max(0, Math.min(innerWidth - W, x)) + 'px';
        grid.style.top = (edge === 'b' ? innerHeight - HT + H : -H) + 'px';
      }
    }
    G.place = place;
    const along = (dx, dy, r) => { if (edge === 'l' || edge === 'r') st.a = r.top + dy; else if (edge === 'b' && frac == null) st.x = r.left + dx; else st.a = r.left + dx; place(); };
    function paint() {
      grid.classList.toggle('fold', !st.slots.some(Boolean));
      G.cells.forEach((c, i) => {
        const key = st.slots[i], o = find(key);
        c.classList.toggle('full', !!key); c.classList.toggle('lost', !!key && !o);
        if (!key) { c.textContent = ''; c.title = 'Пустой ромб: перетащите сюда любую кнопку · тяните пустой ромб — двигать сетку'; c.removeAttribute('aria-pressed'); c.style.removeProperty('--rg-bg'); c.classList.remove('hasBg'); return; }
        if (!o) { c.textContent = '?'; c.title = 'Оригинал этой кнопки сейчас не найден · ПКМ — убрать'; return; }
        const t = textOf(o); if (c.textContent !== t) c.textContent = t;
        c.title = 'Копия: ' + (o.getAttribute('aria-label') || o.title || t).split(' · ')[0] + ' · тяните — в другой ромб · ПКМ — убрать';
        c.setAttribute('aria-pressed', String(pressedOf(o)));
        const bg = o.style.background || o.style.backgroundColor;
        if (bg) c.style.setProperty('--rg-bg', bg); else c.style.removeProperty('--rg-bg');
        c.classList.toggle('hasBg', !!bg);   // Hub v0.234: свой фон (образец цвета) не затирается обводкой включённой
      });
    }
    G.paint = paint; G.save = save;

    // Внутри сетки: пустой ромб (и свёрнутый) тянет сетку вдоль края, полный — переносит копию.
    grid.addEventListener('pointerdown', e => {
      e.stopPropagation(); if (e.button !== 0) return;
      if (e.target.closest('.hubRgStub')) { const r = grid.getBoundingClientRect(); track(e, (ev, dx, dy) => along(dx, dy, r), () => save()); return; }
      const c = e.target.closest('.hubRgCell'); if (!c) return;
      const i = +c.dataset.i;
      if (!st.slots[i]) {
        const r = grid.getBoundingClientRect();
        track(e, (ev, dx, dy) => along(dx, dy, r), () => save());
      } else {
        track(e, ev => { hover(ev); showGhost(c.textContent, ev.clientX, ev.clientY); }, ev => {
          const t = cellAt(ev.clientX, ev.clientY), key = st.slots[i];
          st.slots[i] = null;
          if (t) { const g2 = grids.find(g => g.grid.contains(t)), j = +t.dataset.i; st.slots[i] = g2.st.slots[j]; g2.st.slots[j] = key; if (g2 !== G) { g2.grow(); g2.save(); g2.paint(); } }
          save(); paint();
        });
      }
    });
    grid.addEventListener('click', e => {
      e.stopPropagation();
      const c = e.target.closest('.hubRgCell'), o = c && find(st.slots[+c.dataset.i]);
      if (o) { o.click(); requestAnimationFrame(paint); }
    });
    grid.addEventListener('contextmenu', e => {
      e.preventDefault(); e.stopPropagation();
      const c = e.target.closest('.hubRgCell'); if (!c || !st.slots[+c.dataset.i]) return;
      st.slots[+c.dataset.i] = null; save(); paint();
    });
    // v0.266: «если одна кнопка — не показывай пустые ряды»: в покое видны только занятые ромбы (пустая — ромб-уголок у края),
    // вся сетка — пока над ней мышь (и ещё 0,4 с) и пока тянут кнопку
    let shutT = 0;
    grid.addEventListener('pointerover', () => { clearTimeout(shutT); grid.classList.add('open'); });
    grid.addEventListener('pointerout', e => { if (grid.contains(e.relatedTarget)) return; clearTimeout(shutT); shutT = setTimeout(() => grid.classList.remove('open'), 400); });
    grid.addEventListener('dblclick', e => e.stopPropagation());
    grid.addEventListener('wheel', e => e.stopPropagation());
    G.restore = s => { const extra = Math.max(0, Math.min(8, s.extra | 0)); shape(extra); st = { v: 2, x: s.x ?? null, y: s.y ?? null, a: s.a ?? null, extra, slots: CELLS.map((_, i) => s.slots?.[i] || null) }; build(); save(); place(); paint(); };
    return G;
  }
  for (const d of DEFS) grids.push(makeGrid(d));
  const paintAll = () => grids.forEach(g => g.paint());

  // Снаружи: любую кнопку тянут в ромб — копией. Ползунки и поля ввода не берутся.
  document.addEventListener('pointerdown', e => {
    if (e.button !== 0 || e.target.closest?.('.hubRombGrid')) return;
    const rail = e.target.closest?.('#hubRail [data-rg-key]');   // v0.267: кнопка рейки — копия её настоящей кнопки поля
    if (rail && e.target.closest('.gz-pin')) return;
    const el = rail ? null : e.target.closest?.(SRC);
    if (!rail && (!el || e.target.closest('input,select,textarea') || el.matches('.hubTilt > summary,.hub-auto-turn'))) return;
    const key = rail ? rail.dataset.rgKey : keyOf(el); if (!key) return;
    const text = rail ? (rail.textContent || '').trim().slice(0, 24) : textOf(el);
    track(e, ev => { hover(ev); showGhost(text, ev.clientX, ev.clientY); }, ev => {
      const t = cellAt(ev.clientX, ev.clientY); if (!t) return;
      const g = grids.find(x => x.grid.contains(t)); if (!g) return;
      g.st.slots[+t.dataset.i] = key; g.grow(); g.save(); g.paint();
    });
  }, true);

  window.HubRombGrid = {
    snapshot: () => ({ v: 2, grids: Object.fromEntries(grids.map(g => [g.grid.dataset.grid, JSON.parse(JSON.stringify(g.st))])) }),
    restore: s => {
      if (!s) return;
      if (s.grids) { for (const g of grids) if (s.grids[g.grid.dataset.grid]) g.restore(s.grids[g.grid.dataset.grid]); return; }
      // прежний снимок одной сетки (ряды 2 · 1 · 2 · 3 · 4): два верхних ромба сняты
      const slots = (s.slots || []).slice(2), ears = (s.slots || []).slice(0, 2).filter(Boolean);
      for (const k of ears) { const j = slots.findIndex(x => !x); if (j >= 0) slots[j] = k; else slots.push(k); }
      grids[0].restore({ ...s, slots });
    }
  };
  const init = () => { grids.forEach(g => { document.body.append(g.grid); g.place(); }); paintAll(); setInterval(() => { paintAll(); grids.forEach(g => g.place()); }, 500); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(init, 0), { once: true });
  else setTimeout(init, 0);
  addEventListener('resize', () => grids.forEach(g => g.place()));
  for (const ev of ['hubmirror', 'hubimage', 'hubmusic', 'hubflowstate', 'hubview', 'hublocks']) addEventListener(ev, () => requestAnimationFrame(paintAll));
})();
