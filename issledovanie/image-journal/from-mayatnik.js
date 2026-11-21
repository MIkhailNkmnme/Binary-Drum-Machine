(() => {
  const wall = document.getElementById('mayatnik-frames');
  const status = document.getElementById('mayatnik-feed-status');
  const more = document.getElementById('mayatnik-more');
  window.MayatnikJournal?.catalogBackup('backup/catalog.json?v=024');
  let cursor = null;
  function card(frame) {
    const video = frame.kind === 'video';
    let label = 'Кадр ' + frame.frame;
    if (video) {
      const format = {'video/mp4':'MP4', 'video/webm':'WebM'}[frame.mime?.split(';')[0]];
      label = format ? 'Видео · ' + format : 'Видео';
    } else if (frame.kind === 'gif') label = 'GIF';
    if ((video || frame.kind === 'gif') && frame.duration > 0) {
      label += ' · ' + frame.duration.toLocaleString('ru-RU', {maximumFractionDigits:2}) + ' с';
    }
    const figure = document.createElement('figure');
    const link = document.createElement('a');
    link.className = 'image-link';
    link.dataset.viewImage = '';
    link.dataset.kind = frame.kind || 'image';
    link.href = frame.url;
    figure.dataset.journalKey = new URL(frame.url).pathname.slice(1);
    if (frame.summary && !video) link.dataset.summary = frame.summary;
    else if (link.dataset.kind === 'image') link.dataset.summary = 'Параметры построения не записаны.';
    if (frame.scene) link.dataset.scene = frame.scene;
    const preview = document.createElement(video ? 'video' : 'img');
    if (video) {
      preview.muted = true;
      preview.playsInline = true;
      preview.preload = 'metadata';
      link.setAttribute('aria-label', 'Открыть ' + label.toLowerCase());
    } else {
      preview.loading = 'lazy';
      preview.decoding = 'async';
      preview.alt = label;
    }
    if (frame.width && frame.height) {
      preview.width = frame.width;
      preview.height = frame.height;
    }
    const caption = document.createElement('figcaption');
    const title = document.createElement('span');
    title.className = 'figure-name';
    title.textContent = label;
    const date = document.createElement('time');
    date.dateTime = frame.created;
    date.textContent = new Date(frame.created).toLocaleString('ru-RU', {dateStyle:'short', timeStyle:'short'});
    caption.append(title, date);
    if ((video || frame.kind === 'gif') && /^[a-f0-9]{64}$/.test(frame.scene)) {
      const links = document.createElement('span');
      links.className = 'figure-links';
      const start = document.createElement('a');
      start.dataset.recordingStart = '';
      start.href = '/mayatnik/Zerkalius-mayatnik.html#journal=' + frame.scene;
      start.target = '_blank';
      start.rel = 'noopener';
      start.textContent = 'Начало записи в Маятнике';
      links.append(start);
      caption.append(links);
    }
    link.append(preview);
    figure.append(link, caption);
    window.MayatnikJournal.loadMedia(preview, frame.url);
    return figure;
  }
  async function loadPage() {
    if (more.disabled) return;
    more.disabled = true;
    more.textContent = 'Загрузка…';
    status.textContent = 'Загрузка кадров…';
    try {
      const page = await window.MayatnikJournal.list(cursor);
      const cards = page.frames.map(card);
      if (cursor) wall.append(...cards);
      else {
        for (const media of wall.querySelectorAll('img, video')) window.MayatnikJournal.cancelMedia(media);
        wall.replaceChildren(...cards);
      }
      cursor = page.cursor;
      more.hidden = !cursor && !page.backupDate;
      more.textContent = page.backupDate ? 'Проверить новые кадры' : 'Ещё кадры';
      status.textContent = page.backupDate
        ? 'Резервная копия от ' + new Date(page.backupDate).toLocaleDateString('ru-RU') + '.'
        : wall.children.length ? '' : 'Пока нет публикаций.';
    } catch {
      status.textContent = 'Не удалось загрузить список кадров. Повторите попытку.'
      more.textContent = 'Повторить';
      more.hidden = false;
    } finally { more.disabled = false; }
  }
  more.addEventListener('click', loadPage);
  loadPage();
})();
