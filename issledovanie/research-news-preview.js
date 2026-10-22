/* Исследования v0.063: первая картинка именно выбранного раздела; без неё — пустая область. */
(() => {
  'use strict';
  const news = document.querySelector('.novoe');
  const preview = news?.querySelector('.nv-pic');
  const image = preview?.querySelector('img');
  if (!preview || !image) return;
  const links = [...news.querySelectorAll('ol a[href^="#"]')];
  const entries = new Map();
  function firstImage(link) {
    let id;
    try { id = decodeURIComponent(link.hash.slice(1)); } catch { return null; }
    const heading = document.getElementById(id);
    if (!heading) return null;
    for (let node = heading.nextElementSibling; node; node = node.nextElementSibling) {
      if (/^H[12]$/.test(node.tagName)) break;
      const found = node.matches('img[src]') ? node : node.querySelector('img[src]');
      if (found?.getAttribute('src')) return found;
    }
    return null;
  }
  for (const link of links) {
    const source = firstImage(link);
    if (!source) { entries.set(link, null); continue; }
    const cached = new Image(); cached.src = source.src;
    entries.set(link, {src:source.src, alt:source.alt, cached});
  }
  let sequence = 0;
  function show(link) {
    const current = ++sequence, entry = entries.get(link);
    preview.style.visibility = 'hidden';
    preview.setAttribute('aria-hidden', 'true');
    preview.setAttribute('tabindex', '-1');
    preview.removeAttribute('href'); preview.removeAttribute('title');
    image.onload = null; image.onerror = null;
    image.removeAttribute('src'); image.alt = '';
    if (!entry) return;
    const reveal = () => {
      if (current !== sequence || !image.naturalWidth) return;
      preview.style.visibility = 'visible';
      preview.removeAttribute('aria-hidden'); preview.removeAttribute('tabindex');
      preview.setAttribute('href', link.getAttribute('href'));
      preview.title = link.textContent.trim();
    };
    image.onload = reveal;
    image.onerror = () => { if (current === sequence) { preview.style.visibility = 'hidden'; image.removeAttribute('src'); } };
    image.alt = entry.alt || link.textContent.trim();
    image.src = entry.src;
    if (image.complete && image.naturalWidth) reveal();
  }
  for (const link of links) {
    (link.closest('li') || link).addEventListener('pointerenter', () => show(link));
    link.addEventListener('focus', () => show(link));
  }
  if (links.length) show(links[0]);
})();
