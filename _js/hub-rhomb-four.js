(() => {
  'use strict';
  const mode = document.getElementById('hubFourTriangles');
  const colours = document.getElementById('hubFourAxisColour');
  const direction = document.getElementById('hubFourVertical');
  const frame = document.getElementById('hubFourFrame');
  const original = document.getElementById('hubXorBackground');
  const pause = document.getElementById('hubComparePause');
  const key = 'zerk_hub_four_triangles';
  const query = new URLSearchParams(location.search);
  let open = false, axes = false, vertical = false, pausedOriginal = false;

  try {
    const saved = JSON.parse(localStorage.getItem(key));
    open = saved?.open === true && !query.has('scene');
    axes = saved?.axes === true;
    vertical = saved?.vertical === true;
  } catch { /* Default to the Hub comparison. */ }

  if (query.get('four') === 'axes') open = axes = true;
  if (query.get('four') === 'vertical') open = axes = vertical = true;

  function send() {
    if (frame.hasAttribute('src')) {
      frame.contentWindow?.postMessage({type: 'zerk-hub-four', active: open, axes, vertical}, location.origin === 'null' ? '*' : location.origin);
    }
  }

  function sync() {
    frame.hidden = !open;
    document.body.classList.toggle('hub-four-active', open);
    mode.setAttribute('aria-pressed', String(open));
    mode.classList.toggle('gz-on', open);
    colours.setAttribute('aria-pressed', String(open && axes));
    colours.classList.toggle('gz-on', open && axes);
    direction.setAttribute('aria-pressed', String(open && vertical));
    direction.classList.toggle('gz-on', open && vertical);
    if (open && !frame.hasAttribute('src')) frame.src = 'mayatnik/romb.html?hub=four&v=013';
    if (open && !pausedOriginal && !pause.disabled && original.dataset.paused === 'false') {
      pause.click();
      pausedOriginal = true;
    }
    if (!open && pausedOriginal) {
      if (original.dataset.paused === 'true') pause.click();
      pausedOriginal = false;
    }
    send();
  }

  function setOpen(value) {
    open = value;
    sync();
    try {localStorage.setItem(key, JSON.stringify({open, axes, vertical}));} catch { /* Optional preferences. */ }
  }

  mode.addEventListener('click', () => setOpen(!open));
  colours.addEventListener('click', () => {
    axes = !open || !axes;
    setOpen(true);
  });
  direction.addEventListener('click', () => {
    vertical = !open || !vertical;
    setOpen(true);
  });
  frame.addEventListener('load', send);
  window.addEventListener('keydown', event => {
    if (event.key === 'Escape' && open) setOpen(false);
  });
  window.addEventListener('message', event => {
    if (event.source === frame.contentWindow && event.origin === location.origin && event.data?.type === 'zerk-hub-four-close') {
      setOpen(false);
    }
  });
  sync();
})();
