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
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  const isPath = s => /^[Mm][\d\s.,-]/.test(s || '');
  function icon(s) {
    const i = document.createElement('span'); i.className = 'gz-ic';
    if (/^url\(/.test(s || '')) { const m = el('span', 'gz-mask'); m.style.setProperty('--gz-mask', s); i.append(m); }
    else if (isPath(s)) { const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', '0 0 24 24'); const p = document.createElementNS(NS, 'path'); p.setAttribute('d', s); svg.append(p); i.append(svg); }
    else i.textContent = s || '';
    return i;
  }
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
          mid.append(el('span', 'gz-nm', it.name), v); if (it.reset) mid.append(z);
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
            const r = b.getBoundingClientRect();
            ladder.style.left = (r.right + 4) + 'px'; ladder.style.top = Math.max(4, Math.min(innerHeight - it.options.length * 27 - 4, r.top)) + 'px';
            for (const o of it.options) {
              const ob = el('div', 'gz-hx' + (o.v === it.get() ? ' gz-on' : '')); ob.append(icon(o.icon || '·'), el('span', 'gz-nm', o.name));
              ob.addEventListener('click', () => { it.set(o.v); closeLadder(); refresh(); }); ladder.append(ob);
            }
            document.body.append(ladder);
          });
          wide.append(b);
        } else if (it.type === 'color') {
          const sw = el('input', 'gz-color'); sw.type = 'color'; sw.title = it.tip || it.name;
          sw.addEventListener('input', () => { it.set(sw.value); refresh(); });
          const dot = el('span', 'gz-dot');
          b.append(icon(it.icon), el('span', 'gz-nm', it.name), dot, sw);
          refreshers.push(() => { const c = it.get(); if (document.activeElement !== sw) sw.value = c; dot.style.background = c; });
          cells.push(b); soty.append(b);
        } else {
          const nm = el('span', 'gz-nm', it.name); b.append(icon(it.icon), nm);
          if (it.nameNow) refreshers.push(() => { const n = it.nameNow(); if (nm.textContent !== n) nm.textContent = n; });
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
    return { el: root, refresh, open: id => setOpen(id), close: () => setOpen(null), destroy: () => { closeLadder(); tipHide(); root.remove(); } };
  }


  /* Перевод готовой страницы на рейку: рейка рисует свои кнопки, а щелчок передаёт настоящей кнопке страницы,
     так что вся логика страниц остаётся как была. Старые грозди прячутся (класс gz-adopted).
     ZerkGrozd.adopt({ host, key, groups, items, title(g), color(g), fold(g, open) }) */
  const norm = s => String(s || '').replace(/\s+/g, ' ').trim();
  const longOf = e => norm(e.getAttribute('title') || e.dataset.zzTip || e.dataset.t0 || e.getAttribute('aria-label') || '');
  const hiddenEl = e => e.hidden || e.classList.contains('sfz-grape-hidden') || e.classList.contains('sfz-grape-empty') || e.style.display === 'none';
  function nameOf(e) {
    const mi = window.ZerkMenuIcons; let n = '';
    try { n = mi && mi.shortOf ? mi.shortOf(e) : ''; } catch {}
    if (!n || /^действие$/i.test(n)) n = norm(e.textContent).replace(/[◂▸]/g, '');
    return n.length > 16 ? n.slice(0, 15) + '…' : n;
  }
  function iconOf(e) {
    const m = e.style.getPropertyValue('--mi-icon'); if (m) return m.trim();
    const t = norm(e.textContent); const lead = t.match(/^[^\p{L}\p{N}\s]+/u); return lead ? lead[0].slice(0, 2) : '';
  }
  const uids = new WeakMap(); let uidN = 0; const uid = e => { if (!uids.has(e)) uids.set(e, ++uidN); return uids.get(e); };
  function fire(inp) { inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true })); }
  function itemOf(e) {
    const tip = longOf(e), name = nameOf(e);
    if (e._fan) { const opts = () => [...e._fan.children];   // главный ромб с лесенкой вариантов (Зеркалиус)
      return { type: 'list', icon: iconOf(e), name, tip, get: () => opts().findIndex(o => o.matches('.on,[aria-pressed="true"]')), set: v => opts()[v] && opts()[v].click(),
        options: opts().map((o, k) => ({ v: k, name: nameOf(o), icon: iconOf(o) })) }; }
    if (e.matches('.zerk-split')) { const h = c => e.querySelector(':scope > .zerk-half-' + c), z = e.querySelector(':scope > .zerk-split-zero');   // ромб ◂ значение ▸
      return { type: 'value', name, tip, get: () => norm(e.querySelector('.zerk-split-value')?.textContent).replace(/\s+/g, ' '),
        step: d => { const b = Math.abs(d) === 2 ? h(d < 0 ? 'minus2' : 'plus2') : null; if (b) b.click(); else h(d < 0 ? 'minus' : 'plus')?.click(); },
        reset: z ? () => z.click() : null }; }
    const inp = e.matches('input,select') ? e : e.querySelector('input,select');
    if (inp && inp.tagName === 'SELECT') return { type: 'list', icon: iconOf(e), name, tip, get: () => inp.value, set: v => { inp.value = v; fire(inp); },
      options: [...inp.options].map(o => ({ v: o.value, name: norm(o.textContent) })) };
    if (inp && (inp.type === 'range' || inp.type === 'number')) {
      const st = () => parseFloat(inp.step) || 1, lo = () => inp.min === '' ? -Infinity : +inp.min, hi = () => inp.max === '' ? Infinity : +inp.max;
      const put = v => { v = Math.max(lo(), Math.min(hi(), v)); const d = (String(inp.step).split('.')[1] || '').length; inp.value = d ? v.toFixed(d) : String(Math.round(v)); fire(inp); };
      const shown = () => { const t = norm(e.textContent).replace(/[◂▸]/g, ' ').trim(); const m = t.match(/[-−+]?\d[\d.,]*\s*\S*$/); return m && inp.type === 'range' ? m[0] : inp.value; };
      return { type: 'value', name: name.replace(/[\d.,]+.*$/, '').trim() || name, tip, get: shown,
        step: d => { let s = st(); if (Math.abs(d) === 2) { const span = hi() - lo(); s = Number.isFinite(span) ? Math.max(s, Math.round(span * .05 / s) * s) : s * 5; } put(+inp.value + Math.sign(d) * s); },
        reset: () => put(Math.max(lo(), Math.min(hi(), 0))) };
    }
    if (inp && inp.type === 'color') return { type: 'color', icon: iconOf(e), name, tip, get: () => inp.value, set: v => { inp.value = v; fire(inp); } };
    if (inp && inp.type === 'checkbox') return { type: 'toggle', icon: iconOf(e), name, tip, on: () => inp.checked, click: () => inp.click(), disabled: () => inp.disabled };
    return { type: 'toggle', icon: iconOf(e), name, nameNow: () => nameOf(e), tip,
      on: () => e.matches('.on,.sel,.act,.active,[aria-pressed="true"]'), click: () => e.click(), disabled: () => !!e.disabled };
  }
  function adopt(cfg) {
    const host = typeof cfg.host === 'string' ? document.querySelector(cfg.host) : cfg.host; if (!host) return null;
    const gid = g => g.dataset.g || g.id;
    const dock = el('div', 'gz-dock'); if (cfg.style) Object.assign(dock.style, cfg.style); host.append(dock);
    let cur = null, sig = '', live = [];
    const groupsNow = () => [...document.querySelectorAll(cfg.groups)].filter(g => !g.matches(cfg.skip || '.coff'));
    const itemsOf = g => [...g.querySelectorAll(cfg.items)].filter(e => !hiddenEl(e) && !e.closest('.gz-dock,.zerk-source-fan') && !(e.parentElement && e.parentElement.closest(cfg.items)));
    function build() {
      const isPanel = g => !!cfg.panels && g.matches(cfg.panels);   // панель без кнопок (подсказки, текст): в рейке только шапка, раскрыть — показать саму панель
      const gs = [...groupsNow(), ...(cfg.panels ? document.querySelectorAll(cfg.panels) : [])].filter((g, k, a) => a.indexOf(g) === k)
        .map(g => ({ g, items: isPanel(g) ? [] : itemsOf(g), panel: isPanel(g) })).filter(x => x.panel || x.items.length);
      const now = gs.map(x => gid(x.g) + ':' + (x.panel ? 'p' : x.items.map(uid).join(','))).join('|');
      if (now === sig) return false; sig = now;
      if (cur) cur.destroy();
      for (const g of live) { g.classList.remove('gz-adopted'); g.style.removeProperty('display'); }
      live = gs.map(x => x.g); for (const g of live) { g.classList.add('gz-adopted'); g.style.setProperty('display', 'none', 'important'); }
      cur = make(gs);
      panelsNow();
      return true;
    }
    // открытая панель встаёт справа от своей шапки в рейке, а не там, где плавала раньше
    function showPanel(g, on) {
      g.classList.toggle('gz-adopted', !on);
      if (!on) { g.style.setProperty('display', 'none', 'important'); for (const k of ['position', 'left', 'top', 'z-index']) g.style.removeProperty(k); return; }
      const h = [...dock.querySelectorAll('.gz-group')].find(b => b.dataset.id === gid(g)), r = h && h.querySelector('.gz-head').getBoundingClientRect();
      g.style.removeProperty('display');
      if (r) { g.style.setProperty('position', 'fixed', 'important'); g.style.setProperty('left', Math.min(r.right + 6, innerWidth - g.offsetWidth - 4) + 'px', 'important');
        g.style.setProperty('top', Math.max(4, Math.min(r.top, innerHeight - g.offsetHeight - 4)) + 'px', 'important'); g.style.setProperty('z-index', '2147483641', 'important'); }
    }
    const panelsNow = () => { const open = [...dock.querySelectorAll('.gz-group.gz-open')].map(b => b.dataset.id); for (const g of live) if (cfg.panels && g.matches(cfg.panels)) showPanel(g, open.includes(gid(g))); };
    function make(gs) {
      return rail(dock, { key: cfg.key, onToggle: (id, open) => { const x = gs.find(x => gid(x.g) === id); if (!x) return;
          if (x.panel) showPanel(x.g, open);
          if (cfg.fold) cfg.fold(x.g, open); },
        groups: gs.map(x => ({ id: gid(x.g), title: cfg.title(x.g), color: cfg.color(x.g), items: x.items.map(itemOf) })) });
    }
    build();
    // свернуть все группы страницы, кроме открытой в рейке (3D-вид следует за группой «3D»)
    if (cfg.fold) { const open = cur && [...dock.querySelectorAll('.gz-group.gz-open')].map(b => b.dataset.id)[0]; for (const g of live) cfg.fold(g, gid(g) === open); }
    const help = () => { const b = cfg.helpButton && document.querySelector(cfg.helpButton); document.documentElement.classList.toggle('gz-help', !!b && b.classList.contains('on')); };
    setInterval(() => { help(); if (!build() && cur) cur.refresh(); panelsNow(); }, 400);
    return { dock, rebuild: () => { sig = ''; build(); } };
  }

  window.ZerkGrozd = { version: 3, rail, adopt };
})();
