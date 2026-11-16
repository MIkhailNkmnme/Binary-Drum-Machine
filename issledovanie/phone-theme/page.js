/* One foreground sound at a time; downloads and players also work without JS. */
'use strict';
const players = [...document.querySelectorAll('audio, video')];
const status = document.querySelector('#playback-status');
for (const player of players) {
  player.addEventListener('play', () => {
    for (const other of players) if (other !== player) other.pause();
    if (status) status.textContent = 'Играет: ' + player.getAttribute('aria-label');
  });
  player.addEventListener('error', () => {
    if (status) status.textContent = 'Не удалось воспроизвести файл. Попробуйте ссылку на скачивание под плеером.';
  });
}
for (const details of document.querySelectorAll('.live-paper > details')) {
  details.addEventListener('toggle', () => {
    if (!details.open) details.querySelector('video')?.pause();
  });
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) for (const player of players) player.pause();
});
