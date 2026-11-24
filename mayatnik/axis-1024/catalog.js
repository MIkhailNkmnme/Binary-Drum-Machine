const status = document.getElementById('status');
const gallery = document.getElementById('figures');

async function showAtlas() {
  const response = await fetch('large-figures.json');
  if (!response.ok) throw new Error('Не удалось загрузить список фигур.');
  const figures = await response.json();
  const fragment = document.createDocumentFragment();

  for (const {id, frame, x, y, width, height, bits, preview} of figures) {
    const label = String(id).padStart(4, '0');
    const card = document.createElement('figure');
    card.id = `figure-${label}`;
    card.className = 'atlas-card';
    const image = document.createElement('span');
    image.className = 'atlas-preview';
    image.style.backgroundPosition = `${-preview[0]}px ${-preview[1]}px`;
    image.setAttribute('aria-hidden', 'true');
    const caption = document.createElement('figcaption');
    const name = document.createElement('strong');
    name.textContent = `Фигура ${label}`;
    const details = document.createElement('p');
    details.textContent = `${width} × ${height} · ${bits.toLocaleString('ru-RU')} клеток · (${x}, ${y})`;
    const link = document.createElement('a');
    link.href = `../Zerkalius-mayatnik.html?chisto&n=1024&s=1024&k=${frame}&mode=pend`;
    link.textContent = `Кадр ${frame}`;
    caption.append(name, details, link);
    card.append(image, caption);
    fragment.append(card);
  }

  gallery.append(fragment);
  status.hidden = true;
}

showAtlas().catch(error => { status.textContent = error.message; });
