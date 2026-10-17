/* Hub v0.218: подсказки кнопок поля — не поверх кнопок, а рядом, в свободном месте сбоку от раскрытой группы.
   Системная подсказка (title) снимается с элемента на время наведения и показывается своей плашкой. */
(() => {
  'use strict';
  const SCOPE = '#hubFieldTools,#hubZoom,#hubRombGrid,#hubZenToggle,#hubSidebarToggle';
  const box = document.createElement('div'); box.id = 'hubTip'; box.hidden = true;
  let cur = null;
  // title снимается только на время наведения и возвращается при уходе: другие модули ищут кнопки по нему.
  const tipOf = el => { if (el.hasAttribute('title')) { el.dataset.hubTip = el.getAttribute('title'); el.removeAttribute('title'); } return el.dataset.hubTip || ''; };
  const giveBack = el => { if (el && el.dataset.hubTip != null && !el.hasAttribute('title')) el.setAttribute('title', el.dataset.hubTip); if (el) delete el.dataset.hubTip; };
  function area(el) {
    const slot = el.closest('.hubFieldSlot');
    const nodes = slot ? [...slot.querySelectorAll(':scope > .hubTreeItem:not([hidden])')] : [el.closest('#hubZoom,#hubRombGrid') || el];
    let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
    for (const n of nodes) { const q = n.getBoundingClientRect(); if (!q.width) continue; l = Math.min(l, q.left); t = Math.min(t, q.top); r = Math.max(r, q.right); b = Math.max(b, q.bottom); }
    return { l, t, r, b };
  }
  function show(el) {
    const text = tipOf(el); if (!text) { hide(); return; }
    if (cur !== el) giveBack(cur);
    cur = el; box.textContent = text; box.hidden = false;
    // v0.225: «подсказка скрывает кнопки» — под всей раскрытой группой; место пересчитывается, когда группа уже раскрылась.
    place(); requestAnimationFrame(() => requestAnimationFrame(place)); setTimeout(place, 250);
  }
  function place() {
    if (!cur) return;
    const a = area(cur), q = cur.getBoundingClientRect(), w = box.offsetWidth, h = box.offsetHeight;
    const x = Math.max(8, Math.min(innerWidth - w - 8, q.left + q.width / 2 - w / 2));
    let y = a.b + 8; if (y + h > innerHeight - 4) y = Math.max(4, a.t - h - 8);
    // v0.244: «не перекрывать кнопки подсказками» — группы теперь стоят вплотную, поэтому плашка встаёт ниже ВСЕХ кнопок и открытых
    // ползунков, что приходятся на её ширину, а не только своей группы.
    if (cur.closest('#hubFieldTools')) {
      let low = a.b;
      for (const n of document.querySelectorAll('#hubFieldTools .hubTreeItem:not([hidden]), #hubFieldTools details[open] > label')) {
        const r = n.getBoundingClientRect(); if (!r.width || r.right < x - 4 || r.left > x + w + 4 || r.top > innerHeight) continue; low = Math.max(low, r.bottom);
      }
      y = Math.min(low + 8, innerHeight - h - 4);
    }
    box.style.left = Math.round(x) + 'px'; box.style.top = Math.round(y) + 'px';
  }
  function hide() { giveBack(cur); cur = null; box.hidden = true; }
  document.addEventListener('pointerover', e => {
    if (e.pointerType === 'touch') return;
    const el = e.target.closest?.('[title]') || (cur?.contains(e.target) ? cur : null);
    if (!el || !el.closest(SCOPE)) { if (cur && !cur.contains(e.target)) hide(); return; }
    if (el !== cur) show(el);
  });
  document.addEventListener('pointerdown', hide, true);
  addEventListener('scroll', hide, true);
  // Модули переписывают title на лету — у наведённой кнопки сразу переносим его в плашку, чтобы системная подсказка не всплывала.
  new MutationObserver(() => { if (cur?.hasAttribute('title')) box.textContent = tipOf(cur); })
    .observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['title'] });
  const init = () => document.body.append(box);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();
