/* Hub v0.210: все ползунки поля в одном виде (витрина knopki/hub-polzunki.html).
   Подписи слева нет — название в подсказке; значение на дорожке по центру; по краям шевроны ‹ ›
   (щелчок — шаг, удержание — подряд); бегунок — ромб цветом симметрии, дорожка — пунктир.
   Сам ползунок остаётся тем же input — прозрачным поверх дорожки, его обработчики не меняются. */
(() => {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const chev = d => { const s = document.createElementNS(NS, 'svg'); s.setAttribute('viewBox', '0 0 14 24'); const p = document.createElementNS(NS, 'path'); p.setAttribute('d', d < 0 ? 'M11 1L3 12l8 11' : 'M3 1l8 11-8 11'); s.append(p); return s; };
  const fire = (r, type) => r.dispatchEvent(new Event(type, { bubbles: true }));
  const items = [];
  function valueOf(r, host) {
    const o = host.querySelector('output') || r.closest('details')?.querySelector(':scope > summary output');
    const t = o?.textContent.trim();
    return t || r.value;
  }
  function wrap(r) {
    if (r.closest('.hubSl')) return;
    const host = r.closest('label') || r.parentElement;
    host.classList.add('hubSlHost'); host.title = r.getAttribute('aria-label') || host.title || '';
    const box = document.createElement('span'); box.className = 'hubSl';
    const tr = document.createElement('span'); tr.className = 'hubSlTr';
    const th = document.createElement('span'); th.className = 'hubSlTh';
    const val = document.createElement('span'); val.className = 'hubSlV';
    const mk = d => { const b = document.createElement('button'); b.type = 'button'; b.className = 'hubSlA'; b.setAttribute('aria-label', d < 0 ? 'Меньше' : 'Больше'); b.append(chev(d));
      let tm = null; const step = () => { const v = r.value; d < 0 ? r.stepDown() : r.stepUp(); if (r.value !== v) { fire(r, 'input'); fire(r, 'change'); } };
      const stop = () => { clearTimeout(tm); tm = null; };
      b.addEventListener('pointerdown', e => { if (e.button) return; e.preventDefault(); e.stopPropagation(); step(); tm = setTimeout(function rep() { step(); tm = setTimeout(rep, 60); }, 400); });
      b.addEventListener('pointerup', stop); b.addEventListener('pointerleave', stop); b.addEventListener('pointercancel', stop);
      b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); });
      return b; };
    r.before(box); tr.append(r, th, val); box.append(mk(-1), tr, mk(1));
    const it = { r, host, th, val, last: '' }; items.push(it); paint(it);
    r.addEventListener('input', () => requestAnimationFrame(() => paint(it)));
  }
  function paint(it) {
    const { r, host, th, val } = it, mn = +r.min || 0, mx = +r.max || 100, k = mx > mn ? (r.value - mn) / (mx - mn) : 0;
    const key = r.value + '|' + k;
    th.style.left = 'calc(8px + ' + k + ' * (100% - 16px))';
    const t = valueOf(r, host); if (t !== val.textContent) val.textContent = t;
    it.last = key;
  }
  function scan() { document.querySelectorAll('#hubFieldTools input[type=range]').forEach(wrap); items.forEach(paint); }
  const start = () => { scan(); setInterval(scan, 400); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(start, 40), { once: true });
  else setTimeout(start, 40);
})();
