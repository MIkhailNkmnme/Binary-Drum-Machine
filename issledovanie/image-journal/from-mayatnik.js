(() => {
  const wall = document.getElementById('mayatnik-frames');
  const status = document.getElementById('mayatnik-feed-status');
  const more = document.getElementById('mayatnik-more');
  const api = 'https://media.1001100.online/mayatnik-api/frames';
  let cursor = null;
  function card(frame) {
    const label = 'Кадр ' + frame.frame;
    const figure = document.createElement('figure');
    const link = document.createElement('a');
    link.className = 'image-link';
    link.dataset.viewImage = '';
    link.href = frame.url;
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
      const url = new URL(api);
      if (cursor) url.searchParams.set('cursor', cursor);
      const response = await fetch(url, {credentials:'omit', cache:'no-store', signal:AbortSignal.timeout(20000)});
      if (!response.ok) throw Error();
      const page = await response.json();
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
