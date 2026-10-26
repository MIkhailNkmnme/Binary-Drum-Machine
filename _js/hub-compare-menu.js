/* v1. Крайние треугольники: меню вниз по наведению, касанию и клавиатуре. */
(() => {
  'use strict';
  const drawers = [...document.querySelectorAll('.hubCompareDrawer')];
  let keyboard = false;
  function open(drawer, value) {
    drawer.toggleAttribute('data-open', value);
    drawer.querySelector('.hubCompareHandle').setAttribute('aria-expanded', String(value));
    drawer.querySelector('.hubCompareDrawerBody').inert = !value;
  }
  function closeAll() { drawers.forEach(drawer => open(drawer, false)); }
  document.addEventListener('keydown', event => {
    keyboard = true;
    if (event.key === 'Escape') {
      const active = document.activeElement?.closest('.hubCompareDrawer');
      active?.querySelector('.hubCompareHandle').focus();
      closeAll();
    }
  });
  document.addEventListener('pointerdown', event => {
    keyboard = false;
    if (!event.target.closest?.('.hubCompareDrawer')) closeAll();
  });
  drawers.forEach(drawer => {
    const handle = drawer.querySelector('.hubCompareHandle');
    drawer.addEventListener('pointerenter', event => {
      if (event.pointerType !== 'touch') open(drawer, true);
    });
    drawer.addEventListener('pointerleave', event => {
      if (event.pointerType !== 'touch' && !keyboard) open(drawer, false);
    });
    drawer.addEventListener('focusin', () => { if (keyboard) open(drawer, true); });
    drawer.addEventListener('focusout', event => {
      if (!drawer.contains(event.relatedTarget)) open(drawer, false);
    });
    handle.addEventListener('click', () => open(drawer, !drawer.hasAttribute('data-open')));
  });
  document.getElementById('hubCompareZen')?.addEventListener('click', closeAll);
  window.addEventListener('blur', closeAll);
})();
