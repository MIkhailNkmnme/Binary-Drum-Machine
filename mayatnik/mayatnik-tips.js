/* Маятник v0.167: «подсказки показывай рядом с кнопками, но с задержкой 4 секунды».
   Системная подсказка (title) снимается с элемента на время наведения; если курсор простоял на нём 4 с — плашка рядом с кнопкой
   (справа, не влезает — слева; по высоте — вровень с кнопкой). Уход, щелчок, прокрутка — плашка прячется. При «?» (gz-help) —
   прежние подсказки рейки сразу, эта плашка не показывается. */
(() => {
  'use strict';
  const DELAY = 4000;
  // Horizontal menus keep their tips on the field side of the entire button strip.
  // The shared rail calls the same placement in help mode.
  window.MayatnikPlaceMenuTip = (owner, tip) => {
    tip.style.maxHeight = ''; tip.style.overflow = '';
    const dock = owner.closest('[data-dock-edge]');
    const host = owner.closest('#mayFooterBar,#mayMobileBar,body>header');
    const edge = document.body.classList.contains('may-mobile-menu') && host?.id === 'mayMobileBar'
      ? 'top' : dock?.dataset.dockEdge || (host ? (host.id === 'mayFooterBar' ? 'bottom' : 'top') : '');
    if (edge !== 'top' && edge !== 'bottom') return false;
    const strip = edge === 'bottom' ? document.getElementById('mayFooterBar')
      : host?.id === 'mayMobileBar' ? host : document.querySelector('body>header');
    const r = owner.getBoundingClientRect(), w = tip.offsetWidth;
    const x = Math.max(4, Math.min(innerWidth - w - 4, r.left));
    let boundary = edge === 'top' ? r.bottom : r.top;
    const roots = new Set([strip, ...document.querySelectorAll(`[data-dock-edge="${edge}"]`)]);
    for (const root of roots) {
      if (!root) continue;
      for (const node of [root, ...root.querySelectorAll('button,input,select,.gz-hx,.pt-l,.gz-head,.gz-control')]) {
        const nodeEdge = node.closest('[data-dock-edge]')?.dataset.dockEdge;
        if (nodeEdge && nodeEdge !== edge || !node.getClientRects().length || getComputedStyle(node).visibility === 'hidden') continue;
        const b = node.getBoundingClientRect();
        if (!b.width || !b.height || b.right <= x || b.left >= x + w) continue;
        boundary = edge === 'top' ? Math.max(boundary, b.bottom) : Math.min(boundary, b.top);
      }
    }
    const available = Math.max(0, edge === 'top' ? innerHeight - boundary - 10 : boundary - 10);
    tip.style.maxHeight = available + 'px'; tip.style.overflow = 'hidden';
    const y = edge === 'top' ? boundary + 6 : boundary - tip.offsetHeight - 6;
    tip.style.left = Math.round(x) + 'px'; tip.style.top = Math.round(y) + 'px';
    return true;
  };
  const box = document.createElement('div'); box.id = 'mayTip'; box.hidden = true; box.setAttribute('role', 'tooltip');
  let cur = null, timer = 0, obs = null;
  const strip = el => { const t = el.getAttribute('title'); if (t != null) { if (t) el.dataset.mayTip = t; el.removeAttribute('title'); } };
  const giveBack = el => { if (el && el.dataset.mayTip != null && !el.hasAttribute('title')) el.setAttribute('title', el.dataset.mayTip); };
  const hide = () => { clearTimeout(timer); timer = 0; box.hidden = true; obs?.disconnect(); obs = null; giveBack(cur); cur = null; };
  function show() {
    if(cur?.closest('[data-no-tooltips]'))return;
    if (!cur || !cur.isConnected || document.documentElement.classList.contains('gz-help')) return;
    const text = cur.dataset.mayTip; if (!text) return;
    box.textContent = text; box.hidden = false;
    if (window.MayatnikPlaceMenuTip(cur, box)) return;
    const r = cur.getBoundingClientRect(), w = box.offsetWidth, h = box.offsetHeight;
    let x = r.right + 8; if (x + w > innerWidth - 6) x = r.left - w - 8; if (x < 6) x = Math.max(6, Math.min(innerWidth - w - 6, r.left));
    let y = r.top + r.height / 2 - h / 2; if (x + w > r.left && x < r.right) y = r.bottom + 6;   // не влезла ни справа, ни слева — под кнопкой
    y = Math.max(6, Math.min(innerHeight - h - 6, y));
    box.style.left = Math.round(x) + 'px'; box.style.top = Math.round(y) + 'px';
  }
  document.addEventListener('pointerover', e => {
    if(e.target.closest?.('[data-no-tooltips]')){hide();return;}
    if (e.pointerType === 'touch') return;
    const el = e.target.closest?.('[title],[data-may-tip]'); if (el === cur) return;
    hide(); if (!el || el === document.documentElement || el.closest('#mayTip')) return;
    cur = el; strip(el);
    obs = new MutationObserver(() => { if (cur && cur.hasAttribute('title')) strip(cur); if (!box.hidden) show(); });   // страница переписывает title на ходу
    obs.observe(el, { attributes: true, attributeFilter: ['title'] });
    timer = setTimeout(show, DELAY);
  }, true);
  document.addEventListener('pointerout', e => { if (cur && !cur.contains(e.relatedTarget)) hide(); }, true);
  for (const t of ['pointerdown', 'wheel', 'keydown']) document.addEventListener(t, () => { if (cur) { clearTimeout(timer); box.hidden = true; timer = setTimeout(show, DELAY); } }, true);
  addEventListener('scroll', () => { if (!box.hidden) hide(); }, true);
  const init = () => document.body.append(box);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();
