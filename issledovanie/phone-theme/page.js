/* One foreground sound at a time; downloads and players also work without JS. */
'use strict';
const players = [...document.querySelectorAll('audio')];
const status = document.querySelector('#playback-status');
for (const player of players) {
  player.addEventListener('play', () => {
    for (const other of players) if (other !== player) other.pause();
    if (status) status.textContent = 'Играет: ' + player.getAttribute('aria-label');
  });
  player.addEventListener('error', () => {
    if (status) status.textContent = 'Не удалось воспроизвести звук. Попробуйте ссылку на скачивание под плеером.';
  });
}
