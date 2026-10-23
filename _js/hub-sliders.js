/* Hub v0.421 (ПЛ01/ПЛ02): шестиугольник, шевроны 8 px, ромб делится при наведении.
   Hub v0.210: все ползунки поля в одном виде (витрина knopki/hub-polzunki.html).
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
    const th = document.createElement('i'); th.className = 'hubSlTh'; const tv = document.createElement('b'); th.append(tv);
    const val = document.createElement('span'); val.className = 'hubSlV';
    const mk = d => { const b = document.createElement('button'); b.type = 'button'; b.className = 'hubSlA'; b.setAttribute('aria-label', d < 0 ? 'Меньше' : 'Больше');
      let tm = null; const step = () => { const v = r.value; d < 0 ? r.stepDown() : r.stepUp(); if (r.value !== v) { fire(r, 'input'); fire(r, 'change'); } };
      const stop = () => { clearTimeout(tm); tm = null; };
      b.addEventListener('pointerdown', e => { if (e.button) return; e.preventDefault(); e.stopPropagation(); b.classList.remove('echo'); void b.offsetWidth; b.classList.add('echo'); step(); tm = setTimeout(function rep() { step(); tm = setTimeout(rep, 60); }, 400); });
      b.addEventListener('pointerup', stop); b.addEventListener('pointerleave', stop); b.addEventListener('pointercancel', stop);
      b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); });
      return b; };
    r.before(box); tr.append(r, th, val); box.append(mk(-1), tr, mk(1));
    const it = { r, host, th, tv, tr, val, last: '' }; items.push(it); paint(it);
    r.addEventListener('input', () => requestAnimationFrame(() => paint(it)));
  }
  function paint(it) {
    const { r, host, th, val } = it, mn = +r.min || 0, mx = +r.max || 100, k = mx > mn ? (r.value - mn) / (mx - mn) : 0;
    const key = r.value + '|' + k;
    const x = it.tr.clientWidth * k; th.style.left = x + 'px'; it.tr.style.setProperty('--tx', x + 'px');
    const t = valueOf(r, host); if (t !== val.textContent) val.textContent = t; if (t !== it.tv.textContent) it.tv.textContent = t;
    it.last = key;
  }
  document.addEventListener('animationend', e => { if (e.animationName === 'hubSlEcho') e.target.classList.remove('echo'); });
  // ПЛ01: press on the thumb (±4 px) takes it before chevrons: drag from the grab point, no jump
  document.addEventListener('pointerdown', e => {
    if (e.button !== 0) return; const sl = e.target.closest?.('.hubSl'); if (!sl) return;
    const d = sl.querySelector('.hubSlTh'), input = sl.querySelector('input[type=range]'); if (!d || !input) return;
    const r = d.getBoundingClientRect(); if (e.clientX < r.left - 4 || e.clientX > r.right + 4 || e.clientY < r.top || e.clientY > r.bottom) return;
    e.preventDefault(); e.stopPropagation();
    const tr = input.parentElement, mn = +input.min || 0, mx = +input.max || 100, st = +input.step || 1, px = tr.clientWidth / (mx - mn), x0 = e.clientX, v0 = +input.value;
    const move = ev => { let v = v0 + (ev.clientX - x0) / px; v = Math.max(mn, Math.min(mx, mn + Math.round((v - mn) / st) * st)); if (v !== +input.value) { input.value = String(v); fire(input, 'input'); } };
    const up = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up); fire(input, 'change'); };
    addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', up); input.focus({ preventScroll: true });
  }, true);
  function scan() { document.querySelectorAll('#hubFieldTools input[type=range]').forEach(wrap); items.forEach(paint); }
  const start = () => { scan(); setInterval(scan, 400); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(start, 40), { once: true });
  else setTimeout(start, 40);
})();
