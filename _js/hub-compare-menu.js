/* v2 (Хаб v0.465). Правый треугольник — сравнение (вид, цвета, статистика).
   Левый треугольник — меню страниц: на компьютере оно выпадает из треугольника по наведению
   (с задержкой, чтобы не мигало), щелчок закрепляет, Esc и щелчок мимо закрывают; на телефоне
   треугольник прокручивает страницу к меню, потому что там меню стоит в потоке.
   Меню лежит в разметке ниже этого файла, поэтому ищем его по требованию. */
(() => {
  'use strict';
  const NARROW = '(max-width:1100px)';
  const narrow = () => matchMedia(NARROW).matches;
  const menuEl = () => document.getElementById('hubSidebarMenu');
  const drawers = [...document.querySelectorAll('.hubCompareDrawer')].filter(drawer => drawer.querySelector('.hubCompareDrawerBody'));
  const menuHandle = document.getElementById('hubMenuHandle');
  let keyboard = false, pinned = false, closeTimer = 0, openTimer = 0;

  function openDrawer(drawer, value) {
    drawer.toggleAttribute('data-open', value);
    drawer.querySelector('.hubCompareHandle').setAttribute('aria-expanded', String(value));
    drawer.querySelector('.hubCompareDrawerBody').inert = !value;
  }
  function closeDrawers() { drawers.forEach(drawer => openDrawer(drawer, false)); }

  drawers.forEach(drawer => {
    const handle = drawer.querySelector('.hubCompareHandle');
    drawer.addEventListener('pointerenter', event => { if (event.pointerType !== 'touch') openDrawer(drawer, true); });
    drawer.addEventListener('pointerleave', event => { if (event.pointerType !== 'touch' && !keyboard) openDrawer(drawer, false); });
    drawer.addEventListener('focusin', () => { if (keyboard) openDrawer(drawer, true); });
    drawer.addEventListener('focusout', event => { if (!drawer.contains(event.relatedTarget)) openDrawer(drawer, false); });
    handle.addEventListener('click', () => openDrawer(drawer, !drawer.hasAttribute('data-open')));
  });

  function menuOpen() { return document.body.classList.contains('hubMenuOpen'); }
  function openMenu() {
    clearTimeout(openTimer); openTimer = 0;
    clearTimeout(closeTimer); closeTimer = 0;
    const menu = menuEl();
    if (narrow() || !menu) return;
    wireMenu(menu);
    document.body.classList.add('hubMenuOpen');
    menuHandle?.setAttribute('aria-expanded', 'true');
  }
  function closeMenu() {
    clearTimeout(openTimer); openTimer = 0;
    clearTimeout(closeTimer); closeTimer = 0;
    pinned = false;
    document.body.classList.remove('hubMenuOpen');
    menuHandle?.setAttribute('aria-expanded', 'false');
  }
  function closeSoon() {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => { if (!pinned) closeMenu(); }, 260);
  }
  // меню появляется в разметке после этого файла — подписываемся, как только оно есть
  function wireMenu(menu = menuEl()) {
    if (!menu || menu.dataset.hubMenuWired) return;
    menu.dataset.hubMenuWired = '1';
    menu.addEventListener('pointerenter', () => {
      if (pinned) return;
      clearTimeout(closeTimer); closeTimer = 0;
      openMenu();
    });
    menu.addEventListener('pointerleave', event => {
      if (event.pointerType !== 'touch' && !pinned) closeSoon();
    });
    menu.addEventListener('focusin', () => { if (keyboard) openMenu(); });
  }
  wireMenu();
  document.addEventListener('DOMContentLoaded', () => wireMenu());

  if (menuHandle) {
    menuHandle.addEventListener('pointerenter', event => {
      if (event.pointerType === 'touch') return;
      clearTimeout(closeTimer); closeTimer = 0;
      if (!menuOpen() && !openTimer) openTimer = setTimeout(openMenu, 110);
    });
    menuHandle.addEventListener('pointerleave', event => {
      if (event.pointerType === 'touch') return;
      clearTimeout(openTimer); openTimer = 0;
      if (!pinned) closeSoon();
    });
    menuHandle.addEventListener('click', event => {
      if (narrow()) { event.preventDefault(); menuEl()?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
      if (menuOpen() && pinned) { closeMenu(); return; }
      pinned = true;
      openMenu();
    });
  }

  document.addEventListener('keydown', event => {
    keyboard = true;
    if (event.key !== 'Escape') return;
    if (menuOpen()) { closeMenu(); menuHandle?.focus(); }
    const active = document.activeElement?.closest?.('.hubCompareDrawer');
    active?.querySelector('.hubCompareHandle').focus();
    closeDrawers();
  });
  document.addEventListener('pointerdown', event => {
    keyboard = false;
    if (!event.target.closest?.('.hubCompareDrawer')) closeDrawers();
    if (menuOpen() && !event.target.closest?.('#hubSidebarMenu,#hubMenuHandle')) closeMenu();
  });
  document.getElementById('hubCompareZen')?.addEventListener('click', () => { closeDrawers(); closeMenu(); });
  window.addEventListener('blur', () => { closeDrawers(); if (!pinned) closeMenu(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) closeMenu(); });
  matchMedia(NARROW).addEventListener?.('change', event => { if (event.matches) closeMenu(); });
})();
