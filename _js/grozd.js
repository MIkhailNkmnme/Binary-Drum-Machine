/* Общие группы кнопок (вариант А, 14.10). Подключается всеми тремя страницами; вид — grozd.css.
   Рейка у края страницы: группы одна под другой, открыта одна (остальные — только шапки).
   Шапку можно тащить, чтобы поменять порядок групп; порядок и открытая группа запоминаются.
   Кнопка — низкий шестиугольник: значок + короткое название, размер не меняется.
   Пока на <html> стоит класс gz-help («?»), рядом с кнопкой под курсором — длинная подсказка.

   ZerkGrozd.rail(host, { key, groups, onToggle(id, open) }) → { el, refresh(), open(id), close() }
   группа: { id, title, color, items: [...] }
   кнопка:
     { type:'toggle', icon, name, tip, on:()=>bool, click() }
     { type:'action', icon, name, tip, click(), disabled:()=>bool }
     { type:'value',  name, tip, get:()=>текст, step(d) — d = −2, −1, 1, 2; reset() }
     { type:'list',   icon, name, tip, options:[{ v, name, icon }], get:()=>v, set(v) }
   icon — знак ('◯') или путь svg ('M4 12h16'). Переключатели и действия идут сотами в 2 столбца,
   значения и списки — во всю ширину под ними. */
