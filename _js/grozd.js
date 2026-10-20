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

  // 19.10: «когда нажимаю — пусть даёт знать, даже если кнопка неактивна»: пока держат и ещё 0,16 с — фон кнопки снят, видна кайма (.gz-press)
  function pressMark(e) {
    const h = e.target.closest('.gz-hx'); if (!h || e.button > 0 || e.target.closest('.gz-pin')) return;
    h.classList.add('gz-press'); const t0 = performance.now();
    const off = () => { removeEventListener('pointerup', off, true); removeEventListener('pointercancel', off, true); setTimeout(() => h.classList.remove('gz-press'), Math.max(0, 160 - (performance.now() - t0))); };
    addEventListener('pointerup', off, true); addEventListener('pointercancel', off, true);
  }
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
  function closeLadder() { if (ladder) { ladder.remove(); ladder = null; } document.querySelectorAll('.gz-under').forEach(x => x.classList.remove('gz-under')); }
  // «когда список накладывается на рейку — затемняй рейку всю по этому столбцу в этой группе»
  function dimUnder(owner) { const g = owner.closest('.gz-group'); if (!g || !ladder) return; const L = ladder.getBoundingClientRect();
    for (const x of g.querySelectorAll('.gz-soty > .gz-hx, .gz-wide > .gz-hx')) { if (x === owner) continue; const r = x.getBoundingClientRect(); if (r.right > L.left + 2 && r.left < L.right - 2) x.classList.add('gz-under'); } }
  document.addEventListener('pointerdown', e => { if (ladder && !e.target.closest('.gz-ladder,.gz-list')) closeLadder(); }, true);

  const PIN = '<svg viewBox="0 0 16 16" width="11" height="11"><path d="M10.5 1.5l4 4-1.6.4-2.6 2.6.3 3.2-1.4 1.4-2.5-2.5-4 4-.7-.7 4-4L3.5 7.4l1.4-1.4 3.2.3 2.6-2.6z" fill="currentColor"/></svg>';
  function rail(host, cfg) {
    const key = 'grozd:' + (cfg.key || 'rail');
    const saved = store.get(key) || {};
    const root = el('div', 'gz-rail'); host.append(root);
    root.addEventListener('pointerdown', pressMark);
    const refreshers = [];
    const byId = new Map();
    let openId = saved.open !== undefined ? saved.open : (cfg.groups.find(g => g.open) || {}).id ?? null;
    const pinned = new Set(Array.isArray(saved.pin) ? saved.pin : []);   // 15.10: закреплённые группы не сворачиваются при открытии другой
    const shut = new Set(Array.isArray(saved.shut) ? saved.shut : []);   // 19.10: «закреп сверну — галку не убирай»: закреплённая, но свёрнутая шапкой
    let openSet = new Set(), first = true;
    const order = Array.isArray(saved.order) ? saved.order : [];
    const groups = [...cfg.groups].sort((a, b) => { const i = order.indexOf(a.id), j = order.indexOf(b.id); return (i < 0 ? 1e3 : i) - (j < 0 ? 1e3 : j); });

    function save() { store.set(key, { open: openId, pin: [...pinned], shut: [...shut], order: [...root.children].map(g => g.dataset.id).filter(Boolean) }); }
    function setOpen(id) {
      openId = id; closeLadder();
      const now = new Set(byId.keys()); for (const gid of now) if (gid !== id && !(pinned.has(gid) && !shut.has(gid))) now.delete(gid);
      for (const [gid, g] of byId) { const on = now.has(gid); g.box.classList.toggle('gz-open', on); g.box.classList.toggle('gz-pinned', pinned.has(gid)); g.ar.textContent = on ? '▾' : '▸'; }
      if (cfg.onToggle && !first) { for (const gid of openSet) if (!now.has(gid)) cfg.onToggle(gid, false); for (const gid of now) if (!openSet.has(gid)) cfg.onToggle(gid, true); }
      openSet = now; first = false; save(); refresh();
    }
    function togglePin(id) {
      if (pinned.has(id)) pinned.delete(id); else pinned.add(id);
      shut.delete(id);
      setOpen(pinned.has(id) ? id : (openId === id ? null : openId));   // закрепил — группа открыта; открепил — сворачивается, если открыта не она
    }

    for (const g of groups) {
      const box = el('div', 'gz-group'); box.dataset.id = g.id; box.style.setProperty('--c', g.color || '#5aa9ff');
      const head = el('button', 'gz-hx gz-head'); head.type = 'button';
      const nm = el('span', 'gz-nm', g.title), ar = el('span', 'gz-ar');
      const pin = el('span', 'gz-pin'); pin.innerHTML = PIN; pin.title = 'Закрепить: не сворачивать при открытии другой группы';
      pin.addEventListener('pointerdown', e => e.stopPropagation());
      pin.addEventListener('click', e => { e.stopPropagation(); togglePin(g.id); });
      const rt = el('span', 'gz-hr'); rt.append(pin, ar);
      head.append(nm, rt); box.append(head); withTip(head, g.tip || '');
      const soty = el('div', 'gz-soty'), wide = el('div', 'gz-wide');
      const cells = [], secs = new Map();
      // «кнопки настроек каждого из потоков — под ним, каждый поток своим цветом»: it.sec — свой блок в широкой части группы:
      // первая широкая строка (ползунок с включателем) сверху, под ней соты блока, ниже остальные ползунки; it.secColor — цвет блока
      const secOf = it => { if (!it.sec) return null; let S = secs.get(it.sec);
        if (!S) { const box2 = el('div', 'gz-sec'); if (it.secColor) box2.style.setProperty('--c', it.secColor); S = { box: box2, top: el('div', 'gz-wide'), soty: el('div', 'gz-soty'), bot: el('div', 'gz-wide'), cells: [] }; box2.append(S.top, S.soty, S.bot); wide.append(box2); secs.set(it.sec, S); }
        return S; };
      for (const it of g.items) {
        const S = secOf(it), toSoty = b => { (S ? S.cells : cells).push(b); (S ? S.soty : soty).append(b); }, toWide = b => { if (S) (it.secHead ? S.top : S.bot).append(b); else wide.append(b); };   // it.secHead — строка-заголовок блока (ползунок потока), всегда сверху
        const b = el('div', 'gz-hx'); if (it.pan) b.dataset.pan = it.pan; b.tabIndex = 0; b.setAttribute('role', 'button'); withTip(b, it.tip || it.name); if (it.col != null) b.gzCol = it.col;
        if (it.type === 'control') {
          // Existing native fields retain typing, scrubbing, labels and page listeners.
          b.classList.add('gz-control'); b.removeAttribute('role'); b.removeAttribute('tabindex');
          b.append(it.node); toWide(b);
        } else if (it.type === 'value') {
          b.classList.add('gz-val');
          const a = (cls, t, d) => { const s = el('span', 'gz-a ' + cls, t); s.addEventListener('click', e => { e.stopPropagation(); it.step(d); refresh(); }); return s; };
          const mid = el('span', 'gz-mid'), v = el('span', 'gz-v'), z = el('span', 'gz-z', '0');
          z.title = 'Сбросить'; z.addEventListener('click', e => { e.stopPropagation(); it.reset && it.reset(); refresh(); });
          mid.append(el('span', 'gz-nm', it.name), v); if (it.reset) mid.append(z);
          b.append(a('gz-a2', '◂◂', -2), a('', '◂', -1), mid, a('', '▸', 1), a('gz-a2', '▸▸', 2));
          refreshers.push(() => { v.textContent = it.get(); });
          if (it.disabled) refreshers.push(() => b.classList.toggle('gz-off-dis', !!it.disabled()));   // значение бывает неактивным (Маятник: поля шаблона без шаблона)
          // «Автозум — объедини с его ползунком»: it.head — включатель слева в той же кнопке, it.tail — режим справа (виден, пока tail.show())
          if (it.head) { const h = el('span', 'gz-vh', it.head.label); b.prepend(h); b.classList.add('gz-vhd');
            h.addEventListener('click', e => { e.stopPropagation(); it.head.click(); refresh(); }); refreshers.push(() => { const on = !!it.head.on(); h.classList.toggle('gz-on', on); b.classList.toggle('gz-on', on); }); }   // «обводки нет при включённой» — включён: обводка всей кнопки, как у остальных
          if (it.tail) { const t = el('span', 'gz-vt', it.tail.label); b.append(t);
            t.addEventListener('click', e => { e.stopPropagation(); it.tail.click(); refresh(); });
            refreshers.push(() => { const sh = !it.tail.show || it.tail.show(); t.style.display = sh ? '' : 'none'; if (it.tail.on) t.classList.toggle('gz-on', !!it.tail.on()); const n = it.tail.labelNow ? it.tail.labelNow() : it.tail.label; if (t.textContent !== n) t.textContent = n; }); }
          // значение с frac() / setFrac(f) — ползунок: пунктирная дорожка, ромб-бегунок, число по центру; тянут по середине, ◂ ▸ — шаг
          if (it.frac && it.setFrac) {
            b.classList.add('gz-sl'); b.title = it.tip || it.name; const th = el('span', 'gz-th'), TH = 8; mid.prepend(th);
            // «числа до и после бегунка»: «96 / 128» — 96 слева от бегунка, 128 справа; у края число не уходит за дорожку
            const vl = el('span', 'gz-vl'), vr = el('span', 'gz-vr'); mid.append(vl, vr); b.classList.add('gz-sl2');
            // «проверь на тормоза»: рейка обновляется часто — без перемен ползунок ничего не пишет и не меряет (замер ширины заставлял браузер пересчитывать раскладку всей страницы)
            let seen = '';
            refreshers.push(() => { const f = Math.max(0, Math.min(1, it.frac())), t = String(it.get()), sig = f + '|' + t + '|' + tot.isConnected; if (sig === seen) return; seen = sig;
              th.style.left = 'calc(' + TH + 'px + ' + (f * 100) + '% - ' + (2 * TH * f) + 'px)'; mid.style.setProperty('--thx', th.style.left);
              const k = t.indexOf('/'), a = (k < 0 ? t : t.slice(0, k)).trim(), z = k < 0 ? '' : t.slice(k + 1).trim();
              if (vl.textContent !== a) vl.textContent = a; if (vr.textContent !== z) vr.textContent = z;
              const W = mid.clientWidth, x = TH + f * (W - 2 * TH), g = 10, lw = vl.offsetWidth, rw = vr.offsetWidth;
              // «общее из ползунка вообще удали, при наведении покажи слева от него»: в ползунке — только текущее (слева от бегунка, нет места — справа); общее — плашкой слева от кнопки
              vl.style.left = (x - g - lw >= 0 ? x - g - lw : Math.min(W - lw, x + g)) + 'px'; vr.style.display = 'none'; tot.textContent = z;
              if (tot.isConnected) { const r = b.getBoundingClientRect(); tot.style.left = (r.right + 4) + 'px'; tot.style.top = (r.top + r.height / 2) + 'px'; } });
            const tot = el('span', 'gz-total'); tot.style.setProperty('--c', g.color || '#5aa9ff');
            b.addEventListener('pointerenter', () => { if (!tot.textContent) return; document.body.append(tot); seen = ''; refresh(); });
            b.addEventListener('pointerleave', () => tot.remove());
            const at = e => { const r = mid.getBoundingClientRect(); it.setFrac(Math.max(0, Math.min(1, (e.clientX - r.left - TH) / Math.max(1, r.width - 2 * TH)))); refresh(); };   // «не схватывает бегунок, когда прижат влево»: ход бегунка — внутри дорожки, на TH от краёв
            mid.addEventListener('pointerdown', e => { if (e.button !== 0) return; e.preventDefault(); e.stopPropagation(); mid.setPointerCapture(e.pointerId); at(e);
              const mv = ev => at(ev), up = () => { mid.removeEventListener('pointermove', mv); mid.removeEventListener('pointerup', up); mid.removeEventListener('pointercancel', up); };
              mid.addEventListener('pointermove', mv); mid.addEventListener('pointerup', up); mid.addEventListener('pointercancel', up); });
            // 19.10: колесо над ползунком не трогает значение — прокручивает рейку («скрол вверх-вниз при переполнении»)
          }
          toWide(b);
        } else if (it.type === 'list') {
          b.classList.add('gz-list');
          const ic = icon(it.icon), v = el('span', 'gz-v');
          // compact — обычная кнопка в сотах: значок и текущий вариант, без названия (оно в подсказке)
          if (it.compact) { b.classList.add('gz-lc'); b.append(ic, v); } else b.append(ic, el('span', 'gz-nm', it.name), v, el('span', 'gz-ar', '▾'));
          refreshers.push(() => { const o = it.options.find(o => o.v === it.get()); v.textContent = o ? o.name : ''; });
          b.addEventListener('click', () => {
            if (ladder && ladder.owner === b) return closeLadder();
            closeLadder(); ladder = el('div', 'gz-ladder'); ladder.addEventListener('pointerdown', pressMark); ladder.owner = b; ladder.style.setProperty('--c', g.color || '#5aa9ff');
            const r = b.getBoundingClientRect();
            ladder.style.left = (r.right + 4) + 'px'; ladder.style.top = Math.max(4, Math.min(innerHeight - it.options.length * 27 - 4, r.top)) + 'px';
            for (const o of it.options) {
              const ob = el('div', 'gz-hx' + (o.v === it.get() ? ' gz-on' : '')); ob.append(icon(o.icon || '·'), el('span', 'gz-nm', o.name));
              ob.addEventListener('click', () => { it.set(o.v); closeLadder(); refresh(); }); ladder.append(ob);
            }
            document.body.append(ladder); dimUnder(b);
          });
          if (it.compact) toSoty(b); else toWide(b);
        } else if (it.type === 'pair') {
          // пара — одна кнопка, одна обводка, пополам: parts[i] = { label, tip, on(), click() | open(anchor), fill(), ink() }; it.cls — свой класс (gz-rainbow — обводка радугой)
          b.classList.add('gz-pair'); if (it.cls) b.classList.add(...it.cls.split(' '));
          const hs = it.parts.map((p, i) => { const h = el('span', 'gz-half gz-h' + i, p.label);   // gz-h0 / gz-h1 — не :first/:last-child: в кнопку дописывают свои метки if (p.tip) withTip(h, p.tip);
            h.addEventListener('click', e => { e.stopPropagation(); if (it.disabled && it.disabled()) return; if (p.open) p.open(b); else if (p.click) p.click(); refresh(); }); return h; });
          it.parts.forEach((p, i) => { if (p.wheel) hs[i].addEventListener('wheel', e => { if (p.wheel((e.deltaY < 0 ? 1 : -1) * (e.shiftKey ? 10 : 1))) { e.preventDefault(); e.stopPropagation(); refresh(); } }, { passive: false }); });   // p.wheel(d) — колесо над половиной (true — съедено)
          if (it.disabled) refreshers.push(() => b.classList.toggle('gz-off-dis', !!it.disabled()));   // пара тоже бывает притушена (правила потоков без потоков)
          // «в середине умести текст, а где 1 и 0 — там меньше; включение — как везде, обводкой граней»: [0 | название | 1], включённая сторона — яркая кайма своей половины
          b.append(hs[0], el('span', 'gz-pm', it.mid ?? it.name), hs[1]);
          refreshers.push(() => { if (it.one) b.classList.toggle('gz-one', !!it.one()); it.parts.forEach((p, i) => { if (p.labelNow) { const t = p.labelNow(); if (hs[i].textContent !== t) hs[i].textContent = t; } }); });   // labelNow — живая подпись половины   // it.one() — показывать одну левую половину во всю кнопку
          refreshers.push(() => it.parts.forEach((p, i) => { const on = !!(p.on && p.on()); hs[i].classList.toggle('gz-on', on); b.style.setProperty('--gz-r' + i, on ? 'var(--c)' : 'color-mix(in srgb,var(--c) 30%,#000)');
            const f = p.fill && p.fill(), k = p.ink && p.ink(); if (f && b.style.getPropertyValue('--gz-f' + i) !== f) b.style.setProperty('--gz-f' + i, f); if (k && hs[i].style.getPropertyValue('--gz-k') !== k) hs[i].style.setProperty('--gz-k', k); }));
          if (it.wide) { b.classList.add('gz-pw'); toWide(b); } else toSoty(b);   // it.wide — во всю ширину рейки, среди ползунков
        } else if (it.type === 'vpair') {
          // «Мин. строк и Мин. пар — в одну пополам»: два значения в одной кнопке, у каждой половины свои ◂ ▸
          b.classList.add('gz-val', 'gz-vp');
          it.parts.forEach((p, i) => {
            const h = el('span', 'gz-vph'), v = el('span', 'gz-v');
            const a = (t, d) => { const x = el('span', 'gz-a', t); x.addEventListener('click', e => { e.stopPropagation(); p.step(d); refresh(); }); return x; };
            h.append(a('◂', -1), el('span', 'gz-nm', p.name), v, a('▸', 1)); withTip(h, p.tip || p.name);
            h.addEventListener('wheel', e => { e.preventDefault(); e.stopPropagation(); p.step(e.deltaY < 0 ? 1 : -1); refresh(); }, { passive: false });
            refreshers.push(() => { const t = p.get(); if (v.textContent !== t) v.textContent = t; });
            if (i) b.append(el('span', 'gz-vps')); b.append(h); });
          toWide(b);
        } else if (it.type === 'color') {
          const sw = el('input', 'gz-color'); sw.type = 'color'; sw.title = it.tip || it.name;
          sw.addEventListener('input', () => { it.set(sw.value); refresh(); });
          if (it.open) sw.addEventListener('click', e => { e.preventDefault(); it.open(b); });   // своя палитра страницы (хаб): повторный щелчок её сворачивает
          const dot = el('span', 'gz-dot');
          b.append(icon(it.icon), el('span', 'gz-nm', it.name), dot, sw);
          refreshers.push(() => { const c = it.get(); if (document.activeElement !== sw) sw.value = c; dot.style.background = c; });
          toSoty(b);
        } else {
          const nm = el('span', 'gz-nm', it.name); b.append(icon(it.icon), nm);
          if (it.nameNow) refreshers.push(() => { const n = it.nameNow(); if (nm.textContent !== n) nm.textContent = n; });
          if (it.modes) { const md = el('span', 'gz-md'); b.append(md);
            refreshers.push(() => { const { n, i } = it.modes(); if (md.children.length !== n) md.replaceChildren(...Array.from({ length: n }, () => el('i'))); [...md.children].forEach((x, k) => x.classList.toggle('on', k === i)); }); }
          b.addEventListener('click', () => { if (it.disabled && it.disabled()) return; it.click && it.click(); refresh(); });
          if (it.type === 'toggle') refreshers.push(() => b.classList.toggle('gz-on', !!it.on()));
          if (it.disabled) refreshers.push(() => b.classList.toggle('gz-off-dis', !!it.disabled()));
          toSoty(b);
        }
        b.addEventListener('keydown', e => { if (e.target === b && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); b.click(); } });
      }
      // соты: столбец k%2; первый — сразу под шапкой, второй на полкнопки выше и заходит в выемку шапки и первого
      // (слово владельца 19.10: «второй ряд начинать выше», «между заголовком и первым ниже не должно быть пустоты»)
      const s = getComputedStyle(root), W = parseFloat(s.getPropertyValue('--gz-w')) || 120, H = parseFloat(s.getPropertyValue('--gz-h')) || 24, N = parseFloat(s.getPropertyValue('--gz-n')) || 12, DY = H + 3;
      let flat = false;   // в блоке потока столбцы ровные: правый не заходит на ползунок над ним
      const put = (b, col, row) => { b.style.left = (col * (W - N + 4)) + 'px'; b.style.top = (row * DY - (flat ? 0 : (col % 2) * DY / 2)) + 'px'; };
      const lay = (cells, soty) => {
      if (cells.some(b => b.gzCol != null)) {
        // свои столбцы (it.col: 0, 1, 2…) — каждый сверху вниз; нечётные на полкнопки выше (19.10, «Поток»: Свет · Вода · Снег — вторым, их списки — третьим)
        const n = []; let h = 0, mc = 0;
        cells.forEach(b => { const c = b.gzCol || 0, r = n[c] = (n[c] || 0); n[c]++; put(b, c, r); h = Math.max(h, (r + 1) * DY - (flat ? 0 : (c % 2) * DY / 2)); mc = Math.max(mc, c); });
        soty.style.height = (h - 3) + 'px'; soty.style.width = (mc * (W - N + 4) + W) + 'px';
      } else {
        cells.forEach((b, k) => put(b, k % 2, k >> 1));
        const rows = Math.ceil(cells.length / 2);
        soty.style.height = cells.length ? (rows * DY - 3) + 'px' : '0';
      } };
      lay(cells, soty);
      flat = true; for (const S of secs.values()) { if (S.cells.length) lay(S.cells, S.soty); else S.soty.remove(); if (!S.bot.children.length) S.bot.remove(); }
      if (cells.length) box.append(soty);
      if (wide.children.length) box.append(wide);
      root.append(box);
      byId.set(g.id, { box, ar });
      head.addEventListener('click', () => { if (head.dataset.dragged) { delete head.dataset.dragged; return; } if (openSet.has(g.id)) { if (pinned.has(g.id)) shut.add(g.id); setOpen(openId === g.id ? null : openId); } else if (pinned.has(g.id)) { shut.delete(g.id); setOpen(openId); } else setOpen(g.id); });   // 19.10: свернуть закреплённую — закреп остаётся; снять — только галкой
      dragHead(head, box);
    }

    // перетаскивание шапки меняет порядок групп в рейке
    function dragHead(head, box) {
      head.addEventListener('pointerdown', e => {
        if (e.button !== 0) return;
        const y0 = e.clientY; let slot = null, top0 = 0;
        const move = ev => {
          if (!slot && Math.abs(ev.clientY - y0) < 6) return;
          if (!slot) {   // 15.10: группа едет за курсором, на её месте — пунктирная щель
            const r = box.getBoundingClientRect(); top0 = r.top;
            slot = el('div', 'gz-slot'); box.after(slot); closeLadder(); tipHide();
            Object.assign(box.style, { position: 'fixed', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px' }); box.classList.add('gz-drag');
          }
          box.style.top = (top0 + ev.clientY - y0) + 'px';
          const after = [...root.querySelectorAll(':scope > .gz-group:not(.gz-drag)')].find(g => { const r = g.getBoundingClientRect(); return ev.clientY < r.top + 15; });
          if (after) after.before(slot); else root.append(slot);
        };
        const up = () => {
          removeEventListener('pointermove', move); removeEventListener('pointerup', up);
          if (!slot) return;
          slot.replaceWith(box); box.classList.remove('gz-drag'); for (const k of ['position', 'left', 'top', 'width']) box.style.removeProperty(k); head.dataset.dragged = '1'; setTimeout(() => delete head.dataset.dragged, 0); save();
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
     ZerkGrozd.adopt({ host, key, groups, items, title(g), color(g), fold(g, open), off(e) }) — off: кнопка сейчас не действует (скрыть) */
  const norm = s => String(s || '').replace(/\s+/g, ' ').trim();
  const longOf = e => norm(e.getAttribute('title') || e.dataset.zzTip || e.dataset.t0 || e.getAttribute('aria-label') || '');
  const hiddenEl = e => e.hidden || e.classList.contains('sfz-grape-hidden') || e.classList.contains('sfz-grape-empty') || e.style.display === 'none'
    || e.disabled || e.classList.contains('ldim') || (e.tagName === 'LABEL' && !!e.querySelector('input:disabled,select:disabled'));   // 15.10: неактивные («не действует») кнопки в рейке не показываются вовсе
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
    if (inp && inp.type === 'text') return { type: 'toggle', icon: iconOf(e), name, nameNow: () => name + ' ' + inp.value, tip,   // поле дроби (скорость Нарезки): щелчок — спросить новое значение
      on: () => false, disabled: () => inp.disabled, click: () => { const v = prompt(longOf(inp) || name, inp.value); if (v != null) { inp.value = v.trim(); fire(inp); } } };
    if (inp && inp.type === 'color') return { type: 'color', icon: iconOf(e), name, tip, get: () => inp.value, set: v => { inp.value = v; fire(inp); } };
    if (inp && inp.type === 'checkbox') return { type: 'toggle', icon: iconOf(e), name, tip, on: () => inp.checked, click: () => inp.click(), disabled: () => inp.disabled };
    // кнопка с надписью по кругу (data-labels): в рейке видно текущее положение — её нынешняя надпись без значка
    const cyc = () => { const t = norm(e.textContent).replace(/^[^\p{L}\p{N}]+/u, ''); return t.length > 16 ? t.slice(0, 15) + '…' : t; };
    const labs = e.dataset && e.dataset.labels ? e.dataset.labels.split('|').map(norm) : null;
    if (labs) return { type: 'toggle', icon: iconOf(e), name: cyc() || name, nameNow: () => cyc() || nameOf(e), tip,
      modes: () => ({ n: labs.length, i: labs.indexOf(norm(e.textContent)) }),   // 15.10: метки справа — сколько режимов и какой выбран
      on: () => e.matches('.on,.sel,.act,.active,[aria-pressed="true"]'), click: () => e.click(), disabled: () => !!e.disabled };
    return { type: 'toggle', icon: iconOf(e), name, nameNow: () => nameOf(e), tip,
      on: () => e.matches('.on,.sel,.act,.active,[aria-pressed="true"]'), click: () => e.click(), disabled: () => !!e.disabled };
  }
  function adopt(cfg) {
    const host = typeof cfg.host === 'string' ? document.querySelector(cfg.host) : cfg.host; if (!host) return null;
    const gid = g => g.dataset.g || g.id;
    const dock = el('div', 'gz-dock'); if (cfg.style) Object.assign(dock.style, cfg.style); host.append(dock);
    let cur = null, sig = '', live = [];
    const groupsNow = () => [...document.querySelectorAll(cfg.groups)].filter(g => !g.matches(cfg.skip || '.coff'));
    const itemsOf = g => [...g.querySelectorAll(cfg.items)].filter(e => !hiddenEl(e) && !(cfg.off && cfg.off(e)) && !e.closest('.gz-dock,.zerk-source-fan') && !(e.parentElement && e.parentElement.closest(cfg.items)));
    function build() {
      if (cfg.hide) for (const g of document.querySelectorAll(cfg.hide)) g.style.setProperty('display', 'none', 'important');   // группы, убранные со страницы совсем
      // панели без кнопок (подсказки, текст) — кнопкой в группе cfg.panelIn: включил — панель встаёт справа от кнопки
      const pans = cfg.panels ? [...document.querySelectorAll(cfg.panels)] : [];
      const all = groupsNow().filter(g => !pans.includes(g)), gs = all.map(g => ({ g, items: itemsOf(g) })).filter(x => x.items.length);
      const now = gs.map(x => gid(x.g) + ':' + x.items.map(uid).join(',')).join('|') + '|a:' + all.map(uid).join(',') + '|p:' + pans.map(uid).join(',');
      if (now === sig) return false; sig = now;
      if (cur) cur.destroy();
      for (const g of live) { g.classList.remove('gz-adopted'); g.style.removeProperty('display'); }
      live = [...all, ...pans]; for (const g of live) { g.classList.add('gz-adopted'); g.style.setProperty('display', 'none', 'important'); }
      // группа, где сейчас ничего не действует, в рейке не видна, но и на холсте спрятана
      cur = make(gs, pans);
      panelsNow();
      return true;
    }
    const shown = new Set(store.get('grozd-pan:' + cfg.key) || []);
    function showPanel(g, at) {
      if (!at) { g.classList.add('gz-adopted'); g.style.setProperty('display', 'none', 'important'); return; }
      const r = at.getBoundingClientRect();
      g.classList.remove('gz-adopted'); g.style.removeProperty('display'); if (cfg.fold && g.classList.contains('cmin')) cfg.fold(g, true);
      g.style.setProperty('position', 'fixed', 'important'); g.style.setProperty('z-index', '2147483641', 'important');
      g.style.setProperty('left', Math.max(4, Math.min(Math.max(r.right, ...[...(at.closest('.gz-group') || at).querySelectorAll('.gz-hx')].map(e => e.getBoundingClientRect().right)) + 6, innerWidth - g.offsetWidth - 4)) + 'px', 'important');
      const up = r.top > innerHeight / 2;   // в нижней половине экрана панель растёт вверх от кнопки (не ложится на пульт)
      g.style.setProperty('top', Math.max(4, Math.min(up ? r.bottom - g.offsetHeight : r.top, innerHeight - g.offsetHeight - 4)) + 'px', 'important');
    }
    const panelsNow = () => { if (!cfg.panels) return; for (const g of document.querySelectorAll(cfg.panels)) {
      const b = shown.has(gid(g)) && dock.querySelector('[data-pan="' + CSS.escape(gid(g)) + '"]');
      showPanel(g, b && b.getClientRects().length ? b : null); } };
    // у кнопки нет своего значка — значок по смыслу из menu-icons, в группе без повторов
    const withIcons = els => { const used = new Set(), mi = window.ZerkMenuIcons;
      return els.map(e => { const it = itemOf(e); if (!it.icon && it.type !== 'value' && mi && mi.iconFor) try { it.icon = mi.iconFor(e, used); } catch {} return it; }); };
    function make(gs, pans) {
      const panItem = g => ({ type: 'toggle', icon: g.dataset.gzIcon || '💬', name: g.dataset.gzName || (cfg.panelName ? cfg.panelName(g) : cfg.title(g)), tip: longOf(g) || cfg.title(g), pan: gid(g),
        on: () => shown.has(gid(g)), click: () => { shown.has(gid(g)) ? shown.delete(gid(g)) : shown.add(gid(g)); store.set('grozd-pan:' + cfg.key, [...shown]); panelsNow(); } });
      return rail(dock, { key: cfg.key, onToggle: (id, open) => { const x = gs.find(x => gid(x.g) === id); if (x && cfg.fold) cfg.fold(x.g, open); setTimeout(panelsNow); },
        groups: gs.map(x => ({ id: gid(x.g), title: cfg.title(x.g), color: cfg.color(x.g),
          items: [...withIcons(x.items), ...pans.filter(p => p.dataset.gzIn ? x.g.matches(p.dataset.gzIn) : !!cfg.panelIn && x.g.matches(cfg.panelIn)).map(panItem)] })) });   // панель со своим data-gz-in — в своей группе
    }
    build(); document.documentElement.classList.remove('gz-pre');   // рейка готова — старые грозди уже спрятаны, можно показывать страницу
    // свернуть все группы страницы, кроме открытой в рейке (3D-вид следует за группой «3D»)
    if (cfg.fold) { const open = new Set(cur ? [...dock.querySelectorAll('.gz-group.gz-open')].map(b => b.dataset.id) : []); for (const g of live) cfg.fold(g, open.has(gid(g))); }
    const help = () => { const b = cfg.helpButton && document.querySelector(cfg.helpButton); document.documentElement.classList.toggle('gz-help', !!b && b.classList.contains('on')); };
    setInterval(() => { help(); if (!build() && cur) cur.refresh(); panelsNow(); }, 400);
    return { dock, rebuild: () => { sig = ''; build(); } };
  }

  window.ZerkGrozd = { version: 11, rail, adopt };
})();
