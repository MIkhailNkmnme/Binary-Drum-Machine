/* Исследования v0.065: первый рисунок или видео выбранного раздела; без медиа — пустая область. */
(() => {
  'use strict';
  const news = document.querySelector('.novoe');
  const preview = news?.querySelector('.nv-pic');
  const imageLink = preview?.querySelector('.nv-image-link');
  const image = preview?.querySelector('img');
  const video = preview?.querySelector('.nv-video');
  if (!preview || !imageLink || !image || !video) return;
  const links = [...news.querySelectorAll('ol a[href^="#"]')];
  const entries = new Map();
  function firstMedia(link) {
    let id;
    try { id = decodeURIComponent(link.hash.slice(1)); } catch { return null; }
    const heading = document.getElementById(id);
    if (!heading) return null;
    for (let node = heading.nextElementSibling; node; node = node.nextElementSibling) {
      if (/^H[12]$/.test(node.tagName)) break;
      const found = node.matches('img[src],video') ? node : node.querySelector('img[src],video');
      if (found && (found.getAttribute('src') || found.querySelector('source[src]'))) return found;
    }
    return null;
  }
  for (const link of links) {
    const source = firstMedia(link);
    if (!source) { entries.set(link, null); continue; }
    if (source.tagName === 'VIDEO') {
      entries.set(link, {kind:'video', src:source.src || source.querySelector('source[src]').src, poster:source.poster, alt:source.getAttribute('aria-label') || link.textContent.trim()});
      continue;
    }
    const cached = new Image(); cached.src = source.src;
    entries.set(link, {kind:'image', src:source.src, alt:source.alt, cached});
  }
  let sequence = 0;
  function show(link) {
    const current = ++sequence, entry = entries.get(link);
    preview.style.visibility = 'hidden';
    preview.setAttribute('aria-hidden', 'true');
    imageLink.hidden = true;
    imageLink.removeAttribute('href'); imageLink.removeAttribute('title');
    video.pause(); video.hidden = true;
    video.removeAttribute('src'); video.removeAttribute('poster'); video.load();
    image.onload = null; image.onerror = null;
    image.removeAttribute('src'); image.alt = '';
    if (!entry) return;
    if (entry.kind === 'video') {
      video.hidden = false;
      video.muted = true;
      video.setAttribute('aria-label', entry.alt);
      if (entry.poster) video.poster = entry.poster;
      video.src = entry.src;
      preview.style.visibility = 'visible';
      preview.removeAttribute('aria-hidden');
      video.play().catch(() => {}); // Если автопуск запрещён, остаются постер и штатная кнопка пуска.
      return;
    }
    imageLink.hidden = false;
    const reveal = () => {
      if (current !== sequence || !image.naturalWidth) return;
      preview.style.visibility = 'visible';
      preview.removeAttribute('aria-hidden');
      imageLink.setAttribute('href', link.getAttribute('href'));
      imageLink.title = link.textContent.trim();
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
