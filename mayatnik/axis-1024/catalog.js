const status = document.getElementById('status');
const gallery = document.getElementById('figures');
const rows = gallery.dataset.rows || '1024';

const previewObserver = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    const image = entry.target;
    image.style.backgroundImage = `url(${image.dataset.previewFile})`;
    previewObserver.unobserve(image);
  }
}, {rootMargin: '320px'}) : null;

async function showAtlas() {
  const response = await fetch('large-figures.json');
  if (!response.ok) throw new Error('Не удалось загрузить список фигур.');
  const figures = await response.json();
  const fragment = document.createDocumentFragment();

  for (const {id, frame, x, y, width, height, bits, preview, previewFile} of figures) {
    const label = String(id).padStart(4, '0');
    const card = document.createElement('figure');
    card.id = `figure-${label}`;
    card.className = 'atlas-card';
    const image = document.createElement('span');
    image.className = 'atlas-preview';
    image.style.backgroundPosition = `${-preview[0]}px ${-preview[1]}px`;
    image.setAttribute('aria-hidden', 'true');
    if (previewFile) {
      if (previewObserver) {
        image.dataset.previewFile = previewFile;
        previewObserver.observe(image);
      } else {
        image.style.backgroundImage = `url(${previewFile})`;
      }
    }
    const caption = document.createElement('figcaption');
    const name = document.createElement('strong');
    name.textContent = `Фигура ${label}`;
    const details = document.createElement('p');
    details.textContent = `${width} × ${height} · ${bits.toLocaleString('ru-RU')} клеток · (${x}, ${y})`;
    const link = document.createElement('a');
    link.href = `../Zerkalius-mayatnik.html?chisto&n=${rows}&s=${rows}&k=${frame}&mode=pend`;
    link.textContent = `Кадр ${frame}`;
    caption.append(name, details, link);
    card.append(image, caption);
    fragment.append(card);
  }

  gallery.append(fragment);
  status.hidden = true;
}

showAtlas().catch(error => { status.textContent = error.message; });
