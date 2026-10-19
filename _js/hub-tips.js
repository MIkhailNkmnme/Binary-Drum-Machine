/* Hub v0.218: подсказки кнопок поля — не поверх кнопок, а рядом, в свободном месте сбоку от раскрытой группы.
   Системная подсказка (title) снимается с элемента на время наведения и показывается своей плашкой. */
(() => {
  'use strict';
  const SCOPE = '#hubRail,#hubFieldTools,#hubZoom,.hubRombGrid,#hubZenToggle,#hubSidebarToggle,.hub,.hubColorEditor';   // v0.251: и кнопки страниц, и окно цвета
  const box = document.createElement('div'); box.id = 'hubTip'; box.hidden = true;
  let cur = null;
  // title снимается только на время наведения и возвращается при уходе: другие модули ищут кнопки по нему.
  const tipOf = el => { if (el.hasAttribute('title')) { el.dataset.hubTip = el.getAttribute('title'); el.removeAttribute('title'); } return el.dataset.hubTip || ''; };
  const giveBack = el => { if (el && el.dataset.hubTip != null && !el.hasAttribute('title')) el.setAttribute('title', el.dataset.hubTip); if (el) delete el.dataset.hubTip; };
  function area(el) {
    const slot = el.closest('.hubFieldSlot');
    const nodes = slot ? [...slot.querySelectorAll(':scope > .hubTreeItem:not([hidden])')] : [el.closest('#hubZoom,.hubRombGrid,.gz-group') || el];
    let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
    for (const n of nodes) { const q = n.getBoundingClientRect(); if (!q.width) continue; l = Math.min(l, q.left); t = Math.min(t, q.top); r = Math.max(r, q.right); b = Math.max(b, q.bottom); }
    return { l, t, r, b };
  }
  // 19.10: «подсказки показывай рядом с кнопками, но с задержкой 4 секунды» — title снимается сразу (системная не всплывёт),
  // плашка — через 4 с наведения, сбоку от кнопки (у рейки — правее всей рейки), не влезает — с другой стороны.
  const DELAY = 4000; let timer = 0;
  function show(el) {
    const text = tipOf(el); if (!text) { hide(); return; }
    if (cur !== el) giveBack(cur);
    cur = el; box.hidden = true; clearTimeout(timer);
    timer = setTimeout(() => { if (cur !== el || !el.isConnected) return; box.textContent = tipOf(el); box.hidden = false; place(); }, DELAY);
  }
  function place() {
    if (!cur || box.hidden) return;
    const q = cur.getBoundingClientRect(), side = cur.closest('#hubRail,.gz-ladder')?.getBoundingClientRect() || q, w = box.offsetWidth, h = box.offsetHeight;
    let x = Math.max(q.right, side.right) + 8; if (x + w > innerWidth - 4) x = Math.min(q.left, side.left) - w - 8;
    if (x < 4) { x = Math.max(4, Math.min(innerWidth - w - 4, q.left + q.width / 2 - w / 2)); var y = q.bottom + 8 + h > innerHeight - 4 ? q.top - h - 8 : q.bottom + 8; }
    else y = q.top + q.height / 2 - h / 2;
    y = Math.max(4, Math.min(innerHeight - h - 4, y));
    box.style.left = Math.round(x) + 'px'; box.style.top = Math.round(y) + 'px';
  }
  function hide() { clearTimeout(timer); giveBack(cur); cur = null; box.hidden = true; }
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
