/* Hub v0.185: one transparent toolbar, five themed diamond menus. */
(() => {
  'use strict';
  function init() {
    const toolbar = document.getElementById('hubFieldTools');
    if (!toolbar || toolbar.dataset.grouped) return;
    toolbar.dataset.grouped = 'true';
    // These actions already have controls in the field / in the 3D group.
    toolbar.querySelector('.hubViewRotationControl')?.remove();
    document.getElementById('hub3DQuick')?.remove();
    const items = [...toolbar.children];
    const groups = [
      ['bits', '01', 'Биты'], ['symmetry', '∥', 'Симм.'],
      ['axis', '↗', 'Ось'], ['space', '3D', 'Объём'], ['file', '▧', 'Файл'], ['flow', '↓', 'Поток']
    ].map(([key, icon, name]) => {
      const box = document.createElement('details'); box.className = 'hubFieldGroup'; box.dataset.group = key;
      const head = document.createElement('summary'); head.className = 'hubRhomb';
      head.setAttribute('aria-label', 'Группа: ' + name); head.title = name;
      const mark = document.createElement('b'), caption = document.createElement('small');
      mark.textContent = icon; caption.textContent = name; head.append(mark, caption);
      const body = document.createElement('div'); body.className = 'hubFieldGroupBody';
      body.setAttribute('role', 'group'); body.setAttribute('aria-label', name);
      box.append(head, body); toolbar.append(box);
      const open = () => { for (const other of toolbar.querySelectorAll('.hubFieldGroup')) if (other !== box) other.open = false; box.open = true; };
      box.addEventListener('pointerenter', e => { if (e.pointerType !== 'touch') open(); });
      box.addEventListener('pointerleave', e => { if (e.pointerType !== 'touch' && !box.contains(document.activeElement)) box.open = false; });
      head.addEventListener('click', e => { if (e.pointerType === 'mouse') { e.preventDefault(); open(); } else for (const other of toolbar.querySelectorAll('.hubFieldGroup')) if (other !== box) other.open = false; });
      return { key, box, body };
    });
    const body = key => groups.find(g => g.key === key).body;
    for (const item of items) {
      const label = item.getAttribute('aria-label') || item.title || '';
      let key = 'bits';
      if (item.matches('.hubFlowControls')) key = 'flow';
      else if (item.matches('.hubBitSymmetry,.hubSymmetryMinimum') || label.includes('Симметрия параллельно')) key = 'symmetry';
      else if (item.matches('.hubImageTools')) key = 'file';
      else if (item.matches('.hubFlipControl,.hubFlipPlanes')) key = 'space';
      else if (item.matches('.hubMirrorSpinControl,.hubAxisScreenPin') || /Зеркало|Заворот|Магнит оси|Вращать ось|перетаскивание холста/.test(label)) key = 'axis';
      body(key).append(item);
    }
    // Composite wrappers keep their event handlers; their buttons join the same grid.
    toolbar.querySelectorAll('.hubFlipPlanes,.hubImageTools,.hubFlowControls').forEach(el => el.classList.add('hubFieldContents'));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') groups.forEach(g => { g.box.open = false; }); });
    document.addEventListener('pointerdown', e => { if (!toolbar.contains(e.target)) groups.forEach(g => { g.box.open = false; }); }, true);
  }
  // Existing modules populate the toolbar during DOMContentLoaded.
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(init, 0), { once: true });
  else setTimeout(init, 0);
})();
