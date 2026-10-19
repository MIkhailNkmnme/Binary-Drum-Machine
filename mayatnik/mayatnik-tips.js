/* Маятник v0.167: «подсказки показывай рядом с кнопками, но с задержкой 4 секунды».
   Системная подсказка (title) снимается с элемента на время наведения; если курсор простоял на нём 4 с — плашка рядом с кнопкой
   (справа, не влезает — слева; по высоте — вровень с кнопкой). Уход, щелчок, прокрутка — плашка прячется. При «?» (gz-help) —
   прежние подсказки рейки сразу, эта плашка не показывается. */
(() => {
  'use strict';
  const DELAY = 4000;
  const box = document.createElement('div'); box.id = 'mayTip'; box.hidden = true; box.setAttribute('role', 'tooltip');
  let cur = null, timer = 0, obs = null;
  const strip = el => { const t = el.getAttribute('title'); if (t != null) { if (t) el.dataset.mayTip = t; el.removeAttribute('title'); } };
  const giveBack = el => { if (el && el.dataset.mayTip != null && !el.hasAttribute('title')) el.setAttribute('title', el.dataset.mayTip); };
  const hide = () => { clearTimeout(timer); timer = 0; box.hidden = true; obs?.disconnect(); obs = null; giveBack(cur); cur = null; };
  function show() {
    if (!cur || !cur.isConnected || document.documentElement.classList.contains('gz-help')) return;
    const text = cur.dataset.mayTip; if (!text) return;
    box.textContent = text; box.hidden = false;
    const r = cur.getBoundingClientRect(), w = box.offsetWidth, h = box.offsetHeight;
    let x = r.right + 8; if (x + w > innerWidth - 6) x = r.left - w - 8; if (x < 6) x = Math.max(6, Math.min(innerWidth - w - 6, r.left));
    let y = r.top + r.height / 2 - h / 2; if (x + w > r.left && x < r.right) y = r.bottom + 6;   // не влезла ни справа, ни слева — под кнопкой
    y = Math.max(6, Math.min(innerHeight - h - 6, y));
    box.style.left = Math.round(x) + 'px'; box.style.top = Math.round(y) + 'px';
  }
  document.addEventListener('pointerover', e => {
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
