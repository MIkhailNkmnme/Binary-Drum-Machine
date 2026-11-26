'use strict';

const params = new URLSearchParams(location.search);
const wallpaper = params.get('edition') === '1024';
const base = wallpaper ? '../../desktop-wallpapers/rhomb-1024/' : '';
const seriesId = params.get('series');
const paletteId = params.get('palette');
const byId = id => document.getElementById(id);
const status = byId('frame-status');
const edges = {bounce: 'Отскок', wrap: 'Перескок', reverse: 'Разворот при касании'};

async function showFrame() {
  if (!seriesId || !paletteId) {
    status.textContent = 'Выберите кадр в коллекции.';
    return;
  }
  const response = await fetch(base + 'recipes.json');
  if (!response.ok) throw Error('Не удалось загрузить рецепт.');
  const catalogue = await response.json();
  const item = catalogue.series.find(series => series.id === seriesId);
  const image = item?.images.find(entry => entry.palette === paletteId);
  const palette = catalogue.palettes.find(entry => entry.id === paletteId);
  if (!image || !palette) {
    status.textContent = 'Кадр не найден в этой коллекции.';
    return;
  }

  const title = `Кадр ${image.frame} · ${palette.name}`;
  document.title = title + ' · Журнал картинок';
  byId('frame-series').textContent = item.name;
  byId('frame-title').textContent = title;
  byId('frame-settings').textContent = `Поле ${item.width} × ${item.rows} · ${edges[item.edge]} · ${item.accumulation.toUpperCase()}`;
  byId('frame-gallery').href = (wallpaper ? 'wallpapers.html' : './') + '#' + item.id + '-' + palette.id;
  byId('frame-gallery').textContent = 'К кадрам серии';
  byId('frame-download').href = base + image.file;
  byId('frame-gif').href = 'gifs.html#' + item.id;

  const picture = byId('frame-image');
  picture.width = wallpaper ? catalogue.width : image.width;
  picture.height = wallpaper ? catalogue.height : image.height;
  picture.alt = `${item.name} · ${title}`;
  picture.addEventListener('error', () => {
    status.textContent = 'Не удалось загрузить PNG.';
    status.hidden = false;
  });
  status.hidden = true;
  byId('frame-detail').hidden = false;
  picture.src = base + image.file;
}

showFrame().catch(() => { status.textContent = 'Не удалось загрузить кадр. Обновите страницу.'; });
