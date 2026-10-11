/* Bitmultfilmy v0.015: one live preview on demand; release it when hidden. */
(() => {
  'use strict';
  let active = null;
  const controls = new Map();
  function stop() {
    if (!active) return;
    active.frame.remove();
    const button = controls.get(active.container);
    button.textContent = '▶';
    button.setAttribute('aria-pressed', 'false');
    active = null;
  }
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) if (!entry.isIntersecting && entry.target === active?.container.parentElement) stop();
  });
  document.querySelectorAll('[data-preview-src]').forEach(container => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'preview-play';
    button.textContent = '▶';
    button.title = 'Пуск / пауза предпросмотра';
    button.setAttribute('aria-label', 'Предпросмотр: ' + container.title);
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => {
      const wasActive = active?.container === container;
      stop();
      if (wasActive) return;
      const frame = document.createElement('iframe');
      frame.title = container.title;
      frame.tabIndex = -1;
      frame.src = container.dataset.previewSrc;
      container.appendChild(frame);
      active = {container, frame};
      button.textContent = 'Ⅱ';
      button.setAttribute('aria-pressed', 'true');
    });
    container.parentElement.appendChild(button);
    controls.set(container, button);
    observer.observe(container.parentElement);
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  window.addEventListener('pagehide', stop);
})();