(() => {
  const NS = 'http://www.w3.org/2000/svg';
  const isPath = s => /^[Mm][\d\s.,-]/.test(s || '');
  function icon(s) {
    const i = document.createElement('span'); i.className = 'gz-ic';
    if (isPath(s)) { const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', '0 0 24 24'); const p = document.createElementNS(NS, 'path'); p.setAttribute('d', s); svg.append(p); i.append(svg); }
    else i.textContent = s || '';
    return i;
  }
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  const store = { get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };

  let tipEl = null;
  function tipShow(btn, text) {
    if (!text || !document.documentElement.classList.contains('gz-help')) return;
    if (!tipEl) { tipEl = el('div', 'gz-tip'); document.body.append(tipEl); }
    tipEl.textContent = text; tipEl.hidden = false;
    const r = btn.getBoundingClientRect(), rail = btn.closest('.gz-rail').getBoundingClientRect(), tw = tipEl.offsetWidth, th = tipEl.offsetHeight;
    let x = Math.max(r.right, rail.right) + 8; if (x + tw > innerWidth - 4) x = r.left - tw - 8;
    let y = r.top + r.height / 2 - th / 2; y = Math.max(4, Math.min(innerHeight - th - 4, y));
    tipEl.style.left = x + 'px'; tipEl.style.top = y + 'px';
  }
  function tipHide() { if (tipEl) tipEl.hidden = true; }
  function withTip(b, text) { b.addEventListener('pointerenter', () => tipShow(b, text)); b.addEventListener('pointerleave', tipHide); }

  let ladder = null;
  function closeLadder() { if (ladder) { ladder.remove(); ladder = null; } }
  document.addEventListener('pointerdown', e => { if (ladder && !e.target.closest('.gz-ladder,.gz-list')) closeLadder(); }, true);

  function rail(host, cfg) {
    const key = 'grozd:' + (cfg.key || 'rail');
    const saved = store.get(key) || {};
    const root = el('div', 'gz-rail'); host.append(root);
    const refreshers = [];
    const byId = new Map();
    let openId = saved.open !== undefined ? saved.open : (cfg.groups.find(g => g.open) || {}).id ?? null;
    const order = Array.isArray(saved.order) ? saved.order : [];
    const groups = [...cfg.groups].sort((a, b) => { const i = order.indexOf(a.id), j = order.indexOf(b.id); return (i < 0 ? 1e3 : i) - (j < 0 ? 1e3 : j); });

    function save() { store.set(key, { open: openId, order: [...root.children].map(g => g.dataset.id).filter(Boolean) }); }
    function setOpen(id) {
      const prev = openId; openId = id; closeLadder();
      for (const [gid, g] of byId) { const on = gid === id; g.box.classList.toggle('gz-open', on); g.ar.textContent = on ? '▾' : '▸'; }
      if (cfg.onToggle) { if (prev != null && prev !== id) cfg.onToggle(prev, false); if (id != null && id !== prev) cfg.onToggle(id, true); }
      save(); refresh();
    }

    for (const g of groups) {
      const box = el('div', 'gz-group'); box.dataset.id = g.id; box.style.setProperty('--c', g.color || '#5aa9ff');
      const head = el('button', 'gz-hx gz-head'); head.type = 'button';
      const nm = el('span', 'gz-nm', g.title), ar = el('span', 'gz-ar');
      head.append(nm, ar); box.append(head); withTip(head, g.tip || '');
      const soty = el('div', 'gz-soty'), wide = el('div', 'gz-wide');
      const cells = [];
      for (const it of g.items) {
        const b = el('div', 'gz-hx'); b.tabIndex = 0; b.setAttribute('role', 'button'); withTip(b, it.tip || it.name);
        if (it.type === 'value') {
          b.classList.add('gz-val');
          const a = (cls, t, d) => { const s = el('span', 'gz-a ' + cls, t); s.addEventListener('click', e => { e.stopPropagation(); it.step(d); refresh(); }); return s; };
          const mid = el('span', 'gz-mid'), v = el('span', 'gz-v'), z = el('span', 'gz-z', '0');
          z.title = 'Сбросить'; z.addEventListener('click', e => { e.stopPropagation(); it.reset && it.reset(); refresh(); });
          mid.append(el('span', 'gz-nm', it.name), v, z);
          b.append(a('gz-a2', '◂◂', -2), a('', '◂', -1), mid, a('', '▸', 1), a('gz-a2', '▸▸', 2));
          refreshers.push(() => { v.textContent = it.get(); });
          wide.append(b);
        } else if (it.type === 'list') {
          b.classList.add('gz-list');
          const ic = icon(it.icon), v = el('span', 'gz-v');
          b.append(ic, el('span', 'gz-nm', it.name), v, el('span', 'gz-ar', '▾'));
          refreshers.push(() => { const o = it.options.find(o => o.v === it.get()); v.textContent = o ? o.name : ''; });
          b.addEventListener('click', () => {
            if (ladder && ladder.owner === b) return closeLadder();
            closeLadder(); ladder = el('div', 'gz-ladder'); ladder.owner = b; ladder.style.setProperty('--c', g.color || '#5aa9ff');
            const r = b.getBoundingClientRect(), rr = root.getBoundingClientRect();
            ladder.style.left = (r.right - rr.left + 4) + 'px'; ladder.style.top = (r.top - rr.top) + 'px';
            for (const o of it.options) {
              const ob = el('div', 'gz-hx' + (o.v === it.get() ? ' gz-on' : '')); ob.append(icon(o.icon || '·'), el('span', 'gz-nm', o.name));
              ob.addEventListener('click', () => { it.set(o.v); closeLadder(); refresh(); }); ladder.append(ob);
            }
            root.append(ladder);
          });
          wide.append(b);
        } else {
          b.append(icon(it.icon), el('span', 'gz-nm', it.name));
          b.addEventListener('click', () => { if (it.disabled && it.disabled()) return; it.click && it.click(); refresh(); });
          if (it.type === 'toggle') refreshers.push(() => b.classList.toggle('gz-on', !!it.on()));
          if (it.disabled) refreshers.push(() => b.classList.toggle('gz-off-dis', !!it.disabled()));
          cells.push(b); soty.append(b);
        }
        b.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); b.click(); } });
      }
      // соты: столбец k%2, второй сдвинут на полкнопки вниз и заходит в выемку первого
      const s = getComputedStyle(root), W = parseFloat(s.getPropertyValue('--gz-w')) || 120, H = parseFloat(s.getPropertyValue('--gz-h')) || 24, N = parseFloat(s.getPropertyValue('--gz-n')) || 12, DY = H + 3;
      cells.forEach((b, k) => { const col = k % 2, row = k >> 1; b.style.left = (col * (W - N + 4)) + 'px'; b.style.top = (row * DY + col * DY / 2) + 'px'; });
      const rows = Math.ceil(cells.length / 2);
      soty.style.height = cells.length ? (rows * DY + (cells.length > 1 ? DY / 2 : 0) - 3) + 'px' : '0';
      if (cells.length) box.append(soty);
      if (wide.children.length) box.append(wide);
      root.append(box);
      byId.set(g.id, { box, ar });
      head.addEventListener('click', () => { if (head.dataset.dragged) { delete head.dataset.dragged; return; } setOpen(openId === g.id ? null : g.id); });
      dragHead(head, box);
    }

    // перетаскивание шапки меняет порядок групп в рейке
    function dragHead(head, box) {
      head.addEventListener('pointerdown', e => {
        if (e.button !== 0) return;
        const y0 = e.clientY; let slot = null;
        const move = ev => {
          if (!slot && Math.abs(ev.clientY - y0) < 6) return;
          if (!slot) { slot = el('div', 'gz-slot'); box.after(slot); box.classList.add('gz-drag'); closeLadder(); }
          const after = [...root.querySelectorAll(':scope > .gz-group:not(.gz-drag)')].find(g => { const r = g.getBoundingClientRect(); return ev.clientY < r.top + 15; });
          if (after) after.before(slot); else root.append(slot);
        };
        const up = () => {
          removeEventListener('pointermove', move); removeEventListener('pointerup', up);
          if (!slot) return;
          slot.replaceWith(box); box.classList.remove('gz-drag'); head.dataset.dragged = '1'; setTimeout(() => delete head.dataset.dragged, 0); save();
        };
        addEventListener('pointermove', move); addEventListener('pointerup', up);
      });
    }

    function refresh() { for (const f of refreshers) f(); }
    setOpen(openId);
    return { el: root, refresh, open: id => setOpen(id), close: () => setOpen(null) };
  }

  window.ZerkGrozd = { version: 1, rail };
})();
