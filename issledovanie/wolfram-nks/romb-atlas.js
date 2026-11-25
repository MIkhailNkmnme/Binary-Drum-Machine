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
  const axes = {
    vertical: 'вертикальная',
    horizontal: 'горизонтальная',
    diagonal: 'главная диагональ',
    antidiagonal: 'побочная диагональ'
  };
  const branch = ['За контурами ветвей', 'Ветвь ←', 'Ветвь →', 'Обе ветви ← →'];
  const format = new Intl.NumberFormat('ru');
  const pageSize = 24;
  let catalogue, gifIndex, diamondGifIndex, axesGifIndex, filtered = [], displayed = 0;

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
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = Math.min(4, 148 / width, 100 / height) * width + 'px';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Маска фигуры ' + record.id);
    const context = canvas.getContext('2d');
    if (!context) return canvas;
    const packed = atob(record.mask);
    context.fillStyle = bit ? '#e1f2ec' : '#75c1db';
    for (let i = 0; i < width * height; i++) {
      if ((packed.charCodeAt(i >> 3) >> (i & 7)) & 1) {
        context.fillRect(i % width, Math.floor(i / width), 1, 1);
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
      node('p', branch[record.branches])
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
    const atlas = catalogue.atlases.find(entry => entry.rows === Number(size.value));
    if (!atlas) return;
    const gifs = gifIndex.find(entry => entry.rows === atlas.rows);
    const diamonds = diamondGifIndex.find(entry => entry.rows === atlas.rows);
    const axisGifs = axesGifIndex.find(entry => entry.rows === atlas.rows);
    const url = new URL(location.href);
    url.searchParams.set('size', atlas.rows);
    if (onlyMatches.checked) url.searchParams.set('matches', '1');
    else url.searchParams.delete('matches');
    if (axisFilter.value === '0') url.searchParams.delete('axis');
    else url.searchParams.set('axis', axisFilter.value);
    history.replaceState(null, '', url);
    const filter = Number(axisFilter.value);
    filtered = atlas.figures.filter(record => {
      if (onlyMatches.checked && !record.matchCount) return false;
      if (filter === 0) return true;
      if (filter === 1) return record.centralBranches > 0;
      return (record.centralBranches & (filter - 1)) === filter - 1;
    });
    displayed = 0;
    gallery.replaceChildren();
    status.textContent = atlas.rows + ' × ' + atlas.width + ' · фигур ' + format.format(atlas.figures.length) +
      ' · на центральных осях ' + format.format(atlas.centralShapes) + ' · совпали ' +
      format.format(atlas.matchingShapes) + ' · показано по фильтру ' + format.format(filtered.length);
    animations.replaceChildren();
    if (gifs) animations.append(node('span', 'Палитра GIF · ' + gifs.palette.name, 'hint'),
      gifLinks('Черновики · поле целиком', 'full', gifs));
    if (diamonds) animations.append(gifLinks('Два ромба', 'diamonds', diamonds));
    if (axisGifs) animations.append(gifLinks('Поле с центральными осями', 'axes', axisGifs));
    renderMore();
  }

  async function read(name) {
    const response = await fetch(name);
    if (!response.ok) throw Error('Не удалось загрузить данные.');
    return response.json();
  }

  const requested = new URLSearchParams(location.search);
  if (Array.from(size.options).some(option => option.value === requested.get('size'))) size.value = requested.get('size');
  onlyMatches.checked = requested.get('matches') === '1';
  if (Array.from(axisFilter.options).some(option => option.value === requested.get('axis'))) axisFilter.value = requested.get('axis');
  size.addEventListener('change', render);
  onlyMatches.addEventListener('change', render);
  axisFilter.addEventListener('change', render);
  more.addEventListener('click', renderMore);
  Promise.all([read('romb-atlas.json?v=2'), read('romb-gifs/index.json?v=1'),
    read('romb-gifs/diamonds/index.json?v=3'), read('romb-gifs/axes/index.json?v=3')])
    .then(([figures, gifs, diamonds, marked]) => {
      catalogue = figures;
      gifIndex = gifs;
      diamondGifIndex = diamonds;
      axesGifIndex = marked;
      render();
    }).catch(() => { status.textContent = 'Не удалось открыть атлас. Обновите страницу.'; });
})();
