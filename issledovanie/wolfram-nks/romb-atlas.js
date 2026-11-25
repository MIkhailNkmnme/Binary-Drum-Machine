(() => {
  'use strict';

  const byId = id => document.getElementById(id);
  const size = byId('atlas-size');
  const onlyMatches = byId('atlas-match');
  const axisFilter = byId('atlas-axis');
  const status = byId('atlas-status');
  const gallery = byId('atlas-cards');
  const more = byId('atlas-more');
  const animations = byId('atlas-gifs');
  const contactAtlas = document.documentElement.hasAttribute('data-contact-atlas');
  const axes = {
    vertical: 'вертикальная',
    horizontal: 'горизонтальная',
    diagonal: 'главная диагональ',
    antidiagonal: 'побочная диагональ'
  };
  const branch = ['За контурами ветвей', 'Ветвь ←', 'Ветвь →', 'Обе ветви ← →'];
  const format = new Intl.NumberFormat('ru');
  const pageSize = 24;
  let catalogue, gifIndex, diamondGifIndex, axesGifIndex, sizeGifIndex, filtered = [], displayed = 0;
  const contactCache = new Map();

  function node(tag, text, className) {
    const element = document.createElement(tag);
    if (text) element.textContent = text;
    if (className) element.className = className;
    return element;
  }

  function link(href, text) {
    const anchor = node('a', text);
    anchor.href = href;
    return anchor;
  }

  function draw(record) {
    const {width, height, bit} = record;
    const canvas = node('canvas');
    const sample = Math.min(1, 384 / width, 256 / height);
    canvas.width = Math.max(1, Math.round(width * sample));
    canvas.height = Math.max(1, Math.round(height * sample));
    canvas.style.width = Math.min(4, 148 / width, 100 / height) * width + 'px';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Маска фигуры ' + record.id);
    const context = canvas.getContext('2d');
    if (!context) return canvas;
    const packed = atob(record.mask);
    context.fillStyle = bit ? '#e1f2ec' : '#75c1db';
    for (let y = 0; y < canvas.height; y++) {
      const row = Math.floor((y + .5) * height / canvas.height) * width;
      for (let x = 0; x < canvas.width; x++) {
        const i = row + Math.floor((x + .5) * width / canvas.width);
        if ((packed.charCodeAt(i >> 3) >> (i & 7)) & 1) context.fillRect(x, y, 1, 1);
      }
    }
    return canvas;
  }

  function card(record) {
    const article = node('article', null, 'template');
    const figure = node('figure');
    figure.append(draw(record));
    article.append(
      figure,
      node('h3', 'Фигура ' + record.id + ' · ' + record.cells + ' клеток'),
      node('p', record.width + ' × ' + record.height + ' · бит ' + record.bit),
      node('p', 'Кадр ' + format.format(record.firstFrame) + ' · появлений ' + format.format(record.occurrences)),
      node('p', record.axes.map(axis => axes[axis]).join(', ')),
      node('p', contactAtlas && !record.branches ? 'Вне центральных осей' : branch[record.branches])
    );
    if (record.centralBranches) article.append(node('p', [
      '', 'Центральная ось ←', 'Центральная ось →', 'Центральные оси ← →'
    ][record.centralBranches], 'match'));
    if (record.matchCount) {
      article.append(node('p', 'Совпадений в обычном Маятнике · ' + format.format(record.matchCount), 'match'));
      const sources = node('p');
      for (const item of record.matches) {
        if (sources.childNodes.length) sources.append(' · ');
        sources.append(link('../../mayatnik/Zerkalius-mayatnik-shablony.html?size=' + item.size,
          item.size + (item.connected ? ' доп.' : '') + ' / №' + item.number));
      }
      article.append(sources);
    }
    return article;
  }

  function renderMore() {
    const fragment = document.createDocumentFragment();
    for (const record of filtered.slice(displayed, displayed + pageSize)) fragment.append(card(record));
    gallery.append(fragment);
    displayed = gallery.childElementCount;
    more.hidden = displayed >= filtered.length;
  }

  function gifLinks(title, series, gifs) {
    const group = node('div', null, 'animation-group');
    const url = 'romb-gif-view.html?size=' + gifs.rows + '&series=' + series;
    group.append(
      node('strong', title),
      link(url + '&phase=before', 'До цикла · ' + gifs.before.from + '–' + gifs.before.to),
      link(url + '&phase=cycle', 'Цикл · ' + format.format(gifs.period) + ' ходов')
    );
    return group;
  }

  function render() {
    if (!catalogue) return;
    const rows = Number(size.value);
    const atlas = catalogue.atlases.find(entry => entry.rows === rows);
    const gif = sizeGifIndex.find(entry => entry.rows === rows);
    const gifs = gifIndex?.find(entry => entry.rows === rows);
    const diamonds = diamondGifIndex?.find(entry => entry.rows === rows);
    const axisGifs = axesGifIndex?.find(entry => entry.rows === rows);
    const url = new URL(location.href);
    url.searchParams.set('size', rows);
    if (onlyMatches.checked) url.searchParams.set('matches', '1');
    else url.searchParams.delete('matches');
    if (axisFilter.value === '0') url.searchParams.delete('axis');
    else url.searchParams.set('axis', axisFilter.value);
    history.replaceState(null, '', url);
    const filter = Number(axisFilter.value);
    axisFilter.disabled = onlyMatches.disabled = !atlas;
    filtered = (atlas?.figures ?? []).filter(record => {
      if (onlyMatches.checked && !record.matchCount) return false;
      if (filter === 0) return true;
      if (filter === 1) return record.centralBranches > 0;
      return (record.centralBranches & (filter - 1)) === filter - 1;
    });
    displayed = 0;
    gallery.replaceChildren();
    status.textContent = atlas ? rows + ' × ' + atlas.width + ' · фигур ' + format.format(atlas.figures.length) +
      ' · на центральных осях ' + format.format(atlas.centralShapes) +
      (contactAtlas ? ' · кадров выборки ' + atlas.samples.length : ' · совпали ' + format.format(atlas.matchingShapes)) +
      ' · показано по фильтру ' + format.format(filtered.length)
      : rows + ' × ' + (2 * rows - 1) + ' · карточки фигур доступны на высотах 8–128';
    animations.replaceChildren();
    if (gif) {
      const group = node('div', null, 'animation-group');
      const download = link('romb-gifs/' + (contactAtlas ? 'contact/' : 'sizes/') + gif.file, 'Скачать GIF');
      download.download = '';
      group.append(link('../../prosmotr/Zerkalius-prosmotr.html?rhomb=' + rows + (contactAtlas ? '&contact=1' : ''), rows + ' строк · открыть GIF'),
        download, node('span', gif.palette.name + ' палитра · ' + gif.frames.length + ' кадров', 'hint'));
      if (contactAtlas && atlas) group.append(link('romb-contact-atlas/' + rows + '.json', 'Данные фигур'));
      animations.append(group);
    }
    if (gifs) {
      const archive = node('details');
      archive.append(node('summary', 'Черновики'), gifLinks('Поле целиком', 'full', gifs));
      if (diamonds) archive.append(gifLinks('Два ромба', 'diamonds', diamonds));
      if (axisGifs) archive.append(gifLinks('Поле с центральными осями', 'axes', axisGifs));
      animations.append(archive);
    }
    renderMore();
  }

  async function read(name) {
    const response = await fetch(name);
    if (!response.ok) throw Error('Не удалось загрузить данные.');
    return response.json();
  }

  async function renderSize() {
    if (!contactAtlas) {
      render();
      return;
    }
    const rows = Number(size.value);
    if (!contactCache.has(rows)) {
      const request = read('romb-contact-atlas/' + rows + '.json');
      contactCache.set(rows, request);
      request.catch(() => contactCache.delete(rows));
    }
    status.textContent = 'Загружается атлас…';
    try {
      const atlas = await contactCache.get(rows);
      if (Number(size.value) !== rows) return;
      catalogue = {atlases: [atlas]};
      render();
    } catch {
      if (Number(size.value) === rows) status.textContent = 'Не удалось открыть выбранный размер.';
    }
  }

  const requested = new URLSearchParams(location.search);
  if (Array.from(size.options).some(option => option.value === requested.get('size'))) size.value = requested.get('size');
  onlyMatches.checked = requested.get('matches') === '1';
  if (Array.from(axisFilter.options).some(option => option.value === requested.get('axis'))) axisFilter.value = requested.get('axis');
  size.addEventListener('change', () => {if (sizeGifIndex) renderSize();});
  onlyMatches.addEventListener('change', render);
  axisFilter.addEventListener('change', render);
  more.addEventListener('click', renderMore);
  if (contactAtlas) {
    read('romb-gifs/contact/index.json').then(index => {
      sizeGifIndex = index;
      return renderSize();
    }).catch(() => {status.textContent = 'Не удалось открыть список GIF.';});
  } else Promise.all([read('romb-atlas.json?v=2'), read('romb-gifs/index.json?v=1'),
    read('romb-gifs/diamonds/index.json?v=3'), read('romb-gifs/axes/index.json?v=3'), read('romb-gifs/sizes/index.json?v=1')])
    .then(([figures, gifs, diamonds, marked, perSize]) => {
      catalogue = figures;
      gifIndex = gifs;
      diamondGifIndex = diamonds;
      axesGifIndex = marked;
      sizeGifIndex = perSize;
      render();
    }).catch(() => { status.textContent = 'Не удалось открыть атлас. Обновите страницу.'; });
})();
