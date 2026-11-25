(() => {
  'use strict';
  const mode = document.getElementById('hubFourTriangles');
  const colours = document.getElementById('hubFourAxisColour');
  const frame = document.getElementById('hubFourFrame');
  const original = document.getElementById('hubXorBackground');
  const pause = document.getElementById('hubComparePause');
  const key = 'zerk_hub_four_triangles';
  let open = false, axes = false, pausedOriginal = false;

  try {
    const saved = JSON.parse(localStorage.getItem(key));
    open = saved?.open === true && !new URLSearchParams(location.search).has('scene');
    axes = saved?.axes === true;
  } catch { /* Default to the Hub comparison. */ }

  function send() {
    if (frame.hasAttribute('src')) {
      frame.contentWindow?.postMessage({type: 'zerk-hub-four', active: open, axes}, location.origin === 'null' ? '*' : location.origin);
    }
  }

  function sync() {
    frame.hidden = !open;
    document.body.classList.toggle('hub-four-active', open);
    mode.setAttribute('aria-pressed', String(open));
    mode.classList.toggle('gz-on', open);
    colours.setAttribute('aria-pressed', String(axes));
    colours.classList.toggle('gz-on', axes);
    colours.disabled = !open;
    if (open && !frame.hasAttribute('src')) frame.src = 'mayatnik/romb.html?hub=four';
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
    try {localStorage.setItem(key, JSON.stringify({open, axes}));} catch { /* Optional preferences. */ }
  }

  mode.addEventListener('click', () => setOpen(!open));
  colours.addEventListener('click', () => {
    axes = !axes;
    setOpen(open);
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
