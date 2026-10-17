/* Hub v0.206: ромбосетка-треугольник на поле. Ряды 2 · 1 · 2 · 3 · 4 (12 ромбов).
   Любую кнопку хаба тянут мышью в ромб — там встаёт копия, щелчок по ней жмёт оригинал.
   Сетку двигают за пустой ромб, копию — в другой ромб; правый клик по копии убирает её. */
(() => {
  'use strict';
  const KEY = 'zerk_hub_romb_grid', ROWS = [2, 1, 2, 3, 4], S = 48, H = S / 2;
  const CELLS = ROWS.flatMap((n, r) => Array.from({ length: n }, (_, i) => [(i - (n - 1) / 2) * S, r * H]));
  const W = Math.max(...ROWS) * S, HT = (ROWS.length - 1) * H + S;
  const SRC = 'button,summary,label.hubRhomb';
  let st = { x: null, y: null, slots: [] };
  try { st = Object.assign(st, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (_) {}
  st.slots = CELLS.map((_, i) => st.slots?.[i] || null);
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (_) {} };

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
    return [...document.querySelectorAll(SRC)].find(n => !grid.contains(n) && (n.getAttribute('aria-label') || n.title) === v) || null;
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

  const grid = document.createElement('div');
  grid.id = 'hubRombGrid'; grid.setAttribute('role', 'group'); grid.setAttribute('aria-label', 'Ромбосетка для своих кнопок');
  grid.style.width = W + 'px'; grid.style.height = HT + 'px';
  const cells = CELLS.map(([x, y], i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'hubRgCell'; b.dataset.i = i;
    b.style.left = (W / 2 + x - H) + 'px'; b.style.top = y + 'px';
    grid.append(b); return b;
  });

  function place() {
    const x = st.x ?? 330, y = st.y ?? innerHeight - HT - 24;
    grid.style.left = Math.max(0, Math.min(innerWidth - W, x)) + 'px';
    grid.style.top = Math.max(0, Math.min(innerHeight - HT, y)) + 'px';
  }
  function paint() {
    cells.forEach((c, i) => {
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
  const cellAt = (x, y) => document.elementsFromPoint(x, y).find(n => n.classList?.contains('hubRgCell')) || null;

  let ghost = null;
  const showGhost = (text, x, y) => {
    if (!ghost) { ghost = document.createElement('div'); ghost.id = 'hubRgGhost'; document.body.append(ghost); }
    ghost.textContent = text; ghost.style.left = x + 'px'; ghost.style.top = y + 'px'; ghost.hidden = false;
  };
  const hideGhost = () => { if (ghost) ghost.hidden = true; cells.forEach(c => c.classList.remove('over')); };
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
  const hover = ev => { const c = cellAt(ev.clientX, ev.clientY); cells.forEach(n => n.classList.toggle('over', n === c)); return c; };

  // Внутри сетки: пустой ромб тянет сетку, полный — переносит копию.
  grid.addEventListener('pointerdown', e => {
    e.stopPropagation(); if (e.button !== 0) return;
    const c = e.target.closest('.hubRgCell'); if (!c) return;
    const i = +c.dataset.i;
    if (!st.slots[i]) {
      const r = grid.getBoundingClientRect();
      track(e, (ev, dx, dy) => { st.x = r.left + dx; st.y = r.top + dy; place(); }, () => save());
    } else {
      track(e, ev => { hover(ev); showGhost(c.textContent, ev.clientX, ev.clientY); }, ev => {
        const t = cellAt(ev.clientX, ev.clientY);
        if (!t) st.slots[i] = null;
        else { const j = +t.dataset.i; [st.slots[i], st.slots[j]] = [st.slots[j], st.slots[i]]; }
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
  grid.addEventListener('dblclick', e => e.stopPropagation());
  grid.addEventListener('wheel', e => e.stopPropagation());

  // Снаружи: любую кнопку тянут в ромб — копией. Ползунки и поля ввода не берутся.
  document.addEventListener('pointerdown', e => {
    if (e.button !== 0 || grid.contains(e.target)) return;
    const el = e.target.closest?.(SRC);
    if (!el || e.target.closest('input,select,textarea') || el.matches('.hubTilt > summary,.hub-auto-turn')) return;
    const key = keyOf(el); if (!key) return;
    const text = textOf(el);
    track(e, ev => { hover(ev); showGhost(text, ev.clientX, ev.clientY); }, ev => {
      const t = cellAt(ev.clientX, ev.clientY); if (!t) return;
      st.slots[+t.dataset.i] = key; save(); paint();
    });
  }, true);

  window.HubRombGrid = {
    snapshot: () => JSON.parse(JSON.stringify(st)),
    restore: s => { if (!s) return; st = { x: s.x ?? null, y: s.y ?? null, slots: CELLS.map((_, i) => s.slots?.[i] || null) }; save(); place(); paint(); }
  };
  const init = () => { document.body.append(grid); place(); paint(); setInterval(paint, 500); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(init, 0), { once: true });
  else setTimeout(init, 0);
  addEventListener('resize', place);
  for (const ev of ['hubmirror', 'hubimage', 'hubmusic', 'hubflowstate', 'hubview', 'hublocks']) addEventListener(ev, () => requestAnimationFrame(paint));
})();
