/* Hub v0.223: «на мобильной версии кнопки отдельно и холст отдельно, и переключать (кроме пульта)».
   На узком экране (≤ 1100 px) — два вида: «Холст» (рисунок, пульт у креста, корзина) и «Кнопки» (группы поля на сплошном фоне).
   Переключатель — ромб в правом верхнем углу; выбор помнится (zerk_hub_mob_view). */
(() => {
  'use strict';
  const KEY = 'zerk_hub_mob_view', mq = matchMedia('(max-width:1100px)');
  let view = 'canvas';
  try { if (localStorage.getItem(KEY) === 'buttons') view = 'buttons'; } catch (_) {}
  const shade = document.createElement('div'); shade.id = 'hubMobShade';
  const btn = document.createElement('button'); btn.type = 'button'; btn.id = 'hubMobSwitch'; btn.className = 'hubRhomb';
  function sync() {
    const b = mq.matches && view === 'buttons';
    document.body.classList.toggle('hubMobButtons', b);
    document.body.classList.toggle('hubMobCanvas', mq.matches && !b);
    btn.innerHTML = b ? '<i>◇</i>Холст' : '<i>☰</i>Кнопки';
    btn.title = b ? 'Показать холст' : 'Показать кнопки';
    btn.setAttribute('aria-label', btn.title); btn.setAttribute('aria-pressed', String(b));
    if (b) window.scrollTo(0, 0);
  }
  btn.onclick = () => { view = view === 'buttons' ? 'canvas' : 'buttons'; try { localStorage.setItem(KEY, view); } catch (_) {} sync(); dispatchEvent(new Event('resize')); };
  const init = () => { document.body.append(shade, btn); sync(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
  mq.addEventListener?.('change', sync);
  // Hub v0.258: «мобильная — наложение кнопок». Пульт поля (крест, «Вращ.», ромбы движения, ось, «Дзен») — position: fixed
  // и при прокрутке к кнопкам страниц ложился поверх них. Прокрутил вниз — пульт прячется, вернулся к холсту наверх — появляется.
  let scrolled = false;
  const onScroll = () => { const s = mq.matches && scrollY > 40; if (s !== scrolled) { scrolled = s; document.body.classList.toggle('hubMobScrolled', s); } };
  addEventListener('scroll', onScroll, { passive: true }); mq.addEventListener?.('change', onScroll); onScroll();
})();
