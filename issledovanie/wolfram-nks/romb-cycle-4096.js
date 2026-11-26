'use strict';

(() => {
  const byId = id => document.getElementById(id);
  const canvas = byId('cycle-field');
  const context = canvas.getContext('2d', {alpha: false});
  const play = byId('cycle-play');
  const step = byId('cycle-step');
  const position = byId('cycle-position');
  const progress = byId('cycle-progress');
  const state = byId('cycle-state');
  const actionButtons = Array.from(document.querySelectorAll('[data-cycle-action]'));
  const number = new Intl.NumberFormat('ru-RU');
  const requestedStep = new URLSearchParams(location.search).get('step');
  if (requestedStep === '2' || requestedStep === '4') step.value = requestedStep;

  let playing = false;
  let busy = true;
  let failed = false;
  let buffer;
  let timer;

  function fail() {
    failed = true;
    toggle(false);
    state.textContent = 'Не удалось запустить расчёт. Обновите страницу.';
    updateControls();
  }

  if (!context || typeof Worker !== 'function') {
    fail();
    return;
  }

  const worker = new Worker('romb-cycle-4096-worker.js');
  worker.addEventListener('error', fail);
  worker.addEventListener('messageerror', fail);

  function updateControls() {
    play.disabled = failed || (busy && !buffer && !playing && progress.value === 0);
    actionButtons.forEach(button => { button.disabled = busy || failed; });
  }

  function run(action) {
    if (busy || failed) return;
    busy = true;
    const data = {action, step: Number(step.value), buffer};
    worker.postMessage(data, [buffer]);
    buffer = undefined;
    updateControls();
  }

  function schedule() {
    if (playing && !busy && !failed) timer = setTimeout(() => run('next'), 80);
  }

  function toggle(next) {
    playing = next;
    clearTimeout(timer);
    play.setAttribute('aria-pressed', String(playing));
    play.title = playing ? 'Пауза' : 'Воспроизвести';
    play.setAttribute('aria-label', play.title);
    play.querySelector('.gz-ic').textContent = playing ? 'Ⅱ' : '▶';
    play.querySelector('.gz-nm').textContent = play.title;
    schedule();
  }

  worker.addEventListener('message', ({data}) => {
    if (data.type === 'preparing') {
      state.textContent = 'Построение начального кадра · ' + number.format(data.frame) +
        ' / ' + number.format(data.first);
      return;
    }
    if (data.type !== 'frame') return;
    const {frame, first, last, width, height} = data;
    buffer = data.buffer;
    context.putImageData(new ImageData(new Uint8ClampedArray(buffer), width, height), 0, 0);
    busy = false;
    progress.max = last - first;
    progress.value = frame - first;
    position.textContent = 'Кадр ' + number.format(frame) + ' из ' + number.format(last);
    state.textContent = frame === last ? 'Точный возврат поля и ветвей' :
      frame === first ? 'Первое касание · начало периода' : '';
    updateControls();
    schedule();
  });

  play.addEventListener('click', () => toggle(!playing));
  actionButtons.forEach(button => button.addEventListener('click', () => {
    toggle(false);
    run(button.dataset.cycleAction);
  }));
})();
