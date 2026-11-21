(() => {
  const wall = document.getElementById('mayatnik-frames');
  const status = document.getElementById('mayatnik-feed-status');
  const more = document.getElementById('mayatnik-more');
  let cursor = null;
  function card(frame) {
    const label = 'Кадр ' + frame.frame;
    const figure = document.createElement('figure');
    const link = document.createElement('a');
    link.className = 'image-link';
    link.dataset.viewImage = '';
    link.href = frame.url;
    figure.dataset.journalKey = new URL(frame.url).pathname.slice(1);
    link.dataset.summary = frame.summary || (label + ' · ' + frame.width + ' × ' + frame.height + ' пикс. Параметры построения не записаны.');
    if (frame.scene) link.dataset.scene = frame.scene;
    const img = document.createElement('img');
    img.loading = 'lazy';
    img.decoding = 'async';
    img.width = frame.width;
    img.height = frame.height;
    img.alt = label;
    img.src = frame.url;
    const caption = document.createElement('figcaption');
    const title = document.createElement('span');
    title.className = 'figure-name';
    title.textContent = label;
    const date = document.createElement('time');
    date.dateTime = frame.created;
    date.textContent = new Date(frame.created).toLocaleString('ru-RU', {dateStyle:'short', timeStyle:'short'});
    caption.append(title, date);
    link.append(img);
    figure.append(link, caption);
    return figure;
  }
  async function loadPage() {
    if (more.disabled) return;
    more.disabled = true;
    status.textContent = 'Загрузка кадров…';
    try {
      const page = await window.MayatnikJournal.list(cursor);
      wall.append(...page.frames.map(card));
      cursor = page.cursor;
      more.hidden = !cursor;
      more.textContent = 'Ещё кадры';
      status.textContent = wall.children.length ? '' : 'Пока нет опубликованных кадров.';
    } catch {
      status.textContent = 'Не удалось загрузить опубликованные кадры.';
      more.textContent = 'Повторить';
      more.hidden = false;
    } finally { more.disabled = false; }
  }
  more.addEventListener('click', loadPage);
  loadPage();
})();
