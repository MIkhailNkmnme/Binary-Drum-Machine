'use strict';

document.addEventListener('play', event => {
  if (!(event.target instanceof HTMLVideoElement)) return;
  for (const video of document.querySelectorAll('video')) {
    if (video !== event.target && !video.paused) video.pause();
  }
}, true);
