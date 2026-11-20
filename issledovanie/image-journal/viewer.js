(() => {
  const viewer = document.getElementById('image-viewer');
  if (typeof viewer.showModal !== 'function') return;

  const original = document.getElementById('viewer-original');
  const stage = document.getElementById('viewer-stage');
  const error = document.getElementById('viewer-error');

  document.getElementById('journal').addEventListener('click', event => {
    const link = event.target.closest('a[data-view-image]');
    if (!link || event.defaultPrevented || event.button !== 0 ||
        event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;

    event.preventDefault();
    const image = new Image();
    image.alt = link.querySelector('img')?.alt || link.textContent.trim();
    image.decoding = 'async';
    image.addEventListener('error', () => {
      if (stage.contains(image)) {
        image.remove();
        error.hidden = false;
      }
    }, { once: true });

    original.href = link.href;
    error.hidden = true;
    stage.replaceChildren(image);
    viewer.showModal();
    image.src = link.href;
  });

  const outsideImage = target => !target.closest('img, a, button');
  let pressedOutside = false;
  viewer.addEventListener('pointerdown', event => {
    pressedOutside = event.button === 0 && outsideImage(event.target);
  });
  viewer.addEventListener('click', event => {
    const dismiss = pressedOutside && outsideImage(event.target);
    pressedOutside = false;
    if (dismiss) viewer.close();
  });
  viewer.addEventListener('close', () => {
    if (!viewer.open) stage.replaceChildren();
  });
})();
