/* Маятник v0.141: «Кнопки в окне» — в дзене все кнопки страницы (шапка, левая и правая рейки) в отдельном окне браузера.
   Окно показывает копии; щелчок, ввод и выбор в копии уходят в настоящий элемент страницы, а копия пересобирается
   по изменениям страницы (MutationObserver). Сама страница при этом остаётся в дзене, поле — на весь экран. */
(function () {
  const $ = id => document.getElementById(id);
  const SRC = () => [document.querySelector('body > header'), $('mayatnikSidebar') || $('mayatnikRail'), $('mayatnikRailR')].filter(Boolean);
  let win = null, map = new WeakMap(), mo = null, timer = 0;
  const open = () => win && !win.closed;

  function head() {
    let h = '<meta charset="UTF-8"><title>Маятник — кнопки</title>';
    for (const n of document.querySelectorAll('link[rel="stylesheet"], style')) h += n.tagName === 'LINK' ? `<link rel="stylesheet" href="${n.href}">` : `<style>${n.textContent}</style>`;
    // В окне нет поля: колонки страницы не нужны, рейки — в потоке, окно листается.
    h += `<style>
      html,body{height:auto!important;min-height:100%;overflow:auto!important}
      body{display:block!important;margin:0;background:#0d1119}
      body>header{position:static!important}
      #zwRow{display:flex;align-items:flex-start;gap:8px}
      #zwRow>*{display:block!important;position:relative!important;inset:auto!important;max-height:none!important;height:auto!important;overflow:visible!important;pointer-events:auto!important}
      #zwRow *{pointer-events:auto}
      #mayatnikRail{display:block!important}
      #mayZenOut,#mayZenWin{display:none!important}
      #zwRow,#zwRow *{max-height:none!important}
      canvas{display:none!important}
    </style>`;
    return h;
  }
  // Копия с той же структурой; пары «копия → оригинал» и текущие значения полей (их cloneNode не переносит).
  function copy(src) {
    const c = src.cloneNode(true), a = [src, ...src.querySelectorAll('*')], b = [c, ...c.querySelectorAll('*')];
    for (let i = 0; i < a.length && i < b.length; i++) {
      map.set(b[i], a[i]);
      if (a[i] instanceof HTMLInputElement) { b[i].checked = a[i].checked; b[i].value = a[i].value; }
      else if (a[i] instanceof HTMLSelectElement) b[i].selectedIndex = a[i].selectedIndex;
      else if (a[i] instanceof HTMLTextAreaElement) b[i].value = a[i].value;
    }
    return c;
  }
  function build() {
    if (!open()) return;
    const d = win.document, f = d.activeElement;
    if (f && /^(INPUT|TEXTAREA)$/.test(f.tagName) && f.type !== 'checkbox' && f.type !== 'range') { later(); return; }   // не мешать набору
    const y = d.scrollingElement ? d.scrollingElement.scrollTop : 0;
    map = new WeakMap();
    const [h, ...rails] = SRC(), row = d.createElement('div'); row.id = 'zwRow';
    for (const r of rails) row.append(copy(r));
    d.body.className = document.body.className.replace(/\bmay-zen\b/, '');
    d.body.replaceChildren(...(h ? [copy(h)] : []), row);
    if (d.scrollingElement) d.scrollingElement.scrollTop = y;
  }
  function later() { clearTimeout(timer); timer = setTimeout(build, 80); }

  function forward(e) {
    let n = e.target;
    while (n && !map.has(n)) n = n.parentElement;
    const o = n && map.get(n);
    if (!o) return;
    if (e.type === 'click') {
      if (n instanceof HTMLInputElement && (n.type === 'checkbox' || n.type === 'radio')) return;   // их ведёт change
      if (n instanceof HTMLSelectElement || n instanceof HTMLInputElement && n.type !== 'button' && n.type !== 'submit') return;
      if (n.tagName === 'LABEL' && n.control) return;   // подпись сама переключит своё поле в копии — дальше его change
      e.preventDefault();
      o.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window, button: e.button, shiftKey: e.shiftKey, ctrlKey: e.ctrlKey, altKey: e.altKey }));
      later();
      return;
    }
    // input / change: значение в оригинал и то же событие
    if (n instanceof HTMLInputElement && (n.type === 'checkbox' || n.type === 'radio')) { if (e.type !== 'change') return; o.click(); later(); return; }
    if ('value' in n) o.value = n.value;
    o.dispatchEvent(new Event(e.type, { bubbles: true }));
    if (e.type === 'change') later();
  }

  function toggle() {
    if (open()) { win.focus(); return; }
    win = window.open('', 'mayatnikKnopki', 'width=560,height=760');
    if (!win) return;
    const d = win.document;
    d.open(); d.write(`<!DOCTYPE html><html lang="ru"><head>${head()}</head><body></body></html>`); d.close();
    for (const t of ['click', 'input', 'change']) d.addEventListener(t, forward, true);
    win.addEventListener('beforeunload', () => { if (mo) mo.disconnect(); mo = null; });
    mo = new MutationObserver(later);
    for (const s of SRC()) mo.observe(s, { subtree: true, childList: true, attributes: true, characterData: true });
    build();
  }
  addEventListener('pagehide', () => { if (open()) win.close(); });
  // Кнопка — рядом с ◎ выхода из дзена, видна только в дзене.
  const b = document.createElement('button');
  b.id = 'mayZenWin'; b.className = 'gz-hx'; b.title = 'Кнопки в окне: все кнопки страницы в отдельном окне, поле остаётся в дзене';
  b.innerHTML = '<span>◫</span>';
  b.addEventListener('click', toggle);
  ($('mayZenOut') || document.body).after(b);
  window.mayatnikZenWindow = { toggle, build };
})();
