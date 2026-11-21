(() => {
  const viewer = document.getElementById('image-viewer');
  if (typeof viewer.showModal !== 'function') return;

  const original = document.getElementById('viewer-original');
  const stage = document.getElementById('viewer-stage');
  const error = document.getElementById('viewer-error');
  const name = document.getElementById('viewer-name');
  const size = document.getElementById('viewer-size');
  const summary = document.getElementById('viewer-summary');
  const scene = document.getElementById('viewer-scene');
  const sceneStatus = document.getElementById('viewer-scene-status');
  const shell = viewer.querySelector('.viewer-shell');
  const expand = document.getElementById('viewer-expand');
  const mayatnik = '/mayatnik/Zerkalius-mayatnik.html';
  let selected = null;

  function showScene(url, label) {
    scene.href = url;
    scene.textContent = label;
    scene.hidden = false;
  }

  async function describeScene(link, figure) {
    scene.hidden = true;
    scene.removeAttribute('href');
    sceneStatus.textContent = '';
    if (link.dataset.scene) {
      sceneStatus.textContent = 'Загрузка параметров кадра…';
      try {
        const code = await window.MayatnikJournal.scene(link.dataset.scene);
        if (!code) throw new Error();
        if (selected !== link || !viewer.open) return;
        sceneStatus.textContent = '';
        showScene(mayatnik + '#s=' + code, 'Открыть кадр в Маятнике');
      } catch {
        if (selected !== link || !viewer.open) return;
        sceneStatus.textContent = 'Параметры кадра не загрузились.';
        showScene(mayatnik, 'Открыть Маятник');
      }
      return;
    }
    const article = link.closest('article');
    const source = figure?.querySelector('figcaption a[href]:not([data-view-image])');
    const recipe = article?.querySelector('.recipe p > a[href*="Zerkalius-mayatnik.html#"], .recipe p > a[href*="Zerkalius-mayatnik.html?"], .recipe .entry-links a[href*="?scene="]');
    if (source) {
      showScene(source.href, source.href.includes('Zerkalius-mayatnik.html') ? 'Открыть кадр в Маятнике' : source.textContent.trim());
    } else if (recipe) {
      showScene(recipe.href, recipe.href.includes('Zerkalius-mayatnik.html') ? 'Исходное поле в Маятнике' : recipe.textContent.trim());
    } else if (article?.id === 'from-mayatnik') {
      showScene(mayatnik, 'Открыть Маятник');
    }
  }

  function setExpanded(value) {
    viewer.classList.toggle('viewer-expanded', value);
    expand.setAttribute('aria-pressed', String(value));
    expand.textContent = value ? 'Свернуть' : 'Во весь экран';
  }
  expand.addEventListener('click', () => {
    const value = !viewer.classList.contains('viewer-expanded');
    setExpanded(value);
    if (value) shell.requestFullscreen?.().catch(() => {});
    else if (document.fullscreenElement === shell) document.exitFullscreen().catch(() => {});
  });
  shell.addEventListener('fullscreenchange', () => setExpanded(document.fullscreenElement === shell));

  document.getElementById('journal').addEventListener('click', event => {
    const link = event.target.closest('a[data-view-image]');
    if (!link || event.defaultPrevented || event.button !== 0 ||
        event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;

    event.preventDefault();
    selected = link;
    const figure = link.closest('figure');
    const thumbnail = figure?.querySelector('img');
    const image = new Image();
    image.alt = link.querySelector('img')?.alt || figure?.querySelector('.figure-name')?.textContent.trim() || link.textContent.trim();
    name.textContent = figure?.querySelector('.figure-name')?.textContent.trim() || image.alt;
    const caption = figure?.querySelector('figcaption p')?.textContent.trim();
    summary.textContent = link.dataset.summary || caption || (thumbnail?.alt !== name.textContent ? thumbnail?.alt : '') || '';
    summary.hidden = !summary.textContent;
    size.textContent = '';
    image.addEventListener('load', () => {
      if (stage.contains(image)) size.textContent = image.naturalWidth + ' × ' + image.naturalHeight + ' пикс.';
    }, { once: true });
    image.decoding = 'async';
    image.addEventListener('error', () => {
      if (stage.contains(image)) {
        image.remove();
        error.hidden = false;
      }
    }, { once: true });

    original.href = link.href;
    error.hidden = true;
    stage.replaceChildren(image);
    viewer.showModal();
    viewer.dataset.key = link.closest('[data-journal-key]')?.dataset.journalKey || new URL(link.href).pathname.replace(/^\/+/, '');
    viewer.dataset.label = name.textContent;
    document.dispatchEvent(new Event('journal-image-open'));
    describeScene(link, figure);
    image.src = link.href;
  });

  const outsideImage = target => !target.closest('img, .viewer-info, .viewer-toolbar');
  let pressedOutside = false;
  viewer.addEventListener('pointerdown', event => {
    pressedOutside = event.button === 0 && outsideImage(event.target);
  });
  viewer.addEventListener('click', event => {
    const dismiss = pressedOutside && outsideImage(event.target);
    pressedOutside = false;
    if (dismiss) viewer.close();
  });
  viewer.addEventListener('close', () => {
    if (viewer.open) return;
    selected = null;
    if (document.fullscreenElement === shell) document.exitFullscreen().catch(() => {});
    setExpanded(false);
    stage.replaceChildren();
  });
})();
