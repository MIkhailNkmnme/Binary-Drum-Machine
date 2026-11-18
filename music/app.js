/* МУЗ-001 v0.001. Только собственные опубликованные материалы; без автозапуска. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const voices = [...document.querySelectorAll('.voice-card audio')];
  const media = new Set(voices);
  const pageSize = 12;
  let catalog = null, limit = pageSize, sequence = false, sequenceIndex = -1, request = 0;
  const status = text => { $('playback').textContent = text; };
  const node = (tag, className, text) => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  };
  function url(value) {
    if (typeof value !== 'string' || !value) return null;
    try {
      const target = new URL(value, location.href);
      return ['http:', 'https:', 'file:'].includes(target.protocol) ? target.href : null;
    } catch { return null; }
  }
  function link(label, value) {
    const target = url(value);
    if (!target) return null;
    const a = node('a', '', label); a.href = target;
    return a;
  }
  function appendLink(parent, label, value) { const a = link(label, value); if (a) parent.append(a); }
  function cancelSequence() {
    sequence = false; sequenceIndex = -1; request++;
    $('compare').classList.remove('gz-on');
  }
  function stopAll() {
    cancelSequence();
    for (const player of media) { player.pause(); if (player.readyState) player.currentTime = 0; }
  }
  function bind(player, title) {
    player.addEventListener('play', () => {
      if (sequence && player !== voices[sequenceIndex]) cancelSequence();
      for (const other of media) if (other !== player) other.pause();
      player.closest('article')?.classList.add('playing');
      status(`Сейчас: ${title}`);
    });
    player.addEventListener('pause', () => {
      player.closest('article')?.classList.remove('playing');
      if (sequence && player === voices[sequenceIndex] && player.paused && !player.ended) cancelSequence();
      if (!sequence && [...media].every(p => p.paused)) status(`Пауза: ${title}`);
    });
    player.addEventListener('ended', () => {
      player.closest('article')?.classList.remove('playing');
      if (sequence && player === voices[sequenceIndex]) {
        if (sequenceIndex + 1 < voices.length) playVoice(sequenceIndex + 1);
        else { cancelSequence(); status('Сравнение завершено: A → B → C.'); }
      } else status(`Завершено: ${title}`);
    });
    player.addEventListener('error', () => {
      if (sequence && player === voices[sequenceIndex]) cancelSequence();
      const card = player.closest('article');
      if (card && !card.querySelector('.media-error')) {
        const warning = node('p', 'media-error', 'Не удалось загрузить запись. ');
        appendLink(warning, 'Открыть файл отдельно', player.src);
        player.after(warning);
      }
      status(`Не удалось загрузить: ${title}. Откройте файл по ссылке в карточке.`);
    });
  }
  async function playVoice(index) {
    sequenceIndex = index;
    const token = ++request, player = voices[index];
    player.currentTime = 0;
    try { await player.play(); }
    catch {
      if (token !== request) return;
      cancelSequence(); status('Воспроизведение остановлено браузером. Нажмите ▶ у нужного голоса.');
    }
  }
  voices.forEach((player, i) => bind(player, ['A · Гармонический голос', 'B · Импульсный голос', 'C · Битовый голос'][i]));
  $('compare').addEventListener('click', () => {
    stopAll(); sequence = true; $('compare').classList.add('gz-on'); playVoice(0);
  });
  $('stop').addEventListener('click', () => { stopAll(); status('Воспроизведение остановлено.'); });
  window.addEventListener('pagehide', stopAll);
  document.addEventListener('visibilitychange', () => { if (document.hidden) { stopAll(); status('Воспроизведение остановлено при уходе со страницы.'); } });

  function makeCard(item) {
    const card = node('article', 'media-card'); card.id = `record-${item.id}`;
    const head = node('div', 'card-header');
    head.append(node('h3', '', item.title));
    const group = catalog.groups.find(g => g.id === item.group)?.label || item.group;
    const silent = (item.tags || []).includes('без звука');
    head.append(node('p', 'card-type', group + (silent ? ' · БЕЗ ЗВУКА' : ''))); card.append(head);
    const layout = node('div', 'card-layout'), left = node('div', 'card-media'), right = node('div', 'card-recipe');
    left.append(node('p', '', item.description));
    let hasPlayer = false;
    // Some materials have both audio and video: both remain directly accessible.
    for (const type of ['video', 'audio']) {
      const src = url(item[type]); if (!src) continue;
      const player = node(type); player.src = src; player.controls = true; player.preload = 'none';
      player.setAttribute('aria-label', `${type === 'audio' ? 'Аудио' : 'Видео'}: ${item.title}`);
      if (type === 'video') { player.playsInline = true; if (url(item.poster)) player.poster = url(item.poster); }
      left.append(player); media.add(player); bind(player, item.title); hasPlayer = true;
      appendLink(left, type === 'audio' ? 'Открыть аудиофайл ↗' : 'Открыть видеофайл ↗', item[type]);
    }
    if (!hasPlayer) left.append(node('div', 'tool-mark', '◇ 01'));
    right.append(node('h4', '', 'Как сделано'), node('p', '', item.recipe));
    const links = node('div', 'card-links');
    if (item.source) appendLink(links, item.source.label || 'Подробное описание', item.source.url);
    for (const entry of item.links || []) appendLink(links, entry.label, entry.url);
    right.append(links); layout.append(left, right); card.append(layout);
    return card;
  }
  function saveFilters() {
    try { localStorage.setItem('zerkalius.music.filters.v1', JSON.stringify({group:$('group').value, kind:$('kind').value, search:$('search').value})); } catch { /* Storage may be disabled. */ }
  }
  function render(append = false) {
    if (!catalog) return;
    if (!append) for (const player of [...media]) if (!voices.includes(player)) { player.pause(); media.delete(player); }
    const search = $('search').value.trim().toLocaleLowerCase('ru'), group = $('group').value, kind = $('kind').value;
    const items = catalog.items.filter(item => {
      if (group !== 'all' && item.group !== group) return false;
      if (kind === 'audio' && !item.audio || kind === 'video' && !item.video || kind === 'tool' && (item.audio || item.video)) return false;
      return !search || [item.title,item.description,item.recipe,...(item.tags || [])].join(' ').toLocaleLowerCase('ru').includes(search);
    });
    if (append) $('catalog').append(...items.slice($('catalog').children.length, limit).map(makeCard));
    else $('catalog').replaceChildren(...items.slice(0, limit).map(makeCard));
    const shown = Math.min(limit, items.length);
    $('count').textContent = `Показано ${shown} из ${items.length} · всего ${catalog.items.length}`;
    $('loading').hidden = items.length > 0;
    $('loading').textContent = 'Ничего не найдено. Измените поиск или сбросьте фильтры.';
    $('more').hidden = shown >= items.length;
    saveFilters();
  }
  function changeFilters() { limit = pageSize; render(); }
  $('group').addEventListener('change', changeFilters);
  $('kind').addEventListener('change', changeFilters);
  $('search').addEventListener('input', changeFilters);
  $('reset').addEventListener('click', () => { $('group').value = 'all'; $('kind').value = 'all'; $('search').value = ''; changeFilters(); });
  $('more').addEventListener('click', () => {
    const firstNew = limit; limit += pageSize; render(true);
    const card = $('catalog').children[firstNew]; if (card) { card.tabIndex = -1; card.focus({preventScroll:true}); card.scrollIntoView({block:'start'}); }
  });
  async function load() {
    $('retry').hidden = true; $('loading').hidden = false; $('loading').textContent = 'Загрузка каталога…';
    try {
      const response = await fetch('catalog.json?v=1'); if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!Array.isArray(data.items) || !Array.isArray(data.groups)) throw new Error('Неизвестный формат каталога');
      catalog = data;
      for (const group of data.groups) { const option = node('option', '', group.label); option.value = group.id; $('group').append(option); }
      try {
        const saved = JSON.parse(localStorage.getItem('zerkalius.music.filters.v1') || '{}');
        if (data.groups.some(g => g.id === saved.group)) $('group').value = saved.group;
        if (['all','audio','video','tool'].includes(saved.kind)) $('kind').value = saved.kind;
        if (typeof saved.search === 'string') $('search').value = saved.search;
      } catch { /* Default filters work without storage. */ }
      render();
    } catch {
      $('loading').textContent = 'Каталог не загрузился. Повторите загрузку или откройте полную инвентаризацию по ссылке ниже.';
      $('retry').hidden = false;
    }
  }
  $('retry').addEventListener('click', load); load();
})();
